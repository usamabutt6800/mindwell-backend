require('dotenv').config({ path: './.env' });
const CloudinaryService = require('./src/utils/cloudinary');

async function testCloudinary() {
  console.log('🧪 Testing Cloudinary setup...\n');
  
  // Test 1: Check environment variables
  console.log('1. Checking environment variables:');
  console.log('   CLOUDINARY_CLOUD_NAME:', process.env.CLOUDINARY_CLOUD_NAME ? '✅ Set' : '❌ Missing');
  console.log('   CLOUDINARY_API_KEY:', process.env.CLOUDINARY_API_KEY ? '✅ Set' : '❌ Missing');
  console.log('   CLOUDINARY_API_SECRET:', process.env.CLOUDINARY_API_SECRET ? '✅ Set (hidden)' : '❌ Missing');
  
  // Test 2: Test connection
  console.log('\n2. Testing Cloudinary connection:');
  const connectionTest = await CloudinaryService.testConnection();
  console.log('   Result:', connectionTest.success ? '✅ Connected' : '❌ Failed');
  if (!connectionTest.success) {
    console.log('   Error:', connectionTest.error);
  }
  
  console.log('\n✅ Cloudinary test complete');
}

testCloudinary().catch(console.error);