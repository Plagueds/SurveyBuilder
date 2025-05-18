// frontend/src/pages/SurveyTakingPage.js
// ----- START OF COMPLETE MODIFIED FILE (vNext14 - AutoAdvance, QNumbering, PB Position) -----
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
const isAnswerEmpty = (value, questionType) => {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string' && value.trim() === '') return true;
    if (Array.isArray(value) && value.length === 0) return true;
    if (questionType === 'cardsort' && typeof value === 'object') {
        if (!value.assignments || Object.keys(value.assignments).length === 0) {
            return Object.values(value.assignments || {}).every(catId => catId === '__UNASSIGNED_CARDS__') || Object.keys(value.assignments || {}).length === 0;
        }
        return Object.values(value.assignments).every(catId => catId === '__UNASSIGNED_CARDS__');
    }
    if (questionType === 'maxdiff' && typeof value === 'object') {
        return value.best === null || value.worst === null;
    }
    if (questionType === 'conjoint' && typeof value === 'object') {
        return Object.keys(value).length === 0;
    }
    return false;
};
const shuffleArray = (array) => { const newArray = [...array]; for (let i = newArray.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [newArray[i], newArray[j]] = [newArray[j], newArray[i]]; } return newArray; };

// Helper for Roman numerals (simple version for up to 39, common for question numbering)
const toRoman = (num) => {
    if (num < 1 || num > 39) return String(num); // Fallback for out of typical range
    const roman = { M: 1000, CM: 900, D: 500, CD: 400, C: 100, XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1 };
    let str = '';
    for (let i of Object.keys(roman)) {
        let q = Math.floor(num / roman[i]);
        num -= q * roman[i];
        str += i.repeat(q);
    }
    return str;
};
// Helper for Alphabetic numbering (A, B, ..., Z, AA, AB...)
const toLetters = (num) => { // num is 1-based index
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

    // --- Behavior & Navigation States ---
    const [allowBackButton, setAllowBackButton] = useState(true);
    const [progressBarEnabledState, setProgressBarEnabledState] = useState(false);
    const [progressBarStyleState, setProgressBarStyleState] = useState('percentage');
    const [progressBarPositionState, setProgressBarPositionState] = useState('top'); // New
    const [autoAdvanceState, setAutoAdvanceState] = useState(false); // New
    const [qNumEnabledState, setQNumEnabledState] = useState(true); // New
    const [qNumFormatState, setQNumFormatState] = useState('123'); // New
    const autoAdvanceTimeoutRef = useRef(null); // For clearing timeout if user navigates away quickly

    const NA_VALUE_INTERNAL = '__NA__';
    const OTHER_VALUE_INTERNAL = '__OTHER__';

    const questionsById = useMemo(() => originalQuestions.reduce((map, q) => { if(q) map[q._id] = q; return map; }, {}), [originalQuestions]);
    const questionsInCurrentOrder = useMemo(() => (randomizedQuestionOrder.length > 0 && originalQuestions.length > 0) ? randomizedQuestionOrder.map(index => originalQuestions[index]).filter(q => q) : originalQuestions.filter(q => q), [randomizedQuestionOrder, originalQuestions]);
    const questionIdToOriginalIndexMap = useMemo(() => originalQuestions.reduce((map, q, index) => { if(q) map[q._id] = index; return map; }, {}), [originalQuestions]);

    const currentQToRenderMemoized = useMemo(() => {
        if (isLoading || !survey || visibleQuestionIndices.length === 0 || currentVisibleIndex < 0 || currentVisibleIndex >= visibleQuestionIndices.length) return null;
        const currentOriginalIdx = visibleQuestionIndices[currentVisibleIndex];
        const questionToRender = originalQuestions[currentOriginalIdx] || null;
        return questionToRender;
    }, [isLoading, survey, visibleQuestionIndices, currentVisibleIndex, originalQuestions]);

    const isSubmitStateDerived = useMemo(() => {
        if (isLoading || !survey) return false;
        if (visibleQuestionIndices.length === 0 && originalQuestions.length > 0 && !isLoading) return true;
        if (visibleQuestionIndices.length === 0 && originalQuestions.length === 0 && !isLoading) return true;
        if (currentVisibleIndex >= visibleQuestionIndices.length && originalQuestions.length > 0 && !isLoading) return true;
        return false;
    }, [isLoading, survey, visibleQuestionIndices, originalQuestions, currentVisibleIndex]);

    useEffect(() => {
        const effectiveCollectorIdentifier = location.state?.collectorIdentifier || routeCollectorIdentifier;
        setCurrentCollectorIdentifier(effectiveCollectorIdentifier);
    }, [location.state, routeCollectorIdentifier]);

    const fetchSurvey = useCallback(async (signal) => {
        setIsLoading(true); setError(null); setHiddenQuestionIds(new Set()); setIsDisqualified(false); setCurrentVisibleIndex(0); setVisitedPath([]); setRecaptchaToken(null);

        if (!surveyId) { setError("Survey ID is missing."); setIsLoading(false); return; }
        if (!currentCollectorIdentifier && ! (location.state?.isPreviewingOwner) ) {
            setError("Collector identifier is missing. Cannot load survey."); setIsLoading(false); return;
        }

        try {
            const options = { forTaking: 'true', signal, collectorId: currentCollectorIdentifier };
            if (location.state?.isPreviewingOwner) options.isPreviewingOwner = true;

            const responsePayload = await surveyApiFunctions.getSurveyById(surveyId, options);
            if (!responsePayload || !responsePayload.success || !responsePayload.data) throw new Error(responsePayload?.message || "Failed to retrieve survey data.");
            const surveyData = responsePayload.data;
            if (!surveyData || !Array.isArray(surveyData.questions)) throw new Error("Survey data is malformed.");

            const fetchedCollectorSettings = surveyData.collectorSettings || {};
            const fetchedActualCollectorObjectId = surveyData.actualCollectorObjectId || null;
            const surveyWideSettings = surveyData.settings || {}; // Contains behaviorNavigation, completion etc.

            setCollectorSettings(fetchedCollectorSettings);
            setActualCollectorObjectId(fetchedActualCollectorObjectId);

            // Collector-specific settings
            setAllowBackButton(typeof fetchedCollectorSettings.allowBackButton === 'boolean' ? fetchedCollectorSettings.allowBackButton : true);
            setProgressBarEnabledState(typeof fetchedCollectorSettings.progressBarEnabled === 'boolean' ? fetchedCollectorSettings.progressBarEnabled : false);
            setProgressBarStyleState(fetchedCollectorSettings.progressBarStyle || 'percentage');
            setProgressBarPositionState(fetchedCollectorSettings.progressBarPosition || 'top'); // New

            // Survey-wide behavior settings
            const behaviorNavSettings = surveyWideSettings.behaviorNavigation || {};
            setAutoAdvanceState(typeof behaviorNavSettings.autoAdvance === 'boolean' ? behaviorNavSettings.autoAdvance : false); // New
            setQNumEnabledState(typeof behaviorNavSettings.questionNumberingEnabled === 'boolean' ? behaviorNavSettings.questionNumberingEnabled : true); // New
            setQNumFormatState(behaviorNavSettings.questionNumberingFormat || '123'); // New


            const storageKeyCollectorId = fetchedActualCollectorObjectId || currentCollectorIdentifier;
            if (fetchedCollectorSettings.allowMultipleResponses === false && storageKeyCollectorId) {
                if (localStorage.getItem(`survey_${storageKeyCollectorId}_submitted`) === 'true') {
                    setHasAlreadyResponded(true); setIsLoading(false); return;
                }
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
                randomizationLogic.blocks.forEach(block => {
                    const blockIndices = ensureArray(block.questionIndices).filter(idx => unblockedIndices.includes(idx));
                    if (block.randomize) newOrder.push(...shuffleArray(blockIndices)); else newOrder.push(...blockIndices);
                    blockIndices.forEach(idx => { const pos = unblockedIndices.indexOf(idx); if (pos > -1) unblockedIndices.splice(pos, 1); });
                });
                newOrder.push(...unblockedIndices); initialOrderIndices = newOrder;
            }
            setRandomizedQuestionOrder(initialOrderIndices);
            const initialOptionOrders = {};
            fetchedQuestions.forEach(q => { if (q && q.randomizeOptions && Array.isArray(q.options)) { initialOptionOrders[q._id] = shuffleArray(q.options.map((_, optIndex) => optIndex)); } });
            setRandomizedOptionOrders(initialOptionOrders);
            const initialAnswers = {};
            fetchedQuestions.forEach(q => { if (q) { let defaultAnswer = ''; if (q.type === 'checkbox') defaultAnswer = []; else if (q.type === 'slider') defaultAnswer = String(Math.round(((q.sliderMin ?? 0) + (q.sliderMax ?? 100)) / 2)); else if (q.type === 'ranking') defaultAnswer = ensureArray(q.options?.map(opt => typeof opt === 'string' ? opt : (opt.text || String(opt)))); else if (q.type === 'cardsort') defaultAnswer = { assignments: {}, userCategories: [] }; else if (q.type === 'maxdiff') defaultAnswer = { best: null, worst: null }; else if (q.type === 'conjoint') defaultAnswer = {}; initialAnswers[q._id] = defaultAnswer; } });
            setCurrentAnswers(initialAnswers);
            setOtherInputValues({});

        } catch (err) {
            if (err.name === 'AbortError') { console.log('[SurveyTakingPage] Fetch survey aborted.'); }
            else { const errorMessage = err.response?.data?.message || err.message || "Could not load survey."; setError(errorMessage); toast.error(`Error: ${errorMessage}`); }
        } finally { setIsLoading(false); }
    }, [surveyId, currentCollectorIdentifier, location.state]);

    useEffect(() => {
        if (currentCollectorIdentifier || location.state?.isPreviewingOwner) {
            const controller = new AbortController();
            fetchSurvey(controller.signal);
            return () => { controller.abort(); if (autoAdvanceTimeoutRef.current) clearTimeout(autoAdvanceTimeoutRef.current); };
        } else if (routeCollectorIdentifier === undefined && !location.state?.collectorIdentifier && !location.state?.isPreviewingOwner) {
            setIsLoading(false); setError("Collector information is missing. Cannot load survey.");
        }
    }, [fetchSurvey, currentCollectorIdentifier, routeCollectorIdentifier, location.state]);

    useEffect(() => { if (isLoading || !originalQuestions || originalQuestions.length === 0) { if(visibleQuestionIndices.length > 0) setVisibleQuestionIndices([]); return; } const newVisibleOriginalIndices = questionsInCurrentOrder.map(question => question ? questionIdToOriginalIndexMap[question._id] : undefined).filter(originalIndex => { if (originalIndex === undefined) return false; const question = originalQuestions[originalIndex]; return question && !hiddenQuestionIds.has(question._id); }); setVisibleQuestionIndices(prevIndices => { if (JSON.stringify(prevIndices) !== JSON.stringify(newVisibleOriginalIndices)) { return newVisibleOriginalIndices; } return prevIndices; }); }, [isLoading, originalQuestions, questionsInCurrentOrder, hiddenQuestionIds, questionIdToOriginalIndexMap, randomizedQuestionOrder, visibleQuestionIndices.length]);
    useEffect(() => { if (isLoading || !survey || isDisqualified) return; if (visibleQuestionIndices.length === 0) { if (currentVisibleIndex !== 0) setCurrentVisibleIndex(0); if(visitedPath.length > 0 && !allowBackButton) setVisitedPath([]); return; } const currentPointsToValidQuestion = currentVisibleIndex < visibleQuestionIndices.length; if (!currentPointsToValidQuestion && currentVisibleIndex !== visibleQuestionIndices.length) { if(allowBackButton) { for (let i = visitedPath.length - 1; i >= 0; i--) { const pathOriginalIndex = visitedPath[i]; const pathVisibleIndex = visibleQuestionIndices.indexOf(pathOriginalIndex); if (pathVisibleIndex !== -1) { setCurrentVisibleIndex(pathVisibleIndex); return; } } } setCurrentVisibleIndex(0); } }, [visibleQuestionIndices, isLoading, survey, isDisqualified, currentVisibleIndex, visitedPath, allowBackButton]);

    const evaluateDisabled = useCallback((questionOriginalIndex) => originalQuestions[questionOriginalIndex]?.isDisabled === true, [originalQuestions]);
    const evaluateGlobalLogic = useCallback(() => { if (!survey || !survey.globalSkipLogic || survey.globalSkipLogic.length === 0) return null; return evaluateSurveyLogic(survey.globalSkipLogic, currentAnswers, originalQuestions); }, [survey, currentAnswers, originalQuestions]);
    const evaluateActionLogic = useCallback((questionOriginalIndex) => { const question = originalQuestions[questionOriginalIndex]; if (!question || !question.skipLogic || !Array.isArray(question.skipLogic.rules) || question.skipLogic.rules.length === 0) return null; return evaluateSurveyLogic(question.skipLogic.rules, currentAnswers, originalQuestions); }, [originalQuestions, currentAnswers]);

    const handleNext = useCallback(() => {
        if (isDisqualified || isLoading) return;
        const currentOriginalIndex = visibleQuestionIndices[currentVisibleIndex];
        const question = originalQuestions[currentOriginalIndex];
        if (!question) { setCurrentVisibleIndex(prev => prev + 1); return; }
        const isDisabledBySetting = evaluateDisabled(currentOriginalIndex);
        const isQuestionValid = validateQuestion(question, currentAnswers[question._id], false, isDisabledBySetting);
        if (!isQuestionValid) { if (question.requiredSetting === 'required' && isAnswerEmpty(currentAnswers[question._id], question.type)) { toast.error(`Please answer the current question: "${question.text}"`); } return; }
        if (allowBackButton) setVisitedPath(prev => [...prev, currentOriginalIndex]);
        const globalAction = evaluateGlobalLogic();
        if (globalAction) {
            if (globalAction.type === 'disqualifyRespondent') { setIsDisqualified(true); setDisqualificationMessage(globalAction.disqualificationMessage || "You do not meet the criteria for this survey."); return; }
            if (globalAction.type === 'skipToQuestion') { const targetQOriginalIndex = questionIdToOriginalIndexMap[globalAction.targetQuestionId]; if (targetQOriginalIndex !== undefined) { const targetVisibleIndex = visibleQuestionIndices.indexOf(targetQOriginalIndex); if (targetVisibleIndex !== -1) setCurrentVisibleIndex(targetVisibleIndex); else { toast.warn("Global logic: Jump target question is not currently visible or does not exist. Proceeding sequentially."); if (currentVisibleIndex < visibleQuestionIndices.length - 1) setCurrentVisibleIndex(prev => prev + 1); else setCurrentVisibleIndex(visibleQuestionIndices.length); } } else { toast.error("Global logic: Target question ID for skip not found in survey. Proceeding sequentially."); if (currentVisibleIndex < visibleQuestionIndices.length - 1) setCurrentVisibleIndex(prev => prev + 1); else setCurrentVisibleIndex(visibleQuestionIndices.length); } return; }
            if (globalAction.type === 'markAsCompleted') { setCurrentVisibleIndex(visibleQuestionIndices.length); return; }
        }
        const localAction = evaluateActionLogic(currentOriginalIndex);
        if (localAction) {
            if (localAction.type === 'jumpToQuestion' || localAction.type === 'skipToQuestion') { const targetQOriginalIndex = questionIdToOriginalIndexMap[localAction.targetQuestionId]; if (targetQOriginalIndex !== undefined) { const targetVisibleIndex = visibleQuestionIndices.indexOf(targetQOriginalIndex); if (targetVisibleIndex !== -1) setCurrentVisibleIndex(targetVisibleIndex); else { toast.warn("Local logic: Jump target question is not currently visible or does not exist. Proceeding sequentially."); if (currentVisibleIndex < visibleQuestionIndices.length - 1) setCurrentVisibleIndex(prev => prev + 1); else setCurrentVisibleIndex(visibleQuestionIndices.length); } } else { toast.error("Local logic: Target question ID for skip not found in survey. Proceeding sequentially."); if (currentVisibleIndex < visibleQuestionIndices.length - 1) setCurrentVisibleIndex(prev => prev + 1); else setCurrentVisibleIndex(visibleQuestionIndices.length); } return;
            } else if (localAction.type === 'disqualifyRespondent') { setIsDisqualified(true); setDisqualificationMessage(localAction.disqualificationMessage || "You do not meet the criteria based on your answer."); return;
            } else if (localAction.type === 'endSurvey' || localAction.type === 'markAsCompleted') { setCurrentVisibleIndex(visibleQuestionIndices.length); return; }
        }
        if (currentVisibleIndex < visibleQuestionIndices.length - 1) setCurrentVisibleIndex(prev => prev + 1);
        else setCurrentVisibleIndex(visibleQuestionIndices.length);
    }, [currentVisibleIndex, visibleQuestionIndices, isDisqualified, isLoading, originalQuestions, currentAnswers, evaluateDisabled, validateQuestion, allowBackButton, evaluateGlobalLogic, evaluateActionLogic, questionIdToOriginalIndexMap, setIsDisqualified, setDisqualificationMessage]);

    const handleInputChange = useCallback((questionId, value) => {
        setCurrentAnswers(prev => ({ ...prev, [questionId]: value }));
        const question = questionsById[questionId];
        if (question && question.addOtherOption && value !== OTHER_VALUE_INTERNAL) {
            setOtherInputValues(prev => ({ ...prev, [questionId]: '' }));
        }

        // --- Auto-Advance Logic ---
        if (autoAdvanceState && question) {
            const autoAdvanceTypes = ['multiple-choice', 'rating', 'nps']; // Add 'dropdown' if desired
            if (autoAdvanceTypes.includes(question.type)) {
                // Clear any existing timeout to prevent rapid double-advances if user clicks fast
                if (autoAdvanceTimeoutRef.current) {
                    clearTimeout(autoAdvanceTimeoutRef.current);
                }
                autoAdvanceTimeoutRef.current = setTimeout(() => {
                    // Re-validate before advancing, in case the selected value is part of a complex validation
                    // that handleNext would check. For simple selections, this might be redundant but safer.
                    const isDisabled = evaluateDisabled(questionIdToOriginalIndexMap[question._id]);
                    if (validateQuestion(question, value, true, isDisabled)) { // Soft check, as primary validation is in handleNext
                         handleNext();
                    }
                }, 300); // 300ms delay
            }
        }
    }, [questionsById, OTHER_VALUE_INTERNAL, autoAdvanceState, handleNext, evaluateDisabled, questionIdToOriginalIndexMap, validateQuestion]);

    const handleCheckboxChange = useCallback((questionId, optionValue, isChecked) => { setCurrentAnswers(prevAnswers => { const currentVal = ensureArray(prevAnswers[questionId]); let newVal; if (isChecked) { newVal = [...currentVal, optionValue]; if (optionValue === NA_VALUE_INTERNAL) newVal = [NA_VALUE_INTERNAL]; else if (newVal.includes(NA_VALUE_INTERNAL)) newVal = newVal.filter(v => v !== NA_VALUE_INTERNAL); } else { newVal = currentVal.filter(v => v !== optionValue); } return { ...prevAnswers, [questionId]: newVal }; }); const question = questionsById[questionId]; if (question && question.addOtherOption && optionValue === OTHER_VALUE_INTERNAL && !isChecked) { setOtherInputValues(prev => ({ ...prev, [questionId]: '' })); } }, [questionsById, NA_VALUE_INTERNAL, OTHER_VALUE_INTERNAL]);
    const handleOtherInputChange = useCallback((questionId, textValue) => { setOtherInputValues(prev => ({ ...prev, [questionId]: textValue })); }, []);
    const validateQuestion = useCallback((question, answer, isSoftCheck = false, isDisabled = false) => { if (!question) return true;  if (isDisabled) return true;  if (question.addOtherOption && question.requireOtherIfSelected) { const isOtherSelectedForMC = (question.type === 'multiple-choice' || question.type === 'dropdown') && answer === OTHER_VALUE_INTERNAL; const isOtherSelectedForCheckbox = question.type === 'checkbox' && ensureArray(answer).includes(OTHER_VALUE_INTERNAL); const isOtherSelected = isOtherSelectedForMC || isOtherSelectedForCheckbox; if (isOtherSelected) { const otherTextValue = otherInputValues[question._id]; const isOtherTextEmpty = otherTextValue === undefined || otherTextValue === "undefined" || (typeof otherTextValue === 'string' && otherTextValue.trim() === ''); if (isOtherTextEmpty) { if(!isSoftCheck) toast.error(`Please provide text for the "Other" option in question: "${question.text}"`); return false; } } } if (question.requiredSetting === 'required' && isAnswerEmpty(answer, question.type)) return false; if (question.type === 'checkbox' && !isAnswerEmpty(answer, question.type)) { const naIsSelected = ensureArray(answer).includes(NA_VALUE_INTERNAL); if (naIsSelected) return true;  const selectedOptions = ensureArray(answer).filter(val => val !== NA_VALUE_INTERNAL); const selectedCount = selectedOptions.length; if (question.minAnswersRequired && selectedCount < question.minAnswersRequired) { if(!isSoftCheck) toast.error(`Please select at least ${question.minAnswersRequired} options for "${question.text}".`); return false; } if (question.limitAnswers && question.limitAnswersMax && selectedCount > question.limitAnswersMax) { if(!isSoftCheck) toast.error(`Please select no more than ${question.limitAnswersMax} options for "${question.text}".`); return false; } } return true; }, [otherInputValues, OTHER_VALUE_INTERNAL, NA_VALUE_INTERNAL]);

    const renderQuestion = useCallback((questionToRenderArg) => {
        if (!questionToRenderArg) return <div className={styles.loading}>Loading question content...</div>;
        if (!questionToRenderArg.type) { return <div>Error: Question data is missing 'type'. Cannot render.</div>; }
        
        const question = {...questionToRenderArg}; // Clone to modify text for numbering
        const value = currentAnswers[question._id];
        const otherText = otherInputValues[question._id] || '';
        const isDisabled = evaluateDisabled(questionIdToOriginalIndexMap[question._id]);

        // --- Question Numbering Logic ---
        if (qNumEnabledState && visibleQuestionIndices.includes(questionIdToOriginalIndexMap[question._id])) {
            const qNumber = currentVisibleIndex + 1; // 1-based index for display
            let prefix = "";
            if (qNumFormatState === '123') prefix = `${qNumber}. `;
            else if (qNumFormatState === 'ABC') prefix = `${toLetters(qNumber)}. `;
            else if (qNumFormatState === 'roman') prefix = `${toRoman(qNumber)}. `;
            // else if (qNumFormatState === 'custom' && survey.settings.behaviorNavigation.questionNumberingCustomPrefix) {
            //     prefix = `${survey.settings.behaviorNavigation.questionNumberingCustomPrefix}${qNumber}. `;
            // }
            question.text = `${prefix}${question.text}`;
        }
        // --- End Question Numbering ---

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
            default: return <div>Unsupported question type: {question.type || "Type is missing"}</div>;
        }
    }, [currentAnswers, otherInputValues, handleInputChange, questionIdToOriginalIndexMap, handleOtherInputChange, handleCheckboxChange, randomizedOptionOrders, evaluateDisabled, qNumEnabledState, qNumFormatState, currentVisibleIndex, visibleQuestionIndices]);

    const handlePrevious = useCallback(() => {
        if (!allowBackButton || isDisqualified || isLoading || visitedPath.length === 0) return;
        if (autoAdvanceTimeoutRef.current) clearTimeout(autoAdvanceTimeoutRef.current); // Clear auto-advance if navigating back
        const lastVisitedOriginalIndex = visitedPath[visitedPath.length - 1];
        const lastVisitedVisibleIndex = visibleQuestionIndices.indexOf(lastVisitedOriginalIndex);
        if (lastVisitedVisibleIndex !== -1) { setCurrentVisibleIndex(lastVisitedVisibleIndex); setVisitedPath(prev => prev.slice(0, -1)); }
        else if (currentVisibleIndex > 0) setCurrentVisibleIndex(prev => prev - 1);
    }, [isDisqualified, isLoading, visitedPath, currentVisibleIndex, visibleQuestionIndices, allowBackButton]);

    const handleSubmit = useCallback(async (e) => {
        e.preventDefault(); setIsSubmitting(true); setError(null);
        if (autoAdvanceTimeoutRef.current) clearTimeout(autoAdvanceTimeoutRef.current);
        if (!actualCollectorObjectId) { toast.error("Collector information is incomplete. Cannot submit."); setError("Collector information is incomplete. Cannot submit."); setIsSubmitting(false); return; }
        if (recaptchaEnabled && !recaptchaToken && recaptchaSiteKey) { toast.error("Please complete reCAPTCHA."); setIsSubmitting(false); return; }
        let firstInvalidVisibleIndex = -1;
        for (let visIdx = 0; visIdx < visibleQuestionIndices.length; visIdx++) { const originalIdx = visibleQuestionIndices[visIdx]; const q = originalQuestions[originalIdx]; const isDisabled = evaluateDisabled(originalIdx); if (q && !validateQuestion(q, currentAnswers[q._id], false, isDisabled)) { firstInvalidVisibleIndex = visIdx; break; } }
        if (firstInvalidVisibleIndex !== -1) { setCurrentVisibleIndex(firstInvalidVisibleIndex); const qFailed = originalQuestions[visibleQuestionIndices[firstInvalidVisibleIndex]]; if (qFailed.requiredSetting === 'required' && isAnswerEmpty(currentAnswers[qFailed._id], qFailed.type)) toast.error(`Please complete all required questions. Problem with: "${qFailed.text}"`); setIsSubmitting(false); return; }
        const answersToSubmit = Object.entries(currentAnswers).filter(([questionId, ]) => { const question = questionsById[questionId]; return question && visibleQuestionIndices.includes(questionIdToOriginalIndexMap[question._id]); }).map(([questionId, answerValue]) => { const question = questionsById[questionId]; let textForOther = null; if (question.addOtherOption) { if (((question.type === 'multiple-choice' || question.type === 'dropdown') && answerValue === OTHER_VALUE_INTERNAL) || (question.type === 'checkbox' && ensureArray(answerValue).includes(OTHER_VALUE_INTERNAL))) { textForOther = otherInputValues[questionId]?.trim(); if (textForOther === '' || otherInputValues[questionId] === 'undefined' || otherInputValues[questionId] === undefined) textForOther = null; } } return { questionId, questionType: question.type, answerValue, otherText: textForOther, questionText: question.text || question.title }; });
        if (answersToSubmit.every(ans => isAnswerEmpty(ans.answerValue, ans.questionType) && !ans.otherText) && originalQuestions.length > 0 && visibleQuestionIndices.length > 0) { const anyRequiredVisibleAndUnanswered = visibleQuestionIndices.some(idx => { const q = originalQuestions[idx]; return q?.requiredSetting === 'required' && !evaluateDisabled(idx) && isAnswerEmpty(currentAnswers[q._id], q.type); }); if (anyRequiredVisibleAndUnanswered) { toast.info("It seems some required questions were missed. Please review."); setIsSubmitting(false); return; } }
        const payload = { answers: answersToSubmit, sessionId, collectorId: actualCollectorObjectId, recaptchaToken: recaptchaEnabled && recaptchaSiteKey ? recaptchaToken : undefined, startedAt: surveyStartedAt, };
        try {
            const result = await surveyApiFunctions.submitSurveyAnswers(surveyId, payload); toast.success(result.message || "Survey submitted successfully!");
            const storageKeyCollectorId = actualCollectorObjectId || currentCollectorIdentifier;
            if (collectorSettings && collectorSettings.allowMultipleResponses === false && storageKeyCollectorId) localStorage.setItem(`survey_${storageKeyCollectorId}_submitted`, 'true');
            if (result.action?.type === 'disqualifyRespondent') { setIsDisqualified(true); setDisqualificationMessage(result.action.disqualificationMessage || "Disqualified."); }
            else navigate(result.redirectUrl || '/thank-you', { state: { responseId: result.responseId } });
        } catch (errCatch) { const errorMessage = errCatch.response?.data?.message || errCatch.message || "Submission error."; setError(errorMessage); toast.error(`Failed: ${errorMessage}`); if (recaptchaEnabled && recaptchaRef.current && recaptchaSiteKey) { recaptchaRef.current.reset(); setRecaptchaToken(null); }
        } finally { setIsSubmitting(false); }
    }, [actualCollectorObjectId, collectorSettings, recaptchaEnabled, recaptchaToken, recaptchaSiteKey, visibleQuestionIndices, originalQuestions, evaluateDisabled, validateQuestion, currentAnswers, questionsById, otherInputValues, sessionId, surveyId, navigate, recaptchaRef, questionIdToOriginalIndexMap, surveyStartedAt, OTHER_VALUE_INTERNAL, isDisqualified, currentCollectorIdentifier]);

    const renderProgressBar = () => {
        if (!progressBarEnabledState || isLoading || !survey || visibleQuestionIndices.length === 0 || isSubmitStateDerived) {
            return null;
        }
        let progressText = '';
        let progressPercent = 0;
        if (progressBarStyleState === 'pages') {
            progressText = `Question ${currentVisibleIndex + 1} of ${visibleQuestionIndices.length}`;
            progressPercent = ((currentVisibleIndex + 1) / visibleQuestionIndices.length) * 100;
        } else { 
            progressPercent = ((currentVisibleIndex + 1) / visibleQuestionIndices.length) * 100;
            progressText = `${Math.round(progressPercent)}% Complete`;
        }
        return (
            <div className={styles.progressBarContainer} /* Position handled by CSS or wrapper div below */>
                <div className={styles.progressBarTrack}>
                    <div className={styles.progressBarFill} style={{ width: `${progressPercent}%` }} />
                </div>
                <div className={styles.progressBarText}>{progressText}</div>
            </div>
        );
    };

    if (hasAlreadyResponded) { return ( <div className={styles.surveyContainer}> <h1 className={styles.surveyTitle}>{survey?.title || 'Survey'}</h1> <div className={styles.alreadyRespondedBox}> <h2>Already Responded</h2> <p>Our records indicate that you have already completed this survey.</p> <p>Multiple submissions are not permitted for this link.</p> <button onClick={() => navigate('/')} className={styles.navButton}>Go to Homepage</button> </div> </div> ); }
    if (isLoading && !survey) return <div className={styles.loading}>Loading survey...</div>;
    if (error && !survey && !hasAlreadyResponded) return <div className={styles.errorContainer}><h2>Error Loading Survey</h2><p>{error}</p><button onClick={() => { const controller = new AbortController(); fetchSurvey(controller.signal); }} className={styles.navButton}>Retry</button></div>;
    if (!survey && !isLoading && !error && !hasAlreadyResponded) return <div className={styles.errorContainer}>Survey not found or could not be loaded.</div>;
    if (isDisqualified) return ( <div className={styles.surveyContainer}><h1 className={styles.surveyTitle}>{survey?.title||'Survey'}</h1><div className={styles.disqualifiedBox}><h2>Survey Ended</h2><p>{disqualificationMessage || "You do not qualify."}</p></div></div> );

    const finalCurrentQToRender = currentQToRenderMemoized;
    const finalIsSubmitState = isSubmitStateDerived;
    const isCurrentQuestionDisabled = finalCurrentQToRender ? evaluateDisabled(questionIdToOriginalIndexMap[finalCurrentQToRender._id]) : false;

    const progressBarComponent = renderProgressBar();

    return (
        <div className={styles.surveyContainer}>
            {progressBarPositionState === 'top' && progressBarComponent} {/* Render progress bar at top */}
            
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
                    <ReCAPTCHA ref={recaptchaRef} sitekey={recaptchaSiteKey} onChange={(token) => setRecaptchaToken(token)} onExpired={() => setRecaptchaToken(null)} onErrored={() => { toast.error("reCAPTCHA failed. Refresh."); setRecaptchaToken(null); }} />
                </div>
            )}

            <div className={styles.surveyNavigationArea}>
                {allowBackButton && (
                    <button onClick={handlePrevious} className={styles.navButton} disabled={isDisqualified || isLoading || isSubmitting || (currentVisibleIndex === 0 && visitedPath.length <= 1) } >
                        Previous
                    </button>
                )}
                {!allowBackButton && <div style={{width: '100px'}}></div>} 

                {finalIsSubmitState || (originalQuestions.length > 0 && visibleQuestionIndices.length === 0 && !isDisqualified && !isLoading) ? (
                    <button onClick={handleSubmit} className={styles.submitButton} disabled={isDisqualified || isSubmitting || isLoading || (recaptchaEnabled && recaptchaSiteKey && !recaptchaToken)} >
                        {isSubmitting ? 'Submitting...' : 'Submit'}
                    </button>
                ) : (
                    <button onClick={handleNext} className={styles.navButton} disabled={isDisqualified || isSubmitting || isLoading || !finalCurrentQToRender } >
                        Next
                    </button>
                )}
            </div>
            
            {progressBarPositionState === 'bottom' && progressBarComponent} {/* Render progress bar at bottom */}
        </div>
    );
}
export default SurveyTakingPage;
// ----- END OF COMPLETE MODIFIED FILE (vNext14 - AutoAdvance, QNumbering, PB Position) -----