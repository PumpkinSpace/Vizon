/**
 * This file is where you define your application routes and controllers.
 * 
 * Start by including the middleware you want to run for every request; you can
 * attach middleware to the pre('routes') and pre('render') events.
 * 
 * For simplicity, the default setup for route controllers is for each to be in
 * its own file, and we import all the files in the /routes/views directory.
 * 
 * Each of these files is a route controller, and is responsible for all the
 * processing that needs to happen for the route (e.g. loading data, handling
 * form submissions, rendering the view template, etc).
 * 
 * Bind each route pattern your application should respond to in the function
 * that is exported from this module, following the examples below.
 * 
 * See the Express application routing documentation for more information:
 * http://expressjs.com/api.html#app.VERB
 */

var _ = require('underscore'), keystone = require('keystone'), middleware = require('./middleware'), importRoutes = keystone
		.importer(__dirname);

// Common Middleware
keystone.pre('routes', middleware.initLocals);
keystone.pre('render', middleware.flashMessages);

// Import Route Controllers
var routes = {
	views : importRoutes('./views')
};

// Setup Route Bindings
exports = module.exports = function(app) {

	// Views
	app.get('/', routes.views.index);
	app.get('/blog/:category?', routes.views.blog);
	app.get('/blog/post/:post', routes.views.post);
	app.all('/contact', routes.views.contact);

	app.get('/space', routes.views.space);
	app.get('/graph', middleware.requireUser, routes.views.graph);
	app.get('/viz', middleware.requireUser, routes.views.graph);

	app.get('/mission', middleware.requireUser, routes.views.missions);
	app.get('/missions', middleware.requireUser, routes.views.missions);

	app.get('/gs', middleware.requireUser, routes.views.ground_stations);
	app.get('/ground-stations', middleware.requireUser,
			routes.views.ground_stations);

	app.all('/download', middleware.requireUser, routes.views.download);
	app.get('/about', routes.views.about);
	app.get('/getting-started', routes.views.getting_started);
	app.get('/how-vizon-works', routes.views.how_vizon_works);
	app.get('/faq', routes.views.faq);
	app.get('/partnerships', routes.views.partnerships);
	app.get('/permissions', routes.views.permissions);

	// ':' allows the mid and t variables to get passed on as req.params.mid/t
	app.get('/mission/:mid', routes.views.view_mission.init);
	app.get('/mission/:mid/tap/:t/', routes.views.view_mission.tap);
	app.post('/mission/:mid/cap/', routes.views.view_mission.cap);
	app.get('/gs/:ground_station', routes.views.view_ground_station);

	app.all('/signup', routes.views.session.signup);
	app.all('/signin', routes.views.session.signin);
	app.all('/forgot-password', routes.views.session['forgot-password']);
	app.all('/reset-password/:key', routes.views.session['reset-password']);
	app.get('/signout', routes.views.session.signout);

	// NOTE: To protect a route so that only admins can see it, use the
	// requireUser middleware:
	// app.get('/protected', middleware.requireUser, routes.views.protected);

};
