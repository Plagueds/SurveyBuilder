// frontend/src/components/SurveySettingsPanel.js
// ----- START OF COMPLETE UPDATED FILE (v1.7.1 - Fix `styles` not defined error) -----
import React, { useState, useEffect, useCallback } from 'react';

const SETTING_CATEGORIES = {
    GENERAL: 'General Survey Status',
    COMPLETION: 'Survey Completion & Endings',
    ACCESS_SECURITY: 'Access & Security',
    BEHAVIOR_NAVIGATION: 'Behavior & Navigation',
    CUSTOM_VARIABLES: 'Custom Variables',
    APPEARANCE: 'Appearance & Branding',
};

// Styles
const panelStyle = { position: 'fixed', top: '0', right: '0', width: '480px', height: '100vh', backgroundColor: '#fdfdfd', borderLeft: '1px solid #ccc', boxShadow: '-3px 0 8px rgba(0,0,0,0.1)', zIndex: 1001, display: 'flex', flexDirection: 'column' };
const headerStyle = { padding: '15px 20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor:'#f7f7f7' };
const navStyle = { display: 'flex', borderBottom: '1px solid #eee', backgroundColor: '#f0f0f0', flexWrap: 'wrap' };
const navButtonStyle = (isActive) => ({ padding: '10px 15px', border: 'none', background: isActive ? '#fff' : 'transparent', cursor: 'pointer', borderRight: '1px solid #eee', fontWeight: isActive ? 'bold' : 'normal', fontSize:'0.85em', flexShrink:0 });
const contentStyle = { padding: '20px', overflowY: 'auto', flexGrow: 1 };
const sectionTitleStyle = { marginTop: '0', marginBottom: '15px', borderBottom: '1px solid #e0e0e0', paddingBottom: '10px', color: '#333', fontSize:'1.1em' };
const subSectionTitleStyle = { marginTop: '25px', marginBottom: '15px', borderBottom: '1px dotted #e0e0e0', paddingBottom: '8px', color: '#444', fontSize:'1.0em', fontWeight: '600' };
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
const customVarRowStyle = { display: 'flex', alignItems: 'center', marginBottom: '10px', paddingBottom:'10px', borderBottom: '1px dashed #ddd' };
const customVarInputStyle = {...inputStyle, width:'38%', marginRight:'10px'};
const customVarDefaultInputStyle = {...inputStyle, width:'calc(24% - 20px)', marginRight:'10px'};
const customVarAddRowStyle = { display: 'flex', alignItems: 'center', marginTop: '20px', paddingTop: '15px', borderTop: '1px solid #ddd' };
const customVarAddInputStyle = {...inputStyle, width:'calc(38% - 5px)', marginRight:'10px'};
const customVarAddDefaultInputStyle = {...inputStyle, width:'calc(24% - 15px)', marginRight:'10px'};
const customVarButton = {...primaryButtonStyle, padding:'8px 10px', fontSize:'0.85em', flexShrink:0};
const customVarRemoveButton = {...dangerButtonStyle, padding:'8px 10px', fontSize:'0.85em'};
const disabledLabelStyle = { color: '#999' }; // Simple style for disabled label text


const SurveySettingsPanel = ({ isOpen, onClose, initialSurveyData, onSave, surveyId }) => {
    const [currentSettings, setCurrentSettings] = useState({});
    const [surveyStatus, setSurveyStatus] = useState('draft');
    const [activeCategory, setActiveCategory] = useState(SETTING_CATEGORIES.GENERAL);
    const [newCustomVarKey, setNewCustomVarKey] = useState('');
    const [newCustomVarLabel, setNewCustomVarLabel] = useState('');
    const [newCustomVarDefaultValue, setNewCustomVarDefaultValue] = useState('');


    const mergeWithDefaults = useCallback((settingsFromProps) => {
        const defaults = {
            completion: { type: 'thankYouPage', thankYouMessage: 'Thank you for completing the survey!', showResponseSummary: false, showScore: false, redirectUrl: '', passResponseDataToRedirect: false, disqualificationType: 'message', disqualificationMessage: 'Unfortunately, you do not qualify to continue with this survey.', disqualificationRedirectUrl: '', surveyClosedMessage: 'This survey is currently closed. Thank you for your interest.', },
            accessSecurity: { linkExpirationDate: null, maxResponses: 0, passwordProtectionEnabled: false, surveyPassword: '', },
            behaviorNavigation: { 
                questionDisplayMode: 'onePerPage', 
                autoAdvance: false, 
                questionNumberingEnabled: true, questionNumberingFormat: '123', questionNumberingCustomPrefix: '', 
                saveAndContinueEnabled: false, saveAndContinueEmailLinkExpiryDays: 7, saveAndContinueMethod: 'email',
                autoSaveEnabled: false, autoSaveIntervalSeconds: 60,
            },
            customVariables: [], 
            appearance: {},
        };
        const merged = {};
        for (const categoryKey in defaults) {
            if (defaults.hasOwnProperty(categoryKey)) {
                merged[categoryKey] = { ...defaults[categoryKey], ...(settingsFromProps?.[categoryKey] || {}) };
                if (categoryKey === 'customVariables' && !Array.isArray(merged[categoryKey])) {
                    merged[categoryKey] = settingsFromProps?.[categoryKey] && Array.isArray(settingsFromProps[categoryKey]) 
                                          ? [...settingsFromProps[categoryKey]] 
                                          : [];
                }
                if (categoryKey === 'behaviorNavigation') {
                    if (typeof merged[categoryKey] !== 'object' || merged[categoryKey] === null) {
                        merged[categoryKey] = { ...defaults[categoryKey] };
                    }
                    const bn = merged[categoryKey];
                    const validMethods = ['email', 'code', 'both'];
                    if (!validMethods.includes(bn.saveAndContinueMethod)) {
                        bn.saveAndContinueMethod = defaults.behaviorNavigation.saveAndContinueMethod;
                    }
                    let days = bn.saveAndContinueEmailLinkExpiryDays;
                    if (typeof days !== 'number' || isNaN(days) || days < 1) {
                        days = defaults.behaviorNavigation.saveAndContinueEmailLinkExpiryDays;
                    } else if (days > 90) { days = 90; }
                    bn.saveAndContinueEmailLinkExpiryDays = days;

                    if (bn.autoSaveEnabled === undefined) bn.autoSaveEnabled = defaults.behaviorNavigation.autoSaveEnabled;
                    if (bn.autoSaveIntervalSeconds === undefined) bn.autoSaveIntervalSeconds = defaults.behaviorNavigation.autoSaveIntervalSeconds;
                    if (bn.questionDisplayMode === undefined) bn.questionDisplayMode = defaults.behaviorNavigation.questionDisplayMode;
                }
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
            try {
                const settingsFromProps = initialSurveyData?.settings || {};
                const newMergedSettings = mergeWithDefaults(settingsFromProps);
                setCurrentSettings(newMergedSettings);
                setSurveyStatus(initialSurveyData?.status || 'draft');
            } catch (error) {
                console.error("Error merging settings in SurveySettingsPanel:", error);
                setCurrentSettings(mergeWithDefaults({}));
                setSurveyStatus('draft');
            }
        }
    }, [isOpen, initialSurveyData, mergeWithDefaults]);

    if (!isOpen || Object.keys(currentSettings).length === 0) {
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
        let valToSet;
        if (type === 'checkbox') {
            valToSet = checked;
        } else if (type === 'number') {
            if (name === 'saveAndContinueEmailLinkExpiryDays' || name === 'autoSaveIntervalSeconds') {
                valToSet = value === '' ? '' : parseInt(value, 10); 
            } else {
                const numVal = parseInt(value, 10);
                valToSet = isNaN(numVal) ? 0 : numVal;
            }
        } else {
            valToSet = value;
        }
        handleNestedChange(category, name, valToSet);
    };
    
    const getValidatedExpiryDays = (currentDaysValue) => {
        let days = parseInt(currentDaysValue, 10);
        if (isNaN(days) || days < 1) { return 1; }
        if (days > 90) { return 90; }
        return days;
    };

    const getValidatedAutoSaveInterval = (currentSecondsValue) => {
        let seconds = parseInt(currentSecondsValue, 10);
        if (isNaN(seconds) || seconds < 15) return 15;
        if (seconds > 300) return 300;
        return seconds;
    };

    const handleCustomVariableChange = (index, field, value) => {
        const updatedCustomVars = [...(currentSettings.customVariables || [])];
        updatedCustomVars[index] = { ...updatedCustomVars[index], [field]: value };
        setCurrentSettings(prev => ({ ...prev, customVariables: updatedCustomVars }));
    };

    const handleAddCustomVariable = () => {
        const keyTrimmed = newCustomVarKey.trim();
        if (!keyTrimmed) { alert("Custom variable key cannot be empty."); return; }
        if (!/^[a-zA-Z0-9_]+$/.test(keyTrimmed)) { alert("Custom variable key can only contain letters, numbers, and underscores."); return; }
        const existingKeys = (currentSettings.customVariables || []).map(cv => cv.key);
        if (existingKeys.includes(keyTrimmed)) { alert("Custom variable key must be unique."); return; }
        
        const newVar = { 
            key: keyTrimmed, 
            label: newCustomVarLabel.trim() || keyTrimmed,
            defaultValue: newCustomVarDefaultValue.trim()
        };
        setCurrentSettings(prev => ({
            ...prev,
            customVariables: [...(prev.customVariables || []), newVar]
        }));
        setNewCustomVarKey('');
        setNewCustomVarLabel('');
        setNewCustomVarDefaultValue('');
    };

    const handleRemoveCustomVariable = (indexToRemove) => {
        setCurrentSettings(prev => ({
            ...prev,
            customVariables: (prev.customVariables || []).filter((_, index) => index !== indexToRemove)
        }));
    };

    const handleSave = () => {
        const validatedSettings = { ...currentSettings };
        
        validatedSettings.behaviorNavigation = {
            ...mergeWithDefaults(null).behaviorNavigation, 
            ...(validatedSettings.behaviorNavigation || {}), 
        };
        validatedSettings.behaviorNavigation.saveAndContinueEmailLinkExpiryDays = getValidatedExpiryDays(
            validatedSettings.behaviorNavigation.saveAndContinueEmailLinkExpiryDays
        );
        validatedSettings.behaviorNavigation.autoSaveIntervalSeconds = getValidatedAutoSaveInterval(
            validatedSettings.behaviorNavigation.autoSaveIntervalSeconds
        );
        
        validatedSettings.customVariables = Array.isArray(validatedSettings.customVariables) 
            ? validatedSettings.customVariables 
            : [];

        const settingsObjectForPayload = {
            completion: validatedSettings.completion || mergeWithDefaults(null).completion,
            accessSecurity: validatedSettings.accessSecurity || mergeWithDefaults(null).accessSecurity,
            behaviorNavigation: validatedSettings.behaviorNavigation,
            customVariables: validatedSettings.customVariables,
            appearance: validatedSettings.appearance || mergeWithDefaults(null).appearance,
        };

        const finalPayload = { status: surveyStatus, settings: settingsObjectForPayload };
        console.log("SurveySettingsPanel: Saving data:", JSON.stringify(finalPayload, null, 2));
        onSave(finalPayload);
    };
    
    const renderGeneralSettings = () => ( <> <h3 style={sectionTitleStyle}>Survey Status</h3> <div style={inputGroupStyle}> <label htmlFor="surveyStatus" style={labelStyle}>Current Status:</label> <select id="surveyStatus" name="surveyStatus" value={surveyStatus} onChange={(e) => setSurveyStatus(e.target.value)} style={selectStyle} > <option value="draft">Draft (Not collecting responses)</option> <option value="active">Active (Collecting responses)</option> <option value="closed">Closed (Manually stopped)</option> <option value="archived">Archived (Hidden, data retained)</option> </select> <p style={subDescriptionStyle}> - <strong>Draft:</strong> Initial state, not publicly accessible. <br/> - <strong>Active:</strong> Survey is live and collectors can be open. <br/> - <strong>Closed:</strong> Manually stop collection, displays "Survey Closed" message. <br/> - <strong>Archived:</strong> Remove from active lists, data kept. </p> </div> </> );
    const renderCompletionSettings = () => { const settings = currentSettings.completion || mergeWithDefaults({}).completion; return ( <> <h3 style={sectionTitleStyle}>End of Survey Experience</h3> <div style={inputGroupStyle}> <label style={labelStyle}>When survey is completed, show:</label> <select name="type" value={settings.type || 'thankYouPage'} onChange={(e) => handleNestedChange('completion', 'type', e.target.value)} style={selectStyle} > <option value="thankYouPage">A thank you page</option> <option value="redirect">Redirect to a URL</option> <option value="closeWindow">Close the window (not recommended)</option> </select> </div> {settings.type === 'thankYouPage' && ( <> <div style={inputGroupStyle}> <label htmlFor="thankYouMessage" style={labelStyle}>Thank You Message:</label> <textarea id="thankYouMessage" name="thankYouMessage" value={settings.thankYouMessage || ''} onChange={(e) => handleInputChange('completion', e)} style={textareaStyle} /> </div> <div style={inputGroupStyle}> <input type="checkbox" id="showResponseSummary" name="showResponseSummary" checked={settings.showResponseSummary || false} onChange={(e) => handleInputChange('completion', e)} style={checkboxInputStyle} /> <label htmlFor="showResponseSummary" style={checkboxLabelStyle}>Display summary of responses</label> </div> <div style={inputGroupStyle}> <input type="checkbox" id="showScore" name="showScore" checked={settings.showScore || false} onChange={(e) => handleInputChange('completion', e)} style={checkboxInputStyle} /> <label htmlFor="showScore" style={checkboxLabelStyle}>Display score (for quizzes)</label> </div> </> )} {settings.type === 'redirect' && ( <> <div style={inputGroupStyle}> <label htmlFor="redirectUrl" style={labelStyle}>Redirect URL:</label> <input type="url" id="redirectUrl" name="redirectUrl" value={settings.redirectUrl || ''} onChange={(e) => handleInputChange('completion', e)} style={inputStyle} placeholder="https://example.com" /> </div> <div style={inputGroupStyle}> <input type="checkbox" id="passResponseDataToRedirect" name="passResponseDataToRedirect" checked={settings.passResponseDataToRedirect || false} onChange={(e) => handleInputChange('completion', e)} style={checkboxInputStyle} /> <label htmlFor="passResponseDataToRedirect" style={checkboxLabelStyle}>Pass response data to redirect URL</label> <p style={subDescriptionStyle}>Appends query params like ?responseID={'{responseID}'}.</p> </div> </> )} <h3 style={{...sectionTitleStyle, marginTop:'30px'}}>Disqualification Handling</h3> <div style={inputGroupStyle}> <label style={labelStyle}>If respondent is disqualified:</label> <select name="disqualificationType" value={settings.disqualificationType || 'message'} onChange={(e) => handleNestedChange('completion', 'disqualificationType', e.target.value)} style={selectStyle} > <option value="message">Show a custom message</option> <option value="redirect">Redirect to a URL</option> </select> </div> {settings.disqualificationType === 'message' && ( <div style={inputGroupStyle}> <label htmlFor="disqualificationMessage" style={labelStyle}>Disqualification Message:</label> <textarea id="disqualificationMessage" name="disqualificationMessage" value={settings.disqualificationMessage || ''} onChange={(e) => handleInputChange('completion', e)} style={textareaStyle} /> </div> )} {settings.disqualificationType === 'redirect' && ( <div style={inputGroupStyle}> <label htmlFor="disqualificationRedirectUrl" style={labelStyle}>Disqualification Redirect URL:</label> <input type="url" id="disqualificationRedirectUrl" name="disqualificationRedirectUrl" value={settings.disqualificationRedirectUrl || ''} onChange={(e) => handleInputChange('completion', e)} style={inputStyle} placeholder="https://example.com/disqualified" /> </div> )} <h3 style={{...sectionTitleStyle, marginTop:'30px'}}>Survey Closed Message</h3> <div style={inputGroupStyle}> <label htmlFor="surveyClosedMessage" style={labelStyle}>Message for Closed Survey:</label> <textarea id="surveyClosedMessage" name="surveyClosedMessage" value={settings.surveyClosedMessage || ''} onChange={(e) => handleInputChange('completion', e)} style={textareaStyle} placeholder="e.g., This survey has ended." /> <p style={subDescriptionStyle}>Displayed when survey is closed, expired, or over quota.</p> </div> </> ); };
    const renderAccessSecuritySettings = () => { const settings = currentSettings.accessSecurity || mergeWithDefaults({}).accessSecurity; return ( <> <h3 style={sectionTitleStyle}>Link & Access Control (Survey-Wide Defaults)</h3> <p style={subDescriptionStyle}>Note: Some of these settings can be overridden per collector.</p> <div style={inputGroupStyle}> <label htmlFor="linkExpirationDate" style={labelStyle}>Default Link Expiration Date (Optional):</label> <input type="datetime-local" id="linkExpirationDate" name="linkExpirationDate" value={settings.linkExpirationDate ? settings.linkExpirationDate.substring(0, 16) : ''} onChange={(e) => handleInputChange('accessSecurity', e)} style={inputStyle} /> </div> <div style={inputGroupStyle}> <label htmlFor="maxResponses" style={labelStyle}>Default Maximum Responses (0 for unlimited):</label> <input type="number" id="maxResponses" name="maxResponses" value={settings.maxResponses || 0} onChange={(e) => handleInputChange('accessSecurity', e)} min="0" style={inputStyle} /> </div> <div style={inputGroupStyle}> <input type="checkbox" id="passwordProtectionEnabled" name="passwordProtectionEnabled" checked={settings.passwordProtectionEnabled || false} onChange={(e) => handleInputChange('accessSecurity', e)} style={checkboxInputStyle} /> <label htmlFor="passwordProtectionEnabled" style={checkboxLabelStyle}>Enable Default Password Protection</label> </div> {settings.passwordProtectionEnabled && ( <div style={inputGroupStyle}> <label htmlFor="surveyPassword" style={labelStyle}>Default Survey Password:</label> <input type="text" id="surveyPassword" name="surveyPassword" value={settings.surveyPassword || ''} onChange={(e) => handleInputChange('accessSecurity', e)} style={inputStyle} /> </div> )} </> ); };
    
    const renderBehaviorNavigationSettings = () => {
        const defaultBehaviorNav = mergeWithDefaults(null).behaviorNavigation;
        const settings = currentSettings.behaviorNavigation ? { ...defaultBehaviorNav, ...currentSettings.behaviorNavigation } : defaultBehaviorNav;
        const displayExpiryDays = typeof settings.saveAndContinueEmailLinkExpiryDays === 'number' ? settings.saveAndContinueEmailLinkExpiryDays : '';
        const displayAutoSaveInterval = typeof settings.autoSaveIntervalSeconds === 'number' ? settings.autoSaveIntervalSeconds : '';

        return (
            <>
                <h3 style={sectionTitleStyle}>Survey Flow & Navigation</h3>

                <div style={inputGroupStyle}>
                    <label htmlFor="questionDisplayMode" style={labelStyle}>Question Display Format:</label>
                    <select 
                        id="questionDisplayMode" 
                        name="questionDisplayMode" 
                        value={settings.questionDisplayMode || 'onePerPage'} 
                        onChange={(e) => handleInputChange('behaviorNavigation', e)} 
                        style={selectStyle}
                    >
                        <option value="onePerPage">One question per page</option>
                        <option value="allOnOnePage">All questions on one page (scrollable)</option>
                        {/* <option value="sectionsPerPage" disabled>Sections on one page (Coming Soon)</option> */}
                    </select>
                    <p style={subDescriptionStyle}>Choose how questions are presented to respondents.</p>
                </div>

                <div style={inputGroupStyle}>
                    <input type="checkbox" id="autoAdvance" name="autoAdvance" checked={settings.autoAdvance || false} onChange={(e) => handleInputChange('behaviorNavigation', e)} style={checkboxInputStyle} disabled={settings.questionDisplayMode === 'allOnOnePage'}/>
                    {/* Applying inline style for disabled label as styles object is not used for CSS modules here */}
                    <label htmlFor="autoAdvance" style={{...checkboxLabelStyle, ...(settings.questionDisplayMode === 'allOnOnePage' ? disabledLabelStyle : {})}}>Enable Auto-Advance</label>
                    <p style={subDescriptionStyle}>
                        Automatically move to the next question after a selection. 
                        {settings.questionDisplayMode === 'allOnOnePage' && <em> (Not applicable for "All questions on one page" mode)</em>}
                    </p>
                </div>

                <h3 style={subSectionTitleStyle}>Question Numbering</h3>
                <div style={inputGroupStyle}> <input type="checkbox" id="questionNumberingEnabled" name="questionNumberingEnabled" checked={settings.questionNumberingEnabled === undefined ? true : settings.questionNumberingEnabled} onChange={(e) => handleInputChange('behaviorNavigation', e)} style={checkboxInputStyle} /> <label htmlFor="questionNumberingEnabled" style={checkboxLabelStyle}>Enable Question Numbering</label> </div> {settings.questionNumberingEnabled && ( <> <div style={inputGroupStyle}> <label htmlFor="questionNumberingFormat" style={labelStyle}>Numbering Format:</label> <select id="questionNumberingFormat" name="questionNumberingFormat" value={settings.questionNumberingFormat || '123'} onChange={(e) => handleInputChange('behaviorNavigation', e)} style={selectStyle} > <option value="123">Numbers (1, 2, 3...)</option> <option value="ABC">Letters (A, B, C...)</option> <option value="roman">Roman Numerals (I, II, III...)</option> </select> </div> <div style={inputGroupStyle}> <label htmlFor="questionNumberingCustomPrefix" style={labelStyle}>Custom Prefix (Optional):</label> <input type="text" id="questionNumberingCustomPrefix" name="questionNumberingCustomPrefix" value={settings.questionNumberingCustomPrefix || ''} onChange={(e) => handleInputChange('behaviorNavigation', e)} style={inputStyle} placeholder="e.g., Q, Section A -" /> <p style={subDescriptionStyle}>Prefix will appear before the number/letter (e.g., Q1, Q A).</p> </div> </> )}


                <h3 style={subSectionTitleStyle}>Save and Continue Later</h3>
                <div style={inputGroupStyle}> <input type="checkbox" id="saveAndContinueEnabled" name="saveAndContinueEnabled" checked={settings.saveAndContinueEnabled || false} onChange={(e) => handleInputChange('behaviorNavigation', e)} style={checkboxInputStyle} /> <label htmlFor="saveAndContinueEnabled" style={checkboxLabelStyle}>Enable "Save and Continue Later" (Manual Save)</label> </div> {settings.saveAndContinueEnabled && ( <> <div style={inputGroupStyle}> <label htmlFor="saveAndContinueMethod" style={labelStyle}>Resume Method:</label> <select id="saveAndContinueMethod" name="saveAndContinueMethod" value={settings.saveAndContinueMethod || 'email'} onChange={(e) => handleInputChange('behaviorNavigation', e)} style={selectStyle} > <option value="email">Email Link Only</option> <option value="code">Resume Code Only</option> <option value="both">Email Link and Resume Code</option> </select> <p style={subDescriptionStyle}> {settings.saveAndContinueMethod === 'email' && "Respondent provides email, receives a resume link."} {settings.saveAndContinueMethod === 'code' && "Respondent is shown a unique code to copy and use later."} {settings.saveAndContinueMethod === 'both' && "Respondent provides email, receives a link, and is also shown a resume code."} </p> </div> <div style={inputGroupStyle}> <label htmlFor="saveAndContinueEmailLinkExpiryDays" style={labelStyle}>Resume Link/Code Expiry (days):</label> <input type="number" id="saveAndContinueEmailLinkExpiryDays" name="saveAndContinueEmailLinkExpiryDays" value={displayExpiryDays} onChange={(e) => handleInputChange('behaviorNavigation', e)} min="1" max="90" style={inputStyle} placeholder="1-90" /> <p style={subDescriptionStyle}>Must be between 1 and 90 days.</p> </div> </> )} {settings.saveAndContinueEnabled && ( <> <h3 style={subSectionTitleStyle}>Auto-Save on Inactivity</h3> <div style={inputGroupStyle}> <input type="checkbox" id="autoSaveEnabled" name="autoSaveEnabled" checked={settings.autoSaveEnabled || false} onChange={(e) => handleInputChange('behaviorNavigation', e)} style={checkboxInputStyle} /> <label htmlFor="autoSaveEnabled" style={checkboxLabelStyle}>Enable Auto-Save</label> <p style={subDescriptionStyle}>Automatically save respondent's progress after a period of inactivity. Uses the same "Save and Continue" mechanism.</p> </div> {settings.autoSaveEnabled && ( <div style={inputGroupStyle}> <label htmlFor="autoSaveIntervalSeconds" style={labelStyle}>Auto-Save After Inactivity (seconds):</label> <input type="number" id="autoSaveIntervalSeconds" name="autoSaveIntervalSeconds" value={displayAutoSaveInterval} onChange={(e) => handleInputChange('behaviorNavigation', e)} min="15" max="300" style={inputStyle} placeholder="15-300" /> <p style={subDescriptionStyle}>Time in seconds (e.g., 60 for 1 minute). Min: 15s, Max: 300s (5 mins).</p> </div> )} </> )}
            </>
        );
    };
    
    const renderCustomVariablesSettings = () => { const customVars = currentSettings.customVariables || []; return ( <> <h3 style={sectionTitleStyle}>Custom Variables (Hidden Fields)</h3> <p style={subDescriptionStyle}> Define keys for custom data you want to pass into the survey URL (e.g., `?source=email&id=123`). This data will be stored with each response. Keys must be unique and contain only letters, numbers, and underscores. </p> <div style={{ border: '1px solid #eee', padding: '15px', borderRadius: '4px', background:'#f9f9f9' }}> {customVars.length > 0 && customVars.map((cv, index) => ( <div key={index} style={customVarRowStyle}> <input type="text" placeholder="Key (e.g., campaign_id)" value={cv.key || ''} onChange={(e) => handleCustomVariableChange(index, 'key', e.target.value)} style={customVarInputStyle} /> <input type="text" placeholder="Label (Optional)" value={cv.label || ''} onChange={(e) => handleCustomVariableChange(index, 'label', e.target.value)} style={customVarInputStyle} /> <input type="text" placeholder="Default Value (Optional)" value={cv.defaultValue || ''} onChange={(e) => handleCustomVariableChange(index, 'defaultValue', e.target.value)} style={customVarDefaultInputStyle} /> <button onClick={() => handleRemoveCustomVariable(index)} style={customVarRemoveButton}>Remove</button> </div> ))} <div style={customVars.length > 0 ? customVarAddRowStyle : {display: 'flex', alignItems: 'center', marginTop: '0px'}}> <input type="text" placeholder="New Key" value={newCustomVarKey} onChange={(e) => setNewCustomVarKey(e.target.value)} style={customVarAddInputStyle}/> <input type="text" placeholder="New Label" value={newCustomVarLabel} onChange={(e) => setNewCustomVarLabel(e.target.value)} style={customVarAddInputStyle}/> <input type="text" placeholder="New Default Value" value={newCustomVarDefaultValue} onChange={(e) => setNewCustomVarDefaultValue(e.target.value)} style={customVarAddDefaultInputStyle}/> <button onClick={handleAddCustomVariable} style={customVarButton}>Add</button> </div> </div> </> ); };
    const renderAppearanceSettings = () => { return <p>Appearance settings are not yet implemented.</p>; };

    return ( <div style={panelStyle}> <div style={headerStyle}> <h2 style={{ margin: 0, fontSize: '1.3em', fontWeight:'600' }}>Survey Settings</h2> <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.8rem', cursor: 'pointer', color:'#555', padding:0, lineHeight:'1' }}>&times;</button> </div> <nav style={navStyle}> {Object.entries(SETTING_CATEGORIES).map(([key, title]) => ( <button key={key} onClick={() => setActiveCategory(title)} style={navButtonStyle(activeCategory === title)} > {title} </button> ))} </nav> <div style={contentStyle}> {activeCategory === SETTING_CATEGORIES.GENERAL && renderGeneralSettings()} {activeCategory === SETTING_CATEGORIES.COMPLETION && renderCompletionSettings()} {activeCategory === SETTING_CATEGORIES.ACCESS_SECURITY && renderAccessSecuritySettings()} {activeCategory === SETTING_CATEGORIES.BEHAVIOR_NAVIGATION && renderBehaviorNavigationSettings()} {activeCategory === SETTING_CATEGORIES.CUSTOM_VARIABLES && renderCustomVariablesSettings()} {activeCategory === SETTING_CATEGORIES.APPEARANCE && renderAppearanceSettings()} </div> <div style={footerStyle}> <button onClick={onClose} style={secondaryButtonStyle}>Cancel</button> <button onClick={handleSave} style={primaryButtonStyle}>Apply Settings</button> </div> </div> );
};

export default SurveySettingsPanel;
// ----- END OF COMPLETE UPDATED FILE (v1.7.1 - Fix `styles` not defined error) -----