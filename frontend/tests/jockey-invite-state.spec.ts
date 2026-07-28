import { expect, test } from '@playwright/test';
import type { JockeyInvitation } from '../src/types/owner.types';
import { getJockeyInviteState } from '../src/pages/owner/jockeyInviteState';

function pairing(
  invitationID: string,
  status: JockeyInvitation['status'],
  invitedAt: string,
  overrides: Partial<JockeyInvitation> = {},
): JockeyInvitation {
  return {
    invitationID,
    tournamentID: 7,
    raceID: 'N/A',
    ownerID: '1',
    jockeyID: '21',
    status,
    invitedAt: new Date(invitedAt),
    horseID: '11',
    ...overrides,
  };
}

test.describe('getJockeyInviteState', () => {
  test('matches by jockey and tournament regardless of the selected horse', () => {
    const invitations = [
      pairing('paired-other-horse', 'Confirmed', '2026-07-21T08:00:00Z', { horseID: '12' }),
      pairing('wrong-tournament', 'Confirmed', '2026-07-21T09:00:00Z', { tournamentID: 8 }),
      pairing('accepted-current', 'Accepted', '2026-07-21T10:00:00Z'),
    ];

    expect(getJockeyInviteState(21, 7, invitations)).toEqual({
      action: 'paired',
      pairing: invitations[0],
    });
  });

  test('uses status priority before recency', () => {
    const invitations = [
      pairing('new-declined', 'Declined', '2026-07-21T12:00:00Z'),
      pairing('old-pending', 'Pending', '2026-07-20T12:00:00Z'),
      pairing('accepted', 'Accepted', '2026-07-19T12:00:00Z'),
      pairing('confirmed', 'Confirmed', '2026-07-18T12:00:00Z'),
    ];

    expect(getJockeyInviteState(21, 7, invitations).action).toBe('paired');
  });

  test('treats a confirmed pairing as fully paid and paired', () => {
    const confirmed = pairing('confirmed', 'Confirmed', '2026-07-21T11:00:00Z');

    expect(getJockeyInviteState(21, 7, [confirmed])).toEqual({
      action: 'paired',
      pairing: confirmed,
    });
  });

  test('keeps a submitted payment waiting for Admin verification', () => {
    const invitations = [
      pairing('accepted', 'Accepted', '2026-07-21T12:00:00Z'),
      pairing('submitted', 'PendingVerification', '2026-07-21T11:00:00Z'),
    ];

    expect(getJockeyInviteState(21, 7, invitations)).toEqual({
      action: 'verifying',
      pairing: invitations[1],
    });
  });

  test('uses the newest record when statuses have equal priority', () => {
    const invitations = [
      pairing('older', 'Cancelled', '2026-07-20T12:00:00Z'),
      pairing('newer', 'Declined', '2026-07-21T12:00:00Z'),
    ];

    expect(getJockeyInviteState(21, 7, invitations)).toEqual({
      action: 'reinvite',
      pairing: invitations[1],
    });
  });

  test('returns invite when no matching pairing exists', () => {
    expect(getJockeyInviteState(99, 7, [])).toEqual({ action: 'invite' });
  });
});
