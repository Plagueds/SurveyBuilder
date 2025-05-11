// backend/controllers/authController.js
// ----- START OF COMPLETE NEW FILE (v1.0 - Auth Controller) -----
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

// Helper function to generate JWT
const generateToken = (id, role) => {
    return jwt.sign({ id, role }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN,
    });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
exports.registerUser = async (req, res) => {
    const { name, email, password, role } = req.body;

    try {
        // Check if all required fields are provided
        if (!name || !email || !password) {
            return res.status(400).json({ success: false, message: 'Please provide name, email, and password.' });
        }

        // Check if user already exists
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ success: false, message: 'User with this email already exists.' });
        }

        // Create user
        const user = await User.create({
            name,
            email,
            password,
            role: role || 'user', // Default to 'user' if not provided or restrict setting role
        });

        if (user) {
            const token = generateToken(user._id, user.role);
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
            res.status(400).json({ success: false, message: 'Invalid user data.' });
        }
    } catch (error) {
        console.error('Registration Error:', error);
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

    try {
        // Check if email and password are provided
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Please provide email and password.' });
        }

        // Check for user by email, explicitly select password
        const user = await User.findOne({ email }).select('+password');

        if (user && (await user.matchPassword(password))) {
            const token = generateToken(user._id, user.role);
            res.status(200).json({
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
            res.status(401).json({ success: false, message: 'Invalid email or password.' });
        }
    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ success: false, message: 'Server error during login.' });
    }
};

// @desc    Get current logged-in user
// @route   GET /api/auth/me
// @access  Private (requires token)
exports.getMe = async (req, res) => {
    // req.user is set by the 'protect' middleware
    try {
        // The user object attached by 'protect' middleware might not have all fields
        // or could be stale. Fetch fresh user data.
        const user = await User.findById(req.user.id).select('-password'); // Exclude password

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

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
        console.error('GetMe Error:', error);
        res.status(500).json({ success: false, message: 'Server error while fetching user details.' });
    }
};
// ----- END OF COMPLETE NEW FILE (v1.0 - Auth Controller) -----