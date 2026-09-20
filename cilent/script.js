// ======================================================
// CS2 内鬼模式 / 分组模式
// 最终版前端 script.js
// ======================================================


// ======================================================
// Socket.IO
// ======================================================

const socket = io(
    "https://cs2-undercover.onrender.com"
);


// ======================================================
// 全局状态
// ======================================================

let myId = null;

let myRoomCode =
    localStorage.getItem(
        "cs2_room_code"
    );

let myPlayerName =
    localStorage.getItem(
        "cs2_player_name"
    );

let roomData = null;

let currentGame = null;

let myPrivateInfo = null;

let reconnecting = false;


// ======================================================
// DOM
// ======================================================

const lobby =
    document.getElementById(
        "lobby"
    );

const room =
    document.getElementById(
        "room"
    );

const game =
    document.getElementById(
        "game"
    );


// ======================================================
// 房主判断
// ======================================================

function isCurrentHost() {

    if (!roomData) {
        return false;
    }

    if (!myId) {
        return false;
    }

    return (
        roomData.hostId ===
        myId
    );
}


// ======================================================
// 保存本地登录信息
// ======================================================

function saveLoginInfo() {

    if (myRoomCode) {

        localStorage.setItem(
            "cs2_room_code",
            myRoomCode
        );

    }

    if (myPlayerName) {

        localStorage.setItem(
            "cs2_player_name",
            myPlayerName
        );

    }
}


// ======================================================
// 清除本地登录信息
// ======================================================

function clearLoginInfo() {

    localStorage.removeItem(
        "cs2_room_code"
    );

    localStorage.removeItem(
        "cs2_player_name"
    );

    myRoomCode = null;

    myPlayerName = null;

    roomData = null;

    currentGame = null;

    myPrivateInfo = null;
}


// ======================================================
// Socket 连接
// ======================================================

socket.on(
    "connect",
    () => {

        myId =
            socket.id;

        console.log(
            "服务器连接成功:",
            myId
        );


        /*
         * 如果浏览器之前有房间记录，
         * 自动尝试恢复。
         */
        if (
            myRoomCode &&
            myPlayerName &&
            !reconnecting
        ) {

            reconnectToGame();

        }

    }
);


// ======================================================
// Socket 断开
// ======================================================

socket.on(
    "disconnect",
    reason => {

        console.log(
            "服务器连接断开:",
            reason
        );

    }
);


// ======================================================
// 自动重连
// ======================================================

function reconnectToGame() {

    if (
        !myRoomCode ||
        !myPlayerName
    ) {

        return;

    }

    if (reconnecting) {

        return;

    }

    reconnecting = true;

    console.log(
        "正在自动恢复游戏..."
    );


    socket.emit(
        "rejoin_room",
        {
            roomCode:
                myRoomCode,

            name:
                myPlayerName
        },
        result => {

            reconnecting = false;


            if (
                !result ||
                !result.success
            ) {

                console.log(
                    "自动恢复失败:",
                    result
                );

                return;

            }


            console.log(
                "自动恢复成功:",
                result
            );


            roomData =
                result.room;


            /*
             * 服务器返回新的 socket.id，
             * 这里直接根据房间数据判断房主。
             */

            if (
                roomData.state ===
                "WAITING"
            ) {

                showRoom();

                return;

            }


            /*
             * PLAYING / REVEAL
             *
             * 最新服务器会继续发送：
             *
             * game_started
             * 或
             * game_finished
             *
             */

        }
    );

}


// ======================================================
// 创建房间
// ======================================================

function createRoom(mode) {

    const nameInput =
        document.getElementById(
            "nameInput"
        );

    const playerCountSelect =
        document.getElementById(
            "playerCountSelect"
        );


    const name =
        nameInput.value.trim();


    if (!name) {

        alert(
            "请输入你的昵称"
        );

        return;

    }


    const maxPlayers =
        Number(
            playerCountSelect.value
        );


    if (
        !Number.isInteger(
            maxPlayers
        ) ||
        maxPlayers < 6 ||
        maxPlayers > 16
    ) {

        alert(
            "游戏人数必须是6到16人"
        );

        return;

    }


    myPlayerName =
        name;


    saveLoginInfo();


    console.log(
        "创建房间:",
        {
            name,
            mode,
            maxPlayers
        }
    );


    socket.emit(
        "create_room",
        {
            name:
                name,

            mode:
                mode,

            maxPlayers:
                maxPlayers

        },
        result => {

            console.log(
                "创建房间返回:",
                result
            );


            if (
                !result ||
                !result.success
            ) {

                alert(
                    result?.message ||
                    "创建房间失败"
                );

                return;

            }


            myRoomCode =
                result.roomCode;


            roomData =
                result.room;


            saveLoginInfo();


            showRoom();

        }
    );

}


// ======================================================
// 显示加入房间
// ======================================================

function showJoinRoom() {

    const joinPanel =
        document.getElementById(
            "joinPanel"
        );

    if (joinPanel) {

        joinPanel.style.display =
            "block";

    }

}


// ======================================================
// 加入房间
// ======================================================

function joinRoom() {

    const name =
        document
            .getElementById(
                "nameInput"
            )
            .value
            .trim();


    const code =
        document
            .getElementById(
                "roomCodeInput"
            )
            .value
            .trim();


    if (!name) {

        alert(
            "请输入你的昵称"
        );

        return;

    }


    if (!code) {

        alert(
            "请输入房间号"
        );

        return;

    }


    myPlayerName =
        name;


    socket.emit(
        "join_room",
        {
            code:
                code,

            name:
                name

        },
        result => {

            console.log(
                "加入房间返回:",
                result
            );


            if (
                !result ||
                !result.success
            ) {

                alert(
                    result?.message ||
                    "加入房间失败"
                );

                return;

            }


            myRoomCode =
                result.roomCode ||
                code;


            roomData =
                result.room;


            saveLoginInfo();


            showRoom();

        }
    );

}


// ======================================================
// 显示大厅
// ======================================================

function showRoom() {

    lobby.style.display =
        "none";

    room.style.display =
        "block";

    game.style.display =
        "none";


    updateRoomUI();

}


// ======================================================
// 房间实时更新
// ======================================================

socket.on(
    "room_update",
    data => {

        console.log(
            "房间更新:",
            data
        );


        roomData =
            data;


        updateRoomUI();


        /*
         * 如果当前已经在游戏页面，
         * 不强制切回大厅。
         */

    }
);


// ======================================================
// 更新大厅 UI
// ======================================================

function updateRoomUI() {

    if (!roomData) {

        return;

    }


    const roomCode =
        document.getElementById(
            "roomCode"
        );

    const roomMode =
        document.getElementById(
            "roomMode"
        );

    const playerCount =
        document.getElementById(
            "playerCount"
        );

    const maxPlayerCount =
        document.getElementById(
            "maxPlayerCount"
        );

    const playerList =
        document.getElementById(
            "playerList"
        );

    const startButton =
        document.getElementById(
            "startButton"
        );


    if (roomCode) {

        roomCode.textContent =
            roomData.code;

    }


    if (playerCount) {

        playerCount.textContent =
            roomData.playerCount;

    }


    if (maxPlayerCount) {

        maxPlayerCount.textContent =
            roomData.maxPlayers;

    }


    /*
     * 游戏模式
     */

    if (roomMode) {

        if (
            roomData.mode ===
            "TEAM"
        ) {

            roomMode.textContent =
                `⚔️ 分组模式 · ${roomData.maxPlayers}人`;

        } else {

            roomMode.textContent =
                `🎭 内鬼模式 · ${roomData.maxPlayers}人`;

        }

    }


    /*
     * 玩家列表
     */

    if (playerList) {

        playerList.innerHTML =
            "";


        roomData.players.forEach(
            (player, index) => {

                const div =
                    document.createElement(
                        "div"
                    );


                div.className =
                    "lobby-player";


                const hostText =
                    player.id ===
                    roomData.hostId
                        ? "👑 房主"
                        : "";


                div.innerHTML = `
                    <span>
                        ${index + 1}.
                        ${escapeHTML(
                            player.name
                        )}
                    </span>

                    <span>
                        ${hostText}
                    </span>
                `;


                playerList.appendChild(
                    div
                );

            }
        );

    }


    /*
     * 开始游戏按钮
     */

    if (startButton) {

        const host =
            isCurrentHost();

        const full =
            roomData.playerCount ===
            roomData.maxPlayers;

        const waiting =
            roomData.state ===
            "WAITING";


        if (
            host &&
            full &&
            waiting
        ) {

            startButton.style.display =
                "block";

        } else {

            startButton.style.display =
                "none";

        }


        if (
            roomData.mode ===
            "TEAM"
        ) {

            startButton.textContent =
                `⚔️ 开始${roomData.maxPlayers}人分组游戏`;

        } else {

            startButton.textContent =
                `🚀 开始${roomData.maxPlayers}人内鬼游戏`;

        }

    }

}


// ======================================================
// 开始游戏
// ======================================================

function startGame() {

    if (
        !isCurrentHost()
    ) {

        alert(
            "只有房主可以开始游戏"
        );

        return;

    }


    if (!roomData) {

        return;

    }


    if (
        roomData.playerCount !==
        roomData.maxPlayers
    ) {

        alert(
            `需要正好 ${roomData.maxPlayers} 人才能开始`
        );

        return;

    }


    socket.emit(
        "start_game"
    );

}


// ======================================================
// 游戏开始
// ======================================================

socket.on(
    "game_started",
    data => {

        console.log(
            "游戏开始:",
            data
        );


        currentGame =
            data;


        myPrivateInfo =
            null;


        /*
         * 非常重要：
         *
         * 不使用旧的 isHost 状态。
         * 直接根据：
         *
         * roomData.hostId
         *
         * 和
         *
         * socket.id
         *
         * 判断。
         */

        if (
            roomData &&
            roomData.hostId ===
                myId
        ) {

            console.log(
                "当前玩家是房主"
            );

        } else {

            console.log(
                "当前玩家不是房主"
            );

        }


        showGame(
            data
        );

    }
);


// ======================================================
// 收到私人身份
// ======================================================

socket.on(
    "private_role",
    info => {

        console.log(
            "收到我的身份:",
            info
        );


        myPrivateInfo =
            info;


        updateMyCard();

    }
);


// ======================================================
// 显示游戏页面
// ======================================================

function showGame(data) {

    lobby.style.display =
        "none";

    room.style.display =
        "none";

    game.style.display =
        "block";


    document
        .getElementById(
            "roundNumber"
        )
        .textContent =
        data.round;


    const notice =
        document.getElementById(
            "gameNotice"
        );


    if (notice) {

        if (
            data.mode ===
            "TEAM"
        ) {

            const counts =
                getTeamCounts(
                    data.players.length
                );


            notice.innerHTML =
                `⚔️ 第 ${data.round} 局分组模式：${counts.ct} CT vs ${counts.t} T`;

        } else {

            notice.innerHTML =
                `🎭 第 ${data.round} 局内鬼模式：点击自己的名字查看身份和任务`;

        }

    }


    const container =
        document.getElementById(
            "players"
        );


    container.innerHTML =
        "";


    /*
     * 玩家卡片
     */

    data.players.forEach(
        player => {

            const card =
                document.createElement(
                    "div"
                );


            card.className =
                "player-card";


            card.dataset.playerId =
                player.id;


            /*
             * TEAM 模式
             */

            if (
                data.mode ===
                "TEAM"
            ) {

                card.innerHTML = `
                    <div class="card-visible">

                        <div class="player-name">
                            ${escapeHTML(
                                player.name
                            )}
                        </div>

                        <div class="team-text">
                            ${
                                player.team ===
                                "CT"
                                    ? "🔵 CT"
                                    : "🟠 T"
                            }
                        </div>

                    </div>
                `;


                container.appendChild(
                    card
                );


                return;

            }


            /*
             * UNDERCOVER 模式
             */

            const isMe =
                player.id ===
                myId;


            card.innerHTML = `
                <div class="card-hidden">

                    <div class="player-name">
                        ${escapeHTML(
                            player.name
                        )}
                    </div>

                    <div class="team-text">
                        ${
                            player.team ===
                            "CT"
                                ? "🔵 CT"
                                : "🟠 T"
                        }
                    </div>

                    <div class="click-text">
                        ${
                            isMe
                                ? "👁️ 点击查看身份"
                                : "👤 其他玩家"
                        }
                    </div>

                </div>
            `;


            if (isMe) {

                card.style.cursor =
                    "pointer";


                card.onclick =
                    () => {

                        toggleMyCard(
                            card
                        );

                    };

            }


            container.appendChild(
                card
            );

        }
    );


    /*
     * 最关键：
     *
     * 游戏开始后，
     * 房主立即显示“结束本局”。
     */

    addGameControlButtons();

}


// ======================================================
// 根据人数计算 CT / T
// ======================================================

function getTeamCounts(
    playerCount
) {

    return {
        ct:
            Math.ceil(
                playerCount / 2
            ),

        t:
            Math.floor(
                playerCount / 2
            )
    };

}


// ======================================================
// 游戏控制按钮
// ======================================================

function addGameControlButtons() {

    const container =
        document.getElementById(
            "players"
        );


    if (!container) {

        return;

    }


    /*
     * 删除旧按钮
     */

    const old =
        document.getElementById(
            "gameControlButtons"
        );


    if (old) {

        old.remove();

    }


    const controls =
        document.createElement(
            "div"
        );


    controls.id =
        "gameControlButtons";


    controls.style.gridColumn =
        "1 / -1";

    controls.style.width =
        "100%";

    controls.style.textAlign =
        "center";

    controls.style.marginTop =
        "20px";


    /*
     * ==================================================
     * 游戏进行中
     * ==================================================
     */

    if (
        currentGame &&
        currentGame.state ===
            "PLAYING"
    ) {

        /*
         * 直接判断房主。
         *
         * 不使用 isHost。
         */

        if (
            isCurrentHost()
        ) {

            const finishButton =
                document.createElement(
                    "button"
                );


            finishButton.textContent =
                "🏁 结束本局";


            finishButton.onclick =
                () => {

                    finishGame();

                };


            controls.appendChild(
                finishButton
            );

        }

    }


    /*
     * ==================================================
     * 游戏已经结束
     * ==================================================
     */

    if (
        currentGame &&
        currentGame.state ===
            "REVEAL"
    ) {

        if (
            isCurrentHost()
        ) {

            const nextButton =
                document.createElement(
                    "button"
                );


            nextButton.textContent =
                "🔄 开始下一局";


            nextButton.onclick =
                () => {

                    nextRound();

                };


            controls.appendChild(
                nextButton
            );

        } else {

            const waiting =
                document.createElement(
                    "div"
                );


            waiting.textContent =
                "等待房主开始下一局...";


            waiting.style.margin =
                "10px";


            controls.appendChild(
                waiting
            );

        }

    }


    /*
     * 返回大厅
     */

    const backButton =
        document.createElement(
            "button"
        );


    backButton.textContent =
        "🏠 返回大厅";


    backButton.className =
        "secondary";


    backButton.style.marginLeft =
        "10px";


    backButton.onclick =
        () => {

            if (
                confirm(
                    "确定要返回大厅吗？"
                )
            ) {

                clearLoginInfo();

                location.reload();

            }

        };


    controls.appendChild(
        backButton
    );


    container.appendChild(
        controls
    );

}


// ======================================================
// 请求自己的身份
// ======================================================

function requestMyPrivateInfo() {

    socket.emit(
        "request_private_role"
    );

}


// ======================================================
// 点击自己的卡片
// ======================================================

function toggleMyCard(
    card
) {

    if (!myPrivateInfo) {

        requestMyPrivateInfo();

        return;

    }


    if (
        card.classList.contains(
            "revealed"
        )
    ) {

        hideMyCard(
            card
        );

    } else {

        revealMyCard(
            card
        );

    }

}


// ======================================================
// 显示自己的身份
// ======================================================

function revealMyCard(
    card
) {

    const info =
        myPrivateInfo;


    card.classList.add(
        "revealed"
    );


    const roleText =
        info.role === "SPY"
            ? "🕵️ 内鬼"
            : "🛡️ 好人";


    const task =
        info.task ||
        "暂无任务";


    card.innerHTML = `
        <div class="card-visible">

            <div class="player-name">
                ${escapeHTML(
                    info.name
                )}
            </div>

            <div class="role">
                ${roleText}
            </div>

            <div class="team-text">
                阵营：
                ${
                    info.team ===
                    "CT"
                        ? "🔵 CT"
                        : "🟠 T"
                }
            </div>

            <div class="task-title">
                🎯 你的任务
            </div>

            <div class="task-text">
                ${escapeHTML(
                    task
                )}
            </div>

            <div class="hide-text">
                👁️ 点击隐藏
            </div>

        </div>
    `;

}


// ======================================================
// 隐藏自己的身份
// ======================================================

function hideMyCard(
    card
) {

    card.classList.remove(
        "revealed"
    );


    card.innerHTML = `
        <div class="card-hidden">

            <div class="player-name">
                ${escapeHTML(
                    myPrivateInfo.name
                )}
            </div>

            <div class="lock-icon">
                🔒
            </div>

            <div class="click-text">
                点击查看身份
            </div>

        </div>
    `;

}


// ======================================================
// 更新自己的卡
// ======================================================

function updateMyCard() {

    if (!myPrivateInfo) {

        return;

    }


    const card =
        document.querySelector(
            `[data-player-id="${myId}"]`
        );


    if (!card) {

        return;

    }


    /*
     * 不自动显示身份。
     *
     * 用户点击自己的卡片后才显示。
     */

}


// ======================================================
// 房主结束本局
// ======================================================

function finishGame() {

    /*
     * 直接重新判断房主。
     */

    if (
        !isCurrentHost()
    ) {

        alert(
            "只有房主可以结束本局"
        );

        return;

    }


    if (
        !socket.connected
    ) {

        alert(
            "服务器连接已经断开，请稍等后再试"
        );

        return;

    }


    if (
        !currentGame ||
        currentGame.state !==
            "PLAYING"
    ) {

        return;

    }


    const confirmed =
        confirm(
            "确定要结束本局并公布所有人的身份吗？"
        );


    if (!confirmed) {

        return;

    }


    console.log(
        "发送结束游戏请求"
    );


    socket.emit(
        "finish_game"
    );

}


// ======================================================
// 游戏结束
// ======================================================

socket.on(
    "game_finished",
    data => {

        console.log(
            "游戏结束:",
            data
        );


        currentGame =
            data;


        myPrivateInfo =
            null;


        showFinalResult(
            data
        );

    }
);


// ======================================================
// 显示最终结果
// ======================================================

function showFinalResult(
    data
) {

    lobby.style.display =
        "none";

    room.style.display =
        "none";

    game.style.display =
        "block";


    document
        .getElementById(
            "roundNumber"
        )
        .textContent =
        data.round;


    const notice =
        document.getElementById(
            "gameNotice"
        );


    if (notice) {

        if (
            data.mode ===
            "TEAM"
        ) {

            notice.textContent =
                `⚔️ 第 ${data.round} 局分组结果`;

        } else {

            notice.textContent =
                `🎭 第 ${data.round} 局身份揭晓`;

        }

    }


    const container =
        document.getElementById(
            "players"
        );


    container.innerHTML =
        "";


    data.players.forEach(
        player => {

            const card =
                document.createElement(
                    "div"
                );


            card.className =
                "final-player";


            if (
                data.mode ===
                "TEAM"
            ) {

                card.innerHTML = `
                    <strong>
                        ${escapeHTML(
                            player.name
                        )}
                    </strong>

                    <span>
                        ${
                            player.team ===
                            "CT"
                                ? "🔵 CT"
                                : "🟠 T"
                        }
                    </span>
                `;

            } else {

                const roleText =
                    player.role ===
                    "SPY"
                        ? "🕵️ 内鬼"
                        : "🛡️ 好人";


                card.innerHTML = `
                    <strong>
                        ${escapeHTML(
                            player.name
                        )}
                    </strong>

                    <span>
                        ${
                            player.team ===
                            "CT"
                                ? "🔵 CT"
                                : "🟠 T"
                        }
                    </span>

                    <span>
                        ${roleText}
                    </span>

                    ${
                        player.task
                            ? `
                                <div class="final-task">
                                    🎯
                                    ${escapeHTML(
                                        player.task
                                    )}
                                </div>
                            `
                            : ""
                    }
                `;

            }


            container.appendChild(
                card
            );

        }
    );


    /*
     * 游戏已经 REVEAL。
     *
     * 这里显示：
     *
     * 房主：开始下一局
     * 普通玩家：等待房主
     */

    addGameControlButtons();

}


// ======================================================
// 下一局
// ======================================================

function nextRound() {

    if (
        !isCurrentHost()
    ) {

        alert(
            "只有房主可以开始下一局"
        );

        return;

    }


    if (
        !socket.connected
    ) {

        alert(
            "服务器连接已经断开，请稍等后再试"
        );

        return;

    }


    if (
        !currentGame ||
        currentGame.state !==
            "REVEAL"
    ) {

        return;

    }


    console.log(
        "请求开始下一局"
    );


    socket.emit(
        "next_round",
        result => {

            console.log(
                "下一局服务器返回:",
                result
            );


            if (
                result &&
                !result.success
            ) {

                alert(
                    result.message ||
                    "下一局启动失败"
                );

            }

        }
    );

}


// ======================================================
// 错误信息
// ======================================================

socket.on(
    "error_message",
    message => {

        alert(
            message
        );

    }
);


// ======================================================
// 某些服务器版本可能发送 room_created
// ======================================================

// ======================================================
// 创建房间成功
// ======================================================

socket.on(
    "room_created",
    data => {

        console.log(
            "收到 room_created:",
            data
        );


        if (!data) {

            console.error(
                "创建房间失败：服务器没有返回数据"
            );

            return;
        }


        /*
         * 服务器当前返回的是房间对象本身：
         *
         * {
         *     code,
         *     hostId,
         *     hostName,
         *     mode,
         *     state,
         *     ...
         * }
         */

        if (data.room) {

            roomData =
                data.room;

        } else {

            roomData =
                data;

        }


        /*
         * 保存房间号
         */

        if (
            roomData &&
            roomData.code
        ) {

            myRoomCode =
                roomData.code;


            localStorage.setItem(
                "cs2_room_code",
                roomData.code
            );

        }


        /*
         * 创建房间的人就是房主
         */

        console.log(
            "创建房间成功:",
            roomData
        );


        /*
         * 进入大厅
         */

        showRoom();

    }
);


// ======================================================
// 加入房间成功
// ======================================================

socket.on(
    "join_success",
    data => {

        console.log(
            "收到 join_success:",
            data
        );


        if (!data) {

            return;

        }


        if (data.room) {

            roomData =
                data.room;

        } else {

            roomData =
                data;

        }


        if (
            roomData &&
            roomData.code
        ) {

            myRoomCode =
                roomData.code;


            localStorage.setItem(
                "cs2_room_code",
                roomData.code
            );

        }


        showRoom();

    }
);


// ======================================================
// 自动重连成功
// ======================================================

socket.on(
    "rejoin_success",
    data => {

        console.log(
            "收到 rejoin_success:",
            data
        );


        if (!data) {

            return;

        }


        if (data.room) {

            roomData =
                data.room;

        } else {

            roomData =
                data;

        }


        if (
            roomData &&
            roomData.code
        ) {

            myRoomCode =
                roomData.code;


            localStorage.setItem(
                "cs2_room_code",
                roomData.code
            );

        }


        /*
         * 根据服务器当前状态恢复页面
         */

        if (
            roomData &&
            roomData.state ===
                "WAITING"
        ) {

            showRoom();

        }

    }
);


// ======================================================
// HTML 防注入
// ======================================================

function escapeHTML(
    text
) {

    const div =
        document.createElement(
            "div"
        );


    div.textContent =
        text == null
            ? ""
            : String(text);


    return div.innerHTML;

}
// ======================================================
// 主动退出房间
// ======================================================

function leaveRoom() {

    if (!myRoomCode) {

        alert(
            "当前没有加入房间"
        );

        return;
    }


    if (
        !confirm(
            "确定要退出这个房间吗？"
        )
    ) {

        return;
    }


    console.log(
        "正在退出房间:",
        myRoomCode
    );


    socket.emit(
        "leave_room",
        {},
        result => {

            console.log(
                "退出房间服务器返回:",
                result
            );


            if (
                result &&
                !result.success
            ) {

                alert(
                    result.message ||
                    "退出房间失败"
                );

                return;
            }


            // ==========================================
            // 清除本地保存的房间信息
            // ==========================================

            localStorage.removeItem(
                "cs2_room_code"
            );

            localStorage.removeItem(
                "cs2_player_name"
            );


            // ==========================================
            // 清除当前游戏数据
            // ==========================================

            myRoomCode =
                null;

            myPlayerName =
                null;

            roomData =
                null;

            currentGame =
                null;

            myPrivateInfo =
                null;


            // ==========================================
            // 回到首页
            // ==========================================

            if (game) {

                game.style.display =
                    "none";

            }


            if (room) {

                room.style.display =
                    "none";

            }


            if (lobby) {

                lobby.style.display =
                    "block";

            }


            // 清空房间信息

            const roomCodeElement =
                document.getElementById(
                    "roomCode"
                );

            if (roomCodeElement) {

                roomCodeElement.textContent =
                    "------";

            }


            const roomModeElement =
                document.getElementById(
                    "roomMode"
                );

            if (roomModeElement) {

                roomModeElement.textContent =
                    "------";

            }


            const playerListElement =
                document.getElementById(
                    "playerList"
                );

            if (playerListElement) {

                playerListElement.innerHTML =
                    "";

            }


            const playerCountElement =
                document.getElementById(
                    "playerCount"
                );

            if (playerCountElement) {

                playerCountElement.textContent =
                    "0";

            }


            const maxPlayerCountElement =
                document.getElementById(
                    "maxPlayerCount"
                );

            if (maxPlayerCountElement) {

                maxPlayerCountElement.textContent =
                    "10";

            }


            // 隐藏开始游戏按钮

            const startButton =
                document.getElementById(
                    "startButton"
                );

            if (startButton) {

                startButton.style.display =
                    "none";

            }


            // 清空加入房间输入框

            const roomCodeInput =
                document.getElementById(
                    "roomCodeInput"
                );

            if (roomCodeInput) {

                roomCodeInput.value =
                    "";

            }


            console.log(
                "已经回到创建房间页面"
            );

        }
    );
}