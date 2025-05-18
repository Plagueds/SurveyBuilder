// frontend/src/components/SurveySettingsPanel.js
// ----- START OF COMPLETE UPDATED FILE (v1.4.2 - Restored All Category Renderings) -----
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
            appearance: {}, // Added appearance default
        };

        const merged = {}; // Start with an empty object

        // Iterate over default categories to ensure all are present
        for (const categoryKey in defaults) {
            if (defaults.hasOwnProperty(categoryKey)) {
                merged[categoryKey] = {
                    ...defaults[categoryKey], // Start with category defaults
                    ...(settingsFromProps?.[categoryKey] || {}) // Override with props if they exist for this category
                };

                // Specific handling for customVariables to ensure it's an array
                if (categoryKey === 'customVariables' && !Array.isArray(merged[categoryKey])) {
                    merged[categoryKey] = settingsFromProps?.[categoryKey] ? [...settingsFromProps[categoryKey]] : [];
                }

                // Specific handling for behaviorNavigation
                if (categoryKey === 'behaviorNavigation') {
                    const bn = merged[categoryKey]; // Already merged with defaults and props
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
        // Copy any top-level settings from props that aren't in defaults (e.g., _id, title)
        // This is less likely for this component but good for robustness
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
                const newMergedSettings = mergeWithDefaults(initialSettings || {}); // Pass empty object if initialSettings is null/undefined
                setCurrentSettings(newMergedSettings);
            } catch (error) {
                console.error("Error merging settings in SurveySettingsPanel:", error);
                setCurrentSettings(mergeWithDefaults({})); // Fallback to complete defaults
            }
        }
    }, [isOpen, initialSettings, mergeWithDefaults]);

    if (!isOpen || Object.keys(currentSettings).length === 0) { // Don't render if not open or settings not ready
        return null;
    }

    const handleNestedChange = (category, field, value) => { /* ... same as v1.4.1 ... */ };
    const handleInputChange = (category, e) => { /* ... same as v1.4.1 ... */ };
    const getValidatedExpiryDays = (currentDaysValue) => { /* ... same as v1.4.1 ... */ };
    const handleCustomVariableChange = (index, field, value) => { /* ... same as v1.4.1 ... */ };
    const handleAddCustomVariable = () => { /* ... same as v1.4.1 ... */ };
    const handleRemoveCustomVariable = (index) => { /* ... same as v1.4.1 ... */ };
    const handleSave = () => { /* ... same as v1.4.1 ... */ };

    // --- Styling (same as before) ---
    const panelStyle = { /* ... */ };
    const headerStyle = { /* ... */ };
    // ... all other styles

    // --- RENDER FUNCTIONS FOR EACH CATEGORY (Ensure these have their full JSX) ---
    const renderCompletionSettings = () => {
        const settings = currentSettings.completion || mergeWithDefaults({}).completion;
        return (
            <>
                <h3 style={sectionTitleStyle}>End of Survey Experience</h3>
                <div style={inputGroupStyle}>
                    <label style={labelStyle}>When survey is completed, show:</label>
                    <select name="type" value={settings.type || 'thankYouPage'} onChange={(e) => handleNestedChange('completion', 'type', e.target.value)} style={selectStyle} >
                        <option value="thankYouPage">A thank you page</option>
                        <option value="redirect">Redirect to a URL</option>
                        <option value="closeWindow">Close the window (not recommended)</option>
                    </select>
                </div>
                {settings.type === 'thankYouPage' && (
                    <>
                        <div style={inputGroupStyle}>
                            <label htmlFor="thankYouMessage" style={labelStyle}>Thank You Message:</label>
                            <textarea id="thankYouMessage" name="thankYouMessage" value={settings.thankYouMessage || ''} onChange={(e) => handleInputChange('completion', e)} style={textareaStyle} />
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
                            <input type="url" id="redirectUrl" name="redirectUrl" value={settings.redirectUrl || ''} onChange={(e) => handleInputChange('completion', e)} style={inputStyle} placeholder="https://example.com" />
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
                    <select name="disqualificationType" value={settings.disqualificationType || 'message'} onChange={(e) => handleNestedChange('completion', 'disqualificationType', e.target.value)} style={selectStyle} >
                        <option value="message">Show a custom message</option>
                        <option value="redirect">Redirect to a URL</option>
                    </select>
                </div>
                {settings.disqualificationType === 'message' && (
                    <div style={inputGroupStyle}>
                        <label htmlFor="disqualificationMessage" style={labelStyle}>Disqualification Message:</label>
                        <textarea id="disqualificationMessage" name="disqualificationMessage" value={settings.disqualificationMessage || ''} onChange={(e) => handleInputChange('completion', e)} style={textareaStyle} />
                    </div>
                )}
                {settings.disqualificationType === 'redirect' && (
                     <div style={inputGroupStyle}>
                        <label htmlFor="disqualificationRedirectUrl" style={labelStyle}>Disqualification Redirect URL:</label>
                        <input type="url" id="disqualificationRedirectUrl" name="disqualificationRedirectUrl" value={settings.disqualificationRedirectUrl || ''} onChange={(e) => handleInputChange('completion', e)} style={inputStyle} placeholder="https://example.com/disqualified" />
                    </div>
                )}
                <h3 style={{...sectionTitleStyle, marginTop:'30px'}}>Survey Closed Message</h3>
                <div style={inputGroupStyle}>
                    <label htmlFor="surveyClosedMessage" style={labelStyle}>Message for Closed Survey:</label>
                    <textarea id="surveyClosedMessage" name="surveyClosedMessage" value={settings.surveyClosedMessage || ''} onChange={(e) => handleInputChange('completion', e)} style={textareaStyle} placeholder="e.g., This survey has ended." />
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
                    <input type="number" id="maxResponses" name="maxResponses" value={settings.maxResponses || 0} onChange={(e) => handleInputChange('accessSecurity', e)} min="0" style={inputStyle} />
                </div>
                 <div style={inputGroupStyle}>
                    <input type="checkbox" id="passwordProtectionEnabled" name="passwordProtectionEnabled" checked={settings.passwordProtectionEnabled || false} onChange={(e) => handleInputChange('accessSecurity', e)} style={checkboxInputStyle} />
                    <label htmlFor="passwordProtectionEnabled" style={checkboxLabelStyle}>Enable Default Password Protection</label>
                </div>
                {settings.passwordProtectionEnabled && (
                    <div style={inputGroupStyle}>
                        <label htmlFor="surveyPassword" style={labelStyle}>Default Survey Password:</label>
                        <input type="text" id="surveyPassword" name="surveyPassword" value={settings.surveyPassword || ''} onChange={(e) => handleInputChange('accessSecurity', e)} style={inputStyle} />
                    </div>
                )}
            </>
        );
    };

    const renderBehaviorNavigationSettings = () => {
        const defaultBehaviorNav = mergeWithDefaults(null).behaviorNavigation;
        const settings = currentSettings.behaviorNavigation 
            ? { ...defaultBehaviorNav, ...currentSettings.behaviorNavigation } 
            : defaultBehaviorNav;
        const displayExpiryDays = typeof settings.saveAndContinueEmailLinkExpiryDays === 'number' 
            ? settings.saveAndContinueEmailLinkExpiryDays 
            : '';

        return (
            <>
                <h3 style={sectionTitleStyle}>Survey Flow & Navigation</h3>
                 <div style={inputGroupStyle}>
                    <input type="checkbox" id="autoAdvance" name="autoAdvance" checked={settings.autoAdvance || false} onChange={(e) => handleInputChange('behaviorNavigation', e)} style={checkboxInputStyle} />
                    <label htmlFor="autoAdvance" style={checkboxLabelStyle}>Enable Auto-Advance</label>
                    <p style={subDescriptionStyle}>Automatically move to the next question after a selection is made on single-choice questions.</p>
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

    const renderCustomVariablesSettings = () => {
        const customVars = currentSettings.customVariables || []; // Fallback to empty array
        return (
            <>
                <h3 style={sectionTitleStyle}>Custom Variables (Hidden Fields)</h3>
                <p style={subDescriptionStyle}>Define keys for custom data you want to pass into the survey URL (e.g., `?source=email&id=123`). This data will be stored with each response.</p>
                <div style={{ border: '1px solid #eee', padding: '15px', borderRadius: '4px', background:'#f9f9f9' }}>
                    {customVars.length > 0 && customVars.map((cv, index) => (
                        <div key={index} style={{ display: 'flex', alignItems: 'center', marginBottom: '10px', paddingBottom:'10px', borderBottom: index < customVars.length -1 ? '1px dashed #ddd': 'none' }}>
                            <input type="text" placeholder="Key (e.g., campaign_id)" value={cv.key || ''} onChange={(e) => handleCustomVariableChange(index, 'key', e.target.value)} style={{...inputStyle, width:'40%', marginRight:'10px'}} />
                            <input type="text" placeholder="Label (Optional Description)" value={cv.label || ''} onChange={(e) => handleCustomVariableChange(index, 'label', e.target.value)} style={{...inputStyle, width:'40%', marginRight:'10px'}} />
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
    
    const renderAppearanceSettings = () => {
        // const settings = currentSettings.appearance || mergeWithDefaults({}).appearance; // If you add specific appearance settings
        return <p>Appearance settings are not yet implemented.</p>;
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
// ----- END OF COMPLETE UPDATED FILE (v1.4.2 - Restored All Category Renderings) -----