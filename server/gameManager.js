const {
    assignTasks,
    shuffle
} = require("./taskManager");


/*
 * ======================================================
 * 阵营人数
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
 * UNDERCOVER：
 *
 * 每个阵营：
 *
 * 1 个 SPY
 * 1 个 DODO
 * 其余 GOOD
 *
 *
 * TEAM：
 *
 * 没有身份
 * 没有任务
 *
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
     * 清理上一局身份
     */

    players.forEach(
        player => {

            player.team = null;
            player.role = null;
            player.task = null;

        }
    );


    /*
     * 随机玩家
     */

    const shuffledPlayers =
        shuffle(
            [...players]
        );


    /*
     * CT / T 人数
     */

    const {
        ctCount,
        tCount
    } =
        getTeamCounts(
            players.length
        );


    /*
     * 分 CT
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
     * 分 T
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
                            null

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
     * 每队随机一个内鬼
     */

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


    ctSpy.role =
        "SPY";


    tSpy.role =
        "SPY";


    /*
     * ==================================================
     * 每队再随机一个呆呆鸟
     * ==================================================
     *
     * 必须排除已经成为 SPY 的人。
     */

    const ctDodoCandidates =
        ctPlayers.filter(
            player =>
                player !== ctSpy
        );


    const tDodoCandidates =
        tPlayers.filter(
            player =>
                player !== tSpy
        );


    const ctDodo =
        ctDodoCandidates[
            Math.floor(
                Math.random() *
                ctDodoCandidates.length
            )
        ];


    const tDodo =
        tDodoCandidates[
            Math.floor(
                Math.random() *
                tDodoCandidates.length
            )
        ];


    ctDodo.role =
        "DODO";


    tDodo.role =
        "DODO";


    /*
     * 其他人全部 GOOD
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
     * 先让原来的任务系统分配任务。
     *
     * 后面会把 DODO 的任务覆盖掉。
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
        "让自己的队友认为自己是内鬼，并把自己投出去。你的任务是假的。";


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
     * 返回当前游戏
     */

    return {

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
                        player.task

                })
            )

    };

}


/*
 * ======================================================
 * 获取公开游戏信息
 * ======================================================
 *
 * reveal = false
 *
 * 游戏进行中：
 * 不显示身份
 *
 *
 * reveal = true
 *
 * 游戏结束：
 * 显示全部身份和任务
 *
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
 * 获取一个玩家的私人信息
 * ======================================================
 */

function getPrivatePlayerInfo(
    game,
    playerId
) {

    const player =
        game.players.find(
            player =>
                player.id ===
                playerId
        );


    if (!player) {

        return null;

    }


    /*
     * 分组模式没有身份
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