const NAME_MAX_LENGTH = 40;
const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 20;
const PHONE_MIN_LENGTH = 7;
const PHONE_MAX_LENGTH = 15;
const EMAIL_MAX_LENGTH = 34;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 24;

function validateAccountName(value, label) {
  const name = String(value || '').trim();

  if (!name) return `${label} is required.`;
  if (name.length > NAME_MAX_LENGTH) return `${label} must be ${NAME_MAX_LENGTH} characters or fewer.`;
  return null;
}

function validateUsername(value) {
  const username = String(value || '').trim();

  if (!username) return 'Username is required.';
  if (username.length < USERNAME_MIN_LENGTH || username.length > USERNAME_MAX_LENGTH) {
    return `Username must be ${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} characters.`;
  }
  if (!/^[A-Za-z0-9_.]+$/.test(username)) {
    return 'Username can only use letters, numbers, underscores, or dots.';
  }
  return null;
}

function validatePhone(value) {
  const phone = String(value || '').trim();

  if (!phone) return 'Phone number is required.';
  if (!/^\d+$/.test(phone)) return 'Phone number can only contain digits.';
  if (phone.length < PHONE_MIN_LENGTH || phone.length > PHONE_MAX_LENGTH) {
    return `Phone number must be ${PHONE_MIN_LENGTH}-${PHONE_MAX_LENGTH} digits.`;
  }
  return null;
}

function validateAccountEmail(value) {
  const email = String(value || '').trim();

  if (!email) return 'Email is required.';
  if (email.length > EMAIL_MAX_LENGTH) return `Email must be ${EMAIL_MAX_LENGTH} characters or fewer.`;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email address.';
  return null;
}

function validateAccountPassword(value, label = 'Password') {
  const password = String(value || '');

  if (!password) return `${label} is required.`;
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `${label} must contain at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `${label} must be ${PASSWORD_MAX_LENGTH} characters or fewer.`;
  }
  if (!/\d/.test(password)) return `${label} must include at least one number.`;
  if (!/[^A-Za-z0-9]/.test(password)) return `${label} must include at least one special character.`;
  return null;
}

function firstValidationError(validators) {
  for (const validator of validators) {
    const error = validator();
    if (error) return error;
  }
  return null;
}

module.exports = {
  validateAccountName,
  validateUsername,
  validatePhone,
  validateAccountEmail,
  validateAccountPassword,
  firstValidationError,
};
