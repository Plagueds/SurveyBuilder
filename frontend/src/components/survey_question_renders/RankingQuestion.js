// frontend/src/components/survey_question_renders/RankingQuestion.js
// ----- START OF COMPLETE MODIFIED FILE (v2.1 - DND Fixes) -----
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
        transition,
        isOver, // Can be used for drop indicator styling
    } = useSortable({ id });

    const itemStyle = {
        transform: CSS.Transform.toString(transform),
        transition,
        // Add other base styles from your CSS module or inline if preferred
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
        isRequired // Assuming this will be derived from question.requiredSetting
    } = question;

    const initialItems = useMemo(() => {
        const originalOptionTexts = options.map(opt => typeof opt === 'string' ? opt : opt.text || String(opt));
        let validCurrentAnswer = [];

        if (Array.isArray(currentAnswer) && currentAnswer.length > 0) {
            const currentAnswerTexts = currentAnswer.map(item => String(item));
            const allInOptions = currentAnswerTexts.every(item => originalOptionTexts.includes(item));
            if (allInOptions && new Set(currentAnswerTexts).size === currentAnswerTexts.length) {
                validCurrentAnswer = currentAnswerTexts;
            }
        }

        if (validCurrentAnswer.length > 0) {
            const rankedSet = new Set(validCurrentAnswer);
            const unrankedOptions = originalOptionTexts.filter(optText => !rankedSet.has(optText));
            return [...validCurrentAnswer, ...unrankedOptions];
        }
        return [...originalOptionTexts];
    }, [currentAnswer, options]);

    const [rankedItems, setRankedItems] = useState(initialItems);
    const [activeId, setActiveId] = useState(null);

    useEffect(() => {
        // Update local state if the initial items (derived from props) change
        // This ensures that if currentAnswer is updated externally (e.g., loading saved progress),
        // the component reflects it.
        setRankedItems(initialItems);
    }, [initialItems]);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragStart = (event) => {
        setActiveId(event.active.id);
    };

    const handleDragEnd = (event) => {
        setActiveId(null);
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setRankedItems((items) => {
                const oldIndex = items.findIndex(item => item === active.id);
                const newIndex = items.findIndex(item => item === over.id);
                const newOrder = arrayMove(items, oldIndex, newIndex);
                if (typeof onAnswerChange === 'function') {
                    onAnswerChange(questionId, newOrder);
                }
                return newOrder;
            });
        }
    };
    
    const sortableItemIds = useMemo(() => rankedItems.map(itemText => itemText), [rankedItems]);


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
            >
                <SortableContext items={sortableItemIds} strategy={verticalListSortingStrategy}>
                    <div className={styles.rankingListContainer}>
                        {rankedItems.map((itemText, index) => (
                            <SortableItem key={itemText} id={itemText} isDragging={activeId === itemText}>
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
// ----- END OF COMPLETE MODIFIED FILE (v2.1 - DND Fixes) -----