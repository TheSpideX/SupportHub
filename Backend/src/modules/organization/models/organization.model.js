/**
 * Organization Model
 * Represents an organization in the multi-tenant system
 */

const mongoose = require("mongoose");
const { Schema } = mongoose;

const OrganizationSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Organization name is required"],
      trim: true,
      minlength: [2, "Organization name must be at least 2 characters"],
      maxlength: [100, "Organization name cannot exceed 100 characters"],
      unique: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    orgId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false, // Changed to false to allow creation without owner initially
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "active",
    },
    type: {
      type: String,
      enum: ["business", "educational", "nonprofit", "government", "other"],
      default: "business",
    },
    settings: {
      theme: {
        type: String,
        default: "default",
      },
      features: {
        type: Map,
        of: Boolean,
        default: {},
      },
    },
    teams: [
      {
        type: Schema.Types.ObjectId,
        ref: "Team",
      },
    ],
    customers: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
OrganizationSchema.index({ name: 1 }, { unique: true });
OrganizationSchema.index({ orgId: 1 }, { unique: true });
OrganizationSchema.index({ status: 1 });
OrganizationSchema.index({ type: 1, status: 1 });
OrganizationSchema.index({ owner: 1 });
OrganizationSchema.index({ teams: 1 });
OrganizationSchema.index({ customers: 1 });

/**
 * Generate a unique organization ID
 * Format: ORG-XXXXX (where X is alphanumeric)
 */
OrganizationSchema.statics.generateOrgId = async function () {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let orgId;
  let isUnique = false;

  // Keep generating until we find a unique ID
  while (!isUnique) {
    let randomPart = "";
    for (let i = 0; i < 5; i++) {
      randomPart += characters.charAt(
        Math.floor(Math.random() * characters.length)
      );
    }

    orgId = `ORG-${randomPart}`;

    // Check if this ID already exists
    const existingOrg = await this.findOne({ orgId });
    if (!existingOrg) {
      isUnique = true;
    }
  }

  return orgId;
};

/**
 * Add a team to the organization
 */
OrganizationSchema.methods.addTeam = function (teamId) {
  if (!this.teams.includes(teamId)) {
    this.teams.push(teamId);
  }
  return this.save();
};

/**
 * Add a customer to the organization
 */
OrganizationSchema.methods.addCustomer = function (customerId) {
  if (!this.customers.includes(customerId)) {
    this.customers.push(customerId);
  }
  return this.save();
};

const Organization = mongoose.model("Organization", OrganizationSchema);

module.exports = Organization;
