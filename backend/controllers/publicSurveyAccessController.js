// backend/controllers/publicSurveyAccessController.js
// ----- START OF COMPLETE UPDATED FILE (v1.1 - Include reCAPTCHA settings in response) -----
const mongoose = require('mongoose');
const Collector = require('../models/Collector');
const Survey = require('../models/Survey');

// @desc    Access a survey via its public linkId or customSlug
// @route   POST /s/:accessIdentifier  (Mounted directly at /s in server.js, or /api/public/access/:accessIdentifier if using the router file name)
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
        }).select('+settings.web_link.password +settings.web_link.enableRecaptcha'); // <<< MODIFIED: Ensure enableRecaptcha is selected

        if (!collector) {
            return res.status(404).json({ success: false, message: 'Survey link not found or invalid.' });
        }

        // --- Collector Status and Date Checks (Remain the same) ---
        if (collector.status !== 'open') {
            let message = 'This survey is not currently open for responses.';
            if (collector.status === 'closed') message = 'This survey link has been closed.';
            else if (collector.status === 'draft') message = 'This survey link is not yet active.';
            else if (collector.status === 'paused') message = 'This survey link is temporarily paused.';
            else if (collector.status === 'completed_quota') message = 'This survey link has reached its response limit.';
            return res.status(403).json({ success: false, message, collectorStatus: collector.status });
        }
        const now = new Date();
        if (collector.settings.web_link.openDate && collector.settings.web_link.openDate > now) {
            return res.status(403).json({ success: false, message: `This survey link is scheduled to open on ${collector.settings.web_link.openDate.toLocaleString()}.`, collectorStatus: 'scheduled' });
        }
        if (collector.settings.web_link.closeDate && collector.settings.web_link.closeDate < now) {
            collector.status = 'closed';
            await collector.save();
            return res.status(403).json({ success: false, message: `This survey link closed on ${collector.settings.web_link.closeDate.toLocaleString()}.`, collectorStatus: 'closed' });
        }
        if (collector.settings.web_link.maxResponses !== null &&
            collector.responseCount >= collector.settings.web_link.maxResponses) {
            if (collector.status !== 'completed_quota') {
                collector.status = 'completed_quota';
                await collector.save();
            }
            return res.status(403).json({ success: false, message: 'This survey link has reached its maximum response limit.', collectorStatus: 'completed_quota' });
        }

        // --- Password Check (Remains the same) ---
        if (collector.settings.web_link.password) {
            if (!enteredPassword) {
                return res.status(401).json({
                    success: false,
                    message: 'This survey is password protected. Please provide a password.',
                    requiresPassword: true,
                });
            }
            const isMatch = await collector.comparePassword(enteredPassword);
            if (!isMatch) {
                return res.status(401).json({
                    success: false,
                    message: 'Incorrect password.',
                    requiresPassword: true,
                });
            }
        }

        // --- Survey Status Check (Remains the same) ---
        const survey = await Survey.findById(collector.survey).select('status title').lean();
        if (!survey) {
             return res.status(404).json({ success: false, message: 'Associated survey data not found.' });
        }
        if (survey.status !== 'active' && survey.status !== 'draft') {
            let surveyMessage = 'The underlying survey is not currently available.';
            if (survey.status === 'closed') surveyMessage = 'The underlying survey has been closed.';
            else if (survey.status === 'archived') surveyMessage = 'The underlying survey has been archived.';
             return res.status(403).json({ success: false, message: surveyMessage, surveyStatus: survey.status });
        }

        // --- Prepare Collector Settings for Frontend ---
        const collectorSettingsForFrontend = {
            enableRecaptcha: collector.settings?.web_link?.enableRecaptcha || false,
        };

        if (collectorSettingsForFrontend.enableRecaptcha) {
            if (!process.env.RECAPTCHA_V2_SITE_KEY) {
                console.warn("[publicSurveyAccessController] RECAPTCHA_V2_SITE_KEY is not set in .env, but reCAPTCHA is enabled for this collector. Frontend reCAPTCHA will not render.");
                // Decide if this should be an error or just a warning. For now, a warning.
                // collectorSettingsForFrontend.enableRecaptcha = false; // Optionally disable if key is missing
            } else {
                collectorSettingsForFrontend.recaptchaSiteKey = process.env.RECAPTCHA_V2_SITE_KEY;
            }
        }
        // --- End Prepare Collector Settings ---

        res.status(200).json({
            success: true,
            data: {
                surveyId: collector.survey.toString(),
                collectorId: collector._id.toString(),
                surveyTitle: survey.title,
                requiresPassword: false, // Indicates password check passed or wasn't needed
                collectorSettings: collectorSettingsForFrontend // <<< MODIFIED: Added collectorSettings
            },
            message: "Survey access granted. Redirecting..."
        });

    } catch (error) {
        console.error('Error in publicSurveyAccessController.accessSurvey:', error);
        res.status(500).json({ success: false, message: 'Server error while trying to access the survey.' });
    }
};
// ----- END OF COMPLETE UPDATED FILE (v1.1 - Include reCAPTCHA settings in response) -----