// frontend/src/components/survey_question_renders/CardSortQuestion.js
// ----- START OF COMPLETE MODIFIED FILE (v1.1 - Added type="button") -----
import React, { useState, useEffect } from 'react';
import styles from './SurveyQuestionStyles.module.css'; // Assuming you've applied styles

const UNASSIGNED_CATEGORY_ID = '__UNASSIGNED__';

const CardSortQuestion = ({ question, currentAnswer, onAnswerChange, isPreviewMode }) => {
    const {
        _id: questionId,
        text,
        options: cards = [],
        cardSortCategories: predefinedCategories = [],
        cardSortAllowUserCategories = true,
        description
    } = question;

    const initialAssignments = currentAnswer?.assignments || {};
    const initialUserCategories = Array.isArray(currentAnswer?.userCategories) ? currentAnswer.userCategories : [];

    const [assignments, setAssignments] = useState(initialAssignments);
    const [userCategories, setUserCategories] = useState(initialUserCategories);
    const [newUserCategoryName, setNewUserCategoryName] = useState('');

    useEffect(() => {
        setAssignments(currentAnswer?.assignments || {});
        setUserCategories(Array.isArray(currentAnswer?.userCategories) ? currentAnswer.userCategories : []);
    }, [currentAnswer]);

    const allCategories = [
        { id: UNASSIGNED_CATEGORY_ID, name: 'Unassigned Cards' },
        ...predefinedCategories.map(name => ({ id: `predefined_${name.replace(/\s+/g, '_')}`, name })), // Make predefined IDs more robust
        ...userCategories
    ];

    const handleCardDrop = (card, categoryId) => {
        const newAssignments = { ...assignments, [card]: categoryId };
        setAssignments(newAssignments);
        onAnswerChange(questionId, { assignments: newAssignments, userCategories });
    };

    const handleAddUserCategory = () => {
        if (newUserCategoryName.trim() && cardSortAllowUserCategories) {
            const newCategory = { id: `user_${Date.now()}_${newUserCategoryName.trim().replace(/\s+/g, '_')}`, name: newUserCategoryName.trim() };
            const updatedUserCategories = [...userCategories, newCategory];
            setUserCategories(updatedUserCategories);
            setNewUserCategoryName('');
            // Update parent state immediately when a category is added, even if no cards are assigned yet
            onAnswerChange(questionId, { assignments, userCategories: updatedUserCategories });
        }
    };
    
    const handleRemoveUserCategory = (categoryIdToRemove) => {
        if (!window.confirm("Are you sure you want to remove this category and reassign its cards to 'Unassigned'?")) return;

        const updatedUserCategories = userCategories.filter(cat => cat.id !== categoryIdToRemove);
        setUserCategories(updatedUserCategories);

        const newAssignments = { ...assignments };
        let changed = false;
        Object.keys(newAssignments).forEach(cardKey => { // Use cardKey to avoid conflict with card variable in outer scope
            if (newAssignments[cardKey] === categoryIdToRemove) {
                newAssignments[cardKey] = UNASSIGNED_CATEGORY_ID;
                changed = true;
            }
        });
        if (changed) {
            setAssignments(newAssignments);
        }
        onAnswerChange(questionId, { assignments: newAssignments, userCategories: updatedUserCategories });
    };

    if (!cards || cards.length === 0) {
        return (
            <div className={styles.questionContainer}>
                <h4 className={styles.questionText}>{text}</h4>
                <p className={styles.questionDescription}>No cards available for sorting.</p>
            </div>
        );
    }

    return (
        <div className={styles.questionContainer}>
            <h4 className={styles.questionText}>
                {text}
                {question.requiredSetting === 'required' && !isPreviewMode && <span className={styles.requiredIndicator}>*</span>}
            </h4>
            {description && <p className={styles.questionDescription}>{description}</p>}
            <p className={styles.questionDescription}><small>(Drag cards to categories or use the dropdown on each card. Drag-and-drop is a basic implementation for preview.)</small></p>
            
            <div className={styles.cardSortLayout}>
                {allCategories.map(category => (
                    <div 
                        key={category.id} 
                        className={styles.cardSortCategoryColumn}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                            e.preventDefault();
                            const cardToMove = e.dataTransfer.getData("text/plain");
                            if (cardToMove && cards.includes(cardToMove)) { // Ensure the dragged item is a valid card
                                handleCardDrop(cardToMove, category.id);
                            }
                        }}
                    >
                        <h5 className={styles.cardSortCategoryTitle}>
                            {category.name}
                            {category.id.startsWith('user_') && cardSortAllowUserCategories && (
                                <button 
                                    type="button" // PREVENTS FORM SUBMISSION
                                    onClick={() => handleRemoveUserCategory(category.id)} 
                                    className={styles.cardSortRemoveCategoryButton} 
                                    title="Remove category"
                                >
                                    &times;
                                </button>
                            )}
                        </h5>
                        {cards.filter(card => assignments[card] === category.id || (category.id === UNASSIGNED_CATEGORY_ID && (!assignments[card] || assignments[card] === UNASSIGNED_CATEGORY_ID))).map(card => (
                            <div
                                key={`${questionId}-card-${card}`} // More unique key
                                className={styles.cardSortCard}
                                draggable
                                onDragStart={(e) => e.dataTransfer.setData("text/plain", card)}
                            >
                                {card}
                                <select
                                    value={assignments[card] || UNASSIGNED_CATEGORY_ID}
                                    onChange={(e) => handleCardDrop(card, e.target.value)}
                                    className={styles.cardSortCardSelect}
                                >
                                    {allCategories.map(cat => (
                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                    ))}
                                </select>
                            </div>
                        ))}
                        {cards.filter(card => assignments[card] === category.id || (category.id === UNASSIGNED_CATEGORY_ID && (!assignments[card] || assignments[card] === UNASSIGNED_CATEGORY_ID))).length === 0 && (
                            <p style={{fontSize: '0.8em', color: '#888', textAlign: 'center'}}>(Empty)</p>
                        )}
                    </div>
                ))}
            </div>

            {cardSortAllowUserCategories && (
                <div className={styles.cardSortUserCategorySection}>
                    <h5>Add New Category</h5>
                    <div className={styles.cardSortUserCategoryInputContainer}>
                        <input
                            type="text"
                            value={newUserCategoryName}
                            onChange={(e) => setNewUserCategoryName(e.target.value)}
                            placeholder="New category name"
                            className={`${styles.textInput} ${styles.cardSortAddCategoryInput}`} // Reusing textInput style
                        />
                        <button 
                            type="button" // PREVENTS FORM SUBMISSION
                            onClick={handleAddUserCategory} 
                            className={styles.cardSortAddCategoryButton} 
                            disabled={!newUserCategoryName.trim()}
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
// ----- END OF COMPLETE MODIFIED FILE (v1.1) -----