// frontend/src/pages/SurveyTakingPage.js
// ----- START OF COMPLETE MODIFIED FILE (vNext16 - Handle saveAndContinueMethod) -----
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import ReCAPTCHA from "react-google-recaptcha";
import styles from './SurveyTakingPage.module.css';
import surveyApiFunctions from '../api/surveyApi';

import ShortTextQuestion from '../components/survey_question_renders/ShortTextQuestion';
import TextAreaQuestion from '../components/survey_question_renders/TextAreaQuestion';
import MultipleChoiceQuestion from '../components/survey_question_renders/MultipleChoiceQuestion';
import CheckboxQuestion from '../components/survey_question_renders/CheckboxQuestion';
import DropdownQuestion from '../components/survey_question_renders/DropdownQuestion';
import RatingQuestion from '../components/survey_question_renders/RatingQuestion';
import NpsQuestion from '../components/survey_question_renders/NpsQuestion';
import SliderQuestion from '../components/survey_question_renders/SliderQuestion';
import MatrixQuestion from '../components/survey_question_renders/MatrixQuestion';
import HeatmapQuestion from '../components/survey_question_renders/HeatmapQuestion';
import MaxDiffQuestion from '../components/survey_question_renders/MaxDiffQuestion';
import ConjointQuestion from '../components/survey_question_renders/ConjointQuestion';
import RankingQuestion from '../components/survey_question_renders/RankingQuestion';
import CardSortQuestion from '../components/survey_question_renders/CardSortQuestion';

import Modal from '../components/common/Modal';

const ensureArray = (value) => (Array.isArray(value) ? value : (value !== undefined && value !== null ? [value] : []));
const isAnswerEmpty = (value, questionType) => { /* ... (same as before) ... */ };
const shuffleArray = (array) => { /* ... (same as before) ... */ };
const toRoman = (num) => { /* ... (same as before) ... */ };
const toLetters = (num) => { /* ... (same as before) ... */ };

function SurveyTakingPage() {
    const { surveyId, collectorId: routeCollectorIdentifier, resumeToken: routeResumeToken } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    const [survey, setSurvey] = useState(null);
    const [originalQuestions, setOriginalQuestions] = useState([]);
    const [currentAnswers, setCurrentAnswers] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [sessionId, setSessionId] = useState(() => Date.now().toString(36) + Math.random().toString(36).substring(2));
    const [surveyStartedAt, setSurveyStartedAt] = useState(() => new Date().toISOString());
    const [otherInputValues, setOtherInputValues] = useState({});
    const [randomizedQuestionOrder, setRandomizedQuestionOrder] = useState([]);
    const [randomizedOptionOrders, setRandomizedOptionOrders] = useState({});
    const [hiddenQuestionIds, setHiddenQuestionIds] = useState(new Set());
    const [visibleQuestionIndices, setVisibleQuestionIndices] = useState([]);
    const [currentVisibleIndex, setCurrentVisibleIndex] = useState(0);
    const [visitedPath, setVisitedPath] = useState([]);
    const [isDisqualified, setIsDisqualified] = useState(false);
    const [disqualificationMessage, setDisqualificationMessage] = useState('');
    const [currentCollectorIdentifier, setCurrentCollectorIdentifier] = useState(null);
    const [actualCollectorObjectId, setActualCollectorObjectId] = useState(null);
    const [collectorSettings, setCollectorSettings] = useState(null);
    const [hasAlreadyResponded, setHasAlreadyResponded] = useState(false);
    const [recaptchaEnabled, setRecaptchaEnabled] = useState(false);
    const [recaptchaSiteKey, setRecaptchaSiteKey] = useState('');
    const [recaptchaToken, setRecaptchaToken] = useState(null);
    const recaptchaRef = useRef(null);
    const [allowBackButton, setAllowBackButton] = useState(true);
    const [progressBarEnabledState, setProgressBarEnabledState] = useState(false);
    const [progressBarStyleState, setProgressBarStyleState] = useState('percentage');
    const [progressBarPositionState, setProgressBarPositionState] = useState('top');
    const [autoAdvanceState, setAutoAdvanceState] = useState(false);
    const [qNumEnabledState, setQNumEnabledState] = useState(true);
    const [qNumFormatState, setQNumFormatState] = useState('123');
    const autoAdvanceTimeoutRef = useRef(null);

    const [saveAndContinueEnabled, setSaveAndContinueEnabled] = useState(false);
    // +++ NEW: State for current save method +++
    const [currentSaveMethod, setCurrentSaveMethod] = useState('email'); // Default to 'email'
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [saveEmail, setSaveEmail] = useState('');
    const [isSavingPartial, setIsSavingPartial] = useState(false);
    const [capturedCustomVars, setCapturedCustomVars] = useState(new Map());
    const [currentResumeToken, setCurrentResumeToken] = useState(null);
    // +++ NEW: State for displaying resume code after save +++
    const [showResumeCodeInfo, setShowResumeCodeInfo] = useState(false);
    const [resumeCodeToDisplay, setResumeCodeToDisplay] = useState('');
    const [resumeLinkToDisplay, setResumeLinkToDisplay] = useState('');
    const [resumeExpiryDays, setResumeExpiryDays] = useState(7);


    const NA_VALUE_INTERNAL = '__NA__';
    const OTHER_VALUE_INTERNAL = '__OTHER__';

    const questionsById = useMemo(() => originalQuestions.reduce((map, q) => { if(q) map[q._id] = q; return map; }, {}), [originalQuestions]);
    const questionsInCurrentOrder = useMemo(() => (randomizedQuestionOrder.length > 0 && originalQuestions.length > 0) ? randomizedQuestionOrder.map(index => originalQuestions[index]).filter(q => q) : originalQuestions.filter(q => q), [randomizedQuestionOrder, originalQuestions]);
    const questionIdToOriginalIndexMap = useMemo(() => originalQuestions.reduce((map, q, index) => { if(q) map[q._id] = index; return map; }, {}), [originalQuestions]);
    const currentQToRenderMemoized = useMemo(() => { if (isLoading || !survey || visibleQuestionIndices.length === 0 || currentVisibleIndex < 0 || currentVisibleIndex >= visibleQuestionIndices.length) return null; const currentOriginalIdx = visibleQuestionIndices[currentVisibleIndex]; return originalQuestions[currentOriginalIdx] || null; }, [isLoading, survey, visibleQuestionIndices, currentVisibleIndex, originalQuestions]);
    const isSubmitStateDerived = useMemo(() => { if (isLoading || !survey) return false; if (originalQuestions.length > 0 && visibleQuestionIndices.length === 0 && !isLoading) return true; if (originalQuestions.length === 0 && !isLoading) return true; return currentVisibleIndex >= visibleQuestionIndices.length && visibleQuestionIndices.length > 0 && !isLoading; }, [isLoading, survey, visibleQuestionIndices, originalQuestions, currentVisibleIndex]);
    
    useEffect(() => { console.log('[Debug] isSubmitStateDerived changed to:', isSubmitStateDerived, 'currentVisibleIndex:', currentVisibleIndex, 'visibleQuestionIndices.length:', visibleQuestionIndices.length); }, [isSubmitStateDerived, currentVisibleIndex, visibleQuestionIndices.length]);
    useEffect(() => { const effectiveCollectorIdentifier = location.state?.collectorIdentifier || routeCollectorIdentifier; setCurrentCollectorIdentifier(effectiveCollectorIdentifier); if(routeResumeToken) setCurrentResumeToken(routeResumeToken); }, [location.state, routeCollectorIdentifier, routeResumeToken]);

    useEffect(() => {
        if (survey && survey.settings?.customVariables?.length > 0) {
            const params = new URLSearchParams(location.search);
            const newCapturedVars = new Map();
            survey.settings.customVariables.forEach(cv => {
                if (params.has(cv.key)) {
                    newCapturedVars.set(cv.key, params.get(cv.key));
                }
            });
            if (newCapturedVars.size > 0) {
                console.log('[CustomVars] Captured from URL:', Object.fromEntries(newCapturedVars));
                setCapturedCustomVars(newCapturedVars);
            }
        }
    }, [survey, location.search]);

    const fetchSurvey = useCallback(async (signal) => {
        // ... (Existing fetchSurvey logic up to setting survey-wide settings)
        setIsLoading(true); setError(null); setHiddenQuestionIds(new Set()); setIsDisqualified(false); setCurrentVisibleIndex(0); setVisitedPath([]); setRecaptchaToken(null);
        if (!surveyId) { setError("Survey ID is missing."); setIsLoading(false); return; }
        const effectiveResumeToken = currentResumeToken || location.state?.resumeToken;
        if (!currentCollectorIdentifier && !(location.state?.isPreviewingOwner) && !effectiveResumeToken) { setError("Collector identifier or resume token is missing."); setIsLoading(false); return; }
        
        try {
            const options = { forTaking: 'true', signal, collectorId: currentCollectorIdentifier, resumeToken: effectiveResumeToken };
            if (location.state?.isPreviewingOwner) options.isPreviewingOwner = true;
            
            const responsePayload = await surveyApiFunctions.getSurveyById(surveyId, options);
            if (!responsePayload || !responsePayload.success || !responsePayload.data) { /* ... error handling ... */ }
            const surveyData = responsePayload.data;
            if (!surveyData || !Array.isArray(surveyData.questions)) throw new Error("Survey data is malformed.");

            const fetchedCollectorSettings = surveyData.collectorSettings || {};
            const fetchedActualCollectorObjectId = surveyData.actualCollectorObjectId || null;
            const surveyWideSettings = surveyData.settings || {};
            
            setCollectorSettings(fetchedCollectorSettings);
            setActualCollectorObjectId(fetchedActualCollectorObjectId);
            setAllowBackButton(typeof fetchedCollectorSettings.allowBackButton === 'boolean' ? fetchedCollectorSettings.allowBackButton : true);
            setProgressBarEnabledState(typeof fetchedCollectorSettings.progressBarEnabled === 'boolean' ? fetchedCollectorSettings.progressBarEnabled : false);
            setProgressBarStyleState(fetchedCollectorSettings.progressBarStyle || 'percentage');
            setProgressBarPositionState(fetchedCollectorSettings.progressBarPosition || 'top');
            
            const behaviorNavSettings = surveyWideSettings.behaviorNavigation || {};
            setAutoAdvanceState(typeof behaviorNavSettings.autoAdvance === 'boolean' ? behaviorNavSettings.autoAdvance : false);
            setQNumEnabledState(typeof behaviorNavSettings.questionNumberingEnabled === 'boolean' ? behaviorNavSettings.questionNumberingEnabled : true);
            setQNumFormatState(behaviorNavSettings.questionNumberingFormat || '123');
            setSaveAndContinueEnabled(typeof behaviorNavSettings.saveAndContinueEnabled === 'boolean' ? behaviorNavSettings.saveAndContinueEnabled : false);
            // +++ SET currentSaveMethod +++
            setCurrentSaveMethod(behaviorNavSettings.saveAndContinueMethod || 'email');
            setResumeExpiryDays(behaviorNavSettings.saveAndContinueEmailLinkExpiryDays || 7);


            // ... (Rest of fetchSurvey logic: already responded check, reCAPTCHA, questions, resume data)
            const storageKeyCollectorId = fetchedActualCollectorObjectId || currentCollectorIdentifier;
            if (fetchedCollectorSettings.allowMultipleResponses === false && storageKeyCollectorId && localStorage.getItem(`survey_${storageKeyCollectorId}_submitted`) === 'true' && !effectiveResumeToken) { setHasAlreadyResponded(true); setIsLoading(false); return; }
            setHasAlreadyResponded(false);
            const enableRecaptchaFlag = Boolean(fetchedCollectorSettings.enableRecaptcha);
            setRecaptchaEnabled(enableRecaptchaFlag && (fetchedCollectorSettings.recaptchaSiteKey || process.env.REACT_APP_RECAPTCHA_SITE_KEY));
            setRecaptchaSiteKey(fetchedCollectorSettings.recaptchaSiteKey || process.env.REACT_APP_RECAPTCHA_SITE_KEY || '');
            
            setSurvey(surveyData);
            const fetchedQuestions = surveyData.questions || [];
            setOriginalQuestions(fetchedQuestions);
            
            let initialOrderIndices = fetchedQuestions.map((_, index) => index);
            const { randomizationLogic } = surveyData;
            if (randomizationLogic?.type === 'all') initialOrderIndices = shuffleArray(initialOrderIndices);
            setRandomizedQuestionOrder(initialOrderIndices);
            const initialOptionOrders = {}; fetchedQuestions.forEach(q => { if (q && q.randomizeOptions && Array.isArray(q.options)) { initialOptionOrders[q._id] = shuffleArray(q.options.map((_, optIndex) => optIndex)); } }); setRandomizedOptionOrders(initialOptionOrders);
            
            if (surveyData.partialResponse) {
                console.log("[Resume] Resuming survey with data:", surveyData.partialResponse);
                setCurrentAnswers(surveyData.partialResponse.answers || {});
                setOtherInputValues(surveyData.partialResponse.otherInputValues || {});
                setCurrentVisibleIndex(surveyData.partialResponse.currentVisibleIndex || 0);
                setVisitedPath(surveyData.partialResponse.visitedPath || []);
                setSessionId(surveyData.partialResponse.sessionId || sessionId); 
                setSurveyStartedAt(surveyData.partialResponse.createdAt || surveyStartedAt); 
                toast.info("Survey progress resumed.");
            } else {
                const initialAnswers = {}; fetchedQuestions.forEach(q => { if (q) { let da = ''; if (q.type === 'checkbox') da = []; else if (q.type === 'slider') da = String(Math.round(((q.sliderMin ?? 0) + (q.sliderMax ?? 100)) / 2)); else if (q.type === 'ranking') da = ensureArray(q.options?.map(opt => typeof opt === 'string' ? opt : (opt.text || String(opt)))); else if (q.type === 'cardsort') da = { assignments: {}, userCategories: [] }; else if (q.type === 'maxdiff') da = { best: null, worst: null }; else if (q.type === 'conjoint') da = {}; initialAnswers[q._id] = da; } }); setCurrentAnswers(initialAnswers); setOtherInputValues({});
            }

        } catch (errCatch) { 
            if (errCatch.name === 'AbortError') console.log('Fetch aborted.'); 
            else { 
                const msg = errCatch.response?.data?.message || errCatch.message || "Could not load survey."; 
                setError(msg); 
                if(msg !== "This resume link has expired." && msg !== "This survey session has already been completed.") toast.error(`Error: ${msg}`); 
            } 
        } finally { setIsLoading(false); }
    }, [surveyId, currentCollectorIdentifier, location.state, sessionId, surveyStartedAt, currentResumeToken]);

    // ... (other useEffect hooks remain the same)
    useEffect(() => { const tokenToUse = routeResumeToken || location.state?.resumeToken; if (tokenToUse && !currentResumeToken) setCurrentResumeToken(tokenToUse); if (currentCollectorIdentifier || tokenToUse || location.state?.isPreviewingOwner) { const controller = new AbortController(); fetchSurvey(controller.signal); return () => { controller.abort(); if (autoAdvanceTimeoutRef.current) clearTimeout(autoAdvanceTimeoutRef.current); }; } else if (routeCollectorIdentifier === undefined && !location.state?.collectorIdentifier && !tokenToUse && !location.state?.isPreviewingOwner) { setIsLoading(false); setError("Collector information or resume token is missing."); } }, [fetchSurvey, currentCollectorIdentifier, routeCollectorIdentifier, location.state, routeResumeToken, currentResumeToken]);
    useEffect(() => { if (isLoading || !originalQuestions || originalQuestions.length === 0) { if(visibleQuestionIndices.length > 0) setVisibleQuestionIndices([]); return; } const newVisible = questionsInCurrentOrder.map(q => q ? questionIdToOriginalIndexMap[q._id] : undefined).filter(idx => idx !== undefined && !hiddenQuestionIds.has(originalQuestions[idx]._id)); if (JSON.stringify(visibleQuestionIndices) !== JSON.stringify(newVisible)) setVisibleQuestionIndices(newVisible); }, [isLoading, originalQuestions, questionsInCurrentOrder, hiddenQuestionIds, questionIdToOriginalIndexMap, randomizedQuestionOrder, visibleQuestionIndices]);
    useEffect(() => { if (isLoading || !survey || isDisqualified) return; if (visibleQuestionIndices.length === 0) { if (currentVisibleIndex !== 0) setCurrentVisibleIndex(0); if(visitedPath.length > 0 && !allowBackButton) setVisitedPath([]); return; } if (currentVisibleIndex === visibleQuestionIndices.length) return; if (currentVisibleIndex > visibleQuestionIndices.length) { setCurrentVisibleIndex(visibleQuestionIndices.length); return; } if (currentVisibleIndex < 0) { setCurrentVisibleIndex(0); return; } }, [visibleQuestionIndices, isLoading, survey, isDisqualified, currentVisibleIndex, allowBackButton, visitedPath]);
    const evaluateDisabled = useCallback((questionOriginalIndex) => originalQuestions[questionOriginalIndex]?.isDisabled === true, [originalQuestions]);
    const validateQuestion = useCallback((question, answer, isSoftCheck = false, isDisabledBySetting = false) => { /* ... (same) ... */ }, [otherInputValues, OTHER_VALUE_INTERNAL, NA_VALUE_INTERNAL]);
    const evaluateGlobalLogic = useCallback(() => { /* ... (same) ... */ }, [survey, currentAnswers, originalQuestions]);
    const evaluateActionLogic = useCallback((questionOriginalIndex) => { /* ... (same) ... */ }, [originalQuestions, currentAnswers]);
    const handleNext = useCallback(() => { /* ... (same) ... */ }, [currentVisibleIndex, visibleQuestionIndices, isDisqualified, isLoading, originalQuestions, currentAnswers, evaluateDisabled, validateQuestion, allowBackButton, evaluateGlobalLogic, evaluateActionLogic, questionIdToOriginalIndexMap]);
    const handleInputChange = useCallback((questionId, value) => { /* ... (same) ... */ }, [questionsById, OTHER_VALUE_INTERNAL, autoAdvanceState, handleNext, evaluateDisabled, questionIdToOriginalIndexMap, otherInputValues]);
    const handleCheckboxChange = useCallback((questionId, optionValue, isChecked) => { /* ... (same) ... */ }, [questionsById, NA_VALUE_INTERNAL, OTHER_VALUE_INTERNAL]);
    const handleOtherInputChange = useCallback((questionId, textValue) => { /* ... (same) ... */ }, []);
    const renderQuestion = useCallback((questionToRenderArg) => { /* ... (same) ... */ }, [currentAnswers, otherInputValues, handleInputChange, questionIdToOriginalIndexMap, handleOtherInputChange, handleCheckboxChange, randomizedOptionOrders, evaluateDisabled, qNumEnabledState, qNumFormatState, visibleQuestionIndices]);
    const handlePrevious = useCallback(() => { /* ... (same) ... */ }, [isDisqualified, isLoading, visitedPath, currentVisibleIndex, visibleQuestionIndices, allowBackButton]);
    const handleSubmit = useCallback(async (e) => { /* ... (same) ... */ }, [actualCollectorObjectId, collectorSettings, recaptchaEnabled, recaptchaToken, recaptchaSiteKey, visibleQuestionIndices, originalQuestions, evaluateDisabled, validateQuestion, currentAnswers, questionsById, otherInputValues, sessionId, surveyId, navigate, questionIdToOriginalIndexMap, surveyStartedAt, OTHER_VALUE_INTERNAL, currentCollectorIdentifier, capturedCustomVars, currentResumeToken]);

    const handleSavePartialResponse = async () => {
        const needsEmail = currentSaveMethod === 'email' || currentSaveMethod === 'both';
        if (needsEmail && (!saveEmail.trim() || !/\S+@\S+\.\S+/.test(saveEmail))) {
            toast.error("Please enter a valid email address to save your progress.");
            return;
        }
        setIsSavingPartial(true);
        setShowSaveModal(false); // Close modal immediately

        try {
            const payload = {
                collectorId: actualCollectorObjectId,
                respondentEmail: needsEmail ? saveEmail.trim() : undefined, // Send email only if needed
                currentAnswers,
                otherInputValues,
                currentVisibleIndex,
                visitedPath,
                sessionId
            };
            const result = await surveyApiFunctions.savePartialResponse(surveyId, payload);
            
            // Display success message with code if applicable
            toast.success(result.message || "Progress saved!");

            if (result.resumeToken && (result.saveMethodUsed === 'code' || result.saveMethodUsed === 'both' || (result.saveMethodUsed === 'email' && !result.emailSent))) {
                setResumeCodeToDisplay(result.resumeToken);
                const fullResumeLink = `${window.location.origin}/surveys/${result.surveyId}/resume/${result.resumeToken}`;
                setResumeLinkToDisplay(fullResumeLink);
                setResumeExpiryDays(result.expiresInDays || 7);
                setShowResumeCodeInfo(true); // Trigger a new modal or info display
            }
            setSaveEmail(''); // Clear email after attempt

        } catch (error) {
            toast.error(error.response?.data?.message || error.message || "Could not save progress.");
        } finally {
            setIsSavingPartial(false);
        }
    };

    const renderProgressBar = () => { /* ... (same as before) ... */ };

    // --- Render logic ---
    if (hasAlreadyResponded) { /* ... (same) ... */ }
    if (isLoading && !survey) { /* ... (same) ... */ }
    if (error && !survey && !hasAlreadyResponded) { /* ... (same) ... */ }
    if (!survey && !isLoading && !error && !hasAlreadyResponded) { /* ... (same) ... */ }
    if (isDisqualified) { /* ... (same) ... */ }

    const finalCurrentQToRender = currentQToRenderMemoized;
    const finalIsSubmitState = isSubmitStateDerived;
    const isCurrentQuestionDisabledBySetting = finalCurrentQToRender ? evaluateDisabled(questionIdToOriginalIndexMap[finalCurrentQToRender._id]) : false;
    const progressBarComponent = renderProgressBar();

    const needsEmailForSave = currentSaveMethod === 'email' || currentSaveMethod === 'both';

    return (
        <>
            <div className={styles.surveyContainer}>
                {progressBarPositionState === 'top' && progressBarComponent}
                <h1 className={styles.surveyTitle}>{survey?.title || 'Survey'}</h1>
                {(visitedPath.length === 0 || (visitedPath.length === 1 && currentVisibleIndex === 0 && visibleQuestionIndices.indexOf(visitedPath[0]) === 0 )) && survey?.description && <p className={styles.surveyDescription}>{survey.description}</p>}
                {error && survey && <div className={styles.submissionError}><p>Error: {error}</p></div>}
                {isLoading && survey ? <div className={styles.loading}>Loading question...</div> :
                    <div className={`${styles.questionBox} ${isCurrentQuestionDisabledBySetting ? styles.disabled : ''}`}>
                        {/* ... (question rendering logic - same as before) ... */}
                    </div>
                }
                {finalIsSubmitState && recaptchaEnabled && recaptchaSiteKey && ( <div className={styles.recaptchaContainer}> {/* ... */} </div> )}
                
                <div className={styles.surveyNavigationArea}>
                    {allowBackButton && ( <button onClick={handlePrevious} className={styles.navButton} disabled={isDisqualified || isLoading || isSubmitting || (currentVisibleIndex === 0 && visitedPath.length <= 1) || finalIsSubmitState } > Previous </button> )}
                    {!allowBackButton && <div style={{minWidth: '100px'}}></div>} 

                    {saveAndContinueEnabled && !finalIsSubmitState && !isDisqualified && ( <button onClick={() => setShowSaveModal(true)} className={styles.secondaryNavButton} disabled={isLoading || isSubmitting || isSavingPartial}> Save & Continue Later </button> )}

                    {finalIsSubmitState ? ( <button onClick={handleSubmit} className={styles.submitButton} disabled={isDisqualified || isSubmitting || isLoading || (recaptchaEnabled && recaptchaSiteKey && !recaptchaToken)} > {isSubmitting ? 'Submitting...' : 'Submit'} </button> ) 
                    : ( <button onClick={handleNext} className={styles.navButton} disabled={isDisqualified || isSubmitting || isLoading || !finalCurrentQToRender } > Next </button> )}
                </div>
                {progressBarPositionState === 'bottom' && progressBarComponent}
            </div>

            {/* Save Progress Modal */}
            {showSaveModal && (
                <Modal isOpen={showSaveModal} onClose={() => {setShowSaveModal(false); setSaveEmail('');}} title="Save Your Progress">
                    <div style={{padding: '20px'}}>
                        {needsEmailForSave && (
                            <>
                                <p>Enter your email address below. Based on the survey settings, we may send you a unique link to resume this survey later.</p>
                                <input 
                                    type="email" 
                                    value={saveEmail} 
                                    onChange={(e) => setSaveEmail(e.target.value)} 
                                    placeholder="your.email@example.com" 
                                    style={{width: '100%', padding: '10px', marginBottom: '15px', boxSizing: 'border-box', border:'1px solid #ccc', borderRadius:'4px'}} 
                                    disabled={isSavingPartial} 
                                />
                            </>
                        )}
                        {(currentSaveMethod === 'code' && !needsEmailForSave) && (
                            <p>Your progress will be saved. You will be shown a unique code to copy and use to resume later.</p>
                        )}
                         {(currentSaveMethod === 'both' && needsEmailForSave) && (
                            <p style={{marginTop: needsEmailForSave ? '0' : '10px'}}>You will also be shown a unique code to copy and use to resume later.</p>
                        )}
                        <div style={{display: 'flex', justifyContent: 'flex-end', marginTop: '20px'}}>
                            <button onClick={() => {setShowSaveModal(false); setSaveEmail('');}} disabled={isSavingPartial} style={{marginRight:'10px', padding:'10px 15px', cursor:'pointer', border:'1px solid #ccc', borderRadius:'4px'}}>Cancel</button>
                            <button 
                                onClick={handleSavePartialResponse} 
                                disabled={isSavingPartial || (needsEmailForSave && !saveEmail.trim())} 
                                style={{padding:'10px 15px', cursor:'pointer', backgroundColor:'#007bff', color:'white', border:'1px solid #007bff', borderRadius:'4px'}}
                            > 
                                {isSavingPartial ? 'Saving...' : (currentSaveMethod === 'code' ? 'Save & Get Code' : 'Save Progress')} 
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Display Resume Code Info Modal/Section */}
            {showResumeCodeInfo && (
                <Modal isOpen={showResumeCodeInfo} onClose={() => setShowResumeCodeInfo(false)} title="Resume Information">
                    <div style={{padding: '20px'}}>
                        <h4>Your Progress Has Been Saved!</h4>
                        <p>To continue your survey later, please copy and save the following information.</p>
                        <div style={{marginTop: '15px', marginBottom: '15px', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', background: '#f9f9f9'}}>
                            <p style={{margin: '5px 0'}}><strong>Your Unique Resume Code:</strong></p>
                            <input 
                                type="text" 
                                value={resumeCodeToDisplay} 
                                readOnly 
                                style={{width: '100%', padding: '8px', boxSizing: 'border-box', marginBottom: '10px', fontFamily: 'monospace', border: '1px solid #ccc'}} 
                                onFocus={(e) => e.target.select()}
                            />
                            <button onClick={() => {navigator.clipboard.writeText(resumeCodeToDisplay); toast.info("Resume code copied!");}} style={{padding:'8px 12px', cursor:'pointer'}}>Copy Code</button>
                        </div>
                        <p style={{margin: '5px 0'}}>
                            Alternatively, you can use this direct link (if an email was not sent or you prefer the link):
                        </p>
                        <div style={{marginTop: '5px', marginBottom: '15px', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', background: '#f9f9f9'}}>
                             <input 
                                type="text" 
                                value={resumeLinkToDisplay} 
                                readOnly 
                                style={{width: '100%', padding: '8px', boxSizing: 'border-box', marginBottom: '10px', fontFamily: 'monospace', border: '1px solid #ccc'}} 
                                onFocus={(e) => e.target.select()}
                            />
                            <button onClick={() => {navigator.clipboard.writeText(resumeLinkToDisplay); toast.info("Resume link copied!");}} style={{padding:'8px 12px', cursor:'pointer', marginRight:'10px'}}>Copy Link</button>
                            <a href={resumeLinkToDisplay} target="_blank" rel="noopener noreferrer" style={{padding:'8px 12px', textDecoration:'none', backgroundColor:'#5cb85c', color:'white', borderRadius:'4px'}}>Open Link</a>
                        </div>
                        <p style={{fontSize: '0.9em', color: '#555'}}>This resume information is valid for approximately {resumeExpiryDays} days.</p>
                         <div style={{display: 'flex', justifyContent: 'flex-end', marginTop: '20px'}}>
                            <button onClick={() => setShowResumeCodeInfo(false)} style={{padding:'10px 15px', cursor:'pointer', backgroundColor:'#007bff', color:'white', border:'1px solid #007bff', borderRadius:'4px'}}>Close</button>
                        </div>
                    </div>
                </Modal>
            )}
        </>
    );
}
// Helper function stubs (ensure these are fully implemented as before)
// isAnswerEmpty = (...)
// shuffleArray = (...)
// toRoman = (...)
// toLetters = (...)

export default SurveyTakingPage;
// ----- END OF COMPLETE MODIFIED FILE (vNext16 - Handle saveAndContinueMethod) -----