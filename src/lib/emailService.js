// lib/emailService.js
import nodemailer from 'nodemailer';

class EmailService {
  constructor() {
    this.transporter = null;
    this.isConfigured = false;
  }

  // Initialize email service with settings
  initialize(settings) {
    if (!settings.smtp_host || !settings.smtp_user || !settings.smtp_password) {
      console.warn('Email service not configured: Missing SMTP settings');
      this.isConfigured = false;
      return false;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: settings.smtp_host,
        port: parseInt(settings.smtp_port) || 587,
        secure: settings.smtp_port === '465',
        auth: {
          user: settings.smtp_user,
          pass: settings.smtp_password,
        },
        tls: {
          rejectUnauthorized: false,
        },
      });

      this.isConfigured = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize email service:', error);
      this.isConfigured = false;
      return false;
    }
  }

  // Send email
  async sendEmail({ to, subject, html, text }) {
    if (!this.isConfigured || !this.transporter) {
      console.error('Email service not configured');
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const info = await this.transporter.sendMail({
        from: `"Smart Farmer" <${process.env.SMTP_USER || 'noreply@smartfarmer.com'}>`,
        to,
        subject,
        html,
        text,
      });

      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Failed to send email:', error);
      return { success: false, error: error.message };
    }
  }

  // Send notification to user
  async sendNotification({ to, userName, type, data }) {
    const templates = {
      welcome: {
        subject: `Welcome to Smart Farmer, ${userName}!`,
        template: this.getWelcomeTemplate,
      },
      ad_approved: {
        subject: 'Your Advertisement Has Been Approved!',
        template: this.getAdApprovedTemplate,
      },
      ad_rejected: {
        subject: 'Your Advertisement Needs Review',
        template: this.getAdRejectedTemplate,
      },
      subscription_expiring: {
        subject: 'Your Subscription is Expiring Soon',
        template: this.getSubscriptionExpiringTemplate,
      },
      payment_received: {
        subject: 'Payment Received Successfully',
        template: this.getPaymentReceivedTemplate,
      },
      campaign_completed: {
        subject: 'Your Campaign Has Completed',
        template: this.getCampaignCompletedTemplate,
      },
      new_message: {
        subject: 'New Message Received',
        template: this.getNewMessageTemplate,
      },
    };

    const template = templates[type];
    if (!template) {
      return { success: false, error: 'Invalid notification type' };
    }

    const html = template.template({ userName, ...data });
    const text = this.stripHtml(html);

    return await this.sendEmail({
      to,
      subject: template.subject,
      html,
      text,
    });
  }

  // Email Templates
  getWelcomeTemplate({ userName, siteName = 'Smart Farmer' }) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; border-radius: 16px 16px 0 0; }
          .content { background: white; padding: 40px 30px; border-radius: 0 0 16px 16px; }
          .button { display: inline-block; padding: 12px 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 8px; margin-top: 20px; }
          .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to ${siteName}! 🎉</h1>
          </div>
          <div class="content">
            <h2>Hello ${userName},</h2>
            <p>Thank you for joining ${siteName}! We're excited to have you on board.</p>
            <p>With ${siteName}, you can:</p>
            <ul>
              <li>Create and manage advertising campaigns</li>
              <li>Reach your target audience effectively</li>
              <li>Track performance with real-time analytics</li>
              <li>Get insights to optimize your campaigns</li>
            </ul>
            <div style="text-align: center;">
              <a href="https://yourdomain.com/dashboard" class="button">Go to Dashboard</a>
            </div>
            <p>If you have any questions, our support team is here to help!</p>
            <p>Best regards,<br>The ${siteName} Team</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} ${siteName}. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getAdApprovedTemplate({ title, startDate, endDate, siteName = 'Smart Farmer' }) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 30px; text-align: center; border-radius: 16px 16px 0 0; }
          .content { background: white; padding: 30px; border-radius: 0 0 16px 16px; }
          .info-box { background: #f0fdf4; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Advertisement Approved!</h1>
          </div>
          <div class="content">
            <h2>Great News!</h2>
            <p>Your advertisement "<strong>${title}</strong>" has been approved and is now live!</p>
            <div class="info-box">
              <strong>📅 Campaign Details:</strong><br>
              Start Date: ${new Date(startDate).toLocaleDateString()}<br>
              End Date: ${new Date(endDate).toLocaleDateString()}
            </div>
            <p>Your ad will now be shown to your target audience. Track its performance in your dashboard.</p>
            <div style="text-align: center;">
              <a href="https://yourdomain.com/dashboard" style="display: inline-block; padding: 12px 24px; background: #10b981; color: white; text-decoration: none; border-radius: 8px;">View Campaign</a>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getAdRejectedTemplate({ title, reason, siteName = 'Smart Farmer' }) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #ef4444, #dc2626); color: white; padding: 30px; text-align: center; border-radius: 16px 16px 0 0; }
          .content { background: white; padding: 30px; border-radius: 0 0 16px 16px; }
          .reason-box { background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Advertisement Update</h1>
          </div>
          <div class="content">
            <h2>Your Advertisement Needs Attention</h2>
            <p>Your advertisement "<strong>${title}</strong>" requires changes before it can be approved.</p>
            <div class="reason-box">
              <strong>📝 Reason for rejection:</strong><br>
              ${reason}
            </div>
            <p>Please review the feedback and resubmit your advertisement with the required changes.</p>
            <div style="text-align: center;">
              <a href="https://yourdomain.com/dashboard" style="display: inline-block; padding: 12px 24px; background: #ef4444; color: white; text-decoration: none; border-radius: 8px;">Edit Advertisement</a>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getSubscriptionExpiringTemplate({ packageName, daysLeft, renewUrl, siteName = 'Smart Farmer' }) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 30px; text-align: center; border-radius: 16px 16px 0 0; }
          .content { background: white; padding: 30px; border-radius: 0 0 16px 16px; }
          .warning-box { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚠️ Subscription Expiring Soon</h1>
          </div>
          <div class="content">
            <h2>Your ${packageName} package is expiring!</h2>
            <div class="warning-box">
              <strong>⏰ Only ${daysLeft} days remaining!</strong><br>
              Renew now to avoid interruption of your services.
            </div>
            <p>Don't lose your active campaigns and benefits. Renew your subscription today!</p>
            <div style="text-align: center;">
              <a href="${renewUrl}" style="display: inline-block; padding: 12px 24px; background: #f59e0b; color: white; text-decoration: none; border-radius: 8px;">Renew Now</a>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getPaymentReceivedTemplate({ amount, packageName, transactionId, siteName = 'Smart Farmer' }) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 30px; text-align: center; border-radius: 16px 16px 0 0; }
          .content { background: white; padding: 30px; border-radius: 0 0 16px 16px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>💰 Payment Received!</h1>
          </div>
          <div class="content">
            <h2>Thank you for your payment!</h2>
            <p>We have successfully received your payment of <strong>$${amount}</strong> for the <strong>${packageName}</strong> package.</p>
            <p><strong>Transaction ID:</strong> ${transactionId}</p>
            <p>Your subscription is now active. You can start creating campaigns immediately!</p>
            <div style="text-align: center;">
              <a href="https://yourdomain.com/dashboard" style="display: inline-block; padding: 12px 24px; background: #10b981; color: white; text-decoration: none; border-radius: 8px;">Go to Dashboard</a>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getCampaignCompletedTemplate({ title, clicks, impressions, ctr, siteName = 'Smart Farmer' }) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; padding: 30px; text-align: center; border-radius: 16px 16px 0 0; }
          .content { background: white; padding: 30px; border-radius: 0 0 16px 16px; }
          .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin: 20px 0; }
          .stat { text-align: center; padding: 15px; background: #f8f9fa; border-radius: 12px; }
          .stat-value { font-size: 24px; font-weight: bold; color: #3b82f6; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📊 Campaign Completed!</h1>
          </div>
          <div class="content">
            <h2>Your campaign "${title}" has completed!</h2>
            <div class="stats">
              <div class="stat">
                <div class="stat-value">${impressions.toLocaleString()}</div>
                <div>Impressions</div>
              </div>
              <div class="stat">
                <div class="stat-value">${clicks.toLocaleString()}</div>
                <div>Clicks</div>
              </div>
              <div class="stat">
                <div class="stat-value">${ctr}%</div>
                <div>CTR</div>
              </div>
            </div>
            <p>View detailed analytics and insights for this campaign in your dashboard.</p>
            <div style="text-align: center;">
              <a href="https://yourdomain.com/dashboard" style="display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 8px;">View Analytics</a>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getNewMessageTemplate({ fromUser, message, siteName = 'Smart Farmer' }) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #8b5cf6, #7c3aed); color: white; padding: 30px; text-align: center; border-radius: 16px 16px 0 0; }
          .content { background: white; padding: 30px; border-radius: 0 0 16px 16px; }
          .message-box { background: #f3f4f6; padding: 15px; border-radius: 12px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>💬 New Message Received</h1>
          </div>
          <div class="content">
            <h2>You have a new message from ${fromUser}</h2>
            <div class="message-box">
              <strong>Message:</strong><br>
              "${message}"
            </div>
            <div style="text-align: center;">
              <a href="https://yourdomain.com/messages" style="display: inline-block; padding: 12px 24px; background: #8b5cf6; color: white; text-decoration: none; border-radius: 8px;">View Message</a>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  stripHtml(html) {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }
}

export default new EmailService();