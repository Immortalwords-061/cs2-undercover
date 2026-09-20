// ======================================================
// CS2 内鬼模式 / 分组模式
// 前端最终版 script.js
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
// 保存登录信息
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
// 清除登录信息
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
         * 自动恢复。
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
        }
    );

}


// ======================================================
// 创建房间
// ======================================================

function createRoom(mode) {

    console.log(
        "点击创建房间:",
        mode
    );


    const nameInput =
        document.getElementById(
            "nameInput"
        );

    const playerCountSelect =
        document.getElementById(
            "playerCountSelect"
        );


    if (!nameInput) {

        console.error(
            "找不到 nameInput"
        );

        return;

    }


    if (!playerCountSelect) {

        console.error(
            "找不到 playerCountSelect"
        );

        return;

    }


    const name =
        nameInput.value.trim();


    if (!name) {

        alert(
            "请输入你的昵称"
        );

        nameInput.focus();

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


    /*
     * 这里只保存昵称。
     *
     * 房间号要等服务器真正创建成功
     * 后再保存。
     */

    localStorage.setItem(
        "cs2_player_name",
        myPlayerName
    );


    console.log(
        "发送创建房间:",
        {
            name:
                name,

            mode:
                mode,

            maxPlayers:
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
        }
    );

}


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

            alert(
                "创建房间失败：服务器没有返回房间信息"
            );

            return;

        }


        /*
         * 当前后端直接发送房间对象。
         */

        if (data.room) {

            roomData =
                data.room;

        } else {

            roomData =
                data;

        }


        if (
            !roomData ||
            !roomData.code
        ) {

            console.error(
                "room_created 数据异常:",
                data
            );

            alert(
                "创建房间失败：房间数据异常"
            );

            return;

        }


        myRoomCode =
            roomData.code;


        myPlayerName =
            roomData.hostName ||
            myPlayerName;


        saveLoginInfo();


        console.log(
            "创建房间成功:",
            roomData
        );


        showRoom();

    }
);


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

    const nameInput =
        document.getElementById(
            "nameInput"
        );

    const roomCodeInput =
        document.getElementById(
            "roomCodeInput"
        );


    if (!nameInput || !roomCodeInput) {

        console.error(
            "找不到加入房间输入框"
        );

        return;

    }


    const name =
        nameInput.value.trim();


    const code =
        roomCodeInput.value.trim();


    if (!name) {

        alert(
            "请输入你的昵称"
        );

        nameInput.focus();

        return;

    }


    if (!code) {

        alert(
            "请输入房间号"
        );

        roomCodeInput.focus();

        return;

    }


    myPlayerName =
        name;


    localStorage.setItem(
        "cs2_player_name",
        myPlayerName
    );


    console.log(
        "发送加入房间:",
        {
            roomCode:
                code,

            name:
                name
        }
    );


    /*
     * 注意：
     *
     * 后端要求 roomCode
     * 不是 code。
     */

    socket.emit(
        "join_room",
        {
            roomCode:
                code,

            name:
                name
        }
    );

}


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

            alert(
                "加入房间失败：服务器没有返回数据"
            );

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

            saveLoginInfo();

        }


        showRoom();

    }
);


// ======================================================
// 显示大厅
// ======================================================

function showRoom() {

    if (lobby) {

        lobby.style.display =
            "none";

    }


    if (room) {

        room.style.display =
            "block";

    }


    if (game) {

        game.style.display =
            "none";

    }


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


        if (!data) {

            return;

        }


        roomData =
            data;


        /*
         * 如果服务器告诉我们
         * 当前玩家已经不在房间里，
         * 就不要继续显示房间。
         */

        const me =
            roomData.players &&
            roomData.players.find(
                player =>
                    player.id ===
                    myId
            );


        if (
            roomData.players &&
            roomData.players.length > 0 &&
            !me
        ) {

            console.log(
                "当前玩家已经不在这个房间"
            );

        }


        updateRoomUI();

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


    /*
     * 房间号
     */

    if (roomCode) {

        roomCode.textContent =
            roomData.code ||
            "------";

    }


    /*
     * 当前人数
     */

    if (playerCount) {

        playerCount.textContent =
            roomData.playerCount ||
            0;

    }


    /*
     * 最大人数
     */

    if (maxPlayerCount) {

        maxPlayerCount.textContent =
            roomData.maxPlayers ||
            10;

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


        if (
            Array.isArray(
                roomData.players
            )
        ) {

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

    }


    /*
     * 开始游戏按钮
     */

    if (startButton) {

        const host =
            isCurrentHost();


        const full =
            Number(
                roomData.playerCount
            ) ===
            Number(
                roomData.maxPlayers
            );


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

    if (!isCurrentHost()) {

        alert(
            "只有房主可以开始游戏"
        );

        return;

    }


    if (!roomData) {

        return;

    }


    if (
        Number(
            roomData.playerCount
        ) !==
        Number(
            roomData.maxPlayers
        )
    ) {

        alert(
            `需要正好 ${roomData.maxPlayers} 人才能开始`
        );

        return;

    }


    if (!socket.connected) {

        alert(
            "服务器连接已经断开，请稍等后再试"
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


        if (!data) {

            return;

        }


        currentGame =
            data;


        myPrivateInfo =
            null;


        showGame(
            data
        );

    }
);


// ======================================================
// 私人身份
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
// 显示游戏
// ======================================================

function showGame(data) {

    if (lobby) {

        lobby.style.display =
            "none";

    }


    if (room) {

        room.style.display =
            "none";

    }


    if (game) {

        game.style.display =
            "block";

    }


    const roundNumber =
        document.getElementById(
            "roundNumber"
        );


    if (roundNumber) {

        roundNumber.textContent =
            data.round;

    }


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


    if (!container) {

        return;

    }


    container.innerHTML =
        "";


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


    addGameControlButtons();

}


// ======================================================
// CT / T 人数
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
     * PLAYING
     */

    if (
        currentGame &&
        currentGame.state ===
            "PLAYING"
    ) {

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
     * REVEAL
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
                    "确定要退出当前游戏并返回大厅吗？"
                )
            ) {

                leaveRoom();

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
// 点击自己的卡片
// ======================================================

function toggleMyCard(
    card
) {

    if (!myPrivateInfo) {

        alert(
            "正在获取你的身份，请稍等"
        );

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
// 显示身份
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
// 隐藏身份
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
// 更新自己的卡片
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

}


// ======================================================
// 结束游戏
// ======================================================

function finishGame() {

    if (!isCurrentHost()) {

        alert(
            "只有房主可以结束本局"
        );

        return;

    }


    if (!socket.connected) {

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


    if (
        !confirm(
            "确定要结束本局并公布所有人的身份吗？"
        )
    ) {

        return;

    }


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


        if (!data) {

            return;

        }


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

    if (lobby) {

        lobby.style.display =
            "none";

    }


    if (room) {

        room.style.display =
            "none";

    }


    if (game) {

        game.style.display =
            "block";

    }


    const roundNumber =
        document.getElementById(
            "roundNumber"
        );


    if (roundNumber) {

        roundNumber.textContent =
            data.round;

    }


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


    if (!container) {

        return;

    }


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


    addGameControlButtons();

}


// ======================================================
// 下一局
// ======================================================

function nextRound() {

    if (!isCurrentHost()) {

        alert(
            "只有房主可以开始下一局"
        );

        return;

    }


    if (!socket.connected) {

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


    socket.emit(
        "next_round"
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
// 自动重连成功
// ======================================================

socket.on(
    "rejoin_success",
    data => {

        console.log(
            "收到 rejoin_success:",
            data
        );


        reconnecting = false;


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

            saveLoginInfo();

        }


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
// 自动重连失败
// ======================================================

socket.on(
    "rejoin_failed",
    message => {

        console.log(
            "自动重连失败:",
            message
        );


        reconnecting = false;


        /*
         * 房间已经不存在。
         *
         * 清除旧房间信息，
         * 回到首页。
         */

        clearLoginInfo();


        if (lobby) {

            lobby.style.display =
                "block";

        }


        if (room) {

            room.style.display =
                "none";

        }


        if (game) {

            game.style.display =
                "none";

        }

    }
);


// ======================================================
// 主动退出房间
// ======================================================

function leaveRoom() {

    if (!myRoomCode) {

        /*
         * 如果没有房间，
         * 直接回首页。
         */

        returnToLobby();

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


    if (!socket.connected) {

        alert(
            "服务器连接已经断开，请稍等后再试"
        );

        return;

    }


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
                result.success ===
                    false
            ) {

                alert(
                    result.message ||
                    "退出房间失败"
                );

                return;

            }


            /*
             * 退出成功
             */

            clearLoginInfo();


            returnToLobby();

        }
    );

}


// ======================================================
// 返回创建房间页面
// ======================================================

function returnToLobby() {

    /*
     * 隐藏游戏
     */

    if (game) {

        game.style.display =
            "none";

    }


    /*
     * 隐藏房间
     */

    if (room) {

        room.style.display =
            "none";

    }


    /*
     * 显示首页
     */

    if (lobby) {

        lobby.style.display =
            "block";

    }


    /*
     * 清空房间信息
     */

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


    /*
     * 隐藏开始游戏按钮
     */

    const startButton =
        document.getElementById(
            "startButton"
        );


    if (startButton) {

        startButton.style.display =
            "none";

    }


    /*
     * 清空加入房间输入框
     */

    const roomCodeInput =
        document.getElementById(
            "roomCodeInput"
        );


    if (roomCodeInput) {

        roomCodeInput.value =
            "";

    }


    /*
     * 清空昵称。
     *
     * 因为退出以后已经清除了本地登录信息。
     */

    const nameInput =
        document.getElementById(
            "nameInput"
        );


    if (nameInput) {

        nameInput.value =
            "";

    }


    /*
     * 隐藏加入房间面板
     */

    const joinPanel =
        document.getElementById(
            "joinPanel"
        );


    if (joinPanel) {

        joinPanel.style.display =
            "none";

    }


    console.log(
        "已经回到创建房间页面"
    );

}


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