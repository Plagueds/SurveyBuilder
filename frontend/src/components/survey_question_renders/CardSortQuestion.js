// frontend/src/components/survey_question_renders/CardSortQuestion.js
// ----- START OF COMPLETE MODIFIED FILE (v2.3 - Simpler DND for Card to Category) -----
import React, { useState, useEffect, useMemo } from 'react';
import {
    DndContext,
    DragOverlay,
    PointerSensor,
    KeyboardSensor,
    useSensor,
    useSensors,
    closestCorners,
    useDraggable,
    useDroppable,
} from '@dnd-kit/core';
// Removed SortableContext and related imports as we simplify to basic drag/drop
import { CSS } from '@dnd-kit/utilities';
import styles from './SurveyQuestionStyles.module.css';

const UNASSIGNED_CATEGORY_ID = '__UNASSIGNED_CARDS__'; // Made more specific

// --- Draggable Card Component ---
function Card({ id, children, isActuallyDragging, isOverlay }) {
    const { attributes, listeners, setNodeRef, transform, active } = useDraggable({
        id: id,
    });
    const isBeingDragged = active?.id === id;

    const style = {
        opacity: isBeingDragged && !isOverlay ? 0.5 : 1,
        cursor: isOverlay ? 'grabbing' : (isActuallyDragging ? 'grabbing' : 'grab'),
        ...(isOverlay && transform ? { transform: CSS.Translate.toString(transform) } : {}),
        touchAction: 'none', // Important for touch devices
    };

    return (
        <div ref={setNodeRef} style={style} {...listeners} {...attributes}
             className={`${styles.cardSortCard} ${isOverlay ? styles.cardSortCardOverlay : ''} ${isBeingDragged && !isOverlay ? styles.cardSortCardIsDraggingSource : ''}`}>
            {children}
        </div>
    );
}

// --- Droppable Category Column Component ---
function CategoryColumn({ id, title, children, onRemoveCategory, allowUserCategories }) {
    const { isOver, setNodeRef } = useDroppable({ id });

    return (
        <div
            ref={setNodeRef}
            className={`${styles.cardSortCategoryColumn} ${isOver ? styles.cardSortCategoryColumnOver : ''}`}
        >
            <h5 className={styles.cardSortCategoryTitle}>
                {title}
                {id.startsWith('usercat_') && allowUserCategories && onRemoveCategory && (
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
                {/* No SortableContext here for simplicity, just render children */}
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

    // Ensure card IDs are unique and robust
    const initialCards = useMemo(() =>
        cardsFromProps.map((cardText, index) => ({
            id: `card_${questionId}_${index}_${String(cardText).replace(/\W/g, '_')}`, // More robust ID
            text: String(cardText)
        })), [cardsFromProps, questionId]);

    const initialPredefinedCategories = useMemo(() =>
        predefinedCategoriesFromProps.map((name, index) => ({
            id: `predefinedcat_${questionId}_${index}_${String(name).replace(/\W/g, '_')}`, // More robust ID
            name: String(name)
        })), [predefinedCategoriesFromProps, questionId]);

    const [userCategories, setUserCategories] = useState([]);
    const [assignments, setAssignments] = useState({}); // cardId: categoryId
    const [newUserCategoryName, setNewUserCategoryName] = useState('');
    const [activeDraggableId, setActiveDraggableId] = useState(null);

    useEffect(() => {
        const savedAssignments = currentAnswer?.assignments || {};
        const savedUserCategories = Array.isArray(currentAnswer?.userCategories) ? currentAnswer.userCategories : [];
        
        setAssignments(savedAssignments);
        setUserCategories(savedUserCategories.map((cat, index) => ({
            id: cat.id || `usercat_${questionId}_${Date.now()}_${index}`, // Ensure unique ID
            name: String(cat.name)
        })));
    }, [currentAnswer, questionId]);


    const allCategoryObjects = useMemo(() => [
        { id: UNASSIGNED_CATEGORY_ID, name: 'Unassigned Cards' },
        ...initialPredefinedCategories,
        ...userCategories
    ], [initialPredefinedCategories, userCategories]);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor)
    );

    const handleDragStart = (event) => {
        if (disabled) return;
        setActiveDraggableId(event.active.id);
    };

    const handleDragEnd = (event) => {
        if (disabled) return;
        setActiveDraggableId(null);
        const { active, over } = event;

        if (active && over) {
            const cardId = active.id;
            const targetCategoryId = over.id;

            const isValidCategoryTarget = allCategoryObjects.some(cat => cat.id === targetCategoryId);

            if (isValidCategoryTarget && assignments[cardId] !== targetCategoryId) {
                const newAssignments = { ...assignments, [cardId]: targetCategoryId };
                setAssignments(newAssignments);
                if (typeof onAnswerChange === 'function') {
                    onAnswerChange(questionId, { assignments: newAssignments, userCategories });
                }
            }
        } else if (active && !over) {
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
            id: `usercat_${questionId}_${Date.now()}_${newUserCategoryName.trim().replace(/\W/g, '_')}`,
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

    const activeCardForOverlay = activeDraggableId ? initialCards.find(c => c.id === activeDraggableId) : null;

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
                collisionDetection={closestCorners} // closestCenter might also work well
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >
                <div className={styles.cardSortLayout}>
                    {allCategoryObjects.map(category => (
                        <CategoryColumn
                            key={category.id}
                            id={category.id}
                            title={category.name}
                            onRemoveCategory={handleRemoveUserCategory}
                            allowUserCategories={cardSortAllowUserCategories}
                        >
                            {initialCards
                                .filter(card => (assignments[card.id] || UNASSIGNED_CATEGORY_ID) === category.id)
                                .map(card => (
                                    <Card key={card.id} id={card.id} isActuallyDragging={activeDraggableId === card.id}>
                                        {card.text}
                                    </Card>
                                ))}
                        </CategoryColumn>
                    ))}
                </div>
                <DragOverlay dropAnimation={null}>
                    {activeDraggableId && activeCardForOverlay ? (
                        <Card id={activeCardForOverlay.id} isOverlay isActuallyDragging>
                            {activeCardForOverlay.text}
                        </Card>
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
// ----- END OF COMPLETE MODIFIED FILE (v2.3 - Simpler DND for Card to Category) -----