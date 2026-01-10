'use client';

import { useState, useEffect } from 'react';
import { DataTable } from '@/components/DataTable';
import { SidePanel, DetailRow } from '@/components/SidePanel';
import { fetchBotUsers, fetchBotUserStats, BotUserStats } from '@/lib/api';
import { formatDate } from '@/lib/utils';

interface BotUser {
  id: string;
  phoneNumber: string;
  preferences: Record<string, any>;
  lastMessageAt?: string;
  createdAt: string;
  updatedAt: string;
}

const columns = [
  {
    key: 'phoneNumber',
    header: 'Phone Number',
  },
  {
    key: 'lastMessageAt',
    header: 'Last Message',
    render: (value: string) => formatDate(value, true),
  },
  {
    key: 'createdAt',
    header: 'Created At',
    render: (value: string) => formatDate(value),
  },
];

export default function BotUsersPage() {
  const [selectedUser, setSelectedUser] = useState<BotUser | null>(null);
  const [userStats, setUserStats] = useState<BotUserStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => {
    if (selectedUser) {
      setLoadingStats(true);
      setUserStats(null);
      fetchBotUserStats(selectedUser.phoneNumber)
        .then(setUserStats)
        .catch(console.error)
        .finally(() => setLoadingStats(false));
    }
  }, [selectedUser]);

  const handleClose = () => {
    setSelectedUser(null);
    setUserStats(null);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Bot Users</h1>
      <DataTable
        columns={columns}
        fetchData={fetchBotUsers}
        searchPlaceholder="Search by phone number..."
        onRowClick={(user) => setSelectedUser(user as BotUser)}
      />

      <SidePanel
        isOpen={!!selectedUser}
        onClose={handleClose}
        title="User Details"
      >
        {selectedUser && (
          <dl className="space-y-1">
            <DetailRow label="Phone Number" value={selectedUser.phoneNumber} />
            <DetailRow
              label="Total Messages Received"
              value={
                loadingStats ? (
                  <span className="text-gray-400">Loading...</span>
                ) : (
                  userStats?.totalMessages ?? '-'
                )
              }
            />
            <DetailRow
              label="First Message"
              value={
                loadingStats ? (
                  <span className="text-gray-400">Loading...</span>
                ) : userStats?.firstMessage ? (
                  <div className="space-y-1">
                    <div className="text-xs text-gray-500">
                      {formatDate(userStats.firstMessage.timestamp, true)}
                    </div>
                    <div className="bg-gray-100 p-2 rounded text-sm">
                      {userStats.firstMessage.content.text || '-'}
                    </div>
                  </div>
                ) : '-'
              }
            />
            <DetailRow
              label="Last Message At"
              value={formatDate(selectedUser.lastMessageAt, true)}
            />
            <DetailRow
              label="Preferences"
              value={
                selectedUser.preferences && Object.keys(selectedUser.preferences).length > 0 ? (
                  <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-64">
                    {JSON.stringify(selectedUser.preferences, null, 2)}
                  </pre>
                ) : '-'
              }
            />
            <DetailRow label="ID" value={<span className="font-mono text-xs">{selectedUser.id}</span>} />
            <DetailRow
              label="Created At"
              value={formatDate(selectedUser.createdAt, true)}
            />
            <DetailRow
              label="Updated At"
              value={formatDate(selectedUser.updatedAt, true)}
            />
          </dl>
        )}
      </SidePanel>
    </div>
  );
}
