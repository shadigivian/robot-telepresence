'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { ensure } = require('./domain');

function passwordHash(password, salt = crypto.randomBytes(16).toString('hex')) {
  ensure(typeof password === 'string' && password.length >= 12 && password.length <= 256, 'رمز باید بین ۱۲ و ۲۵۶ نویسه باشد.');
  return `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`;
}
function checkPassword(password, hash) {
  if (typeof password !== 'string' || password.length > 256 || typeof hash !== 'string') return false;
  const [salt, digest] = hash.split(':');
  const expected = Buffer.from(digest || '', 'hex');
  const actual = crypto.scryptSync(password, salt, 64);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}
class Store {
  constructor(filename) {
    this.filename = filename;
    if (fs.existsSync(filename)) this.data = JSON.parse(fs.readFileSync(filename, 'utf8'));
    else {
      this.data = { version: 1, directory: { name: 'مکان شما', floors: [], nodes: [], edges: [], rooms: [], people: [] }, users: [], robots: [], visits: [] };
      this.save();
    }
    ensure(this.data.version === 1, 'نسخه فایل داده پشتیبانی نمی‌شود.');
  }
  save(data = this.data) {
    fs.mkdirSync(path.dirname(this.filename), { recursive: true });
    const tmp = `${this.filename}.tmp`;
    const fd = fs.openSync(tmp, 'w', 0o600);
    try { fs.writeFileSync(fd, JSON.stringify(data, null, 2)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    fs.renameSync(tmp, this.filename);
  }
  change(fn) {
    const next = structuredClone(this.data);
    const result = fn(next);
    this.save(next); // Commit to disk before advertising success or publishing events.
    this.data = next;
    return result;
  }
}
module.exports = { Store, passwordHash, checkPassword };
