const express = require('express');
const router = express.Router();
const calendarController = require('../controllers/calendarController');

// Public: Get calendar availability for date range
router.get('/availability', calendarController.getCalendarSettings);

// Public: Check specific date/time availability
router.get('/check', calendarController.checkAvailability);

// Admin: Get all calendar settings (with pagination)
router.get('/admin/settings', calendarController.getAllCalendarSettings);

// Admin: Update settings for a specific date
router.put('/admin/settings', calendarController.updateCalendarSettings);

// Admin: Bulk update multiple dates
router.post('/admin/settings/bulk', calendarController.bulkUpdateCalendarSettings);

module.exports = router;