const Auth = require('../models/authModel');
const { verifyAuthToken } = require('../utils/token');

const protect = async (req, res, next) => {
    try {
        const authorization = req.headers.authorization || '';
        const [scheme, token] = authorization.split(' ');

        if (scheme !== 'Bearer' || !token) {
            return res.status(401).json({
                message: 'Authentication token is required.',
            });
        }

        const payload = verifyAuthToken(token);
        const user = await Auth.findById(payload.id).select('-password');

        if (!user) {
            return res.status(401).json({
                message: 'Authenticated user was not found.',
            });
        }

        req.user = user;
        return next();
    } catch (error) {
        return res.status(401).json({
            message: 'Invalid or expired authentication token.',
        });
    }
};

module.exports = {
    protect,
};
