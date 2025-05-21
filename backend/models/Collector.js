// backend/models/Collector.js
// ----- START OF COMPLETE UPDATED FILE (v1.8 - Fixed IP List Validators) -----
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { v4: uuidv4 } = require('uuid'); // Used for default linkId generation
const bcrypt = require('bcryptjs');
const crypto = require('crypto'); // For more robust random string generation if needed

// --- Sub-schema for Web Link Collector Settings ---
const webLinkCollectorSettingsSchema = new Schema({
    _id: false,
    customSlug: {
        type: String,
        trim: true,
        lowercase: true, // Normalize to lowercase
        unique: true,
        sparse: true, // Allows multiple collectors to not have a slug, but if set, it must be unique
        match: [/^[a-z0-9][a-z0-9-_]{1,48}[a-z0-9]$/, 'Custom slug must be 3-50 characters, start/end with alphanumeric, and contain only letters, numbers, hyphens, or underscores.'],
    },
    passwordProtectionEnabled: { type: Boolean, default: false }, 
    password: {
        type: String,
        select: false 
    },
    openDate: { type: Date, default: null },
    closeDate: { type: Date, default: null },
    maxResponses: { type: Number, min: 0, default: null }, // min:0 allows 0, null for unlimited
    allowMultipleResponses: { type: Boolean, default: false },
    anonymousResponses: { type: Boolean, default: false },
    enableRecaptcha: { type: Boolean, default: false },
    recaptchaSiteKey: { type: String, trim: true, default: '' }, 
    ipAllowlist: {
        type: [String],
        default: [],
        validate: {
            validator: function(arr) {
                if (!Array.isArray(arr)) return false;
                return arr.every(ip => typeof ip === 'string' && ip.trim().length > 0);
            },
            message: props => `${props.path} must be an array of valid, non-empty IP addresses or CIDR ranges.`
        }
    },
    ipBlocklist: {
        type: [String],
        default: [],
        validate: {
            validator: function(arr) {
                if (!Array.isArray(arr)) return false;
                return arr.every(ip => typeof ip === 'string' && ip.trim().length > 0);
            },
            message: props => `${props.path} must be an array of valid, non-empty IP addresses or CIDR ranges.`
        }
    },
    allowBackButton: { type: Boolean, default: true },
    progressBarEnabled: { type: Boolean, default: false },
    progressBarStyle: {
        type: String,
        enum: ['percentage', 'pages'],
        default: 'percentage'
    },
    progressBarPosition: {
        type: String,
        enum: ['top', 'bottom'],
        default: 'top'
    },
    saveAndContinueEnabled: { type: Boolean, default: undefined } 
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
        index: true,
    },
    settings: {
        web_link: { type: webLinkCollectorSettingsSchema, default: () => ({}) },
    },
    responseCount: {
        type: Number,
        default: 0,
        min: 0,
    },
    createdBy: { 
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true 
    }
}, {
    timestamps: true,
});

collectorSchema.index({ survey: 1, type: 1 });
collectorSchema.index({ survey: 1, status: 1 });

const generateUniqueLinkId = async () => {
    let linkId;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 5; 

    while (!isUnique && attempts < maxAttempts) {
        linkId = crypto.randomBytes(6).toString('hex'); 
        const existingCollector = await mongoose.model('Collector').findOne({ linkId: linkId });
        if (!existingCollector) {
            isUnique = true;
        }
        attempts++;
    }
    if (!isUnique) {
        console.error("Failed to generate a unique linkId after multiple attempts.");
        linkId = uuidv4().replace(/-/g, '').substring(0, 16); 
        const existingFallback = await mongoose.model('Collector').findOne({ linkId: linkId });
        if (existingFallback) throw new Error("CRITICAL: Could not generate unique linkId.");
    }
    return linkId;
};

collectorSchema.pre('save', async function(next) {
    if (this.isModified('type') || this.isNew) {
        const currentTypeKey = this.type;
        const settingKeys = Object.keys(this.settings.toObject()); 
        for (const key of settingKeys) {
            if (key !== currentTypeKey && key !== '_id' && key !== '$isSingleNested') {
                this.settings[key] = undefined;
            }
        }
        if (this.type === 'web_link' && !this.settings.web_link) {
            this.settings.web_link = {}; 
        }
    }

    if (this.type === 'web_link' && this.isNew && !this.linkId) {
        try {
            this.linkId = await generateUniqueLinkId();
        } catch (err) {
            return next(err); 
        }
    }

    if (this.type !== 'web_link') {
        this.linkId = undefined;
        if (this.settings?.web_link) { 
            this.settings.web_link.customSlug = undefined;
        }
    }

    if (this.type === 'web_link' && this.settings?.web_link && this.isModified('settings.web_link.password')) {
        if (this.settings.web_link.password && this.settings.web_link.password.length > 0) { 
            try {
                const salt = await bcrypt.genSalt(10);
                this.settings.web_link.password = await bcrypt.hash(this.settings.web_link.password, salt);
                this.settings.web_link.passwordProtectionEnabled = true; 
            } catch (error) {
                return next(error);
            }
        } else {
            this.settings.web_link.password = undefined;
            this.settings.web_link.passwordProtectionEnabled = false;
        }
    }

    if (this.type === 'web_link' && this.settings?.web_link &&
        this.isModified('settings.web_link.passwordProtectionEnabled') &&
        this.settings.web_link.passwordProtectionEnabled === false) {
        this.settings.web_link.password = undefined;
    }
    next();
});

collectorSchema.methods.comparePassword = async function(enteredPassword) {
    if (this.type !== 'web_link' || !this.settings?.web_link?.passwordProtectionEnabled || !this.settings?.web_link?.password) {
        return false; 
    }
    const collectorWithPassword = await mongoose.model('Collector').findById(this._id).select('+settings.web_link.password').exec();
    if (!collectorWithPassword || !collectorWithPassword.settings?.web_link?.password) {
        return false; 
    }
    return await bcrypt.compare(enteredPassword, collectorWithPassword.settings.web_link.password);
};

const Collector = mongoose.model('Collector', collectorSchema);
module.exports = Collector;
// ----- END OF COMPLETE UPDATED FILE (v1.8 - Fixed IP List Validators) -----