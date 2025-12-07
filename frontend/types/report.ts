// ============================================
// types/report.ts - TypeScript Types
// ============================================
export interface Report {
    _id: string;
    title: string;
    description: string;
    category: ReportCategory;
    location: {
        type: 'Point';
        coordinates: [number, number]; // [longitude, latitude]
    };
    address: {
        street?: string;
        area?: string;
        ward: string;
        city: string;
        pincode?: string;
    };
    mediaType: 'none' | 'image' | 'video';
    mediaUrl?: string;
    cloudinaryId?: string;
    gridfsId?: string;
    status: ReportStatus;
    priority: 'Low' | 'Medium' | 'High' | 'Critical';
    reportedBy: {
        _id: string;
        name: string;
        email: string;
    };
    assignedTo?: {
        _id: string;
        name: string;
        officialDetails: {
            designation: string;
            department: string;
        };
    };
    official_tenure_id?: string;
    upvotes: number;
    views: number;
    createdAt: string;
    updatedAt: string;
}

export type ReportCategory =
    | 'Road_Damage'
    | 'Garbage_Collection'
    | 'Street_Lighting'
    | 'Water_Supply'
    | 'Drainage'
    | 'Illegal_Construction'
    | 'Public_Property_Damage'
    | 'Other';

export type ReportStatus =
    | 'Pending'
    | 'Acknowledged'
    | 'In_Progress'
    | 'Reported'
    | 'Solved'
    | 'Rejected';

export interface OfficialScorecard {
    official: {
        id: string;
        name: string;
        email: string;
        designation: string;
        department: string;
    };
    currentTenure: {
        ward: string;
        position: string;
        startDate: string;
        endDate: string | null;
    } | null;
    statistics: {
        totalReported: number;
        solved: number;
        pending: number;
        inProgress: number;
        rejected: number;
        efficiencyScore: number;
        averageResolutionTime: string;
    };
    categoryPerformance: CategoryPerformance[];
    performanceTrend: PerformanceTrend[];
    ratings: {
        efficiency: { rating: string; grade: string };
        speed: { rating: string; grade: string };
    };
}

interface CategoryPerformance {
    category: string;
    total: number;
    solved: number;
    percentage: number;
}

interface PerformanceTrend {
    _id: { year: number; month: number };
    reported: number;
    solved: number;
}
