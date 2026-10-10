'use strict';
function normalizeUsername(value) {
  return typeof value === 'string' ? value.trim().normalize('NFC').replace(/ي/g, 'ی').replace(/ك/g, 'ک') : '';
}
function validUsername(value) { return /^[\p{L}\p{N}\p{M}_.\-\u200c]{3,64}$/u.test(value); }
module.exports = { normalizeUsername, validUsername };
