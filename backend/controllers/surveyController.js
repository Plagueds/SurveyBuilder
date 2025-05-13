// backend/controllers/surveyController.js
// ----- START OF COMPLETE MODIFIED FILE (vNext7 - Robust Checkbox in getSurveyResults) -----
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
    return [];
};

// --- Helper Function for CSV Export (used in exportSurveyResults) ---
const CSV_SEPARATOR = '; ';
const ensureArrayForCsv = (val) => (Array.isArray(val) ? val : (val !== undefined && val !== null ? [String(val)] : []));

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
            const answerArray = ensureArrayForCsv(value); // Use helper
            if (answerArray.length > 0) {
                const options = answerArray.filter(v => v !== '__OTHER__').map(v => String(v)).join(CSV_SEPARATOR);
                const otherIsSelected = answerArray.includes('__OTHER__');
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
// (getAllSurveys, createSurvey, getSurveyById, updateSurvey, deleteSurvey, submitSurveyAnswers remain the same as vNext6)
exports.getAllSurveys = async (req, res) => {
    try {
        const filter = {};
        if (req.user && req.user.id) {
            filter.createdBy = req.user.id;
            if (req.user.role === 'admin') delete filter.createdBy;
        } else {
            return res.status(401).json({ success: false, message: "Authentication details missing or invalid." });
        }
        const surveys = await Survey.find(filter).select('-questions -globalSkipLogic -settings -randomizationLogic -collectors').sort({ createdAt: -1 });
        if (!surveys) {
            if (!res.headersSent) return res.status(500).json({ success: false, message: "Error fetching surveys: Data became unavailable post-query." });
            return;
        }
        if (!res.headersSent) {
            res.status(200).json({ success: true, count: surveys.length, data: surveys });
        }
    } catch (error) {
        console.error(`[getAllSurveys] CRITICAL ERROR. Error: ${error.message}`, error.stack);
        if (!res.headersSent) res.status(500).json({ success: false, message: "Critical error fetching surveys on the server." });
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

exports.getSurveyById = async (req, res) => {
    const { surveyId } = req.params;
    const { forTaking, collectorId } = req.query;
    if (!mongoose.Types.ObjectId.isValid(surveyId)) {
        return res.status(400).json({ success: false, message: 'Invalid Survey ID.' });
    }
    try {
        let surveyQuery = Survey.findById(surveyId);
        if (forTaking === 'true') {
            surveyQuery = surveyQuery
                .select('title description welcomeMessage thankYouMessage status questions settings.surveyWide.allowRetakes settings.surveyWide.showProgressBar settings.surveyWide.customCSS globalSkipLogic randomizationLogic')
                .populate({ path: 'questions', options: { sort: { order: 1 } } });
        } else {
            surveyQuery = surveyQuery.populate({ path: 'questions', options: { sort: { order: 1 } } }).populate('collectors');
        }
        const survey = await surveyQuery;
        if (!survey) {
            return res.status(404).json({ success: false, message: 'Survey not found.' });
        }
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
        let processedQuestions = survey.questions || [];
        if (Array.isArray(processedQuestions)) {
            processedQuestions = processedQuestions.map(q => {
                let questionObject = (q && typeof q.toObject === 'function') ? q.toObject() : q; 
                if (questionObject && questionObject.type === 'conjoint' && questionObject.conjointAttributes) {
                    const profiles = generateConjointProfiles(questionObject.conjointAttributes);
                    return { ...questionObject, generatedProfiles: profiles };
                }
                return questionObject; 
            });
        }
        const surveyResponseData = (survey && typeof survey.toObject === 'function') ? survey.toObject() : { ...survey };
        if (surveyResponseData) { surveyResponseData.questions = processedQuestions; }
        res.status(200).json({ success: true, data: surveyResponseData });
    } catch (error) {
        console.error(`[Backend - getSurveyById] Error fetching survey ${surveyId}:`, error);
        res.status(500).json({ success: false, message: 'Error fetching survey.' });
    }
};

exports.updateSurvey = async (req, res) => {
    const { surveyId } = req.params;
    const updates = req.body; 
    console.log(`[updateSurvey] Received update for surveyId: ${surveyId}`);

    if (!mongoose.Types.ObjectId.isValid(surveyId)) {
        return res.status(400).json({ success: false, message: 'Invalid Survey ID.' });
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    console.log(`[updateSurvey] Transaction started for surveyId: ${surveyId}`);

    try {
        const survey = await Survey.findById(surveyId).session(session);
        if (!survey) {
            await session.abortTransaction(); session.endSession();
            return res.status(404).json({ success: false, message: 'Survey not found.' });
        }
        if (req.user && String(survey.createdBy) !== String(req.user.id) && req.user.role !== 'admin') {
            await session.abortTransaction(); session.endSession();
            return res.status(403).json({ success: false, message: 'Not authorized.' });
        }

        if (updates.questions && Array.isArray(updates.questions)) {
            const allValidObjectIds = updates.questions.every(id => mongoose.Types.ObjectId.isValid(id));
            if (!allValidObjectIds) {
                await session.abortTransaction(); session.endSession();
                console.error(`[updateSurvey] Invalid data in questions array: not all elements are valid ObjectIds.`);
                return res.status(400).json({ success: false, message: 'Invalid question ID(s) in questions array.' });
            }

            const newQuestionIdOrder = updates.questions.map(id => new mongoose.Types.ObjectId(id));
            const currentQuestionIdsInSurvey = survey.questions.map(id => String(id));
            const newQuestionIdOrderStrings = newQuestionIdOrder.map(id => String(id));
            const questionsActuallyRemovedFromSurvey = currentQuestionIdsInSurvey.filter(id => !newQuestionIdOrderStrings.includes(id));

            if (questionsActuallyRemovedFromSurvey.length > 0) {
                console.log(`[updateSurvey] Questions to be disassociated (and deleted) from survey ${surveyId}:`, questionsActuallyRemovedFromSurvey);
                await Question.deleteMany({ _id: { $in: questionsActuallyRemovedFromSurvey }, survey: survey._id }, { session });
                await Answer.deleteMany({ questionId: { $in: questionsActuallyRemovedFromSurvey }, surveyId: survey._id }, { session });
            }
            survey.questions = newQuestionIdOrder; 
            console.log(`[updateSurvey] Updated survey.questions order/list.`);
            delete updates.questions; 
        }

        Object.keys(updates).forEach(key => {
            if (key !== '_id' && key !== 'createdBy' && key !== 'questions') { 
                survey[key] = updates[key];
            }
        });
        survey.updatedAt = Date.now(); 

        const updatedSurvey = await survey.save({ session }); 
        console.log(`[updateSurvey] Main survey document saved. ID: ${updatedSurvey._id}`);

        await session.commitTransaction();
        session.endSession();
        console.log(`[updateSurvey] Transaction committed successfully for surveyId: ${surveyId}`);

        const populatedSurvey = await Survey.findById(updatedSurvey._id)
            .populate({ path: 'questions', options: { sort: { order: 1 } } });

        res.status(200).json({ success: true, message: 'Survey updated successfully.', data: populatedSurvey });

    } catch (error) {
        console.error(`[updateSurvey] Error during transaction for surveyId: ${surveyId}:`, error.message);
        if (error.errors) { 
            console.error(`[updateSurvey]   Validation errors:`, JSON.stringify(error.errors, null, 2));
        } else {
            console.error(`[updateSurvey]   Full error stack:`, error.stack);
        }
        await session.abortTransaction(); session.endSession();
        console.log(`[updateSurvey] Transaction aborted for surveyId: ${surveyId}`);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ success: false, message: 'Validation Error', details: error.errors });
        }
        res.status(500).json({ success: false, message: 'Error updating survey on the server.' });
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
    if (!mongoose.Types.ObjectId.isValid(surveyId)) return res.status(400).json({ success: false, message: 'Invalid Survey ID.' });
    if (!Array.isArray(answersPayload)) return res.status(400).json({ success: false, message: 'Answers must be an array.' });
    const sessionIdToUse = payloadSessionId;
    if (!sessionIdToUse) return res.status(400).json({ success: false, message: 'Session ID required.' });
    if (!collectorId || !mongoose.Types.ObjectId.isValid(collectorId)) return res.status(400).json({ success: false, message: 'Valid Collector ID required.' });

    const mongoSession = await mongoose.startSession(); 
    mongoSession.startTransaction();
    try {
        const survey = await Survey.findById(surveyId).populate('questions').select('+status +globalSkipLogic').session(mongoSession); 
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
        if (!isOwnerPreviewingDraft) {
            const collectorUpdateResult = await Collector.updateOne({ _id: collectorId }, { $inc: { responseCount: 1 } }, { session: mongoSession });
            if (collectorUpdateResult.modifiedCount > 0) { 
                const updatedCollector = await Collector.findById(collectorId).session(mongoSession);
                if (webLinkSettings?.maxResponses && updatedCollector.responseCount >= webLinkSettings.maxResponses) {
                    updatedCollector.status = 'completed_quota';
                    await updatedCollector.save({ session: mongoSession });
                }
            }
        }
        await mongoSession.commitTransaction();
        let triggeredAction = null;
        if (survey.globalSkipLogic?.length > 0 && survey.questions) {
            const allSessionAnswers = await Answer.find({ surveyId, sessionId: sessionIdToUse }).lean();
            triggeredAction = evaluateAllLogic(survey.globalSkipLogic, allSessionAnswers, survey.questions);
            if (triggeredAction?.type === 'disqualifyRespondent') {
                await Response.updateOne({ _id: updatedResponse._id }, { $set: { status: 'disqualified' } }); 
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
        
        const responses = await Response.find({ survey: surveyId, status: { $in: ['completed', 'disqualified'] } })
            .select('sessionId status submittedAt startedAt ipAddress userAgent customVariables')
            .lean(); 

        const sessionIds = responses.map(r => r.sessionId);
        // Fetch answers with their question details populated
        const answersFromDb = await Answer.find({ surveyId: survey._id, sessionId: { $in: sessionIds } })
            .populate({ path: 'questionId', select: 'text type options matrixRows matrixColumns addOtherOption' }) // Ensure necessary fields are populated
            .lean(); 

        // Helper to robustly convert answerValue to an array, especially for checkboxes
        const robustEnsureArrayFromAnswerValue = (value) => {
            if (Array.isArray(value)) return value.map(String); // Ensure all elements are strings
            if (typeof value === 'string') return value.split('||').filter(Boolean).map(String);
            if (value !== null && value !== undefined) return [String(value)];
            return [];
        };

        const results = {
            surveyTitle: survey.title,
            totalResponses: responses.length,
            responsesSummary: responses.map(r => ({
                responseId: r._id, sessionId: r.sessionId, status: r.status,
                submittedAt: r.submittedAt, startedAt: r.startedAt,
                duration: r.startedAt && r.submittedAt ? (new Date(r.submittedAt).getTime() - new Date(r.startedAt).getTime()) / 1000 : null,
                ipAddress: r.ipAddress, userAgent: r.userAgent,
            })),
            questions: survey.questions.map(q => {
                if (!q || !q._id) return null; // Skip if question is somehow invalid
                const questionDetails = q; // q is already the populated question object
                const questionAnswers = answersFromDb.filter(a => a.questionId && String(a.questionId._id) === String(questionDetails._id));
                
                let aggregatedAnswers = { counts: {}, writeIns: {} }; // Ensure writeIns is initialized

                if (['multiple-choice', 'dropdown', 'checkbox'].includes(questionDetails.type)) {
                    questionAnswers.forEach(ans => {
                        const valuesToProcess = questionDetails.type === 'checkbox' 
                            ? robustEnsureArrayFromAnswerValue(ans.answerValue)
                            : [String(ans.answerValue)]; // MC/Dropdown are single value

                        valuesToProcess.forEach(val => {
                            if (val === null || val === undefined || val.trim() === '') return;
                            
                            if (val === '__NA__') { // Use constant if defined, otherwise string
                                aggregatedAnswers.counts['__NA__'] = (aggregatedAnswers.counts['__NA__'] || 0) + 1;
                            } else if (val === '__OTHER__') {
                                aggregatedAnswers.counts['__OTHER__'] = (aggregatedAnswers.counts['__OTHER__'] || 0) + 1;
                                if (ans.otherText && ans.otherText.trim()) {
                                    const writeIn = ans.otherText.trim();
                                    aggregatedAnswers.writeIns[writeIn] = (aggregatedAnswers.writeIns[writeIn] || 0) + 1;
                                }
                            } else {
                                aggregatedAnswers.counts[val] = (aggregatedAnswers.counts[val] || 0) + 1;
                            }
                        });
                    });
                } else if (['nps', 'rating'].includes(questionDetails.type)) {
                    // Simplified, actual implementation would parse numbers, calculate avg, etc.
                    questionAnswers.forEach(ans => {
                        const valStr = String(ans.answerValue);
                        aggregatedAnswers.counts[valStr] = (aggregatedAnswers.counts[valStr] || 0) + 1;
                    });
                } else {
                    // Fallback for other types or if more detailed raw data is needed
                    aggregatedAnswers.raw = questionAnswers.map(a => ({
                        value: a.answerValue,
                        other: a.otherText,
                        sessionId: a.sessionId
                    }));
                }
                return {
                    questionId: questionDetails._id,
                    text: questionDetails.text,
                    type: questionDetails.type,
                    options: questionDetails.options, // Pass options for rendering labels
                    order: questionDetails.order,
                    responsesCount: questionAnswers.length,
                    answers: aggregatedAnswers,
                };
            }).filter(Boolean), // Remove nulls from map if any invalid questions
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
                    row[`q_${q._id}`] = ''; 
                    if (q.addOtherOption) row[`q_${q._id}_other`] = ''; 
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
// ----- END OF COMPLETE MODIFIED FILE (vNext7 - Robust Checkbox in getSurveyResults) -----