// frontend/src/components/survey_question_renders/CardSortQuestion.js
// ----- START OF COMPLETE MODIFIED FILE (v2.1 - Import Fix) -----
import React, { useState, useEffect, useMemo } from 'react';
import {
    DndContext,
    DragOverlay,
    PointerSensor,
    KeyboardSensor,
    useSensor,
    useSensors,
    closestCorners,
} from '@dnd-kit/core';
import {
    SortableContext,
    // arrayMove, // Not directly used here for cross-container, but could be for within-category sorting
    verticalListSortingStrategy,
    useSortable,
    sortableKeyboardCoordinates, // <<<--- ADDED THIS IMPORT
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import styles from './SurveyQuestionStyles.module.css';

const UNASSIGNED_CATEGORY_ID = '__UNASSIGNED__';

// --- Draggable Card Component ---
function DraggableCard({ id, children, isDragging, isOverlay }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging && !isOverlay ? 0.5 : 1,
        cursor: isOverlay ? 'grabbing' : 'grab',
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`${styles.cardSortCard} ${isOverlay ? styles.cardSortCardOverlay : ''}`}
            {...attributes}
            {...listeners}
        >
            {children}
        </div>
    );
}

// --- Droppable Category Column Component ---
function DroppableCategory({ id, title, children, onRemoveCategory, allowUserCategories }) {
    const { setNodeRef, isOver } = useSortable({ id });

    return (
        <div
            ref={setNodeRef}
            className={`${styles.cardSortCategoryColumn} ${isOver ? styles.cardSortCategoryColumnOver : ''}`}
        >
            <h5 className={styles.cardSortCategoryTitle}>
                {title}
                {id.startsWith('user_') && allowUserCategories && onRemoveCategory && (
                    <button
                        type="button"
                        onClick={() => onRemoveCategory(id)}
                        className={styles.cardSortRemoveCategoryButton}
                        title="Remove category"
                    >
                        &times;
                    </button>
                )}
            </h5>
            <div className={styles.cardSortCardList}>
                {children}
                {React.Children.count(children) === 0 && (
                    <p className={styles.cardSortEmptyCategoryText}>(Empty)</p>
                )}
            </div>
        </div>
    );
}


const CardSortQuestion = ({ question, currentAnswer, onAnswerChange, isPreviewMode, disabled }) => {
    const {
        _id: questionId,
        text,
        options: cardsFromProps = [],
        cardSortCategories: predefinedCategoriesFromProps = [],
        cardSortAllowUserCategories = true,
        description
    } = question;

    const initialCards = useMemo(() => cardsFromProps.map(card => ({ id: String(card), text: String(card) })), [cardsFromProps]);

    const initialPredefinedCategories = useMemo(() =>
        predefinedCategoriesFromProps.map(name => ({
            id: `predefined_${String(name).replace(/\s+/g, '_')}_${questionId}`,
            name: String(name)
        })), [predefinedCategoriesFromProps, questionId]);

    const [userCategories, setUserCategories] = useState([]);
    const [assignments, setAssignments] = useState({});
    const [newUserCategoryName, setNewUserCategoryName] = useState('');
    const [activeCard, setActiveCard] = useState(null);

    useEffect(() => {
        const savedAssignments = currentAnswer?.assignments || {};
        const savedUserCategories = Array.isArray(currentAnswer?.userCategories) ? currentAnswer.userCategories : [];
        
        setAssignments(savedAssignments);
        setUserCategories(savedUserCategories.map(cat => ({
            id: cat.id || `user_${Date.now()}_${String(cat.name).replace(/\s+/g, '_')}`,
            name: String(cat.name)
        })));
    }, [currentAnswer]);


    const allCategoryObjects = useMemo(() => [
        { id: UNASSIGNED_CATEGORY_ID, name: 'Unassigned Cards' },
        ...initialPredefinedCategories,
        ...userCategories
    ], [initialPredefinedCategories, userCategories]);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragStart = (event) => {
        if (disabled) return;
        const card = initialCards.find(c => c.id === event.active.id);
        setActiveCard(card);
    };

    const handleDragEnd = (event) => {
        if (disabled) return;
        setActiveCard(null);
        const { active, over } = event;

        if (active && over && active.id !== over.id) {
            const cardId = active.id;
            const targetCategoryId = over.id;

            const isValidCategory = allCategoryObjects.some(cat => cat.id === targetCategoryId);

            if (isValidCategory) {
                const newAssignments = { ...assignments, [cardId]: targetCategoryId };
                setAssignments(newAssignments);
                if (typeof onAnswerChange === 'function') {
                    onAnswerChange(questionId, { assignments: newAssignments, userCategories });
                }
            } else {
                 // Card was dropped outside a valid category, assign to unassigned if it was previously in a real category
                if (assignments[cardId] && assignments[cardId] !== UNASSIGNED_CATEGORY_ID) {
                    const newAssignments = { ...assignments, [cardId]: UNASSIGNED_CATEGORY_ID };
                    setAssignments(newAssignments);
                    if (typeof onAnswerChange === 'function') {
                        onAnswerChange(questionId, { assignments: newAssignments, userCategories });
                    }
                }
            }
        } else if (active && !over) { // Dropped outside any droppable
            // If card was in a category, move to unassigned
            if (assignments[active.id] && assignments[active.id] !== UNASSIGNED_CATEGORY_ID) {
                 const newAssignments = { ...assignments, [active.id]: UNASSIGNED_CATEGORY_ID };
                 setAssignments(newAssignments);
                 if (typeof onAnswerChange === 'function') {
                    onAnswerChange(questionId, { assignments: newAssignments, userCategories });
                }
            }
        }
    };
    
    const handleAddUserCategory = () => {
        if (disabled || !newUserCategoryName.trim() || !cardSortAllowUserCategories) return;
        
        const newCategory = {
            id: `user_${Date.now()}_${newUserCategoryName.trim().replace(/\s+/g, '_')}`,
            name: newUserCategoryName.trim()
        };
        const updatedUserCategories = [...userCategories, newCategory];
        setUserCategories(updatedUserCategories);
        setNewUserCategoryName('');
        if (typeof onAnswerChange === 'function') {
             onAnswerChange(questionId, { assignments, userCategories: updatedUserCategories });
        }
    };

    const handleRemoveUserCategory = (categoryIdToRemove) => {
        if (disabled) return;
        if (!window.confirm("Are you sure you want to remove this category and reassign its cards to 'Unassigned'?")) return;

        const updatedUserCategories = userCategories.filter(cat => cat.id !== categoryIdToRemove);
        setUserCategories(updatedUserCategories);

        const newAssignments = { ...assignments };
        Object.keys(newAssignments).forEach(cardId => {
            if (newAssignments[cardId] === categoryIdToRemove) {
                newAssignments[cardId] = UNASSIGNED_CATEGORY_ID;
            }
        });
        setAssignments(newAssignments);
        if (typeof onAnswerChange === 'function') {
            onAnswerChange(questionId, { assignments: newAssignments, userCategories: updatedUserCategories });
        }
    };

    if (!initialCards || initialCards.length === 0) {
        return (
            <div className={`${styles.questionContainer} ${disabled ? styles.disabled : ''}`}>
                <h4 className={styles.questionText}>{text}</h4>
                {description && <p className={styles.questionDescription}>{description}</p>}
                <p className={styles.questionDescription}>No cards available for sorting.</p>
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
            <p className={styles.questionDescription}><small>(Drag cards to the desired categories.)</small></p>
            
            <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >
                <div className={styles.cardSortLayout}>
                    {allCategoryObjects.map(category => (
                        <DroppableCategory
                            key={category.id}
                            id={category.id}
                            title={category.name}
                            onRemoveCategory={handleRemoveUserCategory}
                            allowUserCategories={cardSortAllowUserCategories}
                        >
                            <SortableContext items={initialCards.filter(card => (assignments[card.id] || UNASSIGNED_CATEGORY_ID) === category.id).map(c => c.id)} strategy={verticalListSortingStrategy}>
                                {initialCards
                                    .filter(card => (assignments[card.id] || UNASSIGNED_CATEGORY_ID) === category.id)
                                    .map(card => (
                                        <DraggableCard key={card.id} id={card.id} isDragging={activeCard?.id === card.id}>
                                            {card.text}
                                        </DraggableCard>
                                    ))}
                            </SortableContext>
                        </DroppableCategory>
                    ))}
                </div>
                <DragOverlay>
                    {activeCard ? (
                        <DraggableCard id={activeCard.id} isOverlay isDragging>
                            {activeCard.text}
                        </DraggableCard>
                    ) : null}
                </DragOverlay>
            </DndContext>

            {cardSortAllowUserCategories && (
                <div className={styles.cardSortUserCategorySection}>
                    <h5>Add New Category</h5>
                    <div className={styles.cardSortUserCategoryInputContainer}>
                        <input
                            type="text"
                            value={newUserCategoryName}
                            onChange={(e) => setNewUserCategoryName(e.target.value)}
                            placeholder="New category name"
                            className={`${styles.textInput} ${styles.cardSortAddCategoryInput}`}
                            disabled={disabled}
                        />
                        <button
                            type="button"
                            onClick={handleAddUserCategory}
                            className={styles.cardSortAddCategoryButton}
                            disabled={!newUserCategoryName.trim() || disabled}
                        >
                            Add
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CardSortQuestion;
// ----- END OF COMPLETE MODIFIED FILE (v2.1 - Import Fix) -----