const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

// Load env vars
dotenv.config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(async () => {
  console.log('✅ Connected to MongoDB');
  
  // Define User schema inline since we don't have the model file yet
  const userSchema = new mongoose.Schema({
    name: String,
    email: String,
    password: String,
    role: String,
    createdAt: { type: Date, default: Date.now }
  });
  
  const User = mongoose.model('User', userSchema);
  
  // Check if admin already exists
  const existingAdmin = await User.findOne({ email: 'admin@mindwell.com' });
  
  if (existingAdmin) {
    console.log('⚠️  Admin user already exists:', existingAdmin.email);
    process.exit(0);
  }
  
  // Hash password
  const hashedPassword = await bcrypt.hash('admin123', 12);
  
  // Create admin user
  const admin = await User.create({
    name: 'Admin',
    email: 'admin@mindwell.com',
    password: hashedPassword,
    role: 'admin'
  });
  
  console.log('✅ Admin user created successfully!');
  console.log('📧 Email: admin@mindwell.com');
  console.log('🔑 Password: admin123');
  console.log('👤 Role: admin');
  
  process.exit(0);
})
.catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});