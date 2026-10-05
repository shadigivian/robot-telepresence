/* Pure policies shared by both apps and executable in Node tests. */
(function (root) {
  'use strict';
  class CommandGate {
    constructor(now = () => performance.now()) { this.now = now; this.reset(); }
    reset() { this.lease = null; this.seq = -1; this.challenges = new Map(); }
    grant(lease) { if (this.lease !== lease) { this.reset(); this.lease = lease; } }
    issue(value) { this.challenges.set(value, this.now()); for (const [c, at] of this.challenges) if (this.now() - at > 450) this.challenges.delete(c); }
    accept(msg) {
      if (!msg || !['F', 'B', 'L', 'R', 'S'].includes(msg.c)) return false;
      if (msg.c === 'S') { if (Number.isSafeInteger(msg.seq)) this.seq = Math.max(this.seq, msg.seq); return true; }
      if (!this.lease || msg.lease !== this.lease || !this.challenges.has(msg.challenge) || this.now() - this.challenges.get(msg.challenge) > 450 || !Number.isSafeInteger(msg.seq) || msg.seq <= this.seq || !Number.isFinite(msg.v) || msg.v < 0 || msg.v > 255) return false;
      this.seq = msg.seq;
      return true;
    }
  }
  class FrameWatch {
    constructor(now = () => performance.now()) { this.now = now; this.reset(); }
    reset() { this.last = -Infinity; this.frames = -1; }
    frame(value) { if (value !== this.frames) { this.frames = value; this.last = this.now(); } }
    get fresh() { return this.now() - this.last < 1200; }
  }
  function canDrive(s) { return !!(s.link && s.server && s.board && s.video && s.lease && s.visible); }
  const api = { CommandGate, FrameWatch, canDrive };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RobotSafety = api;
})(typeof window !== 'undefined' ? window : globalThis);
