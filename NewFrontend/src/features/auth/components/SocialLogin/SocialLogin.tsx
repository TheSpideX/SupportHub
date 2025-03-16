import { FaGoogle, FaGithub, FaLinkedin } from 'react-icons/fa';
import { motion } from 'framer-motion';

interface SocialLoginProps {
  onSocialLogin: (provider: string) => void;
}

export const SocialLogin: React.FC<SocialLoginProps> = ({ onSocialLogin }) => {
  const socialButtons = [
    { provider: 'google', icon: FaGoogle, label: 'Google' },
    { provider: 'github', icon: FaGithub, label: 'GitHub' },
    { provider: 'linkedin', icon: FaLinkedin, label: 'LinkedIn' },
  ];

  return (
    <div className="space-y-4 mt-6">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/10"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-[#0A0A0A] text-gray-400">Or continue with</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {socialButtons.map(({ provider, icon: Icon, label }) => (
          <motion.button
            key={provider}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSocialLogin(provider)}
            className="flex items-center justify-center px-4 py-2 border border-white/10 
                     rounded-lg bg-white/[0.05] hover:bg-white/[0.08] transition-all"
          >
            <Icon className="w-5 h-5 text-gray-400" />
            <span className="sr-only">Sign in with {label}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
};
