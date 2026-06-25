import { useState } from 'react';
import { FiX, FiClock, FiCheckCircle, FiXCircle } from 'react-icons/fi';
import type { ApprovalItem } from './ApprovalCenter';
import {
  approveHorse,
  rejectHorse,
  approveJockey,
  approveReferee,
  approveDoctor,
} from '../../services/approvalService';
import styles from './ApprovalDetailPanel.module.scss';

interface Props {
  item: ApprovalItem;
  onClose: () => void;
  onSuccess: () => void; // gọi lại để refresh danh sách sau khi duyệt/từ chối
}

const ApprovalDetailPanel = ({ item, onClose, onSuccess }: Props) => {
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');

  const isReasonValid = rejectReason.trim().length >= 10;

  // BE chỉ có endpoint từ chối cho NGỰA. Jockey/Referee/Doctor chưa có reject.
  const canReject = item.type === 'horse';

  const doApprove = (): Promise<unknown> => {
    if (item.type === 'horse') return approveHorse(item.entityId);
    if (item.type === 'jockey') return approveJockey(item.entityId);
    return item.role === 'Referee' ? approveReferee(item.entityId) : approveDoctor(item.entityId);
  };

  const handleApprove = async () => {
    setSubmitting(true);
    setActionError('');
    try {
      await doApprove();
      onSuccess();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Duyệt hồ sơ thất bại.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmReject = async () => {
    if (!isReasonValid || item.type !== 'horse') return;
    setSubmitting(true);
    setActionError('');
    try {
      await rejectHorse(item.entityId, rejectReason.trim());
      onSuccess();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Từ chối hồ sơ thất bại.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />

      <div className={styles.drawer}>
        {/* ═══ HEADER ═══════════════════════════════════════════ */}
        <div className={styles.drawerHeader}>
          <h2 className={styles.drawerTitle}>{item.subject}</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Đóng">
            <FiX size={20} />
          </button>
        </div>

        <div className={styles.drawerBody}>
          {/* ═══ CORE SPECIFICATIONS ════════════════════════════ */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Core Specifications</h3>

            {item.type === 'horse' && (
              <div className={styles.specGrid}>
                <SpecRow label="Breed" value={item.breed} />
                <SpecRow
                  label="Doping Test Result"
                  value={item.dopingTestResult}
                  warning={item.dopingTestResult === 'Failed'}
                  warningText="Doping test thất bại"
                />
                <SpecRow label="Vaccination Record Ref" value={item.vaccinationRecordRef} />
              </div>
            )}

            {item.type === 'jockey' && (
              <div className={styles.specGrid}>
                <SpecRow label="License Certificate" value={item.licenseCertificate} />
                <SpecRow
                  label="Experience Years"
                  value={item.experienceYears != null ? `${item.experienceYears} năm` : '—'}
                />
              </div>
            )}

            {item.type === 'onboarding' && (
              <div className={styles.specGrid}>
                <SpecRow label="Role" value={item.role} />
                {item.role === 'Referee' && (
                  <SpecRow label="Certification Level" value={item.certificationLevel ?? '—'} />
                )}
                {item.role === 'Doctor' && (
                  <SpecRow label="Medical License Number" value={item.medicalLicenseNumber ?? '—'} />
                )}
              </div>
            )}
          </section>

          {/* ═══ VERIFICATION LOGS ══════════════════════════════ */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Verification Logs</h3>
            <div className={styles.timeline}>
              <div className={styles.timelineItem}>
                <div className={styles.timelineDot}>
                  <FiClock size={12} />
                </div>
                <div className={styles.timelineContent}>
                  <span className={styles.timelineLabel}>Hồ sơ được nộp</span>
                  <span className={styles.timelineTime}>{item.submittedDate}</span>
                </div>
              </div>
              <div className={styles.timelineItem}>
                <div className={styles.timelineDot}>
                  <FiClock size={12} />
                </div>
                <div className={styles.timelineContent}>
                  <span className={styles.timelineLabel}>Đang chờ Admin xem xét</span>
                  <span className={styles.timelineTime}>{item.status}</span>
                </div>
              </div>
            </div>
          </section>

          {/* ═══ REJECT FORM (chỉ Ngựa) ═════════════════════════ */}
          {showRejectForm && canReject && (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Lý do từ chối</h3>
              <textarea
                className={styles.rejectTextarea}
                rows={4}
                placeholder="Nhập lý do từ chối (tối thiểu 10 ký tự)..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
              {!isReasonValid && rejectReason.length > 0 && (
                <span className={styles.rejectError}>
                  Lý do phải có ít nhất 10 ký tự (hiện tại: {rejectReason.trim().length}).
                </span>
              )}
            </section>
          )}

          {actionError && <div className={styles.rejectError}>{actionError}</div>}
        </div>

        {/* ═══ FOOTER ACTIONS ══════════════════════════════════ */}
        <div className={styles.drawerFooter}>
          {!showRejectForm ? (
            <>
              {canReject && (
                <button
                  type="button"
                  className={styles.rejectBtn}
                  onClick={() => setShowRejectForm(true)}
                  disabled={submitting}
                >
                  <FiXCircle size={16} />
                  REJECT REQUEST
                </button>
              )}

              <button
                type="button"
                className={styles.approveBtn}
                onClick={handleApprove}
                disabled={submitting}
              >
                <FiCheckCircle size={16} />
                {submitting ? 'Đang xử lý...' : 'APPROVE ENTRY'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => {
                  setShowRejectForm(false);
                  setRejectReason('');
                }}
                disabled={submitting}
              >
                Hủy
              </button>
              <button
                type="button"
                className={styles.rejectConfirmBtn}
                onClick={handleConfirmReject}
                disabled={!isReasonValid || submitting}
              >
                {submitting ? 'Đang xử lý...' : 'Xác nhận từ chối'}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
};

// ─── Sub-component: 1 dòng thông số ──────────────────────────────────────
interface SpecRowProps {
  label: string;
  value: string;
  warning?: boolean;
  warningText?: string;
}

const SpecRow = ({ label, value, warning, warningText }: SpecRowProps) => (
  <div className={styles.specRow}>
    <span className={styles.specLabel}>{label}</span>
    <span className={`${styles.specValue} ${warning ? styles.specValueWarning : ''}`}>
      {value}
      {warning && warningText && (
        <span className={styles.specWarningText}> — {warningText}</span>
      )}
    </span>
  </div>
);

export default ApprovalDetailPanel;
