// frontend/src/components/survey_question_renders/HeatmapQuestion.js
// ----- START OF UPDATED FILE (v1.3 - More Accurate Heatmap Dot Placement) -----
import React, { useState, useEffect, useRef } from 'react';
import styles from './SurveyQuestionStyles.module.css';

const HeatmapQuestion = ({ question, currentAnswer, onAnswerChange, isPreviewMode }) => {
    const { _id: questionId, text, imageUrl, heatmapMaxClicks, description } = question;
    
    // Store clicks as normalized coordinates { x: 0-1, y: 0-1 }
    const [clicks, setClicks] = useState(Array.isArray(currentAnswer) ? currentAnswer : []);
    
    const imageRef = useRef(null);
    const containerRef = useRef(null);

    // State to store the image's rendered dimensions and offset within the container
    // This is crucial for accurately placing dots later.
    const [imageRenderInfo, setImageRenderInfo] = useState({
        width: 0, height: 0, // Rendered width/height of the image
        offsetX: 0, offsetY: 0 // Offset of the image within the container
    });

    useEffect(() => {
        setClicks(Array.isArray(currentAnswer) ? currentAnswer : []);
    }, [currentAnswer]);

    // Function to update image render info
    const updateImageRenderInfo = () => {
        if (imageRef.current && containerRef.current && imageRef.current.complete && imageRef.current.naturalWidth > 0) {
            const imageElement = imageRef.current;
            const containerElement = containerRef.current;

            const imageRect = imageElement.getBoundingClientRect();
            const containerRect = containerElement.getBoundingClientRect();

            setImageRenderInfo({
                width: imageRect.width,
                height: imageRect.height,
                offsetX: imageRect.left - containerRect.left,
                offsetY: imageRect.top - containerRect.top,
            });
        } else {
             setImageRenderInfo({ width: 0, height: 0, offsetX: 0, offsetY: 0 });
        }
    };

    // Update image info when image loads or container resizes (simplified to image load for now)
    useEffect(() => {
        const imgElement = imageRef.current;
        if (imgElement) {
            imgElement.addEventListener('load', updateImageRenderInfo);
            // Also call if already loaded
            if (imgElement.complete && imgElement.naturalWidth > 0) {
                updateImageRenderInfo();
            }
        }
        // Consider ResizeObserver on containerRef for more dynamic updates if needed
        return () => {
            if (imgElement) {
                imgElement.removeEventListener('load', updateImageRenderInfo);
            }
        };
    }, [imageUrl]); // Re-run if imageUrl changes

    // Also update on window resize as a fallback, as flex centering can change offsets
     useEffect(() => {
        window.addEventListener('resize', updateImageRenderInfo);
        return () => {
            window.removeEventListener('resize', updateImageRenderInfo);
        };
    }, []);


    const handleImageClick = (event) => {
        if (!imageRef.current || !containerRef.current || imageRenderInfo.width === 0 || imageRenderInfo.height === 0) {
            console.warn("Image or container not ready for click.");
            return;
        }

        if (heatmapMaxClicks && clicks.length >= parseInt(heatmapMaxClicks)) {
            alert(`You have reached the maximum of ${heatmapMaxClicks} clicks.`);
            return;
        }

        const containerRect = containerRef.current.getBoundingClientRect();

        // Click position relative to the container
        const clickXInContainer = event.clientX - containerRect.left;
        const clickYInContainer = event.clientY - containerRect.top;

        // Click position relative to the actual image's top-left corner
        // Uses the stored imageRenderInfo for image's offset and dimensions
        const xOnImage = clickXInContainer - imageRenderInfo.offsetX;
        const yOnImage = clickYInContainer - imageRenderInfo.offsetY;

        // Check if the click was within the bounds of the actual image
        if (xOnImage >= 0 && xOnImage <= imageRenderInfo.width &&
            yOnImage >= 0 && yOnImage <= imageRenderInfo.height) {
            
            const relativeX = xOnImage / imageRenderInfo.width;
            const relativeY = yOnImage / imageRenderInfo.height;

            const finalX = Math.max(0, Math.min(1, relativeX));
            const finalY = Math.max(0, Math.min(1, relativeY));

            const newClick = { x: finalX, y: finalY, timestamp: Date.now() };
            const newClicks = [...clicks, newClick];
            setClicks(newClicks);
            onAnswerChange(questionId, newClicks);
        } else {
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
            <div ref={containerRef} className={styles.heatmapImageContainer} onClick={handleImageClick}>
                {/* Image must be loaded for imageRenderInfo to be accurate */}
                <img 
                    ref={imageRef} 
                    src={imageUrl} 
                    alt="Heatmap base" 
                    className={styles.heatmapImage}
                    // onLoad event is handled by useEffect now to set imageRenderInfo
                />
                {imageRenderInfo.width > 0 && clicks.map((click, index) => {
                    // Calculate dot position in pixels relative to the container's top-left
                    const dotLeft = imageRenderInfo.offsetX + (click.x * imageRenderInfo.width);
                    const dotTop = imageRenderInfo.offsetY + (click.y * imageRenderInfo.height);

                    return (
                        <div
                            key={`${questionId}-click-${index}`}
                            style={{
                                left: `${dotLeft}px`, // Use pixel values
                                top: `${dotTop}px`,   // Use pixel values
                            }}
                            className={styles.heatmapClickDot}
                            title={`Click ${index + 1} at (${click.x.toFixed(3)}, ${click.y.toFixed(3)})`}
                        />
                    );
                })}
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
// ----- END OF UPDATED FILE (v1.3 - More Accurate Heatmap Dot Placement) -----