// frontend/src/pages/PublicSurveyHandler.js
// ----- START OF COMPLETE MODIFIED FILE (vNext3 - More Prominent Resume Option) -----
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import surveyApiFunctions from '../api/surveyApi';
import './PublicSurveyHandler.css';

const PublicSurveyHandler = () => {
    const { accessIdentifier } = useParams();
    const navigate = useNavigate();

    const [isLoading, setIsLoading] = useState(true); // For the initial access attempt
    const [error, setError] = useState(null);
    const [requiresPassword, setRequiresPassword] = useState(false);
    const [password, setPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [surveyTitle, setSurveyTitle] = useState('');

    const [viewMode, setViewMode] = useState('initial_attempt'); // 'initial_attempt', 'password', 'resume_code'
    const [resumeCode, setResumeCode] = useState('');
    const [resumeError, setResumeError] = useState('');
    const [isResuming, setIsResuming] = useState(false);

    const handleDirectAccess = async (currentPassword = null) => {
        setIsLoading(true); // For direct/password attempt
        setError(null);
        if (currentPassword) setPasswordError('');

        try {
            console.log(`[PublicSurveyHandler] Attempting direct/password access for: ${accessIdentifier}`);
            const response = await surveyApiFunctions.accessPublicSurvey(accessIdentifier, currentPassword);

            if (response && response.success && response.data && response.data.surveyId && response.data.collectorId) {
                const { surveyId, collectorId, surveyTitle: title, collectorSettings } = response.data;
                // ... (ID validation same as before) ...
                 if (typeof surveyId !== 'string' || surveyId.length < 5) { console.error(`[PublicSurveyHandler] Invalid surveyId ('${surveyId}') received from API.`); throw new Error(`Invalid survey data received from API.`); } if (typeof collectorId !== 'string' || collectorId.length < 5) { console.error(`[PublicSurveyHandler] Invalid collectorId ('${collectorId}') received from API.`); throw new Error(`Invalid collector data received from API.`); }

                console.log('[PublicSurveyHandler] Direct access granted. Navigating. Collector Settings:', collectorSettings);
                navigate(`/surveys/${surveyId}/c/${collectorId}`, {
                    replace: true,
                    state: { surveyTitle: title, collectorSettings: collectorSettings || {} }
                });
            } else {
                const message = response?.message || 'API response lacked success flag or necessary data.';
                console.error('[PublicSurveyHandler] API response issue (direct access):', response);
                setError(message);
                if (response?.requiresPassword) {
                    setViewMode('password'); // Switch to password view
                    setSurveyTitle(response?.data?.surveyTitle || '');
                }
                setIsLoading(false);
            }
        } catch (err) {
            const errData = err.response?.data || err;
            const errorMessage = errData?.message || err.message || 'An unexpected error occurred.';
            console.error(`[PublicSurveyHandler] CATCH BLOCK (direct access) for ${accessIdentifier}:`, err.response || err);

            if (errData?.requiresPassword) {
                setViewMode('password'); // Switch to password view
                setSurveyTitle(errData?.surveyTitle || surveyTitle || 'this survey');
                if (currentPassword) setPasswordError(errorMessage);
                else setError(null);
            } else {
                setError(errorMessage); // General error, stay in initial_attempt or show error view
                setViewMode('initial_attempt'); // Or a dedicated error view if preferred
            }
            setIsLoading(false);
        }
    };

    const handleResumeWithCode = async (e) => {
        if (e) e.preventDefault();
        if (!resumeCode.trim()) {
            setResumeError('Resume code cannot be empty.');
            return;
        }
        setIsResuming(true);
        setResumeError('');
        setError(null); // Clear general errors when attempting resume

        try {
            console.log(`[PublicSurveyHandler] Attempting to resume survey ${accessIdentifier} with code: ${resumeCode}`);
            const response = await surveyApiFunctions.resumeSurveyWithCode(accessIdentifier, resumeCode.trim());

            if (response && response.success && response.data) {
                const { surveyId, collectorId, surveyTitle: title, collectorSettings, partialResponse } = response.data;
                if (!surveyId || !collectorId || !partialResponse) { /* ... error handling ... */ console.error('[PublicSurveyHandler Resume] API response missing essential data for resume:', response.data); throw new Error('Could not resume survey. Necessary data missing from server response.'); }
                
                console.log('[PublicSurveyHandler Resume] Resume successful. Navigating. Collector Settings:', collectorSettings);
                navigate(`/surveys/${surveyId}/c/${collectorId}/${partialResponse.resumeToken}`, {
                    replace: true,
                    state: {
                        surveyTitle: title,
                        collectorSettings: collectorSettings || {},
                        partialResponse: partialResponse,
                        isResumingWithCode: true
                    }
                });
            } else {
                const message = response?.message || 'Failed to resume survey with code.';
                console.error('[PublicSurveyHandler Resume] API error or missing data:', response);
                setResumeError(message);
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
            setViewMode('error_view'); // A dedicated view for this might be good
            return;
        }
        // On initial load, always try direct access first. User can then switch to resume.
        handleDirectAccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [accessIdentifier]);

    const handlePasswordSubmit = (e) => {
        e.preventDefault();
        if (!password.trim()) {
            setPasswordError('Password cannot be empty.');
            return;
        }
        handleDirectAccess(password.trim()); // Re-attempt with password
    };


    // --- Render Logic based on viewMode ---

    if (viewMode === 'initial_attempt' && isLoading) {
        return (
            <div className="public-survey-handler-container">
                <div className="spinner"></div>
                <p>Loading survey, please wait...</p>
                <button onClick={() => setViewMode('resume_code')} className="button-link" style={{marginTop: '20px'}}>
                    Resume with a Code?
                </button>
            </div>
        );
    }

    if (viewMode === 'initial_attempt' && error) {
        return (
            <div className="public-survey-handler-container error-container">
                <h2>Survey Access Error</h2>
                <p>{error}</p>
                <button onClick={() => navigate('/')} className="button-primary" style={{marginRight: '10px'}}>
                    Go to Homepage
                </button>
                <button onClick={() => setViewMode('resume_code')} className="button-secondary">
                    Try Resuming with Code
                </button>
            </div>
        );
    }
    
    if (viewMode === 'password') {
        return (
            <div className="public-survey-handler-container password-prompt-container">
                <h2>Password Required</h2>
                {surveyTitle && <p className="survey-title-prompt">Survey: {surveyTitle}</p>}
                <p>This survey is password protected. Please enter the password to continue.</p>
                <form onSubmit={handlePasswordSubmit} className="password-form">
                    {/* ... password input form same as before ... */}
                    <div className="form-group"> <label htmlFor="surveyPassword">Password:</label> <input type="password" id="surveyPassword" value={password} onChange={(e) => { setPassword(e.target.value); if (passwordError) setPasswordError(''); }} className={passwordError ? 'input-error' : ''} aria-describedby="passwordErrorText" autoFocus /> {passwordError && <p id="passwordErrorText" className="error-message">{passwordError}</p>} </div> <button type="submit" disabled={isLoading} className="button-primary"> {isLoading ? 'Verifying...' : 'Submit Password'} </button> {error && !passwordError && <p className="error-message general-error">{error}</p>}
                </form>
                <button onClick={() => setViewMode('resume_code')} className="button-link" style={{marginTop: '15px'}}>
                    Or, resume with a code?
                </button>
            </div>
        );
    }

    if (viewMode === 'resume_code') {
        return (
            <div className="public-survey-handler-container resume-code-container">
                <h2>Resume Survey</h2>
                {surveyTitle && <p className="survey-title-prompt">Survey: {surveyTitle || 'your survey'}</p>}
                <p>Enter your resume code to continue where you left off.</p>
                <form onSubmit={handleResumeWithCode} className="resume-form">
                    {/* ... resume code input form same as before ... */}
                    <div className="form-group"> <label htmlFor="resumeCodeInput">Resume Code:</label> <input type="text" id="resumeCodeInput" value={resumeCode} onChange={(e) => { setResumeCode(e.target.value); if (resumeError) setResumeError(''); }} className={resumeError ? 'input-error' : ''} aria-describedby="resumeErrorText" autoFocus /> {resumeError && <p id="resumeErrorText" className="error-message">{resumeError}</p>} </div> <button type="submit" disabled={isResuming} className="button-primary"> {isResuming ? 'Resuming...' : 'Resume Survey'} </button>
                </form>
                <button onClick={() => { setViewMode('initial_attempt'); setError(null); setResumeError(''); handleDirectAccess(); }} className="button-link" style={{marginTop: '15px'}}>
                    Start survey or enter password instead?
                </button>
            </div>
        );
    }
    
    // Fallback for unhandled viewMode or if initial_attempt is neither loading nor error (should be transient)
    return (
         <div className="public-survey-handler-container">
            <div className="spinner"></div>
            <p>Processing...</p>
             <button onClick={() => setViewMode('resume_code')} className="button-link" style={{marginTop: '20px'}}>
                Resume with a Code?
            </button>
        </div>
    );
};

export default PublicSurveyHandler;
// ----- END OF COMPLETE MODIFIED FILE (vNext3 - More Prominent Resume Option) -----