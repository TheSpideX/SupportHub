import { useState } from "react";
import { useOrganization } from "../context/OrganizationContext";
import { Organization } from "@/api/organizationApi";
import { useToast } from "@/hooks/useToast";

export const useOrganizationManagement = () => {
  const {
    organizations,
    myOrganization,
    isLoading,
    error,
    fetchOrganizations,
    fetchOrganizationById,
    createOrganization,
    updateOrganization,
    validateOrgId,
    addTeamToOrganization,
    addCustomerToOrganization,
  } = useOrganization();

  const { showToast } = useToast();

  const [selectedOrganization, setSelectedOrganization] =
    useState<Organization | null>(null);
  const [isCreatingOrganization, setIsCreatingOrganization] = useState(false);
  const [isEditingOrganization, setIsEditingOrganization] = useState(false);

  // Open create organization modal
  const openCreateOrganizationModal = () => {
    setIsCreatingOrganization(true);
  };

  // Close create organization modal
  const closeCreateOrganizationModal = () => {
    setIsCreatingOrganization(false);
  };

  // Open edit organization modal
  const openEditOrganizationModal = (organization: Organization) => {
    setSelectedOrganization(organization);
    setIsEditingOrganization(true);
  };

  // Close edit organization modal
  const closeEditOrganizationModal = () => {
    setSelectedOrganization(null);
    setIsEditingOrganization(false);
  };

  // Handle create organization
  const handleCreateOrganization = async (data: {
    name: string;
    description?: string;
    type?: "business" | "educational" | "nonprofit" | "government" | "other";
  }) => {
    const result = await createOrganization(data);
    if (result) {
      closeCreateOrganizationModal();
      showToast("Organization created successfully", "success");
      return true;
    }
    return false;
  };

  // Handle update organization
  const handleUpdateOrganization = async (
    id: string,
    data: Partial<Organization>
  ) => {
    const result = await updateOrganization(id, data);
    if (result) {
      closeEditOrganizationModal();
      showToast("Organization updated successfully", "success");
      return true;
    }
    return false;
  };

  // Handle validate organization ID
  const handleValidateOrgId = async (orgId: string) => {
    const isValid = await validateOrgId(orgId);
    return isValid;
  };

  return {
    // State
    organizations,
    myOrganization,
    selectedOrganization,
    isLoading,
    error,
    isCreatingOrganization,
    isEditingOrganization,

    // Actions
    fetchOrganizations,
    fetchOrganizationById,
    setSelectedOrganization,
    openCreateOrganizationModal,
    closeCreateOrganizationModal,
    openEditOrganizationModal,
    closeEditOrganizationModal,
    handleCreateOrganization,
    handleUpdateOrganization,
    handleValidateOrgId,
    addTeamToOrganization,
    addCustomerToOrganization,
  };
};
