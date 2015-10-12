module.exports = function(app) {
  var event = app.event
    , handle = require('./handlers.js')
    , utils = require('./utils.js')
    , endpoints = {}
    ;
  
  // add handlers that depend on current socket endpoint
  handle.SocketSend = function(packetType, data, callback){
    if(callback)
      endpoints.socket.emit(packetType, data, callback);
    else if(data)
      endpoints.socket.emit(packetType, data);
  }
  
  // add handlers that depend on current port endpoint
  handle.PortWrite = function(data){
    endpoints.port.write(data, function(err, results) {
      if(err) utils.log('Serial write error: ' + err);
      if(results != 0) utils.logText('Serial data write - ' + results + ' bytes');
    });
  }
  
  // When the port connects, enable the serial port writer
  event.on('port-start', function(port){                       
    endpoints.port = port;
    event.on('port-read', handle.SerialRead);
		event.on('port-write', handle.PortWrite);
  });
  
  // When the port disconnects, disable the serial port writer
  event.on('port-stop', function(){    
		event.removeListener('port-read', handle.SerialRead);
    event.removeListener('port-write', handle.PortWrite);
  });
  
  // When the socket connects, enable the port reader and socket sender
  event.on('socket-start', function(socket){                   
    endpoints.socket = socket;
    //event.on('port-read', handle.SerialRead);
    event.on('socket-send', handle.SocketSend);
  });
  
  // When the socket disconnects, disable the port reader and socket sender
  event.on('socket-stop', function(){                           
    //event.removeListener('port-read', handle.SerialRead);
    event.removeListener('socket-send', handle.SocketSend);
  });
}
