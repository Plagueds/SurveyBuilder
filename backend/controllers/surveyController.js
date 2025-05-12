// backend/controllers/surveyController.js
// ----- START OF COMPLETE MODIFIED FILE (v1.7 - Corrected answer payload processing) -----
const mongoose = require('mongoose');
const { Parser } = require('json2csv');
const Survey = require('../models/Survey');
const Question = require('../models/Question');
const Answer = require('../models/Answer');
const Collector = require('../models/Collector');
const { evaluateAllLogic } = require('../utils/logicEvaluator');
const axios = require('axios');

// --- Helper Function for Conjoint Question Type (used in getSurveyById) ---
const generateConjointProfiles = (attributes) => {
    if (!Array.isArray(attributes) || attributes.length === 0) { return []; }
    const validAttributes = attributes.filter(attr => attr && attr.name && Array.isArray(attr.levels) && attr.levels.length > 0);
    if (validAttributes.length === 0) { return []; }
    const combine = (index, currentProfile) => {
        if (index === validAttributes.length) { return [currentProfile]; }
        const attribute = validAttributes[index];
        const results = [];
        for (const level of attribute.levels) {
            const nextProfile = { ...currentProfile, [attribute.name]: level };
            results.push(...combine(index + 1, nextProfile));
        }
        return results;
    };
    return combine(0, {});
};


// --- Helper Function for CSV Export (used in exportSurveyResults) ---
const CSV_SEPARATOR = '; ';
const formatValueForCsv = (value, questionType) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return `"${value.replace(/"/g, '""')}"`;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    switch (questionType) {
        case 'checkbox': return Array.isArray(value) ? `"${value.map(v => String(v).replace(/"/g, '""')).join(CSV_SEPARATOR)}"` : `"${String(value).replace(/"/g, '""')}"`;
        case 'heatmap': return Array.isArray(value) ? value.length + " clicks" : JSON.stringify(value);
        case 'matrix': return (typeof value === 'object' && value !== null) ? `"${Object.entries(value).map(([row, col]) => `${row}:${col}`).join(CSV_SEPARATOR)}"` : JSON.stringify(value);
        case 'ranking': return Array.isArray(value) ? `"${value.map(v => String(v).replace(/"/g, '""')).join(CSV_SEPARATOR)}"` : JSON.stringify(value);
        case 'cardsort': return (typeof value === 'object' && value !== null && value.assignments) ? `"${Object.entries(value.assignments).map(([card, category]) => `${card} in ${category}`).join(CSV_SEPARATOR)}"` : JSON.stringify(value);
        case 'maxdiff':
            if (typeof value === 'object' && value !== null) {
                const best = value.best ? `Best: ${value.best}` : '';
                const worst = value.worst ? `Worst: ${value.worst}` : '';
                return `"${[best, worst].filter(Boolean).join(', ')}"`;
            }
            return JSON.stringify(value);
        case 'conjoint': return (typeof value === 'object' && value !== null) ? `"${JSON.stringify(value).replace(/"/g, '""')}"` : JSON.stringify(value);
        default: return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
    }
};

// --- Controller Functions ---
exports.getAllSurveys = async (req, res) => {
    try {
        const filter = { createdBy: req.user.id };
        if (req.user.role === 'admin') {
            delete filter.createdBy;
        }
        if (req.query.status && ['draft', 'active', 'closed', 'archived'].includes(req.query.status)) {
            filter.status = req.query.status;
        }
        const surveys = await Survey.find(filter)
            .select('-questions -globalSkipLogic -settings -randomizationLogic -collectors')
            .sort({ createdAt: -1 });
        res.status(200).json({ success: true, count: surveys.length, data: surveys });
    } catch (error) {
        console.error("Error fetching surveys:", error);
        res.status(500).json({ success: false, message: "Error fetching surveys" });
    }
};

exports.createSurvey = async (req, res) => {
    const { title, description } = req.body;
    try {
        if (!title || typeof title !== 'string' || !title.trim()) {
            return res.status(400).json({ success: false, message: 'Survey title is required.' });
        }
        const newSurvey = new Survey({
            title: title.trim(),
            description: description ? String(description).trim() : undefined,
            createdBy: req.user.id
        });
        const savedSurvey = await newSurvey.save();
        res.status(201).json({ success: true, data: savedSurvey });
    } catch (error) {
        console.error("Error creating survey:", error);
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ success: false, message: messages.join('. '), errors: error.errors });
        }
        res.status(500).json({ success: false, message: "Error creating survey" });
    }
};

exports.getSurveyById = async (req, res) => {
    const { surveyId } = req.params;
    try {
        const survey = await Survey.findById(surveyId)
            .populate({ path: 'questions', model: 'Question' })
            .lean();
        if (!survey) {
            return res.status(404).json({ success: false, message: 'Survey not found (post-authorization check).' });
        }
        if (survey.questions && survey.questions.length > 0) {
            survey.questions = survey.questions.map(question => {
                if (question.type === 'conjoint' && Array.isArray(question.conjointAttributes) && question.conjointAttributes.length > 0) {
                    question.conjointProfiles = generateConjointProfiles(question.conjointAttributes).slice(0, question.conjointProfilesPerTask || 2);
                }
                return question;
            });
        }
        res.status(200).json({ success: true, data: survey });
    } catch (error) {
        console.error(`Error fetching survey ${surveyId}:`, error);
        res.status(500).json({ success: false, message: "Error fetching survey details" });
    }
};

exports.updateSurvey = async (req, res) => {
    const { surveyId } = req.params;
    const updates = req.body;
    try {
        const allowedUpdates = ['title', 'description', 'status', 'questions', 'randomizationLogic', 'logicRules', 'settings'];
        const receivedUpdates = Object.keys(updates);
        const isValidOperation = receivedUpdates.every(update => allowedUpdates.includes(update));
        if (!isValidOperation) {
            const invalidFields = receivedUpdates.filter(update => !allowedUpdates.includes(update));
            return res.status(400).json({ success: false, message: `Invalid update fields: ${invalidFields.join(', ')}` });
        }
        let finalUpdates = { ...updates };
        if (updates.logicRules !== undefined) {
            finalUpdates.globalSkipLogic = updates.logicRules;
            delete finalUpdates.logicRules;
        }
        if (finalUpdates.status && !['draft', 'active', 'closed', 'archived'].includes(finalUpdates.status)) {
            return res.status(400).json({ success: false, message: 'Invalid status value.' });
        }
        if (finalUpdates.title !== undefined && (typeof finalUpdates.title !== 'string' || !finalUpdates.title.trim())) {
            return res.status(400).json({ success: false, message: 'Survey title cannot be empty.' });
        }
        const updatedSurvey = await Survey.findByIdAndUpdate(surveyId, { $set: finalUpdates }, { new: true, runValidators: true })
            .populate('questions');
        if (!updatedSurvey) {
            return res.status(404).json({ success: false, message: 'Survey not found during update (post-authorization check).' });
        }
        res.status(200).json({ success: true, data: updatedSurvey });
    } catch (error) {
        console.error(`Error updating survey ${surveyId}:`, error);
        if (error.name === 'ValidationError') {
            const errorMessage = Object.values(error.errors).map(e => e.message).join(' ');
            return res.status(400).json({ success: false, message: `Validation Error: ${errorMessage}`, errors: error.errors });
        }
        res.status(500).json({ success: false, message: "Error updating survey" });
    }
};

exports.deleteSurvey = async (req, res) => {
    const { surveyId } = req.params;
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        await Answer.deleteMany({ surveyId: surveyId }, { session });
        await Collector.deleteMany({ survey: surveyId }, { session });
        await Survey.findByIdAndDelete(surveyId, { session });
        await session.commitTransaction();
        res.status(200).json({ success: true, message: 'Survey, its answers, and collectors deleted successfully', id: surveyId });
    } catch (error) {
        await session.abortTransaction();
        console.error(`Error deleting survey ${surveyId}:`, error);
        res.status(500).json({ success: false, message: "Error deleting survey" });
    } finally {
        session.endSession();
    }
};


// --- Survey Submission and Public-Facing Endpoints ---

// @desc    Submit answers for a survey
// @route   POST /api/surveys/:surveyId/submit
// @access  Public
exports.submitSurveyAnswers = async (req, res) => {
    const { surveyId } = req.params;
    const { answers: answersPayload, sessionId: payloadSessionId, collectorId, recaptchaToken } = req.body;

    console.log(`[submitSurveyAnswers] Received submission for surveyId: ${surveyId}`);
    console.log('[submitSurveyAnswers] Request body:', JSON.stringify(req.body, null, 2));

    if (!mongoose.Types.ObjectId.isValid(surveyId)) {
        console.warn('[submitSurveyAnswers] Invalid Survey ID format:', surveyId);
        return res.status(400).json({ success: false, message: 'Invalid Survey ID.' });
    }
    if (!Array.isArray(answersPayload)) {
        console.warn('[submitSurveyAnswers] answersPayload is not an array:', answersPayload);
        return res.status(400).json({ success: false, message: 'Answers payload must be an array.' });
    }
    const sessionIdToUse = payloadSessionId || (answersPayload[0]?.sessionId); // sessionId can also be part of answersPayload items
    if (!sessionIdToUse) {
        console.warn('[submitSurveyAnswers] Session ID is missing.');
        return res.status(400).json({ success: false, message: 'Session ID is required.' });
    }
    if (!collectorId || !mongoose.Types.ObjectId.isValid(collectorId)) {
        console.warn('[submitSurveyAnswers] Invalid or missing Collector ID:', collectorId);
        return res.status(400).json({ success: false, message: 'Valid Collector ID is required for submission.' });
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    console.log(`[submitSurveyAnswers] Started transaction for session ${sessionIdToUse}`);

    try {
        const survey = await Survey.findById(surveyId).populate('questions').select('+status +globalSkipLogic +questions').session(session);
        if (!survey) {
            console.warn(`[submitSurveyAnswers] Survey not found: ${surveyId}`);
            await session.abortTransaction(); session.endSession();
            return res.status(404).json({ success: false, message: 'Survey not found.' });
        }
        console.log(`[submitSurveyAnswers] Found survey: ${survey.title}, Status: ${survey.status}`);
        if (survey.status !== 'active' && survey.status !== 'draft') {
            console.warn(`[submitSurveyAnswers] Survey ${surveyId} is not active. Status: ${survey.status}`);
            await session.abortTransaction(); session.endSession();
            return res.status(400).json({ success: false, message: 'This survey is not currently active or accepting responses.' });
        }

        const collector = await Collector.findById(collectorId).session(session);
        if (!collector) {
            console.warn(`[submitSurveyAnswers] Collector not found: ${collectorId}`);
            await session.abortTransaction(); session.endSession();
            return res.status(404).json({ success: false, message: 'Collector not found.' });
        }
        console.log(`[submitSurveyAnswers] Found collector: ${collector.name}, Type: ${collector.type}, Response Count: ${collector.responseCount}`);
        console.log(`[submitSurveyAnswers] Collector settings for web_link:`, JSON.stringify(collector.settings?.web_link, null, 2));

        if (String(collector.survey) !== String(surveyId)) {
            console.warn(`[submitSurveyAnswers] Collector ${collectorId} does not belong to survey ${surveyId}. Belongs to: ${collector.survey}`);
            await session.abortTransaction(); session.endSession();
            return res.status(400).json({ success: false, message: 'Collector does not belong to this survey.' });
        }

        if (collector.status !== 'open') {
            console.warn(`[submitSurveyAnswers] Collector ${collectorId} is not open. Status: ${collector.status}`);
            await session.abortTransaction(); session.endSession();
            return res.status(400).json({ success: false, message: `This survey link is currently ${collector.status}.` });
        }
        const now = new Date();
        if (collector.settings?.web_link?.openDate && new Date(collector.settings.web_link.openDate) > now) {
            console.warn(`[submitSurveyAnswers] Collector ${collectorId} not yet open. Opens at: ${collector.settings.web_link.openDate}`);
            await session.abortTransaction(); session.endSession();
            return res.status(400).json({ success: false, message: 'This survey is not yet open.' });
        }
        if (collector.settings?.web_link?.closeDate && new Date(collector.settings.web_link.closeDate) < now) {
            console.warn(`[submitSurveyAnswers] Collector ${collectorId} has closed. Closed at: ${collector.settings.web_link.closeDate}`);
            await session.abortTransaction(); session.endSession();
            return res.status(400).json({ success: false, message: 'This survey has closed.' });
        }
        if (collector.settings?.web_link?.maxResponses && collector.responseCount >= collector.settings.web_link.maxResponses) {
            console.warn(`[submitSurveyAnswers] Collector ${collectorId} has reached max responses. Count: ${collector.responseCount}, Max: ${collector.settings.web_link.maxResponses}`);
            await session.abortTransaction(); session.endSession();
            return res.status(400).json({ success: false, message: 'This survey has reached its maximum response limit.' });
        }

        if (collector.type === 'web_link' && collector.settings?.web_link?.enableRecaptcha) {
            console.log('[submitSurveyAnswers] reCAPTCHA is enabled for this web link collector. Verifying token...');
            if (!recaptchaToken) {
                console.warn('[submitSurveyAnswers] reCAPTCHA token not provided.');
                await session.abortTransaction(); session.endSession();
                return res.status(400).json({ success: false, message: 'reCAPTCHA verification is required but token was not provided.' });
            }
            const secretKey = process.env.RECAPTCHA_V2_SECRET_KEY;
            if (!secretKey) {
                console.error("[submitSurveyAnswers] RECAPTCHA_V2_SECRET_KEY is not set in .env file.");
                await session.abortTransaction(); session.endSession();
                return res.status(500).json({ success: false, message: 'reCAPTCHA configuration error on server.' });
            }
            const verificationUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${recaptchaToken}`;
            console.log('[submitSurveyAnswers] Verifying reCAPTCHA with Google...');
            try {
                const recaptchaResponse = await axios.post(verificationUrl);
                const { success: recaptchaSuccess, 'error-codes': errorCodes } = recaptchaResponse.data; // Removed score, action, hostname for v2
                console.log('[submitSurveyAnswers] Google reCAPTCHA response:', JSON.stringify(recaptchaResponse.data, null, 2));
                if (!recaptchaSuccess) {
                    console.warn('[submitSurveyAnswers] reCAPTCHA verification failed with Google. Errors:', errorCodes);
                    await session.abortTransaction(); session.endSession();
                    return res.status(400).json({ success: false, message: 'reCAPTCHA verification failed. Please try again.', errors: errorCodes });
                }
                console.log('reCAPTCHA verification successful.');
            } catch (e) {
                console.error('[submitSurveyAnswers] Error during reCAPTCHA verification request to Google:', e.message);
                await session.abortTransaction(); session.endSession();
                return res.status(500).json({ success: false, message: 'Error verifying reCAPTCHA. Please try again later.' });
            }
        } else {
            console.log('[submitSurveyAnswers] reCAPTCHA is NOT enabled for this collector or not a web_link type.');
        }

        const answersToUpsert = [];
        const questionIdsInPayload = new Set();
        console.log('[submitSurveyAnswers] Processing answersPayload:', JSON.stringify(answersPayload, null, 2));
        for (const item of answersPayload) {
            // <<< --- MODIFICATION START --- >>>
            // Change item.answerValue to item.answer to match payload
            if (!item?.questionId || !mongoose.Types.ObjectId.isValid(item.questionId) || item.answer === undefined) {
            // <<< --- MODIFICATION END --- >>>
                console.log('[submitSurveyAnswers] Skipping invalid answer item (missing questionId or answer value):', JSON.stringify(item, null, 2));
                continue;
            }
            if (questionIdsInPayload.has(String(item.questionId))) {
                const idx = answersToUpsert.findIndex(a => String(a.questionId) === String(item.questionId));
                if (idx > -1) {
                    console.log(`[submitSurveyAnswers] Replacing previous answer for questionId ${item.questionId}`);
                    answersToUpsert.splice(idx, 1);
                }
            }
            questionIdsInPayload.add(String(item.questionId));
            answersToUpsert.push({
                surveyId,
                questionId: item.questionId,
                sessionId: sessionIdToUse,
                // <<< --- MODIFICATION START --- >>>
                answerValue: item.answer, // Use item.answer here
                // <<< --- MODIFICATION END --- >>>
                collectorId: collector._id
            });
        }

        console.log(`[submitSurveyAnswers] Number of valid answers to upsert: ${answersToUpsert.length}`);
        console.log('[submitSurveyAnswers] Validated answersToUpsert:', JSON.stringify(answersToUpsert, null, 2));

        if (answersToUpsert.length > 0) {
            console.log('[submitSurveyAnswers] Attempting Answer.bulkWrite...');
            const bulkWriteResult = await Answer.bulkWrite(answersToUpsert.map(ans => ({
                updateOne: {
                    filter: { surveyId: ans.surveyId, questionId: ans.questionId, sessionId: ans.sessionId },
                    update: { $set: ans }, upsert: true,
                }
            })), { session });
            console.log('[submitSurveyAnswers] Answer.bulkWrite result:', JSON.stringify(bulkWriteResult, null, 2));
            if (bulkWriteResult.hasWriteErrors()) {
                 console.error('[submitSurveyAnswers] BulkWriteError during answer saving:', bulkWriteResult.getWriteErrors());
                 await session.abortTransaction(); session.endSession();
                 return res.status(500).json({ success: false, message: 'Error saving some answers during bulk operation.' });
            }
        } else {
            console.log('[submitSurveyAnswers] No valid answers to save after processing payload.');
        }

        collector.responseCount += 1;
        console.log(`[submitSurveyAnswers] Incrementing collector responseCount to: ${collector.responseCount}`);
        if (collector.settings?.web_link?.maxResponses && collector.responseCount >= collector.settings.web_link.maxResponses) {
            collector.status = 'completed_quota';
            console.log(`[submitSurveyAnswers] Collector status changed to 'completed_quota'.`);
        }
        await collector.save({ session });
        console.log('[submitSurveyAnswers] Collector saved successfully.');

        await session.commitTransaction();
        console.log(`[submitSurveyAnswers] Transaction committed for session ${sessionIdToUse}.`);

        let triggeredAction = null;
        if (survey.globalSkipLogic?.length > 0 && survey.questions) {
            const allSessionAnswers = await Answer.find({ surveyId, sessionId: sessionIdToUse }).lean();
            triggeredAction = evaluateAllLogic(survey.globalSkipLogic, allSessionAnswers, survey.questions);
            if (triggeredAction?.type === 'disqualifyRespondent') {
                console.log(`[submitSurveyAnswers] Respondent disqualified for session ${sessionIdToUse}. Message: ${triggeredAction.disqualificationMessage}`);
                return res.status(200).json({ success: true, message: triggeredAction.disqualificationMessage || 'Disqualified.', action: triggeredAction, sessionId: sessionIdToUse, answersSaved: answersToUpsert.length });
            }
        }
        console.log(`[submitSurveyAnswers] Submission successful for session ${sessionIdToUse}. answersSaved: ${answersToUpsert.length}`);
        res.status(201).json({ success: true, message: 'Answers submitted successfully.', sessionId: sessionIdToUse, answersSaved: answersToUpsert.length, action: triggeredAction });

    } catch (error) {
        console.error(`[submitSurveyAnswers] Error during submission for survey ${surveyId}, session ${sessionIdToUse}:`, error);
        if (session.inTransaction()) {
            console.log('[submitSurveyAnswers] Aborting transaction due to error.');
            await session.abortTransaction();
        }
        if (!res.headersSent) {
            if (error.name === 'ValidationError') return res.status(400).json({ success: false, message: 'Validation Error.', details: error.errors });
            if (error.name === 'BulkWriteError') return res.status(500).json({ success: false, message: 'Error saving some answers.', code: error.code, writeErrors: error.writeErrors?.length });
            res.status(500).json({ success: false, message: 'Error submitting answers.' });
        }
    } finally {
        if (session.hasEnded === false) {
            console.log(`[submitSurveyAnswers] Ending session for ${sessionIdToUse} in finally block.`);
            session.endSession();
        }
    }
};

// @desc    Get survey results (for admin/owner)
exports.getSurveyResults = async (req, res) => {
    const { surveyId } = req.params;
    try {
        const survey = await Survey.findById(surveyId).populate('questions').lean();
        if (!survey) {
            return res.status(404).json({ success: false, message: 'Survey not found for results (post-authorization check).' });
        }
        const answers = await Answer.find({ surveyId }).sort({ sessionId: 1, createdAt: 1 }).lean();

        const resultsBySession = {};
        answers.forEach(answer => {
            if (!resultsBySession[answer.sessionId]) {
                resultsBySession[answer.sessionId] = { sessionId: answer.sessionId, submittedAt: answer.updatedAt || answer.createdAt, answers: {}, collectorId: answer.collectorId };
            }
            const question = survey.questions.find(q => String(q._id) === String(answer.questionId));
            resultsBySession[answer.sessionId].answers[answer.questionId] = {
                questionText: question?.text || 'Unknown', questionType: question?.type || 'unknown', answerValue: answer.answerValue
            };
            if (answer.updatedAt > (resultsBySession[answer.sessionId].submittedAt || 0)) {
                 resultsBySession[answer.sessionId].submittedAt = answer.updatedAt;
            }
            if (!resultsBySession[answer.sessionId].collectorId && answer.collectorId) {
                resultsBySession[answer.sessionId].collectorId = answer.collectorId;
            }
        });
        const formattedResults = Object.values(resultsBySession).sort((a,b) => new Date(a.submittedAt) - new Date(b.submittedAt));
        res.status(200).json({
            success: true,
            surveyTitle: survey.title,
            surveyId: survey._id,
            totalRespondents: formattedResults.length,
            questions: survey.questions,
            results: formattedResults
        });
    } catch (error) {
        console.error(`Error fetching results for ${surveyId}:`, error);
        res.status(500).json({ success: false, message: "Error fetching results" });
    }
};

// @desc    Export survey results (for admin/owner)
exports.exportSurveyResults = async (req, res) => {
    const { surveyId } = req.params;
    try {
        const survey = await Survey.findById(surveyId).populate('questions').lean();
        if (!survey) {
            return res.status(404).json({ success: false, message: 'Survey not found for export (post-authorization check).' });
        }
        const answers = await Answer.find({ surveyId }).sort({ sessionId: 1, createdAt: 1 }).lean();
        if (answers.length === 0) return res.status(200).json({ success: true, message: 'No answers to export.', data: "" });

        const collectorIds = [...new Set(answers.map(a => a.collectorId).filter(Boolean))];
        const collectorsInfo = await Collector.find({ _id: { $in: collectorIds } }).select('name').lean();
        const collectorNameMap = new Map(collectorsInfo.map(c => [String(c._id), c.name]));

        const fields = [
            { label: 'Session ID', value: 'sessionId' },
            { label: 'Submitted At', value: 'submittedAt' },
            { label: 'Collector ID', value: 'collectorId' },
            { label: 'Collector Name', value: 'collectorName' }
        ];
        const questionMap = new Map(survey.questions.map(q => [String(q._id), q]));
        survey.questions.forEach(q => fields.push({ label: q.text || `Q ${q._id}`, value: `answers.${String(q._id)}` }));

        const dataMap = new Map();
        answers.forEach(ans => {
            if (!dataMap.has(ans.sessionId)) {
                dataMap.set(ans.sessionId, {
                    sessionId: ans.sessionId,
                    submittedAt: ans.updatedAt || ans.createdAt,
                    collectorId: ans.collectorId ? String(ans.collectorId) : 'N/A',
                    collectorName: ans.collectorId ? collectorNameMap.get(String(ans.collectorId)) || 'Unknown Collector' : 'N/A',
                    answers: {}
                });
            }
            const sessionData = dataMap.get(ans.sessionId);
            const question = questionMap.get(String(ans.questionId));
            sessionData.answers[String(ans.questionId)] = formatValueForCsv(ans.answerValue, question?.type || 'unknown');
            if (ans.updatedAt > (sessionData.submittedAt || 0)) sessionData.submittedAt = ans.updatedAt;
        });
        const dataForCsv = Array.from(dataMap.values());

        const csv = new Parser({ fields, delimiter: ',', excelStrings: true }).parse(dataForCsv);
        res.header('Content-Type', 'text/csv');
        res.attachment(`survey_${surveyId}_results_${new Date().toISOString().slice(0,10)}.csv`);
        res.send(csv);
    } catch (error) {
        console.error(`Error exporting results for ${surveyId}:`, error);
        res.status(500).json({ success: false, message: "Error exporting results" });
    }
};
// ----- END OF COMPLETE MODIFIED FILE (v1.7 - Corrected answer payload processing) -----