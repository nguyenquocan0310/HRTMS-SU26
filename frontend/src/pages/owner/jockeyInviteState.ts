import type { JockeyInvitation } from '../../types/owner.types';

export type JockeyInviteAction = 'invite' | 'invited' | 'pay' | 'verifying' | 'paired' | 'reinvite';

export interface JockeyInviteState {
  action: JockeyInviteAction;
  pairing?: JockeyInvitation;
}

const statusPriority: Record<JockeyInvitation['status'], number> = {
  Confirmed: 6,
  PendingVerification: 5,
  Accepted: 4,
  Pending: 3,
  Declined: 2,
  Rejected: 2,
  Expired: 2,
  Cancelled: 2,
};

const actionByStatus: Record<JockeyInvitation['status'], JockeyInviteAction> = {
  Confirmed: 'paired',
  PendingVerification: 'verifying',
  Accepted: 'pay',
  Pending: 'invited',
  Declined: 'reinvite',
  Rejected: 'reinvite',
  Expired: 'reinvite',
  Cancelled: 'reinvite',
};

export function getJockeyInviteState(
  jockeyId: string | number,
  tournamentId: string | number | null,
  horseId: string | number | null,
  invitations: JockeyInvitation[],
): JockeyInviteState {
  if (!tournamentId || !horseId) return { action: 'invite' };

  const matchingPairings = invitations
    .filter((invitation) =>
      String(invitation.jockeyID) === String(jockeyId)
      && String(invitation.tournamentID) === String(tournamentId)
      && String(invitation.horseID) === String(horseId))
    .sort((left, right) => {
      const priorityDifference = statusPriority[right.status] - statusPriority[left.status];
      if (priorityDifference !== 0) return priorityDifference;
      return right.invitedAt.getTime() - left.invitedAt.getTime();
    });

  const pairing = matchingPairings[0];
  return pairing ? { action: actionByStatus[pairing.status], pairing } : { action: 'invite' };
}
