// ============================================
// components/officials/PerformanceChart.tsx
// ============================================
'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface PerformanceChartProps {
    data: Array<{
        _id: { year: number; month: number };
        reported: number;
        solved: number;
    }>;
}

export default function PerformanceChart({ data }: PerformanceChartProps) {
    const chartData = data.map((item) => ({
        month: `${item._id.month}/${item._id.year}`,
        reported: item.reported,
        solved: item.solved,
    }));

    return (
        <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                    type="monotone"
                    dataKey="reported"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    name="Reported"
                />
                <Line
                    type="monotone"
                    dataKey="solved"
                    stroke="#10b981"
                    strokeWidth={2}
                    name="Solved"
                />
            </LineChart>
        </ResponsiveContainer>
    );
}
