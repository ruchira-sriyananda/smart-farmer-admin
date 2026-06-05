// components/EmailTemplates.js
export const TestEmailTemplate = ({ siteName, smtpConfig, timestamp }) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Test Email from ${siteName}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      margin: 0;
      padding: 0;
      background-color: #f5f5f5;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px 30px;
      text-align: center;
      border-radius: 16px 16px 0 0;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
    }
    .header p {
      margin: 10px 0 0;
      opacity: 0.9;
    }
    .content {
      background: white;
      padding: 40px 30px;
      border-radius: 0 0 16px 16px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .success-badge {
      background: #10b981;
      color: white;
      display: inline-block;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 20px;
    }
    .info-box {
      background: #f8f9fa;
      border-left: 4px solid #667eea;
      padding: 15px 20px;
      margin: 20px 0;
      border-radius: 8px;
    }
    .info-box h3 {
      margin: 0 0 10px 0;
      color: #667eea;
    }
    .details {
      background: #f3f4f6;
      padding: 15px;
      border-radius: 8px;
      margin: 20px 0;
      font-family: 'Courier New', monospace;
      font-size: 13px;
    }
    .button {
      display: inline-block;
      padding: 12px 30px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-decoration: none;
      border-radius: 8px;
      margin: 20px 0 10px;
      text-align: center;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      font-size: 12px;
      color: #6b7280;
    }
    @media (max-width: 480px) {
      .container { padding: 10px; }
      .content { padding: 20px; }
      .header { padding: 30px 20px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ ${siteName}</h1>
      <p>Email Configuration Test</p>
    </div>
    <div class="content">
      <div style="text-align: center;">
        <div class="success-badge">
          ✓ Test Email Successful
        </div>
      </div>
      
      <h2>Hello Admin,</h2>
      <p>This is a test email to verify that your email configuration is working correctly. If you're reading this, your email settings are properly configured!</p>
      
      <div class="info-box">
        <h3>📧 Email Configuration Details</h3>
        <p><strong>SMTP Host:</strong> ${smtpConfig.host}</p>
        <p><strong>SMTP Port:</strong> ${smtpConfig.port}</p>
        <p><strong>Username:</strong> ${smtpConfig.user}</p>
        <p><strong>Encryption:</strong> TLS</p>
      </div>
      
      <div class="details">
        <strong>📅 Test Details:</strong><br>
        • Time: ${timestamp}<br>
        • From: ${siteName} &lt;noreply@${smtpConfig.domain || 'smartfarmer.com'}&gt;<br>
        • Status: ✅ Successfully delivered
      </div>
      
      <div style="text-align: center;">
        <a href="#" class="button">Visit Dashboard</a>
      </div>
      
      <p style="margin-top: 20px;">This email confirms that your Smart Farmer system is ready to send notifications to users.</p>
    </div>
    <div class="footer">
      <p>This is an automated message from ${siteName}. Please do not reply to this email.</p>
      <p>&copy; ${new Date().getFullYear()} ${siteName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;

export const NotificationEmailTemplate = ({ userName, message, actionUrl }) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Notification from Smart Farmer</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 16px 16px 0 0; }
    .content { background: white; padding: 30px; border-radius: 0 0 16px 16px; }
    .button { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }
    .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>Smart Farmer Notification</h2>
    </div>
    <div class="content">
      <h3>Hello ${userName},</h3>
      <p>${message}</p>
      <div style="text-align: center;">
        <a href="${actionUrl}" class="button">View Details</a>
      </div>
    </div>
    <div class="footer">
      <p>You received this email because you're registered with Smart Farmer.</p>
    </div>
  </div>
</body>
</html>
`;