import React from 'react';
import { useLocation } from 'react-router-dom';
import RegisterWithCodeForm from '@/features/auth/components/RegisterWithCodeForm';
import { FaKey } from 'react-icons/fa';

const RegisterWithCodePage: React.FC = () => {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const invitationCode = params.get('code') || undefined;

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col justify-center items-center px-4 py-12">
      <div className="mb-8 text-center">
        <div className="flex justify-center mb-4">
          <div className="h-16 w-16 rounded-full bg-blue-900 flex items-center justify-center">
            <FaKey className="h-8 w-8 text-blue-300" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-white">Join Your Team</h1>
        <p className="mt-2 text-gray-400">
          Register with your invitation code to join your team
        </p>
      </div>
      
      <RegisterWithCodeForm invitationCode={invitationCode} />
      
      <div className="mt-8 text-center text-sm text-gray-500">
        <p>
          By registering, you agree to our{' '}
          <a href="#" className="text-blue-400 hover:text-blue-300">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href="#" className="text-blue-400 hover:text-blue-300">
            Privacy Policy
          </a>
        </p>
      </div>
    </div>
  );
};

export default RegisterWithCodePage;
