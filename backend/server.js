// backend/server.js
// ----- START OF COMPLETE MODIFIED FILE (vNext - Added trust proxy) -----
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// --- Load Environment Variables ---
dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// --- Trust Proxy Setting ---
// This is important for accurately getting req.ip when behind a proxy like Render's load balancer.
// '1' means trust the first hop. Consult Render's documentation if a different setting is needed.
app.set('trust proxy', 1);

const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/voc-app';
mongoose.connect(mongoURI)
  .then(() => console.log('MongoDB connected successfully.'))
  .catch(err => console.error('MongoDB connection error:', err));

// --- Middleware setup ---
const allowedOriginsFromEnv = [
    process.env.FRONTEND_URL,
    'http://localhost:3000'
].filter(Boolean);

const normalizedAllowedOrigins = allowedOriginsFromEnv.map(url => url ? url.replace(/\/$/, '') : url);
console.log('[CORS] Normalized Allowed Origins on Startup:', normalizedAllowedOrigins);

const corsOptions = {
    origin: function (origin, callback) {
        const normalizedIncomingOrigin = origin ? origin.replace(/\/$/, '') : origin;
        if (!normalizedIncomingOrigin || normalizedAllowedOrigins.includes(normalizedIncomingOrigin)) {
            callback(null, true);
        } else {
            console.warn(`[CORS Blocked] Incoming Origin: ${origin} (Normalized: ${normalizedIncomingOrigin}). Allowed: ${JSON.stringify(normalizedAllowedOrigins)}`);
            callback(new Error(`Origin ${origin} not allowed by CORS`));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-recaptcha-token'],
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());

// Simple root route
app.get('/', (req, res) => res.send('VoC Platform Backend'));

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

// --- Example: /api/results/:questionId route ---
const Question = require('./models/Question');
const Answer = require('./models/Answer');

app.get('/api/results/:questionId', async (req, res) => {
    const { questionId } = req.params;
    console.log(`[Results Route] GET /api/results/${questionId}`);
    if (!mongoose.Types.ObjectId.isValid(questionId)) {
        return res.status(400).json({ success: false, message: 'Invalid question ID.' });
    }
    try {
        // TODO: Add authentication and authorization
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

// --- Error Handling Middleware ---
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
// ----- END OF COMPLETE MODIFIED FILE (vNext - Added trust proxy) -----