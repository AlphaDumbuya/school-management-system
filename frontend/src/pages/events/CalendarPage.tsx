/**
 * CalendarPage — /events/calendar
 * Full calendar view inside MainLayout
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { EventCalendar, EventCreator } from '@components/events';
import { Event } from '@types/events';
import { RoleGuard } from '@components/admin/common/RoleGuard';

export const CalendarPage: React.FC = () => {
  const navigate = useNavigate();
  const [showCreator, setShowCreator] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const handleEventClick = (event: Event) => {
    navigate(`/events/school/${event.event_id}`);
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setShowCreator(true);
  };

  const handleEventCreated = (event: Event) => {
    setShowCreator(false);
    setSelectedDate(null);
    navigate(`/events/school/${event.event_id}`);
  };

  if (showCreator && selectedDate) {
    const startDate = selectedDate.toISOString().slice(0, 16);
    const endDate = new Date(selectedDate.getTime() + 60 * 60 * 1000).toISOString().slice(0, 16);

    return (
      <MainLayout>
        <PageShell
          title="Create Event"
          subtitle="New event from calendar selection"
          breadcrumbs={[{ label: 'Calendar', href: '/events/calendar' }, { label: 'Create' }]}
        >
          <div className="max-w-3xl">
            <RoleGuard roles={['super_admin', 'principal', 'teacher', 'admissions_officer']}>
              <EventCreator
                initialData={{ start_date: startDate, end_date: endDate, event_type: 'single' }}
                onSuccess={handleEventCreated}
                onCancel={() => { setShowCreator(false); setSelectedDate(null); }}
              />
            </RoleGuard>
          </div>
        </PageShell>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <PageShell
        title="Event Calendar"
        subtitle="View all school events in calendar format. Click a date to create a new event."
        breadcrumbs={[{ label: 'Calendar' }]}
      >
        <EventCalendar
          defaultView="month"
          onEventClick={handleEventClick}
          onDateClick={handleDateClick}
        />
      </PageShell>
    </MainLayout>
  );
};

export default CalendarPage;
