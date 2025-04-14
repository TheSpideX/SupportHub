const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");
const config = require("./config/config");

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Import routes
const authRoutes = require("./routes/authRoutes");
const teamRoutes = require("./routes/teamRoutes");
const userRoutes = require("./routes/userRoutes");
const teamAnalyticsRoutes = require("./routes/teamAnalyticsRoutes");

// Use routes
app.use("/api/auth", authRoutes);
app.use("/api/teams", teamRoutes);
app.use("/api", userRoutes);
app.use("/api", teamAnalyticsRoutes);

// Connect to MongoDB
mongoose
  .connect(config.mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Start server
const PORT = process.env.PORT || 4290;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;
