const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const path = require('path');

// ================= LOAD ENV =================
dotenv.config();

// ================= APP =================
const app = express();
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));
app.use(express.json());

// ================= CONSTANTS =================
const ADMIN_EMAIL = process.env.EMAIL_USER || 'admin@mindwell.com';
const JWT_SECRET =
  process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

// ================= DATABASE =================
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch((err) => console.error('❌ Mongo Error:', err));

// ================= MODELS =================
const Appointment = require('../src/models/Appointment');
const Contact = require('../src/models/Contact');
const CalendarSettings = require('../src/models/CalendarSettings');

// ================= UTILITIES =================
const emailLogger = require('../src/utils/emailLogger');

// ================= ROUTES =================
const calendarRoutes = require('../src/routes/calendarRoutes');
const paymentRoutes = require('../src/routes/paymentRoutes');

// ================= EMAIL =================
let transporter = null;

if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

// ================= EMAIL HELPER =================
const sendEmailAndLog = async (to, subject, type, html) => {
  try {
    if (!transporter) {
      emailLogger.logEmail(to, subject, type + '_skipped', 'Email not configured');
      return false;
    }

    await transporter.sendMail({
      from: `"MindWell Psychology" <${ADMIN_EMAIL}>`,
      to,
      subject,
      html,
    });

    emailLogger.logEmail(to, subject, type, html.substring(0, 500));
    return true;
  } catch (err) {
    emailLogger.logEmail(to, subject, type + '_failed', err.message);
    return false;
  }
};

// ================= AUTH MIDDLEWARE =================
const requireAdminAuth = (req, res, next) => {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer '))
      return res.status(401).json({ success: false, error: 'No token' });

    const token = auth.split(' ')[1];
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ success: false, error: 'Invalid token' });
  }
};

// ================= ROUTE MOUNTS =================
app.use('/api/calendar', calendarRoutes);
app.use('/api/payments', paymentRoutes);

// ================= ADMIN EMAIL LOGS =================
app.get('/api/admin/email-logs', requireAdminAuth, (req, res) => {
  res.json({ success: true, logs: emailLogger.getLogs() });
});

// ================= APPOINTMENTS =================
app.post('/api/appointments', async (req, res) => {
  try {
    const bookingDate = new Date(req.body.appointmentDate);
    const dateStr = bookingDate.toISOString().split('T')[0];

    const calendarSetting = await CalendarSettings.findOne({
      date: {
        $gte: new Date(dateStr + 'T00:00:00'),
        $lt: new Date(dateStr + 'T23:59:59'),
      },
    });

    if (calendarSetting && !calendarSetting.isAvailable) {
      return res.status(400).json({ success: false, error: 'Date unavailable' });
    }

    const exists = await Appointment.findOne({
      appointmentDate: new Date(req.body.appointmentDate),
      appointmentTime: req.body.appointmentTime,
    });

    if (exists) {
      return res.status(400).json({ success: false, error: 'Slot booked' });
    }

    const appointment = await Appointment.create({
      ...req.body,
      status: 'pending',
    });

    sendEmailAndLog(
      appointment.email,
      'Appointment Received – MindWell Psychology',
      'appointment_client',
      `<p>Dear ${appointment.clientName}, your appointment was received.</p>`
    );

    sendEmailAndLog(
      ADMIN_EMAIL,
      'New Appointment',
      'appointment_admin',
      `<p>New booking by ${appointment.clientName}</p>`
    );

    res.json({ success: true, data: appointment });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Booking failed' });
  }
});

// ================= CONTACT =================
app.post('/api/contact', async (req, res) => {
  const contact = await Contact.create({ ...req.body });
  sendEmailAndLog(
    contact.email,
    'Contact Received',
    'contact_client',
    '<p>Thanks for contacting us.</p>'
  );
  res.json({ success: true });
});

// ================= AUTH =================
app.post('/api/auth/login', (req, res) => {
  if (
    req.body.email === process.env.ADMIN_EMAIL &&
    req.body.password === process.env.ADMIN_PASSWORD
  ) {
    const token = jwt.sign(
      { role: 'admin', email: req.body.email },
      JWT_SECRET,
      { expiresIn: '8h' }
    );
    return res.json({ success: true, token });
  }
  res.status(401).json({ success: false });
});

app.get('/api/auth/verify', requireAdminAuth, (req, res) => {
  res.json({ success: true, user: req.user });
});

// ================= HEALTH CHECK =================
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'MindWell Psychology API is running',
    timestamp: new Date().toISOString(),
    services: {
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      email: transporter ? 'configured' : 'not configured',
      calendar: 'active'
    }
  });
});

module.exports = app;

