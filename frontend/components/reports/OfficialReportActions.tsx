// =========================================================
// components/reports/OfficialReportActions.tsx (FIXED)
// =========================================================
'use client';
import { useState } from 'react';
import { Check, Loader2, X, AlertCircle ,Clock} from 'lucide-react';
import api from '@/lib/api';
import { Report } from '@/types/report';

interface OfficialReportActionsProps {
    report: Report;
    onStatusUpdate: (updatedReport: Report) => void;
}

export default function OfficialReportActions({ report, onStatusUpdate }: OfficialReportActionsProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showResolutionForm, setShowResolutionForm] = useState(false);
    const [resolutionDescription, setResolutionDescription] = useState('');

    // FIX 1: Correct the actionable statuses.
    // An official can claim resolution if the status is 'Pending' (initial)
    // or 'In_Progress' (rejected/re-work).
    const isActionable = report.status === 'Pending' || report.status === 'In_Progress';

    const isResolvedClaimed = report.status === 'Reported'; // Awaiting reporter verification

    // --- markAsResolved Logic (Unchanged) ---
    const handleMarkAsResolved = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const response = await api.patch(`/reports/${report._id}/mark-resolved`, {
                resolutionDescription,
                verificationMedia: [],
            });

            onStatusUpdate(response.data.data);
            setShowResolutionForm(false);

        } catch (err: any) {
            console.error('Failed to claim resolution:', err);
            setError(err.response?.data?.message || 'Failed to claim resolution.');
        } finally {
            setLoading(false);
        }
    };

    // 1. Status: Awaiting Verification ('Reported')
    if (isResolvedClaimed) {
        return (
            <div className="p-4 bg-yellow-50 text-yellow-800 rounded-lg flex items-center gap-3 border border-yellow-200">
                <Clock className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm font-medium">Resolution claimed. Awaiting verification from the reporter.</p>
            </div>
        );
    }

    // 2. Status: Not Actionable (e.g., 'Solved')
    // If the status is 'Solved' (final), the button should not show.
    if (!isActionable) {
        // If report.status is 'Solved' or any other non-actionable status.
        return null;
    }

    // 3. Status: Actionable (Show Form or Button)
    if (showResolutionForm) {
        return (
            <form onSubmit={handleMarkAsResolved} className="p-4 bg-white rounded-xl shadow-lg border border-gray-100">

                {/* Header */}
                <h4 className="text-xl font-bold text-gray-900 mb-4 border-b pb-2">Claim Resolution</h4>

                {/* Error Message */}
                {error && (
                    <div className="mb-4 p-3 bg-red-50 text-red-800 rounded-lg flex items-center gap-2 border border-red-200">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        <span className="text-sm font-medium">{error}</span>
                    </div>
                )}

                {/* Description Textarea (Primary Input) */}
                <label htmlFor="resolution-desc" className="block text-sm font-medium text-gray-700 mb-2">
                    Description of steps taken
                </label>
                <textarea
                    id="resolution-desc"
                    value={resolutionDescription}
                    onChange={(e) => setResolutionDescription(e.target.value)}
                    placeholder="Briefly describe the actions taken to resolve this report (e.g., 'Repaired pipe', 'Cleaned up debris'). This will be sent to the reporter for verification."
                    rows={5}
                    required
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500 text-sm resize-none"
                />

                {/* Action Buttons */}
                <div className="flex justify-end gap-3 mt-4">

                    {/* Cancel Button */}
                    <button
                        type="button"
                        onClick={() => setShowResolutionForm(false)}
                        className="flex items-center text-sm px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition"
                        disabled={loading}
                    >
                        <X className="w-4 h-4 mr-2" />
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={loading || !resolutionDescription.trim()}
                        className="flex items-center text-sm px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <Check className="w-4 h-4 mr-2" />
                        )}

                        Claim & verify
                    </button>
                </div>
            </form>
                   );
    }

    // 4. Status: Actionable (Show Initial Button)
    return (
        <div className="mt-4">
            <button
                onClick={() => setShowResolutionForm(true)}
                className="w-full flex items-center justify-center px-4 py-3 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 transition shadow-md"
            >
                <Check className="w-5 h-5 mr-2" /> Claim Resolution
            </button>
        </div>
    );
}