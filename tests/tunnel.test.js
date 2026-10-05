'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createLineParser, localhostRunOrigin } = require('../lib/tunnel');
const event = data => JSON.stringify({ type: 'v1.tcpip_forward.register.accepted', source: 'ssh://localhost.run/', data });

test('localhost.run accepts only a registered bare HTTPS lhr.life origin', () => {
  assert.equal(localhostRunOrigin(event('sample.lhr.life tunneled, https://sample.lhr.life\r\nQR')), 'https://sample.lhr.life');
  assert.equal(localhostRunOrigin(event('Docs https://localhost.run/docs/ then https://sample.lhr.life')), 'https://sample.lhr.life');
  for (const url of ['http://sample.lhr.life', 'https://sample.lhr.life.evil.test', 'https://evil.test',
    'https://person:password@sample.lhr.life', 'https://sample.lhr.life:444', 'https://sample.lhr.life:443', 'https://sample.lhr.life/path',
    'https://sample.lhr.life?secret=value', 'https://sample.lhr.life#fragment']) {
    assert.equal(localhostRunOrigin(event(url)), null);
  }
  assert.equal(localhostRunOrigin(JSON.stringify({ type: 'message', data: 'https://sample.lhr.life' })), null);
  assert.equal(localhostRunOrigin(JSON.stringify({ type: 'v1.tcpip_forward.register.accepted', source: 'ssh://evil.test/', data: 'https://sample.lhr.life' })), null);
  assert.equal(localhostRunOrigin('malformed JSON'), null);
});

test('Tunnel parser assembles split JSON and recovers after oversized output', () => {
  const lines = [], feed = createLineParser(line => lines.push(line), 256);
  const accepted = event('https://sample.lhr.life');
  feed(accepted.slice(0, 15)); assert.equal(lines.length, 0);
  feed(accepted.slice(15) + '\r\n');
  assert.equal(localhostRunOrigin(lines[0]), 'https://sample.lhr.life');
  feed('x'.repeat(300)); feed('remaining oversized line\n' + accepted + '\n');
  assert.equal(lines.length, 2);
  assert.equal(localhostRunOrigin(lines[1]), 'https://sample.lhr.life');
});
