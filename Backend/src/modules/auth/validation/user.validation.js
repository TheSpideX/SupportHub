const Joi = require('joi');

// Schema for updating user profile
const updateProfile = Joi.object({
  name: Joi.string().min(2).max(50),
  email: Joi.string().email(),
  phone: Joi.string().pattern(/^[0-9+\-\s()]{7,20}$/).allow(''),
}).min(1);

// Schema for changing password
const changePassword = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string()
    .min(8)
    .max(30)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .required()
    .messages({
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
    }),
  confirmPassword: Joi.string()
    .valid(Joi.ref('newPassword'))
    .required()
    .messages({
      'any.only': 'Passwords do not match',
    }),
});

// Schema for updating user preferences
const updatePreferences = Joi.object({
  preferences: Joi.object({
    theme: Joi.string().valid('light', 'dark', 'system').default('system'),
    notifications: Joi.object({
      email: Joi.boolean().default(true),
      push: Joi.boolean().default(true),
      sms: Joi.boolean().default(false),
    }),
    language: Joi.string().valid('en', 'es', 'fr', 'de').default('en'),
    timezone: Joi.string(),
    dateFormat: Joi.string().valid('MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD').default('MM/DD/YYYY'),
    timeFormat: Joi.string().valid('12h', '24h').default('12h'),
  }).required(),
});

module.exports = {
  updateProfile,
  changePassword,
  updatePreferences,
};