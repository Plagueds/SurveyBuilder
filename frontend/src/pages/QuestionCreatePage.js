// frontend/src/pages/QuestionCreatePage.js
// ----- START OF COMPLETE UPDATED FILE -----
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import QuestionCreateForm from '../components/QuestionCreateForm'; // Import the form

function QuestionCreatePage() {
    const navigate = useNavigate();
    const [feedback, setFeedback] = useState('');
    const [error, setError] = useState('');

    // Callback for when the form successfully creates a question
    const handleQuestionCreated = (createdQuestion) => {
        console.log('QuestionCreatePage: Navigating back to list after creation.', createdQuestion);
         // Set feedback briefly before navigating
        setFeedback(`Question "${createdQuestion.text}" created successfully! Redirecting...`);
        setError(''); // Clear any previous error
        setTimeout(() => {
            navigate('/admin/questions'); // Navigate to the question list page
        }, 1500); // Delay navigation slightly
    };

    return (
        // Remove inline styles, rely on .main-content from App.js
        // Optionally add a specific class if more styling is needed: <div className="create-page-container">
        <div>
            {/* Header Section */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px',
                paddingBottom: '10px', // Add some padding below the header
                borderBottom: `1px solid var(--border-color)`, // Use theme variable for subtle separation
                flexWrap: 'wrap', // Allow wrapping
                gap: '10px' // Add gap
            }}>
                {/* Heading inherits themed color */}
                <h1 style={{ margin: 0 }}>Create New Question</h1>
                {/* Button uses themed class */}
                <Link to="/admin/questions" className="button button-secondary">
                    Cancel (Back to List)
                </Link>
            </div>

            {/* Display feedback/error messages using Theme Variables */}
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


            {/* Render the QuestionCreateForm component */}
            {/* Pass down the callback and state setters */}
            <QuestionCreateForm
                onQuestionCreated={handleQuestionCreated}
                setFeedback={setFeedback} // Allow form to set feedback message
                setError={setError}       // Allow form to set error message
            />
        </div>
    );
}

export default QuestionCreatePage;
// ----- END OF COMPLETE UPDATED FILE -----