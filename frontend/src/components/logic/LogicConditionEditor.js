// frontend/src/components/logic/LogicConditionEditor.js
// ----- START OF UPDATED FILE (v1.9 - Modal opening lifted to SurveyBuildPage) -----
import React, { useState, useEffect, useMemo, useCallback } from 'react'; // Removed useRef
import { getOperatorsForQuestionType, getConditionValueInputDetails } from './logicConstants';
// HeatmapAreaSelectorModal is no longer imported or rendered here

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
    onUpdateQuestionDefinition, // Still used for non-modal updates if any, or if modal save triggers it via SBP
    onOpenAreaManager // +++ NEW PROP: Function to open the modal in SurveyBuildPage +++
}) {
    // Removed state: isAreaManagerModalOpen, isHeatmapDrawing
    // Removed ref: heatmapModalRef

    const [selectedMatrixRow, setSelectedMatrixRow] = useState('');
    const [selectedMatrixCol, setSelectedMatrixCol] = useState('');
    const [selectedRank, setSelectedRank] = useState('');
    const [selectedRankItem, setSelectedRankItem] = useState('');
    const [selectedCardSortCard, setSelectedCardSortCard] = useState('');
    const [selectedCardSortCategory, setSelectedCardSortCategory] = useState('');

    const derivedSelectedQuestion = useMemo(() => {
        if (condition.sourceQuestionId) {
            return allQuestions.find(q => q._id === condition.sourceQuestionId) || null;
        }
        return null;
    }, [allQuestions, condition.sourceQuestionId]);

    const derivedCurrentOperators = useMemo(() => {
        if (derivedSelectedQuestion) {
            return getOperatorsForQuestionType(derivedSelectedQuestion.type);
        }
        return getOperatorsForQuestionType('default');
    }, [derivedSelectedQuestion]);

    const derivedValueInputDetails = useMemo(() => {
        if (derivedSelectedQuestion && condition.conditionOperator) {
            const details = getConditionValueInputDetails(derivedSelectedQuestion, condition.conditionOperator);
            return details;
        }
        return { type: 'none' };
    }, [derivedSelectedQuestion, condition.conditionOperator]);

    useEffect(() => {
        if (derivedValueInputDetails.type !== 'matrix_row_then_col_select') { setSelectedMatrixRow(''); setSelectedMatrixCol(''); }
        if (derivedValueInputDetails.type !== 'ranking_rank_then_item_select') { setSelectedRank(''); setSelectedRankItem(''); }
        if (derivedValueInputDetails.type !== 'cardsort_card_then_category_select') { setSelectedCardSortCard(''); setSelectedCardSortCategory(''); }

        if (condition.conditionValue) {
            const parts = String(condition.conditionValue).split(';');
            if (derivedValueInputDetails.type === 'matrix_row_then_col_select' && parts.length === 2) {
                setSelectedMatrixRow(parts[0]); setSelectedMatrixCol(parts[1]);
            } else if (derivedValueInputDetails.type === 'ranking_rank_then_item_select' && parts.length === 2) {
                setSelectedRank(parts[0]); setSelectedRankItem(parts[1]);
            } else if (derivedValueInputDetails.type === 'cardsort_card_then_category_select' && parts.length === 2) {
                setSelectedCardSortCard(parts[0]); setSelectedCardSortCategory(parts[1]);
            }
        } else {
            if (derivedValueInputDetails.type === 'matrix_row_then_col_select') { setSelectedMatrixRow(''); setSelectedMatrixCol(''); }
            if (derivedValueInputDetails.type === 'ranking_rank_then_item_select') { setSelectedRank(''); setSelectedRankItem(''); }
            if (derivedValueInputDetails.type === 'cardsort_card_then_category_select') { setSelectedCardSortCard(''); setSelectedCardSortCategory(''); }
        }
    }, [condition.conditionValue, derivedValueInputDetails.type]);

    const handleSourceQuestionChange = (e) => {
        const newSourceQuestionId = e.target.value;
        const newSelectedQObject = allQuestions.find(q => q._id === newSourceQuestionId);
        let newOperatorValue = '';
        if (newSelectedQObject) {
            const ops = getOperatorsForQuestionType(newSelectedQObject.type);
            if (ops.length > 0) newOperatorValue = ops[0].value;
        } else {
            const defaultOps = getOperatorsForQuestionType('default');
            if (defaultOps.length > 0) newOperatorValue = defaultOps[0].value;
        }
        onUpdateCondition(conditionIndex, { ...condition, sourceQuestionId: newSourceQuestionId, conditionOperator: newOperatorValue, conditionValue: '' });
    };

    const handleOperatorChange = (e) => {
        const newOperatorValue = e.target.value;
        onUpdateCondition(conditionIndex, { ...condition, conditionOperator: newOperatorValue, conditionValue: '' });
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

    // This function is now simpler: it just calls the prop to open the modal at the SurveyBuildPage level.
    const handleManageAreasClick = () => {
        if (derivedSelectedQuestion && typeof onOpenAreaManager === 'function') {
            console.log("[LCE v1.9] 'Manage Areas' button clicked. Calling onOpenAreaManager for Q_ID:", derivedSelectedQuestion._id);
            onOpenAreaManager(derivedSelectedQuestion); // Pass the full question object
        } else {
            console.error("[LCE v1.9] Cannot open Area Manager: derivedSelectedQuestion or onOpenAreaManager is invalid.");
        }
    };
    
    // Removed handleDefinedAreasSavedFromModal - this logic is now in SurveyBuildPage
    // Removed handleHeatmapDrawingStateChange

    const renderCoreValueInput = () => {
        if (derivedValueInputDetails.type === 'none' || !derivedSelectedQuestion) return null;
        switch (derivedValueInputDetails.type) {
            case 'text': return <input type="text" placeholder="Enter value" value={condition.conditionValue || ''} onChange={handleSimpleValueChange} className={styles.formControl} />;
            case 'number': return <input type="number" placeholder="Enter number" value={condition.conditionValue ?? ''} onChange={handleSimpleValueChange} min={derivedValueInputDetails.min} max={derivedValueInputDetails.max} step={derivedValueInputDetails.step || 'any'} className={styles.formControl} />;
            case 'select':
                return ( <select value={condition.conditionValue || ''} onChange={handleSimpleValueChange} className={styles.formControl}> <option value="">-- Select Value --</option> {ensureArray(derivedValueInputDetails.options).map((opt, idx) => ( <option key={opt.value || idx} value={opt.value}> {truncateText(opt.label, 40)} </option> ))} {(!derivedValueInputDetails.options || derivedValueInputDetails.options.length === 0) && <option disabled>No options available</option>} </select> );
            case 'matrix_row_then_col_select': { const r = ensureArray(derivedSelectedQuestion.matrixRows).map(opt => ({ label: opt, value: opt })); const c = ensureArray(derivedSelectedQuestion.matrixColumns).map(opt => ({ label: opt, value: opt })); return ( <div className={styles.compositeInputContainer}> <select value={selectedMatrixRow} onChange={(e) => handleMatrixValueChange('row', e.target.value)} className={styles.formControlSmall}> <option value="">-- Row --</option> {r.map(opt => <option key={opt.value} value={opt.value}>{truncateText(opt.label)}</option>)} </select> <span style={{ margin: '0 5px'}}>is</span> <select value={selectedMatrixCol} onChange={(e) => handleMatrixValueChange('col', e.target.value)} className={styles.formControlSmall}> <option value="">-- Value --</option> {c.map(opt => <option key={opt.value} value={opt.value}>{truncateText(opt.label)}</option>)} </select> </div> ); }
            case 'ranking_rank_then_item_select': { const i = ensureArray(derivedSelectedQuestion.options).map(opt => typeof opt === 'string' ? {l:opt, v:opt} : ({l: opt.label||opt.text||opt.value, v: opt.value||opt.text||opt.value})); const r = Array.from({length:i.length},(_,idx)=>({l:`Rank ${idx+1}`,v:String(idx+1)})); return ( <div className={styles.compositeInputContainer}> <select value={selectedRank} onChange={(e) => handleRankingValueChange('rank', e.target.value)} className={styles.formControlSmall}> <option value="">-- Rank --</option> {r.map(opt => <option key={opt.v} value={opt.v}>{opt.l}</option>)} </select> <span style={{ margin: '0 5px'}}>is</span> <select value={selectedRankItem} onChange={(e) => handleRankingValueChange('item', e.target.value)} className={styles.formControlSmall}> <option value="">-- Item --</option> {i.map(opt => <option key={opt.v} value={opt.v}>{truncateText(opt.l)}</option>)} </select> </div> ); }
            case 'cardsort_card_then_category_select': { const cards = ensureArray(derivedSelectedQuestion.cards || derivedSelectedQuestion.options).map(c => ({ l: c.label||c.text||c.id||c, v: c.id||c.value||c })); const cats = ensureArray(derivedSelectedQuestion.cardSortCategories).map(cat => ({ l: cat, v: cat })); return ( <div className={styles.compositeInputContainer}> <select value={selectedCardSortCard} onChange={(e) => handleCardSortValueChange('card', e.target.value)} className={styles.formControlSmall}> <option value="">-- Card --</option> {cards.map(opt => <option key={opt.v} value={opt.v}>{truncateText(opt.l)}</option>)} </select> <span style={{ margin: '0 5px'}}>in</span> <select value={selectedCardSortCategory} onChange={(e) => handleCardSortValueChange('category', e.target.value)} className={styles.formControlSmall}> <option value="">-- Category --</option> {cats.map(opt => <option key={opt.v} value={opt.v}>{truncateText(opt.l)}</option>)} </select> </div> ); }
            case 'heatmapDefinedAreaSelect':
                // The options for this dropdown are now populated based on derivedSelectedQuestion.definedHeatmapAreas
                // which should be up-to-date due to handleUpdateQuestionDefinition in SurveyBuildPage
                const heatmapAreaOptions = ensureArray(derivedSelectedQuestion?.definedHeatmapAreas).map(area => ({
                    label: area.name,
                    value: area.id
                }));
                return (
                    <select value={condition.conditionValue || ''} onChange={handleSimpleValueChange} className={styles.formControl} title="Select a predefined heatmap area">
                        <option value="">-- Select Defined Area --</option>
                        {heatmapAreaOptions.map(opt => ( <option key={opt.value} value={opt.value}> {truncateText(opt.label, 40)} </option> ))}
                        {heatmapAreaOptions.length === 0 && ( <option disabled>No areas defined. Manage areas first.</option> )}
                    </select>
                );
            default: return <input type="text" placeholder="Value" value={condition.conditionValue || ''} onChange={handleSimpleValueChange} className={styles.formControl} />;
        }
    };

    const sourceQuestionOptions = useMemo(() => availableSourceQuestions.map((q, idx) => ( <option key={q._id} value={q._id}> {idx + 1}. {truncateText(q.text, 50)} ({getQuestionTypeLabel(q.type)}) </option> )), [availableSourceQuestions, truncateText, getQuestionTypeLabel]);
    const operatorDropdownOptions = useMemo(() => derivedCurrentOperators.map(op => ( <option key={op.value} value={op.value}>{op.label}</option> )), [derivedCurrentOperators]);

    return (
        // No longer renders the modal here
        <div className={`${styles.logicConditionItem}`}>
            <div className={styles.logicConditionTopRow}>
                <select value={condition.sourceQuestionId || ''} onChange={handleSourceQuestionChange} className={styles.formControl} title="Select the question this condition depends on">
                    <option value="">-- Select Source Question --</option>
                    {sourceQuestionOptions}
                    {availableSourceQuestions.length === 0 && <option disabled>No previous questions</option>}
                </select>

                <select value={condition.conditionOperator || ''} onChange={handleOperatorChange} className={styles.formControl} title="Select the comparison operator" disabled={!derivedSelectedQuestion}>
                    {derivedSelectedQuestion ? (operatorDropdownOptions.length > 0 ? operatorDropdownOptions : <option disabled>No operators</option>) : (<option value="">-- Select Source First --</option>)}
                </select>

                {derivedSelectedQuestion && derivedValueInputDetails.type !== 'none' && ( renderCoreValueInput() )}

                {derivedSelectedQuestion && derivedSelectedQuestion.type === 'heatmap' && condition.conditionOperator === 'clickInArea' && derivedSelectedQuestion.imageUrl && (
                     <button type="button" onClick={handleManageAreasClick} className={`button button-secondary ${styles.manageAreasButton}`} title="Manage defined areas for this heatmap question">Manage Areas</button>
                )}

                <button type="button" onClick={() => onRemoveCondition(conditionIndex)} className={`button button-danger button-small ${styles.logicRemoveButton}`} title="Remove this condition">&times;</button>
            </div>
        </div>
    );
}
export default LogicConditionEditor;
// ----- END OF UPDATED FILE (v1.9 - Modal opening lifted to SurveyBuildPage) -----