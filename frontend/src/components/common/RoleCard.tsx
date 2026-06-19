// Gộp lại thành 1 dòng
import { type RoleMeta, RegRole } from '../../types/role.types';
import {
  GiHorseHead,
} from 'react-icons/gi';
import {
  FaBalanceScale,
  FaBriefcaseMedical,
  FaEye,
  FaFlag,
} from 'react-icons/fa';
import styles from './RoleCard.module.scss';

interface RoleCardProps {
  role: RoleMeta;
  selected: boolean;
  onSelect: (role: RegRole) => void;
}

const iconMap: Record<string, React.ReactNode> = {
  stable:  <GiHorseHead size={32} />,
  flag:    <FaFlag size={32} />,
  scale:   <FaBalanceScale size={32} />,
  medical: <FaBriefcaseMedical size={32} />,
  eye:     <FaEye size={32} />,
};

const RoleCard = ({ role, selected, onSelect }: RoleCardProps) => {
  return (
    <div
      className={`${styles.card} ${selected ? styles.selected : ''}`}
      onClick={() => onSelect(role.key)}
    >
      <div className={styles.icon}>
        {iconMap[role.iconName] ?? <FaFlag size={32} />}
      </div>
      <h3 className={styles.title}>{role.label}</h3>
      <p className={styles.description}>{role.description}</p>
    </div>
  );
};

export default RoleCard;