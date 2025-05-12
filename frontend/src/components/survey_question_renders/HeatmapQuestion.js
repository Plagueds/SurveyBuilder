// frontend/src/components/survey_question_renders/HeatmapQuestion.js
import React, { useState, useEffect, useRef } from 'react';

const HeatmapQuestion = ({ question, currentAnswer, onAnswerChange }) => {
    const { _id: questionId, text, imageUrl, heatmapMaxClicks } = question;
    const [clicks, setClicks] = useState(Array.isArray(currentAnswer) ? currentAnswer : []);
    const imageRef = useRef(null);

    useEffect(() => {
        setClicks(Array.isArray(currentAnswer) ? currentAnswer : []);
    }, [currentAnswer]);

    const handleImageClick = (event) => {
        if (!imageRef.current) return;
        if (heatmapMaxClicks && clicks.length >= parseInt(heatmapMaxClicks)) {
            alert(`You have reached the maximum of ${heatmapMaxClicks} clicks.`);
            return;
        }

        const rect = imageRef.current.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width; // Normalize x
        const y = (event.clientY - rect.top) / rect.height; // Normalize y

        if (x >= 0 && x <= 1 && y >= 0 && y <= 1) { // Ensure click is within image bounds
            const newClick = { x, y, timestamp: Date.now() };
            const newClicks = [...clicks, newClick];
            setClicks(newClicks);
            onAnswerChange(questionId, newClicks);
        }
    };

    const clearClicks = () => {
        setClicks([]);
        onAnswerChange(questionId, []);
    };

    const styles = {
        container: { margin: '15px 0', padding: '10px', border: '1px solid #eee', borderRadius: '5px', backgroundColor: '#f9f9f9' },
        title: { margin: '0 0 10px 0', fontSize: '1.1em' },
        imageContainer: { position: 'relative', display: 'inline-block', maxWidth: '100%', border: '1px solid #ccc', cursor: 'crosshair' },
        image: { display: 'block', maxWidth: '100%', maxHeight: '500px' },
        clickDot: { position: 'absolute', width: '10px', height: '10px', backgroundColor: 'rgba(255, 0, 0, 0.7)', borderRadius: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none' },
        controls: { marginTop: '10px' },
        button: { padding: '5px 10px', cursor: 'pointer', border: '1px solid #ccc', borderRadius: '3px', backgroundColor: '#f0f0f0' },
        clickInfo: { fontSize: '0.9em', color: '#555', marginTop: '5px' }
    };

    if (!imageUrl) {
        return (
            <div style={styles.container}>
                <h4 style={styles.title}>{text}</h4>
                <p>Image URL is missing for this heatmap question.</p>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            <h4 style={styles.title}>{text}</h4>
            <div style={styles.imageContainer} onClick={handleImageClick}>
                <img ref={imageRef} src={imageUrl} alt="Heatmap base" style={styles.image} />
                {clicks.map((click, index) => (
                    <div
                        key={index}
                        style={{
                            ...styles.clickDot,
                            left: `${click.x * 100}%`,
                            top: `${click.y * 100}%`,
                        }}
                        title={`Click ${index + 1} at (${click.x.toFixed(2)}, ${click.y.toFixed(2)})`}
                    />
                ))}
            </div>
            <div style={styles.controls}>
                <button onClick={clearClicks} style={styles.button}>Clear Clicks</button>
                <p style={styles.clickInfo}>
                    Clicks: {clicks.length}
                    {heatmapMaxClicks && ` / ${heatmapMaxClicks}`}
                </p>
            </div>
        </div>
    );
};

export default HeatmapQuestion;