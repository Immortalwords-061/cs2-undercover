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

const app = express();

app.use(express.json());


app.get("/", (req, res) => {

    res.json({
        message:
            "CS2 Undercover Server",

        status:
            "running"
    });

});


/*
 * ======================================================
 * HTTP Server
 * ======================================================
 */

const server =
    http.createServer(app);


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
                origin: "*",
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
 * 给客户端的房间数据
 * ======================================================
 *
 * roomManager.js 原来的 getPublicRoom()
 * 没有返回 isTestRoom。
 *
 * 所以这里统一补上。
 */

function getClientRoom(room) {

    const result =
        getPublicRoom(room);


    result.isTestRoom =
        room.isTestRoom === true;


    return result;
}


/*
 * ======================================================
 * 同步当前游戏玩家 socket ID
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
         * 单人测试房间
         *
         * 测试玩家直接看到所有 Bot 的
         * 阵营 / 身份 / 任务。
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

        } else {

            /*
             * 普通多人房间
             *
             * 只能看到公开信息。
             */

            socket.emit(
                "game_started",
                getPublicGame(
                    room.currentGame,
                    false
                )
            );


            /*
             * 内鬼模式恢复私人身份
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
     * 游戏结束
     * ==========================================
     */

    if (
        room.state ===
        "REVEAL"
    ) {

        const revealGame =
            getPublicGame(
                room.currentGame,
                true
            );


        if (
            room.isTestRoom === true
        ) {

            revealGame.isTestRoom =
                true;

        }


        socket.emit(
            "game_finished",
            revealGame
        );

    }

}


/*
 * ======================================================
 * 给真实玩家发送私人身份
 * ======================================================
 */

function sendPrivateRoles(room) {

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
             * Bot 没有 Socket。
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
         * 创建正常房间
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
                    } = data || {};


                    /*
                     * 检查昵称
                     */

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
                     * 检查人数
                     */

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


                    /*
                     * 创建房间
                     */

                    const room =
                        createRoom(
                            socket.id,
                            playerName,
                            mode,
                            count
                        );


                    /*
                     * 添加房主
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
                     * 标记为普通房间
                     */

                    room.isTestRoom =
                        false;


                    /*
                     * Socket 状态
                     */

                    socket.roomCode =
                        room.code;

                    socket.playerName =
                        playerName;


                    socket.join(
                        room.code
                    );


                    /*
                     * 告诉创建者
                     */

                    socket.emit(
                        "room_created",
                        getClientRoom(room)
                    );


                    /*
                     * 广播房间
                     */

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
         *
         * 例如选择 8 人：
         *
         * 1 个真实玩家
         * 7 个 Bot
         *
         * 仍然按照正常 8 人游戏规则运行。
         */

        socket.on(
            "create_test_room",
            data => {

                try {

                    const {
                        name,
                        mode,
                        maxPlayers
                    } = data || {};


                    /*
                     * 检查昵称
                     */

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
                     * 检查人数
                     */

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


                    /*
                     * 创建房间
                     */

                    const room =
                        createRoom(
                            socket.id,
                            playerName,
                            mode,
                            count
                        );


                    /*
                     * 标记测试房间
                     */

                    room.isTestRoom =
                        true;


                    /*
                     * 加入真实玩家
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
                     * 自动添加 Bot
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


                    /*
                     * Socket 状态
                     */

                    socket.roomCode =
                        room.code;

                    socket.playerName =
                        playerName;


                    socket.join(
                        room.code
                    );


                    /*
                     * 告诉真实测试玩家
                     */

                    socket.emit(
                        "room_created",
                        getClientRoom(room)
                    );


                    /*
                     * 更新房间
                     */

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
                    } = data || {};


                    /*
                     * 基本检查
                     */

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


                    /*
                     * 房间不存在
                     */

                    if (!room) {

                        socket.emit(
                            "rejoin_failed",
                            "房间不存在，可能已经关闭"
                        );

                        return;
                    }


                    /*
                     * 根据昵称找到原玩家
                     */

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
                     * 防止冒充 Bot
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


                    /*
                     * 恢复 socket.id
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
                     * 恢复房主
                     */

                    if (
                        room.hostName ===
                        player.name
                    ) {

                        room.hostId =
                            socket.id;

                    }


                    /*
                     * 同步游戏中的 ID
                     */

                    syncGamePlayerSocketId(
                        room,
                        player.name,
                        socket.id
                    );


                    /*
                     * 告诉本人
                     */

                    socket.emit(
                        "rejoin_success",
                        getClientRoom(room)
                    );


                    /*
                     * 广播房间
                     */

                    io.to(
                        room.code
                    ).emit(
                        "room_update",
                        getClientRoom(room)
                    );


                    /*
                     * 恢复当前游戏
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
         * ==================================================
         * 加入房间
         * ==================================================
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
                     * 检查是否已经是这个房间的玩家
                     */

                    const existingPlayer =
                        room.players.find(
                            player =>
                                player.name ===
                                playerName
                        );


                    if (existingPlayer) {

                        /*
                         * 不允许冒充 Bot
                         */

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


                        /*
                         * 恢复玩家
                         */

                        existingPlayer.id =
                            socket.id;


                        socket.roomCode =
                            room.code;

                        socket.playerName =
                            existingPlayer.name;


                        socket.join(
                            room.code
                        );


                        /*
                         * 恢复房主
                         */

                        if (
                            room.hostName ===
                            existingPlayer.name
                        ) {

                            room.hostId =
                                socket.id;

                        }


                        /*
                         * 同步游戏中的 ID
                         */

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


                    /*
                     * 添加新玩家
                     */

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
         * 开始游戏
         * ==================================================
         */

        socket.on(
            "start_game",
            () => {

                try {

                    const roomCode =
                        socket.roomCode;


                    const room =
                        getRoom(
                            roomCode
                        );


                    if (!room) {

                        socket.emit(
                            "error_message",
                            "房间不存在"
                        );

                        return;
                    }


                    /*
                     * 房主检查
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


                    /*
                     * 状态检查
                     */

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


                    /*
                     * 必须满员
                     *
                     * 测试房间因为有 Bot，
                     * 这里自然也是满员。
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


                    /*
                     * 创建第 1 局
                     */

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
                     * ======================================
                     * 单人测试
                     * ======================================
                     *
                     * 测试玩家直接获得完整游戏数据。
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


                    } else {

                        /*
                         * 普通多人游戏
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


                        /*
                         * 私人身份
                         */

                        sendPrivateRoles(
                            room
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
         * ==================================================
         * 结束游戏
         * ==================================================
         */

        socket.on(
            "finish_game",
            () => {

                try {

                    const roomCode =
                        socket.roomCode;


                    const room =
                        getRoom(
                            roomCode
                        );


                    if (!room) {

                        socket.emit(
                            "error_message",
                            "房间不存在"
                        );

                        return;
                    }


                    /*
                     * 只有房主
                     */

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


                    /*
                     * 必须正在游戏
                     */

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


                    /*
                     * 更新房间状态
                     */

                    io.to(
                        room.code
                    ).emit(
                        "room_update",
                        getClientRoom(room)
                    );


                    /*
                     * 公布全部身份
                     */

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

                    const roomCode =
                        socket.roomCode;


                    const room =
                        getRoom(
                            roomCode
                        );


                    if (!room) {

                        socket.emit(
                            "error_message",
                            "房间不存在"
                        );

                        return;
                    }


                    /*
                     * 房主检查
                     */

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


                    /*
                     * 状态检查
                     */

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


                    /*
                     * 检查人数
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


                    /*
                     * 下一局
                     */

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
                     * ======================================
                     * 单人测试模式
                     * ======================================
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


                    } else {

                        /*
                         * 普通多人游戏
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


                        /*
                         * 私人身份
                         */

                        sendPrivateRoles(
                            room
                        );

                    }


                    /*
                     * 更新房间
                     */

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
         * 兼容：
         *
         * socket.emit("leave_room")
         *
         * socket.emit("leave_room", {})
         *
         * socket.emit("leave_room", {}, callback)
         *
         */

        socket.on(
            "leave_room",
            (data, maybeCallback) => {

                let callback =
                    null;


                /*
                 * 第二个参数是函数
                 */

                if (
                    typeof maybeCallback ===
                    "function"
                ) {

                    callback =
                        maybeCallback;

                }


                /*
                 * 第一个参数本身是函数
                 */

                else if (
                    typeof data ===
                    "function"
                ) {

                    callback =
                        data;

                }


                try {

                    const roomCode =
                        socket.roomCode;


                    /*
                     * 没有房间
                     */

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


                    /*
                     * 房间不存在
                     */

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


                    /*
                     * 测试房间
                     *
                     * 只有一个真实玩家，
                     * 退出后直接删除整个测试房间。
                     */

                    if (
                        room.isTestRoom ===
                        true
                    ) {

                        console.log(
                            `测试玩家退出测试房间: ${socket.playerName}, ` +
                            `房间: ${roomCode}`
                        );


                        socket.leave(
                            roomCode
                        );


                        socket.roomCode =
                            null;

                        socket.playerName =
                            null;


                        deleteRoom(
                            roomCode
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

                        return;
                    }


                    /*
                     * 普通房间
                     */

                    const player =
                        room.players.find(
                            player =>
                                player.id ===
                                socket.id
                        );


                    /*
                     * 没找到玩家
                     */

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


                    const playerName =
                        player.name;


                    const wasHost =
                        room.hostId ===
                        socket.id;


                    /*
                     * 真正删除玩家
                     */

                    removePlayer(
                        room,
                        socket.id
                    );


                    /*
                     * 离开 Socket.IO 房间
                     */

                    socket.leave(
                        roomCode
                    );


                    socket.roomCode =
                        null;

                    socket.playerName =
                        null;


                    console.log(
                        `玩家主动退出: ${playerName}, ` +
                        `房间: ${roomCode}`
                    );


                    /*
                     * 房主退出以后，
                     * 交给第一个剩余玩家
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


                        console.log(
                            `新房主: ${room.hostName}`
                        );

                    }


                    /*
                     * 没有人了
                     */

                    if (
                        room.players.length ===
                        0
                    ) {

                        deleteRoom(
                            roomCode
                        );


                        console.log(
                            `房间已删除: ${roomCode}`
                        );

                    } else {

                        /*
                         * 通知剩余玩家
                         */

                        io.to(
                            roomCode
                        ).emit(
                            "room_update",
                            getClientRoom(room)
                        );

                    }


                    /*
                     * callback 可选
                     */

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


                    /*
                     * 防止 callback 再导致服务器崩溃
                     */

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
         * 玩家断开连接
         * ==================================================
         *
         * 这里故意不删除玩家。
         *
         * 只要房间还存在，
         * 玩家就可以重新回来。
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


                const roomCode =
                    socket.roomCode;


                /*
                 * 没有加入房间
                 */

                if (!roomCode) {

                    return;
                }


                const room =
                    getRoom(
                        roomCode
                    );


                /*
                 * 房间不存在
                 */

                if (!room) {

                    return;
                }


                /*
                 * 最重要：
                 *
                 * 不 removePlayer()
                 *
                 * 不 deleteRoom()
                 *
                 * 不计时踢出。
                 */

                console.log(
                    `玩家掉线但继续保留: ${socket.playerName}, ` +
                    `房间: ${roomCode}`
                );

            }
        );

    }
);


/*
 * ======================================================
 * 启动服务器
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