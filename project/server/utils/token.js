const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../config/runtime');

const DEFAULT_EXPIRES_IN = '1d';

function signAuthToken(userId, tokenVersion = 0) {
    return jwt.sign({ id: userId.toString(), tokenVersion }, getJwtSecret(process.env), {
        expiresIn: process.env.JWT_EXPIRES_IN || DEFAULT_EXPIRES_IN,
    });
}

function verifyAuthToken(token) {
    return jwt.verify(token, getJwtSecret(process.env));
}

module.exports = {
    signAuthToken,
    verifyAuthToken,
};
