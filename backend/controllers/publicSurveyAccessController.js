// backend/controllers/publicSurveyAccessController.js
// ----- START OF COMPLETE MODIFIED FILE (v1.3 - Implemented resumeSurveyWithCode) -----
const mongoose = require('mongoose');
const Collector = require('../models/Collector');
const Survey = require('../models/Survey');
const PartialResponse = require('../models/PartialResponse'); // +++ Added PartialResponse model
const Answer = require('../models/Answer'); // +++ Added Answer model for fetching saved answers

// --- Helper function to get common collector projection ---
const getCollectorProjection = () => {
    return 'survey status responseCount type ' + // Added 'type'
           'settings.web_link.customSlug ' +
           'settings.web_link.passwordProtectionEnabled ' +
           '+settings.web_link.password ' +
           'settings.web_link.openDate ' +
           'settings.web_link.closeDate ' +
           'settings.web_link.maxResponses ' +
           'settings.web_link.allowMultipleResponses ' +
           'settings.web_link.anonymousResponses ' +
           'settings.web_link.enableRecaptcha ' +
           'settings.web_link.saveAndContinueEnabled ' + // For collector-level override
           'settings.web_link.progressBarEnabled ' +
           'settings.web_link.progressBarStyle ' +
           'settings.web_link.progressBarPosition ' +
           'settings.web_link.allowBackButton ' +
           'settings.web_link.autoAdvance ' +
           'settings.web_link.questionNumberingEnabled';
};

// --- Helper function to derive collector settings for frontend ---
const deriveCollectorSettingsForFrontend = (collectorWebLinkSettings = {}, surveyBehaviorNavSettings = {}) => {
    return {
        allowMultipleResponses: collectorWebLinkSettings.allowMultipleResponses || false,
        anonymousResponses: collectorWebLinkSettings.anonymousResponses || false,
        enableRecaptcha: collectorWebLinkSettings.enableRecaptcha || false,
        // Check collector override first, then survey setting, then default to false
        allowResume: typeof collectorWebLinkSettings.saveAndContinueEnabled === 'boolean' 
            ? collectorWebLinkSettings.saveAndContinueEnabled 
            : (surveyBehaviorNavSettings.saveAndContinueEnabled || false),
        progressBarEnabled: typeof collectorWebLinkSettings.progressBarEnabled === 'boolean' 
            ? collectorWebLinkSettings.progressBarEnabled 
            : (surveyBehaviorNavSettings.progressBarEnabled || false),
        progressBarStyle: collectorWebLinkSettings.progressBarStyle || surveyBehaviorNavSettings.progressBarStyle || 'percentage',
        progressBarPosition: collectorWebLinkSettings.progressBarPosition || surveyBehaviorNavSettings.progressBarPosition || 'top',
        allowBackButton: typeof collectorWebLinkSettings.allowBackButton === 'boolean' 
            ? collectorWebLinkSettings.allowBackButton 
            : (surveyBehaviorNavSettings.allowBackButton !== undefined ? surveyBehaviorNavSettings.allowBackButton : true),
        autoAdvance: typeof collectorWebLinkSettings.autoAdvance === 'boolean' 
            ? collectorWebLinkSettings.autoAdvance 
            : (surveyBehaviorNavSettings.autoAdvance || false),
        questionNumberingEnabled: typeof collectorWebLinkSettings.questionNumberingEnabled === 'boolean' 
            ? collectorWebLinkSettings.questionNumberingEnabled 
            : (surveyBehaviorNavSettings.questionNumberingEnabled !== undefined ? surveyBehaviorNavSettings.questionNumberingEnabled : true),
    };
};


exports.accessSurvey = async (req, res) => {
    const { accessIdentifier } = req.params;
    const { password: enteredPassword } = req.body;

    console.log(`[PublicSurveyAccessController accessSurvey] Access attempt for identifier: "${accessIdentifier}"`);

    try {
        if (!accessIdentifier || typeof accessIdentifier !== 'string' || accessIdentifier.trim() === '') {
            return res.status(400).json({ success: false, message: 'Access identifier is missing or invalid.' });
        }

        let collector;
        const trimmedAccessIdentifier = accessIdentifier.trim();
        const collectorProjection = getCollectorProjection();
        const potentialSlug = trimmedAccessIdentifier.toLowerCase();

        console.log(`[PublicSurveyAccessController accessSurvey] Attempting lookup by customSlug: "${potentialSlug}"`);
        collector = await Collector.findOne({
            'settings.web_link.customSlug': potentialSlug,
            type: 'web_link'
        }).select(collectorProjection);

        if (!collector) {
            console.log(`[PublicSurveyAccessController accessSurvey] Not found by slug. Attempting lookup by linkId: "${trimmedAccessIdentifier}"`);
            collector = await Collector.findOne({
                linkId: trimmedAccessIdentifier,
                type: 'web_link'
            }).select(collectorProjection);
        }

        if (!collector) {
            console.log(`[PublicSurveyAccessController accessSurvey] Collector not found for identifier: "${trimmedAccessIdentifier}"`);
            return res.status(404).json({ success: false, message: 'Survey link not found or invalid.' });
        }
        
        console.log(`[PublicSurveyAccessController accessSurvey] Found collector ID: ${collector._id} via identifier "${trimmedAccessIdentifier}"`);

        const survey = await Survey.findById(collector.survey)
            .select('status title settings.behaviorNavigation settings.display') // settings.display might not exist, adjust if needed
            .lean();

        if (!survey) {
            console.error(`[PublicSurveyAccessController accessSurvey] CRITICAL: Collector ${collector._id} has survey ID ${collector.survey} but survey not found in DB.`);
            return res.status(404).json({ success: false, message: 'Associated survey data not found.' });
        }
        console.log(`[PublicSurveyAccessController accessSurvey] Associated survey ID: ${survey._id}, Title: "${survey.title}"`);

        const webLinkSettings = collector.settings && collector.settings.web_link ? collector.settings.web_link : {};

        if (collector.status !== 'open') {
            // ... (status check logic same as before) ...
            let message = 'This survey is not currently open for responses.';
            if (collector.status === 'draft') message = 'This survey link is currently in draft mode and not yet active.';
            else if (collector.status === 'paused') message = 'This survey link is temporarily paused.';
            else if (collector.status === 'closed') message = 'This survey link has been closed.';
            else if (collector.status === 'completed_quota') message = 'This survey has reached its response limit.';
            console.log(`[PublicSurveyAccessController accessSurvey] Collector ${collector._id} status is "${collector.status}". Access denied.`);
            return res.status(403).json({ success: false, message, collectorStatus: collector.status });
        }

        const now = new Date();
        if (webLinkSettings.openDate && new Date(webLinkSettings.openDate) > now) {
            // ... (openDate check logic same as before) ...
            console.log(`[PublicSurveyAccessController accessSurvey] Collector ${collector._id} is scheduled to open on ${new Date(webLinkSettings.openDate).toLocaleString()}. Access denied.`);
            return res.status(403).json({ success: false, message: `This survey link is scheduled to open on ${new Date(webLinkSettings.openDate).toLocaleString()}.`, collectorStatus: 'scheduled' });
        }
        
        if (webLinkSettings.closeDate && new Date(webLinkSettings.closeDate) < now) {
            // ... (closeDate check logic same as before) ...
            console.log(`[PublicSurveyAccessController accessSurvey] Collector ${collector._id} closed on ${new Date(webLinkSettings.closeDate).toLocaleString()}. Access denied.`);
            return res.status(403).json({ success: false, message: `This survey link closed on ${new Date(webLinkSettings.closeDate).toLocaleString()}.`, collectorStatus: 'closed_date' });
        }

        if (typeof webLinkSettings.maxResponses === 'number' && webLinkSettings.maxResponses > 0 && collector.responseCount >= webLinkSettings.maxResponses) {
            // ... (maxResponses check logic same as before, ensure maxResponses > 0 for limit) ...
            console.log(`[PublicSurveyAccessController accessSurvey] Collector ${collector._id} reached max responses (${collector.responseCount}/${webLinkSettings.maxResponses}). Access denied.`);
            return res.status(403).json({ success: false, message: 'This survey has reached its response limit.', collectorStatus: 'completed_quota' });
        }

        if (webLinkSettings.passwordProtectionEnabled && webLinkSettings.password) { 
            // ... (password check logic same as before) ...
            if (!enteredPassword) {
                console.log(`[PublicSurveyAccessController accessSurvey] Collector ${collector._id} requires password, none provided. Survey: "${survey.title}"`);
                return res.status(401).json({ success: false, message: 'This survey is password protected. Please provide a password.', requiresPassword: true, surveyTitle: survey.title || 'this survey' });
            }
            const isMatch = await collector.comparePassword(enteredPassword); // Make sure comparePassword is on Collector model
            if (!isMatch) {
                console.log(`[PublicSurveyAccessController accessSurvey] Incorrect password for collector ${collector._id}. Survey: "${survey.title}"`);
                return res.status(401).json({ success: false, message: 'Incorrect password.', requiresPassword: true, surveyTitle: survey.title || 'this survey' });
            }
            console.log(`[PublicSurveyAccessController accessSurvey] Password accepted for collector ${collector._id}.`);
        } else if (webLinkSettings.passwordProtectionEnabled && !webLinkSettings.password) {
            console.warn(`[PublicSurveyAccessController accessSurvey] Collector ${collector._id} has passwordProtectionEnabled but no password set. Allowing access.`);
        }

        if (survey.status !== 'active') { 
            // ... (survey status check logic same as before) ...
            let surveyMessage = `The underlying survey is currently ${survey.status}.`;
            if (survey.status === 'draft') surveyMessage = 'The underlying survey is still in draft mode.';
            else if (survey.status === 'archived') surveyMessage = 'The underlying survey has been archived.';
            console.log(`[PublicSurveyAccessController accessSurvey] Survey ${survey._id} status is "${survey.status}". Access denied.`);
            return res.status(403).json({ success: false, message: surveyMessage, surveyStatus: survey.status });
        }
        
        const collectorSettingsForFrontend = deriveCollectorSettingsForFrontend(webLinkSettings, survey.settings?.behaviorNavigation);

        if (collectorSettingsForFrontend.enableRecaptcha) {
            if (!process.env.RECAPTCHA_V2_SITE_KEY) {
                console.warn("[PublicSurveyAccessController accessSurvey] Warning: RECAPTCHA_V2_SITE_KEY is not set in the backend .env for public access reCAPTCHA site key.");
            }
        }
        
        console.log(`[PublicSurveyAccessController accessSurvey] Access granted for collector ${collector._id}. Sending settings to frontend:`, collectorSettingsForFrontend);

        res.status(200).json({
            success: true,
            data: {
                surveyId: survey._id.toString(),
                collectorId: collector._id.toString(),
                surveyTitle: survey.title,
                collectorSettings: collectorSettingsForFrontend 
            },
            message: "Survey access granted."
        });

    } catch (error) {
        console.error('[PublicSurveyAccessController accessSurvey] CRITICAL Error in accessSurvey:', error);
        if (error.name === 'MongoServerError' && error.code === 31249) {
             console.error('[PublicSurveyAccessController accessSurvey] MongoDB Path Collision Error Details:', error.errorResponse);
        }
        res.status(500).json({ success: false, message: 'Server error while trying to access the survey.' });
    }
};


// +++ NEW CONTROLLER FUNCTION for Resuming with Code +++
exports.resumeSurveyWithCode = async (req, res) => {
    const { accessIdentifier } = req.params;
    const { resumeCode } = req.body;

    console.log(`[PublicSurveyAccessController resumeSurveyWithCode] Attempt for identifier: "${accessIdentifier}" with code: "${resumeCode}"`);

    if (!accessIdentifier || typeof accessIdentifier !== 'string' || accessIdentifier.trim() === '') {
        return res.status(400).json({ success: false, message: 'Access identifier is missing or invalid.' });
    }
    if (!resumeCode || typeof resumeCode !== 'string' || resumeCode.trim() === '') {
        return res.status(400).json({ success: false, message: 'Resume code is missing or invalid.' });
    }

    try {
        let collector;
        const trimmedAccessIdentifier = accessIdentifier.trim();
        const collectorProjection = getCollectorProjection(); // Use helper
        const potentialSlug = trimmedAccessIdentifier.toLowerCase();

        // Find collector (same logic as accessSurvey)
        collector = await Collector.findOne({ 'settings.web_link.customSlug': potentialSlug, type: 'web_link' }).select(collectorProjection);
        if (!collector) {
            collector = await Collector.findOne({ linkId: trimmedAccessIdentifier, type: 'web_link' }).select(collectorProjection);
        }

        if (!collector) {
            console.log(`[PublicSurveyAccessController resumeSurveyWithCode] Collector not found for identifier: "${trimmedAccessIdentifier}"`);
            return res.status(404).json({ success: false, message: 'Survey link not found or invalid.' });
        }
        console.log(`[PublicSurveyAccessController resumeSurveyWithCode] Found collector ID: ${collector._id}`);

        const survey = await Survey.findById(collector.survey)
            .select('status title settings.behaviorNavigation settings.display') // Select fields needed for settings derivation
            .lean();

        if (!survey) {
            console.error(`[PublicSurveyAccessController resumeSurveyWithCode] CRITICAL: Collector ${collector._id} has survey ID ${collector.survey} but survey not found.`);
            return res.status(404).json({ success: false, message: 'Associated survey data not found.' });
        }
        console.log(`[PublicSurveyAccessController resumeSurveyWithCode] Associated survey ID: ${survey._id}, Title: "${survey.title}"`);

        // Basic checks for collector and survey status (similar to email resume in getSurveyById)
        if (collector.status !== 'open') {
            return res.status(403).json({ success: false, message: `This survey link is ${collector.status}. Cannot resume.` });
        }
        if (survey.status !== 'active') {
            return res.status(403).json({ success: false, message: `The underlying survey is currently ${survey.status}. Cannot resume.` });
        }
        
        // Survey and Collector settings for Save & Continue
        const surveyBehaviorNavSettings = survey.settings?.behaviorNavigation || {};
        const collectorWebLinkSettings = collector.settings?.web_link || {};
        
        const surveyAllowsSave = surveyBehaviorNavSettings.saveAndContinueEnabled || false;
        const collectorAllowsSave = typeof collectorWebLinkSettings.saveAndContinueEnabled === 'boolean' 
            ? collectorWebLinkSettings.saveAndContinueEnabled 
            : surveyAllowsSave; // Inherit from survey if not set on collector

        if (!collectorAllowsSave) {
            console.log(`[PublicSurveyAccessController resumeSurveyWithCode] Save and Continue is not enabled for this survey/collector. Collector: ${collector._id}, Survey: ${survey._id}`);
            return res.status(400).json({ success: false, message: 'Resume feature is not enabled for this survey link.' });
        }
        
        // Find and validate PartialResponse
        const partialResponseDoc = await PartialResponse.findOne({
            resumeToken: resumeCode.trim(),
            survey: survey._id,
            // Optionally, you might want to also match collector: collector._id if a code is strictly tied to one collector
        });

        if (!partialResponseDoc) {
            console.log(`[PublicSurveyAccessController resumeSurveyWithCode] Invalid or non-existent resume code: "${resumeCode}" for survey ${survey._id}`);
            return res.status(404).json({ success: false, message: 'Invalid or expired resume code.' });
        }
        if (partialResponseDoc.expiresAt < new Date()) {
            console.log(`[PublicSurveyAccessController resumeSurveyWithCode] Resume code "${resumeCode}" has expired.`);
            return res.status(410).json({ success: false, message: 'This resume code has expired.' });
        }
        if (partialResponseDoc.completedAt) {
            console.log(`[PublicSurveyAccessController resumeSurveyWithCode] Resume code "${resumeCode}" corresponds to an already completed session.`);
            return res.status(410).json({ success: false, message: 'This survey session has already been completed.' });
        }

        // Fetch answers for the partial response
        // This assumes answers are stored with sessionId from PartialResponse
        const answersFromDb = await Answer.find({ survey: survey._id, sessionId: partialResponseDoc.sessionId }).lean();
        const answersMap = {};
        const otherInputValuesMap = {};
        answersFromDb.forEach(ans => {
            answersMap[ans.questionId.toString()] = ans.answerValue;
            if (ans.otherText) {
                otherInputValuesMap[`${ans.questionId.toString()}_other`] = ans.otherText;
            }
        });
        
        const partialResponseForFrontend = {
            ...partialResponseDoc.toObject(), // Convert Mongoose doc to plain object
            answers: answersMap,
            otherInputValues: otherInputValuesMap,
        };
        // Remove sensitive fields if any before sending to frontend, e.g., _id of partialResponse if not needed
        // delete partialResponseForFrontend._id; // Or keep it if useful for frontend state

        const collectorSettingsForFrontend = deriveCollectorSettingsForFrontend(collectorWebLinkSettings, surveyBehaviorNavSettings);
        
        console.log(`[PublicSurveyAccessController resumeSurveyWithCode] Resume successful for code "${resumeCode}".`);
        res.status(200).json({
            success: true,
            data: {
                surveyId: survey._id.toString(),
                collectorId: collector._id.toString(), // The collector identified by accessIdentifier
                surveyTitle: survey.title,
                collectorSettings: collectorSettingsForFrontend,
                partialResponse: partialResponseForFrontend // Send the populated partial response
            },
            message: "Survey resumed successfully."
        });

    } catch (error) {
        console.error('[PublicSurveyAccessController resumeSurveyWithCode] CRITICAL Error:', error);
        res.status(500).json({ success: false, message: 'Server error while trying to resume the survey.' });
    }
};
// ----- END OF COMPLETE MODIFIED FILE (v1.3 - Implemented resumeSurveyWithCode) -----