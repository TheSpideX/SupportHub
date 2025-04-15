import { apiClient } from "./apiClient";
import { API_ROUTES } from "@/config/routes";

// Define API routes for customers
const CUSTOMER_API = {
  BASE: "/api/customers",
  GET_ALL: "/api/customers",
  GET_BY_ID: (id: string) => `/api/customers/${id}`,
  CREATE: "/api/customers",
  UPDATE: (id: string) => `/api/customers/${id}`,
  DELETE: (id: string) => `/api/customers/${id}`,
  CHANGE_STATUS: (id: string) => `/api/customers/${id}/status`,
};

export interface Customer {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  company: string;
  phone: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  organizationId: string;
}

export interface CustomerCreateData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  company?: string;
  phone?: string;
  status?: string;
}

export interface CustomerUpdateData {
  email?: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  phone?: string;
  status?: string;
  profile?: {
    firstName?: string;
    lastName?: string;
    company?: string;
    phone?: string;
    avatar?: string;
  };
}

// Customer API functions
export const customerApi = {
  // Get all customers with filtering
  getAllCustomers: async (filters?: {
    search?: string;
    status?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
    page?: number;
    limit?: number;
  }) => {
    // Validate page number to ensure it's at least 1
    const validatedFilters = { ...filters };
    if (validatedFilters.page !== undefined) {
      validatedFilters.page = Math.max(1, validatedFilters.page);
    }

    const response = await apiClient.get(CUSTOMER_API.GET_ALL, {
      params: validatedFilters,
    });
    return response.data;
  },

  // Get customer by ID
  getCustomerById: async (id: string) => {
    const response = await apiClient.get(CUSTOMER_API.GET_BY_ID(id));
    return response.data;
  },

  // Create customer
  createCustomer: async (customerData: CustomerCreateData) => {
    const response = await apiClient.post(CUSTOMER_API.CREATE, customerData);
    return response.data;
  },

  // Update customer
  updateCustomer: async (id: string, customerData: CustomerUpdateData) => {
    const response = await apiClient.put(CUSTOMER_API.UPDATE(id), customerData);
    return response.data;
  },

  // Delete customer
  deleteCustomer: async (id: string) => {
    const response = await apiClient.delete(CUSTOMER_API.DELETE(id));
    return response.data;
  },

  // Change customer status
  changeCustomerStatus: async (id: string, status: string) => {
    const response = await apiClient.patch(CUSTOMER_API.CHANGE_STATUS(id), {
      status,
    });
    return response.data;
  },
};

export default customerApi;
