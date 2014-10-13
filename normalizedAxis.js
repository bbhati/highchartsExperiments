/**
 * Extension for adding a button to normalize axis for Highcharts.
 * @author bbhati
 */
 
(function (Highcharts, HighchartsAdapter) {

var UNDEFINED,
        Chart = Highcharts.Chart,
        extend = Highcharts.extend,
        each = Highcharts.each;

// Highcharts helper methods
var inArray = HighchartsAdapter.inArray,
        merge = Highcharts.merge,
        addEvent = Highcharts.addEvent,
        isOldIE = Highcharts.VMLRenderer ? true : false;

var clone = function(obj) {
    // Handle the 3 simple types, and null or undefined
    if (null == obj || "object" != typeof obj) return obj;

    // Handle Date
    if (obj instanceof Date) {
        var copy = new Date();
        copy.setTime(obj.getTime());
        return copy;
    }

    // Handle Array
    if (obj instanceof Array) {
        var copy = [];
        for (var c = 0, len = obj.length; c < len; c++) {
            copy[c] = clone(obj[c]);
        }
        return copy;
    }

    // Handle Object
    if (obj instanceof Object) {
        var copy = {};
        for (var attr in obj) {
            if (obj.hasOwnProperty(attr)) copy[attr] = clone(obj[attr]);
        }
        return copy;
    }

    throw new Error("Unable to copy obj! Its type isn't supported.");
};

var findMinMax = function(series) {
	//TODO: change these to INTMIN
	var max = 0;
	var min = 0;
	
	var data = series.options ? series.options.data : series.data;
	if(data) {
		for(d = 0 ; d < data.length; d++){
			if(data[d][1] > max) {
				max = data[d][1];
			} else if(data[d][1] < min) {
				min = data[d][1];
			}
		}
	}
	
	return {
		min: min,
		max: max
	};
};

var normalizedSeriesData = function(series) {
	var minMax = findMinMax(series);
	//its either series object or series options object
	if(series.options && series.options.normalizedData) {
		return series.options.normalizedData;
	}
	
	else if(series.normalizedData) {
		return series.normalizedData;
	}
	
	var normalizedData = series.options ? clone(series.options.data) : clone(series.data);
	if(normalizedData && normalizedData.length > 0) {
		
			if(minMax.max != 0 && minMax.min*minMax.max >= 0) {
				for(n = 0; n < normalizedData.length; n++) {
					normalizedData[n][1] = normalizedData[n][1] * 100 / minMax.max; 
				}
			} else if(minMax.min*minMax.max < 0){
				for(n = 0; n < normalizedData.length; n++) {
					normalizedData[n][1] = (normalizedData[n][1] + (-1*minMax.min) )* 100 / minMax.max + (-1*minMax.min); 
				}
			} else {
				//max is 0
				if(minMax.min != 0){
					for(n = 0; n < normalizedData.length; n++) {
						normalizedData[n][1] = (normalizedData[n][1] + (-1*minMax.min))* 100 / (minMax.max + (-1*minMax.min)); 
					}
				}
				else {
					for(n = 0; n < normalizedData.length; n++) {
						normalizedData[n][1] = (normalizedData[n][1] + 1)* 100 / (minMax.max + 1); 
					}
				}
			}
		
	}
	
	series.options ? series.options.normalizedData = normalizedData : series.normalizedData = normalizedData;
	return normalizedData;
};

function defaultOptions() {
	var options = {
		// enabled: true,
		// buttons: {Object}
		// buttonSpacing: 0,
		text: "Merge y-Axis",
		buttonTheme: {
			width: 56,
			height: 14,
			fill: '#00acec',
			r: 0,
			stroke: 'none',
			'stroke-width': 0,
			style: {
				color: 'white',
				fontWeight: 'normal',
				fontFamily: '"Lucida Grande", "Lucida Sans Unicode", Verdana, Arial, Helvetica, sans-serif', // default font
				fontSize: '9px',
				cursor:'pointer'
			},
			zIndex: 7, // #484, #852
			states: {
				hover: {
					fill: '#428bca'
				},
				select: {
					fill: '#e7f0f9',
					style: {
						color: 'black',
						fontWeight: 'bold'
					}
				}
			}
		},
	};
	return options;
}

function isArray(obj) {
        return Object.prototype.toString.call(obj) === '[object Array]';
}

function isNumber(n) {
        return typeof n === 'number';
}

function defined(obj) {
        return obj !== UNDEFINED && obj !== null;
}

function translatePath(d, xAxis, yAxis, xOffset, yOffset) {
        var len = d.length,
                i = 0,
                path = [];

        while (i < len) {
                if (typeof d[i] === 'number' && typeof d[i + 1] === 'number') {
                        path[i] = xAxis.toPixels(d[i]) - xOffset;
                        path[i + 1] = yAxis.toPixels(d[i + 1]) - yOffset;
                        i += 2;
                } else {
                				path[i] = d[i];
                        i += 1;
                }
        }

        return path;
}

var Normalizer = function () {
        this.init.apply(this, arguments);
};

Normalizer.prototype = {

        init: function (chart, options) {
                this.chart = chart;
                this.options = merge({}, defaultOptions(), options);
        },

        render: function (redraw) {
                var normalizer = this,
                        chart = this.chart,
                        renderer = normalizer.chart.renderer,
                        group = normalizer.group,
//                        title = normalizer.title,
                        options = normalizer.options,
                        titleOptions = options.title,
                        yAxis = chart.yAxis[options.yAxis],
                        normalizeButton,
                        hasEvents = normalizer.hasEvents;

                if (!normalizer.rendered) {
                	normalizer.normalizeButton = renderer.button(
    						options.text,
    						chart.plotLeft - 5,
    						chart.plotTop - 35,
    						function () {
    							normalizer.events.normalizeOrSplit( normalizer, chart);
    						},
    						options.buttonTheme,
    						options.buttonTheme.states && options.buttonTheme.states.hover,
    						options.buttonTheme.states && options.buttonTheme.states.select
    					)
    					.css({
    						textAlign: 'center'
    					})
    					.addClass('normalize')
    					.attr("rel","tooltip")
    					.attr("title","")
    					.attr("data-original-title","Normalize Chart and Merge y-Axis")
    					//.attr('rel="tooltip" title="" type="button" class="unzoom btn-ace btn-chart btn-info btn-info-border" data-original-title="Reset zoom for all the daily charts')
    					.add();

	                normalizer.rendered = true;
                }
        },
        
        destroy: function () {
                var normalizer = this,
                        chart = this.chart;

                normalizer.group = normalizer.chart = normalizer.options = null;
        },

        events: {
        	      destroyNormalizer: function(event, normalizer) {
                	normalizer.destroy();	
                },
                
                normalizeOrSplit : function(normalizer, chart) {

                	var hasClass = function(elem, className){
                		if(elem && $(elem).attr("class")) {
                			var classes = $(elem).attr("class").split(" ");
                			if(classes && (classes.indexOf(className) > -1)) {
                				return true;
                			}
                		}
                		return false;
                	};
                	
                	var addClass = function(elem, className){
                		var classes = [];
                		
                		if(elem && $(elem).attr("class")) {
                			classes = $(elem).attr("class").split(" ");
                		}
                		
            			if(classes && (classes.indexOf(className) < 0)) {
            				classes.push(className);
            			}
                		
                		$(elem).attr("class", classes.join(" "));
                	};
                	
                	var removeClass = function(elem, className){
                		if(elem && $(elem).attr("class")) {
                			var classes = $(elem).attr("class").split(" ");
                			if(classes && (classes.indexOf(className) > -1)) {
                				classes.splice(classes.indexOf(className), 1);
                			}
                			$(elem).attr("class", classes.join(" "));
                		}
                	};
	
                	if(hasClass(normalizer.normalizeButton.element, 'normalize')){
                		
                		if(!chart.get('normalized-yaxis')) {
                			var yAxis = {
                    				title : {
                    					text : '',
                    					style : {
                    						fontSize: '9px !important',
                    	                    fontFamily: "'Open Sans', HelveticaNeue, Helvetica, Arial !important",
                    	            		fontWeight: 'normal'
                    					}
                    				},
                    				labels: {
                    					format: '{value}%'
                    				},
                    				showEmpty : false,
                    				min : 0,
                    				max : 100,
                    				id: 'normalized-yaxis'
                        	    };
                            	
                            	chart.addAxis(yAxis, false);
                		}
                		
                		//for each series, find max. update data for each point ->
                		var series = chart.series;
                		if(series && series.length > 0) {
                			for(s = 0; s < series.length; s++) {
                				//normalize series
                				series[s].setData(normalizedSeriesData(series[s]), false, false, false);
                				
                				series[s].update({
                					yAxis: 'normalized-yaxis'
                				}, false);
                			}
                		}
                		//hide all yAxis
                		
            	    	var allYaxis = chart.yAxis;

            	    	var getUpdtedOptions = function() {
            				var axisTitle = this.options.title.text;
            				var hideLabels = true;
            				if(this.options.id && this.options.id == 'normalized-yaxis') {
                    			hideLabels = false;
                    		}
            				return {
            					originalTitle : axisTitle,
        						labels: {
                                    enabled: !hideLabels
                                },
            	                title: {
            	                	//enabled: false,
            	                	text : null,
            	                }	
            				};
            	        };
            	        
            	    	for(i = 0 ; i < allYaxis.length; i++) {
            	    		allYaxis[i].update(getUpdtedOptions.apply(allYaxis[i], null), false);
            	    	}
            	    	
            	    	removeClass(normalizer.normalizeButton.element, 'normalize');
            	    	
            	    	addClass(normalizer.normalizeButton.element, 'denormalize');
            	    	
            	    	$(normalizer.normalizeButton.element).find('text').html('Split y-Axis');
            	    	
            	    	$(normalizer.normalizeButton.element).attr("data-original-title","De-Normalize Chart and Split y-Axis");
            	    	
            	    	var oldX = $(normalizer.normalizeButton.element).find('text').attr('x');

            	    	//TODO: figure out how to recalculate x position of button text
            	    	$(normalizer.normalizeButton.element).find('text').attr('x', parseFloat(oldX) +4);
            	    	
            	    	chart.normalizer.normalized = true;

            	    	//update tooltip
            	    	
            	    	chart.tooltip.options.formatter = function() {
            	    		var content = '<div style="font-size: 10px;">';
        	            	if(Highcharts.getOptions().global.useUTC) {
        	            		content = content + new moment.utc(this.x).format('YYYY-MM-DD, H:mm:ss') +'</div>';
        	            	}
        	            	else {
        	            		content = content + new moment(this.x).format('YYYY-MM-DD, H:mm:ss') +'</div>';
        	            	}
        	            	
        	            	$.each(this.points, function(i, point) {
        	            		var searchByX = function(originalData, xValue){
        	            			if(originalData){
        	            				for(p = 0; p < originalData.length; p++) {
        	            					if(originalData[p][0] === xValue){
        	            						return originalData[p];
        	            					}
        	            				}
        	            			}
        	            		};
        	            		var serie = (point.series.options.display ? point.series.options.display : point.series.name);
        	            		var color = (point.series.options.color ? point.series.options.color : point.series.color);
        	                    content += '<div> <div style="display:inline;font-size: 10px; color:' + color + '"' + serie + '">' + serie  +'</div> <div style="font-size: 10px;display:inline;">:'+
        	                    //Number((point.y).toFixed(2)) + '</div></div>';
        	                    Number(searchByX(point.series.options.originalData, point.x)[1]).toFixed(2) +'(' +  Number((point.y).toFixed(2)) + '%) </div></div>';
        	                });
        	            	content += '</ul>';
        	            	return content; 
            	    	};
            	    	
            	    	//redraw chart with all changes
                		chart.redraw();

                		
                		
                	} else if(hasClass(normalizer.normalizeButton.element, 'denormalize')){

                		var allSeries = chart.series;
                		
                    	var getUpdtedOptions = function () {
                    		var axisTitle = this.options.originalTitle;
                    		var hideLabels = false;
                    		if(this.options.id && this.options.id == 'normalized-yaxis') {
                    			hideLabels = true;
                    		}
                    		return {
                    			labels: {
                                    enabled: !hideLabels
                                },
                                title: {
                                    text: axisTitle
                                }
                    		};
                    	};

                    	for(i = 0 ; i < allSeries.length; i++) {
                    		allSeries[i].setData(allSeries[i].options.originalData, false, false, false);
                    		
                    		allSeries[i].update({
                    			yAxis: allSeries[i].options.originalYAxis 
                    		}, false);
                    	}

                    	var allYaxis = chart.yAxis;
                    	
                    	for(i = 0 ; i < allYaxis.length; i++) {
                    		allYaxis[i].update(getUpdtedOptions.apply(allYaxis[i], null), false);
                    	}

                    	chart.tooltip.options.formatter = function() {
            	    		var content = '<div style="font-size: 10px;">';
        	            	if(Highcharts.getOptions().global.useUTC) {
        	            		content = content + new moment.utc(this.x).format('YYYY-MM-DD, H:mm:ss') +'</div>';
        	            	}
        	            	else {
        	            		content = content + new moment(this.x).format('YYYY-MM-DD, H:mm:ss') +'</div>';
        	            	}
        	            	
        	            	$.each(this.points, function(i, point) {
        	            		var serie = (point.series.options.display ? point.series.options.display : point.series.name);
        	            		var color = (point.series.options.color ? point.series.options.color : point.series.color);
        	                    content += '<div> <div style="display:inline;font-size: 10px; color:' + color + '"' + serie + '">' + serie  +'</div> <div style="font-size: 10px;display:inline;">:'+
        	                    Number((point.y).toFixed(2)) + '</div></div>';
        	                });
        	            	content += '</ul>';
        	            	return content; 
            	    	};
            	    	
                    	chart.normalizer.normalized = false;
                		
                    	removeClass(normalizer.normalizeButton.element, 'denormalize');
            	    	
            	    	addClass(normalizer.normalizeButton.element, 'normalize');
            	    	
            	    	$(normalizer.normalizeButton.element).find('text').html('Merge y-Axis');
            	    	
            	    	$(normalizer.normalizeButton.element).attr("data-original-title", "Normalize Chart and Merge y-Axis");
            	    	
            	    	var oldX = $(normalizer.normalizeButton.element).find('text').attr('x');
            	    	
            	    	//TODO: figure out how to recalculate x position of button text
            	    	$(normalizer.normalizeButton.element).find('text').attr('x', parseFloat(oldX) -4);
            	    	
                    	chart.redraw();
                    	
                	}
                }
                
        }
};


extend(Chart.prototype, {
	
	addNormalizer: function (options, redraw) {
		var chart = this,
			normalizer = new Normalizer(chart, options);
			normalizer.render(redraw);

	},
	redrawNormalizer: function () {
		this.normalizer.redraw();
	}
});


// Initialize on chart load
Chart.prototype.callbacks.push(function (chart) {
        var options = chart.options.normalizer,
        		clipPath,
            group,
            
            
			clipBox = {
					x: chart.plotLeft,
					y: chart.plotTop,
					width: chart.plotWidth,
					height: chart.plotHeight
			};

        if (options) {
        	clipPath = chart.renderer.clipRect(clipBox);   
            group = chart.renderer.g("normalizer");
            group.attr({
                    zIndex: 7
            });
            group.add();
            group.clip(clipPath);

            if(!chart.normalizer) chart.normalizer = {};
                    
            // link chart object to annotations
            chart.normalizer.chart = chart;

            // link annotations group element to the chart
            chart.normalizer.group = group;
            
            // add clip path to annotations
            chart.normalizer.clipPath = clipPath;
            
            chart.addNormalizer(chart.options);
            
            Highcharts.wrap(Highcharts.Chart.prototype, 'addSeries', function (proceed) {
            	
            	var optionsArr = Array.prototype.slice.call(arguments, 1, 2);
        		var options = (optionsArr && optionsArr.length) > 0 ? optionsArr[0] : {};
            	options.originalData = clone(options.data);
            	options.originalYAxis = options.yAxis;
            	var originalAxis = undefined;
            	
            	if(chart.normalizer.normalized) {
            		originalAxis = chart.yAxis[options.yAxis];
            		options.data = normalizedSeriesData(options);
                	options.yAxis = 'normalized-yaxis';
            	}
            	
            	proceed.apply(this, Array.prototype.slice.call(arguments, 1));

            	if(chart.normalizer.normalized) {
            		var series = chart.series[chart.series.length -1];
                	
                	originalAxis.update({
        	        	title: {style: {color: series.color}},
        	        	labels: {
        	        		style: {color: series.color}
        	        	}
        	        });	
            	}
            });
           
            //Don't add a new y-axis if chart is normalized
            Highcharts.wrap(Highcharts.Chart.prototype, 'addAxis', function (proceed) {

            	if(chart.normalizer.normalized) {
            		var optionsArr = Array.prototype.slice.call(arguments, 1, 2);
            		var options = (optionsArr && optionsArr.length) > 0 ? optionsArr[0] : {};
    	        	var isXArr = Array.prototype.slice.call(arguments, 2, 3);
    	        	var isY = !isXArr[0];
    	        	if(isY) {
    	        		options.originalTitle = options.title? options.title.text : null;
    	        		
    	        		if(options.title) {
    	        			options.title.text = null;
    	        		}
    	        		
    	        		if(options.labels) {
    	        			options.labels.enabled = false;
    	        		}
    	        	}
            	} 
            	
            	proceed.apply(this, Array.prototype.slice.call(arguments, 1));
            });
            
            
            Highcharts.wrap(Highcharts.Axis.prototype, 'update', function (proceed) {

            	if(chart.normalizer.normalized) {
            		
            		var optionsArr = Array.prototype.slice.call(arguments, 1, 2);
            		var options = (optionsArr && optionsArr.length) > 0 ? optionsArr[0] : {};
            		//can't think of a better way of handling this. Here code is assuming that if axis are merged, 
            		//we are not allowing the color of the merged yAxis to be updated in any case.
            		if(options && MA.is_obj(options) && this.options.id == 'normalized-yaxis') {
                			if(options.title && options.title.style && options.title.style.color) {
                				options.title.style.color = undefined;
                			}
                			if(options.labels && options.labels.style && options.labels.style.color) {
                				options.labels.style.color = undefined;
                			}
            			}
            		}
            	
            	proceed.apply(this, Array.prototype.slice.call(arguments, 1));
            });
        }     
});

}(Highcharts, HighchartsAdapter));