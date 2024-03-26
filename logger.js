const winston = require('winston');
const { createLogger, transports, format } = winston;
const DailyRotateFile = require('winston-daily-rotate-file');

const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.printf(info => `[${info.timestamp}] ${info.level}: ${info.message}`)
  ),
  transports: [
    new transports.Console(),
    new DailyRotateFile({
      filename: 'D:/HttEpaper_Logs/CompressPdf_Node/%DATE%.log', // The logs will be rotated daily
      datePattern: 'YYYY-MM-DD',
    //   maxSize: '20m', // Maximum size of each log file
    //   maxFiles: '14d' // Maximum number of days to keep logs
    })
  ]
});

module.exports = logger;
