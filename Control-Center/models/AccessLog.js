var keystone = require('keystone'),
	Types = keystone.Field.Types;

/**
 * AccessLog Model
 * ==========
 */

var AccessLog = new keystone.List('AccessLog', {
	map: { name: 'gsid' },
	autokey: { path: 'slug', from: 'gsid', unique: true }
});

AccessLog.add({
	gsid: { type: String },
	ip: { type: String },
	auth: {type: Boolean},
});

AccessLog.schema.virtual('content.full').get(function() {
	return this.content.extended || this.content.brief;
});

AccessLog.defaultColumns = 'gsid, ip|20%, auth';
AccessLog.register();
