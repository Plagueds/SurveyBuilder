// backend/server.js
// ----- START OF COMPLETE UPDATED CODE (vX.X+1 - Added Public Survey Access Routes) -----
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// --- Load Environment Variables ---
dotenv.config(); // Loads variables from .env file for local development

// Models are typically required in controllers
// const Question = require('./models/Question');
// const Answer = require('./models/Answer');

const app = express();
const port = process.env.PORT || 3001; // Render will set PORT

const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/voc-app'; // Render will use MONGO_URI
mongoose.connect(mongoURI)
  .then(() => console.log('MongoDB connected successfully.'))
  .catch(err => console.error('MongoDB connection error:', err));

// Middleware setup
// This CORS setup allows requests from the URL specified in the FRONTEND_URL environment variable.
// In production (e.g., on Render), set FRONTEND_URL to your deployed Netlify frontend's URL.
// For local development, it defaults to 'http://localhost:3000' if FRONTEND_URL is not set.
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true // Important if your frontend needs to send cookies (e.g., for sessions)
}));
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


// --- Example: Keeping the /api/results route inline (Consider moving to its own router) ---
// This route should ideally be part of a dedicated results or survey analysis router.
// Also, it should be protected and authorized.
const Question = require('./models/Question'); // Assuming Question model is needed here
const Answer = require('./models/Answer');     // Assuming Answer model is needed here

app.get('/api/results/:questionId', async (req, res) => {
    const { questionId } = req.params;
    console.log(`GET /api/results/${questionId}`);
    if (!mongoose.Types.ObjectId.isValid(questionId)) {
        return res.status(400).json({ message: 'Invalid question ID.' });
    }
    try {
        // TODO: Add authentication and authorization here.
        // Only authorized users (e.g., survey owner/admin) should access results.

        const [question, answers] = await Promise.all([
            Question.findById(questionId).select('text type options addOtherOption requireOtherIfSelected addNAOption').lean(),
            Answer.find({ questionId: questionId }).select('answerValue createdAt sessionId').sort({ createdAt: 1 }).lean()
        ]);

        if (!question) {
            return res.status(404).json({ message: 'Question not found.' });
        }

        console.log(`GET /api/results/${questionId} - Found question and ${answers.length} answers.`);
        res.status(200).json({ question: question, answers: answers });

    } catch (error) {
        console.error(`GET /api/results/${questionId} - Error fetching results:`, error);
        res.status(500).json({ message: 'Failed to fetch results due to a server error.' });
    }
});
// --- End of /api/results inline route example ---


// --- Error Handling Middleware (Place near the end, before app.listen) ---
// This should be the last middleware added with app.use()
app.use((err, req, res, next) => {
    console.error("Unhandled Error:", err.stack || err); // Log the full error stack for debugging
    // If the error is a known type (e.g., validation error, auth error),
    // it might have a specific statusCode and message.
    // Otherwise, default to 500.
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
app.listen(port, () => console.log(`Backend server listening at http://localhost:${port}`));
// ----- END OF COMPLETE UPDATED CODE (vX.X+1 - Added Public Survey Access Routes) -----