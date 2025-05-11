// backend/server.js
// This is the server.js version you should use, based on previous updates.
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// --- Load Environment Variables ---
dotenv.config(); 

const app = express();
const port = process.env.PORT || 3001;

const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/voc-app';
mongoose.connect(mongoURI)
  .then(() => console.log('MongoDB connected successfully.'))
  .catch(err => console.error('MongoDB connection error:', err));

// --- Middleware setup ---

// --- START CORS CONFIGURATION ---
const allowedOrigins = [
    process.env.FRONTEND_URL, 
    'http://localhost:3000'   
].filter(Boolean); 

console.log('[CORS] Allowed Origins:', allowedOrigins);

const corsOptions = {
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.warn(`[CORS Blocked] Origin: ${origin}`);
            callback(new Error(`Origin ${origin} not allowed by CORS`));
        }
    },
    credentials: true, 
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], 
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-recaptcha-token'], 
    optionsSuccessStatus: 200 
};

app.use(cors(corsOptions));
// --- END CORS CONFIGURATION ---

app.use(express.json()); 

// Simple root route
app.get('/', (req, res) => res.send('VoC Platform Backend'));


// --- Import Routers ---
// Ensure these files exist in your ./routes/ directory:
const questionRoutes = require('./routes/questionRoutes');
const answerRoutes = require('./routes/answerRoutes');       // You provided this
const surveyRoutes = require('./routes/surveyRoutes');       // You provided this
const authRoutes = require('./routes/authRoutes');         // You provided this
const publicSurveyAccessRoutes = require('./routes/publicSurveyAccessRoutes');


// --- Use API Routers (typically prefixed with /api) ---
app.use('/api/auth', authRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/answers', answerRoutes);
app.use('/api/surveys', surveyRoutes);

// --- Use PUBLIC Survey Access Routes (not prefixed with /api for shorter URLs) ---
app.use('/s', publicSurveyAccessRoutes);


// --- Example: /api/results/:questionId route (Consider moving to its own router) ---
const Question = require('./models/Question'); 
const Answer = require('./models/Answer');     

app.get('/api/results/:questionId', async (req, res) => {
    const { questionId } = req.params;
    console.log(`[Results Route] GET /api/results/${questionId}`);
    if (!mongoose.Types.ObjectId.isValid(questionId)) {
        return res.status(400).json({ success: false, message: 'Invalid question ID.' });
    }
    try {
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
// --- End of /api/results inline route example ---


// --- Error Handling Middleware (Place near the end, before app.listen) ---
app.use((err, req, res, next) => {
    console.error("Unhandled Error:", err.stack || err);

    if (err.message && err.message.includes('not allowed by CORS')) {
        return res.status(403).json({ 
            success: false,
            message: err.message
        });
    }

    const statusCode = err.statusCode || 500;
    const message = err.message || 'An unexpected server error occurred.';
    
    res.status(statusCode).json({
        success: false,
        message: message,
    });
});


// --- Start Server ---
app.listen(port, () => console.log(`Backend server listening in ${process.env.NODE_ENV || 'development'} mode on port ${port}`));