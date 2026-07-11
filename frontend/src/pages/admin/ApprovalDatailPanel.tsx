import { useEffect, useState } from 'react';
import { FiX, FiClock, FiFileText, FiCheckCircle, FiXCircle } from 'react-icons/fi';
import type { ApprovalItem } from './ApprovalCenter';
import {
  approveHorse, rejectHorse, getHorseDetail, type HorseDetail,
  approveJockey, approveReferee, approveDoctor,
} from '../../services/approvalService';
import { apiFetch } from '../../services/apiClient';
import styles from './ApprovalDetailPanel.module.scss';

interface VerificationLogEntry { id: string; label: string; time: string; }

interface Props {
  item: ApprovalItem;
  onClose: () => void;
  onSuccess: (newStatus: 'Approved' | 'Rejected') => void;
}

const MOCK_LOGS: VerificationLogEntry[] = [
  { id: 'l1', label: 'Hồ sơ được nộp', time: '—' },
  { id: 'l2', label: 'Hệ thống xác minh dữ liệu tự động', time: '—' },
  { id: 'l3', label: 'Đang chờ Admin xem xét', time: '—' },
];

const MOCK_EVIDENCE = [
  { id: 'e1', label: 'Giấy chứng nhận' },
  { id: 'e2', label: 'Ảnh hồ sơ' },
];

const ApprovalDetailPanel = ({ item, onClose, onSuccess }: Props) => {
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Chi tiết ngựa (breed/vaccination/doping) không có sẵn trong list pending,
  // phải gọi riêng theo horseId khi mở panel.
  const [horseDetail, setHorseDetail] = useState<HorseDetail | null>(null);
  const [horseDetailLoading, setHorseDetailLoading] = useState(false);

  useEffect(() => {
    if (item.type !== 'horse') return;
    setHorseDetailLoading(true);
    getHorseDetail(item.horseId)
      .then(setHorseDetail)
      .catch(() => setHorseDetail(null))
      .finally(() => setHorseDetailLoading(false));
  }, [item]);

  const isReasonValid = rejectReason.trim().length >= 10;
  const isHorse = item.type === 'horse';
  const entryFeeUnpaid = isHorse && item.entryFeeStatus !== 'Paid';

  const handleApprove = async () => {
    setLoading(true);
    setError('');
    try {
      if (item.type === 'horse') {
        // PATCH /api/admin/horse-entries/{enrollmentId}/approve
        await approveHorse(item.entityId);
      } else if (item.type === 'jockey') {
        // PATCH /api/admin/jockeys/{id}/approve
        await approveJockey(item.entityId);
      } else if (item.type === 'onboarding') {
        if (item.role === 'Referee') {
          // PATCH /api/admin/referees/{id}/approve
          await approveReferee(item.entityId);
        } else {
          // PATCH /api/admin/doctors/{id}/approve
          await approveDoctor(item.entityId);
        }
      }
      onSuccess('Approved');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Approve thất bại.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReject = async () => {
    if (!isReasonValid) return;
    setLoading(true);
    setError('');
    try {
      if (item.type === 'horse') {
        // PATCH /api/admin/horse-entries/{enrollmentId}/reject
        await rejectHorse(item.entityId, rejectReason.trim());
      } else {
        // Personnel reject — dùng chung endpoint nếu BE có, tạm dùng approvalService pattern
        await apiFetch(`/admin/users/${item.entityId}/reject`, {
          method: 'PATCH',
          body: JSON.stringify({ reason: rejectReason.trim() }),
        });
      }
      onSuccess('Rejected');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reject thất bại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.drawer}>
        {/* HEADER */}
        <div className={styles.drawerHeader}>
          <h2 className={styles.drawerTitle}>{item.subject}</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Đóng">
            <FiX size={20} />
          </button>
        </div>

        <div className={styles.drawerBody}>
          {/* CORE SPECIFICATIONS */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Core Specifications</h3>

            {item.type === 'horse' && (
              <div className={styles.specGrid}>
                {horseDetailLoading ? (
                  <p style={{ fontSize: 13, color: '#999' }}>Đang tải chi tiết ngựa...</p>
                ) : !horseDetail ? (
                  <p style={{ fontSize: 13, color: '#999' }}>Không tải được chi tiết ngựa.</p>
                ) : (
                  <>
                    <SpecRow label="Breed" value={horseDetail.breed} />
                    <SpecRow label="Gender" value={horseDetail.gender} />
                    <SpecRow label="Color" value={horseDetail.color} />
                    <SpecRow label="Birth Year" value={String(horseDetail.birthYear)} />
                    <SpecRow label="Weight" value={`${horseDetail.weight} kg`} />
                    <SpecRow label="Pedigree" value={horseDetail.pedigree} />
                    <SpecRow
                      label="Doping Test Result"
                      value={horseDetail.dopingTestResult}
                      warning={horseDetail.dopingTestResult === 'Failed'}
                      warningText="Doping test thất bại"
                    />
                    <SpecRow label="Vaccination Record Ref" value={horseDetail.vaccinationRecordRef} />
                    <SpecRow
                      label="Entry Fee Status"
                      value={item.entryFeeStatus}
                      warning={entryFeeUnpaid}
                      warningText="Chưa thanh toán phí tham dự"
                    />
                  </>
                )}
              </div>
            )}

            {item.type === 'jockey' && (
              <div className={styles.specGrid}>
                <SpecRow label="License Certificate" value={item.licenseCertificate} />
                <SpecRow label="Experience Years" value={`${item.experienceYears ?? '—'} năm`} />
              </div>
            )}
            {item.type === 'onboarding' && (
              <div className={styles.specGrid}>
                <SpecRow label="Role" value={item.role} />
                {item.role === 'Referee' && <SpecRow label="Certification Level" value={item.certificationLevel ?? '—'} />}
                {item.role === 'Doctor' && <SpecRow label="Medical License Number" value={item.medicalLicenseNumber ?? '—'} />}
              </div>
            )}
          </section>

          {/* VERIFICATION LOGS */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Verification Logs</h3>
            <div className={styles.timeline}>
              {MOCK_LOGS.map((log) => (
                <div key={log.id} className={styles.timelineItem}>
                  <div className={styles.timelineDot}><FiClock size={12} /></div>
                  <div className={styles.timelineContent}>
                    <span className={styles.timelineLabel}>{log.label}</span>
                    <span className={styles.timelineTime}>{log.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ATTACHED EVIDENCE */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Attached Evidence</h3>
            <div className={styles.evidenceGrid}>
              {MOCK_EVIDENCE.map((ev) => (
                <div key={ev.id} className={styles.evidenceThumb}>
                  <FiFileText size={22} /><span>{ev.label}</span>
                </div>
              ))}
            </div>
          </section>

          {/* ERROR */}
          {error && <div className={styles.errorBox}>{error}</div>}

          {/* REJECT FORM */}
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

        {/* FOOTER ACTIONS */}
        <div className={styles.drawerFooter}>
          {!showRejectForm ? (
            <>
              <button type="button" className={styles.rejectBtn}
                onClick={() => setShowRejectForm(true)} disabled={loading}>
                <FiXCircle size={16} /> REJECT REQUEST
              </button>
              <button type="button" className={styles.approveBtn}
                onClick={handleApprove}
                disabled={loading || entryFeeUnpaid}
                title={entryFeeUnpaid ? 'Chưa thanh toán phí tham dự.' : undefined}>
                <FiCheckCircle size={16} />
                {loading ? 'Đang xử lý...' : 'APPROVE ENTRY'}
              </button>
            </>
          ) : (
            <>
              <button type="button" className={styles.cancelBtn}
                onClick={() => { setShowRejectForm(false); setRejectReason(''); }} disabled={loading}>
                Hủy
              </button>
              <button type="button" className={styles.rejectConfirmBtn}
                onClick={handleConfirmReject} disabled={!isReasonValid || loading}>
                {loading ? 'Đang xử lý...' : 'Xác nhận từ chối'}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
};

interface SpecRowProps { label: string; value: string; warning?: boolean; warningText?: string; }
const SpecRow = ({ label, value, warning, warningText }: SpecRowProps) => (
  <div className={styles.specRow}>
    <span className={styles.specLabel}>{label}</span>
    <span className={`${styles.specValue} ${warning ? styles.specValueWarning : ''}`}>
      {value}
      {warning && warningText && <span className={styles.specWarningText}> — {warningText}</span>}
    </span>
  </div>
);

export default ApprovalDetailPanel;