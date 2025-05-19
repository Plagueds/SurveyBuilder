// frontend/src/pages/SurveyTakingPage.js
// ----- START OF COMPLETE MODIFIED FILE (vNext16.26 - Testing + evaluateActionLogic) -----
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
// import { toast } from 'react-toastify';
import styles from './SurveyTakingPage.module.css';

// Helper functions
const ensureArray = (value) => (Array.isArray(value) ? value : (value !== undefined && value !== null ? [value] : []));
const isAnswerEmpty = (value, questionType) => { if (value === null || value === undefined) return true; if (typeof value === 'string' && value.trim() === '') return true; if (Array.isArray(value) && value.length === 0) return true; return false; };
const evaluateSurveyLogic = (logicRules, answers, questions, questionIdToOriginalIndexMap) => { 
    console.log('[Debug STM] evaluateSurveyLogic STUB CALLED'); 
    return null; 
};


function SurveyTakingPage() {
    console.log('[Debug STM] SurveyTakingPage function component body executing. (Top)');
    const { surveyId, collectorId: routeCollectorIdentifier, resumeToken: routeResumeToken } = useParams();
    const location = useLocation();

    console.log(`[Debug STM] useParams results: surveyId=${surveyId}, routeCollectorIdentifier=${routeCollectorIdentifier}, routeResumeToken=${routeResumeToken}`);

    // State (from vNext16.25)
    const [survey, setSurvey] = useState(null); 
    const [originalQuestions, setOriginalQuestions] = useState([]); // Dependency for evaluateActionLogic
    const [currentAnswers, setCurrentAnswers] = useState({}); // Dependency for evaluateActionLogic
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentCollectorIdentifier, setCurrentCollectorIdentifier] = useState(null);
    const [currentResumeToken, setCurrentResumeToken] = useState(null);
    const [randomizedQuestionOrder, setRandomizedQuestionOrder] = useState([]);
    const [visibleQuestionIndices, setVisibleQuestionIndices] = useState([]);
    const [currentVisibleIndex, setCurrentVisibleIndex] = useState(0);
    const [isDisqualified, setIsDisqualified] = useState(false);
    const [otherInputValues, setOtherInputValues] = useState({});

    const NA_VALUE_INTERNAL = '__NA__'; 
    const OTHER_VALUE_INTERNAL = '__OTHER__';

    console.log('[Debug STM] Before useMemo hooks.');

    // Active useMemos (from vNext16.25)
    const questionsById = useMemo(() => { console.log('[Debug STM] questionsById CALC.'); return originalQuestions.reduce((map, q) => { if(q && q._id) map[q._id] = q; return map; }, {}); }, [originalQuestions]);
    const questionsInCurrentOrder = useMemo(() => { console.log('[Debug STM] questionsInCurrentOrder CALC.'); return (randomizedQuestionOrder.length > 0 && originalQuestions.length > 0) ? randomizedQuestionOrder.map(index => originalQuestions[index]).filter(q => q) : originalQuestions.filter(q => q); }, [randomizedQuestionOrder, originalQuestions]);
    const questionIdToOriginalIndexMap = useMemo(() => { console.log('[Debug STM] questionIdToOriginalIndexMap CALC.'); return originalQuestions.reduce((map, q, index) => { if(q && q._id) map[q._id] = index; return map; }, {}); }, [originalQuestions]); // Dependency for evaluateActionLogic
    const currentQToRenderMemoized = useMemo(() => { console.log('[Debug STM] currentQToRenderMemoized CALC.'); return null; }, [isLoading, survey, visibleQuestionIndices, currentVisibleIndex, originalQuestions]);
    const isSubmitStateDerived = useMemo(() => { console.log('[Debug STM] isSubmitStateDerived CALC.'); return false; }, [isLoading, survey, visibleQuestionIndices, originalQuestions, currentVisibleIndex]);
        
    console.log('[Debug STM] After useMemo hooks, before useEffect hooks.');

    // Active useEffects (from vNext16.25)
    useEffect(() => { console.log(`[Debug STM] useEffect (set CCI) ENTERED.`); setCurrentCollectorIdentifier(location.state?.collectorIdentifier || routeCollectorIdentifier); }, [location.state?.collectorIdentifier, routeCollectorIdentifier]);
    useEffect(() => { console.log(`[Debug STM] useEffect (set CRT) ENTERED.`); /* ... */ }, [location.state?.resumeToken, routeResumeToken, currentResumeToken]);
    useEffect(() => { console.log(`[Debug STM] useEffect (CustomVars) ENTERED.`); /* ... */ }, [survey, location.search]);
    useEffect(() => { console.log('[Debug STM] useEffect (Manual Loading Control) ENTERED.'); const t = setTimeout(() => { setIsLoading(false); setError("Testing + evaluateActionLogic. Data fetching disabled."); }, 100); return () => clearTimeout(t); }, []);
    useEffect(() => { console.log(`[Debug STM] useEffect (visibleQuestionIndices) ENTERED.`); /* ... */ }, [isLoading, originalQuestions, questionsInCurrentOrder, /*hiddenQuestionIds,*/ questionIdToOriginalIndexMap, randomizedQuestionOrder, visibleQuestionIndices]);
    useEffect(() => { console.log(`[Debug STM] useEffect (CVI boundary check) ENTERED.`); /* ... */ }, [visibleQuestionIndices, isLoading, survey, isDisqualified, currentVisibleIndex, originalQuestions.length]);

    console.log('[Debug STM] After useEffect hooks, before useCallback hooks.');

    // ++ Active useCallbacks: evaluateDisabled, validateQuestion, evaluateGlobalLogic, evaluateActionLogic ++
    const evaluateDisabled = useCallback((qIdx) => { console.log('[Debug STM] evaluateDisabled DEFINITION - Attempting to log.'); return false; }, [originalQuestions]);
    const validateQuestion = useCallback((question, answer, isSoftValidation = false, isDisqualificationCheck = false) => { console.log('[Debug STM] validateQuestion DEFINITION - Attempting to log.'); return true; }, [otherInputValues, NA_VALUE_INTERNAL, OTHER_VALUE_INTERNAL]);
    const evaluateGlobalLogic = useCallback(() => { console.log('[Debug STM] evaluateGlobalLogic DEFINITION - Attempting to log.'); if (!survey || !survey.globalSkipLogic) return null; return evaluateSurveyLogic(survey.globalSkipLogic, currentAnswers, originalQuestions, questionIdToOriginalIndexMap); }, [survey, currentAnswers, originalQuestions, questionIdToOriginalIndexMap]); 

    // ++ RE-ENABLING evaluateActionLogic ++
    const evaluateActionLogic = useCallback((questionIndex) => { 
        console.log('[Debug STM] evaluateActionLogic DEFINITION - Attempting to log.'); 
        if (questionIndex === undefined || questionIndex < 0 || questionIndex >= originalQuestions.length) {
            console.log('[Debug STM] evaluateActionLogic: Invalid questionIndex or originalQuestions not ready.');
            return null;
        }
        const question = originalQuestions[questionIndex]; 
        if (!question || !question.skipLogic || !Array.isArray(question.skipLogic.rules) || question.skipLogic.rules.length === 0) { 
            console.log('[Debug STM] evaluateActionLogic: No question or no skip logic rules for the question.');
            return null; 
        } 
        console.log('[Debug STM] evaluateActionLogic: Calling evaluateSurveyLogic helper for Q_Index:', questionIndex);
        return evaluateSurveyLogic(question.skipLogic.rules, currentAnswers, originalQuestions, questionIdToOriginalIndexMap); 
    }, [originalQuestions, currentAnswers, questionIdToOriginalIndexMap]); // Dependencies

    // ALL OTHER useCallback hooks are commented out
    // const handleInputChange = useCallback((questionId, value) => { /* ... */ }, [/* ... */]);
    // ... and so on

    console.log('[Debug STM] After useCallback hooks, before main render logic.');
    
    const testDisabledValue = evaluateDisabled(0);
    const mockQuestionForValidation = { _id: 'q_mock', text: 'Mock Question', required: true, type: 'shorttext' };
    const testValidationValue = validateQuestion(mockQuestionForValidation, '');
    const testGlobalLogicValue = evaluateGlobalLogic();
    const testActionLogicValue = evaluateActionLogic(0); // Test invocation (will use index 0)

    console.log(`[Debug STM] Test invocation of evaluateDisabled(0): ${testDisabledValue}`);
    console.log(`[Debug STM] Test invocation of validateQuestion(mock, ''): ${testValidationValue}`);
    console.log(`[Debug STM] Test invocation of evaluateGlobalLogic(): ${testGlobalLogicValue === null ? "null" : testGlobalLogicValue}`);
    console.log(`[Debug STM] Test invocation of evaluateActionLogic(0): ${testActionLogicValue === null ? "null" : testActionLogicValue}`);


    console.log(`[Debug STM] Render: Top of render logic. surveyId=${surveyId}, isLoading=${isLoading}, error=${error}`);
    
    if (isLoading) { /* ... */ }
    if (error) { /* ... */ }
    
    return (
        <div className={styles.surveyContainer}>
            <h1>Survey Taking Page (Testing + evaluateActionLogic)</h1>
            {/* ... JSX to display test values ... */}
            <p>Test evaluateDisabled(0): {testDisabledValue.toString()}</p>
            <p>Test validateQuestion(mock, ''): {testValidationValue.toString()}</p>
            <p>Test evaluateGlobalLogic(): {testGlobalLogicValue === null ? "null" : testGlobalLogicValue}</p>
            <p>Test evaluateActionLogic(0): {testActionLogicValue === null ? "null" : testActionLogicValue}</p>
        </div>
    );
}
export default SurveyTakingPage;
// ----- END OF COMPLETE MODIFIED FILE (vNext16.26 - Testing + evaluateActionLogic) -----