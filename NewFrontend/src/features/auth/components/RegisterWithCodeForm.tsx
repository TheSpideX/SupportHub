import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/buttons/Button";
import { FaKey, FaUser, FaEnvelope, FaLock, FaSpinner } from "react-icons/fa";
import { toast } from "react-hot-toast";
import { useAuth } from "../hooks/useAuth";
import { inviteCodeApi } from "@/api/inviteCodeApi";

interface RegisterWithCodeFormProps {
  invitationCode?: string;
}

const RegisterWithCodeForm: React.FC<RegisterWithCodeFormProps> = ({
  invitationCode: propCode,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { register } = useAuth();

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    invitationCode: propCode || "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [codeInfo, setCodeInfo] = useState<{
    teamId: string;
    teamName: string;
    teamType: "technical" | "support";
    role: "lead" | "member";
    organizationId?: string;
    organizationName?: string;
    metadata?: {
      organizationId: string;
      organizationName: string;
      teamId: string;
      teamName: string;
      teamType: string;
      position: string;
    };
  } | null>(null);

  // Extract code from URL if present
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const codeFromUrl = params.get("code");

    if (codeFromUrl && !propCode) {
      setFormData((prev) => ({ ...prev, invitationCode: codeFromUrl }));
      validateInvitationCode(codeFromUrl);
    } else if (propCode) {
      validateInvitationCode(propCode);
    }
  }, [location.search, propCode]);

  const validateInvitationCode = async (code: string) => {
    if (!code) return;

    try {
      setIsValidating(true);
      const response = await inviteCodeApi.validate(code);

      if (response.isValid) {
        // Format the response to match what the component expects
        const teamInfo = {
          teamId: response.teamId || response.team?.id || "",
          teamName: response.teamName || response.team?.name || "Unknown Team",
          teamType: response.teamType || response.team?.type || "support",
          role: response.role || response.inviteCode?.role || "member",
          organizationId:
            response.organizationId || response.organization?.id || "",
          organizationName:
            response.organizationName ||
            response.organization?.name ||
            "Unknown Organization",
          metadata: response.metadata,
        };

        setCodeInfo(teamInfo);
        const orgInfo = teamInfo.organizationName
          ? ` for ${teamInfo.organizationName}`
          : "";
        toast.success(
          `Valid invitation code for ${teamInfo.teamName}${orgInfo}`
        );
      } else {
        toast.error(response.message || "Invalid invitation code");
        setCodeInfo(null);
      }
    } catch (error: any) {
      console.error("Error validating invitation code:", error);
      toast.error(error.message || "Invalid invitation code");
      setCodeInfo(null);
    } finally {
      setIsValidating(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Clear error when user types
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }

    // Validate invitation code when it's entered
    if (name === "invitationCode" && value.length === 6) {
      validateInvitationCode(value);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = "First name is required";
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = "Last name is required";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Email is invalid";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    if (!formData.invitationCode.trim()) {
      newErrors.invitationCode = "Invitation code is required";
    } else if (!codeInfo) {
      newErrors.invitationCode = "Invalid invitation code";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      setIsLoading(true);

      await register({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        password: formData.password,
        invitationCode: formData.invitationCode,
      });

      toast.success("Registration successful! You can now log in.");
      navigate("/login");
    } catch (error: any) {
      toast.error(error.message || "Registration failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md p-6 bg-gray-800 rounded-lg shadow-md">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white">
          Register with Invitation Code
        </h2>
        {codeInfo && (
          <div className="mt-2 p-2 bg-gray-700 rounded text-sm">
            <p className="text-gray-300">
              Joining{" "}
              <span className="font-medium text-white">
                {codeInfo.teamName}
              </span>
            </p>
            <p className="text-gray-400">
              Role:{" "}
              <span
                className={`font-medium ${
                  codeInfo.role === "lead" ? "text-yellow-400" : "text-blue-400"
                }`}
              >
                {codeInfo.role === "lead" ? "Team Lead" : "Team Member"}
              </span>
            </p>
            <p className="text-gray-400">
              Team Type:{" "}
              <span
                className={`font-medium ${
                  codeInfo.teamType === "technical"
                    ? "text-purple-400"
                    : "text-green-400"
                }`}
              >
                {codeInfo.teamType === "technical"
                  ? "Technical Team"
                  : "Support Team"}
              </span>
            </p>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="firstName"
              className="block text-sm font-medium text-gray-300 mb-1"
            >
              First Name
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FaUser className="h-4 w-4 text-gray-400" />
              </div>
              <Input
                id="firstName"
                name="firstName"
                type="text"
                value={formData.firstName}
                onChange={handleChange}
                className={`pl-10 bg-gray-700 border-gray-600 ${
                  errors.firstName ? "border-red-500" : ""
                }`}
                placeholder="John"
              />
            </div>
            {errors.firstName && (
              <p className="mt-1 text-sm text-red-500">{errors.firstName}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="lastName"
              className="block text-sm font-medium text-gray-300 mb-1"
            >
              Last Name
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FaUser className="h-4 w-4 text-gray-400" />
              </div>
              <Input
                id="lastName"
                name="lastName"
                type="text"
                value={formData.lastName}
                onChange={handleChange}
                className={`pl-10 bg-gray-700 border-gray-600 ${
                  errors.lastName ? "border-red-500" : ""
                }`}
                placeholder="Doe"
              />
            </div>
            {errors.lastName && (
              <p className="mt-1 text-sm text-red-500">{errors.lastName}</p>
            )}
          </div>
        </div>

        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-300 mb-1"
          >
            Email Address
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FaEnvelope className="h-4 w-4 text-gray-400" />
            </div>
            <Input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              className={`pl-10 bg-gray-700 border-gray-600 ${
                errors.email ? "border-red-500" : ""
              }`}
              placeholder="john.doe@example.com"
            />
          </div>
          {errors.email && (
            <p className="mt-1 text-sm text-red-500">{errors.email}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-gray-300 mb-1"
          >
            Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FaLock className="h-4 w-4 text-gray-400" />
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              className={`pl-10 bg-gray-700 border-gray-600 ${
                errors.password ? "border-red-500" : ""
              }`}
              placeholder="********"
            />
          </div>
          {errors.password && (
            <p className="mt-1 text-sm text-red-500">{errors.password}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-sm font-medium text-gray-300 mb-1"
          >
            Confirm Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FaLock className="h-4 w-4 text-gray-400" />
            </div>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={handleChange}
              className={`pl-10 bg-gray-700 border-gray-600 ${
                errors.confirmPassword ? "border-red-500" : ""
              }`}
              placeholder="********"
            />
          </div>
          {errors.confirmPassword && (
            <p className="mt-1 text-sm text-red-500">
              {errors.confirmPassword}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="invitationCode"
            className="block text-sm font-medium text-gray-300 mb-1"
          >
            Invitation Code
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FaKey className="h-4 w-4 text-gray-400" />
            </div>
            <Input
              id="invitationCode"
              name="invitationCode"
              type="text"
              value={formData.invitationCode}
              onChange={handleChange}
              className={`pl-10 bg-gray-700 border-gray-600 ${
                errors.invitationCode ? "border-red-500" : ""
              }`}
              placeholder="Enter your invitation code"
            />
            {isValidating && (
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                <FaSpinner className="h-4 w-4 text-blue-500 animate-spin" />
              </div>
            )}
          </div>
          {errors.invitationCode && (
            <p className="mt-1 text-sm text-red-500">{errors.invitationCode}</p>
          )}

          {codeInfo && (
            <div className="mt-2 p-3 bg-gray-800/50 border border-gray-700 rounded-lg">
              <p className="text-sm text-green-400 mb-1">
                Valid invitation code
              </p>
              <p className="text-xs text-gray-300">
                Organization: {codeInfo.organizationName || "Unknown"}
              </p>
              <p className="text-xs text-gray-300">Team: {codeInfo.teamName}</p>
              <p className="text-xs text-gray-300">
                Team Type:{" "}
                {codeInfo.teamType === "technical" ? "Technical" : "Support"}
              </p>
              <p className="text-xs text-gray-300">
                Role: {codeInfo.role === "lead" ? "Team Lead" : "Team Member"}
              </p>
            </div>
          )}
        </div>

        <Button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 flex items-center justify-center"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <FaSpinner className="animate-spin mr-2 h-4 w-4" />
              Registering...
            </>
          ) : (
            "Register"
          )}
        </Button>

        <div className="text-center mt-4">
          <p className="text-sm text-gray-400">
            Already have an account?{" "}
            <a href="/login" className="text-blue-400 hover:text-blue-300">
              Log in
            </a>
          </p>
        </div>
      </form>
    </div>
  );
};

export default RegisterWithCodeForm;
