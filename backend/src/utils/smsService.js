const fs = require('fs');
const path = require('path');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// For development, just log SMS to console and file
const sendSMS = async (to, message) => {
  try {
    console.log('📱 [DEV MODE] SMS would be sent:');
    console.log('📱 To:', to);
    console.log('📱 Message:', message.substring(0, 100) + (message.length > 100 ? '...' : ''));
    
    // Create a formatted log entry
    const timestamp = new Date().toISOString();
    const smsLog = `
==========================================
📱 SMS LOG
Time: ${timestamp}
To: ${to}
Message: ${message}
==========================================
`;
    
    // Save to log file
    const logFile = path.join(logsDir, 'sms-logs.txt');
    fs.appendFileSync(logFile, smsLog + '\n\n');
    console.log('📱 SMS saved to:', logFile);
    
    // In production, you would use Twilio or other SMS service here
    // Example with Twilio:
    /*
    if (process.env.NODE_ENV === 'production' && process.env.TWILIO_ACCOUNT_SID) {
      const client = require('twilio')(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
      
      const result = await client.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: to
      });
      
      return {
        success: true,
        messageId: result.sid,
        status: result.status
      };
    }
    */
    
    // For development, return success
    return {
      success: true,
      logId: Date.now(),
      timestamp: timestamp,
      message: 'SMS logged for development'
    };
    
  } catch (error) {
    console.error('❌ SMS error:', error);
    
    // Save error to error log
    const timestamp = new Date().toISOString();
    const errorLog = `
==========================================
❌ SMS ERROR
Time: ${timestamp}
To: ${to}
Error: ${error.message}
Stack: ${error.stack}
==========================================
`;
    
    try {
      const errorFile = path.join(logsDir, 'sms-errors.txt');
      fs.appendFileSync(errorFile, errorLog + '\n\n');
    } catch (logError) {
      console.error('Error saving SMS error log:', logError);
    }
    
    return {
      success: false,
      error: error.message
    };
  }
};

// SMS templates for different scenarios
const smsTemplates = {
  appointmentConfirmed: (appointment) => {
    const date = new Date(appointment.appointmentDate);
    const formattedDate = date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    
    return `Hi ${appointment.clientName}, your appointment is confirmed for ${formattedDate} at ${appointment.appointmentTime}. Please arrive 10 mins early. - MindWell Psychology`;
  },
  
  appointmentCancelled: (appointment) => {
    const date = new Date(appointment.appointmentDate);
    const formattedDate = date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
    
    return `Hi ${appointment.clientName}, your appointment on ${formattedDate} has been cancelled. Call (123) 456-7890 to reschedule. - MindWell Psychology`;
  },
  
  appointmentReminder: (appointment) => {
    return `Reminder: Your appointment with MindWell Psychology is tomorrow at ${appointment.appointmentTime}. Please call if you need to reschedule.`;
  },
  
  appointmentCompleted: (appointment) => {
    return `Thank you for your session today. Your next appointment is scheduled. Please complete any assigned exercises. - MindWell Psychology`;
  },
  
  contactReply: (contact) => {
    return `Hi ${contact.name}, we've replied to your inquiry. Please check your email. - MindWell Psychology`;
  }
};

// Test function to verify SMS service is working
const testSMS = async () => {
  console.log('🧪 Testing SMS service...');
  const testResult = await sendSMS('+1234567890', 'Test SMS from MindWell Psychology');
  console.log('🧪 Test result:', testResult.success ? '✅ Success' : '❌ Failed');
  return testResult;
};

module.exports = {
  sendSMS,
  smsTemplates,
  testSMS
};