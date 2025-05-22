// frontend/src/pages/SurveyTakingPage.js
// ----- START OF UPDATED FILE (v1.6 - ProgressBar uses collectorSettings for style/position) -----
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import ReCAPTCHA from "react-google-recaptcha";
import { toast } from 'react-toastify';
import surveyApi from '../api/surveyApi';
import styles from './SurveyTakingPage.module.css';

// Question component imports
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
const formatQuestionNumber = (index, format, customPrefix) => { const number = index + 1; switch (format) { case 'abc': return String.fromCharCode(96 + number); case 'ABC': return String.fromCharCode(64 + number); case 'roman': const romanMap = { M: 1000, CM: 900, D: 500, CD: 400, C: 100, XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1 }; let roman = ''; let num = number; for (let key in romanMap) { while (num >= romanMap[key]) { roman += key; num -= romanMap[key]; } } return roman || String(number); case 'custom': return `${customPrefix || ''}${number}`; case '123': default: return `${number}.`; } };

function SurveyTakingPage() {
    const { surveyId, collectorId, resumeToken: routeResumeToken } = useParams();
    const location = useLocation();
    const navigate = useNavigate();

    const [initialSurveyTitle, setInitialSurveyTitle] = useState('');
    const [collectorSettings, setCollectorSettings] = useState(null); // Will hold merged settings
    const [survey, setSurvey] = useState(null); // Holds full survey structure
    const [originalQuestions, setOriginalQuestions] = useState([]);
    const [currentAnswers, setCurrentAnswers] = useState({});
    const [otherInputValues, setOtherInputValues] = useState({});

    const [isLoadingSurvey, setIsLoadingSurvey] = useState(true);
    const [surveyError, setSurveyError] = useState(null);

    const [currentVisibleIndex, setCurrentVisibleIndex] = useState(0);
    const [visibleQuestionIndices, setVisibleQuestionIndices] = useState([]); // Stores originalIndex of visible questions
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submissionError, setSubmissionError] = useState(null);

    const [currentResumeToken, setCurrentResumeToken] = useState(routeResumeToken || null); // Initialize with route token
    const [isSavingAndContinueLater, setIsSavingAndContinueLater] = useState(false);
    const [showResumeCodeModal, setShowResumeCodeModal] = useState(false);
    const [generatedResumeCode, setGeneratedResumeCode] = useState('');
    const [emailForReminder, setEmailForReminder] = useState('');
    const [promptForEmailOnSave, setPromptForEmailOnSave] = useState(false);

    const [clientSessionId, setClientSessionId] = useState(null);
    const [recaptchaToken, setRecaptchaToken] = useState(null);
    const recaptchaRef = useRef(null);

    const [showValidationModal, setShowValidationModal] = useState(false);
    const [validationModalMessage, setValidationModalMessage] = useState('');

    const autoAdvanceTimeoutRef = useRef(null);
    const OTHER_VALUE_INTERNAL = '__OTHER__';

    useEffect(() => { 
        let currentSessionId = sessionStorage.getItem(`surveyClientSessionId_${surveyId}_${collectorId}`);
        if (!currentSessionId) {
            currentSessionId = uuidv4();
            sessionStorage.setItem(`surveyClientSessionId_${surveyId}_${collectorId}`, currentSessionId);
            console.log('[SurveyTakingPage] New clientSessionId generated:', currentSessionId);
        } else {
            console.log('[SurveyTakingPage] Using existing clientSessionId from sessionStorage:', currentSessionId);
        }
        setClientSessionId(currentSessionId);
    }, [surveyId, collectorId]);

    useEffect(() => {
        // This effect primarily handles settings passed from PublicSurveyHandler (for code resume)
        // or initial title. Actual survey data (questions, full settings for email resume) comes from getSurveyById.
        const stateFromLocation = location.state;
        if (stateFromLocation) {
            if (stateFromLocation.surveyTitle && stateFromLocation.surveyTitle !== initialSurveyTitle) {
                setInitialSurveyTitle(stateFromLocation.surveyTitle);
            }
            // If PublicSurveyHandler passes collectorSettings (e.g., after resumeSurveyWithCode API call)
            if (stateFromLocation.collectorSettings) {
                 const newSettingsString = JSON.stringify(stateFromLocation.collectorSettings);
                 const currentSettingsString = JSON.stringify(collectorSettings);
                 if (newSettingsString !== currentSettingsString) {
                    console.log("[SurveyTakingPage] Applying collectorSettings from location state:", stateFromLocation.collectorSettings);
                    setCollectorSettings(stateFromLocation.collectorSettings);
                    setRecaptchaToken(null); // Reset reCAPTCHA if settings change
                    if (recaptchaRef.current) recaptchaRef.current.reset();
                 }
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.state]); // Removed initialSurveyTitle, collectorSettings from deps to avoid loops with main fetch

    const questionsById = useMemo(() => { 
        if (!originalQuestions || originalQuestions.length === 0) return {}; 
        return originalQuestions.reduce((acc, q) => { acc[q._id] = q; return acc; }, {}); 
    }, [originalQuestions]);

    const currentQuestionToRender = useMemo(() => { 
        if (isLoadingSurvey || !survey || !originalQuestions.length || !visibleQuestionIndices.length || currentVisibleIndex < 0 || currentVisibleIndex >= visibleQuestionIndices.length) { return null; } 
        const originalIndexToFind = visibleQuestionIndices[currentVisibleIndex]; 
        const question = originalQuestions.find(q => q.originalIndex === originalIndexToFind); return question; 
    }, [isLoadingSurvey, survey, originalQuestions, visibleQuestionIndices, currentVisibleIndex]);

    const isSubmitState = useMemo(() => { 
        if (isLoadingSurvey || !survey || !visibleQuestionIndices.length) return false; 
        return currentVisibleIndex >= visibleQuestionIndices.length - 1; 
    }, [isLoadingSurvey, survey, visibleQuestionIndices, currentVisibleIndex]);

    useEffect(() => { 
        return () => { if (autoAdvanceTimeoutRef.current) { clearTimeout(autoAdvanceTimeoutRef.current); } }; 
    }, []);

    useEffect(() => { 
        if (!surveyId) { setSurveyError("Survey ID missing."); setIsLoadingSurvey(false); return; }
        if (!collectorId) { setSurveyError("Collector ID missing."); setIsLoadingSurvey(false); return; }

        setIsLoadingSurvey(true);
        setSurveyError(null);
        setSubmissionError(null);
        setShowValidationModal(false);
        setValidationModalMessage('');
        
        const fetchOptions = { forTaking: 'true', collectorId };
        
        const isResumingWithCodeFromState = location.state?.isResumingWithCode;
        const partialResponseFromState = location.state?.partialResponse;
        let activeResumeToken = routeResumeToken || currentResumeToken; // Prefer URL token if present

        if (isResumingWithCodeFromState && partialResponseFromState?.resumeToken) {
            activeResumeToken = partialResponseFromState.resumeToken;
            if (activeResumeToken !== currentResumeToken) {
                 setCurrentResumeToken(activeResumeToken);
            }
        }
        if (activeResumeToken) {
            fetchOptions.resumeToken = activeResumeToken;
        }

        console.log(`[SurveyTakingPage Fetch] surveyId: ${surveyId}, collectorId: ${collectorId}, resumeToken for API: ${fetchOptions.resumeToken}`);

        const abortController = new AbortController();
        surveyApi.getSurveyById(surveyId, { ...fetchOptions, signal: abortController.signal })
            .then(response => {
                if (response.success && response.data) {
                    setSurvey(response.data);
                    const fetchedQuestions = response.data.questions || [];
                    const questionsWithIndex = fetchedQuestions.map((q, idx) => ({ ...q, originalIndex: typeof q.originalIndex === 'number' ? q.originalIndex : idx }));
                    setOriginalQuestions(questionsWithIndex);

                    const indices = questionsWithIndex.map(q => q.originalIndex).sort((a, b) => a - b);
                    setVisibleQuestionIndices(indices);
                    
                    // Merge collectorSettings from API with survey's behaviorNavigation settings
                    // API response.data.collectorSettings should be the definitive source from backend logic
                    const apiCollectorSettings = response.data.collectorSettings || {};
                    const surveyBehaviorNav = response.data.settings?.behaviorNavigation || {};
                    const mergedSettings = {
                        ...surveyBehaviorNav, // Survey-level defaults
                        ...apiCollectorSettings, // Collector-level overrides
                        // Explicitly ensure all progress bar settings are present
                        progressBarEnabled: apiCollectorSettings.progressBarEnabled ?? surveyBehaviorNav.progressBarEnabled ?? false,
                        progressBarStyle: apiCollectorSettings.progressBarStyle || surveyBehaviorNav.progressBarStyle || 'percentage',
                        progressBarPosition: apiCollectorSettings.progressBarPosition || surveyBehaviorNav.progressBarPosition || 'top',
                        allowResume: apiCollectorSettings.saveAndContinueEnabled ?? surveyBehaviorNav.saveAndContinueEnabled ?? false, // Standardize to allowResume
                    };
                    
                    // Only update collectorSettings if they are different or not yet set from location.state
                    // This prioritizes settings from getSurveyById if location.state didn't provide them or if they differ
                    const newSettingsString = JSON.stringify(mergedSettings);
                    const currentSettingsString = JSON.stringify(collectorSettings);
                    if (newSettingsString !== currentSettingsString) {
                        console.log("[SurveyTakingPage] Applying merged/API collectorSettings:", mergedSettings);
                        setCollectorSettings(mergedSettings);
                    }


                    const effectivePartialResponse = isResumingWithCodeFromState && partialResponseFromState 
                                                    ? partialResponseFromState 
                                                    : response.data.partialResponse;

                    if (effectivePartialResponse) {
                        console.log("[SurveyTakingPage] Processing effectivePartialResponse:", effectivePartialResponse);
                        setCurrentAnswers(effectivePartialResponse.answers || {});
                        setOtherInputValues(effectivePartialResponse.otherInputValues || {});
                        const partialVisibleIndex = effectivePartialResponse.currentVisibleIndex;
                        if (typeof partialVisibleIndex === 'number' && partialVisibleIndex >= 0 && partialVisibleIndex < indices.length) {
                            setCurrentVisibleIndex(partialVisibleIndex);
                        } else if (typeof partialVisibleIndex === 'number') {
                             console.warn(`[SurveyTakingPage] Resumed currentVisibleIndex ${partialVisibleIndex} is out of bounds for ${indices.length} visible questions. Resetting to 0.`);
                             setCurrentVisibleIndex(0);
                        }

                        if(effectivePartialResponse.resumeToken && effectivePartialResponse.resumeToken !== currentResumeToken) {
                           setCurrentResumeToken(effectivePartialResponse.resumeToken);
                        }
                        if (effectivePartialResponse.sessionId && effectivePartialResponse.sessionId !== clientSessionId) {
                            setClientSessionId(effectivePartialResponse.sessionId);
                            sessionStorage.setItem(`surveyClientSessionId_${surveyId}_${collectorId}`, effectivePartialResponse.sessionId);
                             console.log("[SurveyTakingPage] Adopted sessionId from partial response:", effectivePartialResponse.sessionId);
                        }
                    } else if (fetchOptions.resumeToken && !isResumingWithCodeFromState) { 
                        console.warn(`[SurveyTakingPage] URL resume token ${fetchOptions.resumeToken} provided, but no partial response data found from API. Starting fresh.`);
                        setCurrentResumeToken(null); 
                        setCurrentAnswers({});
                        setOtherInputValues({});
                        setCurrentVisibleIndex(0);
                        toast.info("Could not resume previous session. Starting a new session.", { autoClose: 7000 });
                    }

                    if (response.data.title && response.data.title !== initialSurveyTitle && !initialSurveyTitle) {
                        // Set initial title only if not already set by location.state to avoid flicker
                        setInitialSurveyTitle(response.data.title);
                    }
                    if (recaptchaRef.current && collectorSettings?.enableRecaptcha !== mergedSettings.enableRecaptcha) {
                        recaptchaRef.current.reset(); // Reset reCAPTCHA if its enabled status changes
                        setRecaptchaToken(null);
                    }

                } else {
                    setSurveyError(response.message || "Failed to load survey details.");
                    setSurvey(null);
                }
            })
            .catch(err => { if (err.name === 'AbortError' || err.message === 'canceled') { console.log('[SurveyTakingPage - fetch effect] Fetch for getSurveyById aborted/canceled.'); } else { console.error("[SurveyTakingPage Fetch Catch] Error fetching survey details (getSurveyById):", err); setSurveyError(err.message || "Error loading survey details."); setSurvey(null); } })
            .finally(() => { setIsLoadingSurvey(false); });
        return () => { abortController.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [surveyId, collectorId, routeResumeToken, location.state?.isResumingWithCode]); // location.state?.partialResponse removed to avoid re-fetch if only answers change in state object. isResumingWithCode is a better trigger. currentResumeToken also removed to let activeResumeToken logic handle it.

    const validateQuestion = useCallback((question) => { if (!question) return true; const answerValue = currentAnswers[question._id]; const otherText = otherInputValues[`${question._id}_other`]; const triggerValidationModal = (message) => { setValidationModalMessage(message); setShowValidationModal(true); return false; }; if (question.requiredSetting === 'required') { let isEmpty = false; if (answerValue === undefined || answerValue === null || String(answerValue).trim() === '') { if (!Array.isArray(answerValue) || answerValue.length === 0) { isEmpty = true; } } else if (Array.isArray(answerValue) && answerValue.length === 0) { isEmpty = true; } if (isEmpty) { if (question.addOtherOption && question.requireOtherIfSelected && ((Array.isArray(answerValue) && answerValue.includes(OTHER_VALUE_INTERNAL)) || answerValue === OTHER_VALUE_INTERNAL) && (otherText === undefined || otherText === null || String(otherText).trim() === '')) { return triggerValidationModal(`Please provide text for the "Other" option for "${question.text || 'this question'}".`); } if (!question.addOtherOption || !((Array.isArray(answerValue) && answerValue.includes(OTHER_VALUE_INTERNAL)) || answerValue === OTHER_VALUE_INTERNAL)) { return triggerValidationModal(`This question ("${question.text || 'this question'}") is required.`); } } } if (question.addOtherOption && question.requireOtherIfSelected) { const otherIsSelected = Array.isArray(answerValue) ? answerValue.includes(OTHER_VALUE_INTERNAL) : answerValue === OTHER_VALUE_INTERNAL; if (otherIsSelected && (otherText === undefined || otherText === null || String(otherText).trim() === '')) { return triggerValidationModal(`Please provide text for the "Other" option for "${question.text || 'this question'}".`); } } setShowValidationModal(false); setValidationModalMessage(''); return true; }, [currentAnswers, otherInputValues, OTHER_VALUE_INTERNAL]);
    const handleSubmit = useCallback(async () => { if (isSubmitting) return; if (currentQuestionToRender && !validateQuestion(currentQuestionToRender)) { return; } setSubmissionError(null); console.log('[SurveyTakingPage - handleSubmit] Attempting submission...'); if (!surveyId || !collectorId) { setSubmissionError("Cannot submit, survey or collector ID is missing."); return; } let currentSubmitClientSessionId = clientSessionId; if (!currentSubmitClientSessionId) { console.error("[SurveyTakingPage - handleSubmit] CRITICAL: clientSessionId is missing!"); let fallbackSessionId = sessionStorage.getItem(`surveyClientSessionId_${surveyId}_${collectorId}`); if (!fallbackSessionId) fallbackSessionId = uuidv4(); setClientSessionId(fallbackSessionId); sessionStorage.setItem(`surveyClientSessionId_${surveyId}_${collectorId}`, fallbackSessionId); currentSubmitClientSessionId = fallbackSessionId; } if (collectorSettings?.enableRecaptcha && !recaptchaToken) { setValidationModalMessage("Please complete the reCAPTCHA verification before submitting."); setShowValidationModal(true); setIsSubmitting(false); return; } setIsSubmitting(true); const relativeFetchUrl = `/api/surveys/${surveyId}/submit`; const payloadToSubmit = { collectorId, answers: currentAnswers, otherInputValues, resumeToken: currentResumeToken, clientSessionId: currentSubmitClientSessionId, recaptchaTokenV2: recaptchaToken }; const authToken = localStorage.getItem('token'); console.log('[SurveyTakingPage - handleSubmit] Fetch Payload:', payloadToSubmit); try { const response = await fetch(relativeFetchUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(authToken && { 'Authorization': `Bearer ${authToken}` }) }, body: JSON.stringify(payloadToSubmit) }); const responseText = await response.text(); let result; try { result = JSON.parse(responseText); } catch (parseError) { console.error('[SurveyTakingPage - handleSubmit] Error parsing JSON response:', responseText, parseError); throw new Error(`Failed to parse server response. Status: ${response.status}`); } if (!response.ok) { setSubmissionError(result.message || `Submission failed with status: ${response.status}`); throw new Error(`HTTP error ${response.status}: ${result.message || responseText}`); } if (result && result.success) { toast.success("Survey submitted successfully!"); sessionStorage.removeItem(`surveyClientSessionId_${surveyId}_${collectorId}`); if (recaptchaRef.current) recaptchaRef.current.reset(); setRecaptchaToken(null); navigate(`/thank-you`, {state: {surveyTitle: survey?.title || initialSurveyTitle, thankYouMessage: result.thankYouMessage}}); } else { setSubmissionError(result.message || "An unknown error occurred during submission."); if (recaptchaRef.current) recaptchaRef.current.reset(); setRecaptchaToken(null); } } catch (err) { setSubmissionError(err.message || "An unexpected error occurred."); if (recaptchaRef.current) recaptchaRef.current.reset(); setRecaptchaToken(null); } finally { setIsSubmitting(false); } }, [surveyId, collectorId, currentAnswers, otherInputValues, currentResumeToken, navigate, survey?.title, initialSurveyTitle, isSubmitting, clientSessionId, collectorSettings, recaptchaToken, currentQuestionToRender, validateQuestion]);
    const handleNext = useCallback(() => { if (autoAdvanceTimeoutRef.current) clearTimeout(autoAdvanceTimeoutRef.current); if (currentQuestionToRender && !validateQuestion(currentQuestionToRender)) { return; } setShowValidationModal(false); setValidationModalMessage(''); if (!isSubmitState) { setCurrentVisibleIndex(prev => prev + 1); } else { handleSubmit(); } }, [isSubmitState, validateQuestion, currentQuestionToRender, handleSubmit]);
    const handleInputChange = useCallback((questionId, value) => { setCurrentAnswers(prev => ({ ...prev, [questionId]: value })); setShowValidationModal(false); setValidationModalMessage(''); const autoAdvanceEnabled = collectorSettings?.autoAdvance ?? survey?.settings?.behaviorNavigation?.autoAdvance ?? false; const question = questionsById[questionId]; const autoAdvanceTypes = ['multiple-choice', 'nps', 'rating']; const isOtherSelectedForOtherQuestion = question && question.addOtherOption && value === OTHER_VALUE_INTERNAL; if (autoAdvanceEnabled && question && autoAdvanceTypes.includes(question.type) && !isSubmitState && !isOtherSelectedForOtherQuestion) { if (autoAdvanceTimeoutRef.current) clearTimeout(autoAdvanceTimeoutRef.current); autoAdvanceTimeoutRef.current = setTimeout(() => { handleNext(); autoAdvanceTimeoutRef.current = null; }, 500); } else if (autoAdvanceTimeoutRef.current && isOtherSelectedForOtherQuestion) { clearTimeout(autoAdvanceTimeoutRef.current); autoAdvanceTimeoutRef.current = null; } }, [collectorSettings, survey, questionsById, isSubmitState, handleNext, OTHER_VALUE_INTERNAL]);
    const handleCheckboxChange = useCallback((questionId, optionValue, isChecked) => { setCurrentAnswers(prevAnswers => { const currentSelection = prevAnswers[questionId] ? [...ensureArray(prevAnswers[questionId])] : []; let newSelection = isChecked ? [...currentSelection, optionValue] : currentSelection.filter(val => val !== optionValue); if (optionValue === OTHER_VALUE_INTERNAL && !isChecked) { setOtherInputValues(prevOther => ({ ...prevOther, [`${questionId}_other`]: '' })); } return { ...prevAnswers, [questionId]: newSelection }; }); setShowValidationModal(false); setValidationModalMessage(''); }, [OTHER_VALUE_INTERNAL]);
    const handleOtherInputChange = useCallback((questionId, value) => { setOtherInputValues(prev => ({ ...prev, [`${questionId}_other`]: value })); setCurrentAnswers(prevAnswers => { const currentSelection = prevAnswers[questionId] ? [...ensureArray(prevAnswers[questionId])] : []; if (value && value.trim() !== '' && !currentSelection.includes(OTHER_VALUE_INTERNAL)) { return { ...prevAnswers, [questionId]: [...currentSelection, OTHER_VALUE_INTERNAL] }; } return prevAnswers; }); setShowValidationModal(false); setValidationModalMessage(''); }, [OTHER_VALUE_INTERNAL]);
    const handleComplexAnswerChange = useCallback((questionId, structuredAnswer) => { setCurrentAnswers(prev => ({ ...prev, [questionId]: structuredAnswer })); setShowValidationModal(false); setValidationModalMessage(''); }, []);
    const handlePrevious = useCallback(() => { if (autoAdvanceTimeoutRef.current) clearTimeout(autoAdvanceTimeoutRef.current); setShowValidationModal(false); setValidationModalMessage(''); setCurrentVisibleIndex(prevIndex => (prevIndex > 0 ? prevIndex - 1 : prevIndex)); }, []);
    const performSaveAndContinue = useCallback(async (emailForSave = null) => { if (!surveyId || !collectorId) { console.error("Cannot save, survey/collector ID missing."); return; } let currentSaveClientSessionId = clientSessionId; if (!currentSaveClientSessionId) { let fallbackSessionId = sessionStorage.getItem(`surveyClientSessionId_${surveyId}_${collectorId}`); if (!fallbackSessionId) fallbackSessionId = uuidv4(); setClientSessionId(fallbackSessionId); sessionStorage.setItem(`surveyClientSessionId_${surveyId}_${collectorId}`, fallbackSessionId); currentSaveClientSessionId = fallbackSessionId; } setIsSavingAndContinueLater(true); try { const payload = { collectorId, answers: currentAnswers, otherInputValues, currentVisibleIndex: currentVisibleIndex, resumeToken: currentResumeToken, sessionId: currentSaveClientSessionId }; if (emailForSave) payload.respondentEmail = emailForSave; const result = await surveyApi.savePartialResponse(surveyId, payload); if (result.success && result.resumeToken) { setCurrentResumeToken(result.resumeToken); setGeneratedResumeCode(result.resumeToken); setShowResumeCodeModal(true); setPromptForEmailOnSave(false); toast.info("Progress saved!"); } else { toast.error(result.message || "Failed to save progress."); } } catch (err) { toast.error(err.message || "Error saving progress."); } finally { setIsSavingAndContinueLater(false); } }, [surveyId, collectorId, currentAnswers, otherInputValues, currentVisibleIndex, currentResumeToken, clientSessionId]);
    const handleSaveAndContinueLater = useCallback(async () => { const saveMethod = collectorSettings?.saveAndContinueMethod || survey?.settings?.behaviorNavigation?.saveAndContinueMethod || 'email'; const needsEmailPrompt = (saveMethod === 'email' || saveMethod === 'both') && !emailForReminder; if (needsEmailPrompt) { setPromptForEmailOnSave(true); setShowResumeCodeModal(true); return; } performSaveAndContinue(emailForReminder || null); }, [survey, collectorSettings, emailForReminder, performSaveAndContinue]);
    const handleModalEmailSubmitAndSave = useCallback(() => { const saveMethod = collectorSettings?.saveAndContinueMethod || survey?.settings?.behaviorNavigation?.saveAndContinueMethod || 'email'; if ((saveMethod === 'email' || saveMethod === 'both') && !emailForReminder.trim()) { setValidationModalMessage("Please enter your email address to save and continue."); setShowValidationModal(true); return; } performSaveAndContinue(emailForReminder.trim()); }, [survey, collectorSettings, emailForReminder, performSaveAndContinue]);
    
    const renderProgressBar = useCallback(() => {
        // Use collectorSettings first, then survey settings, then defaults
        const isEnabled = collectorSettings?.progressBarEnabled ?? survey?.settings?.behaviorNavigation?.progressBarEnabled ?? false;
        if (!survey || !isEnabled || !visibleQuestionIndices || visibleQuestionIndices.length === 0) return null;

        const style = collectorSettings?.progressBarStyle || survey?.settings?.behaviorNavigation?.progressBarStyle || 'percentage';
        const position = collectorSettings?.progressBarPosition || survey?.settings?.behaviorNavigation?.progressBarPosition || 'top'; // 'top' or 'bottom'

        const safeIdx = Math.min(currentVisibleIndex, visibleQuestionIndices.length - 1);
        const progress = visibleQuestionIndices.length > 0 ? ((safeIdx + 1) / visibleQuestionIndices.length) * 100 : 0;
        
        const barText = style === 'percentage' ? `${Math.round(progress)}% Complete` : 
                        style === 'fraction' ? `${safeIdx + 1} / ${visibleQuestionIndices.length}` : 
                        '';

        // Add a class for position to control via CSS
        const positionClass = position === 'bottom' ? styles.progressBarBottom : styles.progressBarTop;

        return (
            <div className={`${styles.progressBarContainer} ${positionClass}`}>
                <div className={styles.progressBarTrack}>
                    <div className={styles.progressBarFill} style={{ width: `${progress.toFixed(2)}%` }}></div>
                </div>
                {barText && <span>{barText}</span>}
            </div>
        );
    }, [survey, visibleQuestionIndices, currentVisibleIndex, collectorSettings]);

    const renderQuestionInputs = (question) => { if (!question) return <div className={styles.questionContainer}><p>Error: Question data is missing.</p></div>; const surveySettings = survey?.settings?.behaviorNavigation; const showQuestionNumber = collectorSettings?.questionNumberingEnabled ?? surveySettings?.questionNumberingEnabled ?? true; let questionNumberDisplay = ""; if (showQuestionNumber) { const format = surveySettings?.questionNumberingFormat || '123'; const prefix = surveySettings?.questionNumberingCustomPrefix || ''; questionNumberDisplay = formatQuestionNumber(currentVisibleIndex, format, prefix); } const commonProps = { question, currentAnswer: currentAnswers[question._id], disabled: isSubmitting || isSavingAndContinueLater, isPreviewMode: false }; const choiceProps = { ...commonProps, otherValue: otherInputValues[`${question._id}_other`], onOtherTextChange: handleOtherInputChange }; let questionComponent; switch (question.type) { case 'text': questionComponent = <ShortTextQuestion {...commonProps} onAnswerChange={handleInputChange} />; break; case 'textarea': questionComponent = <TextAreaQuestion {...commonProps} onAnswerChange={handleInputChange} />; break; case 'multiple-choice': questionComponent = <MultipleChoiceQuestion {...choiceProps} onAnswerChange={handleInputChange} />; break; case 'checkbox': questionComponent = <CheckboxQuestion {...choiceProps} onCheckboxChange={handleCheckboxChange} />; break; case 'dropdown': questionComponent = <DropdownQuestion {...choiceProps} onAnswerChange={handleInputChange} />; break; case 'nps': questionComponent = <NpsQuestion {...commonProps} onAnswerChange={handleInputChange} />; break; case 'rating': questionComponent = <RatingQuestion {...commonProps} onAnswerChange={handleInputChange} />; break; case 'slider': questionComponent = <SliderQuestion {...commonProps} onAnswerChange={handleInputChange} />; break; case 'ranking': questionComponent = <RankingQuestion {...commonProps} onAnswerChange={handleComplexAnswerChange} />; break; case 'matrix': questionComponent = <MatrixQuestion {...commonProps} onAnswerChange={handleComplexAnswerChange} />; break; case 'heatmap': questionComponent = <HeatmapQuestion {...commonProps} onAnswerChange={handleComplexAnswerChange} />; break; case 'cardsort': questionComponent = <CardSortQuestion {...commonProps} onAnswerChange={handleComplexAnswerChange} />; break; case 'conjoint': questionComponent = <ConjointQuestion {...commonProps} onAnswerChange={handleComplexAnswerChange} />; break; case 'maxdiff': questionComponent = <MaxDiffQuestion {...commonProps} onAnswerChange={handleComplexAnswerChange} />; break; default: console.warn("Unsupported question type:", question.type); questionComponent = <p>Unsupported: {question.type}</p>; } return ( <div className={styles.questionContentWrapper}> <div className={styles.questionHeader}> {showQuestionNumber && <span className={styles.questionNumber}>{questionNumberDisplay}</span>} </div> {questionComponent} </div> ); };
    const handleCopyResumeCode = () => { if (generatedResumeCode) { navigator.clipboard.writeText(generatedResumeCode) .then(() => { toast.success("Resume code copied to clipboard!"); }) .catch(err => { console.error('Failed to copy resume code: ', err); toast.error("Failed to copy code. Please copy it manually."); }); } };

    if (isLoadingSurvey) return <div className={styles.loadingContainer}>Loading survey questions...</div>;
    if (surveyError) return <div className={styles.errorContainer}>Error loading survey: {surveyError}</div>;
    if (!survey || !originalQuestions) return <div className={styles.errorContainer}>Survey data could not be loaded or no questions found.</div>;

    const progressBarElement = renderProgressBar();
    const displayTitle = survey?.title || initialSurveyTitle || "Survey";
    const saveAndContinueEnabled = collectorSettings?.allowResume ?? false; // Use standardized allowResume from merged settings
    const isRecaptchaEnabled = collectorSettings?.enableRecaptcha;
    const isRecaptchaVerified = !!recaptchaToken;
    const submitButton = isSubmitState && (visibleQuestionIndices.length > 0 || Object.keys(currentAnswers).length > 0) &&
        (<button type="button" onClick={handleSubmit} disabled={isSubmitting || isSavingAndContinueLater || !clientSessionId || (isRecaptchaEnabled && !isRecaptchaVerified)} className={styles.navButtonPrimary} > {isSubmitting ? 'Submitting...' : 'Submit'} </button>);

    // Determine if progress bar should be at top or bottom for main layout ordering
    const progressBarPosition = collectorSettings?.progressBarPosition || survey?.settings?.behaviorNavigation?.progressBarPosition || 'top';

    return (
        <div className={styles.surveyTakingPageWrapper}>
            {progressBarPosition === 'top' && progressBarElement}
            <header className={styles.surveyHeader}>
                <h1>{displayTitle}</h1>
                {survey.description && <p className={styles.description}>{survey.description}</p>}
            </header>
            {progressBarPosition === 'middle' && progressBarElement} {/* Example if you wanted a middle option */}

            {submissionError && ( <div className={styles.submissionErrorBanner}> <p><strong>Submission Error:</strong> {submissionError}</p> <button onClick={() => setSubmissionError(null)} className={styles.closeErrorButton}>&times;</button> </div> )}
            {showValidationModal && ( <div className={styles.validationModalBackdrop} onClick={() => setShowValidationModal(false)}> <div className={styles.validationModalContent} onClick={e => e.stopPropagation()}> <h4>Validation Error</h4> <p>{validationModalMessage}</p> <button onClick={() => setShowValidationModal(false)} className={styles.validationModalButton}>OK</button> </div> </div> )}
            
            <div className={styles.questionContainer}> {currentQuestionToRender ? (renderQuestionInputs(currentQuestionToRender)) : (!isSubmitting && currentVisibleIndex >= visibleQuestionIndices.length && <div className={styles.surveyMessageContainer}><p className={styles.surveyMessage}>Thank you for your responses!</p> {(visibleQuestionIndices.length > 0 || Object.keys(currentAnswers).length > 0) && <p className={styles.surveyMessage}>Click "Submit" to finalize your survey.</p>} {visibleQuestionIndices.length === 0 && Object.keys(currentAnswers).length === 0 && <p className={styles.surveyMessage}>Survey completed.</p>} </div>)} </div>
            
            {isSubmitState && isRecaptchaEnabled && ( <div className={styles.recaptchaContainer}> <ReCAPTCHA ref={recaptchaRef} sitekey={process.env.REACT_APP_RECAPTCHA_SITE_KEY || "YOUR_FALLBACK_RECAPTCHA_V2_SITE_KEY"} onChange={(token) => { setRecaptchaToken(token); setSubmissionError(null); }} onExpired={() => { setRecaptchaToken(null); setSubmissionError("reCAPTCHA has expired. Please verify again."); }} onErrored={(err) => { console.error("reCAPTCHA error occurred", err); setRecaptchaToken(null); setSubmissionError("reCAPTCHA challenge failed. Please try again or refresh the page."); }} /> </div> )}
            
            {progressBarPosition === 'bottom_of_questions' && progressBarElement}

            <footer className={styles.surveyNavigation}> 
                {(collectorSettings?.allowBackButton ?? true) && currentVisibleIndex > 0 && (<button type="button" onClick={handlePrevious} disabled={isSubmitting || isSavingAndContinueLater} className={styles.navButton}>Previous</button>)} 
                {!( (collectorSettings?.allowBackButton ?? true) && currentVisibleIndex > 0) && <div style={{flexGrow: 1}}></div>} 
                {saveAndContinueEnabled && (<button type="button" onClick={handleSaveAndContinueLater} disabled={isSavingAndContinueLater || isSubmitting || !clientSessionId} className={styles.navButtonSecondary}>Save and Continue Later</button>)} 
                {!isSubmitState && (<button type="button" onClick={handleNext} disabled={!currentQuestionToRender || isSubmitting || isSavingAndContinueLater} className={styles.navButtonPrimary}>Next</button>)} 
                {submitButton} 
            </footer>

            {progressBarPosition === 'bottom' && progressBarElement}
            
            {showResumeCodeModal && ( <div className={styles.modalBackdrop}> <div className={styles.modalContentWrapper} onClick={e => e.stopPropagation()}> <h3>{promptForEmailOnSave ? "Save & Continue: Enter Email" : "Resume Later"}</h3> {(promptForEmailOnSave || (generatedResumeCode && (collectorSettings?.saveAndContinueMethod === 'email' || collectorSettings?.saveAndContinueMethod === 'both' || survey?.settings?.behaviorNavigation?.saveAndContinueMethod === 'email' || survey?.settings?.behaviorNavigation?.saveAndContinueMethod === 'both'))) && ( <div style={{marginBottom: '15px'}}> <p>{promptForEmailOnSave ? "Please enter your email address to receive a link to resume this survey later." : "Optionally, enter your email to also receive the resume code and link:"}</p> <input type="email" value={emailForReminder} onChange={(e) => setEmailForReminder(e.target.value)} placeholder="your.email@example.com" className={styles.emailInputForReminder} /> </div> )} {generatedResumeCode && (collectorSettings?.saveAndContinueMethod === 'code' || collectorSettings?.saveAndContinueMethod === 'both' || survey?.settings?.behaviorNavigation?.saveAndContinueMethod === 'code' || survey?.settings?.behaviorNavigation?.saveAndContinueMethod === 'both') && ( <div style={{marginBottom: '15px'}}> <p>Your progress has been saved. Use the following code to resume your survey later:</p> <div className={styles.resumeCodeDisplayContainer}> <strong className={styles.resumeCodeDisplay}>{generatedResumeCode}</strong> <button onClick={handleCopyResumeCode} className={styles.copyCodeButton} title="Copy Code"> Copy </button> </div> <hr style={{margin: '15px 0'}} /> </div> )} {!generatedResumeCode && !promptForEmailOnSave && <p>Saving your progress...</p>} <div className={styles.modalActions}> {promptForEmailOnSave ? ( <button onClick={handleModalEmailSubmitAndSave} className={styles.button} disabled={isSavingAndContinueLater}> {isSavingAndContinueLater ? "Saving..." : "Save and Send Email"} </button> ) : null } <button onClick={() => { setShowResumeCodeModal(false); setPromptForEmailOnSave(false); setEmailForReminder('');}} className={styles.buttonSecondary} style={{marginLeft: promptForEmailOnSave ? '10px' : '0'}} > Close </button> </div> </div> </div> )}
        </div>
    );
}
export default SurveyTakingPage;
// ----- END OF UPDATED FILE (v1.6 - ProgressBar uses collectorSettings for style/position) -----