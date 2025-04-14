/**
 * Invitation Code Validation Schemas
 * Defines validation rules for invitation code operations
 */

const Joi = require("joi");
const { objectId } = require("../../../utils/validation");

// Generate invitation code schema
exports.generateInvitationCode = {
  params: Joi.object({
    teamId: Joi.string().custom(objectId).required(),
  }),
  body: Joi.object({
    role: Joi.string().valid("lead", "member").required().messages({
      "string.empty": "Role is required",
      "any.only": "Role must be either 'lead' or 'member'",
      "any.required": "Role is required",
    }),
  }),
};

// List invitation codes schema
exports.listInvitationCodes = {
  params: Joi.object({
    teamId: Joi.string().custom(objectId).required(),
  }),
};

// Revoke invitation code schema
exports.revokeInvitationCode = {
  params: Joi.object({
    teamId: Joi.string().custom(objectId).required(),
    codeId: Joi.string().custom(objectId).required(),
  }),
};

// Validate invitation code schema
exports.validateInvitationCode = {
  params: Joi.object({
    code: Joi.string().required().messages({
      "string.empty": "Invitation code is required",
      "any.required": "Invitation code is required",
    }),
  }),
};
