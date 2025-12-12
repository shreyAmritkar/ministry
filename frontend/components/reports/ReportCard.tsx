'use client';

import Link from 'next/link';
import { MapPin, Calendar, User, TrendingUp } from 'lucide-react';
import { Report } from '@/types/report';
import StatusBadge from './StatusBadge';

interface ReportCardProps {
    report: Report;
    basePath?: string;
}

export default function ReportCard({ report, basePath = '/reports' }: ReportCardProps) {
    const reportLink = `${basePath}/${report._id}`;
    return (
        <Link href={reportLink}>
            <div className="bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow p-6 cursor-pointer">
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-bold text-gray-900 line-clamp-2">
                        {report.title}
                    </h3>
                    <StatusBadge status={report.status} />
                </div>

                {/* Description */}
                <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                    {report.description}
                </p>

                {/* Media Preview */}
                {report.mediaType !== 'none' && report.mediaUrl && (
                    <div className="mb-4 rounded-lg overflow-hidden">
                        {report.mediaType === 'image' ? (
                            <img
                                src={report.mediaUrl}
                                alt={report.title}
                                className="w-full h-48 object-cover"
                            />
                        ) : (
                            <video
                                src={report.mediaUrl}
                                className="w-full h-48 object-cover"
                                controls
                            />
                        )}
                    </div>
                )}

                {/* Meta Info */}
                <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        <span>{report.address.ward}, {report.address.city}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>{new Date(report.createdAt).toLocaleDateString()}</span>
                    </div>
                    {report.assignedTo && (
                        <div className="flex items-center gap-2">
                            <User className="w-4 h-4" />
                            <span>Assigned to {report.assignedTo.name}</span>
                        </div>
                    )}
                    <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" />
                        <span>{report.upvotes} upvotes</span>
                    </div>
                </div>

                {/* Category Badge */}
                <div className="mt-4">
          <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">
            {report.category.replace(/_/g, ' ')}
          </span>
                </div>
            </div>
        </Link>
    );
}