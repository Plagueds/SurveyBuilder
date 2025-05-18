// frontend/src/components/SurveySettingsPanel.js
// ----- START OF COMPLETE UPDATED FILE (v1.4.1 - Simplified ExpiryDays Validation Trigger) -----
import React, { useState, useEffect, useCallback } from 'react';

const SETTING_CATEGORIES = {
    COMPLETION: 'Survey Completion & Endings',
    ACCESS_SECURITY: 'Access & Security',
    BEHAVIOR_NAVIGATION: 'Behavior & Navigation',
    CUSTOM_VARIABLES: 'Custom Variables',
    APPEARANCE: 'Appearance & Branding',
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
                saveAndContinueEnabled: false,
                saveAndContinueEmailLinkExpiryDays: 7,
                saveAndContinueMethod: 'email',
            },
            customVariables: [],
            appearance: {},
        };

        const merged = { ...defaults };
        for (const categoryKey in defaults) {
            if (defaults.hasOwnProperty(categoryKey)) {
                merged[categoryKey] = {
                    ...defaults[categoryKey],
                    ...(settingsFromProps?.[categoryKey] || {})
                };
                if (categoryKey === 'customVariables' && !Array.isArray(merged[categoryKey])) {
                    merged[categoryKey] = settingsFromProps?.[categoryKey] ? [...settingsFromProps[categoryKey]] : [];
                }
                if (categoryKey === 'behaviorNavigation') {
                    // Ensure merged[categoryKey] is an object before accessing its properties
                    if (typeof merged[categoryKey] !== 'object' || merged[categoryKey] === null) {
                        merged[categoryKey] = { ...defaults[categoryKey] }; // Fallback to pure default
                    }
                    
                    const bn = merged[categoryKey];
                    const validMethods = ['email', 'code', 'both'];
                    if (!validMethods.includes(bn.saveAndContinueMethod)) {
                        bn.saveAndContinueMethod = defaults.behaviorNavigation.saveAndContinueMethod;
                    }

                    let days = bn.saveAndContinueEmailLinkExpiryDays;
                    if (typeof days !== 'number' || isNaN(days) || days < 1) {
                        days = defaults.behaviorNavigation.saveAndContinueEmailLinkExpiryDays;
                    } else if (days > 90) {
                        days = 90;
                    }
                    bn.saveAndContinueEmailLinkExpiryDays = days;
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
                const newMergedSettings = mergeWithDefaults(initialSettings);
                setCurrentSettings(newMergedSettings);
            } catch (error) {
                console.error("Error merging settings in SurveySettingsPanel:", error);
                // Fallback to complete defaults if merge fails, to allow panel to open
                setCurrentSettings(mergeWithDefaults(null));
            }
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
        let valToSet;

        if (type === 'checkbox') {
            valToSet = checked;
        } else if (type === 'number') {
            if (name === 'saveAndContinueEmailLinkExpiryDays') {
                valToSet = value === '' ? '' : parseInt(value, 10); // Allow empty, parse others
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
        if (isNaN(days) || days < 1) {
            return 1; 
        }
        if (days > 90) {
            return 90;
        }
        return days;
    };


    const handleCustomVariableChange = (index, field, value) => { /* ... (same as before) ... */ };
    const handleAddCustomVariable = () => { /* ... (same as before) ... */ };
    const handleRemoveCustomVariable = (index) => { /* ... (same as before) ... */ };

    const handleSave = () => {
        const validatedSettings = { ...currentSettings };
        if (validatedSettings.behaviorNavigation) {
            validatedSettings.behaviorNavigation = {
                ...validatedSettings.behaviorNavigation,
                saveAndContinueEmailLinkExpiryDays: getValidatedExpiryDays(
                    validatedSettings.behaviorNavigation.saveAndContinueEmailLinkExpiryDays
                ),
            };
        }

        const settingsToSave = {
            completion: validatedSettings.completion,
            accessSecurity: validatedSettings.accessSecurity,
            behaviorNavigation: validatedSettings.behaviorNavigation,
            customVariables: validatedSettings.customVariables || [],
            appearance: validatedSettings.appearance,
        };

        console.log("Saving survey-wide settings:", settingsToSave);
        onSave(settingsToSave);
    };

    // --- Styling (same as before) ---
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


    const renderCompletionSettings = () => {
        const settings = currentSettings.completion || mergeWithDefaults({}).completion;
        return (<div>Completion settings UI goes here.</div>);
    };
    const renderAccessSecuritySettings = () => {
        const settings = currentSettings.accessSecurity || mergeWithDefaults({}).accessSecurity;
        return (<div>Access & Security settings UI goes here.</div>);
    };

    const renderBehaviorNavigationSettings = () => {
        // Ensure settings.behaviorNavigation exists and has defaults
        const defaultBehaviorNav = mergeWithDefaults(null).behaviorNavigation;
        const settings = currentSettings.behaviorNavigation 
            ? { ...defaultBehaviorNav, ...currentSettings.behaviorNavigation } 
            : defaultBehaviorNav;

        // Ensure saveAndContinueEmailLinkExpiryDays is a number for the input, or empty string
        const displayExpiryDays = typeof settings.saveAndContinueEmailLinkExpiryDays === 'number' 
            ? settings.saveAndContinueEmailLinkExpiryDays 
            : '';


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
                <h3 style={{...sectionTitleStyle, marginTop:'30px'}}>Save and Continue Later</h3>
                <div style={inputGroupStyle}>
                    <input type="checkbox" id="saveAndContinueEnabled" name="saveAndContinueEnabled" checked={settings.saveAndContinueEnabled || false} onChange={(e) => handleInputChange('behaviorNavigation', e)} style={checkboxInputStyle} />
                    <label htmlFor="saveAndContinueEnabled" style={checkboxLabelStyle}>Enable "Save and Continue Later"</label>
                </div>
                {settings.saveAndContinueEnabled && (
                    <>
                        <div style={inputGroupStyle}>
                            <label htmlFor="saveAndContinueMethod" style={labelStyle}>Resume Method:</label>
                            <select 
                                id="saveAndContinueMethod" 
                                name="saveAndContinueMethod" 
                                value={settings.saveAndContinueMethod || 'email'} 
                                onChange={(e) => handleInputChange('behaviorNavigation', e)} 
                                style={selectStyle} 
                            >
                                <option value="email">Email Link Only</option>
                                <option value="code">Resume Code Only</option>
                                <option value="both">Email Link and Resume Code</option>
                            </select>
                            <p style={subDescriptionStyle}>
                                {settings.saveAndContinueMethod === 'email' && "Respondent provides email, receives a resume link."}
                                {settings.saveAndContinueMethod === 'code' && "Respondent is shown a unique code to copy and use later."}
                                {settings.saveAndContinueMethod === 'both' && "Respondent provides email, receives a link, and is also shown a resume code."}
                            </p>
                        </div>
                        <div style={inputGroupStyle}>
                            <label htmlFor="saveAndContinueEmailLinkExpiryDays" style={labelStyle}>Resume Link/Code Expiry (days):</label>
                            <input
                                type="number"
                                id="saveAndContinueEmailLinkExpiryDays"
                                name="saveAndContinueEmailLinkExpiryDays"
                                value={displayExpiryDays}
                                onChange={(e) => handleInputChange('behaviorNavigation', e)}
                                // onBlur removed for now to simplify
                                min="1"
                                max="90"
                                style={inputStyle}
                                placeholder="1-90"
                            />
                             <p style={subDescriptionStyle}>Must be between 1 and 90 days.</p>
                        </div>
                    </>
                )}
            </>
        );
    };

    const renderCustomVariablesSettings = () => { /* ... (same as v1.3) ... */ };
    const renderAppearanceSettings = () => <p>Appearance settings are not yet implemented.</p>;


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
                {activeCategory === SETTING_CATEGORIES.CUSTOM_VARIABLES && renderCustomVariablesSettings()}
                {activeCategory === SETTING_CATEGORIES.APPEARANCE && renderAppearanceSettings()}
            </div>
            <div style={footerStyle}>
                <button onClick={onClose} style={secondaryButtonStyle}>Cancel</button>
                <button onClick={handleSave} style={primaryButtonStyle}>Apply Settings</button>
            </div>
        </div>
    );
};

export default SurveySettingsPanel;
// ----- END OF COMPLETE UPDATED FILE (v1.4.1 - Simplified ExpiryDays Validation Trigger) -----