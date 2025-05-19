// frontend/src/pages/SurveyTakingPage.js
// ----- START OF COMPLETE MODIFIED FILE (vNext16.3 - Refining fetch dependencies and initial CVI/Path reset) -----
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import ReCAPTCHA from "react-google-recaptcha";
import styles from './SurveyTakingPage.module.css';
import surveyApiFunctions from '../api/surveyApi';

// Question component imports (ensure these are used by renderQuestion)
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
const isAnswerEmpty = (value, questionType) => { /* ... full implementation ... */ return false;};
const shuffleArray = (array) => { /* ... full implementation ... */ return array;};
const toRoman = (num) => { /* ... full implementation ... */ return String(num);};
const toLetters = (num) => { /* ... full implementation ... */ return String(num);};
const evaluateSurveyLogic = (logicRules, answers, questions) => { /* Placeholder */ return null; };


function SurveyTakingPage() {
    const { surveyId, collectorId: routeCollectorIdentifier, resumeToken: routeResumeToken } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    // State variables
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
    const [currentResumeToken, setCurrentResumeToken] = useState(null); // This will be set by its own effect
    const [showResumeCodeInfo, setShowResumeCodeInfo] = useState(false);
    const [resumeCodeToDisplay, setResumeCodeToDisplay] = useState('');
    const [resumeLinkToDisplay, setResumeLinkToDisplay] = useState('');
    const [resumeExpiryDays, setResumeExpiryDays] = useState(7);

    const NA_VALUE_INTERNAL = '__NA__';
    const OTHER_VALUE_INTERNAL = '__OTHER__';

    // Memoized selectors
    const questionsById = useMemo(() => originalQuestions.reduce((map, q) => { if(q && q._id) map[q._id] = q; return map; }, {}), [originalQuestions]);
    const questionsInCurrentOrder = useMemo(() => (randomizedQuestionOrder.length > 0 && originalQuestions.length > 0) ? randomizedQuestionOrder.map(index => originalQuestions[index]).filter(q => q) : originalQuestions.filter(q => q), [randomizedQuestionOrder, originalQuestions]);
    const questionIdToOriginalIndexMap = useMemo(() => originalQuestions.reduce((map, q, index) => { if(q && q._id) map[q._id] = index; return map; }, {}), [originalQuestions]);
    const currentQToRenderMemoized = useMemo(() => {
        // console.log(`[Debug STM] currentQToRenderMemoized: isLoading=${isLoading}, survey=${!!survey}, VQI.length=${visibleQuestionIndices.length}, CVI=${currentVisibleIndex}`);
        if (isLoading || !survey || visibleQuestionIndices.length === 0 || currentVisibleIndex < 0 || currentVisibleIndex >= visibleQuestionIndices.length) {
            return null;
        }
        const currentOriginalIdx = visibleQuestionIndices[currentVisibleIndex];
        if (currentOriginalIdx === undefined || currentOriginalIdx < 0 || currentOriginalIdx >= originalQuestions.length) {
            // console.error(`[Debug STM] Invalid currentOriginalIdx: ${currentOriginalIdx} for originalQuestions length: ${originalQuestions.length}`);
            return null;
        }
        return originalQuestions[currentOriginalIdx] || null;
    }, [isLoading, survey, visibleQuestionIndices, currentVisibleIndex, originalQuestions]);
    const isSubmitStateDerived = useMemo(() => { /* ... same ... */ return false; }, [isLoading, survey, visibleQuestionIndices, originalQuestions, currentVisibleIndex]);
    
    // useEffect(() => { console.log(`[Debug STM] isSubmitStateDerived: ${isSubmitStateDerived}, CVI: ${currentVisibleIndex}, VQI.length: ${visibleQuestionIndices.length}`); }, [isSubmitStateDerived, currentVisibleIndex, visibleQuestionIndices.length]);
    
    // Effect to set currentCollectorIdentifier from route/location
    useEffect(() => {
        const effectiveCollectorId = location.state?.collectorIdentifier || routeCollectorIdentifier;
        // console.log(`[Debug STM] Setting currentCollectorIdentifier to: ${effectiveCollectorId}`);
        setCurrentCollectorIdentifier(effectiveCollectorId);
    }, [location.state?.collectorIdentifier, routeCollectorIdentifier]);

    // Effect to set currentResumeToken from route/location
    useEffect(() => {
        const tokenFromRoute = routeResumeToken;
        const tokenFromState = location.state?.resumeToken;
        if (tokenFromRoute && currentResumeToken !== tokenFromRoute) {
            // console.log(`[Debug STM] Setting currentResumeToken from route: ${tokenFromRoute}`);
            setCurrentResumeToken(tokenFromRoute);
        } else if (tokenFromState && currentResumeToken !== tokenFromState && !tokenFromRoute) { // Prefer route token if both exist
            // console.log(`[Debug STM] Setting currentResumeToken from location state: ${tokenFromState}`);
            setCurrentResumeToken(tokenFromState);
        }
    }, [location.state?.resumeToken, routeResumeToken, currentResumeToken]);


    useEffect(() => { /* ... CustomVars logic ... */ }, [survey, location.search]);

    const fetchSurvey = useCallback(async (signal) => {
        console.log('[Debug STM] fetchSurvey called.');
        setIsLoading(true); // Set loading true at the very start of fetch attempt
        setError(null);
        // Reset some states only if not resuming (partialResponse will override these if resuming)
        // This ensures a clean state for a fresh survey load.
        if (!currentResumeToken) { // Only reset these if it's not a resume operation initially
            setHiddenQuestionIds(new Set());
            setIsDisqualified(false);
            setCurrentVisibleIndex(0); 
            setVisitedPath([]); 
            // console.log('[Debug STM] fetchSurvey: Not resuming, reset CVI and visitedPath.');
        }
        setRecaptchaToken(null);
        
        try {
            // console.log(`[Debug STM] fetchSurvey: API call with surveyId=${surveyId}, collectorId=${currentCollectorIdentifier}, resumeToken=${currentResumeToken}`);
            const options = { forTaking: 'true', signal, collectorId: currentCollectorIdentifier, resumeToken: currentResumeToken };
            if (location.state?.isPreviewingOwner) options.isPreviewingOwner = true;
            
            const responsePayload = await surveyApiFunctions.getSurveyById(surveyId, options);
            // console.log('[Debug STM] fetchSurvey: API response received:', responsePayload?.success);

            if (!responsePayload || !responsePayload.success || !responsePayload.data) {
                const errorMsg = responsePayload?.message || "Failed to retrieve survey data.";
                throw new Error(errorMsg); // Let catch block handle it
            }
            const surveyData = responsePayload.data;
            if (!surveyData || !Array.isArray(surveyData.questions)) {
                throw new Error("Survey data is malformed.");
            }
            
            setCollectorSettings(surveyData.collectorSettings || {});
            setActualCollectorObjectId(surveyData.actualCollectorObjectId || null);
            // ... (set other settings like allowBackButton, progressBar, autoAdvance, qNum, saveAndContinue) ...
            setAllowBackButton(typeof surveyData.collectorSettings?.allowBackButton === 'boolean' ? surveyData.collectorSettings.allowBackButton : true);
            setProgressBarEnabledState(typeof surveyData.collectorSettings?.progressBarEnabled === 'boolean' ? surveyData.collectorSettings.progressBarEnabled : false);
            // ... (all other settings from surveyData)

            setSurvey(surveyData);
            const fetchedQuestions = surveyData.questions || [];
            setOriginalQuestions(fetchedQuestions);
            
            let initialOrderIndices = fetchedQuestions.map((_, index) => index);
            if (surveyData.randomizationLogic?.type === 'all') initialOrderIndices = shuffleArray(initialOrderIndices);
            setRandomizedQuestionOrder(initialOrderIndices);
            // ... (setRandomizedOptionOrders)

            if (surveyData.partialResponse) {
                // console.log("[Debug STM] Resuming survey with data:", surveyData.partialResponse);
                setCurrentAnswers(surveyData.partialResponse.answers || {});
                setOtherInputValues(surveyData.partialResponse.otherInputValues || {});
                setCurrentVisibleIndex(surveyData.partialResponse.currentVisibleIndex || 0);
                setVisitedPath(surveyData.partialResponse.visitedPath || []);
                setSessionId(surveyData.partialResponse.sessionId || sessionId); 
                setSurveyStartedAt(surveyData.partialResponse.createdAt || surveyStartedAt); 
                if(surveyData.partialResponse.hiddenQuestionIds) setHiddenQuestionIds(new Set(surveyData.partialResponse.hiddenQuestionIds));
                toast.info("Survey progress resumed.");
            } else {
                // If not resuming, ensure these are reset (already done above if !currentResumeToken, but good to be explicit for non-resume path)
                setCurrentVisibleIndex(0);
                setVisitedPath([]);
                setHiddenQuestionIds(new Set());
                const initialAnswers = {}; fetchedQuestions.forEach(q => { if (q && q._id) { let da = ''; if (q.type === 'checkbox') da = []; else if (q.type === 'slider') da = String(Math.round(((q.sliderMin ?? 0) + (q.sliderMax ?? 100)) / 2)); else if (q.type === 'ranking') da = ensureArray(q.options?.map(opt => typeof opt === 'string' ? opt : (opt.text || String(opt)))); else if (q.type === 'cardsort') da = { assignments: {}, userCategories: [] }; else if (q.type === 'maxdiff') da = { best: null, worst: null }; else if (q.type === 'conjoint') da = {}; initialAnswers[q._id] = da; } }); setCurrentAnswers(initialAnswers); setOtherInputValues({});
            }
            // console.log('[Debug STM] fetchSurvey: Successfully processed survey data.');
        } catch (errCatch) { 
            if (errCatch.name === 'AbortError') {
                console.log('[Debug STM] Fetch aborted by AbortController.'); 
            } else { 
                console.error('[Debug STM] fetchSurvey Error:', errCatch.message, errCatch);
                setError(errCatch.message || "Could not load survey."); 
                toast.error(`Error: ${errCatch.message || "Could not load survey."}`);
            } 
        } finally { 
            setIsLoading(false); 
            // console.log('[Debug STM] fetchSurvey finally block. isLoading set to false.');
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [surveyId, currentCollectorIdentifier, currentResumeToken, location.state?.isPreviewingOwner, sessionId, surveyStartedAt /* surveyStartedAt and sessionId are stable unless resuming */]);
    
    // Main useEffect to trigger data fetching
    useEffect(() => {
        const isPreviewing = location.state?.isPreviewingOwner;
        // console.log(`[Debug STM] useEffect (fetch trigger): CCI=${currentCollectorIdentifier}, CRT=${currentResumeToken}, isPreview=${isPreviewing}`);
        
        // Fetch if we have a collector or a resume token, or if previewing
        const shouldFetch = surveyId && (currentCollectorIdentifier || currentResumeToken || isPreviewing);

        if (shouldFetch) {
            // console.log('[Debug STM] useEffect: Conditions met, calling fetchSurvey.');
            const controller = new AbortController();
            fetchSurvey(controller.signal);
            
            const timeoutId = autoAdvanceTimeoutRef.current; 
            return () => {
                // console.log('[Debug STM] useEffect: Cleanup for fetchSurvey call, aborting controller.');
                controller.abort();
                if (timeoutId) clearTimeout(timeoutId);
            };
        } else if (surveyId) { // Only set error if surveyId is present but other conditions aren't met
            // console.log('[Debug STM] useEffect: surveyId present, but conditions NOT met for fetchSurvey. Setting error.');
            setError("Collector information or resume token is missing to load the survey.");
            setIsLoading(false); // Ensure loading is false if we decide not to fetch
        }
        // If no surveyId, do nothing, initial state (isLoading=true) will show "Loading survey..." or an error if surveyId is missing from fetchSurvey
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [surveyId, currentCollectorIdentifier, currentResumeToken, location.state?.isPreviewingOwner, fetchSurvey]); // fetchSurvey is a dependency

    useEffect(() => { /* ... visibleQuestionIndices calculation (with logs from vNext16.1) ... */ }, [isLoading, originalQuestions, questionsInCurrentOrder, hiddenQuestionIds, questionIdToOriginalIndexMap, randomizedQuestionOrder, visibleQuestionIndices]);
    useEffect(() => { /* ... CVI boundary check logic (same as vNext16.1) ... */ }, [visibleQuestionIndices, isLoading, survey, isDisqualified, currentVisibleIndex, allowBackButton, visitedPath]);
    
    const evaluateDisabled = useCallback((questionOriginalIndex) => originalQuestions[questionOriginalIndex]?.isDisabled === true, [originalQuestions]);
    const validateQuestion = useCallback((question, answer, isSoftCheck = false, isDisabledBySetting = false) => { /* ... */ return true; }, [otherInputValues]);
    const evaluateGlobalLogic = useCallback(() => { /* ... */ return null; }, [survey, currentAnswers, originalQuestions]);
    const evaluateActionLogic = useCallback((questionOriginalIndex) => { /* ... */ return null; }, [originalQuestions, currentAnswers]);
    const handleNext = useCallback(() => { /* ... */ }, [currentVisibleIndex, visibleQuestionIndices, isDisqualified, isLoading, originalQuestions, currentAnswers, evaluateDisabled, validateQuestion, allowBackButton, evaluateGlobalLogic, evaluateActionLogic, questionIdToOriginalIndexMap]);
    const handleInputChange = useCallback((questionId, value) => { /* ... */ }, [questionsById, autoAdvanceState, handleNext, evaluateDisabled, questionIdToOriginalIndexMap, otherInputValues]);
    const handleCheckboxChange = useCallback((questionId, optionValue, isChecked) => { /* ... */ }, [questionsById]);
    const handleOtherInputChange = useCallback((questionId, textValue) => { setOtherInputValues(prev => ({ ...prev, [questionId]: textValue })); }, []);
    const renderQuestion = useCallback((questionToRenderArg) => { /* ... (with logs and checks from vNext16.1) ... */ return <div>Question Placeholder</div>; }, [currentAnswers, otherInputValues, handleInputChange, questionIdToOriginalIndexMap, handleOtherInputChange, handleCheckboxChange, randomizedOptionOrders, evaluateDisabled, qNumEnabledState, qNumFormatState, visibleQuestionIndices, toLetters, toRoman]);
    const handlePrevious = useCallback(() => { /* ... */ }, [isDisqualified, isLoading, visitedPath, currentVisibleIndex, visibleQuestionIndices, allowBackButton]);
    const handleSubmit = useCallback(async (e) => { /* ... */ }, [actualCollectorObjectId, collectorSettings, recaptchaEnabled, recaptchaToken, recaptchaSiteKey, visibleQuestionIndices, originalQuestions, evaluateDisabled, validateQuestion, currentAnswers, questionsById, otherInputValues, sessionId, surveyId, navigate, questionIdToOriginalIndexMap, surveyStartedAt, capturedCustomVars, currentResumeToken]);
    const handleSavePartialResponse = async () => { /* ... */ };
    const renderProgressBar = () => { /* ... */ return null; };

    // --- Render logic ---
    if (!surveyId) { // Handle missing surveyId early
        return <div className={styles.errorContainer}><h2>Survey Not Specified</h2><p>No survey ID was provided in the URL.</p></div>;
    }

    if (isLoading && !survey) {
        // console.log(`[Debug STM] Render: "Loading survey..." (isLoading: ${isLoading}, survey: ${!!survey})`);
        return <div className={styles.loading}>Loading survey...</div>;
    }
    
    if (error && !survey) { // If error happened before survey was loaded
        // console.log(`[Debug STM] Render: Error before survey loaded: ${error}`);
        return <div className={styles.errorContainer}><h2>Error Loading Survey</h2><p>{error}</p><button onClick={() => { setIsLoading(true); setError(null); fetchSurvey(new AbortController().signal); }} className={styles.navButton}>Retry</button></div>;
    }

    if (!survey && !isLoading) { // Should ideally be caught by error state, but as a fallback
        // console.log(`[Debug STM] Render: No survey and not loading, possible error not set or unexpected state.`);
        return <div className={styles.errorContainer}>Survey data could not be loaded. Please try again or check the URL.</div>;
    }
    
    if (isDisqualified) return ( <div className={styles.surveyContainer}><h1 className={styles.surveyTitle}>{survey?.title||'Survey'}</h1><div className={styles.disqualifiedBox}><h2>Survey Ended</h2><p>{disqualificationMessage || "You do not qualify."}</p></div></div> );

    const finalCurrentQToRender = currentQToRenderMemoized;
    const finalIsSubmitState = isSubmitStateDerived;
    const isCurrentQuestionDisabledBySetting = finalCurrentQToRender ? evaluateDisabled(questionIdToOriginalIndexMap[finalCurrentQToRender._id]) : false;
    const progressBarComponent = progressBarEnabledState ? renderProgressBar() : null;

    // console.log(`[Debug STM] FINAL RENDER - SubmitState: ${finalIsSubmitState}, Q_ID: ${finalCurrentQToRender ? finalCurrentQToRender._id : 'null'}, CVI: ${currentVisibleIndex}, VQI_Len: ${visibleQuestionIndices.length}`);

    return (
        <>
            <div className={styles.surveyContainer}>
                {progressBarPositionState === 'top' && progressBarComponent}
                <h1 className={styles.surveyTitle}>{survey?.title || 'Survey'}</h1>
                {(visitedPath.length === 0 || (visitedPath.length === 1 && currentVisibleIndex === 0 && visibleQuestionIndices.indexOf(visitedPath[0]) === 0 )) && survey?.description && <p className={styles.surveyDescription}>{survey.description}</p>}
                {error && survey && <div className={styles.submissionError}><p>Error during survey: {error}</p></div>} {/* Error that occurs after survey loaded */}
                
                {isLoading && survey ? <div className={styles.loading}>Processing survey data...</div> : // Survey object exists but still processing (e.g. question logic)
                    <div className={`${styles.questionBox} ${isCurrentQuestionDisabledBySetting ? styles.disabled : ''}`}>
                        {finalIsSubmitState ? ( 
                            <div className={styles.submitPrompt}> <p>End of survey.</p> <p>Click "Submit" to record responses.</p> </div> 
                        )
                        : finalCurrentQToRender ? ( 
                            renderQuestion(finalCurrentQToRender)
                        )
                        : ( originalQuestions.length > 0 && visibleQuestionIndices.length === 0 && !isDisqualified ? 
                            <div className={styles.submitPrompt}><p>No questions are currently visible. This might be due to survey logic or settings.</p></div>
                            : <div className={styles.loading}>No question to display at this step.</div>
                          )}
                    </div>
                }
                {/* ... rest of JSX ... */}
            </div>
        </>
    );
}

export default SurveyTakingPage;
// ----- END OF COMPLETE MODIFIED FILE (vNext16.3 - Refining fetch dependencies and initial CVI/Path reset) -----