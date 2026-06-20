import { RegRole, ROLE_OPTIONS } from '../../../types/role.types';
import RoleCard from '../../../components/common/RoleCard';
import styles from './StepRoleSelection.module.scss';

interface Props {
  selected: RegRole | null;
  onSelect: (role: RegRole) => void;
}

const StepRoleSelection = ({ selected, onSelect }: Props) => {
  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Select Your Role</h2>
      <p className={styles.subtitle}>
        Choose the role that best describes your participation in the tournament.
      </p>
      <div className={styles.cards}>
        {ROLE_OPTIONS.map((role) => (
          <RoleCard
            key={role.key}
            role={role}
            selected={selected === role.key}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
};

export default StepRoleSelection;