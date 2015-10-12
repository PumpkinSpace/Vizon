$(function () {
	// Connect to web socket
	var socket = io.connect('/web');
	
	
	// If a mission is selected, get all the TAP descriptors for it
	$("#missiondd").on('click', '.missionvar', function() {
	  var variable = $(this).text();
	  $("#tapmenu").empty();
	  $("#selectedlist").empty();
	  $("#missionddb")[0].innerText = variable; // Have the button show the selected mission
	  socket.emit('querytaps', variable.split(',')[0]);
	});
	
	// When a 'querytaps' is returned, fill in the data dropdown menu
	socket.on('querytaps', function(data) {
	  for ( var k in data ) {
	    var $newli = $( "<li role=presentation class=dropdown-header>");
	    $newli.text( data[k].ID + ', ' + data[k].name);
	    for ( var i = 2; i < data[k].data.length; i++) {
	      var $newa = $( "<a class=variable role=menuitem tabindex=-1 href=#>");
	      $newa.text(data[k].data[i]);
	      $newli.append($newa);
      }
      $("#tapmenu").append($newli);
    }
	});
	
	// If a tap data is selected, add it to the selected data list, and go query for timedata
	$("#tapmenu").on('click', '.variable', function() {
	  var variable = $(this).text();
	  var tap = $("#missionddb")[0].innerText.split(',')[0] + '-' + $(this).parent().contents()[0].wholeText.split(",")[0];
	  var $newl = $( "<li class=list-group-item>" );
	  $newl.text(variable);
	  var $newb = $( "<button class=\"rmvbutton pull-right\" ><span class=\"glyphicon glyphicon-remove\" >" );
	  $newl.append($newb);
	  $("#selectedlist").append($newl);
	  socket.emit('querytimedata', [tap, variable]);
	});
	
	// when a querytimedata call is returned, graph it
	socket.on('querytimedata', function(data) {
		data.series.sort(function(a, b) { 
    	return a[0] > b[0] ? 1 : -1;
 	  });
	  chart1.addSeries({
	    name: data.name,
	    data: data.series
	  });
	});
	
	// If an item is removed from the selected data list it flows through here
	$("#selectedlist").on('click', '.rmvbutton', function() {
	  for(var i = chart1.series.length - 1; i > -1; i--)
	  {
		if(chart1.series[i].name == $(this).parent().contents()[0].wholeText )
		chart1.series[i].remove();
	  }
	  $(this).parent().remove();
	});
	  
	var chart1 = new Highcharts.Chart({
		chart: {
			renderTo: 'graphcontainer'
		},
		
		
		xAxis: {
			type: 'datetime',
			labels: {
				overflow: 'justify'
			}
		},
		title: {
			text: 'Data'
		},
		navigator: {
      series: {
      	includeInCSVExport: false
      }
    },
		exporting: {
			csv: { 
				itemDelimiter : ',' 
			}
		},
		series: [],
		rangeSelector: {
			enabled: true,
			buttons: [{
				count: 1,
				type: 'hour',
				text: '1h'
			}, {
				count: 1,
				type: 'day',
				text: '24h'
			}, {
				count: 1,
				type: 'week',
				text: '1w'
			}],
			inputDateFormat: '%Y-%m-%d'
		},
		xAxis: {
			type: 'datetime',
			minRange: 60*60*1000
		},
		yAxis: {
			title: {
				text: 'Value'
			}
		},
		navigator: {
			enabled: true
		}

	});
	
	// This turns the data plotting from line to scatter
	// When new data is added it should default to the same as the rest
	$('#scatterbutton').click(function() {
		if ( this.innerHTML == 'Scatter') {
			this.innerHTML = 'Line';
			for (var i = 0; i < chart1.series.length; i++) {
				chart1.series[i].update({
					type: 'scatter'       	
				});	
			}
		} else {
			this.innerHTML = 'Scatter';
			for (var i = 0; i < chart1.series.length; i++) {
				chart1.series[i].update({
					type: 'line'       	
				});	
			}
		}
	});
	
	// Export button allows data in the current chart window to be exported to a CSV
	$('#exportbutton').click(function () {
		var data = chart1.getCSV();
		var a         = document.createElement('a');
		a.href        = 'data:attachment/csv,' + encodeURIComponent(data);
		a.target      = '_blank';
		var date = new Date();
		a.download    = $("#missionddb")[0].innerText.split(',')[0] + '-' + date.toISOString()	+ '.csv';

		document.body.appendChild(a);
		a.click();
	});
});
