// backend/controllers/publicSurveyAccessController.js
// ----- START OF COMPLETE UPDATED FILE (v1.6 - Explicit Auto-save Settings in Derived Collector Settings) -----
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
           'settings.web_link.saveAndContinueMethod ' + 
           'settings.web_link.progressBarEnabled ' +
           'settings.web_link.progressBarStyle ' +
           'settings.web_link.progressBarPosition ' +
           'settings.web_link.allowBackButton ' +
           'settings.web_link.autoAdvance ' +
           'settings.web_link.questionNumberingEnabled ' +
           'settings.web_link.questionNumberingFormat ' + 
           'settings.web_link.questionNumberingCustomPrefix';
};

const deriveCollectorSettingsForFrontend = (collectorWebLinkSettings = {}, surveyBehaviorNavSettings = {}) => {
    // Ensure surveyBehaviorNavSettings is an object even if undefined
    const sbn = surveyBehaviorNavSettings || {}; 

    return {
        allowMultipleResponses: collectorWebLinkSettings.allowMultipleResponses ?? sbn.allowMultipleResponses ?? false,
        anonymousResponses: collectorWebLinkSettings.anonymousResponses ?? sbn.anonymousResponses ?? false,
        enableRecaptcha: collectorWebLinkSettings.enableRecaptcha ?? false,
        allowResume: typeof collectorWebLinkSettings.saveAndContinueEnabled === 'boolean' 
            ? collectorWebLinkSettings.saveAndContinueEnabled 
            : (sbn.saveAndContinueEnabled || false),
        saveAndContinueMethod: collectorWebLinkSettings.saveAndContinueMethod || sbn.saveAndContinueMethod || 'both',
        
        // +++ NEW: Explicitly include auto-save settings, defaulting to survey settings then platform defaults +++
        autoSaveEnabled: typeof collectorWebLinkSettings.autoSaveEnabled === 'boolean' // Collector can't override this yet, but good for future
            ? collectorWebLinkSettings.autoSaveEnabled
            : (sbn.autoSaveEnabled || false), // Default from survey, then false
        autoSaveIntervalSeconds: typeof collectorWebLinkSettings.autoSaveIntervalSeconds === 'number' // Collector can't override this yet
            ? collectorWebLinkSettings.autoSaveIntervalSeconds
            : (sbn.autoSaveIntervalSeconds || 60), // Default from survey, then 60

        progressBarEnabled: typeof collectorWebLinkSettings.progressBarEnabled === 'boolean' 
            ? collectorWebLinkSettings.progressBarEnabled 
            : (sbn.progressBarEnabled || false),
        progressBarStyle: collectorWebLinkSettings.progressBarStyle || sbn.progressBarStyle || 'percentage',
        progressBarPosition: collectorWebLinkSettings.progressBarPosition || sbn.progressBarPosition || 'top',
        allowBackButton: typeof collectorWebLinkSettings.allowBackButton === 'boolean' 
            ? collectorWebLinkSettings.allowBackButton 
            : (sbn.allowBackButton !== undefined ? sbn.allowBackButton : true),
        autoAdvance: typeof collectorWebLinkSettings.autoAdvance === 'boolean' 
            ? collectorWebLinkSettings.autoAdvance 
            : (sbn.autoAdvance || false),
        questionNumberingEnabled: typeof collectorWebLinkSettings.questionNumberingEnabled === 'boolean' 
            ? collectorWebLinkSettings.questionNumberingEnabled 
            : (sbn.questionNumberingEnabled !== undefined ? sbn.questionNumberingEnabled : true),
        questionNumberingFormat: collectorWebLinkSettings.questionNumberingFormat || sbn.questionNumberingFormat || '123',
        questionNumberingCustomPrefix: collectorWebLinkSettings.questionNumberingCustomPrefix || sbn.questionNumberingCustomPrefix || '',
    };
};

exports.accessSurvey = async (req, res) => {
    const { accessIdentifier } = req.params;
    const { password: enteredPassword } = req.body;
    const queryParams = req.query;
    console.log(`[PublicAccessCtrl accessSurvey] Identifier: "${accessIdentifier}", Query Params:`, queryParams);

    try {
        if (!accessIdentifier || typeof accessIdentifier !== 'string' || accessIdentifier.trim() === '') { return res.status(400).json({ success: false, message: 'Access identifier is missing or invalid.' }); }
        
        let collector; 
        const trimmedAccessIdentifier = accessIdentifier.trim(); 
        const collectorProjection = getCollectorProjection(); 
        const potentialSlug = trimmedAccessIdentifier.toLowerCase();
        
        collector = await Collector.findOne({ 'settings.web_link.customSlug': potentialSlug, type: 'web_link' }).select(collectorProjection);
        if (!collector) collector = await Collector.findOne({ linkId: trimmedAccessIdentifier, type: 'web_link' }).select(collectorProjection);
        if (!collector) return res.status(404).json({ success: false, message: 'Survey link not found or invalid.' });
        
        const survey = await Survey.findById(collector.survey)
            .select('status title settings.behaviorNavigation settings.customVariables')
            .lean();

        if (!survey) { console.error(`[PublicAccessCtrl accessSurvey] CRITICAL: Collector ${collector._id} survey ${collector.survey} not found.`); return res.status(404).json({ success: false, message: 'Associated survey data not found.' }); }
        
        const webLinkSettings = collector.settings?.web_link || {};
        const surveyBehaviorNavSettings = survey.settings?.behaviorNavigation || {}; // This will include autoSaveEnabled, autoSaveIntervalSeconds
        const surveyCustomVarDefinitions = survey.settings?.customVariables || [];

        if (collector.status !== 'open') { return res.status(403).json({ success: false, message: `This survey is ${collector.status}.`, collectorStatus: collector.status });}
        const now = new Date();
        if (webLinkSettings.openDate && new Date(webLinkSettings.openDate) > now) { return res.status(403).json({ success: false, message: `Survey opens ${new Date(webLinkSettings.openDate).toLocaleString()}.`, collectorStatus: 'scheduled' });}
        if (webLinkSettings.closeDate && new Date(webLinkSettings.closeDate) < now) { return res.status(403).json({ success: false, message: `Survey closed ${new Date(webLinkSettings.closeDate).toLocaleString()}.`, collectorStatus: 'closed_date' });}
        if (typeof webLinkSettings.maxResponses === 'number' && webLinkSettings.maxResponses > 0 && collector.responseCount >= webLinkSettings.maxResponses) { return res.status(403).json({ success: false, message: 'Survey reached response limit.', collectorStatus: 'completed_quota' });}

        if (webLinkSettings.passwordProtectionEnabled && webLinkSettings.password) { 
            if (!enteredPassword) {
                return res.status(401).json({ 
                    success: false, message: 'This survey is password protected.', 
                    requiresPassword: true, 
                    surveyTitle: survey.title || 'this survey',
                    surveySettings: { behaviorNavigation: surveyBehaviorNavSettings } 
                });
            }
            const isMatch = await collector.comparePassword(enteredPassword);
            if (!isMatch) { 
                return res.status(401).json({ 
                    success: false, message: 'Incorrect password.', 
                    requiresPassword: true, 
                    surveyTitle: survey.title || 'this survey',
                    surveySettings: { behaviorNavigation: surveyBehaviorNavSettings }
                }); 
            }
        }
        if (survey.status !== 'active') { return res.status(403).json({ success: false, message: `The survey is ${survey.status}.`, surveyStatus: survey.status }); }
        
        // surveyBehaviorNavSettings is passed to deriveCollectorSettingsForFrontend
        const collectorSettingsForFrontend = deriveCollectorSettingsForFrontend(webLinkSettings, surveyBehaviorNavSettings);
        
        const capturedCustomVariables = {};
        if (surveyCustomVarDefinitions.length > 0 && queryParams) {
            surveyCustomVarDefinitions.forEach(def => {
                if (queryParams.hasOwnProperty(def.key)) {
                    capturedCustomVariables[def.key] = queryParams[def.key];
                } else if (def.defaultValue) {
                    capturedCustomVariables[def.key] = def.defaultValue;
                }
            });
        }
        
        res.status(200).json({
            success: true,
            data: {
                surveyId: survey._id.toString(), collectorId: collector._id.toString(),
                surveyTitle: survey.title,
                collectorSettings: collectorSettingsForFrontend, // This now explicitly includes auto-save settings
                surveySettings: { 
                    behaviorNavigation: surveyBehaviorNavSettings, // Still sending full survey behavior nav for reference
                    customVariables: surveyCustomVarDefinitions
                },
                initialCustomVariables: capturedCustomVariables 
            },
            message: "Survey access granted."
        });
    } catch (error) { console.error('[PublicAccessCtrl accessSurvey] CRITICAL Error:', error); res.status(500).json({ success: false, message: 'Server error while trying to access the survey.' }); }
};

exports.resumeSurveyWithCode = async (req, res) => {
    const { accessIdentifier } = req.params;
    const { resumeCode } = req.body;
    const queryParams = req.query;
    console.log(`[PublicAccessCtrl resumeSurveyWithCode] Identifier: "${accessIdentifier}", Code: "${resumeCode}", Query:`, queryParams);

    if (!accessIdentifier || !resumeCode) { return res.status(400).json({ success: false, message: 'Access identifier and resume code are required.' }); }
    try {
        let collector; 
        const trimmedAccessIdentifier = accessIdentifier.trim(); const collectorProjection = getCollectorProjection(); const potentialSlug = trimmedAccessIdentifier.toLowerCase();
        collector = await Collector.findOne({ 'settings.web_link.customSlug': potentialSlug, type: 'web_link' }).select(collectorProjection);
        if (!collector) collector = await Collector.findOne({ linkId: trimmedAccessIdentifier, type: 'web_link' }).select(collectorProjection);
        if (!collector) return res.status(404).json({ success: false, message: 'Survey link not found.' });
        
        const survey = await Survey.findById(collector.survey)
            .select('status title settings.behaviorNavigation settings.customVariables')
            .lean();
        if (!survey) { return res.status(404).json({ success: false, message: 'Associated survey not found.' }); }

        if (collector.status !== 'open' || survey.status !== 'active') { return res.status(403).json({ success: false, message: 'Survey or link not active.' }); }
        
        const surveyBehaviorNavSettings = survey.settings?.behaviorNavigation || {};
        const collectorWebLinkSettings = collector.settings?.web_link || {};
        const surveyCustomVarDefinitions = survey.settings?.customVariables || [];
        const effectiveSaveEnabled = collectorWebLinkSettings.saveAndContinueEnabled ?? surveyBehaviorNavSettings.saveAndContinueEnabled ?? false;
        const effectiveSaveMethod = collectorWebLinkSettings.saveAndContinueMethod || surveyBehaviorNavSettings.saveAndContinueMethod || 'both';

        if (!effectiveSaveEnabled || (effectiveSaveMethod !== 'code' && effectiveSaveMethod !== 'both')) {
            return res.status(400).json({ success: false, message: 'Resume with code is not enabled for this survey.' });
        }
        
        const partialResponseDoc = await PartialResponse.findOne({ resumeToken: resumeCode.trim(), survey: survey._id }).lean();
        if (!partialResponseDoc) { return res.status(404).json({ success: false, message: 'Invalid or expired resume code.' }); }
        if (partialResponseDoc.expiresAt < new Date()) { return res.status(410).json({ success: false, message: 'Resume code has expired.' }); }
        if (partialResponseDoc.completedAt) { return res.status(410).json({ success: false, message: 'Session already completed.' }); }

        const answersFromDb = await Answer.find({ survey: survey._id, sessionId: partialResponseDoc.sessionId }).lean();
        const answersMap = {}; const otherInputValuesMap = {};
        answersFromDb.forEach(ans => {
            answersMap[ans.questionId.toString()] = ans.answerValue;
            if (ans.otherText) otherInputValuesMap[`${ans.questionId.toString()}_other`] = ans.otherText;
        });
        
        let mergedCustomVariables = { ...(partialResponseDoc.customVariables || {}) };
        if (surveyCustomVarDefinitions.length > 0 && queryParams) {
            surveyCustomVarDefinitions.forEach(def => {
                if (queryParams.hasOwnProperty(def.key)) {
                    mergedCustomVariables[def.key] = queryParams[def.key];
                } else if (!mergedCustomVariables.hasOwnProperty(def.key) && def.defaultValue) {
                    mergedCustomVariables[def.key] = def.defaultValue;
                }
            });
        }

        const partialResponseForFrontend = { 
            ...partialResponseDoc, 
            answers: answersMap, 
            otherInputValues: otherInputValuesMap,
            customVariables: mergedCustomVariables
        };
        // surveyBehaviorNavSettings is passed to deriveCollectorSettingsForFrontend
        const collectorSettingsForFrontend = deriveCollectorSettingsForFrontend(collectorWebLinkSettings, surveyBehaviorNavSettings);
        
        res.status(200).json({
            success: true,
            data: {
                surveyId: survey._id.toString(), collectorId: collector._id.toString(),
                surveyTitle: survey.title, 
                collectorSettings: collectorSettingsForFrontend, // This now explicitly includes auto-save settings
                surveySettings: { 
                    behaviorNavigation: surveyBehaviorNavSettings,
                    customVariables: surveyCustomVarDefinitions
                },
                partialResponse: partialResponseForFrontend
            },
            message: "Survey resumed successfully."
        });
    } catch (error) { console.error('[PublicAccessCtrl resumeSurveyWithCode] CRITICAL Error:', error); res.status(500).json({ success: false, message: 'Server error while resuming survey.' }); }
};
// ----- END OF COMPLETE UPDATED FILE (v1.6 - Explicit Auto-save Settings in Derived Collector Settings) -----