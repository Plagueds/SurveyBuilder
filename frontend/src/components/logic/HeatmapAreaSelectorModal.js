// frontend/src/components/logic/HeatmapAreaSelectorModal.js
// ----- START OF MODIFIED FILE (v2.5.4 - Refined "too small" check and initial drawing state) -----
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
    const [imageRenderedData, setImageRenderedData] = useState({ width: 0, height: 0, naturalWidth: 0, naturalHeight: 0, top: 0, left: 0 }); // Renamed for clarity
    const [error, setError] = useState('');
    const [mouseMovedAfterDown, setMouseMovedAfterDown] = useState(false); // Track if mouse moved

    const imageRef = useRef(null);
    const drawingCanvasRef = useRef(null);

    console.log('[HeatmapModal LOG v2.5.4] Render. isOpen:', isOpen, 'isDrawing:', isDrawing, 'currentDrawing:', currentDrawing, 'imageRenderedData:', imageRenderedData);

    useEffect(() => {
        if (typeof onDrawingStateChange === 'function') {
            onDrawingStateChange(isDrawing);
        }
    }, [isDrawing, onDrawingStateChange]);

    useEffect(() => {
        console.log('[HeatmapModal LOG v2.5.4] useEffect for isOpen/initialAreas. isOpen:', isOpen);
        if (isOpen) {
            const processedAreas = initialAreas.map(area => ({ ...area, id: area.id || uuidv4() }));
            setAreas(processedAreas);
            setSelectedAreaId(null);
            setEditingAreaName('');
            setCurrentDrawing(null);
            setError('');
            setIsDrawingState(false); 
            setMouseMovedAfterDown(false);
            // Reset image data, will be recalculated by updateImageRenderedData
            setImageRenderedData({ width: 0, height: 0, naturalWidth: 0, naturalHeight: 0, top: 0, left: 0 });
            console.log('[HeatmapModal LOG v2.5.4] Modal opened, state reset. Initial areas:', processedAreas.length);
        }
    }, [initialAreas, isOpen]);

    const updateImageRenderedData = useCallback(() => {
        console.log('[HeatmapModal LOG v2.5.4] updateImageRenderedData called.');
        if (imageRef.current && imageRef.current.complete && imageRef.current.naturalWidth > 0) {
            const imgElement = imageRef.current;
            const containerElement = drawingCanvasRef.current;
            
            if (!containerElement) {
                console.warn('[HeatmapModal LOG v2.5.4] updateImageRenderedData: drawingCanvasRef.current is null.');
                // Schedule a retry if container isn't available yet, might happen on initial fast render
                // setTimeout(updateImageRenderedData, 50); // Optional: retry
                return;
            }

            const containerRect = containerElement.getBoundingClientRect();
            const imgRect = imgElement.getBoundingClientRect();

            const newData = {
                width: imgElement.offsetWidth,
                height: imgElement.offsetHeight,
                naturalWidth: imgElement.naturalWidth,
                naturalHeight: imgElement.naturalHeight,
                top: imgRect.top - containerRect.top,
                left: imgRect.left - containerRect.left,
            };
            console.log('[HeatmapModal LOG v2.5.4] Image ready, new calculated data:', newData);
            if (newData.width > 0 && newData.height > 0) {
                setImageRenderedData(newData);
            } else {
                console.warn('[HeatmapModal LOG v2.5.4] updateImageRenderedData: Calculated newData has zero width or height.', newData);
            }
        } else if (imageRef.current) {
            console.warn('[HeatmapModal LOG v2.5.4] updateImageRenderedData: Image ref exists but not ready. Complete:', imageRef.current.complete, 'NaturalW:', imageRef.current.naturalWidth);
        } else {
            console.warn('[HeatmapModal LOG v2.5.4] updateImageRenderedData: imageRef.current is null.');
        }
    }, []); // No dependencies that change frequently

    useEffect(() => {
        const imgElement = imageRef.current;
        const handleLoad = () => {
            console.log("[HeatmapModal LOG v2.5.4] Image 'load' event fired.");
            updateImageRenderedData();
        };
        console.log('[HeatmapModal LOG v2.5.4] useEffect for image loading. isOpen:', isOpen);

        if (isOpen && imgElement) {
            console.log('[HeatmapModal LOG v2.5.4] Image effect: imgElement exists. Complete:', imgElement.complete, 'NaturalW:', imgElement.naturalWidth, 'OffsetW:', imgElement.offsetWidth);
            if (imgElement.complete && imgElement.naturalWidth > 0 && imgElement.offsetWidth > 0) {
                console.log('[HeatmapModal LOG v2.5.4] Image already complete, calling updateImageRenderedData.');
                updateImageRenderedData();
            } else {
                console.log('[HeatmapModal LOG v2.5.4] Image not complete/rendered, adding "load" listener.');
                imgElement.addEventListener('load', handleLoad);
            }
            window.addEventListener('resize', updateImageRenderedData);
        }
        return () => {
            if (imgElement) imgElement.removeEventListener('load', handleLoad);
            window.removeEventListener('resize', updateImageRenderedData);
            console.log('[HeatmapModal LOG v2.5.4] Image effect cleanup.');
        };
    }, [isOpen, updateImageRenderedData]);

    const getMousePositionOnImageElement = useCallback((event) => {
        if (!imageRef.current || !drawingCanvasRef.current || imageRenderedData.width === 0 || imageRenderedData.height === 0) {
            console.warn("[HeatmapModal LOG v2.5.4] getMousePosition: image/container ref not ready or imageRenderedData invalid.", {imgRef: !!imageRef.current, canvasRef: !!drawingCanvasRef.current, imgW: imageRenderedData.width, imgH: imageRenderedData.height});
            return { x: 0, y: 0, valid: false };
        }
        const containerRect = drawingCanvasRef.current.getBoundingClientRect();
        const clientX = event.clientX;
        const clientY = event.clientY;
        let xRelativeToContainer = clientX - containerRect.left;
        let yRelativeToContainer = clientY - containerRect.top;
        let x = xRelativeToContainer - imageRenderedData.left;
        let y = yRelativeToContainer - imageRenderedData.top;
        
        const isValidClickOnImage = 
            xRelativeToContainer >= imageRenderedData.left &&
            xRelativeToContainer <= imageRenderedData.left + imageRenderedData.width &&
            yRelativeToContainer >= imageRenderedData.top &&
            yRelativeToContainer <= imageRenderedData.top + imageRenderedData.height;

        // Clamp x and y to be within the image's own 0-width/0-height coordinate system
        x = Math.max(0, Math.min(x, imageRenderedData.width));
        y = Math.max(0, Math.min(y, imageRenderedData.height));

        // console.logSilly?.('[HeatmapModal LOG v2.5.4] Mouse Pos on Image Element:', { imgRelX: x, imgRelY: y, isValidClick: isValidClickOnImage });
        return { x, y, valid: isValidClickOnImage };
    }, [imageRenderedData]);

    const handleMouseDownOnCanvas = (event) => {
        console.log('[HeatmapModal LOG v2.5.4] handleMouseDownOnCanvas triggered.');
        if (event.button !== 0 || !imageRenderedData.width || !imageRenderedData.height) {
            console.warn('[HeatmapModal LOG v2.5.4] MouseDown prevented: Not left click or imageRenderedData invalid.');
            return;
        }
        const pos = getMousePositionOnImageElement(event);
        if (!pos.valid) {
            console.warn("[HeatmapModal LOG v2.5.4] Mouse down was outside the actual image element. Ignoring.");
            setIsDrawingState(false); setCurrentDrawing(null);
            return;
        }
        event.preventDefault(); event.stopPropagation();

        setIsDrawingState(true);
        setMouseMovedAfterDown(false); // Reset mouse move tracker
        setStartPoint({ x: pos.x, y: pos.y });
        // Set initial drawing with zero width/height, it will expand on mouse move
        setCurrentDrawing({
            x: pos.x / imageRenderedData.width,
            y: pos.y / imageRenderedData.height,
            width: 0, // Width and height are 0 initially
            height: 0
        });
        setError('');
        console.log('[HeatmapModal LOG v2.5.4] Drawing started. StartPoint (pixels on image):', {x: pos.x, y: pos.y}, 'Initial CurrentDrawing (normalized):', {x: pos.x / imageRenderedData.width, y: pos.y / imageRenderedData.height, w:0, h:0});
    };

    const handleGlobalMouseMove = useCallback((event) => {
        if (!isDrawing || !imageRenderedData.width || !imageRenderedData.height) return;
        
        setMouseMovedAfterDown(true); // Mouse has moved
        const currentPos = getMousePositionOnImageElement(event);
        const rectXpixels = Math.min(startPoint.x, currentPos.x);
        const rectYpixels = Math.min(startPoint.y, currentPos.y);
        const rectWidthPixels = Math.abs(currentPos.x - startPoint.x);
        const rectHeightPixels = Math.abs(currentPos.y - startPoint.y);

        setCurrentDrawing({
            x: rectXpixels / imageRenderedData.width,
            y: rectYpixels / imageRenderedData.height,
            width: rectWidthPixels / imageRenderedData.width,
            height: rectHeightPixels / imageRenderedData.height
        });
    }, [isDrawing, imageRenderedData, startPoint, getMousePositionOnImageElement]);

    const handleGlobalMouseUp = useCallback(() => {
        if (!isDrawing) return;
        console.log('[HeatmapModal LOG v2.5.4] handleGlobalMouseUp. MouseMoved:', mouseMovedAfterDown, 'CurrentDrawing before check:', JSON.stringify(currentDrawing));
        setIsDrawingState(false);
        
        const minPixelDimension = 1; // Require at least 1x1 pixel drawing
        let drawingIsValid = false;

        if (currentDrawing && imageRenderedData.width > 0 && imageRenderedData.height > 0) {
            const drawnWidthInPixels = currentDrawing.width * imageRenderedData.width;
            const drawnHeightInPixels = currentDrawing.height * imageRenderedData.height;
            
            console.log('[HeatmapModal LOG v2.5.4] MouseUp: Drawn pixels W:', drawnWidthInPixels, 'H:', drawnHeightInPixels);

            if (drawnWidthInPixels >= minPixelDimension && drawnHeightInPixels >= minPixelDimension) {
                drawingIsValid = true;
            }
        }

        if (!mouseMovedAfterDown || !drawingIsValid) { // If it was just a click or drawing is too small
            setCurrentDrawing(null); 
            console.log('[HeatmapModal LOG v2.5.4] Drawing ended. Cleared (was click or too small). Valid:', drawingIsValid, 'Moved:', mouseMovedAfterDown);
        } else {
            console.log('[HeatmapModal LOG v2.5.4] Drawing ended. Final currentDrawing (normalized):', JSON.stringify(currentDrawing));
        }
        setMouseMovedAfterDown(false); // Reset for next drawing
    }, [isDrawing, currentDrawing, imageRenderedData, mouseMovedAfterDown]);

    useImperativeHandle(ref, () => ({ handleGlobalMouseMove, handleGlobalMouseUp }));

    const handleSelectAreaFromList = (areaId) => { /* ... unchanged ... */
        console.log('[HeatmapModal LOG v2.5.4] handleSelectAreaFromList clicked for areaId:', areaId);
        setSelectedAreaId(areaId);
        const area = areas.find(a => a.id === areaId);
        if (area) {
            setEditingAreaName(area.name);
            setCurrentDrawing({ x: area.x, y: area.y, width: area.width, height: area.height });
            console.log('[HeatmapModal LOG v2.5.4] Area selected:', area);
        }
        setError('');
    };
    
    const handleSaveOrUpdateArea = () => { /* ... mostly unchanged, ensure check uses imageRenderedData ... */
        console.log('[HeatmapModal LOG v2.5.4] handleSaveOrUpdateArea button clicked.');
        if (!editingAreaName.trim()) {
            setError("Area name cannot be empty."); return;
        }
        const minPixelDimension = 1;
        if (!currentDrawing || 
            (imageRenderedData.width > 0 && currentDrawing.width * imageRenderedData.width < minPixelDimension) || 
            (imageRenderedData.height > 0 && currentDrawing.height * imageRenderedData.height < minPixelDimension)) {
            if (!selectedAreaId) { 
                setError("Please draw a valid area (at least 1x1 pixel) on the image."); return;
            }
        }
        setError('');
        const areaData = { ...currentDrawing, name: editingAreaName.trim() };
        if (selectedAreaId) { 
            setAreas(areas.map(a => a.id === selectedAreaId ? { ...a, ...areaData } : a));
        } else { 
            const newArea = { ...areaData, id: uuidv4() };
            setAreas([...areas, newArea]); setSelectedAreaId(newArea.id); 
        }
        console.log(selectedAreaId ? '[HeatmapModal LOG v2.5.4] Updated area:' : '[HeatmapModal LOG v2.5.4] Saved new area:', areaData);
    };

    const handleDeleteSelectedArea = () => { /* ... unchanged ... */
        console.log('[HeatmapModal LOG v2.5.4] handleDeleteSelectedArea button clicked.');
        if (selectedAreaId) {
            setAreas(areas.filter(a => a.id !== selectedAreaId));
            setSelectedAreaId(null); setEditingAreaName(''); setCurrentDrawing(null); setError('');
            console.log('[HeatmapModal LOG v2.5.4] Deleted area:', selectedAreaId);
        } else {
            setError("No area selected to delete.");
        }
    };

    const handleStartNewAreaDefinition = () => { /* ... unchanged ... */
        console.log('[HeatmapModal LOG v2.5.4] handleStartNewAreaDefinition button clicked.');
        setSelectedAreaId(null); setEditingAreaName(''); setCurrentDrawing(null); 
        setIsDrawingState(false); setMouseMovedAfterDown(false); setError('');
        console.log('[HeatmapModal LOG v2.5.4] State reset for new area definition.');
    };
    
    const handleMainSaveAllAreas = () => { /* ... mostly unchanged, ensure check uses imageRenderedData ... */
        console.log('[HeatmapModal LOG v2.5.4] handleMainSaveAllAreas button clicked.');
        const minPixelDimension = 1;
        const validAreas = areas.filter(area => 
            area.name && area.name.trim() !== '' &&
            (imageRenderedData.width > 0 && area.width * imageRenderedData.width >= minPixelDimension) && 
            (imageRenderedData.height > 0 && area.height * imageRenderedData.height >= minPixelDimension)
        );
        if (validAreas.length !== areas.length) {
            setError(`Cannot save: ${areas.length - validAreas.length} area(s) are unnamed or too small.`); return;
        }
        setError('');
        console.log('[HeatmapModal LOG v2.5.4] Calling onSaveAreas with:', validAreas);
        onSaveAreas(validAreas); 
        onClose();
    };

    if (!isOpen) return null;

    const activeRectangleToDisplay = currentDrawing;
    const selectionBoxStyle = activeRectangleToDisplay && imageRenderedData.width > 0 ? {
        position: 'absolute',
        left: `${imageRenderedData.left + activeRectangleToDisplay.x * imageRenderedData.width}px`,
        top: `${imageRenderedData.top + activeRectangleToDisplay.y * imageRenderedData.height}px`,
        width: `${activeRectangleToDisplay.width * imageRenderedData.width}px`,
        height: `${activeRectangleToDisplay.height * imageRenderedData.height}px`,
        border: '2px dashed var(--primary-color, red)',
        backgroundColor: 'var(--primary-color-alpha, rgba(255, 0, 0, 0.2))',
        boxSizing: 'border-box', pointerEvents: 'none', zIndex: 10,
    } : { display: 'none' };
    
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
                            <li key={area.id} onClick={() => handleSelectAreaFromList(area.id)}
                                className={area.id === selectedAreaId ? styles.selectedAreaItem : ''}
                                title={`Name: ${area.name}\nX:${area.x.toFixed(3)}, Y:${area.y.toFixed(3)}, W:${area.width.toFixed(3)}, H:${area.height.toFixed(3)}`}>
                                {area.name || "(Unnamed Area)"}
                            </li>
                        ))}
                    </ul>
                    <button type="button" onClick={handleDeleteSelectedArea} className="button button-danger button-small" 
                        disabled={!selectedAreaId} style={{ marginTop: '10px', width: '100%' }}>
                        Delete Selected Area
                    </button>
                </div>
                <div className={styles.heatmapAreaDrawingPanel}>
                    <p className={styles.modalInstructions}>
                        To add/update: 1. Select existing or 'Start New'. 2. Draw on image. 3. Name it. 4. 'Save/Update Area'.
                    </p>
                    {error && <p className={styles.invalidFeedback} style={{display: 'block'}}>{error}</p>}
                    <div ref={drawingCanvasRef} className={styles.heatmapImageContainer}
                        onMouseDown={handleMouseDownOnCanvas} title="Click and drag on the image to draw an area">
                        <img ref={imageRef} src={imageUrl} alt="Heatmap for area selection" draggable="false"
                            className={styles.heatmapSelectableImage}
                            onLoad={() => { 
                                console.log("[HeatmapModal LOG v2.5.4] Inline img onLoad triggered.");
                                updateImageRenderedData(); // Ensure this is called
                            }}
                            onError={() => { setError("Failed to load heatmap image."); }} />
                        {imageRenderedData.width > 0 && areas.map(area => (
                            <div key={`display-${area.id}`} style={{
                                position: 'absolute',
                                left: `${imageRenderedData.left + (area.x * imageRenderedData.width)}px`,
                                top: `${imageRenderedData.top + (area.y * imageRenderedData.height)}px`,
                                width: `${area.width * imageRenderedData.width}px`,
                                height: `${area.height * imageRenderedData.height}px`,
                                border: `1px solid ${area.id === selectedAreaId ? 'var(--primary-color, blue)' : 'rgba(0,0,255,0.3)'}`,
                                backgroundColor: area.id === selectedAreaId ? 'rgba(0,0,255,0.15)' : 'rgba(0,0,255,0.05)',
                                pointerEvents: 'none', boxSizing: 'border-box',
                                zIndex: area.id === selectedAreaId ? 2 : 1,
                            }}><span className={styles.heatmapAreaLabelOnImage}>{area.name}</span></div>
                        ))}
                        {imageRenderedData.width > 0 && <div style={selectionBoxStyle}></div>}
                        {imageRenderedData.width === 0 && imageUrl && <p className={styles.textMuted}>Loading image...</p>}
                    </div>
                    <div className={styles.heatmapAreaControls}>
                        <button type="button" onClick={handleStartNewAreaDefinition} className="button button-secondary">
                            Start New/Clear Drawing
                        </button>
                        <input id="heatmapAreaNameInput" type="text" value={editingAreaName}
                            onChange={(e) => { setEditingAreaName(e.target.value); setError(''); }}
                            placeholder="Enter Area Name" className={styles.formControl} />
                        <button type="button" onClick={handleSaveOrUpdateArea} className="button button-primary" 
                            disabled={
                                !editingAreaName.trim() || 
                                (!currentDrawing && !selectedAreaId) || 
                                (currentDrawing && imageRenderedData.width > 0 &&
                                    (currentDrawing.width * imageRenderedData.width < 1 || currentDrawing.height * imageRenderedData.height < 1)
                                )
                            }>
                            {selectedAreaId ? 'Update Area' : 'Save New Area'}
                        </button>
                    </div>
                    <div className={styles.heatmapCoordsDisplay}>
                        {currentDrawing ? 
                            `Drawing: X:${currentDrawing.x.toFixed(3)}, Y:${currentDrawing.y.toFixed(3)}, W:${currentDrawing.width.toFixed(3)}, H:${currentDrawing.height.toFixed(3)}`
                            : "No active drawing."}
                         | ImgData: W:{imageRenderedData.width} H:{imageRenderedData.height} L:{imageRenderedData.left.toFixed(1)} T:{imageRenderedData.top.toFixed(1)}
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
// ----- END OF MODIFIED FILE (v2.5.4) -----