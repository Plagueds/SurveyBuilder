// frontend/src/components/survey_question_renders/RankingQuestion.js
import React, { useState, useEffect } from 'react';

const RankingQuestion = ({ question, currentAnswer, onAnswerChange }) => {
    const { _id: questionId, text, options = [] } = question;

    // Initialize rankedItems: if currentAnswer is valid, use it, otherwise use original options
    const getInitialItems = () => {
        if (Array.isArray(currentAnswer) && currentAnswer.length === options.length && currentAnswer.every(item => options.includes(item))) {
            return [...currentAnswer];
        }
        return [...options]; // Default order
    };

    const [rankedItems, setRankedItems] = useState(getInitialItems());

    useEffect(() => {
        setRankedItems(getInitialItems());
    }, [currentAnswer, options]);

    const moveItem = (index, direction) => {
        const newItems = [...rankedItems];
        const item = newItems[index];
        const newIndex = index + direction;

        if (newIndex < 0 || newIndex >= newItems.length) return; // Boundary check

        newItems.splice(index, 1);       // Remove item from old position
        newItems.splice(newIndex, 0, item); // Insert item into new position

        setRankedItems(newItems);
        onAnswerChange(questionId, newItems);
    };

    const styles = {
        container: { margin: '15px 0', padding: '10px', border: '1px solid #eee', borderRadius: '5px', backgroundColor: '#f9f9f9' },
        title: { margin: '0 0 10px 0', fontSize: '1.1em' },
        list: { listStyle: 'none', padding: 0 },
        listItem: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px', border: '1px solid #ddd', marginBottom: '5px', borderRadius: '4px', backgroundColor: 'white' },
        itemText: { flexGrow: 1 },
        buttonGroup: { display: 'flex', gap: '5px' },
        button: { padding: '3px 8px', cursor: 'pointer', border: '1px solid #ccc', borderRadius: '3px', backgroundColor: '#f0f0f0' },
    };

    if (!options || options.length === 0) {
        return (
            <div style={styles.container}>
                <h4 style={styles.title}>{text}</h4>
                <p>No options available for ranking.</p>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            <h4 style={styles.title}>{text} <small>(Click buttons to reorder)</small></h4>
            <ul style={styles.list}>
                {rankedItems.map((item, index) => (
                    <li key={item} style={styles.listItem}>
                        <span style={styles.itemText}>{index + 1}. {item}</span>
                        <div style={styles.buttonGroup}>
                            <button onClick={() => moveItem(index, -1)} disabled={index === 0} style={styles.button}>↑</button>
                            <button onClick={() => moveItem(index, 1)} disabled={index === rankedItems.length - 1} style={styles.button}>↓</button>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default RankingQuestion;