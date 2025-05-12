// frontend/src/pages/SurveyTakingPage.js
// ----- START OF COMPLETE MODIFIED FILE (vNext2 - Refined Validation) -----
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import ReCAPTCHA from "react-google-recaptcha";
import styles from './SurveyTakingPage.module.css';
import surveyApiFunctions from '../api/surveyApi';

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

const ensureArray = (value) => (Array.isArray(value) ? value : (value !== undefined && value !== null ? [value] : []));
const isAnswerEmpty = (value, questionType) => {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string' && value.trim() === '') return true;
    if (Array.isArray(value) && value.length === 0) return true;
    if (questionType === 'cardsort' && typeof value === 'object') {
        if (!value.assignments || Object.keys(value.assignments).length === 0) {
             // If no user categories defined, and no assignments, it's empty.
             // If user categories ARE defined, it might not be "empty" even with no assignments yet.
             // This depends on how "answered" is defined for card sort.
             // For now, let's say it's empty if no cards are assigned out of the unassigned pool.
            return Object.values(value.assignments).every(catId => catId === '__UNASSIGNED__') || Object.keys(value.assignments).length === 0;
        }
        // Check if any card is assigned to a category other than unassigned
        return Object.values(value.assignments).every(catId => catId === '__UNASSIGNED__');
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

// eslint-disable-next-line no-unused-vars
const evaluateCondition = (condition, allAnswers, questionsById) => { console.warn("[SurveyTakingPage] evaluateCondition is a placeholder."); return true; };
// eslint-disable-next-line no-unused-vars
const evaluateGroup = (group, allAnswers, questionsById) => { console.warn("[SurveyTakingPage] evaluateGroup is a placeholder."); return true; };
const evaluateRule = (rule, allAnswers, questionsById) => { console.warn("[SurveyTakingPage] evaluateRule is a placeholder."); return { action: null }; };

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
    const [currentCollectorId, setCurrentCollectorId] = useState(null);

    const [recaptchaEnabled, setRecaptchaEnabled] = useState(false);
    const [recaptchaSiteKey, setRecaptchaSiteKey] = useState('');
    const [recaptchaToken, setRecaptchaToken] = useState(null);
    const recaptchaRef = useRef(null);

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
        if (visibleQuestionIndices.length === 0 && originalQuestions.length > 0 && !isLoading) return true; // No visible questions but survey has questions
        if (visibleQuestionIndices.length === 0 && originalQuestions.length === 0 && !isLoading) return true; // No questions at all
        if (currentVisibleIndex >= visibleQuestionIndices.length && originalQuestions.length > 0 && !isLoading) return true; // Past the last visible question
        return false;
    }, [isLoading, survey, visibleQuestionIndices, originalQuestions, currentVisibleIndex]);

    useEffect(() => {
        const collectorSettings = location.state?.collectorSettings || {};
        const effectiveCollectorId = location.state?.collectorId || routeCollectorId;
        setCurrentCollectorId(effectiveCollectorId);
        if (collectorSettings.allowMultipleResponses === false && effectiveCollectorId) {
            if (localStorage.getItem(`survey_${effectiveCollectorId}_submitted`) === 'true') {
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
                if (collectorSettings.enableRecaptcha === undefined && !collectorSettings.recaptchaSiteKey) setRecaptchaEnabled(true);
            } else {
                if (collectorSettings.enableRecaptcha) setRecaptchaEnabled(false);
            }
        }
    }, [location.state, routeCollectorId]);

    const fetchSurvey = useCallback(async (signal) => {
        const collectorSettings = location.state?.collectorSettings || {};
        if (collectorSettings.allowMultipleResponses === false && currentCollectorId && localStorage.getItem(`survey_${currentCollectorId}_submitted`) === 'true') {
            setHasAlreadyResponded(true); setIsLoading(false); return;
        }
        setIsLoading(true); setError(null); setHiddenQuestionIds(new Set()); setIsDisqualified(false); setCurrentVisibleIndex(0); setVisitedPath([]); setRecaptchaToken(null);
        if (!surveyId) { setError("Survey ID is missing."); setIsLoading(false); return; }
        try {
            const options = { forTaking: 'true', signal };
            if (currentCollectorId) { options.collectorId = currentCollectorId; }
            const responsePayload = await surveyApiFunctions.getSurveyById(surveyId, options);
            if (!responsePayload || !responsePayload.success || !responsePayload.data) throw new Error(responsePayload?.message || "Failed to retrieve survey data.");
            const surveyData = responsePayload.data;
            if (!surveyData || !Array.isArray(surveyData.questions)) throw new Error("Survey data is malformed (missing or invalid 'questions' field).");
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
            fetchedQuestions.forEach(q => { 
                if (q && q.randomizeOptions && Array.isArray(q.options)) {
                    initialOptionOrders[q._id] = shuffleArray(q.options.map((_, optIndex) => optIndex)); 
                }
            });
            setRandomizedOptionOrders(initialOptionOrders);
            const initialAnswers = {}; 
            fetchedQuestions.forEach(q => { 
                if (q) { 
                    let defaultAnswer = ''; 
                    if (q.type === 'checkbox') defaultAnswer = [];
                    else if (q.type === 'slider') defaultAnswer = String(Math.round(((q.sliderMin ?? 0) + (q.sliderMax ?? 100)) / 2));
                    else if (q.type === 'ranking') defaultAnswer = ensureArray(q.options?.map(opt => typeof opt === 'string' ? opt : (opt.text || String(opt)))); // Handle object options
                    else if (q.type === 'cardsort') defaultAnswer = { assignments: {}, userCategories: [] }; 
                    else if (q.type === 'maxdiff') defaultAnswer = { best: null, worst: null };
                    else if (q.type === 'conjoint') defaultAnswer = {};
                    initialAnswers[q._id] = defaultAnswer; 
                } 
            });
            setCurrentAnswers(initialAnswers); 
            setOtherInputValues({});
        } catch (err) {
            if (err.name === 'AbortError') { console.log('[SurveyTakingPage] Fetch survey aborted.'); }
            else { const errorMessage = err.response?.data?.message || err.message || "Could not load survey."; setError(errorMessage); toast.error(`Error: ${errorMessage}`); }
        } finally { setIsLoading(false); }
    }, [surveyId, currentCollectorId, location.state]);

    useEffect(() => {
        if (!hasAlreadyResponded && currentCollectorId !== null) {
            const controller = new AbortController();
            fetchSurvey(controller.signal);
            return () => { controller.abort(); };
        }
    }, [fetchSurvey, hasAlreadyResponded, currentCollectorId]);

    useEffect(() => { if (isLoading || !originalQuestions || originalQuestions.length === 0) { if(visibleQuestionIndices.length > 0) setVisibleQuestionIndices([]); return; } const newVisibleOriginalIndices = questionsInCurrentOrder.map(question => question ? questionIdToOriginalIndexMap[question._id] : undefined).filter(originalIndex => { if (originalIndex === undefined) return false; const question = originalQuestions[originalIndex]; return question && !hiddenQuestionIds.has(question._id); }); setVisibleQuestionIndices(prevIndices => { if (JSON.stringify(prevIndices) !== JSON.stringify(newVisibleOriginalIndices)) { return newVisibleOriginalIndices; } return prevIndices; }); }, [isLoading, originalQuestions, questionsInCurrentOrder, hiddenQuestionIds, questionIdToOriginalIndexMap, randomizedQuestionOrder, visibleQuestionIndices.length]);
    useEffect(() => { if (isLoading || !survey || isDisqualified) return; if (visibleQuestionIndices.length === 0) { if (currentVisibleIndex !== 0) setCurrentVisibleIndex(0); if(visitedPath.length > 0) setVisitedPath([]); return; } const currentPointsToValidQuestion = currentVisibleIndex < visibleQuestionIndices.length; if (!currentPointsToValidQuestion && currentVisibleIndex !== visibleQuestionIndices.length) { for (let i = visitedPath.length - 1; i >= 0; i--) { const pathOriginalIndex = visitedPath[i]; const pathVisibleIndex = visibleQuestionIndices.indexOf(pathOriginalIndex); if (pathVisibleIndex !== -1) { setCurrentVisibleIndex(pathVisibleIndex); return; } } setCurrentVisibleIndex(0); } }, [visibleQuestionIndices, isLoading, survey, isDisqualified, currentVisibleIndex, visitedPath]);
    
    const evaluateDisabled = useCallback((questionOriginalIndex) => originalQuestions[questionOriginalIndex]?.isDisabled === true, [originalQuestions]);
    const evaluateActionLogic = useCallback((questionOriginalIndex) => { const question = originalQuestions[questionOriginalIndex]; if (!question || !question.skipLogic || !Array.isArray(question.skipLogic.rules) || question.skipLogic.rules.length === 0) return null; const result = evaluateRule(question.skipLogic, currentAnswers, questionsById); return result?.action || null; }, [originalQuestions, currentAnswers, questionsById]);
    const evaluateGlobalLogic = useCallback(() => { if (!survey || !survey.globalSkipLogic || survey.globalSkipLogic.length === 0) return null; for (const rule of survey.globalSkipLogic) { const result = evaluateRule(rule, currentAnswers, questionsById); if (result?.action) return result.action; } return null; }, [survey, currentAnswers, questionsById]);

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
                if (optionValue === NA_VALUE_INTERNAL) newVal = [NA_VALUE_INTERNAL];
                else if (newVal.includes(NA_VALUE_INTERNAL)) newVal = newVal.filter(v => v !== NA_VALUE_INTERNAL);
            } else {
                newVal = currentVal.filter(v => v !== optionValue);
            }
            return { ...prevAnswers, [questionId]: newVal };
        });
        const question = questionsById[questionId];
        if (question && question.addOtherOption && optionValue === OTHER_VALUE_INTERNAL && !isChecked) {
            setOtherInputValues(prev => ({ ...prev, [questionId]: '' }));
        }
    }, [questionsById, NA_VALUE_INTERNAL, OTHER_VALUE_INTERNAL]);

    const handleOtherInputChange = useCallback((questionId, textValue) => {
        setOtherInputValues(prev => ({ ...prev, [questionId]: textValue }));
    }, []);

    const validateQuestion = useCallback((question, answer, isSoftCheck = false, isDisabled = false) => {
        if (!question) return true; 
        if (isDisabled) return true;

        // Only validate if the question is required or if it's a soft check (not currently used for blocking)
        if (question.requiredSetting === 'not_required' && !isSoftCheck) return true;

        if (isAnswerEmpty(answer, question.type)) {
            // If it's truly required and empty, it's invalid.
            // For not_required, this path is already exited.
            // For soft_required or conditional, being empty might be okay if not blocking.
            return question.requiredSetting !== 'required';
        }

        // Check for "Other" option requirements
        // This check is independent of requiredSetting, if "Other" is selected, its text might be mandatory
        if (question.addOtherOption && question.requireOtherIfSelected) {
            const isOtherSelected = (question.type === 'multiple-choice' || question.type === 'dropdown')
                ? answer === OTHER_VALUE_INTERNAL
                : ensureArray(answer).includes(OTHER_VALUE_INTERNAL);

            if (isOtherSelected) {
                const otherTextValue = otherInputValues[question._id];
                if (!otherTextValue || otherTextValue.trim() === '') {
                    return false; // Validation fails: "Other" selected, text required, but text is empty
                }
            }
        }
        
        if (question.type === 'checkbox') {
            const naIsSelected = ensureArray(answer).includes(NA_VALUE_INTERNAL);
            if (naIsSelected) return true; // If N/A is selected, other checkbox validations (min/max) might be skipped

            const selectedOptions = ensureArray(answer).filter(val => val !== NA_VALUE_INTERNAL);
            const selectedCount = selectedOptions.length;
            
            if (question.minAnswersRequired && selectedCount < question.minAnswersRequired) {
                toast.error(`Please select at least ${question.minAnswersRequired} options for "${question.text}".`);
                return false;
            }
            if (question.limitAnswers && question.limitAnswersMax && selectedCount > question.limitAnswersMax) {
                toast.error(`Please select no more than ${question.limitAnswersMax} options for "${question.text}".`);
                return false;
            }
        }
        return true;
    }, [otherInputValues, OTHER_VALUE_INTERNAL, NA_VALUE_INTERNAL]);

    const renderQuestion = useCallback((questionToRenderArg) => {
        if (!questionToRenderArg) return <div className={styles.loading}>Loading question content...</div>;
        const question = questionToRenderArg;
        const value = currentAnswers[question._id];
        const otherText = otherInputValues[question._id] || '';
        const isDisabled = evaluateDisabled(questionIdToOriginalIndexMap[question._id]);
        const commonProps = { question, currentAnswer: value, onAnswerChange: handleInputChange, onCheckboxChange: handleCheckboxChange, otherValue: otherText, onOtherTextChange: handleOtherInputChange, disabled: isDisabled, optionsOrder: randomizedOptionOrders[question._id], isPreviewMode: false };

        switch (question.type) {
            case 'text': return <ShortTextQuestion {...commonProps} />;
            case 'textarea': return <TextAreaQuestion {...commonProps} />;
            case 'multiple-choice': return <MultipleChoiceQuestion {...commonProps} />; // Removed isMultiSelect, it's implicit
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
                console.warn("Unsupported question type in renderQuestion:", question.type, question);
                return <div>Unsupported question type: {question.type}</div>;
        }
    }, [currentAnswers, otherInputValues, handleInputChange, questionIdToOriginalIndexMap, handleOtherInputChange, handleCheckboxChange, randomizedOptionOrders, evaluateDisabled]);

    const handleNext = useCallback(() => {
        if (isDisqualified || isLoading) return;
        const currentOriginalIndex = visibleQuestionIndices[currentVisibleIndex];
        const question = originalQuestions[currentOriginalIndex];
        const isDisabledBySetting = evaluateDisabled(currentOriginalIndex);

        if (question && !validateQuestion(question, currentAnswers[question._id], false, isDisabledBySetting)) {
            // Toast is now inside validateQuestion for specific checkbox min/max errors
            // For general "Other" or required errors, this toast will show.
            if (!(question.type === 'checkbox' && (question.minAnswersRequired || question.limitAnswersMax))) {
                 toast.error(`Please answer the current question correctly: "${question.text}"`);
            }
            return;
        }
        setVisitedPath(prev => [...prev, currentOriginalIndex]);
        const globalAction = evaluateGlobalLogic();
        if (globalAction) { if (globalAction.type === 'disqualifyRespondent') { setIsDisqualified(true); setDisqualificationMessage(globalAction.disqualificationMessage || "Disqualified by global logic."); return; } }
        const localAction = evaluateActionLogic(currentOriginalIndex);
        if (localAction) { if (localAction.type === 'jumpToQuestion') { const targetQOriginalIndex = questionIdToOriginalIndexMap[localAction.targetQuestionId]; const targetVisibleIndex = visibleQuestionIndices.indexOf(targetQOriginalIndex); if (targetVisibleIndex !== -1) setCurrentVisibleIndex(targetVisibleIndex); else toast.warn("Jump target question is not visible."); return; } else if (localAction.type === 'disqualifyRespondent') { setIsDisqualified(true); setDisqualificationMessage(localAction.disqualificationMessage || "Disqualified by question logic."); return; } else if (localAction.type === 'endSurvey') { setCurrentVisibleIndex(visibleQuestionIndices.length); return; } }
        if (currentVisibleIndex < visibleQuestionIndices.length - 1) {
            setCurrentVisibleIndex(prev => prev + 1);
        } else {
            setCurrentVisibleIndex(visibleQuestionIndices.length);
        }
    }, [currentVisibleIndex, visibleQuestionIndices, isDisqualified, isLoading, originalQuestions, currentAnswers, evaluateDisabled, validateQuestion, visitedPath, evaluateGlobalLogic, evaluateActionLogic, questionIdToOriginalIndexMap, setIsDisqualified, setDisqualificationMessage]);

    const handlePrevious = useCallback(() => { if (isDisqualified || isLoading || visitedPath.length === 0) return; const lastVisitedOriginalIndex = visitedPath[visitedPath.length - 1]; const lastVisitedVisibleIndex = visibleQuestionIndices.indexOf(lastVisitedOriginalIndex); if (lastVisitedVisibleIndex !== -1) { setCurrentVisibleIndex(lastVisitedVisibleIndex); setVisitedPath(prev => prev.slice(0, -1)); } else if (currentVisibleIndex > 0) { setCurrentVisibleIndex(prev => prev - 1); } }, [isDisqualified, isLoading, visitedPath, currentVisibleIndex, visibleQuestionIndices]);
    
    const handleSubmit = useCallback(async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);
        if (!currentCollectorId) { toast.error("Collector ID missing."); setError("Collector ID missing."); setIsSubmitting(false); return; }
        if (recaptchaEnabled && !recaptchaToken && recaptchaSiteKey) { toast.error("Please complete reCAPTCHA."); setIsSubmitting(false); return; }
        
        let firstInvalidVisibleIndex = -1;
        for (let visIdx = 0; visIdx < visibleQuestionIndices.length; visIdx++) {
            const originalIdx = visibleQuestionIndices[visIdx];
            const q = originalQuestions[originalIdx];
            const isDisabled = evaluateDisabled(originalIdx);
            if (q && !validateQuestion(q, currentAnswers[q._id], false, isDisabled)) {
                firstInvalidVisibleIndex = visIdx;
                break;
            }
        }
        if (firstInvalidVisibleIndex !== -1) {
            setCurrentVisibleIndex(firstInvalidVisibleIndex);
            // Toast is now inside validateQuestion for specific checkbox min/max errors
            // For general "Other" or required errors, this toast will show.
             if (!(originalQuestions[visibleQuestionIndices[firstInvalidVisibleIndex]].type === 'checkbox' && 
                  (originalQuestions[visibleQuestionIndices[firstInvalidVisibleIndex]].minAnswersRequired || originalQuestions[visibleQuestionIndices[firstInvalidVisibleIndex]].limitAnswersMax))) {
                toast.error(`Please complete all required questions. Problem with: "${originalQuestions[visibleQuestionIndices[firstInvalidVisibleIndex]].text}"`);
            }
            setIsSubmitting(false);
            return;
        }

        const answersToSubmit = Object.entries(currentAnswers)
            .filter(([questionId, ]) => {
                const question = questionsById[questionId];
                return question && visibleQuestionIndices.includes(questionIdToOriginalIndexMap[question._id]);
            })
            .map(([questionId, answerValue]) => {
                const question = questionsById[questionId];
                let textForOther = null;
                if (question.addOtherOption) {
                    if (((question.type === 'multiple-choice' || question.type === 'dropdown') && answerValue === OTHER_VALUE_INTERNAL) ||
                        (question.type === 'checkbox' && ensureArray(answerValue).includes(OTHER_VALUE_INTERNAL))) {
                        textForOther = otherInputValues[questionId]?.trim(); // Send trimmed or undefined
                        if (textForOther === '') textForOther = null; // Send null if empty after trim for consistency
                    }
                }
                return {
                    questionId,
                    questionType: question.type,
                    answerValue,
                    otherText: textForOther,
                    questionText: question.text || question.title
                };
            });

        if (answersToSubmit.every(ans => isAnswerEmpty(ans.answerValue, ans.questionType) && !ans.otherText) &&
            originalQuestions.length > 0 && visibleQuestionIndices.length > 0) {
            const anyRequiredVisibleAndUnanswered = visibleQuestionIndices.some(idx => {
                const q = originalQuestions[idx];
                return q?.requiredSetting === 'required' && !evaluateDisabled(idx) && isAnswerEmpty(currentAnswers[q._id], q.type);
            });
            if (anyRequiredVisibleAndUnanswered) {
                toast.info("It seems some required questions were missed. Please review.");
                setIsSubmitting(false);
                return;
            }
        }

        const payload = {
            answers: answersToSubmit,
            sessionId,
            collectorId: currentCollectorId,
            recaptchaToken: recaptchaEnabled && recaptchaSiteKey ? recaptchaToken : undefined,
            startedAt: surveyStartedAt,
        };
        console.log("[SurveyTakingPage] Submitting payload:", JSON.stringify(payload, null, 2));

        try {
            const result = await surveyApiFunctions.submitSurveyAnswers(surveyId, payload);
            toast.success(result.message || "Survey submitted successfully!");
            const collectorSettings = location.state?.collectorSettings || {};
            if (collectorSettings.allowMultipleResponses === false && currentCollectorId) {
                localStorage.setItem(`survey_${currentCollectorId}_submitted`, 'true');
            }
            if (result.action?.type === 'disqualifyRespondent') {
                setIsDisqualified(true);
                setDisqualificationMessage(result.action.disqualificationMessage || "Disqualified.");
            } else {
                navigate(result.redirectUrl || '/thank-you', { state: { responseId: result.responseId } });
            }
        } catch (errCatch) {
            const errorMessage = errCatch.response?.data?.message || errCatch.message || "Submission error.";
            console.error("[SurveyTakingPage] handleSubmit error:", errCatch.response || errCatch);
            setError(errorMessage);
            toast.error(`Failed: ${errorMessage}`);
            if (recaptchaEnabled && recaptchaRef.current && recaptchaSiteKey) {
                recaptchaRef.current.reset();
                setRecaptchaToken(null);
            }
        } finally {
            setIsSubmitting(false);
        }
    }, [currentCollectorId, recaptchaEnabled, recaptchaToken, recaptchaSiteKey, visibleQuestionIndices, originalQuestions, evaluateDisabled, validateQuestion, currentAnswers, questionsById, otherInputValues, sessionId, surveyId, navigate, recaptchaRef, questionIdToOriginalIndexMap, surveyStartedAt, location.state, OTHER_VALUE_INTERNAL, isDisqualified]);

    if (hasAlreadyResponded) { return ( <div className={styles.surveyContainer}> <h1 className={styles.surveyTitle}>{survey?.title || 'Survey'}</h1> <div className={styles.alreadyRespondedBox}> <h2>Already Responded</h2> <p>Our records indicate that you have already completed this survey.</p> <p>Multiple submissions are not permitted for this link.</p> <button onClick={() => navigate('/')} className={styles.navButton}>Go to Homepage</button> </div> </div> ); }
    if (isLoading && !survey) return <div className={styles.loading}>Loading survey...</div>;
    if (error && !survey && !hasAlreadyResponded) return <div className={styles.errorContainer}><h2>Error Loading Survey</h2><p>{error}</p><button onClick={() => { const controller = new AbortController(); fetchSurvey(controller.signal); }} className={styles.navButton}>Retry</button></div>;
    if (!survey && !isLoading && !error && !hasAlreadyResponded) return <div className={styles.errorContainer}>Survey not found or could not be loaded.</div>;
    if (isDisqualified) return ( <div className={styles.surveyContainer}><h1 className={styles.surveyTitle}>{survey?.title||'Survey'}</h1><div className={styles.disqualifiedBox}><h2>Survey Ended</h2><p>{disqualificationMessage || "You do not qualify."}</p></div></div> );
    
    const finalCurrentQToRender = currentQToRenderMemoized;
    const finalIsSubmitState = isSubmitStateDerived;
    const isCurrentQuestionDisabled = finalCurrentQToRender ? evaluateDisabled(questionIdToOriginalIndexMap[finalCurrentQToRender._id]) : false;
    
    return ( <div className={styles.surveyContainer}> <h1 className={styles.surveyTitle}>{survey?.title || 'Survey'}</h1> {(visitedPath.length === 0 || (visitedPath.length === 1 && currentVisibleIndex === 0 && visibleQuestionIndices.indexOf(visitedPath[0]) === 0 )) && survey?.description && <p className={styles.surveyDescription}>{survey.description}</p>} {error && survey && <div className={styles.submissionError}><p>Error: {error}</p></div>} {isLoading && survey ? <div className={styles.loading}>Loading question...</div> : <div className={`${styles.questionBox} ${isCurrentQuestionDisabled ? styles.disabled : ''}`}> {finalIsSubmitState ? ( <div className={styles.submitPrompt}> <p>End of survey.</p> <p>Click "Submit" to record responses.</p> </div> ) : finalCurrentQToRender ? ( renderQuestion(finalCurrentQToRender) ) : ( originalQuestions.length > 0 && visibleQuestionIndices.length === 0 && !isDisqualified ? <div className={styles.submitPrompt}><p>No questions visible. Submit if applicable.</p></div> : (isLoading ? <div className={styles.loading}>Preparing...</div> : <div className={styles.loading}>Survey empty or issue.</div>) )} </div> } {finalIsSubmitState && recaptchaEnabled && recaptchaSiteKey && ( <div className={styles.recaptchaContainer}> <ReCAPTCHA ref={recaptchaRef} sitekey={recaptchaSiteKey} onChange={(token) => setRecaptchaToken(token)} onExpired={() => setRecaptchaToken(null)} onErrored={() => { toast.error("reCAPTCHA failed. Refresh."); setRecaptchaToken(null); }} /> </div> )} <div className={styles.surveyNavigationArea}> <button onClick={handlePrevious} className={styles.navButton} disabled={isDisqualified || isLoading || isSubmitting || (currentVisibleIndex === 0 && visitedPath.length <= 1) }> Previous </button> {finalIsSubmitState || (originalQuestions.length > 0 && visibleQuestionIndices.length === 0 && !isDisqualified && !isLoading) ? ( <button onClick={handleSubmit} className={styles.submitButton} disabled={isDisqualified || isSubmitting || isLoading || (recaptchaEnabled && recaptchaSiteKey && !recaptchaToken)} > {isSubmitting ? 'Submitting...' : 'Submit'} </button> ) : ( <button onClick={handleNext} className={styles.navButton} disabled={isDisqualified || isSubmitting || isLoading || !finalCurrentQToRender } > Next </button> )} </div> <div className={styles.progressIndicator}> {!finalIsSubmitState && finalCurrentQToRender ? (visibleQuestionIndices.length > 0 ? `Question ${currentVisibleIndex + 1} of ${visibleQuestionIndices.length}` : 'Loading...') : (finalIsSubmitState ? `End (${visibleQuestionIndices.length} questions shown)`: 'Initializing...')} </div> </div> );
}
export default SurveyTakingPage;
// ----- END OF COMPLETE MODIFIED FILE (vNext2 - Refined Validation) -----