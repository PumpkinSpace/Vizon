'use strict';

module.exports = function() {
	// create express app and load other fundamental modules
	var app = {
		event : new (require('events').EventEmitter),
	};
	require('./handlers.js').init(app);
	require('./monitor.js')(app);
	require('./port.js')(app);
	require('./socket.js')(app);

}();