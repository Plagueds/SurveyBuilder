// frontend/src/pages/SurveyPreviewPage.js
// ----- START OF COMPLETE MODIFIED FILE (v1.1 - Implemented renderQuestion) -----
import React, { useState, useEffect, useCallback } from 'react'; // Added useCallback
import { useParams, Link, useNavigate } from 'react-router-dom'; // Added useNavigate
import surveyApiFunctions from '../api/surveyApi';
import './SurveyPreviewPage.css'; // Ensure this CSS file exists and is styled

// --- IMPORT YOUR ACTUAL QUESTION COMPONENTS HERE ---
import MultipleChoiceQuestion from '../components/survey_question_renders/MultipleChoiceQuestion';
import CheckboxQuestion from '../components/survey_question_renders/CheckboxQuestion';
import DropdownQuestion from '../components/survey_question_renders/DropdownQuestion';
import ShortTextQuestion from '../components/survey_question_renders/ShortTextQuestion';
import RatingQuestion from '../components/survey_question_renders/RatingQuestion';
import NpsQuestion from '../components/survey_question_renders/NpsQuestion';
// Import other question types as you have them (e.g., Matrix, Slider, Ranking etc.)
// For types not yet imported, they will fall through to the default case.
// Example:
// import MatrixQuestion from '../components/survey_question_renders/MatrixQuestion';
// import SliderQuestion from '../components/survey_question_renders/SliderQuestion';
// import RankingQuestion from '../components/survey_question_renders/RankingQuestion';


const SurveyPreviewPage = () => {
    const { surveyId } = useParams();
    const navigate = useNavigate();
    const [survey, setSurvey] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [answers, setAnswers] = useState({}); // To make questions interactive

    const fetchSurveyForPreview = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        setSurvey(null); // Clear previous survey data
        try {
            const surveyDataResponse = await surveyApiFunctions.getSurveyById(surveyId);
            if (surveyDataResponse && surveyDataResponse.success && surveyDataResponse.data) {
                setSurvey(surveyDataResponse.data);
            } else {
                setError(surveyDataResponse?.message || 'Could not load survey for preview.');
            }
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'An error occurred while fetching the survey.');
            console.error("Error fetching survey for preview:", err);
        } finally {
            setIsLoading(false);
        }
    }, [surveyId]); // surveyId is the dependency

    useEffect(() => {
        if (surveyId) {
            fetchSurveyForPreview();
        } else {
            setError("No Survey ID provided for preview.");
            setIsLoading(false);
        }
    }, [surveyId, fetchSurveyForPreview]); // fetchSurveyForPreview is now a dependency

    // --- THIS IS WHERE YOU RENDER YOUR ACTUAL QUESTION COMPONENTS ---
    const renderQuestion = (question, index) => {
        // Common props for most question types
        const commonQuestionProps = {
            question: question,
            currentAnswer: answers[question._id],
            disabled: false, // Questions are interactive in preview
            isPreviewMode: true, // Pass this prop if your question components can use it
            optionsOrder: question.optionsOrder || null, // If you have randomized order stored
            // For "other" text input in MCQs, Checkboxes, Dropdowns
            otherValue: answers[question._id + '_other'] || '',
            onOtherTextChange: (questionId, text) => {
                setAnswers(prevAnswers => ({
                    ...prevAnswers,
                    [questionId + '_other']: text,
                }));
                console.log(`Preview Mode: QID ${questionId} other text updated:`, text);
            },
        };

        // Specific handler for simple value changes (most components)
        const handleSimpleAnswerChange = (questionId, value) => {
            setAnswers(prevAnswers => ({
                ...prevAnswers,
                [questionId]: value,
            }));
            console.log(`Preview Mode: QID ${questionId} answered with:`, value);
        };

        // Specific handler for checkbox changes
        const handleCheckboxChange = (questionId, optionValue, isChecked) => {
            setAnswers(prevAnswers => {
                const currentSelections = new Set(String(prevAnswers[questionId] || '').split('||').filter(v => v));
                if (isChecked) {
                    currentSelections.add(optionValue);
                } else {
                    currentSelections.delete(optionValue);
                }
                const newAnswerValue = Array.from(currentSelections).join('||');
                console.log(`Preview Mode: QID ${questionId} checkbox ${optionValue} changed to ${isChecked}. New value: ${newAnswerValue}`);
                return {
                    ...prevAnswers,
                    [questionId]: newAnswerValue
                };
            });
        };

        switch (question.type) {
            case 'multiple-choice':
                return <MultipleChoiceQuestion {...commonQuestionProps} onAnswerChange={handleSimpleAnswerChange} />;
            case 'checkbox':
                // CheckboxQuestion expects onCheckboxChange instead of onAnswerChange for its primary interaction
                return <CheckboxQuestion {...commonQuestionProps} onCheckboxChange={handleCheckboxChange} />;
            case 'dropdown':
                return <DropdownQuestion {...commonQuestionProps} onAnswerChange={handleSimpleAnswerChange} />;
            case 'text':
            case 'textarea': // Assuming ShortTextQuestion handles both by adjusting rows or input type internally
                return <ShortTextQuestion {...commonQuestionProps} onAnswerChange={handleSimpleAnswerChange} />;
            case 'rating':
                return <RatingQuestion {...commonQuestionProps} onAnswerChange={handleSimpleAnswerChange} />;
            case 'nps':
                return <NpsQuestion {...commonQuestionProps} onAnswerChange={handleSimpleAnswerChange} />;
            
            // --- ADD CASES FOR YOUR OTHER QUESTION TYPES HERE ---
            // Make sure to pass the correct props, especially the answer change handler.
            // Example for a hypothetical MatrixQuestion:
            // case 'matrix':
            //     return <MatrixQuestion {...commonQuestionProps} onAnswerChange={handleSimpleAnswerChange} />;
            // Example for a hypothetical SliderQuestion:
            // case 'slider':
            //     return <SliderQuestion {...commonQuestionProps} onAnswerChange={handleSimpleAnswerChange} />;
            
            default:
                return (
                    <div className="preview-question-placeholder" style={{padding: '15px', border: '1px dashed #ccc', borderRadius: '4px', backgroundColor: '#f9f9f9', marginTop: '10px'}}>
                        <strong>Question {index + 1}: {question.text}</strong>
                        <p><em>(Preview for type: "{question.type}" not yet implemented. Please add its component and case to SurveyPreviewPage.js's renderQuestion function.)</em></p>
                        {question.options && question.options.length > 0 && (
                            <div>Options: {question.options.map(opt => typeof opt === 'object' ? opt.text : opt).join(', ')}</div>
                        )}
                    </div>
                );
        }
    };


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

    if (!survey) {
        return (
            <div className="survey-preview-container">
                <p>Survey data not found or could not be loaded.</p>
                <Link to="/admin" className="button-secondary">Back to Admin Dashboard</Link>
            </div>
        );
    }

    return (
        <div className="survey-preview-container">
            <div className="survey-header">
                <h1>{survey.title}</h1>
                {survey.description && <p className="survey-description">{survey.description}</p>}
                <p className="preview-notice">
                    <strong>Note:</strong> This is a preview mode. Your responses here will not be saved or submitted.
                </p>
            </div>

            <form className="survey-form" onSubmit={(e) => e.preventDefault()}>
                {survey.questions && survey.questions.length > 0 ? (
                    survey.questions.map((question, index) => (
                        // Ensure each question has a unique key, question._id is preferred
                        <div key={question._id || `preview-q-${index}`} className="question-container preview-question-item">
                            {/* The renderQuestion function will handle the actual component rendering */}
                            {renderQuestion(question, index)}
                            {/* Add a visual separator between questions if desired */}
                            {index < survey.questions.length - 1 && <hr className="question-divider"/>}
                        </div>
                    ))
                ) : (
                    <p className="no-questions-message">This survey currently has no questions defined.</p>
                )}
                <div className="preview-actions">
                    <button 
                        type="button" 
                        onClick={() => alert("This is a preview. Responses are not submitted.")} 
                        className="button-primary simulate-submit-button"
                    >
                        Simulate Submit (No Action)
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
// ----- END OF COMPLETE MODIFIED FILE (v1.1 - Implemented renderQuestion) -----