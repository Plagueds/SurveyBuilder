// frontend/src/pages/SurveyTakingPage.js
// ----- START OF COMPLETE MODIFIED FILE -----
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'; // Added useRef
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import ReCAPTCHA from "react-google-recaptcha";
import {
    DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragOverlay,
} from '@dnd-kit/core';
import {
    arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, rectSortingStrategy, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import styles from './SurveyTakingPage.module.css';
// Assuming surveyApi.js exports an object of functions as default or named
import surveyApiFunctions from '../api/surveyApi'; // Adjust if your import is different

// --- Import Question Type Components ---
import ShortTextQuestion from '../components/survey_question_renders/ShortTextQuestion';
import TextAreaQuestion from '../components/survey_question_renders/TextAreaQuestion';
import MultipleChoiceQuestion from '../components/survey_question_renders/MultipleChoiceQuestion';
import CheckboxQuestion from '../components/survey_question_renders/CheckboxQuestion';
import DropdownQuestion from '../components/survey_question_renders/DropdownQuestion';
import RatingQuestion from '../components/survey_question_renders/RatingQuestion';
import NpsQuestion from '../components/survey_question_renders/NpsQuestion';

// --- Inline Helper Components (Placeholders - ensure these are fully implemented if used) ---
const SliderQuestion = ({ question, value, onChange, disabled }) => (<div>Slider: {question.title} (Value: {value}) <input type="range" min={question.content?.sliderMin || 0} max={question.content?.sliderMax || 100} value={value || 50} onChange={e => onChange(question._id, e.target.value)} disabled={disabled} /></div>);
const MatrixQuestion = ({ question, value, onChange, disabled }) => (<div>Matrix: {question.title} {/* Implement Matrix UI */}</div>);
const HeatmapQuestion = ({ question, value, onChange, disabled }) => (<div>Heatmap: {question.title} {/* Implement Heatmap UI */}</div>);
const MaxDiffQuestion = ({ question, value, onChange, disabled }) => (<div>MaxDiff: {question.title} {/* Implement MaxDiff UI */}</div>);
const ConjointQuestion = ({ question, value, onChange, disabled }) => (<div>Conjoint: {question.title} {/* Implement Conjoint UI */}</div>);

function SortableRankingItem({ id, children }) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
    const style = { transform: CSS.Transform.toString(transform), transition, padding: '5px', border: '1px solid #ccc', marginBottom: '5px', backgroundColor: 'white', cursor: 'grab' };
    return (<div ref={setNodeRef} style={style} {...attributes} {...listeners}>{children}</div>);
}
const RankingQuestion = ({ question, value, onChange, disabled }) => {
    const items = useMemo(() => ensureArray(value).map(item => ({ id: item._id || item.text, text: item.text })), [value]);
    const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
    const handleDragEnd = (event) => {
        const { active, over } = event;
        if (active.id !== over.id) {
            const oldIndex = items.findIndex(item => item.id === active.id);
            const newIndex = items.findIndex(item => item.id === over.id);
            onChange(question._id, arrayMove(items, oldIndex, newIndex));
        }
    };
    return (<div>Ranking: {question.title} <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}><SortableContext items={items.map(item => item.id)} strategy={verticalListSortingStrategy}>{items.map(item => <SortableRankingItem key={item.id} id={item.id}>{item.text}</SortableRankingItem>)}</SortableContext></DndContext></div>);
};

const CARD_SORT_UNASSIGNED_ID = '__UNASSIGNED__';
const CARD_SORT_USER_CATEGORY_PREFIX = '__USER_CAT__';
function SortableCard({ id, children, isOverlay }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
    const style = { opacity: isDragging ? 0.5 : 1, transform: CSS.Transform.toString(transform), transition, padding: '8px', border: '1px solid #ddd', borderRadius: '4px', backgroundColor: 'white', margin: '4px', cursor: 'grab', boxShadow: isOverlay ? '0 0 10px rgba(0,0,0,0.2)' : 'none' };
    return (<div ref={setNodeRef} style={style} {...attributes} {...listeners}>{children}</div>);
}
function CardSortCategoryDropzone({ id, title, cards, children, onRemoveCategory, isUserCategory }) {
    const { setNodeRef, isOver } = useSortable({ id, data: { type: 'category', accepts: ['card'] } });
    const style = { border: isOver ? '2px dashed #007bff' : '2px solid #eee', borderRadius: '4px', padding: '10px', margin: '10px 0', minHeight: '100px', backgroundColor: isOver ? '#e9f5ff' : '#f9f9f9' };
    return (<div ref={setNodeRef} style={style}><h5>{title} {isUserCategory && <button onClick={() => onRemoveCategory(id)} style={{ marginLeft: '10px', fontSize: '0.8em', color: 'red' }}>Remove</button>}</h5><div>{children}</div></div>);
}
const CardSortQuestion = ({ question, value, onChange, disabled }) => (<div>Card Sort: {question.title} {/* Implement CardSort UI */}</div>);


// --- Utility Functions ---
const ensureArray = (value) => (Array.isArray(value) ? value : (value !== undefined && value !== null ? [value] : []));
const isAnswerEmpty = (value, questionType) => {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string' && value.trim() === '') return true;
    if (Array.isArray(value) && value.length === 0) return true;
    if (questionType === 'cardsort' && typeof value === 'object') {
        return Object.values(value.assignments || {}).every(arr => arr.length === 0);
    }
    if (questionType === 'maxdiff' && typeof value === 'object') {
        return value.best === null || value.worst === null;
    }
    return false;
};
const shuffleArray = (array) => { const newArray = [...array]; for (let i = newArray.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [newArray[i], newArray[j]] = [newArray[j], newArray[i]]; } return newArray; };

// --- Logic Evaluation Helpers (Placeholders - ensure these are fully implemented) ---
const evaluateCondition = (condition, allAnswers, questionsById) => { console.warn("evaluateCondition not fully implemented"); return true; };
const evaluateGroup = (group, allAnswers, questionsById) => { console.warn("evaluateGroup not fully implemented"); return true; };
const evaluateRule = (rule, allAnswers, questionsById) => { console.warn("evaluateRule not fully implemented"); return { action: null }; };


// --- Main Survey Taking Page Component ---
function SurveyTakingPage() {
    const { surveyId, collectorId: routeCollectorId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    const [survey, setSurvey] = useState(null);
    const [originalQuestions, setOriginalQuestions] = useState([]);
    const [currentAnswers, setCurrentAnswers] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [sessionId] = useState(() => Date.now().toString(36) + Math.random().toString(36).substring(2));
    const [surveyStartedAt] = useState(() => new Date().toISOString());
    const [otherInputValues, setOtherInputValues] = useState({});
    const [randomizedQuestionOrder, setRandomizedQuestionOrder] = useState([]);
    const [randomizedOptionOrders, setRandomizedOptionOrders] = useState({});
    const [hiddenQuestionIds, setHiddenQuestionIds] = useState(new Set());
    const [visibleQuestionIndices, setVisibleQuestionIndices] = useState([]);
    const [currentVisibleIndex, setCurrentVisibleIndex] = useState(0);
    const [visitedPath, setVisitedPath] = useState([]);
    const [isDisqualified, setIsDisqualified] = useState(false);
    const [disqualificationMessage, setDisqualificationMessage] = useState('');
    const [hasAlreadyResponded, setHasAlreadyResponded] = useState(false);
    const [currentCollectorId, setCurrentCollectorId] = useState(null); // For storing the determined collectorId

    const [recaptchaEnabled, setRecaptchaEnabled] = useState(false);
    const [recaptchaSiteKey, setRecaptchaSiteKey] = useState('');
    const [recaptchaToken, setRecaptchaToken] = useState(null);
    const recaptchaRef = useRef(null); // Changed from React.createRef() to useRef()

    const NA_VALUE_INTERNAL = '__NA__';
    const OTHER_VALUE_INTERNAL = '__OTHER__';

    const questionsById = useMemo(() => originalQuestions.reduce((map, q) => { if(q) map[q._id] = q; return map; }, {}), [originalQuestions]);
    const questionsInCurrentOrder = useMemo(() => (randomizedQuestionOrder.length > 0 && originalQuestions.length > 0) ? randomizedQuestionOrder.map(index => originalQuestions[index]).filter(q => q) : originalQuestions.filter(q => q), [randomizedQuestionOrder, originalQuestions]);
    const questionIdToOriginalIndexMap = useMemo(() => originalQuestions.reduce((map, q, index) => { if(q) map[q._id] = index; return map; }, {}), [originalQuestions]);
    
    // Memoized current question to render
    const currentQToRenderMemoized = useMemo(() => {
        if (isLoading || !survey || visibleQuestionIndices.length === 0 || currentVisibleIndex < 0 || currentVisibleIndex >= visibleQuestionIndices.length) {
            return null;
        }
        const currentOriginalIdx = visibleQuestionIndices[currentVisibleIndex];
        return originalQuestions[currentOriginalIdx] || null;
    }, [isLoading, survey, visibleQuestionIndices, currentVisibleIndex, originalQuestions]);

    // Derived state for knowing if we are at the submission stage
    const isSubmitStateDerived = useMemo(() => {
        if (isLoading || !survey) return false;
        if (visibleQuestionIndices.length === 0 && originalQuestions.length > 0) return true; // No visible questions left, but there were questions
        if (visibleQuestionIndices.length === 0 && originalQuestions.length === 0) return true; // Survey is empty
        if (currentVisibleIndex >= visibleQuestionIndices.length && originalQuestions.length > 0) return true; // Past the last visible question
        return false;
    }, [isLoading, survey, visibleQuestionIndices, originalQuestions, currentVisibleIndex]);

    useEffect(() => {
        const collectorSettings = location.state?.collectorSettings || {};
        const effectiveCollectorId = location.state?.collectorId || routeCollectorId;
        setCurrentCollectorId(effectiveCollectorId);

        console.log("[SurveyTakingPage] Effective Collector ID:", effectiveCollectorId);
        console.log("[SurveyTakingPage] CollectorSettings from location state:", collectorSettings);

        if (collectorSettings.allowMultipleResponses === false && effectiveCollectorId) {
            const storageKey = `survey_${effectiveCollectorId}_submitted`;
            if (localStorage.getItem(storageKey) === 'true') {
                setHasAlreadyResponded(true); setIsLoading(false); return;
            }
        }
        setHasAlreadyResponded(false);

        setRecaptchaEnabled(Boolean(collectorSettings.enableRecaptcha));
        if (collectorSettings.enableRecaptcha && collectorSettings.recaptchaSiteKey) {
            setRecaptchaSiteKey(collectorSettings.recaptchaSiteKey);
        } else {
            const envSiteKey = process.env.REACT_APP_RECAPTCHA_SITE_KEY;
            if (envSiteKey) {
                setRecaptchaSiteKey(envSiteKey);
                if (collectorSettings.enableRecaptcha === undefined && !collectorSettings.recaptchaSiteKey) {
                    setRecaptchaEnabled(true);
                }
            } else {
                if (collectorSettings.enableRecaptcha) {
                    console.warn("[SurveyTakingPage] reCAPTCHA enabled by collector, but no site key found.");
                    setRecaptchaEnabled(false);
                }
            }
        }
    }, [location.state, routeCollectorId]);

    const fetchSurvey = useCallback(async (signal) => { // Accept signal
        const collectorSettings = location.state?.collectorSettings || {};
        if (collectorSettings.allowMultipleResponses === false && currentCollectorId && localStorage.getItem(`survey_${currentCollectorId}_submitted`) === 'true') {
            setHasAlreadyResponded(true); setIsLoading(false); return;
        }

        setIsLoading(true); setError(null); setHiddenQuestionIds(new Set()); setIsDisqualified(false); setCurrentVisibleIndex(0); setVisitedPath([]); setRecaptchaToken(null);
        if (!surveyId) { setError("Survey ID is missing."); setIsLoading(false); return; }
        
        try {
            console.log(`[SurveyTakingPage] Fetching survey ${surveyId} for collector ${currentCollectorId}`);
            const options = { forTaking: 'true', signal }; // Pass signal
            if (currentCollectorId) { options.collectorId = currentCollectorId; }

            const responsePayload = await surveyApiFunctions.getSurveyById(surveyId, options);

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
            const initialOptionOrders = {}; (surveyData.questions || []).forEach(q => { if (q && q.randomizeOptions) initialOptionOrders[q._id] = shuffleArray(ensureArray(q.content?.options).map((_, optIndex) => optIndex)); }); // q.content.options
            setRandomizedOptionOrders(initialOptionOrders);
            const initialAnswers = {}; (surveyData.questions || []).forEach(q => { if (q) { let defaultAnswer = ''; if (q.type === 'checkbox') defaultAnswer = ''; else if (q.type === 'slider') defaultAnswer = String(Math.round(((q.content?.sliderMin ?? 0) + (q.content?.sliderMax ?? 100)) / 2)); else if (q.type === 'ranking') defaultAnswer = ensureArray(q.content?.options); else if (q.type === 'cardsort') defaultAnswer = { assignments: {}, userCategories: [] }; else if (q.type === 'maxdiff') defaultAnswer = { best: null, worst: null }; initialAnswers[q._id] = defaultAnswer; } }); // q.content.options
            setCurrentAnswers(initialAnswers); setOtherInputValues({});
        } catch (err) {
            if (err.name === 'AbortError') { console.log('[SurveyTakingPage] Fetch survey aborted.'); }
            else { const errorMessage = err.response?.data?.message || err.message || "Could not load survey."; setError(errorMessage); toast.error(`Error: ${errorMessage}`); }
        } finally { setIsLoading(false); }
    }, [surveyId, currentCollectorId, location.state]); // Removed signal from deps, it's passed as arg

    useEffect(() => {
        if (!hasAlreadyResponded && currentCollectorId !== null) {
            const controller = new AbortController();
            fetchSurvey(controller.signal);
            return () => {
                controller.abort();
            };
        }
    }, [fetchSurvey, hasAlreadyResponded, currentCollectorId]);

    useEffect(() => { if (isLoading || !originalQuestions || originalQuestions.length === 0) { if(visibleQuestionIndices.length > 0) setVisibleQuestionIndices([]); return; } const newVisibleOriginalIndices = questionsInCurrentOrder .map(question => question ? questionIdToOriginalIndexMap[question._id] : undefined) .filter(originalIndex => { if (originalIndex === undefined) return false; const question = originalQuestions[originalIndex]; return question && !hiddenQuestionIds.has(question._id); }); setVisibleQuestionIndices(prevIndices => { if (JSON.stringify(prevIndices) !== JSON.stringify(newVisibleOriginalIndices)) { return newVisibleOriginalIndices; } return prevIndices; }); }, [isLoading, originalQuestions, questionsInCurrentOrder, hiddenQuestionIds, questionIdToOriginalIndexMap, randomizedQuestionOrder, visibleQuestionIndices.length]);
    useEffect(() => { if (isLoading || !survey || isDisqualified) return; if (visibleQuestionIndices.length === 0) { if (currentVisibleIndex !== 0) setCurrentVisibleIndex(0); if(visitedPath.length > 0) setVisitedPath([]); return; } const currentPointsToValidQuestion = currentVisibleIndex < visibleQuestionIndices.length; if (!currentPointsToValidQuestion && currentVisibleIndex !== visibleQuestionIndices.length) { for (let i = visitedPath.length - 1; i >= 0; i--) { const pathOriginalIndex = visitedPath[i]; const pathVisibleIndex = visibleQuestionIndices.indexOf(pathOriginalIndex); if (pathVisibleIndex !== -1) { setCurrentVisibleIndex(pathVisibleIndex); return; } } setCurrentVisibleIndex(0); } }, [visibleQuestionIndices, isLoading, survey, isDisqualified, currentVisibleIndex, visitedPath]);
    
    const evaluateDisabled = useCallback((questionOriginalIndex) => originalQuestions[questionOriginalIndex]?.isDisabled === true, [originalQuestions]);
    
    const evaluateActionLogic = useCallback((questionOriginalIndex) => {
        const question = originalQuestions[questionOriginalIndex];
        if (!question || !question.skipLogic || question.skipLogic.rules.length === 0) return null;
        const result = evaluateRule(question.skipLogic, currentAnswers, questionsById);
        return result?.action || null;
    }, [originalQuestions, currentAnswers, questionsById]);

    const evaluateGlobalLogic = useCallback(() => {
        if (!survey || !survey.globalSkipLogic || survey.globalSkipLogic.length === 0) return null;
        for (const rule of survey.globalSkipLogic) {
            const result = evaluateRule(rule, currentAnswers, questionsById);
            if (result?.action) return result.action;
        }
        return null;
    }, [survey, currentAnswers, questionsById]);

    const handleInputChange = useCallback((questionId, value) => {
        setCurrentAnswers(prev => ({ ...prev, [questionId]: value }));
        const question = questionsById[questionId];
        if (question && question.addOtherOption && value !== OTHER_VALUE_INTERNAL) {
            setOtherInputValues(prev => ({ ...prev, [questionId]: '' }));
        }
    }, [questionsById, OTHER_VALUE_INTERNAL]);

    const handleCheckboxChange = useCallback((questionId, optionValue, isChecked) => {
        setCurrentAnswers(prevAnswers => {
            const currentVal = ensureArray(prevAnswers[questionId]);
            let newVal;
            if (isChecked) {
                newVal = [...currentVal, optionValue];
                if (optionValue === NA_VALUE_INTERNAL) newVal = [NA_VALUE_INTERNAL]; // N/A exclusivity
            } else {
                newVal = currentVal.filter(v => v !== optionValue);
            }
            // If N/A was selected and now something else is, remove N/A
            if (isChecked && optionValue !== NA_VALUE_INTERNAL && newVal.includes(NA_VALUE_INTERNAL)) {
                newVal = newVal.filter(v => v !== NA_VALUE_INTERNAL);
            }
            return { ...prevAnswers, [questionId]: newVal };
        });
        const question = questionsById[questionId];
        if (question && question.addOtherOption && optionValue !== OTHER_VALUE_INTERNAL && isChecked) {
             // If another option is checked, clear "other" text if "other" checkbox is not also checked
            const currentAnswerForQ = currentAnswers[questionId];
            if(!ensureArray(currentAnswerForQ).includes(OTHER_VALUE_INTERNAL)){
                setOtherInputValues(prev => ({ ...prev, [questionId]: '' }));
            }
        }
    }, [questionsById, NA_VALUE_INTERNAL, OTHER_VALUE_INTERNAL, currentAnswers]);

    const handleOtherInputChange = useCallback((questionId, textValue) => {
        setOtherInputValues(prev => ({ ...prev, [questionId]: textValue }));
    }, []);

    const validateQuestion = useCallback((question, answer, isSoftCheck = false, isDisabled = false) => {
        if (isDisabled || question.requiredSetting === 'not_required') return true;
        if (isAnswerEmpty(answer, question.type)) return false;
        if (question.addOtherOption) {
            const isOtherSelected = (question.type === 'multiple-choice' || question.type === 'dropdown') ? answer === OTHER_VALUE_INTERNAL : ensureArray(answer).includes(OTHER_VALUE_INTERNAL);
            if (isOtherSelected && (!otherInputValues[question._id] || otherInputValues[question._id].trim() === '')) return false;
        }
        return true;
    }, [otherInputValues, OTHER_VALUE_INTERNAL]);

    const renderQuestion = useCallback((questionToRenderArg) => {
        if (!questionToRenderArg) return <div className={styles.loading}>Loading question content...</div>;
        const question = questionToRenderArg; // Already the correct question object
        const value = currentAnswers[question._id];
        const otherText = otherInputValues[question._id] || '';
        const isDisabled = evaluateDisabled(questionIdToOriginalIndexMap[question._id]);
        const commonProps = { question, value, onChange: handleInputChange, onCheckboxChange: handleCheckboxChange, onOtherChange: handleOtherInputChange, otherText, disabled: isDisabled, randomizedOptionIndices: randomizedOptionOrders[question._id] };
        switch (question.type) {
            case 'short_text': return <ShortTextQuestion {...commonProps} />;
            case 'text_area': return <TextAreaQuestion {...commonProps} />;
            case 'multiple_choice_single': return <MultipleChoiceQuestion {...commonProps} isMultiSelect={false} />;
            case 'multiple_choice_multiple': return <CheckboxQuestion {...commonProps} />; // Using CheckboxQuestion for multi-select MCQs
            case 'dropdown': return <DropdownQuestion {...commonProps} />;
            case 'rating_scale': return <RatingQuestion {...commonProps} />;
            case 'nps': return <NpsQuestion {...commonProps} />;
            case 'slider': return <SliderQuestion {...commonProps} />;
            case 'matrix_single': case 'matrix_multiple': return <MatrixQuestion {...commonProps} />;
            case 'heatmap': return <HeatmapQuestion {...commonProps} />;
            case 'max_diff': return <MaxDiffQuestion {...commonProps} />;
            case 'conjoint_analysis': return <ConjointQuestion {...commonProps} />;
            case 'ranking': return <RankingQuestion {...commonProps} />;
            case 'card_sort': return <CardSortQuestion {...commonProps} />;
            default: return <div>Unsupported question type: {question.type}</div>;
        }
    }, [currentAnswers, otherInputValues, handleInputChange, questionIdToOriginalIndexMap, handleOtherInputChange, handleCheckboxChange, randomizedOptionOrders, evaluateDisabled]);

    const handleNext = useCallback(() => {
        if (isDisqualified || isLoading) return;
        const currentOriginalIndex = visibleQuestionIndices[currentVisibleIndex];
        const question = originalQuestions[currentOriginalIndex];
        const isDisabled = evaluateDisabled(currentOriginalIndex);
        if (question && !validateQuestion(question, currentAnswers[question._id], false, isDisabled)) {
            toast.error("Please answer the current question before proceeding."); return;
        }
        setVisitedPath(prev => [...prev, currentOriginalIndex]);
        const globalAction = evaluateGlobalLogic();
        if (globalAction) { if (globalAction.type === 'disqualifyRespondent') { setIsDisqualified(true); setDisqualificationMessage(globalAction.disqualificationMessage || "Disqualified by global logic."); return; } }
        const localAction = evaluateActionLogic(currentOriginalIndex);
        if (localAction) {
            if (localAction.type === 'jumpToQuestion') {
                const targetQOriginalIndex = questionIdToOriginalIndexMap[localAction.targetQuestionId];
                const targetVisibleIndex = visibleQuestionIndices.indexOf(targetQOriginalIndex);
                if (targetVisibleIndex !== -1) setCurrentVisibleIndex(targetVisibleIndex); else toast.warn("Jump target question is not visible.");
                return;
            } else if (localAction.type === 'disqualifyRespondent') {
                setIsDisqualified(true); setDisqualificationMessage(localAction.disqualificationMessage || "Disqualified by question logic."); return;
            } else if (localAction.type === 'endSurvey') {
                setCurrentVisibleIndex(visibleQuestionIndices.length); return; // Go to submit state
            }
        }
        if (currentVisibleIndex < visibleQuestionIndices.length - 1) { setCurrentVisibleIndex(prev => prev + 1); }
        else { setCurrentVisibleIndex(visibleQuestionIndices.length); } // Reached end, go to submit state
    }, [currentVisibleIndex, visibleQuestionIndices, isDisqualified, isLoading, originalQuestions, currentAnswers, evaluateDisabled, validateQuestion, setVisitedPath, visitedPath, evaluateGlobalLogic, evaluateActionLogic, questionIdToOriginalIndexMap, setHiddenQuestionIds, setIsDisqualified, setDisqualificationMessage]);

    const handlePrevious = useCallback(() => {
        if (isDisqualified || isLoading || visitedPath.length === 0) return;
        const lastVisitedOriginalIndex = visitedPath[visitedPath.length - 1];
        const lastVisitedVisibleIndex = visibleQuestionIndices.indexOf(lastVisitedOriginalIndex);
        if (lastVisitedVisibleIndex !== -1) {
            setCurrentVisibleIndex(lastVisitedVisibleIndex);
            setVisitedPath(prev => prev.slice(0, -1));
        } else if (currentVisibleIndex > 0) {
            setCurrentVisibleIndex(prev => prev - 1); // Fallback if path is weird
        }
    }, [isDisqualified, isLoading, visitedPath, currentVisibleIndex, visibleQuestionIndices]);

    const handleSubmit = useCallback(async (e) => {
        e.preventDefault();
        setIsSubmitting(true); setError(null);

        if (!currentCollectorId) { toast.error("Collector ID missing."); setError("Collector ID missing."); setIsSubmitting(false); return; }
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
                if (question.content?.hasOther) { if (((question.type === 'multiple_choice_single' || question.type === 'dropdown') && answerValue === OTHER_VALUE_INTERNAL) || (question.type === 'multiple_choice_multiple' && ensureArray(answerValue).includes(OTHER_VALUE_INTERNAL))) { textForOther = otherInputValues[questionId]?.trim() || ''; } }
                return { questionId, questionType: question.type, answerValue, otherText: textForOther, questionText: question.title }; // Use question.title
            });
        
        if (answersToSubmit.every(ans => isAnswerEmpty(ans.answerValue, ans.questionType) && !ans.otherText) && originalQuestions.length > 0 && visibleQuestionIndices.length > 0) {
             const anyRequiredVisibleAndUnanswered = visibleQuestionIndices.some(idx => { const q = originalQuestions[idx]; return q?.requiredSetting === 'required' && !evaluateDisabled(idx) && isAnswerEmpty(currentAnswers[q._id], q.type); });
             if (anyRequiredVisibleAndUnanswered) { toast.info("Please answer required questions."); setIsSubmitting(false); return; }
        }

        const payload = { answers: answersToSubmit, sessionId, collectorId: currentCollectorId, recaptchaToken: recaptchaEnabled && recaptchaSiteKey ? recaptchaToken : undefined, startedAt: surveyStartedAt };
        
        try {
            const result = await surveyApiFunctions.submitSurveyAnswers(surveyId, payload);
            toast.success(result.message || "Survey submitted successfully!");
            const collectorSettings = location.state?.collectorSettings || {};
            if (collectorSettings.allowMultipleResponses === false && currentCollectorId) {
                localStorage.setItem(`survey_${currentCollectorId}_submitted`, 'true');
            }
            if (result.action?.type === 'disqualifyRespondent') {
                setIsDisqualified(true); setDisqualificationMessage(result.action.disqualificationMessage || "Disqualified.");
            } else {
                navigate(result.redirectUrl || '/thank-you', { state: { responseId: result.responseId } });
            }
        } catch (errCatch) {
            const errorMessage = errCatch.response?.data?.message || errCatch.message || "Submission error.";
            setError(errorMessage); toast.error(`Failed: ${errorMessage}`);
            if (recaptchaEnabled && recaptchaRef.current && recaptchaSiteKey) { recaptchaRef.current.reset(); setRecaptchaToken(null); }
        } finally { setIsSubmitting(false); }
    }, [currentCollectorId, recaptchaEnabled, recaptchaToken, recaptchaSiteKey, visibleQuestionIndices, originalQuestions, evaluateDisabled, validateQuestion, currentAnswers, questionsById, otherInputValues, sessionId, surveyId, navigate, recaptchaRef, questionIdToOriginalIndexMap, surveyStartedAt, location.state, OTHER_VALUE_INTERNAL]);

    if (hasAlreadyResponded) { return ( <div className={styles.surveyContainer}> <h1 className={styles.surveyTitle}>{survey?.title || 'Survey'}</h1> <div className={styles.alreadyRespondedBox}> <h2>Already Responded</h2> <p>Our records indicate that you have already completed this survey.</p> <p>Multiple submissions are not permitted for this link.</p> <button onClick={() => navigate('/')} className={styles.navButton}>Go to Homepage</button> </div> </div> ); }
    if (isLoading && !survey) return <div className={styles.loading}>Loading survey...</div>;
    if (error && !survey && !hasAlreadyResponded) return <div className={styles.errorContainer}><h2>Error Loading Survey</h2><p>{error}</p><button onClick={() => fetchSurvey()} className={styles.navButton}>Retry</button></div>; // Pass signal to retry
    if (!survey && !isLoading && !error && !hasAlreadyResponded) return <div className={styles.errorContainer}>Survey not found or could not be loaded.</div>;
    if (isDisqualified) return ( <div className={styles.surveyContainer}><h1 className={styles.surveyTitle}>{survey?.title||'Survey'}</h1><div className={styles.disqualifiedBox}><h2>Survey Ended</h2><p>{disqualificationMessage || "You do not qualify."}</p></div></div> );
    
    const finalCurrentQToRender = currentQToRenderMemoized;
    const finalIsSubmitState = isSubmitStateDerived;
    const isCurrentQuestionDisabled = finalCurrentQToRender ? evaluateDisabled(questionIdToOriginalIndexMap[finalCurrentQToRender._id]) : false;
    
    return ( <div className={styles.surveyContainer}> <h1 className={styles.surveyTitle}>{survey?.title || 'Survey'}</h1> {(visitedPath.length === 0 || (visitedPath.length === 1 && currentVisibleIndex === 0 && visibleQuestionIndices.indexOf(visitedPath[0]) === 0 )) && survey?.description && <p className={styles.surveyDescription}>{survey.description}</p>} {error && survey && <div className={styles.submissionError}><p>Error: {error}</p></div>} {isLoading && survey ? <div className={styles.loading}>Loading question...</div> : <div className={`${styles.questionBox} ${isCurrentQuestionDisabled ? styles.disabled : ''}`}> {finalIsSubmitState ? ( <div className={styles.submitPrompt}> <p>End of survey.</p> <p>Click "Submit" to record responses.</p> </div> ) : finalCurrentQToRender ? ( renderQuestion(finalCurrentQToRender) ) : ( originalQuestions.length > 0 && visibleQuestionIndices.length === 0 && !isDisqualified ? <div className={styles.submitPrompt}><p>No questions visible. Submit if applicable.</p></div> : (isLoading ? <div className={styles.loading}>Preparing...</div> : <div className={styles.loading}>Survey empty or issue.</div>) )} </div> } {finalIsSubmitState && recaptchaEnabled && recaptchaSiteKey && ( <div className={styles.recaptchaContainer}> <ReCAPTCHA ref={recaptchaRef} sitekey={recaptchaSiteKey} onChange={(token) => setRecaptchaToken(token)} onExpired={() => setRecaptchaToken(null)} onErrored={() => { toast.error("reCAPTCHA failed. Refresh."); setRecaptchaToken(null); }} /> </div> )} <div className={styles.surveyNavigationArea}> <button onClick={handlePrevious} className={styles.navButton} disabled={isDisqualified || isLoading || isSubmitting || (currentVisibleIndex === 0 && visitedPath.length <= 1) }> Previous </button> {finalIsSubmitState || (originalQuestions.length > 0 && visibleQuestionIndices.length === 0 && !isDisqualified && !isLoading) ? ( <button onClick={handleSubmit} className={styles.submitButton} disabled={isDisqualified || isSubmitting || isLoading || (recaptchaEnabled && recaptchaSiteKey && !recaptchaToken)} > {isSubmitting ? 'Submitting...' : 'Submit'} </button> ) : ( <button onClick={handleNext} className={styles.navButton} disabled={isDisqualified || isSubmitting || isLoading || !finalCurrentQToRender } > Next </button> )} </div> <div className={styles.progressIndicator}> {!finalIsSubmitState && finalCurrentQToRender ? (visibleQuestionIndices.length > 0 ? `Question ${currentVisibleIndex + 1} of ${visibleQuestionIndices.length}` : 'Loading...') : (finalIsSubmitState ? `End (${visibleQuestionIndices.length} questions shown)`: 'Initializing...')} </div> </div> );
}
export default SurveyTakingPage;
// ----- END OF COMPLETE MODIFIED FILE -----