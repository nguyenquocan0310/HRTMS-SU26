// ─── Registration Roles (Admin excluded — only assignable internally) ─────────
export enum RegRole {
  Owner     = 'HorseOwner',
  Jockey    = 'Jockey',
  Referee   = 'RaceReferee',
  Doctor    = 'Doctor',
  Spectator = 'Spectator',
}

// Display metadata for each role
export interface RoleMeta {
  key: RegRole;
  label: string;
  description: string;
  iconName: string; // mapped to react-icons in RoleCard
}

export const ROLE_OPTIONS: RoleMeta[] = [
  {
    key: RegRole.Owner,
    label: 'Owner',
    description: 'Manage your stable, registered horses, and track investment returns.',
    iconName: 'stable',
  },
  {
    key: RegRole.Jockey,
    label: 'Jockey',
    description: 'Access your race calendar, performance stats, and medical clearance.',
    iconName: 'flag',
  },
  {
    key: RegRole.Referee,
    label: 'Referee',
    description: 'Uphold tournament integrity, review photo finishes, and manage disputes.',
    iconName: 'scale',
  },
  {
    key: RegRole.Doctor,
    label: 'Doctor',
    description: 'Certify fitness for horses and athletes, monitor biometrics, and report status.',
    iconName: 'medical',
  },
  {
    key: RegRole.Spectator,
    label: 'Spectator',
    description: 'Follow your favorite races, place predictions, and access live telemetry.',
    iconName: 'eye',
  },
];
