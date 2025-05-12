// frontend/src/pages/SurveyTakingPage.js
// ----- START OF COMPLETE MODIFIED FILE (v1.8 - Refined handleCheckboxChange) -----
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import ReCAPTCHA from "react-google-recaptcha";
import {
    DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragOverlay,
} from '@dnd-kit/core';
import {
    arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, rectSortingStrategy, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import styles from './SurveyTakingPage.module.css';
import * as surveyApi from '../api/surveyApi';

// --- Import Question Type Components ---
import ShortTextQuestion from '../components/survey_question_renders/ShortTextQuestion';
import TextAreaQuestion from '../components/survey_question_renders/TextAreaQuestion';
import MultipleChoiceQuestion from '../components/survey_question_renders/MultipleChoiceQuestion';
import CheckboxQuestion from '../components/survey_question_renders/CheckboxQuestion';
import DropdownQuestion from '../components/survey_question_renders/DropdownQuestion';
import RatingQuestion from '../components/survey_question_renders/RatingQuestion';
import NpsQuestion from '../components/survey_question_renders/NpsQuestion';

// --- Inline Helper Components (definitions as provided previously, ensure they are correct) ---
const SliderQuestion = ({ question, value, onChange, disabled }) => { const min = question.sliderMin ?? 0; const max = question.sliderMax ?? 100; const step = question.sliderStep ?? 1; const currentValue = value === '' || value === null || value === undefined ? Math.round((min + max) / 2) : Number(value); useEffect(() => { if (value === '' || value === null || value === undefined) { onChange(String(currentValue)); } }, [value, onChange, currentValue]); return (<div className={`${styles.sliderContainer} ${disabled ? styles.disabled : ''}`}><span className={styles.sliderLabel}>{min}</span><input type="range" min={min} max={max} step={step} value={currentValue} onChange={(e) => onChange(e.target.value)} className={styles.sliderInput} aria-label={question.text} disabled={disabled} /><span className={styles.sliderLabel}>{max}</span><span className={styles.sliderValueDisplay}>{currentValue}</span></div>); };
const MatrixQuestion = ({ question, value, onChange, disabled }) => { const matrixValue = typeof value === 'object' && value !== null ? value : {}; const handleMatrixChange = (row, column) => { if (disabled) { return; } if (question.matrixType === 'checkbox') { const currentCellState = matrixValue[row] && matrixValue[row][column]; const newRowValue = { ...(matrixValue[row] || {}), [column]: !currentCellState }; onChange({ ...matrixValue, [row]: newRowValue }); } else { onChange({ ...matrixValue, [row]: column }); } }; return (<table className={`${styles.matrixTable} ${disabled ? styles.disabled : ''}`}><thead><tr><th></th>{ensureArray(question.matrixColumns).map(col => <th key={col}>{col}</th>)}</tr></thead><tbody>{ensureArray(question.matrixRows).map(row => (<tr key={row}><td className={styles.matrixRowHeader}>{row}</td>{ensureArray(question.matrixColumns).map(col => (<td key={col} className={styles.matrixCell}><input type={question.matrixType === 'checkbox' ? 'checkbox' : 'radio'} name={question.matrixType === 'checkbox' ? `q-${question._id}-row-${row}-col-${col}` : `q-${question._id}-row-${row}`} value={col} checked={question.matrixType === 'checkbox' ? !!(matrixValue[row] && matrixValue[row][col]) : matrixValue[row] === col} onChange={() => handleMatrixChange(row, col)} aria-label={`${row} - ${col}`} className={styles.matrixRadio} disabled={disabled} /></td>))}</tr>))}</tbody></table>); };
const HeatmapQuestion = ({ question, value, onChange, disabled }) => { const clicks = Array.isArray(value) ? value : []; const maxClicks = (typeof question.heatmapMaxClicks === 'number' && question.heatmapMaxClicks > 0) ? question.heatmapMaxClicks : Infinity; const isLimitReached = clicks.length >= maxClicks; const handleHeatmapClick = (event) => { if (disabled || clicks.length >= maxClicks) { if (disabled) toast.info("This question is currently disabled."); else toast.warn(`You can only select up to ${maxClicks} point(s).`); return; } const imgElement = event.currentTarget; const rect = imgElement.getBoundingClientRect(); const x = (event.clientX - rect.left) / rect.width; const y = (event.clientY - rect.top) / rect.height; const boundedX = Math.max(0, Math.min(1, x)); const boundedY = Math.max(0, Math.min(1, y)); if ([...clicks, { x: boundedX, y: boundedY }].length <= maxClicks) { onChange([...clicks, { x: boundedX, y: boundedY }]); } else { toast.warn(`Maximum clicks (${maxClicks}) reached.`); } }; const handleClearClicks = () => { if (disabled) return; onChange([]); }; const currentCursor = disabled ? 'not-allowed' : (isLimitReached ? 'not-allowed' : 'crosshair'); return (<div className={`${styles.heatmapContainer} ${disabled ? styles.disabled : ''}`}>{question.imageUrl ? (<div style={{ position: 'relative', display: 'inline-block', cursor: currentCursor }}><img src={question.imageUrl} alt="Heatmap area" onClick={handleHeatmapClick} className={styles.heatmapImage} draggable="false" style={{ opacity: (disabled || isLimitReached) ? 0.5 : 1 }} />{clicks.map((click, index) => (<div key={index} style={{ position: 'absolute', left: `${click.x * 100}%`, top: `${click.y * 100}%`, width: '10px', height: '10px', backgroundColor: 'rgba(255, 0, 0, 0.7)', borderRadius: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none' }} title={`Click ${index + 1} (x: ${click.x.toFixed(2)}, y: ${click.y.toFixed(2)})`}></div>))}</div>) : (<p className={styles.errorMessage}>Image URL missing.</p>)}<p className={styles.clickCount}>Clicks recorded: {clicks.length}{maxClicks !== Infinity && ` / ${maxClicks}`}{isLimitReached && <span className={styles.limitReachedMessage}> (Limit reached)</span>}</p>{clicks.length > 0 && (<button onClick={handleClearClicks} className={styles.clearButton} disabled={disabled}>Clear Clicks</button>)}</div>); };
const MaxDiffQuestion = ({ question, value, onChange, disabled }) => { const selections = typeof value === 'object' && value !== null ? value : { best: null, worst: null }; const handleSelection = (type, option) => { if (disabled) return; const newSelections = { ...selections, [type]: option }; if (type === 'best' && newSelections.worst === option) newSelections.worst = null; if (type === 'worst' && newSelections.best === option) newSelections.best = null; onChange(newSelections); }; return (<table className={`${styles.maxDiffTable} ${disabled ? styles.disabled : ''}`}><thead><tr><th>Item</th><th>Best</th><th>Worst</th></tr></thead><tbody>{ensureArray(question.options).map(option => (<tr key={option}><td>{option}</td><td className={styles.maxDiffCell}><input type="radio" name={`q-${question._id}-best`} checked={selections.best === option} onChange={() => handleSelection('best', option)} aria-label={`Best - ${option}`} disabled={disabled} /></td><td className={styles.maxDiffCell}><input type="radio" name={`q-${question._id}-worst`} checked={selections.worst === option} onChange={() => handleSelection('worst', option)} aria-label={`Worst - ${option}`} disabled={disabled} /></td></tr>))}</tbody></table>); };
const ConjointQuestion = ({ question, value, onChange, disabled }) => { const profiles = ensureArray(question.conjointProfiles); const selectedProfileIndex = profiles.findIndex(p => JSON.stringify(p) === JSON.stringify(value)); if (profiles.length === 0) { return (<div className={styles.errorMessage}><p>Conjoint profiles are not available.</p></div>); } const handleConjointChange = (profile) => { if (disabled) return; onChange(profile); }; return (<div className={`${styles.conjointContainer} ${disabled ? styles.disabled : ''}`}><p>Select preferred profile:</p>{profiles.map((profile, index) => (<div key={index} className={styles.conjointProfile}><input type="radio" id={`q-${question._id}-prof-${index}`} name={`q-${question._id}`} checked={selectedProfileIndex === index} onChange={() => handleConjointChange(profile)} className={styles.radioInput} disabled={disabled} /><label htmlFor={`q-${question._id}-prof-${index}`} className={styles.conjointProfileLabel}><strong>Profile {index + 1}:</strong><ul>{Object.entries(profile).map(([attr, level]) => (<li key={attr}>{attr}: {level}</li>))}</ul></label></div>))}</div>); };
function SortableRankingItem({ id, children }) { const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: id }); const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, touchAction: 'none', }; return (<li ref={setNodeRef} style={style} {...attributes} {...listeners} className={styles.rankingItem}><span className={styles.dragHandle}>&#x2630;</span>{children}</li>); }
const RankingQuestion = ({ question, value, onChange, disabled }) => { const options = ensureArray(question.options); const ensureValidRankingArray = (val, optIds) => Array.isArray(val) && val.length === optIds.length && val.every(item => optIds.includes(item)) ? val : [...optIds]; const items = ensureValidRankingArray(value, options); useEffect(() => { if (!Array.isArray(value) || value.length !== options.length || !value.every(item => options.includes(item))) { onChange([...options]); } }, [value, onChange, options]); const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })); const handleDragEnd = (event) => { if (disabled) return; const { active, over } = event; if (over && active.id !== over.id) { const oldIndex = items.indexOf(active.id); const newIndex = items.indexOf(over.id); onChange(arrayMove(items, oldIndex, newIndex)); } }; return (<DndContext sensors={disabled ? [] : sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}><SortableContext items={items} strategy={verticalListSortingStrategy}><ol className={`${styles.rankingList} ${disabled ? styles.disabled : ''}`}>{items.map(item => (<SortableRankingItem key={item} id={item}>{item}</SortableRankingItem>))}</ol></SortableContext>{disabled && <div className={styles.disabledOverlay}></div>}</DndContext>); };
const CARD_SORT_UNASSIGNED_ID = '__UNASSIGNED__'; const CARD_SORT_USER_CATEGORY_PREFIX = '__USER_CAT__';
function SortableCard({ id, children, isOverlay }) { const { attributes, listeners, setNodeRef, transform, transition, isDragging, } = useSortable({ id }); const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.7 : 1, zIndex: isDragging ? 100 : 'auto', cursor: isOverlay ? 'grabbing' : 'grab', touchAction: 'none', }; return (<div ref={setNodeRef} style={style} {...attributes} {...listeners} className={styles.cardSortCard}>{children}</div>); }
function CardSortCategoryDropzone({ id, title, cards, children, onRemoveCategory, isUserCategory }) { const { setNodeRef, isOver } = useSortable({ id: id, data: { type: 'category' } }); const style = { backgroundColor: isOver ? '#e0e0e0' : '#f9f9f9', border: isOver ? '2px dashed #aaa' : '1px solid #eee', }; return (<div ref={setNodeRef} style={style} className={styles.cardSortCategory}><div className={styles.cardSortCategoryHeader}><h4 className={styles.cardSortCategoryTitle}>{title}</h4>{isUserCategory && onRemoveCategory && (<button onClick={() => onRemoveCategory(id)} className={styles.removeCategoryButton} title="Remove this category">&times;</button>)}</div><SortableContext items={cards.map(c => c.id)} strategy={rectSortingStrategy}><div className={styles.cardSortCardContainer}>{children}</div></SortableContext></div>); }
const CardSortQuestion = ({ question, value, onChange, disabled }) => { const [assignments, setAssignments] = useState({}); const [userCategories, setUserCategories] = useState([]); const [newCategoryName, setNewCategoryName] = useState(''); const [activeId, setActiveId] = useState(null); const predefinedCategories = useMemo(() => ensureArray(question.cardSortCategories), [question.cardSortCategories]); const allCards = useMemo(() => ensureArray(question.options).map(card => ({ id: card, content: card })), [question.options]); useEffect(() => { const initialAssignments = {}; const initialUserCats = []; const currentVal = typeof value === 'object' && value !== null ? value : {}; if (currentVal.assignments) { Object.assign(initialAssignments, currentVal.assignments); } if (Array.isArray(currentVal.userCategories)) { initialUserCats.push(...currentVal.userCategories); } allCards.forEach(card => { if (initialAssignments[card.id] === undefined) { initialAssignments[card.id] = CARD_SORT_UNASSIGNED_ID; } }); setAssignments(initialAssignments); setUserCategories(initialUserCats); }, [question, value, allCards]); const allCategoryIds = useMemo(() => [CARD_SORT_UNASSIGNED_ID, ...predefinedCategories, ...userCategories.map(cat => cat.id)], [predefinedCategories, userCategories]); const itemsByCategoryId = useMemo(() => { const grouped = {}; allCategoryIds.forEach(catId => { grouped[catId] = []; }); allCards.forEach(card => { const assignedCategoryId = assignments[card.id] || CARD_SORT_UNASSIGNED_ID; if (grouped[assignedCategoryId]) { grouped[assignedCategoryId].push(card); } else { grouped[CARD_SORT_UNASSIGNED_ID].push(card); } }); return grouped; }, [assignments, allCategoryIds, allCards]); const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })); const handleAddUserCategory = () => { if (disabled || !newCategoryName.trim()) return; const newId = `${CARD_SORT_USER_CATEGORY_PREFIX}${Date.now()}_${Math.random().toString(36).substring(2, 7)}`; const newCat = { id: newId, name: newCategoryName.trim() }; const updatedUserCats = [...userCategories, newCat]; setUserCategories(updatedUserCats); setNewCategoryName(''); onChange({ assignments, userCategories: updatedUserCats }); }; const handleRemoveUserCategory = (categoryIdToRemove) => { if (disabled) return; const updatedAssignments = { ...assignments }; allCards.forEach(card => { if (assignments[card.id] === categoryIdToRemove) { updatedAssignments[card.id] = CARD_SORT_UNASSIGNED_ID; } }); const updatedUserCats = userCategories.filter(cat => cat.id !== categoryIdToRemove); setUserCategories(updatedUserCats); setAssignments(updatedAssignments); onChange({ assignments: updatedAssignments, userCategories: updatedUserCats }); }; const handleDragStart = (event) => { if (disabled) return; setActiveId(event.active.id); }; const handleDragEnd = (event) => { setActiveId(null); if (disabled) return; const { active, over } = event; if (!over) return; const activeCardId = active.id; const overId = over.id; const overIsCategory = over.data.current?.type === 'category'; const sourceCategoryId = assignments[activeCardId] || CARD_SORT_UNASSIGNED_ID; let targetCategoryId = overIsCategory ? overId : (assignments[overId] || CARD_SORT_UNASSIGNED_ID); if (!allCategoryIds.includes(targetCategoryId)) return; if (sourceCategoryId !== targetCategoryId) { const updatedAssignments = { ...assignments, [activeCardId]: targetCategoryId }; setAssignments(updatedAssignments); onChange({ assignments: updatedAssignments, userCategories }); } }; const activeCard = activeId ? allCards.find(card => card.id === activeId) : null; return (<DndContext sensors={disabled ? [] : sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}><div className={`${styles.cardSortContainer} ${disabled ? styles.disabled : ''}`}><CardSortCategoryDropzone id={CARD_SORT_UNASSIGNED_ID} title="Unassigned Cards" cards={itemsByCategoryId[CARD_SORT_UNASSIGNED_ID]}>{itemsByCategoryId[CARD_SORT_UNASSIGNED_ID].map(card => (<SortableCard key={card.id} id={card.id}>{card.content}</SortableCard>))}{itemsByCategoryId[CARD_SORT_UNASSIGNED_ID].length === 0 && <span className={styles.emptyCategoryPlaceholder}>Drag cards here</span>}</CardSortCategoryDropzone>{predefinedCategories.map(categoryName => (<CardSortCategoryDropzone key={categoryName} id={categoryName} title={categoryName} cards={itemsByCategoryId[categoryName]}>{itemsByCategoryId[categoryName].map(card => (<SortableCard key={card.id} id={card.id}>{card.content}</SortableCard>))}{itemsByCategoryId[categoryName].length === 0 && <span className={styles.emptyCategoryPlaceholder}>Drag cards here</span>}</CardSortCategoryDropzone>))}{userCategories.map(category => (<CardSortCategoryDropzone key={category.id} id={category.id} title={category.name} cards={itemsByCategoryId[category.id]} onRemoveCategory={handleRemoveUserCategory} isUserCategory={true}>{itemsByCategoryId[category.id]?.map(card => (<SortableCard key={card.id} id={card.id}>{card.content}</SortableCard>))}{itemsByCategoryId[category.id]?.length === 0 && <span className={styles.emptyCategoryPlaceholder}>Drag cards here</span>}</CardSortCategoryDropzone>))}{question.cardSortAllowUserCategories && !disabled && (<div className={styles.addUserCategory}><input type="text" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="New category name" className={styles.addUserCategoryInput} /><button onClick={handleAddUserCategory} className={styles.addUserCategoryButton}>+ Add Category</button></div>)}{disabled && <div className={styles.disabledOverlay}></div>}</div><DragOverlay>{activeCard ? <SortableCard id={activeCard.id} isOverlay>{activeCard.content}</SortableCard> : null}</DragOverlay></DndContext>); };

// --- Utility Functions ---
const ensureArray = (value) => (Array.isArray(value) ? value : []);
const isAnswerEmpty = (value, questionType) => { if (value === null || value === undefined) return true; if (typeof value === 'string' && value.trim() === '') return true; if (questionType === 'checkbox' && typeof value === 'string') { return value.split('||').filter(v => v !== '').length === 0; } if (questionType === 'cardsort' && typeof value === 'object' && value !== null) { if (!value.assignments || typeof value.assignments !== 'object') return true; const assignments = value.assignments; return Object.keys(assignments).length === 0 || Object.values(assignments).every(catId => catId === CARD_SORT_UNASSIGNED_ID); } if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) return true; if (Array.isArray(value) && value.length === 0) return true; return false; };
const shuffleArray = (array) => { let currentIndex = array.length, randomIndex; const newArray = [...array]; while (currentIndex !== 0) { randomIndex = Math.floor(Math.random() * currentIndex); currentIndex--; [newArray[currentIndex], newArray[randomIndex]] = [newArray[randomIndex], newArray[currentIndex]]; } return newArray; };

// --- Logic Evaluation Helpers ---
const evaluateCondition = (condition, allAnswers, questionsById) => { if (!condition || !condition.sourceQuestionId || !condition.conditionOperator) { return false; } const { sourceQuestionId, conditionOperator, conditionValue } = condition; const sourceQuestion = questionsById[sourceQuestionId]; if (!sourceQuestion) { return false; } const answer = allAnswers[sourceQuestionId]; const questionType = sourceQuestion.type; const answerIsEmpty = isAnswerEmpty(answer, questionType); if (conditionOperator === 'isEmpty') return answerIsEmpty; if (conditionOperator === 'isNotEmpty') return !answerIsEmpty; if (answerIsEmpty && !conditionOperator.startsWith('clickCount') && conditionOperator !== 'clickInArea') return false; const currentAnswerValue = (questionType === 'checkbox') ? String(answer ?? '').split('||').filter(v => v !== '') : answer; let result = false; try { switch (conditionOperator) { case 'eq': result = String(currentAnswerValue) === String(conditionValue); break; case 'ne': result = String(currentAnswerValue) !== String(conditionValue); break; case 'contains': result = (questionType === 'checkbox') ? ensureArray(currentAnswerValue).includes(String(conditionValue)) : String(currentAnswerValue).toLowerCase().includes(String(conditionValue).toLowerCase()); break; case 'notContains': result = (questionType === 'checkbox') ? !ensureArray(currentAnswerValue).includes(String(conditionValue)) : !String(currentAnswerValue).toLowerCase().includes(String(conditionValue).toLowerCase()); break; case 'gt': result = Number(currentAnswerValue) > Number(conditionValue); break; case 'lt': result = Number(currentAnswerValue) < Number(conditionValue); break; case 'gte': result = Number(currentAnswerValue) >= Number(conditionValue); break; case 'lte': result = Number(currentAnswerValue) <= Number(conditionValue); break; case 'clickCountEq': case 'clickCountGt': case 'clickCountGte': case 'clickCountLt': case 'clickCountLte': if (questionType === 'heatmap') { const clicksArray = Array.isArray(currentAnswerValue) ? currentAnswerValue : []; const clickCount = clicksArray.length; const targetClicks = parseInt(conditionValue, 10); if (isNaN(targetClicks)) { result = false; } else { if (conditionOperator === 'clickCountEq') result = clickCount === targetClicks; else if (conditionOperator === 'clickCountGt') result = clickCount > targetClicks; else if (conditionOperator === 'clickCountGte') result = clickCount >= targetClicks; else if (conditionOperator === 'clickCountLt') result = clickCount < targetClicks; else if (conditionOperator === 'clickCountLte') result = clickCount <= targetClicks; } } else { result = false; } break; case 'clickInArea': if (questionType === 'heatmap') { const clicksArray = Array.isArray(currentAnswerValue) ? currentAnswerValue : []; if (clicksArray.length === 0) { result = false; break; } let areaDef; try { areaDef = JSON.parse(conditionValue); } catch (e) { result = false; break; } if (!areaDef || typeof areaDef.x !== 'number' || typeof areaDef.y !== 'number' || typeof areaDef.width !== 'number' || typeof areaDef.height !== 'number') { result = false; break; } result = clicksArray.some(click => typeof click.x === 'number' && typeof click.y === 'number' && click.x >= areaDef.x && click.x <= areaDef.x + areaDef.width && click.y >= areaDef.y && click.y <= areaDef.y + areaDef.height); } else { result = false; } break; default: result = false; } } catch (e) { console.error("Error evaluating condition:", condition, e); result = false; } return result; };
const evaluateGroup = (group, allAnswers, questionsById) => { if (!group || !Array.isArray(group.conditions) || group.conditions.length === 0) return false; const { groupOperator = 'AND', conditions } = group; if (groupOperator === 'AND') return conditions.every(condition => evaluateCondition(condition, allAnswers, questionsById)); if (groupOperator === 'OR') return conditions.some(condition => evaluateCondition(condition, allAnswers, questionsById)); return false; };
const evaluateRule = (rule, allAnswers, questionsById) => { if (!rule || !Array.isArray(rule.groups) || rule.groups.length === 0) return false; const { overallOperator = 'AND', groups } = rule; if (overallOperator === 'AND') return groups.every(group => evaluateGroup(group, allAnswers, questionsById)); if (overallOperator === 'OR') return groups.some(group => evaluateGroup(group, allAnswers, questionsById)); return false; };

// --- Main Survey Taking Page Component ---
function SurveyTakingPage() {
    const { surveyId, collectorId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [survey, setSurvey] = useState(null);
    const [originalQuestions, setOriginalQuestions] = useState([]);
    const [currentAnswers, setCurrentAnswers] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [sessionId] = useState(() => Date.now().toString(36) + Math.random().toString(36).substring(2));
    const [otherInputValues, setOtherInputValues] = useState({});
    const [randomizedQuestionOrder, setRandomizedQuestionOrder] = useState([]);
    const [randomizedOptionOrders, setRandomizedOptionOrders] = useState({});
    const [hiddenQuestionIds, setHiddenQuestionIds] = useState(new Set());
    const [visibleQuestionIndices, setVisibleQuestionIndices] = useState([]);
    const [currentVisibleIndex, setCurrentVisibleIndex] = useState(0);
    const [visitedPath, setVisitedPath] = useState([]);
    const [isDisqualified, setIsDisqualified] = useState(false);
    const [disqualificationMessage, setDisqualificationMessage] = useState('');
    const [recaptchaEnabled, setRecaptchaEnabled] = useState(false);
    const [recaptchaSiteKey, setRecaptchaSiteKey] = useState('');
    const [recaptchaToken, setRecaptchaToken] = useState(null);
    const recaptchaRef = React.createRef();

    // Consistent internal keys
    const NA_VALUE_INTERNAL = '__NA__';
    const OTHER_VALUE_INTERNAL = '__OTHER__';

    const questionsById = useMemo(() => originalQuestions.reduce((map, q) => { if(q) map[q._id] = q; return map; }, {}), [originalQuestions]);
    const questionsInCurrentOrder = useMemo(() => { return (randomizedQuestionOrder.length > 0 && originalQuestions.length > 0) ? randomizedQuestionOrder.map(index => originalQuestions[index]).filter(q => q) : originalQuestions.filter(q => q); }, [randomizedQuestionOrder, originalQuestions]);
    const questionIdToOriginalIndexMap = useMemo(() => originalQuestions.reduce((map, q, index) => { if(q) map[q._id] = index; return map; }, {}), [originalQuestions]);
    
    let currentQToRenderMemoized = null; let isSubmitStateDerived = false; if (!isLoading && survey) { const localCVI = currentVisibleIndex; if (visibleQuestionIndices.length === 0 && originalQuestions.length > 0) { isSubmitStateDerived = true; } else if (visibleQuestionIndices.length === 0 && originalQuestions.length === 0) { isSubmitStateDerived = true; } else if (localCVI >= 0 && localCVI < visibleQuestionIndices.length) { const currentOriginalIdx = visibleQuestionIndices[localCVI]; currentQToRenderMemoized = originalQuestions[currentOriginalIdx]; } else if (localCVI >= visibleQuestionIndices.length && originalQuestions.length > 0) { isSubmitStateDerived = true; } }
    
    useEffect(() => { if (location.state && location.state.collectorSettings) { const { collectorSettings } = location.state; console.log("[SurveyTakingPage] Received collectorSettings from location state:", collectorSettings); setRecaptchaEnabled(Boolean(collectorSettings.enableRecaptcha)); if (collectorSettings.enableRecaptcha && collectorSettings.recaptchaSiteKey) { setRecaptchaSiteKey(collectorSettings.recaptchaSiteKey); console.log("[SurveyTakingPage] reCAPTCHA Site Key SET TO (from collectorSettings):", collectorSettings.recaptchaSiteKey); } else { const envSiteKey = process.env.REACT_APP_RECAPTCHA_SITE_KEY; if (envSiteKey) { setRecaptchaSiteKey(envSiteKey); if (collectorSettings.enableRecaptcha) { setRecaptchaEnabled(true); } console.log("[SurveyTakingPage] Using reCAPTCHA site key from ENV:", envSiteKey); } else { console.warn("[SurveyTakingPage] reCAPTCHA site key not found in collector settings or ENV. reCAPTCHA will be disabled."); setRecaptchaEnabled(false); } } } else { const envSiteKey = process.env.REACT_APP_RECAPTCHA_SITE_KEY; if (envSiteKey) { setRecaptchaSiteKey(envSiteKey); setRecaptchaEnabled(true); console.log("[SurveyTakingPage] Using reCAPTCHA site key from ENV (no collectorSettings in location):", envSiteKey); } else { console.warn("[SurveyTakingPage] Collector settings not found in location state and no ENV fallback. reCAPTCHA might not function if enabled by default elsewhere or will be disabled."); setRecaptchaEnabled(false); } } }, [location.state]);
    const fetchSurvey = useCallback(async () => { setIsLoading(true); setError(null); setHiddenQuestionIds(new Set()); setIsDisqualified(false); setCurrentVisibleIndex(0); setVisitedPath([]); setRecaptchaToken(null); if (!surveyId) { setError("Survey ID is missing from the URL."); setIsLoading(false); toast.error("Survey ID is missing."); return; } try { console.log(`[SurveyTakingPage fetchSurvey] Fetching survey with ID: ${surveyId} (Collector ID from URL: ${collectorId})`); const responsePayload = await surveyApi.getSurveyById(surveyId); if (responsePayload && responsePayload.data) { console.log('[SurveyTakingPage fetchSurvey] Survey data from API:', JSON.parse(JSON.stringify(responsePayload.data))); } else { console.log('[SurveyTakingPage fetchSurvey] Raw response from surveyApi (no data field or empty):', responsePayload); } if (!responsePayload || !responsePayload.success || !responsePayload.data) { const errorMsg = responsePayload?.message || "Failed to retrieve survey data or data is in an invalid format."; throw new Error(errorMsg); } const surveyData = responsePayload.data; if (!surveyData || surveyData.questions === undefined || surveyData.questions === null) { throw new Error("Survey data is missing the 'questions' field."); } else if (!Array.isArray(surveyData.questions)) { throw new Error("'questions' field in survey data is not an array."); } setSurvey({ _id: surveyData._id, title: surveyData.title, description: surveyData.description, randomizationType: surveyData.randomizationLogic?.type || 'none', randomizationBlocks: surveyData.randomizationLogic?.blocks || [], globalSkipLogic: surveyData.globalSkipLogic || [], settings: surveyData.settings || {} }); setOriginalQuestions(surveyData.questions || []); let initialOrderIndices = (surveyData.questions || []).map((_, index) => index); const { randomizationLogic } = surveyData; if (randomizationLogic?.type === 'all') { initialOrderIndices = shuffleArray(initialOrderIndices); } else if (randomizationLogic?.type === 'blocks' && ensureArray(randomizationLogic?.blocks).length > 0) { let newOrder = []; const unblockedIndices = [...initialOrderIndices]; randomizationLogic.blocks.forEach(block => { const blockIndices = ensureArray(block.questionIndices).filter(idx => unblockedIndices.includes(idx)); if (block.randomize) newOrder.push(...shuffleArray(blockIndices)); else newOrder.push(...blockIndices); blockIndices.forEach(idx => { const pos = unblockedIndices.indexOf(idx); if (pos > -1) unblockedIndices.splice(pos, 1); }); }); newOrder.push(...unblockedIndices); initialOrderIndices = newOrder; } setRandomizedQuestionOrder(initialOrderIndices); const initialOptionOrders = {}; (surveyData.questions || []).forEach((q, qIndex) => { if (q && q.randomizeOptions) { initialOptionOrders[q._id] = shuffleArray(ensureArray(q.options).map((_, optIndex) => optIndex)); }}); setRandomizedOptionOrders(initialOptionOrders); const initialAnswers = {}; (surveyData.questions || []).forEach(q => { if (q) { let defaultAnswer = ''; if (q.type === 'checkbox') defaultAnswer = ''; else if (q.type === 'slider') defaultAnswer = String(Math.round(((q.sliderMin ?? 0) + (q.sliderMax ?? 100)) / 2)); else if (q.type === 'ranking') defaultAnswer = ensureArray(q.options); else if (q.type === 'cardsort') defaultAnswer = { assignments: {}, userCategories: [] }; else if (q.type === 'maxdiff') defaultAnswer = { best: null, worst: null }; initialAnswers[q._id] = defaultAnswer; } }); setCurrentAnswers(initialAnswers); setOtherInputValues({}); } catch (err) { const errorMessage = err.response?.data?.message || err.message || "Could not load survey details."; setError(errorMessage); toast.error(`Error loading survey: ${errorMessage}`); } finally { setIsLoading(false); } }, [surveyId, collectorId]);
    useEffect(() => { fetchSurvey(); }, [fetchSurvey]);
    useEffect(() => { if (isLoading || !originalQuestions || originalQuestions.length === 0) { if(visibleQuestionIndices.length > 0) setVisibleQuestionIndices([]); return; } const newVisibleOriginalIndices = questionsInCurrentOrder .map(question => question ? questionIdToOriginalIndexMap[question._id] : undefined) .filter(originalIndex => { if (originalIndex === undefined) return false; const question = originalQuestions[originalIndex]; return question && !hiddenQuestionIds.has(question._id); }); setVisibleQuestionIndices(prevIndices => { if (JSON.stringify(prevIndices) !== JSON.stringify(newVisibleOriginalIndices)) { return newVisibleOriginalIndices; } return prevIndices; }); }, [isLoading, originalQuestions, questionsInCurrentOrder, hiddenQuestionIds, questionIdToOriginalIndexMap, randomizedQuestionOrder, visibleQuestionIndices.length]);
    useEffect(() => { if (isLoading || !survey || isDisqualified) return; if (visibleQuestionIndices.length === 0) { if (currentVisibleIndex !== 0) setCurrentVisibleIndex(0); if(visitedPath.length > 0) setVisitedPath([]); return; } const currentPointsToValidQuestion = currentVisibleIndex < visibleQuestionIndices.length; if (!currentPointsToValidQuestion && currentVisibleIndex !== visibleQuestionIndices.length) { for (let i = visitedPath.length - 1; i >= 0; i--) { const pathOriginalIndex = visitedPath[i]; const pathVisibleIndex = visibleQuestionIndices.indexOf(pathOriginalIndex); if (pathVisibleIndex !== -1) { setCurrentVisibleIndex(pathVisibleIndex); return; } } setCurrentVisibleIndex(0); } }, [visibleQuestionIndices, isLoading, survey, isDisqualified, currentVisibleIndex, visitedPath]);
    useEffect(() => { if (currentQToRenderMemoized) { console.log('[SurveyTakingPage Debug] Current question to render (derived):', JSON.parse(JSON.stringify(currentQToRenderMemoized))); } else { console.log('[SurveyTakingPage Debug] Conditions not met for currentQToRenderMemoized or in submit state. States:', { isLoading, surveyExists: !!survey, oqLength: originalQuestions.length, viLength: visibleQuestionIndices.length, cvi: currentVisibleIndex, isSubmitStateCalc: isSubmitStateDerived }); } }, [currentQToRenderMemoized, isLoading, survey, originalQuestions.length, visibleQuestionIndices.length, currentVisibleIndex, isSubmitStateDerived]);

    const evaluateDisabled = useCallback((questionOriginalIndex) => originalQuestions[questionOriginalIndex]?.isDisabled === true, [originalQuestions]);
    const evaluateActionLogic = useCallback((questionOriginalIndex) => { const q = originalQuestions[questionOriginalIndex]; if (!q?.skipLogic?.length) return null; for (const r of q.skipLogic) if (evaluateRule(r, currentAnswers, questionsById)) return r.action; return null; }, [originalQuestions, currentAnswers, questionsById]);
    const evaluateGlobalLogic = useCallback(() => { if (!survey?.globalSkipLogic?.length) return null; for (const r of survey.globalSkipLogic) if (evaluateRule(r, currentAnswers, questionsById)) return r.action; return null; }, [survey, currentAnswers, questionsById]);
    const handleInputChange = useCallback((questionId, value) => { setCurrentAnswers(prev => ({ ...prev, [questionId]: value })); const q = questionsById[questionId]; if (q && ['multiple-choice', 'dropdown'].includes(q.type) && value !== OTHER_VALUE_INTERNAL) { setOtherInputValues(prev => { const n = { ...prev }; delete n[questionId]; return n; }); } }, [questionsById, OTHER_VALUE_INTERNAL]);
    
    // MODIFIED: handleCheckboxChange
    const handleCheckboxChange = useCallback((questionId, optionValue, isChecked) => {
        setCurrentAnswers(prevAnswers => {
            const question = questionsById[questionId];
            const currentSelectionsArray = prevAnswers[questionId] ? String(prevAnswers[questionId]).split('||').filter(v => v) : [];
            let newSelectionsArray = [...currentSelectionsArray];

            // Determine the actual N/A value for this question (from config or default)
            // Your QuestionEditPanel.js uses `addNAOption` but doesn't explicitly store `naValue` or `naIsExclusive`.
            // We'll assume a default internal value and that N/A is exclusive if `addNAOption` is true.
            const actualNaValue = question?.naValue || NA_VALUE_INTERNAL; // Use configured or default
            const naIsExclusive = question?.naIsExclusive === undefined ? (question?.addNAOption || false) : question.naIsExclusive;

            if (isChecked) {
                // If the current option being checked is N/A and it's exclusive
                if (optionValue === actualNaValue && naIsExclusive) {
                    newSelectionsArray = [actualNaValue]; // N/A becomes the only selection
                    // Clear "Other" text if N/A is selected
                    setOtherInputValues(prevOther => {
                        const updatedOther = { ...prevOther };
                        delete updatedOther[questionId];
                        return updatedOther;
                    });
                } else {
                    // If checking a regular option or "Other"
                    // Remove N/A if it was selected and is exclusive
                    if (naIsExclusive && newSelectionsArray.includes(actualNaValue)) {
                        newSelectionsArray = newSelectionsArray.filter(item => item !== actualNaValue);
                    }
                    // Add the new option if not already present
                    if (!newSelectionsArray.includes(optionValue)) {
                        newSelectionsArray.push(optionValue);
                    }
                }
            } else {
                // Unchecking an option
                newSelectionsArray = newSelectionsArray.filter(item => item !== optionValue);
                // If "Other" is unchecked, clear its text
                if (optionValue === OTHER_VALUE_INTERNAL) {
                    setOtherInputValues(prevOther => {
                        const updatedOther = { ...prevOther };
                        delete updatedOther[questionId];
                        return updatedOther;
                    });
                }
            }
            
            // Handle maxSelections limit (if defined in question object from QuestionEditPanel)
            // `limitAnswers` (boolean from QEP) & `limitAnswersMax` (number from QEP)
            const maxSelections = (question?.limitAnswers && question.limitAnswersMax > 0) ? question.limitAnswersMax : null;
            if (maxSelections !== null && newSelectionsArray.length > maxSelections) {
                // If N/A is being checked and it's exclusive, allow it even if it "exceeds" max (as it clears others)
                if (!(isChecked && optionValue === actualNaValue && naIsExclusive)) {
                    toast.warn(`You can select a maximum of ${maxSelections} options.`);
                    return prevAnswers; // Revert to previous state if max is exceeded
                }
            }
            
            // Handle minSelections for validation (this is usually checked on "Next" or "Submit")
            // but you could add immediate feedback if desired.
            // const minSelections = question?.minAnswersRequired > 0 ? question.minAnswersRequired : null;
            // if (minSelections && newSelectionsArray.length < minSelections && newSelectionsArray.length > 0) {
            //     toast.info(`Please select at least ${minSelections} options.`);
            // }


            return { ...prevAnswers, [questionId]: newSelectionsArray.join('||') };
        });
    }, [questionsById, NA_VALUE_INTERNAL, OTHER_VALUE_INTERNAL]); // Added dependencies

    const handleOtherInputChange = useCallback((questionId, textValue) => { setOtherInputValues(prev => ({ ...prev, [questionId]: textValue })); }, []);

    const validateQuestion = useCallback((question, answer, isSoftCheck = false, isDisabled = false) => {
        if (isDisabled || !question) return true;

        // Check for general requirement (is an answer provided at all)
        if (question.requiredSetting === 'required' || question.requiredSetting === 'soft_required') {
            if (isAnswerEmpty(answer, question.type)) {
                if (!isSoftCheck && question.requiredSetting === 'required') {
                     toast.warn(`"${question.text}" is required.`);
                } else if (!isSoftCheck && question.requiredSetting === 'soft_required') {
                    // For soft_required, you might just highlight or give a softer prompt, not block.
                    // For now, let's treat it as blocking for validation simplicity, but you can change this.
                    // toast.info(`"${question.text}" is recommended.`);
                }
                return false; // Block if required and empty
            }
        }
        
        // Check if "Other" option is selected and its text input is required (from QuestionEditPanel: `requireOtherIfSelected`) but empty
        if (question.addOtherOption && question.requireOtherIfSelected) {
            if ((question.type === 'multiple-choice' || question.type === 'dropdown') && answer === OTHER_VALUE_INTERNAL && !otherInputValues[question._id]?.trim()) {
                if (!isSoftCheck) toast.warn(`Please specify your 'Other' answer for "${question.text}".`);
                return false;
            }
            if (question.type === 'checkbox' && String(answer).includes(OTHER_VALUE_INTERNAL) && !otherInputValues[question._id]?.trim()) {
                if (!isSoftCheck) toast.warn(`Please specify your 'Other' answer for "${question.text}".`);
                return false;
            }
        }

        // Checkbox specific min/max answers (from QuestionEditPanel: `minAnswersRequired`, `limitAnswers`, `limitAnswersMax`)
        if (question.type === 'checkbox') {
            const selections = String(answer || '').split('||').filter(Boolean);
            const minRequired = question.minAnswersRequired > 0 ? question.minAnswersRequired : null;
            const maxLimit = (question.limitAnswers && question.limitAnswersMax > 0) ? question.limitAnswersMax : null;

            if (minRequired && selections.length < minRequired) {
                if (!isSoftCheck) toast.warn(`Please select at least ${minRequired} option(s) for "${question.text}".`);
                return false;
            }
            // Max limit is already handled during selection in handleCheckboxChange, but good to have a final check.
            if (maxLimit && selections.length > maxLimit) {
                 if (!isSoftCheck) toast.warn(`Please select no more than ${maxLimit} option(s) for "${question.text}".`);
                 return false; // Should ideally not be hit if handleCheckboxChange is correct
            }
        }
        return true;
    }, [otherInputValues, OTHER_VALUE_INTERNAL]); // Added OTHER_VALUE_INTERNAL

    const renderQuestion = useCallback((questionToRenderArg) => { if (!questionToRenderArg || !questionToRenderArg._id) { console.error("[SurveyTakingPage renderQuestion] Invalid question object received:", questionToRenderArg); return <div className={styles.errorMessage}>Error: Question data is invalid.</div>; } const questionId = questionToRenderArg._id; const baseProps = { question: questionToRenderArg, currentAnswer: currentAnswers[questionId], otherValue: otherInputValues[questionId], onAnswerChange: handleInputChange, onOtherTextChange: handleOtherInputChange, onCheckboxChange: handleCheckboxChange, isSubmitted: false, questionIndex: questionIdToOriginalIndexMap[questionId], optionsOrder: randomizedOptionOrders[questionId], disabled: evaluateDisabled(questionIdToOriginalIndexMap[questionId]), }; switch (questionToRenderArg.type) { case 'text': return <ShortTextQuestion key={questionId} {...baseProps} />; case 'textarea': return <TextAreaQuestion key={questionId} {...baseProps} />; case 'multiple-choice': return <MultipleChoiceQuestion key={questionId} {...baseProps} />; case 'checkbox': return <CheckboxQuestion key={questionId} {...baseProps} />; case 'dropdown': return <DropdownQuestion key={questionId} {...baseProps} />; case 'rating': return <RatingQuestion key={questionId} {...baseProps} />; case 'nps': return <NpsQuestion key={questionId} {...baseProps} />; case 'matrix': return <MatrixQuestion key={questionId} {...baseProps} value={currentAnswers[questionId]} onChange={(val) => handleInputChange(questionId, val)} />; case 'slider': return <SliderQuestion key={questionId} {...baseProps} value={currentAnswers[questionId]} onChange={(val) => handleInputChange(questionId, val)} />; case 'ranking': return <RankingQuestion key={questionId} {...baseProps} value={currentAnswers[questionId]} onChange={(val) => handleInputChange(questionId, val)} />; case 'heatmap': return <HeatmapQuestion key={questionId} {...baseProps} value={currentAnswers[questionId]} onChange={(val) => handleInputChange(questionId, val)} />; case 'maxdiff': return <MaxDiffQuestion key={questionId} {...baseProps} value={currentAnswers[questionId]} onChange={(val) => handleInputChange(questionId, val)} />; case 'conjoint': return <ConjointQuestion key={questionId} {...baseProps} value={currentAnswers[questionId]} onChange={(val) => handleInputChange(questionId, val)} />; case 'cardsort': return <CardSortQuestion key={questionId} {...baseProps} value={currentAnswers[questionId]} onChange={(val) => handleInputChange(questionId, val)} />; default: console.warn(`[SurveyTakingPage] Unknown question type: ${questionToRenderArg.type} for question ID: ${questionId}`); if (['email', 'number', 'date'].includes(questionToRenderArg.type)) { return <ShortTextQuestion key={questionId} {...baseProps} />; } return <div key={questionId} className={styles.errorMessage}>Unsupported question type: {questionToRenderArg.type}</div>; } }, [currentAnswers, otherInputValues, handleInputChange, questionIdToOriginalIndexMap, handleOtherInputChange, handleCheckboxChange, randomizedOptionOrders, evaluateDisabled]);
    const handleNext = useCallback(() => { if (isDisqualified || isLoading) return; const currentOriginalIndex = visibleQuestionIndices[currentVisibleIndex]; const currentQ = originalQuestions[currentOriginalIndex]; const isDisabled = evaluateDisabled(currentOriginalIndex); if (!validateQuestion(currentQ, currentAnswers[currentQ._id], false, isDisabled)) { return; } const newVisitedPath = [...visitedPath]; if (!newVisitedPath.includes(currentOriginalIndex)) { newVisitedPath.push(currentOriginalIndex); } setVisitedPath(newVisitedPath); const globalAction = evaluateGlobalLogic(); if (globalAction) { if (globalAction.type === 'disqualifyRespondent') { setIsDisqualified(true); setDisqualificationMessage(globalAction.disqualificationMessage || "Disqualified by global logic."); return; } if (globalAction.type === 'jumpToQuestion') { const targetOriginalIndex = questionIdToOriginalIndexMap[globalAction.targetQuestionId]; if (targetOriginalIndex !== undefined) { const targetVisibleIndex = visibleQuestionIndices.indexOf(targetOriginalIndex); if (targetVisibleIndex !== -1) { setCurrentVisibleIndex(targetVisibleIndex); return; } else { setHiddenQuestionIds(prev => new Set(prev).add(globalAction.targetQuestionId)); } } } } const localAction = evaluateActionLogic(currentOriginalIndex); if (localAction) { if (localAction.type === 'disqualifyRespondent') { setIsDisqualified(true); setDisqualificationMessage(localAction.disqualificationMessage || "Disqualified by question logic."); return; } if (localAction.type === 'jumpToQuestion') { const targetOriginalIndex = questionIdToOriginalIndexMap[localAction.targetQuestionId]; if (targetOriginalIndex !== undefined) { const targetVisibleIndex = visibleQuestionIndices.indexOf(targetOriginalIndex); if (targetVisibleIndex !== -1) { setCurrentVisibleIndex(targetVisibleIndex); return; } else { setHiddenQuestionIds(prev => new Set(prev).add(localAction.targetQuestionId)); } } } } if (currentVisibleIndex < visibleQuestionIndices.length - 1) { setCurrentVisibleIndex(prev => prev + 1); } else { setCurrentVisibleIndex(prev => prev + 1); } }, [currentVisibleIndex, visibleQuestionIndices, isDisqualified, isLoading, originalQuestions, currentAnswers, evaluateDisabled, validateQuestion, setVisitedPath, visitedPath, evaluateGlobalLogic, evaluateActionLogic, questionIdToOriginalIndexMap, setHiddenQuestionIds, setIsDisqualified, setDisqualificationMessage]);
    const handlePrevious = useCallback(() => { if (isDisqualified || isLoading || visitedPath.length === 0) return; const lastVisitedOriginalIndex = visitedPath[visitedPath.length - 1]; const lastVisitedVisibleIndex = visibleQuestionIndices.indexOf(lastVisitedOriginalIndex); if (lastVisitedVisibleIndex !== -1 && lastVisitedVisibleIndex < currentVisibleIndex) { setCurrentVisibleIndex(lastVisitedVisibleIndex); setVisitedPath(prev => prev.slice(0, -1)); } else if (currentVisibleIndex > 0) { setCurrentVisibleIndex(prev => prev - 1); const currentOriginalIndexOfPrevious = visibleQuestionIndices[currentVisibleIndex -1]; setVisitedPath(prev => prev.filter(p => p !== currentOriginalIndexOfPrevious)); } }, [isDisqualified, isLoading, visitedPath, currentVisibleIndex, visibleQuestionIndices]);

    const handleSubmit = useCallback(async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        if (!collectorId) { toast.error("Collector ID is missing. Cannot submit survey."); setError("Collector ID is missing from the URL. Please use a valid survey link."); setIsSubmitting(false); return; }
        if (recaptchaEnabled && !recaptchaToken && recaptchaSiteKey) { toast.error("Please complete the reCAPTCHA verification."); setIsSubmitting(false); return; }

        let firstInvalidVisibleIndex = -1;
        for (let visIdx = 0; visIdx < visibleQuestionIndices.length; visIdx++) {
            const originalIdx = visibleQuestionIndices[visIdx];
            const q = originalQuestions[originalIdx];
            const isDisabled = evaluateDisabled(originalIdx);
            if (q && !validateQuestion(q, currentAnswers[q._id], false, isDisabled)) {
                firstInvalidVisibleIndex = visIdx;
                break;
            }
        }
        if (firstInvalidVisibleIndex !== -1) { setCurrentVisibleIndex(firstInvalidVisibleIndex); toast.error("Please answer all required questions before submitting."); setIsSubmitting(false); return; }

        const answersToSubmit = Object.entries(currentAnswers)
            .filter(([questionId, answerValue]) => {
                const question = questionsById[questionId];
                return question && visibleQuestionIndices.includes(questionIdToOriginalIndexMap[questionId]);
            })
            .map(([questionId, answerValue]) => {
                const question = questionsById[questionId];
                let textForOther = null;
                // Use question.addOtherOption from QEP to check if "Other" is enabled
                if (question.addOtherOption) { 
                    if ((question.type === 'multiple-choice' || question.type === 'dropdown') && answerValue === OTHER_VALUE_INTERNAL) {
                        textForOther = otherInputValues[questionId]?.trim() || '';
                    } else if (question.type === 'checkbox' && String(answerValue).includes(OTHER_VALUE_INTERNAL)) {
                        textForOther = otherInputValues[questionId]?.trim() || '';
                    }
                }
                return {
                    questionId,
                    questionType: question.type,
                    answerValue: answerValue,
                    otherText: textForOther,
                    questionText: question.text
                };
            });
        
        if (answersToSubmit.every(ans => isAnswerEmpty(ans.answerValue, ans.questionType) && !ans.otherText) && originalQuestions.length > 0 && visibleQuestionIndices.length > 0) {
             const anyRequiredVisibleAndUnanswered = visibleQuestionIndices.some(idx => {
                const q = originalQuestions[idx];
                return q?.requiredSetting === 'required' && !evaluateDisabled(idx) && isAnswerEmpty(currentAnswers[q._id], q.type);
             });
             if (anyRequiredVisibleAndUnanswered) {
                toast.info("Please provide answers for all required questions before submitting.");
                setIsSubmitting(false);
                return;
             }
        }

        const payload = {
            answers: answersToSubmit,
            sessionId,
            collectorId,
            recaptchaToken: recaptchaEnabled && recaptchaSiteKey ? recaptchaToken : undefined,
        };

        console.log("[SurveyTakingPage handleSubmit] Payload to be sent:", JSON.stringify(payload, null, 2));

        try { const result = await surveyApi.submitSurveyAnswers(surveyId, payload); toast.success(result.message || "Survey submitted successfully!"); if (result.action?.type === 'disqualifyRespondent') { setIsDisqualified(true); setDisqualificationMessage(result.action.disqualificationMessage || "Disqualified based on answers."); } else { navigate(result.redirectUrl || '/thank-you'); } } catch (errCatch) { const errorMessage = errCatch.response?.data?.message || errCatch.message || "An unknown error occurred during submission."; setError(errorMessage); toast.error(`Submission failed: ${errorMessage}`); if (recaptchaEnabled && recaptchaRef.current && recaptchaSiteKey) { recaptchaRef.current.reset(); setRecaptchaToken(null); } } finally { setIsSubmitting(false); }
    }, [collectorId, recaptchaEnabled, recaptchaToken, recaptchaSiteKey, visibleQuestionIndices, originalQuestions, evaluateDisabled, validateQuestion, currentAnswers, questionsById, otherInputValues, sessionId, surveyId, navigate, recaptchaRef, questionIdToOriginalIndexMap, OTHER_VALUE_INTERNAL]);

    // --- Conditional Returns & Final Render Logic ---
    if (isLoading && !survey) return <div className={styles.loading}>Loading survey...</div>; if (error && !survey) return <div className={styles.errorContainer}><h2>Error Loading Survey</h2><p>{error}</p><button onClick={fetchSurvey} className={styles.navButton}>Retry</button></div>; if (!survey && !isLoading && !error) { return <div className={styles.errorContainer}>Survey not found or could not be loaded.</div>; } if (isDisqualified) return ( <div className={styles.surveyContainer}><h1 className={styles.surveyTitle}>{survey?.title||'Survey'}</h1><div className={styles.disqualifiedBox}><h2>Survey Ended</h2><p>{disqualificationMessage || "You do not qualify to continue this survey."}</p></div></div> ); let finalCurrentQToRender = null; let finalIsSubmitState = false; if (!isLoading && survey) { const localCVI = currentVisibleIndex; if (visibleQuestionIndices.length === 0 && originalQuestions.length > 0) { finalIsSubmitState = true; } else if (visibleQuestionIndices.length === 0 && originalQuestions.length === 0) { finalIsSubmitState = true; } else if (localCVI >= 0 && localCVI < visibleQuestionIndices.length) { const currentOriginalIdx = visibleQuestionIndices[localCVI]; finalCurrentQToRender = originalQuestions[currentOriginalIdx]; } else if (localCVI >= visibleQuestionIndices.length && originalQuestions.length > 0) { finalIsSubmitState = true; } } const isCurrentQuestionDisabled = finalCurrentQToRender ? evaluateDisabled(questionIdToOriginalIndexMap[finalCurrentQToRender._id]) : false; return ( <div className={styles.surveyContainer}> <h1 className={styles.surveyTitle}>{survey?.title || 'Survey'}</h1> {(visitedPath.length === 0 || (visitedPath.length === 1 && currentVisibleIndex === 0 && visibleQuestionIndices.indexOf(visitedPath[0]) === 0 )) && survey?.description && <p className={styles.surveyDescription}>{survey.description}</p>} {error && survey && <div className={styles.submissionError}><p>Error: {error}</p></div>} {isLoading && survey ? <div className={styles.loading}>Loading question content...</div> : <div className={`${styles.questionBox} ${isCurrentQuestionDisabled ? styles.disabled : ''}`}> {finalIsSubmitState ? ( <div className={styles.submitPrompt}> <p>You have reached the end of the survey.</p> <p>Please click "Submit" to record your responses.</p> </div> ) : finalCurrentQToRender ? ( renderQuestion(finalCurrentQToRender) ) : ( originalQuestions.length > 0 && visibleQuestionIndices.length === 0 && !isDisqualified ? <div className={styles.submitPrompt}><p>No questions are currently visible based on logic or settings. You may submit if applicable.</p></div> : (isLoading ? <div className={styles.loading}>Preparing question...</div> : <div className={styles.loading}>Survey may be empty or an issue occurred.</div>) )} </div> } {finalIsSubmitState && recaptchaEnabled && recaptchaSiteKey && ( <div className={styles.recaptchaContainer}> <ReCAPTCHA ref={recaptchaRef} sitekey={recaptchaSiteKey} onChange={(token) => setRecaptchaToken(token)} onExpired={() => setRecaptchaToken(null)} onErrored={() => { toast.error("reCAPTCHA failed to load. Please try refreshing."); setRecaptchaToken(null); }} /> </div> )} <div className={styles.surveyNavigationArea}> <button onClick={handlePrevious} className={styles.navButton} disabled={isDisqualified || isLoading || isSubmitting || (currentVisibleIndex === 0 && visitedPath.length <= 1) }> Previous </button> {finalIsSubmitState || (originalQuestions.length > 0 && visibleQuestionIndices.length === 0 && !isDisqualified && !isLoading) ? ( <button onClick={handleSubmit} className={styles.submitButton} disabled={isDisqualified || isSubmitting || isLoading || (recaptchaEnabled && recaptchaSiteKey && !recaptchaToken)} > {isSubmitting ? 'Submitting...' : 'Submit'} </button> ) : ( <button onClick={handleNext} className={styles.navButton} disabled={isDisqualified || isSubmitting || isLoading || !finalCurrentQToRender } > Next </button> )} </div> <div className={styles.progressIndicator}> {!finalIsSubmitState && finalCurrentQToRender ? (visibleQuestionIndices.length > 0 ? `Question ${currentVisibleIndex + 1} of ${visibleQuestionIndices.length}` : 'Loading progress...') : (finalIsSubmitState ? `End of survey (${visibleQuestionIndices.length} questions shown)`: 'Initializing...')} </div> </div> );
}
export default SurveyTakingPage;
// ----- END OF COMPLETE MODIFIED FILE (v1.8) -----