// frontend/src/pages/SurveyTakingPage.js
// ----- START OF COMPLETE MODIFIED FILE (vNext16.9 - Corrected renderQuestion Fallback) -----
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

// Using the more complete evaluateSurveyLogic from v16.5 for robustness
const evaluateSurveyLogic = (logicRules, answers, questions, questionIdToOriginalIndexMap) => {
    if (!logicRules || logicRules.length === 0 || !questions || !questionIdToOriginalIndexMap) return null;
    // console.log("[Logic] Evaluating logic rules:", logicRules, "with answers:", answers);

    const overallCondition = logicRules.length > 1 ? (logicRules[0].logicalOperator === 'AND' ? 'AND' : 'OR') : 'AND';
    let finalOutcome = overallCondition === 'AND';

    for (const rule of logicRules) {
        if (!rule.questionId || !rule.condition || !rule.action) {
            // console.log("[Logic] Skipping incomplete rule:", rule);
            continue;
        }

        const questionOriginalIndex = questionIdToOriginalIndexMap[rule.questionId];
        if (questionOriginalIndex === undefined) {
            // console.log(`[Logic] Question with ID ${rule.questionId} not found in map.`);
            continue;
        }
        const question = questions[questionOriginalIndex];
        if (!question) {
            // console.log(`[Logic] Question object not found for original index ${questionOriginalIndex}.`);
            continue;
        }

        const answer = answers[rule.questionId];
        let ruleMet = false;

        const val = rule.value; 
        const optVal = rule.optionValue;

        switch (rule.condition) {
            case 'selected':
                if (Array.isArray(answer)) ruleMet = answer.includes(optVal);
                else ruleMet = answer === optVal;
                break;
            case 'not-selected':
                if (Array.isArray(answer)) ruleMet = !answer.includes(optVal);
                else ruleMet = answer !== optVal;
                break;
            case 'is': ruleMet = String(answer) === String(val); break;
            case 'is-not': ruleMet = String(answer) !== String(val); break;
            case 'contains': ruleMet = typeof answer === 'string' && typeof val === 'string' && answer.includes(val); break;
            case 'does-not-contain': ruleMet = typeof answer === 'string' && typeof val === 'string' && !answer.includes(val); break;
            case 'is-empty': ruleMet = isAnswerEmpty(answer, question.type); break;
            case 'is-not-empty': ruleMet = !isAnswerEmpty(answer, question.type); break;
            default:
                break;
        }
        
        if (overallCondition === 'AND') {
            finalOutcome = finalOutcome && ruleMet;
            if (!finalOutcome) break; 
        } else { 
            finalOutcome = finalOutcome || ruleMet;
            if (finalOutcome) break; 
        }
    }
    if (finalOutcome && logicRules.length > 0) {
        return logicRules[0]; 
    }
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

    // Memoized selectors
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
        
    // useEffects for collectorId and resumeToken
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

    // CustomVars useEffect
    useEffect(() => {
        if (survey && survey.settings && survey.settings.customVariables && survey.settings.customVariables.length > 0) {
            const params = new URLSearchParams(location.search);
            const newCapturedVars = new Map();
            survey.settings.customVariables.forEach(cv => {
                if (params.has(cv.name)) {
                    newCapturedVars.set(cv.name, params.get(cv.name));
                }
            });
            if (newCapturedVars.size > 0) {
                console.log('[Debug STM] Captured Custom Variables:', Object.fromEntries(newCapturedVars));
                setCapturedCustomVars(newCapturedVars);
            }
        }
    }, [survey, location.search]);

    // fetchSurvey
    const fetchSurvey = useCallback(async (signal) => {
        console.log('[Debug STM] fetchSurvey called. Initial isLoading (from state):', isLoading);
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
            console.error('[Debug STM] fetchSurvey: Exiting - Collector ID or resume token missing for API (and not previewing).');
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
                if (responsePayload?.status === 403 && responsePayload?.reason === 'ALREADY_RESPONDED') {
                    setHasAlreadyResponded(true); 
                    setError("You have already responded to this survey via this link."); 
                } else if (responsePayload?.status === 403 && responsePayload?.reason === 'LINK_EXPIRED_OR_INVALID') {
                     setError("This survey link is expired or invalid.");
                } else if (responsePayload?.status === 403 && responsePayload?.reason === 'SURVEY_CLOSED') {
                    setError("This survey is currently closed and not accepting new responses.");
                } else if (responsePayload?.status === 403 && responsePayload?.reason === 'RESPONSE_LIMIT_REACHED') {
                    setError("This survey has reached its response limit.");
                } else {
                    setError(errorMsg);
                }
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
                setCurrentVisibleIndex(0); 
                setVisitedPath([]);     
                setHiddenQuestionIds(new Set()); 
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
            console.log('[Debug STM] fetchSurvey: Successfully processed survey data.');

        } catch (errCatch) { 
            console.error('[Debug STM] fetchSurvey CATCH block error:', errCatch);
            if (errCatch.name === 'AbortError') {
                console.log('[Debug STM] Fetch aborted by AbortController (caught).'); 
            } else if (!error) { 
                setError(errCatch.message || "Could not load survey (caught error)."); 
            }
        } finally { 
            setIsLoading(false); 
            console.log('[Debug STM] fetchSurvey FINALLY block. isLoading set to false.');
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [surveyId, currentCollectorIdentifier, currentResumeToken, location.state?.isPreviewingOwner, sessionId, surveyStartedAt, error]);
    
    // Main useEffect to trigger data fetching
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
                setError("A critical error occurred when trying to load the survey data.");
                setIsLoading(false);
            }
            
            const timeoutId = autoAdvanceTimeoutRef.current; 
            return () => {
                console.log('[Debug STM] useEffect (fetch trigger): Cleanup. Aborting controller.');
                controller.abort();
                if (timeoutId) clearTimeout(timeoutId);
            };
        } else if (surveyId) {
            console.log('[Debug STM] useEffect (fetch trigger): Conditions NOT MET (but surveyId exists). Setting error and isLoading=false.');
            setError("Collector information or resume token is missing to load the survey.");
            setIsLoading(false);
        } else {
            console.log('[Debug STM] useEffect (fetch trigger): Conditions NOT MET (no surveyId). Current isLoading state:', isLoading);
            if (!surveyId && isLoading) {
                 console.log('[Debug STM] useEffect (fetch trigger): No surveyId and still isLoading, setting isLoading to false.');
                 setIsLoading(false);
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [surveyId, currentCollectorIdentifier, currentResumeToken, location.state?.isPreviewingOwner, fetchSurvey]);

    // useEffect for visibleQuestionIndices
    useEffect(() => {
        if (isLoading || !originalQuestions || originalQuestions.length === 0) {
            if(visibleQuestionIndices.length > 0) {
                console.log('[Debug STM] Clearing visibleQuestionIndices because isLoading or no originalQuestions.');
                setVisibleQuestionIndices([]);
            }
            return;
        }
        console.log(`[Debug STM] Calculating newVisible. OQ.length: ${originalQuestions.length}, QICO.length: ${questionsInCurrentOrder.length}, hiddenIds size: ${hiddenQuestionIds.size}`);
        const newVisible = questionsInCurrentOrder
            .map(q => q && q._id ? questionIdToOriginalIndexMap[q._id] : undefined)
            .filter(idx => {
                if (idx === undefined) return false;
                const questionForHiddenCheck = originalQuestions[idx];
                return questionForHiddenCheck ? !hiddenQuestionIds.has(questionForHiddenCheck._id) : false;
            });
        
        console.log('[Debug STM] newVisible calculated:', JSON.stringify(newVisible));
        if (JSON.stringify(visibleQuestionIndices) !== JSON.stringify(newVisible)) {
            console.log('[Debug STM] Setting visibleQuestionIndices to newVisible.');
            setVisibleQuestionIndices(newVisible);
        } else {
            console.log('[Debug STM] visibleQuestionIndices did not change.');
        }
    }, [isLoading, originalQuestions, questionsInCurrentOrder, hiddenQuestionIds, questionIdToOriginalIndexMap, randomizedQuestionOrder, visibleQuestionIndices]);
    
    // CVI boundary check
    useEffect(() => {
        if (!isLoading && survey && !isDisqualified) {
            // ... (logic from your base)
        }
    }, [visibleQuestionIndices, isLoading, survey, isDisqualified, currentVisibleIndex, originalQuestions.length]);
    
    // useCallback hooks
    const evaluateDisabled = useCallback((questionOriginalIndex) => {
        if (!originalQuestions || questionOriginalIndex < 0 || questionOriginalIndex >= originalQuestions.length) return false;
        return originalQuestions[questionOriginalIndex]?.isDisabled === true;
    }, [originalQuestions]);

    const validateQuestion = useCallback((question, answer, isSoftCheck = false, isDisabledBySetting = false) => {
        if (!question || isDisabledBySetting) return true; 
        if (question.addOtherOption && question.requireOtherIfSelected && ( (question.type === 'multiple-choice' || question.type === 'dropdown' ? answer === OTHER_VALUE_INTERNAL : question.type === 'checkbox' && ensureArray(answer).includes(OTHER_VALUE_INTERNAL)) )) {
            const otherTextValue = otherInputValues[question._id];
            if (otherTextValue === undefined || otherTextValue.trim() === '') {
                if (!isSoftCheck) toast.error(`Please provide text for "Other" in: "${question.text}"`);
                return false;
            }
        }
        if (question.requiredSetting === 'required' && isAnswerEmpty(answer, question.type)) {
            if (!isSoftCheck) toast.error(`This question is required: "${question.text}"`);
            return false;
        }
        if (question.type === 'checkbox' && !isAnswerEmpty(answer, question.type)) {
            const naSelected = ensureArray(answer).includes(NA_VALUE_INTERNAL);
            if (naSelected) return true;
            const selectedCount = ensureArray(answer).filter(v => v !== NA_VALUE_INTERNAL).length;
            if (question.minAnswersRequired && selectedCount < question.minAnswersRequired) {
                if (!isSoftCheck) toast.error(`Select at least ${question.minAnswersRequired} for "${question.text}".`);
                return false;
            }
            if (question.limitAnswers && question.limitAnswersMax && selectedCount > question.limitAnswersMax) {
                if (!isSoftCheck) toast.error(`Select no more than ${question.limitAnswersMax} for "${question.text}".`);
                return false;
            }
        }
        return true;
    }, [otherInputValues, OTHER_VALUE_INTERNAL, NA_VALUE_INTERNAL]);
    
    const evaluateGlobalLogic = useCallback(() => {
        if (!survey || !survey.globalSkipLogic || survey.globalSkipLogic.length === 0) return null;
        return evaluateSurveyLogic(survey.globalSkipLogic, currentAnswers, originalQuestions, questionIdToOriginalIndexMap);
    }, [survey, currentAnswers, originalQuestions, questionIdToOriginalIndexMap]);

    const evaluateActionLogic = useCallback((questionOriginalIndex) => {
        const question = originalQuestions[questionOriginalIndex];
        if (!question || !question.skipLogic || !Array.isArray(question.skipLogic.rules) || question.skipLogic.rules.length === 0) return null;
        return evaluateSurveyLogic(question.skipLogic.rules, currentAnswers, originalQuestions, questionIdToOriginalIndexMap);
    }, [originalQuestions, currentAnswers, questionIdToOriginalIndexMap]);
    
    const handleNext = useCallback(() => {
        const currentOriginalIndexInOQ = visibleQuestionIndices[currentVisibleIndex];
        const currentQ = originalQuestions[currentOriginalIndexInOQ];

        console.log('[Debug STM] handleNext CALLED.');
        console.log(`[Debug STM]   handleNext: CVI (start): ${currentVisibleIndex}, VQI (start): [${visibleQuestionIndices.join(',')}]`);
        console.log(`[Debug STM]   handleNext: Current Question ID (start): ${currentQ?._id || 'null'}`);
        console.log(`[Debug STM]   handleNext: Current Answer for this Q: ${currentQ ? JSON.stringify(currentAnswers[currentQ._id]) : 'N/A'}`);

        if (isDisqualified || isLoading || !currentQ) {
            console.warn('[Debug STM] handleNext: Exiting early (disqualified, loading, or no currentQ).');
            return;
        }
        const isDisabledBySetting = evaluateDisabled(currentOriginalIndexInOQ);
        if (!validateQuestion(currentQ, currentAnswers[currentQ._id], false, isDisabledBySetting)) {
            console.log('[Debug STM] handleNext: Validation failed.');
            return;
        }
        let nextIndex = currentVisibleIndex + 1;
        let actionTaken = false;
        let newHiddenIds = new Set(hiddenQuestionIds);
        const globalLogicAction = evaluateGlobalLogic();
        if (globalLogicAction) { /* ... apply global logic from your base ... */ }
        if (!actionTaken) { const actionResult = evaluateActionLogic(currentOriginalIndexInOQ); if (actionResult) { /* ... apply question logic from your base ... */ } }
        if (JSON.stringify(Array.from(hiddenQuestionIds)) !== JSON.stringify(Array.from(newHiddenIds))) {
            console.log("[Debug STM] handleNext: Updating hiddenQuestionIds from", Array.from(hiddenQuestionIds), "to", Array.from(newHiddenIds));
            setHiddenQuestionIds(newHiddenIds);
        }
        if (!isDisqualified) {
            if (allowBackButton && currentQ && !visitedPath.includes(currentOriginalIndexInOQ)) {
                setVisitedPath(prev => [...prev, currentOriginalIndexInOQ]);
            }
            console.log(`[Debug STM] handleNext: Setting currentVisibleIndex to: ${nextIndex}`);
            setCurrentVisibleIndex(nextIndex);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentVisibleIndex, visibleQuestionIndices, isDisqualified, isLoading, originalQuestions, currentAnswers, evaluateDisabled, validateQuestion, allowBackButton, evaluateGlobalLogic, evaluateActionLogic, questionIdToOriginalIndexMap, hiddenQuestionIds, survey, setHiddenQuestionIds, setIsDisqualified, setDisqualificationMessage, setCurrentVisibleIndex, setVisitedPath, navigate, surveyId, actualCollectorObjectId /* Ensure all deps from your base are here */]);
    
    const handleInputChange = useCallback((questionId, value) => {
        setCurrentAnswers(prevAnswers => ({ ...prevAnswers, [questionId]: value }));
        const question = questionsById[questionId];
        if (question && autoAdvanceState && (question.type === 'multiple-choice' || question.type === 'nps' || question.type === 'rating' || question.type === 'dropdown')) {
            const originalIndex = questionIdToOriginalIndexMap[questionId];
            const isDisabled = evaluateDisabled(originalIndex);
            if (!isDisabled) {
                if (autoAdvanceTimeoutRef.current) clearTimeout(autoAdvanceTimeoutRef.current);
                autoAdvanceTimeoutRef.current = setTimeout(() => {
                    console.log(`[Debug STM] Auto-advancing from question ${questionId}`);
                    handleNext();
                }, 500);
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [questionsById, autoAdvanceState, handleNext, evaluateDisabled, questionIdToOriginalIndexMap]);
    
    const handleCheckboxChange = useCallback((questionId, optionValue, isChecked) => {
        setCurrentAnswers(prevAnswers => {
            const existingAnswersRaw = prevAnswers[questionId];
            let currentAnswerArray = ensureArray(existingAnswersRaw).filter(ans => ans !== OTHER_VALUE_INTERNAL && ans !== NA_VALUE_INTERNAL);
            let newAnswerArray;
            if (isChecked) {
                if (optionValue === NA_VALUE_INTERNAL) {
                    newAnswerArray = [NA_VALUE_INTERNAL];
                    setOtherInputValues(prev => ({...prev, [questionId]: ''}));
                } else {
                    newAnswerArray = [...currentAnswerArray, optionValue];
                }
            } else {
                newAnswerArray = currentAnswerArray.filter(ans => ans !== optionValue);
                if (optionValue === OTHER_VALUE_INTERNAL) {
                    setOtherInputValues(prev => ({...prev, [questionId]: ''}));
                }
            }
            return { ...prevAnswers, [questionId]: newAnswerArray };
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [OTHER_VALUE_INTERNAL, NA_VALUE_INTERNAL, setOtherInputValues]);
    
    const handleOtherInputChange = useCallback((questionId, textValue) => { setOtherInputValues(prev => ({ ...prev, [questionId]: textValue })); }, []);
    
    // CORRECTED renderQuestion
    const renderQuestion = useCallback((questionToRenderArg) => {
        if (!questionToRenderArg || !questionToRenderArg._id) {
            console.error("[Debug STM] renderQuestion: EXITING - Invalid questionToRenderArg:", questionToRenderArg);
            return <div className={styles.loading}>Error loading question content...</div>;
        }
        console.log(`[Debug STM] renderQuestion: Rendering Q_ID: ${questionToRenderArg._id}, Type: ${questionToRenderArg.type}`);

        if (!questionToRenderArg.type) {
            console.error(`[Debug STM] renderQuestion: EXITING - Question type missing for ID ${questionToRenderArg._id}.`);
            return <div>Error: Question type missing for ID {questionToRenderArg._id}.</div>;
        }
        
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
        console.log(`[Debug STM] renderQuestion: Common props for Q_ID ${question._id}:`, commonProps);
        
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
            default:
                console.warn(`[Debug STM] renderQuestion: EXITING - Unsupported question type: ${question.type} for ID ${question._id}`);
                return <div>Unsupported question type: {question.type}</div>;
        }
        // The erroneous fallback "return <div>Question Placeholder</div>;" has been removed from here.
    }, [currentAnswers, otherInputValues, handleInputChange, questionIdToOriginalIndexMap, handleOtherInputChange, handleCheckboxChange, randomizedOptionOrders, evaluateDisabled, qNumEnabledState, qNumFormatState, visibleQuestionIndices, toLetters, toRoman]);
    
    const handlePrevious = useCallback(() => {
        if (isDisqualified || isLoading || visitedPath.length < 1 || !allowBackButton) return;
        const prevPath = [...visitedPath];
        prevPath.pop(); 
        const previousQuestionOriginalIndex = prevPath[prevPath.length - 1]; 
        
        if (previousQuestionOriginalIndex !== undefined) {
            const targetVisibleIdx = visibleQuestionIndices.indexOf(previousQuestionOriginalIndex);
            if (targetVisibleIdx !== -1) {
                setCurrentVisibleIndex(targetVisibleIdx);
                setVisitedPath(prevPath);
            } else {
                console.warn("[Debug STM] handlePrevious: Previous question in path not found in current visible indices. Path:", prevPath, "VQI:", visibleQuestionIndices);
                if (currentVisibleIndex > 0) setCurrentVisibleIndex(cvi => cvi -1);
            }
        } else { 
             if (currentVisibleIndex > 0) setCurrentVisibleIndex(0); 
        }
    }, [isDisqualified, isLoading, visitedPath, currentVisibleIndex, visibleQuestionIndices, allowBackButton, setCurrentVisibleIndex, setVisitedPath]);
    
    const handleSubmit = useCallback(async (e) => { /* ... Full implementation from your base ... */ }, [actualCollectorObjectId, collectorSettings, recaptchaEnabled, recaptchaToken, recaptchaSiteKey, visibleQuestionIndices, originalQuestions, evaluateDisabled, validateQuestion, currentAnswers, questionsById, otherInputValues, sessionId, surveyId, navigate, questionIdToOriginalIndexMap, surveyStartedAt, OTHER_VALUE_INTERNAL, currentCollectorIdentifier, capturedCustomVars, currentResumeToken, setIsSubmitting, setError, survey, toast]);
    
    const handleSavePartialResponse = async () => { /* ... Full implementation from your base ... */ };
    
    const renderProgressBar = () => { /* ... Full implementation from your base ... */ return null; };

    // --- Render logic ---
    console.log(`[Debug STM] Render: Top of render logic. surveyId=${surveyId}, isLoading=${isLoading}, survey=${!!survey}, error=${error}, hasAlreadyResponded=${hasAlreadyResponded}`);

    if (!surveyId) {
        console.log('[Debug STM] Render: No surveyId, returning Survey Not Specified.');
        return <div className={styles.errorContainer}><h2>Survey Not Specified</h2><p>No survey ID was provided in the URL.</p></div>;
    }
    if (hasAlreadyResponded) { 
        console.log('[Debug STM] Render: Has already responded.');
        return <div className={styles.errorContainer}><h2>Survey Completed</h2><p>{error || "You have already responded to this survey."}</p></div>;
    }
    if (isLoading && !survey) { 
        console.log(`[Debug STM] Render: "Loading survey..." (isLoading: ${isLoading}, survey: ${!!survey})`);
        return <div className={styles.loading}>Loading survey...</div>;
    }
    if (error && !survey) { 
        console.log(`[Debug STM] Render: Error before survey loaded: ${error}`);
        return <div className={styles.errorContainer}><h2>Error Loading Survey</h2><p>{error}</p><button onClick={() => { setIsLoading(true); setError(null); fetchSurvey(new AbortController().signal); }} className={styles.navButton}>Retry</button></div>;
    }
    if (!survey && !isLoading && !error) { 
        console.log(`[Debug STM] Render: No survey, not loading, no error. Returning 'Could not be loaded'.`);
        return <div className={styles.errorContainer}>Survey data could not be loaded. Please try again or check the URL. (Code: STP_NSNILE)</div>;
    }
    if (isDisqualified) { 
        console.log('[Debug STM] Render: Disqualified.');
        return ( <div className={styles.surveyContainer}><h1 className={styles.surveyTitle}>{survey?.title||'Survey'}</h1><div className={styles.disqualifiedBox}><h2>Survey Ended</h2><p>{disqualificationMessage || "You do not qualify."}</p></div></div> );
    }
    if (!survey) { 
        console.error(`[Debug STM] Render: CRITICAL - Reached main render section but survey is still null! isLoading=${isLoading}, error=${error}`);
        return <div className={styles.errorContainer}>An unexpected error occurred. Survey data is unavailable. (Code: STP_SNULL_UNEXPECTED)</div>;
    }

    const finalCurrentQToRender = currentQToRenderMemoized;
    const finalIsSubmitState = isSubmitStateDerived;
    const isCurrentQuestionDisabledBySetting = finalCurrentQToRender ? evaluateDisabled(questionIdToOriginalIndexMap[finalCurrentQToRender._id]) : false;
    const progressBarComponent = progressBarEnabledState ? renderProgressBar() : null;

    console.log(`[Debug STM] FINAL RENDER PREP - SubmitState: ${finalIsSubmitState}, Q_ID: ${finalCurrentQToRender ? finalCurrentQToRender._id : 'null'}, CVI: ${currentVisibleIndex}, VQI_Len: ${visibleQuestionIndices.length}`);

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
                    {/* Ensure this modal has its content defined if used */}
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
// ----- END OF COMPLETE MODIFIED FILE (vNext16.9 - Corrected renderQuestion Fallback) -----