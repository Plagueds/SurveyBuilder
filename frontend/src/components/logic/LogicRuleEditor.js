// frontend/src/components/logic/LogicRuleEditor.js
// ----- START OF COMPLETE UPDATED FILE (v1.4 - Pass onOpenAreaManager) -----
import React from 'react';
import LogicGroupEditor from './LogicGroupEditor';
import LogicActionEditor from './LogicActionEditor';
import { LOGICAL_OPERATORS } from './logicConstants';

function LogicRuleEditor({
    rule,
    ruleIndex,
    onUpdateRule,
    onRemoveRule,
    sourceQuestionPool, 
    targetQuestionPool,
    styles,
    truncateText,
    getQuestionTypeLabel,
    ensureArray,
    onUpdateQuestionDefinition,
    onOpenAreaManager // +++ NEW PROP +++
}) {
    const handleRuleFieldChange = (field, value) => { onUpdateRule(ruleIndex, { ...rule, [field]: value }); };
    const addGroup = () => { const newGroup = { _id: `temp_group_${Date.now()}_${Math.random()}`, groupOperator: 'AND', conditions: [{ _id: `temp_cond_${Date.now()}_${Math.random()}`, sourceQuestionId: '', conditionOperator: 'eq', conditionValue: '' }] }; const currentGroups = ensureArray(rule.groups); onUpdateRule(ruleIndex, { ...rule, groups: [...currentGroups, newGroup] }); };
    const updateGroup = (groupIndex, updatedGroup) => { const updatedGroups = ensureArray(rule.groups).map((g, i) => i === groupIndex ? updatedGroup : g); onUpdateRule(ruleIndex, { ...rule, groups: updatedGroups }); };
    const removeGroup = (groupIndex) => { const updatedGroups = ensureArray(rule.groups).filter((_, i) => i !== groupIndex); onUpdateRule(ruleIndex, { ...rule, groups: updatedGroups }); };
    const handleActionUpdate = (updatedAction) => { onUpdateRule(ruleIndex, { ...rule, action: updatedAction }); };

    const availableSourceQuestions = sourceQuestionPool || [];
    const availableTargetQuestions = targetQuestionPool || [];
    const ruleGroups = ensureArray(rule.groups);

    return (
        <div className={styles.logicRuleEditor}>
            <div className={styles.logicRuleHeader}><input type="text" placeholder={`Rule ${ruleIndex + 1} Name (optional)`} value={rule.ruleName || ''} onChange={(e) => handleRuleFieldChange('ruleName', e.target.value)} className={`${styles.formControl} ${styles.logicRuleNameInput}`} title="Give this rule an optional name for easier identification" /><button type="button" onClick={() => onRemoveRule(ruleIndex)} className="button button-danger" title="Remove this entire logic rule" > Remove Rule </button></div>
            <h4>If the following is true:</h4>
            <div className={styles.logicRuleConditionSection}>
                {ruleGroups.map((group, groupIdx) => (
                     <React.Fragment key={group._id || groupIdx}>
                        {groupIdx > 0 && ruleGroups.length > 1 && ( <div className={styles.logicOverallOperator}><select value={rule.overallOperator || 'AND'} onChange={(e) => handleRuleFieldChange('overallOperator', e.target.value)} className={styles.formControlSmall} title={`Combine with previous group using ${rule.overallOperator || 'AND'}`} > {LOGICAL_OPERATORS.map(op => (<option key={op.value} value={op.value}>{op.label}</option>))} </select></div> )}
                        <LogicGroupEditor
                            group={group}
                            groupIndex={groupIdx}
                            onUpdateGroup={updateGroup}
                            onRemoveGroup={removeGroup}
                            availableSourceQuestions={availableSourceQuestions}
                            allQuestions={sourceQuestionPool} 
                            styles={styles}
                            truncateText={truncateText}
                            getQuestionTypeLabel={getQuestionTypeLabel}
                            ensureArray={ensureArray}
                            onUpdateQuestionDefinition={onUpdateQuestionDefinition}
                            onOpenAreaManager={onOpenAreaManager} // +++ PASS DOWN +++
                        />
                    </React.Fragment>
                ))}
                <button type="button" onClick={addGroup} className={`button button-secondary ${styles.logicAddButton} ${styles.addGroupButton}`} > + Add Condition Group </button>{ruleGroups.length === 0 && <p className={styles.textMuted || "text-muted"}>This rule needs at least one condition group.</p>}
            </div>
            <hr className={styles.logicDivider || "logic-divider"} /><LogicActionEditor action={rule.action} onUpdateAction={handleActionUpdate} availableTargetQuestions={availableTargetQuestions} styles={styles} truncateText={truncateText} getQuestionTypeLabel={getQuestionTypeLabel} />
        </div>
    );
}
export default LogicRuleEditor;
// ----- END OF COMPLETE UPDATED FILE (v1.4 - Pass onOpenAreaManager) -----