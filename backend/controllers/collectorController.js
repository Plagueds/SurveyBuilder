// backend/controllers/collectorController.js
// ----- START OF COMPLETE UPDATED FILE (v1.6 - Integrated with new Collector model) -----
const mongoose = require('mongoose');
const Collector = require('../models/Collector');
const Survey = require('../models/Survey'); // Assuming Survey model is used for checks

// @desc    Create a new collector for a survey
// @route   POST /api/surveys/:surveyId/collectors
// @access  Private (authorizeSurveyAccess middleware should handle survey ownership/admin checks)
exports.createCollector = async (req, res) => {
    const { surveyId } = req.params;
    // Assuming req.user.id is available from authentication middleware
    const createdByUserId = req.user.id; 
    const {
        name,
        type = 'web_link', // Default to web_link if not provided
        status = 'draft',  // Default to draft
        settings // This will contain type-specific settings like settings.web_link
    } = req.body;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // req.survey should be populated by authorizeSurveyAccess middleware
        if (!req.survey) {
            await session.abortTransaction(); session.endSession();
            return res.status(404).json({ success: false, message: 'Survey not found to associate with collector.' });
        }
        if (req.survey.status === 'archived') {
            await session.abortTransaction(); session.endSession();
            return res.status(400).json({ success: false, message: 'Cannot add collectors to an archived survey.' });
        }

        const collectorData = {
            survey: surveyId,
            name: name || `Collector on ${new Date().toLocaleDateString()}`,
            type,
            status,
            settings: {}, // Initialize settings
            createdBy: createdByUserId
        };

        if (type === 'web_link') {
            collectorData.settings.web_link = {}; // Ensure the sub-document exists
            if (settings && settings.web_link) {
                const webLinkPayload = settings.web_link;
                const allowedKeys = [
                    'customSlug', 'password', 'passwordProtectionEnabled', 'openDate', 'closeDate',
                    'maxResponses', 'allowMultipleResponses', 'anonymousResponses',
                    'enableRecaptcha', // recaptchaSiteKey is usually not set from client for creation
                    'ipAllowlist', 'ipBlocklist', 'allowBackButton',
                    'progressBarEnabled', 'progressBarStyle', 'progressBarPosition',
                    'saveAndContinueEnabled'
                ];

                for (const key of allowedKeys) {
                    if (webLinkPayload.hasOwnProperty(key)) {
                        if (key === 'password') {
                            // Password will be hashed by pre-save hook if not empty
                            // If empty string or null, pre-save hook will clear it
                            collectorData.settings.web_link.password = webLinkPayload.password;
                        } else if (key === 'maxResponses') {
                            const parsedMax = parseInt(webLinkPayload.maxResponses, 10);
                            collectorData.settings.web_link.maxResponses = (isNaN(parsedMax) || parsedMax <= 0) ? null : parsedMax;
                        } else if (key === 'ipAllowlist' || key === 'ipBlocklist') {
                            collectorData.settings.web_link[key] = Array.isArray(webLinkPayload[key])
                                ? webLinkPayload[key].filter(ip => typeof ip === 'string' && ip.trim() !== '').map(ip => ip.trim())
                                : [];
                        } else if (['allowBackButton', 'enableRecaptcha', 'allowMultipleResponses', 'anonymousResponses', 'progressBarEnabled', 'passwordProtectionEnabled', 'saveAndContinueEnabled'].includes(key)) {
                            collectorData.settings.web_link[key] = !!webLinkPayload[key];
                        } else if (key === 'customSlug' && webLinkPayload.customSlug) {
                            // Slug will be lowercased by model's pre-save hook.
                            // Uniqueness check will be handled by database index.
                            collectorData.settings.web_link.customSlug = webLinkPayload.customSlug.trim();
                        } else {
                            collectorData.settings.web_link[key] = webLinkPayload[key];
                        }
                    }
                }
            }
        } else if (type && settings && settings[type]) {
            // For other collector types (email, embed, etc.)
            collectorData.settings[type] = { ...settings[type] };
        }

        const newCollector = new Collector(collectorData);
        const savedCollector = await newCollector.save({ session }); // Pre-save hook handles linkId, password hashing, slug normalization

        await Survey.findByIdAndUpdate(
            surveyId,
            { $addToSet: { collectors: savedCollector._id } },
            { session, new: true, runValidators: true } // runValidators might not be needed for $addToSet
        );

        await session.commitTransaction();
        session.endSession();

        // Prepare response data (password is not selected by default due to model schema)
        const responseData = savedCollector.toObject();
        // If settings.web_link.password was somehow included (it shouldn't be due to select:false), remove it.
        if (responseData.settings?.web_link?.password) {
            delete responseData.settings.web_link.password;
        }

        res.status(201).json({ success: true, data: responseData });

    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        session.endSession();
        console.error(`[collectorController.createCollector] Error for survey ${surveyId}:`, error);

        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ success: false, message: messages.join('. '), errors: error.errors });
        }
        if (error.code === 11000) { // MongoDB duplicate key error
            if (error.keyPattern && error.keyPattern['settings.web_link.customSlug']) {
                return res.status(400).json({ success: false, message: 'This custom slug is already in use. Please choose another.' });
            }
            if (error.keyPattern && error.keyPattern.linkId) {
                 // This error should be rare due to the generateUniqueLinkId helper, but catch it.
                return res.status(500).json({ success: false, message: 'Failed to generate a unique link ID. Please try creating the collector again.' });
            }
            return res.status(400).json({ success: false, message: 'A unique field constraint was violated. Please check your input.', errorDetails: error.keyValue });
        }
        res.status(500).json({ success: false, message: 'Error creating collector. Please check server logs for details.' });
    }
};

// @desc    Get all collectors for a specific survey
// @route   GET /api/surveys/:surveyId/collectors
// @access  Private
exports.getCollectorsForSurvey = async (req, res) => {
    const { surveyId } = req.params;
    try {
        const collectors = await Collector.find({ survey: surveyId })
            // Password is not selected by default due to `select: false` in schema
            .sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            count: collectors.length,
            data: collectors
        });
    } catch (error) {
        console.error(`[collectorController.getCollectorsForSurvey] Error for survey ${surveyId}:`, error);
        res.status(500).json({ success: false, message: 'Error fetching collectors.' });
    }
};

// @desc    Get a single collector by its ID
// @route   GET /api/surveys/:surveyId/collectors/:collectorId
// @access  Private
exports.getCollectorById = async (req, res) => {
    const { surveyId, collectorId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(collectorId)) {
        return res.status(400).json({ success: false, message: 'Invalid Collector ID format.' });
    }
    try {
        const collector = await Collector.findOne({ _id: collectorId, survey: surveyId });
        if (!collector) {
            return res.status(404).json({ success: false, message: 'Collector not found or does not belong to this survey.' });
        }
        // Password is not selected by default.
        res.status(200).json({ success: true, data: collector.toObject() });
    } catch (error) {
        console.error(`[collectorController.getCollectorById] Error for survey ${surveyId}, collector ${collectorId}:`, error);
        res.status(500).json({ success: false, message: 'Error fetching collector details.' });
    }
};

// @desc    Update a collector
// @route   PUT /api/surveys/:surveyId/collectors/:collectorId
// @access  Private
exports.updateCollector = async (req, res) => {
    const { surveyId, collectorId } = req.params;
    const { name, type, status, settings } = req.body;

    if (!mongoose.Types.ObjectId.isValid(collectorId)) {
        return res.status(400).json({ success: false, message: 'Invalid Collector ID format.' });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        let collector = await Collector.findOne({ _id: collectorId, survey: surveyId })
                                     // No need to select password here, pre-save hook handles it if 'settings.web_link.password' is modified
                                     .session(session);

        if (!collector) {
            await session.abortTransaction(); session.endSession();
            return res.status(404).json({ success: false, message: 'Collector not found or does not belong to this survey.' });
        }

        // Update top-level fields
        if (name !== undefined) collector.name = name.trim();
        if (status !== undefined) collector.status = status;
        
        // Handle type change - pre-save hook will clear irrelevant settings and linkId/slug
        if (type !== undefined && type !== collector.type) {
            collector.type = type;
            // If changing to web_link and linkId isn't set, pre-save will generate it.
        }

        if (settings) {
            const effectiveType = type !== undefined ? type : collector.type; // Use new type if provided, else existing

            if (effectiveType === 'web_link') {
                if (!collector.settings.web_link) collector.settings.web_link = {}; // Ensure sub-document exists
                
                const webLinkPayload = settings.web_link || {}; // Use empty obj if settings.web_link is not sent
                const allowedWebLinkKeys = [
                    'customSlug', 'password', 'passwordProtectionEnabled', 'openDate', 'closeDate',
                    'maxResponses', 'allowMultipleResponses', 'anonymousResponses',
                    'enableRecaptcha', // recaptchaSiteKey is usually not set from client
                    'ipAllowlist', 'ipBlocklist', 'allowBackButton',
                    'progressBarEnabled', 'progressBarStyle', 'progressBarPosition',
                    'saveAndContinueEnabled'
                ];

                for (const key of allowedWebLinkKeys) {
                    if (webLinkPayload.hasOwnProperty(key)) {
                        if (key === 'password') {
                            // Let pre-save hook handle hashing or clearing
                            collector.settings.web_link.password = webLinkPayload.password;
                        } else if (key === 'customSlug') {
                            const newSlug = webLinkPayload.customSlug ? webLinkPayload.customSlug.trim() : undefined;
                            const oldSlug = collector.settings.web_link.customSlug;
                            // Slug will be lowercased by model's pre-save hook.
                            // Check for uniqueness only if slug is changed and is not empty.
                            if (newSlug && newSlug !== oldSlug) {
                                const existingSlugCollector = await Collector.findOne({
                                    'settings.web_link.customSlug': newSlug.toLowerCase(), // Query normalized slug
                                    _id: { $ne: collectorId } // Exclude current collector
                                }).session(session);
                                if (existingSlugCollector) {
                                    await session.abortTransaction(); session.endSession();
                                    return res.status(400).json({ success: false, message: 'This custom slug is already in use.' });
                                }
                            }
                            collector.settings.web_link.customSlug = newSlug;
                        } else if (key === 'maxResponses') {
                            const parsedMax = parseInt(webLinkPayload.maxResponses, 10);
                            collector.settings.web_link.maxResponses = (isNaN(parsedMax) || parsedMax <= 0) ? null : parsedMax;
                        } else if (['allowBackButton', 'enableRecaptcha', 'allowMultipleResponses', 'anonymousResponses', 'progressBarEnabled', 'passwordProtectionEnabled', 'saveAndContinueEnabled'].includes(key)) {
                            collector.settings.web_link[key] = !!webLinkPayload[key];
                        } else if (key === 'ipAllowlist' || key === 'ipBlocklist') {
                            collector.settings.web_link[key] = Array.isArray(webLinkPayload[key])
                                ? webLinkPayload[key].filter(ip => typeof ip === 'string' && ip.trim() !== '').map(ip => ip.trim())
                                : [];
                        } else {
                            collector.settings.web_link[key] = webLinkPayload[key];
                        }
                    }
                }
            } else if (effectiveType && settings[effectiveType]) {
                // Handle settings for other types if they exist
                if (!collector.settings[effectiveType]) collector.settings[effectiveType] = {};
                collector.settings[effectiveType] = { ...collector.settings[effectiveType], ...settings[effectiveType] };
            }
            collector.markModified('settings'); // Important!
        }

        const updatedCollector = await collector.save({ session });
        await session.commitTransaction();
        session.endSession();

        const collectorObject = updatedCollector.toObject();
        if (collectorObject.settings?.web_link?.password) {
            delete collectorObject.settings.web_link.password;
        }
        res.status(200).json({ success: true, data: collectorObject });

    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        session.endSession();
        console.error(`[collectorController.updateCollector] Error for collector ${collectorId}:`, error);
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ success: false, message: messages.join('. '), errors: error.errors });
        }
        if (error.code === 11000) {
            if (error.keyPattern && error.keyPattern['settings.web_link.customSlug']) {
                return res.status(400).json({ success: false, message: 'This custom slug is already in use.' });
            }
            if (error.keyPattern && error.keyPattern.linkId) {
                return res.status(500).json({ success: false, message: 'Unique link ID generation conflict. Please try again.' });
            }
            return res.status(400).json({ success: false, message: 'A unique field constraint was violated.', errorDetails: error.keyValue });
        }
        res.status(500).json({ success: false, message: 'Error updating collector. Check server logs.' });
    }
};

// @desc    Delete a collector
// @route   DELETE /api/surveys/:surveyId/collectors/:collectorId
// @access  Private
exports.deleteCollector = async (req, res) => {
    const { surveyId, collectorId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(collectorId)) {
        return res.status(400).json({ success: false, message: 'Invalid Collector ID format.' });
    }
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const collector = await Collector.findOne({ _id: collectorId, survey: surveyId }).session(session);
        if (!collector) {
            await session.abortTransaction(); session.endSession();
            return res.status(404).json({ success: false, message: 'Collector not found or does not belong to this survey.' });
        }
        
        await Collector.deleteOne({ _id: collectorId }, { session });

        await Survey.findByIdAndUpdate(
            surveyId,
            { $pull: { collectors: collectorId } },
            { session }
        );

        await session.commitTransaction();
        session.endSession();
        res.status(200).json({ success: true, message: 'Collector deleted successfully.', data: { id: collectorId } });
    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        session.endSession();
        console.error(`[collectorController.deleteCollector] Error for collector ${collectorId}:`, error);
        res.status(500).json({ success: false, message: 'Error deleting collector.' });
    }
};
// ----- END OF COMPLETE UPDATED FILE (v1.6 - Integrated with new Collector model) -----