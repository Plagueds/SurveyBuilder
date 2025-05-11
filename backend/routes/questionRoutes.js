// backend/routes/questionRoutes.js
const express = require('express');
const router = express.Router();
const questionController = require('../controllers/questionController');

// GET all questions
router.get('/', questionController.getAllQuestions);

// GET a single question by ID
router.get('/:id', questionController.getQuestionById);

// POST create a new question
router.post('/', questionController.createQuestion);

// PATCH for updating an existing question by ID
router.patch('/:id', questionController.updateQuestion);

// DELETE a question by ID
router.delete('/:id', questionController.deleteQuestion);

// ***** NEW ROUTE FOR INDIVIDUAL ANSWERS *****
// This matches the QuestionViewer.js fetch call to `${apiUrl}/api/answers`
// Assuming your main app.js mounts this router at /api/questions,
// this won't work.
// The QuestionViewer.js calls /api/answers.
// We need a new route file for answers or add it to server.js directly.

// Let's assume you want to handle individual answers via a dedicated answer route.
// Create backend/routes/answerRoutes.js:
/*
const express = require('express');
const router = express.Router();
const questionController = require('../controllers/questionController'); // Or a new answerController

// POST a new answer
router.post('/', questionController.addAnswer); // Or answerController.createAnswer

module.exports = router;
*/

// And in your main server file (e.g., backend/server.js or backend/app.js):
// const answerRoutes = require('./routes/answerRoutes');
// app.use('/api/answers', answerRoutes); // Mount it here

// For now, to quickly test, let's add it to questionController and assume
// the QuestionViewer.js call can be changed.
// OR, if QuestionViewer.js is NOT used, and SurveyTakingPage.js handles everything,
// then the individual answer submission logic in QuestionViewer.js is dead code.

module.exports = router;