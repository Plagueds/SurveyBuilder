// backend/models/Response.js
// ----- START OF COMPLETE MODIFIED FILE (v1.2 - Added sessionId, refined fields) -----
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const responseSchema = new Schema({
    survey: { // Link to the Survey document
        type: Schema.Types.ObjectId,
        ref: 'Survey',
        required: [true, 'Survey ID is required for a response.'],
        index: true
    },
    collector: { // Link to the Collector document used for this response
        type: Schema.Types.ObjectId,
        ref: 'Collector',
        required: [true, 'Collector ID is required for a response.'],
        index: true
    },
    sessionId: { // Client-generated session identifier, links this Response doc to Answer docs
        type: String,
        required: [true, 'Session ID is required for a response.'],
        index: true
    },
    status: { // Status of the overall response session
        type: String,
        enum: ['partial', 'completed', 'disqualified', 'overquota', 'preview', 'test', 'error'],
        default: 'partial', // Default until explicitly marked completed or other status
        index: true,
    },
    startedAt: { // Timestamp for when the response session began (client might send this, or default to creation)
        type: Date,
        default: Date.now,
    },
    submittedAt: { // Timestamp for when the response was marked as completed/finalized
        type: Date,
        default: null,
        index: true
    },
    lastActivityAt: { // Timestamp for the last known activity (e.g., page save, final submission)
        type: Date,
        default: Date.now,
    },
    durationSeconds: { // Calculated duration from startedAt to submittedAt
        type: Number,
        default: null
    },
    ipAddress: { // Respondent's IP Address
        type: String,
        select: false // Not included in general queries by default for privacy
    },
    userAgent: { // Respondent's Browser User Agent
        type: String,
        select: false // Not included in general queries by default for privacy
    },
    customVariables: { // For storing any custom data passed via URL/collector
        type: Map,
        of: String,
        default: () => new Map()
    },
    // If you have user accounts and the respondent is logged in:
    // user: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    isTestResponse: { // Flag for test responses (e.g., from survey preview mode)
        type: Boolean,
        default: false
    },
    // You might add a field to store the actual answers summary or count here if needed,
    // but individual answers are in the Answer collection.
    // answerCount: { type: Number, default: 0 }
}, {
    timestamps: true // `createdAt` will be when the document is first created, `updatedAt` on subsequent saves
});

// Middleware to handle timestamps and duration
responseSchema.pre('save', function(next) {
    this.lastActivityAt = new Date();

    if (this.isModified('status') && this.status === 'completed' && !this.submittedAt) {
        this.submittedAt = new Date();
    }
    
    // Calculate duration if submittedAt is set and startedAt exists
    if (this.submittedAt && this.startedAt && (this.isModified('submittedAt') || this.isNew)) {
        this.durationSeconds = Math.round((this.submittedAt.getTime() - this.startedAt.getTime()) / 1000);
    }
    
    next();
});

// Index for common queries, e.g., finding all responses for a survey and collector by session
responseSchema.index({ survey: 1, collector: 1, sessionId: 1 }, { unique: true }); // Ensures one Response doc per session per collector
responseSchema.index({ survey: 1, status: 1 });

module.exports = mongoose.model('Response', responseSchema);
// ----- END OF COMPLETE MODIFIED FILE (v1.2 - Added sessionId, refined fields) -----