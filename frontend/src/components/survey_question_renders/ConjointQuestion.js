// frontend/src/components/survey_question_renders/ConjointQuestion.js
// ----- START OF COMPLETE MODIFIED FILE (v2.1 - Store Full Profile Choice) -----
import React, { useState, useEffect, useMemo } from 'react';
import styles from './SurveyQuestionStyles.module.css';

// Helper function to get a random element from an array
const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Helper function to generate a single unique profile for a task
const generateProfile = (attributes, existingProfilesInTask = []) => {
    let profile;
    let attempts = 0;
    const MAX_ATTEMPTS = 50; // Prevent infinite loops for very constrained designs

    do {
        profile = {};
        attributes.forEach(attr => {
            if (attr && attr.name && attr.levels && attr.levels.length > 0) { // Guard against undefined/empty
                profile[attr.name] = getRandomElement(attr.levels);
            } else {
                console.warn("[Conjoint] Attribute missing name or levels:", attr);
            }
        });
        attempts++;
        if (Object.keys(profile).length === 0 && attributes.length > 0) { // If profile is empty but shouldn't be
            console.error("[Conjoint] Generated an empty profile despite attributes. Check attribute structure.", attributes);
            return {}; // Return empty or handle error, to prevent infinite loop below if all attrs are bad
        }
        if (Object.keys(profile).length === 0 && attributes.length === 0) {
            break; // No attributes, empty profile is fine.
        }

        const isDuplicateInTask = existingProfilesInTask.some(existingProfile =>
            attributes.every(attr => existingProfile[attr.name] === profile[attr.name])
        );
        if (!isDuplicateInTask) break;
    } while (attempts < MAX_ATTEMPTS);

    if (attempts === MAX_ATTEMPTS) {
        console.warn("[Conjoint] Could not generate a unique profile for task after max attempts. Allowing duplicate.");
    }
    return profile;
};

// Helper function to generate a set of choice tasks
const generateConjointTasks = (attributes, profilesPerTask, numTasks) => {
    if (!attributes || attributes.length === 0 || attributes.some(attr => !attr.levels || attr.levels.length === 0)) {
        console.warn("[Conjoint] Not enough data to generate tasks. Attributes:", attributes);
        return [];
    }
    const tasks = [];
    for (let i = 0; i < numTasks; i++) {
        const taskProfiles = [];
        for (let j = 0; j < profilesPerTask; j++) {
            taskProfiles.push(generateProfile(attributes, taskProfiles));
        }
        // Filter out any potentially empty profiles if generateProfile had issues
        const validTaskProfiles = taskProfiles.filter(p => Object.keys(p).length > 0);
        if (validTaskProfiles.length > 0) { // Only add task if it has valid profiles
            tasks.push({ id: `task_${i}`, profiles: validTaskProfiles });
        } else if (taskProfiles.length > 0) { // Log if profiles were generated but all were empty
            console.warn(`[Conjoint] Task ${i} generated only empty profiles. Skipping task.`);
        }
    }
    return tasks;
};

const ConjointQuestion = ({ question, currentAnswer, onAnswerChange, isPreviewMode, disabled }) => {
    const {
        _id: questionId,
        text,
        conjointAttributes = [],
        conjointProfilesPerTask = 3,
        conjointNumTasks = 5,
        conjointIncludeNoneOption = true,
        description
    } = question;

    const [tasks, setTasks] = useState([]);
    const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
    // choices will store: { taskId: chosenProfileObject_OR_String<'none'> }
    const [choices, setChoices] = useState({});

    useEffect(() => {
        if (conjointAttributes && conjointAttributes.length > 0) {
            const generated = generateConjointTasks(conjointAttributes, conjointProfilesPerTask, conjointNumTasks);
            setTasks(generated);
        } else {
            setTasks([]);
        }

        // Initialize choices from currentAnswer (which should now also follow the new structure)
        // If currentAnswer is in the old format (taskId: profileIndex), this won't directly map.
        // For a clean transition, new answers will use the new format.
        // Old answers in the DB will still be in the old format until they are re-answered.
        if (currentAnswer && typeof currentAnswer === 'object') {
            // Basic check: if values are objects or 'none', assume new format.
            // This is a simple heuristic. Robust migration would be more complex.
            const isNewFormat = Object.values(currentAnswer).some(val => typeof val === 'object' || val === 'none');
            if (isNewFormat) {
                setChoices(currentAnswer);
            } else {
                // If old format (e.g. {task_0: 0}), it won't be correctly loaded here.
                // We'll effectively be starting fresh for this respondent for this question.
                // Or, you'd need a more complex migration/adapter here if you want to try and convert old format answers.
                // For now, we prioritize new answers being correct.
                console.warn(`[Conjoint] currentAnswer for QID ${questionId} might be in an old format. Initializing choices as empty. currentAnswer:`, currentAnswer);
                setChoices({});
            }
        } else {
            setChoices({});
        }
        setCurrentTaskIndex(0);
    }, [questionId, conjointAttributes, conjointProfilesPerTask, conjointNumTasks, currentAnswer]); // Added questionId for robustness

    const currentTask = tasks[currentTaskIndex];

    const handleProfileSelect = (profileIndexOrNone) => {
        if (disabled || !currentTask || !currentTask.profiles) return;

        let chosenValueForTask;
        if (profileIndexOrNone === 'none') {
            chosenValueForTask = 'none'; // Special marker for "none" option
        } else if (currentTask.profiles[profileIndexOrNone]) {
            // Store a copy of the profile object to avoid potential direct state mutation issues
            chosenValueForTask = { ...currentTask.profiles[profileIndexOrNone] };
        } else {
            console.error(`[Conjoint] Invalid profile index: ${profileIndexOrNone} for task: ${currentTask.id}`);
            return; // Do not proceed if the index is invalid
        }

        const newChoicesForAllTasks = {
            ...choices,
            [currentTask.id]: chosenValueForTask,
        };
        setChoices(newChoicesForAllTasks);

        if (typeof onAnswerChange === 'function') {
            // Pass the entire 'choices' object for this question,
            // which now contains { taskId: actualProfileObject_or_'none' }
            onAnswerChange(questionId, newChoicesForAllTasks);
        }
    };

    const handleNextTask = () => {
        if (disabled) return;
        if (currentTask && choices[currentTask.id] === undefined && question.requiredSetting === 'required' && !isPreviewMode) {
            // In preview mode, allow skipping required for easier testing.
            alert("Please make a selection for the current task.");
            return;
        }
        if (currentTaskIndex < tasks.length - 1) {
            setCurrentTaskIndex(currentTaskIndex + 1);
        }
    };

    const handlePreviousTask = () => {
        if (disabled) return;
        if (currentTaskIndex > 0) {
            setCurrentTaskIndex(currentTaskIndex - 1);
        }
    };
    
    const isLastTask = currentTaskIndex >= tasks.length - 1;

    const allTasksAnswered = useMemo(() => {
        if (tasks.length === 0) return true;
        return tasks.every(task => choices[task.id] !== undefined);
    }, [tasks, choices]);


    if (!conjointAttributes || conjointAttributes.length === 0) {
        return (
            <div className={`${styles.questionContainer} ${disabled ? styles.disabled : ''}`}>
                <h4 className={styles.questionText}>{text}</h4>
                {description && <p className={styles.questionDescription}>{description}</p>}
                <p className={styles.questionDescription}>No attributes defined for this conjoint task.</p>
            </div>
        );
    }

    if (tasks.length === 0 && conjointAttributes.length > 0) {
        // This state might occur briefly if attributes are present but task generation is pending or failed
        return (
            <div className={`${styles.questionContainer} ${disabled ? styles.disabled : ''}`}>
                <h4 className={styles.questionText}>{text}</h4>
                {description && <p className={styles.questionDescription}>{description}</p>}
                <p className={styles.questionDescription}>Generating conjoint tasks or tasks could not be generated (check console for warnings).</p>
            </div>
        );
    }
    
    if (!currentTask && tasks.length > 0 && !allTasksAnswered && currentTaskIndex < tasks.length) {
         // This case should ideally not be hit if tasks are generated and currentTaskIndex is valid.
         // Could indicate an issue if tasks array is populated but currentTaskIndex somehow points outside.
         return (
            <div className={`${styles.questionContainer} ${disabled ? styles.disabled : ''}`}>
                <h4 className={styles.questionText}>{text}</h4>
                {description && <p className={styles.questionDescription}>{description}</p>}
                <p>Loading task or task index out of bounds...</p>
            </div>
        );
    }

    // Determine if the current task's choice is a profile object (for highlighting)
    const currentChoiceForTask = currentTask ? choices[currentTask.id] : undefined;
    
    return (
        <div className={`${styles.questionContainer} ${disabled ? styles.disabled : ''}`}>
            <h4 className={styles.questionText}>
                {text}
                {question.requiredSetting === 'required' && !isPreviewMode && <span className={styles.requiredIndicator}>*</span>}
            </h4>
            {description && <p className={styles.questionDescription}>{description}</p>}

            {allTasksAnswered && tasks.length > 0 && !isPreviewMode ? ( // Don't show completion message in preview, allow navigation
                <div className={styles.conjointCompletionMessage}>
                    <p>Thank you for completing all conjoint tasks for this question.</p>
                    {currentTaskIndex > 0 && (
                         <button
                            type="button"
                            onClick={handlePreviousTask}
                            className={styles.conjointNavButton}
                            disabled={disabled}
                        >
                            Previous Task ({currentTaskIndex +1}/{tasks.length})
                        </button>
                    )}
                </div>
            ) : currentTask ? (
                <>
                    <p className={styles.conjointTaskInfo}>
                        Task {currentTaskIndex + 1} of {tasks.length}. Please choose your preferred option.
                    </p>
                    <div className={styles.conjointTaskContainer}>
                        {currentTask.profiles.map((profile, profileIdx) => {
                            // Check if this profile is the one selected for the current task
                            const isSelected = typeof currentChoiceForTask === 'object' && currentChoiceForTask !== null &&
                                               conjointAttributes.every(attr => currentChoiceForTask[attr.name] === profile[attr.name]);
                            return (
                                <div
                                    key={`task-${currentTask.id}-profile-${profileIdx}`}
                                    className={`${styles.conjointProfileCard} ${isSelected ? styles.conjointProfileCardSelected : ''}`}
                                    onClick={() => handleProfileSelect(profileIdx)}
                                    role="button"
                                    tabIndex={disabled ? -1 : 0}
                                    onKeyPress={(e) => !disabled && e.key === 'Enter' && handleProfileSelect(profileIdx)}
                                >
                                    <h5 className={styles.conjointProfileTitle}>Option {profileIdx + 1}</h5>
                                    <ul className={styles.conjointProfileAttributes}>
                                        {conjointAttributes.map(attr => (
                                            <li key={attr.name} className={styles.conjointProfileAttributeItem}>
                                                <span className={styles.conjointProfileAttrName}>{attr.name}:</span>
                                                <span className={styles.conjointProfileAttrLevel}>{profile[attr.name]}</span>
                                            </li>
                                        ))}
                                    </ul>
                                    <div className={styles.conjointProfileSelector}>
                                        <input
                                            type="radio"
                                            name={`conjoint_task_${currentTask.id}`}
                                            id={`conjoint_task_${currentTask.id}_profile_${profileIdx}`}
                                            checked={isSelected}
                                            onChange={() => handleProfileSelect(profileIdx)}
                                            disabled={disabled}
                                            className={styles.conjointProfileRadio}
                                        />
                                        <label htmlFor={`conjoint_task_${currentTask.id}_profile_${profileIdx}`} className={styles.conjointProfileRadioLabel}>
                                            Select Option {profileIdx + 1}
                                        </label>
                                    </div>
                                </div>
                            );
                        })}
                        {conjointIncludeNoneOption && (
                            <div
                                key={`task-${currentTask.id}-profile-none`}
                                className={`${styles.conjointProfileCard} ${styles.conjointProfileNoneCard} ${currentChoiceForTask === 'none' ? styles.conjointProfileCardSelected : ''}`}
                                onClick={() => handleProfileSelect('none')}
                                role="button"
                                tabIndex={disabled ? -1 : 0}
                                onKeyPress={(e) => !disabled && e.key === 'Enter' && handleProfileSelect('none')}
                            >
                                <h5 className={styles.conjointProfileTitle}>None of these</h5>
                                <div className={styles.conjointProfileSelector}>
                                     <input
                                        type="radio"
                                        name={`conjoint_task_${currentTask.id}`}
                                        id={`conjoint_task_${currentTask.id}_profile_none`}
                                        checked={currentChoiceForTask === 'none'}
                                        onChange={() => handleProfileSelect('none')}
                                        disabled={disabled}
                                        className={styles.conjointProfileRadio}
                                    />
                                     <label htmlFor={`conjoint_task_${currentTask.id}_profile_none`} className={styles.conjointProfileRadioLabel}>
                                        Select "None of these"
                                     </label>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className={styles.conjointNavigation}>
                        <button
                            type="button"
                            onClick={handlePreviousTask}
                            className={styles.conjointNavButton}
                            disabled={currentTaskIndex === 0 || disabled}
                        >
                            Previous Task
                        </button>
                        <button
                            type="button"
                            onClick={handleNextTask}
                            className={styles.conjointNavButton}
                            disabled={isLastTask || currentChoiceForTask === undefined || disabled}
                        >
                            Next Task
                        </button>
                    </div>
                </>
            ) : (
                <p>No conjoint tasks to display for this question. Check console for errors if attributes are defined.</p>
            )}
        </div>
    );
};

export default ConjointQuestion;
// ----- END OF COMPLETE MODIFIED FILE (v2.1 - Store Full Profile Choice) -----