
// ============================================
// components/officials/EfficiencyGauge.tsx
// ============================================
'use client';

interface EfficiencyGaugeProps {
    score: number;
}

export default function EfficiencyGauge({ score }: EfficiencyGaugeProps) {
    const circumference = 2 * Math.PI * 70;
    const strokeDashoffset = circumference - (score / 100) * circumference;

    const getColor = (score: number) => {
        if (score >= 80) return '#10b981';
        if (score >= 60) return '#3b82f6';
        if (score >= 40) return '#f59e0b';
        return '#ef4444';
    };

    return (
        <div className="flex flex-col items-center justify-center">
            <div className="relative w-48 h-48">
                <svg className="transform -rotate-90 w-48 h-48">
                    {/* Background circle */}
                    <circle
                        cx="96"
                        cy="96"
                        r="70"
                        stroke="#e5e7eb"
                        strokeWidth="12"
                        fill="none"
                    />
                    {/* Progress circle */}
                    <circle
                        cx="96"
                        cy="96"
                        r="70"
                        stroke={getColor(score)}
                        strokeWidth="12"
                        fill="none"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        className="transition-all duration-1000"
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-5xl font-bold text-gray-900">{score}%</span>
                    <span className="text-sm text-gray-600">Efficiency</span>
                </div>
            </div>
        </div>
    );
}

