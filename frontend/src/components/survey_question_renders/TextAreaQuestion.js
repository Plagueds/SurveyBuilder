// frontend/src/components/survey_question_renders/TextAreaQuestion.js
import React from 'react';
import styles from './SurveyQuestionStyles.module.css';

const TextAreaQuestion = ({ question, currentAnswer, onAnswerChange, disabled }) => {
    if (!question) return <p className={styles.errorMessage}>Question data missing.</p>;
    return (
        <div className={`${styles.questionContainer} ${disabled ? styles.disabled : ''}`}>
            <label htmlFor={`q_${question._id}`} className={styles.questionText}>
                {question.text || 'Question text missing'}
            </label>
            {question.description && <p className={styles.questionDescription}>{question.description}</p>}
            <textarea
                id={`q_${question._id}`}
                value={currentAnswer || ''}
                onChange={(e) => onAnswerChange(question._id, e.target.value)}
                placeholder={question.placeholder || "Type your answer"}
                rows={question.rows || 4} // Use rows from question data or default
                disabled={disabled}
                className={styles.textareaInput}
                aria-required={question.isRequired}
            />
        </div>
    );
};
export default TextAreaQuestion;