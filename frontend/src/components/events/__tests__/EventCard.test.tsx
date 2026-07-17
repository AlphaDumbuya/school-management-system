/**
 * EventCard Component Tests
 * Task 7.2 - Component tests for EventCard
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EventCard } from '../EventCard';
import { Event } from '@appTypes/events';

// Mock router
vi.mock('react-router-dom', () => ({
    useNavigate: () => vi.fn(),
}));

describe('EventCard', () => {
    const mockEvent: Event = {
        event_id: 1,
        tenant_id: 1,
        title: 'Annual Sports Day',
        description: 'School annual sports competition',
        event_type: 'sports',
        start_datetime: new Date('2026-08-15T09:00:00'),
        end_datetime: new Date('2026-08-15T17:00:00'),
        location: 'School Ground',
        organizer_id: 1,
        capacity: 200,
        registered_count: 150,
        status: 'published',
        is_public: true,
        created_at: new Date(),
        updated_at: new Date(),
    };

    const mockOnClick = vi.fn();

    it('should render event details correctly', () => {
        render(<EventCard event={mockEvent} onClick={mockOnClick} />);

        expect(screen.getByText('Annual Sports Day')).toBeInTheDocument();
        expect(screen.getByText('School annual sports competition')).toBeInTheDocument();
        expect(screen.getByText('School Ground')).toBeInTheDocument();
    });

    it('should display event date and time', () => {
        render(<EventCard event={mockEvent} onClick={mockOnClick} />);

        // Check for date (format may vary)
        expect(screen.getByText(/Aug/i)).toBeInTheDocument();
        expect(screen.getByText(/15/)).toBeInTheDocument();
    });

    it('should show capacity information', () => {
        render(<EventCard event={mockEvent} onClick={mockOnClick} />);

        expect(screen.getByText(/150/)).toBeInTheDocument();
        expect(screen.getByText(/200/)).toBeInTheDocument();
    });

    it('should display event status badge', () => {
        render(<EventCard event={mockEvent} onClick={mockOnClick} />);

        expect(screen.getByText(/published/i)).toBeInTheDocument();
    });

    it('should call onClick when card is clicked', () => {
        render(<EventCard event={mockEvent} onClick={mockOnClick} />);

        const card = screen.getByRole('article');
        fireEvent.click(card);

        expect(mockOnClick).toHaveBeenCalledWith(mockEvent);
    });

    it('should show "Full" badge when capacity is reached', () => {
        const fullEvent = {
            ...mockEvent,
            registered_count: 200,
        };

        render(<EventCard event={fullEvent} onClick={mockOnClick} />);

        expect(screen.getByText(/full/i)).toBeInTheDocument();
    });

    it('should display event type badge', () => {
        render(<EventCard event={mockEvent} onClick={mockOnClick} />);

        expect(screen.getByText(/sports/i)).toBeInTheDocument();
    });

    it('should show cancelled status for cancelled events', () => {
        const cancelledEvent = {
            ...mockEvent,
            status: 'cancelled' as const,
        };

        render(<EventCard event={cancelledEvent} onClick={mockOnClick} />);

        expect(screen.getByText(/cancelled/i)).toBeInTheDocument();
    });

    it('should be accessible', () => {
        const { container } = render(<EventCard event={mockEvent} onClick={mockOnClick} />);

        // Check for proper ARIA roles
        expect(screen.getByRole('article')).toBeInTheDocument();

        // Check for keyboard accessibility
        const card = screen.getByRole('article');
        expect(card).toHaveAttribute('tabIndex', '0');
    });

    it('should show organizer information', () => {
        const eventWithOrganizer = {
            ...mockEvent,
            organizer_name: 'Mr. Johnson',
        };

        render(<EventCard event={eventWithOrganizer} onClick={mockOnClick} />);

        expect(screen.getByText(/Mr. Johnson/i)).toBeInTheDocument();
    });
});
