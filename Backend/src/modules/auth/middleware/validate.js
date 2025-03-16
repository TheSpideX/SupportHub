const { AuthError } = require('../errors');

const validate = (schema) => {
    return (req, res, next) => {
        try {
            // Debug logging
            console.log('Incoming request body:', JSON.stringify(req.body, null, 2));
            console.log('Schema being used:', schema?.describe?.());

            if (!schema) {
                console.error('Schema is undefined');
                return res.status(500).json({
                    error: 'VALIDATION_ERROR',
                    message: 'Schema configuration error'
                });
            }

            const { error, value } = schema.validate(req.body, {
                abortEarly: false,
                stripUnknown: true
            });

            if (error) {
                console.error('Validation error:', error.details);
                return res.status(400).json({
                    error: 'VALIDATION_ERROR',
                    details: error.details.map(err => ({
                        field: err.path.join('.'),
                        message: err.message
                    }))
                });
            }

            req.body = value;
            next();
        } catch (err) {
            console.error('Unexpected validation error:', err);
            return res.status(500).json({
                error: 'SERVER_ERROR',
                message: 'An unexpected error occurred during validation'
            });
        }
    };
};

module.exports = validate;
