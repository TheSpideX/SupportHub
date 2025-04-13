import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaMicrophone, 
  FaMicrophoneSlash, 
  FaRobot, 
  FaTimes, 
  FaVolumeUp,
  FaVolumeMute,
  FaCog,
  FaQuestionCircle,
  FaHistory
} from 'react-icons/fa';
import { Button } from '@/components/ui/buttons/Button';
import { Badge } from '@/components/ui/badge';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

interface VoiceAssistantProps {
  className?: string;
}

const VoiceAssistant: React.FC<VoiceAssistantProps> = ({ className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'assistant',
      text: 'Hello! I\'m your dashboard assistant. How can I help you today?',
      timestamp: new Date()
    }
  ]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  
  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      
      recognitionRef.current.onresult = (event: any) => {
        const result = event.results[event.results.length - 1];
        const transcript = result[0].transcript;
        setTranscript(transcript);
        
        if (result.isFinal) {
          addMessage('user', transcript);
          processCommand(transcript);
        }
      };
      
      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setIsListening(false);
      };
      
      recognitionRef.current.onend = () => {
        if (isListening) {
          recognitionRef.current.start();
        }
      };
    }
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [isListening]);
  
  // Toggle speech recognition
  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      setTranscript('');
    } else {
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (error) {
        console.error('Error starting speech recognition', error);
      }
    }
  };
  
  // Add a message to the conversation
  const addMessage = (type: 'user' | 'assistant', text: string) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      type,
      text,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, newMessage]);
    setTranscript('');
    
    return newMessage;
  };
  
  // Process voice command
  const processCommand = (command: string) => {
    setIsProcessing(true);
    
    // Simulate processing delay
    setTimeout(() => {
      const lowerCommand = command.toLowerCase();
      let response = '';
      
      // Simple command processing
      if (lowerCommand.includes('hello') || lowerCommand.includes('hi')) {
        response = 'Hello! How can I assist you with the dashboard today?';
      } else if (lowerCommand.includes('show ticket') || lowerCommand.includes('display ticket')) {
        response = 'Displaying ticket information on the dashboard.';
      } else if (lowerCommand.includes('user stats') || lowerCommand.includes('user statistics')) {
        response = 'Here are the user statistics for today: 1,254 active users, 128 new registrations.';
      } else if (lowerCommand.includes('performance') || lowerCommand.includes('system status')) {
        response = 'All systems are operational. Server load is at 42%, with 99.98% uptime this month.';
      } else if (lowerCommand.includes('alert') || lowerCommand.includes('warning')) {
        response = 'There are 3 active alerts: 1 critical, 1 warning, and 1 informational.';
      } else if (lowerCommand.includes('refresh') || lowerCommand.includes('update')) {
        response = 'Refreshing dashboard data...';
      } else if (lowerCommand.includes('help') || lowerCommand.includes('what can you do')) {
        response = 'I can help you navigate the dashboard, show statistics, refresh data, and provide insights. Try asking for ticket information, user stats, or system performance.';
      } else {
        response = 'I\'m not sure how to help with that. Try asking about tickets, users, performance, or alerts.';
      }
      
      const assistantMessage = addMessage('assistant', response);
      speakResponse(response);
      setIsProcessing(false);
    }, 1500);
  };
  
  // Text-to-speech for assistant responses
  const speakResponse = (text: string) => {
    if ('speechSynthesis' in window) {
      // Stop any current speech
      window.speechSynthesis.cancel();
      
      const speech = new SpeechSynthesisUtterance();
      speech.text = text;
      speech.volume = 1;
      speech.rate = 1;
      speech.pitch = 1;
      
      speech.onstart = () => setIsSpeaking(true);
      speech.onend = () => setIsSpeaking(false);
      speech.onerror = () => setIsSpeaking(false);
      
      window.speechSynthesis.speak(speech);
    }
  };
  
  const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };
  
  // Clear conversation
  const clearConversation = () => {
    setMessages([
      {
        id: Date.now().toString(),
        type: 'assistant',
        text: 'Conversation cleared. How can I help you?',
        timestamp: new Date()
      }
    ]);
  };
  
  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 260,
        damping: 20
      }
    },
    exit: {
      opacity: 0,
      y: 20,
      transition: {
        duration: 0.2
      }
    }
  };
  
  const buttonVariants = {
    rest: { scale: 1 },
    hover: { scale: 1.1 },
    pressed: { scale: 0.95 }
  };
  
  const pulseVariants = {
    pulse: {
      scale: [1, 1.1, 1],
      opacity: [0.7, 1, 0.7],
      transition: {
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  };

  return (
    <div className={`fixed bottom-6 right-6 z-50 ${className}`}>
      {/* Floating button */}
      <motion.button
        className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg ${
          isOpen 
            ? 'bg-red-500 hover:bg-red-600' 
            : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700'
        } text-white transition-colors`}
        onClick={() => setIsOpen(!isOpen)}
        variants={buttonVariants}
        initial="rest"
        whileHover="hover"
        whileTap="pressed"
      >
        {isOpen ? (
          <FaTimes className="h-5 w-5" />
        ) : (
          <div className="relative">
            <FaRobot className="h-6 w-6" />
            {!isOpen && (
              <motion.div
                className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full"
                variants={pulseVariants}
                animate="pulse"
              />
            )}
          </div>
        )}
      </motion.button>
      
      {/* Assistant panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="absolute bottom-16 right-0 w-80 md:w-96 bg-gradient-to-br from-gray-800/95 via-gray-800/95 to-gray-800/95 backdrop-blur-md rounded-xl shadow-xl border border-gray-700/50 overflow-hidden"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-700/70 flex justify-between items-center bg-gradient-to-r from-blue-600/20 to-blue-500/10">
              <div className="flex items-center">
                <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center mr-2">
                  <FaRobot className="h-4 w-4 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-white">Dashboard Assistant</h3>
                  <div className="flex items-center">
                    <div className={`h-2 w-2 rounded-full ${isListening ? 'bg-green-500' : 'bg-gray-500'} mr-1`} />
                    <span className="text-xs text-gray-400">
                      {isListening ? 'Listening...' : 'Idle'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex space-x-1">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 w-8 p-0 text-gray-400 hover:text-white hover:bg-gray-700/50"
                  onClick={() => {}}
                >
                  <FaQuestionCircle className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 w-8 p-0 text-gray-400 hover:text-white hover:bg-gray-700/50"
                  onClick={clearConversation}
                >
                  <FaHistory className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 w-8 p-0 text-gray-400 hover:text-white hover:bg-gray-700/50"
                  onClick={() => {}}
                >
                  <FaCog className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            {/* Messages */}
            <div className="h-80 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => (
                <div 
                  key={message.id}
                  className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.type === 'assistant' && (
                    <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center mr-2 flex-shrink-0">
                      <FaRobot className="h-4 w-4 text-blue-400" />
                    </div>
                  )}
                  <div 
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      message.type === 'user' 
                        ? 'bg-blue-600/30 text-blue-100' 
                        : 'bg-gray-700/50 text-gray-200'
                    }`}
                  >
                    <p className="text-sm">{message.text}</p>
                    <div className="mt-1 text-right">
                      <span className="text-xs opacity-70">
                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                  {message.type === 'user' && (
                    <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center ml-2 flex-shrink-0">
                      <div className="h-4 w-4 rounded-full bg-blue-500" />
                    </div>
                  )}
                </div>
              ))}
              
              {isProcessing && (
                <div className="flex justify-start">
                  <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center mr-2 flex-shrink-0">
                    <FaRobot className="h-4 w-4 text-blue-400" />
                  </div>
                  <div className="bg-gray-700/50 rounded-lg px-4 py-3 text-gray-200">
                    <div className="flex space-x-1">
                      <div className="h-2 w-2 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="h-2 w-2 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="h-2 w-2 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
            
            {/* Input area */}
            <div className="p-4 border-t border-gray-700/70 bg-gray-800/50">
              {transcript && (
                <div className="mb-2 px-3 py-2 bg-gray-700/30 rounded text-sm text-gray-300 italic">
                  {transcript}
                </div>
              )}
              <div className="flex items-center">
                <Button 
                  variant="outline" 
                  className={`mr-2 ${
                    isListening 
                      ? 'bg-red-500/20 border-red-500/30 text-red-400 hover:bg-red-500/30 hover:text-red-300' 
                      : 'bg-blue-500/20 border-blue-500/30 text-blue-400 hover:bg-blue-500/30 hover:text-blue-300'
                  }`}
                  onClick={toggleListening}
                >
                  {isListening ? (
                    <><FaMicrophoneSlash className="h-4 w-4 mr-2" /> Stop</>
                  ) : (
                    <><FaMicrophone className="h-4 w-4 mr-2" /> Speak</>
                  )}
                </Button>
                
                {isSpeaking && (
                  <Button 
                    variant="outline" 
                    className="bg-yellow-500/20 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/30 hover:text-yellow-300"
                    onClick={stopSpeaking}
                  >
                    <FaVolumeMute className="h-4 w-4 mr-2" /> Mute
                  </Button>
                )}
                
                <div className="ml-auto text-xs text-gray-400">
                  {isListening ? (
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                      Listening
                    </Badge>
                  ) : (
                    <span>Press Speak to start</span>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default VoiceAssistant;
