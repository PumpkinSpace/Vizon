var keystone = require('keystone');

exports = module.exports = function(req, res) {

	var locals = res.locals,
		view = new keystone.View(req, res);

	// locals.section is used to set the currently selected
	// item in the header navigation.
	view.query('missions', keystone.list('Mission').model.find().where('authorizedUsers').equals(req.user));
	locals.section = 'missions';
	
	console.log(locals);
	// Render the view
	view.render('missions', {title: 'Missions'});
};