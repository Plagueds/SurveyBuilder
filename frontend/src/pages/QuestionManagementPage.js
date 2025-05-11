// frontend/src/pages/QuestionManagementPage.js
// ----- START OF COMPLETE UPDATED FILE -----
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';

function QuestionManagementPage() {
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [feedback, setFeedback] = useState('');

    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';

    // Fetch Questions Function
    const fetchQuestions = useCallback(async () => {
        console.log("Fetching questions for management...");
        setLoading(true);
        setError(null);
         // Clear feedback slightly delayed to allow user to read it
         // setTimeout(() => setFeedback(''), 1500);
        try {
            const response = await fetch(`${apiUrl}/api/questions`);
            if (!response.ok) {
                let errorMsg = `HTTP error! Status: ${response.status}`;
                try { const errorData = await response.json(); errorMsg = errorData.message || errorMsg; } catch (e) {}
                throw new Error(errorMsg);
            }
            const data = await response.json();
            console.log("Questions fetched successfully:", data);
            setQuestions(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("Failed to fetch questions:", err);
            setError(err.message || "Could not load questions.");
            setQuestions([]);
        } finally {
            setLoading(false);
            console.log("Finished fetching questions.");
        }
    }, [apiUrl]);

    // Fetch questions on component mount
    useEffect(() => {
        fetchQuestions();
    }, [fetchQuestions]);

    // Handle Question Deletion
    const handleDeleteQuestion = async (questionId, questionText) => {
        if (!window.confirm(`Are you sure you want to delete the question "${questionText}"?\nThis will also delete ALL associated answers and cannot be undone.`)) {
            return;
        }

        console.log(`Attempting to delete question ID: ${questionId}`);
        setFeedback(`Deleting question "${questionText}"...`);
        setError(null);

        try {
            const response = await fetch(`${apiUrl}/api/questions/${questionId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                let errorMsg = `Failed to delete question. Status: ${response.status}`;
                try { const errData = await response.json(); errorMsg = errData.message || errorMsg; } catch (e) {}
                throw new Error(errorMsg);
            }

            const result = await response.json();
            console.log('Question deleted response:', result);
            setFeedback(`Question "${questionText}" and its answers deleted successfully.`);
             // Refresh the list after successful deletion
            fetchQuestions();

        } catch (err) {
            console.error(`Failed to delete question ${questionId}:`, err);
            setError(`Error deleting question: ${err.message}`);
            setFeedback('');
        } finally {
              // Clear feedback after a delay
             setTimeout(() => setFeedback(''), 3000);
        }
    };

    return (
        // Remove inline styles, rely on .main-content from App.js
        <div>
            {/* Headings and paragraphs inherit themed styles */}
            <h1>Manage Questions</h1>
            <p>View, create, edit, and delete survey questions.</p>

            {/* Action Buttons Section */}
            <div style={{
                marginBottom: '20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap', // Allow wrapping on small screens
                gap: '10px' // Add gap between buttons
            }}>
                {/* Buttons use themed classes */}
                <Link to="/admin/questions/new" className="button button-primary">
                    Create New Question
                </Link>
                <Link to="/admin" className="button button-secondary">
                    Back to Admin Dashboard
                </Link>
            </div>


            {/* Display Feedback/Error Messages using Theme Variables */}
            {feedback && (
                <p style={{
                    color: 'var(--success-text)',
                    backgroundColor: 'var(--success-bg)',
                    border: `1px solid var(--success-border)`,
                    padding: '10px',
                    margin: '10px 0',
                    borderRadius: '4px'
                 }}>
                    {feedback}
                </p>
            )}
            {error && (
                <p style={{
                    color: 'var(--error-text)',
                    backgroundColor: 'var(--error-bg)',
                    border: `1px solid var(--error-border)`,
                    padding: '10px',
                    margin: '10px 0',
                    borderRadius: '4px'
                }}>
                    Error: {error}
                </p>
            )}

            {/* --- Questions List --- */}
            <h2>Existing Questions</h2>

            {/* Loading message inherits themed text color */}
            {loading && <p>Loading questions list...</p>}

            {!loading && questions.length === 0 && !error && (
                <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}> {/* Use theme variable */}
                    No questions found. Click "Create New Question" to add one.
                </p>
            )}

            {!loading && questions.length > 0 && (
                // Use the themed table class from App.css
                // Add container for responsiveness
                <div className="question-list-container">
                    <table className="question-table">
                        <thead>
                            <tr>
                                {/* Define widths for better layout control */}
                                <th style={{ width: '50%' }}>Question Text</th>
                                <th style={{ width: '15%' }}>Type</th>
                                <th style={{ width: '10%', textAlign: 'center' }}>Answers</th>
                                <th style={{ width: '25%', textAlign: 'center' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {questions.map((q) => (
                                <tr key={q._id}>
                                    {/* Table cells inherit themed styles */}
                                    {/* Apply word-wrap style directly if needed */}
                                    <td style={{ wordWrap: 'break-word' }}>{q.text}</td>
                                    <td>{q.type}</td>
                                    <td style={{ textAlign: 'center' }}>
                                         {/* Display answer count if available, otherwise N/A */}
                                        {typeof q.answerCount === 'number' ? q.answerCount : 'N/A'}
                                    </td>
                                    {/* Use flexbox for button alignment within the cell */}
                                    <td style={{ textAlign: 'center' }}>
                                        <div style={{ display: 'flex', gap: '5px', justifyContent: 'center', flexWrap: 'wrap' }}>
                                            {/* Buttons use themed classes */}
                                            <Link
                                                to={`/admin/questions/${q._id}/edit`}
                                                className="button button-small button-secondary"
                                            >
                                                Edit
                                            </Link>
                                            {/* Optional: Link to Single Question Results */}
                                            {/* <Link to={`/results/${q._id}`} ... >Answers</Link> */}
                                            <button
                                                className="button button-small button-danger"
                                                onClick={() => handleDeleteQuestion(q._id, q.text)}
                                                disabled={loading || !!feedback} // Disable while loading or showing feedback
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

export default QuestionManagementPage;
// ----- END OF COMPLETE UPDATED FILE -----