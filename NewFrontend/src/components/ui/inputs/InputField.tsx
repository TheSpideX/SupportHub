import { useState } from 'react';
import { motion } from 'framer-motion';
import { FaEye, FaEyeSlash } from 'react-icons/fa';

interface InputFieldProps {
  type: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  icon: React.ReactNode;
  error?: string;
}

export const InputField: React.FC<InputFieldProps> = ({
  type,
  name,
  value,
  onChange,
  placeholder,
  icon,
  error,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div className="space-y-1">
      <div
        className={`relative group ${
          isFocused ? "ring-2 ring-primary-500/30" : ""
        }`}
      >
        <div className="absolute inset-y-0 left-3 flex items-center text-gray-400 group-focus-within:text-primary-400">
          {icon}
        </div>
        <input
          type={type === "password" ? (showPassword ? "text" : "password") : type}
          name={name}
          value={value}
          onChange={onChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className="w-full py-2.5 px-10 rounded-lg bg-white/5 border border-white/10 
                   focus:border-primary-500 focus:ring-1 focus:ring-primary-500
                   transition-all placeholder:text-gray-500"
          placeholder={placeholder}
        />
        {type === "password" && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-300"
          >
            {showPassword ? <FaEyeSlash /> : <FaEye />}
          </button>
        )}
      </div>
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-red-400 text-sm"
        >
          {error}
        </motion.p>
      )}
    </div>
  );
};