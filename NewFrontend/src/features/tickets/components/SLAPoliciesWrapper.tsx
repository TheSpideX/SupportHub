import React from "react";
import { useGetSLAPoliciesQuery } from "@/services/slaApi";

interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

interface SLAPoliciesWrapperProps {
  formData: {
    priority: string;
    slaPolicy: string;
  };
  handleChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}

const SLAPoliciesWrapper: React.FC<SLAPoliciesWrapperProps> = ({
  formData,
  handleChange,
}) => {
  const {
    data: slaPoliciesData,
    isLoading,
    error,
  } = useGetSLAPoliciesQuery(undefined);

  // Log the raw SLA policies data for debugging
  React.useEffect(() => {
    console.log("Raw SLA policies data:", slaPoliciesData);
  }, [slaPoliciesData]);

  if (isLoading) {
    return (
      <select
        id="slaPolicy"
        name="slaPolicy"
        value={formData.slaPolicy}
        onChange={handleChange}
        className="w-full bg-gray-700/50 border border-gray-600/50 rounded-lg py-2 px-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none"
        size={5} // Show 5 options at a time
        style={{ maxHeight: "200px", overflowY: "auto" }} // Add scrolling
      >
        <option value="">Loading SLA policies...</option>
      </select>
    );
  }

  if (error) {
    console.error("Error loading SLA policies:", error);
    return (
      <select
        id="slaPolicy"
        name="slaPolicy"
        value={formData.slaPolicy}
        onChange={handleChange}
        className="w-full bg-gray-700/50 border border-gray-600/50 rounded-lg py-2 px-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none"
        size={5} // Show 5 options at a time
        style={{ maxHeight: "200px", overflowY: "auto" }} // Add scrolling
      >
        <option value="">Auto-select based on priority</option>
        <option value="">Error loading SLA policies</option>
      </select>
    );
  }

  return (
    <select
      id="slaPolicy"
      name="slaPolicy"
      value={formData.slaPolicy}
      onChange={handleChange}
      className="w-full bg-gray-700/50 border border-gray-600/50 rounded-lg py-2 px-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none"
      size={5} // Show 5 options at a time
      style={{ maxHeight: "200px", overflowY: "auto" }} // Add scrolling
    >
      <option value="">Auto-select based on priority</option>
      {slaPoliciesData?.data && Array.isArray(slaPoliciesData.data)
        ? slaPoliciesData.data.map((policy: any) => (
            <option key={policy._id} value={policy._id}>
              {policy.name} - Response:{" "}
              {policy.responseTime?.[formData.priority] || "N/A"} min,
              Resolution: {policy.resolutionTime?.[formData.priority] || "N/A"}{" "}
              min
            </option>
          ))
        : null}
    </select>
  );
};

export default SLAPoliciesWrapper;
