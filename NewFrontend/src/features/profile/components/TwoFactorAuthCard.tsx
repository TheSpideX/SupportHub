import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaFingerprint,
  FaShieldAlt,
  FaExclamationTriangle,
  FaMobileAlt,
  FaKey,
  FaCheck,
  FaSync,
} from 'react-icons/fa';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/buttons/Button';
import { Switch } from '@headlessui/react';
import { Input } from '@/components/ui/input';

interface TwoFactorAuthCardProps {
  enabled: boolean;
  qrCode: string | null;
  secret: string | null;
  isLoading: boolean;
  error: Error | null;
  onEnable: () => Promise<void>;
  onVerify: (token: string) => Promise<boolean>;
  onDisable: (token: string) => Promise<boolean>;
}

const TwoFactorAuthCard: React.FC<TwoFactorAuthCardProps> = ({
  enabled,
  qrCode,
  secret,
  isLoading,
  error,
  onEnable,
  onVerify,
  onDisable,
}) => {
  const [verificationToken, setVerificationToken] = useState('');
  const [disableToken, setDisableToken] = useState('');
  const [showDisableForm, setShowDisableForm] = useState(false);

  const handleToggle = () => {
    if (!enabled) {
      onEnable();
    } else {
      setShowDisableForm(true);
    }
  };

  const handleVerify = async () => {
    if (!verificationToken) return;
    await onVerify(verificationToken);
    setVerificationToken('');
  };

  const handleDisable = async () => {
    if (!disableToken) return;
    const success = await onDisable(disableToken);
    if (success) {
      setShowDisableForm(false);
      setDisableToken('');
    }
  };

  return (
    <Card className="bg-white/5 backdrop-blur-sm border border-white/10 shadow-xl overflow-hidden transition-all duration-300 hover:border-white/20">
      <CardHeader className="bg-gradient-to-r from-indigo-900/50 to-purple-900/50 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="p-2 bg-indigo-900/50 rounded-lg mr-2">
              <FaFingerprint className="h-5 w-5 text-indigo-400" />
            </div>
            <div>
              <CardTitle className="text-xl font-semibold text-white">
                Two-Factor Authentication
              </CardTitle>
              <CardDescription className="text-gray-400 mt-1">
                Add an extra layer of security to your account
              </CardDescription>
            </div>
          </div>
          <Switch
            checked={enabled}
            onChange={handleToggle}
            disabled={isLoading || !!qrCode}
            className={`${
              enabled ? "bg-blue-600" : "bg-gray-600"
            } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900`}
          >
            <span className="sr-only">
              Enable two-factor authentication
            </span>
            <span
              className={`${
                enabled
                  ? "translate-x-6"
                  : "translate-x-1"
              } inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ease-in-out`}
            />
          </Switch>
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="bg-red-900/20 p-4 rounded-lg border border-red-800/50 mb-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0 pt-0.5">
                    <FaExclamationTriangle className="h-5 w-5 text-red-400" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-200 font-medium">
                      Error with two-factor authentication
                    </p>
                    <p className="mt-1 text-xs text-red-300/80">
                      {error.message || 'An error occurred with two-factor authentication. Please try again.'}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {enabled && !showDisableForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="bg-blue-900/20 p-4 rounded-lg border border-blue-800/50 mb-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0 pt-0.5">
                    <FaShieldAlt className="h-5 w-5 text-blue-400" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-blue-200 font-medium">
                      Two-factor authentication is enabled
                    </p>
                    <p className="mt-1 text-xs text-blue-300">
                      Your account is now protected with an
                      additional layer of security. You'll be
                      asked for a verification code when signing
                      in from new devices.
                    </p>
                    <div className="mt-3 space-y-3">
                      <div className="flex flex-wrap gap-3">
                        <Button
                          size="sm"
                          className="bg-blue-700/50 hover:bg-blue-700/70 text-white text-xs"
                        >
                          <FaMobileAlt className="mr-1 h-3 w-3" />
                          Configure Authenticator App
                        </Button>
                        <Button
                          size="sm"
                          className="bg-purple-700/50 hover:bg-purple-700/70 text-white text-xs"
                        >
                          <FaKey className="mr-1 h-3 w-3" />
                          Generate Backup Codes
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {showDisableForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="bg-red-900/20 p-4 rounded-lg border border-red-800/50 mb-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0 pt-0.5">
                    <FaExclamationTriangle className="h-5 w-5 text-red-400" />
                  </div>
                  <div className="ml-3 w-full">
                    <p className="text-sm text-red-200 font-medium">
                      Disable two-factor authentication
                    </p>
                    <p className="mt-1 text-xs text-red-300/80 mb-3">
                      This will reduce the security of your account. Enter your authenticator code to confirm.
                    </p>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        value={disableToken}
                        onChange={(e) => setDisableToken(e.target.value)}
                        placeholder="Enter verification code"
                        className="bg-red-900/30 border-red-800/50 text-white"
                      />
                      <Button
                        size="sm"
                        className="bg-red-600/70 hover:bg-red-600 text-white"
                        onClick={handleDisable}
                        disabled={isLoading || !disableToken}
                      >
                        {isLoading ? (
                          <FaSync className="h-4 w-4 animate-spin" />
                        ) : (
                          "Disable"
                        )}
                      </Button>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="mt-2 text-gray-400 hover:text-white text-xs"
                      onClick={() => setShowDisableForm(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {qrCode && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="bg-indigo-900/20 p-4 rounded-lg border border-indigo-800/50 mb-4">
                <div className="flex flex-col items-center">
                  <p className="text-sm text-indigo-200 font-medium mb-3">
                    Scan this QR code with your authenticator app
                  </p>
                  <div className="bg-white p-2 rounded mb-3">
                    <img src={qrCode} alt="QR Code for 2FA" className="w-48 h-48" />
                  </div>
                  {secret && (
                    <div className="mb-3 text-center">
                      <p className="text-xs text-indigo-300 mb-1">
                        Or enter this code manually:
                      </p>
                      <p className="font-mono bg-indigo-900/50 px-2 py-1 rounded text-indigo-200 text-sm">
                        {secret}
                      </p>
                    </div>
                  )}
                  <div className="w-full mt-3">
                    <p className="text-xs text-indigo-300 mb-2">
                      Enter the verification code from your authenticator app:
                    </p>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        value={verificationToken}
                        onChange={(e) => setVerificationToken(e.target.value)}
                        placeholder="Enter verification code"
                        className="bg-indigo-900/30 border-indigo-800/50 text-white"
                      />
                      <Button
                        size="sm"
                        className="bg-indigo-600/70 hover:bg-indigo-600 text-white"
                        onClick={handleVerify}
                        disabled={isLoading || !verificationToken}
                      >
                        {isLoading ? (
                          <FaSync className="h-4 w-4 animate-spin" />
                        ) : (
                          <FaCheck className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {!enabled && !qrCode && (
            <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700/50">
              <div className="flex items-start">
                <div className="flex-shrink-0 pt-0.5">
                  <FaExclamationTriangle className="h-5 w-5 text-amber-400" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-amber-200 font-medium">
                    Two-factor authentication is not enabled
                  </p>
                  <p className="mt-1 text-xs text-amber-300/80">
                    We strongly recommend enabling two-factor authentication to add an extra layer of security to your account.
                  </p>
                  <Button 
                    size="sm"
                    className="mt-3 bg-amber-600/70 hover:bg-amber-600 text-white text-xs"
                    onClick={onEnable}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <FaSync className="mr-1.5 h-3 w-3 animate-spin" />
                    ) : (
                      <FaShieldAlt className="mr-1.5 h-3 w-3" />
                    )}
                    Enable Two-Factor Authentication
                  </Button>
                </div>
              </div>
            </div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
};

export default TwoFactorAuthCard;
