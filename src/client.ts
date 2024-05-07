/* eslint-disable @typescript-eslint/no-explicit-any */
import express, { Express, Request, Response } from 'express';
import WebSocket from 'ws';
import { Conversation, Extra, WSBroadcast, WSInit, WSMessage } from './types';
import { logger, now } from './utils';

logger.debug(`SERVER: ${process.env.SERVER}`);
logger.debug(`CONFIG: ${process.env.CONFIG}`);

process.on('exit', () => {
  logger.warn(`Exit process`);
});

const app: Express = express();
const port = 3000;

app.get('/', (req: Request, res: Response) => {
  const ws = new WebSocket(process.env.SERVER);
  let responseSent = false;

  ws.on('open', () => {
    init(ws);
    const content = req.query.content as string;
    const chatId = req.query.chatId as string;
    const type = (req.query.type as string) || 'text';
    const extra = (req.query.extra as any) || {
      format: 'Markdown'
    };
    if (!content || !chatId) {
      res.send({
        error: 'Missing parameters',
        message: "Missing required parameters 'chatId' or 'content'",
      });
      res.end();
      ws.close();
    }
    message(ws, chatId, content, type, extra);
  });

  ws.on('message', (message) => {
    if (!responseSent) {
      logger.info(JSON.stringify(message, null, 4));
      ws.send(message);
      res.send(message);
      res.end();
      responseSent = true;
      ws.close();
    }
  });
});

app.get('/broadcast', (req, res) => {
  const ws = new WebSocket(process.env.SERVER);

  ws.on('open', () => {
    init(ws);
    const content = req.query.content as string;
    const chatId = req.query.chatId as string;
    const type = (req.query.type as string) || 'text';
    const target = (req.query.target as string) || 'all';
    const extra = (req.query.extra as any) || {
      format: 'Markdown'
    };
    if (!content || !chatId) {
      res.send({
        error: 'Missing parameters',
        message: "Missing required parameters 'chatId' or 'content'",
      });
      res.end();
      ws.close();
    }
    const data = broadcast(ws, chatId, content, type, extra, target);
    res.send(data);
    res.end();
    ws.close();
  });
});

app.get('/redirect', (req, res) => {
  const ws = new WebSocket(process.env.SERVER);

  ws.on('open', () => {
    init(ws);
    const content = req.query.content;
    const chatId = req.query.chatId;
    const type = req.query.type || 'text';
    const target = req.query.target || 'all';
    const extra = req.query.extra || {};
    const data = broadcast(ws, chatId, content, type, extra, target, true);
    res.send(data);
    ws.close();
  });
});

app.listen(port, () => {
  logger.info(`Polaris REST client running on port ${port}`);
});

const user = {
  id: 'rest',
  firstName: 'rest',
  lastName: null,
  username: 'restful',
  isBot: true,
};

const init = (ws: WebSocket) => {
  const config = JSON.parse(process.env.CONFIG);
  const data: WSInit = {
    bot: user.username,
    platform: 'rest',
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
    platform: 'rest',
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
    bot: 'rest',
    platform: 'rest',
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
