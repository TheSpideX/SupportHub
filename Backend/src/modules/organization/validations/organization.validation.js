/**
 * Organization Validation Schemas
 */

const Joi = require("joi");

// Create organization schema
const createOrganization = Joi.object({
  name: Joi.string().min(2).max(100).required().messages({
    "string.min": "Organization name must be at least 2 characters",
    "string.max": "Organization name cannot exceed 100 characters",
    "any.required": "Organization name is required",
  }),
  description: Joi.string().max(500).messages({
    "string.max": "Description cannot exceed 500 characters",
  }),
  type: Joi.string()
    .valid("business", "educational", "nonprofit", "government", "other")
    .messages({
      "any.only":
        "Organization type must be one of: business, educational, nonprofit, government, other",
    }),
});

// Update organization schema
const updateOrganization = Joi.object({
  name: Joi.string().min(2).max(100).messages({
    "string.min": "Organization name must be at least 2 characters",
    "string.max": "Organization name cannot exceed 100 characters",
  }),
  description: Joi.string().max(500).messages({
    "string.max": "Description cannot exceed 500 characters",
  }),
  status: Joi.string().valid("active", "inactive", "suspended").messages({
    "any.only": "Status must be one of: active, inactive, suspended",
  }),
  type: Joi.string()
    .valid("business", "educational", "nonprofit", "government", "other")
    .messages({
      "any.only":
        "Organization type must be one of: business, educational, nonprofit, government, other",
    }),
  settings: Joi.object({
    theme: Joi.string(),
    features: Joi.object(),
  }),
}).min(1);

// Add team to organization schema
const addTeamToOrganization = Joi.object({
  teamId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/) // MongoDB ObjectId pattern
    .required()
    .messages({
      "string.pattern.base": "Team ID must be a valid MongoDB ObjectId",
      "any.required": "Team ID is required",
    }),
});

// Add customer to organization schema
const addCustomerToOrganization = Joi.object({
  customerId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/) // MongoDB ObjectId pattern
    .required()
    .messages({
      "string.pattern.base": "Customer ID must be a valid MongoDB ObjectId",
      "any.required": "Customer ID is required",
    }),
});

module.exports = {
  createOrganization,
  updateOrganization,
  addTeamToOrganization,
  addCustomerToOrganization,
};
