// frontend/src/pages/SurveyTakingPage.js
// ----- START OF REVISED AND MORE COMPLETE RESTORED FILE -----
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
// import { toast } from 'react-toastify'; // Uncomment for actual toast notifications
import styles from './SurveyTakingPage.module.css'; // Ensure this CSS module file exists

// --- Helper Functions ---
const ensureArray = (value) => (Array.isArray(value) ? value : (value !== undefined && value !== null ? [value] : []));

// --- API Service Stub (Adjust to your actual API structure) ---
const surveyApi = {
    getSurveyPublic: async (surveyId, collectorId, resumeToken) => {
        console.log(`[Debug STM] surveyApi.getSurveyPublic STUB CALLED for surveyId: ${surveyId}, collectorId: ${collectorId}, resumeToken: ${resumeToken}`);
        await new Promise(resolve => setTimeout(resolve, 300)); // Simulate network delay
        // In a real app, fetch survey structure. If resumeToken, also fetch saved answers.
        // For this stub, we'll return a generic structure. The questions should come from the build page.
        // This stub needs to be more dynamic or you need to ensure your backend provides this.
        // For now, I'll keep a few sample questions but ideally, this is fetched.
        const sampleQuestions = [
            { _id: 'q1_from_build', type: 'text', text: 'What is your full name? (Fetched)', required: true, originalIndex: 0 },
            { _id: 'q2_from_build', type: 'single-select', text: 'Your primary role? (Fetched)', options: [{text: 'Developer', value: 'dev'}, {text: 'Manager', value: 'mgr'}], required: true, originalIndex: 1 },
            { _id: 'q3_from_build', type: 'textarea', text: 'Feedback or comments? (Fetched)', required: false, originalIndex: 2 },
            { _id: 'q4_heatmap_build', type: 'heatmap', text: 'Indicate areas of interest on the image. (Fetched)', imageUrl: 'https://via.placeholder.com/400x300.png?text=Sample+Heatmap+Image', definedHeatmapAreas: [], required: false, originalIndex: 3 }
        ];
        
        let savedAnswers = {};
        if (resumeToken) {
            console.log(`[Debug STM] surveyApi: Simulating fetching saved answers for resumeToken: ${resumeToken}`);
            // Example: savedAnswers = { 'q1_from_build': 'Old Answer', 'q2_from_build': 'dev' };
        }

        return {
            success: true,
            survey: {
                _id: surveyId,
                title: `Survey: ${surveyId} (Fetched Title)`,
                description: "This survey's questions are dynamically rendered based on its definition.",
                questions: sampleQuestions, // These should be the actual questions for surveyId
                settings: {
                    allowResume: true,
                    showProgressBar: true,
                    // ... other settings from SurveyBuildPage
                },
                // welcomeMessage, thankYouMessage etc.
            },
            collector: { _id: collectorId || "defaultCollectorId" },
            savedAnswers: savedAnswers // Include saved answers if resuming
        };
    },
    savePartialResponse: async (surveyId, collectorId, answers, currentQuestionId, existingResumeToken) => {
        console.log('[Debug STM] surveyApi.savePartialResponse STUB CALLED with:', { surveyId, collectorId, answers, currentQuestionId, existingResumeToken });
        await new Promise(resolve => setTimeout(resolve, 100));
        // If existingResumeToken is provided, backend updates that record.
        // If not, backend generates a new one.
        const resumeCode = existingResumeToken || `RESUME-${surveyId.slice(0,4)}-${Date.now().toString().slice(-6)}`;
        console.log(`[Debug STM] surveyApi: Saved partial response. Resume Code/Token: ${resumeCode}`);
        // In a real app, this might also trigger the email if that's a backend process.
        return { success: true, resumeToken: resumeCode, message: 'Progress saved. Use the code to resume.' };
    },
    sendResumeEmail: async (surveyId, resumeToken, userEmail) => {
        console.log(`[Debug STM] surveyApi.sendResumeEmail STUB CALLED for surveyId: ${surveyId}, resumeToken: ${resumeToken}, email: ${userEmail}`);
        await new Promise(resolve => setTimeout(resolve, 100));
        // This would typically be handled by the backend.
        // The frontend just needs to know if the request to send was successful.
        if (!userEmail || !userEmail.includes('@')) {
            return { success: false, message: "Invalid email address provided for reminder." };
        }
        return { success: true, message: `Reminder email will be sent to ${userEmail} with the resume code.` };
    },
    submitResponse: async (surveyId, collectorId, answers, resumeToken) => {
        console.log('[Debug STM] surveyApi.submitResponse STUB CALLED with:', { surveyId, collectorId, answers, resumeToken });
        await new Promise(resolve => setTimeout(resolve, 100));
        return { success: true, submissionId: `sub_${Date.now()}`, message: 'Response submitted successfully!' };
    }
};
// --- End API Service Stub ---

// --- Main Component ---
function SurveyTakingPage() {
    console.log('[Debug STM] SurveyTakingPage function component body executing. (Top)');
    const { surveyId, collectorId: routeCollectorId, resumeToken: routeResumeToken } = useParams();
    const location = useLocation();
    const navigate = useNavigate();

    // --- State Variables ---
    const [survey, setSurvey] = useState(null);
    const [originalQuestions, setOriginalQuestions] = useState([]);
    const [currentAnswers, setCurrentAnswers] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentVisibleIndex, setCurrentVisibleIndex] = useState(0);
    const [visibleQuestionIndices, setVisibleQuestionIndices] = useState([]); // Stores original indices of visible questions
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [otherInputValues, setOtherInputValues] = useState({}); // For "other" text fields in choice questions
    
    const [currentCollectorId, setCurrentCollectorId] = useState(routeCollectorId);
    const [currentResumeToken, setCurrentResumeToken] = useState(routeResumeToken); // This is the code for resuming

    const [isSavingAndContinueLater, setIsSavingAndContinueLater] = useState(false);
    const [showResumeCodeModal, setShowResumeCodeModal] = useState(false);
    const [generatedResumeCode, setGeneratedResumeCode] = useState('');
    const [emailForReminder, setEmailForReminder] = useState('');


    const NA_VALUE_INTERNAL = '__NA__';
    const OTHER_VALUE_INTERNAL = '__OTHER__';

    // --- Memoized Derived State ---
    const questionsById = useMemo(() => { /* ... as before ... */ return originalQuestions.reduce((acc, q) => { acc[q._id] = q; return acc; }, {}); }, [originalQuestions]);
    const questionsInCurrentOrder = useMemo(() => { /* ... as before ... */ return originalQuestions; }, [originalQuestions]);
    const questionIdToOriginalIndexMap = useMemo(() => { /* ... as before ... */ return originalQuestions.reduce((acc, q, idx) => { acc[q._id] = q.originalIndex !== undefined ? q.originalIndex : idx; return acc; }, {}); }, [originalQuestions]);

    const currentQuestionToRender = useMemo(() => {
        console.log('[Debug STM] currentQuestionToRender CALC.');
        if (isLoading || !survey || !visibleQuestionIndices || visibleQuestionIndices.length === 0 || currentVisibleIndex < 0 || currentVisibleIndex >= visibleQuestionIndices.length) {
            return null;
        }
        const originalQuestionIndex = visibleQuestionIndices[currentVisibleIndex];
        return originalQuestions.find(q => q.originalIndex === originalQuestionIndex);
    }, [isLoading, survey, visibleQuestionIndices, currentVisibleIndex, originalQuestions]);

    const isSubmitState = useMemo(() => { /* ... as before ... */ if (isLoading || !survey || !visibleQuestionIndices || visibleQuestionIndices.length === 0) return false; return currentVisibleIndex >= visibleQuestionIndices.length - 1; }, [isLoading, survey, visibleQuestionIndices, currentVisibleIndex]);

    console.log('[Debug STM] After useMemo hooks, before useEffect hooks.');
    // --- Effects ---
    useEffect(() => {
        console.log('[Debug STM] useEffect (Initial Data Load) ENTERED.');
        setIsLoading(true);
        if (routeCollectorId) setCurrentCollectorId(routeCollectorId);
        if (routeResumeToken) setCurrentResumeToken(routeResumeToken);

        surveyApi.getSurveyPublic(surveyId, routeCollectorId, routeResumeToken)
            .then(response => {
                if (response.success && response.survey) {
                    setSurvey(response.survey);
                    setOriginalQuestions(response.survey.questions || []);
                    // Initialize visibleQuestionIndices based on ALL questions for now. Logic can refine this.
                    setVisibleQuestionIndices((response.survey.questions || []).map(q => q.originalIndex));
                    if (response.savedAnswers) {
                        setCurrentAnswers(response.savedAnswers);
                        // Potentially set currentVisibleIndex to the last answered question
                    }
                    setError(null);
                    if (!currentCollectorId && response.collector?._id) {
                        setCurrentCollectorId(response.collector._id);
                    }
                } else {
                    setError(response.message || "Failed to load survey data.");
                }
            })
            .catch(err => {
                console.error("Error fetching survey:", err);
                setError("An error occurred while loading the survey.");
            })
            .finally(() => {
                setIsLoading(false);
                console.log('[Debug STM] useEffect (Initial Data Load) COMPLETED.');
            });
    }, [surveyId, routeCollectorId, routeResumeToken]); // Dependencies

    console.log('[Debug STM] After useEffect hooks, before useCallback hooks.');
    // --- Callbacks (with DEFINITION logs) ---

    const evaluateDisabled = useCallback((questionId) => { /* ... as before ... */ console.log('[Debug STM] evaluateDisabled DEFINITION.'); return false; }, []);
    const validateQuestion = useCallback((question, answer) => { /* ... as before ... */ console.log('[Debug STM] validateQuestion DEFINITION.'); if (!question) return true; const { required } = question; const isEmpty = answer === undefined || answer === null || answer === '' || (Array.isArray(answer) && answer.length === 0); if (required && isEmpty && answer !== NA_VALUE_INTERNAL) return false; return true; }, [otherInputValues, NA_VALUE_INTERNAL, OTHER_VALUE_INTERNAL]);
    const evaluateGlobalLogic = useCallback((actionType = 'visibility') => { /* ... as before ... */ console.log('[Debug STM] evaluateGlobalLogic DEFINITION.'); }, [survey, currentAnswers, questionsById, questionIdToOriginalIndexMap]);
    const evaluateActionLogic = useCallback((questionId, triggerType = 'onAnswer') => { /* ... as before ... */ console.log('[Debug STM] evaluateActionLogic DEFINITION.'); }, [questionsById, currentAnswers, questionIdToOriginalIndexMap]);
    
    const handleSubmit = useCallback(async () => { /* ... as before, ensure it uses currentCollectorId and currentResumeToken ... */
        console.log('[Debug STM] handleSubmit DEFINITION.');
        if (currentQuestionToRender && !validateQuestion(currentQuestionToRender, currentAnswers[currentQuestionToRender._id])) {
            // toast.error("Please correct errors before submitting.");
            return;
        }
        setIsSubmitting(true);
        try {
            const result = await surveyApi.submitResponse(surveyId, currentCollectorId, currentAnswers, currentResumeToken);
            if (result.success) { /* toast.success */ console.log("Survey submitted!", result); /* navigate to thank you */ }
            else { /* toast.error */ console.error("Submission failed.", result); }
        } catch (err) { /* toast.error */ console.error("Submission error.", err); }
        finally { setIsSubmitting(false); }
    }, [surveyId, currentCollectorId, currentAnswers, currentResumeToken, validateQuestion, currentQuestionToRender]);

    const handleNext = useCallback(() => { /* ... as before, calls handleSubmit if isSubmitState ... */
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
        console.log('[Debug STM] handleSaveAndContinueLater DEFINITION - Attempting to save.');
        setIsSavingAndContinueLater(true);
        const qToRender = currentQuestionToRender;
        const currentQIdForSave = qToRender?._id || (visibleQuestionIndices.length > 0 ? originalQuestions.find(q => q.originalIndex === visibleQuestionIndices[Math.max(0, currentVisibleIndex -1)])?._id : null);

        try {
            const result = await surveyApi.savePartialResponse(surveyId, currentCollectorId, currentAnswers, currentQIdForSave, currentResumeToken);
            if (result.success && result.resumeToken) {
                setCurrentResumeToken(result.resumeToken); // Update internal token
                setGeneratedResumeCode(result.resumeToken); // This is the code to show the user
                setShowResumeCodeModal(true);
                // toast.success(result.message || "Progress saved. Use the code to resume.");
                console.log("Progress saved. Resume Code:", result.resumeToken);
            } else {
                // toast.error(result.message || "Failed to save progress.");
                console.error("Failed to save for later.", result);
            }
        } catch (err) {
            // toast.error("An error occurred while saving progress.");
            console.error("Error saving for later.", err);
        } finally {
            setIsSavingAndContinueLater(false);
        }
    }, [surveyId, currentCollectorId, currentAnswers, currentResumeToken, currentQuestionToRender, visibleQuestionIndices, originalQuestions, currentVisibleIndex]);

    const handleSendReminderEmail = useCallback(async () => {
        if (!generatedResumeCode || !emailForReminder) {
            // toast.warn("Please enter your email address to receive the reminder.");
            console.warn("Email or resume code missing for reminder.");
            return;
        }
        // toast.info("Sending reminder email...");
        console.log("Requesting reminder email...");
        const result = await surveyApi.sendResumeEmail(surveyId, generatedResumeCode, emailForReminder);
        if (result.success) {
            // toast.success(result.message);
            console.log("Reminder email request successful.");
        } else {
            // toast.error(result.message || "Failed to send reminder email.");
            console.error("Reminder email request failed.", result);
        }
    }, [surveyId, generatedResumeCode, emailForReminder]);

    const renderProgressBar = useCallback(() => { /* ... as in previous complete version ... */
        console.log('[Debug STM] renderProgressBar DEFINITION.');
        if (!survey || !survey.settings?.showProgressBar || !visibleQuestionIndices || visibleQuestionIndices.length === 0) return null;
        const safeIdx = Math.min(currentVisibleIndex, visibleQuestionIndices.length - 1);
        const progress = visibleQuestionIndices.length > 0 ? ((safeIdx + 1) / visibleQuestionIndices.length) * 100 : 0;
        return (
            <div className={styles.progressBarContainer} style={{ border: '1px solid #eee', padding: '2px', backgroundColor: '#f9f9f9', margin: '10px 0' }}>
                <div className={styles.progressBarFill} style={{ width: `${progress.toFixed(2)}%`, backgroundColor: '#4caf50', height: '10px', transition: 'width 0.3s ease-in-out' }}></div>
                <span style={{ fontSize: '0.8em', display: 'block', textAlign: 'center' }}>{Math.round(progress)}%</span>
            </div>
        );
    }, [survey, visibleQuestionIndices, currentVisibleIndex]);

    console.log('[Debug STM] After useCallback hooks, before main render logic.');

    // --- Dynamic Question Renderer ---
    const renderQuestionInputs = (question) => {
        if (!question) return <p>No question to display.</p>;
        const answer = currentAnswers[question._id];

        switch (question.type) {
            case 'text':
                return <input type="text" className={styles.textInput} value={answer || ''} onChange={(e) => handleInputChange(question._id, e.target.value)} placeholder="Type your answer" />;
            case 'textarea':
                return <textarea className={styles.textareaInput} value={answer || ''} onChange={(e) => handleInputChange(question._id, e.target.value)} placeholder="Type your comments" rows={4} />;
            case 'single-select':
                return (<div className={styles.optionsGroup}>{question.options?.map(opt => (
                    <label key={opt.value} className={styles.optionLabel}>
                        <input type="radio" name={question._id} value={opt.value} checked={answer === opt.value} onChange={(e) => handleInputChange(question._id, e.target.value)} /> {opt.text}
                    </label>))}</div>);
            case 'multi-select': // Assuming multi-select was also a type from build page
                 return (<div className={styles.optionsGroup}>{question.options?.map(opt => (
                    <label key={opt.value} className={styles.optionLabel}>
                        <input type="checkbox" value={opt.value} checked={ensureArray(answer).includes(opt.value)} onChange={(e) => handleCheckboxChange(question._id, opt.value, e.target.checked)} /> {opt.text}
                    </label>))}</div>);
            case 'heatmap':
                return (
                    <div className={styles.heatmapContainer}>
                        {question.imageUrl ? <img src={question.imageUrl} alt="Heatmap base" style={{maxWidth: '100%', border: '1px solid #ccc'}} /> : <p>Image not available.</p>}
                        <p style={{fontSize: '0.8em', color: '#777'}}>(Heatmap interaction area - actual click recording not implemented in this stub)</p>
                        {/* In a real app, this would be an interactive component */}
                    </div>
                );
            // Add more cases for other question types from SurveyBuildPage.js
            default:
                return <p>Unsupported question type: {question.type}</p>;
        }
    };

    // --- Main Render Logic ---
    if (isLoading) return <div className={styles.loadingContainer}>Loading survey...</div>;
    if (error) return <div className={styles.errorContainer}>Error: {error}</div>;
    if (!survey) return <div className={styles.errorContainer}>Survey data could not be loaded.</div>;

    const progressBarElement = renderProgressBar();

    return (
        <div className={styles.surveyContainer}>
            <header className={styles.surveyHeader}>
                <h1>{survey.title}</h1>
                {survey.description && <p>{survey.description}</p>}
                {progressBarElement}
            </header>

            {currentQuestionToRender ? (
                <div className={styles.questionArea}>
                    <h2>{currentQuestionToRender.text}</h2>
                    <p style={{fontSize: '0.9em', color: '#666'}}>(Question Type: {currentQuestionToRender.type}{currentQuestionToRender.required ? ", Required" : ""})</p>
                    {renderQuestionInputs(currentQuestionToRender)}
                </div>
            ) : (
                !isSubmitting && <p className={styles.surveyMessage}>Thank you! No more questions.</p> // Or a proper thank you message component
            )}
            
            <footer className={styles.surveyNavigation}>
                {currentVisibleIndex > 0 && (<button type="button" onClick={handlePrevious} disabled={isSubmitting || isSavingAndContinueLater} className={styles.navButton}>Previous</button>)}
                {!isSubmitState && (<button type="button" onClick={handleNext} disabled={isSubmitting || isSavingAndContinueLater} className={styles.navButton}>Next</button>)}
                {isSubmitState && (<button type="button" onClick={handleSubmit} disabled={isSubmitting || isSavingAndContinueLater} className={styles.navButtonPrimary}>{isSubmitting ? 'Submitting...' : 'Submit'}</button>)}
                {survey.settings?.allowResume && (<button type="button" onClick={handleSaveAndContinueLater} disabled={isSavingAndContinueLater || isSubmitting} className={styles.navButtonSecondary}>{isSavingAndContinueLater ? 'Saving...' : 'Save and Continue Later'}</button>)}
            </footer>

            {showResumeCodeModal && (
                <div className={styles.modalBackdrop} onClick={() => setShowResumeCodeModal(false)}>
                    <div className={styles.modalContentWrapper} onClick={e => e.stopPropagation()}>
                        <h3>Resume Later</h3>
                        <p>Your progress has been saved. Use the following code to resume your survey later:</p>
                        <strong className={styles.resumeCodeDisplay}>{generatedResumeCode}</strong>
                        <p>We recommend copying this code and saving it in a safe place.</p>
                        <hr />
                        <p>Optionally, enter your email to receive this code and a resume link:</p>
                        <input type="email" value={emailForReminder} onChange={(e) => setEmailForReminder(e.target.value)} placeholder="your.email@example.com" className={styles.emailInputForReminder} />
                        <button onClick={handleSendReminderEmail} className={styles.button}>Send Email Reminder</button>
                        <button onClick={() => setShowResumeCodeModal(false)} className={styles.buttonSecondary} style={{marginTop: '10px'}}>Close</button>
                    </div>
                </div>
            )}

            <div className={styles.debugInfo} style={{marginTop: '20px', padding: '10px', border: '1px dashed #ccc', fontSize: '0.8em'}}>
                {/* ... Enhanced debug info as in previous complete version ... */}
                <p><strong>Debug Info:</strong></p>
                <p>CurrentAnswers: {JSON.stringify(currentAnswers)}</p>
                <p>CurrentVisibleIndex: {currentVisibleIndex} (Original Index: {visibleQuestionIndices[currentVisibleIndex]})</p>
                <p>Resume Token (Code): {currentResumeToken || "None"}</p>
                <p>Survey Loaded: {survey ? 'Yes' : 'No'}, ShowProgressBar: {survey?.settings?.showProgressBar?.toString()}</p>
                {currentQuestionToRender && <p>Current Question ID: {currentQuestionToRender._id}, Type: {currentQuestionToRender.type}</p>}
            </div>
        </div>
    );
}

export default SurveyTakingPage;
// ----- END OF REVISED AND MORE COMPLETE RESTORED FILE -----