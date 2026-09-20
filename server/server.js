const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const {
    createRoom,
    getRoom,
    deleteRoom,
    addPlayer,
    removePlayer,
    getPublicRoom,
    getMaxPlayers
} = require("./roomManager");

const {
    createGame,
    getPublicGame,
    getPrivatePlayerInfo
} = require("./gameManager");

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
    res.json({
        message: "CS2 Undercover Server",
        status: "running"
    });
});

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT =
    process.env.PORT || 3000;

/*
 * 同步当前游戏中的玩家 socket ID
 *
 * 玩家刷新网页后，
 * socket.id 会发生变化。
 *
 * 所以需要根据玩家昵称
 * 找到旧的游戏玩家并更新 ID。
 */
function syncGamePlayerSocketId(
    room,
    name,
    newSocketId
) {
    if (!room.currentGame) {
        return;
    }

    const gamePlayer =
        room.currentGame.players.find(
            player =>
                player.name === name
        );

    if (gamePlayer) {
        gamePlayer.id =
            newSocketId;
    }
}

/*
 * 给重新连接的玩家
 * 恢复当前游戏状态
 */
function sendCurrentGameToSocket(
    socket,
    room
) {
    if (!room.currentGame) {
        return;
    }

    /*
     * 游戏进行中
     */
    if (room.state === "PLAYING") {
        socket.emit(
            "game_started",
            getPublicGame(
                room.currentGame,
                false
            )
        );

        /*
         * 只有内鬼模式
         * 才发送私人身份信息
         */
        if (
            room.mode ===
            "UNDERCOVER"
        ) {
            const info =
                getPrivatePlayerInfo(
                    room.currentGame,
                    socket.id
                );

            if (info) {
                socket.emit(
                    "private_role",
                    info
                );
            }
        }
    }

    /*
     * 游戏已经结束，
     * 正在显示身份
     */
    if (room.state === "REVEAL") {
        socket.emit(
            "game_finished",
            getPublicGame(
                room.currentGame,
                true
            )
        );
    }
}

io.on("connection", socket => {
    console.log(
        "玩家连接:",
        socket.id
    );

    /*
     * =========================
     * 创建房间
     * =========================
     */
    socket.on(
        "create_room",
        data => {
            try {
                const {
                    name,
                    mode,
                    maxPlayers
                } = data || {};

                if (
                    !name ||
                    !name.trim()
                ) {
                    socket.emit(
                        "error_message",
                        "请输入昵称"
                    );
                    return;
                }

                const playerName =
                    name.trim();

                /*
                 * 人数必须 6~16
                 */
                const count =
                    Number(maxPlayers);

                if (
                    !Number.isInteger(
                        count
                    ) ||
                    count < 6 ||
                    count > 16
                ) {
                    socket.emit(
                        "error_message",
                        "游戏人数必须选择6到16人"
                    );
                    return;
                }

                const room =
                    createRoom(
                        socket.id,
                        playerName,
                        mode,
                        count
                    );

                /*
                 * 创建房主玩家
                 */
                room.players.push({
                    id: socket.id,
                    name: playerName,
                    team: null,
                    role: null,
                    task: null
                });

                socket.roomCode =
                    room.code;

                socket.playerName =
                    playerName;

                socket.join(
                    room.code
                );

                socket.emit(
                    "room_created",
                    getPublicRoom(room)
                );

                io.to(room.code).emit(
                    "room_update",
                    getPublicRoom(room)
                );

                console.log(
                    `房间创建成功: ${room.code}, ` +
                    `模式: ${room.mode}, ` +
                    `人数: ${room.maxPlayers}`
                );
            } catch (error) {
                console.error(
                    "create_room 错误:",
                    error
                );

                socket.emit(
                    "error_message",
                    "创建房间失败"
                );
            }
        }
    );

    /*
     * =========================
     * 自动重连
     * =========================
     *
     * 玩家刷新网页以后，
     * socket.id 会改变。
     *
     * 前端会把原来的昵称
     * 和房间号重新发送过来。
     */
    socket.on(
        "rejoin_room",
        data => {
            try {
                const {
                    roomCode,
                    name
                } = data || {};

                if (
                    !roomCode ||
                    !name
                ) {
                    socket.emit(
                        "rejoin_failed",
                        "缺少房间号或昵称"
                    );
                    return;
                }

                const room =
                    getRoom(roomCode);

                if (!room) {
                    socket.emit(
                        "rejoin_failed",
                        "房间不存在，可能已经关闭"
                    );
                    return;
                }

                const player =
                    room.players.find(
                        p =>
                            p.name ===
                            name
                    );

                if (!player) {
                    socket.emit(
                        "rejoin_failed",
                        "房间中没有找到这个玩家"
                    );
                    return;
                }

                /*
                 * 更新 socket ID
                 */
                player.id =
                    socket.id;

                socket.roomCode =
                    room.code;

                socket.playerName =
                    player.name;

                socket.join(
                    room.code
                );

                /*
                 * 如果这个玩家原本是房主，
                 * 恢复房主身份
                 */
                if (
                    room.hostName ===
                    player.name
                ) {
                    room.hostId =
                        socket.id;
                }

                /*
                 * 更新当前游戏里的 ID
                 */
                syncGamePlayerSocketId(
                    room,
                    player.name,
                    socket.id
                );

                socket.emit(
                    "rejoin_success",
                    getPublicRoom(room)
                );

                io.to(room.code).emit(
                    "room_update",
                    getPublicRoom(room)
                );

                /*
                 * 如果游戏已经开始，
                 * 恢复游戏画面
                 */
                sendCurrentGameToSocket(
                    socket,
                    room
                );

                console.log(
                    `玩家重连成功: ${player.name}, ` +
                    `房间: ${room.code}`
                );
            } catch (error) {
                console.error(
                    "rejoin_room 错误:",
                    error
                );

                socket.emit(
                    "rejoin_failed",
                    "重新连接失败"
                );
            }
        }
    );

    /*
     * =========================
     * 加入房间
     * =========================
     */
    socket.on(
        "join_room",
        data => {
            try {
                const {
                    roomCode,
                    name
                } = data || {};

                if (
                    !roomCode ||
                    !name ||
                    !name.trim()
                ) {
                    socket.emit(
                        "error_message",
                        "请输入房间号和昵称"
                    );
                    return;
                }

                const code =
                    roomCode.trim();

                const playerName =
                    name.trim();

                const room =
                    getRoom(code);

                if (!room) {
                    socket.emit(
                        "error_message",
                        "房间不存在"
                    );
                    return;
                }

                /*
                 * 如果玩家已经存在，
                 * 说明可能是刷新页面后的重新进入。
                 */
                const existingPlayer =
                    room.players.find(
                        player =>
                            player.name ===
                            playerName
                    );

                if (existingPlayer) {
                    existingPlayer.id =
                        socket.id;

                    socket.roomCode =
                        room.code;

                    socket.playerName =
                        existingPlayer.name;

                    socket.join(
                        room.code
                    );

                    if (
                        room.hostName ===
                        existingPlayer.name
                    ) {
                        room.hostId =
                            socket.id;
                    }

                    syncGamePlayerSocketId(
                        room,
                        existingPlayer.name,
                        socket.id
                    );

                    socket.emit(
                        "join_success",
                        getPublicRoom(room)
                    );

                    io.to(room.code).emit(
                        "room_update",
                        getPublicRoom(room)
                    );

                    sendCurrentGameToSocket(
                        socket,
                        room
                    );

                    console.log(
                        `玩家重新加入: ${playerName}, ` +
                        `房间: ${room.code}`
                    );

                    return;
                }

                /*
                 * 新玩家只能加入等待中的房间
                 */
                if (
                    room.state !==
                    "WAITING"
                ) {
                    socket.emit(
                        "error_message",
                        "游戏已经开始，无法加入新玩家"
                    );
                    return;
                }

                const result =
                    addPlayer(
                        room,
                        {
                            id: socket.id,
                            name: playerName,
                            team: null,
                            role: null,
                            task: null
                        }
                    );

                if (!result.success) {
                    socket.emit(
                        "error_message",
                        result.message
                    );
                    return;
                }

                socket.roomCode =
                    room.code;

                socket.playerName =
                    playerName;

                socket.join(
                    room.code
                );

                socket.emit(
                    "join_success",
                    getPublicRoom(room)
                );

                io.to(room.code).emit(
                    "room_update",
                    getPublicRoom(room)
                );

                console.log(
                    `玩家加入: ${playerName}, ` +
                    `房间: ${room.code}`
                );
            } catch (error) {
                console.error(
                    "join_room 错误:",
                    error
                );

                socket.emit(
                    "error_message",
                    "加入房间失败"
                );
            }
        }
    );

    /*
     * =========================
     * 开始游戏
     * =========================
     */
    socket.on(
        "start_game",
        () => {
            try {
                const roomCode =
                    socket.roomCode;

                const room =
                    getRoom(roomCode);

                if (!room) {
                    socket.emit(
                        "error_message",
                        "房间不存在"
                    );
                    return;
                }

                /*
                 * 只有房主可以开始
                 */
                if (
                    room.hostId !==
                    socket.id
                ) {
                    socket.emit(
                        "error_message",
                        "只有房主可以开始游戏"
                    );
                    return;
                }

                if (
                    room.state !==
                    "WAITING"
                ) {
                    socket.emit(
                        "error_message",
                        "游戏已经开始"
                    );
                    return;
                }

                const maxPlayers =
                    getMaxPlayers(room);

                /*
                 * 必须达到指定人数
                 */
                if (
                    room.players.length !==
                    maxPlayers
                ) {
                    socket.emit(
                        "error_message",
                        `需要 ${maxPlayers} 人才能开始游戏，目前有 ${room.players.length} 人`
                    );
                    return;
                }

                room.round = 1;

                room.currentGame =
                    createGame(
                        room.players,
                        room.round,
                        room.mode
                    );

                room.state =
                    "PLAYING";

                /*
                 * 公开信息
                 */
                io.to(room.code).emit(
                    "game_started",
                    getPublicGame(
                        room.currentGame,
                        false
                    )
                );

                /*
                 * 私人身份
                 */
                if (
                    room.mode ===
                    "UNDERCOVER"
                ) {
                    room.players.forEach(
                        player => {
                            const playerSocket =
                                io.sockets.sockets.get(
                                    player.id
                                );

                            if (
                                !playerSocket
                            ) {
                                return;
                            }

                            const info =
                                getPrivatePlayerInfo(
                                    room.currentGame,
                                    player.id
                                );

                            if (info) {
                                playerSocket.emit(
                                    "private_role",
                                    info
                                );
                            }
                        }
                    );
                }

                console.log(
                    `游戏开始: ${room.code}, ` +
                    `第 ${room.round} 局, ` +
                    `模式: ${room.mode}, ` +
                    `人数: ${room.players.length}`
                );
            } catch (error) {
                console.error(
                    "start_game 错误:",
                    error
                );

                socket.emit(
                    "error_message",
                    "开始游戏失败"
                );
            }
        }
    );

    /*
     * =========================
     * 结束游戏
     * =========================
     */
    socket.on(
        "finish_game",
        () => {
            try {
                const roomCode =
                    socket.roomCode;

                const room =
                    getRoom(roomCode);

                if (!room) {
                    socket.emit(
                        "error_message",
                        "房间不存在"
                    );
                    return;
                }

                if (
                    room.hostId !==
                    socket.id
                ) {
                    socket.emit(
                        "error_message",
                        "只有房主可以结束游戏"
                    );
                    return;
                }

                if (
                    room.state !==
                    "PLAYING"
                ) {
                    socket.emit(
                        "error_message",
                        "当前不是进行中的游戏"
                    );
                    return;
                }

                room.state =
                    "REVEAL";

                if (
                    room.currentGame
                ) {
                    room.currentGame.state =
                        "REVEAL";
                }

                io.to(room.code).emit(
    "room_update",
    getPublicRoom(room)
);

io.to(room.code).emit(
    "game_finished",
    getPublicGame(
        room.currentGame,
        true
    )
);

                console.log(
                    `游戏结束: ${room.code}`
                );
            } catch (error) {
                console.error(
                    "finish_game 错误:",
                    error
                );

                socket.emit(
                    "error_message",
                    "结束游戏失败"
                );
            }
        }
    );

    /*
     * =========================
     * 下一局
     * =========================
     */
    socket.on(
        "next_round",
        () => {
            try {
                const roomCode =
                    socket.roomCode;

                const room =
                    getRoom(roomCode);

                if (!room) {
                    socket.emit(
                        "error_message",
                        "房间不存在"
                    );
                    return;
                }

                if (
                    room.hostId !==
                    socket.id
                ) {
                    socket.emit(
                        "error_message",
                        "只有房主可以开始下一局"
                    );
                    return;
                }

                if (
                    room.state !==
                    "REVEAL"
                ) {
                    socket.emit(
                        "error_message",
                        "当前不能开始下一局"
                    );
                    return;
                }

                const maxPlayers =
                    getMaxPlayers(room);

                /*
                 * 下一局之前检查人数
                 */
                if (
                    room.players.length !==
                    maxPlayers
                ) {
                    socket.emit(
                        "error_message",
                        `需要 ${maxPlayers} 人才能开始下一局`
                    );
                    return;
                }

                room.round += 1;

                room.currentGame =
                    createGame(
                        room.players,
                        room.round,
                        room.mode
                    );

                room.state =
                    "PLAYING";

                /*
                 * 公开游戏信息
                 */
                io.to(room.code).emit(
                    "game_started",
                    getPublicGame(
                        room.currentGame,
                        false
                    )
                );

                /*
                 * 私人信息
                 */
                if (
                    room.mode ===
                    "UNDERCOVER"
                ) {
                    room.players.forEach(
                        player => {
                            const playerSocket =
                                io.sockets.sockets.get(
                                    player.id
                                );

                            if (
                                !playerSocket
                            ) {
                                return;
                            }

                            const info =
                                getPrivatePlayerInfo(
                                    room.currentGame,
                                    player.id
                                );

                            if (info) {
                                playerSocket.emit(
                                    "private_role",
                                    info
                                );
                            }
                        }
                    );
                }

                io.to(room.code).emit(
                    "room_update",
                    getPublicRoom(room)
                );

                console.log(
                    `下一局开始: ${room.code}, ` +
                    `第 ${room.round} 局`
                );
            } catch (error) {
                console.error(
                    "next_round 错误:",
                    error
                );

                socket.emit(
                    "error_message",
                    "开始下一局失败"
                );
            }
        }
    );

    /*
     * =========================
     * 断开连接
     * =========================
     *
     * 不立即删除玩家。
     *
     * 给玩家 15 秒时间刷新网页、
     * 网络恢复或者重新连接。
     */
    socket.on(
        "disconnect",
        () => {
            console.log(
                "玩家断开:",
                socket.id
            );

            const roomCode =
                socket.roomCode;

            if (!roomCode) {
                return;
            }

            const room =
                getRoom(roomCode);

            if (!room) {
                return;
            }

            const playerName =
                socket.playerName;

            setTimeout(() => {
                const currentRoom =
                    getRoom(roomCode);

                if (!currentRoom) {
                    return;
                }

                /*
                 * 如果玩家已经重新连接，
                 * 新 socket ID 已经不同，
                 * 此时不要删除。
                 */
                const stillSameSocket =
                    currentRoom.players.some(
                        player =>
                            player.name ===
                                playerName &&
                            player.id ===
                                socket.id
                    );

                if (!stillSameSocket) {
                    return;
                }

                /*
                 * 删除玩家
                 */
                removePlayer(
                    currentRoom,
                    socket.id
                );

                /*
                 * 如果房主掉线，
                 * 可以把房主身份交给
                 * 当前第一个玩家。
                 */
                if (
                    currentRoom.hostId ===
                    socket.id
                ) {
                    if (
                        currentRoom.players.length >
                        0
                    ) {
                        currentRoom.hostId =
                            currentRoom.players[0].id;

                        currentRoom.hostName =
                            currentRoom.players[0].name;
                    } else {
                        deleteRoom(
                            roomCode
                        );

                        return;
                    }
                }

                io.to(roomCode).emit(
                    "room_update",
                    getPublicRoom(
                        currentRoom
                    )
                );

                console.log(
                    `玩家移除: ${playerName}, ` +
                    `房间: ${roomCode}`
                );
            }, 15000);
        }
    );
});

server.listen(
    PORT,
    () => {
        console.log(
            `服务器启动成功，端口: ${PORT}`
        );
    }
);