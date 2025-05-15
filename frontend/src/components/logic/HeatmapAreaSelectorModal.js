// frontend/src/components/logic/HeatmapAreaSelectorModal.js
// ----- START OF MODIFIED FILE (v2.5.6 - Stabilize callbacks, use ref for mouseMoved) -----
import React, { useState, useEffect, useRef, useCallback } from 'react'; // Removed forwardRef, useImperativeHandle for now
import { v4 as uuidv4 } from 'uuid';

const HeatmapAreaSelectorModal = ({ // Removed forwardRef for now
    isOpen,
    onClose,
    onSaveAreas,
    imageUrl,
    initialAreas = [],
    styles, 
    onDrawingStateChange
}) => {
    const [areas, setAreas] = useState([]);
    const [selectedAreaId, setSelectedAreaId] = useState(null);
    const [editingAreaName, setEditingAreaName] = useState('');
    const [currentDrawing, setCurrentDrawing] = useState(null);
    const [isDrawingInternal, setIsDrawingInternal] = useState(false);
    const [startPoint, setStartPoint] = useState({ x: 0, y: 0 });
    const [imageRenderedData, setImageRenderedData] = useState({ width: 0, height: 0, naturalWidth: 0, naturalHeight: 0, top: 0, left: 0 });
    const [error, setError] = useState('');
    
    // Use a ref for mouseMovedAfterDown to avoid stale closures in callbacks
    const mouseMovedAfterDownRef = useRef(false);

    const imageRef = useRef(null);
    const drawingCanvasRef = useRef(null);

    useEffect(() => {
        if (typeof onDrawingStateChange === 'function') {
            onDrawingStateChange(isDrawingInternal);
        }
    }, [isDrawingInternal, onDrawingStateChange]);

    console.log('[HeatmapModal LOG v2.5.6] Render. isOpen:', isOpen, 'isDrawingInternal:', isDrawingInternal, 'currentDrawing:', currentDrawing);

    useEffect(() => {
        console.log('[HeatmapModal LOG v2.5.6] useEffect for isOpen/initialAreas. isOpen:', isOpen);
        if (isOpen) {
            const processedAreas = initialAreas.map(area => ({ ...area, id: area.id || uuidv4() }));
            setAreas(processedAreas);
            setSelectedAreaId(null);
            setEditingAreaName('');
            setCurrentDrawing(null);
            setError('');
            setIsDrawingInternal(false); 
            mouseMovedAfterDownRef.current = false; // Reset ref
            setImageRenderedData({ width: 0, height: 0, naturalWidth: 0, naturalHeight: 0, top: 0, left: 0 });
            console.log('[HeatmapModal LOG v2.5.6] Modal opened, state reset.');
        } else {
            if (isDrawingInternal) setIsDrawingInternal(false);
        }
    }, [initialAreas, isOpen]);

    const updateImageRenderedData = useCallback(() => {
        console.log('[HeatmapModal LOG v2.5.6] updateImageRenderedData called.');
        if (imageRef.current && imageRef.current.complete && imageRef.current.naturalWidth > 0) {
            const imgElement = imageRef.current;
            const containerElement = drawingCanvasRef.current;
            if (!containerElement) {
                console.warn('[HeatmapModal LOG v2.5.6] updateImageRenderedData: drawingCanvasRef is null.');
                return;
            }
            const containerRect = containerElement.getBoundingClientRect();
            const imgRect = imgElement.getBoundingClientRect();
            const newData = {
                width: imgElement.offsetWidth, height: imgElement.offsetHeight,
                naturalWidth: imgElement.naturalWidth, naturalHeight: imgElement.naturalHeight,
                top: imgRect.top - containerRect.top, left: imgRect.left - containerRect.left,
            };
            console.log('[HeatmapModal LOG v2.5.6] Image ready, new data:', newData);
            if (newData.width > 0 && newData.height > 0) setImageRenderedData(newData);
            else console.warn('[HeatmapModal LOG v2.5.6] updateImageRenderedData: Zero width/height.', newData);
        } else if (imageRef.current) console.warn('[HeatmapModal LOG v2.5.6] Image ref exists but not ready.');
        else console.warn('[HeatmapModal LOG v2.5.6] imageRef is null.');
    }, []);

    useEffect(() => {
        const imgElement = imageRef.current;
        const handleLoad = () => { console.log("[HeatmapModal LOG v2.5.6] Image 'load' event."); updateImageRenderedData(); };
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
    }, [imageRenderedData]); // imageRenderedData is the only dependency from component scope

    const handleMouseDownOnCanvas = useCallback((event) => {
        console.log('[HeatmapModal LOG v2.5.6] handleMouseDownOnCanvas.');
        if (event.button !== 0 || !imageRenderedData.width || !imageRenderedData.height) return;
        const pos = getMousePositionOnImageElement(event);
        if (!pos.valid) { console.warn("[HeatmapModal LOG v2.5.6] Mouse down outside image."); return; }
        event.preventDefault(); event.stopPropagation();
        
        setIsDrawingInternal(true);
        mouseMovedAfterDownRef.current = false; // Reset ref on new mousedown
        setStartPoint({ x: pos.x, y: pos.y });
        setCurrentDrawing({ x: pos.x / imageRenderedData.width, y: pos.y / imageRenderedData.height, width: 0, height: 0 });
        setError('');
        console.log('[HeatmapModal LOG v2.5.6] Drawing started. Start (pixels):', {x: pos.x, y: pos.y});
    }, [imageRenderedData, getMousePositionOnImageElement]); // Dependencies for useCallback

    const handleMouseMoveInternal = useCallback((event) => {
        if (!isDrawingInternal || !imageRenderedData.width || !imageRenderedData.height) return; // Check isDrawingInternal here
        
        console.log('[HeatmapModal LOG v2.5.6] handleMouseMoveInternal triggered.');
        mouseMovedAfterDownRef.current = true; // Set ref to true
        
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
    }, [isDrawingInternal, imageRenderedData, startPoint, getMousePositionOnImageElement]); // Added isDrawingInternal

    const handleMouseUpInternal = useCallback(() => {
        if (!isDrawingInternal) return; // Check isDrawingInternal here
        console.log('[HeatmapModal LOG v2.5.6] handleMouseUpInternal. MouseMovedRef:', mouseMovedAfterDownRef.current, 'CurrentDrawing:', JSON.stringify(currentDrawing));
        
        const minPixelDimension = 1;
        let drawingIsValid = false;
        if (currentDrawing && imageRenderedData.width > 0 && imageRenderedData.height > 0) {
            const drawnWidthInPixels = currentDrawing.width * imageRenderedData.width;
            const drawnHeightInPixels = currentDrawing.height * imageRenderedData.height;
            console.log('[HeatmapModal LOG v2.5.6] MouseUp: Drawn pixels W:', drawnWidthInPixels, 'H:', drawnHeightInPixels);
            if (drawnWidthInPixels >= minPixelDimension && drawnHeightInPixels >= minPixelDimension) {
                drawingIsValid = true;
            }
        }

        // Use the ref's current value here
        if (!mouseMovedAfterDownRef.current || !drawingIsValid) {
            setCurrentDrawing(null); 
            console.log('[HeatmapModal LOG v2.5.6] Drawing cleared. Valid:', drawingIsValid, 'MovedRef:', mouseMovedAfterDownRef.current);
        } else {
            console.log('[HeatmapModal LOG v2.5.6] Drawing ended. Final currentDrawing:', JSON.stringify(currentDrawing));
        }
        setIsDrawingInternal(false); // Stop drawing AFTER processing
    }, [isDrawingInternal, currentDrawing, imageRenderedData]); // Added isDrawingInternal

    useEffect(() => {
        if (isDrawingInternal) {
            console.log('[HeatmapModal LOG v2.5.6] Adding window mouse listeners.');
            // mouseMovedAfterDownRef.current = false; // Already reset in mousedown
            window.addEventListener('mousemove', handleMouseMoveInternal);
            window.addEventListener('mouseup', handleMouseUpInternal);
        } else {
            console.log('[HeatmapModal LOG v2.5.6] Removing window mouse listeners.');
            window.removeEventListener('mousemove', handleMouseMoveInternal);
            window.removeEventListener('mouseup', handleMouseUpInternal);
        }
        return () => {
            console.log('[HeatmapModal LOG v2.5.6] Cleanup: Removing window mouse listeners from effect.');
            window.removeEventListener('mousemove', handleMouseMoveInternal);
            window.removeEventListener('mouseup', handleMouseUpInternal);
        };
    }, [isDrawingInternal, handleMouseMoveInternal, handleMouseUpInternal]); // Callbacks are now stable

    // ... (handleSelectAreaFromList, handleSaveOrUpdateArea, handleDeleteSelectedArea, handleStartNewAreaDefinition, handleMainSaveAllAreas remain the same as v2.5.5)
    const handleSelectAreaFromList = (areaId) => {
        console.log('[HeatmapModal LOG v2.5.6] handleSelectAreaFromList clicked for areaId:', areaId);
        setSelectedAreaId(areaId);
        const area = areas.find(a => a.id === areaId);
        if (area) {
            setEditingAreaName(area.name);
            setCurrentDrawing({ x: area.x, y: area.y, width: area.width, height: area.height });
        }
        setError('');
    };
    
    const handleSaveOrUpdateArea = () => {
        console.log('[HeatmapModal LOG v2.5.6] handleSaveOrUpdateArea button clicked.');
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

    const handleDeleteSelectedArea = () => {
        console.log('[HeatmapModal LOG v2.5.6] handleDeleteSelectedArea button clicked.');
        if (selectedAreaId) {
            setAreas(areas.filter(a => a.id !== selectedAreaId));
            setSelectedAreaId(null); setEditingAreaName(''); setCurrentDrawing(null); setError('');
        } else { setError("No area selected to delete."); }
    };

    const handleStartNewAreaDefinition = () => {
        console.log('[HeatmapModal LOG v2.5.6] handleStartNewAreaDefinition button clicked.');
        setSelectedAreaId(null); setEditingAreaName(''); setCurrentDrawing(null); 
        setIsDrawingInternal(false); mouseMovedAfterDownRef.current = false; setError('');
    };
    
    const handleMainSaveAllAreas = () => {
        console.log('[HeatmapModal LOG v2.5.6] handleMainSaveAllAreas button clicked.');
        const minPixelDimension = 1;
        const validAreas = areas.filter(area => area.name && area.name.trim() !== '' && (imageRenderedData.width > 0 && area.width * imageRenderedData.width >= minPixelDimension) && (imageRenderedData.height > 0 && area.height * imageRenderedData.height >= minPixelDimension));
        if (validAreas.length !== areas.length) { setError(`Cannot save: ${areas.length - validAreas.length} area(s) are unnamed or too small.`); return; }
        setError(''); onSaveAreas(validAreas); onClose();
    };


    if (!isOpen) return null;
    // ... (JSX is the same as v2.5.5)
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
                                console.log("[HeatmapModal LOG v2.5.6] Inline img onLoad triggered.");
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
};
export default HeatmapAreaSelectorModal;
// ----- END OF MODIFIED FILE (v2.5.6) -----