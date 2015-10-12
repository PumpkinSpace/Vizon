var utils = exports,
   crypto = require('crypto'),
   config = require('./config.js'),
   bytes = require('bytes'),
   colors = require('colors');

require('morgan').format('dev', function(tokens, req, res){
  var status = res.statusCode,
    len = parseInt(res.getHeader('Content-Length'), 10),
    color = 32;

  if (status >= 500) { color = 31; }
  else if (status >= 400) { color = 33; }
  else if (status >= 300) { color = 36; }

  len = isNaN(len) ? '' : len = ' ' + bytes(len);

  return (new Date()).toISOString().grey + ' ' + req.method + ' ' + req.originalUrl + ' '+ '\x1b[' + color + 'm' + res.statusCode + ' \x1b[90m' + (new Date() - req._startTime) + 'ms' + len + '\x1b[0m';
});

// shortcut to terminal colors based on nap type
utils.napcolors = {
  INF: '\033[36m',
  TAP: '\033[33m',
  CAP: '\033[33m',
  ERR: '\033[31m',
  RST: '\033[0m'
};

// log string to console with datetime stamp. if in development environment, log any included data object too
utils.log = function(str,data) {
  if(config.dev && data) { console.log(); }
  console.log((new Date()).toISOString().grey + ' ' + str);
  if(config.dev && data) {
    console.log(data);
    console.log();
  }
};

// enhanced text logging with message type coloring
utils.logText = function(text, TYPE) {
  if(!TYPE) { TYPE = 'INF'.cyan; }
  utils.log(TYPE + ' ' + text);
};

// enhanced nap packet logging with message type coloring and package identification based on hash
utils.logPacket = function(packet, TYPE, text, hash) {
  if(!hash) { hash = crypto.createHash('sha1').update(JSON.stringify(packet)).digest('hex'); }
  utils.log((utils.napcolors[TYPE] ? utils.napcolors[TYPE] : '') + TYPE + utils.napcolors.RST + ' ' + hash.substring(0,6) + ' ' + text, packet);
};