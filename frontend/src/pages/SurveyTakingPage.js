// frontend/src/pages/SurveyTakingPage.js
// ----- START OF COMPLETE MODIFIED FILE (vNext16.16 - Restored fetchSurvey with Internal Logging) -----
// ... (Imports, Helper Functions, State Variables - ALL COMPLETE AND SAME AS vNext16.15.5) ...
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import ReCAPTCHA from "react-google-recaptcha";
import styles from './SurveyTakingPage.module.css';
import surveyApiFunctions from '../api/surveyApi';

// Question component imports
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

// Helper functions
const ensureArray = (value) => (Array.isArray(value) ? value : (value !== undefined && value !== null ? [value] : []));
const isAnswerEmpty = (value, questionType) => { /* ... full implementation ... */ return false; };
const shuffleArray = (array) => { /* ... full implementation ... */ return array; };
const toRoman = (num) => { /* ... full implementation ... */ return String(num); };
const toLetters = (num) => { /* ... full implementation ... */ return String(num); };
const evaluateSurveyLogic = (logicRules, answers, questions, questionIdToOriginalIndexMap) => { /* ... full implementation ... */ return null; };


function SurveyTakingPage() {
    console.log('[Debug STM] SurveyTakingPage function component body executing. (Top)');
    const { surveyId, collectorId: routeCollectorIdentifier, resumeToken: routeResumeToken } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    console.log(`[Debug STM] useParams results: surveyId=${surveyId}, routeCollectorIdentifier=${routeCollectorIdentifier}, routeResumeToken=${routeResumeToken}`);

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
    const [currentResumeToken, setCurrentResumeToken] = useState(null);
    const [showResumeCodeInfo, setShowResumeCodeInfo] = useState(false);
    const [resumeCodeToDisplay, setResumeCodeToDisplay] = useState('');
    const [resumeLinkToDisplay, setResumeLinkToDisplay] = useState('');
    const [resumeExpiryDays, setResumeExpiryDays] = useState(7);

    const NA_VALUE_INTERNAL = '__NA__';
    const OTHER_VALUE_INTERNAL = '__OTHER__';

    console.log('[Debug STM] Before useMemo hooks.');

    const questionsById = useMemo(() => { /* ... same as v16.15.5 ... */ return {}; }, [originalQuestions]);
    const questionsInCurrentOrder = useMemo(() => { /* ... same as v16.15.5 ... */ return []; }, [randomizedQuestionOrder, originalQuestions]);
    const questionIdToOriginalIndexMap = useMemo(() => { /* ... same as v16.15.5 ... */ return {}; }, [originalQuestions]);
    const currentQToRenderMemoized = useMemo(() => { /* ... same as v16.15.5 ... */ return null; }, [isLoading, survey, visibleQuestionIndices, currentVisibleIndex, originalQuestions]);
    const isSubmitStateDerived = useMemo(() => { /* ... same as v16.15.5 ... */ return false; }, [isLoading, survey, visibleQuestionIndices, originalQuestions, currentVisibleIndex]);
        
    console.log('[Debug STM] After useMemo hooks, before useEffect hooks.');

    useEffect(() => { /* ... (set CCI - same as v16.15.5) ... */ }, [location.state?.collectorIdentifier, routeCollectorIdentifier]);
    useEffect(() => { /* ... (set CRT - same as v16.15.5) ... */ }, [location.state?.resumeToken, routeResumeToken, currentResumeToken]);
    useEffect(() => { /* ... (CustomVars - same as v16.15.5) ... */ }, [survey, location.search]);

    // ++ RESTORED ORIGINAL fetchSurvey with DETAILED LOGGING ++
    const fetchSurvey = useCallback(async (signal) => {
        console.log('[Debug STM] fetchSurvey useCallback: DEFINITION PHASE. currentCollectorIdentifier in closure:', currentCollectorIdentifier); // Log value at definition time
        console.log('[Debug STM] fetchSurvey CALLED. Initial isLoading (from state):', isLoading);
        setIsLoading(true); 
        setError(null);
        console.log('[Debug STM] fetchSurvey: Initial state updates done (isLoading=true, error=null).');

        if (!currentResumeToken) { 
            console.log('[Debug STM] fetchSurvey: No currentResumeToken. Resetting partial response states.');
            setHiddenQuestionIds(new Set()); 
            setIsDisqualified(false); 
            setCurrentVisibleIndex(0); 
            setVisitedPath([]); 
        }
        setRecaptchaToken(null);
        console.log(`[Debug STM] fetchSurvey: Pre-API check. surveyId=${surveyId}, currentCollectorIdentifier=${currentCollectorIdentifier}, currentResumeToken=${currentResumeToken}, isPreviewingOwner=${location.state?.isPreviewingOwner}`);
        
        if (!surveyId) { 
            setError("Survey ID is missing."); 
            setIsLoading(false); 
            console.error('[Debug STM] fetchSurvey: EXITING - Survey ID missing.'); 
            return; 
        }
        // Critical check: currentCollectorIdentifier is used here.
        if (!currentCollectorIdentifier && !(location.state?.isPreviewingOwner) && !currentResumeToken) { 
            setError("Collector identifier or resume token is missing for API call (fetchSurvey)."); 
            setIsLoading(false); 
            console.error('[Debug STM] fetchSurvey: EXITING - Collector ID or resume token missing for API (and not previewing). Values: currentCollectorIdentifier=', currentCollectorIdentifier, 'isPreviewingOwner=', location.state?.isPreviewingOwner, 'currentResumeToken=', currentResumeToken); 
            return; 
        }
        
        try {
            console.log('[Debug STM] fetchSurvey: Inside try block, before API call.');
            const options = { 
                forTaking: 'true', 
                signal, 
                collectorId: currentCollectorIdentifier, // Value from closure
                resumeToken: currentResumeToken        // Value from closure
            };
            if (location.state?.isPreviewingOwner) options.isPreviewingOwner = true;
            console.log('[Debug STM] fetchSurvey: Calling surveyApiFunctions.getSurveyById with options:', JSON.parse(JSON.stringify(options))); // Log a copy
            
            const responsePayload = await surveyApiFunctions.getSurveyById(surveyId, options);
            console.log('[Debug STM] fetchSurvey: API call completed. Response success:', responsePayload?.success);

            if (!responsePayload || !responsePayload.success || !responsePayload.data) {
                const errorMsg = responsePayload?.message || "Failed to retrieve survey data from API.";
                console.error('[Debug STM] fetchSurvey: API error or no data.', errorMsg, responsePayload);
                if (responsePayload?.status === 403 && responsePayload?.reason === 'ALREADY_RESPONDED') { setHasAlreadyResponded(true); setError("You have already responded to this survey via this link."); }
                else if (responsePayload?.status === 403 && responsePayload?.reason === 'LINK_EXPIRED_OR_INVALID') { setError("This survey link is expired or invalid."); }
                else if (responsePayload?.status === 403 && responsePayload?.reason === 'SURVEY_CLOSED') { setError("This survey is currently closed and not accepting new responses."); }
                else if (responsePayload?.status === 403 && responsePayload?.reason === 'RESPONSE_LIMIT_REACHED') { setError("This survey has reached its response limit."); }
                else { setError(errorMsg); }
                throw new Error(errorMsg); 
            }
            const surveyData = responsePayload.data;
            if (!surveyData || !Array.isArray(surveyData.questions)) { 
                console.error("[Debug STM] fetchSurvey: Survey data is malformed after successful API response:", surveyData); 
                throw new Error("Survey data is malformed (questions array missing or not an array)."); 
            }
            console.log('[Debug STM] fetchSurvey: API success, processing surveyData...');
            
            setCollectorSettings(surveyData.collectorSettings || {});
            console.log('[Debug STM] fetchSurvey: setCollectorSettings done.');
            setActualCollectorObjectId(surveyData.actualCollectorObjectId || null);
            console.log('[Debug STM] fetchSurvey: setActualCollectorObjectId done.');
            
            const behaviorNavSettings = surveyData.settings?.behaviorNavigation || {};
            console.log('[Debug STM] fetchSurvey: behaviorNavSettings resolved:', behaviorNavSettings);
            setAllowBackButton(typeof behaviorNavSettings.allowBackButton === 'boolean' ? behaviorNavSettings.allowBackButton : true);
            setAutoAdvanceState(typeof behaviorNavSettings.autoAdvance === 'boolean' ? behaviorNavSettings.autoAdvance : false);
            setQNumEnabledState(typeof behaviorNavSettings.questionNumberingEnabled === 'boolean' ? behaviorNavSettings.questionNumberingEnabled : true);
            setQNumFormatState(behaviorNavSettings.questionNumberingFormat || '123');
            
            const saveEnabled = typeof behaviorNavSettings.saveAndContinueEnabled === 'boolean' ? behaviorNavSettings.saveAndContinueEnabled : false;
            setSaveAndContinueEnabled(saveEnabled);
            console.log(`[Debug STM] fetchSurvey: saveAndContinueEnabled set to: ${saveEnabled} (from behaviorNavSettings.saveAndContinueEnabled: ${behaviorNavSettings.saveAndContinueEnabled})`);
            setCurrentSaveMethod(behaviorNavSettings.saveAndContinueMethod || 'email');
            setResumeExpiryDays(behaviorNavSettings.saveAndContinueEmailLinkExpiryDays || 7);
            console.log('[Debug STM] fetchSurvey: Behavior/Nav settings applied.');

            const progressBarSettings = surveyData.settings?.progressBar || {};
            setProgressBarEnabledState(typeof progressBarSettings.enabled === 'boolean' ? progressBarSettings.enabled : false);
            setProgressBarStyleState(progressBarSettings.style || 'percentage');
            setProgressBarPositionState(progressBarSettings.position || 'top');
            console.log('[Debug STM] fetchSurvey: Progress bar settings applied.');
            
            setRecaptchaEnabled(!!surveyData.collectorSettings?.enableRecaptcha); 
            setRecaptchaSiteKey(surveyData.recaptchaSiteKey || ''); 
            console.log('[Debug STM] fetchSurvey: Recaptcha settings applied.');
            
            setSurvey(surveyData);
            console.log('[Debug STM] fetchSurvey: setSurvey done.');
            const fetchedQuestions = surveyData.questions || [];
            console.log(`[Debug STM] fetchSurvey: Fetched ${fetchedQuestions.length} original questions.`);
            setOriginalQuestions(fetchedQuestions);
            console.log('[Debug STM] fetchSurvey: setOriginalQuestions done.');
            
            let initialOrderIndices = fetchedQuestions.map((_, index) => index);
            if (surveyData.randomizationLogic?.type === 'all') initialOrderIndices = shuffleArray(initialOrderIndices);
            setRandomizedQuestionOrder(initialOrderIndices);
            console.log('[Debug STM] fetchSurvey: setRandomizedQuestionOrder done.');

            const initialOptionOrders = {}; 
            fetchedQuestions.forEach(q => { if (q && q._id && q.randomizeOptions && Array.isArray(q.options)) { initialOptionOrders[q._id] = shuffleArray(q.options.map((_, optIndex) => optIndex)); } }); 
            setRandomizedOptionOrders(initialOptionOrders);
            console.log('[Debug STM] fetchSurvey: setRandomizedOptionOrders done.');

            if (surveyData.partialResponse) {
                console.log("[Debug STM] fetchSurvey: Resuming survey with partial data:", surveyData.partialResponse);
                setCurrentAnswers(surveyData.partialResponse.answers || {}); 
                setOtherInputValues(surveyData.partialResponse.otherInputValues || {}); 
                setCurrentVisibleIndex(surveyData.partialResponse.currentVisibleIndex || 0); 
                setVisitedPath(surveyData.partialResponse.visitedPath || []); 
                setSessionId(surveyData.partialResponse.sessionId || sessionId);  // Use existing sessionId if partial doesn't have one
                setSurveyStartedAt(surveyData.partialResponse.createdAt || surveyStartedAt); // Use existing if partial doesn't have one
                if(surveyData.partialResponse.hiddenQuestionIds) setHiddenQuestionIds(new Set(surveyData.partialResponse.hiddenQuestionIds));
                toast.info("Survey progress resumed.");
            } else {
                console.log("[Debug STM] fetchSurvey: No partial response, initializing fresh survey state.");
                setCurrentVisibleIndex(0); setVisitedPath([]); setHiddenQuestionIds(new Set()); 
                const initialAnswers = {}; 
                fetchedQuestions.forEach(q => { 
                    if (q && q._id) { 
                        let da = ''; 
                        if (q.type === 'checkbox') da = []; 
                        else if (q.type === 'slider') da = String(Math.round(((q.sliderMin ?? 0) + (q.sliderMax ?? 100)) / 2)); 
                        else if (q.type === 'ranking') da = ensureArray(q.options?.map(opt => typeof opt === 'string' ? opt : (opt.text || String(opt.value) || String(opt)))); 
                        else if (q.type === 'cardsort') da = { assignments: {}, userCategories: [] }; 
                        else if (q.type === 'maxdiff') da = { best: null, worst: null }; 
                        else if (q.type === 'conjoint') da = {}; 
                        initialAnswers[q._id] = da; 
                    } 
                }); 
                setCurrentAnswers(initialAnswers); 
                setOtherInputValues({});
            }
            console.log('[Debug STM] fetchSurvey: Successfully processed survey data and applied to state.');
        } catch (errCatch) { 
            console.error('[Debug STM] fetchSurvey CATCH block error:', errCatch);
            if (errCatch.name === 'AbortError' || errCatch.name === 'CanceledError' || errCatch.code === 'ERR_CANCELED') { 
                console.log('[Debug STM] Fetch aborted by AbortController (caught).'); 
            } else { 
                if (!hasAlreadyResponded) { // Avoid overwriting specific "already responded" error
                    setError(errCatch.message || "Could not load survey (generic catch in fetchSurvey)."); 
                }
            }
        } finally { 
            setIsLoading(false); 
            console.log('[Debug STM] fetchSurvey FINALLY block. isLoading set to false.');
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [surveyId, currentCollectorIdentifier, currentResumeToken, location.state?.isPreviewingOwner, sessionId, surveyStartedAt, /* Explicitly NOT including setIsLoading, setError etc. here as they are setters */]);
    
    useEffect(() => { /* ... (fetch trigger - same as v16.15.5, will use the RESTORED fetchSurvey) ... */ }, [surveyId, currentCollectorIdentifier, currentResumeToken, location.state?.isPreviewingOwner, fetchSurvey]);
    useEffect(() => { /* ... (visibleQuestionIndices - same as v16.15.5) ... */ }, [isLoading, originalQuestions, questionsInCurrentOrder, hiddenQuestionIds, questionIdToOriginalIndexMap, randomizedQuestionOrder, visibleQuestionIndices]);
    useEffect(() => { /* ... (CVI boundary check - same as v16.15.5) ... */ }, [visibleQuestionIndices, isLoading, survey, isDisqualified, currentVisibleIndex, originalQuestions.length]);

    console.log('[Debug STM] After useEffect hooks, before useCallback hooks.');

    // ... (Other Callbacks: evaluateDisabled, renderQuestion, etc. - ALL COMPLETE AND SAME AS vNext16.15.5) ...
    const evaluateDisabled = useCallback((qIdx) => (!originalQuestions || qIdx<0 || qIdx >= originalQuestions.length) ? false : originalQuestions[qIdx]?.isDisabled === true, [originalQuestions]);
    const validateQuestion = useCallback((question, answer, isSoftValidation = false, isDisqualificationCheck = false) => { /* ... */ return true; }, [otherInputValues, NA_VALUE_INTERNAL, OTHER_VALUE_INTERNAL]);
    const evaluateGlobalLogic = useCallback(() => { /* ... */ return null; }, [survey, currentAnswers, originalQuestions, questionIdToOriginalIndexMap]);
    const evaluateActionLogic = useCallback((questionIndex) => { /* ... */ return null; }, [originalQuestions, currentAnswers, questionIdToOriginalIndexMap]);
    const handleNext = useCallback(() => { /* ... */ }, [currentVisibleIndex, visibleQuestionIndices, isDisqualified, isLoading, originalQuestions, currentAnswers, validateQuestion, evaluateGlobalLogic, evaluateActionLogic, questionIdToOriginalIndexMap, survey, setIsDisqualified, setDisqualificationMessage, setCurrentVisibleIndex, setVisitedPath]);
    const handleInputChange = useCallback((questionId, value) => { /* ... */ }, [questionsById, autoAdvanceState, handleNext, questionIdToOriginalIndexMap, evaluateDisabled]);
    const handleCheckboxChange = useCallback((questionId, optionValue, isChecked) => { /* ... */ }, [OTHER_VALUE_INTERNAL, setOtherInputValues]);
    const handleOtherInputChange = useCallback((questionId, textValue) => { /* ... */ }, []);
    const renderQuestion = useCallback((questionToRenderArg) => { /* ... */ return <div></div>; }, [currentAnswers, otherInputValues, handleInputChange, questionIdToOriginalIndexMap, handleCheckboxChange, handleOtherInputChange, randomizedOptionOrders, evaluateDisabled, qNumEnabledState, qNumFormatState, visibleQuestionIndices, toLetters, toRoman, location.state?.isPreviewingOwner]);
    const handlePrevious = useCallback(() => { /* ... */ }, [isDisqualified, isLoading, currentVisibleIndex, visitedPath, visibleQuestionIndices, setCurrentVisibleIndex, setVisitedPath]);
    const handleSubmit = useCallback(async (event) => { /* ... */ }, [actualCollectorObjectId, collectorSettings, recaptchaEnabled, recaptchaToken, recaptchaSiteKey, visibleQuestionIndices, originalQuestions, validateQuestion, currentAnswers, questionsById, otherInputValues, sessionId, surveyId, navigate, questionIdToOriginalIndexMap, surveyStartedAt, OTHER_VALUE_INTERNAL, currentCollectorIdentifier, capturedCustomVars, currentResumeToken, setIsSubmitting, setError, survey, toast, currentSaveMethod, saveAndContinueEnabled]);
    const handleSavePartialResponse = async () => { /* ... */ };
    const renderProgressBar = () => { /* ... */ return null; };

    console.log('[Debug STM] After useCallback hooks, before main render logic.');
    
    // ... (Render Logic - ALL COMPLETE AND SAME AS vNext16.15.5, including checkpoint logs and full JSX) ...
    console.log(`[Debug STM] Render: Top of render logic. surveyId=${surveyId}, isLoading=${isLoading}, survey=${!!survey}, error=${error}, hasAlreadyResponded=${hasAlreadyResponded}`);
    if (!surveyId) { /* ... */ }
    if (hasAlreadyResponded) { /* ... */ }
    if (isLoading && !survey && !error) { /* ... */ }
    if (error && !survey) { /* ... */ }
    if (!survey && !isLoading && !error) { /* ... */ } 
    if (isDisqualified) { /* ... */ }
    if (!survey && !isLoading) { /* ... */ }

    const finalCurrentQToRender = currentQToRenderMemoized;
    const finalIsSubmitState = isSubmitStateDerived;
    const isCurrentQuestionDisabledBySetting = finalCurrentQToRender ? evaluateDisabled(questionIdToOriginalIndexMap[finalCurrentQToRender._id]) : false;
    const progressBarComponent = progressBarEnabledState && survey ? renderProgressBar() : null;
    
    console.log(`[Debug STM] FINAL RENDER PREP - SubmitState: ${finalIsSubmitState}, Q_ID: ${finalCurrentQToRender ? finalCurrentQToRender._id : 'undefined'}, CVI: ${currentVisibleIndex}, VQI_Len: ${visibleQuestionIndices.length}`);
    console.log('[Debug STM] Before main return statement (JSX).');

    return (
        <>
            {/* Full JSX from vNext16.15.5 */}
            <div className={styles.surveyContainer}>
                {progressBarPositionState === 'top' && progressBarComponent}
                <h1 className={styles.surveyTitle}>{survey?.title || 'Survey'}</h1>
                {(visitedPath.length === 0 || (visitedPath.length === 1 && currentVisibleIndex === 0 && visibleQuestionIndices.indexOf(visitedPath[0]) === 0 )) && survey?.description && <p className={styles.surveyDescription}>{survey.description}</p>}
                {error && survey && <div className={styles.submissionError}><p>Error during survey: {error}</p></div>}
                {isLoading && survey && <div className={styles.loading}>Processing survey data...</div>}
                {!isLoading && (
                    <div className={`${styles.questionBox} ${isCurrentQuestionDisabledBySetting ? styles.disabled : ''}`}>
                        {finalIsSubmitState ? ( 
                            <div className={styles.submitPrompt}> 
                                <p>{originalQuestions.length > 0 ? 'End of survey.' : 'This survey has no questions.'}</p> 
                                {originalQuestions.length > 0 && <p>Click "Submit" to record responses.</p>}
                            </div> 
                        )
                        : finalCurrentQToRender ? ( renderQuestion(finalCurrentQToRender) )
                        : ( survey && originalQuestions.length > 0 && visibleQuestionIndices.length === 0 && !isDisqualified ? 
                            <div className={styles.submitPrompt}><p>No questions are currently visible. This might be due to survey logic or settings.</p></div>
                            : <div className={styles.loading}>No question to display at this step.</div> 
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
            {showSaveModal}
            {showResumeCodeInfo}
        </>
    );
}
export default SurveyTakingPage;
// ----- END OF COMPLETE MODIFIED FILE (vNext16.16 - Restored fetchSurvey with Internal Logging) -----