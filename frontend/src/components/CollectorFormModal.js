// frontend/src/components/CollectorFormModal.js
// ----- START OF COMPLETE UPDATED FILE (v1.7 - Enhanced linkId/customSlug UI & saveAndContinue) -----
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import surveyApiFunctions from '../api/surveyApi';
import { toast } from 'react-toastify';
import styles from './CollectorFormModal.module.css';

// Helper to get the base URL for constructing shareable links
const getPublicSiteUrl = () => {
    // Use REACT_APP_PUBLIC_SURVEY_URL if defined, otherwise fallback to current origin
    // This allows for different domains for the app and the public-facing survey links if needed.
    return process.env.REACT_APP_PUBLIC_SURVEY_URL || window.location.origin;
};

const CollectorFormModal = ({ isOpen, onClose, surveyId, existingCollector, onSave }) => {
    const isEditMode = Boolean(existingCollector);
    const shareableBaseUrl = useMemo(() => `${getPublicSiteUrl()}/s/`, []);

    const getInitialFormData = useCallback(() => {
        const defaults = {
            name: '',
            type: 'web_link', // This modal is currently focused on web_link
            status: 'draft',
            settings: {
                web_link: {
                    customSlug: '',
                    passwordProtectionEnabled: false,
                    password: '', // Input field, not the stored hash
                    openDate: '',
                    closeDate: '',
                    maxResponses: 0, // 0 for unlimited
                    allowMultipleResponses: false,
                    anonymousResponses: false,
                    enableRecaptcha: false,
                    // recaptchaSiteKey: '', // Usually global, but can be overridden
                    ipAllowlistString: '',
                    ipBlocklistString: '',
                    allowBackButton: true,
                    progressBarEnabled: false,
                    progressBarStyle: 'percentage',
                    progressBarPosition: 'top',
                    saveAndContinueEnabled: undefined, // 'undefined' means inherit from survey
                }
            }
        };

        if (isEditMode && existingCollector) {
            const existingWebLinkSettings = existingCollector.settings?.web_link || {};
            const mergedWebLinkSettings = {
                ...defaults.settings.web_link, // Start with defaults
                ...existingWebLinkSettings,    // Override with existing settings
                // Explicitly handle boolean conversions and specific formatting
                customSlug: existingWebLinkSettings.customSlug || '',
                passwordProtectionEnabled: Boolean(existingWebLinkSettings.passwordProtectionEnabled), // Ensure boolean
                password: '', // Always clear password field for editing for security
                openDate: existingWebLinkSettings.openDate ? new Date(existingWebLinkSettings.openDate).toISOString().slice(0, 16) : '',
                closeDate: existingWebLinkSettings.closeDate ? new Date(existingWebLinkSettings.closeDate).toISOString().slice(0, 16) : '',
                maxResponses: existingWebLinkSettings.maxResponses === null || existingWebLinkSettings.maxResponses === undefined ? 0 : existingWebLinkSettings.maxResponses,
                allowMultipleResponses: Boolean(existingWebLinkSettings.allowMultipleResponses),
                anonymousResponses: Boolean(existingWebLinkSettings.anonymousResponses),
                enableRecaptcha: Boolean(existingWebLinkSettings.enableRecaptcha),
                ipAllowlistString: Array.isArray(existingWebLinkSettings.ipAllowlist) ? existingWebLinkSettings.ipAllowlist.join('\n') : '',
                ipBlocklistString: Array.isArray(existingWebLinkSettings.ipBlocklist) ? existingWebLinkSettings.ipBlocklist.join('\n') : '',
                allowBackButton: typeof existingWebLinkSettings.allowBackButton === 'boolean' ? existingWebLinkSettings.allowBackButton : true,
                progressBarEnabled: Boolean(existingWebLinkSettings.progressBarEnabled),
                progressBarStyle: existingWebLinkSettings.progressBarStyle || 'percentage',
                progressBarPosition: existingWebLinkSettings.progressBarPosition || 'top',
                saveAndContinueEnabled: existingWebLinkSettings.saveAndContinueEnabled, // Can be true, false, or undefined
            };

            return {
                name: existingCollector.name || '',
                type: existingCollector.type || 'web_link',
                status: existingCollector.status || 'draft',
                linkId: existingCollector.linkId || null, // Store linkId for display
                settings: {
                    ...defaults.settings, // Ensure structure for other types if modal expands
                    web_link: mergedWebLinkSettings
                }
            };
        }
        return defaults;
    }, [isEditMode, existingCollector]);

    const [formData, setFormData] = useState(getInitialFormData());
    const [isSaving, setIsSaving] = useState(false);
    const [errors, setErrors] = useState({});
    const [generatedLinkDisplay, setGeneratedLinkDisplay] = useState('');

    useEffect(() => {
        if (isOpen) {
            const initialData = getInitialFormData();
            setFormData(initialData);
            setErrors({});
            if (isEditMode && initialData.linkId) {
                setGeneratedLinkDisplay(`${shareableBaseUrl}${initialData.linkId}`);
            } else if (!isEditMode) {
                setGeneratedLinkDisplay('Will be generated upon saving.');
            } else {
                setGeneratedLinkDisplay('');
            }
        }
    }, [isOpen, getInitialFormData, isEditMode, shareableBaseUrl]);


    if (!isOpen) {
        return null;
    }

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        const newErrors = { ...errors };

        if (name.startsWith("settings.web_link.")) {
            const field = name.split(".").pop();
            setFormData(prev => ({
                ...prev,
                settings: {
                    ...prev.settings,
                    web_link: {
                        ...prev.settings.web_link,
                        [field]: type === 'checkbox' ? checked : value
                    }
                }
            }));
            if (newErrors[`web_link_${field}`]) delete newErrors[`web_link_${field}`];
        } else {
            setFormData(prev => ({
                ...prev,
                [name]: type === 'checkbox' ? checked : value
            }));
            if (newErrors[name]) delete newErrors[name];
        }
        setErrors(newErrors); // Clear specific error on change
    };
    
    const handleSaveAndContinueChange = (value) => { // For a tristate: true, false, undefined
        setFormData(prev => ({
            ...prev,
            settings: {
                ...prev.settings,
                web_link: {
                    ...prev.settings.web_link,
                    saveAndContinueEnabled: value
                }
            }
        }));
    };


    const parseIpListString = (ipString) => {
        if (!ipString || typeof ipString !== 'string') return [];
        return ipString
            .split(/[\n,]+/) // Split by newline or comma
            .map(ip => ip.trim())
            .filter(ip => ip.length > 0);
    };


    const validateForm = () => {
        const newErrors = {};
        if (!formData.name.trim()) {
            newErrors.name = "Collector name is required.";
        }
        const wlSettings = formData.settings.web_link;

        if (wlSettings.customSlug && !/^[a-z0-9][a-z0-9-_]{1,48}[a-z0-9]$/.test(wlSettings.customSlug.toLowerCase())) {
            newErrors.web_link_customSlug = "Slug: 3-50 chars, alphanumeric/hyphens/underscores, start/end alphanumeric.";
        }

        // Password validation: only if protection is enabled AND (it's a new collector OR a password value is actually entered for edit mode)
        if (wlSettings.passwordProtectionEnabled) {
            if (!isEditMode && !wlSettings.password) { // Required for new collector if enabled
                newErrors.web_link_password = "Password is required when protection is enabled.";
            } else if (wlSettings.password && wlSettings.password.length < 6) { // If password is provided, check length
                newErrors.web_link_password = "Password must be at least 6 characters long.";
            }
        }

        if (wlSettings.openDate && wlSettings.closeDate && new Date(wlSettings.openDate) >= new Date(wlSettings.closeDate)) {
            newErrors.web_link_closeDate = "Close date must be after the open date.";
        }
        
        const maxResponsesNum = parseInt(wlSettings.maxResponses, 10);
        if (wlSettings.maxResponses !== '' && (isNaN(maxResponsesNum) || maxResponsesNum < 0)) { // Allow empty string for "0" or null
            newErrors.web_link_maxResponses = "Max responses must be a non-negative number (or 0 for unlimited).";
        }

        // Basic IP validation (just checking for spaces as an example, more robust validation is complex)
        const allowlist = parseIpListString(wlSettings.ipAllowlistString);
        if (allowlist.some(ip => ip.includes(' '))) { // Example: disallow spaces within an IP entry
            newErrors.web_link_ipAllowlistString = "IPs/CIDRs in allowlist should not contain spaces within an entry.";
        }
        const blocklist = parseIpListString(wlSettings.ipBlocklistString);
        if (blocklist.some(ip => ip.includes(' '))) {
            newErrors.web_link_ipBlocklistString = "IPs/CIDRs in blocklist should not contain spaces within an entry.";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) {
            toast.warn("Please correct the errors in the form.");
            return;
        }
        setIsSaving(true);
        setErrors({}); // Clear previous errors

        const wlSettings = formData.settings.web_link;
        const parsedMaxResponses = parseInt(wlSettings.maxResponses, 10);

        const payloadSettingsWebLink = {
            ...wlSettings, // Includes all boolean toggles, style, position
            customSlug: wlSettings.customSlug ? wlSettings.customSlug.trim() : undefined, // Backend normalizes to lowercase
            openDate: wlSettings.openDate ? new Date(wlSettings.openDate).toISOString() : null,
            closeDate: wlSettings.closeDate ? new Date(wlSettings.closeDate).toISOString() : null,
            maxResponses: (isNaN(parsedMaxResponses) || parsedMaxResponses <= 0) ? null : parsedMaxResponses,
            // Password: send if protection enabled AND password is not empty.
            // If protection enabled and password empty, backend should ideally not update it if editing, or error if new.
            // Backend pre-save hook handles hashing or clearing.
            password: wlSettings.passwordProtectionEnabled && wlSettings.password ? wlSettings.password : undefined,
            passwordProtectionEnabled: wlSettings.passwordProtectionEnabled, // Send this explicitly
            ipAllowlist: parseIpListString(wlSettings.ipAllowlistString),
            ipBlocklist: parseIpListString(wlSettings.ipBlocklistString),
        };
        // Remove the temporary string versions from the payload
        delete payloadSettingsWebLink.ipAllowlistString;
        delete payloadSettingsWebLink.ipBlocklistString;
        
        // Handle saveAndContinueEnabled: send if not undefined
        if (wlSettings.saveAndContinueEnabled === undefined) {
            delete payloadSettingsWebLink.saveAndContinueEnabled;
        }


        const payload = {
            name: formData.name.trim(),
            type: formData.type, // Currently fixed to web_link for this modal
            status: formData.status,
            settings: {
                web_link: payloadSettingsWebLink
            }
        };
        
        try {
            let responseData;
            if (isEditMode) {
                const apiResponse = await surveyApiFunctions.updateCollector(surveyId, existingCollector._id, payload);
                responseData = apiResponse.data; // Assuming API returns {success: true, data: collector}
                toast.success("Collector updated successfully!");
            } else {
                const apiResponse = await surveyApiFunctions.createCollector(surveyId, payload);
                responseData = apiResponse.data;
                toast.success("Collector created successfully!");
            }
            onSave(responseData); // Pass back the full collector object
        } catch (error) {
            console.error("Error saving collector:", error.response?.data || error.message);
            const errorData = error.response?.data;
            let displayErrorMessage = "Failed to save collector. Please try again.";

            if (errorData) {
                displayErrorMessage = errorData.message || displayErrorMessage;
                if (errorData.errors) { // Handle specific field errors from backend validation
                    const backendErrors = {};
                    Object.entries(errorData.errors).forEach(([key, value]) => {
                        const fieldKey = key.replace('settings.web_link.', 'web_link_'); // Adjust key for frontend state
                        backendErrors[fieldKey] = value.message;
                    });
                    setErrors(prev => ({ ...prev, ...backendErrors }));
                    displayErrorMessage = "Please correct the highlighted errors.";
                } else if (errorData.message && errorData.message.toLowerCase().includes("custom slug is already in use")) {
                    setErrors(prev => ({ ...prev, web_link_customSlug: "This custom slug is already in use." }));
                    displayErrorMessage = "This custom slug is already in use.";
                } else if (errorData.message) {
                     setErrors(prev => ({ ...prev, general: errorData.message }));
                }
            } else if (error.message) {
                displayErrorMessage = error.message;
                 setErrors(prev => ({ ...prev, general: error.message }));
            }
            toast.error(displayErrorMessage);
        } finally {
            setIsSaving(false);
        }
    };

    const renderError = (fieldName) => errors[fieldName] ? <p className={styles.errorMessage}>{errors[fieldName]}</p> : null;

    // --- UI Rendering ---
    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modal}>
                <div className={styles.modalHeader}>
                    <h2>{isEditMode ? 'Edit Web Link Collector' : 'Add New Web Link Collector'}</h2>
                    <button onClick={onClose} className={styles.closeButton} disabled={isSaving}>&times;</button>
                </div>
                <form onSubmit={handleSubmit} className={styles.modalBody}>
                    {/* General Info */}
                    <div className={styles.formGroup}>
                        <label htmlFor="name">Collector Name</label>
                        <input type="text" id="name" name="name" value={formData.name} onChange={handleChange} className={errors.name ? styles.inputError : ""} disabled={isSaving} required />
                        {renderError("name")}
                    </div>
                    {/* Type is fixed to web_link for this modal for now */}
                    {/* <input type="hidden" name="type" value={formData.type} /> */}
                    <div className={styles.formGroup}>
                        <label htmlFor="status">Status</label>
                        <select id="status" name="status" value={formData.status} onChange={handleChange} disabled={isSaving}>
                            <option value="draft">Draft (Not collecting responses yet)</option>
                            <option value="open">Open (Actively collecting responses)</option>
                            <option value="paused">Paused (Temporarily not collecting)</option>
                            <option value="closed">Closed (Manually stopped collecting)</option>
                        </select>
                        {renderError("status")}
                    </div>

                    {/* Web Link Specific Settings */}
                    {formData.type === 'web_link' && (
                        <fieldset className={styles.settingsFieldset}>
                            <legend>Web Link Settings</legend>

                            {/* Display Generated Link */}
                            <div className={styles.formGroup}>
                                <label>Shareable Link (auto-generated)</label>
                                {isEditMode && formData.linkId ? (
                                    <div className={styles.shareLinkContainer}>
                                        <input type="text" value={generatedLinkDisplay} readOnly className={styles.shareLinkInput} onClick={(e) => e.target.select()} />
                                        <button type="button" className={`${styles.copyButton} button button-outline`} onClick={() => navigator.clipboard.writeText(generatedLinkDisplay)}>Copy</button>
                                    </div>
                                ) : (
                                    <p className={styles.fieldDescription}><em>{generatedLinkDisplay}</em></p>
                                )}
                            </div>

                            <div className={styles.formGroup}>
                                <label htmlFor="settings.web_link.customSlug">Custom URL Slug (Optional)</label>
                                <div className={styles.slugInputContainer}>
                                    <span className={styles.slugBaseUrl}>{shareableBaseUrl}</span>
                                    <input
                                        type="text"
                                        id="settings.web_link.customSlug"
                                        name="settings.web_link.customSlug"
                                        value={formData.settings.web_link.customSlug}
                                        onChange={handleChange}
                                        placeholder="e.g., my-event-survey"
                                        className={`${styles.slugInput} ${errors.web_link_customSlug ? styles.inputError : ""}`}
                                        disabled={isSaving}
                                    />
                                </div>
                                <small className={styles.fieldDescription}>Unique identifier for the link. Will be lowercase. {shareableBaseUrl}<strong>your-slug-here</strong></small>
                                {renderError("web_link_customSlug")}
                            </div>
                            
                            {/* Password Protection */}
                            <div className={styles.formGroupCheckbox}>
                                <input type="checkbox" id="settings.web_link.passwordProtectionEnabled" name="settings.web_link.passwordProtectionEnabled" checked={formData.settings.web_link.passwordProtectionEnabled} onChange={handleChange} disabled={isSaving} />
                                <label htmlFor="settings.web_link.passwordProtectionEnabled">Password Protect Survey Link</label>
                            </div>
                            {formData.settings.web_link.passwordProtectionEnabled && (
                                <div className={styles.formGroup}>
                                    <label htmlFor="settings.web_link.password">Link Password {isEditMode && "(leave blank to keep current)"}</label>
                                    <input type="text" /* Changed from password to text for better UX if user wants to see what they type, common for "set password" fields */
                                        id="settings.web_link.password" name="settings.web_link.password"
                                        value={formData.settings.web_link.password} onChange={handleChange}
                                        className={errors.web_link_password ? styles.inputError : ""} disabled={isSaving}
                                        placeholder={isEditMode ? "Enter new password or leave blank" : "Minimum 6 characters"} />
                                    {renderError("web_link_password")}
                                </div>
                            )}
                            
                            {/* Other settings from your existing form, ensure names match formData structure */}
                            <div className={styles.formGroup}>
                                <label htmlFor="settings.web_link.openDate">Open Date (Optional)</label>
                                <input type="datetime-local" id="settings.web_link.openDate" name="settings.web_link.openDate" value={formData.settings.web_link.openDate} onChange={handleChange} disabled={isSaving} />
                                {renderError("web_link_openDate")}
                            </div>
                            <div className={styles.formGroup}>
                                <label htmlFor="settings.web_link.closeDate">Close Date (Optional)</label>
                                <input type="datetime-local" id="settings.web_link.closeDate" name="settings.web_link.closeDate" value={formData.settings.web_link.closeDate} onChange={handleChange} className={errors.web_link_closeDate ? styles.inputError : ""} disabled={isSaving} />
                                {renderError("web_link_closeDate")}
                            </div>
                            <div className={styles.formGroup}>
                                <label htmlFor="settings.web_link.maxResponses">Max Responses (0 for unlimited)</label>
                                <input type="number" id="settings.web_link.maxResponses" name="settings.web_link.maxResponses" value={formData.settings.web_link.maxResponses} onChange={handleChange} min="0" className={errors.web_link_maxResponses ? styles.inputError : ""} disabled={isSaving} />
                                {renderError("web_link_maxResponses")}
                            </div>

                            <div className={styles.formGroupCheckbox}>
                                <input type="checkbox" id="settings.web_link.allowMultipleResponses" name="settings.web_link.allowMultipleResponses" checked={formData.settings.web_link.allowMultipleResponses} onChange={handleChange} disabled={isSaving} />
                                <label htmlFor="settings.web_link.allowMultipleResponses">Allow Multiple Responses per Respondent</label>
                            </div>
                            <div className={styles.formGroupCheckbox}>
                                <input type="checkbox" id="settings.web_link.anonymousResponses" name="settings.web_link.anonymousResponses" checked={formData.settings.web_link.anonymousResponses} onChange={handleChange} disabled={isSaving}/>
                                <label htmlFor="settings.web_link.anonymousResponses">Collect Anonymous Responses</label>
                            </div>
                            <div className={styles.formGroupCheckbox}>
                                <input type="checkbox" id="settings.web_link.enableRecaptcha" name="settings.web_link.enableRecaptcha" checked={formData.settings.web_link.enableRecaptcha} onChange={handleChange} disabled={isSaving} />
                                <label htmlFor="settings.web_link.enableRecaptcha">Enable reCAPTCHA (Bot Protection)</label>
                            </div>
                             <div className={styles.formGroupCheckbox}>
                                <input type="checkbox" id="settings.web_link.allowBackButton" name="settings.web_link.allowBackButton" checked={formData.settings.web_link.allowBackButton} onChange={handleChange} disabled={isSaving} />
                                <label htmlFor="settings.web_link.allowBackButton">Allow "Back" Button for Respondents</label>
                            </div>
                            <div className={styles.formGroupCheckbox}>
                                <input type="checkbox" id="settings.web_link.progressBarEnabled" name="settings.web_link.progressBarEnabled" checked={formData.settings.web_link.progressBarEnabled} onChange={handleChange} disabled={isSaving} />
                                <label htmlFor="settings.web_link.progressBarEnabled">Enable Progress Bar</label>
                            </div>

                            {formData.settings.web_link.progressBarEnabled && (
                                <>
                                    <div className={styles.formGroup}>
                                        <label htmlFor="settings.web_link.progressBarStyle">Progress Bar Style</label>
                                        <select id="settings.web_link.progressBarStyle" name="settings.web_link.progressBarStyle" value={formData.settings.web_link.progressBarStyle} onChange={handleChange} disabled={isSaving} >
                                            <option value="percentage">Percentage</option>
                                            <option value="pages">Pages</option>
                                        </select>
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label htmlFor="settings.web_link.progressBarPosition">Progress Bar Position</label>
                                        <select id="settings.web_link.progressBarPosition" name="settings.web_link.progressBarPosition" value={formData.settings.web_link.progressBarPosition} onChange={handleChange} disabled={isSaving} >
                                            <option value="top">Top</option>
                                            <option value="bottom">Bottom</option>
                                        </select>
                                    </div>
                                </>
                            )}
                            
                            {/* Save and Continue Enabled (Tristate) */}
                            <div className={styles.formGroup}>
                                <label htmlFor="settings.web_link.saveAndContinueEnabled">Save & Continue Later (Collector Setting)</label>
                                <select 
                                    id="settings.web_link.saveAndContinueEnabled"
                                    name="settings.web_link.saveAndContinueEnabled" /* This name is for direct mapping if you change handleChange */
                                    value={formData.settings.web_link.saveAndContinueEnabled === undefined ? "inherit" : String(formData.settings.web_link.saveAndContinueEnabled)}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        handleSaveAndContinueChange(val === "inherit" ? undefined : (val === "true"));
                                    }}
                                    disabled={isSaving}
                                >
                                    <option value="inherit">Inherit from Survey Setting</option>
                                    <option value="true">Enable for this Collector</option>
                                    <option value="false">Disable for this Collector</option>
                                </select>
                                <small className={styles.fieldDescription}>Overrides the survey-level "Save & Continue" setting for this specific link.</small>
                            </div>


                            <div className={styles.formGroup}>
                                <label htmlFor="settings.web_link.ipAllowlistString">IP Allowlist (Optional, one per line/comma)</label>
                                <textarea id="settings.web_link.ipAllowlistString" name="settings.web_link.ipAllowlistString" value={formData.settings.web_link.ipAllowlistString} onChange={handleChange} rows="3" placeholder="e.g., 192.168.1.100 or 10.0.0.0/24" className={errors.web_link_ipAllowlistString ? styles.inputError : ""} disabled={isSaving}/>
                                {renderError("web_link_ipAllowlistString")}
                            </div>
                            <div className={styles.formGroup}>
                                <label htmlFor="settings.web_link.ipBlocklistString">IP Blocklist (Optional, one per line/comma)</label>
                                <textarea id="settings.web_link.ipBlocklistString" name="settings.web_link.ipBlocklistString" value={formData.settings.web_link.ipBlocklistString} onChange={handleChange} rows="3" placeholder="e.g., 1.2.3.4 or 2001:db8::/32" className={errors.web_link_ipBlocklistString ? styles.inputError : ""} disabled={isSaving} />
                                {renderError("web_link_ipBlocklistString")}
                            </div>
                            {/* recaptchaSiteKey is usually global, not per collector normally */}
                        </fieldset>
                    )}
                    {renderError("general")} {/* For general errors not tied to a field */}

                    <div className={styles.modalFooter}>
                        <button type="button" onClick={onClose} className="button button-secondary" disabled={isSaving}>
                            Cancel
                        </button>
                        <button type="submit" className="button button-primary" disabled={isSaving}>
                            {isSaving ? (isEditMode ? 'Saving...' : 'Creating...') : (isEditMode ? 'Save Changes' : 'Create Collector')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CollectorFormModal;
// ----- END OF COMPLETE UPDATED FILE (v1.7 - Enhanced linkId/customSlug UI & saveAndContinue) -----