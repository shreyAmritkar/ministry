// backend/seeds/createAdmin.js
const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

const createAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        const admin = await User.create({
            name: 'Admin User',
            email: 'admin@civictrack.com',
            password: 'admin123', // Will be hashed automatically
            userType: 'citizen',
            role: 'admin',
            phone: '9999999999',
            isActive: true,
            isVerified: true,
        });

        console.log('✅ Admin created:', admin.email);
        console.log('📧 Email: admin@civictrack.com');
        console.log('🔑 Password: admin123');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
};

createAdmin();


// db.users.updateOne(
//     ...   { email: "admin@civictrack.com" },
//     ...   {
//         ...     $set: {
// ...       role: "admin",
// ...       isVerified: true,
// ...       isActive: true
// ...     }
// ...   }
// ... )