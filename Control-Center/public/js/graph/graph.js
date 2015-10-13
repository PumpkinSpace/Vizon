$(function () {
	
	var socket = io.connect('/web');
	
	/*socket.emit('querymissions');
	
	socket.on('querymissions', function(data) {
		for (var k in data) {
			var $newli = $(" <li role=presentation >");
			var $newa = $("<a class=missionvar role=menuitem tabindex=-1 href=#>");
			$newa.text( data[k].missionId + ', ' + data[k].title);
			$newli.append($newa);
			$("#missiondd").append($newli);
		}
	});
	*/
	socket.on('querytaps', function(data) {
	  for ( var k in data ) {
	    var $newli = $( "<li role=presentation class=dropdown-header>");
	    $newli.text( data[k].ID + ', ' + data[k].name);
	    for ( var i = 2; i < data[k].data.length; i++) {
	      var $newa = $( "<a class=variable role=menuitem tabindex=-1 href=#>");
	      $newa.text(data[k].data[i]);
	      $newli.append($newa);
      }
      $("#dropdown1").append($newli);
    }
	});
	
	socket.on('querytimedata', function(data) {
		data.series.sort(function(a, b) { 
    	return a[0] > b[0] ? 1 : -1;
 	  });
	  chart1.addSeries({
	    name: data.name,
	    data: data.series
	  });
	});
	
	$("#missiondd").on('click', '.missionvar', function() {
	  var variable = $(this).text();
	  $("#dropdown1").empty();
	  $("#selectedlist").empty();
	  $("#missionddb")[0].innerText = variable;
	  socket.emit('querytaps', variable.split(',')[0]);
	});
	
	$("#dropdown1").on('click', '.variable', function() {
	  var variable = $(this).text();
	  var tap = $("#missionddb")[0].innerText.split(',')[0] + '-' + $(this).parent().contents()[0].wholeText.split(",")[0];
	  var $newl = $( "<li class=list-group-item>" );
	  $newl.text(variable);
	  var $newb = $( "<button class=\"rmvbutton pull-right\" ><span class=\"glyphicon glyphicon-remove\" >" );
	  $newl.append($newb);
	  $("#selectedlist").append($newl);
	  socket.emit('querytimedata', [tap, variable]);
	});
	
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
			}/*,
			minorGridLineWidth: 0,
			gridLineWidth: 0,
			tickWidth: 1,
			alternateGridColor: null,
			plotBands: [{ // Dead
				from: 2,
				to: 2.9,
				color: 'rgba(255, 0, 0, 0.2)',
				label: {
					text: 'Dead',
					style: {
						color: '#606060'
					}
				}
			}, { // Nearly Dead
				from: 2.9,
				to: 3.65,
				color: 'rgba(255, 150, 0, 0.2)',
				label: {
					text: 'Nearly Dead',
					style: {
						color: '#606060'
					}
				}
			}, { // Partially Charged
				from: 3.65,
				to: 4.13,
				color: 'rgba(255, 255, 0, 0.2)',
				label: {
					text: 'Partially Charged',
					style: {
						color: '#606060'
					}
				}
			}, { // Fully Charged
				from: 4.13,
				to: 4.3,
				color: 'rgba(0, 255, 0, 0.2)',
				label: {
					text: 'Fully Charged',
					style: {
						color: '#606060'
					}
				}
			}]*/
		},
		navigator: {
			enabled: true
		}

	});
	
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
