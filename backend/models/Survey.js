// backend/models/Survey.js
// ----- START OF COMPLETE UPDATED FILE (v1.8 - Save & Continue, Custom Vars Settings) -----
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
        enum: ['skipToQuestion', 'hideQuestion', 'jumpToEndOfSurvey', 'disqualifyRespondent', 'markAsCompleted'] // Added markAsCompleted
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

// +++ NEW: Schema for Custom Variables +++
const customVariableSchema = new Schema({
    _id: false, // No separate _id for these subdocuments unless needed
    key: { 
        type: String, 
        required: [true, 'Custom variable key is required.'], 
        trim: true,
        match: [/^[a-zA-Z0-9_]+$/, 'Key can only contain alphanumeric characters and underscores.'] // Basic validation for URL-friendliness
    },
    label: { type: String, trim: true, default: '' }, // Optional descriptive label for UI
    // defaultValue: { type: String, trim: true, default: '' } // Future: allow default values
});


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
        blocks: { 
            type: [[{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }]], 
            default: undefined 
        }
    },
    globalSkipLogic: {
        type: [logicRuleSchema],
        default: []
    },
    settings: {
        surveyWide: { 
            allowRetakes: { type: Boolean, default: true },
        },
        completion: { 
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
        accessSecurity: { 
            linkExpirationDate: { type: Date, default: null },
            maxResponses: { type: Number, default: 0 },
            passwordProtectionEnabled: { type: Boolean, default: false },
            surveyPassword: { type: String, default: '' },
        },
        behaviorNavigation: {
            autoAdvance: { type: Boolean, default: false },
            questionNumberingEnabled: { type: Boolean, default: true },
            questionNumberingFormat: {
                type: String,
                enum: ['123', 'ABC', 'roman', 'custom'], 
                default: '123'
            },
            questionNumberingCustomPrefix: { type: String, default: '' },
            // +++ NEW: Save and Continue Settings +++
            saveAndContinueEnabled: { type: Boolean, default: false },
            saveAndContinueEmailLinkExpiryDays: { type: Number, default: 7, min: 1, max: 90 },
        },
        // +++ NEW: Custom Variables Setting +++
        customVariables: {
            type: [customVariableSchema],
            default: []
        },
        // appearance: {}, // Placeholder
    },
    welcomeMessage: { 
        text: { type: String, default: "Welcome to the survey!" },
    },
    thankYouMessage: { // Consider deprecating in favor of settings.completion fully
        text: { type: String, default: "Thank you for completing the survey!" },
        redirectUrl: { type: String, default: '' }, 
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

// Ensure custom variable keys are unique within a survey
surveySchema.path('settings.customVariables').validate(function(value) {
    if (!value || value.length === 0) return true;
    const keys = value.map(cv => cv.key);
    return new Set(keys).size === keys.length;
}, 'Custom variable keys must be unique within the survey.');


module.exports = mongoose.model('Survey', surveySchema);
// ----- END OF COMPLETE UPDATED FILE (v1.8 - Save & Continue, Custom Vars Settings) -----