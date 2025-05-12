// frontend/src/components/survey_question_renders/NpsQuestion.js
// ----- START OF COMPLETE MODIFIED FILE (v1.1 - Improved UI) -----
import React from 'react';
import styles from './SurveyQuestionStyles.module.css'; // Ensure this is SurveyQuestionStyles.module.css

const NpsQuestion = ({ question, currentAnswer, onAnswerChange, disabled }) => {
    if (!question) return <p className={styles.errorMessage}>Question data missing.</p>;
    
    const npsValues = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const minLabel = question.minLabel || 'Not at all Likely';
    const maxLabel = question.maxLabel || 'Extremely Likely';

    const handleChange = (value) => {
        if (!disabled) {
            onAnswerChange(question._id, value);
        }
    };

    const getNpsButtonClass = (value) => {
        if (currentAnswer !== value) return ''; // Not selected
        const numValue = parseInt(value, 10);
        if (numValue <= 6) return styles.npsDetractorSelected;
        if (numValue <= 8) return styles.npsPassiveSelected;
        return styles.npsPromoterSelected;
    };

    return (
        <div className={`${styles.questionContainer} ${disabled ? styles.disabled : ''}`}>
            <p className={styles.questionText}>
                {question.text || 'Question text missing'}
                {question.isRequired && <span className={styles.requiredIndicator}>*</span>}
            </p>
            {question.description && <p className={styles.questionDescription}>{question.description}</p>}
            
            <div className={styles.npsScaleContainer}>
                <div className={styles.npsOptions}>
                    {npsValues.map((value) => (
                        <div key={value} className={styles.npsItem}>
                            <input
                                type="radio"
                                id={`q_${question._id}_nps_${value}`}
                                name={`q_${question._id}`}
                                value={value}
                                checked={currentAnswer === value}
                                onChange={() => handleChange(value)}
                                disabled={disabled}
                                className={styles.npsInputHidden} // Hidden radio
                            />
                            <label
                                htmlFor={`q_${question._id}_nps_${value}`}
                                className={`${styles.npsLabelButton} ${getNpsButtonClass(value)} ${currentAnswer === value ? styles.selected : ''}`}
                            >
                                {value}
                            </label>
                        </div>
                    ))}
                </div>
                <div className={styles.npsMinMaxLabels}>
                    <span>{minLabel}</span>
                    <span>{maxLabel}</span>
                </div>
            </div>
        </div>
    );
};

export default NpsQuestion;
// ----- END OF COMPLETE MODIFIED FILE (v1.1) -----