import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { FiEdit2, FiMapPin, FiPlus, FiRefreshCw } from 'react-icons/fi';
import {
  createVenue,
  getAdminVenues,
  updateVenue,
  type Venue,
  type VenueAdminFilters,
  type VenuePayload,
} from '../../services/venueService';

const TRACK_LABEL: Record<VenuePayload['trackType'], string> = {
  Dirt: 'Đường đất',
  Turf: 'Đường cỏ',
  Synthetic: 'Đường tổng hợp',
};

const emptyForm = (): VenuePayload => ({
  name: '', address: '', city: '', trackType: 'Dirt', trackLengthMeters: 1200,
  laneCount: 2, isActive: true,
});

const VenueManagement = () => {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [filters, setFilters] = useState<VenueAdminFilters>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState<VenuePayload>(emptyForm);
  const [editing, setEditing] = useState<Venue | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (nextFilters = filters) => {
    setLoading(true);
    setError('');
    try {
      setVenues(await getAdminVenues(nextFilters));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không tải được danh sách trường đua.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { void load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setError('');
    setNotice('');
  };

  const openEdit = (venue: Venue) => {
    setEditing(venue);
    setForm({
      name: venue.name, address: venue.address ?? '', city: venue.city ?? '',
      trackType: venue.trackType as VenuePayload['trackType'],
      trackLengthMeters: venue.trackLengthMeters, laneCount: venue.laneCount,
      isActive: venue.isActive,
    });
    setError('');
    setNotice('');
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const payload = { ...form, name: form.name.trim(), address: form.address?.trim(), city: form.city?.trim() };
    if (!payload.name || payload.laneCount < 2 || payload.laneCount > 24 || payload.trackLengthMeters <= 0) {
      setError('Kiểm tra tên trường đua, chiều dài đường đua và số làn xuất phát (2–24).');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await updateVenue(editing.venueId, payload);
        setNotice('Đã cập nhật trường đua.');
      } else {
        await createVenue(payload);
        setNotice('Đã tạo trường đua.');
      }
      openCreate();
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể lưu trường đua.');
    } finally {
      setSaving(false);
    }
  };

  const changeFilter = <K extends keyof VenueAdminFilters>(key: K, value: VenueAdminFilters[K]) => {
    const next = { ...filters, [key]: value };
    setFilters(next);
    void load(next);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-slate-900">Quản lý trường đua</h1><p className="mt-1 text-sm text-slate-600">Tạo, chỉnh sửa và bật/tắt hoạt động trường đua.</p></div>
        <button type="button" onClick={openCreate} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"><FiPlus /> Tạo trường đua</button>
      </header>

      <section className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-4">
        <input value={filters.search ?? ''} onChange={(e) => changeFilter('search', e.target.value)} placeholder="Tìm theo tên" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input value={filters.city ?? ''} onChange={(e) => changeFilter('city', e.target.value)} placeholder="Tỉnh/Thành phố" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <select value={filters.trackType ?? ''} onChange={(e) => changeFilter('trackType', (e.target.value || undefined) as VenueAdminFilters['trackType'])} className="rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="">Tất cả loại mặt sân</option>{Object.entries(TRACK_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <select value={filters.isActive === undefined ? '' : String(filters.isActive)} onChange={(e) => changeFilter('isActive', e.target.value === '' ? undefined : e.target.value === 'true')} className="rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="">Tất cả trạng thái</option><option value="true">Đang hoạt động</option><option value="false">Tạm ngừng hoạt động</option></select>
      </section>

      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {notice && <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}

      <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        {loading ? <p className="p-8 text-center text-sm text-slate-500">Đang tải trường đua...</p> : venues.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">Không có trường đua phù hợp.</p> : <table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="p-3">Trường đua</th><th className="p-3">Địa chỉ</th><th className="p-3">Loại mặt sân</th><th className="p-3">Chiều dài</th><th className="p-3">Số làn xuất phát</th><th className="p-3">Trạng thái</th><th className="p-3" /></tr></thead><tbody>{venues.map((venue) => <tr key={venue.venueId} className="border-t border-slate-100"><td className="p-3 font-semibold text-slate-900">{venue.name}<span className="mt-1 flex items-center gap-1 font-normal text-slate-500"><FiMapPin size={13} />{venue.city || 'Chưa cập nhật'}</span></td><td className="p-3 text-slate-600">{venue.address || '—'}</td><td className="p-3">{TRACK_LABEL[venue.trackType as VenuePayload['trackType']] ?? venue.trackType}</td><td className="p-3">{venue.trackLengthMeters.toLocaleString('vi-VN')} m</td><td className="p-3">{venue.laneCount}</td><td className="p-3"><span className={venue.isActive ? 'rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700' : 'rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600'}>{venue.isActive ? 'Đang hoạt động' : 'Tạm ngừng hoạt động'}</span></td><td className="p-3"><button type="button" onClick={() => openEdit(venue)} className="inline-flex items-center gap-1 text-blue-700 hover:underline"><FiEdit2 /> Chỉnh sửa</button></td></tr>)}</tbody></table>}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="mb-4 text-lg font-bold text-slate-900">{editing ? `Chỉnh sửa: ${editing.name}` : 'Tạo trường đua mới'}</h2><form onSubmit={submit} className="grid gap-4 md:grid-cols-2"><label className="text-sm font-medium text-slate-700">Tên trường đua<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label><label className="text-sm font-medium text-slate-700">Tỉnh/Thành phố<input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label><label className="text-sm font-medium text-slate-700 md:col-span-2">Địa chỉ<input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label><label className="text-sm font-medium text-slate-700">Loại mặt sân<select value={form.trackType} onChange={(e) => setForm({ ...form, trackType: e.target.value as VenuePayload['trackType'] })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2">{Object.entries(TRACK_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="text-sm font-medium text-slate-700">Chiều dài đường đua (m)<input required min={1} type="number" value={form.trackLengthMeters} onChange={(e) => setForm({ ...form, trackLengthMeters: Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label><label className="text-sm font-medium text-slate-700">Số làn xuất phát<input required min={2} max={24} type="number" value={form.laneCount} onChange={(e) => setForm({ ...form, laneCount: Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label><label className="flex items-center gap-2 self-end text-sm font-medium text-slate-700"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Đang hoạt động</label><div className="flex gap-3 md:col-span-2"><button disabled={saving} type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Tạo trường đua'}</button><button type="button" onClick={() => { openCreate(); void load(); }} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"><FiRefreshCw /> Làm mới</button></div></form></section>
    </div>
  );
};

export default VenueManagement;
