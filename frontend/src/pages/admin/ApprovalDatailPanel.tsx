import { useEffect, useState } from 'react';
import {
  FiCheckCircle,
  FiX,
  FiXCircle,
} from 'react-icons/fi';

import type { HorseApproval } from './ApprovalCenter';

import {
  approveHorse,
  getHorseDetail,
  rejectHorse,
  type HorseDetail,
} from '../../services/approvalService';

import styles from './ApprovalDetailPanel.module.scss';

interface Props {
  item: HorseApproval;
  onClose: () => void;
  onSuccess: (
    newStatus: 'Approved' | 'Rejected'
  ) => void;
}

interface SpecRowProps {
  label: string;
  value: string | number | null | undefined;
  warning?: boolean;
  warningText?: string;
}

const SpecRow = ({
  label,
  value,
  warning = false,
  warningText,
}: SpecRowProps) => {
  const displayValue =
    value === null ||
    value === undefined ||
    value === ''
      ? '—'
      : String(value);

  return (
    <div className={styles.specRow}>
      <span className={styles.specLabel}>
        {label}
      </span>

      <span
        className={`${styles.specValue} ${
          warning
            ? styles.specValueWarning
            : ''
        }`}
      >
        {displayValue}

        {warning && warningText && (
          <span
            className={
              styles.specWarningText
            }
          >
            {' '}
            — {warningText}
          </span>
        )}
      </span>
    </div>
  );
};

const ApprovalDetailPanel = ({
  item,
  onClose,
  onSuccess,
}: Props) => {
  const [
    horseDetail,
    setHorseDetail,
  ] =
    useState<HorseDetail | null>(null);

  const [
    horseDetailLoading,
    setHorseDetailLoading,
  ] = useState(true);

  const [
    showRejectForm,
    setShowRejectForm,
  ] = useState(false);

  const [
    rejectReason,
    setRejectReason,
  ] = useState('');

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState('');

  useEffect(() => {
    let cancelled = false;

    setHorseDetailLoading(true);
    setError('');

    getHorseDetail(item.horseId)
      .then((data) => {
        if (!cancelled) {
          setHorseDetail(data);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setHorseDetail(null);

          setError(
            err instanceof Error
              ? err.message
              : 'Không tải được chi tiết ngựa.'
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setHorseDetailLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [item.horseId]);

  const trimmedRejectReason =
    rejectReason.trim();

  const isReasonValid =
    trimmedRejectReason.length >= 10;

  const handleApprove = async () => {
    if (loading) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      await approveHorse(item.entityId);
      onSuccess('Approved');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Duyệt hồ sơ ngựa thất bại.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReject =
    async () => {
      if (
        !isReasonValid ||
        loading
      ) {
        return;
      }

      setLoading(true);
      setError('');

      try {
        await rejectHorse(
          item.entityId,
          trimmedRejectReason
        );

        onSuccess('Rejected');
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Từ chối hồ sơ ngựa thất bại.'
        );
      } finally {
        setLoading(false);
      }
    };

  const handleClose = () => {
    if (loading) {
      return;
    }

    onClose();
  };

  return (
    <>
      <div
        className={styles.overlay}
        onClick={handleClose}
      />

      <aside
        className={styles.drawer}
        aria-label="Chi tiết hồ sơ ngựa"
      >
        {/* Header */}

        <div
          className={
            styles.drawerHeader
          }
        >
          <div>
            <h2
              className={
                styles.drawerTitle
              }
            >
              {item.subject}
            </h2>

            <p
              style={{
                margin: '4px 0 0',
                color: '#888',
                fontSize: 12,
              }}
            >
              Hồ sơ ngựa ·{' '}
              {item.stable}
            </p>
          </div>

          <button
            type="button"
            className={styles.closeBtn}
            onClick={handleClose}
            disabled={loading}
            aria-label="Đóng"
          >
            <FiX size={20} />
          </button>
        </div>

        {/* Body */}

        <div
          className={styles.drawerBody}
        >
          <section
            className={styles.section}
          >
            <h3
              className={
                styles.sectionTitle
              }
            >
              Thông tin đăng ký
            </h3>

            <div
              className={styles.specGrid}
            >
              <SpecRow
                label="Tên ngựa"
                value={item.subject}
              />

              <SpecRow
                label="Tournament"
                value={item.stable}
              />

              <SpecRow
                label="Ngày nộp"
                value={
                  item.submittedDate
                }
              />

              <SpecRow
                label="Trạng thái duyệt"
                value={item.status}
              />
            </div>
          </section>

          <section
            className={styles.section}
          >
            <h3
              className={
                styles.sectionTitle
              }
            >
              Thông tin chi tiết ngựa
            </h3>

            {horseDetailLoading ? (
              <p
                style={{
                  fontSize: 13,
                  color: '#999',
                }}
              >
                Đang tải chi tiết ngựa...
              </p>
            ) : !horseDetail ? (
              <p
                style={{
                  fontSize: 13,
                  color: '#999',
                }}
              >
                Không tải được chi tiết
                ngựa.
              </p>
            ) : (
              <div
                className={
                  styles.specGrid
                }
              >
                <SpecRow
                  label="Horse ID"
                  value={
                    horseDetail.horseId
                  }
                />

                <SpecRow
                  label="Owner ID"
                  value={
                    horseDetail.ownerId
                  }
                />

                <SpecRow
                  label="Breed"
                  value={horseDetail.breed}
                />

                <SpecRow
                  label="Gender"
                  value={
                    horseDetail.gender
                  }
                />

                <SpecRow
                  label="Color"
                  value={
                    horseDetail.color
                  }
                />

                <SpecRow
                  label="Birth Year"
                  value={
                    horseDetail.birthYear
                  }
                />

                <SpecRow
                  label="Age"
                  value={horseDetail.age}
                />

                <SpecRow
                  label="Weight"
                  value={
                    horseDetail.weight
                      ? `${horseDetail.weight} kg`
                      : '—'
                  }
                />

                <SpecRow
                  label="Pedigree"
                  value={
                    horseDetail.pedigree
                  }
                />

                <SpecRow
                  label="Identifying Marks"
                  value={
                    horseDetail.identifyingMarks
                  }
                />

                <SpecRow
                  label="Vaccination Record"
                  value={
                    horseDetail.vaccinationRecordRef
                  }
                />

                <SpecRow
                  label="Doping Test Date"
                  value={
                    horseDetail.dopingTestDate
                  }
                />

                <SpecRow
                  label="Doping Test Result"
                  value={
                    horseDetail.dopingTestResult
                  }
                  warning={
                    horseDetail.dopingTestResult ===
                    'Failed'
                  }
                  warningText="Kết quả kiểm tra doping không đạt"
                />

                <SpecRow
                  label="Legal Consent"
                  value={
                    horseDetail.legalConsentAccepted
                      ? 'Accepted'
                      : 'Not accepted'
                  }
                  warning={
                    !horseDetail.legalConsentAccepted
                  }
                  warningText="Chưa chấp nhận cam kết pháp lý"
                />

                <SpecRow
                  label="Screening Status"
                  value={
                    horseDetail.screeningStatus
                  }
                />

                <SpecRow
                  label="Screening Reason"
                  value={
                    horseDetail.screeningReason
                  }
                />

                <SpecRow
                  label="Admin Approval"
                  value={
                    horseDetail.adminApprovalStatus
                  }
                />

                <SpecRow
                  label="Rejection Reason"
                  value={
                    horseDetail.rejectionReason
                  }
                />
              </div>
            )}
          </section>

          {error && (
            <div
              className={styles.errorBox}
            >
              {error}
            </div>
          )}

          {showRejectForm && (
            <section
              className={styles.section}
            >
              <h3
                className={
                  styles.sectionTitle
                }
              >
                Lý do từ chối
              </h3>

              <textarea
                className={
                  styles.rejectTextarea
                }
                rows={4}
                placeholder="Nhập lý do từ chối, tối thiểu 10 ký tự..."
                value={rejectReason}
                onChange={(event) =>
                  setRejectReason(
                    event.target.value
                  )
                }
              />

              {rejectReason.length > 0 &&
                !isReasonValid && (
                  <span
                    className={
                      styles.rejectError
                    }
                  >
                    Lý do phải có ít nhất
                    10 ký tự. Hiện tại:{' '}
                    {
                      trimmedRejectReason.length
                    }
                    .
                  </span>
                )}
            </section>
          )}
        </div>

        {/* Footer actions */}

        <div
          className={styles.drawerFooter}
        >
          {!showRejectForm ? (
            <>
              <button
                type="button"
                className={
                  styles.rejectBtn
                }
                onClick={() => {
                  setShowRejectForm(true);
                  setRejectReason('');
                  setError('');
                }}
                disabled={loading}
              >
                <FiXCircle size={16} />

                REJECT REQUEST
              </button>

              <button
                type="button"
                className={
                  styles.approveBtn
                }
                onClick={handleApprove}
                disabled={loading}
              >
                <FiCheckCircle
                  size={16}
                />

                {loading
                  ? 'Đang xử lý...'
                  : 'APPROVE ENTRY'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className={
                  styles.cancelBtn
                }
                onClick={() => {
                  setShowRejectForm(
                    false
                  );

                  setRejectReason('');
                  setError('');
                }}
                disabled={loading}
              >
                Hủy
              </button>

              <button
                type="button"
                className={
                  styles.rejectConfirmBtn
                }
                onClick={
                  handleConfirmReject
                }
                disabled={
                  !isReasonValid ||
                  loading
                }
              >
                {loading
                  ? 'Đang xử lý...'
                  : 'Xác nhận từ chối'}
              </button>
            </>
          )}
        </div>
      </aside>
    </>
  );
};

export default ApprovalDetailPanel;