// frontend/src/components/survey_question_renders/RatingQuestion.js
// ----- START OF COMPLETE MODIFIED FILE (v1.1 - Improved UI) -----
import React from 'react';
import styles from './SurveyQuestionStyles.module.css'; // Ensure this is SurveyQuestionStyles.module.css

const RatingQuestion = ({ question, currentAnswer, onAnswerChange, disabled }) => {
    if (!question) return <p className={styles.errorMessage}>Question data missing.</p>;
    
    const ratingValues = question.ratingValues || [1, 2, 3, 4, 5]; // Default 1-5
    const minLabel = question.ratingMinLabel || question.minLabel || ''; // E.g., "Very Poor"
    const maxLabel = question.ratingMaxLabel || question.maxLabel || ''; // E.g., "Very Good"

    const handleChange = (value) => {
        if (!disabled) {
            onAnswerChange(question._id, value);
        }
    };

    return (
        <div className={`${styles.questionContainer} ${disabled ? styles.disabled : ''}`}>
            <p className={styles.questionText}>
                {question.text || 'Question text missing'}
                {question.isRequired && <span className={styles.requiredIndicator}>*</span>}
            </p>
            {question.description && <p className={styles.questionDescription}>{question.description}</p>}
            
            <div className={styles.ratingScaleContainer}>
                {minLabel && <span className={styles.ratingMinMaxLabel}>{minLabel}</span>}
                <div className={styles.ratingOptions}>
                    {ratingValues.map((value) => (
                        <div key={value} className={styles.ratingItem}>
                            <input
                                type="radio"
                                id={`q_${question._id}_rating_${value}`}
                                name={`q_${question._id}`}
                                value={value}
                                checked={currentAnswer === value}
                                onChange={() => handleChange(value)}
                                disabled={disabled}
                                className={styles.ratingInputHidden} // Hidden radio
                            />
                            <label
                                htmlFor={`q_${question._id}_rating_${value}`}
                                className={`${styles.ratingLabelButton} ${currentAnswer === value ? styles.selected : ''}`}
                            >
                                {value}
                            </label>
                        </div>
                    ))}
                </div>
                {maxLabel && <span className={styles.ratingMinMaxLabel}>{maxLabel}</span>}
            </div>
        </div>
    );
};

export default RatingQuestion;
// ----- END OF COMPLETE MODIFIED FILE (v1.1) -----