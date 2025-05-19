// frontend/src/pages/SurveyTakingPage.js
// ----- START OF COMPLETE MODIFIED FILE (vNext16.30 - Testing + handleCheckboxChange) -----
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import styles from './SurveyTakingPage.module.css';

// Helper functions
const ensureArray = (value) => (Array.isArray(value) ? value : (value !== undefined && value !== null ? [value] : [])); // Used by handleCheckboxChange
const evaluateSurveyLogic = (logicRules, answers, questions, questionIdToOriginalIndexMap) => { 
    console.log('[Debug STM] evaluateSurveyLogic STUB CALLED'); 
    return null; 
};

function SurveyTakingPage() {
    console.log('[Debug STM] SurveyTakingPage function component body executing. (Top)');
    const { surveyId, collectorId: routeCollectorIdentifier, resumeToken: routeResumeToken } = useParams();
    const location = useLocation();

    // State (from vNext16.29 + dependencies for handleCheckboxChange)
    const [survey, setSurvey] = useState(null); 
    const [originalQuestions, setOriginalQuestions] = useState([]); 
    const [currentAnswers, setCurrentAnswers] = useState({}); // For handleInputChange, handleCheckboxChange
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentCollectorIdentifier, setCurrentCollectorIdentifier] = useState(null);
    const [currentResumeToken, setCurrentResumeToken] = useState(null);
    const [randomizedQuestionOrder, setRandomizedQuestionOrder] = useState([]);
    const [visibleQuestionIndices, setVisibleQuestionIndices] = useState([]);
    const [currentVisibleIndex, setCurrentVisibleIndex] = useState(0);
    const [isDisqualified, setIsDisqualified] = useState(false);
    const [otherInputValues, setOtherInputValues] = useState({}); // For handleCheckboxChange
    const [autoAdvanceState, setAutoAdvanceState] = useState(false); 
    const autoAdvanceTimeoutRef = useRef(null); 

    const NA_VALUE_INTERNAL = '__NA__'; 
    const OTHER_VALUE_INTERNAL = '__OTHER__'; // Used by handleCheckboxChange

    console.log('[Debug STM] Before useMemo hooks.');
    // Active useMemos (simplified for brevity, ensure they are correct from previous versions)
    useMemo(() => { console.log('[Debug STM] questionsById CALC.'); }, [originalQuestions]);
    useMemo(() => { console.log('[Debug STM] questionsInCurrentOrder CALC.'); }, [randomizedQuestionOrder, originalQuestions]);
    useMemo(() => { console.log('[Debug STM] questionIdToOriginalIndexMap CALC.'); }, [originalQuestions]);
    useMemo(() => { console.log('[Debug STM] currentQToRenderMemoized CALC.'); }, [isLoading, survey, visibleQuestionIndices, currentVisibleIndex, originalQuestions]);
    useMemo(() => { console.log('[Debug STM] isSubmitStateDerived CALC.'); }, [isLoading, survey, visibleQuestionIndices, originalQuestions, currentVisibleIndex]);
        
    console.log('[Debug STM] After useMemo hooks, before useEffect hooks.');
    // Active useEffects (simplified for brevity)
    useEffect(() => { console.log(`[Debug STM] useEffect (set CCI) ENTERED.`); }, [location.state?.collectorIdentifier, routeCollectorIdentifier]);
    useEffect(() => { console.log(`[Debug STM] useEffect (set CRT) ENTERED.`); }, [location.state?.resumeToken, routeResumeToken, currentResumeToken]);
    useEffect(() => { console.log(`[Debug STM] useEffect (CustomVars) ENTERED.`); }, [survey, location.search]);
    useEffect(() => { console.log('[Debug STM] useEffect (Manual Loading Control) ENTERED.'); const t = setTimeout(() => { setIsLoading(false); setError("Testing + handleCheckboxChange. Data fetching disabled."); }, 100); return () => clearTimeout(t); }, []);
    useEffect(() => { console.log(`[Debug STM] useEffect (visibleQuestionIndices) ENTERED.`); }, [isLoading, originalQuestions, /* ... */]);
    useEffect(() => { console.log(`[Debug STM] useEffect (CVI boundary check) ENTERED.`); }, [visibleQuestionIndices, /* ... */]);

    console.log('[Debug STM] After useEffect hooks, before useCallback hooks.');

    // ++ Active useCallbacks ++
    const evaluateDisabled = useCallback((qIdx) => { console.log('[Debug STM] evaluateDisabled DEFINITION - Attempting to log.'); return false; }, [originalQuestions]);
    const validateQuestion = useCallback((question, answer) => { console.log('[Debug STM] validateQuestion DEFINITION - Attempting to log.'); return true; }, [otherInputValues, NA_VALUE_INTERNAL, OTHER_VALUE_INTERNAL]);
    const evaluateGlobalLogic = useCallback(() => { console.log('[Debug STM] evaluateGlobalLogic DEFINITION - Attempting to log.'); return null; }, [survey, currentAnswers, originalQuestions, /* map */]); 
    const evaluateActionLogic = useCallback((questionIndex) => { console.log('[Debug STM] evaluateActionLogic DEFINITION - Attempting to log.'); return null; }, [originalQuestions, currentAnswers, /* map */]); 
    const handleNext = useCallback(() => { console.log('[Debug STM] handleNext (ISOLATED STUB) DEFINITION - Attempting to log.'); console.log('CALLED'); }, []); 
    const handleInputChange = useCallback((questionId, value) => { console.log('[Debug STM] handleInputChange DEFINITION - Attempting to log.'); setCurrentAnswers(prev => ({ ...prev, [questionId]: value })); if (autoAdvanceState) { autoAdvanceTimeoutRef.current = setTimeout(handleNext, 500); } }, [autoAdvanceState, handleNext, autoAdvanceTimeoutRef, setCurrentAnswers]);

    // ++ RE-ENABLING handleCheckboxChange ++
    const handleCheckboxChange = useCallback((questionId, optionValue, isChecked) => {
        console.log('[Debug STM] handleCheckboxChange DEFINITION - Attempting to log.');
        console.log(`[Debug STM] handleCheckboxChange CALLED - QID: ${questionId}, Option: ${optionValue}, Checked: ${isChecked}`);
        setCurrentAnswers(prevAnswers => {
            const currentSelection = prevAnswers[questionId] ? [...ensureArray(prevAnswers[questionId])] : [];
            let newSelection;
            if (isChecked) {
                newSelection = [...currentSelection, optionValue];
            } else {
                newSelection = currentSelection.filter(val => val !== optionValue);
            }
            // Logic for OTHER_VALUE_INTERNAL
            if (optionValue === OTHER_VALUE_INTERNAL && !isChecked) {
                setOtherInputValues(prev => ({ ...prev, [`${questionId}_other`]: '' })); // Ensure unique key for other input
                 console.log(`[Debug STM] handleCheckboxChange: Cleared otherInput for ${questionId}`);
            }
            return { ...prevAnswers, [questionId]: newSelection };
        });
    }, [OTHER_VALUE_INTERNAL, setCurrentAnswers, setOtherInputValues]); // Dependencies

    // ALL OTHER useCallback hooks are commented out

    console.log('[Debug STM] After useCallback hooks, before main render logic.');
    
    console.log(`[Debug STM] Render: Top of render logic. surveyId=${surveyId}, isLoading=${isLoading}, error=${error}`);
    
    if (isLoading) { return <div>Loading...</div> }
    if (error) { 
        return (
            <div className={styles.errorContainer}>
                <h2>Test Information (Testing + handleCheckboxChange)</h2>
                <p>{error}</p>
                <button onClick={() => handleInputChange('input_qid', 'input_val')}>Test InputChange</button> 
                <button onClick={() => handleCheckboxChange('chk_qid', 'option1', true)}>Test ChkChange (Opt1 True)</button>
                <button onClick={() => handleCheckboxChange('chk_qid', 'option1', false)}>Test ChkChange (Opt1 False)</button>
                <button onClick={() => handleCheckboxChange('chk_qid', OTHER_VALUE_INTERNAL, true)}>Test ChkChange (Other True)</button>
                <button onClick={() => handleCheckboxChange('chk_qid', OTHER_VALUE_INTERNAL, false)}>Test ChkChange (Other False)</button>
                <p>Current Answers: {JSON.stringify(currentAnswers)}</p>
                <p>Other Inputs: {JSON.stringify(otherInputValues)}</p>
            </div>
        );
    }
    
    return (
        <div className={styles.surveyContainer}>
            <h1>Survey Taking Page (Testing + handleCheckboxChange)</h1>
            <button onClick={() => handleInputChange('input_qid', 'input_val')}>Test InputChange</button> 
            <button onClick={() => handleCheckboxChange('chk_qid', 'option1', true)}>Test ChkChange (Opt1 True)</button>
            <button onClick={() => handleCheckboxChange('chk_qid', 'option1', false)}>Test ChkChange (Opt1 False)</button>
            <button onClick={() => handleCheckboxChange('chk_qid', OTHER_VALUE_INTERNAL, true)}>Test ChkChange (Other True)</button>
            <button onClick={() => handleCheckboxChange('chk_qid', OTHER_VALUE_INTERNAL, false)}>Test ChkChange (Other False)</button>
            <p>Current Answers: {JSON.stringify(currentAnswers)}</p>
            <p>Other Inputs: {JSON.stringify(otherInputValues)}</p>
        </div>
    );
}
export default SurveyTakingPage;
// ----- END OF COMPLETE MODIFIED FILE (vNext16.30 - Testing + handleCheckboxChange) -----