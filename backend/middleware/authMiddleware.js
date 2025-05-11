// backend/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Survey = require('../models/Survey');
const mongoose = require('mongoose');

const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            console.log('Decoded JWT ID:', decoded.id); // <<<--- ADD THIS LOG

            req.user = await User.findById(decoded.id).select('-password');

            if (!req.user) {
                console.error('User not found in DB for ID:', decoded.id); // <<<--- ADD THIS LOG
                return res.status(401).json({ success: false, message: 'Not authorized, user not found for this token.' });
            }
            next();
        } catch (error) {
            console.error('Token verification error in protect middleware:', error.message); // Enhanced log
            if (error.name === 'JsonWebTokenError') {
                return res.status(401).json({ success: false, message: 'Not authorized, token failed (invalid signature).' });
            }
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({ success: false, message: 'Not authorized, token expired.' });
            }
            // Catching other potential errors from User.findById if it throws, though it usually returns null for not found
            return res.status(401).json({ success: false, message: 'Not authorized, token processing failed.' }); // Generic message
        }
    }

    if (!token) {
        return res.status(401).json({ success: false, message: 'Not authorized, no token provided.' });
    }
};

// ... (rest of your authorize and authorizeSurveyAccess functions remain the same)
const authorize = (...roles) => { // Your existing authorize function
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ success: false, message: `User role '${req.user ? req.user.role : 'guest'}' is not authorized to access this route.` });
        }
        next();
    };
};

const authorizeSurveyAccess = async (req, res, next) => { // Your existing authorizeSurveyAccess function
    try {
        const surveyId = req.params.surveyId || req.params.id;
        if (!surveyId || !mongoose.Types.ObjectId.isValid(surveyId)) {
            return res.status(400).json({ success: false, message: 'Invalid Survey ID provided for authorization.' });
        }
        const survey = await Survey.findById(surveyId).select('createdBy status').lean();
        if (!survey) {
            return res.status(404).json({ success: false, message: 'Survey not found.' });
        }
        if (survey.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'You are not authorized to access or modify this survey.' });
        }
        req.survey = survey;
        next();
    } catch (error) {
        console.error('Survey Authorization Error:', error);
        res.status(500).json({ success: false, message: 'Server error during survey authorization.' });
    }
};

module.exports = { protect, authorize, authorizeSurveyAccess };