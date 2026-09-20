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
 * ======================================================
 * 同步当前游戏中的玩家 socket ID
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
 * 给重新连接的玩家恢复当前游戏状态
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
         * 才发送私人身份
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
     * 游戏结束
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


/*
 * ======================================================
 * Socket.IO
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
         * 创建房间
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


                    /*
                     * 告诉创建者
                     */

                    socket.emit(
                        "room_created",
                        getPublicRoom(room)
                    );


                    /*
                     * 广播房间状态
                     */

                    io.to(
                        room.code
                    ).emit(
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

                        socket.emit(
                            "rejoin_failed",
                            "房间中没有找到这个玩家"
                        );

                        return;

                    }


                    /*
                     * 更新玩家 socket ID
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
                     * 更新当前游戏中的 ID
                     */

                    syncGamePlayerSocketId(
                        room,
                        player.name,
                        socket.id
                    );


                    /*
                     * 告诉重连玩家
                     */

                    socket.emit(
                        "rejoin_success",
                        getPublicRoom(room)
                    );


                    /*
                     * 广播房间状态
                     */

                    io.to(
                        room.code
                    ).emit(
                        "room_update",
                        getPublicRoom(room)
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
                     * 如果玩家已经存在
                     * 允许恢复
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


                        io.to(
                            room.code
                        ).emit(
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
                                    null
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


                    io.to(
                        room.code
                    ).emit(
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
                     * 只有房主
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
                     * 必须等待状态
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
                     * 必须达到满员
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
                     * 第1局
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
                     * 广播公开游戏
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
                     * 内鬼模式发私人身份
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


                    /*
                     * 修改房间状态
                     */

                    room.state =
                        "REVEAL";


                    if (
                        room.currentGame
                    ) {

                        room.currentGame.state =
                            "REVEAL";

                    }


                    /*
                     * 更新房间
                     */

                    io.to(
                        room.code
                    ).emit(
                        "room_update",
                        getPublicRoom(room)
                    );


                    /*
                     * 公布身份
                     */

                    io.to(
                        room.code
                    ).emit(
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


                    /*
                     * 人数必须完整
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
                     * 广播游戏
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
                     * 发私人身份
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


                    /*
                     * 更新房间
                     */

                    io.to(
                        room.code
                    ).emit(
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
         * ==================================================
         * 主动退出房间
         * ==================================================
         *
         * 这里特别做了兼容处理。
         *
         * 支持：
         *
         * socket.emit("leave_room")
         *
         * socket.emit("leave_room", {})
         *
         * socket.emit("leave_room", {}, callback)
         *
         * 都不会崩溃。
         */

        socket.on(
            "leave_room",
            (data, maybeCallback) => {

                /*
                 * 真正的 callback
                 */

                let callback = null;


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


                    /*
                     * 当前没有加入房间
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
                     * 找到当前玩家
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
                     * 删除玩家
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


                    /*
                     * 清除 socket 状态
                     */

                    socket.roomCode =
                        null;

                    socket.playerName =
                        null;


                    console.log(
                        `玩家主动退出: ${playerName}, ` +
                        `房间: ${roomCode}`
                    );


                    /*
                     * 如果房主退出，
                     * 转移给剩余玩家
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
                     * 房间没人了
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
                            getPublicRoom(
                                room
                            )
                        );

                    }


                    /*
                     * callback 是可选的。
                     *
                     * 只有真的传了函数，
                     * 才调用。
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
                     * 即使退出房间过程中
                     * 出现异常，也不要让服务器崩溃。
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
         * 给自动重连保留 15 秒。
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
                    getRoom(
                        roomCode
                    );


                if (!room) {

                    return;

                }


                const playerName =
                    socket.playerName;


                /*
                 * 延迟 15 秒删除
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


                        /*
                         * 检查该玩家
                         * 是否已经用新的 socket 重连
                         */

                        const stillSameSocket =
                            currentRoom.players.some(
                                player =>
                                    player.name ===
                                        playerName &&
                                    player.id ===
                                        socket.id
                            );


                        /*
                         * 如果已经重连
                         * 就不要删除
                         */

                        if (
                            !stillSameSocket
                        ) {

                            return;

                        }


                        /*
                         * 真正删除玩家
                         */

                        removePlayer(
                            currentRoom,
                            socket.id
                        );


                        /*
                         * 如果是房主
                         * 转移房主
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

                                /*
                                 * 房间已经没人
                                 */

                                deleteRoom(
                                    roomCode
                                );


                                console.log(
                                    `房间已删除: ${roomCode}`
                                );

                                return;

                            }

                        }


                        /*
                         * 通知剩余玩家
                         */

                        io.to(
                            roomCode
                        ).emit(
                            "room_update",
                            getPublicRoom(
                                currentRoom
                            )
                        );


                        console.log(
                            `玩家移除: ${playerName}, ` +
                            `房间: ${roomCode}`
                        );

                    },
                    15000
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