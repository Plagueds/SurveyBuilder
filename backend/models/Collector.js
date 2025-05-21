// backend/models/Collector.js
// ----- START OF COMPLETE UPDATED FILE (v1.7 - Refined linkId and customSlug handling) -----
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
        // Example: starts and ends with alphanumeric, allows hyphens/underscores in middle, total 3-50 chars.
        // Adjust regex as needed. Current one: /^[a-zA-Z0-9-_]+$/
    },
    passwordProtectionEnabled: { type: Boolean, default: false }, // Added for clarity
    password: {
        type: String,
        select: false // Good practice: don't send password hash by default
    },
    openDate: { type: Date, default: null },
    closeDate: { type: Date, default: null },
    maxResponses: { type: Number, min: 1, default: null },
    allowMultipleResponses: { type: Boolean, default: false },
    anonymousResponses: { type: Boolean, default: false },
    enableRecaptcha: { type: Boolean, default: false },
    recaptchaSiteKey: { type: String, trim: true, default: '' }, // Frontend uses its own key for widget
    ipAllowlist: {
        type: [String],
        default: [],
        validate: { /* your existing validation */ }
    },
    ipBlocklist: {
        type: [String],
        default: [],
        validate: { /* your existing validation */ }
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
    // New field to explicitly enable/disable save & continue at collector level
    saveAndContinueEnabled: { type: Boolean, default: undefined } // undefined means inherit from survey
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
        enum: ['web_link', 'email_invitation', 'embed', 'sms'], // Add other types as you build them
        default: 'web_link',
        index: true,
    },
    status: {
        type: String,
        enum: ['draft', 'open', 'paused', 'closed', 'completed_quota', 'error'],
        default: 'draft',
        index: true,
    },
    linkId: { // For auto-generated public links
        type: String,
        unique: true,
        sparse: true, // Important if only web_link types have it
        index: true,
        // Default generation will be handled in pre-save or controller for more control
    },
    settings: {
        web_link: { type: webLinkCollectorSettingsSchema, default: () => ({}) },
        // email_invitation: { type: emailInvitationSettingsSchema, default: () => ({}) },
        // embed: { type: embedSettingsSchema, default: () => ({}) },
    },
    responseCount: {
        type: Number,
        default: 0,
        min: 0,
    },
    createdBy: { // Added createdBy for audit/ownership
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true // Assuming collectors are always created by a user
    }
}, {
    timestamps: true,
});

// --- Indexes ---
collectorSchema.index({ survey: 1, type: 1 });
collectorSchema.index({ survey: 1, status: 1 });
// Unique index for customSlug is defined within the sub-schema (sparse:true is key)
// Unique index for linkId is defined on the field itself (sparse:true is key)

// --- Helper for linkId generation ---
// You might want a more robust unique string generator for very high scale
// but this is a common approach.
const generateUniqueLinkId = async () => {
    let linkId;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 5; // Prevent infinite loops

    while (!isUnique && attempts < maxAttempts) {
        linkId = crypto.randomBytes(6).toString('hex'); // Generates a 12-character hex string
        const existingCollector = await mongoose.model('Collector').findOne({ linkId: linkId });
        if (!existingCollector) {
            isUnique = true;
        }
        attempts++;
    }
    if (!isUnique) {
        // Fallback or throw error if a unique ID couldn't be generated
        // This is highly unlikely with sufficient randomness and length
        console.error("Failed to generate a unique linkId after multiple attempts.");
        // Potentially use a longer string or a different generation strategy as a fallback
        linkId = uuidv4().replace(/-/g, '').substring(0, 16); // Fallback to existing method if crypto fails
        const existingFallback = await mongoose.model('Collector').findOne({ linkId: linkId });
        if (existingFallback) throw new Error("CRITICAL: Could not generate unique linkId.");
    }
    return linkId;
};


// --- Pre-save Hooks ---
collectorSchema.pre('save', async function(next) {
    // Clear settings for other types if type changes
    if (this.isModified('type') || this.isNew) {
        const currentTypeKey = this.type;
        const settingKeys = Object.keys(this.settings.toObject()); // Get actual keys from subdocument
        for (const key of settingKeys) {
            if (key !== currentTypeKey && key !== '_id' && key !== '$isSingleNested') {
                this.settings[key] = undefined;
            }
        }
        if (this.type === 'web_link' && !this.settings.web_link) {
            this.settings.web_link = {}; // Ensure web_link settings object exists
        }
    }

    // Auto-generate linkId for new web_link collectors if not already set
    if (this.type === 'web_link' && this.isNew && !this.linkId) {
        try {
            this.linkId = await generateUniqueLinkId();
        } catch (err) {
            return next(err); // Propagate error if linkId generation fails critically
        }
    }

    // Clear linkId and customSlug if type is not web_link
    if (this.type !== 'web_link') {
        this.linkId = undefined;
        if (this.settings?.web_link) { // Check if web_link settings exist
            this.settings.web_link.customSlug = undefined;
        }
    }

    // Hash password for web_link if it's modified and present
    if (this.type === 'web_link' && this.settings?.web_link && this.isModified('settings.web_link.password')) {
        if (this.settings.web_link.password && this.settings.web_link.password.length > 0) { // Only hash if password is not empty
            try {
                const salt = await bcrypt.genSalt(10);
                this.settings.web_link.password = await bcrypt.hash(this.settings.web_link.password, salt);
                this.settings.web_link.passwordProtectionEnabled = true; // Automatically enable if password is set
            } catch (error) {
                return next(error);
            }
        } else {
            // If password is set to empty string or null, remove it and disable protection
            this.settings.web_link.password = undefined;
            this.settings.web_link.passwordProtectionEnabled = false;
        }
    }

    // If passwordProtectionEnabled is explicitly set to false, clear the password
    if (this.type === 'web_link' && this.settings?.web_link &&
        this.isModified('settings.web_link.passwordProtectionEnabled') &&
        this.settings.web_link.passwordProtectionEnabled === false) {
        this.settings.web_link.password = undefined;
    }


    next();
});

// --- Instance Methods ---
collectorSchema.methods.comparePassword = async function(enteredPassword) {
    if (this.type !== 'web_link' || !this.settings?.web_link?.passwordProtectionEnabled || !this.settings?.web_link?.password) {
        return false; // No password protection or no password set
    }
    // Fetch the document again to ensure the password field is selected
    // This is a common pattern if 'select: false' is used on the password field.
    const collectorWithPassword = await mongoose.model('Collector').findById(this._id).select('+settings.web_link.password').exec();
    if (!collectorWithPassword || !collectorWithPassword.settings?.web_link?.password) {
        return false; // Should not happen if the above checks passed, but good for safety
    }
    return await bcrypt.compare(enteredPassword, collectorWithPassword.settings.web_link.password);
};

const Collector = mongoose.model('Collector', collectorSchema);
module.exports = Collector;
// ----- END OF COMPLETE UPDATED FILE (v1.7 - Refined linkId and customSlug handling) -----