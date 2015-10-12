var keystone = require('keystone'),
	Types = keystone.Field.Types;
	

/**
 * TAP Model
 * ==========
 */
// Create a variable for the grid size
var gridlength = 3;

// Create a new keystone list element
var TAP = new keystone.List('TAP', {
	track: true,
	map: { name: 'TAP ID' },
	// Create the key from the ID and missionId
	autokey: { path: 'slug', from: 'ID missionId ', unique: true }
});

// Add the appropriate data buckets
TAP.add({
	ID: { type: String, required: true, match: [/TAP_\d+$/, 'ID Format must be TAP_#'] },
	missionId: { type: Types.Relationship, ref: 'Mission', index: true, many: true, initial: true , required: true},
	name: { type: String, required: true, initial: true },
	length: { type: Number, required: true, initial: true },
	package: {type: Types.Grid, required: false, initial: false, length: gridlength}
});

// Pre-save hook to make sure a TAP with the same ID doesn't exist for that specific mission
TAP.schema.pre('save', function(next) {
	tap = this;
	TAP.model.find({'ID' : tap.ID, 'missionId': {$in:tap.missionId}} , function(err, taps) {
		for (var k in taps) {
			if (!taps[k]._id.equals(tap._id)) {
				var err = new Error(tap.ID + ' already exists for one of the specified Missions');
				next(err);
			}
		}
		next();
	});
});

// Pre-save hook to make sure TAP package data is properly formatted
TAP.schema.pre('save', function(next) {
	this.package.forEach( function( entry, index ) {
		// Make sure there are no commas in the package entries
		var fields = entry.split(',');
		if ( fields.length > gridlength ) {
			var err = new Error('No commas are allowed in grid entries.');
			next(err);
		}
		// Make sure the 2nd element is a number
		if ( !/^-?\d*$/.test(fields[1]) ) {
			var err = new Error('Package, Line ' + (index+1) + ', 2nd Entry: ' + ' \"' + fields[1] + '\" is not an integer');
			next(err);
		}
		// Make sure the conversion type is properly formatted
		if ( fields[2] ) {
			// Regex for comma separated string of decimal numbers encased in brackets
			// E.g. [ 1, 2.345 ,5.43, 0.0] Will pass
			var arrayregex = /^\[\s*-?\d+\.?(?=\d)\d*\s*(;\s*-?\d+\.?(?=\d)\d*\s*)*\]$/;
			switch ( true ) 
			{
				case fields[2] == 'hex':
				case fields[2] == 'string':
				case fields[2] == 'snap':
				case arrayregex.test(fields[2]):
					break;
				default:
					var err = new Error('Package, Line ' + (index+1) + ', 3rd Entry: ' + ' \"' + fields[2] + '\" is not a supported conversion type.  Please see documentation for conversion type definitions.');
					next(err);
					break;
			}
		}
	});
	next();
});

// Post-save hook to update the specific mongo schema of this TAP
TAP.schema.post('save', function(tap) {
	TAP.model.populate(tap, 'missionId', function(err, data) {
		data = data.toObject();
		for (var k in data.missionId) {
			delete keystone.mongoose.connection.models[data.missionId[k].missionId + '-' + data.ID];
		}
		for (var i in data.missionId) {
			keystone.mongoose.connection.funcs.loadPacketModel(data.missionId[i].missionId + '-' + data.ID);
		}
	});
});

function validator (val, callback) {
	console.log(val);
	callback(true);
}

TAP.schema.path('missionId').validate( validator, 'validation of `{PATH}` failed with value `{VALUE}`');

TAP.defaultColumns = 'ID, name, length, missionId|20%';
TAP.register();
