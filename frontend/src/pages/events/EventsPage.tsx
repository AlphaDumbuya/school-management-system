/**
 * EventsPage — /events/school
 * Main events listing inside MainLayout
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { Button } from '@components/ui/button';
import { RoleGuard } from '@components/admin/common/RoleGuard';
import { EventList, EventCreator } from '@components/events';
import { Event } from '@types/events';

export const EventsPage: React.FC = () => {
  const navigate = useNavigate();
  const [showCreator, setShowCreator] = useState(false);

  const handleEventClick = (event: Event) => {
    navigate(`/events/school/${event.event_id}`);
  };

  const handleEventCreated = (event: Event) => {
    setShowCreator(false);
    navigate(`/events/school/${event.event_id}`);
  };

  if (showCreator) {
    return (
      <MainLayout>
        <PageShell
          title="Create Event"
          subtitle="Fill in the details for your new school event"
          breadcrumbs={[{ label: 'School Events', href: '/events/school' }, { label: 'Create' }]}
        >
          <div className="max-w-3xl">
            <EventCreator
              onSuccess={handleEventCreated}
              onCancel={() => setShowCreator(false)}
            />
          </div>
        </PageShell>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <PageShell
        title="School Events"
        subtitle="Browse and register for upcoming school events"
        breadcrumbs={[{ label: 'School Events' }]}
        actions={
          <RoleGuard roles={['super_admin', 'principal', 'teacher', 'admissions_officer']}>
            <Button size="sm" onClick={() => setShowCreator(true)}>
              <Plus className="w-4 h-4 mr-1.5" />
              Create Event
            </Button>
          </RoleGuard>
        }
      >
        <EventList showFilters={true} onEventClick={handleEventClick} />
      </PageShell>
    </MainLayout>
  );
};

export default EventsPage;
