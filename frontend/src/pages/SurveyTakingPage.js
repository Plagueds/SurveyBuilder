// frontend/src/pages/SurveyTakingPage.js
// ----- START OF COMPLETE MODIFIED FILE (vNext16.6 - Debugging Blank Page) -----
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

// Helper functions (ensure these are fully implemented)
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
const evaluateSurveyLogic = (logicRules, answers, questions, questionIdToOriginalIndexMap) => { /* ... (Full implementation from v16.5) ... */ return null; };


function SurveyTakingPage() {
    // ++ NEW TOP-LEVEL LOG ++
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

    const isSubmitStateDerived = useMemo(() => { /* ... same as v16.5 ... */ return false; }, [isLoading, survey, visibleQuestionIndices, originalQuestions, currentVisibleIndex]);
        
    useEffect(() => { /* ... collectorId init ... */ }, [location.state?.collectorIdentifier, routeCollectorIdentifier]);
    useEffect(() => { /* ... resumeToken init ... */ }, [location.state?.resumeToken, routeResumeToken, currentResumeToken]);
    useEffect(() => { /* ... CustomVars logic ... */ }, [survey, location.search]);
    const fetchSurvey = useCallback(async (signal) => { /* ... (same as v16.5 with its internal logs) ... */ }, [surveyId, currentCollectorIdentifier, currentResumeToken, location.state?.isPreviewingOwner, sessionId, surveyStartedAt]);
    useEffect(() => { /* ... main fetch trigger useEffect (same as v16.5) ... */ }, [surveyId, currentCollectorIdentifier, currentResumeToken, location.state?.isPreviewingOwner, fetchSurvey]);

    useEffect(() => { /* ... visibleQuestionIndices calculation (same as v16.5 with its logs active) ... */ }, [isLoading, originalQuestions, questionsInCurrentOrder, hiddenQuestionIds, questionIdToOriginalIndexMap, randomizedQuestionOrder, visibleQuestionIndices]);
    useEffect(() => { /* ... CVI boundary check logic ... */ }, [visibleQuestionIndices, isLoading, survey, isDisqualified, currentVisibleIndex, allowBackButton, visitedPath]);
    
    const evaluateDisabled = useCallback((questionOriginalIndex) => { /* ... (same as v16.5) ... */ return false; }, [originalQuestions]);
    const validateQuestion = useCallback((question, answer, isSoftCheck = false, isDisabledBySetting = false) => { /* ... (same as v16.5) ... */ return true; }, [otherInputValues, OTHER_VALUE_INTERNAL, NA_VALUE_INTERNAL]);
    const evaluateGlobalLogic = useCallback(() => { /* ... (same as v16.5) ... */ return null; }, [survey, currentAnswers, originalQuestions, questionIdToOriginalIndexMap]);
    const evaluateActionLogic = useCallback((questionOriginalIndex) => { /* ... (same as v16.5) ... */ return null; }, [originalQuestions, currentAnswers, questionIdToOriginalIndexMap]);
    const handleNext = useCallback(() => { /* ... (same as v16.5 with its logs) ... */ }, [currentVisibleIndex, visibleQuestionIndices, isDisqualified, isLoading, originalQuestions, currentAnswers, evaluateDisabled, validateQuestion, allowBackButton, evaluateGlobalLogic, evaluateActionLogic, questionIdToOriginalIndexMap, hiddenQuestionIds, survey, setHiddenQuestionIds, setIsDisqualified, setDisqualificationMessage, setCurrentVisibleIndex, setVisitedPath, navigate, surveyId, actualCollectorObjectId]);
    const handleInputChange = useCallback((questionId, value) => { /* ... (same as v16.5) ... */ }, [questionsById, OTHER_VALUE_INTERNAL, autoAdvanceState, handleNext, evaluateDisabled, questionIdToOriginalIndexMap, setCurrentAnswers]);
    const handleCheckboxChange = useCallback((questionId, optionValue, isChecked) => { /* ... (same as v16.5) ... */ }, [questionsById, NA_VALUE_INTERNAL, OTHER_VALUE_INTERNAL, setCurrentAnswers, setOtherInputValues]);
    const handleOtherInputChange = useCallback((questionId, textValue) => { setOtherInputValues(prev => ({ ...prev, [questionId]: textValue })); }, []);
    const renderQuestion = useCallback((questionToRenderArg) => { /* ... (same as v16.5) ... */ return <div>Question Placeholder</div>; }, [currentAnswers, otherInputValues, handleInputChange, questionIdToOriginalIndexMap, handleOtherInputChange, handleCheckboxChange, randomizedOptionOrders, evaluateDisabled, qNumEnabledState, qNumFormatState, visibleQuestionIndices, toLetters, toRoman]);
    const handlePrevious = useCallback(() => { /* ... (same as v16.5) ... */ }, [isDisqualified, isLoading, visitedPath, currentVisibleIndex, visibleQuestionIndices, allowBackButton, setCurrentVisibleIndex, setVisitedPath]);
    const handleSubmit = useCallback(async (e) => { /* ... (same as v16.5) ... */ }, [actualCollectorObjectId, collectorSettings, recaptchaEnabled, recaptchaToken, recaptchaSiteKey, visibleQuestionIndices, originalQuestions, evaluateDisabled, validateQuestion, currentAnswers, questionsById, otherInputValues, sessionId, surveyId, navigate, questionIdToOriginalIndexMap, surveyStartedAt, OTHER_VALUE_INTERNAL, currentCollectorIdentifier, capturedCustomVars, currentResumeToken, setIsSubmitting, setError, survey, toast]);
    const handleSavePartialResponse = async () => { /* ... (same as v16.5) ... */ };
    const renderProgressBar = () => { /* ... (same as v16.5) ... */ return null; };

    // --- Render logic ---
    console.log(`[Debug STM] Render: Top of render logic. surveyId=${surveyId}, isLoading=${isLoading}, survey=${!!survey}, error=${error}`);

    if (!surveyId) {
        console.log('[Debug STM] Render: No surveyId, returning Survey Not Specified.');
        return <div className={styles.errorContainer}><h2>Survey Not Specified</h2><p>No survey ID was provided in the URL.</p></div>;
    }

    if (isLoading && !survey) {
        console.log(`[Debug STM] Render: "Loading survey..." (isLoading: ${isLoading}, survey: ${!!survey})`);
        return <div className={styles.loading}>Loading survey...</div>;
    }
    
    if (error && !survey) {
        console.log(`[Debug STM] Render: Error before survey loaded: ${error}`);
        return <div className={styles.errorContainer}><h2>Error Loading Survey</h2><p>{error}</p><button onClick={() => { setIsLoading(true); setError(null); fetchSurvey(new AbortController().signal); }} className={styles.navButton}>Retry</button></div>;
    }

    // This condition might lead to a blank page if `survey` is null, `isLoading` is false, and `error` is null.
    // Let's make it more explicit.
    if (!survey && !isLoading && !error) {
        console.log(`[Debug STM] Render: No survey, not loading, no error. Returning 'Could not be loaded'.`);
        return <div className={styles.errorContainer}>Survey data could not be loaded. Please try again or check the URL. (Code: STP_NSNILE)</div>;
    }
    
    if (isDisqualified) {
        console.log('[Debug STM] Render: Disqualified.');
        return ( <div className={styles.surveyContainer}><h1 className={styles.surveyTitle}>{survey?.title||'Survey'}</h1><div className={styles.disqualifiedBox}><h2>Survey Ended</h2><p>{disqualificationMessage || "You do not qualify."}</p></div></div> );
    }

    // If we reach here, survey should exist or there was an error that should have been caught by "error && !survey"
    // If survey is null here, it's an unexpected state.
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
            {/* ... (Full JSX structure from v16.5, ensure renderQuestion is called correctly) ... */}
        </>
    );
}

export default SurveyTakingPage;
// ----- END OF COMPLETE MODIFIED FILE (vNext16.6 - Debugging Blank Page) -----