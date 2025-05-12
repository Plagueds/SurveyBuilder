// backend/server.js
// ----- START OF COMPLETE MODIFIED FILE (vNext2 - Refined CORS) -----
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// --- Load Environment Variables ---
dotenv.config();

const app = express();
const port = process.env.PORT || 3001; // Changed from 3001 to 5001 if that was your previous backend port, adjust as needed

// --- Trust Proxy Setting ---
app.set('trust proxy', 1); // Important for req.ip behind proxies

const mongoURI = process.env.MONGO_URI; // Rely on .env for this
if (!mongoURI) {
    console.error('FATAL ERROR: MONGO_URI is not defined in .env file.');
    process.exit(1); // Exit if DB connection string is missing
}

mongoose.connect(mongoURI)
  .then(() => console.log('MongoDB connected successfully.'))
  .catch(err => {
    console.error('MongoDB connection error:', err)
    process.exit(1); // Exit if DB connection fails
});

// --- Middleware setup ---
const frontendUrlFromEnv = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.replace(/\/$/, '') : null;
const allowedOrigins = [
    // Add your production frontend URL directly for clarity
    // Ensure this matches exactly what the browser sends in the Origin header
    'https://surveybuilder.netlify.app', // Hardcode primary prod origin
];

// Add from ENV if it's different and exists
if (frontendUrlFromEnv && frontendUrlFromEnv !== 'https://surveybuilder.netlify.app') {
    allowedOrigins.push(frontendUrlFromEnv);
}

// Add localhost for development
if (process.env.NODE_ENV !== 'production') {
    allowedOrigins.push('http://localhost:3000'); // Common React dev port
    allowedOrigins.push('http://localhost:5173'); // Common Vite dev port
    // Add any other local dev origins
}

console.log('[CORS] Effective Allowed Origins on Startup:', allowedOrigins);

const corsOptions = {
    origin: function (origin, callback) {
        // Normalize incoming origin by removing trailing slash if it exists
        const normalizedIncomingOrigin = origin ? origin.replace(/\/$/, '') : origin;

        // Allow requests with no origin (like mobile apps or curl requests) OR if origin is in allowed list
        if (!normalizedIncomingOrigin || allowedOrigins.includes(normalizedIncomingOrigin)) {
            // console.log(`[CORS Allowed] Origin: ${origin} (Normalized: ${normalizedIncomingOrigin})`); // Optional: log allowed origins
            callback(null, true);
        } else {
            console.warn(`[CORS Blocked] Incoming Origin: "${origin}" (Normalized: "${normalizedIncomingOrigin}"). Allowed Origins: ${JSON.stringify(allowedOrigins)}`);
            callback(new Error(`Origin ${origin} not allowed by CORS`));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type', 
        'Authorization', // For JWT tokens
        'X-Requested-With', 
        'x-recaptcha-token', // For reCAPTCHA
        'x-survey-password'  // For password-protected surveys
    ],
    optionsSuccessStatus: 200 // Some legacy browsers (IE11, various SmartTVs) choke on 204
};

// Apply CORS middleware globally before any routes
app.use(cors(corsOptions));

// Middleware to parse JSON bodies
app.use(express.json());

// Simple root route
app.get('/', (req, res) => {
    // Log IP address to verify 'trust proxy' setting
    console.log(`Root route '/' accessed. req.ip: ${req.ip}, req.ips: ${JSON.stringify(req.ips)}`);
    res.send('VoC Platform Backend is running!');
});

// --- Import Routers ---
const questionRoutes = require('./routes/questionRoutes');
const answerRoutes = require('./routes/answerRoutes');
const surveyRoutes = require('./routes/surveyRoutes');
const authRoutes = require('./routes/authRoutes');
const publicSurveyAccessRoutes = require('./routes/publicSurveyAccessRoutes');

// --- Use API Routers ---
app.use('/api/auth', authRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/answers', answerRoutes);
app.use('/api/surveys', surveyRoutes);

// --- Use PUBLIC Survey Access Routes ---
app.use('/s', publicSurveyAccessRoutes);


// --- Example: /api/results/:questionId route (from your provided code) ---
const Question = require('./models/Question'); // Ensure this path is correct
const Answer = require('./models/Answer');     // Ensure this path is correct

app.get('/api/results/:questionId', async (req, res) => {
    const { questionId } = req.params;
    console.log(`[Results Route] GET /api/results/${questionId}`);
    if (!mongoose.Types.ObjectId.isValid(questionId)) {
        return res.status(400).json({ success: false, message: 'Invalid question ID.' });
    }
    try {
        // TODO: Add authentication and authorization if this route should be protected
        const [question, answers] = await Promise.all([
            Question.findById(questionId).select('text type options addOtherOption requireOtherIfSelected addNAOption').lean(),
            Answer.find({ questionId: questionId }).select('answerValue createdAt sessionId').sort({ createdAt: 1 }).lean()
        ]);
        if (!question) {
            return res.status(404).json({ success: false, message: 'Question not found.' });
        }
        console.log(`[Results Route] GET /api/results/${questionId} - Found question and ${answers.length} answers.`);
        res.status(200).json({ success: true, question: question, answers: answers });
    } catch (error) {
        console.error(`[Results Route] GET /api/results/${questionId} - Error fetching results:`, error);
        res.status(500).json({ success: false, message: 'Failed to fetch results due to a server error.' });
    }
});


// --- Global Error Handling Middleware ---
// This should be the last middleware added
app.use((err, req, res, next) => {
    console.error("--- Unhandled Error Caught ---");
    console.error("Error Message:", err.message);
    console.error("Error Stack:", err.stack || "No stack available");
    console.error("Request Path:", req.path);
    console.error("Request Method:", req.method);
    
    if (err.message && err.message.includes('not allowed by CORS')) {
        // This specific error is already handled by the CORS middleware's callback,
        // but if it somehow propagates, we send a 403.
        return res.status(403).json({
            success: false,
            message: err.message // Provide the specific CORS error message
        });
    }

    // For other errors, send a generic 500 response
    const statusCode = err.statusCode || 500;
    const responseMessage = err.expose ? err.message : 'An unexpected server error occurred. Please try again later.';
    
    res.status(statusCode).json({
        success: false,
        message: responseMessage,
        // Optionally, include error code or type in development
        ...(process.env.NODE_ENV !== 'production' && { errorType: err.name }),
    });
});

// --- Start Server ---
app.listen(port, () => {
    console.log(`Backend server listening in ${process.env.NODE_ENV || 'development'} mode on port ${port}`);
    console.log(`Frontend URL from ENV: ${process.env.FRONTEND_URL}`);
});
// ----- END OF COMPLETE MODIFIED FILE (vNext2 - Refined CORS) -----