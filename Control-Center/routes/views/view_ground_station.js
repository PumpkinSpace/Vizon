var keystone = require('keystone');
var GroundStation = keystone.list('GroundStation').model;

exports = module.exports = function(req, res) {

	var locals = res.locals, view = new keystone.View(req, res);

	// locals.section is used to set the currently selected
	// item in the header navigation.
	locals.section = 'GroundStation';

	var gs_slug = req.params.ground_station;
	GroundStation.findOne({slug : gs_slug}).exec(function(err, ground_station) {
		if (err || !ground_station) {
			console.error(err);
			//res.redirect('errors/404');
			//next(err);
			//return;
		}
		console.log(view);
		/*else if (!(ground_station.AuthorizedUsers.indexOf(req.user._id) > -1)) {
			console.error(err);
			res.redirect('/permissions');
			//next(err);
			return;
		}*/
		view.render('view_ground_station', {
			ground_station : ground_station
		});
	});
};
