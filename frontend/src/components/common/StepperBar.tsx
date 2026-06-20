import styles from './StepperBar.module.scss';
import { RegRole } from '../../types/role.types';

export interface StepInfo {
  number: number;
  label: string;
}

export const STEPS: StepInfo[] = [
  { number: 1, label: 'Role Selection' },
  { number: 2, label: 'Identity' },
  { number: 3, label: 'Credentials' },
  { number: 4, label: 'Verification' },
  { number: 5, label: 'Review' },
  { number: 6, label: 'Finalize' },
];

interface StepperBarProps {
  currentStep: number;
  role: RegRole | null;
}

const StepperBar = ({ currentStep, role }: StepperBarProps) => {
  const isSkipped = (stepNumber: number) =>
    stepNumber === 4 && role === RegRole.Spectator;

  const getStepClass = (stepNumber: number) => {
    if (isSkipped(stepNumber)) return styles.skipped;
    if (stepNumber === currentStep) return styles.active;
    if (stepNumber < currentStep) return styles.completed;
    return styles.upcoming;
  };

  return (
    <div className={styles.stepper}>
      {STEPS.map((step, index) => (
        <div key={step.number} className={styles.stepWrapper}>
          {/* Đường nối giữa các bước */}
          {index > 0 && (
            <div
              className={`${styles.connector} ${
                step.number <= currentStep && !isSkipped(step.number)
                  ? styles.connectorActive
                  : ''
              }`}
            />
          )}

          {/* Bước */}
          <div className={`${styles.step} ${getStepClass(step.number)}`}>
            <div className={styles.circle}>
              {step.number}
            </div>
            <span className={styles.label}>{step.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default StepperBar;