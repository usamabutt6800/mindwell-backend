const nodemailer = require('nodemailer');
const emailLogger = require('./emailLogger');

class GmailSender {
  constructor() {
    this.transporter = null;
    this.isConfigured = false;
    this.configure();
  }

  configure() {
    // Check if Gmail credentials are in .env
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      try {
        this.transporter = nodemailer.createTransport({
          host: process.env.EMAIL_HOST || 'smtp.gmail.com',
          port: parseInt(process.env.EMAIL_PORT) || 587,
          secure: process.env.EMAIL_SECURE === 'true',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS.replace(/\s/g, '') // Remove spaces
          },
          tls: {
            rejectUnauthorized: false
          }
        });
        
        this.isConfigured = true;
        console.log('✅ Gmail sender configured successfully');
        console.log(`📧 Using email: ${process.env.EMAIL_USER}`);
      } catch (error) {
        console.error('❌ Gmail configuration error:', error.message);
        this.isConfigured = false;
      }
    } else {
      console.log('⚠️  Gmail not configured - emails will be logged only');
      console.log('💡 Add EMAIL_USER and EMAIL_PASS to .env file to enable real emails');
    }
  }

  async sendEmail(to, subject, html, text = '') {
    const emailId = `email-${Date.now()}`;
    
    // Always log the email attempt
    emailLogger.logEmail(to, subject, 'email_attempt', `Attempting to send: ${subject}`);
    
    // If Gmail is not configured, just log and return
    if (!this.isConfigured) {
      console.log(`📧 [LOGGED ONLY] Would send to ${to}: ${subject}`);
      return {
        success: true,
        mode: 'logged_only',
        emailId,
        message: 'Email logged (Gmail not configured)'
      };
    }
    
    // Prepare email options
    const mailOptions = {
      from: process.env.EMAIL_FROM || `"MindWell Psychology" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
      text: text || this.htmlToText(html)
    };
    
    try {
      console.log(`📧 Attempting to send real email to: ${to}`);
      
      // Send the email
      const info = await this.transporter.sendMail(mailOptions);
      
      console.log(`✅ Email sent successfully: ${info.messageId}`);
      
      // Log success
      emailLogger.logEmail(to, subject, 'email_sent', `Sent successfully. Message ID: ${info.messageId}`);
      
      return {
        success: true,
        mode: 'real_email',
        messageId: info.messageId,
        emailId,
        info: {
          accepted: info.accepted,
          rejected: info.rejected,
          response: info.response
        }
      };
      
    } catch (error) {
      console.error(`❌ Email sending failed to ${to}:`, error.message);
      
      // Log the error
      emailLogger.logEmail(to, subject, 'email_failed', `Failed: ${error.message}`);
      
      return {
        success: false,
        mode: 'real_email',
        error: error.message,
        emailId,
        message: 'Email sending failed'
      };
    }
  }

  htmlToText(html) {
    if (!html) return '';
    return html
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Test function
  async testConnection() {
    console.log('🧪 Testing Gmail connection...');
    
    if (!this.isConfigured) {
      console.log('⚠️  Gmail not configured - test skipped');
      return {
        success: false,
        configured: false,
        message: 'Gmail not configured. Add EMAIL_USER and EMAIL_PASS to .env'
      };
    }
    
    try {
      // Verify connection
      await this.transporter.verify();
      console.log('✅ Gmail connection verified successfully');
      
      // Send test email
      const testResult = await this.sendEmail(
        process.env.EMAIL_USER, // Send test to yourself
        'Gmail Test - MindWell Psychology',
        `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2 style="color: #4CAF50;">✅ Gmail Test Successful!</h2>
            <p>Your MindWell Psychology email system is working correctly.</p>
            <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
            <p><strong>Service:</strong> Gmail SMTP</p>
            <p><strong>From:</strong> ${process.env.EMAIL_FROM || process.env.EMAIL_USER}</p>
            <hr>
            <p>You can now send real emails to clients!</p>
          </div>
        `
      );
      
      return {
        success: testResult.success,
        configured: true,
        testResult
      };
      
    } catch (error) {
      console.error('❌ Gmail test failed:', error.message);
      return {
        success: false,
        configured: true,
        error: error.message,
        message: 'Gmail configuration error. Check your credentials.'
      };
    }
  }

  // Email templates
  templates = {
    appointmentConfirmation: (appointment) => {
      const date = new Date(appointment.appointmentDate);
      const formattedDate = date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { padding: 30px; background: #f9f9f9; border-radius: 0 0 10px 10px; }
            .appointment-card { background: white; border-radius: 8px; padding: 20px; margin: 20px 0; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Appointment Confirmed</h1>
            <p>MindWell Psychology</p>
          </div>
          
          <div class="content">
            <p>Dear <strong>${appointment.clientName}</strong>,</p>
            
            <p>Thank you for booking an appointment with MindWell Psychology. Your appointment has been confirmed with the following details:</p>
            
            <div class="appointment-card">
              <h3 style="margin-top: 0; color: #333;">Appointment Details</h3>
              <table style="width: 100%;">
                <tr>
                  <td style="padding: 8px 0; color: #666;"><strong>Date:</strong></td>
                  <td style="padding: 8px 0;">${formattedDate}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;"><strong>Time:</strong></td>
                  <td style="padding: 8px 0;">${appointment.appointmentTime}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;"><strong>Service:</strong></td>
                  <td style="padding: 8px 0; text-transform: capitalize;">${appointment.serviceType}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;"><strong>Status:</strong></td>
                  <td style="padding: 8px 0;">
                    <span style="background: #4CAF50; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold;">CONFIRMED</span>
                  </td>
                </tr>
              </table>
            </div>
            
            <p><strong>Important Notes:</strong></p>
            <ul>
              <li>Please arrive 10-15 minutes before your scheduled time</li>
              <li>Bring any relevant medical records or documents</li>
              <li>Contact us at least 24 hours in advance if you need to reschedule</li>
            </ul>
            
            <p>Best regards,<br>
            <strong>The MindWell Psychology Team</strong></p>
          </div>
        </body>
        </html>
      `;
    },

    contactReply: (contact, replyMessage) => {
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2196F3; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { padding: 25px; background: #f5f5f5; border-radius: 0 0 8px 8px; }
            .message-box { background: white; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #2196F3; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>Response to Your Inquiry</h2>
            <p>MindWell Psychology</p>
          </div>
          
          <div class="content">
            <p>Dear <strong>${contact.name}</strong>,</p>
            
            <p>Thank you for contacting MindWell Psychology. Here is our response:</p>
            
            <div class="message-box">
              <p>${replyMessage.replace(/\n/g, '<br>')}</p>
            </div>
            
            <p>If you have further questions or would like to schedule an appointment, please don't hesitate to contact us.</p>
            
            <p>Warm regards,<br>
            <strong>The MindWell Psychology Team</strong></p>
          </div>
        </body>
        </html>
      `;
    }
  };
}

module.exports = new GmailSender();