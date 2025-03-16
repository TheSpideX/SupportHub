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
        validate: [{
          validator: function(password) {
            // Only validate password if it's being modified (not during login)
            if (this.isModified('security.password')) {
              return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(password);
            }
            return true;
          },
          message: "Password must contain uppercase, lowercase, number, and special character"
        }],
      },
      passwordHistory: [
        {
          hash: String,
          changedAt: Date,
          _id: false, // Disable _id for subdocuments
        },
      ],
      loginAttempts: {
        type: Number,
        default: 0,
        min: 0,
        max: 1000,
      },
      lockUntil: {
        type: Date,
      },
      passwordChangedAt: Date,
      passwordResetToken: String,
      passwordResetExpires: Date,
      twoFactorSecret: String,
      twoFactorEnabled: {
        type: Boolean,
        default: false,
      },
      loginHistory: [
        {
          timestamp: Date,
          ipAddress: String,
          userAgent: String,
          location: String,
          status: {
            type: String,
            enum: ["success", "failed"],
          },
        },
      ],
      // Add token version for refresh token management
      tokenVersion: {
        type: Number,
        default: 0
      },
      // Add backup codes for 2FA recovery
      backupCodes: [{
        code: String,
        used: {
          type: Boolean,
          default: false
        },
        _id: false
      }],
      // Add trusted devices
      trustedDevices: [{
        fingerprint: String,
        name: String,
        userAgent: String,
        lastUsed: Date,
        ipAddress: String,
        trusted: {
          type: Boolean,
          default: true
        },
        _id: false
      }],
      // Add IP restrictions
      ipRestrictions: {
        enabled: {
          type: Boolean,
          default: false
        },
        allowedIps: [String],
        blockedIps: [String],
        allowUnknown: {
          type: Boolean,
          default: true
        }
      }
    },
    role: {
      type: String,
      enum: {
        values: ["customer", "support", "technical", "team_lead", "admin"],
        message: "{VALUE} is not a valid role",
      },
      default: "customer",
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
  if (this.isModified("security.passwordHistory")) {
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
UserSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    console.log('Password comparison debug:', {
      hasPassword: !!this.security?.password,
      passwordLength: this.security?.password?.length || 0,
      candidateLength: candidatePassword?.length || 0
    });
    
    if (!this.security?.password) {
      console.log('User has no password hash stored');
      return false;
    }
    
    const isMatch = await bcrypt.compare(candidatePassword, this.security.password);
    console.log('Password comparison result:', isMatch);
    return isMatch;
  } catch (error) {
    console.error('Error comparing passwords:', error);
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
  return !!(this.security.lockUntil && this.security.lockUntil > Date.now());
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
UserSchema.statics.findByEmail = async function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

// Validate password (instance method)
UserSchema.methods.validatePassword = async function(password) {
  // First check if account is locked
  if (this.isLocked()) {
    return {
      isValid: false,
      reason: 'ACCOUNT_LOCKED',
      message: 'Account is temporarily locked due to too many failed attempts'
    };
  }

  // Get user with password field (which is normally excluded)
  const user = await mongoose.model('User').findById(this._id).select('+security.password');
  
  if (!user) {
    return {
      isValid: false,
      reason: 'USER_NOT_FOUND',
      message: 'User not found'
    };
  }

  try {
    const isMatch = await user.comparePassword(password);
    
    if (isMatch) {
      // Reset login attempts on successful login
      await user.resetLoginAttempts();
      return {
        isValid: true
      };
    } else {
      // Increment login attempts on failed login
      await user.incrementLoginAttempts();
      return {
        isValid: false,
        reason: 'INVALID_PASSWORD',
        message: 'Invalid password',
        attemptsRemaining: Math.max(0, 5 - (user.security.loginAttempts + 1))
      };
    }
  } catch (error) {
    return {
      isValid: false,
      reason: 'VALIDATION_ERROR',
      message: 'Password validation failed'
    };
  }
};

// Increment token version (for refresh token invalidation)
UserSchema.methods.incrementTokenVersion = async function() {
  this.security.tokenVersion += 1;
  return this.save();
};

// Check if user is active
UserSchema.methods.isActive = function() {
  return this.status.isActive && !this.isLocked();
};

// Add device to trusted devices
UserSchema.methods.addTrustedDevice = function(deviceInfo) {
  // Check if device already exists
  const existingDeviceIndex = this.security.trustedDevices.findIndex(
    device => device.fingerprint === deviceInfo.fingerprint
  );

  const deviceData = {
    fingerprint: deviceInfo.fingerprint,
    name: deviceInfo.name || `Device on ${new Date().toLocaleDateString()}`,
    userAgent: deviceInfo.userAgent,
    lastUsed: new Date(),
    ipAddress: deviceInfo.ipAddress,
    trusted: true
  };

  if (existingDeviceIndex >= 0) {
    // Update existing device
    this.security.trustedDevices[existingDeviceIndex] = {
      ...this.security.trustedDevices[existingDeviceIndex],
      ...deviceData
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
UserSchema.methods.removeTrustedDevice = function(fingerprint) {
  this.security.trustedDevices = this.security.trustedDevices.filter(
    device => device.fingerprint !== fingerprint
  );
  return this.save();
};

// Check if device is trusted
UserSchema.methods.isDeviceTrusted = function(fingerprint) {
  return this.security.trustedDevices.some(
    device => device.fingerprint === fingerprint && device.trusted
  );
};

// Generate backup codes for 2FA
UserSchema.methods.generateBackupCodes = function() {
  const codes = [];
  for (let i = 0; i < 10; i++) {
    codes.push({
      code: crypto.randomBytes(4).toString('hex'),
      used: false
    });
  }
  this.security.backupCodes = codes;
  return this.save();
};

// Verify backup code
UserSchema.methods.verifyBackupCode = async function(code) {
  const backupCode = this.security.backupCodes.find(bc => bc.code === code && !bc.used);
  
  if (backupCode) {
    backupCode.used = true;
    await this.save();
    return true;
  }
  
  return false;
};

// Check if IP is allowed
UserSchema.methods.isIpAllowed = function(ipAddress) {
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
UserSchema.index({ email: 1 }, { 
  unique: true,
  name: 'email_unique_index'
});
UserSchema.index({ role: 1 });
UserSchema.index({ "profile.firstName": 1, "profile.lastName": 1 });
UserSchema.index({ "security.lockUntil": 1 });
UserSchema.index({ "status.lastActive": 1 });
UserSchema.index({ "status.isActive": 1 });
UserSchema.index({ "security.loginAttempts": 1 });
UserSchema.index({ "security.trustedDevices.fingerprint": 1 });

const User = mongoose.model("User", UserSchema);

module.exports = User;
