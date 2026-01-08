import { Hono } from 'hono';
import { getDatabaseClient, getAllUsers, getUserByUsername, createUserWithRole, deleteUser } from '../db';
import { authMiddleware, adminMiddleware, verifyToken, Variables } from '../middleware/auth';
import { hashPassword } from '../db';
import type { Env, CreateUserRequest } from '../types';

const usersRouter = new Hono<{ Bindings: Env, Variables: Variables }>();

usersRouter.get('/', authMiddleware, adminMiddleware, async (c) => {
  const users = await getAllUsers(c.env);
  return c.json(users);
});

usersRouter.post('/', authMiddleware, adminMiddleware, async (c) => {
  const body = await c.req.json<CreateUserRequest>();
  const { username, password, role } = body;

  if (!username || !password) {
    return c.json({ error: '用户名和密码不能为空' }, 400);
  }

  if (password.length < 3) {
    return c.json({ error: '密码长度至少3个字符' }, 400);
  }

  const existingUser = await getUserByUsername(c.env, username);
  if (existingUser) {
    return c.json({ error: '用户名已存在' }, 400);
  }

  const passwordHash = await hashPassword(password);
  const user = await createUserWithRole(c.env, username, passwordHash, role || 'user');

  return c.json(user);
});

usersRouter.delete('/:id', authMiddleware, adminMiddleware, async (c) => {
  const id = c.req.param('id');
  const userId = parseInt(id);

  if (userId === 1) {
    return c.json({ error: '默认管理员不能删除' }, 400);
  }

  const result = await deleteUser(c.env, userId);
  if (result.changes === 0) {
    return c.json({ error: '用户不存在' }, 404);
  }

  return c.json({ message: '用户删除成功' });
});

export default usersRouter;
