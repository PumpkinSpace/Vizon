var keystone = require('keystone'),
	Types = keystone.Field.Types;

/**
 * CAP Model
 * ==========
 */

// Create a variable for the number of elements in a grid
var gridlength = 5;

// Create a new keystone list item
var CAP = new keystone.List('CAP', {
	track: true,
	map: { name: 'CAP ID' },
	// Set the key unique to the ID and the missionId
	autokey: { path: 'slug', from: 'ID missionId ', unique: true }
});

// Add the appropriate data buckets
CAP.add({
	ID: { type: String, required: true, match: [/CAP_\d+$/, 'ID Format must be CAP_#'] },
	missionId: { type: Types.Relationship, ref: 'Mission', index: true, many: true, initial: true , required: true},
	name: { type: String, initial : true },
	length: { type: Number, required: true, initial: true },
	package: {type: Types.Grid, initial: false, length: gridlength}
});

// Pre-save hook to ensure that there isn't a CAP with this ID linked to this mission
CAP.schema.pre('save', function(next) {
	cap = this;
	CAP.model.find({'ID' : cap.ID, 'missionId': {$in:cap.missionId}} , function(err, caps) {
		for (var k in caps) {
			if (!caps[k]._id.equals(cap._id)) {
				var err = new Error(cap.ID + ' already exists for one of the specified Missions');
				next(err);
			}
		}
		next();
	});
});

// Pre-save hook to ensure that data in the package is properly entered
CAP.schema.pre('save', function(next) {
	this.package.forEach( function( entry, index ) {
		// Make sure there are no commas
		var fields = entry.split(',');
		if ( fields.length > gridlength ) {
			var err = new Error('No commas are allowed in grid entries.');
			next(err);
		}
		// Make sure the 2nd element is a number
		if ( !/^\d*$/.test(fields[1]) ) {
			var err = new Error('Package, Line ' + (index+1) + ', 2nd Entry: ' + ' \"' + fields[1] + '\" is not an integer');
			next(err);
		}
		// Make sure the data type is properly formatted
		if ( fields[2] ) {
			// This regex looks for semicolon delimited list of key-value pairs separated by a colon
			// e.g. [ Hello:1; You:2 ] passes
			var optionregex = /^\[\s*[A-Za-z0-9_]+\s*:\s*\d+\s*(;\s*[A-Za-z0-9_]+\s*:\s*\d+\s*)*\]$/;
			switch ( true ) 
			{
				case fields[2] == 'INTERVAL':
				case fields[2] == 'CLOCK':
				case fields[2] == 'TAPS':
				case optionregex.test(fields[2]):
					break;
				default:
					var err = new Error('Package, Line ' + (index+1) + ', 3rd Entry: ' + ' \"' + fields[2] + '\" is not a supported data type.  Please see documentation for data type definitions.');
					next(err);
					break;
			}
		}
		// Make sure the conversion type is properly formatted
		if ( fields[3] ) {
			switch ( true ) 
			{
				case fields[3] == 'snap':
					break;
				default:
					var err = new Error('Package, Line ' + (index+1) + ', 4th Entry: ' + ' \"' + fields[3] + '\" is not a supported conversion type.  Please see documentation for conversion type definitions.');
					next(err);
					break;
			}
		}
	});
	next();
});

// Post-save hook to update the mongo schema for the CAP in the db
CAP.schema.post('save', function(tap) {
	CAP.model.populate(tap, 'missionId', function(err, data) {
		data = data.toObject();
		for (var k in data.missionId) {
			delete keystone.mongoose.connection.models[data.missionId[k].missionId + '-' + data.ID];
		}
		for (var i in data.missionId) {
			keystone.mongoose.connection.funcs.loadPacketModel(data.missionId[i].missionId + '-' + data.ID);
		}
	});
});

CAP.defaultColumns = 'ID, name, length, missionId|20%';
CAP.register();
