// frontend/src/pages/SurveyTakingPage.js
// ----- START OF COMPLETE MODIFIED FILE (v1.15 - Full "Other Text" & Refined Conjoint Logic) -----
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import ReCAPTCHA from "react-google-recaptcha";
import { toast } from 'react-toastify';
import surveyApi from '../api/surveyApi';
import styles from './SurveyTakingPage.module.css';

// Question component imports
import CardSortQuestion from '../components/survey_question_renders/CardSortQuestion';
import CheckboxQuestion from '../components/survey_question_renders/CheckboxQuestion';
import ConjointQuestion from '../components/survey_question_renders/ConjointQuestion';
import DropdownQuestion from '../components/survey_question_renders/DropdownQuestion';
import HeatmapQuestion from '../components/survey_question_renders/HeatmapQuestion';
import MatrixQuestion from '../components/survey_question_renders/MatrixQuestion';
import MaxDiffQuestion from '../components/survey_question_renders/MaxDiffQuestion';
import MultipleChoiceQuestion from '../components/survey_question_renders/MultipleChoiceQuestion';
import NpsQuestion from '../components/survey_question_renders/NpsQuestion';
import RankingQuestion from '../components/survey_question_renders/RankingQuestion';
import RatingQuestion from '../components/survey_question_renders/RatingQuestion';
import ShortTextQuestion from '../components/survey_question_renders/ShortTextQuestion';
import SliderQuestion from '../components/survey_question_renders/SliderQuestion';
import TextAreaQuestion from '../components/survey_question_renders/TextAreaQuestion';

// --- Client-Side Skip Logic Evaluation (Helper Functions) ---
function evaluateCondition(condition, currentAnswers, questionsById, otherInputValues = {}) {
    const sourceQuestionIdStr = condition.sourceQuestionId?.toString();
    const sourceQuestion = questionsById[sourceQuestionIdStr];

    if (!sourceQuestion) { return false; }

    const answerValue = currentAnswers[sourceQuestionIdStr];
    const UNASSIGNED_CARD_SORT_CATEGORY_ID = '__UNASSIGNED_CARDS__';
    const OTHER_TEXT_INPUT_VALUE = (otherInputValues[`${sourceQuestionIdStr}_other`] || '').trim();
    const NA_VALUE_INTERNAL = '__NA__'; // As defined in MC and Checkbox questions
    const OTHER_VALUE_INTERNAL = '__OTHER__'; // As defined in MC and Checkbox questions


    const isAnswerEmpty = (ans, questionType) => { // Added questionType for context
        if (Array.isArray(ans)) return ans.length === 0;
        if (typeof ans === 'object' && ans !== null) {
            if (questionType === 'heatmap') return !ans.clicks || ans.clicks.length === 0;
            if (questionType === 'cardsort') return !ans.assignments || Object.keys(ans.assignments).length === 0;
            if (questionType === 'conjoint') return !ans || Object.keys(ans).length === 0;
            if (questionType === 'maxdiff') return !ans || (ans.best === null && ans.worst === null);
            // For matrix, it's empty if no rows have values or checked boxes
            if (questionType === 'matrix') {
                if (sourceQuestion.matrixType === 'checkbox') {
                    return !Object.values(ans).some(rowSelections => 
                        typeof rowSelections === 'object' && rowSelections !== null && Object.values(rowSelections).some(isSelected => isSelected === true)
                    );
                } else { // radio
                    return !Object.values(ans).some(val => val !== undefined && val !== null && String(val).trim() !== '');
                }
            }
        }
        return ans === undefined || ans === null || String(ans).trim() === '';
    };
    
    // --- Handle "Other Text" specific operators first if applicable ---
    if (sourceQuestion.addOtherOption && condition.conditionOperator?.startsWith('otherText')) {
        switch (condition.conditionOperator) {
            case 'otherTextEq': return OTHER_TEXT_INPUT_VALUE === condition.conditionValue;
            case 'otherTextNe': return OTHER_TEXT_INPUT_VALUE !== condition.conditionValue;
            case 'otherTextContains': return OTHER_TEXT_INPUT_VALUE.includes(condition.conditionValue);
            case 'otherTextNotContains': return !OTHER_TEXT_INPUT_VALUE.includes(condition.conditionValue);
            case 'otherTextIsEmpty': return OTHER_TEXT_INPUT_VALUE === '';
            case 'otherTextIsNotEmpty': return OTHER_TEXT_INPUT_VALUE !== '';
            default: return false; // Unknown "other text" operator
        }
    }

    // --- Standard operators ---
    if (condition.conditionOperator === 'isEmpty') {
        return isAnswerEmpty(answerValue, sourceQuestion.type);
    }
    if (condition.conditionOperator === 'isNotEmpty') {
        return !isAnswerEmpty(answerValue, sourceQuestion.type);
    }
    
    const operatorRequiresNonEmptyForStandardValue = !['ne', 'notContains'].includes(condition.conditionOperator);
    if (operatorRequiresNonEmptyForStandardValue && isAnswerEmpty(answerValue, sourceQuestion.type)) {
        return false;
    }
    
    const conditionValStr = String(condition.conditionValue);

    switch (sourceQuestion.type) {
        case 'text':
        case 'textarea':
            const ansStrText = String(answerValue || ''); 
            switch (condition.conditionOperator) {
                case 'eq': return ansStrText === conditionValStr;
                case 'ne': return ansStrText !== conditionValStr;
                case 'contains': return ansStrText.includes(conditionValStr);
                case 'notContains': return !ansStrText.includes(conditionValStr);
                default: return false;
            }

        case 'multiple-choice':
        case 'dropdown':
            // For these types, if an "Other Text" operator was not matched above,
            // it means the condition is about the main selected value (e.g., __OTHER__ itself).
            const ansStrMc = String(answerValue || '');
            switch (condition.conditionOperator) {
                case 'eq': return ansStrMc === conditionValStr; 
                case 'ne': return ansStrMc !== conditionValStr;
                default: return false;
            }

        case 'checkbox':
            // Similar to MC, "Other Text" ops handled above. This is for selected values.
            const ansArrCb = Array.isArray(answerValue) ? answerValue.map(String) : [];
            switch (condition.conditionOperator) {
                case 'contains': return ansArrCb.includes(conditionValStr); 
                case 'notContains': return !ansArrCb.includes(conditionValStr);
                default: return false;
            }

        case 'slider':
        case 'rating':
        case 'nps':
            const numAnswer = parseFloat(answerValue);
            const numConditionVal = parseFloat(conditionValStr);
            if (isNaN(numAnswer)) return false; 
            if (isNaN(numConditionVal) && ['eq', 'ne', 'gt', 'gte', 'lt', 'lte'].includes(condition.conditionOperator) ) return false;
            switch (condition.conditionOperator) {
                case 'eq': return numAnswer === numConditionVal;
                case 'ne': return numAnswer !== numConditionVal;
                case 'gt': return numAnswer > numConditionVal;
                case 'gte': return numAnswer >= numConditionVal;
                case 'lt': return numAnswer < numConditionVal;
                case 'lte': return numAnswer <= numConditionVal;
                default: return false;
            }
        
        case 'matrix':
            if (typeof answerValue !== 'object' || answerValue === null) return false;
            switch (condition.conditionOperator) {
                case 'rowValueEquals': 
                    const [rv_row, rv_val] = conditionValStr.split(';');
                    if (!rv_row || rv_val === undefined) return false;
                    if (sourceQuestion.matrixType === 'checkbox') {
                         return !!answerValue[rv_row]?.[rv_val]; 
                    }
                    return String(answerValue[rv_row]) === rv_val; 
                case 'rowIsAnswered': 
                    if (sourceQuestion.matrixType === 'checkbox') {
                        const rowSelections = answerValue[conditionValStr];
                        if (typeof rowSelections !== 'object' || rowSelections === null) return false;
                        return Object.values(rowSelections).some(isSelected => isSelected === true);
                    }
                    const radioRowAns = answerValue[conditionValStr];
                    return radioRowAns !== undefined && radioRowAns !== null && String(radioRowAns).trim() !== '';
                case 'rowIsNotAnswered': 
                     if (sourceQuestion.matrixType === 'checkbox') {
                        const rowSelections = answerValue[conditionValStr];
                        if (typeof rowSelections !== 'object' || rowSelections === null) return true; 
                        return !Object.values(rowSelections).some(isSelected => isSelected === true);
                    }
                    const radioRowAnsEmpty = answerValue[conditionValStr];
                    return radioRowAnsEmpty === undefined || radioRowAnsEmpty === null || String(radioRowAnsEmpty).trim() === '';
                default: return false;
            }

        case 'ranking':
            const ansArrRank = Array.isArray(answerValue) ? answerValue.map(String) : [];
            switch (condition.conditionOperator) {
                case 'itemAtRankIs': 
                    const [ar_rankStr, ar_itemId] = conditionValStr.split(';');
                    const rankIndex = parseInt(ar_rankStr, 10) - 1; 
                    if (isNaN(rankIndex) || !ar_itemId || rankIndex < 0 || rankIndex >= ansArrRank.length) return false;
                    return ansArrRank[rankIndex] === ar_itemId;
                case 'itemIsRanked': 
                    return ansArrRank.includes(conditionValStr);
                default: return false;
            }

        case 'heatmap':
            if (typeof answerValue !== 'object' || answerValue === null) return false;
            const totalClicks = answerValue.totalClicks || 0;
            const clickedAreaIdsArray = Array.isArray(answerValue.clickedAreaIds) ? answerValue.clickedAreaIds : [];
            switch (condition.conditionOperator) {
                case 'clickCountEq': return totalClicks === parseInt(conditionValStr, 10);
                case 'clickCountGt': return totalClicks > parseInt(conditionValStr, 10);
                case 'clickCountLt': return totalClicks < parseInt(conditionValStr, 10);
                case 'clickCountGte': return totalClicks >= parseInt(conditionValStr, 10);
                case 'clickCountLte': return totalClicks <= parseInt(conditionValStr, 10);
                case 'clickInArea': 
                    return clickedAreaIdsArray.includes(conditionValStr);
                default: return false;
            }

        case 'maxdiff':
            if (typeof answerValue !== 'object' || answerValue === null) return false;
            switch (condition.conditionOperator) {
                case 'bestIs': return String(answerValue.best) === conditionValStr;
                case 'worstIs': return String(answerValue.worst) === conditionValStr;
                default: return false;
            }

        case 'cardsort':
            if (typeof answerValue !== 'object' || answerValue === null || typeof answerValue.assignments !== 'object') return false;
            const assignments = answerValue.assignments || {};
            const allCardsInQuestion = sourceQuestion.options?.map(opt => opt.id || opt.value || String(opt)) || [];
            switch (condition.conditionOperator) {
                case 'cardInCategory': 
                    const [cic_cardId, cic_categoryId] = conditionValStr.split(';');
                    if (!cic_cardId || !cic_categoryId) return false;
                    if (cic_categoryId === UNASSIGNED_CARD_SORT_CATEGORY_ID) {
                        return !assignments[cic_cardId] || assignments[cic_cardId] === UNASSIGNED_CARD_SORT_CATEGORY_ID;
                    }
                    return String(assignments[cic_cardId]) === cic_categoryId;
                case 'categoryHasCards': 
                    if (conditionValStr === UNASSIGNED_CARD_SORT_CATEGORY_ID) {
                        return allCardsInQuestion.some(cardId => !assignments[cardId] || assignments[cardId] === UNASSIGNED_CARD_SORT_CATEGORY_ID);
                    }
                    for (const cardIdKey in assignments) {
                        if (assignments.hasOwnProperty(cardIdKey) && String(assignments[cardIdKey]) === conditionValStr) {
                            return true; 
                        }
                    }
                    return false;
                case 'categoryIsEmpty': 
                    if (conditionValStr === UNASSIGNED_CARD_SORT_CATEGORY_ID) {
                        return !allCardsInQuestion.some(cardId => !assignments[cardId] || assignments[cardId] === UNASSIGNED_CARD_SORT_CATEGORY_ID);
                    }
                    for (const cardIdKey in assignments) {
                        if (assignments.hasOwnProperty(cardIdKey) && String(assignments[cardIdKey]) === conditionValStr) {
                            return false; 
                        }
                    }
                    return true; 
                default: return false;
            }
        
        case 'conjoint':
            if (typeof answerValue !== 'object' || answerValue === null) return false;
            switch (condition.conditionOperator) {
                case 'choiceForTaskIsNone': // condition.conditionValue is the taskId (e.g., "task_0")
                    const taskIdForNoneCheck = conditionValStr;
                    return answerValue[taskIdForNoneCheck] === 'none';
                
                case 'choiceForTaskAttributeIsLevel': // condition.conditionValue is "taskId;Attribute Name;Level Name"
                    const parts = conditionValStr.split(';');
                    if (parts.length !== 3) return false; // Malformed condition value
                    const cjt_taskId = parts[0];
                    const cjt_attrName = parts[1];
                    const cjt_levelName = parts[2];
                    
                    const choiceForThisTask = answerValue[cjt_taskId];
                    if (typeof choiceForThisTask !== 'object' || choiceForThisTask === null) return false; // Not a profile object, or task not answered
                    
                    return String(choiceForThisTask[cjt_attrName]) === cjt_levelName;

                default:
                    console.warn(`Skip logic: Operator ${condition.conditionOperator} not implemented for Conjoint or is a common operator handled elsewhere.`);
                    return false; // Or true if a common operator like isEmpty/isNotEmpty was already handled
            }

        default:
            console.warn(`Skip logic: Evaluation not implemented for question type: ${sourceQuestion.type}`);
            return false;
    }
}

// --- evaluateLogicGroup, evaluateRuleConditions, getDynamicallyVisibleQuestionIds ---
// (These remain largely the same as v1.14, but ensure 'condition' object passed to evaluateCondition is complete if needed by specific operators)
function evaluateLogicGroup(group, currentAnswers, questionsById, otherInputValues) {
    if (!group.conditions || group.conditions.length === 0) return true; 
    if (group.groupOperator === 'AND') {
        return group.conditions.every(cond => evaluateCondition(cond, currentAnswers, questionsById, otherInputValues));
    } else if (group.groupOperator === 'OR') {
        return group.conditions.some(cond => evaluateCondition(cond, currentAnswers, questionsById, otherInputValues));
    }
    return false;
}

function evaluateRuleConditions(rule, currentAnswers, questionsById, otherInputValues) {
    if (!rule.groups || rule.groups.length === 0) return true; 
    if (rule.overallOperator === 'AND') {
        return rule.groups.every(group => evaluateLogicGroup(group, currentAnswers, questionsById, otherInputValues));
    } else if (rule.overallOperator === 'OR') {
        return rule.groups.some(group => evaluateLogicGroup(group, currentAnswers, questionsById, otherInputValues));
    }
    return false;
}

function getDynamicallyVisibleQuestionIds(allOriginalQuestions, globalSkipLogicRules = [], currentAnswers = {}, otherInputValues = {}) {
    if (!allOriginalQuestions || allOriginalQuestions.length === 0) return new Set();

    const questionsById = allOriginalQuestions.reduce((acc, q) => { acc[q._id.toString()] = q; return acc; }, {});
    const questionIdsInOrder = allOriginalQuestions.map(q => q._id.toString());
    
    let questionsToHide = new Set();
    let jumpToEndTriggeredByQuestionIndex = -1; 

    for (const rule of globalSkipLogicRules) {
        // No need to add conjointTaskId here anymore if conditionValue itself is structured for conjoint
        if (evaluateRuleConditions(rule, currentAnswers, questionsById, otherInputValues)) {
            const action = rule.action;
            if (action.type === 'hideQuestion' && action.targetQuestionId) {
                questionsToHide.add(action.targetQuestionId.toString());
            } else if (action.type === 'skipToQuestion' && action.targetQuestionId) {
                let triggerQuestionOriginalIndex = -1;
                rule.groups.forEach(g => g.conditions.forEach(c => { 
                    const q = questionsById[c.sourceQuestionId?.toString()];
                    if (q && q.originalIndex > triggerQuestionOriginalIndex) {
                        triggerQuestionOriginalIndex = q.originalIndex;
                    }
                }));

                const targetQuestion = questionsById[action.targetQuestionId.toString()];
                if (targetQuestion && triggerQuestionOriginalIndex !== -1 && targetQuestion.originalIndex > triggerQuestionOriginalIndex) {
                    allOriginalQuestions.forEach(q => {
                        if (q.originalIndex > triggerQuestionOriginalIndex && q.originalIndex < targetQuestion.originalIndex) {
                            questionsToHide.add(q._id.toString());
                        }
                    });
                }
            } else if (action.type === 'jumpToEndOfSurvey' || action.type === 'disqualifyRespondent' || action.type === 'markAsCompleted') {
                let triggerQuestionOriginalIndex = -1;
                 rule.groups.forEach(g => g.conditions.forEach(c => { 
                    const q = questionsById[c.sourceQuestionId?.toString()];
                    if (q && q.originalIndex > triggerQuestionOriginalIndex) {
                        triggerQuestionOriginalIndex = q.originalIndex;
                    }
                }));
                
                if (jumpToEndTriggeredByQuestionIndex === -1 || triggerQuestionOriginalIndex < jumpToEndTriggeredByQuestionIndex) {
                    jumpToEndTriggeredByQuestionIndex = triggerQuestionOriginalIndex;
                }
            }
        }
    }

    if (jumpToEndTriggeredByQuestionIndex !== -1) {
        allOriginalQuestions.forEach(q => {
            if (q.originalIndex > jumpToEndTriggeredByQuestionIndex) {
                questionsToHide.add(q._id.toString());
            }
        });
    }
    
    const visibleIds = new Set();
    questionIdsInOrder.forEach(id => {
        if (!questionsToHide.has(id)) {
            visibleIds.add(id);
        }
    });
    return visibleIds;
}
// --- End Client-Side Skip Logic Evaluation ---

// ... (Rest of SurveyTakingPage.js - state, useEffects, handlers, render - remains the same as v1.14)
const ensureArray = (value) => (Array.isArray(value) ? value : (value !== undefined && value !== null ? [value] : []));
const formatQuestionNumber = (index, format, customPrefix, isAllOnOnePage = false, questionOriginalIndex = 0) => { 
    const number = isAllOnOnePage ? questionOriginalIndex + 1 : index + 1;
    switch (format) { 
        case 'abc': return String.fromCharCode(96 + number); 
        case 'ABC': return String.fromCharCode(64 + number); 
        case 'roman': const romanMap = { M: 1000, CM: 900, D: 500, CD: 400, C: 100, XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1 }; let roman = ''; let num = number; for (let key in romanMap) { while (num >= romanMap[key]) { roman += key; num -= romanMap[key]; } } return roman || String(number); 
        case 'custom': return `${customPrefix || ''}${number}`; 
        case '123': default: return `${number}.`; 
    } 
};
const renderQuestionWithNumberLayout = (questionNumberDisplay, questionComponent, questionId) => { 
    return ( 
        <div className={styles.questionLayoutWrapper} key={`qlw-${questionId}`}> 
            {questionNumberDisplay && ( <div className={styles.questionNumberArea}>{questionNumberDisplay}</div> )} 
            <div className={styles.questionComponentArea}> {questionComponent} </div> 
        </div> 
    ); 
};

function SurveyTakingPage() {
    const { surveyId, collectorId, resumeToken: routeResumeToken } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    
    const [initialSurveyTitle, setInitialSurveyTitle] = useState('');
    const [collectorSettings, setCollectorSettings] = useState(null); 
    const [survey, setSurvey] = useState(null); 
    const [originalQuestions, setOriginalQuestions] = useState([]); 
    const [currentAnswers, setCurrentAnswers] = useState({});
    const [otherInputValues, setOtherInputValues] = useState({});
    const [isLoadingSurvey, setIsLoadingSurvey] = useState(true);
    const [surveyError, setSurveyError] = useState(null);
    const [currentVisibleIndex, setCurrentVisibleIndex] = useState(0); 
    const [dynamicallyVisibleQuestionIds, setDynamicallyVisibleQuestionIds] = useState(new Set());
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submissionError, setSubmissionError] = useState(null);
    const [currentResumeToken, setCurrentResumeToken] = useState(routeResumeToken || null);
    const [isSavingAndContinueLater, setIsSavingAndContinueLater] = useState(false);
    const [isAutoSaving, setIsAutoSaving] = useState(false);
    const [showResumeCodeModal, setShowResumeCodeModal] = useState(false);
    const [generatedResumeCode, setGeneratedResumeCode] = useState('');
    const [emailForReminder, setEmailForReminder] = useState('');
    const [promptForEmailOnSave, setPromptForEmailOnSave] = useState(false);
    const [clientSessionId, setClientSessionId] = useState(null);
    const [recaptchaToken, setRecaptchaToken] = useState(null);
    const recaptchaRef = useRef(null);
    const [showValidationModal, setShowValidationModal] = useState(false);
    const [validationModalMessage, setValidationModalMessage] = useState('');
    const autoAdvanceTimeoutRef = useRef(null);
    const autoSaveTimerRef = useRef(null); 
    const lastActivityTimestampRef = useRef(Date.now()); 
    const OTHER_VALUE_INTERNAL = '__OTHER__';
    const [capturedCustomVariables, setCapturedCustomVariables] = useState({});

    const questionDisplayMode = useMemo(() => collectorSettings?.questionDisplayMode || 'onePerPage', [collectorSettings]);
    const questionsById = useMemo(() => { if (!originalQuestions || originalQuestions.length === 0) return {}; return originalQuestions.reduce((acc, q) => { acc[q._id.toString()] = q; return acc; }, {}); }, [originalQuestions]);

    useEffect(() => {
        if (survey?.globalSkipLogic && originalQuestions.length > 0) { 
            const newVisibleIds = getDynamicallyVisibleQuestionIds(originalQuestions, survey.globalSkipLogic, currentAnswers, otherInputValues);
            if (newVisibleIds.size !== dynamicallyVisibleQuestionIds.size || 
                ![...newVisibleIds].every(id => dynamicallyVisibleQuestionIds.has(id))) {
                setDynamicallyVisibleQuestionIds(newVisibleIds);
            }
        }
    }, [currentAnswers, otherInputValues, survey?.globalSkipLogic, originalQuestions, dynamicallyVisibleQuestionIds]);


    const currentQuestionToRenderOnePerPage = useMemo(() => { 
        if (questionDisplayMode !== 'onePerPage' || isLoadingSurvey || !survey || originalQuestions.length === 0 || dynamicallyVisibleQuestionIds.size === 0) { 
            return null; 
        }
        const orderedVisibleQuestions = originalQuestions
            .filter(q => dynamicallyVisibleQuestionIds.has(q._id.toString()))
            .sort((a, b) => a.originalIndex - b.originalIndex);

        if (currentVisibleIndex < 0 || currentVisibleIndex >= orderedVisibleQuestions.length) return null;
        
        return orderedVisibleQuestions[currentVisibleIndex]; 
    }, [questionDisplayMode, isLoadingSurvey, survey, originalQuestions, dynamicallyVisibleQuestionIds, currentVisibleIndex]);

    const allVisibleQuestionsToRender = useMemo(() => {
        if (isLoadingSurvey || !survey || originalQuestions.length === 0 || dynamicallyVisibleQuestionIds.size === 0) { 
            return [];
        }
        return originalQuestions
            .filter(q => dynamicallyVisibleQuestionIds.has(q._id.toString()))
            .sort((a, b) => a.originalIndex - b.originalIndex); 
    }, [isLoadingSurvey, survey, originalQuestions, dynamicallyVisibleQuestionIds]);

    const isSubmitState = useMemo(() => { 
        if (isLoadingSurvey || !survey) return false; 
        if (questionDisplayMode === 'allOnOnePage') return allVisibleQuestionsToRender.length > 0 || Object.keys(currentAnswers).length > 0; 
        
        const orderedVisibleQuestions = originalQuestions
            .filter(q => dynamicallyVisibleQuestionIds.has(q._id.toString()));
        return currentVisibleIndex >= orderedVisibleQuestions.length - 1 && orderedVisibleQuestions.length > 0; 
    }, [isLoadingSurvey, survey, currentVisibleIndex, questionDisplayMode, allVisibleQuestionsToRender, originalQuestions, dynamicallyVisibleQuestionIds, currentAnswers]);
    
    const orderedVisibleForOnePerPage = useMemo(() => 
        originalQuestions
            .filter(q => dynamicallyVisibleQuestionIds.has(q._id.toString()))
            .sort((a,b) => a.originalIndex - b.originalIndex), 
        [originalQuestions, dynamicallyVisibleQuestionIds]
    );

    useEffect(() => { let c = sessionStorage.getItem(`surveyClientSessionId_${surveyId}_${collectorId}`); if(!c){c=uuidv4(); sessionStorage.setItem(`surveyClientSessionId_${surveyId}_${collectorId}`,c);} setClientSessionId(c);},[surveyId, collectorId]);
    useEffect(()=>{ const s = location.state; if(s){ if(s.surveyTitle && s.surveyTitle!==initialSurveyTitle) setInitialSurveyTitle(s.surveyTitle); }}, [location.state, initialSurveyTitle]);
    useEffect(() => { return () => { if (autoAdvanceTimeoutRef.current) clearTimeout(autoAdvanceTimeoutRef.current); if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); }; }, []);
    const recordUserActivity = useCallback(() => { lastActivityTimestampRef.current = Date.now(); }, []);
    useEffect(() => { const activityEvents = ['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart']; activityEvents.forEach(event => window.addEventListener(event, recordUserActivity, { passive: true })); return () => { activityEvents.forEach(event => window.removeEventListener(event, recordUserActivity)); }; }, [recordUserActivity]);
    const performSaveAndContinue = useCallback(async (emailForSave = null, isAuto = false) => { if (!surveyId || !collectorId || !clientSessionId) { if (!isAuto) toast.error("Cannot save: IDs missing or session not initialized."); else console.warn("[AutoSave] Cannot save: IDs missing or session not initialized."); return;  } if (isAuto && (isSavingAndContinueLater || isSubmitting)) { console.log("[AutoSave] Skipped: Manual save or submission in progress."); return; } if (isAuto) setIsAutoSaving(true); else setIsSavingAndContinueLater(true); try { const payload = { collectorId, answers: currentAnswers, otherInputValues, currentVisibleIndex, resumeToken: currentResumeToken, sessionId: clientSessionId, customVariables: capturedCustomVariables }; if (emailForSave && !isAuto) payload.respondentEmail = emailForSave; const result = await surveyApi.savePartialResponse(surveyId, payload); if (result.success && result.resumeToken) { if (currentResumeToken !== result.resumeToken) setCurrentResumeToken(result.resumeToken); if (!isAuto) { setGeneratedResumeCode(result.resumeToken); setShowResumeCodeModal(true); setPromptForEmailOnSave(false);  if (emailForSave && result.emailSent === true) toast.success(`Progress saved! A resume link has been sent to ${emailForSave}.`); else if (emailForSave && result.emailSent === false) toast.warn("Progress saved, but the resume email could not be sent. Use the code if available."); else toast.info("Progress saved!");  } else { console.log("[AutoSave] Progress auto-saved successfully. New token (if any):", result.resumeToken); } } else { if (!isAuto) toast.error(result.message || "Failed to save progress."); else console.error("[AutoSave] Failed:", result.message || "Unknown error"); } } catch (err) { if (!isAuto) toast.error(err.message || "Error saving progress."); else console.error("[AutoSave] Error:", err.message || "Unknown error"); } finally { if (isAuto) setIsAutoSaving(false); else setIsSavingAndContinueLater(false); } }, [surveyId, collectorId, currentAnswers, otherInputValues, currentVisibleIndex, currentResumeToken, clientSessionId, capturedCustomVariables, isSavingAndContinueLater, isSubmitting]);
    useEffect(() => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); const autoSaveEnabled = collectorSettings?.autoSaveEnabled ?? false; const manualSaveEnabled = collectorSettings?.allowResume ?? false; if (autoSaveEnabled && manualSaveEnabled && !isSubmitting && !isLoadingSurvey && surveyId && collectorId && clientSessionId) { const intervalSeconds = collectorSettings?.autoSaveIntervalSeconds || 60; const checkAndAutoSave = () => { const now = Date.now(); const timeSinceLastActivity = now - lastActivityTimestampRef.current; if (timeSinceLastActivity >= intervalSeconds * 1000) { if (Object.keys(currentAnswers).length > 0 || Object.keys(otherInputValues).length > 0 || currentResumeToken === null) { performSaveAndContinue(null, true); } lastActivityTimestampRef.current = Date.now(); } autoSaveTimerRef.current = setTimeout(checkAndAutoSave, intervalSeconds * 1000 / 2); }; autoSaveTimerRef.current = setTimeout(checkAndAutoSave, intervalSeconds * 1000); } else { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); } return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); }; }, [collectorSettings, isLoadingSurvey, isSubmitting, surveyId, collectorId, clientSessionId, performSaveAndContinue, currentAnswers, otherInputValues, currentResumeToken]);

    useEffect(() => { 
        if (!surveyId) { setSurveyError("Survey ID missing."); setIsLoadingSurvey(false); return; }
        if (!collectorId) { setSurveyError("Collector ID missing."); setIsLoadingSurvey(false); return; }
        setIsLoadingSurvey(true); setSurveyError(null); setSubmissionError(null); setShowValidationModal(false); setValidationModalMessage('');
        const fetchOptions = { forTaking: 'true', collectorId };
        const queryParams = new URLSearchParams(location.search);
        const queryParamsObject = Object.fromEntries(queryParams.entries());
        Object.keys(queryParamsObject).forEach(key => { fetchOptions[key] = queryParamsObject[key]; });
        let activeResumeToken = routeResumeToken || currentResumeToken; 
        const isResumingWithCodeFromState = location.state?.isResumingWithCode;
        const partialResponseFromState = location.state?.partialResponse;
        if (isResumingWithCodeFromState && partialResponseFromState?.resumeToken) { activeResumeToken = partialResponseFromState.resumeToken; if (activeResumeToken !== currentResumeToken) setCurrentResumeToken(activeResumeToken);
        } else if (routeResumeToken && routeResumeToken !== currentResumeToken) { activeResumeToken = routeResumeToken; setCurrentResumeToken(routeResumeToken); }
        if (activeResumeToken) fetchOptions.resumeToken = activeResumeToken;
        const abortController = new AbortController();
        surveyApi.getSurveyById(surveyId, { ...fetchOptions, signal: abortController.signal })
            .then(response => {
                if (response.success && response.data) {
                    setSurvey(response.data); 
                    const fetchedQuestions = (response.data.questions || []).sort((a,b) => a.originalIndex - b.originalIndex); 
                    setOriginalQuestions(fetchedQuestions);
                    
                    const apiCollectorSettings = response.data.collectorSettings || {}; 
                    const surveyBehaviorNav = response.data.settings?.behaviorNavigation || {};
                    const mergedSettings = { 
                        ...surveyBehaviorNav, ...apiCollectorSettings,
                        progressBarEnabled: apiCollectorSettings.progressBarEnabled ?? surveyBehaviorNav.progressBarEnabled ?? false, 
                        allowResume: apiCollectorSettings.saveAndContinueEnabled ?? surveyBehaviorNav.saveAndContinueEnabled ?? false, 
                        questionDisplayMode: apiCollectorSettings.questionDisplayMode || surveyBehaviorNav.questionDisplayMode || 'onePerPage',
                    };
                    setCollectorSettings(mergedSettings);

                    let tempAnswers = {};
                    let tempOtherValues = {};
                    const effectivePartialResponse = isResumingWithCodeFromState && partialResponseFromState ? partialResponseFromState : response.data.partialResponse;
                    if (effectivePartialResponse && typeof effectivePartialResponse === 'object' && Object.keys(effectivePartialResponse).length > 0) {
                        tempAnswers = effectivePartialResponse.answers || {};
                        tempOtherValues = effectivePartialResponse.otherInputValues || {};
                        setCurrentAnswers(tempAnswers); 
                        setOtherInputValues(tempOtherValues);
                        setCapturedCustomVariables(effectivePartialResponse.customVariables || {});
                        const partialVisibleIndex = effectivePartialResponse.currentVisibleIndex;
                        if (typeof partialVisibleIndex === 'number' && partialVisibleIndex >= 0 ) {
                             setCurrentVisibleIndex(partialVisibleIndex);
                        } else if (typeof partialVisibleIndex === 'number') {
                            setCurrentVisibleIndex(0);
                        }
                        if(effectivePartialResponse.resumeToken && effectivePartialResponse.resumeToken !== currentResumeToken) setCurrentResumeToken(effectivePartialResponse.resumeToken);
                        if (effectivePartialResponse.sessionId && effectivePartialResponse.sessionId !== clientSessionId) { setClientSessionId(effectivePartialResponse.sessionId); sessionStorage.setItem(`surveyClientSessionId_${surveyId}_${collectorId}`, effectivePartialResponse.sessionId); }
                    } else if (response.data.initialCustomVariables) {
                        setCapturedCustomVariables(response.data.initialCustomVariables || {});
                        setCurrentAnswers({}); setOtherInputValues({}); setCurrentVisibleIndex(0);
                    } else if (fetchOptions.resumeToken && !isResumingWithCodeFromState) { 
                        setCurrentResumeToken(null); setCurrentAnswers({}); setOtherInputValues({}); setCurrentVisibleIndex(0); setCapturedCustomVariables({});
                        toast.info("Could not resume previous session. Starting a new session.", { autoClose: 7000 }); 
                    } else {
                        setCurrentAnswers({}); setOtherInputValues({}); setCapturedCustomVariables({});
                    }
                    const initialVisibleIds = getDynamicallyVisibleQuestionIds(fetchedQuestions, response.data.globalSkipLogic, tempAnswers, tempOtherValues);
                    setDynamicallyVisibleQuestionIds(initialVisibleIds);

                    if (response.data.title && !initialSurveyTitle && !location.state?.surveyTitle) {
                         setInitialSurveyTitle(response.data.title);
                    }
                } else { setSurveyError(response.message || "Failed to load survey details."); setSurvey(null); }
            })
            .catch(err => { if (err.name !== 'AbortError' && err.message !== 'canceled') { setSurveyError(err.message || "Error loading survey details."); setSurvey(null); } })
            .finally(() => { setIsLoadingSurvey(false); });
        return () => { abortController.abort(); };
    }, [surveyId, collectorId, routeResumeToken, currentResumeToken, clientSessionId, initialSurveyTitle, location.search, location.state]);

    useEffect(() => { /* reCAPTCHA reset logic */ }, [collectorSettings?.enableRecaptcha]);

    const validateQuestion = useCallback((question) => { if (!question) return true; const answerValue = currentAnswers[question._id.toString()]; const otherText = otherInputValues[`${question._id.toString()}_other`]; const triggerValidationModal = (message) => { setValidationModalMessage(message); setShowValidationModal(true); return false; }; if (question.requiredSetting === 'required') { let isEmpty = false; if (answerValue === undefined || answerValue === null || String(answerValue).trim() === '') { if (!Array.isArray(answerValue) || answerValue.length === 0) isEmpty = true; } else if (Array.isArray(answerValue) && answerValue.length === 0) isEmpty = true; else if (typeof answerValue === 'object' && question.type === 'heatmap' && (!answerValue.clicks || answerValue.clicks.length === 0)) isEmpty = true; else if (typeof answerValue === 'object' && question.type === 'cardsort' && (!answerValue.assignments || Object.keys(answerValue.assignments).length === 0)) isEmpty = true; else if (typeof answerValue === 'object' && question.type === 'maxdiff' && (answerValue.best === null || answerValue.worst === null)) isEmpty = true; else if (typeof answerValue === 'object' && question.type === 'conjoint' && (Object.keys(answerValue).length < (question.conjointNumTasks || 0) ) ) isEmpty = true; if (isEmpty) { if (question.addOtherOption && question.requireOtherIfSelected && ((Array.isArray(answerValue) && answerValue.includes(OTHER_VALUE_INTERNAL)) || answerValue === OTHER_VALUE_INTERNAL) && (otherText === undefined || otherText === null || String(otherText).trim() === '')) { return triggerValidationModal(`Please provide text for the "Other" option for "${question.text || 'this question'}".`); } if (!question.addOtherOption || !((Array.isArray(answerValue) && answerValue.includes(OTHER_VALUE_INTERNAL)) || answerValue === OTHER_VALUE_INTERNAL)) { return triggerValidationModal(`This question ("${question.text || 'this question'}") is required.`); } } } if (question.addOtherOption && question.requireOtherIfSelected) { const otherIsSelected = Array.isArray(answerValue) ? answerValue.includes(OTHER_VALUE_INTERNAL) : answerValue === OTHER_VALUE_INTERNAL; if (otherIsSelected && (otherText === undefined || otherText === null || String(otherText).trim() === '')) { return triggerValidationModal(`Please provide text for the "Other" option for "${question.text || 'this question'}".`); } } setShowValidationModal(false); setValidationModalMessage(''); return true; }, [currentAnswers, otherInputValues, OTHER_VALUE_INTERNAL]);
    const validateAllVisibleQuestions = useCallback(() => { if (questionDisplayMode !== 'allOnOnePage') return true; for (const question of allVisibleQuestionsToRender) { if (!validateQuestion(question)) { const questionElement = document.getElementById(`question-${question._id.toString()}`); if (questionElement) { questionElement.scrollIntoView({ behavior: 'smooth', block: 'center' }); } return false; } } return true; }, [allVisibleQuestionsToRender, validateQuestion, questionDisplayMode]);
    const handleSubmit = useCallback(async () => { if (isSubmitting) return; if (questionDisplayMode === 'onePerPage' && currentQuestionToRenderOnePerPage && !validateQuestion(currentQuestionToRenderOnePerPage)) return; if (questionDisplayMode === 'allOnOnePage' && !validateAllVisibleQuestions()) return; setSubmissionError(null); if (!surveyId || !collectorId) { setSubmissionError("Cannot submit, survey or collector ID is missing."); return; } let csId = clientSessionId; if (!csId) { csId = uuidv4(); setClientSessionId(csId); sessionStorage.setItem(`surveyClientSessionId_${surveyId}_${collectorId}`, csId); } if (collectorSettings?.enableRecaptcha && !recaptchaToken) { setValidationModalMessage("Please complete the reCAPTCHA verification before submitting."); setShowValidationModal(true); setIsSubmitting(false); return; } setIsSubmitting(true); const payload = { collectorId, answers: currentAnswers, otherInputValues, resumeToken: currentResumeToken, clientSessionId: csId, recaptchaTokenV2: recaptchaToken, customVariables: capturedCustomVariables }; try { const result = await surveyApi.submitSurveyAnswers(surveyId, payload); if (result && result.success) { toast.success("Survey submitted successfully!"); sessionStorage.removeItem(`surveyClientSessionId_${surveyId}_${collectorId}`); if (recaptchaRef.current) recaptchaRef.current.reset(); setRecaptchaToken(null); navigate(`/thank-you`, {state: {surveyTitle: survey?.title || initialSurveyTitle, thankYouMessage: result.thankYouMessage}}); } else { setSubmissionError(result.message || "An unknown error occurred during submission."); if (recaptchaRef.current) recaptchaRef.current.reset(); setRecaptchaToken(null); } } catch (err) { setSubmissionError(err.message || "An unexpected error occurred."); if (recaptchaRef.current) recaptchaRef.current.reset(); setRecaptchaToken(null); } finally { setIsSubmitting(false); } }, [surveyId, collectorId, currentAnswers, otherInputValues, currentResumeToken, navigate, survey?.title, initialSurveyTitle, isSubmitting, clientSessionId, collectorSettings, recaptchaToken, currentQuestionToRenderOnePerPage, validateQuestion, questionDisplayMode, validateAllVisibleQuestions, capturedCustomVariables]);
    const handleNext = useCallback(() => { recordUserActivity(); if (autoAdvanceTimeoutRef.current) clearTimeout(autoAdvanceTimeoutRef.current); if (questionDisplayMode === 'onePerPage' && currentQuestionToRenderOnePerPage && !validateQuestion(currentQuestionToRenderOnePerPage)) return; setShowValidationModal(false); setValidationModalMessage(''); if (!isSubmitState) { setCurrentVisibleIndex(prev => prev + 1); } else { handleSubmit(); } }, [isSubmitState, validateQuestion, currentQuestionToRenderOnePerPage, handleSubmit, recordUserActivity, questionDisplayMode]);
    const handleInputChange = useCallback((questionId, value) => { recordUserActivity(); setCurrentAnswers(prev => ({ ...prev, [questionId.toString()]: value })); setShowValidationModal(false); setValidationModalMessage(''); const autoAdvanceEnabled = collectorSettings?.autoAdvance ?? false; if (questionDisplayMode === 'onePerPage' && autoAdvanceEnabled) { const question = questionsById[questionId.toString()]; const autoAdvanceTypes = ['multiple-choice', 'nps', 'rating']; const isOtherSelected = question && question.addOtherOption && value === OTHER_VALUE_INTERNAL; if (question && autoAdvanceTypes.includes(question.type) && !isSubmitState && !isOtherSelected) { if (autoAdvanceTimeoutRef.current) clearTimeout(autoAdvanceTimeoutRef.current); autoAdvanceTimeoutRef.current = setTimeout(() => { handleNext(); autoAdvanceTimeoutRef.current = null; }, 500); } else if (autoAdvanceTimeoutRef.current && isOtherSelected) { clearTimeout(autoAdvanceTimeoutRef.current); autoAdvanceTimeoutRef.current = null; } } }, [collectorSettings, questionsById, isSubmitState, handleNext, OTHER_VALUE_INTERNAL, recordUserActivity, questionDisplayMode]);
    const handleCheckboxChange = useCallback((questionId, optionValue, isChecked) => { recordUserActivity(); setCurrentAnswers(prev => { const qIdStr = questionId.toString(); const currentSelection = prev[qIdStr] ? [...ensureArray(prev[qIdStr])] : []; let newSelection = isChecked ? [...currentSelection, optionValue] : currentSelection.filter(val => val !== optionValue); if (optionValue === OTHER_VALUE_INTERNAL && !isChecked) { setOtherInputValues(prevOther => ({ ...prevOther, [`${qIdStr}_other`]: '' })); } return { ...prev, [qIdStr]: newSelection }; }); setShowValidationModal(false); setValidationModalMessage(''); }, [OTHER_VALUE_INTERNAL, recordUserActivity]);
    const handleOtherInputChange = useCallback((questionId, value) => { recordUserActivity(); const qIdStr = questionId.toString(); setOtherInputValues(prev => ({ ...prev, [`${qIdStr}_other`]: value })); setCurrentAnswers(prev => { const currentSelection = prev[qIdStr] ? [...ensureArray(prev[qIdStr])] : []; if (value && value.trim() !== '' && !currentSelection.includes(OTHER_VALUE_INTERNAL)) { return { ...prev, [qIdStr]: [...currentSelection, OTHER_VALUE_INTERNAL] }; } return prev; }); setShowValidationModal(false); setValidationModalMessage(''); }, [OTHER_VALUE_INTERNAL, recordUserActivity]);
    const handleComplexAnswerChange = useCallback((questionId, structuredAnswer) => { recordUserActivity(); setCurrentAnswers(prev => ({ ...prev, [questionId.toString()]: structuredAnswer })); setShowValidationModal(false); setValidationModalMessage(''); }, [recordUserActivity]);
    const handlePrevious = useCallback(() => { recordUserActivity(); if (questionDisplayMode === 'onePerPage') { if (autoAdvanceTimeoutRef.current) clearTimeout(autoAdvanceTimeoutRef.current); setShowValidationModal(false); setValidationModalMessage(''); setCurrentVisibleIndex(prev => (prev > 0 ? prev - 1 : prev)); } }, [recordUserActivity, questionDisplayMode]);
    const handleSaveAndContinueLater = useCallback(async () => { recordUserActivity(); const saveMethod = collectorSettings?.saveAndContinueMethod || survey?.settings?.behaviorNavigation?.saveAndContinueMethod || 'email'; const needsEmailPrompt = (saveMethod === 'email' || saveMethod === 'both') && !emailForReminder; if (needsEmailPrompt) { setPromptForEmailOnSave(true); setShowResumeCodeModal(true); return; } performSaveAndContinue(emailForReminder || null, false); }, [survey, collectorSettings, emailForReminder, performSaveAndContinue, recordUserActivity]);
    const handleModalEmailSubmitAndSave = useCallback(() => { recordUserActivity(); const saveMethod = collectorSettings?.saveAndContinueMethod || survey?.settings?.behaviorNavigation?.saveAndContinueMethod || 'email'; if ((saveMethod === 'email' || saveMethod === 'both') && !emailForReminder.trim()) { setValidationModalMessage("Please enter your email address to save and continue."); setShowValidationModal(true); return; } performSaveAndContinue(emailForReminder.trim(), false); }, [survey, collectorSettings, emailForReminder, performSaveAndContinue, recordUserActivity]);
    const renderProgressBar = useCallback(() => { const isEnabled = collectorSettings?.progressBarEnabled ?? false; if (!survey || !isEnabled || originalQuestions.length === 0) return null; let progress = 0; let barText = ''; const style = collectorSettings?.progressBarStyle || 'percentage'; if (questionDisplayMode === 'onePerPage') { const totalVisible = orderedVisibleForOnePerPage.length; const safeIdx = Math.min(currentVisibleIndex, totalVisible > 0 ? totalVisible - 1 : 0); progress = totalVisible > 0 ? ((safeIdx + 1) / totalVisible) * 100 : 0; if (style === 'percentage') barText = `${Math.round(progress)}% Complete`; else if (style === 'fraction' && totalVisible > 0) barText = `${safeIdx + 1} / ${totalVisible}`; else if (totalVisible === 0) barText = "0 / 0"; } else if (questionDisplayMode === 'allOnOnePage') { const totalVisible = allVisibleQuestionsToRender.length; const answeredCount = allVisibleQuestionsToRender.filter(q => { const ans = currentAnswers[q._id.toString()]; return ans !== undefined && ans !== null && String(ans).trim() !== '' && !(typeof ans === 'object' && Object.keys(ans).length === 0) && !(Array.isArray(ans) && ans.length === 0); }).length; progress = totalVisible > 0 ? (answeredCount / totalVisible) * 100 : 0; if (style === 'percentage') barText = `${Math.round(progress)}% Answered`; else if (style === 'fraction') barText = `${answeredCount} / ${totalVisible} Answered`; } return ( <div className={styles.progressBarContainer}> <div className={styles.progressBarTrack}><div className={styles.progressBarFill} style={{ width: `${progress.toFixed(2)}%` }}></div></div> {barText && <span>{barText}</span>} </div> ); }, [survey, originalQuestions, currentVisibleIndex, collectorSettings, questionDisplayMode, allVisibleQuestionsToRender, currentAnswers, dynamicallyVisibleQuestionIds, orderedVisibleForOnePerPage]);
    const renderSingleQuestionInputs = (question, indexForNumbering) => { if (!question) return <div className={styles.questionContainerPlaceholder} key={`placeholder-${indexForNumbering}`}><p>Error: Question data is missing.</p></div>; const showQuestionNumber = collectorSettings?.questionNumberingEnabled ?? true; let qNumDisplay = ""; if (showQuestionNumber) { const format = collectorSettings?.questionNumberingFormat || '123'; const prefix = collectorSettings?.questionNumberingCustomPrefix || ''; qNumDisplay = formatQuestionNumber(indexForNumbering, format, prefix, questionDisplayMode === 'allOnOnePage', question.originalIndex ); } const commonProps = { question, currentAnswer: currentAnswers[question._id.toString()], disabled: isSubmitting || isSavingAndContinueLater || isAutoSaving, isPreviewMode: false, key: question._id.toString() }; const choiceProps = { ...commonProps, otherValue: otherInputValues[`${question._id.toString()}_other`], onOtherTextChange: handleOtherInputChange }; let qComponent; switch (question.type) { case 'text': qComponent = <ShortTextQuestion {...commonProps} onAnswerChange={handleInputChange} />; break; case 'textarea': qComponent = <TextAreaQuestion {...commonProps} onAnswerChange={handleInputChange} />; break; case 'multiple-choice': qComponent = <MultipleChoiceQuestion {...choiceProps} onAnswerChange={handleInputChange} />; break; case 'checkbox': qComponent = <CheckboxQuestion {...choiceProps} onCheckboxChange={handleCheckboxChange} />; break; case 'dropdown': qComponent = <DropdownQuestion {...choiceProps} onAnswerChange={handleInputChange} />; break; case 'nps': qComponent = <NpsQuestion {...commonProps} onAnswerChange={handleInputChange} />; break; case 'rating': qComponent = <RatingQuestion {...commonProps} onAnswerChange={handleInputChange} />; break; case 'slider': qComponent = <SliderQuestion {...commonProps} onAnswerChange={handleInputChange} />; break; case 'ranking': qComponent = <RankingQuestion {...commonProps} onAnswerChange={handleComplexAnswerChange} />; break; case 'matrix': qComponent = <MatrixQuestion {...commonProps} onAnswerChange={handleComplexAnswerChange} />; break; case 'heatmap': qComponent = <HeatmapQuestion {...commonProps} onAnswerChange={handleComplexAnswerChange} />; break; case 'cardsort': qComponent = <CardSortQuestion {...commonProps} onAnswerChange={handleComplexAnswerChange} />; break; case 'conjoint': qComponent = <ConjointQuestion {...commonProps} onAnswerChange={handleComplexAnswerChange} />; break; case 'maxdiff': qComponent = <MaxDiffQuestion {...commonProps} onAnswerChange={handleComplexAnswerChange} />; break; default: qComponent = <p key={`unsupported-${question._id.toString()}`}>Unsupported: {question.type}</p>; } return <div id={`question-${question._id.toString()}`} className={styles.questionWrapperOnPage}>{renderQuestionWithNumberLayout(qNumDisplay, qComponent, question._id.toString())}</div>; };
    const handleCopyResumeCode = () => { if (generatedResumeCode) { navigator.clipboard.writeText(generatedResumeCode).then(() => toast.success("Resume code copied!")).catch(() => toast.error("Failed to copy code.")); } };

    if (isLoadingSurvey) return <div className={styles.loadingContainer}>Loading survey questions...</div>;
    if (surveyError) return <div className={styles.errorContainer}>Error loading survey: {surveyError}</div>;
    if (!survey || !originalQuestions || !collectorSettings) return <div className={styles.errorContainer}>Survey data or settings could not be loaded.</div>;
    
    const progressBarElement = renderProgressBar();
    const displayTitle = survey?.title || initialSurveyTitle || "Survey";
    const manualSaveEnabled = collectorSettings?.allowResume ?? false; 
    const isRecaptchaEnabled = collectorSettings?.enableRecaptcha;
    const isRecaptchaVerified = !!recaptchaToken;
    
    const showPreviousButton = questionDisplayMode === 'onePerPage' && (collectorSettings?.allowBackButton ?? true) && currentVisibleIndex > 0 && orderedVisibleForOnePerPage.length > 0;
    const showNextButton = questionDisplayMode === 'onePerPage' && !isSubmitState && orderedVisibleForOnePerPage.length > 0 && currentVisibleIndex < orderedVisibleForOnePerPage.length -1; // Ensure not on last visible question
    const showSubmitButtonLogic = isSubmitState && ( (questionDisplayMode === 'onePerPage' && currentQuestionToRenderOnePerPage && currentVisibleIndex >= orderedVisibleForOnePerPage.length -1 ) || (questionDisplayMode === 'allOnOnePage' && allVisibleQuestionsToRender.length > 0) || (Object.keys(currentAnswers).length > 0 && dynamicallyVisibleQuestionIds.size === 0 && originalQuestions.length > 0) );

    const progressBarPosition = collectorSettings?.progressBarPosition || 'top';

    return (
        <div className={styles.surveyTakingPageWrapper} onClick={recordUserActivity} onMouseMove={recordUserActivity} onKeyPress={recordUserActivity} >
            <header className={styles.surveyPageHeader}> <h1>{displayTitle}</h1> {survey.description && <p className={styles.surveyDescription}>{survey.description}</p>} </header> 
            {progressBarPosition === 'top' && progressBarElement} 
            {isAutoSaving && <div className={styles.autoSaveIndicator}>Auto-saving...</div>}
            {submissionError && ( <div className={styles.submissionErrorBanner}> <p><strong>Submission Error:</strong> {submissionError}</p> <button onClick={() => setSubmissionError(null)} className={styles.closeErrorButton}>&times;</button> </div> )} 
            {showValidationModal && ( <div className={styles.validationModalBackdrop} onClick={() => setShowValidationModal(false)}> <div className={styles.validationModalContent} onClick={e => e.stopPropagation()}> <h4>Validation Error</h4> <p>{validationModalMessage}</p> <button onClick={() => setShowValidationModal(false)} className={styles.validationModalButton}>OK</button> </div> </div> )} 
            
            <main className={styles.surveyQuestionArea}>
                {questionDisplayMode === 'onePerPage' && currentQuestionToRenderOnePerPage && 
                    renderSingleQuestionInputs(currentQuestionToRenderOnePerPage, currentVisibleIndex) 
                }
                {questionDisplayMode === 'allOnOnePage' && allVisibleQuestionsToRender.length > 0 &&
                    allVisibleQuestionsToRender.map((question, mapIndex) => renderSingleQuestionInputs(question, mapIndex)) 
                }
                { !isLoadingSurvey && !isSubmitting &&
                    ( (questionDisplayMode === 'onePerPage' && !currentQuestionToRenderOnePerPage && orderedVisibleForOnePerPage.length > 0 && currentVisibleIndex >= orderedVisibleForOnePerPage.length) || 
                      (questionDisplayMode === 'allOnOnePage' && allVisibleQuestionsToRender.length === 0 && originalQuestions.length > 0 && dynamicallyVisibleQuestionIds.size === 0 ) || 
                      (dynamicallyVisibleQuestionIds.size === 0 && originalQuestions.length > 0 && !Object.keys(currentAnswers).some(k => currentAnswers[k] !== undefined && currentAnswers[k] !== null && String(currentAnswers[k]).trim() !== '')) // All questions hidden AND no answers
                    ) && !(originalQuestions.length === 0) && // Don't show "Thank you" if there were never any questions
                    <div className={styles.surveyMessageContainer}> 
                        <p className={styles.surveyMessage}>Thank you for your responses!</p> 
                        {(originalQuestions.length > 0 && Object.keys(currentAnswers).length > 0) && <p className={styles.surveyMessage}>Click "Submit" to finalize your survey.</p>} 
                    </div>
                }
                { !isLoadingSurvey && originalQuestions.length === 0 &&
                    <div className={styles.surveyMessageContainer}> <p className={styles.surveyMessage}>This survey currently has no questions.</p> </div>
                }
            </main> 
            
            {progressBarPosition === 'bottom_of_questions' && progressBarElement} 
            {showSubmitButtonLogic && isRecaptchaEnabled && ( <div className={styles.recaptchaContainer}> <ReCAPTCHA ref={recaptchaRef} sitekey={process.env.REACT_APP_RECAPTCHA_SITE_KEY || "YOUR_FALLBACK_RECAPTCHA_V2_SITE_KEY"} onChange={(token) => { setRecaptchaToken(token); setSubmissionError(null); }} onExpired={() => { setRecaptchaToken(null); setSubmissionError("reCAPTCHA has expired."); }} onErrored={() => { setRecaptchaToken(null); setSubmissionError("reCAPTCHA challenge failed."); }} /> </div> )} 
            
            <footer className={styles.surveyNavigation}> 
                {showPreviousButton && (<button type="button" onClick={handlePrevious} disabled={isSubmitting || isSavingAndContinueLater || isAutoSaving} className={styles.navButton}>Previous</button>)} 
                {(!showPreviousButton && questionDisplayMode === 'onePerPage') && <div style={{flexGrow: 1}}></div>} 
                {(questionDisplayMode === 'allOnOnePage' && !manualSaveEnabled && !showSubmitButtonLogic) && <div style={{flexGrow:1}}></div>}
                {(questionDisplayMode === 'allOnOnePage' && (manualSaveEnabled || showSubmitButtonLogic)) && <div style={{flexGrow:1}}></div>}

                {manualSaveEnabled && (<button type="button" onClick={handleSaveAndContinueLater} disabled={isSavingAndContinueLater || isSubmitting || isAutoSaving || !clientSessionId} className={styles.navButtonSecondary}>Save and Continue Later</button>)} 
                
                {showNextButton && (<button type="button" onClick={handleNext} disabled={!currentQuestionToRenderOnePerPage || isSubmitting || isSavingAndContinueLater || isAutoSaving} className={styles.navButtonPrimary}>Next</button>)} 
                
                {showSubmitButtonLogic && (<button type="button" onClick={handleSubmit} disabled={isSubmitting || isSavingAndContinueLater || isAutoSaving || !clientSessionId || (isRecaptchaEnabled && !isRecaptchaVerified)} className={styles.navButtonPrimary} > {isSubmitting ? 'Submitting...' : 'Submit'} </button>)}
            </footer> 
            
            {progressBarPosition === 'bottom' && progressBarElement} 
            {showResumeCodeModal && ( <div className={styles.modalBackdrop}> <div className={styles.modalContentWrapper} onClick={e => e.stopPropagation()}> <h3>{promptForEmailOnSave ? "Save & Continue: Enter Email" : "Resume Later"}</h3> {(promptForEmailOnSave || (generatedResumeCode && (collectorSettings?.saveAndContinueMethod === 'email' || collectorSettings?.saveAndContinueMethod === 'both' || survey?.settings?.behaviorNavigation?.saveAndContinueMethod === 'email' || survey?.settings?.behaviorNavigation?.saveAndContinueMethod === 'both'))) && ( <div style={{marginBottom: '15px'}}> <p>{promptForEmailOnSave ? "Please enter your email address..." : "Optionally, enter your email..."}</p> <input type="email" value={emailForReminder} onChange={(e) => setEmailForReminder(e.target.value)} placeholder="your.email@example.com" className={styles.emailInputForReminder} /> </div> )} {generatedResumeCode && (collectorSettings?.saveAndContinueMethod === 'code' || collectorSettings?.saveAndContinueMethod === 'both' || survey?.settings?.behaviorNavigation?.saveAndContinueMethod === 'code' || survey?.settings?.behaviorNavigation?.saveAndContinueMethod === 'both') && ( <div style={{marginBottom: '15px'}}> <p>Your progress has been saved...</p> <div className={styles.resumeCodeDisplayContainer}> <strong className={styles.resumeCodeDisplay}>{generatedResumeCode}</strong> <button onClick={handleCopyResumeCode} className={styles.copyCodeButton} title="Copy Code"> Copy </button> </div> <hr style={{margin: '15px 0'}} /> </div> )} {!generatedResumeCode && !promptForEmailOnSave && <p>Saving your progress...</p>} <div className={styles.modalActions}> {promptForEmailOnSave ? ( <button onClick={handleModalEmailSubmitAndSave} className={styles.button} disabled={isSavingAndContinueLater || isAutoSaving}> {isSavingAndContinueLater ? "Saving..." : "Save and Send Email"} </button> ) : null } <button onClick={() => { setShowResumeCodeModal(false); setPromptForEmailOnSave(false); setEmailForReminder('');}} className={styles.buttonSecondary} style={{marginLeft: promptForEmailOnSave ? '10px' : '0'}} > Close </button> </div> </div> </div> )} 
        </div>
    );
}
export default SurveyTakingPage;
// ----- END OF COMPLETE MODIFIED FILE (v1.14 - Full Operator Implementation for Conjoint & Refinements) -----