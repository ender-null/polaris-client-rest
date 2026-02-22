import express, { Express, Request, Response } from 'express';
import WebSocket from 'ws';
import { Conversation, Extra, WSBroadcast, WSInit, WSMessage, WSNotify, WSPing } from './types';
import { logger, now } from './utils';

process.on('exit', () => {
  logger.warn(`Exit process`);
});

if (!process.env.SERVER || !process.env.CONFIG) {
  if (!process.env.SERVER) {
    logger.warn(`Missing env variable SERVER`);
  }
  if (!process.env.CONFIG) {
    logger.warn(`Missing env variable CONFIG`);
  }
  process.exit();
}

const serverUrl = process.env.SERVER;
const app: Express = express();
const port = 3000;

const PING_INTERVAL_MS = 30000;

let ws: WebSocket | null = null;
let pingInterval: ReturnType<typeof setInterval> | null = null;
const messageRequestQueue: Array<{ resolve: (value: unknown) => void }> = [];

const connect = (): WebSocket => {
  const socket = new WebSocket(`${serverUrl}?platform=api`);
  return socket;
};

const initSocket = (socket: WebSocket): void => {
  init(socket);
  if (pingInterval) clearInterval(pingInterval);
  pingInterval = setInterval(() => {
    if (socket.readyState === WebSocket.OPEN) {
      const ping: WSPing = { bot: 'api', platform: 'api', type: 'ping' };
      socket.send(JSON.stringify(ping));
    }
  }, PING_INTERVAL_MS);
};

const startWebSocket = (): void => {
  const socket = connect();

  socket.on('open', () => {
    logger.info('WebSocket connected');
    initSocket(socket);
  });

  socket.on('message', (data: WebSocket.Data) => {
    if (messageRequestQueue.length > 0) {
      const { resolve } = messageRequestQueue.shift()!;
      resolve(data);
    }
  });

  socket.on('close', () => {
    logger.warn('WebSocket closed');
    pingInterval && clearInterval(pingInterval);
    pingInterval = null;
    ws = null;
    setTimeout(startWebSocket, 3000);
  });

  socket.on('error', (err) => {
    logger.error('WebSocket error', err);
  });

  ws = socket;
};

const getReadyWs = async (): Promise<WebSocket> => {
  for (let i = 0; i < 60; i++) {
    if (ws && ws.readyState === WebSocket.OPEN) return ws;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('WebSocket not ready');
};

app.get('/', (req, res) => {
  void (async () => {
    try {
      const socket = await getReadyWs();
      const content = req.query.content as string;
      const userId = (req.query.userId as string) ?? process.env.DEFAULT_USER_ID;
      const personality = (req.query.personality as string) ?? process.env.DEFAULT_PERSONALITY ?? 'polaris';
      const type = (req.query.type as string) ?? 'text';
      const extra = (req.query.extra as any) ?? {
        format: 'Markdown',
      };
      if (req.query.silent === 'true') {
        extra.silent = true;
      }
      if (!userId) {
        res.send({
          error: 'Missing parameters',
          message: "Missing required parameter 'userId'",
        });
        res.end();
        return;
      } else if (!personality) {
        res.send({
          error: 'Missing parameters',
          message: "Missing required parameter 'personality'",
        });
        res.end();
        return;
      } else if (!content) {
        res.send({
          error: 'Missing parameters',
          message: "Missing required parameter 'content'",
        });
        res.end();
        return;
      }
      notify(socket, userId, personality, content, type, extra);
      res.send({ success: true });
      res.end();
    } catch (err) {
      res.status(503).send({ error: 'WebSocket unavailable', message: err.message });
      res.end();
    }
  })();
});

app.get('/message', (req: Request, res: Response) => {
  void (async () => {
    try {
      const content = req.query.content as string;
      const chatId = (req.query.chatId as string) || process.env.DEFAULT_CHAT_ID;
      const type = (req.query.type as string) || 'text';
      const extra = (req.query.extra as any) || {
        format: 'Markdown',
      };
      if (!content || !chatId) {
        res.send({
          error: 'Missing parameters',
          message: "Missing required parameters 'chatId' or 'content'",
        });
        res.end();
        return;
      }

      const socket = await getReadyWs();
      const responsePromise = new Promise((resolve) => {
        messageRequestQueue.push({ resolve });
      });
      message(socket, chatId, content, type, extra);

      const wsMessage = await responsePromise;
      logger.info(JSON.stringify(wsMessage, null, 4));
      res.send(wsMessage);
      res.end();
    } catch (err) {
      res.status(503).send({ error: 'WebSocket unavailable' });
      res.end();
    }
  })();
});

app.get('/broadcast', (req, res) => {
  void (async () => {
    try {
      const content = req.query.content as string;
      const chatId = (req.query.chatId as string) || process.env.DEFAULT_CHAT_ID;
      const type = (req.query.type as string) || 'text';
      const target = (req.query.target as string) || process.env.DEFAULT_TARGET || 'all';
      const extra = (req.query.extra as any) || {
        format: 'Markdown',
      };
      if (!content || !chatId) {
        res.send({
          error: 'Missing parameters',
          message: "Missing required parameters 'chatId' or 'content'",
        });
        res.end();
        return;
      }

      const socket = await getReadyWs();
      const data = broadcast(socket, chatId, content, type, extra, target);
      res.send(data);
      res.end();
    } catch (err) {
      res.status(503).send({ error: 'WebSocket unavailable' });
      res.end();
    }
  })();
});

app.get('/redirect', (req, res) => {
  void (async () => {
    try {
      const content = req.query.content as string;
      const chatId = (req.query.chatId as string) || process.env.DEFAULT_CHAT_ID;
      const type = (req.query.type as string) || 'text';
      const target = (req.query.target as string) || process.env.DEFAULT_TARGET || 'all';
      const extra = (req.query.extra as any) || {
        format: 'Markdown',
      };
      if (!content || !chatId) {
        res.send({
          error: 'Missing parameters',
          message: "Missing required parameters 'chatId' or 'content'",
        });
        res.end();
        return;
      }

      const socket = await getReadyWs();
      const data = broadcast(socket, chatId, content, type, extra, target, true);
      res.send(data);
      res.end();
    } catch (err) {
      res.status(503).send({ error: 'WebSocket unavailable' });
      res.end();
    }
  })();
});

startWebSocket();

app.listen(port, () => {
  logger.info(`Polaris API client running on port ${port}`);
});

const user = {
  id: 'api',
  firstName: 'api',
  lastName: null,
  username: 'api',
  isBot: true,
};

const init = (ws: WebSocket) => {
  const config = JSON.parse(process.env.CONFIG);
  const data: WSInit = {
    bot: user.username,
    platform: 'api',
    type: 'init',
    user: user,
    config: config,
  };
  const json = JSON.stringify(data, null, 4);
  logger.info(json);
  ws.send(json);
  return data;
};

const message = (ws: WebSocket, chatId: string, content?: string, type: string = 'text', extra?: Extra) => {
  const data: WSMessage = {
    bot: user.username,
    platform: 'api',
    type: 'message',
    message: {
      id: 0,
      conversation: new Conversation(chatId),
      sender: user,
      content,
      type,
      date: now(),
      reply: null,
      extra,
    },
  };
  const json = JSON.stringify(data, null, 4);
  logger.info(json);
  ws.send(json);
  return data;
};

const broadcast = (
  ws: WebSocket,
  chatId: string,
  content?: string,
  type: string = 'text',
  extra?: Extra,
  target: string = 'all',
  redirect: boolean = false,
) => {
  const data: WSBroadcast = {
    bot: 'api',
    platform: 'api',
    type: redirect ? 'redirect' : 'broadcast',
    target: target,
    message: {
      conversation: new Conversation(chatId),
      content,
      type,
      extra,
    },
  };
  const json = JSON.stringify(data, null, 4);
  logger.info(json);
  ws.send(json);
  return data;
};

const notify = (
  ws: WebSocket,
  userId: string,
  personality: string,
  content?: string,
  type: string = 'text',
  extra?: Extra,
) => {
  const data: WSNotify = {
    bot: 'api',
    platform: 'api',
    type: 'notify',
    personality,
    userId,
    message: {
      content,
      type,
      extra,
    },
  };
  const json = JSON.stringify(data, null, 4);
  logger.info(json);
  ws.send(json);
  return data;
};
