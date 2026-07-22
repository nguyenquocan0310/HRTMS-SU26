import { useEffect, useMemo, useState } from 'react';
import { FiEdit2, FiMapPin, FiPlus, FiRefreshCw, FiX } from 'react-icons/fi';
import { adminError, adminLabel } from '../../utils/adminLabels';
import { createVenue, getAdminVenues, getVenue, updateVenue, type TrackType, type Venue, type VenueFilters } from '../../services/venueService';
import styles from './Venues.module.scss';

type FormState = { name: string; city: string; address: string; trackType: TrackType; trackLengthMeters: string; laneCount: string; isActive: boolean };
const emptyForm = (): FormState => ({ name: '', city: '', address: '', trackType: 'Dirt', trackLengthMeters: '', laneCount: '', isActive: true });

const Venues = () => {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [filters, setFilters] = useState<VenueFilters>({});
  const [form, setForm] = useState<FormState>(emptyForm());
  const [editing, setEditing] = useState<Venue | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const cities = useMemo(() => [...new Set(venues.map((venue) => venue.city).filter(Boolean) as string[])].sort(), [venues]);
  const load = async () => {
    setLoading(true); setError('');
    try { setVenues(await getAdminVenues(filters)); }
    catch (err) { setError(adminError(err, 'Không tải được danh sách trường đua.')); }
    finally { setLoading(false); }
  };
  useEffect(() => { const timer = window.setTimeout(() => void load(), 250); return () => window.clearTimeout(timer); }, [filters.search, filters.city, filters.trackType, filters.isActive]);

  const resetForm = () => { setEditing(null); setForm(emptyForm()); setError(''); };
  const fillForm = (venue: Venue) => {
    setEditing(venue);
    setForm({ name: venue.name, city: venue.city ?? '', address: venue.address ?? '', trackType: venue.trackType, trackLengthMeters: String(venue.trackLengthMeters), laneCount: String(venue.laneCount), isActive: venue.isActive });
  };
  const beginEdit = async (venue: Venue) => {
    setError('');
    try { fillForm(await getVenue(venue.venueId)); }
    catch (err) { setError(adminError(err, 'Không tải được chi tiết trường đua.')); return; }
    document.getElementById('venue-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setNotice(''); setError('');
    const length = Number(form.trackLengthMeters); const lanes = Number(form.laneCount);
    if (!form.name.trim() || !form.city.trim() || !form.address.trim() || !Number.isFinite(length) || length <= 0 || !Number.isInteger(lanes) || lanes < 2 || lanes > 24) {
      setError('Vui lòng nhập đầy đủ thông tin; chiều dài phải lớn hơn 0 và số làn từ 2 đến 24.'); return;
    }
    if (editing?.isActive && !form.isActive && !window.confirm(`Tạm ngừng hoạt động trường đua “${editing.name}”? Các giải đã tham chiếu vẫn được giữ nguyên lịch sử.`)) return;
    setSaving(true);
    const payload = { name: form.name.trim(), city: form.city.trim(), address: form.address.trim(), trackType: form.trackType, trackLengthMeters: length, laneCount: lanes, isActive: form.isActive };
    try {
      if (editing) { await updateVenue(editing.venueId, payload); setNotice('Đã cập nhật trường đua.'); }
      else { await createVenue(payload); setNotice('Đã tạo trường đua mới.'); }
      resetForm(); await load();
    } catch (err) { setError(adminError(err, 'Không thể lưu trường đua.')); }
    finally { setSaving(false); }
  };

  return <div className={styles.page}>
    <header className={styles.header}><div><h1>Quản lý trường đua</h1><p>Tạo, chỉnh sửa và bật/tắt hoạt động trường đua.</p></div><button className={styles.primary} onClick={() => document.getElementById('venue-form')?.scrollIntoView({ behavior: 'smooth' })}><FiPlus /> Tạo trường đua</button></header>
    {notice && <div className={styles.notice}>{notice}</div>}
    {error && <div className={styles.error}>{error}</div>}

    <section className={styles.card} aria-label="Bộ lọc trường đua"><div className={styles.filters}>
      <label>Tìm theo tên<input value={filters.search ?? ''} onChange={(e) => setFilters((value) => ({ ...value, search: e.target.value || undefined }))} placeholder="Nhập tên trường đua" /></label>
      <label>Tỉnh/Thành phố<select value={filters.city ?? ''} onChange={(e) => setFilters((value) => ({ ...value, city: e.target.value || undefined }))}><option value="">Tất cả</option>{cities.map((city) => <option key={city} value={city}>{city}</option>)}</select></label>
      <label>Loại mặt sân<select value={filters.trackType ?? ''} onChange={(e) => setFilters((value) => ({ ...value, trackType: (e.target.value || undefined) as TrackType | undefined }))}><option value="">Tất cả</option><option value="Dirt">Đường đất</option><option value="Turf">Đường cỏ</option><option value="Synthetic">Mặt sân tổng hợp</option></select></label>
      <label>Trạng thái<select value={filters.isActive === undefined ? '' : String(filters.isActive)} onChange={(e) => setFilters((value) => ({ ...value, isActive: e.target.value === '' ? undefined : e.target.value === 'true' }))}><option value="">Tất cả</option><option value="true">Đang hoạt động</option><option value="false">Tạm ngừng</option></select></label>
    </div></section>

    <section className={styles.card}><div className={styles.tableWrap}><table><thead><tr><th>Trường đua</th><th>Địa chỉ</th><th>Loại mặt sân</th><th>Chiều dài</th><th>Số làn xuất phát</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>
      {loading ? <tr><td colSpan={7} className={styles.empty}>Đang tải danh sách trường đua…</td></tr> : venues.length === 0 ? <tr><td colSpan={7} className={styles.empty}>Chưa có trường đua phù hợp.</td></tr> : venues.map((venue) => <tr key={venue.venueId}><td><strong>{venue.name}</strong><span className={styles.city}><FiMapPin /> {venue.city ?? 'Chưa cập nhật'}</span></td><td>{venue.address ?? '—'}</td><td>{adminLabel(venue.trackType)}</td><td>{venue.trackLengthMeters.toLocaleString('vi-VN')} m</td><td>{venue.laneCount}</td><td><span className={venue.isActive ? styles.active : styles.inactive}>{venue.isActive ? 'Đang hoạt động' : 'Tạm ngừng hoạt động'}</span></td><td><button className={styles.edit} onClick={() => void beginEdit(venue)}><FiEdit2 /> Chỉnh sửa</button></td></tr>)}
    </tbody></table></div></section>

    <section id="venue-form" className={styles.card}><div className={styles.formHead}><div><h2>{editing ? `Chỉnh sửa: ${editing.name}` : 'Tạo trường đua mới'}</h2><p>Không xóa cứng trường đua; hãy tạm ngừng khi không còn sử dụng.</p></div>{editing && <button className={styles.textButton} onClick={resetForm}><FiX /> Đóng chỉnh sửa</button>}</div>
      <form className={styles.form} onSubmit={save}>
        <label>Tên trường đua<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label><label>Tỉnh/Thành phố<input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required /></label>
        <label className={styles.full}>Địa chỉ<input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required /></label>
        <label>Loại mặt sân<select value={form.trackType} onChange={(e) => setForm({ ...form, trackType: e.target.value as TrackType })}><option value="Dirt">Đường đất</option><option value="Turf">Đường cỏ</option><option value="Synthetic">Mặt sân tổng hợp</option></select></label>
        <label>Chiều dài đường đua (m)<input type="number" min="1" value={form.trackLengthMeters} onChange={(e) => setForm({ ...form, trackLengthMeters: e.target.value })} required /></label>
        <label>Số làn xuất phát<input type="number" min="2" max="24" value={form.laneCount} onChange={(e) => setForm({ ...form, laneCount: e.target.value })} required /></label>
        <label className={styles.checkbox}><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Đang hoạt động</label>
        <div className={styles.actions}><button type="button" className={styles.secondary} onClick={resetForm}><FiRefreshCw /> Làm mới</button><button type="submit" className={styles.primary} disabled={saving}>{saving ? 'Đang lưu…' : editing ? 'Lưu cập nhật' : 'Tạo trường đua'}</button></div>
      </form>
    </section>
  </div>;
};
export default Venues;
