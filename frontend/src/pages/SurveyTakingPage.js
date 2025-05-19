// frontend/src/pages/SurveyTakingPage.js
// ----- START OF COMPLETE MODIFIED FILE (vNext16.34 - Full handleCheckboxChange + handleOtherInputChange) -----
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import styles from './SurveyTakingPage.module.css';

// Helper functions
const ensureArray = (value) => (Array.isArray(value) ? value : (value !== undefined && value !== null ? [value] : [])); 
const evaluateSurveyLogic = (logicRules, answers, questions, questionIdToOriginalIndexMap) => { 
    console.log('[Debug STM] evaluateSurveyLogic STUB CALLED'); 
    return null; 
};

function SurveyTakingPage() {
    console.log('[Debug STM] SurveyTakingPage function component body executing. (Top)');
    const { surveyId } = useParams(); 
    const location = useLocation();

    const [survey, setSurvey] = useState(null); 
    const [originalQuestions, setOriginalQuestions] = useState([]); 
    const [currentAnswers, setCurrentAnswers] = useState({}); 
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [otherInputValues, setOtherInputValues] = useState({}); 
    const [autoAdvanceState, setAutoAdvanceState] = useState(false); 
    const autoAdvanceTimeoutRef = useRef(null); 
    
    const NA_VALUE_INTERNAL = '__NA__'; 
    const OTHER_VALUE_INTERNAL = '__OTHER__';

    // --- useMemo hooks (as in vNext16.30) ---
    useMemo(() => { console.log('[Debug STM] questionsById CALC.'); }, [originalQuestions]);
    useMemo(() => { console.log('[Debug STM] questionsInCurrentOrder CALC.'); }, [/*deps*/]);
    useMemo(() => { console.log('[Debug STM] questionIdToOriginalIndexMap CALC.'); }, [originalQuestions]);
    useMemo(() => { console.log('[Debug STM] currentQToRenderMemoized CALC.'); }, [/*deps*/]);
    useMemo(() => { console.log('[Debug STM] isSubmitStateDerived CALC.'); }, [/*deps*/]);
        
    console.log('[Debug STM] After useMemo hooks, before useEffect hooks.');
    // --- useEffect hooks (as in vNext16.30) ---
    useEffect(() => { console.log('[Debug STM] useEffect (Manual Loading Control) ENTERED.'); const t = setTimeout(() => { setIsLoading(false); setError("Testing Full Chk + OtherInputChange. Data fetching disabled."); }, 100); return () => clearTimeout(t); }, []);
    // ... other useEffects ...

    console.log('[Debug STM] After useEffect hooks, before useCallback hooks.');

    // --- useCallback hooks ---
    const evaluateDisabled = useCallback((qIdx) => { console.log('[Debug STM] evaluateDisabled DEFINITION - Attempting to log.'); return false; }, [originalQuestions]);
    const validateQuestion = useCallback((question, answer) => { console.log('[Debug STM] validateQuestion DEFINITION - Attempting to log.'); return true; }, [otherInputValues, NA_VALUE_INTERNAL, OTHER_VALUE_INTERNAL]);
    const evaluateGlobalLogic = useCallback(() => { console.log('[Debug STM] evaluateGlobalLogic DEFINITION - Attempting to log.'); return null; }, [survey, currentAnswers, originalQuestions, /* map */]); 
    const evaluateActionLogic = useCallback((questionIndex) => { console.log('[Debug STM] evaluateActionLogic DEFINITION - Attempting to log.'); return null; }, [originalQuestions, currentAnswers, /* map */]); 
    
    const handleNext = useCallback(() => { console.log('[Debug STM] handleNext (STUB) DEFINITION - Attempting to log.'); console.log('handleNext CALLED'); }, []); 
    
    const handleInputChange = useCallback((questionId, value) => { 
        console.log('[Debug STM] handleInputChange DEFINITION - Attempting to log.'); 
        console.log(`[Debug STM] handleInputChange CALLED - QID: ${questionId}`);
        setCurrentAnswers(prev => ({ ...prev, [questionId]: value })); 
        // autoAdvance logic
    }, [autoAdvanceState, handleNext, autoAdvanceTimeoutRef, setCurrentAnswers]);

    // ++ RESTORING FULL handleCheckboxChange (from vNext16.30) ++
    const handleCheckboxChange = useCallback((questionId, optionValue, isChecked) => {
        console.log('[Debug STM] handleCheckboxChange (FULL) DEFINITION - Attempting to log.');
        console.log(`[Debug STM] handleCheckboxChange (FULL) CALLED - QID: ${questionId}, Option: ${optionValue}, Checked: ${isChecked}`);
        setCurrentAnswers(prevAnswers => {
            const currentSelection = prevAnswers[questionId] ? [...ensureArray(prevAnswers[questionId])] : [];
            let newSelection;
            if (isChecked) {
                newSelection = [...currentSelection, optionValue];
            } else {
                newSelection = currentSelection.filter(val => val !== optionValue);
            }
            if (optionValue === OTHER_VALUE_INTERNAL && !isChecked) {
                setOtherInputValues(prev => ({ ...prev, [`${questionId}_other`]: '' }));
            }
            return { ...prevAnswers, [questionId]: newSelection };
        });
    }, [OTHER_VALUE_INTERNAL, setCurrentAnswers, setOtherInputValues]);

    // ++ ADDING handleOtherInputChange ++
    const handleOtherInputChange = useCallback((questionId, value) => {
        console.log('[Debug STM] handleOtherInputChange DEFINITION - Attempting to log.');
        console.log(`[Debug STM] handleOtherInputChange CALLED - QID: ${questionId}, Value: ${value}`);
        setOtherInputValues(prev => ({ ...prev, [questionId]: value })); // Note: original used questionId_other, simplified here for test
        
        // If the "Other" option is not selected in the main checkbox group, but text is entered, select "Other"
        const mainCheckboxValue = currentAnswers[questionId.replace('_other', '')]; // Assuming qid_other convention
        const mainQid = questionId.replace('_other', '');

        if (value && (!mainCheckboxValue || !ensureArray(mainCheckboxValue).includes(OTHER_VALUE_INTERNAL))) {
            console.log(`[Debug STM] handleOtherInputChange: Auto-selecting OTHER for ${mainQid}`);
            setCurrentAnswers(prevAnswers => {
                const currentSelection = prevAnswers[mainQid] ? [...ensureArray(prevAnswers[mainQid])] : [];
                if (!currentSelection.includes(OTHER_VALUE_INTERNAL)) {
                    return { ...prevAnswers, [mainQid]: [...currentSelection, OTHER_VALUE_INTERNAL] };
                }
                return prevAnswers;
            });
        }
    }, [OTHER_VALUE_INTERNAL, currentAnswers, setCurrentAnswers, setOtherInputValues]);


    console.log('[Debug STM] After useCallback hooks, before main render logic.');
    
    console.log(`[Debug STM] Render: Top of render logic. isLoading=${isLoading}, error=${error}`);
    
    if (isLoading) { return <div>Loading...</div> }
    if (error) { 
        return (
            <div className={styles.errorContainer}>
                <h2>Test Information (Full Chk + OtherInputChange)</h2>
                <p>{error}</p>
                <button onClick={() => handleCheckboxChange('chk_qid', 'opt1', true)}>Test Chk (Opt1 True)</button>
                <button onClick={() => handleCheckboxChange('chk_qid', OTHER_VALUE_INTERNAL, true)}>Test Chk (Other True)</button>
                <input type="text" placeholder="Other for chk_qid" onChange={(e) => handleOtherInputChange('chk_qid_other', e.target.value)} />
                <p>Current Answers: {JSON.stringify(currentAnswers)}</p>
                <p>Other Inputs: {JSON.stringify(otherInputValues)}</p>
            </div>
        );
    }
    
    return (
        <div className={styles.surveyContainer}>
            {/* ... similar test UI ... */}
            <button onClick={() => handleCheckboxChange('chk_qid', 'opt1', true)}>Test Chk (Opt1 True)</button>
            <button onClick={() => handleCheckboxChange('chk_qid', OTHER_VALUE_INTERNAL, true)}>Test Chk (Other True)</button>
            <input type="text" placeholder="Other for chk_qid" onChange={(e) => handleOtherInputChange('chk_qid_other', e.target.value)} />
            <p>Current Answers: {JSON.stringify(currentAnswers)}</p>
            <p>Other Inputs: {JSON.stringify(otherInputValues)}</p>
        </div>
    );
}
export default SurveyTakingPage;
// ----- END OF COMPLETE MODIFIED FILE (vNext16.34 - Full handleCheckboxChange + handleOtherInputChange) -----