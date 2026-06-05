// pages/api/send-test-email.js
import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { to, smtpSettings, siteName } = req.body;

    // Validate required fields
    if (!to) {
      return res.status(400).json({ error: 'Recipient email is required' });
    }

    if (!smtpSettings || !smtpSettings.host || !smtpSettings.user) {
      return res.status(400).json({ error: 'SMTP settings are incomplete' });
    }

    // Create SMTP transporter
    const transporter = nodemailer.createTransport({
      host: smtpSettings.host,
      port: parseInt(smtpSettings.port) || 587,
      secure: smtpSettings.port === '465', // true for 465, false for other ports
      auth: {
        user: smtpSettings.user,
        pass: smtpSettings.pass,
      },
      tls: {
        rejectUnauthorized: false, // Only for testing
      },
    });

    // Email content
    const mailOptions = {
      from: `${siteName || 'Smart Farmer'} <${smtpSettings.user}>`,
      to: to,
      subject: `Test Email from ${siteName || 'Smart Farmer'}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Test Email</title>
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
            .footer {
              text-align: center;
              padding: 20px;
              font-size: 12px;
              color: #6c757d;
              background: #f8f9fa;
              border-radius: 0 0 16px 16px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✅ ${siteName || 'Smart Farmer'}</h1>
              <p>Email Configuration Test</p>
            </div>
            <div class="content">
              <div style="text-align: center;">
                <div class="success-badge">✓ Test Successful!</div>
              </div>
              
              <h2>Hello Administrator,</h2>
              <p>This is a test email to verify that your email configuration is working correctly.</p>
              
              <div class="info-box">
                <strong>📧 Email Configuration Details:</strong><br><br>
                <strong>SMTP Host:</strong> ${smtpSettings.host}<br>
                <strong>SMTP Port:</strong> ${smtpSettings.port}<br>
                <strong>Username:</strong> ${smtpSettings.user}<br>
                <strong>Encryption:</strong> ${smtpSettings.port === '465' ? 'SSL/TLS' : 'STARTTLS'}<br>
                <strong>Time:</strong> ${new Date().toLocaleString()}
              </div>
              
              <p>If you received this email, your Smart Farmer system is properly configured to send notifications!</p>
            </div>
            <div class="footer">
              <p>This is an automated message from ${siteName || 'Smart Farmer'}. Please do not reply.</p>
              <p>&copy; ${new Date().getFullYear()} ${siteName || 'Smart Farmer'}. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Test Email from ${siteName || 'Smart Farmer'}
        
        Hello Administrator,
        
        This is a test email to verify that your email configuration is working correctly.
        
        SMTP Configuration:
        - Host: ${smtpSettings.host}
        - Port: ${smtpSettings.port}
        - Username: ${smtpSettings.user}
        - Time: ${new Date().toLocaleString()}
        
        If you received this email, your Smart Farmer system is properly configured!
        
        ---
        This is an automated message. Please do not reply.
      `,
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);
    
    console.log('Email sent successfully:', info.messageId);
    
    return res.status(200).json({ 
      success: true, 
      message: 'Test email sent successfully! Check your inbox.',
      messageId: info.messageId
    });
    
  } catch (error) {
    console.error('Error sending email:', error);
    
    // Provide helpful error message
    let errorMessage = 'Failed to send test email. ';
    
    if (error.code === 'EAUTH') {
      errorMessage += 'Authentication failed. Please check your SMTP username and password.';
    } else if (error.code === 'ECONNECTION') {
      errorMessage += 'Cannot connect to SMTP server. Please check host and port.';
    } else if (error.code === 'ESOCKET') {
      errorMessage += 'Connection timeout. Please check your network and SMTP settings.';
    } else {
      errorMessage += error.message;
    }
    
    return res.status(500).json({ 
      success: false, 
      error: errorMessage,
      details: error.message 
    });
  }
}