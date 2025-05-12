// backend/controllers/surveyController.js
// ----- START OF COMPLETE MODIFIED FILE (vNext2 - Debug Population in getSurveyById & startedAt fix) -----
const mongoose = require('mongoose');
const { Parser } = require('json2csv');
const Survey = require('../models/Survey');
const Question = require('../models/Question');
const Answer = require('../models/Answer');
const Collector = require('../models/Collector');
const Response = require('../models/Response');
const { evaluateAllLogic } = require('../utils/logicEvaluator');
const axios = require('axios');

// --- Helper Function for Conjoint Question Type (used in getSurveyById) ---
const generateConjointProfiles = (attributes) => {
    if (!attributes || attributes.length === 0) return [];
    console.warn("[generateConjointProfiles] Placeholder function used. Needs full implementation.");
    return [];
};

// --- Helper Function for CSV Export (used in exportSurveyResults) ---
const CSV_SEPARATOR = '; ';
const formatValueForCsv = (value, questionType, otherTextValue) => {
    if (value === null || value === undefined) return '';
    switch (questionType) {
        case 'multiple-choice':
        case 'dropdown':
        case 'nps':
        case 'rating':
        case 'slider':
            if (value === '__OTHER__' && otherTextValue) return `Other: ${otherTextValue}`;
            return String(value);
        case 'checkbox':
            if (Array.isArray(value) && value.length > 0) {
                const options = value.filter(v => v !== '__OTHER__').map(v => String(v)).join(CSV_SEPARATOR);
                const otherIsSelected = value.includes('__OTHER__');
                if (otherIsSelected && otherTextValue) return options ? `${options}${CSV_SEPARATOR}Other: ${otherTextValue}` : `Other: ${otherTextValue}`;
                return options;
            }
            return '';
        case 'matrix':
            if (typeof value === 'object' && value !== null && Object.keys(value).length > 0) {
                return Object.entries(value).map(([row, colValue]) => `${row}: ${Array.isArray(colValue) ? colValue.join(', ') : String(colValue)}`).join(CSV_SEPARATOR);
            }
            return '';
        case 'date':
            try { return new Date(value).toLocaleDateString('en-CA'); } catch (e) { return String(value); }
        case 'file_upload':
            if (Array.isArray(value)) return value.map(file => file.url || file.name).join(CSV_SEPARATOR);
            if (typeof value === 'object' && value !== null) return value.url || value.name || '';
            return '';
        case 'cardsort':
            if (typeof value === 'object' && value !== null && value.assignments) return JSON.stringify(value);
            return '';
        default:
            if (Array.isArray(value)) return value.join(CSV_SEPARATOR);
            if (typeof value === 'object' && value !== null) return JSON.stringify(value);
            return String(value);
    }
};

// --- Controller Functions ---

exports.getAllSurveys = async (req, res) => {
    const requestStartTime = Date.now();
    console.log(`[${new Date().toISOString()}] [getAllSurveys] Entered. User ID: ${req.user?.id}, Role: ${req.user?.role}`);
    try {
        const filter = {};
        if (req.user && req.user.id) {
            filter.createdBy = req.user.id;
            if (req.user.role === 'admin') delete filter.createdBy;
        } else {
            console.error(`[${new Date().toISOString()}] [getAllSurveys] CRITICAL: req.user or req.user.id is undefined.`);
            return res.status(401).json({ success: false, message: "Authentication details missing or invalid." });
        }
        console.log(`[${new Date().toISOString()}] [getAllSurveys] Using filter: ${JSON.stringify(filter)}`);
        const queryStartTime = Date.now();
        const surveys = await Survey.find(filter).select('-questions -globalSkipLogic -settings -randomizationLogic -collectors').sort({ createdAt: -1 });
        const queryEndTime = Date.now();
        console.log(`[${new Date().toISOString()}] [getAllSurveys] Survey.find() executed in ${queryEndTime - queryStartTime}ms. Found ${surveys ? surveys.length : 'null/undefined'} surveys.`);
        if (!surveys) {
            console.error(`[${new Date().toISOString()}] [getAllSurveys] Surveys array is unexpectedly null or undefined.`);
            if (!res.headersSent) return res.status(500).json({ success: false, message: "Error fetching surveys: Data became unavailable post-query." });
            return;
        }
        if (!res.headersSent) {
            res.status(200).json({ success: true, count: surveys.length, data: surveys });
            console.log(`[${new Date().toISOString()}] [getAllSurveys] Response sent successfully. Total request time: ${Date.now() - requestStartTime}ms.`);
        } else console.warn(`[${new Date().toISOString()}] [getAllSurveys] Headers already sent.`);
    } catch (error) {
        console.error(`[${new Date().toISOString()}] [getAllSurveys] CRITICAL ERROR. Total request time: ${Date.now() - requestStartTime}ms. Error: ${error.message}`, error.stack);
        if (!res.headersSent) res.status(500).json({ success: false, message: "Critical error fetching surveys on the server." });
        else console.warn(`[${new Date().toISOString()}] [getAllSurveys] Headers already sent when trying to send error response.`);
    }
};

exports.createSurvey = async (req, res) => {
    const { title, description, category, settings, welcomeMessage, thankYouMessage } = req.body;
    try {
        const newSurvey = new Survey({
            title: title || 'Untitled Survey', description, category, createdBy: req.user.id, status: 'draft',
            settings: settings || {},
            welcomeMessage: welcomeMessage || { text: "Welcome to the survey!" },
            thankYouMessage: thankYouMessage || { text: "Thank you for completing the survey!" },
        });
        const savedSurvey = await newSurvey.save();
        res.status(201).json({ success: true, message: 'Survey created successfully.', data: savedSurvey });
    } catch (error) {
        console.error('[createSurvey] Error creating survey:', error);
        if (error.name === 'ValidationError') return res.status(400).json({ success: false, message: 'Validation Error', details: error.errors });
        res.status(500).json({ success: false, message: 'Error creating survey.' });
    }
};

// @desc    Get a single survey by ID
// @route   GET /api/surveys/:surveyId
// @access  Private (Owner or Admin for full details, Public for active survey structure)
exports.getSurveyById = async (req, res) => {
    const { surveyId } = req.params;
    const { forTaking, collectorId } = req.query;

    // ++ ADDED LOGGING HERE ++
    console.log(`[Backend - getSurveyById] Attempting to fetch survey ${surveyId}. forTaking: ${forTaking}, collectorId: ${collectorId}`);

    if (!mongoose.Types.ObjectId.isValid(surveyId)) {
        console.log(`[Backend - getSurveyById] Invalid Survey ID format: ${surveyId}`);
        return res.status(400).json({ success: false, message: 'Invalid Survey ID.' });
    }

    try {
        let surveyQuery = Survey.findById(surveyId);

        if (forTaking === 'true') {
            // ++ ADDED LOGGING HERE ++
            console.log(`[Backend - getSurveyById] Preparing query for respondent (forTaking=true).`);
            surveyQuery = surveyQuery
                .select('title description welcomeMessage thankYouMessage status questions settings.surveyWide.allowRetakes settings.surveyWide.showProgressBar settings.surveyWide.customCSS globalSkipLogic randomizationLogic')
                .populate({
                    path: 'questions',
                    // Temporarily remove 'select' from populate to ensure full question objects are fetched for debugging
                    // select: '-survey -createdBy -updatedAt -__v -analytics', // Original select, re-add if population works
                    options: { sort: { order: 1 } }
                });
            console.log(`[Backend - getSurveyById] Survey query with population for 'questions' configured (no specific select on questions).`);
        } else {
            console.log(`[Backend - getSurveyById] Preparing query for admin/owner view.`);
            surveyQuery = surveyQuery.populate({
                path: 'questions',
                options: { sort: { order: 1 } }
            }).populate('collectors');
        }

        const survey = await surveyQuery;
        console.log(`[Backend - getSurveyById] surveyQuery executed. Survey found: ${!!survey}`);

        if (!survey) {
            console.log(`[Backend - getSurveyById] Survey with ID ${surveyId} not found in database.`);
            return res.status(404).json({ success: false, message: 'Survey not found.' });
        }

        // ++ ADDED DETAILED LOGGING for questions array AFTER population attempt ++
        if (survey.questions && survey.questions.length > 0) {
            console.log(`[Backend - getSurveyById] Survey questions count: ${survey.questions.length}`);
            console.log(`[Backend - getSurveyById] First question (raw from survey object after populate):`, JSON.stringify(survey.questions[0], null, 2));
            console.log(`[Backend - getSurveyById] Type of first question: ${typeof survey.questions[0]}`);
            if (typeof survey.questions[0] === 'object' && survey.questions[0] !== null) {
                console.log(`[Backend - getSurveyById] 'type' property of first question: ${survey.questions[0].type}`);
            } else {
                console.log(`[Backend - getSurveyById] First question is not an object or is null.`);
            }
        } else {
            console.log(`[Backend - getSurveyById] Survey has no questions or questions array is empty after population attempt.`);
        }


        // Authorization Check:
        if (forTaking !== 'true' && req.user && String(survey.createdBy) !== String(req.user.id) && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'You are not authorized to view this survey\'s details.' });
        }

        if (forTaking === 'true') {
            const isOwnerPreviewingDraft = survey.status === 'draft' && req.user && String(survey.createdBy) === String(req.user.id);
            if (survey.status !== 'active' && !isOwnerPreviewingDraft) {
                 return res.status(403).json({ success: false, message: 'This survey is not currently active.' });
            }
            if (collectorId) {
                if (!mongoose.Types.ObjectId.isValid(collectorId)) return res.status(400).json({ success: false, message: 'Invalid Collector ID.' });
                const collector = await Collector.findById(collectorId);
                if (!collector || String(collector.survey) !== String(survey._id)) return res.status(404).json({ success: false, message: 'Collector not found or invalid.' });
                if (collector.status !== 'open' && !isOwnerPreviewingDraft) return res.status(403).json({ success: false, message: `Link is ${collector.status}.` });
                if (collector.type === 'web_link' && collector.settings?.web_link?.enablePassword) {
                    const providedPassword = req.headers['x-survey-password'];
                    if (!providedPassword || providedPassword !== collector.settings.web_link.password) {
                        return res.status(401).json({ success: false, message: 'Password required.', requiresPassword: true });
                    }
                }
            } else if (!isOwnerPreviewingDraft && survey.status === 'draft') {
                return res.status(403).json({ success: false, message: 'Survey is in draft mode.' });
            }
        }
        
        // Ensure questions are plain JS objects before sending to client
        let processedQuestions = survey.questions || [];
        if (Array.isArray(processedQuestions)) {
            processedQuestions = processedQuestions.map(q => {
                let questionObject = (q && typeof q.toObject === 'function') ? q.toObject() : q; // Handle Mongoose docs vs plain objects
                if (questionObject && questionObject.type === 'conjoint' && questionObject.conjointAttributes) {
                    const profiles = generateConjointProfiles(questionObject.conjointAttributes);
                    return { ...questionObject, generatedProfiles: profiles };
                }
                return questionObject; // Return the plain object
            });
        }
        
        const surveyResponseData = (survey && typeof survey.toObject === 'function') ? survey.toObject() : { ...survey };
        if (surveyResponseData) {
            surveyResponseData.questions = processedQuestions; // Replace with processed questions
        }

        res.status(200).json({ success: true, data: surveyResponseData });
    } catch (error) {
        console.error(`[Backend - getSurveyById] Error fetching survey ${surveyId}:`, error);
        res.status(500).json({ success: false, message: 'Error fetching survey.' });
    }
};

exports.updateSurvey = async (req, res) => {
    const { surveyId } = req.params;
    const updates = req.body;
    if (!mongoose.Types.ObjectId.isValid(surveyId)) return res.status(400).json({ success: false, message: 'Invalid Survey ID.' });
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const survey = await Survey.findById(surveyId).session(session);
        if (!survey) { await session.abortTransaction(); session.endSession(); return res.status(404).json({ success: false, message: 'Survey not found.' }); }
        if (req.user && String(survey.createdBy) !== String(req.user.id) && req.user.role !== 'admin') {
            await session.abortTransaction(); session.endSession(); return res.status(403).json({ success: false, message: 'Not authorized.' });
        }
        if (updates.questions && Array.isArray(updates.questions)) {
            const existingQuestionIds = survey.questions.map(id => String(id));
            const incomingQuestionIds = [];
            for (const qData of updates.questions) {
                if (qData._id && mongoose.Types.ObjectId.isValid(qData._id)) {
                    await Question.updateOne({ _id: qData._id, survey: survey._id }, { $set: qData }, { session });
                    incomingQuestionIds.push(String(qData._id));
                } else {
                    const newQuestionData = { ...qData, survey: survey._id, createdBy: req.user.id };
                    delete newQuestionData._id;
                    const savedNewQ = await new Question(newQuestionData).save({ session });
                    incomingQuestionIds.push(String(savedNewQ._id));
                }
            }
            const questionsToDelete = existingQuestionIds.filter(id => !incomingQuestionIds.includes(id));
            if (questionsToDelete.length > 0) {
                await Question.deleteMany({ _id: { $in: questionsToDelete }, survey: survey._id }, { session });
                await Answer.deleteMany({ questionId: { $in: questionsToDelete }, surveyId: survey._id }, { session });
            }
            survey.questions = incomingQuestionIds.map(id => new mongoose.Types.ObjectId(id));
            delete updates.questions;
        }
        Object.keys(updates).forEach(key => { if (key !== '_id' && key !== 'createdBy' && key !== 'questions') survey[key] = updates[key]; });
        survey.updatedAt = Date.now();
        const updatedSurvey = await survey.save({ session });
        await session.commitTransaction();
        session.endSession();
        const populatedSurvey = await Survey.findById(updatedSurvey._id).populate({ path: 'questions', options: { sort: { order: 1 } } });
        res.status(200).json({ success: true, message: 'Survey updated.', data: populatedSurvey });
    } catch (error) {
        await session.abortTransaction(); session.endSession();
        console.error(`[updateSurvey] Error:`, error);
        if (error.name === 'ValidationError') return res.status(400).json({ success: false, message: 'Validation Error', details: error.errors });
        res.status(500).json({ success: false, message: 'Error updating survey.' });
    }
};

exports.deleteSurvey = async (req, res) => {
    const { surveyId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(surveyId)) return res.status(400).json({ success: false, message: 'Invalid Survey ID.' });
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const survey = await Survey.findById(surveyId).session(session);
        if (!survey) { await session.abortTransaction(); session.endSession(); return res.status(404).json({ success: false, message: 'Survey not found.' }); }
        if (req.user && String(survey.createdBy) !== String(req.user.id) && req.user.role !== 'admin') {
            await session.abortTransaction(); session.endSession(); return res.status(403).json({ success: false, message: 'Not authorized.' });
        }
        await Question.deleteMany({ survey: survey._id }, { session });
        await Answer.deleteMany({ surveyId: survey._id }, { session });
        await Collector.deleteMany({ survey: survey._id }, { session });
        await Response.deleteMany({ survey: survey._id }, { session });
        await Survey.deleteOne({ _id: survey._id }, { session });
        await session.commitTransaction();
        session.endSession();
        res.status(200).json({ success: true, message: 'Survey deleted.' });
    } catch (error) {
        await session.abortTransaction(); session.endSession();
        console.error(`[deleteSurvey] Error:`, error);
        res.status(500).json({ success: false, message: 'Error deleting survey.' });
    }
};

exports.submitSurveyAnswers = async (req, res) => {
    const { surveyId } = req.params;
    const { answers: answersPayload, sessionId: payloadSessionId, collectorId, recaptchaToken, startedAt: clientStartedAt } = req.body;
    console.log(`[submitSurveyAnswers] Received submission for surveyId: ${surveyId}, collectorId: ${collectorId}`);
    if (!mongoose.Types.ObjectId.isValid(surveyId)) return res.status(400).json({ success: false, message: 'Invalid Survey ID.' });
    if (!Array.isArray(answersPayload)) return res.status(400).json({ success: false, message: 'Answers must be an array.' });
    const sessionIdToUse = payloadSessionId;
    if (!sessionIdToUse) return res.status(400).json({ success: false, message: 'Session ID required.' });
    if (!collectorId || !mongoose.Types.ObjectId.isValid(collectorId)) return res.status(400).json({ success: false, message: 'Valid Collector ID required.' });

    const mongoSession = await mongoose.startSession(); // Renamed to avoid conflict
    mongoSession.startTransaction();
    console.log(`[submitSurveyAnswers] Started transaction for session ${sessionIdToUse}`);
    try {
        const survey = await Survey.findById(surveyId).populate('questions').select('+status +globalSkipLogic').session(mongoSession); // Removed +questions from select as it's populated
        if (!survey) { await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(404).json({ success: false, message: 'Survey not found.' }); }
        const isOwnerPreviewingDraft = survey.status === 'draft' && req.user && String(survey.createdBy) === String(req.user.id);
        if (survey.status !== 'active' && !isOwnerPreviewingDraft) {
            await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(400).json({ success: false, message: 'Survey not active.' });
        }
        const collector = await Collector.findById(collectorId).select('+settings.web_link.password').session(mongoSession);
        if (!collector) { await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(404).json({ success: false, message: 'Collector not found.' }); }
        if (String(collector.survey) !== String(surveyId)) { await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(400).json({ success: false, message: 'Collector mismatch.' }); }
        if (collector.status !== 'open' && !isOwnerPreviewingDraft) { await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(400).json({ success: false, message: `Link is ${collector.status}.` }); }
        const now = new Date(); const webLinkSettings = collector.settings?.web_link;
        if (webLinkSettings?.openDate && new Date(webLinkSettings.openDate) > now && !isOwnerPreviewingDraft) { await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(400).json({ success: false, message: 'Survey not yet open.' }); }
        if (webLinkSettings?.closeDate && new Date(webLinkSettings.closeDate) < now && !isOwnerPreviewingDraft) { await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(400).json({ success: false, message: 'Survey closed.' }); }
        if (webLinkSettings?.maxResponses && collector.responseCount >= webLinkSettings.maxResponses && !isOwnerPreviewingDraft) { await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(400).json({ success: false, message: 'Max responses reached.' }); }
        if (collector.type === 'web_link' && webLinkSettings?.enableRecaptcha && !isOwnerPreviewingDraft) {
            if (!recaptchaToken) { await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(400).json({ success: false, message: 'reCAPTCHA required.' }); }
            const secretKey = process.env.RECAPTCHA_V2_SECRET_KEY;
            if (!secretKey) { console.error("[submitSurveyAnswers] RECAPTCHA_V2_SECRET_KEY not set."); await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(500).json({ success: false, message: 'reCAPTCHA config error.' }); }
            const verificationUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${recaptchaToken}&remoteip=${req.ip}`;
            try {
                const recaptchaResponse = await axios.post(verificationUrl);
                if (!recaptchaResponse.data.success) { console.warn('[submitSurveyAnswers] reCAPTCHA failed:', recaptchaResponse.data['error-codes']); await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(400).json({ success: false, message: 'reCAPTCHA verification failed.', errors: recaptchaResponse.data['error-codes'] }); }
            } catch (e) { console.error('[submitSurveyAnswers] reCAPTCHA request error:', e.message); await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(500).json({ success: false, message: 'Error verifying reCAPTCHA.' }); }
        }
        const answersToUpsert = []; const questionIdsInPayload = new Set();
        for (const item of answersPayload) {
            if (!item?.questionId || !mongoose.Types.ObjectId.isValid(item.questionId) || item.answerValue === undefined) continue;
            if (questionIdsInPayload.has(String(item.questionId))) { const idx = answersToUpsert.findIndex(a => String(a.questionId) === String(item.questionId)); if (idx > -1) answersToUpsert.splice(idx, 1); }
            questionIdsInPayload.add(String(item.questionId));
            answersToUpsert.push({ surveyId, questionId: item.questionId, sessionId: sessionIdToUse, answerValue: item.answerValue, otherText: item.otherText || null, collectorId: collector._id });
        }
        if (answersToUpsert.length > 0) {
            const bulkWriteResult = await Answer.bulkWrite(answersToUpsert.map(ans => ({ updateOne: { filter: { surveyId: ans.surveyId, questionId: ans.questionId, sessionId: ans.sessionId, collectorId: ans.collectorId }, update: { $set: ans }, upsert: true, } })), { session: mongoSession });
            if (bulkWriteResult.hasWriteErrors()) { console.error('[submitSurveyAnswers] BulkWriteError:', bulkWriteResult.getWriteErrors()); await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(500).json({ success: false, message: 'Error saving answers.' }); }
        }
        const responseUpdateData = { status: 'completed', submittedAt: new Date(), lastActivityAt: new Date() };
        if (!webLinkSettings?.anonymousResponses) { responseUpdateData.ipAddress = req.ip; responseUpdateData.userAgent = req.headers['user-agent']; }
        else { responseUpdateData.ipAddress = undefined; responseUpdateData.userAgent = undefined; }
        const responseSetOnInsertData = { survey: surveyId, collector: collectorId, sessionId: sessionIdToUse, startedAt: (clientStartedAt && !isNaN(new Date(clientStartedAt).getTime())) ? new Date(clientStartedAt) : new Date() };
        if (!webLinkSettings?.anonymousResponses && responseSetOnInsertData.ipAddress === undefined) responseSetOnInsertData.ipAddress = req.ip;
        if (!webLinkSettings?.anonymousResponses && responseSetOnInsertData.userAgent === undefined) responseSetOnInsertData.userAgent = req.headers['user-agent'];
        const updatedResponse = await Response.findOneAndUpdate({ survey: surveyId, collector: collectorId, sessionId: sessionIdToUse }, { $set: responseUpdateData, $setOnInsert: responseSetOnInsertData }, { new: true, upsert: true, runValidators: true, session: mongoSession });
        console.log(`[submitSurveyAnswers] Response document upserted/updated: ${updatedResponse._id}`);
        if (!isOwnerPreviewingDraft) {
            const collectorUpdateResult = await Collector.updateOne({ _id: collectorId }, { $inc: { responseCount: 1 } }, { session: mongoSession });
            if (collectorUpdateResult.modifiedCount > 0) { // Check if responseCount was actually incremented
                const updatedCollector = await Collector.findById(collectorId).session(mongoSession);
                if (webLinkSettings?.maxResponses && updatedCollector.responseCount >= webLinkSettings.maxResponses) {
                    updatedCollector.status = 'completed_quota';
                    await updatedCollector.save({ session: mongoSession });
                }
            }
        }
        await mongoSession.commitTransaction();
        console.log(`[submitSurveyAnswers] Transaction committed for session ${sessionIdToUse}.`);
        let triggeredAction = null;
        if (survey.globalSkipLogic?.length > 0 && survey.questions) {
            const allSessionAnswers = await Answer.find({ surveyId, sessionId: sessionIdToUse }).lean();
            triggeredAction = evaluateAllLogic(survey.globalSkipLogic, allSessionAnswers, survey.questions);
            if (triggeredAction?.type === 'disqualifyRespondent') {
                await Response.updateOne({ _id: updatedResponse._id }, { $set: { status: 'disqualified' } }); // No session needed, main transaction committed
                return res.status(200).json({ success: true, message: triggeredAction.disqualificationMessage || 'Disqualified.', action: triggeredAction, sessionId: sessionIdToUse, responseId: updatedResponse._id });
            }
        }
        res.status(201).json({ success: true, message: 'Answers submitted.', sessionId: sessionIdToUse, responseId: updatedResponse._id, action: triggeredAction });
    } catch (error) {
        console.error(`[submitSurveyAnswers] Error for survey ${surveyId}, session ${sessionIdToUse}:`, error);
        if (mongoSession.inTransaction()) {
            try { await mongoSession.abortTransaction(); console.log(`[submitSurveyAnswers] Transaction aborted.`); }
            catch (abortError) { console.error(`[submitSurveyAnswers] Error aborting transaction:`, abortError); }
        }
        if (!res.headersSent) {
            if (error.name === 'ValidationError') return res.status(400).json({ success: false, message: 'Validation Error.', details: error.errors });
            if (error.code === 11000) return res.status(409).json({ success: false, message: 'Duplicate submission or conflict.', details: error.keyValue });
            res.status(500).json({ success: false, message: error.message || 'Error submitting answers.' });
        }
    } finally {
        if (mongoSession.hasEnded === false) mongoSession.endSession();
    }
};

exports.getSurveyResults = async (req, res) => {
    const { surveyId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(surveyId)) return res.status(400).json({ success: false, message: 'Invalid Survey ID.' });
    try {
        const survey = await Survey.findById(surveyId).populate({ path: 'questions', options: { sort: { order: 1 } } });
        if (!survey) return res.status(404).json({ success: false, message: 'Survey not found.' });
        if (req.user && String(survey.createdBy) !== String(req.user.id) && req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Not authorized.' });
        const responses = await Response.find({ survey: surveyId, status: { $in: ['completed', 'disqualified'] } }).select('sessionId status submittedAt startedAt ipAddress userAgent customVariables');
        const sessionIds = responses.map(r => r.sessionId);
        const answers = await Answer.find({ surveyId: survey._id, sessionId: { $in: sessionIds } }).populate('questionId', 'text type options matrixRows matrixColumns');
        const results = {
            surveyTitle: survey.title, totalResponses: responses.length,
            responsesSummary: responses.map(r => ({ responseId: r._id, sessionId: r.sessionId, status: r.status, submittedAt: r.submittedAt, startedAt: r.startedAt, duration: r.startedAt && r.submittedAt ? (new Date(r.submittedAt).getTime() - new Date(r.startedAt).getTime()) / 1000 : null, ipAddress: r.ipAddress, userAgent: r.userAgent, })),
            questions: survey.questions.map(q => {
                const questionAnswers = answers.filter(a => a.questionId && String(a.questionId._id) === String(q._id));
                let aggregatedAnswers = {};
                if (['multiple-choice', 'dropdown', 'nps', 'rating'].includes(q.type)) {
                    aggregatedAnswers.optionsCount = {};
                    questionAnswers.forEach(ans => { const key = ans.otherText ? `Other: ${ans.otherText}` : String(ans.answerValue); aggregatedAnswers.optionsCount[key] = (aggregatedAnswers.optionsCount[key] || 0) + 1; });
                } else if (q.type === 'checkbox') {
                    aggregatedAnswers.optionsCount = {};
                    questionAnswers.forEach(ans => { ensureArray(ans.answerValue).forEach(val => { const key = val === '__OTHER__' && ans.otherText ? `Other: ${ans.otherText}` : String(val); aggregatedAnswers.optionsCount[key] = (aggregatedAnswers.optionsCount[key] || 0) + 1; }); });
                } else aggregatedAnswers.raw = questionAnswers.map(a => ({ value: a.answerValue, other: a.otherText, sessionId: a.sessionId }));
                return { questionId: q._id, text: q.text, type: q.type, order: q.order, responsesCount: questionAnswers.length, answers: aggregatedAnswers, };
            }),
        };
        res.status(200).json({ success: true, data: results });
    } catch (error) {
        console.error(`[getSurveyResults] Error for survey ${surveyId}:`, error);
        res.status(500).json({ success: false, message: 'Error fetching results.' });
    }
};

exports.exportSurveyResults = async (req, res) => {
    const { surveyId } = req.params;
    const { collectorId } = req.query;
    if (!mongoose.Types.ObjectId.isValid(surveyId)) return res.status(400).json({ success: false, message: 'Invalid Survey ID.' });
    try {
        const survey = await Survey.findById(surveyId).populate({ path: 'questions', options: { sort: { order: 1 } } });
        if (!survey) return res.status(404).json({ success: false, message: 'Survey not found.' });
        if (req.user && String(survey.createdBy) !== String(req.user.id) && req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Not authorized.' });
        const responseQueryConditions = { survey: surveyId, status: { $in: ['completed', 'disqualified'] } };
        if (collectorId && mongoose.Types.ObjectId.isValid(collectorId)) responseQueryConditions.collector = collectorId;
        const responses = await Response.find(responseQueryConditions).sort({ submittedAt: 1 }).lean();
        if (responses.length === 0) return res.status(404).json({ success: false, message: 'No responses found.' });
        const sessionIds = responses.map(r => r.sessionId);
        const allAnswersForResponses = await Answer.find({ surveyId: survey._id, sessionId: { $in: sessionIds } }).lean();
        const fields = [ { label: 'Response ID', value: 'responseId' }, { label: 'Session ID', value: 'sessionId' }, { label: 'Status', value: 'status' }, { label: 'Started At', value: 'startedAt' }, { label: 'Submitted At', value: 'submittedAt' }, { label: 'Duration (seconds)', value: 'duration' }, { label: 'IP Address', value: 'ipAddress' }, { label: 'User Agent', value: 'userAgent' }, ];
        survey.questions.forEach(q => {
            fields.push({ label: `${q.text || `Q${q.order + 1}`} (ID: ${q._id})`, value: `q_${q._id}` });
            if (q.addOtherOption) fields.push({ label: `${q.text || `Q${q.order + 1}`} - Other Text`, value: `q_${q._id}_other` });
        });
        const csvData = responses.map(responseDoc => {
            const row = { responseId: responseDoc._id.toString(), sessionId: responseDoc.sessionId, status: responseDoc.status, startedAt: responseDoc.startedAt ? new Date(responseDoc.startedAt).toISOString() : '', submittedAt: responseDoc.submittedAt ? new Date(responseDoc.submittedAt).toISOString() : '', duration: responseDoc.startedAt && responseDoc.submittedAt ? (new Date(responseDoc.submittedAt).getTime() - new Date(responseDoc.startedAt).getTime()) / 1000 : '', ipAddress: responseDoc.ipAddress || '', userAgent: responseDoc.userAgent || '', };
            const respondentAnswers = allAnswersForResponses.filter(ans => ans.sessionId === responseDoc.sessionId);
            survey.questions.forEach(q => {
                const answer = respondentAnswers.find(a => String(a.questionId) === String(q._id));
                if (answer) {
                    row[`q_${q._id}`] = formatValueForCsv(answer.answerValue, q.type, answer.otherText);
                    if (q.addOtherOption) row[`q_${q._id}_other`] = answer.otherText || '';
                } else {
                    row[`q_${q._id}`] = ''; if (q.addOtherOption) row[`q_${q._id}_other`] = '';
                }
            });
            return row;
        });
        const json2csvParser = new Parser({ fields, delimiter: ',', header: true });
        const csv = json2csvParser.parse(csvData);
        res.header('Content-Type', 'text/csv');
        res.attachment(`survey_${surveyId}_results_${new Date().toISOString().split('T')[0]}.csv`);
        res.send(csv);
    } catch (error) {
        console.error(`[exportSurveyResults] Error for survey ${surveyId}:`, error);
        if (!res.headersSent) res.status(500).json({ success: false, message: 'Error exporting results.' });
    }
};
// ----- END OF COMPLETE MODIFIED FILE (vNext2 - Debug Population in getSurveyById & startedAt fix) -----