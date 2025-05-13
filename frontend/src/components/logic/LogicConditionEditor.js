// frontend/src/components/logic/LogicConditionEditor.js
// ----- START OF UPDATED FILE (v1.5 - Refined useEffect for selectedQuestion sync) -----
import React, { useState, useEffect, useMemo } from 'react';
import { getOperatorsForQuestionType, getConditionValueInputDetails } from './logicConstants';
import HeatmapAreaSelectorModal from './HeatmapAreaSelectorModal';

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
    onUpdateQuestionDefinition
}) {
    const [selectedQuestion, setSelectedQuestion] = useState(null);
    const [currentOperators, setCurrentOperators] = useState([]);
    const [valueInputDetails, setValueInputDetails] = useState({ type: 'none' });
    const [selectedMatrixRow, setSelectedMatrixRow] = useState('');
    const [selectedMatrixCol, setSelectedMatrixCol] = useState('');
    const [selectedRank, setSelectedRank] = useState('');
    const [selectedRankItem, setSelectedRankItem] = useState('');
    const [selectedCardSortCard, setSelectedCardSortCard] = useState('');
    const [selectedCardSortCategory, setSelectedCardSortCategory] = useState('');
    const [isAreaManagerModalOpen, setIsAreaManagerModalOpen] = useState(false);

    // Effect to synchronize local selectedQuestion state when props change
    useEffect(() => {
        let newSelectedQ = null;
        if (condition.sourceQuestionId) {
            newSelectedQ = allQuestions.find(q => q._id === condition.sourceQuestionId) || null;
        }

        // Only update local state if the derived question object is actually different.
        // This relies on JSON.stringify for comparison, which is generally fine for this data structure.
        if (JSON.stringify(newSelectedQ) !== JSON.stringify(selectedQuestion)) {
            // console.log("[LCE] Updating selectedQuestion. Old areas count:", selectedQuestion?.definedHeatmapAreas?.length, "New areas count:", newSelectedQ?.definedHeatmapAreas?.length, "New Q:", newSelectedQ); // DEBUG
            setSelectedQuestion(newSelectedQ);
        }
        
        // Also update operators if the source question ID changes, or if the question type effectively changes
        // (even if ID is same but question object itself changed, e.g. type was edited elsewhere).
        if (newSelectedQ) {
            if (!selectedQuestion || selectedQuestion._id !== newSelectedQ._id || selectedQuestion.type !== newSelectedQ.type) {
                setCurrentOperators(getOperatorsForQuestionType(newSelectedQ.type));
            }
        } else if (selectedQuestion) { // Was a selected question, but now no source ID or question not found
            setCurrentOperators(getOperatorsForQuestionType('default'));
        }

    }, [allQuestions, condition.sourceQuestionId]); // Removed selectedQuestion from deps to avoid loop, as we are setting it.

    // Effect to update value input details when selectedQuestion or operator changes
    useEffect(() => {
        if (selectedQuestion && condition.conditionOperator) {
            // console.log("[LCE] Recalculating valueInputDetails. SelectedQ areas:", selectedQuestion.definedHeatmapAreas); // DEBUG
            const details = getConditionValueInputDetails(selectedQuestion, condition.conditionOperator);
            // console.log("[LCE] Calculated details for dropdown:", details); // DEBUG
            setValueInputDetails(details);

            // Reset specific input states when operator or question changes, unless the type matches
            if (details.type !== 'matrix_row_then_col_select') { setSelectedMatrixRow(''); setSelectedMatrixCol(''); }
            if (details.type !== 'ranking_rank_then_item_select') { setSelectedRank(''); setSelectedRankItem(''); }
            if (details.type !== 'cardsort_card_then_category_select') { setSelectedCardSortCard(''); setSelectedCardSortCategory(''); }

            // Pre-fill composite inputs if conditionValue exists and matches type
            if (condition.conditionValue) {
                const parts = String(condition.conditionValue).split(';');
                if (details.type === 'matrix_row_then_col_select' && parts.length === 2) {
                    setSelectedMatrixRow(parts[0]); setSelectedMatrixCol(parts[1]);
                } else if (details.type === 'ranking_rank_then_item_select' && parts.length === 2) {
                    setSelectedRank(parts[0]); setSelectedRankItem(parts[1]);
                } else if (details.type === 'cardsort_card_then_category_select' && parts.length === 2) {
                    setSelectedCardSortCard(parts[0]); setSelectedCardSortCategory(parts[1]);
                }
            }
        } else {
            setValueInputDetails({ type: 'none' });
        }
    }, [selectedQuestion, condition.conditionOperator, condition.conditionValue]);


    const handleSourceQuestionChange = (e) => {
        const newSourceQuestionId = e.target.value;
        const newSelectedQObject = allQuestions.find(q => q._id === newSourceQuestionId);
        let newOperatorValue = '';
        let newConditionValue = '';

        if (newSelectedQObject) {
            const ops = getOperatorsForQuestionType(newSelectedQObject.type);
            if (ops.length > 0) newOperatorValue = ops[0].value; // Default to first operator
        } else {
            const defaultOps = getOperatorsForQuestionType('default');
            if (defaultOps.length > 0) newOperatorValue = defaultOps[0].value;
        }
        
        // Determine if the new default operator expects a value
        const firstOpDetails = newSelectedQObject ? getConditionValueInputDetails(newSelectedQObject, newOperatorValue) : { type: 'none' };
        if (firstOpDetails.type === 'none' || firstOpDetails.type === 'heatmapDefinedAreaSelect') {
             newConditionValue = ''; // No default value or let user select for heatmap areas
        } else {
            // For other types that expect a value, we might set a default or leave empty.
            // For now, leaving empty is safest.
            newConditionValue = '';
        }

        onUpdateCondition(conditionIndex, {
            ...condition,
            sourceQuestionId: newSourceQuestionId,
            conditionOperator: newOperatorValue,
            conditionValue: newConditionValue,
        });
    };

    const handleOperatorChange = (e) => {
        const newOperatorValue = e.target.value;
        let newConditionValue = ''; // Reset condition value when operator changes

        // If switching to an operator that uses defined areas, and areas exist,
        // we could pre-select the first one, but it's often better to force user selection.
        // For now, just reset to empty.
        onUpdateCondition(conditionIndex, {
            ...condition,
            conditionOperator: newOperatorValue,
            conditionValue: newConditionValue,
        });
    };

    const handleSimpleValueChange = (e) => {
        let value = e.target.value;
        const inputType = e.target.type;
        if (valueInputDetails.type === 'number' || inputType === 'number') {
            if (value === '') { onUpdateCondition(conditionIndex, { ...condition, conditionValue: '' }); return; }
            const numValue = parseFloat(value);
            let clampedValue = numValue; // Allow any number unless min/max specified by details
            if (valueInputDetails.min !== undefined && numValue < valueInputDetails.min) clampedValue = valueInputDetails.min;
            if (valueInputDetails.max !== undefined && numValue > valueInputDetails.max) clampedValue = valueInputDetails.max;
            value = String(clampedValue);
        }
        onUpdateCondition(conditionIndex, { ...condition, conditionValue: value });
    };

    const handleMatrixValueChange = (part, val) => { let rowVal = part === 'row' ? val : selectedMatrixRow; let colVal = part === 'col' ? val : selectedMatrixCol; setSelectedMatrixRow(rowVal); setSelectedMatrixCol(colVal); onUpdateCondition(conditionIndex, { ...condition, conditionValue: (rowVal && colVal) ? `${rowVal};${colVal}` : '' }); };
    const handleRankingValueChange = (part, val) => { let rankVal = part === 'rank' ? val : selectedRank; let itemVal = part === 'item' ? val : selectedRankItem; setSelectedRank(rankVal); setSelectedRankItem(itemVal); onUpdateCondition(conditionIndex, { ...condition, conditionValue: (rankVal && itemVal) ? `${rankVal};${itemVal}` : '' }); };
    const handleCardSortValueChange = (part, val) => { let cardVal = part === 'card' ? val : selectedCardSortCard; let catVal = part === 'category' ? val : selectedCardSortCategory; setSelectedCardSortCard(cardVal); setSelectedCardSortCategory(catVal); onUpdateCondition(conditionIndex, { ...condition, conditionValue: (cardVal && catVal) ? `${cardVal};${catVal}` : '' }); };

    const handleDefinedAreasSavedFromModal = (updatedAreas) => {
        if (selectedQuestion && typeof onUpdateQuestionDefinition === 'function') {
            onUpdateQuestionDefinition(selectedQuestion._id, { definedHeatmapAreas: updatedAreas });
            const currentAreaIdIsValid = updatedAreas.some(area => area.id === condition.conditionValue);
            if (!currentAreaIdIsValid && condition.conditionValue) {
                onUpdateCondition(conditionIndex, { ...condition, conditionValue: '' });
            }
        }
        setIsAreaManagerModalOpen(false);
    };

    const renderCoreValueInput = () => {
        if (valueInputDetails.type === 'none' || !selectedQuestion) return null;
        switch (valueInputDetails.type) {
            case 'text': return <input type="text" placeholder="Enter value" value={condition.conditionValue || ''} onChange={handleSimpleValueChange} className={styles.formControl} />;
            case 'number': return <input type="number" placeholder="Enter number" value={condition.conditionValue ?? ''} onChange={handleSimpleValueChange} min={valueInputDetails.min} max={valueInputDetails.max} step={valueInputDetails.step || 'any'} className={styles.formControl} />;
            case 'select':
                return ( <select value={condition.conditionValue || ''} onChange={handleSimpleValueChange} className={styles.formControl}> <option value="">-- Select Value --</option> {ensureArray(valueInputDetails.options).map((opt, idx) => ( <option key={opt.value || idx} value={opt.value}> {truncateText(opt.label, 40)} </option> ))} {(!valueInputDetails.options || valueInputDetails.options.length === 0) && <option disabled>No options available</option>} </select> );
            case 'matrix_row_then_col_select': { const rows = ensureArray(selectedQuestion.matrixRows).map(r => ({ label: r, value: r })); const cols = ensureArray(selectedQuestion.matrixColumns).map(c => ({ label: c, value: c })); return ( <div className={styles.compositeInputContainer}> <select value={selectedMatrixRow} onChange={(e) => handleMatrixValueChange('row', e.target.value)} className={styles.formControlSmall}> <option value="">-- Row --</option> {rows.map(opt => <option key={opt.value} value={opt.value}>{truncateText(opt.label)}</option>)} </select> <span style={{ margin: '0 5px'}}>is</span> <select value={selectedMatrixCol} onChange={(e) => handleMatrixValueChange('col', e.target.value)} className={styles.formControlSmall}> <option value="">-- Value --</option> {cols.map(opt => <option key={opt.value} value={opt.value}>{truncateText(opt.label)}</option>)} </select> </div> ); }
            case 'ranking_rank_then_item_select': { const items = ensureArray(selectedQuestion.options).map(opt => typeof opt === 'string' ? {label:opt, value:opt} : ({label: opt.label || opt.text || opt.value, value: opt.value || opt.text || opt.value})); const ranks = Array.from({ length: items.length }, (_, i) => ({ label: `Rank ${i + 1}`, value: String(i + 1) })); return ( <div className={styles.compositeInputContainer}> <select value={selectedRank} onChange={(e) => handleRankingValueChange('rank', e.target.value)} className={styles.formControlSmall}> <option value="">-- Rank --</option> {ranks.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)} </select> <span style={{ margin: '0 5px'}}>is</span> <select value={selectedRankItem} onChange={(e) => handleRankingValueChange('item', e.target.value)} className={styles.formControlSmall}> <option value="">-- Item --</option> {items.map(opt => <option key={opt.value} value={opt.value}>{truncateText(opt.label)}</option>)} </select> </div> ); }
            case 'cardsort_card_then_category_select': { const cards = ensureArray(selectedQuestion.cards || selectedQuestion.options).map(c => ({ label: c.label || c.text || c.id || c, value: c.id || c.value || c })); const categories = ensureArray(selectedQuestion.cardSortCategories).map(cat => ({ label: cat, value: cat })); return ( <div className={styles.compositeInputContainer}> <select value={selectedCardSortCard} onChange={(e) => handleCardSortValueChange('card', e.target.value)} className={styles.formControlSmall}> <option value="">-- Card --</option> {cards.map(opt => <option key={opt.value} value={opt.value}>{truncateText(opt.label)}</option>)} </select> <span style={{ margin: '0 5px'}}>in</span> <select value={selectedCardSortCategory} onChange={(e) => handleCardSortValueChange('category', e.target.value)} className={styles.formControlSmall}> <option value="">-- Category --</option> {categories.map(opt => <option key={opt.value} value={opt.value}>{truncateText(opt.label)}</option>)} </select> </div> ); }
            case 'heatmapDefinedAreaSelect':
                return (
                    <select
                        value={condition.conditionValue || ''}
                        onChange={handleSimpleValueChange}
                        className={styles.formControl}
                        title="Select a predefined heatmap area"
                    >
                        <option value="">-- Select Defined Area --</option>
                        {ensureArray(valueInputDetails.options).map(opt => (
                            <option key={opt.value} value={opt.value}>
                                {truncateText(opt.label, 40)}
                            </option>
                        ))}
                        {(!valueInputDetails.options || valueInputDetails.options.length === 0) && (
                            <option disabled>No areas defined. Manage areas first.</option>
                        )}
                    </select>
                );
            default: return <input type="text" placeholder="Value" value={condition.conditionValue || ''} onChange={handleSimpleValueChange} className={styles.formControl} />;
        }
    };

    const sourceQuestionOptions = useMemo(() => availableSourceQuestions.map((q, idx) => ( <option key={q._id} value={q._id}> {idx + 1}. {truncateText(q.text, 50)} ({getQuestionTypeLabel(q.type)}) </option> )), [availableSourceQuestions, truncateText, getQuestionTypeLabel]);
    const operatorDropdownOptions = useMemo(() => currentOperators.map(op => ( <option key={op.value} value={op.value}>{op.label}</option> )), [currentOperators]);

    return (
        <div className={`${styles.logicConditionItem}`}>
            <div className={styles.logicConditionTopRow}>
                <select value={condition.sourceQuestionId || ''} onChange={handleSourceQuestionChange} className={styles.formControl} title="Select the question this condition depends on">
                    <option value="">-- Select Source Question --</option>
                    {sourceQuestionOptions}
                    {availableSourceQuestions.length === 0 && <option disabled>No previous questions</option>}
                </select>

                <select value={condition.conditionOperator || ''} onChange={handleOperatorChange} className={styles.formControl} title="Select the comparison operator" disabled={!selectedQuestion}>
                    {selectedQuestion ? (operatorDropdownOptions.length > 0 ? operatorDropdownOptions : <option disabled>No operators</option>) : (<option value="">-- Select Source First --</option>)}
                </select>

                {selectedQuestion && valueInputDetails.type !== 'none' && (
                    renderCoreValueInput()
                )}

                {selectedQuestion && selectedQuestion.type === 'heatmap' && condition.conditionOperator === 'clickInArea' && selectedQuestion.imageUrl && (
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

            {selectedQuestion && selectedQuestion.type === 'heatmap' && selectedQuestion.imageUrl && isAreaManagerModalOpen && (
                <HeatmapAreaSelectorModal
                    isOpen={isAreaManagerModalOpen}
                    onClose={() => setIsAreaManagerModalOpen(false)}
                    onSaveAreas={handleDefinedAreasSavedFromModal}
                    imageUrl={selectedQuestion.imageUrl}
                    initialAreas={ensureArray(selectedQuestion.definedHeatmapAreas)}
                    styles={styles}
                />
            )}
        </div>
    );
}
export default LogicConditionEditor;
// ----- END OF UPDATED FILE (v1.5 - Refined useEffect for selectedQuestion sync) -----