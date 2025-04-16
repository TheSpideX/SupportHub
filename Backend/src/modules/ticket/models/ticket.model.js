/**
 * Ticket Model
 * Represents a support ticket in the system
 */

const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const TicketSchema = new Schema(
  {
    // Basic Information
    ticketNumber: {
      type: String,
      unique: true,
      index: true,
      // Not required as it will be auto-generated
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },

    // Organization Context (Mandatory)
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    // Source Information
    source: {
      type: String,
      enum: ["customer_query", "direct_creation", "system_generated", "email"],
      required: true,
    },
    originalQuery: {
      type: Schema.Types.ObjectId,
      ref: "Query",
    },

    // Classification
    category: {
      type: String,
      required: true,
    },
    subcategory: String,
    type: {
      type: String,
      enum: ["incident", "problem", "change_request", "service_request"],
      default: "incident",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
    },
    impact: {
      type: String,
      enum: ["individual", "department", "organization", "customers"],
      default: "individual",
    },

    // Status and Workflow
    status: {
      type: String,
      enum: [
        "new",
        "assigned",
        "in_progress",
        "on_hold",
        "pending_customer",
        "resolved",
        "closed",
      ],
      default: "new",
    },
    statusHistory: [
      {
        status: String,
        changedBy: {
          type: Schema.Types.ObjectId,
          ref: "User",
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
        reason: String,
      },
    ],

    // Team Assignment (Multi-Team Support)
    primaryTeam: {
      teamId: {
        type: Schema.Types.ObjectId,
        ref: "Team",
      },
      assignedAt: Date,
      assignedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    },
    supportingTeams: [
      {
        teamId: {
          type: Schema.Types.ObjectId,
          ref: "Team",
        },
        role: String, // Specific role this team plays
        assignedAt: Date,
        assignedBy: {
          type: Schema.Types.ObjectId,
          ref: "User",
        },
        status: {
          type: String,
          enum: ["assigned", "in_progress", "completed", "rejected"],
          default: "assigned",
        },
      },
    ],

    // Individual Assignment
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    // Customer Information
    customer: {
      userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
      email: String,
      name: String,
      contactNumber: String,
    },

    // Creation Information
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // SLA Information
    sla: {
      policyId: {
        type: Schema.Types.ObjectId,
        ref: "SLAPolicy",
      },
      responseDeadline: Date,
      resolutionDeadline: Date,
      pausedAt: Date,
      pauseReason: String,
      totalPausedTime: {
        type: Number,
        default: 0,
      }, // In minutes
      breached: {
        response: {
          type: Boolean,
          default: false,
        },
        resolution: {
          type: Boolean,
          default: false,
        },
      },
    },

    // Communication
    comments: [
      {
        author: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        text: {
          type: String,
          default: "[No comment text provided]",
          trim: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
        isInternal: {
          type: Boolean,
          default: false,
        },
        visibleToTeams: [
          {
            type: Schema.Types.ObjectId,
            ref: "Team",
          },
        ],
        attachments: [
          {
            filename: String,
            path: String,
            mimetype: String,
            size: Number,
            uploadedAt: Date,
          },
        ],
      },
    ],

    // Attachments
    attachments: [
      {
        filename: String,
        path: String,
        mimetype: String,
        size: Number,
        uploadedAt: Date,
        uploadedBy: {
          type: Schema.Types.ObjectId,
          ref: "User",
        },
      },
    ],

    // Related Tickets
    parentTicket: {
      type: Schema.Types.ObjectId,
      ref: "Ticket",
    },
    childTickets: [
      {
        type: Schema.Types.ObjectId,
        ref: "Ticket",
      },
    ],
    relatedTickets: [
      {
        ticketId: {
          type: Schema.Types.ObjectId,
          ref: "Ticket",
        },
        relationship: {
          type: String,
          enum: ["related_to", "duplicates", "blocks", "is_blocked_by"],
        },
      },
    ],

    // Audit and Tracking
    auditLog: [
      {
        action: String,
        performedBy: {
          type: Schema.Types.ObjectId,
          ref: "User",
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
        details: Schema.Types.Mixed,
      },
    ],

    // Additional Data
    tags: [String],
    customFields: {
      type: Map,
      of: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient querying
TicketSchema.index({ organizationId: 1, status: 1 });
TicketSchema.index({ organizationId: 1, "primaryTeam.teamId": 1 });
TicketSchema.index({ organizationId: 1, "supportingTeams.teamId": 1 });
TicketSchema.index({ organizationId: 1, assignedTo: 1 });
TicketSchema.index({ organizationId: 1, "customer.userId": 1 });
TicketSchema.index({ organizationId: 1, createdAt: -1 });

// Generate ticket number
TicketSchema.pre("save", async function (next) {
  if (this.isNew) {
    try {
      // Get the organization code or use 'TKT' as default
      let orgPrefix = "TKT";

      if (this.organizationId) {
        const Organization = mongoose.model("Organization");
        const org = await Organization.findById(this.organizationId);
        if (org && org.code) {
          orgPrefix = org.code;
        }
      }

      // Get the current year
      const currentYear = new Date().getFullYear().toString().substr(-2);

      // Find the highest ticket number for this organization and year
      const highestTicket = await this.constructor.findOne(
        {
          ticketNumber: new RegExp(`^${orgPrefix}-${currentYear}-`),
          organizationId: this.organizationId,
        },
        { ticketNumber: 1 },
        { sort: { ticketNumber: -1 } }
      );

      let nextNumber = 1;

      if (highestTicket && highestTicket.ticketNumber) {
        // Extract the number part
        const parts = highestTicket.ticketNumber.split("-");
        if (parts.length === 3) {
          nextNumber = parseInt(parts[2]) + 1;
        }
      }

      // Format with leading zeros (5 digits)
      const formattedNumber = nextNumber.toString().padStart(5, "0");

      // Set the ticket number
      this.ticketNumber = `${orgPrefix}-${currentYear}-${formattedNumber}`;

      // Add initial status to history
      this.statusHistory = [
        {
          status: this.status,
          changedBy: this.createdBy,
          timestamp: new Date(),
          reason: "Ticket created",
        },
      ];

      // Add creation entry to audit log
      const timestamp = new Date();
      this.auditLog = [
        {
          action: "created",
          performedBy: this.createdBy,
          timestamp: timestamp,
          details: {
            title: this.title,
            source: this.source,
          },
        },
      ];

      // If ticket is assigned on creation, add assignment entry
      if (this.assignedTo) {
        this.auditLog.push({
          action: "assigned",
          performedBy: this.createdBy,
          timestamp: timestamp,
          details: {
            previousAssignee: null,
            newAssignee: this.assignedTo,
            assigneeName: null, // Will be populated later
          },
        });
      }

      // If ticket has a primary team on creation, add team assignment entry
      if (this.primaryTeam && this.primaryTeam.teamId) {
        this.auditLog.push({
          action: "team_assigned_primary",
          performedBy: this.createdBy,
          timestamp: timestamp,
          details: {
            previousTeam: null,
            newTeam: this.primaryTeam.teamId,
          },
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  } else {
    next();
  }
});

// Update status history when status changes
TicketSchema.pre("save", function (next) {
  if (this.isModified("status")) {
    // Get the user who made the change (should be set by the controller)
    const changedBy = this._statusChangedBy || this.updatedBy || this.createdBy;
    const reason = this._statusChangeReason || "Status updated";
    const timestamp = new Date();

    // Add to status history
    this.statusHistory.push({
      status: this.status,
      changedBy,
      timestamp,
      reason,
    });

    // Get previous status (if not a new ticket)
    let oldStatus = null;
    if (this.statusHistory && this.statusHistory.length > 1) {
      oldStatus = this.statusHistory[this.statusHistory.length - 2].status;
    }

    // Add to audit log
    if (!this.isNew) {
      this.auditLog.push({
        action: "status_changed",
        performedBy: changedBy,
        timestamp,
        details: {
          oldStatus: oldStatus,
          newStatus: this.status,
          reason: reason,
        },
      });
    }
  }
  next();
});

// Method to add a comment
TicketSchema.methods.addComment = function (commentData) {
  console.log("Adding comment in model method:", commentData);

  // Ensure text is trimmed (validation should have already happened in service)
  if (commentData.text && typeof commentData.text === "string") {
    commentData.text = commentData.text.trim();
    console.log("Comment text after trim:", commentData.text);
  } else {
    // This should not happen as service should validate, but as a safeguard
    console.log(
      "Comment text is invalid in model method, this should not happen"
    );
    commentData.text = "[No comment text provided]";
  }

  this.comments.push(commentData);
  console.log(
    "Comment pushed to array, new comment count:",
    this.comments.length
  );

  // Get the newly added comment
  const newComment = this.comments[this.comments.length - 1];
  console.log("New comment added:", newComment);

  // Add to audit log
  this.auditLog.push({
    action: "commented",
    performedBy: commentData.author,
    timestamp: new Date(),
    details: {
      commentId: newComment._id,
      isInternal: commentData.isInternal || false,
      comment: commentData.text.substring(0, 500),
    },
  });

  return this.save();
};

// Method to assign ticket
TicketSchema.methods.assignTo = function (userId, assignedBy) {
  const previousAssignee = this.assignedTo;
  this.assignedTo = userId;

  // Update status if it's new
  if (this.status === "new") {
    this.status = "assigned";
    this._statusChangedBy = assignedBy;
    this._statusChangeReason = "Ticket assigned";
  }

  // Add to audit log
  this.auditLog.push({
    action: "assigned",
    performedBy: assignedBy,
    timestamp: new Date(),
    details: {
      previousAssignee,
      newAssignee: userId,
      assigneeName: null, // Will be populated in post-processing
    },
  });

  return this.save();
};

// Method to assign to team
TicketSchema.methods.assignToTeam = function (
  teamId,
  assignedBy,
  isPrimary = true
) {
  if (isPrimary) {
    const previousTeam = this.primaryTeam?.teamId;

    this.primaryTeam = {
      teamId,
      assignedAt: new Date(),
      assignedBy,
    };

    // Add to audit log
    this.auditLog.push({
      action: "team_assigned_primary",
      performedBy: assignedBy,
      timestamp: new Date(),
      details: {
        previousTeam,
        newTeam: teamId,
      },
    });
  } else {
    // Check if team is already in supporting teams
    const existingTeamIndex = this.supportingTeams.findIndex(
      (team) => team.teamId.toString() === teamId.toString()
    );

    if (existingTeamIndex >= 0) {
      // Update existing team
      this.supportingTeams[existingTeamIndex].status = "assigned";
      this.supportingTeams[existingTeamIndex].assignedAt = new Date();
      this.supportingTeams[existingTeamIndex].assignedBy = assignedBy;
    } else {
      // Add new supporting team
      this.supportingTeams.push({
        teamId,
        assignedAt: new Date(),
        assignedBy,
        status: "assigned",
      });
    }

    // Add to audit log
    this.auditLog.push({
      action: "team_assigned_supporting",
      performedBy: assignedBy,
      timestamp: new Date(),
      details: {
        teamId,
      },
    });
  }

  return this.save();
};

// Method to update SLA
TicketSchema.methods.updateSLA = function (slaData) {
  this.sla = {
    ...this.sla,
    ...slaData,
  };

  // Add to audit log
  this.auditLog.push({
    action: "sla_updated",
    timestamp: new Date(),
    details: slaData,
  });

  return this.save();
};

// Method to check if SLA is breached
TicketSchema.methods.checkSLABreach = function () {
  const now = new Date();

  if (this.sla) {
    // Check response SLA
    if (
      this.sla.responseDeadline &&
      now > this.sla.responseDeadline &&
      !this.sla.breached.response
    ) {
      this.sla.breached.response = true;

      // Add to audit log
      this.auditLog.push({
        action: "sla_breached",
        timestamp: now,
        details: {
          type: "response",
          deadline: this.sla.responseDeadline,
        },
      });
    }

    // Check resolution SLA
    if (
      this.sla.resolutionDeadline &&
      now > this.sla.resolutionDeadline &&
      !this.sla.breached.resolution
    ) {
      this.sla.breached.resolution = true;

      // Add to audit log
      this.auditLog.push({
        action: "sla_breached",
        timestamp: now,
        details: {
          type: "resolution",
          deadline: this.sla.resolutionDeadline,
        },
      });
    }

    if (this.isModified("sla")) {
      return this.save();
    }
  }

  return Promise.resolve(this);
};

const Ticket = mongoose.model("Ticket", TicketSchema);

module.exports = Ticket;
