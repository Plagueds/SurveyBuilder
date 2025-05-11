// backend/routes/authRoutes.js
// ----- START OF COMPLETE NEW FILE (v1.0 - Auth Routes) -----
const express = require('express');
const router = express.Router();
const { registerUser, loginUser, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware'); // We'll create this next

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/me', protect, getMe); // Protect this route

module.exports = router;
// ----- END OF COMPLETE NEW FILE (v1.0 - Auth Routes) -----