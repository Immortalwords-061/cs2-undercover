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
 * 1 个 SPY
 * 1 个 DODO
 * 其余 CIVILIAN
 *
 *
 * 分组模式：
 *
 * 没有身份
 * 没有任务
 */

function createGame(
    players,
    round,
    mode = "UNDERCOVER"
) {

    /*
     * 人数限制
     */

    if (
        players.length < 6 ||
        players.length > 16
    ) {

        throw new Error(
            "游戏人数必须在6到16人之间"
        );

    }


    /*
     * ==================================================
     * 清除上一局
     * ==================================================
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
     * ==================================================
     * 随机分队
     * ==================================================
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
     * ==================================================
     * CT 内鬼
     * ==================================================
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
     * ==================================================
     * T 内鬼
     * ==================================================
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
     * ==================================================
     * CT 呆呆鸟
     * ==================================================
     *
     * 从 CT 中排除内鬼后再随机。
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
     * ==================================================
     * T 呆呆鸟
     * ==================================================
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
     * ==================================================
     * 其余暂时设成 GOOD
     * ==================================================
     *
     * 这里故意暂时使用 GOOD，
     * 因为你原来的 taskManager.js
     * 就是按照原来的 GOOD 身份分配任务。
     *
     * 分配完以后再统一改成 CIVILIAN。
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
     * ==================================================
     * 分配原来的任务
     * ==================================================
     */

    assignTasks(
        players
    );


    /*
     * ==================================================
     * 呆呆鸟专属任务
     * ==================================================
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
     * ==================================================
     * GOOD → CIVILIAN
     * ==================================================
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
     * ==================================================
     * 返回游戏数据
     * ==================================================
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
 *
 * reveal = false
 *
 * 游戏过程中：
 * 隐藏身份
 *
 *
 * reveal = true
 *
 * 游戏结束：
 * 显示身份和任务
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

        isTestRoom:
            game.isTestRoom === true,

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


                    /*
                     * 只有揭晓时显示身份
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

                }
            )

    };

}


/*
 * ======================================================
 * 获取私人身份
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


    /*
     * 分组模式
     */

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


    /*
     * 内鬼模式
     */

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