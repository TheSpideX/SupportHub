import { apiClient } from "./apiClient";
import { logger } from "@/utils/logger";

/**
 * API service for invite code operations
 */
export const inviteCodeApi = {
  /**
   * Validate an invite code
   * @param code - The invite code to validate
   * @returns Promise with validation result
   */
  async validate(code: string) {
    try {
      // Try the team module endpoint first
      try {
        const response = await apiClient.get(
          `/api/teams/invitation-codes/${code}/validate`
        );
        const data = response.data.data;

        // Format the response to be consistent
        return {
          isValid: true,
          teamId: data.teamId,
          teamName: data.teamName,
          teamType: data.teamType,
          role: data.role,
          expiresAt: data.expiresAt,
          organizationId: data.organizationId,
          organizationName: data.organizationName,
          // Include metadata if available
          metadata: data.metadata,
          // Add team and organization objects for backward compatibility
          team: {
            id: data.teamId,
            name: data.teamName,
            type: data.teamType,
          },
          organization: {
            id: data.organizationId,
            name: data.organizationName,
          },
          inviteCode: {
            code: code,
            role: data.role,
            expiresAt: data.expiresAt,
          },
        };
      } catch (teamError) {
        // If team endpoint fails, try the organization endpoint
        logger.warn(
          "Team invitation code validation failed, trying organization endpoint:",
          teamError
        );
        const response = await apiClient.get(
          `/api/invite-codes/validate/${code}`
        );
        return response.data.data;
      }
    } catch (error) {
      logger.error("Error validating invite code:", error);
      throw error;
    }
  },

  /**
   * Generate an invite code for a team
   * @param data - The data for generating an invite code
   * @returns Promise with the generated invite code
   */
  async generate(data: {
    teamId: string;
    role: "team_lead" | "team_member";
    email?: string;
    expiryDays?: number;
  }) {
    try {
      const response = await apiClient.post("/api/invite-codes/generate", data);
      return response.data.data;
    } catch (error) {
      logger.error("Error generating invite code:", error);
      throw error;
    }
  },

  /**
   * List invite codes for a team
   * @param teamId - The team ID
   * @param params - Optional query parameters
   * @returns Promise with the list of invite codes
   */
  async list(
    teamId: string,
    params?: {
      status?: "active" | "used" | "expired" | "revoked";
      page?: number;
      limit?: number;
    }
  ) {
    try {
      const response = await apiClient.get(`/api/invite-codes/team/${teamId}`, {
        params,
      });
      return response.data.data;
    } catch (error) {
      logger.error("Error listing invite codes:", error);
      throw error;
    }
  },

  /**
   * Revoke an invite code
   * @param code - The invite code to revoke
   * @returns Promise with the revocation result
   */
  async revoke(code: string) {
    try {
      const response = await apiClient.post(`/api/invite-codes/revoke/${code}`);
      return response.data.data;
    } catch (error) {
      logger.error("Error revoking invite code:", error);
      throw error;
    }
  },
};
