'use strict';

// Keep reconnecting until stopped, with one pending timer and bounded backoff.
// Timer functions are injectable so recovery can be tested without waiting.
function createRetryLoop({
  onRetry,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  baseDelay = 1000,
  maxDelay = 60000,
} = {}) {
  if (typeof onRetry !== 'function' || typeof setTimer !== 'function' || typeof clearTimer !== 'function') {
    throw new TypeError('Retry callbacks must be functions.');
  }
  if (!Number.isFinite(baseDelay) || baseDelay <= 0 || !Number.isFinite(maxDelay) || maxDelay <= 0 || maxDelay < baseDelay) {
    throw new RangeError('Retry delays must be positive finite numbers with maxDelay >= baseDelay.');
  }

  let attempts = 0, pending = null, generation = 0, stopped = false;

  function cancelPending() {
    generation++;
    const previous = pending;
    pending = null;
    if (previous) clearTimer(previous.handle);
  }

  function failed() {
    if (stopped) return null;
    if (pending) return pending.delay;
    attempts = Math.min(attempts + 1, Number.MAX_SAFE_INTEGER);
    const delay = Math.min(maxDelay, baseDelay * 2 ** (attempts - 1));
    const scheduled = { delay, generation, handle: null };
    pending = scheduled;
    try {
      scheduled.handle = setTimer(() => {
        if (stopped || pending !== scheduled || generation !== scheduled.generation) return;
        pending = null;
        onRetry();
      }, delay);
    } catch (error) {
      if (pending === scheduled) pending = null;
      throw error;
    }
    return delay;
  }

  function reset() {
    if (stopped) return false;
    cancelPending();
    attempts = 0;
    return true;
  }

  function stop() {
    if (stopped) return;
    stopped = true;
    cancelPending();
  }

  return { failed, reset, stop, get pending() { return !!pending; }, get attempts() { return attempts; } };
}

module.exports = { createRetryLoop };
