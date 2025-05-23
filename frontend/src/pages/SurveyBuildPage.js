// frontend/src/pages/SurveyBuildPage.js
// ----- START OF COMPLETE UPDATED FILE (v1.9 - Integrate Survey Status in Settings Panel) -----
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import QuestionPropertiesPanel from '../components/QuestionEditPanel';
import SurveyLogicPanel from '../components/SurveyLogicPanel';
import SurveySettingsPanel from '../components/SurveySettingsPanel';
import QuestionListItem from '../components/QuestionListItem';
import CollectorsPanel from '../components/CollectorsPanel';
import HeatmapAreaSelectorModal from '../components/logic/HeatmapAreaSelectorModal';
import styles from './SurveyBuildPage.module.css';
import surveyApi from '../api/surveyApi';


const SurveyBuildPage = () => {
    const { surveyId: routeSurveyId } = useParams();
    const navigate = useNavigate();

    const [survey, setSurvey] = useState(null);
    const [selectedQuestionId, setSelectedQuestionId] = useState(null);
    const [showAddQuestionPanel, setShowAddQuestionPanel] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [pageError, setPageError] = useState('');

    const [isLogicPanelOpen, setIsLogicPanelOpen] = useState(false);
    const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false);
    const [isCollectorsPanelOpen, setIsCollectorsPanelOpen] = useState(false);

    const [isAreaManagerModalOpen, setIsAreaManagerModalOpen] = useState(false);
    const [questionForAreaManagement, setQuestionForAreaManagement] = useState(null);
    const [isHeatmapDrawingForModal, setIsHeatmapDrawingForModal] = useState(false);

    const [collectors, setCollectors] = useState([]);
    const [isLoadingCollectors, setIsLoadingCollectors] = useState(false);

    useEffect(() => {
        const anyModalOpen = isLogicPanelOpen || isSettingsPanelOpen || isCollectorsPanelOpen || isAreaManagerModalOpen;
        if (anyModalOpen) {
            document.body.classList.add(styles.modalOpenNoScroll);
        } else {
            document.body.classList.remove(styles.modalOpenNoScroll);
        }
        return () => {
            document.body.classList.remove(styles.modalOpenNoScroll);
        };
    }, [isLogicPanelOpen, isSettingsPanelOpen, isCollectorsPanelOpen, isAreaManagerModalOpen, styles.modalOpenNoScroll]);


    const ensureArray = (value) => (Array.isArray(value) ? value : (value === undefined || value === null ? [] : [value]));
    const fetchSurveyData = useCallback(async (options = {}) => {
        if (!routeSurveyId) {
            setPageError("No survey ID found. Please select a survey.");
            setLoading(false); setIsLoadingCollectors(false); setSurvey(null);
            return;
        }
        setLoading(true); setPageError(''); setIsLoadingCollectors(true); setSurvey(null);
        try {
            const surveyResponse = await surveyApi.getSurveyById(routeSurveyId);
            if (surveyResponse && surveyResponse.success && surveyResponse.data && surveyResponse.data._id) {
                console.log("[SBP fetchSurveyData] Fetched survey data (full):", JSON.stringify(surveyResponse.data, null, 2));
                setSurvey(surveyResponse.data);
                try {
                    const collectorsResponse = await surveyApi.getCollectorsForSurvey(routeSurveyId);
                    if (collectorsResponse && collectorsResponse.success) {
                        setCollectors(collectorsResponse.data || []);
                    } else {
                        toast.error(`Failed to load collectors: ${collectorsResponse?.message || 'Unknown error'}`);
                        setCollectors([]);
                    }
                } catch (collectorError) {
                    toast.error(`Failed to load collectors: ${collectorError.response?.data?.message || collectorError.message || 'Unknown error'}`);
                    setCollectors([]);
                }
                if (options.selectQuestionIdAfterFetch) {
                    setSelectedQuestionId(options.selectQuestionIdAfterFetch);
                    setShowAddQuestionPanel(false);
                } else if (!showAddQuestionPanel && (!surveyResponse.data.questions || surveyResponse.data.questions.length === 0)) {
                    setSelectedQuestionId(null);
                }
            } else {
                const errorMsg = `Failed to load survey: ${surveyResponse?.message || 'Invalid data or survey not found.'}`;
                setPageError(errorMsg); toast.error(errorMsg); setSurvey(null); setCollectors([]);
            }
        } catch (err) {
            const errorMsg = `Failed to load survey details: ${err.response?.data?.message || err.message || 'Unknown error'}`;
            setPageError(errorMsg); toast.error(errorMsg); setSurvey(null); setCollectors([]);
        } finally {
            setLoading(false); setIsLoadingCollectors(false);
        }
    }, [routeSurveyId, showAddQuestionPanel]);

    useEffect(() => { fetchSurveyData(); }, [fetchSurveyData]);

    const truncateText = (text, maxLength = 30) => text && text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;

    const handleCreateQuestionFromPanel = useCallback(async (newQuestionDataFromPanel) => {
        if (!survey?._id) { toast.error("Survey not loaded."); return; }
        setSaving(true);
        const payload = { ...newQuestionDataFromPanel, survey: survey._id };
        delete payload._id;
        console.log("[SBP handleCreateQuestionFromPanel] Payload to API for create:", JSON.stringify(payload, null, 2));
        try {
            const response = await surveyApi.createQuestion(payload);
            if (response && response.success && response.data && response.data._id) {
                const savedQuestion = response.data;
                console.log("[SBP handleCreateQuestionFromPanel] API response for create (savedQuestion):", JSON.stringify(savedQuestion, null, 2));
                setSurvey(prevSurvey => ({
                    ...prevSurvey,
                    questions: [...(prevSurvey.questions || []), savedQuestion],
                }));
                setShowAddQuestionPanel(false);
                setSelectedQuestionId(savedQuestion._id);
                toast.success(`Question "${truncateText(savedQuestion.text, 20)}" created!`);
            } else {
                const errorMsg = `Failed to create question: ${response?.message || 'Invalid response.'}`;
                toast.error(errorMsg + (response?.field ? ` (Field: ${response.field})` : ''));
            }
        } catch (err) {
            const errorMsg = `Failed to create question: ${err.response?.data?.message || err.message}`;
            toast.error(errorMsg + (err.response?.data?.field ? ` (Field: ${err.response.data.field})` : ''));
        } finally {
            setSaving(false);
        }
    }, [survey]);

    const updateQuestion = useCallback(async (questionId, updates) => {
        if (!survey?._id) { toast.error("Survey not loaded."); return; }
        setSaving(true);
        const payload = { ...updates };
        delete payload._id;
        delete payload.survey;
        console.log("[SBP updateQuestion] Payload to API (updates from QEP):", JSON.stringify(payload, null, 2));
        try {
            const response = await surveyApi.updateQuestionContent(questionId, payload);
            if (response && response.success && response.data && response.data._id) {
                const updatedQuestionFromApi = response.data;
                console.log("[SBP updateQuestion] API response for update (updatedQuestionFromApi):", JSON.stringify(updatedQuestionFromApi, null, 2));
                setSurvey(prevSurvey => {
                    const updatedQuestions = (prevSurvey.questions || []).map(q =>
                        q._id === questionId ? { ...q, ...updatedQuestionFromApi } : q
                    );
                    return { ...prevSurvey, questions: updatedQuestions };
                });
                toast.success(`Question "${truncateText(updatedQuestionFromApi.text, 20)}" updated!`);
                setSelectedQuestionId(null); setShowAddQuestionPanel(false);
            } else {
                const errorMsg = `Failed to update question: ${response?.message || 'Invalid response.'}`;
                toast.error(errorMsg + (response?.field ? ` (Field: ${response.field})` : ''));
            }
        } catch (err) {
            toast.error(`Failed to update question: ${err.response?.data?.message || err.message}`);
        } finally {
            setSaving(false);
        }
    }, [survey]);

    const deleteQuestion = useCallback(async (questionIdToDelete) => {
        if (!survey?._id) { toast.error("Survey not loaded."); return; }
        const questionToDeleteText = survey.questions?.find(q => q._id === questionIdToDelete)?.text || "this question";
        if (!window.confirm(`Delete "${truncateText(questionToDeleteText, 30)}"?`)) return;
        setSaving(true);
        try {
            const response = await surveyApi.deleteQuestionById(questionIdToDelete);
            if (response && response.success) {
                setSurvey(prevSurvey => ({
                    ...prevSurvey,
                    questions: (prevSurvey.questions || []).filter(q => q._id !== questionIdToDelete),
                }));
                if (selectedQuestionId === questionIdToDelete) {
                    setSelectedQuestionId(null); setShowAddQuestionPanel(false);
                }
                toast.success(response.message || `Question "${truncateText(questionToDeleteText, 20)}" deleted.`);
            } else {
                const errorMsg = `Failed to delete question: ${response?.message || 'Invalid response.'}`;
                toast.error(errorMsg);
            }
        } catch (err) {
            toast.error(`Failed to delete question: ${err.response?.data?.message || err.message}`);
        } finally {
            setSaving(false);
        }
    }, [survey, selectedQuestionId]);

    const moveQuestion = useCallback((dragIndex, hoverIndex) => {
        setSurvey(prevSurvey => {
            if (!prevSurvey?.questions) return prevSurvey;
            const reorderedQuestions = Array.from(prevSurvey.questions);
            const [removed] = reorderedQuestions.splice(dragIndex, 1);
            reorderedQuestions.splice(hoverIndex, 0, removed);
            const finalReorderedQuestions = reorderedQuestions.map((q, index) => ({
                ...q,
                originalIndex: index 
            }));
            console.log("[SBP moveQuestion] New question order with updated originalIndex:", JSON.stringify(finalReorderedQuestions.map(q => ({id: q._id, text: q.text, originalIndex: q.originalIndex})), null, 2));
            toast.info("Order changed. Click 'Save Survey Structure'.");
            return { ...prevSurvey, questions: finalReorderedQuestions };
        });
    }, []);

    const handleSaveSurvey = async () => {
        if (!survey?._id) { toast.error("Survey data not available."); return; }
        if (!survey.title?.trim()) { toast.error("Survey title cannot be empty."); return; }
        setSaving(true);
        
        // Ensure questions have updated originalIndex based on current order in local state
        const questionsWithCorrectOrder = (survey.questions || []).map((q, index) => ({
            ...q,
            originalIndex: index
        }));
        
        const payload = {
            ...survey, // Spread existing survey data (like title, description, status, settings etc.)
            questions: questionsWithCorrectOrder, // Override questions with the correctly ordered ones
        };
        // Remove fields that backend might not expect or that are auto-managed (like collectors array here)
        delete payload.collectors; 
        
        console.log("[SBP handleSaveSurvey] Payload for survey update:", JSON.stringify(payload, null, 2));

        try {
            const response = await surveyApi.updateSurvey(survey._id, payload); 
            if (response && response.success && response.data) {
                const updatedApiSurvey = response.data;
                const questionsFromApi = (updatedApiSurvey.questions && updatedApiSurvey.questions.length > 0 && typeof updatedApiSurvey.questions[0] === 'object')
                                     ? updatedApiSurvey.questions.sort((a, b) => a.originalIndex - b.originalIndex)
                                     : (survey.questions || []).sort((a, b) => a.originalIndex - b.originalIndex);
                setSurvey(prev => ({
                    ...prev, 
                    ...updatedApiSurvey, 
                    questions: questionsFromApi, 
                }));
                toast.success('Survey structure saved successfully!');
            } else {
                toast.error(`Error saving survey: ${response?.message || 'Invalid response.'}`);
            }
        } catch (err) {
            let errorMsg = `Error saving survey: ${err.response?.data?.message || err.message || 'Unknown error'}.`;
            if (err.response?.data?.errors) {
                 errorMsg = `Error saving: ${Object.values(err.response.data.errors).map(e => e.message || e).join(', ')}`;
            }
            toast.error(errorMsg);
        } finally {
            setSaving(false);
        }
    };

    const handleSaveLogic = (updatedLogicRules) => {
        setSurvey(prev => ({ ...prev, globalSkipLogic: updatedLogicRules }));
        setIsLogicPanelOpen(false); 
        toast.info("Logic updated locally. Click 'Save Survey Structure'.");
    };

    // MODIFIED: handleSaveSettings to accept updatedSurveyData
    const handleSaveSettings = (updatedSurveyDataFromPanel) => {
        console.log("[SBP handleSaveSettings] Received from panel:", JSON.stringify(updatedSurveyDataFromPanel, null, 2));
        setSurvey(prevSurvey => {
            const newSurveyState = { ...prevSurvey };
            if (updatedSurveyDataFromPanel.hasOwnProperty('status')) {
                newSurveyState.status = updatedSurveyDataFromPanel.status;
            }
            if (updatedSurveyDataFromPanel.hasOwnProperty('settings')) {
                newSurveyState.settings = { 
                    ...(prevSurvey.settings || {}), 
                    ...updatedSurveyDataFromPanel.settings 
                };
            }
            // If other top-level fields were part of updatedSurveyDataFromPanel, handle them too
            // For now, assuming only status and settings object are passed.
            return newSurveyState;
        });
        setIsSettingsPanelOpen(false);
        toast.info("Settings (including status) updated locally. Click 'Save Survey Structure' to persist all survey changes.");
    };


    const handleOpenAddQuestionPanel = () => { setSelectedQuestionId(null); setShowAddQuestionPanel(true); };
    const handleQuestionClick = (id) => { setShowAddQuestionPanel(false); setSelectedQuestionId(id); };
    const handleCancelEditPanel = () => { setSelectedQuestionId(null); setShowAddQuestionPanel(false); };
    
    const handleUpdateQuestionDefinition = useCallback((questionId, updatedFields) => {
        setSurvey(prevSurvey => {
            if (!prevSurvey || !prevSurvey.questions) return prevSurvey;
            const updatedQuestions = prevSurvey.questions.map(q => 
                q._id === questionId ? { ...q, ...updatedFields } : q
            );
            toast.info(`Local question definition updated. Save survey structure to persist.`);
            return { ...prevSurvey, questions: updatedQuestions };
        });
        if (questionForAreaManagement && questionForAreaManagement._id === questionId) {
            setQuestionForAreaManagement(prev => prev ? { ...prev, ...updatedFields } : null);
        }
    }, [questionForAreaManagement]);

    const openAreaManagerModal = useCallback((questionToManage) => {
        if (questionToManage && questionToManage.type === 'heatmap' && questionToManage.imageUrl) {
            setQuestionForAreaManagement(questionToManage);
            setIsAreaManagerModalOpen(true);
        } else {
            toast.error("Cannot manage areas for this question type or image is missing.");
        }
    }, []);

    const handleSaveAreasFromModal = useCallback((updatedAreas) => {
        if (questionForAreaManagement) {
            handleUpdateQuestionDefinition(questionForAreaManagement._id, { definedHeatmapAreas: updatedAreas });
        }
        setIsAreaManagerModalOpen(false);
        setQuestionForAreaManagement(null);
    }, [questionForAreaManagement, handleUpdateQuestionDefinition]);

    const handleHeatmapModalDrawingStateChange = useCallback((drawingState) => {
        setIsHeatmapDrawingForModal(drawingState); 
    }, []);

    const selectedQData = survey?.questions?.find(q => q._id === selectedQuestionId);
    const shouldMakeSpaceForPanel = showAddQuestionPanel || !!selectedQData;

    if (loading && !pageError) return <div className={styles.pageLoading}>Loading survey builder...</div>;
    if (pageError) return (<div className={styles.pageErrorContainer}><h2>Error Loading Survey</h2><p>{pageError}</p>{routeSurveyId && <button onClick={() => fetchSurveyData()} disabled={loading}>Retry</button>}<button onClick={() => navigate('/admin')}>Admin Dashboard</button></div>);
    if (!survey) return (<div className={styles.pageErrorContainer}><h2>Survey Not Found</h2><p>Could not load survey data.</p><button onClick={() => navigate('/admin')}>Admin Dashboard</button></div>);

    return (
        <DndProvider backend={HTML5Backend}>
            <ToastContainer position="top-right" autoClose={3000} newestOnTop theme="colored" />
            <div className={styles.surveyBuildPage}>
                <div className={styles.surveyBuildPageInner}>
                    <header className={styles.surveyHeader}>
                        <input type="text" value={survey.title || ''} onChange={e => setSurvey(s => ({ ...s, title: e.target.value }))} className={styles.surveyTitleInput} placeholder="Survey Title" disabled={saving || loading || !survey._id} />
                        <div className={styles.headerActions}>
                            <button onClick={() => setIsCollectorsPanelOpen(true)} className="button button-secondary" disabled={saving || loading || !survey._id || isLoadingCollectors}>{isLoadingCollectors ? 'Loading...' : 'Collectors'} ({collectors.length})</button>
                            <button onClick={() => setIsSettingsPanelOpen(true)} className="button button-secondary" disabled={saving || loading || !survey._id}>Settings</button>
                            <button onClick={() => setIsLogicPanelOpen(true)} className="button button-secondary" disabled={saving || loading || !survey._id}>Logic</button>
                            <button onClick={handleSaveSurvey} className="button button-primary" disabled={saving || loading || !survey._id}>{saving ? 'Saving...' : 'Save Survey Structure'}</button>
                            <Link
                                to={`/surveys/${survey._id}/preview`}
                                className="button"
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{pointerEvents: (!survey._id || saving || loading) ? 'none' : 'auto', opacity: (!survey._id || saving || loading) ? 0.6 : 1}}
                            >
                                Preview
                            </Link>
                        </div>
                    </header>
                    <div className={styles.mainContentWrapper}>
                        <div className={shouldMakeSpaceForPanel ? styles.leftColumnWithPanelSpace : styles.leftColumnFullWidth}>
                            <div className={styles.questionListHeader}><h2>Questions</h2><button onClick={handleOpenAddQuestionPanel} className="button button-primary" disabled={saving || loading || !survey._id || showAddQuestionPanel}>+ Add New Question</button></div>
                            <div className={styles.questionsContainer}>
                                {(survey.questions && survey.questions.length > 0) ? survey.questions.map((q, index) => (
                                    <QuestionListItem key={q._id} index={index} question={q} isSelected={q._id === selectedQuestionId && !showAddQuestionPanel} onClick={() => handleQuestionClick(q._id)} onMove={moveQuestion} onDelete={() => deleteQuestion(q._id)} disabled={saving || loading} />
                                )) : (<p className={styles.noQuestionsMessage}>{loading ? 'Loading...' : (survey._id ? 'No questions yet. Click "+ Add New Question".' : 'Survey not loaded.')}</p>)}
                            </div>
                        </div>
                        {shouldMakeSpaceForPanel && (<div className={styles.rightColumnSizer}></div>)}
                    </div>
                </div>
                {showAddQuestionPanel && survey?._id && (<QuestionPropertiesPanel key="add-new-question-panel" questionData={null} mode="add" onSave={handleCreateQuestionFromPanel} onCancel={handleCancelEditPanel} isSaving={saving} allQuestions={survey.questions || []} questionIndex={-1} surveyId={survey._id} />)}
                {selectedQData && !showAddQuestionPanel && survey?._id && (<QuestionPropertiesPanel key={selectedQData._id} questionData={selectedQData} mode="edit" onSave={(payload) => updateQuestion(selectedQData._id, payload)} onCancel={handleCancelEditPanel} isSaving={saving} allQuestions={survey.questions || []} questionIndex={(survey.questions || []).findIndex(q => q._id === selectedQData._id)} surveyId={survey._id} />)}
                
                {isLogicPanelOpen && survey?._id && (
                    <div className={styles.modalBackdrop} onClick={() => setIsLogicPanelOpen(false)}>
                        <div className={styles.modalContentWrapper} onClick={e => e.stopPropagation()}>
                            <SurveyLogicPanel 
                                key={`logic-modal-${survey._id}`} 
                                initialRules={survey.globalSkipLogic || survey.logicRules || []} 
                                allQuestions={survey.questions || []} 
                                onSaveRules={handleSaveLogic} 
                                onClose={() => setIsLogicPanelOpen(false)} 
                                isLoading={saving} 
                                surveyId={survey._id}
                                onUpdateQuestionDefinition={handleUpdateQuestionDefinition}
                                onOpenAreaManager={openAreaManagerModal}
                            />
                        </div>
                    </div>
                )}

                {isAreaManagerModalOpen && questionForAreaManagement && (
                    <div 
                        className={`${styles.modalBackdrop} ${styles.heatmapModalBackdrop}`} 
                        onClick={() => { setIsAreaManagerModalOpen(false); setQuestionForAreaManagement(null);}}
                    >
                        <div className={`${styles.modalContentWrapper} ${styles.heatmapModalSpecificContentWrapper}`} 
                             onClick={e => e.stopPropagation()}>
                            <HeatmapAreaSelectorModal
                                isOpen={isAreaManagerModalOpen}
                                onClose={() => { setIsAreaManagerModalOpen(false); setQuestionForAreaManagement(null); }}
                                onSaveAreas={handleSaveAreasFromModal}
                                imageUrl={questionForAreaManagement.imageUrl}
                                initialAreas={ensureArray(questionForAreaManagement.definedHeatmapAreas)}
                                styles={styles} 
                                onDrawingStateChange={handleHeatmapModalDrawingStateChange}
                            />
                        </div>
                    </div>
                )}

                {/* MODIFIED: Pass the whole survey object to initialSurveyData */}
                {isSettingsPanelOpen && survey?._id && (
                    <SurveySettingsPanel
                        isOpen={isSettingsPanelOpen}
                        onClose={() => setIsSettingsPanelOpen(false)}
                        initialSurveyData={survey} // Pass the whole survey object
                        onSave={handleSaveSettings} 
                        surveyId={survey._id}
                    />
                )}

                {isCollectorsPanelOpen && survey?._id && (<CollectorsPanel isOpen={isCollectorsPanelOpen} onClose={() => setIsCollectorsPanelOpen(false)} surveyId={survey._id} collectors={collectors} onCollectorsUpdate={() => {
                    toast.info("Refreshing collectors..."); setIsLoadingCollectors(true);
                    surveyApi.getCollectorsForSurvey(survey._id)
                        .then(collectorsResponse => {
                            if (collectorsResponse && collectorsResponse.success) setCollectors(collectorsResponse.data || []);
                            else toast.error(`Could not refresh collectors: ${collectorsResponse?.message}`);
                        })
                        .catch(err => { toast.error("Could not refresh collectors."); })
                        .finally(() => setIsLoadingCollectors(false));
                }} isLoading={isLoadingCollectors} />)}
            </div>
        </DndProvider>
    );
};
export default SurveyBuildPage;
// ----- END OF COMPLETE UPDATED FILE (v1.9 - Integrate Survey Status in Settings Panel) -----