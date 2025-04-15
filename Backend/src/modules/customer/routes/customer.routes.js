/**
 * Customer Routes
 * Handles routing for customer management
 */

const express = require("express");
const router = express.Router();
const customerController = require("../controllers/customer.controller");
const { authenticateToken } = require("../../auth/middleware/authenticate");
const { validateToken: csrfProtection } = require("../../auth/middleware/csrf");
const { apiRateLimit } = require("../../auth/middleware/rate-limit");
const { asyncHandler } = require("../../../utils/errorHandlers");
const validate = require("../../../middleware/validate");
const customerValidation = require("../validations/customer.validation");

// Apply middleware to all routes
router.use(authenticateToken);
router.use(apiRateLimit());

// Customer CRUD operations
router.get("/", asyncHandler(customerController.getAllCustomers));
router.get("/:id", asyncHandler(customerController.getCustomerById));
router.post(
  "/",
  csrfProtection,
  validate(customerValidation.createCustomer),
  asyncHandler(customerController.createCustomer)
);
router.put(
  "/:id",
  csrfProtection,
  validate(customerValidation.updateCustomer),
  asyncHandler(customerController.updateCustomer)
);
router.delete(
  "/:id",
  csrfProtection,
  asyncHandler(customerController.deleteCustomer)
);

// Additional customer operations
router.patch(
  "/:id/status",
  csrfProtection,
  validate(customerValidation.changeCustomerStatus),
  asyncHandler(customerController.changeCustomerStatus)
);

module.exports = router;
