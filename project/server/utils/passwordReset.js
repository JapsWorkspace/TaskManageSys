const crypto = require('crypto');

function generatePasswordResetCode() {
  return crypto.randomBytes(5).toString('hex');
}

module.exports = { generatePasswordResetCode };
