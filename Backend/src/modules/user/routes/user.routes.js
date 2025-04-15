/**
 * User Routes
 * Handles routing for user management
 */

const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.controller");
const { authenticateToken } = require("../../auth/middleware/authenticate");
const { validateToken: csrfProtection } = require("../../auth/middleware/csrf");
const { apiRateLimit } = require("../../auth/middleware/rate-limit");
const { asyncHandler } = require("../../../utils/errorHandlers");
const validate = require("../../../middleware/validate");
const userValidation = require("../validations/user.validation");

// Apply middleware to all routes
router.use(authenticateToken);
router.use(apiRateLimit());

// User CRUD operations
router.get("/", asyncHandler(userController.getAllUsers));
router.get("/:id", asyncHandler(userController.getUserById));
router.post(
  "/",
  csrfProtection,
  validate(userValidation.createUser),
  asyncHandler(userController.createUser)
);
router.put(
  "/:id",
  csrfProtection,
  validate(userValidation.updateUser),
  asyncHandler(userController.updateUser)
);
router.delete(
  "/:id",
  csrfProtection,
  asyncHandler(userController.deleteUser)
);

// Additional user operations
router.post(
  "/by-ids",
  csrfProtection,
  validate(userValidation.getUsersByIds),
  asyncHandler(userController.getUsersByIds)
);
router.patch(
  "/:id/status",
  csrfProtection,
  validate(userValidation.changeUserStatus),
  asyncHandler(userController.changeUserStatus)
);
router.post(
  "/:id/reset-password",
  csrfProtection,
  validate(userValidation.resetUserPassword),
  asyncHandler(userController.resetUserPassword)
);

module.exports = router;
