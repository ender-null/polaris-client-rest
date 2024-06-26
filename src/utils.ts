import fs from 'fs';
import { FileResult, fileSync } from 'tmp';
import winston, { createLogger, transports, format as winstonFormat } from 'winston';
import 'winston-daily-rotate-file';

export const catchException = (exception: Error): Error => {
  logger.error(`Catch exception: ${exception.message}`);
  return exception;
};

export const replaceHtml = (text: string): string => {
  if (text) {
    text = text.replace(new RegExp('<', 'gim'), '&lt;');
    text = text.replace(new RegExp('>', 'gim'), '&gt;');
  }
  return text;
};

export const htmlToMarkdown = (text: string): string => {
  if (text) {
    text = text.replace(new RegExp('<a href="(.*?)">(.*?)</a>', 'gim'), '[$2]($1)');
    text = text.replace(new RegExp('<i>(.*?)</i>', 'gim'), '_$1_');
    text = text.replace(new RegExp('<b>(.*?)</b>', 'gim'), '*$1*');
    text = text.replace(new RegExp('<u>(.*?)</u>', 'gim'), '~$1~');
    text = text.replace(new RegExp('<code>(.*?)</code>', 'gim'), '`$1`');
    text = text.replace(new RegExp('<pre>(.*?)</pre>', 'gim'), '```$1```');

    text = text.replace(new RegExp('&lt;', 'gim'), '<');
    text = text.replace(new RegExp('&gt;', 'gim'), '>');
  }
  return text;
};

export const isInt = (number: number | string): boolean => {
  if (typeof number == 'number') {
    return true;
  } else if (typeof number != 'string') {
    return false;
  }
  return !isNaN(parseFloat(number));
};

export const now = (): number => {
  return new Date().getTime() / 1000;
};

export const splitLargeMessage = (content: string, maxLength: number): string[] => {
  const lineBreak = '\n';
  const texts = [];
  if (content) {
    const lines = content.split(lineBreak);
    let text = '';

    lines.map((line) => {
      if (text.length + line.length + lineBreak.length < maxLength) {
        text += line + lineBreak;
      } else {
        texts.push(text);
        text = line + lineBreak;
      }
    });
    texts.push(text);
  }
  return texts;
};

export const toBase64 = (filePath): Promise<string> => {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, (err, data) => {
      if (err) {
        reject(err);
        return;
      }
      const base64String = data.toString('base64');
      resolve(base64String);
    });
  });
};

export const fromBase64 = (base64String): Promise<FileResult> => {
  return new Promise((resolve, reject) => {
    const bufferData = Buffer.from(base64String, 'base64');
    const file: FileResult = fileSync({ mode: 0o644 });
    fs.writeFile(file.name, bufferData, (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(file);
    });
  });
};

export const loggerFormat = winstonFormat.printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message} `;
  if (metadata && Object.keys(metadata).length > 0) {
    msg += JSON.stringify(metadata);
  }
  return msg;
});

export const transport = new winston.transports.DailyRotateFile({
  dirname: 'logs',
  filename: 'polaris-client-rest-%DATE%.log',
  datePattern: 'YYYY-MM-DD-HH',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '7d',
});

// Configure logger
export const logger = createLogger({
  level: 'info',
  format: winstonFormat.combine(winstonFormat.timestamp(), winstonFormat.json()),
  transports: [
    new transports.Console({
      format: winstonFormat.combine(
        winstonFormat.colorize(),
        winstonFormat.timestamp({
          format: 'HH:mm:ss',
        }),
        loggerFormat,
      ),
    }),
    transport,
  ],
});
