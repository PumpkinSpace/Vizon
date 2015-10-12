var keystone = require('keystone'),
	Types = keystone.Field.Types;

/**
 * User Model
 * ==========
 */

var User = new keystone.List('User');

User.add({
	name: { type: Types.Name, required: true, index: true },
	title : {type : String},
	organization : {type : String},
	email: { type: Types.Email, initial: true, required: true, index: true },
	phone : {type : String},
	password: { type: Types.Password, initial: true, required: true },
	resetPasswordKey: {type: String, hidden: true},
}, 'Permissions', {
	isAdmin: { type: Boolean, label: 'Can access Keystone', index: true },
	isSuper: { type: Boolean, label: 'SuperUser', index: true, noedit: true },
	
});

// Provide access to Keystone
User.schema.virtual('canAccessKeystone').get(function() {
	return this.isAdmin;
});
/*******************************************************************************
 * Methods
 */

User.schema.methods.resetPassword = function(callback) {

	var user = this;

	user.resetPasswordKey = keystone.utils.randomString([ 16, 24 ]);

	user.save(function(err) {

		if (err)
			return callback(err);

		new keystone.Email('forgotten-password').send({
			host : "vizon.us",
			user : user,
			link : '/reset-password/' + user.resetPasswordKey,
			subject : 'Reset Vizon Password',
			to : user.email,
			from : {
				name : 'admin',
				email : 'admin@vizon.us'
			}
		}, callback);

	});

};

/**
 * Relationships
 */

User.relationship({ ref: 'Post', path: 'author' });


/**
 * Registration
 */

User.defaultColumns = 'name, email, isAdmin';
User.register();
