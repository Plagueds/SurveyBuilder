// checkSkipLogicStructure.js
// Read-only script to inspect the current structure of 'skipLogic' in the database.

const mongoose = require('mongoose');
const Question = require('./models/Question'); // Adjust path if needed
require('dotenv').config(); // If using .env for connection string

// --- Configuration ---
// *** CHANGE HERE: Use process.env.MONGO_URI to match your .env file ***
const MONGO_URI = process.env.MONGO_URI || 'YOUR_MONGODB_CONNECTION_STRING_HERE';
const SAMPLE_LIMIT = 10; // Number of questions with skipLogic to check
// --- End Configuration ---

async function checkStructure() {
    console.log('Connecting to MongoDB (read-only check)...');
    // Add a check to ensure MONGO_URI is valid before attempting connection
    if (!MONGO_URI || MONGO_URI === 'YOUR_MONGODB_CONNECTION_STRING_HERE' || (!MONGO_URI.startsWith('mongodb://') && !MONGO_URI.startsWith('mongodb+srv://'))) {
        console.error('MongoDB connection error: Invalid or missing MONGO_URI in .env file or script.');
        console.error('Current value:', MONGO_URI);
        process.exit(1);
    }

    try {
        await mongoose.connect(MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000 // Optional: Add timeout for faster failure
        });
        console.log('MongoDB connected successfully.');
    } catch (err) {
        console.error('MongoDB connection error:', err.message); // More specific error message
        process.exit(1); // Exit if connection fails
    }

    console.log(`\nAttempting to find up to ${SAMPLE_LIMIT} questions with existing skipLogic...`);

    try {
        // Find questions where the skipLogic array exists and is not empty
        const questionsWithLogic = await Question.find({
            'skipLogic.0': { $exists: true } // Check if the first element exists
        })
        .select('_id type skipLogic') // Select only necessary fields
        .limit(SAMPLE_LIMIT)
        .lean(); // Use lean for plain JS objects

        if (questionsWithLogic.length === 0) {
            console.log('\nNo questions found with non-empty skipLogic arrays.');
            console.log('Migration might not be necessary, or existing logic is empty.');
        } else {
            console.log(`\nFound ${questionsWithLogic.length} sample(s). Inspecting 'skipLogic' structure:`);
            questionsWithLogic.forEach((question, index) => {
                console.log(`\n--- Sample ${index + 1} ---`);
                console.log(`Question ID: ${question._id}`);
                console.log(`Type: ${question.type}`);
                console.log('Skip Logic Structure:');
                // Pretty-print the skipLogic array
                console.log(JSON.stringify(question.skipLogic, null, 2));
                console.log('--------------------');
            });

            console.log('\nPlease compare the structure above to the expected "Old Format":');
            console.log(`[{ "conditionValue": "...", "action": "jump"|"end", "targetQuestionId": "...", "conditionOperator": "..."(optional) }]`);
            console.log('If the structure matches the "Old Format", the migration script should work.');
            console.log('If it already matches the "New Format" (with "groups", "conditions", etc.), migration is likely complete or not needed.');
        }

    } catch (err) {
        console.error('\nAn error occurred while querying questions:', err);
    } finally {
        console.log('\nDisconnecting from MongoDB...');
        await mongoose.disconnect();
        console.log('Disconnected.');
    }
}

// Run the check function
checkStructure();