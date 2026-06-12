import express from 'express';
import nodemailer from 'nodemailer';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static assets from the frontend build directory (used for local testing)
app.use(express.static(path.join(__dirname, '../dist')));

const SECRET_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'default-supabase-anon-key-fallback';

app.post('/api/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  // Check if SMTP is configured
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpUser || !smtpPass || smtpUser === 'your-email@gmail.com' || smtpPass === 'your-app-password') {
    console.error('SMTP credentials are not configured in your .env file!');
    return res.status(500).json({ 
      error: 'SMTP credentials are not configured on the server. Please update SMTP_USER and SMTP_PASS in your environment.' 
    });
  }

  try {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

    // Generate stateless HMAC signature of the OTP
    const data = `${email.toLowerCase()}:${otp}:${expiresAt}`;
    const hash = crypto.createHmac('sha256', SECRET_KEY).update(data).digest('hex');

    // Create transporter dynamically so if env variables are updated, it picks them up
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    const mailOptions = {
      from: `"ZarnexHub" <${smtpUser}>`,
      to: email,
      subject: 'ZarnexHub Email Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #1e1b4b; color: #ffffff; border-radius: 10px; max-width: 500px; margin: auto;">
          <h2 style="color: #a78bfa; text-align: center;">Welcome to ZarnexHub</h2>
          <p>You requested to register an account. Use the following 6-digit verification code to confirm your email:</p>
          <div style="font-size: 2rem; font-weight: bold; text-align: center; background-color: #312e81; padding: 15px; margin: 20px 0; border-radius: 5px; letter-spacing: 0.2em; color: #10b981;">
            ${otp}
          </div>
          <p style="font-size: 0.8rem; color: #a5b4fc; text-align: center;">This code will expire in 5 minutes.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`Successfully sent OTP to ${email}`);
    
    // Return signature hash and expiry back to client
    res.json({ success: true, hash, expiresAt });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: `Failed to send email: ${error instanceof Error ? error.message : String(error)}` });
  }
});

app.post('/api/verify-otp', (req, res) => {
  const { email, code, hash, expiresAt } = req.body;
  if (!email || !code || !hash || !expiresAt) {
    return res.status(400).json({ error: 'Missing required verification fields' });
  }

  // 1. Check expiration
  if (Date.now() > parseInt(expiresAt, 10)) {
    return res.status(400).json({ error: 'Verification code has expired' });
  }

  // 2. Re-compute HMAC and compare
  const data = `${email.toLowerCase()}:${code.trim()}:${expiresAt}`;
  const computedHash = crypto.createHmac('sha256', SECRET_KEY).update(data).digest('hex');

  if (computedHash !== hash) {
    return res.status(400).json({ error: 'Invalid verification code' });
  }

  res.json({ success: true });
});

// Serve index.html for all other routes to support React Router client-side navigation (local test fallback)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// Only listen when running locally
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Custom SMTP OTP server running locally on port ${PORT}`);
  });
}

export default app;
