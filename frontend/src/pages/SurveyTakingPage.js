// frontend/src/pages/SurveyTakingPage.js
// ----- START OF COMPLETE MODIFIED FILE (vNext16.2 - Debugging "Loading survey..." issue) -----
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import ReCAPTCHA from "react-google-recaptcha";
import styles from './SurveyTakingPage.module.css';
import surveyApiFunctions from '../api/surveyApi';

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

const ensureArray = (value) => (Array.isArray(value) ? value : (value !== undefined && value !== null ? [value] : []));
const isAnswerEmpty = (value, questionType) => { /* ... (same as vNext16.1) ... */ return false; }; // Keep full implementation
const shuffleArray = (array) => { /* ... (same as vNext16.1) ... */ return array; }; // Keep full implementation
const toRoman = (num) => { /* ... (same as vNext16.1) ... */ return String(num); }; // Keep full implementation
const toLetters = (num) => { /* ... (same as vNext16.1) ... */ return String(num); }; // Keep full implementation
const evaluateSurveyLogic = (logicRules, answers, questions) => { /* Placeholder */ return null; };


function SurveyTakingPage() {
    const { surveyId, collectorId: routeCollectorIdentifier, resumeToken: routeResumeToken } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    // State variables (same as vNext16.1)
    const [survey, setSurvey] = useState(null);
    const [originalQuestions, setOriginalQuestions] = useState([]);
    const [currentAnswers, setCurrentAnswers] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
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

    // Memoized selectors (same as vNext16.1)
    const questionsById = useMemo(() => originalQuestions.reduce((map, q) => { if(q && q._id) map[q._id] = q; return map; }, {}), [originalQuestions]);
    const questionsInCurrentOrder = useMemo(() => (randomizedQuestionOrder.length > 0 && originalQuestions.length > 0) ? randomizedQuestionOrder.map(index => originalQuestions[index]).filter(q => q) : originalQuestions.filter(q => q), [randomizedQuestionOrder, originalQuestions]);
    const questionIdToOriginalIndexMap = useMemo(() => originalQuestions.reduce((map, q, index) => { if(q && q._id) map[q._id] = index; return map; }, {}), [originalQuestions]);
    const currentQToRenderMemoized = useMemo(() => { /* ... (with logs from vNext16.1) ... */ 
        if (isLoading || !survey || visibleQuestionIndices.length === 0 || currentVisibleIndex < 0 || currentVisibleIndex >= visibleQuestionIndices.length) {
            return null;
        }
        const currentOriginalIdx = visibleQuestionIndices[currentVisibleIndex];
        if (currentOriginalIdx === undefined || currentOriginalIdx < 0 || currentOriginalIdx >= originalQuestions.length) {
            return null;
        }
        return originalQuestions[currentOriginalIdx] || null;
    }, [isLoading, survey, visibleQuestionIndices, currentVisibleIndex, originalQuestions]);
    const isSubmitStateDerived = useMemo(() => { /* ... (same as vNext16.1) ... */ return false;}, [isLoading, survey, visibleQuestionIndices, originalQuestions, currentVisibleIndex]);
    
    // useEffect(() => { console.log(`[Debug STM] isSubmitStateDerived changed to: ${isSubmitStateDerived}, CVI: ${currentVisibleIndex}, VQI.length: ${visibleQuestionIndices.length}`); }, [isSubmitStateDerived, currentVisibleIndex, visibleQuestionIndices.length]);
    
    useEffect(() => {
        const effectiveCollectorId = location.state?.collectorIdentifier || routeCollectorIdentifier;
        // console.log(`[Debug STM] useEffect (collector/token init): routeCollectorIdentifier=${routeCollectorIdentifier}, location.state?.collectorIdentifier=${location.state?.collectorIdentifier}, effectiveCollectorId=${effectiveCollectorId}`);
        setCurrentCollectorIdentifier(effectiveCollectorId);

        const tokenFromRoute = routeResumeToken;
        const tokenFromState = location.state?.resumeToken;
        // console.log(`[Debug STM] useEffect (collector/token init): routeResumeToken=${tokenFromRoute}, location.state?.resumeToken=${tokenFromState}`);
        if (tokenFromRoute && currentResumeToken !== tokenFromRoute) {
            // console.log(`[Debug STM] Setting currentResumeToken from route: ${tokenFromRoute}`);
            setCurrentResumeToken(tokenFromRoute);
        } else if (tokenFromState && currentResumeToken !== tokenFromState) {
            // console.log(`[Debug STM] Setting currentResumeToken from location state: ${tokenFromState}`);
            setCurrentResumeToken(tokenFromState);
        }
    }, [location.state, routeCollectorIdentifier, routeResumeToken, currentResumeToken]); // Added currentResumeToken to prevent loop if it's already set


    useEffect(() => { /* ... CustomVars logic ... */ }, [survey, location.search]);

    const fetchSurvey = useCallback(async (signal) => {
        console.log('[Debug STM] fetchSurvey called.');
        setIsLoading(true);
        setError(null);
        setHiddenQuestionIds(new Set());
        setIsDisqualified(false);
        // DO NOT RESET CVI and VisitedPath here if resuming, fetchSurvey should handle it via partialResponse
        // setCurrentVisibleIndex(0); 
        // setVisitedPath([]); 
        setRecaptchaToken(null);

        if (!surveyId) {
            setError("Survey ID is missing.");
            setIsLoading(false);
            console.error('[Debug STM] fetchSurvey: Survey ID missing.');
            return;
        }
        
        // Use currentResumeToken directly as it's managed by its own useEffect now
        const effectiveTokenForAPI = currentResumeToken; 
        // console.log(`[Debug STM] fetchSurvey: Using effectiveTokenForAPI: ${effectiveTokenForAPI}, currentCollectorIdentifier: ${currentCollectorIdentifier}`);

        if (!currentCollectorIdentifier && !(location.state?.isPreviewingOwner) && !effectiveTokenForAPI) {
            setError("Collector identifier or resume token is missing for API call.");
            setIsLoading(false);
            console.error('[Debug STM] fetchSurvey: Collector ID or resume token missing for API.');
            return;
        }
        
        try {
            console.log('[Debug STM] fetchSurvey: Attempting API call.');
            const options = { forTaking: 'true', signal, collectorId: currentCollectorIdentifier, resumeToken: effectiveTokenForAPI };
            if (location.state?.isPreviewingOwner) options.isPreviewingOwner = true;
            
            const responsePayload = await surveyApiFunctions.getSurveyById(surveyId, options);
            console.log('[Debug STM] fetchSurvey: API response received:', responsePayload);

            if (!responsePayload || !responsePayload.success || !responsePayload.data) {
                const errorMsg = responsePayload?.message || "Failed to retrieve survey data.";
                if (responsePayload?.status === 410 && effectiveTokenForAPI) { 
                    setError(errorMsg + " You may need to start over or use a new link if provided."); 
                    toast.error(errorMsg); 
                } else { 
                    throw new Error(errorMsg); 
                }
                // setIsLoading(false) will be handled by finally
                return;
            }
            const surveyData = responsePayload.data;
            if (!surveyData || !Array.isArray(surveyData.questions)) {
                console.error("[Debug STM] Survey data is malformed:", surveyData);
                throw new Error("Survey data is malformed.");
            }
            
            // ... (rest of the successful data processing from vNext16.1)
            setSurvey(surveyData); // This will trigger other useEffects
            // ... (setting originalQuestions, randomization, partialResponse handling etc.)
            const fetchedQuestions = surveyData.questions || [];
            setOriginalQuestions(fetchedQuestions); // This is key for other effects
            // ... (the rest of the state setting logic from vNext16.1) ...
            if (surveyData.partialResponse) {
                console.log("[Debug STM] Resuming survey with data:", surveyData.partialResponse);
                setCurrentAnswers(surveyData.partialResponse.answers || {});
                setOtherInputValues(surveyData.partialResponse.otherInputValues || {});
                setCurrentVisibleIndex(surveyData.partialResponse.currentVisibleIndex || 0); // Set CVI from partial
                setVisitedPath(surveyData.partialResponse.visitedPath || []); // Set visitedPath from partial
                setSessionId(surveyData.partialResponse.sessionId || sessionId); 
                setSurveyStartedAt(surveyData.partialResponse.createdAt || surveyStartedAt); 
                toast.info("Survey progress resumed.");
            } else {
                 // Only reset these if not resuming
                setCurrentVisibleIndex(0);
                setVisitedPath([]);
                const initialAnswers = {}; fetchedQuestions.forEach(q => { if (q && q._id) { let da = ''; if (q.type === 'checkbox') da = []; else if (q.type === 'slider') da = String(Math.round(((q.sliderMin ?? 0) + (q.sliderMax ?? 100)) / 2)); else if (q.type === 'ranking') da = ensureArray(q.options?.map(opt => typeof opt === 'string' ? opt : (opt.text || String(opt)))); else if (q.type === 'cardsort') da = { assignments: {}, userCategories: [] }; else if (q.type === 'maxdiff') da = { best: null, worst: null }; else if (q.type === 'conjoint') da = {}; initialAnswers[q._id] = da; } }); setCurrentAnswers(initialAnswers); setOtherInputValues({});
            }
            console.log('[Debug STM] fetchSurvey: Successfully processed survey data.');

        } catch (errCatch) { 
            if (errCatch.name === 'AbortError') {
                console.log('[Debug STM] Fetch aborted by AbortController.'); 
            } else { 
                const msg = errCatch.response?.data?.message || errCatch.message || "Could not load survey."; 
                console.error('[Debug STM] fetchSurvey Error:', msg, errCatch);
                setError(msg); 
                if(msg !== "This resume link has expired." && msg !== "This survey session has already been completed.") {
                    toast.error(`Error: ${msg}`);
                }
            } 
        } finally { 
            setIsLoading(false); 
            console.log('[Debug STM] fetchSurvey finally block. isLoading set to false.');
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [surveyId, currentCollectorIdentifier, location.state?.isPreviewingOwner, sessionId, surveyStartedAt, currentResumeToken /* Removed location.state parts that are covered by currentCollectorIdentifier/currentResumeToken */]);
    
    useEffect(() => {
        console.log(`[Debug STM] useEffect (fetchSurvey trigger): currentCollectorIdentifier=${currentCollectorIdentifier}, currentResumeToken=${currentResumeToken}, isPreviewingOwner=${location.state?.isPreviewingOwner}`);
        
        const shouldFetch = currentCollectorIdentifier || currentResumeToken || location.state?.isPreviewingOwner;

        if (shouldFetch) {
            console.log('[Debug STM] useEffect: Conditions met, calling fetchSurvey.');
            const controller = new AbortController();
            fetchSurvey(controller.signal); // Call fetchSurvey
            
            const timeoutId = autoAdvanceTimeoutRef.current; 
            return () => {
                console.log('[Debug STM] useEffect: Cleanup for fetchSurvey call, aborting controller.');
                controller.abort();
                if (timeoutId) { 
                    clearTimeout(timeoutId);
                }
            };
        } else {
            // This case handles when neither collectorId nor token is available from the start.
            // Avoids calling fetchSurvey if essential identifiers are missing.
            console.log('[Debug STM] useEffect: Conditions NOT met for fetchSurvey. Setting error and isLoading false.');
            setIsLoading(false); 
            setError("Collector information or resume token is missing to load the survey.");
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fetchSurvey, currentCollectorIdentifier, currentResumeToken, location.state?.isPreviewingOwner]); // Dependencies that determine if fetch should run

    useEffect(() => { /* ... visibleQuestionIndices calculation (with logs from vNext16.1) ... */ }, [isLoading, originalQuestions, questionsInCurrentOrder, hiddenQuestionIds, questionIdToOriginalIndexMap, randomizedQuestionOrder, visibleQuestionIndices]);
    useEffect(() => { /* ... CVI boundary check logic (same as vNext16.1) ... */ }, [visibleQuestionIndices, isLoading, survey, isDisqualified, currentVisibleIndex, allowBackButton, visitedPath]);
    
    const evaluateDisabled = useCallback((questionOriginalIndex) => originalQuestions[questionOriginalIndex]?.isDisabled === true, [originalQuestions]);
    const validateQuestion = useCallback((question, answer, isSoftCheck = false, isDisabledBySetting = false) => { /* ... (same as vNext16.1) ... */ return true; }, [otherInputValues]);
    const evaluateGlobalLogic = useCallback(() => { /* ... (same as vNext16.1) ... */ return null; }, [survey, currentAnswers, originalQuestions]);
    const evaluateActionLogic = useCallback((questionOriginalIndex) => { /* ... (same as vNext16.1) ... */ return null; }, [originalQuestions, currentAnswers]);
    const handleNext = useCallback(() => { /* ... (same as vNext16.1) ... */ }, [currentVisibleIndex, visibleQuestionIndices, isDisqualified, isLoading, originalQuestions, currentAnswers, evaluateDisabled, validateQuestion, allowBackButton, evaluateGlobalLogic, evaluateActionLogic, questionIdToOriginalIndexMap]);
    const handleInputChange = useCallback((questionId, value) => { /* ... (same as vNext16.1) ... */ }, [questionsById, autoAdvanceState, handleNext, evaluateDisabled, questionIdToOriginalIndexMap, otherInputValues]);
    const handleCheckboxChange = useCallback((questionId, optionValue, isChecked) => { /* ... (same as vNext16.1) ... */ }, [questionsById]);
    const handleOtherInputChange = useCallback((questionId, textValue) => { setOtherInputValues(prev => ({ ...prev, [questionId]: textValue })); }, []);
    const renderQuestion = useCallback((questionToRenderArg) => { /* ... (with logs and checks from vNext16.1) ... */ return <div>Question Placeholder</div>; }, [currentAnswers, otherInputValues, handleInputChange, questionIdToOriginalIndexMap, handleOtherInputChange, handleCheckboxChange, randomizedOptionOrders, evaluateDisabled, qNumEnabledState, qNumFormatState, visibleQuestionIndices]);
    const handlePrevious = useCallback(() => { /* ... (same as vNext16.1) ... */ }, [isDisqualified, isLoading, visitedPath, currentVisibleIndex, visibleQuestionIndices, allowBackButton]);
    const handleSubmit = useCallback(async (e) => { /* ... (same as vNext16.1, ensure setIsSubmitting is used) ... */ }, [actualCollectorObjectId, collectorSettings, recaptchaEnabled, recaptchaToken, recaptchaSiteKey, visibleQuestionIndices, originalQuestions, evaluateDisabled, validateQuestion, currentAnswers, questionsById, otherInputValues, sessionId, surveyId, navigate, questionIdToOriginalIndexMap, surveyStartedAt, capturedCustomVars, currentResumeToken]);
    const handleSavePartialResponse = async () => { /* ... (same as vNext16.1) ... */ };
    const renderProgressBar = () => { /* ... (same as vNext16.1) ... */ return null; };

    // --- Render logic ---
    if (isLoading && !survey) { // This is the "Loading survey..." state
        console.log(`[Debug STM] Render: Stuck on "Loading survey..." (isLoading: ${isLoading}, survey: ${!!survey})`);
        return <div className={styles.loading}>Loading survey...</div>;
    }
    // ... (rest of the render logic from vNext16.1, with logs) ...
    if (error && !survey && !hasAlreadyResponded) return <div className={styles.errorContainer}><h2>Error Loading Survey</h2><p>{error}</p><button onClick={() => { console.log("[Debug STM] Retry button clicked."); const c = new AbortController(); fetchSurvey(c.signal); }} className={styles.navButton}>Retry</button></div>;
    if (!survey && !isLoading && !error && !hasAlreadyResponded) return <div className={styles.errorContainer}>Survey not found or could not be loaded (final check).</div>;
    if (isDisqualified) return ( <div className={styles.surveyContainer}><h1 className={styles.surveyTitle}>{survey?.title||'Survey'}</h1><div className={styles.disqualifiedBox}><h2>Survey Ended</h2><p>{disqualificationMessage || "You do not qualify."}</p></div></div> );

    const finalCurrentQToRender = currentQToRenderMemoized;
    const finalIsSubmitState = isSubmitStateDerived;
    const isCurrentQuestionDisabledBySetting = finalCurrentQToRender ? evaluateDisabled(questionIdToOriginalIndexMap[finalCurrentQToRender._id]) : false;
    const progressBarComponent = progressBarEnabledState ? renderProgressBar() : null;

    // console.log(`[Debug STM] FINAL RENDER STATE - finalIsSubmitState: ${finalIsSubmitState}, finalCurrentQToRender ID: ${finalCurrentQToRender ? finalCurrentQToRender._id : 'null'}, CVI: ${currentVisibleIndex}, VQI: [${visibleQuestionIndices.join(',')}]`);

    return (
        <>
            {/* ... (JSX structure from vNext16.1, ensure renderQuestion is called) ... */}
            <div className={styles.surveyContainer}>
                {progressBarPositionState === 'top' && progressBarComponent}
                <h1 className={styles.surveyTitle}>{survey?.title || 'Survey'}</h1>
                {(visitedPath.length === 0 || (visitedPath.length === 1 && currentVisibleIndex === 0 && visibleQuestionIndices.indexOf(visitedPath[0]) === 0 )) && survey?.description && <p className={styles.surveyDescription}>{survey.description}</p>}
                {error && survey && <div className={styles.submissionError}><p>Error: {error}</p></div>}
                
                {isLoading && survey ? <div className={styles.loading}>Loading question... (survey object exists but still loading)</div> : // Differentiated loading message
                    <div className={`${styles.questionBox} ${isCurrentQuestionDisabledBySetting ? styles.disabled : ''}`}>
                        {finalIsSubmitState ? ( 
                            <div className={styles.submitPrompt}> 
                                <p>End of survey.</p> 
                                <p>Click "Submit" to record responses.</p> 
                            </div> 
                        )
                        : finalCurrentQToRender ? ( 
                            renderQuestion(finalCurrentQToRender)
                        )
                        : ( originalQuestions.length > 0 && visibleQuestionIndices.length === 0 && !isDisqualified ? 
                            <div className={styles.submitPrompt}><p>No questions are currently visible based on survey logic or settings. Submit if applicable.</p></div>
                            : (isLoading ? 
                                <div className={styles.loading}>Preparing...</div> 
                                : <div className={styles.loading}>Survey appears empty or there's an issue displaying questions. (finalCurrentQToRender is null and not submit state)</div>
                              )
                          )}
                    </div>
                }
                 {/* ... rest of JSX ... */}
            </div>
        </>
    );
}

export default SurveyTakingPage;
// ----- END OF COMPLETE MODIFIED FILE (vNext16.2 - Debugging "Loading survey..." issue) -----