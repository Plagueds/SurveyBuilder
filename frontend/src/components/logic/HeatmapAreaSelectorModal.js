// frontend/src/components/logic/HeatmapAreaSelectorModal.js
// ----- START OF MODIFIED FILE (v2.5.5 - Internalize mousemove, refine mouseup) -----
import React, { useState, useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import { v4 as uuidv4 } from 'uuid';

const HeatmapAreaSelectorModal = forwardRef(({
    isOpen,
    onClose,
    onSaveAreas,
    imageUrl,
    initialAreas = [],
    styles, 
    onDrawingStateChange // This prop is for SurveyBuildPage to know about drawing state
}, ref) => {
    const [areas, setAreas] = useState([]);
    const [selectedAreaId, setSelectedAreaId] = useState(null);
    const [editingAreaName, setEditingAreaName] = useState('');
    const [currentDrawing, setCurrentDrawing] = useState(null);
    const [isDrawingInternal, setIsDrawingInternal] = useState(false); // Internal drawing state
    const [startPoint, setStartPoint] = useState({ x: 0, y: 0 });
    const [imageRenderedData, setImageRenderedData] = useState({ width: 0, height: 0, naturalWidth: 0, naturalHeight: 0, top: 0, left: 0 });
    const [error, setError] = useState('');
    const [mouseMovedAfterDown, setMouseMovedAfterDown] = useState(false);

    const imageRef = useRef(null);
    const drawingCanvasRef = useRef(null); // This is the container (grey box)

    // Effect to call the prop when internal drawing state changes
    useEffect(() => {
        if (typeof onDrawingStateChange === 'function') {
            onDrawingStateChange(isDrawingInternal);
        }
    }, [isDrawingInternal, onDrawingStateChange]);

    console.log('[HeatmapModal LOG v2.5.5] Render. isOpen:', isOpen, 'isDrawingInternal:', isDrawingInternal, 'currentDrawing:', currentDrawing, 'imageRenderedData:', imageRenderedData);

    useEffect(() => {
        console.log('[HeatmapModal LOG v2.5.5] useEffect for isOpen/initialAreas. isOpen:', isOpen);
        if (isOpen) {
            const processedAreas = initialAreas.map(area => ({ ...area, id: area.id || uuidv4() }));
            setAreas(processedAreas);
            setSelectedAreaId(null);
            setEditingAreaName('');
            setCurrentDrawing(null);
            setError('');
            setIsDrawingInternal(false); 
            setMouseMovedAfterDown(false);
            setImageRenderedData({ width: 0, height: 0, naturalWidth: 0, naturalHeight: 0, top: 0, left: 0 });
            console.log('[HeatmapModal LOG v2.5.5] Modal opened, state reset. Initial areas:', processedAreas.length);
        } else {
             // Ensure drawing is stopped if modal is closed externally while drawing
            if (isDrawingInternal) {
                setIsDrawingInternal(false);
            }
        }
    }, [initialAreas, isOpen]); // Removed isDrawingInternal from deps here as it caused loops

    const updateImageRenderedData = useCallback(() => {
        // ... (same as v2.5.4)
        console.log('[HeatmapModal LOG v2.5.5] updateImageRenderedData called.');
        if (imageRef.current && imageRef.current.complete && imageRef.current.naturalWidth > 0) {
            const imgElement = imageRef.current;
            const containerElement = drawingCanvasRef.current;
            if (!containerElement) {
                console.warn('[HeatmapModal LOG v2.5.5] updateImageRenderedData: drawingCanvasRef.current is null.');
                return;
            }
            const containerRect = containerElement.getBoundingClientRect();
            const imgRect = imgElement.getBoundingClientRect();
            const newData = {
                width: imgElement.offsetWidth, height: imgElement.offsetHeight,
                naturalWidth: imgElement.naturalWidth, naturalHeight: imgElement.naturalHeight,
                top: imgRect.top - containerRect.top, left: imgRect.left - containerRect.left,
            };
            console.log('[HeatmapModal LOG v2.5.5] Image ready, new calculated data:', newData);
            if (newData.width > 0 && newData.height > 0) setImageRenderedData(newData);
            else console.warn('[HeatmapModal LOG v2.5.5] updateImageRenderedData: Calculated newData has zero width or height.', newData);
        } else if (imageRef.current) console.warn('[HeatmapModal LOG v2.5.5] updateImageRenderedData: Image ref exists but not ready.');
        else console.warn('[HeatmapModal LOG v2.5.5] updateImageRenderedData: imageRef.current is null.');
    }, []);

    useEffect(() => {
        // ... (same as v2.5.4, uses updateImageRenderedData)
        const imgElement = imageRef.current;
        const handleLoad = () => { console.log("[HeatmapModal LOG v2.5.5] Image 'load' event fired."); updateImageRenderedData(); };
        if (isOpen && imgElement) {
            if (imgElement.complete && imgElement.naturalWidth > 0 && imgElement.offsetWidth > 0) updateImageRenderedData();
            else imgElement.addEventListener('load', handleLoad);
            window.addEventListener('resize', updateImageRenderedData);
        }
        return () => {
            if (imgElement) imgElement.removeEventListener('load', handleLoad);
            window.removeEventListener('resize', updateImageRenderedData);
        };
    }, [isOpen, updateImageRenderedData]);

    const getMousePositionOnImageElement = useCallback((event) => {
        // ... (same as v2.5.4, uses imageRenderedData)
        if (!imageRef.current || !drawingCanvasRef.current || imageRenderedData.width === 0 || imageRenderedData.height === 0) {
            return { x: 0, y: 0, valid: false };
        }
        const containerRect = drawingCanvasRef.current.getBoundingClientRect();
        const clientX = event.clientX; const clientY = event.clientY;
        let xRelativeToContainer = clientX - containerRect.left;
        let yRelativeToContainer = clientY - containerRect.top;
        let x = xRelativeToContainer - imageRenderedData.left;
        let y = yRelativeToContainer - imageRenderedData.top;
        const isValidClickOnImage = xRelativeToContainer >= imageRenderedData.left && xRelativeToContainer <= imageRenderedData.left + imageRenderedData.width && yRelativeToContainer >= imageRenderedData.top && yRelativeToContainer <= imageRenderedData.top + imageRenderedData.height;
        x = Math.max(0, Math.min(x, imageRenderedData.width));
        y = Math.max(0, Math.min(y, imageRenderedData.height));
        return { x, y, valid: isValidClickOnImage };
    }, [imageRenderedData]);

    const handleMouseDownOnCanvas = (event) => {
        // ... (same as v2.5.4, but sets isDrawingInternal)
        console.log('[HeatmapModal LOG v2.5.5] handleMouseDownOnCanvas triggered.');
        if (event.button !== 0 || !imageRenderedData.width || !imageRenderedData.height) return;
        const pos = getMousePositionOnImageElement(event);
        if (!pos.valid) { console.warn("[HeatmapModal LOG v2.5.5] Mouse down was outside image. Ignoring."); return; }
        event.preventDefault(); event.stopPropagation();
        setIsDrawingInternal(true); // Use internal state
        setMouseMovedAfterDown(false);
        setStartPoint({ x: pos.x, y: pos.y });
        setCurrentDrawing({ x: pos.x / imageRenderedData.width, y: pos.y / imageRenderedData.height, width: 0, height: 0 });
        setError('');
        console.log('[HeatmapModal LOG v2.5.5] Drawing started. Start (pixels on image):', {x: pos.x, y: pos.y});
    };

    // MODIFIED: handleGlobalMouseMove is now internal to the component
    const handleMouseMoveInternal = useCallback((event) => {
        // No need to check isDrawingInternal here, as listener is added/removed based on it
        if (!imageRenderedData.width || !imageRenderedData.height) return;
        
        console.log('[HeatmapModal LOG v2.5.5] handleMouseMoveInternal triggered.'); // New log
        setMouseMovedAfterDown(true);
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
    }, [imageRenderedData, startPoint, getMousePositionOnImageElement]); // isDrawingInternal not needed as dependency due to listener management

    // MODIFIED: handleGlobalMouseUp is now internal
    const handleMouseUpInternal = useCallback(() => {
        // No need to check isDrawingInternal here, as listener is added/removed based on it
        console.log('[HeatmapModal LOG v2.5.5] handleMouseUpInternal. MouseMoved:', mouseMovedAfterDown, 'CurrentDrawing before check:', JSON.stringify(currentDrawing));
        setIsDrawingInternal(false); // Stop drawing FIRST
        
        const minPixelDimension = 1;
        let drawingIsValid = false;
        if (currentDrawing && imageRenderedData.width > 0 && imageRenderedData.height > 0) {
            const drawnWidthInPixels = currentDrawing.width * imageRenderedData.width;
            const drawnHeightInPixels = currentDrawing.height * imageRenderedData.height;
            console.log('[HeatmapModal LOG v2.5.5] MouseUp: Drawn pixels W:', drawnWidthInPixels, 'H:', drawnHeightInPixels);
            if (drawnWidthInPixels >= minPixelDimension && drawnHeightInPixels >= minPixelDimension) {
                drawingIsValid = true;
            }
        }

        if (!mouseMovedAfterDown || !drawingIsValid) {
            setCurrentDrawing(null); 
            console.log('[HeatmapModal LOG v2.5.5] Drawing cleared (was click or too small). Valid:', drawingIsValid, 'Moved:', mouseMovedAfterDown);
        } else {
            console.log('[HeatmapModal LOG v2.5.5] Drawing ended. Final currentDrawing:', JSON.stringify(currentDrawing));
        }
        // setMouseMovedAfterDown(false); // Resetting this in setIsDrawingInternal effect or mousedown
    }, [currentDrawing, imageRenderedData, mouseMovedAfterDown]);


    // Effect to manage global mouse listeners based on isDrawingInternal
    useEffect(() => {
        if (isDrawingInternal) {
            console.log('[HeatmapModal LOG v2.5.5] Adding internal mousemove/mouseup listeners.');
            window.addEventListener('mousemove', handleMouseMoveInternal);
            window.addEventListener('mouseup', handleMouseUpInternal);
            setMouseMovedAfterDown(false); // Reset here when drawing starts
        } else {
            console.log('[HeatmapModal LOG v2.5.5] Removing internal mousemove/mouseup listeners.');
            window.removeEventListener('mousemove', handleMouseMoveInternal);
            window.removeEventListener('mouseup', handleMouseUpInternal);
        }
        return () => {
            console.log('[HeatmapModal LOG v2.5.5] Cleanup: Removing internal mousemove/mouseup listeners.');
            window.removeEventListener('mousemove', handleMouseMoveInternal);
            window.removeEventListener('mouseup', handleMouseUpInternal);
        };
    }, [isDrawingInternal, handleMouseMoveInternal, handleMouseUpInternal]);

    // useImperativeHandle is no longer needed to expose these mouse handlers
    // If SurveyBuildPage needs to trigger something on the modal, other methods can be exposed.
    // For now, we remove it to simplify, as drawing is self-contained.
    useImperativeHandle(ref, () => ({
        // expose other methods if needed by parent, e.g., a method to manually clear drawing
    }));

    const handleSelectAreaFromList = (areaId) => { /* ... unchanged from v2.5.4 ... */
        console.log('[HeatmapModal LOG v2.5.5] handleSelectAreaFromList clicked for areaId:', areaId);
        setSelectedAreaId(areaId);
        const area = areas.find(a => a.id === areaId);
        if (area) {
            setEditingAreaName(area.name);
            setCurrentDrawing({ x: area.x, y: area.y, width: area.width, height: area.height });
        }
        setError('');
    };
    
    const handleSaveOrUpdateArea = () => { /* ... unchanged from v2.5.4, uses imageRenderedData ... */
        console.log('[HeatmapModal LOG v2.5.5] handleSaveOrUpdateArea button clicked.');
        if (!editingAreaName.trim()) { setError("Area name cannot be empty."); return; }
        const minPixelDimension = 1;
        if (!currentDrawing || (imageRenderedData.width > 0 && currentDrawing.width * imageRenderedData.width < minPixelDimension) || (imageRenderedData.height > 0 && currentDrawing.height * imageRenderedData.height < minPixelDimension)) {
            if (!selectedAreaId) { setError("Please draw a valid area (at least 1x1 pixel) on the image."); return; }
        }
        setError('');
        const areaData = { ...currentDrawing, name: editingAreaName.trim() };
        if (selectedAreaId) { setAreas(areas.map(a => a.id === selectedAreaId ? { ...a, ...areaData } : a));
        } else { const newArea = { ...areaData, id: uuidv4() }; setAreas([...areas, newArea]); setSelectedAreaId(newArea.id); }
    };

    const handleDeleteSelectedArea = () => { /* ... unchanged from v2.5.4 ... */
        console.log('[HeatmapModal LOG v2.5.5] handleDeleteSelectedArea button clicked.');
        if (selectedAreaId) {
            setAreas(areas.filter(a => a.id !== selectedAreaId));
            setSelectedAreaId(null); setEditingAreaName(''); setCurrentDrawing(null); setError('');
        } else { setError("No area selected to delete."); }
    };

    const handleStartNewAreaDefinition = () => { /* ... unchanged from v2.5.4 ... */
        console.log('[HeatmapModal LOG v2.5.5] handleStartNewAreaDefinition button clicked.');
        setSelectedAreaId(null); setEditingAreaName(''); setCurrentDrawing(null); 
        setIsDrawingInternal(false); setMouseMovedAfterDown(false); setError('');
    };
    
    const handleMainSaveAllAreas = () => { /* ... unchanged from v2.5.4, uses imageRenderedData ... */
        console.log('[HeatmapModal LOG v2.5.5] handleMainSaveAllAreas button clicked.');
        const minPixelDimension = 1;
        const validAreas = areas.filter(area => area.name && area.name.trim() !== '' && (imageRenderedData.width > 0 && area.width * imageRenderedData.width >= minPixelDimension) && (imageRenderedData.height > 0 && area.height * imageRenderedData.height >= minPixelDimension));
        if (validAreas.length !== areas.length) { setError(`Cannot save: ${areas.length - validAreas.length} area(s) are unnamed or too small.`); return; }
        setError(''); onSaveAreas(validAreas); onClose();
    };

    if (!isOpen) return null;
    // ... (JSX is the same as v2.5.4, ensure it uses imageRenderedData and currentDrawing correctly)
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
                                console.log("[HeatmapModal LOG v2.5.5] Inline img onLoad triggered.");
                                updateImageRenderedData();
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
// ----- END OF MODIFIED FILE (v2.5.5) -----