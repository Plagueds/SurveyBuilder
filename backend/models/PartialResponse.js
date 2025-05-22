// backend/models/PartialResponse.js
// ----- START OF COMPLETE UPDATED FILE (v1.1 - Added customVariables) -----
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
        match: [/\S+@\S+\.\S+/, 'Please enter a valid email address.'] 
    },
    answers: { // Stores the current answers at the time of saving
        type: Map,
        of: Schema.Types.Mixed, // Allows various answer formats
        default: () => new Map() // Ensure default is a new Map instance
    },
    otherInputValues: { // Stores text for "Other" options
        type: Map,
        of: String,
        default: () => new Map() // Ensure default is a new Map instance
    },
    currentVisibleIndex: { // Index of the question in visibleQuestionIndices where user left off
        type: Number,
        required: true,
        default: 0,
    },
    visitedPath: { // Array of original question IDs visited
        type: [String], 
        default: []
    },
    // +++ NEW: For storing captured custom variable values +++
    customVariables: { 
        type: Map,
        of: Schema.Types.Mixed, // Can be string, number, boolean depending on source
        default: () => new Map() // Ensure default is a new Map instance
    },
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
    },
    // +++ NEW: Field to link to the final Response document if completed +++
    finalResponse: { // Link to the final Response document if this partial session was completed
        type: Schema.Types.ObjectId,
        ref: 'Response',
        default: null
    }
}, {
    timestamps: true // Adds createdAt and updatedAt
});

// Optional TTL index for automatic cleanup (consider implications)
// partialResponseSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); 

module.exports = mongoose.model('PartialResponse', partialResponseSchema);
// ----- END OF COMPLETE UPDATED FILE (v1.1 - Added customVariables) -----