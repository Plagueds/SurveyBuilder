// frontend/src/components/survey_question_renders/MultipleChoiceQuestion.js
import React from 'react';
// You'll need a CSS module for styling. Let's create one:
// frontend/src/components/survey_question_renders/SurveyQuestionStyles.module.css
import styles from './SurveyQuestionStyles.module.css';

const MultipleChoiceQuestion = ({
    question,
    currentAnswer,
    onAnswerChange,
    otherValue,
    onOtherTextChange, // Callback to update text for "Other" option
    disabled,
    optionsOrder // For randomized options, if you implement it
}) => {
    // Basic validation
    if (!question || !Array.isArray(question.options)) {
        console.error("[MultipleChoiceQuestion] Invalid question data:", question);
        return <p className={styles.errorMessage}>Question data or options are missing.</p>;
    }

    const handleChange = (event) => {
        onAnswerChange(question._id, event.target.value);
    };

    const handleOtherTextChange = (event) => {
        if (onOtherTextChange) {
            onOtherTextChange(question._id, event.target.value);
        }
    };

    // Use optionsOrder for randomized options if available, otherwise use original order
    const orderedOptions = optionsOrder
        ? optionsOrder.map(index => question.options[index]).filter(opt => opt !== undefined)
        : question.options;

    return (
        <div className={`${styles.questionContainer} ${disabled ? styles.disabled : ''}`}>
            <p className={styles.questionText}>{question.text || 'Question text is missing'}</p>
            {question.description && <p className={styles.questionDescription}>{question.description}</p>}

            <div className={styles.optionsContainer}>
                {orderedOptions.map((option, index) => {
                    // Your options might be strings or objects like { text: "Option A", value: "opt_a" }
                    // Adapt this based on how options are structured in your `questionData` from the API
                    const optionText = typeof option === 'object' ? option.text : option;
                    const optionValue = typeof option === 'object' ? option.value : option;

                    if (optionText === undefined || optionValue === undefined) {
                        console.warn("[MultipleChoiceQuestion] Malformed option:", option, "at index", index);
                        return null; // Skip rendering this option
                    }

                    return (
                        <div key={optionValue || index} className={styles.option}>
                            <input
                                type="radio"
                                id={`q_${question._id}_opt_${index}`}
                                name={`q_${question._id}`} // Ensures only one radio can be selected for this question
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

                {/* Handle "Other" option if configured in questionData */}
                {question.addOtherOption && (
                    <div className={styles.option}>
                        <input
                            type="radio"
                            id={`q_${question._id}_opt_other`}
                            name={`q_${question._id}`}
                            value="__OTHER__" // A conventional value for the "Other" choice
                            checked={currentAnswer === "__OTHER__"}
                            onChange={handleChange}
                            disabled={disabled}
                            className={styles.radioInput}
                        />
                        <label htmlFor={`q_${question._id}_opt_other`} className={styles.optionLabel}>
                            Other
                        </label>
                        {currentAnswer === "__OTHER__" && (
                            <input
                                type="text"
                                value={otherValue || ''} // Controlled component for "Other" text
                                onChange={handleOtherTextChange}
                                placeholder={question.otherPlaceholder || "Please specify"}
                                className={styles.otherTextInput}
                                disabled={disabled}
                                // Add 'required' attribute if question.requireOtherIfSelected is true
                                required={question.requireOtherIfSelected && currentAnswer === "__OTHER__"}
                            />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MultipleChoiceQuestion;