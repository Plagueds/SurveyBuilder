// backend/models/Answer.js
// ----- START OF COMPLETE UPDATED FILE (v1.2 - Added collectorId) -----
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const answerSchema = new Schema({
    // --- Fields matching the frontend payload ---
    surveyId: {
        type: Schema.Types.ObjectId,
        ref: 'Survey',
        required: [true, 'Survey ID is required.'],
        index: true
    },
    questionId: {
        type: Schema.Types.ObjectId,
        ref: 'Question',
        required: [true, 'Question ID is required.'],
        index: true
    },
    sessionId: {
        type: String,
        required: [true, 'Session ID is required.'],
        index: true
    },
    answerValue: {
        type: Schema.Types.Mixed,
        required: [true, 'Answer value is required.']
    },
    // +++ ADDED FIELD FOR COLLECTOR REFERENCE +++
    collectorId: {
        type: Schema.Types.ObjectId,
        ref: 'Collector', // Link to the Collector model
        required: [true, 'Collector ID is required for an answer.'], // Make it required
        index: true
    },

}, {
    timestamps: true // Use Mongoose's built-in createdAt and updatedAt fields
});

// Compound indexes
answerSchema.index({ surveyId: 1, sessionId: 1, createdAt: 1 });
answerSchema.index({ surveyId: 1, questionId: 1 });
answerSchema.index({ collectorId: 1, createdAt: 1 }); // <<<--- ADDED: Index for queries by collector

module.exports = mongoose.model('Answer', answerSchema);
// ----- END OF COMPLETE UPDATED FILE (v1.2 - Added collectorId) -----