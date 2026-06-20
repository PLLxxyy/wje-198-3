import { useState, useEffect, useRef } from 'react';
import { api } from '../api';

interface Notification {
  id: number;
  user_id: number;
  type: string;
  title: string;
  content: string;
  is_read: number;
  related_id: number | null;
  created_at: string;
}

interface NotificationPanelProps {
  onClose: () => void;
  unreadCount: number;
  onUnreadCountChange: (count: number) => void;
}

export default function NotificationPanel({ onClose, unreadCount, onUnreadCountChange }: NotificationPanelProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadNotifications();
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const data = await api.getNotifications(1, 20);
      setNotifications(data.notifications || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id: number) => {
    try {
      await api.markAsRead(id);
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, is_read: 1 } : n))
      );
      onUnreadCountChange(Math.max(0, unreadCount - 1));
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
      onUnreadCountChange(0);
    } catch (err: any) {
      console.error(err);
    }
  };

  const typeIcon: Record<string, string> = {
    package: '\u{1F4E6}',
    announcement: '\u{1F4E2}',
  };

  const typeLabel: Record<string, string> = {
    package: '快递通知',
    announcement: '系统公告',
  };

  return (
    <div className="notification-panel" ref={panelRef}>
      <div className="notification-header">
        <span className="notification-title">消息通知</span>
        <button className="btn btn-link btn-sm" onClick={handleMarkAllAsRead} disabled={unreadCount === 0}>
          全部已读
        </button>
      </div>
      <div className="notification-list">
        {loading ? (
          <div className="loading"><div className="spinner" /><span>加载中...</span></div>
        ) : notifications.length === 0 ? (
          <div className="empty-state">
            <p>暂无通知</p>
          </div>
        ) : (
          notifications.map(n => (
            <div
              key={n.id}
              className={`notification-item ${n.is_read === 0 ? 'unread' : ''}`}
              onClick={() => n.is_read === 0 && handleMarkAsRead(n.id)}
            >
              <div className="notification-icon">{typeIcon[n.type] || '\u{1F4AC}'}</div>
              <div className="notification-content">
                <div className="notification-item-title">
                  <span className="notification-type">{typeLabel[n.type] || '通知'}</span>
                  <span className="notification-time">{n.created_at}</span>
                </div>
                <div className="notification-item-content">
                  <strong>{n.title}</strong>
                  <p>{n.content}</p>
                </div>
              </div>
              {n.is_read === 0 && <div className="notification-dot" />}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
