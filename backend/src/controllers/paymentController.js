const Payment = require('../models/Payment');
const Appointment = require('../models/Appointment');
const CloudinaryService = require('../utils/cloudinary');
const emailLogger = require('../utils/emailLogger');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

// Email transporter setup (same as server.js)
let transporter;
const ADMIN_EMAIL = process.env.EMAIL_USER || 'admin@mindwell.com';

if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

/**
 * Helper function to send emails (same as server.js)
 */
const sendEmailAndLog = async (to, subject, type, html) => {
  try {
    if (!transporter) {
      console.log(`📧 Email skipped (not configured) to ${to} (${type})`);
      // Still log even if not configured
      emailLogger.logEmail(to, subject, type + '_skipped', 'Email not configured');
      return false;
    }

    const info = await transporter.sendMail({
      from: `"MindWell Psychology" <${ADMIN_EMAIL}>`,
      to,
      subject,
      html,
    });
    
    console.log(`✅ Email sent to ${to} (${type})`);
    // Log to email logger
    emailLogger.logEmail(to, subject, type, html.substring(0, 500));
    return true;
    
  } catch (err) {
    console.error('❌ Email failed:', err.message);
    emailLogger.logEmail(to, subject, type + '_failed', `Error: ${err.message}`);
    return false;
  }
};

/**
 * @desc    Submit payment with receipt
 * @route   POST /api/payments
 * @access  Public
 */
exports.submitPayment = async (req, res) => {
  try {
    const { appointmentId, paymentMethod, transactionId, transactionDate, amount } = req.body;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Receipt image is required'
      });
    }

    // Validate appointment exists
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: 'Appointment not found'
      });
    }

    // Check if payment already exists
    const existingPayment = await Payment.findOne({ appointmentId });
    if (existingPayment) {
      return res.status(400).json({
        success: false,
        error: 'Payment already submitted for this appointment'
      });
    }

    // Validate file
    const fileValidation = CloudinaryService.validateFile(req.file);
    if (!fileValidation.valid) {
      return res.status(400).json({
        success: false,
        error: fileValidation.error
      });
    }

    // Upload to Cloudinary
    const uploadResult = await CloudinaryService.uploadImage(req.file.path, 'mindwell_payments');
    if (!uploadResult.success) {
      console.error('❌ Cloudinary upload failed details:');
      console.error('File path:', req.file?.path);
      console.error('File size:', req.file?.size);
      console.error('File type:', req.file?.mimetype);
      console.error('Upload error:', uploadResult.error);
      
      return res.status(500).json({
        success: false,
        error: 'Failed to upload receipt: ' + (uploadResult.error || 'Unknown error')
      });
    }

    // Create payment record
    const payment = await Payment.create({
      appointmentId,
      clientName: appointment.clientName,
      clientEmail: appointment.email,
      clientPhone: appointment.phone,
      amount: amount || appointment.amount || 3000,
      paymentMethod,
      transactionId,
      transactionDate: transactionDate || new Date(),
      receiptImage: uploadResult.url,
      receiptPublicId: uploadResult.publicId,
      status: 'pending'
    });

    // Update appointment payment status
    appointment.paymentStatus = 'paid';
    appointment.paymentId = payment._id;
    await appointment.save();

    // Send email notifications - USING FIXED FUNCTION
    // 1. Email to client
    sendEmailAndLog(
      appointment.email,
      'Payment Received - MindWell Psychology',
      'payment_received_client',
      `<p>Dear ${appointment.clientName},</p>
       <p>Your payment receipt has been received successfully.</p>
       <p><strong>Amount:</strong> PKR ${payment.amount}</p>
       <p><strong>Transaction ID:</strong> ${payment.transactionId}</p>
       <p>We will verify your payment shortly and confirm your appointment.</p>
       <p>Best regards,<br>MindWell Psychology</p>`
    ).catch(err => console.error('Email error:', err));

    // 2. Email to admin
    sendEmailAndLog(
      ADMIN_EMAIL,
      '💰 New Payment Receipt Submitted',
      'payment_received_admin',
      `<p><strong>New payment receipt submitted</strong></p>
       <p><strong>Client:</strong> ${appointment.clientName}</p>
       <p><strong>Email:</strong> ${appointment.email}</p>
       <p><strong>Phone:</strong> ${appointment.phone}</p>
       <p><strong>Amount:</strong> PKR ${payment.amount}</p>
       <p><strong>Method:</strong> ${payment.paymentMethod}</p>
       <p><strong>Transaction ID:</strong> ${payment.transactionId}</p>
       <p><strong>Appointment Date:</strong> ${new Date(appointment.appointmentDate).toDateString()} at ${appointment.appointmentTime}</p>
       <p><a href="${uploadResult.url}" target="_blank">View Receipt</a></p>
       <p>Please verify this payment in the admin dashboard.</p>`
    ).catch(err => console.error('Email error:', err));

    res.status(201).json({
      success: true,
      message: 'Payment submitted successfully. Please wait for verification.',
      data: payment
    });

  } catch (error) {
    console.error('Payment submission error:', error);
    
    // Clean up uploaded file if exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      error: 'Failed to submit payment. Please try again.'
    });
  }
};

/**
 * @desc    Get all payments (Admin)
 * @route   GET /api/payments
 * @access  Private/Admin
 */
exports.getAllPayments = async (req, res) => {
  try {
    const { status, page = 1, limit = 20, startDate, endDate } = req.query;
    const skip = (page - 1) * limit;

    let query = {};

    // Filter by status
    if (status && status !== 'all') {
      query.status = status;
    }

    // Filter by date range
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const payments = await Payment.find(query)
      .populate('appointmentId', 'appointmentDate appointmentTime serviceType')
      .sort({ createdAt: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit));

    const total = await Payment.countDocuments(query);

    res.json({
      success: true,
      count: payments.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      data: payments
    });

  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payments'
    });
  }
};

/**
 * @desc    Get payment by ID
 * @route   GET /api/payments/:id
 * @access  Private/Admin
 */
exports.getPaymentById = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('appointmentId');

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }

    res.json({
      success: true,
      data: payment
    });

  } catch (error) {
    console.error('Get payment error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payment'
    });
  }
};

/**
 * @desc    Verify payment (Admin)
 * @route   PUT /api/payments/:id/verify
 * @access  Private/Admin
 */
exports.verifyPayment = async (req, res) => {
  try {
    const { notes } = req.body;
    const adminUser = req.user?.email || 'admin';

    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }

    if (payment.status === 'verified') {
      return res.status(400).json({
        success: false,
        error: 'Payment already verified'
      });
    }

    // Update payment
    payment.status = 'verified';
    payment.verifiedBy = adminUser;
    payment.verifiedAt = new Date();
    payment.verificationNotes = notes;
    await payment.save();

    // Update appointment
    const appointment = await Appointment.findById(payment.appointmentId);
    if (appointment) {
      appointment.paymentStatus = 'verified';
      appointment.status = 'confirmed';  // Confirm the appointment
      await appointment.save();
    }

    // Send confirmation email to client
    sendEmailAndLog(
      payment.clientEmail,
      'Payment Verified - Appointment Confirmed',
      'payment_verified_client',
      `<p>Dear ${payment.clientName},</p>
       <p>Your payment has been verified successfully!</p>
       
       <p><strong>Appointment Confirmed:</strong></p>
       <p><strong>Date:</strong> ${appointment?.appointmentDate ? new Date(appointment.appointmentDate).toDateString() : 'To be scheduled'}</p>
       <p><strong>Time:</strong> ${appointment?.appointmentTime || 'To be confirmed'}</p>
       
       <p><strong>Payment Details:</strong></p>
       <p><strong>Amount:</strong> PKR ${payment.amount}</p>
       <p><strong>Transaction ID:</strong> ${payment.transactionId}</p>
       <p><strong>Verified by:</strong> ${payment.verifiedBy}</p>
       
       ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
       
       <p>Your appointment is now confirmed. You will receive a reminder before your session.</p>
       <p>Best regards,<br>MindWell Psychology</p>`
    ).catch(err => console.error('Email error:', err));

    // Send notification to admin
    sendEmailAndLog(
      ADMIN_EMAIL,
      '✅ Payment Verified Successfully',
      'payment_verified_admin',
      `<p><strong>Payment verified successfully</strong></p>
       
       <p><strong>Client:</strong> ${payment.clientName}</p>
       <p><strong>Email:</strong> ${payment.clientEmail}</p>
       <p><strong>Phone:</strong> ${payment.clientPhone}</p>
       <p><strong>Amount:</strong> PKR ${payment.amount}</p>
       <p><strong>Method:</strong> ${payment.paymentMethod}</p>
       <p><strong>Transaction ID:</strong> ${payment.transactionId}</p>
       
       <p><strong>Appointment:</strong></p>
       <p>Date: ${appointment ? new Date(appointment.appointmentDate).toDateString() : 'N/A'}</p>
       <p>Time: ${appointment ? appointment.appointmentTime : 'N/A'}</p>
       
       <p><strong>Verified by:</strong> ${payment.verifiedBy}</p>
       <p><strong>Verification Notes:</strong> ${notes || 'None'}</p>
       
       <p><a href="${payment.receiptImage}" target="_blank">View Receipt</a></p>
       
       <p>Payment and appointment have been confirmed.</p>`
    ).catch(err => console.error('Email error:', err));

    res.json({
      success: true,
      message: 'Payment verified successfully',
      data: payment
    });

  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify payment'
    });
  }
};

/**
 * @desc    Reject payment (Admin)
 * @route   PUT /api/payments/:id/reject
 * @access  Private/Admin
 */
exports.rejectPayment = async (req, res) => {
  try {
    const { reason } = req.body;

    if (!reason || reason.trim().length < 5) {
      return res.status(400).json({
        success: false,
        error: 'Rejection reason is required (min 5 characters)'
      });
    }

    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }

    // Update payment
    payment.status = 'rejected';
    payment.rejectedReason = reason;
    await payment.save();

    // Update appointment - FIX: Also cancel the appointment
    const appointment = await Appointment.findById(payment.appointmentId);
    if (appointment) {
      appointment.paymentStatus = 'failed';
      appointment.status = 'cancelled';  // CANCEL the appointment
      await appointment.save();
    }

    // Send rejection email to client
    sendEmailAndLog(
      payment.clientEmail,
      'Payment Verification Issue - MindWell Psychology',
      'payment_rejected_client',
      `<p>Dear ${payment.clientName},</p>
       
       <p>We encountered an issue with your payment verification.</p>
       
       <p><strong>Reason:</strong> ${reason}</p>
       
       <p><strong>Payment Details:</strong></p>
       <p><strong>Amount:</strong> PKR ${payment.amount}</p>
       <p><strong>Transaction ID:</strong> ${payment.transactionId}</p>
       
       <p><strong>Appointment Status:</strong> CANCELLED</p>
       
       <p>Please contact us immediately to resolve this issue:</p>
       <p>📞 Phone: [Your Clinic Phone]</p>
       <p>✉️ Email: ${ADMIN_EMAIL}</p>
       
       <p>Your appointment has been cancelled. Please submit a new payment to reschedule.</p>
       
       <p>Best regards,<br>MindWell Psychology</p>`
    ).catch(err => console.error('Email error:', err));

    // Send notification to admin
    sendEmailAndLog(
      ADMIN_EMAIL,
      '⚠️ Payment Rejected',
      'payment_rejected_admin',
      `<p><strong>Payment rejected</strong></p>
       
       <p><strong>Client:</strong> ${payment.clientName}</p>
       <p><strong>Email:</strong> ${payment.clientEmail}</p>
       <p><strong>Phone:</strong> ${payment.clientPhone}</p>
       <p><strong>Amount:</strong> PKR ${payment.amount}</p>
       <p><strong>Transaction ID:</strong> ${payment.transactionId}</p>
       
       <p><strong>Rejection Reason:</strong> ${reason}</p>
       
       <p><strong>Appointment Action:</strong> CANCELLED</p>
       
       <p><a href="${payment.receiptImage}" target="_blank">View Receipt</a></p>
       
       <p><strong>Action Required:</strong> Follow up with client regarding the rejection.</p>`
    ).catch(err => console.error('Email error:', err));

    res.json({
      success: true,
      message: 'Payment rejected and appointment cancelled',
      data: payment
    });

  } catch (error) {
    console.error('Reject payment error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reject payment'
    });
  }
};

/**
 * @desc    Get payment methods configuration
 * @route   GET /api/payments/methods
 * @access  Public
 */
exports.getPaymentMethods = (req, res) => {
  res.json({
    success: true,
    data: {
      methods: [
        {
          id: 'easypaisa',
          name: 'EasyPaisa',
          instructions: 'Send payment to the following EasyPaisa account:',
          details: {
            accountNumber: '0312-3456789',
            accountName: 'MindWell Psychology',
            note: 'Include your appointment ID in transaction description'
          }
        },
        {
          id: 'jazzcash',
          name: 'JazzCash',
          instructions: 'Send payment to the following JazzCash account:',
          details: {
            accountNumber: '0300-1234567',
            accountName: 'MindWell Psychology',
            note: 'Include your appointment ID in transaction description'
          }
        },
        {
          id: 'bank_transfer',
          name: 'Bank Transfer',
          instructions: 'Transfer to the following bank account:',
          details: {
            bankName: 'Habib Bank Limited',
            accountTitle: 'MindWell Psychology',
            accountNumber: '1234-5678901-2',
            iban: 'PK00HABB1234567890123',
            branch: 'Main Branch, Karachi',
            note: 'Email receipt to payments@mindwell.com after transfer'
          }
        }
      ],
      defaultAmount: 3000,
      currency: 'PKR',
      contactInfo: {
        phone: '+92-312-3456789',
        email: 'payments@mindwell.com'
      }
    }
  });
};