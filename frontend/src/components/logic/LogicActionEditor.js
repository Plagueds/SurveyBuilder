// frontend/src/components/logic/LogicActionEditor.js
import React from 'react';
import { ACTION_TYPES } from './logicConstants';

// Assuming truncateText and getQuestionTypeLabel are passed or imported
// const truncateText = (text, maxLength = 30) => { /* ... */ };
// const getQuestionTypeLabel = (typeValue) => { /* ... */ };

function LogicActionEditor({
    action,
    onUpdateAction,
    availableTargetQuestions, // All questions *except* the current one
    styles,
    // Pass helper functions as props
    truncateText,
    getQuestionTypeLabel
}) {
    const handleActionChange = (field, value) => {
        let newAction = { ...action, [field]: value };
        // Reset targetQuestionId if action type doesn't need it
        if (field === 'type' && value !== 'skipToQuestion' && value !== 'hideQuestion') {
            newAction.targetQuestionId = ''; // Reset target
        }
        // Reset message if type is not disqualify
        if (field === 'type' && value !== 'disqualifyRespondent') {
            // Keep existing message? Or reset? Let's reset for clarity.
             newAction.disqualificationMessage = '';
        } else if (field === 'type' && value === 'disqualifyRespondent' && !newAction.disqualificationMessage) {
             // Set default message if switching to disqualify and message is empty
             newAction.disqualificationMessage = 'You do not qualify for this survey based on your responses.';
        }

        onUpdateAction(newAction);
    };

    const showTargetQuestion = action.type === 'skipToQuestion' || action.type === 'hideQuestion';
    const showDisqualifyMessage = action.type === 'disqualifyRespondent';

    return (
        <div className={styles.logicActionEditor}>
            <h4>Then perform this action:</h4>
            <div className={styles.logicActionControls}>
                <select
                    value={action.type || ''}
                    onChange={(e) => handleActionChange('type', e.target.value)}
                    className={styles.formControl}
                    title="Select the action to perform if conditions are met"
                >
                    <option value="">-- Select Action --</option>
                    {ACTION_TYPES.map(act => (
                        <option key={act.value} value={act.value}>{act.label}</option>
                    ))}
                </select>

                {showTargetQuestion && (
                    <select
                        value={action.targetQuestionId || ''}
                        onChange={(e) => handleActionChange('targetQuestionId', e.target.value)}
                        className={styles.formControl}
                        title="Select the question to skip to or hide"
                    >
                        <option value="">-- Select Target Question --</option>
                        {availableTargetQuestions.map((q, idx) => (
                            // Use full index from allQuestions if available and meaningful, otherwise just list them
                            <option key={q._id} value={q._id}>
                                {idx + 1}. {truncateText(q.text, 50)} ({getQuestionTypeLabel(q.type)})
                            </option>
                        ))}
                        {availableTargetQuestions.length === 0 && <option disabled>No other questions available</option>}
                    </select>
                )}
            </div>

            {showDisqualifyMessage && (
                <textarea
                    placeholder="Disqualification Message (optional)"
                    value={action.disqualificationMessage || ''}
                    onChange={(e) => handleActionChange('disqualificationMessage', e.target.value)}
                    className={styles.formControl}
                    rows="2"
                    title="Message shown to disqualified respondents"
                />
            )}
        </div>
    );
}

export default LogicActionEditor;