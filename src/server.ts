import express from "express";
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import {
  createGame,
  createPlayer,
  startGame,
  startTurn,
  endTurn,
  discard,
  playCardToBank,
  placePropertyAsNewSet,
  placePropertyIntoSet,
  playRentCard,
  confirmPayment,
  placePendingProperty,
  playPassGo,
  playItsMyBirthday,
  playDebtCollector,
  playSlyDeal,
  playForcedDeal,
  playHouse,
  playHotel,
  movePropertyBetweenSets,
  moveWildToNewColor,
  playWildRent,
} from "./lib/gameEngine";
import { Game } from "./types/game";
import { PropertyColor } from "./types/card";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.get("/", (req, res) => {
  res.send("Monopoly Deal Server running");
});

interface RoomPlayer {
  id: string;
  name: string;
  socketId: string;
}

interface Room {
  code: string;
  players: RoomPlayer[];
  game: Game | null;
  started: boolean;
}

const rooms = new Map<string, Room>();

function getRoom(code: string): Room | undefined {
  return rooms.get(code.toLowerCase());
}

function broadcastGameState(room: Room) {
  if (!room.game) return;
  for (const player of room.players) {
    io.to(player.socketId).emit("gameState", {
      game: room.game,
      yourPlayerId: player.id,
    });
  }
}

function broadcastWaiting(room: Room) {
  io.to(room.code).emit("waiting", {
    playerNames: room.players.map(p => p.name),
    roomCode: room.code,
  });
}

io.on("connection", (socket: Socket) => {
  console.log("Client connected:", socket.id);

  socket.on("createRoom", ({ roomCode, playerName }: { roomCode: string; playerName: string }) => {
    const code = roomCode.toLowerCase();
    const room: Room = {
      code,
      players: [],
      game: null,
      started: false,
    };
    rooms.set(code, room);
    joinRoom(socket, room, playerName);
  });

  socket.on("joinRoom", ({ roomCode, playerName }: { roomCode: string; playerName: string }) => {
    const code = roomCode.toLowerCase();
    const room = getRoom(code);
    if (!room) {
      socket.emit("error", { message: "Room not found" });
      return;
    }
    if (room.started) {
      socket.emit("error", { message: "Game already started" });
      return;
    }
    if (room.players.length >= 5) {
      socket.emit("error", { message: "Room is full" });
      return;
    }
    joinRoom(socket, room, playerName);
  });

  socket.on("startGame", ({ roomCode }: { roomCode: string }) => {
    const room = getRoom(roomCode);
    if (!room || room.players.length < 2) return;
    const players = room.players.map(p => createPlayer(p.id, p.name));
    room.game = createGame(players);
    startGame(room.game);
    room.started = true;
    broadcastGameState(room);
  });

  socket.on("gameAction", ({ roomCode, playerId, action }: {
    roomCode: string;
    playerId: string;
    action: any;
  }) => {
    const room = getRoom(roomCode);
    if (!room?.game) return;
    const game = room.game;

    try {
      switch (action.type) {
        case "startTurn": startTurn(game); break;
        case "endTurn": endTurn(game); break;
        case "discard": discard(game, playerId, action.cardId); break;
        case "bankCards":
          for (const id of action.cardIds) playCardToBank(game, playerId, id);
          break;
        case "placePropertyAsNewSet":
          placePropertyAsNewSet(game, playerId, action.cardId, action.colorOverride);
          break;
        case "placePropertyIntoSet":
          placePropertyIntoSet(game, playerId, action.cardId, action.setId);
          break;
        case "playRentCard":
          playRentCard(game, playerId, action.cardId, action.setId, action.doubleRentCardId, action.targetPlayerId);
          break;
        case "playWildRent":
          playWildRent(game, playerId, action.cardId, action.setId, action.targetPlayerId, action.doubleRentCardId);
          break;
        case "confirmPayment":
          confirmPayment(game, playerId, action.cardIds);
          break;
        case "placePendingProperty":
          placePendingProperty(game, playerId, action.cardId, action.targetSetId);
          break;
        case "playPassGo":
          playPassGo(game, playerId, action.cardId);
          break;
        case "playItsMyBirthday":
          playItsMyBirthday(game, playerId, action.cardId);
          break;
        case "playDebtCollector":
          playDebtCollector(game, playerId, action.cardId, action.targetPlayerId);
          break;
        case "playSlyDeal":
          playSlyDeal(game, playerId, action.cardId, action.targetPlayerId, action.targetSetId, action.targetCardId);
          break;
        case "playForcedDeal":
          playForcedDeal(game, playerId, action.cardId, action.targetPlayerId, action.targetSetId, action.targetCardId, action.offeredSetId, action.offeredCardId);
          break;
        case "playHouse":
          playHouse(game, playerId, action.cardId, action.setId);
          break;
        case "playHotel":
          playHotel(game, playerId, action.cardId, action.setId);
          break;
        case "movePropertyBetweenSets":
          movePropertyBetweenSets(game, playerId, action.cardId, action.fromSetId, action.toSetId);
          break;
        case "moveWildToNewColor":
          moveWildToNewColor(game, playerId, action.cardId, action.fromSetId, action.newColor as PropertyColor);
          break;
      }
      broadcastGameState(room);
    } catch (e: any) {
      socket.emit("error", { message: e.message });
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
    // Find which room this socket was in
    for (const [code, room] of rooms.entries()) {
      const playerIdx = room.players.findIndex(p => p.socketId === socket.id);
      if (playerIdx !== -1) {
        const player = room.players[playerIdx];
        room.players.splice(playerIdx, 1);
        socket.leave(code);

        if (room.started && room.game) {
          // End game — player disconnected
          io.to(code).emit("playerDisconnected", { playerName: player.name });
        } else {
          broadcastWaiting(room);
        }

        // Clean up empty rooms
        if (room.players.length === 0) {
          rooms.delete(code);
        }
        break;
      }
    }
  });
});

function joinRoom(socket: Socket, room: Room, playerName: string) {
  const playerId = `p${room.players.length + 1}`;
  room.players.push({
    id: playerId,
    name: playerName,
    socketId: socket.id,
  });
  socket.join(room.code);
  broadcastWaiting(room);
}

const PORT = process.env.PORT ?? 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});