import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, checked, onChange, ...props }, ref) => {
    return (
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <div className="relative">
          <input
            type="checkbox"
            ref={ref}
            checked={checked}
            onChange={onChange}
            className="sr-only"
            {...props}
          />
          <motion.div
            className={cn(
              "w-5 h-5 rounded-md border-2 flex items-center justify-center",
              checked 
                ? "bg-primary border-primary" 
                : "border-white/20 bg-white/5",
              className
            )}
            animate={{
              scale: checked ? 1 : 0.95,
              opacity: checked ? 1 : 0.7,
            }}
          >
            {checked && (
              <motion.svg
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-3 h-3 text-white"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </motion.svg>
            )}
          </motion.div>
        </div>
        {label && (
          <span className="text-sm text-gray-300">{label}</span>
        )}
      </label>
    );
  }
);

Checkbox.displayName = 'Checkbox';