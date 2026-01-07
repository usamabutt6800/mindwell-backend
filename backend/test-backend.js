const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('✅ Connected to MongoDB');
    
    // Test models
    const Appointment = require('./src/models/Appointment');
    const Contact = require('./src/models/Contact');
    
    // Count records
    const appointmentCount = await Appointment.countDocuments();
    const contactCount = await Contact.countDocuments();
    
    console.log(`📊 Appointments: ${appointmentCount}`);
    console.log(`📧 Contacts: ${contactCount}`);
    
    // List recent appointments
    const recentAppointments = await Appointment.find()
      .sort({ createdAt: -1 })
      .limit(5);
    
    console.log('\n📅 Recent Appointments:');
    recentAppointments.forEach(app => {
      console.log(`- ${app.clientName} (${app.email}) - ${app.appointmentDate}`);
    });
    
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ MongoDB Error:', err);
    process.exit(1);
  });