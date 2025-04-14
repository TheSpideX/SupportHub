/**
 * Invitation Validation Schemas
 * Defines validation rules for invitation-related operations
 */

const Joi = require("joi");
const { objectId } = require("../../../utils/validation");

// Create invitation schema
exports.createInvitation = {
  params: Joi.object({
    teamId: Joi.string().custom(objectId).required(),
  }),
  body: Joi.object({
    email: Joi.string().email().required().messages({
      "string.email": "Please provide a valid email address",
      "any.required": "Email is required",
    }),
    role: Joi.string().valid("lead", "member").default("member"),
  }),
};

// Verify invitation schema
exports.verifyInvitation = {
  params: Joi.object({
    code: Joi.string().required().messages({
      "any.required": "Invitation code is required",
    }),
  }),
};

// Accept invitation schema
exports.acceptInvitation = {
  params: Joi.object({
    code: Joi.string().required().messages({
      "any.required": "Invitation code is required",
    }),
  }),
};

// Revoke invitation schema
exports.revokeInvitation = {
  params: Joi.object({
    id: Joi.string().custom(objectId).required(),
  }),
};

// Resend invitation schema
exports.resendInvitation = {
  params: Joi.object({
    id: Joi.string().custom(objectId).required(),
  }),
};
