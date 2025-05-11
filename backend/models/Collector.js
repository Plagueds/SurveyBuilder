// backend/models/Collector.js
// ----- START OF COMPLETE UPDATED FILE (v1.2 - Added reCAPTCHA setting) -----
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

// --- Sub-schema for Web Link Collector Settings ---
const webLinkCollectorSettingsSchema = new Schema({
    _id: false,
    customSlug: {
        type: String,
        trim: true,
        unique: true,
        sparse: true,
        match: [/^[a-zA-Z0-9-_]+$/, 'Custom slug can only contain letters, numbers, hyphens, and underscores.']
    },
    password: {
        type: String,
        select: false
    },
    openDate: { type: Date, default: null },
    closeDate: { type: Date, default: null },
    maxResponses: { type: Number, min: 1, default: null },
    allowMultipleResponses: { type: Boolean, default: false },
    anonymousResponses: { type: Boolean, default: false },
    enableRecaptcha: { type: Boolean, default: false } // <<<--- ADDED THIS LINE
});

// --- Main Collector Schema ---
const collectorSchema = new Schema({
    survey: {
        type: Schema.Types.ObjectId,
        ref: 'Survey',
        required: [true, 'Survey ID is required for a collector.'],
        index: true,
    },
    name: {
        type: String,
        trim: true,
        required: [true, 'Collector name is required.'],
        default: 'Web Link Collector',
    },
    type: {
        type: String,
        required: [true, 'Collector type is required.'],
        enum: ['web_link', 'email_invitation', 'embed', 'sms'],
        default: 'web_link',
        index: true,
    },
    status: {
        type: String,
        enum: ['draft', 'open', 'paused', 'closed', 'completed_quota', 'error'],
        default: 'draft',
        index: true,
    },
    linkId: {
        type: String,
        unique: true,
        sparse: true,
        default: function() {
            return this.type === 'web_link' ? uuidv4().replace(/-/g, '').substring(0, 16) : undefined;
        }
    },
    settings: {
        web_link: { type: webLinkCollectorSettingsSchema, default: () => ({}) },
        // email_invitation: { type: emailCollectorSettingsSchema, default: () => ({}) },
        // embed: { type: embedCollectorSettingsSchema, default: () => ({}) },
    },
    responseCount: {
        type: Number,
        default: 0,
        min: 0,
    },
}, {
    timestamps: true,
});

// --- Indexes ---
collectorSchema.index({ survey: 1, type: 1 });
collectorSchema.index({ survey: 1, status: 1 });

// --- Pre-save Hooks ---
collectorSchema.pre('save', async function(next) {
    if (this.isModified('type') || this.isNew) {
        const currentTypeKey = this.type;
        for (const key in this.settings) {
            if (key !== currentTypeKey && key !== '_id' && key !== '$isSingleNested' && this.settings.hasOwnProperty(key)) {
                this.settings[key] = undefined;
            }
        }
        if (this.type === 'web_link' && !this.settings.web_link) {
            this.settings.web_link = {};
        }
    }

    if (this.type === 'web_link' && !this.linkId) {
        this.linkId = uuidv4().replace(/-/g, '').substring(0, 16);
    }
    if (this.type !== 'web_link') {
        this.linkId = undefined;
        if (this.settings.web_link) this.settings.web_link.customSlug = undefined;
    }

    if (this.type === 'web_link' && this.settings && this.settings.web_link && this.isModified('settings.web_link.password') && this.settings.web_link.password) {
        try {
            const salt = await bcrypt.genSalt(10);
            this.settings.web_link.password = await bcrypt.hash(this.settings.web_link.password, salt);
        } catch (error) {
            return next(error);
        }
    }
    if (this.type === 'web_link' && this.settings && this.settings.web_link && this.isModified('settings.web_link.password') && !this.settings.web_link.password) {
        this.settings.web_link.password = undefined;
    }
    next();
});

// --- Instance Methods ---
collectorSchema.methods.comparePassword = async function(enteredPassword) {
    if (this.type !== 'web_link' || !this.settings || !this.settings.web_link || !this.settings.web_link.password) {
        return false;
    }
    const collectorWithPassword = await mongoose.model('Collector').findById(this._id).select('+settings.web_link.password').exec();
    if (!collectorWithPassword || !collectorWithPassword.settings || !collectorWithPassword.settings.web_link || !collectorWithPassword.settings.web_link.password) {
        return false;
    }
    return await bcrypt.compare(enteredPassword, collectorWithPassword.settings.web_link.password);
};

const Collector = mongoose.model('Collector', collectorSchema);
module.exports = Collector;
// ----- END OF COMPLETE UPDATED FILE (v1.2 - Added reCAPTCHA setting) -----