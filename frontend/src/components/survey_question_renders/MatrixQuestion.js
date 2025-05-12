// frontend/src/components/survey_question_renders/MatrixQuestion.js
import React from 'react';

const MatrixQuestion = ({ question, currentAnswer, onAnswerChange }) => {
    const { _id: questionId, text, matrixRows = [], matrixColumns = [], matrixType = 'radio' } = question;

    // Initialize answers from currentAnswer or as an empty object
    const internalAnswers = React.useMemo(() => {
        if (currentAnswer && typeof currentAnswer === 'object') {
            return currentAnswer;
        }
        const initial = {};
        if (matrixType === 'checkbox') {
            matrixRows.forEach(row => { initial[row] = {}; });
        }
        return initial;
    }, [currentAnswer, matrixRows, matrixType]);


    const handleChange = (row, column) => {
        const newAnswers = JSON.parse(JSON.stringify(internalAnswers)); // Deep copy

        if (matrixType === 'radio') {
            newAnswers[row] = column;
        } else { // checkbox
            if (!newAnswers[row]) {
                newAnswers[row] = {};
            }
            newAnswers[row][column] = !newAnswers[row][column];
        }
        onAnswerChange(questionId, newAnswers);
    };

    const styles = {
        container: { margin: '15px 0', padding: '10px', border: '1px solid #eee', borderRadius: '5px', backgroundColor: '#f9f9f9' },
        title: { margin: '0 0 10px 0', fontSize: '1.1em' },
        table: { width: '100%', borderCollapse: 'collapse' },
        th: { backgroundColor: '#f0f0f0', padding: '8px', border: '1px solid #ddd', textAlign: 'center' },
        td: { padding: '8px', border: '1px solid #ddd', textAlign: 'center' },
        rowHeader: { textAlign: 'left', fontWeight: 'bold' },
        input: { margin: '0 5px' },
    };

    return (
        <div style={styles.container}>
            <h4 style={styles.title}>{text}</h4>
            <table style={styles.table}>
                <thead>
                    <tr>
                        <th style={styles.th}></th> {/* Empty corner */}
                        {matrixColumns.map(col => <th key={col} style={styles.th}>{col}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {matrixRows.map(row => (
                        <tr key={row}>
                            <td style={{...styles.td, ...styles.rowHeader}}>{row}</td>
                            {matrixColumns.map(col => (
                                <td key={col} style={styles.td}>
                                    <input
                                        type={matrixType}
                                        name={`matrix-${questionId}-${row}`} // Ensures radio buttons are grouped per row
                                        value={col} // For radio, this is the value when selected
                                        checked={
                                            matrixType === 'radio'
                                                ? internalAnswers[row] === col
                                                : !!internalAnswers[row]?.[col]
                                        }
                                        onChange={() => handleChange(row, col)}
                                        style={styles.input}
                                    />
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default MatrixQuestion;