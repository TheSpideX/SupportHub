/**
 * Auth Routes Index
 *
 * This file serves as the entry point for all authentication-related routes.
 * It organizes and exports routes for authentication, token management,
 * session handling, security, and user management.
 */

const express = require("express");
const authRoutes = require("./auth.routes");
const tokenRoutes = require("./token.routes");
const sessionRoutes = require("./session.routes");
const securityRoutes = require("./security.routes");
const userRoutes = require("./user.routes");
const tabClosingRoute = require("./tab-closing.route");

const router = express.Router();

// Auth routes (login, logout, register)
router.use("/", authRoutes);

// Token routes (refresh, validate, revoke)
router.use("/token", tokenRoutes);

// Session routes (validate, list, terminate)
router.use("/session", sessionRoutes);

// Security routes (events, settings)
router.use("/security", securityRoutes);

// User routes (profile, password)
router.use("/user", userRoutes);

// Tab closing route (beacon endpoint)
router.use("/", tabClosingRoute);

// OPTIONS handler for CORS preflight requests
router.options("*", (req, res) => {
  res.header("Allow", "GET, POST, PUT, DELETE, OPTIONS");
  res.status(200).send();
});

module.exports = router;
