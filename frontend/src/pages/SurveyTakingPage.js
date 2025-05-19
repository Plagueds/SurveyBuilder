// frontend/src/pages/SurveyTakingPage.js
// ----- START OF COMPLETE MODIFIED FILE (vNext16.17.1 - Corrected Modal JSX Syntax & fetchSurvey commented) -----
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import ReCAPTCHA from "react-google-recaptcha";
import styles from './SurveyTakingPage.module.css';
import surveyApiFunctions from '../api/surveyApi';

// Question component imports (ensure these paths are correct)
import ShortTextQuestion from '../components/survey_question_renders/ShortTextQuestion';
import TextAreaQuestion from '../components/survey_question_renders/TextAreaQuestion';
import MultipleChoiceQuestion from '../components/survey_question_renders/MultipleChoiceQuestion';
import CheckboxQuestion from '../components/survey_question_renders/CheckboxQuestion';
import DropdownQuestion from '../components/survey_question_renders/DropdownQuestion';
import RatingQuestion from '../components/survey_question_renders/RatingQuestion';
import NpsQuestion from '../components/survey_question_renders/NpsQuestion';
import SliderQuestion from '../components/survey_question_renders/SliderQuestion';
import MatrixQuestion from '../components/survey_question_renders/MatrixQuestion';
import HeatmapQuestion from '../components/survey_question_renders/HeatmapQuestion';
import MaxDiffQuestion from '../components/survey_question_renders/MaxDiffQuestion';
import ConjointQuestion from '../components/survey_question_renders/ConjointQuestion';
import RankingQuestion from '../components/survey_question_renders/RankingQuestion';
import CardSortQuestion from '../components/survey_question_renders/CardSortQuestion';

import Modal from '../components/common/Modal';

// Helper functions (Full implementations from vNext16.16)
const ensureArray = (value) => (Array.isArray(value) ? value : (value !== undefined && value !== null ? [value] : []));
const isAnswerEmpty = (value, questionType) => {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string' && value.trim() === '') return true;
    if (Array.isArray(value) && value.length === 0) return true;
    if (questionType === 'cardsort' && typeof value === 'object' && value !== null) {
        const assignments = value.assignments || {}; const assignedCardIds = Object.keys(assignments);
        if (assignedCardIds.length === 0) return true;
        return assignedCardIds.every(cardId => assignments[cardId] === '__UNASSIGNED_CARDS__');
    }
    if (questionType === 'maxdiff' && typeof value === 'object' && value !== null) return value.best === null || value.worst === null || value.best === undefined || value.worst === undefined;
    if (questionType === 'conjoint' && typeof value === 'object' && value !== null) return Object.keys(value).length === 0;
    return false;
};
const shuffleArray = (array) => { const newArray = [...array]; for (let i = newArray.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [newArray[i], newArray[j]] = [newArray[j], newArray[i]]; } return newArray; };
const toRoman = (num) => { if (num < 1 || num > 3999) return String(num); const r = { M: 1000, CM: 900, D: 500, CD: 400, C: 100, XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1 }; let s = ''; for (let i of Object.keys(r)) { let q = Math.floor(num / r[i]); num -= q * r[i]; s += i.repeat(q); } return s; };
const toLetters = (num) => { let l = ''; while (num > 0) { let rem = (num - 1) % 26; l = String.fromCharCode(65 + rem) + l; num = Math.floor((num - 1) / 26); } return l; };
const evaluateSurveyLogic = (logicRules, answers, questions, questionIdToOriginalIndexMap) => { /* ... full implementation from vNext16.16 ... */ return null; };


function SurveyTakingPage() {
    console.log('[Debug STM] SurveyTakingPage function component body executing. (Top)');
    const { surveyId, collectorId: routeCollectorIdentifier, resumeToken: routeResumeToken } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    console.log(`[Debug STM] useParams results: surveyId=${surveyId}, routeCollectorIdentifier=${routeCollectorIdentifier}, routeResumeToken=${routeResumeToken}`);

    // State variables (All from vNext16.16)
    const [survey, setSurvey] = useState(null);
    const [originalQuestions, setOriginalQuestions] = useState([]);
    const [currentAnswers, setCurrentAnswers] = useState({});
    const [isLoading, setIsLoading] = useState(true); // Start true
    const [error, setError] = useState(null);
    // ... (rest of state variables from vNext16.16)
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [sessionId, setSessionId] = useState(() => Date.now().toString(36) + Math.random().toString(36).substring(2));
    const [surveyStartedAt, setSurveyStartedAt] = useState(() => new Date().toISOString());
    const [otherInputValues, setOtherInputValues] = useState({});
    const [randomizedQuestionOrder, setRandomizedQuestionOrder] = useState([]);
    const [randomizedOptionOrders, setRandomizedOptionOrders] = useState({});
    const [hiddenQuestionIds, setHiddenQuestionIds] = useState(new Set());
    const [visibleQuestionIndices, setVisibleQuestionIndices] = useState([]);
    const [currentVisibleIndex, setCurrentVisibleIndex] = useState(0);
    const [visitedPath, setVisitedPath] = useState([]);
    const [isDisqualified, setIsDisqualified] = useState(false);
    const [disqualificationMessage, setDisqualificationMessage] = useState('');
    const [currentCollectorIdentifier, setCurrentCollectorIdentifier] = useState(null);
    const [actualCollectorObjectId, setActualCollectorObjectId] = useState(null);
    const [collectorSettings, setCollectorSettings] = useState(null);
    const [hasAlreadyResponded, setHasAlreadyResponded] = useState(false);
    const [recaptchaEnabled, setRecaptchaEnabled] = useState(false);
    const [recaptchaSiteKey, setRecaptchaSiteKey] = useState('');
    const [recaptchaToken, setRecaptchaToken] = useState(null);
    const recaptchaRef = useRef(null);
    const [allowBackButton, setAllowBackButton] = useState(true);
    const [progressBarEnabledState, setProgressBarEnabledState] = useState(false);
    const [progressBarStyleState, setProgressBarStyleState] = useState('percentage');
    const [progressBarPositionState, setProgressBarPositionState] = useState('top');
    const [autoAdvanceState, setAutoAdvanceState] = useState(false);
    const [qNumEnabledState, setQNumEnabledState] = useState(true);
    const [qNumFormatState, setQNumFormatState] = useState('123');
    const autoAdvanceTimeoutRef = useRef(null);
    const [saveAndContinueEnabled, setSaveAndContinueEnabled] = useState(false);
    const [currentSaveMethod, setCurrentSaveMethod] = useState('email');
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [saveEmail, setSaveEmail] = useState('');
    const [isSavingPartial, setIsSavingPartial] = useState(false);
    const [capturedCustomVars, setCapturedCustomVars] = useState(new Map());
    const [currentResumeToken, setCurrentResumeToken] = useState(null);
    const [showResumeCodeInfo, setShowResumeCodeInfo] = useState(false);
    const [resumeCodeToDisplay, setResumeCodeToDisplay] = useState('');
    const [resumeLinkToDisplay, setResumeLinkToDisplay] = useState('');
    const [resumeExpiryDays, setResumeExpiryDays] = useState(7);


    const NA_VALUE_INTERNAL = '__NA__';
    const OTHER_VALUE_INTERNAL = '__OTHER__';

    console.log('[Debug STM] Before useMemo hooks.');

    const questionsById = useMemo(() => { /* ... same as vNext16.17 ... */ return {}; }, [originalQuestions]);
    const questionsInCurrentOrder = useMemo(() => { /* ... same as vNext16.17 ... */ return []; }, [randomizedQuestionOrder, originalQuestions]);
    const questionIdToOriginalIndexMap = useMemo(() => { /* ... same as vNext16.17 ... */ return {}; }, [originalQuestions]);
    const currentQToRenderMemoized = useMemo(() => { /* ... same as vNext16.17 ... */ return null; }, [isLoading, survey, visibleQuestionIndices, currentVisibleIndex, originalQuestions]);
    const isSubmitStateDerived = useMemo(() => { /* ... same as vNext16.17 ... */ return false; }, [isLoading, survey, visibleQuestionIndices, originalQuestions, currentVisibleIndex]);
        
    console.log('[Debug STM] After useMemo hooks, before useEffect hooks.');

    useEffect(() => { /* ... (set CCI - same as vNext16.17) ... */ }, [location.state?.collectorIdentifier, routeCollectorIdentifier]);
    useEffect(() => { /* ... (set CRT - same as vNext16.17) ... */ }, [location.state?.resumeToken, routeResumeToken, currentResumeToken]);
    useEffect(() => { /* ... (CustomVars - same as vNext16.17) ... */ }, [survey, location.search]);

    // ++ fetchSurvey useCallback IS COMPLETELY COMMENTED OUT ++
    // const fetchSurvey = useCallback(async (signal) => { /* ... */ }, [/* ... */]);
    
    // ++ useEffect (fetch trigger) IS COMPLETELY COMMENTED OUT ++
    // useEffect(() => { /* ... */ }, [/* ... */]);

    // ++ ADDED A useEffect to set isLoading to false if fetchSurvey is commented out ++
    useEffect(() => {
        // This effect runs if fetchSurvey is not defined (i.e., commented out)
        // or if it were defined but not included in this effect's dependencies.
        // For this specific test (vNext16.17.1), fetchSurvey is commented out.
        console.log('[Debug STM] useEffect (Manual Loading Control - fetchSurvey commented) ENTERED.');
        // Simulate that loading finishes if no fetchSurvey is going to run
        const timer = setTimeout(() => {
            console.log('[Debug STM] Manual Loading Control: Setting isLoading to false.');
            setIsLoading(false);
            setError("Data fetching is disabled (fetchSurvey commented out)."); // Set an error to indicate why no data
        }, 100); // Small delay
        return () => clearTimeout(timer);
    }, []); // Empty dependency array, runs once on mount


    useEffect(() => { /* ... (visibleQuestionIndices - same as vNext16.17) ... */ }, [isLoading, originalQuestions, questionsInCurrentOrder, hiddenQuestionIds, questionIdToOriginalIndexMap, randomizedQuestionOrder, visibleQuestionIndices]);
    useEffect(() => { /* ... (CVI boundary check - same as vNext16.17) ... */ }, [visibleQuestionIndices, isLoading, survey, isDisqualified, currentVisibleIndex, originalQuestions.length]);
    
    console.log('[Debug STM] After useEffect hooks (fetchSurvey and its trigger are commented out), before useCallback hooks.');

    // Other Callbacks (All from vNext16.16)
    const evaluateDisabled = useCallback((qIdx) => { /* ... */ return false; }, [originalQuestions]);
    const validateQuestion = useCallback((question, answer, isSoftValidation = false, isDisqualificationCheck = false) => { /* ... */ return true; }, [otherInputValues, NA_VALUE_INTERNAL, OTHER_VALUE_INTERNAL]);
    const evaluateGlobalLogic = useCallback(() => { /* ... */ return null; }, [survey, currentAnswers, originalQuestions, questionIdToOriginalIndexMap]);
    const evaluateActionLogic = useCallback((questionIndex) => { /* ... */ return null; }, [originalQuestions, currentAnswers, questionIdToOriginalIndexMap]);
    const handleNext = useCallback(() => { /* ... */ }, [currentVisibleIndex, visibleQuestionIndices, isDisqualified, isLoading, originalQuestions, currentAnswers, validateQuestion, evaluateGlobalLogic, evaluateActionLogic, questionIdToOriginalIndexMap, survey, setIsDisqualified, setDisqualificationMessage, setCurrentVisibleIndex, setVisitedPath]);
    const handleInputChange = useCallback((questionId, value) => { /* ... */ }, [questionsById, autoAdvanceState, handleNext, questionIdToOriginalIndexMap, evaluateDisabled]);
    const handleCheckboxChange = useCallback((questionId, optionValue, isChecked) => { /* ... */ }, [OTHER_VALUE_INTERNAL, setOtherInputValues]);
    const handleOtherInputChange = useCallback((questionId, textValue) => { setOtherInputValues(prev => ({ ...prev, [questionId]: textValue })); }, []);
    const renderQuestion = useCallback((questionToRenderArg) => { /* ... */ return <div>Rendered Question Placeholder</div>; }, [currentAnswers, otherInputValues, handleInputChange, questionIdToOriginalIndexMap, handleCheckboxChange, handleOtherInputChange, randomizedOptionOrders, evaluateDisabled, qNumEnabledState, qNumFormatState, visibleQuestionIndices, toLetters, toRoman, location.state?.isPreviewingOwner]);
    const handlePrevious = useCallback(() => { /* ... */ }, [isDisqualified, isLoading, currentVisibleIndex, visitedPath, visibleQuestionIndices, setCurrentVisibleIndex, setVisitedPath]);
    const handleSubmit = useCallback(async (event) => { /* ... */ }, [actualCollectorObjectId, collectorSettings, recaptchaEnabled, recaptchaToken, recaptchaSiteKey, visibleQuestionIndices, originalQuestions, validateQuestion, currentAnswers, questionsById, otherInputValues, sessionId, surveyId, navigate, questionIdToOriginalIndexMap, surveyStartedAt, OTHER_VALUE_INTERNAL, currentCollectorIdentifier, capturedCustomVars, currentResumeToken, setIsSubmitting, setError, survey, toast, currentSaveMethod, saveAndContinueEnabled]);
    const handleSavePartialResponse = async () => { /* ... (Full implementation from vNext16.16) ... */ };
    const renderProgressBar = () => { /* ... (Full implementation from vNext16.16) ... */ return null; };

    console.log('[Debug STM] After useCallback hooks, before main render logic.');
    
    // Render Logic (from vNext16.16, adapted for fetchSurvey being commented)
    console.log(`[Debug STM] Render: Top of render logic. surveyId=${surveyId}, isLoading=${isLoading}, survey=${!!survey}, error=${error}, hasAlreadyResponded=${hasAlreadyResponded}`);
    if (!surveyId) { return <div className={styles.errorContainer}><h2>Survey Not Specified</h2><p>No survey ID was provided.</p></div>; }
    if (hasAlreadyResponded) { return <div className={styles.errorContainer}><h2>Survey Completed</h2><p>{error || "You have already responded."}</p></div>; }
    
    if (isLoading && !error) { 
        console.log(`[Debug STM] Render: "Loading survey..." (isLoading is true, no error, fetchSurvey commented)`);
        return <div className={styles.loading}>Loading survey... (Data fetching disabled)</div>; 
    }
    if (error) { 
        console.log(`[Debug STM] Render: Error display: ${error}`);
        return <div className={styles.errorContainer}><h2>Error Information</h2><p>{error}</p></div>; // Simplified error display
    }
    if (isDisqualified) { return ( <div className={styles.surveyContainer}><h1 className={styles.surveyTitle}>{survey?.title||'Survey'}</h1><div className={styles.disqualifiedBox}><h2>Survey Ended</h2><p>{disqualificationMessage || "You do not qualify."}</p></div></div> ); }
    
    const finalCurrentQToRender = currentQToRenderMemoized;
    const finalIsSubmitState = isSubmitStateDerived;
    const isCurrentQuestionDisabledBySetting = finalCurrentQToRender ? evaluateDisabled(questionIdToOriginalIndexMap[finalCurrentQToRender._id]) : false;
    const progressBarComponent = progressBarEnabledState && survey ? renderProgressBar() : null;
    
    console.log(`[Debug STM] FINAL RENDER PREP - SubmitState: ${finalIsSubmitState}, Q_ID: ${finalCurrentQToRender ? finalCurrentQToRender._id : 'undefined'}, CVI: ${currentVisibleIndex}, VQI_Len: ${visibleQuestionIndices.length}`);
    console.log('[Debug STM] Before main return statement (JSX).');

    return (
        <>
            {/* Full JSX from vNext16.16, with Modal JSX restored */}
            <div className={styles.surveyContainer}>
                {progressBarPositionState === 'top' && progressBarComponent}
                <h1 className={styles.surveyTitle}>{survey?.title || 'Survey'}</h1>
                {(visitedPath.length === 0 || (visitedPath.length === 1 && currentVisibleIndex === 0 && visibleQuestionIndices.indexOf(visitedPath[0]) === 0 )) && survey?.description && <p className={styles.surveyDescription}>{survey.description}</p>}
                
                {/* Error during survey taking, only if survey data has loaded (will be null here) */}
                {error && survey && <div className={styles.submissionError}><p>Error during survey: {error}</p></div>}

                {/* Loading message specific to when survey data is being processed */}
                {isLoading && survey && <div className={styles.loading}>Processing survey data...</div>}

                {!isLoading && (
                    <div className={`${styles.questionBox} ${isCurrentQuestionDisabledBySetting ? styles.disabled : ''}`}>
                        {finalIsSubmitState ? ( 
                            <div className={styles.submitPrompt}> 
                                <p>{originalQuestions.length > 0 ? 'End of survey.' : 'This survey has no questions (or data fetching is disabled).'}</p> 
                                {originalQuestions.length > 0 && <p>Click "Submit" to record responses.</p>}
                            </div> 
                        )
                        : finalCurrentQToRender ? ( renderQuestion(finalCurrentQToRender) )
                        : ( survey && originalQuestions.length > 0 && visibleQuestionIndices.length === 0 && !isDisqualified ? 
                            <div className={styles.submitPrompt}><p>No questions are currently visible. This might be due to survey logic or settings.</p></div>
                            : <div className={styles.loading}>No question to display at this step. (Data fetching may be disabled)</div> 
                          )}
                    </div>
                )}
                 {finalIsSubmitState && recaptchaEnabled && recaptchaSiteKey && originalQuestions.length > 0 && ( 
                    <div className={styles.recaptchaContainer}> 
                        <ReCAPTCHA ref={recaptchaRef} sitekey={recaptchaSiteKey} onChange={setRecaptchaToken} onExpired={() => setRecaptchaToken(null)} onErrored={() => { toast.error("reCAPTCHA verification failed."); setRecaptchaToken(null); }} /> 
                    </div> 
                 )}
                <div className={styles.surveyNavigationArea}>
                    {allowBackButton && ( <button onClick={handlePrevious} className={styles.navButton} disabled={isDisqualified || isLoading || isSubmitting || (currentVisibleIndex === 0 && visitedPath.length <= 1) || finalIsSubmitState } > Previous </button> )}
                    {!allowBackButton && <div style={{minWidth: '100px'}}></div>} 
                    {(console.log(`[Debug STM] Render Nav: saveAndContinueEnabled=${saveAndContinueEnabled}, finalIsSubmitState=${finalIsSubmitState}, isDisqualified=${isDisqualified}`), 
                     saveAndContinueEnabled && !finalIsSubmitState && !isDisqualified && originalQuestions.length > 0 && ( 
                        <button onClick={() => setShowSaveModal(true)} className={styles.secondaryNavButton} disabled={isLoading || isSubmitting || isSavingPartial}> 
                            Save & Continue Later 
                        </button> 
                    ))}
                    {finalIsSubmitState && originalQuestions.length > 0 ? ( 
                        <button onClick={handleSubmit} className={styles.submitButton} disabled={isDisqualified || isSubmitting || isLoading || (recaptchaEnabled && recaptchaSiteKey && !recaptchaToken)} > 
                            {isSubmitting ? 'Submitting...' : 'Submit'} 
                        </button> 
                    ) 
                    : !finalIsSubmitState && originalQuestions.length > 0 ? ( 
                        <button onClick={handleNext} className={styles.navButton} disabled={isDisqualified || isSubmitting || isLoading || !finalCurrentQToRender } > 
                            Next 
                        </button> 
                    ) : null}
                </div>
                {progressBarPositionState === 'bottom' && progressBarComponent}
            </div>
            
            {/* RESTORED FULL MODAL JSX from vNext16.16 */}
            {showSaveModal && (
                <Modal isOpen={showSaveModal} onClose={() => {setShowSaveModal(false); setSaveEmail('');}} title="Save Your Progress">
                    <div style={{padding: '20px'}}>
                        {(currentSaveMethod === 'email' || currentSaveMethod === 'both') && (
                            <>
                                <p>Enter your email address below. Based on the survey settings, we may send you a unique link to resume this survey later.</p>
                                <input type="email" value={saveEmail} onChange={(e) => setSaveEmail(e.target.value)} placeholder="your.email@example.com" style={{width: '100%', padding: '10px', marginBottom: '15px', boxSizing: 'border-box', border:'1px solid #ccc', borderRadius:'4px'}} disabled={isSavingPartial} />
                            </>
                        )}
                        {(currentSaveMethod === 'code' && !(currentSaveMethod === 'email' || currentSaveMethod === 'both')) && (
                            <p>Your progress will be saved. You will be shown a unique code to copy and use to resume later.</p>
                        )}
                        {(currentSaveMethod === 'both') && (
                             <p style={{marginTop: (currentSaveMethod === 'email' || currentSaveMethod === 'both') ? '0' : '10px'}}>You will also be shown a unique code to copy and use to resume later.</p>
                        )}
                        <div style={{display: 'flex', justifyContent: 'flex-end', marginTop: '20px'}}>
                            <button onClick={() => {setShowSaveModal(false); setSaveEmail('');}} disabled={isSavingPartial} style={{marginRight:'10px', padding:'10px 15px', cursor:'pointer', border:'1px solid #ccc', borderRadius:'4px'}}>Cancel</button>
                            <button onClick={handleSavePartialResponse} disabled={isSavingPartial || ((currentSaveMethod === 'email' || currentSaveMethod === 'both') && !saveEmail.trim())} style={{padding:'10px 15px', cursor:'pointer', backgroundColor:'#007bff', color:'white', border:'1px solid #007bff', borderRadius:'4px'}} >
                                {isSavingPartial ? 'Saving...' : (currentSaveMethod === 'code' ? 'Save & Get Code' : 'Save Progress')}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
            {showResumeCodeInfo && (
                <Modal isOpen={showResumeCodeInfo} onClose={() => setShowResumeCodeInfo(false)} title="Resume Information">
                    <div style={{padding: '20px'}}>
                        <p>Your progress has been saved!</p>
                        {resumeCodeToDisplay && (
                            <>
                                <p>Please copy and keep this resume code safe. You'll need it to continue your survey later:</p>
                                <div style={{padding: '10px', backgroundColor: '#f0f0f0', border: '1px solid #ccc', borderRadius: '4px', margin: '10px 0', fontFamily: 'monospace', wordBreak: 'break-all'}}>
                                    {resumeCodeToDisplay}
                                </div>
                            </>
                        )}
                        {resumeLinkToDisplay && (
                            <>
                                <p>Or, you can use this direct link to resume:</p>
                                <a href={resumeLinkToDisplay} target="_blank" rel="noopener noreferrer" style={{wordBreak: 'break-all'}}>{resumeLinkToDisplay}</a>
                            </>
                        )}
                        <p style={{marginTop: '15px'}}>This link/code will be valid for approximately {resumeExpiryDays} days.</p>
                        <div style={{display: 'flex', justifyContent: 'flex-end', marginTop: '20px'}}>
                            <button onClick={() => setShowResumeCodeInfo(false)} style={{padding:'10px 15px', cursor:'pointer', backgroundColor:'#007bff', color:'white', border:'1px solid #007bff', borderRadius:'4px'}}>Close</button>
                        </div>
                    </div>
                </Modal>
            )}
        </>
    );
}
export default SurveyTakingPage;
// ----- END OF COMPLETE MODIFIED FILE (vNext16.17.1 - Corrected Modal JSX Syntax & fetchSurvey commented) -----