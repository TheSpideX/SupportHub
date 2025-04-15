/**
 * User Validation Schemas
 * Validates user management requests
 */

const Joi = require("joi");

// Create user validation schema
exports.createUser = {
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
    role: Joi.string()
      .valid("admin", "team_lead", "technical", "support", "customer")
      .required()
      .messages({
        "any.only": "Role must be one of: admin, team_lead, technical, support, customer",
        "any.required": "Role is required",
      }),
    status: Joi.string()
      .valid("active", "inactive", "pending")
      .default("active")
      .messages({
        "any.only": "Status must be one of: active, inactive, pending",
      }),
  }),
};

// Update user validation schema
exports.updateUser = {
  params: Joi.object({
    id: Joi.string().required().messages({
      "any.required": "User ID is required",
    }),
  }),
  body: Joi.object({
    email: Joi.string().email().messages({
      "string.email": "Please provide a valid email address",
    }),
    firstName: Joi.string(),
    lastName: Joi.string(),
    role: Joi.string()
      .valid("admin", "team_lead", "technical", "support", "customer")
      .messages({
        "any.only": "Role must be one of: admin, team_lead, technical, support, customer",
      }),
    status: Joi.string()
      .valid("active", "inactive", "pending")
      .messages({
        "any.only": "Status must be one of: active, inactive, pending",
      }),
    profile: Joi.object({
      firstName: Joi.string(),
      lastName: Joi.string(),
      phone: Joi.string(),
      avatar: Joi.string(),
    }),
  }),
};

// Get users by IDs validation schema
exports.getUsersByIds = {
  body: Joi.object({
    userIds: Joi.array().items(Joi.string()).min(1).required().messages({
      "array.min": "At least one user ID is required",
      "any.required": "User IDs are required",
    }),
  }),
};

// Change user status validation schema
exports.changeUserStatus = {
  params: Joi.object({
    id: Joi.string().required().messages({
      "any.required": "User ID is required",
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

// Reset user password validation schema
exports.resetUserPassword = {
  params: Joi.object({
    id: Joi.string().required().messages({
      "any.required": "User ID is required",
    }),
  }),
  body: Joi.object({
    newPassword: Joi.string()
      .min(8)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
      .required()
      .messages({
        "string.min": "Password must be at least 8 characters long",
        "string.pattern.base":
          "Password must contain uppercase, lowercase, number, and special character",
        "any.required": "New password is required",
      }),
  }),
};
