import { useRef, useState } from 'react'
import { validateProfileImageFile } from '../utils/profileSettingsLogic.jsx'
import defaultProfileImage from '../assets/default.jpg'

export function ProfilePage({
  user,
  tasks,
  profileMessage,
  validation,
  onSaveChanges,
  onChangeEmail,
  onChangePassword,
  onClearFeedback,
  onLogout,
  onLogoutAllDevices,
  onDeleteAccount,
}) {
  const fileInputRef = useRef(null)
  const [avatarValue, setAvatarValue] = useState(user.avatarUrl || '')
  const [avatarPreview, setAvatarPreview] = useState(user.avatarUrl || defaultProfileImage)
  const [avatarError, setAvatarError] = useState('')
  const [isChangingEmail, setIsChangingEmail] = useState(false)
  const [emailValue, setEmailValue] = useState(user.email || '')
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [passwordValues, setPasswordValues] = useState({
    newPassword: '',
    confirmPassword: '',
  })
  const ownedTasks = tasks.filter((task) => task.owner.toLowerCase().includes(user.firstName.toLowerCase()))

  function changeProfileImage(event) {
    const file = event.target.files?.[0]
    const errors = validateProfileImageFile(file)

    if (errors.avatarImage) {
      setAvatarError(errors.avatarImage)
      event.target.value = ''
      return
    }

    if (!file) {
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const nextAvatar = String(reader.result || '')
      setAvatarValue(nextAvatar)
      setAvatarPreview(nextAvatar || defaultProfileImage)
      setAvatarError('')
    }
    reader.onerror = () => {
      setAvatarError('Could not read that image. Try another file.')
    }
    reader.readAsDataURL(file)
  }

  function removeProfileImage() {
    setAvatarValue('')
    setAvatarPreview(defaultProfileImage)
    setAvatarError('')

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  function beginPasswordChange() {
    onClearFeedback()
    setIsChangingPassword(true)
  }

  function beginEmailChange() {
    onClearFeedback()
    setEmailValue(user.email || '')
    setIsChangingEmail(true)
  }

  async function confirmEmailChange() {
    const didChange = await onChangeEmail({ email: emailValue })

    if (didChange) {
      setIsChangingEmail(false)
    }
  }

  function cancelEmailChange() {
    onClearFeedback()
    setEmailValue(user.email || '')
    setIsChangingEmail(false)
  }

  function updatePasswordValue(event) {
    setPasswordValues((currentValues) => ({
      ...currentValues,
      [event.target.name]: event.target.value,
    }))
  }

  async function confirmPasswordChange() {
    const didChange = await onChangePassword(passwordValues)

    if (didChange) {
      setPasswordValues({
        newPassword: '',
        confirmPassword: '',
      })
      setIsChangingPassword(false)
    }
  }

  function cancelPasswordChange() {
    onClearFeedback()
    setPasswordValues({
      newPassword: '',
      confirmPassword: '',
    })
    setIsChangingPassword(false)
  }

  return (
    <section className="profile-settings-page">
      <form className="panel profile-settings-surface" onSubmit={onSaveChanges} noValidate>
        <section className="profile-settings-section">
          <h3>My Profile</h3>
          <div className="profile-image-row">
            <div className="avatar profile-image-preview" aria-hidden="true">
              <img src={avatarPreview} alt="" />
            </div>
            <div className="profile-image-actions">
              <div className="profile-image-buttons">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/gif"
                  className="visually-hidden"
                  onChange={changeProfileImage}
                />
                <input type="hidden" name="avatarUrl" value={avatarValue} />
                <button type="button" className="primary-button compact" onClick={() => fileInputRef.current?.click()}>
                  Change image
                </button>
                <button type="button" className="ghost-button compact" onClick={removeProfileImage}>
                  Remove image
                </button>
              </div>
              <small>We support PNGs, JPEGs and GIFs under 2MB.</small>
              {avatarError && <small className="field-error">{avatarError}</small>}
              {validation.avatarUrl && <small className="field-error">{validation.avatarUrl}</small>}
            </div>
          </div>

          <div className="profile-settings-group profile-name-grid">
            <label>
              First name
              <input
                name="firstName"
                defaultValue={user.firstName}
                maxLength="40"
                aria-invalid={Boolean(validation.firstName)}
                aria-describedby={validation.firstName ? 'profile-first-name-error' : undefined}
              />
              {validation.firstName && (
                <small className="field-error" id="profile-first-name-error">{validation.firstName}</small>
              )}
            </label>
            <label>
              Last name
              <input
                name="lastName"
                defaultValue={user.lastName}
                maxLength="40"
                aria-invalid={Boolean(validation.lastName)}
                aria-describedby={validation.lastName ? 'profile-last-name-error' : undefined}
              />
              {validation.lastName && (
                <small className="field-error" id="profile-last-name-error">{validation.lastName}</small>
              )}
            </label>
            <label>
              Username
              <input
                name="username"
                defaultValue={user.username}
                minLength="3"
                maxLength="20"
                pattern="[A-Za-z0-9_.]+"
                aria-invalid={Boolean(validation.username)}
                aria-describedby={validation.username ? 'profile-username-error' : undefined}
              />
              {validation.username && (
                <small className="field-error" id="profile-username-error">{validation.username}</small>
              )}
            </label>
            <label>
              Phone
              <input
                name="phone"
                defaultValue={user.phone}
                inputMode="numeric"
                minLength="7"
                maxLength="15"
                pattern="[0-9]+"
                aria-invalid={Boolean(validation.phone)}
                aria-describedby={validation.phone ? 'profile-phone-error' : undefined}
              />
              {validation.phone && (
                <small className="field-error" id="profile-phone-error">{validation.phone}</small>
              )}
            </label>
          </div>
        </section>

        <section className="profile-settings-section">
          <h3>Account Security</h3>
          <div className="security-list">
            <div className="security-row security-field-row">
              <div>
                <strong>Email</strong>
                <input value={user.email || 'Not provided'} disabled readOnly />
              </div>
              {isChangingEmail ? (
                <div className="email-inline-editor">
                  <label>
                    New email
                    <input
                      name="email"
                      type="email"
                      value={emailValue}
                      autoComplete="email"
                      maxLength="34"
                      onChange={(event) => setEmailValue(event.target.value)}
                      aria-invalid={Boolean(validation.email)}
                      aria-describedby={validation.email ? 'profile-email-error' : undefined}
                    />
                    {validation.email && (
                      <small className="field-error" id="profile-email-error">{validation.email}</small>
                    )}
                  </label>
                  <button type="button" className="primary-button compact" onClick={confirmEmailChange}>
                    Confirm
                  </button>
                  <button type="button" className="ghost-button compact" onClick={cancelEmailChange}>
                    Cancel
                  </button>
                </div>
              ) : (
                <button type="button" className="ghost-button compact" onClick={beginEmailChange}>
                  Change email
                </button>
              )}
            </div>
            <div className={`security-row security-field-row password-security-row${isChangingPassword ? ' is-editing' : ''}`}>
              <div>
                <strong>Password</strong>
                <input value="••••••••••" disabled readOnly />
              </div>
              {isChangingPassword ? (
                <div className="password-inline-editor">
                  <label>
                    New password
                    <input
                      name="newPassword"
                      type="password"
                      value={passwordValues.newPassword}
                      autoComplete="new-password"
                      minLength="8"
                      maxLength="24"
                      onChange={updatePasswordValue}
                      aria-invalid={Boolean(validation.newPassword)}
                      aria-describedby={validation.newPassword ? 'profile-new-password-error' : undefined}
                    />
                    {validation.newPassword && (
                      <small className="field-error" id="profile-new-password-error">{validation.newPassword}</small>
                    )}
                  </label>
                  <label>
                    Confirm password
                    <input
                      name="confirmPassword"
                      type="password"
                      value={passwordValues.confirmPassword}
                      autoComplete="new-password"
                      minLength="8"
                      maxLength="24"
                      onChange={updatePasswordValue}
                      aria-invalid={Boolean(validation.confirmPassword)}
                      aria-describedby={validation.confirmPassword ? 'profile-confirm-password-error' : undefined}
                    />
                    {validation.confirmPassword && (
                      <small className="field-error" id="profile-confirm-password-error">{validation.confirmPassword}</small>
                    )}
                  </label>
                  <div className="password-inline-actions">
                    <button type="button" className="primary-button compact" onClick={confirmPasswordChange}>
                      Confirm
                    </button>
                    <button type="button" className="ghost-button compact" onClick={cancelPasswordChange}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" className="ghost-button compact" onClick={beginPasswordChange}>
                  Change password
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="profile-settings-section">
          <h3>Account Access</h3>
          <div className="security-list">
            <div className="security-row">
              <div>
                <strong>Log out of this device</strong>
                <p>Clear this browser session only.</p>
              </div>
              <button type="button" className="ghost-button compact" onClick={onLogout}>
                Log out
              </button>
            </div>
            <div className="security-row">
              <div>
                <strong>Log out of all devices</strong>
                <p>Invalidates active web and mobile tokens after their next server request.</p>
              </div>
              <button type="button" className="ghost-button compact" onClick={onLogoutAllDevices}>
                Log out all
              </button>
            </div>
            <div className="security-row danger-row">
              <div>
                <strong>Delete my account</strong>
                <p>Archive this account and remove access from all devices.</p>
              </div>
              <button type="button" className="ghost-button compact" onClick={onDeleteAccount}>
                Delete account
              </button>
            </div>
          </div>
        </section>

        <section className="profile-settings-section profile-summary-strip">
          <div>
            <strong>{ownedTasks.length}</strong>
            <span>Assigned tasks</span>
          </div>
          <div>
            <strong>{user.role || 'member'}</strong>
            <span>Role</span>
          </div>
        </section>

        {profileMessage && <p className="form-message profile-message">{profileMessage}</p>}

        <div className="profile-save-row">
          <button type="submit" className="primary-button compact">
            Save changes
          </button>
        </div>
      </form>
    </section>
  )
}
