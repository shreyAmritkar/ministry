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
     */
    async getOfficialScorecard(officialId) {
        const official = await User.findById(officialId);
        if (!official) {
            throw new ApiError('Official not found', 404);
        }

        if (official.userType !== 'official') {
            throw new ApiError('User is not an official', 400);
        }

        const officialCity = official.officialDetails?.city;

        const tenures = await OfficialTenure.findByOfficial(officialId);

        if (tenures.length === 0) {
            if (officialCity) {
                return {
                    official: { id: official._id, name: official.name, city: officialCity },
                    currentTenure: null,
                    tenureHistory: [],
                    statistics: { totalReported: 0, solved: 0, efficiencyScore: 0, averageResolutionTime: '0 days' },
                    categoryPerformance: [],
                    performanceTrend: [],
                    ratings: { efficiency: this.getEfficiencyRating(0), speed: this.getSpeedRating(999) }
                };
            }
            throw new ApiError('No tenure records found for this official', 404);
        }

        const tenureIds = tenures.map(t => t._id);

        const reportStats = await Report.countByOfficialTenureIds(tenureIds);

        const totalReported = reportStats.reduce((sum, stat) => sum + stat.count, 0);
        const solvedCount = reportStats.find(s => s._id === 'Solved')?.count || 0;
        const pendingCount = reportStats.find(s => s._id === 'Pending')?.count || 0;
        const inProgressCount = reportStats.find(s => s._id === 'In_Progress')?.count || 0;
        const rejectedCount = reportStats.find(s => s._id === 'Rejected')?.count || 0;

        const efficiencyScore = totalReported > 0
            ? Math.round((solvedCount / totalReported) * 100)
            : 0;

        const { total: resolvedTotal, solved: resolvedSolved } = await Report.resolvedCountForTenures(tenureIds);
        let avgResolutionTime = 0;
        if (resolvedSolved > 0) {
            // NOTE: average resolution time itself is computed per-tenure in
            // OfficialTenure.updateMetrics(); here we take the currently active
            // tenure's stored average as a fast approximation across all tenures.
            const active = tenures.find(t => t.isActive) || tenures[0];
            avgResolutionTime = active.metrics.averageResolutionTime || 0;
        }

        const categoryBreakdown = await Report.categoryBreakdownForTenures(tenureIds);

        const currentTenure = tenures.find(t => t.isActive);

        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const monthlyTrend = await Report.monthlyTrendForTenures(tenureIds, sixMonthsAgo);

        return {
            official: {
                id: official._id,
                name: official.name,
                email: official.email,
                city: currentTenure?.city || official.officialDetails?.city || null,
                position: currentTenure?.position || null,
                department: currentTenure?.department || null
            },
            currentTenure: currentTenure ? {
                city: currentTenure.city,
                position: currentTenure.position,
                startDate: currentTenure.startDate,
                endDate: currentTenure.endDate
            } : null,
            tenureHistory: tenures.map(t => ({
                city: t.city,
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
                efficiencyScore,
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

    getEfficiencyRating(score) {
        if (score >= 90) return { rating: 'Excellent', grade: 'A+' };
        if (score >= 80) return { rating: 'Very Good', grade: 'A' };
        if (score >= 70) return { rating: 'Good', grade: 'B+' };
        if (score >= 60) return { rating: 'Satisfactory', grade: 'B' };
        if (score >= 50) return { rating: 'Needs Improvement', grade: 'C' };
        return { rating: 'Poor', grade: 'D' };
    }

    getSpeedRating(days) {
        if (days <= 3) return { rating: 'Excellent', grade: 'A+' };
        if (days <= 7) return { rating: 'Very Good', grade: 'A' };
        if (days <= 14) return { rating: 'Good', grade: 'B+' };
        if (days <= 30) return { rating: 'Satisfactory', grade: 'B' };
        if (days <= 60) return { rating: 'Needs Improvement', grade: 'C' };
        return { rating: 'Poor', grade: 'D' };
    }

    /**
     * Compare official performance with CITY average
     */
    async compareWithCityAverage(officialId) {
        const scorecard = await this.getOfficialScorecard(officialId);
        const city = scorecard.currentTenure?.city;

        if (!city) {
            return { ...scorecard, comparison: null };
        }

        const excludedTenureIds = scorecard.tenureHistory.map(t => t._id).filter(Boolean);

        const cityTenures = await OfficialTenure.findAll({ city }, { limit: 1000, offset: 0 });
        const cityTenureIds = cityTenures
            .map(t => t._id)
            .filter(id => !excludedTenureIds.includes(id));

        if (cityTenureIds.length === 0) {
            return { ...scorecard, comparison: { cityAverage: 0, difference: 0, performanceTier: 'N/A' } };
        }

        const cityStats = await Report.resolvedCountForTenures(cityTenureIds);

        if (!cityStats || cityStats.total === 0) {
            return { ...scorecard, comparison: { cityAverage: 0, difference: scorecard.statistics.efficiencyScore, performanceTier: 'No City Data' } };
        }

        const cityAvgEfficiency = Math.round((cityStats.solved / cityStats.total) * 100);
        const difference = scorecard.statistics.efficiencyScore - cityAvgEfficiency;

        return {
            ...scorecard,
            comparison: {
                cityAverage: cityAvgEfficiency,
                difference: difference,
                performanceTier: difference > 0
                    ? 'Above City Average'
                    : difference < 0
                        ? 'Below City Average'
                        : 'At City Average'
            }
        };
    }
}

module.exports = new OfficialService();
