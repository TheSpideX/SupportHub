/**
 * Organization Types
 */

export interface Organization {
  _id: string;
  name: string;
  description?: string;
  orgId: string;
  owner: string;
  status: "active" | "inactive" | "suspended";
  type?: "business" | "educational" | "nonprofit" | "government" | "other";
  settings?: {
    theme?: string;
    features?: Record<string, boolean>;
  };
  teams: string[];
  customers: string[];
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationValidationResult {
  success: boolean;
  isValid: boolean;
  message?: string;
  organizationName?: string;
  organizationType?:
    | "business"
    | "educational"
    | "nonprofit"
    | "government"
    | "other";
  status?: string;
}

export interface OrganizationResponse {
  success: boolean;
  data: Organization | null;
}

export interface OrganizationsResponse {
  success: boolean;
  data: Organization[];
}
