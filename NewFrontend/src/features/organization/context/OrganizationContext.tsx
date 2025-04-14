import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/store";
import {
  setOrganizations,
  setMyOrganization,
  setOrganizationLoading,
  setOrganizationError,
  addOrganization,
  updateOrganization,
} from "../store/organizationSlice";
import { toast } from "react-hot-toast";
import { organizationApi } from "@/api/organizationApi";
import { Organization } from "@/features/organization/types/organization.types";
import { useSelector } from "react-redux";

// Define the context type
interface OrganizationContextType {
  organizations: Organization[];
  myOrganization: Organization | null;
  isLoading: boolean;
  error: string | null;
  fetchOrganizations: () => Promise<void>;
  fetchOrganizationById: (id: string) => Promise<Organization | null>;
  createOrganization: (data: {
    name: string;
    description?: string;
    type?: "business" | "educational" | "nonprofit" | "government" | "other";
  }) => Promise<Organization | null>;
  updateOrganization: (
    id: string,
    data: Partial<Organization>
  ) => Promise<Organization | null>;
  validateOrgId: (orgId: string) => Promise<boolean>;
  addTeamToOrganization: (
    orgId: string,
    teamId: string
  ) => Promise<Organization | null>;
  addCustomerToOrganization: (
    orgId: string,
    customerId: string
  ) => Promise<Organization | null>;
}

// Create the context
const OrganizationContext = createContext<OrganizationContextType | undefined>(
  undefined
);

// Provider props
interface OrganizationProviderProps {
  children: ReactNode;
}

// Provider component
export const OrganizationProvider: React.FC<OrganizationProviderProps> = ({
  children,
}) => {
  const user = useSelector((state: RootState) => state.auth.user);
  const dispatch = useDispatch();
  const { organizations, myOrganization, isLoading, error } = useSelector(
    (state: RootState) => state.organization
  );

  // Fetch all organizations
  const fetchOrganizations = async () => {
    try {
      dispatch(setOrganizationLoading(true));
      dispatch(setOrganizationError(null));
      const response = await organizationApi.getAllOrganizations();
      dispatch(setOrganizations(response.data || []));
      return response.data;
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.message || "Failed to fetch organizations";
      dispatch(setOrganizationError(errorMessage));
      toast.error(errorMessage);
      return [];
    } finally {
      dispatch(setOrganizationLoading(false));
    }
  };

  // Fetch organization by ID
  const fetchOrganizationById = async (id: string) => {
    try {
      dispatch(setOrganizationLoading(true));
      dispatch(setOrganizationError(null));
      const response = await organizationApi.getOrganizationById(id);
      return response.data;
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.message || "Failed to fetch organization";
      dispatch(setOrganizationError(errorMessage));
      toast.error(errorMessage);
      return null;
    } finally {
      dispatch(setOrganizationLoading(false));
    }
  };

  // Create organization
  const createOrganization = async (data: {
    name: string;
    description?: string;
    type?: "business" | "educational" | "nonprofit" | "government" | "other";
  }) => {
    try {
      dispatch(setOrganizationLoading(true));
      dispatch(setOrganizationError(null));
      const response = await organizationApi.createOrganization(data);
      dispatch(addOrganization(response.data));
      toast.success("Organization created successfully");
      return response.data;
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.message || "Failed to create organization";
      dispatch(setOrganizationError(errorMessage));
      toast.error(errorMessage);
      return null;
    } finally {
      dispatch(setOrganizationLoading(false));
    }
  };

  // Update organization
  const updateOrg = async (id: string, data: Partial<Organization>) => {
    try {
      dispatch(setOrganizationLoading(true));
      dispatch(setOrganizationError(null));
      const response = await organizationApi.updateOrganization(id, data);
      dispatch(updateOrganization(response.data));
      toast.success("Organization updated successfully");
      return response.data;
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.message || "Failed to update organization";
      dispatch(setOrganizationError(errorMessage));
      toast.error(errorMessage);
      return null;
    } finally {
      dispatch(setOrganizationLoading(false));
    }
  };

  // Validate organization ID
  const validateOrgId = async (orgId: string) => {
    try {
      dispatch(setOrganizationLoading(true));
      dispatch(setOrganizationError(null));
      const response = await organizationApi.validateOrgId(orgId);
      return response.isValid;
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.message || "Failed to validate organization ID";
      dispatch(setOrganizationError(errorMessage));
      return false;
    } finally {
      dispatch(setOrganizationLoading(false));
    }
  };

  // Add team to organization
  const addTeamToOrganization = async (orgId: string, teamId: string) => {
    try {
      dispatch(setOrganizationLoading(true));
      dispatch(setOrganizationError(null));
      const response = await organizationApi.addTeamToOrganization(
        orgId,
        teamId
      );
      dispatch(updateOrganization(response.data));
      toast.success("Team added to organization successfully");
      return response.data;
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.message || "Failed to add team to organization";
      dispatch(setOrganizationError(errorMessage));
      toast.error(errorMessage);
      return null;
    } finally {
      dispatch(setOrganizationLoading(false));
    }
  };

  // Add customer to organization
  const addCustomerToOrganization = async (
    orgId: string,
    customerId: string
  ) => {
    try {
      dispatch(setOrganizationLoading(true));
      dispatch(setOrganizationError(null));
      const response = await organizationApi.addCustomerToOrganization(
        orgId,
        customerId
      );
      dispatch(updateOrganization(response.data));
      toast.success("Customer added to organization successfully");
      return response.data;
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.message || "Failed to add customer to organization";
      dispatch(setOrganizationError(errorMessage));
      toast.error(errorMessage);
      return null;
    } finally {
      dispatch(setOrganizationLoading(false));
    }
  };

  // Fetch user's organization when user changes
  useEffect(() => {
    const fetchMyOrganization = async () => {
      if (user && user.organization) {
        try {
          const org = await fetchOrganizationById(user.organization);
          if (org) {
            dispatch(setMyOrganization(org));
          }
        } catch (error) {
          console.error("Failed to fetch user organization:", error);
        }
      } else {
        dispatch(setMyOrganization(null));
      }
    };

    fetchMyOrganization();
  }, [user, dispatch]);

  // Context value
  const value = {
    organizations,
    myOrganization,
    isLoading,
    error,
    fetchOrganizations,
    fetchOrganizationById,
    createOrganization,
    updateOrganization: updateOrg,
    validateOrgId,
    addTeamToOrganization,
    addCustomerToOrganization,
  };

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
};

// Custom hook to use the organization context
export const useOrganization = () => {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error(
      "useOrganization must be used within an OrganizationProvider"
    );
  }
  return context;
};
