module.exports = function(app){

  var crypto = require('crypto'),
    async = require('async'),
    utils = require('./utils'),
    db = app.db;
  // attach namespace connection handlers to the io-enabled apps
  
	app.listener.of('/gs').on('connection', handleGSSocketAuthorization);
	app.listener.of('/web').on('connection', handleWebSocketConnection);
  
  // basic web client socket connections. only one event is implemented
	// currently.
  function handleWebSocketConnection(socket) {
    socket.on('join-mid',function(mid){
      socket.join(mid);
    });
    
    socket.on('querymissions', function() {
    	var query = app.list('Mission').model.find( {}, 'title missionId', function(err,data) {
    		socket.emit('querymissions', data);
    	});
    });
    
    socket.on('querytaps', function(data) {
    	app.list('Mission').model.findOne({ missionId: data}, '_id', function(err, mission) {
    		app.list('TAP').model.where('missionId', mission._id).exec(function(err, data) {
    			taps = [];
    			for ( var k in data ) {
    				tap = {};
  	    		tap.name = data[k].name;
  	    		tap.ID = data[k].ID;
  	    		tap.data = [];
  	    		for ( var j = 0; j < data[k].package.length; j++ ) {
  	    			tap.data.push(data[k].package[j].split(',')[0]);
  	    		}
  	    		taps.push(tap);
  	    	}
  	    taps.sort(function(a, b) {
  	    	if (a.ID > b.ID )
  	    		return 1;
  	    	if (b.ID < a.ID )
  	    		return -1;
  	    	else 
  	    		return 0;
  	    });
  	    socket.emit('querytaps', taps);
    		});
    	});
    });
    
    socket.on('querytimedata', function(tapinfo) {
      var query = db.models[tapinfo[0]].find({'_t':tapinfo[0]}).sort({'h.Sequence Number':-1}).exec(function(err, log) {
      	var data = {};
      	var series = [];
      	log.forEach( function(tap) {
      		// Change the .v thing. Obsolete now.
	        var ts = (new Date(tap.h.Timestamp.v).getTime());

		if ( tap.p[tapinfo[1]] )  
    		  series.push([ts, tap.p[tapinfo[1]].v]);
      	});
      	data.name = tapinfo[1];
      	data.series = series;
      	socket.emit('querytimedata', data);
      });
    });
  }
  
  // Begin authorization of the new groundstation socket connection.
  // When the client initiates the auth process, they will send a gsid
  // that we will use to look up the gs key for performing an hmac
  // challenge/response using random data. The connection is logged.
  function handleGSSocketAuthorization(socket) {
    socket.on('auth-initiate', function(gsid) {
      var challenge = {
        alg: 'sha512', // hash algorithm
        enc: 'base64' // hash encoding
      };
      async.parallel({
        // create a random byte buffer that will become the hmac challenge
        rand: function(callback) {
          crypto.randomBytes(256, callback);
        },
        // lookup the security key for the provided gsid
        gs: function(callback) {
          app.list("GroundStation").model.findOne({ _id:db.mongoose.Types.ObjectId(gsid)}).select('key').exec(callback);
        },
        // log the access attempt (defaults to fail, can update to pass later)
      },
      function(err, results) {
				if (err || !(results.gs && results.gs.key) ) {
          utils.logText('GS ' + ' Lookup', 'DENY'.yellow);
          socket.emit('auth-fail');
          socket.disconnect();
          return;
        } 
        challenge.data = results.rand.toString('hex');
        var answer = crypto
          .createHmac(challenge.alg, results.gs.key)
          .update(challenge.data)
          .digest(challenge.enc);
				socket.emit('auth-challenge', challenge, function(response) {
					if(response != answer) {
						socket.emit('auth-fail');
						socket.disconnect();
						utils.logText('GS ' + ' Challenge', 'DENY'.yellow);
						return;
					}
          socket.gs = results.gs;
          // socket.accesslog = results.log;
          handleGSSocketConnection(socket);
          utils.logText('GS ', 'AUTH'.green);
          socket.emit('auth-pass');
          // results.log.auth = true;
          // results.log.save();
        });
      });
    });
  }
  
  
  function handleGSSocketConnection(socket) {
    socket.on('disconnect', function() {
      utils.logText('GS ', // socket.accesslog.gsid,
 				'DISC'.yellow);
    });
    
    socket.on('descriptor-request', function(desc_typeid, callback) {
      var data = [];
      if(typeof desc_typeid !== 'string' || desc_typeid.length <= 0) {
        utils.logText('Descriptor request invalid');
        callback(data);
        return;
      }
      utils.logText('Descriptor request for ' + desc_typeid);
      db.funcs.loadPacketDescriptors(desc_typeid, function(err,descriptors){
				for(var i in descriptors) {
					descriptors[i] = descriptors[i].toJSON(); // needed to make the object
												// purely JSON, no mongoose
												// stuff
					for (var m in descriptors[i].missionId) {
						data.push({
							l: descriptors[i].length,
							h: descriptors[i].missionId[m][descriptors[i].ID.split('_')[0] + "Header"],
							p: descriptors[i].package
						});
          }
        }
        callback(data);
      });
    });
    
    socket.on('tap', function(packet) {
      recordTAP(packet, socket);
      logPacket(packet, 'TAP', 'from GS ');
    });
  } 
  
  
  function recordTAP(tap, socket) {
  	db.funcs.loadPacketModel(tap.h.mid + "-TAP_" + tap.h["TAP ID"], function(tapmodel){
   		if(tapmodel) {
	  		tapmodel.create(tap , function (err, newtap) {
	  			console.log(err);
					if (err && err.code == 11000) { // duplicate key error
						createConfirmation(tap, tap.h.t + ' already logged'.red, socket);
					} else if(err) {
						createConfirmation(tap, tap.h.t + ' not saved - db error'.red, socket);
						utils.log(err);
					} else {
						createConfirmation(tap, newtap.h.t + ' logged'.green, socket);
						app.listener.of('/web').in(tap.h.mid).emit('new-tap', newtap._t);
						findCAPs(newtap, socket);
					}
      	});
    	} else {
      	createConfirmation(socket.accesslog.gsid, tap, tap.h.t + ' unknown'.red, socket);
    	}
    });
  }
  
  
  function findCAPs(TAPrecord, socket) {
    db.models.CAPlog.find({ 'h.mid' : TAPrecord.h.mid, 'td': null }).exec(function(err, caps){
      for(var i in caps) {
        caps[i].td = new Date();
        caps[i].save(function(err) {
          if(err) 
          console.log(err);
          });
        var cap = caps[i].toObject();
        cap = { h: cap.h, p: cap.p };
        socket.emit('cap',cap);
        logPacket(cap, 'CAP', 'to GS ');// + socket.accesslog.gsid);
      }
    });
  }
  
  
  function createConfirmation(packet, text, socket) {
    var hash = crypto.createHash('sha1').update(JSON.stringify(packet)).digest('hex');
    packet = hash.substring(0,6) + ' ' + text;
    socket.emit('info',packet);
    // logPacket(packet, 'INF', 'to GS ' + gsid);
  }
  
  function logPacket(packet, TYPE, text, hash) {
    if(!hash) hash = crypto.createHash('sha1').update(JSON.stringify(packet)).digest('hex');
    utils.log((utils.napcolors[TYPE] ? utils.napcolors[TYPE] : '') + TYPE + utils.napcolors.RST + ' ' + hash.substring(0,6) + ' ' + text, packet);
  }
  
};
