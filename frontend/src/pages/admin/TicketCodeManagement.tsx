import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FiCopy,
  FiDownload,
  FiPlusCircle,
  FiRefreshCw,
} from 'react-icons/fi';

import {
  createTicketCodes,
  getTicketCodes,
  type CreateTicketCodesResult,
  type TicketCodeListItem,
  type TicketCodeStatus,
} from '../../services/ticketCodeService';

import styles from './TicketCodeManagement.module.scss';

const PAGE_SIZE = 20;

const statusLabels: Record<TicketCodeStatus, string> = {
  Active: 'Còn hiệu lực',
  Redeemed: 'Đã dùng',
  Expired: 'Hết hạn',
};

const badgeClass: Record<TicketCodeStatus, string> = {
  Active: styles.badgeActive,
  Redeemed: styles.badgeRedeemed,
  Expired: styles.badgeExpired,
};

const toLocalDateTimeValue = (date: Date) => {
  const offset = date.getTimezoneOffset();
  const local = new Date(
    date.getTime() - offset * 60_000
  );

  return local.toISOString().slice(0, 16);
};

const TicketCodeManagement = () => {
  const defaultExpiry = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return toLocalDateTimeValue(date);
  }, []);

  const [quantity, setQuantity] = useState(10);
  const [rewardAmount, setRewardAmount] =
    useState(200);

  const [expiresAt, setExpiresAt] =
    useState(defaultExpiry);

  const [result, setResult] =
    useState<CreateTicketCodesResult | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Danh sách mã đã tạo (xem lại từ DB).
  const [listItems, setListItems] = useState<TicketCodeListItem[]>([]);
  const [listTotal, setListTotal] = useState(0);
  const [listPage, setListPage] = useState(1);
  const [listStatus, setListStatus] =
    useState<TicketCodeStatus | ''>('');
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState('');

  const loadList = useCallback(
    async (page: number, status: TicketCodeStatus | '') => {
      setListLoading(true);
      setListError('');
      try {
        const data = await getTicketCodes({
          status,
          page,
          pageSize: PAGE_SIZE,
        });
        setListItems(data.items);
        setListTotal(data.total);
        setListPage(data.page);
      } catch (err) {
        setListError(
          err instanceof Error
            ? err.message
            : 'Không thể tải danh sách mã.'
        );
      } finally {
        setListLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    loadList(1, listStatus);
  }, [loadList, listStatus]);

  const totalPages = Math.max(
    1,
    Math.ceil(listTotal / PAGE_SIZE)
  );

  const validate = (): string | null => {
    if (
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      return 'Số lượng mã phải là số nguyên dương.';
    }

    if (quantity > 500) {
      return 'Mỗi lần chỉ nên tạo tối đa 500 mã.';
    }

    if (
      !Number.isFinite(rewardAmount) ||
      rewardAmount <= 0
    ) {
      return 'Giá trị thưởng phải lớn hơn 0.';
    }

    if (!expiresAt) {
      return 'Vui lòng chọn thời gian hết hạn.';
    }

    const expiryDate = new Date(expiresAt);

    if (
      Number.isNaN(expiryDate.getTime()) ||
      expiryDate <= new Date()
    ) {
      return 'Thời gian hết hạn phải nằm trong tương lai.';
    }

    return null;
  };

  const handleCreate = async () => {
    const validationError = validate();

    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const data = await createTicketCodes({
        quantity,
        rewardAmount,
        expiresAt: new Date(expiresAt).toISOString(),
      });

      setResult(data);
      setMessage(
        `Đã tạo thành công ${data.count} mã ticket.`
      );
      // Nạp lại danh sách để thấy mã vừa tạo.
      loadList(1, listStatus);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Không thể tạo mã ticket.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setQuantity(10);
    setRewardAmount(200);
    setExpiresAt(defaultExpiry);
    setResult(null);
    setError('');
    setMessage('');
  };

  const handleCopyAll = async () => {
    if (!result?.codes.length) {
      return;
    }

    await navigator.clipboard.writeText(
      result.codes.join('\n')
    );

    setMessage('Đã sao chép toàn bộ mã.');
  };

  const handleCopyOne = async (
    code: string
  ) => {
    await navigator.clipboard.writeText(code);
    setMessage(`Đã sao chép mã ${code}.`);
  };

  const handleExportCsv = () => {
    if (!result?.codes.length) {
      return;
    }

    const rows = [
      ['Code', 'Reward Amount', 'Expires At'],
      ...result.codes.map((code) => [
        code,
        String(result.rewardAmount),
        result.expiresAt,
      ]),
    ];

    const csv = rows
      .map((row) =>
        row
          .map((cell) =>
            `"${String(cell).replace(/"/g, '""')}"`
          )
          .join(',')
      )
      .join('\n');

    const blob = new Blob(
      ['\uFEFF', csv],
      { type: 'text/csv;charset=utf-8;' }
    );

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = `ticket-codes-${Date.now()}.csv`;
    anchor.click();

    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.heading}>
            Tạo mã Ticket
          </h1>

          <p className={styles.subtext}>
            Tạo hàng loạt mã thưởng và quản lý kết quả
            ngay sau khi sinh mã.
          </p>
        </div>

        <button
          type="button"
          className={styles.resetBtn}
          onClick={handleReset}
        >
          <FiRefreshCw size={16} />
          Làm mới
        </button>
      </div>

      <div className={styles.layout}>
        <section className={styles.formCard}>
          <div className={styles.cardHeader}>
            <div>
              <h2 className={styles.cardTitle}>
                Thông tin tạo mã
              </h2>

              <p className={styles.cardDesc}>
                Nhập số lượng, giá trị thưởng và hạn sử
                dụng.
              </p>
            </div>
          </div>

          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label className={styles.label}>
                Số lượng mã
              </label>

              <input
                type="number"
                min={1}
                max={500}
                className={styles.input}
                value={quantity}
                onChange={(event) =>
                  setQuantity(
                    Number(event.target.value)
                  )
                }
              />

              <span className={styles.hint}>
                Khuyến nghị 1–500 mã mỗi lần.
              </span>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>
                Giá trị thưởng
              </label>

              <input
                type="number"
                min={1}
                className={styles.input}
                value={rewardAmount}
                onChange={(event) =>
                  setRewardAmount(
                    Number(event.target.value)
                  )
                }
              />

              <span className={styles.hint}>
                Giá trị thưởng áp dụng cho từng mã.
              </span>
            </div>

            <div className={styles.fieldFull}>
              <label className={styles.label}>
                Thời gian hết hạn
              </label>

              <input
                type="datetime-local"
                className={styles.input}
                value={expiresAt}
                onChange={(event) =>
                  setExpiresAt(event.target.value)
                }
              />
            </div>
          </div>

          {error && (
            <div className={styles.errorBox}>
              {error}
            </div>
          )}

          {message && (
            <div className={styles.successBox}>
              {message}
            </div>
          )}

          <button
            type="button"
            className={styles.createBtn}
            onClick={handleCreate}
            disabled={loading}
          >
            <FiPlusCircle size={17} />

            {loading
              ? 'Đang tạo mã...'
              : 'Tạo mã Ticket'}
          </button>
        </section>

        <aside className={styles.previewCard}>
          <h2 className={styles.cardTitle}>
            Tóm tắt
          </h2>

          <div className={styles.summaryList}>
            <div className={styles.summaryRow}>
              <span>Số lượng</span>
              <strong>{quantity}</strong>
            </div>

            <div className={styles.summaryRow}>
              <span>Thưởng mỗi mã</span>
              <strong>{rewardAmount}</strong>
            </div>

            <div className={styles.summaryRow}>
              <span>Hết hạn</span>
              <strong>
                {expiresAt
                  ? new Date(
                      expiresAt
                    ).toLocaleString('vi-VN')
                  : '—'}
              </strong>
            </div>
          </div>

        </aside>
      </div>

      {result && (
        <section className={styles.resultCard}>
          <div className={styles.resultHeader}>
            <div>
              <h2 className={styles.cardTitle}>
                Danh sách mã đã tạo
              </h2>

              <p className={styles.cardDesc}>
                {result.count} mã · Thưởng{' '}
                {result.rewardAmount} · Hết hạn{' '}
                {new Date(
                  result.expiresAt
                ).toLocaleString('vi-VN')}
              </p>
            </div>

            <div className={styles.resultActions}>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={handleCopyAll}
              >
                <FiCopy size={16} />
                Sao chép tất cả
              </button>

              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={handleExportCsv}
              >
                <FiDownload size={16} />
                Xuất CSV
              </button>
            </div>
          </div>

          <div className={styles.codeGrid}>
            {result.codes.map((code, index) => (
              <div
                key={code}
                className={styles.codeItem}
              >
                <span className={styles.codeIndex}>
                  {index + 1}
                </span>

                <code className={styles.codeText}>
                  {code}
                </code>

                <button
                  type="button"
                  className={styles.copyBtn}
                  onClick={() =>
                    handleCopyOne(code)
                  }
                  aria-label={`Sao chép ${code}`}
                >
                  <FiCopy size={15} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className={styles.resultCard}>
        <div className={styles.resultHeader}>
          <div>
            <h2 className={styles.cardTitle}>
              Mã đã tạo
            </h2>

            <p className={styles.cardDesc}>
              {listTotal} mã · trang {listPage}/{totalPages}
            </p>
          </div>

          <div className={styles.filterRow}>
            <select
              className={styles.filterSelect}
              value={listStatus}
              onChange={(event) =>
                setListStatus(
                  event.target.value as TicketCodeStatus | ''
                )
              }
            >
              <option value="">Tất cả trạng thái</option>
              <option value="Active">Còn hiệu lực</option>
              <option value="Redeemed">Đã dùng</option>
              <option value="Expired">Hết hạn</option>
            </select>

            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => loadList(listPage, listStatus)}
              disabled={listLoading}
            >
              <FiRefreshCw size={15} />
              Tải lại
            </button>
          </div>
        </div>

        {listError && (
          <div className={styles.errorBox}>{listError}</div>
        )}

        {listLoading ? (
          <div className={styles.emptyState}>
            Đang tải danh sách mã...
          </div>
        ) : listItems.length === 0 ? (
          <div className={styles.emptyState}>
            Chưa có mã nào.
          </div>
        ) : (
          <>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Mã</th>
                    <th>Thưởng</th>
                    <th>Trạng thái</th>
                    <th>Hết hạn</th>
                    <th>Người dùng</th>
                    <th>Ngày dùng</th>
                    <th></th>
                  </tr>
                </thead>

                <tbody>
                  {listItems.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <code className={styles.codeText}>
                          {item.code}
                        </code>
                      </td>
                      <td>{item.pointAmount}</td>
                      <td>
                        <span
                          className={`${styles.badge} ${
                            badgeClass[item.status]
                          }`}
                        >
                          {statusLabels[item.status]}
                        </span>
                      </td>
                      <td>
                        {new Date(
                          item.expiresAt
                        ).toLocaleString('vi-VN')}
                      </td>
                      <td>
                        {item.redeemedBySpectatorName ?? '—'}
                      </td>
                      <td>
                        {item.redeemedAt
                          ? new Date(
                              item.redeemedAt
                            ).toLocaleString('vi-VN')
                          : '—'}
                      </td>
                      <td>
                        <button
                          type="button"
                          className={styles.copyBtn}
                          onClick={() =>
                            handleCopyOne(item.code)
                          }
                          aria-label={`Sao chép ${item.code}`}
                        >
                          <FiCopy size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={styles.pagination}>
              <button
                type="button"
                className={styles.pageBtn}
                onClick={() =>
                  loadList(listPage - 1, listStatus)
                }
                disabled={listLoading || listPage <= 1}
              >
                Trước
              </button>

              <span>
                {listPage}/{totalPages}
              </span>

              <button
                type="button"
                className={styles.pageBtn}
                onClick={() =>
                  loadList(listPage + 1, listStatus)
                }
                disabled={
                  listLoading || listPage >= totalPages
                }
              >
                Sau
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
};

export default TicketCodeManagement;