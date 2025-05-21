// frontend/src/pages/PublicSurveyHandler.js
// ----- START OF COMPLETE MODIFIED FILE (vNext2 - Added Resume With Code UI & Logic) -----
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import surveyApiFunctions from '../api/surveyApi';
import './PublicSurveyHandler.css'; // Ensure you have some basic styling

const PublicSurveyHandler = () => {
    const { accessIdentifier } = useParams();
    const navigate = useNavigate();

    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [requiresPassword, setRequiresPassword] = useState(false);
    const [password, setPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [surveyTitle, setSurveyTitle] = useState('');

    // +++ NEW State for Resume Functionality +++
    const [resumeMode, setResumeMode] = useState(false); // To show resume input
    const [resumeCode, setResumeCode] = useState('');
    const [resumeError, setResumeError] = useState('');
    const [isResuming, setIsResuming] = useState(false); // Separate loading state for resume

    const handleAccessAttempt = async (currentPassword = null) => {
        setIsLoading(true);
        setError(null);
        if (currentPassword) setPasswordError('');

        try {
            console.log(`[PublicSurveyHandler] Attempting access for: ${accessIdentifier}` + (currentPassword ? " with password." : " without password."));
            const response = await surveyApiFunctions.accessPublicSurvey(accessIdentifier, currentPassword);

            if (response && response.success && response.data && response.data.surveyId && response.data.collectorId) {
                const { surveyId, collectorId, surveyTitle: title, collectorSettings } = response.data;

                if (typeof surveyId !== 'string' || surveyId.length < 5) {
                    console.error(`[PublicSurveyHandler] Invalid surveyId ('${surveyId}') received from API.`);
                    throw new Error(`Invalid survey data received from API.`);
                }
                if (typeof collectorId !== 'string' || collectorId.length < 5) {
                    console.error(`[PublicSurveyHandler] Invalid collectorId ('${collectorId}') received from API.`);
                    throw new Error(`Invalid collector data received from API.`);
                }
                
                console.log('[PublicSurveyHandler] Access granted. Collector Settings to be passed:', collectorSettings);

                navigate(`/surveys/${surveyId}/c/${collectorId}`, {
                    replace: true,
                    state: {
                        surveyTitle: title,
                        collectorSettings: collectorSettings || {},
                        // No partialResponse here, this is for fresh start or password access
                    }
                });
            } else {
                const message = response?.message || 'API response lacked success flag or necessary data.';
                console.error('[PublicSurveyHandler] API response issue or missing data:', response);
                setError(message);
                if (response?.requiresPassword) {
                    setRequiresPassword(true);
                    setSurveyTitle(response?.data?.surveyTitle || '');
                }
                setIsLoading(false);
            }
        } catch (err) {
            const errData = err.response?.data || err; // Use err if err.response.data is not available
            const errorMessage = errData?.message || err.message || 'An unexpected error occurred.';
            console.error(`[PublicSurveyHandler] CATCH BLOCK: Error processing survey access for ${accessIdentifier}:`, err.response || err);

            if (errData?.requiresPassword) {
                setRequiresPassword(true);
                setSurveyTitle(errData?.surveyTitle || surveyTitle || 'this survey');
                if (currentPassword) {
                    setPasswordError(errorMessage);
                } else {
                    setError(null); // Clear general error if it's just a password prompt
                }
            } else {
                setError(errorMessage);
            }
            setIsLoading(false);
        }
    };

    // +++ NEW Handler for Resume with Code +++
    const handleResumeWithCode = async (e) => {
        if (e) e.preventDefault();
        if (!resumeCode.trim()) {
            setResumeError('Resume code cannot be empty.');
            return;
        }
        setIsResuming(true);
        setError(null); // Clear general errors
        setResumeError('');

        try {
            console.log(`[PublicSurveyHandler] Attempting to resume survey ${accessIdentifier} with code: ${resumeCode}`);
            // The response should include surveyId, collectorId, surveyTitle, collectorSettings, and partialResponse
            const response = await surveyApiFunctions.resumeSurveyWithCode(accessIdentifier, resumeCode.trim());

            if (response && response.success && response.data) {
                const { surveyId, collectorId, surveyTitle: title, collectorSettings, partialResponse } = response.data;

                if (!surveyId || !collectorId || !partialResponse) {
                     console.error('[PublicSurveyHandler Resume] API response missing essential data for resume:', response.data);
                     throw new Error('Could not resume survey. Necessary data missing from server response.');
                }
                 console.log('[PublicSurveyHandler Resume] Resume successful. Collector Settings:', collectorSettings);
                 console.log('[PublicSurveyHandler Resume] Resume successful. Partial Response:', partialResponse);


                navigate(`/surveys/${surveyId}/c/${collectorId}/${partialResponse.resumeToken}`, { // Include resumeToken in URL path
                    replace: true,
                    state: {
                        surveyTitle: title,
                        collectorSettings: collectorSettings || {},
                        partialResponse: partialResponse, // Pass the partial response data
                        isResumingWithCode: true // Flag for SurveyTakingPage
                    }
                });
            } else {
                const message = response?.message || 'Failed to resume survey with code.';
                console.error('[PublicSurveyHandler Resume] API error or missing data:', response);
                setResumeError(message); // Show error specific to resume attempt
                setIsResuming(false);
            }
        } catch (err) {
            const errData = err.response?.data || err;
            const errorMessage = errData?.message || err.message || 'An unexpected error occurred while resuming.';
            console.error(`[PublicSurveyHandler Resume] CATCH BLOCK: Error resuming survey:`, err.response || err);
            setResumeError(errorMessage);
            setIsResuming(false);
        }
    };


    useEffect(() => {
        if (!accessIdentifier) {
            setError('No access identifier provided in the link.');
            setIsLoading(false);
            toast.error('Invalid survey link: Missing identifier.');
            return;
        }
        // Only attempt direct access if not in resume mode initially
        if (!resumeMode) {
            handleAccessAttempt();
        } else {
            setIsLoading(false); // If starting in resumeMode, don't show main loading
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [accessIdentifier]); // Removed resumeMode from deps to avoid re-triggering direct access on mode switch

    const handlePasswordSubmit = (e) => {
        e.preventDefault();
        if (!password.trim()) {
            setPasswordError('Password cannot be empty.');
            return;
        }
        handleAccessAttempt(password.trim());
    };

    // Initial loading state before deciding to show password or resume form
    if (isLoading && !requiresPassword && !resumeMode && !error) {
        return (
            <div className="public-survey-handler-container">
                <div className="spinner"></div>
                <p>Loading survey, please wait...</p>
            </div>
        );
    }

    // General error display (if not password or resume error)
    if (error && !requiresPassword && !resumeMode) {
        return (
            <div className="public-survey-handler-container error-container">
                <h2>Survey Access Error</h2>
                <p>{error}</p>
                <button onClick={() => navigate('/')} className="button-primary">
                    Go to Homepage
                </button>
                 <button onClick={() => setResumeMode(true)} className="button-secondary" style={{marginTop: '10px'}}>
                    Or Resume with a Code?
                </button>
            </div>
        );
    }

    // Password Prompt UI
    if (requiresPassword) {
        return (
            <div className="public-survey-handler-container password-prompt-container">
                <h2>Password Required</h2>
                {surveyTitle && <p className="survey-title-prompt">Survey: {surveyTitle}</p>}
                <p>This survey is password protected. Please enter the password to continue.</p>
                <form onSubmit={handlePasswordSubmit} className="password-form">
                    <div className="form-group">
                        <label htmlFor="surveyPassword">Password:</label>
                        <input
                            type="password"
                            id="surveyPassword"
                            value={password}
                            onChange={(e) => { setPassword(e.target.value); if (passwordError) setPasswordError(''); }}
                            className={passwordError ? 'input-error' : ''}
                            aria-describedby="passwordErrorText"
                            autoFocus
                        />
                        {passwordError && <p id="passwordErrorText" className="error-message">{passwordError}</p>}
                    </div>
                    <button type="submit" disabled={isLoading} className="button-primary">
                        {isLoading ? 'Verifying...' : 'Submit Password'}
                    </button>
                    {error && !passwordError && <p className="error-message general-error">{error}</p>}
                </form>
                 <button onClick={() => { setResumeMode(true); setRequiresPassword(false); setError(null); setPasswordError(''); }} className="button-link" style={{marginTop: '15px'}}>
                    Have a resume code instead?
                </button>
            </div>
        );
    }

    // +++ NEW: Resume with Code UI +++
    if (resumeMode) {
        return (
            <div className="public-survey-handler-container resume-code-container">
                <h2>Resume Survey</h2>
                {surveyTitle && !error && <p className="survey-title-prompt">Survey: {surveyTitle || 'your survey'}</p>}
                <p>Enter your resume code to continue where you left off.</p>
                <form onSubmit={handleResumeWithCode} className="resume-form">
                    <div className="form-group">
                        <label htmlFor="resumeCodeInput">Resume Code:</label>
                        <input
                            type="text"
                            id="resumeCodeInput"
                            value={resumeCode}
                            onChange={(e) => { setResumeCode(e.target.value); if (resumeError) setResumeError(''); }}
                            className={resumeError ? 'input-error' : ''}
                            aria-describedby="resumeErrorText"
                            autoFocus
                        />
                        {resumeError && <p id="resumeErrorText" className="error-message">{resumeError}</p>}
                    </div>
                    <button type="submit" disabled={isResuming} className="button-primary">
                        {isResuming ? 'Resuming...' : 'Resume Survey'}
                    </button>
                     {error && <p className="error-message general-error">{error}</p>}
                </form>
                <button onClick={() => { setResumeMode(false); setError(null); setResumeError(''); handleAccessAttempt(); /* Re-attempt direct/password access */ }} className="button-link" style={{marginTop: '15px'}}>
                    Start survey or enter password instead?
                </button>
            </div>
        );
    }

    // Fallback / Initial state if no other condition met (should be transient)
    // Or if direct access attempt is pending and not yet requiring password or showing error
    if (!error && !requiresPassword && !resumeMode) {
         return (
            <div className="public-survey-handler-container">
                <div className="spinner"></div>
                <p>Loading survey, please wait...</p>
                 <button onClick={() => setResumeMode(true)} className="button-secondary" style={{marginTop: '20px'}}>
                    Resume with a Code?
                </button>
            </div>
        );
    }
    
    // Default return if something unexpected happens, or to show a link to resume if initial load fails generically
    return (
        <div className="public-survey-handler-container">
            <p>Processing your request...</p>
            <button onClick={() => setResumeMode(true)} className="button-secondary" style={{marginTop: '10px'}}>
                Resume with a Code?
            </button>
        </div>
    );
};

export default PublicSurveyHandler;
// ----- END OF COMPLETE MODIFIED FILE (vNext2 - Added Resume With Code UI & Logic) -----