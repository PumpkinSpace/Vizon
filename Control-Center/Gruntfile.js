'use strict()';

var config = {
	port : 80
};

module.exports = function(grunt) {

	// Load grunt tasks automatically
	require('load-grunt-tasks')(grunt);

	// Time how long tasks take. Can help when optimizing build times
	require('time-grunt')(grunt);

	// Project configuration.
	grunt.initConfig({
		pkg : grunt.file.readJSON('package.json'),
		express : {
			options : {
				port : config.port
			},
			dev : {
				options : {
					script : 'vizon.js',
					debug : true
				}
			}
		},
//		browserify : {
//			mission : {
//				src : [ './public/js/view_missions.js' ],
//				dest : './public/js/viewmissionbundle.js',
//			},
//		},
		browserify: {
			'./public/js/viewmissionbundle.js': ['./public/js/view_missions.js']
		},
		jshint : {
			options : {
				reporter : require('jshint-stylish'),
				force : true
			},
			all : [ 'routes/**/*.js', 'models/**/*.js' ],
			server : [ './vizon.js' ]
		},

		concurrent : {
			dev : {
				tasks : [ 'nodemon', 'node-inspector', 'watch' ],
				options : {
					logConcurrentOutput : true
				}
			}
		},

		'node-inspector' : {
			custom : {
				options : {
					'web-host' : 'localhost'
				}
			}
		},

		nodemon : {
			debug : {
				script : 'vizon.js',
				options : {
					nodeArgs : [ '--debug' ],
					env : {
						port : config.port
					}
				}
			}
		},
		
		forever: {
			server: {
				options: {
					index: 'vizon.js',
					logDir: 'logs'
				}
			},
		},

		watch : {
			js : {
				files : [ 'model/**/*.js', 'routes/**/*.js' ],
				tasks : [ 'jshint:all' ]
			},
			express : {
				files : [ 'vizon.js', 'public/js/lib/**/*.{js,json}' ],
				tasks : [ 'jshint:server', 'concurrent:dev' ]
			},
			livereload : {
				files : [ 'public/styles/**/*.css', 'public/styles/**/*.less',
						'templates/**/*.jade',
						'node_modules/keystone/templates/**/*.jade' ],
				options : {
					livereload : true
				}
			}
		}
	});

	// load jshint
	grunt.registerTask('lint', function(target) {
		grunt.task.run([ 'jshint' ]);
	});
	
	grunt.registerTask('autorestart', function(target) {
		grunt.task.run([ 'forever:server:start' ]);
	});
	
	// compile(?) view_mission javascript
	grunt.registerTask('ify', function(target) {
		grunt.task.run(['browserify']);
	});
	// will start server without arguments
	grunt.registerTask('default', [ 'serve' ]);

	// default option to connect server
	grunt.registerTask('serve', function(target) {
		grunt.task.run([ 'jshint', 'ify', 'concurrent:dev' ]);
	});

	grunt
			.registerTask(
					'server',
					function() {
						grunt.log
								.warn('The `server` task has been deprecated. Use `grunt serve` to start a server.');
						grunt.task.run([ 'serve:' + target ]);
					});

};
