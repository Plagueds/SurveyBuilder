// backend/controllers/publicSurveyAccessController.js
// ----- START OF COMPLETE UPDATED FILE (v1.1 - Fixed .select() for collector) -----
const mongoose = require('mongoose');
const Collector = require('../models/Collector');
const Survey = require('../models/Survey');

exports.accessSurvey = async (req, res) => {
    const { accessIdentifier } = req.params;
    const { password: enteredPassword } = req.body;

    console.log(`[PublicSurveyAccessController] Access attempt for identifier: "${accessIdentifier}"`);

    try {
        if (!accessIdentifier || typeof accessIdentifier !== 'string' || accessIdentifier.trim() === '') {
            return res.status(400).json({ success: false, message: 'Access identifier is missing or invalid.' });
        }

        let collector;
        const trimmedAccessIdentifier = accessIdentifier.trim(); // Use trimmed version for queries

        // 1. Try to find by customSlug first (case-insensitive)
        // The model pre-save hook normalizes customSlug to lowercase, so query lowercase too.
        const potentialSlug = trimmedAccessIdentifier.toLowerCase();
        console.log(`[PublicSurveyAccessController] Attempting lookup by customSlug: "${potentialSlug}"`);
        collector = await Collector.findOne({
            'settings.web_link.customSlug': potentialSlug,
            type: 'web_link'
        }).select('survey status settings responseCount +settings.web_link.password'); // MODIFIED SELECT

        // 2. If not found by customSlug, try by linkId
        if (!collector) {
            console.log(`[PublicSurveyAccessController] Not found by slug. Attempting lookup by linkId: "${trimmedAccessIdentifier}"`);
            collector = await Collector.findOne({
                linkId: trimmedAccessIdentifier, // linkIds are system-generated, can be case-sensitive or normalized on creation
                type: 'web_link'
            }).select('survey status settings responseCount +settings.web_link.password'); // MODIFIED SELECT
        }

        if (!collector) {
            console.log(`[PublicSurveyAccessController] Collector not found for identifier: "${trimmedAccessIdentifier}"`);
            return res.status(404).json({ success: false, message: 'Survey link not found or invalid.' });
        }
        
        console.log(`[PublicSurveyAccessController] Found collector ID: ${collector._id} via identifier "${trimmedAccessIdentifier}"`);

        // --- Fetch Survey details if not already populated or if more fields are needed ---
        // If 'survey' was selected above, it's just an ID. We need to populate it.
        const survey = await Survey.findById(collector.survey) // collector.survey is the ObjectId
            .select('status title settings.behaviorNavigation settings.display') // Ensure all needed survey fields are here
            .lean();

        if (!survey) {
            console.error(`[PublicSurveyAccessController] CRITICAL: Collector ${collector._id} has survey ID ${collector.survey} but survey not found in DB.`);
            return res.status(404).json({ success: false, message: 'Associated survey data not found.' });
        }
        console.log(`[PublicSurveyAccessController] Associated survey ID: ${survey._id}, Title: "${survey.title}"`);


        // --- Collector Status and Date Checks ---
        const webLinkSettings = collector.settings?.web_link || {}; // Now collector.settings is populated
        
        // This check should now work correctly as collector.status is populated
        if (collector.status !== 'open') {
            let message = 'This survey is not currently open for responses.';
            if (collector.status === 'draft') {
                message = 'This survey link is currently in draft mode and not yet active.';
            } else if (collector.status === 'paused') {
                message = 'This survey link is temporarily paused.';
            } else if (collector.status === 'closed') {
                message = 'This survey link has been closed.';
            } else if (collector.status === 'completed_quota') {
                message = 'This survey has reached its response limit.';
            }
            console.log(`[PublicSurveyAccessController] Collector ${collector._id} status is "${collector.status}". Access denied.`);
            return res.status(403).json({ success: false, message, collectorStatus: collector.status });
        }

        const now = new Date();
        if (webLinkSettings.openDate && new Date(webLinkSettings.openDate) > now) {
            console.log(`[PublicSurveyAccessController] Collector ${collector._id} is scheduled to open on ${new Date(webLinkSettings.openDate).toLocaleString()}. Access denied.`);
            return res.status(403).json({ success: false, message: `This survey link is scheduled to open on ${new Date(webLinkSettings.openDate).toLocaleString()}.`, collectorStatus: 'scheduled' });
        }
        
        if (webLinkSettings.closeDate && new Date(webLinkSettings.closeDate) < now) {
            console.log(`[PublicSurveyAccessController] Collector ${collector._id} closed on ${new Date(webLinkSettings.closeDate).toLocaleString()}. Access denied.`);
            return res.status(403).json({ 
                success: false, 
                message: `This survey link closed on ${new Date(webLinkSettings.closeDate).toLocaleString()}.`,
                collectorStatus: 'closed_date'
            });
        }

        if (webLinkSettings.maxResponses && collector.responseCount >= webLinkSettings.maxResponses) {
            console.log(`[PublicSurveyAccessController] Collector ${collector._id} reached max responses (${collector.responseCount}/${webLinkSettings.maxResponses}). Access denied.`);
            return res.status(403).json({ 
                success: false, 
                message: 'This survey has reached its response limit.',
                collectorStatus: 'completed_quota'
            });
        }


        // --- Password Check ---
        // collector.settings.web_link.password will be available if it exists due to the select.
        // collector.comparePassword method re-fetches with +password anyway, so this check is fine.
        if (webLinkSettings.passwordProtectionEnabled && webLinkSettings.password) { 
            if (!enteredPassword) {
                console.log(`[PublicSurveyAccessController] Collector ${collector._id} requires password, none provided. Survey: "${survey.title}"`);
                return res.status(401).json({
                    success: false, message: 'This survey is password protected. Please provide a password.',
                    requiresPassword: true, surveyTitle: survey.title || 'this survey'
                });
            }
            const isMatch = await collector.comparePassword(enteredPassword); // comparePassword will select the password field
            if (!isMatch) {
                console.log(`[PublicSurveyAccessController] Incorrect password for collector ${collector._id}. Survey: "${survey.title}"`);
                return res.status(401).json({
                    success: false, message: 'Incorrect password.',
                    requiresPassword: true, surveyTitle: survey.title || 'this survey'
                });
            }
            console.log(`[PublicSurveyAccessController] Password accepted for collector ${collector._id}.`);
        } else if (webLinkSettings.passwordProtectionEnabled && !webLinkSettings.password) {
            // This case implies an admin error: protection enabled but no password set.
            // Depending on policy, you might deny access or log a stronger warning.
            // For now, allowing access as per original logic.
            console.warn(`[PublicSurveyAccessController] Collector ${collector._id} has passwordProtectionEnabled but no password set. Allowing access.`);
        }


        // --- Survey Status Check ---
        if (survey.status !== 'active') { 
            let surveyMessage = `The underlying survey is currently ${survey.status}.`;
            if (survey.status === 'draft') surveyMessage = 'The underlying survey is still in draft mode.';
            else if (survey.status === 'archived') surveyMessage = 'The underlying survey has been archived.';
            console.log(`[PublicSurveyAccessController] Survey ${survey._id} status is "${survey.status}". Access denied.`);
            return res.status(403).json({ success: false, message: surveyMessage, surveyStatus: survey.status });
        }

        // --- Prepare Collector Settings for Frontend ---
        const surveyBehaviorNavSettings = survey.settings?.behaviorNavigation || {};
        const collectorSettingsForFrontend = {
            allowMultipleResponses: webLinkSettings.allowMultipleResponses || false,
            anonymousResponses: webLinkSettings.anonymousResponses || false,
            enableRecaptcha: webLinkSettings.enableRecaptcha || false,
            allowResume: typeof webLinkSettings.saveAndContinueEnabled === 'boolean' 
                         ? webLinkSettings.saveAndContinueEnabled 
                         : (surveyBehaviorNavSettings.saveAndContinueEnabled || false),
            progressBarEnabled: typeof webLinkSettings.progressBarEnabled === 'boolean' 
                                ? webLinkSettings.progressBarEnabled 
                                : (surveyBehaviorNavSettings.progressBarEnabled || false),
            progressBarStyle: webLinkSettings.progressBarStyle || surveyBehaviorNavSettings.progressBarStyle || 'percentage',
            progressBarPosition: webLinkSettings.progressBarPosition || surveyBehaviorNavSettings.progressBarPosition || 'top',
            allowBackButton: typeof webLinkSettings.allowBackButton === 'boolean'
                             ? webLinkSettings.allowBackButton
                             : (surveyBehaviorNavSettings.allowBackButton !== undefined ? surveyBehaviorNavSettings.allowBackButton : true),
            autoAdvance: typeof webLinkSettings.autoAdvance === 'boolean'
                         ? webLinkSettings.autoAdvance
                         : (surveyBehaviorNavSettings.autoAdvance || false),
            questionNumberingEnabled: typeof webLinkSettings.questionNumberingEnabled === 'boolean'
                                      ? webLinkSettings.questionNumberingEnabled
                                      : (surveyBehaviorNavSettings.questionNumberingEnabled !== undefined ? surveyBehaviorNavSettings.questionNumberingEnabled : true),
        };

        if (collectorSettingsForFrontend.enableRecaptcha) {
            if (!process.env.RECAPTCHA_V2_SITE_KEY) {
                console.warn("[PublicSurveyAccessController] Warning: RECAPTCHA_V2_SITE_KEY is not set in the backend .env for public access reCAPTCHA site key.");
            }
        }
        
        console.log(`[PublicSurveyAccessController] Access granted for collector ${collector._id}. Sending settings to frontend:`, collectorSettingsForFrontend);

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
        console.error('[PublicSurveyAccessController] CRITICAL Error in accessSurvey:', error);
        res.status(500).json({ success: false, message: 'Server error while trying to access the survey.' });
    }
};
// ----- END OF COMPLETE UPDATED FILE (v1.1 - Fixed .select() for collector) -----