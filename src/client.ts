import express from 'express';
import WebSocket from 'ws';
import { Conversation, Extra, WSBroadcast, WSInit } from './types';
import { logger } from './utils';

logger.debug(`SERVER: ${process.env.SERVER}`);
logger.debug(`CONFIG: ${process.env.CONFIG}`);

process.on('exit', () => {
  logger.warn(`Exit process`);
});

const app = express();
const port = 3000;

app.get('/broadcast', (req, res) => {
  const ws = new WebSocket(process.env.SERVER);
  let responseSent = false;

  ws.on('open', () => {
    init(ws);
    const chatId = req.query.chatId;
    const content = req.query.content;
    const type = req.query.type || 'text';
    const target = req.query.target || 'all';
    const extra = req.query.extra || {};
    broadcast(ws, chatId, content, type, extra, target);
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

app.listen(port, () => {
  logger.info(`Express server running on port ${port}`);
});

const init = (ws: WebSocket) => {
  const user = {
    id: 'rest',
    firstName: 'rest',
    lastName: null,
    username: 'restful',
    isBot: true,
  };
  const config = JSON.parse(process.env.CONFIG);
  const data: WSInit = {
    bot: user.username,
    platform: 'rest',
    type: 'init',
    user: user,
    config: config,
  };
  ws.send(JSON.stringify(data, null, 4));
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
};
