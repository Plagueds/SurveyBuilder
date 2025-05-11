// frontend/src/pages/SurveyPreviewPage.js
// ----- START OF COMPLETE NEW FILE -----
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import surveyApiFunctions from '../api/surveyApi';
import './SurveyPreviewPage.css'; // Create this CSS file for styling
// You'll likely need your Question components here, same as in SurveyTakingPage
// import MultipleChoiceQuestion from '../components/Questions/MultipleChoiceQuestion';
// import TextQuestion from '../components/Questions/TextQuestion';
// ... etc.

const SurveyPreviewPage = () => {
    const { surveyId } = useParams();
    const [survey, setSurvey] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    // eslint-disable-next-line no-unused-vars
    const [answers, setAnswers] = useState({}); // To make questions interactive, but won't be submitted

    useEffect(() => {
        const fetchSurveyForPreview = async () => {
            setIsLoading(true);
            setError(null);
            try {
                // Using getSurveyById which fetches the survey structure including questions
                const surveyData = await surveyApiFunctions.getSurveyById(surveyId);
                if (surveyData.success) {
                    setSurvey(surveyData.data);
                } else {
                    setError(surveyData.message || 'Could not load survey for preview.');
                }
            } catch (err) {
                setError(err.message || 'An error occurred while fetching the survey.');
                console.error("Error fetching survey for preview:", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchSurveyForPreview();
    }, [surveyId]);

    const handleAnswerChange = (questionId, value) => {
        // This function allows interaction with questions in preview mode
        // It's similar to what SurveyTakingPage would do, but answers are not submitted
        setAnswers(prevAnswers => ({
            ...prevAnswers,
            [questionId]: value,
        }));
        console.log(`Preview: Answered Q${questionId} with:`, value);
    };


    if (isLoading) {
        return (
            <div className="survey-preview-container">
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
                <Link to="/admin" className="button-secondary">Back to Admin</Link>
            </div>
        );
    }

    if (!survey) {
        return (
            <div className="survey-preview-container">
                <p>Survey data not found.</p>
                <Link to="/admin" className="button-secondary">Back to Admin</Link>
            </div>
        );
    }

    return (
        <div className="survey-preview-container">
            <div className="survey-header">
                <h1>{survey.title}</h1>
                {survey.description && <p className="survey-description">{survey.description}</p>}
                <p className="preview-notice"><strong>Note:</strong> This is a preview. Responses will not be saved.</p>
            </div>

            <form className="survey-form" onSubmit={(e) => e.preventDefault()}>
                {survey.questions && survey.questions.length > 0 ? (
                    survey.questions.map((question, index) => (
                        <div key={question._id || index} className="question-container preview-question">
                            <h3>Question {index + 1}: {question.text}</h3>
                            {/* 
                                RENDER YOUR QUESTION COMPONENTS HERE
                                This part needs to be adapted from your SurveyTakingPage
                                or your question rendering logic.
                                Example:
                            */}
                            {/* {question.type === 'multiple-choice' && (
                                <MultipleChoiceQuestion
                                    question={question}
                                    onAnswerChange={(value) => handleAnswerChange(question._id, value)}
                                    currentAnswer={answers[question._id]}
                                    isPreviewMode={true}
                                />
                            )}
                            {question.type === 'text' && (
                                <TextQuestion
                                    question={question}
                                    onAnswerChange={(value) => handleAnswerChange(question._id, value)}
                                    currentAnswer={answers[question._id]}
                                    isPreviewMode={true}
                                />
                            )} */}
                            <p><em>(Question Type: {question.type} - Render actual component here)</em></p>
                            <hr />
                        </div>
                    ))
                ) : (
                    <p>This survey has no questions yet.</p>
                )}
                <div className="preview-actions">
                    <button type="button" onClick={() => window.alert("This is a preview. Responses are not submitted.")} className="button-primary">
                        Simulate Submit (No Action)
                    </button>
                </div>
            </form>
             <Link to="/admin" className="button-secondary back-button">Back to Admin Dashboard</Link>
        </div>
    );
};

export default SurveyPreviewPage;
// ----- END OF COMPLETE NEW FILE -----