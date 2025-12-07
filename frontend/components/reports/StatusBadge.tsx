import { ReportStatus } from '@/types/report';

interface StatusBadgeProps {
    status: ReportStatus;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
    const statusStyles = {
        Pending: 'bg-yellow-100 text-yellow-800',
        Acknowledged: 'bg-blue-100 text-blue-800',
        In_Progress: 'bg-purple-100 text-purple-800',
        Reported: 'bg-orange-100 text-orange-800',
        Solved: 'bg-green-100 text-green-800',
        Rejected: 'bg-red-100 text-red-800',
    };

    return (
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusStyles[status]}`}>
      {status.replace(/_/g, ' ')}
    </span>
    );
}

