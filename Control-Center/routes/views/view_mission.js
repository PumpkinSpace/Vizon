
// Import keystone
var keystone = require('keystone');
// Import the asynchronous library
var async = require('async');

// This function is called by Keystone to initialise the page data before rendering
exports.init = module.exports.init = function(req, res) {
	
	var locals = res.locals, view = new keystone.View(req, res);

	// locals.section is used to set the currently selected
	// item in the header navigation.
	locals.section = 'Missions';
	var outcome = {};
	
	// If the user is not allowed to see this mission, reroute him to the permissions page
	// else move on
	var getMissionInfo = function(callback) {
		keystone.list('Mission').model.findOne({
			'missionId' : req.params.mid
		}).exec(function(err, mission) {
			if (err) {
				return callback(err, null);
			}
			if (!(mission.authorizedUsers.indexOf(req.user._id) > -1)) {
				console.error(err);
				res.redirect('/permissions');
				outcome.mission = mission;
				return;
			} 
			outcome.mission = mission;
			return callback(null, 'done');
		});
	};

	// For the selected mission, get all TAP descriptors available 
	var getTAPDescriptors = function(callback) {
		// For the Mission
	  keystone.list('Mission').model.findOne({ missionId: req.params.mid}, '_id', function(err, mission) {
			// Find all of it's TAP descriptors
			keystone.list('TAP').model.where('missionId', mission._id).where('ID').regex(/TAP_\d+/).sort('ID')
				.select('name ID').exec(
						// If it fails
						function(err, taps) {
							if (err) {
								return callback(err, null);
							}
							// Sort by ID number
							taps.sort(function(a, b) {
								return a.toObject().ID.split('_')[1] - b.toObject().ID.split('_')[1];
							});
							// Clean up and store the data
							var tap_descs = {};
							for (var i = 0; i < taps.length; i++) {
								tap_descs[taps[i].ID] = taps[i].toObject();
							}
							outcome.tap_descs = tap_descs;
							return callback(null, 'done');
						});
					});
				
	}
	
	// For the selected mission, get all CAP descriptors available
	var getCAPDescriptors = function(callback) {
		// For the selected mission
		keystone.list('Mission').model.findOne({ missionId: req.params.mid}, '_id', function(err, mission) {
			// Find all of the CAP descriptors
			keystone.list('CAP').model.where('missionId', mission._id).where('ID').regex(/CAP_\d+/).sort('ID')
				.exec(
						// If there's an error
						function(err, caps) {
							if (err) {
								return callback(err, null);
							}
							// Sort by ID Number
							caps.sort(function(a, b) {
								return a.toObject().ID.split('_')[1] - b.toObject().ID.split('_')[1];
							});
							// Clean up and store the data
							for (var i = 0; i < caps.length; i++) {
								caps[i] = caps[i].toObject();
								caps[i].header = outcome.mission.CAPHeader;
							}
							outcome.cap_descs = caps;

							return callback(null, 'done');
						});
				});
	}

	// Once all the above has completed, render the page
	function asyncFinally(err, results) {
		view.render('view_mission', {
			data : outcome
		});
	}
	
	// Call all of the above functions in parallel
	async.parallel([getCAPDescriptors, getMissionInfo, getTAPDescriptors ], asyncFinally);
};


exports.tap = function(req, res) {
	
	// Call once the rest of the script is done
	function tapFinally(err, results) {
		var output = {};
		for (var i = 0; i < results.length; i++) {
			if (results[i]) { // filters out a null result
				output[results[i]._t.split('_')[1]] = results[i];
			} 
		}
		res.send(output);
	}
	
	// This code seems a little redundant.  Could it be accomplished in just one db call?
	// If we're asking for all TAPs e.g. first loading the page
	if (req.params.t === 'all') {
		// Get all the most recent TAPs logged for this mission
		keystone.db.models('TAPlog').distinct('_t', {
			'h.mid' : req.params.mid
		}).sort({
			'_t' : 1
		}).exec(function(err, taps) {
			// For each tap in taps
			async.map(taps, function(tap, callback) {
				// Get the most recent tap logged for each tap
				keystone.db.models('TAPlog').findOne({
					'h.mid' : req.params.mid,
					'_t' : req.params.mid + '-TAP_' + tap
				}).sort({
					'h.Sequence Number' : -1
				}).exec(function(err, doc) {
					callback(null, doc);
				});
			}, tapFinally);
		});
	} else {
		var taplist = req.params.t;
		async.map(taplist, function(tap, callback) {
			keystone.db.models[req.params.mid + '-TAP_' + tap].findOne({'_t': req.params.mid + '-TAP_' + tap})
					.sort({
						'h.Sequence Number' : -1
					}).exec(function(err, doc) {
						callback(null, doc);
					});
		}, tapFinally);
	}
};


// If a new cap is sent to the GS from the page, we enter here and go through all the 
// steps to create a new CAP
exports.cap = function(req, res, next) {
	function findTAP() {
		var outcome = {};
		
		// Get the most recent sequence number for any CAP
		function getNextCAPSeq(callback) {
			keystone.db.models.CAPlog.findOne({
				'h.mid' : parseInt(req.params.mid)
			}, {}, {
				sort : {
					'h.Sequence Number' : -1
				}
			}).exec(function(err, cap) {
				if (err) {
					return callback(err, null);
				}
				outcome.s = (cap ? cap.toObject().h.s + 1 : 1);
				return callback(null, 'done');
			});
		}
		
		// Get the SNAP time on the most recent CAP
		function getLastTAPSNAP(callback) {
			keystone.db.models.TAPlog.findOne({
				'h.mid' : parseInt(req.params.mid)
			}, {}, {
				sort : {
					'h.Sequence Number' : -1
				}
			}).exec(
					function(err, tap) {
						if (err) {
							return callback(err, null);
						}
						// If a tap was found use the execution time, else use 0
						outcome.xt_snap = (tap ? tap
								.getNewSNAPTime(req.body.cap.h.xt) : 0);
						return callback(null, 'done');
					});
		}
		
		// Once the above two functions have run, log the new CAP
		function asyncFinally(err, results) {
			if (err) {
				console.log(err);
			}
			return logCAP(outcome);
		}
		async.parallel([ getNextCAPSeq, getLastTAPSNAP ], asyncFinally);
	}
	
	/* Function: logCAP
	 * -------------------
	 * logCap logs a new CAP into the database with the appropriate sequence number and
	 * execution time defined in newdata
	 */
	function logCAP(newdata) {
		var cap = req.body.cap;
		cap.h.s = newdata.s;
		cap.h["CAP ID"] = cap.h.t;
		cap.h["Sequence Number"] = newdata.s;
		cap.h["Execution Time"] = newdata.xt_snap;
		cap.h.mid = parseInt(req.params.mid);
		keystone.db.models[req.params.mid + '-CAP_' + cap.h.t].create(cap,
			function(err, newcap) {
				if (err) {
					console.log(err);
				}
			});
	}
	findTAP();
};
