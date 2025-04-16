/**
 * SLA Policy Model
 * Defines service level agreement policies for tickets
 */

const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const SLAPolicySchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    description: String,

    // Organization Context (Mandatory)
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    // Response Time Targets (in minutes)
    responseTime: {
      low: Number,
      medium: Number,
      high: Number,
      critical: Number,
    },

    // Resolution Time Targets (in minutes)
    resolutionTime: {
      low: Number,
      medium: Number,
      high: Number,
      critical: Number,
    },

    // Business Hours
    businessHours: {
      monday: { start: String, end: String },
      tuesday: { start: String, end: String },
      wednesday: { start: String, end: String },
      thursday: { start: String, end: String },
      friday: { start: String, end: String },
      saturday: { start: String, end: String },
      sunday: { start: String, end: String },
    },

    // Holidays
    holidays: [
      {
        date: Date,
        name: String,
      },
    ],

    // Escalation Rules
    escalationRules: [
      {
        condition: {
          type: String,
          enum: [
            "response_approaching",
            "response_breached",
            "resolution_approaching",
            "resolution_breached",
          ],
        },
        threshold: Number, // percentage of time elapsed
        actions: [
          {
            type: String,
            enum: [
              "notify_assignee",
              "notify_team_lead",
              "notify_manager",
              "reassign",
              "increase_priority",
            ],
            details: Schema.Types.Mixed,
          },
        ],
      },
    ],

    isActive: {
      type: Boolean,
      default: true,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
SLAPolicySchema.index({ organizationId: 1, isActive: 1 });

// Method to calculate SLA deadlines for a ticket
SLAPolicySchema.methods.calculateDeadlines = function (priority, createdAt) {
  const now = createdAt || new Date();

  // Get response time in minutes for the given priority
  const responseMinutes =
    this.responseTime[priority.toLowerCase()] || this.responseTime.medium; // Default to medium if not found

  // Get resolution time in minutes for the given priority
  const resolutionMinutes =
    this.resolutionTime[priority.toLowerCase()] || this.resolutionTime.medium; // Default to medium if not found

  // Check if we should use business hours
  const useBusinessHours =
    this.businessHours &&
    Object.values(this.businessHours).some((day) => day.start && day.end);

  let responseDeadline, resolutionDeadline;

  if (useBusinessHours) {
    // Calculate deadlines considering business hours
    responseDeadline = this.addBusinessMinutes(now, responseMinutes);
    resolutionDeadline = this.addBusinessMinutes(now, resolutionMinutes);
  } else {
    // Simple calculation without business hours
    responseDeadline = new Date(now.getTime() + responseMinutes * 60000);
    resolutionDeadline = new Date(now.getTime() + resolutionMinutes * 60000);
  }

  return {
    responseDeadline,
    resolutionDeadline,
  };
};

// Method to check if current time is within business hours
SLAPolicySchema.methods.isWithinBusinessHours = function (date = new Date()) {
  const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const currentTime = `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}`;

  // Map day of week to day name
  const dayMap = {
    0: "sunday",
    1: "monday",
    2: "tuesday",
    3: "wednesday",
    4: "thursday",
    5: "friday",
    6: "saturday",
  };

  const dayName = dayMap[dayOfWeek];
  const dayHours = this.businessHours[dayName];

  // If no hours defined for this day, it's not a business day
  if (!dayHours || !dayHours.start || !dayHours.end) {
    return false;
  }

  // Check if current time is within business hours
  return currentTime >= dayHours.start && currentTime <= dayHours.end;
};

// Method to check if date is a holiday
SLAPolicySchema.methods.isHoliday = function (date = new Date()) {
  // Format date to YYYY-MM-DD for comparison
  const dateString = date.toISOString().split("T")[0];

  // Check if date exists in holidays
  return this.holidays.some((holiday) => {
    const holidayDate = holiday.date.toISOString().split("T")[0];
    return holidayDate === dateString;
  });
};

// Method to calculate business minutes between two dates
SLAPolicySchema.methods.calculateBusinessMinutes = function (
  startDate,
  endDate
) {
  // This is a simplified implementation
  // A full implementation would need to account for business hours and holidays

  const start = new Date(startDate);
  const end = new Date(endDate);

  // Total minutes between dates
  let totalMinutes = Math.floor((end - start) / 60000);

  // For now, just return the total minutes
  // In a real implementation, you would subtract non-business hours and holidays
  return totalMinutes;
};

// Method to add business minutes to a date
SLAPolicySchema.methods.addBusinessMinutes = function (startDate, minutes) {
  const start = new Date(startDate);
  let current = new Date(start);
  let remainingMinutes = minutes;

  // Simple implementation for now - just add the minutes directly
  // A full implementation would need to skip non-business hours and holidays
  while (remainingMinutes > 0) {
    // Add 1 minute
    current.setMinutes(current.getMinutes() + 1);

    // Check if we're in business hours and not on a holiday
    if (this.isWithinBusinessHours(current) && !this.isHoliday(current)) {
      remainingMinutes--;
    }

    // Safety check to prevent infinite loops
    // If we've gone more than 30 days, just return a date
    if (current.getTime() - start.getTime() > 30 * 24 * 60 * 60 * 1000) {
      return new Date(start.getTime() + minutes * 60000);
    }
  }

  return current;
};

const SLAPolicy = mongoose.model("SLAPolicy", SLAPolicySchema);

module.exports = SLAPolicy;
