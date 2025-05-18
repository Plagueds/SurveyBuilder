// backend/models/PartialResponse.js
// ----- START OF COMPLETE NEW FILE -----
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const partialResponseSchema = new Schema({
    survey: {
        type: Schema.Types.ObjectId,
        ref: 'Survey',
        required: true,
        index: true,
    },
    collector: { // The specific collector link used
        type: Schema.Types.ObjectId,
        ref: 'Collector',
        required: true,
        index: true,
    },
    sessionId: { // Original session ID when started, can be used for analytics
        type: String,
        required: true,
    },
    resumeToken: { // Unique token for the resume link
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    respondentEmail: { // Email address if provided for the link method
        type: String,
        trim: true,
        lowercase: true,
        // Basic email validation, consider more robust if needed
        match: [/\S+@\S+\.\S+/, 'Please enter a valid email address.'] 
    },
    answers: { // Stores the current answers at the time of saving
        type: Map,
        of: Schema.Types.Mixed, // Allows various answer formats
        default: {}
    },
    otherInputValues: { // Stores text for "Other" options
        type: Map,
        of: String,
        default: {}
    },
    currentVisibleIndex: { // Index of the question in visibleQuestionIndices where user left off
        type: Number,
        required: true,
        default: 0,
    },
    visitedPath: { // Array of original question indices visited
        type: [String], // Storing original question IDs (or indices if preferred)
        default: []
    },
    // Potentially store hiddenQuestionIds if they can change during a session
    // hiddenQuestionIds: { type: [String], default: [] },
    
    expiresAt: { // When this partial response save link should expire
        type: Date,
        required: true,
    },
    resumedAt: { // Timestamp when the survey was last successfully resumed using this token
        type: Date,
        default: null
    },
    completedAt: { // Timestamp if the survey was eventually completed via this partial save
        type: Date,
        default: null
    }
}, {
    timestamps: true // Adds createdAt and updatedAt
});

// TTL index for automatic cleanup of expired partial responses (optional, but good for hygiene)
// partialResponseSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); 
// Note: MongoDB's TTL index might not be suitable if you need more complex cleanup logic or notifications.
// Manual cleanup via a cron job might be more flexible. For now, we'll rely on checking expiresAt in logic.

module.exports = mongoose.model('PartialResponse', partialResponseSchema);
// ----- END OF COMPLETE NEW FILE -----