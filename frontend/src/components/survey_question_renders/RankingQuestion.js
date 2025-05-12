// frontend/src/components/survey_question_renders/RankingQuestion.js
// ----- START OF COMPLETE MODIFIED FILE (v1.1 - Added type="button") -----
import React, { useState, useEffect } from 'react';
import styles from './SurveyQuestionStyles.module.css'; // Assuming you've applied styles

const RankingQuestion = ({ question, currentAnswer, onAnswerChange, isPreviewMode }) => {
    const { _id: questionId, text, options = [], description } = question;

    const getInitialItems = () => {
        if (Array.isArray(currentAnswer) && currentAnswer.length > 0 && currentAnswer.every(item => options.includes(item))) {
            // Ensure all items in currentAnswer are valid options and maintain their order
            // Also, ensure all original options are present, adding unranked ones at the end
            const rankedSet = new Set(currentAnswer);
            const unrankedOptions = options.filter(opt => !rankedSet.has(opt));
            return [...currentAnswer, ...unrankedOptions];
        }
        return [...options]; // Default order
    };

    const [rankedItems, setRankedItems] = useState(getInitialItems());

    useEffect(() => {
        setRankedItems(getInitialItems());
    }, [currentAnswer, JSON.stringify(options)]); // Add options to dependency array

    const moveItem = (index, direction) => {
        const newItems = [...rankedItems];
        const item = newItems[index];
        const newIndex = index + direction;

        if (newIndex < 0 || newIndex >= newItems.length) return;

        newItems.splice(index, 1);
        newItems.splice(newIndex, 0, item);

        setRankedItems(newItems);
        onAnswerChange(questionId, newItems);
    };

    if (!options || options.length === 0) {
        return (
            <div className={styles.questionContainer}>
                <h4 className={styles.questionText}>{text}</h4>
                <p className={styles.questionDescription}>No options available for ranking.</p>
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
            <p className={styles.questionDescription}><small>(Click buttons to reorder. 1 is highest rank.)</small></p>
            <ul className={styles.rankingList}>
                {rankedItems.map((item, index) => (
                    <li key={`${questionId}-item-${item}-${index}`} className={styles.rankingItem}> {/* More unique key */}
                        <span className={styles.rankingItemText}>{index + 1}. {item}</span>
                        <div className={styles.rankingControls}>
                            <button
                                type="button" // PREVENTS FORM SUBMISSION
                                onClick={() => moveItem(index, -1)}
                                disabled={index === 0}
                                className={styles.rankingButton}
                                title={`Move ${item} up`}
                            >
                                ↑
                            </button>
                            <button
                                type="button" // PREVENTS FORM SUBMISSION
                                onClick={() => moveItem(index, 1)}
                                disabled={index === rankedItems.length - 1}
                                className={styles.rankingButton}
                                title={`Move ${item} down`}
                            >
                                ↓
                            </button>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default RankingQuestion;
// ----- END OF COMPLETE MODIFIED FILE (v1.1) -----