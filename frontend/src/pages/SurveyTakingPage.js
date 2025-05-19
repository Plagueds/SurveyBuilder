// frontend/src/pages/SurveyTakingPage.js
// ----- START OF COMPLETE MODIFIED FILE (vNext16.23 - Focused test on one simple useCallback) -----
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
// import { toast } from 'react-toastify'; // Not used
import styles from './SurveyTakingPage.module.css';

// Helper functions (Minimal, only if absolutely needed by the single active useCallback)
// const ensureArray = (value) => (Array.isArray(value) ? value : (value !== undefined && value !== null ? [value] : []));
// const isAnswerEmpty = (value, questionType) => { /* ... */ return false; };


function SurveyTakingPage() {
    console.log('[Debug STM] SurveyTakingPage function component body executing. (Top)');
    const { surveyId, collectorId: routeCollectorIdentifier, resumeToken: routeResumeToken } = useParams();
    const location = useLocation();

    console.log(`[Debug STM] useParams results: surveyId=${surveyId}, routeCollectorIdentifier=${routeCollectorIdentifier}, routeResumeToken=${routeResumeToken}`);

    // State (Minimal set for active hooks)
    const [survey, setSurvey] = useState(null); 
    const [originalQuestions, setOriginalQuestions] = useState([]); // Dependency for evaluateDisabled
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentCollectorIdentifier, setCurrentCollectorIdentifier] = useState(null);
    const [currentResumeToken, setCurrentResumeToken] = useState(null);
    const [randomizedQuestionOrder, setRandomizedQuestionOrder] = useState([]);
    const [visibleQuestionIndices, setVisibleQuestionIndices] = useState([]);
    const [currentVisibleIndex, setCurrentVisibleIndex] = useState(0);
    const [isDisqualified, setIsDisqualified] = useState(false);
    // const [otherInputValues, setOtherInputValues] = useState({}); 

    console.log('[Debug STM] Before useMemo hooks.');

    // Active useMemos (ensure their logs are still in place)
    const questionsById = useMemo(() => { console.log('[Debug STM] questionsById CALC.'); return originalQuestions.reduce((map, q) => { if(q && q._id) map[q._id] = q; return map; }, {}); }, [originalQuestions]);
    const questionsInCurrentOrder = useMemo(() => { console.log('[Debug STM] questionsInCurrentOrder CALC.'); return (randomizedQuestionOrder.length > 0 && originalQuestions.length > 0) ? randomizedQuestionOrder.map(index => originalQuestions[index]).filter(q => q) : originalQuestions.filter(q => q); }, [randomizedQuestionOrder, originalQuestions]);
    const questionIdToOriginalIndexMap = useMemo(() => { console.log('[Debug STM] questionIdToOriginalIndexMap CALC.'); return originalQuestions.reduce((map, q, index) => { if(q && q._id) map[q._id] = index; return map; }, {}); }, [originalQuestions]);
    const currentQToRenderMemoized = useMemo(() => { console.log('[Debug STM] currentQToRenderMemoized CALC.'); return null; }, [isLoading, survey, visibleQuestionIndices, currentVisibleIndex, originalQuestions]);
    const isSubmitStateDerived = useMemo(() => { console.log('[Debug STM] isSubmitStateDerived CALC.'); return false; }, [isLoading, survey, visibleQuestionIndices, originalQuestions, currentVisibleIndex]);
        
    console.log('[Debug STM] After useMemo hooks, before useEffect hooks.');

    // Active useEffects (ensure their logs are still in place)
    useEffect(() => { console.log(`[Debug STM] useEffect (set CCI) ENTERED.`); setCurrentCollectorIdentifier(location.state?.collectorIdentifier || routeCollectorIdentifier); }, [location.state?.collectorIdentifier, routeCollectorIdentifier]);
    useEffect(() => { console.log(`[Debug STM] useEffect (set CRT) ENTERED.`); /* ... */ }, [location.state?.resumeToken, routeResumeToken, currentResumeToken]);
    useEffect(() => { console.log(`[Debug STM] useEffect (CustomVars) ENTERED.`); /* ... */ }, [survey, location.search]);
    useEffect(() => { console.log('[Debug STM] useEffect (Manual Loading Control) ENTERED.'); const t = setTimeout(() => { setIsLoading(false); setError("Focused useCallback test. Data fetching disabled."); }, 100); return () => clearTimeout(t); }, []);
    useEffect(() => { console.log(`[Debug STM] useEffect (visibleQuestionIndices) ENTERED.`); /* ... */ }, [isLoading, originalQuestions, questionsInCurrentOrder, /*hiddenQuestionIds,*/ questionIdToOriginalIndexMap, randomizedQuestionOrder, visibleQuestionIndices]);
    useEffect(() => { console.log(`[Debug STM] useEffect (CVI boundary check) ENTERED.`); /* ... */ }, [visibleQuestionIndices, isLoading, survey, isDisqualified, currentVisibleIndex, originalQuestions.length]);

    console.log('[Debug STM] After useEffect hooks, before useCallback hooks.');

    // ++ FOCUSED TEST: Only evaluateDisabled useCallback active, simplified ++
    const evaluateDisabled = useCallback((qIdx) => { 
        console.log('[Debug STM] evaluateDisabled DEFINITION - Attempting to log.'); 
        // Extremely simplified logic for testing definition
        if (!originalQuestions) {
            console.log('[Debug STM] evaluateDisabled: originalQuestions is falsy.');
            return true; // Default to disabled if something is wrong
        }
        console.log(`[Debug STM] evaluateDisabled: qIdx=${qIdx}, originalQuestions.length=${originalQuestions.length}`);
        if (qIdx < 0 || qIdx >= originalQuestions.length) {
            console.log('[Debug STM] evaluateDisabled: qIdx out of bounds.');
            return false; // Not disabled if index is invalid (or handle as error)
        }
        const question = originalQuestions[qIdx];
        const isDisabled = question ? question.isDisabled === true : false;
        console.log(`[Debug STM] evaluateDisabled: question found, isDisabled=${isDisabled}`);
        return isDisabled;
    }, [originalQuestions]); // Dependency is originalQuestions

    // ALL OTHER useCallback hooks are commented out
    // const validateQuestion = useCallback((question, answer, isSoftValidation = false, isDisqualificationCheck = false) => { /* ... */ }, [/* ... */]);
    // ... and so on for all others

    // fetchSurvey, renderQuestion, handleSubmit remain commented out

    console.log('[Debug STM] After useCallback hooks, before main render logic.');
    
    // Test invocation of evaluateDisabled (will likely use initial empty originalQuestions)
    const testDisabledValue = evaluateDisabled(0);
    console.log(`[Debug STM] Test invocation of evaluateDisabled(0) in render body: ${testDisabledValue}`);

    console.log(`[Debug STM] Render: Top of render logic. surveyId=${surveyId}, isLoading=${isLoading}, error=${error}`);
    
    if (isLoading) { 
        console.log(`[Debug STM] Render: isLoading is true.`);
        return <div className={styles.loading}>Loading (Focused useCallback test)...</div>; 
    }
    if (error) { 
        console.log(`[Debug STM] Render: Error display: ${error}`);
        return (
            <div className={styles.errorContainer}>
                <h2>Test Information (Focused useCallback test)</h2>
                <p>{error}</p>
                <p>evaluateDisabled(0) result: {testDisabledValue.toString()}</p>
            </div>
        );
    }
    
    console.log('[Debug STM] FINAL RENDER PREP (Simplified - Focused useCallback test)');
    console.log('[Debug STM] Before main return statement (JSX - Simplified).');

    return (
        <div className={styles.surveyContainer}>
            <h1>Survey Taking Page (Focused useCallback test)</h1>
            <p>Survey ID: {surveyId}</p>
            <p>isLoading: {isLoading.toString()}</p>
            <p>Error: {error || "No error"}</p>
            <p>Test evaluateDisabled(0): {testDisabledValue.toString()}</p>
        </div>
    );
}
export default SurveyTakingPage;
// ----- END OF COMPLETE MODIFIED FILE (vNext16.23 - Focused test on one simple useCallback) -----