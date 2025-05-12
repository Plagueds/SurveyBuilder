// backend/controllers/publicSurveyAccessController.js
// ----- START OF COMPLETE MODIFIED FILE (v1.2 - Pass all required collector settings) -----
const mongoose = require('mongoose');
const Collector = require('../models/Collector');
const Survey = require('../models/Survey');

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

        // Fetch the collector. We need various settings from web_link.
        // Mongoose includes sub-documents by default unless deselected.
        // We explicitly select password to ensure it's available for comparison.
        const collector = await Collector.findOne({
            $or: [
                { linkId: accessIdentifier },
                { 'settings.web_link.customSlug': accessIdentifier }
            ],
            type: 'web_link' // Ensure it's a web_link collector
        }).select('+settings.web_link.password'); // Ensure password is included for comparison

        if (!collector) {
            return res.status(404).json({ success: false, message: 'Survey link not found or invalid.' });
        }

        // --- Collector Status and Date Checks ---
        if (collector.status !== 'open') {
            let message = 'This survey is not currently open for responses.';
            if (collector.status === 'closed') message = 'This survey link has been closed.';
            else if (collector.status === 'draft') message = 'This survey link is not yet active.';
            else if (collector.status === 'paused') message = 'This survey link is temporarily paused.';
            else if (collector.status === 'completed_quota') message = 'This survey link has reached its response limit.';
            return res.status(403).json({ success: false, message, collectorStatus: collector.status });
        }

        const now = new Date();
        const webLinkSettings = collector.settings?.web_link || {}; // Use empty object as fallback

        if (webLinkSettings.openDate && new Date(webLinkSettings.openDate) > now) {
            return res.status(403).json({ success: false, message: `This survey link is scheduled to open on ${new Date(webLinkSettings.openDate).toLocaleString()}.`, collectorStatus: 'scheduled' });
        }
        if (webLinkSettings.closeDate && new Date(webLinkSettings.closeDate) < now) {
            // Update status if it hasn't been already
            if (collector.status === 'open') {
                collector.status = 'closed';
                await collector.save(); // Save the status change
            }
            return res.status(403).json({ success: false, message: `This survey link closed on ${new Date(webLinkSettings.closeDate).toLocaleString()}.`, collectorStatus: 'closed' });
        }
        if (webLinkSettings.maxResponses !== null &&
            collector.responseCount >= webLinkSettings.maxResponses) {
            if (collector.status !== 'completed_quota') {
                collector.status = 'completed_quota';
                await collector.save(); // Save the status change
            }
            return res.status(403).json({ success: false, message: 'This survey link has reached its maximum response limit.', collectorStatus: 'completed_quota' });
        }

        // --- Password Check ---
        if (webLinkSettings.password) { // Check if a password is set
            const surveyForTitle = await Survey.findById(collector.survey).select('title').lean(); // Get title for password prompt
            if (!enteredPassword) {
                return res.status(401).json({
                    success: false,
                    message: 'This survey is password protected. Please provide a password.',
                    requiresPassword: true,
                    surveyTitle: surveyForTitle?.title || 'this survey'
                });
            }
            const isMatch = await collector.comparePassword(enteredPassword);
            if (!isMatch) {
                return res.status(401).json({
                    success: false,
                    message: 'Incorrect password.',
                    requiresPassword: true,
                    surveyTitle: surveyForTitle?.title || 'this survey'
                });
            }
        }

        // --- Survey Status Check ---
        // Populate survey details after password and initial checks pass
        const survey = await Survey.findById(collector.survey).select('status title').lean();
        if (!survey) {
             return res.status(404).json({ success: false, message: 'Associated survey data not found.' });
        }
        if (survey.status !== 'active' && survey.status !== 'draft') { // Allow 'draft' for preview/testing
            let surveyMessage = 'The underlying survey is not currently available.';
            if (survey.status === 'closed') surveyMessage = 'The underlying survey has been closed.';
            else if (survey.status === 'archived') surveyMessage = 'The underlying survey has been archived.';
             return res.status(403).json({ success: false, message: surveyMessage, surveyStatus: survey.status });
        }

        // --- Prepare Collector Settings for Frontend ---
        const collectorSettingsForFrontend = {
            allowMultipleResponses: webLinkSettings.allowMultipleResponses || false, // <<< ADDED
            anonymousResponses: webLinkSettings.anonymousResponses || false,       // <<< ADDED
            enableRecaptcha: webLinkSettings.enableRecaptcha || false,
            // Add other settings from webLinkSettings if SurveyTakingPage needs them
        };

        if (collectorSettingsForFrontend.enableRecaptcha) {
            // IMPORTANT: Use the backend environment variable name here.
            // The frontend uses REACT_APP_RECAPTCHA_SITE_KEY, but the backend should use its own.
            if (!process.env.RECAPTCHA_V2_SITE_KEY) { // Ensure this matches your .env for backend
                console.warn("[publicSurveyAccessController] Warning: RECAPTCHA_V2_SITE_KEY is not set in the backend .env, but reCAPTCHA is enabled for this collector. Frontend reCAPTCHA may not render if it relies on this key being passed.");
                // Depending on your setup, you might want to explicitly set enableRecaptcha to false here
                // if the key is missing, to prevent frontend issues.
                // collectorSettingsForFrontend.enableRecaptcha = false; 
            } else {
                collectorSettingsForFrontend.recaptchaSiteKey = process.env.RECAPTCHA_V2_SITE_KEY;
            }
        }
        // --- End Prepare Collector Settings ---

        res.status(200).json({
            success: true,
            data: {
                surveyId: collector.survey.toString(), // Ensure it's a string
                collectorId: collector._id.toString(),   // Ensure it's a string
                surveyTitle: survey.title,
                // No need for requiresPassword: false here, success implies it's handled.
                // PublicSurveyHandler primarily uses requiresPassword from error responses.
                collectorSettings: collectorSettingsForFrontend 
            },
            message: "Survey access granted." // Simplified message
        });

    } catch (error) {
        console.error('Error in publicSurveyAccessController.accessSurvey:', error);
        res.status(500).json({ success: false, message: 'Server error while trying to access the survey.' });
    }
};
// ----- END OF COMPLETE MODIFIED FILE (v1.2 - Pass all required collector settings) -----