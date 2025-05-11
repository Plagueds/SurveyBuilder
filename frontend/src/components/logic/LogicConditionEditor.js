// frontend/src/components/logic/LogicConditionEditor.js
// ----- START OF MODIFIED FILE (v1.4 - Multiple defined heatmap areas support) -----
import React, { useState, useEffect, useMemo } from 'react';
import { getOperatorsForQuestionType, getConditionValueInputDetails } from './logicConstants';
import HeatmapAreaSelectorModal from './HeatmapAreaSelectorModal'; // v2.0 of the modal

function LogicConditionEditor({
    condition,
    conditionIndex,
    onUpdateCondition,
    onRemoveCondition,
    availableSourceQuestions,
    allQuestions, // Full list of all survey questions
    styles,
    truncateText,
    getQuestionTypeLabel,
    ensureArray,
    // +++ NEW PROP +++
    onUpdateQuestionDefinition // (questionId, updatedFields) => void
}) {
    const [selectedQuestion, setSelectedQuestion] = useState(null);
    const [currentOperators, setCurrentOperators] = useState([]);
    const [valueInputDetails, setValueInputDetails] = useState({ type: 'none' });

    // State for composite inputs (heatmapArea state is no longer needed here for direct input)
    const [selectedMatrixRow, setSelectedMatrixRow] = useState('');
    const [selectedMatrixCol, setSelectedMatrixCol] = useState('');
    const [selectedRank, setSelectedRank] = useState('');
    const [selectedRankItem, setSelectedRankItem] = useState('');
    const [selectedCardSortCard, setSelectedCardSortCard] = useState('');
    const [selectedCardSortCategory, setSelectedCardSortCategory] = useState('');
    // const [heatmapArea, setHeatmapArea] = useState({ x: '', y: '', width: '', height: '' }); // REMOVED

    const [isAreaManagerModalOpen, setIsAreaManagerModalOpen] = useState(false);

    useEffect(() => {
        if (condition.sourceQuestionId) {
            const question = allQuestions.find(q => q._id === condition.sourceQuestionId);
            setSelectedQuestion(question); // This question object might have 'definedHeatmapAreas'
            if (question) {
                setCurrentOperators(getOperatorsForQuestionType(question.type));
            } else {
                setCurrentOperators(getOperatorsForQuestionType('default'));
            }
        } else {
            setSelectedQuestion(null);
            setCurrentOperators(getOperatorsForQuestionType('default'));
        }
        // Reset composite input states if source question changes
        if (!condition.sourceQuestionId || (selectedQuestion && selectedQuestion._id !== condition.sourceQuestionId)) {
            setSelectedMatrixRow(''); setSelectedMatrixCol('');
            setSelectedRank(''); setSelectedRankItem('');
            setSelectedCardSortCard(''); setSelectedCardSortCategory('');
        }
    }, [condition.sourceQuestionId, allQuestions]); // Removed selectedQuestion from deps to avoid loop with its own update

    useEffect(() => {
        // Re-fetch selectedQuestion from allQuestions when allQuestions itself might have changed
        // (e.g., after definedHeatmapAreas were updated on it).
        if (condition.sourceQuestionId) {
            const currentSelectedQ = allQuestions.find(q => q._id === condition.sourceQuestionId);
            if (currentSelectedQ && JSON.stringify(currentSelectedQ) !== JSON.stringify(selectedQuestion)) {
                setSelectedQuestion(currentSelectedQ);
            }
        }
    }, [allQuestions, condition.sourceQuestionId, selectedQuestion]);


    useEffect(() => {
        if (selectedQuestion && condition.conditionOperator) {
            // Pass the potentially updated selectedQuestion to get correct details (e.g., defined areas)
            const details = getConditionValueInputDetails(selectedQuestion, condition.conditionOperator);
            setValueInputDetails(details);

            // Reset specific input states when operator or question changes, unless the type matches
            if (details.type !== 'matrix_row_then_col_select') { setSelectedMatrixRow(''); setSelectedMatrixCol(''); }
            if (details.type !== 'ranking_rank_then_item_select') { setSelectedRank(''); setSelectedRankItem(''); }
            if (details.type !== 'cardsort_card_then_category_select') { setSelectedCardSortCard(''); setSelectedCardSortCategory(''); }

            if (condition.conditionValue) {
                const parts = String(condition.conditionValue).split(';');
                if (details.type === 'matrix_row_then_col_select' && parts.length === 2) {
                    setSelectedMatrixRow(parts[0]); setSelectedMatrixCol(parts[1]);
                } else if (details.type === 'ranking_rank_then_item_select' && parts.length === 2) {
                    setSelectedRank(parts[0]); setSelectedRankItem(parts[1]);
                } else if (details.type === 'cardsort_card_then_category_select' && parts.length === 2) {
                    setSelectedCardSortCard(parts[0]); setSelectedCardSortCategory(parts[1]);
                }
                // For 'heatmapDefinedAreaSelect', conditionValue is just the area ID, handled by the select's value prop.
            }
        } else {
            setValueInputDetails({ type: 'none' });
        }
    }, [selectedQuestion, condition.conditionOperator, condition.conditionValue]);


    const handleSourceQuestionChange = (e) => {
        const newSourceQuestionId = e.target.value;
        const newSelectedQ = allQuestions.find(q => q._id === newSourceQuestionId);
        let newOperatorValue = '';
        let newConditionValue = '';

        if (newSelectedQ) {
            const ops = getOperatorsForQuestionType(newSelectedQ.type);
            if (ops.length > 0) newOperatorValue = ops[0].value;
        } else {
            const defaultOps = getOperatorsForQuestionType('default');
            if (defaultOps.length > 0) newOperatorValue = defaultOps[0].value;
        }

        const firstOpDetails = newSelectedQ ? getConditionValueInputDetails(newSelectedQ, newOperatorValue) : { type: 'none' };
        // For heatmapDefinedAreaSelect, if there are areas, pick the first one? Or leave empty? Let's leave empty.
        if (firstOpDetails.type === 'none' || firstOpDetails.type === 'heatmapDefinedAreaSelect') {
             newConditionValue = '';
        } else {
            newConditionValue = ''; // Default for others
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

        const newDetails = selectedQuestion ? getConditionValueInputDetails(selectedQuestion, newOperatorValue) : { type: 'none' };

        if (newDetails.type === 'heatmapDefinedAreaSelect' && newDetails.options && newDetails.options.length > 0) {
            // If switching to heatmapDefinedAreaSelect and areas exist, pre-select the first one.
            // Or, require user to select. For now, let's not pre-select. User must choose.
            // newConditionValue = newDetails.options[0].value;
        } else if (newDetails.type === 'none') {
            newConditionValue = '';
        }
        // For other types, newConditionValue remains empty, user will fill it.

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
            let clampedValue = numValue;
            if (valueInputDetails.min !== undefined && numValue < valueInputDetails.min) clampedValue = valueInputDetails.min;
            if (valueInputDetails.max !== undefined && numValue > valueInputDetails.max) clampedValue = valueInputDetails.max;
            value = String(clampedValue);
        }
        onUpdateCondition(conditionIndex, { ...condition, conditionValue: value });
    };

    const handleMatrixValueChange = (part, val) => { /* ... (no change) ... */ let rowVal = part === 'row' ? val : selectedMatrixRow; let colVal = part === 'col' ? val : selectedMatrixCol; setSelectedMatrixRow(rowVal); setSelectedMatrixCol(colVal); onUpdateCondition(conditionIndex, { ...condition, conditionValue: (rowVal && colVal) ? `${rowVal};${colVal}` : '' }); };
    const handleRankingValueChange = (part, val) => { /* ... (no change) ... */ let rankVal = part === 'rank' ? val : selectedRank; let itemVal = part === 'item' ? val : selectedRankItem; setSelectedRank(rankVal); setSelectedRankItem(itemVal); onUpdateCondition(conditionIndex, { ...condition, conditionValue: (rankVal && itemVal) ? `${rankVal};${itemVal}` : '' }); };
    const handleCardSortValueChange = (part, val) => { /* ... (no change) ... */ let cardVal = part === 'card' ? val : selectedCardSortCard; let catVal = part === 'category' ? val : selectedCardSortCategory; setSelectedCardSortCard(cardVal); setSelectedCardSortCategory(catVal); onUpdateCondition(conditionIndex, { ...condition, conditionValue: (cardVal && catVal) ? `${cardVal};${catVal}` : '' }); };

    // +++ NEW HANDLER for when areas are saved from the modal +++
    const handleDefinedAreasSavedFromModal = (updatedAreas) => {
        if (selectedQuestion && typeof onUpdateQuestionDefinition === 'function') {
            onUpdateQuestionDefinition(selectedQuestion._id, { definedHeatmapAreas: updatedAreas });
            // The selectedQuestion state will update via useEffect watching allQuestions
            // And then valueInputDetails will re-calculate with new options.
            // If the currently selected conditionValue (area ID) is no longer in updatedAreas, clear it.
            const currentAreaIdIsValid = updatedAreas.some(area => area.id === condition.conditionValue);
            if (!currentAreaIdIsValid) {
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
            case 'matrix_row_then_col_select': { /* ... (no change from v1.3) ... */ const rows = ensureArray(selectedQuestion.matrixRows).map(r => ({ label: r, value: r })); const cols = ensureArray(selectedQuestion.matrixColumns).map(c => ({ label: c, value: c })); return ( <div className={styles.compositeInputContainer}> <select value={selectedMatrixRow} onChange={(e) => handleMatrixValueChange('row', e.target.value)} className={styles.formControlSmall}> <option value="">-- Row --</option> {rows.map(opt => <option key={opt.value} value={opt.value}>{truncateText(opt.label)}</option>)} </select> <span style={{ margin: '0 5px'}}>is</span> <select value={selectedMatrixCol} onChange={(e) => handleMatrixValueChange('col', e.target.value)} className={styles.formControlSmall}> <option value="">-- Value --</option> {cols.map(opt => <option key={opt.value} value={opt.value}>{truncateText(opt.label)}</option>)} </select> </div> ); }
            case 'ranking_rank_then_item_select': { /* ... (no change from v1.3) ... */ const items = ensureArray(selectedQuestion.options).map(opt => typeof opt === 'string' ? {label:opt, value:opt} : ({label: opt.label || opt.text || opt.value, value: opt.value || opt.text || opt.value})); const ranks = Array.from({ length: items.length }, (_, i) => ({ label: `Rank ${i + 1}`, value: String(i + 1) })); return ( <div className={styles.compositeInputContainer}> <select value={selectedRank} onChange={(e) => handleRankingValueChange('rank', e.target.value)} className={styles.formControlSmall}> <option value="">-- Rank --</option> {ranks.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)} </select> <span style={{ margin: '0 5px'}}>is</span> <select value={selectedRankItem} onChange={(e) => handleRankingValueChange('item', e.target.value)} className={styles.formControlSmall}> <option value="">-- Item --</option> {items.map(opt => <option key={opt.value} value={opt.value}>{truncateText(opt.label)}</option>)} </select> </div> ); }
            case 'cardsort_card_then_category_select': { /* ... (no change from v1.3) ... */ const cards = ensureArray(selectedQuestion.cards || selectedQuestion.options).map(c => ({ label: c.label || c.text || c.id || c, value: c.id || c.value || c })); const categories = ensureArray(selectedQuestion.cardSortCategories).map(cat => ({ label: cat, value: cat })); return ( <div className={styles.compositeInputContainer}> <select value={selectedCardSortCard} onChange={(e) => handleCardSortValueChange('card', e.target.value)} className={styles.formControlSmall}> <option value="">-- Card --</option> {cards.map(opt => <option key={opt.value} value={opt.value}>{truncateText(opt.label)}</option>)} </select> <span style={{ margin: '0 5px'}}>in</span> <select value={selectedCardSortCategory} onChange={(e) => handleCardSortValueChange('category', e.target.value)} className={styles.formControlSmall}> <option value="">-- Category --</option> {categories.map(opt => <option key={opt.value} value={opt.value}>{truncateText(opt.label)}</option>)} </select> </div> ); }
            
            // --- OLD 'heatmapArea' RENDERING REMOVED ---
            // case 'heatmapArea': { ... }

            // +++ NEW CASE FOR 'heatmapDefinedAreaSelect' +++
            case 'heatmapDefinedAreaSelect':
                return (
                    <select
                        value={condition.conditionValue || ''} // This will be the area ID
                        onChange={handleSimpleValueChange} // Simple value change is fine, it just updates conditionValue
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

    // Changed from isHeatmapAreaType to isHeatmapDefinedAreaSelectType
    const isHeatmapDefinedAreaSelectType = valueInputDetails.type === 'heatmapDefinedAreaSelect';

    return (
        // If it's heatmapDefinedAreaSelectType, it will NOT use logicConditionItemHeatmapLayout (two-row)
        // It will use the standard single-row layout, with the "Manage Areas" button appearing next to the dropdown.
        // Or, we can decide to keep the two-row layout if we want the "Manage Areas" button on its own line.
        // For now, let's try to fit it in one row.
        <div className={`${styles.logicConditionItem}`}>
            <div className={styles.logicConditionTopRow}> {/* This div is always used now */}
                <select value={condition.sourceQuestionId || ''} onChange={handleSourceQuestionChange} className={styles.formControl} title="Select the question this condition depends on">
                    <option value="">-- Select Source Question --</option>
                    {sourceQuestionOptions}
                    {availableSourceQuestions.length === 0 && <option disabled>No previous questions</option>}
                </select>

                <select value={condition.conditionOperator || ''} onChange={handleOperatorChange} className={styles.formControl} title="Select the comparison operator" disabled={!selectedQuestion}>
                    {selectedQuestion ? (operatorDropdownOptions.length > 0 ? operatorDropdownOptions : <option disabled>No operators</option>) : (<option value="">-- Select Source First --</option>)}
                </select>

                {/* Render the core value input (e.g., text, number, or our new select for defined areas) */}
                {selectedQuestion && valueInputDetails.type !== 'none' && (
                    renderCoreValueInput()
                )}

                {/* "Manage Defined Areas" button specific to heatmap 'clickInArea' operator */}
                {selectedQuestion && selectedQuestion.type === 'heatmap' && condition.conditionOperator === 'clickInArea' && selectedQuestion.imageUrl && (
                     <button
                        type="button"
                        onClick={() => setIsAreaManagerModalOpen(true)}
                        className={`button button-secondary ${styles.manageAreasButton}`} // New style class
                        title="Manage defined areas for this heatmap question"
                    >
                        Manage Areas
                    </button>
                )}

                <button type="button" onClick={() => onRemoveCondition(conditionIndex)} className={`button button-danger button-small ${styles.logicRemoveButton}`} title="Remove this condition">&times;</button>
            </div>

            {/* Modal for managing defined heatmap areas */}
            {selectedQuestion && selectedQuestion.type === 'heatmap' && selectedQuestion.imageUrl && isAreaManagerModalOpen && (
                <HeatmapAreaSelectorModal // Using the v2.0 modal
                    isOpen={isAreaManagerModalOpen}
                    onClose={() => setIsAreaManagerModalOpen(false)}
                    onSaveAreas={handleDefinedAreasSavedFromModal} // New handler
                    imageUrl={selectedQuestion.imageUrl}
                    initialAreas={ensureArray(selectedQuestion.definedHeatmapAreas)} // Pass current defined areas
                    styles={styles} // Pass CSS module styles
                />
            )}
        </div>
    );
}
export default LogicConditionEditor;
// ----- END OF MODIFIED FILE (v1.4) -----