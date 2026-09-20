// ======================================================
// CS2 Undercover
// 前端完整版本
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

let leavingRoom = false;


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
         * 如果用户主动退出，
         * 不自动重连。
         */

        if (leavingRoom) {

            return;

        }


        /*
         * 自动恢复房间。
         */

        if (
            myRoomCode &&
            myPlayerName &&
            !reconnecting
        ) {

            reconnectToGame();

        }


        /*
         * 确保测试按钮出现。
         */

        ensureTestButtons();

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

    if (leavingRoom) {

        return;

    }


    if (
        !myRoomCode ||
        !myPlayerName
    ) {

        return;

    }


    if (reconnecting) {

        return;

    }


    reconnecting =
        true;


    console.log(
        "正在自动恢复房间:",
        myRoomCode
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
// 重连成功
// ======================================================

socket.on(
    "rejoin_success",
    data => {

        console.log(
            "重连成功:",
            data
        );


        reconnecting =
            false;


        if (leavingRoom) {

            return;

        }


        if (!data) {

            return;

        }


        roomData =
            data.room ||
            data;


        if (
            roomData &&
            roomData.code
        ) {

            myRoomCode =
                roomData.code;

            saveLoginInfo();

        }


        /*
         * 等待界面
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
// 重连失败
// ======================================================

socket.on(
    "rejoin_failed",
    message => {

        console.log(
            "重连失败:",
            message
        );


        reconnecting =
            false;


        if (leavingRoom) {

            return;

        }


        clearLoginInfo();

        returnToLobby();

        alert(
            message ||
            "房间已经不存在"
        );

    }
);


// ======================================================
// 创建正常房间
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


    if (
        !nameInput ||
        !playerCountSelect
    ) {

        alert(
            "页面组件缺失，请刷新网页"
        );

        return;

    }


    const name =
        nameInput.value.trim();


    const maxPlayers =
        Number(
            playerCountSelect.value
        );


    if (!name) {

        alert(
            "请输入昵称"
        );

        nameInput.focus();

        return;

    }


    if (
        !Number.isInteger(
            maxPlayers
        ) ||
        maxPlayers < 6 ||
        maxPlayers > 16
    ) {

        alert(
            "游戏人数必须选择6到16人"
        );

        return;

    }


    if (!socket.connected) {

        alert(
            "服务器还没有连接好，请稍等"
        );

        return;

    }


    leavingRoom =
        false;


    myPlayerName =
        name;


    localStorage.setItem(
        "cs2_player_name",
        name
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
// 创建测试房间
// ======================================================

function createTestRoom(mode) {

    const nameInput =
        document.getElementById(
            "nameInput"
        );

    const playerCountSelect =
        document.getElementById(
            "playerCountSelect"
        );


    if (
        !nameInput ||
        !playerCountSelect
    ) {

        alert(
            "页面组件缺失，请刷新网页"
        );

        return;

    }


    let name =
        nameInput.value.trim();


    const maxPlayers =
        Number(
            playerCountSelect.value
        );


    /*
     * 测试模式如果没填昵称，
     * 自动使用一个默认昵称。
     */

    if (!name) {

        name =
            "测试玩家";


        nameInput.value =
            name;

    }


    if (
        !Number.isInteger(
            maxPlayers
        ) ||
        maxPlayers < 6 ||
        maxPlayers > 16
    ) {

        alert(
            "测试人数必须选择6到16人"
        );

        return;

    }


    if (!socket.connected) {

        alert(
            "服务器还没有连接好，请稍等"
        );

        return;

    }


    leavingRoom =
        false;


    myPlayerName =
        name;


    localStorage.setItem(
        "cs2_player_name",
        name
    );


    console.log(
        "创建单人测试房间:",
        mode,
        maxPlayers
    );


    socket.emit(
        "create_test_room",
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
// 自动添加单人测试按钮
// ======================================================

function ensureTestButtons() {

    if (!lobby) {

        return;

    }


    /*
     * 已经添加过就不重复添加。
     */

    if (
        document.getElementById(
            "singleTestButtons"
        )
    ) {

        return;

    }


    const panel =
        document.createElement(
            "div"
        );


    panel.id =
        "singleTestButtons";


    panel.style.marginTop =
        "20px";


    panel.style.padding =
        "16px";


    panel.style.border =
        "1px dashed #888";


    panel.style.borderRadius =
        "10px";


    panel.style.textAlign =
        "center";


    panel.innerHTML = `
        <div
            style="
                font-size:18px;
                font-weight:bold;
                margin-bottom:8px;
            "
        >
            🧪 单人测试
        </div>

        <div
            style="
                font-size:13px;
                opacity:.75;
                margin-bottom:12px;
            "
        >
            使用上面的游戏人数选择，
            自动补机器人测试完整游戏流程
        </div>
    `;


    /*
     * 内鬼测试按钮
     */

    const undercoverButton =
        document.createElement(
            "button"
        );


    undercoverButton.textContent =
        "🎭 单人测试 · 内鬼模式";


    undercoverButton.onclick =
        () => {

            createTestRoom(
                "UNDERCOVER"
            );

        };


    undercoverButton.style.margin =
        "5px";


    /*
     * 分组测试按钮
     */

    const teamButton =
        document.createElement(
            "button"
        );


    teamButton.textContent =
        "⚔️ 单人测试 · 分组模式";


    teamButton.onclick =
        () => {

            createTestRoom(
                "TEAM"
            );

        };


    teamButton.style.margin =
        "5px";


    panel.appendChild(
        undercoverButton
    );


    panel.appendChild(
        teamButton
    );


    lobby.appendChild(
        panel
    );

}


// ======================================================
// 创建房间成功
// ======================================================

socket.on(
    "room_created",
    data => {

        console.log(
            "房间创建成功:",
            data
        );


        if (leavingRoom) {

            return;

        }


        roomData =
            data.room ||
            data;


        if (
            !roomData ||
            !roomData.code
        ) {

            alert(
                "创建房间失败"
            );

            return;

        }


        myRoomCode =
            roomData.code;


        myPlayerName =
            roomData.hostName ||
            myPlayerName;


        saveLoginInfo();


        showRoom();

    }
);


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


    if (
        !nameInput ||
        !roomCodeInput
    ) {

        alert(
            "页面组件缺失，请刷新网页"
        );

        return;

    }


    const name =
        nameInput.value.trim();


    const code =
        roomCodeInput.value.trim();


    if (!name) {

        alert(
            "请输入昵称"
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


    if (!socket.connected) {

        alert(
            "服务器还没有连接好，请稍等"
        );

        return;

    }


    leavingRoom =
        false;


    myPlayerName =
        name;


    localStorage.setItem(
        "cs2_player_name",
        name
    );


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
// 加入成功
// ======================================================

socket.on(
    "join_success",
    data => {

        console.log(
            "加入成功:",
            data
        );


        if (leavingRoom) {

            return;

        }


        roomData =
            data.room ||
            data;


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
// 显示房间
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
// 房间更新
// ======================================================

socket.on(
    "room_update",
    data => {

        if (leavingRoom) {

            return;

        }


        if (!data) {

            return;

        }


        roomData =
            data;


        updateRoomUI();

    }
);


// ======================================================
// 房间 UI
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
            roomData.code ||
            "------";

    }


    if (playerCount) {

        playerCount.textContent =
            roomData.playerCount ||
            0;

    }


    if (maxPlayerCount) {

        maxPlayerCount.textContent =
            roomData.maxPlayers ||
            10;

    }


    if (roomMode) {

        let modeText =
            roomData.mode ===
            "TEAM"
                ? "⚔️ 分组模式"
                : "🎭 内鬼模式";


        if (
            roomData.isTestRoom
        ) {

            modeText =
                "🧪 单人测试 · " +
                modeText;

        }


        roomMode.textContent =
            `${modeText} · ${roomData.maxPlayers}人`;

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
     * 开始按钮
     */

    if (startButton) {

        const full =
            Number(
                roomData.playerCount
            ) ===
            Number(
                roomData.maxPlayers
            );


        if (
            isCurrentHost() &&
            full &&
            roomData.state ===
                "WAITING"
        ) {

            startButton.style.display =
                "block";


            if (
                roomData.isTestRoom
            ) {

                startButton.textContent =
                    roomData.mode ===
                    "TEAM"
                        ? "🧪 开始测试 · 分组模式"
                        : "🧪 开始测试 · 内鬼模式";

            } else {

                startButton.textContent =
                    "🚀 开始游戏";

            }

        } else {

            startButton.style.display =
                "none";

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
        roomData.playerCount !==
        roomData.maxPlayers
    ) {

        alert(
            `需要 ${roomData.maxPlayers} 人才能开始`
        );

        return;

    }


    if (!socket.connected) {

        alert(
            "服务器连接已经断开"
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
            "我的私人身份:",
            info
        );


        myPrivateInfo =
            info;

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


            notice.textContent =
                `⚔️ 第 ${data.round} 局分组模式：${counts.ct} CT vs ${counts.t} T`;

        } else {

            notice.textContent =
                `🎭 第 ${data.round} 局内鬼模式：点击自己的名字查看身份`;

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


            const botText =
                player.name.startsWith(
                    "🤖"
                )
                    ? "🤖"
                    : "";


            /*
             * 分组模式
             */

            if (
                data.mode ===
                "TEAM"
            ) {

                card.innerHTML = `
                    <div class="card-visible">

                        <div class="player-name">
                            ${botText}
                            ${escapeHTML(
                                player.name.replace(
                                    "🤖 ",
                                    ""
                                )
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
             * 内鬼模式
             */

            const isMe =
                player.id ===
                myId;


            card.innerHTML = `
                <div class="card-hidden">

                    <div class="player-name">

                        ${
                            botText
                                ? "🤖 "
                                : ""
                        }

                        ${escapeHTML(
                            player.name.replace(
                                "🤖 ",
                                ""
                            )
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
                                : "👤"
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
// 阵营人数
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
     * 正常进行
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
     * 揭晓
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


            controls.appendChild(
                waiting
            );

        }

    }


    /*
     * 退出
     */

    const backButton =
        document.createElement(
            "button"
        );


    backButton.textContent =
        "🚪 退出房间";


    backButton.style.marginLeft =
        "10px";


    backButton.onclick =
        () => {

            leaveRoom();

        };


    controls.appendChild(
        backButton
    );


    container.appendChild(
        controls
    );

}


// ======================================================
// 请求私人身份
// ======================================================

function requestMyPrivateInfo() {

    if (!socket.connected) {

        alert(
            "服务器连接已经断开"
        );

        return;

    }


    socket.emit(
        "request_private_role"
    );

}


// ======================================================
// 点击自己的卡
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
        info.role ===
        "SPY"
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
// 结束游戏
// ======================================================

function finishGame() {

    if (!isCurrentHost()) {

        alert(
            "只有房主可以结束本局"
        );

        return;

    }


    if (!currentGame) {

        return;

    }


    if (
        !confirm(
            "确定要结束本局并公布身份吗？"
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
// 最终结果
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

        notice.textContent =
            data.mode ===
            "TEAM"
                ? `⚔️ 第 ${data.round} 局分组结果`
                : `🎭 第 ${data.round} 局身份揭晓`;

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


    if (!currentGame) {

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

        if (leavingRoom) {

            return;

        }


        alert(
            message
        );

    }
);


// ======================================================
// 退出房间
// ======================================================

function leaveRoom() {

    console.log(
        "leaveRoom() 被调用"
    );


    if (leavingRoom) {

        return;

    }


    if (
        !confirm(
            "确定要退出这个房间吗？"
        )
    ) {

        return;

    }


    leavingRoom =
        true;


    reconnecting =
        false;


    /*
     * 通知服务器。
     *
     * 不等待 callback。
     */

    if (
        socket &&
        socket.connected
    ) {

        socket.emit(
            "leave_room"
        );

    }


    /*
     * 清除本地房间信息。
     */

    clearLoginInfo();


    /*
     * 立即回大厅。
     */

    returnToLobby();

}


// ======================================================
// 回到主界面
// ======================================================

function returnToLobby() {

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


    const startButton =
        document.getElementById(
            "startButton"
        );


    if (startButton) {

        startButton.style.display =
            "none";

    }


    const roomCodeInput =
        document.getElementById(
            "roomCodeInput"
        );


    if (roomCodeInput) {

        roomCodeInput.value =
            "";

    }


    const nameInput =
        document.getElementById(
            "nameInput"
        );


    if (nameInput) {

        nameInput.value =
            "";

    }


    const joinPanel =
        document.getElementById(
            "joinPanel"
        );


    if (joinPanel) {

        joinPanel.style.display =
            "none";

    }


    /*
     * 退出完成后，
     * 下一次创建/测试房间允许正常连接。
     */

    setTimeout(
        () => {

            leavingRoom =
                false;

        },
        100
    );


    /*
     * 测试按钮仍然存在。
     */

    ensureTestButtons();

}


// ======================================================
// HTML 转义
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
// 页面加载完成以后
// 确保测试按钮存在
// ======================================================

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        () => {

            ensureTestButtons();

        }
    );

} else {

    ensureTestButtons();

}