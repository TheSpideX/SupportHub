/**
 * Notification Model
 * Represents a notification in the system
 */

const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const NotificationSchema = new Schema(
  {
    recipient: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["sla", "ticket", "system", "security", "query"],
      required: true,
    },
    severity: {
      type: String,
      enum: ["info", "warning", "error", "success"],
      default: "info",
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    relatedTo: {
      model: {
        type: String,
        enum: ["Ticket", "User", "Team", "Organization", "System", "Query"],
      },
      id: {
        type: Schema.Types.ObjectId,
      },
    },
    displayType: {
      type: String,
      enum: ["corner", "modal", "banner"],
      default: "corner",
    },
    actions: [
      {
        label: String,
        url: String,
      },
    ],
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Create indexes for efficient querying
NotificationSchema.index({ recipient: 1, isRead: 1 });
NotificationSchema.index({ recipient: 1, createdAt: -1 });
NotificationSchema.index({ organizationId: 1, type: 1 });

module.exports = mongoose.model("Notification", NotificationSchema);
