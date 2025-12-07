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
                return user && user.userType === 'official';
            },
            message: 'Referenced user must be an official'
        }
    },

    // Jurisdiction Details
    ward: {
        type: String,
        required: [true, 'Ward information is required'],
        trim: true
    },
    wardNumber: {
        type: Number,
        required: true
    },
    zone: {
        type: String,
        enum: ['North', 'South', 'East', 'West', 'Central'],
        required: true
    },

    // Position Details
    position: {
        type: String,
        required: [true, 'Position is required'],
        enum: [
            'Ward Councilor',
            'Deputy Commissioner',
            'Municipal Commissioner',
            'Zone Officer',
            'Ward Engineer',
            'Health Officer',
            'Sanitation Inspector',
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
            'Roads & Infrastructure',
            'Public Works',
            'Other'
        ]
    },

    // Tenure Period (Critical for accountability tracking)
    startDate: {
        type: Date,
        required: [true, 'Start date is required'],
        validate: {
            validator: function(v) {
                return v <= new Date();
            },
            message: 'Start date cannot be in the future'
        }
    },
    endDate: {
        type: Date,
        validate: {
            validator: function(v) {
                return !v || v > this.startDate;
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

    // Contact & Responsibilities
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

    // Geographic Boundaries (Optional for advanced features)
    geoBoundaries: {
        type: {
            type: String,
            enum: ['Polygon', 'MultiPolygon']
        },
        coordinates: {
            type: [[[Number]]] // GeoJSON Polygon/MultiPolygon format
        }
    },

    // Performance Metrics
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

    // Metadata
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

// Indexes for efficient queries
officialTenureSchema.index({ official: 1, isActive: 1 });
officialTenureSchema.index({ ward: 1, isActive: 1 });
officialTenureSchema.index({ wardNumber: 1, zone: 1 });
officialTenureSchema.index({ startDate: 1, endDate: 1 });
officialTenureSchema.index({ position: 1, isActive: 1 });

// Compound index for ward and date range queries
officialTenureSchema.index({ ward: 1, startDate: 1, endDate: 1 });

// 2dsphere index for geographic boundaries (if used)
officialTenureSchema.index({ geoBoundaries: '2dsphere' });

// Virtual for reports during this tenure
officialTenureSchema.virtual('reports', {
    ref: 'Report',
    localField: '_id',
    foreignField: 'official_tenure_id'
});

// Virtual to check if tenure is currently active based on dates
officialTenureSchema.virtual('isCurrentlyActive').get(function() {
    const now = new Date();
    return this.isActive &&
        this.startDate <= now &&
        (!this.endDate || this.endDate >= now);
});

// Pre-save middleware to auto-set isActive based on dates
officialTenureSchema.pre('save', function(next) {
    const now = new Date();

    // Auto-deactivate if end date has passed
    if (this.endDate && this.endDate < now) {
        this.isActive = false;
    }

    // Auto-activate if start date is reached and no end date or end date is future
    if (this.startDate <= now && (!this.endDate || this.endDate >= now)) {
        this.isActive = true;
    }

    next();
});

// Static method to find current official for a ward
officialTenureSchema.statics.findCurrentOfficialForWard = function(ward) {
    const now = new Date();
    return this.findOne({
        ward: ward,
        isActive: true,
        startDate: { $lte: now },
        $or: [
            { endDate: { $gte: now } },
            { endDate: null }
        ]
    }).populate('official', 'name email phone officialDetails');
};

// Static method to find official at a specific date (for historical accountability)
officialTenureSchema.statics.findOfficialAtDate = function(ward, date) {
    return this.findOne({
        ward: ward,
        startDate: { $lte: date },
        $or: [
            { endDate: { $gte: date } },
            { endDate: null }
        ]
    }).populate('official', 'name email phone officialDetails');
};

// Method to update metrics
officialTenureSchema.methods.updateMetrics = async function() {
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

// Method to end tenure
officialTenureSchema.methods.endTenure = async function(reason, endDate = new Date()) {
    this.isActive = false;
    this.endDate = endDate;
    this.terminationReason = reason;
    await this.save();
};

const OfficialTenure = mongoose.model('OfficialTenure', officialTenureSchema);

module.exports = OfficialTenure;