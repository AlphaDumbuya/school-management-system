// @vitest-environment jsdom
/**
 * Admissions application modal: only the next allowed steps are offered, a
 * rejection needs a reason, and Enrol bills the class's billed terms and
 * guards a full class.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

const api = vi.hoisted(() => ({
  getDetail: vi.fn(), updateStatus: vi.fn(), enrol: vi.fn(), addNote: vi.fn(), updateApplication: vi.fn(), deleteApplication: vi.fn(),
}));
vi.mock('@services/admissionsService', () => ({ admissionsService: api }));
vi.mock('@utils/toast', () => ({ showToast: { success: vi.fn(), error: vi.fn() } }));

import { ApplicationDetailModal, EnrolDialog } from '../ApplicationDetailModal';

const META: any = {
  active_year: '2027/2028', documents: [{ key: 'birth_certificate', label: 'Birth certificate' }],
  classes: [
    { id: 'c1', name: 'Class 6', level: 'Primary', capacity: 30, enrolled: 12, full: false, billed_terms: ['First Term', 'Second Term'] },
    { id: 'c2', name: 'JSS 3', level: 'JSS', capacity: 2, enrolled: 2, full: true, billed_terms: [] },
  ],
};

const app = (over: Record<string, unknown> = {}) => ({
  id: 'a1', application_number: 'ADM-1', academic_year: '2027/2028', status: 'pending',
  child_first_name: 'Fatmata', child_last_name: 'Kamara', child_dob: '2015-01-01', child_gender: 'female',
  guardian_first_name: 'Abu', guardian_last_name: 'Kamara', guardian_relationship: 'Father', guardian_phone: '+232', guardian_email: 'a@b.c',
  takes_medication: false, has_allergies: false, has_chronic_illness: false, allow_first_aid: true,
  created_at: '2026-10-01', documents: {}, events: [], duplicates: { applications: [], students: [] },
  allowed: ['under_review', 'interview_scheduled', 'approved', 'waitlist', 'rejected', 'withdrawn'],
  can_enrol: false, class_is_current: true, documents_list: META.documents, class_applying_for: 'c1',
  ...over,
});

function renderModal() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}><MemoryRouter>
      <ApplicationDetailModal id="a1" meta={META} onClose={() => {}} onEdit={() => {}} onChanged={() => {}} />
    </MemoryRouter></QueryClientProvider>,
  );
}

beforeEach(() => { Object.values(api).forEach((f) => f.mockReset()); });
afterEach(() => cleanup());

describe('ApplicationDetailModal', () => {
  it('offers only the next allowed steps for a new application', async () => {
    api.getDetail.mockResolvedValue({ success: true, data: app() });
    renderModal();
    expect(await screen.findByRole('button', { name: /Start review/ })).toBeTruthy();
    for (const l of [/Schedule interview/, /^Approve$/, /Waitlist/, /^Reject$/, /Mark withdrawn/]) expect(screen.getByRole('button', { name: l })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Enrol$/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Reopen/ })).toBeNull();
  });

  it('an approved application offers Enrol and Reopen, not Approve', async () => {
    api.getDetail.mockResolvedValue({ success: true, data: app({ status: 'approved', allowed: ['under_review', 'withdrawn'], can_enrol: true }) });
    renderModal();
    expect(await screen.findByRole('button', { name: /^Enrol$/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Reopen/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Mark withdrawn/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Approve$/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Start review/ })).toBeNull();
  });

  it('an enrolled application has no actions and links to the student', async () => {
    api.getDetail.mockResolvedValue({ success: true, data: app({ status: 'enrolled', allowed: [], student_id: 's1', student_number: 'AGA1', enrolled_class_name: 'Class 6' }) });
    renderModal();
    expect(await screen.findByText(/Open profile/)).toBeTruthy();
    for (const l of [/^Enrol$/, /^Approve$/, /Reopen/, /Edit/, /Mark withdrawn/]) expect(screen.queryByRole('button', { name: l })).toBeNull();
  });

  it('rejecting needs a reason before it is sent', async () => {
    api.getDetail.mockResolvedValue({ success: true, data: app() });
    api.updateStatus.mockResolvedValue({ success: true, data: { ...app({ status: 'rejected' }), email_sent: true } });
    renderModal();
    fireEvent.click(await screen.findByRole('button', { name: /^Reject$/ }));
    const reason = await screen.findByLabelText(/Reason \(required\)/);
    const dialog = reason.closest('[role="dialog"]') as HTMLElement || document.body;
    const confirm = within(dialog).getAllByRole('button', { name: /^Reject$/ }).pop()!;
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(reason, { target: { value: 'Class full' } });
    expect((confirm as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(confirm);
    await waitFor(() => expect(api.updateStatus).toHaveBeenCalledWith('a1', expect.objectContaining({ status: 'rejected', note: 'Class full' })));
  });
});

describe('EnrolDialog', () => {
  it('bills the class\'s billed terms by default and sends the choice', async () => {
    api.enrol.mockResolvedValue({ success: true, data: { already: false, student: { id: 's', student_id: 'X' }, accounts: null, application: app() } });
    const onDone = vi.fn();
    render(<MemoryRouter><EnrolDialog app={app({ status: 'approved' })} meta={META} onClose={() => {}} onDone={onDone} /></MemoryRouter>);
    const first = await screen.findByLabelText('First Term') as HTMLInputElement;
    const second = screen.getByLabelText('Second Term') as HTMLInputElement;
    expect(first.checked && second.checked).toBe(true);
    fireEvent.click(second); // late joiner: not paying Second Term
    fireEvent.click(screen.getByRole('button', { name: /Enrol as a student/ }));
    await waitFor(() => expect(api.enrol).toHaveBeenCalledWith('a1', { class_id: 'c1', allow_over_capacity: false, bill_terms: ['First Term'] }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });

  it('a full class needs "enrol over capacity" to be ticked', async () => {
    render(<MemoryRouter><EnrolDialog app={app({ status: 'approved', class_applying_for: 'c2' })} meta={META} onClose={() => {}} onDone={() => {}} /></MemoryRouter>);
    const btn = await screen.findByRole('button', { name: /Enrol as a student/ }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.click(screen.getByLabelText(/Enrol over capacity anyway/));
    expect(btn.disabled).toBe(false);
  });

  it('a class from an earlier year is not preselected', async () => {
    render(<MemoryRouter><EnrolDialog app={app({ status: 'approved', class_applying_for: 'old-class' })} meta={META} onClose={() => {}} onDone={() => {}} /></MemoryRouter>);
    expect(await screen.findByText(/isn’t open this year/)).toBeTruthy();
    expect((screen.getByRole('button', { name: /Enrol as a student/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});
