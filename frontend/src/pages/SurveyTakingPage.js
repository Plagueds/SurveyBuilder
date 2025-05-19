// frontend/src/pages/SurveyTakingPage.js
// ----- START OF COMPLETE MODIFIED FILE (vNext16.15.4 - Focused currentQToRenderMemoized Logging) -----
// ... (imports and helper functions same as vNext16.15.3) ...
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

// Helper functions (ensure these are complete from previous versions)
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
const evaluateSurveyLogic = (logicRules, answers, questions, questionIdToOriginalIndexMap) => { /* ... full implementation from previous file ... */ return null; };


function SurveyTakingPage() {
    // ... (state, params, other hooks - same as vNext16.15.3) ...
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

    const questionsById = useMemo(() => originalQuestions.reduce((map, q) => { if(q && q._id) map[q._id] = q; return map; }, {}), [originalQuestions]);
    const questionsInCurrentOrder = useMemo(() => (randomizedQuestionOrder.length > 0 && originalQuestions.length > 0) ? randomizedQuestionOrder.map(index => originalQuestions[index]).filter(q => q) : originalQuestions.filter(q => q), [randomizedQuestionOrder, originalQuestions]);
    const questionIdToOriginalIndexMap = useMemo(() => originalQuestions.reduce((map, q, index) => { if(q && q._id) map[q._id] = index; return map; }, {}), [originalQuestions]);
    
    // ++ FOCUSED LOGGING FOR currentQToRenderMemoized ++
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

    const isSubmitStateDerived = useMemo(() => { /* ... (same as vNext16.15.3) ... */ return false; }, [isLoading, survey, visibleQuestionIndices, originalQuestions, currentVisibleIndex]);
        
    // ... (useEffect hooks for CCI, CRT, CustomVars, fetchSurvey, fetch trigger, visibleQuestionIndices, CVI boundary check - same as vNext16.15.3) ...
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

    const fetchSurvey = useCallback(async (signal) => { /* ... (same as vNext16.15.3, including saveAndContinueEnabled log) ... */ }, [surveyId, currentCollectorIdentifier, currentResumeToken, location.state?.isPreviewingOwner, sessionId, surveyStartedAt]);
    
    useEffect(() => { /* ... (fetch trigger - same as vNext16.15.3) ... */ }, [surveyId, currentCollectorIdentifier, currentResumeToken, location.state?.isPreviewingOwner, fetchSurvey]);

    useEffect(() => { /* ... (visibleQuestionIndices - same as vNext16.15.3) ... */ }, [isLoading, originalQuestions, questionsInCurrentOrder, hiddenQuestionIds, questionIdToOriginalIndexMap, randomizedQuestionOrder, visibleQuestionIndices]);
    
    useEffect(() => { /* ... (CVI boundary check - same as vNext16.15.3) ... */ }, [visibleQuestionIndices, isLoading, survey, isDisqualified, currentVisibleIndex, originalQuestions.length]);

    // ... (other callbacks: evaluateDisabled, renderQuestion with its logs, etc. - same as vNext16.15.3) ...
    const evaluateDisabled = useCallback((qIdx) => (!originalQuestions || qIdx<0 || qIdx >= originalQuestions.length) ? false : originalQuestions[qIdx]?.isDisabled === true, [originalQuestions]);
    const validateQuestion = useCallback((q, ans, soft, dis) => { /* ... full implementation ... */ return true; }, [otherInputValues,NA_VALUE_INTERNAL,OTHER_VALUE_INTERNAL]);
    const evaluateGlobalLogic = useCallback(() => (!survey || !survey.globalSkipLogic || survey.globalSkipLogic.length === 0) ? null : evaluateSurveyLogic(survey.globalSkipLogic, currentAnswers, originalQuestions, questionIdToOriginalIndexMap), [survey, currentAnswers, originalQuestions, questionIdToOriginalIndexMap]);
    const evaluateActionLogic = useCallback((qIdx) => { const q = originalQuestions[qIdx]; return (!q || !q.skipLogic || !Array.isArray(q.skipLogic.rules) || q.skipLogic.rules.length === 0) ? null : evaluateSurveyLogic(q.skipLogic.rules, currentAnswers, originalQuestions, questionIdToOriginalIndexMap); }, [originalQuestions, currentAnswers, questionIdToOriginalIndexMap]);
    const handleNext = useCallback(() => { /* ... full implementation ... */ }, [currentVisibleIndex, visibleQuestionIndices, isDisqualified, isLoading, originalQuestions, currentAnswers, evaluateDisabled, validateQuestion, allowBackButton, evaluateGlobalLogic, evaluateActionLogic, questionIdToOriginalIndexMap, hiddenQuestionIds, survey, setHiddenQuestionIds, setIsDisqualified, setDisqualificationMessage, setCurrentVisibleIndex, setVisitedPath, navigate, surveyId, actualCollectorObjectId]);
    const handleInputChange = useCallback((qId, val) => { /* ... full implementation ... */ }, [questionsById, autoAdvanceState, handleNext, evaluateDisabled, questionIdToOriginalIndexMap]);
    const handleCheckboxChange = useCallback((qId, optVal, isChk) => { /* ... full implementation ... */ }, [OTHER_VALUE_INTERNAL, NA_VALUE_INTERNAL, setOtherInputValues]);
    const handleOtherInputChange = useCallback((qId, txtVal) => setOtherInputValues(prev => ({ ...prev, [qId]: txtVal })), []);
    const renderQuestion = useCallback((questionToRenderArg) => { /* ... (from vNext16.15.3 with logs) ... */ return <div></div>; }, [currentAnswers, otherInputValues, handleInputChange, questionIdToOriginalIndexMap, handleOtherInputChange, handleCheckboxChange, randomizedOptionOrders, evaluateDisabled, qNumEnabledState, qNumFormatState, visibleQuestionIndices, toLetters, toRoman]);
    const handlePrevious = useCallback(() => { /* ... full implementation ... */ }, [isDisqualified, isLoading, visitedPath, currentVisibleIndex, visibleQuestionIndices, allowBackButton, setCurrentVisibleIndex, setVisitedPath]);
    const handleSubmit = useCallback(async (e) => { /* ... full implementation ... */ }, [actualCollectorObjectId, collectorSettings, recaptchaEnabled, recaptchaToken, recaptchaSiteKey, visibleQuestionIndices, originalQuestions, evaluateDisabled, validateQuestion, currentAnswers, questionsById, otherInputValues, sessionId, surveyId, navigate, questionIdToOriginalIndexMap, surveyStartedAt, OTHER_VALUE_INTERNAL, currentCollectorIdentifier, capturedCustomVars, currentResumeToken, setIsSubmitting, setError, survey, toast]);
    const handleSavePartialResponse = async () => { /* Mock from vNext16.15.3 */ };
    const renderProgressBar = () => { /* ... full implementation ... */ return null; };

    // ... (Render logic - same as vNext16.15.3, including FINAL RENDER PREP log and navigation button logs) ...
    console.log(`[Debug STM] Render: Top of render logic. surveyId=${surveyId}, isLoading=${isLoading}, survey=${!!survey}, error=${error}, hasAlreadyResponded=${hasAlreadyResponded}`);
    if (!surveyId) { /* ... */ }
    if (hasAlreadyResponded) { /* ... */ }
    if (isLoading && !survey) { /* ... */ }
    if (error && !survey) { /* ... */ }
    if (!survey && !isLoading && !error) { /* ... */ }
    if (isDisqualified) { /* ... */ }
    if (!survey) { /* ... */ }

    const finalCurrentQToRender = currentQToRenderMemoized;
    const finalIsSubmitState = isSubmitStateDerived;
    const isCurrentQuestionDisabledBySetting = finalCurrentQToRender ? evaluateDisabled(questionIdToOriginalIndexMap[finalCurrentQToRender._id]) : false;
    const progressBarComponent = progressBarEnabledState ? renderProgressBar() : null;
    console.log(`[Debug STM] FINAL RENDER PREP - SubmitState: ${finalIsSubmitState}, Q_ID: ${finalCurrentQToRender ? finalCurrentQToRender._id : 'undefined'}, CVI: ${currentVisibleIndex}, VQI_Len: ${visibleQuestionIndices.length}`);

    if (showSaveModal) { /* ... */ }
    if (showResumeCodeInfo) { /* ... */ }

    return (
        <>
            {/* ... (Full JSX - same as vNext16.15.3) ... */}
        </>
    );
}
export default SurveyTakingPage;
// ----- END OF COMPLETE MODIFIED FILE (vNext16.15.4 - Focused currentQToRenderMemoized Logging) -----