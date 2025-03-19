/**
 * Email configuration for authentication module
 * Using console logging for development without external dependencies
 */
const isDevelopment = process.env.NODE_ENV === 'development';

const emailConfig = {
  // Email transport configuration for development
  transport: {
    // Development mode - just log to console
    sendMail: (mailOptions, callback) => {
      console.log('========== EMAIL WOULD BE SENT ==========');
      console.log('To:', mailOptions.to);
      console.log('Subject:', mailOptions.subject);
      console.log('Text:', mailOptions.text);
      console.log('HTML:', mailOptions.html ? '[HTML Content]' : 'None');
      console.log('=========================================');
      
      // Simulate successful sending
      if (callback) {
        callback(null, {
          messageId: `mock_${Date.now()}`,
          response: 'Mock email sent successfully'
        });
      }
      
      return Promise.resolve({
        messageId: `mock_${Date.now()}`,
        response: 'Mock email sent successfully'
      });
    }
  },
  
  // Default sender address
  from: 'Support Hub <noreply@supporthub.example.com>',
  
  // Email templates will be added here or in a separate file
  templates: {
    verification: {
      subject: 'Verify Your Email Address',
      text: (token) => `Please verify your email by entering this code: ${token}`,
    },
    passwordReset: {
      subject: 'Password Reset Request',
      text: (token) => `Your password reset code is: ${token}`,
    },
    welcome: {
      subject: 'Welcome to Support Hub',
      text: (name) => `Welcome to Support Hub, ${name}!`,
    }
  }
};

module.exports = emailConfig;
