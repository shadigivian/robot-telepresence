'use strict';
const fs = require('node:fs');

// Intentionally small .env grammar. Values are data, never shell expressions.
function parseEnv(contents) {
  const values = Object.create(null);
  const lines = String(contents).replace(/^\uFEFF/, '').split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) continue;
    const invalid = () => { throw new Error(`Invalid .env syntax at line ${i + 1}`); };
    if (line.includes('\0')) invalid();
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) invalid();
    const key = match[1], raw = match[2];
    let value = '';
    if (raw.startsWith("'") || raw.startsWith('"')) {
      const quote = raw[0];
      let end = -1;
      for (let j = 1; j < raw.length; j++) {
        if (quote === '"' && raw[j] === '\\' && j + 1 < raw.length) {
          const escaped = raw[++j];
          const escapes = { n: '\n', r: '\r', t: '\t', '"': '"', '\\': '\\' };
          value += Object.hasOwn(escapes, escaped) ? escapes[escaped] : '\\' + escaped;
        } else if (raw[j] === quote) { end = j; break; }
        else value += raw[j];
      }
      if (end < 0 || !/^\s*(?:#.*)?$/.test(raw.slice(end + 1))) invalid();
    } else {
      // Keep URL fragments intact; an unquoted comment starts after whitespace.
      value = raw.replace(/\s+#.*$/, '').trimEnd();
      if (value.startsWith('#')) value = '';
    }
    values[key] = value;
  }
  return values;
}

function loadEnv(filename, target = process.env) {
  let contents;
  try { contents = fs.readFileSync(filename, 'utf8'); }
  catch (err) { if (err.code === 'ENOENT') return; throw err; }
  // Parse the whole file before changing the environment. Existing host/shell
  // settings take precedence, including deliberately empty settings.
  const values = parseEnv(contents);
  for (const [key, value] of Object.entries(values)) {
    if (!Object.hasOwn(target, key)) {
      Object.defineProperty(target, key, { value, writable: true, enumerable: true, configurable: true });
    }
  }
}

module.exports = { parseEnv, loadEnv };
