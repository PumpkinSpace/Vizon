module.exports = function(app) {
  var event = app.event
    , io = require('socket.io-client')
    , crypto = require('crypto')
    , utils = require('./utils.js')
    , config = require('./config.js')
    , handle = require('./handlers.js')
		//, text_belt = require('./textbelt.js')
    , socket = {}
    ;

  // begin socket setup
  var socketRetry = setInterval(function() { // this is the only way to loop if not connected
    utils.logText('Control Center unavailable', 'ERR');
    socket.socket.connect();
  }, 10000);

  socket = io.connect(config.cc.uri, config.cc.options)
  // handle standard socket events
  .on('connect', function() {
    clearInterval(socketRetry);
    socket.emit('auth-initiate', config.gsid);
    utils.logText('Connected to CC ' + config.cc.uri.split('://')[1]);
  })
  .on('disconnect', function() {
    utils.logText('Connection to CC closed', 'ERR');
		handle.storeLocally = true;
		//text_belt.send('7168302024','Vizon Control Center Disconnected.  From: testGS',function(){});
		//text_belt.send('6179994071','Vizon Control Center Disconnected.  From: testGS',function(){});
    event.emit('socket-stop');
  })
  // other possible standard socket events include 'connecting', 'reconnecting', 'reconnect'
  .on('connect_failed', function() { utils.logText('Connection to CC failed', 'ERR'); })
  .on('reconnect_failed', function() { utils.logText('Reconnection to CC failed', 'ERR'); })
  .on('error', function(err) { utils.logText('Socket ' + (config.dev && err ? err : ''), 'ERR'); })

  // handle authentication socket events
  .on('auth-challenge', function(challenge, callback) {
    var response = crypto
      .createHmac(challenge.alg, config.key)
      .update(challenge.data)
      .digest(challenge.enc);
    callback(response);
  })
  .on('auth-pass', function() {
    utils.logText('from CC', 'AUTH PASS', utils.colors.ok);
		handle.storeLocally = false;
		handle.uploadStoredData();
    event.emit('socket-start', socket);
  })
  .on('auth-fail', function() {
    utils.logText('from CC', 'AUTH FAIL', utils.colors.error);
  })
  
  // handle application socket events
  .on('relay', function(data) {
    utils.logText('from CC', 'RLY', utils.colors.warn);
    handle.SerialRead(data);
  })
  .on('info', function(packet){
    utils.logPacket(packet, 'INF', 'from CC: ' + packet);
  })
  .on('cap', function(packet){
    utils.logPacket(packet, 'CAP', 'from CC');
    handle.CAP(packet); // add callback to ensure bytes written? or let TAP2 (cmd echo) handle that
  })
  .on('removedesc', function(desc_typeid) {
  	utils.logText('from CC' + desc_typeid, 'RMVPCKT', utils.colors.warn);
		handle.deleteDescriptor(desc_typeid);
	})
  socket.socket.connect(); // trust me, this is correct
  
  return socket;
}
