/**
 * Customer Validation Schemas
 * Validates customer management requests
 */

const Joi = require("joi");

// Create customer validation schema
exports.createCustomer = {
  body: Joi.object({
    email: Joi.string().email().required().messages({
      "string.email": "Please provide a valid email address",
      "any.required": "Email is required",
    }),
    password: Joi.string()
      .min(8)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
      .required()
      .messages({
        "string.min": "Password must be at least 8 characters long",
        "string.pattern.base":
          "Password must contain uppercase, lowercase, number, and special character",
        "any.required": "Password is required",
      }),
    firstName: Joi.string().required().messages({
      "any.required": "First name is required",
    }),
    lastName: Joi.string().required().messages({
      "any.required": "Last name is required",
    }),
    company: Joi.string().allow("", null),
    phone: Joi.string().allow("", null),
    status: Joi.string()
      .valid("active", "inactive", "pending")
      .default("active")
      .messages({
        "any.only": "Status must be one of: active, inactive, pending",
      }),
  }),
};

// Update customer validation schema
exports.updateCustomer = {
  params: Joi.object({
    id: Joi.string().required().messages({
      "any.required": "Customer ID is required",
    }),
  }),
  body: Joi.object({
    email: Joi.string().email().messages({
      "string.email": "Please provide a valid email address",
    }),
    firstName: Joi.string(),
    lastName: Joi.string(),
    company: Joi.string().allow("", null),
    phone: Joi.string().allow("", null),
    status: Joi.string()
      .valid("active", "inactive", "pending")
      .messages({
        "any.only": "Status must be one of: active, inactive, pending",
      }),
    profile: Joi.object({
      firstName: Joi.string(),
      lastName: Joi.string(),
      company: Joi.string().allow("", null),
      phone: Joi.string().allow("", null),
      avatar: Joi.string().allow("", null),
    }),
  }),
};

// Change customer status validation schema
exports.changeCustomerStatus = {
  params: Joi.object({
    id: Joi.string().required().messages({
      "any.required": "Customer ID is required",
    }),
  }),
  body: Joi.object({
    status: Joi.string()
      .valid("active", "inactive", "pending")
      .required()
      .messages({
        "any.only": "Status must be one of: active, inactive, pending",
        "any.required": "Status is required",
      }),
  }),
};
