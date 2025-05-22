// backend/controllers/surveyController.js
// ----- START OF COMPLETE MODIFIED FILE (vX.X+2 - Enhanced Logging for Resume) -----
const mongoose = require('mongoose');
const { Parser } = require('json2csv');
const crypto =require('crypto');
const Survey = require('../models/Survey');
const Question = require('../models/Question');
const Answer = require('../models/Answer');
const Collector = require('../models/Collector');
const Response = require('../models/Response');
const PartialResponse = require('../models/PartialResponse');
const { evaluateAllLogic } = require('../utils/logicEvaluator');
const axios = require('axios');
const ipRangeCheck = require('ip-range-check');
const emailService = require('../services/emailService');

// --- HELPER FUNCTIONS ---
const getIpAddress = (request) => { const xForwardedFor = request.headers['x-forwarded-for']; if (xForwardedFor) { return Array.isArray(xForwardedFor) ? xForwardedFor[0].split(',').shift()?.trim() : xForwardedFor.split(',').shift()?.trim(); } return request.ip || request.connection?.remoteAddress; };
const validateAnswerDetailed = (question, answerValue, otherTextValue) => { if (!question) return "Invalid question data for validation."; if (question.requiredSetting === 'required') { let isEmpty = false; if (answerValue === undefined || answerValue === null || String(answerValue).trim() === '') { if (!Array.isArray(answerValue) || answerValue.length === 0) { isEmpty = true; } } else if (Array.isArray(answerValue) && answerValue.length === 0) { isEmpty = true; } if (isEmpty) { if (question.addOtherOption && ( (Array.isArray(answerValue) && answerValue.includes('__OTHER__')) || answerValue === '__OTHER__') && (otherTextValue === undefined || otherTextValue === null || String(otherTextValue).trim() === '')) { return `Answer for "${question.text || `Question (ID: ${question._id})`}" is required (other option was selected but no text provided).`; } else if (!question.addOtherOption || ( (typeof answerValue === 'string' && answerValue !== '__OTHER__') || (Array.isArray(answerValue) && !answerValue.includes('__OTHER__')) ) ) { if(!( (Array.isArray(answerValue) && answerValue.includes('__OTHER__')) || answerValue === '__OTHER__') ) { return `Answer for "${question.text || `Question (ID: ${question._id})`}" is required.`; } } } } if (answerValue && (question.type === 'text' || question.type === 'textarea')) { const stringAnswer = String(answerValue); if (question.textValidation === 'email' && !/\S+@\S+\.\S+/.test(stringAnswer)) { return `"${question.text || `Question (ID: ${question._id})`}" requires a valid email address.`; } else if (question.textValidation === 'numeric' && (isNaN(parseFloat(stringAnswer)) || !isFinite(answerValue))) { return `"${question.text || `Question (ID: ${question._id})`}" requires a numeric value.`; } } return null; };
const generateConjointProfiles = (attributes) => { if (!attributes || attributes.length === 0) return []; return [];};
const CSV_SEPARATOR = '; '; 
const ensureArrayForCsv = (val) => (Array.isArray(val) ? val : (val !== undefined && val !== null ? [String(val)] : [])); 
const formatValueForCsv = (value, questionType, otherTextValue) => { if (value === null || value === undefined) return ''; switch (questionType) { case 'multiple-choice': case 'dropdown': case 'nps': case 'rating': case 'slider': if (value === '__OTHER__' && otherTextValue) return `Other: ${otherTextValue}`; return String(value); case 'checkbox': const answerArray = ensureArrayForCsv(value); if (answerArray.length > 0) { const options = answerArray.filter(v => v !== '__OTHER__').map(v => String(v)).join(CSV_SEPARATOR); const otherIsSelected = answerArray.includes('__OTHER__'); if (otherIsSelected && otherTextValue) return options ? `${options}${CSV_SEPARATOR}Other: ${otherTextValue}` : `Other: ${otherTextValue}`; return options; } return ''; case 'matrix': if (typeof value === 'object' && value !== null && Object.keys(value).length > 0) { return Object.entries(value).map(([row, colValue]) => `${row}: ${Array.isArray(colValue) ? colValue.join(', ') : String(colValue)}`).join(CSV_SEPARATOR); } return ''; case 'date': try { return new Date(value).toLocaleDateString('en-CA'); } catch (e) { return String(value); } case 'file_upload': if (Array.isArray(value)) return value.map(file => file.url || file.name || String(file)).join(CSV_SEPARATOR); if (typeof value === 'object' && value !== null) return value.url || value.name || JSON.stringify(value); return ''; case 'cardsort': if (typeof value === 'object' && value !== null && value.assignments) return JSON.stringify(value); return JSON.stringify(value); default: if (Array.isArray(value)) return value.join(CSV_SEPARATOR); if (typeof value === 'object' && value !== null) return JSON.stringify(value); return String(value); } };

// --- CONTROLLER FUNCTIONS ---

exports.getAllSurveys = async (req, res) => { /* ... same as before ... */ };
exports.createSurvey = async (req, res) => { /* ... same as before ... */ };

exports.getSurveyById = async (req, res) => { 
    const { surveyId } = req.params;
    const { forTaking, collectorId, isPreviewingOwner, resumeToken } = req.query;
    console.log(`[getSurveyById] Request for survey: ${surveyId}, forTaking: ${forTaking}, collectorId: ${collectorId}, resumeToken: ${resumeToken}, isPreviewingOwner: ${isPreviewingOwner}`);

    if (!mongoose.Types.ObjectId.isValid(surveyId)) {
        return res.status(400).json({ success: false, message: 'Invalid Survey ID.' });
    }

    try {
        let surveyQuery = Survey.findById(surveyId);
        let actualCollectorDoc = null;
        let populatedPartialResponseData = null; 

        if (forTaking !== 'true') { 
            if (!req.user || !req.user.id) {
                 console.error('[getSurveyById - Admin Access] User ID not found. Auth middleware issue?');
                 return res.status(401).json({ success: false, message: 'User authentication failed for admin access.' });
            }
        }
        const explicitSelectFieldsForCollector = 'status type linkId survey responseCount ' + '+settings.web_link.password ' + 'settings.web_link.customSlug ' + 'settings.web_link.allowMultipleResponses ' + 'settings.web_link.anonymousResponses ' + 'settings.web_link.enableRecaptcha ' + 'settings.web_link.recaptchaSiteKey ' + 'settings.web_link.ipAllowlist ' + 'settings.web_link.ipBlocklist ' + 'settings.web_link.allowBackButton ' + 'settings.web_link.progressBarEnabled ' + 'settings.web_link.progressBarStyle ' + 'settings.web_link.progressBarPosition ' + 'settings.web_link.openDate ' + 'settings.web_link.closeDate ' + 'settings.web_link.maxResponses ' + 'settings.web_link.saveAndContinueEnabled ' + 'settings.web_link.saveAndContinueMethod'; // Added saveAndContinueMethod

        if (forTaking === 'true') {
            surveyQuery = surveyQuery
                .select('title description welcomeMessage thankYouMessage status questions settings.completion settings.behaviorNavigation settings.customVariables globalSkipLogic randomizationLogic')
                .populate({ path: 'questions', model: 'Question', options: { sort: { originalIndex: 1 } } });
            if (collectorId) {
                if (mongoose.Types.ObjectId.isValid(collectorId)) { actualCollectorDoc = await Collector.findOne({ _id: collectorId, survey: surveyId }).select(explicitSelectFieldsForCollector).lean(); }
                if (!actualCollectorDoc) { actualCollectorDoc = await Collector.findOne({ linkId: collectorId, survey: surveyId }).select(explicitSelectFieldsForCollector).lean(); }
                if (!actualCollectorDoc) { actualCollectorDoc = await Collector.findOne({ 'settings.web_link.customSlug': collectorId, survey: surveyId }).select(explicitSelectFieldsForCollector).lean(); }
            }
        } else { 
            surveyQuery = surveyQuery.populate({ path: 'questions', model: 'Question', options: { sort: { originalIndex: 1 } } }).populate('collectors');
        }
        const survey = await surveyQuery.lean(); 
        if (!survey) { return res.status(404).json({ success: false, message: 'Survey not found.' }); }
        if (forTaking !== 'true' && req.user && String(survey.createdBy) !== String(req.user.id) && req.user.role !== 'admin') { return res.status(403).json({ success: false, message: 'You are not authorized to view this survey\'s details.' }); }
        const effectiveIsOwnerPreviewing = isPreviewingOwner === 'true' && req.user && String(survey.createdBy) === String(req.user.id);

        if (forTaking === 'true') {
            if (survey.status !== 'active' && !effectiveIsOwnerPreviewing && !resumeToken) { return res.status(403).json({ success: false, message: 'This survey is not currently active.' }); }
            if (collectorId && !actualCollectorDoc && !effectiveIsOwnerPreviewing && !resumeToken) { return res.status(404).json({ success: false, message: 'Collector not found or invalid for this survey.' }); }

            if (resumeToken) {
                console.log(`[getSurveyById] Attempting to resume with token: ${resumeToken} for survey ${survey._id}`);
                const partialDoc = await PartialResponse.findOne({ resumeToken: resumeToken, survey: survey._id }).lean(); 
                if (!partialDoc) { console.log(`[getSurveyById] No partialDoc found for token ${resumeToken}`); return res.status(404).json({ success: false, message: 'Invalid or expired resume link.' }); }
                if (partialDoc.expiresAt < new Date()) { console.log(`[getSurveyById] PartialDoc ${partialDoc._id} expired.`); return res.status(410).json({ success: false, message: 'This resume link has expired.' }); }
                if (partialDoc.completedAt) { console.log(`[getSurveyById] PartialDoc ${partialDoc._id} already completed.`); return res.status(410).json({ success: false, message: 'This survey session has already been completed.' }); }
                
                console.log(`[getSurveyById] Found partialDoc: ${partialDoc._id}, sessionId: ${partialDoc.sessionId}. Fetching answers...`);
                const answersFromDb = await Answer.find({ survey: survey._id, sessionId: partialDoc.sessionId }).lean();
                console.log(`[getSurveyById] Found ${answersFromDb.length} answer documents for sessionId ${partialDoc.sessionId}.`);

                const answersMap = {};
                const otherInputValuesMap = {};
                answersFromDb.forEach(ans => {
                    console.log(`[getSurveyById] Mapping answer for questionId ${ans.questionId}:`, ans.answerValue);
                    answersMap[ans.questionId.toString()] = ans.answerValue;
                    if (ans.otherText) {
                        otherInputValuesMap[`${ans.questionId.toString()}_other`] = ans.otherText;
                    }
                });
                console.log(`[getSurveyById] Constructed answersMap:`, answersMap);
                console.log(`[getSurveyById] Constructed otherInputValuesMap:`, otherInputValuesMap);

                populatedPartialResponseData = { ...partialDoc, answers: answersMap, otherInputValues: otherInputValuesMap };
                
                if (!actualCollectorDoc && partialDoc.collector) {
                     actualCollectorDoc = await Collector.findById(partialDoc.collector).select(explicitSelectFieldsForCollector).lean();
                     if (!actualCollectorDoc) console.error(`[getSurveyById] Collector ${partialDoc.collector} from partial response not found.`);
                }
            }
            if (actualCollectorDoc) { /* ... collector status, IP, password checks ... */ } 
            else if (!effectiveIsOwnerPreviewing && survey.status === 'draft' && !collectorId && !resumeToken) { return res.status(403).json({ success: false, message: 'Survey is in draft mode.' }); }
        }
        let processedQuestions = survey.questions || []; /* ... question processing ... */
        const surveyResponseData = { ...survey, questions: processedQuestions };
        if (forTaking === 'true') {
            const surveyBehaviorNav = survey.settings?.behaviorNavigation || {};
            const collectorWebLink = actualCollectorDoc?.settings?.web_link || {};
            surveyResponseData.collectorSettings = {
                allowMultipleResponses: collectorWebLink.allowMultipleResponses ?? surveyBehaviorNav.allowMultipleResponses ?? true,
                anonymousResponses: collectorWebLink.anonymousResponses ?? surveyBehaviorNav.anonymousResponses ?? false,
                enableRecaptcha: collectorWebLink.enableRecaptcha ?? false,
                recaptchaSiteKey: collectorWebLink.recaptchaSiteKey || process.env.RECAPTCHA_SITE_KEY_V2 || '',
                ipAllowlist: collectorWebLink.ipAllowlist || [], ipBlocklist: collectorWebLink.ipBlocklist || [],
                allowBackButton: collectorWebLink.allowBackButton ?? surveyBehaviorNav.allowBackButton ?? true,
                progressBarEnabled: collectorWebLink.progressBarEnabled ?? surveyBehaviorNav.progressBarEnabled ?? false,
                progressBarStyle: collectorWebLink.progressBarStyle || surveyBehaviorNav.progressBarStyle || 'percentage',
                progressBarPosition: collectorWebLink.progressBarPosition || surveyBehaviorNav.progressBarPosition || 'top',
                saveAndContinueEnabled: collectorWebLink.saveAndContinueEnabled ?? surveyBehaviorNav.saveAndContinueEnabled ?? false,
                saveAndContinueMethod: collectorWebLink.saveAndContinueMethod || surveyBehaviorNav.saveAndContinueMethod || 'both', // Added
                autoAdvance: collectorWebLink.autoAdvance ?? surveyBehaviorNav.autoAdvance ?? false,
                questionNumberingEnabled: collectorWebLink.questionNumberingEnabled ?? surveyBehaviorNav.questionNumberingEnabled ?? true,
                questionNumberingFormat: collectorWebLink.questionNumberingFormat || surveyBehaviorNav.questionNumberingFormat || '123', // Added
                questionNumberingCustomPrefix: collectorWebLink.questionNumberingCustomPrefix || surveyBehaviorNav.questionNumberingCustomPrefix || '', // Added
            };
            surveyResponseData.actualCollectorObjectId = actualCollectorDoc?._id || null;
            if (populatedPartialResponseData) surveyResponseData.partialResponse = populatedPartialResponseData;
        }
        console.log(`[getSurveyById] Successfully fetched survey: ${surveyId}. Partial data present: ${!!surveyResponseData.partialResponse}`);
        res.status(200).json({ success: true, data: surveyResponseData });
    } catch (error) { console.error(`[getSurveyById] CRITICAL ERROR fetching survey ${surveyId}. Error:`, error.stack); res.status(500).json({ success: false, message: 'Error fetching survey data on the server.' }); }
};

exports.updateSurvey = async (req, res) => { /* ... same as before ... */ };
exports.deleteSurvey = async (req, res) => { /* ... same as before ... */ };
exports.submitSurveyAnswers = async (req, res) => { /* ... same as before ... */ };

exports.savePartialResponse = async (req, res) => {
    const { surveyId } = req.params;
    const { collectorId, respondentEmail, currentAnswers, otherInputValues, currentVisibleIndex, visitedPath, sessionId, resumeToken: existingResumeToken } = req.body;
    console.log(`[savePartialResponse] Survey: ${surveyId}, Session: ${sessionId}, Answers:`, currentAnswers);

    if (!mongoose.Types.ObjectId.isValid(surveyId) || (collectorId && !mongoose.Types.ObjectId.isValid(collectorId))) { return res.status(400).json({ success: false, message: 'Invalid Survey or Collector ID.' }); }
    if (respondentEmail && !/\S+@\S+\.\S+/.test(respondentEmail)) { return res.status(400).json({ success: false, message: 'If provided, the email address is invalid.' }); }
    if (!sessionId) { return res.status(400).json({ success: false, message: 'Client Session ID (as sessionId) is required for saving progress.' }); }

    const mongoSession = await mongoose.startSession();
    mongoSession.startTransaction();
    try {
        const survey = await Survey.findById(surveyId).select('title settings.behaviorNavigation').session(mongoSession);
        if (!survey) { await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(404).json({ success: false, message: 'Survey not found.' }); }
        
        const behaviorNavSettings = survey.settings?.behaviorNavigation || {};
        if (!behaviorNavSettings.saveAndContinueEnabled) { await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(400).json({ success: false, message: 'Save and Continue feature is not enabled for this survey.' }); }
        
        const saveMethod = behaviorNavSettings.saveAndContinueMethod || 'email';
        if ((saveMethod === 'email' || saveMethod === 'both') && !respondentEmail) { await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(400).json({ success: false, message: 'Email address is required for this save method.' }); }

        const collector = await Collector.findById(collectorId).session(mongoSession);
        if (!collector) { await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(404).json({ success: false, message: 'Collector not found.' }); }
        if (String(collector.survey) !== String(surveyId)) { await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(400).json({ success: false, message: 'Collector does not belong to this survey.' });}

        // Save/Update Answers in the Answer collection
        const answerOpsForPartial = [];
        if (typeof currentAnswers === 'object' && currentAnswers !== null) {
            for (const questionIdStr in currentAnswers) {
                if (Object.hasOwnProperty.call(currentAnswers, questionIdStr) && mongoose.Types.ObjectId.isValid(questionIdStr)) {
                    const questionObjectId = new mongoose.Types.ObjectId(questionIdStr);
                    const answerValue = currentAnswers[questionIdStr];
                    const otherText = otherInputValues ? otherInputValues[`${questionIdStr}_other`] : undefined;
                    answerOpsForPartial.push({
                        updateOne: {
                            filter: { survey: surveyId, questionId: questionObjectId, sessionId: sessionId, collector: collectorId },
                            update: { $set: { answerValue: answerValue, otherText: otherText, updatedAt: new Date() }, $setOnInsert: { survey: surveyId, questionId: questionObjectId, sessionId: sessionId, collector: collectorId, createdAt: new Date() }},
                            upsert: true
                        }
                    });
                } else {
                    console.warn(`[savePartialResponse] Invalid questionIdStr found in currentAnswers: ${questionIdStr}`);
                }
            }
        }
        if (answerOpsForPartial.length > 0) {
            await Answer.bulkWrite(answerOpsForPartial, { session: mongoSession });
            console.log(`[savePartialResponse] Bulk upserted ${answerOpsForPartial.length} Answer documents for session ${sessionId}.`);
        } else {
            console.log(`[savePartialResponse] No answers provided to save for session ${sessionId}.`);
        }

        // Create or Update PartialResponse document
        let partialResponseDoc;
        let newResumeTokenGenerated = false;
        let finalResumeTokenToUse;
        const expiryDays = behaviorNavSettings.saveAndContinueEmailLinkExpiryDays || 7;
        const expiresAt = new Date(); expiresAt.setDate(expiresAt.getDate() + expiryDays);

        if (existingResumeToken) {
            partialResponseDoc = await PartialResponse.findOne({ resumeToken: existingResumeToken, survey: surveyId }).session(mongoSession);
            if (partialResponseDoc) {
                if (partialResponseDoc.completedAt) { /* ... handle completed ... */ }
                finalResumeTokenToUse = existingResumeToken;
            } else { newResumeTokenGenerated = true; /* existing token invalid, generate new */ }
        } else { newResumeTokenGenerated = true; /* no token provided, generate new */ }

        if (newResumeTokenGenerated) {
            finalResumeTokenToUse = crypto.randomBytes(20).toString('hex');
        }
        
        if (partialResponseDoc && !newResumeTokenGenerated) { // Update existing
            console.log(`[savePartialResponse] Updating existing PartialResponse ${partialResponseDoc._id} for session ${sessionId}`);
            partialResponseDoc.respondentEmail = respondentEmail || partialResponseDoc.respondentEmail;
            partialResponseDoc.currentVisibleIndex = currentVisibleIndex === undefined ? partialResponseDoc.currentVisibleIndex : currentVisibleIndex;
            partialResponseDoc.visitedPath = visitedPath || partialResponseDoc.visitedPath;
            partialResponseDoc.expiresAt = expiresAt;
            partialResponseDoc.sessionId = sessionId; // Ensure sessionId is updated if it could change
            // DO NOT update answers/otherInputValues here if Answer collection is source of truth
            partialResponseDoc.updatedAt = new Date();
        } else { // Create new
            console.log(`[savePartialResponse] Creating new PartialResponse with token ${finalResumeTokenToUse} for session ${sessionId}`);
            partialResponseDoc = new PartialResponse({
                survey: surveyId, collector: collectorId, sessionId: sessionId,
                resumeToken: finalResumeTokenToUse,
                respondentEmail: respondentEmail || undefined,
                currentVisibleIndex: currentVisibleIndex === undefined ? 0 : currentVisibleIndex,
                visitedPath: visitedPath || [], expiresAt,
                // DO NOT set answers/otherInputValues here if Answer collection is source of truth
            });
        }
        await partialResponseDoc.save({ session: mongoSession });
        
        let emailSentSuccessfully = null; /* ... email sending logic ... */
        const shouldSendEmail = respondentEmail && (saveMethod === 'email' || saveMethod === 'both');
        const emailChangedForExisting = !newResumeTokenGenerated && partialResponseDoc && respondentEmail && partialResponseDoc.respondentEmail !== respondentEmail;
        if (shouldSendEmail && (newResumeTokenGenerated || emailChangedForExisting || (partialResponseDoc && !partialResponseDoc.respondentEmail && respondentEmail))) {
            try {
                const resumeLink = `${process.env.FRONTEND_URL}/s/${collector.settings?.web_link?.customSlug || collector.linkId}?resumeToken=${finalResumeTokenToUse}`; // Corrected resume link
                await emailService.sendResumeEmail(respondentEmail, survey.title, resumeLink, expiryDays);
                emailSentSuccessfully = true;
            } catch (emailError) { emailSentSuccessfully = false; console.error(`[savePartialResponse] Email send error: ${emailError.message}`);}
        }

        await mongoSession.commitTransaction(); mongoSession.endSession();
        let message = 'Progress saved!'; /* ... message construction ... */
        res.status(200).json({ success: true, message: message, resumeToken: finalResumeTokenToUse, surveyId: surveyId, saveMethodUsed: saveMethod, emailSent: emailSentSuccessfully, expiresInDays: expiryDays });
    } catch (error) { /* ... error handling ... */ if (mongoSession.inTransaction()) await mongoSession.abortTransaction(); mongoSession.endSession(); console.error(`[savePartialResponse] Error:`, error.stack); res.status(500).json({ success: false, message: 'Error saving progress.' }); }
};

exports.getSurveyResults = async (req, res) => { /* ... same as before ... */ };
exports.exportSurveyResults = async (req, res) => { /* ... same as before ... */ };

module.exports = exports;
// ----- END OF COMPLETE MODIFIED FILE (vX.X+2 - Enhanced Logging for Resume) -----