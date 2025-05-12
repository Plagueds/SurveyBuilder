// frontend/src/components/survey_question_renders/ShortTextQuestion.js
// ----- START OF COMPLETE MODIFIED FILE -----
import React from 'react';
import styles from './SurveyQuestionStyles.module.css';

const ShortTextQuestion = ({ question, currentAnswer, onAnswerChange, disabled }) => {
    if (!question) return <p className={styles.errorMessage}>Question data missing.</p>;

    let inputType = "text"; // Default
    // Use textValidation to determine specific input types for 'text' questions
    if (question.type === 'text') { // Only apply these for the base 'text' type
        switch (question.textValidation) {
            case 'email':
                inputType = 'email';
                break;
            case 'numeric':
                inputType = 'number';
                break;
            // Add 'date' if you have a 'date' option in textValidation enum
            // case 'date':
            //     inputType = 'date';
            //     break;
            default:
                inputType = 'text';
        }
    } else if (question.type === 'date') { // If you have a dedicated 'date' type (not in current enum)
        inputType = 'date';
    }


    return (
        <div className={`${styles.questionContainer} ${disabled ? styles.disabled : ''}`}>
            <label htmlFor={`q_${question._id}`} className={styles.questionText}>
                {question.text || 'Question text missing'}
                {question.isRequired && <span className={styles.requiredIndicator}>*</span>}
            </label>
            {question.description && <p className={styles.questionDescription}>{question.description}</p>}
            <input
                type={inputType}
                id={`q_${question._id}`}
                value={currentAnswer || ''}
                onChange={(e) => onAnswerChange(question._id, e.target.value)}
                placeholder={question.placeholder || "Type your answer"}
                disabled={disabled}
                className={styles.textInput}
                aria-required={question.isRequired}
                // For numeric type, you might want to add min/max/step if defined in question model
                {...(inputType === 'number' && question.minNumericValue !== undefined && { min: question.minNumericValue })}
                {...(inputType === 'number' && question.maxNumericValue !== undefined && { max: question.maxNumericValue })}
                {...(inputType === 'number' && question.numericStep !== undefined && { step: question.numericStep })}
            />
        </div>
    );
};
export default ShortTextQuestion;
// ----- END OF COMPLETE MODIFIED FILE -----