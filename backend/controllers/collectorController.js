// backend/controllers/collectorController.js
// ----- START OF COMPLETE UPDATED FILE (v1.1 - Handle reCAPTCHA setting) -----
const mongoose = require('mongoose');
const Collector = require('../models/Collector');
const Survey = require('../models/Survey');

// @desc    Create a new collector for a survey
// @route   POST /api/surveys/:surveyId/collectors
// @access  Private (Survey ownership/admin checked by authorizeSurveyAccess middleware)
exports.createCollector = async (req, res) => {
    const { surveyId } = req.params;
    const { name, type, status, settings } = req.body;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        if (req.survey.status === 'archived') {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ success: false, message: 'Cannot add collectors to an archived survey.' });
        }

        const collectorData = {
            survey: surveyId,
            name: name || `Web Link Collector on ${new Date().toLocaleDateString()}`,
            type: type || 'web_link',
            status: status || 'draft',
            settings: {}
        };

        if (collectorData.type === 'web_link') {
            collectorData.settings.web_link = {}; // Initialize web_link settings
            if (settings && settings.web_link) {
                // Explicitly copy known and allowed web_link settings
                const allowedKeys = ['customSlug', 'password', 'openDate', 'closeDate', 'maxResponses', 'allowMultipleResponses', 'anonymousResponses', 'enableRecaptcha'];
                for (const key of allowedKeys) {
                    if (settings.web_link.hasOwnProperty(key)) {
                        if (key === 'password' && settings.web_link.password === '') {
                            collectorData.settings.web_link.password = undefined; // Clear password
                        } else {
                            collectorData.settings.web_link[key] = settings.web_link[key];
                        }
                    }
                }

                if (collectorData.settings.web_link.customSlug) {
                    const existingSlug = await Collector.findOne({
                        'settings.web_link.customSlug': collectorData.settings.web_link.customSlug
                    }).session(session);
                    if (existingSlug) {
                        await session.abortTransaction();
                        session.endSession();
                        return res.status(400).json({ success: false, message: 'This custom slug is already in use.' });
                    }
                }
            }
        } else if (collectorData.type) { // For other types in the future
            if (settings && settings[collectorData.type]) {
                 collectorData.settings[collectorData.type] = { ...settings[collectorData.type] };
            }
        }

        const newCollector = new Collector(collectorData);
        const savedCollector = await newCollector.save({ session });

        await Survey.findByIdAndUpdate(
            surveyId,
            { $addToSet: { collectors: savedCollector._id } },
            { session, new: true, runValidators: true }
        );

        await session.commitTransaction();
        session.endSession();

        const responseData = savedCollector.toObject();
        if (responseData.settings && responseData.settings.web_link && responseData.settings.web_link.password) {
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
        if (error.code === 11000) {
            if (error.keyValue && error.keyValue['settings.web_link.customSlug']) {
                return res.status(400).json({ success: false, message: 'This custom slug is already in use (database constraint).' });
            }
            if (error.keyValue && error.keyValue.linkId) {
                return res.status(400).json({ success: false, message: 'Failed to generate a unique link ID. Please try again (database constraint).' });
            }
            return res.status(400).json({ success: false, message: 'A unique field constraint was violated. Please check your input.', errorDetails: error.keyValue });
        }
        res.status(500).json({ success: false, message: 'Error creating collector. Please check server logs for details.' });
    }
};

// @desc    Get all collectors for a specific survey
// @route   GET /api/surveys/:surveyId/collectors
// @access  Private (Survey ownership/admin checked by authorizeSurveyAccess middleware)
exports.getCollectorsForSurvey = async (req, res) => {
    const { surveyId } = req.params;
    try {
        const collectors = await Collector.find({ survey: surveyId })
            .select('-settings.web_link.password')
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
// @access  Private (Survey ownership/admin checked by authorizeSurveyAccess middleware)
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
        const collectorObject = collector.toObject();
        if (collectorObject.settings && collectorObject.settings.web_link && collectorObject.settings.web_link.password) {
            delete collectorObject.settings.web_link.password;
        }
        res.status(200).json({ success: true, data: collectorObject });
    } catch (error) {
        console.error(`[collectorController.getCollectorById] Error for survey ${surveyId}, collector ${collectorId}:`, error);
        res.status(500).json({ success: false, message: 'Error fetching collector details.' });
    }
};

// @desc    Update a collector
// @route   PUT /api/surveys/:surveyId/collectors/:collectorId
// @access  Private (Survey ownership/admin checked by authorizeSurveyAccess middleware)
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
                                     .select('+settings.web_link.password')
                                     .session(session);

        if (!collector) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ success: false, message: 'Collector not found or does not belong to this survey.' });
        }

        if (name !== undefined) collector.name = name;
        if (type !== undefined) collector.type = type;
        if (status !== undefined) collector.status = status;

        if (settings) {
            const effectiveType = type !== undefined ? type : collector.type;
            if (effectiveType === 'web_link') {
                if (!collector.settings.web_link) collector.settings.web_link = {};
                if (settings.web_link) {
                    const newWebLinkSettings = settings.web_link;
                    // Define allowed keys for web_link settings to prevent unwanted fields
                    const allowedWebLinkKeys = ['customSlug', 'password', 'openDate', 'closeDate', 'maxResponses', 'allowMultipleResponses', 'anonymousResponses', 'enableRecaptcha']; // <<<--- ADD 'enableRecaptcha'

                    for (const key of allowedWebLinkKeys) {
                        if (newWebLinkSettings.hasOwnProperty(key)) {
                             if (key === 'password') {
                                collector.settings.web_link.password = newWebLinkSettings.password === '' ? undefined : newWebLinkSettings.password;
                            } else if (key === 'maxResponses') {
                                const parsedMax = parseInt(newWebLinkSettings.maxResponses, 10);
                                collector.settings.web_link.maxResponses = (isNaN(parsedMax) || parsedMax <=0) ? null : parsedMax;
                            } else if (key === 'enableRecaptcha') { // <<<--- ADD THIS BLOCK
                                collector.settings.web_link.enableRecaptcha = !!newWebLinkSettings.enableRecaptcha; // Ensure boolean
                            } else {
                                collector.settings.web_link[key] = newWebLinkSettings[key];
                            }
                        }
                    }

                    if (newWebLinkSettings.customSlug && newWebLinkSettings.customSlug !== (collector.settings.web_link && collector.settings.web_link.customSlug)) {
                         const existingSlug = await Collector.findOne({
                            'settings.web_link.customSlug': newWebLinkSettings.customSlug,
                            _id: { $ne: collectorId }
                        }).session(session);
                        if (existingSlug) {
                            await session.abortTransaction();
                            session.endSession();
                            return res.status(400).json({ success: false, message: 'This custom slug is already in use.' });
                        }
                    }
                }
            }
            if (Object.keys(settings).length > 0) {
                collector.markModified('settings');
            }
        }

        const updatedCollector = await collector.save({ session });
        await session.commitTransaction();
        session.endSession();

        const collectorObject = updatedCollector.toObject();
        if (collectorObject.settings && collectorObject.settings.web_link && collectorObject.settings.web_link.password) {
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
             if (error.keyValue && error.keyValue['settings.web_link.customSlug']) {
                return res.status(400).json({ success: false, message: 'This custom slug is already in use (database constraint).' });
            }
            return res.status(400).json({ success: false, message: 'A unique field constraint was violated.', errorDetails: error.keyValue });
        }
        res.status(500).json({ success: false, message: 'Error updating collector. Check server logs.' });
    }
};

// @desc    Delete a collector
// @route   DELETE /api/surveys/:surveyId/collectors/:collectorId
// @access  Private (Survey ownership/admin checked by authorizeSurveyAccess middleware)
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
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ success: false, message: 'Collector not found or does not belong to this survey.' });
        }
        await Collector.findByIdAndDelete(collectorId, { session });
        await Survey.findByIdAndUpdate(
            surveyId,
            { $pull: { collectors: collectorId } },
            { session, new: true }
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
// ----- END OF COMPLETE UPDATED FILE (v1.1 - Handle reCAPTCHA setting) -----