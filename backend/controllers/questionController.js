// backend/controllers/questionController.js
// ----- START OF COMPLETE MODIFIED FILE (v9.5 - Standardized API Responses) -----
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

// GET All Questions (Standardized response for consistency, though not strictly required by current frontend)
exports.getAllQuestions = async (req, res) => {
    console.log("getAllQuestions: Fetching all questions.");
    try {
        const questionsWithCounts = await Question.aggregate([
            { $sort: { createdAt: -1 } },
            { $lookup: { from: 'answers', localField: '_id', foreignField: 'questionId', as: 'relatedAnswers' } },
            { $addFields: { answerCount: { $size: '$relatedAnswers' } } },
            { $project: { relatedAnswers: 0 } }
        ]);
        console.log(`getAllQuestions: Found ${questionsWithCounts.length} questions.`);
        // MODIFIED: Standardized success response
        res.status(200).json({ success: true, count: questionsWithCounts.length, data: questionsWithCounts });
    } catch (error) {
        console.error("Error fetching all questions:", error);
        // MODIFIED: Standardized error response
        res.status(500).json({ success: false, message: "Error fetching questions" });
    }
};

// POST Create Question
exports.createQuestion = async (req, res) => {
    console.log("--- Backend Controller: createQuestion: Received request body ---");
    // console.log(JSON.stringify(req.body, null, 2)); // Keep for detailed debugging if needed
    console.log("---------------------------------------------------------------");

    const {
        text, type, required, survey, addOtherOption, requireOtherIfSelected,
        addNAOption, options, matrixRows, matrixColumns, matrixType, sliderMin,
        sliderMax, sliderStep, sliderMinLabel, sliderMaxLabel, imageUrl,
        heatmapMaxClicks,
        maxDiffItemsPerSet, conjointAttributes, conjointProfilesPerTask,
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
                 break;
             default: break;
        }

        // console.log("--- Backend Controller: createQuestion: Data prepared for Mongoose model ---");
        // console.log(JSON.stringify(questionData, null, 2));

        const newQuestion = new Question(questionData);
        const savedQuestion = await newQuestion.save();
        console.log("createQuestion: Successfully created question:", savedQuestion._id);

        if (validSurveyId) {
             await Survey.findByIdAndUpdate(validSurveyId, { $addToSet: { questions: savedQuestion._id } });
             console.log(`createQuestion: Added question ${savedQuestion._id} to survey ${validSurveyId}`);
        }
        // MODIFIED: Standardized success response
        res.status(201).json({ success: true, data: savedQuestion });

    } catch (error) {
        console.error("--- Backend Controller: Error during question creation ---", error);
        if (error.name === 'ValidationError' || error.name === 'CastError') {
             const messages = error.errors ? Object.values(error.errors).map(val => val.message) : [error.message];
             const field = error.errors ? Object.keys(error.errors)[0] : (error.path || 'unknown');
             // MODIFIED: Standardized error response
             return res.status(400).json({ success: false, message: "Validation Error: " + messages.join('. '), field: field, errors: error.errors });
        }
        // MODIFIED: Standardized error response
        res.status(500).json({ success: false, message: "Error creating question" });
    }
};


// GET Question By ID (Standardized response for consistency)
exports.getQuestionById = async (req, res) => {
    console.log(`getQuestionById: Fetching question with ID: ${req.params.id}`);
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            console.warn(`getQuestionById: Invalid ID format: ${id}`);
            // MODIFIED: Standardized error response
            return res.status(400).json({ success: false, message: "Invalid Question ID format" });
        }
        const question = await Question.findById(id);
        if (!question) {
            console.warn(`getQuestionById: Question not found with ID: ${id}`);
            // MODIFIED: Standardized error response
            return res.status(404).json({ success: false, message: "Question not found" });
        }
        console.log(`getQuestionById: Found question: ${id}`);
        // MODIFIED: Standardized success response
        res.status(200).json({ success: true, data: question });
    } catch (error) {
        console.error(`Error fetching question by ID ${req.params.id}:`, error);
        // MODIFIED: Standardized error response
        res.status(500).json({ success: false, message: "Error fetching question" });
    }
};

// PATCH Update Question
exports.updateQuestion = async (req, res) => {
    console.log(`\n--- Entering updateQuestion for ID: ${req.params.id} ---`);
    // console.log('>>> updateQuestion: Received Request Body:', JSON.stringify(req.body, null, 2));
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            // MODIFIED: Standardized error response
            return res.status(400).json({ success: false, message: "Invalid Question ID format" });
        }

        const questionToUpdate = await Question.findById(id);
        if (!questionToUpdate) {
            // MODIFIED: Standardized error response
            return res.status(404).json({ success: false, message: 'Question not found' });
        }
        // console.log(`>>> updateQuestion: Found document (ID: ${id}). Current type: ${questionToUpdate.type}`);

        const allowedFields = Object.keys(Question.schema.paths);
        const updatesFromBody = req.body;
        let validationError = null;

        for (const field of allowedFields) {
            if (updatesFromBody[field] !== undefined) {
                // console.log(`>>> updateQuestion: Processing update for field: ${field}`);
                let value = updatesFromBody[field];
                if (field === 'survey' || field === '_id') continue;
                if ((field === 'pipeOptionsFromQuestionId' || field === 'repeatForEachOptionFromQuestionId') && value === '') value = null;
                if ((field === 'limitAnswersMax' || field === 'minAnswersRequired' || field === 'heatmapMaxClicks') && value === '') value = null;
                if (typeof Question.schema.paths[field].instance === 'Boolean') value = Boolean(value);
                if (typeof Question.schema.paths[field].instance === 'Number' && value !== null) {
                     const numValue = Number(value);
                     if (isNaN(numValue)) { console.warn(`>>> updateQuestion: Invalid number format for field ${field}: ${value}`); continue; }
                     value = numValue;
                }
                if (field === 'options') {
                    const typeToCheck = updatesFromBody.type || questionToUpdate.type;
                    if (OPTION_BASED_TYPES.includes(typeToCheck)) {
                        if (hasDuplicateOptions(value)) { validationError = { status: 400, message: 'Validation Error: Options must be unique.', field: 'options' }; break; }
                        value = Array.isArray(value) ? value.map(opt => String(opt || '').trim()).filter(opt => opt) : [];
                    } else { value = []; }
                }
                if (field === 'skipLogic') {
                     if (!Array.isArray(value)) { console.warn(`>>> updateQuestion: Invalid format for skipLogic (not an array)`); continue; }
                     // Basic check, more complex validation could be added
                     value.forEach(rule => { if (!rule || typeof rule.action !== 'string') { console.warn(`>>> updateQuestion: Invalid rule structure in skipLogic`); } });
                }
                questionToUpdate[field] = value;
                // console.log(`>>> updateQuestion: Assigned value to ${field}:`, value);
            }
        }

        if (validationError) {
             console.error(">>> updateQuestion: Validation error during field processing:", validationError);
             // MODIFIED: Standardized error response
             return res.status(validationError.status).json({ success: false, message: validationError.message, field: validationError.field });
        }

        const finalType = questionToUpdate.type;
        // console.log(`>>> updateQuestion: Final type for unsetting logic: ${finalType}`);
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
            'conjoint': ['conjointAttributes', 'conjointProfilesPerTask'],
            'cardsort': ['options', 'cardSortCategories', 'cardSortAllowUserCategories'],
        };
        const fieldsToKeep = [
             '_id', 'survey', 'text', 'type', 'createdAt', 'updatedAt', '__v',
             'skipLogic', 'enableDisplayLogic', 'displayLogic',
             'hideByDefault', 'showOnlyToAdmin', 'isDisabled',
             'randomizationAlwaysInclude', 'randomizationPinPosition', 'hideAfterAnswering',
             'pipeOptionsFromQuestionId', 'repeatForEachOptionFromQuestionId',
             'requiredSetting', 'conditionalRequireLogic',
             ...(keepFieldsMap[finalType] || [])
        ];
        const allSchemaFields = Object.keys(Question.schema.paths);
        allSchemaFields.forEach(field => {
            if (!fieldsToKeep.includes(field)) {
                if (questionToUpdate[field] !== undefined) {
                    questionToUpdate[field] = undefined;
                }
            }
        });

        if (!questionToUpdate.text || !questionToUpdate.text.trim()) {
            // MODIFIED: Standardized error response
            return res.status(400).json({ success: false, message: "Question text cannot be empty.", field: 'text' });
        }

        // console.log(`>>> updateQuestion: Document state BEFORE save() (ID: ${id}):`, questionToUpdate.toObject());
        await questionToUpdate.save();
        // console.log(`>>> updateQuestion: Save() operation completed for ID: ${id}.`);

        const finalUpdatedQuestion = await Question.findById(id);
        if (!finalUpdatedQuestion) {
             console.error(`!!! updateQuestion: CRITICAL - Failed to re-fetch question ${id} after successful save!`);
             // MODIFIED: Standardized error response
             return res.status(500).json({ success: false, message: "Error retrieving updated question data after save." });
        }
        // console.log(`>>> updateQuestion: Re-fetched document AFTER save() (ID: ${id}):`, finalUpdatedQuestion.toObject());
        // MODIFIED: Standardized success response
        res.status(200).json({ success: true, data: finalUpdatedQuestion });

    } catch (error) {
        console.error(`Error updating question ${req.params.id}:`, error);
        if (error.name === 'ValidationError' || error.name === 'CastError') {
            // console.error("Validation/Cast Errors:", JSON.stringify(error.errors || { [error.path]: error }, null, 2));
            const messages = error.errors ? Object.values(error.errors).map(val => val.message) : [error.message];
            const field = error.errors ? Object.keys(error.errors)[0] : (error.path || 'unknown');
            // MODIFIED: Standardized error response
            return res.status(400).json({ success: false, message: `Validation Error: ${messages.join('. ')}`, field: field, errors: error.errors });
        }
        // console.error("Full Error Object:", error);
        // MODIFIED: Standardized error response
        res.status(500).json({ success: false, message: "Error updating question" });
    }
};

// DELETE Question
exports.deleteQuestion = async (req, res) => {
    console.log(`deleteQuestion: Attempting to delete question with ID: ${req.params.id}`);
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            console.warn(`deleteQuestion: Invalid ID format: ${id}`);
            // MODIFIED: Standardized error response
            return res.status(400).json({ success: false, message: "Invalid Question ID format" });
        }
        const questionToDelete = await Question.findById(id);
        if (!questionToDelete) {
            console.warn(`deleteQuestion: Question not found with ID: ${id}`);
            // MODIFIED: Standardized error response
            return res.status(404).json({ success: false, message: "Question not found" });
        }
        const surveyId = questionToDelete.survey;
        const deletionResult = await Question.deleteOne({ _id: id });
        if (deletionResult.deletedCount === 0) {
            console.warn(`deleteQuestion: Question not found during deletion attempt (race condition?): ${id}`);
            // MODIFIED: Standardized error response
            return res.status(404).json({ success: false, message: "Question not found during deletion" });
        }
        console.log(`deleteQuestion: Successfully deleted question document: ${id}`);
        const answerDeletionResult = await Answer.deleteMany({ questionId: id });
        console.log(`deleteQuestion: Deleted ${answerDeletionResult.deletedCount} answers associated with question ${id}`);
        if (surveyId) {
            console.log(`deleteQuestion: Removing question ${id} from survey ${surveyId}'s questions array.`);
            const surveyUpdateResult = await Survey.findByIdAndUpdate(surveyId, { $pull: { questions: id } }, { new: true } );
            if (surveyUpdateResult) { console.log(`deleteQuestion: Successfully removed question from survey ${surveyId}.`); }
            else { console.warn(`deleteQuestion: Survey ${surveyId} not found when trying to remove question ${id}.`); }
        }
        // MODIFIED: Standardized success response
        res.status(200).json({ success: true, message: "Question and associated answers deleted successfully" });
    } catch (error) {
        console.error(`Error deleting question ${req.params.id}:`, error);
        // MODIFIED: Standardized error response
        res.status(500).json({ success: false, message: "Error deleting question" });
    }
};

// POST Add Answer (Standardized response for consistency)
exports.addAnswer = async (req, res) => {
    // console.log("addAnswer: Received request body:", req.body);
    try {
        const { questionId, surveyId, sessionId, value } = req.body;
        if (!mongoose.Types.ObjectId.isValid(questionId)) {
            return res.status(400).json({ success: false, message: "Invalid Question ID format", field: "questionId" });
        }
        // Corrected surveyId validation
        if (surveyId && !mongoose.Types.ObjectId.isValid(surveyId)) {
            return res.status(400).json({ success: false, message: "Invalid Survey ID format", field: "surveyId" });
        }
        if (!sessionId || typeof sessionId !== 'string') {
            return res.status(400).json({ success: false, message: "Session ID is required", field: "sessionId" });
        }
        if (value === undefined || value === null) {
            console.warn("addAnswer: Received potentially empty answer value for question", questionId);
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
            // This is a warning, not a blocking error, so it's fine as is.
            // if (!surveyExists.questions.includes(questionId)) console.warn(`addAnswer: Question ${questionId} does not belong to survey ${surveyId}. Allowing answer anyway.`);
        }

        const newAnswer = new Answer({ questionId, surveyId: surveyId || null, sessionId, value });
        const savedAnswer = await newAnswer.save();
        console.log("addAnswer: Successfully saved answer:", savedAnswer._id);
        // MODIFIED: Standardized success response
        res.status(201).json({ success: true, data: savedAnswer });
    } catch (error) {
        console.error("Error adding answer:", error);
        if (error.name === 'ValidationError') {
            // MODIFIED: Standardized error response
            return res.status(400).json({ success: false, message: "Validation Error: " + error.message, errors: error.errors });
        }
        // MODIFIED: Standardized error response
        res.status(500).json({ success: false, message: "Error adding answer" });
    }
};

// GET All Answers (Standardized response for consistency)
exports.getAllAnswers = async (req, res) => {
    console.log("getAllAnswers: Fetching all answers.");
    try {
        const answers = await Answer.find().sort({ createdAt: -1 });
        console.log(`getAllAnswers: Found ${answers.length} answers.`);
        // MODIFIED: Standardized success response
        res.status(200).json({ success: true, count: answers.length, data: answers });
    } catch (error) {
        console.error("Error fetching all answers:", error);
        // MODIFIED: Standardized error response
        res.status(500).json({ success: false, message: "Error fetching answers" });
    }
};

// ----- END OF COMPLETE MODIFIED FILE (v9.5 - Standardized API Responses) -----