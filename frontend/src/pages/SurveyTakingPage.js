// frontend/src/pages/SurveyTakingPage.js
// ----- START OF COMPLETE MODIFIED FILE (v1.9 - Allow Multiple Responses Logic & pass startedAt) -----
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import ReCAPTCHA from "react-google-recaptcha";
// ... (DND and other imports remain the same)
import {
    DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragOverlay,
} from '@dnd-kit/core';
import {
    arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, rectSortingStrategy, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import styles from './SurveyTakingPage.module.css';
import * as surveyApi from '../api/surveyApi';

// --- Import Question Type Components ---
import ShortTextQuestion from '../components/survey_question_renders/ShortTextQuestion';
import TextAreaQuestion from '../components/survey_question_renders/TextAreaQuestion';
import MultipleChoiceQuestion from '../components/survey_question_renders/MultipleChoiceQuestion';
import CheckboxQuestion from '../components/survey_question_renders/CheckboxQuestion';
import DropdownQuestion from '../components/survey_question_renders/DropdownQuestion';
import RatingQuestion from '../components/survey_question_renders/RatingQuestion';
import NpsQuestion from '../components/survey_question_renders/NpsQuestion';
// --- Inline Helper Components (Slider, Matrix, etc. - no changes to their definitions) ---
const SliderQuestion = ({ question, value, onChange, disabled }) => { /* ... */ };
const MatrixQuestion = ({ question, value, onChange, disabled }) => { /* ... */ };
const HeatmapQuestion = ({ question, value, onChange, disabled }) => { /* ... */ };
const MaxDiffQuestion = ({ question, value, onChange, disabled }) => { /* ... */ };
const ConjointQuestion = ({ question, value, onChange, disabled }) => { /* ... */ };
function SortableRankingItem({ id, children }) { /* ... */ }
const RankingQuestion = ({ question, value, onChange, disabled }) => { /* ... */ };
const CARD_SORT_UNASSIGNED_ID = '__UNASSIGNED__'; const CARD_SORT_USER_CATEGORY_PREFIX = '__USER_CAT__';
function SortableCard({ id, children, isOverlay }) { /* ... */ }
function CardSortCategoryDropzone({ id, title, cards, children, onRemoveCategory, isUserCategory }) { /* ... */ }
const CardSortQuestion = ({ question, value, onChange, disabled }) => { /* ... */ };

// --- Utility Functions (ensureArray, isAnswerEmpty, shuffleArray - no changes) ---
const ensureArray = (value) => (Array.isArray(value) ? value : []);
const isAnswerEmpty = (value, questionType) => { /* ... */ };
const shuffleArray = (array) => { /* ... */ };

// --- Logic Evaluation Helpers (evaluateCondition, evaluateGroup, evaluateRule - no changes) ---
const evaluateCondition = (condition, allAnswers, questionsById) => { /* ... */ };
const evaluateGroup = (group, allAnswers, questionsById) => { /* ... */ };
const evaluateRule = (rule, allAnswers, questionsById) => { /* ... */ };


// --- Main Survey Taking Page Component ---
function SurveyTakingPage() {
    const { surveyId, collectorId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    const [survey, setSurvey] = useState(null);
    const [originalQuestions, setOriginalQuestions] = useState([]);
    const [currentAnswers, setCurrentAnswers] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [sessionId] = useState(() => Date.now().toString(36) + Math.random().toString(36).substring(2));
    const [surveyStartedAt] = useState(() => new Date().toISOString()); // <<<--- ADDED: Track survey start time
    const [otherInputValues, setOtherInputValues] = useState({});
    const [randomizedQuestionOrder, setRandomizedQuestionOrder] = useState([]);
    const [randomizedOptionOrders, setRandomizedOptionOrders] = useState({});
    const [hiddenQuestionIds, setHiddenQuestionIds] = useState(new Set());
    const [visibleQuestionIndices, setVisibleQuestionIndices] = useState([]);
    const [currentVisibleIndex, setCurrentVisibleIndex] = useState(0);
    const [visitedPath, setVisitedPath] = useState([]);
    const [isDisqualified, setIsDisqualified] = useState(false);
    const [disqualificationMessage, setDisqualificationMessage] = useState('');
    const [hasAlreadyResponded, setHasAlreadyResponded] = useState(false); // <<<--- ADDED: For multiple response check

    const [recaptchaEnabled, setRecaptchaEnabled] = useState(false);
    const [recaptchaSiteKey, setRecaptchaSiteKey] = useState('');
    const [recaptchaToken, setRecaptchaToken] = useState(null);
    const recaptchaRef = React.createRef();

    const NA_VALUE_INTERNAL = '__NA__';
    const OTHER_VALUE_INTERNAL = '__OTHER__';

    const questionsById = useMemo(() => originalQuestions.reduce((map, q) => { if(q) map[q._id] = q; return map; }, {}), [originalQuestions]);
    const questionsInCurrentOrder = useMemo(() => (randomizedQuestionOrder.length > 0 && originalQuestions.length > 0) ? randomizedQuestionOrder.map(index => originalQuestions[index]).filter(q => q) : originalQuestions.filter(q => q), [randomizedQuestionOrder, originalQuestions]);
    const questionIdToOriginalIndexMap = useMemo(() => originalQuestions.reduce((map, q, index) => { if(q) map[q._id] = index; return map; }, {}), [originalQuestions]);
    
    let currentQToRenderMemoized = null; let isSubmitStateDerived = false; if (!isLoading && survey) { const localCVI = currentVisibleIndex; if (visibleQuestionIndices.length === 0 && originalQuestions.length > 0) { isSubmitStateDerived = true; } else if (visibleQuestionIndices.length === 0 && originalQuestions.length === 0) { isSubmitStateDerived = true; } else if (localCVI >= 0 && localCVI < visibleQuestionIndices.length) { const currentOriginalIdx = visibleQuestionIndices[localCVI]; currentQToRenderMemoized = originalQuestions[currentOriginalIdx]; } else if (localCVI >= visibleQuestionIndices.length && originalQuestions.length > 0) { isSubmitStateDerived = true; } }
    
    useEffect(() => {
        const collectorSettings = location.state?.collectorSettings || {};
        console.log("[SurveyTakingPage] CollectorSettings from location state:", collectorSettings);

        // --- Multiple Response Check ---
        if (collectorSettings.allowMultipleResponses === false && collectorId) {
            const storageKey = `survey_${collectorId}_submitted`;
            if (localStorage.getItem(storageKey) === 'true') {
                setHasAlreadyResponded(true);
                // No need to fetch survey if already responded and not allowed multiple.
                // Error state will be handled by the render logic.
                setIsLoading(false); // Stop loading as we won't fetch.
                return; 
            }
        }
        setHasAlreadyResponded(false); // Ensure it's false if check passes or not applicable

        // --- reCAPTCHA Setup ---
        setRecaptchaEnabled(Boolean(collectorSettings.enableRecaptcha));
        if (collectorSettings.enableRecaptcha && collectorSettings.recaptchaSiteKey) {
            setRecaptchaSiteKey(collectorSettings.recaptchaSiteKey);
        } else {
            const envSiteKey = process.env.REACT_APP_RECAPTCHA_SITE_KEY;
            if (envSiteKey) {
                setRecaptchaSiteKey(envSiteKey);
                if (collectorSettings.enableRecaptcha === undefined && !collectorSettings.recaptchaSiteKey) {
                    // If enableRecaptcha wasn't explicitly in settings, but site key exists in ENV, enable it.
                    // This provides a fallback if settings aren't perfectly passed.
                    setRecaptchaEnabled(true); 
                }
            } else {
                if (collectorSettings.enableRecaptcha) { // If settings say enable but no key found
                    console.warn("[SurveyTakingPage] reCAPTCHA enabled by collector, but no site key found (settings or ENV).");
                    setRecaptchaEnabled(false); // Can't enable without a key
                }
            }
        }
    }, [location.state, collectorId]); // Added collectorId dependency

    const fetchSurvey = useCallback(async () => {
        // If already responded and not allowed, don't fetch.
        if (location.state?.collectorSettings?.allowMultipleResponses === false && localStorage.getItem(`survey_${collectorId}_submitted`) === 'true') {
            setHasAlreadyResponded(true);
            setIsLoading(false);
            return;
        }

        setIsLoading(true); setError(null); setHiddenQuestionIds(new Set()); setIsDisqualified(false); setCurrentVisibleIndex(0); setVisitedPath([]); setRecaptchaToken(null);
        if (!surveyId) { setError("Survey ID is missing."); setIsLoading(false); return; }
        try {
            const responsePayload = await surveyApi.getSurveyById(surveyId);
            if (!responsePayload || !responsePayload.success || !responsePayload.data) {
                throw new Error(responsePayload?.message || "Failed to retrieve survey data.");
            }
            const surveyData = responsePayload.data;
            if (!surveyData || surveyData.questions === undefined || !Array.isArray(surveyData.questions)) {
                throw new Error("Survey data is malformed (missing or invalid 'questions' field).");
            }
            setSurvey({ _id: surveyData._id, title: surveyData.title, description: surveyData.description, randomizationType: surveyData.randomizationLogic?.type || 'none', randomizationBlocks: surveyData.randomizationLogic?.blocks || [], globalSkipLogic: surveyData.globalSkipLogic || [], settings: surveyData.settings || {} });
            setOriginalQuestions(surveyData.questions || []);
            let initialOrderIndices = (surveyData.questions || []).map((_, index) => index);
            const { randomizationLogic } = surveyData;
            if (randomizationLogic?.type === 'all') initialOrderIndices = shuffleArray(initialOrderIndices);
            else if (randomizationLogic?.type === 'blocks' && ensureArray(randomizationLogic.blocks).length > 0) {
                let newOrder = []; const unblockedIndices = [...initialOrderIndices];
                randomizationLogic.blocks.forEach(block => {
                    const blockIndices = ensureArray(block.questionIndices).filter(idx => unblockedIndices.includes(idx));
                    if (block.randomize) newOrder.push(...shuffleArray(blockIndices)); else newOrder.push(...blockIndices);
                    blockIndices.forEach(idx => { const pos = unblockedIndices.indexOf(idx); if (pos > -1) unblockedIndices.splice(pos, 1); });
                });
                newOrder.push(...unblockedIndices); initialOrderIndices = newOrder;
            }
            setRandomizedQuestionOrder(initialOrderIndices);
            const initialOptionOrders = {}; (surveyData.questions || []).forEach(q => { if (q && q.randomizeOptions) initialOptionOrders[q._id] = shuffleArray(ensureArray(q.options).map((_, optIndex) => optIndex)); });
            setRandomizedOptionOrders(initialOptionOrders);
            const initialAnswers = {}; (surveyData.questions || []).forEach(q => { if (q) { let defaultAnswer = ''; if (q.type === 'checkbox') defaultAnswer = ''; else if (q.type === 'slider') defaultAnswer = String(Math.round(((q.sliderMin ?? 0) + (q.sliderMax ?? 100)) / 2)); else if (q.type === 'ranking') defaultAnswer = ensureArray(q.options); else if (q.type === 'cardsort') defaultAnswer = { assignments: {}, userCategories: [] }; else if (q.type === 'maxdiff') defaultAnswer = { best: null, worst: null }; initialAnswers[q._id] = defaultAnswer; } });
            setCurrentAnswers(initialAnswers); setOtherInputValues({});
        } catch (err) { const errorMessage = err.response?.data?.message || err.message || "Could not load survey."; setError(errorMessage); toast.error(`Error: ${errorMessage}`); }
        finally { setIsLoading(false); }
    }, [surveyId, collectorId, location.state]); // Added collectorId and location.state

    useEffect(() => {
        // Only fetch if not already marked as "has responded"
        if (!hasAlreadyResponded) {
            fetchSurvey();
        }
    }, [fetchSurvey, hasAlreadyResponded]); // Added hasAlreadyResponded

    // --- Other useEffect hooks for visibility, current index, etc. (no changes to their core logic) ---
    useEffect(() => { if (isLoading || !originalQuestions || originalQuestions.length === 0) { if(visibleQuestionIndices.length > 0) setVisibleQuestionIndices([]); return; } const newVisibleOriginalIndices = questionsInCurrentOrder .map(question => question ? questionIdToOriginalIndexMap[question._id] : undefined) .filter(originalIndex => { if (originalIndex === undefined) return false; const question = originalQuestions[originalIndex]; return question && !hiddenQuestionIds.has(question._id); }); setVisibleQuestionIndices(prevIndices => { if (JSON.stringify(prevIndices) !== JSON.stringify(newVisibleOriginalIndices)) { return newVisibleOriginalIndices; } return prevIndices; }); }, [isLoading, originalQuestions, questionsInCurrentOrder, hiddenQuestionIds, questionIdToOriginalIndexMap, randomizedQuestionOrder, visibleQuestionIndices.length]);
    useEffect(() => { if (isLoading || !survey || isDisqualified) return; if (visibleQuestionIndices.length === 0) { if (currentVisibleIndex !== 0) setCurrentVisibleIndex(0); if(visitedPath.length > 0) setVisitedPath([]); return; } const currentPointsToValidQuestion = currentVisibleIndex < visibleQuestionIndices.length; if (!currentPointsToValidQuestion && currentVisibleIndex !== visibleQuestionIndices.length) { for (let i = visitedPath.length - 1; i >= 0; i--) { const pathOriginalIndex = visitedPath[i]; const pathVisibleIndex = visibleQuestionIndices.indexOf(pathOriginalIndex); if (pathVisibleIndex !== -1) { setCurrentVisibleIndex(pathVisibleIndex); return; } } setCurrentVisibleIndex(0); } }, [visibleQuestionIndices, isLoading, survey, isDisqualified, currentVisibleIndex, visitedPath]);
    useEffect(() => { if (currentQToRenderMemoized) { /* console.log('[SurveyTakingPage Debug] Current question to render:', JSON.parse(JSON.stringify(currentQToRenderMemoized))); */ } else { /* console.log('[SurveyTakingPage Debug] No currentQToRenderMemoized or in submit state.'); */ } }, [currentQToRenderMemoized]);


    const evaluateDisabled = useCallback((questionOriginalIndex) => originalQuestions[questionOriginalIndex]?.isDisabled === true, [originalQuestions]);
    const evaluateActionLogic = useCallback((questionOriginalIndex) => { /* ... (no changes) ... */ }, [originalQuestions, currentAnswers, questionsById]);
    const evaluateGlobalLogic = useCallback(() => { /* ... (no changes) ... */ }, [survey, currentAnswers, questionsById]);
    const handleInputChange = useCallback((questionId, value) => { /* ... (no changes) ... */ }, [questionsById, OTHER_VALUE_INTERNAL]);
    const handleCheckboxChange = useCallback((questionId, optionValue, isChecked) => { /* ... (no changes) ... */ }, [questionsById, NA_VALUE_INTERNAL, OTHER_VALUE_INTERNAL]);
    const handleOtherInputChange = useCallback((questionId, textValue) => { /* ... (no changes) ... */ }, []);
    const validateQuestion = useCallback((question, answer, isSoftCheck = false, isDisabled = false) => { /* ... (no changes) ... */ }, [otherInputValues, OTHER_VALUE_INTERNAL]);
    const renderQuestion = useCallback((questionToRenderArg) => { /* ... (no changes) ... */ }, [currentAnswers, otherInputValues, handleInputChange, questionIdToOriginalIndexMap, handleOtherInputChange, handleCheckboxChange, randomizedOptionOrders, evaluateDisabled]);
    const handleNext = useCallback(() => { /* ... (no changes) ... */ }, [currentVisibleIndex, visibleQuestionIndices, isDisqualified, isLoading, originalQuestions, currentAnswers, evaluateDisabled, validateQuestion, setVisitedPath, visitedPath, evaluateGlobalLogic, evaluateActionLogic, questionIdToOriginalIndexMap, setHiddenQuestionIds, setIsDisqualified, setDisqualificationMessage]);
    const handlePrevious = useCallback(() => { /* ... (no changes) ... */ }, [isDisqualified, isLoading, visitedPath, currentVisibleIndex, visibleQuestionIndices]);

    const handleSubmit = useCallback(async (e) => {
        e.preventDefault();
        setIsSubmitting(true); setError(null);

        if (!collectorId) { toast.error("Collector ID missing."); setError("Collector ID missing."); setIsSubmitting(false); return; }
        if (recaptchaEnabled && !recaptchaToken && recaptchaSiteKey) { toast.error("Please complete reCAPTCHA."); setIsSubmitting(false); return; }

        let firstInvalidVisibleIndex = -1;
        for (let visIdx = 0; visIdx < visibleQuestionIndices.length; visIdx++) {
            const originalIdx = visibleQuestionIndices[visIdx]; const q = originalQuestions[originalIdx];
            const isDisabled = evaluateDisabled(originalIdx);
            if (q && !validateQuestion(q, currentAnswers[q._id], false, isDisabled)) { firstInvalidVisibleIndex = visIdx; break; }
        }
        if (firstInvalidVisibleIndex !== -1) { setCurrentVisibleIndex(firstInvalidVisibleIndex); toast.error("Please answer all required questions."); setIsSubmitting(false); return; }

        const answersToSubmit = Object.entries(currentAnswers)
            .filter(([questionId, ]) => { const question = questionsById[questionId]; return question && visibleQuestionIndices.includes(questionIdToOriginalIndexMap[questionId]); })
            .map(([questionId, answerValue]) => {
                const question = questionsById[questionId]; let textForOther = null;
                if (question.addOtherOption) { if (((question.type === 'multiple-choice' || question.type === 'dropdown') && answerValue === OTHER_VALUE_INTERNAL) || (question.type === 'checkbox' && String(answerValue).includes(OTHER_VALUE_INTERNAL))) { textForOther = otherInputValues[questionId]?.trim() || ''; } }
                return { questionId, questionType: question.type, answerValue, otherText: textForOther, questionText: question.text };
            });
        
        if (answersToSubmit.every(ans => isAnswerEmpty(ans.answerValue, ans.questionType) && !ans.otherText) && originalQuestions.length > 0 && visibleQuestionIndices.length > 0) {
             const anyRequiredVisibleAndUnanswered = visibleQuestionIndices.some(idx => { const q = originalQuestions[idx]; return q?.requiredSetting === 'required' && !evaluateDisabled(idx) && isAnswerEmpty(currentAnswers[q._id], q.type); });
             if (anyRequiredVisibleAndUnanswered) { toast.info("Please answer required questions."); setIsSubmitting(false); return; }
        }

        const payload = {
            answers: answersToSubmit,
            sessionId,
            collectorId,
            recaptchaToken: recaptchaEnabled && recaptchaSiteKey ? recaptchaToken : undefined,
            startedAt: surveyStartedAt, // <<<--- ADDED: Send surveyStartedAt
        };
        // console.log("[SurveyTakingPage handleSubmit] Payload:", JSON.stringify(payload, null, 2));

        try {
            const result = await surveyApi.submitSurveyAnswers(surveyId, payload);
            toast.success(result.message || "Survey submitted successfully!");

            // --- Set cookie/localStorage if multiple responses not allowed ---
            const collectorSettings = location.state?.collectorSettings || {};
            if (collectorSettings.allowMultipleResponses === false && collectorId) {
                const storageKey = `survey_${collectorId}_submitted`;
                localStorage.setItem(storageKey, 'true');
                console.log(`[SurveyTakingPage] Set localStorage item: ${storageKey}`);
            }

            if (result.action?.type === 'disqualifyRespondent') {
                setIsDisqualified(true);
                setDisqualificationMessage(result.action.disqualificationMessage || "Disqualified.");
            } else {
                // Pass responseId to thank you page if available, could be useful
                navigate(result.redirectUrl || '/thank-you', { state: { responseId: result.responseId } });
            }
        } catch (errCatch) {
            const errorMessage = errCatch.response?.data?.message || errCatch.message || "Submission error.";
            setError(errorMessage); toast.error(`Failed: ${errorMessage}`);
            if (recaptchaEnabled && recaptchaRef.current && recaptchaSiteKey) { recaptchaRef.current.reset(); setRecaptchaToken(null); }
        } finally { setIsSubmitting(false); }
    }, [collectorId, recaptchaEnabled, recaptchaToken, recaptchaSiteKey, visibleQuestionIndices, originalQuestions, evaluateDisabled, validateQuestion, currentAnswers, questionsById, otherInputValues, sessionId, surveyId, navigate, recaptchaRef, questionIdToOriginalIndexMap, surveyStartedAt, location.state, OTHER_VALUE_INTERNAL]);

    // --- Conditional Returns & Final Render Logic ---
    if (hasAlreadyResponded) { // <<<--- ADDED: Handle already responded state
        return (
            <div className={styles.surveyContainer}>
                <h1 className={styles.surveyTitle}>{survey?.title || 'Survey'}</h1>
                <div className={styles.alreadyRespondedBox}>
                    <h2>Already Responded</h2>
                    <p>Our records indicate that you have already completed this survey.</p>
                    <p>Multiple submissions are not permitted for this link.</p>
                    {/* Optionally, link to homepage or another relevant page */}
                    <button onClick={() => navigate('/')} className={styles.navButton}>Go to Homepage</button>
                </div>
            </div>
        );
    }

    if (isLoading && !survey) return <div className={styles.loading}>Loading survey...</div>;
    if (error && !survey && !hasAlreadyResponded) return <div className={styles.errorContainer}><h2>Error Loading Survey</h2><p>{error}</p><button onClick={fetchSurvey} className={styles.navButton}>Retry</button></div>;
    if (!survey && !isLoading && !error && !hasAlreadyResponded) return <div className={styles.errorContainer}>Survey not found or could not be loaded.</div>;
    if (isDisqualified) return ( <div className={styles.surveyContainer}><h1 className={styles.surveyTitle}>{survey?.title||'Survey'}</h1><div className={styles.disqualifiedBox}><h2>Survey Ended</h2><p>{disqualificationMessage || "You do not qualify."}</p></div></div> );
    
    let finalCurrentQToRender = null; let finalIsSubmitState = false;
    if (!isLoading && survey) {
        const localCVI = currentVisibleIndex;
        if (visibleQuestionIndices.length === 0 && originalQuestions.length > 0) finalIsSubmitState = true;
        else if (visibleQuestionIndices.length === 0 && originalQuestions.length === 0) finalIsSubmitState = true;
        else if (localCVI >= 0 && localCVI < visibleQuestionIndices.length) { const currentOriginalIdx = visibleQuestionIndices[localCVI]; finalCurrentQToRender = originalQuestions[currentOriginalIdx]; }
        else if (localCVI >= visibleQuestionIndices.length && originalQuestions.length > 0) finalIsSubmitState = true;
    }
    const isCurrentQuestionDisabled = finalCurrentQToRender ? evaluateDisabled(questionIdToOriginalIndexMap[finalCurrentQToRender._id]) : false;
    
    return ( <div className={styles.surveyContainer}> <h1 className={styles.surveyTitle}>{survey?.title || 'Survey'}</h1> {(visitedPath.length === 0 || (visitedPath.length === 1 && currentVisibleIndex === 0 && visibleQuestionIndices.indexOf(visitedPath[0]) === 0 )) && survey?.description && <p className={styles.surveyDescription}>{survey.description}</p>} {error && survey && <div className={styles.submissionError}><p>Error: {error}</p></div>} {isLoading && survey ? <div className={styles.loading}>Loading question...</div> : <div className={`${styles.questionBox} ${isCurrentQuestionDisabled ? styles.disabled : ''}`}> {finalIsSubmitState ? ( <div className={styles.submitPrompt}> <p>End of survey.</p> <p>Click "Submit" to record responses.</p> </div> ) : finalCurrentQToRender ? ( renderQuestion(finalCurrentQToRender) ) : ( originalQuestions.length > 0 && visibleQuestionIndices.length === 0 && !isDisqualified ? <div className={styles.submitPrompt}><p>No questions visible. Submit if applicable.</p></div> : (isLoading ? <div className={styles.loading}>Preparing...</div> : <div className={styles.loading}>Survey empty or issue.</div>) )} </div> } {finalIsSubmitState && recaptchaEnabled && recaptchaSiteKey && ( <div className={styles.recaptchaContainer}> <ReCAPTCHA ref={recaptchaRef} sitekey={recaptchaSiteKey} onChange={(token) => setRecaptchaToken(token)} onExpired={() => setRecaptchaToken(null)} onErrored={() => { toast.error("reCAPTCHA failed. Refresh."); setRecaptchaToken(null); }} /> </div> )} <div className={styles.surveyNavigationArea}> <button onClick={handlePrevious} className={styles.navButton} disabled={isDisqualified || isLoading || isSubmitting || (currentVisibleIndex === 0 && visitedPath.length <= 1) }> Previous </button> {finalIsSubmitState || (originalQuestions.length > 0 && visibleQuestionIndices.length === 0 && !isDisqualified && !isLoading) ? ( <button onClick={handleSubmit} className={styles.submitButton} disabled={isDisqualified || isSubmitting || isLoading || (recaptchaEnabled && recaptchaSiteKey && !recaptchaToken)} > {isSubmitting ? 'Submitting...' : 'Submit'} </button> ) : ( <button onClick={handleNext} className={styles.navButton} disabled={isDisqualified || isSubmitting || isLoading || !finalCurrentQToRender } > Next </button> )} </div> <div className={styles.progressIndicator}> {!finalIsSubmitState && finalCurrentQToRender ? (visibleQuestionIndices.length > 0 ? `Question ${currentVisibleIndex + 1} of ${visibleQuestionIndices.length}` : 'Loading...') : (finalIsSubmitState ? `End (${visibleQuestionIndices.length} questions shown)`: 'Initializing...')} </div> </div> );
}
export default SurveyTakingPage;
// ----- END OF COMPLETE MODIFIED FILE (v1.9 - Allow Multiple Responses Logic & pass startedAt) -----