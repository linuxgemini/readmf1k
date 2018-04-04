/*--------------------------------------------------------------
 *  Copyright (c) linuxgemini. All rights reserved.
 *  Licensed under the MIT License.
 *-------------------------------------------------------------*/

"use strict";

/*
## global card modes ##

   -1 = Never
    0 = Key A|B
    1 = Key A
    2 = Key B
*/
let dataDict = {
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
let sectorDict = {
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

module.exports = {dataDict, sectorDict};