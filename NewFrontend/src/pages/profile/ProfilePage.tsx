import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  FaUser, FaEnvelope, FaShieldAlt, FaHistory, 
  FaEdit, FaCamera, FaFingerprint, FaKey, FaMobileAlt, FaLaptop, FaDesktop, FaMobile, FaTablet, FaSignOutAlt, FaEye, FaEyeSlash
} from 'react-icons/fa';
import { useAuth } from '@/features/auth/hooks/useAuth';
import TopNavbar from '@/components/dashboard/TopNavbar';
import Sidebar from '@/components/dashboard/Sidebar';
import Footer from '@/components/dashboard/Footer';
import { Button } from '@/components/ui/buttons/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Tab } from '@headlessui/react';
import { Switch } from '@headlessui/react';
import { toast } from 'react-hot-toast';
import { AnimatePresence } from 'framer-motion';
// Using a placeholder image service instead
const profileBg = "https://placehold.co/1920x400/1a365d/ffffff?text=Profile+Background";

const ProfilePage: React.FC = () => {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<string | null>(null);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordRequirements, setPasswordRequirements] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false
  });
  const [securitySettings, setSecuritySettings] = useState({
    loginNotifications: true,
    suspiciousActivityDetection: false,
    securityLevel: 'medium'
  });
  
  // Mock data
  const recentActivity = [
    { id: 1, action: 'Login', device: 'Chrome on Windows', location: 'New York, USA', time: '2 hours ago' },
    { id: 2, action: 'Password Changed', device: 'Chrome on Windows', location: 'New York, USA', time: '3 days ago' },
    { id: 3, action: 'Login', device: 'Safari on iPhone', location: 'Boston, USA', time: '5 days ago' },
  ];

  const activeSessions = [
    { id: 1, deviceName: 'MacBook Pro', deviceType: 'desktop', location: 'New York, USA', lastActive: '10 minutes ago', current: true },
    { id: 2, deviceName: 'iPhone 12', deviceType: 'mobile', location: 'San Francisco, USA', lastActive: '2 hours ago', current: false },
    { id: 3, deviceName: 'Samsung Galaxy S21', deviceType: 'mobile', location: 'Los Angeles, USA', lastActive: '1 day ago', current: false },
  ];

  // Animation variants
  const fadeIn = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3 }
  };

  // Simple password strength calculation
  const calculatePasswordStrength = (password: string): string => {
    if (password.length < 8) return 'weak';
    if (password.length >= 8 && /[!@#$%^&*(),.?":{}|<>]/.test(password)) return 'medium';
    return 'strong';
  };

  const maskEmail = (email: string): string => {
    const [localPart, domain] = email.split('@');
    const maskedLocalPart = localPart.slice(0, 2) + '*'.repeat(localPart.length - 2);
    return `${maskedLocalPart}@${domain}`;
  };

  useEffect(() => {
    setSidebarOpen(false);
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white">
      <TopNavbar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} userRole={user?.role} />
        
        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            
            {/* Profile Header */}
            <motion.div 
              className="relative rounded-xl overflow-hidden mb-8 bg-gradient-to-r from-blue-600/80 to-indigo-700/80 backdrop-blur-sm"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div className="h-48 w-full object-cover" style={{ 
                backgroundImage: `url(${profileBg})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                opacity: 0.3
              }}></div>
              
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
              
              <div className="absolute bottom-0 left-0 right-0 p-6 flex flex-col md:flex-row items-center md:items-end justify-between">
                <div className="flex flex-col md:flex-row items-center">
                  <div className="relative mb-4 md:mb-0">
                    <div className="h-24 w-24 rounded-full border-4 border-white/20 overflow-hidden bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                      {user?.avatar ? (
                        <img src={user.avatar} alt="Profile" className="h-full w-full object-cover" />
                      ) : (
                        <FaUser className="h-12 w-12 text-white/70" />
                      )}
                    </div>
                    <button className="absolute bottom-0 right-0 bg-blue-500 hover:bg-blue-600 p-2 rounded-full text-white transition-all duration-200 transform hover:scale-110">
                      <FaCamera size={14} />
                    </button>
                  </div>
                  
                  <div className="text-center md:text-left md:ml-4">
                    <h1 className="text-2xl font-bold text-white">{user?.name || 'User Name'}</h1>
                    <p className="text-blue-200">{user?.email || 'user@example.com'}</p>
                    <div className="flex items-center justify-center md:justify-start mt-2 space-x-2">
                      <span className="px-2 py-1 bg-blue-900/50 rounded-full text-xs text-blue-200 border border-blue-800/50">
                        {user?.role || 'User'}
                      </span>
                      {user?.verified && (
                        <span className="px-2 py-1 bg-green-900/50 rounded-full text-xs text-green-200 border border-green-800/50 flex items-center">
                          <FaShieldAlt className="mr-1" size={10} /> Verified
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                <Button 
                  className="mt-4 md:mt-0 bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-sm"
                >
                  <FaEdit className="mr-2" size={14} /> Edit Profile
                </Button>
              </div>
            </motion.div>
            
            {/* Tabs */}
            <Tab.Group>
              <div className="border-b border-white/10 mb-6">
                <Tab.List className="flex space-x-8">
                  {['Profile', 'Preferences', 'Session' ,'Password' ,'Security', 'Activity'].map((tab) => (
                    <Tab key={tab} className={({ selected }) => `
                      relative py-4 text-sm font-medium outline-none
                      ${selected 
                        ? 'text-blue-400' 
                        : 'text-gray-400 hover:text-gray-300'
                      }
                    `}>
                      {({ selected }) => (
                        <>
                          {tab}
                          {selected && (
                            <motion.div 
                              className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"
                              layoutId="activeTab"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ duration: 0.2 }}
                            />
                          )}
                        </>
                      )}
                    </Tab>
                  ))}
                </Tab.List>
              </div>
              
              <Tab.Panels>
                {/* Profile Tab */}
                <Tab.Panel>
                  <motion.div 
                    className="grid grid-cols-1 md:grid-cols-2 gap-6"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    {/* Personal Information */}
                    <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 shadow-xl">
                      <h2 className="text-xl font-semibold mb-4 text-white flex items-center">
                        <FaUser className="mr-2 text-blue-400" />
                        Personal Information
                      </h2>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1">First Name</label>
                          <input 
                            type="text" 
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                            value={user?.firstName || ''}
                            readOnly={!isEditing}
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1">Last Name</label>
                          <input 
                            type="text" 
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                            value={user?.lastName || ''}
                            readOnly={!isEditing}
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                          <input 
                            type="email" 
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                            value={user?.email || ''}
                            readOnly
                          />
                        </div>
                      </div>
                    </div>
                    
                    {/* Preferences */}
                    <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 shadow-xl">
                      <h2 className="text-xl font-semibold mb-4 text-white">Preferences</h2>
                      
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-medium text-white">Email Notifications</h3>
                            <p className="text-sm text-gray-400">Receive email about account activity</p>
                          </div>
                          <Switch
                            checked={true}
                            onChange={() => {}}
                            className={`bg-blue-600 relative inline-flex h-6 w-11 items-center rounded-full`}
                          >
                            <span className="sr-only">Enable notifications</span>
                            <span className={`translate-x-6 inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
                          </Switch>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-medium text-white">Dark Mode</h3>
                            <p className="text-sm text-gray-400">Use dark theme across the application</p>
                          </div>
                          <Switch
                            checked={true}
                            onChange={() => {}}
                            className={`bg-blue-600 relative inline-flex h-6 w-11 items-center rounded-full`}
                          >
                            <span className="sr-only">Enable dark mode</span>
                            <span className={`translate-x-6 inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
                          </Switch>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </Tab.Panel>
                
                {/* Security Tab */}
                <Tab.Panel>
                  <motion.div 
                    className="space-y-6"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    {/* Two-factor authentication */}
                    <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 shadow-xl transition-all duration-300 hover:border-white/20">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-start">
                          <div className="p-2 bg-indigo-900/30 rounded-lg">
                            <FaFingerprint className="h-5 w-5 text-indigo-400" />
                          </div>
                          <div className="ml-3">
                            <h3 className="text-white font-medium">Two-Factor Authentication</h3>
                            <p className="text-sm text-gray-400 mt-1">Add an extra layer of security to your account</p>
                          </div>
                        </div>
                        <Switch
                          checked={twoFactorEnabled}
                          onChange={setTwoFactorEnabled}
                          className={`${
                            twoFactorEnabled ? 'bg-blue-600' : 'bg-gray-600'
                          } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900`}
                        >
                          <span className="sr-only">Enable two-factor authentication</span>
                          <span
                            className={`${
                              twoFactorEnabled ? 'translate-x-6' : 'translate-x-1'
                            } inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ease-in-out`}
                          />
                        </Switch>
                      </div>
                      
                      <AnimatePresence>
                        {twoFactorEnabled && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3 }}
                            className="overflow-hidden"
                          >
                            <div className="bg-blue-900/20 p-4 rounded-lg border border-blue-800/50">
                              <div className="flex items-start">
                                <div className="flex-shrink-0 pt-0.5">
                                  <FaShieldAlt className="h-5 w-5 text-blue-400" />
                                </div>
                                <div className="ml-3">
                                  <p className="text-sm text-blue-200 font-medium">
                                    Two-factor authentication is enabled
                                  </p>
                                  <p className="mt-1 text-xs text-blue-300">
                                    Your account is now protected with an additional layer of security. You'll be asked for a verification code when signing in from new devices.
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
                                    <div className="pt-2 border-t border-blue-800/30">
                                      <p className="text-xs text-blue-300 mb-2">Recovery options:</p>
                                      <div className="flex items-center">
                                        <input
                                          type="checkbox"
                                          id="recovery-email"
                                          className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500"
                                          checked={true}
                                          readOnly
                                        />
                                        <label htmlFor="recovery-email" className="ml-2 text-xs text-blue-200">
                                          Email recovery ({maskEmail(user?.email || '')})
                                        </label>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    
                    {/* Session Management */}
                    <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 shadow-xl transition-all duration-300 hover:border-white/20">
                      <div className="flex items-center mb-4">
                        <div className="p-2 bg-amber-900/30 rounded-lg">
                          <FaLaptop className="h-5 w-5 text-amber-400" />
                        </div>
                        <div className="ml-3">
                          <h3 className="text-white font-medium">Active Sessions</h3>
                          <p className="text-sm text-gray-400 mt-1">Manage devices where you're currently logged in</p>
                        </div>
                      </div>
                      
                      <div className="mt-4 space-y-3">
                        {activeSessions.map((session) => (
                          <div key={session.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                            <div className="flex items-center">
                              <div className="p-2 bg-gray-800 rounded-lg">
                                {session.deviceType === 'desktop' ? (
                                  <FaDesktop className="h-4 w-4 text-blue-400" />
                                ) : session.deviceType === 'mobile' ? (
                                  <FaMobile className="h-4 w-4 text-green-400" />
                                ) : (
                                  <FaTablet className="h-4 w-4 text-purple-400" />
                                )}
                              </div>
                              <div className="ml-3">
                                <p className="text-sm text-white">{session.deviceName}</p>
                                <div className="flex items-center mt-1">
                                  <p className="text-xs text-gray-400">{session.location} • {session.lastActive}</p>
                                  {session.current && (
                                    <span className="ml-2 px-1.5 py-0.5 text-xs bg-green-900/50 text-green-400 rounded-full">Current</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            {!session.current && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                              >
                                <FaSignOutAlt className="h-3 w-3 mr-1" />
                                Logout
                              </Button>
                            )}
                          </div>
                        ))}
                        
                        <Button 
                          variant="outline" 
                          className="w-full mt-3 border-white/10 text-white hover:bg-white/10"
                        >
                          <FaSignOutAlt className="mr-2 h-4 w-4 text-red-400" />
                          Logout from all other devices
                        </Button>
                      </div>
                    </div>
                    
                    {/* Password change */}
                    <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 shadow-xl">
                      <div className="flex items-center mb-6">
                        <div className="p-2 bg-green-900/30 rounded-lg">
                          <FaKey className="h-5 w-5 text-green-400" />
                        </div>
                        <div className="ml-3">
                          <h3 className="text-white font-medium">Change Password</h3>
                          <p className="text-sm text-gray-400 mt-1">Update your password regularly for better security</p>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1">Current Password</label>
                          <div className="relative">
                            <input 
                              type={showCurrentPassword ? "text" : "password"}
                              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white pr-10"
                              placeholder="••••••••"
                            />
                            <button 
                              type="button"
                              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-300"
                            >
                              {showCurrentPassword ? <FaEyeSlash className="h-4 w-4" /> : <FaEye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1">New Password</label>
                          <div className="relative">
                            <input 
                              type={showNewPassword ? "text" : "password"}
                              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white pr-10"
                              placeholder="••••••••"
                              onChange={(e) => {
                                const password = e.target.value;
                                const strength = calculatePasswordStrength(password);
                                setPasswordStrength(strength);
                                setPasswordRequirements({
                                  length: password.length >= 8,
                                  uppercase: /[A-Z]/.test(password),
                                  lowercase: /[a-z]/.test(password),
                                  number: /[0-9]/.test(password),
                                  special: /[^A-Za-z0-9]/.test(password)
                                });
                              }}
                            />
                            <button 
                              type="button"
                              onClick={() => setShowNewPassword(!showNewPassword)}
                              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-300"
                            >
                              {showNewPassword ? <FaEyeSlash className="h-4 w-4" /> : <FaEye className="h-4 w-4" />}
                            </button>
                          </div>
                          
                          {/* Password strength meter */}
                          <div className="mt-2">
                            <div className="h-1.5 w-full bg-gray-700 rounded-full overflow-hidden">
                              <div 
                                className={`h-full transition-all duration-300 ${
                                  passwordStrength === 'weak' ? 'w-1/3 bg-red-500' :
                                  passwordStrength === 'medium' ? 'w-2/3 bg-yellow-500' :
                                  passwordStrength === 'strong' ? 'w-full bg-green-500' : 'w-0'
                                }`}
                              ></div>
                            </div>
                            <p className={`text-xs mt-1 ${
                              passwordStrength === 'weak' ? 'text-red-400' :
                              passwordStrength === 'medium' ? 'text-yellow-400' :
                              passwordStrength === 'strong' ? 'text-green-400' : 'text-gray-400'
                            }`}>
                              {passwordStrength === 'weak' ? 'Weak password' :
                               passwordStrength === 'medium' ? 'Medium strength' :
                               passwordStrength === 'strong' ? 'Strong password' : 'Enter a password'}
                            </p>
                          </div>
                          
                          {/* Password requirements */}
                          <div className="mt-2 grid grid-cols-2 gap-1">
                            <div className={`text-xs flex items-center ${passwordRequirements.length ? 'text-green-400' : 'text-gray-400'}`}>
                              <span className="mr-1">{passwordRequirements.length ? '✓' : '○'}</span> At least 8 characters
                            </div>
                            <div className={`text-xs flex items-center ${passwordRequirements.uppercase ? 'text-green-400' : 'text-gray-400'}`}>
                              <span className="mr-1">{passwordRequirements.uppercase ? '✓' : '○'}</span> Uppercase letter
                            </div>
                            <div className={`text-xs flex items-center ${passwordRequirements.lowercase ? 'text-green-400' : 'text-gray-400'}`}>
                              <span className="mr-1">{passwordRequirements.lowercase ? '✓' : '○'}</span> Lowercase letter
                            </div>
                            <div className={`text-xs flex items-center ${passwordRequirements.number ? 'text-green-400' : 'text-gray-400'}`}>
                              <span className="mr-1">{passwordRequirements.number ? '✓' : '○'}</span> Number
                            </div>
                            <div className={`text-xs flex items-center ${passwordRequirements.special ? 'text-green-400' : 'text-gray-400'}`}>
                              <span className="mr-1">{passwordRequirements.special ? '✓' : '○'}</span> Special character
                            </div>
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1">Confirm New Password</label>
                          <div className="relative">
                            <input 
                              type={showConfirmPassword ? "text" : "password"}
                              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white pr-10"
                              placeholder="••••••••"
                            />
                            <button 
                              type="button"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-300"
                            >
                              {showConfirmPassword ? <FaEyeSlash className="h-4 w-4" /> : <FaEye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>
                        
                        <Button 
                          className="w-full bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400"
                        >
                          Update Password
                        </Button>
                      </div>
                    </div>
                    
                    {/* Security Settings */}
                    <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 shadow-xl">
                      <div className="flex items-center mb-6">
                        <div className="p-2 bg-red-900/30 rounded-lg">
                          <FaShieldAlt className="h-5 w-5 text-red-400" />
                        </div>
                        <div className="ml-3">
                          <h3 className="text-white font-medium">Security Settings</h3>
                          <p className="text-sm text-gray-400 mt-1">Configure additional security options</p>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <div className="flex items-center justify-between py-3 border-b border-white/10">
                          <div>
                            <h4 className="text-sm font-medium text-white">Login Notifications</h4>
                            <p className="text-xs text-gray-400 mt-1">Receive alerts when your account is accessed from a new device</p>
                          </div>
                          <Switch
                            checked={securitySettings.loginNotifications}
                            onChange={(checked) => setSecuritySettings({...securitySettings, loginNotifications: checked})}
                            className={`${
                              securitySettings.loginNotifications ? 'bg-blue-600' : 'bg-gray-600'
                            } relative inline-flex h-6 w-11 items-center rounded-full`}
                          >
                            <span className="sr-only">Enable login notifications</span>
                            <span
                              className={`${
                                securitySettings.loginNotifications ? 'translate-x-6' : 'translate-x-1'
                              } inline-block h-4 w-4 transform rounded-full bg-white`}
                            />
                          </Switch>
                        </div>
                        
                        <div className="flex items-center justify-between py-3 border-b border-white/10">
                          <div>
                            <h4 className="text-sm font-medium text-white">Suspicious Activity Detection</h4>
                            <p className="text-xs text-gray-400 mt-1">Get notified about unusual login attempts</p>
                          </div>
                          <Switch
                            checked={securitySettings.suspiciousActivityDetection}
                            onChange={(checked) => setSecuritySettings({...securitySettings, suspiciousActivityDetection: checked})}
                            className={`${
                              securitySettings.suspiciousActivityDetection ? 'bg-blue-600' : 'bg-gray-600'
                            } relative inline-flex h-6 w-11 items-center rounded-full`}
                          >
                            <span className="sr-only">Enable suspicious activity detection</span>
                            <span
                              className={`${
                                securitySettings.suspiciousActivityDetection ? 'translate-x-6' : 'translate-x-1'
                              } inline-block h-4 w-4 transform rounded-full bg-white`}
                            />
                          </Switch>
                        </div>
                        
                        <div className="flex items-center justify-between py-3">
                          <div>
                            <h4 className="text-sm font-medium text-white">Security Level</h4>
                            <p className="text-xs text-gray-400 mt-1">Set the security level for your account</p>
                          </div>
                          <select
                            value={securitySettings.securityLevel}
                            onChange={(e) => setSecuritySettings({...securitySettings, securityLevel: e.target.value})}
                            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white"
                          >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </Tab.Panel>
                
                {/* Activity Tab */}
                <Tab.Panel>
                  <motion.div 
                    className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 shadow-xl"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-xl font-semibold text-white flex items-center">
                        <FaHistory className="mr-2 text-blue-400" />
                        Recent Activity
                      </h2>
                      <span className="text-sm text-gray-400">Last 30 days</span>
                    </div>
                    
                    <div className="space-y-6">
                      {recentActivity.map((activity) => (
                        <div key={activity.id} className="flex items-start border-b border-white/10 pb-4">
                          <div className="p-2 bg-blue-900/30 rounded-lg mt-1">
                            <FaHistory className="h-5 w-5 text-blue-400" />
                          </div>
                          <div className="ml-3 flex-1">
                            <div className="flex justify-between">
                              <p className="text-white font-medium">{activity.action}</p>
                              <span className="text-sm text-gray-400">{activity.time}</span>
                            </div>
                            <p className="text-sm text-gray-400 mt-1">
                              {activity.device} • {activity.location}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="mt-6 text-center">
                      <Button 
                        variant="outline"
                        className="border-white/10 text-white hover:bg-white/10"
                      >
                        View All Activity
                      </Button>
                    </div>
                  </motion.div>
                </Tab.Panel>
              </Tab.Panels>
            </Tab.Group>
          </div>
        </main>
      </div>
      
      <Footer />
    </div>
  );
};

export default ProfilePage;
