/* eslint-disable react-hooks/set-state-in-effect -- Initial profile data comes from the authenticated API. */
import { useEffect, useState } from 'react';
import { FiCheckCircle, FiMail, FiShield, FiUser } from 'react-icons/fi';
import { changeMyPassword, getMyAccountProfile, updateMyBasicInfo } from '../../services/accountService';
import type { UserProfile } from '../../types/account.types';
import styles from './MyAccount.module.scss';

type Profile = UserProfile<Record<string, unknown>>;

const MyAccount = () => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState(''); const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState(''); const [newPassword, setNewPassword] = useState(''); const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(true); const [savingProfile, setSavingProfile] = useState(false); const [savingPassword, setSavingPassword] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState('');

  const loadProfile = async () => { setLoading(true); try { const data = await getMyAccountProfile<Record<string, unknown>>(); setProfile(data); setFullName(data.fullName); setEmail(data.email); } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Không tải được thông tin tài khoản.'); } finally { setLoading(false); } };
  useEffect(() => { void loadProfile(); }, []);

  const handleProfileSubmit = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setMessage('');
    if (!fullName.trim()) return setError('Vui lòng nhập họ và tên.');
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Email không đúng định dạng.');
    setSavingProfile(true);
    try { await updateMyBasicInfo({ fullName: fullName.trim(), email: email.trim() }); setProfile((previous) => previous ? { ...previous, fullName: fullName.trim(), email: email.trim() } : previous); setMessage('Đã cập nhật thông tin cá nhân.'); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Không thể cập nhật thông tin cá nhân.'); }
    finally { setSavingProfile(false); }
  };

  const handlePasswordSubmit = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setMessage('');
    if (!currentPassword || !newPassword || !confirmPassword) return setError('Vui lòng nhập đầy đủ thông tin đổi mật khẩu.');
    if (newPassword.length < 6) return setError('Mật khẩu mới phải có ít nhất 6 ký tự.');
    if (newPassword !== confirmPassword) return setError('Xác nhận mật khẩu mới chưa khớp.');
    setSavingPassword(true);
    try { await changeMyPassword({ currentPassword, newPassword }); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setMessage('Đã đổi mật khẩu thành công. Phiên đăng nhập hiện tại vẫn được giữ theo cơ chế của hệ thống.'); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Không thể đổi mật khẩu.'); }
    finally { setSavingPassword(false); }
  };

  return <div className={styles.container}><div className={styles.pageHeader}><h1 className={styles.heading}>Tài khoản của tôi</h1></div>{error && <div className={styles.error} role="alert">{error}</div>}{message && <div className={styles.success}>{message}</div>}{loading ? <p className={styles.loading}>Đang tải thông tin tài khoản...</p> : profile && <><div className={styles.infoGrid}><div className={styles.infoCard}><FiUser size={20} /><span>Tên đăng nhập</span><strong>{profile.username}</strong></div><div className={styles.infoCard}><FiShield size={20} /><span>Vai trò</span><strong>{profile.role === 'Admin' ? 'Quản trị viên' : profile.role}</strong></div><div className={styles.infoCard}><FiCheckCircle size={20} /><span>Trạng thái</span><strong>{profile.status === 'Active' ? 'Đang hoạt động' : profile.status}</strong></div><div className={styles.infoCard}><FiMail size={20} /><span>Email</span><strong>{profile.email}</strong></div></div><div className={styles.formsGrid}><section className={styles.section}><h2>Thông tin cá nhân</h2><form onSubmit={handleProfileSubmit}><label>Họ và tên<input value={fullName} onChange={(event) => setFullName(event.target.value)} maxLength={100} autoComplete="name" /></label><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={100} autoComplete="email" /></label><button type="submit" disabled={savingProfile}>{savingProfile ? 'Đang lưu...' : 'Lưu thông tin'}</button></form></section><section className={styles.section}><h2>Đổi mật khẩu</h2><form onSubmit={handlePasswordSubmit}><label>Mật khẩu hiện tại<input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" /></label><label>Mật khẩu mới<input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={6} autoComplete="new-password" /></label><label>Xác nhận mật khẩu mới<input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={6} autoComplete="new-password" /></label><button type="submit" disabled={savingPassword}>{savingPassword ? 'Đang đổi mật khẩu...' : 'Đổi mật khẩu'}</button></form></section></div></>}</div>;
};

export default MyAccount;
