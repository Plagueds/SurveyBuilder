// frontend/src/components/SurveySettingsPanel.js
// ----- START OF COMPLETE UPDATED FILE (v1.4 - Fixed ExpiryDays Input and Validation Sync) -----
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
                saveAndContinueEmailLinkExpiryDays: 7, // Default to 7 (min 1)
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
                    const validMethods = ['email', 'code', 'both'];
                    if (!validMethods.includes(merged[categoryKey].saveAndContinueMethod)) {
                        merged[categoryKey].saveAndContinueMethod = defaults.behaviorNavigation.saveAndContinueMethod;
                    }
                    // Ensure expiry days is within bounds after merge
                    let days = merged[categoryKey].saveAndContinueEmailLinkExpiryDays;
                    if (typeof days !== 'number' || isNaN(days) || days < 1) {
                        days = defaults.behaviorNavigation.saveAndContinueEmailLinkExpiryDays;
                    } else if (days > 90) {
                        days = 90;
                    }
                    merged[categoryKey].saveAndContinueEmailLinkExpiryDays = days;
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
        let valToSet;

        if (type === 'checkbox') {
            valToSet = checked;
        } else if (type === 'number') {
            // For number inputs, especially expiry days, handle empty string carefully
            if (name === 'saveAndContinueEmailLinkExpiryDays') {
                if (value === '') {
                    valToSet = ''; // Allow temporary empty state for user input
                } else {
                    const numVal = parseInt(value, 10);
                    // Keep it as NaN if not a number, validation will occur on save or blur
                    valToSet = isNaN(numVal) ? '' : numVal;
                }
            } else {
                 const numVal = parseInt(value, 10);
                 valToSet = isNaN(numVal) ? 0 : numVal; // Default other numbers to 0 if NaN
            }
        } else {
            valToSet = value;
        }
        handleNestedChange(category, name, valToSet);
    };
    
    // Validate and adjust expiry days on blur or before save
    const validateExpiryDays = () => {
        setCurrentSettings(prev => {
            const behaviorNav = prev.behaviorNavigation || {};
            let days = behaviorNav.saveAndContinueEmailLinkExpiryDays;
            let newDays = parseInt(days, 10);

            if (isNaN(newDays) || newDays < 1) {
                newDays = 1; // Correct to min if invalid or below min
            } else if (newDays > 90) {
                newDays = 90; // Correct to max if above max
            }
            
            if (newDays !== days) { // Only update if there's a change
                return {
                    ...prev,
                    behaviorNavigation: {
                        ...behaviorNav,
                        saveAndContinueEmailLinkExpiryDays: newDays
                    }
                };
            }
            return prev; // No change needed
        });
    };


    const handleCustomVariableChange = (index, field, value) => { /* ... (same as before) ... */ };
    const handleAddCustomVariable = () => { /* ... (same as before) ... */ };
    const handleRemoveCustomVariable = (index) => { /* ... (same as before) ... */ };

    const handleSave = () => {
        // Ensure expiry days is validated before saving
        validateExpiryDays(); // This will update currentSettings if needed

        // Use a timeout to allow state to update from validateExpiryDays before saving
        setTimeout(() => {
            const settingsToSave = {
                completion: currentSettings.completion,
                accessSecurity: currentSettings.accessSecurity,
                behaviorNavigation: { // Ensure all behaviorNavigation fields are included
                    ...mergeWithDefaults({}).behaviorNavigation, // Start with defaults
                    ...(currentSettings.behaviorNavigation || {}), // Overlay current
                },
                customVariables: currentSettings.customVariables || [],
                appearance: currentSettings.appearance,
            };

            // Final check for expiry days in the object to be saved
            if (settingsToSave.behaviorNavigation.saveAndContinueEmailLinkExpiryDays < 1 || 
                isNaN(settingsToSave.behaviorNavigation.saveAndContinueEmailLinkExpiryDays)) {
                settingsToSave.behaviorNavigation.saveAndContinueEmailLinkExpiryDays = 1; // Ensure it's at least 1
            } else if (settingsToSave.behaviorNavigation.saveAndContinueEmailLinkExpiryDays > 90) {
                settingsToSave.behaviorNavigation.saveAndContinueEmailLinkExpiryDays = 90;
            }


            console.log("Saving survey-wide settings:", settingsToSave);
            onSave(settingsToSave);
        }, 0);
    };

    // --- Styling (same as before) ---
    const panelStyle = { /* ... */ };
    const headerStyle = { /* ... */ };
    const navStyle = { /* ... */ };
    const navButtonStyle = (isActive) => ({ /* ... */ });
    const contentStyle = { /* ... */ };
    const sectionTitleStyle = { /* ... */ };
    const inputGroupStyle = { /* ... */ };
    const labelStyle = { /* ... */ };
    const inputStyle = { /* ... */ };
    const textareaStyle = { /* ... */ };
    const selectStyle = { /* ... */ };
    const checkboxLabelStyle = { /* ... */ };
    const checkboxInputStyle = { /* ... */ };
    const subDescriptionStyle = { /* ... */ };
    const footerStyle = { /* ... */ };
    const buttonStyle = { /* ... */ };
    const primaryButtonStyle = { /* ... */ };
    const secondaryButtonStyle = { /* ... */ };
    const dangerButtonStyle = { /* ... */ };


    const renderCompletionSettings = () => { /* ... (same as before) ... */ };
    const renderAccessSecuritySettings = () => { /* ... (same as before) ... */ };

    const renderBehaviorNavigationSettings = () => {
        const settings = currentSettings.behaviorNavigation || mergeWithDefaults({}).behaviorNavigation;
        return (
            <>
                <h3 style={sectionTitleStyle}>Survey Flow & Navigation</h3>
                {/* ... (autoAdvance, questionNumberingEnabled, questionNumberingFormat - same as before) ... */}
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
                                value={settings.saveAndContinueEmailLinkExpiryDays === '' ? '' : (settings.saveAndContinueEmailLinkExpiryDays || 1)} // Display '' if state is '', else default to 1 for display if falsy
                                onChange={(e) => handleInputChange('behaviorNavigation', e)}
                                onBlur={validateExpiryDays} // Validate on blur
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

    const renderCustomVariablesSettings = () => { /* ... (same as before) ... */ };

    return (
        <div style={panelStyle}>
            {/* ... (header, nav - same as before) ... */}
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
                {![
                    SETTING_CATEGORIES.COMPLETION,
                    SETTING_CATEGORIES.ACCESS_SECURITY,
                    SETTING_CATEGORIES.BEHAVIOR_NAVIGATION,
                    SETTING_CATEGORIES.CUSTOM_VARIABLES
                ].includes(activeCategory) && (
                    <p>Settings for "{activeCategory}" are not yet implemented.</p>
                )}
            </div>
            {/* ... (footer - same as before) ... */}
            <div style={footerStyle}>
                <button onClick={onClose} style={secondaryButtonStyle}>Cancel</button>
                <button onClick={handleSave} style={primaryButtonStyle}>Apply Settings</button>
            </div>
        </div>
    );
};

export default SurveySettingsPanel;
// ----- END OF COMPLETE UPDATED FILE (v1.4 - Fixed ExpiryDays Input and Validation Sync) -----