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

let currentVoting =
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
// 房主
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
// 保存当前登录
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
// 清除当前登录
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

    currentVoting =
        null;

}


// ======================================================
// 保存最后离开的房间
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
// 清除最后房间
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

        reconnecting =
            false;


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
// 自动恢复失败
// ======================================================

socket.on(
    "rejoin_failed",
    message => {

        reconnecting =
            false;


        if (leavingRoom) {

            return;

        }


        clearLoginInfo();

        clearLastRoom();

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
// 创建单人测试房间
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
        "选择游戏人数后自动补 Bot，可测试投票、平票重投和身份揭晓";


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
     * 内鬼
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
     * 分组
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
// 创建房间成功
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
// 加入房间成功
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


        currentVoting =
            null;


        /*
         * 单人测试：
         * 直接从 game_started 里获取自己的完整身份。
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
     * 强制整个玩家区域纵向排列。
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
     * ==================================================
     * 创建阵营区域
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


        section.style.display =
            "block";


        section.style.width =
            "100%";


        section.style.maxWidth =
            "100%";


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
         * 卡片一排
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


        /*
         * 玩家卡片
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


                card.style.width =
                    "100%";


                card.style.minWidth =
                    "0";


                card.style.boxSizing =
                    "border-box";


                const isMe =
                    player.id ===
                    myId;


                /*
                 * ==================================================
                 * 单人测试
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
                 * ==================================================
                 * 分组模式
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


                    row.appendChild(
                        card
                    );


                    return;

                }


                /*
                 * ==================================================
                 * 普通多人内鬼模式
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
// 单人测试：点击任意玩家
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
     * 隐藏
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


        return;

    }


    /*
     * 显示
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
        "18px";


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


            if (
                currentGame.mode ===
                "UNDERCOVER"
            ) {

                finishButton.textContent =
                    "🗳️ 开始投票";

            } else {

                finishButton.textContent =
                    "🏁 结束本局";

            }


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
     * VOTING
     */

    if (
        currentGame &&
        currentGame.state ===
            "VOTING"
    ) {

        const text =
            document.createElement(
                "div"
            );


        text.textContent =
            "🗳️ 投票进行中";


        text.style.margin =
            "10px";


        controls.appendChild(
            text
        );

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
     * 退出
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
// 开始投票 / 结束本局
// ======================================================

function finishGame() {

    if (!isCurrentHost()) {

        alert(
            "只有房主可以执行此操作"
        );


        return;

    }


    if (!currentGame) {

        return;

    }


    if (
        currentGame.mode ===
        "UNDERCOVER"
    ) {

        if (
            !confirm(
                "确定结束当前游戏并开始投票吗？"
            )
        ) {

            return;

        }

    } else {

        if (
            !confirm(
                "确定要结束本局吗？"
            )
        ) {

            return;

        }

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
// 投票开始
// ======================================================

socket.on(
    "voting_started",
    data => {

        console.log(
            "投票开始:",
            data
        );


        currentVoting =
            data;


        currentGame =
            currentGame || {};


        currentGame.state =
            "VOTING";


        showVoting(
            data
        );

    }
);


// ======================================================
// 投票页面
// ======================================================

function showVoting(
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
            currentGame &&
            currentGame.round
                ? currentGame.round
                : data.round;

    }


    const container =
        document.getElementById(
            "players"
        );


    if (!container) {

        return;

    }


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


    container.innerHTML =
        "";


    /*
     * 标题
     */

    const title =
        document.createElement(
            "div"
        );


    title.style.textAlign =
        "center";


    title.style.fontSize =
        "24px";


    title.style.fontWeight =
        "bold";


    title.style.marginBottom =
        "10px";


    title.textContent =
        data.revote
            ? "🔄 平票！请其他玩家重新投票"
            : "🗳️ 投票阶段";


    container.appendChild(
        title
    );


    /*
     * 说明
     */

    const description =
        document.createElement(
            "div"
        );


    description.style.textAlign =
        "center";


    description.style.marginBottom =
        "18px";


    if (
        data.revote
    ) {

        description.textContent =
            "本轮只能投上一轮并列最高票的玩家；候选人不能投票。";

    } else {

        description.textContent =
            "请选择你认为应该被投出去的玩家。不能投自己。";

    }


    container.appendChild(
        description
    );


    /*
     * 当前进度
     */

    const progress =
        document.createElement(
            "div"
        );


    progress.id =
        "voteProgress";


    progress.style.textAlign =
        "center";


    progress.style.marginBottom =
        "18px";


    progress.textContent =
        `已投票 ${data.votedCount} / ${data.voterCount}`;


    container.appendChild(
        progress
    );


    /*
     * 自己不能投
     */

    if (
        !data.canVote
    ) {

        const noVote =
            document.createElement(
                "div"
            );


        noVote.style.textAlign =
            "center";


        noVote.style.margin =
            "10px";


        noVote.textContent =
            "你是本轮候选人，不能参与本轮投票。";


        container.appendChild(
            noVote
        );

    }


    /*
     * 候选人区域
     */

    const row =
        document.createElement(
            "div"
        );


    row.style.display =
        "grid";


    row.style.gridTemplateColumns =
        `repeat(${Math.max(
            data.candidates.length,
            1
        )}, minmax(0, 1fr))`;


    row.style.gap =
        "16px";


    row.style.width =
        "100%";


    row.style.boxSizing =
        "border-box";


    data.candidates.forEach(
        candidate => {

            const card =
                document.createElement(
                    "div"
                );


            card.className =
                "player-card";


            card.style.width =
                "100%";


            card.style.boxSizing =
                "border-box";


            const isSelf =
                candidate.id ===
                myId;


            const disabled =
                !data.canVote ||
                data.hasVoted ||
                isSelf;


            card.innerHTML = `
                <div class="card-visible">

                    <div class="player-name">
                        ${escapeHTML(
                            candidate.name
                        )}
                    </div>

                    <div class="team-text">
                        ${
                            candidate.team ===
                            "CT"
                                ? "🔵 CT"
                                : "🟠 T"
                        }
                    </div>

                    ${
                        isSelf
                            ? `
                                <div class="click-text">
                                    🚫 不能投自己
                                </div>
                            `
                            : data.hasVoted
                                ? `
                                    <div class="click-text">
                                        ✅ 已投票
                                    </div>
                                `
                                : data.canVote
                                    ? `
                                        <div class="click-text">
                                            🗳️ 点击投票
                                        </div>
                                    `
                                    : `
                                        <div class="click-text">
                                            🚫 本轮不能投票
                                        </div>
                                    `
                    }

                </div>
            `;


            if (!disabled) {

                card.style.cursor =
                    "pointer";


                card.onclick =
                    () => {

                        castVote(
                            candidate.id
                        );

                    };

            } else {

                card.style.opacity =
                    "0.65";

            }


            row.appendChild(
                card
            );

        }
    );


    container.appendChild(
        row
    );


    /*
     * 底部控制
     */

    addGameControlButtons();

}


// ======================================================
// 投票
// ======================================================

function castVote(
    targetId
) {

    if (!currentVoting) {

        return;

    }


    if (
        !currentVoting.canVote
    ) {

        return;

    }


    if (
        currentVoting.hasVoted
    ) {

        return;

    }


    if (
        targetId ===
        myId
    ) {

        alert(
            "不能投自己"
        );


        return;

    }


    socket.emit(
        "cast_vote",
        {
            targetId:
                targetId
        }
    );

}


// ======================================================
// 投票成功
// ======================================================

socket.on(
    "vote_submitted",
    data => {

        if (!currentVoting) {

            return;

        }


        currentVoting.hasVoted =
            true;


        currentVoting.selectedTargetId =
            data.targetId;


        showVoting(
            currentVoting
        );

    }
);


// ======================================================
// 投票进度
// ======================================================

socket.on(
    "vote_progress",
    data => {

        if (!currentVoting) {

            return;

        }


        currentVoting.votedCount =
            data.votedCount;


        currentVoting.voterCount =
            data.voterCount;


        currentVoting.hasVoted =
            data.hasVoted;


        showVoting(
            currentVoting
        );

    }
);


// ======================================================
// 平票
// ======================================================

socket.on(
    "vote_tie",
    data => {

        console.log(
            "平票:",
            data
        );

        /*
         * 真正的下一轮 voting_started
         * 会紧接着到达。
         */

    }
);


// ======================================================
// 投票错误
// ======================================================

socket.on(
    "vote_error",
    message => {

        alert(
            message
        );

    }
);


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


        currentVoting =
            null;


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
            data.voteResult
        ) {

            notice.textContent =
                data.voteResult.winnerText;

        } else if (
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
     * ==================================================
     * 投票结果
     * ==================================================
     */

    if (
        data.voteResult
    ) {

        const resultBox =
            document.createElement(
                "div"
            );


        resultBox.style.textAlign =
            "center";


        resultBox.style.marginBottom =
            "24px";


        resultBox.innerHTML = `
            <div
                style="
                    font-size:24px;
                    font-weight:bold;
                    margin-bottom:8px;
                "
            >
                ${escapeHTML(
                    data.voteResult.winnerText
                )}
            </div>

            <div>
                被投出：
                <strong>
                    ${escapeHTML(
                        data.voteResult.eliminatedName
                    )}
                </strong>
            </div>

            <div>
                身份：
                <strong>
                    ${getRoleText(
                        data.voteResult.eliminatedRole
                    )}
                </strong>
            </div>
        `;


        container.appendChild(
            resultBox
        );


        /*
         * 得票结果
         */

        const voteTitle =
            document.createElement(
                "div"
            );


        voteTitle.style.textAlign =
            "center";


        voteTitle.style.fontSize =
            "20px";


        voteTitle.style.fontWeight =
            "bold";


        voteTitle.style.marginBottom =
            "12px";


        voteTitle.textContent =
            "🗳️ 最终投票结果";


        container.appendChild(
            voteTitle
        );


        const voteRows =
            document.createElement(
                "div"
            );


        voteRows.style.width =
            "100%";


        const counts =
            data.voteResult.counts ||
            {};


        const sortedVotes =
            Object.entries(
                counts
            ).sort(
                (
                    [, a],
                    [, b]
                ) =>
                    b - a
            );


        sortedVotes.forEach(
            (
                [
                    playerId,
                    voteCount
                ]
            ) => {

                const player =
                    data.players.find(
                        item =>
                            item.id ===
                            playerId
                    );


                if (!player) {

                    return;

                }


                const row =
                    document.createElement(
                        "div"
                    );


                row.style.display =
                    "flex";


                row.style.justifyContent =
                    "space-between";


                row.style.padding =
                    "10px 14px";


                row.style.marginBottom =
                    "6px";


                row.style.border =
                    "1px solid rgba(128,128,128,.35)";


                row.style.borderRadius =
                    "8px";


                row.innerHTML = `
                    <span>
                        ${escapeHTML(
                            player.name
                        )}
                    </span>

                    <strong>
                        ${voteCount} 票
                    </strong>
                `;


                voteRows.appendChild(
                    row
                );

            }
        );


        container.appendChild(
            voteRows
        );

    }


    /*
     * ==================================================
     * 身份揭晓
     * ==================================================
     */

    const revealTitle =
        document.createElement(
            "div"
        );


    revealTitle.style.textAlign =
        "center";


    revealTitle.style.fontSize =
        "20px";


    revealTitle.style.fontWeight =
        "bold";


    revealTitle.style.margin =
        "24px 0 12px";


    revealTitle.textContent =
        "🎭 身份揭晓";


    container.appendChild(
        revealTitle
    );


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
     * 创建一排最终结果
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


        const title =
            document.createElement(
                "div"
            );


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


                card.style.width =
                    "100%";


                card.style.minWidth =
                    "0";


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
// 房间关闭
// ======================================================

socket.on(
    "room_closed",
    data => {

        console.log(
            "房间关闭:",
            data
        );


        reconnecting =
            false;


        leavingRoom =
            true;


        clearLoginInfo();

        clearLastRoom();

        returnToLobby();


        alert(
            data &&
            data.message
                ? data.message
                : "房间已经关闭"
        );


        setTimeout(
            () => {

                leavingRoom =
                    false;

            },
            100
        );

    }
);


// ======================================================
// 主动退出房间
// ======================================================

function leaveRoom() {

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


    /*
     * 房主退出会关闭整个房间，
     * 所以不保存“重新加入”。
     */

    if (
        roomData &&
        roomData.hostId ===
            myId
    ) {

        clearLastRoom();

    } else {

        /*
         * 普通玩家保存，
         * 以后可以重新加入。
         */

        saveLastRoom();

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


    const joinPanel =
        document.getElementById(
            "joinPanel"
        );


    if (joinPanel) {

        joinPanel.style.display =
            "none";

    }


    /*
     * 不清空昵称，
     * 方便重新加入。
     */

    ensureTestButtons();

    ensureRejoinButton();


    setTimeout(
        () => {

            leavingRoom =
                false;

        },
        100
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