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


/*
 * ======================================================
 * Express
 * ======================================================
 */

const app =
    express();

app.use(
    express.json()
);


app.get(
    "/",
    (req, res) => {

        res.json({

            message:
                "CS2 Undercover Server",

            status:
                "running"

        });

    }
);


/*
 * ======================================================
 * HTTP
 * ======================================================
 */

const server =
    http.createServer(
        app
    );


/*
 * ======================================================
 * Socket.IO
 * ======================================================
 */

const io =
    new Server(
        server,
        {
            cors: {

                origin:
                    "*",

                methods: [
                    "GET",
                    "POST"
                ]

            }
        }
    );


const PORT =
    process.env.PORT || 3000;


/*
 * ======================================================
 * 客户端房间数据
 * ======================================================
 */

function getClientRoom(
    room
) {

    const result =
        getPublicRoom(
            room
        );


    result.isTestRoom =
        room.isTestRoom === true;


    return result;

}


/*
 * ======================================================
 * 同步当前游戏中的 socket ID
 * ======================================================
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
 * ======================================================
 * 从离开列表恢复玩家
 * ======================================================
 */

function restoreDepartedPlayer(
    room,
    socket
) {

    if (
        !Array.isArray(
            room.departedPlayers
        )
    ) {

        return null;

    }


    const index =
        room.departedPlayers.findIndex(
            player =>
                player.name ===
                socket.playerName
        );


    if (
        index === -1
    ) {

        return null;

    }


    const oldPlayer =
        room.departedPlayers[index];


    room.departedPlayers.splice(
        index,
        1
    );


    const restoredPlayer = {

        id:
            socket.id,

        name:
            oldPlayer.name,

        team:
            oldPlayer.team || null,

        role:
            oldPlayer.role || null,

        task:
            oldPlayer.task || null,

        isBot:
            false

    };


    room.players.push(
        restoredPlayer
    );


    socket.roomCode =
        room.code;

    socket.playerName =
        restoredPlayer.name;


    socket.join(
        room.code
    );


    /*
     * 如果原来房间没有房主，
     * 让回来的玩家成为房主。
     */

    if (
        !room.hostId ||
        room.hostId === null
    ) {

        room.hostId =
            socket.id;

        room.hostName =
            restoredPlayer.name;

    }


    /*
     * 当前游戏也恢复 socket ID
     */

    syncGamePlayerSocketId(
        room,
        restoredPlayer.name,
        socket.id
    );


    return restoredPlayer;

}


/*
 * ======================================================
 * 恢复当前游戏
 * ======================================================
 */

function sendCurrentGameToSocket(
    socket,
    room
) {

    if (!room.currentGame) {

        return;

    }


    /*
     * ==========================================
     * 游戏进行中
     * ==========================================
     */

    if (
        room.state ===
        "PLAYING"
    ) {

        /*
         * 单人测试
         *
         * 直接显示所有人的身份。
         */

        if (
            room.isTestRoom === true
        ) {

            const testGame =
                getPublicGame(
                    room.currentGame,
                    true
                );


            testGame.isTestRoom =
                true;


            socket.emit(
                "game_started",
                testGame
            );


            /*
             * 同时发送自己的私人信息
             */

            const privateInfo =
                getPrivatePlayerInfo(
                    room.currentGame,
                    socket.id
                );


            if (privateInfo) {

                socket.emit(
                    "private_role",
                    privateInfo
                );

            }


        } else {

            /*
             * 普通多人
             */

            socket.emit(
                "game_started",
                getPublicGame(
                    room.currentGame,
                    false
                )
            );


            /*
             * 内鬼模式发送自己的身份
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

    }


    /*
     * ==========================================
     * 游戏揭晓
     * ==========================================
     */

    if (
        room.state ===
        "REVEAL"
    ) {

        const result =
            getPublicGame(
                room.currentGame,
                true
            );


        if (
            room.isTestRoom === true
        ) {

            result.isTestRoom =
                true;

        }


        socket.emit(
            "game_finished",
            result
        );

    }

}


/*
 * ======================================================
 * 给真实玩家发送私人身份
 * ======================================================
 */

function sendPrivateRoles(
    room
) {

    if (
        room.mode !==
        "UNDERCOVER"
    ) {

        return;

    }


    if (!room.currentGame) {

        return;

    }


    room.players.forEach(
        player => {

            /*
             * Bot 没有 socket
             */

            if (
                player.isBot === true
            ) {

                return;

            }


            const playerSocket =
                io.sockets.sockets.get(
                    player.id
                );


            if (!playerSocket) {

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


/*
 * ======================================================
 * Socket.IO connection
 * ======================================================
 */

io.on(
    "connection",
    socket => {

        console.log(
            "玩家连接:",
            socket.id
        );


        /*
         * ==================================================
         * 创建普通房间
         * ==================================================
         */

        socket.on(
            "create_room",
            data => {

                try {

                    const {
                        name,
                        mode,
                        maxPlayers
                    } =
                        data || {};


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


                    const count =
                        Number(
                            maxPlayers
                        );


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
                     * 初始化离开列表
                     */

                    room.departedPlayers =
                        [];


                    room.isTestRoom =
                        false;


                    /*
                     * 房主加入
                     */

                    room.players.push({

                        id:
                            socket.id,

                        name:
                            playerName,

                        team:
                            null,

                        role:
                            null,

                        task:
                            null,

                        isBot:
                            false

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
                        getClientRoom(room)
                    );


                    io.to(
                        room.code
                    ).emit(
                        "room_update",
                        getClientRoom(room)
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
         * ==================================================
         * 创建单人测试房间
         * ==================================================
         */

        socket.on(
            "create_test_room",
            data => {

                try {

                    const {
                        name,
                        mode,
                        maxPlayers
                    } =
                        data || {};


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


                    const count =
                        Number(
                            maxPlayers
                        );


                    if (
                        !Number.isInteger(
                            count
                        ) ||
                        count < 6 ||
                        count > 16
                    ) {

                        socket.emit(
                            "error_message",
                            "测试人数必须选择6到16人"
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


                    room.isTestRoom =
                        true;


                    room.departedPlayers =
                        [];


                    /*
                     * 真人
                     */

                    room.players.push({

                        id:
                            socket.id,

                        name:
                            playerName,

                        team:
                            null,

                        role:
                            null,

                        task:
                            null,

                        isBot:
                            false

                    });


                    /*
                     * Bot
                     */

                    for (
                        let i = 2;
                        i <= count;
                        i++
                    ) {

                        room.players.push({

                            id:
                                `bot-${room.code}-${i}`,

                            name:
                                `🤖 测试玩家 ${i}`,

                            team:
                                null,

                            role:
                                null,

                            task:
                                null,

                            isBot:
                                true

                        });

                    }


                    socket.roomCode =
                        room.code;

                    socket.playerName =
                        playerName;


                    socket.join(
                        room.code
                    );


                    socket.emit(
                        "room_created",
                        getClientRoom(room)
                    );


                    io.to(
                        room.code
                    ).emit(
                        "room_update",
                        getClientRoom(room)
                    );


                    console.log(
                        `单人测试房间创建成功: ${room.code}, ` +
                        `模式: ${room.mode}, ` +
                        `人数: ${room.maxPlayers}`
                    );

                } catch (error) {

                    console.error(
                        "create_test_room 错误:",
                        error
                    );


                    socket.emit(
                        "error_message",
                        "创建测试房间失败"
                    );

                }

            }
        );


        /*
         * ==================================================
         * 自动重连
         * ==================================================
         */

        socket.on(
            "rejoin_room",
            data => {

                try {

                    const {
                        roomCode,
                        name
                    } =
                        data || {};


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
                        getRoom(
                            roomCode
                        );


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

                        /*
                         * 如果是主动离开后重新回来，
                         * 也尝试从离开列表恢复。
                         */

                        socket.playerName =
                            name;


                        const restored =
                            restoreDepartedPlayer(
                                room,
                                socket
                            );


                        if (!restored) {

                            socket.emit(
                                "rejoin_failed",
                                "房间中没有找到这个玩家"
                            );

                            return;

                        }

                    } else {

                        /*
                         * Bot 不允许冒充
                         */

                        if (
                            player.isBot ===
                            true
                        ) {

                            socket.emit(
                                "rejoin_failed",
                                "这个昵称属于测试机器人"
                            );

                            return;

                        }


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
                         * 恢复房主
                         */

                        if (
                            room.hostName ===
                            player.name
                        ) {

                            room.hostId =
                                socket.id;

                        }


                        syncGamePlayerSocketId(
                            room,
                            player.name,
                            socket.id
                        );

                    }


                    socket.emit(
                        "rejoin_success",
                        getClientRoom(room)
                    );


                    io.to(
                        room.code
                    ).emit(
                        "room_update",
                        getClientRoom(room)
                    );


                    sendCurrentGameToSocket(
                        socket,
                        room
                    );


                    console.log(
                        `玩家重连/重新加入成功: ${name}, ` +
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
         * ==================================================
         * 加入房间 / 离开后重新加入
         * ==================================================
         */

        socket.on(
            "join_room",
            data => {

                try {

                    const {
                        roomCode,
                        name
                    } =
                        data || {};


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
                        getRoom(
                            code
                        );


                    if (!room) {

                        socket.emit(
                            "error_message",
                            "房间不存在"
                        );

                        return;

                    }


                    /*
                     * ==================================================
                     * 第一优先：
                     * 找离开列表
                     *
                     * 这样即使游戏已经开始，
                     * 原玩家也可以回来。
                     * ==================================================
                     */

                    socket.playerName =
                        playerName;


                    const restored =
                        restoreDepartedPlayer(
                            room,
                            socket
                        );


                    if (restored) {

                        socket.emit(
                            "join_success",
                            getClientRoom(room)
                        );


                        io.to(
                            room.code
                        ).emit(
                            "room_update",
                            getClientRoom(room)
                        );


                        sendCurrentGameToSocket(
                            socket,
                            room
                        );


                        console.log(
                            `离开后重新加入: ${playerName}, ` +
                            `房间: ${room.code}`
                        );


                        return;

                    }


                    /*
                     * ==================================================
                     * 已经存在于房间
                     * ==================================================
                     */

                    const existingPlayer =
                        room.players.find(
                            player =>
                                player.name ===
                                playerName
                        );


                    if (existingPlayer) {

                        if (
                            existingPlayer.isBot ===
                            true
                        ) {

                            socket.emit(
                                "error_message",
                                "这个昵称属于测试机器人，请换一个昵称"
                            );

                            return;

                        }


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
                            getClientRoom(room)
                        );


                        io.to(
                            room.code
                        ).emit(
                            "room_update",
                            getClientRoom(room)
                        );


                        sendCurrentGameToSocket(
                            socket,
                            room
                        );


                        return;

                    }


                    /*
                     * ==================================================
                     * 新玩家
                     *
                     * 新玩家仍然只能加入 WAITING。
                     * ==================================================
                     */

                    if (
                        room.state !==
                        "WAITING"
                    ) {

                        socket.emit(
                            "error_message",
                            "游戏已经开始，新玩家无法加入；原玩家请使用原昵称重新加入"
                        );

                        return;

                    }


                    const result =
                        addPlayer(
                            room,
                            {
                                id:
                                    socket.id,

                                name:
                                    playerName,

                                team:
                                    null,

                                role:
                                    null,

                                task:
                                    null,

                                isBot:
                                    false

                            }
                        );


                    if (
                        !result.success
                    ) {

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


                    /*
                     * 如果房间没有房主，
                     * 新加入者成为房主。
                     */

                    if (
                        !room.hostId
                    ) {

                        room.hostId =
                            socket.id;

                        room.hostName =
                            playerName;

                    }


                    socket.emit(
                        "join_success",
                        getClientRoom(room)
                    );


                    io.to(
                        room.code
                    ).emit(
                        "room_update",
                        getClientRoom(room)
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
         * ==================================================
         * 请求私人身份
         * ==================================================
         */

        socket.on(
            "request_private_role",
            () => {

                try {

                    const room =
                        getRoom(
                            socket.roomCode
                        );


                    if (!room) {

                        return;

                    }


                    if (!room.currentGame) {

                        return;

                    }


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

                } catch (error) {

                    console.error(
                        "request_private_role 错误:",
                        error
                    );

                }

            }
        );


        /*
         * ==================================================
         * 开始游戏
         * ==================================================
         */

        socket.on(
            "start_game",
            () => {

                try {

                    const room =
                        getRoom(
                            socket.roomCode
                        );


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
                        getMaxPlayers(
                            room
                        );


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


                    room.round =
                        1;


                    room.currentGame =
                        createGame(
                            room.players,
                            room.round,
                            room.mode
                        );


                    room.state =
                        "PLAYING";


                    /*
                     * 单人测试
                     */

                    if (
                        room.isTestRoom ===
                        true
                    ) {

                        const testGame =
                            getPublicGame(
                                room.currentGame,
                                true
                            );


                        testGame.isTestRoom =
                            true;


                        socket.emit(
                            "game_started",
                            testGame
                        );


                        const privateInfo =
                            getPrivatePlayerInfo(
                                room.currentGame,
                                socket.id
                            );


                        if (privateInfo) {

                            socket.emit(
                                "private_role",
                                privateInfo
                            );

                        }


                    } else {

                        /*
                         * 普通多人
                         */

                        io.to(
                            room.code
                        ).emit(
                            "game_started",
                            getPublicGame(
                                room.currentGame,
                                false
                            )
                        );


                        sendPrivateRoles(
                            room
                        );

                    }


                    console.log(
                        `游戏开始: ${room.code}, ` +
                        `第 ${room.round} 局, ` +
                        `模式: ${room.mode}`
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
         * ==================================================
         * 结束游戏
         * ==================================================
         */

        socket.on(
            "finish_game",
            () => {

                try {

                    const room =
                        getRoom(
                            socket.roomCode
                        );


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


                    io.to(
                        room.code
                    ).emit(
                        "room_update",
                        getClientRoom(room)
                    );


                    const result =
                        getPublicGame(
                            room.currentGame,
                            true
                        );


                    if (
                        room.isTestRoom ===
                        true
                    ) {

                        result.isTestRoom =
                            true;

                    }


                    io.to(
                        room.code
                    ).emit(
                        "game_finished",
                        result
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
         * ==================================================
         * 下一局
         * ==================================================
         */

        socket.on(
            "next_round",
            () => {

                try {

                    const room =
                        getRoom(
                            socket.roomCode
                        );


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
                        getMaxPlayers(
                            room
                        );


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


                    room.round +=
                        1;


                    room.currentGame =
                        createGame(
                            room.players,
                            room.round,
                            room.mode
                        );


                    room.state =
                        "PLAYING";


                    /*
                     * 单人测试
                     */

                    if (
                        room.isTestRoom ===
                        true
                    ) {

                        const testGame =
                            getPublicGame(
                                room.currentGame,
                                true
                            );


                        testGame.isTestRoom =
                            true;


                        socket.emit(
                            "game_started",
                            testGame
                        );


                        const privateInfo =
                            getPrivatePlayerInfo(
                                room.currentGame,
                                socket.id
                            );


                        if (privateInfo) {

                            socket.emit(
                                "private_role",
                                privateInfo
                            );

                        }


                    } else {

                        io.to(
                            room.code
                        ).emit(
                            "game_started",
                            getPublicGame(
                                room.currentGame,
                                false
                            )
                        );


                        sendPrivateRoles(
                            room
                        );

                    }


                    io.to(
                        room.code
                    ).emit(
                        "room_update",
                        getClientRoom(room)
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
         * ==================================================
         * 主动退出房间
         * ==================================================
         *
         * 和以前最大的区别：
         *
         * 玩家会被放进 departedPlayers。
         *
         * 所以以后可以重新加入。
         */

        socket.on(
            "leave_room",
            (data, maybeCallback) => {

                let callback =
                    null;


                if (
                    typeof maybeCallback ===
                    "function"
                ) {

                    callback =
                        maybeCallback;

                } else if (
                    typeof data ===
                    "function"
                ) {

                    callback =
                        data;

                }


                try {

                    const roomCode =
                        socket.roomCode;


                    if (!roomCode) {

                        if (
                            typeof callback ===
                            "function"
                        ) {

                            callback({
                                success:
                                    true
                            });

                        }

                        return;

                    }


                    const room =
                        getRoom(
                            roomCode
                        );


                    if (!room) {

                        socket.roomCode =
                            null;

                        socket.playerName =
                            null;


                        if (
                            typeof callback ===
                            "function"
                        ) {

                            callback({
                                success:
                                    true
                            });

                        }

                        return;

                    }


                    if (
                        !Array.isArray(
                            room.departedPlayers
                        )
                    ) {

                        room.departedPlayers =
                            [];

                    }


                    const player =
                        room.players.find(
                            item =>
                                item.id ===
                                socket.id
                        );


                    if (!player) {

                        socket.roomCode =
                            null;

                        socket.playerName =
                            null;


                        if (
                            typeof callback ===
                            "function"
                        ) {

                            callback({
                                success:
                                    true
                            });

                        }

                        return;

                    }


                    const wasHost =
                        room.hostId ===
                        socket.id;


                    /*
                     * 先保存离开玩家资料
                     */

                    room.departedPlayers.push({

                        name:
                            player.name,

                        team:
                            player.team,

                        role:
                            player.role,

                        task:
                            player.task,

                        wasHost:
                            wasHost

                    });


                    /*
                     * 真正从当前活跃玩家列表移除
                     */

                    removePlayer(
                        room,
                        socket.id
                    );


                    socket.leave(
                        roomCode
                    );


                    socket.roomCode =
                        null;

                    socket.playerName =
                        null;


                    /*
                     * 如果房主离开，
                     * 转移给其他活跃玩家。
                     */

                    if (
                        wasHost &&
                        room.players.length >
                            0
                    ) {

                        room.hostId =
                            room.players[0].id;

                        room.hostName =
                            room.players[0].name;


                    } else if (
                        wasHost &&
                        room.players.length ===
                            0
                    ) {

                        /*
                         * 暂时没有房主。
                         *
                         * 原房主回来后可以重新成为房主。
                         */

                        room.hostId =
                            null;

                    }


                    /*
                     * 不删除房间。
                     *
                     * 因为离开的人以后可以回来。
                     */


                    if (
                        room.players.length >
                        0
                    ) {

                        io.to(
                            roomCode
                        ).emit(
                            "room_update",
                            getClientRoom(room)
                        );

                    }


                    console.log(
                        `玩家离开: ${player.name}, ` +
                        `房间: ${roomCode}`
                    );


                    if (
                        typeof callback ===
                        "function"
                    ) {

                        callback({
                            success:
                                true
                        });

                    }

                } catch (error) {

                    console.error(
                        "leave_room 错误:",
                        error
                    );


                    if (
                        typeof callback ===
                        "function"
                    ) {

                        callback({
                            success:
                                false,

                            message:
                                "退出房间失败"

                        });

                    }

                }

            }
        );


        /*
         * ==================================================
         * 玩家掉线
         * ==================================================
         *
         * 掉线不等于主动退出。
         *
         * 所以不移动到 departedPlayers。
         *
         * 原来的自动重连机制继续有效。
         */

        socket.on(
            "disconnect",
            () => {

                console.log(
                    "玩家断开连接:",
                    socket.id,
                    "昵称:",
                    socket.playerName || "未知"
                );

            }
        );

    }
);


/*
 * ======================================================
 * 启动
 * ======================================================
 */

server.listen(
    PORT,
    () => {

        console.log(
            `服务器启动成功，端口: ${PORT}`
        );

    }
);