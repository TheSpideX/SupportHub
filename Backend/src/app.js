const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");
const config = require("./config");
const logger = require("./utils/logger");

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Request tracking for metrics
const requestTracker = require("./middleware/requestTracker");
app.use(requestTracker);

// Import routes
const authRoutes = require("./routes/authRoutes");
const teamRoutes = require("./routes/teamRoutes");
const userRoutes = require("./routes/userRoutes");
const teamAnalyticsRoutes = require("./routes/teamAnalyticsRoutes");
const inviteCodeRoutes = require("./modules/organization/routes/inviteCode.routes");
const systemRoutes = require("./modules/system/routes/system.routes");
const ticketRoutes = require("./modules/ticket/routes/ticket.routes");
const slaRoutes = require("./modules/ticket/routes/sla.routes");

// Use routes
app.use("/api/auth", authRoutes);
app.use("/api/teams", teamRoutes);
app.use("/api", userRoutes);
app.use("/api", teamAnalyticsRoutes);
app.use("/api/invite-codes", inviteCodeRoutes);
app.use("/api/system", systemRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/sla", slaRoutes);

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
