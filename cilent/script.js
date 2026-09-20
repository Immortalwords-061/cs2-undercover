// ======================================================
// CS2 Undercover
// 前端完整稳定最终版
// ======================================================


// ======================================================
// Socket.IO
// ======================================================

const socket =
    io(
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
// 判断当前玩家是不是房主
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
// Socket 连接成功
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
         * 主动退出以后不要自动重连
         */

        if (leavingRoom) {

            return;

        }


        /*
         * 有房间记录就自动恢复
         */

        if (
            myRoomCode &&
            myPlayerName &&
            !reconnecting
        ) {

            reconnectToGame();

        }


        /*
         * 确保单人测试按钮存在
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
        "正在恢复房间:",
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

        console.log(
            "自动重连成功:",
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
         * 等待中
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
// 自动重连失败
// ======================================================

socket.on(
    "rejoin_failed",
    message => {

        console.log(
            "自动重连失败:",
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


    /*
     * 没输入名字就使用测试玩家
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
        "创建测试房间:",
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
// 添加单人测试按钮
// ======================================================

function ensureTestButtons() {

    const lobbyElement =
        document.getElementById(
            "lobby"
        );


    if (!lobbyElement) {

        return;

    }


    /*
     * 已经存在就不要重复添加
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
        "2px dashed #888";


    panel.style.borderRadius =
        "12px";


    panel.style.textAlign =
        "center";


    panel.style.display =
        "block";


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


    /*
     * 内鬼测试
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


    undercoverButton.addEventListener(
        "click",
        () => {

            createTestRoom(
                "UNDERCOVER"
            );

        }
    );


    panel.appendChild(
        undercoverButton
    );


    /*
     * 分组测试
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


    teamButton.addEventListener(
        "click",
        () => {

            createTestRoom(
                "TEAM"
            );

        }
    );


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
            "加入房间成功:",
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
// 房间实时更新
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
     * 模式
     */

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
     * 开始游戏按钮
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


        /*
         * 单人测试模式：
         * 服务器把全部玩家数据直接发过来。
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
                data.isTestRoom ===
                true
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


    /*
     * ==================================================
     * 关键修复
     *
     * 让 players 容器本身不要再使用原来的
     * 两列 grid。
     *
     * CT 和 T 各自占满整个宽度。
     * ==================================================
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
     * 创建一个阵营区域
     * ==================================================
     */

    function createTeamRow(
        players,
        teamName
    ) {

        const section =
            document.createElement(
                "div"
            );


        section.className =
            "team-section";


        /*
         * 这一块必须完整占满宽度
         */

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


        section.style.marginBottom =
            "28px";


        /*
         * 阵营标题
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
            teamName ===
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


        row.style.width =
            "100%";


        row.style.gridTemplateColumns =
            `repeat(${Math.max(
                players.length,
                1
            )}, minmax(0, 1fr))`;


        row.style.gap =
            "16px";


        row.style.alignItems =
            "stretch";


        row.style.boxSizing =
            "border-box";


        /*
         * 创建玩家卡片
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
                 * 自己和 Bot 都可以点击
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
                 * 普通分组模式
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
                 * 只有自己的卡片可以点击
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
     * ==================================================
     * CT 第一排
     * ==================================================
     */

    if (
        ctPlayers.length > 0
    ) {

        container.appendChild(
            createTeamRow(
                ctPlayers,
                "CT"
            )
        );

    }


    /*
     * ==================================================
     * T 第二排
     * ==================================================
     */

    if (
        tPlayers.length > 0
    ) {

        container.appendChild(
            createTeamRow(
                tPlayers,
                "T"
            )
        );

    }


    /*
     * 游戏控制按钮
     */

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
     * 已经打开
     * 再次点击关闭
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
     * 打开卡片
     */

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


    /*
     * 和游戏页面一样，
     * 强制让整个 players 区域只使用一列。
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
     * 创建最终结果一排
     */

    function createFinalRow(
        players,
        teamName
    ) {

        const section =
            document.createElement(
                "div"
            );


        section.style.display =
            "block";


        section.style.width =
            "100%";


        section.style.maxWidth =
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
            teamName ===
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
            createFinalRow(
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
            createFinalRow(
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


    /*
     * 通知服务器
     *
     * 不等待 callback
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
     * 清除本地信息
     */

    clearLoginInfo();


    /*
     * 立即回主界面
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
     * 清除房间信息显示
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
     * 清空房间输入
     */

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


    /*
     * 隐藏加入房间区域
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
     * 恢复退出状态
     */

    setTimeout(
        () => {

            leavingRoom =
                false;

        },
        100
    );


    /*
     * 确保测试按钮存在
     */

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