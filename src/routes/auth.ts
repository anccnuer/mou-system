import { Hono } from 'hono';
import { getUserByUsername, getUserByIdWithPassword, hashPassword, verifyPassword, updateUserPassword } from '../db';
import { generateToken, verifyToken, Variables } from '../middleware/auth';
import type { Env, LoginRequest, ChangePasswordRequest } from '../types';

const authRouter = new Hono<{ Bindings: Env, Variables: Variables }>();

authRouter.get('/me', async (c) => {
  const authHeader = c.req.header('Authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    return c.json({ authenticated: false });
  }

  const payload = await verifyToken(token);
  if (!payload) {
    return c.json({ authenticated: false });
  }

  return c.json({
    authenticated: true,
    user: {
      id: payload.sub,
      username: payload.username,
      role: payload.role
    }
  });
});

authRouter.post('/login', async (c) => {
  const body = await c.req.json<LoginRequest>();
  const { username, password } = body;

  if (!username || !password) {
    return c.json({ error: '用户名和密码不能为空' }, 400);
  }

  const user = await getUserByUsername(c.env, username);
  if (!user) {
    return c.json({ error: '用户名或密码错误' }, 401);
  }

  const isValid = await verifyPassword(password, user.password as string);
  if (!isValid) {
    return c.json({ error: '用户名或密码错误' }, 401);
  }

  const userWithoutPassword = {
    id: user.id,
    username: user.username,
    role: user.role
  };

  const token = await generateToken({
    sub: String(user.id),
    username: user.username,
    role: user.role
  });

  return c.json({
    message: '登录成功',
    user: userWithoutPassword,
    token
  });
});

authRouter.post('/logout', (c) => {
  return c.json({ message: '登出成功' });
});

authRouter.post('/change-password', async (c) => {
  const body = await c.req.json<ChangePasswordRequest>();
  const { oldPassword, newPassword } = body;

  if (!oldPassword || !newPassword) {
    return c.json({ error: '原密码和新密码不能为空' }, 400);
  }

  if (newPassword.length < 3) {
    return c.json({ error: '新密码长度至少3个字符' }, 400);
  }

  const authHeader = c.req.header('Authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    return c.json({ error: '未登录' }, 401);
  }

  const payload = await verifyToken(token);
  if (!payload) {
    return c.json({ error: '登录已过期' }, 401);
  }

  const userId = parseInt(payload.sub);
  const user = await getUserByIdWithPassword(c.env, userId);
  if (!user) {
    return c.json({ error: '用户不存在' }, 404);
  }

  const isValid = await verifyPassword(oldPassword, user.password as string);
  if (!isValid) {
    return c.json({ error: '原密码错误' }, 401);
  }

  const newPasswordHash = await hashPassword(newPassword);
  await updateUserPassword(c.env, user.id, newPasswordHash);

  return c.json({ message: '密码修改成功' });
});

export default authRouter;
