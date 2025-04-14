/**
 * Team Validation Schemas
 * Defines validation rules for team-related operations
 */

const Joi = require("joi");
const { objectId } = require("../../../utils/validation");

// Create team schema
exports.createTeam = {
  body: Joi.object({
    name: Joi.string().min(2).max(50).required().messages({
      "string.empty": "Team name is required",
      "string.min": "Team name must be at least {#limit} characters",
      "string.max": "Team name cannot exceed {#limit} characters",
      "any.required": "Team name is required",
    }),
    description: Joi.string().max(500).allow("").messages({
      "string.max": "Description cannot exceed {#limit} characters",
    }),
    teamType: Joi.string()
      .valid("technical", "support")
      .default("support")
      .messages({
        "string.base": "Team type must be a string",
        "any.only": "Team type must be either 'technical' or 'support'",
      }),
  }),
};

// Update team schema
exports.updateTeam = {
  params: Joi.object({
    id: Joi.string().custom(objectId).required(),
  }),
  body: Joi.object({
    name: Joi.string().min(2).max(50).messages({
      "string.empty": "Team name cannot be empty",
      "string.min": "Team name must be at least {#limit} characters",
      "string.max": "Team name cannot exceed {#limit} characters",
    }),
    description: Joi.string().max(500).allow("").messages({
      "string.max": "Description cannot exceed {#limit} characters",
    }),
    teamType: Joi.string().valid("technical", "support").messages({
      "string.base": "Team type must be a string",
      "any.only": "Team type must be either 'technical' or 'support'",
    }),
  }).min(1),
};

// Add team member schema
exports.addTeamMember = {
  params: Joi.object({
    id: Joi.string().custom(objectId).required(),
  }),
  body: Joi.object({
    userId: Joi.string().custom(objectId).required().messages({
      "any.required": "User ID is required",
    }),
    role: Joi.string().valid("lead", "member").default("member"),
  }),
};

// Remove team member schema
exports.removeTeamMember = {
  params: Joi.object({
    id: Joi.string().custom(objectId).required(),
    memberId: Joi.string().custom(objectId).required(),
  }),
};

// Change team lead schema
exports.changeTeamLead = {
  params: Joi.object({
    id: Joi.string().custom(objectId).required(),
  }),
  body: Joi.object({
    newLeadId: Joi.string().custom(objectId).required().messages({
      "any.required": "New lead ID is required",
    }),
  }),
};
