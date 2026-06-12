import express from 'express';
import nodemailer from 'nodemailer';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// In-memory store for OTPs
const otpStore = new Map();

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
      error: 'SMTP credentials are not configured on the server. Please update SMTP_USER and SMTP_PASS in your .env file.' 
    });
  }

  try {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

    otpStore.set(email.toLowerCase(), { otp, expiresAt });

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
    res.json({ success: true });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: `Failed to send email: ${error instanceof Error ? error.message : String(error)}` });
  }
});

app.post('/api/verify-otp', (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ error: 'Email and code are required' });
  }

  const record = otpStore.get(email.toLowerCase());
  if (!record) {
    return res.status(400).json({ error: 'No verification code sent to this email' });
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(email.toLowerCase());
    return res.status(400).json({ error: 'Verification code has expired' });
  }

  if (record.otp !== code.trim()) {
    return res.status(400).json({ error: 'Invalid verification code' });
  }

  otpStore.delete(email.toLowerCase());
  res.json({ success: true });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Custom SMTP OTP server running on port ${PORT}`);
});
