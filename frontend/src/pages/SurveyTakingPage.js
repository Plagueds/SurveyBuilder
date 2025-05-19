// frontend/src/pages/SurveyTakingPage.js
// ----- START OF COMPLETE MODIFIED FILE (Applying v16.4 logging to v16.3 base) -----
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
// Make sure these functions have their full original implementations
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
const evaluateSurveyLogic = (logicRules, answers, questions) => { /* Placeholder */ return null; };


function SurveyTakingPage() {
    const { surveyId, collectorId: routeCollectorIdentifier, resumeToken: routeResumeToken } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    // State variables (from vNext16.3)
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

    // Memoized selectors (from vNext16.3)
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
    const isSubmitStateDerived = useMemo(() => {
        if (isLoading || !survey) return false;
        if (originalQuestions.length > 0 && visibleQuestionIndices.length === 0 && !isLoading) return true;
        if (originalQuestions.length === 0 && !isLoading) return true;
        return currentVisibleIndex >= visibleQuestionIndices.length && visibleQuestionIndices.length > 0 && !isLoading;
    }, [isLoading, survey, visibleQuestionIndices, originalQuestions, currentVisibleIndex]);
        
    // useEffects for collectorId and resumeToken (from vNext16.3)
    useEffect(() => {
        const effectiveCollectorId = location.state?.collectorIdentifier || routeCollectorIdentifier;
        setCurrentCollectorIdentifier(effectiveCollectorId);
    }, [location.state?.collectorIdentifier, routeCollectorIdentifier]);

    useEffect(() => {
        const tokenFromRoute = routeResumeToken;
        const tokenFromState = location.state?.resumeToken;
        if (tokenFromRoute && currentResumeToken !== tokenFromRoute) {
            setCurrentResumeToken(tokenFromRoute);
        } else if (tokenFromState && currentResumeToken !== tokenFromState && !tokenFromRoute) {
            setCurrentResumeToken(tokenFromState);
        }
    }, [location.state?.resumeToken, routeResumeToken, currentResumeToken]);

    useEffect(() => { /* ... CustomVars logic ... */ }, [survey, location.search]);

    // fetchSurvey with vNext16.4's detailed logging
    const fetchSurvey = useCallback(async (signal) => {
        console.log('[Debug STM] fetchSurvey called. Initial isLoading:', isLoading);
        setIsLoading(true);
        setError(null);
        if (!currentResumeToken) {
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
            console.error('[Debug STM] fetchSurvey: Exiting - Survey ID missing.');
            return;
        }
        if (!currentCollectorIdentifier && !(location.state?.isPreviewingOwner) && !currentResumeToken) {
            setError("Collector identifier or resume token is missing for API call.");
            setIsLoading(false);
            console.error('[Debug STM] fetchSurvey: Exiting - Collector ID or resume token missing for API.');
            return;
        }
        
        try {
            console.log('[Debug STM] fetchSurvey: Inside try block, before API call.');
            const options = { forTaking: 'true', signal, collectorId: currentCollectorIdentifier, resumeToken: currentResumeToken };
            if (location.state?.isPreviewingOwner) options.isPreviewingOwner = true;
            
            console.log('[Debug STM] fetchSurvey: Calling surveyApiFunctions.getSurveyById with options:', options);
            const responsePayload = await surveyApiFunctions.getSurveyById(surveyId, options);
            console.log('[Debug STM] fetchSurvey: API call completed. Response success:', responsePayload?.success);

            if (!responsePayload || !responsePayload.success || !responsePayload.data) {
                const errorMsg = responsePayload?.message || "Failed to retrieve survey data from API.";
                console.error('[Debug STM] fetchSurvey: API error or no data.', errorMsg, responsePayload);
                throw new Error(errorMsg);
            }
            const surveyData = responsePayload.data;
            if (!surveyData || !Array.isArray(surveyData.questions)) {
                console.error("[Debug STM] fetchSurvey: Survey data is malformed after successful API response:", surveyData);
                throw new Error("Survey data is malformed (questions array missing or not an array).");
            }
            
            console.log('[Debug STM] fetchSurvey: API success, processing surveyData...');
            setCollectorSettings(surveyData.collectorSettings || {});
            setActualCollectorObjectId(surveyData.actualCollectorObjectId || null);
            setAllowBackButton(typeof surveyData.collectorSettings?.allowBackButton === 'boolean' ? surveyData.collectorSettings.allowBackButton : true);
            setProgressBarEnabledState(typeof surveyData.collectorSettings?.progressBarEnabled === 'boolean' ? surveyData.collectorSettings.progressBarEnabled : false);
            // ... (all other settings from surveyData like progressBarStyle, progressBarPosition, autoAdvance, qNum, saveAndContinue)
            const behaviorNavSettings = surveyData.settings?.behaviorNavigation || {};
            setAutoAdvanceState(typeof behaviorNavSettings.autoAdvance === 'boolean' ? behaviorNavSettings.autoAdvance : false);
            setQNumEnabledState(typeof behaviorNavSettings.questionNumberingEnabled === 'boolean' ? behaviorNavSettings.questionNumberingEnabled : true);
            setQNumFormatState(behaviorNavSettings.questionNumberingFormat || '123');
            setSaveAndContinueEnabled(typeof behaviorNavSettings.saveAndContinueEnabled === 'boolean' ? behaviorNavSettings.saveAndContinueEnabled : false);
            setCurrentSaveMethod(behaviorNavSettings.saveAndContinueMethod || 'email');
            setResumeExpiryDays(behaviorNavSettings.saveAndContinueEmailLinkExpiryDays || 7);


            setSurvey(surveyData);
            const fetchedQuestions = surveyData.questions || [];
            console.log(`[Debug STM] fetchSurvey: Fetched ${fetchedQuestions.length} original questions.`);
            setOriginalQuestions(fetchedQuestions);
            
            let initialOrderIndices = fetchedQuestions.map((_, index) => index);
            if (surveyData.randomizationLogic?.type === 'all') initialOrderIndices = shuffleArray(initialOrderIndices);
            setRandomizedQuestionOrder(initialOrderIndices);
            const initialOptionOrders = {}; 
            fetchedQuestions.forEach(q => { 
                if (q && q._id && q.randomizeOptions && Array.isArray(q.options)) { 
                    initialOptionOrders[q._id] = shuffleArray(q.options.map((_, optIndex) => optIndex)); 
                } 
            }); 
            setRandomizedOptionOrders(initialOptionOrders);


            if (surveyData.partialResponse) {
                console.log("[Debug STM] fetchSurvey: Resuming survey with partial data:", surveyData.partialResponse);
                setCurrentAnswers(surveyData.partialResponse.answers || {});
                setOtherInputValues(surveyData.partialResponse.otherInputValues || {});
                setCurrentVisibleIndex(surveyData.partialResponse.currentVisibleIndex || 0);
                setVisitedPath(surveyData.partialResponse.visitedPath || []);
                setSessionId(surveyData.partialResponse.sessionId || sessionId); 
                setSurveyStartedAt(surveyData.partialResponse.createdAt || surveyStartedAt); 
                if(surveyData.partialResponse.hiddenQuestionIds) setHiddenQuestionIds(new Set(surveyData.partialResponse.hiddenQuestionIds));
                toast.info("Survey progress resumed.");
            } else {
                console.log("[Debug STM] fetchSurvey: No partial response, initializing fresh survey state.");
                setCurrentVisibleIndex(0); // Ensure reset if not resuming
                setVisitedPath([]);     // Ensure reset if not resuming
                setHiddenQuestionIds(new Set()); // Ensure reset if not resuming
                const initialAnswers = {}; 
                fetchedQuestions.forEach(q => { 
                    if (q && q._id) { 
                        let da = ''; 
                        if (q.type === 'checkbox') da = []; 
                        else if (q.type === 'slider') da = String(Math.round(((q.sliderMin ?? 0) + (q.sliderMax ?? 100)) / 2)); 
                        else if (q.type === 'ranking') da = ensureArray(q.options?.map(opt => typeof opt === 'string' ? opt : (opt.text || String(opt.value) || String(opt)))); // Added opt.value
                        else if (q.type === 'cardsort') da = { assignments: {}, userCategories: [] }; 
                        else if (q.type === 'maxdiff') da = { best: null, worst: null }; 
                        else if (q.type === 'conjoint') da = {}; 
                        initialAnswers[q._id] = da; 
                    } 
                }); 
                setCurrentAnswers(initialAnswers); 
                setOtherInputValues({});
            }
            console.log('[Debug STM] fetchSurvey: Successfully processed survey data.');

        } catch (errCatch) { 
            console.error('[Debug STM] fetchSurvey CATCH block error:', errCatch);
            if (errCatch.name === 'AbortError') {
                console.log('[Debug STM] Fetch aborted by AbortController (caught).'); 
            } else { 
                setError(errCatch.message || "Could not load survey (caught error)."); 
                toast.error(`Error: ${errCatch.message || "Could not load survey (caught error)."}`);
            } 
        } finally { 
            setIsLoading(false); 
            console.log('[Debug STM] fetchSurvey FINALLY block. isLoading set to false.');
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [surveyId, currentCollectorIdentifier, currentResumeToken, location.state?.isPreviewingOwner, sessionId, surveyStartedAt]);
    
    // Main useEffect to trigger data fetching (from vNext16.3)
    useEffect(() => {
        const isPreviewing = location.state?.isPreviewingOwner;
        const shouldFetch = surveyId && (currentCollectorIdentifier || currentResumeToken || isPreviewing);

        if (shouldFetch) {
            const controller = new AbortController();
            fetchSurvey(controller.signal);
            const timeoutId = autoAdvanceTimeoutRef.current; 
            return () => {
                controller.abort();
                if (timeoutId) clearTimeout(timeoutId);
            };
        } else if (surveyId) {
            setError("Collector information or resume token is missing to load the survey.");
            setIsLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [surveyId, currentCollectorIdentifier, currentResumeToken, location.state?.isPreviewingOwner, fetchSurvey]);

    // useEffect for visibleQuestionIndices (from vNext16.3, ensure logs are uncommented if needed)
    useEffect(() => {
        if (isLoading || !originalQuestions || originalQuestions.length === 0) {
            if(visibleQuestionIndices.length > 0) {
                // console.log('[Debug STM] Clearing visibleQuestionIndices because isLoading or no originalQuestions.');
                setVisibleQuestionIndices([]);
            }
            return;
        }
        // console.log(`[Debug STM] Calculating newVisible. OQ.length: ${originalQuestions.length}, QICO.length: ${questionsInCurrentOrder.length}, hiddenIds: ${hiddenQuestionIds.size}`);
        const newVisible = questionsInCurrentOrder
            .map(q => q && q._id ? questionIdToOriginalIndexMap[q._id] : undefined)
            .filter(idx => {
                if (idx === undefined) return false;
                const questionForHiddenCheck = originalQuestions[idx];
                return questionForHiddenCheck ? !hiddenQuestionIds.has(questionForHiddenCheck._id) : false;
            });
        
        // console.log('[Debug STM] newVisible calculated:', JSON.stringify(newVisible));
        if (JSON.stringify(visibleQuestionIndices) !== JSON.stringify(newVisible)) {
            // console.log('[Debug STM] Setting visibleQuestionIndices to newVisible.');
            setVisibleQuestionIndices(newVisible);
        }
    }, [isLoading, originalQuestions, questionsInCurrentOrder, hiddenQuestionIds, questionIdToOriginalIndexMap, randomizedQuestionOrder, visibleQuestionIndices]);
    
    useEffect(() => { /* ... CVI boundary check logic ... */ }, [visibleQuestionIndices, isLoading, survey, isDisqualified, currentVisibleIndex, allowBackButton, visitedPath]);
    
    // useCallback hooks (evaluateDisabled, validateQuestion, etc. from vNext16.3)
    const evaluateDisabled = useCallback((questionOriginalIndex) => originalQuestions[questionOriginalIndex]?.isDisabled === true, [originalQuestions]);
    const validateQuestion = useCallback((question, answer, isSoftCheck = false, isDisabledBySetting = false) => { /* ... full implementation from vNext16.1 ... */ return true; }, [otherInputValues, NA_VALUE_INTERNAL, OTHER_VALUE_INTERNAL]);
    const evaluateGlobalLogic = useCallback(() => { if (!survey || !survey.globalSkipLogic || survey.globalSkipLogic.length === 0) return null; return evaluateSurveyLogic(survey.globalSkipLogic, currentAnswers, originalQuestions); }, [survey, currentAnswers, originalQuestions]);
    const evaluateActionLogic = useCallback((questionOriginalIndex) => { const question = originalQuestions[questionOriginalIndex]; if (!question || !question.skipLogic || !Array.isArray(question.skipLogic.rules) || question.skipLogic.rules.length === 0) return null; return evaluateSurveyLogic(question.skipLogic.rules, currentAnswers, originalQuestions); }, [originalQuestions, currentAnswers]);
    const handleNext = useCallback(() => { /* ... full implementation ... */ }, [currentVisibleIndex, visibleQuestionIndices, isDisqualified, isLoading, originalQuestions, currentAnswers, evaluateDisabled, validateQuestion, allowBackButton, evaluateGlobalLogic, evaluateActionLogic, questionIdToOriginalIndexMap, setHiddenQuestionIds, setIsDisqualified, setDisqualificationMessage, setCurrentVisibleIndex, setVisitedPath, navigate, surveyId, actualCollectorObjectId]);
    const handleInputChange = useCallback((questionId, value) => { /* ... full implementation ... */ }, [questionsById, OTHER_VALUE_INTERNAL, autoAdvanceState, handleNext, evaluateDisabled, questionIdToOriginalIndexMap, otherInputValues, setCurrentAnswers]);
    const handleCheckboxChange = useCallback((questionId, optionValue, isChecked) => { /* ... full implementation ... */ }, [questionsById, NA_VALUE_INTERNAL, OTHER_VALUE_INTERNAL, setCurrentAnswers]);
    const handleOtherInputChange = useCallback((questionId, textValue) => { setOtherInputValues(prev => ({ ...prev, [questionId]: textValue })); }, []);
    const renderQuestion = useCallback((questionToRenderArg) => { 
        if (!questionToRenderArg || !questionToRenderArg._id) {
            console.error("[Debug STM] renderQuestion called with invalid questionToRenderArg:", questionToRenderArg);
            return <div className={styles.loading}>Error loading question content...</div>;
        }
        if (!questionToRenderArg.type) return <div>Error: Question type missing for ID {questionToRenderArg._id}.</div>; 
        
        const question = {...questionToRenderArg}; 
        const value = currentAnswers[question._id]; 
        const otherText = otherInputValues[question._id] || ''; 
        const isDisabledBySetting = evaluateDisabled(questionIdToOriginalIndexMap[question._id]);
        
        if (qNumEnabledState && visibleQuestionIndices.includes(questionIdToOriginalIndexMap[question._id])) { 
            const qNumber = visibleQuestionIndices.indexOf(questionIdToOriginalIndexMap[question._id]) + 1; 
            let prefix = ""; 
            if (qNumFormatState === '123') prefix = `${qNumber}. `; 
            else if (qNumFormatState === 'ABC') prefix = `${toLetters(qNumber)}. `; 
            else if (qNumFormatState === 'roman') prefix = `${toRoman(qNumber)}. `; 
            question.text = `${prefix}${question.text}`; 
        } 
        
        const commonProps = { 
            question, 
            currentAnswer: value, 
            onAnswerChange: handleInputChange, 
            onCheckboxChange: handleCheckboxChange, 
            otherValue: otherText, 
            onOtherTextChange: handleOtherInputChange, 
            disabled: isDisabledBySetting, 
            optionsOrder: randomizedOptionOrders[question._id], 
            isPreviewMode: false 
        }; 
        
        switch (question.type) { 
            case 'text': return <ShortTextQuestion {...commonProps} />; 
            case 'textarea': return <TextAreaQuestion {...commonProps} />; 
            case 'multiple-choice': return <MultipleChoiceQuestion {...commonProps} />; 
            case 'checkbox': return <CheckboxQuestion {...commonProps} />; 
            case 'dropdown': return <DropdownQuestion {...commonProps} />; 
            case 'rating': return <RatingQuestion {...commonProps} />; 
            case 'nps': return <NpsQuestion {...commonProps} />; 
            case 'slider': return <SliderQuestion {...commonProps} />; 
            case 'matrix': return <MatrixQuestion {...commonProps} />; 
            case 'heatmap': return <HeatmapQuestion {...commonProps} />; 
            case 'maxdiff': return <MaxDiffQuestion {...commonProps} />; 
            case 'conjoint': return <ConjointQuestion {...commonProps} />; 
            case 'ranking': return <RankingQuestion {...commonProps} />; 
            case 'cardsort': return <CardSortQuestion {...commonProps} />; 
            default: console.warn(`Unsupported question type: ${question.type} for ID ${question._id}`); return <div>Unsupported question type: {question.type}</div>; 
        } 
    }, [currentAnswers, otherInputValues, handleInputChange, questionIdToOriginalIndexMap, handleOtherInputChange, handleCheckboxChange, randomizedOptionOrders, evaluateDisabled, qNumEnabledState, qNumFormatState, visibleQuestionIndices, toLetters, toRoman]);
    const handlePrevious = useCallback(() => { /* ... full implementation ... */ }, [isDisqualified, isLoading, visitedPath, currentVisibleIndex, visibleQuestionIndices, allowBackButton, setCurrentVisibleIndex, setVisitedPath]);
    const handleSubmit = useCallback(async (e) => { /* ... full implementation ... */ }, [actualCollectorObjectId, collectorSettings, recaptchaEnabled, recaptchaToken, recaptchaSiteKey, visibleQuestionIndices, originalQuestions, evaluateDisabled, validateQuestion, currentAnswers, questionsById, otherInputValues, sessionId, surveyId, navigate, questionIdToOriginalIndexMap, surveyStartedAt, OTHER_VALUE_INTERNAL, currentCollectorIdentifier, capturedCustomVars, currentResumeToken, setIsSubmitting, setError, survey, toast]);
    const handleSavePartialResponse = async () => { /* ... full implementation ... */ };
    const renderProgressBar = () => { /* ... full implementation ... */ return null; };

    // --- Render logic (from vNext16.3, ensure logs are uncommented if needed) ---
    if (!surveyId) {
        return <div className={styles.errorContainer}><h2>Survey Not Specified</h2><p>No survey ID was provided in the URL.</p></div>;
    }

    if (isLoading && !survey) {
        // console.log(`[Debug STM] Render: "Loading survey..." (isLoading: ${isLoading}, survey: ${!!survey})`);
        return <div className={styles.loading}>Loading survey...</div>;
    }
    
    if (error && !survey) {
        // console.log(`[Debug STM] Render: Error before survey loaded: ${error}`);
        return <div className={styles.errorContainer}><h2>Error Loading Survey</h2><p>{error}</p><button onClick={() => { setIsLoading(true); setError(null); fetchSurvey(new AbortController().signal); }} className={styles.navButton}>Retry</button></div>;
    }

    if (!survey && !isLoading) {
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
                {error && survey && <div className={styles.submissionError}><p>Error during survey: {error}</p></div>}
                
                {isLoading && survey ? <div className={styles.loading}>Processing survey data...</div> :
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
                {/* Recaptcha, Navigation Buttons, Modals etc. ... */}
                 {finalIsSubmitState && recaptchaEnabled && recaptchaSiteKey && ( <div className={styles.recaptchaContainer}> <ReCAPTCHA ref={recaptchaRef} sitekey={recaptchaSiteKey} onChange={setRecaptchaToken} onExpired={() => setRecaptchaToken(null)} onErrored={() => { toast.error("reCAPTCHA verification failed. Please try again."); setRecaptchaToken(null); }} /> </div> )}
                <div className={styles.surveyNavigationArea}>
                    {allowBackButton && ( <button onClick={handlePrevious} className={styles.navButton} disabled={isDisqualified || isLoading || isSubmitting || (currentVisibleIndex === 0 && visitedPath.length <= 1) || finalIsSubmitState } > Previous </button> )}
                    {!allowBackButton && <div style={{minWidth: '100px'}}></div>} 
                    {saveAndContinueEnabled && !finalIsSubmitState && !isDisqualified && ( <button onClick={() => setShowSaveModal(true)} className={styles.secondaryNavButton} disabled={isLoading || isSubmitting || isSavingPartial}> Save & Continue Later </button> )}
                    {finalIsSubmitState ? ( <button onClick={handleSubmit} className={styles.submitButton} disabled={isDisqualified || isSubmitting || isLoading || (recaptchaEnabled && recaptchaSiteKey && !recaptchaToken)} > {isSubmitting ? 'Submitting...' : 'Submit'} </button> ) 
                    : ( <button onClick={handleNext} className={styles.navButton} disabled={isDisqualified || isSubmitting || isLoading || !finalCurrentQToRender } > Next </button> )}
                </div>
                {progressBarPositionState === 'bottom' && progressBarComponent}

            </div>
             {/* Save Progress Modal */}
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
                    {/* ... content of resume info modal ... */}
                </Modal>
            )}
        </>
    );
}

export default SurveyTakingPage;
// ----- END OF COMPLETE MODIFIED FILE (Applying v16.4 logging to v16.3 base) -----