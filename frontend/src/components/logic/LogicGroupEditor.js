// frontend/src/components/logic/LogicGroupEditor.js
// ----- START OF UPDATED FILE (v1.3 - Pass onOpenAreaManager) -----
import React from 'react';
import LogicConditionEditor from './LogicConditionEditor';
import { LOGICAL_OPERATORS } from './logicConstants';

function LogicGroupEditor({
    group,
    groupIndex,
    onUpdateGroup,
    onRemoveGroup,
    availableSourceQuestions,
    allQuestions,
    styles,
    truncateText,
    getQuestionTypeLabel,
    ensureArray,
    onUpdateQuestionDefinition,
    onOpenAreaManager // +++ NEW PROP: Accept onOpenAreaManager +++
}) {
    const handleGroupOperatorChange = (e) => {
        onUpdateGroup(groupIndex, { ...group, groupOperator: e.target.value });
    };

    const addCondition = () => {
        const newCondition = { _id: `temp_cond_group${groupIndex}_${Date.now()}`, sourceQuestionId: '', conditionOperator: 'eq', conditionValue: '' };
        const currentConditions = ensureArray(group.conditions);
        onUpdateGroup(groupIndex, { ...group, conditions: [...currentConditions, newCondition] });
    };

    const updateCondition = (conditionIndex, updatedCondition) => {
        const updatedConditions = ensureArray(group.conditions).map((c, i) => i === conditionIndex ? updatedCondition : c);
        onUpdateGroup(groupIndex, { ...group, conditions: updatedConditions });
    };

    const removeCondition = (conditionIndex) => {
        const updatedConditions = ensureArray(group.conditions).filter((_, i) => i !== conditionIndex);
        onUpdateGroup(groupIndex, { ...group, conditions: updatedConditions });
    };

    const groupConditions = ensureArray(group.conditions);

    return (
        <div className={styles.logicGroupEditor}>
            <div className={styles.logicGroupHeader}>
                <span className={styles.logicGroupLabel}>Group {groupIndex + 1}</span>
                <button
                    type="button"
                    onClick={() => onRemoveGroup(groupIndex)}
                    className={`button button-danger button-small ${styles.logicRemoveButton}`}
                    title="Remove this entire group"
                >
                    &times;
                </button>
            </div>
            <div className={styles.logicConditionsContainer}>
                {groupConditions.map((condition, condIdx) => (
                    <React.Fragment key={condition._id || condIdx}>
                        {condIdx > 0 && groupConditions.length > 1 && (
                            <div className={styles.logicIntraGroupOperatorContainer}>
                                <select
                                    value={group.groupOperator || 'AND'}
                                    onChange={handleGroupOperatorChange}
                                    className={styles.formControlSmall}
                                    title={`Combine with previous condition using ${group.groupOperator || 'AND'}`}
                                >
                                    {LOGICAL_OPERATORS.map(op => (
                                        <option key={op.value} value={op.value}>{op.label}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <LogicConditionEditor
                            condition={condition}
                            conditionIndex={condIdx}
                            onUpdateCondition={updateCondition}
                            onRemoveCondition={removeCondition}
                            availableSourceQuestions={availableSourceQuestions}
                            allQuestions={allQuestions}
                            styles={styles}
                            truncateText={truncateText}
                            getQuestionTypeLabel={getQuestionTypeLabel}
                            ensureArray={ensureArray}
                            onUpdateQuestionDefinition={onUpdateQuestionDefinition}
                            onOpenAreaManager={onOpenAreaManager} // +++ PASS THE PROP DOWN +++
                        />
                    </React.Fragment>
                ))}
            </div>
            <button
                type="button"
                onClick={addCondition}
                className={`button button-secondary button-small ${styles.logicAddButton}`}
            >
                + Add Condition
            </button>
            {groupConditions.length === 0 && <p className={styles.textMuted || "text-muted"}>This group needs at least one condition.</p>}
        </div>
    );
}

export default LogicGroupEditor;
// ----- END OF UPDATED FILE (v1.3 - Pass onOpenAreaManager) -----