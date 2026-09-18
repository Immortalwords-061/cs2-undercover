function shuffle(array) {

    for (let i = array.length - 1; i > 0; i--) {

        const j = Math.floor(Math.random() * (i + 1));

        [array[i], array[j]] = [array[j], array[i]];

    }

    return array;

}

function roomCode() {

    return Math.floor(
        100000 + Math.random() * 900000
    ).toString();

}

module.exports = {

    shuffle,

    roomCode

};