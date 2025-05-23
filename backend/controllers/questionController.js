// backend/controllers/questionController.js
// ----- START OF COMPLETE UPDATED FILE (v9.8 - Refined originalIndex handling in update) -----
const mongoose = require('mongoose');
const Question = require('../models/Question');
const Answer = require('../models/Answer'); // Assuming this is used elsewhere or for future
const Survey = require('../models/Survey');

const OPTION_BASED_TYPES = ['multiple-choice', 'checkbox', 'dropdown', 'ranking', 'maxdiff', 'cardsort'];
const hasDuplicateOptions = (options) => { if (!Array.isArray(options) || options.length === 0) { return false; } const validOptions = options.filter(opt => typeof opt === 'string' && opt.trim() !== ''); if (validOptions.length <= 1) { return false; } const uniqueOptions = new Set(validOptions); return uniqueOptions.size !== validOptions.length; };

exports.getAllQuestions = async (req, res) => { try { const questionsWithCounts = await Question.aggregate([ { $sort: { createdAt: -1 } }, { $lookup: { from: 'answers', localField: '_id', foreignField: 'questionId', as: 'relatedAnswers' } }, { $addFields: { answerCount: { $size: '$relatedAnswers' } } }, { $project: { relatedAnswers: 0 } } ]); res.status(200).json({ success: true, count: questionsWithCounts.length, data: questionsWithCounts }); } catch (error) { console.error("Error fetching all questions:", error); res.status(500).json({ success: false, message: "Error fetching questions" }); } };

exports.createQuestion = async (req, res) => {
    console.log("--- Backend Controller: createQuestion ---");
    console.log("Received request body for create:", JSON.stringify(req.body, null, 2));
    const {
        text, type, survey, originalIndex, 
        addOtherOption, requireOtherIfSelected, addNAOption, options, matrixRows, matrixColumns, matrixType, sliderMin, sliderMax, sliderStep, sliderMinLabel, sliderMaxLabel, imageUrl, heatmapMaxClicks, conjointNumTasks, maxDiffItemsPerSet, conjointAttributes, conjointProfilesPerTask, conjointIncludeNoneOption, cardSortCategories, cardSortAllowUserCategories, skipLogic, enableDisplayLogic, hideByDefault, showOnlyToAdmin, isDisabled, randomizationAlwaysInclude, randomizationPinPosition, hideAfterAnswering, randomizeOptions, pipeOptionsFromQuestionId, repeatForEachOptionFromQuestionId, requiredSetting, answerFormatCapitalization, limitAnswers, limitAnswersMax, minAnswersRequired, textValidation, rows
    } = req.body;
    const mongoSession = await mongoose.startSession(); // Use session for atomicity if updating Survey too
    mongoSession.startTransaction();
    try {
        const validSurveyId = survey === "" ? null : survey;
        if (!text || typeof text !== 'string' || !text.trim()) { await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(400).json({ success: false, message: 'Question text is required.', field: 'text' }); }
        if (!type || typeof type !== 'string') { await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(400).json({ success: false, message: 'Question type is required.', field: 'type' }); }
        if (validSurveyId && !mongoose.Types.ObjectId.isValid(validSurveyId)) { await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(400).json({ success: false, message: 'Invalid Survey ID format provided.', field: 'survey' }); }

        let finalOriginalIndex;
        if (typeof originalIndex === 'number' && originalIndex >= 0) {
            finalOriginalIndex = originalIndex;
        } else if (validSurveyId) {
            const surveyDoc = await Survey.findById(validSurveyId).select('questions').session(mongoSession);
            finalOriginalIndex = surveyDoc ? surveyDoc.questions.length : 0;
        } else {
            finalOriginalIndex = 0; 
        }
        console.log(`createQuestion: Determined finalOriginalIndex: ${finalOriginalIndex}`);
        
        let cleanedOptions = options; /* ... options cleaning ... */ if (OPTION_BASED_TYPES.includes(type) && options !== undefined) { if (hasDuplicateOptions(options)) { await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(400).json({ success: false, message: 'Validation Error: Options must be unique.', field: 'options' }); } cleanedOptions = Array.isArray(options) ? options.map(opt => String(opt || '').trim()).filter(opt => opt) : []; }

        const questionData = {
            text, type, survey: validSurveyId, originalIndex: finalOriginalIndex,
            /* ... all other fields from your v9.7 ... */
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
        /* ... type specific cleanups ... */ const SPECIAL_OPTION_TYPES = ['multiple-choice', 'checkbox']; if (!SPECIAL_OPTION_TYPES.includes(type)) { delete questionData.addOtherOption; delete questionData.requireOtherIfSelected; delete questionData.addNAOption; } else { if (!questionData.addOtherOption) questionData.requireOtherIfSelected = false; } if (!['text', 'textarea'].includes(type)) delete questionData.answerFormatCapitalization; if (!['checkbox'].includes(type)) { delete questionData.limitAnswers; delete questionData.limitAnswersMax; delete questionData.minAnswersRequired; } if (!['multiple-choice', 'checkbox'].includes(type)) delete questionData.randomizeOptions; if (!['text', 'textarea'].includes(type)) delete questionData.textValidation; if (type !== 'textarea') delete questionData.rows;
        switch (type) { /* ... type specific assignments ... */ case 'multiple-choice': case 'checkbox': case 'dropdown': case 'ranking': case 'maxdiff': case 'cardsort': questionData.options = cleanedOptions; if (type === 'maxdiff' && maxDiffItemsPerSet !== undefined) questionData.maxDiffItemsPerSet = Number(maxDiffItemsPerSet); if (type === 'cardsort') { if (cardSortCategories !== undefined) questionData.cardSortCategories = cardSortCategories; if (cardSortAllowUserCategories !== undefined) questionData.cardSortAllowUserCategories = !!cardSortAllowUserCategories; } break; case 'matrix': if (matrixRows !== undefined) questionData.matrixRows = matrixRows; if (matrixColumns !== undefined) questionData.matrixColumns = matrixColumns; if (matrixType !== undefined) questionData.matrixType = matrixType; break; case 'slider': if (sliderMin !== undefined) questionData.sliderMin = Number(sliderMin); if (sliderMax !== undefined) questionData.sliderMax = Number(sliderMax); if (sliderStep !== undefined) questionData.sliderStep = Number(sliderStep); if (sliderMinLabel !== undefined) questionData.sliderMinLabel = sliderMinLabel; if (sliderMaxLabel !== undefined) questionData.sliderMaxLabel = sliderMaxLabel; break; case 'heatmap': if (imageUrl !== undefined) questionData.imageUrl = imageUrl; if (heatmapMaxClicks !== undefined && heatmapMaxClicks !== null && heatmapMaxClicks !== '') { const maxClicksNum = Number(heatmapMaxClicks); if (!isNaN(maxClicksNum) && maxClicksNum >= 0) questionData.heatmapMaxClicks = maxClicksNum; } else { questionData.heatmapMaxClicks = null; } break; case 'conjoint': if (conjointAttributes !== undefined) questionData.conjointAttributes = conjointAttributes; if (conjointProfilesPerTask !== undefined) questionData.conjointProfilesPerTask = Number(conjointProfilesPerTask); if (conjointNumTasks !== undefined) questionData.conjointNumTasks = Number(conjointNumTasks); if (conjointIncludeNoneOption !== undefined) questionData.conjointIncludeNoneOption = !!conjointIncludeNoneOption; break; default: break;}

        const newQuestion = new Question(questionData);
        const savedQuestion = await newQuestion.save({ session: mongoSession });
        console.log("createQuestion: Successfully created question:", savedQuestion._id, "with originalIndex:", savedQuestion.originalIndex);

        if (validSurveyId) {
             await Survey.findByIdAndUpdate(validSurveyId, { $addToSet: { questions: savedQuestion._id } }, { session: mongoSession });
        }
        await mongoSession.commitTransaction();
        mongoSession.endSession();
        res.status(201).json({ success: true, data: savedQuestion });

    } catch (error) {
        if (mongoSession.inTransaction()) await mongoSession.abortTransaction();
        mongoSession.endSession();
        console.error("--- Backend Controller: Error during question creation ---", error);
        if (error.name === 'ValidationError' || error.name === 'CastError') {
             const messages = error.errors ? Object.values(error.errors).map(val => val.message) : [error.message];
             const field = error.errors ? Object.keys(error.errors)[0] : (error.path || 'unknown');
             return res.status(400).json({ success: false, message: "Validation Error: " + messages.join('. '), field: field, errors: error.errors });
        }
        res.status(500).json({ success: false, message: "Error creating question" });
    }
};

exports.getQuestionById = async (req, res) => { /* ... same ... */ try { const { id } = req.params; if (!mongoose.Types.ObjectId.isValid(id)) { return res.status(400).json({ success: false, message: "Invalid Question ID format" }); } const question = await Question.findById(id); if (!question) { return res.status(404).json({ success: false, message: "Question not found" }); } res.status(200).json({ success: true, data: question }); } catch (error) { console.error(`Error fetching question by ID ${req.params.id}:`, error); res.status(500).json({ success: false, message: "Error fetching question" }); } };

exports.updateQuestion = async (req, res) => {
    console.log(`\n--- Entering updateQuestion for ID: ${req.params.id} ---`);
    console.log('>>> updateQuestion: Received Request Body:', JSON.stringify(req.body, null, 2));
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
        console.log('>>> updateQuestion: updatesFromBody.originalIndex:', updatesFromBody.originalIndex, "(Type:", typeof updatesFromBody.originalIndex + ")");
        console.log('>>> updateQuestion: questionToUpdate.originalIndex (before loop):', questionToUpdate.originalIndex, "(Type:", typeof questionToUpdate.originalIndex + ")");

        // Explicitly handle originalIndex first if it's in the body
        if (updatesFromBody.hasOwnProperty('originalIndex')) {
            const newOriginalIndex = Number(updatesFromBody.originalIndex);
            if (typeof updatesFromBody.originalIndex !== 'number' && (isNaN(newOriginalIndex) || newOriginalIndex < 0) ) { // Allow 0
                console.warn(`>>> updateQuestion: Invalid originalIndex in request body: "${updatesFromBody.originalIndex}". Retaining existing: ${questionToUpdate.originalIndex}`);
                // Do not update originalIndex if new one is invalid, let existing one (if any) persist for now.
                // Or, if it MUST be updated, this would be an error.
                // For now, we'll let it be, and if it's still undefined, validation will catch it.
            } else {
                 questionToUpdate.originalIndex = newOriginalIndex;
                 console.log(`>>> updateQuestion: Explicitly set questionToUpdate.originalIndex to: ${questionToUpdate.originalIndex}`);
            }
        } else if (typeof questionToUpdate.originalIndex !== 'number') {
            // If not in body AND not already a number on the doc, this is a problem for 'required'
            console.warn(`>>> updateQuestion: originalIndex not in request and not valid on document. ID: ${id}. Current value: ${questionToUpdate.originalIndex}`);
            // It will fail validation later if still not a number.
        }


        for (const field in Question.schema.paths) {
            if (field === '_id' || field === 'survey' || field === 'createdAt' || field === 'updatedAt' || field === '__v') {
                continue;
            }
            // Skip originalIndex if we handled it above, or ensure it's handled correctly if it wasn't in body
            if (field === 'originalIndex' && updatesFromBody.hasOwnProperty('originalIndex')) {
                 // Already handled if it was in updatesFromBody
            } else if (updatesFromBody.hasOwnProperty(field)) {
                let value = updatesFromBody[field];
                if ((field === 'pipeOptionsFromQuestionId' || field === 'repeatForEachOptionFromQuestionId') && value === '') { value = null; }
                if ((field === 'limitAnswersMax' || field === 'minAnswersRequired' || field === 'heatmapMaxClicks') && (value === '' || value === null)) { value = null; }
                else if (Question.schema.paths[field].instance === 'Number' && value !== null && value !== undefined) {
                    const numValue = Number(value);
                    if (isNaN(numValue)) { console.warn(`>>> updateQuestion: Invalid number for field ${field}: "${value}", skipping.`); continue; }
                    value = numValue;
                } else if (Question.schema.paths[field].instance === 'Boolean') { value = Boolean(value); }
                if (field === 'options') { const typeToCheck = updatesFromBody.type || questionToUpdate.type; if (OPTION_BASED_TYPES.includes(typeToCheck)) { if (hasDuplicateOptions(value)) { validationError = { status: 400, message: 'Validation Error: Options must be unique.', field: 'options' }; break; } value = Array.isArray(value) ? value.map(opt => String(opt || '').trim()).filter(opt => opt) : []; } else { value = []; } }
                questionToUpdate[field] = value;
            }
        }

        if (validationError) { return res.status(validationError.status).json({ success: false, message: validationError.message, field: validationError.field }); }
        
        const finalType = questionToUpdate.type;
        const keepFieldsMap = { /* ... */ 'text': ['textValidation', 'answerFormatCapitalization'], 'textarea': ['textValidation', 'rows', 'answerFormatCapitalization'], 'multiple-choice': ['options', 'addOtherOption', 'requireOtherIfSelected', 'addNAOption', 'randomizeOptions'], 'checkbox': ['options', 'addOtherOption', 'requireOtherIfSelected', 'addNAOption', 'randomizeOptions', 'limitAnswers', 'limitAnswersMax', 'minAnswersRequired'], 'dropdown': ['options'], 'rating': [], 'nps': [], 'matrix': ['matrixRows', 'matrixColumns', 'matrixType'], 'slider': ['sliderMin', 'sliderMax', 'sliderStep', 'sliderMinLabel', 'sliderMaxLabel'], 'ranking': ['options'], 'heatmap': ['imageUrl', 'heatmapMaxClicks', 'definedHeatmapAreas'], 'maxdiff': ['options', 'maxDiffItemsPerSet'], 'conjoint': ['conjointAttributes', 'conjointProfilesPerTask', 'conjointNumTasks', 'conjointIncludeNoneOption'], 'cardsort': ['options', 'cardSortCategories', 'cardSortAllowUserCategories'],};
        const alwaysKeepFields = [ '_id', 'survey', 'text', 'type', 'createdAt', 'updatedAt', '__v', 
                                   'originalIndex', // <<< ENSURED 'originalIndex' IS HERE
                                   'skipLogic', 'enableDisplayLogic', 'displayLogic', 'hideByDefault', 'showOnlyToAdmin', 'isDisabled', 'randomizationAlwaysInclude', 'randomizationPinPosition', 'hideAfterAnswering', 'pipeOptionsFromQuestionId', 'repeatForEachOptionFromQuestionId', 'requiredSetting', 'conditionalRequireLogic',];
        const fieldsToKeepForType = keepFieldsMap[finalType] || [];
        const allFieldsToKeep = [...new Set([...alwaysKeepFields, ...fieldsToKeepForType])];

        for (const schemaField in Question.schema.paths) {
            if (!allFieldsToKeep.includes(schemaField)) {
                if (questionToUpdate[schemaField] !== undefined) { questionToUpdate[schemaField] = undefined; }
            }
        }
        if (finalType === 'multiple-choice' || finalType === 'checkbox') { if (!questionToUpdate.addOtherOption) { questionToUpdate.requireOtherIfSelected = false; } }
        if (!questionToUpdate.text || !questionToUpdate.text.trim()) { return res.status(400).json({ success: false, message: "Question text cannot be empty.", field: 'text' }); }

        console.log(`>>> updateQuestion: Document state BEFORE save(). originalIndex: ${questionToUpdate.originalIndex} (Type: ${typeof questionToUpdate.originalIndex})`);
        console.log(`>>> updateQuestion: Full document before save:`, JSON.stringify(questionToUpdate.toObject({ virtuals: false }), null, 2));


        await questionToUpdate.save();
        const finalUpdatedQuestion = await Question.findById(id);
        if (!finalUpdatedQuestion) { return res.status(500).json({ success: false, message: "Error retrieving updated question data after save." }); }
        res.status(200).json({ success: true, data: finalUpdatedQuestion });

    } catch (error) {
        if (error.name === 'ValidationError') { console.error(">>> updateQuestion: ValidationError Details:", JSON.stringify(error.errors, null, 2)); }
        console.error(`Error updating question ${req.params.id}:`, error.message, error.stack); // Log more error detail
        const messages = error.errors ? Object.values(error.errors).map(val => val.message) : [error.message];
        const field = error.errors ? Object.keys(error.errors)[0] : (error.path || 'unknown');
        return res.status(400).json({ success: false, message: `Validation Error: ${messages.join('. ')}`, field: field, errors: error.errors });
    }
};

exports.deleteQuestion = async (req, res) => { /* ... same ... */ try { const { id } = req.params; if (!mongoose.Types.ObjectId.isValid(id)) { return res.status(400).json({ success: false, message: "Invalid Question ID format" }); } const questionToDelete = await Question.findById(id); if (!questionToDelete) { return res.status(404).json({ success: false, message: "Question not found" }); } const surveyId = questionToDelete.survey; const deletionResult = await Question.deleteOne({ _id: id }); if (deletionResult.deletedCount === 0) { return res.status(404).json({ success: false, message: "Question not found during deletion" }); } const answerDeletionResult = await Answer.deleteMany({ questionId: id }); if (surveyId) { const surveyUpdateResult = await Survey.findByIdAndUpdate(surveyId, { $pull: { questions: id } }, { new: true } ); } res.status(200).json({ success: true, message: "Question and associated answers deleted successfully" }); } catch (error) { console.error(`Error deleting question ${req.params.id}:`, error); res.status(500).json({ success: false, message: "Error deleting question" }); } };
exports.addAnswer = async (req, res) => { /* ... same ... */ try { const { questionId, surveyId, sessionId, value } = req.body; if (!mongoose.Types.ObjectId.isValid(questionId)) { return res.status(400).json({ success: false, message: "Invalid Question ID format", field: "questionId" }); } if (surveyId && !mongoose.Types.ObjectId.isValid(surveyId)) { return res.status(400).json({ success: false, message: "Invalid Survey ID format", field: "surveyId" }); } if (!sessionId || typeof sessionId !== 'string') { return res.status(400).json({ success: false, message: "Session ID is required", field: "sessionId" }); } const questionExists = await Question.findById(questionId); if (!questionExists) { return res.status(404).json({ success: false, message: "Question not found" }); } if (surveyId) { const surveyExists = await Survey.findById(surveyId); if (!surveyExists) { return res.status(404).json({ success: false, message: "Survey not found" }); } } const newAnswer = new Answer({ questionId, surveyId: surveyId || null, sessionId, value }); const savedAnswer = await newAnswer.save(); res.status(201).json({ success: true, data: savedAnswer }); } catch (error) { console.error("Error adding answer:", error); if (error.name === 'ValidationError') { return res.status(400).json({ success: false, message: "Validation Error: " + error.message, errors: error.errors }); } res.status(500).json({ success: false, message: "Error adding answer" }); } };
exports.getAllAnswers = async (req, res) => { /* ... same ... */ try { const answers = await Answer.find().sort({ createdAt: -1 }); res.status(200).json({ success: true, count: answers.length, data: answers }); } catch (error) { console.error("Error fetching all answers:", error); res.status(500).json({ success: false, message: "Error fetching answers" }); } };
// ----- END OF COMPLETE UPDATED FILE (v9.8 - Refined originalIndex handling in update) -----