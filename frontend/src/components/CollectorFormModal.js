// frontend/src/components/CollectorFormModal.js
// ----- START OF COMPLETE MODIFIED FILE (v1.6 - Added ProgressBar Position UI) -----
import React, { useState, useEffect, useCallback } from 'react';
import surveyApiFunctions from '../api/surveyApi';
import { toast } from 'react-toastify';
import styles from './CollectorFormModal.module.css';

const CollectorFormModal = ({ isOpen, onClose, surveyId, existingCollector, onSave }) => {
    const isEditMode = Boolean(existingCollector);

    const getInitialFormData = useCallback(() => {
        const defaults = {
            name: '',
            type: 'web_link',
            status: 'draft',
            settings: {
                web_link: {
                    customSlug: '',
                    allowMultipleResponses: false,
                    anonymousResponses: false,
                    maxResponses: 0,
                    openDate: '',
                    closeDate: '',
                    passwordProtectionEnabled: false,
                    password: '',
                    enableRecaptcha: false,
                    recaptchaSiteKey: '',
                    ipAllowlistString: '',
                    ipBlocklistString: '',
                    allowBackButton: true,
                    progressBarEnabled: false,
                    progressBarStyle: 'percentage',
                    // --- NEW: ProgressBar Position Default ---
                    progressBarPosition: 'top',
                }
            }
        };

        if (isEditMode && existingCollector) {
            const existingWebLinkSettings = existingCollector.settings?.web_link || {};
            const mergedWebLinkSettings = {
                ...defaults.settings.web_link,
                ...existingWebLinkSettings,
                anonymousResponses: Boolean(existingWebLinkSettings.anonymousResponses),
                maxResponses: existingWebLinkSettings.maxResponses === null || existingWebLinkSettings.maxResponses === undefined ? 0 : existingWebLinkSettings.maxResponses,
                openDate: existingWebLinkSettings.openDate ? new Date(existingWebLinkSettings.openDate).toISOString().slice(0, 16) : '',
                closeDate: existingWebLinkSettings.closeDate ? new Date(existingWebLinkSettings.closeDate).toISOString().slice(0, 16) : '',
                passwordProtectionEnabled: Boolean(existingWebLinkSettings.password),
                enableRecaptcha: Boolean(existingWebLinkSettings.enableRecaptcha),
                recaptchaSiteKey: existingWebLinkSettings.recaptchaSiteKey || '',
                ipAllowlistString: Array.isArray(existingWebLinkSettings.ipAllowlist) ? existingWebLinkSettings.ipAllowlist.join('\n') : '',
                ipBlocklistString: Array.isArray(existingWebLinkSettings.ipBlocklist) ? existingWebLinkSettings.ipBlocklist.join('\n') : '',
                allowBackButton: typeof existingWebLinkSettings.allowBackButton === 'boolean'
                                 ? existingWebLinkSettings.allowBackButton
                                 : true,
                progressBarEnabled: typeof existingWebLinkSettings.progressBarEnabled === 'boolean'
                                    ? existingWebLinkSettings.progressBarEnabled
                                    : false,
                progressBarStyle: existingWebLinkSettings.progressBarStyle || 'percentage',
                // --- MODIFIED: Initialize ProgressBar Position ---
                progressBarPosition: existingWebLinkSettings.progressBarPosition || 'top', // Default to 'top'
            };

            return {
                name: existingCollector.name || '',
                type: existingCollector.type || 'web_link',
                status: existingCollector.status || 'draft',
                settings: {
                    ...defaults.settings,
                    web_link: mergedWebLinkSettings
                }
            };
        }
        return defaults;
    }, [isEditMode, existingCollector]);

    const [formData, setFormData] = useState(getInitialFormData());
    const [isSaving, setIsSaving] = useState(false);
    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (isOpen) {
            setFormData(getInitialFormData());
            setErrors({});
        }
    }, [isOpen, getInitialFormData]);

    if (!isOpen) {
        return null;
    }

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;

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
            if (errors[`web_link_${field}`]) {
                setErrors(prev => ({ ...prev, [`web_link_${field}`]: null }));
            }
        } else {
            setFormData(prev => ({
                ...prev,
                [name]: type === 'checkbox' ? checked : value
            }));
            if (errors[name]) {
                setErrors(prev => ({ ...prev, [name]: null }));
            }
        }
    };

    const parseIpListString = (ipString) => {
        if (!ipString || typeof ipString !== 'string') return [];
        return ipString
            .split(/[\n,]+/)
            .map(ip => ip.trim())
            .filter(ip => ip.length > 0);
    };


    const validateForm = () => {
        const newErrors = {};
        if (!formData.name.trim()) {
            newErrors.name = "Collector name is required.";
        }
        if (formData.settings.web_link.passwordProtectionEnabled && !formData.settings.web_link.password && !isEditMode) {
            newErrors.web_link_password = "Password is required when password protection is enabled.";
        }
        if (formData.settings.web_link.passwordProtectionEnabled && formData.settings.web_link.password && formData.settings.web_link.password.length < 6) {
            newErrors.web_link_password = "Password must be at least 6 characters long.";
        }
        if (formData.settings.web_link.openDate && formData.settings.web_link.closeDate &&
            new Date(formData.settings.web_link.openDate) >= new Date(formData.settings.web_link.closeDate)) {
            newErrors.web_link_closeDate = "Close date must be after the open date.";
        }
        if (formData.settings.web_link.customSlug && !/^[a-zA-Z0-9-_]+$/.test(formData.settings.web_link.customSlug)) {
            newErrors.web_link_customSlug = "Custom slug can only contain letters, numbers, hyphens, and underscores.";
        }
        const maxResponsesNum = parseInt(formData.settings.web_link.maxResponses, 10);
        if (isNaN(maxResponsesNum) || maxResponsesNum < 0) {
            newErrors.web_link_maxResponses = "Max responses must be a non-negative number.";
        }

        const allowlist = parseIpListString(formData.settings.web_link.ipAllowlistString);
        if (allowlist.some(ip => ip.includes(' '))) {
            newErrors.web_link_ipAllowlistString = "IPs in allowlist should not contain spaces.";
        }
        const blocklist = parseIpListString(formData.settings.web_link.ipBlocklistString);
        if (blocklist.some(ip => ip.includes(' '))) {
            newErrors.web_link_ipBlocklistString = "IPs in blocklist should not contain spaces.";
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
        setErrors({});

        const parsedMaxResponses = parseInt(formData.settings.web_link.maxResponses, 10);
        const maxResponsesToSend = (isNaN(parsedMaxResponses) || parsedMaxResponses <= 0) ? null : parsedMaxResponses;

        const ipAllowlistArray = parseIpListString(formData.settings.web_link.ipAllowlistString);
        const ipBlocklistArray = parseIpListString(formData.settings.web_link.ipBlocklistString);

        const payload = {
            name: formData.name,
            type: formData.type,
            status: formData.status,
            settings: {
                web_link: {
                    ...formData.settings.web_link, // Includes allowBackButton, progressBarEnabled, progressBarStyle, progressBarPosition
                    customSlug: formData.settings.web_link.customSlug || undefined,
                    openDate: formData.settings.web_link.openDate ? new Date(formData.settings.web_link.openDate).toISOString() : null,
                    closeDate: formData.settings.web_link.closeDate ? new Date(formData.settings.web_link.closeDate).toISOString() : null,
                    maxResponses: maxResponsesToSend,
                    password: formData.settings.web_link.passwordProtectionEnabled && formData.settings.web_link.password
                                ? formData.settings.web_link.password
                                : undefined,
                    ipAllowlist: ipAllowlistArray,
                    ipBlocklist: ipBlocklistArray,
                }
            }
        };

        if (!formData.settings.web_link.passwordProtectionEnabled) {
             payload.settings.web_link.password = null;
        }
        delete payload.settings.web_link.ipAllowlistString;
        delete payload.settings.web_link.ipBlocklistString;


        try {
            if (isEditMode) {
                await surveyApiFunctions.updateCollector(surveyId, existingCollector._id, payload);
                toast.success("Collector updated successfully!");
            } else {
                await surveyApiFunctions.createCollector(surveyId, payload);
                toast.success("Collector created successfully!");
            }
            onSave();
        } catch (error) {
            console.error("Error saving collector:", error.response?.data || error.message);
            const errorData = error.response?.data;
            let errorMessage = `Failed to save collector: ${errorData?.message || error.message || 'Unknown server error'}`;
            if (errorData && errorData.errors) {
                const backendErrors = {};
                 Object.entries(errorData.errors).forEach(([key, value]) => {
                    const fieldKey = key.replace('settings.web_link.', 'web_link_');
                    backendErrors[fieldKey] = value.message;
                });
                setErrors(backendErrors);
                errorMessage = `Validation failed: ${errorData.message || "Please check the form fields."}`;

            } else if (errorData && errorData.message) {
                if (errorData.message.includes("custom slug is already in use") || (errorData.keyValue && errorData.keyValue['settings.web_link.customSlug'])) {
                    setErrors(prev => ({ ...prev, web_link_customSlug: "This custom slug is already in use."}));
                    errorMessage = "This custom slug is already in use.";
                } else {
                     setErrors(prev => ({ ...prev, general: errorData.message }));
                }
            } else {
                 setErrors(prev => ({ ...prev, general: errorMessage }));
            }
            toast.error(errorMessage);
        } finally {
            setIsSaving(false);
        }
    };

    const renderError = (fieldName) => errors[fieldName] ? <p className={styles.errorMessage}>{errors[fieldName]}</p> : null;

    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modal}>
                <div className={styles.modalHeader}>
                    <h2>{isEditMode ? 'Edit Web Link Collector' : 'Add New Web Link Collector'}</h2>
                    <button onClick={onClose} className={styles.closeButton} disabled={isSaving}>&times;</button>
                </div>
                <form onSubmit={handleSubmit} className={styles.modalBody}>
                    <div className={styles.formGroup}>
                        <label htmlFor="name">Collector Name</label>
                        <input type="text" id="name" name="name" value={formData.name} onChange={handleChange} className={errors.name ? styles.inputError : ""} disabled={isSaving}/>
                        {renderError("name")}
                    </div>
                    <div className={styles.formGroup}>
                        <label htmlFor="type">Collector Type</label>
                        <select id="type" name="type" value={formData.type} onChange={handleChange} disabled={isSaving || isEditMode}>
                            <option value="web_link">Web Link</option>
                        </select>
                        {renderError("type")}
                    </div>
                    <div className={styles.formGroup}>
                        <label htmlFor="status">Status</label>
                        <select id="status" name="status" value={formData.status} onChange={handleChange} disabled={isSaving}>
                            <option value="draft">Draft (Not collecting responses yet)</option>
                            <option value="open">Open (Actively collecting responses)</option>
                            <option value="closed">Closed (Manually stopped)</option>
                        </select>
                        {renderError("status")}
                    </div>

                    {formData.type === 'web_link' && (
                        <fieldset className={styles.settingsFieldset}>
                            <legend>Web Link Settings</legend>
                            <div className={styles.formGroup}>
                                <label htmlFor="settings.web_link.customSlug">Custom URL Slug (Optional)</label>
                                <input type="text" id="settings.web_link.customSlug" name="settings.web_link.customSlug" value={formData.settings.web_link.customSlug} onChange={handleChange} placeholder="e.g., my-survey-event" className={errors.web_link_customSlug ? styles.inputError : ""} disabled={isSaving} />
                                <small className={styles.fieldDescription}>Unique identifier for the link. Letters, numbers, hyphens, underscores.</small>
                                {renderError("web_link_customSlug")}
                            </div>

                            <div className={styles.formGroupCheckbox}>
                                <input
                                    type="checkbox"
                                    id="settings.web_link.allowBackButton"
                                    name="settings.web_link.allowBackButton"
                                    checked={formData.settings.web_link.allowBackButton}
                                    onChange={handleChange}
                                    disabled={isSaving}
                                />
                                <label htmlFor="settings.web_link.allowBackButton">Allow "Back" Button for Respondents</label>
                                <small className={styles.fieldDescription}>If checked, respondents can navigate to previous questions.</small>
                                {renderError("web_link_allowBackButton")}
                            </div>

                            <div className={styles.formGroupCheckbox}>
                                <input
                                    type="checkbox"
                                    id="settings.web_link.progressBarEnabled"
                                    name="settings.web_link.progressBarEnabled"
                                    checked={formData.settings.web_link.progressBarEnabled}
                                    onChange={handleChange}
                                    disabled={isSaving}
                                />
                                <label htmlFor="settings.web_link.progressBarEnabled">Enable Progress Bar</label>
                                <small className={styles.fieldDescription}>Show respondents their progress through the survey.</small>
                                {renderError("web_link_progressBarEnabled")}
                            </div>

                            {formData.settings.web_link.progressBarEnabled && (
                                <>
                                    <div className={styles.formGroup}>
                                        <label htmlFor="settings.web_link.progressBarStyle">Progress Bar Style</label>
                                        <select
                                            id="settings.web_link.progressBarStyle"
                                            name="settings.web_link.progressBarStyle"
                                            value={formData.settings.web_link.progressBarStyle}
                                            onChange={handleChange}
                                            disabled={isSaving}
                                        >
                                            <option value="percentage">Percentage (e.g., 50% Complete)</option>
                                            <option value="pages">Pages (e.g., Page 3 of 5)</option>
                                        </select>
                                        {renderError("web_link_progressBarStyle")}
                                    </div>
                                    {/* --- NEW: ProgressBar Position UI --- */}
                                    <div className={styles.formGroup}>
                                        <label htmlFor="settings.web_link.progressBarPosition">Progress Bar Position</label>
                                        <select
                                            id="settings.web_link.progressBarPosition"
                                            name="settings.web_link.progressBarPosition"
                                            value={formData.settings.web_link.progressBarPosition}
                                            onChange={handleChange}
                                            disabled={isSaving}
                                        >
                                            <option value="top">Top of Page</option>
                                            <option value="bottom">Bottom of Page</option>
                                        </select>
                                        {renderError("web_link_progressBarPosition")}
                                    </div>
                                    {/* --- END NEW --- */}
                                </>
                            )}


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
                                <small className={styles.fieldDescription}>If unchecked, uses browser storage to attempt to prevent multiple submissions from the same browser.</small>
                                {renderError("web_link_allowMultipleResponses")}
                            </div>
                            <div className={styles.formGroupCheckbox}>
                                <input type="checkbox" id="settings.web_link.anonymousResponses" name="settings.web_link.anonymousResponses" checked={formData.settings.web_link.anonymousResponses} onChange={handleChange} disabled={isSaving}/>
                                <label htmlFor="settings.web_link.anonymousResponses">Collect Anonymous Responses</label>
                                <small className={styles.fieldDescription}>If checked, respondent's IP address and browser details will not be stored.</small>
                                {renderError("web_link_anonymousResponses")}
                            </div>
                            <div className={styles.formGroup}>
                                <label htmlFor="settings.web_link.ipAllowlistString">IP Allowlist (Optional)</label>
                                <textarea id="settings.web_link.ipAllowlistString" name="settings.web_link.ipAllowlistString" value={formData.settings.web_link.ipAllowlistString} onChange={handleChange} rows="3" placeholder="Enter one IP address or CIDR range per line (e.g., 192.168.1.100 or 10.0.0.0/24)" className={errors.web_link_ipAllowlistString ? styles.inputError : ""} disabled={isSaving}/>
                                <small className={styles.fieldDescription}>If specified, only these IPs can access the survey. One entry per line or comma-separated.</small>
                                {renderError("web_link_ipAllowlistString")}
                            </div>
                            <div className={styles.formGroup}>
                                <label htmlFor="settings.web_link.ipBlocklistString">IP Blocklist (Optional)</label>
                                <textarea id="settings.web_link.ipBlocklistString" name="settings.web_link.ipBlocklistString" value={formData.settings.web_link.ipBlocklistString} onChange={handleChange} rows="3" placeholder="Enter one IP address or CIDR range per line (e.g., 1.2.3.4 or 2001:db8::/32)" className={errors.web_link_ipBlocklistString ? styles.inputError : ""} disabled={isSaving} />
                                <small className={styles.fieldDescription}>If specified, these IPs will be blocked. One entry per line or comma-separated. Allowlist takes precedence.</small>
                                {renderError("web_link_ipBlocklistString")}
                            </div>
                            <div className={styles.formGroupCheckbox}>
                                <input type="checkbox" id="settings.web_link.passwordProtectionEnabled" name="settings.web_link.passwordProtectionEnabled" checked={formData.settings.web_link.passwordProtectionEnabled} onChange={handleChange} disabled={isSaving} />
                                <label htmlFor="settings.web_link.passwordProtectionEnabled">Password Protect Survey Link</label>
                                {renderError("web_link_passwordProtectionEnabled")}
                            </div>
                            {formData.settings.web_link.passwordProtectionEnabled && (
                                <div className={styles.formGroup}>
                                    <label htmlFor="settings.web_link.password">Link Password {isEditMode && "(leave blank to keep current)"}</label>
                                    <input type="text" id="settings.web_link.password" name="settings.web_link.password" value={formData.settings.web_link.password} onChange={handleChange} className={errors.web_link_password ? styles.inputError : ""} disabled={isSaving} placeholder={isEditMode ? "Enter new password or leave blank" : ""} />
                                    {renderError("web_link_password")}
                                </div>
                            )}
                            <div className={styles.formGroupCheckbox}>
                                <input type="checkbox" id="settings.web_link.enableRecaptcha" name="settings.web_link.enableRecaptcha" checked={formData.settings.web_link.enableRecaptcha} onChange={handleChange} disabled={isSaving} />
                                <label htmlFor="settings.web_link.enableRecaptcha">Enable reCAPTCHA (Bot Protection)</label>
                                <small className={styles.fieldDescription}>Helps prevent automated submissions.</small>
                                {renderError("web_link_enableRecaptcha")}
                            </div>
                            <div className={styles.formGroup}>
                                <label htmlFor="settings.web_link.recaptchaSiteKey">reCAPTCHA Site Key (Optional)</label>
                                <input type="text" id="settings.web_link.recaptchaSiteKey" name="settings.web_link.recaptchaSiteKey" value={formData.settings.web_link.recaptchaSiteKey} onChange={handleChange} placeholder="Overrides global key if set" disabled={isSaving}/>
                                <small className={styles.fieldDescription}>Leave blank to use the site-wide reCAPTCHA key.</small>
                            </div>
                        </fieldset>
                    )}
                    {renderError("general")}

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
// ----- END OF COMPLETE MODIFIED FILE (v1.6 - Added ProgressBar Position UI) -----