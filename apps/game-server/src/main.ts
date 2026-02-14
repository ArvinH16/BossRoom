import http from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';

const PORT = parseInt(process.env['PORT'] || '8080', 10);

const server = http.createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('BossRoom Game Server');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws: WebSocket) => {
  console.log('Client connected');

  ws.on('message', (data: Buffer) => {
    // TODO: Parse ClientMessage, route to handlers
    const raw = data.toString();
    console.log('Received:', raw);
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

server.listen(PORT, () => {
  console.log(`Game server listening on port ${PORT}`);
});
