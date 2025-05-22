// frontend/src/pages/PublicSurveyHandler.js
// ----- START OF COMPLETE MODIFIED FILE (vNext4.1 - Fixed undefined variable) -----
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import surveyApiFunctions from '../api/surveyApi';
import './PublicSurveyHandler.css';

const PublicSurveyHandler = () => {
    const { accessIdentifier } = useParams();
    const navigate = useNavigate();

    const [isLoading, setIsLoading] = useState(false); 
    const [error, setError] = useState(null); 
    
    const [surveyTitle, setSurveyTitle] = useState('');
    const [viewMode, setViewMode] = useState('initial_check'); // 'initial_check', 'choice', 'password_prompt', 'resume_prompt', 'loading_action', 'error_page'

    const [password, setPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');

    const [resumeCode, setResumeCode] = useState('');
    const [resumeError, setResumeError] = useState('');
    
    // This state is to track if the initial check determined a password is required
    // This helps the 'choice' view to be slightly more intelligent if possible
    const [initialCheckRequiresPassword, setInitialCheckRequiresPassword] = useState(false);


    useEffect(() => {
        if (!accessIdentifier) {
            setError('No access identifier provided in the link.');
            setViewMode('error_page');
            toast.error('Invalid survey link: Missing identifier.');
            return;
        }
        
        setViewMode('initial_check'); // Show loading for the initial check
        const performInitialCheck = async () => {
            try {
                console.log(`[PublicSurveyHandler] Performing initial check for: ${accessIdentifier}`);
                // This POST request with null password helps determine if password is required
                // without fully committing to an access attempt that navigates.
                const response = await surveyApiFunctions.accessPublicSurvey(accessIdentifier, null);
                
                // This case means survey is accessible without password (or password was optional and not needed)
                // We just get the title and wait for user to click "Start Survey"
                if (response && response.success && response.data) {
                    setSurveyTitle(response.data.surveyTitle || '');
                    setInitialCheckRequiresPassword(false);
                } else if (response && response.requiresPassword) {
                    // API indicates password is required
                    setSurveyTitle(response.data?.surveyTitle || '');
                    setInitialCheckRequiresPassword(true);
                } else {
                    // Non-specific error from initial check
                    setError(response?.message || "Could not retrieve initial survey information.");
                }
            } catch (err) {
                const errData = err.response?.data || err;
                if (errData?.requiresPassword) {
                    setSurveyTitle(errData?.surveyTitle || '');
                    setInitialCheckRequiresPassword(true);
                } else {
                    setError(errData?.message || "Error during initial survey check.");
                    console.error("[PublicSurveyHandler InitialCheck Catch]", err);
                }
            } finally {
                setViewMode('choice'); // Always go to choice view after initial check
            }
        };
        performInitialCheck();

    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [accessIdentifier]);


    const handleAttemptSurveyStart = async (currentPassword = null) => {
        setViewMode('loading_action'); 
        setError(null);
        setPasswordError('');

        try {
            console.log(`[PublicSurveyHandler] Attempting survey start for: ${accessIdentifier}` + (currentPassword ? " with password." : "."));
            const response = await surveyApiFunctions.accessPublicSurvey(accessIdentifier, currentPassword);

            if (response && response.success && response.data && response.data.surveyId && response.data.collectorId) {
                const { surveyId, collectorId, surveyTitle: titleFromNav, collectorSettings } = response.data;
                 if (typeof surveyId !== 'string' || surveyId.length < 5) { console.error(`[PublicSurveyHandler] Invalid surveyId ('${surveyId}') received.`); throw new Error(`Invalid survey data.`); } if (typeof collectorId !== 'string' || collectorId.length < 5) { console.error(`[PublicSurveyHandler] Invalid collectorId ('${collectorId}') received.`); throw new Error(`Invalid collector data.`); }

                console.log('[PublicSurveyHandler] Survey access granted. Navigating. Collector Settings:', collectorSettings);
                navigate(`/surveys/${surveyId}/c/${collectorId}`, {
                    replace: true,
                    state: { surveyTitle: titleFromNav || surveyTitle, collectorSettings: collectorSettings || {} }
                });
                // Successful navigation, no need to change viewMode here
            } else {
                const message = response?.message || 'Failed to start survey.';
                if (response?.requiresPassword) {
                    setSurveyTitle(response.data?.surveyTitle || surveyTitle);
                    setPasswordError(currentPassword ? message : ''); // Show error only if password was submitted
                    setViewMode('password_prompt'); 
                } else {
                    setError(message);
                    setViewMode('choice'); 
                }
            }
        } catch (err) {
            const errData = err.response?.data || err;
            const errorMessage = errData?.message || err.message || 'An unexpected error occurred.';
            console.error(`[PublicSurveyHandler] CATCH BLOCK (attemptSurveyStart) for ${accessIdentifier}:`, err.response || err);
            
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
        if (!resumeCode.trim()) {
            setResumeError('Resume code cannot be empty.');
            return;
        }
        setViewMode('loading_action'); 
        setResumeError('');
        setError(null);

        try {
            console.log(`[PublicSurveyHandler] Attempting to resume survey ${accessIdentifier} with code: ${resumeCode}`);
            const response = await surveyApiFunctions.resumeSurveyWithCode(accessIdentifier, resumeCode.trim());

            if (response && response.success && response.data) {
                const { surveyId, collectorId, surveyTitle: titleFromNav, collectorSettings, partialResponse } = response.data;
                if (!surveyId || !collectorId || !partialResponse) { console.error('[PublicSurveyHandler Resume] API response missing essential data:', response.data); throw new Error('Could not resume. Data missing.'); }
                
                console.log('[PublicSurveyHandler Resume] Resume successful. Navigating. Collector Settings:', collectorSettings);
                navigate(`/surveys/${surveyId}/c/${collectorId}/${partialResponse.resumeToken}`, {
                    replace: true,
                    state: {
                        surveyTitle: titleFromNav || surveyTitle,
                        collectorSettings: collectorSettings || {},
                        partialResponse: partialResponse,
                        isResumingWithCode: true
                    }
                });
                 // Successful navigation
            } else {
                const message = response?.message || 'Failed to resume survey with code.';
                setResumeError(message);
                setViewMode('resume_prompt'); 
            }
        } catch (err) {
            const errData = err.response?.data || err;
            const errorMessage = errData?.message || err.message || 'Error resuming survey.';
            console.error(`[PublicSurveyHandler Resume] CATCH BLOCK:`, err.response || err);
            setResumeError(errorMessage);
            setViewMode('resume_prompt'); 
        }
    };

    const handlePasswordSubmitForm = (e) => {
        e.preventDefault();
        if (!password.trim()) {
            setPasswordError('Password cannot be empty.');
            return;
        }
        handleAttemptSurveyStart(password.trim());
    };


    // --- Render Logic ---
    if (viewMode === 'initial_check') { 
        return (
            <div className="public-survey-handler-container">
                <div className="spinner"></div>
                <p>Loading survey information...</p>
            </div>
        );
    }
    if (viewMode === 'loading_action') { 
         return (
            <div className="public-survey-handler-container">
                <div className="spinner"></div>
                <p>Please wait...</p>
            </div>
        );
    }

    if (viewMode === 'choice') {
        return (
            <div className="public-survey-handler-container choice-container">
                <h2>{surveyTitle || 'Survey Access'}</h2>
                {error && <p className="error-message general-error" style={{textAlign: 'center', marginBottom: '15px'}}>{error}</p>}
                <p style={{marginBottom: '20px'}}>How would you like to proceed?</p>
                <div className="choice-actions">
                    <button 
                        onClick={() => {
                            if (initialCheckRequiresPassword) { // Use the state set by initialCheck
                                setViewMode('password_prompt');
                            } else {
                                handleAttemptSurveyStart(); // Attempt direct start
                            }
                        }} 
                        className="button-primary"
                    >
                        {initialCheckRequiresPassword ? "Enter Password to Start" : "Start Survey"}
                    </button>
                    <button onClick={() => setViewMode('resume_prompt')} className="button-secondary">
                        Resume with Code
                    </button>
                </div>
            </div>
        );
    }
    
    if (viewMode === 'password_prompt') {
        return (
            <div className="public-survey-handler-container password-prompt-container">
                <h2>Password Required</h2>
                {surveyTitle && <p className="survey-title-prompt">Survey: {surveyTitle}</p>}
                <p>This survey is password protected. Please enter the password to continue.</p>
                <form onSubmit={handlePasswordSubmitForm} className="password-form">
                     <div className="form-group"> <label htmlFor="surveyPassword">Password:</label> <input type="password" id="surveyPassword" value={password} onChange={(e) => { setPassword(e.target.value); if (passwordError) setPasswordError(''); }} className={passwordError ? 'input-error' : ''} aria-describedby="passwordErrorText" autoFocus /> {passwordError && <p id="passwordErrorText" className="error-message">{passwordError}</p>} </div> <button type="submit" disabled={isLoading /* Re-enable isLoading for form submission if needed, or use a new state like isSubmittingPassword */} className="button-primary"> Submit Password </button>
                </form>
                <button onClick={() => setViewMode('resume_prompt')} className="button-link" style={{marginTop: '15px'}}>
                    Or, resume with a code?
                </button>
                 <button onClick={() => { setError(null); setViewMode('choice');}} className="button-link" style={{marginTop: '5px'}}>
                    Back to options
                </button>
            </div>
        );
    }

    if (viewMode === 'resume_prompt') {
        return (
            <div className="public-survey-handler-container resume-code-container">
                <h2>Resume Survey</h2>
                {surveyTitle && <p className="survey-title-prompt">Survey: {surveyTitle || 'your survey'}</p>}
                <p>Enter your resume code to continue where you left off.</p>
                <form onSubmit={handleResumeWithCode} className="resume-form">
                    <div className="form-group"> <label htmlFor="resumeCodeInput">Resume Code:</label> <input type="text" id="resumeCodeInput" value={resumeCode} onChange={(e) => { setResumeCode(e.target.value); if (resumeError) setResumeError(''); }} className={resumeError ? 'input-error' : ''} aria-describedby="resumeErrorText" autoFocus /> {resumeError && <p id="resumeErrorText" className="error-message">{resumeError}</p>} </div> <button type="submit" disabled={isLoading /* Re-enable isLoading for form submission or use new state isSubmittingResume */} className="button-primary"> Resume Survey </button>
                </form>
                <button onClick={() => { setError(null); setResumeError(''); setViewMode('choice');}} className="button-link" style={{marginTop: '15px'}}>
                    Back to options
                </button>
            </div>
        );
    }

    if (viewMode === 'error_page') { 
         return (
            <div className="public-survey-handler-container error-container">
                <h2>Access Error</h2>
                <p>{error || 'An critical error occurred.'}</p>
                <button onClick={() => navigate('/')} className="button-primary">Go to Homepage</button>
            </div>
        );
    }
    
    return ( // Default fallback, should ideally not be hit often with clear view modes
         <div className="public-survey-handler-container">
            <div className="spinner"></div>
            <p>Processing...</p>
        </div>
    );
};

export default PublicSurveyHandler;
// ----- END OF COMPLETE MODIFIED FILE (vNext4.1 - Fixed undefined variable) -----