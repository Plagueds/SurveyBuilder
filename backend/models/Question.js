// backend/models/Question.js
// ----- START OF COMPLETE UPDATED FILE (v8.8 - Added Conjoint CBC Fields) -----
const mongoose = require('mongoose');

// --- Sub-schemas ---
const definedHeatmapAreaSchema = new mongoose.Schema({
    _id: false,
    id: { type: String, required: [true, 'Area ID is required.'] },
    name: { type: String, required: [true, 'Area name is required.'], trim: true },
    x: { type: Number, required: true, min: 0, max: 1 },
    y: { type: Number, required: true, min: 0, max: 1 },
    width: { type: Number, required: true, min: 0, max: 1 },
    height: { type: Number, required: true, min: 0, max: 1 },
}, {
    validateBeforeSave: true,
    // Removed the 'validators' field here as Mongoose doesn't support it directly in this way.
    // Custom validation for coordinates sum should be done in a pre-save hook or a custom validator on the fields themselves if needed.
    // For simplicity, we'll rely on frontend validation for this specific sum check for now,
    // or you can add a custom validator to the schema path if strict server-side enforcement is critical.
});

// Custom validator for coordinate sums (example if you want to add it at schema level)
// definedHeatmapAreaSchema.path('x').validate(function(value) {
//   // `this` is the document being validated.
//   return (value + this.width <= 1.00001);
// }, 'Area x + width exceeds 1.');
// definedHeatmapAreaSchema.path('y').validate(function(value) {
//   return (value + this.height <= 1.00001);
// }, 'Area y + height exceeds 1.');


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
    definedHeatmapAreas: {
        type: [definedHeatmapAreaSchema],
        default: undefined,
        validate: [
            {
                validator: function(areas) {
                    if (!Array.isArray(areas)) return true;
                    const ids = areas.map(a => a.id);
                    const names = areas.map(a => a.name);
                    return new Set(ids).size === ids.length && new Set(names).size === names.length;
                },
                message: 'Defined heatmap areas must have unique IDs and unique names.'
            }
        ]
    },
    maxDiffItemsPerSet: { type: Number, default: 4 },
    conjointAttributes: {
        type: [{
            _id: false,
            name: { type: String, required: true },
            levels: {
                type: [String],
                required: true,
                validate: [val => Array.isArray(val) && val.length >= 2, 'Attribute must have at least two levels']
            }
        }],
        default: undefined
    },
    conjointProfilesPerTask: { type: Number, default: 3, min: 2 }, // Min 2 profiles
    // +++ NEW FIELDS FOR CONJOINT CBC +++
    conjointNumTasks: { type: Number, default: 5, min: 1 },         // Number of tasks to generate
    conjointIncludeNoneOption: { type: Boolean, default: true },  // Whether to include a "None of these" option
    // +++ END NEW FIELDS FOR CONJOINT CBC +++
    cardSortCategories: { type: [String], default: undefined },
    cardSortAllowUserCategories: { type: Boolean, default: true },
    rows: { type: Number, min: 1, default: 4 }, // For textarea

    // --- General Logic & Validation Fields ---
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
    conditionalRequireLogic: { type: [mongoose.Schema.Types.Mixed], default: [] }, // Placeholder for more complex logic structure
    answerFormatCapitalization: { type: Boolean, default: false },
    limitAnswers: { type: Boolean, default: false }, // For checkbox: enforce max limit
    limitAnswersMax: { type: Number, min: 1, default: null }, // For checkbox: max number of selections
    minAnswersRequired: { type: Number, min: 0, default: null }, // For checkbox: min number of selections (0 means no min)
    textValidation: { type: String, enum: ['none', 'email', 'numeric'], default: 'none' },

}, { timestamps: true });

// Indexes
questionSchema.index({ survey: 1 });
questionSchema.index({ type: 1 });

// Pre-save hook for validation and cleanup
questionSchema.pre('save', function(next) {
    const doc = this;
    let error = null;
    let errorPath = 'typeSpecific'; // Default error path

    // Type Specific Validation Logic
    switch (doc.type) {
        case 'checkbox':
            errorPath = 'options';
            if (!doc.options || doc.options.filter(opt => opt?.trim() !== '').length < 1) {
                error = new Error(`At least 1 non-empty option is required for type '${doc.type}'.`);
            }
            if (!error && doc.limitAnswers === true) { // Only validate max/min if limitAnswers is true
                errorPath = 'limitAnswersMax';
                if (doc.limitAnswersMax == null || doc.limitAnswersMax < 1) {
                    error = new Error('Max answers limit must be at least 1 when enforced.');
                } else if (doc.minAnswersRequired != null && doc.minAnswersRequired > doc.limitAnswersMax) {
                    errorPath = 'minAnswersRequired';
                    error = new Error('Min answers required cannot exceed max answers limit.');
                } else if (doc.options && doc.limitAnswersMax > doc.options.filter(opt => opt?.trim() !== '').length) {
                     errorPath = 'limitAnswersMax';
                     error = new Error('Max answers limit cannot exceed the number of available options.');
                }
            }
            if (!error && doc.minAnswersRequired != null) {
                if (doc.minAnswersRequired < 0) { // Changed from 1 to 0 to allow no minimum
                     errorPath = 'minAnswersRequired';
                     error = new Error('Min answers required cannot be negative.');
                } else if (doc.options && doc.minAnswersRequired > doc.options.filter(opt => opt?.trim() !== '').length) {
                     errorPath = 'minAnswersRequired';
                     error = new Error('Min answers required cannot exceed the number of available options.');
                }
            }
            break;
        case 'cardsort':
            errorPath = 'options';
            if (!doc.options || doc.options.filter(opt => opt?.trim() !== '').length < 1) {
                error = new Error(`At least 1 non-empty card is required for type '${doc.type}'.`);
            }
            break;
        case 'multiple-choice': case 'dropdown': case 'ranking': case 'maxdiff':
            errorPath = 'options';
            if (!doc.options || doc.options.filter(opt => opt?.trim() !== '').length < 2) {
                error = new Error(`At least 2 non-empty options are required for type '${doc.type}'.`);
            }
            if (!error && doc.type === 'maxdiff' && doc.maxDiffItemsPerSet != null) {
                if (doc.options.filter(opt => opt?.trim() !== '').length < doc.maxDiffItemsPerSet) {
                    errorPath = 'maxDiffItemsPerSet';
                    error = new Error('Number of options must be greater than or equal to Items Per Set for MaxDiff.');
                }
            }
            break;
        case 'matrix':
            if (!doc.matrixRows || doc.matrixRows.filter(r => r?.trim() !== '').length < 1) { errorPath = 'matrixRows'; error = new Error('At least one non-empty matrix row is required.'); }
            else if (!doc.matrixColumns || doc.matrixColumns.filter(c => c?.trim() !== '').length < 1) { errorPath = 'matrixColumns'; error = new Error('At least one non-empty matrix column is required.'); }
            else if (!doc.matrixType) { errorPath = 'matrixType'; error = new Error('Matrix type is required.'); }
            break;
        case 'slider':
            errorPath = 'slider';
            if (doc.sliderMin == null || doc.sliderMax == null || doc.sliderStep == null) error = new Error('Slider min, max, and step are required.');
            else if (doc.sliderMin >= doc.sliderMax) error = new Error('Slider min must be less than max.');
            else if (doc.sliderStep <= 0) error = new Error('Slider step must be positive.');
            break;
        case 'heatmap':
            errorPath = 'imageUrl'; if (!doc.imageUrl?.trim()) { error = new Error('Image URL is required for heatmap.'); }
            else { try { new URL(doc.imageUrl); } catch (_) { error = new Error('Invalid Image URL format.'); } }
            if (!error && doc.heatmapMaxClicks != null && (!Number.isInteger(doc.heatmapMaxClicks) || doc.heatmapMaxClicks < 0)) { errorPath = 'heatmapMaxClicks'; error = new Error('Maximum clicks must be a non-negative whole number.'); }
            if (!error && doc.definedHeatmapAreas) {
                if (!Array.isArray(doc.definedHeatmapAreas)) { errorPath = 'definedHeatmapAreas'; error = new Error('Defined heatmap areas must be an array.'); }
                else {
                    for (const area of doc.definedHeatmapAreas) {
                        if ((area.x + area.width > 1.00001) || (area.y + area.height > 1.00001)) {
                            errorPath = 'definedHeatmapAreas';
                            error = new Error(`Area "${area.name}" coordinates are out of bounds.`);
                            break;
                        }
                    }
                }
            }
            break;
        case 'conjoint':
            errorPath = 'conjointAttributes';
            if (!doc.conjointAttributes || doc.conjointAttributes.length < 1) { error = new Error('At least one Conjoint attribute is required.'); }
            else {
                for (let i = 0; i < doc.conjointAttributes.length; i++) {
                    const attr = doc.conjointAttributes[i];
                    if (!attr.name?.trim() || !Array.isArray(attr.levels) || attr.levels.filter(l => l?.trim() !== '').length < 2) {
                        error = new Error(`Attribute ${i + 1} ('${attr.name || 'Unnamed'}') must have a name and at least 2 non-empty levels.`);
                        break;
                    }
                }
            }
            if (!error && (doc.conjointProfilesPerTask == null || doc.conjointProfilesPerTask < 2)) { errorPath = 'conjointProfilesPerTask'; error = new Error('Conjoint profiles per task must be at least 2.'); }
            // +++ VALIDATION FOR NEW CONJOINT FIELDS +++
            if (!error && (doc.conjointNumTasks == null || doc.conjointNumTasks < 1)) { errorPath = 'conjointNumTasks'; error = new Error('Conjoint number of tasks must be at least 1.'); }
            break;
        case 'text': case 'textarea':
            if (doc.type === 'textarea' && doc.rows != null && (!Number.isInteger(doc.rows) || doc.rows < 1)) { errorPath = 'rows'; error = new Error('Number of rows for textarea must be a positive whole number.'); }
            break;
    }

    // Cleanup properties not relevant to the current type
    const isOptionBased = ['multiple-choice', 'checkbox', 'dropdown', 'ranking', 'maxdiff', 'cardsort'].includes(doc.type);
    if (!isOptionBased) {
        doc.options = undefined;
        doc.addOtherOption = false;
        doc.requireOtherIfSelected = false;
        doc.addNAOption = false;
        doc.randomizeOptions = false;
    }
    if (doc.type !== 'checkbox') {
        doc.limitAnswers = false;
        doc.limitAnswersMax = null;
        doc.minAnswersRequired = null;
    } else { // For checkbox, ensure minAnswersRequired is null if 0, or a number
        doc.minAnswersRequired = doc.minAnswersRequired === '' || doc.minAnswersRequired === null || isNaN(parseInt(doc.minAnswersRequired)) ? null : parseInt(doc.minAnswersRequired);
        if (doc.minAnswersRequired !== null && doc.minAnswersRequired < 0) doc.minAnswersRequired = 0;

        doc.limitAnswersMax = doc.limitAnswersMax === '' || doc.limitAnswersMax === null || isNaN(parseInt(doc.limitAnswersMax)) ? null : parseInt(doc.limitAnswersMax);
        if (doc.limitAnswersMax !== null && doc.limitAnswersMax < 1) doc.limitAnswersMax = null;

        if (doc.limitAnswersMax === null) doc.limitAnswers = false; // If no max value, cannot enforce
    }

    if (doc.type !== 'matrix') { doc.matrixRows = undefined; doc.matrixColumns = undefined; doc.matrixType = 'radio'; }
    if (doc.type !== 'slider') { doc.sliderMin = 0; doc.sliderMax = 100; doc.sliderStep = 1; doc.sliderMinLabel = ''; doc.sliderMaxLabel = ''; }
    if (doc.type !== 'heatmap') { doc.imageUrl = undefined; doc.heatmapMaxClicks = null; doc.definedHeatmapAreas = undefined; }
    if (doc.type !== 'maxdiff') { doc.maxDiffItemsPerSet = 4; }
    if (doc.type !== 'conjoint') {
        doc.conjointAttributes = undefined;
        doc.conjointProfilesPerTask = 3;
        // +++ CLEAR NEW CONJOINT FIELDS IF NOT CONJOINT +++
        doc.conjointNumTasks = 5;
        doc.conjointIncludeNoneOption = true;
    }
    if (doc.type !== 'cardsort') { doc.cardSortCategories = undefined; doc.cardSortAllowUserCategories = true; }
    if (!['text', 'textarea'].includes(doc.type)) { doc.textValidation = 'none'; }
    if (doc.type !== 'textarea') { doc.rows = 4; } // Default for non-textarea

    if (doc.requireOtherIfSelected && !doc.addOtherOption) { doc.requireOtherIfSelected = false; }

    // Piping validation
    if (!error && doc.pipeOptionsFromQuestionId && doc._id && doc.pipeOptionsFromQuestionId.toString() === doc._id.toString()) { errorPath = 'pipeOptionsFromQuestionId'; error = new Error('Cannot pipe options from the same question.'); }
    if (!error && doc.repeatForEachOptionFromQuestionId && doc._id && doc.repeatForEachOptionFromQuestionId.toString() === doc._id.toString()) { errorPath = 'repeatForEachOptionFromQuestionId'; error = new Error('Cannot repeat question based on its own options.'); }

    if (error) {
        const validationError = new mongoose.Error.ValidationError(null);
        validationError.errors[errorPath] = new mongoose.Error.ValidatorError({ message: error.message, path: errorPath, value: doc[errorPath], type: 'QuestionLogic' });
        next(validationError);
    } else {
        next();
    }
});

const Question = mongoose.model('Question', questionSchema);
module.exports = Question;
// ----- END OF COMPLETE UPDATED FILE (v8.8) -----