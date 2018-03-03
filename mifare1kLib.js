/**
 * WIP Mifare Classic 1K Library
 * I should've checked my grammar first.
 * @author İlteriş Eroğlu
 */

const { KEY_TYPE_A, KEY_TYPE_B } = require("nfc-pcsc");


class mf1k {
    constructor(opts) {
        this.keys = null,
        this.authedBlocks = null,
        this.reader = null,
        this.importantBlocks = null,
        this.accessData = null;
        if (typeof (opts) !== "object") throw new Error("Options is not provided, or the options parameter is not an object. (opts not object)");
        if (!opts.reader) throw new Error("Options doesn't have a reader in it. (no opts.reader)");
        this.callForEmergentInit(opts);
    }

    callForEmergentInit(re) {
        this.keys = [
            "000000000000",
            "FFFFFFFFFFFF"
        ],
        this.importantBlocks = [3, 7, 11, 15, 19, 23, 27, 31, 35, 39, 43, 47, 51, 55, 59, 63],
        this.reader = re.reader,
        this.authedBlocks = {},
        this.accessData = {};
        if (re.keys && Array.isArray(re.keys) && re.keys.length > 0) {
            for (const thekey of re.keys) {
                if (thekey.length === 12 && utils.isHex(thekey)) this.keys.push(thekey.toUpperCase());
            }
        }
        /* try {
            var resp = await this.reader.transmit(utils.convertHexStrtoBuffer("FFCA000000"), 40);
            if (utils.convertbufferToHexStrBlocks(resp).pop() === "63") throw new Error("Card is not with us.\nOr you forgot to supply the right reader.");
        } catch (error) {
            throw new Error(error);
        } */
    }

    /**
     * very unfortunate way to insert objects
     */
    insertKey(index, type, key) {
        return new Promise(async (resolve) => {
            var cache;
            if (typeof (this.authedBlocks[index]) === "object" && Object.keys(this.authedBlocks[index]).length > 0) {
                cache = this.authedBlocks[index];
            } else {
                cache = null;
            }
            var newObj = {[index]: {...cache, [type]: key}};
            Object.assign(this.authedBlocks, newObj);
            resolve(true);
        });
    }

    authorizeCard() {
        return new Promise(async (resolve) => {
            utils.log("Trying the default keyset. Please wait...", this.reader);
            for (const sheep of this.keys) {
                for (let i = 0; i < 64; i++) {
                    var trial;
                    try {
                        trial = "a";
                        await this.reader.authenticate(i, KEY_TYPE_A, sheep);
                        await this.insertKey(i, "a", sheep);
                        trial = "b";
                        await this.reader.authenticate(i, KEY_TYPE_B, sheep);
                        await this.insertKey(i, "b", sheep);
                    } catch (e) {
                        if (trial === "b") {
                            continue;
                        } else {
                            try {
                                await this.reader.authenticate(i, KEY_TYPE_B, sheep);
                                await this.insertKey(i, "b", sheep);
                            } catch (e) { continue; }
                        }
                    }
                }
            }
            resolve(true);
        });
    }
    readAccessBlocks() {
        return new Promise(async (resolve) => {
            utils.log("Reading sector trailer data...", this.reader);
            for (const block of this.importantBlocks) {
                if ((typeof (this.authedBlocks[block]) === "object" && Object.keys(this.authedBlocks[block]).length === 0) || typeof (this.authedBlocks[block]) === "undefined") continue;
                try {
                    if (!this.authedBlocks[block]["a"]) throw new Error(`The block ${block} doesn't have the key A.`);
                    await this.reader.authenticate(block, KEY_TYPE_A, this.authedBlocks[block]["a"]);
                    var cardData = await this.reader.read(block, 16, 16),
                        accessCondition = cardData.slice(6).slice(0,-7);
                    if (accessCondition.readUIntBE(0, 3) === 0x000000) throw new Error(`Failed to get the access conditions of block ${block}.`);
                    var acObj = utils.convertAC(accessCondition, block);
                    Object.assign(this.accessData, acObj);
                } catch (error) {
                    try {
                        if (!this.authedBlocks[block]["b"]) throw new Error(`The ${block} doesn't have the key B.`);
                        await this.reader.authenticate(block, KEY_TYPE_B, this.authedBlocks[block]["b"]);
                        var cardDataTwo = await this.reader.read(block, 16, 16),
                            accessConditionTwo = cardDataTwo.slice(6).slice(0, -7);
                        if (accessConditionTwo.readUIntBE(0, 3) === 0x000000) throw new Error(`Failed to get the access conditions of block ${block}.`);
                        var acObjTwo = utils.convertAC(accessConditionTwo, block);
                        Object.assign(this.accessData, acObjTwo);
                    } catch (error) {
                        continue;
                    }
                }
            }
            resolve(true);
        });
    }
    readCard() {
        return new Promise(async (resolve) => {
            let returner = [];
            utils.log("Started processing the card.", this.reader);
            await this.authorizeCard();
            await this.readAccessBlocks();
            utils.log("Started reading card.\n", this.reader);
            for (let index = 0; index < 64; index++) {
                var isSectorTrailer = this.importantBlocks.indexOf(index) !== -1; // create boolean for sector trailer checking
                var keyA = (typeof (this.authedBlocks[index]) === "undefined" ? undefined : this.authedBlocks[index]["a"]),
                    keyB = (typeof (this.authedBlocks[index]) === "undefined" ? undefined : this.authedBlocks[index]["b"]),
                    readingKey = (isSectorTrailer ? (typeof (this.accessData[index]) === "undefined" ? -1 : (!keyA && keyB && this.accessData[index]["isGrey"] ? 2 : this.accessData[index]["abr"])) : (typeof (this.accessData[index]) === "undefined" ? -1 : this.accessData[index]["r"]));
                if ((typeof (this.authedBlocks[index]) === "object" && Object.keys(this.authedBlocks[index]).length === 0) || readingKey === -1 || (readingKey === 1 && !keyA) || (readingKey === 2 && !keyB)) { // if we don't have the keys for this block (or don't have the required key OR don't have literal access), send all zeroes and skip
                    returner.push(Buffer.from([]));
                    continue;
                }
                var keyToUse = (!keyA ? keyB : keyA);
                var keyType = (!keyA ? KEY_TYPE_B : KEY_TYPE_A);
                switch (readingKey) {
                case 0:
                    try {
                        await this.reader.authenticate(index, keyType, keyToUse);
                        var cardData = await this.reader.read(index, 16, 16);
                        if (isSectorTrailer) {
                            if (keyA) cardData = utils.convertHexStrtoBuffer(`${keyA}${utils.fastconvertBuffertoHexStr(cardData).slice(12)}`);
                            if (keyB && (this.accessData[index].kbr === -1 || (!keyA && this.accessData[index].kbr === 1))) cardData = utils.convertHexStrtoBuffer(`${utils.fastconvertBuffertoHexStr(cardData).slice(0, -12)}${keyB}`);
                            if (!keyB && this.accessData[index].kbr === -1) cardData = utils.convertHexStrtoBuffer(`${utils.fastconvertBuffertoHexStr(cardData).slice(0, -12)}00`);
                            if (!keyA) cardData = utils.convertHexStrtoBuffer(`00${utils.fastconvertBuffertoHexStr(cardData).slice(12)}`);
                        }
                        returner.push(cardData);
                    } catch (error) {
                        utils.log(error);
                        returner.push(Buffer.from([]));
                        continue;
                    }
                    break;
                case 1:
                    try {
                        if (!keyA) throw new Error("Couldn't find key A!");
                        await this.reader.authenticate(index, KEY_TYPE_A, keyA);
                        var cardDataTwo = await this.reader.read(index, 16, 16);
                        if (isSectorTrailer) {
                            cardDataTwo = utils.convertHexStrtoBuffer(`${keyA}${utils.fastconvertBuffertoHexStr(cardDataTwo).slice(12)}`);
                            if (this.accessData[index].kbr === -1 && keyB) cardDataTwo = utils.convertHexStrtoBuffer(`${utils.fastconvertBuffertoHexStr(cardData).slice(0, -12)}${keyB}`);
                            if (!keyB && this.accessData[index].kbr === -1) cardDataTwo = utils.convertHexStrtoBuffer(`${utils.fastconvertBuffertoHexStr(cardData).slice(0, -12)}00`);
                        }
                        returner.push(cardDataTwo);
                    } catch (error) {
                        returner.push(Buffer.from([]));
                        continue;
                    }
                    break;
                case 2:
                    try {
                        if (!keyB) throw new Error("Couldn't find key B!");
                        await this.reader.authenticate(index, KEY_TYPE_B, keyB);
                        var cardDataThree = await this.reader.read(index, 16, 16);
                        if (isSectorTrailer) {
                            cardDataThree = utils.convertHexStrtoBuffer(`00${utils.fastconvertBuffertoHexStr(cardDataThree).slice(12)}`);
                        }
                        returner.push(cardDataThree);
                    } catch (error) {
                        returner.push(Buffer.from([]));
                        continue;
                    }
                    break;
                default:
                    break;
                }
            }
            resolve(returner);
        });
    }

    bufferArrayOutputToHEXStringArray(arr) {
        return new Promise((resolve) => {
            if (!Array.isArray(arr)) resolve([]);
            var ret = [];
            for (const block of arr) {
                var conv = (block.length === 0 ? "--------------------------------" : (block.length === 11 && block[0] === 0 ? `------------${utils.fastconvertBuffertoHexStr(block).slice(2)}` : (block.length === 11 && block[10] === 0 ? `${utils.fastconvertBuffertoHexStr(block).slice(0,-2)}------------` : utils.fastconvertBuffertoHexStr(block))));
                ret.push(conv);
            }
            resolve(ret);
        });
    }
}

class utils {
    static convertUint8toHexStr(uint8arr) {
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
    static fastconvertBuffertoHexStr(buf) {
        if (!Buffer.isBuffer(buf)) return "";
        return buf.toString("hex").toUpperCase();
    }
    static convertbufferToHexStrBlocks(buf) {
        if (!Buffer.isBuffer(buf)) return "";
        return this.fastconvertBuffertoHexStr(buf).match(/.{1,2}/g);
    }
    static convertHexStrtoBuffer(str) {
        if (!str) return Buffer.from("");

        var a = [];
        for (var i = 0, len = str.length; i < len; i += 2) {
            a.push(parseInt(str.substr(i, 2), 16));
        }

        return Buffer.from(a);
    }
    static isHex(h) {
        var a = parseInt(h, 16);
        return (a.toString(16) === h.toLowerCase());
    }
    static convertAC(ac,blockID) {
        /*
            CONVERSION TABLE
                    7    6    5    4    3    2    1    0
                0   C2^3 C2^2 C2^1 C2^0 C1^3 C1^2 C1^1 C1^0 (ALL INVERSED)
                1   C1^3 C1^2 C1^1 C1^0 C3^3 C3^2 C3^1 C3^0 (3-0 INVERSED)
                2   C3^3 C3^2 C3^1 C3^0 C2^3 C2^2 C2^1 C2^0

            FF0780 MATRIX
                    |   7   6   5   4   3   2   1   0
                ----|------------------------------------
                FF  |   1   1   1   1   1   1   1   1
                07  |   0   0   0   0   0   1   1   1
                80  |   1   0   0   0   0   0   0   0

                INVERSED
                        |   7   6   5   4   3   2   1   0
                    ----|------------------------------------
                    FF  |   0   0   0   0   0   0   0   0
                    07  |   0   0   0   0   1   0   0   0
                    80  |   1   0   0   0   0   0   0   0

                Cn TABLE FOR FF0780
                        |   0   1   2   3
                    ----|--------------------
                    C1  |   0   0   0   0
                    C2  |   0   0   0   0
                    C3  |   0   0   0   1

        */
        if (Buffer.byteLength(ac) !== 3) return "";
        if (!blockID || (blockID && typeof(blockID) !== "number")) return "";

        var returning = {};

        /*
        ## global card modes ##

            -1 = Never
            0 = Key A|B
            1 = Key A
            2 = Key B
        */
        var dataDict = {
            "000": {
                r: 0,
                w: 0,
                i: 0,
                d: 0,
                isGrey: false
            },
            "010": {
                r: 0,
                w: -1,
                i: -1,
                d: -1,
                isGrey: true
            },
            "100": {
                r: 0,
                w: 2,
                i: -1,
                d: -1,
                isGrey: true
            },
            "110": {
                r: 0,
                w: 2,
                i: 2,
                d: 0,
                isGrey: false
            },
            "001": {
                r: 0,
                w: -1,
                i: -1,
                d: 0,
                isGrey: false
            },
            "011": {
                r: 2,
                w: 2,
                i: -1,
                d: -1,
                isGrey: true
            },
            "101": {
                r: 2,
                w: -1,
                i: -1,
                d: -1,
                isGrey: false
            },
            "111": {
                r: -1,
                w: -1,
                i: -1,
                d: -1,
                isGrey: false
            }
        };
        var sectorDict = {
            "000": {
                kar: -1,
                kaw: 1,
                abr: 1,
                abw: -1,
                kbr: 1,
                kbw: 1,
                isGrey: true
            },
            "010": {
                kar: -1,
                kaw: -1,
                abr: 1,
                abw: -1,
                kbr: 1,
                kbw: -1,
                isGrey: true
            },
            "100": {
                kar: -1,
                kaw: 2,
                abr: 0,
                abw: -1,
                kbr: -1,
                kbw: 2,
                isGrey: false
            },
            "110": {
                kar: -1,
                kaw: -1,
                abr: 0,
                abw: -1,
                kbr: -1,
                kbw: -1,
                isGrey: false
            },
            "001": {
                kar: -1,
                kaw: 1,
                abr: 1,
                abw: 1,
                kbr: 1,
                kbw: 1,
                isGrey: true
            },
            "011": {
                kar: -1,
                kaw: 2,
                abr: 0,
                abw: 2,
                kbr: -1,
                kbw: 2,
                isGrey: false
            },
            "101": {
                kar: -1,
                kaw: -1,
                abr: 0,
                abw: 2,
                kbr: -1,
                kbw: -1,
                isGrey: false
            },
            "111": {
                kar: -1,
                kaw: -1,
                abr: 0,
                abw: -1,
                kbr: -1,
                kbw: -1,
                isGrey: false
            }
        };
        var unsafeBinary = ac.readUIntBE(0, ac.length).toString(2);
        if ((unsafeBinary.length % 24) !== 0) {
            unsafeBinary = `${"0".repeat((24 - unsafeBinary.length))}${unsafeBinary}`;
        }
        var bytes = unsafeBinary.match(/.{1,8}/g),
            first = this.invertStringBinary(bytes[0]).split("").reverse(),
            second = this.invertStringBinary(bytes[1], 4).split("").reverse(),
            third = bytes[2].split("").reverse(),
            cFirst = first.join("").match(/.{1,4}/g)[0].split(""),
            cSecond = first.join("").match(/.{1,4}/g)[1].split(""),
            cThird = second.join("").match(/.{1,4}/g)[0].split(""),
            sZero = `${cFirst[0]}${cSecond[0]}${cThird[0]}`,
            sOne = `${cFirst[1]}${cSecond[1]}${cThird[1]}`,
            sTwo = `${cFirst[2]}${cSecond[2]}${cThird[2]}`,
            sThree = `${cFirst[3]}${cSecond[3]}${cThird[3]}`,
            bZero = blockID - 3,
            bOne = blockID - 2,
            bTwo = blockID -1,
            bThree = blockID;

        if (third.join("").match(/.{1,4}/g)[0] !== cSecond.join("") || third.join("").match(/.{1,4}/g)[1] !== cThird.join("")) throw new Error("there is a problem with the AC format");

        returning[bZero] = dataDict[sZero],
        returning[bOne] = dataDict[sOne],
        returning[bTwo] = dataDict[sTwo],
        returning[bThree] = sectorDict[sThree];

        return returning;
    }
    static invertStringBinary(str, fromLast) {
        if (/[^01]+/g.test(str)) return;
        if (fromLast && typeof(fromLast) === "number" && fromLast <! 0) {
            return `${str.slice(0, -fromLast)}${str.slice(-fromLast).replace(/./g, x => x ^ 1)}`;
        } else {
            return str.replace(/./g, x => x ^ 1);
        }
    }
    static log(msg, reader) {
        if (reader) {
            return console.log(`[${reader.reader.name}]  ${msg}`);
        }
        console.log(msg);
    }
    static alog(msg) {
        return new Promise(async (resolve) => {
            console.log(msg);
            resolve(true);
        });
    }
    static sleep(ms) {
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    }
}

module.exports = mf1k;
