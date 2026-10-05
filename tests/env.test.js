'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseEnv, loadEnv } = require('../lib/env');

test('Private env parses quoted values and comments without expanding expressions', () => {
  const values = parseEnv([
    '\uFEFF# private settings',
    'HOST = 127.0.0.1 # local only',
    "TURN_SERVERS='[{\"urls\":\"turn:example.test:443\",\"credential\":\"a # b\"}]' # JSON",
    'URL=https://example.test/credentials?apiKey=example#fragment',
    'LITERAL=$OTHER $(command) `command`',
    'QUOTED="line\\nnext\\t\\\"quote\\\"\\\\end"',
    'EMPTY=',
    "SPACES='  keep spaces  '",
    'COMMENT= # empty',
    ''
  ].join('\r\n'));
  assert.equal(values.HOST, '127.0.0.1');
  assert.equal(JSON.parse(values.TURN_SERVERS)[0].credential, 'a # b');
  assert.equal(values.URL, 'https://example.test/credentials?apiKey=example#fragment');
  assert.equal(values.LITERAL, '$OTHER $(command) `command`');
  assert.equal(values.QUOTED, 'line\nnext\t"quote"\\end');
  assert.equal(values.EMPTY, ''); assert.equal(values.COMMENT, '');
  assert.equal(values.SPACES, '  keep spaces  ');
});

test('Private env errors redact values, reject broken syntax and do not partially mutate settings', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'robot-env-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const filename = path.join(dir, '.env');
  for (const invalid of ['BROKEN', '9KEY=value', 'KEY="example-secret', "KEY='example-secret' trailing", 'KEY=value\0example-secret']) {
    fs.writeFileSync(filename, `FIRST=changed\n${invalid}`);
    const target = {};
    assert.throws(() => loadEnv(filename, target), err => {
      assert.equal(err.message, 'Invalid .env syntax at line 2');
      assert.equal(err.stack.includes('example-secret'), false);
      return true;
    });
    assert.deepEqual(target, {});
  }
});

test('Private env preserves host settings, handles duplicates and ignores missing files', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'robot-env-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const filename = path.join(dir, '.env');
  const target = { HOST: '0.0.0.0', TURN_CREDENTIALS_URL: '' };
  loadEnv(filename, target);
  assert.deepEqual(target, { HOST: '0.0.0.0', TURN_CREDENTIALS_URL: '' });
  fs.writeFileSync(filename, 'HOST=127.0.0.1\nTURN_CREDENTIALS_URL=https://example.test\nPORT=3000\nPORT=3001\n__proto__=literal\n');
  loadEnv(filename, target);
  assert.equal(target.HOST, '0.0.0.0');
  assert.equal(target.TURN_CREDENTIALS_URL, '');
  assert.equal(target.PORT, '3001');
  assert.equal(Object.hasOwn(target, '__proto__'), true);
  assert.equal(target.__proto__, 'literal');
});

test('Private env loads into the Node process environment by default', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'robot-env-'));
  const key = `ROBOT_ENV_TEST_${process.pid}`;
  const previous = process.env[key];
  t.after(() => {
    if (previous === undefined) delete process.env[key]; else process.env[key] = previous;
    fs.rmSync(dir, { recursive: true, force: true });
  });
  delete process.env[key];
  const filename = path.join(dir, '.env');
  fs.writeFileSync(filename, `${key}=local-setting`);
  loadEnv(filename);
  assert.equal(process.env[key], 'local-setting');
});
