/**
 * Communication Center Component
 * Enables communication between parents and teachers
 * Phase 13.3: Parent Portal
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { Button } from '@components/ui/button';
import { Mail, Megaphone, Calendar, Send, ArrowLeft } from 'lucide-react';

interface Message {
  id: string;
  sender: string;
  subject: string;
  preview: string;
  timestamp: string;
  read: boolean;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: 'high' | 'medium' | 'low';
  timestamp: string;
}

interface Meeting {
  id: string;
  title: string;
  date: string;
  time: string;
  organizer: string;
  status: 'pending' | 'confirmed' | 'completed';
}

interface CommunicationCenterProps {
  messages: Message[];
  announcements: Announcement[];
  meetings: Meeting[];
  isLoading?: boolean;
}

type TabType = 'messages' | 'announcements' | 'meetings';

export const CommunicationCenter: React.FC<CommunicationCenterProps> = ({
  messages,
  announcements,
  meetings,
  isLoading = false,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('messages');
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [replyText, setReplyText] = useState('');

  const unreadMessages = messages.filter(m => !m.read).length;
  const highPriorityAnnouncements = announcements.filter(a => a.priority === 'high').length;
  const pendingMeetings = meetings.filter(m => m.status === 'pending').length;

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'confirmed':
        return 'bg-green-100 text-green-800';
      case 'completed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-4">
      {/* Tab Navigation */}
      <div className="flex gap-2 border-b overflow-x-auto">
        {(['messages', 'announcements', 'meetings'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 font-medium border-b-2 transition whitespace-nowrap flex items-center gap-2 ${
              activeTab === tab
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab === 'messages' && <Mail className="w-4 h-4" />}
            {tab === 'announcements' && <Megaphone className="w-4 h-4" />}
            {tab === 'meetings' && <Calendar className="w-4 h-4" />}
            <span>{tab.charAt(0).toUpperCase() + tab.slice(1)}</span>
            {tab === 'messages' && unreadMessages > 0 && (
              <span className="ml-1 px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                {unreadMessages}
              </span>
            )}
            {tab === 'announcements' && highPriorityAnnouncements > 0 && (
              <span className="ml-1 px-2 py-0.5 bg-red-600 text-white text-xs rounded-full">
                {highPriorityAnnouncements}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Messages Tab */}
      {activeTab === 'messages' && (
        <div className="space-y-3">
          {selectedMessage ? (
            // Message Detail View
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setSelectedMessage(null)}
                    className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600">From: {selectedMessage.sender}</p>
                  <h3 className="text-xl font-bold text-gray-900 mt-1">{selectedMessage.subject}</h3>
                  <p className="text-xs text-gray-500 mt-1">{selectedMessage.timestamp}</p>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-gray-700">{selectedMessage.preview}</p>
                </div>

                {/* Reply Box */}
                <div className="border-t pt-4">
                  <label className="text-sm font-medium text-gray-700 block mb-2">Reply</label>
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Type your reply..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={4}
                  />
                  <div className="mt-2 flex gap-2 justify-end">
                    <Button variant="outline">Cancel</Button>
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2">
                      <Send className="w-4 h-4" />
                      Send Reply
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            // Messages List
            <>
              <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                <Mail className="w-4 h-4 mr-2" />
                Compose Message
              </Button>

              <div className="space-y-2">
                {messages.length === 0 ? (
                  <Card>
                    <CardContent className="pt-6 text-center text-gray-500">
                      No messages yet
                    </CardContent>
                  </Card>
                ) : (
                  messages.map(msg => (
                    <Card
                      key={msg.id}
                      onClick={() => setSelectedMessage(msg)}
                      className={`cursor-pointer hover:shadow-md transition ${!msg.read ? 'bg-blue-50' : ''}`}
                    >
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className={`font-semibold ${!msg.read ? 'text-blue-900' : 'text-gray-900'}`}>
                              {msg.sender}
                            </p>
                            <p className={`text-sm ${!msg.read ? 'font-medium text-gray-700' : 'text-gray-600'}`}>
                              {msg.subject}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">{msg.timestamp}</p>
                          </div>
                          {!msg.read && <div className="w-3 h-3 bg-blue-600 rounded-full mt-1" />}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Announcements Tab */}
      {activeTab === 'announcements' && (
        <div className="space-y-3">
          {announcements.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-gray-500">
                No announcements
              </CardContent>
            </Card>
          ) : (
            announcements.map(ann => (
              <Card key={ann.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold text-gray-900">{ann.title}</h4>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(ann.priority)}`}>
                      {ann.priority.charAt(0).toUpperCase() + ann.priority.slice(1)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{ann.content}</p>
                  <p className="text-xs text-gray-500">{ann.timestamp}</p>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Meetings Tab */}
      {activeTab === 'meetings' && (
        <div className="space-y-3">
          {meetings.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-gray-500">
                No meetings scheduled
              </CardContent>
            </Card>
          ) : (
            meetings.map(meeting => (
              <Card key={meeting.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold text-gray-900">{meeting.title}</h4>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(meeting.status)}`}>
                      {meeting.status.charAt(0).toUpperCase() + meeting.status.slice(1)}
                    </span>
                  </div>
                  <div className="space-y-1 text-sm text-gray-600 mb-3">
                    <p>📅 {meeting.date} at {meeting.time}</p>
                    <p>👤 {meeting.organizer}</p>
                  </div>
                  {meeting.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1 text-sm">
                        Decline
                      </Button>
                      <Button className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm">
                        Accept
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default CommunicationCenter;
