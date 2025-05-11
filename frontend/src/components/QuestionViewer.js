// frontend/src/components/QuestionViewer.js
// ----- START OF COMPLETE UPDATED FILE -----
import React, { useState, useEffect } from 'react';
import './QuestionViewer.css';

// Define constants for special values
const NA_VALUE = "N/A"; // Value used for Not Applicable option
const OTHER_VALUE_MC = "__OTHER_MC__"; // Internal value for MC Other button
const OTHER_KEY_CB = "Other"; // Value for Checkbox Other option
const OTHER_VALUE_DD = "__OTHER_DD__"; // Internal value for Dropdown Other option

function QuestionViewer({ surveyId, question, questionNumber, totalQuestions, onAnswerSubmit, sessionId, onCancelSurvey }) {

    // --- MODIFIED STATE: Adapt selectedAnswer based on type ---
    const getInitialState = () => {
        if (question?.type === 'checkbox') return {};
        // Potentially load previous response here if implemented
        return null;
    };
    const [selectedAnswer, setSelectedAnswer] = useState(getInitialState);
    // --- END MODIFIED STATE ---

    const [otherText, setOtherText] = useState('');
    const [isOtherSelectedMC, setIsOtherSelectedMC] = useState(false);
    // --- ADDED STATE: Track if Dropdown 'Other' is selected ---
    const [isOtherSelectedDD, setIsOtherSelectedDD] = useState(false);
    // --- END ADDED STATE ---
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';

    // Reset state when the question prop changes
    useEffect(() => {
        setSelectedAnswer(getInitialState()); // Use function to reset based on type
        setOtherText('');
        setIsOtherSelectedMC(false);
        setIsOtherSelectedDD(false); // Reset dropdown other state
        setError('');
        setIsSubmitting(false);
        console.log(`QuestionViewer received Q${questionNumber} (${question?._id}, type: ${question?.type}) for survey ${surveyId}`);
    }, [question, questionNumber, surveyId]);

    // Event Handlers
    const handleSingleSelection = (answerValue) => {
        setSelectedAnswer(answerValue);
        // Handle 'Other' visibility based on type
        if (question?.type === 'multiple-choice') {
            setIsOtherSelectedMC(answerValue === OTHER_VALUE_MC);
            if (answerValue !== OTHER_VALUE_MC) setOtherText(''); // Clear text if other not selected
        } else if (question?.type === 'dropdown') {
            setIsOtherSelectedDD(answerValue === OTHER_VALUE_DD);
            if (answerValue !== OTHER_VALUE_DD) setOtherText(''); // Clear text if other not selected
        }
        setError('');
    };

    const handleCheckboxChange = (optionValue, isChecked) => {
        setSelectedAnswer(prevSelected => {
            const newSelected = { ...prevSelected };
            if (optionValue === NA_VALUE && isChecked) return { [NA_VALUE]: true }; // N/A exclusivity
            if (optionValue !== NA_VALUE && isChecked && newSelected[NA_VALUE]) delete newSelected[NA_VALUE]; // Uncheck N/A if other selected
            if (isChecked) newSelected[optionValue] = true;
            else {
                delete newSelected[optionValue];
                if (optionValue === OTHER_KEY_CB) setOtherText(''); // Clear text if 'Other' checkbox unchecked
            }
            return newSelected;
        });
        setError('');
    };

    const handleOtherTextChange = (e) => {
        setOtherText(e.target.value);
        if (error) setError('');
    };

    // Submission Logic
    const handleSubmit = async () => {
        let isValid = false;
        let answerToSend = null;

        // Validation and Data Preparation (Added Dropdown Case)
        switch (question.type) {
            case 'multiple-choice':
                if (selectedAnswer === OTHER_VALUE_MC) {
                    if (otherText.trim() !== '') { isValid = true; answerToSend = otherText.trim(); } // Send only the text for 'Other'
                    else { setError("Please enter your 'Other' answer."); }
                } else if (selectedAnswer !== null && selectedAnswer !== undefined) { isValid = true; answerToSend = selectedAnswer; }
                else { setError("Please select an option."); }
                break;
            // --- ADDED DROPDOWN CASE ---
            case 'dropdown':
                if (selectedAnswer === OTHER_VALUE_DD) {
                    if (otherText.trim() !== '') { isValid = true; answerToSend = otherText.trim(); } // Send only the text for 'Other'
                    else { setError("Please enter your 'Other' answer."); }
                } else if (selectedAnswer !== null && selectedAnswer !== undefined && selectedAnswer !== "") { // Check for empty string too
                    isValid = true; answerToSend = selectedAnswer;
                } else { setError("Please select an option."); }
                break;
            // --- END ADDED DROPDOWN CASE ---
            case 'checkbox':
                const selectedKeys = Object.keys(selectedAnswer).filter(key => selectedAnswer[key] === true);
                if (selectedKeys.length > 0) {
                    if (selectedKeys.includes(OTHER_KEY_CB)) {
                        if (otherText.trim() !== '') { isValid = true; answerToSend = selectedKeys.map(key => key === OTHER_KEY_CB ? otherText.trim() : key); } // Map 'Other' key to text
                        else { setError("Please enter your 'Other' answer when the 'Other' checkbox is selected."); }
                    } else { isValid = true; answerToSend = selectedKeys; }
                } else { setError("Please select at least one option."); }
                break;
            case 'rating': case 'nps': case 'text':
                 isValid = selectedAnswer !== null && selectedAnswer !== undefined && String(selectedAnswer).trim() !== '';
                 if (isValid) { answerToSend = selectedAnswer; }
                 else { setError("Please provide an answer."); }
                 break;
            default: setError("Unsupported question type."); break;
        }

        if (!isValid) return;

        setIsSubmitting(true);
        setError('');

        const answerData = {
            surveyId: surveyId,
            questionId: question._id,
            answerValue: answerToSend, // Use the prepared value
            sessionId: sessionId,
        };

        console.log(`QuestionViewer: Submitting answer for Q${questionNumber} (QID: ${question._id}, SID: ${surveyId}):`, answerData);

        try {
            // Use a more specific endpoint if available, otherwise fallback
            // Assuming a single endpoint /api/answers for simplicity now
            const response = await fetch(`${apiUrl}/api/answers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(answerData),
            });

            if (!response.ok) { /* ... error handling ... */ throw new Error(`Failed to submit answer. Status: ${response.status}`); }

            const responseData = await response.json();
            console.log(`QuestionViewer: Answer for ${question._id} submitted successfully. Response:`, responseData);
            onAnswerSubmit(answerData);

        } catch (err) {
            console.error(`QuestionViewer: Failed to submit answer for question ${question._id}:`, err);
            setError(`Error submitting answer: ${err.message}. Please try again.`);
            setIsSubmitting(false);
        }
    };

    // Rendering Logic (Added Dropdown Case)
    const renderQuestionInput = () => {
        if (!question) return null;

        // Helper Functions for Rendering
        const renderOptions = (options) => options.map((option, index) => (<button key={index} onClick={() => handleSingleSelection(option)} className={`option-button ${selectedAnswer === option ? 'selected' : ''}`} disabled={isSubmitting}>{option}</button>));
        const renderCheckboxes = (options) => options.map((option, index) => (<div key={index} className="checkbox-item"><input type="checkbox" id={`q${question._id}-option${index}`} value={option} checked={!!selectedAnswer?.[option]} onChange={(e) => handleCheckboxChange(option, e.target.checked)} disabled={isSubmitting || (!!selectedAnswer?.[NA_VALUE] && option !== NA_VALUE)} className="checkbox-input" /><label htmlFor={`q${question._id}-option${index}`} className="checkbox-label">{option}</label></div>));
        // --- MODIFIED: Pass boolean flag ---
        const renderOtherTextInput = (isVisible) => (
             isVisible && (<div className="other-input-container"><textarea rows={question.type === 'text' ? 4 : 2} value={otherText} onChange={handleOtherTextChange} placeholder="Please specify" className="other-text-input" disabled={isSubmitting}/></div>)
        );
        // --- END MODIFICATION ---

        // --- ADDED: Dropdown specific filtering ---
        const getDropdownOptions = () => {
            // Assume question object has allowNA and allowOther flags
            const allowNA = question.allowNA || false;
            const allowOther = question.allowOther || false;

            // Filter out internal NA/Other values from the base options
            const baseOptions = (question.options || []).filter(opt =>
                opt !== NA_VALUE && opt !== OTHER_VALUE_DD // Filter out internal values if they somehow got into options
                // Also check against display text if needed, but internal value is safer
            );

            return (
                <select
                    id={`q-${question._id}`}
                    value={selectedAnswer === null ? "" : selectedAnswer} // Handle null state for controlled component
                    onChange={(e) => handleSingleSelection(e.target.value)}
                    className="dropdown-select" // Add specific class if needed
                    disabled={isSubmitting}
                    aria-required={question.isRequired} // Assuming isRequired exists
                >
                    <option value="">-- Select an option --</option>
                    {/* Render the filtered standard options */}
                    {baseOptions.map((option) => (
                        <option key={option} value={option}>
                            {option}
                        </option>
                    ))}
                    {/* Conditionally render the 'Other' option if allowed */}
                    {allowOther && (
                        <option value={OTHER_VALUE_DD}>
                            Other (Please specify below)
                        </option>
                    )}
                    {/* Conditionally render the 'Not Applicable' option if allowed */}
                    {allowNA && (
                        <option value={NA_VALUE}>
                            {NA_VALUE} {/* Display N/A */}
                        </option>
                    )}
                </select>
            );
        };
        // --- END ADDED ---


        switch (question.type) {
            case 'multiple-choice':
                // Check if question.includeNA exists, default to false
                const includeMCNA = question.includeNA || false;
                return (<div className="options-container mc-options">{renderOptions(question.options || [])}{includeMCNA && (<button key={NA_VALUE} onClick={() => handleSingleSelection(NA_VALUE)} className={`option-button na-button ${selectedAnswer === NA_VALUE ? 'selected' : ''}`} disabled={isSubmitting}>{NA_VALUE}</button>)}{question.allowOther && (<button key={OTHER_VALUE_MC} onClick={() => handleSingleSelection(OTHER_VALUE_MC)} className={`option-button other-button ${selectedAnswer === OTHER_VALUE_MC ? 'selected' : ''}`} disabled={isSubmitting}>Other</button>)}{renderOtherTextInput(isOtherSelectedMC)}</div>);
            // --- ADDED DROPDOWN CASE ---
            case 'dropdown':
                return (
                    <div className="options-container dropdown-options">
                        {getDropdownOptions()}
                        {/* Render 'Other' text input if Dropdown 'Other' is selected */}
                        {renderOtherTextInput(isOtherSelectedDD)}
                    </div>
                );
            // --- END ADDED DROPDOWN CASE ---
            case 'checkbox':
                 // Check if question.includeNA exists, default to false
                 const includeCBNA = question.includeNA || false;
                return (<div className="options-container checkbox-options">{renderCheckboxes(question.options || [])}{includeCBNA && (<div key={NA_VALUE} className="checkbox-item na-item"><input type="checkbox" id={`q${question._id}-optionNA`} value={NA_VALUE} checked={!!selectedAnswer?.[NA_VALUE]} onChange={(e) => handleCheckboxChange(NA_VALUE, e.target.checked)} disabled={isSubmitting} className="checkbox-input" /><label htmlFor={`q${question._id}-optionNA`} className="checkbox-label">{NA_VALUE}</label></div>)}{question.allowOther && (<div key={OTHER_KEY_CB} className="checkbox-item other-item"><input type="checkbox" id={`q${question._id}-optionOther`} value={OTHER_KEY_CB} checked={!!selectedAnswer?.[OTHER_KEY_CB]} onChange={(e) => handleCheckboxChange(OTHER_KEY_CB, e.target.checked)} disabled={isSubmitting || !!selectedAnswer?.[NA_VALUE]} className="checkbox-input" /><label htmlFor={`q${question._id}-optionOther`} className="checkbox-label">{OTHER_KEY_CB}</label></div>)}{renderOtherTextInput(!!selectedAnswer?.[OTHER_KEY_CB])}</div>);
            case 'rating': return (<div className="options-container rating-options">{[1, 2, 3, 4, 5].map((v) => (<button key={v} onClick={() => handleSingleSelection(v)} className={`rating-star ${selectedAnswer !== null && v <= selectedAnswer ? 'selected' : ''}`} title={`Rate ${v} / 5`} aria-pressed={selectedAnswer === v} disabled={isSubmitting}> ★ </button>))}</div>);
            case 'nps': return (<div className="options-container nps-options">{[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((s) => ( <button key={s} onClick={() => handleSingleSelection(s)} className={`nps-button ${selectedAnswer === s ? 'selected' : ''}`} aria-pressed={selectedAnswer === s} disabled={isSubmitting}> {s} </button> ))}<div className="nps-labels"> <span>Not Likely</span> <span>Very Likely</span> </div></div>);
            case 'text': return (<div className="options-container text-options">{renderOtherTextInput(true)}</div>); // Use the 'other' text input for standard text questions
            default: return <p>Unsupported question type: {question.type}</p>;
        }
    };

    // Button Disabling Logic (Added Dropdown Case)
    const isNextDisabled = () => {
         if (isSubmitting) return true;
         switch (question.type) {
             case 'multiple-choice': return (selectedAnswer === OTHER_VALUE_MC) ? otherText.trim() === '' : selectedAnswer === null || selectedAnswer === undefined;
             // --- ADDED DROPDOWN CASE ---
             case 'dropdown': return (selectedAnswer === OTHER_VALUE_DD) ? otherText.trim() === '' : selectedAnswer === null || selectedAnswer === undefined || selectedAnswer === ""; // Check empty string for default option
             // --- END ADDED DROPDOWN CASE ---
             case 'checkbox': const keys = Object.keys(selectedAnswer).filter(k => selectedAnswer[k]); return keys.length === 0 || (keys.includes(OTHER_KEY_CB) && otherText.trim() === '');
             case 'rating': case 'nps': return selectedAnswer === null || selectedAnswer === undefined; // Allow 0 for NPS
             case 'text': return selectedAnswer === null || selectedAnswer === undefined || String(selectedAnswer).trim() === '';
             default: return true;
         }
     };

    // Component Return (no changes needed)
    if (!question) return <div className="question-viewer-container">Loading question...</div>;
    return (
        <div className="question-viewer-container">
            <div className="question-header"><p>Question {questionNumber} of {totalQuestions}</p></div>
            <div className="question-body">
                <label className="question-text" id={`q-label-${question._id}`}>{question.text}</label>
                <div role="group" aria-labelledby={`q-label-${question._id}`}>{renderQuestionInput()}</div>
            </div>
            {error && <p className="submission-error">{error}</p>}
            <div className="question-navigation">
                 <button onClick={onCancelSurvey} className="button button-secondary close-button" disabled={isSubmitting}> Close </button>
                <button onClick={handleSubmit} className="button button-primary next-button" disabled={isNextDisabled()}>
                    {isSubmitting ? 'Submitting...' : (questionNumber < totalQuestions ? 'Next Question' : 'Finish Survey')}
                </button>
            </div>
        </div>
    );
}

export default QuestionViewer;
// ----- END OF COMPLETE UPDATED FILE -----