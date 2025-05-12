// backend/controllers/surveyController.js
// ----- START OF COMPLETE MODIFIED FILE (v1.9 - Integrate Response Doc, IP/UserAgent, Anonymity) -----
const mongoose = require('mongoose');
const { Parser } = require('json2csv');
const Survey = require('../models/Survey');
const Question = require('../models/Question');
const Answer = require('../models/Answer');
const Collector = require('../models/Collector');
const Response = require('../models/Response'); // <<<--- ADDED Response model
const { evaluateAllLogic } = require('../utils/logicEvaluator');
const axios = require('axios');

// --- Helper Function for Conjoint Question Type (used in getSurveyById) ---
const generateConjointProfiles = (attributes) => { /* ... (no changes) ... */ };
// --- Helper Function for CSV Export (used in exportSurveyResults) ---
const CSV_SEPARATOR = '; ';
const formatValueForCsv = (value, questionType, otherTextValue) => { /* ... (no changes) ... */ };

// --- Controller Functions ---
exports.getAllSurveys = async (req, res) => { /* ... (no changes) ... */ };
exports.createSurvey = async (req, res) => { /* ... (no changes) ... */ };
exports.getSurveyById = async (req, res) => { /* ... (no changes) ... */ };
exports.updateSurvey = async (req, res) => { /* ... (no changes) ... */ };
exports.deleteSurvey = async (req, res) => { /* ... (no changes) ... */ };


// @desc    Submit answers for a survey
// @route   POST /api/surveys/:surveyId/submit
// @access  Public
exports.submitSurveyAnswers = async (req, res) => {
    const { surveyId } = req.params;
    const { answers: answersPayload, sessionId: payloadSessionId, collectorId, recaptchaToken, startedAt: clientStartedAt } = req.body;

    console.log(`[submitSurveyAnswers] Received submission for surveyId: ${surveyId}, collectorId: ${collectorId}`);
    // console.log('[submitSurveyAnswers] Request body:', JSON.stringify(req.body, null, 2)); // Sensitive, log carefully

    if (!mongoose.Types.ObjectId.isValid(surveyId)) {
        return res.status(400).json({ success: false, message: 'Invalid Survey ID.' });
    }
    if (!Array.isArray(answersPayload)) {
        return res.status(400).json({ success: false, message: 'Answers payload must be an array.' });
    }
    const sessionIdToUse = payloadSessionId || (answersPayload[0]?.sessionId);
    if (!sessionIdToUse) {
        return res.status(400).json({ success: false, message: 'Session ID is required.' });
    }
    if (!collectorId || !mongoose.Types.ObjectId.isValid(collectorId)) {
        return res.status(400).json({ success: false, message: 'Valid Collector ID is required for submission.' });
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    console.log(`[submitSurveyAnswers] Started transaction for session ${sessionIdToUse}`);

    try {
        const survey = await Survey.findById(surveyId).populate('questions').select('+status +globalSkipLogic +questions').session(session);
        if (!survey) {
            await session.abortTransaction(); session.endSession();
            return res.status(404).json({ success: false, message: 'Survey not found.' });
        }
        if (survey.status !== 'active' && survey.status !== 'draft') { // 'draft' for preview submissions
            await session.abortTransaction(); session.endSession();
            return res.status(400).json({ success: false, message: 'This survey is not currently active or accepting responses.' });
        }

        const collector = await Collector.findById(collectorId).select('+settings.web_link.password').session(session); // Ensure password selected if needed later
        if (!collector) {
            await session.abortTransaction(); session.endSession();
            return res.status(404).json({ success: false, message: 'Collector not found.' });
        }
        if (String(collector.survey) !== String(surveyId)) {
            await session.abortTransaction(); session.endSession();
            return res.status(400).json({ success: false, message: 'Collector does not belong to this survey.' });
        }

        // --- Collector Status and Settings Checks (Open/Close Dates, Max Responses) ---
        if (collector.status !== 'open') {
            await session.abortTransaction(); session.endSession();
            return res.status(400).json({ success: false, message: `This survey link is currently ${collector.status}.` });
        }
        const now = new Date();
        const webLinkSettings = collector.settings?.web_link;
        if (webLinkSettings?.openDate && new Date(webLinkSettings.openDate) > now) {
            await session.abortTransaction(); session.endSession();
            return res.status(400).json({ success: false, message: 'This survey is not yet open.' });
        }
        if (webLinkSettings?.closeDate && new Date(webLinkSettings.closeDate) < now) {
            await session.abortTransaction(); session.endSession();
            return res.status(400).json({ success: false, message: 'This survey has closed.' });
        }
        if (webLinkSettings?.maxResponses && collector.responseCount >= webLinkSettings.maxResponses) {
            await session.abortTransaction(); session.endSession();
            return res.status(400).json({ success: false, message: 'This survey has reached its maximum response limit.' });
        }

        // --- reCAPTCHA Verification ---
        if (collector.type === 'web_link' && webLinkSettings?.enableRecaptcha) {
            if (!recaptchaToken) {
                await session.abortTransaction(); session.endSession();
                return res.status(400).json({ success: false, message: 'reCAPTCHA verification is required but token was not provided.' });
            }
            const secretKey = process.env.RECAPTCHA_V2_SECRET_KEY;
            if (!secretKey) {
                console.error("[submitSurveyAnswers] RECAPTCHA_V2_SECRET_KEY is not set.");
                await session.abortTransaction(); session.endSession();
                return res.status(500).json({ success: false, message: 'reCAPTCHA configuration error on server.' });
            }
            const verificationUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${recaptchaToken}&remoteip=${req.ip}`;
            try {
                const recaptchaResponse = await axios.post(verificationUrl);
                if (!recaptchaResponse.data.success) {
                    console.warn('[submitSurveyAnswers] reCAPTCHA verification failed. Errors:', recaptchaResponse.data['error-codes']);
                    await session.abortTransaction(); session.endSession();
                    return res.status(400).json({ success: false, message: 'reCAPTCHA verification failed. Please try again.', errors: recaptchaResponse.data['error-codes'] });
                }
            } catch (e) {
                console.error('[submitSurveyAnswers] Error during reCAPTCHA verification request:', e.message);
                await session.abortTransaction(); session.endSession();
                return res.status(500).json({ success: false, message: 'Error verifying reCAPTCHA.' });
            }
        }

        // --- Process and Save Answers ---
        const answersToUpsert = [];
        const questionIdsInPayload = new Set();
        for (const item of answersPayload) {
            if (!item?.questionId || !mongoose.Types.ObjectId.isValid(item.questionId) || item.answerValue === undefined) continue;
            if (questionIdsInPayload.has(String(item.questionId))) {
                const idx = answersToUpsert.findIndex(a => String(a.questionId) === String(item.questionId));
                if (idx > -1) answersToUpsert.splice(idx, 1);
            }
            questionIdsInPayload.add(String(item.questionId));
            answersToUpsert.push({
                surveyId,
                questionId: item.questionId,
                sessionId: sessionIdToUse,
                answerValue: item.answerValue,
                otherText: item.otherText || null,
                collectorId: collector._id
            });
        }

        if (answersToUpsert.length > 0) {
            const bulkWriteResult = await Answer.bulkWrite(answersToUpsert.map(ans => ({
                updateOne: {
                    filter: { surveyId: ans.surveyId, questionId: ans.questionId, sessionId: ans.sessionId, collectorId: ans.collectorId },
                    update: { $set: ans }, upsert: true,
                }
            })), { session });
            if (bulkWriteResult.hasWriteErrors()) {
                 console.error('[submitSurveyAnswers] BulkWriteError during answer saving:', bulkWriteResult.getWriteErrors());
                 await session.abortTransaction(); session.endSession();
                 return res.status(500).json({ success: false, message: 'Error saving some answers.' });
            }
        }

        // --- Create or Update Response Document ---
        const responseData = {
            survey: surveyId,
            collector: collectorId,
            sessionId: sessionIdToUse,
            status: 'completed', // Default to completed, can be updated by logic
            submittedAt: new Date(),
            lastActivityAt: new Date(),
            // customVariables: parsedCustomVariables, // If you implement custom variables
        };
        if (clientStartedAt && !isNaN(new Date(clientStartedAt).getTime())) {
            responseData.startedAt = new Date(clientStartedAt);
        } else {
            // If clientStartedAt is not provided or invalid, startedAt will default on creation or remain unchanged on update
            // For updates, we might want to set it only if it's a new document.
            // $setOnInsert can be used with findOneAndUpdate for this if startedAt is not in responseData.
        }

        // Conditionally add IP and User Agent
        if (!webLinkSettings?.anonymousResponses) {
            responseData.ipAddress = req.ip; // Express req.ip, ensure 'trust proxy' is set if behind load balancer
            responseData.userAgent = req.headers['user-agent'];
        } else {
            // Ensure these fields are explicitly nulled or unset if previously set and now anonymous
            responseData.ipAddress = undefined; // Or null, depending on schema strictness
            responseData.userAgent = undefined; // Or null
        }
        
        // Upsert the Response document
        const updatedResponse = await Response.findOneAndUpdate(
            { survey: surveyId, collector: collectorId, sessionId: sessionIdToUse },
            { $set: responseData, $setOnInsert: { startedAt: responseData.startedAt || new Date() } }, // $setOnInsert for startedAt only on creation
            { new: true, upsert: true, runValidators: true, session }
        );
        console.log(`[submitSurveyAnswers] Response document upserted/updated: ${updatedResponse._id}`);


        // --- Update Collector Response Count ---
        // Only increment if this is a new "completed" response for this session
        // This logic might need refinement if partials can also increment counts or if a session can be re-submitted.
        // For now, we assume each successful submission to this endpoint is a new countable response.
        collector.responseCount += 1;
        if (webLinkSettings?.maxResponses && collector.responseCount >= webLinkSettings.maxResponses) {
            collector.status = 'completed_quota';
        }
        await collector.save({ session });

        await session.commitTransaction();
        console.log(`[submitSurveyAnswers] Transaction committed for session ${sessionIdToUse}.`);

        // --- Post-Submission Logic (Disqualification, etc.) ---
        let triggeredAction = null;
        if (survey.globalSkipLogic?.length > 0 && survey.questions) {
            const allSessionAnswers = await Answer.find({ surveyId, sessionId: sessionIdToUse }).lean(); // No session needed for read after commit
            triggeredAction = evaluateAllLogic(survey.globalSkipLogic, allSessionAnswers, survey.questions);
            if (triggeredAction?.type === 'disqualifyRespondent') {
                // Update Response status to 'disqualified' (outside transaction or in a new one if critical)
                await Response.updateOne({ _id: updatedResponse._id }, { $set: { status: 'disqualified' } });
                return res.status(200).json({ success: true, message: triggeredAction.disqualificationMessage || 'Disqualified.', action: triggeredAction, sessionId: sessionIdToUse, responseId: updatedResponse._id });
            }
        }
        
        res.status(201).json({ success: true, message: 'Answers submitted successfully.', sessionId: sessionIdToUse, responseId: updatedResponse._id, action: triggeredAction });

    } catch (error) {
        console.error(`[submitSurveyAnswers] Error during submission for survey ${surveyId}, session ${sessionIdToUse}:`, error);
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        if (!res.headersSent) {
            if (error.name === 'ValidationError') return res.status(400).json({ success: false, message: 'Validation Error.', details: error.errors });
            if (error.code === 11000) { // Handle unique index violation (e.g., for Response doc)
                 return res.status(409).json({ success: false, message: 'Duplicate submission detected or session conflict.', details: error.keyValue });
            }
            res.status(500).json({ success: false, message: 'Error submitting answers.' });
        }
    } finally {
        if (session.hasEnded === false) {
            session.endSession();
        }
    }
};

exports.getSurveyResults = async (req, res) => { /* ... (no changes, but could be enhanced to pull from Response docs too) ... */ };
exports.exportSurveyResults = async (req, res) => { /* ... (no changes, but could be enhanced) ... */ };
// ----- END OF COMPLETE MODIFIED FILE (v1.9) -----