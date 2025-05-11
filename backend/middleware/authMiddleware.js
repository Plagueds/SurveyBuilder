// backend/middleware/authMiddleware.js
// ----- START OF COMPLETE UPDATED FILE (v1.1 - Added authorizeSurveyAccess) -----
const jwt = require('jsonwebtoken');
const User = require('../models/User'); // Adjust path if your models are elsewhere
const Survey = require('../models/Survey'); // <<<--- ADD THIS LINE: Import Survey model
const mongoose = require('mongoose'); // <<<--- ADD THIS LINE: For ObjectId validation

const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = await User.findById(decoded.id).select('-password');

            if (!req.user) {
                return res.status(401).json({ success: false, message: 'Not authorized, user not found for this token.' });
            }
            next();
        } catch (error) {
            console.error('Token verification error:', error.message);
            if (error.name === 'JsonWebTokenError') {
                return res.status(401).json({ success: false, message: 'Not authorized, token failed (invalid signature).' });
            }
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({ success: false, message: 'Not authorized, token expired.' });
            }
            return res.status(401).json({ success: false, message: 'Not authorized, token failed.' });
        }
    }

    if (!token) {
        return res.status(401).json({ success: false, message: 'Not authorized, no token provided.' });
    }
};

// General role-based authorization middleware
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ success: false, message: `User role '${req.user ? req.user.role : 'guest'}' is not authorized to access this route.` });
        }
        next();
    };
};

// --- Survey Specific Authorization Middleware ---
// This middleware checks if the logged-in user is the owner of the survey
// or if the user has an admin role.
// It should be placed *after* the 'protect' middleware in the route chain.
const authorizeSurveyAccess = async (req, res, next) => {
    try {
        const surveyId = req.params.surveyId || req.params.id; // Accommodate different param names if necessary

        if (!surveyId || !mongoose.Types.ObjectId.isValid(surveyId)) {
            return res.status(400).json({ success: false, message: 'Invalid Survey ID provided for authorization.' });
        }

        // Fetch only necessary fields for authorization. Lean for performance.
        const survey = await Survey.findById(surveyId).select('createdBy status').lean();

        if (!survey) {
            return res.status(404).json({ success: false, message: 'Survey not found.' });
        }

        // Check ownership or admin role
        // req.user is populated by the 'protect' middleware
        if (survey.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'You are not authorized to access or modify this survey.' });
        }

        // Attach the fetched survey (or relevant parts) to the request object
        // This can be useful in controllers to avoid re-fetching the survey.
        req.survey = survey; // Contains _id, createdBy, status

        next(); // User is authorized
    } catch (error) {
        console.error('Survey Authorization Error:', error);
        res.status(500).json({ success: false, message: 'Server error during survey authorization.' });
    }
};


module.exports = { protect, authorize, authorizeSurveyAccess }; // <<<--- EXPORT authorizeSurveyAccess
// ----- END OF COMPLETE UPDATED FILE (v1.1 - Added authorizeSurveyAccess) -----