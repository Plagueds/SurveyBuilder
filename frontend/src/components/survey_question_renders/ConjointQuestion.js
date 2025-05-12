// frontend/src/components/survey_question_renders/ConjointQuestion.js
// ----- START OF COMPLETE MODIFIED FILE (v2.0 - CBC Implementation) -----
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
            profile[attr.name] = getRandomElement(attr.levels);
        });
        attempts++;
        // Check if this exact profile already exists in the current task
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
        return []; // Not enough data to generate tasks
    }
    const tasks = [];
    for (let i = 0; i < numTasks; i++) {
        const taskProfiles = [];
        for (let j = 0; j < profilesPerTask; j++) {
            taskProfiles.push(generateProfile(attributes, taskProfiles));
        }
        tasks.push({ id: `task_${i}`, profiles: taskProfiles });
    }
    return tasks;
};

const ConjointQuestion = ({ question, currentAnswer, onAnswerChange, isPreviewMode, disabled }) => {
    const {
        _id: questionId,
        text,
        conjointAttributes = [],
        conjointProfilesPerTask = 3, // Default to 3 profiles per task
        conjointNumTasks = 5, // Default to 5 tasks
        conjointIncludeNoneOption = true, // Whether to include a "None of these" option
        description
    } = question;

    const [tasks, setTasks] = useState([]);
    const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
    const [choices, setChoices] = useState({}); // { taskId: chosenProfileIndex_or_NoneString }

    // Generate tasks when component mounts or attributes change
    useEffect(() => {
        if (conjointAttributes && conjointAttributes.length > 0) {
            const generated = generateConjointTasks(conjointAttributes, conjointProfilesPerTask, conjointNumTasks);
            setTasks(generated);
        } else {
            setTasks([]);
        }
        // Reset choices and task index if attributes change
        setChoices(currentAnswer && typeof currentAnswer === 'object' ? currentAnswer : {});
        setCurrentTaskIndex(0);
    }, [conjointAttributes, conjointProfilesPerTask, conjointNumTasks, currentAnswer]); // currentAnswer dependency to load saved state

    const currentTask = tasks[currentTaskIndex];

    const handleProfileSelect = (profileIndex) => {
        if (disabled || !currentTask) return;
        const newChoices = {
            ...choices,
            [currentTask.id]: profileIndex,
        };
        setChoices(newChoices);
        // Optionally, move to next task automatically or wait for a "Next" button
        // For now, we'll let a separate button handle task navigation.
        if (typeof onAnswerChange === 'function') {
            onAnswerChange(questionId, newChoices);
        }
    };

    const handleNextTask = () => {
        if (disabled) return;
        // Ensure current task has a selection if required (can add validation here)
        if (choices[currentTask.id] === undefined && question.requiredSetting === 'required') {
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
        if (tasks.length === 0) return true; // No tasks, so "all answered"
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
        return (
            <div className={`${styles.questionContainer} ${disabled ? styles.disabled : ''}`}>
                <h4 className={styles.questionText}>{text}</h4>
                {description && <p className={styles.questionDescription}>{description}</p>}
                <p className={styles.questionDescription}>Generating conjoint tasks...</p>
            </div>
        );
    }
    
    if (!currentTask && tasks.length > 0 && !allTasksAnswered) {
         return (
            <div className={`${styles.questionContainer} ${disabled ? styles.disabled : ''}`}>
                <h4 className={styles.questionText}>{text}</h4>
                {description && <p className={styles.questionDescription}>{description}</p>}
                <p>Loading task...</p>
            </div>
        );
    }


    return (
        <div className={`${styles.questionContainer} ${disabled ? styles.disabled : ''}`}>
            <h4 className={styles.questionText}>
                {text}
                {question.requiredSetting === 'required' && !isPreviewMode && <span className={styles.requiredIndicator}>*</span>}
            </h4>
            {description && <p className={styles.questionDescription}>{description}</p>}

            {allTasksAnswered && tasks.length > 0 ? (
                <div className={styles.conjointCompletionMessage}>
                    <p>Thank you for completing all conjoint tasks for this question.</p>
                    {currentTaskIndex > 0 && ( // Show previous button if not on first task, even if completed
                         <button
                            type="button"
                            onClick={handlePreviousTask}
                            className={styles.conjointNavButton}
                            disabled={disabled}
                        >
                            Previous Task ({currentTaskIndex}/{tasks.length})
                        </button>
                    )}
                </div>
            ) : currentTask ? (
                <>
                    <p className={styles.conjointTaskInfo}>
                        Task {currentTaskIndex + 1} of {tasks.length}. Please choose your preferred option.
                    </p>
                    <div className={styles.conjointTaskContainer}>
                        {currentTask.profiles.map((profile, profileIdx) => (
                            <div
                                key={`task-${currentTask.id}-profile-${profileIdx}`}
                                className={`${styles.conjointProfileCard} ${choices[currentTask.id] === profileIdx ? styles.conjointProfileCardSelected : ''}`}
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
                                        checked={choices[currentTask.id] === profileIdx}
                                        onChange={() => handleProfileSelect(profileIdx)} // Redundant due to card click, but good for accessibility
                                        disabled={disabled}
                                        className={styles.conjointProfileRadio}
                                    />
                                    <label htmlFor={`conjoint_task_${currentTask.id}_profile_${profileIdx}`} className={styles.conjointProfileRadioLabel}>
                                        Select Option {profileIdx + 1}
                                    </label>
                                </div>
                            </div>
                        ))}
                        {conjointIncludeNoneOption && (
                            <div
                                key={`task-${currentTask.id}-profile-none`}
                                className={`${styles.conjointProfileCard} ${styles.conjointProfileNoneCard} ${choices[currentTask.id] === 'none' ? styles.conjointProfileCardSelected : ''}`}
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
                                        checked={choices[currentTask.id] === 'none'}
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
                            disabled={isLastTask || choices[currentTask.id] === undefined || disabled}
                        >
                            Next Task
                        </button>
                    </div>
                </>
            ) : (
                <p>No conjoint tasks to display for this question.</p>
            )}
        </div>
    );
};

export default ConjointQuestion;
// ----- END OF COMPLETE MODIFIED FILE (v2.0 - CBC Implementation) -----