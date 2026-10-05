'use strict';

// Opt-in live check: never use production credentials in ordinary tests or CI.
const path = require('node:path');
const { chromium } = require('@playwright/test');
const { loadEnv } = require('../lib/env');

function validateServers(value) {
  if (!Array.isArray(value) || !value.length || value.length > 30) throw new Error('configuration');
  let relayCount = 0;
  const servers = value.map(entry => {
    if (!entry || typeof entry !== 'object') throw new Error('configuration');
    const urls = typeof entry.urls === 'string' ? [entry.urls] : entry.urls;
    if (!Array.isArray(urls) || !urls.length || urls.length > 20 || urls.some(url => typeof url !== 'string' || !/^(?:stun|stuns|turn|turns):(?:[a-z0-9.-]+|\[[a-f0-9:]+\])(?::[0-9]{1,5})?(?:\?transport=(?:udp|tcp))?$/i.test(url))) throw new Error('configuration');
    const hasRelay = urls.some(url => /^turns?:/i.test(url));
    const server = { urls };
    if (hasRelay) {
      if (typeof entry.username !== 'string' || !entry.username || entry.username.length > 1024 || typeof entry.credential !== 'string' || !entry.credential || entry.credential.length > 1024 || (entry.credentialType && entry.credentialType !== 'password')) throw new Error('configuration');
      server.username = entry.username;
      server.credential = entry.credential;
      relayCount++;
    }
    return server;
  });
  if (!relayCount) throw new Error('configuration');
  return { servers, relayCount };
}

async function credentials() {
  loadEnv(path.join(__dirname, '..', '.env'));
  let list = [], source = 'static';
  if (process.env.TURN_SERVERS) list = JSON.parse(process.env.TURN_SERVERS);
  if (process.env.TURN_CREDENTIALS_URL) {
    source = 'provider';
    const endpoint = new URL(process.env.TURN_CREDENTIALS_URL);
    if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password) throw new Error('configuration');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(endpoint, { signal: controller.signal, redirect: 'error' });
      if (!response.ok) throw new Error('provider');
      const body = await response.text();
      if (body.length > 65536) throw new Error('provider');
      const remote = JSON.parse(body);
      if (!Array.isArray(remote) || !Array.isArray(list)) throw new Error('configuration');
      list = list.concat(remote);
    } finally { clearTimeout(timer); }
  }
  return { ...validateServers(list), source };
}

async function main() {
  let browser, watchdog, stage = 'configuration or credential retrieval';
  try {
    const { servers, relayCount, source } = await credentials();
    console.log(`TURN credentials: OK (${source}; ${servers.length} entries, ${relayCount} relay entries).`);
    stage = 'browser startup';
    browser = await chromium.launch({
      channel: process.env.PLAYWRIGHT_CHANNEL === 'chromium' ? undefined : 'msedge',
      headless: true, timeout: 10000,
      args: ['--autoplay-policy=no-user-gesture-required'],
    });
    const page = await browser.newPage();
    stage = 'relay connection, data channel or decoded video';
    const test = page.evaluate(async iceServers => {
      const left = new RTCPeerConnection({ iceServers, iceTransportPolicy: 'relay' });
      const right = new RTCPeerConnection({ iceServers, iceTransportPolicy: 'relay' });
      const queue = new Map([[left, []], [right, []]]);
      const canvas = document.createElement('canvas');
      canvas.width = 160; canvas.height = 120;
      const ctx = canvas.getContext('2d');
      const video = document.createElement('video');
      video.muted = true; video.autoplay = true; video.playsInline = true;
      document.body.appendChild(video);
      let stream, paintTimer, timeout, inbound, outbound, failure;
      const failed = new Promise((_, reject) => { failure = reject; });
      const fail = () => failure(new Error('relay check failed'));
      const transfer = (from, to) => {
        from.onicecandidate = event => {
          if (!event.candidate) return;
          if (to.remoteDescription) to.addIceCandidate(event.candidate).catch(fail);
          else queue.get(to).push(event.candidate);
        };
        from.onconnectionstatechange = () => { if (from.connectionState === 'failed') fail(); };
      };
      const flush = async pc => { for (const candidate of queue.get(pc).splice(0)) await pc.addIceCandidate(candidate); };
      transfer(left, right); transfer(right, left);
      const decoded = new Promise(resolve => {
        right.ontrack = event => {
          video.srcObject = new MediaStream([event.track]);
          video.requestVideoFrameCallback(() => resolve());
          video.play().catch(fail);
        };
      });
      const probe = 'robot-turn-relay-probe';
      const data = new Promise(resolve => {
        right.ondatachannel = event => {
          inbound = event.channel;
          inbound.onmessage = message => { if (message.data === probe) inbound.send(probe); else fail(); };
          inbound.onerror = fail;
        };
        outbound = left.createDataChannel('relay-probe');
        outbound.onopen = () => outbound.send(probe);
        outbound.onmessage = message => { if (message.data === probe) resolve(); else fail(); };
        outbound.onerror = fail;
      });
      try {
        ctx.fillStyle = '#18578a'; ctx.fillRect(0, 0, 160, 120);
        stream = canvas.captureStream(5);
        let frame = 0;
        paintTimer = setInterval(() => {
          ctx.fillStyle = frame++ % 2 ? '#18578a' : '#efaa32';
          ctx.fillRect(0, 0, 160, 120);
        }, 200);
        left.addTrack(stream.getVideoTracks()[0], stream);
        timeout = setTimeout(fail, 30000);
        const exchange = async () => {
          await left.setLocalDescription(await left.createOffer());
          await right.setRemoteDescription(left.localDescription);
          await flush(right);
          await right.setLocalDescription(await right.createAnswer());
          await left.setRemoteDescription(right.localDescription);
          await flush(left);
          await Promise.all([data, decoded]);
          const stats = await left.getStats();
          const transport = Array.from(stats.values()).find(item => item.type === 'transport' && item.selectedCandidatePairId);
          const pair = transport ? stats.get(transport.selectedCandidatePairId) : Array.from(stats.values()).find(item => item.type === 'candidate-pair' && item.nominated && item.state === 'succeeded');
          const local = pair && stats.get(pair.localCandidateId), remote = pair && stats.get(pair.remoteCandidateId);
          if (!local || !remote || local.candidateType !== 'relay' || remote.candidateType !== 'relay') throw new Error('relay required');
          return {
            localType: 'relay', remoteType: 'relay',
            protocol: ['udp', 'tcp'].includes(local.protocol) ? local.protocol : 'unknown',
            relayProtocol: ['udp', 'tcp', 'tls'].includes(local.relayProtocol) ? local.relayProtocol : 'unreported',
            dataChannel: 'passed', decodedVideo: 'passed',
          };
        };
        return await Promise.race([exchange(), failed]);
      } finally {
        clearTimeout(timeout); clearInterval(paintTimer);
        if (stream) stream.getTracks().forEach(track => track.stop());
        if (inbound) inbound.close(); if (outbound) outbound.close();
        left.close(); right.close(); video.srcObject = null; video.remove();
      }
    }, servers);
    const stalled = new Promise((_, reject) => {
      watchdog = setTimeout(() => {
        browser.close().catch(() => {});
        reject(new Error('timeout'));
      }, 35000);
    });
    const result = await Promise.race([test, stalled]);
    console.log(`TURN live check: PASS. Selected candidates: ${result.localType}/${result.remoteType}; protocol: ${result.protocol}; relay transport: ${result.relayProtocol}.`);
    console.log('Data channel echo: PASS. Synthetic video decoded: PASS.');
  } catch {
    // Browser/provider errors can contain credentials or IPs. Never print them.
    console.error(`TURN live check: FAIL during ${stage}. No direct-connection fallback was used.`);
    console.error('Check private TURN configuration, provider quota, firewall access and the installed test browser.');
    process.exitCode = 1;
  } finally {
    clearTimeout(watchdog);
    if (browser) await browser.close().catch(() => {});
  }
}

main();
