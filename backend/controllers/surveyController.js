// backend/controllers/surveyController.js
// ----- START OF COMPLETE MODIFIED FILE (vX.X+6 - Store Custom Variables) -----
const mongoose = require('mongoose');
const { Parser } = require('json2csv');
const crypto =require('crypto');
const Survey = require('../models/Survey');
const Question = require('../models/Question');
const Answer = require('../models/Answer');
const Collector = require('../models/Collector');
const Response = require('../models/Response');
const PartialResponse = require('../models/PartialResponse');
// const { evaluateAllLogic } = require('../utils/logicEvaluator'); // Assuming not used yet
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
// getAllSurveys, createSurvey, getSurveyById (admin part), updateSurvey, deleteSurvey, getSurveyResults, exportSurveyResults
// remain the same as vX.X+5. Only getSurveyById (forTaking), submitSurveyAnswers, and savePartialResponse are modified below.

exports.getAllSurveys = async (req, res) => { 
    console.log(`[getAllSurveys CONTROLLER ENTRY] Request received for path: ${req.path}`);
    console.log(`[getAllSurveys] User from protect middleware: ${req.user?.id}, Role: ${req.user?.role}. Fetching surveys.`); 
    try { 
        const filter = {}; 
        if (req.user && req.user.id) { 
            filter.createdBy = req.user.id; 
            if (req.user.role === 'admin') { 
                delete filter.createdBy; 
                console.log(`[getAllSurveys] Admin access, fetching all surveys.`); 
            } 
        } else { 
            console.warn('[getAllSurveys] Authentication details missing or invalid, though `protect` middleware should handle this.'); 
            if (!res.headersSent) {
                return res.status(401).json({ success: false, message: "Authentication details missing or invalid." }); 
            }
            return; 
        } 
        console.log('[getAllSurveys] Querying database with filter:', filter);
        const surveys = await Survey.find(filter) 
            .select('-questions -globalSkipLogic -settings -randomizationLogic -collectors') 
            .sort({ createdAt: -1 }); 
        console.log(`[getAllSurveys] Found ${surveys.length} surveys.`); 
        if (!res.headersSent) { 
            res.status(200).json({ success: true, count: surveys.length, data: surveys }); 
        } 
    } catch (error) { 
        console.error(`[getAllSurveys] CRITICAL ERROR. User: ${req.user?.id}. Error: ${error.message}`, error.stack); 
        if (!res.headersSent) { 
            res.status(500).json({ success: false, message: "Critical error fetching surveys on the server." }); 
        } 
    } 
};

exports.createSurvey = async (req, res) => {
    console.log(`[createSurvey] User: ${req.user?.id}. Attempting to create survey.`);
    const { title, description, category, settings, welcomeMessage, thankYouMessage } = req.body;
    try {
        if (!req.user || !req.user.id) {
            console.error('[createSurvey] User ID not found in request. Auth middleware issue?');
            return res.status(401).json({ success: false, message: 'User authentication failed.' });
        }
        const defaultBehaviorNav = {
            autoAdvance: false, questionNumberingEnabled: true, questionNumberingFormat: '123',
            questionNumberingCustomPrefix: '', saveAndContinueEnabled: false,
            saveAndContinueEmailLinkExpiryDays: 7, saveAndContinueMethod: 'email',
        };
        const defaultCustomVariables = []; // This is for definitions
        const mergedSettings = {
            surveyWide: { ...(settings?.surveyWide || {}) },
            completion: { ...(settings?.completion || {}) },
            accessSecurity: { ...(settings?.accessSecurity || {}) },
            behaviorNavigation: { ...defaultBehaviorNav, ...(settings?.behaviorNavigation || {}) },
            customVariables: Array.isArray(settings?.customVariables) ? settings.customVariables : defaultCustomVariables
        };
        const newSurvey = new Survey({
            title: title || 'Untitled Survey', description, category,
            createdBy: req.user.id, status: 'draft', settings: mergedSettings,
            welcomeMessage: welcomeMessage || { text: "Welcome to the survey!" },
            thankYouMessage: thankYouMessage || { text: "Thank you for completing the survey!" },
        });
        const savedSurvey = await newSurvey.save();
        console.log(`[createSurvey] Survey created successfully. ID: ${savedSurvey._id}, User: ${req.user.id}`);
        res.status(201).json({ success: true, message: 'Survey created successfully.', data: savedSurvey });
    } catch (error) {
        console.error(`[createSurvey] Error creating survey. User: ${req.user?.id}. Error:`, error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ success: false, message: 'Validation Error', details: error.errors });
        }
        res.status(500).json({ success: false, message: 'Error creating survey.' });
    }
};

// getSurveyById is modified to handle custom variable parsing when forTaking=true
exports.getSurveyById = async (req, res) => { 
    const { surveyId } = req.params;
    const { forTaking, collectorId, isPreviewingOwner, resumeToken, ...queryParams } = req.query; // Capture other queryParams
    console.log(`[getSurveyById] Request for survey: ${surveyId}, forTaking: ${forTaking}, collectorId: ${collectorId}, resumeToken: ${resumeToken}, isPreviewingOwner: ${isPreviewingOwner}, QueryParams:`, queryParams);

    if (!mongoose.Types.ObjectId.isValid(surveyId)) {
        return res.status(400).json({ success: false, message: 'Invalid Survey ID.' });
    }
    try {
        let surveyQuery = Survey.findById(surveyId);
        let actualCollectorDoc = null;
        let populatedPartialResponseData = null; 
        let capturedCustomVariables = {}; // For storing parsed custom variables

        if (forTaking !== 'true') { 
            if (!req.user || !req.user.id) {
                 console.error('[getSurveyById - Admin Access] User ID not found. Auth middleware issue?');
                 return res.status(401).json({ success: false, message: 'User authentication failed for admin access.' });
            }
        }
        const explicitSelectFieldsForCollector = 'status type linkId survey responseCount ' + '+settings.web_link.password ' + 'settings.web_link.customSlug ' + 'settings.web_link.allowMultipleResponses ' + 'settings.web_link.anonymousResponses ' + 'settings.web_link.enableRecaptcha ' + 'settings.web_link.recaptchaSiteKey ' + 'settings.web_link.ipAllowlist ' + 'settings.web_link.ipBlocklist ' + 'settings.web_link.allowBackButton ' + 'settings.web_link.progressBarEnabled ' + 'settings.web_link.progressBarStyle ' + 'settings.web_link.progressBarPosition ' + 'settings.web_link.openDate ' + 'settings.web_link.closeDate ' + 'settings.web_link.maxResponses ' + 'settings.web_link.saveAndContinueEnabled ' + 'settings.web_link.saveAndContinueMethod ' + 'settings.web_link.questionNumberingFormat ' + 'settings.web_link.questionNumberingCustomPrefix';

        if (forTaking === 'true') {
            // Select settings.customVariables to get definitions
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

        // If forTaking, parse custom variables from queryParams against survey definitions
        if (forTaking === 'true' && survey.settings?.customVariables && survey.settings.customVariables.length > 0) {
            survey.settings.customVariables.forEach(def => {
                if (queryParams.hasOwnProperty(def.key)) {
                    capturedCustomVariables[def.key] = queryParams[def.key];
                } else if (def.defaultValue) {
                    capturedCustomVariables[def.key] = def.defaultValue;
                }
            });
            console.log(`[getSurveyById forTaking] Captured custom variables from URL:`, capturedCustomVariables);
        }
        
        if (forTaking !== 'true' && req.user && String(survey.createdBy) !== String(req.user.id) && req.user.role !== 'admin') { return res.status(403).json({ success: false, message: 'You are not authorized to view this survey\'s details.' }); }
        const effectiveIsOwnerPreviewing = isPreviewingOwner === 'true' && req.user && String(survey.createdBy) === String(req.user.id);

        if (forTaking === 'true') {
            if (survey.status !== 'active' && !effectiveIsOwnerPreviewing && !resumeToken) { return res.status(403).json({ success: false, message: 'This survey is not currently active.' }); }
            if (collectorId && !actualCollectorDoc && !effectiveIsOwnerPreviewing && !resumeToken) { return res.status(404).json({ success: false, message: 'Collector not found or invalid for this survey.' }); }

            if (resumeToken) {
                const partialDoc = await PartialResponse.findOne({ resumeToken: resumeToken, survey: survey._id }).lean(); 
                if (!partialDoc) { return res.status(404).json({ success: false, message: 'Invalid or expired resume link.' }); }
                if (partialDoc.expiresAt < new Date()) { return res.status(410).json({ success: false, message: 'This resume link has expired.' }); }
                if (partialDoc.completedAt) { return res.status(410).json({ success: false, message: 'This survey session has already been completed.' }); }
                
                const answersFromDb = await Answer.find({ survey: survey._id, sessionId: partialDoc.sessionId }).lean();
                const answersMap = {}; const otherInputValuesMap = {};
                answersFromDb.forEach(ans => {
                    answersMap[ans.questionId.toString()] = ans.answerValue;
                    if (ans.otherText) otherInputValuesMap[`${ans.questionId.toString()}_other`] = ans.otherText;
                });
                
                // Merge custom variables: saved partial ones + new from URL query
                let mergedCustomVarsForResume = { ...(partialDoc.customVariables || {}) };
                if (survey.settings?.customVariables && survey.settings.customVariables.length > 0) {
                    survey.settings.customVariables.forEach(def => {
                        if (queryParams.hasOwnProperty(def.key)) { // URL params override saved ones for resume
                            mergedCustomVarsForResume[def.key] = queryParams[def.key];
                        } else if (!mergedCustomVarsForResume.hasOwnProperty(def.key) && def.defaultValue) {
                            mergedCustomVarsForResume[def.key] = def.defaultValue;
                        }
                    });
                }
                console.log(`[getSurveyById forTaking] Merged custom variables for resume:`, mergedCustomVarsForResume);

                populatedPartialResponseData = { 
                    ...partialDoc, 
                    answers: answersMap, 
                    otherInputValues: otherInputValuesMap,
                    customVariables: mergedCustomVarsForResume // Use merged
                };

                if (!actualCollectorDoc && partialDoc.collector) {
                     actualCollectorDoc = await Collector.findById(partialDoc.collector).select(explicitSelectFieldsForCollector).lean();
                }
            }
            if (actualCollectorDoc) { 
                if (String(actualCollectorDoc.survey) !== String(survey._id)) { return res.status(400).json({ success: false, message: 'Collector does not belong to this survey.' }); }
                if (actualCollectorDoc.status !== 'open' && !effectiveIsOwnerPreviewing && !resumeToken) { return res.status(403).json({ success: false, message: `This survey link is ${actualCollectorDoc.status}.` });}
                const webLinkSettings = actualCollectorDoc.settings?.web_link || {};
                if (!effectiveIsOwnerPreviewing && !resumeToken) { 
                    const respondentIp = getIpAddress(req); 
                    const { ipAllowlist, ipBlocklist } = webLinkSettings; 
                    if (respondentIp) { 
                        if (ipAllowlist?.length > 0 && !ipAllowlist.some(allowedIpOrRange => ipRangeCheck(respondentIp, allowedIpOrRange))) { return res.status(403).json({ success: false, message: 'Access restricted (not in allowlist).' }); } 
                        if (ipBlocklist?.length > 0 && ipBlocklist.some(blockedIpOrRange => ipRangeCheck(respondentIp, blockedIpOrRange))) { return res.status(403).json({ success: false, message: 'Access restricted (in blocklist).' }); } 
                    }
                }
            } 
            else if (!effectiveIsOwnerPreviewing && survey.status === 'draft' && !collectorId && !resumeToken) { return res.status(403).json({ success: false, message: 'Survey is in draft mode.' }); }
        }
        let processedQuestions = survey.questions || []; 
        if (Array.isArray(processedQuestions) && processedQuestions.length > 0 && typeof processedQuestions[0] === 'object' && processedQuestions[0] !== null) { processedQuestions = processedQuestions.map(q => { if (q && q.type === 'conjoint' && q.conjointAttributes) { return { ...q, generatedProfiles: generateConjointProfiles(q.conjointAttributes) }; } return q; }); }
        
        const surveyResponseData = { ...survey, questions: processedQuestions };

        if (forTaking === 'true') {
            const surveyBehaviorNav = survey.settings?.behaviorNavigation || {};
            const collectorWebLink = actualCollectorDoc?.settings?.web_link || {};
            surveyResponseData.collectorSettings = { /* ... same as vX.X+5 ... */ allowMultipleResponses: collectorWebLink.allowMultipleResponses ?? surveyBehaviorNav.allowMultipleResponses ?? true, anonymousResponses: collectorWebLink.anonymousResponses ?? surveyBehaviorNav.anonymousResponses ?? false, enableRecaptcha: collectorWebLink.enableRecaptcha ?? false, recaptchaSiteKey: collectorWebLink.recaptchaSiteKey || process.env.RECAPTCHA_SITE_KEY_V2 || '', ipAllowlist: collectorWebLink.ipAllowlist || [], ipBlocklist: collectorWebLink.ipBlocklist || [], allowBackButton: collectorWebLink.allowBackButton ?? surveyBehaviorNav.allowBackButton ?? true, progressBarEnabled: collectorWebLink.progressBarEnabled ?? surveyBehaviorNav.progressBarEnabled ?? false, progressBarStyle: collectorWebLink.progressBarStyle || surveyBehaviorNav.progressBarStyle || 'percentage', progressBarPosition: collectorWebLink.progressBarPosition || surveyBehaviorNav.progressBarPosition || 'top', saveAndContinueEnabled: collectorWebLink.saveAndContinueEnabled ?? surveyBehaviorNav.saveAndContinueEnabled ?? false, saveAndContinueMethod: collectorWebLink.saveAndContinueMethod || surveyBehaviorNav.saveAndContinueMethod || 'both', autoAdvance: collectorWebLink.autoAdvance ?? surveyBehaviorNav.autoAdvance ?? false, questionNumberingEnabled: collectorWebLink.questionNumberingEnabled ?? surveyBehaviorNav.questionNumberingEnabled ?? true, questionNumberingFormat: collectorWebLink.questionNumberingFormat || surveyBehaviorNav.questionNumberingFormat || '123', questionNumberingCustomPrefix: collectorWebLink.questionNumberingCustomPrefix || surveyBehaviorNav.questionNumberingCustomPrefix || '', };
            surveyResponseData.actualCollectorObjectId = actualCollectorDoc?._id || null;
            
            // Add initial custom variables if not resuming, or use from populated partial if resuming
            if (populatedPartialResponseData) {
                surveyResponseData.partialResponse = populatedPartialResponseData; // This now contains merged customVariables
            } else {
                surveyResponseData.initialCustomVariables = capturedCustomVariables; // For new sessions
            }
        }
        console.log(`[getSurveyById] Successfully fetched survey: ${surveyId}. Custom Vars: ${JSON.stringify(surveyResponseData.initialCustomVariables || surveyResponseData.partialResponse?.customVariables)}`);
        if (!res.headersSent) {
            res.status(200).json({ success: true, data: surveyResponseData });
        }
    } catch (error) { 
        console.error(`[getSurveyById] CRITICAL ERROR fetching survey ${surveyId}. Error:`, error.stack); 
        if (!res.headersSent) {
            res.status(500).json({ success: false, message: 'Error fetching survey data on the server.' }); 
        }
    }
};

exports.updateSurvey = async (req, res) => { /* ... same as vX.X+5 ... */ const { surveyId } = req.params; const updates = req.body; console.log(`[SurveyCtrl updateSurvey] ID: ${surveyId} - Received updates:`, JSON.stringify(updates, null, 2)); if (!mongoose.Types.ObjectId.isValid(surveyId)) { return res.status(400).json({ success: false, message: 'Invalid Survey ID.' }); } if (!req.user || !req.user.id) { console.error('[updateSurvey] User ID not found. Auth middleware issue?'); return res.status(401).json({ success: false, message: 'User authentication failed.' }); } const session = await mongoose.startSession(); session.startTransaction(); try { const survey = await Survey.findById(surveyId).session(session); if (!survey) { await session.abortTransaction(); session.endSession(); console.log(`[updateSurvey] Survey not found: ${surveyId}`); return res.status(404).json({ success: false, message: 'Survey not found.' }); } if (String(survey.createdBy) !== String(req.user.id) && req.user.role !== 'admin') { await session.abortTransaction(); session.endSession(); console.log(`[updateSurvey] Unauthorized attempt by user ${req.user.id} for survey ${surveyId}`); return res.status(403).json({ success: false, message: 'Not authorized to update this survey.' }); } console.log(`[SurveyCtrl updateSurvey] Survey Status BEFORE any local update: ${survey.status}`); if (updates.hasOwnProperty('status')) { console.log(`[SurveyCtrl updateSurvey] Update payload CONTAINS status: "${updates.status}"`); } else { console.log(`[SurveyCtrl updateSurvey] Update payload DOES NOT CONTAIN status field.`); } const allowedTopLevelFields = [ 'title', 'description', 'status', 'category', 'randomizationLogic', 'welcomeMessage', 'thankYouMessage', 'globalSkipLogic' ]; for (const key of allowedTopLevelFields) { if (updates.hasOwnProperty(key)) { if (key === 'status') { console.log(`[SurveyCtrl updateSurvey] Attempting to update survey.${key} from "${survey[key]}" to "${updates[key]}"`); } survey[key] = updates[key]; } } if (updates.settings && typeof updates.settings === 'object') { console.log(`[SurveyCtrl updateSurvey] Updating nested settings. Current survey.settings:`, JSON.stringify(survey.settings, null, 2)); console.log(`[SurveyCtrl updateSurvey] Updates for settings:`, JSON.stringify(updates.settings, null, 2)); survey.settings = survey.settings || {}; const defaultBehaviorNav = { autoAdvance: false, questionNumberingEnabled: true, questionNumberingFormat: '123', questionNumberingCustomPrefix: '', saveAndContinueEnabled: false, saveAndContinueEmailLinkExpiryDays: 7, saveAndContinueMethod: 'email' }; const defaultCustomVariables = []; for (const categoryKey in updates.settings) { if (Object.prototype.hasOwnProperty.call(updates.settings, categoryKey)) { if (categoryKey === 'customVariables') { survey.settings.customVariables = Array.isArray(updates.settings.customVariables) ? updates.settings.customVariables.filter(cv => cv.key && cv.key.trim() !== '') : defaultCustomVariables; } else if (typeof updates.settings[categoryKey] === 'object' && updates.settings[categoryKey] !== null && !Array.isArray(updates.settings[categoryKey])) { survey.settings[categoryKey] = { ...(survey.settings[categoryKey] || (categoryKey === 'behaviorNavigation' ? defaultBehaviorNav : {})), ...updates.settings[categoryKey] }; if (categoryKey === 'behaviorNavigation' && survey.settings.behaviorNavigation) { const validMethods = ['email', 'code', 'both']; if (updates.settings.behaviorNavigation.hasOwnProperty('saveAndContinueMethod') && !validMethods.includes(survey.settings.behaviorNavigation.saveAndContinueMethod)) { console.warn(`[updateSurvey] Invalid saveAndContinueMethod '${survey.settings.behaviorNavigation.saveAndContinueMethod}', reverting to default 'email'.`); survey.settings.behaviorNavigation.saveAndContinueMethod = defaultBehaviorNav.saveAndContinueMethod; } } } else { survey.settings[categoryKey] = updates.settings[categoryKey]; } } } if (!survey.settings.behaviorNavigation) survey.settings.behaviorNavigation = defaultBehaviorNav; else survey.settings.behaviorNavigation = { ...defaultBehaviorNav, ...survey.settings.behaviorNavigation }; if (!survey.settings.customVariables) survey.settings.customVariables = defaultCustomVariables; console.log(`[SurveyCtrl updateSurvey] Survey settings AFTER merge:`, JSON.stringify(survey.settings, null, 2)); } if (updates.questions && Array.isArray(updates.questions)) { console.log(`[SurveyCtrl updateSurvey] Updating questions. Received ${updates.questions.length} questions in payload.`); survey.questions = updates.questions.map(q => q._id || q); const questionUpdatePromises = []; updates.questions.forEach((qData, index) => { const targetIndex = (qData && typeof qData.originalIndex === 'number') ? qData.originalIndex : index; if (qData && qData._id) { console.log(`[SurveyCtrl updateSurvey] Scheduling update for Question ID: ${qData._id} to originalIndex: ${targetIndex}`); questionUpdatePromises.push( Question.updateOne({ _id: qData._id }, { $set: { originalIndex: targetIndex } }).session(session) ); } else { console.warn(`[SurveyCtrl updateSurvey] Question data missing _id in questions array at index ${index}`, qData); } }); if (questionUpdatePromises.length > 0) { await Promise.all(questionUpdatePromises); console.log(`[SurveyCtrl updateSurvey] Finished updating originalIndex for ${questionUpdatePromises.length} questions.`); } } survey.updatedAt = Date.now(); console.log(`[SurveyCtrl updateSurvey] Survey Status AFTER applying all updates, BEFORE save: ${survey.status}`); console.log(`[SurveyCtrl updateSurvey] survey.isModified('status'): ${survey.isModified('status')}`); console.log(`[SurveyCtrl updateSurvey] survey.isModified('settings'): ${survey.isModified('settings')}`); console.log(`[SurveyCtrl updateSurvey] Full survey object BEFORE save:`, JSON.stringify(survey.toObject(), null, 2)); const updatedSurvey = await survey.save({ session }); console.log(`[SurveyCtrl updateSurvey] Survey Status AFTER save (from save result): ${updatedSurvey.status}`); await session.commitTransaction(); session.endSession(); const populatedSurvey = await Survey.findById(updatedSurvey._id) .populate({ path: 'questions', model: 'Question', options: { sort: { originalIndex: 1 } } }) .populate('collectors') .populate('createdBy', 'name email'); console.log(`[updateSurvey] Survey ${surveyId} updated successfully. Final status: ${populatedSurvey.status}`); if (!res.headersSent) { res.status(200).json({ success: true, message: 'Survey updated successfully.', data: populatedSurvey }); } } catch (error) { if (session.inTransaction()) { await session.abortTransaction(); } session.endSession(); console.error(`[SurveyCtrl updateSurvey] Error updating survey ${surveyId}. User: ${req.user?.id}. Error:`, error.stack); if (error.name === 'ValidationError') { if (!res.headersSent) return res.status(400).json({ success: false, message: 'Validation Error', details: error.errors }); } if (!res.headersSent) res.status(500).json({ success: false, message: 'Error updating survey on the server.' }); } };
exports.deleteSurvey = async (req, res) => { /* ... same as vX.X+5 ... */ const { surveyId } = req.params; console.log(`[deleteSurvey] User: ${req.user?.id}. Attempting to delete survey: ${surveyId}`); if (!mongoose.Types.ObjectId.isValid(surveyId)) { return res.status(400).json({ success: false, message: 'Invalid Survey ID.' }); } if (!req.user || !req.user.id) { console.error('[deleteSurvey] User ID not found. Auth middleware issue?'); return res.status(401).json({ success: false, message: 'User authentication failed.' }); } const session = await mongoose.startSession(); session.startTransaction(); try { const survey = await Survey.findById(surveyId).select('createdBy').session(session); if (!survey) { await session.abortTransaction(); session.endSession(); console.log(`[deleteSurvey] Survey not found: ${surveyId}`); return res.status(404).json({ success: false, message: 'Survey not found.' }); } if (String(survey.createdBy) !== String(req.user.id) && req.user.role !== 'admin') { await session.abortTransaction(); session.endSession(); console.log(`[deleteSurvey] Unauthorized attempt by user ${req.user.id} for survey ${surveyId}`); return res.status(403).json({ success: false, message: 'Not authorized to delete this survey.' }); } console.log(`[deleteSurvey] Deleting related data for survey ${surveyId}...`); await Question.deleteMany({ survey: surveyId }, { session }); await Collector.deleteMany({ survey: surveyId }, { session }); await Response.deleteMany({ survey: surveyId }, { session }); await Answer.deleteMany({ survey: surveyId }, { session }); await PartialResponse.deleteMany({ survey: surveyId }, { session }); await Survey.findByIdAndDelete(surveyId, { session }); await session.commitTransaction(); session.endSession(); console.log(`[deleteSurvey] Survey ${surveyId} and all associated data deleted successfully.`); if (!res.headersSent) { res.status(200).json({ success: true, message: 'Survey and all associated data deleted successfully.' }); } } catch (error) { if (session.inTransaction()) await session.abortTransaction(); session.endSession(); console.error(`[deleteSurvey] Error deleting survey ${surveyId}. User: ${req.user?.id}. Error:`, error.stack); if (!res.headersSent) { res.status(500).json({ success: false, message: 'Error deleting survey.' }); } } };

exports.submitSurveyAnswers = async (req, res) => {
    const { surveyId } = req.params;
    // +++ MODIFIED: Added customVariables to destructuring +++
    const { collectorId, answers, otherInputValues, resumeToken, recaptchaTokenV2, clientSessionId, customVariables } = req.body;
    console.log(`[SUBMIT ENDPOINT V2] Survey: ${surveyId}, Collector: ${collectorId}, ClientSessionId: ${clientSessionId}, ResumeToken: ${resumeToken}, CustomVars:`, customVariables);
    
    // ... (validations for surveyId, collectorId, clientSessionId, answers - same as vX.X+5) ...
    if (!mongoose.Types.ObjectId.isValid(surveyId)) { return res.status(400).json({ success: false, message: 'Invalid Survey ID.' }); }
    if (!collectorId || !mongoose.Types.ObjectId.isValid(collectorId)) { return res.status(400).json({ success: false, message: 'Collector ID is required and must be valid.' }); }
    if (!clientSessionId) { return res.status(400).json({ success: false, message: 'Client Session ID is required.' }); }
    if (typeof answers !== 'object' || answers === null) { return res.status(400).json({ success: false, message: 'Answers must be an object.' });}

    const mongoSession = await mongoose.startSession();
    mongoSession.startTransaction();
    try {
        // Fetch survey with customVariable definitions to validate keys if necessary (optional strict validation)
        const survey = await Survey.findById(surveyId)
            .select('status questions settings.completion thankYouMessage settings.customVariables') // Ensure customVariables definitions are fetched
            .populate({ path: 'questions', model: 'Question' })
            .session(mongoSession);

        if (!survey) { /* ... same as vX.X+5 ... */ await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(404).json({ success: false, message: 'Survey not found.' }); }
        if (survey.status !== 'active') { /* ... same as vX.X+5 ... */ await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(403).json({ success: false, message: 'This survey is not active.' }); }
        
        const collector = await Collector.findById(collectorId).select('status settings survey responseCount').session(mongoSession);
        if (!collector) { /* ... same as vX.X+5 ... */ await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(404).json({ success: false, message: 'Collector not found.' }); }
        if (String(collector.survey) !== String(surveyId)) { /* ... same as vX.X+5 ... */ await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(400).json({ success: false, message: 'Collector mismatch.' }); }
        if (collector.status !== 'open') { /* ... same as vX.X+5 ... */ await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(403).json({ success: false, message: `Link is ${collector.status}.` }); }
        
        // ... (reCAPTCHA, multiple response check, answer validation - same as vX.X+5) ...
        const respondentIp = getIpAddress(req); const userAgent = req.headers['user-agent']; if (collector.settings?.web_link?.enableRecaptcha) { const secretKey = process.env.RECAPTCHA_SECRET_KEY; if (!recaptchaTokenV2) { await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(400).json({ success: false, message: 'reCAPTCHA token missing.' }); } if (!secretKey) { console.error('[SUBMIT ENDPOINT V2] RECAPTCHA_SECRET_KEY not set.'); await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(500).json({ success: false, message: 'reCAPTCHA server config error.' }); } const verificationURL = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${recaptchaTokenV2}&remoteip=${respondentIp}`; try { const recaptchaRes = await axios.post(verificationURL); if (!recaptchaRes.data.success) { console.warn('[SUBMIT ENDPOINT V2] reCAPTCHA v2 verification failed:', recaptchaRes.data['error-codes']); await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(400).json({ success: false, message: 'reCAPTCHA verification failed.', details: recaptchaRes.data['error-codes'] }); } console.log('[SUBMIT ENDPOINT V2] reCAPTCHA v2 verified successfully.'); } catch (e) { console.error("[SUBMIT ENDPOINT V2] reCAPTCHA HTTP error:", e.message); await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(500).json({ success: false, message: 'Error verifying reCAPTCHA.' }); } } if (!collector.settings?.web_link?.allowMultipleResponses) { const isAnonymous = collector.settings?.web_link?.anonymousResponses || false; const queryCriteria = { survey: surveyId, collector: collectorId, status: 'completed' }; if (isAnonymous) { if (respondentIp) queryCriteria.ipAddress = respondentIp; } else if (req.user && req.user._id) { queryCriteria.userId = req.user._id; } else if (respondentIp) { queryCriteria.ipAddress = respondentIp; } if (queryCriteria.ipAddress || queryCriteria.userId) { const existingFullResponse = await Response.findOne(queryCriteria).session(mongoSession); if (existingFullResponse) { await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(403).json({ success: false, message: 'You have already submitted this survey.' });} } } const validationErrors = []; const questionsMap = new Map(survey.questions.map(q => [q._id.toString(), q])); for (const questionIdStr in answers) { if (Object.hasOwnProperty.call(answers, questionIdStr)) { const question = questionsMap.get(questionIdStr); if (!question) { console.warn(`[SUBMIT ENDPOINT V2] Answer for non-existent question ID: ${questionIdStr}`); validationErrors.push({ questionId: questionIdStr, message: "Answer for unknown question." }); continue; } const answerValue = answers[questionIdStr]; const otherText = otherInputValues ? otherInputValues[`${questionIdStr}_other`] : undefined; const error = validateAnswerDetailed(question, answerValue, otherText); if (error) { validationErrors.push({ questionId: questionIdStr, text: question.text, message: error });} } } for (const question of survey.questions) { if (!answers.hasOwnProperty(question._id.toString()) && question.requiredSetting === 'required') { const error = validateAnswerDetailed(question, undefined, undefined); if (error) { validationErrors.push({ questionId: question._id.toString(), text: question.text, message: error });} } } if (validationErrors.length > 0) { await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(400).json({ success: false, message: 'Answer validation failed.', errors: validationErrors }); }


        let partialResponseToUpdate = null;
        if (resumeToken) { /* ... same as vX.X+5 ... */ partialResponseToUpdate = await PartialResponse.findOne({ resumeToken, survey: surveyId, collector: collectorId }).session(mongoSession); if (partialResponseToUpdate) { if (partialResponseToUpdate.completedAt) { await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(409).json({ success: false, message: 'This survey session was already completed.' });} } else { console.warn(`[SUBMIT ENDPOINT V2] Valid resume token ${resumeToken} provided, but no matching partial response found.`); } }

        let responseDoc = await Response.findOne({ survey: surveyId, collector: collectorId, sessionId: clientSessionId, status: 'partial' }).session(mongoSession);
        const isAnonymousResp = collector.settings?.web_link?.anonymousResponses || false;
        const startedAtForResponse = partialResponseToUpdate?.createdAt || responseDoc?.startedAt || new Date();

        // +++ MODIFIED: Prepare customVariables for saving +++
        const customVariablesToSave = new Map();
        if (customVariables && typeof customVariables === 'object') {
            const definedKeys = new Set((survey.settings?.customVariables || []).map(cv => cv.key));
            for (const key in customVariables) {
                if (definedKeys.has(key)) { // Only save variables that are defined in survey settings
                    customVariablesToSave.set(key, customVariables[key]);
                } else {
                    console.warn(`[SUBMIT ENDPOINT V2] Ignoring custom variable '${key}' as it's not defined in survey settings.`);
                }
            }
        }
        
        if (responseDoc) {
            responseDoc.status = 'completed'; 
            responseDoc.submittedAt = new Date(); 
            responseDoc.lastActivityAt = new Date();
            responseDoc.ipAddress = isAnonymousResp ? undefined : respondentIp;
            responseDoc.userAgent = isAnonymousResp ? undefined : userAgent;
            responseDoc.userId = (req.user && req.user._id && !isAnonymousResp && responseDoc.schema.path('userId')) ? req.user._id : undefined;
            responseDoc.customVariables = customVariablesToSave; // Save validated custom variables
        } else {
            responseDoc = new Response({
                survey: surveyId, collector: collectorId, sessionId: clientSessionId, status: 'completed',
                startedAt: startedAtForResponse, lastActivityAt: new Date(),
                ipAddress: isAnonymousResp ? undefined : respondentIp,
                userAgent: isAnonymousResp ? undefined : userAgent,
                userId: (req.user && req.user._id && !isAnonymousResp && Response.schema.path('userId')) ? req.user._id : undefined,
                customVariables: customVariablesToSave, // Save validated custom variables
            });
        }
        await responseDoc.save({ session: mongoSession });

        // ... (Answer saving logic - same as vX.X+5) ...
        const answerOps = []; for (const questionIdStr in answers) { if (Object.hasOwnProperty.call(answers, questionIdStr)) { const questionObjectId = new mongoose.Types.ObjectId(questionIdStr); const answerValue = answers[questionIdStr]; const otherText = otherInputValues ? otherInputValues[`${questionIdStr}_other`] : undefined; answerOps.push({ updateOne: { filter: { survey: surveyId, questionId: questionObjectId, sessionId: clientSessionId, collector: collectorId }, update: { $set: { answerValue: answerValue, otherText: otherText, updatedAt: new Date() }, $setOnInsert: { survey: surveyId, questionId: questionObjectId, sessionId: clientSessionId, collector: collectorId, createdAt: new Date() }}, upsert: true } }); } } if (answerOps.length > 0) { await Answer.bulkWrite(answerOps, { session: mongoSession }); console.log(`[SUBMIT ENDPOINT V2] Bulk upserted ${answerOps.length} Answer documents.`); }
        
        if (partialResponseToUpdate) {
            partialResponseToUpdate.completedAt = new Date();
            partialResponseToUpdate.finalResponse = responseDoc._id;
            // Ensure custom variables from the final submission are also on the partial for consistency if needed
            partialResponseToUpdate.customVariables = customVariablesToSave; 
            await partialResponseToUpdate.save({ session: mongoSession });
            console.log(`[SUBMIT ENDPOINT V2] Marked PartialResponse ${partialResponseToUpdate._id} as completed.`);
        }
        collector.responseCount = (collector.responseCount || 0) + 1;
        await collector.save({ session: mongoSession });
        await mongoSession.commitTransaction();
        mongoSession.endSession();
        console.log(`[SUBMIT ENDPOINT V2] Survey ${surveyId} submitted successfully. Response ID: ${responseDoc._id}`);
        if (!res.headersSent) {
             res.status(201).json({ success: true, message: 'Survey submitted successfully.', responseId: responseDoc._id, thankYouMessage: survey.thankYouMessage || { text: "Thank you for your response!" } });
        }
    } catch (error) {
        if (mongoSession.inTransaction()) await mongoSession.abortTransaction();
        mongoSession.endSession();
        console.error(`[SUBMIT ENDPOINT V2] CRITICAL ERROR submitting survey ${surveyId}:`, error.stack);
        if (!res.headersSent) {
            res.status(500).json({ success: false, message: 'An internal server error occurred.' });
        }
    }
};

exports.savePartialResponse = async (req, res) => {
    console.log('[savePartialResponse CONTROLLER ENTRY] Raw req.body:', JSON.stringify(req.body));
    const { surveyId } = req.params;
    // +++ MODIFIED: Added customVariables to destructuring +++
    const { 
        collectorId, 
        respondentEmail, 
        answers: currentAnswers, 
        otherInputValues, 
        currentVisibleIndex, 
        visitedPath, 
        sessionId, 
        resumeToken: existingResumeToken,
        customVariables // Captured from frontend state
    } = req.body;
    console.log(`[savePartialResponse AFTER DESTRUCTURE] Survey: ${surveyId}, Session: ${sessionId}, CustomVars:`, customVariables); 
    
    // ... (validations - same as vX.X+5) ...
    if (!mongoose.Types.ObjectId.isValid(surveyId) || (collectorId && !mongoose.Types.ObjectId.isValid(collectorId))) { return res.status(400).json({ success: false, message: 'Invalid Survey or Collector ID.' }); } if (respondentEmail && !/\S+@\S+\.\S+/.test(respondentEmail)) { return res.status(400).json({ success: false, message: 'If provided, the email address is invalid.' }); } if (!sessionId) { return res.status(400).json({ success: false, message: 'Client Session ID (as sessionId) is required for saving progress.' }); }

    const mongoSession = await mongoose.startSession();
    mongoSession.startTransaction();
    try {
        // Fetch survey with customVariable definitions to validate keys
        const survey = await Survey.findById(surveyId)
            .select('title settings.behaviorNavigation settings.customVariables') // Ensure customVariables definitions are fetched
            .session(mongoSession);

        if (!survey) { /* ... same as vX.X+5 ... */ await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(404).json({ success: false, message: 'Survey not found.' }); }
        
        const behaviorNavSettings = survey.settings?.behaviorNavigation || {};
        if (!behaviorNavSettings.saveAndContinueEnabled) { /* ... same as vX.X+5 ... */ await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(400).json({ success: false, message: 'Save and Continue feature is not enabled for this survey.' }); }
        
        const collector = await Collector.findById(collectorId).select('settings.web_link.customSlug linkId survey').session(mongoSession);
        if (!collector) { /* ... same as vX.X+5 ... */ await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(404).json({ success: false, message: 'Collector not found.' }); }
        if (String(collector.survey) !== String(surveyId)) { /* ... same as vX.X+5 ... */ await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(400).json({ success: false, message: 'Collector does not belong to this survey.' });}

        // ... (Answer saving logic - same as vX.X+5) ...
        const answerOpsForPartial = []; if (typeof currentAnswers === 'object' && currentAnswers !== null) { for (const questionIdStr in currentAnswers) { if (Object.hasOwnProperty.call(currentAnswers, questionIdStr) && mongoose.Types.ObjectId.isValid(questionIdStr)) { const questionObjectId = new mongoose.Types.ObjectId(questionIdStr); const answerValue = currentAnswers[questionIdStr]; const otherText = otherInputValues ? otherInputValues[`${questionIdStr}_other`] : undefined; answerOpsForPartial.push({ updateOne: { filter: { survey: surveyId, questionId: questionObjectId, sessionId: sessionId, collector: collectorId }, update: { $set: { answerValue: answerValue, otherText: otherText, updatedAt: new Date() }, $setOnInsert: { survey: surveyId, questionId: questionObjectId, sessionId: sessionId, collector: collectorId, createdAt: new Date() }}, upsert: true } }); } else { console.warn(`[savePartialResponse] Invalid questionIdStr in currentAnswers: ${questionIdStr}`); } } } if (answerOpsForPartial.length > 0) { await Answer.bulkWrite(answerOpsForPartial, { session: mongoSession }); console.log(`[savePartialResponse] Bulk upserted ${answerOpsForPartial.length} Answer documents for session ${sessionId}.`); } else { if (currentAnswers === undefined ) { console.log(`[savePartialResponse] 'currentAnswers' was undefined after destructuring for session ${sessionId}. This is unexpected if frontend sent 'answers'.`); } else if (typeof currentAnswers === 'object' && currentAnswers !== null && Object.keys(currentAnswers).length === 0) { console.log(`[savePartialResponse] 'currentAnswers' was an empty object {} for session ${sessionId}. No answers to save.`); } else { console.log(`[savePartialResponse] 'currentAnswers' was present but resulted in no valid operations for session ${sessionId}. currentAnswers:`, JSON.stringify(currentAnswers)); } }

        let partialResponseDoc; let newResumeTokenGenerated = false; let finalResumeTokenToUse;
        const expiryDays = behaviorNavSettings.saveAndContinueEmailLinkExpiryDays || 7;
        const expiresAt = new Date(); expiresAt.setDate(expiresAt.getDate() + expiryDays);

        if (existingResumeToken) { /* ... same as vX.X+5 ... */ partialResponseDoc = await PartialResponse.findOne({ resumeToken: existingResumeToken, survey: surveyId }).session(mongoSession); if (partialResponseDoc) { if (partialResponseDoc.completedAt) { await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(409).json({ success: false, message: 'Session already completed.' });} finalResumeTokenToUse = existingResumeToken; } else { newResumeTokenGenerated = true; console.log(`[savePartialResponse] Existing resume token ${existingResumeToken} not found, will generate new.`);} } else { newResumeTokenGenerated = true; }
        if (newResumeTokenGenerated) finalResumeTokenToUse = crypto.randomBytes(20).toString('hex');
        
        // +++ MODIFIED: Prepare customVariables for saving +++
        const customVariablesToSave = new Map();
        if (customVariables && typeof customVariables === 'object') {
            const definedKeys = new Set((survey.settings?.customVariables || []).map(cv => cv.key));
            for (const key in customVariables) {
                if (definedKeys.has(key)) { // Only save variables that are defined in survey settings
                    customVariablesToSave.set(key, customVariables[key]);
                } else {
                     console.warn(`[savePartialResponse] Ignoring custom variable '${key}' as it's not defined in survey settings.`);
                }
            }
        }

        if (partialResponseDoc && !newResumeTokenGenerated) { 
            partialResponseDoc.respondentEmail = respondentEmail || partialResponseDoc.respondentEmail;
            partialResponseDoc.currentVisibleIndex = currentVisibleIndex ?? partialResponseDoc.currentVisibleIndex;
            partialResponseDoc.visitedPath = visitedPath || partialResponseDoc.visitedPath;
            partialResponseDoc.expiresAt = expiresAt;
            partialResponseDoc.sessionId = sessionId; 
            partialResponseDoc.updatedAt = new Date();
            partialResponseDoc.customVariables = customVariablesToSave; // Update custom variables
        } else { 
            partialResponseDoc = new PartialResponse({
                survey: surveyId, collector: collectorId, sessionId: sessionId,
                resumeToken: finalResumeTokenToUse, respondentEmail: respondentEmail || undefined,
                currentVisibleIndex: currentVisibleIndex ?? 0,
                visitedPath: visitedPath || [], expiresAt,
                customVariables: customVariablesToSave, // Add custom variables
            });
        }
        await partialResponseDoc.save({ session: mongoSession });
        
        // ... (Email sending logic - same as vX.X+5) ...
        let emailSentSuccessfully = null; const saveMethod = behaviorNavSettings.saveAndContinueMethod || 'email'; const shouldSendEmail = respondentEmail && (saveMethod === 'email' || saveMethod === 'both'); const isNewEmailForThisSave = partialResponseDoc && respondentEmail && partialResponseDoc.respondentEmail !== respondentEmail; const sendCondition = shouldSendEmail && (newResumeTokenGenerated || isNewEmailForThisSave); if (sendCondition) { try { const accessIdentifierForLink = collector.settings?.web_link?.customSlug || collector.linkId; const resumeLink = `${process.env.FRONTEND_URL}/s/${accessIdentifierForLink}?resumeToken=${finalResumeTokenToUse}`; console.log(`[savePartialResponse] Sending resume email to ${respondentEmail} with link: ${resumeLink}`); await emailService.sendResumeEmail(respondentEmail, survey.title, resumeLink, expiryDays); emailSentSuccessfully = true; } catch (emailError) { emailSentSuccessfully = false; console.error(`[savePartialResponse] Email send error for token ${finalResumeTokenToUse}: ${emailError.message}`); } } else if (shouldSendEmail) { console.log(`[savePartialResponse] Email not re-sent for token ${finalResumeTokenToUse}. Conditions: new token=${newResumeTokenGenerated}, email changed/newly provided for this save=${isNewEmailForThisSave}`); }

        await mongoSession.commitTransaction(); mongoSession.endSession();
        let message = 'Progress saved!'; 
        const provideCode = saveMethod === 'code' || saveMethod === 'both';
        if (shouldSendEmail && emailSentSuccessfully === true) { message = `Progress saved! A link to resume has been sent to ${respondentEmail}.`; if (provideCode) message += ` Your resume code is also provided.`;}
        else if (shouldSendEmail && emailSentSuccessfully === false) { message = `Progress saved! Email could not be sent.`; if (provideCode) message += ` Please use the resume code.`; else message += ` Contact support or use code: ${finalResumeTokenToUse}.`;}
        else if (provideCode) { message = `Progress saved! Use the resume code to continue.`; }
        
        if (!res.headersSent) {
            res.status(200).json({ success: true, message: message, resumeToken: finalResumeTokenToUse, surveyId: surveyId, saveMethodUsed: saveMethod, emailSent: emailSentSuccessfully, expiresInDays: expiryDays });
        }
    } catch (error) { 
        if (mongoSession.inTransaction()) await mongoSession.abortTransaction(); 
        mongoSession.endSession(); 
        console.error(`[savePartialResponse] Error for survey ${surveyId}, session ${sessionId}:`, error.stack); 
        if (!res.headersSent) {
            res.status(500).json({ success: false, message: 'Error saving progress.' }); 
        }
    }
};

exports.getSurveyResults = async (req, res) => { /* ... same as vX.X+5 ... */ const { surveyId } = req.params; console.log(`[getSurveyResults] User: ${req.user?.id}. Attempting for survey: ${surveyId}`); if (!mongoose.Types.ObjectId.isValid(surveyId)) { return res.status(400).json({ success: false, message: 'Invalid Survey ID.' }); } if (!req.user || !req.user.id) { console.error('[getSurveyResults] User ID not found in request. Auth middleware issue?'); return res.status(401).json({ success: false, message: 'User authentication failed.' }); } try { const survey = await Survey.findById(surveyId) .select('title questions createdBy') .populate({ path: 'questions', model: 'Question', select: 'text type options subQuestions originalIndex _id' }); if (!survey) { if (!res.headersSent) return res.status(404).json({ success: false, message: 'Survey not found.' }); return; } const responseHeaders = await Response.find({ survey: surveyId, status: 'completed' }) .populate({ path: 'collector', select: 'name type' }) .sort({ submittedAt: -1 }) .lean(); if (responseHeaders.length === 0) { if (!res.headersSent) return res.status(200).json({ success: true, surveyTitle: survey.title, questions: survey.questions, summary: { totalResponses: 0 }, data: [] }); return; } const sessionIds = responseHeaders.map(rh => rh.sessionId); const allAnswersForSurvey = await Answer.find({ survey: surveyId, sessionId: { $in: sessionIds } }).lean(); const answersBySession = allAnswersForSurvey.reduce((acc, ans) => { if (!acc[ans.sessionId]) acc[ans.sessionId] = {}; acc[ans.sessionId][ans.questionId.toString()] = { answerValue: ans.answerValue, otherText: ans.otherText }; return acc; }, {}); const reconstructedResponses = responseHeaders.map(header => { const sessionAnswers = answersBySession[header.sessionId] || {}; const formattedAnswers = {}; const formattedOtherValues = {}; for (const qId in sessionAnswers) { formattedAnswers[qId] = sessionAnswers[qId].answerValue; if (sessionAnswers[qId].otherText) { formattedOtherValues[`${qId}_other`] = sessionAnswers[qId].otherText; } } return { ...header, answers: formattedAnswers, otherInputValues: formattedOtherValues }; }); const summary = { totalResponses: reconstructedResponses.length }; if (!res.headersSent) { res.status(200).json({ success: true, surveyTitle: survey.title, questions: survey.questions, summary, data: reconstructedResponses }); } } catch (error) { console.error(`[getSurveyResults] Error fetching results for survey ${surveyId}:`, error.stack); if (!res.headersSent) { res.status(500).json({ success: false, message: 'Error fetching survey results.' }); } } };
exports.exportSurveyResults = async (req, res) => { /* ... same as vX.X+5 ... */ const { surveyId } = req.params; const { format = 'json' } = req.query; console.log(`[exportSurveyResults] User: ${req.user?.id}. Attempting for survey: ${surveyId}, format: ${format}`); if (!mongoose.Types.ObjectId.isValid(surveyId)) { return res.status(400).json({ success: false, message: 'Invalid Survey ID.' }); } if (!req.user || !req.user.id) { return res.status(401).json({ success: false, message: 'User authentication failed.' });} try { const survey = await Survey.findById(surveyId) .select('title questions') .populate({ path: 'questions', model: 'Question', select: 'text type originalIndex _id' }); if (!survey) { if (!res.headersSent) return res.status(404).json({ success: false, message: 'Survey not found.' }); return; } const responseHeaders = await Response.find({ survey: surveyId, status: 'completed' }) .populate({path: 'collector', select: 'name'}) .sort({ submittedAt: -1 }) .lean(); if (responseHeaders.length === 0 && format.toLowerCase() === 'csv') { res.setHeader('Content-Type', 'text/csv'); res.setHeader('Content-Disposition', `attachment; filename="survey_${surveyId}_results_empty.csv"`); return res.status(200).send("No responses to export."); } else if (responseHeaders.length === 0) { if (!res.headersSent) return res.status(200).json({ success: true, surveyTitle: survey.title, totalResponses: 0, data: [] }); return; } const sessionIds = responseHeaders.map(rh => rh.sessionId); const allAnswersForSurvey = await Answer.find({ survey: surveyId, sessionId: { $in: sessionIds } }).lean(); const answersBySession = allAnswersForSurvey.reduce((acc, ans) => { if (!acc[ans.sessionId]) acc[ans.sessionId] = {}; acc[ans.sessionId][ans.questionId.toString()] = { answerValue: ans.answerValue, otherText: ans.otherText }; return acc; }, {}); const reconstructedResponses = responseHeaders.map(header => { const sessionAnswers = answersBySession[header.sessionId] || {}; const formattedAnswers = {}; const formattedOtherValues = {}; for (const qId in sessionAnswers) { formattedAnswers[qId] = sessionAnswers[qId].answerValue; if (sessionAnswers[qId].otherText) formattedOtherValues[`${qId}_other`] = sessionAnswers[qId].otherText; } return { ...header, answers: formattedAnswers, otherInputValues: formattedOtherValues }; }); if (format.toLowerCase() === 'csv') { const questionsMap = new Map(survey.questions.map(q => [q._id.toString(), q])); const csvFields = [ { label: 'Response ID (Internal)', value: '_id' }, { label: 'Session ID', value: 'sessionId'}, { label: 'Collector Name', value: (row) => row.collector?.name || 'N/A' }, { label: 'Status', value: 'status'}, { label: 'Started At', value: (row) => row.startedAt ? new Date(row.startedAt).toISOString() : ''}, { label: 'Submitted At', value: (row) => row.submittedAt ? new Date(row.submittedAt).toISOString() : '' }, ]; survey.questions.sort((a,b) => a.originalIndex - b.originalIndex).forEach(q => { csvFields.push({ label: q.text || `Question ${q.originalIndex + 1}`, value: (row) => { const answerObj = row.answers?.[q._id.toString()]; const otherText = row.otherInputValues?.[`${q._id.toString()}_other`]; return formatValueForCsv(answerObj, q.type, otherText); } }); }); const json2csvParser = new Parser({ fields: csvFields, delimiter: ',', excelStrings: true }); const csv = json2csvParser.parse(reconstructedResponses); res.setHeader('Content-Type', 'text/csv'); res.setHeader('Content-Disposition', `attachment; filename="survey_${surveyId}_results.csv"`); res.status(200).send(csv); } else { if (!res.headersSent) { res.status(200).json({ success: true, surveyTitle: survey.title, totalResponses: reconstructedResponses.length, data: reconstructedResponses }); } } } catch (error) { console.error(`[exportSurveyResults] Error exporting results for survey ${surveyId}:`, error.stack); if (!res.headersSent) { res.status(500).json({ success: false, message: 'Error exporting survey results.' }); } } };

module.exports = exports;
// ----- END OF COMPLETE MODIFIED FILE (vX.X+6 - Store Custom Variables) -----