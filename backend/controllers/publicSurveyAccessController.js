// backend/controllers/publicSurveyAccessController.js
// ----- START OF COMPLETE MODIFIED FILE (v1.4 - Enhanced Logging & Settings) -----
const mongoose = require('mongoose');
const Collector = require('../models/Collector');
const Survey = require('../models/Survey');
const PartialResponse = require('../models/PartialResponse');
const Answer = require('../models/Answer');

const getCollectorProjection = () => {
    return 'survey status responseCount type ' +
           'settings.web_link.customSlug ' +
           'settings.web_link.passwordProtectionEnabled ' +
           '+settings.web_link.password ' +
           'settings.web_link.openDate ' +
           'settings.web_link.closeDate ' +
           'settings.web_link.maxResponses ' +
           'settings.web_link.allowMultipleResponses ' +
           'settings.web_link.anonymousResponses ' +
           'settings.web_link.enableRecaptcha ' +
           'settings.web_link.saveAndContinueEnabled ' + 
           'settings.web_link.saveAndContinueMethod ' + // Added
           'settings.web_link.progressBarEnabled ' +
           'settings.web_link.progressBarStyle ' +
           'settings.web_link.progressBarPosition ' +
           'settings.web_link.allowBackButton ' +
           'settings.web_link.autoAdvance ' +
           'settings.web_link.questionNumberingEnabled ' +
           'settings.web_link.questionNumberingFormat ' + // Added
           'settings.web_link.questionNumberingCustomPrefix'; // Added
};

const deriveCollectorSettingsForFrontend = (collectorWebLinkSettings = {}, surveyBehaviorNavSettings = {}) => {
    return {
        allowMultipleResponses: collectorWebLinkSettings.allowMultipleResponses ?? surveyBehaviorNavSettings.allowMultipleResponses ?? false, // Default false if neither set
        anonymousResponses: collectorWebLinkSettings.anonymousResponses ?? surveyBehaviorNavSettings.anonymousResponses ?? false,
        enableRecaptcha: collectorWebLinkSettings.enableRecaptcha ?? false,
        allowResume: typeof collectorWebLinkSettings.saveAndContinueEnabled === 'boolean' 
            ? collectorWebLinkSettings.saveAndContinueEnabled 
            : (surveyBehaviorNavSettings.saveAndContinueEnabled || false),
        saveAndContinueMethod: collectorWebLinkSettings.saveAndContinueMethod || surveyBehaviorNavSettings.saveAndContinueMethod || 'both', // Default to 'both'
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
        questionNumberingFormat: collectorWebLinkSettings.questionNumberingFormat || surveyBehaviorNavSettings.questionNumberingFormat || '123',
        questionNumberingCustomPrefix: collectorWebLinkSettings.questionNumberingCustomPrefix || surveyBehaviorNavSettings.questionNumberingCustomPrefix || '',
    };
};

exports.accessSurvey = async (req, res) => {
    const { accessIdentifier } = req.params;
    const { password: enteredPassword } = req.body;
    console.log(`[PublicAccessCtrl accessSurvey] Identifier: "${accessIdentifier}"`);

    try {
        if (!accessIdentifier || typeof accessIdentifier !== 'string' || accessIdentifier.trim() === '') { return res.status(400).json({ success: false, message: 'Access identifier is missing or invalid.' }); }
        let collector; const trimmedAccessIdentifier = accessIdentifier.trim(); const collectorProjection = getCollectorProjection(); const potentialSlug = trimmedAccessIdentifier.toLowerCase();
        collector = await Collector.findOne({ 'settings.web_link.customSlug': potentialSlug, type: 'web_link' }).select(collectorProjection);
        if (!collector) collector = await Collector.findOne({ linkId: trimmedAccessIdentifier, type: 'web_link' }).select(collectorProjection);
        if (!collector) return res.status(404).json({ success: false, message: 'Survey link not found or invalid.' });
        
        const survey = await Survey.findById(collector.survey).select('status title settings.behaviorNavigation').lean(); // Removed settings.display
        if (!survey) { console.error(`[PublicAccessCtrl accessSurvey] CRITICAL: Collector ${collector._id} survey ${collector.survey} not found.`); return res.status(404).json({ success: false, message: 'Associated survey data not found.' }); }
        
        const webLinkSettings = collector.settings?.web_link || {};
        // ... (status, date, quota checks remain the same) ...
        if (collector.status !== 'open') { /* ... */ return res.status(403).json({ success: false, message: `This survey is ${collector.status}.`, collectorStatus: collector.status });}
        const now = new Date();
        if (webLinkSettings.openDate && new Date(webLinkSettings.openDate) > now) { /* ... */ return res.status(403).json({ success: false, message: `Survey opens ${new Date(webLinkSettings.openDate).toLocaleString()}.`, collectorStatus: 'scheduled' });}
        if (webLinkSettings.closeDate && new Date(webLinkSettings.closeDate) < now) { /* ... */ return res.status(403).json({ success: false, message: `Survey closed ${new Date(webLinkSettings.closeDate).toLocaleString()}.`, collectorStatus: 'closed_date' });}
        if (typeof webLinkSettings.maxResponses === 'number' && webLinkSettings.maxResponses > 0 && collector.responseCount >= webLinkSettings.maxResponses) { /* ... */ return res.status(403).json({ success: false, message: 'Survey reached response limit.', collectorStatus: 'completed_quota' });}


        if (webLinkSettings.passwordProtectionEnabled && webLinkSettings.password) { 
            if (!enteredPassword) {
                // Return survey settings even when password is required for PublicSurveyHandler initial check
                const surveySettingsForHandler = survey.settings?.behaviorNavigation || { saveAndContinueMethod: 'both' }; // Default if not set
                return res.status(401).json({ 
                    success: false, message: 'This survey is password protected.', 
                    requiresPassword: true, 
                    surveyTitle: survey.title || 'this survey',
                    surveySettings: { behaviorNavigation: surveySettingsForHandler } // Pass settings
                });
            }
            const isMatch = await collector.comparePassword(enteredPassword);
            if (!isMatch) { return res.status(401).json({ success: false, message: 'Incorrect password.', requiresPassword: true, surveyTitle: survey.title || 'this survey' }); }
        }
        if (survey.status !== 'active') { return res.status(403).json({ success: false, message: `The survey is ${survey.status}.`, surveyStatus: survey.status }); }
        
        const collectorSettingsForFrontend = deriveCollectorSettingsForFrontend(webLinkSettings, survey.settings?.behaviorNavigation);
        const surveySettingsForHandler = survey.settings?.behaviorNavigation || { saveAndContinueMethod: 'both' }; // For initial check

        console.log(`[PublicAccessCtrl accessSurvey] Access granted for collector ${collector._id}.`);
        res.status(200).json({
            success: true,
            data: {
                surveyId: survey._id.toString(), collectorId: collector._id.toString(),
                surveyTitle: survey.title,
                collectorSettings: collectorSettingsForFrontend, // For SurveyTakingPage
                surveySettings: { behaviorNavigation: surveySettingsForHandler } // For PublicSurveyHandler initial check
            },
            message: "Survey access granted."
        });
    } catch (error) { console.error('[PublicAccessCtrl accessSurvey] CRITICAL Error:', error); res.status(500).json({ success: false, message: 'Server error while trying to access the survey.' }); }
};

exports.resumeSurveyWithCode = async (req, res) => {
    const { accessIdentifier } = req.params;
    const { resumeCode } = req.body;
    console.log(`[PublicAccessCtrl resumeSurveyWithCode] Identifier: "${accessIdentifier}", Code: "${resumeCode}"`);

    if (!accessIdentifier || !resumeCode) { return res.status(400).json({ success: false, message: 'Access identifier and resume code are required.' }); }
    try {
        let collector; /* ... find collector (same as accessSurvey) ... */
        const trimmedAccessIdentifier = accessIdentifier.trim(); const collectorProjection = getCollectorProjection(); const potentialSlug = trimmedAccessIdentifier.toLowerCase();
        collector = await Collector.findOne({ 'settings.web_link.customSlug': potentialSlug, type: 'web_link' }).select(collectorProjection);
        if (!collector) collector = await Collector.findOne({ linkId: trimmedAccessIdentifier, type: 'web_link' }).select(collectorProjection);
        if (!collector) return res.status(404).json({ success: false, message: 'Survey link not found.' });
        
        const survey = await Survey.findById(collector.survey).select('status title settings.behaviorNavigation').lean();
        if (!survey) { return res.status(404).json({ success: false, message: 'Associated survey not found.' }); }

        if (collector.status !== 'open' || survey.status !== 'active') { return res.status(403).json({ success: false, message: 'Survey or link not active.' }); }
        
        const surveyBehaviorNavSettings = survey.settings?.behaviorNavigation || {};
        const collectorWebLinkSettings = collector.settings?.web_link || {};
        const effectiveSaveEnabled = collectorWebLinkSettings.saveAndContinueEnabled ?? surveyBehaviorNavSettings.saveAndContinueEnabled ?? false;
        const effectiveSaveMethod = collectorWebLinkSettings.saveAndContinueMethod || surveyBehaviorNavSettings.saveAndContinueMethod || 'both';

        if (!effectiveSaveEnabled || (effectiveSaveMethod !== 'code' && effectiveSaveMethod !== 'both')) {
            return res.status(400).json({ success: false, message: 'Resume with code is not enabled for this survey.' });
        }
        
        const partialResponseDoc = await PartialResponse.findOne({ resumeToken: resumeCode.trim(), survey: survey._id });
        if (!partialResponseDoc) { return res.status(404).json({ success: false, message: 'Invalid or expired resume code.' }); }
        if (partialResponseDoc.expiresAt < new Date()) { return res.status(410).json({ success: false, message: 'Resume code has expired.' }); }
        if (partialResponseDoc.completedAt) { return res.status(410).json({ success: false, message: 'Session already completed.' }); }

        console.log(`[PublicAccessCtrl resumeSurveyWithCode] Found partialDoc: ${partialResponseDoc._id}, sessionId: ${partialResponseDoc.sessionId}. Fetching answers...`);
        const answersFromDb = await Answer.find({ survey: survey._id, sessionId: partialResponseDoc.sessionId }).lean();
        console.log(`[PublicAccessCtrl resumeSurveyWithCode] Found ${answersFromDb.length} answer documents for sessionId ${partialResponseDoc.sessionId}.`);
        
        const answersMap = {}; const otherInputValuesMap = {};
        answersFromDb.forEach(ans => {
            console.log(`[PublicAccessCtrl resumeSurveyWithCode] Mapping answer for qId ${ans.questionId}:`, ans.answerValue);
            answersMap[ans.questionId.toString()] = ans.answerValue;
            if (ans.otherText) otherInputValuesMap[`${ans.questionId.toString()}_other`] = ans.otherText;
        });
        console.log(`[PublicAccessCtrl resumeSurveyWithCode] Constructed answersMap:`, answersMap);
        console.log(`[PublicAccessCtrl resumeSurveyWithCode] Constructed otherInputValuesMap:`, otherInputValuesMap);
        
        const partialResponseForFrontend = { ...partialResponseDoc.toObject(), answers: answersMap, otherInputValues: otherInputValuesMap };
        const collectorSettingsForFrontend = deriveCollectorSettingsForFrontend(collectorWebLinkSettings, surveyBehaviorNavSettings);
        
        res.status(200).json({
            success: true,
            data: {
                surveyId: survey._id.toString(), collectorId: collector._id.toString(),
                surveyTitle: survey.title, collectorSettings: collectorSettingsForFrontend,
                partialResponse: partialResponseForFrontend
            },
            message: "Survey resumed successfully."
        });
    } catch (error) { console.error('[PublicAccessCtrl resumeSurveyWithCode] CRITICAL Error:', error); res.status(500).json({ success: false, message: 'Server error while resuming survey.' }); }
};
// ----- END OF COMPLETE MODIFIED FILE (v1.4 - Enhanced Logging & Settings) -----