/**
 * Organization Routes
 */

const express = require("express");
const router = express.Router();
const organizationController = require("../controllers/organization.controller");
const { authenticateToken } = require("../../auth/middleware/authenticate");
const { validateToken: csrfProtection } = require("../../auth/middleware/csrf");
const { apiRateLimit } = require("../../auth/middleware/rate-limit");
const { asyncHandler } = require("../../../utils/errorHandlers");
const validate = require("../../../middleware/validate");
const organizationValidation = require("../validations/organization.validation");

// Public routes
router.get(
  "/validate/:orgId",
  apiRateLimit(),
  asyncHandler(organizationController.validateOrgId)
);

router.get(
  "/org/:orgId",
  apiRateLimit(),
  asyncHandler(organizationController.getOrganizationByOrgId)
);

// Protected routes
router.use(authenticateToken);
router.use(apiRateLimit());

// Organization CRUD operations
router.post(
  "/",
  csrfProtection,
  validate(organizationValidation.createOrganization),
  asyncHandler(organizationController.createOrganization)
);

router.get("/", asyncHandler(organizationController.getAllOrganizations));

router.get("/:id", asyncHandler(organizationController.getOrganizationById));

router.put(
  "/:id",
  csrfProtection,
  validate(organizationValidation.updateOrganization),
  asyncHandler(organizationController.updateOrganization)
);

// Team and customer management
router.post(
  "/:id/teams",
  csrfProtection,
  validate(organizationValidation.addTeamToOrganization),
  asyncHandler(organizationController.addTeamToOrganization)
);

router.post(
  "/:id/customers",
  csrfProtection,
  validate(organizationValidation.addCustomerToOrganization),
  asyncHandler(organizationController.addCustomerToOrganization)
);

module.exports = router;
