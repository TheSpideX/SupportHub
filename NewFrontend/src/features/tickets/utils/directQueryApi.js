/**
 * Direct API utilities for query operations
 * Uses fetch directly instead of RTK Query for more control
 */

/**
 * Create a query using direct fetch
 * @param {Object} queryData - Query data to create
 * @returns {Promise<Object>} - Response data
 */
export const createQueryDirectFetch = async (queryData) => {
  try {
    // Get CSRF token from cookies
    const csrfToken = document.cookie
      .split("; ")
      .find((row) => row.startsWith("csrf_token="))
      ?.split("=")[1];

    if (!csrfToken) {
      console.warn("CSRF token not found in cookies");
    }

    // Make the request
    const response = await fetch("http://localhost:4290/api/queries", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-CSRF-Token": csrfToken || ""
      },
      body: JSON.stringify(queryData),
      credentials: "include"
    });

    // Parse response
    const data = await response.json();

    return data;
  } catch (error) {
    console.error("Error creating query with direct fetch:", error);
    throw error;
  }
};
