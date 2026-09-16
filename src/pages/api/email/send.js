// pages/api/email/send.js
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { type, to, data } = req.body;

    if (!to) {
      return res.status(400).json({ error: 'Recipient email is required' });
    }

    // Get SMTP settings from database
    const { data: settings, error: settingsError } = await supabase
      .from('system_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_password', 'site_name', 'enable_notifications']);

    const smtpSettings = {};
    if (!settingsError && settings) {
      settings.forEach(setting => {
        smtpSettings[setting.setting_key] = setting.setting_value;
      });
    } else {
      console.error('Error fetching settings, using defaults for console logging fallback:', settingsError);
    }

    // Check if email notifications are enabled - be lenient with 'true' string or boolean true
    const isEnabled = smtpSettings.enable_notifications === 'true' || smtpSettings.enable_notifications === true;

    // Check if SMTP settings are fully configured
    const isSmtpConfigured = smtpSettings.smtp_host && smtpSettings.smtp_user && smtpSettings.smtp_password;

    // If notifications are disabled, or SMTP is not fully configured, fall back to console logging
    if (!isEnabled || !isSmtpConfigured) {
      console.log(`[SIMULATED EMAIL] Email notifications are disabled or SMTP settings are not fully configured. Logging email to console:`);
      console.log(`To: ${to}`);
      console.log(`Type: ${type}`);
      console.log(`Data:`, JSON.stringify(data, null, 2));
      return res.status(200).json({
        success: true,
        simulated: true,
        message: !isEnabled ? 'Email notifications are disabled. Logged to server console.' : 'SMTP settings are not fully configured. Logged to server console.'
      });
    }

    const port = parseInt(smtpSettings.smtp_port) || 587;

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: smtpSettings.smtp_host,
      port: port,
      secure: port === 465, // Use SSL for port 465
      auth: {
        user: smtpSettings.smtp_user,
        pass: smtpSettings.smtp_password,
      },
      tls: {
        rejectUnauthorized: false, // Helps with self-signed certs or common hosting issues
      },
    });

    // Verify connection
    try {
      await transporter.verify();
      console.log('SMTP connection verified successfully');
    } catch (verifyError) {
      console.error('SMTP verification failed, falling back to console logging:', verifyError);
      console.log(`[SIMULATED EMAIL] SMTP verification failed. Logging email to console:`);
      console.log(`To: ${to}`);
      console.log(`Type: ${type}`);
      console.log(`Data:`, JSON.stringify(data, null, 2));
      return res.status(200).json({
        success: true,
        simulated: true,
        message: 'SMTP connection failed. Logged to server console.',
        details: verifyError.message
      });
    }

    // Email templates for different notification types
    const templates = {
      // Admin Welcome Email Template
      admin_welcome: {
        subject: `Welcome to ${data.siteName || smtpSettings.site_name || 'Smart Farmer'} - Your Admin Account Details`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                background: #f5f5f5;
                margin: 0;
                padding: 20px;
              }
              .container {
                max-width: 600px;
                margin: 0 auto;
                background: white;
                border-radius: 16px;
                overflow: hidden;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
              }
              .header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 40px 30px;
                text-align: center;
              }
              .header h1 {
                margin: 0;
                font-size: 28px;
              }
              .content {
                padding: 40px 30px;
              }
              .credentials {
                background: #f8f9fa;
                padding: 20px;
                border-radius: 12px;
                margin: 20px 0;
              }
              .credential-item {
                display: flex;
                margin-bottom: 12px;
                padding-bottom: 12px;
                border-bottom: 1px solid #e9ecef;
              }
              .credential-label {
                width: 100px;
                font-weight: 600;
                color: #374151;
              }
              .credential-value {
                flex: 1;
                font-family: monospace;
                font-size: 14px;
                color: #4f46e5;
              }
              .warning {
                background: #fef3c7;
                padding: 15px;
                border-radius: 8px;
                margin: 20px 0;
                font-size: 13px;
                color: #92400e;
              }
              .button {
                display: inline-block;
                padding: 12px 30px;
                background: linear-gradient(135deg, #667eea, #764ba2);
                color: white;
                text-decoration: none;
                border-radius: 8px;
                margin-top: 20px;
              }
              .footer {
                text-align: center;
                padding: 20px;
                font-size: 12px;
                color: #666;
                border-top: 1px solid #e9ecef;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Welcome to ${data.siteName || smtpSettings.site_name || 'Smart Farmer'}!</h1>
              </div>
              <div class="content">
                <h2>Hello ${data.userName},</h2>
                <p>Your administrator account has been created successfully. Below are your login credentials:</p>
                
                <div class="credentials">
                  <div class="credential-item">
                    <div class="credential-label">Email:</div>
                    <div class="credential-value">${data.email}</div>
                  </div>
                  <div class="credential-item">
                    <div class="credential-label">Password:</div>
                    <div class="credential-value">${data.password}</div>
                  </div>
                  <div class="credential-item">
                    <div class="credential-label">Role:</div>
                    <div class="credential-value">${data.role || 'Administrator'}</div>
                  </div>
                </div>

                <div class="warning">
                  <strong>⚠️ Important Security Notice:</strong><br>
                  Please change your password after your first login for security purposes. Do not share your credentials with anyone.
                </div>

                <div style="text-align: center;">
                  <a href="${data.loginUrl}" class="button">Login to Dashboard</a>
                </div>

                <p style="margin-top: 30px; font-size: 14px;">
                  If you have any questions or need assistance, please contact the system administrator.
                </p>
              </div>
              <div class="footer">
                <p>This is an automated message from ${data.siteName || smtpSettings.site_name || 'Smart Farmer'}. Please do not reply.</p>
                <p>&copy; ${new Date().getFullYear()} ${data.siteName || smtpSettings.site_name || 'Smart Farmer'}. All rights reserved.</p>
              </div>
            </div>
          </body>
          </html>
        `,
      },
      
      // Advertisement Templates
      ad_approved: {
        subject: `✅ Campaign Approved - ${data.title || 'Smart Farmer'}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; margin: 0; padding: 20px; }
              .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
              .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 40px 30px; text-align: center; }
              .header h1 { margin: 0; font-size: 28px; }
              .content { padding: 40px 30px; }
              .details { background: #f8f9fa; padding: 20px; border-radius: 12px; margin: 20px 0; }
              .button { display: inline-block; padding: 12px 30px; background: #10b981; color: white; text-decoration: none; border-radius: 8px; margin-top: 20px; }
              .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; border-top: 1px solid #e9ecef; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>✅ Campaign Approved!</h1>
              </div>
              <div class="content">
                <h2>Hello ${data.userName || 'User'},</h2>
                <p>Great news! Your advertising campaign has been approved and is now live.</p>
                <div class="details">
                  <strong>📋 Campaign Details:</strong><br>
                  Title: ${data.title}<br>
                  Start Date: ${new Date(data.startDate).toLocaleString()}<br>
                  End Date: ${new Date(data.endDate).toLocaleString()}
                </div>
                <div style="text-align: center;">
                  <a href="${data.loginUrl || 'https://yourdomain.com/dashboard'}" class="button">View Campaign</a>
                </div>
              </div>
              <div class="footer">
                <p>This is an automated message from ${smtpSettings.site_name || 'Smart Farmer'}. Please do not reply.</p>
              </div>
            </div>
          </body>
          </html>
        `,
      },
      ad_rejected: {
        subject: `❌ Campaign Update - ${data.title || 'Smart Farmer'}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; background: #f5f5f5; margin: 0; padding: 20px; }
              .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
              .header { background: linear-gradient(135deg, #ef4444, #dc2626); color: white; padding: 30px; text-align: center; }
              .header h1 { margin: 0; font-size: 28px; }
              .content { padding: 30px; }
              .reason { background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px 20px; margin: 20px 0; border-radius: 8px; }
              .button { display: inline-block; padding: 12px 30px; background: #ef4444; color: white; text-decoration: none; border-radius: 8px; }
              .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; border-top: 1px solid #e9ecef; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>❌ Campaign Update</h1>
              </div>
              <div class="content">
                <h2>Hello ${data.userName || 'User'},</h2>
                <p>Your campaign requires changes before it can be approved.</p>
                <div class="reason">
                  <strong>📝 Reason:</strong><br>
                  ${data.reason}
                </div>
                <div style="text-align: center;">
                  <a href="${data.loginUrl || 'https://yourdomain.com/dashboard'}" class="button">Edit Campaign</a>
                </div>
              </div>
              <div class="footer">
                <p>This is an automated message from ${smtpSettings.site_name || 'Smart Farmer'}.</p>
              </div>
            </div>
          </body>
          </html>
        `,
      },
      
      // Barter Templates
      barter_approved: {
        subject: `✅ Barter Listing Approved - ${data.title || 'Smart Farmer'}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; background: #f5f5f5; margin: 0; padding: 20px; }
              .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
              .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 40px 30px; text-align: center; }
              .header h1 { margin: 0; font-size: 28px; }
              .content { padding: 40px 30px; }
              .details { background: #f8f9fa; padding: 20px; border-radius: 12px; margin: 20px 0; }
              .button { display: inline-block; padding: 12px 30px; background: #10b981; color: white; text-decoration: none; border-radius: 8px; margin-top: 20px; }
              .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; border-top: 1px solid #e9ecef; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>✅ Listing Approved!</h1>
              </div>
              <div class="content">
                <h2>Hello ${data.userName || 'User'},</h2>
                <p>Great news! Your barter listing has been approved and is now live on the platform.</p>
                <div class="details">
                  <strong>📋 Listing Details:</strong><br>
                  Title: ${data.title}<br>
                  Quantity: ${data.quantity} ${data.unit}<br>
                  Description: ${data.description || 'No description provided'}<br>
                  Approved At: ${new Date(data.approvedAt).toLocaleString()}
                </div>
                <div style="text-align: center;">
                  <a href="${data.loginUrl || 'https://yourdomain.com/barter'}" class="button">View My Listing</a>
                </div>
              </div>
              <div class="footer">
                <p>This is an automated message from ${smtpSettings.site_name || 'Smart Farmer'}.</p>
              </div>
            </div>
          </body>
          </html>
        `,
      },
      barter_rejected: {
        subject: `❌ Barter Listing Update - ${data.title || 'Smart Farmer'}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; background: #f5f5f5; margin: 0; padding: 20px; }
              .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
              .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 40px 30px; text-align: center; }
              .header h1 { margin: 0; font-size: 28px; }
              .content { padding: 40px 30px; }
              .reason-box { background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px 20px; margin: 20px 0; border-radius: 8px; }
              .button { display: inline-block; padding: 12px 30px; background: #ef4444; color: white; text-decoration: none; border-radius: 8px; margin-top: 20px; }
              .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; border-top: 1px solid #e9ecef; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>❌ Listing Update</h1>
              </div>
              <div class="content">
                <h2>Hello ${data.userName || 'User'},</h2>
                <p>Your barter listing requires changes before it can be approved.</p>
                <div class="reason-box">
                  <strong>📝 Reason:</strong><br>
                  ${data.reason}
                </div>
                <p>Please review the feedback and update your listing accordingly.</p>
                <div style="text-align: center;">
                  <a href="${data.loginUrl || 'https://yourdomain.com/barter/edit/${data.listingId}'}" class="button">Edit Listing</a>
                </div>
              </div>
              <div class="footer">
                <p>This is an automated message from ${smtpSettings.site_name || 'Smart Farmer'}.</p>
              </div>
            </div>
          </body>
          </html>
        `,
      },
      
      // Welcome Email Template for Mobile Users
      welcome: {
        subject: `Welcome to ${smtpSettings.site_name || 'Smart Farmer'}!`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; background: #f5f5f5; margin: 0; padding: 20px; }
              .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; }
              .header h1 { margin: 0; font-size: 28px; }
              .content { padding: 40px 30px; }
              .features { display: flex; gap: 20px; margin: 30px 0; flex-wrap: wrap; }
              .feature { flex: 1; text-align: center; padding: 20px; background: #f8f9fa; border-radius: 12px; }
              .feature i { font-size: 32px; color: #667eea; margin-bottom: 10px; display: block; }
              .button { display: inline-block; padding: 12px 30px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; text-decoration: none; border-radius: 8px; margin-top: 20px; }
              .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; border-top: 1px solid #e9ecef; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Welcome to ${smtpSettings.site_name || 'Smart Farmer'}!</h1>
              </div>
              <div class="content">
                <h2>Hello ${data.userName || 'User'},</h2>
                <p>Thank you for joining ${smtpSettings.site_name || 'Smart Farmer'}! We're excited to have you on board.</p>
                <div class="features">
                  <div class="feature">
                    <i class="bi bi-megaphone"></i>
                    <strong>Advertise</strong>
                    <small>Reach more customers</small>
                  </div>
                  <div class="feature">
                    <i class="bi bi-arrow-left-right"></i>
                    <strong>Barter</strong>
                    <small>Trade products</small>
                  </div>
                  <div class="feature">
                    <i class="bi bi-graph-up"></i>
                    <strong>Analytics</strong>
                    <small>Track performance</small>
                  </div>
                </div>
                <div style="text-align: center;">
                  <a href="https://yourdomain.com/dashboard" class="button">Get Started</a>
                </div>
              </div>
              <div class="footer">
                <p>This is an automated message from ${smtpSettings.site_name || 'Smart Farmer'}.</p>
              </div>
            </div>
          </body>
          </html>
        `,
      },
      
      // Test Email Template
      test: {
        subject: `Test Email - ${smtpSettings.site_name || 'Smart Farmer'} Email Configuration`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; background: #f5f5f5; margin: 0; padding: 20px; }
              .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
              .header { background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 40px 30px; text-align: center; }
              .header h1 { margin: 0; font-size: 28px; }
              .content { padding: 40px 30px; }
              .details { background: #f8f9fa; padding: 20px; border-radius: 12px; margin: 20px 0; }
              .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; border-top: 1px solid #e9ecef; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>✅ Test Email Successful!</h1>
              </div>
              <div class="content">
                <h2>Hello Admin,</h2>
                <p>This is a test email to confirm that your email configuration is working correctly.</p>
                <div class="details">
                  <strong>📧 Configuration Details:</strong><br>
                  SMTP Host: ${smtpSettings.smtp_host}<br>
                  SMTP Port: ${smtpSettings.smtp_port}<br>
                  Username: ${smtpSettings.smtp_user}<br>
                  Time: ${new Date().toLocaleString()}
                </div>
                <p>Your Smart Farmer system is now ready to send notifications!</p>
              </div>
              <div class="footer">
                <p>This is an automated message from ${smtpSettings.site_name || 'Smart Farmer'}.</p>
              </div>
            </div>
          </body>
          </html>
        `,
      },
    };

    const template = templates[type];
    if (!template) {
      return res.status(400).json({ error: 'Invalid email type' });
    }

    // Send email
    try {
      const info = await transporter.sendMail({
        from: `${smtpSettings.site_name || 'Smart Farmer'} <${smtpSettings.smtp_user}>`,
        to: to,
        subject: template.subject,
        html: template.html,
      });

      console.log('Email sent successfully:', {
        messageId: info.messageId,
        to: to,
        type: type,
        timestamp: new Date().toISOString()
      });

      return res.status(200).json({
        success: true,
        message: 'Email sent successfully',
        messageId: info.messageId
      });
    } catch (sendError) {
      console.error('SMTP sendMail failed, falling back to console logging:', sendError);
      console.log(`[SIMULATED EMAIL] SMTP sendMail failed. Logging email to console:`);
      console.log(`To: ${to}`);
      console.log(`Type: ${type}`);
      console.log(`Data:`, JSON.stringify(data, null, 2));
      return res.status(200).json({
        success: true,
        simulated: true,
        message: 'SMTP send failed. Logged to server console.',
        details: sendError.message
      });
    }

  } catch (error) {
    console.error('Error in email sending handler, falling back to console logging:', error);
    console.log(`[SIMULATED EMAIL] Handler error. Logging email to console:`);
    console.log(`To: ${req.body?.to}`);
    console.log(`Type: ${req.body?.type}`);
    console.log(`Data:`, JSON.stringify(req.body?.data, null, 2));
    
    return res.status(200).json({
      success: true,
      simulated: true,
      message: 'Email handler error. Logged to server console.',
      error: error.message
    });
  }
}