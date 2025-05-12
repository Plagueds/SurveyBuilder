// frontend/src/components/survey_question_renders/MaxDiffQuestion.js
import React, { useState, useEffect } from 'react';

const MaxDiffQuestion = ({ question, currentAnswer, onAnswerChange }) => {
    const { _id: questionId, text, options = [] } = question;

    const initialBest = currentAnswer?.best || null;
    const initialWorst = currentAnswer?.worst || null;

    const [selectedBest, setSelectedBest] = useState(initialBest);
    const [selectedWorst, setSelectedWorst] = useState(initialWorst);

    useEffect(() => {
        setSelectedBest(currentAnswer?.best || null);
        setSelectedWorst(currentAnswer?.worst || null);
    }, [currentAnswer]);

    const handleSelection = (type, option) => {
        let newBest = selectedBest;
        let newWorst = selectedWorst;

        if (type === 'best') {
            newBest = option;
            if (option === newWorst) newWorst = null; // Cannot be best and worst
        } else { // worst
            newWorst = option;
            if (option === newBest) newBest = null; // Cannot be best and worst
        }

        setSelectedBest(newBest);
        setSelectedWorst(newWorst);
        onAnswerChange(questionId, { best: newBest, worst: newWorst });
    };

    const styles = {
        container: { margin: '15px 0', padding: '10px', border: '1px solid #eee', borderRadius: '5px', backgroundColor: '#f9f9f9' },
        title: { margin: '0 0 10px 0', fontSize: '1.1em' },
        table: { width: '100%', borderCollapse: 'collapse', marginTop: '10px' },
        th: { backgroundColor: '#f0f0f0', padding: '8px', border: '1px solid #ddd', textAlign: 'center' },
        td: { padding: '8px', border: '1px solid #ddd', textAlign: 'center' },
        optionCell: { textAlign: 'left' },
        input: { margin: '0 5px', cursor: 'pointer' },
    };

    if (!options || options.length < 2) {
        return (
            <div style={styles.container}>
                <h4 style={styles.title}>{text}</h4>
                <p>At least two options are required for a MaxDiff question.</p>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            <h4 style={styles.title}>{text}</h4>
            <table style={styles.table}>
                <thead>
                    <tr>
                        <th style={styles.th}>Option</th>
                        <th style={styles.th}>Best</th>
                        <th style={styles.th}>Worst</th>
                    </tr>
                </thead>
                <tbody>
                    {options.map(option => (
                        <tr key={option}>
                            <td style={{...styles.td, ...styles.optionCell}}>{option}</td>
                            <td style={styles.td}>
                                <input
                                    type="radio"
                                    name={`maxdiff-${questionId}-best`}
                                    checked={selectedBest === option}
                                    onChange={() => handleSelection('best', option)}
                                    style={styles.input}
                                />
                            </td>
                            <td style={styles.td}>
                                <input
                                    type="radio"
                                    name={`maxdiff-${questionId}-worst`}
                                    checked={selectedWorst === option}
                                    onChange={() => handleSelection('worst', option)}
                                    style={styles.input}
                                />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default MaxDiffQuestion;