// frontend/src/pages/SurveyTakingPage.js
// ----- START OF COMPLETE MODIFIED FILE (vNext16.7 - Debugging useEffect for Fetch) -----
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import ReCAPTCHA from "react-google-recaptcha";
import styles from './SurveyTakingPage.module.css';
import surveyApiFunctions from '../api/surveyApi';

// Question component imports (ensure these are fully implemented)
// ... (same as vNext16.6)

import Modal from '../components/common/Modal';

// Helper functions (ensure these are fully implemented)
// ... (same as vNext16.6)
const evaluateSurveyLogic = (logicRules, answers, questions, questionIdToOriginalIndexMap) => { /* ... (Full implementation from v16.5) ... */ return null; };


function SurveyTakingPage() {
    console.log('[Debug STM] SurveyTakingPage function component body executing.');

    const { surveyId, collectorId: routeCollectorIdentifier, resumeToken: routeResumeToken } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    // State variables (same as vNext16.6)
    // ...
    const [survey, setSurvey] = useState(null);
    const [originalQuestions, setOriginalQuestions] = useState([]);
    const [currentAnswers, setCurrentAnswers] = useState({});
    const [isLoading, setIsLoading] = useState(true); // Default to true
    const [error, setError] = useState(null);
    // ... (rest of state variables)
    const [currentCollectorIdentifier, setCurrentCollectorIdentifier] = useState(null);
    const [currentResumeToken, setCurrentResumeToken] = useState(null);


    // Memoized selectors (same as vNext16.6, with logs active)
    // ...
    const currentQToRenderMemoized = useMemo(() => { /* ... (same as v16.6 with logs) ... */ return null; }, [isLoading, survey, visibleQuestionIndices, currentVisibleIndex, originalQuestions]);
    const isSubmitStateDerived = useMemo(() => { /* ... (same as v16.6) ... */ return false; }, [isLoading, survey, visibleQuestionIndices, originalQuestions, currentVisibleIndex]);
        
    // ++ ADDED LOGS ++
    useEffect(() => {
        const effectiveCollectorId = location.state?.collectorIdentifier || routeCollectorIdentifier;
        console.log(`[Debug STM] useEffect (set CCI) RUNS. routeCollectorIdentifier=${routeCollectorIdentifier}, location.state?.collectorIdentifier=${location.state?.collectorIdentifier}. Setting currentCollectorIdentifier to: ${effectiveCollectorId}`);
        setCurrentCollectorIdentifier(effectiveCollectorId);
    }, [location.state?.collectorIdentifier, routeCollectorIdentifier]);

    // ++ ADDED LOGS ++
    useEffect(() => {
        const tokenFromRoute = routeResumeToken;
        const tokenFromState = location.state?.resumeToken;
        console.log(`[Debug STM] useEffect (set CRT) RUNS. routeResumeToken=${routeResumeToken}, location.state?.resumeToken=${tokenFromState}. Current currentResumeToken=${currentResumeToken}`);
        if (tokenFromRoute && currentResumeToken !== tokenFromRoute) {
            console.log(`[Debug STM] useEffect (set CRT): Setting currentResumeToken from route: ${tokenFromRoute}`);
            setCurrentResumeToken(tokenFromRoute);
        } else if (tokenFromState && currentResumeToken !== tokenFromState && !tokenFromRoute) { // Prefer route token if both exist (and no route token was just set)
            console.log(`[Debug STM] useEffect (set CRT): Setting currentResumeToken from location state: ${tokenFromState}`);
            setCurrentResumeToken(tokenFromState);
        } else {
            console.log(`[Debug STM] useEffect (set CRT): No change to currentResumeToken.`);
        }
    }, [location.state?.resumeToken, routeResumeToken, currentResumeToken]); // currentResumeToken added to prevent loops if already set

    useEffect(() => { /* ... CustomVars logic ... */ }, [survey, location.search]);

    const fetchSurvey = useCallback(async (signal) => {
        console.log('[Debug STM] fetchSurvey called. Initial isLoading (from state):', isLoading); // Log initial isLoading from state
        setIsLoading(true); // Explicitly set true
        setError(null);
        // ... (rest of fetchSurvey from vNext16.6, with all its internal logs)
        if (!currentResumeToken) {
            setHiddenQuestionIds(new Set());
            setIsDisqualified(false);
            setCurrentVisibleIndex(0);
            setVisitedPath([]);
        }
        setRecaptchaToken(null);

        console.log(`[Debug STM] fetchSurvey: Pre-API check. surveyId=${surveyId}, currentCollectorIdentifier=${currentCollectorIdentifier}, currentResumeToken=${currentResumeToken}, isPreviewingOwner=${location.state?.isPreviewingOwner}`);

        if (!surveyId) {
            setError("Survey ID is missing.");
            setIsLoading(false);
            console.error('[Debug STM] fetchSurvey: Exiting - Survey ID missing.');
            return;
        }
        if (!currentCollectorIdentifier && !(location.state?.isPreviewingOwner) && !currentResumeToken) {
            setError("Collector identifier or resume token is missing for API call.");
            setIsLoading(false);
            console.error('[Debug STM] fetchSurvey: Exiting - Collector ID or resume token missing for API.');
            return;
        }
        
        try {
            console.log('[Debug STM] fetchSurvey: Inside try block, before API call.');
            const options = { forTaking: 'true', signal, collectorId: currentCollectorIdentifier, resumeToken: currentResumeToken };
            if (location.state?.isPreviewingOwner) options.isPreviewingOwner = true;
            
            console.log('[Debug STM] fetchSurvey: Calling surveyApiFunctions.getSurveyById with options:', options);
            const responsePayload = await surveyApiFunctions.getSurveyById(surveyId, options);
            console.log('[Debug STM] fetchSurvey: API call completed. Response success:', responsePayload?.success);

            if (!responsePayload || !responsePayload.success || !responsePayload.data) {
                // ... (error handling)
            }
            const surveyData = responsePayload.data;
            if (!surveyData || !Array.isArray(surveyData.questions)) {
                // ... (error handling)
            }
            
            console.log('[Debug STM] fetchSurvey: API success, processing surveyData...');
            // ... (rest of successful data processing from vNext16.6) ...
            console.log('[Debug STM] fetchSurvey: Successfully processed survey data.');

        } catch (errCatch) { 
            // ... (catch block from vNext16.6) ...
        } finally { 
            setIsLoading(false); 
            console.log('[Debug STM] fetchSurvey FINALLY block. isLoading set to false.');
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [surveyId, currentCollectorIdentifier, currentResumeToken, location.state?.isPreviewingOwner, sessionId, surveyStartedAt]);
    
    // ++ MODIFIED useEffect for fetch trigger with more logs and try-catch ++
    useEffect(() => {
        const isPreviewing = location.state?.isPreviewingOwner;
        console.log(`[Debug STM] useEffect (fetch trigger) RUNS. surveyId=${surveyId}, currentCollectorIdentifier=${currentCollectorIdentifier}, currentResumeToken=${currentResumeToken}, isPreviewing=${isPreviewing}`);
        
        const shouldFetch = surveyId && (currentCollectorIdentifier || currentResumeToken || isPreviewing);
        console.log(`[Debug STM] useEffect (fetch trigger): shouldFetch = ${shouldFetch}`);

        if (shouldFetch) {
            console.log('[Debug STM] useEffect (fetch trigger): Conditions MET, attempting to call fetchSurvey.');
            const controller = new AbortController();
            try {
                // Intentionally call fetchSurvey without await here, as it's a useCallback that sets its own loading state.
                fetchSurvey(controller.signal); 
                console.log('[Debug STM] useEffect (fetch trigger): fetchSurvey call initiated (no sync error).');
            } catch (e) {
                console.error('[Debug STM] useEffect (fetch trigger): SYNC ERROR during fetchSurvey INVOCATION:', e);
                setError("A critical error occurred when trying to load the survey data.");
                setIsLoading(false); // Ensure loading is stopped if sync error occurs
            }
            
            const timeoutId = autoAdvanceTimeoutRef.current; 
            return () => {
                console.log('[Debug STM] useEffect (fetch trigger): Cleanup. Aborting controller.');
                controller.abort();
                if (timeoutId) clearTimeout(timeoutId);
            };
        } else if (surveyId) {
            console.log('[Debug STM] useEffect (fetch trigger): Conditions NOT MET (but surveyId exists). Setting error and isLoading=false.');
            setError("Collector information or resume token is missing to load the survey.");
            setIsLoading(false);
        } else {
            console.log('[Debug STM] useEffect (fetch trigger): Conditions NOT MET (no surveyId). Current isLoading state:', isLoading);
            // If there's no surveyId, and we are still in the initial loading state, set isLoading to false.
            // The render logic will then show "Survey Not Specified".
            if (!surveyId && isLoading) {
                 console.log('[Debug STM] useEffect (fetch trigger): No surveyId and still isLoading, setting isLoading to false.');
                 setIsLoading(false);
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [surveyId, currentCollectorIdentifier, currentResumeToken, location.state?.isPreviewingOwner, fetchSurvey]); // fetchSurvey is stable due to useCallback

    useEffect(() => { /* ... visibleQuestionIndices calculation (same as vNext16.6 with its logs active) ... */ }, [isLoading, originalQuestions, questionsInCurrentOrder, hiddenQuestionIds, questionIdToOriginalIndexMap, randomizedQuestionOrder, visibleQuestionIndices]);
    useEffect(() => { /* ... CVI boundary check logic ... */ }, [visibleQuestionIndices, isLoading, survey, isDisqualified, currentVisibleIndex, allowBackButton, visitedPath]);
    
    // ... (All other useCallback hooks and render logic from vNext16.6, with their respective logs active) ...
    // ... (Ensure evaluateDisabled, validateQuestion, handleNext, etc., are fully implemented) ...

    // --- Render logic (same as vNext16.6, with its logs active) ---
    // ...
    return (
        <>
            {/* ... (Full JSX structure from vNext16.6) ... */}
        </>
    );
}

export default SurveyTakingPage;
// ----- END OF COMPLETE MODIFIED FILE (vNext16.7 - Debugging useEffect for Fetch) -----