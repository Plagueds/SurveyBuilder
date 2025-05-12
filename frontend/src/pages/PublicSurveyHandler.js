// frontend/src/pages/PublicSurveyHandler.js
// ----- START OF COMPLETE MODIFIED FILE (vNext - Added console log for collectorSettings) -----
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import surveyApiFunctions from '../api/surveyApi';
import './PublicSurveyHandler.css';

const PublicSurveyHandler = () => {
    const { accessIdentifier } = useParams();
    const navigate = useNavigate();

    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [requiresPassword, setRequiresPassword] = useState(false);
    const [password, setPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [surveyTitle, setSurveyTitle] = useState('');

    const handleAccessAttempt = async (currentPassword = null) => {
        setIsLoading(true);
        setError(null);
        if (currentPassword) setPasswordError('');

        try {
            console.log(`[PublicSurveyHandler] Attempting access for: ${accessIdentifier}` + (currentPassword ? " with password." : " without password."));
            const response = await surveyApiFunctions.accessPublicSurvey(accessIdentifier, currentPassword);
            // console.log('[PublicSurveyHandler] Raw response from accessPublicSurvey:', response); // For deep debugging

            if (response && response.success && response.data && response.data.surveyId && response.data.collectorId) {
                const { surveyId, collectorId, surveyTitle: title, collectorSettings } = response.data;

                // Basic validation of received IDs
                if (typeof surveyId !== 'string' || surveyId.length < 5) { // Basic check
                    console.error(`[PublicSurveyHandler] Invalid surveyId ('${surveyId}') received from API.`);
                    throw new Error(`Invalid survey data received from API.`);
                }
                if (typeof collectorId !== 'string' || collectorId.length < 5) { // Basic check
                    console.error(`[PublicSurveyHandler] Invalid collectorId ('${collectorId}') received from API.`);
                    throw new Error(`Invalid collector data received from API.`);
                }
                
                // Log the collectorSettings that will be passed to SurveyTakingPage
                console.log('[PublicSurveyHandler] Access granted. Collector Settings to be passed:', collectorSettings);

                navigate(`/surveys/${surveyId}/c/${collectorId}`, {
                    replace: true,
                    state: {
                        surveyTitle: title,
                        collectorSettings: collectorSettings || {} // Ensure it's at least an empty object
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
            const errData = err.response?.data;
            const errorMessage = errData?.message || err.message || 'An unexpected error occurred.';
            console.error(`[PublicSurveyHandler] CATCH BLOCK: Error processing survey access for ${accessIdentifier}:`, err.response || err);

            if (errData?.requiresPassword) {
                setRequiresPassword(true);
                setSurveyTitle(errData?.surveyTitle || surveyTitle || 'this survey');
                if (currentPassword) {
                    setPasswordError(errorMessage);
                } else {
                    setError(null);
                }
            } else {
                setError(errorMessage);
                // Avoid double toasting if surveyApi already toasted (depends on its implementation)
                // toast.error(`Error: ${errorMessage}`); 
            }
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (!accessIdentifier) {
            setError('No access identifier provided in the link.');
            setIsLoading(false);
            toast.error('Invalid survey link: Missing identifier.');
            return;
        }
        handleAccessAttempt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [accessIdentifier]);

    const handlePasswordSubmit = (e) => {
        e.preventDefault();
        if (!password.trim()) {
            setPasswordError('Password cannot be empty.');
            return;
        }
        handleAccessAttempt(password.trim());
    };

    if (isLoading && !requiresPassword && !error) {
        return (
            <div className="public-survey-handler-container">
                <div className="spinner"></div>
                <p>Loading survey, please wait...</p>
            </div>
        );
    }

    if (error && !requiresPassword) {
        return (
            <div className="public-survey-handler-container error-container">
                <h2>Survey Access Error</h2>
                <p>{error}</p>
                <button
                    onClick={() => navigate('/')}
                    className="button-primary"
                >
                    Go to Homepage
                </button>
            </div>
        );
    }

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
                            onChange={(e) => {
                                setPassword(e.target.value);
                                if (passwordError) setPasswordError('');
                            }}
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
            </div>
        );
    }

    return (
        <div className="public-survey-handler-container">
            <p>Processing your request...</p>
            {/* This state should be transient. If it persists, there's an issue in the logic. */}
        </div>
    );
};

export default PublicSurveyHandler;
// ----- END OF COMPLETE MODIFIED FILE (vNext - Added console log for collectorSettings) -----