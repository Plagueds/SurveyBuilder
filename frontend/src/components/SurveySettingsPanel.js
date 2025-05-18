// frontend/src/components/SurveySettingsPanel.js
// ----- START OF COMPLETE UPDATED FILE (v1.1 - Added Behavior/Nav UI) -----
import React, { useState, useEffect, useCallback } from 'react';

const SETTING_CATEGORIES = {
    COMPLETION: 'Survey Completion & Endings',
    ACCESS_SECURITY: 'Access & Security',
    BEHAVIOR_NAVIGATION: 'Behavior & Navigation',
    APPEARANCE: 'Appearance & Branding',
    // DATA_COLLECTION: 'Data Collection',
    // NOTIFICATIONS: 'Notifications',
    // QUOTAS: 'Quotas',
};

const SurveySettingsPanel = ({ isOpen, onClose, settings: initialSettings, onSave, surveyId }) => {
    const [currentSettings, setCurrentSettings] = useState({});
    const [activeCategory, setActiveCategory] = useState(SETTING_CATEGORIES.COMPLETION);

    const mergeWithDefaults = useCallback((settingsFromProps) => {
        const defaults = {
            completion: {
                type: 'thankYouPage',
                thankYouMessage: 'Thank you for completing the survey!',
                showResponseSummary: false,
                showScore: false,
                redirectUrl: '',
                passResponseDataToRedirect: false,
                disqualificationType: 'message',
                disqualificationMessage: 'Unfortunately, you do not qualify to continue with this survey.',
                disqualificationRedirectUrl: '',
                surveyClosedMessage: 'This survey is currently closed. Thank you for your interest.',
            },
            accessSecurity: {
                linkExpirationDate: null,
                maxResponses: 0,
                passwordProtectionEnabled: false,
                surveyPassword: '',
            },
            // +++ NEW: Defaults for Behavior & Navigation +++
            behaviorNavigation: {
                autoAdvance: false,
                questionNumberingEnabled: true,
                questionNumberingFormat: '123', // '1. ', 'A. ', 'I. '
                // backButtonEnabled: true, // This is collector-specific
                // progressBarEnabled: false, // This is collector-specific
                // progressBarStyle: 'percentage', // This is collector-specific
                // progressBarPosition: 'top', // This is collector-specific
            },
            appearance: {},
        };

        const merged = { ...defaults };
        for (const categoryKey in defaults) {
            if (defaults.hasOwnProperty(categoryKey)) {
                merged[categoryKey] = {
                    ...defaults[categoryKey],
                    ...(settingsFromProps?.[categoryKey] || {})
                };
            }
        }
        for (const key in settingsFromProps) {
            if (settingsFromProps.hasOwnProperty(key) && !defaults.hasOwnProperty(key)) {
                merged[key] = settingsFromProps[key];
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
    
    const handleNestedChange = (category, field, value) => {
        setCurrentSettings(prev => ({
            ...prev,
            [category]: {
                ...(prev[category] || {}),
                [field]: value
            }
        }));
    };

    const handleInputChange = (category, e) => {
        const { name, value, type, checked } = e.target;
        // Assumes name is the direct field name like "autoAdvance", not "behaviorNavigation.autoAdvance"
        // If name needs to be parsed, adjust accordingly.
        handleNestedChange(category, name, type === 'checkbox' ? checked : value);
    };

    const handleSave = () => {
        console.log("Saving survey-wide settings:", currentSettings);
        onSave(currentSettings); // This should send the whole currentSettings object
    };

    // --- Styling ---
    const panelStyle = { position: 'fixed', top: '0', right: '0', width: '450px', height: '100vh', backgroundColor: '#fdfdfd', borderLeft: '1px solid #ccc', boxShadow: '-3px 0 8px rgba(0,0,0,0.1)', zIndex: 1001, display: 'flex', flexDirection: 'column' };
    const headerStyle = { padding: '15px 20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor:'#f7f7f7' };
    const navStyle = { display: 'flex', borderBottom: '1px solid #eee', backgroundColor: '#f0f0f0', flexWrap: 'wrap' };
    const navButtonStyle = (isActive) => ({ padding: '10px 15px', border: 'none', background: isActive ? '#fff' : 'transparent', cursor: 'pointer', borderRight: '1px solid #eee', fontWeight: isActive ? 'bold' : 'normal', fontSize:'0.85em', flexShrink:0 });
    const contentStyle = { padding: '20px', overflowY: 'auto', flexGrow: 1 };
    const sectionTitleStyle = { marginTop: '0', marginBottom: '15px', borderBottom: '1px solid #e0e0e0', paddingBottom: '10px', color: '#333', fontSize:'1.1em' };
    const inputGroupStyle = { marginBottom: '18px' };
    const labelStyle = { display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '0.95em', color: '#444' };
    const inputStyle = { width: '100%', padding: '10px', boxSizing: 'border-box', border: '1px solid #ddd', borderRadius: '4px', fontSize:'0.95em' };
    const textareaStyle = { ...inputStyle, minHeight: '80px', resize: 'vertical' };
    const selectStyle = { ...inputStyle };
    const checkboxLabelStyle = { marginLeft: '8px', fontWeight: 'normal', fontSize: '0.95em', cursor:'pointer', verticalAlign: 'middle' };
    const checkboxInputStyle = { verticalAlign: 'middle', cursor: 'pointer' };
    const subDescriptionStyle = { fontSize: '0.85em', color: '#777', marginTop: '4px' };
    const footerStyle = { padding: '15px 20px', borderTop: '1px solid #eee', background: '#f7f7f7', display: 'flex', justifyContent: 'flex-end' };
    const buttonStyle = { padding: '10px 18px', marginRight: '10px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight:'500' };
    const primaryButtonStyle = { ...buttonStyle, backgroundColor: '#007bff', color: 'white' };
    const secondaryButtonStyle = { ...buttonStyle, backgroundColor: '#6c757d', color: 'white' };


    const renderCompletionSettings = () => {
        const settings = currentSettings.completion || mergeWithDefaults({}).completion;
        return (
            <>
                <h3 style={sectionTitleStyle}>End of Survey Experience</h3>
                <div style={inputGroupStyle}>
                    <label style={labelStyle}>When survey is completed, show:</label>
                    <select name="type" value={settings.type} onChange={(e) => handleNestedChange('completion', 'type', e.target.value)} style={selectStyle} >
                        <option value="thankYouPage">A thank you page</option>
                        <option value="redirect">Redirect to a URL</option>
                        <option value="closeWindow">Close the window (not recommended)</option>
                    </select>
                </div>
                {settings.type === 'thankYouPage' && (
                    <>
                        <div style={inputGroupStyle}>
                            <label htmlFor="thankYouMessage" style={labelStyle}>Thank You Message:</label>
                            <textarea id="thankYouMessage" name="thankYouMessage" value={settings.thankYouMessage} onChange={(e) => handleInputChange('completion', e)} style={textareaStyle} />
                        </div>
                        <div style={inputGroupStyle}>
                            <input type="checkbox" id="showResponseSummary" name="showResponseSummary" checked={settings.showResponseSummary} onChange={(e) => handleInputChange('completion', e)} style={checkboxInputStyle} />
                            <label htmlFor="showResponseSummary" style={checkboxLabelStyle}>Display summary of responses</label>
                        </div>
                        <div style={inputGroupStyle}>
                            <input type="checkbox" id="showScore" name="showScore" checked={settings.showScore} onChange={(e) => handleInputChange('completion', e)} style={checkboxInputStyle} />
                            <label htmlFor="showScore" style={checkboxLabelStyle}>Display score (for quizzes)</label>
                        </div>
                    </>
                )}
                {settings.type === 'redirect' && (
                    <>
                        <div style={inputGroupStyle}>
                            <label htmlFor="redirectUrl" style={labelStyle}>Redirect URL:</label>
                            <input type="url" id="redirectUrl" name="redirectUrl" value={settings.redirectUrl} onChange={(e) => handleInputChange('completion', e)} style={inputStyle} placeholder="https://example.com" />
                        </div>
                        <div style={inputGroupStyle}>
                            <input type="checkbox" id="passResponseDataToRedirect" name="passResponseDataToRedirect" checked={settings.passResponseDataToRedirect} onChange={(e) => handleInputChange('completion', e)} style={checkboxInputStyle} />
                            <label htmlFor="passResponseDataToRedirect" style={checkboxLabelStyle}>Pass response data to redirect URL</label>
                            <p style={subDescriptionStyle}>Appends query params like ?responseID={'{responseID}'}.</p>
                        </div>
                    </>
                )}
                <h3 style={{...sectionTitleStyle, marginTop:'30px'}}>Disqualification Handling</h3>
                <div style={inputGroupStyle}>
                    <label style={labelStyle}>If respondent is disqualified:</label>
                    <select name="disqualificationType" value={settings.disqualificationType} onChange={(e) => handleNestedChange('completion', 'disqualificationType', e.target.value)} style={selectStyle} >
                        <option value="message">Show a custom message</option>
                        <option value="redirect">Redirect to a URL</option>
                    </select>
                </div>
                {settings.disqualificationType === 'message' && (
                    <div style={inputGroupStyle}>
                        <label htmlFor="disqualificationMessage" style={labelStyle}>Disqualification Message:</label>
                        <textarea id="disqualificationMessage" name="disqualificationMessage" value={settings.disqualificationMessage} onChange={(e) => handleInputChange('completion', e)} style={textareaStyle} />
                    </div>
                )}
                {settings.disqualificationType === 'redirect' && (
                     <div style={inputGroupStyle}>
                        <label htmlFor="disqualificationRedirectUrl" style={labelStyle}>Disqualification Redirect URL:</label>
                        <input type="url" id="disqualificationRedirectUrl" name="disqualificationRedirectUrl" value={settings.disqualificationRedirectUrl} onChange={(e) => handleInputChange('completion', e)} style={inputStyle} placeholder="https://example.com/disqualified" />
                    </div>
                )}
                <h3 style={{...sectionTitleStyle, marginTop:'30px'}}>Survey Closed Message</h3>
                <div style={inputGroupStyle}>
                    <label htmlFor="surveyClosedMessage" style={labelStyle}>Message for Closed Survey:</label>
                    <textarea id="surveyClosedMessage" name="surveyClosedMessage" value={settings.surveyClosedMessage} onChange={(e) => handleInputChange('completion', e)} style={textareaStyle} placeholder="e.g., This survey has ended." />
                    <p style={subDescriptionStyle}>Displayed when survey is closed, expired, or over quota.</p>
                </div>
            </>
        );
    };
    
    const renderAccessSecuritySettings = () => {
        const settings = currentSettings.accessSecurity || mergeWithDefaults({}).accessSecurity;
        return (
            <>
                <h3 style={sectionTitleStyle}>Link & Access Control (Survey-Wide Defaults)</h3>
                <p style={subDescriptionStyle}>Note: Some of these settings can be overridden per collector.</p>
                 <div style={inputGroupStyle}>
                    <label htmlFor="linkExpirationDate" style={labelStyle}>Default Link Expiration Date (Optional):</label>
                    <input type="datetime-local" id="linkExpirationDate" name="linkExpirationDate" value={settings.linkExpirationDate || ''} onChange={(e) => handleInputChange('accessSecurity', e)} style={inputStyle} />
                </div>
                <div style={inputGroupStyle}>
                    <label htmlFor="maxResponses" style={labelStyle}>Default Maximum Responses (0 for unlimited):</label>
                    <input type="number" id="maxResponses" name="maxResponses" value={settings.maxResponses} onChange={(e) => handleInputChange('accessSecurity', e)} min="0" style={inputStyle} />
                </div>
                 <div style={inputGroupStyle}>
                    <input type="checkbox" id="passwordProtectionEnabled" name="passwordProtectionEnabled" checked={settings.passwordProtectionEnabled} onChange={(e) => handleInputChange('accessSecurity', e)} style={checkboxInputStyle} />
                    <label htmlFor="passwordProtectionEnabled" style={checkboxLabelStyle}>Enable Default Password Protection</label>
                </div>
                {settings.passwordProtectionEnabled && (
                    <div style={inputGroupStyle}>
                        <label htmlFor="surveyPassword" style={labelStyle}>Default Survey Password:</label>
                        <input type="text" id="surveyPassword" name="surveyPassword" value={settings.surveyPassword} onChange={(e) => handleInputChange('accessSecurity', e)} style={inputStyle} />
                    </div>
                )}
                <p style={{color:'#888', textAlign:'center', marginTop:'30px'}}>(More Access & Security settings coming soon...)</p>
            </>
        );
    };

    // +++ NEW: Render Behavior & Navigation Settings +++
    const renderBehaviorNavigationSettings = () => {
        const settings = currentSettings.behaviorNavigation || mergeWithDefaults({}).behaviorNavigation;
        return (
            <>
                <h3 style={sectionTitleStyle}>Survey Flow & Navigation</h3>
                <div style={inputGroupStyle}>
                    <input
                        type="checkbox"
                        id="autoAdvance"
                        name="autoAdvance"
                        checked={settings.autoAdvance || false}
                        onChange={(e) => handleInputChange('behaviorNavigation', e)}
                        style={checkboxInputStyle}
                    />
                    <label htmlFor="autoAdvance" style={checkboxLabelStyle}>Enable Auto-Advance</label>
                    <p style={subDescriptionStyle}>Automatically move to the next question after a selection is made on single-choice questions (e.g., Multiple Choice, Rating, NPS).</p>
                </div>

                <h3 style={{...sectionTitleStyle, marginTop:'30px'}}>Question Numbering</h3>
                <div style={inputGroupStyle}>
                    <input
                        type="checkbox"
                        id="questionNumberingEnabled"
                        name="questionNumberingEnabled"
                        checked={settings.questionNumberingEnabled === undefined ? true : settings.questionNumberingEnabled}
                        onChange={(e) => handleInputChange('behaviorNavigation', e)}
                        style={checkboxInputStyle}
                    />
                    <label htmlFor="questionNumberingEnabled" style={checkboxLabelStyle}>Enable Question Numbering</label>
                </div>

                {settings.questionNumberingEnabled && (
                    <div style={inputGroupStyle}>
                        <label htmlFor="questionNumberingFormat" style={labelStyle}>Numbering Format:</label>
                        <select
                            id="questionNumberingFormat"
                            name="questionNumberingFormat"
                            value={settings.questionNumberingFormat || '123'}
                            onChange={(e) => handleInputChange('behaviorNavigation', e)}
                            style={selectStyle}
                        >
                            <option value="123">Numbers (1, 2, 3...)</option>
                            <option value="ABC">Letters (A, B, C...)</option>
                            <option value="roman">Roman Numerals (I, II, III...)</option>
                            {/* <option value="custom">Custom Prefix</option> */} {/* Future enhancement */}
                        </select>
                    </div>
                )}
                {/* Placeholder for other settings like "Save and Continue Later" */}
                <p style={{color:'#888', textAlign:'center', marginTop:'30px'}}>(More Behavior & Navigation settings coming soon...)</p>
            </>
        );
    };


    return (
        <div style={panelStyle}>
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
                {activeCategory === SETTING_CATEGORIES.COMPLETION && renderCompletionSettings()}
                {activeCategory === SETTING_CATEGORIES.ACCESS_SECURITY && renderAccessSecuritySettings()}
                {activeCategory === SETTING_CATEGORIES.BEHAVIOR_NAVIGATION && renderBehaviorNavigationSettings()} {/* +++ NEW +++ */}
                
                {![SETTING_CATEGORIES.COMPLETION, SETTING_CATEGORIES.ACCESS_SECURITY, SETTING_CATEGORIES.BEHAVIOR_NAVIGATION].includes(activeCategory) && (
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
// ----- END OF COMPLETE UPDATED FILE (v1.1 - Added Behavior/Nav UI) -----