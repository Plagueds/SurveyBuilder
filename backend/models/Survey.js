// backend/models/Survey.js
// ----- START OF COMPLETE UPDATED FILE (v1.6 - Added createdBy User Reference) -----
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
        blocks: {
            type: [[{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }]],
            default: undefined
        }
    },
    globalSkipLogic: {
        type: [logicRuleSchema],
        default: []
    },
    // +++ ADDED FIELD FOR USER REFERENCE +++
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'User', // This refers to the User model we created
        required: [true, 'Survey must be associated with a user.'], // Make it required
        index: true, // Add an index for querying surveys by user
    },
}, {
    timestamps: true,
});

// Indexes
surveySchema.index({ status: 1 });
surveySchema.index({ createdAt: -1 });
// surveySchema.index({ createdBy: 1 }); // This is already handled by 'index: true' above

module.exports = mongoose.model('Survey', surveySchema);
// ----- END OF COMPLETE UPDATED FILE (v1.6 - Added createdBy User Reference) -----