// backend/controllers/surveyController.js
// ----- START OF COMPLETE UPDATED FILE (vNext18 - Pass ProgressBar settings to frontend) -----
const mongoose = require('mongoose');
const { Parser } = require('json2csv');
const Survey = require('../models/Survey');
const Question = require('../models/Question');
const Answer = require('../models/Answer');
const Collector = require('../models/Collector');
const Response = require('../models/Response');
const { evaluateAllLogic, evaluateSurveyLogic } = require('../utils/logicEvaluator'); // Assuming evaluateSurveyLogic is also in logicEvaluator
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
                .select('title description welcomeMessage thankYouMessage status questions settings.surveyWide.allowRetakes settings.surveyWide.showProgressBar settings.surveyWide.customCSS globalSkipLogic randomizationLogic') // showProgressBar is survey-wide, not collector specific yet
                .populate({ path: 'questions', options: { sort: { order: 1 } } });

            if (collectorId) {
                // --- MODIFIED: Added progressBarEnabled & progressBarStyle to selectFields ---
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

                // --- MODIFIED: Ensure progressBar settings are passed with defaults ---
                if (typeof surveyResponseData.collectorSettings.allowBackButton === 'undefined') {
                    surveyResponseData.collectorSettings.allowBackButton = true; // Default if not set
                }
                if (typeof surveyResponseData.collectorSettings.progressBarEnabled === 'undefined') {
                    surveyResponseData.collectorSettings.progressBarEnabled = false; // Default if not set
                }
                if (typeof surveyResponseData.collectorSettings.progressBarStyle === 'undefined') {
                    surveyResponseData.collectorSettings.progressBarStyle = 'percentage'; // Default if not set
                }
                // --- END MODIFIED ---

            } else { // Default settings if no collector or not web_link (e.g., owner previewing draft without collector)
                surveyResponseData.collectorSettings = {
                    allowMultipleResponses: survey.settings?.surveyWide?.allowRetakes ?? true,
                    anonymousResponses: false,
                    enableRecaptcha: false,
                    recaptchaSiteKey: process.env.REACT_APP_RECAPTCHA_SITE_KEY || '',
                    ipAllowlist: [],
                    ipBlocklist: [],
                    allowBackButton: true,
                    progressBarEnabled: false, // Default
                    progressBarStyle: 'percentage' // Default
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

exports.deleteSurvey = async (req, res) => { /* ... (no changes) ... */ };
exports.submitSurveyAnswers = async (req, res) => { /* ... (no changes) ... */ };
exports.getSurveyResults = async (req, res) => { /* ... (no changes) ... */ };
exports.exportSurveyResults = async (req, res) => { /* ... (no changes) ... */ };
// ----- END OF COMPLETE UPDATED FILE (vNext18 - Pass ProgressBar settings to frontend) -----