import { motion } from "framer-motion";

interface LoadingScreenProps {
  message?: string;
}

const LoadingScreen = ({ message = "Loading..." }: LoadingScreenProps) => {
  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      {/* Background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-primary-600/20 to-transparent rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-br from-secondary-600/20 to-transparent rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="relative z-10 max-w-md w-full">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="bg-gray-900/70 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-gray-800"
        >
          <div className="flex flex-col items-center justify-center space-y-6">
            <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-xl flex items-center justify-center">
              <span className="text-2xl font-bold text-white">SH</span>
            </div>
            
            <div className="flex flex-col items-center space-y-4">
              <div className="w-12 h-12 border-t-2 border-primary-500 rounded-full animate-spin"></div>
              <h2 className="text-xl font-semibold text-white">{message}</h2>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default LoadingScreen;