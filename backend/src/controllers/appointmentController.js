const Appointment = require('../models/Appointment');
const { sendClientConfirmation, sendAdminNotification } = require('../utils/emailService');

// @desc    Create new appointment with availability check
// @route   POST /api/appointments
// @access  Public
exports.createAppointment = async (req, res) => {
  try {
    const { appointmentDate, appointmentTime } = req.body;
    
    // Check if slot is already booked
    const existingAppointment = await Appointment.findOne({
      appointmentDate: new Date(appointmentDate),
      appointmentTime,
      status: { $in: ['pending', 'confirmed'] }
    });
    
    if (existingAppointment) {
      return res.status(400).json({
        success: false,
        error: 'This time slot is already booked. Please choose another time.'
      });
    }
    
    const appointment = await Appointment.create(req.body);
    
    // Send email notifications
    try {
      await sendClientConfirmation(appointment);
      await sendAdminNotification(appointment);
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      // Don't fail the appointment if email fails
    }
    
    res.status(201).json({
      success: true,
      data: appointment,
      message: 'Appointment request submitted successfully'
    });
  } catch (error) {
    console.error('Error creating appointment:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get available time slots
// @route   GET /api/appointments/available-slots
// @access  Public
exports.getAvailableSlots = async (req, res) => {
  try {
    const { date } = req.query;
    
    if (!date) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a date'
      });
    }
    
    const selectedDate = new Date(date);
    const dayOfWeek = selectedDate.getDay();
    
    // Only Monday to Friday, 9 AM to 5 PM
    const allSlots = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'];
    
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return res.status(200).json({
        success: true,
        data: []
      });
    }
    
    // Get booked slots for this date
    const bookedAppointments = await Appointment.find({
      appointmentDate: {
        $gte: new Date(selectedDate.setHours(0, 0, 0, 0)),
        $lt: new Date(selectedDate.setHours(23, 59, 59, 999))
      },
      status: { $in: ['pending', 'confirmed'] }
    });
    
    const bookedTimes = bookedAppointments.map(app => app.appointmentTime);
    const availableSlots = allSlots.filter(slot => !bookedTimes.includes(slot));
    
    res.status(200).json({
      success: true,
      data: availableSlots
    });
  } catch (error) {
    console.error('Error fetching available slots:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get all appointments (admin only)
// @route   GET /api/appointments
// @access  Private/Admin
exports.getAppointments = async (req, res) => {
  try {
    const { status, startDate, endDate, page = 1, limit = 20 } = req.query;
    
    let query = {};
    
    if (status) query.status = status;
    
    if (startDate || endDate) {
      query.appointmentDate = {};
      if (startDate) query.appointmentDate.$gte = new Date(startDate);
      if (endDate) query.appointmentDate.$lte = new Date(endDate);
    }
    
    const appointments = await Appointment.find(query)
      .sort({ appointmentDate: 1, appointmentTime: 1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    const total = await Appointment.countDocuments(query);
    
    res.status(200).json({
      success: true,
      count: appointments.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      data: appointments
    });
  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Update appointment status
// @route   PUT /api/appointments/:id
// @access  Private/Admin
exports.updateAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: 'Appointment not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: appointment
    });
  } catch (error) {
    console.error('Error updating appointment:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Delete appointment
// @route   DELETE /api/appointments/:id
// @access  Private/Admin
exports.deleteAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findByIdAndDelete(req.params.id);
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: 'Appointment not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Appointment deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting appointment:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};