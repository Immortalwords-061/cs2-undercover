// ======================================================
// CS2 Undercover
// 前端完整稳定版
// ======================================================

const socket = io(
    "https://cs2-undercover.onrender.com"
);


// ======================================================
// 全局状态
// ======================================================

let myId = null;

let myRoomCode =
    localStorage.getItem("cs2_room_code");

let myPlayerName =
    localStorage.getItem("cs2_player_name");

let roomData = null;

let currentGame = null;

let myPrivateInfo = null;

let reconnecting = false;

let leavingRoom = false;


// ======================================================
// DOM
// ======================================================

const lobby =
    document.getElementById("lobby");

const room =
    document.getElementById("room");

const game =
    document.getElementById("game");


// ======================================================
// 房主判断
// ======================================================

function isCurrentHost() {

    if (!roomData) {
        return false;
    }

    return roomData.hostId === myId;
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

        myId = socket.id;

        console.log(
            "服务器连接成功:",
            myId
        );

        if (leavingRoom) {
            return;
        }

        if (
            myRoomCode &&
            myPlayerName &&
            !reconnecting
        ) {

            reconnectToGame();
        }

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

    reconnecting = true;

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
// 自动重连成功
// ======================================================

socket.on(
    "rejoin_success",
    data => {

        reconnecting = false;

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

        reconnecting = false;

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

    leavingRoom = false;

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

    leavingRoom = false;

    myPlayerName =
        name;

    localStorage.setItem(
        "cs2_player_name",
        name
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
// 单人测试按钮
// ======================================================

function ensureTestButtons() {

    const lobbyElement =
        document.getElementById(
            "lobby"
        );

    if (!lobbyElement) {
        return;
    }

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
        "2px dashed #888";

    panel.style.borderRadius =
        "12px";

    panel.style.textAlign =
        "center";


    const title =
        document.createElement(
            "div"
        );

    title.textContent =
        "🧪 单人测试模式";

    title.style.fontSize =
        "20px";

    title.style.fontWeight =
        "bold";

    title.style.marginBottom =
        "8px";

    panel.appendChild(
        title
    );


    const description =
        document.createElement(
            "div"
        );

    description.textContent =
        "选择上面的游戏人数后，可以一个人自动补机器人测试";

    description.style.fontSize =
        "13px";

    description.style.opacity =
        "0.75";

    description.style.marginBottom =
        "12px";

    panel.appendChild(
        description
    );


    const undercoverButton =
        document.createElement(
            "button"
        );

    undercoverButton.type =
        "button";

    undercoverButton.textContent =
        "🎭 单人测试 · 内鬼模式";

    undercoverButton.style.margin =
        "5px";

    undercoverButton.style.padding =
        "10px 16px";

    undercoverButton.style.cursor =
        "pointer";

    undercoverButton.onclick =
        () => {

            createTestRoom(
                "UNDERCOVER"
            );
        };

    panel.appendChild(
        undercoverButton
    );


    const teamButton =
        document.createElement(
            "button"
        );

    teamButton.type =
        "button";

    teamButton.textContent =
        "⚔️ 单人测试 · 分组模式";

    teamButton.style.margin =
        "5px";

    teamButton.style.padding =
        "10px 16px";

    teamButton.style.cursor =
        "pointer";

    teamButton.onclick =
        () => {

            createTestRoom(
                "TEAM"
            );
        };

    panel.appendChild(
        teamButton
    );


    lobbyElement.appendChild(
        panel
    );

    console.log(
        "✅ 单人测试按钮已经添加"
    );
}


// ======================================================
// 创建成功
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
// 显示加入房间面板
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

    leavingRoom = false;

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
// 更新房间 UI
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
        Number(
            roomData.playerCount
        ) !==
        Number(
            roomData.maxPlayers
        )
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

        /*
         * 单人测试模式：
         * data 里已经包含所有 Bot 的身份任务。
         */

        if (
            data &&
            data.isTestRoom
        ) {

            myPrivateInfo =
                data.players.find(
                    player =>
                        player.id ===
                        myId
                ) || null;

        } else {

            myPrivateInfo =
                null;
        }

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
            "收到私人身份:",
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

            if (
                data.isTestRoom
            ) {

                notice.textContent =
                    `🧪 第 ${data.round} 局单人测试：点击任意玩家查看身份和任务`;

            } else {

                notice.textContent =
                    `🎭 第 ${data.round} 局内鬼模式：点击自己的名字查看身份`;
            }
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


            const isMe =
                player.id ===
                myId;


            /*
             * ==================================================
             * 单人测试模式
             *
             * 所有玩家都可以点击。
             *
             * 包括：
             * 自己
             * Bot
             *
             * 点击以后显示：
             * 阵营
             * 身份
             * 任务
             * ==================================================
             */

            if (
                data.isTestRoom ===
                true
            ) {

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
                            👁️ 点击查看身份和任务
                        </div>

                    </div>
                `;


                card.style.cursor =
                    "pointer";


                /*
                 * 把玩家数据直接保存到卡片。
                 */

                card._testPlayer =
                    player;


                card.onclick =
                    () => {

                        toggleTestPlayerCard(
                            card
                        );
                    };


                container.appendChild(
                    card
                );


                return;
            }


            /*
             * ==================================================
             * 正常分组模式
             * ==================================================
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
             * ==================================================
             * 正常多人内鬼模式
             *
             * 只有自己可以点击。
             * ==================================================
             */

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
// 单人测试模式：切换任意玩家身份
// ======================================================

function toggleTestPlayerCard(
    card
) {

    const player =
        card._testPlayer;


    if (!player) {
        return;
    }


    if (
        card.classList.contains(
            "revealed"
        )
    ) {

        card.classList.remove(
            "revealed"
        );


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
                    👁️ 点击查看身份和任务
                </div>

            </div>
        `;


        return;
    }


    card.classList.add(
        "revealed"
    );


    const roleText =
        player.role ===
        "SPY"
            ? "🕵️ 内鬼"
            : "🛡️ 好人";


    const taskText =
        player.task ||
        "暂无任务";


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

            <div class="role">
                ${roleText}
            </div>

            <div class="task-title">
                🎯 任务
            </div>

            <div class="task-text">
                ${escapeHTML(
                    taskText
                )}
            </div>

            <div class="hide-text">
                👁️ 点击隐藏
            </div>

        </div>
    `;
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
     * 游戏进行中
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
     * 揭晓阶段
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
     * 退出房间
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
// 正常模式：切换自己的身份卡
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
// 正常模式：显示自己的身份
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
// 正常模式：隐藏自己的身份
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

    if (leavingRoom) {
        return;
    }


    const confirmed =
        confirm(
            "确定要退出这个房间吗？"
        );


    if (!confirmed) {
        return;
    }


    leavingRoom =
        true;

    reconnecting =
        false;


    if (
        socket &&
        socket.connected
    ) {

        socket.emit(
            "leave_room"
        );
    }


    clearLoginInfo();

    returnToLobby();
}


// ======================================================
// 返回主界面
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


    setTimeout(
        () => {

            leavingRoom =
                false;

        },
        100
    );


    ensureTestButtons();
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


// ======================================================
// 页面加载
// ======================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        ensureTestButtons();

    }
);


setTimeout(
    () => {

        ensureTestButtons();

    },
    500
);