// backend/seed/createAdmin.js
require('dotenv').config();
const User = require('../models/User');
const { pool } = require('../db/pool');

const createAdmin = async () => {
    try {
        const existing = await User.findByEmail('admin@civictrack.com');
        if (existing) {
            console.log('ℹ️  Admin already exists:', existing.email);
            process.exit(0);
        }

        const admin = await User.create({
            name: 'Admin User',
            email: 'admin@civictrack.com',
            password: 'admin123', // hashed inside User.create
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
    } finally {
        await pool.end();
    }
};

createAdmin();

// To promote an existing user to an official, e.g.:
//   UPDATE users SET role = 'official', user_type = 'official',
//                    is_verified = true, is_active = true
//   WHERE email = 'shiv@gmail.com';
