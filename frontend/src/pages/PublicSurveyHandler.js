// frontend/src/pages/PublicSurveyHandler.js
// ----- START OF COMPLETE MODIFIED FILE -----
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import surveyApiFunctions from '../api/surveyApi';
import './PublicSurveyHandler.css'; // We'll create/use this CSS file

const PublicSurveyHandler = () => {
    const { accessIdentifier } = useParams();
    const navigate = useNavigate();

    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null); // For general errors or final access errors
    const [requiresPassword, setRequiresPassword] = useState(false);
    const [password, setPassword] = useState('');
    const [passwordError, setPasswordError] = useState(''); // Specifically for password input errors
    const [surveyTitle, setSurveyTitle] = useState(''); // To display survey title on password prompt

    const handleAccessAttempt = async (currentPassword = null) => {
        setIsLoading(true);
        setError(null); // Clear general error
        if (currentPassword) setPasswordError(''); // Clear password error if attempting with password

        try {
            console.log(`[PublicSurveyHandler] Attempting access for: ${accessIdentifier}` + (currentPassword ? " with password." : " without password."));
            const response = await surveyApiFunctions.accessPublicSurvey(accessIdentifier, currentPassword);
            console.log('[PublicSurveyHandler] Response from accessPublicSurvey:', response);

            if (response && response.success && response.data && response.data.surveyId && response.data.collectorId) {
                const { surveyId, collectorId, surveyTitle: title, collectorSettings } = response.data;

                if (typeof surveyId !== 'string' || surveyId.includes('<anonymous') || surveyId.length < 5) {
                    throw new Error(`Invalid surveyId ('${surveyId}') received from API.`);
                }
                if (typeof collectorId !== 'string' || collectorId.includes('<anonymous') || collectorId.length < 5) {
                    throw new Error(`Invalid collectorId ('${collectorId}') received from API.`);
                }

                console.log(`[PublicSurveyHandler] Access granted. Navigating to: /surveys/${surveyId}/c/${collectorId}`);
                navigate(`/surveys/${surveyId}/c/${collectorId}`, {
                    replace: true,
                    state: {
                        surveyTitle: title, // Pass title for SurveyTakingPage if needed
                        collectorSettings: collectorSettings || {}
                    }
                });
            } else {
                // This path might be hit if API returns success: false but with specific instructions
                // However, accessPublicSurvey in surveyApi.js is designed to throw an error for non-2xx responses.
                // This block is more of a safeguard.
                const message = response?.message || 'API response lacked success flag or necessary data.';
                console.error('[PublicSurveyHandler] API response issue or missing data:', response);
                setError(message); // Set general error
                if (response?.requiresPassword) { // Check if API explicitly states password requirement
                    setRequiresPassword(true);
                    setSurveyTitle(response?.data?.surveyTitle || ''); // If title is available
                }
                setIsLoading(false);
            }
        } catch (err) {
            // This is the more common path for errors due to how surveyApi.js throws on non-2xx
            const errData = err.response?.data; // Axios error structure
            const errorMessage = errData?.message || err.message || 'An unexpected error occurred.';
            console.error(`[PublicSurveyHandler] CATCH BLOCK: Error processing survey access for ${accessIdentifier}:`, err);

            if (errData?.requiresPassword) {
                setRequiresPassword(true);
                setSurveyTitle(errData?.surveyTitle || surveyTitle || 'this survey'); // Keep existing title if already set
                if (currentPassword) { // If this error occurred after a password attempt
                    setPasswordError(errorMessage); // Show error next to password field
                } else {
                    setError(null); // Don't show a general error message yet, just the password prompt
                }
            } else {
                setError(errorMessage); // Set general error for other issues
                toast.error(`Error: ${errorMessage}`);
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
        // Initial attempt without password when component mounts
        handleAccessAttempt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [accessIdentifier]); // Only re-run if accessIdentifier changes

    const handlePasswordSubmit = (e) => {
        e.preventDefault();
        if (!password.trim()) {
            setPasswordError('Password cannot be empty.');
            return;
        }
        handleAccessAttempt(password.trim());
    };

    // Initial Loading State (before knowing if password is required or any error)
    if (isLoading && !requiresPassword && !error) {
        return (
            <div className="public-survey-handler-container">
                <div className="spinner"></div>
                <p>Loading survey, please wait...</p>
            </div>
        );
    }

    // General Error Display (if not a password prompt scenario)
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

    // Password Prompt
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
                                if (passwordError) setPasswordError(''); // Clear error on new input
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
                    {/* Show general error here if it occurred during password phase and wasn't a password-specific error */}
                    {error && !passwordError && <p className="error-message general-error">{error}</p>}
                </form>
            </div>
        );
    }

    // Fallback or transient state, should ideally not be seen for long
    return (
        <div className="public-survey-handler-container">
            <p>Processing your request...</p>
        </div>
    );
};

export default PublicSurveyHandler;
// ----- END OF COMPLETE MODIFIED FILE -----