// supabase/functions/send-test-email/index.js
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { Resend } from 'https://esm.sh/resend@2.0.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { to, settings, siteName } = await req.json()
    
    // Get Resend API key from environment
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured. Please add it to your Supabase secrets.')
    }

    const resend = new Resend(resendApiKey)

    const { data, error } = await resend.emails.send({
      from: `${siteName || 'Smart Farmer'} <noreply@smartfarmer.com>`,
      to: [to],
      subject: 'Test Email from Smart Farmer',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; background: #f5f5f5; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; }
            .header h1 { margin: 0; font-size: 28px; }
            .content { padding: 40px 30px; }
            .success-badge { background: #10b981; color: white; display: inline-block; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: 600; margin-bottom: 20px; }
            .info-box { background: #f8f9fa; border-left: 4px solid #667eea; padding: 15px 20px; margin: 20px 0; border-radius: 8px; }
            .footer { text-align: center; padding: 20px; background: #f8f9fa; font-size: 12px; color: #666; }
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
                <strong>📧 Email Configuration:</strong><br>
                Host: ${settings.host}<br>
                Port: ${settings.port}<br>
                Username: ${settings.user}
              </div>
              <p>If you received this email, your Smart Farmer system is properly configured to send notifications!</p>
              <p><strong>Time sent:</strong> ${new Date().toLocaleString()}</p>
            </div>
            <div class="footer">
              <p>This is an automated message from ${siteName || 'Smart Farmer'}. Please do not reply.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    })

    if (error) throw error

    return new Response(
      JSON.stringify({ success: true, message: 'Test email sent successfully!', data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    console.error('Error sending email:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})