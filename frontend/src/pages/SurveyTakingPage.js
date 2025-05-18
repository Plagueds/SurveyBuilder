// frontend/src/pages/SurveyTakingPage.js
// ----- START OF COMPLETE MODIFIED FILE (vNext14.4 - Fix Final Next & CardSort Validation) -----
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import ReCAPTCHA from "react-google-recaptcha";
import styles from './SurveyTakingPage.module.css';
import surveyApiFunctions from '../api/surveyApi';

// --- Question Component Imports ---
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

import { evaluateSurveyLogic } from '../utils/logicEvaluator';

// --- Helper Functions ---
const ensureArray = (value) => (Array.isArray(value) ? value : (value !== undefined && value !== null ? [value] : []));

// --- MODIFIED isAnswerEmpty for CardSort ---
const isAnswerEmpty = (value, questionType) => {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string' && value.trim() === '') return true;
    if (Array.isArray(value) && value.length === 0) return true;

    if (questionType === 'cardsort' && typeof value === 'object' && value !== null) {
        const assignments = value.assignments || {};
        const assignedCardIds = Object.keys(assignments);

        if (assignedCardIds.length === 0) {
            // console.log('[isAnswerEmpty - cardsort] No cards have any assignment entry. EMPTY.');
            return true;
        }
        // Check if all cards that *have an assignment entry* are in the "unassigned" category
        const allEffectivelyUnassigned = assignedCardIds.every(cardId => assignments[cardId] === '__UNASSIGNED_CARDS__');
        if (allEffectivelyUnassigned) {
            // console.log('[isAnswerEmpty - cardsort] All assigned cards are in unassigned pile. EMPTY.');
            return true;
        }
        // console.log('[isAnswerEmpty - cardsort] At least one card assigned to a real category. NOT EMPTY.');
        return false;
    }

    if (questionType === 'maxdiff' && typeof value === 'object' && value !== null) {
        return value.best === null || value.worst === null || value.best === undefined || value.worst === undefined;
    }
    if (questionType === 'conjoint' && typeof value === 'object' && value !== null) {
        return Object.keys(value).length === 0; // Basic check, might need refinement based on conjoint structure
    }
    return false;
};

const shuffleArray = (array) => { const newArray = [...array]; for (let i = newArray.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [newArray[i], newArray[j]] = [newArray[j], newArray[i]]; } return newArray; };

const toRoman = (num) => {
    if (num < 1 || num > 39) return String(num);
    const roman = { M: 1000, CM: 900, D: 500, CD: 400, C: 100, XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1 };
    let str = '';
    for (let i of Object.keys(roman)) {
        let q = Math.floor(num / roman[i]);
        num -= q * roman[i];
        str += i.repeat(q);
    }
    return str;
};
const toLetters = (num) => {
    let letters = '';
    while (num > 0) {
        let remainder = (num - 1) % 26;
        letters = String.fromCharCode(65 + remainder) + letters;
        num = Math.floor((num - 1) / 26);
    }
    return letters;
};


function SurveyTakingPage() {
    const { surveyId, collectorId: routeCollectorIdentifier } = useParams();
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

    const NA_VALUE_INTERNAL = '__NA__';
    const OTHER_VALUE_INTERNAL = '__OTHER__';

    const questionsById = useMemo(() => originalQuestions.reduce((map, q) => { if(q) map[q._id] = q; return map; }, {}), [originalQuestions]);
    const questionsInCurrentOrder = useMemo(() => (randomizedQuestionOrder.length > 0 && originalQuestions.length > 0) ? randomizedQuestionOrder.map(index => originalQuestions[index]).filter(q => q) : originalQuestions.filter(q => q), [randomizedQuestionOrder, originalQuestions]);
    const questionIdToOriginalIndexMap = useMemo(() => originalQuestions.reduce((map, q, index) => { if(q) map[q._id] = index; return map; }, {}), [originalQuestions]);

    const currentQToRenderMemoized = useMemo(() => {
        if (isLoading || !survey || visibleQuestionIndices.length === 0 || currentVisibleIndex < 0 || currentVisibleIndex >= visibleQuestionIndices.length) return null;
        const currentOriginalIdx = visibleQuestionIndices[currentVisibleIndex];
        return originalQuestions[currentOriginalIdx] || null;
    }, [isLoading, survey, visibleQuestionIndices, currentVisibleIndex, originalQuestions]);

    const isSubmitStateDerived = useMemo(() => {
        if (isLoading || !survey) return false;
        // If there are questions, but none are visible (e.g., due to logic), it's submit state.
        if (originalQuestions.length > 0 && visibleQuestionIndices.length === 0 && !isLoading) return true;
        // If survey is genuinely empty (no questions defined)
        if (originalQuestions.length === 0 && !isLoading) return true;
        // If current index is at or beyond the number of visible questions (and there are visible questions)
        return currentVisibleIndex >= visibleQuestionIndices.length && visibleQuestionIndices.length > 0 && !isLoading;
    }, [isLoading, survey, visibleQuestionIndices, originalQuestions, currentVisibleIndex]);
    
    useEffect(() => {
        console.log('[Debug] isSubmitStateDerived changed to:', isSubmitStateDerived, 'currentVisibleIndex:', currentVisibleIndex, 'visibleQuestionIndices.length:', visibleQuestionIndices.length);
    }, [isSubmitStateDerived, currentVisibleIndex, visibleQuestionIndices.length]);

    useEffect(() => {
        const effectiveCollectorIdentifier = location.state?.collectorIdentifier || routeCollectorIdentifier;
        setCurrentCollectorIdentifier(effectiveCollectorIdentifier);
    }, [location.state, routeCollectorIdentifier]);

    const fetchSurvey = useCallback(async (signal) => {
        setIsLoading(true); setError(null); setHiddenQuestionIds(new Set()); setIsDisqualified(false); setCurrentVisibleIndex(0); setVisitedPath([]); setRecaptchaToken(null);
        if (!surveyId) { setError("Survey ID is missing."); setIsLoading(false); return; }
        if (!currentCollectorIdentifier && !(location.state?.isPreviewingOwner)) { setError("Collector identifier is missing."); setIsLoading(false); return; }
        try {
            const options = { forTaking: 'true', signal, collectorId: currentCollectorIdentifier };
            if (location.state?.isPreviewingOwner) options.isPreviewingOwner = true;
            const responsePayload = await surveyApiFunctions.getSurveyById(surveyId, options);
            if (!responsePayload || !responsePayload.success || !responsePayload.data) throw new Error(responsePayload?.message || "Failed to retrieve survey data.");
            const surveyData = responsePayload.data;
            if (!surveyData || !Array.isArray(surveyData.questions)) throw new Error("Survey data is malformed.");
            const fetchedCollectorSettings = surveyData.collectorSettings || {};
            const fetchedActualCollectorObjectId = surveyData.actualCollectorObjectId || null;
            const surveyWideSettings = surveyData.settings || {};
            setCollectorSettings(fetchedCollectorSettings);
            setActualCollectorObjectId(fetchedActualCollectorObjectId);
            setAllowBackButton(typeof fetchedCollectorSettings.allowBackButton === 'boolean' ? fetchedCollectorSettings.allowBackButton : true);
            setProgressBarEnabledState(typeof fetchedCollectorSettings.progressBarEnabled === 'boolean' ? fetchedCollectorSettings.progressBarEnabled : false);
            setProgressBarStyleState(fetchedCollectorSettings.progressBarStyle || 'percentage');
            setProgressBarPositionState(fetchedCollectorSettings.progressBarPosition || 'top');
            const behaviorNavSettings = surveyWideSettings.behaviorNavigation || {};
            setAutoAdvanceState(typeof behaviorNavSettings.autoAdvance === 'boolean' ? behaviorNavSettings.autoAdvance : false);
            setQNumEnabledState(typeof behaviorNavSettings.questionNumberingEnabled === 'boolean' ? behaviorNavSettings.questionNumberingEnabled : true);
            setQNumFormatState(behaviorNavSettings.questionNumberingFormat || '123');
            const storageKeyCollectorId = fetchedActualCollectorObjectId || currentCollectorIdentifier;
            if (fetchedCollectorSettings.allowMultipleResponses === false && storageKeyCollectorId && localStorage.getItem(`survey_${storageKeyCollectorId}_submitted`) === 'true') {
                setHasAlreadyResponded(true); setIsLoading(false); return;
            }
            setHasAlreadyResponded(false);
            const enableRecaptchaFlag = Boolean(fetchedCollectorSettings.enableRecaptcha);
            setRecaptchaEnabled(enableRecaptchaFlag && (fetchedCollectorSettings.recaptchaSiteKey || process.env.REACT_APP_RECAPTCHA_SITE_KEY));
            setRecaptchaSiteKey(fetchedCollectorSettings.recaptchaSiteKey || process.env.REACT_APP_RECAPTCHA_SITE_KEY || '');
            setSurvey(surveyData);
            const fetchedQuestions = surveyData.questions || [];
            setOriginalQuestions(fetchedQuestions);
            let initialOrderIndices = fetchedQuestions.map((_, index) => index);
            const { randomizationLogic } = surveyData;
            if (randomizationLogic?.type === 'all') initialOrderIndices = shuffleArray(initialOrderIndices);
            else if (randomizationLogic?.type === 'blocks' && ensureArray(randomizationLogic.blocks).length > 0) {
                let newOrder = []; const unblockedIndices = [...initialOrderIndices];
                randomizationLogic.blocks.forEach(block => { const blockIndices = ensureArray(block.questionIndices).filter(idx => unblockedIndices.includes(idx)); if (block.randomize) newOrder.push(...shuffleArray(blockIndices)); else newOrder.push(...blockIndices); blockIndices.forEach(idx => { const pos = unblockedIndices.indexOf(idx); if (pos > -1) unblockedIndices.splice(pos, 1); }); });
                newOrder.push(...unblockedIndices); initialOrderIndices = newOrder;
            }
            setRandomizedQuestionOrder(initialOrderIndices);
            const initialOptionOrders = {}; fetchedQuestions.forEach(q => { if (q && q.randomizeOptions && Array.isArray(q.options)) { initialOptionOrders[q._id] = shuffleArray(q.options.map((_, optIndex) => optIndex)); } }); setRandomizedOptionOrders(initialOptionOrders);
            const initialAnswers = {}; fetchedQuestions.forEach(q => { if (q) { let da = ''; if (q.type === 'checkbox') da = []; else if (q.type === 'slider') da = String(Math.round(((q.sliderMin ?? 0) + (q.sliderMax ?? 100)) / 2)); else if (q.type === 'ranking') da = ensureArray(q.options?.map(opt => typeof opt === 'string' ? opt : (opt.text || String(opt)))); else if (q.type === 'cardsort') da = { assignments: {}, userCategories: [] }; else if (q.type === 'maxdiff') da = { best: null, worst: null }; else if (q.type === 'conjoint') da = {}; initialAnswers[q._id] = da; } }); setCurrentAnswers(initialAnswers); setOtherInputValues({});
        } catch (err) { if (err.name === 'AbortError') console.log('Fetch aborted.'); else { const msg = err.response?.data?.message || err.message || "Could not load survey."; setError(msg); toast.error(`Error: ${msg}`); } } finally { setIsLoading(false); }
    }, [surveyId, currentCollectorIdentifier, location.state]);

    useEffect(() => {
        if (currentCollectorIdentifier || location.state?.isPreviewingOwner) { const controller = new AbortController(); fetchSurvey(controller.signal); return () => { controller.abort(); if (autoAdvanceTimeoutRef.current) clearTimeout(autoAdvanceTimeoutRef.current); }; }
        else if (routeCollectorIdentifier === undefined && !location.state?.collectorIdentifier && !location.state?.isPreviewingOwner) { setIsLoading(false); setError("Collector information is missing."); }
    }, [fetchSurvey, currentCollectorIdentifier, routeCollectorIdentifier, location.state]);

    useEffect(() => { if (isLoading || !originalQuestions || originalQuestions.length === 0) { if(visibleQuestionIndices.length > 0) setVisibleQuestionIndices([]); return; } const newVisible = questionsInCurrentOrder.map(q => q ? questionIdToOriginalIndexMap[q._id] : undefined).filter(idx => idx !== undefined && !hiddenQuestionIds.has(originalQuestions[idx]._id)); if (JSON.stringify(visibleQuestionIndices) !== JSON.stringify(newVisible)) setVisibleQuestionIndices(newVisible); }, [isLoading, originalQuestions, questionsInCurrentOrder, hiddenQuestionIds, questionIdToOriginalIndexMap, randomizedQuestionOrder, visibleQuestionIndices]);
    
    // --- MODIFIED useEffect for currentVisibleIndex bounds and submit state handling ---
    useEffect(() => {
        if (isLoading || !survey || isDisqualified) {
            // console.log('[Effect CVI Adjust] Bailing: loading, no survey, or disqualified.');
            return;
        }

        if (visibleQuestionIndices.length === 0) { // No questions are visible
            if (currentVisibleIndex !== 0) { // This also implies submit state for an empty visible list
                console.log('[Effect CVI Adjust] No visible questions. Setting currentVisibleIndex to 0 (submit state for empty).');
                setCurrentVisibleIndex(0); // Or visibleQuestionIndices.length, which is 0
            }
            if(visitedPath.length > 0 && !allowBackButton) setVisitedPath([]);
            return;
        }

        // If currentVisibleIndex is set to visibleQuestionIndices.length, it means we are in the "submit" phase.
        // We should not try to navigate away from it unless visibleQuestionIndices itself has become empty (handled above).
        if (currentVisibleIndex === visibleQuestionIndices.length) {
            // console.log('[Effect CVI Adjust] currentVisibleIndex is at submit sentinel (length). Valid state. No change by this effect.');
            return;
        }

        // If currentVisibleIndex is somehow GREATER than length (should not happen with current logic but as a safeguard)
        if (currentVisibleIndex > visibleQuestionIndices.length) {
            console.log('[Effect CVI Adjust] currentVisibleIndex > length. Correcting to submit sentinel (length).');
            setCurrentVisibleIndex(visibleQuestionIndices.length);
            return;
        }
        
        // If currentVisibleIndex points to an index that is now invalid because the question at that position
        // is no longer in visibleQuestionIndices (e.g., due to skip logic making it hidden).
        // Note: currentVisibleIndex is an index into visibleQuestionIndices.
        // This check might be redundant if visibleQuestionIndices updates correctly and other effects handle it.
        // However, as a safeguard:
        if (currentVisibleIndex >= 0 && currentVisibleIndex < visibleQuestionIndices.length) {
            // It's pointing to a valid position within the current visible questions.
            // console.log('[Effect CVI Adjust] currentVisibleIndex is within bounds of visible questions.');
        } else if (currentVisibleIndex !== 0 && visibleQuestionIndices.length > 0) {
            // It's out of bounds but not 0, and there are visible questions. Try to go to the last valid one.
            console.log('[Effect CVI Adjust] currentVisibleIndex out of bounds, attempting to set to last visible question.');
            setCurrentVisibleIndex(visibleQuestionIndices.length -1);
        } else if (currentVisibleIndex !== 0 && visibleQuestionIndices.length === 0) {
             console.log('[Effect CVI Adjust] currentVisibleIndex out of bounds, no visible questions, setting to 0.');
            setCurrentVisibleIndex(0);
        }


    }, [visibleQuestionIndices, isLoading, survey, isDisqualified, currentVisibleIndex, allowBackButton, visitedPath]); // Removed visitedPath and allowBackButton if not strictly needed for this specific adjustment logic
                                                                                                                    // Re-added for now, but the core issue was handling the submit sentinel.

    const evaluateDisabled = useCallback((questionOriginalIndex) => originalQuestions[questionOriginalIndex]?.isDisabled === true, [originalQuestions]);
    
    const validateQuestion = useCallback((question, answer, isSoftCheck = false, isDisabled = false) => {
        if (!question || isDisabled) return true;
        // console.log(`[validateQuestion] Q: "${question.text}", Required: ${question.requiredSetting}, Answer:`, answer);
        if (question.addOtherOption && question.requireOtherIfSelected) {
            const isOtherSelected = (question.type === 'multiple-choice' || question.type === 'dropdown' ? answer === OTHER_VALUE_INTERNAL : question.type === 'checkbox' && ensureArray(answer).includes(OTHER_VALUE_INTERNAL));
            if (isOtherSelected) {
                const otherTextValue = otherInputValues[question._id];
                if (otherTextValue === undefined || otherTextValue.trim() === '') {
                    if (!isSoftCheck) toast.error(`Please provide text for "Other" in: "${question.text}"`);
                    // console.log(`[validateQuestion] FAILED Q: "${question.text}" - Other text missing`);
                    return false;
                }
            }
        }
        if (question.requiredSetting === 'required' && isAnswerEmpty(answer, question.type)) {
            // console.log(`[validateQuestion] FAILED Q: "${question.text}" - Required but empty`);
            return false;
        }
        if (question.type === 'checkbox' && !isAnswerEmpty(answer, question.type)) {
            const naSelected = ensureArray(answer).includes(NA_VALUE_INTERNAL);
            if (naSelected) return true;
            const selectedCount = ensureArray(answer).filter(v => v !== NA_VALUE_INTERNAL).length;
            if (question.minAnswersRequired && selectedCount < question.minAnswersRequired) { if (!isSoftCheck) toast.error(`Select at least ${question.minAnswersRequired} for "${question.text}".`); return false; }
            if (question.limitAnswers && question.limitAnswersMax && selectedCount > question.limitAnswersMax) { if (!isSoftCheck) toast.error(`Select no more than ${question.limitAnswersMax} for "${question.text}".`); return false; }
        }
        // console.log(`[validateQuestion] PASSED Q: "${question.text}"`);
        return true;
    }, [otherInputValues, OTHER_VALUE_INTERNAL, NA_VALUE_INTERNAL, isAnswerEmpty]); // Added isAnswerEmpty

    const evaluateGlobalLogic = useCallback(() => { if (!survey || !survey.globalSkipLogic || survey.globalSkipLogic.length === 0) return null; return evaluateSurveyLogic(survey.globalSkipLogic, currentAnswers, originalQuestions); }, [survey, currentAnswers, originalQuestions]);
    const evaluateActionLogic = useCallback((questionOriginalIndex) => { const question = originalQuestions[questionOriginalIndex]; if (!question || !question.skipLogic || !Array.isArray(question.skipLogic.rules) || question.skipLogic.rules.length === 0) return null; return evaluateSurveyLogic(question.skipLogic.rules, currentAnswers, originalQuestions); }, [originalQuestions, currentAnswers]);

    const handleNext = useCallback(() => {
        console.log('[HandleNext] Entered. currentVisibleIndex:', currentVisibleIndex, 'visibleQuestionIndices.length:', visibleQuestionIndices.length);
        if (isDisqualified || isLoading) {
            console.log('[HandleNext] Exiting early: isDisqualified or isLoading.');
            return;
        }

        if (currentVisibleIndex >= visibleQuestionIndices.length && visibleQuestionIndices.length > 0) { // Already at submit state for a non-empty survey
            console.log('[HandleNext] Already at submit state (index >= length). Should be showing Submit button. No action from Next.');
            // If somehow Next is still clickable, ensure we stay in submit state.
             if (currentVisibleIndex !== visibleQuestionIndices.length) setCurrentVisibleIndex(visibleQuestionIndices.length);
            return;
        }
         if (visibleQuestionIndices.length === 0) { // No visible questions, should be submit state
            console.log('[HandleNext] No visible questions. Moving to submit state.');
            setCurrentVisibleIndex(0); // or visibleQuestionIndices.length, which is 0
            return;
        }


        const currentOriginalIndex = visibleQuestionIndices[currentVisibleIndex];
        const question = originalQuestions[currentOriginalIndex];

        if (!question) {
            console.log('[HandleNext] No question object found for current index. Advancing index.');
            setCurrentVisibleIndex(prev => prev + 1);
            return;
        }
        console.log('[HandleNext] Current question:', question.text, 'ID:', question._id, 'Required:', question.requiredSetting);

        const isDisabledBySetting = evaluateDisabled(currentOriginalIndex);
        const currentAnswerForValidation = currentAnswers[question._id];
        console.log('[HandleNext] Validating question. Answer:', JSON.stringify(currentAnswerForValidation), 'isDisabled:', isDisabledBySetting);

        if (!validateQuestion(question, currentAnswerForValidation, false, isDisabledBySetting)) {
            if (question.requiredSetting === 'required' && isAnswerEmpty(currentAnswerForValidation, question.type)) {
                toast.error(`Answer required: "${question.text}"`);
                console.log(`[HandleNext] Validation FAILED: Answer required for "${question.text}"`);
            } else {
                console.log(`[HandleNext] Validation FAILED for question "${question.text}" (e.g., "Other" text, checkbox min/max).`);
            }
            return; 
        }
        console.log('[HandleNext] Validation PASSED for question:', question.text);

        if (allowBackButton) {
            setVisitedPath(prev => [...prev, currentOriginalIndex]);
        }

        const globalAction = evaluateGlobalLogic();
        if (globalAction) {
            console.log('[HandleNext] Global logic triggered:', globalAction);
            if (globalAction.type === 'disqualifyRespondent') { setIsDisqualified(true); setDisqualificationMessage(globalAction.disqualificationMessage || "Criteria not met."); return; }
            if (globalAction.type === 'skipToQuestion') { const targetIdx = questionIdToOriginalIndexMap[globalAction.targetQuestionId]; const targetVisIdx = targetIdx !== undefined ? visibleQuestionIndices.indexOf(targetIdx) : -1; if (targetVisIdx !== -1) setCurrentVisibleIndex(targetVisIdx); else { toast.warn("Global skip target not visible."); if (currentVisibleIndex < visibleQuestionIndices.length - 1) setCurrentVisibleIndex(prev => prev + 1); else setCurrentVisibleIndex(visibleQuestionIndices.length); } return; }
            if (globalAction.type === 'markAsCompleted') { setCurrentVisibleIndex(visibleQuestionIndices.length); return; }
        }

        const localAction = evaluateActionLogic(currentOriginalIndex);
        if (localAction) {
            console.log('[HandleNext] Local logic triggered for Q', question.text, ':', localAction);
            if (localAction.type === 'jumpToQuestion' || localAction.type === 'skipToQuestion') { const targetIdx = questionIdToOriginalIndexMap[localAction.targetQuestionId]; const targetVisIdx = targetIdx !== undefined ? visibleQuestionIndices.indexOf(targetIdx) : -1; if (targetVisIdx !== -1) setCurrentVisibleIndex(targetVisIdx); else { toast.warn("Local skip target not visible."); if (currentVisibleIndex < visibleQuestionIndices.length - 1) setCurrentVisibleIndex(prev => prev + 1); else setCurrentVisibleIndex(visibleQuestionIndices.length); } return; }
            else if (localAction.type === 'disqualifyRespondent') { setIsDisqualified(true); setDisqualificationMessage(localAction.disqualificationMessage || "Criteria not met."); return; }
            else if (localAction.type === 'endSurvey' || localAction.type === 'markAsCompleted') { setCurrentVisibleIndex(visibleQuestionIndices.length); return; }
        }
        
        if (currentVisibleIndex < visibleQuestionIndices.length - 1) {
            console.log('[HandleNext] Moving to next question index.');
            setCurrentVisibleIndex(prev => prev + 1);
        } else {
            console.log('[HandleNext] This is the last question. Moving to submit state by setting index to:', visibleQuestionIndices.length);
            setCurrentVisibleIndex(visibleQuestionIndices.length);
        }
    }, [currentVisibleIndex, visibleQuestionIndices, isDisqualified, isLoading, originalQuestions, currentAnswers, evaluateDisabled, validateQuestion, allowBackButton, evaluateGlobalLogic, evaluateActionLogic, questionIdToOriginalIndexMap, isAnswerEmpty]); // Added isAnswerEmpty
    
    const handleInputChange = useCallback((questionId, value) => {
        setCurrentAnswers(prev => ({ ...prev, [questionId]: value }));
        const question = questionsById[questionId];

        if (question && question.addOtherOption && value !== OTHER_VALUE_INTERNAL) {
            setOtherInputValues(prev => ({ ...prev, [questionId]: '' }));
        }

        // console.log('[AutoAdvance] Check | autoAdvanceState:', autoAdvanceState, '| questionId:', questionId, '| question type:', question?.type, '| value:', value);

        if (autoAdvanceState && question) {
            const autoAdvanceTypes = ['multiple-choice', 'rating', 'nps'];
            if (autoAdvanceTypes.includes(question.type)) {
                // console.log('[AutoAdvance] Eligible type confirmed:', question.type);
                if (autoAdvanceTimeoutRef.current) {
                    clearTimeout(autoAdvanceTimeoutRef.current);
                    // console.log('[AutoAdvance] Cleared existing timeout');
                }
                autoAdvanceTimeoutRef.current = setTimeout(() => {
                    // console.log('[AutoAdvance] Timeout triggered. Attempting to advance for Q:', questionId);
                    const isDisabled = evaluateDisabled(questionIdToOriginalIndexMap[question._id]);
                    
                    let canAdvance = true;
                    if (question.addOtherOption && question.requireOtherIfSelected && value === OTHER_VALUE_INTERNAL) {
                        const otherTextValue = otherInputValues[question._id];
                        // console.log('[AutoAdvance] "Other" selected. Text required:', question.requireOtherIfSelected, 'Text value:', `"${otherTextValue}"`);
                        if (otherTextValue === undefined || otherTextValue.trim() === '') {
                            // console.log('[AutoAdvance] Blocked: "Other" selected but text is empty and required.');
                            canAdvance = false;
                        }
                    }
                    
                    // console.log('[AutoAdvance] Soft validation for advance. isDisabled:', isDisabled, 'canAdvance based on Other:', canAdvance);

                    if (canAdvance) {
                        // console.log('[AutoAdvance] Calling handleNext()');
                        handleNext();
                    } else {
                        // console.log('[AutoAdvance] Not calling handleNext() due to "Other" text requirement.');
                    }
                }, 300);
            } else {
                // console.log('[AutoAdvance] Question type not eligible or question undefined. Type:', question?.type);
            }
        } else {
            // if (!autoAdvanceState) console.log('[AutoAdvance] autoAdvanceState is false.');
            // if (!question) console.log('[AutoAdvance] Question object is undefined for ID:', questionId);
        }
    }, [
        questionsById, 
        OTHER_VALUE_INTERNAL, 
        autoAdvanceState, 
        handleNext, 
        evaluateDisabled, 
        questionIdToOriginalIndexMap, 
        otherInputValues
    ]);
    
    const handleCheckboxChange = useCallback((questionId, optionValue, isChecked) => { setCurrentAnswers(prev => { const currentVal = ensureArray(prev[questionId]); let newVal; if (isChecked) { newVal = [...currentVal, optionValue]; if (optionValue === NA_VALUE_INTERNAL) newVal = [NA_VALUE_INTERNAL]; else if (newVal.includes(NA_VALUE_INTERNAL)) newVal = newVal.filter(v => v !== NA_VALUE_INTERNAL); } else { newVal = currentVal.filter(v => v !== optionValue); } return { ...prev, [questionId]: newVal }; }); const question = questionsById[questionId]; if (question && question.addOtherOption && optionValue === OTHER_VALUE_INTERNAL && !isChecked) setOtherInputValues(prev => ({ ...prev, [questionId]: '' })); }, [questionsById, NA_VALUE_INTERNAL, OTHER_VALUE_INTERNAL]);
    const handleOtherInputChange = useCallback((questionId, textValue) => { setOtherInputValues(prev => ({ ...prev, [questionId]: textValue })); }, []);

    const renderQuestion = useCallback((questionToRenderArg) => {
        if (!questionToRenderArg) return <div className={styles.loading}>Loading question content...</div>;
        if (!questionToRenderArg.type) return <div>Error: Question type missing.</div>;
        const question = {...questionToRenderArg};
        const value = currentAnswers[question._id];
        const otherText = otherInputValues[question._id] || '';
        const isDisabled = evaluateDisabled(questionIdToOriginalIndexMap[question._id]);
        if (qNumEnabledState && visibleQuestionIndices.includes(questionIdToOriginalIndexMap[question._id])) {
            const qNumber = currentVisibleIndex + 1;
            let prefix = "";
            if (qNumFormatState === '123') prefix = `${qNumber}. `;
            else if (qNumFormatState === 'ABC') prefix = `${toLetters(qNumber)}. `;
            else if (qNumFormatState === 'roman') prefix = `${toRoman(qNumber)}. `;
            question.text = `${prefix}${question.text}`;
        }
        const commonProps = { question, currentAnswer: value, onAnswerChange: handleInputChange, onCheckboxChange: handleCheckboxChange, otherValue: otherText, onOtherTextChange: handleOtherInputChange, disabled: isDisabled, optionsOrder: randomizedOptionOrders[question._id], isPreviewMode: false };
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
            default: return <div>Unsupported question type: {question.type}</div>;
        }
    }, [currentAnswers, otherInputValues, handleInputChange, questionIdToOriginalIndexMap, handleOtherInputChange, handleCheckboxChange, randomizedOptionOrders, evaluateDisabled, qNumEnabledState, qNumFormatState, currentVisibleIndex, visibleQuestionIndices]);

    const handlePrevious = useCallback(() => {
        if (!allowBackButton || isDisqualified || isLoading || visitedPath.length === 0) return;
        if (autoAdvanceTimeoutRef.current) clearTimeout(autoAdvanceTimeoutRef.current);
        const lastVisitedOriginalIndex = visitedPath[visitedPath.length - 1];
        const lastVisitedVisibleIndex = visibleQuestionIndices.indexOf(lastVisitedOriginalIndex);
        if (lastVisitedVisibleIndex !== -1) { setCurrentVisibleIndex(lastVisitedVisibleIndex); setVisitedPath(prev => prev.slice(0, -1)); }
        else if (currentVisibleIndex > 0) setCurrentVisibleIndex(prev => prev - 1);
    }, [isDisqualified, isLoading, visitedPath, currentVisibleIndex, visibleQuestionIndices, allowBackButton]);

    const handleSubmit = useCallback(async (e) => {
        e.preventDefault(); setIsSubmitting(true); setError(null);
        if (autoAdvanceTimeoutRef.current) clearTimeout(autoAdvanceTimeoutRef.current);
        if (!actualCollectorObjectId) { toast.error("Collector info incomplete."); setError("Collector info incomplete."); setIsSubmitting(false); return; }
        if (recaptchaEnabled && !recaptchaToken && recaptchaSiteKey) { toast.error("Complete reCAPTCHA."); setIsSubmitting(false); return; }
        let firstInvalidIdx = -1;
        for (let i = 0; i < visibleQuestionIndices.length; i++) { const originalIdx = visibleQuestionIndices[i]; const q = originalQuestions[originalIdx]; if (q && !validateQuestion(q, currentAnswers[q._id], false, evaluateDisabled(originalIdx))) { firstInvalidIdx = i; break; } }
        if (firstInvalidIdx !== -1) { setCurrentVisibleIndex(firstInvalidIdx); const qFail = originalQuestions[visibleQuestionIndices[firstInvalidIdx]]; if (qFail.requiredSetting === 'required' && isAnswerEmpty(currentAnswers[qFail._id], qFail.type)) toast.error(`Complete required: "${qFail.text}"`); else { /* Toast for other validation failures already handled by validateQuestion */ } setIsSubmitting(false); return; }
        const answersToSubmit = Object.entries(currentAnswers).filter(([qId, ]) => { const q = questionsById[qId]; return q && visibleQuestionIndices.includes(questionIdToOriginalIndexMap[q._id]); }).map(([qId, ansVal]) => { const q = questionsById[qId]; let otherTxt = null; if (q.addOtherOption && (((q.type === 'multiple-choice' || q.type === 'dropdown') && ansVal === OTHER_VALUE_INTERNAL) || (q.type === 'checkbox' && ensureArray(ansVal).includes(OTHER_VALUE_INTERNAL)))) { otherTxt = otherInputValues[qId]?.trim() || null; } return { questionId: qId, questionType: q.type, answerValue: ansVal, otherText: otherTxt, questionText: q.text || q.title }; });
        if (answersToSubmit.every(a => isAnswerEmpty(a.answerValue, a.questionType) && !a.otherText) && originalQuestions.length > 0 && visibleQuestionIndices.length > 0) { const anyReqMissed = visibleQuestionIndices.some(idx => { const q = originalQuestions[idx]; return q?.requiredSetting === 'required' && !evaluateDisabled(idx) && isAnswerEmpty(currentAnswers[q._id], q.type); }); if (anyReqMissed) { toast.info("Some required questions missed."); setIsSubmitting(false); return; } }
        const payload = { answers: answersToSubmit, sessionId, collectorId: actualCollectorObjectId, recaptchaToken: recaptchaEnabled && recaptchaSiteKey ? recaptchaToken : undefined, startedAt: surveyStartedAt, };
        try {
            const result = await surveyApiFunctions.submitSurveyAnswers(surveyId, payload); toast.success(result.message || "Submitted!");
            const storageKeyCollectorId = actualCollectorObjectId || currentCollectorIdentifier;
            if (collectorSettings && collectorSettings.allowMultipleResponses === false && storageKeyCollectorId) localStorage.setItem(`survey_${storageKeyCollectorId}_submitted`, 'true');
            if (result.action?.type === 'disqualifyRespondent') { setIsDisqualified(true); setDisqualificationMessage(result.action.disqualificationMessage || "Disqualified."); }
            else navigate(result.redirectUrl || '/thank-you', { state: { responseId: result.responseId } });
        } catch (errCatch) { const msg = errCatch.response?.data?.message || errCatch.message || "Submission error."; setError(msg); toast.error(`Failed: ${msg}`); if (recaptchaEnabled && recaptchaRef.current && recaptchaSiteKey) { recaptchaRef.current.reset(); setRecaptchaToken(null); } } finally { setIsSubmitting(false); }
    }, [actualCollectorObjectId, collectorSettings, recaptchaEnabled, recaptchaToken, recaptchaSiteKey, visibleQuestionIndices, originalQuestions, evaluateDisabled, validateQuestion, currentAnswers, questionsById, otherInputValues, sessionId, surveyId, navigate, questionIdToOriginalIndexMap, surveyStartedAt, OTHER_VALUE_INTERNAL, currentCollectorIdentifier, isAnswerEmpty]); // Added isAnswerEmpty

    const renderProgressBar = () => {
        if (!progressBarEnabledState || isLoading || !survey || visibleQuestionIndices.length === 0 || isSubmitStateDerived) return null;
        let progressText = ''; let progressPercent = 0;
        if (progressBarStyleState === 'pages') {
            progressText = `Question ${currentVisibleIndex + 1} of ${visibleQuestionIndices.length}`;
            progressPercent = ((currentVisibleIndex + 1) / visibleQuestionIndices.length) * 100;
        } else {
            progressPercent = ((currentVisibleIndex + 1) / visibleQuestionIndices.length) * 100;
            progressText = `${Math.round(progressPercent)}% Complete`;
        }
        return ( <div className={styles.progressBarContainer}> <div className={styles.progressBarTrack}> <div className={styles.progressBarFill} style={{ width: `${progressPercent}%` }} /> </div> <div className={styles.progressBarText}>{progressText}</div> </div> );
    };

    if (hasAlreadyResponded) return ( <div className={styles.surveyContainer}> <h1 className={styles.surveyTitle}>{survey?.title || 'Survey'}</h1> <div className={styles.alreadyRespondedBox}> <h2>Already Responded</h2> <p>You have already completed this survey.</p> <button onClick={() => navigate('/')} className={styles.navButton}>Go to Homepage</button> </div> </div> );
    if (isLoading && !survey) return <div className={styles.loading}>Loading survey...</div>;
    if (error && !survey && !hasAlreadyResponded) return <div className={styles.errorContainer}><h2>Error Loading Survey</h2><p>{error}</p><button onClick={() => { const c = new AbortController(); fetchSurvey(c.signal); }} className={styles.navButton}>Retry</button></div>;
    if (!survey && !isLoading && !error && !hasAlreadyResponded) return <div className={styles.errorContainer}>Survey not found or could not be loaded.</div>;
    if (isDisqualified) return ( <div className={styles.surveyContainer}><h1 className={styles.surveyTitle}>{survey?.title||'Survey'}</h1><div className={styles.disqualifiedBox}><h2>Survey Ended</h2><p>{disqualificationMessage || "You do not qualify."}</p></div></div> );

    const finalCurrentQToRender = currentQToRenderMemoized;
    const finalIsSubmitState = isSubmitStateDerived;
    const isCurrentQuestionDisabled = finalCurrentQToRender ? evaluateDisabled(questionIdToOriginalIndexMap[finalCurrentQToRender._id]) : false;
    const progressBarComponent = renderProgressBar();

    return (
        <div className={styles.surveyContainer}>
            {progressBarPositionState === 'top' && progressBarComponent}
            <h1 className={styles.surveyTitle}>{survey?.title || 'Survey'}</h1>
            {(visitedPath.length === 0 || (visitedPath.length === 1 && currentVisibleIndex === 0 && visibleQuestionIndices.indexOf(visitedPath[0]) === 0 )) && survey?.description && <p className={styles.surveyDescription}>{survey.description}</p>}
            {error && survey && <div className={styles.submissionError}><p>Error: {error}</p></div>}
            {isLoading && survey ? <div className={styles.loading}>Loading question...</div> :
                <div className={`${styles.questionBox} ${isCurrentQuestionDisabled ? styles.disabled : ''}`}>
                    {finalIsSubmitState ? ( <div className={styles.submitPrompt}> <p>End of survey.</p> <p>Click "Submit" to record responses.</p> </div> )
                    : finalCurrentQToRender ? ( renderQuestion(finalCurrentQToRender) )
                    : ( originalQuestions.length > 0 && visibleQuestionIndices.length === 0 && !isDisqualified ? <div className={styles.submitPrompt}><p>No questions visible. Submit if applicable.</p></div>
                    : (isLoading ? <div className={styles.loading}>Preparing...</div> : <div className={styles.loading}>Survey empty or issue.</div>) )}
                </div>
            }
            {finalIsSubmitState && recaptchaEnabled && recaptchaSiteKey && (
                <div className={styles.recaptchaContainer}>
                    <ReCAPTCHA ref={recaptchaRef} sitekey={recaptchaSiteKey} onChange={setRecaptchaToken} onExpired={() => setRecaptchaToken(null)} onErrored={() => { toast.error("reCAPTCHA failed."); setRecaptchaToken(null); }} />
                </div>
            )}
            <div className={styles.surveyNavigationArea}>
                {allowBackButton && ( <button onClick={handlePrevious} className={styles.navButton} disabled={isDisqualified || isLoading || isSubmitting || (currentVisibleIndex === 0 && visitedPath.length <= 1) || finalIsSubmitState } > Previous </button> )}
                {!allowBackButton && <div style={{width: '100px'}}></div>} {/* Placeholder for spacing if no back button */}

                {finalIsSubmitState ? (
                    <button onClick={handleSubmit} className={styles.submitButton} disabled={isDisqualified || isSubmitting || isLoading || (recaptchaEnabled && recaptchaSiteKey && !recaptchaToken)} > 
                        {isSubmitting ? 'Submitting...' : 'Submit'} 
                    </button>
                ) : (
                    <button onClick={handleNext} className={styles.navButton} disabled={isDisqualified || isSubmitting || isLoading || !finalCurrentQToRender } > 
                        Next 
                    </button>
                )}
            </div>
            {progressBarPositionState === 'bottom' && progressBarComponent}
        </div>
    );
}
export default SurveyTakingPage;
// ----- END OF COMPLETE MODIFIED FILE (vNext14.4 - Fix Final Next & CardSort Validation) -----