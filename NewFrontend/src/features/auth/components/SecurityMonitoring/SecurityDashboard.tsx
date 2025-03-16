import React, { useEffect, useState } from 'react';
import { SecurityService } from '../../services/security.service';
import { Chart } from 'chart.js';
import { toast } from 'react-toastify';

interface SecurityMetrics {
    failedLogins: number;
    blockedIPs: number;
    suspiciousLocations: number;
    highRiskEvents: number;
}

export const SecurityDashboard: React.FC = () => {
    const [metrics, setMetrics] = useState<SecurityMetrics | null>(null);
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState('24h');
    const securityService = new SecurityService();

    useEffect(() => {
        loadSecurityMetrics();
        const interval = setInterval(loadSecurityMetrics, 300000); // 5 minutes

        return () => clearInterval(interval);
    }, [timeRange]);

    const loadSecurityMetrics = async () => {
        try {
            setLoading(true);
            const response = await securityService.getSecurityMetrics(timeRange);
            setMetrics(response.data);
        } catch (error) {
            toast.error('Failed to load security metrics');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div>Loading security metrics...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Security Monitoring</h2>
                <select
                    value={timeRange}
                    onChange={(e) => setTimeRange(e.target.value)}
                    className="border rounded p-2"
                >
                    <option value="24h">Last 24 Hours</option>
                    <option value="7d">Last 7 Days</option>
                    <option value="30d">Last 30 Days</option>
                </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                    <h3 className="font-medium">Failed Login Attempts</h3>
                    <p className="text-2xl">{metrics?.failedLogins}</p>
                </div>
                <div className="p-4 border rounded-lg">
                    <h3 className="font-medium">Blocked IPs</h3>
                    <p className="text-2xl">{metrics?.blockedIPs}</p>
                </div>
                <div className="p-4 border rounded-lg">
                    <h3 className="font-medium">Suspicious Locations</h3>
                    <p className="text-2xl">{metrics?.suspiciousLocations}</p>
                </div>
                <div className="p-4 border rounded-lg">
                    <h3 className="font-medium">High Risk Events</h3>
                    <p className="text-2xl">{metrics?.highRiskEvents}</p>
                </div>
            </div>

            <div className="mt-6">
                <h3 className="text-lg font-medium mb-4">Recent Security Events</h3>
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead>
                            <tr>
                                <th className="px-6 py-3 border-b">Time</th>
                                <th className="px-6 py-3 border-b">Event Type</th>
                                <th className="px-6 py-3 border-b">IP Address</th>
                                <th className="px-6 py-3 border-b">Location</th>
                                <th className="px-6 py-3 border-b">Risk Level</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* Event rows will be populated here */}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};