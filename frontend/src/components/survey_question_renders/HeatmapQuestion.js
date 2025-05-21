// frontend/src/components/survey_question_renders/HeatmapQuestion.js
// ----- START OF UPDATED FILE (v1.2 - Refined Heatmap Click) -----
import React, { useState, useEffect, useRef } from 'react';
import styles from './SurveyQuestionStyles.module.css';

const HeatmapQuestion = ({ question, currentAnswer, onAnswerChange, isPreviewMode }) => {
    const { _id: questionId, text, imageUrl, heatmapMaxClicks, description } = question;
    const [clicks, setClicks] = useState(Array.isArray(currentAnswer) ? currentAnswer : []);
    const imageRef = useRef(null);
    const containerRef = useRef(null); // NEW: Ref for the container

    useEffect(() => {
        setClicks(Array.isArray(currentAnswer) ? currentAnswer : []);
    }, [currentAnswer]);

    const handleImageClick = (event) => {
        // Ensure both refs are available
        if (!imageRef.current || !containerRef.current) return;

        if (heatmapMaxClicks && clicks.length >= parseInt(heatmapMaxClicks)) {
            // Consider using the validation modal here too for consistency
            alert(`You have reached the maximum of ${heatmapMaxClicks} clicks.`);
            return;
        }

        const imageElement = imageRef.current;
        const containerElement = containerRef.current;

        // Get bounding client rect for both the image and the container
        const imageRect = imageElement.getBoundingClientRect();
        const containerRect = containerElement.getBoundingClientRect(); // Click event is on this

        // Calculate click position relative to the container (where the event listener is)
        const clickXInContainer = event.clientX - containerRect.left;
        const clickYInContainer = event.clientY - containerRect.top;

        // Calculate the image's offset within the container
        // This accounts for centering by flexbox if image aspect ratio != container aspect ratio
        const imageOffsetX = imageRect.left - containerRect.left;
        const imageOffsetY = imageRect.top - containerRect.top;

        // Calculate click position relative to the actual image's top-left corner
        const xOnImage = clickXInContainer - imageOffsetX;
        const yOnImage = clickYInContainer - imageOffsetY;

        // Check if the click was within the bounds of the actual image
        if (xOnImage >= 0 && xOnImage <= imageRect.width &&
            yOnImage >= 0 && yOnImage <= imageRect.height) {
            
            // Normalize coordinates to be relative to the image's dimensions (0 to 1)
            // Important: use imageRect.width and imageRect.height for normalization
            const relativeX = xOnImage / imageRect.width;
            const relativeY = yOnImage / imageRect.height;

            // Ensure normalized coordinates are clamped between 0 and 1 (due to potential floating point inaccuracies)
            const finalX = Math.max(0, Math.min(1, relativeX));
            const finalY = Math.max(0, Math.min(1, relativeY));

            const newClick = { x: finalX, y: finalY, timestamp: Date.now() };
            const newClicks = [...clicks, newClick];
            setClicks(newClicks);
            onAnswerChange(questionId, newClicks);
        } else {
            // Click was on the container but outside the actual image (e.g., in padded area)
            console.log("Click was outside the image bounds within the container.");
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
            {/* MODIFIED: Added ref to container and click handler here */}
            <div ref={containerRef} className={styles.heatmapImageContainer} onClick={handleImageClick}>
                <img ref={imageRef} src={imageUrl} alt="Heatmap base" className={styles.heatmapImage} />
                {clicks.map((click, index) => (
                    <div
                        key={`${questionId}-click-${index}`}
                        style={{
                            // Dots are positioned relative to the container.
                            // The click.x and click.y are already normalized (0-1) relative to the image.
                            // So, if the image is centered, these percentages should still map correctly
                            // onto the image's visual area within the container.
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
                    type="button"
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
// ----- END OF UPDATED FILE (v1.2 - Refined Heatmap Click) -----