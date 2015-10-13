var keystone = require('keystone'),
	Types = keystone.Field.Types;

/**
 * Mission Model
 * ==========
 */
 
var tapgridlength = 3;
var capgridlength = 5;

var Mission = new keystone.List('Mission', {
	track: true,
	map: { name: 'missionId' },
	autokey: { path: 'slug', from: 'missionId', unique: true }
});

Mission.add({
	missionId: { type: String, required: true, initial: true, match: [/^\d+$/, 'ID Format must be ###']},
	name: { type: String, required: false },
	authorizedUsers: { type: Types.Relationship, ref: 'User', index: true, many: true},
	TAPHeader: {type: Types.Grid, required: false, initial: false, length: tapgridlength},
	CAPHeader: {type: Types.Grid, required: false, initial: false, length: capgridlength}
});

Mission.relationship({ path: 'taps', ref: 'TAP', refPath: 'missionId'});
Mission.relationship({ path: 'caps', ref: 'CAP', refPath: 'missionId'});

Mission.schema.pre('save', function(next) {
	this.TAPHeader.forEach( function( entry, index ) {
		var fields = entry.split(',');
		if ( fields.length > tapgridlength ) {
			var err = new Error('No commas are allowed in grid entries.');
			next(err);
		}
		if ( !/^\d*$/.test(fields[1]) ) { // This allows '3a' through
			var err = new Error('TAPHeader, Line ' + (index+1) + ', 2nd Entry: ' + ' \"' + fields[1] + '\" is not an integer');
			next(err);
		}
		if ( fields[2] ) {
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

Mission.schema.pre('save', function(next) {
	this.CAPHeader.forEach( function( entry, index ) {
		var fields = entry.split(',');
		if ( fields.length > capgridlength ) {
			var err = new Error('No commas are allowed in grid entries.');
			next(err);
		}
		if ( !/^\d*$/.test(fields[1]) ) { // This allows '3a' through
			var err = new Error('CAPHeader, Line ' + (index+1) + ', 2nd Entry: ' + ' \"' + fields[1] + '\" is not an integer');
			next(err);
		}
		if ( fields[2] ) {
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

Mission.schema.post('save', function(mission) {
	keystone.list('TAP').model.where('missionId', mission._id).exec( function(err, taps) {
		for (var k in taps) {
			taps[k] = taps[k].toObject();
			delete keystone.mongoose.connection.models[mission.missionId + '-' + taps[k].ID];
		}
		if ( taps[0] )
			keystone.mongoose.connection.funcs.loadPacketModel(mission.missionId + '-' + taps[0].ID.split('_')[0]);
	});
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
