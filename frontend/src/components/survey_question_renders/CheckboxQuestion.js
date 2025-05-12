// frontend/src/components/survey_question_renders/CheckboxQuestion.js
// ----- START OF COMPLETE MODIFIED FILE (v1.3 - Fixed Hooks order) -----
import React, { useMemo } from 'react';
import styles from './SurveyQuestionStyles.module.css';

const NA_VALUE_INTERNAL = '__NA__';
const OTHER_VALUE_INTERNAL = '__OTHER__';

const CheckboxQuestion = ({
    question,
    currentAnswer,
    onCheckboxChange,
    otherValue,
    onOtherTextChange,
    disabled,
    optionsOrder
}) => {
    // --- HOOKS MOVED TO THE TOP ---
    const selectedSet = useMemo(() => new Set(currentAnswer ? String(currentAnswer).split('||').filter(v => v) : []), [currentAnswer]);
    
    const orderedOptions = useMemo(() => {
        // Ensure question and question.options are accessed safely if they might be initially undefined
        const options = question?.options || [];
        return optionsOrder
            ? optionsOrder.map(index => options[index]).filter(opt => opt !== undefined)
            : options;
    }, [question?.options, optionsOrder]); // Added optional chaining for question.options

    // --- VALIDATION CHECK AFTER HOOKS ---
    if (!question || !Array.isArray(question.options)) {
        // It's generally better to handle missing critical props higher up,
        // but if rendering a message here, ensure Hooks are already called.
        console.error("[CheckboxQuestion] Invalid question data:", question);
        return <p className={styles.errorMessage}>Question data or options are missing.</p>;
    }
    
    const actualNaValue = question.naValue || NA_VALUE_INTERNAL; 
    const actualNaText = question.naText || "Not Applicable";

    const handleLocalCheckboxChange = (optionValue, isChecked) => {
        onCheckboxChange(question._id, optionValue, isChecked);
    };

    const handleOtherText = (event) => {
        if (onOtherTextChange) {
            onOtherTextChange(question._id, event.target.value);
        }
    };
    
    const naIsExclusive = question.naIsExclusive === undefined ? (question.addNAOption || false) : question.naIsExclusive;
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
                                             (isNASelected && naIsExclusive) ||
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
                                required={question.requireOtherIfSelected && selectedSet.has(OTHER_VALUE_INTERNAL)}
                            />
                        )}
                    </div>
                )}
                
                {question.addNAOption && (
                     <div key={actualNaValue} className={styles.optionItem}>
                        <input
                            type="checkbox"
                            id={`q_${question._id}_opt_na`}
                            value={actualNaValue} 
                            checked={isNASelected}
                            onChange={(e) => handleLocalCheckboxChange(actualNaValue, e.target.checked)}
                            disabled={disabled || (!isNASelected && selectedSet.size >= (question.maxSelections || Infinity))}
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
// ----- END OF COMPLETE MODIFIED FILE (v1.3) -----