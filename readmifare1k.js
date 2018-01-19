const {
    NFC
} = require("nfc-pcsc");
const mf1k = require("./mifare1kLib");

const contactless = new NFC();

var readers = [];
var cards = [];

function byteToHexString(uint8arr) {
    if (!uint8arr) {
        return "";
    }

    var hexStr = "";
    for (var i = 0; i < uint8arr.length; i++) {
        var hex = (uint8arr[i] & 0xff).toString(16);
        hex = (hex.length === 1) ? "0" + hex : hex;
        hexStr += hex;
    }

    return hexStr.toUpperCase();
}

function printOut(data) {
    let baseIndex = 0;
    for (const block of data) {
        var fin = (baseIndex < 10 ? `0${baseIndex}` : baseIndex);
        console.log(`[${fin}]  ${block}`);
        baseIndex++;
    }
}

function log(reader, message, type, card, e) {
    switch (type.toLowerCase()) {
    case "readererror":
        console.error(`[${reader.reader.name}]      ${message}`);
        break;
    case "eventerror":
        console.error(`[${reader.reader.name}] `, e);
        break;
    case "processerror":
        console.error(message);
        break;
    case "error-noenc":
        console.error(message);
        break;
    case "init":
        console.log(`The device ${reader.reader.name} has been attached with AID ${reader.aid}. Insert your card now.\n`);
        break;
    case "carddetection":
        console.log(`[${reader.reader.name}]  Card Detected!\n[${reader.reader.name}]      Type: ${card.type}\n[${reader.reader.name}]      ATR: ${byteToHexString(card.atr)}\n[${reader.reader.name}]      ${(card.type === "TAG_ISO_14443_3" ? `UID: ${card.uid}` : `Data: ${card.data}`)}\n`);
        break;
    case "end":
        console.log(`The device ${reader.reader.name} has been removed.`);
        break;
    case "default-noreader":
        console.log(message);
        break;
    default:
        console.log(`[${reader.reader.name}]  ${message}`);
        break;
    }
}

function chicken() {
    contactless.on("reader", reader => {
        readers.push(reader);

        reader.aid = "F222222222";

        log(reader, "", "init");

        reader.on("card", async card => {
            cards.push(card);

            var cardAtr = byteToHexString(card.atr),
                cardTypeCode = `${cardAtr.match(/.{1,2}/g)[13]}${cardAtr.match(/.{1,2}/g)[14]}`;
            if (cardTypeCode !== "0001") {
                log(reader, "Card is not a MIFARE Classic 1K", "readererror");
                return process.exit(0);
            }

            log(reader, "", "carddetection", card);
            var libra = new mf1k({
                "reader": reader
            });
            var readCard = await libra.readCard();
            var out = await libra.bufferArrayOutputToHEXStringArray(readCard);
            printOut(out);
            return process.exit(0);
        });

        reader.on("card.off", () => {
            cards.pop();
            log(reader, "Card Removed!", "");
        });

        reader.on("error", e => {
            log(reader, "", "eventerror", "", e);
        });

        reader.on("end", () => {
            readers.pop();
            log(reader, "", "end");
        });

        setInterval(() => {
            if (!readers.length) {
                log("", "\nNo reader is plugged in. Exiting...", "processerror");
                process.exit(0);
            } else if (!cards.length) {
                log("", "\nNo card is inserted. Exiting...", "processerror");
                process.exit(0);
            }
        }, 5000);
    });

    contactless.on("error", e => {
        log("", e, "error-noenc");
    });

    log("", "\nReady, plug your reader in please.\n", "default-noreader");

}

module.exports = chicken;
