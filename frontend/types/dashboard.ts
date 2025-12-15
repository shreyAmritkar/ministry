import { LucideIcon } from 'lucide-react';

export interface DashboardStats {
    totalAssigned: number;
    pendingAction: number;
    inProgress: number;
    solved: number;
}

export interface StatCardProps {
    icon: React.ReactNode;
    label: string;
    value: number;
    color: 'indigo' | 'red' | 'yellow' | 'green';
    tooltip?: string;
}

export interface ScoreCardSectionProps {
    title: string;
    children: React.ReactNode;
    className?: string;
}

export interface ScoreIndicatorProps {
    icon: React.ReactNode;
    label: string;
    value: string | number;
    subLabel: string;
}

export interface RatingDisplayProps {
    label: string;
    rating: string;
    grade: string;
    color: 'blue' | 'yellow';
}