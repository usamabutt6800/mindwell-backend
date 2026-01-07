const CalendarSettings = require('../models/CalendarSettings');

/**
 * Get calendar settings for a date range
 * Used by frontend to show available dates
 */
exports.getCalendarSettings = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Start date and end date are required'
      });
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Get all calendar settings in the date range
    const settings = await CalendarSettings.find({
      date: { $gte: start, $lte: end }
    }).sort({ date: 1 });
    
    // Create a map for quick lookup
    const settingsMap = {};
    settings.forEach(setting => {
      const dateStr = setting.date.toISOString().split('T')[0];
      settingsMap[dateStr] = setting;
    });
    
    // Generate response for each date in range
    const calendarData = [];
    const currentDate = new Date(start);
    
    while (currentDate <= end) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 6 = Saturday
      
      // Check if we have custom settings for this date
      if (settingsMap[dateStr]) {
        const setting = settingsMap[dateStr];
        calendarData.push({
          date: dateStr,
          isAvailable: setting.isAvailable,
          reason: setting.reason,
          customHours: setting.customHours,
          maxAppointments: setting.maxAppointments,
          hasCustomSettings: true
        });
      } else {
        // Default settings: Weekdays available, weekends unavailable
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        calendarData.push({
          date: dateStr,
          isAvailable: !isWeekend, // Available on weekdays by default
          reason: isWeekend ? 'Weekend' : 'Default weekday',
          customHours: [],
          maxAppointments: 8,
          hasCustomSettings: false
        });
      }
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    res.json({
      success: true,
      data: calendarData,
      defaultHours: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00']
    });
    
  } catch (error) {
    console.error('Error fetching calendar settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch calendar settings'
    });
  }
};

/**
 * Admin: Update calendar settings for specific dates
 */
exports.updateCalendarSettings = async (req, res) => {
  try {
    const { date, isAvailable, reason, customHours, maxAppointments } = req.body;
    
    if (!date) {
      return res.status(400).json({
        success: false,
        error: 'Date is required'
      });
    }
    
    // Validate custom hours if provided
    if (customHours && customHours.length > 0) {
      for (const slot of customHours) {
        if (!slot.start || !slot.end) {
          return res.status(400).json({
            success: false,
            error: 'Custom hours must have start and end times'
          });
        }
      }
    }
    
    // Find or create calendar setting for this date
    const setting = await CalendarSettings.findOneAndUpdate(
      { date: new Date(date) },
      {
        date: new Date(date),
        isAvailable: isAvailable !== undefined ? isAvailable : true,
        reason: reason || '',
        customHours: customHours || [],
        maxAppointments: maxAppointments || 8,
        updatedAt: Date.now()
      },
      {
        new: true, // Return updated document
        upsert: true, // Create if doesn't exist
        runValidators: true
      }
    );
    
    res.json({
      success: true,
      message: 'Calendar settings updated successfully',
      data: setting
    });
    
  } catch (error) {
    console.error('Error updating calendar settings:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update calendar settings'
    });
  }
};

/**
 * Admin: Bulk update calendar settings (for multiple dates)
 */
exports.bulkUpdateCalendarSettings = async (req, res) => {
  try {
    const { updates } = req.body;
    
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Updates array is required'
      });
    }
    
    const results = [];
    
    for (const update of updates) {
      try {
        const setting = await CalendarSettings.findOneAndUpdate(
          { date: new Date(update.date) },
          {
            date: new Date(update.date),
            isAvailable: update.isAvailable !== undefined ? update.isAvailable : true,
            reason: update.reason || '',
            customHours: update.customHours || [],
            maxAppointments: update.maxAppointments || 8,
            updatedAt: Date.now()
          },
          {
            new: true,
            upsert: true,
            runValidators: true
          }
        );
        results.push(setting);
      } catch (err) {
        console.error(`Error updating date ${update.date}:`, err);
        results.push({ date: update.date, error: err.message });
      }
    }
    
    res.json({
      success: true,
      message: 'Bulk update completed',
      data: results,
      totalUpdated: results.filter(r => !r.error).length
    });
    
  } catch (error) {
    console.error('Error in bulk update:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform bulk update'
    });
  }
};

/**
 * Admin: Get all calendar settings (for admin panel)
 */
exports.getAllCalendarSettings = async (req, res) => {
  try {
    const { page = 1, limit = 50, startDate, endDate } = req.query;
    const skip = (page - 1) * limit;
    
    let query = {};
    
    // Filter by date range if provided
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    const settings = await CalendarSettings.find(query)
      .sort({ date: 1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit));
    
    const total = await CalendarSettings.countDocuments(query);
    
    res.json({
      success: true,
      data: settings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    console.error('Error fetching all calendar settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch calendar settings'
    });
  }
};

/**
 * Check if a specific date/time is available for booking
 * This will be used by the appointment booking system
 */
exports.checkAvailability = async (req, res) => {
  try {
    const { date, time } = req.query;
    
    if (!date || !time) {
      return res.status(400).json({
        success: false,
        error: 'Date and time are required'
      });
    }
    
    const bookingDate = new Date(date);
    const dayOfWeek = bookingDate.getDay();
    
    // Check if we have custom settings for this date
    const dateStr = bookingDate.toISOString().split('T')[0];
    const setting = await CalendarSettings.findOne({
      date: { $gte: new Date(dateStr + 'T00:00:00'), $lt: new Date(dateStr + 'T23:59:59') }
    });
    
    let isAvailable = true;
    let reason = '';
    
    if (setting) {
      // Use custom settings
      isAvailable = setting.isAvailable;
      reason = setting.reason || 'Custom setting';
      
      // Check if time is within custom hours
      if (setting.customHours && setting.customHours.length > 0) {
        const timeInMinutes = parseInt(time.split(':')[0]) * 60 + parseInt(time.split(':')[1]);
        const isValidTime = setting.customHours.some(slot => {
          const startMinutes = parseInt(slot.start.split(':')[0]) * 60 + parseInt(slot.start.split(':')[1]);
          const endMinutes = parseInt(slot.end.split(':')[0]) * 60 + parseInt(slot.end.split(':')[1]);
          return timeInMinutes >= startMinutes && timeInMinutes < endMinutes;
        });
        
        if (!isValidTime) {
          isAvailable = false;
          reason = 'Outside custom working hours';
        }
      }
    } else {
      // Use default settings: weekends unavailable
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      if (isWeekend) {
        isAvailable = false;
        reason = 'Weekend (no custom settings)';
      }
    }
    
    res.json({
      success: true,
      data: {
        date: dateStr,
        time,
        isAvailable,
        reason,
        hasCustomSettings: !!setting
      }
    });
    
  } catch (error) {
    console.error('Error checking availability:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check availability'
    });
  }
};