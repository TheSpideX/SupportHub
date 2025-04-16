/**
 * Query Model
 * Represents a customer query that can be converted to a ticket
 */

const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const QuerySchema = new Schema(
  {
    // Basic Information
    queryNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    subject: {
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

    // Customer Information
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Classification
    category: {
      type: String,
      enum: ["general", "technical", "billing", "feature_request", "other"],
      default: "general",
    },

    // Status
    status: {
      type: String,
      enum: ["new", "under_review", "converted", "resolved", "closed"],
      default: "new",
    },

    // Attachments
    attachments: [
      {
        filename: String,
        path: String,
        mimetype: String,
        size: Number,
        uploadedAt: Date,
      },
    ],

    // Assignment
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    // Ticket Conversion
    convertedToTicket: {
      type: Schema.Types.ObjectId,
      ref: "Ticket",
    },
    convertedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    convertedAt: Date,

    // Communication
    comments: [
      {
        author: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        text: String,
        createdAt: {
          type: Date,
          default: Date.now,
        },
        isInternal: {
          type: Boolean,
          default: false,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient querying
QuerySchema.index({ organizationId: 1, status: 1 });
QuerySchema.index({ organizationId: 1, customerId: 1 });
QuerySchema.index({ organizationId: 1, assignedTo: 1 });
QuerySchema.index({ organizationId: 1, createdAt: -1 });

// Generate query number
QuerySchema.pre("save", async function (next) {
  if (this.isNew) {
    try {
      // Get the organization code or use 'QRY' as default
      let orgPrefix = "QRY";
      
      if (this.organizationId) {
        const Organization = mongoose.model("Organization");
        const org = await Organization.findById(this.organizationId);
        if (org && org.code) {
          orgPrefix = org.code;
        }
      }
      
      // Get the current year
      const currentYear = new Date().getFullYear().toString().substr(-2);
      
      // Find the highest query number for this organization and year
      const highestQuery = await this.constructor.findOne(
        { 
          queryNumber: new RegExp(`^${orgPrefix}-Q${currentYear}-`),
          organizationId: this.organizationId
        },
        { queryNumber: 1 },
        { sort: { queryNumber: -1 } }
      );
      
      let nextNumber = 1;
      
      if (highestQuery && highestQuery.queryNumber) {
        // Extract the number part
        const parts = highestQuery.queryNumber.split('-');
        if (parts.length === 3) {
          nextNumber = parseInt(parts[2]) + 1;
        }
      }
      
      // Format with leading zeros (5 digits)
      const formattedNumber = nextNumber.toString().padStart(5, '0');
      
      // Set the query number
      this.queryNumber = `${orgPrefix}-Q${currentYear}-${formattedNumber}`;
      
      next();
    } catch (error) {
      next(error);
    }
  } else {
    next();
  }
});

// Method to add a comment
QuerySchema.methods.addComment = function (commentData) {
  this.comments.push(commentData);
  return this.save();
};

// Method to assign query
QuerySchema.methods.assignTo = function (userId) {
  this.assignedTo = userId;
  return this.save();
};

// Method to convert to ticket
QuerySchema.methods.convertToTicket = async function (ticketData, userId) {
  // Check if already converted
  if (this.convertedToTicket) {
    throw new Error("Query already converted to ticket");
  }
  
  // Create ticket
  const Ticket = mongoose.model("Ticket");
  
  const ticket = new Ticket({
    title: ticketData.title || this.subject,
    description: ticketData.description || this.description,
    organizationId: this.organizationId,
    source: "customer_query",
    originalQuery: this._id,
    category: ticketData.category || this.category,
    subcategory: ticketData.subcategory,
    type: ticketData.type || "incident",
    priority: ticketData.priority || "medium",
    impact: ticketData.impact || "individual",
    customer: {
      userId: this.customerId,
    },
    createdBy: userId,
    attachments: this.attachments,
  });
  
  // Assign to team if specified
  if (ticketData.primaryTeam) {
    ticket.primaryTeam = {
      teamId: ticketData.primaryTeam,
      assignedAt: new Date(),
      assignedBy: userId,
    };
  }
  
  // Assign to user if specified
  if (ticketData.assignedTo) {
    ticket.assignedTo = ticketData.assignedTo;
  }
  
  // Save the ticket
  await ticket.save();
  
  // Update query
  this.status = "converted";
  this.convertedToTicket = ticket._id;
  this.convertedBy = userId;
  this.convertedAt = new Date();
  
  await this.save();
  
  return ticket;
};

const Query = mongoose.model("Query", QuerySchema);

module.exports = Query;
