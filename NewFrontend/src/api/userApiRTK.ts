import { api } from "@/lib/api";
import { User, UserCreateData, UserUpdateData } from "./userApi";

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export const userApiRTK = api.injectEndpoints({
  endpoints: (builder) => ({
    // Get all users with filtering
    getUsers: builder.query<
      PaginatedResponse<User>,
      {
        search?: string;
        role?: string;
        status?: string;
        sortBy?: string;
        sortOrder?: "asc" | "desc";
        page?: number;
        limit?: number;
      } | void
    >({
      query: (params = {}) => ({
        url: "/api/users",
        method: "GET",
        params,
      }),
      providesTags: ["Users"],
    }),

    // Get user by ID
    getUserById: builder.query<User, string>({
      query: (id) => ({
        url: `/users/${id}`,
        method: "GET",
      }),
      providesTags: (result, error, id) => [{ type: "Users" as const, id }],
    }),

    // Create user
    createUser: builder.mutation<User, UserCreateData>({
      query: (data) => ({
        url: "/users",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["Users"],
    }),

    // Update user
    updateUser: builder.mutation<User, { id: string; data: UserUpdateData }>({
      query: ({ id, data }) => ({
        url: `/users/${id}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: "Users" as const, id },
        "Users",
      ],
    }),

    // Delete user
    deleteUser: builder.mutation<void, string>({
      query: (id) => ({
        url: `/users/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Users"],
    }),

    // Get users by IDs
    getUsersByIds: builder.mutation<User[], string[]>({
      query: (userIds) => ({
        url: "/users/by-ids",
        method: "POST",
        body: { userIds },
      }),
    }),

    // Change user status
    changeUserStatus: builder.mutation<User, { id: string; status: string }>({
      query: ({ id, status }) => ({
        url: `/users/${id}/status`,
        method: "PATCH",
        body: { status },
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: "Users" as const, id },
        "Users",
      ],
    }),

    // Reset user password
    resetUserPassword: builder.mutation<
      void,
      { id: string; newPassword: string }
    >({
      query: ({ id, newPassword }) => ({
        url: `/users/${id}/reset-password`,
        method: "POST",
        body: { newPassword },
      }),
    }),
  }),
});

export const {
  useGetUsersQuery,
  useGetUserByIdQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
  useGetUsersByIdsMutation,
  useChangeUserStatusMutation,
  useResetUserPasswordMutation,
} = userApiRTK;
