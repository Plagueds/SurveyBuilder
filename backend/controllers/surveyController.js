// backend/controllers/surveyController.js
// ----- START OF COMPLETE UPDATED FILE -----
const mongoose = require('mongoose');
const { Parser } = require('json2csv');
const crypto = require('crypto');
const Survey = require('../models/Survey');
const Question = require('../models/Question');
const Answer = require('../models/Answer'); // Now we will use this actively
const Collector = require('../models/Collector');
const Response = require('../models/Response');
const PartialResponse = require('../models/PartialResponse');
const { evaluateAllLogic } = require('../utils/logicEvaluator');
const axios = require('axios');
const ipRangeCheck = require('ip-range-check');
const emailService = require('../services/emailService');

const getIpAddress = (request) => {
    const xForwardedFor = request.headers['x-forwarded-for'];
    if (xForwardedFor) {
        return Array.isArray(xForwardedFor) ? xForwardedFor[0].split(',').shift()?.trim() : xForwardedFor.split(',').shift()?.trim();
    }
    return request.ip || request.connection?.remoteAddress;
};

// Helper function for detailed answer validation (from previous response)
// ** This still needs your full implementation based on Question model's validation rules **
const validateAnswerDetailed = (question, answerValue, otherTextValue) => {
    if (!question) return "Invalid question data for validation."; // Safeguard

    // 1. Handle 'requiredSetting'
    if (question.requiredSetting === 'required') {
        let isEmpty = false;
        if (answerValue === undefined || answerValue === null || String(answerValue).trim() === '') {
            if (!Array.isArray(answerValue) || answerValue.length === 0) { // Check for empty array too
                 isEmpty = true;
            }
        } else if (Array.isArray(answerValue) && answerValue.length === 0) {
            isEmpty = true;
        }


        if (isEmpty) {
            if (question.addOtherOption && ( (Array.isArray(answerValue) && answerValue.includes('__OTHER__')) || answerValue === '__OTHER__') && (otherTextValue === undefined || otherTextValue === null || String(otherTextValue).trim() === '')) {
                return `Answer for "${question.text || `Question (ID: ${question._id})`}" is required (other option was selected but no text provided).`;
            } else if (!question.addOtherOption || ( (typeof answerValue === 'string' && answerValue !== '__OTHER__') || (Array.isArray(answerValue) && !answerValue.includes('__OTHER__')) ) ) {
                 // If it's not an "other" scenario and it's empty, it's required.
                 if(!( (Array.isArray(answerValue) && answerValue.includes('__OTHER__')) || answerValue === '__OTHER__') ) {
                    return `Answer for "${question.text || `Question (ID: ${question._id})`}" is required.`;
                 }
            }
        }
    }

    // 2. Handle 'textValidation'
    if (answerValue && (question.type === 'text' || question.type === 'textarea')) {
        const stringAnswer = String(answerValue);
        if (question.textValidation === 'email' && !/\S+@\S+\.\S+/.test(stringAnswer)) {
            return `"${question.text || `Question (ID: ${question._id})`}" requires a valid email address.`;
        } else if (question.textValidation === 'numeric' && (isNaN(parseFloat(stringAnswer)) || !isFinite(answerValue))) {
            return `"${question.text || `Question (ID: ${question._id})`}" requires a numeric value.`;
        }
    }
    // ... (Your more detailed validation logic here based on Question model)
    return null;
};


// --- EXISTING FUNCTIONS (getAllSurveys, createSurvey, getSurveyById, updateSurvey, deleteSurvey) ---
// **YOU MUST REPLACE THESE WITH YOUR FULLY WORKING VERSIONS.**
exports.getAllSurveys = async (req, res) => { /* ... YOUR FULL WORKING getAllSurveys ... */ 
    console.log('[getAllSurveys] Placeholder executed.');
    res.status(501).json({success: false, message: "getAllSurveys not fully implemented in this combined file."});
};
exports.createSurvey = async (req, res) => { /* ... YOUR FULL WORKING createSurvey ... */ 
    console.log('[createSurvey] Placeholder executed.');
    res.status(501).json({success: false, message: "createSurvey not fully implemented in this combined file."});
};
exports.getSurveyById = async (req, res) => { /* ... YOUR FULL WORKING getSurveyById ... */ 
    console.log('[getSurveyById] Placeholder executed.');
    res.status(501).json({success: false, message: "getSurveyById not fully implemented in this combined file."});
};
exports.updateSurvey = async (req, res) => { /* ... YOUR FULL WORKING updateSurvey ... */ 
    console.log('[updateSurvey] Placeholder executed.');
    res.status(501).json({success: false, message: "updateSurvey not fully implemented in this combined file."});
};
exports.deleteSurvey = async (req, res) => { /* ... YOUR FULL WORKING deleteSurvey ... */ 
    console.log('[deleteSurvey] Placeholder executed.');
    res.status(501).json({success: false, message: "deleteSurvey not fully implemented in this combined file."});
};


// --- SUBMIT SURVEY ANSWERS (REVISED FOR SEPARATE Answer DOCUMENTS) ---
exports.submitSurveyAnswers = async (req, res) => {
    const { surveyId } = req.params;
    const { collectorId, answers, otherInputValues, resumeToken, recaptchaTokenV2, clientSessionId, customVariablesFromClient } = req.body;

    console.log(`[SUBMIT ENDPOINT V2] Survey: ${surveyId}, Collector: ${collectorId}, ClientSessionId: ${clientSessionId}, ResumeToken: ${resumeToken}`);

    if (!mongoose.Types.ObjectId.isValid(surveyId)) {
        return res.status(400).json({ success: false, message: 'Invalid Survey ID.' });
    }
    if (!collectorId || !mongoose.Types.ObjectId.isValid(collectorId)) {
        return res.status(400).json({ success: false, message: 'Collector ID is required and must be valid.' });
    }
    if (!clientSessionId) {
        return res.status(400).json({ success: false, message: 'Client Session ID is required.' });
    }
    if (typeof answers !== 'object' || answers === null) {
        return res.status(400).json({ success: false, message: 'Answers must be an object.' });
    }


    const mongoSession = await mongoose.startSession();
    mongoSession.startTransaction();

    try {
        const survey = await Survey.findById(surveyId)
            .select('status questions settings.completion thankYouMessage')
            .populate({ path: 'questions', model: 'Question' })
            .session(mongoSession);

        if (!survey) { /* ... abort and return 404 ... */ await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(404).json({ success: false, message: 'Survey not found.' }); }
        if (survey.status !== 'active') { /* ... abort and return 403 ... */ await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(403).json({ success: false, message: 'This survey is not active.' }); }

        const collector = await Collector.findById(collectorId)
            .select('status settings survey responseCount')
            .session(mongoSession);

        if (!collector) { /* ... abort and return 404 ... */ await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(404).json({ success: false, message: 'Collector not found.' }); }
        if (String(collector.survey) !== String(surveyId)) { /* ... abort and return 400 ... */ await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(400).json({ success: false, message: 'Collector mismatch.' }); }
        if (collector.status !== 'open') { /* ... abort and return 403 ... */ await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(403).json({ success: false, message: `Link is ${collector.status}.` }); }

        const respondentIp = getIpAddress(req);
        const userAgent = req.headers['user-agent'];

        // --- reCAPTCHA v2 Verification ---
        if (collector.settings?.web_link?.enableRecaptcha) {
            // ... (reCAPTCHA logic from previous response - no changes needed here)
            const secretKey = process.env.RECAPTCHA_SECRET_KEY;
            if (!recaptchaTokenV2) { await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(400).json({ success: false, message: 'reCAPTCHA token missing.' }); }
            if (!secretKey) { console.error('[SUBMIT ENDPOINT V2] RECAPTCHA_SECRET_KEY not set.'); await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(500).json({ success: false, message: 'reCAPTCHA server config error.' }); }
            const verificationURL = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${recaptchaTokenV2}&remoteip=${respondentIp}`;
            try {
                const recaptchaRes = await axios.post(verificationURL);
                if (!recaptchaRes.data.success) {
                    console.warn('[SUBMIT ENDPOINT V2] reCAPTCHA v2 verification failed:', recaptchaRes.data['error-codes']);
                    await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(400).json({ success: false, message: 'reCAPTCHA verification failed.', details: recaptchaRes.data['error-codes'] });
                }
                console.log('[SUBMIT ENDPOINT V2] reCAPTCHA v2 verified successfully.');
            } catch (e) {
                console.error("[SUBMIT ENDPOINT V2] reCAPTCHA HTTP error:", e.message);
                await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(500).json({ success: false, message: 'Error verifying reCAPTCHA.' });
            }
        }

        // --- "Allow Multiple Responses" Logic ---
        if (!collector.settings?.web_link?.allowMultipleResponses) {
            // ... (Logic from previous response - no changes needed here)
            const isAnonymous = collector.settings?.web_link?.anonymousResponses || false;
            const queryCriteria = { survey: surveyId, collector: collectorId, status: 'completed' };
            if (isAnonymous) { if (respondentIp) queryCriteria.ipAddress = respondentIp; }
            else if (req.user && req.user._id) { queryCriteria.userId = req.user._id; } // Assumes Response model has 'userId'
            else if (respondentIp) { queryCriteria.ipAddress = respondentIp; }
            if (queryCriteria.ipAddress || queryCriteria.userId) {
                 const existingFullResponse = await Response.findOne(queryCriteria).session(mongoSession);
                 if (existingFullResponse) { await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(403).json({ success: false, message: 'You have already submitted this survey.' });}
            }
        }
        
        // --- Detailed Answer Validation ---
        const validationErrors = [];
        const questionsMap = new Map(survey.questions.map(q => [q._id.toString(), q]));

        for (const questionIdStr in answers) {
            if (Object.hasOwnProperty.call(answers, questionIdStr)) {
                const question = questionsMap.get(questionIdStr);
                if (!question) {
                    console.warn(`[SUBMIT ENDPOINT V2] Answer provided for non-existent or non-fetched question ID: ${questionIdStr}`);
                    validationErrors.push({ questionId: questionIdStr, message: "Answer provided for an unknown question." });
                    continue; 
                }
                const answerValue = answers[questionIdStr];
                const otherText = otherInputValues ? otherInputValues[`${questionIdStr}_other`] : undefined;
                const error = validateAnswerDetailed(question, answerValue, otherText);
                if (error) {
                    validationErrors.push({ questionId: questionIdStr, text: question.text, message: error });
                }
            }
        }
        // Also validate questions that might be required but have no answer submitted
        for (const question of survey.questions) {
            if (!answers.hasOwnProperty(question._id.toString()) && question.requiredSetting === 'required') {
                 const error = validateAnswerDetailed(question, undefined, undefined); // Will trigger required error
                 if (error) {
                    validationErrors.push({ questionId: question._id.toString(), text: question.text, message: error });
                }
            }
        }

        if (validationErrors.length > 0) {
            await mongoSession.abortTransaction(); mongoSession.endSession();
            return res.status(400).json({ success: false, message: 'Answer validation failed.', errors: validationErrors });
        }

        // --- Handle Resumed Partial Response ---
        let partialResponseToUpdate = null;
        if (resumeToken) {
            // ... (Logic from previous response - no changes needed here)
            partialResponseToUpdate = await PartialResponse.findOne({ resumeToken, survey: surveyId, collector: collectorId }).session(mongoSession);
            if (partialResponseToUpdate) {
                if (partialResponseToUpdate.completedAt) { await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(409).json({ success: false, message: 'This survey session was already completed.' });}
            } else { console.warn(`[SUBMIT ENDPOINT V2] Valid resume token ${resumeToken} provided, but no matching partial response found.`); }
        }

        // --- Create/Update Response Document (Metadata Header) ---
        let responseDoc = await Response.findOne({
            survey: surveyId, collector: collectorId, sessionId: clientSessionId, status: 'partial'
        }).session(mongoSession);

        const isAnonymousResp = collector.settings?.web_link?.anonymousResponses || false;
        const startedAtForResponse = partialResponseToUpdate?.createdAt || responseDoc?.startedAt || new Date();

        if (responseDoc) {
            console.log(`[SUBMIT ENDPOINT V2] Updating existing partial Response doc ${responseDoc._id} for session ${clientSessionId} to completed.`);
            responseDoc.status = 'completed';
            // DO NOT store answers/otherInputValues directly on responseDoc anymore
            responseDoc.submittedAt = new Date(); // pre-save hook will also set this
            responseDoc.lastActivityAt = new Date();
            responseDoc.ipAddress = isAnonymousResp ? undefined : respondentIp;
            responseDoc.userAgent = isAnonymousResp ? undefined : userAgent;
            responseDoc.userId = (req.user && req.user._id && !isAnonymousResp && responseDoc.schema.path('userId')) ? req.user._id : undefined;
            responseDoc.customVariables = customVariablesFromClient || responseDoc.customVariables;
        } else {
            console.log(`[SUBMIT ENDPOINT V2] Creating new completed Response doc for session ${clientSessionId}.`);
            responseDoc = new Response({
                survey: surveyId, collector: collectorId, sessionId: clientSessionId,
                status: 'completed', startedAt: startedAtForResponse,
                // submittedAt will be set by pre-save
                lastActivityAt: new Date(),
                ipAddress: isAnonymousResp ? undefined : respondentIp,
                userAgent: isAnonymousResp ? undefined : userAgent,
                userId: (req.user && req.user._id && !isAnonymousResp && Response.schema.path('userId')) ? req.user._id : undefined,
                customVariables: customVariablesFromClient || {},
            });
        }
        await responseDoc.save({ session: mongoSession });

        // --- Create/Update Individual Answer Documents ---
        console.log(`[SUBMIT ENDPOINT V2] Processing ${Object.keys(answers).length} answers for session ${clientSessionId}.`);
        const answerOps = [];
        for (const questionIdStr in answers) {
            if (Object.hasOwnProperty.call(answers, questionIdStr)) {
                const questionObjectId = new mongoose.Types.ObjectId(questionIdStr);
                const answerValue = answers[questionIdStr];
                const otherText = otherInputValues ? otherInputValues[`${questionIdStr}_other`] : undefined;

                answerOps.push({
                    updateOne: {
                        filter: { survey: surveyId, questionId: questionObjectId, sessionId: clientSessionId, collector: collectorId },
                        update: {
                            $set: {
                                answerValue: answerValue,
                                otherText: otherText,
                                updatedAt: new Date() // Explicitly set updatedAt
                            },
                            $setOnInsert: { // Fields to set only if a new document is inserted
                                survey: surveyId,
                                questionId: questionObjectId,
                                sessionId: clientSessionId,
                                collector: collectorId,
                                createdAt: new Date()
                            }
                        },
                        upsert: true // Create the answer doc if it doesn't exist, update if it does
                    }
                });
            }
        }
        if (answerOps.length > 0) {
            await Answer.bulkWrite(answerOps, { session: mongoSession });
            console.log(`[SUBMIT ENDPOINT V2] Bulk upserted ${answerOps.length} Answer documents.`);
        }


        if (partialResponseToUpdate) {
            partialResponseToUpdate.completedAt = new Date();
            partialResponseToUpdate.finalResponse = responseDoc._id;
            await partialResponseToUpdate.save({ session: mongoSession });
            console.log(`[SUBMIT ENDPOINT V2] Marked PartialResponse ${partialResponseToUpdate._id} as completed.`);
        }
        
        collector.responseCount = (collector.responseCount || 0) + 1;
        await collector.save({ session: mongoSession });

        await mongoSession.commitTransaction();
        mongoSession.endSession();

        console.log(`[SUBMIT ENDPOINT V2] Survey ${surveyId} submitted successfully. Response (Header) ID: ${responseDoc._id}`);
        res.status(201).json({
            success: true, message: 'Survey submitted successfully.',
            responseId: responseDoc._id, // ID of the main Response (header) document
            thankYouMessage: survey.thankYouMessage || { text: "Thank you for your response!" }
        });

    } catch (error) {
        if (mongoSession.inTransaction()) await mongoSession.abortTransaction();
        mongoSession.endSession();
        console.error(`[SUBMIT ENDPOINT V2] CRITICAL ERROR submitting survey ${surveyId}:`, error.stack);
        res.status(500).json({ success: false, message: 'An internal server error occurred.' });
    }
};
// --- END SUBMIT SURVEY ANSWERS (REVISED FOR SEPARATE Answer DOCUMENTS) ---


exports.savePartialResponse = async (req, res) => {
    // ... (Keep your existing savePartialResponse)
    // **IMPORTANT**: Your `savePartialResponse` will ALSO need to be updated to save answers into
    // individual `Answer` documents using bulkWrite/upsert, similar to `submitSurveyAnswers`.
    // It should NOT store `answers` and `otherInputValues` directly on the `PartialResponse` document anymore,
    // as those fields are not on your `PartialResponse.js` model (it has `answers: Map, of: Mixed` but this is now redundant).
    // The `PartialResponse` document should primarily store metadata about the partial save.
    console.log('[savePartialResponse] Placeholder executed. NEEDS UPDATE FOR Answer.js MODEL.');
    res.status(501).json({success: false, message: "savePartialResponse not fully implemented for Answer.js model."});
};

exports.getSurveyResults = async (req, res) => {
    // ... (Keep your existing getSurveyResults)
    // **IMPORTANT**: When fetching results, you will now need to fetch all `Answer` documents
    // for a given survey/collector/sessionId (or for all sessions of a survey) and then reconstruct
    // the full responses. This will be more complex than just fetching `Response` documents
    // if the `Response` doc itself doesn't contain the answers.
    console.log('[getSurveyResults] Placeholder executed. NEEDS UPDATE FOR Answer.js MODEL.');
    res.status(501).json({success: false, message: "getSurveyResults not fully implemented for Answer.js model."});
};

exports.exportSurveyResults = async (req, res) => {
    // ... (Keep your existing exportSurveyResults)
    // **IMPORTANT**: Similar to getSurveyResults, exporting will require fetching all relevant
    // `Answer` documents and collating them per response session.
    console.log('[exportSurveyResults] Placeholder executed. NEEDS UPDATE FOR Answer.js MODEL.');
    res.status(501).json({success: false, message: "exportSurveyResults not fully implemented for Answer.js model."});
};

module.exports = exports;
// ----- END OF COMPLETE UPDATED FILE -----