// frontend/src/components/QuestionListItem.js
// ----- START OF COMPLETE MODIFIED FILE (v1.1 - Enhanced Display) -----
import React from 'react';
import { useDrag, useDrop } from 'react-dnd';
import styles from './QuestionListItem.module.css';

const ItemTypes = {
    QUESTION: 'question',
};

const QuestionListItem = ({ question, index, isSelected, onClick, onDelete, onMove }) => {
    const ref = React.useRef(null);

    const [, drop] = useDrop({
        accept: ItemTypes.QUESTION,
        hover(item, monitor) {
            if (!ref.current) return;
            const dragIndex = item.index;
            const hoverIndex = index;
            if (dragIndex === hoverIndex) return;
            const hoverBoundingRect = ref.current?.getBoundingClientRect();
            const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
            const clientOffset = monitor.getClientOffset();
            const hoverClientY = clientOffset.y - hoverBoundingRect.top;
            if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) return;
            if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) return;
            onMove(dragIndex, hoverIndex);
            item.index = hoverIndex;
        },
    });

    const [{ isDragging }, drag] = useDrag({
        type: ItemTypes.QUESTION,
        item: () => ({ id: question._id, index }),
        collect: (monitor) => ({
            isDragging: monitor.isDragging(),
        }),
    });

    drag(drop(ref));

    const isRequired = question.requiredSetting === 'required' || question.requiredSetting === 'soft_required';
    // Basic check for logic: assumes skipLogic is an array on the question object
    // or you might have a more complex way to determine if logic is applied.
    // For now, checking if skipLogic array exists and has entries.
    const hasLogic = Array.isArray(question.skipLogic) && question.skipLogic.length > 0;

    return (
        <div
            ref={ref}
            className={`${styles.questionListItem} ${isSelected ? styles.selected : ''} ${isDragging ? styles.dragging : ''}`}
            onClick={onClick}
            role="button"
            tabIndex={0}
            onKeyPress={(e) => e.key === 'Enter' && onClick()}
            aria-label={`Question ${index + 1}: ${question.text}`}
        >
            <div className={styles.questionOrderHandle} aria-hidden="true">
                {index + 1}
            </div>
            <div className={styles.questionMainContent}>
                <div className={styles.questionTextPreview}>{question.text || 'Untitled Question'}</div>
                <div className={styles.questionMeta}>
                    <span className={`${styles.metaItem} ${styles.questionTypeBadge}`}>{question.type || 'N/A'}</span>
                    <span className={`${styles.metaItem} ${styles.questionId}`}>ID: {question._id}</span>
                    {isRequired && (
                        <span className={`${styles.metaItem} ${styles.requiredIndicator}`}>
                            {question.requiredSetting === 'required' ? 'Required' : 'Soft Req.'}
                        </span>
                    )}
                    {hasLogic && (
                        <span className={`${styles.metaItem} ${styles.logicIndicator}`}>Logic Applied</span>
                    )}
                </div>
            </div>
            <div className={styles.questionActions}>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete();
                    }}
                    className={`${styles.actionButton} ${styles.deleteButton}`}
                    title="Delete Question"
                    aria-label="Delete question"
                >
                    🗑️
                </button>
            </div>
        </div>
    );
};

export default QuestionListItem;
// ----- END OF COMPLETE MODIFIED FILE (v1.1) -----