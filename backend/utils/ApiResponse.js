// ============================================
// utils/ApiResponse.js
// ============================================
class ApiResponse {
    static success(res, data, message = 'Success', statusCode = 200) {
        return res.status(statusCode).json({
            status: 'success',
            message,
            data
        });
    }

    static error(res, message = 'Error', statusCode = 500, errors = null) {
        return res.status(statusCode).json({
            status: 'error',
            message,
            ...(errors && { errors })
        });
    }

    static paginated(res, data, pagination, message = 'Success') {
        return res.status(200).json({
            status: 'success',
            message,
            data,
            pagination
        });
    }
}

module.exports = ApiResponse;