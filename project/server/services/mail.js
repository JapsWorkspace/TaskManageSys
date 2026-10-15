const nodemailer = require('nodemailer');

const EMAILJS_SEND_URL = 'https://api.emailjs.com/api/v1.0/email/send';

function hasEmailJsConfig() {
  return Boolean(process.env.EMAILJS_SERVICE_ID && process.env.EMAILJS_TEMPLATE_ID && process.env.EMAILJS_PUBLIC_KEY);
}

function hasSmtpConfig() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

async function sendEmailJsResetEmail(email, token) {
  const body = {
    service_id: process.env.EMAILJS_SERVICE_ID,
    template_id: process.env.EMAILJS_TEMPLATE_ID,
    user_id: process.env.EMAILJS_PUBLIC_KEY,
    template_params: {
      email,
      to_email: email,
      link: token,
      reset_code: token,
      app_name: 'TaskEdge',
    },
  };

  if (process.env.EMAILJS_PRIVATE_KEY) {
    body.accessToken = process.env.EMAILJS_PRIVATE_KEY;
  }

  const response = await fetch(EMAILJS_SEND_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`EmailJS password reset email failed: ${response.status} ${details}`);
  }
}

exports.sendResetEmail = async (email, token) => {
  if (hasEmailJsConfig()) {
    await sendEmailJsResetEmail(email, token);
    return;
  }

  if (!hasSmtpConfig()) {
    if (process.env.NODE_ENV === 'production') throw new Error('Password email service is not configured.');
    console.log(`Development password reset token for ${email}: ${token}`);
    return;
  }
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: 'Task Management password reset',
    text: `Your password reset code is: ${token}\nThis code expires in 30 minutes.`,
  });
};

exports.hasPasswordEmailDeliveryConfig = () => hasEmailJsConfig() || hasSmtpConfig();
