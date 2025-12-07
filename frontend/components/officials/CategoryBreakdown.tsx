// ============================================
// components/officials/CategoryBreakdown.tsx
// ============================================
'use client';

interface CategoryBreakdownProps {
    data: Array<{
        category: string;
        total: number;
        solved: number;
        percentage: number;
    }>;
}

export default function CategoryBreakdown({ data }: CategoryBreakdownProps) {
    return (
        <div className="space-y-4">
            {data.map((item) => (
                <div key={item.category} className="space-y-2">
                    <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">
              {item.category.replace(/_/g, ' ')}
            </span>
                        <span className="text-sm text-gray-600">
              {item.solved}/{item.total} ({item.percentage.toFixed(1)}%)
            </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${item.percentage}%` }}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
}
