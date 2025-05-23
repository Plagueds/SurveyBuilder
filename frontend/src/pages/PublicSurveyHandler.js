// frontend/src/pages/PublicSurveyHandler.js
// ----- START OF COMPLETE MODIFIED FILE (vNext4.5 - Remove unused state) -----
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import surveyApiFunctions from '../api/surveyApi';
import './PublicSurveyHandler.css';

const PublicSurveyHandler = () => {
    const { accessIdentifier } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    // const [isLoading, setIsLoading] = useState(false); // Removed unused state
    const [error, setError] = useState(null); 
    
    const [surveyTitle, setSurveyTitle] = useState('');
    const [surveySettings, setSurveySettings] = useState(null); 
    const [viewMode, setViewMode] = useState('initial_check'); 

    const [password, setPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');

    const [resumeCode, setResumeCode] = useState('');
    const [resumeError, setResumeError] = useState('');
    
    const [initialCheckRequiresPassword, setInitialCheckRequiresPassword] = useState(false);

    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        const resumeTokenFromQuery = queryParams.get('resumeToken');

        if (resumeTokenFromQuery && accessIdentifier) {
            setViewMode('loading_action');
            const attemptDirectResumeNavigation = async () => {
                try {
                    const response = await surveyApiFunctions.accessPublicSurvey(accessIdentifier, null);
                    if (response && response.data && response.data.surveyId && response.data.collectorId) {
                        const { surveyId, collectorId: actualCollectorId, surveyTitle: titleFromNav, collectorSettings } = response.data;
                        navigate(`/surveys/${surveyId}/c/${actualCollectorId}/${resumeTokenFromQuery}`, { 
                            replace: true, 
                            state: { 
                                surveyTitle: titleFromNav || surveyTitle, 
                                collectorSettings: collectorSettings || {},
                            } 
                        });
                    } else {
                        setError(response?.message || "Failed to process resume link. Survey details missing.");
                        setViewMode('error_page');
                    }
                } catch (err) {
                    setError(err.response?.data?.message || err.message || "Error processing resume link.");
                    setViewMode('error_page');
                }
            };
            attemptDirectResumeNavigation();
            return; 
        }

        if (!accessIdentifier) { setError('No access identifier provided in the link.'); setViewMode('error_page'); toast.error('Invalid survey link: Missing identifier.'); return; }
        
        setViewMode('initial_check'); 
        const performInitialCheck = async () => { 
            try { 
                const response = await surveyApiFunctions.accessPublicSurvey(accessIdentifier, null); 
                if (response && response.data) { 
                    setSurveyTitle(response.data.surveyTitle || ''); 
                    if (response.data.surveySettings && response.data.surveySettings.behaviorNavigation) { 
                        setSurveySettings(response.data.surveySettings.behaviorNavigation); 
                    } else { 
                        setSurveySettings({ saveAndContinueEnabled: true, saveAndContinueMethod: 'both' }); 
                    } 
                    if (response.success) { 
                        setInitialCheckRequiresPassword(false); 
                    } else if (response.requiresPassword) { 
                        setInitialCheckRequiresPassword(true); 
                        if (response.data.surveySettings && response.data.surveySettings.behaviorNavigation && !surveySettings) { 
                            setSurveySettings(response.data.surveySettings.behaviorNavigation); 
                        } 
                    } else { 
                        setError(response.message || "Could not retrieve initial survey information."); 
                    } 
                } else { 
                    setError(response?.message || "Failed to get survey information during initial check."); 
                    setSurveySettings({ saveAndContinueEnabled: true, saveAndContinueMethod: 'both' }); 
                } 
            } catch (err) { 
                const errData = err.response?.data || err; 
                setSurveyTitle(errData?.surveyTitle || ''); 
                if (errData?.requiresPassword) { 
                    setInitialCheckRequiresPassword(true); 
                } else { 
                    setError(errData?.message || "Error during initial survey check."); 
                } 
                if (errData?.surveySettings?.behaviorNavigation) { 
                    setSurveySettings(errData.surveySettings.behaviorNavigation); 
                } else { 
                    setSurveySettings({ saveAndContinueEnabled: true, saveAndContinueMethod: 'both' }); 
                } 
            } finally { 
                setViewMode('choice'); 
            } 
        };
        performInitialCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [accessIdentifier, location.search, navigate]); // surveyTitle removed as it's set inside and could cause loop

    const handleAttemptSurveyStart = async (currentPassword = null) => { 
        setViewMode('loading_action'); 
        setError(null); 
        setPasswordError(''); 
        try { 
            const response = await surveyApiFunctions.accessPublicSurvey(accessIdentifier, currentPassword); 
            if (response && response.success && response.data && response.data.surveyId && response.data.collectorId) { 
                const { surveyId, collectorId, surveyTitle: titleFromNav, collectorSettings } = response.data; 
                if (typeof surveyId !== 'string' || surveyId.length < 5) { throw new Error(`Invalid survey data.`); } 
                if (typeof collectorId !== 'string' || collectorId.length < 5) { throw new Error(`Invalid collector data.`); } 
                navigate(`/surveys/${surveyId}/c/${collectorId}`, { replace: true, state: { surveyTitle: titleFromNav || surveyTitle, collectorSettings: collectorSettings || {} } }); 
            } else { 
                const message = response?.message || 'Failed to start survey.'; 
                if (response?.requiresPassword) { 
                    setSurveyTitle(response.data?.surveyTitle || surveyTitle); 
                    setPasswordError(currentPassword ? message : ''); 
                    setViewMode('password_prompt'); 
                } else { 
                    setError(message); 
                    setViewMode('choice'); 
                } 
            } 
        } catch (err) { 
            const errData = err.response?.data || err; 
            const errorMessage = errData?.message || err.message || 'An unexpected error occurred.'; 
            if (errData?.requiresPassword) { 
                setSurveyTitle(errData?.surveyTitle || surveyTitle); 
                setPasswordError(currentPassword ? errorMessage : ''); 
                setViewMode('password_prompt'); 
            } else { 
                setError(errorMessage); 
                setViewMode('choice'); 
            } 
        } 
    };
    const handleResumeWithCode = async (e) => { 
        if (e) e.preventDefault(); 
        if (!resumeCode.trim()) { setResumeError('Resume code cannot be empty.'); return; } 
        setViewMode('loading_action'); 
        setResumeError(''); 
        setError(null); 
        try { 
            const response = await surveyApiFunctions.resumeSurveyWithCode(accessIdentifier, resumeCode.trim()); 
            if (response && response.success && response.data) { 
                const { surveyId, collectorId, surveyTitle: titleFromNav, collectorSettings, partialResponse } = response.data; 
                if (!surveyId || !collectorId || !partialResponse) { throw new Error('Could not resume. Data missing.'); } 
                navigate(`/surveys/${surveyId}/c/${collectorId}/${partialResponse.resumeToken}`, { replace: true, state: { surveyTitle: titleFromNav || surveyTitle, collectorSettings: collectorSettings || {}, partialResponse: partialResponse, isResumingWithCode: true } }); 
            } else { 
                const message = response?.message || 'Failed to resume survey with code.'; 
                setResumeError(message); 
                setViewMode('resume_prompt'); 
            } 
        } catch (err) { 
            const errData = err.response?.data || err; 
            const errorMessage = errData?.message || err.message || 'Error resuming survey.'; 
            setResumeError(errorMessage); 
            setViewMode('resume_prompt'); 
        } 
    };
    const handlePasswordSubmitForm = (e) => { 
        e.preventDefault(); 
        if (!password.trim()) { setPasswordError('Password cannot be empty.'); return; } 
        handleAttemptSurveyStart(password.trim()); 
    };

    if (viewMode === 'initial_check' || (viewMode !== 'error_page' && !surveySettings && !location.search.includes('resumeToken'))) { 
        return ( <div className="public-survey-handler-container"> <div className="spinner"></div> <p>Loading survey information...</p> </div> ); 
    }
    if (viewMode === 'loading_action') { return ( <div className="public-survey-handler-container"> <div className="spinner"></div> <p>Please wait...</p> </div> ); }

    const saveAndContinueEnabledBySurvey = surveySettings?.saveAndContinueEnabled ?? false;
    const saveMethod = surveySettings?.saveAndContinueMethod || 'both'; 
    const showStartOption = true; 
    const showResumeCodeOption = saveAndContinueEnabledBySurvey && (saveMethod === 'code' || saveMethod === 'both');

    if (viewMode === 'choice') { return ( <div className="public-survey-handler-container choice-container"> <h2>{surveyTitle || 'Survey Access'}</h2> {error && <p className="error-message general-error" style={{textAlign: 'center', marginBottom: '15px'}}>{error}</p>} <p style={{marginBottom: '20px'}}>How would you like to proceed?</p> <div className="choice-actions"> {showStartOption && ( <button onClick={() => { if (initialCheckRequiresPassword) setViewMode('password_prompt'); else handleAttemptSurveyStart(); }} className="button-primary" > {initialCheckRequiresPassword ? "Enter Password to Start" : "Start New Survey"} </button> )} {showResumeCodeOption && ( <button onClick={() => setViewMode('resume_prompt')} className="button-secondary"> Resume with Code </button> )} </div> {saveAndContinueEnabledBySurvey && (saveMethod === 'email' || saveMethod === 'both') && ( <p style={{marginTop: '15px', textAlign: 'center'}}> If you have a previous session, you can also resume using the link sent to your email. </p> )} {(!initialCheckRequiresPassword && error && showStartOption) && ( <button onClick={() => setViewMode('password_prompt')} className="button-link" style={{marginTop: '15px'}}> Try entering a password? </button> )} </div> ); }
    if (viewMode === 'password_prompt') { return ( <div className="public-survey-handler-container password-prompt-container"> <h2>Password Required</h2> {surveyTitle && <p className="survey-title-prompt">Survey: {surveyTitle}</p>} <p>This survey is password protected. Please enter the password to continue.</p> <form onSubmit={handlePasswordSubmitForm} className="password-form"> <div className="form-group"> <label htmlFor="surveyPassword">Password:</label> <input type="password" id="surveyPassword" value={password} onChange={(e) => { setPassword(e.target.value); if (passwordError) setPasswordError(''); }} className={passwordError ? 'input-error' : ''} autoFocus /> {passwordError && <p className="error-message">{passwordError}</p>} </div> <button type="submit" className="button-primary"> Submit Password </button> </form> {showResumeCodeOption && ( <button onClick={() => setViewMode('resume_prompt')} className="button-link" style={{marginTop: '15px'}}> Or, resume with a code? </button> )} <button onClick={() => { setError(null); setViewMode('choice');}} className="button-link" style={{marginTop: '5px'}}> Back to options </button> </div> ); }
    if (viewMode === 'resume_prompt') { return ( <div className="public-survey-handler-container resume-code-container"> <h2>Resume Survey</h2> {surveyTitle && <p className="survey-title-prompt">Survey: {surveyTitle || 'your survey'}</p>} <p>Enter your resume code to continue where you left off.</p> <form onSubmit={handleResumeWithCode} className="resume-form"> <div className="form-group"> <label htmlFor="resumeCodeInput">Resume Code:</label> <input type="text" id="resumeCodeInput" value={resumeCode} onChange={(e) => { setResumeCode(e.target.value); if (resumeError) setResumeError(''); }} className={resumeError ? 'input-error' : ''} autoFocus /> {resumeError && <p className="error-message">{resumeError}</p>} </div> <button type="submit" className="button-primary"> Resume Survey </button> </form> <button onClick={() => { setError(null); setResumeError(''); setViewMode('choice');}} className="button-link" style={{marginTop: '15px'}}> Back to options </button> </div> ); }
    if (viewMode === 'error_page') { return ( <div className="public-survey-handler-container error-container"> <h2>Access Error</h2> <p>{error || 'An critical error occurred.'}</p> <button onClick={() => navigate('/')} className="button-primary">Go to Homepage</button> </div> ); }
    
    return ( <div className="public-survey-handler-container"> <div className="spinner"></div> <p>Processing...</p> </div> );
};

export default PublicSurveyHandler;
// ----- END OF COMPLETE MODIFIED FILE (vNext4.5 - Remove unused state) -----