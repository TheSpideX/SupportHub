const mongoose = require("mongoose");
const { redisClient } = require("./src/config/redis");
const authService = require("./src/modules/auth/services/auth.service");

async function testLogin() {
  try {
    console.log("Testing login...");

    // Test login with test credentials
    const loginResult = await authService.login(
      "test@example.com",
      "Test123!",
      {
        ipAddress: "127.0.0.1",
        userAgent: "Test Script",
        deviceInfo: {
          browser: "Test Browser",
          os: "Test OS",
          device: "Test Device",
          fingerprint: "test-fingerprint-123",
        },
      }
    );

    console.log("Login result:", loginResult);
    console.log("All tests passed!");
  } catch (error) {
    console.error("Test failed:", error);
  } finally {
    // Clean up
    mongoose.connection.close();
    process.exit(0);
  }
}

// Connect to MongoDB
mongoose
  .connect("mongodb://localhost:27017/tech-support-crm")
  .then(() => {
    console.log("Connected to MongoDB");
    testLogin();
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });
