// backend/controllers/surveyController.js
// ----- START OF COMPLETE MODIFIED FILE -----
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
    const profiles = [];
    // Example: For two attributes with two levels each
    // Attribute 1: Color (Red, Blue), Attribute 2: Size (Small, Large)
    // Profiles: (Red, Small), (Red, Large), (Blue, Small), (Blue, Large)
    // A real implementation would use a combinatorial algorithm.
    // For now, let's assume a simple structure if needed for placeholder.
    // This function needs to be properly implemented based on conjoint requirements.
    console.warn("[generateConjointProfiles] Placeholder function used. Needs full implementation.");
    return profiles;
};

// --- Helper Function for CSV Export (used in exportSurveyResults) ---
const CSV_SEPARATOR = '; '; // Using semicolon as it's common in some regions
const formatValueForCsv = (value, questionType, otherTextValue) => {
    if (value === null || value === undefined) return '';

    switch (questionType) {
        case 'multiple_choice_single':
        case 'dropdown':
        case 'nps':
        case 'rating_scale':
        case 'slider':
            if (typeof value === 'object' && value !== null && value.option) {
                let displayValue = value.option;
                if (value.isOther && otherTextValue) {
                    displayValue += `${CSV_SEPARATOR}Other: ${otherTextValue}`;
                }
                return displayValue;
            }
            return String(value); // Fallback for simple values

        case 'multiple_choice_multiple':
            if (Array.isArray(value) && value.length > 0) {
                const options = value.map(v => v.option).join(CSV_SEPARATOR);
                const otherOption = value.find(v => v.isOther);
                if (otherOption && otherTextValue) {
                    return `${options}${CSV_SEPARATOR}Other: ${otherTextValue}`;
                }
                return options;
            }
            return '';

        case 'matrix_single':
        case 'matrix_multiple':
            if (typeof value === 'object' && value !== null) {
                return Object.entries(value)
                    .map(([row, colValue]) => {
                        if (Array.isArray(colValue)) return `${row}: ${colValue.join(', ')}`; // For matrix_multiple
                        return `${row}: ${colValue}`; // For matrix_single
                    })
                    .join(CSV_SEPARATOR);
            }
            return '';
        
        case 'date':
            try {
                return new Date(value).toLocaleDateString('en-CA'); // YYYY-MM-DD for better sorting in CSV
            } catch (e) {
                return String(value); // Fallback
            }

        case 'file_upload':
            if (Array.isArray(value)) {
                return value.map(file => file.url || file.name).join(CSV_SEPARATOR);
            }
            if (typeof value === 'object' && value !== null) {
                return value.url || value.name || '';
            }
            return '';

        default:
            if (Array.isArray(value)) return value.join(CSV_SEPARATOR);
            if (typeof value === 'object' && value !== null) return JSON.stringify(value);
            return String(value);
    }
};

// --- Controller Functions ---

// @desc    Get all surveys for the logged-in user (or all if admin)
// @route   GET /api/surveys
// @access  Private (User or Admin)
exports.getAllSurveys = async (req, res) => {
    const requestStartTime = Date.now();
    // Using optional chaining for req.user properties as a safeguard
    console.log(`[${new Date().toISOString()}] [getAllSurveys] Entered. User ID: ${req.user?.id}, Role: ${req.user?.role}`);

    try {
        const filter = {};
        // Ensure req.user and req.user.id are present before trying to use them
        if (req.user && req.user.id) {
            filter.createdBy = req.user.id;
            // If the user is an admin, remove the createdBy filter to fetch all surveys
            if (req.user.role === 'admin') {
                delete filter.createdBy;
            }
        } else {
            // This case should ideally be caught by the 'protect' middleware.
            // If it's reached, it indicates an issue with auth middleware or route setup.
            console.error(`[${new Date().toISOString()}] [getAllSurveys] CRITICAL: req.user or req.user.id is undefined. This should be handled by authentication middleware.`);
            // Do not proceed with a potentially incorrect filter.
            // Send an unauthorized error as the user context is missing.
            return res.status(401).json({ success: false, message: "Authentication details missing or invalid." });
        }

        console.log(`[${new Date().toISOString()}] [getAllSurveys] Using filter: ${JSON.stringify(filter)}`);

        console.log(`[${new Date().toISOString()}] [getAllSurveys] About to execute Survey.find().`);
        const queryStartTime = Date.now();

        // Fetch surveys, excluding heavyweight fields for the list view
        const surveys = await Survey.find(filter)
            .select('-questions -globalSkipLogic -settings -randomizationLogic -collectors') // Exclude fields not needed for list view
            .sort({ createdAt: -1 }); // Sort by creation date, newest first

        const queryEndTime = Date.now();
        console.log(`[${new Date().toISOString()}] [getAllSurveys] Survey.find() executed in ${queryEndTime - queryStartTime}ms. Found ${surveys ? surveys.length : 'null/undefined'} surveys.`);

        if (!surveys) {
            // This case (surveys being null/undefined after a successful query without error) is unusual for Survey.find()
            // which typically returns an empty array if no documents match.
            // However, good to log if it ever occurs.
            console.error(`[${new Date().toISOString()}] [getAllSurveys] Surveys array is unexpectedly null or undefined AFTER query execution without an error.`);
            if (!res.headersSent) {
                return res.status(500).json({ success: false, message: "Error fetching surveys: Data became unavailable post-query." });
            }
            return; // Exit if headers sent
        }
        
        console.log(`[${new Date().toISOString()}] [getAllSurveys] Attempting to send response with ${surveys.length} surveys.`);
        if (!res.headersSent) {
            res.status(200).json({ success: true, count: surveys.length, data: surveys });
            console.log(`[${new Date().toISOString()}] [getAllSurveys] Response sent successfully. Total request time: ${Date.now() - requestStartTime}ms.`);
        } else {
            console.warn(`[${new Date().toISOString()}] [getAllSurveys] Headers already sent, cannot send survey data response. This indicates a prior response was already sent for this request.`);
        }

    } catch (error) {
        console.error(`[${new Date().toISOString()}] [getAllSurveys] CRITICAL ERROR during survey fetching. Total request time: ${Date.now() - requestStartTime}ms. Error Name: ${error.name}, Message: ${error.message}`);
        console.error(`[${new Date().toISOString()}] [getAllSurveys] Error Stack:`, error.stack);
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
            title: title || 'Untitled Survey', // Default title
            description,
            category,
            createdBy: req.user.id, // Set the creator from the authenticated user
            status: 'draft', // Default status
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

// @desc    Get a single survey by ID (including its questions and other details)
// @route   GET /api/surveys/:surveyId
// @access  Private (Owner or Admin for full details, potentially Public for active survey structure)
exports.getSurveyById = async (req, res) => {
    const { surveyId } = req.params;
    const { forTaking, collectorId } = req.query; // forTaking flag to get survey structure for respondent

    if (!mongoose.Types.ObjectId.isValid(surveyId)) {
        return res.status(400).json({ success: false, message: 'Invalid Survey ID.' });
    }

    try {
        let surveyQuery = Survey.findById(surveyId);

        if (forTaking === 'true') {
            // For respondents, only select fields necessary for taking the survey
            // and populate questions with only necessary fields.
            surveyQuery = surveyQuery
                .select('title description welcomeMessage thankYouMessage status questions settings.surveyWide.allowRetakes settings.surveyWide.showProgressBar settings.surveyWide.customCSS globalSkipLogic randomizationLogic')
                .populate({
                    path: 'questions',
                    select: '-surveyId -createdBy -updatedAt -__v -analytics', // Exclude sensitive/unnecessary fields for respondent
                    options: { sort: { order: 1 } } // Ensure questions are sorted by their order
                });
        } else {
            // For admin/owner view, populate everything needed for building/managing
            surveyQuery = surveyQuery.populate({
                path: 'questions',
                options: { sort: { order: 1 } }
            }).populate('collectors'); // Populate collectors for admin view
        }

        const survey = await surveyQuery;

        if (!survey) {
            return res.status(404).json({ success: false, message: 'Survey not found.' });
        }

        // Authorization Check:
        // If not forTaking, ensure user is owner or admin
        if (forTaking !== 'true' && String(survey.createdBy) !== String(req.user.id) && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'You are not authorized to view this survey\'s details.' });
        }

        // If forTaking, check survey status and collector status (if collectorId provided)
        if (forTaking === 'true') {
            if (survey.status !== 'active' && survey.status !== 'draft') { // Allow 'draft' for preview
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
                if (collector.status !== 'open') {
                     return res.status(403).json({ success: false, message: `This survey link is currently ${collector.status}.` });
                }
                // Password check for web_link collectors
                if (collector.type === 'web_link' && collector.settings?.web_link?.enablePassword) {
                    const providedPassword = req.headers['x-survey-password']; // Or from req.body if preferred
                    if (!providedPassword || providedPassword !== collector.settings.web_link.password) {
                        // If password is required but not provided or incorrect
                        // We send a specific status/body that the frontend can use to prompt for password
                        return res.status(401).json({ success: false, message: 'Password required for this survey link.', requiresPassword: true });
                    }
                }
            }
        }
        
        // If any question is of type 'conjoint_analysis', generate profiles
        // This is a simplified approach. A real conjoint setup would be more involved.
        if (survey.questions && survey.questions.some(q => q.type === 'conjoint_analysis')) {
            survey.questions = survey.questions.map(q => {
                if (q.type === 'conjoint_analysis' && q.content && q.content.attributes) {
                    const profiles = generateConjointProfiles(q.content.attributes);
                    // Return a new object to avoid directly modifying the Mongoose document if it's not lean
                    return { ...q.toObject(), content: { ...q.content, generatedProfiles: profiles } };
                }
                return q;
            });
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
    const updates = req.body; // Contains fields to update, e.g., title, description, questions array, settings, status

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

        // Authorization: Only owner or admin can update
        if (String(survey.createdBy) !== String(req.user.id) && req.user.role !== 'admin') {
            await session.abortTransaction(); session.endSession();
            return res.status(403).json({ success: false, message: 'You are not authorized to update this survey.' });
        }

        // Handle question updates (creation, modification, deletion)
        if (updates.questions && Array.isArray(updates.questions)) {
            const existingQuestionIds = survey.questions.map(id => String(id));
            const incomingQuestionIds = [];
            const questionUpdateOperations = [];

            for (const qData of updates.questions) {
                if (qData._id && mongoose.Types.ObjectId.isValid(qData._id)) { // Existing question
                    incomingQuestionIds.push(String(qData._id));
                    questionUpdateOperations.push(
                        Question.updateOne({ _id: qData._id, surveyId: survey._id }, { $set: qData }, { session })
                    );
                } else { // New question
                    const newQuestion = new Question({ ...qData, surveyId: survey._id, createdBy: req.user.id });
                    // await newQuestion.save({ session }); // Save and get ID
                    // incomingQuestionIds.push(String(newQuestion._id));
                    // Instead of saving one by one, let's prepare for bulk insert or rely on survey update
                    // For simplicity here, we'll assume Question documents are managed separately or IDs are provided.
                    // A more robust approach would handle question creation and linking here.
                    // For now, if _id is missing, we assume it's a new question to be added to survey.questions array by ID.
                    // This part needs refinement based on how frontend sends new vs existing questions.
                    // Let's assume frontend sends new questions without _id, and we create them.
                    const savedNewQ = await new Question({ ...qData, surveyId: survey._id, createdBy: req.user.id }).save({ session });
                    incomingQuestionIds.push(String(savedNewQ._id));
                }
            }
            
            // Questions to delete: in existingQuestionIds but not in incomingQuestionIds
            const questionsToDelete = existingQuestionIds.filter(id => !incomingQuestionIds.includes(id));
            if (questionsToDelete.length > 0) {
                questionUpdateOperations.push(Question.deleteMany({ _id: { $in: questionsToDelete }, surveyId: survey._id }, { session }));
                // Also remove answers associated with these questions
                questionUpdateOperations.push(Answer.deleteMany({ questionId: { $in: questionsToDelete }, surveyId: survey._id }, { session }));
            }
            
            if (questionUpdateOperations.length > 0) {
                await Promise.all(questionUpdateOperations);
            }
            // Update survey's question array with the new order/set of question IDs
            survey.questions = incomingQuestionIds; // Assuming incomingQuestionIds are valid ObjectIds
            delete updates.questions; // Remove questions from updates object as they are handled
        }

        // Apply other updates to the survey document
        Object.keys(updates).forEach(key => {
            // Prevent direct modification of sensitive fields like createdBy or _id
            if (key !== '_id' && key !== 'createdBy' && key !== 'questions') {
                 survey[key] = updates[key];
            }
        });
        
        survey.updatedAt = Date.now();
        const updatedSurvey = await survey.save({ session });

        await session.commitTransaction();
        session.endSession();

        // Re-populate questions for the response
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

// @desc    Delete a survey (and its associated questions and answers)
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

        // Authorization: Only owner or admin can delete
        if (String(survey.createdBy) !== String(req.user.id) && req.user.role !== 'admin') {
            await session.abortTransaction(); session.endSession();
            return res.status(403).json({ success: false, message: 'You are not authorized to delete this survey.' });
        }

        // Delete associated data
        await Question.deleteMany({ surveyId: survey._id }, { session });
        await Answer.deleteMany({ surveyId: survey._id }, { session });
        await Collector.deleteMany({ survey: survey._id }, { session });
        await Response.deleteMany({ survey: survey._id }, { session }); // Delete Response documents

        // Delete the survey itself
        await Survey.deleteOne({ _id: survey._id }, { session }); // Use deleteOne

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
    const sessionIdToUse = payloadSessionId || (answersPayload[0]?.sessionId);
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
        if (survey.status !== 'active' && survey.status !== 'draft') {
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

        if (collector.status !== 'open') {
            await session.abortTransaction(); session.endSession();
            return res.status(400).json({ success: false, message: `This survey link is currently ${collector.status}.` });
        }
        const now = new Date();
        const webLinkSettings = collector.settings?.web_link;
        if (webLinkSettings?.openDate && new Date(webLinkSettings.openDate) > now) {
            await session.abortTransaction(); session.endSession();
            return res.status(400).json({ success: false, message: 'This survey is not yet open.' });
        }
        if (webLinkSettings?.closeDate && new Date(webLinkSettings.closeDate) < now) {
            await session.abortTransaction(); session.endSession();
            return res.status(400).json({ success: false, message: 'This survey has closed.' });
        }
        if (webLinkSettings?.maxResponses && collector.responseCount >= webLinkSettings.maxResponses) {
            await session.abortTransaction(); session.endSession();
            return res.status(400).json({ success: false, message: 'This survey has reached its maximum response limit.' });
        }

        if (collector.type === 'web_link' && webLinkSettings?.enableRecaptcha) {
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
            if (questionIdsInPayload.has(String(item.questionId))) {
                const idx = answersToUpsert.findIndex(a => String(a.questionId) === String(item.questionId));
                if (idx > -1) answersToUpsert.splice(idx, 1);
            }
            questionIdsInPayload.add(String(item.questionId));
            answersToUpsert.push({
                surveyId,
                questionId: item.questionId,
                sessionId: sessionIdToUse,
                answerValue: item.answerValue,
                otherText: item.otherText || null,
                collectorId: collector._id
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

        const responseData = {
            survey: surveyId,
            collector: collectorId,
            sessionId: sessionIdToUse,
            status: 'completed',
            submittedAt: new Date(),
            lastActivityAt: new Date(),
        };
        if (clientStartedAt && !isNaN(new Date(clientStartedAt).getTime())) {
            responseData.startedAt = new Date(clientStartedAt);
        }
        
        if (!webLinkSettings?.anonymousResponses) {
            responseData.ipAddress = req.ip;
            responseData.userAgent = req.headers['user-agent'];
        } else {
            responseData.ipAddress = undefined;
            responseData.userAgent = undefined;
        }
        
        const updatedResponse = await Response.findOneAndUpdate(
            { survey: surveyId, collector: collectorId, sessionId: sessionIdToUse },
            { $set: responseData, $setOnInsert: { startedAt: responseData.startedAt || new Date() } },
            { new: true, upsert: true, runValidators: true, session }
        );
        console.log(`[submitSurveyAnswers] Response document upserted/updated: ${updatedResponse._id}`);

        collector.responseCount += 1;
        if (webLinkSettings?.maxResponses && collector.responseCount >= webLinkSettings.maxResponses) {
            collector.status = 'completed_quota';
        }
        await collector.save({ session });

        await session.commitTransaction();
        console.log(`[submitSurveyAnswers] Transaction committed for session ${sessionIdToUse}.`);

        let triggeredAction = null;
        if (survey.globalSkipLogic?.length > 0 && survey.questions) {
            const allSessionAnswers = await Answer.find({ surveyId, sessionId: sessionIdToUse }).lean();
            triggeredAction = evaluateAllLogic(survey.globalSkipLogic, allSessionAnswers, survey.questions);
            if (triggeredAction?.type === 'disqualifyRespondent') {
                await Response.updateOne({ _id: updatedResponse._id }, { $set: { status: 'disqualified' } });
                return res.status(200).json({ success: true, message: triggeredAction.disqualificationMessage || 'Disqualified.', action: triggeredAction, sessionId: sessionIdToUse, responseId: updatedResponse._id });
            }
        }
        
        res.status(201).json({ success: true, message: 'Answers submitted successfully.', sessionId: sessionIdToUse, responseId: updatedResponse._id, action: triggeredAction });

    } catch (error) {
        console.error(`[submitSurveyAnswers] Error during submission for survey ${surveyId}, session ${sessionIdToUse}:`, error);
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        if (!res.headersSent) {
            if (error.name === 'ValidationError') return res.status(400).json({ success: false, message: 'Validation Error.', details: error.errors });
            if (error.code === 11000) {
                 return res.status(409).json({ success: false, message: 'Duplicate submission detected or session conflict.', details: error.keyValue });
            }
            res.status(500).json({ success: false, message: 'Error submitting answers.' });
        }
    } finally {
        if (session.hasEnded === false) {
            session.endSession();
        }
    }
};

// @desc    Get survey results (aggregated answers)
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
                options: { sort: { order: 1 } } // Ensure questions are sorted
            });

        if (!survey) {
            return res.status(404).json({ success: false, message: 'Survey not found.' });
        }
        // Authorization (ensure user owns survey or is admin)
        if (String(survey.createdBy) !== String(req.user.id) && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Not authorized to view these results.' });
        }

        // Fetch all 'completed' and 'disqualified' responses for this survey
        // We might want to filter by collectorId if that's a requirement later
        const responses = await Response.find({ survey: surveyId, status: { $in: ['completed', 'disqualified'] } })
            .select('sessionId status submittedAt startedAt ipAddress userAgent customVariables'); // Select relevant fields from Response

        const responseIds = responses.map(r => r._id); // If you store responseId in Answer
        const sessionIds = responses.map(r => r.sessionId);

        // Fetch all answers associated with these valid sessions
        const answers = await Answer.find({ surveyId: survey._id, sessionId: { $in: sessionIds } })
            .populate('questionId', 'title type content.options content.rows content.columns'); // Populate question details for context

        // --- Aggregate Results ---
        // This is a basic aggregation. More complex analysis might be needed.
        const results = {
            surveyTitle: survey.title,
            totalResponses: responses.length, // Count of completed/disqualified Response documents
            responsesSummary: responses.map(r => ({ // Summary of each response document
                responseId: r._id,
                sessionId: r.sessionId,
                status: r.status,
                submittedAt: r.submittedAt,
                startedAt: r.startedAt,
                duration: r.startedAt && r.submittedAt ? (new Date(r.submittedAt).getTime() - new Date(r.startedAt).getTime()) / 1000 : null, // in seconds
                ipAddress: r.ipAddress, // Will be undefined if anonymous
                userAgent: r.userAgent, // Will be undefined if anonymous
                // customVariables: r.customVariables,
            })),
            questions: survey.questions.map(q => {
                const questionAnswers = answers.filter(a => String(a.questionId?._id) === String(q._id));
                // Further aggregation per question type can be done here
                // For example, counting occurrences of each option for multiple choice
                let aggregatedAnswers = {};
                if (q.type === 'multiple_choice_single' || q.type === 'dropdown' || q.type === 'nps' || q.type === 'rating_scale') {
                    aggregatedAnswers.optionsCount = {};
                    questionAnswers.forEach(ans => {
                        const key = ans.answerValue?.option || String(ans.answerValue); // Handle object or direct value
                        aggregatedAnswers.optionsCount[key] = (aggregatedAnswers.optionsCount[key] || 0) + 1;
                        if (ans.answerValue?.isOther && ans.otherText) {
                            const otherKey = `Other: ${ans.otherText}`;
                            aggregatedAnswers.optionsCount[otherKey] = (aggregatedAnswers.optionsCount[otherKey] || 0) + 1;
                        }
                    });
                } else {
                    // For other types, just list the raw answers for now
                    aggregatedAnswers.raw = questionAnswers.map(a => ({
                        value: a.answerValue,
                        other: a.otherText,
                        sessionId: a.sessionId
                    }));
                }
                return {
                    questionId: q._id,
                    title: q.title,
                    type: q.type,
                    order: q.order,
                    responsesCount: questionAnswers.length, // Number of answers for this question
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
    const { collectorId } = req.query; // Optional: filter by collector

    if (!mongoose.Types.ObjectId.isValid(surveyId)) {
        return res.status(400).json({ success: false, message: 'Invalid Survey ID.' });
    }

    try {
        const survey = await Survey.findById(surveyId).populate({
            path: 'questions',
            options: { sort: { order: 1 } } // Ensure questions are sorted for consistent column order
        });

        if (!survey) {
            return res.status(404).json({ success: false, message: 'Survey not found.' });
        }
        if (String(survey.createdBy) !== String(req.user.id) && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Not authorized to export these results.' });
        }

        // --- Fetch Response Documents ---
        const responseQueryConditions = {
            survey: surveyId,
            status: { $in: ['completed', 'disqualified'] } // Include completed and disqualified
        };
        if (collectorId && mongoose.Types.ObjectId.isValid(collectorId)) {
            responseQueryConditions.collector = collectorId;
        }
        const responses = await Response.find(responseQueryConditions)
            .sort({ submittedAt: 1 }) // Oldest first
            .lean(); // Use .lean() for performance with large datasets

        if (responses.length === 0) {
            return res.status(404).json({ success: false, message: 'No responses found for export criteria.' });
        }

        const sessionIds = responses.map(r => r.sessionId);
        const allAnswersForResponses = await Answer.find({ surveyId: survey._id, sessionId: { $in: sessionIds } }).lean();

        // --- Prepare data for CSV ---
        const fields = [
            { label: 'Response ID', value: 'responseId' },
            { label: 'Session ID', value: 'sessionId' },
            { label: 'Status', value: 'status' },
            { label: 'Started At', value: 'startedAt' },
            { label: 'Submitted At', value: 'submittedAt' },
            { label: 'Duration (seconds)', value: 'duration' },
            { label: 'IP Address', value: 'ipAddress' },
            { label: 'User Agent', value: 'userAgent' },
            // { label: 'Custom Var 1', value: 'customVariables.var1' }, // Example for custom variables
        ];

        survey.questions.forEach(q => {
            fields.push({ label: `${q.title} (Q${q.order + 1})`, value: `q_${q._id}` });
            if (q.content?.hasOther) { // If question type might have an "Other" text field
                 fields.push({ label: `${q.title} (Q${q.order + 1}) - Other Text`, value: `q_${q._id}_other` });
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
                ipAddress: responseDoc.ipAddress || '', // Empty if anonymous
                userAgent: responseDoc.userAgent || '', // Empty if anonymous
            };
            // // Example for custom variables:
            // if (responseDoc.customVariables) {
            //     row['customVariables.var1'] = responseDoc.customVariables.var1 || '';
            // }

            const respondentAnswers = allAnswersForResponses.filter(ans => ans.sessionId === responseDoc.sessionId);

            survey.questions.forEach(q => {
                const answer = respondentAnswers.find(a => String(a.questionId) === String(q._id));
                if (answer) {
                    row[`q_${q._id}`] = formatValueForCsv(answer.answerValue, q.type, answer.otherText);
                    if (q.content?.hasOther) {
                        row[`q_${q._id}_other`] = answer.otherText || '';
                    }
                } else {
                    row[`q_${q._id}`] = ''; // No answer for this question
                    if (q.content?.hasOther) {
                        row[`q_${q._id}_other`] = '';
                    }
                }
            });
            return row;
        });

        const json2csvParser = new Parser({ fields, delimiter: ',', header: true });
        const csv = json2csvParser.parse(csvData);

        res.header('Content-Type', 'text/csv');
        res.attachment(`survey_${surveyId}_results.csv`);
        res.send(csv);

    } catch (error) {
        console.error(`[exportSurveyResults] Error exporting results for survey ${surveyId}:`, error);
        if (!res.headersSent) {
            res.status(500).json({ success: false, message: 'Error exporting survey results.' });
        }
    }
};
// ----- END OF COMPLETE MODIFIED FILE -----