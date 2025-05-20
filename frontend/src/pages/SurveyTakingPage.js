// frontend/src/pages/SurveyTakingPage.js
// ----- START OF REVISED FILE USING ACTUAL API FLOW -----
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
// import { toast } from 'react-toastify'; // Uncomment for actual toast notifications
import surveyApi from '../api/surveyApi'; // <<< IMPORT YOUR ACTUAL API
import styles from './SurveyTakingPage.module.css';

// Helper Functions
const ensureArray = (value) => (Array.isArray(value) ? value : (value !== undefined && value !== null ? [value] : []));

function SurveyTakingPage() {
    console.log('[Debug STM] SurveyTakingPage function component body executing. (Top)');
    const { accessIdentifier, resumeToken: routeResumeToken } = useParams(); // accessIdentifier can be collector linkId or customSlug
    const location = useLocation();
    const navigate = useNavigate();

    // --- State Variables ---
    const [surveyAccessData, setSurveyAccessData] = useState(null); // Stores { surveyId, collectorId, surveyTitle, collectorSettings }
    const [survey, setSurvey] = useState(null); // Stores the full survey object with questions
    const [originalQuestions, setOriginalQuestions] = useState([]);
    const [currentAnswers, setCurrentAnswers] = useState({});
    
    const [isLoadingAccess, setIsLoadingAccess] = useState(true); // For the first access call
    const [isLoadingSurvey, setIsLoadingSurvey] = useState(false); // For fetching the survey details
    const [accessError, setAccessError] = useState(null);
    const [surveyError, setSurveyError] = useState(null);
    
    const [requiresPassword, setRequiresPassword] = useState(false);
    const [passwordInput, setPasswordInput] = useState('');
    const [passwordError, setPasswordError] = useState('');

    const [currentVisibleIndex, setCurrentVisibleIndex] = useState(0);
    const [visibleQuestionIndices, setVisibleQuestionIndices] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [otherInputValues, setOtherInputValues] = useState({});
    
    const [currentResumeToken, setCurrentResumeToken] = useState(routeResumeToken);
    const [isSavingAndContinueLater, setIsSavingAndContinueLater] = useState(false);
    const [showResumeCodeModal, setShowResumeCodeModal] = useState(false);
    const [generatedResumeCode, setGeneratedResumeCode] = useState('');
    const [emailForReminder, setEmailForReminder] = useState('');

    const NA_VALUE_INTERNAL = '__NA__';
    const OTHER_VALUE_INTERNAL = '__OTHER__';

    // --- Memoized Derived State --- (These will populate once `survey` is loaded)
    const questionsById = useMemo(() => originalQuestions.reduce((acc, q) => { acc[q._id] = q; return acc; }, {}), [originalQuestions]);
    const questionsInCurrentOrder = useMemo(() => originalQuestions, [originalQuestions]);
    const questionIdToOriginalIndexMap = useMemo(() => originalQuestions.reduce((acc, q, idx) => { acc[q._id] = q.originalIndex !== undefined ? q.originalIndex : idx; return acc; }, {}), [originalQuestions]);

    const currentQuestionToRender = useMemo(() => {
        if (isLoadingAccess || isLoadingSurvey || !survey || !visibleQuestionIndices || visibleQuestionIndices.length === 0 || currentVisibleIndex < 0 || currentVisibleIndex >= visibleQuestionIndices.length) {
            return null;
        }
        const originalQuestionIndex = visibleQuestionIndices[currentVisibleIndex];
        return originalQuestions.find(q => q.originalIndex === originalQuestionIndex);
    }, [isLoadingAccess, isLoadingSurvey, survey, visibleQuestionIndices, currentVisibleIndex, originalQuestions]);

    const isSubmitState = useMemo(() => {
        if (isLoadingAccess || isLoadingSurvey || !survey || !visibleQuestionIndices || visibleQuestionIndices.length === 0) return false;
        return currentVisibleIndex >= visibleQuestionIndices.length - 1;
    }, [isLoadingAccess, isLoadingSurvey, survey, visibleQuestionIndices, currentVisibleIndex]);

    console.log('[Debug STM] After useMemo hooks, before useEffect hooks.');

    // --- Effect for Step 1: Accessing the Survey Link ---
    const attemptSurveyAccess = useCallback(async (passwordToTry) => {
        if (!accessIdentifier) {
            setAccessError("No survey access identifier provided in URL.");
            setIsLoadingAccess(false);
            return;
        }
        console.log(`[Debug STM] Attempting survey access for: ${accessIdentifier}`);
        setIsLoadingAccess(true);
        setAccessError(null);
        setPasswordError('');
        setRequiresPassword(false);

        try {
            const response = await surveyApi.accessPublicSurvey(accessIdentifier, passwordToTry);
            if (response.success && response.data) {
                console.log("[Debug STM] Survey access granted:", response.data);
                setSurveyAccessData(response.data); // Contains surveyId, collectorId, etc.
                if (routeResumeToken) setCurrentResumeToken(routeResumeToken);
                // Now trigger fetching the actual survey details
            } else {
                // This case should ideally be caught by the error handler below
                setAccessError(response.message || "Failed to access survey link.");
            }
        } catch (error) {
            console.error("[Debug STM] Error accessing survey link:", error);
            if (error.requiresPassword) {
                setRequiresPassword(true);
                setAccessError(error.message || "This survey is password protected.");
                setPasswordError(error.message === 'Incorrect password.' ? error.message : ''); // Show specific error if incorrect
            } else {
                setAccessError(error.message || "Could not access survey. The link may be invalid, expired, or the survey is not active.");
            }
            setSurveyAccessData(null);
        } finally {
            setIsLoadingAccess(false);
        }
    }, [accessIdentifier, routeResumeToken]);

    useEffect(() => {
        attemptSurveyAccess(null); // Initial attempt without password
    }, [attemptSurveyAccess]); // Only run once on mount or if accessIdentifier changes

    // --- Effect for Step 2: Fetching Survey Details (after access is granted) ---
    useEffect(() => {
        if (surveyAccessData?.surveyId) {
            console.log(`[Debug STM] Access granted, now fetching survey details for ID: ${surveyAccessData.surveyId}`);
            setIsLoadingSurvey(true);
            setSurveyError(null);
            
            // Prepare options for getSurveyById, potentially including resumeToken if we were to fetch saved answers with it
            const fetchOptions = {};
            if (currentResumeToken) {
                // How you pass resumeToken to getSurveyById depends on your API design.
                // It might be a query param, or getSurveyById might have a specific param for it.
                // For now, assuming it might be part of a general options object or handled by backend if token is in URL.
                // If getSurveyById is *only* for survey structure, saved answers might be fetched separately or with accessPublicSurvey
                // For this example, let's assume getSurveyById can take a resumeToken to populate answers.
                // Your surveyApi.getSurveyById doesn't explicitly show resumeToken handling, so this is an assumption.
                // fetchOptions.resumeToken = currentResumeToken;
                console.log(`[Debug STM] Fetching survey with resumeToken: ${currentResumeToken}`);
            }

            surveyApi.getSurveyById(surveyAccessData.surveyId, fetchOptions)
                .then(response => {
                    if (response.success && response.data) {
                        console.log("[Debug STM] Survey details fetched:", response.data);
                        setSurvey(response.data);
                        setOriginalQuestions(response.data.questions || []);
                        setVisibleQuestionIndices((response.data.questions || []).map(q => q.originalIndex).sort((a,b) => a-b));
                        
                        // If resuming and your getSurveyById or a separate call fetched savedAnswers:
                        // if (response.savedAnswers) { setCurrentAnswers(response.savedAnswers); }
                        // Or if saved answers were part of the survey object itself:
                        // if (response.data.savedProgress && response.data.savedProgress.answers) {
                        //    setCurrentAnswers(response.data.savedProgress.answers);
                        //    if (response.data.savedProgress.lastQuestionIndex) {
                        //        setCurrentVisibleIndex(response.data.savedProgress.lastQuestionIndex)
                        //    }
                        // }

                    } else {
                        setSurveyError(response.message || "Failed to load survey details.");
                        setSurvey(null);
                    }
                })
                .catch(err => {
                    console.error("[Debug STM] Error fetching survey details:", err);
                    setSurveyError(err.message || "An error occurred while loading survey details.");
                    setSurvey(null);
                })
                .finally(() => {
                    setIsLoadingSurvey(false);
                });
        }
    }, [surveyAccessData, currentResumeToken]); // Run when surveyAccessData changes

    console.log('[Debug STM] After useEffect hooks, before useCallback hooks.');

    // --- Password Submission Handler ---
    const handlePasswordSubmit = (e) => {
        e.preventDefault();
        if (!passwordInput) {
            setPasswordError("Password cannot be empty.");
            return;
        }
        attemptSurveyAccess(passwordInput);
    };

    // --- All other Callbacks (evaluateDisabled, validateQuestion, etc.) ---
    // These remain largely the same as the last complete version, but ensure they use
    // `surveyAccessData.collectorId` and `surveyAccessData.surveyId` where appropriate.

    const evaluateDisabled = useCallback((questionId) => { console.log('[Debug STM] evaluateDisabled DEFINITION.'); return false; }, []);
    const validateQuestion = useCallback((question, answer) => { console.log('[Debug STM] validateQuestion DEFINITION.'); if (!question) return true; const { required } = question; const isEmpty = answer === undefined || answer === null || answer === '' || (Array.isArray(answer) && answer.length === 0); if (required && isEmpty && answer !== NA_VALUE_INTERNAL) return false; return true; }, [otherInputValues, NA_VALUE_INTERNAL, OTHER_VALUE_INTERNAL]);
    // ... (evaluateGlobalLogic, evaluateActionLogic - keep as before for now)

    const handleSubmit = useCallback(async () => {
        console.log('[Debug STM] handleSubmit DEFINITION.');
        if (!surveyAccessData) { console.error("Cannot submit, survey access data not available."); return; }
        if (currentQuestionToRender && !validateQuestion(currentQuestionToRender, currentAnswers[currentQuestionToRender._id])) {
            // toast.error("Please correct errors before submitting.");
            return;
        }
        setIsSubmitting(true);
        try {
            // Use surveyApi.submitSurveyAnswers
            const result = await surveyApi.submitSurveyAnswers(surveyAccessData.surveyId, {
                collectorId: surveyAccessData.collectorId,
                answers: currentAnswers,
                resumeToken: currentResumeToken // Pass token if it was used/generated
            });
            if (result.success) { /* toast.success */ console.log("Survey submitted!", result); /* navigate to thank you */ }
            else { /* toast.error */ console.error("Submission failed.", result); }
        } catch (err) { /* toast.error */ console.error("Submission error.", err); }
        finally { setIsSubmitting(false); }
    }, [surveyAccessData, currentAnswers, currentResumeToken, validateQuestion, currentQuestionToRender]);

    const handleNext = useCallback(() => { /* ... as before ... */
        console.log('[Debug STM] handleNext DEFINITION.');
        if (currentQuestionToRender && !validateQuestion(currentQuestionToRender, currentAnswers[currentQuestionToRender._id])) { return; }
        if (!isSubmitState) { setCurrentVisibleIndex(prev => prev + 1); }
        else { handleSubmit(); }
    }, [isSubmitState, currentVisibleIndex, validateQuestion, currentQuestionToRender, currentAnswers, handleSubmit, setCurrentVisibleIndex]);
    
    const handlePrevious = useCallback(() => { /* ... as before ... */ console.log('[Debug STM] handlePrevious DEFINITION.'); if (currentVisibleIndex > 0) { setCurrentVisibleIndex(prev => prev - 1); } }, [currentVisibleIndex, setCurrentVisibleIndex]);
    const handleInputChange = useCallback((questionId, value) => { /* ... as before ... */ console.log('[Debug STM] handleInputChange DEFINITION.'); setCurrentAnswers(prev => ({ ...prev, [questionId]: value })); }, [setCurrentAnswers]);
    const handleCheckboxChange = useCallback((questionId, optionValue, isChecked) => { /* ... as before ... */ console.log('[Debug STM] handleCheckboxChange DEFINITION.'); setCurrentAnswers(prev => { const sel = ensureArray(prev[questionId]); const newSel = isChecked ? [...sel, optionValue] : sel.filter(v => v !== optionValue); if (optionValue === OTHER_VALUE_INTERNAL && !isChecked) setOtherInputValues(o => ({...o, [`${questionId}_other`]: ''})); return {...prev, [questionId]: newSel}; }); }, [OTHER_VALUE_INTERNAL, setCurrentAnswers, setOtherInputValues]);
    const handleOtherInputChange = useCallback((questionIdForOtherField, value) => { /* ... as before ... */ console.log('[Debug STM] handleOtherInputChange DEFINITION.'); setOtherInputValues(prev => ({ ...prev, [questionIdForOtherField]: value })); const mainQId = questionIdForOtherField.replace('_other',''); if(value.trim() !== '') setCurrentAnswers(prev => ({...prev, [mainQId]: [...ensureArray(prev[mainQId]), OTHER_VALUE_INTERNAL].filter((v,i,a)=>a.indexOf(v)===i)})); }, [OTHER_VALUE_INTERNAL, setCurrentAnswers, setOtherInputValues]);

    const handleSaveAndContinueLater = useCallback(async () => {
        console.log('[Debug STM] handleSaveAndContinueLater DEFINITION.');
        if (!surveyAccessData) { console.error("Cannot save, survey access data not available."); return; }
        setIsSavingAndContinueLater(true);
        const qToRender = currentQuestionToRender;
        const currentQIdForSave = qToRender?._id || (visibleQuestionIndices.length > 0 ? originalQuestions.find(q => q.originalIndex === visibleQuestionIndices[Math.max(0, currentVisibleIndex -1)])?._id : null);

        try {
            // Use surveyApi.savePartialResponse
            const result = await surveyApi.savePartialResponse(surveyAccessData.surveyId, {
                collectorId: surveyAccessData.collectorId,
                answers: currentAnswers,
                lastQuestionId: currentQIdForSave, // Or lastQuestionIndex
                resumeToken: currentResumeToken // Pass existing token to update, or null for new
            });
            if (result.success && result.resumeToken) {
                setCurrentResumeToken(result.resumeToken);
                setGeneratedResumeCode(result.resumeToken);
                setShowResumeCodeModal(true);
                console.log("Progress saved. Resume Code:", result.resumeToken);
            } else { console.error("Failed to save for later.", result); }
        } catch (err) { console.error("Error saving for later.", err); }
        finally { setIsSavingAndContinueLater(false); }
    }, [surveyAccessData, currentAnswers, currentResumeToken, currentQuestionToRender, visibleQuestionIndices, originalQuestions, currentVisibleIndex]);

    const handleSendReminderEmail = useCallback(async () => {
        // This would call an API endpoint. Your surveyApi.js doesn't have sendResumeEmail yet.
        // For now, just logging.
        if (!generatedResumeCode || !emailForReminder) { console.warn("Email or resume code missing."); return; }
        console.log(`Simulating sending email reminder to ${emailForReminder} for code ${generatedResumeCode}`);
        // const result = await surveyApi.sendResumeEmail(surveyAccessData.surveyId, generatedResumeCode, emailForReminder);
        // Handle result
    }, [surveyAccessData?.surveyId, generatedResumeCode, emailForReminder]);

    const renderProgressBar = useCallback(() => { /* ... as before ... */
        console.log('[Debug STM] renderProgressBar DEFINITION.');
        if (!survey || !survey.settings?.showProgressBar || !visibleQuestionIndices || visibleQuestionIndices.length === 0) return null;
        const safeIdx = Math.min(currentVisibleIndex, visibleQuestionIndices.length - 1);
        const progress = visibleQuestionIndices.length > 0 ? ((safeIdx + 1) / visibleQuestionIndices.length) * 100 : 0;
        return ( <div className={styles.progressBarContainer}><div className={styles.progressBarFill} style={{ width: `${progress.toFixed(2)}%` }}></div><span>{Math.round(progress)}%</span></div> );
    }, [survey, visibleQuestionIndices, currentVisibleIndex]);

    console.log('[Debug STM] After useCallback hooks, before main render logic.');

    // --- Dynamic Question Renderer (using actual question data) ---
    const renderQuestionInputs = (question) => {
        if (!question) return <p>No question to display.</p>;
        const answer = currentAnswers[question._id];
        // Use your actual question rendering components from frontend/src/components/survey_question_renders/
        // This switch is a placeholder for that integration.
        switch (question.type) {
            case 'text':
            case 'shortText': // Assuming shortText is a type
                // return <ShortTextQuestion question={question} ... />
                return <input type="text" className={styles.textInput} value={answer || ''} onChange={(e) => handleInputChange(question._id, e.target.value)} placeholder="Type your answer" />;
            case 'textarea':
                // return <TextAreaQuestion question={question} ... />
                return <textarea className={styles.textareaInput} value={answer || ''} onChange={(e) => handleInputChange(question._id, e.target.value)} placeholder="Type your comments" rows={4} />;
            case 'single-select': // Maps to MultipleChoiceQuestion with single selection
            case 'multipleChoice': // If you have a specific multipleChoice type
                // return <MultipleChoiceQuestion question={question} ... />
                return (<div className={styles.optionsGroup}>{question.options?.map(opt => (
                    <label key={opt.value || opt.text} className={styles.optionLabel}> {/* Ensure opt.value exists */}
                        <input type="radio" name={question._id} value={opt.value || opt.text} checked={answer === (opt.value || opt.text)} onChange={(e) => handleInputChange(question._id, e.target.value)} /> {opt.text}
                    </label>))}</div>);
            case 'multi-select': // Maps to CheckboxQuestion
            case 'checkbox':
                // return <CheckboxQuestion question={question} ... />
                 return (<div className={styles.optionsGroup}>{question.options?.map(opt => (
                    <label key={opt.value || opt.text} className={styles.optionLabel}>
                        <input type="checkbox" value={opt.value || opt.text} checked={ensureArray(answer).includes(opt.value || opt.text)} onChange={(e) => handleCheckboxChange(question._id, (opt.value || opt.text), e.target.checked)} /> {opt.text}
                    </label>))}</div>);
            case 'heatmap':
                // return <HeatmapQuestion question={question} ... />
                return ( <div className={styles.heatmapContainer}> {question.imageUrl ? <img src={question.imageUrl} alt="Heatmap base" /> : <p>Image not available.</p>} <p>(Heatmap Area)</p> </div> );
            // ADD CASES FOR: CardSortQuestion, ConjointQuestion, DropdownQuestion, MatrixQuestion, MaxDiffQuestion, NpsQuestion, RankingQuestion, RatingQuestion, SliderQuestion
            default:
                return <p>Unsupported question type in SurveyTakingPage: {question.type}</p>;
        }
    };

    // --- Main Render Logic ---
    if (isLoadingAccess) return <div className={styles.loadingContainer}>Verifying survey access...</div>;
    if (accessError && !requiresPassword) return <div className={styles.errorContainer}>Error: {accessError}</div>;
    if (requiresPassword && !surveyAccessData) { // Show password prompt only if access not yet granted
        return (
            <div className={styles.passwordPromptContainer}>
                <h2>Password Required</h2>
                <p>{accessError || surveyAccessData?.surveyTitle || 'This survey is password protected.'}</p>
                <form onSubmit={handlePasswordSubmit}>
                    <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} placeholder="Enter password" autoFocus className={styles.passwordInput} />
                    {passwordError && <p className={styles.errorMessage}>{passwordError}</p>}
                    <button type="submit" className={styles.buttonPrimary}>Submit Password</button>
                </form>
            </div>
        );
    }
    if (isLoadingSurvey) return <div className={styles.loadingContainer}>Loading survey questions...</div>;
    if (surveyError) return <div className={styles.errorContainer}>Error loading survey: {surveyError}</div>;
    if (!surveyAccessData || !survey) return <div className={styles.errorContainer}>Survey could not be loaded. Please check the link or try again.</div>;

    const progressBarElement = renderProgressBar();

    return (
        <div className={styles.surveyContainer}>
            <header className={styles.surveyHeader}>
                <h1>{survey.title || surveyAccessData.surveyTitle}</h1>
                {survey.description && <p>{survey.description}</p>}
                {progressBarElement}
            </header>

            {currentQuestionToRender ? (
                <div className={styles.questionArea}>
                    <h2>{currentQuestionToRender.text}</h2>
                    {/* <p>(Type: {currentQuestionToRender.type})</p> */}
                    {renderQuestionInputs(currentQuestionToRender)}
                </div>
            ) : (
                !isSubmitting && <p className={styles.surveyMessage}>Thank you! No more questions.</p>
            )}
            
            <footer className={styles.surveyNavigation}>
                {currentVisibleIndex > 0 && (<button type="button" onClick={handlePrevious} disabled={isSubmitting || isSavingAndContinueLater} className={styles.navButton}>Previous</button>)}
                {!isSubmitState && (<button type="button" onClick={handleNext} disabled={isSubmitting || isSavingAndContinueLater} className={styles.navButton}>Next</button>)}
                {isSubmitState && (<button type="button" onClick={handleSubmit} disabled={isSubmitting || isSavingAndContinueLater} className={styles.navButtonPrimary}>{isSubmitting ? 'Submitting...' : 'Submit'}</button>)}
                {survey.settings?.behaviorNavigation?.saveAndContinueEnabled && (<button type="button" onClick={handleSaveAndContinueLater} disabled={isSavingAndContinueLater || isSubmitting} className={styles.navButtonSecondary}>{isSavingAndContinueLater ? 'Saving...' : 'Save and Continue Later'}</button>)}
            </footer>

            {showResumeCodeModal && ( /* ... Resume Code Modal JSX as before ... */
                <div className={styles.modalBackdrop} onClick={() => setShowResumeCodeModal(false)}>
                    <div className={styles.modalContentWrapper} onClick={e => e.stopPropagation()}>
                        <h3>Resume Later</h3>
                        <p>Your progress has been saved. Use the following code to resume your survey later:</p>
                        <strong className={styles.resumeCodeDisplay}>{generatedResumeCode}</strong>
                        <hr />
                        <p>Optionally, enter your email to receive this code and a resume link:</p>
                        <input type="email" value={emailForReminder} onChange={(e) => setEmailForReminder(e.target.value)} placeholder="your.email@example.com" className={styles.emailInputForReminder} />
                        <button onClick={handleSendReminderEmail} className={styles.button}>Send Email Reminder</button>
                        <button onClick={() => setShowResumeCodeModal(false)} className={styles.buttonSecondary} style={{marginTop: '10px'}}>Close</button>
                    </div>
                </div>
            )}

            <div className={styles.debugInfo}>
                <p><strong>Debug Info:</strong></p>
                <p>Access Identifier: {accessIdentifier}</p>
                <p>Survey Access Data: {surveyAccessData ? `SurveyID: ${surveyAccessData.surveyId}, CollectorID: ${surveyAccessData.collectorId}` : "Not yet accessed"}</p>
                <p>Survey Object Loaded: {survey ? `Title: ${survey.title}` : "No"}</p>
                <p>Original Questions Count: {originalQuestions.length}</p>
                <p>CurrentAnswers: {JSON.stringify(currentAnswers)}</p>
                <p>CurrentVisibleIndex: {currentVisibleIndex} (Original Index: {visibleQuestionIndices[currentVisibleIndex]})</p>
                <p>Resume Token (Code): {currentResumeToken || "None"}</p>
            </div>
        </div>
    );
}

export default SurveyTakingPage;
// ----- END OF REVISED FILE USING ACTUAL API FLOW -----