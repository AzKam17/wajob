'use client';

import { useState, useEffect } from 'react';
import { DataTable } from '@/components/DataTable';
import { ChatPanel } from '@/components/ChatPanel';
import { fetchConversations, fetchConversationMessages, Conversation, Message, PersonalizedLink } from '@/lib/api';
import { formatDate } from '@/lib/utils';

const columns = [
  {
    key: 'phoneNumber',
    header: 'Phone Number',
  },
  {
    key: 'messageCount',
    header: 'Messages',
  },
  {
    key: 'status',
    header: 'Status',
    render: (value: string) => {
      const colors: Record<string, string> = {
        active: 'bg-green-100 text-green-800',
        completed: 'bg-blue-100 text-blue-800',
        abandoned: 'bg-gray-100 text-gray-800',
      };
      return (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[value] || 'bg-gray-100 text-gray-800'}`}>
          {value}
        </span>
      );
    },
  },
  {
    key: 'startedAt',
    header: 'First Message',
    render: (value: number | string) => formatDate(value, true),
  },
  {
    key: 'lastActivityAt',
    header: 'Last Message',
    render: (value: number | string) => formatDate(value, true),
  },
];

export default function ConversationsPage() {
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [links, setLinks] = useState<PersonalizedLink[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  useEffect(() => {
    if (selectedConversation) {
      setLoadingMessages(true);
      setMessages([]);
      setLinks([]);
      fetchConversationMessages(selectedConversation.id)
        .then((data) => {
          setMessages(data.messages);
          setLinks(data.links || []);
        })
        .catch(console.error)
        .finally(() => setLoadingMessages(false));
    }
  }, [selectedConversation]);

  const handleClose = () => {
    setSelectedConversation(null);
    setMessages([]);
    setLinks([]);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Conversations</h1>
      <DataTable
        columns={columns}
        fetchData={fetchConversations}
        searchPlaceholder="Search by phone number..."
        onRowClick={(conversation) => setSelectedConversation(conversation as Conversation)}
      />

      <ChatPanel
        isOpen={!!selectedConversation}
        onClose={handleClose}
        conversation={selectedConversation}
        messages={messages}
        links={links}
        loading={loadingMessages}
      />
    </div>
  );
}
