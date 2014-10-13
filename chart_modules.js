/**
 *
 */
CHARTING_ENGINE.create_module("chart-box", function(sb) {

  //TODO: wrap to truncate yAxis labels if they are long and overflowing
//	 Highcharts.wrap(Highcharts.Chart.prototype, 'addAxis', function (proceed) {
// 		var optionsArr = Array.prototype.slice.call(arguments, 1, 2);
// 		var options = (optionsArr && optionsArr.length) > 0 ? optionsArr[0] : {};
//     	var isXArr = Array.prototype.slice.call(arguments, 2, 3);
//     	var isY = !isXArr[0];
//
//     	if(isY && options.title) {
//     		var cat = options.title.text ? options.title.text : "";
//         	var formatted = (cat ? (cat > 20 ? cat.substring(0,15) + "..." + cat.substring(this.value.length -3): cat) : "");
//         	cat = '<div class="js-ellipse" style="width:100px; overflow:hidden; text-align:right" title="' + cat + '">' + formatted + '</div>';
//     		options.title.text = cat;
//     	}
//
//     	proceed.apply(this, Array.prototype.slice.call(arguments, 1));
//     });

  var chartDiv,
          data,
          config,
          seriesDisplay = {}, //Map of series Name to series display name
          serieNames = [],
          stackNames = [],
          seriesById = {},
          //Map of id to series which correspond to flags on the chart
          annotationSeriesById = {},
          //Needed for the share feature. Don't need the complete flag series, only the series options
          annotationsData = {},
          hiddenSeries = [], //Array of id of series that are always hidden
          dataType,
          chart,
          extend = Highcharts.extend,
          merge = Highcharts.merge,
          //to support multiple instances of a module on  page.
          conatainerId,
          cachedAnnotations,
          is_obj = function(obj) {
            return jQuery.isPlainObject(obj);
          },
          is_arr = function(arr) {
            return jQuery.isArray(arr);
          },
          obj_size = function(obj) {
            if (obj && is_obj(obj)) {
              return Object.keys(obj).length;
            }
            else
              return 0;
          },
          clone = function(obj) {
            // Handle the 3 simple types, and null or undefined
            if (null == obj || "object" != typeof obj)
              return obj;

            // Handle Date
            if (obj instanceof Date) {
              var copy = new Date();
              copy.setTime(obj.getTime());
              return copy;
            }

            // Handle Array
            if (obj instanceof Array) {
              var copy = [];
              for (var i = 0, len = obj.length; i < len; i++) {
                copy[i] = clone(obj[i]);
              }
              return copy;
            }

            // Handle Object
            if (obj instanceof Object) {
              var copy = {};
              for (var attr in obj) {
                if (obj.hasOwnProperty(attr))
                  copy[attr] = clone(obj[attr]);
              }
              return copy;
            }

            throw new Error("Unable to copy obj! Its type isn't supported.");
          };

  getChartOptionHtml = function() {
	return '<div><button type="button" style="margin-bottom: 2px; border-width: 1px; margin-top: 2px; margin: 2px;" class="reset_zoom btn-mini btn-view">Reset Zoom</button>' + '<button type="button" style="margin-bottom: 2px; border-width: 1px; margin-top: 2px; margin: 2px;" class="reset_chart btn-mini btn-view">Reset Chart</button>' + '<div style="margin-right: 2px;" class="btn-group pull-right" id="plot_options">' + '<a style="padding-left: 10px; padding-right: 10px; border-width: 1px; margin-bottom: 2px; margin-top: 2px;" class="btn dropdown-toggle btn-block btn-mini btn-view" data-toggle="dropdown" href="#">Options' + '<span class="caret" style="margin-left: 5px;"></span>' + '</a>' + '<ul class="dropdown-menu view-dropdown">' + '<li>' + '<button type="button" download-type="png" class="btn btn-block btn-small btn-link chart-download">Export as PNG</button>' + '</li>' + '<li>' + '<button type="button" download-type="jpeg" class="btn btn-block btn-small btn-link chart-download">Export as JPEG</button>' + '</li><li>' + '<button type="button" download-type="pdf" class="btn btn-block btn-small btn-link chart-download">Export as PDF</button>' + '</li>' + '<li>' + '<button type="button" class="btn btn-block btn-small btn-link plot-btn plot-log" disabled="true">Logarithmic Axis</button>' + '</li>' + '<li>' + '<button type="button" class="btn btn-block btn-small btn-link plot-btn plot-scatter">Scatter Plot</button>' + '</li>' + '<li>' + '<button type="button" class="btn btn-block btn-small btn-link toggle-datapoint show-data-points">Show Data Points</button>' + '</li>' + '</ul>' + '</div></div>' + '<canvas id="canvas" style="display:none;"></canvas>';  
  };  
  
  createComparator = function(property) {
    return function(a, b) {
      return a[property] - b[property];
    };
  };

  (function(Highcharts) {

    var addEvent = Highcharts.addEvent,
            merge = Highcharts.merge,
            extend = Highcharts.extend,
            chartProto = Highcharts.Chart.prototype;
    ;

    //add extensions.
    // Highcharts.wrap();

  })(Highcharts);

  var BASE_CONFIG = Object.freeze({
    "type": "line",
    "zoom": "xy",
    //"height" : 550,
    "column_xaxis_max": 10,
    //NOTE: need to do type checking when data is set. datamodel is relevant only when data is an array of Objects. If it is not,
    //the data format is assumed to be of type [[1,3], [2,5], ...] Or [1,2,3,4,5....]
    //This datamodel represents data of the format [{"x" : <timemillis>, "y" : 123.45},{"x" : <timemillis>, "y" : 234.33}...]
    "datamodel": [{"name": "x", "type": "datetime"},
      {"name": "y", "type": "float"}],
    "features": {
      "annotations": {
        enabled: false
      },
      "sharing": {
        enabled: false
      }
      //Add all other chart features
    }
  });

  //NOTE: add to this enum as and when more chart types are supported
  //Object.freeze is similar to final keyword in Java
  var TYPE_ENUM = Object.freeze({
    'LINE': "line",
    'SPLINE': "spline",
    'WATERFALL': "waterfall",
    'COLUMN': "column",
    'AREA': "area",
    'PIE': "pie"
  });

  var MARKER = ["circle", "triangle", "diamond", "triangle-down", "square"];
  
  var SERIES_STYLE = ["Solid", "ShortDashDotDot", "DashDot", "ShortDot", "Dot",
      "ShortDash", "ShortDashDot", "Dash", "LongDash",
      "LongDashDot", "LongDashDotDot"];
  
  var DATA_TYPE_ENUM = Object.freeze({
    'ARRofARR': "arrayOfArrays", //[[],[],[]]
    'ARRofSERIEDATAMAP': "arrayOfSeiesMapOfData", // {"series1" : [1,2,3], "series2" : [], "series3" : []} or {"series1" : [[1,2],[2,3]], "series2" : [], "series3" : []}
    'ARRofSERIEDATAOBJMAP': "arrayOfSeiesMapOfDataObject", // [{"serie1" : [{x:123,y:222},{}]...}]
    'ARRofDATAOBJ': "arrayOfDataObjects" // [{x:123,y:222},{}...]
  });

  var COLORS = ["#8bbc21", "#2f7ed8", "#910000", "#0d233a"];

  var getDataTypeOld = function(dat) {
    if (dat && jQuery.isArray(dat)) {

      //Assuming that each datapoint has same format for now
      //TODO: might have to change this later
      if (is_obj(dat[0])) {
        //check if data is of format ["series1" : [1,2,3,4], "series2" : [2,3,4,5]...] and so on
        if (obj_size(dat[0]) == 1) {
          var key = Object.keys(dat[0])[0];
          var mapped_data = dat[0][key];
          if (is_arr(mapped_data)) {
            //get the first non null datapoint
            var i = 0;

            while ((!mapped_data[i] || mapped_data[i] == null) && i < mapped_data.length) {
              i++;
            }
            if (i == mapped_data.length) {
              //TODO: handle this case
              console.log("Data format not supported");
              return undefined;
            }
            else {
              if (is_obj(mapped_data[i])) {
                return DATA_TYPE_ENUM["ARRofSERIEDATAOBJMAP"];
              } else {
                return DATA_TYPE_ENUM["ARRofSERIEDATAMAP"];
              }
            }
          } else {
            //throw unsupported format??
          }
        } else {
          return DATA_TYPE_ENUM.ARRofDATAOBJ;

        }
      }
      return false;
    } else if (dat && is_obj(dat)) {
      var key = Object.keys(dat)[0];
      var mapped_data = dat[key];
      if (is_arr(mapped_data)) {
        if (is_arr(mapped_data[0])) {
          DATA_TYPE_ENUM["SERIEDATAMAP"];
        }
      }
    }
    //TODO: throw exception
  };

  var getDataType = function(dat) {
    if (dat && jQuery.isArray(dat)) {

      //Assuming that each datapoint has same format for now
      //TODO: might have to change this later
      for (var i = 0; i < dat.length; i++) {
        if (is_obj(dat[i])) {
          //check if data is of format ["series1" : [1,2,3,4], "series2" : [2,3,4,5]...] and so on
          if (obj_size(dat[i]) == 1) {
            var key = Object.keys(dat[i])[0];
            var mapped_data = dat[i][key];
            if (is_arr(mapped_data) && mapped_data.length > 0) {
              //get the first non null datapoint
              var i = 0;

              while ((!mapped_data[i] || mapped_data[i] == null) && i < mapped_data.length) {
                i++;
              }
              if (i == mapped_data.length) {
                //TODO: handle this case
                console.log("Data format not supported");
                return undefined;
              }
              else {
                if (is_obj(mapped_data[i])) {
                  return DATA_TYPE_ENUM["ARRofSERIEDATAOBJMAP"];
                } else {
                  return DATA_TYPE_ENUM["ARRofSERIEDATAMAP"];
                }
              }
            } else if (!is_arr(mapped_data)) {
              //throw unsupported format??
            }
          } else {
            return DATA_TYPE_ENUM.ARRofDATAOBJ;

          }
        }
      }
      if (is_obj(dat[0])) {
        //check if data is of format ["series1" : [1,2,3,4], "series2" : [2,3,4,5]...] and so on
        if (obj_size(dat[0]) == 1) {
          var key = Object.keys(dat[0])[0];
          var mapped_data = dat[0][key];
          if (is_arr(mapped_data)) {
            //get the first non null datapoint
            var i = 0;

            while ((!mapped_data[i] || mapped_data[i] == null) && i < mapped_data.length) {
              i++;
            }
            if (i == mapped_data.length) {
              //TODO: handle this case
              console.log("Data format not supported");
              return undefined;
            }
            else {
              if (is_obj(mapped_data[i])) {
                return DATA_TYPE_ENUM["ARRofSERIEDATAOBJMAP"];
              } else {
                return DATA_TYPE_ENUM["ARRofSERIEDATAMAP"];
              }
            }
          } else {
            //throw unsupported format??
          }
        } else {
          return DATA_TYPE_ENUM.ARRofDATAOBJ;

        }
      }
      return false;
    } else if (dat && is_obj(dat)) {
      var key = Object.keys(dat)[0];
      var mapped_data = dat[key];
      if (is_arr(mapped_data)) {
        if (is_arr(mapped_data[0])) {
          DATA_TYPE_ENUM["SERIEDATAMAP"];
        }
      }
    }
    //TODO: throw exception
  };

  /**
   * 
   */
//  var buildCustomChartOptions = function(options) {
//	  var defaultChartOptions = ["Reset Zoom", "Reset Chart", {"Options" : ["Export as PNG", "Export as JPEG", "Export as PDF", "Logarithmic Axis", "Scatter Plot", "Show Data Points"]}]
//	  var callbacks = {"Reset Zoom" : };
//	  if(options) {
//		  //get the html for button
//		  
//	  }
//  };
  
  /**
   * TODO: make this configurable. Currently assuming that we are showing the set number of options i.e. resetzoom, reset chart and the options dropdown
   */
  function buildChartButtons(chartDiv, container, callbacks) {
	var optionsId = chartDiv + "_options";
	var chartDivWidth = $("#" + chartDiv).width();
	var chartDivHeight = $("#" + chartDiv).height();
	var $options = $('<div id="' + optionsId + '" style="width:' + chartDivWidth + 'px;display:inline;"><button type="button" style="margin-bottom: 2px; border-width: 1px; margin-top: 2px; margin: 2px;" class="reset_zoom btn-mini btn-view">Reset Zoom</button>' + '<button type="button" style="margin-bottom: 2px; border-width: 1px; margin-top: 2px; margin: 2px;" class="reset_chart btn-mini btn-view">Reset Chart</button>' + '<div style="margin-right: 2px;" class="btn-group pull-right" id="plot_options">' + '<a style="padding-left: 10px; padding-right: 10px; border-width: 1px; margin-bottom: 2px; margin-top: 2px;" class="btn dropdown-toggle btn-block btn-mini btn-view" data-toggle="dropdown" href="#">Options' + '<span class="caret" style="margin-left: 5px;"></span>' + '</a>' + '<ul class="dropdown-menu view-dropdown">' + '<li>' + '<button type="button" download-type="png" class="btn btn-block btn-small btn-link chart-download">Export as PNG</button>' + '</li>' + '<li>' + '<button type="button" download-type="jpeg" class="btn btn-block btn-small btn-link chart-download">Export as JPEG</button>' + '</li><li>' + '<button type="button" download-type="pdf" class="btn btn-block btn-small btn-link chart-download">Export as PDF</button>' + '</li>' + '<li>' + '<button type="button" class="btn btn-block btn-small btn-link plot-btn plot-log" disabled="true">Logarithmic Axis</button>' + '</li>' + '<li>' + '<button type="button" class="btn btn-block btn-small btn-link plot-btn plot-scatter">Scatter Plot</button>' + '</li>' + '<li>' + '<button type="button" class="btn btn-block btn-small btn-link toggle-datapoint show-data-points">Show Data Points</button>' + '</li>' + '</ul>' + '</div></div>' + '<canvas id="canvas" style="display:none;"></canvas>' + '<div class="hidden_container"></div>');
	//var $options = $('<div class="select2-legend" id="' + legendId + '" style="width:' + chartDivWidth + 'px;display:inline;top:' + chartDivHeight + 'px;">');
	$("#" + chartDiv).before($options);
	
//	$options.css({
//	  backgroundColor: '#ffffff'
//	});
	chartFeature.buildChartButtons(chartDiv, callbacks, undefined, container);
	
	return optionsId;
	
  };
  
  /**
   * dataLoader is a function which loads data for a series.
   * NOTE: everything that dataloader needs to load the data must come from series.dataLoaderParams
   **/
  var buildCustomLegend = function(series, dataLoader, data, offsetHeight) {
    //TODO: change data fromat to map!!
    var dataMap = {};
    var dataType;

    if (data.length > 0) {
      dataType = getDataType(data);
      for (i = 0; i < data.length; i++) {
        var serie = Object.keys(data[i])[0];
        dataMap[serie] = data[i][serie];
      }
    }
    var legendId = chartDiv + "_legend";
    var chartDivWidth = $("#" + chartDiv).width();
    var chartDivHeight = $("#" + chartDiv).height();

    var $legendContainer = $('<div class="select2-legend" id="' + legendId + '" style="width:' + chartDivWidth + 'px;display:inline;top:' + (chartDivHeight  + (offsetHeight ? offsetHeight : 0)) + 'px;">');
    $("#" + chartDiv).after($legendContainer);

    $legendContainer.css({
      backgroundColor: '#ffffff'
    });

    var select = $('<select multiple="true"><option></option>').appendTo(
            $legendContainer);

    for (s = 0; s < series.length; s++) {
      var id = "legend_" + MA.generateRandomId();
      if (data && dataType && dataType === DATA_TYPE_ENUM["ARRofSERIEDATAMAP"]) {
        $('<option serieName = "' + series[s]["name"] + '" id="' + id + '" class= "legend-item" data=' + dataMap[series[s]["name"]] + '>' + (series[s]["display"] ? series[s]["display"] : series[s]["name"]) + '</option>')
                .appendTo(select);
      } else {

        var dParams = (series[s]["dataLoaderParams"] ? JSON.stringify(series[s]["dataLoaderParams"]) : null);

        $('<option serieName = "' + series[s]["name"] + '" id="' + id + '" class=\"legend-item\" >' + series[s]["display"] + '</option>')
                .appendTo(select);

        $('#' + id).attr('dataLoaderParams', dParams);
//        console.log("dataloader params for series " + series[s]["name"] + " ; " + dParams);
      }
    }

    select.select2({
      width: "100%",
      allowClear: true,
      placeholder: "Select metric(s):"
    });

    $legendContainer.find('.select2-choices').css({
      border: "0px",
      backgroundImage: "none !important"
    });

    $legendContainer.find('.select2-container-multi').css({
      maxHeight: "105px",
      minHeight: "32px",
      overflow: "auto",
      backgroundColor: "#ffffff",
      fontFamily: "Times New Roman",
      fontSize: "14px"
    });

    var select = $('#' + legendId).find('.select2-offscreen');

    //on change
    select.on("change", function(e) {
      var val = e.val;
      var toggleSeries = true;

      if (e.toggleSeries != undefined) {
//            	console.log("toggleSeries " + e.toggleSeries + " sent with change call.");
        toggleSeries = e.toggleSeries === "false" ? false : e.toggleSeries;
      }

      //NOTE: e.removed && e.aaded could be an array or object. If it's coming from the setting value array of select2, its an array
      if (e.removed && (is_obj(e.removed) || (is_arr(e.removed) && e.removed.length > 0))) {
        //hide the series

        if (is_obj(e.removed) && toggleSeries) {
          clickItem($(e.removed.element), $(this), "removed");
        }
        else if (is_arr(e.removed) && toggleSeries) {
          for (r = 0; r < e.removed.length; r++) {
            clickItem($(e.removed[r]["element"]), $(this), "removed");
          }
        }
      } else if (e.added && (is_obj(e.added) || (is_arr(e.added) && e.added.length > 0))) {
        //show series

        if (is_obj(e.added) && toggleSeries) {
          clickItem($(e.added.element), $(this), "added");
        }
        else if (is_arr(e.added) && toggleSeries) {
          for (r = 0; r < e.added.length; r++) {
            clickItem($(e.added[r]["element"]), $(this), "added");
          }
        }

      }
    });

    return legendId;
  };

  /**
   * Legend item click handler for custom (select2) legend
   *
   */
  var clickItem = function(legendItem, select, action) {

    if (chart) {
      var serie;
      var linkedSeries = [];
      var dataLoaderParams = {};

      var legendOptions = chart.options['legend'];

      var data = legendItem.attr('data');
      var dataLoaderParamsAttr = legendItem.attr('dataLoaderParams');


      if (dataLoaderParamsAttr && dataLoaderParamsAttr != "") {
        dataLoaderParams = JSON.parse(dataLoaderParamsAttr);

        dataLoaderParams["select"] = select;
      }

      var serieName = legendItem.attr('serieName');

      var yAxisName = legendItem.attr('yAxisName');

      for (x in chart.series) {
        if (chart.series[x] && chart.series[x].name === serieName) {
          if (!chart.series[x].options.linkedTo) {
            serie = chart.series[x];
          } else {
            linkedSeries.push(chart.series[x]);
          }

        }
      }
      if (serie) {
        if (serie.visible && action == "removed") {
          serie.hide();
          //TODO: why is this needed? linkedseries should hide on their own
                    for (l = 0; l < linkedSeries.length; l++) {
                        if (linkedSeries[l].visible) {
                            linkedSeries[l].hide();
                        }
                    }
        } else if (action == "added") {
          serie.show();

                    for (l = 0; l < linkedSeries.length; l++) {
                        if (!linkedSeries[l].visible) {
                            linkedSeries[l].show();
                        }
                    }
          select.parent().find('.select2-search-choice:last').css({
            color: serie.color
          });
        }

      } else {
        if (action == "added") {
          //TODO: figure out if each series could have its own dataLoader method
          var fn = config.dataLoader;

          if (data) {
            var yAxisIndex = chart.yAxis.length - 1;

            
            chart.addSeries({
              "name": serieName,
              "data": data,
            });

            select.parent().find('.select2-search-choice:last').css({
              color: chart.series[chart.series.length - 1].color
            });
          }
          else if (fn && typeof fn === "function") {
            dataLoaderParams["seriesName"] = serieName;
            
            if($.chartMap && $.chartMap[chartDiv] ) {
            	if($.chartMap[chartDiv].lastPlotAction) {
                	if($.chartMap[chartDiv].lastPlotAction._class === 'plot-scatter') {
                		dataLoaderParams["seriesType"] = "scatter";
                		dataLoaderParams["markerEnabled"] = true;
                	}
            	}
            	if($.chartMap[chartDiv].lastToggleAction) {
            		if ($.chartMap[chartDiv].lastToggleAction == chartFeature.settings.plotOptions.showDataPoints) {
            			dataLoaderParams["markerEnabled"] = true;
                    } 
            	}
            }
            
            fn(dataLoaderParams, dataLoaderCallback, dataloaderErrorCallback);

          } else {
            //log error
            console.log("No dataLoader method found.");
          }
        }
      }
    }

  };


  function dataLoaderCallback(serieOptions, seriesData, select) {

	//TODO: check for data format
    var seriesName = serieOptions.name;
    			
    //var mergeYAxisLabel = serieOptions.mergeYAxisLabel;
    //var colorizeYAxis = serieOptions.colorizeYAxis;
    if (serieOptions.display) {
      seriesDisplay[seriesName] = serieOptions.display;
    }

    var seriesId = serieOptions.id;

    var title = (seriesDisplay[seriesName] ? seriesDisplay[seriesName] : seriesName);

    /*
     if(colorizeYAxis) {
     title = '<span style="color:' + color + ';">' + title + '</span>';
     }

     /*
     var merged = false;
     if(mergeYAxisLabel && chart.yAxis && chart.yAxis.length > 0) {
     for(var i=1; i< chart.yAxis.length; i++) {
     var existingTitle = chart.yAxis[i].axisTitle ? chart.yAxis[i].axisTitle.textStr : undefined;
     if(existingTitle) {
     title = existingTitle + '/' + title;
     }
     }
     if(chart.yAxis.length > 1) {
     chart.yAxis[chart.yAxis.length-1].setTitle({
     text : title,
     y:0,
     x:-2
     });
     merged = true;
     }
     }

     if(!merged && config.yAxis && config.yAxis.multiple) {

     var yAxis = {
     originalTitle : title,
     title : {
     text : title,
     style : { color: color },
     y:0,
     x:-2
     },
     labels: {
     enabled : true,
     style: {
     color: color,
     fontSize: '9px !important',
     fontFamily: "'Open Sans', HelveticaNeue, Helvetica, Arial !important",
     fontWeight: 'normal',
     textTransform: 'capitalize'
     },
     y:4,
     x:-6,
     align:'right'
     },
     showEmpty : false,
     min : 0
     };
     chart.addAxis(yAxis, false);
     }
     */

    if (config.yAxis && config.yAxis.multiple) {

      var yAxis = {
        originalTitle: title,
        title: {
          text: title,
//	                	style : { color: color },
          y: 0,
          x: -2
        },
        labels: {
          enabled: true,
          style: {
            //color: color,
            fontSize: '9px !important',
            fontFamily: "'Open Sans', HelveticaNeue, Helvetica, Arial !important",
            fontWeight: 'normal',
            textTransform: 'capitalize'
          },
          y: 4,
          x: -6,
          align: 'right'
        },
        showEmpty: false,
        min: 0
      };


      chart.addAxis(yAxis, false);
    }

		/**
     * {
    "192": [
      
    ],
    "194": [
      {
        "testRunId": "427489",
        "release": "194",
     */
    //check typeof seriesData
    
    if(seriesData && getDataType(seriesData) == DATA_TYPE_ENUM.ARRofSERIEDATAOBJMAP) {
    	/**
    	 * each series obj actually corresponds to multiple series, e.g. in the case of trend charts the curr and prev release
    	 */
    	var seriesKeys = Object.keys(seriesData);
    	
    	var parentSeriesFound = false;
    	var parentSeriesIdx = -1;
    	var color = undefined;
    	for(k = 0; k < seriesKeys.length; k++) {
    		/**
    		 * each serie contained in the result
    		 * indSerie looks like {"192": [1,2,3,...]}
    		 */
    		var indSerie = seriesKeys[k];
    		var indSerieName = Object.keys(seriesData[indSerie])[0];
    		var indSerieData = seriesData[indSerie][indSerieName];

    		var markerObj = undefined;
    		var dashStyle = undefined;
    		//if(config.marker && config.marker.enabled == true) {
    			markerObj = {enabled: ((config.marker && config.marker.enabled == true) ? true: (serieOptions.marker && serieOptions.marker.enabled ? true: ((indSerieData && indSerieData.length == 1) ? true: false))), symbol: MARKER[k]};
    			dashStyle = SERIES_STYLE[k];
    		//}
    		
    		if(indSerieData.length > 0) {
    			if(!parentSeriesFound) {
    				parentSeriesFound  = true;
    				parentSeriesIdx = k;
    			}
    			var newSeries = {
  	    		      "name": seriesName,
  	    		      "data": indSerieData,
  	    		      "id": seriesName + " " + indSerieName,
  	    		      "display": seriesDisplay[seriesName],
  	    		    };
    			
    			var type = serieOptions.type;
    			if(type) {
    				newSeries.type = type;
    			}
    			if(k > parentSeriesIdx) {
    				newSeries['linkedTo'] = ':previous'
    			}
    			
    			if(markerObj) {
    				newSeries["marker"] = markerObj;
    			}
    			if(dashStyle) {
    				newSeries["dashStyle"] = dashStyle;
    			}

    			if(color) {
    				newSeries["color"] = color;	
    			}
  	    		    var yAxisIndex = chart.yAxis.length - 1;

//      	    		    if (config.yAxis && config.yAxis.multiple) {
//      	    		      if (yAxisIndex) {
  	    		        newSeries["yAxis"] = yAxisIndex;
//      	    		      }
//      	    		    }
  
    		    chart.addSeries(newSeries);
    		    
    		    if(k == parentSeriesIdx) {
    		    	color = chart.series[chart.series.length -1].color;
    		    }
    		}
    	}
    }

    else {
    	
    	var newSeries = {
    		      "name": seriesName,
    		      "data": seriesData,
    		      "id": seriesId,
    		      "display": seriesDisplay[seriesName],
    		    };

    		    var yAxisIndex = chart.yAxis.length - 1;

    		    if (config.yAxis && config.yAxis.multiple) {

    		      if (yAxisIndex) {
    		        newSeries["yAxis"] = yAxisIndex;
    		      }
    		    }

    		    chart.addSeries(newSeries);

    }

    chart.xAxis[0].setExtremes();

    var series = undefined;

    if (chart.series && chart.series.length > 0) {
      series = chart.series[chart.series.length - 1];
    }

    if (series) {
      var selectOption = select.find('option').filter(function() {
        return $(this).attr("seriename") === seriesName
      });
      var selectOptionName = selectOption ? selectOption.html() : undefined;
      if (selectOptionName) {
        select.parent().find('.select2-search-choice div').filter(function() {
          return $(this).html().trim() == selectOptionName.trim();
        }).css({
          color: series.color
        });
      }

      var yAxis = series.yAxis;
      if (config.yAxis && config.yAxis.multiple) {
        yAxis.update({
          title: {style: {color: series.color}},
          labels: {
            style: {color: series.color}
          }
        });
      }
      //load annotations
      //TODO: uncomment to show series specific annotations, showing only global annotations for now.
//            	var annotations = serieOptions.annotations;
//            	//show on chart
//            	bulkAddAnnotations(chart, annotations, series);

    }

  }
  ;

  function dataloaderErrorCallback(serie, select, errorMessage) {
    var selectOption = select.find('option').filter(function() {
      return $(this).attr("serieName") === serie
    });

    var selectOptionName = selectOption ? selectOption.html() : undefined;

    var oldVal = select.data().select2.val();
    //var oldData = select.data();
    var colorMap = {};

    var selected = select.parent().find('.select2-search-choice');

    if (selected.length > 0) {
      for (s = 0; s < selected.length; s++) {
        var name = $(selected[s]).find("div:first").html();
        //var color = $(selected[s]).css("color");
        var color = $(selected[s]).find("div:first").css("color");
        if (name) {
          name = name.trim();
        }
        ;
        colorMap[name] = color;
      }
    }

    if (selectOptionName && oldVal && oldVal.length > 0) {
      var deleteIndex = oldVal.indexOf(selectOptionName.trim());

      if (deleteIndex >= 0) {
        oldVal.splice(deleteIndex, 1);

        select.data().select2.val(oldVal);

        selected = select.parent().find('.select2-search-choice');
        for (s = 0; s < selected.length; s++) {
          var name = $(selected[s]).find("div:first").html();
          if (name) {
            var color = colorMap[name.trim()];

            $(selected[s]).find("div:first").css({
              color: color,
            });
          }

        }
      }
    }
  }
  ;

  /**
   *
   * Load initial series
   */
  var loadInitSeries = function(legendId) {
    var initSeries = config.initSeries;
    if(!initSeries) {
    	initSeries = [];
    	var numToLoad = 1;
    	if(config.initSeriesNum) {
    		numToLoad = parseInt(config.initSeriesNum);
    	}
    	//if(config.initSeriesNum) {
		//add to initseries
		var maxSeries = $("#" + legendId).find('.legend-item').length;
		var legendItems = $("#" + legendId).find('.legend-item');
		for(n = 0; n < numToLoad && n< maxSeries; n++) {
			initSeries.push($(legendItems[n]).attr("serieName"));
		}
    }
    var selected = [];
    if (initSeries) {
      $("#" + legendId)
              .find('.legend-item')
              .each(
                      function() {
                        var legendItem = this;
                        if (initSeries.indexOf($(legendItem).attr("serieName")) > -1) {
                          selected.push($(legendItem).html());
                        }
                      });

      //if data is already loaded on chart don't trigger change event
      if (data && data.length > 0) {
        $("#" + legendId).find("select").select2("val", selected, false);
      }
      else {
        //third param is for triggering change event. not triggered by default.
        $("#" + legendId).find("select").select2("val", selected, true);
      }

      for (s = 0; s < initSeries.length; s++) {
        var serieColor = undefined;
        var series = chart.series;
        for (x = 0; x < series.length; x++) {
          if (series[x].name === initSeries[s]) {
            serieColor = series[x].color;
          }
        }

        var item = $("#" + legendId)
                .find('.select2-search-choice div')
                .filter(
                        function() {
                          var serieDisplay = seriesDisplay[initSeries[s]];
                          return $.trim($(this).text()) === serieDisplay;

                        }).css({
          "color": serieColor
        });
      }
    }

  };

  var findPointInSeries = function(series, pointX, pointY) {
    var seriesData = series.data;
    if (seriesData) {
      for (d in seriesData) {
        var point = seriesData[d];
        if (point.x == pointX && point.y == pointY) {
          return point;
        }
      }
    }
    return undefined;
  };


  var drawChart = function() {
    //massage data
    var options = massageDataAndConfig();

    options = applyPreloadFeatures(options);

    //send data to highcharts draw method
    chart = new Highcharts.Chart(options);


    var chartHeight = $("#" + chartDiv).height();
    var chartWidth = $("#" + chartDiv).width();
    //$("#" + chartDiv).wrap('<div class="chart-wrapper" id="' + chartDiv + '_chartWrapper" style="min-height:' + chartHeight + 'px;min-width:' + chartWidth + 'px;"></div>');

    $("#" + chartDiv).wrap('<div class="chart-wrapper" id="' + chartDiv + '_chartWrapper" style="height:' + chartHeight + 'px;width:' + chartWidth + 'px;"><div class="chart-inner"></div></div>');
    var chartContainerId = chartDiv + '_chartWrapper';
    $("#" + chartContainerId).append('<br class="clear" />');
    $("#" + chartDiv).addClass("chart-module");
    //cache data from chart so that it need not be calculated again and again
    var series = chart.series;

    if (series) {
      for (i = 0; i < series.length; i++) {
        seriesById[series[i].options.id] = series[i];
      }
    }

    var optionsId = undefined;
    if(config.customChartOptions && config.customChartOptions.enabled) {
    	//$("#" + chartContainerId).prepend($.chartCommonHtml(chartDiv));
    	optionsId = buildChartButtons(chartDiv, $("#" + chartContainerId), config.customChartOptions.callbacks);
    	var newMinHeight = chartHeight + $($("#" + optionsId).find('button')[0]).height() + 8 //8 for the margin;
        $("#" + chartContainerId).css("height", newMinHeight + "px");
        
    }
    
    //loading of init series depends on chart being loaded, so better build the custom legend after chart is drawn
    if (config.legend && config.legend.custom) {
      var offset = 0;
      if(config.customChartOptions && config.customChartOptions.enabled) {
    	  offset = $($("#" + optionsId).find('button')[0]).height() + 8;
      }
      
      var legendId = buildCustomLegend(config.series, config.dataLoader, data, offset);
      var newMinHeight = chartHeight + $("#" + legendId).height() + offset;
      $("#" + chartContainerId).css("height", newMinHeight + "px");

      loadInitSeries(legendId);
    }
    
    

    applyPostloadFeatures(chart, options);

    //DISABLING SHARING for now, bug in adding annotations - > don't get added if series to which flagseries is attached, does not have a point there
//        if(options.sharing && options.sharing.enabled) {
//        	$("#" + chartDiv).before($('<div class="share-chart"><button type="button" rel="tooltip" title="" data-placement="top" data-original-title="Share chart" class="btn-share btn btn-large btn-share-chart btn-link-ma" ><i class="icon-share icon-large"></i></button></div>'));
//
//        	$(".btn-share-chart").click(function(){
//            	var url = MA.shareService + "?action=save-chart";
//            	saveAndShareChart(url, $(this));
//            });
//        }

  };

  var defaultOptions = {
    chart: {
      renderTo: chartDiv,
      height: BASE_CONFIG.height,
      width: BASE_CONFIG.width
    },
//        normalizer : {
//        	enabled: true
//        },
    navigator: {
      enabled: true,
      series: {
        //don't show a mini series in the navigator
        data: [],
        stack: null
      }, xAxis: {
        gridLineWidth: 0,
        //don't show labels in the mini-series
        labels: {
          enabled: false
        }
      }
    },
    scrollbar: {
      enabled: true,
      barBackgroundColor: 'gray',
      barBorderRadius: 7,
      barBorderWidth: 0,
      buttonBackgroundColor: 'gray',
      buttonBorderWidth: 0,
      buttonArrowColor: 'yellow',
      buttonBorderRadius: 7,
      rifleColor: 'yellow',
      trackBackgroundColor: 'white',
      trackBorderWidth: 1,
      trackBorderColor: 'silver',
      trackBorderRadius: 7
    },
    legend: {
      enabled: true,
      labelFormatter: function() {
        return seriesDisplay[this.name];
      }
    },
    annotations: {
      enabled: true
    },
    yAxis: {
      /**
       * whether to create a separate y-axis for each series.
       * NOTE: as of now, this option is used only when the data is loaded using a dataloader param,
       * in the case where all data comes before chart is drawn,
       * 	yAxis array is used as it is sent in the configs.Might need to provide support for this param in this case also.
       */
      multiple: false,
      //TODO add handler for overflowing yaxis labels
//        	title: {
//    		    text : (function(){
//             	var cat = this.value ? this.value : "";
//             	var formatted = (this.value ? (this.value.length > 20 ? this.value.substring(0,15) + "..." + this.value.substring(this.value.length -3): this.value) : "");
//             	cat = '<div class="js-ellipse" style="width:100px; overflow:hidden; text-align:right" title="' + cat + '">' + formatted + '</div>';
//            		return cat;
//            	})()
//        	}

    },
    plotOptions: {
      series: {
        events: {},
        point: {
          events: {
          }
        }
      }
    }
  };

  var defaultTrendChartOptions = {
    xAxis: {type: 'datetime'},
    legend: {"custom": false, enabled: true}
  };

  var defaultColumnChartOptions = {
    chart: {
      marginBottom: 150,
      events: {
        load: function() {

        },
        redraw: function() {
          $('.js-ellipse').tooltip({position: "left", container: "body"});
        }
      }
    },
    sharing: {
      enabled: true
    },
    xAxis: {
      events: {
        //for stack label update
        setExtremes: function() {
          var xaxis = $("#" + chartDiv).highcharts().xAxis;

          var maxW = -1;

          if (xaxis && is_arr(xaxis)) {
            maxW = xaxis[0].width;
            xaxis = null;
          }

          var stackLabels = $("#" + chartDiv + " .highcharts-stack-labels text");
          //var stackLabelsHighchartSpan = $("#" + chartDiv + " .highcharts-stack-labels span");

          if (maxW && maxW > 0) {
            for (i = 0; i < stackLabels.length; i++) {

              var xPos = parseInt($(stackLabels[i]).attr("x"));
              //var xPos = parseInt($(stackLabels[i]).css("left"));
              //This is a hack. don't know a better way to do this. Basically hide stack labesl which are left or right of the chart frame
              var style = $(stackLabels[i]).attr("style");
              var stringContainingFill = style.substr(style.indexOf("fill:") + 5);
              var fill = stringContainingFill.substr(0, stringContainingFill.indexOf(";"));
              var splitStyle = style.split("fill:" + fill);
              if (xPos > maxW || xPos < 0) {
                //NOTE applying a class doesn't work becoz stacklabels can't have useHTML = true in salesforce1 case.
//	    	                    		$(stackLabels[i]).addClass("highcharts-hidden-stack");
//	    	                    		$(stackLabels[i]).removeClass("highcharts-visible-stack");

                var newStyle = splitStyle.join("fill:white");
                $(stackLabels[i]).attr("style", newStyle);
              }
              else {
                var newStyle = splitStyle.join("fill:black");
                $(stackLabels[i]).attr("style", newStyle);
                //$(stackLabels[i]).addClass("highcharts-visible-stack");
                //$(stackLabels[i]).removeClass("highcharts-hidden-stack");
              }
              xPos = null;
            }
          }
        }
      },
      tickLength: 160,
      labels: {
        x: 0,
        y: 117,
        rotation: 270,
        align: "center",
        useHTML: true
      }

    },
    yAxis: {
      min: 0,
      stackLabels: {
        enabled: true,
        rotation: -90,
        //when stacklabels is below the chart setting this to true (or not setting) hides the labels. Look at setOffset method last line for stacklabesls in highstock js
        crop: false,
        verticalAlign: 'bottom',
        //x: 4,
        //NOTE: useHTML breaks the stacklabels
        //useHTML: true,
        y: 25,
        style: {
          fontSize: '10px',
          fontFamily: 'Verdana, sans-serif'
        },
        formatter: function() {
          return  this.stack ? (this.stack.length < 10 ? this.stack : this.stack.substr(0, 4) + ".." + this.stack.substr(this.stack.length - 3)) : this.stack;
        }
      }
    },
    tooltip: {
      borderColor: '#6c6c6c',
      borderWidth: 1,
      followPointer: false,
      hideDelay: 1,
      formatter: function() {
        var values = [];
        var allPoints = [];

        var sortColumnRow = function(arr) {
          arr.sort(function(a, b) {

            if (a.row == b.row) {
              return a.col < b.col ? -1 : a.col > b.col ? 1 : 0;
            }

            return a.row < b.row ? -1 : 1;
          });
        };

        var visibleSeries = [];

        $.each(this.points, function(i, point) {
          var rowNum = stackNames.indexOf(point.series.options.stack);

          var colNum = serieNames.indexOf(point.series.name);

          if (point.series.visible && hiddenSeries.indexOf(point.series.options.id) < 0) {
            if (visibleSeries.indexOf(point.series.name) < 0) {
              visibleSeries.push(point.series.name);
            }

            allPoints.push({row: rowNum, col: colNum, y: point.y, key: point.key, color: point.series.color});
          }

        });

        var table = '<table class="highchart-tooltip-table table table-bordered">';

        table += '<th style = "text-align: left;padding: 5px;">' + config.stacks + '</th>';

        for (t = 0; t < visibleSeries.length; t++) {
          var color = seriesById[visibleSeries[t] + "_hidden"].color;
          table += '<th style = "text-align: right;padding: 5px;color: ' + color + '">' + seriesDisplay[visibleSeries[t]] + '</th>';
        }

        sortColumnRow(allPoints);

        var r = -1;
        for (t = 0; t < allPoints.length; t++) {

          if (t % (visibleSeries.length) == 0) {
            r += 1;
            if (t != 0) {
              table += '</tr>';
            }

            table += '<tr><td style = "text-align: left;padding: 5px;color:' + allPoints[t][color] + '"><b>' + stackNames[allPoints[t]["row"]] + '</b></td><td style = "text-align: right;padding: 5px;"><b>' + allPoints[t]["y"] + '</b></td>';
          }

          else {
            table += '<td style = "text-align: right;padding: 5px;"><b>' + allPoints[t]["y"] + '</b></td>';
          }

        }

        table += '</tr>';
        table += '</table>';

        values.push(table);

        if (allPoints[0]) {
          var s = allPoints[0].key;
          var ret = '';

          if (s) {
            s = s.split(":::");
            if (s.length > 0) {
              for (i = 0; i < s.length; i++) {
                ret = ret + (ret != '' ? '<div style = "padding: 5px;>' : '') + s[i] + '</div>';
              }
            }
          }
          values.push(ret);
        }

        return values.join(" ");
      },
      shared: true,
      useHTML: true
    },
    legend: {
      enabled: true,
      align: 'right',
      layout: 'vertical',
      verticalAlign: 'top',
      y: 100,
      labelFormatter: function() {
        return seriesDisplay[this.name];
      }
    },
    stackLegend: {
      enabled: true
    },
    plotOptions: {
      series: {
        events: {
          legendItemClick: function(event) {
            var visibility = this.visible;
            //are all legends hidden
            var hiddenLegends = [];
            var shownLegends = [];
            var numLegends = $(".highcharts-legend-item").length;

            if (this.chart.legend && this.chart.legend.allItems) {
              var all = this.chart.legend.allItems;
              for (i = 0; i < all.length; i++) {
                if (all[i].visible && all[i]) {
                  shownLegends.push(all[i]);
                } else {
                  hiddenLegends.push(all[i]);
                }
              }
              all = null;
            }
            if (visibility) {
              hiddenLegends.push(this);
              if (shownLegends.indexOf(this) > -1) {
                shownLegends.splice(shownLegends.indexOf(this), 1);
              }
              if (numLegends > 0 && (hiddenLegends.length == numLegends)) {
                $("#stack-labels").find(".hide-stack").each(function() {
                  $(this).removeClass("hide-stack");
                  $(this).addClass("show-stack");
                });
                hiddenLegends = [];
              }
            } else {
              shownLegends.push(this);
              if (hiddenLegends.indexOf(this) > -1) {
                hiddenLegends.splice(hiddenLegends.indexOf(this), 1);
              }
              if (numLegends > 0 && (shownLegends.length > 0)) {
                $("#stack-labels").find(".show-stack").each(function() {
                  $(this).removeClass("show-stack");
                  $(this).addClass("hide-stack");
                });
                hiddenLegends = [];
              }

            }

            return true;
          },
        }
      }
    }
  };

  /**
   * The custom features that need to be applied before chart is drawn
   */
  var applyPreloadFeatures = function(options) {
    if (options) {
      if (!options.annotations || (options.annotations && (options.annotations.enabled != false))) {

        //bbhati- Need to wrap the tooltip formatter because otherwise the text for flag series does not show up. Bug in Highstock.
        var oldToolTipFormatter = options.tooltip ? options.tooltip.formatter : undefined;
        var annotationsTooltipFormatter = options.annotations.tooltipFormatter;

        if (oldToolTipFormatter) {
          options.tooltip.formatter = function() {
            if (this.point) {
              //return tooltip text
              if (annotationsTooltipFormatter) {
                return annotationsTooltipFormatter.apply(this.point);
              }
              else {
                return oldToolTipFormatter.apply(this, Array.prototype.slice.call(arguments, 0));
              }
              //return this.point.text;
            } else {
              return oldToolTipFormatter.apply(this, Array.prototype.slice.call(arguments, 0));
            }
          };
        }

        plotOptions = {
          series: {
            point: {
              events: {
                //add dblclick event to options
                dblclick: function(event) {
                  var clickedAt = this;
                  var chart = this.series.chart;
                  var id = this.series.options.id;
                  var yIndex = this.series.options.yAxis;
                  var clickX = event.pageX - $("#" + chartDiv).offset().left,
                          clickY = event.pageY - $("#" + chartDiv).offset().top;
                  var pointX = this.x;
                  var pointY = this.y;

                  var deleteAnnotation = function(btn, pointId, chart) {
                    var container = btn.closest('.container-annotation');
                    var pointX = container.attr("flagX");
                    var pointY = container.attr("flagY");
                    var flagSeriesID = container.attr("flagSerieId");

                    var point = chart.get(pointId);

                    if (point) {
                      //tooltip doesn't get removed simply by removing the annotation div
                      var data = container.data();

                      if (data) {
                        var tooltipElem = (data.tooltip ? data.tooltip.$tip : undefined);
                        if (tooltipElem) {
                          tooltipElem.remove();
                        }
                      }

                      container.remove();
                      point.remove();

                      //remove from annotationsdata
                      var dat = annotationsData[flagSeriesID].data;

                      for (p = 0; p < dat.length; p++) {
                        if (dat[p].id == pointId) {
                          dat.splice(p, 1);
                        }
                      }

                    }
                  };

                  prepareAnnotationDialog(this.series, yIndex, pointX, pointY);
                }
              }
            }
          }
        };
        options.plotOptions = merge(options.plotOptions, plotOptions);
      }
    }
    return options;
  };

  /**
   * The custom features that are applied after chart is drawn
   */
  var applyPostloadFeatures = function(chart, options) {

//    if (!options.annotations || (options.annotations && (options.annotations.enabled != false))) {
      //load annotations

      //for stored/saved chart annotations are loaded as a separate series
      //Note:do not remove this
//    		if(options.annotationSeries && MA.is_arr(options.annotationSeries)) {
//    			var annotationSeries = options.annotationSeries;
//    			for(a=0; a < annotationSeries.length; a++) {
//    				//fix positioning
//    				var yPosition = -1*chart.clipBox.height;
//    				annotationSeries[a].y = yPosition;
//
//    				chart.addSeries(annotationSeries[a]);
//    			}
//    		}

    
//      var globalAnnotations = fetchGlobalAnnotations(chart, options, function(data) {
//        chart.globalAnnotations = data;
//        bulkAddAnnotations(chart, data);
//      });
//
//
//
//    }
     
  };

  var processBarChartData = function(series, data, chartOptions, config) {
    var modifiedSeries = [];

    if (chartOptions.chart.type === TYPE_ENUM.COLUMN) {

      var xAxis = config.xAxis;
      //var series = config.series;
      var serie_key = config.serie_key;

      var yField = config.yField;
      var xField = config.xField;
      var stacks = config.stacks;


      if (config.groupBy && typeof config.groupBy === 'string') {
        if (!xAxis.categories || (is_arr(xAxis.categories) && xAxis.categories.length == 0)) {
          //divide data into groups
          var categories = [];
          var categoryMap = {};
          var categoryNames = [];
          var stackMap = {};
          var uniqueXFieldNames = [];

          if (data.length > 0) {
            dataType = getDataType(data);
            if (dataType && dataType === DATA_TYPE_ENUM.ARRofDATAOBJ) {
              if (series.length != 0) {
                for (i = 0; i < series.length; i++) {
                  seriesDisplay[series[i].name] = series[i].display ? series[i].display : series[i].name;
                  serieNames.push(series[i].name);
                }
                //form categories and series data
                for (i = 0; i < data.length; i++) {
                  if (data[i]) {

                  }
                  if (!xAxis.categoriesModel) {
                    var serieKey = "";

                    //serieKey uniquely indentifies a point in the series

                    if (is_arr(serie_key)) {
                      for (c = 0; c < serie_key.length; c++) {
                        if (data[i][serie_key[c]]) {
                          serieKey += ":::" + serie_key[c] + ":" + data[i][serie_key[c]];
                        }
                      }
                    }

                    serieKey += ":::" + config.xField + ":" + data[i][config.xField];

                    if (!categoryMap[data[i][config.groupBy]]) {
                      categoryMap[data[i][config.groupBy]] = [serieKey];
                      categoryNames.push(data[i][config.groupBy]);
                    } else {
                      if (categoryMap[data[i][config.groupBy]].indexOf(serieKey) < 0) {
                        categoryMap[data[i][config.groupBy]].push(
                                serieKey
                                );
                      }
                    }

                    if (uniqueXFieldNames.indexOf(serieKey) < 0) {
                      uniqueXFieldNames.push(serieKey);
                    }

                    var groupIndex = categoryNames.indexOf(data[i][config.groupBy]);
                    var dataIndex = 0;

                    //-1 because serie name already added to map;
                    dataIndex += (categoryMap[categoryNames[groupIndex]].length - 1);

                    var stack = data[i][stacks];

                    //stackMap = {"stackA": ["serieA":]}

                    if (!stackMap[stack]) {
                      stackMap[stack] = {};
                    }

                    for (j = 0; j < series.length; j++) {

                      var serieName = series[j].name;
                      if (!stackMap[stack][serieName]) {
                        stackMap[stack][serieName] = {};
                      }

                      if (!stackMap[stack][serieName][categoryNames[groupIndex]]) {
                        stackMap[stack][serieName][categoryNames[groupIndex]] = {};
                        stackMap[stack][serieName][categoryNames[groupIndex]]["data"] = [];
                        stackMap[stack][serieName][categoryNames[groupIndex]]["stack"] = stack;
                      }

                      //TODO:check will there ever be a case when category is not identified with seriesKey
                      //prepare a hierarchical structure here because the data in array might not be sorted by "groupBy"
                      stackMap[stack][serieName][categoryNames[groupIndex]]["data"][dataIndex] = [serieKey, parseInt(data[i][serieName])];
                    }
                  }
                }
              } else {
                //TODO: handle this case.
              }
            }
          }

          var categoryGroups = Object.keys(categoryMap);

          for (i = 0; i < categoryGroups.length; i++) {
            var cats = categoryMap[categoryGroups[i]];
            for (c = 0; c < cats.length; c++) {
              //var cat = categoryGroups[i] + " " + cats[c];
              var cat = cats[c];

              cat = cat.substring(cat.lastIndexOf(":::" + config.xField + ":") + config.xField.length + 4);
              var formatted = cat.length < 16 ? cat : cat.substring(0, 10) + ".." + cat.substring(cat.length - 4);

              cat = '<div class="js-ellipse" style="width:100px; overflow:hidden; text-align:right" title="' + cat + '">' + formatted + '</div>';
              //cat = cat.length > 50 ? cat.substring(0,40) + "..." + cat.substring(45) : cat;
              categories.push(cat);

            }

          }

          stackNames = Object.keys(stackMap);

          //needed later after chart is drawn

          var allParentSeries = [];
          for (i = 0; i < stackNames.length; i++) {
            for (j = 0; j < series.length; j++) {
              var groupedData = stackMap[stackNames[i]][series[j].name];
              //flatten out the data now.
              var seriesData = [];
              var serie = series[j];
              var serieName = serie.name;

              var groupNames = Object.keys(groupedData);

              //var dataIndex = 0;

              for (g = 0; g < groupNames.length; g++) {

                var dataIndex = 0;

                var groupIndex = categoryNames.indexOf(groupNames[g]);

                for (temp = 0; temp < groupIndex; temp++) {
                  dataIndex += categoryMap[categoryNames[temp]].length;
                }

                var groupStartIndex = dataIndex;

                var dat = groupedData[groupNames[g]]["data"];

                //NOTE: relying on the fact that highcharts adds points belonging to a category fully then the next category, and so on
                for (d = 0; d < dat.length; d++) {
                  //seriesData = seriesData.concat(groupedData[groupNames[g]]["data"]);
                  seriesData[groupStartIndex + d] = groupedData[groupNames[g]]["data"][d];
                }
              }

              var nullDataCount = 0;

              if (seriesData) {
                for (k = 0; k < uniqueXFieldNames.length; k++) {
                  if (!seriesData[k] || (seriesData[k] == null)) {
                    nullDataCount += 1;
                    seriesData[k] = [uniqueXFieldNames[k], null];
                  }
                }
              }
              var color = COLORS[j % COLORS.length];

              var allZero = [];

              for (c = 0; c < categories.length; c++) {
                allZero.push(0);
              }


              if (allParentSeries.indexOf(serieName + "_hidden") < 0) {

                modifiedSeries.push({
                  type: "columnrange",
                  id: serieName + "_hidden",
                  "data": [],
                  "name": serieName,
                  "color": color
                });
                allParentSeries.push(serieName + "_hidden");
                hiddenSeries.push(serieNames[j] + "_hidden");
              }

              modifiedSeries.push({
                "stack": stackNames[i],
                name: serieName,
                linkedTo: serieName + "_hidden",
                id: serieName + "_hidden_" + i,
                stacking: "normal",
                "data": allZero,
                "color": color
              });

              hiddenSeries.push(serieNames[j] + "_hidden_" + i);

              var newSerie = {
                linkedTo: serieName + "_hidden",
                id: serieName + "_" + i,
                "color": color,
                "name": serieName,
                "data": seriesData,
                "stack": stackNames[i]
              };

              newSerie = merge(newSerie, serie);

              modifiedSeries.push(newSerie);

            }
          }

          //TODO: move this outside of this method
          //chart.xAxis[0].setCategories(categories);
          chartOptions.xAxis.stacks = stackNames;
          chartOptions.xAxis.categories = categories;


          if (chartOptions.stackLegend) {
            if (chartOptions.stackLegend.enabled) {
              for (s = 0; s < stackNames.length; s++) {
                $('<div class = "stack-name" stack="' + stackNames[s] + '">' + stackNames[s]).appendTo($("#stack-labels")).addClass("hide-stack").click(function() {
                  if ($(this).hasClass('hide-stack')) {
                    sb.notify({type: "hide-stack", data: [$(this).attr("stack")]});
                    $(this).removeClass("hide-stack");
                    $(this).addClass("show-stack");
                  } else {
                    sb.notify({type: "show-stack", data: [$(this).attr("stack")]});
                    $(this).removeClass("show-stack");
                    $(this).addClass("hide-stack");
                  }
                });
              }
              $("#stack-labels").show();
            }
          }
        }
      }

      //NOTE: doing -10 shows view zoomed in to 10 categories
      //Needed when navigator and scrollbar is enabled
      if (!(chartOptions.scrollbar && chartOptions.scrollbar.enabled === false)) {
//            	if(chartOptions.xAxis.min == undefined) {
//            		chartOptions.xAxis.min = categories.length < 12 ? null : categories.length - 10;
//            	}
        if (chartOptions.xAxis.max == undefined || categories.length < BASE_CONFIG.column_xaxis_max) {
          chartOptions.xAxis.max = categories.length < BASE_CONFIG.column_xaxis_max ? null : BASE_CONFIG.column_xaxis_max;
        }
      }

      return modifiedSeries;
    }

    return data;

  };

  var massageDataAndConfig = function() {
    //MassagedData and config are in the format the charting lib understands. In this case, they should be understandable by Highcharts

    //Might be useful later for more complex processing
    var dataModel = config.dataModel;

    if (config.chart) {
      if (!config.chart.type || config.chart.type === "line" || config.chart.type === "spline") {
        defaultOptions = merge(defaultOptions, defaultTrendChartOptions);
      } else if (config.chart.type === "column") {
        defaultOptions = merge(defaultOptions, defaultColumnChartOptions);
      }
    } else {
      defaultOptions = {};
    }

    var chartOptions = defaultOptions;

    chartOptions = merge(chartOptions, config);

    if (config.legend && config.legend.custom) {
      chartOptions.legend.enabled = false;
    }

    chartOptions.chart.renderTo = chartDiv;

    var xAxis = config.xAxis;

    if (!chartOptions.chart.type) {
      if ((type = config.type) && typeof type === 'string') {
        chartOptions.chart.type = type;
      } else {
        chartOptions.chart.type = BASE_CONFIG.type;
      }
    }

    var series = chartOptions.series;

    //TODO: add supoort for configuring this at per series level.
    var yField = config.yField;
    var xField = config.xField;
    var stacks = config.stacks;
    var serie_key = config.serie_key;
    var modifiedSeries = [];
    //TODO: Better configured at client - depends on the client
//	    	if(xField && serie_key.indexOf(xField) > -1) {
//	    		serie_key.splice(serie_key.indexOf(xField), 1);
//	    	}
    //type Specific processing
    if (chartOptions.chart.type === TYPE_ENUM.COLUMN) {
      if ((config.groupBy && typeof config.groupBy === 'string') && (!xAxis.categories || (is_arr(xAxis.categories) && xAxis.categories.length == 0))) {
        //divide data into groups
        var categories = [];
        var categoryMap = {};
        var categoryNames = [];
        var stackMap = {};
        var uniqueXFieldNames = [];

        if (data.length > 0) {
          dataType = getDataType(data);
          if (dataType && dataType === DATA_TYPE_ENUM.ARRofDATAOBJ) {
            if (series.length != 0) {
              for (i = 0; i < series.length; i++) {
                seriesDisplay[series[i].name] = series[i].display ? series[i].display : series[i].name;
                serieNames.push(series[i].name);
              }
              //form categories and series data
              for (i = 0; i < data.length; i++) {
                if (data[i]) {

                }
                if (!xAxis.categoriesModel) {
                  var serieKey = "";

                  //serieKey uniquely indentifies a point in the series

                  if (is_arr(serie_key)) {
                    for (c = 0; c < serie_key.length; c++) {
                      if (data[i][serie_key[c]]) {
                        serieKey += ":::" + serie_key[c] + ":" + data[i][serie_key[c]];
                      }
                    }
                  }

                  serieKey += ":::" + config.xField + ":" + data[i][xField];

                  if (!categoryMap[data[i][config.groupBy]]) {
                    categoryMap[data[i][config.groupBy]] = [serieKey];
                    categoryNames.push(data[i][config.groupBy]);
                  } else {
                    if (categoryMap[data[i][config.groupBy]].indexOf(serieKey) < 0) {
                      categoryMap[data[i][config.groupBy]].push(
                              serieKey
                              );
                    }
                  }

                  if (uniqueXFieldNames.indexOf(serieKey) < 0) {
                    uniqueXFieldNames.push(serieKey);
                  }

                  var groupIndex = categoryNames.indexOf(data[i][config.groupBy]);
                  var dataIndex = 0;

                  //-1 because serie name already added to map;
                  dataIndex += (categoryMap[categoryNames[groupIndex]].length - 1);

                  var stack = data[i][stacks];

                  //stackMap = {"stackA": ["serieA":]}

                  if (!stackMap[stack]) {
                    stackMap[stack] = {};
                  }

                  for (j = 0; j < series.length; j++) {

                    var serieName = series[j].name;
                    if (!stackMap[stack][serieName]) {
                      stackMap[stack][serieName] = {};
                    }

                    if (!stackMap[stack][serieName][categoryNames[groupIndex]]) {
                      stackMap[stack][serieName][categoryNames[groupIndex]] = {};
                      stackMap[stack][serieName][categoryNames[groupIndex]]["data"] = [];
                      stackMap[stack][serieName][categoryNames[groupIndex]]["stack"] = stack;
                    }

                    //TODO:check will there ever be a case when category is not identified with seriesKey
                    //prepare a hierarchical structure here because the data in array might not be sorted by "groupBy"
                    stackMap[stack][serieName][categoryNames[groupIndex]]["data"][dataIndex] = [serieKey, parseInt(data[i][serieName])];
                  }
                }
              }
            } else {
              //TODO: handle this case.
            }
          }
        }

        var categoryGroups = Object.keys(categoryMap);

        for (i = 0; i < categoryGroups.length; i++) {
          var cats = categoryMap[categoryGroups[i]];
          for (c = 0; c < cats.length; c++) {
            //var cat = categoryGroups[i] + " " + cats[c];
            var cat = cats[c];

            cat = cat.substring(cat.lastIndexOf(":::" + config.xField + ":") + config.xField.length + 4);
            var formatted = cat.length < 16 ? cat : cat.substring(0, 10) + ".." + cat.substring(cat.length - 4);

            cat = '<div class="js-ellipse" style="width:100px; overflow:hidden; text-align:right" title="' + cat + '">' + formatted + '</div>';
            //cat = cat.length > 50 ? cat.substring(0,40) + "..." + cat.substring(45) : cat;
            categories.push(cat);

          }

        }



        stackNames = Object.keys(stackMap);

        //needed later after chart is drawn

        var allParentSeries = [];
        for (i = 0; i < stackNames.length; i++) {
          for (j = 0; j < series.length; j++) {
            var groupedData = stackMap[stackNames[i]][series[j].name];
            //flatten out the data now.
            var seriesData = [];
            var serie = series[j];
            var serieName = serie.name;

            var groupNames = Object.keys(groupedData);

            //var dataIndex = 0;

            for (g = 0; g < groupNames.length; g++) {

              var dataIndex = 0;

              var groupIndex = categoryNames.indexOf(groupNames[g]);

              for (temp = 0; temp < groupIndex; temp++) {
                dataIndex += categoryMap[categoryNames[temp]].length;
              }

              var groupStartIndex = dataIndex;

              var dat = groupedData[groupNames[g]]["data"];

              //NOTE: relying on the fact that highcharts adds points belonging to a category fully then the next category, and so on
              for (d = 0; d < dat.length; d++) {
                //seriesData = seriesData.concat(groupedData[groupNames[g]]["data"]);
                seriesData[groupStartIndex + d] = groupedData[groupNames[g]]["data"][d];
              }
            }

            var nullDataCount = 0;

            if (seriesData) {
              for (k = 0; k < uniqueXFieldNames.length; k++) {
                if (!seriesData[k] || (seriesData[k] == null)) {
                  nullDataCount += 1;
                  seriesData[k] = [uniqueXFieldNames[k], null];
                }
              }
            }
            var color = COLORS[j % COLORS.length];

            var allZero = [];

            for (c = 0; c < categories.length; c++) {
              allZero.push(0);
            }


            if (allParentSeries.indexOf(serieName + "_hidden") < 0) {

              modifiedSeries.push({
                type: "columnrange",
                id: serieName + "_hidden",
                "data": [],
                "name": serieName,
                "color": color
              });
              allParentSeries.push(serieName + "_hidden");
              hiddenSeries.push(serieNames[j] + "_hidden");
            }

            modifiedSeries.push({
              "stack": stackNames[i],
              name: serieName,
              linkedTo: serieName + "_hidden",
              id: serieName + "_hidden_" + i,
              stacking: "normal",
              "data": allZero,
              "color": color
            });

            hiddenSeries.push(serieNames[j] + "_hidden_" + i);

            var newSerie = {
              linkedTo: serieName + "_hidden",
              id: serieName + "_" + i,
              "color": color,
              "name": serieName,
              "data": seriesData,
              "stack": stackNames[i]
            };

            newSerie = merge(newSerie, serie);

            modifiedSeries.push(newSerie);

          }
        }

        chartOptions.xAxis.stacks = stackNames;
        chartOptions.xAxis.categories = categories;

        if (chartOptions.stackLegend) {
          if (chartOptions.stackLegend.enabled) {
            for (s = 0; s < stackNames.length; s++) {
              $('<div class = "stack-name" stack="' + stackNames[s] + '">' + stackNames[s]).appendTo($("#stack-labels")).addClass("hide-stack").click(function() {
                if ($(this).hasClass('hide-stack')) {
                  sb.notify({type: "hide-stack", data: [$(this).attr("stack")]});
                  $(this).removeClass("hide-stack");
                  $(this).addClass("show-stack");
                } else {
                  sb.notify({type: "show-stack", data: [$(this).attr("stack")]});
                  $(this).removeClass("show-stack");
                  $(this).addClass("hide-stack");
                }
              });
            }
            $("#stack-labels").show();
          }
        }
      } else {
        //support with categories
        //pass as it is
        categories = chartOptions.xAxis.categories;

        var formatter = function() {
          var cat = this.value ? this.value : "";
          var formatted = (this.value ? (this.value.length > 20 ? this.value.substring(0, 15) + "..." + this.value.substring(this.value.length - 3) : this.value) : "");
          cat = '<div class="js-ellipse" style="width:100px; overflow:hidden; text-align:right" title="' + cat + '">' + formatted + '</div>';
          return cat;
        };

        chartOptions.xAxis.labels.formatter = formatter;

        //Dataloader takes precedence over any data set on series level
        if (!config.dataLoader) {
          modifiedSeries = chartOptions.series;
        }
      }

      //NOTE: doing -10 shows view zoomed in to 10 categories
      //Needed when navigator and scrollbar is enabled
      if (!(chartOptions.scrollbar && chartOptions.scrollbar.enabled === false)) {
//            	if(chartOptions.xAxis.min == undefined) {
//            		chartOptions.xAxis.min = categories.length < 12 ? null : categories.length - 10;
//            	}

        if (chartOptions.xAxis.max == undefined || categories.length < BASE_CONFIG.column_xaxis_max) {
          chartOptions.xAxis.max = categories.length < BASE_CONFIG.column_xaxis_max ? null : BASE_CONFIG.column_xaxis_max;
        }
      }

    }
    else if (chartOptions.chart.type === TYPE_ENUM.LINE || chartOptions.chart.type === TYPE_ENUM.SPLINE) {
      //TODO: NOTE: dblclick on trend chart not working as of now. FIX that!
      //since defaultoptions have the double click event overwriting it here
//        	chartOptions.plotOptions = {
//                series: {
//                	point: {
//                		events: {}}}};
//
      var dataMap = {};

      if (data.length > 0) {
        dataType = getDataType(data);
        for (i = 0; i < data.length; i++) {
          var serie = Object.keys(data[i])[0];
          dataMap[serie] = data[i][serie];
        }
      }

      if (series && series.length != 0) {
        for (i = 0; i < series.length; i++) {
          seriesDisplay[series[i].name] = (series[i].display ? series[i].display : series[i].name);
          serieNames.push(series[i].name);
          chartOptions.chart.seriesNames = serieNames;
//                    if(!config.dataLoader) {
//                    	modifiedSeries.push(series[i]);
//                    }

          if (dataType && dataType == DATA_TYPE_ENUM["ARRofSERIEDATAMAP"]) {
            if (!series[i].data) {
              series[i].data = dataMap[series[i].name];
              //modifiedSeries[modifiedSeries.length -1].data = series[i].data;
            }
            modifiedSeries.push(series[i]);
          }
        }
      }
    }

    else {
      modifiedSeries = chartOptions.series;
    }

    if (annotationsData) {
      var annotationSeries = [];
      var flagSeriesIDs = Object.keys(annotationsData);
      if (flagSeriesIDs) {
        for (i = 0; i < flagSeriesIDs.length; i++) {
          var flagSerieId = flagSeriesIDs[i];

          if (MA.is_arr(annotationsData[flagSeriesIDs[i]])) {
            //its just annotation datapoints, need to convert to series
            var annotations = annotationsData[flagSeriesIDs[i]];
            var dat = [];
            for (a = 0; a < annotations.length; a++) {
              var annotation = annotations[a];
              var pointId = annotation.startTime + annotation.description + flagSerieId;
              var point = {
                x: annotation.startTime,
                title: annotation.description,
                text: (annotation.notes ? annotation.notes
                        : annotation.description),
                custom: annotation.custom,
                id: pointId
              };

              dat.push(point);
            }
            var flagSeries = {
              type: 'flags',
              name: "Annotations",
              showInLegend: false,
              //yAxis : yAxis,
              data: dat,
              //onSeries : id,
              //linkedTo : id,
              shape: 'flag',
              color: 'red',
              //fillColor : fillColor,
              stackDistance: 20,
              //y: yPosition
            };

            annotationSeries.push(flagSeries);

          }
          else {
            annotationSeries.push(annotationsData[flagSeriesIDs[i]]);
          }

        }
      }
    }
    chartOptions.series = modifiedSeries;
    chartOptions.annotationSeries = annotationSeries;
    return chartOptions;
  };

  var addAnnotationOnSeries = function(type, annotation, series, yIndex, pointX, pointY) {
    if (type == 'bug') {
      fillColor = 'red';
      text = "B";
    } else if (type == 'event') {
      fillColor = 'orange';
      text = "E";
    } else if (type == 'comment') {
      fillColor = 'blue';
      text = "C";
    }
    var user_name = MA.getLoggedInUser();
    var id = series.options.id;
    var flagSerieId = "flag_series" + "_" + id + "_" + type;

    var rnd = MA.generateRandomId();
    var randId = "annotation_" + rnd;

    var annotationTime = Highcharts.getOptions().global.useUTC ? new moment.utc().format('YYYY-MM-DD, H:mm:ss') : new moment().format('YYYY-MM-DD, H:mm:ss');
    var annotationTitle = '<table><tbody><tr><td colspan="2">' + annotation + '</td></tr><tr><td>By:</td><td>' + user_name + '</td></tr><tr><td>At:</td><td>' +
            annotationTime + '</td></tr></tbody></table>';

    //TODO: configure flag series to be single or per series from client.Right now flag series is linked to a single series.
    if (!annotationSeriesById[flagSerieId]) {
      var flagSeries = {
        type: 'flags',
        name: "Annotations",
        showInLegend: false,
        yAxis: yIndex,
        data: [{
            x: pointX,
            y: pointY,
            title: '',
            text: annotationTitle,
            id: randId,
            //anchorY : pointY
          }],
        onSeries: id,
        linkedTo: id,
        shape: 'flag',
        color: 'black',
        fillColor: fillColor,
        //width : flagWidth,
        //height: flagHeight,
        stackDistance: 20,
        //useHTML : true,
        //stickyTracking : false,
        //enableMouseTracking: false
      };

      //if i do chart.addSeries(flagSeries) , the flagSeries obj gets modified by highcharts api call coz highchart holds reference to the obj.
      //that could cause erroneous behaviour if my code depends on flagSeries obj.
      var flagSeriesClone = clone(flagSeries);
      chart.addSeries(flagSeriesClone);

      annotationSeriesById[flagSerieId] = chart.series[chart.series.length - 1];

      annotationsData[flagSerieId] = flagSeries;
    } else {

      var flagSerie = annotationSeriesById[flagSerieId];
      flagSerie.addPoint({x: pointX, y: pointY, title: annotationTitle, text: annotation, id: randId, width: flagWidth, height: flagHeight});
      annotationsData[flagSerieId].data.push({x: pointX, y: pointY, title: '', text: annotation, id: randId});

    }


  };

  var prepareAnnotationDialog = function(series, yIndex, pointX, pointY) {
    var id = series.options.id;
    var user_name = MA.getLoggedInUser();
    var flagSerieId = "flag_series" + "_" + id + "_" + type;
    var chart = series.chart;
    var xAxis = chart.xAxis ? chart.xAxis[0] : null;
    var xAxisType = '';

    if (xAxis && xAxis.options && xAxis.options.type) {
      xAxisType = xAxis.options.type;
    }

    var cont = '';

//    		cont += '<div><table class="table table-bordered table-condensed table-ma-summary table-annotation">'
//    		     + '<thead><tr>'
//    	         + '<th style="min-width: 100%; width: 100%; max-width: 100%; border-radius: 0; " class="th-comment">Series </th>'
//    	         + '</tr></thead><tbody><tr><td><select style="width: 100%; margin-bottom: 3px;"><option val="' + (seriesDisplay[series.name] ? seriesDisplay[series.name] : series.name) + '" selected>' +
//    	         	(seriesDisplay[series.name] ? seriesDisplay[series.name] : series.name) + '</options>';
//
//    		for (s = 0; s < serieNames.length; s++) {
//    			if(serieNames[s] != series.name) {
//    				cont += '<option>' + (seriesDisplay[serieNames[s]] ? seriesDisplay[serieNames[s]] : serieNames[s]) + '</options>';
//    			}
//    		}
//
//    		cont +='</select></td></tr></tbody></table>'
//    			+ '<table class="table table-bordered table-condensed table-ma-summary table-annotation">'
//    			+ '<thead><tr><th style="min-width: 100%; width: 100%; max-width: 100%; border-radius: 0; " class="th-comment">' +
//    				(xAxisType && xAxisType === 'datetime' ?"Timestamp": "xValue") + '</th></tr></thead><tbody><tr><td>' + (xAxisType && xAxisType === 'datetime' ?
//    	    				(Highcharts.getOptions().global.useUTC ? new moment.utc(pointX).format('YYYY-MM-DD, H:mm:ss') : new moment(pointX).format('YYYY-MM-DD, H:mm:ss')) : pointX)
//    	    	+ '</td></tr></tbody></table>';

    cont += '<table class="table table-bordered table-condensed table-ma-summary table-annotation">'
            + '<thead><tr>'
            + '<th style="min-width: 100%; width: 100%; max-width: 100%; border-radius: 0; " class="th-comment"><span style="float:left">' +
            (seriesDisplay[series.name] ? seriesDisplay[series.name] : series.name) + '</span><span style="float:right">' + (xAxisType && xAxisType === 'datetime' ?
            (Highcharts.getOptions().global.useUTC ? new moment.utc(pointX).format('YYYY-MM-DD, H:mm:ss') : new moment(pointX).format('YYYY-MM-DD, H:mm:ss')) : pointX) + '</span></th>'
            + '</tr></thead><tr><td><div>'
            + '<select style="width: 100%; margin-bottom: 10px;" id="annotation-type"><option value="" disabled selected>Select Annotation Type</option>'
            + '<option class="btn-danger" value="bug" >Bug</option><option class="btn-warning" value="event">Event</option><option class="btn-info" value="comment">Comment</option></select></div>';

    cont += '<div><textarea rows="5" class="textarea_full editable-textarea-data" style="width: 98%; margin-bottom: 3px;" id="annotation_title" placeholder="Annotation Title">'
            + '</textarea></div></td></tr></table></div>';

    var footerContent = '<button class="flat-btn btn-primary" id="save-annotation">Save</button><button class="flat-btn btn-warning" data-dismiss="modal">Cancel</button>';

    $.genericModal(cont, "width:700px;overflow-y: auto;", "min-height:200px", "Add Annotation", footerContent);

    $("#annotation-type").change(function() {
      var select = $(this);
      color = select.find(":selected").attr('class');
      select.attr("class", color);
      select.blur();
    });

    $("#save-annotation").click(function() {
      var type = $("#annotation-type").val();
      var fillColor = undefined;
      var annotation = $("#annotation_title").val();

      addAnnotationOnSeries(type, annotation, series, yIndex, pointX, pointY);

      //dismiss modal
      MA.hideGlobalModal();

      //Save annotation on server
      var allAnnotations = undefined;

      for (a = 0; a < annotationsData[flagSerieId].data.length; a++) {
        var annotationData = annotationsData[flagSerieId].data[a];
        if (annotationData.x === pointX) {

          if (!allAnnotations) {
            allAnnotations = [];
          }

          var currOptions = annotationData.options;

          allAnnotations.push({
            "description": currOptions.description,
            "notes": currOptions.notes,
            "tsuid": id,
            "startTime": pointX,
            "custom": currOptions.custom
          });
        }
      }

      //sendAjax(parm, async, requestType, url, timeout, successCallback, errorCallback, quiet)
      var data = [];

      var newAnnotation = {
        ///need to calculate the rolling alphabet on server
        "description": annotation.substring(0, 4) + "..",
        "notes": annotation,
        "tsuid": id,
        "startTime": pointX,
        "custom": {
          "user": MA.getLoggedInUser()
        }
      };

      if (!allAnnotations) {
        allAnnotations = [newAnnotation];

      } else {
        if (MA.is_arr(allAnnotations)) {
          //push
          allAnnotations.push(newAnnotation);
        }
      }

      //TODO: assuming that x-Axis is datetime axis
      var annotationJson = JSON.stringify(allAnnotations);

      //data.annotation = annotationJson;

      data.push({
        name: "annotation",
        value: annotationJson
      });

      MA.sendAjax(data, true, 'POST', '/shared?action=add-annotation', 8000);

//        	$("#add-annotation").remove();
//
////		        	$('button.btn-edit-annotation').click(function() {
////			        	//Show annotation popup
////			        	clickedAt.dblclick();
////			        });
//
//        	$("#" + randId).find('button.btn-delete-annotation').click(function() {
//	        	deleteAnnotation( $(this), randId, chart );
//	        });
    });

    $("#btn-cancel-annotation").click(function() {
      $("#add-annotation").remove();
    });
  };

  var prepareShareChartModal = function(savedChartUrl) {
    var user_name = MA.getLoggedInUser();

    var cont = '<div><input style="width: 97%; margin-bottom: 3px;" id="from_address" class="form-control" type="text" placeholder="From" disabled value="' + user_name + '@salesforce.com"></div>';
    cont += '<div><input style="width: 97%; margin-bottom: 3px;" id="to_address" class="form-control" type="text" placeholder="TO: comma separated list of email addresses"></div>';
    cont += '<div><input style="width: 97%; margin-bottom: 3px;" type="text" id="share_subj" class="form-control" placeholder="Subject" value="' + user_name + ' has shared a chart with you"></div>';
    cont += '<div><textarea rows="10" class="textarea_full editable-textarea-data" style="width: 97%; margin-bottom: 3px;" id="mail_body" placeholder="Optional Message Body">'
            + '</textarea></div>';

    var footerContent = '<button class="flat-btn btn-primary" id="send-email">Share</button><button class="flat-btn btn-warning" data-dismiss="modal">Cancel</button>';

    $.genericModal(cont, "width:700px;overflow-y: auto;", "min-height:200px", "Share Chart", footerContent);

    var defaultMailBody = 'Please take a look at this chart on Michelangelo. <br/><a href=' + savedChartUrl + '>' + savedChartUrl + '</a>';

    $("#globalModal").find("#mail_body").val(defaultMailBody);

    $("#globalModal").find("#send-email").click(function() {

      var toAddresses = $("#globalModal").find("#to_address").val();
      var subj = $("#globalModal").find("#share_subj").val();
      var mailBody = $("#globalModal").find("#mail_body").val();

      MA.sendEmail(toAddresses, subj, mailBody);

    });
  };

  var saveAndShareChart = function(shareUrl, btn) {
    var message = '';
    var url = shareUrl;

    var saveConfig = clone(config);
    var saveData = clone(data);
    var saveAnnotationsData = clone(annotationsData);

    //sort annotations data
    var flagSerieKeys = Object.keys(saveAnnotationsData);

    for (k = 0; k < flagSerieKeys.length; k++) {
      var key = flagSerieKeys[k];
      if (saveAnnotationsData[key].data) {
        saveAnnotationsData[key].data.sort(createComparator("x"));
      }
    }

    //function (bodyDiv, modalStyle, bodyDivStyle, modalTitle)
    var bodyDiv = '<div class="row-fluid"><input class="modal-input"><h4 class="first-line">Chart title:</h4></input></div>'
            + '<div style="height:15px;"></div>'
            + '<div class="row-fluid"><input class="modal-comment-input"><h4 class="second-line">Comment:</h4></input></div>';

    var footerContent = '<button class="flat-btn btn-primary" id="save-chart" data-dismiss="modal">OK</button><button class="flat-btn btn-warning" data-dismiss="modal">Cancel</button>';

    $.genericModal(bodyDiv, "width:700px;overflow-y: auto;", "min-height:50px", "Chart Snapshot", footerContent);


    var serializeddata = {
      "config": saveConfig,
      "data": saveData,
      "annotationsData": saveAnnotationsData,
    };

    $("#save-chart").click(function() {

      var newTitle = $("#globalModal").find(".modal-input").val();

      if (newTitle && newTitle.trim() != "") {
        if (!saveConfig.title) {
          saveConfig.title = {};
        }
        saveConfig.title.text = newTitle;
      }

      var comment = $("#globalModal").find(".modal-comment-input").val();

      if (comment && (comment = comment.trim()) != "") {
        serializeddata.comment = comment;
      }

      $.ajax({
        beforeSend: function(request) {
          //$('#globalModal').html(progress_modal);
          //$('#progressModal').modal('show');
          request.setRequestHeader("ajax", true);
          request.setRequestHeader("current-page", window.location.pathname + window.location.search);
        },
        type: "POST",
        url: url,
        timeout: 15000,
        dataType: 'json',
        data: JSON.stringify(serializeddata),
        contentType: 'application/json',
        success: function(data) {
          if (data) {
            issuccess = (!data['error']);
            if (!issuccess) {
              if (data['errorMessage']) {
                message = message + data['errorMessage'];
              }
              if (data['exceptionMessage']) {
                message = message + "Exception: " + data['exceptionMessage'];
              }
              if (data['additionalMessage']) {
                message = message + data['additionalMessage'];
              }
            }
          }
        },
        error: function(data, status) {
          issuccess = false;
          if (status == 'timeout') {
            message = 'Server did not respond within set time limit of 15000 ms. ';
          } else {
            if (data) {
              if (data['errorMessage']) {
                message = message + data['errorMessage'];
              }
              if (data['exceptionMessage']) {
                message = message + data['exceptionMessage'];
              }
              if (data['additionalMessage']) {
                message = message + data['additionalMessage'];
              }
            }
          }
        }
      }).done(function(data, status, httpRequest) {
        //$('#progressModal').modal('hide');
        var url = httpRequest.getResponseHeader("REDIRECT");
        if (url) {
          window.location.replace(url);
          return;
        }
        if (issuccess) {
          var savedChartUrl = MA.hostAndPort() + MA.shareService + data;
          var mail = 'You just saved a chart on Michelangelo with title:' + newTitle + '<br/> You can access it here: <a href=' + savedChartUrl + '>' + savedChartUrl + '</a>';

          prepareShareChartModal(savedChartUrl);
          MA.sendEmail(MA.getLoggedInUser() + "@salesforce.com", "Chart saved on Michelangelo", mail, MA.teamEmailID, true);
        } else {
          $.globalErrorModal('Oh snap! There was an error in posting your comment! ', message);
        }
      }).fail(function() {
        //$('#progressModal').modal('hide');
        $.globalErrorModal('Oh snap! There was an error in posting your comment! ', message);
      });
    });

  };

  return {
    setContainerId: function(id) {
      conatainerId = id;
    },
    getChart: function() {
      return chart;
    },
    getContainerId: function() {
      return conatainerId;
    },
    setChartOptions: function(chartData, chartConfig, chartAnnotationsData) {
      data = chartData != undefined ? chartData : [];
      config = chartConfig != undefined ? chartConfig : {};
      annotationsData = chartAnnotationsData != undefined ? chartAnnotationsData : {};
    },
    getChartOptions: function() {
      return {
        data: data,
        config: config
      };
    },
    init: function(settings) {
      //chartDiv = sb.find('.chart-area')[0].id;
      if (settings) {
        config = settings.config != undefined ? settings.config : {};
        data = settings.data != undefined ? settings.data : [];
        annotationsData = settings.annotationsData != undefined ? settings.annotationsData : {};
      }
      this.config = config;
      chartDiv = sb.moduleContainer();
//        	config = sb.attr("data-chart_config");
//        	data = sb.attr("data-chart_data");

      drawChart();

      sb.listen({
        'prepared-chart-options': this.setChartOptions,
        'add-series': this.addSeries,
        'show-series': this.showSeries,
        'hide-series': this.hideSeries,
        'hide-all-series': this.hideAllSeries,
        'show-all-series': this.showAllSeries,
        'reset-chart': this.resetChart,
        'change-chart-type': this.changeChartType,
        'change-chart-scale': this.changeChartScale,
        'show-markers': this.showMarkers,
        'hide-markers': this.hideMarkers,
        'show-stack': this.showStack,
        'hide-stack': this.hideStack,
        'save-chart': this.saveAndShareChart,
        'redraw': this.redraw,
        'change-y': this.changeY,
        'reset-y': this.resetY,
        'xaxis-update': this.xAxisUpdate,
        'update-series': this.seriesUpdate,
        'display-downsample-info': this.updateDownsamplingInfo
      });
      this.chart = chart;
      return chart;
    },
    /** Adds highcharts downsampling information the yAxis for time series. */
    updateDownsamplingInfo: function() {
      if (this.chart !== null && this.chart.series !== null && $.isArray(this.chart.yAxis)) {
        var series = this.chart.series;
        for (var seriesIndex = 0; seriesIndex < series.length; seriesIndex++) {
          var points = series[seriesIndex].points;
          var previous = null;
          var current = null;
          var deltaMillis = null;
          for (i = 0; i < points.length; i++) {
            current = points[i];
            if (previous !== null) {
              var interval = current.x - previous.x;
              if (deltaMillis === null || interval < deltaMillis) {
                deltaMillis = interval;
              }
            }
            previous = current;
          }
          var timeAndUnit = this.maximumTimeUnit(deltaMillis);
          var yAxis = series[seriesIndex].yAxis;
          if (yAxis !== null) {
            var originalTitle = yAxis.axisTitle;
            if(originalTitle === undefined || originalTitle === null) {
              var newTitle = ' ['+timeAndUnit + '-avg] ';
              yAxis.update({
                title : {
                  text : newTitle
                }
              },true);
//              yAxis.setTitle(newTitle);
            } else {
              var newTitle = originalTitle.textStr.replace(/\s*\[.*-avg\]\s*/gi, '') + ' ['+timeAndUnit + '-avg] ';
              yAxis.axisTitle.attr({
                text: newTitle
              });
            }
          } else {
            this.chart.addAxis({
              title: {
                text: ' ['+timeAndUnit + '-avg] '
              },
            },false, true);
          }
        }
      }
    },
    /**
     * Converts millis to the most reasonable time unit to display, not to exceed 'months'.
     * @param millis The millis to convert.
     * @returns The maximum converted time unit, "1.23d" for example.
     */
    maximumTimeUnit: function(millis) {
      var seconds = millis / 1000.0;
      if (seconds < 60) {
        return Number(seconds).toFixed(0) + "s";
      } else if (seconds < 3600) {
        return Number(seconds / 60.0).toFixed(0) + "m";
      } else if (seconds < 86400) {
        return Number(seconds / 3600.0).toFixed(0) + "h";
      } else if (seconds < 604800) {
        return Number(seconds / 86400.0).toFixed(0) + "d";
      } else if (seconds < 2419200) {
        return Number(seconds / 604800.0).toFixed(0) + "w";
      } else {
        return Number(seconds / 2419200.0).toFixed(0) + "M";
      }
    },
    destroy: function() {
      chart = null;
      sb.ignore(['display-downsample-info', 'add-item', 'hide-series', 'hide-all-series', 'show-all-series', 'reset-chart', 'change-chart-type', 'change-chart-scale', 'show-markers', 'hide-markers']);
    },
    /**
     * input : array of series to add
     */
    addSeries: function(series) {

    },
    hideSeries: function(seriesId) {
      var allSeries = this.chart.series;
      if (seriesId) {
        if (MA.is_arr(seriesId)) {
          //TODO: handle this
        } else {
          //id of series
          if (seriesId.indexOf("flag") == 0) {
            //find and toggle flag controller buttons
            var chart_div = this.chart.renderTo.id;
            //console.log("hideSeries triggered in chart " + chart_div);
            var input = $("#" + chart_div).find('input').
                    filter(
                            function() {
                              return $(this).attr("seriesId") === seriesId;
                            });
            if (input.hasClass("clicked")) {
//              input.attr("stop-trigger", true);
//              input.click();
            }
          }
          else {
            //TODO: handle this
          }
        }
      }
    },
    showSeries: function(seriesId) {
      var allSeries = this.chart.series;
      if (seriesId) {
        if (MA.is_arr(seriesId)) {
          //TODO: handle this
        } else {
          //id of series
          if (seriesId.indexOf("flag") == 0) {
            //find and toggle flag controller buttons
            var chart_div = this.chart.renderTo.id;
            //console.log("showSeries triggered in chart " + chart_div);
            var input = $("#" + chart_div).find('input').
                    filter(
                            function() {
                              return $(this).attr("seriesId") === seriesId;
                            });
            if (input.hasClass("unclicked")) {
//              input.attr("stop-trigger", true);
//              input.click();
            }
          }
          else {
            //TODO: handle this
          }
        }
      }
    },
    showAllSeries: function(series) {

    },
    hideAllSeries: function(series) {

    },
    addAxis: function(axisType, axisName) {

    },
    removeAxis: function(axisType, axisName) {

    },
    resetChart: function() {
    //	console.log("Reset chart Triggered!!!");
    	if(this.chart){
    		var chartDivId = this.chart.renderTo.id;
    		$("#"+chartDivId).siblings().remove();
    		this.chart.destroy();
    	}
    	this.destroy();
    	this.init({config: this.config});
    },
    changeChartType: function(toType) { //fromType param is not needed because this module can look at the chart object to figure that out

    },
    changeChartScale: function(toScale) {

    },
    showMarkers: function() {

    },
    hideMarkers: function() {

    },
//        showStack : function(stackName) {
//        	var matchingSeries = [];
//        	var allSeries = chart.series;
//        	if(allSeries && is_arr(allSeries)){
//        		for(i = 0; i < allSeries.length; i++) {
//        			if(allSeries[i].options.stack && allSeries[i].options.stack.trim().toLowerCase() === stackName.trim().toLowerCase()) {
//        				matchingSeries.push(allSeries[i]);
//        			}
//        		}
//        	}
//        	if(matchingSeries.length > 0) {
//        		for(i = 0; i < matchingSeries.length; i++) {
//
//        			matchingSeries[i].show();
//
//        				if(matchingSeries[i].options.linkedTo) {
//            				var parentSeries = seriesById[matchingSeries[i].options.linkedTo];
//            				var linkedSeries = parentSeries.linkedSeries;
//            				var showCount = 0;
//            				var hideSeries = [];
//            				var showSeries = [];
//            				for(j = 0; j < linkedSeries.length ;j++) {
//            					if(linkedSeries[j].visible) {
//            						showCount ++;
//            					} else {
//            						hideSeries.push(linkedSeries[j]);
//            					}
//            				}
//            				if(j > 0 && showCount > 0){
//            					parentSeries.show();
//            					visibleParentSeries.push(parentSeries.options.id);
//            				} for(j = 0; j < hideSeries.length; j++) {
//            					hideSeries[j].hide();
//            				}
//            			}
//        		}
//        	}
//
//        	var stackLabels = $("#" + chartDiv + " .highcharts-stack-labels div");
//			var stackLabelsHighchartSpan = $("#" + chartDiv + " .highcharts-stack-labels span");
//			for(i = 0; i < stackLabels.length; i ++) {
//				if($(stackLabels[i]).attr("stack") && $(stackLabels[i]).attr("stack") === stackName) {
//					$(stackLabelsHighchartSpan[i]).show();
//				}
//			}
//        },
    showStack: function(stackName) {
      var matchingSeries = [];
      var allSeries = chart.series;
      if (allSeries && is_arr(allSeries)) {
        for (i = 0; i < allSeries.length; i++) {
          if (allSeries[i].options.stack && allSeries[i].options.stack.trim().toLowerCase() === stackName.trim().toLowerCase()) {
            matchingSeries.push(allSeries[i]);
          }
        }
      }
      if (matchingSeries.length > 0) {
        for (i = 0; i < matchingSeries.length; i++) {

          if (matchingSeries[i].options.linkedTo) {
            var parentSeries = seriesById[matchingSeries[i].options.linkedTo];
            var linkedSeries = parentSeries.linkedSeries;
            var showCount = 0;
            var hideSeries = [];
            var showSeries = [];
            for (j = 0; j < linkedSeries.length; j++) {
              if (linkedSeries[j].visible) {
                showCount++;
              } else if (matchingSeries[i].options.id && (linkedSeries[j].options.id != matchingSeries[i].options.id)) {
                hideSeries.push(linkedSeries[j]);
              }
            }
            if (showCount > 0) {
              matchingSeries[i].show();
            }
//                        if(j > 0 && showCount == linkedSeries.length){
//                            visibleParentSeries.push(parentSeries.options.id);
//                        }
            for (h = 0; h < hideSeries.length; h++) {
              hideSeries[h].hide();
            }
          }
        }
      }

      var stackLabels = $("#" + chartDiv + " .highcharts-stack-labels div");
      var stackLabelsHighchartSpan = $("#" + chartDiv + " .highcharts-stack-labels span");
      for (i = 0; i < stackLabels.length; i++) {
        if ($(stackLabels[i]).attr("stack") && $(stackLabels[i]).attr("stack") === stackName) {
          $(stackLabelsHighchartSpan[i]).show();
        }
      }
    },
    hideStack: function(stackName) {
      var matchingSeries = [];
      var allSeries = chart.series;
      if (allSeries && is_arr(allSeries)) {
        for (i = 0; i < allSeries.length; i++) {
          if (allSeries[i].options.stack && allSeries[i].options.stack.trim().toLowerCase() === stackName.trim().toLowerCase()) {
            matchingSeries.push(allSeries[i]);
          }
        }
      }

      //show all the linked series if stack name does not match
      if (matchingSeries.length > 0) {
        for (i = 0; i < matchingSeries.length; i++) {
          matchingSeries[i].hide();
          if (matchingSeries[i].options.linkedTo) {
            var parentSeries = seriesById[matchingSeries[i].options.linkedTo];
            var linkedSeries = parentSeries.linkedSeries;
            var hiddenCount = 0;
            for (j = 0; j < linkedSeries.length; j++) {
              if (!linkedSeries[j].visible) {
                hiddenCount++;
              }
            }
            if (j > 0 && linkedSeries.length == hiddenCount) {
              parentSeries.hide();
            }
          }
        }
      }

      //hide stack labels
      var stackLabels = $("#" + chartDiv + " .highcharts-stack-labels div");
      var stackLabelsHighchartSpan = $("#" + chartDiv + " .highcharts-stack-labels span");
      for (i = 0; i < stackLabels.length; i++) {
        if ($(stackLabels[i]).attr("stack") && $(stackLabels[i]).attr("stack") === stackName) {
          $(stackLabelsHighchartSpan[i]).hide();
        }
      }
    },
    redraw: function() {
      this.chart.redraw();
    },
    changeY: function(min, max) {
      this.chart.yAxis[0].setExtremes(min, max);
    },
    resetY: function() {
      var initMin = this.config.yAxis.min;
      var initMax = this.config.yAxis.max;
      this.chart.yAxis[0].setExtremes(initMin, initMax);
    },
    xAxisUpdate: function(options, additionalData, doRedraw) {
      var xAxis = this.chart.xAxis[0];

      if (additionalData) {
        if (additionalData.offset) {
          if (!options) {
            options = {};
          }
          options.min = xAxis.min + additionalData.offset;
          options.max = xAxis.max + additionalData.offset;
        }
      }

      this.chart.xAxis[0].update(options, doRedraw);
    },
    seriesUpdate: function(series, doRedraw) {
      //var series = this.chart.options[seriesKey];
      if (series) {
        for (ser = 0; ser < series.length; ser++) {
          if (series[ser]) {

            if (is_obj(series[ser]) && series[ser].data && series[ser].data.length > 0) {
              var serieName = series[ser].name;
              if (this.chart.series) {
                var serie = undefined;
                for (x in this.chart.series) {
                  if (this.chart.series[x] && this.chart.series[x].name === serieName) {
                    serie = this.chart.series[x];
                    break;
                  }
                }
                if (serie === undefined) {
                  this.chart.addSeries(series[ser]);
                  //4th param is updateDataPoints which might fail if olddata point has null values for x and y
                  this.chart.series[ser].setData(series[ser].data, doRedraw, false, false);
                } else {
                  serie.setData(series[ser].data, doRedraw, false, false);
                }
              }
              else {
                this.chart.addSeries(series[ser]);
                this.chart.series[ser].setData(series[ser].data, doRedraw, false, false);
              }

            }

          }
        }
      }
    }
    /**
     * Will need to modify highcharts js to provide hook into this event
     */
    //setZoom : function() {}
  };
}, '0.1', {
  requires: ['jquery.js', 'highstock.js', 'highcharts-more.js']
});

CHARTING_ENGINE.create_module("custom-legend", function(sb) {
  var chartsData = [],
          container,
          allSeries;

  //TODO: move these methods to MA namespace
  var is_obj = function(obj) {
    return jQuery.isPlainObject(obj);
  };

  var is_arr = function(arr) {
    return jQuery.isArray(arr);
  };

  var obj_size = function(obj) {
    if (obj && is_obj(obj)) {
      return Object.keys(obj).length;
    }
    else
      return 0;
  };

  //TODO: add support for dataloader.Right now this supports data only
  var buildCustomLegend = function() {
    //TODO: change data fromat to map!!
    var dataMap = {};
    //{"na1--db_cputime--sum1":{"data":[{"na1.db_cputime.sum_baseline":[[1399248000000,3007]
    if (obj_size(chartsData) > 0) {
      var chartDivs = Object.keys(chartsData);
      for (i = 0; i < chartDivs.length; i++) {
        var chartSpecificData = chartsData[chartDivs[i]];
        var data = chartsData[chartDivs[i]].data;
        if (data) {
          for (j = 0; j < data.length; j++) {
            var serieData = data[j];
            var serieName = Object.keys(serieData)[0];
            if (!dataMap[serieName]) {
              dataMap[serieName] = {};
            }
            dataMap[serieName][chartDivs[i]] = data[j][serieName];
          }
        }
      }
    }
    if (obj_size(dataMap) > 0) {
      var legendId = container + "_legend";
      var conatainerWidth = $("#" + container).width();

      var $legendContainer = $('<div id="' + legendId + '" style="width:' + conatainerWidth + 'px;display:inline;">');
      $("#" + container).append($legendContainer);

      $legendContainer.css({
        backgroundColor: '#ffffff'
      });

      var select = $('<select multiple="true"><option></option>').appendTo(
              $legendContainer);


      for (s = 0; s < allSeries.length; s++) {
        /**
         * map of chartdiv to data for that chart for this series
         */
        chartDataMap = {};

        var id = "legend_" + MA.generateRandomId();
        //series[s]["dataLoaderParams"] ? JSON.stringify(series[s]["dataLoaderParams"]) : null
        $('<option serieName = "' + allSeries[s]["name"] + '" id="' + id + '" class= "legend-item" data=' + (dataMap[allSeries[s]["name"]] ? JSON.stringify(dataMap[allSeries[s]["name"]]) : undefined) + '>' + (allSeries[s]["display"] ? allSeries[s]["display"] : allSeries[s]["name"]) + '</option>')
                .appendTo(select);

      }

      select.select2({
        width: "100%",
        allowClear: true,
        placeholder: "Select metric(s):"
      });

      $legendContainer.find('.select2-choices').css({
        border: "0px",
        backgroundImage: "none !important"
      });

      $legendContainer.find('.select2-container-multi').css({
        maxHeight: "105px",
        minHeight: "32px",
        overflow: "auto",
        backgroundColor: "#ffffff",
        fontFamily: "Times New Roman",
        fontSize: "14px"
      });

      var select = $('#' + legendId).find('.select2-offscreen');

      //on change
      select.on("change", function(e) {

        var val = e.val;
        var toggleSeries = true;

        if (e.toggleSeries != undefined) {
          //console.log("toggleSeries " + toggleSeries + " sent with change call.");
          toggleSeries = e.toggleSeries;
        }

        //NOTE: e.removed && e.aaded could be an array or object. If it's coming from the setting value array of select2, its an array
        if (e.removed && (is_obj(e.removed) || (is_arr(e.removed) && e.removed.length > 0))) {
          //hide the series

          if (is_obj(e.removed)) {
            if (toggleSeries) {
              clickItem($(e.removed.element), $(this));
            }
          }
          else if (is_arr(e.removed)) {
            for (r = 0; r < e.removed.length; r++) {
              if (toggleSeries) {
                clickItem($(e.removed[r]["element"]), $(this));
              }

            }
          }
        } else if (e.added && (is_obj(e.added) || (is_arr(e.added) && e.added.length > 0))) {
          //show series

          if (is_obj(e.added) && toggleSeries) {
            clickItem($(e.added.element), $(this));
          }
          else if (is_arr(e.added) && toggleSeries) {
            for (r = 0; r < e.added.length; r++) {
              clickItem($(e.added[r]["element"]), $(this));
            }
          }

        }
      });
      return legendId;
    }

    return undefined;

  };

  /**
   * Legend item click handler for custom (select2) legend
   */
  var clickItem = function(legendItem, select) {

    if (chartsData) {

      var linkedSeries = [];

      var data = legendItem.attr('data');
      if (data && data != "") {
        data = JSON.parse(data);
      }

      var serieName = legendItem.attr('serieName');

      var seriesData = data;

      var chartDivs = Object.keys(seriesData);

      //TODO: do not control charts from here. Send message instead
      for (c = 0; c < chartDivs.length; c++) {
        var chart = $("#" + chartDivs[c]).highcharts();
        var chartData = seriesData[chartDivs[c]].data;
        var serie;

        for (x in chart.series) {
          if (chart.series[x] && chart.series[x].name === serieName) {
            if (!chart.series[x].options.linkedTo) {
              serie = chart.series[x];
            } else {
              linkedSeries.push(chart.series[x]);
            }

          }
        }
        if (serie) {
          if (serie.visible) {
            serie.hide();
            //TODO: why is this needed? linkedseries should hide on their own
                for (l = 0; l < linkedSeries.length; l++) {
                    if (linkedSeries[l].visible) {
                        linkedSeries[l].hide();
                    }
                }
          } else {
            serie.show();

            for (l = 0; l < linkedSeries.length; l++) {
                if (!linkedSeries[l].visible) {
                    linkedSeries[l].show();
                }
            }
            select.parent().find('.select2-search-choice:last').css({
              color: serie.color
            });
          }

        } else {

          if (chartData) {

            chart.addSeries({
              "name": serieName,
              "data": chartData,
            });

            select.parent().find('.select2-search-choice:last').css({
              color: chart.series[chart.series.length - 1].color
            });
          }
          else {
            //log error
            console.log("No dataLoader method found.");
          }

        }
      }

    }

  };

  var loadInitSeries = function(legendId) {
    var initSeries = {};
    var initSeriNames;
    for (i = 0; i < allSeries.length; i++) {
      initSeries[allSeries[i]["name"]] = allSeries[i];
    }
    initSeriNames = Object.keys(initSeries);
    var selected = [];
    if (initSeries) {
      $("#" + legendId)
              .find('.legend-item')
              .each(
                      function() {
                        var legendItem = this;

                        if (initSeriNames.indexOf($(legendItem).attr("serieName")) > -1) {
                          selected.push($(legendItem).html());
                        }
                      });

      $("#" + legendId).find("select").select2("val", selected, false);

      for (s = 0; s < initSeriNames.length; s++) {
        var serieColor = undefined;
        var serieColor = initSeries[initSeriNames[s]].color;

        var item = $("#" + legendId)
                .find('.select2-search-choice div')
                .filter(
                        function() {
                          var serieDisplay = (initSeries[initSeriNames[s]].display ? initSeries[initSeriNames[s]].display : initSeries[initSeriNames[s]].name);
                          return $.trim($(this).text()) === serieDisplay;

                        }).css({
          "color": serieColor
        });
      }
    }

  };
  return {
    init: function(settings) {

      chartsData = settings.chartsData;
      allSeries = settings.allSeries;

      container = settings.container;
      var legendId = buildCustomLegend();
      if (legendId) {
        loadInitSeries(legendId);
      }
    },
    destroy: function() {
      chartData = null;
    }
  };

}, '0.1', {
  requires: ['jquery.js', 'highstock.js', 'highcharts-more.js']
});

CHARTING_ENGINE.create_module("central-zoom", function(sb) {
  //all charts controlled by this zoom
  var charts = [],
          container;

  /**
   * build the central zoom here
   */
  var buildCentralZoom = function() {

  };

  return {
    init: function(settings) {
      //chartDiv = sb.find('.chart-area')[0].id;
      if (settings) {
        charts = settings.chart;
      }

      container = sb.moduleContainer();
      return undefined;
    },
    destroy: function() {
      charts = null;
    }
  };

}, '0.1', {
  requires: ['jquery.js', 'highstock.js', 'highcharts-more.js']
});
