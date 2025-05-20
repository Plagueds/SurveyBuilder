// frontend/src/pages/SurveyTakingPage.js
// ----- START OF UPDATED FILE -----
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
// import { toast } from 'react-toastify';
import surveyApi from '../api/surveyApi';
import styles from './SurveyTakingPage.module.css';

// --- Import ALL your question rendering components ---
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
import ShortTextQuestion from '../components/survey_question_renders/ShortTextQuestion'; // Covers 'text' type
import SliderQuestion from '../components/survey_question_renders/SliderQuestion';
import TextAreaQuestion from '../components/survey_question_renders/TextAreaQuestion';

const ensureArray = (value) => (Array.isArray(value) ? value : (value !== undefined && value !== null ? [value] : []));

function SurveyTakingPage() {
    console.log('[Debug STM] SurveyTakingPage LOADED.');
    const { surveyId, collectorId, resumeToken: routeResumeToken } = useParams();
    const location = useLocation();
    const navigate = useNavigate();

    const [initialSurveyTitle, setInitialSurveyTitle] = useState(location.state?.surveyTitle || '');
    const [collectorSettings, setCollectorSettings] = useState(location.state?.collectorSettings || null);

    const [survey, setSurvey] = useState(null);
    const [originalQuestions, setOriginalQuestions] = useState([]);
    const [currentAnswers, setCurrentAnswers] = useState({});
    const [otherInputValues, setOtherInputValues] = useState({});
    
    const [isLoadingSurvey, setIsLoadingSurvey] = useState(true);
    const [surveyError, setSurveyError] = useState(null);
    
    const [currentVisibleIndex, setCurrentVisibleIndex] = useState(0);
    const [visibleQuestionIndices, setVisibleQuestionIndices] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [currentResumeToken, setCurrentResumeToken] = useState(routeResumeToken);
    const [isSavingAndContinueLater, setIsSavingAndContinueLater] = useState(false);
    const [showResumeCodeModal, setShowResumeCodeModal] = useState(false);
    const [generatedResumeCode, setGeneratedResumeCode] = useState('');
    const [emailForReminder, setEmailForReminder] = useState('');

    const OTHER_VALUE_INTERNAL = '__OTHER__';

    const questionsById = useMemo(() => originalQuestions.reduce((acc, q) => { acc[q._id] = q; return acc; }, {}), [originalQuestions]);

    const currentQuestionToRender = useMemo(() => {
        if (isLoadingSurvey || !survey || !visibleQuestionIndices || visibleQuestionIndices.length === 0 || currentVisibleIndex < 0 || currentVisibleIndex >= visibleQuestionIndices.length) {
            return null;
        }
        const originalQuestionIndexToFind = visibleQuestionIndices[currentVisibleIndex];
        return originalQuestions.find(q => q.originalIndex === originalQuestionIndexToFind);
    }, [isLoadingSurvey, survey, visibleQuestionIndices, currentVisibleIndex, originalQuestions]);

    const isSubmitState = useMemo(() => {
        if (isLoadingSurvey || !survey || !visibleQuestionIndices || visibleQuestionIndices.length === 0) return false;
        return currentVisibleIndex >= visibleQuestionIndices.length - 1;
    }, [isLoadingSurvey, survey, visibleQuestionIndices, currentVisibleIndex]);

    useEffect(() => {
        if (!surveyId) { setSurveyError("Survey ID missing."); setIsLoadingSurvey(false); return; }
        if (!collectorId) { setSurveyError("Collector ID missing."); setIsLoadingSurvey(false); return; }
        
        if (location.state?.collectorSettings && JSON.stringify(collectorSettings) !== JSON.stringify(location.state.collectorSettings)) {
            console.log("[Debug STM] Updating collectorSettings from location.state:", location.state.collectorSettings);
            setCollectorSettings(location.state.collectorSettings);
        }
        if (location.state?.surveyTitle && initialSurveyTitle !== location.state.surveyTitle) {
            setInitialSurveyTitle(location.state.surveyTitle);
        }

        console.log(`[Debug STM] Fetching survey: ${surveyId}, Collector: ${collectorId}, ResumeToken (route): ${routeResumeToken}, CurrentToken (state): ${currentResumeToken}`);
        setIsLoadingSurvey(true); setSurveyError(null);
        
        const effectiveTokenToUse = currentResumeToken || routeResumeToken; // Prioritize state token if set (e.g. after save)
        const fetchOptions = { forTaking: 'true', collectorId };
        if (effectiveTokenToUse) {
            fetchOptions.resumeToken = effectiveTokenToUse;
        }

        surveyApi.getSurveyById(surveyId, fetchOptions)
            .then(response => {
                if (response.success && response.data) {
                    console.log("[Debug STM] Survey details fetched:", response.data);
                    setSurvey(response.data);
                    const fetchedQuestions = response.data.questions || [];
                    setOriginalQuestions(fetchedQuestions);
                    setVisibleQuestionIndices(fetchedQuestions.map(q => q.originalIndex).sort((a, b) => a - b));
                    
                    if (response.data.partialResponse) {
                        console.log("[Debug STM] Resuming with partial response:", response.data.partialResponse);
                        setCurrentAnswers(response.data.partialResponse.answers || {});
                        setOtherInputValues(response.data.partialResponse.otherInputValues || {});
                        if (typeof response.data.partialResponse.currentVisibleIndex === 'number') {
                            setCurrentVisibleIndex(response.data.partialResponse.currentVisibleIndex);
                        }
                        if(response.data.partialResponse.resumeToken) { // Ensure token from partial response is used
                           setCurrentResumeToken(response.data.partialResponse.resumeToken);
                        }
                    } else if (effectiveTokenToUse && !response.data.partialResponse) {
                        // If a token was used but no partial response came back, it might be invalid/expired.
                        // Clear the token to prevent re-sending it.
                        console.warn(`[Debug STM] Resume token ${effectiveTokenToUse} provided but no partial response found. Clearing token.`);
                        setCurrentResumeToken(null); 
                        // Optionally, inform user: toast.warn("Could not resume previous session. Starting fresh.");
                    }

                    if (!initialSurveyTitle && response.data.title) {
                        setInitialSurveyTitle(response.data.title);
                    }
                    if (!collectorSettings && response.data.collectorSettings) { // If not passed via state, use from survey
                        console.log("[Debug STM] Using collectorSettings from survey response:", response.data.collectorSettings);
                        setCollectorSettings(response.data.collectorSettings);
                    } else if (collectorSettings && response.data.collectorSettings && JSON.stringify(collectorSettings) !== JSON.stringify(response.data.collectorSettings)) {
                        // This case is less likely if PublicSurveyHandler is the entry point and passes settings.
                        // But if direct access or preview, this might merge/update.
                        console.log("[Debug STM] Merging/updating collectorSettings from survey response over location.state (if different).");
                        setCollectorSettings(response.data.collectorSettings);
                    }

                } else { setSurveyError(response.message || "Failed to load survey details."); setSurvey(null); }
            })
            .catch(err => { console.error("[Debug STM] Error fetching survey details:", err); setSurveyError(err.message || "Error loading survey details."); setSurvey(null); })
            .finally(() => { setIsLoadingSurvey(false); });
    }, [surveyId, collectorId, routeResumeToken, location.state]); // Removed currentResumeToken from here to avoid loop with set inside, use routeResumeToken for initial fetch trigger

    const validateQuestion = useCallback((question, answer) => { return true; }, []);

    const handleInputChange = useCallback((questionId, value) => {
        setCurrentAnswers(prev => ({ ...prev, [questionId]: value }));
    }, []);

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

    const handleSubmit = useCallback(async () => {
        if (!surveyId || !collectorId) { console.error("Cannot submit, survey/collector ID missing."); return; }
        if (currentQuestionToRender && !validateQuestion(currentQuestionToRender, currentAnswers[currentQuestionToRender._id])) { return; }
        setIsSubmitting(true);
        try {
            const result = await surveyApi.submitSurveyAnswers(surveyId, { collectorId, answers: currentAnswers, otherInputValues, resumeToken: currentResumeToken });
            if (result.success) { console.log("Survey submitted!", result); navigate(`/thank-you`, {state: {surveyTitle: survey?.title || initialSurveyTitle}}); }
            else { console.error("Submission failed.", result); }
        } catch (err) { console.error("Submission error.", err); }
        finally { setIsSubmitting(false); }
    }, [surveyId, collectorId, currentAnswers, otherInputValues, currentResumeToken, validateQuestion, currentQuestionToRender, navigate, survey?.title, initialSurveyTitle]);

    const handleNext = useCallback(() => {
        if (currentQuestionToRender && !validateQuestion(currentQuestionToRender, currentAnswers[currentQuestionToRender._id])) { return; }
        if (!isSubmitState) { setCurrentVisibleIndex(prev => prev + 1); } else { handleSubmit(); }
    }, [isSubmitState, currentVisibleIndex, validateQuestion, currentQuestionToRender, currentAnswers, handleSubmit]);
    
    const handlePrevious = useCallback(() => { if (currentVisibleIndex > 0) { setCurrentVisibleIndex(prev => prev - 1); } }, [currentVisibleIndex]);

    const handleSaveAndContinueLater = useCallback(async () => {
        if (!surveyId || !collectorId) { console.error("Cannot save, survey/collector ID missing."); return; }
        setIsSavingAndContinueLater(true);
        try {
            const result = await surveyApi.savePartialResponse(surveyId, {
                collectorId, answers: currentAnswers, otherInputValues,
                currentVisibleIndex: currentVisibleIndex, 
                resumeToken: currentResumeToken 
            });
            if (result.success && result.resumeToken) {
                setCurrentResumeToken(result.resumeToken); setGeneratedResumeCode(result.resumeToken); setShowResumeCodeModal(true);
                console.log("Progress saved. Resume Code:", result.resumeToken);
            } else { console.error("Failed to save for later.", result); }
        } catch (err) { console.error("Error saving for later.", err); }
        finally { setIsSavingAndContinueLater(false); }
    }, [surveyId, collectorId, currentAnswers, otherInputValues, currentResumeToken, currentVisibleIndex]);

    const handleSendReminderEmail = useCallback(async () => {
        if (!surveyId ||!generatedResumeCode || !emailForReminder) { console.warn("Missing data for reminder."); return; }
        console.log(`Simulating sending email to ${emailForReminder} for survey ${surveyId}, code ${generatedResumeCode}`);
        // Potentially: const result = await surveyApi.sendResumeEmail(surveyId, generatedResumeCode, emailForReminder);
    }, [surveyId, generatedResumeCode, emailForReminder]);

    const renderProgressBar = useCallback(() => {
        // Use collectorSettings from state, which should be populated from location.state or survey response
        const showBar = collectorSettings?.progressBarEnabled ?? survey?.settings?.behaviorNavigation?.progressBarEnabled ?? false;
        if (!survey || !showBar || !visibleQuestionIndices || visibleQuestionIndices.length === 0) return null;
        const safeIdx = Math.min(currentVisibleIndex, visibleQuestionIndices.length - 1);
        const progress = visibleQuestionIndices.length > 0 ? ((safeIdx + 1) / visibleQuestionIndices.length) * 100 : 0;
        return ( <div className={styles.progressBarContainer}><div className={styles.progressBarFill} style={{ width: `${progress.toFixed(2)}%` }}></div><span>{Math.round(progress)}%</span></div> );
    }, [survey, visibleQuestionIndices, currentVisibleIndex, collectorSettings]);

    const renderQuestionInputs = (question) => {
        if (!question) return <p>Error: Question data is missing.</p>;
        const commonProps = {
            question,
            currentAnswer: currentAnswers[question._id],
            disabled: isSubmitting || isSavingAndContinueLater,
            isPreviewMode: false,
        };
        const choiceProps = {
            ...commonProps,
            otherValue: otherInputValues[`${question._id}_other`],
            onOtherTextChange: handleOtherInputChange,
        };

        switch (question.type) {
            case 'text': // Covers ShortTextQuestion
                return <ShortTextQuestion {...commonProps} onAnswerChange={handleInputChange} />;
            case 'textarea':
                return <TextAreaQuestion {...commonProps} onAnswerChange={handleInputChange} />;
            case 'multiple-choice': // Single select radio
                return <MultipleChoiceQuestion {...choiceProps} onAnswerChange={handleInputChange} />;
            case 'checkbox': // Multi-select
                return <CheckboxQuestion {...choiceProps} onCheckboxChange={handleCheckboxChange} />;
            case 'dropdown':
                return <DropdownQuestion {...choiceProps} onAnswerChange={handleInputChange} />;
            case 'nps':
                return <NpsQuestion {...commonProps} onAnswerChange={handleInputChange} />;
            case 'rating':
                return <RatingQuestion {...commonProps} onAnswerChange={handleInputChange} />;
            case 'slider':
                return <SliderQuestion {...commonProps} onAnswerChange={handleInputChange} />;
            case 'ranking':
                return <RankingQuestion {...commonProps} onAnswerChange={handleComplexAnswerChange} />;
            case 'matrix':
                return <MatrixQuestion {...commonProps} onAnswerChange={handleComplexAnswerChange} />;
            case 'heatmap':
                return <HeatmapQuestion {...commonProps} onAnswerChange={handleComplexAnswerChange} />;
            case 'cardsort':
                return <CardSortQuestion {...commonProps} onAnswerChange={handleComplexAnswerChange} />;
            case 'conjoint':
                return <ConjointQuestion {...commonProps} onAnswerChange={handleComplexAnswerChange} />;
            case 'maxdiff': // Corrected from max_diff
                return <MaxDiffQuestion {...commonProps} onAnswerChange={handleComplexAnswerChange} />;
            default:
                console.warn("Unsupported question type in SurveyTakingPage:", question.type, question);
                return <p>Unsupported question type: {question.type}</p>;
        }
    };

    if (isLoadingSurvey) return <div className={styles.loadingContainer}>Loading survey questions...</div>;
    if (surveyError) return <div className={styles.errorContainer}>Error loading survey: {surveyError}</div>;
    if (!survey) return <div className={styles.errorContainer}>Survey data could not be loaded.</div>;

    const progressBarElement = renderProgressBar();
    const displayTitle = survey?.title || initialSurveyTitle || "Survey";
    // Use collectorSettings from state for saveAndContinueEnabled
    const saveAndContinueEnabled = collectorSettings?.allowResume ?? survey.settings?.behaviorNavigation?.saveAndContinueEnabled ?? false;

    return (
        <div className={styles.surveyContainer}>
            <header className={styles.surveyHeader}>
                <h1>{displayTitle}</h1>
                {survey.description && <p className={styles.description}>{survey.description}</p>}
                {progressBarElement}
            </header>

            {currentQuestionToRender ? (
                <div className={styles.questionArea}>
                    {renderQuestionInputs(currentQuestionToRender)}
                </div>
            ) : (
                !isSubmitting && currentVisibleIndex >= visibleQuestionIndices.length &&
                <div className={styles.surveyMessageContainer}>
                    <p className={styles.surveyMessage}>Thank you for your responses!</p>
                    <p className={styles.surveyMessage}>Click "Submit" to finalize your survey.</p>
                </div>
            )}
            
            <footer className={styles.surveyNavigation}>
                {(collectorSettings?.allowBackButton ?? true) && currentVisibleIndex > 0 && (<button type="button" onClick={handlePrevious} disabled={isSubmitting || isSavingAndContinueLater} className={styles.navButton}>Previous</button>)}
                {!isSubmitState && (<button type="button" onClick={handleNext} disabled={!currentQuestionToRender || isSubmitting || isSavingAndContinueLater} className={styles.navButton}>Next</button>)}
                {isSubmitState && (<button type="button" onClick={handleSubmit} disabled={isSubmitting || isSavingAndContinueLater} className={styles.navButtonPrimary}>{isSubmitting ? 'Submitting...' : 'Submit'}</button>)}
                {saveAndContinueEnabled && (<button type="button" onClick={handleSaveAndContinueLater} disabled={isSavingAndContinueLater || isSubmitting} className={styles.navButtonSecondary}>{isSavingAndContinueLater ? 'Saving...' : 'Save and Continue Later'}</button>)}
            </footer>

            {showResumeCodeModal && (
                 <div className={styles.modalBackdrop} onClick={() => setShowResumeCodeModal(false)}>
                    <div className={styles.modalContentWrapper} onClick={e => e.stopPropagation()}>
                        <h3>Resume Later</h3>
                        <p>Your progress has been saved. Use the following code to resume your survey later:</p>
                        <strong className={styles.resumeCodeDisplay}>{generatedResumeCode}</strong>
                        <hr />
                        <p>Optionally, enter your email to receive this code and a resume link (if enabled):</p>
                        <input type="email" value={emailForReminder} onChange={(e) => setEmailForReminder(e.target.value)} placeholder="your.email@example.com" className={styles.emailInputForReminder} />
                        <button onClick={handleSendReminderEmail} className={styles.button}>Send Email Reminder</button>
                        <button onClick={() => setShowResumeCodeModal(false)} className={styles.buttonSecondary} style={{marginTop: '10px'}}>Close</button>
                    </div>
                </div>
            )}

            <div className={styles.debugInfo}>
                <p><strong>Debug Info (SurveyTakingPage):</strong></p>
                <p>URL Params: surveyId: {surveyId}, collectorId: {collectorId}, routeResumeToken: {routeResumeToken || "N/A"}</p>
                <p>Location State: surveyTitle: {location.state?.surveyTitle || "N/A"}, collectorSettings: {JSON.stringify(location.state?.collectorSettings)}</p>
                <p>Survey Loaded: {survey ? `Title: ${survey.title}, Qs: ${originalQuestions.length}` : "No"}</p>
                <p>CurrentAnswers: {JSON.stringify(currentAnswers)}</p>
                <p>OtherInputValues: {JSON.stringify(otherInputValues)}</p>
                <p>CurrentVisibleIndex: {currentVisibleIndex} (Original Index of Q: {currentQuestionToRender?.originalIndex ?? 'N/A'})</p>
                <p>Visible Original Indices: {JSON.stringify(visibleQuestionIndices)}</p>
                <p>Resume Token (State): {currentResumeToken || "None"}</p>
                <p>Collector Settings (State): {JSON.stringify(collectorSettings)}</p>
                <p>Save & Continue Enabled (Effective): {saveAndContinueEnabled.toString()}</p>
                <p>Back Button Enabled (Effective): {(collectorSettings?.allowBackButton ?? true).toString()}</p>
            </div>
        </div>
    );
}

export default SurveyTakingPage;
// ----- END OF UPDATED FILE -----