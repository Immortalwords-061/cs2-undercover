const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const {
    createRoom,
    getRoom,
    addPlayer,
    removePlayer,
    deleteRoom,
    getPublicRoom,
    getMaxPlayers
} = require("./roomManager");

const {
    createGame,
    getPublicGame,
    getPrivatePlayerInfo
} = require("./gameManager");


const app = express();

app.use(cors());


// =========================
// HTTP 测试接口
// =========================

app.get("/", (req, res) => {

    res.json({
        message: "CS2 Undercover Server",
        status: "running"
    });

});


const server =
    http.createServer(app);


// =========================
// Socket.IO
// =========================

const io =
    new Server(server, {

        cors: {

            origin: "*",

            methods: [
                "GET",
                "POST"
            ]

        }

    });


// =========================
// 玩家连接
// =========================

io.on(
    "connection",
    socket => {

        console.log(
            "玩家连接:",
            socket.id
        );


        // =========================
        // 创建房间
        // =========================

        socket.on(
            "create_room",
            ({ name, mode }, callback) => {

                if (!name) {

                    callback({
                        success: false,
                        message: "请输入昵称"
                    });

                    return;
                }


                // 默认还是10人内鬼模式
                // 防止旧客户端出问题

                if (
                    mode !== "TEAM" &&
                    mode !== "UNDERCOVER"
                ) {

                    mode = "UNDERCOVER";

                }


                const room =
                    createRoom(
                        socket.id,
                        name,
                        mode
                    );


                const player = {

                    id: socket.id,

                    name: name

                };


                room.players.push(
                    player
                );


                socket.join(
                    room.code
                );


                socket.roomCode =
                    room.code;


                console.log(
                    `房间 ${room.code} 创建，模式: ${mode}`
                );


                callback({

                    success: true,

                    roomCode:
                        room.code,

                    room:
                        getPublicRoom(
                            room
                        )

                });


                io.to(room.code).emit(
                    "room_update",
                    getPublicRoom(
                        room
                    )
                );

            }
        );


        // =========================
        // 加入房间
        // =========================

        socket.on(
            "join_room",
            ({ code, name }, callback) => {

                if (!name) {

                    callback({
                        success: false,
                        message: "请输入昵称"
                    });

                    return;
                }


                const room =
                    getRoom(code);


                if (!room) {

                    callback({

                        success: false,

                        message:
                            "房间不存在"

                    });

                    return;
                }


                if (
                    room.state !==
                    "WAITING"
                ) {

                    callback({

                        success: false,

                        message:
                            "游戏已经开始，无法加入"

                    });

                    return;
                }


                const result =
                    addPlayer(
                        room,
                        {
                            id: socket.id,
                            name: name
                        }
                    );


                if (!result.success) {

                    callback(result);

                    return;
                }


                socket.join(
                    room.code
                );


                socket.roomCode =
                    room.code;


                callback({

                    success: true,

                    roomCode:
                        room.code,

                    room:
                        getPublicRoom(
                            room
                        )

                });


                io.to(room.code).emit(
                    "room_update",
                    getPublicRoom(
                        room
                    )
                );


                console.log(
                    `${name} 加入房间 ${code}`
                );

            }
        );


        // =========================
        // 开始游戏
        // =========================

        socket.on(
            "start_game",
            () => {

                const room =
                    getRoom(
                        socket.roomCode
                    );


                if (!room) return;


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


                const maxPlayers =
                    getMaxPlayers(room);


                if (
                    room.players.length !==
                    maxPlayers
                ) {

                    socket.emit(
                        "error_message",
                        `当前有 ${room.players.length} 人，需要正好 ${maxPlayers} 人才能开始游戏`
                    );

                    return;
                }


                room.round++;


                const game =
                    createGame(
                        room.players,
                        room.round,
                        room.mode
                    );


                room.games.push(
                    game
                );


                room.currentGame =
                    game;


                room.state =
                    "PLAYING";


                // 给所有人发送公开信息

                io.to(room.code).emit(
                    "game_started",
                    getPublicGame(
                        game,
                        false
                    )
                );


                // =========================
                // 只有内鬼模式需要发送
                // 私人身份信息
                // =========================

                if (
                    room.mode ===
                    "UNDERCOVER"
                ) {

                    room.players.forEach(
                        player => {

                            const info =
                                getPrivatePlayerInfo(
                                    game,
                                    player.id
                                );


                            io.to(
                                player.id
                            ).emit(
                                "private_role",
                                info
                            );

                        }
                    );

                }


                console.log(
                    `房间 ${room.code} 第 ${room.round} 局开始，模式: ${room.mode}`
                );

            }
        );


        // =========================
        // 请求自己的身份
        // =========================

        socket.on(
            "request_private_role",
            () => {

                const room =
                    getRoom(
                        socket.roomCode
                    );


                if (!room) return;


                if (!room.currentGame)
                    return;


                // 8人分组模式没有秘密身份

                if (
                    room.mode ===
                    "TEAM"
                ) {

                    return;

                }


                const info =
                    getPrivatePlayerInfo(
                        room.currentGame,
                        socket.id
                    );


                if (!info) return;


                socket.emit(
                    "private_role",
                    info
                );

            }
        );


        // =========================
        // 结束本局
        // =========================

        socket.on(
            "finish_game",
            () => {

                const room =
                    getRoom(
                        socket.roomCode
                    );


                if (!room) return;


                if (
                    room.hostId !==
                    socket.id
                ) {

                    return;
                }


                if (
                    !room.currentGame
                ) {

                    return;
                }


                room.currentGame.state =
                    "REVEAL";


                room.state =
                    "REVEAL";


                // 游戏结束后公开全部信息

                io.to(room.code).emit(
                    "game_finished",
                    getPublicGame(
                        room.currentGame,
                        true
                    )
                );


                console.log(
                    `房间 ${room.code} 第 ${room.round} 局结束`
                );

            }
        );


        // =========================
        // 下一局
        // =========================

        socket.on(
            "next_round",
            callback => {

                console.log(
                    "收到下一局请求:",
                    socket.id
                );


                const room =
                    getRoom(
                        socket.roomCode
                    );


                if (!room) {

                    if (callback) {

                        callback({
                            success: false,
                            message: "房间不存在"
                        });

                    }

                    return;
                }


                if (
                    room.hostId !==
                    socket.id
                ) {

                    if (callback) {

                        callback({
                            success: false,
                            message:
                                "只有房主可以开始下一局"
                        });

                    }

                    return;
                }


                const maxPlayers =
                    getMaxPlayers(room);


                if (
                    room.players.length !==
                    maxPlayers
                ) {

                    if (callback) {

                        callback({
                            success: false,
                            message:
                                `当前只有 ${room.players.length} 人，必须正好 ${maxPlayers} 个人才能开始下一局`
                        });

                    }

                    return;
                }


                room.round++;


                const game =
                    createGame(
                        room.players,
                        room.round,
                        room.mode
                    );


                room.games.push(
                    game
                );


                room.currentGame =
                    game;


                room.state =
                    "PLAYING";


                // =========================
                // 通知所有玩家：新一局开始
                // =========================

                io.to(room.code).emit(
                    "game_started",
                    getPublicGame(
                        game,
                        false
                    )
                );


                // =========================
                // 只有10人内鬼模式
                // 才发送秘密身份
                // =========================

                if (
                    room.mode ===
                    "UNDERCOVER"
                ) {

                    room.players.forEach(
                        player => {

                            const info =
                                getPrivatePlayerInfo(
                                    game,
                                    player.id
                                );


                            io.to(
                                player.id
                            ).emit(
                                "private_role",
                                info
                            );

                        }
                    );

                }


                console.log(
                    `房间 ${room.code} 第 ${room.round} 局开始，模式: ${room.mode}`
                );


                // =========================
                // 告诉房主：成功
                // =========================

                if (callback) {

                    callback({
                        success: true,
                        round: room.round
                    });

                }

            }
        );


        // =========================
        // 玩家断开
        // =========================

        socket.on(
            "disconnect",
            () => {

                console.log(
                    "玩家断开:",
                    socket.id
                );


                const room =
                    getRoom(
                        socket.roomCode
                    );


                if (!room) return;


                removePlayer(
                    room,
                    socket.id
                );


                // 房主断开

                if (
                    room.hostId ===
                    socket.id
                ) {

                    if (
                        room.players.length >
                        0
                    ) {

                        room.hostId =
                            room.players[0].id;


                        room.hostName =
                            room.players[0].name;

                    }

                }


                // 房间没人了

                if (
                    room.players.length ===
                    0
                ) {

                    deleteRoom(
                        room.code
                    );


                    console.log(
                        `房间 ${room.code} 已删除`
                    );


                    return;
                }


                io.to(room.code).emit(
                    "room_update",
                    getPublicRoom(
                        room
                    )
                );

            }
        );

    }
);


// =========================
// 启动服务器
// =========================

const PORT =
    process.env.PORT || 3000;


server.listen(
    PORT,
    () => {

        console.log(
            "================================"
        );

        console.log(
            "CS2 Undercover Server"
        );

        console.log(
            `Server Running: http://localhost:${PORT}`
        );

        console.log(
            "================================"
        );

    }
);