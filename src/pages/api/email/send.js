// pages/api/email/send.js
import nodemailer from 'nodemailer';

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
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: settings } = await supabase
      .from('system_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_password', 'site_name']);

    const smtpSettings = {};
    settings?.forEach(setting => {
      smtpSettings[setting.setting_key] = setting.setting_value;
    });

    if (!smtpSettings.smtp_host || !smtpSettings.smtp_user) {
      return res.status(400).json({ 
        error: 'SMTP settings not configured. Please configure email settings in admin panel.' 
      });
    }

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: smtpSettings.smtp_host,
      port: parseInt(smtpSettings.smtp_port) || 587,
      secure: smtpSettings.smtp_port === '465',
      auth: {
        user: smtpSettings.smtp_user,
        pass: smtpSettings.smtp_password,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    // Email templates
    const templates = {
      barter_approved: {
        subject: `✅ Barter Listing Approved - ${data.title || 'Smart Farmer'}`,
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
                <h1>✅ Listing Approved!</h1>
              </div>
              <div class="content">
                <h2>Hello ${data.userName || 'User'},</h2>
                <p>Great news! Your barter listing has been approved and is now live on the platform.</p>
                <div class="details">
                  <strong>📋 Listing Details:</strong><br>
                  <strong>Title:</strong> ${data.title}<br>
                  <strong>Quantity:</strong> ${data.quantity} ${data.unit}<br>
                  <strong>Description:</strong> ${data.description || 'No description provided'}<br>
                  <strong>Approved At:</strong> ${new Date(data.approvedAt).toLocaleString()}
                </div>
                <p>Your listing is now visible to other users who are interested in bartering.</p>
                <div style="text-align: center;">
                  <a href="https://yourdomain.com/barter" class="button">View My Listing</a>
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
      barter_rejected: {
        subject: `❌ Barter Listing Update - ${data.title || 'Smart Farmer'}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; margin: 0; padding: 20px; }
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
                <p>Please review the feedback and update your listing accordingly. Once updated, it will be reviewed again.</p>
                <div style="text-align: center;">
                  <a href="https://yourdomain.com/barter/edit/${data.listingId}" class="button">Edit Listing</a>
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
    };

    const template = templates[type];
    if (!template) {
      return res.status(400).json({ error: 'Invalid email type' });
    }

    // Send email
    const info = await transporter.sendMail({
      from: `${smtpSettings.site_name || 'Smart Farmer'} <${smtpSettings.smtp_user}>`,
      to: to,
      subject: template.subject,
      html: template.html,
    });

    console.log('Email sent:', info.messageId);
    return res.status(200).json({ success: true, message: 'Email sent successfully', messageId: info.messageId });

  } catch (error) {
    console.error('Error sending email:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message,
      details: 'Failed to send email. Please check SMTP settings.'
    });
  }
}