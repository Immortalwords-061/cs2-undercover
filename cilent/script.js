// ======================================================
// CS2 Undercover
// 前端完整最终版
// ======================================================


const socket =
    io(
        "https://cs2-undercover.onrender.com"
    );


// ======================================================
// 全局状态
// ======================================================

let myId =
    null;


let myRoomCode =
    localStorage.getItem(
        "cs2_room_code"
    );


let myPlayerName =
    localStorage.getItem(
        "cs2_player_name"
    );


let lastRoomCode =
    localStorage.getItem(
        "cs2_last_room_code"
    );


let lastPlayerName =
    localStorage.getItem(
        "cs2_last_player_name"
    );


let roomData =
    null;


let currentGame =
    null;


let myPrivateInfo =
    null;


let reconnecting =
    false;


let leavingRoom =
    false;


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
// 保存当前房间
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
// 清除当前房间
// ======================================================

function clearLoginInfo() {

    localStorage.removeItem(
        "cs2_room_code"
    );


    localStorage.removeItem(
        "cs2_player_name"
    );


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

}


// ======================================================
// 保存最后一次退出的房间
// ======================================================

function saveLastRoom() {

    if (
        myRoomCode &&
        myPlayerName
    ) {

        lastRoomCode =
            myRoomCode;


        lastPlayerName =
            myPlayerName;


        localStorage.setItem(
            "cs2_last_room_code",
            lastRoomCode
        );


        localStorage.setItem(
            "cs2_last_player_name",
            lastPlayerName
        );

    }

}


// ======================================================
// 清除最后一次退出的房间
// ======================================================

function clearLastRoom() {

    lastRoomCode =
        null;


    lastPlayerName =
        null;


    localStorage.removeItem(
        "cs2_last_room_code"
    );


    localStorage.removeItem(
        "cs2_last_player_name"
    );

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
         * 主动退出后不要自动重连
         */

        if (leavingRoom) {

            return;

        }


        /*
         * 正在房间里
         */

        if (
            myRoomCode &&
            myPlayerName &&
            !reconnecting
        ) {

            reconnectToGame();

        }


        ensureTestButtons();

        ensureRejoinButton();

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
// 自动恢复
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
// 自动恢复成功
// ======================================================

socket.on(
    "rejoin_success",
    data => {

        console.log(
            "自动恢复成功:",
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
         * 如果还是等待状态
         */

        if (
            roomData.state ===
            "WAITING"
        ) {

            showRoom();

        }

    }
);


// ======================================================
// 自动恢复失败
// ======================================================

socket.on(
    "rejoin_failed",
    message => {

        console.log(
            "自动恢复失败:",
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
// 创建普通房间
// ======================================================

function createRoom(
    mode
) {

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


    myRoomCode =
        null;


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

function createTestRoom(
    mode
) {

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


    leavingRoom =
        false;


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


    /*
     * 标题
     */

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


    /*
     * 说明
     */

    const description =
        document.createElement(
            "div"
        );


    description.textContent =
        "选择游戏人数后自动补 Bot，可以查看所有玩家身份和任务";


    description.style.fontSize =
        "13px";


    description.style.opacity =
        "0.75";


    description.style.marginBottom =
        "12px";


    panel.appendChild(
        description
    );


    /*
     * 内鬼模式
     */

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


    /*
     * 分组模式
     */

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

}


// ======================================================
// 重新加入按钮
// ======================================================

function ensureRejoinButton() {

    const lobbyElement =
        document.getElementById(
            "lobby"
        );


    if (!lobbyElement) {

        return;

    }


    const oldButton =
        document.getElementById(
            "rejoinLastRoomButton"
        );


    if (oldButton) {

        oldButton.remove();

    }


    if (
        !lastRoomCode ||
        !lastPlayerName
    ) {

        return;

    }


    const button =
        document.createElement(
            "button"
        );


    button.id =
        "rejoinLastRoomButton";


    button.type =
        "button";


    button.textContent =
        `🔁 重新加入上一个房间（${lastRoomCode}）`;


    button.style.display =
        "block";


    button.style.width =
        "100%";


    button.style.marginTop =
        "12px";


    button.style.padding =
        "12px";


    button.style.cursor =
        "pointer";


    button.onclick =
        () => {

            rejoinLastRoom();

        };


    lobbyElement.appendChild(
        button
    );

}


// ======================================================
// 重新加入上一个房间
// ======================================================

function rejoinLastRoom() {

    if (
        !lastRoomCode ||
        !lastPlayerName
    ) {

        alert(
            "没有可以重新加入的房间"
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


    myRoomCode =
        lastRoomCode;


    myPlayerName =
        lastPlayerName;


    localStorage.setItem(
        "cs2_room_code",
        myRoomCode
    );


    localStorage.setItem(
        "cs2_player_name",
        myPlayerName
    );


    socket.emit(
        "join_room",
        {

            roomCode:
                myRoomCode,

            name:
                myPlayerName

        }
    );

}


// ======================================================
// 创建成功
// ======================================================

socket.on(
    "room_created",
    data => {

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


        clearLastRoom();


        showRoom();

    }
);


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


            myPlayerName =
                myPlayerName ||
                roomData.hostName;


            saveLoginInfo();


            if (
                myRoomCode ===
                lastRoomCode
            ) {

                clearLastRoom();

            }

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
// 更新房间页面
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
                (
                    player,
                    index
                ) => {

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
         * 单人测试模式
         * 服务器已经发送全部身份。
         */

        if (
            data &&
            data.isTestRoom ===
                true
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
// 身份文字
// ======================================================

function getRoleText(
    role
) {

    if (
        role ===
        "SPY"
    ) {

        return "🕵️ 内鬼";

    }


    if (
        role ===
        "DODO"
    ) {

        return "🦤 呆呆鸟";

    }


    if (
        role ===
        "CIVILIAN"
    ) {

        return "🛡️ 平民";

    }


    /*
     * 兼容旧数据
     */

    if (
        role ===
        "GOOD"
    ) {

        return "🛡️ 平民";

    }


    return "🛡️ 平民";

}


// ======================================================
// 显示游戏
// ======================================================

function showGame(
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


    /*
     * 第几局
     */

    const roundNumber =
        document.getElementById(
            "roundNumber"
        );


    if (roundNumber) {

        roundNumber.textContent =
            data.round;

    }


    /*
     * 提示文字
     */

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
                    `🧪 第 ${data.round} 局测试：点击任意玩家查看身份和任务`;

            } else {

                notice.textContent =
                    `🎭 第 ${data.round} 局内鬼模式：点击自己的卡片查看身份`;

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


    /*
     * 关键：
     *
     * 强制 players 容器变为纵向两大区域。
     *
     * CT 整行
     * T  整行
     */

    container.style.setProperty(
        "display",
        "block",
        "important"
    );


    container.style.setProperty(
        "width",
        "100%",
        "important"
    );


    container.style.setProperty(
        "grid-template-columns",
        "none",
        "important"
    );


    container.style.setProperty(
        "gap",
        "0",
        "important"
    );


    container.innerHTML =
        "";


    /*
     * CT
     */

    const ctPlayers =
        data.players.filter(
            player =>
                player.team ===
                "CT"
        );


    /*
     * T
     */

    const tPlayers =
        data.players.filter(
            player =>
                player.team ===
                "T"
        );


    /*
     * ==================================================
     * 创建阵营区
     * ==================================================
     */

    function createTeamSection(
        players,
        team
    ) {

        const section =
            document.createElement(
                "div"
            );


        section.className =
            "team-section";


        section.style.setProperty(
            "display",
            "block",
            "important"
        );


        section.style.setProperty(
            "width",
            "100%",
            "important"
        );


        section.style.setProperty(
            "max-width",
            "100%",
            "important"
        );


        section.style.boxSizing =
            "border-box";


        section.style.marginBottom =
            "28px";


        /*
         * 标题
         */

        const title =
            document.createElement(
                "div"
            );


        title.className =
            "team-section-title";


        title.style.width =
            "100%";


        title.style.textAlign =
            "center";


        title.style.fontSize =
            "20px";


        title.style.fontWeight =
            "bold";


        title.style.marginBottom =
            "12px";


        title.textContent =
            team ===
                "CT"
                ? `🔵 CT（${players.length}人）`
                : `🟠 T（${players.length}人）`;


        section.appendChild(
            title
        );


        /*
         * 玩家卡区域
         */

        const row =
            document.createElement(
                "div"
            );


        row.className =
            "team-player-row";


        row.style.setProperty(
            "display",
            "grid",
            "important"
        );


        row.style.setProperty(
            "width",
            "100%",
            "important"
        );


        row.style.setProperty(
            "grid-template-columns",
            `repeat(${Math.max(
                players.length,
                1
            )}, minmax(0, 1fr))`,
            "important"
        );


        row.style.gap =
            "16px";


        row.style.boxSizing =
            "border-box";


        /*
         * 玩家卡
         */

        players.forEach(
            player => {

                const card =
                    document.createElement(
                        "div"
                    );


                card.className =
                    "player-card";


                card.dataset.playerId =
                    player.id;


                card.style.minWidth =
                    "0";


                card.style.width =
                    "100%";


                card.style.boxSizing =
                    "border-box";


                const isMe =
                    player.id ===
                    myId;


                /*
                 * ==========================================
                 * 单人测试模式
                 *
                 * 自己 + Bot 全部可以查看。
                 * ==========================================
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


                    card._testPlayer =
                        player;


                    card.onclick =
                        () => {

                            toggleTestPlayerCard(
                                card
                            );

                        };


                    row.appendChild(
                        card
                    );


                    return;

                }


                /*
                 * ==========================================
                 * 正常分组模式
                 * ==========================================
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


                    row.appendChild(
                        card
                    );


                    return;

                }


                /*
                 * ==========================================
                 * 正常多人内鬼模式
                 *
                 * 只有本人可以点击。
                 * ==========================================
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


                row.appendChild(
                    card
                );

            }
        );


        section.appendChild(
            row
        );


        return section;

    }


    /*
     * CT 第一排
     */

    if (
        ctPlayers.length > 0
    ) {

        container.appendChild(
            createTeamSection(
                ctPlayers,
                "CT"
            )
        );

    }


    /*
     * T 第二排
     */

    if (
        tPlayers.length > 0
    ) {

        container.appendChild(
            createTeamSection(
                tPlayers,
                "T"
            )
        );

    }


    addGameControlButtons();

}


// ======================================================
// 测试模式：点击任意玩家
// ======================================================

function toggleTestPlayerCard(
    card
) {

    const player =
        card._testPlayer;


    if (!player) {

        return;

    }


    /*
     * 已经展开
     */

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


        /*
         * 注意：
         *
         * 重新写 innerHTML 不影响
         * 原来的 onclick，
         * 因为 onclick 绑定在 card 外层。
         */

        return;

    }


    /*
     * 展开
     */

    card.classList.add(
        "revealed"
    );


    const roleText =
        getRoleText(
            player.role
        );


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


    controls.style.width =
        "100%";


    controls.style.textAlign =
        "center";


    controls.style.marginTop =
        "10px";


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


            finishButton.type =
                "button";


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
     * 游戏结束
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


            nextButton.type =
                "button";


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
     * 退出房间
     */

    const backButton =
        document.createElement(
            "button"
        );


    backButton.type =
        "button";


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
// 请求自己的私人信息
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
// 正常模式：点击自己的卡
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


    if (!info) {

        return;

    }


    card.classList.add(
        "revealed"
    );


    const roleText =
        getRoleText(
            info.role
        );


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
// 正常模式：隐藏自己
// ======================================================

function hideMyCard(
    card
) {

    if (!myPrivateInfo) {

        return;

    }


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


    if (!socket.connected) {

        alert(
            "服务器连接已经断开"
        );


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


    /*
     * 强制最终结果也使用纵向两排
     */

    container.style.setProperty(
        "display",
        "block",
        "important"
    );


    container.style.setProperty(
        "width",
        "100%",
        "important"
    );


    container.style.setProperty(
        "grid-template-columns",
        "none",
        "important"
    );


    container.style.setProperty(
        "gap",
        "0",
        "important"
    );


    container.innerHTML =
        "";


    const ctPlayers =
        data.players.filter(
            player =>
                player.team ===
                "CT"
        );


    const tPlayers =
        data.players.filter(
            player =>
                player.team ===
                "T"
        );


    /*
     * 创建最终一排
     */

    function createFinalSection(
        players,
        team
    ) {

        const section =
            document.createElement(
                "div"
            );


        section.style.display =
            "block";


        section.style.width =
            "100%";


        section.style.marginBottom =
            "28px";


        /*
         * 标题
         */

        const title =
            document.createElement(
                "div"
            );


        title.style.width =
            "100%";


        title.style.textAlign =
            "center";


        title.style.fontSize =
            "20px";


        title.style.fontWeight =
            "bold";


        title.style.marginBottom =
            "12px";


        title.textContent =
            team ===
                "CT"
                ? `🔵 CT（${players.length}人）`
                : `🟠 T（${players.length}人）`;


        section.appendChild(
            title
        );


        /*
         * 卡片排
         */

        const row =
            document.createElement(
                "div"
            );


        row.style.display =
            "grid";


        row.style.width =
            "100%";


        row.style.gridTemplateColumns =
            `repeat(${Math.max(
                players.length,
                1
            )}, minmax(0, 1fr))`;


        row.style.gap =
            "16px";


        row.style.boxSizing =
            "border-box";


        players.forEach(
            player => {

                const card =
                    document.createElement(
                        "div"
                    );


                card.className =
                    "final-player";


                card.style.minWidth =
                    "0";


                card.style.width =
                    "100%";


                card.style.boxSizing =
                    "border-box";


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
                            ${getRoleText(
                                player.role
                            )}
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


                row.appendChild(
                    card
                );

            }
        );


        section.appendChild(
            row
        );


        return section;

    }


    /*
     * CT
     */

    if (
        ctPlayers.length > 0
    ) {

        container.appendChild(
            createFinalSection(
                ctPlayers,
                "CT"
            )
        );

    }


    /*
     * T
     */

    if (
        tPlayers.length > 0
    ) {

        container.appendChild(
            createFinalSection(
                tPlayers,
                "T"
            )
        );

    }


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


    if (!socket.connected) {

        alert(
            "服务器连接已经断开"
        );


        return;

    }


    socket.emit(
        "next_round"
    );

}


// ======================================================
// 错误消息
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


        ensureRejoinButton();

    }
);


// ======================================================
// 退出房间
// ======================================================

function leaveRoom() {

    if (leavingRoom) {

        return;

    }


    if (
        !confirm(
            "确定要退出这个房间吗？之后可以在主界面重新加入。"
        )
    ) {

        return;

    }


    /*
     * 记录房间。
     */

    saveLastRoom();


    leavingRoom =
        true;


    reconnecting =
        false;


    /*
     * 通知服务器
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
     * 删除当前登录状态
     */

    clearLoginInfo();


    /*
     * 立刻回主界面
     */

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


    /*
     * 清空房间显示
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


    const startButton =
        document.getElementById(
            "startButton"
        );


    if (startButton) {

        startButton.style.display =
            "none";

    }


    /*
     * 清空房间号
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
     * 不清空昵称。
     *
     * 这样重新加入房间的时候
     * 可以继续使用原来的名字。
     */

    /*
     * 隐藏加入区域
     */

    const joinPanel =
        document.getElementById(
            "joinPanel"
        );


    if (joinPanel) {

        joinPanel.style.display =
            "none";

    }


    /*
     * 退出状态恢复
     */

    setTimeout(
        () => {

            leavingRoom =
                false;

        },
        100
    );


    ensureTestButtons();

    ensureRejoinButton();

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
// 页面加载
// ======================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        ensureTestButtons();

        ensureRejoinButton();

    }
);


setTimeout(
    () => {

        ensureTestButtons();

        ensureRejoinButton();

    },
    500
);