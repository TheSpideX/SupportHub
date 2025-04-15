/**
 * Invite Code Model
 * Used for inviting team members and team leads to an organization
 */

const mongoose = require("mongoose");
const { Schema } = mongoose;
const crypto = require("crypto");

const InviteCodeSchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    teamId: {
      type: Schema.Types.ObjectId,
      ref: "Team",
      index: true,
    },
    role: {
      type: String,
      enum: ["team_lead", "team_member"],
      required: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please provide a valid email address",
      ],
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    usedAt: {
      type: Date,
    },
    usedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    status: {
      type: String,
      enum: ["active", "used", "expired", "revoked"],
      default: "active",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
InviteCodeSchema.index({ code: 1 }, { unique: true });
InviteCodeSchema.index({ organizationId: 1, status: 1 });
InviteCodeSchema.index({ expiresAt: 1, status: 1 });

// Add compound index for tenant-based queries
InviteCodeSchema.index({ organizationId: 1, teamId: 1, status: 1 });
InviteCodeSchema.index({ organizationId: 1, role: 1, status: 1 });

/**
 * Generate a unique invite code
 * Format: INV-XXXXXX (where X is alphanumeric)
 */
InviteCodeSchema.statics.generateInviteCode = async function () {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code;
  let isUnique = false;

  // Keep generating until we find a unique code
  while (!isUnique) {
    let randomPart = "";
    for (let i = 0; i < 6; i++) {
      randomPart += characters.charAt(
        Math.floor(Math.random() * characters.length)
      );
    }

    code = `INV-${randomPart}`;

    // Check if this code already exists
    const existingCode = await this.findOne({ code });
    if (!existingCode) {
      isUnique = true;
    }
  }

  return code;
};

/**
 * Check if invite code is valid
 */
InviteCodeSchema.methods.isValid = function () {
  return (
    this.status === "active" && this.expiresAt > new Date() && !this.usedAt
  );
};

/**
 * Mark invite code as used
 */
InviteCodeSchema.methods.markAsUsed = function (userId) {
  this.status = "used";
  this.usedAt = new Date();
  this.usedBy = userId;
  return this.save();
};

/**
 * Revoke invite code
 */
InviteCodeSchema.methods.revoke = function () {
  this.status = "revoked";
  return this.save();
};

const InviteCode = mongoose.model("InviteCode", InviteCodeSchema);

module.exports = InviteCode;
