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
        // Socket 重连恢复房间
        // =========================

// =========================
// 加入房间 / 重新进入游戏
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


        // =========================
        // 检查这个玩家是不是已经在房间里
        // =========================

        const existingPlayer =
            room.players.find(
                player =>
                    player.name === name
            );


        // =========================
        // 已经在房间里
        // =========================
        // 这种情况可能是：
        //
        // 1. 浏览器刷新
        // 2. Socket 重连
        // 3. 手机切后台
        // 4. 网络断线
        //
        // 无论游戏是否已经开始
        // 都允许恢复
        // =========================

        if (existingPlayer) {

            const oldSocketId =
                existingPlayer.id;


            // 更新 Socket ID

            existingPlayer.id =
                socket.id;


            // 记录房间

            socket.roomCode =
                room.code;


            // 重新加入 Socket.IO 房间

            socket.join(
                room.code
            );


            // 如果是房主
            // 恢复房主身份

            if (
                room.hostName ===
                name
            ) {

                room.hostId =
                    socket.id;

            }


            console.log(
                `玩家 ${name} 重新进入房间 ${room.code}`
            );


            callback({

                success: true,

                room:
                    getPublicRoom(
                        room
                    ),

                rejoined: true

            });


            // =========================
            // 通知房间其他玩家
            // =========================

            io.to(room.code).emit(
                "room_update",
                getPublicRoom(
                    room
                )
            );


            // =========================
            // 如果游戏正在进行
            // 直接恢复当前游戏
            // =========================

            if (
                room.currentGame &&
                room.state ===
                    "PLAYING"
            ) {

                console.log(
                    `恢复玩家 ${name} 到第 ${room.currentGame.round} 局`
                );


                // 发送当前游戏

                socket.emit(
                    "game_started",
                    getPublicGame(
                        room.currentGame,
                        false
                    )
                );


                // =========================
                // 10人内鬼模式
                // 重新发送秘密身份
                // =========================

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


            // =========================
            // 如果游戏已经结束
            // =========================

            if (
                room.currentGame &&
                room.state ===
                    "REVEAL"
            ) {

                socket.emit(
                    "game_finished",
                    getPublicGame(
                        room.currentGame,
                        true
                    )
                );

            }


            return;
        }


        // =========================
        // 新玩家
        // =========================

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


        // =========================
        // 正常加入新玩家
        // =========================

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

            room:
                getPublicRoom(
                    room
                ),

            rejoined: false

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


                // 默认10人内鬼模式
                // 防止旧客户端出问题

                if (
                    mode !== "TEAM" &&
                    mode !== "UNDERCOVER"
                ) {

                    mode =
                        "UNDERCOVER";

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
                // 只有10人内鬼模式需要
                // 发送私人身份信息
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


                if (!room.currentGame) {
                    return;
                }


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

                console.log(
                    "收到结束游戏请求:",
                    socket.id
                );


                const room =
                    getRoom(
                        socket.roomCode
                    );


                if (!room) {

                    console.log(
                        "结束游戏失败：房间不存在"
                    );

                    return;
                }


                if (
                    room.hostId !==
                    socket.id
                ) {

                    console.log(
                        "结束游戏失败：不是房主"
                    );

                    return;
                }


                if (
                    !room.currentGame
                ) {

                    console.log(
                        "结束游戏失败：没有当前游戏"
                    );

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
                            message:
                                "房间不存在"
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

                        round:
                            room.round

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


                const player =
                    room.players.find(
                        p =>
                            p.id ===
                            socket.id
                    );


                if (!player) return;


                const oldSocketId =
                    socket.id;

                const playerName =
                    player.name;

                const roomCode =
                    room.code;


                /*
                 * 不立即删除玩家。
                 *
                 * 浏览器进入 BFCache、
                 * 手机切后台、
                 * 网络短暂断开时，
                 * Socket.IO 可能马上重新连接。
                 *
                 * 给玩家15秒重新连接。
                 */

                setTimeout(
                    () => {

                        const currentRoom =
                            getRoom(
                                roomCode
                            );


                        if (!currentRoom) {
                            return;
                        }


                        const stillPlayer =
                            currentRoom.players.find(
                                p =>
                                    p.id ===
                                    oldSocketId
                            );


                        // 玩家已经通过
                        // rejoin_room 恢复
                        if (!stillPlayer) {
                            return;
                        }


                        removePlayer(
                            currentRoom,
                            oldSocketId
                        );


                        console.log(
                            `玩家 ${playerName} 确认离开房间 ${roomCode}`
                        );


                        // 房主离开

                        if (
                            currentRoom.hostId ===
                            oldSocketId
                        ) {

                            if (
                                currentRoom.players.length >
                                0
                            ) {

                                currentRoom.hostId =
                                    currentRoom.players[0].id;


                                currentRoom.hostName =
                                    currentRoom.players[0].name;

                            }

                        }


                        // 房间没人了

                        if (
                            currentRoom.players.length ===
                            0
                        ) {

                            deleteRoom(
                                roomCode
                            );


                            console.log(
                                `房间 ${roomCode} 已删除`
                            );


                            return;
                        }


                        io.to(roomCode).emit(
                            "room_update",
                            getPublicRoom(
                                currentRoom
                            )
                        );


                    },
                    15000
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