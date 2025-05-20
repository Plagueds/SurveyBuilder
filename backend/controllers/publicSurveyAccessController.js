// backend/controllers/publicSurveyAccessController.js
// ----- START OF UPDATED FILE -----
const mongoose = require('mongoose');
const Collector = require('../models/Collector');
const Survey = require('../models/Survey'); // Ensure Survey model is imported

// @desc    Access a survey via its public linkId or customSlug
// @route   POST /s/:accessIdentifier
// @access  Public
exports.accessSurvey = async (req, res) => {
    const { accessIdentifier } = req.params;
    const { password: enteredPassword } = req.body;

    try {
        if (!accessIdentifier) {
            return res.status(400).json({ success: false, message: 'Access identifier is missing.' });
        }

        const collector = await Collector.findOne({
            $or: [
                { linkId: accessIdentifier },
                { 'settings.web_link.customSlug': accessIdentifier }
            ],
            type: 'web_link'
        }).select('+settings.web_link.password'); // Ensure all web_link settings are available

        if (!collector) {
            return res.status(404).json({ success: false, message: 'Survey link not found or invalid.' });
        }

        // --- Collector Status and Date Checks --- (No changes here from your v1.2)
        if (collector.status !== 'open') {
            let message = 'This survey is not currently open for responses.';
            if (collector.status === 'closed') message = 'This survey link has been closed.';
            else if (collector.status === 'draft') message = 'This survey link is not yet active.';
            else if (collector.status === 'paused') message = 'This survey link is temporarily paused.';
            else if (collector.status === 'completed_quota') message = 'This survey link has reached its response limit.';
            return res.status(403).json({ success: false, message, collectorStatus: collector.status });
        }

        const now = new Date();
        const webLinkSettings = collector.settings?.web_link || {};

        if (webLinkSettings.openDate && new Date(webLinkSettings.openDate) > now) {
            return res.status(403).json({ success: false, message: `This survey link is scheduled to open on ${new Date(webLinkSettings.openDate).toLocaleString()}.`, collectorStatus: 'scheduled' });
        }
        if (webLinkSettings.closeDate && new Date(webLinkSettings.closeDate) < now) {
            if (collector.status === 'open') {
                collector.status = 'closed';
                await collector.save();
            }
            return res.status(403).json({ success: false, message: `This survey link closed on ${new Date(webLinkSettings.closeDate).toLocaleString()}.`, collectorStatus: 'closed' });
        }
        if (webLinkSettings.maxResponses !== null && webLinkSettings.maxResponses > 0 && // Ensure maxResponses is a positive number
            collector.responseCount >= webLinkSettings.maxResponses) {
            if (collector.status !== 'completed_quota') {
                collector.status = 'completed_quota';
                await collector.save();
            }
            return res.status(403).json({ success: false, message: 'This survey link has reached its maximum response limit.', collectorStatus: 'completed_quota' });
        }

        // --- Fetch Survey for its settings (title and behavior/display settings) ---
        // Select only necessary fields from Survey model
        const survey = await Survey.findById(collector.survey)
            .select('status title settings.behaviorNavigation settings.display') // Assuming settings.display might exist or you add it
            .lean();

        if (!survey) {
             return res.status(404).json({ success: false, message: 'Associated survey data not found.' });
        }

        // --- Password Check ---
        if (webLinkSettings.passwordProtectionEnabled || webLinkSettings.password) { // Check if password protection is explicitly enabled or if a password exists
            if (!enteredPassword) {
                return res.status(401).json({
                    success: false,
                    message: 'This survey is password protected. Please provide a password.',
                    requiresPassword: true,
                    surveyTitle: survey.title || 'this survey'
                });
            }
            const isMatch = await collector.comparePassword(enteredPassword); // comparePassword should handle if webLinkSettings.password is empty
            if (!isMatch) {
                return res.status(401).json({
                    success: false,
                    message: 'Incorrect password.',
                    requiresPassword: true,
                    surveyTitle: survey.title || 'this survey'
                });
            }
        }

        // --- Survey Status Check ---
        if (survey.status !== 'active' && survey.status !== 'draft') {
            let surveyMessage = 'The underlying survey is not currently available.';
            if (survey.status === 'closed') surveyMessage = 'The underlying survey has been closed.';
            else if (survey.status === 'archived') surveyMessage = 'The underlying survey has been archived.';
             return res.status(403).json({ success: false, message: surveyMessage, surveyStatus: survey.status });
        }

        // --- Prepare Collector Settings for Frontend ---
        const surveyBehaviorNavSettings = survey.settings?.behaviorNavigation || {};
        // Assuming survey.settings.display might exist for progressBar defaults. If not, adjust paths or rely on collector only.
        // For now, let's assume progressBarEnabled is primarily a collector setting,
        // and saveAndContinueEnabled is primarily a survey setting that can be influenced by collector.

        const collectorSettingsForFrontend = {
            allowMultipleResponses: webLinkSettings.allowMultipleResponses || false,
            anonymousResponses: webLinkSettings.anonymousResponses || false,
            enableRecaptcha: webLinkSettings.enableRecaptcha || false,
            
            // Collector can explicitly enable/disable resume. If not set by collector, use survey's setting.
            allowResume: typeof webLinkSettings.saveAndContinueEnabled === 'boolean' 
                         ? webLinkSettings.saveAndContinueEnabled 
                         : (surveyBehaviorNavSettings.saveAndContinueEnabled || false),

            // Collector can explicitly enable/disable progress bar.
            // If not set by collector, default to false (or survey's setting if you add one there).
            progressBarEnabled: typeof webLinkSettings.progressBarEnabled === 'boolean' 
                                ? webLinkSettings.progressBarEnabled 
                                : false, // Default to false if collector doesn't specify

            progressBarStyle: webLinkSettings.progressBarStyle || 'percentage', // Default from CollectorFormModal
            progressBarPosition: webLinkSettings.progressBarPosition || 'top',   // Default from CollectorFormModal
            allowBackButton: typeof webLinkSettings.allowBackButton === 'boolean'
                             ? webLinkSettings.allowBackButton
                             : true, // Default to true if not specified
            // Add other settings from webLinkSettings if SurveyTakingPage needs them
        };

        if (collectorSettingsForFrontend.enableRecaptcha) {
            if (!process.env.RECAPTCHA_V2_SITE_KEY) {
                console.warn("[publicSurveyAccessController] Warning: RECAPTCHA_V2_SITE_KEY is not set in the backend .env...");
            } else {
                collectorSettingsForFrontend.recaptchaSiteKey = process.env.RECAPTCHA_V2_SITE_KEY;
            }
        }
        
        console.log("[PublicSurveyAccessController] Sending collectorSettings to frontend:", collectorSettingsForFrontend);

        res.status(200).json({
            success: true,
            data: {
                surveyId: collector.survey.toString(),
                collectorId: collector._id.toString(),
                surveyTitle: survey.title,
                collectorSettings: collectorSettingsForFrontend 
            },
            message: "Survey access granted."
        });

    } catch (error) {
        console.error('Error in publicSurveyAccessController.accessSurvey:', error);
        res.status(500).json({ success: false, message: 'Server error while trying to access the survey.' });
    }
};
// ----- END OF UPDATED FILE -----