const test = require('node:test');
const assert = require('node:assert/strict');

const { hasPasswordEmailDeliveryConfig, sendResetEmail } = require('../services/mail');

const EMAILJS_ENV = {
  EMAILJS_SERVICE_ID: 'service_taskedge',
  EMAILJS_TEMPLATE_ID: 'template_reset',
  EMAILJS_PUBLIC_KEY: 'public_key',
  EMAILJS_PRIVATE_KEY: 'private_key',
};

function withEnv(values) {
  const previous = {};
  for (const key of Object.keys(values)) {
    previous[key] = process.env[key];
    process.env[key] = values[key];
  }
  return () => {
    for (const key of Object.keys(values)) {
      if (previous[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previous[key];
      }
    }
  };
}

test('sendResetEmail sends reset codes through EmailJS when configured', async () => {
  const restoreEnv = withEnv(EMAILJS_ENV);
  const previousFetch = global.fetch;
  let request;

  global.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, status: 200, text: async () => 'OK' };
  };

  try {
    await sendResetEmail('justin@gmail.com', 'reset-token');
  } finally {
    restoreEnv();
    global.fetch = previousFetch;
  }

  assert.equal(request.url, 'https://api.emailjs.com/api/v1.0/email/send');
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.headers['Content-Type'], 'application/json');

  const body = JSON.parse(request.options.body);
  assert.equal(body.service_id, 'service_taskedge');
  assert.equal(body.template_id, 'template_reset');
  assert.equal(body.user_id, 'public_key');
  assert.equal(body.accessToken, 'private_key');
  assert.deepEqual(body.template_params, {
    email: 'justin@gmail.com',
    to_email: 'justin@gmail.com',
    link: 'reset-token',
    reset_code: 'reset-token',
    app_name: 'TaskEdge',
  });
});

test('sendResetEmail reports EmailJS delivery failures', async () => {
  const restoreEnv = withEnv(EMAILJS_ENV);
  const previousFetch = global.fetch;

  global.fetch = async () => ({ ok: false, status: 400, text: async () => 'Bad Request' });

  try {
    await assert.rejects(
      sendResetEmail('justin@gmail.com', 'reset-token'),
      /EmailJS password reset email failed: 400 Bad Request/,
    );
  } finally {
    restoreEnv();
    global.fetch = previousFetch;
  }
});

test('hasPasswordEmailDeliveryConfig detects EmailJS and SMTP delivery setup', () => {
  const restoreEnv = withEnv({
    EMAILJS_SERVICE_ID: '',
    EMAILJS_TEMPLATE_ID: '',
    EMAILJS_PUBLIC_KEY: '',
    EMAILJS_PRIVATE_KEY: '',
    SMTP_HOST: '',
    SMTP_USER: '',
    SMTP_PASS: '',
  });

  try {
    assert.equal(hasPasswordEmailDeliveryConfig(), false);
    process.env.EMAILJS_SERVICE_ID = 'service_taskedge';
    process.env.EMAILJS_TEMPLATE_ID = 'template_reset';
    process.env.EMAILJS_PUBLIC_KEY = 'public_key';
    assert.equal(hasPasswordEmailDeliveryConfig(), true);

    process.env.EMAILJS_SERVICE_ID = '';
    process.env.EMAILJS_TEMPLATE_ID = '';
    process.env.EMAILJS_PUBLIC_KEY = '';
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_USER = 'user';
    process.env.SMTP_PASS = 'pass';
    assert.equal(hasPasswordEmailDeliveryConfig(), true);
  } finally {
    restoreEnv();
  }
});
