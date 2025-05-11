// frontend/src/components/SurveySettingsPanel.js
import React, { useState, useEffect, useCallback } from 'react';
// import styles from './SurveySettingsPanel.module.css'; // Optional: Create and import a CSS module for styling

// Define categories for settings
const SETTING_CATEGORIES = {
    COMPLETION: 'Survey Completion & Endings',
    ACCESS_SECURITY: 'Access & Security',
    APPEARANCE: 'Appearance & Branding',
    BEHAVIOR_NAVIGATION: 'Behavior & Navigation',
    // Add more categories as we implement them
    // DATA_COLLECTION: 'Data Collection',
    // NOTIFICATIONS: 'Notifications',
    // QUOTAS: 'Quotas',
};

const SurveySettingsPanel = ({ isOpen, onClose, settings: initialSettings, onSave, surveyId }) => {
    const [currentSettings, setCurrentSettings] = useState({});
    const [activeCategory, setActiveCategory] = useState(SETTING_CATEGORIES.COMPLETION);

    // Deep merge initial settings with defaults to ensure all paths exist
    const mergeWithDefaults = useCallback((settings) => {
        const defaults = {
            // Category: Survey Completion & Endings
            completion: {
                type: 'thankYouPage', // 'thankYouPage', 'redirect', 'closeWindow'
                thankYouMessage: 'Thank you for completing the survey!',
                showResponseSummary: false,
                showScore: false, // Relevant for quizzes
                redirectUrl: '',
                passResponseDataToRedirect: false,
                disqualificationType: 'message', // 'message', 'redirect'
                disqualificationMessage: 'Unfortunately, you do not qualify to continue with this survey.',
                disqualificationRedirectUrl: '',
                surveyClosedMessage: 'This survey is currently closed. Thank you for your interest.',
                // Add more default completion settings here
            },
            // Category: Access & Security (example placeholders)
            accessSecurity: {
                linkExpirationDate: null,
                maxResponses: 0, // 0 for unlimited
                passwordProtectionEnabled: false,
                surveyPassword: '',
                // Add more default access settings here
            },
            // Add default structures for other categories as they are built
            appearance: {},
            behaviorNavigation: {},
        };

        // Basic deep merge (can be replaced with a library like lodash.merge for more complex scenarios)
        const merged = { ...defaults };
        for (const categoryKey in defaults) {
            merged[categoryKey] = { ...defaults[categoryKey], ...(settings?.[categoryKey] || {}) };
        }
        // Merge top-level custom settings not in defaults (if any)
        for (const key in settings) {
            if (!defaults[key]) {
                merged[key] = settings[key];
            }
        }
        return merged;

    }, []);


    useEffect(() => {
        if (isOpen) {
            setCurrentSettings(mergeWithDefaults(initialSettings));
        }
    }, [isOpen, initialSettings, mergeWithDefaults]);

    if (!isOpen) {
        return null;
    }

    const handleCategoryChange = (categoryKey, value) => {
        setCurrentSettings(prevSettings => ({
            ...prevSettings,
            [categoryKey]: {
                ...(prevSettings[categoryKey] || {}),
                ...value,
            }
        }));
    };
    
    const handleNestedChange = (category, field, value, subField = null) => {
        setCurrentSettings(prev => {
            const newCategorySettings = { ...prev[category] };
            if (subField) { // For settings like completion.thankYouPage.customParam
                newCategorySettings[field] = {
                    ...(newCategorySettings[field] || {}),
                    [subField]: value
                };
            } else {
                newCategorySettings[field] = value;
            }
            return {
                ...prev,
                [category]: newCategorySettings
            };
        });
    };


    const handleInputChange = (category, e) => {
        const { name, value, type, checked } = e.target;
        const settingName = name.split('.').pop(); // Get the actual field name if name is like "completion.redirectUrl"
        
        handleNestedChange(category, settingName, type === 'checkbox' ? checked : value);
    };


    const handleSave = () => {
        console.log("Saving settings:", currentSettings);
        onSave(currentSettings);
    };

    // --- Styling (can be moved to CSS module) ---
    const panelStyle = { position: 'fixed', top: '0', right: '0', width: '450px', height: '100vh', backgroundColor: '#fdfdfd', borderLeft: '1px solid #ccc', boxShadow: '-3px 0 8px rgba(0,0,0,0.1)', zIndex: 1001, display: 'flex', flexDirection: 'column' };
    const headerStyle = { padding: '15px 20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor:'#f7f7f7' };
    const navStyle = { display: 'flex', borderBottom: '1px solid #eee', backgroundColor: '#f0f0f0' };
    const navButtonStyle = (isActive) => ({ padding: '10px 15px', border: 'none', background: isActive ? '#fff' : 'transparent', cursor: 'pointer', borderRight: '1px solid #eee', fontWeight: isActive ? 'bold' : 'normal', fontSize:'0.9em' });
    const contentStyle = { padding: '20px', overflowY: 'auto', flexGrow: 1 };
    const sectionTitleStyle = { marginTop: '0', marginBottom: '15px', borderBottom: '1px solid #e0e0e0', paddingBottom: '10px', color: '#333', fontSize:'1.1em' };
    const inputGroupStyle = { marginBottom: '18px' };
    const labelStyle = { display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '0.95em', color: '#444' };
    const inputStyle = { width: '100%', padding: '10px', boxSizing: 'border-box', border: '1px solid #ddd', borderRadius: '4px', fontSize:'0.95em' };
    const textareaStyle = { ...inputStyle, minHeight: '80px', resize: 'vertical' };
    const selectStyle = { ...inputStyle };
    const checkboxLabelStyle = { marginLeft: '8px', fontWeight: 'normal', fontSize: '0.95em', cursor:'pointer' };
    const subDescriptionStyle = { fontSize: '0.85em', color: '#777', marginTop: '4px' };
    const footerStyle = { padding: '15px 20px', borderTop: '1px solid #eee', background: '#f7f7f7', display: 'flex', justifyContent: 'flex-end' };
    const buttonStyle = { padding: '10px 18px', marginRight: '10px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight:'500' };
    const primaryButtonStyle = { ...buttonStyle, backgroundColor: '#007bff', color: 'white' };
    const secondaryButtonStyle = { ...buttonStyle, backgroundColor: '#6c757d', color: 'white' };

    // --- Render Helper for Settings Sections ---
    const renderCompletionSettings = () => {
        const settings = currentSettings.completion || {};
        return (
            <>
                <h3 style={sectionTitleStyle}>End of Survey Experience</h3>
                <div style={inputGroupStyle}>
                    <label style={labelStyle}>When survey is completed, show:</label>
                    <select
                        name="completion.type"
                        value={settings.type || 'thankYouPage'}
                        onChange={(e) => handleNestedChange('completion', 'type', e.target.value)}
                        style={selectStyle}
                    >
                        <option value="thankYouPage">A thank you page</option>
                        <option value="redirect">Redirect to a URL</option>
                        <option value="closeWindow">Close the window (not recommended for all browsers)</option>
                    </select>
                </div>

                {settings.type === 'thankYouPage' && (
                    <>
                        <div style={inputGroupStyle}>
                            <label htmlFor="completion.thankYouMessage" style={labelStyle}>Thank You Message:</label>
                            <textarea
                                id="completion.thankYouMessage"
                                name="completion.thankYouMessage"
                                value={settings.thankYouMessage || ''}
                                onChange={(e) => handleInputChange('completion', e)}
                                style={textareaStyle}
                                rows="4"
                            />
                        </div>
                        <div style={inputGroupStyle}>
                            <input
                                type="checkbox"
                                id="completion.showResponseSummary"
                                name="completion.showResponseSummary"
                                checked={settings.showResponseSummary || false}
                                onChange={(e) => handleInputChange('completion', e)}
                            />
                            <label htmlFor="completion.showResponseSummary" style={checkboxLabelStyle}>Display summary of responses to respondent</label>
                        </div>
                        <div style={inputGroupStyle}>
                            <input
                                type="checkbox"
                                id="completion.showScore"
                                name="completion.showScore"
                                checked={settings.showScore || false}
                                onChange={(e) => handleInputChange('completion', e)}
                            />
                            <label htmlFor="completion.showScore" style={checkboxLabelStyle}>Display score to respondent (for quizzes)</label>
                        </div>
                    </>
                )}

                {settings.type === 'redirect' && (
                    <>
                        <div style={inputGroupStyle}>
                            <label htmlFor="completion.redirectUrl" style={labelStyle}>Redirect URL:</label>
                            <input
                                type="url"
                                id="completion.redirectUrl"
                                name="completion.redirectUrl"
                                value={settings.redirectUrl || ''}
                                onChange={(e) => handleInputChange('completion', e)}
                                style={inputStyle}
                                placeholder="https://example.com"
                            />
                        </div>
                        <div style={inputGroupStyle}>
                            <input
                                type="checkbox"
                                id="completion.passResponseDataToRedirect"
                                name="completion.passResponseDataToRedirect"
                                checked={settings.passResponseDataToRedirect || false}
                                onChange={(e) => handleInputChange('completion', e)}
                            />
                            <label htmlFor="completion.passResponseDataToRedirect" style={checkboxLabelStyle}>Pass response data as query parameters to redirect URL</label>
                            <p style={subDescriptionStyle}>Requires backend to append parameters like ?responseID={'{responseID}'}&customVar={'{customVar}'}.</p>
                        </div>
                    </>
                )}
                
                <h3 style={{...sectionTitleStyle, marginTop:'30px'}}>Disqualification Handling</h3>
                 <div style={inputGroupStyle}>
                    <label style={labelStyle}>If respondent is disqualified:</label>
                    <select
                        name="completion.disqualificationType"
                        value={settings.disqualificationType || 'message'}
                        onChange={(e) => handleNestedChange('completion', 'disqualificationType', e.target.value)}
                        style={selectStyle}
                    >
                        <option value="message">Show a custom message</option>
                        <option value="redirect">Redirect to a URL</option>
                    </select>
                </div>

                {settings.disqualificationType === 'message' && (
                    <div style={inputGroupStyle}>
                        <label htmlFor="completion.disqualificationMessage" style={labelStyle}>Disqualification Message:</label>
                        <textarea
                            id="completion.disqualificationMessage"
                            name="completion.disqualificationMessage"
                            value={settings.disqualificationMessage || ''}
                            onChange={(e) => handleInputChange('completion', e)}
                            style={textareaStyle}
                            rows="3"
                        />
                    </div>
                )}
                {settings.disqualificationType === 'redirect' && (
                     <div style={inputGroupStyle}>
                        <label htmlFor="completion.disqualificationRedirectUrl" style={labelStyle}>Disqualification Redirect URL:</label>
                        <input
                            type="url"
                            id="completion.disqualificationRedirectUrl"
                            name="completion.disqualificationRedirectUrl"
                            value={settings.disqualificationRedirectUrl || ''}
                            onChange={(e) => handleInputChange('completion', e)}
                            style={inputStyle}
                            placeholder="https://example.com/disqualified"
                        />
                    </div>
                )}


                <h3 style={{...sectionTitleStyle, marginTop:'30px'}}>Survey Closed Message</h3>
                <div style={inputGroupStyle}>
                    <label htmlFor="completion.surveyClosedMessage" style={labelStyle}>Message for Closed Survey:</label>
                    <textarea
                        id="completion.surveyClosedMessage"
                        name="completion.surveyClosedMessage"
                        value={settings.surveyClosedMessage || ''}
                        onChange={(e) => handleInputChange('completion', e)}
                        style={textareaStyle}
                        rows="3"
                        placeholder="e.g., This survey has ended or reached its response limit."
                    />
                     <p style={subDescriptionStyle}>Displayed when the survey is manually closed, expired, or over quota.</p>
                </div>
            </>
        );
    };
    
    const renderAccessSecuritySettings = () => {
        const settings = currentSettings.accessSecurity || {};
        return (
            <>
                <h3 style={sectionTitleStyle}>Link & Access Control</h3>
                 <div style={inputGroupStyle}>
                    <label htmlFor="accessSecurity.linkExpirationDate" style={labelStyle}>Link Expiration Date (Optional):</label>
                    <input
                        type="datetime-local"
                        id="accessSecurity.linkExpirationDate"
                        name="accessSecurity.linkExpirationDate"
                        value={settings.linkExpirationDate || ''}
                        onChange={(e) => handleInputChange('accessSecurity', e)}
                        style={inputStyle}
                    />
                </div>
                <div style={inputGroupStyle}>
                    <label htmlFor="accessSecurity.maxResponses" style={labelStyle}>Maximum Responses (0 for unlimited):</label>
                    <input
                        type="number"
                        id="accessSecurity.maxResponses"
                        name="accessSecurity.maxResponses"
                        value={settings.maxResponses === undefined ? 0 : settings.maxResponses}
                        onChange={(e) => handleInputChange('accessSecurity', e)}
                        min="0"
                        style={inputStyle}
                    />
                </div>
                 <div style={inputGroupStyle}>
                    <input
                        type="checkbox"
                        id="accessSecurity.passwordProtectionEnabled"
                        name="accessSecurity.passwordProtectionEnabled"
                        checked={settings.passwordProtectionEnabled || false}
                        onChange={(e) => handleInputChange('accessSecurity', e)}
                    />
                    <label htmlFor="accessSecurity.passwordProtectionEnabled" style={checkboxLabelStyle}>Enable Password Protection</label>
                </div>
                {settings.passwordProtectionEnabled && (
                    <div style={inputGroupStyle}>
                        <label htmlFor="accessSecurity.surveyPassword" style={labelStyle}>Survey Password:</label>
                        <input
                            type="text" // Consider type="password" if you want to mask it, but it might be better to show it for admin.
                            id="accessSecurity.surveyPassword"
                            name="accessSecurity.surveyPassword"
                            value={settings.surveyPassword || ''}
                            onChange={(e) => handleInputChange('accessSecurity', e)}
                            style={inputStyle}
                        />
                    </div>
                )}
                {/* More settings for this category will go here */}
                <p style={{color:'#888', textAlign:'center', marginTop:'30px'}}>(More Access & Security settings coming soon...)</p>
            </>
        );
    };


    return (
        <div style={panelStyle} /* className={styles.settingsPanel} */ >
            <div style={headerStyle}>
                <h2 style={{ margin: 0, fontSize: '1.3em', fontWeight:'600' }}>Survey Settings</h2>
                <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.8rem', cursor: 'pointer', color:'#555', padding:0, lineHeight:'1' }}>&times;</button>
            </div>

            <nav style={navStyle}>
                {Object.entries(SETTING_CATEGORIES).map(([key, title]) => (
                    <button
                        key={key}
                        onClick={() => setActiveCategory(title)}
                        style={navButtonStyle(activeCategory === title)}
                    >
                        {title}
                    </button>
                ))}
            </nav>

            <div style={contentStyle}>
                {/* Conditionally render settings based on activeCategory */}
                {activeCategory === SETTING_CATEGORIES.COMPLETION && renderCompletionSettings()}
                {activeCategory === SETTING_CATEGORIES.ACCESS_SECURITY && renderAccessSecuritySettings()}
                {/* Add other categories here */}
                {![SETTING_CATEGORIES.COMPLETION, SETTING_CATEGORIES.ACCESS_SECURITY].includes(activeCategory) && (
                    <p>Settings for "{activeCategory}" are not yet implemented.</p>
                )}
            </div>

            <div style={footerStyle}>
                <button onClick={onClose} style={secondaryButtonStyle}>Cancel</button>
                <button onClick={handleSave} style={primaryButtonStyle}>Apply Settings</button>
            </div>
        </div>
    );
};

export default SurveySettingsPanel;