(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/* global app:true, EventEmitter, io */
  'use strict';
  //var $ = require('jquery-browserify');

$(function() {
  var EventEmitter = require('events').EventEmitter;
  //var _ = require('underscore');
  //var app = require('keystone');
  //var Backbone = require('backbone');
  var ee = new EventEmitter();
  var socket;
  //app = false;
  //app = app || {};
	var app = {};

  app.MissionData = Backbone.Model.extend({
    defaults: {
      status: 'Disconnected'
    },
    url: function() {
      return '/data/missions/'+app.mainView.model.get('mission').missionId+'/';
    }
  });

  app.TAP = Backbone.Model.extend({
    parse: function(response) {
      if (response[this.get('tapId')]) {
        response.tap = response[this.get('tapId')];
        response.tap_desc = app.mainView.model.get('tap_descs')['TAP_'+this.get('tapId')];
        delete response[this.get('tapId')];
      } else {
        // this is required to make the template happy. if a tap type has not been recorded, the
        // response data is {}. to make the template skip this tap type, we have to set the desc field to false
        response.tap_desc = false;
      }
      return response;
    },
    url: function() {
      return '/data/missions/'+app.mainView.model.get('mission').missionId+'/tap/' + this.get('tapId') + '/';
    }
  });

  app.CAP = Backbone.Model.extend({
    defaults: {
      cap: {
        h: {},
        p: {}
      }
    },
    url: function() {
      return '/data/missions/'+app.mainView.model.get('mission').missionId+'/cap/';
    }
  });

  app.CAPCollection = Backbone.Collection.extend({
    model: app.CAP
  });
  app.HeaderView = Backbone.View.extend({
    el: '#header',
    template: _.template( $('#tmpl-header').html() ),
    initialize: function() {
      this.model = app.mainView.model;
      this.listenTo(this.model, 'change', this.render);
      this.render();
    },
    render: function() {
      this.$el.html(this.template( this.model.attributes ));
    }
  });

  app.TAPView = Backbone.View.extend({
    template: _.template( $('#tmpl-raw').html() ),
    initialize: function() {
      var _this = this;
      this.listenTo(this.model, 'sync', this.render);
      ee.addListener('new-TAP_'+this.model.get('tapId'), function(){
        _this.model.fetch();
      });
      this.model.fetch();
    },
    render: function() {
      this.$el.html(this.template( this.model.attributes ));
    }
  });

  app.CAPView = Backbone.View.extend({
    tagName: 'div',
    //el: '#cap',
    template: _.template( $('#tmpl-cap').html() ),
    events: {
      "click .btn-send": "send"
    },
    initialize: function() {
      this.model = new app.CAP();
    },
    render: function() {
      // because of the headers in the cap list, we have to subtract the number of headers above the
      // current selection (stored in data-offset at template runtime) from the selectedIndex of the list
      this.cap_desc = app.capCollectionView.collection.models[$('#cap_selector').prop('selectedIndex')-$('#cap_selector').find('option:selected').data('offset')].attributes;
      var attrs = {
        tap_descs: app.mainView.model.get('tap_descs'),
        tap_opts_template: _.template( $('#tmpl-tap-dropdown').html() )
      };
      _.extend(attrs,this.cap_desc);
      this.$el.html(this.template( attrs ));
      var picker = $('.datetimepicker',this.$el);
      picker.datetimepicker({
        format: 'yyyy-mm-ddThh:ii:ss', // datepicker format found at http://www.malot.fr/bootstrap-datetimepicker/
        autoclose: 1,
        todayBtn:  1,
        todayHighlight: 1,
        minuteStep: 1,
        startView: 2,
        forceParse: 0,
        pickerPosition: 'bottom-left',
        keyboardNavigation: 0
      })
      .on('changeDate', function(){
        var elem = $(this).children('input');
        elem.val(moment(elem.val()).seconds(0).toISOString());
      });

      picker.children('input')
      .mouseover(function(){
        $(this).data('holder',$(this).prop('placeholder'));
        $(this).attr('placeholder', 'Enter datetime string. End with \'Z\' for UTC, otherwise Local');
      })
      .mouseout(function() {
        $(this).prop('placeholder', $(this).data('holder'));
      })
      .change(function() {
        if ($(this).val() === '') { return; }
        var time = moment( $(this).val() );
        if(!time.isValid()) {
          var num = parseInt($(this).val());
          if(num < moment('Jan 1, 1980').utc()) { time = moment(num * 1000); }
          else { time = moment.utc(num); }
        }
        $(this).val( time.isValid() ? time.toISOString() : 'Invalid Entry');
      });

      picker.children('.pickerbutton')
      .mouseover(function() {
        $(this).prevAll('input').data('holder', $(this).prevAll('input').prop('placeholder'));
        $(this).prevAll('input').attr('placeholder', 'Select a UTC datetime');
      })
      .mouseout(function() {
        $(this).prevAll('input').prop('placeholder', $(this).prevAll('input').data('holder'));
      });

      $('input.interval',this.$el).keyup(function(){
        $('span.output').html(($(this).val() === '' || (parseInt($(this).val()) === 0) ? 'never' : moment().add('seconds',parseInt($(this).val())).fromNow()));
      });

      return this;
    },
    send: function() {
      var _this = this;
      var val = '';
      var cap = { h: {}, p: {}};
      _.each(this.cap_desc.p, function(elem) {
        var field =  _this.$el.find('[name="'+elem.f+'"]');
        if(field.size()) { val = field.val(); }
        if(val === '') { val = 0; }
        if(field.data('isdate')) { cap.p[elem.f] = (new Date(val)).valueOf()/1000; }
        else { cap.p[elem.f] = parseInt(val); }
      });
      cap.h.t = parseInt(this.cap_desc._id.split('_')[1]);
      var field =  _this.$el.find('[name="xt"]');
      val = (field.val() === '' ? moment() : moment(field.val())); // moment format not used but found at http://momentjs.com/docs/#/parsing/string-format/
      if(!val.isValid()) { val = moment(field.val()); }
      cap.h.xt = val.valueOf();
      this.model.set('cap', cap);
      this.model.save();
    }
  });

  app.CAPCollectionView = Backbone.View.extend({
    el: '#caps',
    template: _.template( $('#tmpl-cap-dropdown').html() ),
    events: {
      "change #cap_selector": "show"
    },
    initialize: function() {
      this.views = [];
      this.collection = new app.CAPCollection( app.mainView.model.get('cap_descs') );
      this.listenTo(this.collection, 'reset', this.render);
      this.collection.each(function() {
        this.views.push(new app.CAPView());
      }, this);
      this.render();
      $('#cap_selector').prop('selectedIndex',-1);
    },
    render: function() {
      this.$el.html( this.template({ cap_descs: this.collection.models }));
    },
    show: function() {
      $('#cap').empty().append(this.views[$('#cap_selector').prop('selectedIndex')].render().el);
    }
  });

  app.MainView = Backbone.View.extend({
    el: ('.page .container'),
    initialize: function() {
      app.mainView = this;
      console.log(this);
      this.model = new app.MissionData( JSON.parse( unescape($('#data-mission').html()) ) );
      if(this.model.get('tap_descs').TAP_1) { app.beaconView = new app.TAPView({el: '#beacon', model: new app.TAP({tap: {}, tapId: 1})}); }
      if(this.model.get('tap_descs').TAP_2) { app.bustelemView = new app.TAPView({el: '#cmdecho', model: new app.TAP({tap: {}, tapId: 2})}); }
      if(this.model.get('tap_descs').TAP_3) { app.bustelemView = new app.TAPView({el: '#bustelem', model: new app.TAP({tap: {}, tapId: 3})}); }
      if(this.model.get('tap_descs').TAP_4) { app.lmrsttelemView = new app.TAPView({el: '#lmrsttelem', model: new app.TAP({tap: {}, tapId: 4})}); }
      if(this.model.get('tap_descs').TAP_5) { app.lmrsttelemView = new app.TAPView({el: '#config', model: new app.TAP({tap: {}, tapId: 5})}); }
      if(this.model.get('tap_descs').TAP_13) { app.gpsView = new app.TAPView({el: '#gps', model: new app.TAP({tap: {}, tapId: 13})}); }
    }
  });

  $(document).ready(function() {
  	console.log(app);
  	
    app.mainView = new app.MainView();
    console.log(app);
    app.headerView = new app.HeaderView();
    app.capCollectionView = new app.CAPCollectionView();
		});
    socket = io.connect('/web');
    socket.on('connect', function () {
      socket.emit('join-mid',app.mainView.model.get('mission').missionId);
      app.headerView.model.set('status','Live');
    });
    socket.on('disconnect', function () {
      app.headerView.model.set('status','Disconnected');
    });
    socket.on('reconnect', function () {
      app.headerView.model.set('status','Live');
    });
    socket.on('error', function () {
      app.headerView.model.set('status','Unauthorized');
    });
    socket.on('new-tap', function (data) {
      ee.emitEvent('new-'+data);
    });
  });

/*$(function () {
	
	var socket = io.connect('/web');
	
	socket.emit('querymissions');
	
	socket.on('querymissions', function(data) {
		for (var k in data) {
			var $newli = $(" <li role=presentation >");
			var $newa = $("<a class=missionvar role=menuitem tabindex=-1 href=#>");
			$newa.text( data[k].missionId + ', ' + data[k].title);
			$newli.append($newa);
			$("#missiondd").append($newli);
		}
	});
	
	$("#missiondd").on('click', '.missionvar', function() {
	  var variable = $(this).text();
	  $("#missionddb")[0].innerText = variable;
	});
	
});*/
},{"events":2}],2:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}]},{},[1]);
