// Simulate config options from your production environment by
// customising the .env file in your project's root folder.
require('dotenv').load();

// Require keystone
var keystone = require('keystone'),
    mongoose = require('mongoose'),
    keystone = require('keystone').connect(mongoose);

// Initialise Keystone with your project's configuration.
// See http://keystonejs.com/guide/config for available options
// and documentation.

keystone.init({

	'name': 'Vizon II',
	'brand': 'Vizon II',

	'less': 'public',
	'static': 'public',
	'favicon': 'public/favicon.ico',

	'views': 'templates/views',
	'view engine': 'jade',

	'emails': 'templates/emails',

	'auto update': true,

	'session': true,
	'auth': true,
	'user model': 'User',
	'cookie secret': 'SM&Ii<dVc-DfOxT_/~OkvVrH"$T:38mbVb$SK<7+lV1O+[RvN8bx?J&0bgs2f}+{',

	'google api key': process.env.GOOGLE_BROWSER_KEY

});

// Load your project's Models

keystone.import('models');

// Setup common locals for your templates. The following are required for the
// bundled templates and layouts. Any runtime locals (that should be set uniquely
// for each request) should be added to ./routes/middleware.js

keystone.set('locals', {
	_: require('underscore'),
	env: keystone.get('env'),
	utils: keystone.utils,
	editable: keystone.content.editable,
	js: 'javascript:;',
	google_api_key: keystone.get('google api key')
});

// Load your project's Routes

keystone.set('routes', require('./routes'));
keystone.set('mandrill api key', process.env.MANDRILL_API_KEY);
keystone.set('mandrill username', process.env.MANDRILL_USER);
// Setup common locals for your emails. The following are required by Keystone's
// default email templates, you may remove them if you're using your own.

keystone.set('email locals', {
	logo_src: '/images/logo-email.gif',
	logo_width: 194,
	logo_height: 76,
	theme: {
		email_bg: '#f9f9f9',
		link_color: '#2697de',
		buttons: {
			color: '#fff',
			background_color: '#2697de',
			border_color: '#1a7cb7'
		}
	}
});

// Setup replacement rules for emails, to automate the handling of differences
// between development a production.

// Be sure to update this rule to include your site's actual domain, and add
// other rules your email templates require.

keystone.set('email rules', [{
	find: '/images/',
	replace: (keystone.get('env') == 'production') ? 'http://www.vizon.us/images/' : 'http://localhost:3000/images/'
}, {
	find: '/keystone/',
	replace: (keystone.get('env') == 'production') ? 'http://www.vizon.us/keystone/' : 'http://localhost:3000/keystone/'
}]);

// Load your project's email test routes

keystone.set('email tests', require('./routes/emails'));

// Configure the navigation bar in Keystone's Admin UI

keystone.set('nav', {
	'missions' : 'missions',
	'TAPs': 'taps',
	'CAPs': 'caps',
	'ground-stations' : 'ground-stations',
	'enquiries': 'enquiries',
	'users': 'users',
	'posts': ['posts','post-categories'],
	'access logs': 'access-logs',
});

// Start Keystone to connect to your database and initialise the web server

keystone.io = require('socket.io');
require('./database')(keystone);

keystone.start({
    onHttpServerCreated: function() {
        keystone.listener = keystone.io.listen(keystone.httpServer);
        require('./routes/routes-io')(keystone);
    }
});


