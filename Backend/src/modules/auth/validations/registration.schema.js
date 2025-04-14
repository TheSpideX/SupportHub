/**
 * Registration Validation Schemas
 */

const Joi = require("joi");

// Base registration schema with common fields
const baseRegistrationSchema = {
  email: Joi.string().email().trim().lowercase().required().messages({
    "string.email": "Please enter a valid email address",
    "any.required": "Email is required",
  }),
  password: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
    .required()
    .messages({
      "string.min": "Password must be at least 8 characters",
      "string.pattern.base":
        "Password must contain uppercase, lowercase, number, and special character",
      "any.required": "Password is required",
    }),
  firstName: Joi.string().min(2).max(30).required().messages({
    "string.min": "First name must be at least 2 characters",
    "string.max": "First name cannot exceed 30 characters",
    "any.required": "First name is required",
  }),
  lastName: Joi.string().min(2).max(30).required().messages({
    "string.min": "Last name must be at least 2 characters",
    "string.max": "Last name cannot exceed 30 characters",
    "any.required": "Last name is required",
  }),
  type: Joi.string()
    .valid("customer", "organization", "organization_member")
    .required()
    .messages({
      "any.only":
        "Type must be one of: customer, organization, organization_member",
      "any.required": "Type is required",
    }),
  timezone: Joi.string().default("UTC"),
  deviceInfo: Joi.object({
    userAgent: Joi.string().optional(),
    fingerprint: Joi.string().optional(),
    ip: Joi.string().optional(),
  }).optional(),
};

// Customer registration schema
const customerRegistrationSchema = Joi.object({
  ...baseRegistrationSchema,
  orgId: Joi.string().required().messages({
    "any.required": "Organization ID is required for customer registration",
  }),
});

// Organization registration schema
const organizationRegistrationSchema = Joi.object({
  ...baseRegistrationSchema,
  organizationName: Joi.string().min(2).max(100).required().messages({
    "string.min": "Organization name must be at least 2 characters",
    "string.max": "Organization name cannot exceed 100 characters",
    "any.required": "Organization name is required",
  }),
  organizationType: Joi.string()
    .valid("business", "educational", "nonprofit", "government", "other")
    .default("business")
    .messages({
      "any.only":
        "Organization type must be one of: business, educational, nonprofit, government, other",
    }),
});

// Organization member registration schema
const organizationMemberRegistrationSchema = Joi.object({
  ...baseRegistrationSchema,
  inviteCode: Joi.string().required().messages({
    "any.required": "Invitation code is required",
  }),
});

// Combined schema that validates based on type
const registrationSchema = Joi.alternatives().conditional("type", {
  switch: [
    {
      is: "customer",
      then: customerRegistrationSchema,
    },
    {
      is: "organization",
      then: organizationRegistrationSchema,
    },
    {
      is: "organization_member",
      then: organizationMemberRegistrationSchema,
    },
  ],
  otherwise: Joi.object(baseRegistrationSchema),
});

module.exports = {
  registrationSchema,
  customerRegistrationSchema,
  organizationRegistrationSchema,
  organizationMemberRegistrationSchema,
};
