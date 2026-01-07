const mongoose = require('mongoose');

/**
 * CalendarSettings Model
 * 
 * Stores availability settings for each date
 * Admin can mark days as available/unavailable
 * Set custom hours for specific days
 * Default: Weekdays (Mon-Fri) 9AM-6PM available
 */
const calendarSettingsSchema = new mongoose.Schema({
  // The specific date (e.g., 2024-12-25)
  date: {
    type: Date,
    required: [true, 'Date is required'],
    unique: true, // One setting per date
    index: true
  },
  
  // Whether appointments can be booked on this day
  isAvailable: {
    type: Boolean,
    default: true,
    required: true
  },
  
  // Reason for availability status (for admin reference)
  reason: {
    type: String,
    trim: true,
    maxlength: [200, 'Reason cannot exceed 200 characters']
  },
  
  // Custom working hours for this specific day
  // If empty, uses default hours (9AM-6PM)
  customHours: [{
    start: {
      type: String, // Format: "HH:MM" 24-hour
      match: [/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format. Use HH:MM (24-hour)']
    },
    end: {
      type: String,
      match: [/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format. Use HH:MM (24-hour)']
    }
  }],
  
  // Maximum appointments allowed on this day
  maxAppointments: {
    type: Number,
    min: 1,
    default: 8 // Default: 8 appointments per day
  },
  
  // Metadata
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true // Auto-manages createdAt and updatedAt
});

// Update the updatedAt timestamp before saving
calendarSettingsSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for efficient date queries
calendarSettingsSchema.index({ date: 1, isAvailable: 1 });

module.exports = mongoose.model('CalendarSettings', calendarSettingsSchema);