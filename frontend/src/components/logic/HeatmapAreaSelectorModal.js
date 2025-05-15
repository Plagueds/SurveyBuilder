// frontend/src/components/logic/HeatmapAreaSelectorModal.js
// ----- START OF MODIFIED FILE (v2.5.2 - Added More Button Debug Logging) -----
import React, { useState, useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import { v4 as uuidv4 } from 'uuid';

const HeatmapAreaSelectorModal = forwardRef(({
    isOpen,
    onClose,
    onSaveAreas,
    imageUrl,
    initialAreas = [],
    styles, 
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
    const drawingCanvasRef = useRef(null); // This is the container for the image

    console.log('[HeatmapModal LOG] Component Render/Re-render. isOpen:', isOpen, 'isDrawing:', isDrawing, 'currentDrawing:', currentDrawing, 'selectedAreaId:', selectedAreaId, 'editingAreaName:', editingAreaName, 'imageRenderedSize:', imageRenderedSize.width);

    useEffect(() => {
        if (typeof onDrawingStateChange === 'function') {
            onDrawingStateChange(isDrawing);
        }
    }, [isDrawing, onDrawingStateChange]);

    useEffect(() => {
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
            setImageRenderedSize({ width: 0, height: 0, naturalWidth: 0, naturalHeight: 0 });
            console.log('[HeatmapModal LOG] Modal opened, state reset, initialAreas processed:', processedAreas);
        }
    }, [initialAreas, isOpen]);

    const updateImageRenderedSize = useCallback(() => {
        console.log('[HeatmapModal LOG] updateImageRenderedSize called.');
        if (imageRef.current && imageRef.current.complete && imageRef.current.naturalWidth > 0) {
            const newSize = {
                width: imageRef.current.offsetWidth,
                height: imageRef.current.offsetHeight,
                naturalWidth: imageRef.current.naturalWidth,
                naturalHeight: imageRef.current.naturalHeight
            };
            console.log('[HeatmapModal LOG] Image ready, new calculated size:', newSize);
            if (newSize.width > 0 && newSize.height > 0) {
                setImageRenderedSize(newSize);
            } else {
                console.warn('[HeatmapModal LOG] updateImageRenderedSize: Calculated newSize has zero width or height. Not updating state.', newSize);
            }
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
        console.log('[HeatmapModal LOG] useEffect for image loading/sizing triggered. isOpen:', isOpen);

        if (isOpen && imgElement) {
            console.log('[HeatmapModal LOG] Image effect: isOpen and imgElement exists. Complete:', imgElement.complete, 'NaturalW:', imgElement.naturalWidth, 'OffsetW:', imgElement.offsetWidth);
            if (imgElement.complete && imgElement.naturalWidth > 0 && imgElement.offsetWidth > 0) {
                console.log('[HeatmapModal LOG] Image effect: Image already complete and rendered, calling updateImageRenderedSize.');
                updateImageRenderedSize();
            } else {
                console.log('[HeatmapModal LOG] Image effect: Image not complete or not rendered, adding "load" event listener.');
                imgElement.addEventListener('load', handleLoad);
            }
            window.addEventListener('resize', updateImageRenderedSize); // For responsive resizing
        }

        return () => {
            if (imgElement) {
                imgElement.removeEventListener('load', handleLoad);
            }
            window.removeEventListener('resize', updateImageRenderedSize);
            console.log('[HeatmapModal LOG] Image effect cleanup run.');
        };
    }, [isOpen, updateImageRenderedSize]);

    const getMousePositionOnImage = useCallback((event) => {
        if (!drawingCanvasRef.current || !imageRef.current || !imageRef.current.complete || imageRef.current.naturalWidth === 0 || imageRenderedSize.width === 0) {
            console.warn("[HeatmapModal LOG] Cannot get mouse position: canvas/image ref not ready or image not loaded/sized. imageRenderedSize.width:", imageRenderedSize.width);
            return { x: 0, y: 0, valid: false };
        }
        const canvasContainer = drawingCanvasRef.current; // This is the div containing the image
        const rect = canvasContainer.getBoundingClientRect();
        let x = event.clientX - rect.left;
        let y = event.clientY - rect.top;
        
        // Clamp coordinates to be within the container's dimensions
        x = Math.max(0, Math.min(x, rect.width)); // Use rect.width (rendered container width)
        y = Math.max(0, Math.min(y, rect.height)); // Use rect.height (rendered container height)

        console.logSilly?.('[HeatmapModal LOG] Mouse Pos on ImageContainer:', { clientX: event.clientX, clientY: event.clientY, rectL: rect.left, rectT: rect.top, containerRelX: x, containerRelY: y, containerW: rect.width, containerH: rect.height });
        
        return { x, y, valid: true };
    }, [imageRenderedSize]); // imageRenderedSize dependency is important for normalization later

    const handleMouseDownOnCanvas = (event) => {
        console.log('[HeatmapModal LOG] handleMouseDownOnCanvas triggered.');
        if (event.button !== 0 || !imageRenderedSize.width || !imageRenderedSize.height) {
            console.warn('[HeatmapModal LOG] MouseDown prevented: Not left click or imageRenderedSize invalid (width/height is zero).', {button: event.button, imgRenderedW: imageRenderedSize.width, imgRenderedH: imageRenderedSize.height});
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        
        const pos = getMousePositionOnImage(event);
        if (!pos.valid) {
            console.warn("[HeatmapModal LOG] Mouse down on canvas, but getMousePositionOnImage returned invalid.");
            return;
        }

        // pos.x and pos.y are pixel coordinates relative to the drawingCanvasRef (image container)
        // Normalize these based on the *rendered size of the image* if different from container,
        // or assume image fills container and normalize by container dimensions if that's the visual truth.
        // For now, imageRenderedSize is from image.offsetWidth/Height.
        // If image is smaller than container, these coordinates need to be scaled or offset
        // if imageRenderedSize is the *natural* size but displayed smaller.
        // Let's assume for now imageRenderedSize is the actual rendered dimension of the image element.

        setIsDrawingState(true);
        setStartPoint({ x: pos.x, y: pos.y }); // Store pixel start point relative to container
        
        // CurrentDrawing stores normalized coordinates (0 to 1)
        // These should be normalized against the image's actual rendered dimensions (imageRenderedSize)
        setCurrentDrawing({
            x: pos.x / imageRenderedSize.width,
            y: pos.y / imageRenderedSize.height,
            width: 0,
            height: 0
        });
        setError('');
        console.log('[HeatmapModal LOG] Drawing started. StartPoint (pixels):', {x: pos.x, y: pos.y}, 'Initial CurrentDrawing (normalized):', {x: pos.x / imageRenderedSize.width, y: pos.y / imageRenderedSize.height});
    };

    const handleGlobalMouseMove = useCallback((event) => {
        if (!isDrawing || !imageRenderedSize.width || !imageRenderedSize.height) return;
        
        const currentPos = getMousePositionOnImage(event); // pixel coords relative to container
        if (!currentPos.valid) return;

        const rectXpixels = Math.min(startPoint.x, currentPos.x);
        const rectYpixels = Math.min(startPoint.y, currentPos.y);
        const rectWidthPixels = Math.abs(currentPos.x - startPoint.x);
        const rectHeightPixels = Math.abs(currentPos.y - startPoint.y);

        setCurrentDrawing({
            x: Math.max(0, Math.min(1, rectXpixels / imageRenderedSize.width)),
            y: Math.max(0, Math.min(1, rectYpixels / imageRenderedSize.height)),
            width: Math.max(0, Math.min(1, rectWidthPixels / imageRenderedSize.width)),
            height: Math.max(0, Math.min(1, rectHeightPixels / imageRenderedSize.height))
        });
        // console.logSilly?.('[HeatmapModal LOG] MouseMove, currentDrawing updated (normalized).');
    }, [isDrawing, imageRenderedSize, startPoint, getMousePositionOnImage]);

    const handleGlobalMouseUp = useCallback(() => {
        if (!isDrawing) return;
        console.log('[HeatmapModal LOG] handleGlobalMouseUp triggered.');
        setIsDrawingState(false);
        if (currentDrawing && (currentDrawing.width < (1 / imageRenderedSize.width) || currentDrawing.height < (1 / imageRenderedSize.height))) { // Min 1 pixel
            setCurrentDrawing(null); // Clear if too small (e.g., just a click)
            console.log('[HeatmapModal LOG] Drawing ended, too small, cleared.');
        } else if (currentDrawing) {
            console.log('[HeatmapModal LOG] Drawing ended. Final currentDrawing (normalized):', currentDrawing);
        }
    }, [isDrawing, currentDrawing, imageRenderedSize.width, imageRenderedSize.height]);

    useImperativeHandle(ref, () => ({
        handleGlobalMouseMove,
        handleGlobalMouseUp
    }));

    const handleSelectAreaFromList = (areaId) => {
        console.log('[HeatmapModal LOG] handleSelectAreaFromList clicked for areaId:', areaId);
        setSelectedAreaId(areaId);
        const area = areas.find(a => a.id === areaId);
        if (area) {
            setEditingAreaName(area.name);
            // When selecting, currentDrawing should reflect the selected area's dimensions for visual feedback
            setCurrentDrawing({ x: area.x, y: area.y, width: area.width, height: area.height });
            console.log('[HeatmapModal LOG] Area selected:', area);
        }
        setError('');
    };
    
    const handleSaveOrUpdateArea = () => {
        console.log('[HeatmapModal LOG] handleSaveOrUpdateArea button clicked.');
        if (!editingAreaName.trim()) {
            setError("Area name cannot be empty.");
            console.warn('[HeatmapModal LOG] Save/Update Area: Name empty.');
            return;
        }
        if (!currentDrawing || currentDrawing.width < (1/imageRenderedSize.width) || currentDrawing.height < (1/imageRenderedSize.height)) {
             // If selectedAreaId is valid, it means we are updating an existing area,
            // and its dimensions (loaded into currentDrawing upon selection) should be valid.
            // This check is more for a new drawing that is too small.
            if (!selectedAreaId) { // Only error out if it's a new drawing that's invalid
                setError("Please draw a valid area on the image.");
                console.warn('[HeatmapModal LOG] Save/Update Area: Drawing invalid or too small.');
                return;
            }
        }

        setError('');
        const areaData = {
            ...currentDrawing, // x, y, width, height (normalized)
            name: editingAreaName.trim(),
        };

        if (selectedAreaId) { // Update existing area
            console.log('[HeatmapModal LOG] Updating area:', selectedAreaId, areaData);
            setAreas(areas.map(a => a.id === selectedAreaId ? { ...a, ...areaData } : a));
        } else { // Save new area
            const newArea = { ...areaData, id: uuidv4() };
            console.log('[HeatmapModal LOG] Saving new area:', newArea);
            setAreas([...areas, newArea]);
            setSelectedAreaId(newArea.id); // Select the newly added area
        }
        // Consider clearing currentDrawing and editingAreaName or keeping them for further edits
        // For now, let's keep them to allow quick successive edits if needed, or user can click "Start New"
        // setCurrentDrawing(null); 
        // setEditingAreaName(''); 
    };

    const handleDeleteSelectedArea = () => {
        console.log('[HeatmapModal LOG] handleDeleteSelectedArea button clicked.');
        if (selectedAreaId) {
            console.log('[HeatmapModal LOG] Deleting area:', selectedAreaId);
            setAreas(areas.filter(a => a.id !== selectedAreaId));
            setSelectedAreaId(null);
            setEditingAreaName('');
            setCurrentDrawing(null); // Clear drawing when deleting
            setError('');
        } else {
            console.warn('[HeatmapModal LOG] Delete Area: No area selected.');
            setError("No area selected to delete.");
        }
    };

    const handleStartNewAreaDefinition = () => {
        console.log('[HeatmapModal LOG] handleStartNewAreaDefinition button clicked.');
        setSelectedAreaId(null);
        setEditingAreaName('');
        setCurrentDrawing(null); 
        setIsDrawingState(false); 
        setError('');
        console.log('[HeatmapModal LOG] State reset for new area definition.');
    };
    
    const handleMainSaveAllAreas = () => {
        console.log('[HeatmapModal LOG] handleMainSaveAllAreas button clicked.');
        const validAreas = areas.filter(area => area.name && area.name.trim() !== '' && area.width > 0 && area.height > 0); // Simplified valid check slightly

        if (validAreas.length !== areas.length) {
            const invalidCount = areas.length - validAreas.length;
            setError(`Cannot save: ${invalidCount} area(s) are unnamed or have zero/negative size. Please review defined areas.`);
            console.warn('[HeatmapModal LOG] Save All: Found invalid areas. All areas:', areas, 'Valid areas:', validAreas);
            // Optionally, offer to clean them or just prevent save
            // setAreas(validAreas); // Auto-remove invalid areas
            return;
        }
        setError('');
        console.log('[HeatmapModal LOG] Calling onSaveAreas with:', validAreas);
        onSaveAreas(validAreas); 
        onClose();
    };

    if (!isOpen) return null;

    const activeRectangleToDisplay = currentDrawing;
    const selectionBoxStyle = activeRectangleToDisplay && imageRenderedSize.width > 0 ? {
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
    // console.log('[HeatmapModal LOG] Rendering modal content. imageRenderedSize.width:', imageRenderedSize.width);

    return (
        <div className={`${styles.modalContent} ${styles.heatmapAreaModalContent}`}>
            <div className={styles.modalHeader}>
                <h3>Manage Heatmap Areas</h3>
                <button onClick={onClose} className={styles.modalCloseButton} title="Close">&times;</button>
            </div>
            <div className={`${styles.modalBody} ${styles.heatmapAreaModalBody}`}>
                <div className={styles.heatmapAreaListPanel}>
                    <h4>Defined Areas</h4>
                    {areas.length === 0 && <p className={styles.textMuted}>No areas defined yet.</p>}
                    <ul className={styles.heatmapDefinedAreasList}>
                        {areas.map(area => (
                            <li
                                key={area.id}
                                onClick={() => handleSelectAreaFromList(area.id)}
                                className={area.id === selectedAreaId ? styles.selectedAreaItem : ''}
                                title={`Name: ${area.name}\nX:${area.x.toFixed(3)}, Y:${area.y.toFixed(3)}, W:${area.width.toFixed(3)}, H:${area.height.toFixed(3)}`}
                            >
                                {area.name || "(Unnamed Area)"}
                            </li>
                        ))}
                    </ul>
                    <button 
                        type="button" 
                        onClick={handleDeleteSelectedArea} 
                        className="button button-danger button-small" 
                        disabled={!selectedAreaId} 
                        style={{ marginTop: '10px', width: '100%' }}
                    >
                        Delete Selected Area
                    </button>
                </div>

                <div className={styles.heatmapAreaDrawingPanel}>
                    <p className={styles.modalInstructions}>
                        To add/update: 1. Select existing or 'Start New'. 2. Draw on image. 3. Name it. 4. 'Save/Update Area'.
                    </p>
                    {error && <p className={styles.invalidFeedback} style={{display: 'block'}}>{error}</p>}
                    <div
                        ref={drawingCanvasRef}
                        className={styles.heatmapImageContainer}
                        onMouseDown={handleMouseDownOnCanvas}
                        title="Click and drag to draw an area"
                    >
                        <img
                            ref={imageRef}
                            src={imageUrl}
                            alt="Heatmap for area selection"
                            draggable="false"
                            className={styles.heatmapSelectableImage}
                            onLoad={() => { 
                                console.log("[HeatmapModal LOG] Inline img onLoad triggered on <img> tag.");
                                updateImageRenderedSize();
                            }}
                            onError={() => {
                                console.error("[HeatmapModal LOG] Image failed to load:", imageUrl);
                                setError("Failed to load heatmap image.");
                            }}
                        />
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

                    <div className={styles.heatmapAreaControls}>
                        <button type="button" onClick={handleStartNewAreaDefinition} className="button button-secondary">
                            Start New/Clear Drawing
                        </button>
                        <input
                            id="heatmapAreaNameInput"
                            type="text"
                            value={editingAreaName}
                            onChange={(e) => { setEditingAreaName(e.target.value); setError(''); }}
                            placeholder="Enter Area Name"
                            className={styles.formControl}
                        />
                        <button 
                            type="button" 
                            onClick={handleSaveOrUpdateArea} 
                            className="button button-primary" 
                            disabled={!editingAreaName.trim() || (!currentDrawing && !selectedAreaId) || (currentDrawing && (currentDrawing.width < (1/imageRenderedSize.width) || currentDrawing.height < (1/imageRenderedSize.height)))}
                        >
                            {selectedAreaId ? 'Update Area' : 'Save New Area'}
                        </button>
                    </div>
                    <div className={styles.heatmapCoordsDisplay}>
                        {currentDrawing ? 
                            `Current Drawing (Normalized): X: ${currentDrawing.x.toFixed(3)}, Y: ${currentDrawing.y.toFixed(3)}, W: ${currentDrawing.width.toFixed(3)}, H: ${currentDrawing.height.toFixed(3)}`
                            : "No active drawing."
                        }
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
// ----- END OF MODIFIED FILE (v2.5.2 - Added More Button Debug Logging) -----