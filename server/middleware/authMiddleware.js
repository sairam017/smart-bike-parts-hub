const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
    const authHeader = req.header('Authorization');
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ msg: 'No token, authorization denied' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // Support legacy nested payload and new flat payload
        const user = decoded.user || {
            id: decoded.id,
            role: decoded.role,
            email: decoded.email,
            name: decoded.name,
        };
        if (!user || !user.id || !user.role) {
            return res.status(401).json({ msg: 'Token payload invalid' });
        }
        req.user = user;
        next();
    } catch (err) {
        res.status(401).json({ msg: 'Token is not valid' });
    }
};
