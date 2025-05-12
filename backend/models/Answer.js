// backend/models/Answer.js
// ----- START OF COMPLETE MODIFIED FILE -----
const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
    surveyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Survey',
        required: true,
        index: true,
    },
    questionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Question',
        required: true,
        index: true,
    },
    sessionId: { // Identifies a single respondent's session
        type: String,
        required: true,
        index: true,
    },
    answerValue: { // Stores the main answer (e.g., selected option, text input, rating value, JSON for complex types)
        type: mongoose.Schema.Types.Mixed, // Flexible to store various types
    },
    otherText: { // Specifically for "Other - Write In" text
        type: String,
        trim: true,
    },
    collectorId: { // To track which collector was used for this response
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Collector',
        index: true,
        // Not strictly required for an answer to exist, but highly recommended for tracking
    },
    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    }
});

// Update timestamp on modification
answerSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Index for common queries
answerSchema.index({ surveyId: 1, sessionId: 1 });
answerSchema.index({ questionId: 1, answerValue: 1 }); // Example, adjust as needed

module.exports = mongoose.model('Answer', answerSchema);
// ----- END OF COMPLETE MODIFIED FILE -----