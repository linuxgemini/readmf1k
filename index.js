#!/usr/bin/env node

/**
 * Module dependencies.
 */

var program = require("commander");
const chicken = require("./readmifare1k.js");

program
    .usage("readmf1k [options] <command>")
    .version("1.0.0")
    .description("the perfect mifare 1k reader");

program
    .command("read")
    .alias("r")
    .description("read mifare 1k")
    .action(() => {
        chicken();
    });

if (!process.argv.slice(2).length) {
    program.outputHelp();
    process.exit();
}

program.parse(process.argv);

process.on("unhandledRejection", (reason, p) => { // on an unhandled error
    console.error("Unhandled Rejection from core:", p, "\n\nreason:", reason);
});