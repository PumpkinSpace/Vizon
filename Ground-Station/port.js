module.exports = function(app) {
	var event = app.event, com = require("serialport"), utils = require('./utils.js'), config = require('./config.js'), port = {};

	// begin port setup
	var portRetry = setTimeout(portRetryFunc, 5000);

	function portRetryFunc() {
		utils.logText('Serial port unavailable', 'ERR');
		if (config.dev) {
			com.list(function(err, ports) {
				if (config.dev)
					utils.logText('List of available ports:');
				ports.forEach(function(testport) {
					console.log('Port name: ' + testport.comName);
					console.log('Port pnpid: ' + testport.pnpId);
					console.log('Port mfgr: ' + testport.manufacturer);
					console.log();
				});
			});
		}
		portRetry = setInterval(portConnect, 5000);
		portConnect();
	}

	function portConnect() {
		com
				.list(function(err, ports) {
					ports
							.forEach(function(testport) {
								if (testport.comName == config.port.name
										|| (testport.pnpId
												.indexOf(config.port.pid) >= 0 && testport.pnpId
												.indexOf(config.port.vid) >= 0)) {
									port = new com.SerialPort(testport.comName,
											{
												baudrate : config.baud,
												parser : com.parsers.raw
											}, false)
											.on(
													'open',
													function() {
														clearInterval(portRetry);
														clearTimeout(portRetry);
														event.emit(
																'port-start',
																port);
														utils
																.logText('Serial port '
																		+ testport.comName
																		+ ' opened');
													})
											.on(
													'close',
													function(data) {
														event.emit('port-stop');
														portRetry = setTimeout(
																portRetryFunc,
																5000);
														utils
																.logText(
																		'Serial port '
																				+ testport.comName
																				+ ' closed',
																		'ERR');
													})
											.on(
													'error',
													function(data) {
														utils
																.logText(
																		'Serial port '
																				+ testport.comName
																				+ ' error: '
																				+ data,
																		'ERR');
													})
											.on(
													'data',
													function(buf) {
														utils
																.logText('Serial data read - '
																		+ buf.length
																		+ ' bytes');
														event.emit('port-read',
																buf);
													});
									port.open();
								}
							});
				});
	}

	portConnect();

	return port;
}