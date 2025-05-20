// frontend/src/pages/SurveyTakingPage.js
// ----- START OF UPDATED FILE (Attempt to fix re-rendering loop) -----
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import surveyApi from '../api/surveyApi'; 
import styles from './SurveyTakingPage.module.css';

// ... (all your question component imports remain the same) ...
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


const ensureArray = (value) => (Array.isArray(value) ? value : (value !== undefined && value !== null ? [value] : []));

function SurveyTakingPage() {
    const { surveyId, collectorId, resumeToken: routeResumeToken } = useParams();
    const location = useLocation();
    const navigate = useNavigate();

    // Initialize from location.state ONCE, or if it truly changes.
    // We'll use a separate effect for location.state processing.
    const [initialSurveyTitle, setInitialSurveyTitle] = useState('');
    const [collectorSettings, setCollectorSettings] = useState(null);

    const [survey, setSurvey] = useState(null);
    const [originalQuestions, setOriginalQuestions] = useState([]);
    const [currentAnswers, setCurrentAnswers] = useState({});
    const [otherInputValues, setOtherInputValues] = useState({});
    
    const [isLoadingSurvey, setIsLoadingSurvey] = useState(true);
    const [surveyError, setSurveyError] = useState(null);
    
    const [currentVisibleIndex, setCurrentVisibleIndex] = useState(0);
    const [visibleQuestionIndices, setVisibleQuestionIndices] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [currentResumeToken, setCurrentResumeToken] = useState(routeResumeToken); // Initialize from route param
    const [isSavingAndContinueLater, setIsSavingAndContinueLater] = useState(false);
    const [showResumeCodeModal, setShowResumeCodeModal] = useState(false);
    const [generatedResumeCode, setGeneratedResumeCode] = useState('');
    const [emailForReminder, setEmailForReminder] = useState('');
    const [promptForEmailOnSave, setPromptForEmailOnSave] = useState(false);

    const autoAdvanceTimeoutRef = useRef(null);
    const OTHER_VALUE_INTERNAL = '__OTHER__';

    // Effect to process location.state changes specifically
    useEffect(() => {
        const stateFromLocation = location.state;
        if (stateFromLocation) {
            if (stateFromLocation.surveyTitle && stateFromLocation.surveyTitle !== initialSurveyTitle) {
                console.log("[SurveyTakingPage - location.state effect] Setting initialSurveyTitle from location.state");
                setInitialSurveyTitle(stateFromLocation.surveyTitle);
            }
            // Deep comparison for objects is tricky. Stringify is a common, albeit imperfect, way.
            // Only update if the stringified versions are different to avoid loops if location.state object identity changes but content doesn't.
            if (stateFromLocation.collectorSettings && JSON.stringify(stateFromLocation.collectorSettings) !== JSON.stringify(collectorSettings)) {
                console.log("[SurveyTakingPage - location.state effect] Setting collectorSettings from location.state");
                setCollectorSettings(stateFromLocation.collectorSettings);
            }
        }
    }, [location.state]); // Only re-run if location.state object itself changes.

    const questionsById = useMemo(() => { 
        if (!originalQuestions || originalQuestions.length === 0) return {};
        return originalQuestions.reduce((acc, q) => { acc[q._id] = q; return acc; }, {});
    }, [originalQuestions]);

    const currentQuestionToRender = useMemo(() => {
        if (isLoadingSurvey || !survey || !originalQuestions.length || !visibleQuestionIndices.length || currentVisibleIndex < 0 || currentVisibleIndex >= visibleQuestionIndices.length) {
            return null;
        }
        const originalIndexToFind = visibleQuestionIndices[currentVisibleIndex];
        const question = originalQuestions.find(q => q.originalIndex === originalIndexToFind);
        if (!question && visibleQuestionIndices.length > 0) {
             console.error(`[STM Debug] Could not find question for originalIndex ${originalIndexToFind} at currentVisibleIndex ${currentVisibleIndex}. VisibleIndices:`, visibleQuestionIndices, "OriginalQuestions:", originalQuestions);
        }
        return question;
    }, [isLoadingSurvey, survey, originalQuestions, visibleQuestionIndices, currentVisibleIndex]);

    const isSubmitState = useMemo(() => {
        if (isLoadingSurvey || !survey || !visibleQuestionIndices.length) return false;
        return currentVisibleIndex >= visibleQuestionIndices.length - 1;
    }, [isLoadingSurvey, survey, visibleQuestionIndices, currentVisibleIndex]);

    useEffect(() => {
        return () => {
            if (autoAdvanceTimeoutRef.current) {
                clearTimeout(autoAdvanceTimeoutRef.current);
            }
        };
    }, []); // Empty dependency array, runs once on mount and unmount

    // Main data fetching effect
    useEffect(() => {
        if (!surveyId) { setSurveyError("Survey ID missing."); setIsLoadingSurvey(false); return; }
        if (!collectorId) { setSurveyError("Collector ID missing."); setIsLoadingSurvey(false); return; }
        
        console.log("[SurveyTakingPage - fetch effect] Running. surveyId, collectorId, currentResumeToken:", surveyId, collectorId, currentResumeToken);
        setIsLoadingSurvey(true); 
        setSurveyError(null); // Clear previous errors
        
        const fetchOptions = { forTaking: 'true', collectorId };
        if (currentResumeToken) { // Use the state variable currentResumeToken
            fetchOptions.resumeToken = currentResumeToken;
        }

        const abortController = new AbortController();
        fetchOptions.signal = abortController.signal;

        surveyApi.getSurveyById(surveyId, fetchOptions)
            .then(response => {
                if (response.success && response.data) {
                    console.log("[SurveyTakingPage - fetch effect] Survey data received:", response.data);
                    setSurvey(response.data);
                    const fetchedQuestions = response.data.questions || [];
                    const questionsWithIndex = fetchedQuestions.map((q, idx) => ({ ...q, originalIndex: typeof q.originalIndex === 'number' ? q.originalIndex : idx }));
                    setOriginalQuestions(questionsWithIndex);
                    const indices = questionsWithIndex.map(q => q.originalIndex).sort((a, b) => a - b);
                    if (indices.length === 0 && fetchedQuestions.length > 0) {
                        console.warn("[STM Debug] No valid originalIndex found on fetched questions.", "Fetched Questions:", fetchedQuestions);
                    }
                    setVisibleQuestionIndices(indices);
                    
                    if (response.data.partialResponse) {
                        setCurrentAnswers(response.data.partialResponse.answers || {});
                        setOtherInputValues(response.data.partialResponse.otherInputValues || {});
                        if (typeof response.data.partialResponse.currentVisibleIndex === 'number') {
                            setCurrentVisibleIndex(response.data.partialResponse.currentVisibleIndex);
                        }
                        // Only update currentResumeToken if the fetched one is different
                        if(response.data.partialResponse.resumeToken && response.data.partialResponse.resumeToken !== currentResumeToken) {
                           setCurrentResumeToken(response.data.partialResponse.resumeToken);
                        }
                    } else if (currentResumeToken && !response.data.partialResponse) { // If a token was used but no partial response came back
                        setCurrentResumeToken(null); // Clear the token
                    }

                    // Set title and collector settings from API response only if they are not already set or different
                    if (response.data.title && response.data.title !== initialSurveyTitle) {
                        setInitialSurveyTitle(response.data.title);
                    }
                    if (response.data.collectorSettings && JSON.stringify(response.data.collectorSettings) !== JSON.stringify(collectorSettings)) {
                        setCollectorSettings(response.data.collectorSettings);
                    }
                } else { 
                    setSurveyError(response.message || "Failed to load survey details."); 
                    setSurvey(null); 
                }
            })
            .catch(err => { 
                if (err.name === 'AbortError') {
                    console.log('[SurveyTakingPage - fetch effect] Fetch aborted.');
                } else {
                    console.error("[STM Debug] Error fetching survey details:", err); 
                    setSurveyError(err.message || "Error loading survey details."); 
                    setSurvey(null); 
                }
            })
            .finally(() => { 
                setIsLoadingSurvey(false); 
                console.log("[SurveyTakingPage - fetch effect] Finished.");
            });
        
        return () => {
            console.log("[SurveyTakingPage - fetch effect] Cleanup: Aborting fetch.");
            abortController.abort();
        };
    // Rerun this effect if surveyId, collectorId, or currentResumeToken (from state) changes.
    // initialSurveyTitle and collectorSettings (from state) are removed from deps here as they are set inside this effect,
    // and their changes should not re-trigger the fetch unless surveyId/collectorId/resumeToken change.
    }, [surveyId, collectorId, currentResumeToken]);


    const validateQuestion = useCallback((question, answer) => { return true; }, []);
    
    const handleSubmit = useCallback(async () => {
        if (isSubmitting) {
            console.warn('[SurveyTakingPage - handleSubmit] Already submitting, call ignored.');
            return;
        }
        console.log('[SurveyTakingPage - handleSubmit] Attempting submission...');
        console.log('[SurveyTakingPage - handleSubmit] surveyId:', surveyId);
        console.log('[SurveyTakingPage - handleSubmit] collectorId:', collectorId);
        console.log('[SurveyTakingPage - handleSubmit] Expected API endpoint path (relative to base API URL):', `/surveys/${surveyId}/submit`);

        if (!surveyId || !collectorId) { console.error("[SurveyTakingPage - handleSubmit] Cannot submit, survey/collector ID missing."); return; }
        
        setIsSubmitting(true);

        try {
            const payloadToSubmit = { 
                collectorId, 
                answers: currentAnswers, 
                otherInputValues, 
                resumeToken: currentResumeToken 
            };
            console.log('[SurveyTakingPage - handleSubmit] SUBMITTING WITH CURRENT PAYLOAD:', payloadToSubmit);
            
            const result = await surveyApi.submitSurveyAnswers(surveyId, payloadToSubmit); 
            console.log('[SurveyTakingPage - handleSubmit] API call result for submitSurveyAnswers:', result); 
            
            if (result && result.success) {
                console.log("Survey submitted successfully via frontend!", result);
                navigate(`/thank-you`, {state: {surveyTitle: survey?.title || initialSurveyTitle}});
            } else {
                console.error("Submission failed on frontend, API result indicates failure or is undefined:", result);
            }
        } catch (err) {
            console.error("Submission error caught by try-catch in handleSubmit:", err);
        } finally {
            console.log('[SurveyTakingPage - handleSubmit] Reached finally block, setting isSubmitting to false.');
            setIsSubmitting(false);
        }
    }, [surveyId, collectorId, currentAnswers, otherInputValues, currentResumeToken, navigate, survey?.title, initialSurveyTitle, isSubmitting]);

    const handleNext = useCallback(() => {
        if (autoAdvanceTimeoutRef.current) clearTimeout(autoAdvanceTimeoutRef.current);
        if (currentQuestionToRender && !validateQuestion(currentQuestionToRender, currentAnswers[currentQuestionToRender._id])) return;
        if (!isSubmitState) setCurrentVisibleIndex(prev => prev + 1);
        else handleSubmit(); 
    }, [isSubmitState, currentVisibleIndex, validateQuestion, currentQuestionToRender, currentAnswers, handleSubmit]);

    const handleInputChange = useCallback((questionId, value) => {
        setCurrentAnswers(prev => ({ ...prev, [questionId]: value }));
        const autoAdvanceEnabled = collectorSettings?.autoAdvance ?? survey?.settings?.behaviorNavigation?.autoAdvance ?? false;
        const question = questionsById[questionId]; 
        const autoAdvanceTypes = ['multiple-choice', 'nps', 'rating'];
        const isOtherSelectedForOtherQuestion = question && question.addOtherOption && value === OTHER_VALUE_INTERNAL;
        if (autoAdvanceEnabled && question && autoAdvanceTypes.includes(question.type) && !isSubmitState && !isOtherSelectedForOtherQuestion) {
            if (autoAdvanceTimeoutRef.current) clearTimeout(autoAdvanceTimeoutRef.current);
            autoAdvanceTimeoutRef.current = setTimeout(() => { handleNext(); autoAdvanceTimeoutRef.current = null; }, 500); 
        } else if (autoAdvanceTimeoutRef.current && isOtherSelectedForOtherQuestion) {
            clearTimeout(autoAdvanceTimeoutRef.current);
            autoAdvanceTimeoutRef.current = null;
        }
    }, [collectorSettings, survey, questionsById, isSubmitState, handleNext]);

    const handleCheckboxChange = useCallback((questionId, optionValue, isChecked) => {
        setCurrentAnswers(prevAnswers => {
            const currentSelection = prevAnswers[questionId] ? [...ensureArray(prevAnswers[questionId])] : [];
            let newSelection = isChecked ? [...currentSelection, optionValue] : currentSelection.filter(val => val !== optionValue);
            if (optionValue === OTHER_VALUE_INTERNAL && !isChecked) {
                setOtherInputValues(prevOther => ({ ...prevOther, [`${questionId}_other`]: '' }));
            }
            return { ...prevAnswers, [questionId]: newSelection };
        });
    }, []);
    
    const handleOtherInputChange = useCallback((questionId, value) => {
        setOtherInputValues(prev => ({ ...prev, [`${questionId}_other`]: value }));
        setCurrentAnswers(prevAnswers => {
            const currentSelection = prevAnswers[questionId] ? [...ensureArray(prevAnswers[questionId])] : [];
            if (value && value.trim() !== '' && !currentSelection.includes(OTHER_VALUE_INTERNAL)) {
                return { ...prevAnswers, [questionId]: [...currentSelection, OTHER_VALUE_INTERNAL] };
            }
            return prevAnswers;
        });
    }, []);

    const handleComplexAnswerChange = useCallback((questionId, structuredAnswer) => {
        setCurrentAnswers(prev => ({ ...prev, [questionId]: structuredAnswer }));
    }, []);
    
    const handlePrevious = useCallback(() => {
        if (autoAdvanceTimeoutRef.current) clearTimeout(autoAdvanceTimeoutRef.current);
        if (currentVisibleIndex > 0) setCurrentVisibleIndex(prev => prev - 1);
    }, [currentVisibleIndex]);

    const performSaveAndContinue = async (emailForSave = null) => {
        if (!surveyId || !collectorId) { console.error("Cannot save, survey/collector ID missing."); return; }
        setIsSavingAndContinueLater(true);
        try {
            const payload = { collectorId, answers: currentAnswers, otherInputValues, currentVisibleIndex: currentVisibleIndex, resumeToken: currentResumeToken };
            if (emailForSave) payload.respondentEmail = emailForSave;
            const result = await surveyApi.savePartialResponse(surveyId, payload);
            if (result.success && result.resumeToken) {
                setCurrentResumeToken(result.resumeToken); // Update state with new token
                setGeneratedResumeCode(result.resumeToken);
                setShowResumeCodeModal(true); 
                setPromptForEmailOnSave(false); 
                console.log("Progress saved. Resume Code:", result.resumeToken);
            } else {
                console.error("Failed to save for later.", result);
            }
        } catch (err) {
            console.error("Error saving for later.", err);
        } finally {
            setIsSavingAndContinueLater(false);
        }
    };
    
    const handleSaveAndContinueLater = useCallback(async () => {
        const saveMethod = survey?.settings?.behaviorNavigation?.saveAndContinueMethod || collectorSettings?.saveAndContinueMethod || 'email';
        const needsEmailPrompt = (saveMethod === 'email' || saveMethod === 'both') && !emailForReminder;
        if (needsEmailPrompt) {
            setPromptForEmailOnSave(true); 
            setShowResumeCodeModal(true); 
            return; 
        }
        performSaveAndContinue(emailForReminder || null);
    }, [surveyId, collectorId, currentAnswers, otherInputValues, currentResumeToken, currentVisibleIndex, survey, collectorSettings, emailForReminder]);

    const handleModalEmailSubmitAndSave = () => {
        const saveMethod = survey?.settings?.behaviorNavigation?.saveAndContinueMethod || collectorSettings?.saveAndContinueMethod || 'email';
        if ((saveMethod === 'email' || saveMethod === 'both') && !emailForReminder.trim()) {
            alert("Please enter your email address to save and continue.");
            return;
        }
        performSaveAndContinue(emailForReminder.trim());
    };
    
    const renderProgressBar = useCallback(() => {
        const showBar = collectorSettings?.progressBarEnabled ?? survey?.settings?.behaviorNavigation?.progressBarEnabled ?? false;
        if (!survey || !showBar || !visibleQuestionIndices || visibleQuestionIndices.length === 0) return null;
        const safeIdx = Math.min(currentVisibleIndex, visibleQuestionIndices.length - 1);
        const progress = visibleQuestionIndices.length > 0 ? ((safeIdx + 1) / visibleQuestionIndices.length) * 100 : 0;
        return (
            <div className={styles.progressBarContainer}><div className={styles.progressBarTrack}><div className={styles.progressBarFill} style={{ width: `${progress.toFixed(2)}%` }}></div></div><span>{Math.round(progress)}% Complete</span></div>
        );
    }, [survey, visibleQuestionIndices, currentVisibleIndex, collectorSettings]);

    const renderQuestionInputs = (question) => {
        if (!question) return <p>Error: Question data is missing.</p>;
        const showQuestionNumber = survey?.settings?.behaviorNavigation?.questionNumberingEnabled ?? collectorSettings?.questionNumberingEnabled ?? false;
        const questionNumberDisplay = showQuestionNumber ? `${currentVisibleIndex + 1}. ` : "";
        const commonProps = { question, currentAnswer: currentAnswers[question._id], disabled: isSubmitting || isSavingAndContinueLater, isPreviewMode: false };
        const choiceProps = { ...commonProps, otherValue: otherInputValues[`${question._id}_other`], onOtherTextChange: handleOtherInputChange };
        let questionComponent;
        switch (question.type) {
            case 'text': questionComponent = <ShortTextQuestion {...commonProps} onAnswerChange={handleInputChange} />; break;
            case 'textarea': questionComponent = <TextAreaQuestion {...commonProps} onAnswerChange={handleInputChange} />; break;
            case 'multiple-choice': questionComponent = <MultipleChoiceQuestion {...choiceProps} onAnswerChange={handleInputChange} />; break;
            case 'checkbox': questionComponent = <CheckboxQuestion {...choiceProps} onCheckboxChange={handleCheckboxChange} />; break;
            case 'dropdown': questionComponent = <DropdownQuestion {...choiceProps} onAnswerChange={handleInputChange} />; break;
            case 'nps': questionComponent = <NpsQuestion {...commonProps} onAnswerChange={handleInputChange} />; break;
            case 'rating': questionComponent = <RatingQuestion {...commonProps} onAnswerChange={handleInputChange} />; break;
            case 'slider': questionComponent = <SliderQuestion {...commonProps} onAnswerChange={handleInputChange} />; break;
            case 'ranking': questionComponent = <RankingQuestion {...commonProps} onAnswerChange={handleComplexAnswerChange} />; break;
            case 'matrix': questionComponent = <MatrixQuestion {...commonProps} onAnswerChange={handleComplexAnswerChange} />; break;
            case 'heatmap': questionComponent = <HeatmapQuestion {...commonProps} onAnswerChange={handleComplexAnswerChange} />; break;
            case 'cardsort': questionComponent = <CardSortQuestion {...commonProps} onAnswerChange={handleComplexAnswerChange} />; break;
            case 'conjoint': questionComponent = <ConjointQuestion {...commonProps} onAnswerChange={handleComplexAnswerChange} />; break;
            case 'maxdiff': questionComponent = <MaxDiffQuestion {...commonProps} onAnswerChange={handleComplexAnswerChange} />; break;
            default: console.warn("Unsupported question type:", question.type); questionComponent = <p>Unsupported: {question.type}</p>;
        }
        return (
            <>
                {showQuestionNumber && question.text && (
                    <span className={styles.questionNumber}>{questionNumberDisplay}</span>
                )}
                {questionComponent}
            </>
        );
    };

    if (isLoadingSurvey) return <div className={styles.loadingContainer}>Loading survey questions...</div>;
    if (surveyError) return <div className={styles.errorContainer}>Error loading survey: {surveyError}</div>;
    if (!survey || !originalQuestions) return <div className={styles.errorContainer}>Survey data could not be loaded or no questions found.</div>;

    const progressBarElement = renderProgressBar();
    const displayTitle = survey?.title || initialSurveyTitle || "Survey";
    const saveAndContinueEnabled = collectorSettings?.allowResume ?? survey?.settings?.behaviorNavigation?.saveAndContinueEnabled ?? false;
    const submitButton = isSubmitState && (visibleQuestionIndices.length > 0 || Object.keys(currentAnswers).length > 0) && 
        (<button type="button" onClick={handleSubmit} disabled={isSubmitting || isSavingAndContinueLater} className={styles.navButtonPrimary}>{isSubmitting ? 'Submitting...' : 'Submit'}</button>);

    return (
        <div className={styles.surveyContainer}>
            <header className={styles.surveyHeader}><h1>{displayTitle}</h1>{survey.description && <p className={styles.description}>{survey.description}</p>}{progressBarElement}</header>
            {currentQuestionToRender ? (<div className={styles.questionArea}>{renderQuestionInputs(currentQuestionToRender)}</div>) : 
                (!isSubmitting && currentVisibleIndex >= visibleQuestionIndices.length &&
                <div className={styles.surveyMessageContainer}><p className={styles.surveyMessage}>Thank you for your responses!</p>
                    {(visibleQuestionIndices.length > 0 || Object.keys(currentAnswers).length > 0) && <p className={styles.surveyMessage}>Click "Submit" to finalize your survey.</p>}
                    {visibleQuestionIndices.length === 0 && Object.keys(currentAnswers).length === 0 && <p className={styles.surveyMessage}>Survey completed.</p>}
                </div>)}
            <footer className={styles.surveyNavigation}>
                {(collectorSettings?.allowBackButton ?? true) && currentVisibleIndex > 0 && (<button type="button" onClick={handlePrevious} disabled={isSubmitting || isSavingAndContinueLater} className={styles.navButton}>Previous</button>)}
                {!( (collectorSettings?.allowBackButton ?? true) && currentVisibleIndex > 0) && <div style={{flexGrow: 1}}></div>}
                {saveAndContinueEnabled && (<button type="button" onClick={handleSaveAndContinueLater} disabled={isSavingAndContinueLater || isSubmitting} className={styles.navButtonSecondary}>Save and Continue Later</button>)}
                {!isSubmitState && (<button type="button" onClick={handleNext} disabled={!currentQuestionToRender || isSubmitting || isSavingAndContinueLater} className={styles.navButtonPrimary}>Next</button>)}
                {submitButton}
            </footer>
            {showResumeCodeModal && (
                 <div className={styles.modalBackdrop} onClick={() => { setShowResumeCodeModal(false); setPromptForEmailOnSave(false); setEmailForReminder(''); }}>
                    <div className={styles.modalContentWrapper} onClick={e => e.stopPropagation()}>
                        <h3>{promptForEmailOnSave ? "Save & Continue: Enter Email" : "Resume Later"}</h3>
                        {(promptForEmailOnSave || (generatedResumeCode && (survey?.settings?.behaviorNavigation?.saveAndContinueMethod === 'email' || survey?.settings?.behaviorNavigation?.saveAndContinueMethod === 'both'))) && (
                             <><p>{promptForEmailOnSave ? "Please enter your email address to receive a link to resume this survey later." : "Optionally, enter your email to also receive the resume code and link:"}</p><input type="email" value={emailForReminder} onChange={(e) => setEmailForReminder(e.target.value)} placeholder="your.email@example.com" className={styles.emailInputForReminder} /></>)}
                        {generatedResumeCode && (survey?.settings?.behaviorNavigation?.saveAndContinueMethod === 'code' || survey?.settings?.behaviorNavigation?.saveAndContinueMethod === 'both') && (
                            <><p>Your progress has been saved. Use the following code to resume your survey later:</p><strong className={styles.resumeCodeDisplay}>{generatedResumeCode}</strong><hr style={{margin: '15px 0'}} /></>)}
                        {!generatedResumeCode && !promptForEmailOnSave && <p>Saving your progress...</p>}
                        {promptForEmailOnSave ? (<button onClick={handleModalEmailSubmitAndSave} className={styles.button} disabled={isSavingAndContinueLater}>{isSavingAndContinueLater ? "Saving..." : "Save and Send Email"}</button>) : null }
                        <button onClick={() => { setShowResumeCodeModal(false); setPromptForEmailOnSave(false); setEmailForReminder('');}} className={styles.buttonSecondary} style={{marginTop: '10px', marginLeft: promptForEmailOnSave ? '10px' : '0'}}>Close</button>
                    </div>
                </div>)}
        </div>
    );
}
export default SurveyTakingPage;
// ----- END OF UPDATED FILE (Attempt to fix re-rendering loop) -----