// backend/controllers/questionController.js
// ----- START OF COMPLETE MODIFIED FILE (v9.6 - Fix Conjoint Update & Standardize) -----
const mongoose = require('mongoose');
const Question = require('../models/Question');
const Answer = require('../models/Answer');
const Survey = require('../models/Survey');

// --- Define option-based types where uniqueness matters on the backend ---
const OPTION_BASED_TYPES = ['multiple-choice', 'checkbox', 'dropdown', 'ranking', 'maxdiff', 'cardsort'];

// --- Helper function to check for duplicate options ---
const hasDuplicateOptions = (options) => {
    if (!Array.isArray(options) || options.length === 0) {
        return false;
    }
    const validOptions = options.filter(opt => typeof opt === 'string' && opt.trim() !== '');
    if (validOptions.length <= 1) { return false; }
    const uniqueOptions = new Set(validOptions);
    return uniqueOptions.size !== validOptions.length;
};

// --- Controller Functions ---

exports.getAllQuestions = async (req, res) => {
    // console.log("getAllQuestions: Fetching all questions.");
    try {
        const questionsWithCounts = await Question.aggregate([
            { $sort: { createdAt: -1 } },
            { $lookup: { from: 'answers', localField: '_id', foreignField: 'questionId', as: 'relatedAnswers' } },
            { $addFields: { answerCount: { $size: '$relatedAnswers' } } },
            { $project: { relatedAnswers: 0 } }
        ]);
        // console.log(`getAllQuestions: Found ${questionsWithCounts.length} questions.`);
        res.status(200).json({ success: true, count: questionsWithCounts.length, data: questionsWithCounts });
    } catch (error) {
        console.error("Error fetching all questions:", error);
        res.status(500).json({ success: false, message: "Error fetching questions" });
    }
};

exports.createQuestion = async (req, res) => {
    // console.log("--- Backend Controller: createQuestion: Received request body ---");
    // console.log(JSON.stringify(req.body, null, 2)); 
    // console.log("---------------------------------------------------------------");

    const {
        text, type, survey, addOtherOption, requireOtherIfSelected,
        addNAOption, options, matrixRows, matrixColumns, matrixType, sliderMin,
        sliderMax, sliderStep, sliderMinLabel, sliderMaxLabel, imageUrl,
        heatmapMaxClicks, conjointNumTasks, // Added conjointNumTasks here
        maxDiffItemsPerSet, conjointAttributes, conjointProfilesPerTask, conjointIncludeNoneOption, // Added conjointIncludeNoneOption
        cardSortCategories, cardSortAllowUserCategories,
        skipLogic, enableDisplayLogic, hideByDefault, showOnlyToAdmin, isDisabled,
        randomizationAlwaysInclude, randomizationPinPosition, hideAfterAnswering,
        randomizeOptions,
        pipeOptionsFromQuestionId, repeatForEachOptionFromQuestionId, requiredSetting,
        answerFormatCapitalization, limitAnswers, limitAnswersMax, minAnswersRequired,
        textValidation, rows
    } = req.body;

    try {
        const validSurveyId = survey === "" ? null : survey;
        if (!text || typeof text !== 'string' || !text.trim()) {
            return res.status(400).json({ success: false, message: 'Question text is required.', field: 'text' });
        }
        if (!type || typeof type !== 'string') {
            return res.status(400).json({ success: false, message: 'Question type is required.', field: 'type' });
        }
        if (validSurveyId && !mongoose.Types.ObjectId.isValid(validSurveyId)) {
            return res.status(400).json({ success: false, message: 'Invalid Survey ID format provided.', field: 'survey' });
        }

        let cleanedOptions = options;
        if (OPTION_BASED_TYPES.includes(type) && options !== undefined) {
            if (hasDuplicateOptions(options)) {
                return res.status(400).json({ success: false, message: 'Validation Error: Options must be unique.', field: 'options' });
            }
            cleanedOptions = Array.isArray(options) ? options.map(opt => String(opt || '').trim()).filter(opt => opt) : [];
        }

        const questionData = {
            text, type, survey: validSurveyId,
            ...(addOtherOption !== undefined && { addOtherOption: !!addOtherOption }),
            ...(requireOtherIfSelected !== undefined && { requireOtherIfSelected: !!requireOtherIfSelected }),
            ...(addNAOption !== undefined && { addNAOption: !!addNAOption }),
            ...(skipLogic !== undefined && { skipLogic }),
            ...(enableDisplayLogic !== undefined && { enableDisplayLogic: !!enableDisplayLogic }),
            ...(hideByDefault !== undefined && { hideByDefault: !!hideByDefault }),
            ...(showOnlyToAdmin !== undefined && { showOnlyToAdmin: !!showOnlyToAdmin }),
            ...(isDisabled !== undefined && { isDisabled: !!isDisabled }),
            ...(randomizationAlwaysInclude !== undefined && { randomizationAlwaysInclude: !!randomizationAlwaysInclude }),
            ...(randomizationPinPosition !== undefined && { randomizationPinPosition: !!randomizationPinPosition }),
            ...(hideAfterAnswering !== undefined && { hideAfterAnswering: !!hideAfterAnswering }),
            ...(randomizeOptions !== undefined && { randomizeOptions: !!randomizeOptions }),
            ...(pipeOptionsFromQuestionId !== undefined && { pipeOptionsFromQuestionId: pipeOptionsFromQuestionId || null }),
            ...(repeatForEachOptionFromQuestionId !== undefined && { repeatForEachOptionFromQuestionId: repeatForEachOptionFromQuestionId || null }),
            ...(requiredSetting !== undefined && { requiredSetting }),
            ...(answerFormatCapitalization !== undefined && { answerFormatCapitalization: !!answerFormatCapitalization }),
            ...(limitAnswers !== undefined && { limitAnswers: !!limitAnswers }),
            ...(limitAnswersMax !== undefined && limitAnswersMax !== '' && !isNaN(Number(limitAnswersMax)) && { limitAnswersMax: Number(limitAnswersMax) }),
            ...(minAnswersRequired !== undefined && minAnswersRequired !== '' && !isNaN(Number(minAnswersRequired)) && { minAnswersRequired: Number(minAnswersRequired) }),
            ...(textValidation !== undefined && { textValidation }),
            ...(rows !== undefined && !isNaN(Number(rows)) && { rows: Number(rows) }),
        };

        const SPECIAL_OPTION_TYPES = ['multiple-choice', 'checkbox'];
        if (!SPECIAL_OPTION_TYPES.includes(type)) {
             delete questionData.addOtherOption; delete questionData.requireOtherIfSelected; delete questionData.addNAOption;
        } else { if (!questionData.addOtherOption) questionData.requireOtherIfSelected = false; }
        if (!['text', 'textarea'].includes(type)) delete questionData.answerFormatCapitalization;
        if (!['checkbox'].includes(type)) { delete questionData.limitAnswers; delete questionData.limitAnswersMax; delete questionData.minAnswersRequired; }
        if (!['multiple-choice', 'checkbox'].includes(type)) delete questionData.randomizeOptions;
        if (!['text', 'textarea'].includes(type)) delete questionData.textValidation;
        if (type !== 'textarea') delete questionData.rows;

        switch (type) {
             case 'multiple-choice': case 'checkbox': case 'dropdown': case 'ranking': case 'maxdiff': case 'cardsort':
                 questionData.options = cleanedOptions;
                 if (type === 'maxdiff' && maxDiffItemsPerSet !== undefined) questionData.maxDiffItemsPerSet = Number(maxDiffItemsPerSet);
                 if (type === 'cardsort') {
                     if (cardSortCategories !== undefined) questionData.cardSortCategories = cardSortCategories;
                     if (cardSortAllowUserCategories !== undefined) questionData.cardSortAllowUserCategories = !!cardSortAllowUserCategories;
                 }
                 break;
             case 'matrix':
                 if (matrixRows !== undefined) questionData.matrixRows = matrixRows;
                 if (matrixColumns !== undefined) questionData.matrixColumns = matrixColumns;
                 if (matrixType !== undefined) questionData.matrixType = matrixType;
                 break;
             case 'slider':
                 if (sliderMin !== undefined) questionData.sliderMin = Number(sliderMin);
                 if (sliderMax !== undefined) questionData.sliderMax = Number(sliderMax);
                 if (sliderStep !== undefined) questionData.sliderStep = Number(sliderStep);
                 if (sliderMinLabel !== undefined) questionData.sliderMinLabel = sliderMinLabel;
                 if (sliderMaxLabel !== undefined) questionData.sliderMaxLabel = sliderMaxLabel;
                 break;
             case 'heatmap':
                 if (imageUrl !== undefined) questionData.imageUrl = imageUrl;
                 if (heatmapMaxClicks !== undefined && heatmapMaxClicks !== null && heatmapMaxClicks !== '') {
                     const maxClicksNum = Number(heatmapMaxClicks);
                     if (!isNaN(maxClicksNum) && maxClicksNum >= 0) questionData.heatmapMaxClicks = maxClicksNum;
                 } else { questionData.heatmapMaxClicks = null; }
                 break;
             case 'conjoint':
                 if (conjointAttributes !== undefined) questionData.conjointAttributes = conjointAttributes;
                 if (conjointProfilesPerTask !== undefined) questionData.conjointProfilesPerTask = Number(conjointProfilesPerTask);
                 // *** ADDED conjointNumTasks and conjointIncludeNoneOption for CREATE ***
                 if (conjointNumTasks !== undefined) questionData.conjointNumTasks = Number(conjointNumTasks);
                 if (conjointIncludeNoneOption !== undefined) questionData.conjointIncludeNoneOption = !!conjointIncludeNoneOption;
                 break;
             default: break;
        }

        const newQuestion = new Question(questionData);
        const savedQuestion = await newQuestion.save();
        // console.log("createQuestion: Successfully created question:", savedQuestion._id);

        if (validSurveyId) {
             await Survey.findByIdAndUpdate(validSurveyId, { $addToSet: { questions: savedQuestion._id } });
             // console.log(`createQuestion: Added question ${savedQuestion._id} to survey ${validSurveyId}`);
        }
        res.status(201).json({ success: true, data: savedQuestion });

    } catch (error) {
        console.error("--- Backend Controller: Error during question creation ---", error);
        if (error.name === 'ValidationError' || error.name === 'CastError') {
             const messages = error.errors ? Object.values(error.errors).map(val => val.message) : [error.message];
             const field = error.errors ? Object.keys(error.errors)[0] : (error.path || 'unknown');
             return res.status(400).json({ success: false, message: "Validation Error: " + messages.join('. '), field: field, errors: error.errors });
        }
        res.status(500).json({ success: false, message: "Error creating question" });
    }
};


exports.getQuestionById = async (req, res) => {
    // console.log(`getQuestionById: Fetching question with ID: ${req.params.id}`);
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            // console.warn(`getQuestionById: Invalid ID format: ${id}`);
            return res.status(400).json({ success: false, message: "Invalid Question ID format" });
        }
        const question = await Question.findById(id);
        if (!question) {
            // console.warn(`getQuestionById: Question not found with ID: ${id}`);
            return res.status(404).json({ success: false, message: "Question not found" });
        }
        // console.log(`getQuestionById: Found question: ${id}`);
        res.status(200).json({ success: true, data: question });
    } catch (error) {
        console.error(`Error fetching question by ID ${req.params.id}:`, error);
        res.status(500).json({ success: false, message: "Error fetching question" });
    }
};

exports.updateQuestion = async (req, res) => {
    console.log(`\n--- Entering updateQuestion for ID: ${req.params.id} ---`);
    // console.log('>>> updateQuestion: Received Request Body:', JSON.stringify(req.body, null, 2));
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid Question ID format" });
        }

        const questionToUpdate = await Question.findById(id);
        if (!questionToUpdate) {
            return res.status(404).json({ success: false, message: 'Question not found' });
        }
        
        const updatesFromBody = req.body;
        let validationError = null;

        // Iterate over all paths in the schema to apply updates
        for (const field in Question.schema.paths) {
            if (field === '_id' || field === 'survey' || field === 'createdAt' || field === 'updatedAt' || field === '__v') {
                continue; // Skip non-updatable fields
            }

            if (updatesFromBody.hasOwnProperty(field)) { // Check if the field is present in the request body
                let value = updatesFromBody[field];

                // Specific transformations or cleanups
                if ((field === 'pipeOptionsFromQuestionId' || field === 'repeatForEachOptionFromQuestionId') && value === '') {
                    value = null;
                }
                if ((field === 'limitAnswersMax' || field === 'minAnswersRequired' || field === 'heatmapMaxClicks') && (value === '' || value === null)) {
                    value = null; // Ensure empty strings become null for these numeric optional fields
                } else if (Question.schema.paths[field].instance === 'Number' && value !== null && value !== undefined) {
                    const numValue = Number(value);
                    if (isNaN(numValue)) {
                        console.warn(`>>> updateQuestion: Invalid number format for field ${field}: "${value}", skipping update for this field.`);
                        continue; // Skip this field if it's not a valid number
                    }
                    value = numValue;
                } else if (Question.schema.paths[field].instance === 'Boolean') {
                    value = Boolean(value);
                }


                if (field === 'options') {
                    const typeToCheck = updatesFromBody.type || questionToUpdate.type;
                    if (OPTION_BASED_TYPES.includes(typeToCheck)) {
                        if (hasDuplicateOptions(value)) {
                            validationError = { status: 400, message: 'Validation Error: Options must be unique.', field: 'options' };
                            break; 
                        }
                        value = Array.isArray(value) ? value.map(opt => String(opt || '').trim()).filter(opt => opt) : [];
                    } else {
                        value = []; // Default to empty array if not an option-based type
                    }
                }
                questionToUpdate[field] = value;
            }
        }


        if (validationError) {
             console.error(">>> updateQuestion: Validation error during field processing:", validationError);
             return res.status(validationError.status).json({ success: false, message: validationError.message, field: validationError.field });
        }
        
        // Unset fields not relevant to the question type
        const finalType = questionToUpdate.type; // Use the potentially updated type
        const keepFieldsMap = {
            'text': ['textValidation', 'answerFormatCapitalization'],
            'textarea': ['textValidation', 'rows', 'answerFormatCapitalization'],
            'multiple-choice': ['options', 'addOtherOption', 'requireOtherIfSelected', 'addNAOption', 'randomizeOptions'],
            'checkbox': ['options', 'addOtherOption', 'requireOtherIfSelected', 'addNAOption', 'randomizeOptions', 'limitAnswers', 'limitAnswersMax', 'minAnswersRequired'],
            'dropdown': ['options'], 'rating': [], 'nps': [],
            'matrix': ['matrixRows', 'matrixColumns', 'matrixType'],
            'slider': ['sliderMin', 'sliderMax', 'sliderStep', 'sliderMinLabel', 'sliderMaxLabel'],
            'ranking': ['options'],
            'heatmap': ['imageUrl', 'heatmapMaxClicks'],
            'maxdiff': ['options', 'maxDiffItemsPerSet'],
            // *** CORRECTED CONJOINT FIELDS TO KEEP ***
            'conjoint': ['conjointAttributes', 'conjointProfilesPerTask', 'conjointNumTasks', 'conjointIncludeNoneOption'],
            'cardsort': ['options', 'cardSortCategories', 'cardSortAllowUserCategories'],
        };

        const alwaysKeepFields = [
             '_id', 'survey', 'text', 'type', 'createdAt', 'updatedAt', '__v', 'order', // Added 'order'
             'skipLogic', 'enableDisplayLogic', 'displayLogic',
             'hideByDefault', 'showOnlyToAdmin', 'isDisabled',
             'randomizationAlwaysInclude', 'randomizationPinPosition', 'hideAfterAnswering',
             'pipeOptionsFromQuestionId', 'repeatForEachOptionFromQuestionId',
             'requiredSetting', 'conditionalRequireLogic',
        ];
        
        const fieldsToKeepForType = keepFieldsMap[finalType] || [];
        const allFieldsToKeep = [...new Set([...alwaysKeepFields, ...fieldsToKeepForType])];

        for (const schemaField in Question.schema.paths) {
            if (!allFieldsToKeep.includes(schemaField)) {
                if (questionToUpdate[schemaField] !== undefined) {
                    questionToUpdate[schemaField] = undefined; // Mongoose handles unsetting fields set to undefined
                }
            }
        }
        
        // Ensure 'requireOtherIfSelected' is false if 'addOtherOption' is false
        if (finalType === 'multiple-choice' || finalType === 'checkbox') {
            if (!questionToUpdate.addOtherOption) {
                questionToUpdate.requireOtherIfSelected = false;
            }
        }


        if (!questionToUpdate.text || !questionToUpdate.text.trim()) {
            return res.status(400).json({ success: false, message: "Question text cannot be empty.", field: 'text' });
        }

        // console.log(`>>> updateQuestion: Document state BEFORE save() (ID: ${id}):`, JSON.stringify(questionToUpdate.toObject(), null, 2));
        await questionToUpdate.save(); // This will run all schema validations
        // console.log(`>>> updateQuestion: Save() operation completed for ID: ${id}.`);

        const finalUpdatedQuestion = await Question.findById(id); // Re-fetch to be sure
        if (!finalUpdatedQuestion) {
             console.error(`!!! updateQuestion: CRITICAL - Failed to re-fetch question ${id} after successful save!`);
             return res.status(500).json({ success: false, message: "Error retrieving updated question data after save." });
        }
        // console.log(`>>> updateQuestion: Re-fetched document AFTER save() (ID: ${id}):`, finalUpdatedQuestion.toObject());
        res.status(200).json({ success: true, data: finalUpdatedQuestion });

    } catch (error) {
        console.error(`Error updating question ${req.params.id}:`, error);
        if (error.name === 'ValidationError' || error.name === 'CastError') {
            // console.error("Validation/Cast Errors:", JSON.stringify(error.errors || { [error.path]: error }, null, 2));
            const messages = error.errors ? Object.values(error.errors).map(val => val.message) : [error.message];
            const field = error.errors ? Object.keys(error.errors)[0] : (error.path || 'unknown');
            return res.status(400).json({ success: false, message: `Validation Error: ${messages.join('. ')}`, field: field, errors: error.errors });
        }
        // console.error("Full Error Object:", error);
        res.status(500).json({ success: false, message: "Error updating question" });
    }
};

exports.deleteQuestion = async (req, res) => {
    // console.log(`deleteQuestion: Attempting to delete question with ID: ${req.params.id}`);
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            // console.warn(`deleteQuestion: Invalid ID format: ${id}`);
            return res.status(400).json({ success: false, message: "Invalid Question ID format" });
        }
        const questionToDelete = await Question.findById(id);
        if (!questionToDelete) {
            // console.warn(`deleteQuestion: Question not found with ID: ${id}`);
            return res.status(404).json({ success: false, message: "Question not found" });
        }
        const surveyId = questionToDelete.survey;
        const deletionResult = await Question.deleteOne({ _id: id });
        if (deletionResult.deletedCount === 0) {
            // console.warn(`deleteQuestion: Question not found during deletion attempt (race condition?): ${id}`);
            return res.status(404).json({ success: false, message: "Question not found during deletion" });
        }
        // console.log(`deleteQuestion: Successfully deleted question document: ${id}`);
        const answerDeletionResult = await Answer.deleteMany({ questionId: id });
        // console.log(`deleteQuestion: Deleted ${answerDeletionResult.deletedCount} answers associated with question ${id}`);
        if (surveyId) {
            // console.log(`deleteQuestion: Removing question ${id} from survey ${surveyId}'s questions array.`);
            const surveyUpdateResult = await Survey.findByIdAndUpdate(surveyId, { $pull: { questions: id } }, { new: true } );
            // if (surveyUpdateResult) { console.log(`deleteQuestion: Successfully removed question from survey ${surveyId}.`); }
            // else { console.warn(`deleteQuestion: Survey ${surveyId} not found when trying to remove question ${id}.`); }
        }
        res.status(200).json({ success: true, message: "Question and associated answers deleted successfully" });
    } catch (error) {
        console.error(`Error deleting question ${req.params.id}:`, error);
        res.status(500).json({ success: false, message: "Error deleting question" });
    }
};

exports.addAnswer = async (req, res) => {
    try {
        const { questionId, surveyId, sessionId, value } = req.body;
        if (!mongoose.Types.ObjectId.isValid(questionId)) {
            return res.status(400).json({ success: false, message: "Invalid Question ID format", field: "questionId" });
        }
        if (surveyId && !mongoose.Types.ObjectId.isValid(surveyId)) {
            return res.status(400).json({ success: false, message: "Invalid Survey ID format", field: "surveyId" });
        }
        if (!sessionId || typeof sessionId !== 'string') {
            return res.status(400).json({ success: false, message: "Session ID is required", field: "sessionId" });
        }
        if (value === undefined || value === null) {
            // console.warn("addAnswer: Received potentially empty answer value for question", questionId);
        }

        const questionExists = await Question.findById(questionId);
        if (!questionExists) {
            return res.status(404).json({ success: false, message: "Question not found" });
        }
        if (surveyId) {
            const surveyExists = await Survey.findById(surveyId);
            if (!surveyExists) {
                return res.status(404).json({ success: false, message: "Survey not found" });
            }
        }

        const newAnswer = new Answer({ questionId, surveyId: surveyId || null, sessionId, value });
        const savedAnswer = await newAnswer.save();
        // console.log("addAnswer: Successfully saved answer:", savedAnswer._id);
        res.status(201).json({ success: true, data: savedAnswer });
    } catch (error) {
        console.error("Error adding answer:", error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ success: false, message: "Validation Error: " + error.message, errors: error.errors });
        }
        res.status(500).json({ success: false, message: "Error adding answer" });
    }
};

exports.getAllAnswers = async (req, res) => {
    // console.log("getAllAnswers: Fetching all answers.");
    try {
        const answers = await Answer.find().sort({ createdAt: -1 });
        // console.log(`getAllAnswers: Found ${answers.length} answers.`);
        res.status(200).json({ success: true, count: answers.length, data: answers });
    } catch (error) {
        console.error("Error fetching all answers:", error);
        res.status(500).json({ success: false, message: "Error fetching answers" });
    }
};
// ----- END OF COMPLETE MODIFIED FILE (v9.6 - Fix Conjoint Update & Standardize) -----