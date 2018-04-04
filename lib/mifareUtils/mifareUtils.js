/*--------------------------------------------------------------
 *  Copyright (c) linuxgemini. All rights reserved.
 *  Licensed under the MIT License.
 *-------------------------------------------------------------*/

"use strict";

const { dataDict, sectorDict } = require("./utilDictionaries");

class mifareUtils {
    static convertUint8toHexStr(uint8arr) {
        if (!uint8arr) return "";

        let hexStr = "";
        for (let i = 0; i < uint8arr.length; i++) {
            let hex = (uint8arr[i] & 0xff).toString(16);
            hex = (hex.length === 1) ? "0" + hex : hex;
            hexStr += hex;
        }

        return hexStr.toUpperCase();
    }
    static convertHexStrtoBuffer(str) {
        if (!str) return Buffer.from("");

        let a = [];
        for (let i = 0, len = str.length; i < len; i += 2) {
            a.push(parseInt(str.substr(i, 2), 16));
        }

        return Buffer.from(a);
    }
    static fastconvertBuffertoHexStr(buf) {
        if (!Buffer.isBuffer(buf)) return "";
        return buf.toString("hex").toUpperCase();
    }
    static convertbufferToHexStrBlocks(buf) {
        if (!Buffer.isBuffer(buf)) return "";
        return this.fastconvertBuffertoHexStr(buf).match(/.{1,2}/g);
    }
    static isHex(h) {
        let a = parseInt(h, 16);
        return (a.toString(16) === h.toLowerCase());
    }
    static convertAC(ac, blockID) {
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
        if (!blockID || (blockID && typeof (blockID) !== "number")) return "";

        let returning = {};

        let unsafeBinary = ac.readUIntBE(0, ac.length).toString(2);
        if ((unsafeBinary.length % 24) !== 0) {
            unsafeBinary = unsafeBinary.padStart(24, "0");
        }
        let bytes = unsafeBinary.match(/.{1,8}/g);
        let first = this.invertStringBinary(bytes[0]).split("").reverse();
        let second = this.invertStringBinary(bytes[1], 4).split("").reverse();
        let third = bytes[2].split("").reverse();
        let cFirst = first.join("").match(/.{1,4}/g)[0].split("");
        let cSecond = first.join("").match(/.{1,4}/g)[1].split("");
        let cThird = second.join("").match(/.{1,4}/g)[0].split("");
        let sZero = `${cFirst[0]}${cSecond[0]}${cThird[0]}`;
        let sOne = `${cFirst[1]}${cSecond[1]}${cThird[1]}`;
        let sTwo = `${cFirst[2]}${cSecond[2]}${cThird[2]}`;
        let sThree = `${cFirst[3]}${cSecond[3]}${cThird[3]}`;
        let bZero = blockID - 3;
        let bOne = blockID - 2;
        let bTwo = blockID - 1;
        let bThree = blockID;

        if (third.join("").match(/.{1,4}/g)[0] !== cSecond.join("") || third.join("").match(/.{1,4}/g)[1] !== cThird.join("")) throw new Error("there is a problem with the AC format");

        returning[bZero] = dataDict[sZero];
        returning[bOne] = dataDict[sOne];
        returning[bTwo] = dataDict[sTwo];
        returning[bThree] = sectorDict[sThree];

        return returning;
    }
    static invertStringBinary(str, fromLast) {
        if (/[^01]+/g.test(str)) return;
        if (fromLast && typeof (fromLast) === "number" && fromLast < !0) {
            return `${str.slice(0, -fromLast)}${str.slice(-fromLast).replace(/./g, x => x ^ 1)}`;
        } else {
            return str.replace(/./g, x => x ^ 1);
        }
    }

    static sleep(ms) {
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    }
}

module.exports = mifareUtils;