var handle = exports
  , event // placeholder that will be set to app.event on init
  , db = { descriptors: { } }
  , utils = require('./utils.js')
  , utils_gs = require('./utils-gs.js')
  , config = require('./config.js')
  , serialReadBuffer = []
	, storeLocally = true;
  ;
	// Mongoose local database
  var mongoose = require('mongoose');
  mongoose.connect('mongodb://localhost/vizongs')
  var mon = mongoose.connection;
  mon.on('error',console.error.bind(console,'connection error:'));
  mon.once('open',function callback(){
		utils.logText('DB Connection established');
  });
  
	RAPModel = mongoose.Schema({
		rap: [],
		_id: mongoose.Schema.Types.ObjectId,
	}, {versionKey: false, id: false});
	mon.model('Rap', RAPModel, 'RAPS');
 

handle.storeLocally = true;
// initialize the handler's local variables
handle.init = function(app) {
  event = app.event
    
  console.log();
  utils.logText('Ground Station starting in ' + utils.colors.warn + config.env + utils.colors.reset+ ' mode', 'INF');
}


handle.deleteDescriptor = function(desc_typeid) {
	if (db.descriptors[desc_typeid]) {
		delete db.descriptors[desc_typeid];
	}
}

// this function returns the descriptor for a given packet descriptor typeid. if the
// descriptor is not cached, it is retrieved from the server and passed to a callback.
handle.loadDescriptor = function(desc_typeid, callback) {
  if(db.descriptors[desc_typeid]) callback(db.descriptors[desc_typeid]);
  else {
    event.emit('socket-send','descriptor-request', desc_typeid, function(new_descriptors) {
      if(new_descriptors.length) {
        utils.logText('Descriptor ' + desc_typeid + ' retrieved from CC');
        for(var i in new_descriptors)
          db.descriptors[desc_typeid] = new_descriptors[i];
        callback(db.descriptors[desc_typeid]);
      } else
        utils.logText('RAP dropped - descriptor not available from CC');
    });
  }
}

// process a set of bytes that represents a complete TAP. this includes verifying
// TAP sync flags, length verification, and checksum validation. once the preliminary
// validations are performed, the correct TAP descriptor is retrieved from cache or
// requested from the control center. the TAP bytes are converted into an object according
// to the descriptor, which is finally relayed to the control center. the actual TAP byte
// conversion is handled by doRAPtoTAP().
handle.TAP = function(rapbytes, callback) {
  var rap = {};
  if(rapbytes.length < 11) return; // This should protect all indexing below
  if(rapbytes[0] != 0xAB || rapbytes[1] != 0xCD) {
    utils.logText('RAP dropped - wrong preamble', 'INF', utils.colors.warn);
    return
  }
  utils_gs.augmentChecksums(rap, rapbytes.slice(0, rapbytes.length-2)); 
  if(!utils_gs.verifyChecksums(rap, rapbytes[rapbytes.length-2], rapbytes[rapbytes.length-1])) {
    utils.logText('TAP dropped - wrong RAP checksum', 'INF', utils.colors.warn);
    return;
  }
  
	rap.rapbytes = rapbytes;
  rap.length = rapbytes[2];  // Length of TAP
  rap.to = utils_gs.bytesToNumber(rapbytes[3],rapbytes[4]);  // Converts 3, 4 into one 2 byte int
  rap.toflags = rapbytes[5];
  rap.from = utils_gs.bytesToNumber(rapbytes[6],rapbytes[7]);  // Converts 6,7 into one 2 byte int
  rap.fromflags = rapbytes[8];
  
  var tapbytes = rapbytes.slice(9,rapbytes.length-2);  // Extract the TAP data from the RAP
  
  if(tapbytes.length != rap.length) { // Rap.length was defines as length(TAP)
    utils.logText('TAP dropped - wrong length', 'INF', utils.colors.warn);
    return;
  }
  
  var desc_typeid = String(rap.from) + '-' + 'TAP_' + tapbytes[0];
  handle.loadDescriptor(desc_typeid, function(tap_desc){
    if(db.descriptors[desc_typeid])
			handle.doRAPtoTAP(rap, tapbytes, tap_desc, function(data, err) {
				if (err) {
					if (!handle.storeLocally)
						handle.storeDataLocally(data, true);
				} else {
					tap.h.mid = rap.from;
					event.emit('socket-send','tap',data);
					utils.logPacket(tap, 'TAP', 'to CC');
				}
      });
  });
  
}

// process a logical CAP object relayed from the control center. first off, the
// correct CAP descriptor is retrieved from cache or is requested from the control
// center. the CAP object is converted to a byte array according to this descriptor.
// the RAP bytes are assembled, including sync flags, length, from, to, and CAP checksums.
// the converted CAP bytes are embedded in the RAP bytes, and the final byte array is
// written out to the serial port. the actual CAP byte conversion is handled by doCAPtoRAP()
handle.CAP = function(cap, callback) {
  if(!(cap.h && cap.h.t)) {
    utils.logText('CAP dropped - no type field', 'INF', utils.colors.warn);
    return;
  }
  handle.loadDescriptor(cap.h.t, function(cap_desc){
    if(db.descriptors[cap.h.t])
      handle.doCAPtoRAP(cap, cap_desc, function(capbytes){
        var rap = {};
        var rapbytes = [];
        utils_gs.toBytes(rapbytes, 0xABCD); // sync flag
        utils_gs.toBytes(rapbytes, capbytes.length); // payload length
        utils_gs.toBytes(rapbytes, cap.h.mid); // to
        utils_gs.toBytes(rapbytes, 0); // to flags
        utils_gs.toBytes(rapbytes, 18765,2); // from
        utils_gs.toBytes(rapbytes, 0); // fromflags
        utils_gs.toBytes(rapbytes, capbytes);
        utils_gs.augmentChecksums(rap, rapbytes); 
        utils_gs.toBytes(rapbytes, rap.checksumA); // checksumA
        utils_gs.toBytes(rapbytes, rap.checksumB); // checksumB
        event.emit('port-write',rapbytes);
      });
  });
  
}

// this is the actual TAP byte-to-object conversion function. after verifying the TAP byte array length,
// the TAP header is first processed. for each header field descriptor in the tap descriptor, extract the
// number of bytes specified by the length field length and convert these bytes to a single number. no 
// field conversions are usually specified for header fields. payload processing is capable of extracting 
// multiple payload packs from a single TAP package, but these are each converted into individual TAPs for
// relay to the control center. in a given pack, each payload field descriptor in the TAP descriptor is 
// extracted by byte length just as was done with the header fields. if conversion fields are present for
// a field, they are handled by special byte conversion utilities. the TAP object that has been assembled
// in this process is passed to callback for relay to control center.
handle.doRAPtoTAP = function(rap, tapbytes, tap_desc, callback) {
  var bytecount = 0;
  var h = {};
  for(var i in tap_desc.h) {
    if(tap_desc.h[i].split(',')[0]) { // for each item in the tap header
      var bytesOfNumber = tapbytes.slice(bytecount, bytecount += Number(tap_desc.h[i].split(',')[1]));
      h[tap_desc.h[i].f] = utils_gs.bytesToNumber(bytesOfNumber); // slice out the correct number of bytes, form number, and increase bytecount
    }
  }
  // While loop commented out.  At this point in time I really don't see any use for it.
  // while(bytecount < rap.length-2) { // don't count the checksums yet, but we're going to loop over every pack in the tap
    var tap = { h: h, p: {} }
    var result;
    for(var i in tap_desc.p) {
    	var pack = tap_des.p[i].split(',');
      if(pack[0]) { // for each item in the tap repeatable elements
        if(Number(pack[1]) < 0) { // variable length data
          var datalength = tapbytes.length - bytecount - 2;
          result = tapbytes.slice(bytecount, bytecount += datalength); // slice out bytes from current marker to just before checksum, and increase bytecount
        } else {
          result = tapbytes.slice(bytecount, bytecount += pack[1]);
        }
        if(pack[2] == 'string') { // string
          result = utils_gs.bytesToString(result); // slice out the correct number of bytes, form number, and increase bytecount
        } else if(pack[2] == 'hex') { // hex string
          result = utils_gs.bytesToHex(result); // slice out the correct number of bytes, form number, and increase bytecount
        } else if(Number(pack[1]) < 0) { // array of decimal bytes
          result = result.toString();
        } else { // number plain
          result = utils_gs.bytesToNumber(result); // slice out the correct number of bytes, form number, and increase bytecount
        }
      }
      tap.p[pack[0]] = result;
    }
    if(callback) callback(tap);
  }
  /*
    } 
	// Make sure our checksums match after extracting all the data
		if(!utils_gs.verifyChecksums(rap, tapbytes[bytecount], tapbytes[bytecount + 1])) {
      utils.logText('TAP dropped - wrong RAP checksum', 'INF', utils.colors.warn);
			if (callback) callback(rap.rapbytes, true);
    } else {
			if(callback) callback(tap);
		}
  // }
>>>>>>> aba5cdbe68c5e1cc8b434caa7cbd98446570d127
}*/

// this is the actual CAP byte-to-object conversion function. for every field descriptor in the CAP descriptor
// header array, the specified field is extracted from the CAP object and converted to a byte array of the
// correct length. any field missing results in a failed CAP unless specified for omission. the byte array
// is appended to a running total CAP byte array in the conversion function. payload fields are processed in
// the same way as header fields. there are no field omission options defined for payload fields. after
// processing all header and payload fields from the cap descriptors, the remaining CAP overhead fields are
// added. the byte array length is spliced into the cap byte array, and checksums are processed. the resulting
// CAP byte array is passed to callback for serial port write out.
handle.doCAPtoRAP = function(cap, cap_desc, callback) {
  var capbytes = [];
  var bytecount = 0;
  var h = {};
  var header = cap_desc.missionId.CAPHeader;
  for(var i in header) {
  	var cap_item = header[i].split(',');
    if(cap_item[0]) { // for each item in the cap header
      if(!cap.h[cap_item[0].trim()] && (cap_item[0].trim() != 'Length')) { // if a field is missing, and that field is not the cap length
        utils.logText('CAP dropped - missing field ' + cap_item[0].trim(), 'INF', utils.colors.warn);
        return;
      }
      if (cap_item[0].trim() == 'Length') continue;
      utils_gs.toBytes(capbytes,cap.h[cap_item[0].trim()], parseInt(cap_item[1].trim())); // convert the correct field to bytes (with padding) and push them on to 
    }
  }
  for(var i in cap_desc.package) {
  	cap_item = cap_desc.package[i].split(',');
    if(cap_item[0]) { // for each item in the cap header
      if(!cap.p[cap_item[0].trim()]) { // if a field is missing
        utils.logText('CAP dropped - missing field ' + cap_item[0].trim(), 'INF', utils.colors.warn);
        return;
      }
      utils_gs.toBytes(capbytes,cap.p[cap_item[0].trim()], parseInt(cap_item[1].trim())); // convert the correct field to bytes (with padding) and push them on to capbytes
    }
  }
  capbytes.splice(1,0,capbytes.length+3); // splice the total cap bytes length (+1 for the length byte, +2 for the checksums) into the cap bytes
  utils_gs.augmentChecksums(cap, capbytes); 
  utils_gs.toBytes(capbytes, cap.checksumA); // checksumA
  utils_gs.toBytes(capbytes, cap.checksumB); // checksumB
  if(callback) callback(capbytes);
}

// when a new serial port event is raised, the new bytes are joined to any existing buffer of bytes not
// previously processed, and  the buffer is assessed for either a collected byte count equal to the combined
// length of the RAP overhead and payload (RAP byte 2), or the presence of a RAP sync flag (indicating
// discardable bytes at the beginning of the array). Once a complete RAP byte array has been identified,
// it is sliced out of the buffer and passed into TAP processing
handle.SerialRead = function(newdata) { // newdata can be either Buffer or Array. The extendArray function can handle either.
  utils_gs.extendArray(serialReadBuffer,newdata); // Push all buffer elements onto serialReadBuffer in place.
  var rapbytes = [];
  if(serialReadBuffer.length == 11 + serialReadBuffer[2]) { // check if the number of bytes in the buffer equals the length of rap+payload
    rapbytes = serialReadBuffer.splice(0,serialReadBuffer.length); // splice out all elements
  } else {
    for(var i = 1; i < serialReadBuffer.length-1; i++) { // Search for /next/ sync, marking end of rap. this is used for first sync or resync
      if(serialReadBuffer[i] == 0xAB && serialReadBuffer[i+1] == 0xCD) { // found end of rap
        rapbytes = serialReadBuffer.splice(0,i); // splice out all elements before the newly found sync marker
        return; // stop searching for sync
      }
    }
  }
  if(rapbytes.length) {
		// log data here 
		if (handle.storeLocally) {
			handle.storeDataLocally(rapbytes);
		} else {
			handle.TAP(rapbytes);
		}
	}
}

// when byte arrays are ready to be written to serial, they are converted into a buffer data tye and passed
// into the port writer. the results of serial write are the number of bytes written and any errors.
handle.SerialWrite = function(data) {
  port.write(new Buffer(data), function(err, results) {
    if(err) utils.logText('Serial write error - ' + err, 'ERR');
    utils.logText('Serial write success - ' + results + ' bytes written');
  });
}

handle.storeDataLocally = function(data, bad) {
	var ObjectID = require('mongodb').ObjectID;
	var RAP = {
		rap: data,
		_id: new ObjectID()
	};
	var actionStr = "Data Stored Locally";
	if ( bad ) {
		mon.collection('badRAPS').insert(RAP, function(err, db) { if (err) {console.log("MAJOR MONGO ERROR (GS)")} });
		actionStr+= " into badRAPS";
	} else {
		mon.collection('RAPS').insert(RAP, function(err, db) { if (err) {console.log("MAJOR MONGO ERROR (GS)")} });
		actionStr+= " into RAPS";
	}
	utils.logText(actionStr);
}

handle.uploadStoredData = function() {
	var stream = mon.models.Rap.find().stream();
	stream.on('data', function(data) {
		handle.TAP(data.rap)
		data.remove();
	});
};
