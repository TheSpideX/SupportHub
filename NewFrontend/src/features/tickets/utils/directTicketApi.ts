/**
 * Direct API utilities for ticket and query operations
 * Used as a fallback when RTK Query has issues with body parsing
 */

import { getAuthToken } from "@/features/auth/utils/auth.utils";
import { AddCommentRequest } from "../api/ticketApi";

/**
 * Add a comment to a ticket using direct fetch instead of RTK Query
 * This is a workaround for issues with body parsing in RTK Query
 */
export const addCommentDirectFetch = async (
  ticketId: string,
  data: AddCommentRequest
) => {
  try {
    console.log("Adding comment with direct fetch:", { ticketId, data });

    // Validate comment text
    if (!data.text || typeof data.text !== "string" || !data.text.trim()) {
      throw new Error("Comment text cannot be empty");
    }

    // Create a clean data object
    const cleanData = {
      text: data.text.trim(),
      isInternal: !!data.isInternal,
    };

    console.log("Clean comment data:", cleanData);

    // Get the auth token
    const token = getAuthToken();

    if (!token) {
      throw new Error("Authentication token not found");
    }

    // Make the request
    console.log("Sending comment data to backend:", JSON.stringify(cleanData));

    // Use XMLHttpRequest for more control over the request
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `/api/tickets/${ticketId}/comments`, true);
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.withCredentials = true;

      xhr.onload = function () {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const result = JSON.parse(xhr.responseText);
            console.log("Comment added successfully:", result);
            resolve(result);
          } catch (parseError) {
            console.error("Error parsing response:", parseError);
            reject(new Error("Invalid response format"));
          }
        } else {
          console.error(
            "Error adding comment:",
            xhr.statusText,
            xhr.responseText
          );
          try {
            const errorData = JSON.parse(xhr.responseText);
            reject(errorData);
          } catch (parseError) {
            reject(new Error(`HTTP error ${xhr.status}: ${xhr.statusText}`));
          }
        }
      };

      xhr.onerror = function () {
        console.error("Network error occurred");
        reject(new Error("Network error occurred"));
      };

      // Send the request with the comment data
      xhr.send(JSON.stringify(cleanData));
    });
  } catch (error) {
    console.error("Error in addCommentDirectFetch:", error);
    throw error;
  }
};

/**
 * Add a comment to a query using direct fetch instead of RTK Query
 * This is a workaround for issues with body parsing in RTK Query
 */
export const addQueryCommentDirectFetch = async (
  queryId: string,
  data: AddCommentRequest
) => {
  try {
    console.log("Adding comment to query with direct fetch:", {
      queryId,
      data,
    });

    // Validate comment text
    if (!data.text || typeof data.text !== "string" || !data.text.trim()) {
      throw new Error("Comment text cannot be empty");
    }

    // Create a clean data object
    const cleanData = {
      text: data.text.trim(),
      isInternal: !!data.isInternal,
    };

    console.log("Clean query comment data:", cleanData);

    // Get the auth token
    const token = getAuthToken();

    if (!token) {
      throw new Error("Authentication token not found");
    }

    // Make the request
    console.log(
      "Sending query comment data to backend:",
      JSON.stringify(cleanData)
    );

    // Use XMLHttpRequest for more control over the request
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `/api/queries/${queryId}/comments`, true);
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.withCredentials = true;

      xhr.onload = function () {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const result = JSON.parse(xhr.responseText);
            console.log("Query comment added successfully:", result);
            resolve(result);
          } catch (parseError) {
            console.error("Error parsing response:", parseError);
            reject(new Error("Invalid response format"));
          }
        } else {
          console.error(
            "Error adding query comment:",
            xhr.statusText,
            xhr.responseText
          );
          try {
            const errorData = JSON.parse(xhr.responseText);
            reject(errorData);
          } catch (parseError) {
            reject(new Error(`HTTP error ${xhr.status}: ${xhr.statusText}`));
          }
        }
      };

      xhr.onerror = function () {
        console.error("Network error occurred");
        reject(new Error("Network error occurred"));
      };

      // Send the request with the comment data
      xhr.send(JSON.stringify(cleanData));
    });
  } catch (error) {
    console.error("Error in addQueryCommentDirectFetch:", error);
    throw error;
  }
};
