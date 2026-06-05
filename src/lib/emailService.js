// lib/emailService.js
import { Resend } from 'resend';

// Initialize Resend with API key
const resend = new Resend(process.env.RESEND_API_KEY);

export const emailService = {
  // Send test email
  async sendTestEmail({ to, siteName, smtpConfig }) {
    try {
      const { data, error } = await resend.emails.send({
        from: `${siteName} <noreply@${smtpConfig.domain || 'smartfarmer.com'}>`,
        to: [to],
        subject: `Test Email from ${siteName}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 30px; text-align: center; }
              .content { padding: 30px; background: #f9fafb; }
              .info { background: #e5e7eb; padding: 15px; border-radius: 8px; margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>✅ Test Email Successful!</h1>
              </div>
              <div class="content">
                <h2>Hello Admin,</h2>
                <p>This test confirms your email configuration is working correctly!</p>
                <div class="info">
                  <strong>Details:</strong><br>
                  Time: ${new Date().toLocaleString()}<br>
                  SMTP: ${smtpConfig.host}:${smtpConfig.port}
                </div>
                <p>Your Smart Farmer system is now ready to send notifications.</p>
              </div>
            </div>
          </body>
          </html>
        `,
      });

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error sending email:', error);
      return { success: false, error: error.message };
    }
  },

  // Send welcome email to new users
  async sendWelcomeEmail({ to, name, siteName }) {
    try {
      const { data, error } = await resend.emails.send({
        from: `${siteName} <welcome@smartfarmer.com>`,
        to: [to],
        subject: `Welcome to ${siteName}!`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #667eea, #764ba2); padding: 30px; text-align: center; color: white;">
              <h1>Welcome ${name}!</h1>
            </div>
            <div style="padding: 30px;">
              <p>Thank you for joining ${siteName}. We're excited to have you on board!</p>
              <p>Get started by exploring our platform and connecting with other farmers.</p>
              <a href="https://yourdomain.com/dashboard" style="display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 6px;">Go to Dashboard</a>
            </div>
          </div>
        `,
      });

      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Send password reset email
  async sendPasswordResetEmail({ to, resetLink, siteName }) {
    try {
      const { data, error } = await resend.emails.send({
        from: `${siteName} <security@smartfarmer.com>`,
        to: [to],
        subject: `Password Reset Request - ${siteName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #f59e0b; padding: 30px; text-align: center; color: white;">
              <h1>Password Reset</h1>
            </div>
            <div style="padding: 30px;">
              <p>You requested to reset your password. Click the button below to proceed:</p>
              <a href="${resetLink}" style="display: inline-block; padding: 12px 24px; background: #f59e0b; color: white; text-decoration: none; border-radius: 6px;">Reset Password</a>
              <p>This link will expire in 1 hour.</p>
              <p>If you didn't request this, please ignore this email.</p>
            </div>
          </div>
        `,
      });

      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
};