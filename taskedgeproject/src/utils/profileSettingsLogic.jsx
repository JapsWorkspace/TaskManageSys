const NAME_MAX_LENGTH = 40
const USERNAME_MIN_LENGTH = 3
const USERNAME_MAX_LENGTH = 20
const PHONE_MIN_LENGTH = 7
const PHONE_MAX_LENGTH = 15
const EMAIL_MAX_LENGTH = 34
const PASSWORD_MIN_LENGTH = 8
const PASSWORD_MAX_LENGTH = 24

function validateNameField(errors, values, field, label) {
  const value = values[field]?.trim()

  if (!value) {
    errors[field] = `${label} is required.`
  } else if (value.length > NAME_MAX_LENGTH) {
    errors[field] = `${label} must be ${NAME_MAX_LENGTH} characters or fewer.`
  }
}

function validateUsername(errors, usernameValue) {
  const username = usernameValue?.trim()

  if (!username) {
    errors.username = 'Username is required.'
  } else if (username.length < USERNAME_MIN_LENGTH || username.length > USERNAME_MAX_LENGTH) {
    errors.username = `Username must be ${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} characters.`
  } else if (!/^[A-Za-z0-9_.]+$/.test(username)) {
    errors.username = 'Username can only use letters, numbers, underscores, or dots.'
  }
}

function validatePhone(errors, phoneValue) {
  const phone = phoneValue?.trim()

  if (!phone) {
    errors.phone = 'Phone number is required.'
  } else if (!/^\d+$/.test(phone)) {
    errors.phone = 'Phone number can only contain digits.'
  } else if (phone.length < PHONE_MIN_LENGTH || phone.length > PHONE_MAX_LENGTH) {
    errors.phone = `Phone number must be ${PHONE_MIN_LENGTH}-${PHONE_MAX_LENGTH} digits.`
  }
}

function validateNewPassword(errors, passwordValue, field = 'newPassword', label = 'New password') {
  const password = passwordValue || ''

  if (!password || password.length < PASSWORD_MIN_LENGTH) {
    errors[field] = `${label} must contain at least ${PASSWORD_MIN_LENGTH} characters.`
  } else if (password.length > PASSWORD_MAX_LENGTH) {
    errors[field] = `${label} must be ${PASSWORD_MAX_LENGTH} characters or fewer.`
  } else if (!/\d/.test(password)) {
    errors[field] = `${label} must include at least one number.`
  } else if (!/[^A-Za-z0-9]/.test(password)) {
    errors[field] = `${label} must include at least one special character.`
  }
}

export function validateProfileUpdate(values) {
  const errors = {}

  validateNameField(errors, values, 'firstName', 'First name')
  validateNameField(errors, values, 'lastName', 'Last name')
  validateUsername(errors, values.username)
  validatePhone(errors, values.phone)

  return errors
}

export function validateRegistration(values) {
  const errors = validateProfileUpdate(values)
  const emailErrors = validateEmailChange(values)

  if (!values.birthday) {
    errors.birthday = 'Birthday is required.'
  }

  validateNewPassword(errors, values.password, 'password', 'Password')

  return {
    ...errors,
    ...emailErrors,
  }
}

export function validatePasswordChange(values) {
  const errors = {}

  if (!values.currentPassword) {
    errors.currentPassword = 'Current password is required.'
  }

  validateNewPassword(errors, values.newPassword)

  return errors
}

export function validateConfirmedPasswordChange(values) {
  const errors = {}

  validateNewPassword(errors, values.newPassword)

  if (!values.confirmPassword) {
    errors.confirmPassword = 'Confirm password is required.'
  } else if (values.confirmPassword !== values.newPassword) {
    errors.confirmPassword = 'Confirm password must match the new password.'
  }

  return errors
}

export function validateEmailChange(values) {
  const errors = {}
  const email = values.email?.trim()

  if (!email) {
    errors.email = 'Email is required.'
  } else if (email.length > EMAIL_MAX_LENGTH) {
    errors.email = `Email must be ${EMAIL_MAX_LENGTH} characters or fewer.`
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Enter a valid email address.'
  }

  return errors
}

export function validateProfileImageFile(file) {
  const errors = {}

  if (!file) {
    return errors
  }

  if (!['image/png', 'image/jpeg', 'image/gif'].includes(file.type)) {
    errors.avatarImage = 'Choose a PNG, JPEG, or GIF image.'
    return errors
  }

  if (file.size > 2 * 1024 * 1024) {
    errors.avatarImage = 'Profile image must be under 2MB.'
  }

  return errors
}

export function buildProfileSettingsPayload(values, currentUser = {}) {
  const payload = {
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    username: values.username.trim(),
    phone: values.phone.trim(),
  }
  const nextAvatarUrl = values.avatarUrl.trim()
  const currentAvatarUrl = (currentUser.avatarUrl || '').trim()

  if (nextAvatarUrl !== currentAvatarUrl) {
    payload.avatarUrl = nextAvatarUrl
  }

  return payload
}

export function validateProfileSettings(values) {
  const errors = validateProfileUpdate(values)
  return errors
}
