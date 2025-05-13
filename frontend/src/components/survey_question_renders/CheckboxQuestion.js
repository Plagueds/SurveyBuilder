// frontend/src/components/survey_question_renders/CheckboxQuestion.js
// ----- START OF COMPLETE MODIFIED FILE (v1.4 - Correctly use array for currentAnswer) -----
import React, { useMemo } from 'react';
import styles from './SurveyQuestionStyles.module.css';

const NA_VALUE_INTERNAL = '__NA__';
const OTHER_VALUE_INTERNAL = '__OTHER__';

const CheckboxQuestion = ({
    question,
    currentAnswer, // Expect this to be an array of selected values
    onCheckboxChange,
    otherValue,
    onOtherTextChange,
    disabled,
    optionsOrder
}) => {
    // --- HOOKS MOVED TO THE TOP ---
    // currentAnswer is expected to be an array from SurveyTakingPage
    // Ensure currentAnswer is always treated as an array for the Set
    const selectedSet = useMemo(() => {
        if (Array.isArray(currentAnswer)) {
            return new Set(currentAnswer);
        }
        if (typeof currentAnswer === 'string' && currentAnswer) {
            // Fallback for older data or if currentAnswer is a string for some reason
            // This specific '||' split might not be necessary if SurveyTakingPage always provides an array
            return new Set(currentAnswer.split('||').filter(v => v));
        }
        return new Set();
    }, [currentAnswer]);
    
    const orderedOptions = useMemo(() => {
        const options = question?.options || [];
        return optionsOrder
            ? optionsOrder.map(index => options[index]).filter(opt => opt !== undefined)
            : options;
    }, [question?.options, optionsOrder]);

    // --- VALIDATION CHECK AFTER HOOKS ---
    if (!question || !Array.isArray(question.options)) {
        console.error("[CheckboxQuestion] Invalid question data:", question);
        return <p className={styles.errorMessage}>Question data or options are missing.</p>;
    }
    
    const actualNaValue = question.naValue || NA_VALUE_INTERNAL; 
    const actualNaText = question.naText || "Not Applicable";

    const handleLocalCheckboxChange = (optionValue, isChecked) => {
        // This directly calls the handler from SurveyTakingPage, which manages the array state
        onCheckboxChange(question._id, optionValue, isChecked);
    };

    const handleOtherText = (event) => {
        if (onOtherTextChange) {
            onOtherTextChange(question._id, event.target.value);
        }
    };
    
    const naIsExclusive = question.naIsExclusive === undefined ? (question.addNAOption || false) : question.naIsExclusive;
    const isNASelected = selectedSet.has(actualNaValue);

    // Determine if max selections limit has been reached (excluding N/A if it's selected and exclusive)
    const nonNaSelectionsCount = Array.from(selectedSet).filter(val => val !== actualNaValue).length;
    const maxSelectionsReached = question.maxSelections !== undefined && 
                                 nonNaSelectionsCount >= question.maxSelections &&
                                 !isNASelected; // If NA is selected, this limit might not apply to NA itself

    return (
        <div className={`${styles.questionContainer} ${disabled ? styles.disabled : ''}`}>
            <p className={styles.questionText}>
                {question.text || 'Question text missing'}
                {question.requiredSetting === 'required' && <span className={styles.requiredIndicator}>*</span>}
            </p>
            {question.description && <p className={styles.questionDescription}>{question.description}</p>}
            <div className={styles.optionsContainer}>
                {orderedOptions.map((option, index) => {
                    const optionText = typeof option === 'object' ? option.text : option;
                    const optionValue = typeof option === 'object' ? option.value : option;
                    if (optionText === undefined || optionValue === undefined) return null;

                    const isChecked = selectedSet.has(optionValue);
                    const isOptionDisabled = disabled || 
                                             (isNASelected && naIsExclusive && optionValue !== actualNaValue) || // if NA is selected and exclusive, disable others
                                             (!isChecked && maxSelectionsReached); // Disable if not checked and max reached

                    return (
                        <div key={optionValue || index} className={styles.optionItem}>
                            <input
                                type="checkbox"
                                id={`q_${question._id}_opt_${index}`}
                                value={optionValue}
                                checked={isChecked}
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
                            disabled={disabled || (isNASelected && naIsExclusive && OTHER_VALUE_INTERNAL !== actualNaValue) || (!selectedSet.has(OTHER_VALUE_INTERNAL) && maxSelectionsReached)}
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
                                disabled={disabled || (isNASelected && naIsExclusive)} // Other text input enabled even if NA selected, unless NA is exclusive and "Other" is not NA
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
                            // N/A can always be selected/deselected unless general disable.
                            // If other options hit max, N/A should still be selectable to override.
                            disabled={disabled} 
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
// ----- END OF COMPLETE MODIFIED FILE (v1.4 - Correctly use array for currentAnswer) -----