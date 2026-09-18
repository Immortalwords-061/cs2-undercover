const {
    assignTasks,
    shuffle
} = require("./taskManager");

function createGame(players, round) {

    if (players.length !== 10) {
        throw new Error(
            "必须正好10名玩家才能开始游戏"
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

    // CT 内鬼
    const ctPlayers =
        players.filter(
            player => player.team === "CT"
        );

    const ctSpy =
        ctPlayers[
            Math.floor(
                Math.random() *
                ctPlayers.length
            )
        ];

    ctSpy.role = "SPY";


    // T 内鬼
    const tPlayers =
        players.filter(
            player => player.team === "T"
        );

    const tSpy =
        tPlayers[
            Math.floor(
                Math.random() *
                tPlayers.length
            )
        ];

    tSpy.role = "SPY";


    // 其他人是好人
    players.forEach(player => {

        if (!player.role) {
            player.role = "GOOD";
        }

    });


    // 分配任务
    assignTasks(players);


    const game = {

        round: round,

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


/*
    reveal = false
    普通游戏状态：
    只公开名字和阵营

    reveal = true
    游戏结束：
    公开全部身份和任务
*/

function getPublicGame(
    game,
    reveal = false
) {

    return {

        round: game.round,

        state: game.state,

        players:
            game.players.map(player => {

                const result = {

                    id: player.id,

                    name: player.name,

                    team: player.team

                };

                if (reveal) {

                    result.role =
                        player.role;

                    result.task =
                        player.task;

                }

                return result;

            })

    };
}


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

    return {

        name: player.name,

        team: player.team,

        role: player.role,

        task: player.task

    };
}


module.exports = {

    createGame,

    getPublicGame,

    getPrivatePlayerInfo

};