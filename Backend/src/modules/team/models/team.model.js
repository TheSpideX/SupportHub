/**
 * Team Model
 * Represents a support team in the system
 */

const mongoose = require("mongoose");
const { Schema } = mongoose;

const TeamSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Team name is required"],
      trim: true,
      minlength: [2, "Team name must be at least 2 characters"],
      maxlength: [50, "Team name cannot exceed 50 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    teamType: {
      type: String,
      enum: ["technical", "support"],
      required: [true, "Team type is required"],
      default: "support",
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    leadId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    members: [
      {
        userId: {
          type: Schema.Types.ObjectId,
          ref: "User",
        },
        role: {
          type: String,
          enum: ["lead", "member"],
          default: "member",
        },
        joinedAt: {
          type: Date,
          default: Date.now,
        },
        invitedBy: {
          type: Schema.Types.ObjectId,
          ref: "User",
        },
      },
    ],
    invitationCodes: [
      {
        code: {
          type: String,
          required: true,
        },
        role: {
          type: String,
          enum: ["lead", "member"],
          required: true,
        },
        createdBy: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
        expiresAt: {
          type: Date,
          required: true,
          default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
        isUsed: {
          type: Boolean,
          default: false,
        },
        usedBy: {
          type: Schema.Types.ObjectId,
          ref: "User",
        },
        usedAt: Date,
      },
    ],
    metrics: {
      ticketsAssigned: {
        type: Number,
        default: 0,
      },
      ticketsResolved: {
        type: Number,
        default: 0,
      },
      averageResolutionTime: {
        type: Number,
        default: 0,
      },
      lastMetricsUpdate: {
        type: Date,
        default: Date.now,
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
TeamSchema.index({ name: 1 }, { unique: true });
TeamSchema.index({ "members.userId": 1 });
TeamSchema.index({ isActive: 1 });

/**
 * Check if a user is a member of this team
 * @param {string} userId - User ID to check
 * @returns {boolean} True if user is a member
 */
TeamSchema.methods.isMember = function (userId) {
  return this.members.some(
    (member) => member.userId.toString() === userId.toString()
  );
};

/**
 * Check if a user is the lead of this team
 * @param {string} userId - User ID to check
 * @returns {boolean} True if user is the team lead
 */
TeamSchema.methods.isTeamLead = function (userId) {
  return (
    this.leadId &&
    this.leadId.toString() === userId.toString() &&
    this.members.some(
      (member) =>
        member.userId.toString() === userId.toString() && member.role === "lead"
    )
  );
};

/**
 * Add a member to the team
 * @param {Object} memberData - Member data
 * @param {string} memberData.userId - User ID
 * @param {string} memberData.role - Role (lead or member)
 * @param {string} memberData.invitedBy - User ID who invited this member
 * @returns {Promise<Team>} Updated team
 */
TeamSchema.methods.addMember = async function (memberData) {
  // Check if user is already a member
  const existingMember = this.members.find(
    (member) => member.userId.toString() === memberData.userId.toString()
  );

  if (existingMember) {
    // Update existing member if needed
    if (memberData.role && memberData.role !== existingMember.role) {
      existingMember.role = memberData.role;

      // Update leadId if role is lead
      if (memberData.role === "lead") {
        this.leadId = memberData.userId;
      }
    }
  } else {
    // Add new member
    this.members.push({
      userId: memberData.userId,
      role: memberData.role || "member",
      joinedAt: new Date(),
      invitedBy: memberData.invitedBy,
    });

    // Set as lead if role is lead
    if (memberData.role === "lead") {
      this.leadId = memberData.userId;
    }
  }

  return this.save();
};

/**
 * Remove a member from the team
 * @param {string} userId - User ID to remove
 * @returns {Promise<Team>} Updated team
 */
TeamSchema.methods.removeMember = async function (userId) {
  // Check if user is the lead
  if (this.leadId && this.leadId.toString() === userId.toString()) {
    throw new Error("Cannot remove team lead. Assign a new lead first.");
  }

  // Remove member
  this.members = this.members.filter(
    (member) => member.userId.toString() !== userId.toString()
  );

  return this.save();
};

/**
 * Update team metrics
 * @param {Object} metrics - Metrics to update
 * @returns {Promise<Team>} Updated team
 */
TeamSchema.methods.updateMetrics = async function (metrics) {
  Object.assign(this.metrics, metrics, {
    lastMetricsUpdate: new Date(),
  });

  return this.save();
};

const Team = mongoose.model("Team", TeamSchema);

module.exports = Team;
