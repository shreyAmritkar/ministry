// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
// NOTE: Ensure 'crypto' is imported or defined if you use createVerificationToken
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
    // Basic Info
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        minlength: [2, 'Name must be at least 2 characters'],
        maxlength: [100, 'Name cannot exceed 100 characters']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
    },
    phone: {
        type: String,
        trim: true,
        match: [/^[0-9]{10}$/, 'Please provide a valid 10-digit phone number']
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [8, 'Password must be at least 8 characters'],
        select: false
    },

    // User Type & Role
    userType: {
        type: String,
        enum: ['citizen', 'official'],
        required: true,
        default: 'citizen'
    },
    role: {
        type: String,
        // Simplified roles to align with city-level hierarchy
        enum: ['admin', 'moderator', 'citizen'],
        default: 'citizen'
    },

    // Citizen-specific fields (Retained)
    address: {
        street: String,
        city: String,
        state: String,
        pincode: String
    },

    // Official-specific fields (MODIFIED)
    officialDetails: {

        designation: {
            type: String,
            enum: ['Mayor', 'Municipal Commissioner', 'Deputy Commissioner', 'Engineer', 'Health Officer', 'Other'] // Updated enum to be city-level
        },
        employeeId: String,
        department: {
            type: String,
            enum: ['Administration', 'Engineering', 'Health', 'Sanitation', 'Water Supply', 'Roads', 'Finance', 'Other'] // Added Finance
        }
    },

    // Profile, Security, Metadata (Retained)
    avatar: {
        url: String,
        cloudinaryId: String
    },
    isVerified: {
        type: Boolean,
        default: false
    },

    verificationToken: String,
    verificationTokenExpiry: Date,
    passwordResetToken: String,
    passwordResetExpiry: Date,
    lastLogin: Date,
    isActive: {
        type: Boolean,
        default: true
    },
    reportsSubmitted: {
        type: Number,
        default: 0
    },
    reportsResolved: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes (MODIFIED)
userSchema.index({ email: 1 });
userSchema.index({ userType: 1, isActive: 1 });
userSchema.index({ 'officialDetails.department': 1 });
userSchema.index({ 'officialDetails.city': 1, userType: 1 }); // ADDED: New index for quick official lookup by city

// Virtuals (Retained)
userSchema.virtual('reports', {
    ref: 'Report',
    localField: '_id',
    foreignField: 'reportedBy'
});

userSchema.virtual('assignedReports', {
    ref: 'Report',
    localField: '_id',
    foreignField: 'assignedTo'
});

// Pre-save middleware to hash password (Retained)
userSchema.pre('save', async function () {
    if (!this.isModified('password')) return;

    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
});


// Methods (Retained)
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.createVerificationToken = function() {
    const token = crypto.randomBytes(32).toString('hex');
    this.verificationToken = crypto.createHash('sha256').update(token).digest('hex');
    this.verificationTokenExpiry = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    return token;
};

// Static method to find active officials (UPDATED)
userSchema.statics.findActiveOfficials = function(city, department) {
    const query = { userType: 'official', isActive: true };
    if (city) query['officialDetails.city'] = city; // Filter by city
    if (department) query['officialDetails.department'] = department;
    return this.find(query);
};

const User = mongoose.model('User', userSchema);

module.exports = User;