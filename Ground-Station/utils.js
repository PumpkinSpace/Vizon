var utils = exports, crypto = require('crypto'), config = require('./config.js');

// ansi terminal colors
utils.colors = {
	ok : '\033[32m', // green
	info : '\033[36m', // blue
	warn : '\033[33m', // yellow
	error : '\033[31m', // red
	low : '\033[2m', // grey, not often supported
	reset : '\033[0m' // reset
}

// shortcut to terminal colors based on nap type
utils.napcolors = {
	INF : utils.colors.info,
	TAP : utils.colors.warn,
	CAP : utils.colors.warn,
	ERR : utils.colors.error
}

// log string to console with datetime stamp. if in development environment, log
// any included data object too
utils.log = function(str, data) {
	var fs = require('fs');
	fs.open("error.log", 'a+');
	if (config.dev && data)
		console.log();
	console.log(utils.colors.low + (new Date()).toISOString() + ' - '
			+ utils.colors.reset + str);
	fs.appendFile("error.log", utils.colors.low + (new Date()).toISOString()
			+ ' - ' + utils.colors.reset + str + '\n', function(err) {
		if (err)
			console.log("ERROR");
	});
	if (config.dev && data) {
		console.log(data);
		fs.appendFile("error.log", data.toString() + '\n', function(err) {
			if (err)
				console.log("ERROR");
		});
		console.log();
	}
}

// enhanced text logging with message type coloring
utils.logText = function(text, TYPE, color) {
	if (!TYPE)
		TYPE = 'INF';
	if (!color)
		color = utils.napcolors[TYPE] || utils.colors.info;
	utils.log(color + TYPE + utils.colors.reset + ' ' + text);
}

// enhanced nap packet logging with message type coloring and package
// identification based on hash
utils.logPacket = function(packet, TYPE, text, hash) {
	if (!hash)
		hash = crypto.createHash('sha1').update(JSON.stringify(packet)).digest(
				'hex');
	utils.log((utils.napcolors[TYPE] ? utils.napcolors[TYPE] : '') + TYPE
			+ utils.colors.reset + ' ' + hash.substring(0, 6) + ' ' + text,
			packet);
}