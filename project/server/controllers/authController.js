const bcrypt = require('bcryptjs');
const Auth = require('../models/authModel');
const { logActivity } = require('../services/activity');
const crypto = require('crypto');
const { sendResetEmail, hasPasswordEmailDeliveryConfig } = require('../services/mail');
const { buildAuthResponse, toSafeUser } = require('../utils/authResponse');
const { notify } = require('../services/notifications');
const {
  buildProfileUpdateNotification,
  getChangedProfileFields,
} = require('../utils/profileNotifications');
const {
  firstValidationError,
  validateAccountEmail,
  validateAccountName,
  validateAccountPassword,
  validatePhone,
  validateUsername,
} = require('../utils/accountValidation');
const { generatePasswordResetCode } = require('../utils/passwordReset');

const registerUser = async (req, res) => {
try {
const {
firstName,
lastName,
birthday,
username,
email,
phone,
password
} = req.body;


    // Check required fields
    if (
        !firstName ||
        !lastName ||
        !birthday ||
        !username ||
        !email ||
        !phone ||
        !password
    ) {
        return res.status(400).json({
            message: 'All fields are required.'
        });
    }

    const validationError = firstValidationError([
      () => validateAccountName(firstName, 'First name'),
      () => validateAccountName(lastName, 'Last name'),
      () => validateUsername(username),
      () => validateAccountEmail(email),
      () => validatePhone(phone),
      () => validateAccountPassword(password),
    ]);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    // Check if username already exists
    const existingUsername = await Auth.findOne({ username });

    if (existingUsername) {
        return res.status(409).json({
            message: 'Username is already taken.'
        });
    }

    // Check if email already exists
    const existingEmail = await Auth.findOne({
        email: email.toLowerCase()
    });

    if (existingEmail) {
        return res.status(409).json({
            message: 'Email is already registered.'
        });
    }

    // Check if phone already exists
    const existingPhone = await Auth.findOne({ phone });

    if (existingPhone) {
        return res.status(409).json({
            message: 'Phone number is already registered.'
        });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const newUser = new Auth({
        firstName,
        lastName,
        birthday,
        username,
        email: email.toLowerCase(),
        phone,
        password: hashedPassword
    });

    // Save user to MongoDB
    await newUser.save();

    return res.status(201).json({
        message: 'Registration successful.',
        ...buildAuthResponse(newUser)
    });

} catch (error) {
    console.error('Registration error:', error);

    return res.status(500).json({
        message: 'Server error during registration.'
    });
}


};

const loginUser = async (req, res) => {
try {
const { usernameOrEmail, password } = req.body;


    // Check required fields
    if (!usernameOrEmail || !password) {
        return res.status(400).json({
            message: 'Username/email and password are required.'
        });
    }

    // Find user by username OR email
    const user = await Auth.findOne({
        $or: [
            { username: usernameOrEmail },
            { email: usernameOrEmail.toLowerCase() }
        ]
    });

    // User doesn't exist
    if (!user) {
        return res.status(401).json({
            message: 'Invalid username/email or password.'
        });
    }

    // Compare password
    const passwordMatch = await bcrypt.compare(
        password,
        user.password
    );

    if (!passwordMatch) {
        return res.status(401).json({
            message: 'Invalid username/email or password.'
        });
    }

    if (user.isArchived) return res.status(403).json({ message: 'This account has been archived.' });

    await logActivity(user._id, 'LOGIN', 'User', user._id);

    // Successful login
    return res.status(200).json({
        message: 'Login successful.',
        ...buildAuthResponse(user)
    });

} catch (error) {
    console.error('Login error:', error);

    return res.status(500).json({
        message: 'Server error during login.'
    });
}


};

module.exports = {
registerUser,
loginUser,
getMe: (req, res) => res.json({ user: req.user }),
updateMe: async (req, res, next) => {
  try {
    const allowed = ['firstName', 'lastName', 'username', 'phone', 'avatarUrl', 'email'];
    const validationError = firstValidationError([
      () => (req.body.firstName !== undefined ? validateAccountName(req.body.firstName, 'First name') : null),
      () => (req.body.lastName !== undefined ? validateAccountName(req.body.lastName, 'Last name') : null),
      () => (req.body.username !== undefined ? validateUsername(req.body.username) : null),
      () => (req.body.phone !== undefined ? validatePhone(req.body.phone) : null),
      () => (req.body.email !== undefined ? validateAccountEmail(req.body.email) : null),
    ]);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const before = allowed.reduce((result, key) => ({ ...result, [key]: req.user[key] }), {});
    const changedFields = getChangedProfileFields(before, req.body);
    allowed.forEach((key) => { if (req.body[key] !== undefined) req.user[key] = req.body[key]; });
    await req.user.save();
    const profileNotification = buildProfileUpdateNotification({ user: req.user, changedFields });
    if (profileNotification) {
      const admins = await Auth.find({ role: 'admin', isArchived: false }).select('_id');
      const recipients = [...new Set([req.user._id, ...admins.map((admin) => admin._id)].map(String))];
      await Promise.all(recipients.map((recipient) => notify(
        recipient,
        profileNotification.title,
        profileNotification.message,
        profileNotification.type,
        profileNotification.entityType,
        profileNotification.entityId,
      )));
    }
    res.json({ message: 'Profile updated.', user: toSafeUser(req.user) });
  } catch (error) { next(error); }
},
logoutAll: async (req, res, next) => {
  try {
    await Auth.findByIdAndUpdate(req.user._id, { $inc: { tokenVersion: 1 } });
    res.json({ message: 'Logged out of all devices.' });
  } catch (error) { next(error); }
},
deleteMe: async (req, res, next) => {
  try {
    await Auth.findByIdAndUpdate(req.user._id, { $set: { isArchived: true }, $inc: { tokenVersion: 1 } });
    res.json({ message: 'Account deleted.' });
  } catch (error) { next(error); }
},
changePassword: async (req, res, next) => {
  try {
    const user = await Auth.findById(req.user._id);
    const validationError = validateAccountPassword(req.body.newPassword, 'New password');
    if (validationError) return res.status(400).json({ message: validationError });
    user.password = await bcrypt.hash(req.body.newPassword, 10);
    await user.save();
    res.json({ message: 'Password changed.' });
  } catch (error) { next(error); }
},
forgotPassword: async (req, res, next) => {
  try {
    const user = await Auth.findOne({ email: String(req.body.email || '').toLowerCase() });
    let resetToken;
    if (user) {
      resetToken = generatePasswordResetCode();
      user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
      user.resetPasswordExpires = Date.now() + 30 * 60 * 1000;
      await user.save();
      await sendResetEmail(user.email, resetToken);
    }
    const shouldReturnDevToken = process.env.NODE_ENV !== 'production' && resetToken && !hasPasswordEmailDeliveryConfig();
    res.json({ message: 'If the account exists, a reset code has been created.', ...(shouldReturnDevToken ? { resetToken } : {}) });
  } catch (error) { next(error); }
},
resetPassword: async (req, res, next) => {
  try {
    const hashed = crypto.createHash('sha256').update(String(req.body.token || '')).digest('hex');
    const user = await Auth.findOne({ resetPasswordToken: hashed, resetPasswordExpires: { $gt: Date.now() } });
    if (!user) return res.status(400).json({ message: 'Reset code is invalid or expired.' });
    const validationError = validateAccountPassword(req.body.password);
    if (validationError) return res.status(400).json({ message: validationError });
    user.password = await bcrypt.hash(req.body.password, 10);
    user.resetPasswordToken = undefined; user.resetPasswordExpires = undefined;
    await user.save();
    res.json({ message: 'Password reset successfully.' });
  } catch (error) { next(error); }
}
};
