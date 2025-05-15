// backend/controllers/surveyController.js
// ----- START OF COMPLETE UPDATED FILE (vNext19 - Debug Logging in submitSurveyAnswers) -----
const mongoose = require('mongoose');
const { Parser } = require('json2csv');
const Survey = require('../models/Survey');
const Question = require('../models/Question');
const Answer = require('../models/Answer');
const Collector = require('../models/Collector');
const Response = require('../models/Response');
const { evaluateAllLogic, evaluateSurveyLogic } = require('../utils/logicEvaluator');
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
    return [];
};

const CSV_SEPARATOR = '; ';
const ensureArrayForCsv = (val) => (Array.isArray(val) ? val : (val !== undefined && val !== null ? [String(val)] : []));

const formatValueForCsv = (value, questionType, otherTextValue) => {
    // ... (existing code, no changes) ...
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
    // ... (existing code, no changes) ...
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
    // ... (existing code, no changes) ...
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
    // ... (existing code, no changes other than what was already there for progress bar) ...
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
                .select('title description welcomeMessage thankYouMessage status questions settings.surveyWide.allowRetakes settings.surveyWide.showProgressBar settings.surveyWide.customCSS globalSkipLogic randomizationLogic') // showProgressBar is survey-wide, not collector specific yet
                .populate({ path: 'questions', options: { sort: { order: 1 } } });

            if (collectorId) {
                const selectFields = '+settings.web_link.password +settings.web_link.allowMultipleResponses +settings.web_link.anonymousResponses +settings.web_link.enableRecaptcha +settings.web_link.recaptchaSiteKey +settings.web_link.ipAllowlist +settings.web_link.ipBlocklist +settings.web_link.allowBackButton +settings.web_link.progressBarEnabled +settings.web_link.progressBarStyle';
                if (mongoose.Types.ObjectId.isValid(collectorId)) {
                    actualCollectorDoc = await Collector.findOne({ _id: collectorId, survey: surveyId }).select(selectFields);
                }
                if (!actualCollectorDoc) actualCollectorDoc = await Collector.findOne({ linkId: collectorId, survey: surveyId }).select(selectFields);
                if (!actualCollectorDoc) actualCollectorDoc = await Collector.findOne({ 'settings.web_link.customSlug': collectorId, survey: surveyId }).select(selectFields);
            }
        } else {
            surveyQuery = surveyQuery.populate({ path: 'questions' }).populate('collectors');
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
        if (Array.isArray(processedQuestions) && processedQuestions.length > 0 && typeof processedQuestions[0] === 'object' && processedQuestions[0] !== null) {
            const questionOrderMap = survey.questions.reduce((map, qId, index) => {
                map[String(qId)] = index;
                return map;
            }, {});

            processedQuestions.sort((a, b) => {
                const orderA = questionOrderMap[String(a._id)];
                const orderB = questionOrderMap[String(b._id)];
                if (orderA === undefined) return 1;
                if (orderB === undefined) return -1;
                return orderA - orderB;
            });

            processedQuestions = processedQuestions.map(q => q && q.type === 'conjoint' && q.conjointAttributes ? { ...q, generatedProfiles: generateConjointProfiles(q.conjointAttributes) } : q);
        }

        const surveyResponseData = { ...survey, questions: processedQuestions };

        if (forTaking === 'true') {
            if (actualCollectorDoc?.settings?.web_link) {
                const webLinkSettingsObject = actualCollectorDoc.settings.web_link.toObject ? actualCollectorDoc.settings.web_link.toObject() : { ...actualCollectorDoc.settings.web_link };
                surveyResponseData.collectorSettings = webLinkSettingsObject;
                surveyResponseData.actualCollectorObjectId = actualCollectorDoc._id;
                if (surveyResponseData.collectorSettings.enableRecaptcha && !surveyResponseData.collectorSettings.recaptchaSiteKey && process.env.REACT_APP_RECAPTCHA_SITE_KEY) surveyResponseData.collectorSettings.recaptchaSiteKey = process.env.REACT_APP_RECAPTCHA_SITE_KEY;

                if (typeof surveyResponseData.collectorSettings.allowBackButton === 'undefined') {
                    surveyResponseData.collectorSettings.allowBackButton = true;
                }
                if (typeof surveyResponseData.collectorSettings.progressBarEnabled === 'undefined') {
                    surveyResponseData.collectorSettings.progressBarEnabled = false;
                }
                if (typeof surveyResponseData.collectorSettings.progressBarStyle === 'undefined') {
                    surveyResponseData.collectorSettings.progressBarStyle = 'percentage';
                }

            } else {
                surveyResponseData.collectorSettings = {
                    allowMultipleResponses: survey.settings?.surveyWide?.allowRetakes ?? true,
                    anonymousResponses: false,
                    enableRecaptcha: false,
                    recaptchaSiteKey: process.env.REACT_APP_RECAPTCHA_SITE_KEY || '',
                    ipAllowlist: [],
                    ipBlocklist: [],
                    allowBackButton: true,
                    progressBarEnabled: false,
                    progressBarStyle: 'percentage'
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
    // ... (existing code, no changes) ...
    const { surveyId } = req.params;
    const updates = req.body;

    if (!mongoose.Types.ObjectId.isValid(surveyId)) return res.status(400).json({ success: false, message: 'Invalid Survey ID.' });

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const survey = await Survey.findById(surveyId).session(session);
        if (!survey) { await session.abortTransaction(); session.endSession(); return res.status(404).json({ success: false, message: 'Survey not found.' }); }
        if (req.user && String(survey.createdBy) !== String(req.user.id) && req.user.role !== 'admin') { await session.abortTransaction(); session.endSession(); return res.status(403).json({ success: false, message: 'Not authorized.' }); }

        if (updates.hasOwnProperty('questions') && Array.isArray(updates.questions)) {
            const receivedQuestionObjects = updates.questions;
            const newQuestionObjectIdsForSurvey = [];

            for (let i = 0; i < receivedQuestionObjects.length; i++) {
                const qDataFromPayload = receivedQuestionObjects[i];
                if (!qDataFromPayload._id || !mongoose.Types.ObjectId.isValid(qDataFromPayload._id)) {
                    await session.abortTransaction(); session.endSession();
                    return res.status(400).json({ success: false, message: `Invalid or missing _id for question object at index ${i}.` });
                }
                const questionObjectId = new mongoose.Types.ObjectId(qDataFromPayload._id);
                newQuestionObjectIdsForSurvey.push(questionObjectId);
                const { _id, survey: qPayloadSurveyId, createdAt, updatedAt, ...questionUpdateData } = qDataFromPayload;
                questionUpdateData.survey = survey._id;
                const setOps = {}; const unsetOps = {};
                for (const key in questionUpdateData) {
                    if (questionUpdateData.hasOwnProperty(key)) {
                        if (questionUpdateData[key] === undefined) unsetOps[key] = "";
                        else setOps[key] = questionUpdateData[key];
                    }
                }
                const updateCommand = {};
                if (Object.keys(setOps).length > 0) updateCommand.$set = setOps;
                if (Object.keys(unsetOps).length > 0) updateCommand.$unset = unsetOps;
                if (Object.keys(updateCommand).length > 0) {
                    const updatedQuestionDoc = await Question.findByIdAndUpdate(questionObjectId, updateCommand, { new: true, runValidators: true, session: session, omitUndefined: false });
                    if (!updatedQuestionDoc) { await session.abortTransaction(); session.endSession(); return res.status(404).json({ success: false, message: `Question with ID ${questionObjectId} not found during update.` }); }
                }
            }
            const currentQuestionIdsInSurveyStrings = survey.questions.map(id => String(id));
            const newQuestionIdsInPayloadStrings = newQuestionObjectIdsForSurvey.map(id => String(id));
            const questionsRemovedFromSurveyStrings = currentQuestionIdsInSurveyStrings.filter(idStr => !newQuestionIdsInPayloadStrings.includes(idStr));
            if (questionsRemovedFromSurveyStrings.length > 0) {
                const objectIdsToDelete = questionsRemovedFromSurveyStrings.map(idStr => new mongoose.Types.ObjectId(idStr));
                await Question.deleteMany({ _id: { $in: objectIdsToDelete }, survey: survey._id }, { session });
                await Answer.deleteMany({ questionId: { $in: objectIdsToDelete }, surveyId: survey._id }, { session });
            }
            survey.questions = newQuestionObjectIdsForSurvey;
        } else if (updates.hasOwnProperty('questions') && updates.questions === null) {
            if (survey.questions && survey.questions.length > 0) {
                const objectIdsToDelete = survey.questions.map(id => new mongoose.Types.ObjectId(String(id)));
                await Question.deleteMany({ _id: { $in: objectIdsToDelete }, survey: survey._id }, { session });
                await Answer.deleteMany({ questionId: { $in: objectIdsToDelete }, surveyId: survey._id }, { session });
            }
            survey.questions = [];
        }

        const allowedTopLevelFields = ['title', 'description', 'status', 'settings', 'randomizationLogic', 'welcomeMessage', 'thankYouMessage', 'globalSkipLogic'];
        for (const key of allowedTopLevelFields) {
            if (updates.hasOwnProperty(key)) survey[key] = updates[key];
        }
        survey.updatedAt = Date.now();
        const updatedSurvey = await survey.save({ session });
        await session.commitTransaction();
        session.endSession();
        const populatedSurvey = await Survey.findById(updatedSurvey._id).populate({ path: 'questions' }).populate('collectors');
        if (populatedSurvey && populatedSurvey.questions && Array.isArray(populatedSurvey.questions)) {
            const orderMap = updatedSurvey.questions.reduce((map, id, index) => { map[String(id)] = index; return map; }, {});
            populatedSurvey.questions.sort((a, b) => orderMap[String(a._id)] - orderMap[String(b._id)]);
        }
        res.status(200).json({ success: true, message: 'Survey updated successfully.', data: populatedSurvey });
    } catch (error) {
        if (session.inTransaction()) await session.abortTransaction();
        session.endSession();
        console.error(`[surveyController.updateSurvey] Error during update for survey ${surveyId}:`, error);
        if (error.name === 'ValidationError') return res.status(400).json({ success: false, message: 'Validation Error', details: error.errors });
        res.status(500).json({ success: false, message: 'Error updating survey on the server.' });
    }
};

exports.deleteSurvey = async (req, res) => { /* ... (existing code, no changes) ... */ };

exports.submitSurveyAnswers = async (req, res) => {
    // --- START: Extensive Debug Logging ---
    console.log(`[B_SUBMIT_ENTRY] Received submission request for surveyId: ${req.params.surveyId}. Body keys: ${Object.keys(req.body).join(', ')}`);

    const { surveyId } = req.params;
    const { answers: answersPayload, sessionId: payloadSessionId, collectorId, recaptchaToken, startedAt: clientStartedAt } = req.body;

    console.log(`[B_SUBMIT_PARAMS] surveyId=${surveyId}, collectorId=${collectorId}, payloadSessionId=${payloadSessionId}, recaptchaToken=${recaptchaToken ? 'present' : 'absent'}, clientStartedAt=${clientStartedAt}`);

    const respondentIp = getIpAddress(req);
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const sessionIdToUse = payloadSessionId || new mongoose.Types.ObjectId().toString(); // Ensure a session ID

    console.log(`[B_SUBMIT_INFO] Respondent IP: ${respondentIp}, User-Agent: ${userAgent.substring(0, 50)}..., SessionID to use: ${sessionIdToUse}`);

    let mongoSession; // Define mongoSession here to be accessible in finally block

    try {
        console.log("[B_SUBMIT_SESSION] Attempting to start MongoDB session...");
        mongoSession = await mongoose.startSession();
        console.log("[B_SUBMIT_SESSION] MongoDB session started successfully.");

        console.log("[B_SUBMIT_TRANSACTION] Attempting to start transaction...");
        mongoSession.startTransaction();
        console.log("[B_SUBMIT_TRANSACTION] Transaction started successfully.");

        console.log(`[B_SUBMIT_FETCH_SURVEY] Fetching survey: ${surveyId}`);
        const survey = await Survey.findById(surveyId).session(mongoSession);
        if (!survey) {
            console.error(`[B_SUBMIT_ERROR] Survey not found: ${surveyId}. Aborting transaction.`);
            await mongoSession.abortTransaction();
            console.log("[B_SUBMIT_TRANSACTION] Transaction aborted due to survey not found.");
            return res.status(404).json({ success: false, message: 'Survey not found.' });
        }
        console.log(`[B_SUBMIT_FETCH_SURVEY] Survey ${surveyId} fetched. Status: ${survey.status}`);

        console.log(`[B_SUBMIT_FETCH_COLLECTOR] Fetching collector: ${collectorId}`);
        const collector = await Collector.findById(collectorId).select('+settings.web_link.anonymousResponses +settings.web_link.enableRecaptcha +settings.web_link.ipAllowlist +settings.web_link.ipBlocklist').session(mongoSession);
        if (!collector) {
            console.error(`[B_SUBMIT_ERROR] Collector not found: ${collectorId}. Aborting transaction.`);
            await mongoSession.abortTransaction();
            console.log("[B_SUBMIT_TRANSACTION] Transaction aborted due to collector not found.");
            return res.status(404).json({ success: false, message: 'Collector not found.' });
        }
        console.log(`[B_SUBMIT_FETCH_COLLECTOR] Collector ${collectorId} fetched. Type: ${collector.type}, Status: ${collector.status}`);

        const isOwnerPreviewingDraft = survey.status === 'draft' && req.user && String(survey.createdBy) === String(req.user.id);
        console.log(`[B_SUBMIT_PREVIEW_CHECK] Is owner previewing draft? ${isOwnerPreviewingDraft}`);

        if (survey.status !== 'active' && !isOwnerPreviewingDraft) {
            console.warn(`[B_SUBMIT_WARN] Survey ${surveyId} is not active. Status: ${survey.status}. Aborting transaction.`);
            await mongoSession.abortTransaction();
            console.log("[B_SUBMIT_TRANSACTION] Transaction aborted due to inactive survey.");
            return res.status(403).json({ success: false, message: 'This survey is not currently active.' });
        }
        if (collector.status !== 'open' && !isOwnerPreviewingDraft) {
            console.warn(`[B_SUBMIT_WARN] Collector ${collectorId} is not open. Status: ${collector.status}. Aborting transaction.`);
            await mongoSession.abortTransaction();
            console.log("[B_SUBMIT_TRANSACTION] Transaction aborted due to non-open collector.");
            return res.status(403).json({ success: false, message: `This survey link is ${collector.status}.` });
        }

        // IP Filtering (if applicable for the collector type, e.g., web_link)
        if (collector.type === 'web_link' && collector.settings?.web_link && !isOwnerPreviewingDraft) {
            console.log("[B_SUBMIT_IP_CHECK] Performing IP checks for web_link collector.");
            const { ipAllowlist, ipBlocklist } = collector.settings.web_link;
            if (respondentIp) {
                if (ipAllowlist?.length > 0 && !ipAllowlist.some(allowedIpOrRange => ipRangeCheck(respondentIp, allowedIpOrRange))) {
                    console.warn(`[B_SUBMIT_WARN] IP ${respondentIp} not in allowlist. Aborting transaction.`);
                    await mongoSession.abortTransaction();
                    return res.status(403).json({ success: false, message: 'Access restricted (not in allowlist).' });
                }
                if (ipBlocklist?.length > 0 && ipBlocklist.some(blockedIpOrRange => ipRangeCheck(respondentIp, blockedIpOrRange))) {
                    console.warn(`[B_SUBMIT_WARN] IP ${respondentIp} in blocklist. Aborting transaction.`);
                    await mongoSession.abortTransaction();
                    return res.status(403).json({ success: false, message: 'Access restricted (in blocklist).' });
                }
            }
            console.log("[B_SUBMIT_IP_CHECK] IP checks passed.");
        }

        // reCAPTCHA verification (if applicable)
        if (collector.type === 'web_link' && collector.settings?.web_link?.enableRecaptcha && !isOwnerPreviewingDraft) {
            console.log("[B_SUBMIT_RECAPTCHA] Verifying reCAPTCHA token...");
            if (!recaptchaToken) {
                console.warn("[B_SUBMIT_WARN] reCAPTCHA token missing. Aborting transaction.");
                await mongoSession.abortTransaction();
                return res.status(400).json({ success: false, message: 'reCAPTCHA verification failed (token missing).' });
            }
            try {
                const recaptchaSecret = process.env.RECAPTCHA_SECRET_KEY;
                if (!recaptchaSecret) throw new Error("reCAPTCHA secret key not configured on server.");

                const verificationUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${recaptchaSecret}&response=${recaptchaToken}&remoteip=${respondentIp}`;
                console.log("[B_SUBMIT_RECAPTCHA] Calling Google siteverify...");
                const response = await axios.post(verificationUrl);
                console.log("[B_SUBMIT_RECAPTCHA] Google siteverify response status:", response.status);
                console.log("[B_SUBMIT_RECAPTCHA] Google siteverify response data:", JSON.stringify(response.data));

                if (!response.data.success) {
                    console.warn("[B_SUBMIT_WARN] reCAPTCHA verification failed with Google. Errors:", response.data['error-codes']?.join(', '));
                    await mongoSession.abortTransaction();
                    return res.status(400).json({ success: false, message: 'reCAPTCHA verification failed.', errors: response.data['error-codes'] });
                }
                console.log("[B_SUBMIT_RECAPTCHA] reCAPTCHA verification successful.");
            } catch (recaptchaError) {
                console.error("[B_SUBMIT_ERROR] Error during reCAPTCHA verification:", recaptchaError.message, recaptchaError.stack);
                await mongoSession.abortTransaction();
                return res.status(500).json({ success: false, message: 'Error during reCAPTCHA verification.' });
            }
        }

        const questionsMap = new Map(survey.questions.map(q => [String(q._id), q]));
        const answersToUpsert = [];

        console.log(`[B_SUBMIT_ANSWERS_PROCESS] Processing ${answersPayload?.length || 0} answers from payload.`);
        if (answersPayload && Array.isArray(answersPayload)) {
            for (const ans of answersPayload) {
                if (!ans.questionId || !mongoose.Types.ObjectId.isValid(ans.questionId)) {
                    console.warn(`[B_SUBMIT_WARN] Invalid questionId in payload: ${ans.questionId}. Skipping.`);
                    continue;
                }
                // const question = questionsMap.get(String(ans.questionId));
                // if (!question) {
                // console.warn(`[B_SUBMIT_WARN] Question ${ans.questionId} not found in survey ${surveyId}. Skipping answer.`);
                // continue;
                // }
                answersToUpsert.push({
                    updateOne: {
                        filter: {
                            surveyId: survey._id,
                            collectorId: collector._id,
                            questionId: new mongoose.Types.ObjectId(ans.questionId),
                            sessionId: sessionIdToUse,
                        },
                        update: {
                            $set: {
                                answerValue: ans.answerValue,
                                otherText: ans.otherText,
                                questionText: ans.questionText, // Storing denormalized question text
                                questionType: ans.questionType, // Storing denormalized question type
                                submittedAt: new Date(),
                            },
                        },
                        upsert: true,
                    },
                });
            }
        }
        console.log(`[B_SUBMIT_ANSWERS_PROCESS] Prepared ${answersToUpsert.length} answers for bulkWrite.`);

        if (answersToUpsert.length > 0) {
            console.log("[B_SUBMIT_DB_BULKWRITE_ANSWERS] Attempting Answer.bulkWrite...");
            const bulkWriteResult = await Answer.bulkWrite(answersToUpsert, { session: mongoSession });
            console.log("[B_SUBMIT_DB_BULKWRITE_ANSWERS] Answer.bulkWrite completed.");
            console.log(`[B_SUBMIT_DB_BULKWRITE_ANSWERS_RESULT] Upserted: ${bulkWriteResult.upsertedCount}, Modified: ${bulkWriteResult.modifiedCount}, Matched: ${bulkWriteResult.matchedCount}`);
            if (bulkWriteResult.hasWriteErrors()) {
               const writeErrors = bulkWriteResult.getWriteErrors();
               console.error("[B_SUBMIT_DB_BULKWRITE_ANSWERS_ERROR] Answer BulkWriteError:", JSON.stringify(writeErrors));
               await mongoSession.abortTransaction();
               return res.status(500).json({ success: false, message: 'Error saving some answers.', details: writeErrors });
            }
        } else {
            console.log("[B_SUBMIT_ANSWERS_PROCESS] No answers to save after processing.");
        }

        const responseUpdateData = {
            surveyId: survey._id,
            collectorId: collector._id,
            sessionId: sessionIdToUse,
            status: 'completed', // Can be updated by logic later
            startedAt: clientStartedAt ? new Date(clientStartedAt) : new Date(),
            completedAt: new Date(),
            ipAddress: collector.settings?.web_link?.anonymousResponses ? undefined : respondentIp,
            userAgent: collector.settings?.web_link?.anonymousResponses ? undefined : userAgent,
            // answers will be linked by sessionId, surveyId, collectorId
        };
        console.log("[B_SUBMIT_DB_UPSERT_RESPONSE] Attempting Response.findOneAndUpdate (upsert)...");
        const updatedResponse = await Response.findOneAndUpdate(
            { surveyId: survey._id, collectorId: collector._id, sessionId: sessionIdToUse },
            { $set: responseUpdateData, $setOnInsert: { createdAt: new Date() } },
            { upsert: true, new: true, runValidators: true, session: mongoSession }
        );
        console.log(`[B_SUBMIT_DB_UPSERT_RESPONSE] Response document processed. ID: ${updatedResponse?._id}, Status: ${updatedResponse?.status}`);


        let triggeredAction = null;
        if (survey.globalSkipLogic && survey.globalSkipLogic.length > 0) {
            console.log("[B_SUBMIT_LOGIC_GLOBAL] Evaluating global logic...");
            const allAnswersForLogic = await Answer.find({ surveyId: survey._id, collectorId: collector._id, sessionId: sessionIdToUse }).session(mongoSession);
            const currentAnswersForLogic = allAnswersForLogic.reduce((acc, cur) => {
                acc[String(cur.questionId)] = cur.answerValue; // Simplified for example
                return acc;
            }, {});
            triggeredAction = evaluateSurveyLogic(survey.globalSkipLogic, currentAnswersForLogic, survey.questions); // Assuming survey.questions is populated or fetched
            console.log("[B_SUBMIT_LOGIC_GLOBAL] Global logic evaluation result:", JSON.stringify(triggeredAction));
        }


        if (!isOwnerPreviewingDraft) {
            console.log("[B_SUBMIT_COLLECTOR_UPDATE] Incrementing collector responseCount...");
            await Collector.updateOne({ _id: collector._id }, { $inc: { responseCount: 1 } }, { session: mongoSession });
            console.log("[B_SUBMIT_COLLECTOR_UPDATE] Collector responseCount incremented.");

            if (collector.settings?.web_link?.maxResponses && collector.responseCount + 1 >= collector.settings.web_link.maxResponses) {
                console.log(`[B_SUBMIT_COLLECTOR_UPDATE] Max responses reached for collector ${collector._id}. Setting status to 'completed_quota'.`);
                await Collector.updateOne({ _id: collector._id }, { $set: { status: 'completed_quota' } }, { session: mongoSession });
            }
        }

        console.log("[B_SUBMIT_TRANSACTION_COMMIT] Attempting to commit transaction...");
        await mongoSession.commitTransaction();
        console.log("[B_SUBMIT_TRANSACTION_COMMIT] Transaction committed successfully.");

        const responseMessage = triggeredAction?.type === 'disqualifyRespondent'
            ? (triggeredAction.disqualificationMessage || 'Disqualified based on responses.')
            : 'Survey answers submitted successfully.';

        const responsePayload = {
            success: true,
            message: responseMessage,
            responseId: updatedResponse._id,
            sessionId: sessionIdToUse,
            action: triggeredAction || null, // Send back the action if any
            redirectUrl: survey.thankYouMessage?.redirectUrl || (triggeredAction?.type === 'disqualifyRespondent' ? survey.thankYouMessage?.disqualificationRedirectUrl : null) || '/thank-you'
        };

        console.log("[B_SUBMIT_SUCCESS] Sending 201 response. Payload:", JSON.stringify(responsePayload).substring(0, 300) + "...");
        res.status(201).json(responsePayload);
        console.log("[B_SUBMIT_SUCCESS] Response sent.");

    } catch (error) {
        console.error(`[B_SUBMIT_CRITICAL_ERROR] Unhandled error in submitSurveyAnswers for survey ${surveyId}, session ${sessionIdToUse}. Error: ${error.message}`, error.stack); // Log the full error object and stack
        if (mongoSession && mongoSession.inTransaction()) {
            try {
                console.error("[B_SUBMIT_CRITICAL_ERROR] Attempting to abort transaction due to error...");
                await mongoSession.abortTransaction();
                console.error("[B_SUBMIT_CRITICAL_ERROR] Transaction aborted successfully.");
            } catch (abortError) {
                console.error("[B_SUBMIT_CRITICAL_ERROR] Failed to abort transaction:", abortError.message, abortError.stack);
            }
        }
        if (!res.headersSent) {
            console.error("[B_SUBMIT_CRITICAL_ERROR] Sending 500 response due to unhandled error.");
            res.status(500).json({ success: false, message: error.message || 'An unexpected error occurred on the server while submitting answers.' });
        } else {
            console.error("[B_SUBMIT_CRITICAL_ERROR] Headers already sent, cannot send 500 response.");
        }
    } finally {
        if (mongoSession) { // Check if mongoSession was initialized
            try {
                console.log("[B_SUBMIT_FINALLY] Attempting to end MongoDB session...");
                await mongoSession.endSession(); // Ensure endSession is awaited if it's async, or remove await if not. Mongoose's endSession is typically synchronous.
                console.log("[B_SUBMIT_FINALLY] MongoDB session ended.");
            } catch (sessionEndError) {
                 console.error("[B_SUBMIT_FINALLY] Error ending MongoDB session:", sessionEndError.message, sessionEndError.stack);
            }
        } else {
            console.log("[B_SUBMIT_FINALLY] MongoDB session was not initialized or already ended.");
        }
        console.log("[B_SUBMIT_EXIT] Exiting submitSurveyAnswers function.");
    }
};
// --- END: Extensive Debug Logging ---

exports.getSurveyResults = async (req, res) => { /* ... (existing code, no changes) ... */ };
exports.exportSurveyResults = async (req, res) => { /* ... (existing code, no changes) ... */ };
// ----- END OF COMPLETE UPDATED FILE (vNext19 - Debug Logging in submitSurveyAnswers) -----