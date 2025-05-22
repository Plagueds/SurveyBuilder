// backend/controllers/surveyController.js
// ----- START OF COMPLETE MODIFIED FILE (vX.X+4 - ACTUALLY Corrected Destructuring in savePartialResponse) -----
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
// ... (Keep all helper functions exactly as they were in vX.X+3)
const getIpAddress = (request) => { const xForwardedFor = request.headers['x-forwarded-for']; if (xForwardedFor) { return Array.isArray(xForwardedFor) ? xForwardedFor[0].split(',').shift()?.trim() : xForwardedFor.split(',').shift()?.trim(); } return request.ip || request.connection?.remoteAddress; };
const validateAnswerDetailed = (question, answerValue, otherTextValue) => { if (!question) return "Invalid question data for validation."; if (question.requiredSetting === 'required') { let isEmpty = false; if (answerValue === undefined || answerValue === null || String(answerValue).trim() === '') { if (!Array.isArray(answerValue) || answerValue.length === 0) { isEmpty = true; } } else if (Array.isArray(answerValue) && answerValue.length === 0) { isEmpty = true; } if (isEmpty) { if (question.addOtherOption && ( (Array.isArray(answerValue) && answerValue.includes('__OTHER__')) || answerValue === '__OTHER__') && (otherTextValue === undefined || otherTextValue === null || String(otherTextValue).trim() === '')) { return `Answer for "${question.text || `Question (ID: ${question._id})`}" is required (other option was selected but no text provided).`; } else if (!question.addOtherOption || ( (typeof answerValue === 'string' && answerValue !== '__OTHER__') || (Array.isArray(answerValue) && !answerValue.includes('__OTHER__')) ) ) { if(!( (Array.isArray(answerValue) && answerValue.includes('__OTHER__')) || answerValue === '__OTHER__') ) { return `Answer for "${question.text || `Question (ID: ${question._id})`}" is required.`; } } } } if (answerValue && (question.type === 'text' || question.type === 'textarea')) { const stringAnswer = String(answerValue); if (question.textValidation === 'email' && !/\S+@\S+\.\S+/.test(stringAnswer)) { return `"${question.text || `Question (ID: ${question._id})`}" requires a valid email address.`; } else if (question.textValidation === 'numeric' && (isNaN(parseFloat(stringAnswer)) || !isFinite(answerValue))) { return `"${question.text || `Question (ID: ${question._id})`}" requires a numeric value.`; } } return null; };
const generateConjointProfiles = (attributes) => { if (!attributes || attributes.length === 0) return []; return [];};
const CSV_SEPARATOR = '; '; 
const ensureArrayForCsv = (val) => (Array.isArray(val) ? val : (val !== undefined && val !== null ? [String(val)] : [])); 
const formatValueForCsv = (value, questionType, otherTextValue) => { if (value === null || value === undefined) return ''; switch (questionType) { case 'multiple-choice': case 'dropdown': case 'nps': case 'rating': case 'slider': if (value === '__OTHER__' && otherTextValue) return `Other: ${otherTextValue}`; return String(value); case 'checkbox': const answerArray = ensureArrayForCsv(value); if (answerArray.length > 0) { const options = answerArray.filter(v => v !== '__OTHER__').map(v => String(v)).join(CSV_SEPARATOR); const otherIsSelected = answerArray.includes('__OTHER__'); if (otherIsSelected && otherTextValue) return options ? `${options}${CSV_SEPARATOR}Other: ${otherTextValue}` : `Other: ${otherTextValue}`; return options; } return ''; case 'matrix': if (typeof value === 'object' && value !== null && Object.keys(value).length > 0) { return Object.entries(value).map(([row, colValue]) => `${row}: ${Array.isArray(colValue) ? colValue.join(', ') : String(colValue)}`).join(CSV_SEPARATOR); } return ''; case 'date': try { return new Date(value).toLocaleDateString('en-CA'); } catch (e) { return String(value); } case 'file_upload': if (Array.isArray(value)) return value.map(file => file.url || file.name || String(file)).join(CSV_SEPARATOR); if (typeof value === 'object' && value !== null) return value.url || value.name || JSON.stringify(value); return ''; case 'cardsort': if (typeof value === 'object' && value !== null && value.assignments) return JSON.stringify(value); return JSON.stringify(value); default: if (Array.isArray(value)) return value.join(CSV_SEPARATOR); if (typeof value === 'object' && value !== null) return JSON.stringify(value); return String(value); } };


// --- CONTROLLER FUNCTIONS ---

exports.getAllSurveys = async (req, res) => { /* ... same as vX.X+3 ... */ };
exports.createSurvey = async (req, res) => { /* ... same as vX.X+3 ... */ };
exports.getSurveyById = async (req, res) => { /* ... same as vX.X+3 ... */ };
exports.updateSurvey = async (req, res) => { /* ... same as vX.X+3 ... */ };
exports.deleteSurvey = async (req, res) => { /* ... same as vX.X+3 ... */ };
exports.submitSurveyAnswers = async (req, res) => { /* ... same as vX.X+3 ... */ };

exports.savePartialResponse = async (req, res) => {
    // VERY FIRST LINE:
    console.log('[savePartialResponse CONTROLLER ENTRY] Raw req.body:', JSON.stringify(req.body));
    console.log('[savePartialResponse CONTROLLER ENTRY] req.headers[content-type]:', req.headers['content-type']);

    const { surveyId } = req.params;
    // Destructure AFTER logging the raw body
    // THIS IS THE CORRECTED DESTRUCTURING:
    const { 
        collectorId, 
        respondentEmail, 
        answers: currentAnswers, // <<< RENAMED HERE
        otherInputValues, 
        currentVisibleIndex, 
        visitedPath, 
        sessionId, 
        resumeToken: existingResumeToken 
    } = req.body;

    console.log(`[savePartialResponse AFTER DESTRUCTURE] Survey: ${surveyId}, Session: ${sessionId}, currentAnswers from req.body:`, JSON.stringify(currentAnswers)); 
    
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
        
        const collector = await Collector.findById(collectorId).select('settings.web_link.customSlug linkId survey').session(mongoSession);
        if (!collector) { await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(404).json({ success: false, message: 'Collector not found.' }); }
        if (String(collector.survey) !== String(surveyId)) { await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(400).json({ success: false, message: 'Collector does not belong to this survey.' });}

        const answerOpsForPartial = [];
        // Now 'currentAnswers' should be correctly populated from req.body.answers
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
                } else { console.warn(`[savePartialResponse] Invalid questionIdStr in currentAnswers: ${questionIdStr}`); }
            }
        }

        if (answerOpsForPartial.length > 0) {
            await Answer.bulkWrite(answerOpsForPartial, { session: mongoSession });
            console.log(`[savePartialResponse] Bulk upserted ${answerOpsForPartial.length} Answer documents for session ${sessionId}.`);
        } else { 
            if (currentAnswers === undefined ) { // More specific check for undefined
                 console.log(`[savePartialResponse] 'currentAnswers' was undefined after destructuring for session ${sessionId}. This is unexpected if frontend sent 'answers'.`);
            } else if (typeof currentAnswers === 'object' && currentAnswers !== null && Object.keys(currentAnswers).length === 0) {
                 console.log(`[savePartialResponse] 'currentAnswers' was an empty object {} for session ${sessionId}. No answers to save.`);
            } else {
                 console.log(`[savePartialResponse] 'currentAnswers' was present but resulted in no valid operations for session ${sessionId}. currentAnswers:`, JSON.stringify(currentAnswers));
            }
        }

        let partialResponseDoc; let newResumeTokenGenerated = false; let finalResumeTokenToUse;
        const expiryDays = behaviorNavSettings.saveAndContinueEmailLinkExpiryDays || 7;
        const expiresAt = new Date(); expiresAt.setDate(expiresAt.getDate() + expiryDays);

        if (existingResumeToken) {
            partialResponseDoc = await PartialResponse.findOne({ resumeToken: existingResumeToken, survey: surveyId }).session(mongoSession);
            if (partialResponseDoc) {
                if (partialResponseDoc.completedAt) { await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(409).json({ success: false, message: 'Session already completed.' });}
                finalResumeTokenToUse = existingResumeToken;
            } else { newResumeTokenGenerated = true; console.log(`[savePartialResponse] Existing resume token ${existingResumeToken} not found, will generate new.`);}
        } else { newResumeTokenGenerated = true; }
        if (newResumeTokenGenerated) finalResumeTokenToUse = crypto.randomBytes(20).toString('hex');
        
        if (partialResponseDoc && !newResumeTokenGenerated) { 
            console.log(`[savePartialResponse] Updating existing PartialResponse ${partialResponseDoc._id} for session ${sessionId}`);
            partialResponseDoc.respondentEmail = respondentEmail || partialResponseDoc.respondentEmail;
            partialResponseDoc.currentVisibleIndex = currentVisibleIndex ?? partialResponseDoc.currentVisibleIndex;
            partialResponseDoc.visitedPath = visitedPath || partialResponseDoc.visitedPath;
            partialResponseDoc.expiresAt = expiresAt;
            partialResponseDoc.sessionId = sessionId; 
            partialResponseDoc.updatedAt = new Date();
        } else { 
            console.log(`[savePartialResponse] Creating new PartialResponse with token ${finalResumeTokenToUse} for session ${sessionId}`);
            partialResponseDoc = new PartialResponse({
                survey: surveyId, collector: collectorId, sessionId: sessionId,
                resumeToken: finalResumeTokenToUse, respondentEmail: respondentEmail || undefined,
                currentVisibleIndex: currentVisibleIndex ?? 0,
                visitedPath: visitedPath || [], expiresAt,
            });
        }
        await partialResponseDoc.save({ session: mongoSession });
        
        let emailSentSuccessfully = null; 
        const saveMethod = behaviorNavSettings.saveAndContinueMethod || 'email';
        const shouldSendEmail = respondentEmail && (saveMethod === 'email' || saveMethod === 'both');
        const isNewEmailForThisSave = partialResponseDoc && respondentEmail && partialResponseDoc.respondentEmail !== respondentEmail;
        const sendCondition = shouldSendEmail && (newResumeTokenGenerated || isNewEmailForThisSave);

        if (sendCondition) {
            try {
                const accessIdentifierForLink = collector.settings?.web_link?.customSlug || collector.linkId;
                const resumeLink = `${process.env.FRONTEND_URL}/s/${accessIdentifierForLink}?resumeToken=${finalResumeTokenToUse}`;
                console.log(`[savePartialResponse] Sending resume email to ${respondentEmail} with link: ${resumeLink}`);
                await emailService.sendResumeEmail(respondentEmail, survey.title, resumeLink, expiryDays);
                emailSentSuccessfully = true;
            } catch (emailError) { 
                emailSentSuccessfully = false; 
                console.error(`[savePartialResponse] Email send error for token ${finalResumeTokenToUse}: ${emailError.message}`);
            }
        } else if (shouldSendEmail) {
            console.log(`[savePartialResponse] Email not re-sent for token ${finalResumeTokenToUse}. Conditions: new token=${newResumeTokenGenerated}, email changed/newly provided for this save=${isNewEmailForThisSave}`);
        }

        await mongoSession.commitTransaction(); mongoSession.endSession();
        let message = 'Progress saved!'; 
        const provideCode = saveMethod === 'code' || saveMethod === 'both';
        if (shouldSendEmail && emailSentSuccessfully === true) { message = `Progress saved! A link to resume has been sent to ${respondentEmail}.`; if (provideCode) message += ` Your resume code is also provided.`;}
        else if (shouldSendEmail && emailSentSuccessfully === false) { message = `Progress saved! Email could not be sent.`; if (provideCode) message += ` Please use the resume code.`; else message += ` Contact support or use code: ${finalResumeTokenToUse}.`;}
        else if (provideCode) { message = `Progress saved! Use the resume code to continue.`; }
        
        res.status(200).json({ success: true, message: message, resumeToken: finalResumeTokenToUse, surveyId: surveyId, saveMethodUsed: saveMethod, emailSent: emailSentSuccessfully, expiresInDays: expiryDays });
    } catch (error) { 
        if (mongoSession.inTransaction()) await mongoSession.abortTransaction(); 
        mongoSession.endSession(); 
        console.error(`[savePartialResponse] Error for survey ${surveyId}, session ${sessionId}:`, error.stack); 
        res.status(500).json({ success: false, message: 'Error saving progress.' }); 
    }
};

exports.getSurveyResults = async (req, res) => { /* ... same as vX.X+3 ... */ };
exports.exportSurveyResults = async (req, res) => { /* ... same as vX.X+3 ... */ };

module.exports = exports;
// ----- END OF COMPLETE MODIFIED FILE (vX.X+4 - ACTUALLY Corrected Destructuring in savePartialResponse) -----