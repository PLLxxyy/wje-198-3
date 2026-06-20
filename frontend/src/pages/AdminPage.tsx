import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';

interface Dashboard {
  today: string;
  totalToday: number;
  pickedUpToday: number;
  pendingTotal: number;
  overdue: number;
}

interface PickupRecord {
  id: number;
  tracking_no: string;
  recipient_name: string;
  recipient_phone: string;
  pickup_code: string;
  status: string;
  entered_at: string;
  picked_up_at: string | null;
  entered_by_name: string | null;
  picked_up_by_name: string | null;
}

interface Announcement {
  id: number;
  title: string;
  content: string;
  created_by: number;
  created_at: string;
  created_by_name: string;
}

function todayStr(): string {
  const d = new Date();
  return d.toISOString().substring(0, 10);
}

export default function AdminPage() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [hours, setHours] = useState<number[]>(new Array(24).fill(0));
  const [chartDate, setChartDate] = useState(todayStr());
  const [records, setRecords] = useState<PickupRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const limit = 15;

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementContent, setAnnouncementContent] = useState('');
  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false);
  const [submittingAnnouncement, setSubmittingAnnouncement] = useState(false);
  const [announcementResult, setAnnouncementResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadDashboard = useCallback(async () => {
    try {
      const data = await api.getDashboard();
      setDashboard(data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const loadPeakHours = useCallback(async (date?: string) => {
    try {
      const data = await api.getPeakHours(date);
      setHours(data.hours);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const loadRecords = useCallback(async () => {
    try {
      const data = await api.getRecords({ start_date: startDate, end_date: endDate, page, limit });
      setRecords(data.records);
      setTotalRecords(data.total);
    } catch (err) {
      console.error(err);
    }
  }, [startDate, endDate, page]);

  const loadAnnouncements = useCallback(async () => {
    try {
      const data = await api.getAnnouncements(1, 10);
      setAnnouncements(data.announcements || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([loadDashboard(), loadPeakHours(chartDate), loadRecords(), loadAnnouncements()]);
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    loadPeakHours(chartDate);
  }, [chartDate, loadPeakHours]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcementTitle.trim() || !announcementContent.trim()) {
      setAnnouncementResult({ type: 'error', message: '请填写公告标题和内容' });
      return;
    }
    setSubmittingAnnouncement(true);
    setAnnouncementResult(null);
    try {
      const data = await api.createAnnouncement({
        title: announcementTitle.trim(),
        content: announcementContent.trim(),
      });
      setAnnouncementResult({ type: 'success', message: data.message });
      setAnnouncementTitle('');
      setAnnouncementContent('');
      setShowAnnouncementForm(false);
      loadAnnouncements();
    } catch (err: any) {
      setAnnouncementResult({ type: 'error', message: err.message });
    } finally {
      setSubmittingAnnouncement(false);
    }
  };

  const handleDeleteAnnouncement = async (id: number) => {
    if (!confirm('确定要删除这条公告吗？')) return;
    try {
      await api.deleteAnnouncement(id);
      setAnnouncements(prev => prev.filter(a => a.id !== id));
    } catch (err: any) {
      console.error(err);
      alert('删除失败: ' + err.message);
    }
  };

  const maxHour = Math.max(...hours, 1);
  const totalPages = Math.ceil(totalRecords / limit);

  if (loading) {
    return <div className="loading"><div className="spinner" /><span>加载中...</span></div>;
  }

  return (
    <>
      <h1 className="page-title">管理员后台</h1>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card orange">
          <div className="stat-label">今日入库</div>
          <div className="stat-value">{dashboard?.totalToday ?? 0}</div>
          <div className="stat-icon">{'\u{1F4E6}'}</div>
        </div>
        <div className="stat-card green">
          <div className="stat-label">今日取件</div>
          <div className="stat-value">{dashboard?.pickedUpToday ?? 0}</div>
          <div className="stat-icon">{'\u{2705}'}</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-label">待取件总数</div>
          <div className="stat-value">{dashboard?.pendingTotal ?? 0}</div>
          <div className="stat-icon">{'\u{1F4E5}'}</div>
        </div>
        <div className="stat-card red">
          <div className="stat-label">超时未取(&gt;3天)</div>
          <div className="stat-value">{dashboard?.overdue ?? 0}</div>
          <div className="stat-icon">{'\u{26A0}'}</div>
        </div>
      </div>

      {/* Announcements */}
      <div className="card mb-24">
        <div className="card-header">
          <div className="card-title">公告管理</div>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => { setShowAnnouncementForm(!showAnnouncementForm); setAnnouncementResult(null); }}
          >
            {showAnnouncementForm ? '取消' : '发布公告'}
          </button>
        </div>
        {showAnnouncementForm && (
          <div className="card-body">
            <form onSubmit={handleCreateAnnouncement}>
              <div className="form-group">
                <label className="form-label">公告标题</label>
                <input
                  className="form-input"
                  placeholder="请输入公告标题"
                  value={announcementTitle}
                  onChange={e => setAnnouncementTitle(e.target.value)}
                  maxLength={100}
                />
              </div>
              <div className="form-group">
                <label className="form-label">公告内容</label>
                <textarea
                  className="form-input"
                  placeholder="请输入公告内容"
                  value={announcementContent}
                  onChange={e => setAnnouncementContent(e.target.value)}
                  rows={4}
                  style={{ resize: 'vertical' }}
                />
              </div>
              <button
                className="btn btn-primary"
                type="submit"
                disabled={submittingAnnouncement}
                style={{ width: '100%' }}
              >
                {submittingAnnouncement ? '发布中...' : '发布公告'}
              </button>
              {announcementResult && (
                <div
                  className={`alert ${announcementResult.type === 'success' ? 'alert-success' : 'alert-error'}`}
                  style={{ marginTop: 16 }}
                >
                  {announcementResult.message}
                </div>
              )}
            </form>
          </div>
        )}
        <div className="card-body" style={{ paddingTop: showAnnouncementForm ? 0 : undefined }}>
          {announcements.length === 0 ? (
            <div className="empty-state">
              <p>暂无公告</p>
              <p className="sub">发布公告后所有用户都会收到通知</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {announcements.map(a => (
                <div
                  key={a.id}
                  style={{
                    padding: '12px 16px',
                    borderRadius: 8,
                    border: '1px solid var(--gray-200)',
                    background: 'var(--gray-50)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <strong style={{ fontSize: 15 }}>{a.title}</strong>
                      <span style={{ fontSize: 12, color: 'var(--gray-400)', marginLeft: 12 }}>
                        {a.created_at} · {a.created_by_name}
                      </span>
                    </div>
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => handleDeleteAnnouncement(a.id)}
                    >
                      删除
                    </button>
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--gray-600)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {a.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Peak Hours Chart */}
      <div className="chart-container mb-24">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div className="chart-title" style={{ marginBottom: 0 }}>每日取件高峰时段</div>
          <div className="flex-row">
            <label className="text-sm text-gray">选择日期:</label>
            <input
              type="date"
              className="date-picker"
              value={chartDate}
              onChange={e => setChartDate(e.target.value)}
            />
          </div>
        </div>
        <div className="bar-chart">
          {hours.map((count, hour) => (
            <div className="bar-col" key={hour}>
              <div className="bar-value">{count > 0 ? count : ''}</div>
              <div
                className={`bar ${count > 0 ? 'active' : 'inactive'}`}
                style={{ height: `${count > 0 ? Math.max((count / maxHour) * 160, 4) : 2}px` }}
              />
              <div className="bar-label">{hour}</div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 28, fontSize: 13, color: 'var(--gray-400)' }}>
          时间（小时） / 取件数量
        </div>
      </div>

      {/* Records Table */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">取件记录</div>
          <div className="flex-row">
            <span className="text-sm text-gray">共 {totalRecords} 条</span>
          </div>
        </div>
        <div className="card-body" style={{ padding: '12px 20px 0' }}>
          <div className="filter-bar">
            <label className="text-sm text-gray">开始日期:</label>
            <input type="date" className="date-picker" value={startDate} onChange={e => { setStartDate(e.target.value); setPage(1); }} />
            <label className="text-sm text-gray">结束日期:</label>
            <input type="date" className="date-picker" value={endDate} onChange={e => { setEndDate(e.target.value); setPage(1); }} />
            <button className="btn btn-secondary btn-sm" onClick={() => { setStartDate(''); setEndDate(''); setPage(1); }}>
              重置
            </button>
          </div>
        </div>
        {records.length === 0 ? (
          <div className="empty-state">
            <p>暂无取件记录</p>
            <p className="sub">调整筛选条件或等待用户取件</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>快递单号</th>
                  <th>收件人</th>
                  <th>手机号</th>
                  <th>入库操作员</th>
                  <th>入库时间</th>
                  <th>取件时间</th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id}>
                    <td><span className="tracking-no">{r.tracking_no}</span></td>
                    <td>{r.recipient_name}</td>
                    <td>{r.recipient_phone}</td>
                    <td>{r.entered_by_name || '-'}</td>
                    <td className="text-sm text-gray">{r.entered_at}</td>
                    <td className="text-sm text-gray">{r.picked_up_at || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="pagination">
            <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              上一页
            </button>
            <span className="page-info">第 {page} / {totalPages} 页</span>
            <button className="btn btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              下一页
            </button>
          </div>
        )}
      </div>
    </>
  );
}
