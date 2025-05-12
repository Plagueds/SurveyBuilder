// frontend/src/components/survey_question_renders/ConjointQuestion.js
// ----- START OF COMPLETE MODIFIED FILE (v1.1 - Added type="button") -----
import React, { useState, useEffect } from 'react';
import styles from './SurveyQuestionStyles.module.css'; // Assuming you've applied styles

const ConjointQuestion = ({ question, currentAnswer, onAnswerChange, isPreviewMode }) => {
    const { _id: questionId, text, conjointAttributes = [], description } = question;

    const [selections, setSelections] = useState(currentAnswer && typeof currentAnswer === 'object' ? currentAnswer : {});

    useEffect(() => {
        setSelections(currentAnswer && typeof currentAnswer === 'object' ? currentAnswer : {});
    }, [currentAnswer]);

    const handleLevelSelect = (attributeName, levelName) => {
        const newSelections = {
            ...selections,
            [attributeName]: levelName,
        };
        setSelections(newSelections);
        onAnswerChange(questionId, newSelections);
    };

    if (!conjointAttributes || conjointAttributes.length === 0) {
        return (
            <div className={styles.questionContainer}>
                <h4 className={styles.questionText}>{text}</h4>
                <p className={styles.questionDescription}>No attributes defined for this conjoint task.</p>
            </div>
        );
    }

    return (
        <div className={styles.questionContainer}>
            <h4 className={styles.questionText}>
                {text}
                {question.requiredSetting === 'required' && !isPreviewMode && <span className={styles.requiredIndicator}>*</span>}
            </h4>
            {description && <p className={styles.questionDescription}>{description}</p>}
            <p className={styles.conjointInfoText}>
                For each attribute below, please select the level you prefer.
                (This is a simplified preview of a conjoint task).
            </p>
            {conjointAttributes.map(attr => (
                <div key={attr.name} className={styles.conjointAttributeBlock}>
                    <span className={styles.conjointAttributeName}>{attr.name}</span>
                    <div className={styles.conjointLevelsContainer}>
                        {(attr.levels || []).map(level => (
                            <button
                                type="button" // PREVENTS FORM SUBMISSION
                                key={level}
                                onClick={() => handleLevelSelect(attr.name, level)}
                                className={`${styles.conjointLevelButton} ${selections[attr.name] === level ? styles.conjointLevelButtonSelected : ''}`}
                            >
                                {level}
                            </button>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default ConjointQuestion;
// ----- END OF COMPLETE MODIFIED FILE (v1.1) -----