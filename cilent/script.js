const socket = io("http://localhost:3000");

let myId = null;
let myRoomCode = null;
let isHost = false;

let roomData = null;
let myPrivateInfo = null;

let currentGame = null;


// =========================
// 服务器连接
// =========================

socket.on("connect", () => {

    myId = socket.id;

    console.log(
        "已连接服务器:",
        myId
    );

});


// =========================
// 创建房间
// =========================

function createRoom() {

    const name =
        document
            .getElementById("nameInput")
            .value
            .trim();

    if (!name) {

        alert("请输入你的昵称");

        return;
    }


    socket.emit(
        "create_room",
        {
            name: name
        },
        result => {

            if (!result.success) {

                alert(result.message);

                return;
            }


            myRoomCode =
                result.roomCode;

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
        .style.display = "block";

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


    socket.emit(
        "join_room",
        {
            code: code,
            name: name
        },
        result => {

            if (!result.success) {

                alert(result.message);

                return;
            }


            myRoomCode =
                result.roomCode;

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
        .style.display = "none";

    document
        .getElementById("room")
        .style.display = "block";

    document
        .getElementById("game")
        .style.display = "none";


    updateRoomUI();

}


// =========================
// 房间实时更新
// =========================

socket.on(
    "room_update",
    room => {

        roomData = room;

        updateRoomUI();

    }
);


// =========================
// 更新大厅
// =========================

function updateRoomUI() {

    if (!roomData) return;


    document
        .getElementById("roomCode")
        .textContent =
        roomData.code;


    document
        .getElementById("playerCount")
        .textContent =
        roomData.playerCount;


    const list =
        document
            .getElementById("playerList");


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


            list.appendChild(div);

        }
    );


    const startButton =
        document
            .getElementById(
                "startButton"
            );


    if (
        roomData.hostId === myId &&
        roomData.playerCount === 10
    ) {

        startButton.style.display =
            "block";

    } else {

        startButton.style.display =
            "none";

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


    if (
        !roomData ||
        roomData.playerCount !== 10
    ) {

        alert(
            "必须正好10个人才能开始"
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
            "局开始"
        );


        currentGame = game;

        myPrivateInfo = null;


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


        myPrivateInfo = info;


        updateMyCard();

    }
);


// =========================
// 显示游戏
// =========================

function showGame(game) {

    document
        .getElementById("lobby")
        .style.display = "none";

    document
        .getElementById("room")
        .style.display = "none";

    document
        .getElementById("game")
        .style.display = "block";


    document
        .getElementById("roundNumber")
        .textContent =
        game.round;


    const container =
        document.getElementById(
            "players"
        );


    container.innerHTML = "";


    // 顶部提示

    const notice =
        document.createElement(
            "div"
        );

    notice.className =
        "game-notice";

    notice.style.gridColumn =
        "1 / -1";

    notice.innerHTML = `
        <div>
            🎮 第 ${game.round} 局进行中
        </div>

        <div>
            点击自己的卡片查看身份
        </div>
    `;

    container.appendChild(
        notice
    );


    // 玩家卡片

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


            // 只有自己的卡片可点击

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


    // 房主显示结束按钮

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

    if (!myPrivateInfo) return;


    const card =
        document.querySelector(
            `[data-player-id="${myId}"]`
        );


    if (!card) return;


    // 不自动打开
    // 玩家仍然需要点击自己的卡

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

    if (!isHost) return;


    const confirmEnd =
        confirm(
            "确定要结束本局并揭晓所有人的身份吗？"
        );


    if (!confirmEnd) return;


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
            "游戏结束，身份揭晓:",
            game
        );


        currentGame = game;


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
        .style.display = "none";

    document
        .getElementById("room")
        .style.display = "none";

    document
        .getElementById("game")
        .style.display = "block";


    document
        .getElementById("roundNumber")
        .textContent =
        game.round;


    const container =
        document.getElementById(
            "players"
        );


    container.innerHTML = "";


    // 标题

    const title =
        document.createElement(
            "div"
        );

    title.className =
        "final-title";

    title.style.gridColumn =
        "1 / -1";

    title.innerHTML = `
        🎭 第 ${game.round} 局身份揭晓
    `;

    container.appendChild(
        title
    );


    // 玩家结果

    game.players.forEach(
        player => {

            const card =
                document.createElement(
                    "div"
                );


            card.className =
                "final-player";


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


    // 房主下一局

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

    if (!isHost) return;


    socket.emit(
        "next_round"
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