const {
    assignTasks,
    shuffle
} = require("./taskManager");


/*
 * ======================================================
 * CT / T 人数
 * ======================================================
 */

function getTeamCounts(
    playerCount
) {

    const ctCount =
        Math.ceil(
            playerCount / 2
        );

    const tCount =
        Math.floor(
            playerCount / 2
        );

    return {
        ctCount,
        tCount
    };
}


/*
 * ======================================================
 * 创建游戏
 * ======================================================
 *
 * 内鬼模式：
 *
 * 每个阵营：
 *
 * 1 个内鬼
 * 1 个呆呆鸟
 * 其余平民
 *
 *
 * 分组模式：
 *
 * 只有 CT / T
 */

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


    /*
     * 清除上一局
     */

    players.forEach(
        player => {

            player.team =
                null;

            player.role =
                null;

            player.task =
                null;

        }
    );


    /*
     * 随机分队
     */

    const shuffledPlayers =
        shuffle(
            [...players]
        );


    const {
        ctCount,
        tCount
    } =
        getTeamCounts(
            players.length
        );


    /*
     * CT
     */

    shuffledPlayers
        .slice(
            0,
            ctCount
        )
        .forEach(
            player => {

                player.team =
                    "CT";

            }
        );


    /*
     * T
     */

    shuffledPlayers
        .slice(
            ctCount,
            ctCount + tCount
        )
        .forEach(
            player => {

                player.team =
                    "T";

            }
        );


    /*
     * ==================================================
     * 分组模式
     * ==================================================
     */

    if (
        mode ===
        "TEAM"
    ) {

        return {

            round:
                round,

            mode:
                "TEAM",

            state:
                "PLAYING",

            startedAt:
                Date.now(),

            players:
                players.map(
                    player => ({

                        id:
                            player.id,

                        name:
                            player.name,

                        team:
                            player.team,

                        role:
                            null,

                        task:
                            null,

                        isBot:
                            player.isBot === true

                    })
                )

        };
    }


    /*
     * ==================================================
     * 内鬼模式
     * ==================================================
     */

    const ctPlayers =
        players.filter(
            player =>
                player.team ===
                "CT"
        );


    const tPlayers =
        players.filter(
            player =>
                player.team ===
                "T"
        );


    /*
     * CT 内鬼
     */

    const ctSpy =
        ctPlayers[
            Math.floor(
                Math.random() *
                ctPlayers.length
            )
        ];


    ctSpy.role =
        "SPY";


    /*
     * T 内鬼
     */

    const tSpy =
        tPlayers[
            Math.floor(
                Math.random() *
                tPlayers.length
            )
        ];


    tSpy.role =
        "SPY";


    /*
     * CT 呆呆鸟
     *
     * 必须排除 CT 内鬼
     */

    const ctDodoCandidates =
        ctPlayers.filter(
            player =>
                player !==
                ctSpy
        );


    const ctDodo =
        ctDodoCandidates[
            Math.floor(
                Math.random() *
                ctDodoCandidates.length
            )
        ];


    ctDodo.role =
        "DODO";


    /*
     * T 呆呆鸟
     *
     * 必须排除 T 内鬼
     */

    const tDodoCandidates =
        tPlayers.filter(
            player =>
                player !==
                tSpy
        );


    const tDodo =
        tDodoCandidates[
            Math.floor(
                Math.random() *
                tDodoCandidates.length
            )
        ];


    tDodo.role =
        "DODO";


    /*
     * 其他人先标成 GOOD。
     *
     * taskManager.js 使用旧的 GOOD 逻辑，
     * 所以这里先保持兼容。
     */

    players.forEach(
        player => {

            if (!player.role) {

                player.role =
                    "GOOD";

            }

        }
    );


    /*
     * 分配普通任务
     */

    assignTasks(
        players
    );


    /*
     * 呆呆鸟专属任务
     */

    const DODO_TASK =
        "让自己的队友认为自己是内鬼并把自己投出去。";


    players.forEach(
        player => {

            if (
                player.role ===
                "DODO"
            ) {

                player.task =
                    DODO_TASK;

            }

        }
    );


    /*
     * GOOD 改成正式身份 CIVILIAN
     */

    players.forEach(
        player => {

            if (
                player.role ===
                "GOOD"
            ) {

                player.role =
                    "CIVILIAN";

            }

        }
    );


    /*
     * 返回游戏
     */

    return {

        round:
            round,

        mode:
            "UNDERCOVER",

        state:
            "PLAYING",

        startedAt:
            Date.now(),

        players:
            players.map(
                player => ({

                    id:
                        player.id,

                    name:
                        player.name,

                    team:
                        player.team,

                    role:
                        player.role,

                    task:
                        player.task,

                    isBot:
                        player.isBot === true

                })
            )

    };
}


/*
 * ======================================================
 * 获取公开游戏
 * ======================================================
 */

function getPublicGame(
    game,
    reveal = false
) {

    return {

        round:
            game.round,

        mode:
            game.mode,

        state:
            game.state,

        players:
            game.players.map(
                player => {

                    const result = {

                        id:
                            player.id,

                        name:
                            player.name,

                        team:
                            player.team

                    };


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

                }
            )

    };
}


/*
 * ======================================================
 * 私人身份
 * ======================================================
 */

function getPrivatePlayerInfo(
    game,
    playerId
) {

    const player =
        game.players.find(
            item =>
                item.id ===
                playerId
        );


    if (!player) {

        return null;

    }


    if (
        game.mode ===
        "TEAM"
    ) {

        return {

            name:
                player.name,

            team:
                player.team,

            role:
                null,

            task:
                null

        };

    }


    return {

        name:
            player.name,

        team:
            player.team,

        role:
            player.role,

        task:
            player.task

    };
}


/*
 * ======================================================
 * 导出
 * ======================================================
 */

module.exports = {

    createGame,

    getPublicGame,

    getPrivatePlayerInfo

};