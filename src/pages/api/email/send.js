// pages/api/email/send.js
import emailService from '../../../lib/emailService';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { type, to, data } = req.body;

    // Get SMTP settings from database
    const { data: settingsData } = await supabase
      .from('system_settings')
      .select('setting_key, setting_value');

    const settings = {};
    settingsData?.forEach(setting => {
      settings[setting.setting_key] = setting.setting_value;
    });

    // Initialize email service
    const initialized = emailService.initialize({
      smtp_host: settings.smtp_host,
      smtp_port: settings.smtp_port,
      smtp_user: settings.smtp_user,
      smtp_password: settings.smtp_password,
    });

    if (!initialized) {
      return res.status(400).json({ 
        error: 'Email service not configured. Please check SMTP settings.' 
      });
    }

    // Check if notifications are enabled
    if (settings.enable_notifications !== 'true' && settings.enable_notifications !== true) {
      return res.status(400).json({ 
        error: 'Email notifications are disabled. Enable them in settings.' 
      });
    }

    // Send notification
    const result = await emailService.sendNotification({
      to,
      userName: data.userName,
      type,
      data,
    });

    if (result.success) {
      return res.status(200).json({ 
        success: true, 
        message: 'Notification sent successfully!' 
      });
    } else {
      return res.status(500).json({ 
        error: result.error || 'Failed to send notification' 
      });
    }
  } catch (error) {
    console.error('Error sending email:', error);
    return res.status(500).json({ error: error.message });
  }
}