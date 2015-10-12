var fs = require('fs');
var config = {

	production : {
		gsid : '52749a447a7383724b912ec2',
		key : '1234567890abcdef',
		cc : {
			uri : 'https://vizon.us/gs',
			options : {
				'auto connect' : false
			}
		},
		port : {
			name : 'COM13', // '/dev/tty-usbserial1'
			pid : 'PID_F020',
			vid : 'VID_0403',
			baud : 9600
		},
		ssl : {
		//possible client cert authentication. does not work with websockets atm
		//cert: fs.readFileSync('./ssl/client.crt'),
		//key: fs.readFileSync('./ssl/client.pem'),
		//ca: fs.readFileSync('./ssl/ca.crt')
		}
	},

	development : {
		gsid : '52749a447a7383724b912ec2',
		key : '1234567890abcdef',
		cc : {
			uri : 'http://vizon.us/gs',
			options : {
				'auto connect' : false
			}
		},
		port : {
			name : 'COM13', // '/dev/tty-usbserial1'
			pid : 'PID_F020',
			vid : 'VID_0403',
			baud : 9600
		},
		ssl : {
		//possible client cert authentication. does not work with websockets atm
		//cert: fs.readFileSync('./ssl/client.crt'),
		//key: fs.readFileSync('./ssl/client.pem'),
		//ca: fs.readFileSync('./ssl/ca.crt')
		}
	}

};

var env = (process.env.NODE_ENV == 'production' ? 'production' : 'development');
for ( var k in config[env])
	exports[k] = config[env][k];
exports.prod = (env == 'production'); // set boolean flags for convenience
exports.dev = !(exports.prod);
exports.env = env;
