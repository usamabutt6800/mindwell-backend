const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  // Reference to appointment
  appointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    required: [true, 'Appointment reference is required']
  },
  
  // Client information
  clientName: {
    type: String,
    required: [true, 'Client name is required']
  },
  clientEmail: {
    type: String,
    required: [true, 'Client email is required'],
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please provide a valid email'
    ]
  },
  clientPhone: {
    type: String,
    required: [true, 'Client phone is required']
  },
  
  // Payment details
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [1, 'Amount must be at least 1']
  },
  currency: {
    type: String,
    default: 'PKR',
    enum: ['PKR', 'USD']
  },
  
  // Payment method
  paymentMethod: {
    type: String,
    required: [true, 'Payment method is required'],
    enum: ['easypaisa', 'jazzcash', 'bank_transfer', 'cash']
  },
  
  // Transaction details
  transactionId: {
    type: String,
    required: [true, 'Transaction ID is required'],
    trim: true
  },
  transactionDate: {
    type: Date,
    required: [true, 'Transaction date is required']
  },
  
  // Receipt/image
  receiptImage: {
    type: String, // Cloudinary URL
    required: [true, 'Receipt image is required']
  },
  receiptPublicId: {
    type: String // Cloudinary public ID for deletion
  },
  
  // Status
  status: {
    type: String,
    enum: ['pending', 'verified', 'rejected', 'cancelled'],
    default: 'pending'
  },
  
  // Verification details
  verifiedBy: {
    type: String // Admin username/email
  },
  verifiedAt: {
    type: Date
  },
  verificationNotes: {
    type: String,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  
  // Rejection details
  rejectedReason: {
    type: String,
    maxlength: [500, 'Reason cannot exceed 500 characters']
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
  timestamps: true
});

// Index for faster queries
paymentSchema.index({ appointmentId: 1 });
paymentSchema.index({ status: 1, createdAt: -1 });
paymentSchema.index({ clientEmail: 1, createdAt: -1 });

module.exports = mongoose.model('Payment', paymentSchema);