const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: process.env.ALLOWED_ORIGIN || false } });

app.use(express.static(path.join(__dirname, "public")));
app.get("/health", (_req, res) => res.json({ ok: true, service: "burzai-poker-demo" }));

// Multiplayer transport scaffold only; poker rules and account auth must be implemented server-side.
const rooms = new Map();
io.on("connection", (socket) => {
  socket.emit("notice", { message: "BURZAI demo server-д холбогдлоо." });

  socket.on("room:join", ({ roomId, username }) => {
    if (typeof roomId !== "string" || !/^[a-zA-Z0-9_-]{1,32}$/.test(roomId)) {
      socket.emit("room:error", { message: "Өрөөний ID буруу байна." });
      return;
    }
    const safeName = (typeof username === "string" ? username : "Guest").replace(/[<>]/g, "").slice(0, 20);
    socket.join(roomId);
    if (!rooms.has(roomId)) rooms.set(roomId, new Map());
    rooms.get(roomId).set(socket.id, { username: safeName, socketId: socket.id });
    io.to(roomId).emit("room:players", Array.from(rooms.get(roomId).values()).map(p => ({ username: p.username })));
    socket.emit("room:joined", { roomId, username: safeName, note: "Энэ нь зөвхөн multiplayer холболтын scaffold." });
  });

  socket.on("room:chat", ({ roomId, message }) => {
    if (typeof roomId !== "string" || typeof message !== "string") return;
    const clean = message.replace(/[<>]/g, "").trim().slice(0, 300);
    if (!clean || !rooms.has(roomId) || !rooms.get(roomId).has(socket.id)) return;
    const user = rooms.get(roomId).get(socket.id).username;
    io.to(roomId).emit("room:chat", { username: user, message: clean, at: Date.now() });
  });

  socket.on("disconnect", () => {
    for (const [roomId, players] of rooms) {
      if (players.delete(socket.id)) {
        io.to(roomId).emit("room:players", Array.from(players.values()).map(p => ({ username: p.username })));
        if (players.size === 0) rooms.delete(roomId);
      }
    }
  });
});

const port = Number(process.env.PORT || 3000);
server.listen(port, () => console.log(`BURZAI demo server listening on :${port}`));
