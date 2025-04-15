const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const moment = require("moment-timezone");

// Custom validators
const validators = {
  password: {
    validator: (password) =>
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(
        password
      ),
    message:
      "Password must contain uppercase, lowercase, number, and special character",
  },
  phone: {
    validator: (v) => /^\+?[\d\s-]{10,}$/.test(v),
    message: "Please enter a valid phone number",
  },
  email: {
    validator: (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
    message: "Please enter a valid email",
  },
};

// Reusable schema options
const requiredString = {
  type: String,
  required: true,
  trim: true,
};

// Add tokenVersion for refresh token management
const UserSchema = new mongoose.Schema(
  {
    profile: {
      firstName: {
        ...requiredString,
        minlength: [2, "First name must be at least 2 characters"],
        maxlength: [30, "First name cannot exceed 30 characters"],
      },
      lastName: {
        ...requiredString,
        minlength: [2, "Last name must be at least 2 characters"],
        maxlength: [30, "Last name cannot exceed 30 characters"],
      },
      avatar: String,
      phoneNumber: {
        type: String,
        validate: validators.phone,
      },
      timezone: {
        type: String,
        default: "UTC",
        enum: {
          values: moment.tz.names(),
          message: "Invalid timezone",
        },
      },
    },
    email: {
      ...requiredString,
      unique: true,
      lowercase: true,
      validate: validators.email,
    },
    security: {
      password: {
        type: String,
        required: true,
        select: false, // This makes it not returned by default
        minlength: [8, "Password must be at least 8 characters"],
        // Remove the validation here since we're validating the raw password in the registration service
        // The hashed password won't match the format requirements
      },
      passwordChangedAt: Date,
      tokenVersion: {
        type: Number,
        default: 0,
      },
      loginAttempts: {
        type: Number,
        default: 0,
        min: 0,
      },
      lockUntil: {
        type: Date,
      },
      activeSessions: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Session",
        },
      ],
      deviceHierarchy: {
        type: Map,
        of: {
          deviceId: String,
          sessions: [String],
          lastActive: Date,
          isVerified: Boolean,
        },
      },
      tokenVersion: {
        type: Number,
        default: 0,
      },
    },
    role: {
      type: String,
      enum: {
        values: ["customer", "support", "technical", "team_lead", "admin"],
        message: "{VALUE} is not a valid role",
      },
      default: "customer",
    },
    // Organization relationship
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      index: true,
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      index: true,
    },
    status: {
      isActive: {
        type: Boolean,
        default: true,
      },
      lastActive: Date,
      deactivatedAt: Date,
      deactivationReason: String,
    },
    preferences: {
      notifications: {
        email: {
          type: Boolean,
          default: true,
        },
        push: {
          type: Boolean,
          default: true,
        },
        inApp: {
          type: Boolean,
          default: true,
        },
        doNotDisturb: {
          enabled: Boolean,
          startTime: String,
          endTime: String,
        },
      },
      theme: {
        type: String,
        enum: ["light", "dark", "system"],
        default: "system",
      },
      language: {
        type: String,
        enum: ["en", "es", "fr", "de", "pt", "zh"],
        default: "en",
      },
      ticketView: {
        type: String,
        enum: ["list", "board"],
        default: "board",
      },
    },
    metrics: {
      ticketsResolved: {
        type: Number,
        default: 0,
      },
      averageResponseTime: Number,
      customerSatisfactionScore: Number,
      lastMetricsUpdate: Date,
    },
    // WebSocket-specific fields
    activeSessions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Session",
      },
    ],
    activeDevices: [
      {
        type: String,
        ref: "Device",
      },
    ],
    tokenVersion: {
      type: Number,
      default: 0,
    },
    lastSocketActivity: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Add schema-level validation
UserSchema.pre("validate", function (next) {
  // Complex validation that requires multiple fields
  if (
    this.isModified("security.passwordHistory") &&
    this.security &&
    this.security.passwordHistory &&
    Array.isArray(this.security.passwordHistory)
  ) {
    const uniquePasswords = new Set(
      this.security.passwordHistory.map((ph) => ph.hash)
    );
    if (uniquePasswords.size !== this.security.passwordHistory.length) {
      this.invalidate(
        "security.passwordHistory",
        "Duplicate passwords are not allowed"
      );
    }
  }
  next();
});

// Virtual field for full name
UserSchema.virtual("fullName").get(function () {
  return `${this.profile.firstName} ${this.profile.lastName}`;
});

// Pre-save middleware to hash password
UserSchema.pre("save", async function (next) {
  if (!this.isModified("security.password")) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(this.security.password, salt);

    // Store password in history
    if (this.security.passwordHistory) {
      this.security.passwordHistory.push({
        hash: hashedPassword,
        changedAt: new Date(),
      });

      // Keep only last 5 passwords
      if (this.security.passwordHistory.length > 5) {
        this.security.passwordHistory.shift();
      }
    }

    this.security.password = hashedPassword;
    this.security.passwordChangedAt = Date.now() - 1000;

    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
UserSchema.methods.comparePassword = async function (candidatePassword) {
  try {
    // Debug log
    console.log("comparePassword called with:", {
      candidatePassword: !!candidatePassword,
      hasSecurityPassword: !!this.security?.password,
      passwordField: this.security?.password ? "exists" : "missing",
    });

    // If security.password field is not selected, fetch it
    let userPassword = this.security?.password;
    if (!userPassword) {
      const user = await mongoose
        .model("User")
        .findById(this._id)
        .select("+security.password");
      if (!user) {
        console.log("User not found when fetching password");
        return false;
      }
      userPassword = user.security?.password;
    }

    if (!userPassword) {
      console.log("Password field is still missing after fetch");
      return false;
    }

    // Compare passwords
    const isMatch = await bcrypt.compare(candidatePassword, userPassword);
    console.log("Password comparison result:", isMatch);
    return isMatch;
  } catch (error) {
    console.error("Error comparing passwords:", error);
    return false;
  }
};

// Method to check if password was changed after token was issued
UserSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.security.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.security.passwordChangedAt.getTime() / 1000,
      10
    );
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

// Method to generate password reset token
UserSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");

  this.security.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  this.security.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

  return resetToken;
};

// Method to check if user account is locked
UserSchema.methods.isLocked = function () {
  console.log("Checking if account is locked:", {
    hasSecurity: !!this.security,
    hasLockUntil: !!this.security?.lockUntil,
    lockUntil: this.security?.lockUntil,
    currentTime: new Date(),
  });

  // If lockUntil exists and is greater than current time, account is locked
  if (
    this.security &&
    this.security.lockUntil &&
    this.security.lockUntil > Date.now()
  ) {
    return true;
  }
  return false;
};

// Method to unlock account if lock period has expired
UserSchema.methods.checkAndUnlockAccount = async function () {
  // If account is locked but lock period has expired, unlock it
  if (
    this.security &&
    this.security.lockUntil &&
    this.security.lockUntil <= Date.now()
  ) {
    this.security.lockUntil = undefined;
    this.security.loginAttempts = 0;
    await this.save();
    return true;
  }
  return false;
};

// Method to increment login attempts
UserSchema.methods.incrementLoginAttempts = async function () {
  if (this.security.lockUntil && this.security.lockUntil < Date.now()) {
    return await this.updateOne({
      $set: { "security.loginAttempts": 1 },
      $unset: { "security.lockUntil": 1 },
    });
  }

  const updates = { $inc: { "security.loginAttempts": 1 } };

  if (this.security.loginAttempts + 1 >= 5 && !this.isLocked()) {
    updates.$set = { "security.lockUntil": Date.now() + 1 * 60 * 60 * 1000 }; // 1 hour lock
  }

  return await this.updateOne(updates);
};

// Method to reset login attempts
UserSchema.methods.resetLoginAttempts = function () {
  return this.updateOne({
    $set: { "security.loginAttempts": 0 },
    $unset: { "security.lockUntil": 1 },
  });
};

// Method to add login history
UserSchema.methods.addLoginHistory = function (loginData) {
  const loginEntry = {
    timestamp: new Date(),
    ipAddress: loginData.ip,
    userAgent: loginData.userAgent,
    location: loginData.location,
    status: loginData.status,
  };

  this.security.loginHistory.push(loginEntry);

  // Keep only last 10 login entries
  if (this.security.loginHistory.length > 10) {
    this.security.loginHistory.shift();
  }

  return this.save();
};

// NEW METHODS BASED ON REQUIREMENTS

// Find user by email (static method)
UserSchema.statics.findByEmail = async function (email) {
  return this.findOne({ email: email.toLowerCase() });
};

// Validate password (instance method)
UserSchema.methods.validatePassword = async function (password) {
  // First check if account is locked
  if (this.isLocked()) {
    return {
      isValid: false,
      reason: "ACCOUNT_LOCKED",
      message: "Account is temporarily locked due to too many failed attempts",
    };
  }

  // Get user with password field (which is normally excluded)
  const user = await mongoose
    .model("User")
    .findById(this._id)
    .select("+security.password");

  if (!user) {
    return {
      isValid: false,
      reason: "USER_NOT_FOUND",
      message: "User not found",
    };
  }

  try {
    const isMatch = await user.comparePassword(password);

    if (isMatch) {
      // Reset login attempts on successful login
      await user.resetLoginAttempts();
      return {
        isValid: true,
      };
    } else {
      // Increment login attempts on failed login
      await user.incrementLoginAttempts();
      return {
        isValid: false,
        reason: "INVALID_PASSWORD",
        message: "Invalid password",
        attemptsRemaining: Math.max(0, 5 - (user.security.loginAttempts + 1)),
      };
    }
  } catch (error) {
    return {
      isValid: false,
      reason: "VALIDATION_ERROR",
      message: "Password validation failed",
    };
  }
};

// Increment token version (for refresh token invalidation)
UserSchema.methods.incrementTokenVersion = async function () {
  this.security.tokenVersion += 1;
  return this.save();
};

// Check if user is active
UserSchema.methods.isActive = function () {
  return this.status.isActive && !this.isLocked();
};

// Add device to trusted devices
UserSchema.methods.addTrustedDevice = function (deviceInfo) {
  // Check if device already exists
  const existingDeviceIndex = this.security.trustedDevices.findIndex(
    (device) => device.fingerprint === deviceInfo.fingerprint
  );

  const deviceData = {
    fingerprint: deviceInfo.fingerprint,
    name: deviceInfo.name || `Device on ${new Date().toLocaleDateString()}`,
    userAgent: deviceInfo.userAgent,
    lastUsed: new Date(),
    ipAddress: deviceInfo.ipAddress,
    trusted: true,
  };

  if (existingDeviceIndex >= 0) {
    // Update existing device
    this.security.trustedDevices[existingDeviceIndex] = {
      ...this.security.trustedDevices[existingDeviceIndex],
      ...deviceData,
    };
  } else {
    // Add new device
    this.security.trustedDevices.push(deviceData);

    // Keep only last 5 devices instead of 10
    if (this.security.trustedDevices.length > 5) {
      this.security.trustedDevices.shift();
    }
  }

  return this.save();
};

// Remove device from trusted devices
UserSchema.methods.removeTrustedDevice = function (fingerprint) {
  this.security.trustedDevices = this.security.trustedDevices.filter(
    (device) => device.fingerprint !== fingerprint
  );
  return this.save();
};

// Check if device is trusted
UserSchema.methods.isDeviceTrusted = function (fingerprint) {
  return this.security.trustedDevices.some(
    (device) => device.fingerprint === fingerprint && device.trusted
  );
};

// Generate backup codes for 2FA
UserSchema.methods.generateBackupCodes = function () {
  const codes = [];
  for (let i = 0; i < 10; i++) {
    codes.push({
      code: crypto.randomBytes(4).toString("hex"),
      used: false,
    });
  }
  this.security.backupCodes = codes;
  return this.save();
};

// Verify backup code
UserSchema.methods.verifyBackupCode = async function (code) {
  const backupCode = this.security.backupCodes.find(
    (bc) => bc.code === code && !bc.used
  );

  if (backupCode) {
    backupCode.used = true;
    await this.save();
    return true;
  }

  return false;
};

// Check if IP is allowed
UserSchema.methods.isIpAllowed = function (ipAddress) {
  // If IP restrictions are not enabled, all IPs are allowed
  if (!this.security.ipRestrictions.enabled) {
    return true;
  }

  // Check if IP is explicitly blocked
  if (this.security.ipRestrictions.blockedIps.includes(ipAddress)) {
    return false;
  }

  // Check if IP is explicitly allowed
  if (this.security.ipRestrictions.allowedIps.includes(ipAddress)) {
    return true;
  }

  // If not in either list, use the allowUnknown setting
  return this.security.ipRestrictions.allowUnknown;
};

// Add indexes
UserSchema.index(
  { email: 1 },
  {
    unique: true,
    name: "email_unique_index",
  }
);
UserSchema.index({ role: 1 });
UserSchema.index({ "profile.firstName": 1, "profile.lastName": 1 });
UserSchema.index({ "security.lockUntil": 1 });
UserSchema.index({ "status.lastActive": 1 });
UserSchema.index({ "status.isActive": 1 });
UserSchema.index({ "security.loginAttempts": 1 });
UserSchema.index({ "security.trustedDevices.fingerprint": 1 });
UserSchema.index({ organizationId: 1 }); // Index for tenant-based queries

// Add a static method to help with debugging
UserSchema.statics.findByIdWithLogging = async function (id) {
  console.log("Looking up user by ID:", id);
  console.log("ID type:", typeof id);
  console.log("Is valid ObjectId:", mongoose.Types.ObjectId.isValid(id));

  try {
    const user = await this.findById(id);
    console.log("User found:", !!user);
    return user;
  } catch (error) {
    console.error("Error finding user by ID:", error);
    return null;
  }
};

// Add a method to check if a user exists with a specific ID
UserSchema.statics.checkUserExists = async function (id) {
  try {
    // Try different formats of the ID
    const formats = [id, id.toString(), new mongoose.Types.ObjectId(id)];

    for (const format of formats) {
      console.log(`Checking user existence with ID format: ${format}`);
      const exists = await this.exists({ _id: format });
      console.log(`User exists with format ${format}:`, !!exists);

      if (exists) {
        return { exists: true, format };
      }
    }

    return { exists: false };
  } catch (error) {
    console.error("Error checking user existence:", error);
    return { exists: false, error: error.message };
  }
};

// Add WebSocket-related methods
UserSchema.methods.getRoomId = function () {
  return `user:${this._id}`;
};

UserSchema.methods.propagateSecurityEvent = async function (
  eventType,
  eventData
) {
  const Room = mongoose.model("Room");
  const userRoom = await Room.findOne({ roomId: this.getRoomId() });

  if (!userRoom) return null;

  // Create security event
  const SecurityEvent = mongoose.model("SecurityEvent");
  const event = new SecurityEvent({
    userId: this._id,
    eventType,
    metadata: eventData,
    roomId: userRoom.roomId,
    propagationPath: [userRoom.roomId],
  });

  await event.save();

  // Return event for further propagation
  return event;
};

UserSchema.methods.invalidateAllTokens = async function () {
  this.tokenVersion += 1;
  await this.save();

  // Propagate token invalidation event
  return this.propagateSecurityEvent("token_invalidated", {
    tokenVersion: this.tokenVersion,
    reason: "user_initiated",
  });
};

UserSchema.methods.updateSocketActivity = function () {
  this.lastSocketActivity = new Date();
  return this.save();
};

const User = mongoose.model("User", UserSchema);

module.exports = User;
