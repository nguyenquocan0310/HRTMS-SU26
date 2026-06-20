import { useState } from 'react';
import { FiAlertOctagon } from 'react-icons/fi';
import styles from './ConfirmationModal.module.scss';

interface ConfirmationModalProps {
  title: string;
  message: string;
  /** Nếu có, người dùng phải gõ đúng chuỗi này mới enable nút xác nhận (dùng cho thao tác bất khả hồi) */
  confirmationPhrase?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmationModal = ({
  title,
  message,
  confirmationPhrase,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Hủy',
  onConfirm,
  onCancel,
}: ConfirmationModalProps) => {
  const [typedValue, setTypedValue] = useState('');

  const requiresTyping = Boolean(confirmationPhrase);
  const isConfirmEnabled = !requiresTyping || typedValue === confirmationPhrase;

  return (
    <>
      <div className={styles.overlay} onClick={onCancel} />
      <div className={styles.modal} role="dialog" aria-modal="true">
        <div className={styles.iconWrap}>
          <FiAlertOctagon size={22} />
        </div>

        <h3 className={styles.title}>{title}</h3>
        <p className={styles.message}>{message}</p>

        {requiresTyping && (
          <div className={styles.typeConfirmBlock}>
            <span className={styles.typeConfirmLabel}>
              Gõ <strong>{confirmationPhrase}</strong> để xác nhận:
            </span>
            <input
              type="text"
              className={styles.typeConfirmInput}
              value={typedValue}
              onChange={(e) => setTypedValue(e.target.value)}
              placeholder={confirmationPhrase}
              autoFocus
            />
          </div>
        )}

        <div className={styles.actions}>
          <button type="button" className={styles.cancelBtn} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={styles.confirmBtn}
            onClick={onConfirm}
            disabled={!isConfirmEnabled}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </>
  );
};

export default ConfirmationModal;