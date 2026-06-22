import React, { useState, useEffect } from 'react';
import type { JockeyInvitation, Horse } from '../../types/owner.types';
import { getAvailableJockeys, getMyHorses, getOwnerPairings, inviteJockey, acceptPairing } from '../../services/ownerService';

// Mock data
const mockInvitations: JockeyInvitation[] = [
  {
    invitationID: 'inv-001',
    requestMessage: 'Xin mời tham gia',
    ownerID: 'owner-001',
    jockeyID: 'jockey-001',
    jockeyName: 'Nguyễn Văn A',
    status: 'Pending',
    invitedAt: new Date('2024-06-10'),
    horseID: 'H001',
  },
  {
    invitationID: 'inv-002',
    requestMessage: 'Xin mời tham gia',
    ownerID: 'owner-001',
    jockeyID: 'jockey-002',
    jockeyName: 'Trần Thị B',
    status: 'Accepted',
    invitedAt: new Date('2024-06-08'),
    respondedAt: new Date('2024-06-09'),
    horseID: 'H002',
  },
  {
    invitationID: 'inv-003',
    requestMessage: 'Xin mời tham gia',
    ownerID: 'owner-001',
    jockeyID: 'jockey-003',
    jockeyName: 'Phạm Văn C',
    status: 'Declined',
    invitedAt: new Date('2024-06-05'),
    respondedAt: new Date('2024-06-06'),
    horseID: 'H003',
  },
];

export default function JockeyInvite() {
  const [invitations, setInvitations] = useState<JockeyInvitation[]>(mockInvitations);
  const [showModal, setShowModal] = useState(false);
  const [jockeyName, setJockeyName] = useState('');
  const [requestMessage, setRequestMessage] = useState('');
  const [error, setError] = useState('');
  const [availableJockeys, setAvailableJockeys] = useState<any[]>([]);
  const [loadingJockeys, setLoadingJockeys] = useState(false);
  const [selectedJockeyId, setSelectedJockeyId] = useState('');
  const [horses, setHorses] = useState<Horse[]>([]);
  const [loadingHorses, setLoadingHorses] = useState(false);
  const [selectedHorseId, setSelectedHorseId] = useState('');
  const [filterHorseId, setFilterHorseId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [loadingInvitations, setLoadingInvitations] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [sending, setSending] = useState(false);

  const getHorseNameById = (horseID?: string, horseName?: string) => {
    if (!horseID) return 'Chưa gán ngựa';
    const found = horses.find(h => String(h.horseID || (h as any).id || (h as any).horseId) === String(horseID));
    if (found) return found.name;
    if (horseName) return horseName;
    return `Ngựa (ID: ${horseID})`;
  };

  const filteredInvitations = invitations.filter((inv) => {
    const matchHorse = filterHorseId ? String(inv.horseID) === filterHorseId : true;
    const matchStatus = filterStatus ? inv.status === filterStatus : true;
    return matchHorse && matchStatus;
  });

  useEffect(() => {
    const fetchJockeys = async () => {
      try {
        setLoadingJockeys(true);
        const data = await getAvailableJockeys(1, 1, 20); // tournamentId=1, page=1, pageSize=20
        setAvailableJockeys(data);
      } catch (err) {
        console.error('Failed to fetch available jockeys:', err);
      } finally {
        setLoadingJockeys(false);
      }
    };

    const fetchHorses = async () => {
      try {
        setLoadingHorses(true);
        const data = await getMyHorses();
        setHorses(data);
      } catch (err) {
        console.error('Failed to fetch my horses:', err);
      } finally {
        setLoadingHorses(false);
      }
    };

    fetchJockeys();
    fetchHorses();
  }, []);

  useEffect(() => {
    const fetchInvitations = async () => {
      try {
        setLoadingInvitations(true);
        const data = await getOwnerPairings(filterStatus, filterHorseId);
        
        // Map the backend pairings to our UI JockeyInvitation format
        const mapped: JockeyInvitation[] = data.map((item: any) => {
          return {
            invitationID: String(item.pairingId || item.pairingID || item.id || `inv-${Date.now()}-${Math.random()}`),
            raceID: item.raceId || item.raceID || item.requestMessage || 'N/A',
            ownerID: item.ownerId || item.ownerID || '',
            jockeyID: String(item.jockey?.jockeyId || item.jockeyId || item.jockeyID || ''),
            jockeyName: item.jockey?.fullName || item.jockeyName || item.jockey?.name || 'N/A',
            status: item.status || 'Pending',
            invitedAt: item.createdAt ? new Date(item.createdAt) : (item.invitedAt ? new Date(item.invitedAt) : new Date()),
            respondedAt: item.respondedAt ? new Date(item.respondedAt) : undefined,
            horseID: String(item.horse?.horseId || item.horseId || item.horseID || ''),
            horseName: item.horse?.name || '',
          };
        });
        setInvitations(mapped);
      } catch (err) {
        console.error('Failed to fetch invitations:', err);
      } finally {
        setLoadingInvitations(false);
      }
    };

    fetchInvitations();
  }, [filterStatus, filterHorseId, refreshTrigger]);

  const getStatusColor = (status: JockeyInvitation['status']): string => {
    switch (status) {
      case 'Pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'Accepted':
        return 'bg-green-100 text-green-800';
      case 'Declined':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleSendInvitation = async () => {
    setError('');

    if (!selectedJockeyId) {
      setError('Vui lòng chọn Jockey từ danh sách khả dụng');
      return;
    }

    if (!selectedHorseId) {
      setError('Vui lòng chọn ngựa');
      return;
    }

    if (!requestMessage.trim()) {
      setError('Vui lòng nhập lời nhắn');
      return;
    }

    try {
      setSending(true);
      // Call API to send invitation
      await inviteJockey({
        horseId: selectedHorseId,
        jockeyId: selectedJockeyId,
        requestMessage: requestMessage,
      });

      // Clear form inputs and close modal
      setJockeyName('');
      setSelectedJockeyId('');
      setSelectedHorseId('');
      setRequestMessage('');
      setShowModal(false);

      // Trigger list refresh
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: any) {
      console.error('Failed to send invitation:', err);
      setError(err?.response?.data?.message || 'Đã xảy ra lỗi khi gửi lời mời. Vui lòng thử lại.');
    } finally {
      setSending(false);
    }
  };

  const handleConfirmPairing = async (invitationID: string) => {
    // try {
    //   const response = await acceptPairing(invitationID);
    //   alert(response.message || 'Confirm pairing accepted successfully.');
    //   setRefreshTrigger((prev) => prev + 1);
    // } catch (err: any) {
    //   console.error('Failed to confirm pairing:', err);
    //   alert(err?.response?.data?.message || 'Đã xảy ra lỗi khi xác nhận ghép cặp. Vui lòng thử lại.');
    // }
  };


  const [activeTab, setActiveTab] = useState<'available' | 'history'>('available');

  // Main Render
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              Lời mời jockey
            </h1>
            <p className="text-gray-600">
              Quản lý các lời mời gửi cho jockey và tìm kiếm kỵ sĩ khả dụng
            </p>
          </div>
          <button
            onClick={() => {
              setSelectedJockeyId('');
              setJockeyName('');
              setShowModal(true);
            }}
            className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
          >
            <span>+</span> Gửi lời mời mới
          </button>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab('available')}
              className={`pb-4 text-sm font-semibold transition-all border-b-2 ${
                activeTab === 'available'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Kỵ sĩ khả dụng ({availableJockeys.length})
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`pb-4 text-sm font-semibold transition-all border-b-2 ${
                activeTab === 'history'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Lịch sử lời mời ({invitations.length})
            </button>
          </div>
        </div>

        {activeTab === 'available' ? (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              {loadingJockeys ? (
                <div className="p-12 text-center text-gray-500">
                  <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
                  <p className="text-gray-600">Đang tải danh sách kỵ sĩ khả dụng...</p>
                </div>
              ) : availableJockeys.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <div className="text-4xl mb-2">👤</div>
                  Không có kỵ sĩ khả dụng nào
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Tên kỵ sĩ</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Chứng chỉ</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Kinh nghiệm</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Sức khỏe</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {availableJockeys.map((j) => {
                      const jId = String(j.jockeyId || j.jockeyID || j.id || '');
                      return (
                        <tr key={jId} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 text-sm font-medium text-gray-800">{j.fullName || 'N/A'}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{j.licenseCertificate || 'N/A'}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{j.experienceYears || 0} năm</td>
                          <td className="px-6 py-4 text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              j.healthStatus === 'Good' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {j.healthStatus === 'Good' ? 'Khỏe mạnh' : j.healthStatus || 'N/A'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <button
                              onClick={() => {
                                setSelectedJockeyId(jId);
                                setJockeyName(j.fullName || '');
                                setShowModal(true);
                              }}
                              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-md transition-colors"
                            >
                              Mời tham gia
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Bộ lọc theo Horse ID & Status */}
            <div className="bg-white p-4 border border-gray-200 rounded-xl shadow-sm flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-3">
                <label className="text-sm font-semibold text-gray-700">Lọc theo ngựa:</label>
                <select
                  value={filterHorseId}
                  onChange={(e) => setFilterHorseId(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white text-sm"
                >
                  <option value="">-- Tất cả ngựa --</option>
                  {horses.map((h) => {
                    const hId = String(h.horseID || (h as any).id || (h as any).horseId || '');
                    return (
                      <option key={hId} value={hId}>
                        {h.name} (ID: {hId})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="flex items-center gap-3">
                <label className="text-sm font-semibold text-gray-700">Lọc theo trạng thái:</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white text-sm"
                >
                  <option value="">-- Tất cả trạng thái --</option>
                  <option value="Pending">Chờ phản hồi (Pending)</option>
                  <option value="Accepted">Đã chấp nhận (Accepted)</option>
                  <option value="Declined">Đã từ chối (Declined)</option>
                </select>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                {loadingInvitations ? (
                  <div className="p-12 text-center text-gray-500">
                    <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
                    <p className="text-gray-600">Đang tải lịch sử lời mời...</p>
                  </div>
                ) : filteredInvitations.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <div className="text-4xl mb-2">🤝</div>
                    Không tìm thấy lời mời nào cho bộ lọc này
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Tên jockey</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Ngựa ghép cặp</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Lời nhắn</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Trạng thái</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Ngày mời</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredInvitations.map((invitation) => (
                        <tr key={invitation.invitationID} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 text-sm text-gray-800 font-medium">{invitation.jockeyName || 'N/A'}</td>
                          <td className="px-6 py-4 text-sm text-gray-800 font-medium">
                            <span className="bg-blue-50 text-blue-800 px-2.5 py-1 rounded-md text-xs font-semibold">
                              {getHorseNameById(invitation.horseID, invitation.horseName)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-800">{invitation.requestMessage || 'N/A'}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(invitation.status)}`}>
                              {invitation.status === 'Pending' && 'Chờ phản hồi'}
                              {invitation.status === 'Accepted' && 'Đã chấp nhận'}
                              {invitation.status === 'Declined' && 'Đã từ chối'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-800">{new Date(invitation.invitedAt).toLocaleDateString('vi-VN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Send Invitation Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg p-8 max-w-xl w-full mx-4">
              <h3 className="text-lg font-bold text-gray-800 mb-4">
                Gửi lời mời cho jockey
              </h3>

              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Chọn Jockey khả dụng (từ hệ thống)
                  </label>
                  {loadingJockeys ? (
                    <div className="text-sm text-gray-500 italic">Đang tải danh sách jockey...</div>
                  ) : (
                    <select
                      value={selectedJockeyId}
                      onChange={(e) => {
                        const targetId = e.target.value;
                        setSelectedJockeyId(targetId);
                        const jockeyObj = availableJockeys.find(j => 
                          String(j.jockeyId || j.jockeyID || j.id) === targetId
                        );
                        if (jockeyObj) {
                          setJockeyName(jockeyObj.fullName || jockeyObj.jockeyName || jockeyObj.name || '');
                        } else {
                          setJockeyName('');
                        }
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-white"
                    >
                      <option value="">-- Chọn Jockey --</option>
                      {availableJockeys.map((j) => {
                        const idVal = String(j.jockeyId || j.jockeyID || j.id || '');
                        const nameVal = j.fullName || j.name || j.jockeyName || 'Jockey không tên';
                        const licVal = j.licenseCertificate || j.licenseNumber ? ` (GPLX: ${j.licenseCertificate || j.licenseNumber})` : '';
                        const expVal = j.experienceYears ? ` - ${j.experienceYears} năm KN` : '';
                        return (
                          <option key={idVal} value={idVal}>
                            {nameVal}{licVal}{expVal}
                          </option>
                        );
                      })}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tên jockey (tự động điền hoặc nhập thủ công)
                  </label>
                  <input
                    type="text"
                    value={jockeyName}
                    onChange={(e) => {
                      setJockeyName(e.target.value);
                      setSelectedJockeyId('');
                    }}
                    placeholder="Nhập tên jockey"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Chọn Ngựa (Horse ID)
                  </label>
                  {loadingHorses ? (
                    <div className="text-sm text-gray-500 italic">Đang tải danh sách ngựa...</div>
                  ) : (
                    <select
                      value={selectedHorseId}
                      onChange={(e) => setSelectedHorseId(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-white"
                    >
                      <option value="">-- Chọn Ngựa --</option>
                      {horses.map((h) => {
                        const hId = h.horseID || (h as any).id || (h as any).horseId || '';
                        return (
                          <option key={hId} value={hId}>
                            {h.name} (ID: {hId})
                          </option>
                        );
                      })}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Lời nhắn
                  </label>
                  <textarea
                    value={requestMessage}
                    onChange={(e) => setRequestMessage(e.target.value)}
                    placeholder="Nhập lời nhắn gửi đến jockey"
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowModal(false);
                    setError('');
                    setJockeyName('');
                    setSelectedJockeyId('');
                    setSelectedHorseId('');
                    setRequestMessage('');
                  }}
                  disabled={sending}
                  className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Hủy
                </button>
                <button
                  onClick={handleSendInvitation}
                  disabled={sending}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending && (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  )}
                  <span>{sending ? 'Đang gửi...' : 'Gửi lời mời'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
