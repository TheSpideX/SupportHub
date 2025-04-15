import { apiClient } from "./apiClient";
import { API_ROUTES } from "@/config/routes";

// Define API routes for users
const USER_API = {
  BASE: "/api/users",
  GET_ALL: "/api/users",
  GET_BY_ID: (id: string) => `/api/users/${id}`,
  CREATE: "/api/users",
  UPDATE: (id: string) => `/api/users/${id}`,
  DELETE: (id: string) => `/api/users/${id}`,
  BY_IDS: "/api/users/by-ids",
  CHANGE_STATUS: (id: string) => `/api/users/${id}/status`,
  RESET_PASSWORD: (id: string) => `/api/users/${id}/reset-password`,
};

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  organizationId: string;
}

export interface UserCreateData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: string;
  status?: string;
}

export interface UserUpdateData {
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  status?: string;
  profile?: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    avatar?: string;
  };
}

// User API functions
export const userApi = {
  // Get all users with filtering
  getAllUsers: async (filters?: {
    search?: string;
    role?: string;
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

    const response = await apiClient.get(USER_API.GET_ALL, {
      params: validatedFilters,
    });
    return response.data;
  },

  // Get user by ID
  getUserById: async (id: string) => {
    const response = await apiClient.get(USER_API.GET_BY_ID(id));
    return response.data;
  },

  // Create user
  createUser: async (userData: UserCreateData) => {
    const response = await apiClient.post(USER_API.CREATE, userData);
    return response.data;
  },

  // Update user
  updateUser: async (id: string, userData: UserUpdateData) => {
    const response = await apiClient.put(USER_API.UPDATE(id), userData);
    return response.data;
  },

  // Delete user
  deleteUser: async (id: string) => {
    const response = await apiClient.delete(USER_API.DELETE(id));
    return response.data;
  },

  // Get users by IDs
  getUsersByIds: async (userIds: string[]) => {
    const response = await apiClient.post(USER_API.BY_IDS, { userIds });
    return response.data;
  },

  // Change user status
  changeUserStatus: async (id: string, status: string) => {
    const response = await apiClient.patch(USER_API.CHANGE_STATUS(id), {
      status,
    });
    return response.data;
  },

  // Reset user password
  resetUserPassword: async (id: string, newPassword: string) => {
    const response = await apiClient.post(USER_API.RESET_PASSWORD(id), {
      newPassword,
    });
    return response.data;
  },

  // Legacy method for backward compatibility
  getUsers: async (filters?: {
    search?: string;
    roles?: string[];
    sortBy?: string;
    sortOrder?: "asc" | "desc";
    page?: number;
    limit?: number;
  }) => {
    // Validate page number to ensure it's at least 1
    const validPage =
      filters?.page !== undefined ? Math.max(1, filters.page) : undefined;

    const response = await apiClient.get(USER_API.GET_ALL, {
      params: {
        search: filters?.search,
        role: filters?.roles?.join(","),
        sortBy: filters?.sortBy,
        sortOrder: filters?.sortOrder,
        page: validPage,
        limit: filters?.limit,
      },
    });
    return response.data;
  },
};

export default userApi;
