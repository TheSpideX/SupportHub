/**
 * Invitation Model
 * Represents an invitation to join a team
 */

const mongoose = require("mongoose");
const crypto = require("crypto");
const { Schema } = mongoose;

const InvitationSchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    teamId: {
      type: Schema.Types.ObjectId,
      ref: "Team",
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["lead", "member"],
      default: "member",
    },
    invitedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "expired", "revoked"],
      default: "pending",
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    acceptedAt: {
      type: Date,
      default: null,
    },
    acceptedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
InvitationSchema.index({ status: 1, expiresAt: 1 });
InvitationSchema.index({ teamId: 1, email: 1 }, { unique: true });

/**
 * Generate a unique invitation code
 * @returns {string} Unique invitation code
 */
InvitationSchema.statics.generateInvitationCode = function () {
  return crypto.randomBytes(16).toString("hex");
};

/**
 * Create a new invitation
 * @param {Object} invitationData - Invitation data
 * @param {string} invitationData.teamId - Team ID
 * @param {string} invitationData.email - Invitee email
 * @param {string} invitationData.role - Role (lead or member)
 * @param {string} invitationData.invitedBy - User ID who created the invitation
 * @param {number} expirationDays - Days until expiration (default: 7)
 * @returns {Promise<Invitation>} Created invitation
 */
InvitationSchema.statics.createInvitation = async function (
  invitationData,
  expirationDays = 7
) {
  // Check if there's an existing invitation for this team and email
  const existingInvitation = await this.findOne({
    teamId: invitationData.teamId,
    email: invitationData.email,
    status: "pending",
  });

  if (existingInvitation) {
    // Update existing invitation
    existingInvitation.role = invitationData.role;
    existingInvitation.invitedBy = invitationData.invitedBy;
    existingInvitation.expiresAt = new Date(
      Date.now() + expirationDays * 24 * 60 * 60 * 1000
    );
    existingInvitation.status = "pending";
    
    return existingInvitation.save();
  }

  // Create new invitation
  const code = this.generateInvitationCode();
  const expiresAt = new Date(
    Date.now() + expirationDays * 24 * 60 * 60 * 1000
  );

  return this.create({
    code,
    teamId: invitationData.teamId,
    email: invitationData.email,
    role: invitationData.role || "member",
    invitedBy: invitationData.invitedBy,
    expiresAt,
  });
};

/**
 * Verify if an invitation is valid
 * @param {string} code - Invitation code
 * @returns {Promise<Invitation|null>} Invitation if valid, null otherwise
 */
InvitationSchema.statics.verifyInvitation = async function (code) {
  const invitation = await this.findOne({ code });

  if (!invitation) {
    return null;
  }

  // Check if invitation is expired
  if (invitation.status !== "pending" || invitation.expiresAt < new Date()) {
    // Update status if expired
    if (invitation.status === "pending" && invitation.expiresAt < new Date()) {
      invitation.status = "expired";
      await invitation.save();
    }
    return null;
  }

  return invitation;
};

/**
 * Accept an invitation
 * @param {string} code - Invitation code
 * @param {string} userId - User ID accepting the invitation
 * @returns {Promise<Object>} Result with team and invitation
 */
InvitationSchema.statics.acceptInvitation = async function (code, userId) {
  const invitation = await this.verifyInvitation(code);

  if (!invitation) {
    throw new Error("Invalid or expired invitation");
  }

  // Mark invitation as accepted
  invitation.status = "accepted";
  invitation.acceptedAt = new Date();
  invitation.acceptedBy = userId;
  await invitation.save();

  // Get team
  const Team = mongoose.model("Team");
  const team = await Team.findById(invitation.teamId);

  if (!team) {
    throw new Error("Team not found");
  }

  // Add user to team
  await team.addMember({
    userId,
    role: invitation.role,
    invitedBy: invitation.invitedBy,
  });

  return { team, invitation };
};

/**
 * Revoke an invitation
 * @param {string} invitationId - Invitation ID
 * @returns {Promise<Invitation>} Updated invitation
 */
InvitationSchema.statics.revokeInvitation = async function (invitationId) {
  const invitation = await this.findById(invitationId);

  if (!invitation || invitation.status !== "pending") {
    throw new Error("Invitation not found or already processed");
  }

  invitation.status = "revoked";
  return invitation.save();
};

/**
 * Clean up expired invitations
 * @returns {Promise<number>} Number of expired invitations
 */
InvitationSchema.statics.cleanupExpiredInvitations = async function () {
  const result = await this.updateMany(
    {
      status: "pending",
      expiresAt: { $lt: new Date() },
    },
    {
      $set: { status: "expired" },
    }
  );

  return result.nModified || 0;
};

const Invitation = mongoose.model("Invitation", InvitationSchema);

module.exports = Invitation;
