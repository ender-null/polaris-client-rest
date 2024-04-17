import express from 'express';
import WebSocket from 'ws';
import { Conversation, Extra, WSBroadcast, WSInit, WSMessage } from './types';
import { logger, now } from './utils';

logger.debug(`SERVER: ${process.env.SERVER}`);
logger.debug(`CONFIG: ${process.env.CONFIG}`);

process.on('exit', () => {
  logger.warn(`Exit process`);
});

const app = express();
const port = 3000;

app.get('/', (req, res) => {
  const ws = new WebSocket(process.env.SERVER);
  let responseSent = false;

  ws.on('open', () => {
    init(ws);
    const content = req.query.content;
    const chatId = req.query.chatId;
    const type = req.query.type || 'text';
    const extra = req.query.extra || {};
    message(ws, chatId, content, type, extra);
  });

  ws.on('message', (message) => {
    if (!responseSent) {
      logger.info(`Received message from WebSocket server: ${message}`);
      res.send(message);
      responseSent = true;
      ws.close();
    }
  });
});

app.get('/broadcast', (req, res) => {
  const ws = new WebSocket(process.env.SERVER);

  ws.on('open', () => {
    init(ws);
    const content = req.query.content;
    const chatId = req.query.chatId;
    const type = req.query.type || 'text';
    const target = req.query.target || 'all';
    const extra = req.query.extra || {};
    const data = broadcast(ws, chatId, content, type, extra, target);
    res.send(data);
    ws.close();
  });
});

app.listen(port, () => {
  logger.info(`Express server running on port ${port}`);
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
  ws.send(JSON.stringify(data, null, 4));
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
  ws.send(JSON.stringify(data, null, 4));
  return data;
};

const broadcast = (
  ws: WebSocket,
  chatId: string,
  content?: string,
  type: string = 'text',
  extra?: Extra,
  target: string = 'all',
) => {
  const data: WSBroadcast = {
    bot: 'rest',
    platform: 'rest',
    type: 'broadcast',
    target: target,
    message: {
      conversation: new Conversation(chatId),
      content,
      type,
      extra,
    },
  };
  ws.send(JSON.stringify(data, null, 4));
  return data;
};
