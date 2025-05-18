// backend/controllers/surveyController.js
// ----- START OF COMPLETE UPDATED FILE (vNext26 - Integrated Email Service) -----
const mongoose = require('mongoose');
const { Parser } = require('json2csv');
const crypto = require('crypto'); 
const Survey = require('../models/Survey');
const Question = require('../models/Question');
const Answer = require('../models/Answer');
const Collector = require('../models/Collector');
const Response = require('../models/Response');
const PartialResponse = require('../models/PartialResponse');
const { evaluateAllLogic } = require('../utils/logicEvaluator');
const axios = require('axios');
const ipRangeCheck = require('ip-range-check');
const emailService = require('../services/emailService'); // +++ Import Email Service +++

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
    if (value === null || value === undefined) return '';
    switch (questionType) {
        case 'multiple-choice': case 'dropdown': case 'nps': case 'rating': case 'slider':
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
        const defaultBehaviorNav = {
            autoAdvance: false,
            questionNumberingEnabled: true,
            questionNumberingFormat: '123',
            questionNumberingCustomPrefix: '',
            saveAndContinueEnabled: false,
            saveAndContinueEmailLinkExpiryDays: 7,
        };
        const defaultCustomVariables = []; 

        const mergedSettings = {
            ...(settings || {}), 
            behaviorNavigation: {
                ...defaultBehaviorNav,
                ...(settings?.behaviorNavigation || {})
            },
            customVariables: settings?.customVariables || defaultCustomVariables
        };

        const newSurvey = new Survey({
            title: title || 'Untitled Survey', description, category, createdBy: req.user.id, status: 'draft',
            settings: mergedSettings,
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
    const { forTaking, collectorId, isPreviewingOwner, resumeToken } = req.query; 

    if (!mongoose.Types.ObjectId.isValid(surveyId)) {
        return res.status(400).json({ success: false, message: 'Invalid Survey ID.' });
    }

    try {
        let surveyQuery = Survey.findById(surveyId);
        let actualCollectorDoc = null;
        let partialResponseData = null; 

        if (forTaking === 'true') {
            surveyQuery = surveyQuery
                .select('title description welcomeMessage thankYouMessage status questions settings.completion settings.behaviorNavigation settings.customVariables globalSkipLogic randomizationLogic')
                .populate({ path: 'questions', options: { sort: { order: 1 } } });

            if (collectorId) {
                const selectFields = '+settings.web_link.password +settings.web_link.allowMultipleResponses +settings.web_link.anonymousResponses +settings.web_link.enableRecaptcha +settings.web_link.recaptchaSiteKey +settings.web_link.ipAllowlist +settings.web_link.ipBlocklist +settings.web_link.allowBackButton +settings.web_link.progressBarEnabled +settings.web_link.progressBarStyle +settings.web_link.progressBarPosition';
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
        
        const effectiveIsOwnerPreviewing = isPreviewingOwner === 'true' && req.user && String(survey.createdBy) === String(req.user.id);

        if (forTaking === 'true') {
            if (survey.status !== 'active' && !effectiveIsOwnerPreviewing && !resumeToken) { 
                return res.status(403).json({ success: false, message: 'This survey is not currently active.' });
            }
            if (collectorId && !actualCollectorDoc && !effectiveIsOwnerPreviewing && !resumeToken) {
                 return res.status(404).json({ success: false, message: 'Collector not found or invalid for this survey.' });
            }

            if (resumeToken) {
                const partialResponse = await PartialResponse.findOne({ resumeToken: resumeToken, survey: survey._id });
                if (!partialResponse) {
                    return res.status(404).json({ success: false, message: 'Invalid or expired resume link.' });
                }
                if (partialResponse.expiresAt < new Date()) {
                    return res.status(410).json({ success: false, message: 'This resume link has expired.' });
                }
                if (partialResponse.completedAt) {
                     return res.status(410).json({ success: false, message: 'This survey session has already been completed.' });
                }
                partialResponseData = partialResponse.toObject(); 
                if (!actualCollectorDoc && partialResponse.collector) {
                     actualCollectorDoc = await Collector.findById(partialResponse.collector).select('+settings.web_link.password +settings.web_link.allowMultipleResponses +settings.web_link.anonymousResponses +settings.web_link.enableRecaptcha +settings.web_link.recaptchaSiteKey +settings.web_link.ipAllowlist +settings.web_link.ipBlocklist +settings.web_link.allowBackButton +settings.web_link.progressBarEnabled +settings.web_link.progressBarStyle +settings.web_link.progressBarPosition');
                }
            }

            if (actualCollectorDoc) {
                if (String(actualCollectorDoc.survey) !== String(survey._id)) return res.status(400).json({ success: false, message: 'Collector does not belong to this survey.' });
                if (actualCollectorDoc.status !== 'open' && !effectiveIsOwnerPreviewing && !resumeToken) return res.status(403).json({ success: false, message: `Link is ${actualCollectorDoc.status}.` });

                if (actualCollectorDoc.settings?.web_link && !effectiveIsOwnerPreviewing && !resumeToken) { 
                    const respondentIp = getIpAddress(req);
                    const { ipAllowlist, ipBlocklist } = actualCollectorDoc.settings.web_link;
                    if (respondentIp) {
                        if (ipAllowlist?.length > 0 && !ipAllowlist.some(allowedIpOrRange => ipRangeCheck(respondentIp, allowedIpOrRange))) return res.status(403).json({ success: false, message: 'Access to this survey is restricted from your current IP address (not in allowlist).' });
                        if (ipBlocklist?.length > 0 && ipBlocklist.some(blockedIpOrRange => ipRangeCheck(respondentIp, blockedIpOrRange))) return res.status(403).json({ success: false, message: 'Access to this survey is restricted from your current IP address (in blocklist).' });
                    }
                }
                if (actualCollectorDoc.type === 'web_link' && actualCollectorDoc.settings?.web_link?.password && !resumeToken) { 
                    const providedPassword = req.headers['x-survey-password'];
                    const passwordMatch = await actualCollectorDoc.comparePassword(providedPassword);
                    if (!providedPassword || !passwordMatch) return res.status(401).json({ success: false, message: 'Password required or incorrect.', requiresPassword: true });
                }
            } else if (!effectiveIsOwnerPreviewing && survey.status === 'draft' && !collectorId && !resumeToken) {
                return res.status(403).json({ success: false, message: 'Survey is in draft mode and requires a specific collector link for preview.' });
            }
        }

        let processedQuestions = survey.questions || [];
        if (Array.isArray(processedQuestions) && processedQuestions.length > 0 && typeof processedQuestions[0] === 'object' && processedQuestions[0] !== null) {
            processedQuestions = processedQuestions.map(q => q && q.type === 'conjoint' && q.conjointAttributes ? { ...q, generatedProfiles: generateConjointProfiles(q.conjointAttributes) } : q);
        }

        const surveyResponseData = { ...survey, questions: processedQuestions };

        if (forTaking === 'true') {
            const defaultBehaviorNav = { 
                autoAdvance: false, 
                questionNumberingEnabled: true, 
                questionNumberingFormat: '123',
                saveAndContinueEnabled: false,
                saveAndContinueEmailLinkExpiryDays: 7,
            };
            const defaultCustomVariables = [];

            surveyResponseData.settings = {
                ...(surveyResponseData.settings || {}), 
                behaviorNavigation: {
                    ...defaultBehaviorNav,
                    ...(surveyResponseData.settings?.behaviorNavigation || {})
                },
                customVariables: surveyResponseData.settings?.customVariables || defaultCustomVariables
            };
            
            if (actualCollectorDoc?.settings?.web_link) {
                const webLinkSettingsObject = actualCollectorDoc.settings.web_link.toObject ? actualCollectorDoc.settings.web_link.toObject() : { ...actualCollectorDoc.settings.web_link };
                surveyResponseData.collectorSettings = webLinkSettingsObject;
                surveyResponseData.actualCollectorObjectId = actualCollectorDoc._id;
                if (surveyResponseData.collectorSettings.enableRecaptcha && !surveyResponseData.collectorSettings.recaptchaSiteKey && process.env.REACT_APP_RECAPTCHA_SITE_KEY) surveyResponseData.collectorSettings.recaptchaSiteKey = process.env.REACT_APP_RECAPTCHA_SITE_KEY;
                if (typeof surveyResponseData.collectorSettings.allowBackButton === 'undefined') surveyResponseData.collectorSettings.allowBackButton = true;
                if (typeof surveyResponseData.collectorSettings.progressBarEnabled === 'undefined') surveyResponseData.collectorSettings.progressBarEnabled = false;
                if (typeof surveyResponseData.collectorSettings.progressBarStyle === 'undefined') surveyResponseData.collectorSettings.progressBarStyle = 'percentage';
                if (typeof surveyResponseData.collectorSettings.progressBarPosition === 'undefined') surveyResponseData.collectorSettings.progressBarPosition = 'top';
            } else { 
                surveyResponseData.collectorSettings = {
                    allowMultipleResponses: true, anonymousResponses: false, enableRecaptcha: false,
                    recaptchaSiteKey: process.env.REACT_APP_RECAPTCHA_SITE_KEY || '',
                    ipAllowlist: [], ipBlocklist: [], allowBackButton: true,
                    progressBarEnabled: false, progressBarStyle: 'percentage', progressBarPosition: 'top'
                };
                surveyResponseData.actualCollectorObjectId = null;
            }
            if (partialResponseData) {
                surveyResponseData.partialResponse = partialResponseData;
            }
        }
        res.status(200).json({ success: true, data: surveyResponseData });
    } catch (error) {
        console.error(`[Backend - getSurveyById] Error fetching survey ${surveyId} with collectorId ${collectorId} or resumeToken ${resumeToken}:`, error);
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

        if (updates.hasOwnProperty('questions') && Array.isArray(updates.questions)) {
            const receivedQuestionObjects = updates.questions;
            const newQuestionObjectIdsForSurvey = [];
            for (let i = 0; i < receivedQuestionObjects.length; i++) {
                const qDataFromPayload = receivedQuestionObjects[i];
                if (!qDataFromPayload._id || !mongoose.Types.ObjectId.isValid(qDataFromPayload._id)) { await session.abortTransaction(); session.endSession(); return res.status(400).json({ success: false, message: `Invalid or missing _id for question object at index ${i}.` }); }
                const questionObjectId = new mongoose.Types.ObjectId(qDataFromPayload._id);
                newQuestionObjectIdsForSurvey.push(questionObjectId);
                const { _id, survey: qPayloadSurveyId, createdAt, updatedAt, ...questionUpdateData } = qDataFromPayload;
                questionUpdateData.survey = survey._id;
                const setOps = {}; const unsetOps = {};
                for (const key in questionUpdateData) { if (questionUpdateData.hasOwnProperty(key)) { if (questionUpdateData[key] === undefined) unsetOps[key] = ""; else setOps[key] = questionUpdateData[key]; } }
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
                await Answer.deleteMany({ questionId: { $in: objectIdsToDelete }, survey: survey._id }, { session });
            }
            survey.questions = newQuestionObjectIdsForSurvey;
        } else if (updates.hasOwnProperty('questions') && updates.questions === null) {
            if (survey.questions && survey.questions.length > 0) {
                const objectIdsToDelete = survey.questions.map(id => new mongoose.Types.ObjectId(String(id)));
                await Question.deleteMany({ _id: { $in: objectIdsToDelete }, survey: survey._id }, { session });
                await Answer.deleteMany({ questionId: { $in: objectIdsToDelete }, survey: survey._id }, { session });
            }
            survey.questions = [];
        }
        
        if (updates.settings) {
            survey.settings = survey.settings || {}; 
            const defaultBehaviorNav = { autoAdvance: false, questionNumberingEnabled: true, questionNumberingFormat: '123', questionNumberingCustomPrefix: '', saveAndContinueEnabled: false, saveAndContinueEmailLinkExpiryDays: 7 };
            const defaultCustomVariables = [];
            for (const categoryKey in updates.settings) {
                if (updates.settings.hasOwnProperty(categoryKey)) {
                    if (categoryKey === 'customVariables') { survey.settings.customVariables = Array.isArray(updates.settings.customVariables) ? updates.settings.customVariables : defaultCustomVariables;
                    } else if (typeof updates.settings[categoryKey] === 'object' && updates.settings[categoryKey] !== null && !Array.isArray(updates.settings[categoryKey])) {
                        survey.settings[categoryKey] = { ...(survey.settings[categoryKey] || (categoryKey === 'behaviorNavigation' ? defaultBehaviorNav : {})), ...updates.settings[categoryKey] };
                    } else { survey.settings[categoryKey] = updates.settings[categoryKey]; }
                }
            }
            if (!survey.settings.behaviorNavigation) survey.settings.behaviorNavigation = defaultBehaviorNav;
            else survey.settings.behaviorNavigation = { ...defaultBehaviorNav, ...survey.settings.behaviorNavigation };
            if (!survey.settings.customVariables) survey.settings.customVariables = defaultCustomVariables;
        }

        const allowedTopLevelFields = ['title', 'description', 'status', 'randomizationLogic', 'welcomeMessage', 'thankYouMessage', 'globalSkipLogic'];
        for (const key of allowedTopLevelFields) { if (updates.hasOwnProperty(key)) survey[key] = updates[key]; }
        survey.updatedAt = Date.now();
        const updatedSurvey = await survey.save({ session });
        await session.commitTransaction();
        session.endSession();
        const populatedSurvey = await Survey.findById(updatedSurvey._id).populate({ path: 'questions', options: { sort: { order: 1 } } }).populate('collectors');
        res.status(200).json({ success: true, message: 'Survey updated successfully.', data: populatedSurvey });
    } catch (error) {
        if (session.inTransaction()) await session.abortTransaction();
        session.endSession();
        console.error(`[surveyController.updateSurvey] Error during update for survey ${surveyId}:`, error);
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
        if (req.user && String(survey.createdBy) !== String(req.user.id) && req.user.role !== 'admin') { await session.abortTransaction(); session.endSession(); return res.status(403).json({ success: false, message: 'Not authorized to delete this survey.' }); }
        await Question.deleteMany({ survey: survey._id }, { session });
        await Answer.deleteMany({ survey: survey._id }, { session });
        await Response.deleteMany({ survey: survey._id }, { session });
        await PartialResponse.deleteMany({ survey: survey._id }, { session }); 
        await Collector.deleteMany({ survey: survey._id }, { session });
        await Survey.findByIdAndDelete(surveyId, { session });
        await session.commitTransaction();
        session.endSession();
        res.status(200).json({ success: true, message: 'Survey and all associated data deleted successfully.' });
    } catch (error) {
        if (session.inTransaction()) await session.abortTransaction();
        session.endSession();
        console.error(`[deleteSurvey] Error deleting survey ${surveyId}:`, error);
        res.status(500).json({ success: false, message: 'Error deleting survey.' });
    }
};

exports.submitSurveyAnswers = async (req, res) => {
    const { surveyId: surveyParamId } = req.params;
    const { answers: answersPayload, sessionId: payloadSessionId, collectorId: collectorParamId, recaptchaToken, startedAt: clientStartedAt, customVariables: passedCustomVariables, resumeToken } = req.body; 
    const respondentIp = getIpAddress(req);
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const sessionIdToUse = payloadSessionId || new mongoose.Types.ObjectId().toString();
    let mongoSession;

    try {
        mongoSession = await mongoose.startSession();
        mongoSession.startTransaction();
        
        const survey = await Survey.findById(surveyParamId).populate('questions').session(mongoSession);
        if (!survey) { await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(404).json({ success: false, message: 'Survey not found.' }); }
        
        // Collector ID might be null if resuming and not passed explicitly, but partial response should have it.
        // If not resuming, collectorId is essential.
        let collector;
        if (collectorParamId && mongoose.Types.ObjectId.isValid(collectorParamId)) {
            collector = await Collector.findById(collectorParamId)
                .select('+settings.web_link.anonymousResponses +settings.web_link.enableRecaptcha +settings.web_link.ipAllowlist +settings.web_link.ipBlocklist')
                .session(mongoSession);
        }
        
        if (!collector && !resumeToken) { // If no collectorId provided and not resuming, it's an issue.
            await mongoSession.abortTransaction(); mongoSession.endSession();
            return res.status(404).json({ success: false, message: 'Collector information is missing or invalid.' });
        }
        // If resuming, collector might be loaded later from partialResponse if not provided in params
        
        const isOwnerPreviewingDraft = survey.status === 'draft' && req.user && String(survey.createdBy) === String(req.user.id);

        if (survey.status !== 'active' && !isOwnerPreviewingDraft && !resumeToken) { await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(403).json({ success: false, message: 'This survey is not currently active.' }); }
        
        if (collector && collector.status !== 'open' && !isOwnerPreviewingDraft && !resumeToken) { 
            await mongoSession.abortTransaction(); mongoSession.endSession(); 
            return res.status(403).json({ success: false, message: `This survey link is ${collector.status}.` }); 
        }

        if (collector && collector.type === 'web_link' && collector.settings?.web_link && !isOwnerPreviewingDraft && !resumeToken) {
            const { ipAllowlist, ipBlocklist } = collector.settings.web_link;
            if (respondentIp) {
                if (ipAllowlist?.length > 0 && !ipAllowlist.some(allowedIpOrRange => ipRangeCheck(respondentIp, allowedIpOrRange))) { await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(403).json({ success: false, message: 'Access restricted (not in allowlist).' }); }
                if (ipBlocklist?.length > 0 && ipBlocklist.some(blockedIpOrRange => ipRangeCheck(respondentIp, blockedIpOrRange))) { await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(403).json({ success: false, message: 'Access restricted (in blocklist).' }); }
            }
        }

        if (collector && collector.type === 'web_link' && collector.settings?.web_link?.enableRecaptcha && !isOwnerPreviewingDraft && !resumeToken) {
            if (!recaptchaToken) { await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(400).json({ success: false, message: 'reCAPTCHA verification failed (token missing).' }); }
            try {
                const recaptchaSecret = process.env.RECAPTCHA_SECRET_KEY;
                if (!recaptchaSecret) throw new Error("reCAPTCHA secret key not configured on server.");
                const verificationUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${recaptchaSecret}&response=${recaptchaToken}&remoteip=${respondentIp}`;
                const recaptchaApiResponse = await axios.post(verificationUrl);
                if (!recaptchaApiResponse.data.success) { await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(400).json({ success: false, message: 'reCAPTCHA verification failed.', errors: recaptchaApiResponse.data['error-codes'] }); }
            } catch (recaptchaError) {
                console.error("[B_SUBMIT_ERROR] Error during reCAPTCHA verification:", recaptchaError.message);
                await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(500).json({ success: false, message: 'Error during reCAPTCHA verification.' });
            }
        }
        
        let partialResponseDoc;
        if (resumeToken) {
            partialResponseDoc = await PartialResponse.findOne({ resumeToken: resumeToken, survey: survey._id }).session(mongoSession);
            if (!partialResponseDoc) {
                await mongoSession.abortTransaction(); mongoSession.endSession();
                return res.status(404).json({ success: false, message: 'Resume token invalid or expired.' });
            }
            if (partialResponseDoc.completedAt) {
                await mongoSession.abortTransaction(); mongoSession.endSession();
                return res.status(410).json({ success: false, message: 'This survey session was already completed.' });
            }
            if (!collector && partialResponseDoc.collector) { // Load collector from partial response if not already loaded
                collector = await Collector.findById(partialResponseDoc.collector)
                    .select('+settings.web_link.anonymousResponses +settings.web_link.enableRecaptcha +settings.web_link.ipAllowlist +settings.web_link.ipBlocklist')
                    .session(mongoSession);
                if (!collector) {
                     await mongoSession.abortTransaction(); mongoSession.endSession();
                     return res.status(404).json({ success: false, message: 'Collector associated with resume token not found.' });
                }
            }
        }
        
        if (!collector) { // Final check if collector is still not resolved (shouldn't happen if logic is correct)
             await mongoSession.abortTransaction(); mongoSession.endSession();
             return res.status(400).json({ success: false, message: 'Collector could not be determined for this submission.' });
        }


        const answersToUpsert = [];
        if (answersPayload && Array.isArray(answersPayload)) {
            for (const ans of answersPayload) {
                if (!ans.questionId || !mongoose.Types.ObjectId.isValid(ans.questionId)) continue;
                answersToUpsert.push({
                    updateOne: {
                        filter: { survey: survey._id, collector: collector._id, questionId: new mongoose.Types.ObjectId(ans.questionId), sessionId: sessionIdToUse, },
                        update: { $set: { answerValue: ans.answerValue, otherText: ans.otherText, questionText: ans.questionText, questionType: ans.questionType, submittedAt: new Date(), }, },
                        upsert: true,
                    },
                });
            }
        }
        if (answersToUpsert.length > 0) {
            const bulkWriteResult = await Answer.bulkWrite(answersToUpsert, { session: mongoSession });
            if (bulkWriteResult.hasWriteErrors()) {
               await mongoSession.abortTransaction(); mongoSession.endSession();
               return res.status(500).json({ success: false, message: 'Error saving some answers.', details: bulkWriteResult.getWriteErrors() });
            }
        }

        const responseUpdateData = {
            survey: survey._id, collector: collector._id, sessionId: sessionIdToUse, status: 'completed',
            ipAddress: collector.settings?.web_link?.anonymousResponses ? undefined : respondentIp,
            userAgent: collector.settings?.web_link?.anonymousResponses ? undefined : userAgent,
            isTestResponse: isOwnerPreviewingDraft,
            customVariables: passedCustomVariables || new Map() 
        };

        const updatedResponse = await Response.findOneAndUpdate(
            { survey: survey._id, collector: collector._id, sessionId: sessionIdToUse },
            { $set: responseUpdateData, $setOnInsert: { createdAt: new Date(), startedAt: clientStartedAt ? new Date(clientStartedAt) : new Date() } },
            { upsert: true, new: true, runValidators: true, session: mongoSession }
        );

        let triggeredAction = null;
        if (survey.globalSkipLogic && survey.globalSkipLogic.length > 0 && survey.questions && survey.questions.length > 0) {
            const allAnswersForLogic = await Answer.find({ survey: survey._id, collector: collector._id, sessionId: sessionIdToUse }).session(mongoSession);
            triggeredAction = evaluateAllLogic(survey.globalSkipLogic, allAnswersForLogic, survey.questions); 
            if (triggeredAction && triggeredAction.type === 'disqualifyRespondent' && updatedResponse) {
                updatedResponse.status = 'disqualified';
                await updatedResponse.save({ session: mongoSession });
            }
        }

        if (!isOwnerPreviewingDraft) {
            await Collector.updateOne({ _id: collector._id }, { $inc: { responseCount: 1 } }, { session: mongoSession });
            const updatedCollector = await Collector.findById(collector._id).session(mongoSession); 
            if (updatedCollector && updatedCollector.settings?.web_link?.maxResponses && updatedCollector.responseCount >= updatedCollector.settings.web_link.maxResponses) {
                await Collector.updateOne({ _id: updatedCollector._id }, { $set: { status: 'overquota' } }, { session: mongoSession });
                if (updatedResponse) { updatedResponse.status = 'overquota'; await updatedResponse.save({ session: mongoSession }); }
            }
        } else if (updatedResponse) {
            updatedResponse.status = 'preview';
            await updatedResponse.save({ session: mongoSession });
        }

        if (partialResponseDoc) { // If survey was resumed, mark the partial response as completed
            partialResponseDoc.completedAt = new Date();
            // partialResponseDoc.respondentEmail = undefined; // Optionally clear email
            await partialResponseDoc.save({ session: mongoSession });
        }

        await mongoSession.commitTransaction();
        mongoSession.endSession();

        const finalResponseStatus = updatedResponse ? updatedResponse.status : 'completed';
        const responseMessage = finalResponseStatus === 'disqualified'
            ? (triggeredAction?.disqualificationMessage || survey.thankYouMessage?.disqualificationText || 'You have been disqualified based on your responses.')
            : finalResponseStatus === 'overquota'
            ? (survey.thankYouMessage?.overquotaText || 'The survey has reached its response limit. Thank you for your interest.')
            : (survey.thankYouMessage?.text || 'Survey answers submitted successfully.');

        const responsePayload = {
            success: true, message: responseMessage, responseId: updatedResponse ? updatedResponse._id : null,
            sessionId: sessionIdToUse, status: finalResponseStatus, action: triggeredAction || null,
            redirectUrl: finalResponseStatus === 'disqualified' ? (triggeredAction?.disqualificationRedirectUrl || survey.thankYouMessage?.disqualificationRedirectUrl)
                         : finalResponseStatus === 'overquota' ? survey.thankYouMessage?.overquotaRedirectUrl
                         : survey.thankYouMessage?.redirectUrl
        };
        if (!responsePayload.redirectUrl && survey.thankYouMessage?.redirectUrl) {
            responsePayload.redirectUrl = survey.thankYouMessage.redirectUrl;
        }
        res.status(201).json(responsePayload);

    } catch (error) {
        console.error(`[B_SUBMIT_CRITICAL_ERROR] Unhandled error in submitSurveyAnswers for survey ${surveyParamId}, session ${sessionIdToUse}. Error: ${error.message}`, error.stack);
        if (mongoSession && mongoSession.inTransaction()) {
            try { await mongoSession.abortTransaction(); } catch (abortError) { console.error("[B_SUBMIT_CRITICAL_ERROR] Failed to abort transaction:", abortError.message); }
        }
         if (mongoSession) mongoSession.endSession(); // Ensure session is always ended
        if (!res.headersSent) res.status(500).json({ success: false, message: error.message || 'An unexpected error occurred on the server while submitting answers.' });
    }
};

exports.savePartialResponse = async (req, res) => {
    const { surveyId } = req.params;
    const { collectorId, respondentEmail, currentAnswers, otherInputValues, currentVisibleIndex, visitedPath, sessionId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(surveyId) || (collectorId && !mongoose.Types.ObjectId.isValid(collectorId))) {
        return res.status(400).json({ success: false, message: 'Invalid Survey or Collector ID.' });
    }
    if (!respondentEmail || !/\S+@\S+\.\S+/.test(respondentEmail)) {
        return res.status(400).json({ success: false, message: 'A valid email address is required to save progress.' });
    }

    const mongoSession = await mongoose.startSession();
    mongoSession.startTransaction();
    try {
        const survey = await Survey.findById(surveyId).select('title settings.behaviorNavigation').session(mongoSession);
        if (!survey) {
            await mongoSession.abortTransaction(); mongoSession.endSession();
            return res.status(404).json({ success: false, message: 'Survey not found.' });
        }
        if (!survey.settings?.behaviorNavigation?.saveAndContinueEnabled) {
            await mongoSession.abortTransaction(); mongoSession.endSession();
            return res.status(400).json({ success: false, message: 'Save and Continue feature is not enabled for this survey.' });
        }

        const collector = await Collector.findById(collectorId).session(mongoSession);
         if (!collector) { 
            await mongoSession.abortTransaction(); mongoSession.endSession();
            return res.status(404).json({ success: false, message: 'Collector not found.' });
        }

        const resumeToken = crypto.randomBytes(20).toString('hex');
        const expiryDays = survey.settings.behaviorNavigation.saveAndContinueEmailLinkExpiryDays || 7;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expiryDays);

        const partialResponse = new PartialResponse({
            survey: surveyId,
            collector: collectorId,
            sessionId: sessionId || new mongoose.Types.ObjectId().toString(),
            resumeToken,
            respondentEmail,
            answers: currentAnswers || {},
            otherInputValues: otherInputValues || {},
            currentVisibleIndex: currentVisibleIndex === undefined ? 0 : currentVisibleIndex,
            visitedPath: visitedPath || [],
            expiresAt,
        });
        await partialResponse.save({ session: mongoSession });

        const resumeLink = `${process.env.FRONTEND_URL}/surveys/${surveyId}/resume/${resumeToken}`;
        
        await emailService.sendResumeEmail(respondentEmail, survey.title, resumeLink, expiryDays);

        await mongoSession.commitTransaction();
        mongoSession.endSession();
        res.status(200).json({ 
            success: true, 
            message: `Progress saved! A link to resume this survey has been sent to ${respondentEmail}. It will expire in ${expiryDays} days.`
        });

    } catch (error) {
        if (mongoSession.inTransaction()) await mongoSession.abortTransaction();
        mongoSession.endSession(); // Ensure session is always ended
        console.error(`[savePartialResponse] Error saving partial response for survey ${surveyId}:`, error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ success: false, message: 'Validation error saving progress.', details: error.errors });
        }
        if (error.message && error.message.startsWith('Failed to send resume email')) {
             return res.status(500).json({ success: false, message: error.message });
        }
        res.status(500).json({ success: false, message: 'Error saving progress or sending resume email.' });
    }
};


exports.getSurveyResults = async (req, res) => {
    const { surveyId } = req.params;
    const { page = 1, limit = 10, status, startDate, endDate, collectorId } = req.query;
    if (!mongoose.Types.ObjectId.isValid(surveyId)) {
        return res.status(400).json({ success: false, message: 'Invalid Survey ID.' });
    }
    try {
        const survey = await Survey.findById(surveyId).select('title createdBy questions').populate('questions');
        if (!survey) return res.status(404).json({ success: false, message: 'Survey not found.' });
        if (req.user && String(survey.createdBy) !== String(req.user.id) && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Not authorized.' });
        }
        const queryOptions = { survey: survey._id };
        if (status) queryOptions.status = status;
        if (collectorId) queryOptions.collector = collectorId;
        if (startDate || endDate) {
            queryOptions.submittedAt = {};
            if (startDate) queryOptions.submittedAt.$gte = new Date(startDate);
            if (endDate) queryOptions.submittedAt.$lte = new Date(endDate);
        }
        const responses = await Response.find(queryOptions).sort({ submittedAt: -1 }).skip((page - 1) * limit).limit(parseInt(limit)).lean();
        const totalResponses = await Response.countDocuments(queryOptions);
        const responseSessionIds = responses.map(r => r.sessionId);
        const answersNested = await Answer.find({ survey: survey._id, sessionId: { $in: responseSessionIds } }).lean();
        const answersBySessionThenQuestion = answersNested.reduce((acc, ans) => {
            if (!acc[ans.sessionId]) acc[ans.sessionId] = {};
            acc[ans.sessionId][String(ans.questionId)] = ans;
            return acc;
        }, {});
        const results = responses.map(response => {
            const responseAnswers = {};
            if (survey.questions && Array.isArray(survey.questions)) {
                survey.questions.forEach(q => {
                    const answerDoc = answersBySessionThenQuestion[response.sessionId]?.[String(q._id)];
                    responseAnswers[String(q._id)] = {
                        questionText: q.text, questionType: q.type,
                        answerValue: answerDoc ? answerDoc.answerValue : null,
                        otherText: answerDoc ? answerDoc.otherText : null
                    };
                });
            }
            return {
                responseId: response._id, sessionId: response.sessionId, status: response.status,
                submittedAt: response.submittedAt, durationSeconds: response.durationSeconds,
                ipAddress: response.ipAddress, userAgent: response.userAgent,
                customVariables: response.customVariables, answers: responseAnswers,
            };
        });
        res.status(200).json({
            success: true, surveyTitle: survey.title, totalResponses,
            currentPage: parseInt(page), totalPages: Math.ceil(totalResponses / limit),
            limit: parseInt(limit), data: results,
            questions: survey.questions.map(q => ({ _id: q._id, text: q.text, type: q.type, order: q.order, options: q.options, matrixRows: q.matrixRows, matrixColumns: q.matrixColumns }))
        });
    } catch (error) {
        console.error(`[getSurveyResults] Error fetching results for survey ${surveyId}:`, error);
        res.status(500).json({ success: false, message: 'Error fetching survey results.' });
    }
};

exports.exportSurveyResults = async (req, res) => {
    const { surveyId } = req.params;
    const { format = 'csv', collectorId, status, startDate, endDate } = req.query;
    if (!mongoose.Types.ObjectId.isValid(surveyId)) {
        return res.status(400).json({ success: false, message: 'Invalid Survey ID.' });
    }
    try {
        const survey = await Survey.findById(surveyId).populate('questions');
        if (!survey) return res.status(404).json({ success: false, message: 'Survey not found.' });
        if (req.user && String(survey.createdBy) !== String(req.user.id) && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Not authorized.' });
        }
        const responseQuery = { survey: survey._id };
        if (collectorId) responseQuery.collector = collectorId;
        if (status) responseQuery.status = status;
        if (startDate || endDate) {
            responseQuery.submittedAt = {};
            if (startDate) responseQuery.submittedAt.$gte = new Date(startDate);
            if (endDate) responseQuery.submittedAt.$lte = new Date(endDate);
        }
        const responses = await Response.find(responseQuery).sort({ submittedAt: -1 }).lean();
        if (responses.length === 0) return res.status(404).json({ success: false, message: 'No responses found for the given criteria.' });
        const responseSessionIds = responses.map(r => r.sessionId);
        const answersFlat = await Answer.find({ survey: survey._id, sessionId: { $in: responseSessionIds } }).lean();
        const answersBySessionAndQuestion = answersFlat.reduce((acc, ans) => {
            if (!acc[ans.sessionId]) acc[ans.sessionId] = {};
            acc[ans.sessionId][String(ans.questionId)] = ans;
            return acc;
        }, {});
        const dataForExport = responses.map(response => {
            const row = {
                ResponseID: response._id, SessionID: response.sessionId, Status: response.status,
                StartedAt: response.startedAt ? new Date(response.startedAt).toISOString() : '',
                SubmittedAt: response.submittedAt ? new Date(response.submittedAt).toISOString() : '',
                LastActivityAt: response.lastActivityAt ? new Date(response.lastActivityAt).toISOString() : '',
                DurationSeconds: response.durationSeconds,
                IPAddress: response.ipAddress || '', UserAgent: response.userAgent || '',
            };
            const customVars = response.customVariables instanceof Map ? response.customVariables : new Map(Object.entries(response.customVariables || {}));
            customVars.forEach((value, key) => { row[`CustomVar_${key}`] = value; });
            
            survey.questions.forEach(q => {
                const answerDoc = answersBySessionAndQuestion[response.sessionId]?.[String(q._id)];
                row[`Q_${q._id}_${q.text.replace(/[^a-zA-Z0-9]/g, '_').substring(0,50)}`] = answerDoc ? formatValueForCsv(answerDoc.answerValue, q.type, answerDoc.otherText) : '';
            });
            return row;
        });
        if (format.toLowerCase() === 'json') {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="survey_${surveyId}_results.json"`);
            res.status(200).json(dataForExport);
        } else {
            if (dataForExport.length === 0) {
                 return res.status(404).json({ success: false, message: 'No data to export to CSV.' });
            }
            const fields = Object.keys(dataForExport[0]);
            const json2csvParser = new Parser({ fields, delimiter: ',', excelStrings: true });
            const csv = json2csvParser.parse(dataForExport);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="survey_${surveyId}_results.csv"`);
            res.status(200).send(csv);
        }
    } catch (error) {
        console.error(`[exportSurveyResults] Error exporting results for survey ${surveyId}:`, error);
        res.status(500).json({ success: false, message: 'Error exporting survey results.' });
    }
};
// ----- END OF COMPLETE UPDATED FILE (vNext26 - Integrated Email Service) -----