// frontend/src/components/survey_question_renders/SliderQuestion.js
import React, { useState, useEffect } from 'react';

const SliderQuestion = ({ question, currentAnswer, onAnswerChange }) => {
    const {
        _id: questionId,
        text,
        sliderMin = 0,
        sliderMax = 100,
        sliderStep = 1,
        sliderMinLabel = '',
        sliderMaxLabel = ''
    } = question;

    const initialValue = currentAnswer !== undefined && currentAnswer !== null && !isNaN(parseFloat(currentAnswer))
        ? parseFloat(currentAnswer)
        : parseFloat(sliderMin); // Default to min if no answer or invalid

    const [value, setValue] = useState(initialValue);

    useEffect(() => {
        // Update if currentAnswer prop changes from parent
        const newInitialValue = currentAnswer !== undefined && currentAnswer !== null && !isNaN(parseFloat(currentAnswer))
            ? parseFloat(currentAnswer)
            : parseFloat(sliderMin);
        setValue(newInitialValue);
    }, [currentAnswer, sliderMin]);


    const handleChange = (event) => {
        const newValue = parseFloat(event.target.value);
        setValue(newValue);
        onAnswerChange(questionId, newValue);
    };

    const styles = {
        container: { margin: '15px 0', padding: '10px', border: '1px solid #eee', borderRadius: '5px', backgroundColor: '#f9f9f9' },
        title: { margin: '0 0 10px 0', fontSize: '1.1em' },
        sliderContainer: { display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' },
        label: { minWidth: '50px', textAlign: 'center' },
        input: { flexGrow: 1, cursor: 'pointer' },
        currentValue: { fontWeight: 'bold', fontSize: '1.1em', marginLeft: '15px', minWidth: '40px', textAlign: 'right' },
    };

    return (
        <div style={styles.container}>
            <h4 style={styles.title}>{text}</h4>
            <div style={styles.sliderContainer}>
                {sliderMinLabel && <span style={styles.label}>{sliderMinLabel}</span>}
                <input
                    type="range"
                    min={sliderMin}
                    max={sliderMax}
                    step={sliderStep}
                    value={value}
                    onChange={handleChange}
                    style={styles.input}
                />
                {sliderMaxLabel && <span style={styles.label}>{sliderMaxLabel}</span>}
                <span style={styles.currentValue}>{value}</span>
            </div>
        </div>
    );
};

export default SliderQuestion;