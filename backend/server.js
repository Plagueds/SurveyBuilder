// backend/server.js
// ----- START OF COMPLETE MODIFIED FILE (CORS Update) -----
const express = require('express');
const cors = require('cors'); // Make sure cors is installed: npm install cors
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// --- Load Environment Variables ---
dotenv.config(); // Loads variables from .env file for local development

const app = express();
const port = process.env.PORT || 3001; // Render will set PORT

const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/voc-app'; // Render will use MONGO_URI
mongoose.connect(mongoURI)
  .then(() => console.log('MongoDB connected successfully.'))
  .catch(err => console.error('MongoDB connection error:', err));

// --- Middleware setup ---

// --- START CORS CONFIGURATION ---
const allowedOrigins = [
    process.env.FRONTEND_URL, // Your deployed Netlify frontend (e.g., https://iridescent-pasca-e53e01.netlify.app)
    'http://localhost:3000'   // Your local frontend for development
    // Add any other origins you need to support (e.g., specific preview URLs if different)
].filter(Boolean); // .filter(Boolean) removes any undefined/null values if FRONTEND_URL isn't set

console.log('[CORS] Allowed Origins:', allowedOrigins);

const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps, Postman, curl)
        // or if the origin is in our whitelist
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.warn(`[CORS Blocked] Origin: ${origin}`);
            callback(new Error(`Origin ${origin} not allowed by CORS`));
        }
    },
    credentials: true, // Important if your frontend needs to send cookies or Authorization headers
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], // Allowed HTTP methods
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-recaptcha-token'], // Allowed headers
    optionsSuccessStatus: 200 // For compatibility with older browsers/clients
};

app.use(cors(corsOptions));
// --- END CORS CONFIGURATION ---

app.use(express.json()); // Body parser for JSON requests

// Simple root route
app.get('/', (req, res) => res.send('VoC Platform Backend'));


// --- Import Routers ---
const questionRoutes = require('./routes/questionRoutes');
const answerRoutes = require('./routes/answerRoutes');
const surveyRoutes = require('./routes/surveyRoutes');
const authRoutes = require('./routes/authRoutes');
const publicSurveyAccessRoutes = require('./routes/publicSurveyAccessRoutes');


// --- Use API Routers (typically prefixed with /api) ---
app.use('/api/auth', authRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/answers', answerRoutes);
app.use('/api/surveys', surveyRoutes);

// --- Use PUBLIC Survey Access Routes (not prefixed with /api for shorter URLs) ---
app.use('/s', publicSurveyAccessRoutes);


// --- Example: /api/results/:questionId route (Consider moving to its own router) ---
// This route should ideally be part of a dedicated results or survey analysis router.
// Also, it should be protected and authorized.
const Question = require('./models/Question'); // Assuming Question model is needed here
const Answer = require('./models/Answer');     // Assuming Answer model is needed here

app.get('/api/results/:questionId', async (req, res) => {
    const { questionId } = req.params;
    console.log(`[Results Route] GET /api/results/${questionId}`);
    if (!mongoose.Types.ObjectId.isValid(questionId)) {
        return res.status(400).json({ success: false, message: 'Invalid question ID.' });
    }
    try {
        // TODO: Add authentication and authorization here.
        // For now, assuming it's an open endpoint for testing, but this is a security risk.
        // Example: if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

        const [question, answers] = await Promise.all([
            Question.findById(questionId).select('text type options addOtherOption requireOtherIfSelected addNAOption').lean(),
            Answer.find({ questionId: questionId }).select('answerValue createdAt sessionId').sort({ createdAt: 1 }).lean()
        ]);

        if (!question) {
            return res.status(404).json({ success: false, message: 'Question not found.' });
        }

        console.log(`[Results Route] GET /api/results/${questionId} - Found question and ${answers.length} answers.`);
        res.status(200).json({ success: true, question: question, answers: answers }); // Added success flag

    } catch (error) {
        console.error(`[Results Route] GET /api/results/${questionId} - Error fetching results:`, error);
        res.status(500).json({ success: false, message: 'Failed to fetch results due to a server error.' });
    }
});
// --- End of /api/results inline route example ---


// --- Error Handling Middleware (Place near the end, before app.listen) ---
// This should be the last middleware added with app.use()
app.use((err, req, res, next) => {
    console.error("Unhandled Error:", err.stack || err);

    // If it's a CORS error from our custom origin function
    if (err.message && err.message.includes('not allowed by CORS')) {
        return res.status(403).json({ // 403 Forbidden is more appropriate for CORS denial
            success: false,
            message: err.message
        });
    }

    const statusCode = err.statusCode || 500;
    const message = err.message || 'An unexpected server error occurred.';
    
    res.status(statusCode).json({
        success: false,
        message: message,
        // Optionally, include error details in development but not production
        // error: process.env.NODE_ENV === 'development' ? err : {}
    });
});


// --- Start Server ---
app.listen(port, () => console.log(`Backend server listening in ${process.env.NODE_ENV || 'development'} mode on port ${port}`));
// ----- END OF COMPLETE MODIFIED FILE (CORS Update) -----