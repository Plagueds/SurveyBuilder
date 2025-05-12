// frontend/src/pages/SurveyPreviewPage.js
// ----- START OF COMPLETE MODIFIED FILE (v1.3 - More robust null checks for survey object) -----
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import surveyApiFunctions from '../api/surveyApi';
import './SurveyPreviewPage.css';

// --- IMPORT YOUR ACTUAL QUESTION COMPONENTS HERE ---
// (Assuming these are correct from your project)
import MultipleChoiceQuestion from '../components/survey_question_renders/MultipleChoiceQuestion';
import CheckboxQuestion from '../components/survey_question_renders/CheckboxQuestion';
import DropdownQuestion from '../components/survey_question_renders/DropdownQuestion';
import ShortTextQuestion from '../components/survey_question_renders/ShortTextQuestion';
import RatingQuestion from '../components/survey_question_renders/RatingQuestion';
import NpsQuestion from '../components/survey_question_renders/NpsQuestion';

// --- PLACEHOLDER IMPORTS FOR OTHER QUESTION TYPES ---
const PlaceholderQuestionComponent = ({ question, typeName, ...props }) => (
    <div style={{ padding: '10px', border: '1px dashed #ff9900', backgroundColor: '#fff8e1', borderRadius: '4px', marginTop: '10px' }}>
        <p><strong>{question.text}</strong></p>
        <p><em>(Placeholder for {typeName} - Component <code>{typeName}Question.js</code> needs to be implemented and imported.)</em></p>
    </div>
);

// Replace these with your actual component imports if they exist.
// For now, using placeholders to allow the page to load without crashing if components are missing.
const MatrixQuestion = (props) => <PlaceholderQuestionComponent {...props} typeName="Matrix" />;
const SliderQuestion = (props) => <PlaceholderQuestionComponent {...props} typeName="Slider" />;
const RankingQuestion = (props) => <PlaceholderQuestionComponent {...props} typeName="Ranking" />;
const HeatmapQuestion = (props) => <PlaceholderQuestionComponent {...props} typeName="Heatmap" />;
const MaxDiffQuestion = (props) => <PlaceholderQuestionComponent {...props} typeName="MaxDiff" />;
const ConjointQuestion = (props) => <PlaceholderQuestionComponent {...props} typeName="Conjoint" />;
const CardSortQuestion = (props) => <PlaceholderQuestionComponent {...props} typeName="CardSort" />;


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
        setSurvey(null); // Explicitly set survey to null at the start
        setAnswers({});
        try {
            const surveyDataResponse = await surveyApiFunctions.getSurveyById(surveyId);
            if (surveyDataResponse && surveyDataResponse.success && surveyDataResponse.data) {
                setSurvey(surveyDataResponse.data);
            } else {
                // If response is not successful or data is missing, ensure survey remains null
                setSurvey(null); 
                setError(surveyDataResponse?.message || 'Could not load survey data for preview.');
                console.warn("Survey data fetch not successful or data missing:", surveyDataResponse);
            }
        } catch (err) {
            setSurvey(null); // Ensure survey is null on catch
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
            setSurvey(null); // Ensure survey is null if no ID
            setIsLoading(false);
        }
    }, [surveyId, fetchSurveyForPreview]);

    const handleSimpleAnswerChange = useCallback((questionId, value) => { /* ... same as v1.2 ... */ setAnswers(prevAnswers => ({ ...prevAnswers, [questionId]: value, })); }, []);
    const handleOtherTextChange = useCallback((questionId, text) => { /* ... same as v1.2 ... */  setAnswers(prevAnswers => ({ ...prevAnswers, [`${questionId}_other`]: text, })); }, []);
    const handleCheckboxChange = useCallback((questionId, optionValue, isChecked) => { /* ... same as v1.2 ... */ setAnswers(prevAnswers => { const currentSelections = new Set(String(prevAnswers[questionId] || '').split('||').filter(v => v)); if (isChecked) { currentSelections.add(optionValue); } else { currentSelections.delete(optionValue); } const newAnswerValue = Array.from(currentSelections).join('||'); return { ...prevAnswers, [questionId]: newAnswerValue }; }); }, []);
    const handleMatrixChange = useCallback((questionId, matrixData) => { /* ... same as v1.2 ... */ setAnswers(prevAnswers => ({ ...prevAnswers, [questionId]: matrixData })); }, []);
    const handleComplexAnswerChange = useCallback((questionId, complexAnswerData) => { /* ... same as v1.2 ... */ setAnswers(prevAnswers => ({ ...prevAnswers, [questionId]: complexAnswerData })); }, []);

    const renderQuestion = (question, index) => {
        // Ensure question and question._id exist before proceeding
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

        switch (question.type) {
            case 'multiple-choice': return <MultipleChoiceQuestion {...commonQuestionProps} onAnswerChange={handleSimpleAnswerChange} />;
            case 'checkbox': return <CheckboxQuestion {...commonQuestionProps} onCheckboxChange={handleCheckboxChange} />;
            case 'dropdown': return <DropdownQuestion {...commonQuestionProps} onAnswerChange={handleSimpleAnswerChange} />;
            case 'text': case 'textarea': return <ShortTextQuestion {...commonQuestionProps} onAnswerChange={handleSimpleAnswerChange} />;
            case 'rating': return <RatingQuestion {...commonQuestionProps} onAnswerChange={handleSimpleAnswerChange} />;
            case 'nps': return <NpsQuestion {...commonQuestionProps} onAnswerChange={handleSimpleAnswerChange} />;
            case 'matrix': return <MatrixQuestion {...commonQuestionProps} onAnswerChange={handleMatrixChange} />;
            case 'slider': return <SliderQuestion {...commonQuestionProps} onAnswerChange={handleSimpleAnswerChange} />;
            case 'ranking': return <RankingQuestion {...commonQuestionProps} onAnswerChange={handleComplexAnswerChange} />;
            case 'heatmap': return <HeatmapQuestion {...commonQuestionProps} onAnswerChange={handleComplexAnswerChange} />;
            case 'maxdiff': return <MaxDiffQuestion {...commonQuestionProps} onAnswerChange={handleComplexAnswerChange} />;
            case 'conjoint': return <ConjointQuestion {...commonQuestionProps} onAnswerChange={handleComplexAnswerChange} />;
            case 'cardsort': return <CardSortQuestion {...commonQuestionProps} onAnswerChange={handleComplexAnswerChange} />;
            default:
                return (
                    <div className="preview-question-placeholder" style={{padding: '15px', border: '1px dashed #ccc', borderRadius: '4px', backgroundColor: '#f9f9f9', marginTop: '10px'}}>
                        <strong>Question {index + 1}: {question.text || '(No text provided)'}</strong>
                        <p><em>(Preview for type: "{question.type}" not yet implemented. Please add its component and case to SurveyPreviewPage.js's renderQuestion function.)</em></p>
                        {question.options && question.options.length > 0 && (
                            <div>Options: {question.options.map(opt => typeof opt === 'object' ? opt.text : opt).join(', ')}</div>
                        )}
                    </div>
                );
        }
    };

    const formatAnswersForSubmission = () => { /* ... same as v1.2 ... */ if (!survey || !survey.questions) return []; const submissionData = survey.questions.map(q => { if (!q || !q._id) return null; const questionId = q._id; let answerValue = answers[questionId]; const otherText = answers[`${questionId}_other`] || null; if (typeof answerValue === 'object' && answerValue !== null) { answerValue = JSON.stringify(answerValue); } else if (answerValue === undefined) { answerValue = null; } return { questionId: questionId, questionType: q.type, answerValue: answerValue, otherText: otherText, }; }).filter(Boolean); return submissionData; };
    const handleSimulateSubmit = async (e) => { /* ... same as v1.2 ... */ e.preventDefault(); if (recordResponse) { const submissionPayload = formatAnswersForSubmission(); console.log("Attempting to 'record' preview response:", submissionPayload); alert("Preview response 'recorded' (logged to console). Navigating to Thank You page."); navigate(`/survey/${surveyId}/thankyou-preview?recorded=true`); } else { alert("This is a preview. Responses are not submitted. Navigating to Thank You page."); navigate(`/survey/${surveyId}/thankyou-preview`); } };

    // --- Conditional Rendering Logic ---
    if (isLoading) {
        return (
            <div className="survey-preview-container loading-container">
                <div className="spinner"></div>
                <p>Loading Survey Preview...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="survey-preview-container error-container">
                <h2>Error Loading Preview</h2>
                <p>{error}</p>
                <button onClick={() => navigate(-1)} className="button-secondary">Go Back</button>
                <Link to="/admin" className="button-secondary" style={{marginLeft: '10px'}}>Admin Dashboard</Link>
            </div>
        );
    }

    // --- MORE ROBUST CHECK FOR SURVEY DATA BEFORE RENDERING MAIN CONTENT ---
    if (!survey || typeof survey !== 'object' || !survey.questions || !Array.isArray(survey.questions)) {
        // This case handles survey being null, not an object, or not having a questions array.
        // It also catches the initial state before fetchSurveyForPreview completes if it somehow bypasses isLoading.
        console.warn("Survey object is not valid for rendering:", survey);
        return (
            <div className="survey-preview-container">
                <p>Survey data is not available, incomplete, or could not be loaded.</p>
                <p>Please ensure the survey ID is correct and the survey exists.</p>
                <button onClick={fetchSurveyForPreview} className="button-primary" style={{marginRight: '10px'}}>Retry Loading</button>
                <Link to="/admin" className="button-secondary">Back to Admin Dashboard</Link>
            </div>
        );
    }

    // If all checks pass, render the survey
    return (
        <div className="survey-preview-container">
            <div className="survey-header">
                <h1>{survey.title || 'Untitled Survey'}</h1>
                {survey.description && <p className="survey-description">{survey.description}</p>}
                <p className="preview-notice">
                    <strong>Note:</strong> This is a preview mode. Your responses here are typically not saved.
                </p>
            </div>

            <form className="survey-form" onSubmit={handleSimulateSubmit}>
                {survey.questions.map((question, index) => (
                    // Added a check for question object validity before passing to renderQuestion
                    question && question._id ? (
                        <div key={question._id} className="question-container preview-question-item">
                            {renderQuestion(question, index)}
                            {index < survey.questions.length - 1 && <hr className="question-divider"/>}
                        </div>
                    ) : (
                        <div key={`invalid-q-${index}`} className="preview-question-placeholder error-placeholder">
                            Encountered invalid question data at position {index + 1}.
                        </div>
                    )
                ))}
                {survey.questions.length === 0 && (
                     <p className="no-questions-message">This survey currently has no questions defined.</p>
                )}
                
                <div className="preview-options">
                    <label htmlFor="recordResponseCheckbox">
                        <input 
                            type="checkbox" 
                            id="recordResponseCheckbox"
                            checked={recordResponse}
                            onChange={(e) => setRecordResponse(e.target.checked)}
                        />
                        Record this response (for testing purposes)
                    </label>
                </div>

                <div className="preview-actions">
                    <button 
                        type="submit" 
                        className="button-primary simulate-submit-button"
                    >
                        {recordResponse ? "Record Response & View Thank You" : "Simulate Submit & View Thank You"}
                    </button>
                </div>
            </form>
            <div className="navigation-buttons">
                <button onClick={() => navigate(-1)} className="button-secondary back-button">
                    Go Back
                </button>
                 <Link to={`/admin/surveys/${surveyId}/build`} className="button-secondary edit-button" style={{marginLeft: '10px'}}>
                    Edit Survey
                </Link>
            </div>
        </div>
    );
};

export default SurveyPreviewPage;
// ----- END OF COMPLETE MODIFIED FILE (v1.3) -----