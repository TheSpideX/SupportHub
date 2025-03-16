import { useState, useEffect } from 'react';
import { UseFormRegister, FieldError, UseFormWatch } from 'react-hook-form';
import { FaEye, FaEyeSlash, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import { RegistrationFormData, getPasswordFeedback, getPasswordStrength } from '../../services/validation.service';

interface PasswordFieldProps {
  name: 'password' | 'confirmPassword';
  label: string;
  register: UseFormRegister<RegistrationFormData>;
  watch: UseFormWatch<RegistrationFormData>;
  error?: FieldError;
  showStrengthMeter?: boolean;
}

export const PasswordField = ({
  name,
  label,
  register,
  watch,
  error,
  showStrengthMeter = false,
}: PasswordFieldProps) => {
  const [showPassword, setShowPassword] = useState(false);
  const [strength, setStrength] = useState({
    score: 0,
    feedback: [] as Array<{ valid: boolean; message: string }>,
  });
  const [currentRequirement, setCurrentRequirement] = useState(0);

  // Watch password changes
  const password = watch(name);

  // Update feedback whenever password changes
  useEffect(() => {
    if (showStrengthMeter && password) {
      const strengthResult = getPasswordStrength(password);
      const feedbackResults = Object.values(getPasswordFeedback(password));
      
      // Find the first unmet requirement
      const firstUnmetIndex = feedbackResults.findIndex(f => !f.valid);
      
      setStrength({
        score: strengthResult.score,
        feedback: feedbackResults,
      });
      
      // If all requirements are met, show the last one, otherwise show the first unmet requirement
      setCurrentRequirement(firstUnmetIndex === -1 ? feedbackResults.length - 1 : firstUnmetIndex);
    }
  }, [password, showStrengthMeter]);

  const getStrengthColor = (score: number) => {
    switch (score) {
      case 0: return 'text-red-500 bg-red-500/20';
      case 1: return 'text-red-500 bg-red-500/20';
      case 2: return 'text-orange-500 bg-orange-500/20';
      case 3: return 'text-yellow-500 bg-yellow-500/20';
      case 4: return 'text-green-500 bg-green-500/20';
      default: return 'text-gray-500 bg-gray-500/20';
    }
  };

  const getStrengthLabel = (score: number) => {
    switch (score) {
      case 0: return 'Very Weak';
      case 1: return 'Weak';
      case 2: return 'Fair';
      case 3: return 'Strong';
      case 4: return 'Very Strong';
      default: return 'None';
    }
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <label className="block text-sm font-medium text-gray-200 mb-1">
          {label}
        </label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            className={`w-full px-4 py-2.5 bg-gray-900/60 border rounded-lg focus:ring-2 
              ${error ? 'border-red-500 focus:ring-red-500' : 'border-gray-700 focus:ring-primary-500'}
              text-white placeholder-gray-400`}
            {...register(name)}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
          >
            {showPassword ? <FaEyeSlash /> : <FaEye />}
          </button>
        </div>
        {error && (
          <p className="mt-1 text-sm text-red-500">{error.message}</p>
        )}
      </div>

      {showStrengthMeter && password && strength.feedback.length > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-400">Password Strength:</span>
            <span className={`font-medium ${getStrengthColor(strength.score)}`}>
              {getStrengthLabel(strength.score)}
            </span>
          </div>
          
          <div className="flex space-x-1">
            {[0, 1, 2, 3, 4].map((index) => (
              <div
                key={index}
                className={`h-1 w-full rounded-full transition-all duration-300 ${
                  index <= strength.score ? getStrengthColor(strength.score) : 'bg-gray-700'
                }`}
              />
            ))}
          </div>

          {/* Show current requirement */}
          <div 
            className="flex items-center space-x-2 text-sm p-2 rounded-lg border border-gray-700 bg-gray-800/50"
            key={currentRequirement}
          >
            {strength.feedback[currentRequirement]?.valid ? (
              <FaCheckCircle className="text-green-500 flex-shrink-0" />
            ) : (
              <FaTimesCircle className="text-red-500 flex-shrink-0" />
            )}
            <span 
              className={
                strength.feedback[currentRequirement]?.valid 
                  ? 'text-green-400' 
                  : 'text-red-400'
              }
            >
              {strength.feedback[currentRequirement]?.message}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
