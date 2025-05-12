// frontend/src/components/survey_question_renders/ConjointQuestion.js
import React, { useState, useEffect } from 'react';

const ConjointQuestion = ({ question, currentAnswer, onAnswerChange }) => {
    const { _id: questionId, text, conjointAttributes = [] } = question;

    // currentAnswer should be an object like { "AttributeName1": "LevelNameA", "AttributeName2": "LevelNameX" }
    const [selections, setSelections] = useState(currentAnswer && typeof currentAnswer === 'object' ? currentAnswer : {});

    useEffect(() => {
        setSelections(currentAnswer && typeof currentAnswer === 'object' ? currentAnswer : {});
    }, [currentAnswer]);

    const handleLevelSelect = (attributeName, levelName) => {
        const newSelections = {
            ...selections,
            [attributeName]: levelName,
        };
        setSelections(newSelections);
        onAnswerChange(questionId, newSelections);
    };

    const styles = {
        container: { margin: '15px 0', padding: '10px', border: '1px solid #eee', borderRadius: '5px', backgroundColor: '#f9f9f9' },
        title: { margin: '0 0 10px 0', fontSize: '1.1em' },
        attributeBlock: { marginBottom: '15px', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '4px' },
        attributeName: { fontWeight: 'bold', marginBottom: '5px', display: 'block' },
        levelButton: {
            padding: '6px 12px', margin: '5px', border: '1px solid #ccc', borderRadius: '4px',
            cursor: 'pointer', backgroundColor: '#fff'
        },
        selectedLevel: { backgroundColor: '#007bff', color: 'white', borderColor: '#0056b3' },
        info: { fontSize: '0.9em', color: '#666', fontStyle: 'italic' }
    };

    if (!conjointAttributes || conjointAttributes.length === 0) {
        return (
            <div style={styles.container}>
                <h4 style={styles.title}>{text}</h4>
                <p>No attributes defined for this conjoint task.</p>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            <h4 style={styles.title}>{text}</h4>
            <p style={styles.info}>
                For each attribute below, please select the level you prefer.
                (This is a simplified preview of a conjoint task).
            </p>
            {conjointAttributes.map(attr => (
                <div key={attr.name} style={styles.attributeBlock}>
                    <span style={styles.attributeName}>{attr.name}</span>
                    <div>
                        {(attr.levels || []).map(level => (
                            <button
                                key={level}
                                onClick={() => handleLevelSelect(attr.name, level)}
                                style={{
                                    ...styles.levelButton,
                                    ...(selections[attr.name] === level ? styles.selectedLevel : {})
                                }}
                            >
                                {level}
                            </button>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default ConjointQuestion;