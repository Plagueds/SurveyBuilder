// frontend/src/pages/SurveyTakingPage.js
// ----- START OF COMPLETE MODIFIED FILE (vNext16.24 - Testing evaluateDisabled + validateQuestion) -----
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
// import { toast } from 'react-toastify'; // Not used in this specific test
import styles from './SurveyTakingPage.module.css';

// Helper functions
const ensureArray = (value) => (Array.isArray(value) ? value : (value !== undefined && value !== null ? [value] : []));
const isAnswerEmpty = (value, questionType) => { if (value === null || value === undefined) return true; if (typeof value === 'string' && value.trim() === '') return true; if (Array.isArray(value) && value.length === 0) return true; /* ... other types ... */ return false; };

function SurveyTakingPage() {
    console.log('[Debug STM] SurveyTakingPage function component body executing. (Top)');
    const { surveyId, collectorId: routeCollectorIdentifier, resumeToken: routeResumeToken } = useParams();
    const location = useLocation();

    console.log(`[Debug STM] useParams results: surveyId=${surveyId}, routeCollectorIdentifier=${routeCollectorIdentifier}, routeResumeToken=${routeResumeToken}`);

    // State (from vNext16.23)
    const [survey, setSurvey] = useState(null); 
    const [originalQuestions, setOriginalQuestions] = useState([]); 
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentCollectorIdentifier, setCurrentCollectorIdentifier] = useState(null);
    const [currentResumeToken, setCurrentResumeToken] = useState(null);
    const [randomizedQuestionOrder, setRandomizedQuestionOrder] = useState([]);
    const [visibleQuestionIndices, setVisibleQuestionIndices] = useState([]);
    const [currentVisibleIndex, setCurrentVisibleIndex] = useState(0);
    const [isDisqualified, setIsDisqualified] = useState(false);
    const [otherInputValues, setOtherInputValues] = useState({}); // Dependency for validateQuestion

    const NA_VALUE_INTERNAL = '__NA__'; 
    const OTHER_VALUE_INTERNAL = '__OTHER__';

    console.log('[Debug STM] Before useMemo hooks.');

    // Active useMemos (from vNext16.23)
    const questionsById = useMemo(() => { console.log('[Debug STM] questionsById CALC.'); return originalQuestions.reduce((map, q) => { if(q && q._id) map[q._id] = q; return map; }, {}); }, [originalQuestions]);
    const questionsInCurrentOrder = useMemo(() => { console.log('[Debug STM] questionsInCurrentOrder CALC.'); return (randomizedQuestionOrder.length > 0 && originalQuestions.length > 0) ? randomizedQuestionOrder.map(index => originalQuestions[index]).filter(q => q) : originalQuestions.filter(q => q); }, [randomizedQuestionOrder, originalQuestions]);
    const questionIdToOriginalIndexMap = useMemo(() => { console.log('[Debug STM] questionIdToOriginalIndexMap CALC.'); return originalQuestions.reduce((map, q, index) => { if(q && q._id) map[q._id] = index; return map; }, {}); }, [originalQuestions]);
    const currentQToRenderMemoized = useMemo(() => { console.log('[Debug STM] currentQToRenderMemoized CALC.'); return null; }, [isLoading, survey, visibleQuestionIndices, currentVisibleIndex, originalQuestions]);
    const isSubmitStateDerived = useMemo(() => { console.log('[Debug STM] isSubmitStateDerived CALC.'); return false; }, [isLoading, survey, visibleQuestionIndices, originalQuestions, currentVisibleIndex]);
        
    console.log('[Debug STM] After useMemo hooks, before useEffect hooks.');

    // Active useEffects (from vNext16.23)
    useEffect(() => { console.log(`[Debug STM] useEffect (set CCI) ENTERED.`); setCurrentCollectorIdentifier(location.state?.collectorIdentifier || routeCollectorIdentifier); }, [location.state?.collectorIdentifier, routeCollectorIdentifier]);
    useEffect(() => { console.log(`[Debug STM] useEffect (set CRT) ENTERED.`); /* ... */ }, [location.state?.resumeToken, routeResumeToken, currentResumeToken]);
    useEffect(() => { console.log(`[Debug STM] useEffect (CustomVars) ENTERED.`); /* ... */ }, [survey, location.search]);
    useEffect(() => { console.log('[Debug STM] useEffect (Manual Loading Control) ENTERED.'); const t = setTimeout(() => { setIsLoading(false); setError("Testing evaluateDisabled + validateQuestion. Data fetching disabled."); }, 100); return () => clearTimeout(t); }, []);
    useEffect(() => { console.log(`[Debug STM] useEffect (visibleQuestionIndices) ENTERED.`); /* ... */ }, [isLoading, originalQuestions, questionsInCurrentOrder, /*hiddenQuestionIds,*/ questionIdToOriginalIndexMap, randomizedQuestionOrder, visibleQuestionIndices]);
    useEffect(() => { console.log(`[Debug STM] useEffect (CVI boundary check) ENTERED.`); /* ... */ }, [visibleQuestionIndices, isLoading, survey, isDisqualified, currentVisibleIndex, originalQuestions.length]);

    console.log('[Debug STM] After useEffect hooks, before useCallback hooks.');

    // ++ TESTING: evaluateDisabled + validateQuestion active ++
    const evaluateDisabled = useCallback((qIdx) => { 
        console.log('[Debug STM] evaluateDisabled DEFINITION - Attempting to log.'); 
        if (!originalQuestions) { console.log('[Debug STM] evaluateDisabled: originalQuestions is falsy.'); return true; }
        console.log(`[Debug STM] evaluateDisabled: qIdx=${qIdx}, originalQuestions.length=${originalQuestions.length}`);
        if (qIdx < 0 || qIdx >= originalQuestions.length) { console.log('[Debug STM] evaluateDisabled: qIdx out of bounds.'); return false; }
        const question = originalQuestions[qIdx];
        const isDisabled = question ? question.isDisabled === true : false;
        console.log(`[Debug STM] evaluateDisabled: question found, isDisabled=${isDisabled}`);
        return isDisabled;
    }, [originalQuestions]);

    // ++ RE-ENABLING validateQuestion ++
    const validateQuestion = useCallback((question, answer, isSoftValidation = false, isDisqualificationCheck = false) => { 
        console.log('[Debug STM] validateQuestion DEFINITION - Attempting to log.'); 
        if (!question) {
            console.log('[Debug STM] validateQuestion: No question provided.');
            return true; // Or handle as an error/false depending on desired behavior
        }
        console.log(`[Debug STM] validateQuestion: Validating Q: ${question._id || 'ID_UNKNOWN'}, Required: ${question.required}, Answer Empty: ${isAnswerEmpty(answer, question.type)}`);
        if (question.required && !isSoftValidation && !isDisqualificationCheck) { 
            if (isAnswerEmpty(answer, question.type)) { 
                console.error(`VALIDATION ERROR: Question "${question.text || question._id}" is required.`);
                return false; 
            } 
        } 
        console.log(`[Debug STM] validateQuestion: Validation passed for Q: ${question._id || 'ID_UNKNOWN'}`);
        return true; 
    }, [otherInputValues, NA_VALUE_INTERNAL, OTHER_VALUE_INTERNAL]); // Dependencies are otherInputValues, NA_VALUE_INTERNAL, OTHER_VALUE_INTERNAL

    // ALL OTHER useCallback hooks are commented out
    // const evaluateGlobalLogic = useCallback(() => { /* ... */ }, [/* ... */]);
    // ... and so on

    console.log('[Debug STM] After useCallback hooks, before main render logic.');
    
    const testDisabledValue = evaluateDisabled(0);
    // Test invocation for validateQuestion (using a mock question object for definition test)
    const mockQuestionForValidation = { _id: 'q_mock', text: 'Mock Question', required: true, type: 'shorttext' };
    const testValidationValue = validateQuestion(mockQuestionForValidation, ''); // Test with an empty answer to check required logic

    console.log(`[Debug STM] Test invocation of evaluateDisabled(0) in render body: ${testDisabledValue}`);
    console.log(`[Debug STM] Test invocation of validateQuestion(mock, '') in render body: ${testValidationValue}`);

    console.log(`[Debug STM] Render: Top of render logic. surveyId=${surveyId}, isLoading=${isLoading}, error=${error}`);
    
    if (isLoading) { /* ... */ }
    if (error) { /* ... */ }
    
    return (
        <div className={styles.surveyContainer}>
            <h1>Survey Taking Page (Testing evaluateDisabled + validateQuestion)</h1>
            <p>Survey ID: {surveyId}</p>
            <p>isLoading: {isLoading.toString()}</p>
            <p>Error: {error || "No error"}</p>
            <p>Test evaluateDisabled(0): {testDisabledValue.toString()}</p>
            <p>Test validateQuestion(mock, ''): {testValidationValue.toString()}</p>
        </div>
    );
}
export default SurveyTakingPage;
// ----- END OF COMPLETE MODIFIED FILE (vNext16.24 - Testing evaluateDisabled + validateQuestion) -----