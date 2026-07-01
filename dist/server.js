"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const gameEngine_1 = require("./lib/gameEngine");
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});
app.get("/", (req, res) => {
    res.send("Monopoly Deal Server running");
});
const rooms = new Map();
function getRoom(code) {
    return rooms.get(code.toLowerCase());
}
function broadcastGameState(room) {
    if (!room.game)
        return;
    for (const player of room.players) {
        io.to(player.socketId).emit("gameState", {
            game: room.game,
            yourPlayerId: player.id,
        });
    }
}
function broadcastWaiting(room) {
    io.to(room.code).emit("waiting", {
        playerNames: room.players.map(p => p.name),
        roomCode: room.code,
    });
}
io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);
    socket.on("createRoom", ({ roomCode, playerName }) => {
        const code = roomCode.toLowerCase();
        const room = {
            code,
            players: [],
            game: null,
            started: false,
        };
        rooms.set(code, room);
        joinRoom(socket, room, playerName);
    });
    socket.on("joinRoom", ({ roomCode, playerName }) => {
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
    socket.on("startGame", ({ roomCode }) => {
        const room = getRoom(roomCode);
        if (!room || room.players.length < 2)
            return;
        const players = room.players.map(p => (0, gameEngine_1.createPlayer)(p.id, p.name));
        room.game = (0, gameEngine_1.createGame)(players);
        (0, gameEngine_1.startGame)(room.game);
        room.started = true;
        broadcastGameState(room);
    });
    socket.on("gameAction", ({ roomCode, playerId, action }) => {
        const room = getRoom(roomCode);
        if (!room?.game)
            return;
        const game = room.game;
        try {
            switch (action.type) {
                case "startTurn":
                    (0, gameEngine_1.startTurn)(game);
                    break;
                case "endTurn":
                    (0, gameEngine_1.endTurn)(game);
                    break;
                case "discard":
                    (0, gameEngine_1.discard)(game, playerId, action.cardId);
                    break;
                case "bankCards":
                    for (const id of action.cardIds)
                        (0, gameEngine_1.playCardToBank)(game, playerId, id);
                    break;
                case "placePropertyAsNewSet":
                    (0, gameEngine_1.placePropertyAsNewSet)(game, playerId, action.cardId, action.colorOverride);
                    break;
                case "placePropertyIntoSet":
                    (0, gameEngine_1.placePropertyIntoSet)(game, playerId, action.cardId, action.setId);
                    break;
                case "playRentCard":
                    (0, gameEngine_1.playRentCard)(game, playerId, action.cardId, action.setId, action.doubleRentCardId, action.targetPlayerId);
                    break;
                case "playWildRent":
                    (0, gameEngine_1.playWildRent)(game, playerId, action.cardId, action.setId, action.targetPlayerId, action.doubleRentCardId);
                    break;
                case "confirmPayment":
                    (0, gameEngine_1.confirmPayment)(game, playerId, action.cardIds);
                    break;
                case "placePendingProperty":
                    (0, gameEngine_1.placePendingProperty)(game, playerId, action.cardId, action.targetSetId);
                    break;
                case "playPassGo":
                    (0, gameEngine_1.playPassGo)(game, playerId, action.cardId);
                    break;
                case "playItsMyBirthday":
                    (0, gameEngine_1.playItsMyBirthday)(game, playerId, action.cardId);
                    break;
                case "playDebtCollector":
                    (0, gameEngine_1.playDebtCollector)(game, playerId, action.cardId, action.targetPlayerId);
                    break;
                case "playSlyDeal":
                    (0, gameEngine_1.playSlyDeal)(game, playerId, action.cardId, action.targetPlayerId, action.targetSetId, action.targetCardId);
                    break;
                case "playForcedDeal":
                    (0, gameEngine_1.playForcedDeal)(game, playerId, action.cardId, action.targetPlayerId, action.targetSetId, action.targetCardId, action.offeredSetId, action.offeredCardId);
                    break;
                case "playHouse":
                    (0, gameEngine_1.playHouse)(game, playerId, action.cardId, action.setId);
                    break;
                case "playHotel":
                    (0, gameEngine_1.playHotel)(game, playerId, action.cardId, action.setId);
                    break;
                case "movePropertyBetweenSets":
                    (0, gameEngine_1.movePropertyBetweenSets)(game, playerId, action.cardId, action.fromSetId, action.toSetId);
                    break;
                case "moveWildToNewColor":
                    (0, gameEngine_1.moveWildToNewColor)(game, playerId, action.cardId, action.fromSetId, action.newColor);
                    break;
            }
            broadcastGameState(room);
        }
        catch (e) {
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
                }
                else {
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
function joinRoom(socket, room, playerName) {
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
