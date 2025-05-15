// frontend/src/components/SurveyLogicPanel.js
// ----- START OF COMPLETE MODIFIED FILE (v1.4 - Pass onOpenAreaManager) -----
import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import styles from './SurveyLogicPanel.module.css';
import LogicRuleEditor from './logic/LogicRuleEditor';

const getQuestionTypeLabel = (typeValue) => { const typeMap = { 'text': 'Single-Line Text', 'textarea': 'Multi-Line Text', 'multiple-choice': 'Multiple Choice', 'checkbox': 'Checkbox', 'dropdown': 'Dropdown', 'rating': 'Rating (1-5)', 'nps': 'NPS (0-10)', 'matrix': 'Matrix / Grid', 'slider': 'Slider', 'ranking': 'Ranking Order', 'heatmap': 'Image Heatmap', 'maxdiff': 'MaxDiff (Best/Worst)', 'conjoint': 'Conjoint Task', 'cardsort': 'Card Sorting Task', }; return typeMap[typeValue] || typeValue; };
const ensureArray = (value) => (Array.isArray(value) ? value : (value === undefined || value === null ? [] : [value]));
const truncateText = (text, maxLength = 30) => { if (!text) return ''; if (text.length <= maxLength) return text; return text.substring(0, maxLength) + '...'; };

function SurveyLogicPanel({
    initialRules = [],
    allQuestions = [],
    onSaveRules,
    onClose,
    isLoading = false,
    surveyId,
    onUpdateQuestionDefinition,
    onOpenAreaManager // +++ NEW PROP +++
}) {
    const [localRules, setLocalRules] = useState([]);
    const [errors, setErrors] = useState({});

    useEffect(() => {
        const processedRules = ensureArray(initialRules).map((rule, ruleIdx) => ({
            ...rule,
            _id: rule._id || `temp_survey_rule_${Date.now()}_${ruleIdx}`,
            groups: ensureArray(rule.groups).map((group, groupIdx) => ({
                ...group,
                _id: group._id || `temp_survey_group_${Date.now()}_${ruleIdx}_${groupIdx}`,
                conditions: ensureArray(group.conditions).map((cond, condIdx) => ({
                    ...cond,
                    _id: cond._id || `temp_survey_cond_${Date.now()}_${ruleIdx}_${groupIdx}_${condIdx}`,
                }))
            }))
        }));
        setLocalRules(processedRules);
    }, [initialRules]);

    const handleLocalRulesChange = (updatedRules) => {
        setLocalRules(updatedRules);
        if (errors.globalSkipLogic) setErrors(prev => ({ ...prev, globalSkipLogic: null }));
    };

    const addNewLogicRule = () => {
        const newRule = {
            _id: `temp_survey_rule_${Date.now()}_${localRules.length}`,
            ruleName: `Survey Rule ${localRules.length + 1}`,
            overallOperator: 'AND',
            groups: [{
                _id: `temp_survey_group_${Date.now()}_${localRules.length}_0`,
                groupOperator: 'AND',
                conditions: [{
                    _id: `temp_survey_cond_${Date.now()}_${localRules.length}_0_0`,
                    sourceQuestionId: '', conditionOperator: 'eq', conditionValue: ''
                }]
            }],
            action: { type: '', targetQuestionId: '', disqualificationMessage: 'You do not qualify for this survey based on your responses.' }
        };
        handleLocalRulesChange([...localRules, newRule]);
    };

    const removeLogicRule = (ruleIndex) => {
        handleLocalRulesChange(localRules.filter((_, index) => index !== ruleIndex));
    };

    const updateLogicRule = (ruleIndex, updatedRuleData) => {
        handleLocalRulesChange(localRules.map((rule, index) => index === ruleIndex ? updatedRuleData : rule));
    };

    const removeAllLogicRules = () => {
        if (window.confirm("Are you sure you want to remove ALL survey-wide logic rules?")) {
            handleLocalRulesChange([]);
        }
    };
    
    const validateRules = useCallback((rulesToValidate) => { let ruleError = null; const allQuestionIdsSet = new Set(allQuestions.map(q => q._id)); ensureArray(rulesToValidate).forEach((rule, ruleIdx) => { if (ruleError) return; const ruleLabel = rule.ruleName ? `"${rule.ruleName}" (Rule ${ruleIdx + 1})` : `Survey Rule ${ruleIdx + 1}`; if (!rule.action?.type) { ruleError = `${ruleLabel}: Action type is required.`; return; } if ((rule.action.type === 'skipToQuestion' || rule.action.type === 'hideQuestion')) { if (!rule.action.targetQuestionId) { ruleError = `${ruleLabel}: Target question is required for action "${rule.action.type}".`; return; } if (!allQuestionIdsSet.has(rule.action.targetQuestionId)) { ruleError = `${ruleLabel}: Selected target question (ID: ${rule.action.targetQuestionId}) no longer exists.`; return; } } if (ensureArray(rule.groups).length === 0) { ruleError = `${ruleLabel}: At least one condition group is required.`; return; } ensureArray(rule.groups).forEach((group, groupIdx) => { if (ruleError) return; const groupLabel = `${ruleLabel}, Group ${groupIdx + 1}`; if (ensureArray(group.conditions).length === 0) { ruleError = `${groupLabel}: At least one condition is required.`; return; } ensureArray(group.conditions).forEach((condition, condIdx) => { if (ruleError) return; const condLabel = `${groupLabel}, Condition ${condIdx + 1}`; if (!condition.sourceQuestionId) { ruleError = `${condLabel}: Source question is required.`; return; } if (!allQuestionIdsSet.has(condition.sourceQuestionId)) { ruleError = `${condLabel}: Selected source question (ID: ${condition.sourceQuestionId}) no longer exists.`; return; } if ((rule.action.type === 'skipToQuestion' || rule.action.type === 'hideQuestion') && rule.action.targetQuestionId === condition.sourceQuestionId) { ruleError = `${condLabel}: Action cannot target a source question of this rule.`; return; } const needsValue = condition.conditionOperator !== 'isEmpty' && condition.conditionOperator !== 'isNotEmpty'; const valueIsMissing = condition.conditionValue === undefined || condition.conditionValue === null || String(condition.conditionValue).trim() === ''; const allowEmptyStringForComparison = ['eq', 'ne', 'contains', 'notContains'].includes(condition.conditionOperator) && (allQuestions.find(q => q._id === condition.sourceQuestionId)?.type === 'text' || allQuestions.find(q => q._id === condition.sourceQuestionId)?.type === 'textarea'); if (needsValue && valueIsMissing && !allowEmptyStringForComparison) { ruleError = `${condLabel}: Value is required for operator "${condition.conditionOperator}".`; return; } }); }); }); if (ruleError) { setErrors({ globalSkipLogic: ruleError }); return false; } setErrors({}); return true; }, [allQuestions]);

    const handleSaveAndClose = () => { 
        const rulesToSave = localRules.map(rule => { const { _id, ...restOfRule } = rule; const cleanedGroups = ensureArray(rule.groups).map(group => { const { _id: groupId, ...restOfGroup } = group; return { ...restOfGroup, conditions: ensureArray(group.conditions) .filter(cond => cond.sourceQuestionId) .map(cond => { const { _id: condId, ...restOfCond } = cond; let finalValue = restOfCond.conditionValue; if (['gt', 'gte', 'lt', 'lte'].includes(restOfCond.conditionOperator) || (allQuestions.find(q => q._id === restOfCond.sourceQuestionId)?.type === 'heatmap' && restOfCond.conditionOperator.startsWith('clickCount'))) { finalValue = (finalValue === '' || finalValue === null || finalValue === undefined || isNaN(Number(finalValue))) ? null : Number(finalValue); } else if (restOfCond.conditionOperator === 'isEmpty' || restOfCond.conditionOperator === 'isNotEmpty') { finalValue = undefined; } return { ...restOfCond, conditionValue: finalValue }; }) }; }).filter(group => ensureArray(group.conditions).length > 0); const cleanedAction = { type: rule.action?.type || '', targetQuestionId: (rule.action?.type === 'skipToQuestion' || rule.action?.type === 'hideQuestion') ? (rule.action?.targetQuestionId || undefined) : undefined, disqualificationMessage: rule.action?.type === 'disqualifyRespondent' ? (rule.action?.disqualificationMessage || 'You do not qualify for this survey based on your responses.') : undefined  }; if (cleanedAction.type !== 'skipToQuestion' && cleanedAction.type !== 'hideQuestion') { delete cleanedAction.targetQuestionId; } if (cleanedAction.type !== 'disqualifyRespondent') { delete cleanedAction.disqualificationMessage; } return { ...restOfRule, groups: cleanedGroups, action: cleanedAction }; }).filter(rule => ensureArray(rule.groups).length > 0 && rule.action?.type); 

        if (validateRules(rulesToSave)) {
            onSaveRules(rulesToSave);
        } else {
             toast.error("Please correct validation errors before saving logic rules.", { autoClose: 4000});
        }
    };

    const logicHelpers = { truncateText, getQuestionTypeLabel, ensureArray };

    return (
        <div className={styles.surveyLogicPanel}> 
            <div className={styles.panelHeader}>
                <h2>Survey-Wide Action Logic</h2>
                <button onClick={onClose} className={styles.closeButton} title="Close Panel">&times;</button>
            </div>
            <div className={styles.panelContent}>
                <p>Define conditional logic that applies to the entire survey flow. Rules are evaluated in order.</p>
                {errors.globalSkipLogic && (<div className={`${styles.invalidFeedback} ${styles.dBlock} ${styles.mb2}`}>{errors.globalSkipLogic}</div>)}
                <div className={styles.logicControls}>
                    <button type="button" onClick={addNewLogicRule} className="button button-primary" disabled={isLoading}>Add New Survey Logic Rule</button>
                    {localRules.length > 0 && (<button type="button" onClick={removeAllLogicRules} className="button button-danger" disabled={isLoading}>Remove All Survey Logic</button>)}
                </div>
                {localRules.length === 0 && (<p className={styles.textMuted} style={{ marginTop: '10px' }}>No survey-wide logic rules defined.</p>)}
                {ensureArray(localRules).map((rule, ruleIdx) => (
                    <LogicRuleEditor
                        key={rule._id || `surveyRule-${ruleIdx}`}
                        rule={rule}
                        ruleIndex={ruleIdx}
                        onUpdateRule={updateLogicRule}
                        onRemoveRule={removeLogicRule}
                        sourceQuestionPool={allQuestions}
                        targetQuestionPool={allQuestions}
                        styles={styles} 
                        {...logicHelpers}
                        onUpdateQuestionDefinition={onUpdateQuestionDefinition}
                        onOpenAreaManager={onOpenAreaManager} // +++ PASS DOWN +++
                    />
                ))}
            </div>
            <div className={styles.panelFooter}>
                <button type="button" onClick={onClose} className="button button-secondary" disabled={isLoading}>Cancel</button>
                <button type="button" onClick={handleSaveAndClose} className="button button-primary" disabled={isLoading}>{isLoading ? 'Saving...' : 'Apply & Close'}</button>
            </div>
        </div>
    );
}

export default SurveyLogicPanel;
// ----- END OF COMPLETE MODIFIED FILE (v1.4 - Pass onOpenAreaManager) -----