// models/Report.js
const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
    // Core Report Information
    title: {
        type: String,
        required: [true, 'Report title is required'],
        trim: true,
        minlength: [5, 'Title must be at least 5 characters'],
        maxlength: [200, 'Title cannot exceed 200 characters']
    },
    description: {
        type: String,
        required: [true, 'Description is required'],
        trim: true,
        minlength: [20, 'Description must be at least 20 characters'],
        maxlength: [2000, 'Description cannot exceed 2000 characters']
    },
    category: {
        type: String,
        required: true,
        enum: [
            'Road_Damage',
            'Garbage_Collection',
            'Street_Lighting',
            'Water_Supply',
            'Drainage',
            'Illegal_Construction',
            'Public_Property_Damage',
            'Other'
        ]
    },

    // GeoJSON Location (for geospatial queries)
    location: {
        type: {
            type: String,
            enum: ['Point'],
            required: true,
            default: 'Point'
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
            required: [true, 'Location coordinates are required'],
            validate: {
                validator: function(coords) {
                    return coords.length === 2 &&
                        coords[0] >= -180 && coords[0] <= 180 && // longitude
                        coords[1] >= -90 && coords[1] <= 90;     // latitude
                },
                message: 'Invalid coordinates format. Expected [longitude, latitude]'
            }
        }
    },

    // Human-readable address
    address: {
        street: String,
        area: String,
        ward: {
            type: String,
            required: [true, 'Ward information is required']
        },
        city: {
            type: String,
            required: true
        },
        pincode: String
    },

    // Media Handling
    mediaType: {
        type: String,
        enum: ['none', 'image', 'video'],
        default: 'none'
    },
    mediaUrl: {
        type: String,
        validate: {
            validator: function(v) {
                if (this.mediaType === 'none') return true;
                return v && v.length > 0;
            },
            message: 'Media URL is required when mediaType is specified'
        }
    },
    // For images/short videos (Cloudinary)
    cloudinaryId: String,

    // For long videos (GridFS)
    gridfsId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'fs.files' // GridFS file reference
    },

    // Status Management
    status: {
        type: String,
        enum: ['Pending', 'Acknowledged', 'In_Progress', 'Reported', 'Solved', 'Rejected'],
        default: 'Pending',
        required: true
    },
    priority: {
        type: String,
        enum: ['Low', 'Medium', 'High', 'Critical'],
        default: 'Medium'
    },

    // User Relationships
    reportedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Reporter information is required']
    },
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },

    // Official Tenure Link (Critical for accountability)
    official_tenure_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'OfficialTenure',
        index: true
    },

    // Timeline & Updates
    statusHistory: [{
        status: {
            type: String,
            enum: ['Pending', 'Acknowledged', 'In_Progress', 'Reported', 'Solved', 'Rejected']
        },
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        comment: String,
        timestamp: {
            type: Date,
            default: Date.now
        }
    }],

    // Resolution Details
    resolutionDetails: {
        description: String,
        resolvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        resolvedAt: Date,
        verificationMedia: [{
            url: String,
            cloudinaryId: String
        }]
    },

    // Engagement Metrics
    upvotes: {
        type: Number,
        default: 0
    },
    upvotedBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    views: {
        type: Number,
        default: 0
    },

    // Visibility
    isPublic: {
        type: Boolean,
        default: true
    },
    isArchived: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// CRITICAL: Compound 2dsphere index for geospatial queries
reportSchema.index({ location: '2dsphere' });

// Additional indexes for performance
reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ reportedBy: 1, createdAt: -1 });
reportSchema.index({ assignedTo: 1, status: 1 });
reportSchema.index({ 'address.ward': 1, status: 1 });
reportSchema.index({ category: 1, status: 1 });
reportSchema.index({ official_tenure_id: 1 });

// Virtual for duration
reportSchema.virtual('durationDays').get(function() {
    if (this.status === 'Solved' && this.resolutionDetails?.resolvedAt) {
        const diff = this.resolutionDetails.resolvedAt - this.createdAt;
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
    }
    const diff = Date.now() - this.createdAt;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

// Pre-save middleware to add status history
reportSchema.pre('save', function(next) {
    if (this.isModified('status')) {
        this.statusHistory.push({
            status: this.status,
            timestamp: Date.now()
        });
    }
    next();
});

// Static method for geospatial queries (find reports near a location)
reportSchema.statics.findNearby = function(longitude, latitude, maxDistance = 5000) {
    return this.find({
        location: {
            $near: {
                $geometry: {
                    type: 'Point',
                    coordinates: [longitude, latitude]
                },
                $maxDistance: maxDistance // in meters
            }
        }
    });
};

// Static method for ward-based reports
reportSchema.statics.findByWard = function(ward, status = null) {
    const query = { 'address.ward': ward };
    if (status) query.status = status;
    return this.find(query).sort({ createdAt: -1 });
};

// Method to add upvote
reportSchema.methods.addUpvote = async function(userId) {
    if (!this.upvotedBy.includes(userId)) {
        this.upvotedBy.push(userId);
        this.upvotes += 1;
        await this.save();
    }
};

// Method to update status with history
reportSchema.methods.updateStatus = async function(newStatus, userId, comment) {
    this.status = newStatus;
    this.statusHistory.push({
        status: newStatus,
        updatedBy: userId,
        comment: comment,
        timestamp: Date.now()
    });

    if (newStatus === 'Solved') {
        this.resolutionDetails = {
            ...this.resolutionDetails,
            resolvedAt: Date.now(),
            resolvedBy: userId
        };
    }

    await this.save();
};

const Report = mongoose.model('Report', reportSchema);

module.exports = Report;