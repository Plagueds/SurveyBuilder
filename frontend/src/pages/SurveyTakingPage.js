// frontend/src/pages/SurveyTakingPage.js
// ----- START OF RESTORED FILE -----
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
// import { toast } from 'react-toastify'; // Uncomment for actual toast notifications
import styles from './SurveyTakingPage.module.css'; // Assuming you have this CSS module

// --- Helper Functions & Stubs (from testing, adapt or replace with real implementations) ---
const ensureArray = (value) => (Array.isArray(value) ? value : (value !== undefined && value !== null ? [value] : []));

// Placeholder for actual survey logic evaluation
const evaluateSurveyLogic = (logicRules, answers, questions, questionIdToOriginalIndexMap, actionType = 'visibility') => {
    console.log(`[Debug STM] evaluateSurveyLogic STUB CALLED for ${actionType}`);
    // In a real scenario, this would evaluate complex logic
    // For visibility, it might return an array of question IDs/indices to show/hide
    // For disqualification/action, it might return an object indicating the action
    return null;
};

// API service stub (replace with your actual API service)
const surveyApi = {
    getSurveyPublic: async (surveyId) => {
        console.log(`[Debug STM] surveyApi.getSurveyPublic STUB CALLED for ${surveyId}`);
        await new Promise(resolve => setTimeout(resolve, 100)); // Simulate network delay
        // Return a mock survey structure
        return {
            success: true,
            survey: {
                _id: surveyId,
                title: "Sample Survey Title (Stubbed)",
                description: "This is a stubbed survey description.",
                questions: [
                    // Add mock questions if needed for testing full functionality
                    { _id: 'q1', type: 'text', text: 'What is your name?', required: true, originalIndex: 0 },
                    { _id: 'q2', type: 'single-select', text: 'What is your favorite color?', options: [{text: 'Red', value: 'red'}, {text: 'Blue', value: 'blue'}], required: false, originalIndex: 1 },
                ],
                settings: {
                    allowResume: true,
                    showProgressBar: true,
                    // ... other settings
                },
                // ... other survey fields
            },
            collector: { /* collector settings */ }
        };
    },
    savePartialResponse: async (surveyId, collectorId, resumeToken, answers, currentQuestionId) => {
        console.log('[Debug STM] surveyApi.savePartialResponse STUB CALLED with:', { surveyId, collectorId, resumeToken, answers, currentQuestionId });
        await new Promise(resolve => setTimeout(resolve, 100));
        const newResumeToken = resumeToken || `fakeToken_${Date.now()}`;
        console.log(`[Debug STM] surveyApi.savePartialResponse STUB: Generated/Kept resumeToken: ${newResumeToken}`);
        return { success: true, resumeToken: newResumeToken, message: 'Partial response saved (stubbed).' };
    },
    submitResponse: async (surveyId, collectorId, answers, resumeToken) => {
        console.log('[Debug STM] surveyApi.submitResponse STUB CALLED with:', { surveyId, collectorId, answers, resumeToken });
        await new Promise(resolve => setTimeout(resolve, 100));
        return { success: true, submissionId: `sub_${Date.now()}`, message: 'Response submitted (stubbed).' };
    }
    // ... other API methods
};
// --- End Helper Functions & Stubs ---

function SurveyTakingPage() {
    console.log('[Debug STM] SurveyTakingPage function component body executing. (Top)');
    const { surveyId, collectorId: routeCollectorIdentifier, resumeToken: routeResumeToken } = useParams();
    const location = useLocation();
    const navigate = useNavigate();

    // --- State Variables ---
    const [survey, setSurvey] = useState(null);
    const [originalQuestions, setOriginalQuestions] = useState([]);
    const [currentAnswers, setCurrentAnswers] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentVisibleIndex, setCurrentVisibleIndex] = useState(0);
    const [visibleQuestionIndices, setVisibleQuestionIndices] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDisqualified, setIsDisqualified] = useState(false);
    const [disqualificationMessage, setDisqualificationMessage] = useState('');
    const [otherInputValues, setOtherInputValues] = useState({});
    const [currentCollectorIdentifier, setCurrentCollectorIdentifier] = useState(routeCollectorIdentifier);
    const [currentResumeToken, setCurrentResumeToken] = useState(routeResumeToken);
    const [isSavingPartial, setIsSavingPartial] = useState(false);
    const [autoAdvanceState, setAutoAdvanceState] = useState(false); // Example state for auto-advance feature
    const autoAdvanceTimeoutRef = useRef(null);
    const [customVariables, setCustomVariables] = useState({}); // For query params

    // Constants
    const NA_VALUE_INTERNAL = '__NA__'; // Represents "Not Applicable" or intentionally skipped
    const OTHER_VALUE_INTERNAL = '__OTHER__'; // Represents the "Other" option in multiple choice/checkbox

    // --- Memoized Derived State ---
    const questionsById = useMemo(() => {
        console.log('[Debug STM] questionsById CALC.');
        return originalQuestions.reduce((acc, q) => {
            acc[q._id] = q;
            return acc;
        }, {});
    }, [originalQuestions]);

    const questionsInCurrentOrder = useMemo(() => {
        console.log('[Debug STM] questionsInCurrentOrder CALC.');
        // This would typically involve randomization logic if enabled in survey settings
        return originalQuestions; // Simplified: assuming original order for now
    }, [originalQuestions]);
    
    const questionIdToOriginalIndexMap = useMemo(() => {
        console.log('[Debug STM] questionIdToOriginalIndexMap CALC.');
        return originalQuestions.reduce((acc, q, idx) => {
            acc[q._id] = q.originalIndex !== undefined ? q.originalIndex : idx;
            return acc;
        }, {});
    }, [originalQuestions]);

    const currentQuestionToRender = useMemo(() => {
        console.log('[Debug STM] currentQToRenderMemoized CALC.');
        if (isLoading || !survey || visibleQuestionIndices.length === 0 || currentVisibleIndex >= visibleQuestionIndices.length) {
            return null;
        }
        const questionIndexInOriginal = visibleQuestionIndices[currentVisibleIndex];
        return questionsInCurrentOrder[questionIndexInOriginal];
    }, [isLoading, survey, visibleQuestionIndices, currentVisibleIndex, questionsInCurrentOrder]);

    const isSubmitState = useMemo(() => {
        console.log('[Debug STM] isSubmitStateDerived CALC.');
        if (isLoading || !survey) return false;
        return currentVisibleIndex >= visibleQuestionIndices.length -1 && visibleQuestionIndices.length > 0;
    }, [isLoading, survey, visibleQuestionIndices, currentVisibleIndex]);


    console.log('[Debug STM] After useMemo hooks, before useEffect hooks.');
    // --- Effects ---
    // Initial data fetching (simplified)
    useEffect(() => {
        console.log('[Debug STM] useEffect (Initial Data Load) ENTERED.');
        setIsLoading(true);
        // Simulating data fetching
        surveyApi.getSurveyPublic(surveyId)
            .then(response => {
                if (response.success) {
                    setSurvey(response.survey);
                    setOriginalQuestions(response.survey.questions || []);
                    // Initialize visibleQuestionIndices based on all questions for this stub
                    setVisibleQuestionIndices((response.survey.questions || []).map((_, idx) => idx));
                    setError(null);
                } else {
                    setError(response.message || "Failed to load survey.");
                }
            })
            .catch(err => {
                console.error("Error fetching survey:", err);
                setError("An error occurred while loading the survey.");
            })
            .finally(() => {
                setIsLoading(false);
                console.log('[Debug STM] useEffect (Initial Data Load) COMPLETED.');
            });
    }, [surveyId]);
    
    // Example useEffect for query parameters to custom variables
    useEffect(() => {
        console.log('[Debug STM] useEffect (CustomVars from Query) ENTERED.');
        const searchParams = new URLSearchParams(location.search);
        const extractedVars = {};
        searchParams.forEach((value, key) => {
            if (key.startsWith('cv_')) { // Convention for custom variables
                extractedVars[key.substring(3)] = value;
            }
        });
        setCustomVariables(extractedVars);
        console.log('[Debug STM] Custom Variables Set:', extractedVars);
    }, [location.search]);


    console.log('[Debug STM] After useEffect hooks, before useCallback hooks.');
    // --- Callbacks ---

    const evaluateDisabled = useCallback((questionId) => {
        console.log('[Debug STM] evaluateDisabled DEFINITION - Attempting to log.');
        // Placeholder: Real logic would check survey.logic.disabled conditions
        // const question = questionsById[questionId];
        // evaluateSurveyLogic(question?.logic?.disabled, currentAnswers, ...);
        return false; // Default to not disabled
    }, [/* questionsById, currentAnswers, survey?.logic */]);

    const validateQuestion = useCallback((question, answer) => {
        console.log('[Debug STM] validateQuestion DEFINITION - Attempting to log.');
        if (!question) return true; // Or handle as error

        const { required, type } = question;
        const isEmpty = answer === undefined || answer === null || answer === '' || (Array.isArray(answer) && answer.length === 0);

        if (required && isEmpty) {
            // Check if "Not Applicable" is selected for a required question (if NA_VALUE_INTERNAL is part of options)
            // This part needs more context on how NA_VALUE_INTERNAL is handled in options
            if (answer === NA_VALUE_INTERNAL) return true; // Assuming NA is a valid "skip" for required
            return false; // Required and empty (and not NA)
        }
        
        // Type-specific validation (basic examples)
        if (type === 'email' && answer && !/\S+@\S+\.\S+/.test(answer)) return false;
        // Add more complex validation as needed
        
        // "Other" field validation
        if (Array.isArray(answer) && answer.includes(OTHER_VALUE_INTERNAL)) {
            const otherValueKey = `${question._id}_other`;
            if (question.required && (!otherInputValues[otherValueKey] || otherInputValues[otherValueKey].trim() === '')) {
                 console.log(`[Debug STM] validateQuestion: Other field for ${question._id} is required but empty.`);
                return false; // "Other" is selected, but the text input is empty for a required question
            }
        }
        return true;
    }, [otherInputValues, NA_VALUE_INTERNAL, OTHER_VALUE_INTERNAL]);

    const evaluateGlobalLogic = useCallback((actionType = 'visibility') => {
        console.log('[Debug STM] evaluateGlobalLogic DEFINITION - Attempting to log.');
        if (!survey || !survey.logic || !survey.logic.global) return;
        // const result = evaluateSurveyLogic(survey.logic.global, currentAnswers, questionsById, questionIdToOriginalIndexMap, actionType);
        // Process result: update visibleQuestionIndices, set disqualification, etc.
        console.log(`[Debug STM] evaluateGlobalLogic executed for ${actionType}.`);
    }, [survey, currentAnswers, questionsById, questionIdToOriginalIndexMap]);

    const evaluateActionLogic = useCallback((questionId, triggerType = 'onAnswer') => {
        console.log('[Debug STM] evaluateActionLogic DEFINITION - Attempting to log.');
        const question = questionsById[questionId];
        if (!question || !question.logic || !question.logic[triggerType]) return;
        // const result = evaluateSurveyLogic(question.logic[triggerType], currentAnswers, questionsById, questionIdToOriginalIndexMap, 'action');
        // Process result for actions like jump to question, disqualify etc.
        console.log(`[Debug STM] evaluateActionLogic for QID ${questionId} on ${triggerType} executed.`);
    }, [questionsById, currentAnswers, questionIdToOriginalIndexMap]);

    const handleNext = useCallback(() => {
        console.log('[Debug STM] handleNext DEFINITION - Attempting to log.');
        console.log('[Debug STM] handleNext CALLED.');
        if (currentQuestionToRender && !validateQuestion(currentQuestionToRender, currentAnswers[currentQuestionToRender._id])) {
            // toast.error("Please answer the current question correctly."); // Uncomment for actual toast
            console.error("[Debug STM] Validation failed for current question.");
            return;
        }
        if (!isSubmitState) {
            setCurrentVisibleIndex(prev => prev + 1);
            evaluateGlobalLogic('visibility'); // Re-evaluate visibility after moving
            if (currentQuestionToRender) evaluateActionLogic(currentQuestionToRender._id, 'onNext');
        } else {
            // This would be the handleSubmit logic
            console.log("[Debug STM] Attempting to submit (called from handleNext on last question).");
            // handleSubmit(); // Call actual submit handler
        }
    }, [currentVisibleIndex, visibleQuestionIndices, currentQuestionToRender, validateQuestion, currentAnswers, isSubmitState, setCurrentVisibleIndex, evaluateGlobalLogic, evaluateActionLogic /*, handleSubmit */]);

    const handleInputChange = useCallback((questionId, value) => {
        console.log('[Debug STM] handleInputChange DEFINITION - Attempting to log.');
        setCurrentAnswers(prev => ({ ...prev, [questionId]: value }));
        evaluateActionLogic(questionId, 'onAnswer');
        // Optional: auto-advance if survey setting enabled and question is valid
        // if (autoAdvanceState && validateQuestion(questionsById[questionId], value)) {
        //     clearTimeout(autoAdvanceTimeoutRef.current);
        //     autoAdvanceTimeoutRef.current = setTimeout(handleNext, 500);
        // }
        console.log(`[Debug STM] handleInputChange CALLED - QID: ${questionId}, Value: ${value}`);
    }, [setCurrentAnswers, evaluateActionLogic /*, autoAdvanceState, validateQuestion, questionsById, handleNext */]);

    const handleCheckboxChange = useCallback((questionId, optionValue, isChecked) => {
        console.log('[Debug STM] handleCheckboxChange DEFINITION - Attempting to log.');
        setCurrentAnswers(prevAnswers => {
            const currentSelection = prevAnswers[questionId] ? [...ensureArray(prevAnswers[questionId])] : [];
            let newSelection;
            if (isChecked) {
                newSelection = [...currentSelection, optionValue];
            } else {
                newSelection = currentSelection.filter(val => val !== optionValue);
            }
            // If "Other" is unchecked, clear its corresponding text input
            if (optionValue === OTHER_VALUE_INTERNAL && !isChecked) {
                setOtherInputValues(prevOther => ({ ...prevOther, [`${questionId}_other`]: '' }));
            }
            return { ...prevAnswers, [questionId]: newSelection };
        });
        evaluateActionLogic(questionId, 'onAnswer');
        console.log(`[Debug STM] handleCheckboxChange CALLED - QID: ${questionId}, Option: ${optionValue}, Checked: ${isChecked}`);
    }, [OTHER_VALUE_INTERNAL, setCurrentAnswers, setOtherInputValues, evaluateActionLogic]);

    const handleOtherInputChange = useCallback((questionIdForOtherField, value) => { // e.g., "q1_other"
        console.log('[Debug STM] handleOtherInputChange DEFINITION - Attempting to log.');
        setOtherInputValues(prev => ({ ...prev, [questionIdForOtherField]: value }));

        const mainQuestionId = questionIdForOtherField.replace('_other', '');
        // If user types in "other" text field, ensure the "Other" checkbox is selected
        if (value && value.trim() !== '') {
            setCurrentAnswers(prevAnswers => {
                const currentSelection = prevAnswers[mainQuestionId] ? [...ensureArray(prevAnswers[mainQuestionId])] : [];
                if (!currentSelection.includes(OTHER_VALUE_INTERNAL)) {
                    return { ...prevAnswers, [mainQuestionId]: [...currentSelection, OTHER_VALUE_INTERNAL] };
                }
                return prevAnswers;
            });
        }
        // evaluateActionLogic(mainQuestionId, 'onAnswer'); // Or a more specific trigger
        console.log(`[Debug STM] handleOtherInputChange CALLED - Key: ${questionIdForOtherField}, Value: ${value}`);
    }, [OTHER_VALUE_INTERNAL, setCurrentAnswers, setOtherInputValues /*, evaluateActionLogic */]);
    
    const handlePrevious = useCallback(() => {
        console.log('[Debug STM] handlePrevious DEFINITION - Attempting to log.');
        if (currentVisibleIndex > 0) {
            setCurrentVisibleIndex(prev => prev - 1);
            evaluateGlobalLogic('visibility');
        } else {
            // Optionally, navigate back to survey list or dashboard if allowed
            // navigate(`/surveys`);
            console.log('[Debug STM] Already at the first question.');
        }
        console.log('[Debug STM] handlePrevious CALLED. CurrentVisibleIndex now (potentially):', currentVisibleIndex -1);
    }, [currentVisibleIndex, setCurrentVisibleIndex, evaluateGlobalLogic /*, navigate */]);

    const handleSavePartialResponse = useCallback(async () => {
        console.log('[Debug STM] handleSavePartialResponse DEFINITION - Attempting to log.');
        if (!surveyId || isSavingPartial || !survey?.settings?.allowResume) {
            console.log('[Debug STM] handleSavePartialResponse: Conditions not met (no surveyId, already saving, or resume not allowed). Aborting.');
            return;
        }
        setIsSavingPartial(true);
        const qToRender = currentQuestionToRender; // Get current question before async
        const currentQIdForSave = qToRender ? qToRender._id : (questionsInCurrentOrder[visibleQuestionIndices[Math.max(0, currentVisibleIndex -1)]]?._id);

        try {
            const result = await surveyApi.savePartialResponse(
                surveyId,
                currentCollectorIdentifier,
                currentResumeToken,
                currentAnswers,
                currentQIdForSave 
            );
            if (result.success) {
                setCurrentResumeToken(result.resumeToken);
                // toast.success(result.message || 'Partial response saved!'); // Uncomment for actual toast
                console.log('[Debug STM] handleSavePartialResponse: Save successful.', result);
            } else {
                // toast.error(result.message || 'Failed to save partial response.'); // Uncomment for actual toast
                console.error('[Debug STM] handleSavePartialResponse: Save failed.', result);
            }
        } catch (err) {
            // toast.error('An error occurred while saving.'); // Uncomment for actual toast
            console.error('[Debug STM] handleSavePartialResponse: Save error.', err);
        } finally {
            setIsSavingPartial(false);
        }
    }, [
        surveyId, currentCollectorIdentifier, currentResumeToken, currentAnswers, 
        isSavingPartial, survey?.settings?.allowResume, currentQuestionToRender,
        questionsInCurrentOrder, visibleQuestionIndices, currentVisibleIndex, // For currentQIdForSave
        setIsSavingPartial, setCurrentResumeToken
    ]);

    const renderProgressBar = useCallback(() => {
        console.log('[Debug STM] renderProgressBar DEFINITION - Attempting to log.');
        if (!survey || !survey.settings?.showProgressBar || visibleQuestionIndices.length === 0) {
            console.log('[Debug STM] renderProgressBar: Conditions not met for rendering (no survey, progress bar disabled, or no visible questions).');
            return null;
        }
        // Ensure currentVisibleIndex does not exceed bounds for calculation
        const safeCurrentVisibleIndex = Math.min(currentVisibleIndex, visibleQuestionIndices.length - 1);
        const progress = Math.max(0, Math.min(100, ((safeCurrentVisibleIndex + 1) / visibleQuestionIndices.length) * 100));
        
        console.log(`[Debug STM] renderProgressBar: Calculated progress ${progress}% (Index: ${safeCurrentVisibleIndex}, Total: ${visibleQuestionIndices.length})`);
        return (
            <div className={styles.progressBarContainer} aria-hidden="true">
                <div className={styles.progressBarFill} style={{ width: `${progress}%` }}>
                    {/* Optionally, display text: Math.round(progress) + '%' */}
                </div>
            </div>
        );
    }, [survey, visibleQuestionIndices, currentVisibleIndex]);

    console.log('[Debug STM] After useCallback hooks, before main render logic.');

    // --- Render Logic ---
    if (isLoading) {
        return <div className={styles.loadingContainer}>Loading survey...</div>;
    }
    if (error) {
        return <div className={styles.errorContainer}>Error: {error}</div>;
    }
    if (!survey) {
        return <div className={styles.errorContainer}>Survey not found or failed to load.</div>;
    }
    if (isDisqualified) {
        return (
            <div className={styles.disqualifiedContainer}>
                <h2>Thank You</h2>
                <p>{disqualificationMessage || "Thank you for your time, but you do not qualify for the remainder of this survey."}</p>
            </div>
        );
    }

    // Call renderProgressBar to get the element for rendering
    const progressBarElement = renderProgressBar(); 

    return (
        <div className={styles.surveyContainer}>
            <header className={styles.surveyHeader}>
                <h1>{survey.title}</h1>
                <p>{survey.description}</p>
                {progressBarElement}
            </header>

            {/* Placeholder for where Question components would be rendered */}
            {currentQuestionToRender ? (
                <div className={styles.questionArea}>
                    <h3>Question: {currentQuestionToRender.text}</h3>
                    <p>(Question Type: {currentQuestionToRender.type}) - Render actual input fields here</p>
                    {/* Example: Simple text input for demonstration */}
                    {currentQuestionToRender.type === 'text' && (
                        <input 
                            type="text"
                            value={currentAnswers[currentQuestionToRender._id] || ''}
                            onChange={(e) => handleInputChange(currentQuestionToRender._id, e.target.value)}
                            placeholder="Type your answer"
                        />
                    )}
                    {/* Add rendering for other question types */}
                </div>
            ) : (
                !isSubmitting && <p>End of survey or no questions to display.</p>
            )}
            
            {/* Add Thank You Message component/view on successful submission */}

            <footer className={styles.surveyNavigation}>
                {currentVisibleIndex > 0 && (
                    <button onClick={handlePrevious} disabled={isSubmitting || isSavingPartial}>Previous</button>
                )}
                {!isSubmitState && (
                    <button onClick={handleNext} disabled={isSubmitting || isSavingPartial}>Next</button>
                )}
                {isSubmitState && (
                    <button /* onClick={handleSubmit} */ disabled={isSubmitting || isSavingPartial}>
                        {isSubmitting ? 'Submitting...' : 'Submit'}
                    </button>
                )}
                {survey.settings?.allowResume && (
                    <button onClick={handleSavePartialResponse} disabled={isSavingPartial || isSubmitting}>
                        {isSavingPartial ? 'Saving...' : 'Save and Resume Later'}
                    </button>
                )}
            </footer>
            <div className={styles.debugInfo}>
                <p>CurrentAnswers: {JSON.stringify(currentAnswers)}</p>
                <p>OtherInputValues: {JSON.stringify(otherInputValues)}</p>
                <p>CurrentVisibleIndex: {currentVisibleIndex}</p>
                <p>Resume Token: {currentResumeToken || "None"}</p>
            </div>
        </div>
    );
}

export default SurveyTakingPage;
// ----- END OF RESTORED FILE -----