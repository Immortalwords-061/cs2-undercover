const {
    assignTasks,
    shuffle
} = require("./taskManager");


// =========================
// 创建游戏
// =========================

function createGame(
    players,
    round,
    mode = "UNDERCOVER"
) {

    // =========================
    // 8人普通分组模式
    // =========================

    if (mode === "TEAM") {

        if (players.length !== 8) {

            throw new Error(
                "8人分组模式必须正好8名玩家"
            );

        }


        // 清除上一局数据

        players.forEach(player => {

            player.team = null;

            player.role = null;

            player.task = null;

        });


        // 随机玩家

        const shuffledPlayers =
            shuffle(players);


        // 4 CT

        shuffledPlayers
            .slice(0, 4)
            .forEach(player => {

                player.team = "CT";

            });


        // 4 T

        shuffledPlayers
            .slice(4, 8)
            .forEach(player => {

                player.team = "T";

            });


        // =========================
        // 8人模式没有内鬼
        // 没有任务
        // =========================

        const game = {

            round: round,

            mode: "TEAM",

            state: "PLAYING",

            startedAt: Date.now(),

            players:
                players.map(player => ({

                    id: player.id,

                    name: player.name,

                    team: player.team,

                    role: null,

                    task: null

                }))

        };


        return game;

    }


    // =========================
    // 原来的10人内鬼模式
    // =========================

    if (players.length !== 10) {

        throw new Error(
            "10人内鬼模式必须正好10名玩家"
        );

    }


    players.forEach(player => {

        player.team = null;

        player.role = null;

        player.task = null;

    });


    const shuffledPlayers =
        shuffle(players);


    // 5 CT

    shuffledPlayers
        .slice(0, 5)
        .forEach(player => {

            player.team = "CT";

        });


    // 5 T

    shuffledPlayers
        .slice(5, 10)
        .forEach(player => {

            player.team = "T";

        });


    // =========================
    // CT 内鬼
    // =========================

    const ctPlayers =
        players.filter(
            player =>
                player.team === "CT"
        );


    const ctSpy =
        ctPlayers[
            Math.floor(
                Math.random() *
                ctPlayers.length
            )
        ];


    ctSpy.role = "SPY";


    // =========================
    // T 内鬼
    // =========================

    const tPlayers =
        players.filter(
            player =>
                player.team === "T"
        );


    const tSpy =
        tPlayers[
            Math.floor(
                Math.random() *
                tPlayers.length
            )
        ];


    tSpy.role = "SPY";


    // =========================
    // 其他人是好人
    // =========================

    players.forEach(player => {

        if (!player.role) {

            player.role = "GOOD";

        }

    });


    // =========================
    // 分配任务
    // =========================

    assignTasks(players);


    // =========================
    // 创建10人游戏
    // =========================

    const game = {

        round: round,

        mode: "UNDERCOVER",

        state: "PLAYING",

        startedAt: Date.now(),

        players:
            players.map(player => ({

                id: player.id,

                name: player.name,

                team: player.team,

                role: player.role,

                task: player.task

            }))

    };


    return game;

}


// =========================
// 获取公开游戏信息
// =========================

function getPublicGame(
    game,
    reveal = false
) {

    return {

        round: game.round,

        mode: game.mode,

        state: game.state,

        players:
            game.players.map(player => {

                const result = {

                    id: player.id,

                    name: player.name,

                    team: player.team

                };


                // 只有10人内鬼模式
                // 才需要公开身份和任务

                if (
                    reveal &&
                    game.mode ===
                    "UNDERCOVER"
                ) {

                    result.role =
                        player.role;

                    result.task =
                        player.task;

                }


                return result;

            })

    };

}


// =========================
// 获取玩家自己的秘密信息
// =========================

function getPrivatePlayerInfo(
    game,
    playerId
) {

    const player =
        game.players.find(
            player =>
                player.id === playerId
        );


    if (!player) {

        return null;

    }


    // =========================
    // 8人模式
    // =========================

    if (
        game.mode ===
        "TEAM"
    ) {

        return {

            name: player.name,

            team: player.team,

            role: null,

            task: null

        };

    }


    // =========================
    // 10人内鬼模式
    // =========================

    return {

        name: player.name,

        team: player.team,

        role: player.role,

        task: player.task

    };

}


// =========================
// 导出
// =========================

module.exports = {

    createGame,

    getPublicGame,

    getPrivatePlayerInfo

};