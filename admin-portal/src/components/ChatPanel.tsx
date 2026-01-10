'use client';

import { useEffect, useRef } from 'react';
import { X, MousePointer } from 'lucide-react';
import { Message, Conversation, PersonalizedLink } from '@/lib/api';
import { formatDate, formatTime } from '@/lib/utils';

// Parse user agent to get a readable device/browser string
function parseUserAgent(ua: string): string {
  if (!ua) return 'Unknown';

  // Check for mobile devices
  if (ua.includes('iPhone')) return 'iPhone';
  if (ua.includes('iPad')) return 'iPad';
  if (ua.includes('Android')) {
    if (ua.includes('Mobile')) return 'Android Phone';
    return 'Android Tablet';
  }

  // Check for browsers
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Safari')) return 'Safari';
  if (ua.includes('Edge')) return 'Edge';

  // Fallback: return first 30 chars
  return ua.substring(0, 30) + '...';
}

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: Conversation | null;
  messages: Message[];
  links: PersonalizedLink[];
  loading: boolean;
}

export function ChatPanel({ isOpen, onClose, conversation, messages, links, loading }: ChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />
      <div className="fixed right-0 top-0 h-full w-full max-w-2xl bg-white shadow-xl z-50 flex flex-col">
        {/* Header */}
        <div className="bg-gray-900 text-white px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Conversation</h2>
            {conversation && (
              <p className="text-sm text-gray-300">{conversation.phoneNumber}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conversation Info */}
        {conversation && (
          <div className="bg-gray-100 px-6 py-3 border-b border-gray-200">
            <div className="flex gap-4 text-sm">
              <div>
                <span className="text-gray-500">Status:</span>{' '}
                <span className={`font-medium ${
                  conversation.status === 'active' ? 'text-green-600' :
                  conversation.status === 'completed' ? 'text-blue-600' : 'text-gray-600'
                }`}>
                  {conversation.status}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Messages:</span>{' '}
                <span className="font-medium">{conversation.messageCount}</span>
              </div>
              <div>
                <span className="text-gray-500">Started:</span>{' '}
                <span className="font-medium">{formatDate(conversation.startedAt, true)}</span>
              </div>
            </div>
            {/* Link click stats */}
            {links.length > 0 && (
              <div className="mt-2 pt-2 border-t border-gray-200 flex gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Links sent:</span>{' '}
                  <span className="font-medium">{links.length}</span>
                </div>
                <div>
                  <span className="text-gray-500">Total clicks:</span>{' '}
                  <span className="font-medium text-green-600">
                    {links.reduce((sum, link) => sum + link.clickCount, 0)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Unique jobs clicked:</span>{' '}
                  <span className="font-medium text-green-600">
                    {links.filter(link => link.clickCount > 0).length}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500">Loading messages...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500">No messages in this conversation</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} links={links} />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function MessageBubble({ message, links }: { message: Message; links: PersonalizedLink[] }) {
  const isOutgoing = message.direction === 'outgoing';
  const timestamp = formatTime(message.timestamp);

  return (
    <div className={`flex ${isOutgoing ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2 ${
          isOutgoing
            ? 'bg-white border border-gray-200 text-gray-900 rounded-bl-sm'
            : 'bg-blue-600 text-white rounded-br-sm'
        }`}
      >
        {/* Message type indicator for templates/interactive */}
        {message.content.type !== 'text' && (
          <div className={`text-xs mb-1 ${isOutgoing ? 'text-gray-500' : 'text-blue-200'}`}>
            {message.content.type === 'template' && `Template: ${message.content.templateName || 'Unknown'}`}
            {message.content.type === 'interactive' && 'Interactive message'}
          </div>
        )}

        {/* Message content */}
        <div className="whitespace-pre-wrap break-words">
          {message.content.text || (
            <span className={`italic ${isOutgoing ? 'text-gray-400' : 'text-blue-200'}`}>
              {message.content.type === 'template' ? '[Template message]' : '[Interactive message]'}
            </span>
          )}
        </div>

        {/* Buttons for interactive messages */}
        {message.content.buttons && message.content.buttons.length > 0 && (
          <div className="mt-2 space-y-2">
            {message.content.buttons.map((button: any, idx: number) => {
              const buttonText = typeof button === 'string' ? button : (button.title || button.text || `Button ${idx + 1}`);
              // Check if this specific job was clicked
              const matchingLink = links.find(link => {
                const jobTitle = link.metadata?.jobTitle || '';
                return link.clickCount > 0 && (
                  buttonText.toLowerCase().includes(jobTitle.toLowerCase()) ||
                  jobTitle.toLowerCase().includes(buttonText.toLowerCase()) ||
                  buttonText === jobTitle
                );
              });

              return (
                <div key={idx}>
                  <div
                    className={`text-xs px-2 py-1 rounded flex items-center gap-1 ${
                      isOutgoing ? 'bg-gray-100 text-gray-600' : 'bg-blue-500 text-blue-100'
                    }`}
                  >
                    <span className="flex-1">{buttonText}</span>
                    {matchingLink && (
                      <span className="flex items-center gap-0.5 text-green-600 font-medium">
                        <MousePointer className="w-3 h-3" />
                        {matchingLink.clickCount}x
                      </span>
                    )}
                  </div>
                  {/* Link click metadata */}
                  {matchingLink && matchingLink.metadata?.lastClick && (
                    <div className={`ml-2 mt-1 text-xs p-2 rounded ${
                      isOutgoing ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-green-900/30 text-green-200'
                    }`}>
                      <div className="font-medium mb-1 flex items-center gap-1">
                        <MousePointer className="w-3 h-3" />
                        Link clicked
                      </div>
                      <div className="space-y-0.5 text-[10px]">
                        <div>
                          <span className="opacity-70">Last click:</span>{' '}
                          {formatDate(matchingLink.metadata.lastClick.timestamp, true)}
                        </div>
                        {matchingLink.metadata.lastClick.ip && (
                          <div>
                            <span className="opacity-70">IP:</span>{' '}
                            {matchingLink.metadata.lastClick.ip}
                          </div>
                        )}
                        {matchingLink.metadata.lastClick.userAgent && (
                          <div className="truncate max-w-[250px]" title={matchingLink.metadata.lastClick.userAgent}>
                            <span className="opacity-70">Device:</span>{' '}
                            {parseUserAgent(matchingLink.metadata.lastClick.userAgent)}
                          </div>
                        )}
                        {matchingLink.clickCount > 1 && matchingLink.metadata.clickHistory && (
                          <div className="mt-1 pt-1 border-t border-current/20">
                            <span className="opacity-70">All clicks:</span>
                            <div className="ml-2 mt-0.5 space-y-0.5">
                              {matchingLink.metadata.clickHistory.map((click, i) => (
                                <div key={i} className="flex items-center gap-1">
                                  <span className="opacity-50">#{click.clickNumber}</span>
                                  {formatDate(click.timestamp, true)}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Metadata display */}
        {message.metadata && (message.metadata.state || message.metadata.jobOffersCount) && (
          <div className={`text-xs mt-2 pt-2 border-t ${
            isOutgoing ? 'border-gray-200 text-gray-500' : 'border-blue-400 text-blue-200'
          }`}>
            {message.metadata.state && (
              <div className="flex items-center gap-1">
                <span className="opacity-70">State:</span>
                <span className="font-mono">{message.metadata.state}</span>
              </div>
            )}
            {message.metadata.jobOffersCount && (
              <div className="flex items-center gap-1">
                <span className="opacity-70">Jobs shown:</span>
                <span>{message.metadata.jobOffersCount}</span>
              </div>
            )}
          </div>
        )}

        {/* Timestamp */}
        <div className={`text-xs mt-1 ${isOutgoing ? 'text-gray-400' : 'text-blue-200'}`}>
          {timestamp}
        </div>
      </div>
    </div>
  );
}
