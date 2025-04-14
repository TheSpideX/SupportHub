/**
 * Organization formatting utilities
 */

/**
 * Format organization data for consistent response
 * @param {Object} organization - Organization document
 * @param {boolean} includeDetails - Whether to include all details or just basic info
 * @returns {Object} Formatted organization data
 */
exports.formatOrganizationResponse = (organization, includeDetails = true) => {
  // Basic organization info that's always included
  const formattedOrg = {
    _id: organization._id,
    name: organization.name,
    orgId: organization.orgId,
    status: organization.status,
    type: organization.type, // Default value is set in the schema
  };

  // Include additional details if requested
  if (includeDetails) {
    return {
      ...formattedOrg,
      description: organization.description,
      owner: organization.owner,
      settings: organization.settings,
      teams: organization.teams || [],
      customers: organization.customers || [],
      createdAt: organization.createdAt,
      updatedAt: organization.updatedAt,
    };
  }

  return formattedOrg;
};
