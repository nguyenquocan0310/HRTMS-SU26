import { FiAlertTriangle } from 'react-icons/fi';
import styles from './ConfirmDialog.module.scss';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog = ({
  title,
  message,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Hủy',
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => {
  return (
    <>
      <div className={styles.overlay} onClick={onCancel} />
      <div className={styles.dialog} role="dialog" aria-modal="true">
        <div className={`${styles.iconWrap} ${variant === 'danger' ? styles.iconDanger : ''}`}>
          <FiAlertTriangle size={20} />
        </div>

        <h3 className={styles.title}>{title}</h3>
        <p className={styles.message}>{message}</p>

        <div className={styles.actions}>
          <button type="button" className={styles.cancelBtn} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`${styles.confirmBtn} ${variant === 'danger' ? styles.confirmBtnDanger : ''}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </>
  );
};

export default ConfirmDialog;