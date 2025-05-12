// frontend/src/components/survey_question_renders/SliderQuestion.js
// ----- START OF COMPLETE MODIFIED FILE (v2.0 - CSS Modules) -----
import React, { useState, useEffect } from 'react';
import styles from './SurveyQuestionStyles.module.css'; // Using the shared CSS module

const SliderQuestion = ({ question, currentAnswer, onAnswerChange, isPreviewMode, disabled }) => {
    const {
        _id: questionId,
        text,
        sliderMin = 0,
        sliderMax = 100,
        sliderStep = 1,
        sliderMinLabel = '',
        sliderMaxLabel = '',
        description
    } = question;

    const parseValue = (val, defaultVal) => {
        const num = parseFloat(val);
        return (val !== undefined && val !== null && !isNaN(num)) ? num : parseFloat(defaultVal);
    };
    
    const [value, setValue] = useState(() => parseValue(currentAnswer, sliderMin));

    useEffect(() => {
        setValue(parseValue(currentAnswer, sliderMin));
    }, [currentAnswer, sliderMin]);


    const handleChange = (event) => {
        if (disabled) return;
        const newValue = parseFloat(event.target.value);
        setValue(newValue);
        if (typeof onAnswerChange === 'function') {
            onAnswerChange(questionId, newValue);
        }
    };

    return (
        <div className={`${styles.questionContainer} ${disabled ? styles.disabled : ''}`}>
            <h4 className={styles.questionText}>
                {text}
                {question.requiredSetting === 'required' && !isPreviewMode && <span className={styles.requiredIndicator}>*</span>}
            </h4>
            {description && <p className={styles.questionDescription}>{description}</p>}
            <div className={styles.sliderWrapper}>
                {sliderMinLabel && <span className={styles.sliderMinLabel}>{sliderMinLabel}</span>}
                <input
                    type="range"
                    min={sliderMin}
                    max={sliderMax}
                    step={sliderStep}
                    value={value}
                    onChange={handleChange}
                    className={styles.sliderInput}
                    disabled={disabled}
                />
                {sliderMaxLabel && <span className={styles.sliderMaxLabel}>{sliderMaxLabel}</span>}
                <span className={styles.sliderValueDisplay}>{value}</span>
            </div>
        </div>
    );
};

export default SliderQuestion;
// ----- END OF COMPLETE MODIFIED FILE (v2.0 - CSS Modules) -----