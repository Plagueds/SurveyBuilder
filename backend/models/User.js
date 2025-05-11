// backend/models/User.js
// ----- START OF COMPLETE NEW FILE (v1.0 - User Model) -----
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please provide your name.'],
        trim: true,
    },
    email: {
        type: String,
        required: [true, 'Please provide your email address.'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [
            /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
            'Please provide a valid email address.',
        ],
    },
    password: {
        type: String,
        required: [true, 'Please provide a password.'],
        minlength: [6, 'Password must be at least 6 characters long.'],
        select: false, // Do not return password by default when querying users
    },
    role: {
        type: String,
        enum: ['user', 'admin', 'viewer'], // Add roles as needed
        default: 'user',
    },
    // You can add more fields like:
    // organization: { type: String },
    // isActive: { type: Boolean, default: true },
    // lastLogin: { type: Date },
}, {
    timestamps: true, // Adds createdAt and updatedAt
});

// --- Mongoose Middleware ---

// Hash password before saving a new user or when password is modified
userSchema.pre('save', async function(next) {
    // Only run this function if password was actually modified
    if (!this.isModified('password')) {
        return next();
    }
    // Hash the password with cost of 12
    const salt = await bcrypt.genSalt(10); // 10-12 is a good range
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// --- Mongoose Instance Methods ---

// Method to compare entered password with the hashed password in the database
userSchema.methods.matchPassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);

module.exports = User;
// ----- END OF COMPLETE NEW FILE (v1.0 - User Model) -----