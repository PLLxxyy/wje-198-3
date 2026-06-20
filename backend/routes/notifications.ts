import { Router, Request, Response } from 'express';
import db from '../db.js';
import { roleMiddleware } from '../auth.js';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const countResult = db.prepare(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ?'
    ).get(req.user!.userId) as any;
    const total = countResult.count;

    const notifications = db.prepare(
      `SELECT * FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`
    ).all(req.user!.userId, limit, offset);

    res.json({ notifications, total, page, limit });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/unread-count', (req: Request, res: Response) => {
  try {
    const result = db.prepare(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0'
    ).get(req.user!.userId) as any;
    res.json({ unread_count: result.count });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/read/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const notification = db.prepare(
      'SELECT * FROM notifications WHERE id = ? AND user_id = ?'
    ).get(id, req.user!.userId);
    if (!notification) {
      res.status(404).json({ error: '通知不存在' });
      return;
    }
    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(id);
    res.json({ message: '标记已读成功' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/read-all', (req: Request, res: Response) => {
  try {
    db.prepare(
      'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0'
    ).run(req.user!.userId);
    res.json({ message: '全部已读' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/announcements', roleMiddleware('admin'), (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const countResult = db.prepare(
      'SELECT COUNT(*) as count FROM announcements'
    ).get() as any;
    const total = countResult.count;

    const announcements = db.prepare(
      `SELECT a.*, u.name as created_by_name
       FROM announcements a
       LEFT JOIN users u ON a.created_by = u.id
       ORDER BY a.created_at DESC
       LIMIT ? OFFSET ?`
    ).all(limit, offset);

    res.json({ announcements, total, page, limit });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/announcements', roleMiddleware('admin'), (req: Request, res: Response) => {
  try {
    const { title, content } = req.body;
    if (!title || !content) {
      res.status(400).json({ error: '请填写公告标题和内容' });
      return;
    }

    const result = db.prepare(
      'INSERT INTO announcements (title, content, created_by) VALUES (?, ?, ?)'
    ).run(title, content, req.user!.userId);

    const announcementId = result.lastInsertRowid as number;

    const users = db.prepare(
      'SELECT id FROM users'
    ).all() as any[];

    const insertNotification = db.prepare(
      `INSERT INTO notifications (user_id, type, title, content, related_id)
       VALUES (?, 'announcement', ?, ?, ?)`
    );

    const insertMany = db.transaction((userList: any[]) => {
      for (const user of userList) {
        insertNotification.run(user.id, title, content, announcementId);
      }
    });
    insertMany(users);

    const announcement = db.prepare(
      `SELECT a.*, u.name as created_by_name
       FROM announcements a
       LEFT JOIN users u ON a.created_by = u.id
       WHERE a.id = ?`
    ).get(announcementId);

    res.status(201).json({ announcement, message: '公告发布成功' });
  } catch (err: any) {
    res.status(500).json({ error: '发布失败: ' + err.message });
  }
});

router.delete('/announcements/:id', roleMiddleware('admin'), (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const announcement = db.prepare('SELECT * FROM announcements WHERE id = ?').get(id);
    if (!announcement) {
      res.status(404).json({ error: '公告不存在' });
      return;
    }
    db.prepare('DELETE FROM notifications WHERE type = ? AND related_id = ?').run('announcement', id);
    db.prepare('DELETE FROM announcements WHERE id = ?').run(id);
    res.json({ message: '删除成功' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
