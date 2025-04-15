import { apiClient } from './apiClient';
import { logger } from '@/utils/logger';

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
      const response = await apiClient.get(`/api/invite-codes/validate/${code}`);
      return response.data.data;
    } catch (error) {
      logger.error('Error validating invite code:', error);
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
    role: 'team_lead' | 'team_member';
    email?: string;
    expiryDays?: number;
  }) {
    try {
      const response = await apiClient.post('/api/invite-codes/generate', data);
      return response.data.data;
    } catch (error) {
      logger.error('Error generating invite code:', error);
      throw error;
    }
  },

  /**
   * List invite codes for a team
   * @param teamId - The team ID
   * @param params - Optional query parameters
   * @returns Promise with the list of invite codes
   */
  async list(teamId: string, params?: {
    status?: 'active' | 'used' | 'expired' | 'revoked';
    page?: number;
    limit?: number;
  }) {
    try {
      const response = await apiClient.get(`/api/invite-codes/team/${teamId}`, {
        params,
      });
      return response.data.data;
    } catch (error) {
      logger.error('Error listing invite codes:', error);
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
      logger.error('Error revoking invite code:', error);
      throw error;
    }
  },
};
