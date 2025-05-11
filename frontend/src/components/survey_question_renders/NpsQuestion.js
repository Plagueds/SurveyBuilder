// frontend/src/components/survey_question_renders/NpsQuestion.js
import React from 'react';
import styles from './SurveyQuestionStyles.module.css';

const NpsQuestion = ({ question, currentAnswer, onAnswerChange, disabled }) => {
    if (!question) return <p className={styles.errorMessage}>Question data missing.</p>;
    const npsValues = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    return (
        <div className={`${styles.questionContainer} ${disabled ? styles.disabled : ''}`}>
            <p className={styles.questionText}>{question.text || 'Question text missing'}</p>
            {question.description && <p className={styles.questionDescription}>{question.description}</p>}
            <div className={styles.npsContainer}>
                {npsValues.map((value) => (
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
            </div>
            <div className={styles.npsLabels}>
                <span>{question.minLabel || 'Not at all Likely'}</span>
                <span>{question.maxLabel || 'Extremely Likely'}</span>
            </div>
        </div>
    );
};
export default NpsQuestion;