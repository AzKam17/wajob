import type { SortConfig } from '@/components/DataTable';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ApiResponse<T> {
  data: T[];
  pagination: Pagination;
}

function getAuthHeaders(): HeadersInit {
  const username = localStorage.getItem('admin_username')
  const password = localStorage.getItem('admin_password')

  if (!username || !password) {
    return {}
  }

  const credentials = btoa(`${username}:${password}`)
  return {
    'Authorization': `Basic ${credentials}`
  }
}

export async function fetchJobs(page: number, limit: number, search: string, sort?: SortConfig): Promise<ApiResponse<any>> {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });
  if (search) {
    params.set('search', search);
  }
  if (sort?.key && sort?.order) {
    params.set('sortBy', sort.key);
    params.set('sortOrder', sort.order);
  }

  const response = await fetch(`${API_URL}/admin/jobs?${params}`, {
    headers: getAuthHeaders()
  });
  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('admin_username')
      localStorage.removeItem('admin_password')
      window.location.reload()
    }
    throw new Error('Failed to fetch jobs');
  }
  return response.json();
}

export async function fetchBotUsers(page: number, limit: number, search: string, sort?: SortConfig): Promise<ApiResponse<any>> {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });
  if (search) {
    params.set('search', search);
  }
  if (sort?.key && sort?.order) {
    params.set('sortBy', sort.key);
    params.set('sortOrder', sort.order);
  }

  const response = await fetch(`${API_URL}/admin/bot-users?${params}`, {
    headers: getAuthHeaders()
  });
  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('admin_username')
      localStorage.removeItem('admin_password')
      window.location.reload()
    }
    throw new Error('Failed to fetch bot users');
  }
  return response.json();
}

export interface BotUserStats {
  totalMessages: number;
  firstMessage: {
    content: {
      type: string;
      text?: string;
    };
    timestamp: number;
  } | null;
}

export async function fetchBotUserStats(phoneNumber: string): Promise<BotUserStats> {
  const response = await fetch(`${API_URL}/admin/bot-users/${encodeURIComponent(phoneNumber)}/stats`, {
    headers: getAuthHeaders()
  });
  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('admin_username')
      localStorage.removeItem('admin_password')
      window.location.reload()
    }
    throw new Error('Failed to fetch bot user stats');
  }
  return response.json();
}

export interface Conversation {
  id: string;
  phoneNumber: string;
  sessionId: string;
  startedAt: number;
  endedAt?: number;
  lastActivityAt: number;
  messageCount: number;
  status: 'active' | 'completed' | 'abandoned';
  metadata?: {
    welcomeSent: boolean;
    searchQueriesCount: number;
    jobOffersShownCount: number;
    paginationRequestsCount: number;
    finalState?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  sessionId: string;
  phoneNumber: string;
  timestamp: number;
  direction: 'incoming' | 'outgoing';
  content: {
    type: 'text' | 'template' | 'interactive';
    text?: string;
    templateName?: string;
    buttons?: any[];
  };
  metadata?: {
    state?: string;
    processedAt?: number;
    jobOffersCount?: number;
  };
}

export async function fetchConversations(page: number, limit: number, search: string, sort?: SortConfig): Promise<ApiResponse<Conversation>> {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });
  if (search) {
    params.set('search', search);
  }
  if (sort?.key && sort?.order) {
    params.set('sortBy', sort.key);
    params.set('sortOrder', sort.order);
  }

  const response = await fetch(`${API_URL}/admin/conversations?${params}`, {
    headers: getAuthHeaders()
  });
  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('admin_username')
      localStorage.removeItem('admin_password')
      window.location.reload()
    }
    throw new Error('Failed to fetch conversations');
  }
  return response.json();
}

export interface PersonalizedLink {
  id: string;
  phoneNumber: string;
  jobAdId: string;
  jobAdUrl: string;
  clickCount: number;
  isActive: boolean;
  metadata: {
    jobTitle?: string;
    clickHistory?: Array<{
      clickNumber: number;
      timestamp: string;
      userAgent?: string;
      ip?: string;
    }>;
    lastClick?: {
      timestamp: string;
      userAgent?: string;
      ip?: string;
    };
  };
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMessages {
  conversation: Conversation;
  messages: Message[];
  links: PersonalizedLink[];
}

export async function fetchConversationMessages(conversationId: string): Promise<ConversationMessages> {
  const response = await fetch(`${API_URL}/admin/conversations/${conversationId}/messages`, {
    headers: getAuthHeaders()
  });
  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('admin_username')
      localStorage.removeItem('admin_password')
      window.location.reload()
    }
    throw new Error('Failed to fetch conversation messages');
  }
  return response.json();
}

export interface StatsResponse {
  messagesPerBucket: Array<{ bucket: number; count: number }>;
  newUsersPerBucket: Array<{ bucket: number; count: number }>;
  returningUsersPerBucket: Array<{ bucket: number; count: number }>;
  clicksPerBucket: Array<{ bucket: number; count: number }>;
  deviceBreakdown: Array<{ device: string; count: number }>;
  timeRange: { startTime: number; endTime: number };
}

export async function fetchStats(startTime: number, endTime: number): Promise<StatsResponse> {
  const params = new URLSearchParams({
    startTime: startTime.toString(),
    endTime: endTime.toString(),
  });

  const response = await fetch(`${API_URL}/admin/stats?${params}`, {
    headers: getAuthHeaders()
  });
  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('admin_username')
      localStorage.removeItem('admin_password')
      window.location.reload()
    }
    throw new Error('Failed to fetch stats');
  }
  return response.json();
}

export interface ReplayMessageRequest {
  messageId: string;
  phoneNumber: string;
  messageText: string;
  originalTimestamp?: number;
  contactName?: string;
}

export interface ReplayMessageResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export async function replayMessage(
  messageId: string,
  phoneNumber: string,
  messageText: string | undefined,
  originalTimestamp?: number,
  contactName?: string
): Promise<ReplayMessageResponse> {
  if (!messageText) {
    throw new Error('Message text is required')
  }

  const response = await fetch(`${API_URL}/admin/replay-message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({
      messageId,
      phoneNumber,
      messageText,
      originalTimestamp,
      contactName,
    }),
  });

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('admin_username')
      localStorage.removeItem('admin_password')
      window.location.reload()
    }
    throw new Error('Failed to replay message');
  }

  return response.json();
}
