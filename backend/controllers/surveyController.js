// backend/controllers/surveyController.js
// ----- START OF COMPLETE COMBINED AND UPDATED FILE -----
const mongoose = require('mongoose');
const { Parser } = require('json2csv');
const crypto = require('crypto');
const Survey = require('../models/Survey');
const Question = require('../models/Question');
const Answer = require('../models/Answer'); // Used by the new submitSurveyAnswers
const Collector = require('../models/Collector');
const Response = require('../models/Response');
const PartialResponse = require('../models/PartialResponse');
const { evaluateAllLogic } = require('../utils/logicEvaluator'); // Assuming this utility exists
const axios = require('axios'); // For reCAPTCHA
const ipRangeCheck = require('ip-range-check'); // Assuming this utility exists
const emailService = require('../services/emailService'); // Assuming this service exists

// --- HELPER FUNCTIONS ---
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
    if (!question) return "Invalid question data for validation.";

    if (question.requiredSetting === 'required') {
        let isEmpty = false;
        if (answerValue === undefined || answerValue === null || String(answerValue).trim() === '') {
            if (!Array.isArray(answerValue) || answerValue.length === 0) {
                 isEmpty = true;
            }
        } else if (Array.isArray(answerValue) && answerValue.length === 0) {
            isEmpty = true;
        }

        if (isEmpty) {
            if (question.addOtherOption && ( (Array.isArray(answerValue) && answerValue.includes('__OTHER__')) || answerValue === '__OTHER__') && (otherTextValue === undefined || otherTextValue === null || String(otherTextValue).trim() === '')) {
                return `Answer for "${question.text || `Question (ID: ${question._id})`}" is required (other option was selected but no text provided).`;
            } else if (!question.addOtherOption || ( (typeof answerValue === 'string' && answerValue !== '__OTHER__') || (Array.isArray(answerValue) && !answerValue.includes('__OTHER__')) ) ) {
                 if(!( (Array.isArray(answerValue) && answerValue.includes('__OTHER__')) || answerValue === '__OTHER__') ) {
                    return `Answer for "${question.text || `Question (ID: ${question._id})`}" is required.`;
                 }
            }
        }
    }

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


const generateConjointProfiles = (attributes) => { // From your vNext28
    if (!attributes || attributes.length === 0) return [];
    // TODO: Implement actual conjoint profile generation logic if needed
    return [];
};

const CSV_SEPARATOR = '; '; // From your vNext28
const ensureArrayForCsv = (val) => (Array.isArray(val) ? val : (val !== undefined && val !== null ? [String(val)] : [])); // From your vNext28

const formatValueForCsv = (value, questionType, otherTextValue) => { // From your vNext28
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
        case 'file_upload': // Assuming file upload answers might be an object or array of objects with url/name
            if (Array.isArray(value)) return value.map(file => file.url || file.name || String(file)).join(CSV_SEPARATOR);
            if (typeof value === 'object' && value !== null) return value.url || value.name || JSON.stringify(value);
            return '';
        case 'cardsort': // Assuming cardsort answers might be a complex object
            if (typeof value === 'object' && value !== null && value.assignments) return JSON.stringify(value); // Or a more specific format
            return JSON.stringify(value); // Fallback for other object types
        default:
            if (Array.isArray(value)) return value.join(CSV_SEPARATOR);
            if (typeof value === 'object' && value !== null) return JSON.stringify(value);
            return String(value);
    }
};

// --- CONTROLLER FUNCTIONS ---

exports.getAllSurveys = async (req, res) => { // From your vNext28
    console.log(`[getAllSurveys] User: ${req.user?.id}, Role: ${req.user?.role}. Fetching surveys.`);
    try {
        const filter = {};
        if (req.user && req.user.id) {
            filter.createdBy = req.user.id;
            if (req.user.role === 'admin') { // Admins see all surveys
                delete filter.createdBy;
                 console.log(`[getAllSurveys] Admin access, fetching all surveys.`);
            }
        } else {
            console.warn('[getAllSurveys] Authentication details missing or invalid, though `protect` middleware should handle this.');
            return res.status(401).json({ success: false, message: "Authentication details missing or invalid." });
        }
        const surveys = await Survey.find(filter)
            .select('-questions -globalSkipLogic -settings -randomizationLogic -collectors') // Exclude bulky fields from list view
            .sort({ createdAt: -1 });
        
        // The `if (!surveys)` check is generally not needed as `find()` returns an empty array if no documents match, not null/undefined.
        // An error during the query would be caught by the catch block.
        console.log(`[getAllSurveys] Found ${surveys.length} surveys.`);
        if (!res.headersSent) {
            res.status(200).json({ success: true, count: surveys.length, data: surveys });
        }
    } catch (error) {
        console.error(`[getAllSurveys] CRITICAL ERROR. User: ${req.user?.id}. Error: ${error.message}`, error.stack);
        if (!res.headersSent) { // Ensure headers aren't already sent by a previous error response
            res.status(500).json({ success: false, message: "Critical error fetching surveys on the server." });
        }
    }
};

exports.createSurvey = async (req, res) => { // From your vNext28
    console.log(`[createSurvey] User: ${req.user?.id}. Attempting to create survey.`);
    const { title, description, category, settings, welcomeMessage, thankYouMessage } = req.body;
    try {
        if (!req.user || !req.user.id) { // Should be guaranteed by `protect` middleware
            console.error('[createSurvey] User ID not found in request. Auth middleware issue?');
            return res.status(401).json({ success: false, message: 'User authentication failed.' });
        }

        const defaultBehaviorNav = {
            autoAdvance: false,
            questionNumberingEnabled: true,
            questionNumberingFormat: '123',
            questionNumberingCustomPrefix: '',
            saveAndContinueEnabled: false,
            saveAndContinueEmailLinkExpiryDays: 7,
            saveAndContinueMethod: 'email',
        };
        const defaultCustomVariables = [];

        // Deep merge settings, ensuring defaults are applied correctly
        const mergedSettings = {
            surveyWide: { ...(settings?.surveyWide || {}) },
            completion: { ...(settings?.completion || {}) },
            accessSecurity: { ...(settings?.accessSecurity || {}) },
            behaviorNavigation: {
                ...defaultBehaviorNav,
                ...(settings?.behaviorNavigation || {})
            },
            customVariables: Array.isArray(settings?.customVariables) ? settings.customVariables : defaultCustomVariables
        };


        const newSurvey = new Survey({
            title: title || 'Untitled Survey',
            description,
            category, // Assuming category is a simple string or managed elsewhere
            createdBy: req.user.id,
            status: 'draft',
            settings: mergedSettings,
            welcomeMessage: welcomeMessage || { text: "Welcome to the survey!" }, // Ensure these have a default structure if partially provided
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

exports.getSurveyById = async (req, res) => { // From your vNext28, WITH PATH COLLISION FIX
    const { surveyId } = req.params;
    const { forTaking, collectorId, isPreviewingOwner, resumeToken } = req.query;
    console.log(`[getSurveyById] Request for survey: ${surveyId}, forTaking: ${forTaking}, collectorId: ${collectorId}, resumeToken: ${resumeToken}, isPreviewingOwner: ${isPreviewingOwner}`);

    if (!mongoose.Types.ObjectId.isValid(surveyId)) {
        return res.status(400).json({ success: false, message: 'Invalid Survey ID.' });
    }

    try {
        let surveyQuery = Survey.findById(surveyId);
        let actualCollectorDoc = null;
        let partialResponseData = null;

        if (forTaking !== 'true') {
            if (!req.user || !req.user.id) {
                 console.error('[getSurveyById - Admin Access] User ID not found. Auth middleware issue?');
                 return res.status(401).json({ success: false, message: 'User authentication failed for admin access.' });
            }
        }

        if (forTaking === 'true') {
            surveyQuery = surveyQuery
                .select('title description welcomeMessage thankYouMessage status questions settings.completion settings.behaviorNavigation settings.customVariables globalSkipLogic randomizationLogic')
                .populate({ path: 'questions', model: 'Question', options: { sort: { originalIndex: 1 } } });

            if (collectorId) {
                // ***** MODIFICATION 1 HERE *****
                const selectFields = 'status type linkId survey responseCount ' +
                                     'settings.web_link ' +                     // Select the whole web_link sub-document
                                     '+settings.web_link.password';             // Explicitly include the password
                // Any other fields from settings.web_link that are not select:false will come automatically.
                // If you need other top-level fields from 'settings' object (outside web_link), add them like 'settings.someOtherCategory'

                if (mongoose.Types.ObjectId.isValid(collectorId)) {
                    actualCollectorDoc = await Collector.findOne({ _id: collectorId, survey: surveyId }).select(selectFields);
                }
                if (!actualCollectorDoc) {
                    actualCollectorDoc = await Collector.findOne({ linkId: collectorId, survey: surveyId }).select(selectFields);
                }
                if (!actualCollectorDoc) {
                    actualCollectorDoc = await Collector.findOne({ 'settings.web_link.customSlug': collectorId, survey: surveyId }).select(selectFields);
                }
            }
        } else {
            surveyQuery = surveyQuery.populate({ path: 'questions', model: 'Question', options: { sort: { originalIndex: 1 } } }).populate('collectors');
        }

        const survey = await surveyQuery.lean();
        if (!survey) {
            console.log(`[getSurveyById] Survey not found: ${surveyId}`);
            return res.status(404).json({ success: false, message: 'Survey not found.' });
        }

        if (forTaking !== 'true' && req.user && String(survey.createdBy) !== String(req.user.id) && req.user.role !== 'admin') {
            console.log(`[getSurveyById] Unauthorized attempt by user ${req.user.id} to access survey ${surveyId} owned by ${survey.createdBy}`);
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
                const partialDoc = await PartialResponse.findOne({ resumeToken: resumeToken, survey: survey._id });
                if (!partialDoc) {
                    return res.status(404).json({ success: false, message: 'Invalid or expired resume link.' });
                }
                if (partialDoc.expiresAt < new Date()) {
                    return res.status(410).json({ success: false, message: 'This resume link has expired.' });
                }
                if (partialDoc.completedAt) {
                     return res.status(410).json({ success: false, message: 'This survey session has already been completed.' });
                }
                
                partialResponseData = partialDoc.toObject();
                
                if (!actualCollectorDoc && partialDoc.collector) {
                     // ***** MODIFICATION 2 HERE *****
                     const selectFieldsForResume = 'status type linkId survey responseCount ' +
                                                   'settings.web_link ' +
                                                   '+settings.web_link.password';
                     actualCollectorDoc = await Collector.findById(partialDoc.collector).select(selectFieldsForResume);
                     if (!actualCollectorDoc) {
                        console.error(`[getSurveyById] Collector ${partialDoc.collector} from partial response not found for survey ${surveyId}`);
                     }
                }
                // ** TODO from previous version still applies: When resuming, fetch individual Answer documents...
                // const savedAnswersRaw = await Answer.find({ survey: survey._id, sessionId: partialDoc.sessionId });
                // ... reconstruct answers and add to partialResponseData ...
            }

            if (actualCollectorDoc) {
                if (String(actualCollectorDoc.survey) !== String(survey._id)) {
                    return res.status(400).json({ success: false, message: 'Collector does not belong to this survey.' });
                }
                if (actualCollectorDoc.status !== 'open' && !effectiveIsOwnerPreviewing && !resumeToken) {
                    return res.status(403).json({ success: false, message: `This survey link is ${actualCollectorDoc.status}.` });
                }

                if (actualCollectorDoc.settings?.web_link && !effectiveIsOwnerPreviewing && !resumeToken) {
                    const respondentIp = getIpAddress(req);
                    const { ipAllowlist, ipBlocklist } = actualCollectorDoc.settings.web_link;
                    if (respondentIp) {
                        if (ipAllowlist?.length > 0 && !ipAllowlist.some(allowedIpOrRange => ipRangeCheck(respondentIp, allowedIpOrRange))) {
                            return res.status(403).json({ success: false, message: 'Access to this survey is restricted from your current IP address (not in allowlist).' });
                        }
                        if (ipBlocklist?.length > 0 && ipBlocklist.some(blockedIpOrRange => ipRangeCheck(respondentIp, blockedIpOrRange))) {
                            return res.status(403).json({ success: false, message: 'Access to this survey is restricted from your current IP address (in blocklist).' });
                        }
                    }
                }
                if (actualCollectorDoc.type === 'web_link' && actualCollectorDoc.settings?.web_link?.password && !resumeToken && !effectiveIsOwnerPreviewing) {
                    const providedPassword = req.headers['x-survey-password'];
                    if (!providedPassword) return res.status(401).json({ success: false, message: 'Password required for this survey.', requiresPassword: true });
                    
                    const passwordMatch = await actualCollectorDoc.comparePassword(providedPassword);
                    if (!passwordMatch) return res.status(401).json({ success: false, message: 'Incorrect password.', requiresPassword: true });
                }
            } else if (!effectiveIsOwnerPreviewing && survey.status === 'draft' && !collectorId && !resumeToken) {
                return res.status(403).json({ success: false, message: 'Survey is in draft mode and requires a specific collector link or preview access.' });
            }
        }

        let processedQuestions = survey.questions || [];
        if (Array.isArray(processedQuestions) && processedQuestions.length > 0 && typeof processedQuestions[0] === 'object' && processedQuestions[0] !== null) {
            processedQuestions = processedQuestions.map(q => {
                if (q && q.type === 'conjoint' && q.conjointAttributes) {
                    return { ...q, generatedProfiles: generateConjointProfiles(q.conjointAttributes) };
                }
                return q;
            });
        }

        const surveyResponseData = { ...survey, questions: processedQuestions };

        if (forTaking === 'true') {
            const defaultBehaviorNav = survey.settings?.behaviorNavigation || {
                autoAdvance: false, questionNumberingEnabled: true, questionNumberingFormat: '123',
                saveAndContinueEnabled: false, saveAndContinueEmailLinkExpiryDays: 7, saveAndContinueMethod: 'email',
            };
            const defaultCustomVariables = survey.settings?.customVariables || [];

            surveyResponseData.settings = {
                ...(surveyResponseData.settings || {}),
                behaviorNavigation: { ...defaultBehaviorNav, ...(surveyResponseData.settings?.behaviorNavigation || {}) },
                customVariables: Array.isArray(surveyResponseData.settings?.customVariables) ? surveyResponseData.settings.customVariables : defaultCustomVariables
            };

            if (actualCollectorDoc?.settings?.web_link) {
                const webLinkSettingsObject = actualCollectorDoc.settings.web_link.toObject ? actualCollectorDoc.settings.web_link.toObject() : { ...actualCollectorDoc.settings.web_link };
                surveyResponseData.collectorSettings = webLinkSettingsObject;
                surveyResponseData.actualCollectorObjectId = actualCollectorDoc._id;
                if (surveyResponseData.collectorSettings.enableRecaptcha && !surveyResponseData.collectorSettings.recaptchaSiteKey && process.env.RECAPTCHA_SITE_KEY_V2) {
                    surveyResponseData.collectorSettings.recaptchaSiteKey = process.env.RECAPTCHA_SITE_KEY_V2;
                }
                if (typeof surveyResponseData.collectorSettings.allowBackButton === 'undefined') surveyResponseData.collectorSettings.allowBackButton = true;
                if (typeof surveyResponseData.collectorSettings.progressBarEnabled === 'undefined') surveyResponseData.collectorSettings.progressBarEnabled = false;
                if (typeof surveyResponseData.collectorSettings.progressBarStyle === 'undefined') surveyResponseData.collectorSettings.progressBarStyle = 'percentage';
                if (typeof surveyResponseData.collectorSettings.progressBarPosition === 'undefined') surveyResponseData.collectorSettings.progressBarPosition = 'top';

            } else {
                surveyResponseData.collectorSettings = {
                    allowMultipleResponses: true, anonymousResponses: false, enableRecaptcha: false,
                    recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY_V2 || '',
                    ipAllowlist: [], ipBlocklist: [], allowBackButton: true,
                    progressBarEnabled: false, progressBarStyle: 'percentage', progressBarPosition: 'top'
                };
                surveyResponseData.actualCollectorObjectId = null;
            }

            if (partialResponseData) {
                surveyResponseData.partialResponse = partialResponseData;
            }
        }
        
        console.log(`[getSurveyById] Successfully fetched and processed survey: ${surveyId}`);
        res.status(200).json({ success: true, data: surveyResponseData });

    } catch (error) {
        console.error(`[getSurveyById] CRITICAL ERROR fetching survey ${surveyId}. Error:`, error.stack); // Log the full error stack
        res.status(500).json({ success: false, message: 'Error fetching survey data on the server.' });
    }
};

exports.updateSurvey = async (req, res) => { // From your vNext28
    const { surveyId } = req.params;
    const updates = req.body;
    console.log(`[updateSurvey] User: ${req.user?.id}. Attempting to update survey: ${surveyId}`);

    if (!mongoose.Types.ObjectId.isValid(surveyId)) {
        return res.status(400).json({ success: false, message: 'Invalid Survey ID.' });
    }
    if (!req.user || !req.user.id) { // Should be guaranteed by `protect` and `authorizeSurveyAccess`
        console.error('[updateSurvey] User ID not found. Auth middleware issue?');
        return res.status(401).json({ success: false, message: 'User authentication failed.' });
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const survey = await Survey.findById(surveyId).session(session);
        if (!survey) {
            await session.abortTransaction(); session.endSession();
            console.log(`[updateSurvey] Survey not found: ${surveyId}`);
            return res.status(404).json({ success: false, message: 'Survey not found.' });
        }
        // Authorization check (also handled by authorizeSurveyAccess middleware if applied on route)
        if (String(survey.createdBy) !== String(req.user.id) && req.user.role !== 'admin') {
            await session.abortTransaction(); session.endSession();
            console.log(`[updateSurvey] Unauthorized attempt by user ${req.user.id} for survey ${surveyId}`);
            return res.status(403).json({ success: false, message: 'Not authorized to update this survey.' });
        }

        // --- Handle Question Updates (Complex: usually separate endpoints or careful array management) ---
        if (updates.hasOwnProperty('questions') && Array.isArray(updates.questions)) {
            // This is a simplified placeholder. Real question updates are complex.
            // You'd typically have dedicated endpoints for adding/removing/updating individual questions
            // or use Mongoose's array update operators carefully.
            // For now, assuming `updates.questions` is an array of Question ObjectIDs.
            // survey.questions = updates.questions; // Direct assignment can be risky without validation
            console.warn("[updateSurvey] Direct update of 'questions' array is complex and not fully implemented here. Consider dedicated question management endpoints.");
        } else if (updates.hasOwnProperty('questions') && updates.questions === null) {
            // survey.questions = []; // Example: Clear all questions
        }

        // --- Handle Settings Updates (Deep Merge) ---
        if (updates.settings) {
            survey.settings = survey.settings || {}; // Ensure settings object exists
            const defaultBehaviorNav = { // Re-establish defaults for merging
                autoAdvance: false, questionNumberingEnabled: true, questionNumberingFormat: '123',
                questionNumberingCustomPrefix: '', saveAndContinueEnabled: false,
                saveAndContinueEmailLinkExpiryDays: 7, saveAndContinueMethod: 'email'
            };
            const defaultCustomVariables = [];

            // Iterate through categories in updates.settings (e.g., behaviorNavigation, completion)
            for (const categoryKey in updates.settings) {
                if (Object.prototype.hasOwnProperty.call(updates.settings, categoryKey)) {
                    if (categoryKey === 'customVariables') {
                        survey.settings.customVariables = Array.isArray(updates.settings.customVariables)
                            ? updates.settings.customVariables.filter(cv => cv.key && cv.key.trim() !== '') // Basic validation
                            : defaultCustomVariables;
                    } else if (typeof updates.settings[categoryKey] === 'object' && updates.settings[categoryKey] !== null && !Array.isArray(updates.settings[categoryKey])) {
                        // Merge object-based settings (like behaviorNavigation)
                        survey.settings[categoryKey] = {
                            ...(survey.settings[categoryKey] || (categoryKey === 'behaviorNavigation' ? defaultBehaviorNav : {})), // Apply defaults if category didn't exist
                            ...updates.settings[categoryKey] // Apply updates
                        };
                        // Specific validation for saveAndContinueMethod if behaviorNavigation is updated
                        if (categoryKey === 'behaviorNavigation' && survey.settings.behaviorNavigation) {
                            const validMethods = ['email', 'code', 'both'];
                            if (updates.settings.behaviorNavigation.hasOwnProperty('saveAndContinueMethod') &&
                                !validMethods.includes(survey.settings.behaviorNavigation.saveAndContinueMethod)) {
                                console.warn(`[updateSurvey] Invalid saveAndContinueMethod '${survey.settings.behaviorNavigation.saveAndContinueMethod}', reverting to default 'email'.`);
                                survey.settings.behaviorNavigation.saveAndContinueMethod = defaultBehaviorNav.saveAndContinueMethod;
                            }
                        }
                    } else { // For direct value settings
                        survey.settings[categoryKey] = updates.settings[categoryKey];
                    }
                }
            }
            // Ensure default structures exist if not provided in update
            if (!survey.settings.behaviorNavigation) survey.settings.behaviorNavigation = defaultBehaviorNav;
            else survey.settings.behaviorNavigation = { ...defaultBehaviorNav, ...survey.settings.behaviorNavigation };

            if (!survey.settings.customVariables) survey.settings.customVariables = defaultCustomVariables;
        }

        // --- Update Allowed Top-Level Fields ---
        const allowedTopLevelFields = ['title', 'description', 'status', 'category', 'randomizationLogic', 'welcomeMessage', 'thankYouMessage', 'globalSkipLogic'];
        for (const key of allowedTopLevelFields) {
            if (updates.hasOwnProperty(key)) {
                survey[key] = updates[key];
            }
        }
        survey.updatedAt = Date.now(); // Explicitly set, though timestamps:true also handles it

        const updatedSurvey = await survey.save({ session });
        await session.commitTransaction();
        session.endSession();

        // Repopulate for the response to ensure client gets full, updated data
        const populatedSurvey = await Survey.findById(updatedSurvey._id)
            .populate({ path: 'questions', model: 'Question', options: { sort: { originalIndex: 1 } } })
            .populate('collectors');
        
        console.log(`[updateSurvey] Survey ${surveyId} updated successfully.`);
        res.status(200).json({ success: true, message: 'Survey updated successfully.', data: populatedSurvey });

    } catch (error) {
        if (session.inTransaction()) await session.abortTransaction();
        session.endSession();
        console.error(`[updateSurvey] Error updating survey ${surveyId}. User: ${req.user?.id}. Error:`, error.stack);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ success: false, message: 'Validation Error', details: error.errors });
        }
        res.status(500).json({ success: false, message: 'Error updating survey on the server.' });
    }
};

exports.deleteSurvey = async (req, res) => { // From your vNext28, with added related data deletion
    const { surveyId } = req.params;
    console.log(`[deleteSurvey] User: ${req.user?.id}. Attempting to delete survey: ${surveyId}`);

    if (!mongoose.Types.ObjectId.isValid(surveyId)) {
        return res.status(400).json({ success: false, message: 'Invalid Survey ID.' });
    }
    if (!req.user || !req.user.id) { // Should be guaranteed by `protect` and `authorizeSurveyAccess`
        console.error('[deleteSurvey] User ID not found. Auth middleware issue?');
        return res.status(401).json({ success: false, message: 'User authentication failed.' });
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const survey = await Survey.findById(surveyId).select('createdBy').session(session); // Only need createdBy for auth
        if (!survey) {
            await session.abortTransaction(); session.endSession();
            console.log(`[deleteSurvey] Survey not found: ${surveyId}`);
            return res.status(404).json({ success: false, message: 'Survey not found.' });
        }
        // Authorization (also handled by authorizeSurveyAccess middleware if applied on route)
        if (String(survey.createdBy) !== String(req.user.id) && req.user.role !== 'admin') {
            await session.abortTransaction(); session.endSession();
            console.log(`[deleteSurvey] Unauthorized attempt by user ${req.user.id} for survey ${surveyId}`);
            return res.status(403).json({ success: false, message: 'Not authorized to delete this survey.' });
        }

        // Delete related data
        console.log(`[deleteSurvey] Deleting related data for survey ${surveyId}...`);
        await Question.deleteMany({ survey: surveyId }, { session });
        await Collector.deleteMany({ survey: surveyId }, { session });
        await Response.deleteMany({ survey: surveyId }, { session }); // Response headers
        await Answer.deleteMany({ survey: surveyId }, { session });   // Individual answers
        await PartialResponse.deleteMany({ survey: surveyId }, { session });
        
        await Survey.findByIdAndDelete(surveyId, { session });

        await session.commitTransaction();
        session.endSession();
        console.log(`[deleteSurvey] Survey ${surveyId} and all associated data deleted successfully.`);
        res.status(200).json({ success: true, message: 'Survey and all associated data deleted successfully.' });
    } catch (error) {
        if (session.inTransaction()) await session.abortTransaction();
        session.endSession();
        console.error(`[deleteSurvey] Error deleting survey ${surveyId}. User: ${req.user?.id}. Error:`, error.stack);
        res.status(500).json({ success: false, message: 'Error deleting survey.' });
    }
};


// --- SUBMIT SURVEY ANSWERS (REVISED FOR SEPARATE Answer DOCUMENTS) ---
exports.submitSurveyAnswers = async (req, res) => {
    // ... (The full submitSurveyAnswers function I provided in the previous response,
    //      which uses Answer.bulkWrite() and doesn't store answers on Response doc) ...
    // For brevity, I'm not pasting the entire thing again here, but it's the one from:
    // "Okay, I will now provide the complete surveyController.js file." -> my previous response.
    // Ensure that version is here.
    // Key elements:
    // - Uses Answer.bulkWrite()
    // - Validates answers with validateAnswerDetailed
    // - Handles reCAPTCHA v2
    // - Handles "Allow Multiple Responses"
    // - Creates/Updates a Response header document
    // - Updates PartialResponse if resumed
    const { surveyId } = req.params;
    const { collectorId, answers, otherInputValues, resumeToken, recaptchaTokenV2, clientSessionId, customVariablesFromClient } = req.body;

    console.log(`[SUBMIT ENDPOINT V2] Survey: ${surveyId}, Collector: ${collectorId}, ClientSessionId: ${clientSessionId}, ResumeToken: ${resumeToken}`);

    if (!mongoose.Types.ObjectId.isValid(surveyId)) { return res.status(400).json({ success: false, message: 'Invalid Survey ID.' }); }
    if (!collectorId || !mongoose.Types.ObjectId.isValid(collectorId)) { return res.status(400).json({ success: false, message: 'Collector ID is required and must be valid.' }); }
    if (!clientSessionId) { return res.status(400).json({ success: false, message: 'Client Session ID is required.' }); }
    if (typeof answers !== 'object' || answers === null) { return res.status(400).json({ success: false, message: 'Answers must be an object.' });}

    const mongoSession = await mongoose.startSession();
    mongoSession.startTransaction();
    try {
        const survey = await Survey.findById(surveyId).select('status questions settings.completion thankYouMessage').populate({ path: 'questions', model: 'Question' }).session(mongoSession);
        if (!survey) { await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(404).json({ success: false, message: 'Survey not found.' }); }
        if (survey.status !== 'active') { await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(403).json({ success: false, message: 'This survey is not active.' }); }

        const collector = await Collector.findById(collectorId).select('status settings survey responseCount').session(mongoSession);
        if (!collector) { await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(404).json({ success: false, message: 'Collector not found.' }); }
        if (String(collector.survey) !== String(surveyId)) { await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(400).json({ success: false, message: 'Collector mismatch.' }); }
        if (collector.status !== 'open') { await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(403).json({ success: false, message: `Link is ${collector.status}.` }); }

        const respondentIp = getIpAddress(req);
        const userAgent = req.headers['user-agent'];

        if (collector.settings?.web_link?.enableRecaptcha) {
            const secretKey = process.env.RECAPTCHA_SECRET_KEY;
            if (!recaptchaTokenV2) { await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(400).json({ success: false, message: 'reCAPTCHA token missing.' }); }
            if (!secretKey) { console.error('[SUBMIT ENDPOINT V2] RECAPTCHA_SECRET_KEY not set.'); await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(500).json({ success: false, message: 'reCAPTCHA server config error.' }); }
            const verificationURL = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${recaptchaTokenV2}&remoteip=${respondentIp}`;
            try {
                const recaptchaRes = await axios.post(verificationURL);
                if (!recaptchaRes.data.success) { console.warn('[SUBMIT ENDPOINT V2] reCAPTCHA v2 verification failed:', recaptchaRes.data['error-codes']); await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(400).json({ success: false, message: 'reCAPTCHA verification failed.', details: recaptchaRes.data['error-codes'] }); }
                console.log('[SUBMIT ENDPOINT V2] reCAPTCHA v2 verified successfully.');
            } catch (e) { console.error("[SUBMIT ENDPOINT V2] reCAPTCHA HTTP error:", e.message); await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(500).json({ success: false, message: 'Error verifying reCAPTCHA.' }); }
        }

        if (!collector.settings?.web_link?.allowMultipleResponses) {
            const isAnonymous = collector.settings?.web_link?.anonymousResponses || false;
            const queryCriteria = { survey: surveyId, collector: collectorId, status: 'completed' };
            if (isAnonymous) { if (respondentIp) queryCriteria.ipAddress = respondentIp; }
            else if (req.user && req.user._id) { queryCriteria.userId = req.user._id; } 
            else if (respondentIp) { queryCriteria.ipAddress = respondentIp; }
            if (queryCriteria.ipAddress || queryCriteria.userId) {
                 const existingFullResponse = await Response.findOne(queryCriteria).session(mongoSession);
                 if (existingFullResponse) { await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(403).json({ success: false, message: 'You have already submitted this survey.' });}
            }
        }
        
        const validationErrors = [];
        const questionsMap = new Map(survey.questions.map(q => [q._id.toString(), q]));
        for (const questionIdStr in answers) {
            if (Object.hasOwnProperty.call(answers, questionIdStr)) {
                const question = questionsMap.get(questionIdStr);
                if (!question) { console.warn(`[SUBMIT ENDPOINT V2] Answer for non-existent question ID: ${questionIdStr}`); validationErrors.push({ questionId: questionIdStr, message: "Answer for unknown question." }); continue; }
                const answerValue = answers[questionIdStr];
                const otherText = otherInputValues ? otherInputValues[`${questionIdStr}_other`] : undefined;
                const error = validateAnswerDetailed(question, answerValue, otherText);
                if (error) { validationErrors.push({ questionId: questionIdStr, text: question.text, message: error });}
            }
        }
        for (const question of survey.questions) { // Check required questions not in answers
            if (!answers.hasOwnProperty(question._id.toString()) && question.requiredSetting === 'required') {
                 const error = validateAnswerDetailed(question, undefined, undefined); 
                 if (error) { validationErrors.push({ questionId: question._id.toString(), text: question.text, message: error });}
            }
        }
        if (validationErrors.length > 0) { await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(400).json({ success: false, message: 'Answer validation failed.', errors: validationErrors }); }

        let partialResponseToUpdate = null;
        if (resumeToken) {
            partialResponseToUpdate = await PartialResponse.findOne({ resumeToken, survey: surveyId, collector: collectorId }).session(mongoSession);
            if (partialResponseToUpdate) { if (partialResponseToUpdate.completedAt) { await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(409).json({ success: false, message: 'This survey session was already completed.' });}
            } else { console.warn(`[SUBMIT ENDPOINT V2] Valid resume token ${resumeToken} provided, but no matching partial response found.`); }
        }

        let responseDoc = await Response.findOne({ survey: surveyId, collector: collectorId, sessionId: clientSessionId, status: 'partial' }).session(mongoSession);
        const isAnonymousResp = collector.settings?.web_link?.anonymousResponses || false;
        const startedAtForResponse = partialResponseToUpdate?.createdAt || responseDoc?.startedAt || new Date();

        if (responseDoc) {
            console.log(`[SUBMIT ENDPOINT V2] Updating existing partial Response doc ${responseDoc._id} for session ${clientSessionId} to completed.`);
            responseDoc.status = 'completed'; responseDoc.submittedAt = new Date(); responseDoc.lastActivityAt = new Date();
            responseDoc.ipAddress = isAnonymousResp ? undefined : respondentIp; responseDoc.userAgent = isAnonymousResp ? undefined : userAgent;
            responseDoc.userId = (req.user && req.user._id && !isAnonymousResp && responseDoc.schema.path('userId')) ? req.user._id : undefined;
            responseDoc.customVariables = customVariablesFromClient || responseDoc.customVariables;
        } else {
            console.log(`[SUBMIT ENDPOINT V2] Creating new completed Response doc for session ${clientSessionId}.`);
            responseDoc = new Response({
                survey: surveyId, collector: collectorId, sessionId: clientSessionId, status: 'completed', startedAt: startedAtForResponse,
                lastActivityAt: new Date(), ipAddress: isAnonymousResp ? undefined : respondentIp, userAgent: isAnonymousResp ? undefined : userAgent,
                userId: (req.user && req.user._id && !isAnonymousResp && Response.schema.path('userId')) ? req.user._id : undefined,
                customVariables: customVariablesFromClient || {},
            });
        }
        await responseDoc.save({ session: mongoSession });

        const answerOps = [];
        for (const questionIdStr in answers) {
            if (Object.hasOwnProperty.call(answers, questionIdStr)) {
                const questionObjectId = new mongoose.Types.ObjectId(questionIdStr);
                const answerValue = answers[questionIdStr];
                const otherText = otherInputValues ? otherInputValues[`${questionIdStr}_other`] : undefined;
                answerOps.push({
                    updateOne: {
                        filter: { survey: surveyId, questionId: questionObjectId, sessionId: clientSessionId, collector: collectorId },
                        update: { $set: { answerValue: answerValue, otherText: otherText, updatedAt: new Date() }, $setOnInsert: { survey: surveyId, questionId: questionObjectId, sessionId: clientSessionId, collector: collectorId, createdAt: new Date() }},
                        upsert: true 
                    }
                });
            }
        }
        if (answerOps.length > 0) { await Answer.bulkWrite(answerOps, { session: mongoSession }); console.log(`[SUBMIT ENDPOINT V2] Bulk upserted ${answerOps.length} Answer documents.`); }

        if (partialResponseToUpdate) {
            partialResponseToUpdate.completedAt = new Date(); partialResponseToUpdate.finalResponse = responseDoc._id;
            await partialResponseToUpdate.save({ session: mongoSession });
            console.log(`[SUBMIT ENDPOINT V2] Marked PartialResponse ${partialResponseToUpdate._id} as completed.`);
        }
        
        collector.responseCount = (collector.responseCount || 0) + 1;
        await collector.save({ session: mongoSession });

        await mongoSession.commitTransaction();
        mongoSession.endSession();

        console.log(`[SUBMIT ENDPOINT V2] Survey ${surveyId} submitted successfully. Response (Header) ID: ${responseDoc._id}`);
        res.status(201).json({ success: true, message: 'Survey submitted successfully.', responseId: responseDoc._id, thankYouMessage: survey.thankYouMessage || { text: "Thank you for your response!" } });
    } catch (error) {
        if (mongoSession.inTransaction()) await mongoSession.abortTransaction();
        mongoSession.endSession();
        console.error(`[SUBMIT ENDPOINT V2] CRITICAL ERROR submitting survey ${surveyId}:`, error.stack);
        res.status(500).json({ success: false, message: 'An internal server error occurred.' });
    }
};


// --- FUNCTIONS BELOW STILL NEED MODIFICATION FOR Answer.js MODEL ---

exports.savePartialResponse = async (req, res) => { // From your vNext28 - NEEDS HEAVY MODIFICATION
    const { surveyId } = req.params;
    const { collectorId, respondentEmail, currentAnswers, otherInputValues, currentVisibleIndex, visitedPath, sessionId, resumeToken: existingResumeToken } = req.body; // Added existingResumeToken from your model
    console.log(`[savePartialResponse] User: ${req.user?.id}. Attempting for survey: ${surveyId}`);

    // TODO: CRITICAL - This function needs to be rewritten similar to submitSurveyAnswers.
    // 1. It should NOT store `currentAnswers` or `otherInputValues` directly on the `PartialResponse` document.
    //    Your `PartialResponse.js` model has `answers: Map, of: Mixed` and `otherInputValues: Map, of: String`.
    //    These fields should ideally be REMOVED from `PartialResponse.js` if `Answer.js` is the single source of truth for answer data.
    //    If you keep them on `PartialResponse` for some reason, be aware of data duplication/synchronization issues.
    // 2. It SHOULD use `Answer.bulkWrite()` with upserts to save/update individual `Answer` documents
    //    for the current `clientSessionId` (passed as `sessionId` in the request body).
    // 3. The `PartialResponse` document itself will store metadata: `survey`, `collector`, `sessionId` (from client),
    //    `resumeToken` (generated here), `respondentEmail`, `currentVisibleIndex`, `visitedPath`, `expiresAt`.
    // 4. Validation of answers (e.g., `validateAnswerDetailed`) might be optional for partial saves, or less strict.

    if (!mongoose.Types.ObjectId.isValid(surveyId) || (collectorId && !mongoose.Types.ObjectId.isValid(collectorId))) {
        return res.status(400).json({ success: false, message: 'Invalid Survey or Collector ID.' });
    }
    if (respondentEmail && !/\S+@\S+\.\S+/.test(respondentEmail)) {
        return res.status(400).json({ success: false, message: 'If provided, the email address is invalid.' });
    }
    if (!sessionId) { // clientSessionId is crucial for linking answers
        return res.status(400).json({ success: false, message: 'Client Session ID (as sessionId) is required for saving progress.' });
    }


    const mongoSession = await mongoose.startSession();
    mongoSession.startTransaction();
    try {
        const survey = await Survey.findById(surveyId).select('title settings.behaviorNavigation').session(mongoSession);
        if (!survey) { /* ... abort ... */ await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(404).json({ success: false, message: 'Survey not found.' }); }
        
        const behaviorNavSettings = survey.settings?.behaviorNavigation || {};
        if (!behaviorNavSettings.saveAndContinueEnabled) { /* ... abort ... */ await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(400).json({ success: false, message: 'Save and Continue feature is not enabled for this survey.' }); }
        const saveMethod = behaviorNavSettings.saveAndContinueMethod || 'email';

        if ((saveMethod === 'email' || saveMethod === 'both') && !respondentEmail) { /* ... abort ... */ await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(400).json({ success: false, message: 'Email address is required for this save method.' }); }

        const collector = await Collector.findById(collectorId).session(mongoSession);
         if (!collector) { /* ... abort ... */ await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(404).json({ success: false, message: 'Collector not found.' }); }
         if (String(collector.survey) !== String(surveyId)) { await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(400).json({ success: false, message: 'Collector does not belong to this survey.' });}


        // --- Save/Update individual Answer documents using bulkWrite (similar to submitSurveyAnswers) ---
        const answerOpsForPartial = [];
        if (typeof currentAnswers === 'object' && currentAnswers !== null) {
            for (const questionIdStr in currentAnswers) {
                if (Object.hasOwnProperty.call(currentAnswers, questionIdStr)) {
                    const questionObjectId = new mongoose.Types.ObjectId(questionIdStr);
                    const answerValue = currentAnswers[questionIdStr];
                    const otherText = otherInputValues ? otherInputValues[`${questionIdStr}_other`] : undefined;

                    answerOpsForPartial.push({
                        updateOne: {
                            filter: { survey: surveyId, questionId: questionObjectId, sessionId: sessionId, collector: collectorId }, // Use `sessionId` from req.body
                            update: { $set: { answerValue: answerValue, otherText: otherText, updatedAt: new Date() }, $setOnInsert: { survey: surveyId, questionId: questionObjectId, sessionId: sessionId, collector: collectorId, createdAt: new Date() }},
                            upsert: true
                        }
                    });
                }
            }
        }
        if (answerOpsForPartial.length > 0) {
            await Answer.bulkWrite(answerOpsForPartial, { session: mongoSession });
            console.log(`[savePartialResponse] Bulk upserted ${answerOpsForPartial.length} Answer documents for session ${sessionId}.`);
        }
        // --- End Answer saving ---


        let partialResponseDoc;
        let newResumeTokenGenerated = false;
        let finalResumeTokenToUse;
        const expiryDays = behaviorNavSettings.saveAndContinueEmailLinkExpiryDays || 7;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expiryDays);

        if (existingResumeToken) { // If frontend is trying to update an existing partial save session
            partialResponseDoc = await PartialResponse.findOne({ resumeToken: existingResumeToken, survey: surveyId }).session(mongoSession);
            if (partialResponseDoc) {
                if (partialResponseDoc.completedAt) { /* ... abort ... */ await mongoSession.abortTransaction(); mongoSession.endSession(); return res.status(409).json({ success: false, message: 'This survey session has already been completed.' }); }
                console.log(`[savePartialResponse] Updating existing PartialResponse ${partialResponseDoc._id} with token ${existingResumeToken}`);
                finalResumeTokenToUse = existingResumeToken;
                // Update fields
                partialResponseDoc.respondentEmail = respondentEmail || partialResponseDoc.respondentEmail; // Update email if new one provided
                // DO NOT save answers/otherInputValues here directly anymore. They are in Answer collection.
                // partialResponseDoc.answers = currentAnswers || {}; // REMOVE/COMMENT OUT
                // partialResponseDoc.otherInputValues = otherInputValues || {}; // REMOVE/COMMENT OUT
                partialResponseDoc.currentVisibleIndex = currentVisibleIndex === undefined ? partialResponseDoc.currentVisibleIndex : currentVisibleIndex;
                partialResponseDoc.visitedPath = visitedPath || partialResponseDoc.visitedPath;
                partialResponseDoc.expiresAt = expiresAt; // Refresh expiry
                partialResponseDoc.sessionId = sessionId; // Update sessionId if it changed (though usually it's fixed for a save session)
                partialResponseDoc.updatedAt = new Date();
            } else {
                console.warn(`[savePartialResponse] existingResumeToken ${existingResumeToken} provided but not found. Creating new partial save.`);
                // Fall through to create new
            }
        }
        
        if (!partialResponseDoc) { // Create new partial response
            finalResumeTokenToUse = crypto.randomBytes(20).toString('hex');
            newResumeTokenGenerated = true;
            console.log(`[savePartialResponse] Creating new PartialResponse with token ${finalResumeTokenToUse} for session ${sessionId}`);
            partialResponseDoc = new PartialResponse({
                survey: surveyId,
                collector: collectorId,
                sessionId: sessionId, // This is the clientSessionId
                resumeToken: finalResumeTokenToUse,
                respondentEmail: respondentEmail || undefined,
                // DO NOT save answers/otherInputValues here directly anymore
                // answers: currentAnswers || {}, // REMOVE/COMMENT OUT
                // otherInputValues: otherInputValues || {}, // REMOVE/COMMENT OUT
                currentVisibleIndex: currentVisibleIndex === undefined ? 0 : currentVisibleIndex,
                visitedPath: visitedPath || [],
                expiresAt,
            });
        }
        
        await partialResponseDoc.save({ session: mongoSession });

        let emailSentSuccessfully = null;
        const shouldSendEmail = respondentEmail && (saveMethod === 'email' || saveMethod === 'both');
        // Send email only if a new token was generated OR if the email was updated for an existing partial response
        const emailChangedForExisting = !newResumeTokenGenerated && respondentEmail && partialResponseDoc.respondentEmail !== respondentEmail;


        if (shouldSendEmail && (newResumeTokenGenerated || emailChangedForExisting)) {
            try {
                // Construct resume link carefully. It should point to a route that uses getSurveyById with the resumeToken.
                const resumeLink = `${process.env.FRONTEND_URL}/surveys/${surveyId}/c/${collectorId}/${finalResumeTokenToUse}`; // Example link structure
                await emailService.sendResumeEmail(respondentEmail, survey.title, resumeLink, expiryDays);
                emailSentSuccessfully = true;
            } catch (emailError) {
                console.error(`[savePartialResponse] Failed to send resume email to ${respondentEmail} for survey ${surveyId}. Error: ${emailError.message}`);
                emailSentSuccessfully = false;
            }
        } else if (shouldSendEmail) {
             console.log(`[savePartialResponse] Email not re-sent for existing token ${finalResumeTokenToUse} as email ${respondentEmail} was likely already used or not changed.`);
        }

        await mongoSession.commitTransaction();
        mongoSession.endSession();

        let message = 'Progress saved!';
        const provideCode = saveMethod === 'code' || saveMethod === 'both';
        // ... (rest of your message construction logic from vNext28) ...
        if (shouldSendEmail) {
            if (emailSentSuccessfully === true) { message = `Progress saved! A link to resume this survey has been sent to ${respondentEmail}.`; if (provideCode) message += ` Your resume code is also provided below.`;}
            else if (emailSentSuccessfully === false) { message = `Progress saved! We could not send an email.`; if (provideCode) message += ` Please use the resume code below to continue later.`; else message += ` Please contact support or try saving again. If the issue persists, you can use this resume code: ${finalResumeTokenToUse}.`;}
            else { if (provideCode) message = `Progress saved! Use the resume code below to continue later.`; else message = `Progress saved!`;}
        } else if (provideCode) { message = `Progress saved! Use the resume code below to continue later.`; }


        res.status(200).json({
            success: true, message: message,
            resumeToken: finalResumeTokenToUse, surveyId: surveyId,
            saveMethodUsed: saveMethod, emailSent: emailSentSuccessfully, expiresInDays: expiryDays
        });

    } catch (error) {
        if (mongoSession.inTransaction()) await mongoSession.abortTransaction();
        mongoSession.endSession();
        console.error(`[savePartialResponse] Error saving partial response for survey ${surveyId}:`, error.stack);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ success: false, message: 'Validation error saving progress.', details: error.errors });
        }
        res.status(500).json({ success: false, message: 'Error saving progress.' });
    }
};


exports.getSurveyResults = async (req, res) => { // From your vNext28 - NEEDS HEAVY MODIFICATION
    const { surveyId } = req.params;
    console.log(`[getSurveyResults] User: ${req.user?.id}. Attempting for survey: ${surveyId}`);

    // TODO: CRITICAL - This function needs to be rewritten.
    // 1. Fetch all `Response` documents for the survey (these are the headers, with status 'completed').
    // 2. For each `Response` document (i.e., for each `sessionId`):
    //    a. Fetch all `Answer` documents matching the `surveyId` and `sessionId`.
    //    b. Reconstruct the full set of answers for that response session.
    // 3. Collate these reconstructed responses.
    // 4. Populate question details for context.

    if (!mongoose.Types.ObjectId.isValid(surveyId)) {
        return res.status(400).json({ success: false, message: 'Invalid Survey ID.' });
    }
     if (!req.user || !req.user.id) {
         console.error('[getSurveyResults] User ID not found in request. Auth middleware issue?');
         return res.status(401).json({ success: false, message: 'User authentication failed.' });
    }

    try {
        const survey = await Survey.findById(surveyId)
            .select('title questions createdBy') // Questions needed for context
            .populate({ path: 'questions', model: 'Question', select: 'text type options subQuestions originalIndex _id' });

        if (!survey) return res.status(404).json({ success: false, message: 'Survey not found.' });
        // Authorization already handled by authorizeSurveyAccess middleware

        // Step 1: Fetch Response Headers
        const responseHeaders = await Response.find({ survey: surveyId, status: 'completed' })
            .populate({ path: 'collector', select: 'name type' })
            .sort({ submittedAt: -1 })
            .lean(); // Use lean for performance

        if (responseHeaders.length === 0) {
            return res.status(200).json({
                success: true, surveyTitle: survey.title, questions: survey.questions,
                summary: { totalResponses: 0 }, data: []
            });
        }

        // Step 2 & 3: Fetch all answers for all completed sessions of this survey and reconstruct
        const sessionIds = responseHeaders.map(rh => rh.sessionId);
        const allAnswersForSurvey = await Answer.find({ survey: surveyId, sessionId: { $in: sessionIds } }).lean();

        const answersBySession = allAnswersForSurvey.reduce((acc, ans) => {
            if (!acc[ans.sessionId]) acc[ans.sessionId] = {};
            acc[ans.sessionId][ans.questionId.toString()] = {
                answerValue: ans.answerValue,
                otherText: ans.otherText
            };
            return acc;
        }, {});

        const reconstructedResponses = responseHeaders.map(header => {
            const sessionAnswers = answersBySession[header.sessionId] || {};
            const formattedAnswers = {};
            const formattedOtherValues = {};
            for (const qId in sessionAnswers) {
                formattedAnswers[qId] = sessionAnswers[qId].answerValue;
                if (sessionAnswers[qId].otherText) {
                    formattedOtherValues[`${qId}_other`] = sessionAnswers[qId].otherText;
                }
            }
            return {
                ...header, // Spread the metadata from the Response document
                answers: formattedAnswers, // The reconstructed answers
                otherInputValues: formattedOtherValues // The reconstructed other texts
            };
        });
        
        const summary = { totalResponses: reconstructedResponses.length };
        
        res.status(200).json({
            success: true, surveyTitle: survey.title,
            questions: survey.questions, // Send question details for context
            summary, data: reconstructedResponses
        });

    } catch (error) {
        console.error(`[getSurveyResults] Error fetching results for survey ${surveyId}:`, error.stack);
        res.status(500).json({ success: false, message: 'Error fetching survey results.' });
    }
};

exports.exportSurveyResults = async (req, res) => { // From your vNext28 - NEEDS HEAVY MODIFICATION
    const { surveyId } = req.params;
    const { format = 'json' } = req.query;
    console.log(`[exportSurveyResults] User: ${req.user?.id}. Attempting for survey: ${surveyId}, format: ${format}`);

    // TODO: CRITICAL - This function needs a similar rewrite to getSurveyResults.
    // 1. Fetch Response headers.
    // 2. Fetch all relevant Answer documents.
    // 3. Reconstruct each full response.
    // 4. Then, format for CSV or JSON. The CSV part will need careful construction of headers
    //    and mapping the reconstructed answers to the correct columns.

    if (!mongoose.Types.ObjectId.isValid(surveyId)) {
        return res.status(400).json({ success: false, message: 'Invalid Survey ID.' });
    }
    if (!req.user || !req.user.id) { /* ... auth error ... */ return res.status(401).json({ success: false, message: 'User authentication failed.' });}

    try {
        const survey = await Survey.findById(surveyId)
            .select('title questions')
            .populate({ path: 'questions', model: 'Question', select: 'text type originalIndex _id' });

        if (!survey) return res.status(404).json({ success: false, message: 'Survey not found.' });

        // Fetch reconstructed responses (similar to getSurveyResults)
        const responseHeaders = await Response.find({ survey: surveyId, status: 'completed' })
            .populate({path: 'collector', select: 'name'}) // For collector name in export
            .sort({ submittedAt: -1 })
            .lean();

        if (responseHeaders.length === 0 && format.toLowerCase() === 'csv') {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="survey_${surveyId}_results_empty.csv"`);
            return res.status(200).send("No responses to export.");
        } else if (responseHeaders.length === 0) {
            return res.status(200).json({ success: true, surveyTitle: survey.title, totalResponses: 0, data: [] });
        }

        const sessionIds = responseHeaders.map(rh => rh.sessionId);
        const allAnswersForSurvey = await Answer.find({ survey: surveyId, sessionId: { $in: sessionIds } }).lean();
        const answersBySession = allAnswersForSurvey.reduce((acc, ans) => {
            if (!acc[ans.sessionId]) acc[ans.sessionId] = {};
            acc[ans.sessionId][ans.questionId.toString()] = { answerValue: ans.answerValue, otherText: ans.otherText };
            return acc;
        }, {});

        const reconstructedResponses = responseHeaders.map(header => {
            const sessionAnswers = answersBySession[header.sessionId] || {};
            const formattedAnswers = {};
            const formattedOtherValues = {};
            for (const qId in sessionAnswers) {
                formattedAnswers[qId] = sessionAnswers[qId].answerValue;
                if (sessionAnswers[qId].otherText) formattedOtherValues[`${qId}_other`] = sessionAnswers[qId].otherText;
            }
            return { ...header, answers: formattedAnswers, otherInputValues: formattedOtherValues };
        });

        if (format.toLowerCase() === 'csv') {
            const questionsMap = new Map(survey.questions.map(q => [q._id.toString(), q]));
            const csvFields = [
                { label: 'Response ID (Session)', value: '_id' }, // This is Response doc _id
                { label: 'Session ID', value: 'sessionId'},
                { label: 'Collector Name', value: (row) => row.collector?.name || 'N/A' },
                { label: 'Status', value: 'status'},
                { label: 'Started At', value: (row) => row.startedAt ? new Date(row.startedAt).toISOString() : ''},
                { label: 'Submitted At', value: (row) => row.submittedAt ? new Date(row.submittedAt).toISOString() : '' },
                { label: 'Duration (seconds)', value: 'durationSeconds'},
                // Conditionally add IP/UserAgent if needed and not anonymous
                // { label: 'IP Address', value: 'ipAddress', default: '' },
                // { label: 'User Agent', value: 'userAgent', default: '' },
            ];
            // Add custom variable columns from Response.customVariables if any
            // This requires knowing the keys, or dynamically finding all unique keys across responses.
            // For simplicity, assuming fixed custom variable keys if you have them.

            survey.questions.sort((a,b) => a.originalIndex - b.originalIndex).forEach(q => {
                csvFields.push({
                    label: q.text || `Question ${q.originalIndex + 1}`,
                    value: (row) => {
                        const answerObj = row.answers?.[q._id.toString()]; // answerValue is here
                        const otherText = row.otherInputValues?.[`${q._id.toString()}_other`];
                        return formatValueForCsv(answerObj, q.type, otherText); // formatValueForCsv expects the direct answer value
                    }
                });
            });

            const json2csvParser = new Parser({ fields: csvFields, delimiter: ',', excelStrings: true });
            const csv = json2csvParser.parse(reconstructedResponses);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="survey_${surveyId}_results.csv"`);
            res.status(200).send(csv);
        } else { // JSON format
            res.status(200).json({
                success: true, surveyTitle: survey.title,
                totalResponses: reconstructedResponses.length,
                data: reconstructedResponses
            });
        }
    } catch (error) {
        console.error(`[exportSurveyResults] Error exporting results for survey ${surveyId}:`, error.stack);
        res.status(500).json({ success: false, message: 'Error exporting survey results.' });
    }
};

module.exports = exports;
// ----- END OF COMPLETE COMBINED AND UPDATED FILE -----