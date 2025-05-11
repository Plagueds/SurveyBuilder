// frontend/src/components/survey_question_renders/CheckboxQuestion.js
import React from 'react';
import styles from './SurveyQuestionStyles.module.css';

const CheckboxQuestion = ({
    question,
    currentAnswer, // Expects a string like "opt1||opt3"
    onCheckboxChange, // Expects (questionId, optionValue, isChecked)
    otherValue,
    onOtherTextChange,
    disabled,
    optionsOrder
}) => {
    if (!question || !Array.isArray(question.options)) {
        return <p className={styles.errorMessage}>Question data or options are missing.</p>;
    }

    const selectedSet = new Set(currentAnswer ? String(currentAnswer).split('||').filter(v => v) : []);

    const handleLocalCheckboxChange = (optionValue, isChecked) => {
        onCheckboxChange(question._id, optionValue, isChecked);
    };

    const handleOtherText = (event) => {
        if (onOtherTextChange) {
            onOtherTextChange(question._id, event.target.value);
        }
    };

    const orderedOptions = optionsOrder
        ? optionsOrder.map(index => question.options[index]).filter(opt => opt !== undefined)
        : question.options;

    return (
        <div className={`${styles.questionContainer} ${disabled ? styles.disabled : ''}`}>
            <p className={styles.questionText}>{question.text || 'Question text missing'}</p>
            {question.description && <p className={styles.questionDescription}>{question.description}</p>}
            <div className={styles.optionsContainer}>
                {orderedOptions.map((option, index) => {
                    const optionText = typeof option === 'object' ? option.text : option;
                    const optionValue = typeof option === 'object' ? option.value : option;
                    if (optionText === undefined || optionValue === undefined) return null;

                    return (
                        <div key={optionValue || index} className={styles.option}>
                            <input
                                type="checkbox"
                                id={`q_${question._id}_opt_${index}`}
                                value={optionValue}
                                checked={selectedSet.has(optionValue)}
                                onChange={(e) => handleLocalCheckboxChange(optionValue, e.target.checked)}
                                disabled={disabled || (selectedSet.has(question.naValue) && optionValue !== question.naValue)} // Example N/A logic
                                className={styles.checkboxInput}
                            />
                            <label htmlFor={`q_${question._id}_opt_${index}`} className={styles.optionLabel}>
                                {optionText}
                            </label>
                        </div>
                    );
                })}
                {question.addOtherOption && (
                    <div className={styles.option}>
                        <input
                            type="checkbox"
                            id={`q_${question._id}_opt_other`}
                            value="__OTHER__" // Consistent "other" value
                            checked={selectedSet.has("__OTHER__")}
                            onChange={(e) => handleLocalCheckboxChange("__OTHER__", e.target.checked)}
                            disabled={disabled || (selectedSet.has(question.naValue) && "__OTHER__" !== question.naValue)}
                            className={styles.checkboxInput}
                        />
                        <label htmlFor={`q_${question._id}_opt_other`} className={styles.optionLabel}>
                            Other
                        </label>
                        {selectedSet.has("__OTHER__") && (
                            <input
                                type="text"
                                value={otherValue || ''}
                                onChange={handleOtherText}
                                placeholder="Please specify"
                                className={styles.otherTextInput}
                                disabled={disabled}
                                required={question.requireOtherIfSelected && selectedSet.has("__OTHER__")}
                            />
                        )}
                    </div>
                )}
                 {/* Example N/A option rendering - adapt based on your question data structure */}
                {question.addNAOption && question.naValue && (
                     <div key={question.naValue} className={styles.option}>
                        <input
                            type="checkbox"
                            id={`q_${question._id}_opt_na`}
                            value={question.naValue}
                            checked={selectedSet.has(question.naValue)}
                            onChange={(e) => handleLocalCheckboxChange(question.naValue, e.target.checked)}
                            disabled={disabled}
                            className={styles.checkboxInput}
                        />
                        <label htmlFor={`q_${question._id}_opt_na`} className={styles.optionLabel}>
                            {question.naText || "N/A"}
                        </label>
                    </div>
                )}
            </div>
        </div>
    );
};
export default CheckboxQuestion;