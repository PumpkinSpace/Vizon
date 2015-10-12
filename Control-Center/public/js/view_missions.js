// !!!!!!!!! 
// Any changes in this file will not take effect until grunt is run, or the start script
// is reran.  The compilation of this page depends on a browserify script, which is ran
// by the grunt protocol on the server
//
// It would be good to find a better permanent solution to this.
// !!!!!!!!!

/* global app:true, EventEmitter, io */
  'use strict';

$(function() {
  var EventEmitter = require('events').EventEmitter;
  var ee = new EventEmitter();
  var socket;
	var app = {};

  app.MissionData = Backbone.Model.extend({
    defaults: {
      status: 'Disconnected'
    },
    url: function() {
      return '/mission/'+app.mainView.model.get('mission').missionId+'/';
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
    	return '/mission/'+app.mainView.model.get('mission').missionId+'/tap/' + this.get('tapId') + '/';
    }
  });

	app.TAPdesc = Backbone.Model.extend({
    defaults: {
      tap: {
        h: {},
        p: {},
      },
			checked : false
		}
  });
  
	app.TAPdescCollection = Backbone.Collection.extend({
    model: app.TAPdesc
  });
  
  app.CAP = Backbone.Model.extend({
    defaults: {
      cap: {
        h: {},
        p: {}
      }
    },
    url: function() {
      return '/mission/'+app.mainView.model.get('mission').missionId+'/cap/';
    }
  });

  app.CAPCollection = Backbone.Collection.extend({
    model: app.CAP
  });
  
  app.HeaderView = Backbone.View.extend({
    el: '#missionindicator',
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
    },
    remove: function() {
    	this.$el.empty().off();
    	this.stopListening();
    	return this;
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
      _.each(this.cap_desc.package, function(elem) {
      	var f = elem.split(',')[0];
        if ( f !== "") {
					var field =  _this.$el.find('[name="'+ f +'"]');
					if(field.size()) { val = field.val(); }
					if(val === '') { val = 0; }
					if(field.data('isdate')) { cap.p[f] = (new Date(val)).valueOf()/1000; }
					else { cap.p[f] = parseInt(val); }
				}
      });
      cap.h.t = this.cap_desc.ID.split('_')[1];
      var field =  _this.$el.find('[name="Execution Time"]');
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
    	$('#cap').empty().append(this.views[$('#cap_selector').prop('selectedIndex')-1].render().el);
    }
  });
  
 
  app.CheckListView = Backbone.View.extend({
  	el: '#checklist',
    template: _.template( $('#tmpl-check').html() ),
    events: {
      "click .toggle"   : "toggleShow",
      "click #toggleall": "toggleAllComplete"
    },
    initialize: function() {
    	var taps = app.mainView.model.get('tap_descs');
    	var taparr = [];
    	Object.keys(taps).forEach(function(desc, index) {
    		taparr[index] = taps[desc];
    	});
      this.collection = taparr;
      var checkstatus = true;
      this.render();
      var cl = this;
      $('#toggleall').prop('checked', true);
    	$.each($('#checklistitems').children('.toggle'), function(index, input) {
    		if ( $(input).is(':checked') != checkstatus ) {
    			$(input).prop('checked', checkstatus);
    			cl.toggle($(input));
    		}
    	});
    },
    render: function() {
      this.$el.html( this.template({ tap_descs: this.collection }));
    },
    toggle: function(target) {
    	var tapname = $(target).next("label").text();
    	if ( $(target).is(':checked') ) {
    		if(app.mainView.model.get('tap_descs')[tapname]) { 
    			app[tapname] = new app.TAPView({el: '#' + tapname, model: new app.TAP({tap: {}, tapId: parseInt(tapname.split('_')[1])})}); 
    		}
    	} else {
    		app[tapname].remove();
    	}
    },
    toggleAllComplete: function(target) {
    	var checkstatus =  $(target.currentTarget).is(':checked');
    	$.each($('#checklistitems').children('.toggle'), function(index, input) {
    		if ( $(input).is(':checked') != checkstatus ) {
    			$(input).prop('checked', checkstatus);
    			app.checkList.toggle($(input));
    		}
    	});
    },
    toggleShow: function(target) {
    	this.toggle($(target.currentTarget));
    }
  });

  app.MainView = Backbone.View.extend({
    el: ('.page .container'),
    initialize: function() {
      app.mainView = this;
      this.model = new app.MissionData( JSON.parse( unescape($('#data-mission').html()) ) );
    }
  });

  $(document).ready(function() {
    app.mainView = new app.MainView();
    app.headerView = new app.HeaderView();
    app.capCollectionView = new app.CAPCollectionView();
    app.checkList = new app.CheckListView();
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
    	ee.emit('new-'+data.split('-')[1]);
    });
  });