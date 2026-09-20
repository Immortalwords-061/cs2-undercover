const socket = io("https://cs2-undercover.onrender.com");

let myId = null;

let myRoomCode =
    localStorage.getItem("cs2_room_code");

let myPlayerName =
    localStorage.getItem("cs2_player_name");

let isHost = false;

let roomData = null;
let myPrivateInfo = null;
let currentGame = null;


// =========================
// 自动重连状态
// =========================

let reconnecting = false;


// =========================
// 服务器连接
// =========================

socket.on("connect", () => {

    myId = socket.id;

    console.log(
        "已连接服务器:",
        myId
    );


    // =========================
    // 如果本地有房间信息
    // 自动尝试恢复房间
    // =========================

    if (
        myRoomCode &&
        myPlayerName &&
        !reconnecting
    ) {

        reconnectToGame();

    }

});


// =========================
// Socket 断开
// =========================

socket.on(
    "disconnect",
    reason => {

        console.log(
            "Socket 连接断开:",
            reason
        );

    }
);


// =========================
// 自动重连游戏
// =========================

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
        "正在恢复游戏..."
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
                    "恢复游戏失败:",
                    result
                );


                // 玩家已经被服务器移除
                // 清除本地房间记录

                if (
                    result &&
                    result.message ===
                        "玩家已经不在房间里"
                ) {

                    localStorage.removeItem(
                        "cs2_room_code"
                    );

                    myRoomCode =
                        null;

                }


                return;
            }


            console.log(
                "恢复游戏成功:",
                result.room
            );


            roomData =
                result.room;


            isHost =
                roomData.hostId ===
                myId;


            // =========================
            // 根据服务器状态
            // 恢复正确页面
            // =========================

            if (
                roomData.state ===
                "WAITING"
            ) {

                showRoom();

                return;

            }


            if (
                roomData.state ===
                "PLAYING"
            ) {

                // 服务器会另外发送
                // game_started
                // 这里先保持当前页面

                return;

            }


            if (
                roomData.state ===
                "REVEAL"
            ) {

                // 服务器会另外发送
                // game_finished

                return;

            }

        }
    );

}


// =========================
// 创建房间
// =========================

function createRoom(mode) {

    const name =
        document
            .getElementById("nameInput")
            .value
            .trim();


    if (!name) {

        alert("请输入你的昵称");

        return;
    }


    myPlayerName =
        name;


    localStorage.setItem(
        "cs2_player_name",
        name
    );


    socket.emit(
        "create_room",
        {
            name: name,
            mode: mode
        },
        result => {

            if (!result.success) {

                alert(
                    result.message
                );

                return;
            }


            myRoomCode =
                result.roomCode;


            localStorage.setItem(
                "cs2_room_code",
                result.roomCode
            );


            isHost = true;


            roomData =
                result.room;


            showRoom();

        }
    );

}


// =========================
// 显示加入房间
// =========================

function showJoinRoom() {

    document
        .getElementById("joinPanel")
        .style.display =
        "block";

}


// =========================
// 加入房间
// =========================

function joinRoom() {

    const name =
        document
            .getElementById("nameInput")
            .value
            .trim();


    const code =
        document
            .getElementById("roomCodeInput")
            .value
            .trim();


    if (!name) {

        alert("请输入你的昵称");

        return;
    }


    if (!code) {

        alert("请输入房间号");

        return;
    }


    myPlayerName =
        name;


    localStorage.setItem(
        "cs2_player_name",
        name
    );


    socket.emit(
        "join_room",
        {
            code: code,
            name: name
        },
        result => {

            if (!result.success) {

                alert(
                    result.message
                );

                return;
            }


            myRoomCode =
                result.roomCode;


            localStorage.setItem(
                "cs2_room_code",
                result.roomCode
            );


            isHost = false;


            roomData =
                result.room;


            showRoom();

        }
    );

}


// =========================
// 显示大厅
// =========================

function showRoom() {

    document
        .getElementById("lobby")
        .style.display =
        "none";


    document
        .getElementById("room")
        .style.display =
        "block";


    document
        .getElementById("game")
        .style.display =
        "none";


    updateRoomUI();

}


// =========================
// 房间实时更新
// =========================

socket.on(
    "room_update",
    room => {

        roomData =
            room;


        isHost =
            room.hostId ===
            myId;


        updateRoomUI();

    }
);


// =========================
// 更新大厅
// =========================

function updateRoomUI() {

    if (!roomData) {

        return;

    }


    document
        .getElementById("roomCode")
        .textContent =
        roomData.code;


    document
        .getElementById("playerCount")
        .textContent =
        roomData.playerCount;


    document
        .getElementById("maxPlayerCount")
        .textContent =
        roomData.maxPlayers;


    const modeText =
        roomData.mode === "TEAM"
            ? "⚔️ 8人分组模式"
            : "🎭 10人内鬼模式";


    document
        .getElementById("roomMode")
        .textContent =
        modeText;


    const list =
        document
            .getElementById(
                "playerList"
            );


    list.innerHTML = "";


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


            list.appendChild(
                div
            );

        }
    );


    const startButton =
        document.getElementById(
            "startButton"
        );


    if (
        roomData.hostId === myId &&
        roomData.playerCount ===
            roomData.maxPlayers
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
            "⚔️ 开始8人分组游戏";

    } else {

        startButton.textContent =
            "🚀 开始10人内鬼游戏";

    }

}


// =========================
// 开始游戏
// =========================

function startGame() {

    if (!isHost) {

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


// =========================
// 游戏开始
// =========================

socket.on(
    "game_started",
    game => {

        console.log(
            "第",
            game.round,
            "局开始",
            "模式:",
            game.mode
        );


        currentGame =
            game;


        myPrivateInfo =
            null;


        showGame(game);

    }
);


// =========================
// 收到自己的秘密身份
// =========================

socket.on(
    "private_role",
    info => {

        console.log(
            "我的秘密身份:",
            info
        );


        myPrivateInfo =
            info;


        updateMyCard();

    }
);


// =========================
// 显示游戏
// =========================

function showGame(game) {

    document
        .getElementById("lobby")
        .style.display =
        "none";


    document
        .getElementById("room")
        .style.display =
        "none";


    document
        .getElementById("game")
        .style.display =
        "block";


    document
        .getElementById("roundNumber")
        .textContent =
        game.round;


    const container =
        document.getElementById(
            "players"
        );


    container.innerHTML = "";


    // =========================
    // 顶部提示
    // =========================

    const notice =
        document.createElement(
            "div"
        );


    notice.className =
        "game-notice";


    notice.style.gridColumn =
        "1 / -1";


    if (
        game.mode ===
        "TEAM"
    ) {

        notice.innerHTML = `

            <div>
                ⚔️ 第 ${game.round} 局分组游戏
            </div>

            <div>
                4 CT vs 4 T
            </div>

        `;

    } else {

        notice.innerHTML = `

            <div>
                🎭 第 ${game.round} 局内鬼游戏
            </div>

            <div>
                点击自己的卡片查看身份和任务
            </div>

        `;

    }


    container.appendChild(
        notice
    );


    // =========================
    // 玩家卡片
    // =========================

    game.players.forEach(
        player => {

            const card =
                document.createElement(
                    "div"
                );


            card.className =
                "player-card";


            card.dataset.playerId =
                player.id;


            // =========================
            // 8人分组模式
            // =========================

            if (
                game.mode ===
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
                            阵营：
                            ${
                                player.team ===
                                "CT"
                                    ? "🟦 CT"
                                    : "🟨 T"
                            }
                        </div>

                    </div>

                `;


                container.appendChild(
                    card
                );


                return;

            }


            // =========================
            // 10人内鬼模式
            // =========================

            card.innerHTML = `

                <div class="card-hidden">

                    <div class="player-name">
                        ${escapeHTML(
                            player.name
                        )}
                    </div>

                    ${
                        player.id === myId
                            ? `
                                <div class="lock-icon">
                                    🔒
                                </div>

                                <div class="click-text">
                                    点击查看我的身份
                                </div>
                            `
                            : `
                                <div class="lock-icon">
                                    👤
                                </div>

                                <div class="click-text">
                                    其他玩家
                                </div>
                            `
                    }

                </div>

            `;


            if (
                player.id === myId
            ) {

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


    // =========================
    // 房主结束按钮
    // =========================

    if (isHost) {

        const finishButton =
            document.createElement(
                "button"
            );


        finishButton.textContent =
            "🏁 结束本局";


        finishButton.onclick =
            finishGame;


        finishButton.style.gridColumn =
            "1 / -1";


        finishButton.style.margin =
            "20px auto";


        container.appendChild(
            finishButton
        );

    }

}


// =========================
// 更新自己的卡
// =========================

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


// =========================
// 点击自己的卡
// =========================

function toggleMyCard(card) {

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

        hideMyCard(card);

    } else {

        revealMyCard(card);

    }

}


// =========================
// 显示自己的身份
// =========================

function revealMyCard(card) {

    const info =
        myPrivateInfo;


    card.classList.add(
        "revealed"
    );


    const roleText =
        info.role === "SPY"
            ? "🕵️ 内鬼"
            : "🛡️ 好人";


    const roleClass =
        info.role === "SPY"
            ? "spy"
            : "good";


    card.innerHTML = `

        <div class="card-visible">

            <div class="player-name">
                ${escapeHTML(
                    info.name
                )}
            </div>

            <div class="role ${roleClass}">
                ${roleText}
            </div>

            <div class="team-text">
                阵营：${info.team}
            </div>

            <div class="task-title">
                🎯 你的任务
            </div>

            <div class="task-text">
                ${escapeHTML(
                    info.task
                )}
            </div>

            <div class="hide-text">
                👁️ 点击隐藏
            </div>

        </div>

    `;

}


// =========================
// 隐藏自己的身份
// =========================

function hideMyCard(card) {

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
                点击查看我的身份
            </div>

        </div>

    `;

}


// =========================
// 房主结束本局
// =========================

function finishGame() {

    if (!isHost) {

        alert(
            "当前浏览器不是房主"
        );

        return;

    }


    if (!socket.connected) {

        alert(
            "服务器连接已经断开，请稍等后再试"
        );

        return;

    }


    const confirmEnd =
        confirm(
            "确定要结束本局吗？"
        );


    if (!confirmEnd) {

        return;

    }


    console.log(
        "发送结束游戏请求:",
        socket.id
    );


    socket.emit(
        "finish_game"
    );

}


// =========================
// 收到游戏结束
// =========================

socket.on(
    "game_finished",
    game => {

        console.log(
            "游戏结束:",
            game
        );


        currentGame =
            game;


        showFinalResult(
            game
        );

    }
);


// =========================
// 显示最终结果
// =========================

function showFinalResult(game) {

    document
        .getElementById("lobby")
        .style.display =
        "none";


    document
        .getElementById("room")
        .style.display =
        "none";


    document
        .getElementById("game")
        .style.display =
        "block";


    document
        .getElementById("roundNumber")
        .textContent =
        game.round;


    const container =
        document.getElementById(
            "players"
        );


    container.innerHTML = "";


    const title =
        document.createElement(
            "div"
        );


    title.className =
        "final-title";


    title.style.gridColumn =
        "1 / -1";


    if (
        game.mode ===
        "TEAM"
    ) {

        title.innerHTML = `
            ⚔️ 第 ${game.round} 局分组结果
        `;

    } else {

        title.innerHTML = `
            🎭 第 ${game.round} 局身份揭晓
        `;

    }


    container.appendChild(
        title
    );


    game.players.forEach(
        player => {

            const card =
                document.createElement(
                    "div"
                );


            card.className =
                "final-player";


            if (
                game.mode ===
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
                                ? "🟦 CT"
                                : "🟨 T"
                        }
                    </span>

                `;


                container.appendChild(
                    card
                );


                return;

            }


            const roleText =
                player.role === "SPY"
                    ? "🕵️ 内鬼"
                    : "🛡️ 好人";


            card.innerHTML = `

                <strong>
                    ${escapeHTML(
                        player.name
                    )}
                </strong>

                <span>
                    ${player.team}
                </span>

                <span>
                    ${roleText}
                </span>

                <div class="final-task">
                    🎯 ${escapeHTML(
                        player.task || ""
                    )}
                </div>

            `;


            container.appendChild(
                card
            );

        }
    );


    if (isHost) {

        const nextButton =
            document.createElement(
                "button"
            );


        nextButton.textContent =
            "🔄 下一局";


        nextButton.onclick =
            nextRound;


        nextButton.style.gridColumn =
            "1 / -1";


        nextButton.style.margin =
            "20px auto";


        container.appendChild(
            nextButton
        );

    } else {

        const waiting =
            document.createElement(
                "div"
            );


        waiting.className =
            "waiting-text";


        waiting.style.gridColumn =
            "1 / -1";


        waiting.textContent =
            "等待房主开始下一局...";


        container.appendChild(
            waiting
        );

    }

}


// =========================
// 下一局
// =========================

function nextRound() {

    console.log(
        "点击了下一局"
    );


    console.log(
        "当前房间:",
        myRoomCode
    );


    console.log(
        "当前是否房主:",
        isHost
    );


    console.log(
        "当前 socket:",
        socket.connected
    );


    if (!isHost) {

        alert(
            "只有房主可以开始下一局"
        );

        return;

    }


    if (!socket.connected) {

        alert(
            "服务器连接已经断开，请刷新网页"
        );

        return;

    }


    socket.emit(
        "next_round",
        result => {

            console.log(
                "服务器返回:",
                result
            );


            if (!result) {

                return;

            }


            if (!result.success) {

                alert(
                    result.message ||
                    "下一局启动失败"
                );

            }

        }
    );

}


// =========================
// 错误
// =========================

socket.on(
    "error_message",
    message => {

        alert(message);

    }
);


// =========================
// HTML 防注入
// =========================

function escapeHTML(text) {

    const div =
        document.createElement(
            "div"
        );


    div.textContent =
        text;


    return div.innerHTML;

}