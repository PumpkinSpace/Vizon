module.exports = function(ks){
  
  var app = ks.express()
  	,	mongoose = ks.mongoose
    , extend = require('mongoose-schema-extend')
    , config = require('./routes/config')
    , utils = require('./routes/utils')
    , db = ks.db = mongoose.connection; // Add the mongoose connection as a variable that keystone carries around

  // Use the mongoose connection created by keystone.
  // attach basic event handlers to the connection for logging purposes
  db.mongoose = mongoose;
  db.on('error', function dberror(){
    utils.logText('Database ' + 'error'.red, 'ERR'.red);
  });
  db.on('close', function dberror(){
    utils.logText('Database ' + 'closed'.yellow, 'ERR'.red);
  });
  db.on('open', function dberror(){
    utils.logText('Database ' + 'opened'.green);
  });
  db.once('open', function callback () {});
  
  // create namespace placeholder objects for utility functions and dynamically created schemas and models
  db.funcs = {};
  db.schemas = {};
  
  // determine SNAP time (seconds since 0000h 1/1/2000 UTC). if a reference
  // UTC millisecond value is not given, assume the current time
  function getNewSNAPTime(msUTC) {
    if(!msUTC) msUTC = (new Date()).valueOf();
    var obj = this.toObject({getters: false});
    return (obj.h.Timestamp ? obj.h.Timestamp : obj.h["Execution Time"]) + Math.floor((msUTC - (new Date(this.d)).valueOf())/1000);
  }
  
  /* Function: setupTAPSchemaLiteral
   * -------------------------------
   * this function dynamically crates the literal for a given TAP descriptor property.
   * the property literal consists of a type and a getter function. the type is set
   * according to a conversion type if it exists. the getter function performs on-the-fly
   * conversions, formatting, etc. most importantly, the output of the getter takes the
   * original stored value and returns an object literal that can include the property
   * name, unit string, and formatted/converted value. this is chosen as default get action
   * for all TAPS because TAPs are most often fetched for display on the web rather than 
   * for server-side manipulation.  
   */
  function setupTAPSchemaLiteral(desc_prop) {
  	var desc = desc_prop.split(',');  // Split the comma separated string into array
    function getValueProperty(val) {
      var literal = {v: val}
      if(desc[0]) literal.n = desc[0];
      //if(desc_prop.u) literal.u = desc_prop.u;		// Currently units are not supported
      if ( desc[2] ) {
				/*if( Number(desc[2]) ) { // If we have more than one conversion definition: it's an array
        	literal.v = Number(desc[2]); // the first element of conv is the linear shift
        	for(var i = 3; i < desc.length; i++) { // for the rest of the elements in conv
          	literal.v += Number(desc[i]) * Math.pow(val, i-2) // determine the power and constant
        	}
      	} */
      	if ( desc[2][0] == '[' ) {
      		var numberarr = desc[2].slice(1, desc[2].length-1).split(';');
      		literal.v = Number(numberarr[0]);
      		for ( var i = 1; i < numberarr.length; i++ ) {
      			literal.v += Number(numberarr[i]) * Math.pow(val, i);
      		}
      	} else if(desc[2] == 'hex') { // hex string
       		literal.v = '0x' + literal.v;
      	} else if(desc[2] == 'snap') { // SNAP time
        	literal.v = new Date((literal.v * 1000) + (new Date('Jan 1, 2000')).getTime());
      	}
   		} 
      return literal;
    }
    var propertyliteral = { type: Number, get: getValueProperty }; // create new schema property literal for plain number
    if (desc.length > 2) {
			if(desc[2] == 'string' || desc[2] == 'hex') // hex string or regular string
        propertyliteral.type = String;
    }  
		return propertyliteral;
  }
  
  /* Function: setupCAPSSchemaLiteral
   * ----------------------------------
   * this function dynamically crates the literal for a given CAP descriptor property.
   * the property literal consists of a type, and for particular conversion types, a getter.
   * the only conversion type for which a getter is defined now is SNAP time. this function
   * converts a stored value of 0 into the current SNAP time.
   */
  function setupCAPSchemaLiteral(desc_prop) {
  	var desc = desc_prop.split(',');  // Split the comma separated string into array
    var propertyliteral = { type: Number }; // create new schema property literal for plain number
    if( desc[3] && desc[3] == 'snap') {  // snap time
      propertyliteral.get = function(val) {
        var output = val;
        if((val == 0)) { //&& ( desc[3] && (desc[3].trim() == 'snapnow'))) {// secondary conversion type
        //  output = Math.floor(((new Date()).getTime() - (new Date('Jan 1, 2000')).getTime())/1000);
        //}
        //else if(val == 0) {
          output = this.getNewSNAPTime();
        }
        return output;
      }
    }	
    return propertyliteral;
  }
    
  // Set up a schema for a basic TAP.  Model name is 'TAPlog'.  
  // All specific schemas will extend on this and be distinguished by discriminatorKey
  db.schemas.TAP = mongoose.Schema({}, 
  	{ collection : 'taplog', versionKey: false, id: false, discriminatorKey : '_t' });
  db.schemas.TAP.virtual('d').get(function(){ return this._id.getTimestamp(); });
  db.schemas.TAP.methods.getNewSNAPTime = getNewSNAPTime;
  db.schemas.TAP.set('toObject', { getters: true, virtuals: true });
  db.schemas.TAP.set('toJSON', { getters: true, virtuals: true });
  db.model('TAPlog', db.schemas.TAP);
  
  // Set up a schema for a basic CAP.  Model name is 'CAPlog'.  
  // All specific schemas will extend on this and be distinguished by discriminatorKey
  db.schemas.CAP = mongoose.Schema({ 
    td: { type: Date } // transmit date
  }, { collection : 'caplog', versionKey: false, id: false, discriminatorKey : '_t' });
  db.schemas.CAP.virtual('d').get(function(){ return this._id.getTimestamp(); });
  db.schemas.CAP.methods.getNewSNAPTime = getNewSNAPTime;
  db.schemas.CAP.set('toObject', { getters: true, virtuals: true });
  db.schemas.CAP.set('toJSON', { getters: true, virtuals: true });
  db.model('CAPlog', db.schemas.CAP);
  
  
  /* Function loadPacketDescriptors
   * ---------------------------------
   * this database function returns the descriptor for a given packet descriptor typeid. 
   * it is retrieved from the database and passed to a callback. 
	 * if no descriptor typeid is provided, the default regex match will retrieve
   * all possible descriptors from the database.
   * Descriptors are expected to be of the following form: MID-TAP/CAP_ID#
   * e.g. Mission 316, TAP_1 --> 316-TAP_1.
   * To find all TAPs for a given mission the argument can be MID-TAP/CAP
   * e.g. all CAPs for mission 318 --> 318-CAP
   */
  db.funcs.loadPacketDescriptors = function(desc_typeid, callback){
    var regex = /.+_\d+/; // match all TAP/CAP_ID
    if(typeof desc_typeid === 'function') callback = desc_typeid // If no desc, but first argument was a callback
    else if(desc_typeid) {  // If desc_typeid was defined
    	var tapid = desc_typeid.split('-')[1];  // Remove the mission number from the string
    	if ( !tapid.split('_')[1] )  // If there is no ID# defined
    		tapid += '_\\d+';  // Loosen up the regex
			regex = new RegExp('^' + tapid + '$') // create a regex to search for the model
			var tq = ks.list(tapid.split('_')[0]).model.where('ID').regex(regex).sort('ID').populate('missionId', null, {missionId: desc_typeid.split('-')[0]} );
    	tq.exec(callback); // Execute the callback
    } else { // If no desc_typeid
    	// Find all CAP and TAP descriptors.
    	var tq = ks.list('TAP').model.where('ID').regex(regex).sort('ID').populate('missionId');
    	var cq = ks.list('CAP').model.where('ID').regex(regex).sort('ID').populate('missionId');
    	cq.exec(callback); // Execute the callbacks
    	tq.exec(callback);
		}
  }
  
  /* Function: loadPacketModel
   * ---------------------------
   * this database function loads a packet model based on a descriptor typeid. if the model
   * for the typeid is cached, that model is passed to the callback. otherwise, the above 
   * loadPacketDescriptors() function is called on the typeid with a callback to generate
   * a packet model from the resulting array of descriptors. TAP and CAP models are processed
   * slightly differently in terms of schema literal generation for each field descriptor,
   * but both consist of the same general schema structure extended from the base TAP/CAP
   * schemas above. the final models are cached for future use.
 	 */
 	db.funcs.loadPacketModel = function(desc_typeid, callback) {
    if(db.models[desc_typeid]) callback(db.model(desc_typeid)) // if the descriptor typeid is already in the cache, use it
    else {
      db.funcs.loadPacketDescriptors(desc_typeid, function (err, descriptors) { // fetch regex-matched descriptors from the database
        if (err) {
          utils.log(err);
        }
        else {
          for(var k in descriptors) { // for each retrieved descriptor, even if 1
            var descriptor = descriptors[k].toObject(); // call toObject to only get "descriptor elements", not the extra Mongoose stuff
						for (var m in descriptor.missionId) { // Each mission gets its own descriptor in case headers are different
							var mission = descriptor.missionId[m];
							// Create a distinction if this descriptor is a CAP or a TAP
							var isTAP = /^TAP_.*/.test(descriptor.ID);
							var isCAP = /^CAP_.*/.test(descriptor.ID);
							// Create literals to build on
							var headerliteral = { mid: { type: Number } };
							var payloadliteral = {}
							var namesliteral = {}
							// If CAP/TAP pull the correct header from the Mission model
							var header;
							if (isTAP)
								header = mission.TAPHeader;
							else if (isCAP)
								header = mission.CAPHeader;
							// Create the literals for header entries
							for(var prop in header) {
								var entryname = header[prop].split(',')[0];
								if( entryname == 'TAP ID') continue;  // This line might be removed in future
								//else if(header[prop].split(',')[0] == 'CAP ID') continue;  // Need this line commented. Old code needed this line to work.  
								if( entryname && isTAP) // if the property is an object with a fieldname property of its own
									headerliteral[entryname] = setupTAPSchemaLiteral(header[prop]);
								else if ( entryname && isCAP) 
									headerliteral[entryname] = setupCAPSchemaLiteral(header[prop]);
							}
							for(var prop in descriptor.package) {
								entryname = descriptor.package[prop].split(',')[0];
								if ( entryname && isTAP) // if the property is an object with a fieldname property of its own
									payloadliteral[entryname] = setupTAPSchemaLiteral(descriptor.package[prop]);
								else if (entryname && isCAP)
									payloadliteral[entryname] = setupCAPSchemaLiteral(descriptor.package[prop]);
							}
							var newSchema = db.schemas[ (descriptor.ID.split('_')[0]) ].extend( { // extend the descriptor base type (TAP, CAP, etc)
								h: headerliteral,
								p: payloadliteral
							} );
							
							// Create some virtuals to make life a little easier.
							// Get the descriminatorkey
							newSchema.virtual('h.t').get(function(){ return this._t; });
							// Pull the sequence number depending on whether its a CAP or TAP
							if (isTAP) 	
								newSchema.virtual('h.s').get(function(){return parseInt(this.h["Sequence Number"].v)});
							if (isCAP)
								newSchema.virtual('h.s').get(function(){return parseInt(this.h["Sequence Number"])});
							// Make each entry in CAP/TAPlog unique based on discriminatorkey and sequence number
							newSchema.index({ '_t': 1, 'h.Sequence Number': -1 }, { unique: true });
												
							// Create the model						
							db.model(descriptor.missionId[m].missionId  + '-' + descriptor.ID, newSchema);
							// Tell the groundstation that the descriptor has changed, and that it should re-request the data
							// This line should probably be in routes-io.js and a function call to that here instead
							ks.listener.of('/gs').emit('removedesc', descriptor.missionId[m].missionId  + '-' + descriptor.ID);
							utils.logText(descriptor.missionId[m].missionId  + '-' + descriptor.ID + ' ' + descriptor.name, 'LOAD'.cyan);
						}
          }
          if(callback) callback(db.model(desc_typeid)); // return the model if available, otherwise will be undefined so make sure it's handled in callback
        }
      });
    }
  }
  // generate and cache models from all available descriptors
  db.funcs.loadPacketModel();
}
