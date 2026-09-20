const {
    assignTasks,
    shuffle
} = require("./taskManager");

function getTeamCounts(playerCount) {
    const ctCount =
        Math.ceil(playerCount / 2);

    const tCount =
        Math.floor(playerCount / 2);

    return {
        ctCount,
        tCount
    };
}

function createGame(
    players,
    round,
    mode = "UNDERCOVER"
) {
    if (
        players.length < 6 ||
        players.length > 16
    ) {
        throw new Error(
            "游戏人数必须在6到16人之间"
        );
    }

    players.forEach(player => {
        player.team = null;
        player.role = null;
        player.task = null;
    });

    const shuffledPlayers =
        shuffle(players);

    const {
        ctCount,
        tCount
    } = getTeamCounts(
        players.length
    );

    shuffledPlayers
        .slice(0, ctCount)
        .forEach(player => {
            player.team = "CT";
        });

    shuffledPlayers
        .slice(
            ctCount,
            ctCount + tCount
        )
        .forEach(player => {
            player.team = "T";
        });

    /*
     * 组队模式
     *
     * 没有内鬼
     * 没有任务
     */
    if (mode === "TEAM") {
        return {
            round,

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
    }

    /*
     * 内鬼模式
     *
     * 每个队伍随机一名内鬼
     */

    const ctPlayers =
        players.filter(
            player =>
                player.team === "CT"
        );

    const tPlayers =
        players.filter(
            player =>
                player.team === "T"
        );

    const ctSpy =
        ctPlayers[
            Math.floor(
                Math.random() *
                ctPlayers.length
            )
        ];

    const tSpy =
        tPlayers[
            Math.floor(
                Math.random() *
                tPlayers.length
            )
        ];

    ctSpy.role = "SPY";

    tSpy.role = "SPY";

    players.forEach(player => {
        if (!player.role) {
            player.role = "GOOD";
        }
    });

    /*
     * 好人获得任务
     * 内鬼获得内鬼任务
     */
    assignTasks(players);

    return {
        round,

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
}

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

                /*
                 * 游戏结束后才公开
                 * 身份和任务
                 */
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

    /*
     * 组队模式
     * 不存在身份和任务
     */
    if (game.mode === "TEAM") {
        return {
            name: player.name,

            team: player.team,

            role: null,

            task: null
        };
    }

    /*
     * 内鬼模式
     */
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