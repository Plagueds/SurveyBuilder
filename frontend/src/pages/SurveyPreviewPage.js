// frontend/src/pages/SurveyPreviewPage.js
// ----- START OF COMPLETE MODIFIED FILE (v1.6 - Assumes complex question renderers will be created) -----
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import surveyApiFunctions from '../api/surveyApi';
import './SurveyPreviewPage.css';

// --- Standard Question Component Imports ---
import MultipleChoiceQuestion from '../components/survey_question_renders/MultipleChoiceQuestion';
import CheckboxQuestion from '../components/survey_question_renders/CheckboxQuestion';
import DropdownQuestion from '../components/survey_question_renders/DropdownQuestion';
import ShortTextQuestion from '../components/survey_question_renders/ShortTextQuestion';
import TextAreaQuestion from '../components/survey_question_renders/TextAreaQuestion'; // Correctly using TextAreaQuestion
import RatingQuestion from '../components/survey_question_renders/RatingQuestion';
import NpsQuestion from '../components/survey_question_renders/NpsQuestion';

// --- IMPORTS FOR COMPLEX QUESTION TYPES ---
// These components need to be created by you in the specified path.
// Example: frontend/src/components/survey_question_renders/MatrixQuestion.js
// If they are in a different path, you'll need to adjust these import statements.

import MatrixQuestion from '../components/survey_question_renders/MatrixQuestion';
import SliderQuestion from '../components/survey_question_renders/SliderQuestion';
import RankingQuestion from '../components/survey_question_renders/RankingQuestion';
import HeatmapQuestion from '../components/survey_question_renders/HeatmapQuestion';
import MaxDiffQuestion from '../components/survey_question_renders/MaxDiffQuestion';
import ConjointQuestion from '../components/survey_question_renders/ConjointQuestion';
import CardSortQuestion from '../components/survey_question_renders/CardSortQuestion';


const SurveyPreviewPage = () => {
    const { surveyId } = useParams();
    const navigate = useNavigate();
    const [survey, setSurvey] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [answers, setAnswers] = useState({});
    const [recordResponse, setRecordResponse] = useState(false);

    const fetchSurveyForPreview = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        setSurvey(null);
        setAnswers({});
        try {
            const surveyDataResponse = await surveyApiFunctions.getSurveyById(surveyId);
            if (surveyDataResponse && surveyDataResponse.success && surveyDataResponse.data) {
                setSurvey(surveyDataResponse.data);
            } else {
                setSurvey(null); 
                setError(surveyDataResponse?.message || 'Could not load survey data for preview.');
                console.warn("Survey data fetch not successful or data missing:", surveyDataResponse);
            }
        } catch (err) {
            setSurvey(null);
            setError(err.response?.data?.message || err.message || 'An error occurred while fetching the survey.');
            console.error("Error fetching survey for preview:", err);
        } finally {
            setIsLoading(false);
        }
    }, [surveyId]);

    useEffect(() => {
        if (surveyId) {
            fetchSurveyForPreview();
        } else {
            setError("No Survey ID provided for preview.");
            setSurvey(null);
            setIsLoading(false);
        }
    }, [surveyId, fetchSurveyForPreview]);

    const handleSimpleAnswerChange = useCallback((questionId, value) => { setAnswers(prevAnswers => ({ ...prevAnswers, [questionId]: value })); }, []);
    const handleOtherTextChange = useCallback((questionId, text) => { setAnswers(prevAnswers => ({ ...prevAnswers, [`${questionId}_other`]: text })); }, []);
    const handleCheckboxChange = useCallback((questionId, optionValue, isChecked) => { setAnswers(prevAnswers => { const currentSelections = new Set(String(prevAnswers[questionId] || '').split('||').filter(v => v)); if (isChecked) { currentSelections.add(optionValue); } else { currentSelections.delete(optionValue); } const newAnswerValue = Array.from(currentSelections).join('||'); return { ...prevAnswers, [questionId]: newAnswerValue }; }); }, []);
    const handleMatrixChange = useCallback((questionId, matrixData) => { setAnswers(prevAnswers => ({ ...prevAnswers, [questionId]: matrixData })); }, []);
    const handleComplexAnswerChange = useCallback((questionId, complexAnswerData) => { setAnswers(prevAnswers => ({ ...prevAnswers, [questionId]: complexAnswerData })); }, []);

    const renderQuestion = (question, index) => {
        if (!question || !question._id) {
            console.error("renderQuestion called with invalid question object:", question);
            return <div className="preview-question-placeholder error-placeholder">Invalid question data at index {index}.</div>;
        }
        const questionId = question._id;
        const commonQuestionProps = {
            key: questionId,
            question: question,
            currentAnswer: answers[questionId],
            disabled: false,
            isPreviewMode: true,
            optionsOrder: question.optionsOrder || null,
            otherValue: answers[`${questionId}_other`] || '',
            onOtherTextChange: handleOtherTextChange,
        };

        try { // Add a try-catch around component rendering for better error isolation if a component fails
            switch (question.type) {
                case 'multiple-choice': return <MultipleChoiceQuestion {...commonQuestionProps} onAnswerChange={handleSimpleAnswerChange} />;
                case 'checkbox': return <CheckboxQuestion {...commonQuestionProps} onCheckboxChange={handleCheckboxChange} />;
                case 'dropdown': return <DropdownQuestion {...commonQuestionProps} onAnswerChange={handleSimpleAnswerChange} />;
                case 'text': return <ShortTextQuestion {...commonQuestionProps} onAnswerChange={handleSimpleAnswerChange} />;
                case 'textarea': 
                    return <TextAreaQuestion {...commonQuestionProps} onAnswerChange={handleSimpleAnswerChange} />;
                case 'rating': return <RatingQuestion {...commonQuestionProps} onAnswerChange={handleSimpleAnswerChange} />;
                case 'nps': return <NpsQuestion {...commonQuestionProps} onAnswerChange={handleSimpleAnswerChange} />;
                
                // Cases for complex question types, assuming components are created
                case 'matrix': 
                    return <MatrixQuestion {...commonQuestionProps} onAnswerChange={handleMatrixChange} />;
                case 'slider': 
                    return <SliderQuestion {...commonQuestionProps} onAnswerChange={handleSimpleAnswerChange} />;
                case 'ranking': 
                    return <RankingQuestion {...commonQuestionProps} onAnswerChange={handleComplexAnswerChange} />;
                case 'heatmap': 
                    return <HeatmapQuestion {...commonQuestionProps} onAnswerChange={handleComplexAnswerChange} />;
                case 'maxdiff': 
                    return <MaxDiffQuestion {...commonQuestionProps} onAnswerChange={handleComplexAnswerChange} />;
                case 'conjoint': 
                    return <ConjointQuestion {...commonQuestionProps} onAnswerChange={handleComplexAnswerChange} />;
                case 'cardsort': 
                    return <CardSortQuestion {...commonQuestionProps} onAnswerChange={handleComplexAnswerChange} />;
                
                default:
                    console.warn(`[SurveyPreviewPage] No specific rendering component for question type: "${question.type}". QID: ${questionId}`);
                    return (
                        <div className="preview-question-placeholder default-placeholder" style={{padding: '15px', border: '1px dashed #6c757d', borderRadius: '4px', backgroundColor: '#f8f9fa', marginTop: '10px'}}>
                            <strong>Question {index + 1}: {question.text || '(No text provided)'}</strong>
                            <p><em>(Preview for question type: "{question.type}" is not yet available. A rendering component needs to be implemented and linked.)</em></p>
                        </div>
                    );
            }
        } catch (renderError) {
            console.error(`[SurveyPreviewPage] Error rendering component for question type: "${question.type}". QID: ${questionId}`, renderError);
            return (
                <div className="preview-question-placeholder error-placeholder" style={{padding: '15px', border: '1px solid #dc3545', borderRadius: '4px', backgroundColor: '#f8d7da', marginTop: '10px', color: '#721c24'}}>
                    <strong>Question {index + 1}: {question.text || '(No text provided)'}</strong>
                    <p><em>Error displaying preview for question type: "{question.type}". Check console for details.</em></p>
                </div>
            );
        }
    };

    const formatAnswersForSubmission = () => { /* ... same as v1.5 ... */ if (!survey || !survey.questions) return []; const submissionData = survey.questions.map(q => { if (!q || !q._id) return null; const questionId = q._id; let answerValue = answers[questionId]; const otherText = answers[`${questionId}_other`] || null; if (typeof answerValue === 'object' && answerValue !== null) { answerValue = JSON.stringify(answerValue); } else if (answerValue === undefined) { answerValue = null; } return { questionId: questionId, questionType: q.type, answerValue: answerValue, otherText: otherText, }; }).filter(Boolean); return submissionData; };
    const handleSimulateSubmit = async (e) => { /* ... same as v1.5 ... */ e.preventDefault(); if (recordResponse) { const submissionPayload = formatAnswersForSubmission(); console.log("Attempting to 'record' preview response (payload):", submissionPayload); alert("Preview response 'recorded' (logged to console). Navigating to Thank You page."); navigate(`/survey/${surveyId}/thankyou-preview?recorded=true`); } else { alert("This is a preview. Responses are not submitted. Navigating to Thank You page."); navigate(`/survey/${surveyId}/thankyou-preview`); } };

    if (isLoading) { /* ... same as v1.5 ... */ return (<div className="survey-preview-container loading-container"><div className="spinner"></div><p>Loading Survey Preview...</p></div>); }
    if (error) { /* ... same as v1.5 ... */ return (<div className="survey-preview-container error-container"><h2>Error Loading Preview</h2><p>{error}</p><button onClick={() => navigate(-1)} className="button-secondary">Go Back</button><Link to="/admin" className="button-secondary" style={{marginLeft: '10px'}}>Admin Dashboard</Link></div>); }
    if (!survey || typeof survey !== 'object' || !survey.questions || !Array.isArray(survey.questions)) { /* ... same as v1.5 ... */ console.warn("Survey object is not valid for rendering in preview:", survey); return (<div className="survey-preview-container"><p>Survey data is not available, incomplete, or could not be loaded.</p><p>Please ensure the survey ID is correct and the survey exists.</p><button onClick={fetchSurveyForPreview} className="button-primary" style={{marginRight: '10px'}}>Retry Loading</button><Link to="/admin" className="button-secondary">Back to Admin Dashboard</Link></div>); }

    return ( /* ... Main JSX structure same as v1.5 ... */ <div className="survey-preview-container"><div className="survey-header"><h1>{survey.title || 'Untitled Survey'}</h1>{survey.description && <p className="survey-description">{survey.description}</p>}<p className="preview-notice"><strong>Note:</strong> This is a preview mode. Your responses here are typically not saved.</p></div><form className="survey-form" onSubmit={handleSimulateSubmit}>{survey.questions.map((question, index) => ((question && question._id) ? (<div key={question._id} className="question-container preview-question-item">{renderQuestion(question, index)}{index < survey.questions.length - 1 && <hr className="question-divider"/>}</div>) : (<div key={`invalid-q-${index}`} className="preview-question-placeholder error-placeholder">Encountered invalid question data at position {index + 1}.</div>)))}{survey.questions.length === 0 && (<p className="no-questions-message">This survey currently has no questions defined.</p>)}<div className="preview-options"><label htmlFor="recordResponseCheckbox"><input type="checkbox" id="recordResponseCheckbox" checked={recordResponse} onChange={(e) => setRecordResponse(e.target.checked)}/>Record this response (for testing purposes)</label></div><div className="preview-actions"><button type="submit" className="button-primary simulate-submit-button">{recordResponse ? "Record Response & View Thank You" : "Simulate Submit & View Thank You"}</button></div></form><div className="navigation-buttons"><button onClick={() => navigate(-1)} className="button-secondary back-button">Go Back</button><Link to={`/admin/surveys/${surveyId}/build`} className="button-secondary edit-button" style={{marginLeft: '10px'}}>Edit Survey</Link></div></div> );
};

export default SurveyPreviewPage;
// ----- END OF COMPLETE MODIFIED FILE (v1.6) -----