/*--------------------------------------------------------------
 *  Copyright (c) linuxgemini. All rights reserved.
 *  Licensed under the MIT License.
 *-------------------------------------------------------------*/

"use strict";

const { KEY_TYPE_A, KEY_TYPE_B, NFC } = require("nfc-pcsc");
const mifareUtils = require("./mifareUtils/mifareUtils");

class mifareClassic1K {
    constructor(keys = []) {
        if (!Array.isArray(keys)) throw new Error("Keys are not supplied in an array.");
        let externalKeys = (keys.length === 0 ? null : keys.filter(key => this.utils.isHex(key) && key.length === 12).map());
        this.utils = mifareUtils;
        this.nfc = new NFC();
        this.reader = null;
        this.isCardAvailable = false;
        this.cardATR = null;
        this.keys = [
            "000000000000",
            "FFFFFFFFFFFF"
        ];
        this.accessBlocks = [3, 7, 11, 15, 19, 23, 27, 31, 35, 39, 43, 47, 51, 55, 59, 63];
        this.cardAuthenticatedBlocks = {};
        this.isCardAuthenticationScanSuccessful = false;
        this.cardAccessData = {};
        if (externalKeys) this.keys.concat(externalKeys);
        this._initEvents();
    }

    _reset(resetReader = false) {
        this.cardAuthenticatedBlocks = {};
        this.cardAccessData = {};
        this.isCardAvailable = false;
        this.isCardAuthenticationScanSuccessful = false;
        this.cardATR = null;
        if (resetReader) this.reader = null;
        return true;
    }

    _initReaderEvents() {
        this.reader.autoProcessing = false;
        this.reader.on("card", (card) => { this.isCardAvailable = true; this.cardATR = card.atr; });
        this.reader.on("card.off", () => { this._reset(); });
        this.reader.on("end", () => { this._reset(true); });
        return true;
    }
    
    _initEvents() {
        this.nfc.on("reader", (reader) => { this.reader = reader; this._initReaderEvents(); });
        return true;
    }

    get _checkCard() {
        let mfcATRarray = this.utils.convertbufferToHexStrBlocks(this.cardATR);
        let mfcCheckPoint = `${mfcATRarray[13]}${mfcATRarray[14]}`;
        
        return mfcCheckPoint === "0001";
    }

    insertKey(index, type, key) {
        return new Promise(async (resolve) => {
            let preDefinedVariable = null;
            if (typeof (this.cardAuthenticatedBlocks[index]) === "object" && Object.keys(this.cardAuthenticatedBlocks[index]).length > 0) preDefinedVariable = this.cardAuthenticatedBlocks[index];
            var newObj = {
                [index]: {
                    ...preDefinedVariable,
                    [type]: key
                }
            };
            Object.assign(this.cardAuthenticatedBlocks, newObj);
            resolve(true);
        });
    }

    authenticateCard() {
        return new Promise(async (resolve, reject) => {
            if (!this._checkCard) reject(new Error("Card is not plugged in!"));
            for (const key of this.keys) {
                for (let i = 0; i < 64; i++) {
                    let currentKey;
                    try {
                        currentKey = "a";
                        await this.reader.authenticate(i, KEY_TYPE_A, key);
                        await this.insertKey(i, "a", key);
                        currentKey = "b";
                        await this.reader.authenticate(i, KEY_TYPE_B, key);
                        await this.insertKey(i, "b", key);
                    } catch (e) {
                        if (currentKey === "b") {
                            continue;
                        } else {
                            try {
                                await this.reader.authenticate(i, KEY_TYPE_B, key);
                                await this.insertKey(i, "b", key);
                            } catch (e) {
                                continue;
                            }
                        }
                    }
                }
            }
            resolve(this.isCardAuthenticationScanSuccessful = true);
        });
    }

    readAccessBlocks() {
        return new Promise(async (resolve, reject) => {
            if (!this._checkCard) reject(new Error("Card is not plugged in!"));
            if (!this.isCardAuthenticationScanSuccessful) await this.authenticateCard();
            for (const block of this.accessBlocks) {
                if (this.cardAuthenticatedBlocks[block] === undefined) continue;
                try {
                    if (!this.cardAuthenticatedBlocks[block]["a"]) throw new Error(`The block ${block} doesn't have the key A.`);

                    await this.reader.authenticate(block, KEY_TYPE_A, this.cardAuthenticatedBlocks[block]["a"]);

                    let blockData = await this.reader.read(block, 16, 16);
                    let accessPartition = blockData.slice(6).slice(0, -7);

                    if (accessPartition.readUIntBE(0, 3) === 0x000000) throw new Error(`Failed to get the access conditions of block ${block}.`);

                    let accessObject = this.utils.convertAC(accessPartition, block);

                    Object.assign(this.cardAccessData, accessObject);
                } catch (error) {
                    try {
                        if (!this.cardAuthenticatedBlocks[block]["b"]) throw new Error(`The block ${block} doesn't have the key A.`);

                        await this.reader.authenticate(block, KEY_TYPE_B, this.cardAuthenticatedBlocks[block]["b"]);

                        let blockData = await this.reader.read(block, 16, 16);
                        let accessPartition = blockData.slice(6).slice(0, -7);

                        if (accessPartition.readUIntBE(0, 3) === 0x000000) throw new Error(`Failed to get the access conditions of block ${block}.`);

                        let accessObject = this.utils.convertAC(accessPartition, block);

                        Object.assign(this.cardAccessData, accessObject);
                    } catch (error) {
                        continue;
                    }
                }
            }
            resolve(true);
        });
    }
}

module.exports = mifareClassic1K;