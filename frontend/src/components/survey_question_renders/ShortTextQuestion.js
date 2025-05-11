// frontend/src/components/survey_question_renders/ShortTextQuestion.js
import React from 'react';
import styles from './SurveyQuestionStyles.module.css';

const ShortTextQuestion = ({ question, currentAnswer, onAnswerChange, disabled }) => {
    if (!question) return <p className={styles.errorMessage}>Question data missing.</p>;

    let inputType = "text";
    if (question.type === 'email') inputType = 'email';
    else if (question.type === 'number') inputType = 'number';
    else if (question.type === 'date') inputType = 'date';
    // 'text' remains the default

    return (
        <div className={`${styles.questionContainer} ${disabled ? styles.disabled : ''}`}>
            <label htmlFor={`q_${question._id}`} className={styles.questionText}>
                {question.text || 'Question text missing'}
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
            />
        </div>
    );
};
export default ShortTextQuestion;