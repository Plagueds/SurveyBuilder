// backend/controllers/surveyController.js
// ----- START OF COMPLETE MODIFIED FILE (vNext - Fixed startedAt conflict) -----
const mongoose = require('mongoose');
const { Parser } = require('json2csv');
const Survey = require('../models/Survey');
const Question = require('../models/Question');
const Answer = require('../models/Answer');
const Collector = require('../models/Collector');
const Response = require('../models/Response');
const { evaluateAllLogic } = require('../utils/logicEvaluator');
const axios = require('axios');

// --- Helper Function for Conjoint Question Type (used in getSurveyById) ---
const generateConjointProfiles = (attributes) => {
    // This is a simplified placeholder. A full implementation would be more complex.
    if (!attributes || attributes.length === 0) return [];
    // const profiles = []; // Commented out as it's unused for now
    // Example: For two attributes with two levels each
    // Attribute 1: Color (Red, Blue), Attribute 2: Size (Small, Large)
    // Profiles: (Red, Small), (Red, Large), (Blue, Small), (Blue, Large)
    // A real implementation would use a combinatorial algorithm.
    // For now, let's assume a simple structure if needed for placeholder.
    // This function needs to be properly implemented based on conjoint requirements.
    console.warn("[generateConjointProfiles] Placeholder function used. Needs full implementation.");
    return []; // Return empty array as placeholder
};

// --- Helper Function for CSV Export (used in exportSurveyResults) ---
const CSV_SEPARATOR = '; '; // Using semicolon as it's common in some regions
const formatValueForCsv = (value, questionType, otherTextValue) => {
    if (value === null || value === undefined) return '';

    switch (questionType) {
        case 'multiple-choice': // Consolidated from multiple_choice_single
        case 'dropdown':
        case 'nps':
        case 'rating': // Consolidated from rating_scale
        case 'slider':
            // For multiple-choice, if value is __OTHER__, use otherTextValue
            if (value === '__OTHER__' && otherTextValue) {
                return `Other: ${otherTextValue}`;
            }
            if (typeof value === 'object' && value !== null && value.option) { // Should not happen for these types with current frontend
                let displayValue = value.option;
                if (value.isOther && otherTextValue) { // Should not happen for these types with current frontend
                    displayValue += `${CSV_SEPARATOR}Other: ${otherTextValue}`;
                }
                return displayValue;
            }
            return String(value);

        case 'checkbox': // Consolidated from multiple_choice_multiple
            if (Array.isArray(value) && value.length > 0) {
                const options = value
                    .filter(v => v !== '__OTHER__') // Filter out the internal __OTHER__ value itself
                    .map(v => String(v)) // Convert each selected option to string
                    .join(CSV_SEPARATOR);
                
                const otherIsSelected = value.includes('__OTHER__');
                if (otherIsSelected && otherTextValue) {
                    return options ? `${options}${CSV_SEPARATOR}Other: ${otherTextValue}` : `Other: ${otherTextValue}`;
                }
                return options;
            }
            return '';

        case 'matrix': // Consolidated from matrix_single and matrix_multiple
            if (typeof value === 'object' && value !== null && Object.keys(value).length > 0) {
                return Object.entries(value)
                    .map(([row, colValue]) => {
                        if (Array.isArray(colValue)) return `${row}: ${colValue.join(', ')}`;
                        return `${row}: ${String(colValue)}`;
                    })
                    .join(CSV_SEPARATOR);
            }
            return '';
        
        case 'date': // Assuming 'date' is a type you might add
            try {
                return new Date(value).toLocaleDateString('en-CA'); // YYYY-MM-DD
            } catch (e) {
                return String(value);
            }

        case 'file_upload': // Assuming 'file_upload' is a type you might add
            if (Array.isArray(value)) {
                return value.map(file => file.url || file.name).join(CSV_SEPARATOR);
            }
            if (typeof value === 'object' && value !== null) {
                return value.url || value.name || '';
            }
            return '';
        
        case 'cardsort':
            if (typeof value === 'object' && value !== null && value.assignments) {
                // Could format as "Card1: CategoryA; Card2: CategoryB"
                // Or JSON stringify for simplicity if detailed structure is needed
                return JSON.stringify(value);
            }
            return '';

        default: // For text, textarea, ranking, heatmap, maxdiff, conjoint
            if (Array.isArray(value)) return value.join(CSV_SEPARATOR);
            if (typeof value === 'object' && value !== null) return JSON.stringify(value); // MaxDiff, Conjoint, Heatmap (if object)
            return String(value);
    }
};

// --- Controller Functions ---

// @desc    Get all surveys for the logged-in user (or all if admin)
// @route   GET /api/surveys
// @access  Private (User or Admin)
exports.getAllSurveys = async (req, res) => {
    const requestStartTime = Date.now();
    console.log(`[${new Date().toISOString()}] [getAllSurveys] Entered. User ID: ${req.user?.id}, Role: ${req.user?.role}`);

    try {
        const filter = {};
        if (req.user && req.user.id) {
            filter.createdBy = req.user.id;
            if (req.user.role === 'admin') {
                delete filter.createdBy;
            }
        } else {
            console.error(`[${new Date().toISOString()}] [getAllSurveys] CRITICAL: req.user or req.user.id is undefined.`);
            return res.status(401).json({ success: false, message: "Authentication details missing or invalid." });
        }

        console.log(`[${new Date().toISOString()}] [getAllSurveys] Using filter: ${JSON.stringify(filter)}`);
        const queryStartTime = Date.now();
        const surveys = await Survey.find(filter)
            .select('-questions -globalSkipLogic -settings -randomizationLogic -collectors')
            .sort({ createdAt: -1 });
        const queryEndTime = Date.now();
        console.log(`[${new Date().toISOString()}] [getAllSurveys] Survey.find() executed in ${queryEndTime - queryStartTime}ms. Found ${surveys ? surveys.length : 'null/undefined'} surveys.`);

        if (!surveys) {
            console.error(`[${new Date().toISOString()}] [getAllSurveys] Surveys array is unexpectedly null or undefined.`);
            if (!res.headersSent) {
                return res.status(500).json({ success: false, message: "Error fetching surveys: Data became unavailable post-query." });
            }
            return;
        }
        
        if (!res.headersSent) {
            res.status(200).json({ success: true, count: surveys.length, data: surveys });
            console.log(`[${new Date().toISOString()}] [getAllSurveys] Response sent successfully. Total request time: ${Date.now() - requestStartTime}ms.`);
        } else {
            console.warn(`[${new Date().toISOString()}] [getAllSurveys] Headers already sent.`);
        }

    } catch (error) {
        console.error(`[${new Date().toISOString()}] [getAllSurveys] CRITICAL ERROR. Total request time: ${Date.now() - requestStartTime}ms. Error: ${error.message}`, error.stack);
        if (!res.headersSent) {
            res.status(500).json({ success: false, message: "Critical error fetching surveys on the server." });
        } else {
            console.warn(`[${new Date().toISOString()}] [getAllSurveys] Headers already sent when trying to send error response.`);
        }
    }
};

// @desc    Create a new survey
// @route   POST /api/surveys
// @access  Private (User or Admin)
exports.createSurvey = async (req, res) => {
    const { title, description, category, settings, welcomeMessage, thankYouMessage } = req.body;
    try {
        const newSurvey = new Survey({
            title: title || 'Untitled Survey',
            description,
            category,
            createdBy: req.user.id,
            status: 'draft',
            settings: settings || {},
            welcomeMessage: welcomeMessage || { text: "Welcome to the survey!" },
            thankYouMessage: thankYouMessage || { text: "Thank you for completing the survey!" },
        });
        const savedSurvey = await newSurvey.save();
        res.status(201).json({ success: true, message: 'Survey created successfully.', data: savedSurvey });
    } catch (error) {
        console.error('[createSurvey] Error creating survey:', error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ success: false, message: 'Validation Error', details: error.errors });
        }
        res.status(500).json({ success: false, message: 'Error creating survey.' });
    }
};

// @desc    Get a single survey by ID
// @route   GET /api/surveys/:surveyId
// @access  Private (Owner or Admin for full details, Public for active survey structure)
exports.getSurveyById = async (req, res) => {
    const { surveyId } = req.params;
    const { forTaking, collectorId } = req.query;

    if (!mongoose.Types.ObjectId.isValid(surveyId)) {
        return res.status(400).json({ success: false, message: 'Invalid Survey ID.' });
    }

    try {
        let surveyQuery = Survey.findById(surveyId);

        if (forTaking === 'true') {
            surveyQuery = surveyQuery
                .select('title description welcomeMessage thankYouMessage status questions settings.surveyWide.allowRetakes settings.surveyWide.showProgressBar settings.surveyWide.customCSS globalSkipLogic randomizationLogic')
                .populate({
                    path: 'questions',
                    select: '-survey -createdBy -updatedAt -__v -analytics', // Ensure 'survey' (parent ref) is also excluded for respondent
                    options: { sort: { order: 1 } }
                });
        } else {
            surveyQuery = surveyQuery.populate({
                path: 'questions',
                options: { sort: { order: 1 } }
            }).populate('collectors');
        }

        const survey = await surveyQuery;

        if (!survey) {
            return res.status(404).json({ success: false, message: 'Survey not found.' });
        }

        if (forTaking !== 'true' && String(survey.createdBy) !== String(req.user.id) && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'You are not authorized to view this survey\'s details.' });
        }

        if (forTaking === 'true') {
            // Allow 'draft' for previewing owned surveys, otherwise must be 'active'
            const isOwnerPreviewingDraft = survey.status === 'draft' && req.user && String(survey.createdBy) === String(req.user.id);
            if (survey.status !== 'active' && !isOwnerPreviewingDraft) {
                 return res.status(403).json({ success: false, message: 'This survey is not currently active.' });
            }

            if (collectorId) {
                if (!mongoose.Types.ObjectId.isValid(collectorId)) {
                    return res.status(400).json({ success: false, message: 'Invalid Collector ID for taking survey.' });
                }
                const collector = await Collector.findById(collectorId);
                if (!collector || String(collector.survey) !== String(survey._id)) {
                    return res.status(404).json({ success: false, message: 'Survey link (collector) not found or invalid.' });
                }
                if (collector.status !== 'open' && !isOwnerPreviewingDraft) { // Owner can preview even if collector is not open
                     return res.status(403).json({ success: false, message: `This survey link is currently ${collector.status}.` });
                }
                if (collector.type === 'web_link' && collector.settings?.web_link?.enablePassword) {
                    const providedPassword = req.headers['x-survey-password'];
                    if (!providedPassword || providedPassword !== collector.settings.web_link.password) {
                        return res.status(401).json({ success: false, message: 'Password required for this survey link.', requiresPassword: true });
                    }
                }
            } else if (!isOwnerPreviewingDraft && survey.status === 'draft') {
                // If it's a draft and not an owner previewing, and no collector ID is provided (direct access attempt)
                return res.status(403).json({ success: false, message: 'This survey is currently in draft mode.' });
            }
        }
        
        if (survey.questions && survey.questions.some(q => q.type === 'conjoint')) { // Updated type name
            survey.questions = survey.questions.map(q => {
                if (q.type === 'conjoint' && q.conjointAttributes) { // Check for conjointAttributes
                    const profiles = generateConjointProfiles(q.conjointAttributes);
                    return { ...q.toObject(), generatedProfiles: profiles }; // Add generatedProfiles to the question object
                }
                return q.toObject(); // Ensure all questions are plain objects if modifying
            });
        } else if (survey.questions) {
            survey.questions = survey.questions.map(q => q.toObject()); // Ensure all questions are plain objects
        }


        res.status(200).json({ success: true, data: survey });
    } catch (error) {
        console.error(`[getSurveyById] Error fetching survey ${surveyId}:`, error);
        res.status(500).json({ success: false, message: 'Error fetching survey.' });
    }
};

// @desc    Update a survey's structure, settings, or questions
// @route   PATCH /api/surveys/:surveyId
// @access  Private (Owner or Admin)
exports.updateSurvey = async (req, res) => {
    const { surveyId } = req.params;
    const updates = req.body;

    if (!mongoose.Types.ObjectId.isValid(surveyId)) {
        return res.status(400).json({ success: false, message: 'Invalid Survey ID.' });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const survey = await Survey.findById(surveyId).session(session);
        if (!survey) {
            await session.abortTransaction(); session.endSession();
            return res.status(404).json({ success: false, message: 'Survey not found.' });
        }

        if (String(survey.createdBy) !== String(req.user.id) && req.user.role !== 'admin') {
            await session.abortTransaction(); session.endSession();
            return res.status(403).json({ success: false, message: 'You are not authorized to update this survey.' });
        }

        if (updates.questions && Array.isArray(updates.questions)) {
            const existingQuestionIds = survey.questions.map(id => String(id));
            const incomingQuestionIds = [];
            
            for (const qData of updates.questions) {
                if (qData._id && mongoose.Types.ObjectId.isValid(qData._id)) {
                    await Question.updateOne({ _id: qData._id, survey: survey._id }, { $set: qData }, { session });
                    incomingQuestionIds.push(String(qData._id));
                } else {
                    const newQuestionData = { ...qData, survey: survey._id, createdBy: req.user.id };
                    delete newQuestionData._id; // Ensure _id is not set for new question
                    const savedNewQ = await new Question(newQuestionData).save({ session });
                    incomingQuestionIds.push(String(savedNewQ._id));
                }
            }
            
            const questionsToDelete = existingQuestionIds.filter(id => !incomingQuestionIds.includes(id));
            if (questionsToDelete.length > 0) {
                await Question.deleteMany({ _id: { $in: questionsToDelete }, survey: survey._id }, { session });
                await Answer.deleteMany({ questionId: { $in: questionsToDelete }, surveyId: survey._id }, { session });
            }
            survey.questions = incomingQuestionIds.map(id => new mongoose.Types.ObjectId(id));
            delete updates.questions;
        }

        Object.keys(updates).forEach(key => {
            if (key !== '_id' && key !== 'createdBy' && key !== 'questions') {
                 survey[key] = updates[key];
            }
        });
        
        survey.updatedAt = Date.now();
        const updatedSurvey = await survey.save({ session });

        await session.commitTransaction();
        session.endSession();

        const populatedSurvey = await Survey.findById(updatedSurvey._id).populate({
            path: 'questions',
            options: { sort: { order: 1 } }
        });

        res.status(200).json({ success: true, message: 'Survey updated successfully.', data: populatedSurvey });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error(`[updateSurvey] Error updating survey ${surveyId}:`, error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ success: false, message: 'Validation Error', details: error.errors });
        }
        res.status(500).json({ success: false, message: 'Error updating survey.' });
    }
};

// @desc    Delete a survey
// @route   DELETE /api/surveys/:surveyId
// @access  Private (Owner or Admin)
exports.deleteSurvey = async (req, res) => {
    const { surveyId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(surveyId)) {
        return res.status(400).json({ success: false, message: 'Invalid Survey ID.' });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const survey = await Survey.findById(surveyId).session(session);
        if (!survey) {
            await session.abortTransaction(); session.endSession();
            return res.status(404).json({ success: false, message: 'Survey not found.' });
        }

        if (String(survey.createdBy) !== String(req.user.id) && req.user.role !== 'admin') {
            await session.abortTransaction(); session.endSession();
            return res.status(403).json({ success: false, message: 'You are not authorized to delete this survey.' });
        }

        await Question.deleteMany({ survey: survey._id }, { session }); // Corrected field name from surveyId to survey
        await Answer.deleteMany({ surveyId: survey._id }, { session });
        await Collector.deleteMany({ survey: survey._id }, { session });
        await Response.deleteMany({ survey: survey._id }, { session });
        await Survey.deleteOne({ _id: survey._id }, { session });

        await session.commitTransaction();
        session.endSession();

        res.status(200).json({ success: true, message: 'Survey and all associated data deleted successfully.' });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error(`[deleteSurvey] Error deleting survey ${surveyId}:`, error);
        res.status(500).json({ success: false, message: 'Error deleting survey.' });
    }
};

// @desc    Submit answers for a survey
// @route   POST /api/surveys/:surveyId/submit
// @access  Public
exports.submitSurveyAnswers = async (req, res) => {
    const { surveyId } = req.params;
    const { answers: answersPayload, sessionId: payloadSessionId, collectorId, recaptchaToken, startedAt: clientStartedAt } = req.body;

    console.log(`[submitSurveyAnswers] Received submission for surveyId: ${surveyId}, collectorId: ${collectorId}`);

    if (!mongoose.Types.ObjectId.isValid(surveyId)) {
        return res.status(400).json({ success: false, message: 'Invalid Survey ID.' });
    }
    if (!Array.isArray(answersPayload)) {
        return res.status(400).json({ success: false, message: 'Answers payload must be an array.' });
    }
    const sessionIdToUse = payloadSessionId; // Use directly from payload
    if (!sessionIdToUse) {
        return res.status(400).json({ success: false, message: 'Session ID is required.' });
    }
    if (!collectorId || !mongoose.Types.ObjectId.isValid(collectorId)) {
        return res.status(400).json({ success: false, message: 'Valid Collector ID is required for submission.' });
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    console.log(`[submitSurveyAnswers] Started transaction for session ${sessionIdToUse}`);

    try {
        const survey = await Survey.findById(surveyId).populate('questions').select('+status +globalSkipLogic +questions').session(session);
        if (!survey) {
            await session.abortTransaction(); session.endSession();
            return res.status(404).json({ success: false, message: 'Survey not found.' });
        }
        const isOwnerPreviewingDraft = survey.status === 'draft' && req.user && String(survey.createdBy) === String(req.user.id);
        if (survey.status !== 'active' && !isOwnerPreviewingDraft) {
            await session.abortTransaction(); session.endSession();
            return res.status(400).json({ success: false, message: 'This survey is not currently active or accepting responses.' });
        }

        const collector = await Collector.findById(collectorId).select('+settings.web_link.password').session(session);
        if (!collector) {
            await session.abortTransaction(); session.endSession();
            return res.status(404).json({ success: false, message: 'Collector not found.' });
        }
        if (String(collector.survey) !== String(surveyId)) {
            await session.abortTransaction(); session.endSession();
            return res.status(400).json({ success: false, message: 'Collector does not belong to this survey.' });
        }

        if (collector.status !== 'open' && !isOwnerPreviewingDraft) {
            await session.abortTransaction(); session.endSession();
            return res.status(400).json({ success: false, message: `This survey link is currently ${collector.status}.` });
        }
        const now = new Date();
        const webLinkSettings = collector.settings?.web_link;
        if (webLinkSettings?.openDate && new Date(webLinkSettings.openDate) > now && !isOwnerPreviewingDraft) {
            await session.abortTransaction(); session.endSession();
            return res.status(400).json({ success: false, message: 'This survey is not yet open.' });
        }
        if (webLinkSettings?.closeDate && new Date(webLinkSettings.closeDate) < now && !isOwnerPreviewingDraft) {
            await session.abortTransaction(); session.endSession();
            return res.status(400).json({ success: false, message: 'This survey has closed.' });
        }
        if (webLinkSettings?.maxResponses && collector.responseCount >= webLinkSettings.maxResponses && !isOwnerPreviewingDraft) {
            await session.abortTransaction(); session.endSession();
            return res.status(400).json({ success: false, message: 'This survey has reached its maximum response limit.' });
        }

        if (collector.type === 'web_link' && webLinkSettings?.enableRecaptcha && !isOwnerPreviewingDraft) {
            if (!recaptchaToken) {
                await session.abortTransaction(); session.endSession();
                return res.status(400).json({ success: false, message: 'reCAPTCHA verification is required but token was not provided.' });
            }
            const secretKey = process.env.RECAPTCHA_V2_SECRET_KEY;
            if (!secretKey) {
                console.error("[submitSurveyAnswers] RECAPTCHA_V2_SECRET_KEY is not set.");
                await session.abortTransaction(); session.endSession();
                return res.status(500).json({ success: false, message: 'reCAPTCHA configuration error on server.' });
            }
            const verificationUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${recaptchaToken}&remoteip=${req.ip}`;
            try {
                const recaptchaResponse = await axios.post(verificationUrl);
                if (!recaptchaResponse.data.success) {
                    console.warn('[submitSurveyAnswers] reCAPTCHA verification failed. Errors:', recaptchaResponse.data['error-codes']);
                    await session.abortTransaction(); session.endSession();
                    return res.status(400).json({ success: false, message: 'reCAPTCHA verification failed. Please try again.', errors: recaptchaResponse.data['error-codes'] });
                }
            } catch (e) {
                console.error('[submitSurveyAnswers] Error during reCAPTCHA verification request:', e.message);
                await session.abortTransaction(); session.endSession();
                return res.status(500).json({ success: false, message: 'Error verifying reCAPTCHA.' });
            }
        }

        const answersToUpsert = [];
        const questionIdsInPayload = new Set();
        for (const item of answersPayload) {
            if (!item?.questionId || !mongoose.Types.ObjectId.isValid(item.questionId) || item.answerValue === undefined) continue;
            // Ensure only one answer per question per session (latest one from payload)
            if (questionIdsInPayload.has(String(item.questionId))) {
                const idx = answersToUpsert.findIndex(a => String(a.questionId) === String(item.questionId));
                if (idx > -1) answersToUpsert.splice(idx, 1); // Remove previous if duplicate
            }
            questionIdsInPayload.add(String(item.questionId));
            answersToUpsert.push({
                surveyId, // Redundant with Response doc, but good for direct Answer queries
                questionId: item.questionId,
                sessionId: sessionIdToUse, // For grouping answers to a single take
                answerValue: item.answerValue,
                otherText: item.otherText || null,
                collectorId: collector._id // Link answer to specific collector
            });
        }

        if (answersToUpsert.length > 0) {
            const bulkWriteResult = await Answer.bulkWrite(answersToUpsert.map(ans => ({
                updateOne: {
                    filter: { surveyId: ans.surveyId, questionId: ans.questionId, sessionId: ans.sessionId, collectorId: ans.collectorId },
                    update: { $set: ans }, upsert: true,
                }
            })), { session });
            if (bulkWriteResult.hasWriteErrors()) {
                 console.error('[submitSurveyAnswers] BulkWriteError during answer saving:', bulkWriteResult.getWriteErrors());
                 await session.abortTransaction(); session.endSession();
                 return res.status(500).json({ success: false, message: 'Error saving some answers.' });
            }
        }

        // Prepare Response document data
        const responseUpdateData = {
            // survey: surveyId, // This is part of the query filter, not $set
            // collector: collectorId, // This is part of the query filter, not $set
            // sessionId: sessionIdToUse, // This is part of the query filter, not $set
            status: 'completed',
            submittedAt: new Date(),
            lastActivityAt: new Date(),
            // answers: answersToUpsert.map(a => a._id) // If you were to store Answer ObjectIds in Response
        };
        
        // Handle anonymous responses
        if (!webLinkSettings?.anonymousResponses) {
            responseUpdateData.ipAddress = req.ip;
            responseUpdateData.userAgent = req.headers['user-agent'];
        } else {
            // Ensure these fields are explicitly unset if they previously existed and now it's anonymous
            responseUpdateData.ipAddress = undefined; 
            responseUpdateData.userAgent = undefined;
        }
        
        // --- MODIFICATION FOR startedAt ---
        const responseSetOnInsertData = {
            survey: surveyId,
            collector: collectorId,
            sessionId: sessionIdToUse,
            startedAt: (clientStartedAt && !isNaN(new Date(clientStartedAt).getTime())) ? new Date(clientStartedAt) : new Date(),
            // Any other fields that should only be set once on creation
        };
        if (!webLinkSettings?.anonymousResponses && responseSetOnInsertData.ipAddress === undefined) { // Only set on insert if not already set by responseUpdateData
            responseSetOnInsertData.ipAddress = req.ip;
        }
        if (!webLinkSettings?.anonymousResponses && responseSetOnInsertData.userAgent === undefined) {
            responseSetOnInsertData.userAgent = req.headers['user-agent'];
        }
        // --- END MODIFICATION FOR startedAt ---
        
        const updatedResponse = await Response.findOneAndUpdate(
            { survey: surveyId, collector: collectorId, sessionId: sessionIdToUse },
            { 
                $set: responseUpdateData, 
                $setOnInsert: responseSetOnInsertData // Use $setOnInsert for fields set only on creation
            },
            { new: true, upsert: true, runValidators: true, session }
        );
        console.log(`[submitSurveyAnswers] Response document upserted/updated: ${updatedResponse._id}`);

        // Increment responseCount only if it's a new response (upserted)
        // This check is a bit tricky with findOneAndUpdate. A simpler way is to increment if status changes to completed.
        // For now, let's assume each successful submission attempt that isn't an owner previewing counts.
        if (!isOwnerPreviewingDraft) {
            await Collector.updateOne({ _id: collectorId }, { $inc: { responseCount: 1 } }, { session });
            const updatedCollector = await Collector.findById(collectorId).session(session); // Re-fetch to check quota
            if (webLinkSettings?.maxResponses && updatedCollector.responseCount >= webLinkSettings.maxResponses) {
                updatedCollector.status = 'completed_quota';
                await updatedCollector.save({ session });
            }
        }


        await session.commitTransaction();
        console.log(`[submitSurveyAnswers] Transaction committed for session ${sessionIdToUse}.`);

        let triggeredAction = null;
        if (survey.globalSkipLogic?.length > 0 && survey.questions) {
            const allSessionAnswers = await Answer.find({ surveyId, sessionId: sessionIdToUse }).lean(); // Use lean for performance
            triggeredAction = evaluateAllLogic(survey.globalSkipLogic, allSessionAnswers, survey.questions);
            if (triggeredAction?.type === 'disqualifyRespondent') {
                // Update response status to disqualified outside transaction or in a new one if needed,
                // as the main transaction is already committed.
                // For simplicity, doing it directly here.
                await Response.updateOne({ _id: updatedResponse._id }, { $set: { status: 'disqualified' } });
                return res.status(200).json({ success: true, message: triggeredAction.disqualificationMessage || 'Disqualified.', action: triggeredAction, sessionId: sessionIdToUse, responseId: updatedResponse._id });
            }
        }
        
        res.status(201).json({ success: true, message: 'Answers submitted successfully.', sessionId: sessionIdToUse, responseId: updatedResponse._id, action: triggeredAction });

    } catch (error) {
        console.error(`[submitSurveyAnswers] Error during submission for survey ${surveyId}, session ${sessionIdToUse}:`, error);
        if (session.inTransaction()) {
            try {
                await session.abortTransaction();
                 console.log(`[submitSurveyAnswers] Transaction aborted for session ${sessionIdToUse}.`);
            } catch (abortError) {
                console.error(`[submitSurveyAnswers] Error aborting transaction for session ${sessionIdToUse}:`, abortError);
            }
        }
        if (!res.headersSent) {
            if (error.name === 'ValidationError') return res.status(400).json({ success: false, message: 'Validation Error.', details: error.errors });
            if (error.code === 11000) { // Duplicate key error
                 return res.status(409).json({ success: false, message: 'Duplicate submission detected or session conflict.', details: error.keyValue });
            }
            // For other errors, including the ConflictingUpdateOperators if it were to happen again
            res.status(500).json({ success: false, message: error.message || 'Error submitting answers.' });
        }
    } finally {
        if (session.hasEnded === false) { // Check if session hasn't been ended by abort/commit
            session.endSession();
            console.log(`[submitSurveyAnswers] Session ended for ${sessionIdToUse}.`);
        }
    }
};

// @desc    Get survey results
// @route   GET /api/surveys/:surveyId/results
// @access  Private (Owner or Admin)
exports.getSurveyResults = async (req, res) => {
    const { surveyId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(surveyId)) {
        return res.status(400).json({ success: false, message: 'Invalid Survey ID.' });
    }

    try {
        const survey = await Survey.findById(surveyId)
            .populate({
                path: 'questions',
                options: { sort: { order: 1 } }
            });

        if (!survey) {
            return res.status(404).json({ success: false, message: 'Survey not found.' });
        }
        if (String(survey.createdBy) !== String(req.user.id) && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Not authorized to view these results.' });
        }

        const responses = await Response.find({ survey: surveyId, status: { $in: ['completed', 'disqualified'] } })
            .select('sessionId status submittedAt startedAt ipAddress userAgent customVariables');

        const sessionIds = responses.map(r => r.sessionId);
        const answers = await Answer.find({ surveyId: survey._id, sessionId: { $in: sessionIds } })
            .populate('questionId', 'text type options matrixRows matrixColumns'); // Adjusted populated fields

        const results = {
            surveyTitle: survey.title,
            totalResponses: responses.length,
            responsesSummary: responses.map(r => ({
                responseId: r._id,
                sessionId: r.sessionId,
                status: r.status,
                submittedAt: r.submittedAt,
                startedAt: r.startedAt,
                duration: r.startedAt && r.submittedAt ? (new Date(r.submittedAt).getTime() - new Date(r.startedAt).getTime()) / 1000 : null,
                ipAddress: r.ipAddress,
                userAgent: r.userAgent,
            })),
            questions: survey.questions.map(q => {
                const questionAnswers = answers.filter(a => a.questionId && String(a.questionId._id) === String(q._id));
                let aggregatedAnswers = {};
                // Simplified aggregation for example
                if (q.type === 'multiple-choice' || q.type === 'dropdown' || q.type === 'nps' || q.type === 'rating') {
                    aggregatedAnswers.optionsCount = {};
                    questionAnswers.forEach(ans => {
                        const key = ans.otherText ? `Other: ${ans.otherText}` : String(ans.answerValue);
                        aggregatedAnswers.optionsCount[key] = (aggregatedAnswers.optionsCount[key] || 0) + 1;
                    });
                } else if (q.type === 'checkbox') {
                     aggregatedAnswers.optionsCount = {};
                     questionAnswers.forEach(ans => {
                        ensureArray(ans.answerValue).forEach(val => {
                             const key = val === '__OTHER__' && ans.otherText ? `Other: ${ans.otherText}` : String(val);
                             aggregatedAnswers.optionsCount[key] = (aggregatedAnswers.optionsCount[key] || 0) + 1;
                        });
                     });
                } else {
                    aggregatedAnswers.raw = questionAnswers.map(a => ({
                        value: a.answerValue,
                        other: a.otherText,
                        sessionId: a.sessionId
                    }));
                }
                return {
                    questionId: q._id,
                    text: q.text, // Use 'text' from Question model
                    type: q.type,
                    order: q.order,
                    responsesCount: questionAnswers.length,
                    answers: aggregatedAnswers,
                };
            }),
        };
        res.status(200).json({ success: true, data: results });
    } catch (error) {
        console.error(`[getSurveyResults] Error fetching results for survey ${surveyId}:`, error);
        res.status(500).json({ success: false, message: 'Error fetching survey results.' });
    }
};

// @desc    Export survey results as CSV
// @route   GET /api/surveys/:surveyId/export
// @access  Private (Owner or Admin)
exports.exportSurveyResults = async (req, res) => {
    const { surveyId } = req.params;
    const { collectorId } = req.query;

    if (!mongoose.Types.ObjectId.isValid(surveyId)) {
        return res.status(400).json({ success: false, message: 'Invalid Survey ID.' });
    }

    try {
        const survey = await Survey.findById(surveyId).populate({
            path: 'questions',
            options: { sort: { order: 1 } }
        });

        if (!survey) {
            return res.status(404).json({ success: false, message: 'Survey not found.' });
        }
        if (String(survey.createdBy) !== String(req.user.id) && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Not authorized to export these results.' });
        }

        const responseQueryConditions = {
            survey: surveyId,
            status: { $in: ['completed', 'disqualified'] }
        };
        if (collectorId && mongoose.Types.ObjectId.isValid(collectorId)) {
            responseQueryConditions.collector = collectorId;
        }
        const responses = await Response.find(responseQueryConditions)
            .sort({ submittedAt: 1 })
            .lean();

        if (responses.length === 0) {
            return res.status(404).json({ success: false, message: 'No responses found for export criteria.' });
        }

        const sessionIds = responses.map(r => r.sessionId);
        const allAnswersForResponses = await Answer.find({ surveyId: survey._id, sessionId: { $in: sessionIds } }).lean();

        const fields = [
            { label: 'Response ID', value: 'responseId' },
            { label: 'Session ID', value: 'sessionId' },
            { label: 'Status', value: 'status' },
            { label: 'Started At', value: 'startedAt' },
            { label: 'Submitted At', value: 'submittedAt' },
            { label: 'Duration (seconds)', value: 'duration' },
            { label: 'IP Address', value: 'ipAddress' },
            { label: 'User Agent', value: 'userAgent' },
        ];

        survey.questions.forEach(q => {
            fields.push({ label: `${q.text || `Q${q.order + 1}`} (ID: ${q._id})`, value: `q_${q._id}` }); // Use q.text
            // Check addOtherOption from question model
            if (q.addOtherOption) {
                 fields.push({ label: `${q.text || `Q${q.order + 1}`} - Other Text`, value: `q_${q._id}_other` });
            }
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
                    if (q.addOtherOption) { // Check addOtherOption from question model
                        row[`q_${q._id}_other`] = answer.otherText || '';
                    }
                } else {
                    row[`q_${q._id}`] = '';
                    if (q.addOtherOption) {
                        row[`q_${q._id}_other`] = '';
                    }
                }
            });
            return row;
        });

        const json2csvParser = new Parser({ fields, delimiter: ',', header: true });
        const csv = json2csvParser.parse(csvData);

        res.header('Content-Type', 'text/csv');
        res.attachment(`survey_${surveyId}_results_${new Date().toISOString().split('T')[0]}.csv`); // Add date to filename
        res.send(csv);

    } catch (error) {
        console.error(`[exportSurveyResults] Error exporting results for survey ${surveyId}:`, error);
        if (!res.headersSent) {
            res.status(500).json({ success: false, message: 'Error exporting survey results.' });
        }
    }
};
// ----- END OF COMPLETE MODIFIED FILE (vNext - Fixed startedAt conflict) -----