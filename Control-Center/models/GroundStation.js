var keystone = require('keystone'),
	Types = keystone.Field.Types;

/**
 * Mission Model
 * ==========
 */

var GroundStation = new keystone.List('GroundStation', {
	track: true,
	map: { name: 'groundStationId' },
	autokey: { path: 'slug', from: 'groundStationId', unique: true }
});

GroundStation.add({
	groundStationId: { type: String, required: true, initial: true},
	name: { type: String},
	key: { type: String },
	isActive: { type: Boolean },
	authorizedUsers: { type: Types.Relationship, ref: 'User', index: true, many: true},
	location: {
		lattitude: { type: String},
		longitude: { type: String},
		elevation:{ type: String },
	},
	content: {
		summary: { type: Types.Html, wysiwyg: true, height: 150 },
		extended: { type: Types.Html, wysiwyg: true, height: 400 }
	},
});

GroundStation.schema.virtual('content.full').get(function() {
	return this.content.extended || this.content.brief;
});

GroundStation.defaultColumns = 'groundStationId|20%, name|20%, key|20%';
GroundStation.register();
