import React, { useState, useEffect } from "react";
import {
  FaClock,
  FaExclamationCircle,
  FaCheckCircle,
  FaPause,
  FaPlay,
  FaPlus,
} from "react-icons/fa";
import {
  useGetSLAPoliciesQuery,
  useApplyPolicyToTicketMutation,
  usePauseSLAMutation,
  useResumeSLAMutation,
} from "@/api/slaApiRTK";
import { toast } from "react-hot-toast";

interface SLAManagementProps {
  ticketId: string;
  ticketPriority: string;
  currentSLA?: {
    policyId?: string;
    responseDeadline?: string;
    resolutionDeadline?: string;
    pausedAt?: string;
    pauseReason?: string;
    breached?: {
      response: boolean;
      resolution: boolean;
    };
  };
}

const SLAManagement: React.FC<SLAManagementProps> = ({
  ticketId,
  ticketPriority,
  currentSLA,
}) => {
  const [selectedPolicyId, setSelectedPolicyId] = useState<string>("");
  const [pauseReason, setPauseReason] = useState<string>("");
  const [showPauseForm, setShowPauseForm] = useState<boolean>(false);

  const { data: policies, isLoading: isPoliciesLoading } =
    useGetSLAPoliciesQuery();
  const [applyPolicy, { isLoading: isApplying }] =
    useApplyPolicyToTicketMutation();
  const [pauseSLA, { isLoading: isPausing }] = usePauseSLAMutation();
  const [resumeSLA, { isLoading: isResuming }] = useResumeSLAMutation();

  // Set selected policy to current policy if exists
  useEffect(() => {
    if (currentSLA?.policyId) {
      setSelectedPolicyId(currentSLA.policyId);
    }
  }, [currentSLA]);

  // Handle apply policy
  const handleApplyPolicy = async () => {
    if (!selectedPolicyId) {
      toast.error("Please select an SLA policy");
      return;
    }

    try {
      await applyPolicy({
        ticketId,
        data: { policyId: selectedPolicyId },
      }).unwrap();

      toast.success("SLA policy applied successfully");
    } catch (err) {
      console.error("Failed to apply SLA policy:", err);
      toast.error("Failed to apply SLA policy. Please try again.");
    }
  };

  // Handle pause SLA
  const handlePauseSLA = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!pauseReason.trim()) {
      toast.error("Please provide a reason for pausing the SLA");
      return;
    }

    try {
      await pauseSLA({
        ticketId,
        data: { reason: pauseReason },
      }).unwrap();

      toast.success("SLA paused successfully");
      setShowPauseForm(false);
      setPauseReason("");
    } catch (err) {
      console.error("Failed to pause SLA:", err);
      toast.error("Failed to pause SLA. Please try again.");
    }
  };

  // Handle resume SLA
  const handleResumeSLA = async () => {
    try {
      await resumeSLA(ticketId).unwrap();

      toast.success("SLA resumed successfully");
    } catch (err) {
      console.error("Failed to resume SLA:", err);
      toast.error("Failed to resume SLA. Please try again.");
    }
  };

  // Format deadline for display
  const formatDeadline = (deadline?: string) => {
    if (!deadline) return "Not set";

    const deadlineDate = new Date(deadline);
    const now = new Date();

    // Calculate time difference
    const diffMs = deadlineDate.getTime() - now.getTime();
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffMs < 0) {
      return `Overdue by ${Math.abs(diffHrs)} hours`;
    } else {
      return `${diffHrs} hours remaining`;
    }
  };

  // Format relative time (e.g., "in 2 hours" or "3 days ago")
  const formatRelativeTime = (dateString?: string) => {
    if (!dateString) return "";

    const date = new Date(dateString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffSecs = Math.floor(Math.abs(diffMs) / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMs >= 0) {
      // Future date
      if (diffDays > 0) return `in ${diffDays} day${diffDays > 1 ? "s" : ""}`;
      if (diffHours > 0)
        return `in ${diffHours} hour${diffHours > 1 ? "s" : ""}`;
      if (diffMins > 0)
        return `in ${diffMins} minute${diffMins > 1 ? "s" : ""}`;
      return "just now";
    } else {
      // Past date
      if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
      if (diffHours > 0)
        return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
      if (diffMins > 0)
        return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
      return "just now";
    }
  };

  // Get status color based on time remaining
  const getStatusColor = (deadline?: string, breached?: boolean) => {
    if (breached) return "text-red-500";
    if (!deadline) return "text-gray-400";

    const deadlineDate = new Date(deadline);
    const now = new Date();

    // Calculate time difference
    const diffMs = deadlineDate.getTime() - now.getTime();
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffMs < 0) {
      return "text-red-500";
    } else if (diffHrs < 4) {
      return "text-yellow-500";
    } else {
      return "text-green-500";
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gray-700/30 rounded-lg p-5">
        <h3 className="text-lg font-medium text-white mb-4">
          Current SLA Status
        </h3>

        {currentSLA?.policyId ? (
          <div className="space-y-4">
            {/* Policy Info */}
            <div className="bg-gray-800/50 rounded-lg p-4 mb-4">
              <h4 className="text-sm text-gray-400 mb-1">Applied SLA Policy</h4>
              <div className="flex items-center justify-between">
                <div className="text-lg font-medium text-blue-400">
                  {policies?.data?.find((p) => p._id === currentSLA.policyId)
                    ?.name || "Custom SLA Policy"}
                </div>
                <div className="bg-blue-500/20 text-blue-400 text-xs px-2.5 py-0.5 rounded-full">
                  {ticketPriority.charAt(0).toUpperCase() +
                    ticketPriority.slice(1)}{" "}
                  Priority
                </div>
              </div>
              <div className="text-xs text-gray-400 mt-2">
                This policy was applied{" "}
                {currentSLA.policyId ? "manually" : "automatically"} based on
                ticket priority
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-800/50 rounded-lg p-4">
                <h4 className="text-sm text-gray-400 mb-1">
                  Response Deadline
                </h4>
                <div className="flex items-center justify-between">
                  <div
                    className={`text-lg font-medium ${getStatusColor(
                      currentSLA.responseDeadline,
                      currentSLA.breached?.response
                    )}`}
                  >
                    {formatDeadline(currentSLA.responseDeadline)}
                  </div>
                  {currentSLA.breached?.response ? (
                    <FaExclamationCircle className="text-red-500" />
                  ) : (
                    <FaClock
                      className={getStatusColor(
                        currentSLA.responseDeadline,
                        currentSLA.breached?.response
                      )}
                    />
                  )}
                </div>
                {currentSLA.responseDeadline && (
                  <div className="text-xs text-gray-400 mt-2">
                    {currentSLA.breached?.response
                      ? "Response deadline has been breached"
                      : `Response deadline ${
                          new Date(currentSLA.responseDeadline) < new Date()
                            ? "was"
                            : "is"
                        } ${formatRelativeTime(currentSLA.responseDeadline)}`}
                  </div>
                )}
              </div>

              <div className="bg-gray-800/50 rounded-lg p-4">
                <h4 className="text-sm text-gray-400 mb-1">
                  Resolution Deadline
                </h4>
                <div className="flex items-center justify-between">
                  <div
                    className={`text-lg font-medium ${getStatusColor(
                      currentSLA.resolutionDeadline,
                      currentSLA.breached?.resolution
                    )}`}
                  >
                    {formatDeadline(currentSLA.resolutionDeadline)}
                  </div>
                  {currentSLA.breached?.resolution ? (
                    <FaExclamationCircle className="text-red-500" />
                  ) : (
                    <FaClock
                      className={getStatusColor(
                        currentSLA.resolutionDeadline,
                        currentSLA.breached?.resolution
                      )}
                    />
                  )}
                </div>
                {currentSLA.resolutionDeadline && (
                  <div className="text-xs text-gray-400 mt-2">
                    {currentSLA.breached?.resolution
                      ? "Resolution deadline has been breached"
                      : `Resolution deadline ${
                          new Date(currentSLA.resolutionDeadline) < new Date()
                            ? "was"
                            : "is"
                        } ${formatRelativeTime(currentSLA.resolutionDeadline)}`}
                  </div>
                )}
              </div>
            </div>

            {currentSLA.pausedAt ? (
              <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-yellow-400 font-medium flex items-center">
                      <FaPause className="mr-2" /> SLA Currently Paused
                    </h4>
                    <p className="text-sm text-gray-300 mt-1">
                      Reason: {currentSLA.pauseReason || "No reason provided"}
                    </p>
                  </div>

                  <button
                    onClick={handleResumeSLA}
                    disabled={isResuming}
                    className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isResuming ? (
                      <svg
                        className="animate-spin h-4 w-4 mr-2 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                    ) : (
                      <FaPlay className="mr-2" />
                    )}
                    Resume SLA
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex justify-end">
                {showPauseForm ? (
                  <form
                    onSubmit={handlePauseSLA}
                    className="w-full bg-gray-800/50 rounded-lg p-4"
                  >
                    <h4 className="text-white font-medium mb-2">Pause SLA</h4>
                    <div className="mb-3">
                      <label
                        htmlFor="pauseReason"
                        className="block text-sm text-gray-400 mb-1"
                      >
                        Reason <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        id="pauseReason"
                        value={pauseReason}
                        onChange={(e) => setPauseReason(e.target.value)}
                        className="w-full bg-gray-700/50 border border-gray-600/50 rounded-lg py-2 px-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        placeholder="Provide a reason for pausing the SLA"
                        rows={2}
                      />
                    </div>
                    <div className="flex justify-end space-x-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowPauseForm(false);
                          setPauseReason("");
                        }}
                        className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isPausing || !pauseReason.trim()}
                        className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isPausing ? (
                          <svg
                            className="animate-spin h-4 w-4 mr-2 text-white"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                        ) : (
                          <FaPause className="mr-2" />
                        )}
                        Pause SLA
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    onClick={() => setShowPauseForm(true)}
                    className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors flex items-center"
                  >
                    <FaPause className="mr-2" /> Pause SLA
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-6 bg-gray-800/50 rounded-lg">
            <FaClock className="mx-auto text-gray-400 text-4xl mb-3" />
            <p className="text-gray-300">
              No SLA policy applied to this ticket
            </p>
            <p className="text-sm text-gray-400 mt-1">
              Apply an SLA policy below to set response and resolution deadlines
            </p>
          </div>
        )}
      </div>

      <div className="bg-gray-700/30 rounded-lg p-5">
        <h3 className="text-lg font-medium text-white mb-4">
          Apply SLA Policy
        </h3>

        {isPoliciesLoading ? (
          <div className="flex justify-center items-center py-6">
            <svg
              className="animate-spin h-8 w-8 text-blue-500"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          </div>
        ) : policies && policies.length > 0 ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-2">
              {policies.map((policy) => (
                <label
                  key={policy._id}
                  className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedPolicyId === policy._id
                      ? "bg-blue-500/20 border-blue-500"
                      : "bg-gray-800/50 border-gray-700 hover:border-gray-600"
                  }`}
                >
                  <input
                    type="radio"
                    name="slaPolicy"
                    value={policy._id}
                    checked={selectedPolicyId === policy._id}
                    onChange={() => setSelectedPolicyId(policy._id)}
                    className="sr-only"
                  />
                  <div className="flex-grow">
                    <div className="font-medium text-white">{policy.name}</div>
                    <div className="text-sm text-gray-400 mt-1">
                      {policy.description}
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div className="text-xs text-gray-400">
                        Response:{" "}
                        <span className="text-blue-400">
                          {policy.responseTime[ticketPriority]} hours
                        </span>
                      </div>
                      <div className="text-xs text-gray-400">
                        Resolution:{" "}
                        <span className="text-blue-400">
                          {policy.resolutionTime[ticketPriority]} hours
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="ml-3">
                    {selectedPolicyId === policy._id && (
                      <FaCheckCircle className="text-blue-500" />
                    )}
                  </div>
                </label>
              ))}
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleApplyPolicy}
                disabled={isApplying || !selectedPolicyId}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isApplying ? (
                  <svg
                    className="animate-spin h-4 w-4 mr-2 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                ) : (
                  <FaCheckCircle className="mr-2" />
                )}
                Apply SLA Policy
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 bg-gray-800/50 rounded-lg">
            <p className="text-gray-300">No SLA policies available</p>
            <p className="text-sm text-gray-400 mt-1">
              Contact an administrator to create SLA policies
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SLAManagement;
