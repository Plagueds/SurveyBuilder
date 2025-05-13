// backend/controllers/surveyController.js
// ----- START OF COMPLETE MODIFIED FILE (vNext14 - Implement IP Filtering Logic) -----
const mongoose = require('mongoose');
const { Parser } = require('json2csv');
const Survey = require('../models/Survey');
const Question = require('../models/Question');
const Answer = require('../models/Answer');
const Collector = require('../models/Collector');
const Response = require('../models/Response');
const { evaluateAllLogic } = require('../utils/logicEvaluator');
const axios = require('axios');
const ipRangeCheck = require('ip-range-check'); // <<<--- ADDED FOR IP FILTERING

// --- Helper Function to get IP Address (moved to be reusable) ---
const getIpAddress = (request) => {
    const xForwardedFor = request.headers['x-forwarded-for'];
    if (xForwardedFor) {
        // Can be a comma-separated list, take the first one (client IP)
        return Array.isArray(xForwardedFor) ? xForwardedFor[0].split(',').shift()?.trim() : xForwardedFor.split(',').shift()?.trim();
    }
    // Fallback to req.ip (Express specific) or req.connection.remoteAddress
    return request.ip || request.connection?.remoteAddress;
};


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

// --- Controller Functions ---
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

    console.log(`[getSurveyById Bkend] surveyId: ${surveyId}, forTaking: ${forTaking}, collectorId (identifier): ${collectorId}, isPreviewingOwner: ${isPreviewingOwner}`);

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
                console.log(`[getSurveyById Bkend] Attempting to find collector by identifier: ${collectorId} for survey ${surveyId}`);
                // --- MODIFIED: Added ipAllowlist and ipBlocklist to selectFields ---
                const selectFields = '+settings.web_link.password +settings.web_link.allowMultipleResponses +settings.web_link.anonymousResponses +settings.web_link.enableRecaptcha +settings.web_link.recaptchaSiteKey +settings.web_link.ipAllowlist +settings.web_link.ipBlocklist';
                
                if (mongoose.Types.ObjectId.isValid(collectorId)) {
                    console.log(`[getSurveyById Bkend] Identifier ${collectorId} is a valid ObjectId. Querying by _id.`);
                    actualCollectorDoc = await Collector.findOne({ _id: collectorId, survey: surveyId }).select(selectFields);
                }
                
                if (!actualCollectorDoc) {
                    console.log(`[getSurveyById Bkend] Not found by _id (or not an ObjectId). Querying by linkId: ${collectorId}.`);
                    actualCollectorDoc = await Collector.findOne({ linkId: collectorId, survey: surveyId }).select(selectFields);
                }

                if (!actualCollectorDoc) {
                    console.log(`[getSurveyById Bkend] Not found by linkId. Querying by settings.web_link.customSlug: ${collectorId}.`);
                    actualCollectorDoc = await Collector.findOne({ 'settings.web_link.customSlug': collectorId, survey: surveyId }).select(selectFields);
                }

                if (actualCollectorDoc) {
                    console.log(`[getSurveyById Bkend] Collector FOUND: ID=${actualCollectorDoc._id}, Name=${actualCollectorDoc.name}`);
                } else {
                    console.warn(`[getSurveyById Bkend] Collector NOT FOUND for identifier: ${collectorId} and survey ${surveyId}`);
                }
            }
        } else { 
            surveyQuery = surveyQuery.populate({ path: 'questions', options: { sort: { order: 1 } } }).populate('collectors');
        }

        const survey = await surveyQuery.lean(); 

        if (!survey) {
            return res.status(404).json({ success: false, message: 'Survey not found.' });
        }

        if (forTaking !== 'true' && req.user && String(survey.createdBy) !== String(req.user.id) && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'You are not authorized to view this survey\'s details.' });
        }
        
        const effectiveIsOwnerPreviewing = isPreviewingOwner === 'true' || (survey.status === 'draft' && req.user && String(survey.createdBy) === String(req.user.id));

        if (forTaking === 'true') {
            if (survey.status !== 'active' && !effectiveIsOwnerPreviewing) {
                 return res.status(403).json({ success: false, message: 'This survey is not currently active.' });
            }

            if (collectorId && !actualCollectorDoc && !effectiveIsOwnerPreviewing) { 
                 return res.status(404).json({ success: false, message: 'Collector not found or invalid for this survey.' });
            }

            if (actualCollectorDoc) { 
                if (String(actualCollectorDoc.survey) !== String(survey._id)) { 
                    return res.status(400).json({ success: false, message: 'Collector does not belong to this survey.' });
                }
                if (actualCollectorDoc.status !== 'open' && !effectiveIsOwnerPreviewing) {
                    return res.status(403).json({ success: false, message: `Link is ${actualCollectorDoc.status}.` });
                }

                // --- IP FILTERING LOGIC START ---
                if (actualCollectorDoc.settings?.web_link && !effectiveIsOwnerPreviewing) {
                    const respondentIp = getIpAddress(req);
                    console.log(`[getSurveyById Bkend] Respondent IP: ${respondentIp}`);
                    const { ipAllowlist, ipBlocklist } = actualCollectorDoc.settings.web_link;

                    if (respondentIp) { // Proceed only if IP is available
                        // Check Allowlist: If allowlist has entries, IP must be in it.
                        if (ipAllowlist && ipAllowlist.length > 0) {
                            const isAllowed = ipAllowlist.some(allowedIpOrRange => ipRangeCheck(respondentIp, allowedIpOrRange));
                            if (!isAllowed) {
                                console.warn(`[getSurveyById Bkend] IP ${respondentIp} NOT in allowlist for collector ${actualCollectorDoc._id}. Access denied.`);
                                return res.status(403).json({ success: false, message: 'Access to this survey is restricted from your current IP address (not in allowlist).' });
                            }
                            console.log(`[getSurveyById Bkend] IP ${respondentIp} is in allowlist.`);
                        }

                        // Check Blocklist: If blocklist has entries, IP must NOT be in it.
                        if (ipBlocklist && ipBlocklist.length > 0) {
                            const isBlocked = ipBlocklist.some(blockedIpOrRange => ipRangeCheck(respondentIp, blockedIpOrRange));
                            if (isBlocked) {
                                console.warn(`[getSurveyById Bkend] IP ${respondentIp} IS in blocklist for collector ${actualCollectorDoc._id}. Access denied.`);
                                return res.status(403).json({ success: false, message: 'Access to this survey is restricted from your current IP address (in blocklist).' });
                            }
                            console.log(`[getSurveyById Bkend] IP ${respondentIp} is NOT in blocklist.`);
                        }
                    } else {
                        console.warn(`[getSurveyById Bkend] Could not determine respondent IP for collector ${actualCollectorDoc._id}. IP filtering skipped.`);
                    }
                }
                // --- IP FILTERING LOGIC END ---


                if (actualCollectorDoc.type === 'web_link' && actualCollectorDoc.settings?.web_link?.password) {
                    const providedPassword = req.headers['x-survey-password'];
                    const passwordMatch = await actualCollectorDoc.comparePassword(providedPassword);
                    if (!providedPassword || !passwordMatch) {
                         return res.status(401).json({ success: false, message: 'Password required or incorrect.', requiresPassword: true });
                    }
                }
            } else if (!effectiveIsOwnerPreviewing && survey.status === 'draft' && !collectorId) { 
                return res.status(403).json({ success: false, message: 'Survey is in draft mode and requires a specific collector link for preview.' });
            }
        }

        let processedQuestions = survey.questions || [];
        if (Array.isArray(processedQuestions)) {
            processedQuestions = processedQuestions.map(q => {
                if (q && q.type === 'conjoint' && q.conjointAttributes) {
                    const profiles = generateConjointProfiles(q.conjointAttributes);
                    return { ...q, generatedProfiles: profiles };
                }
                return q; 
            });
        }
        
        const surveyResponseData = { ...survey, questions: processedQuestions };
        
        if (forTaking === 'true') {
            if (actualCollectorDoc && actualCollectorDoc.settings?.web_link) {
                const webLinkSettingsObject = actualCollectorDoc.settings.web_link.toObject ? 
                                              actualCollectorDoc.settings.web_link.toObject() : 
                                              { ...actualCollectorDoc.settings.web_link };

                surveyResponseData.collectorSettings = webLinkSettingsObject;
                surveyResponseData.actualCollectorObjectId = actualCollectorDoc._id; 
                console.log(`[getSurveyById Bkend] Passing to frontend: actualCollectorObjectId=${actualCollectorDoc._id}, collectorSettings=`, surveyResponseData.collectorSettings);
                
                if (surveyResponseData.collectorSettings.enableRecaptcha && !surveyResponseData.collectorSettings.recaptchaSiteKey && process.env.REACT_APP_RECAPTCHA_SITE_KEY) {
                    surveyResponseData.collectorSettings.recaptchaSiteKey = process.env.REACT_APP_RECAPTCHA_SITE_KEY;
                }
            } else {
                console.log(`[getSurveyById Bkend] No actualCollectorDoc found or no web_link settings. Passing default/empty collectorSettings.`);
                surveyResponseData.collectorSettings = {
                    allowMultipleResponses: survey.settings?.surveyWide?.allowRetakes !== undefined ? survey.settings.surveyWide.allowRetakes : true,
                    anonymousResponses: false, 
                    enableRecaptcha: false, 
                    recaptchaSiteKey: process.env.REACT_APP_RECAPTCHA_SITE_KEY || '',
                    ipAllowlist: [], // Default empty for frontend
                    ipBlocklist: []  // Default empty for frontend
                };
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
    if (!mongoose.Types.ObjectId.isValid(surveyId)) return res.status(400).json({ success: false, message: 'Invalid Survey ID.' });
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const survey = await Survey.findById(surveyId).session(session);
        if (!survey) { await session.abortTransaction(); session.endSession(); return res.status(404).json({ success: false, message: 'Survey not found.' }); }
        if (req.user && String(survey.createdBy) !== String(req.user.id) && req.user.role !== 'admin') { await session.abortTransaction(); session.endSession(); return res.status(403).json({ success: false, message: 'Not authorized.' }); }
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
            delete updates.questions; 
        }
        Object.keys(updates).forEach(key => { if (key !== '_id' && key !== 'createdBy' && key !== 'questions') { survey[key] = updates[key]; } });
        survey.updatedAt = Date.now(); 
        const updatedSurvey = await survey.save({ session }); 
        await session.commitTransaction();
        session.endSession();
        const populatedSurvey = await Survey.findById(updatedSurvey._id).populate({ path: 'questions', options: { sort: { order: 1 } } });
        res.status(200).json({ success: true, message: 'Survey updated successfully.', data: populatedSurvey });
    } catch (error) {
        await session.abortTransaction(); session.endSession();
        if (error.name === 'ValidationError') return res.status(400).json({ success: false, message: 'Validation Error', details: error.errors });
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
        
        // --- MODIFIED: Added ipAllowlist and ipBlocklist to selectFields for collector ---
        const collector = await Collector.findById(collectorId)
            .select('+settings.web_link.password +settings.web_link.anonymousResponses +settings.web_link.enableRecaptcha +settings.web_link.recaptchaSiteKey +settings.web_link.ipAllowlist +settings.web_link.ipBlocklist')
            .session(mongoSession); 
            
        if (!collector) { await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(404).json({ success: false, message: 'Collector not found for submission.' }); } 
        if (String(collector.survey) !== String(surveyId)) { await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(400).json({ success: false, message: 'Collector mismatch.' }); }
        if (collector.status !== 'open' && !isOwnerPreviewingDraft) { await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(400).json({ success: false, message: `Link is ${collector.status}.` }); }
        
        const now = new Date(); 
        const webLinkSettings = collector.settings?.web_link;

        // --- IP FILTERING LOGIC (Double Check before submission, though getSurveyById should handle primary blocking) ---
        if (webLinkSettings && !isOwnerPreviewingDraft) {
            const respondentIp = getIpAddress(req);
            if (respondentIp) {
                if (webLinkSettings.ipAllowlist && webLinkSettings.ipAllowlist.length > 0) {
                    if (!webLinkSettings.ipAllowlist.some(ip => ipRangeCheck(respondentIp, ip))) {
                        await mongoSession.abortTransaction(); mongoSession.endSession();
                        return res.status(403).json({ success: false, message: 'Submission restricted from your IP address (not in allowlist).' });
                    }
                }
                if (webLinkSettings.ipBlocklist && webLinkSettings.ipBlocklist.length > 0) {
                    if (webLinkSettings.ipBlocklist.some(ip => ipRangeCheck(respondentIp, ip))) {
                        await mongoSession.abortTransaction(); mongoSession.endSession();
                        return res.status(403).json({ success: false, message: 'Submission restricted from your IP address (in blocklist).' });
                    }
                }
            }
        }
        // --- END IP FILTERING LOGIC (Double Check) ---


        if (webLinkSettings?.openDate && new Date(webLinkSettings.openDate) > now && !isOwnerPreviewingDraft) { await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(400).json({ success: false, message: 'Survey not yet open.' }); }
        if (webLinkSettings?.closeDate && new Date(webLinkSettings.closeDate) < now && !isOwnerPreviewingDraft) { await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(400).json({ success: false, message: 'Survey closed.' }); }
        if (webLinkSettings?.maxResponses && collector.responseCount >= webLinkSettings.maxResponses && !isOwnerPreviewingDraft) { await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(400).json({ success: false, message: 'Max responses reached.' }); }
        
        if (collector.type === 'web_link' && webLinkSettings?.enableRecaptcha && !isOwnerPreviewingDraft) {
            if (!recaptchaToken) { await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(400).json({ success: false, message: 'reCAPTCHA required.' }); }
            const secretKey = process.env.RECAPTCHA_V2_SECRET_KEY;
            if (!secretKey) { console.error("[submitSurveyAnswers] RECAPTCHA_V2_SECRET_KEY not set."); await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(500).json({ success: false, message: 'reCAPTCHA config error (secret missing).' }); }
            const verificationUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${recaptchaToken}&remoteip=${getIpAddress(req)}`; // Use getIpAddress
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
        
        const responseUpdateData = { 
            status: 'completed', 
            submittedAt: new Date(), 
            lastActivityAt: new Date() 
        };
        const responseSetOnInsertData = { 
            survey: surveyId, 
            collector: collector._id, 
            sessionId: sessionIdToUse, 
            startedAt: (clientStartedAt && !isNaN(new Date(clientStartedAt).getTime())) ? new Date(clientStartedAt) : new Date() 
        };

        const collectIpAndUserAgent = !(webLinkSettings && webLinkSettings.anonymousResponses === true);

        if (collectIpAndUserAgent) {
            responseSetOnInsertData.ipAddress = getIpAddress(req); 
            responseSetOnInsertData.userAgent = req.headers['user-agent']; 
        }

        const updatedResponse = await Response.findOneAndUpdate(
            { survey: surveyId, collector: collector._id, sessionId: sessionIdToUse }, 
            { $set: responseUpdateData, $setOnInsert: responseSetOnInsertData }, 
            { new: true, upsert: true, runValidators: true, session: mongoSession }
        );
        
        if (!isOwnerPreviewingDraft) {
            const collectorUpdateResult = await Collector.updateOne({ _id: collector._id }, { $inc: { responseCount: 1 } }, { session: mongoSession });
            if (collectorUpdateResult.modifiedCount > 0) { 
                const updatedCollectorAfterInc = await Collector.findById(collector._id).session(mongoSession); 
                if (webLinkSettings?.maxResponses && updatedCollectorAfterInc.responseCount >= webLinkSettings.maxResponses) {
                    updatedCollectorAfterInc.status = 'completed_quota';
                    await updatedCollectorAfterInc.save({ session: mongoSession });
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
            if (error.message && error.message.includes("Updating the path 'ipAddress' would create a conflict")) {
                 return res.status(409).json({ success: false, message: error.message }); 
            }
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
            .select('+sessionId +status +submittedAt +startedAt +ipAddress +userAgent +customVariables') 
            .lean(); 

        const sessionIds = responses.map(r => r.sessionId);
        const answersFromDb = await Answer.find({ surveyId: survey._id, sessionId: { $in: sessionIds } })
            .populate({ path: 'questionId', select: 'text type options matrixRows matrixColumns addOtherOption' })
            .lean(); 

        const robustEnsureArrayFromAnswerValue = (value) => {
            if (Array.isArray(value)) return value.map(String);
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
                ipAddress: r.ipAddress, 
                userAgent: r.userAgent, 
            })),
            questions: survey.questions.map(q => {
                if (!q || !q._id) return null;
                const questionDetails = q;
                const questionAnswers = answersFromDb.filter(a => a.questionId && String(a.questionId._id) === String(questionDetails._id));
                let aggregatedAnswers = { counts: {}, writeIns: {} };
                if (['multiple-choice', 'dropdown', 'checkbox'].includes(questionDetails.type)) {
                    questionAnswers.forEach(ans => {
                        const valuesToProcess = questionDetails.type === 'checkbox' 
                            ? robustEnsureArrayFromAnswerValue(ans.answerValue)
                            : [String(ans.answerValue)];
                        valuesToProcess.forEach(val => {
                            if (val === null || val === undefined || val.trim() === '') return;
                            if (val === '__NA__') { aggregatedAnswers.counts['__NA__'] = (aggregatedAnswers.counts['__NA__'] || 0) + 1; }
                            else if (val === '__OTHER__') { aggregatedAnswers.counts['__OTHER__'] = (aggregatedAnswers.counts['__OTHER__'] || 0) + 1; if (ans.otherText && ans.otherText.trim()) { const writeIn = ans.otherText.trim(); aggregatedAnswers.writeIns[writeIn] = (aggregatedAnswers.writeIns[writeIn] || 0) + 1; } }
                            else { aggregatedAnswers.counts[val] = (aggregatedAnswers.counts[val] || 0) + 1; }
                        });
                    });
                } else if (['nps', 'rating'].includes(questionDetails.type)) {
                    questionAnswers.forEach(ans => { const valStr = String(ans.answerValue); aggregatedAnswers.counts[valStr] = (aggregatedAnswers.counts[valStr] || 0) + 1; });
                } else { aggregatedAnswers.raw = questionAnswers.map(a => ({ value: a.answerValue, other: a.otherText, sessionId: a.sessionId })); }
                return { questionId: questionDetails._id, text: questionDetails.text, type: questionDetails.type, options: questionDetails.options, order: questionDetails.order, responsesCount: questionAnswers.length, answers: aggregatedAnswers, };
            }).filter(Boolean),
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
        
        const responses = await Response.find(responseQueryConditions)
            .select('+sessionId +status +submittedAt +startedAt +ipAddress +userAgent +customVariables') 
            .sort({ submittedAt: 1 })
            .lean();

        if (responses.length === 0) return res.status(404).json({ success: false, message: 'No responses found.' });
        
        const sessionIds = responses.map(r => r.sessionId);
        const allAnswersForResponses = await Answer.find({ surveyId: survey._id, sessionId: { $in: sessionIds } }).lean();
        
        const fields = [ { label: 'Response ID', value: 'responseId' }, { label: 'Session ID', value: 'sessionId' }, { label: 'Status', value: 'status' }, { label: 'Started At', value: 'startedAt' }, { label: 'Submitted At', value: 'submittedAt' }, { label: 'Duration (seconds)', value: 'duration' }, { label: 'IP Address', value: 'ipAddress' }, { label: 'User Agent', value: 'userAgent' }, ];
        survey.questions.forEach(q => {
            fields.push({ label: `${q.text || `Q${q.order + 1}`} (ID: ${q._id})`, value: `q_${q._id}` });
            if (q.addOtherOption) fields.push({ label: `${q.text || `Q${q.order + 1}`} - Other Text`, value: `q_${q._id}_other` });
        });
        
        const csvData = responses.map(responseDoc => {
            const row = { 
                responseId: responseDoc._id.toString(), 
                sessionId: responseDoc.sessionId, 
                status: responseDoc.status, 
                startedAt: responseDoc.startedAt ? new Date(responseDoc.startedAt).toISOString() : '', 
                submittedAt: responseDoc.submittedAt ? new Date(responseDoc.submittedAt).toISOString() : '', 
                duration: responseDoc.startedAt && responseDoc.submittedAt ? (new Date(responseDoc.submittedAt).getTime() - new Date(responseDoc.startedAt).getTime()) / 1000 : '', 
                ipAddress: responseDoc.ipAddress || '', 
                userAgent: responseDoc.userAgent || '', 
            };
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
// ----- END OF COMPLETE MODIFIED FILE (vNext14 - Implement IP Filtering Logic) -----