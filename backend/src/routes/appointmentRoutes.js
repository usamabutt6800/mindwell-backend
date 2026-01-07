const express = require('express');
const router = express.Router();

// Simple test route
router.post('/', (req, res) => {
  console.log('Appointment data received:', req.body);
  res.json({
    success: true,
    message: 'Appointment received successfully',
    data: req.body
  });
});

router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Appointments route is working',
    data: []
  });
});

// Make sure to export the router
module.exports = router;