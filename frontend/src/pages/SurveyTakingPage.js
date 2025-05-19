// frontend/src/pages/SurveyTakingPage.js
// ----- START OF COMPLETE MODIFIED FILE (vNext16.19 - Re-introducing useMemos) -----
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify'; // Keep for now, might be used by re-enabled callbacks later
import ReCAPTCHA from "react-google-recaptcha"; // Keep for now
import styles from './SurveyTakingPage.module.css';
import surveyApiFunctions from '../api/surveyApi'; // Keep for now

// Commented out, not used in this simplified version yet
// import ShortTextQuestion from '../components/survey_question_renders/ShortTextQuestion';
// ... etc.
// import Modal from '../components/common/Modal'; // Commented out if no modals in simplified JSX

function SurveyTakingPage() {
    console.log('[Debug STM] SurveyTakingPage function component body executing. (Top)');
    const { surveyId, collectorId: routeCollectorIdentifier, resumeToken: routeResumeToken } = useParams();
    // const navigate = useNavigate(); 
    const location = useLocation(); // Needed for one of the re-enabled useMemos (currentQToRenderMemoized's dependencies)

    console.log(`[Debug STM] useParams results: surveyId=${surveyId}, routeCollectorIdentifier=${routeCollectorIdentifier}, routeResumeToken=${routeResumeToken}`);

    // State needed for re-enabled useMemos and active effects
    const [survey, setSurvey] = useState(null); // For currentQToRenderMemoized, isSubmitStateDerived
    const [originalQuestions, setOriginalQuestions] = useState([]); // For many useMemos
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentCollectorIdentifier, setCurrentCollectorIdentifier] = useState(null);
    const [randomizedQuestionOrder, setRandomizedQuestionOrder] = useState([]); // For questionsInCurrentOrder
    const [visibleQuestionIndices, setVisibleQuestionIndices] = useState([]);   // For currentQToRenderMemoized, isSubmitStateDerived
    const [currentVisibleIndex, setCurrentVisibleIndex] = useState(0);       // For currentQToRenderMemoized, isSubmitStateDerived
    // const [isDisqualified, setIsDisqualified] = useState(false); // Keep commented for now

    console.log('[Debug STM] Before useMemo hooks.');

    const questionsById = useMemo(() => {
        console.log('[Debug STM] questionsById CALC. originalQuestions.length:', originalQuestions.length);
        return originalQuestions.reduce((map, q) => { if(q && q._id) map[q._id] = q; return map; }, {});
    }, [originalQuestions]);

    // ++ RE-ENABLING useMemo: questionsInCurrentOrder ++
    const questionsInCurrentOrder = useMemo(() => {
        console.log('[Debug STM] questionsInCurrentOrder CALC. OQ.length:', originalQuestions.length, 'RQO.length:', randomizedQuestionOrder.length);
        return (randomizedQuestionOrder.length > 0 && originalQuestions.length > 0) ? randomizedQuestionOrder.map(index => originalQuestions[index]).filter(q => q) : originalQuestions.filter(q => q);
    }, [randomizedQuestionOrder, originalQuestions]);

    // ++ RE-ENABLING useMemo: questionIdToOriginalIndexMap ++
    const questionIdToOriginalIndexMap = useMemo(() => {
        console.log('[Debug STM] questionIdToOriginalIndexMap CALC. OQ.length:', originalQuestions.length);
        return originalQuestions.reduce((map, q, index) => { if(q && q._id) map[q._id] = index; return map; }, {});
    }, [originalQuestions]);
    
    // ++ RE-ENABLING useMemo: currentQToRenderMemoized (using its full original definition with logs) ++
    const currentQToRenderMemoized = useMemo(() => {
        console.log(`[Debug STM] currentQToRenderMemoized CALC: isLoading=${isLoading}, survey=${!!survey}, VQI.length=${visibleQuestionIndices.length}, CVI=${currentVisibleIndex}, OQ.length=${originalQuestions.length}`);
        if (isLoading || !survey || visibleQuestionIndices.length === 0 || currentVisibleIndex < 0 || currentVisibleIndex >= visibleQuestionIndices.length) {
            console.log('[Debug STM] currentQToRenderMemoized -> null (PRE-CONDITION FAILED)');
            return null;
        }
        const currentOriginalIdx = visibleQuestionIndices[currentVisibleIndex];
        console.log(`[Debug STM] currentQToRenderMemoized: currentOriginalIdx = VQI[${currentVisibleIndex}] = ${currentOriginalIdx}`);
        if (currentOriginalIdx === undefined || currentOriginalIdx < 0 || currentOriginalIdx >= originalQuestions.length) {
            console.error(`[Debug STM] currentQToRenderMemoized -> null (INVALID currentOriginalIdx: ${currentOriginalIdx} for OQ length: ${originalQuestions.length})`);
            return null;
        }
        const q = originalQuestions[currentOriginalIdx];
        if (!q || !q._id) {
            console.error(`[Debug STM] currentQToRenderMemoized -> null (Question object or _id is FALSY at originalQuestions[${currentOriginalIdx}]). Question object:`, q);
            return null;
        }
        console.log(`[Debug STM] currentQToRenderMemoized -> RETURNING question ID: ${q._id}`);
        return q;
    }, [isLoading, survey, visibleQuestionIndices, currentVisibleIndex, originalQuestions]);

    // ++ RE-ENABLING useMemo: isSubmitStateDerived (using its full original definition with logs) ++
    const isSubmitStateDerived = useMemo(() => {
        console.log(`[Debug STM] isSubmitStateDerived CALC: isLoading=${isLoading}, survey=${!!survey}, VQI.length=${visibleQuestionIndices.length}, OQ.length=${originalQuestions.length}, CVI=${currentVisibleIndex}`);
        if (isLoading || !survey) {
            console.log('[Debug STM] isSubmitStateDerived -> false (isLoading or no survey)');
            return false;
        }
        if (originalQuestions.length > 0 && visibleQuestionIndices.length === 0 && !isLoading) {
            console.log('[Debug STM] isSubmitStateDerived -> true (OQ > 0, VQI === 0, not loading)');
            return true; 
        }
        if (originalQuestions.length === 0 && !isLoading) {
            console.log('[Debug STM] isSubmitStateDerived -> true (No questions in survey, not loading)');
            return true; 
        }
        const result = currentVisibleIndex >= visibleQuestionIndices.length && visibleQuestionIndices.length > 0 && !isLoading;
        console.log(`[Debug STM] isSubmitStateDerived -> ${result} (final condition)`);
        return result;
    }, [isLoading, survey, visibleQuestionIndices, originalQuestions, currentVisibleIndex]);
        
    console.log('[Debug STM] After useMemo hooks, before useEffect hooks.');

    // Active useEffects from vNext16.18
    useEffect(() => {
        console.log(`[Debug STM] useEffect (set CCI) ENTERED. routeCollectorIdentifier=${routeCollectorIdentifier}`);
        const effectiveCollectorId = routeCollectorIdentifier; // Simplified as location is not fully re-enabled yet
        console.log(`[Debug STM] useEffect (set CCI): effectiveCollectorId = ${effectiveCollectorId}. Setting currentCollectorIdentifier.`);
        setCurrentCollectorIdentifier(effectiveCollectorId);
    }, [routeCollectorIdentifier]);

    useEffect(() => {
        console.log('[Debug STM] useEffect (Manual Loading Control) ENTERED.');
        const timer = setTimeout(() => {
            console.log('[Debug STM] Manual Loading Control: Setting isLoading to false.');
            setIsLoading(false);
            setError("Test with re-enabled useMemos. Data fetching disabled.");
        }, 100);
        return () => clearTimeout(timer);
    }, []);

    // Other useEffects remain commented out
    // useEffect(() => { /* ... (set CRT) ... */ }, [location.state?.resumeToken, routeResumeToken, currentResumeToken]);
    // useEffect(() => { /* ... (CustomVars) ... */ }, [survey, location.search]);
    // useEffect(() => { /* ... (visibleQuestionIndices) ... */ }, [isLoading, originalQuestions, questionsInCurrentOrder, hiddenQuestionIds, questionIdToOriginalIndexMap, randomizedQuestionOrder, visibleQuestionIndices]);
    // useEffect(() => { /* ... (CVI boundary check) ... */ }, [visibleQuestionIndices, isLoading, survey, isDisqualified, currentVisibleIndex, originalQuestions.length]);
    
    // fetchSurvey and its trigger remain commented out
    // const fetchSurvey = useCallback(async (signal) => { /* ... */ }, [/* ... */]);
    // useEffect(() => { /* ... fetch trigger ... */ }, [/* ... */]);

    console.log('[Debug STM] After useEffect hooks, before useCallback hooks.');

    // All other useCallbacks remain commented out
    // const evaluateDisabled = useCallback((qIdx) => { /* ... */ return false; }, [originalQuestions]);
    // ...

    console.log('[Debug STM] After useCallback hooks, before main render logic.');
    
    console.log(`[Debug STM] Render: Top of render logic. surveyId=${surveyId}, isLoading=${isLoading}, error=${error}`);
    
    if (isLoading) { 
        console.log(`[Debug STM] Render: isLoading is true.`);
        return <div className={styles.loading}>Loading (Re-introducing useMemos)...</div>; 
    }
    if (error) { 
        console.log(`[Debug STM] Render: Error display: ${error}`);
        const finalQToRender = currentQToRenderMemoized; // Get value for display
        const finalIsSubmit = isSubmitStateDerived; // Get value for display
        return (
            <div className={styles.errorContainer}>
                <h2>Test Information (useMemos re-enabled)</h2>
                <p>{error}</p>
                <p>Collector ID (state): {currentCollectorIdentifier}</p>
                <p>questionsById keys: {Object.keys(questionsById).join(', ')}</p>
                <p>questionsInCurrentOrder length: {questionsInCurrentOrder.length}</p>
                <p>questionIdToOriginalIndexMap keys: {Object.keys(questionIdToOriginalIndexMap).join(', ')}</p>
                <p>currentQToRenderMemoized is null: {(finalQToRender === null).toString()}</p>
                <p>isSubmitStateDerived: {finalIsSubmit.toString()}</p>
            </div>
        );
    }
    
    console.log('[Debug STM] FINAL RENDER PREP (Simplified with useMemos)');
    console.log('[Debug STM] Before main return statement (JSX - Simplified with useMemos).');

    // Simplified JSX to display values from re-enabled useMemos
    const finalQToRender = currentQToRenderMemoized;
    const finalIsSubmit = isSubmitStateDerived;

    return (
        <div className={styles.surveyContainer}>
            <h1>Survey Taking Page (useMemos Re-enabled)</h1>
            <p>Survey ID: {surveyId}</p>
            <p>isLoading: {isLoading.toString()}</p>
            <p>Error: {error || "No error"}</p>
            <p>Collector Identifier (state): {currentCollectorIdentifier}</p>
            <hr/>
            <p><b>useMemo Test Values:</b></p>
            <p>questionsById keys: {Object.keys(questionsById).join(', ')}</p>
            <p>questionsInCurrentOrder length: {questionsInCurrentOrder.length}</p>
            <p>questionIdToOriginalIndexMap keys: {Object.keys(questionIdToOriginalIndexMap).join(', ')}</p>
            <p>currentQToRenderMemoized is null: {(finalQToRender === null).toString()}</p>
            {finalQToRender && <p>currentQToRenderMemoized ID: {finalQToRender._id}</p>}
            <p>isSubmitStateDerived: {finalIsSubmit.toString()}</p>
        </div>
    );
}
export default SurveyTakingPage;
// ----- END OF COMPLETE MODIFIED FILE (vNext16.19 - Re-introducing useMemos) -----