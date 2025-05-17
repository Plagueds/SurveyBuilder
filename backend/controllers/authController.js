// backend/controllers/authController.js
// ----- START OF COMPLETE UPDATED FILE (v1.1 - Added Login Debug Logs) -----
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

// Helper function to generate JWT
const generateToken = (id, role) => {
    // console.log('[AUTH_DEBUG] generateToken called. JWT_SECRET available:', !!process.env.JWT_SECRET, 'JWT_EXPIRES_IN available:', !!process.env.JWT_EXPIRES_IN);
    if (!process.env.JWT_SECRET) {
        console.error('[CRITICAL_AUTH_ERROR] JWT_SECRET is not defined in environment variables!');
        // Potentially throw an error here or handle it, as token generation will fail
    }
    return jwt.sign({ id, role }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '1d', // Default to 1 day if not set, but log a warning
    });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
exports.registerUser = async (req, res) => {
    const { name, email, password, role } = req.body;
    console.log('[AUTH_DEBUG] Register attempt for email:', email);

    try {
        if (!name || !email || !password) {
            console.log('[AUTH_DEBUG] Registration failed: Missing fields.');
            return res.status(400).json({ success: false, message: 'Please provide name, email, and password.' });
        }

        console.log('[AUTH_DEBUG] Checking if user exists:', email);
        const userExists = await User.findOne({ email });
        if (userExists) {
            console.log('[AUTH_DEBUG] Registration failed: User already exists:', email);
            return res.status(400).json({ success: false, message: 'User with this email already exists.' });
        }

        console.log('[AUTH_DEBUG] Creating user:', email);
        const user = await User.create({
            name,
            email,
            password,
            role: role || 'user',
        });
        console.log('[AUTH_DEBUG] User creation result for email:', email, 'User created:', !!user);

        if (user) {
            console.log('[AUTH_DEBUG] Generating token for new user:', user._id);
            const token = generateToken(user._id, user.role);
            console.log('[AUTH_DEBUG] Token generated for user:', user._id);
            res.status(201).json({
                success: true,
                message: 'User registered successfully.',
                token,
                user: {
                    _id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    createdAt: user.createdAt,
                }
            });
        } else {
            console.log('[AUTH_DEBUG] Registration failed: Invalid user data after create attempt.');
            res.status(400).json({ success: false, message: 'Invalid user data.' });
        }
    } catch (error) {
        console.error('[AUTH_ERROR] Registration Error for email:', email, 'Error:', error.message, error.stack);
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ success: false, message: messages.join('. ') });
        }
        res.status(500).json({ success: false, message: 'Server error during registration.' });
    }
};

// @desc    Authenticate user & get token (Login)
// @route   POST /api/auth/login
// @access  Public
exports.loginUser = async (req, res) => {
    const { email, password } = req.body;
    console.log(`[AUTH_DEBUG] Login attempt for email: ${email}`);

    try {
        if (!email || !password) {
            console.log('[AUTH_DEBUG] Login failed: Email or password missing.');
            return res.status(400).json({ success: false, message: 'Please provide email and password.' });
        }

        console.log(`[AUTH_DEBUG] Attempting to find user by email: ${email}. MONGO_URI set: ${!!process.env.MONGO_URI}`);
        const user = await User.findOne({ email }).select('+password');
        console.log(`[AUTH_DEBUG] User find result for ${email}: User found - ${!!user}`);

        if (user) {
            console.log(`[AUTH_DEBUG] User ${email} found. Attempting to match password.`);
            const isMatch = await user.matchPassword(password);
            console.log(`[AUTH_DEBUG] Password match result for ${email}: ${isMatch}`);

            if (isMatch) {
                console.log(`[AUTH_DEBUG] Password matched for ${email}. Generating token. JWT_SECRET set: ${!!process.env.JWT_SECRET}, JWT_EXPIRES_IN set: ${!!process.env.JWT_EXPIRES_IN}`);
                const token = generateToken(user._id, user.role);
                console.log(`[AUTH_DEBUG] Token generated successfully for ${email}. Sending 200 response.`);
                return res.status(200).json({ // Added return here
                    success: true,
                    message: 'Logged in successfully.',
                    token,
                    user: {
                        _id: user._id,
                        name: user.name,
                        email: user.email,
                        role: user.role,
                        createdAt: user.createdAt,
                    }
                });
            } else {
                console.log(`[AUTH_DEBUG] Password mismatch for ${email}. Sending 401 response.`);
                return res.status(401).json({ success: false, message: 'Invalid email or password.' }); // Added return
            }
        } else {
            console.log(`[AUTH_DEBUG] User not found for email: ${email}. Sending 401 response.`);
            return res.status(401).json({ success: false, message: 'Invalid email or password.' }); // Added return
        }
    } catch (error) {
        // Log the full error object, including stack if available
        console.error(`[AUTH_ERROR] Login Error for email: ${email}. Error: ${error.message}`, error.stack ? error.stack : 'No stack available');
        // Ensure a response is always sent
        if (!res.headersSent) {
            return res.status(500).json({ success: false, message: 'Server error during login.' }); // Added return
        }
    }
};

// @desc    Get current logged-in user
// @route   GET /api/auth/me
// @access  Private (requires token)
exports.getMe = async (req, res) => {
    console.log('[AUTH_DEBUG] getMe called for user ID from token:', req.user ? req.user.id : 'User not in req');
    try {
        if (!req.user || !req.user.id) { // Added check for req.user.id
             console.log('[AUTH_DEBUG] getMe failed: req.user or req.user.id missing.');
             return res.status(401).json({ success: false, message: 'Not authorized, user details missing from token processing.' });
        }
        const user = await User.findById(req.user.id).select('-password');
        console.log('[AUTH_DEBUG] getMe: User.findById result:', !!user);

        if (!user) {
            console.log('[AUTH_DEBUG] getMe failed: User not found in DB for ID:', req.user.id);
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        console.log('[AUTH_DEBUG] getMe successful for user:', user.email);
        res.status(200).json({
            success: true,
            user: {
                 _id: user._id,
                 name: user.name,
                 email: user.email,
                 role: user.role,
                 createdAt: user.createdAt,
            }
        });
    } catch (error) {
        console.error('[AUTH_ERROR] GetMe Error for user ID:', req.user ? req.user.id : 'Unknown', 'Error:', error.message, error.stack);
        res.status(500).json({ success: false, message: 'Server error while fetching user details.' });
    }
};
// ----- END OF COMPLETE UPDATED FILE (v1.1 - Added Login Debug Logs) -----