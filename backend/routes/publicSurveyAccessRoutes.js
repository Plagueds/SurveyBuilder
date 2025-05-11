// backend/routes/publicSurveyAccessRoutes.js
// ----- START OF COMPLETE NEW FILE (v1.0 - Public Survey Access Routes) -----
const express = require('express');
const router = express.Router();
const publicSurveyAccessController = require('../controllers/publicSurveyAccessController');

// Route for respondents to access a survey using a collector's linkId or customSlug
// Using POST to allow sending password in the request body if needed.
router.post('/:accessIdentifier', publicSurveyAccessController.accessSurvey);

module.exports = router;
// ----- END OF COMPLETE NEW FILE (v1.0 - Public Survey Access Routes) -----