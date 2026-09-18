const rooms = new Map();


// =========================
// 生成6位房间号
// =========================

function generateRoomCode() {

    let code;

    do {

        code =
            Math.floor(
                100000 +
                Math.random() * 900000
            ).toString();

    } while (rooms.has(code));

    return code;
}


// =========================
// 创建房间
// =========================

function createRoom(hostSocketId, hostName) {

    const code =
        generateRoomCode();


    const room = {

        code: code,

        hostId: hostSocketId,

        hostName: hostName,

        state: "WAITING",

        round: 0,

        players: [],

        games: []

    };


    rooms.set(code, room);


    return room;
}


// =========================
// 获取房间
// =========================

function getRoom(code) {

    return rooms.get(code);
}


// =========================
// 删除房间
// =========================

function deleteRoom(code) {

    rooms.delete(code);

}


// =========================
// 添加玩家
// =========================

function addPlayer(room, player) {

    if (room.players.length >= 10) {

        return {
            success: false,
            message: "房间已经满了"
        };

    }


    if (
        room.players.some(
            p => p.id === player.id
        )
    ) {

        return {
            success: false,
            message: "你已经在房间里了"
        };

    }


    if (
        room.players.some(
            p => p.name === player.name
        )
    ) {

        return {
            success: false,
            message: "这个昵称已经有人使用了"
        };

    }


    room.players.push(player);


    return {
        success: true
    };
}


// =========================
// 移除玩家
// =========================

function removePlayer(room, socketId) {

    room.players =
        room.players.filter(
            player => player.id !== socketId
        );

}


// =========================
// 公共房间信息
// =========================

function getPublicRoom(room) {

    return {

        code: room.code,

        hostId: room.hostId,

        hostName: room.hostName,

        state: room.state,

        round: room.round,

        players:
            room.players.map(player => ({
                id: player.id,
                name: player.name
            })),

        playerCount:
            room.players.length

    };

}


module.exports = {

    createRoom,

    getRoom,

    deleteRoom,

    addPlayer,

    removePlayer,

    getPublicRoom

};