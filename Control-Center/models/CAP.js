var keystone = require('keystone'),
	Types = keystone.Field.Types;

/**
 * CAP Model
 * ==========
 */

var gridlength = 5;

var CAP = new keystone.List('CAP', {
	track: true,
	map: { name: 'ID' },
	autokey: { path: 'slug', from: 'ID missionId ', unique: true }
});

CAP.add({
	ID: { type: String, required: true, match: [/CAP_\d+$/, 'ID Format must be CAP_#'] },
	missionId: { type: Types.Relationship, ref: 'Mission', index: true, many: true, initial: true , required: true},
	name: { type: String, initial : true },
	length: { type: Number, required: true, initial: true },
	package: {type: Types.Grid, initial: false, length: gridlength}
});

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

CAP.schema.pre('save', function(next) {
	this.package.forEach( function( entry, index ) {
		var fields = entry.split(',');
		if ( fields.length > gridlength ) {
			var err = new Error('No commas are allowed in grid entries.');
			next(err);
		}
		if ( !/^\d*$/.test(fields[1]) ) { // This allows '3a' through
			var err = new Error('Package, Line ' + (index+1) + ', 2nd Entry: ' + ' \"' + fields[1] + '\" is not an integer');
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
					var err = new Error('Package, Line ' + (index+1) + ', 3rd Entry: ' + ' \"' + fields[2] + '\" is not a supported data type.  Please see documentation for data type definitions.');
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
					var err = new Error('Package, Line ' + (index+1) + ', 4th Entry: ' + ' \"' + fields[3] + '\" is not a supported conversion type.  Please see documentation for conversion type definitions.');
					next(err);
					break;
			}
		}
	});
	next();
});

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
