// frontend/src/components/SurveySettingsPanel.js
// ----- START OF COMPLETE UPDATED FILE (v1.2 - Save & Continue, Custom Vars UI) -----
import React, { useState, useEffect, useCallback } from 'react';

const SETTING_CATEGORIES = {
    COMPLETION: 'Survey Completion & Endings',
    ACCESS_SECURITY: 'Access & Security',
    BEHAVIOR_NAVIGATION: 'Behavior & Navigation',
    CUSTOM_VARIABLES: 'Custom Variables', // New Category
    APPEARANCE: 'Appearance & Branding',
    // DATA_COLLECTION: 'Data Collection',
    // NOTIFICATIONS: 'Notifications',
    // QUOTAS: 'Quotas',
};

const SurveySettingsPanel = ({ isOpen, onClose, settings: initialSettings, onSave, surveyId }) => {
    const [currentSettings, setCurrentSettings] = useState({});
    const [activeCategory, setActiveCategory] = useState(SETTING_CATEGORIES.COMPLETION);
    const [newCustomVarKey, setNewCustomVarKey] = useState('');
    const [newCustomVarLabel, setNewCustomVarLabel] = useState('');

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
            behaviorNavigation: {
                autoAdvance: false,
                questionNumberingEnabled: true,
                questionNumberingFormat: '123',
                // +++ NEW: Save and Continue Defaults +++
                saveAndContinueEnabled: false,
                saveAndContinueEmailLinkExpiryDays: 7,
            },
            // +++ NEW: Custom Variables Default +++
            customVariables: [], // Array of {key: string, label: string}
            appearance: {},
        };

        const merged = { ...defaults };
        for (const categoryKey in defaults) {
            if (defaults.hasOwnProperty(categoryKey)) {
                // Ensure nested objects are properly initialized
                merged[categoryKey] = {
                    ...defaults[categoryKey],
                    ...(settingsFromProps?.[categoryKey] || {})
                };
                // Specifically for customVariables, ensure it's an array
                if (categoryKey === 'customVariables' && !Array.isArray(merged[categoryKey])) {
                    merged[categoryKey] = settingsFromProps?.[categoryKey] ? [...settingsFromProps[categoryKey]] : [];
                }
            }
        }
        // Copy any top-level settings from props that aren't in defaults (e.g., _id, title if they were passed)
        for (const key in settingsFromProps) {
            if (settingsFromProps.hasOwnProperty(key) && !defaults.hasOwnProperty(key)) {
                merged[key] = settingsFromProps[key];
            }
        }
        return merged;
    }, []);


    useEffect(() => {
        if (isOpen) {
            const newMergedSettings = mergeWithDefaults(initialSettings);
            setCurrentSettings(newMergedSettings);
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
        const valToSet = type === 'checkbox' ? checked : (type === 'number' ? parseInt(value, 10) || 0 : value);
        handleNestedChange(category, name, valToSet);
    };

    const handleCustomVariableChange = (index, field, value) => {
        const updatedCustomVars = [...(currentSettings.customVariables || [])];
        updatedCustomVars[index] = { ...updatedCustomVars[index], [field]: value };
        setCurrentSettings(prev => ({ ...prev, customVariables: updatedCustomVars }));
    };

    const handleAddCustomVariable = () => {
        if (!newCustomVarKey.trim()) {
            alert("Custom variable key cannot be empty.");
            return;
        }
        // Basic key validation (alphanumeric and underscore)
        if (!/^[a-zA-Z0-9_]+$/.test(newCustomVarKey.trim())) {
            alert("Custom variable key can only contain letters, numbers, and underscores.");
            return;
        }
        const existingKeys = (currentSettings.customVariables || []).map(cv => cv.key);
        if (existingKeys.includes(newCustomVarKey.trim())) {
            alert("Custom variable key must be unique.");
            return;
        }

        const newVar = { key: newCustomVarKey.trim(), label: newCustomVarLabel.trim() || newCustomVarKey.trim() };
        setCurrentSettings(prev => ({
            ...prev,
            customVariables: [...(prev.customVariables || []), newVar]
        }));
        setNewCustomVarKey('');
        setNewCustomVarLabel('');
    };

    const handleRemoveCustomVariable = (index) => {
        const updatedCustomVars = [...(currentSettings.customVariables || [])];
        updatedCustomVars.splice(index, 1);
        setCurrentSettings(prev => ({ ...prev, customVariables: updatedCustomVars }));
    };


    const handleSave = () => {
        // Ensure customVariables is part of the saved object
        const settingsToSave = {
            completion: currentSettings.completion,
            accessSecurity: currentSettings.accessSecurity,
            behaviorNavigation: currentSettings.behaviorNavigation,
            customVariables: currentSettings.customVariables || [], // Ensure it's an array
            appearance: currentSettings.appearance,
        };
        console.log("Saving survey-wide settings:", settingsToSave);
        onSave(settingsToSave);
    };

    // --- Styling (Copied from previous, can be refactored) ---
    const panelStyle = { position: 'fixed', top: '0', right: '0', width: '480px', height: '100vh', backgroundColor: '#fdfdfd', borderLeft: '1px solid #ccc', boxShadow: '-3px 0 8px rgba(0,0,0,0.1)', zIndex: 1001, display: 'flex', flexDirection: 'column' };
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
    const buttonStyle = { padding: '8px 12px', marginRight: '10px', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer', fontWeight:'500', fontSize:'0.9em' };
    const primaryButtonStyle = { ...buttonStyle, backgroundColor: '#007bff', color: 'white', borderColor: '#007bff' };
    const secondaryButtonStyle = { ...buttonStyle, backgroundColor: '#6c757d', color: 'white', borderColor: '#6c757d' };
    const dangerButtonStyle = { ...buttonStyle, backgroundColor: '#dc3545', color: 'white', borderColor: '#dc3545' };
    const smallInputStyle = { ...inputStyle, width: 'calc(50% - 10px)', marginRight: '10px', display:'inline-block' };


    const renderCompletionSettings = () => {
        const settings = currentSettings.completion || mergeWithDefaults({}).completion;
        // ... (content from previous version, no changes needed here for now)
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
                            <input type="checkbox" id="showResponseSummary" name="showResponseSummary" checked={settings.showResponseSummary || false} onChange={(e) => handleInputChange('completion', e)} style={checkboxInputStyle} />
                            <label htmlFor="showResponseSummary" style={checkboxLabelStyle}>Display summary of responses</label>
                        </div>
                        <div style={inputGroupStyle}>
                            <input type="checkbox" id="showScore" name="showScore" checked={settings.showScore || false} onChange={(e) => handleInputChange('completion', e)} style={checkboxInputStyle} />
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
                            <input type="checkbox" id="passResponseDataToRedirect" name="passResponseDataToRedirect" checked={settings.passResponseDataToRedirect || false} onChange={(e) => handleInputChange('completion', e)} style={checkboxInputStyle} />
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
        // ... (content from previous version, no changes needed here for now)
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
                    <input type="number" id="maxResponses" name="maxResponses" value={settings.maxResponses || 0} onChange={(e) => handleInputChange('accessSecurity', e)} min="0" style={inputStyle} />
                </div>
                 <div style={inputGroupStyle}>
                    <input type="checkbox" id="passwordProtectionEnabled" name="passwordProtectionEnabled" checked={settings.passwordProtectionEnabled || false} onChange={(e) => handleInputChange('accessSecurity', e)} style={checkboxInputStyle} />
                    <label htmlFor="passwordProtectionEnabled" style={checkboxLabelStyle}>Enable Default Password Protection</label>
                </div>
                {settings.passwordProtectionEnabled && (
                    <div style={inputGroupStyle}>
                        <label htmlFor="surveyPassword" style={labelStyle}>Default Survey Password:</label>
                        <input type="text" id="surveyPassword" name="surveyPassword" value={settings.surveyPassword} onChange={(e) => handleInputChange('accessSecurity', e)} style={inputStyle} />
                    </div>
                )}
            </>
        );
    };

    const renderBehaviorNavigationSettings = () => {
        const settings = currentSettings.behaviorNavigation || mergeWithDefaults({}).behaviorNavigation;
        return (
            <>
                <h3 style={sectionTitleStyle}>Survey Flow & Navigation</h3>
                <div style={inputGroupStyle}>
                    <input type="checkbox" id="autoAdvance" name="autoAdvance" checked={settings.autoAdvance || false} onChange={(e) => handleInputChange('behaviorNavigation', e)} style={checkboxInputStyle} />
                    <label htmlFor="autoAdvance" style={checkboxLabelStyle}>Enable Auto-Advance</label>
                    <p style={subDescriptionStyle}>Automatically move to the next question after a selection is made on single-choice questions (e.g., Multiple Choice, Rating, NPS).</p>
                </div>

                <h3 style={{...sectionTitleStyle, marginTop:'30px'}}>Question Numbering</h3>
                <div style={inputGroupStyle}>
                    <input type="checkbox" id="questionNumberingEnabled" name="questionNumberingEnabled" checked={settings.questionNumberingEnabled === undefined ? true : settings.questionNumberingEnabled} onChange={(e) => handleInputChange('behaviorNavigation', e)} style={checkboxInputStyle} />
                    <label htmlFor="questionNumberingEnabled" style={checkboxLabelStyle}>Enable Question Numbering</label>
                </div>
                {settings.questionNumberingEnabled && (
                    <div style={inputGroupStyle}>
                        <label htmlFor="questionNumberingFormat" style={labelStyle}>Numbering Format:</label>
                        <select id="questionNumberingFormat" name="questionNumberingFormat" value={settings.questionNumberingFormat || '123'} onChange={(e) => handleInputChange('behaviorNavigation', e)} style={selectStyle} >
                            <option value="123">Numbers (1, 2, 3...)</option>
                            <option value="ABC">Letters (A, B, C...)</option>
                            <option value="roman">Roman Numerals (I, II, III...)</option>
                        </select>
                    </div>
                )}

                {/* +++ NEW: Save and Continue Later Settings +++ */}
                <h3 style={{...sectionTitleStyle, marginTop:'30px'}}>Save and Continue Later</h3>
                <div style={inputGroupStyle}>
                    <input type="checkbox" id="saveAndContinueEnabled" name="saveAndContinueEnabled" checked={settings.saveAndContinueEnabled || false} onChange={(e) => handleInputChange('behaviorNavigation', e)} style={checkboxInputStyle} />
                    <label htmlFor="saveAndContinueEnabled" style={checkboxLabelStyle}>Enable "Save and Continue Later"</label>
                    <p style={subDescriptionStyle}>Allows respondents to save their progress and resume via an emailed link.</p>
                </div>
                {settings.saveAndContinueEnabled && (
                    <div style={inputGroupStyle}>
                        <label htmlFor="saveAndContinueEmailLinkExpiryDays" style={labelStyle}>Resume Link Expiry (days):</label>
                        <input type="number" id="saveAndContinueEmailLinkExpiryDays" name="saveAndContinueEmailLinkExpiryDays" value={settings.saveAndContinueEmailLinkExpiryDays || 7} onChange={(e) => handleInputChange('behaviorNavigation', e)} min="1" max="90" style={inputStyle} />
                    </div>
                )}
            </>
        );
    };

    // +++ NEW: Render Custom Variables Settings +++
    const renderCustomVariablesSettings = () => {
        const customVars = currentSettings.customVariables || [];
        return (
            <>
                <h3 style={sectionTitleStyle}>Custom Variables (Hidden Fields)</h3>
                <p style={subDescriptionStyle}>Define keys for custom data you want to pass into the survey URL (e.g., `?source=email&id=123`). This data will be stored with each response.</p>
                
                <div style={{ border: '1px solid #eee', padding: '15px', borderRadius: '4px', background:'#f9f9f9' }}>
                    {customVars.length > 0 && customVars.map((cv, index) => (
                        <div key={index} style={{ display: 'flex', alignItems: 'center', marginBottom: '10px', paddingBottom:'10px', borderBottom: index < customVars.length -1 ? '1px dashed #ddd': 'none' }}>
                            <input type="text" placeholder="Key (e.g., campaign_id)" value={cv.key} onChange={(e) => handleCustomVariableChange(index, 'key', e.target.value)} style={{...inputStyle, width:'40%', marginRight:'10px'}} />
                            <input type="text" placeholder="Label (Optional Description)" value={cv.label} onChange={(e) => handleCustomVariableChange(index, 'label', e.target.value)} style={{...inputStyle, width:'40%', marginRight:'10px'}} />
                            <button onClick={() => handleRemoveCustomVariable(index)} style={{...dangerButtonStyle, padding:'8px 10px', fontSize:'0.85em'}}>Remove</button>
                        </div>
                    ))}
                
                    <div style={{ display: 'flex', alignItems: 'center', marginTop: customVars.length > 0 ? '20px' : '0px', paddingTop: customVars.length > 0 ? '15px' : '0px', borderTop: customVars.length > 0 ? '1px solid #ddd' : 'none' }}>
                        <input type="text" placeholder="New Key (no spaces)" value={newCustomVarKey} onChange={(e) => setNewCustomVarKey(e.target.value)} style={{...inputStyle, width:'calc(40% - 5px)', marginRight:'10px'}} />
                        <input type="text" placeholder="New Label (Optional)" value={newCustomVarLabel} onChange={(e) => setNewCustomVarLabel(e.target.value)} style={{...inputStyle, width:'calc(40% - 5px)', marginRight:'10px'}} />
                        <button onClick={handleAddCustomVariable} style={{...primaryButtonStyle, padding:'8px 10px', fontSize:'0.85em', flexShrink:0}}>Add Variable</button>
                    </div>
                </div>
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
                {activeCategory === SETTING_CATEGORIES.BEHAVIOR_NAVIGATION && renderBehaviorNavigationSettings()}
                {activeCategory === SETTING_CATEGORIES.CUSTOM_VARIABLES && renderCustomVariablesSettings()} {/* +++ NEW +++ */}
                
                {![
                    SETTING_CATEGORIES.COMPLETION, 
                    SETTING_CATEGORIES.ACCESS_SECURITY, 
                    SETTING_CATEGORIES.BEHAVIOR_NAVIGATION,
                    SETTING_CATEGORIES.CUSTOM_VARIABLES // Added here
                ].includes(activeCategory) && (
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
// ----- END OF COMPLETE UPDATED FILE (v1.2 - Save & Continue, Custom Vars UI) -----