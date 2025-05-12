// frontend/src/components/survey_question_renders/CardSortQuestion.js
import React, { useState, useEffect } from 'react';

const UNASSIGNED_CATEGORY_ID = '__UNASSIGNED__';

const CardSortQuestion = ({ question, currentAnswer, onAnswerChange }) => {
    const {
        _id: questionId,
        text,
        options: cards = [], // options are the cards
        cardSortCategories: predefinedCategories = [],
        cardSortAllowUserCategories = true
    } = question;

    // currentAnswer = { assignments: { cardId: categoryId, ... }, userCategories: [{id, name}, ...] }
    const initialAssignments = currentAnswer?.assignments || {};
    const initialUserCategories = Array.isArray(currentAnswer?.userCategories) ? currentAnswer.userCategories : [];

    const [assignments, setAssignments] = useState(initialAssignments); // { cardId: categoryId }
    const [userCategories, setUserCategories] = useState(initialUserCategories); // [{ id, name }]
    const [newUserCategoryName, setNewUserCategoryName] = useState('');

    useEffect(() => {
        setAssignments(currentAnswer?.assignments || {});
        setUserCategories(Array.isArray(currentAnswer?.userCategories) ? currentAnswer.userCategories : []);
    }, [currentAnswer]);

    const allCategories = [
        { id: UNASSIGNED_CATEGORY_ID, name: 'Unassigned Cards' },
        ...predefinedCategories.map(name => ({ id: name, name })), // Predefined categories use their name as ID for simplicity here
        ...userCategories
    ];

    const handleCardDrop = (card, categoryId) => {
        const newAssignments = { ...assignments, [card]: categoryId };
        setAssignments(newAssignments);
        onAnswerChange(questionId, { assignments: newAssignments, userCategories });
    };

    const handleAddUserCategory = () => {
        if (newUserCategoryName.trim() && cardSortAllowUserCategories) {
            const newCategory = { id: `user_${Date.now()}_${newUserCategoryName.trim()}`, name: newUserCategoryName.trim() };
            const updatedUserCategories = [...userCategories, newCategory];
            setUserCategories(updatedUserCategories);
            setNewUserCategoryName('');
            // Note: onAnswerChange is called by handleCardDrop, or could be called here if needed immediately
            // onAnswerChange(questionId, { assignments, userCategories: updatedUserCategories });
        }
    };
    
    const handleRemoveUserCategory = (categoryIdToRemove) => {
        if (!window.confirm("Are you sure you want to remove this category and reassign its cards?")) return;

        const updatedUserCategories = userCategories.filter(cat => cat.id !== categoryIdToRemove);
        setUserCategories(updatedUserCategories);

        // Reassign cards from the removed category to "Unassigned"
        const newAssignments = { ...assignments };
        let changed = false;
        Object.keys(newAssignments).forEach(cardId => {
            if (newAssignments[cardId] === categoryIdToRemove) {
                newAssignments[cardId] = UNASSIGNED_CATEGORY_ID;
                changed = true;
            }
        });
        if (changed) {
            setAssignments(newAssignments);
        }
        onAnswerChange(questionId, { assignments: newAssignments, userCategories: updatedUserCategories });
    };


    const styles = {
        container: { margin: '15px 0', padding: '10px', border: '1px solid #eee', borderRadius: '5px', backgroundColor: '#f9f9f9' },
        title: { margin: '0 0 10px 0', fontSize: '1.1em' },
        layout: { display: 'flex', gap: '20px', flexWrap: 'wrap' },
        categoryColumn: { flex: '1', minWidth: '200px', padding: '10px', border: '1px dashed #ccc', borderRadius: '4px', backgroundColor: 'white' },
        categoryTitle: { fontWeight: 'bold', marginBottom: '10px', borderBottom: '1px solid #eee', paddingBottom: '5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
        card: { padding: '8px', margin: '5px 0', border: '1px solid #b0b0b0', borderRadius: '4px', backgroundColor: '#f0f8ff', cursor: 'grab', textAlign: 'center' },
        userCategoryInput: { display: 'flex', gap: '5px', marginTop: '10px' },
        input: { flexGrow: 1, padding: '5px' },
        button: { padding: '5px 10px', cursor: 'pointer' },
        removeCatButton: { fontSize: '0.8em', color: 'red', cursor: 'pointer', border: 'none', background: 'none', padding: '0 5px'},
    };

    if (!cards || cards.length === 0) {
        return (
            <div style={styles.container}>
                <h4 style={styles.title}>{text}</h4>
                <p>No cards available for sorting.</p>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            <h4 style={styles.title}>{text}</h4>
            <p style={{fontSize: '0.9em', color: '#555'}}>Drag cards to categories (drag-and-drop not implemented in this basic version - use dropdowns per card).</p>
            <div style={styles.layout}>
                {allCategories.map(category => (
                    <div key={category.id} style={styles.categoryColumn}
                        // Basic drag-over/drop handlers (would need more for actual D&D)
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                            e.preventDefault();
                            const cardToMove = e.dataTransfer.getData("text/plain");
                            if (cardToMove) handleCardDrop(cardToMove, category.id);
                        }}
                    >
                        <h5 style={styles.categoryTitle}>
                            {category.name}
                            {category.id.startsWith('user_') && cardSortAllowUserCategories && (
                                <button onClick={() => handleRemoveUserCategory(category.id)} style={styles.removeCatButton} title="Remove category">&times;</button>
                            )}
                        </h5>
                        {cards.filter(card => assignments[card] === category.id || (category.id === UNASSIGNED_CATEGORY_ID && !assignments[card])).map(card => (
                            <div
                                key={card}
                                style={styles.card}
                                draggable // Make cards draggable
                                onDragStart={(e) => e.dataTransfer.setData("text/plain", card)}
                            >
                                {card}
                                {/* Simplified: Dropdown to move card */}
                                <select
                                    value={assignments[card] || UNASSIGNED_CATEGORY_ID}
                                    onChange={(e) => handleCardDrop(card, e.target.value)}
                                    style={{ display: 'block', marginTop: '5px', width: '100%' }}
                                >
                                    {allCategories.map(cat => (
                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                    ))}
                                </select>
                            </div>
                        ))}
                        {cards.filter(card => assignments[card] === category.id || (category.id === UNASSIGNED_CATEGORY_ID && !assignments[card])).length === 0 && (
                            <p style={{fontSize: '0.8em', color: '#888', textAlign: 'center'}}>(Empty)</p>
                        )}
                    </div>
                ))}
            </div>
            {cardSortAllowUserCategories && (
                <div style={{marginTop: '20px', paddingTop: '10px', borderTop: '1px solid #eee'}}>
                    <h5>Add New Category</h5>
                    <div style={styles.userCategoryInput}>
                        <input
                            type="text"
                            value={newUserCategoryName}
                            onChange={(e) => setNewUserCategoryName(e.target.value)}
                            placeholder="New category name"
                            style={styles.input}
                        />
                        <button onClick={handleAddUserCategory} style={styles.button} disabled={!newUserCategoryName.trim()}>Add</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CardSortQuestion;