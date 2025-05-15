// frontend/src/components/logic/HeatmapAreaSelectorModal.js
// ----- START OF MODIFIED FILE (v2.5.1 - Added Debug Logging) -----
import React, { useState, useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import { v4 as uuidv4 } from 'uuid';

const HeatmapAreaSelectorModal = forwardRef(({
    isOpen,
    onClose,
    onSaveAreas,
    imageUrl,
    initialAreas = [],
    styles, // This comes from SurveyBuildPage.module.css
    onDrawingStateChange
}, ref) => {
    const [areas, setAreas] = useState([]);
    const [selectedAreaId, setSelectedAreaId] = useState(null);
    const [editingAreaName, setEditingAreaName] = useState('');
    const [currentDrawing, setCurrentDrawing] = useState(null);
    const [isDrawing, setIsDrawingState] = useState(false);
    const [startPoint, setStartPoint] = useState({ x: 0, y: 0 });
    const [imageRenderedSize, setImageRenderedSize] = useState({ width: 0, height: 0, naturalWidth: 0, naturalHeight: 0 });
    const [error, setError] = useState('');

    const imageRef = useRef(null);
    const drawingCanvasRef = useRef(null);

    // --- DEBUG ---
    console.log('[HeatmapModal LOG] Props received:', { isOpen, imageUrl, initialAreasCount: initialAreas.length, stylesKeys: styles ? Object.keys(styles).length : 'No Styles Prop' });
    console.log('[HeatmapModal LOG] Current State:', { areasCount: areas.length, selectedAreaId, editingAreaName, currentDrawing, isDrawing, imageRenderedSize, error });


    useEffect(() => {
        if (typeof onDrawingStateChange === 'function') {
            onDrawingStateChange(isDrawing);
        }
    }, [isDrawing, onDrawingStateChange]);

    useEffect(() => {
        // --- DEBUG ---
        console.log('[HeatmapModal LOG] useEffect for isOpen/initialAreas triggered. isOpen:', isOpen);
        if (isOpen) {
            const processedAreas = initialAreas.map(area => ({
                ...area,
                id: area.id || uuidv4(),
            }));
            setAreas(processedAreas);
            setSelectedAreaId(null);
            setEditingAreaName('');
            setCurrentDrawing(null);
            setError('');
            setIsDrawingState(false);
            // Resetting imageRenderedSize here ensures it tries to recalculate when modal re-opens
            setImageRenderedSize({ width: 0, height: 0, naturalWidth: 0, naturalHeight: 0 });
            console.log('[HeatmapModal LOG] Modal opened, state reset, initialAreas processed.');
        }
    }, [initialAreas, isOpen]);

    const updateImageRenderedSize = useCallback(() => {
        // --- DEBUG ---
        console.log('[HeatmapModal LOG] updateImageRenderedSize called.');
        if (imageRef.current && imageRef.current.complete && imageRef.current.naturalWidth > 0) {
            const newSize = {
                width: imageRef.current.offsetWidth,
                height: imageRef.current.offsetHeight,
                naturalWidth: imageRef.current.naturalWidth,
                naturalHeight: imageRef.current.naturalHeight
            };
            console.log('[HeatmapModal LOG] Image ready, new calculated size:', newSize);
            setImageRenderedSize(newSize);
        } else if (imageRef.current) {
            console.warn('[HeatmapModal LOG] updateImageRenderedSize: Image ref exists but not ready. Complete:', imageRef.current.complete, 'NaturalW:', imageRef.current.naturalWidth, 'OffsetW:', imageRef.current.offsetWidth);
        } else {
            console.warn('[HeatmapModal LOG] updateImageRenderedSize: imageRef.current is null.');
        }
    }, []);


    useEffect(() => {
        const imgElement = imageRef.current;
        const handleLoad = () => {
            console.log("[HeatmapModal LOG] Image 'load' event fired on imgElement.");
            updateImageRenderedSize();
        };
        // --- DEBUG ---
        console.log('[HeatmapModal LOG] useEffect for image loading/sizing triggered. isOpen:', isOpen);

        if (isOpen && imgElement) {
            console.log('[HeatmapModal LOG] Image effect: isOpen and imgElement exists. Complete:', imgElement.complete, 'NaturalW:', imgElement.naturalWidth, 'OffsetW:', imgElement.offsetWidth);
            if (imgElement.complete && imgElement.naturalWidth > 0 && imgElement.offsetWidth > 0) { // Added offsetWidth check
                console.log('[HeatmapModal LOG] Image effect: Image already complete and rendered, calling updateImageRenderedSize.');
                updateImageRenderedSize();
            } else {
                console.log('[HeatmapModal LOG] Image effect: Image not complete or not rendered, adding "load" event listener.');
                imgElement.addEventListener('load', handleLoad);
            }
            window.addEventListener('resize', updateImageRenderedSize);
        }

        return () => {
            if (imgElement) {
                imgElement.removeEventListener('load', handleLoad);
            }
            window.removeEventListener('resize', updateImageRenderedSize);
            // --- DEBUG ---
            console.log('[HeatmapModal LOG] Image effect cleanup run.');
        };
    }, [isOpen, updateImageRenderedSize]); // updateImageRenderedSize is stable

    const getMousePositionOnImage = useCallback((event) => {
        if (!drawingCanvasRef.current || !imageRef.current || !imageRef.current.complete || imageRef.current.naturalWidth === 0 || imageRenderedSize.width === 0) {
            console.warn("[HeatmapModal LOG] Cannot get mouse position: canvas/image ref not ready or image not loaded/sized. imageRenderedSize.width:", imageRenderedSize.width);
            return { x: 0, y: 0, valid: false };
        }
        const canvasContainer = drawingCanvasRef.current;
        const rect = canvasContainer.getBoundingClientRect();
        let x = event.clientX - rect.left;
        let y = event.clientY - rect.top;
        x = Math.max(0, Math.min(x, imageRenderedSize.width));
        y = Math.max(0, Math.min(y, imageRenderedSize.height));
        return { x, y, valid: true };
    }, [imageRenderedSize]);


    const handleMouseDownOnCanvas = (event) => {
        // --- DEBUG ---
        console.log('[HeatmapModal LOG] handleMouseDownOnCanvas triggered.');
        if (event.button !== 0 || !imageRenderedSize.width || !imageRenderedSize.height) {
            console.warn('[HeatmapModal LOG] MouseDown prevented: Not left click or imageRenderedSize invalid.', {button: event.button, imgW: imageRenderedSize.width, imgH: imageRenderedSize.height});
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        const pos = getMousePositionOnImage(event);
        if (!pos.valid) {
            console.warn("[HeatmapModal LOG] Mouse down on canvas, but position is invalid.");
            return;
        }
        setIsDrawingState(true);
        setStartPoint({ x: pos.x, y: pos.y });
        setCurrentDrawing({
            x: pos.x / imageRenderedSize.width,
            y: pos.y / imageRenderedSize.height,
            width: 0,
            height: 0
        });
        setError('');
        console.log('[HeatmapModal LOG] Drawing started.');
    };

    const handleGlobalMouseMove = useCallback((event) => {
        if (!isDrawing || !imageRenderedSize.width || !imageRenderedSize.height) return;
        const currentPos = getMousePositionOnImage(event);
        if (!currentPos.valid) return;
        const rectX = Math.min(startPoint.x, currentPos.x);
        const rectY = Math.min(startPoint.y, currentPos.y);
        const rectWidth = Math.abs(currentPos.x - startPoint.x);
        const rectHeight = Math.abs(currentPos.y - startPoint.y);
        setCurrentDrawing({
            x: Math.max(0, Math.min(1, rectX / imageRenderedSize.width)),
            y: Math.max(0, Math.min(1, rectY / imageRenderedSize.height)),
            width: Math.max(0, Math.min(1, rectWidth / imageRenderedSize.width)),
            height: Math.max(0, Math.min(1, rectHeight / imageRenderedSize.height))
        });
    }, [isDrawing, imageRenderedSize, startPoint, getMousePositionOnImage]);

    const handleGlobalMouseUp = useCallback(() => {
        if (!isDrawing) return;
        // --- DEBUG ---
        console.log('[HeatmapModal LOG] handleGlobalMouseUp triggered.');
        setIsDrawingState(false);
        if (currentDrawing && (currentDrawing.width < 0.001 || currentDrawing.height < 0.001)) {
            setCurrentDrawing(null);
            console.log('[HeatmapModal LOG] Drawing ended, too small, cleared.');
        } else if (currentDrawing) {
            console.log('[HeatmapModal LOG] Drawing ended, currentDrawing:', currentDrawing);
        }
    }, [isDrawing, currentDrawing]);

    useImperativeHandle(ref, () => ({
        handleGlobalMouseMove,
        handleGlobalMouseUp
    }));

    const handleSelectAreaFromList = (areaId) => { /* ... no changes needed for logging here unless issues persist ... */ setSelectedAreaId(areaId); const area = areas.find(a => a.id === areaId); if (area) { setEditingAreaName(area.name); setCurrentDrawing({ x: area.x, y: area.y, width: area.width, height: area.height }); } setError(''); };
    const handleSaveOrUpdateArea = () => { /* ... */ };
    const handleDeleteSelectedArea = () => { /* ... */ };
    const handleStartNewAreaDefinition = () => { /* ... */ };
    const handleMainSaveAllAreas = () => { /* ... */ };

    if (!isOpen) return null;

    const activeRectangleToDisplay = currentDrawing;
    const selectionBoxStyle = activeRectangleToDisplay ? {
        position: 'absolute',
        left: `${activeRectangleToDisplay.x * 100}%`,
        top: `${activeRectangleToDisplay.y * 100}%`,
        width: `${activeRectangleToDisplay.width * 100}%`,
        height: `${activeRectangleToDisplay.height * 100}%`,
        border: '2px dashed var(--primary-color, red)',
        backgroundColor: 'var(--primary-color-alpha, rgba(255, 0, 0, 0.2))',
        boxSizing: 'border-box',
        pointerEvents: 'none',
        zIndex: 10,
    } : { display: 'none' };

    // --- DEBUG ---
    console.log('[HeatmapModal LOG] Rendering modal content. imageRenderedSize.width:', imageRenderedSize.width);

    return (
        // The className={styles.modalContent} etc. are important.
        // Ensure these classes exist in SurveyBuildPage.module.css and are correctly applied.
        <div className={`${styles.modalContent} ${styles.heatmapAreaModalContent}`}>
            <div className={styles.modalHeader}>
                <h3>Manage Heatmap Areas</h3>
                <button onClick={onClose} className={styles.modalCloseButton}>&times;</button>
            </div>
            <div className={`${styles.modalBody} ${styles.heatmapAreaModalBody}`}>
                {/* Panel for Listing Areas */}
                <div className={styles.heatmapAreaListPanel}>
                    <h4>Defined Areas</h4>
                    {/* --- DEBUG --- */}
                    {console.log('[HeatmapModal LOG] Rendering AreaListPanel. Areas count:', areas.length)}
                    {areas.length === 0 && <p className={styles.textMuted}>No areas defined yet.</p>}
                    <ul className={styles.heatmapDefinedAreasList}>
                        {areas.map(area => (
                            <li
                                key={area.id}
                                onClick={() => handleSelectAreaFromList(area.id)}
                                className={area.id === selectedAreaId ? styles.selectedAreaItem : ''}
                                title={`X:${area.x.toFixed(2)}, Y:${area.y.toFixed(2)}, W:${area.width.toFixed(2)}, H:${area.height.toFixed(2)}`}
                            >
                                {area.name}
                            </li>
                        ))}
                    </ul>
                    <button type="button" onClick={handleDeleteSelectedArea} className="button button-danger button-small" disabled={!selectedAreaId} style={{ marginTop: '10px', width: '100%' }}>
                        Delete Selected Area
                    </button>
                </div>

                {/* Panel for Drawing and Image */}
                <div className={styles.heatmapAreaDrawingPanel}>
                     {/* --- DEBUG --- */}
                    {console.log('[HeatmapModal LOG] Rendering DrawingPanel. imageRenderedSize.width:', imageRenderedSize.width, 'imageUrl:', imageUrl)}
                    <p className={styles.modalInstructions}>
                        To add/update: 1. Select/Start New. 2. Draw on image. 3. Name it. 4. Save/Update Area.
                    </p>
                    {error && <p className={styles.invalidFeedback} style={{display: 'block'}}>{error}</p>}
                    <div
                        ref={drawingCanvasRef}
                        className={styles.heatmapImageContainer} // Ensure this class provides proper dimensions and positioning
                        onMouseDown={handleMouseDownOnCanvas}
                    >
                        <img
                            ref={imageRef}
                            src={imageUrl}
                            alt="Heatmap for area selection"
                            draggable="false"
                            className={styles.heatmapSelectableImage} // Ensure this class allows the image to take up space
                            onLoad={() => { // Direct onLoad for more immediate feedback
                                console.log("[HeatmapModal LOG] Inline img onLoad triggered on <img> tag.");
                                updateImageRenderedSize();
                            }}
                            onError={() => {
                                console.error("[HeatmapModal LOG] Image failed to load:", imageUrl);
                                setError("Failed to load heatmap image.");
                            }}
                        />
                        {/* These conditional renders depend on imageRenderedSize.width */}
                        {imageRenderedSize.width > 0 && areas.map(area => (
                            <div key={`display-${area.id}`} style={{
                                position: 'absolute',
                                left: `${area.x * 100}%`, top: `${area.y * 100}%`,
                                width: `${area.width * 100}%`, height: `${area.height * 100}%`,
                                border: `1px solid ${area.id === selectedAreaId ? 'var(--primary-color, blue)' : 'rgba(0,0,255,0.3)'}`,
                                backgroundColor: area.id === selectedAreaId ? 'rgba(0,0,255,0.15)' : 'rgba(0,0,255,0.05)',
                                pointerEvents: 'none', boxSizing: 'border-box',
                                zIndex: area.id === selectedAreaId ? 2 : 1,
                            }}>
                                <span className={styles.heatmapAreaLabelOnImage}>{area.name}</span>
                            </div>
                        ))}
                        {imageRenderedSize.width > 0 && <div style={selectionBoxStyle}></div>}
                        {imageRenderedSize.width === 0 && imageUrl && <p className={styles.textMuted}>Loading image or image dimensions not yet available...</p>}
                    </div>

                    {/* Controls for Naming and Saving Individual Areas */}
                    <div className={styles.heatmapAreaControls}>
                        {/* --- DEBUG --- */}
                        {console.log('[HeatmapModal LOG] Rendering AreaControls.')}
                        <button type="button" onClick={handleStartNewAreaDefinition} className="button button-secondary">
                            Start New/Clear Drawing
                        </button>
                        <input
                            id="heatmapAreaNameInput"
                            type="text"
                            value={editingAreaName}
                            onChange={(e) => { setEditingAreaName(e.target.value); setError(''); }}
                            placeholder="Enter Area Name"
                            className={styles.formControl} // Make sure this style is appropriate
                        />
                        <button type="button" onClick={handleSaveOrUpdateArea} className="button button-primary" disabled={!editingAreaName.trim() || (!currentDrawing && !selectedAreaId) || (currentDrawing && (currentDrawing.width < 0.001 || currentDrawing.height < 0.001))}>
                            {selectedAreaId ? 'Update Area' : 'Save New Area'}
                        </button>
                    </div>
                    <div className={styles.heatmapCoordsDisplay}>
                        Current Drawing (Normalized):
                        X: {(currentDrawing?.x || 0).toFixed(3)}, Y: {(currentDrawing?.y || 0).toFixed(3)},
                        W: {(currentDrawing?.width || 0).toFixed(3)}, H: {(currentDrawing?.height || 0).toFixed(3)}
                    </div>
                </div>
            </div>
            <div className={styles.modalFooter}>
                <button type="button" className="button button-secondary" onClick={onClose}>Cancel</button>
                <button type="button" className="button button-primary" onClick={handleMainSaveAllAreas}>Save All Defined Areas</button>
            </div>
        </div>
    );
});

export default HeatmapAreaSelectorModal;
// ----- END OF MODIFIED FILE (v2.5.1 - Added Debug Logging) -----