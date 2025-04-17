import React, { useState, useEffect } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { FaClock, FaCheck, FaTimes } from "react-icons/fa";
import { toast } from "react-hot-toast";
import {
  useGetSLAPoliciesQuery,
  useApplySLAPolicyMutation,
} from "../services/slaApi";

interface SLAPolicySelectorProps {
  isOpen: boolean;
  closeModal: () => void;
  ticketId: string;
  onSuccess: () => void;
}

const SLAPolicySelector: React.FC<SLAPolicySelectorProps> = ({
  isOpen,
  closeModal,
  ticketId,
  onSuccess,
}) => {
  const [selectedPolicyId, setSelectedPolicyId] = useState<string>("");

  // Fetch SLA policies
  const { data: policiesData, isLoading, error } = useGetSLAPoliciesQuery();
  const [applySLAPolicy, { isLoading: isApplying }] =
    useApplySLAPolicyMutation();

  // Reset selected policy when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedPolicyId("");
    }
  }, [isOpen]);

  const handleApplyPolicy = async () => {
    if (!selectedPolicyId) {
      toast.error("Please select an SLA policy");
      return;
    }

    try {
      console.log(
        `Applying SLA policy ${selectedPolicyId} to ticket ${ticketId}`
      );

      // Use direct fetch instead of RTK Query
      const response = await fetch(`/api/sla/apply/${ticketId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ policyId: selectedPolicyId }),
        credentials: "include",
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error applying SLA policy:", errorText);
        throw new Error(`Failed to apply SLA policy: ${errorText}`);
      }

      const responseData = await response.json();
      console.log("SLA policy applied successfully:", responseData);

      toast.success("SLA policy applied successfully");
      onSuccess();
      closeModal();
    } catch (error) {
      console.error("Failed to apply SLA policy:", error);
      toast.error("Failed to apply SLA policy. Please try again.");
    }
  };

  return (
    <Transition appear show={isOpen} as={React.Fragment}>
      <Dialog as="div" className="relative z-50" onClose={closeModal}>
        <Transition.Child
          as={React.Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/75" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={React.Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-lg bg-gray-800 p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-medium leading-6 text-white flex items-center"
                >
                  <FaClock className="mr-2 text-blue-400" />
                  Apply SLA Policy
                </Dialog.Title>

                <div className="mt-4">
                  <p className="text-sm text-gray-300 mb-4">
                    Select an SLA policy to apply to this ticket. This will set
                    response and resolution deadlines based on the policy.
                  </p>

                  {isLoading ? (
                    <div className="py-4 text-center text-gray-400">
                      Loading SLA policies...
                    </div>
                  ) : error ? (
                    <div className="py-4 text-center text-red-400">
                      Failed to load SLA policies. Please try again.
                    </div>
                  ) : policiesData?.data?.length === 0 ? (
                    <div className="py-4 text-center text-yellow-400">
                      No SLA policies found. Please create an SLA policy first.
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                      {policiesData?.data?.map((policy: any) => (
                        <div
                          key={policy._id}
                          className={`p-3 rounded-lg cursor-pointer transition-colors ${
                            selectedPolicyId === policy._id
                              ? "bg-blue-600/30 border border-blue-500"
                              : "bg-gray-700/50 hover:bg-gray-700 border border-transparent"
                          }`}
                          onClick={() => setSelectedPolicyId(policy._id)}
                        >
                          <div className="flex justify-between items-center">
                            <h4 className="font-medium text-white">
                              {policy.name}
                            </h4>
                            {selectedPolicyId === policy._id && (
                              <FaCheck className="text-blue-400" />
                            )}
                          </div>
                          <p className="text-sm text-gray-300 mt-1">
                            {policy.description || "No description provided"}
                          </p>
                          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                            <div className="bg-gray-800/50 p-2 rounded">
                              <span className="text-gray-400">
                                Response Time:
                              </span>
                              <div className="text-white">
                                Low: {policy.responseTime?.low || "N/A"} min
                              </div>
                              <div className="text-white">
                                Medium: {policy.responseTime?.medium || "N/A"}{" "}
                                min
                              </div>
                              <div className="text-white">
                                High: {policy.responseTime?.high || "N/A"} min
                              </div>
                              <div className="text-white">
                                Critical:{" "}
                                {policy.responseTime?.critical || "N/A"} min
                              </div>
                            </div>
                            <div className="bg-gray-800/50 p-2 rounded">
                              <span className="text-gray-400">
                                Resolution Time:
                              </span>
                              <div className="text-white">
                                Low: {policy.resolutionTime?.low || "N/A"} min
                              </div>
                              <div className="text-white">
                                Medium: {policy.resolutionTime?.medium || "N/A"}{" "}
                                min
                              </div>
                              <div className="text-white">
                                High: {policy.resolutionTime?.high || "N/A"} min
                              </div>
                              <div className="text-white">
                                Critical:{" "}
                                {policy.resolutionTime?.critical || "N/A"} min
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    type="button"
                    className="inline-flex justify-center rounded-md border border-transparent bg-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 focus:outline-none"
                    onClick={closeModal}
                  >
                    <FaTimes className="mr-2 mt-0.5" />
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleApplyPolicy}
                    disabled={!selectedPolicyId || isApplying}
                  >
                    <FaCheck className="mr-2 mt-0.5" />
                    Apply Policy
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default SLAPolicySelector;
