const express = require('express');

const {
    registerUser,
    loginUser, getMe, updateMe, logoutAll, deleteMe, changePassword, forgotPassword, resetPassword
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/me', protect, getMe);
router.patch('/me', protect, updateMe);
router.post('/logout-all', protect, logoutAll);
router.delete('/me', protect, deleteMe);
router.patch('/change-password', protect, changePassword);

module.exports = router;
