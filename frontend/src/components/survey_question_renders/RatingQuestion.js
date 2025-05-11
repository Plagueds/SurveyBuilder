// frontend/src/components/survey_question_renders/RatingQuestion.js
import React from 'react';
import styles from './SurveyQuestionStyles.module.css';

const RatingQuestion = ({ question, currentAnswer, onAnswerChange, disabled }) => {
    if (!question) return <p className={styles.errorMessage}>Question data missing.</p>;
    // Default rating scale 1-5 if not specified
    const ratingValues = question.ratingValues || [1, 2, 3, 4, 5];

    return (
        <div className={`${styles.questionContainer} ${disabled ? styles.disabled : ''}`}>
            <p className={styles.questionText}>{question.text || 'Question text missing'}</p>
            {question.description && <p className={styles.questionDescription}>{question.description}</p>}
            <div className={styles.ratingContainer}>
                {(question.minLabel || question.ratingMinLabel) && <span>{question.minLabel || question.ratingMinLabel}</span>}
                {ratingValues.map((value) => (
                    <button
                        key={value}
                        type="button"
                        onClick={() => onAnswerChange(question._id, value)}
                        className={currentAnswer === value ? styles.selected : ''}
                        disabled={disabled}
                        aria-pressed={currentAnswer === value}
                    >
                        {value}
                    </button>
                ))}
                {(question.maxLabel || question.ratingMaxLabel) && <span>{question.maxLabel || question.ratingMaxLabel}</span>}
            </div>
        </div>
    );
};
export default RatingQuestion;