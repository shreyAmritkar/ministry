// ============================================
// middleware/authorize.js
// ============================================
exports.authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return next(
                new ApiError(
                    `User role '${req.user.role}' is not authorized to access this route`,
                    403
                )
            );
        }
        next();
    };
};

exports.authorizeOfficialOrAdmin = (req, res, next) => {
    if (req.user.userType !== 'official' && req.user.role !== 'admin') {
        return next(
            new ApiError('Only officials or admins can access this route', 403)
        );
    }
    next();
};