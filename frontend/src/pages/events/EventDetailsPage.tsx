/**
 * EventDetailsPage — /events/school/:eventId
 * Single event details inside MainLayout
 */

import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { Button } from '@components/ui/button';
import { EmptyState } from '@components/admin/feedback/EmptyState';
import { EventDetails } from '@components/events';

export const EventDetailsPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();

  if (!eventId) {
    return (
      <MainLayout>
        <PageShell title="Event Not Found" breadcrumbs={[{ label: 'School Events', href: '/events/school' }, { label: 'Not Found' }]}>
          <EmptyState message="Event not found" description="The event you are looking for does not exist or has been removed." />
        </PageShell>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <PageShell
        title="Event Details"
        breadcrumbs={[{ label: 'School Events', href: '/events/school' }, { label: 'Details' }]}
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate('/events/school')}>
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back to Events
          </Button>
        }
      >
        <div className="max-w-4xl">
          <EventDetails eventId={eventId} onUpdate={() => window.location.reload()} />
        </div>
      </PageShell>
    </MainLayout>
  );
};

export default EventDetailsPage;
