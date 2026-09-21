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


    if (!gamePlayer) {

        return;

    }


    const oldSocketId =
        gamePlayer.id;


    /*
     * 如果投票已经开始，
     * 一并迁移这个玩家原来的票。
     */

    if (
        room.currentGame.voting &&
        room.currentGame.voting.votes &&
        oldSocketId !== newSocketId
    ) {

        const votes =
            room.currentGame.voting.votes;


        if (
            Object.prototype.hasOwnProperty.call(
                votes,
                oldSocketId
            )
        ) {

            votes[newSocketId] =
                votes[oldSocketId];

            delete votes[oldSocketId];

        }

    }


    gamePlayer.id =
        newSocketId;

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


    syncGamePlayerSocketId(
        room,
        restoredPlayer.name,
        socket.id
    );


    return restoredPlayer;

}


/*
 * ======================================================
 * 获取当前投票候选人
 * ======================================================
 */

function getVotingCandidates(
    room
) {

    if (
        !room.currentGame ||
        !room.currentGame.voting
    ) {

        return [];

    }


    return (
        room.currentGame.voting.candidates ||
        []
    );

}


/*
 * ======================================================
 * 获取当前投票者
 * ======================================================
 *
 * 平票重投时：
 * 候选人不能投票。
 *
 */

function getEligibleVoters(
    room
) {

    if (
        !room.currentGame ||
        !room.currentGame.voting
    ) {

        return [];

    }


    const candidates =
        getVotingCandidates(
            room
        );


    return room.players.filter(
        player => {

            /*
             * 重投：
             * 并列候选人不能投票
             */

            if (
                candidates.includes(
                    player.id
                )
            ) {

                return false;

            }


            /*
             * Bot 可以投。
             *
             * 真人要求在线。
             *
             * 这样掉线的人不会把整个投票卡死。
             */

            if (
                player.isBot === true
            ) {

                return true;

            }


            return Boolean(
                io.sockets.sockets.get(
                    player.id
                )
            );

        }
    );

}


/*
 * ======================================================
 * 获取投票公共状态
 * ======================================================
 *
 * 不透露谁投了谁。
 */

function getVotingPublicState(
    room,
    socket
) {

    const voting =
        room.currentGame.voting;


    const candidates =
        getVotingCandidates(
            room
        );


    const eligibleVoters =
        getEligibleVoters(
            room
        );


    const votes =
        voting.votes || {};


    const hasVoted =
        Object.prototype.hasOwnProperty.call(
            votes,
            socket.id
        );


    const canVote =
        eligibleVoters.some(
            player =>
                player.id ===
                socket.id
        );


    return {

        round:
            voting.round,

        revote:
            voting.round > 1,

        candidates:
            candidates.map(
                candidateId => {

                    const player =
                        room.currentGame.players.find(
                            item =>
                                item.id ===
                                candidateId
                        );


                    if (!player) {

                        return null;

                    }


                    return {

                        id:
                            player.id,

                        name:
                            player.name,

                        team:
                            player.team

                    };

                }
            ).filter(Boolean),

        votedCount:
            Object.keys(
                votes
            ).length,

        voterCount:
            eligibleVoters.length,

        hasVoted:
            hasVoted,

        canVote:
            canVote

    };

}


/*
 * ======================================================
 * 给指定玩家恢复当前投票
 * ======================================================
 */

function sendVotingToSocket(
    socket,
    room
) {

    if (
        room.state !==
        "VOTING"
    ) {

        return;

    }


    if (
        !room.currentGame ||
        !room.currentGame.voting
    ) {

        return;

    }


    socket.emit(
        "voting_started",
        getVotingPublicState(
            room,
            socket
        )
    );

}


/*
 * ======================================================
 * 自动给 Bot 投票
 * ======================================================
 */

function autoBotVotes(
    room
) {

    if (
        !room.isTestRoom
    ) {

        return;

    }


    if (
        !room.currentGame ||
        !room.currentGame.voting
    ) {

        return;

    }


    const voting =
        room.currentGame.voting;


    const candidates =
        getVotingCandidates(
            room
        );


    const eligibleBots =
        getEligibleVoters(
            room
        ).filter(
            player =>
                player.isBot ===
                true
        );


    eligibleBots.forEach(
        bot => {

            /*
             * 已经投过
             */

            if (
                Object.prototype.hasOwnProperty.call(
                    voting.votes,
                    bot.id
                )
            ) {

                return;

            }


            /*
             * 第一轮：
             * 可以投任意其他玩家。
             *
             * 重投：
             * 只能从候选人中选。
             */

            let choices;


            if (
                voting.round ===
                1
            ) {

                choices =
                    room.currentGame.players.filter(
                        player =>
                            player.id !==
                            bot.id &&
                            room.players.some(
                                active =>
                                    active.id ===
                                    player.id
                            )
                    );

            } else {

                choices =
                    room.currentGame.players.filter(
                        player =>
                            candidates.includes(
                                player.id
                            )
                    );

            }


            if (
                choices.length ===
                0
            ) {

                return;

            }


            const target =
                choices[
                    Math.floor(
                        Math.random() *
                        choices.length
                    )
                ];


            voting.votes[
                bot.id
            ] =
                target.id;

        }
    );

}


/*
 * ======================================================
 * 开始一轮投票
 * ======================================================
 */

function startVotingRound(
    room,
    candidateIds,
    isRevote = false
) {

    if (!room.currentGame) {

        return;

    }


    room.state =
        "VOTING";


    room.currentGame.state =
        "VOTING";


    room.currentGame.voting = {

        round:
            isRevote
                ? (
                    room.currentGame.voting
                        ? room.currentGame.voting.round + 1
                        : 2
                )
                : 1,

        candidates:
            candidateIds,

        votes:
            {}

    };


    /*
     * 给所有真实玩家发送投票界面
     */

    room.players.forEach(
        player => {

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


            sendVotingToSocket(
                playerSocket,
                room
            );

        }
    );


    /*
     * 测试房间 Bot 自动投票
     */

    autoBotVotes(
        room
    );


    /*
     * Bot 投完以后检查
     */

    processVoting(
        room
    );


    console.log(
        `投票开始: ${room.code}, ` +
        `第 ${room.currentGame.voting.round} 轮`
    );

}


/*
 * ======================================================
 * 计票
 * ======================================================
 */

function countVotes(
    room
) {

    const voting =
        room.currentGame.voting;


    const counts = {};


    voting.candidates.forEach(
        candidateId => {

            counts[
                candidateId
            ] = 0;

        }
    );


    Object.values(
        voting.votes
    ).forEach(
        targetId => {

            if (
                Object.prototype.hasOwnProperty.call(
                    counts,
                    targetId
                )
            ) {

                counts[
                    targetId
                ] += 1;

            }

        }
    );


    return counts;

}


/*
 * ======================================================
 * 投票结束后判定
 * ======================================================
 */

function processVoting(
    room
) {

    if (
        room.state !==
        "VOTING"
    ) {

        return;

    }


    if (
        !room.currentGame ||
        !room.currentGame.voting
    ) {

        return;

    }


    const voting =
        room.currentGame.voting;


    const eligibleVoters =
        getEligibleVoters(
            room
        );


    const votedCount =
        Object.keys(
            voting.votes
        ).length;


    /*
     * 还没有全部投票
     */

    if (
        votedCount <
        eligibleVoters.length
    ) {

        /*
         * 更新进度
         */

        room.players.forEach(
            player => {

                if (
                    player.isBot ===
                    true
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


                playerSocket.emit(
                    "vote_progress",
                    {
                        votedCount:
                            votedCount,

                        voterCount:
                            eligibleVoters.length,

                        hasVoted:
                            Object.prototype.hasOwnProperty.call(
                                voting.votes,
                                player.id
                            )
                    }
                );

            }
        );


        return;

    }


    /*
     * ==================================================
     * 计票
     * ==================================================
     */

    const counts =
        countVotes(
            room
        );


    const entries =
        Object.entries(
            counts
        );


    if (
        entries.length ===
        0
    ) {

        return;

    }


    const highestVote =
        Math.max(
            ...entries.map(
                ([, count]) =>
                    count
            )
        );


    const topCandidates =
        entries
            .filter(
                ([, count]) =>
                    count ===
                    highestVote
            )
            .map(
                ([id]) =>
                    id
            );


    /*
     * ==================================================
     * 平票
     * ==================================================
     */

    if (
        topCandidates.length >
        1
    ) {

        console.log(
            `投票平票: ${room.code}, ` +
            `候选人数: ${topCandidates.length}`
        );


        /*
         * 正常情况下：
         *
         * 候选人不能参加下一轮。
         */

        const eligibleOutside =
            room.players.filter(
                player =>
                    !topCandidates.includes(
                        player.id
                    )
            );


        /*
         * 极端情况：
         * 所有人都是候选人。
         *
         * 这种情况下没有“其他人”可以投票，
         * 为了避免游戏永久卡死，
         * 让所有人重新参与一次投票。
         */

        let nextCandidates =
            topCandidates;


        if (
            eligibleOutside.length ===
            0
        ) {

            nextCandidates =
                room.players.map(
                    player =>
                        player.id
                );

        }


        io.to(
            room.code
        ).emit(
            "vote_tie",
            {
                candidates:
                    topCandidates,

                voteCounts:
                    counts
            }
        );


        startVotingRound(
            room,
            nextCandidates,
            true
        );


        return;

    }


    /*
     * ==================================================
     * 唯一最高票
     * ==================================================
     */

    const eliminatedId =
        topCandidates[0];


    const eliminatedPlayer =
        room.currentGame.players.find(
            player =>
                player.id ===
                eliminatedId
        );


    if (!eliminatedPlayer) {

        return;

    }


    let winner =
        "SPY";


    let winnerText =
        "🕵️ 内鬼阵营胜利";


    /*
     * 被投到呆呆鸟
     */

    if (
        eliminatedPlayer.role ===
        "DODO"
    ) {

        winner =
            "DODO";


        winnerText =
            "🦤 呆呆鸟单独胜利";

    }


    /*
     * 被投到内鬼
     */

    else if (
        eliminatedPlayer.role ===
        "SPY"
    ) {

        winner =
            "CIVILIAN";


        winnerText =
            "🛡️ 平民阵营胜利";

    }


    /*
     * 被投到平民
     */

    else {

        winner =
            "SPY";


        winnerText =
            "🕵️ 内鬼阵营胜利";

    }


    /*
     * 保存投票结果
     */

    room.currentGame.voting.result = {

        round:
            voting.round,

        eliminatedId:
            eliminatedId,

        eliminatedName:
            eliminatedPlayer.name,

        eliminatedRole:
            eliminatedPlayer.role,

        counts:
            counts,

        winner:
            winner,

        winnerText:
            winnerText

    };


    room.state =
        "REVEAL";


    room.currentGame.state =
        "REVEAL";


    /*
     * 公开所有身份
     */

    const result =
        getPublicGame(
            room.currentGame,
            true
        );


    result.voteResult =
        room.currentGame.voting.result;


    result.isTestRoom =
        room.isTestRoom === true;


    io.to(
        room.code
    ).emit(
        "room_update",
        getClientRoom(room)
    );


    io.to(
        room.code
    ).emit(
        "game_finished",
        result
    );


    console.log(
        `投票结束: ${room.code}, ` +
        `淘汰: ${eliminatedPlayer.name}, ` +
        `身份: ${eliminatedPlayer.role}, ` +
        `结果: ${winnerText}`
    );

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
     * PLAYING
     */

    if (
        room.state ===
        "PLAYING"
    ) {

        /*
         * 测试房间可以看到全部身份
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

            socket.emit(
                "game_started",
                getPublicGame(
                    room.currentGame,
                    false
                )
            );


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
     * VOTING
     */

    if (
        room.state ===
        "VOTING"
    ) {

        sendVotingToSocket(
            socket,
            room
        );

    }


    /*
     * REVEAL
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
            room.currentGame.voting &&
            room.currentGame.voting.result
        ) {

            result.voteResult =
                room.currentGame.voting.result;

        }


        result.isTestRoom =
            room.isTestRoom === true;


        socket.emit(
            "game_finished",
            result
        );

    }

}


/*
 * ======================================================
 * 给所有真人发送私人身份
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


    room.players.forEach(
        player => {

            if (
                player.isBot ===
                true
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


                    room.isTestRoom =
                        false;


                    room.departedPlayers =
                        [];


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
         * 单人测试房间
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


                    socket.playerName =
                        name;


                    const player =
                        room.players.find(
                            p =>
                                p.name ===
                                name
                        );


                    /*
                     * 玩家已经在活跃列表
                     */

                    if (player) {

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


                    } else {

                        /*
                         * 尝试从离开列表恢复
                         */

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
                        `玩家重连成功: ${name}, ` +
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


                    socket.playerName =
                        playerName;


                    /*
                     * 优先尝试恢复离开玩家
                     */

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
                     * 已经存在的玩家
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
                     * 新玩家只能加入等待中的普通房间
                     */

                    if (
                        room.state !==
                        "WAITING"
                    ) {

                        socket.emit(
                            "error_message",
                            "游戏已经开始，新玩家不能加入这个房间；原玩家请使用原昵称重新加入"
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
                            "当前不能开始游戏"
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
                            `需要 ${maxPlayers} 人才能开始，目前有 ${room.players.length} 人`
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
                     * 测试房间
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
                        `第 ${room.round} 局`
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
         * 结束本局 / 开始投票
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
                            "只有房主可以开始投票"
                        );

                        return;

                    }


                    if (
                        room.state !==
                        "PLAYING"
                    ) {

                        socket.emit(
                            "error_message",
                            "当前不是游戏进行阶段"
                        );

                        return;

                    }


                    /*
                     * 分组模式：
                     * 没有身份，不需要投票
                     */

                    if (
                        room.mode ===
                        "TEAM"
                    ) {

                        room.state =
                            "REVEAL";


                        room.currentGame.state =
                            "REVEAL";


                        const result =
                            getPublicGame(
                                room.currentGame,
                                true
                            );


                        result.isTestRoom =
                            room.isTestRoom === true;


                        io.to(
                            room.code
                        ).emit(
                            "room_update",
                            getClientRoom(room)
                        );


                        io.to(
                            room.code
                        ).emit(
                            "game_finished",
                            result
                        );


                        console.log(
                            `分组游戏结束: ${room.code}`
                        );


                        return;

                    }


                    /*
                     * 内鬼模式开始第一轮投票
                     */

                    const candidateIds =
                        room.players.map(
                            player =>
                                player.id
                        );


                    startVotingRound(
                        room,
                        candidateIds,
                        false
                    );


                } catch (error) {

                    console.error(
                        "finish_game 错误:",
                        error
                    );


                    socket.emit(
                        "error_message",
                        "开始投票失败"
                    );

                }

            }
        );


        /*
         * ==================================================
         * 玩家投票
         * ==================================================
         */

        socket.on(
            "cast_vote",
            data => {

                try {

                    const room =
                        getRoom(
                            socket.roomCode
                        );


                    if (!room) {

                        socket.emit(
                            "vote_error",
                            "房间不存在"
                        );

                        return;

                    }


                    if (
                        room.state !==
                        "VOTING"
                    ) {

                        socket.emit(
                            "vote_error",
                            "当前不是投票阶段"
                        );

                        return;

                    }


                    if (
                        !room.currentGame ||
                        !room.currentGame.voting
                    ) {

                        socket.emit(
                            "vote_error",
                            "投票数据不存在"
                        );

                        return;

                    }


                    const targetId =
                        data &&
                        data.targetId;


                    if (!targetId) {

                        socket.emit(
                            "vote_error",
                            "请选择投票对象"
                        );

                        return;

                    }


                    const voting =
                        room.currentGame.voting;


                    const candidates =
                        getVotingCandidates(
                            room
                        );


                    const eligibleVoters =
                        getEligibleVoters(
                            room
                        );


                    /*
                     * 检查投票资格
                     */

                    if (
                        !eligibleVoters.some(
                            player =>
                                player.id ===
                                socket.id
                        )
                    ) {

                        socket.emit(
                            "vote_error",
                            "你没有本轮投票资格"
                        );

                        return;

                    }


                    /*
                     * 每个人每轮只能投一次
                     */

                    if (
                        Object.prototype.hasOwnProperty.call(
                            voting.votes,
                            socket.id
                        )
                    ) {

                        socket.emit(
                            "vote_error",
                            "你已经投过票了"
                        );

                        return;

                    }


                    /*
                     * 第一轮不能投自己
                     */

                    if (
                        voting.round ===
                        1 &&
                        targetId ===
                        socket.id
                    ) {

                        socket.emit(
                            "vote_error",
                            "不能投自己"
                        );

                        return;

                    }


                    /*
                     * 重投时：
                     * 只能投候选人
                     */

                    if (
                        voting.round >
                        1 &&
                        !candidates.includes(
                            targetId
                        )
                    ) {

                        socket.emit(
                            "vote_error",
                            "重投只能选择上一轮平票候选人"
                        );

                        return;

                    }


                    /*
                     * 检查目标确实存在
                     */

                    const targetPlayer =
                        room.currentGame.players.find(
                            player =>
                                player.id ===
                                targetId
                        );


                    if (!targetPlayer) {

                        socket.emit(
                            "vote_error",
                            "投票对象不存在"
                        );

                        return;

                    }


                    /*
                     * 写入票
                     */

                    voting.votes[
                        socket.id
                    ] =
                        targetId;


                    /*
                     * 告诉投票者成功
                     */

                    socket.emit(
                        "vote_submitted",
                        {
                            targetId:
                                targetId
                        }
                    );


                    /*
                     * 检查是否已经全部投完
                     */

                    processVoting(
                        room
                    );

                } catch (error) {

                    console.error(
                        "cast_vote 错误:",
                        error
                    );


                    socket.emit(
                        "vote_error",
                        "投票失败"
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
                     * 测试模式
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
         * 房主：
         * 关闭整个房间。
         *
         * 普通玩家：
         * 从当前房间移除，
         * 但保存在 departedPlayers，
         * 以后可以重新加入。
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
                     * ======================================
                     * 房主退出
                     * ======================================
                     */

                    if (wasHost) {

                        console.log(
                            `房主退出，关闭房间: ${roomCode}`
                        );


                        /*
                         * 通知其他玩家
                         */

                        io.to(
                            roomCode
                        ).emit(
                            "room_closed",
                            {
                                message:
                                    "房主已经退出，房间已关闭"
                            }
                        );


                        /*
                         * 所有人退出 Socket.IO 房间
                         */

                        const socketIds =
                            io.sockets.adapter.rooms.get(
                                roomCode
                            );


                        if (socketIds) {

                            socketIds.forEach(
                                id => {

                                    const target =
                                        io.sockets.sockets.get(
                                            id
                                        );


                                    if (target) {

                                        target.leave(
                                            roomCode
                                        );


                                        target.roomCode =
                                            null;

                                        target.playerName =
                                            null;

                                    }

                                }
                            );

                        }


                        deleteRoom(
                            roomCode
                        );


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
                     * ======================================
                     * 普通玩家离开
                     * ======================================
                     */

                    if (
                        !Array.isArray(
                            room.departedPlayers
                        )
                    ) {

                        room.departedPlayers =
                            [];

                    }


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
                            false

                    });


                    /*
                     * 投票中退出：
                     * 删除这名玩家已经投出的票。
                     */

                    if (
                        room.currentGame &&
                        room.currentGame.voting
                    ) {

                        delete room.currentGame.voting.votes[
                            socket.id
                        ];

                    }


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


                    io.to(
                        roomCode
                    ).emit(
                        "room_update",
                        getClientRoom(room)
                    );


                    console.log(
                        `普通玩家退出: ${player.name}, ` +
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
         * 不删除玩家。
         *
         * 玩家回来以后继续原房间。
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