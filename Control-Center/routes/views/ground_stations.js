var keystone = require('keystone');

exports = module.exports = function(req, res) {

	var locals = res.locals,
		view = new keystone.View(req, res);

	// locals.section is used to set the currently selected
	// item in the header navigation.
	//view.query('stations', keystone.list('GroundStation').model.find().where('authorizedUsers').equals(req.user));
	locals.section = 'Ground Station';
	// Render the view
	//console.log(view);
	//view.query('missions', keystone.list('Mission').model.find().where('authorizedUsers').equals(req.user));
	view.query('stations', keystone.list('GroundStation').model.find().where('authorizedUsers').equals(req.user));
	console.log(locals);
	view.render('ground-stations', {title: 'Ground Stations'});
};
