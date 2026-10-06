'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createRetryLoop } = require('../lib/retry-loop');

function fakeClock() {
  const timers = [];
  return {
    timers,
    setTimer(callback, delay) { const timer = { callback, delay, cancelled: false }; timers.push(timer); return timer; },
    clearTimer(timer) { timer.cancelled = true; },
    fire(timer = timers[timers.length - 1]) { timer.callback(); },
  };
}

function fixture(onRetry) {
  const clock = fakeClock();
  let retries = 0;
  const retry = createRetryLoop({ onRetry: () => { retries++; if (onRetry) onRetry(retry); }, setTimer: clock.setTimer, clearTimer: clock.clearTimer });
  return { clock, retry, get retries() { return retries; } };
}

test('Retries continue after five failures with capped exponential delay', () => {
  const f = fixture();
  const delays = [];
  for (let i = 0; i < 12; i++) {
    delays.push(f.retry.failed());
    assert.equal(f.retry.pending, true);
    f.clock.fire();
    assert.equal(f.retry.pending, false);
  }
  assert.deepEqual(delays, [1000, 2000, 4000, 8000, 16000, 32000, 60000, 60000, 60000, 60000, 60000, 60000]);
  assert.equal(f.retries, 12);
  assert.equal(f.retry.attempts, 12);
});

test('Repeated failures while waiting coalesce into one attempt and timer', () => {
  const f = fixture();
  assert.equal(f.retry.failed(), 1000);
  assert.equal(f.retry.failed(), 1000);
  assert.equal(f.retry.failed(), 1000);
  assert.equal(f.clock.timers.length, 1);
  assert.equal(f.retry.attempts, 1);
  f.clock.fire();
  assert.equal(f.retries, 1);
  assert.equal(f.retry.failed(), 2000);
});

test('Recovery cancels pending retries and resets the backoff', () => {
  const f = fixture();
  f.retry.failed(); f.clock.fire(); f.retry.failed(); f.clock.fire();
  assert.equal(f.retry.failed(), 4000);
  const previous = f.clock.timers[f.clock.timers.length - 1];
  assert.equal(f.retry.reset(), true);
  assert.equal(previous.cancelled, true);
  assert.equal(f.retry.pending, false);
  assert.equal(f.retry.attempts, 0);
  assert.equal(f.retry.failed(), 1000);
  // An already queued callback may run even after clearTimeout. It must neither
  // retry nor erase the replacement timer created after recovery.
  f.clock.fire(previous);
  assert.equal(f.retries, 2);
  assert.equal(f.retry.pending, true);
  f.clock.fire();
  assert.equal(f.retries, 3);
});

test('The timer is cleared before retry so a failure can schedule its next retry', () => {
  const f = fixture(retry => {
    assert.equal(retry.pending, false);
    retry.failed();
  });
  f.retry.failed(); f.clock.fire();
  assert.equal(f.retries, 1);
  assert.equal(f.retry.pending, true);
  assert.equal(f.clock.timers.length, 2);
  assert.equal(f.clock.timers[1].delay, 2000);
});

test('Stopping is terminal and stale cancelled callbacks cannot restart it', () => {
  const f = fixture();
  f.retry.failed();
  const previous = f.clock.timers[0];
  f.retry.stop(); f.retry.stop();
  assert.equal(previous.cancelled, true);
  assert.equal(f.retry.pending, false);
  assert.equal(f.retry.failed(), null);
  assert.equal(f.retry.reset(), false);
  f.clock.fire(previous);
  assert.equal(f.retries, 0);
  assert.equal(f.clock.timers.length, 1);
});

test('Invalid callbacks and non-positive or non-finite delays are rejected', () => {
  for (const options of [{}, { onRetry: 1 }, { onRetry() {}, setTimer: null }, { onRetry() {}, clearTimer: false }]) {
    assert.throws(() => createRetryLoop(options), TypeError);
  }
  for (const delay of [0, -1, NaN, Infinity, -Infinity, '1000', null]) {
    assert.throws(() => createRetryLoop({ onRetry() {}, baseDelay: delay }), RangeError);
    assert.throws(() => createRetryLoop({ onRetry() {}, maxDelay: delay }), RangeError);
  }
  assert.throws(() => createRetryLoop({ onRetry() {}, baseDelay: 1000, maxDelay: 500 }), RangeError);
});
