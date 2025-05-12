// frontend/src/components/survey_question_renders/MultipleChoiceQuestion.js
// ----- START OF COMPLETE MODIFIED FILE (v1.3 - Fixed Hooks order) -----
import React, { useMemo } from 'react';
import styles from './SurveyQuestionStyles.module.css';

const NA_VALUE_INTERNAL = '__NA__';
const OTHER_VALUE_INTERNAL = '__OTHER__';

const MultipleChoiceQuestion = ({
    question,
    currentAnswer,
    onAnswerChange,
    otherValue,
    onOtherTextChange,
    disabled,
    optionsOrder
}) => {
    // --- HOOK MOVED TO THE TOP ---
    const orderedOptions = useMemo(() => {
        // Ensure question and question.options are accessed safely
        const options = question?.options || [];
        return optionsOrder
            ? optionsOrder.map(index => options[index]).filter(opt => opt !== undefined)
            : options;
    }, [question?.options, optionsOrder]); // Added optional chaining for question.options

    // --- VALIDATION CHECK AFTER HOOKS ---
    if (!question || !Array.isArray(question.options)) {
        console.error("[MultipleChoiceQuestion] Invalid question data:", question);
        return <p className={styles.errorMessage}>Question data or options are missing.</p>;
    }

    const handleChange = (event) => {
        onAnswerChange(question._id, event.target.value);
    };

    const handleOtherText = (event) => {
        if (onOtherTextChange) {
            onOtherTextChange(question._id, event.target.value);
        }
    };

    return (
        <div className={`${styles.questionContainer} ${disabled ? styles.disabled : ''}`}>
            <p className={styles.questionText}>
                {question.text || 'Question text is missing'}
                {question.isRequired && <span className={styles.requiredIndicator}>*</span>}
            </p>
            {question.description && <p className={styles.questionDescription}>{question.description}</p>}

            <div className={styles.optionsContainer}>
                {orderedOptions.map((option, index) => {
                    const optionText = typeof option === 'object' ? option.text : option;
                    const optionValue = typeof option === 'object' ? option.value : option;

                    if (optionText === undefined || optionValue === undefined) {
                        console.warn("[MultipleChoiceQuestion] Malformed option:", option, "at index", index);
                        return null;
                    }

                    return (
                        <div key={optionValue || index} className={styles.optionItem}>
                            <input
                                type="radio"
                                id={`q_${question._id}_opt_${index}`}
                                name={`q_${question._id}`}
                                value={optionValue}
                                checked={currentAnswer === optionValue}
                                onChange={handleChange}
                                disabled={disabled}
                                className={styles.radioInput}
                            />
                            <label htmlFor={`q_${question._id}_opt_${index}`} className={styles.optionLabel}>
                                {optionText}
                            </label>
                        </div>
                    );
                })}

                {question.addOtherOption && (
                    <div className={styles.optionItem}>
                        <input
                            type="radio"
                            id={`q_${question._id}_opt_other`}
                            name={`q_${question._id}`}
                            value={OTHER_VALUE_INTERNAL}
                            checked={currentAnswer === OTHER_VALUE_INTERNAL}
                            onChange={handleChange}
                            disabled={disabled}
                            className={styles.radioInput}
                        />
                        <label htmlFor={`q_${question._id}_opt_other`} className={styles.optionLabel}>
                            {question.otherLabel || 'Other'} 
                        </label>
                        {currentAnswer === OTHER_VALUE_INTERNAL && (
                            <input
                                type="text"
                                value={otherValue || ''}
                                onChange={handleOtherText}
                                placeholder={question.otherPlaceholder || "Please specify"}
                                className={styles.otherTextInput}
                                disabled={disabled}
                                required={question.requireOtherIfSelected && currentAnswer === OTHER_VALUE_INTERNAL}
                            />
                        )}
                    </div>
                )}

                {question.addNAOption && (
                    <div className={styles.optionItem}>
                        <input
                            type="radio"
                            id={`q_${question._id}_opt_na`}
                            name={`q_${question._id}`}
                            value={NA_VALUE_INTERNAL} 
                            checked={currentAnswer === NA_VALUE_INTERNAL}
                            onChange={handleChange}
                            disabled={disabled}
                            className={styles.radioInput}
                        />
                        <label htmlFor={`q_${question._id}_opt_na`} className={styles.optionLabel}>
                            Not Applicable 
                        </label>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MultipleChoiceQuestion;
// ----- END OF COMPLETE MODIFIED FILE (v1.3) -----