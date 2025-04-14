import { apiClient } from "./apiClient";
import {
  Organization,
  OrganizationResponse,
  OrganizationsResponse,
  OrganizationValidationResult,
} from "@/features/organization/types/organization.types";

// Define API routes for organizations
const ORGANIZATION_API = {
  BASE: "/api/organizations",
  GET_ALL: "/api/organizations",
  GET_BY_ID: (id: string) => `/api/organizations/${id}`,
  CREATE: "/api/organizations",
  UPDATE: (id: string) => `/api/organizations/${id}`,
  VALIDATE_ORG_ID: (orgId: string) => `/api/organizations/validate/${orgId}`,
  GET_BY_ORG_ID: (orgId: string) => `/api/organizations/org/${orgId}`,
  ADD_TEAM: (id: string) => `/api/organizations/${id}/teams`,
  ADD_CUSTOMER: (id: string) => `/api/organizations/${id}/customers`,
};

// Organization API client

// Organization API functions
export const organizationApi = {
  // Get all organizations
  getAllOrganizations: async (
    page = 1,
    limit = 10,
    filters = {}
  ): Promise<OrganizationsResponse> => {
    const response = await apiClient.get(ORGANIZATION_API.GET_ALL, {
      params: { page, limit, ...filters },
    });
    return response.data.success ? response.data : { data: [] };
  },

  // Get organization by ID
  getOrganizationById: async (id: string): Promise<OrganizationResponse> => {
    const response = await apiClient.get(ORGANIZATION_API.GET_BY_ID(id));
    return response.data.success ? response.data : { data: null };
  },

  // Get organization by orgId
  getOrganizationByOrgId: async (
    orgId: string
  ): Promise<OrganizationResponse> => {
    const response = await apiClient.get(ORGANIZATION_API.GET_BY_ORG_ID(orgId));
    return response.data.success ? response.data : { data: null };
  },

  // Create organization
  createOrganization: async (orgData: {
    name: string;
    description?: string;
    type?: "business" | "educational" | "nonprofit" | "government" | "other";
  }): Promise<OrganizationResponse> => {
    const response = await apiClient.post(ORGANIZATION_API.CREATE, orgData);
    return response.data.success ? response.data : { data: null };
  },

  // Update organization
  updateOrganization: async (
    id: string,
    orgData: {
      name?: string;
      description?: string;
      status?: "active" | "inactive" | "suspended";
      type?: "business" | "educational" | "nonprofit" | "government" | "other";
      settings?: {
        theme?: string;
        features?: Record<string, boolean>;
      };
    }
  ): Promise<OrganizationResponse> => {
    const response = await apiClient.put(ORGANIZATION_API.UPDATE(id), orgData);
    return response.data.success ? response.data : { data: null };
  },

  // Validate organization ID
  validateOrgId: async (
    orgId: string
  ): Promise<OrganizationValidationResult> => {
    const response = await apiClient.get(
      ORGANIZATION_API.VALIDATE_ORG_ID(orgId)
    );
    return response.data.success ? response.data : { isValid: false };
  },

  // Check if organization exists by orgId (for customer registration)
  checkOrganizationExists: async (orgId: string): Promise<boolean> => {
    try {
      const response = await apiClient.get(
        ORGANIZATION_API.VALIDATE_ORG_ID(orgId)
      );
      return response.data.success && response.data.isValid;
    } catch (error) {
      return false;
    }
  },

  // Add team to organization
  addTeamToOrganization: async (
    id: string,
    teamId: string
  ): Promise<OrganizationResponse> => {
    const response = await apiClient.post(ORGANIZATION_API.ADD_TEAM(id), {
      teamId,
    });
    return response.data.success ? response.data : { data: null };
  },

  // Add customer to organization
  addCustomerToOrganization: async (
    id: string,
    customerId: string
  ): Promise<OrganizationResponse> => {
    const response = await apiClient.post(ORGANIZATION_API.ADD_CUSTOMER(id), {
      customerId,
    });
    return response.data.success ? response.data : { data: null };
  },
};

export default organizationApi;
