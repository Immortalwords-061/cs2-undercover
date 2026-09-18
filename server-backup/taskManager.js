const goodTasks = [

    "完成2次补枪",

    "成功拆包一次",

    "成功下包一次",

    "获得残局胜利",

    "连续两回合存活",

    "使用敌人的武器完成一次击杀",

    "造成100以上道具伤害",

    "获得2次助攻",

    "成功保枪一次",

    "完成一次1V1残局",

    "完成一次爆头击杀",

    "使用手枪完成一次击杀",

    "完成一次双杀",

    "成功使用闪光弹帮助队友击杀",

    "获得一次MVP"

];


const spyMissions = [

    "帮助敌方获胜，并隐藏身份。",

    "尽量阻止自己阵营获胜，同时不要暴露身份。",

    "暗中帮助敌方完成关键击杀，并隐藏自己的真实身份。",

    "干扰自己阵营的行动，但不要让其他玩家发现你是内鬼。"

];


// =========================
// 随机
// =========================

function shuffle(array) {

    const result =
        [...array];


    for (
        let i = result.length - 1;
        i > 0;
        i--
    ) {

        const j =
            Math.floor(
                Math.random() * (i + 1)
            );


        [
            result[i],
            result[j]
        ] =
        [
            result[j],
            result[i]
        ];

    }


    return result;
}


// =========================
// 分配任务
// =========================

function assignTasks(players) {

    const tasks =
        shuffle(goodTasks);


    let taskIndex = 0;


    players.forEach(player => {

        if (player.role === "SPY") {

            const missions =
                spyMissions;

            player.task =
                missions[
                    Math.floor(
                        Math.random() *
                        missions.length
                    )
                ];

        } else {

            player.task =
                tasks[
                    taskIndex %
                    tasks.length
                ];

            taskIndex++;

        }

    });

}


module.exports = {

    assignTasks,

    shuffle

};