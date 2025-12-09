// models/OfficialTenure.js
const mongoose = require('mongoose');

const officialTenureSchema = new mongoose.Schema({
    // Official Reference
    official: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Official reference is required'],
        validate: {
            validator: async function(id) {
                const User = mongoose.model('User');
                const user = await User.findById(id);
                // Ensures the referenced ID is a user with the 'official' role
                return user && user.userType === 'official';
            },
            message: 'Referenced user must be an official'
        }
    },

    // Jurisdiction Details (CITY LEVEL)
    city: {
        type: String,
        required: [true, 'City name is required'],
        trim: true,
        set: v => v.toLowerCase()
    },


    // Position Details
    position: {
        type: String,
        required: [true, 'Position is required'],
        enum: [
            'Mayor',
            'Municipal Commissioner',
            'CEO - Municipal Corporation',
            'Chairperson - Nagar Parishad',
            'Deputy Mayor',
            'Head of Public Works',
            'Other'
        ]
    },
    department: {
        type: String,
        required: true,
        enum: [
            'Administration',
            'Engineering',
            'Health & Sanitation',
            'Water Supply',
            'Public Works',
            'Finance & Taxation',
            'Other'
        ]
    },

    // Tenure Period (Critical for accountability tracking)
    startDate: {
        type: Date,
        required: [true, 'Start date is required'],
        validate: {
            validator: function(v) {
                return v <= new Date(); // Start date cannot be in the future
            },
            message: 'Start date cannot be in the future'
        }
    },
    endDate: {
        type: Date,
        validate: {
            validator: function(v) {
                return !v || v > this.startDate; // End date must be after start date
            },
            message: 'End date must be after start date'
        }
    },

    // Tenure Status
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },
    terminationReason: {
        type: String,
        enum: ['Transfer', 'Resignation', 'Retirement', 'Completion', 'Termination', 'Other']
    },

    // Contact & Responsibilities (Retained)
    contactInfo: {
        phone: {
            type: String,
            match: [/^[0-9]{10}$/, 'Please provide a valid 10-digit phone number']
        },
        email: String,
        officeAddress: String
    },
    responsibilities: [{
        type: String,
        trim: true
    }],

    // Geographic Boundaries (Now for the whole city/municipality)
    geoBoundaries: {
        type: {
            type: String,
            enum: ['Polygon', 'MultiPolygon']
        },
        coordinates: {
            type: [[[Number]]] // GeoJSON Polygon/MultiPolygon format
        }
    },

    // Performance Metrics (Retained)
    metrics: {
        totalReportsReceived: {
            type: Number,
            default: 0
        },
        reportsResolved: {
            type: Number,
            default: 0
        },
        averageResolutionTime: {
            type: Number, // in days
            default: 0
        },
        rating: {
            type: Number,
            min: 0,
            max: 5,
            default: 0
        }
    },

    // Metadata (Retained)
    appointedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    notes: String
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// ------------------------------------------------------------------
// INDEXES (Updated for city-level lookups)
// ------------------------------------------------------------------
officialTenureSchema.index({ official: 1, isActive: 1 });
officialTenureSchema.index({ city: 1, isActive: 1 }); // Primary change: Index on city
officialTenureSchema.index({ startDate: 1, endDate: 1 });
officialTenureSchema.index({ position: 1, isActive: 1 });

// Compound index for city and date range queries
officialTenureSchema.index({ city: 1, startDate: 1, endDate: 1 });

// 2dsphere index for geographic boundaries
officialTenureSchema.index({ geoBoundaries: '2dsphere' });

// ------------------------------------------------------------------
// VIRTUALS & MIDDLEWARE (Mostly Retained)
// ------------------------------------------------------------------

officialTenureSchema.virtual('reports', {
    ref: 'Report',
    localField: '_id',
    foreignField: 'official_tenure_id'
});

officialTenureSchema.virtual('isCurrentlyActive').get(function() {
    const now = new Date();
    return this.isActive &&
        this.startDate <= now &&
        (!this.endDate || this.endDate >= now);
});

officialTenureSchema.pre('save', async function () {
    const now = new Date();

    if (this.endDate && this.endDate < now) {
        this.isActive = false;
    }

    if (this.startDate <= now && (!this.endDate || this.endDate >= now)) {
        this.isActive = true;
    }
});
// do not write next like
// officialTenureSchema.pre('save', function(next) {
//     const now = new Date();
//
//     if (this.endDate && this.endDate < now) {
//         this.isActive = false;
//     }
//
//     if (this.startDate <= now && (!this.endDate || this.endDate >= now)) {
//         this.isActive = true;
//     }
//
//     next();
// });

// ------------------------------------------------------------------
// STATIC & INSTANCE METHODS (Updated for city-level lookups)
// ------------------------------------------------------------------

// Static method to find current official for a city
officialTenureSchema.statics.findCurrentOfficialForCity = function(city) {
    const now = new Date();
    return this.findOne({
        city: city, // Changed from 'ward' to 'city'
        isActive: true,
        startDate: { $lte: now },
        $or: [
            { endDate: { $gte: now } },
            { endDate: null }
        ]
    }).populate('official', 'name email phone officialDetails');
};

// Static method to find official at a specific date (for historical accountability)
officialTenureSchema.statics.findOfficialAtDate = function(city, date) {
    return this.findOne({
        city: city, // Changed from 'ward' to 'city'
        startDate: { $lte: date },
        $or: [
            { endDate: { $gte: date } },
            { endDate: null }
        ]
    }).populate('official', 'name email phone officialDetails');
};

// Method to update metrics (Retained)
officialTenureSchema.methods.updateMetrics = async function() {
    // NOTE: This assumes the 'Report' model has a 'durationDays' virtual/property.
    const Report = mongoose.model('Report');

    const reports = await Report.find({ official_tenure_id: this._id });
    const resolvedReports = reports.filter(r => r.status === 'Solved');

    this.metrics.totalReportsReceived = reports.length;
    this.metrics.reportsResolved = resolvedReports.length;

    if (resolvedReports.length > 0) {
        const totalDays = resolvedReports.reduce((sum, r) => {
            return sum + r.durationDays;
        }, 0);
        this.metrics.averageResolutionTime = Math.round(totalDays / resolvedReports.length);
    }

    await this.save();
};

// Method to end tenure (Retained)
officialTenureSchema.methods.endTenure = async function(reason, endDate = new Date()) {
    this.isActive = false;
    this.endDate = endDate;
    this.terminationReason = reason;
    await this.save();
};

const OfficialTenure = mongoose.model('OfficialTenure', officialTenureSchema);

module.exports = OfficialTenure;