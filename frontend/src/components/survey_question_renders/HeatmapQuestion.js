// frontend/src/components/survey_question_renders/HeatmapQuestion.js
// ----- START OF COMPLETE MODIFIED FILE (v1.1 - Added type="button") -----
import React, { useState, useEffect, useRef } from 'react';
import styles from './SurveyQuestionStyles.module.css'; // Assuming you've applied styles

const HeatmapQuestion = ({ question, currentAnswer, onAnswerChange, isPreviewMode }) => {
    const { _id: questionId, text, imageUrl, heatmapMaxClicks, description } = question;
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
        const x = (event.clientX - rect.left) / rect.width;
        const y = (event.clientY - rect.top) / rect.height;

        if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
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

    if (!imageUrl) {
        return (
            <div className={styles.questionContainer}>
                <h4 className={styles.questionText}>
                    {text}
                    {question.requiredSetting === 'required' && !isPreviewMode && <span className={styles.requiredIndicator}>*</span>}
                </h4>
                {description && <p className={styles.questionDescription}>{description}</p>}
                <p className={styles.questionDescription}>Image URL is missing for this heatmap question.</p>
            </div>
        );
    }

    return (
        <div className={styles.questionContainer}>
            <h4 className={styles.questionText}>
                {text}
                {question.requiredSetting === 'required' && !isPreviewMode && <span className={styles.requiredIndicator}>*</span>}
            </h4>
            {description && <p className={styles.questionDescription}>{description}</p>}
            <div className={styles.heatmapImageContainer} onClick={handleImageClick}>
                <img ref={imageRef} src={imageUrl} alt="Heatmap base" className={styles.heatmapImage} />
                {clicks.map((click, index) => (
                    <div
                        key={`${questionId}-click-${index}`} // More unique key
                        style={{
                            left: `${click.x * 100}%`,
                            top: `${click.y * 100}%`,
                        }}
                        className={styles.heatmapClickDot}
                        title={`Click ${index + 1} at (${click.x.toFixed(2)}, ${click.y.toFixed(2)})`}
                    />
                ))}
            </div>
            <div className={styles.heatmapControls}>
                <button
                    type="button" // PREVENTS FORM SUBMISSION
                    onClick={clearClicks}
                    className={styles.heatmapButton}
                >
                    Clear Clicks
                </button>
                <p className={styles.heatmapClickInfo}>
                    Clicks: {clicks.length}
                    {heatmapMaxClicks && ` / ${heatmapMaxClicks}`}
                </p>
            </div>
        </div>
    );
};

export default HeatmapQuestion;
// ----- END OF COMPLETE MODIFIED FILE (v1.1) -----