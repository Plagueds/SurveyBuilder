// frontend/src/components/survey_question_renders/CheckboxQuestion.js
// ----- START OF COMPLETE MODIFIED FILE (v1.2 - Align with QEP props, refined N/A logic) -----
import React, { useMemo } from 'react';
import styles from './SurveyQuestionStyles.module.css';

const NA_VALUE_INTERNAL = '__NA__'; // Default internal N/A value if not specified by question
const OTHER_VALUE_INTERNAL = '__OTHER__';

const CheckboxQuestion = ({
    question,
    currentAnswer,
    onCheckboxChange, // Expects (questionId, optionValue, isChecked)
    otherValue,
    onOtherTextChange,
    disabled,
    optionsOrder
}) => {
    if (!question || !Array.isArray(question.options)) {
        return <p className={styles.errorMessage}>Question data or options are missing.</p>;
    }

    const selectedSet = useMemo(() => new Set(currentAnswer ? String(currentAnswer).split('||').filter(v => v) : []), [currentAnswer]);
    
    // Determine the actual N/A value to use (from question config or default)
    // Your QuestionEditPanel saves `addNAOption` but not `naValue` or `naText` explicitly.
    // For now, we'll assume a default internal value and text if `addNAOption` is true.
    // If you make `naValue` and `naText` configurable in QuestionEditPanel, use them here.
    const actualNaValue = question.naValue || NA_VALUE_INTERNAL; 
    const actualNaText = question.naText || "Not Applicable";

    const handleLocalCheckboxChange = (optionValue, isChecked) => {
        // This function in SurveyTakingPage will handle the logic of updating the string
        onCheckboxChange(question._id, optionValue, isChecked);
    };

    const handleOtherText = (event) => {
        if (onOtherTextChange) {
            onOtherTextChange(question._id, event.target.value);
        }
    };

    const orderedOptions = useMemo(() => {
        return optionsOrder
            ? optionsOrder.map(index => (question.options || [])[index]).filter(opt => opt !== undefined)
            : (question.options || []);
    }, [question.options, optionsOrder]);
    
    // Determine if N/A option makes other options disabled (if naIsExclusive is true)
    // Your QuestionEditPanel doesn't explicitly set `naIsExclusive`. Assuming true for now.
    const naIsExclusive = question.naIsExclusive === undefined ? true : question.naIsExclusive;
    const isNASelected = selectedSet.has(actualNaValue);

    return (
        <div className={`${styles.questionContainer} ${disabled ? styles.disabled : ''}`}>
            <p className={styles.questionText}>
                {question.text || 'Question text missing'}
                {question.isRequired && <span className={styles.requiredIndicator}>*</span>}
            </p>
            {question.description && <p className={styles.questionDescription}>{question.description}</p>}
            <div className={styles.optionsContainer}>
                {orderedOptions.map((option, index) => {
                    const optionText = typeof option === 'object' ? option.text : option;
                    const optionValue = typeof option === 'object' ? option.value : option;
                    if (optionText === undefined || optionValue === undefined) return null;

                    const isOptionDisabled = disabled || 
                                             (isNASelected && naIsExclusive) || // Disable if exclusive N/A is selected
                                             (!selectedSet.has(optionValue) && selectedSet.size >= (question.maxSelections || Infinity) && !isNASelected);


                    return (
                        <div key={optionValue || index} className={styles.optionItem}>
                            <input
                                type="checkbox"
                                id={`q_${question._id}_opt_${index}`}
                                value={optionValue}
                                checked={selectedSet.has(optionValue)}
                                onChange={(e) => handleLocalCheckboxChange(optionValue, e.target.checked)}
                                disabled={isOptionDisabled}
                                className={styles.checkboxInput}
                            />
                            <label htmlFor={`q_${question._id}_opt_${index}`} className={styles.optionLabel}>
                                {optionText}
                            </label>
                        </div>
                    );
                })}

                {/* Uses `question.addOtherOption` from QuestionEditPanel.js */}
                {question.addOtherOption && (
                    <div className={styles.optionItem}>
                        <input
                            type="checkbox"
                            id={`q_${question._id}_opt_other`}
                            value={OTHER_VALUE_INTERNAL}
                            checked={selectedSet.has(OTHER_VALUE_INTERNAL)}
                            onChange={(e) => handleLocalCheckboxChange(OTHER_VALUE_INTERNAL, e.target.checked)}
                            disabled={disabled || (isNASelected && naIsExclusive) || (!selectedSet.has(OTHER_VALUE_INTERNAL) && selectedSet.size >= (question.maxSelections || Infinity) && !isNASelected)}
                            className={styles.checkboxInput}
                        />
                        <label htmlFor={`q_${question._id}_opt_other`} className={styles.optionLabel}>
                            {question.otherLabel || 'Other'}
                        </label>
                        {selectedSet.has(OTHER_VALUE_INTERNAL) && (
                            <input
                                type="text"
                                value={otherValue || ''}
                                onChange={handleOtherText}
                                placeholder={question.otherPlaceholder || "Please specify"}
                                className={styles.otherTextInput}
                                disabled={disabled || (isNASelected && naIsExclusive)}
                                // Uses `question.requireOtherIfSelected` from QuestionEditPanel.js
                                required={question.requireOtherIfSelected && selectedSet.has(OTHER_VALUE_INTERNAL)}
                            />
                        )}
                    </div>
                )}
                
                {/* Uses `question.addNAOption` from QuestionEditPanel.js */}
                {question.addNAOption && (
                     <div key={actualNaValue} className={styles.optionItem}>
                        <input
                            type="checkbox"
                            id={`q_${question._id}_opt_na`}
                            value={actualNaValue} 
                            checked={isNASelected}
                            onChange={(e) => handleLocalCheckboxChange(actualNaValue, e.target.checked)}
                            disabled={disabled || (!isNASelected && selectedSet.size >= (question.maxSelections || Infinity))} // N/A can usually be selected even if max is reached for other options
                            className={styles.checkboxInput}
                        />
                        <label htmlFor={`q_${question._id}_opt_na`} className={styles.optionLabel}>
                            {actualNaText}
                        </label>
                    </div>
                )}
            </div>
            {question.minSelections && <p className={styles.selectionRequirement}>Select at least {question.minSelections} option(s).</p>}
            {question.maxSelections && <p className={styles.selectionRequirement}>Select up to {question.maxSelections} option(s).</p>}
        </div>
    );
};
export default CheckboxQuestion;
// ----- END OF COMPLETE MODIFIED FILE (v1.2) -----