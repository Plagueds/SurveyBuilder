// frontend/src/components/survey_question_renders/DropdownQuestion.js
import React from 'react';
import styles from './SurveyQuestionStyles.module.css';

const DropdownQuestion = ({
    question,
    currentAnswer,
    onAnswerChange,
    otherValue,
    onOtherTextChange,
    disabled,
    optionsOrder
}) => {
    if (!question || !Array.isArray(question.options)) {
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

    const orderedOptions = optionsOrder
        ? optionsOrder.map(index => question.options[index]).filter(opt => opt !== undefined)
        : question.options;

    return (
        <div className={`${styles.questionContainer} ${disabled ? styles.disabled : ''}`}>
            <label htmlFor={`q_${question._id}`} className={styles.questionText}>
                {question.text || 'Question text missing'}
            </label>
            {question.description && <p className={styles.questionDescription}>{question.description}</p>}
            <select
                id={`q_${question._id}`}
                value={currentAnswer || ""} // Ensure controlled component
                onChange={handleChange}
                disabled={disabled}
                className={styles.dropdownSelect}
                aria-required={question.isRequired}
            >
                <option value="">-- Select an option --</option>
                {orderedOptions.map((option, index) => {
                    const optionText = typeof option === 'object' ? option.text : option;
                    const optionValue = typeof option === 'object' ? option.value : option;
                    if (optionText === undefined || optionValue === undefined) return null;
                    return (
                        <option key={optionValue || index} value={optionValue}>
                            {optionText}
                        </option>
                    );
                })}
                {question.addOtherOption && (
                    <option value="__OTHER__">Other</option>
                )}
                {/* Example N/A option rendering */}
                {question.addNAOption && question.naValue && (
                    <option value={question.naValue}>{question.naText || "N/A"}</option>
                )}
            </select>
            {question.addOtherOption && currentAnswer === "__OTHER__" && (
                <input
                    type="text"
                    value={otherValue || ''}
                    onChange={handleOtherText}
                    placeholder="Please specify"
                    className={styles.otherTextInput}
                    style={{ marginTop: '10px' }}
                    disabled={disabled}
                    required={question.requireOtherIfSelected && currentAnswer === "__OTHER__"}
                />
            )}
        </div>
    );
};
export default DropdownQuestion;