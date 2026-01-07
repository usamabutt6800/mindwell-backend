const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

class EmailService {
  constructor() {
    this.transporter = this.createTransporter();
    this.logsDir = path.join(__dirname, '../../logs');
    this.ensureLogsDirectory();
    console.log('📧 Email service initialized');
  }

  ensureLogsDirectory() {
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  createTransporter() {
    // Check if Gmail credentials exist
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      console.log('✅ Using Gmail SMTP');
      return nodemailer.createTransport({
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: process.env.EMAIL_PORT || 587,
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS.replace(/\s/g, '') // Remove spaces from app password
        },
        tls: {
          rejectUnauthorized: false
        }
      });
    } else {
      console.log('⚠️  Using development mode (emails logged to file)');
      return {
        sendMail: (mailOptions) => this.logToFile(mailOptions)
      };
    }
  }

  async logToFile(mailOptions) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      to: mailOptions.to,
      subject: mailOptions.subject,
      html: mailOptions.html,
      from: mailOptions.from,
      status: 'logged'
    };

    const logFile = path.join(this.logsDir, 'email-logs.json');
    let logs = [];
    
    if (fs.existsSync(logFile)) {
      const content = fs.readFileSync(logFile, 'utf8');
      if (content.trim()) {
        logs = JSON.parse(content);
      }
    }
    
    logs.push(logEntry);
    fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));
    
    console.log('📧 Email logged to file:', { 
      to: mailOptions.to, 
      subject: mailOptions.subject 
    });

    return { 
      messageId: `dev-${Date.now()}`,
      timestamp 
    };
  }

  async sendEmail(to, subject, html) {
    try {
      console.log('📧 Attempting to send email to:', to);
      
      const mailOptions = {
        from: process.env.EMAIL_FROM || '"MindWell Psychology" <noreply@mindwell.com>',
        to,
        subject,
        html,
        text: html.replace(/<[^>]*>/g, ' ') // Plain text version
      };

      // Always log first
      await this.logToFile(mailOptions);
      
      // Send real email if Gmail is configured
      if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        const info = await this.transporter.sendMail(mailOptions);
        console.log('✅ Email sent successfully:', info.messageId);
        
        // Log success
        this.saveSuccessLog(to, subject, info.messageId);
        
        return {
          success: true,
          messageId: info.messageId,
          service: 'gmail',
          timestamp: new Date().toISOString()
        };
      }
      
      console.log('📧 Development mode - email logged only');
      return {
        success: true,
        messageId: `dev-${Date.now()}`,
        service: 'development',
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('❌ Email error:', error.message);
      this.saveErrorLog(to, subject, error);
      
      return {
        success: false,
        error: error.message,
        service: process.env.EMAIL_USER ? 'gmail' : 'development'
      };
    }
  }

  saveSuccessLog(to, subject, messageId) {
    const successLog = {
      timestamp: new Date().toISOString(),
      to,
      subject,
      messageId,
      status: 'sent'
    };

    const successFile = path.join(this.logsDir, 'email-success.json');
    let successes = [];
    
    if (fs.existsSync(successFile)) {
      const content = fs.readFileSync(successFile, 'utf8');
      if (content.trim()) {
        successes = JSON.parse(content);
      }
    }
    
    successes.push(successLog);
    fs.writeFileSync(successFile, JSON.stringify(successes, null, 2));
  }

  saveErrorLog(to, subject, error) {
    const errorLog = {
      timestamp: new Date().toISOString(),
      to,
      subject,
      error: error.message,
      stack: error.stack
    };

    const errorFile = path.join(this.logsDir, 'email-errors.json');
    let errors = [];
    
    if (fs.existsSync(errorFile)) {
      const content = fs.readFileSync(errorFile, 'utf8');
      if (content.trim()) {
        errors = JSON.parse(content);
      }
    }
    
    errors.push(errorLog);
    fs.writeFileSync(errorFile, JSON.stringify(errors, null, 2));
  }

  // Simple email templates
  templates = {
    appointmentConfirmation: (appointment) => `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4CAF50;">Appointment Confirmed!</h2>
        <p>Dear ${appointment.clientName},</p>
        <p>Your appointment with MindWell Psychology has been confirmed.</p>
        
        <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <h3 style="margin-top: 0;">Appointment Details:</h3>
          <p><strong>Date:</strong> ${new Date(appointment.appointmentDate).toLocaleDateString()}</p>
          <p><strong>Time:</strong> ${appointment.appointmentTime}</p>
          <p><strong>Service:</strong> ${appointment.serviceType}</p>
          <p><strong>Status:</strong> <span style="color: #4CAF50; font-weight: bold;">Confirmed</span></p>
        </div>
        
        <p>Please arrive 10 minutes before your scheduled time.</p>
        <p>Best regards,<br>The MindWell Psychology Team</p>
      </div>
    `,

    contactReply: (contact, reply) => `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2196F3;">Response to Your Inquiry</h2>
        <p>Dear ${contact.name},</p>
        <p>Thank you for contacting MindWell Psychology.</p>
        
        <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <p><strong>Our Response:</strong></p>
          <p>${reply}</p>
        </div>
        
        <p>Best regards,<br>The MindWell Psychology Team</p>
      </div>
    `
  };

  // Test function
  async testConnection() {
    try {
      console.log('🧪 Testing email connection...');
      
      const testResult = await this.sendEmail(
        process.env.EMAIL_USER, // Send test to yourself
        'Test Email - MindWell Psychology',
        '<h1>Test Successful!</h1><p>Your email system is working correctly.</p>'
      );
      
      if (testResult.success) {
        console.log('✅ Email test passed!');
      } else {
        console.log('❌ Email test failed:', testResult.error);
      }
      
      return testResult;
    } catch (error) {
      console.error('❌ Test error:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new EmailService();