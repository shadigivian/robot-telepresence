'use strict';

// Keep child output bounded, including providers that print large QR codes.
// Oversized lines are discarded until the next newline, then parsing resumes.
function createLineParser(onLine, maxLineLength = 512 * 1024) {
  let pending = '', dropping = false;
  return chunk => {
    const parts = String(chunk).split('\n');
    for (let i = 0; i < parts.length; i++) {
      if (!dropping) {
        if (pending.length + parts[i].length > maxLineLength) { pending = ''; dropping = true; }
        else pending += parts[i];
      }
      if (i < parts.length - 1) {
        if (!dropping) onLine(pending.replace(/\r$/, ''));
        pending = ''; dropping = false;
      }
    }
  };
}

function localhostRunOrigin(line) {
  let event;
  try { event = JSON.parse(line); } catch { return null; }
  if (!event || event.type !== 'v1.tcpip_forward.register.accepted' || typeof event.data !== 'string') return null;
  if (event.source && event.source !== 'ssh://localhost.run/') return null;
  const candidates = event.data.match(/https:\/\/[^\s\u001b]+/g) || [];
  for (const candidate of candidates) {
    let url;
    try { url = new URL(candidate); } catch { continue; }
    if (url.protocol === 'https:' && /^[a-z0-9][a-z0-9-]{0,62}\.lhr\.life$/.test(url.hostname) &&
        !url.username && !url.password && !url.port && !url.search && !url.hash && url.pathname === '/' &&
        (candidate === url.origin || candidate === url.origin + '/')) {
      return url.origin;
    }
  }
  return null;
}

module.exports = { createLineParser, localhostRunOrigin };
