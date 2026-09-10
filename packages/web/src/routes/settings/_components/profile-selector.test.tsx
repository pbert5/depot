import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ProfileSelector from './profile-selector';
import type { Profile, ProfilesAdapter } from '@/data/profiles';

const one: Profile = { id: 'one', displayName: 'Ash', createdAt: '2026-01-01T00:00:00Z' };
const two: Profile = { id: 'two', displayName: 'League night', createdAt: '2026-01-02T00:00:00Z' };

const adapter = (overrides: Partial<ProfilesAdapter> = {}): ProfilesAdapter => ({
  list: vi.fn().mockResolvedValue({ profiles: [one, two], active: one, activeProfileId: one.id }),
  create: vi.fn().mockResolvedValue(two),
  select: vi.fn().mockResolvedValue(two),
  rename: vi.fn().mockResolvedValue({ ...one, displayName: 'Renamed' }),
  ...overrides
});

describe('ProfileSelector', () => {
  it('shows the current profile and hides the reserved E2E profile', async () => {
    const reserved = {
      ...two,
      id: '00000000-0000-0000-0000-000000000002',
      displayName: 'E2E reserved user'
    };
    const profiles = adapter({
      list: vi
        .fn()
        .mockResolvedValue({ profiles: [one, reserved], active: one, activeProfileId: one.id })
    });
    render(<ProfileSelector adapter={profiles} />);

    expect(await screen.findByTestId('current-profile')).toHaveTextContent('Ash');
    expect(screen.getByRole('option', { name: 'Ash' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'E2E reserved user' })).not.toBeInTheDocument();
  });

  it('selects, creates, and renames through the adapter', async () => {
    const profiles = adapter();
    render(<ProfileSelector adapter={profiles} />);
    await screen.findByTestId('current-profile');

    fireEvent.change(screen.getByLabelText('Switch profile'), { target: { value: 'two' } });
    await waitFor(() => expect(profiles.select).toHaveBeenCalledWith('two'));

    fireEvent.change(screen.getByLabelText('Create profile'), {
      target: { value: 'New campaign' }
    });
    fireEvent.click(screen.getByRole('button', { name: /create/i }));
    await waitFor(() => expect(profiles.create).toHaveBeenCalledWith('New campaign'));

    fireEvent.click(screen.getByRole('button', { name: /rename current profile/i }));
    fireEvent.change(screen.getByLabelText('New profile name'), { target: { value: 'Renamed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(profiles.rename).toHaveBeenCalledWith('one', 'Renamed'));
  });

  it('renders loading and recoverable error states', async () => {
    const loadingAdapter = adapter({
      list: vi.fn().mockImplementation(() => new Promise(() => undefined))
    });
    const { unmount } = render(<ProfileSelector adapter={loadingAdapter} />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading profiles');
    unmount();

    const failingAdapter = adapter({ list: vi.fn().mockRejectedValue(new Error('API offline')) });
    render(<ProfileSelector adapter={failingAdapter} />);
    expect(await screen.findByText('API offline')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
