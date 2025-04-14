import { apiClient } from "./apiClient";

// Define API routes for users
const USER_API = {
  GET_ALL: "/api/users",
  GET_BY_IDS: "/api/users/by-ids",
};

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt?: string;
}

export const userApi = {
  // Get all users with filtering
  getUsers: async (filters?: {
    search?: string;
    roles?: string[];
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  }) => {
    const response = await apiClient.get(USER_API.GET_ALL, {
      params: {
        search: filters?.search,
        roles: filters?.roles?.join(','),
        sortBy: filters?.sortBy,
        sortOrder: filters?.sortOrder,
        page: filters?.page,
        limit: filters?.limit
      }
    });
    return response.data;
  },
  
  // Get users by IDs
  getUsersByIds: async (userIds: string[]) => {
    const response = await apiClient.post(USER_API.GET_BY_IDS, { userIds });
    return response.data;
  }
};

export default userApi;
