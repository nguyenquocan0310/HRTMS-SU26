import { useState } from 'react';
import { FiX, FiClock, FiFileText, FiCheckCircle, FiXCircle } from 'react-icons/fi';
import type { ApprovalItem } from './ApprovalCenter';
import styles from './ApprovalDetailPanel.module.scss';

interface VerificationLogEntry {
  id: string;
  label: string;
  time: string;
}

interface Props {
  item: ApprovalItem;
  onClose: () => void;
}

// TODO: thay bằng API thật khi có Swagger — GET /api/admin/approvals/:id/logs
const MOCK_LOGS: VerificationLogEntry[] = [
  { id: 'l1', label: 'Hồ sơ được nộp', time: '18/06/2026 — 09:14' },
  { id: 'l2', label: 'Hệ thống xác minh dữ liệu tự động', time: '18/06/2026 — 09:15' },
  { id: 'l3', label: 'Đang chờ Admin xem xét', time: '18/06/2026 — 09:15' },
];

// TODO: thay bằng API thật — GET /api/admin/approvals/:id/evidence
const MOCK_EVIDENCE = [
  { id: 'e1', label: 'Giấy chứng nhận' },
  { id: 'e2', label: 'Ảnh hồ sơ' },
];

const ApprovalDetailPanel = ({ item, onClose }: Props) => {
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const isReasonValid = rejectReason.trim().length >= 10;

  // ─── Ràng buộc nghiệp vụ: chỉ áp dụng cho tab Ngựa ────────────────────────
  const isHorse = item.type === 'horse';
  const entryFeeUnpaid = isHorse && item.entryFeeStatus !== 'Paid';

  const handleApprove = () => {
    // TODO: gọi API thật khi có Swagger — POST /api/admin/approvals/:id/approve
    console.log('[ApprovalDetailPanel] Approve', item.id);
    onClose();
  };

  const handleConfirmReject = () => {
    if (!isReasonValid) return;
    // TODO: gọi API thật khi có Swagger — POST /api/admin/approvals/:id/reject { reason }
    console.log('[ApprovalDetailPanel] Reject', item.id, rejectReason);
    onClose();
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
                <SpecRow
                  label="Breed"
                  value={item.breed}
                  warning={item.breed !== item.allowedBreed}
                  warningText={`Không khớp Allowed Breed (${item.allowedBreed})`}
                />
                <SpecRow label="Allowed Breed (Tournament)" value={item.allowedBreed} />
                <SpecRow
                  label="Doping Test Result"
                  value={item.dopingTestResult}
                  warning={item.dopingTestResult === 'Failed'}
                  warningText="Doping test thất bại"
                />
                <SpecRow label="Vaccination Record Ref" value={item.vaccinationRecordRef} />
                <SpecRow
                  label="Entry Fee Status"
                  value={item.entryFeeStatus}
                  warning={entryFeeUnpaid}
                  warningText="Chưa thanh toán phí tham dự"
                />
              </div>
            )}

            {item.type === 'jockey' && (
              <div className={styles.specGrid}>
                <SpecRow label="License Certificate" value={item.licenseCertificate} />
                <SpecRow label="Experience Years" value={`${item.experienceYears} năm`} />
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

          {/* ═══ VERIFICATION LOGS (timeline) ═══════════════════ */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Verification Logs</h3>
            <div className={styles.timeline}>
              {MOCK_LOGS.map((log) => (
                <div key={log.id} className={styles.timelineItem}>
                  <div className={styles.timelineDot}>
                    <FiClock size={12} />
                  </div>
                  <div className={styles.timelineContent}>
                    <span className={styles.timelineLabel}>{log.label}</span>
                    <span className={styles.timelineTime}>{log.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ═══ ATTACHED EVIDENCE ═══════════════════════════════ */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Attached Evidence</h3>
            <div className={styles.evidenceGrid}>
              {MOCK_EVIDENCE.map((ev) => (
                <div key={ev.id} className={styles.evidenceThumb}>
                  <FiFileText size={22} />
                  <span>{ev.label}</span>
                </div>
              ))}
            </div>
          </section>

          {/* ═══ REJECT FORM (hiện khi bấm Reject) ══════════════ */}
          {showRejectForm && (
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
        </div>

        {/* ═══ FOOTER ACTIONS ══════════════════════════════════ */}
        <div className={styles.drawerFooter}>
          {!showRejectForm ? (
            <>
              <button
                type="button"
                className={styles.rejectBtn}
                onClick={() => setShowRejectForm(true)}
              >
                <FiXCircle size={16} />
                REJECT REQUEST
              </button>

              <button
                type="button"
                className={styles.approveBtn}
                onClick={handleApprove}
                disabled={entryFeeUnpaid}
                title={entryFeeUnpaid ? 'Không thể duyệt khi chưa thanh toán phí tham dự (Entry Fee).' : undefined}
              >
                <FiCheckCircle size={16} />
                APPROVE ENTRY
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
              >
                Hủy
              </button>
              <button
                type="button"
                className={styles.rejectConfirmBtn}
                onClick={handleConfirmReject}
                disabled={!isReasonValid}
              >
                Xác nhận từ chối
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