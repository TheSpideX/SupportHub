import React, { useState, useEffect } from "react";
import { FaKey, FaCopy, FaTrash, FaPlus } from "react-icons/fa";
import { Button } from "@/components/ui/buttons/Button";
import { toast } from "react-hot-toast";
import { useTeamManagement } from "../hooks/useTeamManagement";
import { InvitationCode } from "@/api/teamApi";
import { useAuth } from "@/features/auth/hooks/useAuth";

interface InvitationCodeManagerProps {
  teamId: string;
}

const InvitationCodeManager: React.FC<InvitationCodeManagerProps> = ({
  teamId,
}) => {
  const [codes, setCodes] = useState<InvitationCode[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const { user } = useAuth();
  const { listInvitationCodes, generateInvitationCode, revokeInvitationCode } =
    useTeamManagement();

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    loadInvitationCodes();
  }, [teamId]);

  const loadInvitationCodes = async () => {
    if (!teamId) return;

    try {
      setLoading(true);
      const data = await listInvitationCodes(teamId);
      console.log("Invitation codes:", data); // Log the data structure
      setCodes(data || []);
    } catch (error: any) {
      console.error("Error loading invitation codes:", error);
      toast.error(error.message || "Failed to load invitation codes");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateCode = async (role: "lead" | "member") => {
    if (!teamId) return;

    try {
      setGenerating(true);
      const code = await generateInvitationCode(teamId, role);
      toast.success(
        `${
          role.charAt(0).toUpperCase() + role.slice(1)
        } invitation code generated!`
      );
      loadInvitationCodes();
    } catch (error: any) {
      toast.error(error.message || "Failed to generate invitation code");
    } finally {
      setGenerating(false);
    }
  };

  const handleRevokeCode = async (codeId: string | undefined) => {
    if (!teamId) return;
    if (!codeId) {
      toast.error("Invalid invitation code ID");
      return;
    }

    try {
      console.log("Revoking code:", codeId);
      await revokeInvitationCode(teamId, codeId);
      toast.success("Invitation code revoked");
      loadInvitationCodes();
    } catch (error: any) {
      console.error("Error revoking code:", error);
      toast.error(error.message || "Failed to revoke invitation code");
    }
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Invitation code copied to clipboard");
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  };

  return (
    <div className="bg-gray-900 rounded-lg p-4 mt-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-white flex items-center">
          <FaKey className="mr-2 text-yellow-500" />
          Invitation Codes
        </h3>
        <div className="flex space-x-2">
          <Button
            onClick={() => handleGenerateCode("member")}
            disabled={generating}
            className="bg-blue-600 hover:bg-blue-700 text-sm"
          >
            <FaPlus className="mr-1 h-3 w-3" />
            Member Code
          </Button>
          {isAdmin && (
            <Button
              onClick={() => handleGenerateCode("lead")}
              disabled={generating}
              className="bg-purple-600 hover:bg-purple-700 text-sm"
            >
              <FaPlus className="mr-1 h-3 w-3" />
              Lead Code
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="py-4 flex justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
        </div>
      ) : codes.length === 0 ? (
        <div className="text-center py-4 text-gray-400">
          No active invitation codes. Generate one to invite team members.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="text-xs uppercase text-gray-400 border-b border-gray-800">
              <tr>
                <th className="px-4 py-2">Code</th>
                <th className="px-4 py-2">Role</th>
                <th className="px-4 py-2">Created</th>
                <th className="px-4 py-2">Expires</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {codes.map((code) => (
                <tr key={code._id} className="border-b border-gray-800/30">
                  <td className="px-4 py-3 font-mono text-yellow-500">
                    {code.code}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        code.role === "lead"
                          ? "bg-purple-900 text-purple-200"
                          : "bg-blue-900 text-blue-200"
                      }`}
                    >
                      {code.role === "lead" ? "Team Lead" : "Member"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-sm">
                    {formatDate(code.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-sm">
                    {formatDate(code.expiresAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => copyToClipboard(code.code)}
                        className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
                        title="Copy code"
                      >
                        <FaCopy className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleRevokeCode(code.id || code._id)}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                        title="Revoke code"
                      >
                        <FaTrash className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default InvitationCodeManager;
