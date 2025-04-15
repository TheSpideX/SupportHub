import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  FaArrowLeft,
  FaArrowRight,
  FaBuilding,
  FaUsers,
  FaUser,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/buttons/Button";
import { useDispatch } from "react-redux";
import type { RegistrationFormData } from "../../types/auth.types";
import { registrationSchema } from "../../services/validation.service";
import { useAuth } from "../../hooks/useAuth";
import { logger } from "@/utils/logger";
import { inviteCodeApi } from "@/api/inviteCodeApi";

interface RegistrationFormProps {
  type: "customer" | "organization" | "organization_member";
  onBack: () => void;
}

export const RegistrationForm = ({ type, onBack }: RegistrationFormProps) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { register: registerUser, loginWithRegistrationData } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);
  const [organizationTypes, setOrganizationTypes] = useState([
    { value: "business", label: "Business" },
    { value: "educational", label: "Educational" },
    { value: "nonprofit", label: "Non-Profit" },
    { value: "government", label: "Government" },
    { value: "other", label: "Other" },
  ]);
  const [isValidatingCode, setIsValidatingCode] = useState(false);
  const [inviteCodeInfo, setInviteCodeInfo] = useState<any>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegistrationFormData>({
    resolver: zodResolver(registrationSchema),
    mode: "onChange",
    defaultValues: {
      type,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  });

  // Validate invite code when it changes
  useEffect(() => {
    const inviteCode = watch("inviteCode");
    if (
      type === "organization_member" &&
      inviteCode &&
      inviteCode.length >= 6
    ) {
      validateInviteCode(inviteCode);
    }
  }, [watch("inviteCode")]);

  // Validate invite code
  const validateInviteCode = async (code: string) => {
    if (!code || code.length < 6) return;

    setIsValidatingCode(true);
    try {
      // Call the API to validate the invite code
      const response = await inviteCodeApi.validate(code);

      if (response.isValid) {
        setInviteCodeInfo(response);
        toast.success("Valid invitation code");
      } else {
        setInviteCodeInfo(null);
        toast.error(response.message || "Invalid invitation code");
      }
    } catch (error: any) {
      setInviteCodeInfo(null);
      toast.error(error.message || "Invalid invitation code");
    } finally {
      setIsValidatingCode(false);
    }
  };

  const onSubmit = async (data: RegistrationFormData) => {
    setIsLoading(true);
    try {
      // Map form data to registration data based on type
      const registrationData = {
        ...data,
        type:
          type === "company"
            ? "organization"
            : type === "company_employee"
            ? "organization_member"
            : type,
        // Add device info
        deviceInfo: {
          userAgent: navigator.userAgent,
          fingerprint: `browser-${Math.random().toString(36).substring(2, 15)}`,
        },
      };

      // Ensure organizationName is explicitly set for organization type
      if (registrationData.type === "organization" && data.organizationName) {
        // Make sure organizationName is explicitly set at the top level
        registrationData.organizationName = data.organizationName;
      }

      // Log the full registration data for debugging
      logger.info(`Registering user with type: ${type}`, {
        email: data.email,
        type: registrationData.type,
        hasOrgName: !!data.organizationName,
        orgName: data.organizationName,
        formData: JSON.stringify(data),
        registrationData: JSON.stringify(registrationData),
      });

      // Call the registration API
      const result = await registerUser(registrationData);

      // Check if registration was successful
      if (result && result.success) {
        logger.debug("Registration result:", result);
        toast.success("Registration successful! Redirecting to dashboard...");

        // Wait a moment for any backend processing to complete
        await new Promise((resolve) => setTimeout(resolve, 1000));

        try {
          // Try to auto-login with registration data
          const loginResult = await loginWithRegistrationData();
          logger.debug("Auto-login result:", loginResult);

          // If auto-login successful, redirect to dashboard
          if (loginResult) {
            // Determine user role from result or registration data
            const userData = result.userData || {};
            const role =
              userData.role || (result.data && result.data.role) || "member";

            logger.info(
              `Auto-login successful, redirecting user with role: ${role}`
            );

            // Redirect to the dashboard - the dashboard component will show the appropriate view based on role
            navigate("/dashboard");
          } else {
            // Fallback to login if auto-login fails
            logger.warn("Auto-login failed, redirecting to login page");
            toast.success(
              "Registration successful! Please log in with your new account"
            );
            navigate("/auth/login");
          }
        } catch (loginError) {
          logger.error("Error during auto-login:", loginError);
          toast.success(
            "Registration successful! Please log in with your new account"
          );
          navigate("/auth/login");
        }
      } else {
        // Handle unsuccessful registration
        if (result && !result.success && result.error) {
          logger.warn("Registration failed with error:", result.error);

          // Display appropriate error message
          if (result.error.code === "RATE_LIMITED") {
            toast.error(
              "Too many registration attempts. Please try again later."
            );
          } else if (result.error.code === "EMAIL_IN_USE") {
            toast.error(
              "Email is already in use. Please use a different email."
            );
            setError("email", {
              type: "manual",
              message: "Email is already in use",
            });
          } else {
            toast.error(
              result.error.message || "Registration failed. Please try again."
            );
          }
        } else {
          // Generic error
          logger.warn("Registration returned unsuccessful result", result);
          toast.error("Registration failed. Please try again.");
        }
      }
    } catch (error: any) {
      logger.error("Registration error:", error);

      // Extract error details
      const errorCode =
        error.code || error.response?.data?.code || "UNKNOWN_ERROR";
      const errorMessage =
        error.message ||
        error.response?.data?.message ||
        "Registration failed. Please try again.";

      logger.debug("Registration error details:", {
        errorCode,
        errorMessage,
        error,
      });

      if (error.response?.status === 429) {
        setRateLimitError(
          error.response.data.message ||
            "Too many attempts. Please try again later."
        );
      } else if (errorCode === "EMAIL_IN_USE") {
        toast.error("Email is already in use. Please use a different email.");
        setError("email", {
          type: "manual",
          message: "Email is already in use",
        });
      } else if (errorCode === "INVALID_INVITE_CODE") {
        toast.error("Invalid invitation code. Please check and try again.");
        setError("inviteCode", {
          type: "manual",
          message: "Invalid invitation code",
        });
      } else if (error.response?.data?.message) {
        // Use the server's error message if available
        toast.error(error.response.data.message);
      } else {
        // Fallback to the error object's message
        toast.error(errorMessage);
      }
    } finally {
      setIsLoading(false);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4 mb-8">
        <button
          type="button"
          onClick={onBack}
          className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
        >
          <FaArrowLeft className="w-5 h-5 text-gray-300" />
        </button>
        <h2 className="text-2xl font-bold text-white">
          {type === "customer" && "Register as Customer"}
          {type === "organization" && "Create New Organization"}
          {type === "organization_member" && "Join Existing Organization"}
        </h2>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {rateLimitError && (
          <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-md">
            {rateLimitError}
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-200 mb-1">
              First Name
            </label>
            <input
              type="text"
              {...register("firstName", { required: "First name is required" })}
              className="w-full px-4 py-2.5 bg-gray-900/60 border border-gray-700 rounded-lg
                       text-white placeholder-gray-400 focus:outline-none focus:ring-2
                       focus:ring-primary-500 focus:border-transparent"
              placeholder="John"
            />
            {errors.firstName && (
              <p className="mt-1 text-sm text-red-400">
                {errors.firstName.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-200 mb-1">
              Last Name
            </label>
            <input
              type="text"
              {...register("lastName", { required: "Last name is required" })}
              className="w-full px-4 py-2.5 bg-gray-900/60 border border-gray-700 rounded-lg
                       text-white placeholder-gray-400 focus:outline-none focus:ring-2
                       focus:ring-primary-500 focus:border-transparent"
              placeholder="Doe"
            />
            {errors.lastName && (
              <p className="mt-1 text-sm text-red-400">
                {errors.lastName.message}
              </p>
            )}
          </div>
        </div>

        {type === "organization" && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-200 mb-1">
                Organization Name
              </label>
              <input
                type="text"
                {...register("organizationName", {
                  required: "Organization name is required",
                })}
                className="w-full px-4 py-2.5 bg-gray-900/60 border border-gray-700 rounded-lg
                         text-white placeholder-gray-400 focus:outline-none focus:ring-2
                         focus:ring-primary-500 focus:border-transparent"
                placeholder="Organization Name"
              />
              {errors.organizationName && (
                <p className="mt-1 text-sm text-red-400">
                  {errors.organizationName.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-200 mb-1">
                Organization Type
              </label>
              <select
                {...register("organizationType", {
                  required: "Organization type is required",
                })}
                className="w-full px-4 py-2.5 bg-gray-900/60 border border-gray-700 rounded-lg
                         text-white placeholder-gray-400 focus:outline-none focus:ring-2
                         focus:ring-primary-500 focus:border-transparent"
              >
                <option value="" disabled>
                  Select organization type
                </option>
                {organizationTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              {errors.organizationType && (
                <p className="mt-1 text-sm text-red-400">
                  {errors.organizationType.message}
                </p>
              )}
            </div>
          </>
        )}

        {type === "organization_member" && (
          <div>
            <label className="block text-sm font-medium text-gray-200 mb-1">
              Invitation Code
            </label>
            <div className="relative">
              <input
                type="text"
                {...register("inviteCode", {
                  required: "Invitation code is required",
                  minLength: {
                    value: 6,
                    message: "Invitation code must be at least 6 characters",
                  },
                })}
                className="w-full px-4 py-2.5 bg-gray-900/60 border border-gray-700 rounded-lg
                         text-white placeholder-gray-400 focus:outline-none focus:ring-2
                         focus:ring-primary-500 focus:border-transparent"
                placeholder="Enter your invitation code"
              />
              {isValidatingCode && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="w-5 h-5 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
                </div>
              )}
            </div>
            {errors.inviteCode && (
              <p className="mt-1 text-sm text-red-400">
                {errors.inviteCode.message}
              </p>
            )}

            {inviteCodeInfo && (
              <div className="mt-2 p-3 bg-gray-800/50 border border-gray-700 rounded-lg">
                <p className="text-sm text-green-400 mb-1">
                  Valid invitation code
                </p>
                <p className="text-xs text-gray-300">
                  Organization: {inviteCodeInfo.organization.name}
                </p>
                {inviteCodeInfo.team && (
                  <p className="text-xs text-gray-300">
                    Team: {inviteCodeInfo.team.name}
                  </p>
                )}
                <p className="text-xs text-gray-300">
                  Role:{" "}
                  {inviteCodeInfo.role === "team_lead"
                    ? "Team Lead"
                    : "Team Member"}
                </p>
              </div>
            )}
          </div>
        )}

        {type === "customer" && (
          <div>
            <label className="block text-sm font-medium text-gray-200 mb-1">
              Organization ID
            </label>
            <input
              type="text"
              {...register("orgId", {
                required: "Organization ID is required",
                pattern: {
                  value: /^ORG-[A-Z0-9]{5}$/,
                  message: "Invalid organization ID format (e.g. ORG-ABC12)",
                },
              })}
              className="w-full px-4 py-2.5 bg-gray-900/60 border border-gray-700 rounded-lg
                       text-white placeholder-gray-400 focus:outline-none focus:ring-2
                       focus:ring-primary-500 focus:border-transparent"
              placeholder="ORG-XXXXX"
            />
            {errors.orgId && (
              <p className="mt-1 text-sm text-red-400">
                {errors.orgId.message}
              </p>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-200 mb-1">
            Email Address
          </label>
          <input
            type="email"
            {...register("email", {
              required: "Email is required",
              pattern: {
                value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                message: "Invalid email address",
              },
            })}
            className="w-full px-4 py-2.5 bg-gray-900/60 border border-gray-700 rounded-lg
                     text-white placeholder-gray-400 focus:outline-none focus:ring-2
                     focus:ring-primary-500 focus:border-transparent"
            placeholder="john@example.com"
          />
          {errors.email && (
            <p className="mt-1 text-sm text-red-400">{errors.email.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-200 mb-1">
            Password
          </label>
          <input
            type="password"
            {...register("password", {
              required: "Password is required",
              minLength: {
                value: 8,
                message: "Password must be at least 8 characters",
              },
            })}
            className="w-full px-4 py-2.5 bg-gray-900/60 border border-gray-700 rounded-lg
                     text-white placeholder-gray-400 focus:outline-none focus:ring-2
                     focus:ring-primary-500 focus:border-transparent"
            placeholder="••••••••"
          />
          {errors.password && (
            <p className="mt-1 text-sm text-red-400">
              {errors.password.message}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-200 mb-1">
            Confirm Password
          </label>
          <input
            type="password"
            {...register("confirmPassword", {
              required: "Please confirm your password",
              validate: (val: string) => {
                if (watch("password") !== val) {
                  return "Passwords do not match";
                }
              },
            })}
            className="w-full px-4 py-2.5 bg-gray-900/60 border border-gray-700 rounded-lg
                     text-white placeholder-gray-400 focus:outline-none focus:ring-2
                     focus:ring-primary-500 focus:border-transparent"
            placeholder="••••••••"
          />
          {errors.confirmPassword && (
            <p className="mt-1 text-sm text-red-400">
              {errors.confirmPassword.message}
            </p>
          )}
        </div>

        <Button
          type="submit"
          className="w-full px-4 py-3 bg-gradient-to-r from-primary-500 to-primary-600
                   hover:from-primary-600 hover:to-primary-700 text-white font-medium
                   rounded-lg transform transition-all duration-200
                   hover:scale-[1.02] active:scale-[0.98]"
          disabled={isLoading}
        >
          <div className="flex items-center justify-center space-x-2">
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>Create Account</span>
                <FaArrowRight className="w-4 h-4" />
              </>
            )}
          </div>
        </Button>

        <div className="text-center">
          <Button
            variant="link"
            type="button"
            onClick={() => navigate("/auth/login")}
            className="text-primary-400 hover:text-primary-300"
          >
            Already have an account? Sign In
          </Button>
        </div>
      </form>
    </div>
  );
};
