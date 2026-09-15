const { createServer } = require('http');
const next = require('next');

const port = process.env.PORT || 3000;
const app = next({ dev: false, dir: __dirname });
const handle = app.getRequestHandler();

process.on('uncaughtException', (err) => {
  console.error('uncaughtException', err);
});
process.on('unhandledRejection', (err) => {
  console.error('unhandledRejection', err);
});

app.prepare().then(() => {
  createServer((req, res) => {
    handle(req, res).catch((err) => {
      console.error('request handler error', err);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end('Internal Server Error');
      }
    });
  }).listen(port, () => {
    console.log(`Ready on port ${port}`);
  });
});
