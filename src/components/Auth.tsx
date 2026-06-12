import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import confetti from 'canvas-confetti';
import { Hash } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const Auth: React.FC = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpToken, setOtpToken] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        if (!username) {
          throw new Error('Username is required for Sign Up');
        }
        
        // 1. Send OTP email using custom SMTP backend server
        const response = await fetch(`${API_URL}/api/send-otp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to send verification email');
        }

        // OTP sent successfully, switch to verification screen
        setIsVerifyingOtp(true);
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;
        
        confetti({
          particleCount: 120,
          spread: 80,
          colors: ['#8b5cf6', '#a78bfa', '#10b981'],
          origin: { y: 0.6 }
        });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred during authentication');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpToken) {
      setError('Please enter the verification code');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Verify OTP using our custom backend server
      const verifyResponse = await fetch(`${API_URL}/api/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, code: otpToken.trim() }),
      });

      const verifyData = await verifyResponse.json();
      if (!verifyResponse.ok) {
        throw new Error(verifyData.error || 'Invalid verification code');
      }

      // 2. If backend verification succeeded, create the user in Supabase Auth
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username.trim().toLowerCase(),
            full_name: fullName.trim() || null,
          },
        },
      });

      if (signUpError) throw signUpError;

      confetti({
        particleCount: 120,
        spread: 80,
        colors: ['#8b5cf6', '#a78bfa', '#10b981'],
        origin: { y: 0.6 }
      });

      // If email confirmation is disabled on Supabase, the user is automatically logged in.
      // Otherwise, we inform them and clear states.
      if (!data?.session) {
        alert('Verification and registration successful! You can now sign in.');
        setIsSignUp(false);
        setIsVerifyingOtp(false);
        setOtpToken('');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Verification failed. Please check the code and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/send-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to resend verification code');
      }

      alert(`Verification code resent successfully to ${email}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to resend verification code.');
    } finally {
      setLoading(false);
    }
  };

  if (isVerifyingOtp) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="auth-logo">
            <Hash size={36} strokeWidth={2.5} />
          </div>
          <h1 className="auth-title">Verify Your Email</h1>
          <p className="auth-subtitle">
            We sent a 6-digit verification code to <strong>{email}</strong>
          </p>

          {error && <div className="auth-error">{error}</div>}

          <form className="auth-form" onSubmit={handleVerifyOtp}>
            <div className="form-group">
              <label className="form-label">Verification Code</label>
              <input
                type="text"
                className="form-input"
                placeholder="123456"
                maxLength={6}
                value={otpToken}
                onChange={(e) => setOtpToken(e.target.value.replace(/\D/g, ''))}
                required
                disabled={loading}
                style={{ textAlign: 'center', letterSpacing: '0.4em', fontSize: '1.25rem', fontWeight: 600 }}
              />
            </div>

            <button type="submit" className="auth-btn" disabled={loading}>
              {loading ? 'Verifying...' : 'Verify Code'}
            </button>
          </form>

          <p className="auth-switch-text">
            Didn't receive the code?{' '}
            <span 
              className="auth-switch-link" 
              onClick={handleResendOtp}
              style={{ pointerEvents: loading ? 'none' : 'auto', opacity: loading ? 0.5 : 1 }}
            >
              Resend Code
            </span>
          </p>

          <p className="auth-switch-text" style={{ marginTop: '0.75rem' }}>
            <span 
              className="auth-switch-link" 
              onClick={() => {
                setIsVerifyingOtp(false);
                setError(null);
                setOtpToken('');
              }}
              style={{ color: 'var(--text-muted)' }}
            >
              Back to Sign Up
            </span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">
          <Hash size={36} strokeWidth={2.5} />
        </div>
        <h1 className="auth-title">Welcome to ZarnexHub</h1>
        <p className="auth-subtitle">
          {isSignUp ? 'Create an account to join the workspace' : 'Sign in to access your channels'}
        </p>

        {error && <div className="auth-error">{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          {isSignUp && (
            <>
              <div className="form-group">
                <label className="form-label">Username</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="alice"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Alice Johnson"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
            </>
          )}

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-input"
              placeholder="alice@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? 'Processing...' : isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <p className="auth-switch-text">
          {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
          <span className="auth-switch-link" onClick={() => setIsSignUp(!isSignUp)}>
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </span>
        </p>
      </div>
    </div>
  );
};
