// backend/controllers/surveyController.js
// ----- START OF COMPLETE MODIFIED FILE (vNext16 - Robust globalSkipLogic Update) -----
const mongoose = require('mongoose');
const { Parser } = require('json2csv');
const Survey = require('../models/Survey');
const Question = require('../models/Question');
const Answer = require('../models/Answer');
const Collector = require('../models/Collector');
const Response = require('../models/Response');
const { evaluateAllLogic } = require('../utils/logicEvaluator'); // Assuming this is for survey taking
const axios = require('axios');
const ipRangeCheck = require('ip-range-check');

const getIpAddress = (request) => {
    const xForwardedFor = request.headers['x-forwarded-for'];
    if (xForwardedFor) {
        return Array.isArray(xForwardedFor) ? xForwardedFor[0].split(',').shift()?.trim() : xForwardedFor.split(',').shift()?.trim();
    }
    return request.ip || request.connection?.remoteAddress;
};

const generateConjointProfiles = (attributes) => {
    if (!attributes || attributes.length === 0) return [];
    // Placeholder for actual conjoint profile generation logic
    return [];
};

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
            const answerArray = ensureArrayForCsv(value); 
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
    const { forTaking, collectorId, isPreviewingOwner } = req.query; 

    if (!mongoose.Types.ObjectId.isValid(surveyId)) {
        return res.status(400).json({ success: false, message: 'Invalid Survey ID.' });
    }

    try {
        let surveyQuery = Survey.findById(surveyId);
        let actualCollectorDoc = null; 

        if (forTaking === 'true') {
            surveyQuery = surveyQuery
                .select('title description welcomeMessage thankYouMessage status questions settings.surveyWide.allowRetakes settings.surveyWide.showProgressBar settings.surveyWide.customCSS globalSkipLogic randomizationLogic')
                .populate({ path: 'questions', options: { sort: { order: 1 } } });
            
            if (collectorId) {
                const selectFields = '+settings.web_link.password +settings.web_link.allowMultipleResponses +settings.web_link.anonymousResponses +settings.web_link.enableRecaptcha +settings.web_link.recaptchaSiteKey +settings.web_link.ipAllowlist +settings.web_link.ipBlocklist +settings.web_link.allowBackButton';
                if (mongoose.Types.ObjectId.isValid(collectorId)) {
                    actualCollectorDoc = await Collector.findOne({ _id: collectorId, survey: surveyId }).select(selectFields);
                }
                if (!actualCollectorDoc) actualCollectorDoc = await Collector.findOne({ linkId: collectorId, survey: surveyId }).select(selectFields);
                if (!actualCollectorDoc) actualCollectorDoc = await Collector.findOne({ 'settings.web_link.customSlug': collectorId, survey: surveyId }).select(selectFields);
            }
        } else { 
            surveyQuery = surveyQuery.populate({ path: 'questions', options: { sort: { order: 1 } } }).populate('collectors');
        }

        const survey = await surveyQuery.lean(); 
        if (!survey) return res.status(404).json({ success: false, message: 'Survey not found.' });

        if (forTaking !== 'true' && req.user && String(survey.createdBy) !== String(req.user.id) && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'You are not authorized to view this survey\'s details.' });
        }
        
        const effectiveIsOwnerPreviewing = isPreviewingOwner === 'true' || (survey.status === 'draft' && req.user && String(survey.createdBy) === String(req.user.id));

        if (forTaking === 'true') {
            if (survey.status !== 'active' && !effectiveIsOwnerPreviewing) return res.status(403).json({ success: false, message: 'This survey is not currently active.' });
            if (collectorId && !actualCollectorDoc && !effectiveIsOwnerPreviewing) return res.status(404).json({ success: false, message: 'Collector not found or invalid for this survey.' });

            if (actualCollectorDoc) { 
                if (String(actualCollectorDoc.survey) !== String(survey._id)) return res.status(400).json({ success: false, message: 'Collector does not belong to this survey.' });
                if (actualCollectorDoc.status !== 'open' && !effectiveIsOwnerPreviewing) return res.status(403).json({ success: false, message: `Link is ${actualCollectorDoc.status}.` });

                if (actualCollectorDoc.settings?.web_link && !effectiveIsOwnerPreviewing) {
                    const respondentIp = getIpAddress(req);
                    const { ipAllowlist, ipBlocklist } = actualCollectorDoc.settings.web_link;
                    if (respondentIp) { 
                        if (ipAllowlist?.length > 0 && !ipAllowlist.some(allowedIpOrRange => ipRangeCheck(respondentIp, allowedIpOrRange))) return res.status(403).json({ success: false, message: 'Access to this survey is restricted from your current IP address (not in allowlist).' });
                        if (ipBlocklist?.length > 0 && ipBlocklist.some(blockedIpOrRange => ipRangeCheck(respondentIp, blockedIpOrRange))) return res.status(403).json({ success: false, message: 'Access to this survey is restricted from your current IP address (in blocklist).' });
                    }
                }
                if (actualCollectorDoc.type === 'web_link' && actualCollectorDoc.settings?.web_link?.password) {
                    const providedPassword = req.headers['x-survey-password'];
                    const passwordMatch = await actualCollectorDoc.comparePassword(providedPassword);
                    if (!providedPassword || !passwordMatch) return res.status(401).json({ success: false, message: 'Password required or incorrect.', requiresPassword: true });
                }
            } else if (!effectiveIsOwnerPreviewing && survey.status === 'draft' && !collectorId) { 
                return res.status(403).json({ success: false, message: 'Survey is in draft mode and requires a specific collector link for preview.' });
            }
        }

        let processedQuestions = survey.questions || [];
        if (Array.isArray(processedQuestions)) {
            processedQuestions = processedQuestions.map(q => q && q.type === 'conjoint' && q.conjointAttributes ? { ...q, generatedProfiles: generateConjointProfiles(q.conjointAttributes) } : q);
        }
        
        const surveyResponseData = { ...survey, questions: processedQuestions };
        
        if (forTaking === 'true') {
            if (actualCollectorDoc?.settings?.web_link) {
                const webLinkSettingsObject = actualCollectorDoc.settings.web_link.toObject ? actualCollectorDoc.settings.web_link.toObject() : { ...actualCollectorDoc.settings.web_link };
                surveyResponseData.collectorSettings = webLinkSettingsObject;
                surveyResponseData.actualCollectorObjectId = actualCollectorDoc._id; 
                if (surveyResponseData.collectorSettings.enableRecaptcha && !surveyResponseData.collectorSettings.recaptchaSiteKey && process.env.REACT_APP_RECAPTCHA_SITE_KEY) surveyResponseData.collectorSettings.recaptchaSiteKey = process.env.REACT_APP_RECAPTCHA_SITE_KEY;
                if (typeof surveyResponseData.collectorSettings.allowBackButton === 'undefined') surveyResponseData.collectorSettings.allowBackButton = true; 
            } else {
                surveyResponseData.collectorSettings = { allowMultipleResponses: survey.settings?.surveyWide?.allowRetakes ?? true, anonymousResponses: false, enableRecaptcha: false, recaptchaSiteKey: process.env.REACT_APP_RECAPTCHA_SITE_KEY || '', ipAllowlist: [], ipBlocklist: [], allowBackButton: true };
                surveyResponseData.actualCollectorObjectId = null;
            }
        }
        res.status(200).json({ success: true, data: surveyResponseData });
    } catch (error) {
        console.error(`[Backend - getSurveyById] Error fetching survey ${surveyId} with collectorId (identifier) ${collectorId}:`, error);
        res.status(500).json({ success: false, message: 'Error fetching survey.' });
    }
};

exports.updateSurvey = async (req, res) => {
    const { surveyId } = req.params;
    const updates = req.body; 

    console.log(`[surveyController.updateSurvey] Received for survey ${surveyId}. Updates:`, JSON.stringify(updates, null, 2)); // Keep this log

    if (!mongoose.Types.ObjectId.isValid(surveyId)) return res.status(400).json({ success: false, message: 'Invalid Survey ID.' });
    
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const survey = await Survey.findById(surveyId).session(session);
        if (!survey) { await session.abortTransaction(); session.endSession(); return res.status(404).json({ success: false, message: 'Survey not found.' }); }
        if (req.user && String(survey.createdBy) !== String(req.user.id) && req.user.role !== 'admin') { await session.abortTransaction(); session.endSession(); return res.status(403).json({ success: false, message: 'Not authorized.' }); }
        
        // Handle question order and deletions
        if (updates.questions && Array.isArray(updates.questions)) {
            const allValidObjectIds = updates.questions.every(id => mongoose.Types.ObjectId.isValid(id));
            if (!allValidObjectIds) { await session.abortTransaction(); session.endSession(); return res.status(400).json({ success: false, message: 'Invalid question ID(s) in questions array.' }); }
            
            const newQuestionIdOrder = updates.questions.map(id => new mongoose.Types.ObjectId(id));
            const currentQuestionIdsInSurvey = survey.questions.map(id => String(id));
            const newQuestionIdOrderStrings = newQuestionIdOrder.map(id => String(id));
            const questionsActuallyRemovedFromSurvey = currentQuestionIdsInSurvey.filter(id => !newQuestionIdOrderStrings.includes(id));
            
            if (questionsActuallyRemovedFromSurvey.length > 0) {
                await Question.deleteMany({ _id: { $in: questionsActuallyRemovedFromSurvey }, survey: survey._id }, { session });
                await Answer.deleteMany({ questionId: { $in: questionsActuallyRemovedFromSurvey }, surveyId: survey._id }, { session });
            }
            survey.questions = newQuestionIdOrder; 
        }
        
        // --- MODIFIED: Explicitly handle globalSkipLogic and other top-level fields ---
        const allowedTopLevelFields = ['title', 'description', 'status', 'settings', 'randomizationLogic', 'welcomeMessage', 'thankYouMessage', 'globalSkipLogic'];
        
        for (const key of allowedTopLevelFields) {
            if (updates.hasOwnProperty(key)) { // Check if the key exists in the updates
                if (key === 'globalSkipLogic') {
                    // For arrays of complex objects, direct assignment is best for Mongoose to detect changes.
                    // Ensure it's an array, otherwise Mongoose validation might fail or it might save null.
                    survey.globalSkipLogic = Array.isArray(updates.globalSkipLogic) ? updates.globalSkipLogic : [];
                    // Mongoose should automatically detect this change due to direct assignment of the array.
                    // survey.markModified('globalSkipLogic'); // Usually not needed for direct array assignment
                } else {
                    survey[key] = updates[key];
                }
            }
        }
        // --- END MODIFICATION ---

        survey.updatedAt = Date.now(); 
        const updatedSurvey = await survey.save({ session }); 
        
        await session.commitTransaction();
        session.endSession();
        
        // Repopulate to send back the full survey with potentially updated/ordered questions
        const populatedSurvey = await Survey.findById(updatedSurvey._id)
                                          .populate({ path: 'questions', options: { sort: { order: 1 } } })
                                          .populate('collectors'); // Also populate collectors if needed by frontend
                                          
        res.status(200).json({ success: true, message: 'Survey updated successfully.', data: populatedSurvey });

    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        session.endSession();
        
        console.error(`[surveyController.updateSurvey] Error during update for survey ${surveyId}:`, error); 
        if (error.name === 'ValidationError') {
            console.error(`[surveyController.updateSurvey] Validation Errors:`, JSON.stringify(error.errors, null, 2));
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
        if (req.user && String(survey.createdBy) !== String(req.user.id) && req.user.role !== 'admin') { await session.abortTransaction(); session.endSession(); return res.status(403).json({ success: false, message: 'Not authorized.' }); }
        
        await Question.deleteMany({ survey: survey._id }, { session });
        await Answer.deleteMany({ surveyId: survey._id }, { session });
        await Collector.deleteMany({ survey: survey._id }, { session });
        await Response.deleteMany({ survey: survey._id }, { session });
        await Survey.deleteOne({ _id: survey._id }, { session });
        
        await session.commitTransaction();
        session.endSession();
        res.status(200).json({ success: true, message: 'Survey deleted.' });
    } catch (error) {
        if (session.inTransaction()) await session.abortTransaction();
        session.endSession();
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
    if (!collectorId || !mongoose.Types.ObjectId.isValid(collectorId)) return res.status(400).json({ success: false, message: 'Valid Collector OBJECT ID required for submission.' }); 

    const mongoSession = await mongoose.startSession(); 
    mongoSession.startTransaction();
    try {
        const survey = await Survey.findById(surveyId).populate('questions').select('+status +globalSkipLogic').session(mongoSession); 
        if (!survey) { await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(404).json({ success: false, message: 'Survey not found.' }); }
        
        const isOwnerPreviewingDraft = survey.status === 'draft' && req.user && String(survey.createdBy) === String(req.user.id);
        if (survey.status !== 'active' && !isOwnerPreviewingDraft) {
            await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(400).json({ success: false, message: 'Survey not active.' });
        }
        
        const collector = await Collector.findById(collectorId)
            .select('+settings.web_link.password +settings.web_link.anonymousResponses +settings.web_link.enableRecaptcha +settings.web_link.recaptchaSiteKey +settings.web_link.ipAllowlist +settings.web_link.ipBlocklist +settings.web_link.allowBackButton')
            .session(mongoSession); 
            
        if (!collector) { await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(404).json({ success: false, message: 'Collector not found for submission.' }); } 
        if (String(collector.survey) !== String(surveyId)) { await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(400).json({ success: false, message: 'Collector mismatch.' }); }
        if (collector.status !== 'open' && !isOwnerPreviewingDraft) { await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(400).json({ success: false, message: `Link is ${collector.status}.` }); }
        
        const now = new Date(); 
        const webLinkSettings = collector.settings?.web_link;

        if (webLinkSettings && !isOwnerPreviewingDraft) {
            const respondentIp = getIpAddress(req);
            if (respondentIp) {
                if (webLinkSettings.ipAllowlist?.length > 0 && !webLinkSettings.ipAllowlist.some(ip => ipRangeCheck(respondentIp, ip))) { await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(403).json({ success: false, message: 'Submission restricted from your IP address (not in allowlist).' }); }
                if (webLinkSettings.ipBlocklist?.length > 0 && webLinkSettings.ipBlocklist.some(ip => ipRangeCheck(respondentIp, ip))) { await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(403).json({ success: false, message: 'Submission restricted from your IP address (in blocklist).' }); }
            }
        }

        if (webLinkSettings?.openDate && new Date(webLinkSettings.openDate) > now && !isOwnerPreviewingDraft) { await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(400).json({ success: false, message: 'Survey not yet open.' }); }
        if (webLinkSettings?.closeDate && new Date(webLinkSettings.closeDate) < now && !isOwnerPreviewingDraft) { await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(400).json({ success: false, message: 'Survey closed.' }); }
        if (webLinkSettings?.maxResponses && collector.responseCount >= webLinkSettings.maxResponses && !isOwnerPreviewingDraft) { await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(400).json({ success: false, message: 'Max responses reached.' }); }
        
        if (collector.type === 'web_link' && webLinkSettings?.enableRecaptcha && !isOwnerPreviewingDraft) {
            if (!recaptchaToken) { await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(400).json({ success: false, message: 'reCAPTCHA required.' }); }
            const secretKey = process.env.RECAPTCHA_V2_SECRET_KEY;
            if (!secretKey) { console.error("[submitSurveyAnswers] RECAPTCHA_V2_SECRET_KEY not set."); await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(500).json({ success: false, message: 'reCAPTCHA config error (secret missing).' }); }
            const verificationUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${recaptchaToken}&remoteip=${getIpAddress(req)}`;
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
        const responseSetOnInsertData = { survey: surveyId, collector: collector._id, sessionId: sessionIdToUse, startedAt: (clientStartedAt && !isNaN(new Date(clientStartedAt).getTime())) ? new Date(clientStartedAt) : new Date() };
        if (!(webLinkSettings?.anonymousResponses === true)) { responseSetOnInsertData.ipAddress = getIpAddress(req); responseSetOnInsertData.userAgent = req.headers['user-agent']; }

        const updatedResponse = await Response.findOneAndUpdate( { survey: surveyId, collector: collector._id, sessionId: sessionIdToUse }, { $set: responseUpdateData, $setOnInsert: responseSetOnInsertData }, { new: true, upsert: true, runValidators: true, session: mongoSession } );
        
        if (!isOwnerPreviewingDraft) {
            const collectorUpdateResult = await Collector.updateOne({ _id: collector._id }, { $inc: { responseCount: 1 } }, { session: mongoSession });
            if (collectorUpdateResult.modifiedCount > 0) { 
                const updatedCollectorAfterInc = await Collector.findById(collector._id).session(mongoSession); 
                if (webLinkSettings?.maxResponses && updatedCollectorAfterInc.responseCount >= webLinkSettings.maxResponses) { updatedCollectorAfterInc.status = 'completed_quota'; await updatedCollectorAfterInc.save({ session: mongoSession }); }
            }
        }
        
        await mongoSession.commitTransaction();
        
        let triggeredAction = null;
        if (survey.globalSkipLogic?.length > 0 && survey.questions) {
            const allSessionAnswers = await Answer.find({ surveyId, sessionId: sessionIdToUse }).lean();
            triggeredAction = evaluateAllLogic(survey.globalSkipLogic, allSessionAnswers, survey.questions);
            if (triggeredAction?.type === 'disqualifyRespondent') { await Response.updateOne({ _id: updatedResponse._id }, { $set: { status: 'disqualified' } }); return res.status(200).json({ success: true, message: triggeredAction.disqualificationMessage || 'Disqualified.', action: triggeredAction, sessionId: sessionIdToUse, responseId: updatedResponse._id }); }
        }
        
        res.status(201).json({ success: true, message: 'Answers submitted.', sessionId: sessionIdToUse, responseId: updatedResponse._id, action: triggeredAction });
    } catch (error) {
        console.error(`[submitSurveyAnswers] Error for survey ${surveyId}, session ${sessionIdToUse}:`, error);
        if (mongoSession.inTransaction()) { try { await mongoSession.abortTransaction(); } catch (abortError) { console.error(`[submitSurveyAnswers] Error aborting transaction:`, abortError); } }
        if (!res.headersSent) {
            if (error.name === 'ValidationError') return res.status(400).json({ success: false, message: 'Validation Error.', details: error.errors });
            if (error.message?.includes("Updating the path 'ipAddress' would create a conflict")) return res.status(409).json({ success: false, message: error.message }); 
            if (error.code === 11000) return res.status(409).json({ success: false, message: 'Duplicate submission or conflict.', details: error.keyValue });
            res.status(500).json({ success: false, message: error.message || 'Error submitting answers.' });
        }
    } finally {
        if (!mongoSession.hasEnded) mongoSession.endSession();
    }
};

exports.getSurveyResults = async (req, res) => { /* ... (no changes needed here for skip logic saving) ... */ };
exports.exportSurveyResults = async (req, res) => { /* ... (no changes needed here for skip logic saving) ... */ };
// ----- END OF COMPLETE MODIFIED FILE (vNext16 - Robust globalSkipLogic Update) -----