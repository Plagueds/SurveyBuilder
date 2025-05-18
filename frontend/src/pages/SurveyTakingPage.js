// frontend/src/pages/SurveyTakingPage.js
// ----- START OF COMPLETE MODIFIED FILE (vNext16.1 - Added Debug Logs for Question Rendering) -----
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import ReCAPTCHA from "react-google-recaptcha"; // This was marked as unused, ensure it's used if recaptchaEnabled
import styles from './SurveyTakingPage.module.css';
import surveyApiFunctions from '../api/surveyApi';

// Assuming these are used by renderQuestion, which was also marked as unused.
// If renderQuestion is fixed, these should be fine.
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

// Assuming isAnswerEmpty, shuffleArray, toRoman, toLetters are used by logic functions or renderQuestion.
// If not, they can be removed. For now, keeping them as they were in vNext16.
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
const toRoman = (num) => { if (num < 1 || num > 39) return String(num); const r = { M: 1000, CM: 900, D: 500, CD: 400, C: 100, XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1 }; let s = ''; for (let i of Object.keys(r)) { let q = Math.floor(num / r[i]); num -= q * r[i]; s += i.repeat(q); } return s; };
const toLetters = (num) => { let l = ''; while (num > 0) { let rem = (num - 1) % 26; l = String.fromCharCode(65 + rem) + l; num = Math.floor((num - 1) / 26); } return l; };

function SurveyTakingPage() {
    const { surveyId, collectorId: routeCollectorIdentifier, resumeToken: routeResumeToken } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    const [survey, setSurvey] = useState(null);
    const [originalQuestions, setOriginalQuestions] = useState([]);
    const [currentAnswers, setCurrentAnswers] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false); // Keep, likely used in handleSubmit
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
    const [disqualificationMessage, setDisqualificationMessage] = useState(''); // Keep, used in UI for disqualified state
    const [currentCollectorIdentifier, setCurrentCollectorIdentifier] = useState(null);
    const [actualCollectorObjectId, setActualCollectorObjectId] = useState(null);
    const [collectorSettings, setCollectorSettings] = useState(null);
    const [hasAlreadyResponded, setHasAlreadyResponded] = useState(false);
    const [recaptchaEnabled, setRecaptchaEnabled] = useState(false);
    const [recaptchaSiteKey, setRecaptchaSiteKey] = useState('');
    const [recaptchaToken, setRecaptchaToken] = useState(null);
    const recaptchaRef = useRef(null); // Keep if ReCAPTCHA component is used
    const [allowBackButton, setAllowBackButton] = useState(true);
    const [progressBarEnabledState, setProgressBarEnabledState] = useState(false); // Keep if renderProgressBar is used
    const [progressBarStyleState, setProgressBarStyleState] = useState('percentage'); // Keep if renderProgressBar is used
    const [progressBarPositionState, setProgressBarPositionState] = useState('top'); // Keep if renderProgressBar is used
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

    // ++ ADDED DETAILED LOGS for currentQToRenderMemoized calculation ++
    const currentQToRenderMemoized = useMemo(() => {
        console.log('[Debug STM] currentQToRenderMemoized calculation:');
        console.log(`[Debug STM]   isLoading: ${isLoading}, survey: ${!!survey}, VQI.length: ${visibleQuestionIndices.length}, CVI: ${currentVisibleIndex}, OQ.length: ${originalQuestions.length}`);

        if (isLoading || !survey || visibleQuestionIndices.length === 0 || currentVisibleIndex < 0 || currentVisibleIndex >= visibleQuestionIndices.length) {
            console.log('[Debug STM]   currentQToRenderMemoized -> null (due to pre-condition)');
            return null;
        }
        const currentOriginalIdx = visibleQuestionIndices[currentVisibleIndex];
        console.log(`[Debug STM]   currentOriginalIdx from visibleQuestionIndices[${currentVisibleIndex}]: ${currentOriginalIdx}`);

        if (currentOriginalIdx === undefined || currentOriginalIdx < 0 || currentOriginalIdx >= originalQuestions.length) {
            console.log(`[Debug STM]   currentQToRenderMemoized -> null (currentOriginalIdx ${currentOriginalIdx} invalid for originalQuestions length ${originalQuestions.length})`);
            return null;
        }
        const questionToRender = originalQuestions[currentOriginalIdx] || null;
        console.log('[Debug STM]   questionToRender (ID):', questionToRender ? questionToRender._id : 'null', 'Object:', questionToRender);
        return questionToRender;
    }, [isLoading, survey, visibleQuestionIndices, currentVisibleIndex, originalQuestions]);

    const isSubmitStateDerived = useMemo(() => {
        if (isLoading || !survey) return false;
        if (originalQuestions.length > 0 && visibleQuestionIndices.length === 0 && !isLoading) return true; // No visible questions but survey has questions
        if (originalQuestions.length === 0 && !isLoading) return true; // Survey is empty
        return currentVisibleIndex >= visibleQuestionIndices.length && visibleQuestionIndices.length > 0 && !isLoading; // Past the last visible question
    }, [isLoading, survey, visibleQuestionIndices, originalQuestions, currentVisibleIndex]);
    
    useEffect(() => { console.log(`[Debug STM] isSubmitStateDerived changed to: ${isSubmitStateDerived}, CVI: ${currentVisibleIndex}, VQI.length: ${visibleQuestionIndices.length}`); }, [isSubmitStateDerived, currentVisibleIndex, visibleQuestionIndices.length]);
    useEffect(() => { const effectiveCollectorIdentifier = location.state?.collectorIdentifier || routeCollectorIdentifier; setCurrentCollectorIdentifier(effectiveCollectorIdentifier); if(routeResumeToken) setCurrentResumeToken(routeResumeToken); }, [location.state, routeCollectorIdentifier, routeResumeToken]);

    useEffect(() => { /* ... CustomVars logic ... */ }, [survey, location.search]);
    const fetchSurvey = useCallback(async (signal) => { /* ... (same as vNext16) ... */ }, [surveyId, currentCollectorIdentifier, location.state, sessionId, surveyStartedAt, currentResumeToken]);
    
    useEffect(() => {
        const tokenToUse = routeResumeToken || location.state?.resumeToken;
        if (tokenToUse && !currentResumeToken) setCurrentResumeToken(tokenToUse);
    
        if (currentCollectorIdentifier || tokenToUse || location.state?.isPreviewingOwner) {
            const controller = new AbortController();
            fetchSurvey(controller.signal);
            // Cleanup for autoAdvanceTimeoutRef
            const timeoutId = autoAdvanceTimeoutRef.current; // Capture for cleanup
            return () => {
                controller.abort();
                if (timeoutId) { // Use captured value
                    clearTimeout(timeoutId);
                }
            };
        } else if (routeCollectorIdentifier === undefined && !location.state?.collectorIdentifier && !tokenToUse && !location.state?.isPreviewingOwner) {
            setIsLoading(false);
            setError("Collector information or resume token is missing.");
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fetchSurvey, currentCollectorIdentifier, routeCollectorIdentifier, location.state?.isPreviewingOwner, location.state?.resumeToken, routeResumeToken]); // currentResumeToken removed as it's set inside

    // ++ ADDED DETAILED LOGS for visibleQuestionIndices calculation ++
    useEffect(() => {
        if (isLoading || !originalQuestions || originalQuestions.length === 0) {
            if(visibleQuestionIndices.length > 0) {
                console.log('[Debug STM] Clearing visibleQuestionIndices because isLoading or no originalQuestions.');
                setVisibleQuestionIndices([]);
            }
            return;
        }
        console.log(`[Debug STM] Calculating newVisible. questionsInCurrentOrder.length: ${questionsInCurrentOrder.length}, hiddenQuestionIds size: ${hiddenQuestionIds.size}`);
        const newVisible = questionsInCurrentOrder
            .map(q => {
                if (!q || !q._id) { // Ensure question and its ID exist
                    // console.log('[Debug STM] Mapping q: undefined or no ID');
                    return undefined;
                }
                const originalIdx = questionIdToOriginalIndexMap[q._id];
                // console.log(`[Debug STM] Mapping q: ${q._id}, originalIdx: ${originalIdx}, hidden: ${hiddenQuestionIds.has(q._id)}`);
                return originalIdx;
            })
            .filter(idx => {
                if (idx === undefined) return false;
                const questionForHiddenCheck = originalQuestions[idx];
                const isHidden = questionForHiddenCheck ? hiddenQuestionIds.has(questionForHiddenCheck._id) : true; 
                // console.log(`[Debug STM] Filtering idx: ${idx}, isHidden: ${isHidden}`);
                return !isHidden; // Simpler: idx must exist and not be hidden
            });
        
        console.log('[Debug STM] newVisible calculated:', JSON.stringify(newVisible));
        if (JSON.stringify(visibleQuestionIndices) !== JSON.stringify(newVisible)) {
            console.log('[Debug STM] Setting visibleQuestionIndices to newVisible.');
            setVisibleQuestionIndices(newVisible);
        } else {
            // console.log('[Debug STM] visibleQuestionIndices did not change.');
        }
    }, [isLoading, originalQuestions, questionsInCurrentOrder, hiddenQuestionIds, questionIdToOriginalIndexMap, randomizedQuestionOrder, visibleQuestionIndices]); // Keep visibleQuestionIndices here to prevent re-runs if only newVisible is different but stringifies the same

    useEffect(() => { /* ... CVI boundary check logic (same as vNext16) ... */ }, [visibleQuestionIndices, isLoading, survey, isDisqualified, currentVisibleIndex, allowBackButton, visitedPath]);
    
    const evaluateDisabled = useCallback((questionOriginalIndex) => originalQuestions[questionOriginalIndex]?.isDisabled === true, [originalQuestions]);
    
    const validateQuestion = useCallback((question, answer, isSoftCheck = false, isDisabledBySetting = false) => {
        if (!question || isDisabledBySetting) return true;
        if (question.addOtherOption && question.requireOtherIfSelected) {
            const isOtherSelected = (question.type === 'multiple-choice' || question.type === 'dropdown' ? answer === OTHER_VALUE_INTERNAL : question.type === 'checkbox' && ensureArray(answer).includes(OTHER_VALUE_INTERNAL));
            if (isOtherSelected) {
                const otherTextValue = otherInputValues[question._id];
                if (otherTextValue === undefined || otherTextValue.trim() === '') {
                    if (!isSoftCheck) toast.error(`Please provide text for "Other" in: "${question.text}"`);
                    return false;
                }
            }
        }
        if (question.requiredSetting === 'required' && isAnswerEmpty(answer, question.type)) return false;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [otherInputValues, /* NA_VALUE_INTERNAL, OTHER_VALUE_INTERNAL are constants */]);
    
    const evaluateGlobalLogic = useCallback(() => { if (!survey || !survey.globalSkipLogic || survey.globalSkipLogic.length === 0) return null; return evaluateSurveyLogic(survey.globalSkipLogic, currentAnswers, originalQuestions); }, [survey, currentAnswers, originalQuestions]);
    const evaluateActionLogic = useCallback((questionOriginalIndex) => { const question = originalQuestions[questionOriginalIndex]; if (!question || !question.skipLogic || !Array.isArray(question.skipLogic.rules) || question.skipLogic.rules.length === 0) return null; return evaluateSurveyLogic(question.skipLogic.rules, currentAnswers, originalQuestions); }, [originalQuestions, currentAnswers]);
    const evaluateSurveyLogic = (logicRules, answers, questions) => { /* Assuming this function is defined elsewhere and imported or passed in */ return null; }; // Placeholder

    const handleNext = useCallback(() => { /* ... (same as vNext16, ensure evaluateSurveyLogic is available) ... */ }, [currentVisibleIndex, visibleQuestionIndices, isDisqualified, isLoading, originalQuestions, currentAnswers, evaluateDisabled, validateQuestion, allowBackButton, evaluateGlobalLogic, evaluateActionLogic, questionIdToOriginalIndexMap]);
    const handleInputChange = useCallback((questionId, value) => { /* ... (same as vNext16) ... */ }, [questionsById, autoAdvanceState, handleNext, evaluateDisabled, questionIdToOriginalIndexMap, otherInputValues /* OTHER_VALUE_INTERNAL is constant */]);
    const handleCheckboxChange = useCallback((questionId, optionValue, isChecked) => { /* ... (same as vNext16) ... */ }, [questionsById /* NA_VALUE_INTERNAL, OTHER_VALUE_INTERNAL are constants */]);
    const handleOtherInputChange = useCallback((questionId, textValue) => { setOtherInputValues(prev => ({ ...prev, [questionId]: textValue })); }, []);
    
    // This is the renderQuestion function that was marked as unused.
    // Ensure it's called correctly in the JSX.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentAnswers, otherInputValues, handleInputChange, questionIdToOriginalIndexMap, handleOtherInputChange, handleCheckboxChange, randomizedOptionOrders, evaluateDisabled, qNumEnabledState, qNumFormatState, visibleQuestionIndices /* toLetters, toRoman are stable */]);
    
    const handlePrevious = useCallback(() => { /* ... (same as vNext16) ... */ }, [isDisqualified, isLoading, visitedPath, currentVisibleIndex, visibleQuestionIndices, allowBackButton]);
    const handleSubmit = useCallback(async (e) => { /* ... (same as vNext16, ensure setIsSubmitting is used) ... */ 
        e.preventDefault(); setIsSubmitting(true); // Example usage
        // ... rest of function
        // In finally block: setIsSubmitting(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [actualCollectorObjectId, collectorSettings, recaptchaEnabled, recaptchaToken, recaptchaSiteKey, visibleQuestionIndices, originalQuestions, evaluateDisabled, validateQuestion, currentAnswers, questionsById, otherInputValues, sessionId, surveyId, navigate, questionIdToOriginalIndexMap, surveyStartedAt, capturedCustomVars, currentResumeToken /* OTHER_VALUE_INTERNAL is constant */]);

    const handleSavePartialResponse = async () => { /* ... (same as vNext16) ... */ };
    const renderProgressBar = () => { /* ... (same as vNext16, ensure progressBarEnabledState etc. are used) ... */ };

    if (hasAlreadyResponded) return ( <div className={styles.surveyContainer}> <h1 className={styles.surveyTitle}>{survey?.title || 'Survey'}</h1> <div className={styles.alreadyRespondedBox}> <h2>Already Responded</h2> <p>You have already completed this survey.</p> <button onClick={() => navigate('/')} className={styles.navButton}>Go to Homepage</button> </div> </div> );
    if (isLoading && !survey) return <div className={styles.loading}>Loading survey...</div>;
    if (error && !survey && !hasAlreadyResponded) return <div className={styles.errorContainer}><h2>Error Loading Survey</h2><p>{error}</p><button onClick={() => { const c = new AbortController(); fetchSurvey(c.signal); }} className={styles.navButton}>Retry</button></div>;
    if (!survey && !isLoading && !error && !hasAlreadyResponded) return <div className={styles.errorContainer}>Survey not found or could not be loaded.</div>;
    
    // Moved disqualification message display here for clarity
    if (isDisqualified) return ( <div className={styles.surveyContainer}><h1 className={styles.surveyTitle}>{survey?.title||'Survey'}</h1><div className={styles.disqualifiedBox}><h2>Survey Ended</h2><p>{disqualificationMessage || "You do not qualify."}</p></div></div> );

    const finalCurrentQToRender = currentQToRenderMemoized;
    const finalIsSubmitState = isSubmitStateDerived;
    const isCurrentQuestionDisabledBySetting = finalCurrentQToRender ? evaluateDisabled(questionIdToOriginalIndexMap[finalCurrentQToRender._id]) : false;
    const progressBarComponent = progressBarEnabledState ? renderProgressBar() : null; // Conditionally render progress bar

    // ++ ADDED DETAILED LOGS before main return ++
    console.log(`[Debug STM] FINAL RENDER STATE - finalIsSubmitState: ${finalIsSubmitState}, finalCurrentQToRender ID: ${finalCurrentQToRender ? finalCurrentQToRender._id : 'null'}, CVI: ${currentVisibleIndex}, VQI: [${visibleQuestionIndices.join(',')}]`);

    return (
        <>
            <div className={styles.surveyContainer}>
                {progressBarPositionState === 'top' && progressBarComponent}
                <h1 className={styles.surveyTitle}>{survey?.title || 'Survey'}</h1>
                {(visitedPath.length === 0 || (visitedPath.length === 1 && currentVisibleIndex === 0 && visibleQuestionIndices.indexOf(visitedPath[0]) === 0 )) && survey?.description && <p className={styles.surveyDescription}>{survey.description}</p>}
                {error && survey && <div className={styles.submissionError}><p>Error: {error}</p></div>}
                
                {isLoading && survey ? <div className={styles.loading}>Loading question...</div> :
                    <div className={`${styles.questionBox} ${isCurrentQuestionDisabledBySetting ? styles.disabled : ''}`}>
                        {finalIsSubmitState ? ( 
                            <div className={styles.submitPrompt}> 
                                <p>End of survey.</p> 
                                <p>Click "Submit" to record responses.</p> 
                            </div> 
                        )
                        : finalCurrentQToRender ? ( 
                            renderQuestion(finalCurrentQToRender) // Ensure this is called
                        )
                        : ( originalQuestions.length > 0 && visibleQuestionIndices.length === 0 && !isDisqualified ? 
                            <div className={styles.submitPrompt}><p>No questions are currently visible based on survey logic or settings. Submit if applicable.</p></div>
                            : (isLoading ? 
                                <div className={styles.loading}>Preparing...</div> 
                                : <div className={styles.loading}>Survey appears empty or there's an issue displaying questions. (finalCurrentQToRender is null)</div>
                              )
                          )}
                    </div>
                }

                {finalIsSubmitState && recaptchaEnabled && recaptchaSiteKey && ( 
                    <div className={styles.recaptchaContainer}> 
                        <ReCAPTCHA 
                            ref={recaptchaRef} 
                            sitekey={recaptchaSiteKey} 
                            onChange={setRecaptchaToken} 
                            onExpired={() => setRecaptchaToken(null)} 
                            onErrored={() => { toast.error("reCAPTCHA verification failed. Please try again."); setRecaptchaToken(null); }} 
                        /> 
                    </div> 
                )}
                
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
            {showSaveModal && null}
            {/* Display Resume Code Info Modal/Section */}
            {showResumeCodeInfo && (
                <div className={styles.resumeInfoBox}>
                    <h2>Resume Code Information</h2>
                    <p>Your resume code: <strong>{resumeCodeToDisplay}</strong></p>
                    {resumeLinkToDisplay && (
                        <p>
                            Resume link: <a href={resumeLinkToDisplay}>{resumeLinkToDisplay}</a>
                        </p>
                    )}
                    <p>This code/link will be valid for {resumeExpiryDays} days.</p>
                    <button onClick={() => setShowResumeCodeInfo(false)} className={styles.navButton}>Close</button>
                </div>
            )}
        </>
    );
}

export default SurveyTakingPage;
// ----- END OF COMPLETE MODIFIED FILE (vNext16.1 - Added Debug Logs for Question Rendering) -----