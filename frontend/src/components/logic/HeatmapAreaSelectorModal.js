// frontend/src/components/logic/HeatmapAreaSelectorModal.js
// ----- START OF MODIFIED FILE (v2.2 - Refined Y-coordinate calculation) -----
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

const HeatmapAreaSelectorModal = ({
    isOpen,
    onClose,
    onSaveAreas,
    imageUrl,
    initialAreas = [],
    styles
}) => {
    const [areas, setAreas] = useState([]);
    const [selectedAreaId, setSelectedAreaId] = useState(null);
    const [editingAreaName, setEditingAreaName] = useState('');
    const [currentDrawing, setCurrentDrawing] = useState(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [startPoint, setStartPoint] = useState({ x: 0, y: 0 });
    // imageRenderedSize will store: width, height (of the img element's box), naturalWidth, naturalHeight (of the image file)
    const [imageRenderedSize, setImageRenderedSize] = useState({ width: 0, height: 0, naturalWidth: 0, naturalHeight: 0 });
    const [error, setError] = useState('');

    const imageRef = useRef(null);
    const drawingCanvasRef = useRef(null); // This is the div.heatmapImageContainer

    useEffect(() => {
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
            setImageRenderedSize({ width: 0, height: 0, naturalWidth: 0, naturalHeight: 0 });
        }
    }, [initialAreas, isOpen]);

    const updateImageRenderedSize = useCallback(() => {
        if (imageRef.current) {
            setImageRenderedSize({
                width: imageRef.current.offsetWidth,
                height: imageRef.current.offsetHeight,
                naturalWidth: imageRef.current.naturalWidth,
                naturalHeight: imageRef.current.naturalHeight
            });
        }
    }, []); // No dependencies, this function itself is stable

    useEffect(() => {
        const imgElement = imageRef.current;
        const handleLoad = () => updateImageRenderedSize();

        if (isOpen && imgElement) {
            if (imgElement.complete && imgElement.naturalWidth > 0) {
                handleLoad();
            } else {
                imgElement.addEventListener('load', handleLoad);
            }
            window.addEventListener('resize', updateImageRenderedSize);
        }
        return () => {
            if (imgElement) imgElement.removeEventListener('load', handleLoad);
            window.removeEventListener('resize', updateImageRenderedSize);
        };
    }, [isOpen, updateImageRenderedSize]); // updateImageRenderedSize is stable

    const getMousePositionOnImage = useCallback((event) => {
        // Ensure image is loaded and its container ref is available
        if (!drawingCanvasRef.current || !imageRef.current || !imageRef.current.complete || imageRef.current.naturalWidth === 0) {
            return { x: 0, y: 0, valid: false };
        }

        const canvasContainer = drawingCanvasRef.current; // The div with the border
        const rect = canvasContainer.getBoundingClientRect(); // Bounding box of this bordered container

        // Mouse position relative to the viewport
        const clientX = event.clientX;
        const clientY = event.clientY;

        // Calculate mouse position relative to the *content area* of the drawingCanvasRef.
        // rect.left/top are coordinates of the border-box.
        // clientLeft/Top are the widths of the left/top borders.
        // Subtracting them gives coordinates relative to the padding-box edge (or content-box if no padding).
        let x = clientX - rect.left - canvasContainer.clientLeft;
        let y = clientY - rect.top - canvasContainer.clientTop;

        // The imageRenderedSize.width/height are from imageRef.current.offsetWidth/Height.
        // Due to the CSS (inline-block container, block image), these should match the
        // content dimensions of canvasContainer.
        // We clamp to these dimensions to ensure coordinates are within the image bounds.
        x = Math.max(0, Math.min(x, imageRenderedSize.width));
        y = Math.max(0, Math.min(y, imageRenderedSize.height));
        
        return { x, y, valid: true }; // These are pixel coordinates on the image
    }, [imageRenderedSize]); // Depends on the whole imageRenderedSize object

    const handleMouseDown = (event) => {
        if (event.button !== 0 || !imageRenderedSize.width || !imageRenderedSize.height) return;
        event.preventDefault();

        const pos = getMousePositionOnImage(event);
        if (!pos.valid) return;

        setIsDrawing(true);
        setStartPoint({ x: pos.x, y: pos.y });

        setCurrentDrawing({
            x: pos.x / imageRenderedSize.width,
            y: pos.y / imageRenderedSize.height,
            width: 0,
            height: 0
        });
        setError('');
    };

    const handleMouseMove = (event) => {
        if (!isDrawing || !imageRenderedSize.width || !imageRenderedSize.height) return;
        event.preventDefault();

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
    };

    const handleMouseUp = (event) => {
        if (!isDrawing) return;
        event.preventDefault();
        setIsDrawing(false);
        if (currentDrawing && (currentDrawing.width < 0.001 || currentDrawing.height < 0.001)) {
            setCurrentDrawing(null); // Discard tiny drawings
        }
    };

    const handleSelectAreaFromList = (areaId) => {
        setSelectedAreaId(areaId);
        const area = areas.find(a => a.id === areaId);
        if (area) {
            setEditingAreaName(area.name);
            setCurrentDrawing({ x: area.x, y: area.y, width: area.width, height: area.height });
        }
        setError('');
    };

    const handleSaveOrUpdateArea = () => {
        if (!editingAreaName.trim()) { setError("Area name cannot be empty."); return; }
        if (!currentDrawing || currentDrawing.width === 0 || currentDrawing.height === 0) { setError("Please draw an area on the image."); return; }
        const nameExists = areas.some(a => a.name.toLowerCase() === editingAreaName.trim().toLowerCase() && a.id !== selectedAreaId);
        if (nameExists) { setError(`An area with the name "${editingAreaName.trim()}" already exists.`); return; }

        const areaData = {
            name: editingAreaName.trim(),
            x: Number(currentDrawing.x), y: Number(currentDrawing.y),
            width: Number(currentDrawing.width), height: Number(currentDrawing.height),
        };

        if (selectedAreaId) {
            setAreas(areas.map(a => a.id === selectedAreaId ? { ...a, ...areaData } : a));
        } else {
            setAreas([...areas, { id: uuidv4(), ...areaData }]);
        }
        setSelectedAreaId(null); setEditingAreaName(''); setCurrentDrawing(null); setError('');
    };

    const handleDeleteSelectedArea = () => {
        if (selectedAreaId) {
            setAreas(areas.filter(a => a.id !== selectedAreaId));
            setSelectedAreaId(null); setEditingAreaName(''); setCurrentDrawing(null); setError('');
        }
    };
    
    const handleStartNewAreaDefinition = () => {
        setSelectedAreaId(null); setEditingAreaName(''); setCurrentDrawing(null); setError('');
    };

    const handleMainSaveAllAreas = () => {
        if (areas.some(a => !a.name || a.name.trim() === '')) { setError("All defined areas must have a name."); return; }
        const finalAreasToSave = areas.map(a => ({
            id: a.id, name: a.name,
            x: Number(a.x), y: Number(a.y),
            width: Number(a.width), height: Number(a.height),
        }));
        onSaveAreas(finalAreasToSave);
    };

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

    return (
        <div className={styles.modalBackdrop} onMouseMove={isDrawing ? handleMouseMove : null} onMouseUp={isDrawing ? handleMouseUp : null} onMouseLeave={isDrawing ? handleMouseUp : null}>
            <div className={`${styles.modalContent} ${styles.heatmapAreaModalContent}`}>
                <div className={styles.modalHeader}>
                    <h3>Manage Heatmap Areas</h3>
                    <button onClick={onClose} className={styles.modalCloseButton}>&times;</button>
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
                                    title={`X:${area.x.toFixed(2)}, Y:${area.y.toFixed(2)}, W:${area.width.toFixed(2)}, H:${area.height.toFixed(2)}`}
                                >
                                    {area.name}
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
                            To add/update: 1. Select/Start New. 2. Draw on image. 3. Name it. 4. Save/Update Area.
                        </p>
                        {error && <p className={styles.invalidFeedback} style={{display: 'block'}}>{error}</p>}
                        <div
                            ref={drawingCanvasRef}
                            className={styles.heatmapImageContainer}
                            onMouseDown={handleMouseDown}
                        >
                            <img
                                ref={imageRef}
                                src={imageUrl}
                                alt="Heatmap for area selection"
                                draggable="false"
                                className={styles.heatmapSelectableImage}
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
                        </div>

                        <div className={styles.heatmapAreaControls}>
                             <button
                                type="button"
                                onClick={handleStartNewAreaDefinition}
                                className="button button-secondary"
                            >
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
                                disabled={!editingAreaName.trim() || (!currentDrawing && !selectedAreaId) || (currentDrawing && (currentDrawing.width < 0.001 || currentDrawing.height < 0.001))}
                            >
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
        </div>
    );
};

export default HeatmapAreaSelectorModal;
// ----- END OF MODIFIED FILE (v2.2) -----