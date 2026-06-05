// components/EmailTest.js
import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function EmailTest() {
  const [testEmail, setTestEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  const sendTestNotification = async (type) => {
    if (!testEmail) {
      setResult({ error: 'Please enter a test email address' });
      return;
    }

    setSending(true);
    setResult(null);

    try {
      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          to: testEmail,
          data: {
            userName: 'Test User',
            title: 'Test Campaign',
            startDate: new Date(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            reason: 'Test rejection for demonstration purposes',
            packageName: 'Premium Package',
            daysLeft: 5,
            renewUrl: 'https://yourdomain.com/subscription',
            amount: 99.99,
            transactionId: 'TXN_TEST_123',
            clicks: 245,
            impressions: 5000,
            ctr: 4.9,
            fromUser: 'Test Sender',
            message: 'This is a test message to demonstrate the email notification system.'
          }
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setResult({ success: true, message: `${type} notification sent successfully!` });
      } else {
        setResult({ error: data.error });
      }
    } catch (error) {
      setResult({ error: error.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="email-test-container">
      <h3>Test Email Notifications</h3>
      
      <div className="form-group">
        <label>Test Email Address</label>
        <input
          type="email"
          className="form-control"
          value={testEmail}
          onChange={(e) => setTestEmail(e.target.value)}
          placeholder="Enter email to receive test notifications"
        />
      </div>

      {result && (
        <div className={`alert alert-${result.success ? 'success' : 'danger'} mt-3`}>
          {result.success ? result.message : result.error}
        </div>
      )}

      <div className="test-buttons-grid mt-4">
        <button 
          className="btn-test" 
          onClick={() => sendTestNotification('welcome')}
          disabled={sending}
        >
          <i className="bi bi-person-plus"></i> Test Welcome
        </button>
        
        <button 
          className="btn-test" 
          onClick={() => sendTestNotification('ad_approved')}
          disabled={sending}
        >
          <i className="bi bi-check-circle"></i> Test Ad Approved
        </button>
        
        <button 
          className="btn-test" 
          onClick={() => sendTestNotification('ad_rejected')}
          disabled={sending}
        >
          <i className="bi bi-x-circle"></i> Test Ad Rejected
        </button>
        
        <button 
          className="btn-test" 
          onClick={() => sendTestNotification('subscription_expiring')}
          disabled={sending}
        >
          <i className="bi bi-clock"></i> Test Expiring
        </button>
        
        <button 
          className="btn-test" 
          onClick={() => sendTestNotification('payment_received')}
          disabled={sending}
        >
          <i className="bi bi-credit-card"></i> Test Payment
        </button>
        
        <button 
          className="btn-test" 
          onClick={() => sendTestNotification('campaign_completed')}
          disabled={sending}
        >
          <i className="bi bi-graph-up"></i> Test Campaign Complete
        </button>
        
        <button 
          className="btn-test" 
          onClick={() => sendTestNotification('new_message')}
          disabled={sending}
        >
          <i className="bi bi-chat"></i> Test New Message
        </button>
      </div>

      <style jsx>{`
        .email-test-container {
          padding: 20px;
        }
        
        .test-buttons-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 12px;
        }
        
        .btn-test {
          padding: 10px 16px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        
        .btn-test:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102,126,234,0.3);
        }
        
        .btn-test:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        
        .form-group {
          margin-bottom: 20px;
        }
        
        .form-group label {
          display: block;
          margin-bottom: 8px;
          font-weight: 500;
          color: #374151;
        }
        
        .form-control {
          width: 100%;
          padding: 10px 14px;
          border: 2px solid #e5e7eb;
          border-radius: 12px;
          font-size: 14px;
        }
        
        .form-control:focus {
          outline: none;
          border-color: #667eea;
        }
      `}</style>
    </div>
  );
}