const Joi = require("joi");

const deviceInfoSchema = Joi.object({
  userAgent: Joi.string().required(),
  fingerprint: Joi.string().required(),
  screenResolution: Joi.string().optional(),
  timezone: Joi.string().optional(),
  location: Joi.object({
    country: Joi.string().optional(),
    city: Joi.string().optional(),
    ip: Joi.string().optional(),
  })
    .optional()
    .default({}),
}).required();

// Updated to match frontend schema structure
const securityContextSchema = Joi.object({
  deviceInfo: Joi.object({
    userAgent: Joi.string().optional(),
    fingerprint: Joi.string().optional(),
    location: Joi.object({
      country: Joi.string().optional(),
      city: Joi.string().optional(),
      ip: Joi.string().optional(),
    })
      .optional()
      .default({}),
  })
    .optional()
    .default({}),
  captchaToken: Joi.string().optional(),
})
  .optional()
  .default({});

const loginSchema = Joi.object({
  email: Joi.string().email().trim().lowercase().required().messages({
    "string.email": "Please enter a valid email address",
    "any.required": "Email is required",
  }),
  password: Joi.string().required().messages({
    "any.required": "Password is required",
  }),
  rememberMe: Joi.boolean().default(false),
  securityContext: securityContextSchema,
}).required();

const twoFactorVerifySchema = Joi.object({
  twoFactorToken: Joi.string().required(),
  code: Joi.string()
    .required()
    .pattern(/^\d{6}$/),
  trustDevice: Joi.boolean().default(false),
}).required();

const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required(),
}).required();

const logoutSchema = Joi.object({
  refreshToken: Joi.string().optional(),
}).required();

const deviceTrustSchema = Joi.object({
  deviceFingerprint: Joi.string().required(),
}).required();

// Registration schema
const registerSchema = Joi.object({
  firstName: Joi.string().required().min(2).max(50),
  lastName: Joi.string().required().min(2).max(50),
  email: Joi.string().email().required().trim().lowercase(),
  password: Joi.string()
    .required()
    .min(8)
    .pattern(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/
    )
    .message(
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
    ),
  type: Joi.string()
    .valid("customer", "organization", "organization_member")
    .required(),
  timezone: Joi.string().optional(),
  // Organization fields
  organizationName: Joi.string().when("type", {
    is: "organization",
    then: Joi.string().required().min(2).max(100),
    otherwise: Joi.string().optional(),
  }),
  organizationType: Joi.string().when("type", {
    is: "organization",
    then: Joi.string()
      .valid("business", "educational", "nonprofit", "government", "other")
      .required(),
    otherwise: Joi.string().optional(),
  }),
  // Organization member fields
  inviteCode: Joi.string().when("type", {
    is: "organization_member",
    then: Joi.string().required().min(6),
    otherwise: Joi.string().optional(),
  }),
  // Customer fields
  orgId: Joi.string().when("type", {
    is: "customer",
    then: Joi.string()
      .required()
      .pattern(/^ORG-[A-Z0-9]{5}$/),
    otherwise: Joi.string().optional(),
  }),
  // Device info
  deviceInfo: Joi.object({
    userAgent: Joi.string().optional(),
    fingerprint: Joi.string().optional(),
    deviceId: Joi.string().optional(),
    tabId: Joi.string().optional(),
  }).optional(),
}).required();

module.exports = {
  login: loginSchema,
  twoFactorVerify: twoFactorVerifySchema,
  refreshToken: refreshTokenSchema,
  logout: logoutSchema,
  deviceTrust: deviceTrustSchema,
  register: registerSchema,
};
