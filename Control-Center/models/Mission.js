var keystone = require('keystone'),
	Types = keystone.Field.Types;

/**
 * Mission Model
 * ==========
 */
 
// Define variables upfront for how many fields to show in CAP and TAP headers
var tapgridlength = 3;
var capgridlength = 5;

// Create a new keyston list item
var Mission = new keystone.List('Mission', {
	track: true,
	map: { name: 'missionId' },
	autokey: { path: 'slug', from: 'missionId', unique: true }
});

// Add the necessary fields
Mission.add({
	missionId: { type: String, required: true, initial: true, match: [/^\d+$/, 'ID Format must be ###']},
	name: { type: String, required: false },
	authorizedUsers: { type: Types.Relationship, ref: 'User', index: true, many: true},
	TAPHeader: {type: Types.Grid, required: false, initial: false, length: tapgridlength},
	CAPHeader: {type: Types.Grid, required: false, initial: false, length: capgridlength}
});

// Add views to the bottom of the page to show all the TAPs/CAPs associated with this mission
Mission.relationship({ path: 'taps', ref: 'TAP', refPath: 'missionId'});
Mission.relationship({ path: 'caps', ref: 'CAP', refPath: 'missionId'});

// Implement a pre-save hook to check that all the data looks good before you can save it
Mission.schema.pre('save', function(next) {
	// For all fields in the TAPheader
	this.TAPHeader.forEach( function( entry, index ) {
		// Make sure there are no extra commas in the data
		var fields = entry.split(',');
		if ( fields.length > tapgridlength ) {
			var err = new Error('No commas are allowed in grid entries.');
			next(err);
		}
		// Make sure the length is an integer
		if ( !/^\d*$/.test(fields[1]) ) {
			var err = new Error('TAPHeader, Line ' + (index+1) + ', 2nd Entry: ' + ' \"' + fields[1] + '\" is not an integer');
			next(err);
		}
		// Make sure the conversion type is of supported type
		if ( fields[2] ) {
			// Regex for comma separated string of decimal numbers encased in brackets
			// E.g. [ 1, 2.345 ,5.43, 0.0] Will pass
			var arrayregex = /^\[\s*\d+\.?(?=\d)\d*\s*(;\s*\d+\.?(?=\d)\d*\s*)*\]$/;
			switch ( true ) 
			{
				case fields[2] == 'hex':
				case fields[2] == 'string':
				case fields[2] == 'snap':
				case arrayregex.test(fields[2]):
					break;
				default:
					var err = new Error('TAPHeader, Line ' + (index+1) + ', 3rd Entry: ' + ' \"' + fields[2] + '\" is not a supported conversion type.  Please see documentation for conversion type definitions.');
					next(err);
					break;
			}
		}
	});
	next();
});

// Pre-save hook to check for proper formatting in the CAP header
Mission.schema.pre('save', function(next) {
	this.CAPHeader.forEach( function( entry, index ) {
		// Make sure there are no commas in the data fields
		var fields = entry.split(',');
		if ( fields.length > capgridlength ) {
			var err = new Error('No commas are allowed in grid entries.');
			next(err);
		}
		// Make sure 2nd grid input is an integer
		if ( !/^\d*$/.test(fields[1]) ) { 
			var err = new Error('CAPHeader, Line ' + (index+1) + ', 2nd Entry: ' + ' \"' + fields[1] + '\" is not an integer');
			next(err);
		}
		// Mae sure 3rd grid entry is a supported data type
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
					var err = new Error('CAPHeader, Line ' + (index+1) + ', 3rd Entry: ' + ' \"' + fields[2] + '\" is not a supported data type.  Please see documentation for data type definitions.');
					next(err);
					break;
			}
		}
		// Check that 4th entry is supported conversion type
		if ( fields[3] ) {
			switch ( true ) 
			{
				case fields[3] == 'snap':
					break;
				default:
					var err = new Error('CAPHeader, Line ' + (index+1) + ', 4th Entry: ' + ' \"' + fields[3] + '\" is not a supported conversion type.  Please see documentation for conversion type definitions.');
					next(err);
					break;
			}
		}
	});
	next();
});

// Post-save hook to update all the specific mongoose schema to match the new data
Mission.schema.post('save', function(mission) {
	// For all stored TAPs with this mission, update them to the new header
	keystone.list('TAP').model.where('missionId', mission._id).exec( function(err, taps) {
		for (var k in taps) {
			taps[k] = taps[k].toObject();
			delete keystone.mongoose.connection.models[mission.missionId + '-' + taps[k].ID];
		}
		if ( taps[0] )
			keystone.mongoose.connection.funcs.loadPacketModel(mission.missionId + '-' + taps[0].ID.split('_')[0]);
	});
	// For all stored CAPs with this mission, update them to the new header
	keystone.list('CAP').model.where('missionId', mission._id).exec( function(err, caps) {
		for (var k in caps) {
			caps[k] = caps[k].toObject();
			delete keystone.mongoose.connection.models[mission.missionId + '-' + caps[k].ID];
		}
		if ( caps[0] ) 
			keystone.mongoose.connection.funcs.loadPacketModel(mission.missionId + '-' + caps[0].ID.split('_')[0]);
	});
});

Mission.schema.methods.taps = function(cb){
  return keystone.list('TAP').model.find()
    .where('missionId', this.id )
    .exec(cb);
};

Mission.defaultColumns = 'missionId|20%, name|20%, authorizedUsers';
Mission.register();
