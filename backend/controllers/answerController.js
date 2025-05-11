// backend/controllers/answerController.js
// ----- START OF COMPLETE FILE (v1.1 - Confirmed Alignment with Model v1.1) -----
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
        filter.questionId = questionId; // Use correct field name
    }
    if (sessionId) {
        if (typeof sessionId !== 'string' || !sessionId.trim()) return res.status(400).json({ message: 'Session ID must be a non-empty string.' });
        filter.sessionId = sessionId.trim(); // Use correct field name
    }
    try {
        const answers = await Answer.find(filter).sort({ createdAt: -1 }); // Sort by Mongoose timestamp
        console.log(`getAllAnswers: Found ${answers.length} answers matching filter:`, filter);
        res.status(200).json(answers);
    } catch (error) {
        console.error(`getAllAnswers: Error fetching answers:`, error);
        res.status(500).json({ message: 'Failed to fetch answers.' });
    }
};

// POST Add Answer (Matches Frontend Payload and Model v1.1)
exports.addAnswer = async (req, res) => {
     console.log("addAnswer: Received request to add answer:", req.body);
     // Destructure fields matching the frontend payload and the updated model
     const { surveyId, questionId, answerValue, sessionId } = req.body;
     try {
         // Basic Input Validation (using the correct field names)
         if (!surveyId || !mongoose.Types.ObjectId.isValid(surveyId)) return res.status(400).json({ message: 'Valid Survey ID is required.' });
         if (!questionId || !mongoose.Types.ObjectId.isValid(questionId)) return res.status(400).json({ message: 'Valid Question ID is required.' });
         // Allow answerValue to be potentially empty/null based on question type, but require the field itself
         if (answerValue === undefined) return res.status(400).json({ message: 'Answer value field is required.' });
         if (!sessionId || typeof sessionId !== 'string' || !sessionId.trim()) return res.status(400).json({ message: 'Session ID is required.' });

         // Check if the associated survey is active
         const survey = await Survey.findOne({ _id: surveyId, status: 'active' }).select('_id status');
         if (!survey) {
            console.warn(`addAnswer: Attempt to submit answer for inactive/non-existent survey ${surveyId}`);
            return res.status(400).json({ message: 'Cannot submit answer. Survey is not active or does not exist.' });
         }

         // Optional: Check if the question belongs to the survey (more robust)
         // const questionExistsInSurvey = await Question.findOne({ _id: questionId, survey: surveyId }).select('_id');
         // if (!questionExistsInSurvey) { ... }

         // Create new Answer using the updated schema field names
         const newAnswer = new Answer({
             surveyId,
             questionId,
             answerValue, // Matches schema
             sessionId: sessionId.trim() // Matches schema
         });

         const savedAnswer = await newAnswer.save(); // Mongoose validates against the updated schema
         console.log("addAnswer: Successfully saved answer:", savedAnswer._id, "for survey:", surveyId, "session:", sessionId);
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
    const { surveyId } = req.params;
    console.log(`getAnswersBySurveyId: Fetching all answers for survey ID: ${surveyId}`);

    if (!mongoose.Types.ObjectId.isValid(surveyId)) {
        console.warn(`getAnswersBySurveyId: Invalid Survey ID format: ${surveyId}`);
        return res.status(400).json({ message: "Invalid Survey ID format." });
    }

    try {
        const surveyExists = await Survey.findById(surveyId).select('_id');
        if (!surveyExists) {
            console.warn(`getAnswersBySurveyId: Survey not found: ${surveyId}`);
            return res.status(200).json([]); // Return empty for consistency
        }

        // Fetch answers using the correct field name 'surveyId'
        const answers = await Answer.find({ surveyId: surveyId }).sort({ createdAt: 1 }); // Sort by Mongoose timestamp

        console.log(`getAnswersBySurveyId: Found ${answers.length} answers for survey ${surveyId}.`);
        res.status(200).json(answers);

    } catch (error) {
        console.error(`getAnswersBySurveyId: Error fetching answers for survey ${surveyId}:`, error);
        res.status(500).json({ message: 'Failed to fetch answers for the survey.' });
    }
};

// ----- END OF COMPLETE FILE (v1.1 - Confirmed Alignment with Model v1.1) -----