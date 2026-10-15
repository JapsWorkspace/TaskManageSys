import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildProfileSettingsPayload,
  validateConfirmedPasswordChange,
  validateEmailChange,
  validatePasswordChange,
  validateProfileImageFile,
  validateRegistration,
  validateProfileSettings,
  validateProfileUpdate,
} from './profileSettingsLogic.jsx'

test('buildProfileSettingsPayload omits unchanged avatar data from profile saves', () => {
  assert.deepEqual(
    buildProfileSettingsPayload(
      {
        firstName: 'Justin',
        lastName: 'Raine',
        username: 'Zagreus',
        phone: '09123451234',
        avatarUrl: 'data:image/png;base64,current',
      },
      { avatarUrl: 'data:image/png;base64,current' },
    ),
    {
      firstName: 'Justin',
      lastName: 'Raine',
      username: 'Zagreus',
      phone: '09123451234',
    },
  )
})

test('buildProfileSettingsPayload keeps avatar data when image changes or is removed', () => {
  assert.equal(
    buildProfileSettingsPayload(
      {
        firstName: 'Justin',
        lastName: 'Raine',
        username: 'Zagreus',
        phone: '09123451234',
        avatarUrl: '',
      },
      { avatarUrl: 'data:image/png;base64,current' },
    ).avatarUrl,
    '',
  )

  assert.equal(
    buildProfileSettingsPayload(
      {
        firstName: 'Justin',
        lastName: 'Raine',
        username: 'Zagreus',
        phone: '09123451234',
        avatarUrl: 'data:image/png;base64,next',
      },
      { avatarUrl: 'data:image/png;base64,current' },
    ).avatarUrl,
    'data:image/png;base64,next',
  )
})

test('validateProfileUpdate requires first and last name', () => {
  assert.deepEqual(
    validateProfileUpdate({ firstName: '', lastName: 'Raine', username: 'justin', phone: '09123451234' }),
    { firstName: 'First name is required.' },
  )

  assert.deepEqual(
    validateProfileUpdate({ firstName: 'Justin', lastName: '', username: 'justin', phone: '09123451234' }),
    { lastName: 'Last name is required.' },
  )

  assert.deepEqual(
    validateProfileUpdate({ firstName: 'Justin', lastName: 'Raine', username: '', phone: '09123451234' }),
    { username: 'Username is required.' },
  )
})

test('validateProfileUpdate limits username and phone formats', () => {
  assert.deepEqual(
    validateProfileUpdate({
      firstName: 'Justin',
      lastName: 'Raine',
      username: 'z'.repeat(21),
      phone: '09123abc123',
    }),
    {
      username: 'Username must be 3-20 characters.',
      phone: 'Phone number can only contain digits.',
    },
  )

  assert.deepEqual(
    validateProfileUpdate({
      firstName: 'Justin',
      lastName: 'Raine',
      username: 'za greus',
      phone: '123',
    }),
    {
      username: 'Username can only use letters, numbers, underscores, or dots.',
      phone: 'Phone number must be 7-15 digits.',
    },
  )
})

test('validateRegistration returns inline errors for register fields', () => {
  assert.deepEqual(
    validateRegistration({
      firstName: '',
      lastName: 'Raine',
      birthday: '',
      username: 'admin!',
      email: 'bad-email',
      phone: 'phone',
      password: 'short',
    }),
    {
      firstName: 'First name is required.',
      birthday: 'Birthday is required.',
      username: 'Username can only use letters, numbers, underscores, or dots.',
      email: 'Enter a valid email address.',
      phone: 'Phone number can only contain digits.',
      password: 'Password must contain at least 8 characters.',
    },
  )

  assert.deepEqual(
    validateRegistration({
      firstName: 'Justin',
      lastName: 'Raine',
      birthday: '2000-01-01',
      username: 'justin',
      email: 'missing-at-symbol',
      phone: '09123451234',
      password: 'PasswordNoSymbol123',
    }),
    {
      email: 'Enter a valid email address.',
      password: 'Password must include at least one special character.',
    },
  )
})

test('validatePasswordChange requires current password and strong new password length', () => {
  assert.deepEqual(
    validatePasswordChange({ currentPassword: '', newPassword: 'short' }),
    {
      currentPassword: 'Current password is required.',
      newPassword: 'New password must contain at least 8 characters.',
    },
  )

  assert.deepEqual(
    validatePasswordChange({ currentPassword: 'old-password', newPassword: 'new-password1!' }),
    {},
  )

  assert.deepEqual(
    validatePasswordChange({ currentPassword: 'old-password', newPassword: 'New-password1-is-too-long' }),
    { newPassword: 'New password must be 24 characters or fewer.' },
  )

  assert.deepEqual(
    validatePasswordChange({ currentPassword: 'old-password', newPassword: 'Password!' }),
    { newPassword: 'New password must include at least one number.' },
  )

  assert.deepEqual(
    validatePasswordChange({ currentPassword: 'old-password', newPassword: 'Password1' }),
    { newPassword: 'New password must include at least one special character.' },
  )
})

test('validateConfirmedPasswordChange requires matching new password confirmation', () => {
  assert.deepEqual(
    validateConfirmedPasswordChange({
      newPassword: 'new-password1!',
      confirmPassword: 'different-password',
    }),
    { confirmPassword: 'Confirm password must match the new password.' },
  )

  assert.deepEqual(
    validateConfirmedPasswordChange({
      newPassword: 'New-password1-is-too-long',
      confirmPassword: 'New-password1-is-too-long',
    }),
    { newPassword: 'New password must be 24 characters or fewer.' },
  )
})

test('validateEmailChange requires a valid email address', () => {
  assert.deepEqual(
    validateEmailChange({ email: '' }),
    { email: 'Email is required.' },
  )

  assert.deepEqual(
    validateEmailChange({ email: 'not-an-email' }),
    { email: 'Enter a valid email address.' },
  )

  assert.deepEqual(
    validateEmailChange({ email: 'justinrainejustinraineabc@example.com' }),
    { email: 'Email must be 34 characters or fewer.' },
  )

  assert.deepEqual(
    validateEmailChange({ email: 'justinrainejustin@example.com' }),
    {},
  )
})

test('validateProfileSettings only validates profile fields', () => {
  assert.deepEqual(
    validateProfileSettings({
      firstName: 'Justin',
      lastName: 'Raine',
      username: 'justin',
      phone: '09123451234',
      avatarUrl: '',
    }),
    {},
  )

  assert.deepEqual(
    validateProfileSettings({
      firstName: 'Justin',
      lastName: 'Raine',
      username: 'justin',
      phone: '09123451234',
      avatarUrl: 'data:image/png;base64,abc123',
    }),
    {},
  )
})

test('validateProfileImageFile rejects unsupported or oversized profile images', () => {
  assert.deepEqual(validateProfileImageFile(null), {})

  assert.deepEqual(
    validateProfileImageFile({ type: 'application/pdf', size: 1200 }),
    { avatarImage: 'Choose a PNG, JPEG, or GIF image.' },
  )

  assert.deepEqual(
    validateProfileImageFile({ type: 'image/png', size: 2 * 1024 * 1024 + 1 }),
    { avatarImage: 'Profile image must be under 2MB.' },
  )

  assert.deepEqual(
    validateProfileImageFile({ type: 'image/jpeg', size: 2 * 1024 * 1024 }),
    {},
  )
})
