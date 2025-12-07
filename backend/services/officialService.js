// ============================================
// services/officialService.js
// Official Scorecard Business Logic
// ============================================
const Report = require('../models/Report');
const OfficialTenure = require('../models/OfficialTenure');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');

class OfficialService {
    /**
     * Get comprehensive scorecard for an official
     * @param {String} officialId - User ID of the official
     * @returns {Object} Scorecard data
     */
    async getOfficialScorecard(officialId) {
        // Verify official exists
        const official = await User.findById(officialId);

        if (!official) {
            throw new ApiError('Official not found', 404);
        }

        if (official.userType !== 'official') {
            throw new ApiError('User is not an official', 400);
        }

        // Get all tenures for this official
        const tenures = await OfficialTenure.find({
            official: officialId
        }).sort({ startDate: -1 });

        if (tenures.length === 0) {
            throw new ApiError('No tenure records found for this official', 404);
        }

        // Get tenure IDs
        const tenureIds = tenures.map(t => t._id);

        // Aggregate report statistics across all tenures
        const reportStats = await Report.aggregate([
            {
                $match: {
                    official_tenure_id: { $in: tenureIds }
                }
            },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        // Calculate statistics
        const totalReported = reportStats.reduce((sum, stat) => sum + stat.count, 0);
        const solvedCount = reportStats.find(s => s._id === 'Solved')?.count || 0;
        const pendingCount = reportStats.find(s => s._id === 'Pending')?.count || 0;
        const inProgressCount = reportStats.find(s => s._id === 'In_Progress')?.count || 0;
        const rejectedCount = reportStats.find(s => s._id === 'Rejected')?.count || 0;

        // Calculate efficiency score (percentage of solved reports)
        const efficiencyScore = totalReported > 0
            ? Math.round((solvedCount / totalReported) * 100)
            : 0;

        // Get average resolution time
        const resolvedReports = await Report.find({
            official_tenure_id: { $in: tenureIds },
            status: 'Solved',
            'resolutionDetails.resolvedAt': { $exists: true }
        });

        let avgResolutionTime = 0;
        if (resolvedReports.length > 0) {
            const totalDays = resolvedReports.reduce((sum, report) => {
                const createdAt = new Date(report.createdAt);
                const resolvedAt = new Date(report.resolutionDetails.resolvedAt);
                const days = Math.ceil((resolvedAt - createdAt) / (1000 * 60 * 60 * 24));
                return sum + days;
            }, 0);
            avgResolutionTime = Math.round(totalDays / resolvedReports.length);
        }

        // Get category-wise breakdown
        const categoryBreakdown = await Report.aggregate([
            {
                $match: {
                    official_tenure_id: { $in: tenureIds }
                }
            },
            {
                $group: {
                    _id: '$category',
                    total: { $sum: 1 },
                    solved: {
                        $sum: {
                            $cond: [{ $eq: ['$status', 'Solved'] }, 1, 0]
                        }
                    }
                }
            },
            {
                $project: {
                    category: '$_id',
                    total: 1,
                    solved: 1,
                    percentage: {
                        $multiply: [
                            { $divide: ['$solved', '$total'] },
                            100
                        ]
                    }
                }
            },
            {
                $sort: { total: -1 }
            }
        ]);

        // Get current active tenure
        const currentTenure = tenures.find(t => t.isActive);

        // Get performance trend (last 6 months)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const monthlyTrend = await Report.aggregate([
            {
                $match: {
                    official_tenure_id: { $in: tenureIds },
                    createdAt: { $gte: sixMonthsAgo }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' }
                    },
                    reported: { $sum: 1 },
                    solved: {
                        $sum: {
                            $cond: [{ $eq: ['$status', 'Solved'] }, 1, 0]
                        }
                    }
                }
            },
            {
                $sort: { '_id.year': 1, '_id.month': 1 }
            }
        ]);

        // Compile scorecard
        return {
            official: {
                id: official._id,
                name: official.name,
                email: official.email,
                designation: official.officialDetails?.designation,
                department: official.officialDetails?.department
            },
            currentTenure: currentTenure ? {
                ward: currentTenure.ward,
                position: currentTenure.position,
                startDate: currentTenure.startDate,
                endDate: currentTenure.endDate
            } : null,
            tenureHistory: tenures.map(t => ({
                ward: t.ward,
                position: t.position,
                startDate: t.startDate,
                endDate: t.endDate,
                isActive: t.isActive
            })),
            statistics: {
                totalReported,
                solved: solvedCount,
                pending: pendingCount,
                inProgress: inProgressCount,
                rejected: rejectedCount,
                efficiencyScore, // Main KPI
                averageResolutionTime: `${avgResolutionTime} days`
            },
            categoryPerformance: categoryBreakdown,
            performanceTrend: monthlyTrend,
            ratings: {
                efficiency: this.getEfficiencyRating(efficiencyScore),
                speed: this.getSpeedRating(avgResolutionTime)
            }
        };
    }

    /**
     * Get efficiency rating based on percentage
     */
    getEfficiencyRating(score) {
        if (score >= 90) return { rating: 'Excellent', grade: 'A+' };
        if (score >= 80) return { rating: 'Very Good', grade: 'A' };
        if (score >= 70) return { rating: 'Good', grade: 'B+' };
        if (score >= 60) return { rating: 'Satisfactory', grade: 'B' };
        if (score >= 50) return { rating: 'Needs Improvement', grade: 'C' };
        return { rating: 'Poor', grade: 'D' };
    }

    /**
     * Get speed rating based on average resolution time
     */
    getSpeedRating(days) {
        if (days <= 3) return { rating: 'Excellent', grade: 'A+' };
        if (days <= 7) return { rating: 'Very Good', grade: 'A' };
        if (days <= 14) return { rating: 'Good', grade: 'B+' };
        if (days <= 30) return { rating: 'Satisfactory', grade: 'B' };
        if (days <= 60) return { rating: 'Needs Improvement', grade: 'C' };
        return { rating: 'Poor', grade: 'D' };
    }

    /**
     * Compare official performance with ward average
     */
    async compareWithWardAverage(officialId) {
        const scorecard = await this.getOfficialScorecard(officialId);
        const ward = scorecard.currentTenure?.ward;

        if (!ward) {
            return { ...scorecard, comparison: null };
        }

        // Get all officials who served in this ward
        const wardTenures = await OfficialTenure.find({
            ward: ward,
            _id: { $ne: scorecard.tenureHistory[0]._id }
        });

        const wardTenureIds = wardTenures.map(t => t._id);

        const wardStats = await Report.aggregate([
            {
                $match: {
                    official_tenure_id: { $in: wardTenureIds }
                }
            },
            {
                $group: {
                    _id: null,
                    totalReported: { $sum: 1 },
                    solved: {
                        $sum: {
                            $cond: [{ $eq: ['$status', 'Solved'] }, 1, 0]
                        }
                    }
                }
            }
        ]);

        const wardAvgEfficiency = wardStats.length > 0
            ? Math.round((wardStats[0].solved / wardStats[0].totalReported) * 100)
            : 0;

        return {
            ...scorecard,
            comparison: {
                wardAverage: wardAvgEfficiency,
                difference: scorecard.statistics.efficiencyScore - wardAvgEfficiency,
                performanceTier: scorecard.statistics.efficiencyScore > wardAvgEfficiency
                    ? 'Above Average'
                    : 'Below Average'
            }
        };
    }
}

module.exports = new OfficialService();