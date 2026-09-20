const rooms = new Map();

function generateRoomCode() {
    let code;

    do {
        code = Math.floor(
            100000 + Math.random() * 900000
        ).toString();
    } while (rooms.has(code));

    return code;
}

function normalizeMaxPlayers(maxPlayers) {
    const value = Number(maxPlayers);

    if (
        !Number.isInteger(value) ||
        value < 6 ||
        value > 16
    ) {
        return 10;
    }

    return value;
}

function createRoom(
    hostSocketId,
    hostName,
    mode = "UNDERCOVER",
    maxPlayers = 10
) {
    const code = generateRoomCode();

    if (
        mode !== "TEAM" &&
        mode !== "UNDERCOVER"
    ) {
        mode = "UNDERCOVER";
    }

    const room = {
        code,
        hostId: hostSocketId,
        hostName,

        mode,

        maxPlayers:
            normalizeMaxPlayers(maxPlayers),

        state: "WAITING",

        round: 0,

        players: [],

        games: [],

        currentGame: null
    };

    rooms.set(code, room);

    return room;
}

function getRoom(code) {
    return rooms.get(code);
}

function deleteRoom(code) {
    rooms.delete(code);
}

function getMaxPlayers(room) {
    return normalizeMaxPlayers(
        room.maxPlayers
    );
}

function addPlayer(room, player) {
    const maxPlayers =
        getMaxPlayers(room);

    if (
        room.players.length >= maxPlayers
    ) {
        return {
            success: false,
            message:
                `房间已经满了，目前需要 ${maxPlayers} 人`
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
            message:
                "这个昵称已经有人使用了"
        };
    }

    room.players.push(player);

    return {
        success: true
    };
}

function removePlayer(room, socketId) {
    room.players =
        room.players.filter(
            player =>
                player.id !== socketId
        );
}

function getPublicRoom(room) {
    return {
        code: room.code,

        hostId: room.hostId,

        hostName: room.hostName,

        mode: room.mode,

        state: room.state,

        round: room.round,

        players:
            room.players.map(
                player => ({
                    id: player.id,
                    name: player.name
                })
            ),

        playerCount:
            room.players.length,

        maxPlayers:
            getMaxPlayers(room)
    };
}

module.exports = {
    createRoom,
    getRoom,
    deleteRoom,
    addPlayer,
    removePlayer,
    getPublicRoom,
    getMaxPlayers
};