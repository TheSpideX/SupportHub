import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Organization } from "@/features/organization/types/organization.types";

export interface OrganizationState {
  organizations: Organization[];
  myOrganization: Organization | null;
  selectedOrganization: Organization | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: OrganizationState = {
  organizations: [],
  myOrganization: null,
  selectedOrganization: null,
  isLoading: false,
  error: null,
};

const organizationSlice = createSlice({
  name: "organization",
  initialState,
  reducers: {
    setOrganizations: (state, action: PayloadAction<Organization[]>) => {
      state.organizations = action.payload;
      state.error = null;
    },
    setMyOrganization: (state, action: PayloadAction<Organization | null>) => {
      state.myOrganization = action.payload;
      state.error = null;
    },
    setSelectedOrganization: (
      state,
      action: PayloadAction<Organization | null>
    ) => {
      state.selectedOrganization = action.payload;
      state.error = null;
    },
    addOrganization: (state, action: PayloadAction<Organization>) => {
      state.organizations.push(action.payload);
      state.error = null;
    },
    updateOrganization: (state, action: PayloadAction<Organization>) => {
      const index = state.organizations.findIndex(
        (org) => org._id === action.payload._id
      );
      if (index !== -1) {
        state.organizations[index] = action.payload;
      }

      // Update myOrganization if it's the same organization
      if (
        state.myOrganization &&
        state.myOrganization._id === action.payload._id
      ) {
        state.myOrganization = action.payload;
      }

      // Update selectedOrganization if it's the same organization
      if (
        state.selectedOrganization &&
        state.selectedOrganization._id === action.payload._id
      ) {
        state.selectedOrganization = action.payload;
      }

      state.error = null;
    },
    setOrganizationLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setOrganizationError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    resetOrganizationState: (state) => {
      return initialState;
    },
  },
});

export const {
  setOrganizations,
  setMyOrganization,
  setSelectedOrganization,
  addOrganization,
  updateOrganization,
  setOrganizationLoading,
  setOrganizationError,
  resetOrganizationState,
} = organizationSlice.actions;

export default organizationSlice.reducer;
