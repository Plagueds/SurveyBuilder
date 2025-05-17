// backend/controllers/answerController.js
// ----- START OF COMPLETE UPDATED FILE -----
const mongoose = require('mongoose');
const Answer = require('../models/Answer'); // Uses the updated Answer model
const Survey = require('../models/Survey');
const Question = require('../models/Question'); // Keep for potential future use

// GET All Answers (with optional filters: questionId, sessionId)
exports.getAllAnswers = async (req, res) => {
    const { questionId, sessionId } = req.query;
    console.log(`getAllAnswers: Query params received:`, req.query);
    let filter = {};
    if (questionId) {
        if (!mongoose.Types.ObjectId.isValid(questionId)) return res.status(400).json({ message: 'Invalid Question ID format.' });
        filter.questionId = questionId;
    }
    if (sessionId) {
        if (typeof sessionId !== 'string' || !sessionId.trim()) return res.status(400).json({ message: 'Session ID must be a non-empty string.' });
        filter.sessionId = sessionId.trim();
    }
    try {
        const answers = await Answer.find(filter).sort({ createdAt: -1 });
        console.log(`getAllAnswers: Found ${answers.length} answers matching filter:`, filter);
        res.status(200).json(answers); // Assuming frontend expects array directly for this generic endpoint
    } catch (error) {
        console.error(`getAllAnswers: Error fetching answers:`, error);
        res.status(500).json({ message: 'Failed to fetch answers.' });
    }
};

// POST Add Answer (Matches Frontend Payload and Model v1.1)
exports.addAnswer = async (req, res) => {
     console.log("addAnswer: Received request to add answer:", req.body);
     // Destructure fields matching the frontend payload and the updated model
     // The field from frontend is surveyId, but in Answer model it's 'survey'
     const { surveyId: surveyObjectId, questionId, answerValue, sessionId } = req.body; // Renamed surveyId to surveyObjectId for clarity
     try {
         if (!surveyObjectId || !mongoose.Types.ObjectId.isValid(surveyObjectId)) return res.status(400).json({ message: 'Valid Survey ID is required.' });
         if (!questionId || !mongoose.Types.ObjectId.isValid(questionId)) return res.status(400).json({ message: 'Valid Question ID is required.' });
         if (answerValue === undefined) return res.status(400).json({ message: 'Answer value field is required.' });
         if (!sessionId || typeof sessionId !== 'string' || !sessionId.trim()) return res.status(400).json({ message: 'Session ID is required.' });

         const surveyDoc = await Survey.findOne({ _id: surveyObjectId, status: 'active' }).select('_id status');
         if (!surveyDoc) {
            console.warn(`addAnswer: Attempt to submit answer for inactive/non-existent survey ${surveyObjectId}`);
            return res.status(400).json({ message: 'Cannot submit answer. Survey is not active or does not exist.' });
         }

         const newAnswer = new Answer({
             survey: surveyObjectId, // Use 'survey' to match the schema
             questionId,
             answerValue,
             sessionId: sessionId.trim()
         });

         const savedAnswer = await newAnswer.save();
         console.log("addAnswer: Successfully saved answer:", savedAnswer._id, "for survey:", surveyObjectId, "session:", sessionId);
         res.status(201).json(savedAnswer);

     } catch (error) {
         console.error("Error adding answer:", error);
         if (error.name === 'ValidationError' || error.name === 'CastError') {
             const messages = error.errors ? Object.values(error.errors).map(val => val.message) : [error.message];
             return res.status(400).json({ message: "Validation Error: " + messages.join('. ') });
         }
         res.status(500).json({ message: "Error saving answer on the server." });
     }
};


// GET All Answers for a Specific Survey
exports.getAnswersBySurveyId = async (req, res) => {
    const { surveyId } = req.params; // This surveyId is the ObjectId string
    console.log(`getAnswersBySurveyId: Fetching all answers for survey ID: ${surveyId}`);

    if (!mongoose.Types.ObjectId.isValid(surveyId)) {
        console.warn(`getAnswersBySurveyId: Invalid Survey ID format: ${surveyId}`);
        return res.status(400).json({ success: false, message: "Invalid Survey ID format." }); // Added success: false
    }

    try {
        // First, check if the survey exists and if the user is authorized
        // The authorizeSurveyAccess middleware (if correctly applied to the route) should handle this.
        // However, a direct check here can be an additional safeguard or if middleware isn't used.
        const surveyExists = await Survey.findById(surveyId).select('_id createdBy'); // Also fetch createdBy for auth check
        if (!surveyExists) {
            console.warn(`getAnswersBySurveyId: Survey not found: ${surveyId}`);
            return res.status(404).json({ success: false, message: "Survey not found." }); // Changed to 404 and added success: false
        }

        // Authorization check (redundant if authorizeSurveyAccess middleware is effective, but safe)
        // Assuming req.user is populated by 'protect' middleware
        if (req.user && String(surveyExists.createdBy) !== String(req.user.id) && req.user.role !== 'admin') {
            console.warn(`getAnswersBySurveyId: User ${req.user.id} not authorized for survey ${surveyId}`);
            return res.status(403).json({ success: false, message: 'Not authorized to access answers for this survey.' });
        }


        // Fetch answers using the correct field name 'survey'
        const answers = await Answer.find({ survey: surveyId }).sort({ createdAt: 1 }).lean(); // Use .lean() for read-only

        console.log(`getAnswersBySurveyId: Found ${answers.length} answers for survey ${surveyId}.`);
        // Return in the format expected by SurveyResultsPage
        res.status(200).json({
            success: true,
            count: answers.length,
            data: answers
        });

    } catch (error) {
        console.error(`getAnswersBySurveyId: Error fetching answers for survey ${surveyId}:`, error);
        res.status(500).json({ success: false, message: 'Failed to fetch answers for the survey.' });
    }
};
// ----- END OF COMPLETE UPDATED FILE -----