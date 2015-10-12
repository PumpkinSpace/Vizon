module.exports = function() {
  
  var utils =  {};
  
  // Extend the given array with the provided newdata, which can be either Buffer or Array
  utils.extendArray = function (arrcurr, datanew) {
    for(var i = 0; i < datanew.length; i++) arrcurr.push(datanew[i]);
  }
  
  utils.augmentChecksums = function() {
    if(arguments.length < 2) return;
    var obj = arguments[0];
    if(obj.checksumA === undefined) obj.checksumA = 0;
    if(obj.checksumB === undefined) obj.checksumB = 0;
    if(typeof arguments[1] === 'object') { // Seems to always fall in here
      var array = arguments[1];
      for(var k = 0; k < arguments[1].length; k++) {
        obj.checksumA = (obj.checksumA + (array[k] >>> 0)) % 256;
        obj.checksumB = (obj.checksumA + obj.checksumB) % 256;
      }
    } else {
      for(var k = 1; k < arguments.length; k++) {
        obj.checksumA = (obj.checksumA + (arguments[k] >>> 0)) % 256;
        obj.checksumB = (obj.checksumA + obj.checksumB) % 256;
      }
    }
  }
  
  // compare the checksums of the passed object at arg[0] with the checksums passed at arg[1,2]
  utils.verifyChecksums = function() {
    if(arguments.length < 3) return;
    var obj = arguments[0];
    if(obj.checksumA === undefined) obj.checksumA = 0;
    if(obj.checksumB === undefined) obj.checksumB = 0;
    return (obj.checksumA == (arguments[1] >>> 0) && obj.checksumB == (arguments[2] >>> 0)) ;
  }
  
  // convert the input array of bytes into a single integer number
  utils.bytesToNumber = function() {
    var value = 0;
    var array = arguments;
    if(arguments.length == 1)  array = arguments[0];
    for(var k in array) {
      value = ((value << 8) >>> 0) + (array[k] >>> 0); // careful with << because large numbers roll over
    }
    return value
  }
  
  // convert the input array of bytes into an ascii string
  utils.bytesToString = function() {
    var value = '';
    var array = arguments;
    if(arguments.length == 1)  array = arguments[0];
    for(var k in array) {
      value += String.fromCharCode(array[k] >>> 0);
    }
    return value
  }
  
  // convert the input array of bytes into a hex single
  utils.bytesToHex = function() {
    var value = '';
    var array = arguments;
    if(arguments.length == 1)  array = arguments[0];
    for(var k in array) {
      var newval = (array[k] >>> 0).toString(16).toUpperCase();
      value += (newval.length < 2 ? '0' : '') + newval;
    }
    return value
  }
  
  // convert the input number, string, or array to a series of bytes, optionally padded to a specified length
  utils.toBytes = function(arrayIn, input, length) {
    var bytesAdded = 0;
    var insertAt = arrayIn.length;
    if(typeof input == 'number') {
      while(true) {
        arrayIn.splice(insertAt, 0, input & 255);
        bytesAdded++;
        if(input < 256) break;
        input >>>= 8; // triple shift ensures non-negative result due to JS number size
      }
    } else if(typeof input == 'string') {
      for(var i = 0; i < input.length; i++) {
        arrayIn.push(input.charCodeAt(i));
        bytesAdded++;
      }
    } else if(Array.isArray(input)) {
      for(var i = 0; i < input.length; i++) 
        arrayIn.splice(insertAt+i, 0, input[i]);
    }
    while(length && (bytesAdded < length) && !Array.isArray(input)) {
      arrayIn.splice(insertAt,0,0);
      bytesAdded++;
    }
  }
    
  return utils
}();
