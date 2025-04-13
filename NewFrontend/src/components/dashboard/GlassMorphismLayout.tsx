import React, { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface GlassMorphismLayoutProps {
  children: ReactNode;
  className?: string;
}

const GlassMorphismLayout: React.FC<GlassMorphismLayoutProps> = ({ 
  children, 
  className = '' 
}) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-4 md:p-8 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Gradient orbs */}
        <motion.div 
          className="absolute top-[10%] left-[15%] w-[30rem] h-[30rem] rounded-full bg-blue-600/20 blur-[6rem]"
          animate={{
            x: [0, 30, 0],
            y: [0, -30, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div 
          className="absolute bottom-[10%] right-[15%] w-[25rem] h-[25rem] rounded-full bg-purple-600/20 blur-[6rem]"
          animate={{
            x: [0, -20, 0],
            y: [0, 20, 0],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div 
          className="absolute top-[40%] right-[25%] w-[20rem] h-[20rem] rounded-full bg-cyan-600/15 blur-[5rem]"
          animate={{
            x: [0, 25, 0],
            y: [0, 25, 0],
          }}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        
        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiMyMDIwMjAiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0aDR2MWgtNHYtMXptMC0yaDF2NGgtMXYtNHptMi0yaDF2MWgtMXYtMXptLTIgMmgxdjFoLTF2LTF6bS0yLTJoMXYxaC0xdi0xem0yLTJoMXYxaC0xdi0xem0tMiAyaDF2MWgtMXYtMXptLTItMmgxdjFoLTF2LTF6bTggMGgxdjFoLTF2LTF6bS0yIDBoMXYxaC0xdi0xem0tMi0yaDF2MWgtMXYtMXptLTIgMGgxdjFoLTF2LTF6bS0yIDBoMXYxaC0xdi0xem0xMCAwaDJ2MWgtMnYtMXptLTIgMGgxdjFoLTF2LTF6bS04IDBoMXYxaC0xdi0xem0tMiAwaDJ2MWgtMnYtMXptMC0yaDF2MWgtMXYtMXptMTYgMGgxdjFoLTF2LTF6bS0xMiAwaDJ2MWgtMnYtMXptLTQgMGgydjFoLTJ2LTF6bS0yIDBoMXYxaC0xdi0xem04IDBoMnYxaC0ydi0xem0tMi0yaDF2MWgtMXYtMXptLTIgMGgxdjFoLTF2LTF6bS0yIDBoMXYxaC0xdi0xem0tMiAwaDJ2MWgtMnYtMXptLTIgMGgxdjFoLTF2LTF6bTE2IDBoMnYxaC0ydi0xem0tOCAwaDJ2MWgtMnYtMXptLTQgMGgxdjFoLTF2LTF6bTEwIDBoMXYxaC0xdi0xem0yIDBoMXYxaC0xdi0xeiIvPjwvZz48L2c+PC9zdmc+')] opacity-20" />
      </div>
      
      {/* Main content */}
      <div className={`relative z-10 max-w-7xl mx-auto ${className}`}>
        {children}
      </div>
    </div>
  );
};

export default GlassMorphismLayout;
