const socket = io(
    "https://cs2-undercover.onrender.com"
);


/* =========================
   页面元素
   ========================= */

const lobby =
    document.getElementById("lobby");

const room =
    document.getElementById("room");

const game =
    document.getElementById("game");

const nameInput =
    document.getElementById("nameInput");

const roomCodeInput =
    document.getElementById("roomCodeInput");

const playerCountSelect =
    document.getElementById(
        "playerCountSelect"
    );

const joinPanel =
    document.getElementById("joinPanel");

const roomCodeElement =
    document.getElementById("roomCode");

const roomModeElement =
    document.getElementById("roomMode");

const playerCountElement =
    document.getElementById("playerCount");

const maxPlayerCountElement =
    document.getElementById(
        "maxPlayerCount"
    );

const playerListElement =
    document.getElementById("playerList");

const startButton =
    document.getElementById(
        "startButton"
    );

const playersElement =
    document.getElementById("players");

const roundNumberElement =
    document.getElementById(
        "roundNumber"
    );

const gameNoticeElement =
    document.getElementById(
        "gameNotice"
    );


/* =========================
   当前玩家数据
   ========================= */

let currentRoom = null;

let currentGame = null;

let privateInfo = null;


/* =========================
   本地保存
   ========================= */

function saveLoginInfo() {
    if (
        !currentRoom ||
        !nameInput
    ) {
        return;
    }

    localStorage.setItem(
        "cs2_undercover_room",
        currentRoom.code
    );

    localStorage.setItem(
        "cs2_undercover_name",
        nameInput.value.trim()
    );
}


function clearLoginInfo() {
    localStorage.removeItem(
        "cs2_undercover_room"
    );

    localStorage.removeItem(
        "cs2_undercover_name"
    );
}


/* =========================
   页面切换
   ========================= */

function showLobby() {
    lobby.style.display = "block";
    room.style.display = "none";
    game.style.display = "none";
}


function showRoom() {
    lobby.style.display = "none";
    room.style.display = "block";
    game.style.display = "none";
}


function showGame() {
    lobby.style.display = "none";
    room.style.display = "none";
    game.style.display = "block";
}


/* =========================
   显示加入房间
   ========================= */

function showJoinRoom() {
    joinPanel.style.display =
        "block";

    roomCodeInput.focus();
}


/* =========================
   创建房间
   ========================= */

function createRoom(mode) {
    const name =
        nameInput.value.trim();

    if (!name) {
        alert("请输入昵称");
        nameInput.focus();
        return;
    }

    const maxPlayers =
        Number(
            playerCountSelect.value
        );

    if (
        !Number.isInteger(maxPlayers) ||
        maxPlayers < 6 ||
        maxPlayers > 16
    ) {
        alert(
            "请选择6到16人的游戏人数"
        );
        return;
    }

    socket.emit(
        "create_room",
        {
            name,
            mode,
            maxPlayers
        }
    );
}


/* =========================
   加入房间
   ========================= */

function joinRoom() {
    const name =
        nameInput.value.trim();

    const roomCode =
        roomCodeInput.value.trim();

    if (!name) {
        alert("请输入昵称");
        nameInput.focus();
        return;
    }

    if (!roomCode) {
        alert("请输入房间号");
        roomCodeInput.focus();
        return;
    }

    if (!/^\d{6}$/.test(roomCode)) {
        alert("房间号必须是6位数字");
        roomCodeInput.focus();
        return;
    }

    socket.emit(
        "join_room",
        {
            roomCode,
            name
        }
    );
}


/* =========================
   开始游戏
   ========================= */

function startGame() {
    socket.emit(
        "start_game"
    );
}


/* =========================
   结束游戏
   ========================= */

function finishGame() {
    socket.emit(
        "finish_game"
    );
}


/* =========================
   下一局
   ========================= */

function nextRound() {
    socket.emit(
        "next_round"
    );
}


/* =========================
   更新房间界面
   ========================= */

function updateRoom(roomData) {
    currentRoom =
        roomData;

    roomCodeElement.textContent =
        roomData.code;

    if (
        roomData.mode ===
        "UNDERCOVER"
    ) {
        roomModeElement.textContent =
            "🎭 内鬼模式";
    } else {
        roomModeElement.textContent =
            "⚔️ 分组模式";
    }

    playerCountElement.textContent =
        roomData.playerCount;

    maxPlayerCountElement.textContent =
        roomData.maxPlayers;

    playerListElement.innerHTML =
        "";

    roomData.players.forEach(
        player => {
            const playerDiv =
                document.createElement(
                    "div"
                );

            playerDiv.className =
                "player";

            if (
                player.id ===
                roomData.hostId
            ) {
                playerDiv.textContent =
                    `👑 ${player.name}`;
            } else {
                playerDiv.textContent =
                    player.name;
            }

            playerListElement.appendChild(
                playerDiv
            );
        }
    );

    /*
     * 只有房主看到开始按钮
     */
    if (
        socket.id ===
        roomData.hostId
    ) {
        startButton.style.display =
            "block";

        /*
         * 人数没满之前不能开始
         */
        if (
            roomData.playerCount ===
            roomData.maxPlayers
        ) {
            startButton.disabled =
                false;

            startButton.textContent =
                "🚀 开始游戏";
        } else {
            startButton.disabled =
                true;

            startButton.textContent =
                `等待玩家 (${roomData.playerCount}/${roomData.maxPlayers})`;
        }
    } else {
        startButton.style.display =
            "none";
    }

    saveLoginInfo();
}


/* =========================
   创建房间成功
   ========================= */

socket.on(
    "room_created",
    roomData => {
        console.log(
            "房间创建成功:",
            roomData
        );

        updateRoom(
            roomData
        );

        showRoom();

        saveLoginInfo();
    }
);


/* =========================
   加入房间成功
   ========================= */

socket.on(
    "join_success",
    roomData => {
        console.log(
            "加入房间成功:",
            roomData
        );

        updateRoom(
            roomData
        );

        showRoom();

        saveLoginInfo();
    }
);


/* =========================
   自动重连成功
   ========================= */

socket.on(
    "rejoin_success",
    roomData => {
        console.log(
            "自动重连成功:",
            roomData
        );

        updateRoom(
            roomData
        );

        showRoom();

        saveLoginInfo();
    }
);


/* =========================
   房间更新
   ========================= */

socket.on(
    "room_update",
    roomData => {
        console.log(
            "房间更新:",
            roomData
        );

        updateRoom(
            roomData
        );
    }
);


/* =========================
   游戏开始
   ========================= */

socket.on(
    "game_started",
    gameData => {
        console.log(
            "游戏开始:",
            gameData
        );

        currentGame =
            gameData;

        privateInfo = null;

        showGame();

        renderGame(
            gameData
        );

        /*
         * 游戏开始后，
         * 房主显示“结束游戏”按钮
         */
        addGameControlButtons();
    }
);

/* =========================
   私人身份信息
   ========================= */

socket.on(
    "private_role",
    info => {
        console.log(
            "收到私人信息:",
            info
        );

        privateInfo =
            info;

        /*
         * 收到私人身份后
         * 重新渲染玩家列表
         */
        if (currentGame) {
            renderGame(
                currentGame
            );
        }
    }
);


/* =========================
   游戏结束
   ========================= */

socket.on(
    "game_finished",
    gameData => {
        console.log(
            "游戏结束:",
            gameData
        );

        currentGame =
            gameData;

        privateInfo = null;

        showGame();

        renderGame(
            gameData
        );

        addGameControlButtons();
    }
);


/* =========================
   渲染游戏
   ========================= */

function renderGame(gameData) {
    if (!gameData) {
        return;
    }

    roundNumberElement.textContent =
        gameData.round;

    playersElement.innerHTML =
        "";

    /*
     * 当前游戏模式
     */
    if (
        gameData.mode ===
        "TEAM"
    ) {
        gameNoticeElement.textContent =
            "⚔️ 分组模式：没有内鬼，也没有任务";
    } else {
        gameNoticeElement.textContent =
            "🎭 内鬼模式：点击自己的名字查看身份和任务";
    }

    gameData.players.forEach(
        player => {
            const playerCard =
                document.createElement(
                    "div"
                );

            playerCard.className =
                "player-card";

            /*
             * 玩家名字
             */
            const nameElement =
                document.createElement(
                    "h3"
                );

            nameElement.textContent =
                player.name;

            playerCard.appendChild(
                nameElement
            );

            /*
             * 队伍
             */
            const teamElement =
                document.createElement(
                    "p"
                );

            if (
                player.team ===
                "CT"
            ) {
                teamElement.textContent =
                    "🔵 CT";
            } else {
                teamElement.textContent =
                    "🟠 T";
            }

            playerCard.appendChild(
                teamElement
            );

            /*
             * 判断是不是自己
             */
            const isMe =
                privateInfo &&
                privateInfo.name ===
                    player.name;

            /*
             * 自己的卡片
             */
            if (isMe) {
                playerCard.classList.add(
                    "my-card"
                );

                playerCard.style.cursor =
                    "pointer";

                playerCard.addEventListener(
                    "click",
                    () => {
                        toggleMyInfo(
                            playerCard
                        );
                    }
                );

                /*
                 * 默认隐藏私人信息
                 */
                const hint =
                    document.createElement(
                        "p"
                    );

                hint.className =
                    "private-hint";

                hint.textContent =
                    "👁️ 点击查看身份";

                playerCard.appendChild(
                    hint
                );
            }

            playersElement.appendChild(
                playerCard
            );
        }
    );

    /*
     * 根据游戏状态添加按钮
     */
    if (
    gameData.state ===
    "REVEAL"
) {
    addGameControlButtons();
}


/* =========================
   显示自己的身份
   ========================= */

function toggleMyInfo(card) {
    if (!privateInfo) {
        return;
    }

    /*
     * 如果已经显示，
     * 再点击就隐藏
     */
    const oldInfo =
        card.querySelector(
            ".private-info"
        );

    if (oldInfo) {
        oldInfo.remove();

        const hint =
            document.createElement(
                "p"
            );

        hint.className =
            "private-hint";

        hint.textContent =
            "👁️ 点击查看身份";

        card.appendChild(
            hint
        );

        return;
    }

    /*
     * 删除提示
     */
    const hint =
        card.querySelector(
            ".private-hint"
        );

    if (hint) {
        hint.remove();
    }

    const info =
        document.createElement(
            "div"
        );

    info.className =
        "private-info";

    /*
     * 队伍
     */
    const teamText =
        privateInfo.team ===
        "CT"
            ? "🔵 CT"
            : "🟠 T";

    const team =
        document.createElement(
            "p"
        );

    team.innerHTML =
        `<strong>队伍：</strong>${teamText}`;

    info.appendChild(
        team
    );

    /*
     * 组队模式
     */
    if (
        privateInfo.role ===
            null ||
        privateInfo.role ===
            undefined
    ) {
        const modeText =
            document.createElement(
                "p"
            );

        modeText.innerHTML =
            "<strong>模式：</strong>⚔️ 分组模式";

        info.appendChild(
            modeText
        );

        card.appendChild(
            info
        );

        return;
    }

    /*
     * 内鬼 / 好人
     */
    const role =
        document.createElement(
            "p"
        );

    if (
        privateInfo.role ===
        "SPY"
    ) {
        role.innerHTML =
            "<strong>身份：</strong>🔴 内鬼";
    } else {
        role.innerHTML =
            "<strong>身份：</strong>🟢 好人";
    }

    info.appendChild(
        role
    );

    /*
     * 任务
     */
    if (privateInfo.task) {
        const task =
            document.createElement(
                "p"
            );

        task.innerHTML =
            `<strong>任务：</strong>${privateInfo.task}`;

        info.appendChild(
            task
        );
    }

    card.appendChild(
        info
    );
}


/* =========================
   游戏结束按钮
   ========================= */

function addGameControlButtons() {
    /*
     * 避免重复创建按钮
     */
    const oldContainer =
        document.getElementById(
            "gameControlButtons"
        );

    if (oldContainer) {
        oldContainer.remove();
    }

    const container =
        document.createElement(
            "div"
        );

    container.id =
        "gameControlButtons";

    container.style.marginTop =
        "20px";


    /*
     * =========================
     * 游戏进行中
     * =========================
     */

    if (
        currentGame &&
        currentGame.state ===
            "PLAYING"
    ) {
        /*
         * 只有房主可以结束游戏
         */
        if (
            currentRoom &&
            socket.id ===
                currentRoom.hostId
        ) {
            const finishButton =
                document.createElement(
                    "button"
                );

            finishButton.textContent =
                "🏁 结束游戏";

            finishButton.onclick =
                () => {
                    if (
                        confirm(
                            "确定要结束这一局并公布所有人的身份吗？"
                        )
                    ) {
                        finishGame();
                    }
                };

            container.appendChild(
                finishButton
            );
        }
    }


    /*
     * =========================
     * 游戏结束
     * =========================
     */

    if (
        currentGame &&
        currentGame.state ===
            "REVEAL"
    ) {
        /*
         * 只有房主可以开始下一局
         */
        if (
            currentRoom &&
            socket.id ===
                currentRoom.hostId
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

            container.appendChild(
                nextButton
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
            clearLoginInfo();

            location.reload();
        };

    container.appendChild(
        backButton
    );


    /*
     * 添加到游戏面板
     */
    const panel =
        game.querySelector(
            ".panel"
        );

    if (panel) {
        panel.appendChild(
            container
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
            location.reload();
        };

    container.appendChild(
        backButton
    );

    game.querySelector(
        ".panel"
    ).appendChild(
        container
    );
}


/* =========================
   错误信息
   ========================= */

socket.on(
    "error_message",
    message => {
        alert(message);
    }
);


/* =========================
   自动重连失败
   ========================= */

socket.on(
    "rejoin_failed",
    message => {
        console.log(
            "自动重连失败:",
            message
        );

        /*
         * 清除旧房间信息，
         * 回到首页
         */
        clearLoginInfo();

        showLobby();
    }
);


/* =========================
   Socket 连接成功
   ========================= */

socket.on(
    "connect",
    () => {
        console.log(
            "Socket连接成功:",
            socket.id
        );

        /*
         * 尝试自动恢复上一次房间
         */
        const savedRoom =
            localStorage.getItem(
                "cs2_undercover_room"
            );

        const savedName =
            localStorage.getItem(
                "cs2_undercover_name"
            );

        if (
            savedRoom &&
            savedName
        ) {
            console.log(
                "尝试自动重连:",
                savedRoom,
                savedName
            );

            socket.emit(
                "rejoin_room",
                {
                    roomCode:
                        savedRoom,

                    name:
                        savedName
                }
            );
        }
    }
);


/* =========================
   Socket 断开
   ========================= */

socket.on(
    "disconnect",
    () => {
        console.log(
            "Socket连接断开"
        );
    }
);


/* =========================
   页面初始化
   ========================= */

showLobby();