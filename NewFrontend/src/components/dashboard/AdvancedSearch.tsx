import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaSearch, 
  FaTimes, 
  FaFilter, 
  FaHistory, 
  FaMicrophone,
  FaSpinner,
  FaTicketAlt,
  FaUser,
  FaServer,
  FaShieldAlt,
  FaLightbulb
} from 'react-icons/fa';
import { Button } from '@/components/ui/buttons/Button';
import { Badge } from '@/components/ui/badge';

interface SearchSuggestion {
  id: string;
  text: string;
  type: 'recent' | 'popular' | 'ai';
}

interface SearchResult {
  id: string;
  title: string;
  description: string;
  type: 'ticket' | 'user' | 'system' | 'security';
  url: string;
  relevance: number;
  timestamp: Date | string;
}

interface AdvancedSearchProps {
  onSearch?: (query: string, filters: any) => void;
  className?: string;
}

const AdvancedSearch: React.FC<AdvancedSearchProps> = ({
  onSearch,
  className = ''
}) => {
  const [query, setQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [showNlpHint, setShowNlpHint] = useState(false);
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  
  // Sample suggestions
  const sampleSuggestions: SearchSuggestion[] = [
    { id: '1', text: 'Open tickets assigned to me', type: 'recent' },
    { id: '2', text: 'Users registered in the last 7 days', type: 'recent' },
    { id: '3', text: 'Critical security alerts', type: 'popular' },
    { id: '4', text: 'System performance issues', type: 'popular' },
    { id: '5', text: 'Try "Show tickets with response time > 1 hour"', type: 'ai' },
    { id: '6', text: 'Try "Find users who logged in from unusual locations"', type: 'ai' },
  ];
  
  // Sample search results
  const generateResults = (searchQuery: string): SearchResult[] => {
    if (!searchQuery.trim()) return [];
    
    // Simulate NLP processing
    const lowerQuery = searchQuery.toLowerCase();
    
    // Ticket-related queries
    if (lowerQuery.includes('ticket') || lowerQuery.includes('tickets')) {
      return [
        {
          id: '1',
          title: 'Unable to access account',
          description: 'User reported inability to log in despite correct credentials. Password reset sent.',
          type: 'ticket',
          url: '/tickets/1234',
          relevance: 95,
          timestamp: new Date(Date.now() - 1000 * 60 * 30) // 30 minutes ago
        },
        {
          id: '2',
          title: 'Payment processing error',
          description: 'Customer encountered error during checkout. Error code: PAY-2021.',
          type: 'ticket',
          url: '/tickets/1235',
          relevance: 88,
          timestamp: new Date(Date.now() - 1000 * 60 * 120) // 2 hours ago
        },
        {
          id: '3',
          title: 'Feature request: Dark mode',
          description: 'User requesting dark mode option for the dashboard interface.',
          type: 'ticket',
          url: '/tickets/1236',
          relevance: 75,
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24) // 1 day ago
        }
      ];
    }
    
    // User-related queries
    if (lowerQuery.includes('user') || lowerQuery.includes('users')) {
      return [
        {
          id: '4',
          title: 'John Smith',
          description: 'Premium user, joined 3 months ago. Last active: 2 hours ago.',
          type: 'user',
          url: '/users/5678',
          relevance: 92,
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2) // 2 hours ago
        },
        {
          id: '5',
          title: 'Sarah Johnson',
          description: 'Admin user, joined 1 year ago. Last active: 15 minutes ago.',
          type: 'user',
          url: '/users/5679',
          relevance: 87,
          timestamp: new Date(Date.now() - 1000 * 60 * 15) // 15 minutes ago
        },
        {
          id: '6',
          title: 'New user report',
          description: 'Weekly report of new user registrations and activations.',
          type: 'system',
          url: '/reports/users/weekly',
          relevance: 80,
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2) // 2 days ago
        }
      ];
    }
    
    // System-related queries
    if (lowerQuery.includes('system') || lowerQuery.includes('performance')) {
      return [
        {
          id: '7',
          title: 'System performance report',
          description: 'Daily performance metrics for all system components.',
          type: 'system',
          url: '/system/performance',
          relevance: 94,
          timestamp: new Date(Date.now() - 1000 * 60 * 60) // 1 hour ago
        },
        {
          id: '8',
          title: 'Database optimization completed',
          description: 'Scheduled database maintenance and optimization completed successfully.',
          type: 'system',
          url: '/system/maintenance/logs',
          relevance: 82,
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3) // 3 hours ago
        }
      ];
    }
    
    // Security-related queries
    if (lowerQuery.includes('security') || lowerQuery.includes('alert')) {
      return [
        {
          id: '9',
          title: 'Multiple failed login attempts',
          description: 'User account "admin@example.com" had 5 failed login attempts from IP 192.168.1.1.',
          type: 'security',
          url: '/security/alerts/9876',
          relevance: 98,
          timestamp: new Date(Date.now() - 1000 * 60 * 10) // 10 minutes ago
        },
        {
          id: '10',
          title: 'Unusual access pattern detected',
          description: 'User accessing sensitive data from unrecognized location.',
          type: 'security',
          url: '/security/alerts/9877',
          relevance: 95,
          timestamp: new Date(Date.now() - 1000 * 60 * 45) // 45 minutes ago
        }
      ];
    }
    
    // Default results for other queries
    return [
      {
        id: '11',
        title: `Search results for "${searchQuery}"`,
        description: 'No specific matches found. Try refining your search or using filters.',
        type: 'system',
        url: '#',
        relevance: 60,
        timestamp: new Date()
      }
    ];
  };
  
  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      
      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setQuery(transcript);
        setIsListening(false);
        handleSearch(transcript);
      };
      
      recognitionRef.current.onerror = () => {
        setIsListening(false);
      };
      
      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);
  
  // Load suggestions when expanded
  useEffect(() => {
    if (isExpanded) {
      setSuggestions(sampleSuggestions);
    }
  }, [isExpanded]);
  
  // Handle click outside to collapse
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Focus input when expanded
  useEffect(() => {
    if (isExpanded && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isExpanded]);
  
  // Handle search
  const handleSearch = (searchQuery: string = query) => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    
    // Simulate search delay
    setTimeout(() => {
      const results = generateResults(searchQuery);
      setResults(results);
      setIsSearching(false);
      
      if (onSearch) {
        onSearch(searchQuery, selectedFilters);
      }
    }, 800);
  };
  
  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch();
  };
  
  // Toggle filter selection
  const toggleFilter = (filter: string) => {
    setSelectedFilters(prev => 
      prev.includes(filter)
        ? prev.filter(f => f !== filter)
        : [...prev, filter]
    );
  };
  
  // Start voice recognition
  const startVoiceRecognition = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (error) {
        console.error('Error starting speech recognition', error);
      }
    }
  };
  
  // Apply suggestion
  const applySuggestion = (suggestion: SearchSuggestion) => {
    // For AI suggestions, extract the actual query from the "Try X" format
    const actualQuery = suggestion.type === 'ai'
      ? suggestion.text.replace(/^Try "(.+)"$/, '$1')
      : suggestion.text;
    
    setQuery(actualQuery);
    handleSearch(actualQuery);
  };
  
  // Get icon for result type
  const getResultTypeIcon = (type: string) => {
    switch (type) {
      case 'ticket':
        return <FaTicketAlt className="h-4 w-4" />;
      case 'user':
        return <FaUser className="h-4 w-4" />;
      case 'system':
        return <FaServer className="h-4 w-4" />;
      case 'security':
        return <FaShieldAlt className="h-4 w-4" />;
      default:
        return <FaSearch className="h-4 w-4" />;
    }
  };
  
  // Get color for result type
  const getResultTypeColor = (type: string) => {
    switch (type) {
      case 'ticket':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'user':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'system':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'security':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };
  
  // Format timestamp
  const formatTimestamp = (timestamp: Date | string) => {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.round(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins === 1 ? '' : 's'} ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  };
  
  return (
    <div 
      ref={searchContainerRef}
      className={`relative z-20 ${className}`}
    >
      {/* Search input */}
      <div 
        className={`relative transition-all duration-300 ${
          isExpanded 
            ? 'bg-gray-800/90 backdrop-blur-md rounded-t-xl shadow-xl border border-gray-700/50 border-b-0' 
            : 'bg-gray-700/50 rounded-xl border border-gray-600/50 hover:border-blue-500/30'
        }`}
      >
        <form onSubmit={handleSubmit}>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              {isSearching ? (
                <FaSpinner className="h-4 w-4 text-blue-400 animate-spin" />
              ) : (
                <FaSearch className={`h-4 w-4 ${isExpanded ? 'text-blue-400' : 'text-gray-400'}`} />
              )}
            </div>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search or use natural language (e.g., 'Show open tickets')"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowNlpHint(e.target.value.length > 0 && !isExpanded);
              }}
              onFocus={() => {
                setIsExpanded(true);
                setShowNlpHint(false);
              }}
              className={`pl-10 pr-20 py-3 w-full bg-transparent text-gray-200 text-sm focus:outline-none transition-all duration-300 ${
                isExpanded ? 'placeholder-gray-400' : 'placeholder-gray-500'
              }`}
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 space-x-1">
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="p-1 rounded-full text-gray-400 hover:text-white hover:bg-gray-700/50"
                >
                  <FaTimes className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={startVoiceRecognition}
                className={`p-1 rounded-full ${
                  isListening 
                    ? 'text-red-400 bg-red-500/20' 
                    : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                }`}
              >
                <FaMicrophone className="h-4 w-4" />
              </button>
            </div>
          </div>
        </form>
      </div>
      
      {/* NLP hint tooltip */}
      <AnimatePresence>
        {showNlpHint && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute right-0 mt-2 p-3 bg-blue-500/90 backdrop-blur-md rounded-lg shadow-lg text-white text-sm max-w-xs z-30"
          >
            <div className="flex items-start">
              <FaLightbulb className="h-4 w-4 mt-0.5 mr-2 text-yellow-300" />
              <div>
                <p>Try using natural language! For example:</p>
                <ul className="mt-1 ml-4 list-disc text-xs space-y-1">
                  <li>"Show tickets assigned to Sarah"</li>
                  <li>"Find users who registered this week"</li>
                  <li>"List critical security alerts"</li>
                </ul>
              </div>
            </div>
            <button 
              className="absolute top-2 right-2 text-white/70 hover:text-white"
              onClick={() => setShowNlpHint(false)}
            >
              <FaTimes className="h-3 w-3" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Expanded search panel */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="absolute left-0 right-0 bg-gray-800/90 backdrop-blur-md rounded-b-xl shadow-xl border border-gray-700/50 border-t-0 overflow-hidden"
          >
            {/* Filters */}
            <div className="p-4 border-b border-gray-700/50">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-white">Filters</h3>
                {selectedFilters.length > 0 && (
                  <button
                    className="text-xs text-blue-400 hover:text-blue-300"
                    onClick={() => setSelectedFilters([])}
                  >
                    Clear all
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge 
                  className={`cursor-pointer ${
                    selectedFilters.includes('tickets')
                      ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                      : 'bg-gray-700/50 text-gray-400 border-gray-600/50 hover:bg-gray-600/50 hover:text-gray-300'
                  }`}
                  onClick={() => toggleFilter('tickets')}
                >
                  <FaTicketAlt className="h-3 w-3 mr-1" />
                  Tickets
                </Badge>
                <Badge 
                  className={`cursor-pointer ${
                    selectedFilters.includes('users')
                      ? 'bg-green-500/20 text-green-400 border-green-500/30'
                      : 'bg-gray-700/50 text-gray-400 border-gray-600/50 hover:bg-gray-600/50 hover:text-gray-300'
                  }`}
                  onClick={() => toggleFilter('users')}
                >
                  <FaUser className="h-3 w-3 mr-1" />
                  Users
                </Badge>
                <Badge 
                  className={`cursor-pointer ${
                    selectedFilters.includes('system')
                      ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                      : 'bg-gray-700/50 text-gray-400 border-gray-600/50 hover:bg-gray-600/50 hover:text-gray-300'
                  }`}
                  onClick={() => toggleFilter('system')}
                >
                  <FaServer className="h-3 w-3 mr-1" />
                  System
                </Badge>
                <Badge 
                  className={`cursor-pointer ${
                    selectedFilters.includes('security')
                      ? 'bg-red-500/20 text-red-400 border-red-500/30'
                      : 'bg-gray-700/50 text-gray-400 border-gray-600/50 hover:bg-gray-600/50 hover:text-gray-300'
                  }`}
                  onClick={() => toggleFilter('security')}
                >
                  <FaShieldAlt className="h-3 w-3 mr-1" />
                  Security
                </Badge>
              </div>
            </div>
            
            {/* Suggestions or results */}
            <div className="max-h-80 overflow-y-auto">
              {results.length > 0 ? (
                <div className="p-4">
                  <h3 className="text-sm font-medium text-white mb-3">Results</h3>
                  <div className="space-y-3">
                    {results.map((result) => (
                      <div 
                        key={result.id}
                        className="p-3 rounded-lg bg-gray-700/30 hover:bg-gray-700/50 transition-colors cursor-pointer"
                        onClick={() => window.location.href = result.url}
                      >
                        <div className="flex items-start">
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center mr-3 ${getResultTypeColor(result.type)}`}>
                            {getResultTypeIcon(result.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-medium text-white truncate">{result.title}</h4>
                              <Badge className={getResultTypeColor(result.type)}>
                                {result.type}
                              </Badge>
                            </div>
                            <p className="text-xs text-gray-400 mt-1 line-clamp-2">{result.description}</p>
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-xs text-gray-500">{formatTimestamp(result.timestamp)}</span>
                              <span className="text-xs text-blue-400">{result.relevance}% match</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-white">Suggestions</h3>
                    <button
                      className="text-xs text-blue-400 hover:text-blue-300 flex items-center"
                    >
                      <FaHistory className="h-3 w-3 mr-1" />
                      View history
                    </button>
                  </div>
                  <div className="space-y-2">
                    {suggestions.map((suggestion) => (
                      <div 
                        key={suggestion.id}
                        className="p-2 rounded-lg hover:bg-gray-700/50 transition-colors cursor-pointer flex items-center"
                        onClick={() => applySuggestion(suggestion)}
                      >
                        {suggestion.type === 'recent' && (
                          <FaHistory className="h-3 w-3 text-gray-400 mr-2" />
                        )}
                        {suggestion.type === 'popular' && (
                          <FaFilter className="h-3 w-3 text-gray-400 mr-2" />
                        )}
                        {suggestion.type === 'ai' && (
                          <FaLightbulb className="h-3 w-3 text-yellow-400 mr-2" />
                        )}
                        <span className={`text-sm ${
                          suggestion.type === 'ai' ? 'text-blue-300' : 'text-gray-300'
                        }`}>
                          {suggestion.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="p-3 border-t border-gray-700/50 flex justify-between items-center">
              <div className="text-xs text-gray-400">
                {isListening ? (
                  <span className="text-blue-400">Listening for voice command...</span>
                ) : (
                  <span>Press <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-gray-300">Enter</kbd> to search</span>
                )}
              </div>
              <Button 
                variant="outline" 
                size="sm"
                className="bg-blue-500/20 border-blue-500/30 text-blue-300 hover:bg-blue-500/30 hover:text-blue-200"
                onClick={() => handleSearch()}
                disabled={isSearching || !query.trim()}
              >
                {isSearching ? (
                  <><FaSpinner className="h-3 w-3 mr-1 animate-spin" /> Searching</>
                ) : (
                  <><FaSearch className="h-3 w-3 mr-1" /> Search</>
                )}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdvancedSearch;
