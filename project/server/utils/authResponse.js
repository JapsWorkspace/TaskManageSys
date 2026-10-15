const { signAuthToken } = require('./token');

function toSafeUser(user) {
    return {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        birthday: user.birthday,
        username: user.username,
        email: user.email,
        phone: user.phone,
        role: user.role,
        avatarUrl: user.avatarUrl,
    };
}

function buildAuthResponse(user) {
    return {
        token: signAuthToken(user._id, user.tokenVersion || 0),
        user: toSafeUser(user),
    };
}

module.exports = {
    buildAuthResponse,
    toSafeUser,
};
