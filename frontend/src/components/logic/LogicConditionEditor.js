// frontend/src/components/logic/LogicConditionEditor.js
// ----- START OF UPDATED FILE (v2.0 - Conjoint and Other Text UI) -----
import React, { useState, useEffect, useMemo } from 'react'; // Removed useCallback as it's not heavily used here yet
import { getOperatorsForQuestionType, getConditionValueInputDetails } from './logicConstants';

function LogicConditionEditor({
    condition,
    conditionIndex,
    onUpdateCondition,
    onRemoveCondition,
    availableSourceQuestions,
    allQuestions,
    styles,
    truncateText,
    getQuestionTypeLabel,
    ensureArray,
    onUpdateQuestionDefinition, 
    onOpenAreaManager 
}) {
    const [selectedMatrixRow, setSelectedMatrixRow] = useState('');
    const [selectedMatrixCol, setSelectedMatrixCol] = useState('');
    const [selectedRank, setSelectedRank] = useState('');
    const [selectedRankItem, setSelectedRankItem] = useState('');
    const [selectedCardSortCard, setSelectedCardSortCard] = useState('');
    const [selectedCardSortCategory, setSelectedCardSortCategory] = useState('');

    // +++ NEW State for Conjoint +++
    const [selectedConjointTask, setSelectedConjointTask] = useState('');
    const [selectedConjointAttribute, setSelectedConjointAttribute] = useState('');
    const [selectedConjointLevel, setSelectedConjointLevel] = useState('');

    const derivedSelectedQuestion = useMemo(() => {
        if (condition.sourceQuestionId) {
            return allQuestions.find(q => q._id === condition.sourceQuestionId) || null;
        }
        return null;
    }, [allQuestions, condition.sourceQuestionId]);

    // Pass question settings (like addOtherOption) to get the correct operator list
    const derivedCurrentOperators = useMemo(() => {
        if (derivedSelectedQuestion) {
            return getOperatorsForQuestionType(derivedSelectedQuestion.type, { addOtherOption: derivedSelectedQuestion.addOtherOption });
        }
        return getOperatorsForQuestionType('default', {});
    }, [derivedSelectedQuestion]);

    const derivedValueInputDetails = useMemo(() => {
        if (derivedSelectedQuestion && condition.conditionOperator) {
            const details = getConditionValueInputDetails(derivedSelectedQuestion, condition.conditionOperator);
            return details;
        }
        return { type: 'none' };
    }, [derivedSelectedQuestion, condition.conditionOperator]);

    useEffect(() => {
        // Reset non-relevant composite states
        if (derivedValueInputDetails.type !== 'matrix_row_then_col_select') { setSelectedMatrixRow(''); setSelectedMatrixCol(''); }
        if (derivedValueInputDetails.type !== 'ranking_rank_then_item_select') { setSelectedRank(''); setSelectedRankItem(''); }
        if (derivedValueInputDetails.type !== 'cardsort_card_then_category_select') { setSelectedCardSortCard(''); setSelectedCardSortCategory(''); }
        if (derivedValueInputDetails.type !== 'select_conjoint_task' && derivedValueInputDetails.type !== 'select_conjoint_task_attr_level') {
            setSelectedConjointTask(''); setSelectedConjointAttribute(''); setSelectedConjointLevel('');
        }

        if (condition.conditionValue) {
            const parts = String(condition.conditionValue).split(';');
            if (derivedValueInputDetails.type === 'matrix_row_then_col_select' && parts.length === 2) {
                setSelectedMatrixRow(parts[0]); setSelectedMatrixCol(parts[1]);
            } else if (derivedValueInputDetails.type === 'ranking_rank_then_item_select' && parts.length === 2) {
                setSelectedRank(parts[0]); setSelectedRankItem(parts[1]);
            } else if (derivedValueInputDetails.type === 'cardsort_card_then_category_select' && parts.length === 2) {
                setSelectedCardSortCard(parts[0]); setSelectedCardSortCategory(parts[1]);
            } else if (derivedValueInputDetails.type === 'select_conjoint_task') { // For choiceForTaskIsNone
                setSelectedConjointTask(condition.conditionValue); // conditionValue is just taskId
                setSelectedConjointAttribute(''); setSelectedConjointLevel('');
            } else if (derivedValueInputDetails.type === 'select_conjoint_task_attr_level' && parts.length === 3) { // For choiceForTaskAttributeIsLevel
                setSelectedConjointTask(parts[0]);
                setSelectedConjointAttribute(parts[1]);
                setSelectedConjointLevel(parts[2]);
            }
        } else {
            // Clear all if conditionValue is empty
            setSelectedMatrixRow(''); setSelectedMatrixCol('');
            setSelectedRank(''); setSelectedRankItem('');
            setSelectedCardSortCard(''); setSelectedCardSortCategory('');
            setSelectedConjointTask(''); setSelectedConjointAttribute(''); setSelectedConjointLevel('');
        }
    }, [condition.conditionValue, derivedValueInputDetails.type]);

    const handleSourceQuestionChange = (e) => {
        const newSourceQuestionId = e.target.value;
        const newSelectedQObject = allQuestions.find(q => q._id === newSourceQuestionId);
        let newOperatorValue = '';
        if (newSelectedQObject) {
            // Pass question settings for correct operator list
            const ops = getOperatorsForQuestionType(newSelectedQObject.type, { addOtherOption: newSelectedQObject.addOtherOption });
            if (ops.length > 0) newOperatorValue = ops[0].value;
        } else {
            const defaultOps = getOperatorsForQuestionType('default', {});
            if (defaultOps.length > 0) newOperatorValue = defaultOps[0].value;
        }
        // Reset conditionValue and specific conjoint states when source question changes
        onUpdateCondition(conditionIndex, { 
            ...condition, 
            sourceQuestionId: newSourceQuestionId, 
            conditionOperator: newOperatorValue, 
            conditionValue: '' 
        });
        setSelectedConjointTask(''); setSelectedConjointAttribute(''); setSelectedConjointLevel('');
    };

    const handleOperatorChange = (e) => {
        const newOperatorValue = e.target.value;
        // Reset conditionValue and specific conjoint states when operator changes
        onUpdateCondition(conditionIndex, { 
            ...condition, 
            conditionOperator: newOperatorValue, 
            conditionValue: '' 
        });
        setSelectedConjointTask(''); setSelectedConjointAttribute(''); setSelectedConjointLevel('');
    };

    const handleSimpleValueChange = (e) => {
        let value = e.target.value;
        const inputType = e.target.type;
        if (derivedValueInputDetails.type === 'number' || inputType === 'number') {
            if (value === '') { onUpdateCondition(conditionIndex, { ...condition, conditionValue: '' }); return; }
            const numValue = parseFloat(value);
            let clampedValue = numValue;
            if (derivedValueInputDetails.min !== undefined && numValue < derivedValueInputDetails.min) clampedValue = derivedValueInputDetails.min;
            if (derivedValueInputDetails.max !== undefined && numValue > derivedValueInputDetails.max) clampedValue = derivedValueInputDetails.max;
            value = String(clampedValue);
        }
        onUpdateCondition(conditionIndex, { ...condition, conditionValue: value });
    };

    const handleMatrixValueChange = (part, val) => { let r = part === 'row' ? val : selectedMatrixRow; let c = part === 'col' ? val : selectedMatrixCol; setSelectedMatrixRow(r); setSelectedMatrixCol(c); onUpdateCondition(conditionIndex, { ...condition, conditionValue: (r && c) ? `${r};${c}` : '' }); };
    const handleRankingValueChange = (part, val) => { let r = part === 'rank' ? val : selectedRank; let i = part === 'item' ? val : selectedRankItem; setSelectedRank(r); setSelectedRankItem(i); onUpdateCondition(conditionIndex, { ...condition, conditionValue: (r && i) ? `${r};${i}` : '' }); };
    const handleCardSortValueChange = (part, val) => { let card = part === 'card' ? val : selectedCardSortCard; let cat = part === 'category' ? val : selectedCardSortCategory; setSelectedCardSortCard(card); setSelectedCardSortCategory(cat); onUpdateCondition(conditionIndex, { ...condition, conditionValue: (card && cat) ? `${card};${cat}` : '' }); };

    // +++ NEW Handlers for Conjoint Inputs +++
    const handleConjointValueChange = (part, value) => {
        let task = part === 'task' ? value : selectedConjointTask;
        let attr = part === 'attribute' ? value : selectedConjointAttribute;
        let level = part === 'level' ? value : selectedConjointLevel;

        if (part === 'task') { // If task changes, reset attribute and level
            attr = ''; level = '';
            setSelectedConjointAttribute(''); setSelectedConjointLevel('');
        }
        if (part === 'attribute') { // If attribute changes, reset level
            level = '';
            setSelectedConjointLevel('');
        }
        
        setSelectedConjointTask(task);
        setSelectedConjointAttribute(attr);
        setSelectedConjointLevel(level);

        let newConditionValue = '';
        if (derivedValueInputDetails.type === 'select_conjoint_task') {
            newConditionValue = task; // Just the task ID
        } else if (derivedValueInputDetails.type === 'select_conjoint_task_attr_level') {
            if (task && attr && level) {
                newConditionValue = `${task};${attr};${level}`;
            }
        }
        onUpdateCondition(conditionIndex, { ...condition, conditionValue: newConditionValue });
    };


    const handleManageAreasClick = () => {
        if (derivedSelectedQuestion && typeof onOpenAreaManager === 'function') {
            onOpenAreaManager(derivedSelectedQuestion);
        } else {
            console.error("[LCE] Cannot open Area Manager: derivedSelectedQuestion or onOpenAreaManager is invalid.");
        }
    };
    
    const renderCoreValueInput = () => {
        if (!derivedSelectedQuestion || derivedValueInputDetails.type === 'none' ) return null;
        
        // If the operator applies to "Other" text and expects a value, always render a text input.
        if (derivedValueInputDetails.operator?.appliesToOtherText && derivedValueInputDetails.operator?.expectsValue) {
            return <input type="text" placeholder="Enter text for 'Other'" value={condition.conditionValue || ''} onChange={handleSimpleValueChange} className={styles.formControl} />;
        }

        switch (derivedValueInputDetails.type) {
            case 'text': return <input type="text" placeholder="Enter value" value={condition.conditionValue || ''} onChange={handleSimpleValueChange} className={styles.formControl} />;
            case 'number': return <input type="number" placeholder="Enter number" value={condition.conditionValue ?? ''} onChange={handleSimpleValueChange} min={derivedValueInputDetails.min} max={derivedValueInputDetails.max} step={derivedValueInputDetails.step || 'any'} className={styles.formControl} />;
            case 'select':
                return ( <select value={condition.conditionValue || ''} onChange={handleSimpleValueChange} className={styles.formControl}> <option value="">-- Select Value --</option> {ensureArray(derivedValueInputDetails.options).map((opt, idx) => ( <option key={opt.value || idx} value={opt.value}> {truncateText(opt.label, 40)} </option> ))} {(!derivedValueInputDetails.options || derivedValueInputDetails.options.length === 0) && <option disabled>No options available</option>} </select> );
            case 'matrix_row_then_col_select': { const r = ensureArray(derivedSelectedQuestion.matrixRows).map(opt => ({ label: opt, value: opt })); const c = ensureArray(derivedSelectedQuestion.matrixColumns).map(opt => ({ label: opt, value: opt })); return ( <div className={styles.compositeInputContainer}> <select value={selectedMatrixRow} onChange={(e) => handleMatrixValueChange('row', e.target.value)} className={styles.formControlSmall}> <option value="">-- Row --</option> {r.map(opt => <option key={opt.value} value={opt.value}>{truncateText(opt.label)}</option>)} </select> <span style={{ margin: '0 5px'}}>is</span> <select value={selectedMatrixCol} onChange={(e) => handleMatrixValueChange('col', e.target.value)} className={styles.formControlSmall}> <option value="">-- Value --</option> {c.map(opt => <option key={opt.value} value={opt.value}>{truncateText(opt.label)}</option>)} </select> </div> ); }
            case 'ranking_rank_then_item_select': { const i = ensureArray(derivedSelectedQuestion.options).map(opt => typeof opt === 'string' ? {l:opt, v:opt} : ({l: opt.label||opt.text||opt.value, v: opt.value||opt.text||opt.value})); const r = Array.from({length:i.length},(_,idx)=>({l:`Rank ${idx+1}`,v:String(idx+1)})); return ( <div className={styles.compositeInputContainer}> <select value={selectedRank} onChange={(e) => handleRankingValueChange('rank', e.target.value)} className={styles.formControlSmall}> <option value="">-- Rank --</option> {r.map(opt => <option key={opt.v} value={opt.v}>{opt.l}</option>)} </select> <span style={{ margin: '0 5px'}}>is</span> <select value={selectedRankItem} onChange={(e) => handleRankingValueChange('item', e.target.value)} className={styles.formControlSmall}> <option value="">-- Item --</option> {i.map(opt => <option key={opt.v} value={opt.v}>{truncateText(opt.l)}</option>)} </select> </div> ); }
            case 'cardsort_card_then_category_select': { const cards = ensureArray(derivedSelectedQuestion.cards || derivedSelectedQuestion.options).map(c => ({ l: c.label||c.text||c.id||c, v: c.id||c.value||String(c) })); const cats = ensureArray(derivedSelectedQuestion.cardSortCategories).map(cat => ({ l: cat, v: cat })); return ( <div className={styles.compositeInputContainer}> <select value={selectedCardSortCard} onChange={(e) => handleCardSortValueChange('card', e.target.value)} className={styles.formControlSmall}> <option value="">-- Card --</option> {cards.map(opt => <option key={opt.v} value={opt.v}>{truncateText(opt.l)}</option>)} </select> <span style={{ margin: '0 5px'}}>in</span> <select value={selectedCardSortCategory} onChange={(e) => handleCardSortValueChange('category', e.target.value)} className={styles.formControlSmall}> <option value="">-- Category --</option> {cats.map(opt => <option key={opt.v} value={opt.v}>{truncateText(opt.l)}</option>)} </select> </div> ); }
            case 'heatmapDefinedAreaSelect':
                const heatmapAreaOptions = ensureArray(derivedSelectedQuestion?.definedHeatmapAreas).map(area => ({ label: area.name, value: area.id }));
                return ( <select value={condition.conditionValue || ''} onChange={handleSimpleValueChange} className={styles.formControl} title="Select a predefined heatmap area"> <option value="">-- Select Defined Area --</option> {heatmapAreaOptions.map(opt => ( <option key={opt.value} value={opt.value}> {truncateText(opt.label, 40)} </option> ))} {heatmapAreaOptions.length === 0 && ( <option disabled>No areas defined. Manage areas first.</option> )} </select> );
            
            // +++ NEW Cases for Conjoint +++
            case 'select_conjoint_task': { // For 'choiceForTaskIsNone'
                const taskOptions = derivedValueInputDetails.options || [];
                return (
                    <div className={styles.compositeInputContainer}>
                        <select 
                            value={selectedConjointTask} 
                            onChange={(e) => handleConjointValueChange('task', e.target.value)} 
                            className={styles.formControlSmall}
                        >
                            <option value="">-- Select Task --</option>
                            {taskOptions.map(opt => <option key={opt.value} value={opt.value}>{truncateText(opt.label)}</option>)}
                        </select>
                        {/* "was None" is implied by the operator, no further value needed from user here */}
                    </div>
                );
            }
            case 'select_conjoint_task_attr_level': { // For 'choiceForTaskAttributeIsLevel'
                const taskOptions = derivedValueInputDetails.tasks || [];
                const attributeOptions = derivedValueInputDetails.attributes || [];
                
                let levelOptions = [];
                if (selectedConjointAttribute && derivedSelectedQuestion && Array.isArray(derivedSelectedQuestion.conjointAttributes)) {
                    const foundAttribute = derivedSelectedQuestion.conjointAttributes.find(attr => attr.name === selectedConjointAttribute);
                    if (foundAttribute && Array.isArray(foundAttribute.levels)) {
                        levelOptions = foundAttribute.levels.map(level => ({ label: level, value: level }));
                    }
                }

                return (
                    <div className={styles.compositeInputContainer} style={{gap: '5px'}}> {/* Added gap for better spacing */}
                        <select 
                            value={selectedConjointTask} 
                            onChange={(e) => handleConjointValueChange('task', e.target.value)} 
                            className={styles.formControlSmall}
                            title="Select Task"
                        >
                            <option value="">-- Task --</option>
                            {taskOptions.map(opt => <option key={opt.value} value={opt.value}>{truncateText(opt.label)}</option>)}
                        </select>
                        <select 
                            value={selectedConjointAttribute} 
                            onChange={(e) => handleConjointValueChange('attribute', e.target.value)} 
                            className={styles.formControlSmall}
                            disabled={!selectedConjointTask}
                            title="Select Attribute"
                        >
                            <option value="">-- Attribute --</option>
                            {attributeOptions.map(attr => <option key={attr.name} value={attr.name}>{truncateText(attr.name)}</option>)}
                        </select>
                        <span style={{ margin: '0 2px'}}>was</span>
                        <select 
                            value={selectedConjointLevel} 
                            onChange={(e) => handleConjointValueChange('level', e.target.value)} 
                            className={styles.formControlSmall}
                            disabled={!selectedConjointAttribute}
                            title="Select Level"
                        >
                            <option value="">-- Level --</option>
                            {levelOptions.map(opt => <option key={opt.value} value={opt.value}>{truncateText(opt.label)}</option>)}
                        </select>
                    </div>
                );
            }
            default: return <input type="text" placeholder="Value" value={condition.conditionValue || ''} onChange={handleSimpleValueChange} className={styles.formControl} />;
        }
    };

    const sourceQuestionOptions = useMemo(() => availableSourceQuestions.map((q, idx) => ( <option key={q._id} value={q._id}> {idx + 1}. {truncateText(q.text, 50)} ({getQuestionTypeLabel(q.type)}) </option> )), [availableSourceQuestions, truncateText, getQuestionTypeLabel]);
    // Use derivedCurrentOperators which is already filtered based on question settings
    const operatorDropdownOptions = useMemo(() => derivedCurrentOperators.map(op => ( <option key={op.value} value={op.value}>{op.label}</option> )), [derivedCurrentOperators]);

    return (
        <div className={`${styles.logicConditionItem}`}>
            <div className={styles.logicConditionTopRow}>
                <select value={condition.sourceQuestionId || ''} onChange={handleSourceQuestionChange} className={styles.formControl} title="Select the question this condition depends on">
                    <option value="">-- Select Source Question --</option>
                    {sourceQuestionOptions}
                    {availableSourceQuestions.length === 0 && <option disabled>No previous questions</option>}
                </select>

                <select value={condition.conditionOperator || ''} onChange={handleOperatorChange} className={styles.formControl} title="Select the comparison operator" disabled={!derivedSelectedQuestion}>
                    {derivedSelectedQuestion ? 
                        (operatorDropdownOptions.length > 0 ? operatorDropdownOptions : <option disabled>No operators available</option>) : 
                        (<option value="">-- Select Source First --</option>)
                    }
                </select>

                {/* Render value input only if the operator expects a value OR if it's an "Other Text" operator that doesn't expect a value (like otherTextIsEmpty) */}
                {derivedSelectedQuestion && 
                    (derivedValueInputDetails.type !== 'none' || (derivedValueInputDetails.operator?.appliesToOtherText && !derivedValueInputDetails.operator?.expectsValue) ) &&
                    ( renderCoreValueInput() )
                }
                

                {derivedSelectedQuestion && derivedSelectedQuestion.type === 'heatmap' && condition.conditionOperator === 'clickInArea' && derivedSelectedQuestion.imageUrl && (
                     <button type="button" onClick={handleManageAreasClick} className={`button button-secondary ${styles.manageAreasButton}`} title="Manage defined areas for this heatmap question">Manage Areas</button>
                )}

                <button type="button" onClick={() => onRemoveCondition(conditionIndex)} className={`button button-danger button-small ${styles.logicRemoveButton}`} title="Remove this condition">&times;</button>
            </div>
        </div>
    );
}
export default LogicConditionEditor;
// ----- END OF UPDATED FILE (v2.0 - Conjoint and Other Text UI) -----