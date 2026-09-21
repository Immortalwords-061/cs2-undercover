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
        message: "CS2 Undercover Server",
        status: "running"
    });
});


/*
 * ======================================================
 * HTTP / Socket.IO
 * ======================================================
 */

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
 * 房间公共数据
 * ======================================================
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
 * 初始化附加房间数据
 * ======================================================
 */

function ensureRoomData(room) {

    if (
        !Array.isArray(
            room.departedPlayers
        )
    ) {

        room.departedPlayers =
            [];

    }

}


/*
 * ======================================================
 * 同步游戏玩家 socket
 * ======================================================
 */

function syncGamePlayerSocketId(
    room,
    playerName,
    socketId
) {

    if (
        !room.currentGame
    ) {

        return;

    }


    const gamePlayer =
        room.currentGame.players.find(
            player =>
                player.name ===
                playerName
        );


    if (!gamePlayer) {

        return;

    }


    gamePlayer.id =
        socketId;

}


/*
 * ======================================================
 * 恢复离开玩家
 * ======================================================
 */

function restoreDepartedPlayer(
    room,
    socket
) {

    ensureRoomData(room);


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
     * 如果当前游戏里还保留着这个人，
     * 更新 socket。
     */

    if (
        room.currentGame
    ) {

        const existingGamePlayer =
            room.currentGame.players.find(
                player =>
                    player.name ===
                    restoredPlayer.name
            );


        if (
            existingGamePlayer
        ) {

            existingGamePlayer.id =
                socket.id;

            existingGamePlayer.team =
                restoredPlayer.team;

            existingGamePlayer.role =
                restoredPlayer.role;

            existingGamePlayer.task =
                restoredPlayer.task;

        } else if (
            room.state ===
                "PLAYING" ||
            room.state ===
                "VOTING"
        ) {

            /*
             * 玩家在游戏中途退出后重新加入，
             * 补回当前游戏。
             */

            room.currentGame.players.push({

                id:
                    socket.id,

                name:
                    restoredPlayer.name,

                team:
                    restoredPlayer.team,

                role:
                    restoredPlayer.role,

                task:
                    restoredPlayer.task,

                isBot:
                    false

            });

        }

    }


    syncGamePlayerSocketId(
        room,
        restoredPlayer.name,
        socket.id
    );


    return restoredPlayer;
}


/*
 * ======================================================
 * 查找房间玩家
 * ======================================================
 */

function findRoomPlayerBySocket(
    room,
    socketId
) {

    return room.players.find(
        player =>
            player.id === socketId
    );

}


/*
 * ======================================================
 * 查找当前游戏玩家
 * ======================================================
 */

function findGamePlayer(
    room,
    playerId
) {

    if (
        !room.currentGame
    ) {

        return null;

    }


    return room.currentGame.players.find(
        player =>
            player.id === playerId
    ) || null;

}


/*
 * ======================================================
 * 获取某阵营玩家
 * ======================================================
 */

function getTeamPlayers(
    room,
    team
) {

    return room.players.filter(
        player =>
            player.team === team
    );

}


/*
 * ======================================================
 * 获取某阵营投票状态
 * ======================================================
 */

function getTeamVoting(
    room,
    team
) {

    if (
        !room.currentGame ||
        !room.currentGame.voting ||
        !room.currentGame.voting.teams
    ) {

        return null;

    }


    return (
        room.currentGame.voting.teams[team] ||
        null
    );

}


/*
 * ======================================================
 * 获取某阵营候选人
 * ======================================================
 */

function getTeamCandidates(
    room,
    team
) {

    const voting =
        getTeamVoting(
            room,
            team
        );


    if (!voting) {

        return [];

    }


    return (
        voting.candidates ||
        []
    );

}


/*
 * ======================================================
 * 判断当前阵营是否存在“其他玩家”
 * ======================================================
 */

function hasOutsideVoters(
    room,
    team,
    candidates
) {

    return getTeamPlayers(
        room,
        team
    ).some(
        player =>
            !candidates.includes(
                player.id
            )
    );

}


/*
 * ======================================================
 * 获取某阵营当前有资格投票的人
 * ======================================================
 */

function getEligibleVoters(
    room,
    team
) {

    const voting =
        getTeamVoting(
            room,
            team
        );


    if (!voting) {

        return [];

    }


    const teamPlayers =
        getTeamPlayers(
            room,
            team
        );


    const candidates =
        voting.candidates ||
        [];


    const excludeCandidates =
        voting.round > 1 &&
        voting.excludeCandidates === true;


    return teamPlayers.filter(
        player => {

            /*
             * 平票重投：
             * 并列候选人不能投。
             *
             * 如果全员平票，
             * 则 excludeCandidates = false，
             * 全员再次投。
             */

            if (
                excludeCandidates &&
                candidates.includes(
                    player.id
                )
            ) {

                return false;

            }


            /*
             * Bot 永远可以自动投票
             */

            if (
                player.isBot === true
            ) {

                return true;

            }


            /*
             * 真人必须在线
             */

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
 * 某阵营投票公共状态
 * ======================================================
 */

function getTeamVotingPublicState(
    room,
    socket
) {

    const player =
        findRoomPlayerBySocket(
            room,
            socket.id
        );


    if (!player) {

        return null;

    }


    const team =
        player.team;


    const voting =
        getTeamVoting(
            room,
            team
        );


    if (!voting) {

        return null;

    }


    const candidates =
        getTeamCandidates(
            room,
            team
        );


    const eligibleVoters =
        getEligibleVoters(
            room,
            team
        );


    const votes =
        voting.votes ||
        {};


    const hasVoted =
        Object.prototype.hasOwnProperty.call(
            votes,
            player.name
        );


    const canVote =
        !voting.finished &&
        !voting.processingTie &&
        eligibleVoters.some(
            voter =>
                voter.id ===
                socket.id
        );


    const candidatePlayers =
        candidates
            .map(
                candidateId =>
                    findGamePlayer(
                        room,
                        candidateId
                    )
            )
            .filter(Boolean);


    return {

        team:
            team,

        round:
            voting.round,

        revote:
            voting.round > 1,

        candidates:
            candidatePlayers.map(
                candidate => ({

                    id:
                        candidate.id,

                    name:
                        candidate.name,

                    team:
                        candidate.team

                })
            ),

        votedCount:
            Object.keys(
                votes
            ).length,

        voterCount:
            eligibleVoters.length,

        hasVoted:
            hasVoted,

        canVote:
            canVote,

        finished:
            voting.finished === true,

        processingTie:
            voting.processingTie === true

    };

}


/*
 * ======================================================
 * 给某个玩家发送投票界面
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


    const player =
        findRoomPlayerBySocket(
            room,
            socket.id
        );


    if (!player) {

        return;

    }


    const voting =
        getTeamVoting(
            room,
            player.team
        );


    if (!voting) {

        return;

    }


    /*
     * 这一方已经结束，
     * 只等待另一方。
     */

    if (
        voting.finished
    ) {

        socket.emit(
            "team_vote_finished_waiting",
            {

                team:
                    player.team,

                message:
                    `你所在的 ${player.team} 阵营投票已经结束，等待另一阵营...`

            }
        );


        return;

    }


    socket.emit(
        "voting_started",
        getTeamVotingPublicState(
            room,
            socket
        )
    );

}


/*
 * ======================================================
 * 给整个房间发送当前投票状态
 * ======================================================
 */

function broadcastVotingState(
    room
) {

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

}


/*
 * ======================================================
 * Bot 自动投票
 * ======================================================
 */

function autoBotVotesForTeam(
    room,
    team
) {

    if (
        !room.isTestRoom
    ) {

        return;

    }


    const voting =
        getTeamVoting(
            room,
            team
        );


    if (!voting) {

        return;

    }


    if (
        voting.finished
    ) {

        return;

    }


    const eligibleBots =
        getEligibleVoters(
            room,
            team
        ).filter(
            player =>
                player.isBot === true
        );


    const candidates =
        getTeamCandidates(
            room,
            team
        );


    eligibleBots.forEach(
        bot => {

            /*
             * 每轮每个 Bot 只能投一次
             */

            if (
                Object.prototype.hasOwnProperty.call(
                    voting.votes,
                    bot.name
                )
            ) {

                return;

            }


            let choices;


            /*
             * 第一轮：
             * 投同阵营其他玩家。
             */

            if (
                voting.round === 1
            ) {

                choices =
                    getTeamPlayers(
                        room,
                        team
                    ).filter(
                        player =>
                            player.id !==
                            bot.id
                    );

            } else {

                /*
                 * 重投：
                 * 只能投平票候选人。
                 */

                choices =
                    room.currentGame.players.filter(
                        player =>
                            player.team ===
                                team &&
                            candidates.includes(
                                player.id
                            ) &&
                            player.id !==
                                bot.id
                    );

            }


            /*
             * 没有可投对象
             */

            if (
                choices.length === 0
            ) {

                return;

            }


            let target;


            if (
                voting.round === 1
            ) {

                /*
                 * 第一轮随机，
                 * 可以体验不同结果。
                 */

                target =
                    choices[
                        Math.floor(
                            Math.random() *
                            choices.length
                        )
                    ];

            } else {

                /*
                 * 重投使用固定选择，
                 * 防止测试 Bot 反复随机造成难以测试。
                 */

                target =
                    choices[0];

            }


            voting.votes[
                bot.name
            ] =
                target.id;

        }
    );

}


/*
 * ======================================================
 * 开始某阵营投票轮次
 * ======================================================
 */

function startTeamVotingRound(
    room,
    team,
    candidateIds,
    isRevote
) {

    const activePlayers =
        getTeamPlayers(
            room,
            team
        );


    const activeIds =
        activePlayers.map(
            player =>
                player.id
        );


    let finalCandidates =
        candidateIds.filter(
            id =>
                activeIds.includes(
                    id
                )
        );


    /*
     * 候选人如果全部离开，
     * 回到该阵营所有玩家。
     */

    if (
        finalCandidates.length ===
        0
    ) {

        finalCandidates =
            activeIds;

    }


    /*
     * 平票重投：
     *
     * 如果存在非候选人：
     * 候选人不能投。
     *
     * 如果所有人都是候选人：
     * 全员再次投。
     */

    const outsideExists =
        hasOutsideVoters(
            room,
            team,
            finalCandidates
        );


    const voting = {

        team:
            team,

        round:
            isRevote
                ? (
                    getTeamVoting(
                        room,
                        team
                    )
                        ? getTeamVoting(
                            room,
                            team
                        ).round + 1
                        : 2
                )
                : 1,

        candidates:
            finalCandidates,

        votes:
            {},

        excludeCandidates:
            isRevote &&
            outsideExists,

        processingTie:
            false,

        finished:
            false,

        result:
            null

    };


    if (
        !room.currentGame.voting
    ) {

        room.currentGame.voting = {

            teams: {}

        };

    }


    room.currentGame.voting.teams[
        team
    ] =
        voting;


    /*
     * 单人测试自动投票
     */

    autoBotVotesForTeam(
        room,
        team
    );


    /*
     * 下一轮异步检查
     */

    setTimeout(
        () => {

            processTeamVoting(
                room,
                team
            );

        },
        0
    );

}


/*
 * ======================================================
 * 计某阵营票
 * ======================================================
 */

function countTeamVotes(
    room,
    team
) {

    const voting =
        getTeamVoting(
            room,
            team
        );


    const counts = {};


    if (!voting) {

        return counts;

    }


    voting.candidates.forEach(
        candidateId => {

            counts[
                candidateId
            ] =
                0;

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
 * 构造单阵营胜负
 * ======================================================
 */

function createTeamVoteResult(
    room,
    team,
    targetId,
    counts,
    round
) {

    const eliminatedPlayer =
        findGamePlayer(
            room,
            targetId
        );


    if (!eliminatedPlayer) {

        return null;

    }


    let winner =
        "SPY";


    let winnerText =
        `${team} 阵营内鬼胜利`;


    /*
     * 投到内鬼
     */

    if (
        eliminatedPlayer.role ===
        "SPY"
    ) {

        winner =
            "CIVILIAN";


        winnerText =
            `${team} 平民阵营胜利`;

    }


    /*
     * 投到呆呆鸟
     */

    else if (
        eliminatedPlayer.role ===
        "DODO"
    ) {

        winner =
            "DODO";


        winnerText =
            `${team} 呆呆鸟单独胜利`;

    }


    /*
     * 投到平民
     */

    else {

        winner =
            "SPY";


        winnerText =
            `${team} 阵营内鬼胜利`;

    }


    return {

        team:
            team,

        round:
            round,

        eliminatedId:
            eliminatedPlayer.id,

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

}


/*
 * ======================================================
 * 判断两个阵营是否都结束
 * ======================================================
 */

function bothTeamsFinished(
    room
) {

    const ct =
        getTeamVoting(
            room,
            "CT"
        );


    const t =
        getTeamVoting(
            room,
            "T"
        );


    return Boolean(
        ct &&
        ct.finished &&
        t &&
        t.finished
    );

}


/*
 * ======================================================
 * 最终结束游戏
 * ======================================================
 */

function finishAllVoting(
    room
) {

    if (
        !bothTeamsFinished(
            room
        )
    ) {

        return;

    }


    room.state =
        "REVEAL";


    room.currentGame.state =
        "REVEAL";


    const ctVoting =
        getTeamVoting(
            room,
            "CT"
        );


    const tVoting =
        getTeamVoting(
            room,
            "T"
        );


    const voteResult = {

        CT:
            ctVoting.result,

        T:
            tVoting.result

    };


    room.currentGame.voting.result =
        voteResult;


    const result =
        getPublicGame(
            room.currentGame,
            true
        );


    result.voteResult =
        voteResult;


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
        `投票全部结束: ${room.code}`
    );

}


/*
 * ======================================================
 * 处理某阵营投票
 * ======================================================
 */

function processTeamVoting(
    room,
    team
) {

    if (
        room.state !==
        "VOTING"
    ) {

        return;

    }


    const voting =
        getTeamVoting(
            room,
            team
        );


    if (!voting) {

        return;

    }


    if (
        voting.finished
    ) {

        return;

    }


    if (
        voting.processingTie
    ) {

        return;

    }


    const eligibleVoters =
        getEligibleVoters(
            room,
            team
        );


    const votedCount =
        Object.keys(
            voting.votes
        ).length;


    /*
     * ==================================================
     * 尚未全部投完
     * ==================================================
     */

    if (
        votedCount <
        eligibleVoters.length
    ) {

        room.players.forEach(
            player => {

                if (
                    player.isBot ===
                    true ||
                    player.team !==
                    team
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

                        team:
                            team,

                        votedCount:
                            votedCount,

                        voterCount:
                            eligibleVoters.length,

                        hasVoted:
                            Object.prototype.hasOwnProperty.call(
                                voting.votes,
                                player.name
                            )

                    }
                );

            }
        );


        return;

    }


    /*
     * ==================================================
     * 全部投完
     * ==================================================
     */

    const counts =
        countTeamVotes(
            room,
            team
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

        voting.processingTie =
            true;


        /*
         * 通知该阵营的真人
         */

        room.players.forEach(
            player => {

                if (
                    player.isBot ===
                    true ||
                    player.team !==
                    team
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
                    "vote_tie",
                    {

                        team:
                            team,

                        round:
                            voting.round,

                        candidates:
                            topCandidates,

                        voteCounts:
                            counts

                    }
                );

            }
        );


        /*
         * 重要：
         *
         * 不直接递归调用自己。
         *
         * 等 700ms 后开新一轮。
         */

        setTimeout(
            () => {

                /*
                 * 房间可能已经关闭
                 */

                if (
                    !getRoom(
                        room.code
                    )
                ) {

                    return;

                }


                /*
                 * 如果候选人全部离开，
                 * 重新使用该阵营当前所有人。
                 */

                const activeIds =
                    getTeamPlayers(
                        room,
                        team
                    ).map(
                        player =>
                            player.id
                    );


                const stillHaveCandidate =
                    topCandidates.some(
                        candidateId =>
                            activeIds.includes(
                                candidateId
                            )
                    );


                const nextCandidates =
                    stillHaveCandidate
                        ? topCandidates
                        : activeIds;


                /*
                 * 如果没人了，
                 * 无法继续该阵营投票。
                 */

                if (
                    nextCandidates.length ===
                    0
                ) {

                    return;

                }


                startTeamVotingRound(
                    room,
                    team,
                    nextCandidates,
                    true
                );


                broadcastVotingState(
                    room
                );

            },
            700
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


    const result =
        createTeamVoteResult(
            room,
            team,
            eliminatedId,
            counts,
            voting.round
        );


    if (!result) {

        return;

    }


    voting.result =
        result;


    voting.finished =
        true;


    voting.processingTie =
        false;


    /*
     * 这一边投完。
     */

    room.players.forEach(
        player => {

            if (
                player.isBot ===
                true ||
                player.team !==
                team
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
                "team_vote_finished_waiting",
                {

                    team:
                        team,

                    message:
                        `${team} 阵营投票已经结束，等待另一阵营...`

                }
            );

        }
    );


    /*
     * 另一边还没结束
     */

    if (
        !bothTeamsFinished(
            room
        )
    ) {

        console.log(
            `${team} 投票完成，等待另一阵营: ${room.code}`
        );


        broadcastVotingState(
            room
        );


        return;

    }


    /*
     * 两边都完成
     */

    finishAllVoting(
        room
    );

}


/*
 * ======================================================
 * 删除玩家的当前游戏数据
 * ======================================================
 */

function removePlayerFromCurrentGame(
    room,
    player
) {

    if (
        !room.currentGame
    ) {

        return;

    }


    /*
     * 游戏进行中：
     * 真正删除。
     */

    if (
        room.state ===
            "PLAYING" ||
        room.state ===
            "VOTING"
    ) {

        room.currentGame.players =
            room.currentGame.players.filter(
                gamePlayer =>
                    gamePlayer.name !==
                    player.name
            );

    }


    /*
     * 投票期间清理相关票
     */

    if (
        room.currentGame.voting &&
        room.currentGame.voting.teams
    ) {

        ["CT", "T"].forEach(
            team => {

                const voting =
                    room.currentGame.voting.teams[
                        team
                    ];


                if (!voting) {

                    return;

                }


                delete voting.votes[
                    player.name
                ];


                /*
                 * 删除作为候选人的资格
                 */

                voting.candidates =
                    voting.candidates.filter(
                        id =>
                            id !==
                            player.id
                    );


                /*
                 * 删除别人投给他的票
                 */

                Object.keys(
                    voting.votes
                ).forEach(
                    voterName => {

                        if (
                            voting.votes[
                                voterName
                            ] ===
                            player.id
                        ) {

                            delete voting.votes[
                                voterName
                            ];

                        }

                    }
                );

            }
        );

    }

}


/*
 * ======================================================
 * 发送私人身份
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
 * 恢复当前游戏
 * ======================================================
 */

function sendCurrentGameToSocket(
    socket,
    room
) {

    if (
        !room.currentGame
    ) {

        return;

    }


    /*
     * PLAYING
     */

    if (
        room.state ===
        "PLAYING"
    ) {

        if (
            room.isTestRoom
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


                    const newRoom =
                        createRoom(
                            socket.id,
                            playerName,
                            mode,
                            count
                        );


                    newRoom.isTestRoom =
                        false;


                    newRoom.departedPlayers =
                        [];


                    newRoom.players.push({

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
                        newRoom.code;

                    socket.playerName =
                        playerName;


                    socket.join(
                        newRoom.code
                    );


                    socket.emit(
                        "room_created",
                        getClientRoom(
                            newRoom
                        )
                    );


                    io.to(
                        newRoom.code
                    ).emit(
                        "room_update",
                        getClientRoom(
                            newRoom
                        )
                    );


                    console.log(
                        `创建房间: ${newRoom.code}`
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


                    const newRoom =
                        createRoom(
                            socket.id,
                            playerName,
                            mode,
                            count
                        );


                    newRoom.isTestRoom =
                        true;


                    newRoom.departedPlayers =
                        [];


                    /*
                     * 真人
                     */

                    newRoom.players.push({

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

                        newRoom.players.push({

                            id:
                                `bot-${newRoom.code}-${i}`,

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
                        newRoom.code;

                    socket.playerName =
                        playerName;


                    socket.join(
                        newRoom.code
                    );


                    socket.emit(
                        "room_created",
                        getClientRoom(
                            newRoom
                        )
                    );


                    io.to(
                        newRoom.code
                    ).emit(
                        "room_update",
                        getClientRoom(
                            newRoom
                        )
                    );


                    console.log(
                        `测试房间: ${newRoom.code}`
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


                    const existing =
                        room.players.find(
                            player =>
                                player.name ===
                                name
                        );


                    if (existing) {

                        if (
                            existing.isBot
                        ) {

                            socket.emit(
                                "rejoin_failed",
                                "这个昵称属于测试机器人"
                            );

                            return;

                        }


                        existing.id =
                            socket.id;


                        socket.roomCode =
                            room.code;


                        socket.join(
                            room.code
                        );


                        if (
                            room.hostName ===
                            existing.name
                        ) {

                            room.hostId =
                                socket.id;

                        }


                        syncGamePlayerSocketId(
                            room,
                            existing.name,
                            socket.id
                        );

                    } else {

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
                     * 优先恢复离开的人
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


                        return;

                    }


                    /*
                     * 已存在玩家
                     */

                    const existing =
                        room.players.find(
                            player =>
                                player.name ===
                                playerName
                        );


                    if (existing) {

                        if (
                            existing.isBot
                        ) {

                            socket.emit(
                                "error_message",
                                "这个昵称属于测试机器人，请换一个昵称"
                            );

                            return;

                        }


                        existing.id =
                            socket.id;


                        socket.roomCode =
                            room.code;


                        socket.playerName =
                            existing.name;


                        socket.join(
                            room.code
                        );


                        if (
                            room.hostName ===
                            existing.name
                        ) {

                            room.hostId =
                                socket.id;

                        }


                        syncGamePlayerSocketId(
                            room,
                            existing.name,
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
                     * 新人只能加入等待中的房间
                     */

                    if (
                        room.state !==
                        "WAITING"
                    ) {

                        socket.emit(
                            "error_message",
                            "游戏已经开始，新玩家不能加入；原玩家请使用原昵称重新加入"
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


                    if (
                        !room ||
                        !room.currentGame
                    ) {

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
                     * 测试模式
                     */

                    if (
                        room.isTestRoom
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
         * 结束游戏 / 开始 CT+T 独立投票
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
                     * TEAM 模式没有身份胜负，
                     * 直接揭晓。
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


                        return;

                    }


                    /*
                     * ==================================================
                     * 初始化双阵营投票
                     * ==================================================
                     */

                    room.state =
                        "VOTING";


                    room.currentGame.state =
                        "VOTING";


                    room.currentGame.voting = {

                        teams: {},

                        result:
                            null

                    };


                    /*
                     * CT 第一轮
                     */

                    startTeamVotingRound(
                        room,
                        "CT",
                        getTeamPlayers(
                            room,
                            "CT"
                        ).map(
                            player =>
                                player.id
                        ),
                        false
                    );


                    /*
                     * T 第一轮
                     */

                    startTeamVotingRound(
                        room,
                        "T",
                        getTeamPlayers(
                            room,
                            "T"
                        ).map(
                            player =>
                                player.id
                        ),
                        false
                    );


                    /*
                     * 给真人发送各自阵营的投票页
                     */

                    broadcastVotingState(
                        room
                    );


                    io.to(
                        room.code
                    ).emit(
                        "room_update",
                        getClientRoom(room)
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
         * 投票
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


                    const player =
                        findRoomPlayerBySocket(
                            room,
                            socket.id
                        );


                    if (!player) {

                        socket.emit(
                            "vote_error",
                            "你不在当前房间"
                        );

                        return;

                    }


                    const team =
                        player.team;


                    const voting =
                        getTeamVoting(
                            room,
                            team
                        );


                    if (!voting) {

                        socket.emit(
                            "vote_error",
                            "你所在阵营的投票不存在"
                        );

                        return;

                    }


                    if (
                        voting.finished
                    ) {

                        socket.emit(
                            "vote_error",
                            "你所在阵营已经完成投票"
                        );

                        return;

                    }


                    if (
                        voting.processingTie
                    ) {

                        socket.emit(
                            "vote_error",
                            "正在准备重新投票，请稍等"
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


                    /*
                     * 当前玩家是否有投票资格
                     */

                    const eligibleVoters =
                        getEligibleVoters(
                            room,
                            team
                        );


                    if (
                        !eligibleVoters.some(
                            voter =>
                                voter.id ===
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
                     * 一人一票
                     */

                    if (
                        Object.prototype.hasOwnProperty.call(
                            voting.votes,
                            player.name
                        )
                    ) {

                        socket.emit(
                            "vote_error",
                            "你已经投过票了"
                        );

                        return;

                    }


                    /*
                     * 不能投自己
                     */

                    if (
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
                     * 目标必须属于同阵营
                     */

                    const targetPlayer =
                        findGamePlayer(
                            room,
                            targetId
                        );


                    if (!targetPlayer) {

                        socket.emit(
                            "vote_error",
                            "投票对象不存在"
                        );

                        return;

                    }


                    if (
                        targetPlayer.team !==
                        team
                    ) {

                        socket.emit(
                            "vote_error",
                            "只能投自己阵营的玩家"
                        );

                        return;

                    }


                    /*
                     * 重投只能投候选人
                     */

                    if (
                        voting.round >
                        1 &&
                        !voting.candidates.includes(
                            targetId
                        )
                    ) {

                        socket.emit(
                            "vote_error",
                            "平票重投只能选择上一轮并列最高票玩家"
                        );

                        return;

                    }


                    /*
                     * 写入
                     */

                    voting.votes[
                        player.name
                    ] =
                        targetId;


                    socket.emit(
                        "vote_submitted",
                        {

                            team:
                                team,

                            targetId:
                                targetId

                        }
                    );


                    /*
                     * 异步计票
                     */

                    setTimeout(
                        () => {

                            processTeamVoting(
                                room,
                                team
                            );

                        },
                        0
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


                    if (
                        room.isTestRoom
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
         * 主动退出
         * ==================================================
         */

        socket.on(
            "leave_room",
            (data, maybeCallback) => {

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


                    if (!roomCode) {

                        if (callback) {

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


                        if (callback) {

                            callback({
                                success:
                                    true
                            });

                        }

                        return;

                    }


                    const player =
                        findRoomPlayerBySocket(
                            room,
                            socket.id
                        );


                    if (!player) {

                        socket.roomCode =
                            null;

                        socket.playerName =
                            null;


                        if (callback) {

                            callback({
                                success:
                                    true
                            });

                        }

                        return;

                    }


                    const isHost =
                        room.hostId ===
                        socket.id;


                    /*
                     * 房主退出：
                     * 关闭整个房间。
                     */

                    if (isHost) {

                        console.log(
                            `房主退出，关闭房间: ${roomCode}`
                        );


                        io.to(
                            roomCode
                        ).emit(
                            "room_closed",
                            {
                                message:
                                    "房主已经退出，房间已关闭"
                            }
                        );


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


                        if (callback) {

                            callback({
                                success:
                                    true
                            });

                        }


                        return;

                    }


                    /*
                     * 普通玩家退出
                     */

                    ensureRoomData(room);


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


                    removePlayerFromCurrentGame(
                        room,
                        player
                    );


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


                    /*
                     * 退出可能改变投票人数
                     */

                    if (
                        room.state ===
                        "VOTING"
                    ) {

                        setTimeout(
                            () => {

                                processTeamVoting(
                                    room,
                                    "CT"
                                );


                                processTeamVoting(
                                    room,
                                    "T"
                                );

                            },
                            0
                        );

                    }


                    if (callback) {

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


                    if (callback) {

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
         * 断开连接
         * ==================================================
         *
         * 不删除玩家。
         */

        socket.on(
            "disconnect",
            () => {

                console.log(
                    "玩家断开:",
                    socket.id,
                    socket.playerName || "未知"
                );


                const room =
                    getRoom(
                        socket.roomCode
                    );


                if (
                    !room ||
                    room.state !==
                    "VOTING"
                ) {

                    return;

                }


                const player =
                    findRoomPlayerBySocket(
                        room,
                        socket.id
                    );


                if (!player) {

                    return;

                }


                /*
                 * 掉线的人不再阻塞自己阵营的投票。
                 */

                setTimeout(
                    () => {

                        processTeamVoting(
                            room,
                            player.team
                        );

                    },
                    0
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