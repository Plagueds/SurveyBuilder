// frontend/src/components/logic/LogicConditionEditor.js
// ----- START OF UPDATED FILE (v1.6 - Use useMemo for derived states) -----
import React, { useState, useEffect, useMemo } from 'react';
import { getOperatorsForQuestionType, getConditionValueInputDetails } from './logicConstants';
import HeatmapAreaSelectorModal from './HeatmapAreaSelectorModal';

function LogicConditionEditor({
    condition,
    conditionIndex,
    onUpdateCondition,
    onRemoveCondition,
    availableSourceQuestions,
    allQuestions, // This prop is crucial and comes from SurveyBuildPage's state
    styles,
    truncateText,
    getQuestionTypeLabel,
    ensureArray,
    onUpdateQuestionDefinition
}) {
    // --- States for UI interaction ---
    const [isAreaManagerModalOpen, setIsAreaManagerModalOpen] = useState(false);
    // States for composite inputs (values are derived from condition.conditionValue initially)
    const [selectedMatrixRow, setSelectedMatrixRow] = useState('');
    const [selectedMatrixCol, setSelectedMatrixCol] = useState('');
    const [selectedRank, setSelectedRank] = useState('');
    const [selectedRankItem, setSelectedRankItem] = useState('');
    const [selectedCardSortCard, setSelectedCardSortCard] = useState('');
    const [selectedCardSortCategory, setSelectedCardSortCategory] = useState('');

    // --- Derived values using useMemo for better reactivity to prop changes ---
    const derivedSelectedQuestion = useMemo(() => {
        // console.log("[LCE useMemo] Deriving selectedQuestion. SourceID:", condition.sourceQuestionId); // DEBUG
        if (condition.sourceQuestionId) {
            const foundQ = allQuestions.find(q => q._id === condition.sourceQuestionId) || null;
            // console.log("[LCE useMemo] Found question:", foundQ?._id, "Areas:", foundQ?.definedHeatmapAreas?.length); // DEBUG
            return foundQ;
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
            // console.log("[LCE useMemo] Deriving valueInputDetails. SelectedQ areas:", derivedSelectedQuestion.definedHeatmapAreas); // DEBUG
            const details = getConditionValueInputDetails(derivedSelectedQuestion, condition.conditionOperator);
            // console.log("[LCE useMemo] Calculated details for dropdown:", details); // DEBUG
            return details;
        }
        return { type: 'none' };
    }, [derivedSelectedQuestion, condition.conditionOperator]);


    // Effect to initialize/update composite input states when conditionValue or input type changes
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
        } else { // If conditionValue is cleared, reset composite inputs
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
        
        onUpdateCondition(conditionIndex, {
            ...condition,
            sourceQuestionId: newSourceQuestionId,
            conditionOperator: newOperatorValue,
            conditionValue: '', // Always reset condition value when source question changes
        });
    };

    const handleOperatorChange = (e) => {
        const newOperatorValue = e.target.value;
        onUpdateCondition(conditionIndex, {
            ...condition,
            conditionOperator: newOperatorValue,
            conditionValue: '', // Always reset condition value when operator changes
        });
    };

    const handleSimpleValueChange = (e) => {
        let value = e.target.value;
        const inputType = e.target.type;

        if (derivedValueInputDetails.type === 'number' || inputType === 'number') {
            if (value === '') { // Allow clearing the number input
                onUpdateCondition(conditionIndex, { ...condition, conditionValue: '' });
                return;
            }
            const numValue = parseFloat(value);
            // Only clamp if min/max are defined in details, otherwise accept the number
            let clampedValue = numValue;
            if (derivedValueInputDetails.min !== undefined && numValue < derivedValueInputDetails.min) clampedValue = derivedValueInputDetails.min;
            if (derivedValueInputDetails.max !== undefined && numValue > derivedValueInputDetails.max) clampedValue = derivedValueInputDetails.max;
            value = String(clampedValue);
        }
        onUpdateCondition(conditionIndex, { ...condition, conditionValue: value });
    };

    const handleMatrixValueChange = (part, val) => { 
        let rowVal = part === 'row' ? val : selectedMatrixRow; 
        let colVal = part === 'col' ? val : selectedMatrixCol; 
        setSelectedMatrixRow(rowVal); 
        setSelectedMatrixCol(colVal); 
        onUpdateCondition(conditionIndex, { ...condition, conditionValue: (rowVal && colVal) ? `${rowVal};${colVal}` : '' }); 
    };
    const handleRankingValueChange = (part, val) => { 
        let rankVal = part === 'rank' ? val : selectedRank; 
        let itemVal = part === 'item' ? val : selectedRankItem; 
        setSelectedRank(rankVal); 
        setSelectedRankItem(itemVal); 
        onUpdateCondition(conditionIndex, { ...condition, conditionValue: (rankVal && itemVal) ? `${rankVal};${itemVal}` : '' }); 
    };
    const handleCardSortValueChange = (part, val) => { 
        let cardVal = part === 'card' ? val : selectedCardSortCard; 
        let catVal = part === 'category' ? val : selectedCardSortCategory; 
        setSelectedCardSortCard(cardVal); 
        setSelectedCardSortCategory(catVal); 
        onUpdateCondition(conditionIndex, { ...condition, conditionValue: (cardVal && catVal) ? `${cardVal};${catVal}` : '' }); 
    };

    const handleDefinedAreasSavedFromModal = (updatedAreas) => {
        if (derivedSelectedQuestion && typeof onUpdateQuestionDefinition === 'function') {
            onUpdateQuestionDefinition(derivedSelectedQuestion._id, { definedHeatmapAreas: updatedAreas });
            // Check if the current conditionValue (an area ID) is still valid
            const currentAreaIdIsValid = updatedAreas.some(area => area.id === condition.conditionValue);
            if (!currentAreaIdIsValid && condition.conditionValue) {
                // If not valid, clear it
                onUpdateCondition(conditionIndex, { ...condition, conditionValue: '' });
            }
        }
        setIsAreaManagerModalOpen(false);
    };

    const renderCoreValueInput = () => {
        if (derivedValueInputDetails.type === 'none' || !derivedSelectedQuestion) return null;

        switch (derivedValueInputDetails.type) {
            case 'text': return <input type="text" placeholder="Enter value" value={condition.conditionValue || ''} onChange={handleSimpleValueChange} className={styles.formControl} />;
            case 'number': return <input type="number" placeholder="Enter number" value={condition.conditionValue ?? ''} onChange={handleSimpleValueChange} min={derivedValueInputDetails.min} max={derivedValueInputDetails.max} step={derivedValueInputDetails.step || 'any'} className={styles.formControl} />;
            case 'select':
                return ( <select value={condition.conditionValue || ''} onChange={handleSimpleValueChange} className={styles.formControl}> <option value="">-- Select Value --</option> {ensureArray(derivedValueInputDetails.options).map((opt, idx) => ( <option key={opt.value || idx} value={opt.value}> {truncateText(opt.label, 40)} </option> ))} {(!derivedValueInputDetails.options || derivedValueInputDetails.options.length === 0) && <option disabled>No options available</option>} </select> );
            case 'matrix_row_then_col_select': { const rows = ensureArray(derivedSelectedQuestion.matrixRows).map(r => ({ label: r, value: r })); const cols = ensureArray(derivedSelectedQuestion.matrixColumns).map(c => ({ label: c, value: c })); return ( <div className={styles.compositeInputContainer}> <select value={selectedMatrixRow} onChange={(e) => handleMatrixValueChange('row', e.target.value)} className={styles.formControlSmall}> <option value="">-- Row --</option> {rows.map(opt => <option key={opt.value} value={opt.value}>{truncateText(opt.label)}</option>)} </select> <span style={{ margin: '0 5px'}}>is</span> <select value={selectedMatrixCol} onChange={(e) => handleMatrixValueChange('col', e.target.value)} className={styles.formControlSmall}> <option value="">-- Value --</option> {cols.map(opt => <option key={opt.value} value={opt.value}>{truncateText(opt.label)}</option>)} </select> </div> ); }
            case 'ranking_rank_then_item_select': { const items = ensureArray(derivedSelectedQuestion.options).map(opt => typeof opt === 'string' ? {label:opt, value:opt} : ({label: opt.label || opt.text || opt.value, value: opt.value || opt.text || opt.value})); const ranks = Array.from({ length: items.length }, (_, i) => ({ label: `Rank ${i + 1}`, value: String(i + 1) })); return ( <div className={styles.compositeInputContainer}> <select value={selectedRank} onChange={(e) => handleRankingValueChange('rank', e.target.value)} className={styles.formControlSmall}> <option value="">-- Rank --</option> {ranks.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)} </select> <span style={{ margin: '0 5px'}}>is</span> <select value={selectedRankItem} onChange={(e) => handleRankingValueChange('item', e.target.value)} className={styles.formControlSmall}> <option value="">-- Item --</option> {items.map(opt => <option key={opt.value} value={opt.value}>{truncateText(opt.label)}</option>)} </select> </div> ); }
            case 'cardsort_card_then_category_select': { const cards = ensureArray(derivedSelectedQuestion.cards || derivedSelectedQuestion.options).map(c => ({ label: c.label || c.text || c.id || c, value: c.id || c.value || c })); const categories = ensureArray(derivedSelectedQuestion.cardSortCategories).map(cat => ({ label: cat, value: cat })); return ( <div className={styles.compositeInputContainer}> <select value={selectedCardSortCard} onChange={(e) => handleCardSortValueChange('card', e.target.value)} className={styles.formControlSmall}> <option value="">-- Card --</option> {cards.map(opt => <option key={opt.value} value={opt.value}>{truncateText(opt.label)}</option>)} </select> <span style={{ margin: '0 5px'}}>in</span> <select value={selectedCardSortCategory} onChange={(e) => handleCardSortValueChange('category', e.target.value)} className={styles.formControlSmall}> <option value="">-- Category --</option> {categories.map(opt => <option key={opt.value} value={opt.value}>{truncateText(opt.label)}</option>)} </select> </div> ); }
            case 'heatmapDefinedAreaSelect':
                return (
                    <select
                        value={condition.conditionValue || ''}
                        onChange={handleSimpleValueChange}
                        className={styles.formControl}
                        title="Select a predefined heatmap area"
                    >
                        <option value="">-- Select Defined Area --</option>
                        {ensureArray(derivedValueInputDetails.options).map(opt => (
                            <option key={opt.value} value={opt.value}>
                                {truncateText(opt.label, 40)}
                            </option>
                        ))}
                        {(!derivedValueInputDetails.options || derivedValueInputDetails.options.length === 0) && (
                            <option disabled>No areas defined. Manage areas first.</option>
                        )}
                    </select>
                );
            default: return <input type="text" placeholder="Value" value={condition.conditionValue || ''} onChange={handleSimpleValueChange} className={styles.formControl} />;
        }
    };

    const sourceQuestionOptions = useMemo(() => availableSourceQuestions.map((q, idx) => ( <option key={q._id} value={q._id}> {idx + 1}. {truncateText(q.text, 50)} ({getQuestionTypeLabel(q.type)}) </option> )), [availableSourceQuestions, truncateText, getQuestionTypeLabel]);
    
    // Operator dropdown options are now derived from derivedCurrentOperators
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
                    {derivedSelectedQuestion ? (operatorDropdownOptions.length > 0 ? operatorDropdownOptions : <option disabled>No operators</option>) : (<option value="">-- Select Source First --</option>)}
                </select>

                {derivedSelectedQuestion && derivedValueInputDetails.type !== 'none' && (
                    renderCoreValueInput()
                )}

                {derivedSelectedQuestion && derivedSelectedQuestion.type === 'heatmap' && condition.conditionOperator === 'clickInArea' && derivedSelectedQuestion.imageUrl && (
                     <button
                        type="button"
                        onClick={() => setIsAreaManagerModalOpen(true)}
                        className={`button button-secondary ${styles.manageAreasButton}`}
                        title="Manage defined areas for this heatmap question"
                    >
                        Manage Areas
                    </button>
                )}

                <button type="button" onClick={() => onRemoveCondition(conditionIndex)} className={`button button-danger button-small ${styles.logicRemoveButton}`} title="Remove this condition">&times;</button>
            </div>

            {derivedSelectedQuestion && derivedSelectedQuestion.type === 'heatmap' && derivedSelectedQuestion.imageUrl && isAreaManagerModalOpen && (
                <HeatmapAreaSelectorModal
                    isOpen={isAreaManagerModalOpen}
                    onClose={() => setIsAreaManagerModalOpen(false)}
                    onSaveAreas={handleDefinedAreasSavedFromModal}
                    imageUrl={derivedSelectedQuestion.imageUrl}
                    initialAreas={ensureArray(derivedSelectedQuestion.definedHeatmapAreas)}
                    styles={styles}
                />
            )}
        </div>
    );
}
export default LogicConditionEditor;
// ----- END OF UPDATED FILE (v1.6 - Use useMemo for derived states) -----