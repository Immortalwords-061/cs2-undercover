const socket =
    io(
        "https://cs2-undercover.onrender.com"
    );


/*
 * ======================================================
 * 全局状态
 * ======================================================
 */

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


/*
 * ======================================================
 * DOM
 * ======================================================
 */

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


/*
 * ======================================================
 * 工具
 * ======================================================
 */

function escapeHTML(text) {

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


function getRoleText(role) {

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


function isCurrentHost() {

    if (!roomData) {

        return false;

    }

    return (
        roomData.hostId ===
        myId
    );

}


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


/*
 * ======================================================
 * 连接
 * ======================================================
 */

socket.on(
    "connect",
    () => {

        myId =
            socket.id;


        console.log(
            "服务器连接:",
            myId
        );


        if (
            !leavingRoom &&
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


socket.on(
    "disconnect",
    reason => {

        console.log(
            "服务器断开:",
            reason
        );

    }
);


/*
 * ======================================================
 * 自动重连
 * ======================================================
 */

function reconnectToGame() {

    if (
        leavingRoom ||
        !myRoomCode ||
        !myPlayerName ||
        reconnecting
    ) {

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


/*
 * ======================================================
 * 创建普通房间
 * ======================================================
 */

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


/*
 * ======================================================
 * 单人测试
 * ======================================================
 */

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


/*
 * ======================================================
 * 测试按钮
 * ======================================================
 */

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


    const desc =
        document.createElement(
            "div"
        );


    desc.textContent =
        "自动补充 Bot，可测试身份、投票、平票重投和胜负结算";


    desc.style.fontSize =
        "13px";


    desc.style.opacity =
        "0.75";


    desc.style.marginBottom =
        "12px";


    panel.appendChild(
        desc
    );


    const undercover =
        document.createElement(
            "button"
        );


    undercover.type =
        "button";


    undercover.textContent =
        "🎭 单人测试 · 内鬼模式";


    undercover.style.margin =
        "5px";


    undercover.style.padding =
        "10px 16px";


    undercover.onclick =
        () => {

            createTestRoom(
                "UNDERCOVER"
            );

        };


    panel.appendChild(
        undercover
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


/*
 * ======================================================
 * 重新加入按钮
 * ======================================================
 */

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


    button.onclick =
        () => {

            rejoinLastRoom();

        };


    lobbyElement.appendChild(
        button
    );

}


function rejoinLastRoom() {

    if (
        !lastRoomCode ||
        !lastPlayerName
    ) {

        return;

    }


    if (!socket.connected) {

        alert(
            "服务器还没有连接好"
        );

        return;

    }


    leavingRoom =
        false;


    myRoomCode =
        lastRoomCode;


    myPlayerName =
        lastPlayerName;


    saveLoginInfo();


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


/*
 * ======================================================
 * 创建成功
 * ======================================================
 */

socket.on(
    "room_created",
    data => {

        if (leavingRoom) {

            return;

        }


        roomData =
            data.room ||
            data;


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


/*
 * ======================================================
 * 加入成功
 * ======================================================
 */

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


/*
 * ======================================================
 * 房间
 * ======================================================
 */

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


socket.on(
    "room_update",
    data => {

        if (leavingRoom) {

            return;

        }


        roomData =
            data;


        updateRoomUI();

    }
);


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

        let text =
            roomData.mode ===
                "TEAM"
                ? "⚔️ 分组模式"
                : "🎭 内鬼模式";


        if (
            roomData.isTestRoom
        ) {

            text =
                "🧪 单人测试 · " +
                text;

        }


        roomMode.textContent =
            `${text} · ${roomData.maxPlayers}人`;

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


            startButton.textContent =
                roomData.isTestRoom
                    ? "🧪 开始测试"
                    : "🚀 开始游戏";

        } else {

            startButton.style.display =
                "none";

        }

    }

}


/*
 * ======================================================
 * 开始游戏
 * ======================================================
 */

function startGame() {

    if (!isCurrentHost()) {

        alert(
            "只有房主可以开始游戏"
        );

        return;

    }


    socket.emit(
        "start_game"
    );

}


/*
 * ======================================================
 * 游戏开始
 * ======================================================
 */

socket.on(
    "game_started",
    data => {

        currentGame =
            data;

        currentVoting =
            null;


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


/*
 * ======================================================
 * 私人身份
 * ======================================================
 */

socket.on(
    "private_role",
    info => {

        myPrivateInfo =
            info;

    }
);


/*
 * ======================================================
 * 游戏界面
 * ======================================================
 */

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

            notice.textContent =
                `⚔️ 第 ${data.round} 局分组模式`;

        } else if (
            data.isTestRoom
        ) {

            notice.textContent =
                `🧪 第 ${data.round} 局测试：点击任意玩家查看身份`;

        } else {

            notice.textContent =
                `🎭 第 ${data.round} 局：点击自己的卡片查看身份`;

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


    function createTeamSection(
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


        players.forEach(
            player => {

                const card =
                    document.createElement(
                        "div"
                    );


                card.className =
                    "player-card";


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
                 * 测试模式
                 */

                if (
                    data.isTestRoom
                ) {

                    card._testPlayer =
                        player;


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
                                👁️ 点击查看身份
                            </div>

                        </div>
                    `;


                    card.style.cursor =
                        "pointer";


                    card.onclick =
                        () => {

                            toggleTestPlayerCard(
                                card
                            );

                        };


                /*
                 * 分组模式
                 */

                } else if (
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


                /*
                 * 普通内鬼模式
                 */

                } else {

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
        ctPlayers.length
    ) {

        container.appendChild(
            createTeamSection(
                ctPlayers,
                "CT"
            )
        );

    }


    if (
        tPlayers.length
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


/*
 * ======================================================
 * 测试卡片
 * ======================================================
 */

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
                    👁️ 点击查看身份
                </div>

            </div>
        `;


        return;

    }


    card.classList.add(
        "revealed"
    );


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
                ${getRoleText(
                    player.role
                )}
            </div>

            <div class="task-title">
                🎯 任务
            </div>

            <div class="task-text">
                ${escapeHTML(
                    player.task ||
                    "暂无任务"
                )}
            </div>

            <div class="hide-text">
                👁️ 点击隐藏
            </div>

        </div>
    `;

}


/*
 * ======================================================
 * 我的卡片
 * ======================================================
 */

function toggleMyCard(
    card
) {

    if (!myPrivateInfo) {

        socket.emit(
            "request_private_role"
        );


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
                        myPrivateInfo.name
                    )}
                </div>

                <div class="team-text">
                    ${
                        myPrivateInfo.team ===
                        "CT"
                            ? "🔵 CT"
                            : "🟠 T"
                    }
                </div>

                <div class="click-text">
                    👁️ 点击查看身份
                </div>

            </div>
        `;


        return;

    }


    card.classList.add(
        "revealed"
    );


    card.innerHTML = `
        <div class="card-visible">

            <div class="player-name">
                ${escapeHTML(
                    myPrivateInfo.name
                )}
            </div>

            <div class="team-text">
                ${
                    myPrivateInfo.team ===
                    "CT"
                        ? "🔵 CT"
                        : "🟠 T"
                }
            </div>

            <div class="role">
                ${getRoleText(
                    myPrivateInfo.role
                )}
            </div>

            <div class="task-title">
                🎯 任务
            </div>

            <div class="task-text">
                ${escapeHTML(
                    myPrivateInfo.task ||
                    "暂无任务"
                )}
            </div>

            <div class="hide-text">
                👁️ 点击隐藏
            </div>

        </div>
    `;

}


/*
 * ======================================================
 * 游戏控制按钮
 * ======================================================
 */

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
        "20px";


    /*
     * 游戏中
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
                currentGame.mode ===
                "UNDERCOVER"
                    ? "🗳️ 开始投票"
                    : "🏁 结束本局";


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
     * 投票中
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
            "🗳️ 两个阵营正在独立投票";


        text.style.margin =
            "10px";


        controls.appendChild(
            text
        );

    }


    /*
     * 结算
     */

    if (
        currentGame &&
        currentGame.state ===
            "REVEAL"
    ) {

        if (
            isCurrentHost()
        ) {

            const next =
                document.createElement(
                    "button"
                );


            next.type =
                "button";


            next.textContent =
                "🔄 开始下一局";


            next.onclick =
                () => {

                    nextRound();

                };


            controls.appendChild(
                next
            );

        } else {

            const wait =
                document.createElement(
                    "div"
                );


            wait.textContent =
                "等待房主开始下一局...";


            controls.appendChild(
                wait
            );

        }

    }


    /*
     * 退出
     */

    const leave =
        document.createElement(
            "button"
        );


    leave.type =
        "button";


    leave.textContent =
        "🚪 退出房间";


    leave.style.marginLeft =
        "10px";


    leave.onclick =
        () => {

            leaveRoom();

        };


    controls.appendChild(
        leave
    );


    container.appendChild(
        controls
    );

}


/*
 * ======================================================
 * 开始投票
 * ======================================================
 */

function finishGame() {

    if (!isCurrentHost()) {

        alert(
            "只有房主可以开始投票"
        );

        return;

    }


    if (!currentGame) {

        return;

    }


    if (
        !confirm(
            "确定结束当前游戏并开始 CT / T 独立投票吗？"
        )
    ) {

        return;

    }


    socket.emit(
        "finish_game"
    );

}


/*
 * ======================================================
 * 投票开始
 * ======================================================
 */

socket.on(
    "voting_started",
    data => {

        currentVoting =
            data;


        if (!currentGame) {

            currentGame = {};

        }


        currentGame.state =
            "VOTING";


        showVoting(
            data
        );

    }
);


/*
 * ======================================================
 * 显示当前阵营投票
 * ======================================================
 */

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


    const isCT =
        data.team ===
        "CT";


    const teamText =
        isCT
            ? "🔵 CT"
            : "🟠 T";


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
            ? `🔄 ${teamText} 平票重投`
            : `🗳️ ${teamText} 阵营投票`;


    container.appendChild(
        title
    );


    /*
     * 说明
     */

    const desc =
        document.createElement(
            "div"
        );


    desc.style.textAlign =
        "center";


    desc.style.marginBottom =
        "16px";


    desc.textContent =
        data.revote
            ? "只能投上一轮并列最高票的人。"
            : `你只能投 ${teamText} 阵营的玩家。`;


    container.appendChild(
        desc
    );


    /*
     * 进度
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
     * 投票资格
     */

    if (!data.canVote) {

        const warning =
            document.createElement(
                "div"
            );


        warning.style.textAlign =
            "center";


        warning.style.marginBottom =
            "16px";


        warning.textContent =
            data.hasVoted
                ? "✅ 你已经投过票了"
                : "🚫 你本轮没有投票资格";


        container.appendChild(
            warning
        );

    }


    /*
     * 卡片
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
            data.candidates.length,
            1
        )}, minmax(0, 1fr))`;


    row.style.gap =
        "16px";


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
                        ${teamText}
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
                                            🚫 无法投票
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


    addGameControlButtons();

}


/*
 * ======================================================
 * 投票
 * ======================================================
 */

function castVote(
    targetId
) {

    if (!currentVoting) {

        return;

    }


    if (
        !currentVoting.canVote ||
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


/*
 * ======================================================
 * 投票成功
 * ======================================================
 */

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


/*
 * ======================================================
 * 投票进度
 * ======================================================
 */

socket.on(
    "vote_progress",
    data => {

        if (
            !currentVoting ||
            currentVoting.team !==
                data.team
        ) {

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


/*
 * ======================================================
 * 平票
 * ======================================================
 */

socket.on(
    "vote_tie",
    data => {

        console.log(
            `${data.team} 平票`,
            data
        );

    }
);


/*
 * ======================================================
 * 这一阵营投完
 * ======================================================
 */

socket.on(
    "team_vote_finished_waiting",
    data => {

        currentVoting =
            {

                team:
                    data.team,

                finished:
                    true

            };


        currentGame =
            currentGame || {};


        currentGame.state =
            "VOTING";


        showTeamWaiting(
            data
        );

    }
);


/*
 * ======================================================
 * 阵营等待界面
 * ======================================================
 */

function showTeamWaiting(
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


    container.innerHTML =
        "";


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


    title.style.margin =
        "60px 0 20px";


    title.textContent =
        data.team ===
            "CT"
            ? "🔵 CT 投票已完成"
            : "🟠 T 投票已完成";


    container.appendChild(
        title
    );


    const text =
        document.createElement(
            "div"
        );


    text.style.textAlign =
        "center";


    text.style.fontSize =
        "18px";


    text.textContent =
        "⏳ 等待另一阵营完成投票...";


    container.appendChild(
        text
    );


    addGameControlButtons();

}


/*
 * ======================================================
 * 游戏结束
 * ======================================================
 */

socket.on(
    "game_finished",
    data => {

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


/*
 * ======================================================
 * 最终结果
 * ======================================================
 */

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
            data.voteResult
                ? "🏆 本局投票结算完成"
                : "🎭 本局身份揭晓";

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
     * ==================================================
     * 双阵营投票结果
     * ==================================================
     */

    if (
        data.voteResult
    ) {

        const resultTitle =
            document.createElement(
                "div"
            );


        resultTitle.style.textAlign =
            "center";


        resultTitle.style.fontSize =
            "26px";


        resultTitle.style.fontWeight =
            "bold";


        resultTitle.style.marginBottom =
            "22px";


        resultTitle.textContent =
            "🏆 本局投票结果";


        container.appendChild(
            resultTitle
        );


        ["CT", "T"].forEach(
            team => {

                const result =
                    data.voteResult[
                        team
                    ];


                if (!result) {

                    return;

                }


                const box =
                    document.createElement(
                        "div"
                    );


                box.style.width =
                    "100%";


                box.style.boxSizing =
                    "border-box";


                box.style.padding =
                    "16px";


                box.style.marginBottom =
                    "18px";


                box.style.border =
                    "1px solid rgba(128,128,128,.4)";


                box.style.borderRadius =
                    "12px";


                const teamTitle =
                    document.createElement(
                        "div"
                    );


                teamTitle.style.fontSize =
                    "21px";


                teamTitle.style.fontWeight =
                    "bold";


                teamTitle.style.marginBottom =
                    "8px";


                teamTitle.textContent =
                    team ===
                        "CT"
                        ? "🔵 CT 阵营"
                        : "🟠 T 阵营";


                box.appendChild(
                    teamTitle
                );


                const winner =
                    document.createElement(
                        "div"
                    );


                winner.style.fontSize =
                    "20px";


                winner.style.fontWeight =
                    "bold";


                winner.style.marginBottom =
                    "8px";


                winner.textContent =
                    result.winnerText;


                box.appendChild(
                    winner
                );


                const eliminated =
                    document.createElement(
                        "div"
                    );


                eliminated.innerHTML = `
                    被投出：
                    <strong>
                        ${escapeHTML(
                            result.eliminatedName
                        )}
                    </strong>
                   　
                    身份：
                    <strong>
                        ${getRoleText(
                            result.eliminatedRole
                        )}
                    </strong>
                `;


                box.appendChild(
                    eliminated
                );


                const countsTitle =
                    document.createElement(
                        "div"
                    );


                countsTitle.style.marginTop =
                    "12px";


                countsTitle.style.marginBottom =
                    "6px";


                countsTitle.textContent =
                    "🗳️ 得票：";


                box.appendChild(
                    countsTitle
                );


                const countEntries =
                    Object.entries(
                        result.counts ||
                        {}
                    ).sort(
                        (
                            [, a],
                            [, b]
                        ) =>
                            b - a
                    );


                countEntries.forEach(
                    (
                        [playerId, voteCount]
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
                            "7px 10px";


                        row.style.marginBottom =
                            "4px";


                        row.style.border =
                            "1px solid rgba(128,128,128,.2)";


                        row.style.borderRadius =
                            "6px";


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


                        box.appendChild(
                            row
                        );

                    }
                );


                container.appendChild(
                    box
                );

            }
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
        "22px";


    revealTitle.style.fontWeight =
        "bold";


    revealTitle.style.margin =
        "25px 0 14px";


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


    function createFinalTeam(
        players,
        team
    ) {

        const section =
            document.createElement(
                "div"
            );


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
        ctPlayers.length
    ) {

        container.appendChild(
            createFinalTeam(
                ctPlayers,
                "CT"
            )
        );

    }


    if (
        tPlayers.length
    ) {

        container.appendChild(
            createFinalTeam(
                tPlayers,
                "T"
            )
        );

    }


    addGameControlButtons();

}


/*
 * ======================================================
 * 下一局
 * ======================================================
 */

function nextRound() {

    if (!isCurrentHost()) {

        alert(
            "只有房主可以开始下一局"
        );

        return;

    }


    socket.emit(
        "next_round"
    );

}


/*
 * ======================================================
 * 房间关闭
 * ======================================================
 */

socket.on(
    "room_closed",
    data => {

        clearLoginInfo();

        clearLastRoom();

        returnToLobby();


        alert(
            data &&
            data.message
                ? data.message
                : "房间已经关闭"
        );

    }
);


/*
 * ======================================================
 * 主动退出
 * ======================================================
 */

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
     * 普通玩家：
     * 保存最后房间。
     *
     * 房主：
     * 房间直接关闭，不保存。
     */

    if (
        roomData &&
        roomData.hostId ===
            myId
    ) {

        clearLastRoom();

    } else {

        saveLastRoom();

    }


    leavingRoom =
        true;


    socket.emit(
        "leave_room"
    );


    clearLoginInfo();

    returnToLobby();

}


/*
 * ======================================================
 * 返回大厅
 * ======================================================
 */

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


    const roomCode =
        document.getElementById(
            "roomCode"
        );


    if (roomCode) {

        roomCode.textContent =
            "------";

    }


    const roomMode =
        document.getElementById(
            "roomMode"
        );


    if (roomMode) {

        roomMode.textContent =
            "------";

    }


    const playerList =
        document.getElementById(
            "playerList"
        );


    if (playerList) {

        playerList.innerHTML =
            "";

    }


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


/*
 * ======================================================
 * 页面加载
 * ======================================================
 */

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