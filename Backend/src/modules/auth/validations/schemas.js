const Joi = require('joi');

const deviceInfoSchema = Joi.object({
    userAgent: Joi.string().required(),
    fingerprint: Joi.string().required(),
    screenResolution: Joi.string().optional(),
    timezone: Joi.string().optional(),
    location: Joi.object({
        country: Joi.string().optional(),
        city: Joi.string().optional(),
        ip: Joi.string().optional()
    }).optional().default({})
}).required();

// Updated to match frontend schema structure
const securityContextSchema = Joi.object({
    deviceInfo: Joi.object({
        userAgent: Joi.string().optional(),
        fingerprint: Joi.string().optional(),
        location: Joi.object({
            country: Joi.string().optional(),
            city: Joi.string().optional(),
            ip: Joi.string().optional()
        }).optional().default({})
    }).optional().default({}),
    captchaToken: Joi.string().optional()
}).optional().default({});

const loginSchema = Joi.object({
    email: Joi.string()
        .email()
        .trim()
        .lowercase()
        .required()
        .messages({
            'string.email': 'Please enter a valid email address',
            'any.required': 'Email is required'
        }),
    password: Joi.string()
        .required()
        .messages({
            'any.required': 'Password is required'
        }),
    rememberMe: Joi.boolean().default(false),
    securityContext: securityContextSchema
}).required();

const twoFactorVerifySchema = Joi.object({
    twoFactorToken: Joi.string().required(),
    code: Joi.string().required().pattern(/^\d{6}$/),
    trustDevice: Joi.boolean().default(false)
}).required();

const refreshTokenSchema = Joi.object({
    refreshToken: Joi.string().required()
}).required();

const logoutSchema = Joi.object({
    refreshToken: Joi.string().optional()
}).required();

const deviceTrustSchema = Joi.object({
    deviceFingerprint: Joi.string().required()
}).required();

module.exports = {
    login: loginSchema,
    twoFactorVerify: twoFactorVerifySchema,
    refreshToken: refreshTokenSchema,
    logout: logoutSchema,
    deviceTrust: deviceTrustSchema
};
