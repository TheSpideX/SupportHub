const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const config = require("./config");
const logger = require("./utils/logger");

const app = express();

// Middleware
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
    exposedHeaders: ["Content-Length", "X-CSRF-Token"],
  })
);

// Body parsers
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

// Request tracking for metrics
const requestTracker = require("./middleware/requestTracker");
app.use(requestTracker);

// Import routes
const authRoutes = require("./modules/auth/routes/auth.routes");
const teamRoutes = require("./modules/team/routes/team.routes");
const userRoutes = require("./modules/user/routes/user.routes");
const teamAnalyticsRoutes = require("./modules/team/routes/team-analytics.routes");
const inviteCodeRoutes = require("./modules/organization/routes/inviteCode.routes");
const systemRoutes = require("./modules/system/routes/system.routes");
const ticketRoutes = require("./modules/ticket/routes/ticket.routes");
const slaRoutes = require("./modules/ticket/routes/sla.routes");
const reportRoutes = require("./modules/ticket/routes/report.routes");
const notificationRoutes = require("./modules/notification/routes/notification.routes");

// Use routes
app.use("/api/auth", authRoutes);
app.use("/api/teams", teamRoutes);
app.use("/api/users", userRoutes);
app.use("/api/team-analytics", teamAnalyticsRoutes);
app.use("/api/invite-codes", inviteCodeRoutes);
app.use("/api/system", systemRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/sla", slaRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/notifications", notificationRoutes);

// Error handling middleware
const {
  notFoundHandler,
  errorHandler,
} = require("./middleware/errorMiddleware");

// Register error handlers after all routes
app.use(notFoundHandler);
app.use(errorHandler);

// Connect to MongoDB
mongoose
  .connect(config.mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Initialize scheduled jobs
const slaCheckJob = require("./jobs/sla-check.job");

// Start server
const PORT = process.env.PORT || 4290;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  // Schedule SLA check job after server starts
  try {
    slaCheckJob.scheduleJob();
    logger.info("SLA check job scheduled successfully");
  } catch (error) {
    logger.error("Failed to schedule SLA check job:", error);
  }
});

module.exports = { app, server };
