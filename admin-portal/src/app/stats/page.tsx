'use client';

import { useState, useEffect } from 'react';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { fetchStats, type StatsResponse } from '@/lib/api';

type TimePeriod = '15min' | '30min' | '1h' | '6h' | '12h' | '24h' | '1week' | '1month' | 'custom';

const TIME_PERIODS: { label: string; value: TimePeriod }[] = [
  { label: 'Last 15 minutes', value: '15min' },
  { label: 'Last 30 minutes', value: '30min' },
  { label: 'Last 1 hour', value: '1h' },
  { label: 'Last 6 hours', value: '6h' },
  { label: 'Last 12 hours', value: '12h' },
  { label: 'Last 24 hours', value: '24h' },
  { label: 'Last 1 week', value: '1week' },
  { label: 'Last 1 month', value: '1month' },
  { label: 'Custom range', value: 'custom' },
];

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

function getTimeRange(period: TimePeriod): { startTime: number; endTime: number } {
  const now = Date.now();
  const ranges: Record<Exclude<TimePeriod, 'custom'>, number> = {
    '15min': 15 * 60 * 1000,
    '30min': 30 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '12h': 12 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '1week': 7 * 24 * 60 * 60 * 1000,
    '1month': 30 * 24 * 60 * 60 * 1000,
  };

  if (period === 'custom') {
    return { startTime: now - 24 * 60 * 60 * 1000, endTime: now };
  }

  return { startTime: now - ranges[period], endTime: now };
}

function formatTimestamp(timestamp: number, duration: number): string {
  const date = new Date(timestamp);

  if (duration <= 60 * 60 * 1000) {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  } else if (duration <= 24 * 60 * 60 * 1000) {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}

export default function StatsPage() {
  const [period, setPeriod] = useState<TimePeriod>('24h');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, [period, customStartDate, customEndDate]);

  const loadStats = async () => {
    setLoading(true);
    setError(null);

    try {
      let { startTime, endTime } = getTimeRange(period);

      if (period === 'custom' && customStartDate && customEndDate) {
        startTime = new Date(customStartDate).getTime();
        endTime = new Date(customEndDate).getTime();
      }

      const data = await fetchStats(startTime, endTime);
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  };

  const duration = stats ? stats.timeRange.endTime - stats.timeRange.startTime : 0;

  const prepareChartData = (buckets: Array<{ bucket: number; count: number }>) => {
    return buckets.map(b => ({
      time: formatTimestamp(b.bucket, duration),
      timestamp: b.bucket,
      count: b.count,
    }));
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Statistics</h1>

      <div className="mb-6 p-4 bg-white rounded-lg shadow">
        <label className="block text-sm font-medium mb-2">Time Period</label>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as TimePeriod)}
          className="px-3 py-2 border rounded-lg w-64"
        >
          {TIME_PERIODS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>

        {period === 'custom' && (
          <div className="mt-4 flex gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Start Date</label>
              <input
                type="datetime-local"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">End Date</label>
              <input
                type="datetime-local"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-3 py-2 border rounded-lg"
              />
            </div>
          </div>
        )}
      </div>

      {loading && <div className="text-center py-8">Loading statistics...</div>}
      {error && <div className="text-red-600 text-center py-8">{error}</div>}

      {stats && !loading && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">Messages Per Time</h2>
            {stats.messagesPerBucket.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={prepareChartData(stats.messagesPerBucket)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="count" stroke="#8884d8" name="Messages" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-500">No data for this period</div>
            )}
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">New Users Per Time</h2>
            {stats.newUsersPerBucket.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={prepareChartData(stats.newUsersPerBucket)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="count" stroke="#00C49F" name="New Users" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-500">No data for this period</div>
            )}
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">Returning Users Per Time</h2>
            {stats.returningUsersPerBucket.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={prepareChartData(stats.returningUsersPerBucket)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="count" stroke="#FF8042" name="Returning Users" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-500">No data for this period</div>
            )}
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">Link Clicks Per Time</h2>
            {stats.clicksPerBucket.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={prepareChartData(stats.clicksPerBucket)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="count" stroke="#FFBB28" name="Clicks" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-500">No data for this period</div>
            )}
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">Device Breakdown</h2>
            {stats.deviceBreakdown.length > 0 ? (
              <div className="flex items-center justify-center">
                <ResponsiveContainer width="100%" height={400}>
                  <PieChart>
                    <Pie
                      data={stats.deviceBreakdown}
                      dataKey="count"
                      nameKey="device"
                      cx="50%"
                      cy="50%"
                      outerRadius={150}
                      label={(entry) => `${entry.payload.device}: ${entry.payload.count}`}
                    >
                      {stats.deviceBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[400px] flex items-center justify-center text-gray-500">No data for this period</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
