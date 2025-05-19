// frontend/src/pages/SurveyTakingPage.js
// ----- START OF COMPLETE MODIFIED FILE (vNext16.15.5 - Corrected and Complete - Stubbed fetchSurvey & Checkpoints) -----
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

// Helper functions
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

    const questionsById = useMemo(() => {
        console.log('[Debug STM] questionsById CALC.');
        return originalQuestions.reduce((map, q) => { if(q && q._id) map[q._id] = q; return map; }, {});
    }, [originalQuestions]);

    const questionsInCurrentOrder = useMemo(() => {
        console.log('[Debug STM] questionsInCurrentOrder CALC.');
        return (randomizedQuestionOrder.length > 0 && originalQuestions.length > 0) ? randomizedQuestionOrder.map(index => originalQuestions[index]).filter(q => q) : originalQuestions.filter(q => q);
    }, [randomizedQuestionOrder, originalQuestions]);

    const questionIdToOriginalIndexMap = useMemo(() => {
        console.log('[Debug STM] questionIdToOriginalIndexMap CALC.');
        return originalQuestions.reduce((map, q, index) => { if(q && q._id) map[q._id] = index; return map; }, {});
    }, [originalQuestions]);
    
    const currentQToRenderMemoized = useMemo(() => {
        console.log(`[Debug STM] currentQToRenderMemoized CALC: isLoading=${isLoading}, survey=${!!survey}, VQI.length=${visibleQuestionIndices.length}, CVI=${currentVisibleIndex}, OQ.length=${originalQuestions.length}`);
        if (isLoading || !survey || visibleQuestionIndices.length === 0 || currentVisibleIndex < 0 || currentVisibleIndex >= visibleQuestionIndices.length) {
            console.log('[Debug STM] currentQToRenderMemoized -> null (PRE-CONDITION FAILED)');
            return null;
        }
        const currentOriginalIdx = visibleQuestionIndices[currentVisibleIndex];
        console.log(`[Debug STM] currentQToRenderMemoized: currentOriginalIdx = VQI[${currentVisibleIndex}] = ${currentOriginalIdx}`);
        if (currentOriginalIdx === undefined || currentOriginalIdx < 0 || currentOriginalIdx >= originalQuestions.length) {
            console.error(`[Debug STM] currentQToRenderMemoized -> null (INVALID currentOriginalIdx: ${currentOriginalIdx} for OQ length: ${originalQuestions.length})`);
            return null;
        }
        const q = originalQuestions[currentOriginalIdx];
        if (!q || !q._id) {
            console.error(`[Debug STM] currentQToRenderMemoized -> null (Question object or _id is FALSY at originalQuestions[${currentOriginalIdx}]). Question object:`, q);
            return null;
        }
        console.log(`[Debug STM] currentQToRenderMemoized -> RETURNING question ID: ${q._id}`);
        return q;
    }, [isLoading, survey, visibleQuestionIndices, currentVisibleIndex, originalQuestions]);

    const isSubmitStateDerived = useMemo(() => {
        console.log(`[Debug STM] isSubmitStateDerived CALC: isLoading=${isLoading}, survey=${!!survey}, VQI.length=${visibleQuestionIndices.length}, OQ.length=${originalQuestions.length}, CVI=${currentVisibleIndex}`);
        if (isLoading || !survey) {
            console.log('[Debug STM] isSubmitStateDerived -> false (isLoading or no survey)');
            return false;
        }
        if (originalQuestions.length > 0 && visibleQuestionIndices.length === 0 && !isLoading) {
            console.log('[Debug STM] isSubmitStateDerived -> true (OQ > 0, VQI === 0, not loading)');
            return true; // No visible questions but survey has questions (e.g. all hidden by logic)
        }
        if (originalQuestions.length === 0 && !isLoading) {
            console.log('[Debug STM] isSubmitStateDerived -> true (No questions in survey, not loading)');
            return true; // Survey is empty
        }
        const result = currentVisibleIndex >= visibleQuestionIndices.length && visibleQuestionIndices.length > 0 && !isLoading;
        console.log(`[Debug STM] isSubmitStateDerived -> ${result} (final condition)`);
        return result;
    }, [isLoading, survey, visibleQuestionIndices, originalQuestions, currentVisibleIndex]);
        
    console.log('[Debug STM] After useMemo hooks, before useEffect hooks.');

    useEffect(() => {
        console.log(`[Debug STM] useEffect (set CCI) ENTERED. routeCollectorIdentifier=${routeCollectorIdentifier}, location.state?.collectorIdentifier=${location.state?.collectorIdentifier}`);
        const effectiveCollectorId = location.state?.collectorIdentifier || routeCollectorIdentifier;
        console.log(`[Debug STM] useEffect (set CCI): effectiveCollectorId = ${effectiveCollectorId}. Setting currentCollectorIdentifier.`);
        setCurrentCollectorIdentifier(effectiveCollectorId);
    }, [location.state?.collectorIdentifier, routeCollectorIdentifier]);

    useEffect(() => {
        console.log(`[Debug STM] useEffect (set CRT) ENTERED. routeResumeToken=${routeResumeToken}, location.state?.resumeToken=${location.state?.resumeToken}, currentToken=${currentResumeToken}`);
        const tokenFromRoute = routeResumeToken;
        const tokenFromState = location.state?.resumeToken;
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
        console.log(`[Debug STM] useEffect (CustomVars) ENTERED. Survey exists: ${!!survey}`);
        if (survey && survey.settings && survey.settings.customVariables && survey.settings.customVariables.length > 0) {
            const params = new URLSearchParams(location.search);
            const newCapturedVars = new Map();
            survey.settings.customVariables.forEach(cv => { if (params.has(cv.name)) { newCapturedVars.set(cv.name, params.get(cv.name)); } });
            if (newCapturedVars.size > 0) { console.log('[Debug STM] Captured Custom Variables:', Object.fromEntries(newCapturedVars)); setCapturedCustomVars(newCapturedVars); }
        }
    }, [survey, location.search]);

    // ++ TEMPORARILY STUBBED fetchSurvey ++
    const fetchSurvey = useCallback(async (signal) => {
        console.log('[Debug STM] fetchSurvey STUB CALLED. THIS IS A TEMPORARY STUB.');
        setIsLoading(true); 
        await new Promise(resolve => setTimeout(resolve, 50)); 
        // setError("STUB: Data not fetched by stub."); // Keep error null for now to see default UI
        setIsLoading(false);
        console.log('[Debug STM] fetchSurvey STUB FINISHED.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [surveyId, currentCollectorIdentifier, currentResumeToken, location.state?.isPreviewingOwner, sessionId, surveyStartedAt]);
    
    useEffect(() => {
        console.log(`[Debug STM] useEffect (fetch trigger) ENTERED. surveyId=${surveyId}, currentCollectorIdentifier=${currentCollectorIdentifier}, currentResumeToken=${currentResumeToken}, isPreviewingOwner=${location.state?.isPreviewingOwner}, fetchSurvey defined: ${!!fetchSurvey}`);
        const isPreviewing = location.state?.isPreviewingOwner;
        const shouldFetch = surveyId && (currentCollectorIdentifier || currentResumeToken || isPreviewing);
        console.log(`[Debug STM] useEffect (fetch trigger): shouldFetch = ${shouldFetch}`);
        if (shouldFetch) {
            console.log('[Debug STM] useEffect (fetch trigger): Conditions MET, attempting to call fetchSurvey (STUBBED).');
            const controller = new AbortController();
            try { fetchSurvey(controller.signal); console.log('[Debug STM] useEffect (fetch trigger): fetchSurvey (STUBBED) call initiated.'); } 
            catch (e) { console.error('[Debug STM] useEffect (fetch trigger): SYNC ERROR during fetchSurvey (STUBBED) INVOCATION:', e); setError("A critical error occurred when trying to load the survey data."); setIsLoading(false); }
            return () => { console.log('[Debug STM] useEffect (fetch trigger): Cleanup. Aborting controller.'); controller.abort(); };
        } else if (surveyId) { 
            console.log('[Debug STM] useEffect (fetch trigger): Conditions NOT MET (but surveyId exists). Setting error and isLoading=false.'); 
            setError("Collector information or resume token is missing to load the survey."); setIsLoading(false); 
        } else { 
            console.log('[Debug STM] useEffect (fetch trigger): Conditions NOT MET (no surveyId). Current isLoading state:', isLoading); 
            if (!surveyId && isLoading) { console.log('[Debug STM] useEffect (fetch trigger): No surveyId and still isLoading, setting isLoading to false.'); setIsLoading(false); } 
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [surveyId, currentCollectorIdentifier, currentResumeToken, location.state?.isPreviewingOwner, fetchSurvey]);

    useEffect(() => {
        console.log(`[Debug STM] useEffect (visibleQuestionIndices) ENTERED. isLoading=${isLoading}, originalQuestions.length=${originalQuestions.length}`);
        if (isLoading || !originalQuestions || originalQuestions.length === 0) { if(visibleQuestionIndices.length > 0) { console.log('[Debug STM] Clearing visibleQuestionIndices because isLoading or no originalQuestions.'); setVisibleQuestionIndices([]); } return; }
        console.log(`[Debug STM] Calculating newVisible. OQ.length: ${originalQuestions.length}, QICO.length: ${questionsInCurrentOrder.length}, hiddenIds size: ${hiddenQuestionIds.size}`);
        const newVisible = questionsInCurrentOrder.map(q => q && q._id ? questionIdToOriginalIndexMap[q._id] : undefined).filter(idx => { if (idx === undefined) return false; const questionForHiddenCheck = originalQuestions[idx]; return questionForHiddenCheck ? !hiddenQuestionIds.has(questionForHiddenCheck._id) : false; });
        console.log('[Debug STM] newVisible calculated:', JSON.stringify(newVisible));
        if (JSON.stringify(visibleQuestionIndices) !== JSON.stringify(newVisible)) { console.log('[Debug STM] Setting visibleQuestionIndices to newVisible.'); setVisibleQuestionIndices(newVisible); } else { console.log('[Debug STM] visibleQuestionIndices did not change.');}
    }, [isLoading, originalQuestions, questionsInCurrentOrder, hiddenQuestionIds, questionIdToOriginalIndexMap, randomizedQuestionOrder, visibleQuestionIndices]);
    
    useEffect(() => { 
        console.log(`[Debug STM] useEffect (CVI boundary check) ENTERED. isLoading=${isLoading}, survey=${!!survey}, isDisqualified=${isDisqualified}, CVI=${currentVisibleIndex}, VQI.length=${visibleQuestionIndices.length}`);
        if (!isLoading && survey && !isDisqualified) { 
            if (currentVisibleIndex >= visibleQuestionIndices.length && visibleQuestionIndices.length > 0) {
                console.log(`[Debug STM] CVI Boundary: CVI (${currentVisibleIndex}) >= VQI.length (${visibleQuestionIndices.length}). Setting CVI to VQI.length - 1.`);
                setCurrentVisibleIndex(visibleQuestionIndices.length - 1);
            } else if (currentVisibleIndex < 0 && visibleQuestionIndices.length > 0) {
                console.log(`[Debug STM] CVI Boundary: CVI (${currentVisibleIndex}) < 0. Setting CVI to 0.`);
                setCurrentVisibleIndex(0);
            }
        }
    }, [visibleQuestionIndices, isLoading, survey, isDisqualified, currentVisibleIndex, originalQuestions.length]); // Added originalQuestions.length as it's implicitly part of survey readiness
    
    console.log('[Debug STM] After useEffect hooks, before useCallback hooks.');

    const evaluateDisabled = useCallback((qIdx) => (!originalQuestions || qIdx<0 || qIdx >= originalQuestions.length) ? false : originalQuestions[qIdx]?.isDisabled === true, [originalQuestions]);
    
    const validateQuestion = useCallback((question, answer, isSoftValidation = false, isDisqualificationCheck = false) => {
        // Basic validation, can be expanded
        if (!question) return true; // Should not happen if question is passed
        if (question.required && !isSoftValidation && !isDisqualificationCheck) {
            if (isAnswerEmpty(answer, question.type)) {
                toast.error(`${question.text || 'This question'} is required.`);
                return false;
            }
        }
        // Add more type-specific validations if needed
        return true;
    }, [otherInputValues, NA_VALUE_INTERNAL, OTHER_VALUE_INTERNAL]); // Added dependencies based on usage

    const evaluateGlobalLogic = useCallback(() => {
        if (!survey || !survey.globalSkipLogic || survey.globalSkipLogic.length === 0) return null;
        return evaluateSurveyLogic(survey.globalSkipLogic, currentAnswers, originalQuestions, questionIdToOriginalIndexMap);
    }, [survey, currentAnswers, originalQuestions, questionIdToOriginalIndexMap]);

    const evaluateActionLogic = useCallback((questionIndex) => {
        const question = originalQuestions[questionIndex];
        if (!question || !question.skipLogic || !Array.isArray(question.skipLogic.rules) || question.skipLogic.rules.length === 0) {
            return null;
        }
        return evaluateSurveyLogic(question.skipLogic.rules, currentAnswers, originalQuestions, questionIdToOriginalIndexMap);
    }, [originalQuestions, currentAnswers, questionIdToOriginalIndexMap]);

    const handleNext = useCallback(() => {
        console.log(`[Debug STM] handleNext: CVI=${currentVisibleIndex}, VQI.length=${visibleQuestionIndices.length}`);
        if (isDisqualified || isLoading) return;

        const currentOriginalIdx = visibleQuestionIndices[currentVisibleIndex];
        const currentQuestion = originalQuestions[currentOriginalIdx];
        const currentAnswer = currentAnswers[currentQuestion?._id];

        if (currentQuestion && !validateQuestion(currentQuestion, currentAnswer)) {
            return; // Validation failed
        }

        // Evaluate action logic for the current question
        const actionRuleMet = evaluateActionLogic(currentOriginalIdx);
        if (actionRuleMet) {
            console.log('[Debug STM] handleNext: Action rule met:', actionRuleMet);
            if (actionRuleMet.action === 'disqualify') {
                setIsDisqualified(true);
                setDisqualificationMessage(actionRuleMet.disqualificationMessage || survey?.settings?.terminationPages?.disqualified || 'Thank you for your time. You do not qualify for the remainder of this survey.');
                return;
            } else if (actionRuleMet.action === 'skip-to' && actionRuleMet.targetQuestionId) {
                const targetOriginalIndex = questionIdToOriginalIndexMap[actionRuleMet.targetQuestionId];
                const targetVisibleIndex = visibleQuestionIndices.indexOf(targetOriginalIndex);
                if (targetVisibleIndex !== -1) {
                    setVisitedPath(prev => [...prev, currentOriginalIdx]);
                    setCurrentVisibleIndex(targetVisibleIndex);
                    return;
                }
            }
        }
        
        // Evaluate global logic only if no action logic caused a jump/disqualification
        const globalRuleMet = evaluateGlobalLogic();
        if (globalRuleMet) {
            console.log('[Debug STM] handleNext: Global rule met:', globalRuleMet);
            if (globalRuleMet.action === 'disqualify') {
                setIsDisqualified(true);
                setDisqualificationMessage(globalRuleMet.disqualificationMessage || survey?.settings?.terminationPages?.disqualified || 'Thank you for your time. You do not qualify for the remainder of this survey.');
                return;
            } else if (globalRuleMet.action === 'skip-to' && globalRuleMet.targetQuestionId) {
                 const targetOriginalIndex = questionIdToOriginalIndexMap[globalRuleMet.targetQuestionId];
                 const targetVisibleIndex = visibleQuestionIndices.indexOf(targetOriginalIndex);
                 if (targetVisibleIndex !== -1) {
                    setVisitedPath(prev => [...prev, currentOriginalIdx]);
                    setCurrentVisibleIndex(targetVisibleIndex);
                    return;
                 }
            }
        }

        if (currentVisibleIndex < visibleQuestionIndices.length - 1) {
            setVisitedPath(prev => [...prev, currentOriginalIdx]);
            setCurrentVisibleIndex(prev => prev + 1);
        } else {
            // This means it's the last question and no logic jumped, so it's ready for submit state
            console.log('[Debug STM] handleNext: Reached end of visible questions.');
            setVisitedPath(prev => [...prev, currentOriginalIdx]);
            // The isSubmitStateDerived useMemo should handle this transition
        }
    }, [currentVisibleIndex, visibleQuestionIndices, isDisqualified, isLoading, originalQuestions, currentAnswers, validateQuestion, evaluateGlobalLogic, evaluateActionLogic, questionIdToOriginalIndexMap, survey, setIsDisqualified, setDisqualificationMessage, setCurrentVisibleIndex, setVisitedPath]);
    
    const handleInputChange = useCallback((questionId, value) => {
        console.log(`[Debug STM] handleInputChange: Q_ID=${questionId}, New Value=`, value);
        setCurrentAnswers(prevAnswers => ({ ...prevAnswers, [questionId]: value }));
        
        const question = questionsById[questionId];
        if (autoAdvanceState && question) {
            const questionOriginalIndex = questionIdToOriginalIndexMap[questionId];
            const isCurrentQuestionDisabled = evaluateDisabled(questionOriginalIndex);
            if (!isCurrentQuestionDisabled) {
                if (question.type === 'multiple-choice' || question.type === 'nps' || (question.type === 'rating' && !question.allowComments)) {
                    if (autoAdvanceTimeoutRef.current) clearTimeout(autoAdvanceTimeoutRef.current);
                    autoAdvanceTimeoutRef.current = setTimeout(() => {
                        console.log(`[Debug STM] Auto-advancing from Q_ID=${questionId}`);
                        handleNext();
                    }, 500); // 500ms delay for auto-advance
                }
            }
        }
    }, [questionsById, autoAdvanceState, handleNext, questionIdToOriginalIndexMap, evaluateDisabled]); // Added dependencies

    const handleCheckboxChange = useCallback((questionId, optionValue, isChecked) => {
        setCurrentAnswers(prevAnswers => {
            const currentSelection = prevAnswers[questionId] ? [...ensureArray(prevAnswers[questionId])] : [];
            let newSelection;
            if (isChecked) {
                newSelection = [...currentSelection, optionValue];
            } else {
                newSelection = currentSelection.filter(val => val !== optionValue);
            }
            // Handle 'Other' option text clearing if 'Other' is deselected
            if (optionValue === OTHER_VALUE_INTERNAL && !isChecked) {
                setOtherInputValues(prev => ({ ...prev, [questionId]: '' }));
            }
            return { ...prevAnswers, [questionId]: newSelection };
        });
    }, [OTHER_VALUE_INTERNAL, setOtherInputValues]); // Added setOtherInputValues

    const handleOtherInputChange = useCallback((questionId, textValue) => {
        setOtherInputValues(prev => ({ ...prev, [questionId]: textValue }));
    }, []);

    const renderQuestion = useCallback((questionToRenderArg) => {
        console.log('[Debug STM] renderQuestion CALLED with questionToRenderArg:', JSON.parse(JSON.stringify(questionToRenderArg)));
        if (!questionToRenderArg || !questionToRenderArg._id) { console.error("[Debug STM] renderQuestion: EXITING - Invalid questionToRenderArg:", questionToRenderArg); return <div className={styles.loading}>Error loading question content...</div>; }
        console.log(`[Debug STM] renderQuestion: Rendering Q_ID: ${questionToRenderArg._id}, Type: ${questionToRenderArg.type}`);
        if (!questionToRenderArg.type) { console.error(`[Debug STM] renderQuestion: EXITING - Question type missing for ID ${questionToRenderArg._id}.`); return <div>Error: Question type missing for ID {questionToRenderArg._id}.</div>; }
        
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
            isPreviewMode: location.state?.isPreviewingOwner || false, // Added isPreviewMode
        };
        console.log(`[Debug STM] renderQuestion: Common props for Q_ID ${question._id}:`, commonProps);
        
        switch (question.type) {
            case 'text': console.log('[Debug STM] renderQuestion: Matched type "text", rendering ShortTextQuestion.'); return <ShortTextQuestion {...commonProps} />;
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
            default: console.warn(`[Debug STM] renderQuestion: EXITING - Unsupported question type: ${question.type} for ID ${question._id}`); return <div>Unsupported question type: {question.type}</div>;
        }
    }, [currentAnswers, otherInputValues, handleInputChange, questionIdToOriginalIndexMap, handleCheckboxChange, handleOtherInputChange, randomizedOptionOrders, evaluateDisabled, qNumEnabledState, qNumFormatState, visibleQuestionIndices, toLetters, toRoman, location.state?.isPreviewingOwner]);
    
    const handlePrevious = useCallback(() => {
        if (isDisqualified || isLoading || currentVisibleIndex <= 0) return;
        const prevOriginalIndex = visitedPath[visitedPath.length - 1];
        const prevVisibleIndex = visibleQuestionIndices.indexOf(prevOriginalIndex);
        if (prevVisibleIndex !== -1) {
            setCurrentVisibleIndex(prevVisibleIndex);
            setVisitedPath(prev => prev.slice(0, -1));
        } else {
            // Fallback if something is wrong with visitedPath, go to previous sequential
            setCurrentVisibleIndex(prev => prev - 1);
        }
    }, [isDisqualified, isLoading, currentVisibleIndex, visitedPath, visibleQuestionIndices, setCurrentVisibleIndex, setVisitedPath]);

    const handleSubmit = useCallback(async (event) => {
        if (event) event.preventDefault();
        console.log('[Debug STM] handleSubmit CALLED.');
        setIsSubmitting(true); setError(null);

        if (recaptchaEnabled && recaptchaSiteKey && !recaptchaToken) {
            toast.error("Please complete the reCAPTCHA verification.");
            setIsSubmitting(false);
            return;
        }

        let allValid = true;
        // Validate all visible questions before submitting
        for (const originalIdx of visibleQuestionIndices) {
            const q = originalQuestions[originalIdx];
            const ans = currentAnswers[q._id];
            if (!validateQuestion(q, ans, false, true)) { // Use disqualificationCheck=true to avoid toast on submit validation
                allValid = false;
                // No toast here, rely on visual cues or a summary error
            }
        }
        if (!allValid) {
            toast.error("Please ensure all required questions are answered before submitting.");
            setIsSubmitting(false);
            return;
        }
        
        const submissionData = {
            surveyId,
            collectorId: actualCollectorObjectId || currentCollectorIdentifier, // Prefer actual ID if resolved
            answers: currentAnswers,
            otherInputValues,
            sessionId,
            startedAt: surveyStartedAt,
            completedAt: new Date().toISOString(),
            recaptchaToken: recaptchaEnabled ? recaptchaToken : undefined,
            customVariables: capturedCustomVars ? Object.fromEntries(capturedCustomVars) : {},
            resumedFromToken: currentResumeToken,
        };
        console.log('[Debug STM] Submitting data:', submissionData);

        try {
            const response = await surveyApiFunctions.submitSurveyResponse(submissionData);
            if (response && response.success) {
                toast.success("Survey submitted successfully!");
                const terminationUrl = survey?.settings?.terminationPages?.completed || collectorSettings?.thankYouPageUrl;
                if (terminationUrl && terminationUrl.startsWith('http')) {
                    window.location.href = terminationUrl;
                } else {
                    navigate(terminationUrl || `/survey/${surveyId}/thankyou`, { state: { surveyTitle: survey?.title } });
                }
            } else {
                throw new Error(response?.message || "Failed to submit survey.");
            }
        } catch (err) {
            console.error("Submission error:", err);
            setError(err.message || "An error occurred during submission.");
            toast.error(err.message || "An error occurred during submission.");
        } finally {
            setIsSubmitting(false);
        }
    }, [actualCollectorObjectId, collectorSettings, recaptchaEnabled, recaptchaToken, recaptchaSiteKey, visibleQuestionIndices, originalQuestions, validateQuestion, currentAnswers, questionsById, otherInputValues, sessionId, surveyId, navigate, questionIdToOriginalIndexMap, surveyStartedAt, OTHER_VALUE_INTERNAL, currentCollectorIdentifier, capturedCustomVars, currentResumeToken, setIsSubmitting, setError, survey, toast, currentSaveMethod, saveAndContinueEnabled]);

    const handleSavePartialResponse = async () => {
        console.log('[Debug STM] handleSavePartialResponse called.');
        console.log(`[Debug STM]   Current Save Method: ${currentSaveMethod}, Email: ${saveEmail}`);
        setIsSavingPartial(true); setError(null);
        const partialData = {
            surveyId,
            collectorId: actualCollectorObjectId || currentCollectorIdentifier,
            answers: currentAnswers,
            otherInputValues,
            currentVisibleIndex,
            visitedPath,
            sessionId,
            createdAt: surveyStartedAt, // or a new Date() if we want to update 'last saved at'
            hiddenQuestionIds: Array.from(hiddenQuestionIds),
            customVariables: capturedCustomVars ? Object.fromEntries(capturedCustomVars) : {},
        };
        try {
            const response = await surveyApiFunctions.savePartialResponse(partialData, currentSaveMethod, saveEmail || undefined);
            if (response && response.success) {
                setResumeCodeToDisplay(response.resumeToken || '');
                setResumeLinkToDisplay(response.resumeLink || '');
                setShowSaveModal(false);
                setShowResumeCodeInfo(true);
                toast.success("Progress saved!");
            } else {
                throw new Error(response?.message || "Failed to save progress.");
            }
        } catch (err) {
            console.error("Save partial error:", err);
            setError(err.message || "Could not save progress.");
            toast.error(err.message || "Could not save progress.");
        } finally {
            setIsSavingPartial(false);
            setSaveEmail(''); // Clear email field after attempt
        }
    };
    
    const renderProgressBar = () => {
        if (!progressBarEnabledState || !survey || visibleQuestionIndices.length === 0) return null;
        const totalVisibleQuestions = visibleQuestionIndices.length;
        const completedQuestions = currentVisibleIndex; // Assuming currentVisibleIndex is 0-based for questions up to, but not including, the current one
        let progress = 0;
        if (totalVisibleQuestions > 0) {
            progress = (completedQuestions / totalVisibleQuestions) * 100;
        }
         if (finalIsSubmitState) progress = 100; // Show 100% if on submit page

        return (
            <div className={`${styles.progressBarContainer} ${styles[progressBarPositionState]}`}>
                {progressBarStyleState === 'percentage' && <div className={styles.progressPercentage}>{Math.round(progress)}%</div>}
                <div className={styles.progressBarTrack}>
                    <div className={styles.progressBarFill} style={{ width: `${progress}%` }}></div>
                </div>
                {progressBarStyleState === 'detailed' && <div className={styles.progressDetailed}>{completedQuestions} / {totalVisibleQuestions} Questions</div>}
            </div>
        );
    };
    
    console.log('[Debug STM] After useCallback hooks, before main render logic.');
    
    console.log(`[Debug STM] Render: Top of render logic. surveyId=${surveyId}, isLoading=${isLoading}, survey=${!!survey}, error=${error}, hasAlreadyResponded=${hasAlreadyResponded}`);
    if (!surveyId) { console.log('[Debug STM] Render: No surveyId...'); return <div className={styles.errorContainer}><h2>Survey Not Specified</h2><p>No survey ID was provided.</p></div>; }
    if (hasAlreadyResponded) { console.log('[Debug STM] Render: Has already responded.'); return <div className={styles.errorContainer}><h2>Survey Completed</h2><p>{error || "You have already responded."}</p></div>; }
    
    // This is the main loading display when the component first mounts or when retrying
    if (isLoading && !survey && !error) { 
        console.log(`[Debug STM] Render: "Loading survey..." (Main loading display)`);
        return <div className={styles.loading}>Loading survey...</div>; 
    }
    if (error && !survey) { console.log(`[Debug STM] Render: Error before survey loaded: ${error}`); return <div className={styles.errorContainer}><h2>Error Loading Survey</h2><p>{error}</p><button onClick={() => { setIsLoading(true); setError(null); const controller = new AbortController(); fetchSurvey(controller.signal);}} className={styles.navButton}>Retry</button></div>; }
    if (!survey && !isLoading && !error) { console.log(`[Debug STM] Render: No survey, not loading, no error... (This indicates stubbed fetch or unexpected state)`); return <div className={styles.errorContainer}>Survey data could not be loaded. (Code: STP_NSNILE_STUB)</div>; } // Modified for stub
    if (isDisqualified) { console.log('[Debug STM] Render: Disqualified.'); return ( <div className={styles.surveyContainer}><h1 className={styles.surveyTitle}>{survey?.title||'Survey'}</h1><div className={styles.disqualifiedBox}><h2>Survey Ended</h2><p>{disqualificationMessage || "You do not qualify."}</p></div></div> ); }
    // If survey is null here, it means the stubbed fetchSurvey didn't set it, or a real fetch failed and error wasn't set.
    // For the stubbed version, survey will remain null.
    if (!survey && !isLoading) {
         console.log(`[Debug STM] Render: Survey is null, not loading. Displaying 'No question to display' due to stub or issue.`);
         // This will lead to "No question to display" because finalCurrentQToRender will be null
    }


    const finalCurrentQToRender = currentQToRenderMemoized;
    const finalIsSubmitState = isSubmitStateDerived; // This will be true if originalQuestions is empty (as with stub)
    const isCurrentQuestionDisabledBySetting = finalCurrentQToRender ? evaluateDisabled(questionIdToOriginalIndexMap[finalCurrentQToRender._id]) : false;
    const progressBarComponent = progressBarEnabledState && survey ? renderProgressBar() : null; // Ensure survey exists for progress bar
    
    console.log(`[Debug STM] FINAL RENDER PREP - SubmitState: ${finalIsSubmitState}, Q_ID: ${finalCurrentQToRender ? finalCurrentQToRender._id : 'undefined'}, CVI: ${currentVisibleIndex}, VQI_Len: ${visibleQuestionIndices.length}`);
    console.log('[Debug STM] Before main return statement (JSX).');

    return (
        <>
            <div className={styles.surveyContainer}>
                {progressBarPositionState === 'top' && progressBarComponent}
                <h1 className={styles.surveyTitle}>{survey?.title || 'Survey'}</h1>
                {(visitedPath.length === 0 || (visitedPath.length === 1 && currentVisibleIndex === 0 && visibleQuestionIndices.indexOf(visitedPath[0]) === 0 )) && survey?.description && <p className={styles.surveyDescription}>{survey.description}</p>}
                
                {/* Display error during survey taking, only if survey data has loaded */}
                {error && survey && <div className={styles.submissionError}><p>Error during survey: {error}</p></div>}

                {/* Loading message specific to when survey data is being processed but not yet ready to show questions */}
                {isLoading && survey && <div className={styles.loading}>Processing survey data...</div>}

                {/* Main question area or messages */}
                {!isLoading && ( // Only render this block if not in a top-level loading state
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
                            // If survey is null (e.g. stubbed fetch), this will be hit:
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
// ----- END OF COMPLETE MODIFIED FILE (vNext16.15.5 - Corrected and Complete - Stubbed fetchSurvey & Checkpoints) -----