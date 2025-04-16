/**
 * Script to fix ticket comments that have missing or invalid text fields
 */

const mongoose = require("mongoose");
const config = require("../config/index");
const Ticket = require("../modules/ticket/models/ticket.model");
const logger = require("../utils/logger");

// Get MongoDB URI from environment variables if not in config
const MONGODB_URI =
  process.env.MONGODB_URI ||
  config.mongodb?.uri ||
  "mongodb://localhost:27017/tech_support_crm";

// If logger is not available, use console
const log = logger || console;

async function fixTicketComments() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB");

    // Find all tickets
    const tickets = await Ticket.find({});
    log.info(`Found ${tickets.length} tickets to process`);

    let fixedTicketsCount = 0;
    let fixedCommentsCount = 0;

    // Process each ticket
    for (const ticket of tickets) {
      let ticketModified = false;

      // Check if the ticket has comments
      if (ticket.comments && ticket.comments.length > 0) {
        // Process each comment
        for (let i = 0; i < ticket.comments.length; i++) {
          const comment = ticket.comments[i];

          // Check if the comment text is missing or invalid
          if (!comment.text || typeof comment.text !== "string") {
            log.info(`Fixing comment ${i} in ticket ${ticket.ticketNumber}`);
            ticket.comments[i].text = "[No comment text provided]";
            ticketModified = true;
            fixedCommentsCount++;
          }
        }
      }

      // Save the ticket if it was modified
      if (ticketModified) {
        await ticket.save({ validateBeforeSave: false });
        fixedTicketsCount++;
        log.info(`Fixed ticket ${ticket.ticketNumber}`);
      }
    }

    log.info(
      `Fixed ${fixedCommentsCount} comments in ${fixedTicketsCount} tickets`
    );
    log.info("Script completed successfully");
  } catch (error) {
    log.error("Error fixing ticket comments:", error);
  } finally {
    // Disconnect from MongoDB
    await mongoose.disconnect();
    log.info("Disconnected from MongoDB");
  }
}

// Run the script
fixTicketComments();
