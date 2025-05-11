// backend/models/Response.js
// ----- START OF COMPLETE UPDATED FILE (v1.1 - Added Collector Reference) -----
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const responseSchema = new Schema({
    survey: {
        type: Schema.Types.ObjectId,
        ref: 'Survey',
        required: [true, 'Survey ID is required for a response.'],
        index: true
    },
    // +++ NEW FIELD FOR COLLECTOR REFERENCE +++
    collector: {
        type: Schema.Types.ObjectId,
        ref: 'Collector',
        required: [true, 'Collector ID is required for a response.'],
        index: true
    },
    status: { // Status of the individual response
        type: String,
        enum: ['partial', 'completed', 'disqualified', 'overquota', 'preview', 'test'],
        default: 'partial',
        index: true,
    },
    submittedAt: { // Timestamp for when the response was marked as completed
        type: Date,
        default: null, // Will be set upon completion
        index: true
    },
    startedAt: { // Timestamp for when the response session began
        type: Date,
        default: Date.now,
    },
    lastActivityAt: { // Timestamp for the last known activity (e.g., page save)
        type: Date,
        default: Date.now,
    },
    ipAddress: { type: String, select: false }, // Select false for privacy by default
    userAgent: { type: String, select: false }, // Select false for privacy by default
    durationSeconds: { type: Number }, // How long it took to complete
    customVariables: { type: Map, of: String }, // For storing any custom data passed via URL/collector
    // If you have user accounts and the respondent is logged in:
    // user: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    isTestResponse: { type: Boolean, default: false }, // Flag for test responses
}, {
    timestamps: true // createdAt will be similar to startedAt, updatedAt for last activity
});

// When a response is saved, update lastActivityAt
responseSchema.pre('save', function(next) {
    this.lastActivityAt = new Date();
    if (this.status === 'completed' && !this.submittedAt) {
        this.submittedAt = new Date();
        if (this.startedAt) {
            this.durationSeconds = Math.round((this.submittedAt.getTime() - this.startedAt.getTime()) / 1000);
        }
    }
    next();
});

module.exports = mongoose.model('Response', responseSchema);
// ----- END OF COMPLETE UPDATED FILE (v1.1) -----