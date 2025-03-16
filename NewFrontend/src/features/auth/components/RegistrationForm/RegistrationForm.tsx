import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { FaArrowLeft, FaArrowRight } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/buttons/Button";
import { useDispatch } from "react-redux";
import { authService } from "../../services/auth.service";
import { setCredentials } from "../../store/authSlice";
import { hashPassword } from "../../utils/passwordUtils";
import type { RegistrationFormData } from "../../types";
import { registrationSchema } from "../../services/validation.service";
import { AuthError } from "../../errors/auth-error";

interface RegistrationFormProps {
  type: "customer" | "company" | "company_employee";
  onBack: () => void;
}

export const RegistrationForm = ({ type, onBack }: RegistrationFormProps) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [isLoading, setIsLoading] = useState(false);
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);

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

  const onSubmit = async (data: RegistrationFormData) => {
    const toastId = toast.loading("Creating your account...", {
      duration: 10000,
    });

    try {
      setIsLoading(true);
      setRateLimitError(null);

      if (type === "company_employee") {
        const inviteVerification = await authService.verifyInviteCode(
          data.inviteCode!
        );
        if (!inviteVerification.isValid) {
          throw new AuthError(
            "INVALID_INVITE",
            inviteVerification.error || "Invalid invite code"
          );
        }
      }

      // Frontend validation for password match
      if (data.password !== data.confirmPassword) {
        throw new AuthError("PASSWORD_MISMATCH", "Passwords do not match");
      }

      // Remove confirmPassword before sending to server
      const { confirmPassword, ...registrationData } = data;

      // Hash password before sending
      const response = await authService.register({
        ...registrationData,
        password: hashPassword(registrationData.password),
      });

      toast.success("Account created successfully!");

      if (response.requiresTwoFactor) {
        navigate("/auth/two-factor", {
          state: { twoFactorToken: response.twoFactorToken },
        });
        return;
      }

      dispatch(
        setCredentials({
          user: response.user,
          tokens: response.tokens,
        })
      );

      navigate(authService.getRoleBasedRedirect(response.user.role));
    } catch (error) {
      if (error instanceof AuthError && error.code === "RATE_LIMIT_EXCEEDED") {
        setRateLimitError(error.message);
        toast.error(error.message);
      } else {
        toast.error("Failed to create account. Please try again.");
      }
    } finally {
      setIsLoading(false);
      toast.dismiss(toastId);
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
          {type === "company" && "Create New Company"}
          {type === "company_employee" && "Join Existing Company"}
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

        {type === "company" && (
          <div>
            <label className="block text-sm font-medium text-gray-200 mb-1">
              Company Name
            </label>
            <input
              type="text"
              {...register("companyName", {
                required: "Company name is required",
              })}
              className="w-full px-4 py-2.5 bg-gray-900/60 border border-gray-700 rounded-lg 
                       text-white placeholder-gray-400 focus:outline-none focus:ring-2 
                       focus:ring-primary-500 focus:border-transparent"
              placeholder="Company Name"
            />
            {errors.companyName && (
              <p className="mt-1 text-sm text-red-400">
                {errors.companyName.message}
              </p>
            )}
          </div>
        )}

        {type === "company_employee" && (
          <div>
            <label className="block text-sm font-medium text-gray-200 mb-1">
              Invite Code
            </label>
            <input
              type="text"
              {...register("inviteCode", {
                required: "Invite code is required",
              })}
              className="w-full px-4 py-2.5 bg-gray-900/60 border border-gray-700 rounded-lg 
                       text-white placeholder-gray-400 focus:outline-none focus:ring-2 
                       focus:ring-primary-500 focus:border-transparent"
              placeholder="Enter your invite code"
            />
            {errors.inviteCode && (
              <p className="mt-1 text-sm text-red-400">
                {errors.inviteCode.message}
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
