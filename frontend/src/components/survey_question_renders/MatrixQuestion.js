// frontend/src/components/survey_question_renders/MatrixQuestion.js
// ----- START OF COMPLETE MODIFIED FILE (v2.0 - CSS Modules) -----
import React from 'react';
import styles from './SurveyQuestionStyles.module.css'; // Using the shared CSS module

const MatrixQuestion = ({ question, currentAnswer, onAnswerChange, isPreviewMode, disabled }) => {
    const {
        _id: questionId,
        text,
        matrixRows = [],
        matrixColumns = [],
        matrixType = 'radio',
        description
    } = question;

    // Initialize answers from currentAnswer or as an empty object
    const internalAnswers = React.useMemo(() => {
        if (currentAnswer && typeof currentAnswer === 'object') {
            return currentAnswer;
        }
        const initial = {};
        // For checkbox type, ensure each row has an entry in answers, even if empty
        if (matrixType === 'checkbox') {
            matrixRows.forEach(row => { initial[row] = {}; });
        }
        return initial;
    }, [currentAnswer, matrixRows, matrixType]);


    const handleChange = (row, column) => {
        if (disabled) return;
        const newAnswers = JSON.parse(JSON.stringify(internalAnswers)); // Deep copy

        if (matrixType === 'radio') {
            newAnswers[row] = column;
        } else { // checkbox
            if (!newAnswers[row]) {
                newAnswers[row] = {};
            }
            newAnswers[row][column] = !newAnswers[row][column];
        }
        if (typeof onAnswerChange === 'function') {
            onAnswerChange(questionId, newAnswers);
        }
    };

    if (!matrixRows.length || !matrixColumns.length) {
        return (
            <div className={`${styles.questionContainer} ${disabled ? styles.disabled : ''}`}>
                <h4 className={styles.questionText}>
                    {text}
                    {question.requiredSetting === 'required' && !isPreviewMode && <span className={styles.requiredIndicator}>*</span>}
                </h4>
                {description && <p className={styles.questionDescription}>{description}</p>}
                <p className={styles.questionDescription}>Matrix rows or columns are not defined.</p>
            </div>
        );
    }

    return (
        <div className={`${styles.questionContainer} ${disabled ? styles.disabled : ''}`}>
            <h4 className={styles.questionText}>
                {text}
                {question.requiredSetting === 'required' && !isPreviewMode && <span className={styles.requiredIndicator}>*</span>}
            </h4>
            {description && <p className={styles.questionDescription}>{description}</p>}
            <div className={styles.matrixTableContainer}> {/* Added for better scroll/overflow handling if needed */}
                <table className={styles.matrixTable}>
                    <thead>
                        <tr>
                            <th className={styles.matrixTh}></th> {/* Empty corner */}
                            {matrixColumns.map(col => <th key={col} className={styles.matrixTh}>{col}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {matrixRows.map(row => (
                            <tr key={row}>
                                <td className={`${styles.matrixTd} ${styles.matrixRowHeader}`}>{row}</td>
                                {matrixColumns.map(col => (
                                    <td key={col} className={styles.matrixTd}>
                                        <input
                                            type={matrixType}
                                            name={`matrix-${questionId}-${row}`}
                                            value={col}
                                            checked={
                                                matrixType === 'radio'
                                                    ? internalAnswers[row] === col
                                                    : !!internalAnswers[row]?.[col]
                                            }
                                            onChange={() => handleChange(row, col)}
                                            className={matrixType === 'radio' ? styles.radioInput : styles.checkboxInput} // Reuse existing styles
                                            disabled={disabled}
                                        />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default MatrixQuestion;
// ----- END OF COMPLETE MODIFIED FILE (v2.0 - CSS Modules) -----