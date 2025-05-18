// backend/models/Survey.js
// ----- START OF COMPLETE UPDATED FILE (v1.7 - Added Behavior/Nav Settings) -----
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// --- Define Schemas for Global Skip Logic (copied from Question.js structure) ---
const conditionSchema = new mongoose.Schema({
    _id: false,
    sourceQuestionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: [true, 'Condition source question ID is required.'] },
    conditionOperator: {
        type: String,
        required: [true, 'Condition operator is required.'],
        enum: [
            'eq', 'ne', 'gt', 'gte', 'lt', 'lte',
            'contains', 'notContains',
            'isEmpty', 'isNotEmpty',
            'rowValueEquals', 'rowIsAnswered', 'rowIsNotAnswered',
            'itemAtRankIs', 'itemIsRanked',
            'clickCountEq', 'clickCountGt', 'clickCountLt', 'clickCountGte', 'clickCountLte',
            'clickInArea',
            'bestIs', 'worstIs', 'isNotBest', 'isNotWorst',
            'selectedProfileAttributeIs',
            'cardInCategory', 'categoryHasCards',
        ]
    },
    conditionValue: mongoose.Schema.Types.Mixed
});

const logicGroupSchema = new mongoose.Schema({
    _id: false,
    groupOperator: { type: String, enum: ['AND', 'OR'], required: [true, 'Group operator (AND/OR) is required.'], default: 'AND' },
    conditions: {
        type: [conditionSchema],
        required: true,
        validate: [val => Array.isArray(val) && val.length > 0, 'At least one condition is required per group.']
    }
});

const actionSchema = new mongoose.Schema({
    _id: false,
    type: {
        type: String,
        required: [true, 'Action type is required.'],
        enum: ['skipToQuestion', 'hideQuestion', 'jumpToEndOfSurvey', 'disqualifyRespondent']
    },
    targetQuestionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Question',
        required: [function() { return this.type === 'skipToQuestion' || this.type === 'hideQuestion'; }, 'Target question ID is required for skip/hide actions.']
    },
    disqualificationMessage: {
        type: String,
        trim: true,
        default: 'You do not qualify for this survey based on your responses.'
    }
});

const logicRuleSchema = new mongoose.Schema({
   ruleName: { type: String, trim: true, default: 'Unnamed Rule' },
   overallOperator: { type: String, enum: ['AND', 'OR'], required: [true, 'Overall rule operator (AND/OR) is required.'], default: 'AND' },
   groups: {
       type: [logicGroupSchema],
       required: true,
       validate: [val => Array.isArray(val) && val.length > 0, 'At least one logic group is required per rule.']
   },
   action: { type: actionSchema, required: [true, 'Action is required for the rule.'] }
});
// --- End Schemas for Global Skip Logic ---


const surveySchema = new Schema({
    title: {
        type: String,
        required: [true, 'Survey title is required.'],
        trim: true,
    },
    description: {
        type: String,
        trim: true,
        default: '',
    },
    status: {
        type: String,
        enum: ['draft', 'active', 'closed', 'archived'],
        default: 'draft',
    },
    questions: [{
        type: Schema.Types.ObjectId,
        ref: 'Question',
    }],
    collectors: [{
        type: Schema.Types.ObjectId,
        ref: 'Collector'
    }],
    randomizationLogic: {
        type: {
            type: String,
            enum: ['none', 'all', 'blocks'],
            default: 'none'
        },
        blocks: { // For 'blocks' type, this would be an array of arrays of question indices (relative to original survey.questions)
            type: [[{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }]], // Storing actual ObjectIds
            default: undefined // Only defined if type is 'blocks'
        }
    },
    globalSkipLogic: {
        type: [logicRuleSchema],
        default: []
    },
    // Survey-wide settings
    settings: {
        surveyWide: { // Existing namespace, let's keep it for clarity or rename if preferred
            allowRetakes: { type: Boolean, default: true }, // Example, might be collector specific mostly
            // customCSS: { type: String, default: '' }, // Example
            // showProgressBar: { type: Boolean, default: false }, // This was for collector, keep collector specific
        },
        completion: { // From your SurveySettingsPanel.js
            type: { type: String, default: 'thankYouPage' },
            thankYouMessage: { type: String, default: 'Thank you for completing the survey!' },
            showResponseSummary: { type: Boolean, default: false },
            showScore: { type: Boolean, default: false },
            redirectUrl: { type: String, default: '' },
            passResponseDataToRedirect: { type: Boolean, default: false },
            disqualificationType: { type: String, default: 'message' },
            disqualificationMessage: { type: String, default: 'Unfortunately, you do not qualify to continue with this survey.' },
            disqualificationRedirectUrl: { type: String, default: '' },
            surveyClosedMessage: { type: String, default: 'This survey is currently closed. Thank you for your interest.' },
        },
        accessSecurity: { // From your SurveySettingsPanel.js
            linkExpirationDate: { type: Date, default: null },
            maxResponses: { type: Number, default: 0 },
            passwordProtectionEnabled: { type: Boolean, default: false },
            surveyPassword: { type: String, default: '' },
        },
        // +++ NEW: Behavior and Navigation Settings +++
        behaviorNavigation: {
            autoAdvance: { type: Boolean, default: false },
            questionNumberingEnabled: { type: Boolean, default: true },
            questionNumberingFormat: {
                type: String,
                enum: ['123', 'ABC', 'roman', 'custom'], // '1. ', 'A. ', 'I. ', or custom prefix
                default: '123'
            },
            questionNumberingCustomPrefix: { type: String, default: '' }, // Used if format is 'custom'
            // Back button is collector-specific, progress bar settings are also collector-specific
        },
        // appearance: {}, // Placeholder from SurveySettingsPanel
    },
    welcomeMessage: { // Already exists
        text: { type: String, default: "Welcome to the survey!" },
        // Potentially add image, etc.
    },
    thankYouMessage: { // Already exists, but completion settings are more detailed
        text: { type: String, default: "Thank you for completing the survey!" },
        redirectUrl: { type: String, default: '' }, // This might be redundant with settings.completion.redirectUrl
        // Consider consolidating thankYouMessage fields into settings.completion
    },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Survey must be associated with a user.'],
        index: true,
    },
}, {
    timestamps: true,
});

// Indexes
surveySchema.index({ status: 1 });
surveySchema.index({ createdAt: -1 });

module.exports = mongoose.model('Survey', surveySchema);
// ----- END OF COMPLETE UPDATED FILE (v1.7 - Added Behavior/Nav Settings) -----