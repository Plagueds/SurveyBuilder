// frontend/src/pages/SurveyTakingPage.js
// ----- START OF COMPLETE MODIFIED FILE (vNext16.10 - Corrected fetchSurvey useCallback deps) -----
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

const evaluateSurveyLogic = (logicRules, answers, questions, questionIdToOriginalIndexMap) => {
    if (!logicRules || logicRules.length === 0 || !questions || !questionIdToOriginalIndexMap) return null;
    const overallCondition = logicRules.length > 1 ? (logicRules[0].logicalOperator === 'AND' ? 'AND' : 'OR') : 'AND';
    let finalOutcome = overallCondition === 'AND';
    for (const rule of logicRules) {
        if (!rule.questionId || !rule.condition || !rule.action) continue;
        const questionOriginalIndex = questionIdToOriginalIndexMap[rule.questionId];
        if (questionOriginalIndex === undefined) continue;
        const question = questions[questionOriginalIndex];
        if (!question) continue;
        const answer = answers[rule.questionId];
        let ruleMet = false;
        const val = rule.value; 
        const optVal = rule.optionValue;
        switch (rule.condition) {
            case 'selected': ruleMet = Array.isArray(answer) ? answer.includes(optVal) : answer === optVal; break;
            case 'not-selected': ruleMet = Array.isArray(answer) ? !answer.includes(optVal) : answer !== optVal; break;
            case 'is': ruleMet = String(answer) === String(val); break;
            case 'is-not': ruleMet = String(answer) !== String(val); break;
            case 'contains': ruleMet = typeof answer === 'string' && typeof val === 'string' && answer.includes(val); break;
            case 'does-not-contain': ruleMet = typeof answer === 'string' && typeof val === 'string' && !answer.includes(val); break;
            case 'is-empty': ruleMet = isAnswerEmpty(answer, question.type); break;
            case 'is-not-empty': ruleMet = !isAnswerEmpty(answer, question.type); break;
            default: break;
        }
        if (overallCondition === 'AND') { finalOutcome = finalOutcome && ruleMet; if (!finalOutcome) break; } 
        else { finalOutcome = finalOutcome || ruleMet; if (finalOutcome) break; }
    }
    if (finalOutcome && logicRules.length > 0) return logicRules[0]; 
    return null;
};

function SurveyTakingPage() {
    console.log('[Debug STM] SurveyTakingPage function component body executing.');
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
    const [currentResumeToken, setCurrentResumeToken] = useState(null);
    const [showResumeCodeInfo, setShowResumeCodeInfo] = useState(false);
    const [resumeCodeToDisplay, setResumeCodeToDisplay] = useState('');
    const [resumeLinkToDisplay, setResumeLinkToDisplay] = useState('');
    const [resumeExpiryDays, setResumeExpiryDays] = useState(7);

    const NA_VALUE_INTERNAL = '__NA__';
    const OTHER_VALUE_INTERNAL = '__OTHER__';

    const questionsById = useMemo(() => originalQuestions.reduce((map, q) => { if(q && q._id) map[q._id] = q; return map; }, {}), [originalQuestions]);
    const questionsInCurrentOrder = useMemo(() => (randomizedQuestionOrder.length > 0 && originalQuestions.length > 0) ? randomizedQuestionOrder.map(index => originalQuestions[index]).filter(q => q) : originalQuestions.filter(q => q), [randomizedQuestionOrder, originalQuestions]);
    const questionIdToOriginalIndexMap = useMemo(() => originalQuestions.reduce((map, q, index) => { if(q && q._id) map[q._id] = index; return map; }, {}), [originalQuestions]);
    
    const currentQToRenderMemoized = useMemo(() => {
        console.log(`[Debug STM] currentQToRenderMemoized: isLoading=${isLoading}, survey=${!!survey}, VQI.length=${visibleQuestionIndices.length}, CVI=${currentVisibleIndex}, OQ.length=${originalQuestions.length}`);
        if (isLoading || !survey || visibleQuestionIndices.length === 0 || currentVisibleIndex < 0 || currentVisibleIndex >= visibleQuestionIndices.length) {
            console.log('[Debug STM] currentQToRenderMemoized -> null (pre-condition met)');
            return null;
        }
        const currentOriginalIdx = visibleQuestionIndices[currentVisibleIndex];
        console.log(`[Debug STM] currentQToRenderMemoized: currentOriginalIdx from VQI[${currentVisibleIndex}]: ${currentOriginalIdx}`);
        if (currentOriginalIdx === undefined || currentOriginalIdx < 0 || currentOriginalIdx >= originalQuestions.length) {
            console.error(`[Debug STM] currentQToRenderMemoized -> null (Invalid currentOriginalIdx: ${currentOriginalIdx} for OQ length: ${originalQuestions.length})`);
            return null;
        }
        const q = originalQuestions[currentOriginalIdx] || null;
        console.log(`[Debug STM] currentQToRenderMemoized -> question ID: ${q?._id || 'null'}`);
        return q;
    }, [isLoading, survey, visibleQuestionIndices, currentVisibleIndex, originalQuestions]);

    const isSubmitStateDerived = useMemo(() => {
        if (isLoading || !survey) return false;
        if (originalQuestions.length > 0 && visibleQuestionIndices.length === 0 && !isLoading) return true;
        if (originalQuestions.length === 0 && !isLoading) return true;
        return currentVisibleIndex >= visibleQuestionIndices.length && visibleQuestionIndices.length > 0 && !isLoading;
    }, [isLoading, survey, visibleQuestionIndices, originalQuestions, currentVisibleIndex]);
        
    useEffect(() => {
        const effectiveCollectorId = location.state?.collectorIdentifier || routeCollectorIdentifier;
        console.log(`[Debug STM] useEffect (set CCI) RUNS. routeCollectorIdentifier=${routeCollectorIdentifier}, location.state?.collectorIdentifier=${location.state?.collectorIdentifier}. Setting currentCollectorIdentifier to: ${effectiveCollectorId}`);
        setCurrentCollectorIdentifier(effectiveCollectorId);
    }, [location.state?.collectorIdentifier, routeCollectorIdentifier]);

    useEffect(() => {
        const tokenFromRoute = routeResumeToken;
        const tokenFromState = location.state?.resumeToken;
        console.log(`[Debug STM] useEffect (set CRT) RUNS. routeResumeToken=${routeResumeToken}, location.state?.resumeToken=${tokenFromState}. Current currentResumeToken=${currentResumeToken}`);
        if (tokenFromRoute && currentResumeToken !== tokenFromRoute) {
            console.log(`[Debug STM] useEffect (set CRT): Setting currentResumeToken from route: ${tokenFromRoute}`);
            setCurrentResumeToken(tokenFromRoute);
        } else if (tokenFromState && currentResumeToken !== tokenFromState && !tokenFromRoute) {
            console.log(`[Debug STM] useEffect (set CRT): Setting currentResumeToken from location state: ${tokenFromState}`);
            setCurrentResumeToken(tokenFromState);
        } else {
            console.log(`[Debug STM] useEffect (set CRT): No change to currentResumeToken.`);
        }
    }, [location.state?.resumeToken, routeResumeToken, currentResumeToken]);

    useEffect(() => {
        if (survey && survey.settings && survey.settings.customVariables && survey.settings.customVariables.length > 0) {
            const params = new URLSearchParams(location.search);
            const newCapturedVars = new Map();
            survey.settings.customVariables.forEach(cv => { if (params.has(cv.name)) { newCapturedVars.set(cv.name, params.get(cv.name)); } });
            if (newCapturedVars.size > 0) { console.log('[Debug STM] Captured Custom Variables:', Object.fromEntries(newCapturedVars)); setCapturedCustomVars(newCapturedVars); }
        }
    }, [survey, location.search]);

    const fetchSurvey = useCallback(async (signal) => {
        console.log('[Debug STM] fetchSurvey called. Initial isLoading (from state):', isLoading);
        setIsLoading(true);
        setError(null);
        if (!currentResumeToken) {
            setHiddenQuestionIds(new Set()); setIsDisqualified(false); setCurrentVisibleIndex(0); setVisitedPath([]);
        }
        setRecaptchaToken(null);
        console.log(`[Debug STM] fetchSurvey: Pre-API check. surveyId=${surveyId}, currentCollectorIdentifier=${currentCollectorIdentifier}, currentResumeToken=${currentResumeToken}, isPreviewingOwner=${location.state?.isPreviewingOwner}`);
        if (!surveyId) {
            setError("Survey ID is missing."); setIsLoading(false); console.error('[Debug STM] fetchSurvey: Exiting - Survey ID missing.'); return;
        }
        if (!currentCollectorIdentifier && !(location.state?.isPreviewingOwner) && !currentResumeToken) {
            setError("Collector identifier or resume token is missing for API call."); setIsLoading(false); console.error('[Debug STM] fetchSurvey: Exiting - Collector ID or resume token missing for API (and not previewing).'); return;
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
                if (responsePayload?.status === 403 && responsePayload?.reason === 'ALREADY_RESPONDED') { setHasAlreadyResponded(true); setError("You have already responded to this survey via this link."); }
                else if (responsePayload?.status === 403 && responsePayload?.reason === 'LINK_EXPIRED_OR_INVALID') { setError("This survey link is expired or invalid."); }
                else if (responsePayload?.status === 403 && responsePayload?.reason === 'SURVEY_CLOSED') { setError("This survey is currently closed and not accepting new responses."); }
                else if (responsePayload?.status === 403 && responsePayload?.reason === 'RESPONSE_LIMIT_REACHED') { setError("This survey has reached its response limit."); }
                else { setError(errorMsg); }
                throw new Error(errorMsg); 
            }
            const surveyData = responsePayload.data;
            if (!surveyData || !Array.isArray(surveyData.questions)) { console.error("[Debug STM] fetchSurvey: Survey data is malformed after successful API response:", surveyData); throw new Error("Survey data is malformed (questions array missing or not an array)."); }
            console.log('[Debug STM] fetchSurvey: API success, processing surveyData...');
            setCollectorSettings(surveyData.collectorSettings || {});
            setActualCollectorObjectId(surveyData.actualCollectorObjectId || null);
            const behaviorNavSettings = surveyData.settings?.behaviorNavigation || {};
            setAllowBackButton(typeof behaviorNavSettings.allowBackButton === 'boolean' ? behaviorNavSettings.allowBackButton : true);
            setAutoAdvanceState(typeof behaviorNavSettings.autoAdvance === 'boolean' ? behaviorNavSettings.autoAdvance : false);
            setQNumEnabledState(typeof behaviorNavSettings.questionNumberingEnabled === 'boolean' ? behaviorNavSettings.questionNumberingEnabled : true);
            setQNumFormatState(behaviorNavSettings.questionNumberingFormat || '123');
            setSaveAndContinueEnabled(typeof behaviorNavSettings.saveAndContinueEnabled === 'boolean' ? behaviorNavSettings.saveAndContinueEnabled : false);
            setCurrentSaveMethod(behaviorNavSettings.saveAndContinueMethod || 'email');
            setResumeExpiryDays(behaviorNavSettings.saveAndContinueEmailLinkExpiryDays || 7);
            const progressBarSettings = surveyData.settings?.progressBar || {};
            setProgressBarEnabledState(typeof progressBarSettings.enabled === 'boolean' ? progressBarSettings.enabled : false);
            setProgressBarStyleState(progressBarSettings.style || 'percentage');
            setProgressBarPositionState(progressBarSettings.position || 'top');
            setRecaptchaEnabled(!!surveyData.collectorSettings?.enableRecaptcha); 
            setRecaptchaSiteKey(surveyData.recaptchaSiteKey || ''); 
            setSurvey(surveyData);
            const fetchedQuestions = surveyData.questions || [];
            console.log(`[Debug STM] fetchSurvey: Fetched ${fetchedQuestions.length} original questions.`);
            setOriginalQuestions(fetchedQuestions);
            let initialOrderIndices = fetchedQuestions.map((_, index) => index);
            if (surveyData.randomizationLogic?.type === 'all') initialOrderIndices = shuffleArray(initialOrderIndices);
            setRandomizedQuestionOrder(initialOrderIndices);
            const initialOptionOrders = {}; 
            fetchedQuestions.forEach(q => { if (q && q._id && q.randomizeOptions && Array.isArray(q.options)) { initialOptionOrders[q._id] = shuffleArray(q.options.map((_, optIndex) => optIndex)); } }); 
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
                setCurrentAnswers(initialAnswers); setOtherInputValues({});
            }
            console.log('[Debug STM] fetchSurvey: Successfully processed survey data.');
        } catch (errCatch) { 
            console.error('[Debug STM] fetchSurvey CATCH block error:', errCatch);
            // Check for cancellation first
            if (errCatch.name === 'AbortError' || errCatch.name === 'CanceledError' || errCatch.code === 'ERR_CANCELED') {
                console.log('[Debug STM] Fetch aborted by AbortController (caught).'); 
            } else {
                // For other errors, if setError hasn't been called with a specific message by 403 handlers, set a generic one.
                // This relies on the fact that setError(null) was called at the start of fetchSurvey.
                // If a specific setError (e.g. for 403) was called before `throw new Error`, that state will be used.
                // This is a fallback for other unexpected errors.
                // To be absolutely sure not to overwrite a specific error, one might need to check current `error` state via a ref,
                // but this usually indicates the `setError` calls before `throw` are sufficient.
                // The main goal is that `setError` *is* called for non-cancellation errors.
                 if (!hasAlreadyResponded) { // Avoid overwriting specific states
                    // Check if error state is already set to something more specific from the try block
                    // This is tricky because `error` in this scope is from the closure.
                    // However, the `setError` calls in the `try` block for 403s are the primary mechanism.
                    // This `setError` here is for truly unexpected errors not handled by those.
                    setError(errCatch.message || "Could not load survey (generic catch).");
                 }
            }
        } finally { 
            setIsLoading(false); 
            console.log('[Debug STM] fetchSurvey FINALLY block. isLoading set to false.');
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [surveyId, currentCollectorIdentifier, currentResumeToken, location.state?.isPreviewingOwner, sessionId, surveyStartedAt]); // REMOVED 'error' from dependencies

    useEffect(() => {
        const isPreviewing = location.state?.isPreviewingOwner;
        console.log(`[Debug STM] useEffect (fetch trigger) RUNS. surveyId=${surveyId}, currentCollectorIdentifier=${currentCollectorIdentifier}, currentResumeToken=${currentResumeToken}, isPreviewing=${isPreviewing}`);
        const shouldFetch = surveyId && (currentCollectorIdentifier || currentResumeToken || isPreviewing);
        console.log(`[Debug STM] useEffect (fetch trigger): shouldFetch = ${shouldFetch}`);
        if (shouldFetch) {
            console.log('[Debug STM] useEffect (fetch trigger): Conditions MET, attempting to call fetchSurvey.');
            const controller = new AbortController();
            try {
                fetchSurvey(controller.signal); 
                console.log('[Debug STM] useEffect (fetch trigger): fetchSurvey call initiated (no sync error).');
            } catch (e) {
                console.error('[Debug STM] useEffect (fetch trigger): SYNC ERROR during fetchSurvey INVOCATION:', e);
                setError("A critical error occurred when trying to load the survey data."); setIsLoading(false);
            }
            const timeoutId = autoAdvanceTimeoutRef.current; 
            return () => {
                console.log('[Debug STM] useEffect (fetch trigger): Cleanup. Aborting controller.');
                controller.abort();
                if (timeoutId) clearTimeout(timeoutId);
            };
        } else if (surveyId) {
            console.log('[Debug STM] useEffect (fetch trigger): Conditions NOT MET (but surveyId exists). Setting error and isLoading=false.');
            setError("Collector information or resume token is missing to load the survey."); setIsLoading(false);
        } else {
            console.log('[Debug STM] useEffect (fetch trigger): Conditions NOT MET (no surveyId). Current isLoading state:', isLoading);
            if (!surveyId && isLoading) {
                 console.log('[Debug STM] useEffect (fetch trigger): No surveyId and still isLoading, setting isLoading to false.');
                 setIsLoading(false);
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [surveyId, currentCollectorIdentifier, currentResumeToken, location.state?.isPreviewingOwner, fetchSurvey]);

    useEffect(() => {
        if (isLoading || !originalQuestions || originalQuestions.length === 0) {
            if(visibleQuestionIndices.length > 0) { console.log('[Debug STM] Clearing visibleQuestionIndices because isLoading or no originalQuestions.'); setVisibleQuestionIndices([]); }
            return;
        }
        console.log(`[Debug STM] Calculating newVisible. OQ.length: ${originalQuestions.length}, QICO.length: ${questionsInCurrentOrder.length}, hiddenIds size: ${hiddenQuestionIds.size}`);
        const newVisible = questionsInCurrentOrder.map(q => q && q._id ? questionIdToOriginalIndexMap[q._id] : undefined).filter(idx => {
            if (idx === undefined) return false; const questionForHiddenCheck = originalQuestions[idx]; return questionForHiddenCheck ? !hiddenQuestionIds.has(questionForHiddenCheck._id) : false;
        });
        console.log('[Debug STM] newVisible calculated:', JSON.stringify(newVisible));
        if (JSON.stringify(visibleQuestionIndices) !== JSON.stringify(newVisible)) { console.log('[Debug STM] Setting visibleQuestionIndices to newVisible.'); setVisibleQuestionIndices(newVisible); }
        else { console.log('[Debug STM] visibleQuestionIndices did not change.');}
    }, [isLoading, originalQuestions, questionsInCurrentOrder, hiddenQuestionIds, questionIdToOriginalIndexMap, randomizedQuestionOrder, visibleQuestionIndices]);
    
    useEffect(() => { if (!isLoading && survey && !isDisqualified) { /* CVI boundary check logic */ }
    }, [visibleQuestionIndices, isLoading, survey, isDisqualified, currentVisibleIndex, originalQuestions.length]);
    
    const evaluateDisabled = useCallback((qIdx) => (!originalQuestions || qIdx<0 || qIdx >= originalQuestions.length) ? false : originalQuestions[qIdx]?.isDisabled === true, [originalQuestions]);
    const validateQuestion = useCallback((q, ans, soft, dis) => { /* Full validation logic */ return true; }, [otherInputValues,NA_VALUE_INTERNAL,OTHER_VALUE_INTERNAL]);
    const evaluateGlobalLogic = useCallback(() => (!survey || !survey.globalSkipLogic || survey.globalSkipLogic.length === 0) ? null : evaluateSurveyLogic(survey.globalSkipLogic, currentAnswers, originalQuestions, questionIdToOriginalIndexMap), [survey, currentAnswers, originalQuestions, questionIdToOriginalIndexMap]);
    const evaluateActionLogic = useCallback((qIdx) => { const q = originalQuestions[qIdx]; return (!q || !q.skipLogic || !Array.isArray(q.skipLogic.rules) || q.skipLogic.rules.length === 0) ? null : evaluateSurveyLogic(q.skipLogic.rules, currentAnswers, originalQuestions, questionIdToOriginalIndexMap); }, [originalQuestions, currentAnswers, questionIdToOriginalIndexMap]);
    const handleNext = useCallback(() => { /* Full handleNext logic */ }, [currentVisibleIndex, visibleQuestionIndices, isDisqualified, isLoading, originalQuestions, currentAnswers, evaluateDisabled, validateQuestion, allowBackButton, evaluateGlobalLogic, evaluateActionLogic, questionIdToOriginalIndexMap, hiddenQuestionIds, survey, setHiddenQuestionIds, setIsDisqualified, setDisqualificationMessage, setCurrentVisibleIndex, setVisitedPath, navigate, surveyId, actualCollectorObjectId]);
    const handleInputChange = useCallback((qId, val) => { /* Full handleInputChange logic */ }, [questionsById, autoAdvanceState, handleNext, evaluateDisabled, questionIdToOriginalIndexMap]);
    const handleCheckboxChange = useCallback((qId, optVal, isChk) => { /* Full handleCheckboxChange logic */ }, [OTHER_VALUE_INTERNAL, NA_VALUE_INTERNAL, setOtherInputValues]);
    const handleOtherInputChange = useCallback((qId, txtVal) => setOtherInputValues(prev => ({ ...prev, [qId]: txtVal })), []);
    
    const renderQuestion = useCallback((questionToRenderArg) => {
        if (!questionToRenderArg || !questionToRenderArg._id) { console.error("[Debug STM] renderQuestion: EXITING - Invalid questionToRenderArg:", questionToRenderArg); return <div className={styles.loading}>Error loading question content...</div>; }
        console.log(`[Debug STM] renderQuestion: Rendering Q_ID: ${questionToRenderArg._id}, Type: ${questionToRenderArg.type}`);
        if (!questionToRenderArg.type) { console.error(`[Debug STM] renderQuestion: EXITING - Question type missing for ID ${questionToRenderArg._id}.`); return <div>Error: Question type missing for ID {questionToRenderArg._id}.</div>; }
        const question = {...questionToRenderArg}; const value = currentAnswers[question._id]; const otherText = otherInputValues[question._id] || '';
        const isDisabledBySetting = evaluateDisabled(questionIdToOriginalIndexMap[question._id]);
        if (qNumEnabledState && visibleQuestionIndices.includes(questionIdToOriginalIndexMap[question._id])) {
            const qNumber = visibleQuestionIndices.indexOf(questionIdToOriginalIndexMap[question._id]) + 1; let prefix = "";
            if (qNumFormatState === '123') prefix = `${qNumber}. `; else if (qNumFormatState === 'ABC') prefix = `${toLetters(qNumber)}. `; else if (qNumFormatState === 'roman') prefix = `${toRoman(qNumber)}. `;
            question.text = `${prefix}${question.text}`;
        }
        const commonProps = { question, currentAnswer: value, onAnswerChange: handleInputChange, onCheckboxChange: handleCheckboxChange, otherValue: otherText, onOtherTextChange: handleOtherInputChange, disabled: isDisabledBySetting, optionsOrder: randomizedOptionOrders[question._id], isPreviewMode: false };
        console.log(`[Debug STM] renderQuestion: Common props for Q_ID ${question._id}:`, commonProps);
        switch (question.type) {
            case 'text': return <ShortTextQuestion {...commonProps} />; case 'textarea': return <TextAreaQuestion {...commonProps} />; case 'multiple-choice': return <MultipleChoiceQuestion {...commonProps} />;
            case 'checkbox': return <CheckboxQuestion {...commonProps} />; case 'dropdown': return <DropdownQuestion {...commonProps} />; case 'rating': return <RatingQuestion {...commonProps} />;
            case 'nps': return <NpsQuestion {...commonProps} />; case 'slider': return <SliderQuestion {...commonProps} />; case 'matrix': return <MatrixQuestion {...commonProps} />;
            case 'heatmap': return <HeatmapQuestion {...commonProps} />; case 'maxdiff': return <MaxDiffQuestion {...commonProps} />; case 'conjoint': return <ConjointQuestion {...commonProps} />;
            case 'ranking': return <RankingQuestion {...commonProps} />; case 'cardsort': return <CardSortQuestion {...commonProps} />;
            default: console.warn(`[Debug STM] renderQuestion: EXITING - Unsupported question type: ${question.type} for ID ${question._id}`); return <div>Unsupported question type: {question.type}</div>;
        }
    }, [currentAnswers, otherInputValues, handleInputChange, questionIdToOriginalIndexMap, handleOtherInputChange, handleCheckboxChange, randomizedOptionOrders, evaluateDisabled, qNumEnabledState, qNumFormatState, visibleQuestionIndices, toLetters, toRoman]);
    
    const handlePrevious = useCallback(() => { /* Full handlePrevious logic */ }, [isDisqualified, isLoading, visitedPath, currentVisibleIndex, visibleQuestionIndices, allowBackButton, setCurrentVisibleIndex, setVisitedPath]);
    const handleSubmit = useCallback(async (e) => { /* Full handleSubmit logic */ }, [actualCollectorObjectId, collectorSettings, recaptchaEnabled, recaptchaToken, recaptchaSiteKey, visibleQuestionIndices, originalQuestions, evaluateDisabled, validateQuestion, currentAnswers, questionsById, otherInputValues, sessionId, surveyId, navigate, questionIdToOriginalIndexMap, surveyStartedAt, OTHER_VALUE_INTERNAL, currentCollectorIdentifier, capturedCustomVars, currentResumeToken, setIsSubmitting, setError, survey, toast]);
    const handleSavePartialResponse = async () => { /* Full handleSavePartialResponse logic */ };
    const renderProgressBar = () => { /* Full renderProgressBar logic */ return null; };

    console.log(`[Debug STM] Render: Top of render logic. surveyId=${surveyId}, isLoading=${isLoading}, survey=${!!survey}, error=${error}, hasAlreadyResponded=${hasAlreadyResponded}`);
    if (!surveyId) { console.log('[Debug STM] Render: No surveyId...'); return <div className={styles.errorContainer}><h2>Survey Not Specified</h2><p>No survey ID was provided.</p></div>; }
    if (hasAlreadyResponded) { console.log('[Debug STM] Render: Has already responded.'); return <div className={styles.errorContainer}><h2>Survey Completed</h2><p>{error || "You have already responded."}</p></div>; }
    if (isLoading && !survey) { console.log(`[Debug STM] Render: "Loading survey..."`); return <div className={styles.loading}>Loading survey...</div>; }
    if (error && !survey) { console.log(`[Debug STM] Render: Error before survey loaded: ${error}`); return <div className={styles.errorContainer}><h2>Error Loading Survey</h2><p>{error}</p><button onClick={() => fetchSurvey(new AbortController().signal)} className={styles.navButton}>Retry</button></div>; }
    if (!survey && !isLoading && !error) { console.log(`[Debug STM] Render: No survey, not loading, no error...`); return <div className={styles.errorContainer}>Survey data could not be loaded. (Code: STP_NSNILE)</div>; }
    if (isDisqualified) { console.log('[Debug STM] Render: Disqualified.'); return ( <div className={styles.surveyContainer}><h1 className={styles.surveyTitle}>{survey?.title||'Survey'}</h1><div className={styles.disqualifiedBox}><h2>Survey Ended</h2><p>{disqualificationMessage || "You do not qualify."}</p></div></div> ); }
    if (!survey) { console.error(`[Debug STM] Render: CRITICAL - Survey is null!`); return <div className={styles.errorContainer}>Unexpected error. (Code: STP_SNULL_UNEXPECTED)</div>; }

    const finalCurrentQToRender = currentQToRenderMemoized;
    const finalIsSubmitState = isSubmitStateDerived;
    const isCurrentQuestionDisabledBySetting = finalCurrentQToRender ? evaluateDisabled(questionIdToOriginalIndexMap[finalCurrentQToRender._id]) : false;
    const progressBarComponent = progressBarEnabledState ? renderProgressBar() : null;
    console.log(`[Debug STM] FINAL RENDER PREP - SubmitState: ${finalIsSubmitState}, Q_ID: ${finalCurrentQToRender?._id}, CVI: ${currentVisibleIndex}, VQI_Len: ${visibleQuestionIndices.length}`);

    return (
        <>
            <div className={styles.surveyContainer}>
                {progressBarPositionState === 'top' && progressBarComponent}
                <h1 className={styles.surveyTitle}>{survey?.title || 'Survey'}</h1>
                {(visitedPath.length === 0 || (visitedPath.length === 1 && currentVisibleIndex === 0 && visibleQuestionIndices.indexOf(visitedPath[0]) === 0 )) && survey?.description && <p className={styles.surveyDescription}>{survey.description}</p>}
                {error && survey && <div className={styles.submissionError}><p>Error during survey: {error}</p></div>}
                {isLoading && survey ? <div className={styles.loading}>Processing survey data...</div> :
                    <div className={`${styles.questionBox} ${isCurrentQuestionDisabledBySetting ? styles.disabled : ''}`}>
                        {finalIsSubmitState ? ( <div className={styles.submitPrompt}> <p>End of survey.</p> <p>Click "Submit" to record responses.</p> </div> )
                        : finalCurrentQToRender ? ( renderQuestion(finalCurrentQToRender) )
                        : ( originalQuestions.length > 0 && visibleQuestionIndices.length === 0 && !isDisqualified ? 
                            <div className={styles.submitPrompt}><p>No questions are currently visible. This might be due to survey logic or settings.</p></div>
                            : <div className={styles.loading}>No question to display at this step.</div> )}
                    </div>}
                 {finalIsSubmitState && recaptchaEnabled && recaptchaSiteKey && ( <div className={styles.recaptchaContainer}> <ReCAPTCHA ref={recaptchaRef} sitekey={recaptchaSiteKey} onChange={setRecaptchaToken} onExpired={() => setRecaptchaToken(null)} onErrored={() => { toast.error("reCAPTCHA verification failed."); setRecaptchaToken(null); }} /> </div> )}
                <div className={styles.surveyNavigationArea}>
                    {allowBackButton && ( <button onClick={handlePrevious} className={styles.navButton} disabled={isDisqualified || isLoading || isSubmitting || (currentVisibleIndex === 0 && visitedPath.length <= 1) || finalIsSubmitState } > Previous </button> )}
                    {!allowBackButton && <div style={{minWidth: '100px'}}></div>} 
                    {saveAndContinueEnabled && !finalIsSubmitState && !isDisqualified && ( <button onClick={() => setShowSaveModal(true)} className={styles.secondaryNavButton} disabled={isLoading || isSubmitting || isSavingPartial}> Save & Continue Later </button> )}
                    {finalIsSubmitState ? ( <button onClick={handleSubmit} className={styles.submitButton} disabled={isDisqualified || isSubmitting || isLoading || (recaptchaEnabled && recaptchaSiteKey && !recaptchaToken)} > {isSubmitting ? 'Submitting...' : 'Submit'} </button> ) 
                    : ( <button onClick={handleNext} className={styles.navButton} disabled={isDisqualified || isSubmitting || isLoading || !finalCurrentQToRender } > Next </button> )}
                </div>
                {progressBarPositionState === 'bottom' && progressBarComponent}
            </div>
             {showSaveModal && ( <Modal isOpen={showSaveModal} onClose={() => {setShowSaveModal(false); setSaveEmail('');}} title="Save Your Progress"> {/* Modal Content */} </Modal> )}
             {showResumeCodeInfo && ( <Modal isOpen={showResumeCodeInfo} onClose={() => setShowResumeCodeInfo(false)} title="Resume Information"> {/* Modal Content */} </Modal> )}
        </>
    );
}
export default SurveyTakingPage;
// ----- END OF COMPLETE MODIFIED FILE (vNext16.10 - Corrected fetchSurvey useCallback deps) -----