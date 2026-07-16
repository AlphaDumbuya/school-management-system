/**
 * MyEventsPage — /events/my-events
 * User's created events and registrations inside MainLayout
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Users } from 'lucide-react';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { EmptyState } from '@components/admin/feedback/EmptyState';
import { SkeletonCard } from '@components/admin/feedback/Skeleton';
import { StatusBadge } from '@components/admin/feedback/StatusBadge';
import { EventCard } from '@components/events';
import { Event, EventRegistration } from '@types/events';
import { eventsService } from '@services/eventsService';
import { showToast } from '@utils/toast';

export const MyEventsPage: React.FC = () => {
  const navigate = useNavigate();
  const [myEvents, setMyEvents] = useState<Event[]>([]);
  const [myRegistrations, setMyRegistrations] = useState<EventRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'created' | 'registered'>('created');

  useEffect(() => {
    const fetchMyData = async () => {
      setLoading(true);
      try {
        const [eventsRes, registrationsRes] = await Promise.all([
          eventsService.getMyEvents(),
          eventsService.getMyRegistrations(),
        ]);
        if (eventsRes.success && eventsRes.data) setMyEvents(eventsRes.data);
        if (registrationsRes.success && registrationsRes.data) setMyRegistrations(registrationsRes.data);
      } catch (error: any) {
        showToast.apiError(error.message || 'Failed to load your events');
      } finally {
        setLoading(false);
      }
    };
    fetchMyData();
  }, []);

  // Map registration status to StatusBadge compatible status
  const registrationStatus = (status: string) => {
    const map: Record<string, string> = {
      confirmed: 'active',
      pending: 'pending',
      waitlist: 'inactive',
      cancelled: 'cancelled',
    };
    return map[status] || 'inactive';
  };

  return (
    <MainLayout>
      <PageShell
        title="My Events"
        subtitle="Manage your created events and view your registrations"
        breadcrumbs={[{ label: 'My Events' }]}
      >
        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-700">
          <button
            role="tab"
            aria-selected={activeTab === 'created'}
            onClick={() => setActiveTab('created')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors
              ${activeTab === 'created'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:border-gray-300'
              }`}
          >
            <Calendar className="w-4 h-4" />
            Created by Me ({myEvents.length})
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'registered'}
            onClick={() => setActiveTab('registered')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors
              ${activeTab === 'registered'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:border-gray-300'
              }`}
          >
            <Users className="w-4 h-4" />
            My Registrations ({myRegistrations.length})
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <SkeletonCard /><SkeletonCard /><SkeletonCard />
          </div>
        ) : activeTab === 'created' ? (
          myEvents.length === 0 ? (
            <EmptyState
              message="No events created yet"
              description="Create your first event from the School Events page"
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {myEvents.map(event => (
                <EventCard
                  key={event.event_id}
                  event={event}
                  onClick={() => navigate(`/events/school/${event.event_id}`)}
                  showActions={true}
                />
              ))}
            </div>
          )
        ) : (
          myRegistrations.length === 0 ? (
            <EmptyState
              message="No registrations yet"
              description="Browse school events and register to attend"
            />
          ) : (
            <div className="space-y-3">
              {myRegistrations.map(reg => (
                <div
                  key={reg.registration_id}
                  className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 cursor-pointer hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                  onClick={() => navigate(`/events/school/${reg.event_id}`)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Registration status:</span>
                        <StatusBadge status={registrationStatus(reg.status)} showDot />
                      </div>
                      {reg.rsvp_status && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          RSVP: <span className="font-medium text-gray-900 dark:text-white capitalize">{reg.rsvp_status}</span>
                        </p>
                      )}
                      {reg.guests_count > 0 && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Guests: <span className="font-medium text-gray-900 dark:text-white">{reg.guests_count}</span>
                        </p>
                      )}
                      {reg.approval_status === 'pending' && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                          ⏳ Waiting for organizer approval
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </PageShell>
    </MainLayout>
  );
};

export default MyEventsPage;
