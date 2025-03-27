import React from 'react';
import { Link } from 'react-router-dom';
import { FaGithub, FaTwitter, FaLinkedin, FaHeart } from 'react-icons/fa';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="bg-gradient-to-r from-gray-900 to-gray-800 border-t border-gray-700/50 shadow-lg">
      <div className="max-w-7xl mx-auto py-5 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center">
          {/* Logo and copyright */}
          <div className="flex items-center mb-4 md:mb-0 group">
            <Link to="/dashboard" className="flex items-center transition-transform duration-300 hover:scale-105">
              <img src="/logo.svg" alt="Support Hub" className="h-6 w-auto drop-shadow-md" />
              <span className="ml-2 text-lg font-bold text-white bg-clip-text bg-gradient-to-r from-white to-gray-300">Support Hub</span>
            </Link>
            <span className="ml-4 text-sm text-gray-400 opacity-80">
              &copy; {currentYear} All rights reserved
            </span>
          </div>
          
          {/* Quick links */}
          <div className="flex space-x-6 mb-4 md:mb-0">
            <Link to="/help" className="text-sm text-gray-400 hover:text-white hover:underline transition-all duration-200 transform hover:-translate-y-0.5">
              Help Center
            </Link>
            <Link to="/privacy" className="text-sm text-gray-400 hover:text-white hover:underline transition-all duration-200 transform hover:-translate-y-0.5">
              Privacy
            </Link>
            <Link to="/terms" className="text-sm text-gray-400 hover:text-white hover:underline transition-all duration-200 transform hover:-translate-y-0.5">
              Terms
            </Link>
            <Link to="/contact" className="text-sm text-gray-400 hover:text-white hover:underline transition-all duration-200 transform hover:-translate-y-0.5">
              Contact
            </Link>
          </div>
          
          {/* Version and status */}
          <div className="flex items-center text-sm text-gray-400 bg-gray-800/50 px-3 py-1.5 rounded-full shadow-inner">
            <span className="mr-2 font-mono">v1.0.0</span>
            <span className="flex items-center">
              <span className="h-2 w-2 bg-green-500 rounded-full mr-1 animate-pulse shadow-sm shadow-green-400/50"></span>
              <span className="text-gray-300">All systems operational</span>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
