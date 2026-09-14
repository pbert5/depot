import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ProfileSelector from './profile-selector';
import type { Profile, ProfilesAdapter } from '@/data/profiles';

const one: Profile = {
  id: 'one',
  displayName: 'Ash',
  createdAt: '2026-01-01T00:00:00Z',
  kind: 'main'
};
const two: Profile = {
  id: 'two',
  displayName: 'League night',
  createdAt: '2026-01-02T00:00:00Z',
  kind: 'main'
};
const e2e: Profile = {
  id: 'e2e',
  displayName: 'Browser worker',
  createdAt: '2026-01-03T00:00:00Z',
  kind: 'e2e'
};

const adapter = (overrides: Partial<ProfilesAdapter> = {}): ProfilesAdapter => ({
  list: vi.fn().mockResolvedValue({ profiles: [one, two], active: one, activeProfileId: one.id }),
  create: vi.fn().mockResolvedValue(two),
  select: vi.fn().mockResolvedValue(two),
  rename: vi.fn().mockResolvedValue({ ...one, displayName: 'Renamed' }),
  ...overrides
});

describe('ProfileSelector', () => {
  it('shows Main and E2E tabs with counts and protects the reserved fixture', async () => {
    const reserved = {
      ...two,
      id: '00000000-0000-0000-0000-000000000002',
      displayName: 'E2E reserved user',
      kind: 'e2e' as const
    };
    const profiles = adapter({
      list: vi.fn().mockResolvedValue({
        profiles: [one, reserved, e2e],
        active: one,
        activeProfileId: one.id
      })
    });
    render(<ProfileSelector adapter={profiles} />);

    expect(await screen.findByTestId('current-profile')).toHaveTextContent('Ash');
    expect(screen.getByRole('tab', { name: /Main \(1\)/ })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByRole('tab', { name: /E2E \(1\)/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ash/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: /E2E reserved user/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /E2E \(1\)/ }));
    expect(screen.getByRole('button', { name: /Browser worker/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /E2E reserved user/ })).not.toBeInTheDocument();
  });

  it('searches and sorts visible profile rows', async () => {
    const profiles = adapter({
      list: vi.fn().mockResolvedValue({
        profiles: [two, one, e2e],
        active: one,
        activeProfileId: one.id
      })
    });
    render(<ProfileSelector adapter={profiles} />);
    await screen.findByTestId('current-profile');

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search profiles' }), {
      target: { value: 'league' }
    });
    expect(screen.getByRole('button', { name: /League night/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ash/ })).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox', { name: 'Sort profiles' }), {
      target: { value: 'created' }
    });
    expect(screen.getByRole('button', { name: /League night/ })).toBeInTheDocument();
  });

  it('selects, creates, and renames through the adapter', async () => {
    const renamed = { ...two, displayName: 'Renamed' };
    const profiles = adapter({
      list: vi
        .fn()
        .mockResolvedValueOnce({ profiles: [one, two], active: one, activeProfileId: one.id })
        .mockResolvedValueOnce({ profiles: [one, two], active: two, activeProfileId: two.id })
        .mockResolvedValueOnce({ profiles: [one, two], active: two, activeProfileId: two.id })
        .mockResolvedValue({
          profiles: [one, renamed],
          active: renamed,
          activeProfileId: renamed.id
        }),
      create: vi.fn().mockResolvedValue(two),
      rename: vi.fn().mockResolvedValue(renamed)
    });
    render(<ProfileSelector adapter={profiles} />);
    await screen.findByTestId('current-profile');

    fireEvent.click(screen.getByRole('button', { name: /League night/ }));
    await waitFor(() => expect(profiles.select).toHaveBeenCalledWith('two'));

    fireEvent.change(screen.getByLabelText('Create profile'), {
      target: { value: 'New campaign' }
    });
    fireEvent.click(screen.getByRole('button', { name: /create/i }));
    await waitFor(() => expect(profiles.create).toHaveBeenCalledWith('New campaign', 'main'));
    expect(await screen.findByTestId('current-profile')).toHaveTextContent('League night');

    fireEvent.click(screen.getByRole('button', { name: /rename current profile/i }));
    fireEvent.change(screen.getByLabelText('New profile name'), { target: { value: 'Renamed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(profiles.rename).toHaveBeenCalledWith('two', 'Renamed'));
    expect(await screen.findByTestId('current-profile')).toHaveTextContent('Renamed');
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
