// frontend/src/components/survey_question_renders/RankingQuestion.js
// ----- START OF COMPLETE MODIFIED FILE (v2.2 - DND Style Refinement) -----
import React, { useState, useEffect, useMemo } from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import styles from './SurveyQuestionStyles.module.css';

// --- SortableItem Component (Moved to top level) ---
function SortableItem({ id, children, isDragging }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition, // dnd-kit provides this
        isOver, 
    } = useSortable({ id });

    const itemStyle = {
        transform: CSS.Transform.toString(transform),
        transition: transition, // Use transition from dnd-kit
        // Other visual styles can be applied via className
    };

    return (
        <div
            ref={setNodeRef}
            style={itemStyle}
            className={`${styles.rankingSortableItem} ${isDragging ? styles.rankingSortableItemIsDragging : ''} ${isOver ? styles.rankingSortableItemIsOver : ''}`}
            {...attributes}
            {...listeners}
        >
            {children}
        </div>
    );
}

// --- RankingQuestion Component ---
const RankingQuestion = ({ question, currentAnswer, onAnswerChange, isPreviewMode, disabled }) => {
    const {
        _id: questionId,
        text,
        options = [],
        description,
        // isRequired // Assuming this will be derived from question.requiredSetting
    } = question;

    const initialItems = useMemo(() => {
        const originalOptionTexts = options.map(opt => typeof opt === 'string' ? opt : opt.text || String(opt)).filter(Boolean); // Ensure no undefined/null texts
        let validCurrentAnswer = [];

        if (Array.isArray(currentAnswer) && currentAnswer.length > 0) {
            const currentAnswerTexts = currentAnswer.map(item => String(item));
            // Ensure all items in currentAnswer are actually among the original options
            const allInOptions = currentAnswerTexts.every(item => originalOptionTexts.includes(item));
            // Ensure no duplicates in currentAnswer
            const hasNoDuplicates = new Set(currentAnswerTexts).size === currentAnswerTexts.length;

            if (allInOptions && hasNoDuplicates && currentAnswerTexts.length === originalOptionTexts.length) {
                validCurrentAnswer = currentAnswerTexts;
            }
        }

        if (validCurrentAnswer.length === originalOptionTexts.length) {
            // If currentAnswer is a valid permutation of all options, use it
            return [...validCurrentAnswer];
        } else if (validCurrentAnswer.length > 0) {
            // If currentAnswer is partial or invalid, try to use its valid parts and append the rest
            const rankedSet = new Set(validCurrentAnswer.filter(item => originalOptionTexts.includes(item)));
            const unrankedOptions = originalOptionTexts.filter(optText => !rankedSet.has(optText));
            return [...Array.from(rankedSet), ...unrankedOptions];
        }
        // Default to original options order if currentAnswer is empty or completely invalid
        return [...originalOptionTexts];
    }, [currentAnswer, options]);

    const [rankedItems, setRankedItems] = useState(() => initialItems); // Initialize with memoized value
    const [activeId, setActiveId] = useState(null);

    useEffect(() => {
        // Only update if initialItems fundamentally changes (e.g. options prop changes)
        // This comparison helps prevent unnecessary resets if currentAnswer updates reflect user interaction
        if (JSON.stringify(rankedItems) !== JSON.stringify(initialItems) && 
            initialItems.length === (question.options || []).length ) { // Basic check if options changed
             setRankedItems(initialItems);
        }
    }, [initialItems, rankedItems, question.options]);


    const sensors = useSensors(
        useSensor(PointerSensor, {
            // Require the mouse to move by 10 pixels before activating
            // Improves behavior on touch devices and prevents accidental drags
            activationConstraint: {
              distance: 10,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragStart = (event) => {
        if (disabled) return;
        setActiveId(event.active.id);
    };

    const handleDragEnd = (event) => {
        if (disabled) return;
        setActiveId(null);
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setRankedItems((items) => {
                const oldIndex = items.findIndex(item => item === active.id);
                const newIndex = items.findIndex(item => item === over.id);
                if (oldIndex === -1 || newIndex === -1) return items; // Should not happen
                
                const newOrder = arrayMove(items, oldIndex, newIndex);
                if (typeof onAnswerChange === 'function') {
                    onAnswerChange(questionId, newOrder);
                }
                return newOrder;
            });
        }
    };
    
    // dnd-kit expects IDs to be strings for SortableContext items
    const sortableItemIds = useMemo(() => rankedItems.map(itemText => String(itemText)), [rankedItems]);


    if (!options || options.length === 0) {
        return (
            <div className={`${styles.questionContainer} ${disabled ? styles.disabled : ''}`}>
                <h4 className={styles.questionText}>{text}</h4>
                {description && <p className={styles.questionDescription}>{description}</p>}
                <p className={styles.questionDescription}>No options available for ranking.</p>
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
            <p className={styles.questionDescription}><small>(Drag and drop to reorder. Item 1 is the highest rank.)</small></p>

            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                // autoScroll={{layoutShiftCompensation: false}} // Consider if layout shifts are an issue
            >
                <SortableContext items={sortableItemIds} strategy={verticalListSortingStrategy}>
                    <div className={styles.rankingListContainer}>
                        {rankedItems.map((itemText, index) => (
                            <SortableItem key={String(itemText)} id={String(itemText)} isDragging={activeId === String(itemText)}>
                                <span className={styles.rankingItemIndex}>{index + 1}.</span>
                                <span className={styles.rankingItemTextDnD}>{itemText}</span>
                                <span className={styles.rankingDragHandle}>&#x2630;</span>
                            </SortableItem>
                        ))}
                    </div>
                </SortableContext>
            </DndContext>
        </div>
    );
};

export default RankingQuestion;
// ----- END OF COMPLETE MODIFIED FILE (v2.2 - DND Style Refinement) -----