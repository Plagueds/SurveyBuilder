// frontend/src/components/survey_question_renders/HeatmapQuestion.js
// ----- START OF UPDATED FILE (v1.4 - Support definedHeatmapAreas and report areaId in clicks) -----
import React, { useState, useEffect, useRef } from 'react';
import styles from './SurveyQuestionStyles.module.css';

// Helper function to check if a point is inside a rectangle
const isPointInRect = (point, rect) => {
    return (
        point.x >= rect.x &&
        point.x <= rect.x + rect.width &&
        point.y >= rect.y &&
        point.y <= rect.y + rect.height
    );
};

const HeatmapQuestion = ({ question, currentAnswer, onAnswerChange, isPreviewMode, disabled }) => { // Added disabled prop
    const { 
        _id: questionId, 
        text, 
        imageUrl, 
        heatmapMaxClicks, 
        description,
        definedHeatmapAreas = [] // Expect this prop
    } = question;
    
    // currentAnswer structure: { clicks: Array<{x,y,timestamp,areaId?}>, totalClicks: number, clickedAreaIds: Array<string> }
    const [clicks, setClicks] = useState([]);
    const [clickedAreaIdsSet, setClickedAreaIdsSet] = useState(new Set()); // Using a Set for unique area IDs

    const imageRef = useRef(null);
    const containerRef = useRef(null);
    const [imageRenderInfo, setImageRenderInfo] = useState({
        width: 0, height: 0, offsetX: 0, offsetY: 0
    });

    useEffect(() => {
        if (currentAnswer && typeof currentAnswer === 'object') {
            setClicks(Array.isArray(currentAnswer.clicks) ? currentAnswer.clicks : []);
            setClickedAreaIdsSet(new Set(Array.isArray(currentAnswer.clickedAreaIds) ? currentAnswer.clickedAreaIds : []));
        } else if (Array.isArray(currentAnswer)) { // Handle old array-only format for backward compatibility if needed
            setClicks(currentAnswer);
            // Attempt to derive clickedAreaIds if old format and definedHeatmapAreas are present
            // This is complex and might be better handled by a one-time migration or by just starting fresh
            const derivedAreaIds = new Set();
            if (definedHeatmapAreas.length > 0 && currentAnswer.length > 0) {
                currentAnswer.forEach(click => {
                    definedHeatmapAreas.forEach(area => {
                        if (isPointInRect({ x: click.x, y: click.y }, area)) {
                            derivedAreaIds.add(area.id);
                        }
                    });
                });
            }
            setClickedAreaIdsSet(derivedAreaIds);
        } else {
            setClicks([]);
            setClickedAreaIdsSet(new Set());
        }
    }, [currentAnswer, definedHeatmapAreas]); // Re-evaluate if definedHeatmapAreas changes too

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

    useEffect(() => {
        const imgElement = imageRef.current;
        if (imgElement) {
            const handleLoad = () => updateImageRenderInfo();
            imgElement.addEventListener('load', handleLoad);
            if (imgElement.complete && imgElement.naturalWidth > 0) updateImageRenderInfo();
            return () => imgElement.removeEventListener('load', handleLoad);
        }
    }, [imageUrl]);

     useEffect(() => {
        window.addEventListener('resize', updateImageRenderInfo);
        return () => window.removeEventListener('resize', updateImageRenderInfo);
    }, []);

    const handleImageClick = (event) => {
        if (disabled || !imageRef.current || !containerRef.current || imageRenderInfo.width === 0 || imageRenderInfo.height === 0) {
            return;
        }
        if (heatmapMaxClicks && clicks.length >= parseInt(heatmapMaxClicks)) {
            alert(`You have reached the maximum of ${heatmapMaxClicks} clicks.`);
            return;
        }
        const containerRect = containerRef.current.getBoundingClientRect();
        const clickXInContainer = event.clientX - containerRect.left;
        const clickYInContainer = event.clientY - containerRect.top;
        const xOnImage = clickXInContainer - imageRenderInfo.offsetX;
        const yOnImage = clickYInContainer - imageRenderInfo.offsetY;

        if (xOnImage >= 0 && xOnImage <= imageRenderInfo.width && yOnImage >= 0 && yOnImage <= imageRenderInfo.height) {
            const relativeX = xOnImage / imageRenderInfo.width;
            const relativeY = yOnImage / imageRenderInfo.height;
            const finalX = Math.max(0, Math.min(1, relativeX));
            const finalY = Math.max(0, Math.min(1, relativeY));

            let clickAreaId = null;
            // Check if click is within any defined area
            for (const area of definedHeatmapAreas) {
                // area coords (x,y,width,height) are also normalized (0-1)
                if (isPointInRect({ x: finalX, y: finalY }, area)) {
                    clickAreaId = area.id; // Assuming areas don't overlap or first one found is fine
                    break; 
                }
            }

            const newClick = { x: finalX, y: finalY, timestamp: Date.now(), areaId: clickAreaId };
            const newClicksArray = [...clicks, newClick];
            setClicks(newClicksArray);

            const newClickedAreaIds = new Set(clickedAreaIdsSet);
            if (clickAreaId) {
                newClickedAreaIds.add(clickAreaId);
            }
            setClickedAreaIdsSet(newClickedAreaIds);

            onAnswerChange(questionId, {
                clicks: newClicksArray,
                totalClicks: newClicksArray.length,
                clickedAreaIds: Array.from(newClickedAreaIds) // Convert Set to Array for storing in JSON/DB
            });
        }
    };

    const clearClicks = () => {
        if (disabled) return;
        setClicks([]);
        setClickedAreaIdsSet(new Set());
        onAnswerChange(questionId, { clicks: [], totalClicks: 0, clickedAreaIds: [] });
    };

    if (!imageUrl) {
        return (
            <div className={`${styles.questionContainer} ${disabled ? styles.disabled : ''}`}>
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
        <div className={`${styles.questionContainer} ${disabled ? styles.disabled : ''}`}>
            <h4 className={styles.questionText}>
                {text}
                {question.requiredSetting === 'required' && !isPreviewMode && <span className={styles.requiredIndicator}>*</span>}
            </h4>
            {description && <p className={styles.questionDescription}>{description}</p>}
            <div ref={containerRef} className={styles.heatmapImageContainer} onClick={handleImageClick}>
                <img ref={imageRef} src={imageUrl} alt="Heatmap base" className={styles.heatmapImage} />
                {imageRenderInfo.width > 0 && definedHeatmapAreas && definedHeatmapAreas.map(area => (
                     <div key={`defined-area-${area.id}`}
                          style={{
                              position: 'absolute',
                              left: `${imageRenderInfo.offsetX + (area.x * imageRenderInfo.width)}px`,
                              top: `${imageRenderInfo.offsetY + (area.y * imageRenderInfo.height)}px`,
                              width: `${area.width * imageRenderInfo.width}px`,
                              height: `${area.height * imageRenderInfo.height}px`,
                              border: '1px dashed rgba(255, 255, 0, 0.7)', // Yellow dashed line for defined areas
                              pointerEvents: 'none',
                              boxSizing: 'border-box',
                              zIndex: 1, // Below click dots
                          }}
                          title={area.name}
                     >
                        <span style={{
                            position: 'absolute', 
                            top: '2px', 
                            left: '2px', 
                            color: 'yellow', 
                            fontSize: '10px', 
                            backgroundColor: 'rgba(0,0,0,0.3)', 
                            padding: '1px 3px',
                            borderRadius: '2px'
                        }}>{area.name}</span>
                     </div>
                ))}
                {imageRenderInfo.width > 0 && clicks.map((click, index) => {
                    const dotLeft = imageRenderInfo.offsetX + (click.x * imageRenderInfo.width);
                    const dotTop = imageRenderInfo.offsetY + (click.y * imageRenderInfo.height);
                    return (
                        <div
                            key={`${questionId}-click-${index}-${click.timestamp}`} // More unique key
                            style={{ left: `${dotLeft}px`, top: `${dotTop}px` }}
                            className={styles.heatmapClickDot}
                            title={`Click ${index + 1} ${click.areaId ? `(in area ${definedHeatmapAreas.find(a=>a.id===click.areaId)?.name || click.areaId})` : ''}`}
                        />
                    );
                })}
            </div>
            <div className={styles.heatmapControls}>
                <button type="button" onClick={clearClicks} className={styles.heatmapButton} disabled={disabled}>
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
// ----- END OF UPDATED FILE (v1.4 - Support definedHeatmapAreas and report areaId in clicks) -----