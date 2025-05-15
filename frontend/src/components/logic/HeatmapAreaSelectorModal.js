// frontend/src/components/logic/HeatmapAreaSelectorModal.js
// ----- START OF MODIFIED FILE (v2.5.3 - Coordinate & Drawing Logic Refinement) -----
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
    const [currentDrawing, setCurrentDrawing] = useState(null); // Stores {x,y,width,height} normalized (0-1)
    const [isDrawing, setIsDrawingState] = useState(false);
    const [startPoint, setStartPoint] = useState({ x: 0, y: 0 }); // Stores start point in pixels, relative to the image element
    const [imageRenderedSize, setImageRenderedSize] = useState({ width: 0, height: 0, naturalWidth: 0, naturalHeight: 0, top: 0, left: 0 });
    const [error, setError] = useState('');

    const imageRef = useRef(null);
    const drawingCanvasRef = useRef(null); // This is the container for the image (the grey box)

    console.log('[HeatmapModal LOG] Component Render/Re-render. isOpen:', isOpen, 'isDrawing:', isDrawing, 'currentDrawing:', currentDrawing, 'selectedAreaId:', selectedAreaId, 'editingAreaName:', editingAreaName, 'imageRenderedSize:', imageRenderedSize);

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
            setImageRenderedSize({ width: 0, height: 0, naturalWidth: 0, naturalHeight: 0, top: 0, left: 0 });
            console.log('[HeatmapModal LOG] Modal opened, state reset, initialAreas processed:', processedAreas);
        }
    }, [initialAreas, isOpen]);

    const updateImageRenderedSize = useCallback(() => {
        console.log('[HeatmapModal LOG] updateImageRenderedSize called.');
        if (imageRef.current && imageRef.current.complete && imageRef.current.naturalWidth > 0) {
            const imgElement = imageRef.current;
            const containerRect = drawingCanvasRef.current ? drawingCanvasRef.current.getBoundingClientRect() : { top: 0, left: 0 };
            const imgRect = imgElement.getBoundingClientRect();

            const newSize = {
                width: imgElement.offsetWidth, // The actual rendered width of the image
                height: imgElement.offsetHeight, // The actual rendered height of the image
                naturalWidth: imgElement.naturalWidth,
                naturalHeight: imgElement.naturalHeight,
                // Position of the image relative to its direct container (drawingCanvasRef)
                // This is important if the image is centered or positioned within a larger container
                top: imgRect.top - containerRect.top,
                left: imgRect.left - containerRect.left,
            };
            console.log('[HeatmapModal LOG] Image ready, new calculated size & position:', newSize);
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
    }, []); // No dependencies that change frequently

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
            // Consider a ResizeObserver on drawingCanvasRef for more robust updates if container size changes
            window.addEventListener('resize', updateImageRenderedSize);
        }

        return () => {
            if (imgElement) {
                imgElement.removeEventListener('load', handleLoad);
            }
            window.removeEventListener('resize', updateImageRenderedSize);
            console.log('[HeatmapModal LOG] Image effect cleanup run.');
        };
    }, [isOpen, updateImageRenderedSize]);

    const getMousePositionOnImageElement = useCallback((event) => {
        if (!imageRef.current || !drawingCanvasRef.current || imageRenderedSize.width === 0 || imageRenderedSize.height === 0) {
            console.warn("[HeatmapModal LOG] Cannot get mouse position: image/container ref not ready or imageRenderedSize invalid.");
            return { x: 0, y: 0, valid: false };
        }
    
        const containerRect = drawingCanvasRef.current.getBoundingClientRect(); // The grey box
        
        // Mouse position relative to the viewport
        const clientX = event.clientX;
        const clientY = event.clientY;
    
        // Mouse position relative to the container (drawingCanvasRef)
        let xRelativeToContainer = clientX - containerRect.left;
        let yRelativeToContainer = clientY - containerRect.top;
    
        // Now, adjust to be relative to the image element itself, considering its offset within the container
        // imageRenderedSize.left and .top are the offsets of the image within drawingCanvasRef
        let x = xRelativeToContainer - imageRenderedSize.left;
        let y = yRelativeToContainer - imageRenderedSize.top;
    
        // Clamp coordinates to be within the actual image dimensions (0 to imageRenderedSize.width/height)
        x = Math.max(0, Math.min(x, imageRenderedSize.width));
        y = Math.max(0, Math.min(y, imageRenderedSize.height));
        
        // Check if the click was actually within the bounds of the image element
        const isValidClickOnImage = 
            xRelativeToContainer >= imageRenderedSize.left &&
            xRelativeToContainer <= imageRenderedSize.left + imageRenderedSize.width &&
            yRelativeToContainer >= imageRenderedSize.top &&
            yRelativeToContainer <= imageRenderedSize.top + imageRenderedSize.height;

        console.logSilly?.('[HeatmapModal LOG] Mouse Pos on Image Element:', { clientX, clientY, containerRelX: xRelativeToContainer, containerRelY: yRelativeToContainer, imgRelX: x, imgRelY: y, imgW: imageRenderedSize.width, imgH: imageRenderedSize.height, imgOffsetL: imageRenderedSize.left, imgOffsetT: imageRenderedSize.top, isValidClick: isValidClickOnImage });
        
        return { x, y, valid: isValidClickOnImage }; // x, y are now pixel coords relative to the top-left of the image element
    }, [imageRenderedSize]);


    const handleMouseDownOnCanvas = (event) => {
        console.log('[HeatmapModal LOG] handleMouseDownOnCanvas triggered on the container.');
        if (event.button !== 0 || !imageRenderedSize.width || !imageRenderedSize.height) {
            console.warn('[HeatmapModal LOG] MouseDown prevented: Not left click or imageRenderedSize invalid.', {button: event.button, imgW: imageRenderedSize.width, imgH: imageRenderedSize.height});
            return;
        }
        
        const pos = getMousePositionOnImageElement(event); // Get coords relative to the image element
        
        if (!pos.valid) { // If click was outside the actual image area (e.g., on padding of container)
            console.warn("[HeatmapModal LOG] Mouse down was outside the actual image element. Ignoring.");
            setIsDrawingState(false); // Ensure not in drawing state
            setCurrentDrawing(null); // Clear any accidental drawing
            return;
        }
        event.preventDefault(); // Prevent text selection, etc.
        event.stopPropagation();

        setIsDrawingState(true);
        setStartPoint({ x: pos.x, y: pos.y }); // Store pixel start point relative to the image element
        
        // CurrentDrawing stores normalized coordinates (0 to 1) based on imageRenderedSize
        setCurrentDrawing({
            x: pos.x / imageRenderedSize.width,
            y: pos.y / imageRenderedSize.height,
            width: 0,
            height: 0
        });
        setError('');
        console.log('[HeatmapModal LOG] Drawing started on image. StartPoint (pixels on image):', {x: pos.x, y: pos.y}, 'Initial CurrentDrawing (normalized):', {x: pos.x / imageRenderedSize.width, y: pos.y / imageRenderedSize.height});
    };

    const handleGlobalMouseMove = useCallback((event) => {
        if (!isDrawing || !imageRenderedSize.width || !imageRenderedSize.height) return;
        
        const currentPos = getMousePositionOnImageElement(event); // pixel coords relative to image element
        // We don't need to check currentPos.valid here strictly, as drawing can go outside image bounds
        // but the coordinates will be clamped by getMousePositionOnImageElement.

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
    }, [isDrawing, imageRenderedSize, startPoint, getMousePositionOnImageElement]);

    const handleGlobalMouseUp = useCallback(() => {
        if (!isDrawing) return;
        console.log('[HeatmapModal LOG] handleGlobalMouseUp triggered.');
        setIsDrawingState(false);
        // Check if the drawing is at least 1x1 pixel on the *rendered image*
        const minPixelDimension = 1; 
        if (currentDrawing && (currentDrawing.width * imageRenderedSize.width < minPixelDimension || currentDrawing.height * imageRenderedSize.height < minPixelDimension)) {
            setCurrentDrawing(null); 
            console.log('[HeatmapModal LOG] Drawing ended, too small (less than 1x1 pixel on rendered image), cleared. Current drawing was:', currentDrawing);
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

        const minPixelDimension = 1;
        if (!currentDrawing || 
            (currentDrawing.width * imageRenderedSize.width < minPixelDimension) || 
            (currentDrawing.height * imageRenderedSize.height < minPixelDimension)) {
            if (!selectedAreaId) { 
                setError("Please draw a valid area (at least 1x1 pixel) on the image.");
                console.warn('[HeatmapModal LOG] Save/Update Area: Drawing invalid or too small for new area.');
                return;
            }
        }

        setError('');
        const areaData = {
            ...currentDrawing, 
            name: editingAreaName.trim(),
        };

        if (selectedAreaId) { 
            console.log('[HeatmapModal LOG] Updating area:', selectedAreaId, areaData);
            setAreas(areas.map(a => a.id === selectedAreaId ? { ...a, ...areaData } : a));
        } else { 
            const newArea = { ...areaData, id: uuidv4() };
            console.log('[HeatmapModal LOG] Saving new area:', newArea);
            setAreas([...areas, newArea]);
            setSelectedAreaId(newArea.id); 
        }
    };

    const handleDeleteSelectedArea = () => {
        console.log('[HeatmapModal LOG] handleDeleteSelectedArea button clicked.');
        if (selectedAreaId) {
            console.log('[HeatmapModal LOG] Deleting area:', selectedAreaId);
            setAreas(areas.filter(a => a.id !== selectedAreaId));
            setSelectedAreaId(null);
            setEditingAreaName('');
            setCurrentDrawing(null); 
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
        const minPixelDimension = 1;
        const validAreas = areas.filter(area => 
            area.name && area.name.trim() !== '' &&
            (area.width * imageRenderedSize.width >= minPixelDimension) && 
            (area.height * imageRenderedSize.height >= minPixelDimension)
        );

        if (validAreas.length !== areas.length) {
            const invalidCount = areas.length - validAreas.length;
            setError(`Cannot save: ${invalidCount} area(s) are unnamed or too small. Please review defined areas.`);
            console.warn('[HeatmapModal LOG] Save All: Found invalid areas. All areas:', areas, 'Valid areas:', validAreas);
            return;
        }
        setError('');
        console.log('[HeatmapModal LOG] Calling onSaveAreas with:', validAreas);
        onSaveAreas(validAreas); 
        onClose();
    };

    if (!isOpen) return null;

    const activeRectangleToDisplay = currentDrawing;
    // Display rectangles based on imageRenderedSize (the actual rendered image)
    const selectionBoxStyle = activeRectangleToDisplay && imageRenderedSize.width > 0 ? {
        position: 'absolute',
        left: `${imageRenderedSize.left + activeRectangleToDisplay.x * imageRenderedSize.width}px`,
        top: `${imageRenderedSize.top + activeRectangleToDisplay.y * imageRenderedSize.height}px`,
        width: `${activeRectangleToDisplay.width * imageRenderedSize.width}px`,
        height: `${activeRectangleToDisplay.height * imageRenderedSize.height}px`,
        border: '2px dashed var(--primary-color, red)',
        backgroundColor: 'var(--primary-color-alpha, rgba(255, 0, 0, 0.2))',
        boxSizing: 'border-box',
        pointerEvents: 'none', // Crucial: allows clicks to pass through to the image container
        zIndex: 10,
    } : { display: 'none' };
    
    return (
        <div className={`${styles.modalContent} ${styles.heatmapAreaModalContent}`}>
            <div className={styles.modalHeader}>
                {/* ... header content ... */}
                <h3>Manage Heatmap Areas</h3>
                <button onClick={onClose} className={styles.modalCloseButton} title="Close">&times;</button>
            </div>
            <div className={`${styles.modalBody} ${styles.heatmapAreaModalBody}`}>
                <div className={styles.heatmapAreaListPanel}>
                    {/* ... list panel content ... */}
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
                    {/* ... drawing panel content ... */}
                    <p className={styles.modalInstructions}>
                        To add/update: 1. Select existing or 'Start New'. 2. Draw on image. 3. Name it. 4. 'Save/Update Area'.
                    </p>
                    {error && <p className={styles.invalidFeedback} style={{display: 'block'}}>{error}</p>}
                    <div // This is drawingCanvasRef - the grey container
                        ref={drawingCanvasRef}
                        className={styles.heatmapImageContainer}
                        onMouseDown={handleMouseDownOnCanvas} // Mouse down on the container
                        // Mouse move and up are global (handled by useImperativeHandle and SurveyBuildPage)
                        title="Click and drag on the image to draw an area"
                    >
                        <img // This is imageRef
                            ref={imageRef}
                            src={imageUrl}
                            alt="Heatmap for area selection"
                            draggable="false" // Important to prevent native image drag
                            className={styles.heatmapSelectableImage}
                            onLoad={() => { 
                                console.log("[HeatmapModal LOG] Inline img onLoad triggered on <img> tag.");
                                updateImageRenderedSize();
                            }}
                            onError={() => {
                                console.error("[HeatmapModal LOG] Image failed to load:", imageUrl);
                                setError("Failed to load heatmap image.");
                            }}
                            style={{ 
                                // Ensure image itself doesn't capture mouse events if drawing is on container
                                // pointerEvents: 'none' // This might be too aggressive, let's test without first
                            }}
                        />
                        {/* Display existing areas: position them relative to drawingCanvasRef, using imageRenderedSize offsets and dimensions */}
                        {imageRenderedSize.width > 0 && areas.map(area => (
                            <div key={`display-${area.id}`} style={{
                                position: 'absolute',
                                left: `${imageRenderedSize.left + (area.x * imageRenderedSize.width)}px`,
                                top: `${imageRenderedSize.top + (area.y * imageRenderedSize.height)}px`,
                                width: `${area.width * imageRenderedSize.width}px`,
                                height: `${area.height * imageRenderedSize.height}px`,
                                border: `1px solid ${area.id === selectedAreaId ? 'var(--primary-color, blue)' : 'rgba(0,0,255,0.3)'}`,
                                backgroundColor: area.id === selectedAreaId ? 'rgba(0,0,255,0.15)' : 'rgba(0,0,255,0.05)',
                                pointerEvents: 'none', 
                                boxSizing: 'border-box',
                                zIndex: area.id === selectedAreaId ? 2 : 1,
                            }}>
                                <span className={styles.heatmapAreaLabelOnImage}>{area.name}</span>
                            </div>
                        ))}
                        {/* Display current drawing selection box */}
                        {imageRenderedSize.width > 0 && <div style={selectionBoxStyle}></div>}
                        
                        {imageRenderedSize.width === 0 && imageUrl && <p className={styles.textMuted}>Loading image or image dimensions not yet available...</p>}
                    </div>

                    <div className={styles.heatmapAreaControls}>
                        {/* ... controls ... */}
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
                            disabled={
                                !editingAreaName.trim() || 
                                (!currentDrawing && !selectedAreaId) || 
                                (currentDrawing && imageRenderedSize.width > 0 && // ensure imageRenderedSize is valid
                                    (currentDrawing.width * imageRenderedSize.width < 1 || currentDrawing.height * imageRenderedSize.height < 1)
                                )
                            }
                        >
                            {selectedAreaId ? 'Update Area' : 'Save New Area'}
                        </button>
                    </div>
                    <div className={styles.heatmapCoordsDisplay}>
                        {/* ... coords display ... */}
                        {currentDrawing ? 
                            `Current Drawing (Normalized): X: ${currentDrawing.x.toFixed(3)}, Y: ${currentDrawing.y.toFixed(3)}, W: ${currentDrawing.width.toFixed(3)}, H: ${currentDrawing.height.toFixed(3)}`
                            : "No active drawing."
                        }
                         | Rendered img: W:{imageRenderedSize.width} H:{imageRenderedSize.height} L:{imageRenderedSize.left} T:{imageRenderedSize.top}
                    </div>
                </div>
            </div>
            <div className={styles.modalFooter}>
                {/* ... footer buttons ... */}
                <button type="button" className="button button-secondary" onClick={onClose}>Cancel</button>
                <button type="button" className="button button-primary" onClick={handleMainSaveAllAreas}>Save All Defined Areas</button>
            </div>
        </div>
    );
});

export default HeatmapAreaSelectorModal;
// ----- END OF MODIFIED FILE (v2.5.3) -----