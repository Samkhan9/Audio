// signaling-server.js
const WebSocket = require("ws");
const PORT = process.env.PORT || 8080;

const wss = new WebSocket.Server({ port: PORT });
console.log("Signaling server starting on port", PORT);

// rooms: { roomId: Set<WebSocket> }
const rooms = new Map();

function broadcastToRoom(roomId, sender, data) {
  const set = rooms.get(roomId);
  if (!set) return;
  for (const client of set) {
    if (client !== sender && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  }
}

wss.on("connection", (ws) => {
  ws.roomId = null;
  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }

    // Expected messages:
    // { type: "join", room: "room1" }
    // { type: "offer" | "answer" | "ice", room: "room1", payload: {...} }

    if (msg.type === "join" && msg.room) {
      const room = msg.room;
      ws.roomId = room;
      if (!rooms.has(room)) rooms.set(room, new Set());
      rooms.get(room).add(ws);
      // Optionally send back current participant count
      ws.send(JSON.stringify({ type: "joined", room, peers: rooms.get(room).size }));
      return;
    }

    if (!msg.room || !msg.type) return;
    // Forward signaling message to other clients in same room
    const forward = { type: msg.type, payload: msg.payload || null };
    broadcastToRoom(msg.room, ws, forward);
  });

  ws.on("close", () => {
    const room = ws.roomId;
    if (room && rooms.has(room)) {
      rooms.get(room).delete(ws);
      if (rooms.get(room).size === 0) rooms.delete(room);
    }
  });
});

process.on('SIGINT', ()=> process.exit(0));
