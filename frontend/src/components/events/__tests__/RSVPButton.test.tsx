/**
 * RSVPButton Component Tests
 * Task 7.2 - Component tests for RSVPButton
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RSVPButton } from '../RSVPButton';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock the events service
vi.mock('@services/eventsService', () => ({
    eventsService: {
        registerForEvent: vi.fn(),
        cancelRegistration: vi.fn(),
        updateRSVP: vi.fn(),
    },
}));

describe('RSVPButton', () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
                mutations: { retry: false },
            },
        });
        vi.clearAllMocks();
    });

    const renderWithProvider = (component: React.ReactElement) => {
        return render(
            <QueryClientProvider client={queryClient}>
                {component}
            </QueryClientProvider>
        );
    };

    it('should show "Register" button for unregistered event', () => {
        renderWithProvider(
            <RSVPButton
                eventId={1}
                isRegistered={false}
                currentStatus={null}
                onSuccess={() => { }}
            />
        );

        expect(screen.getByRole('button', { name: /register/i })).toBeInTheDocument();
    });

    it('should show current RSVP status when registered', () => {
        renderWithProvider(
            <RSVPButton
                eventId={1}
                isRegistered={true}
                currentStatus="going"
                onSuccess={() => { }}
            />
        );

        expect(screen.getByText(/going/i)).toBeInTheDocument();
    });

    it('should open status selector when clicked', async () => {
        renderWithProvider(
            <RSVPButton
                eventId={1}
                isRegistered={true}
                currentStatus="going"
                onSuccess={() => { }}
            />
        );

        const button = screen.getByRole('button');
        fireEvent.click(button);

        await waitFor(() => {
            expect(screen.getByText(/maybe/i)).toBeInTheDocument();
            expect(screen.getByText(/not going/i)).toBeInTheDocument();
        });
    });

    it('should call onSuccess after successful registration', async () => {
        const onSuccess = vi.fn();
        const { eventsService } = await import('@services/eventsService');

        (eventsService.registerForEvent as any).mockResolvedValue({
            success: true,
            data: { registration_id: 1 },
        });

        renderWithProvider(
            <RSVPButton
                eventId={1}
                isRegistered={false}
                currentStatus={null}
                onSuccess={onSuccess}
            />
        );

        const button = screen.getByRole('button', { name: /register/i });
        fireEvent.click(button);

        await waitFor(() => {
            expect(onSuccess).toHaveBeenCalled();
        });
    });

    it('should show guest count input when allow_guests is true', () => {
        renderWithProvider(
            <RSVPButton
                eventId={1}
                isRegistered={false}
                currentStatus={null}
                allowGuests={true}
                onSuccess={() => { }}
            />
        );

        const button = screen.getByRole('button', { name: /register/i });
        fireEvent.click(button);

        expect(screen.getByLabelText(/guests/i)).toBeInTheDocument();
    });

    it('should disable button when event is full', () => {
        renderWithProvider(
            <RSVPButton
                eventId={1}
                isRegistered={false}
                currentStatus={null}
                isFull={true}
                onSuccess={() => { }}
            />
        );

        const button = screen.getByRole('button');
        expect(button).toBeDisabled();
        expect(screen.getByText(/full/i)).toBeInTheDocument();
    });

    it('should show loading state during registration', async () => {
        const { eventsService } = await import('@services/eventsService');

        (eventsService.registerForEvent as any).mockImplementation(
            () => new Promise(resolve => setTimeout(() => resolve({ success: true }), 1000))
        );

        renderWithProvider(
            <RSVPButton
                eventId={1}
                isRegistered={false}
                currentStatus={null}
                onSuccess={() => { }}
            />
        );

        const button = screen.getByRole('button', { name: /register/i });
        fireEvent.click(button);

        expect(button).toBeDisabled();
        expect(screen.getByRole('progressbar') || screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('should show error message on registration failure', async () => {
        const { eventsService } = await import('@services/eventsService');

        (eventsService.registerForEvent as any).mockResolvedValue({
            success: false,
            error: 'Registration failed',
        });

        renderWithProvider(
            <RSVPButton
                eventId={1}
                isRegistered={false}
                currentStatus={null}
                onSuccess={() => { }}
            />
        );

        const button = screen.getByRole('button', { name: /register/i });
        fireEvent.click(button);

        await waitFor(() => {
            expect(screen.getByText(/registration failed/i)).toBeInTheDocument();
        });
    });

    it('should allow cancellation of registration', async () => {
        const onSuccess = vi.fn();
        const { eventsService } = await import('@services/eventsService');

        (eventsService.cancelRegistration as any).mockResolvedValue({
            success: true,
        });

        renderWithProvider(
            <RSVPButton
                eventId={1}
                isRegistered={true}
                currentStatus="going"
                registrationId={1}
                onSuccess={onSuccess}
            />
        );

        const button = screen.getByRole('button');
        fireEvent.click(button);

        const cancelButton = await screen.findByText(/cancel registration/i);
        fireEvent.click(cancelButton);

        await waitFor(() => {
            expect(onSuccess).toHaveBeenCalled();
        });
    });

    it('should be keyboard accessible', () => {
        renderWithProvider(
            <RSVPButton
                eventId={1}
                isRegistered={false}
                currentStatus={null}
                onSuccess={() => { }}
            />
        );

        const button = screen.getByRole('button', { name: /register/i });

        // Should be focusable
        button.focus();
        expect(button).toHaveFocus();

        // Should trigger on Enter key
        fireEvent.keyDown(button, { key: 'Enter', code: 'Enter' });
    });
});
