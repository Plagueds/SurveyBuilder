// backend/models/Question.js
// ----- START OF COMPLETE UPDATED FILE (v8.7 - Added definedHeatmapAreas) -----
const mongoose = require('mongoose');

// --- Sub-schemas ---
const definedHeatmapAreaSchema = new mongoose.Schema({
    _id: false, // Don't create a MongoDB _id for this subdocument by default
    id: { type: String, required: [true, 'Area ID is required.'] }, // Frontend generated UUID
    name: { type: String, required: [true, 'Area name is required.'], trim: true },
    x: { type: Number, required: true, min: 0, max: 1 },
    y: { type: Number, required: true, min: 0, max: 1 },
    width: { type: Number, required: true, min: 0, max: 1 },
    height: { type: Number, required: true, min: 0, max: 1 },
}, {
    // Ensure x + width <= 1 and y + height <= 1
    validateBeforeSave: true, // Ensure validators run
    validators: {
        coordinates: {
            validator: function(v) {
                // This validator context 'this' refers to the subdocument instance
                return (this.x + this.width <= 1.00001) && (this.y + this.height <= 1.00001); // Allow for tiny float inaccuracies
            },
            message: props => `Area coordinates are out of bounds: x (${props.x}) + width (${props.width}) or y (${props.y}) + height (${props.height}) exceeds 1.`
        }
    }
});


// --- Main Question Schema ---
const questionSchema = new mongoose.Schema({
    survey: { type: mongoose.Schema.Types.ObjectId, ref: 'Survey', required: true },
    text: { type: String, required: [true, 'Question text is required.'], trim: true },
    type: {
        type: String,
        required: [true, 'Question type is required.'],
        enum: [
            'text', 'textarea', 'multiple-choice', 'checkbox', 'dropdown',
            'rating', 'nps', 'matrix', 'slider', 'ranking', 'heatmap',
            'maxdiff', 'conjoint', 'cardsort',
        ],
        default: 'text'
    },

    // --- Type Specific Fields ---
    options: { type: [String], default: undefined },
    addOtherOption: { type: Boolean, default: false },
    requireOtherIfSelected: { type: Boolean, default: false },
    addNAOption: { type: Boolean, default: false },
    matrixRows: { type: [String], default: undefined },
    matrixColumns: { type: [String], default: undefined },
    matrixType: { type: String, enum: ['radio', 'checkbox'], default: 'radio' },
    sliderMin: { type: Number, default: 0 },
    sliderMax: { type: Number, default: 100 },
    sliderStep: { type: Number, default: 1 },
    sliderMinLabel: { type: String, default: '' },
    sliderMaxLabel: { type: String, default: '' },
    imageUrl: { type: String, trim: true, default: undefined },
    heatmapMaxClicks: { type: Number, min: 0, default: null },
    // +++ NEW FIELD FOR HEATMAP +++
    definedHeatmapAreas: {
        type: [definedHeatmapAreaSchema],
        default: undefined, // Only applicable for heatmap type
        validate: [
            {
                validator: function(areas) {
                    if (!Array.isArray(areas)) return true; // Allow undefined
                    const ids = areas.map(a => a.id);
                    const names = areas.map(a => a.name);
                    return new Set(ids).size === ids.length && new Set(names).size === names.length;
                },
                message: 'Defined heatmap areas must have unique IDs and unique names.'
            }
        ]
    },
    maxDiffItemsPerSet: { type: Number, default: 4 },
    conjointAttributes: { type: [{ _id: false, name: { type: String, required: true }, levels: { type: [String], required: true, validate: [val => Array.isArray(val) && val.length >= 2, 'Attribute must have at least two levels'] } }], default: undefined },
    conjointProfilesPerTask: { type: Number, default: 3 },
    cardSortCategories: { type: [String], default: undefined },
    cardSortAllowUserCategories: { type: Boolean, default: true },
    rows: { type: Number, min: 1, default: 4 },

    hideByDefault: { type: Boolean, default: false },
    showOnlyToAdmin: { type: Boolean, default: false },
    isDisabled: { type: Boolean, default: false },
    randomizationAlwaysInclude: { type: Boolean, default: false },
    randomizationPinPosition: { type: Boolean, default: false },
    hideAfterAnswering: { type: Boolean, default: false },
    randomizeOptions: { type: Boolean, default: false },
    pipeOptionsFromQuestionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', default: null },
    repeatForEachOptionFromQuestionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', default: null },
    requiredSetting: { type: String, enum: ['not_required', 'required', 'soft_required', 'conditional'], default: 'not_required' },
    conditionalRequireLogic: { type: [mongoose.Schema.Types.Mixed], default: [] },
    answerFormatCapitalization: { type: Boolean, default: false },
    limitAnswers: { type: Boolean, default: false },
    limitAnswersMax: { type: Number, min: 1, default: null },
    minAnswersRequired: { type: Number, min: 1, default: null },
    textValidation: { type: String, enum: ['none', 'email', 'numeric'], default: 'none' },

}, { timestamps: true });

// Indexes
questionSchema.index({ survey: 1 });
questionSchema.index({ type: 1 });

// Pre-save hook
questionSchema.pre('save', function(next) {
    const doc = this;
    let error = null;
    let errorPath = 'typeSpecific';

    // Type Specific Validation
    switch (doc.type) {
        case 'checkbox': case 'cardsort': errorPath = 'options'; if (!doc.options || doc.options.filter(opt => opt?.trim() !== '').length < 1) { error = new Error(`At least 1 non-empty option/card is required for type '${doc.type}'.`); } break;
        case 'multiple-choice': case 'dropdown': case 'ranking': case 'maxdiff': errorPath = 'options'; if (!doc.options || doc.options.filter(opt => opt?.trim() !== '').length < 2) { error = new Error(`At least 2 non-empty options are required for type '${doc.type}'.`); } break;
        case 'matrix': if (!doc.matrixRows || doc.matrixRows.filter(r => r?.trim() !== '').length < 1) { errorPath = 'matrixRows'; error = new Error('At least one non-empty matrix row is required.'); } else if (!doc.matrixColumns || doc.matrixColumns.filter(c => c?.trim() !== '').length < 1) { errorPath = 'matrixColumns'; error = new Error('At least one non-empty matrix column is required.'); } else if (!doc.matrixType) { errorPath = 'matrixType'; error = new Error('Matrix type is required.'); } break;
        case 'slider': errorPath = 'slider'; if (doc.sliderMin == null || doc.sliderMax == null || doc.sliderStep == null) error = new Error('Slider min, max, and step are required.'); else if (doc.sliderMin >= doc.sliderMax) error = new Error('Slider min must be less than max.'); else if (doc.sliderStep <= 0) error = new Error('Slider step must be positive.'); break;
        case 'heatmap':
            errorPath = 'imageUrl'; if (!doc.imageUrl?.trim()) { error = new Error('Image URL is required for heatmap.'); } else { try { new URL(doc.imageUrl); } catch (_) { error = new Error('Invalid Image URL format.'); } }
            if (!error && doc.heatmapMaxClicks != null && (!Number.isInteger(doc.heatmapMaxClicks) || doc.heatmapMaxClicks < 0)) { errorPath = 'heatmapMaxClicks'; error = new Error('Maximum clicks must be a non-negative whole number.'); }
            // Validate definedHeatmapAreas (basic check, sub-schema validators handle details)
            if (!error && doc.definedHeatmapAreas && !Array.isArray(doc.definedHeatmapAreas)) {
                 errorPath = 'definedHeatmapAreas'; error = new Error('Defined heatmap areas must be an array.');
            }
            // More detailed validation for uniqueness of IDs and names is in the sub-schema validator.
            // Mongoose should run sub-document validators automatically.
            break;
        case 'conjoint': if (!doc.conjointAttributes || doc.conjointAttributes.length < 1) { errorPath = 'conjointAttributes'; error = new Error('At least one Conjoint attribute is required.'); } else if (doc.conjointProfilesPerTask == null || doc.conjointProfilesPerTask < 2) { errorPath = 'conjointProfilesPerTask'; error = new Error('Conjoint profiles per task must be at least 2.'); } else { for(let i = 0; i < doc.conjointAttributes.length; i++) { const attr = doc.conjointAttributes[i]; if (!attr.name?.trim() || !Array.isArray(attr.levels) || attr.levels.filter(l => l?.trim() !== '').length < 2) { errorPath = 'conjointAttributes'; error = new Error(`Attribute ${i+1} ('${attr.name || 'Unnamed'}') must have a name and at least 2 non-empty levels.`); break; } } } break;
        case 'text': case 'textarea': if (doc.type === 'textarea' && doc.rows != null && (!Number.isInteger(doc.rows) || doc.rows < 1)) { errorPath = 'rows'; error = new Error('Number of rows for textarea must be a positive whole number.'); } break;
    }

    // Cleanup properties not relevant to the current type
    if (!['multiple-choice', 'checkbox', 'dropdown', 'ranking', 'maxdiff', 'cardsort'].includes(doc.type)) { doc.options = undefined; doc.addOtherOption = false; doc.requireOtherIfSelected = false; doc.addNAOption = false; doc.randomizeOptions = false; }
    if (doc.type !== 'checkbox') { doc.limitAnswers = false; doc.limitAnswersMax = null; doc.minAnswersRequired = null; }
    if (doc.type !== 'matrix') { doc.matrixRows = undefined; doc.matrixColumns = undefined; doc.matrixType = 'radio'; }
    if (doc.type !== 'slider') { doc.sliderMin = 0; doc.sliderMax = 100; doc.sliderStep = 1; doc.sliderMinLabel = ''; doc.sliderMaxLabel = ''; }
    if (doc.type !== 'heatmap') { doc.imageUrl = undefined; doc.heatmapMaxClicks = null; doc.definedHeatmapAreas = undefined; /* +++ CLEAR IF NOT HEATMAP +++ */ }
    if (doc.type !== 'maxdiff') { doc.maxDiffItemsPerSet = 4; }
    if (doc.type !== 'conjoint') { doc.conjointAttributes = undefined; doc.conjointProfilesPerTask = 3; }
    if (doc.type !== 'cardsort') { doc.cardSortCategories = undefined; doc.cardSortAllowUserCategories = true; }
    if (!['text', 'textarea'].includes(doc.type)) { doc.textValidation = 'none'; }
    if (doc.type !== 'textarea') { doc.rows = 4; }

    if (doc.requireOtherIfSelected && !doc.addOtherOption) { doc.requireOtherIfSelected = false; }
    if (!error && doc.pipeOptionsFromQuestionId && doc._id && doc.pipeOptionsFromQuestionId.toString() === doc._id.toString()) { errorPath = 'pipeOptionsFromQuestionId'; error = new Error('Cannot pipe options from the same question.'); }
    if (!error && doc.repeatForEachOptionFromQuestionId && doc._id && doc.repeatForEachOptionFromQuestionId.toString() === doc._id.toString()) { errorPath = 'repeatForEachOptionFromQuestionId'; error = new Error('Cannot repeat question based on its own options.'); }

    if (error) {
        const validationError = new mongoose.Error.ValidationError(null);
        validationError.errors[errorPath] = new mongoose.Error.ValidatorError({ message: error.message, path: errorPath });
        next(validationError);
    } else {
        next();
    }
});

const Question = mongoose.model('Question', questionSchema);
module.exports = Question;
// ----- END OF COMPLETE UPDATED FILE (v8.7) -----