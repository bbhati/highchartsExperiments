/**
 * @author bbhati
 *
 *The core app that controls all charting related stuff  
 */
var CHARTING_ENGINE = (function(){

	//data for all the registered modules
	var moduleData = {},
		//data for instances of modules on page
		moduleInstancesData = {},
		relations= {},
		debug = true;
	
	return {
		debug : function (on) {
			debug = on ? true : false;
		},
		
		create_module : function (moduleID, creator, version, config) {
			var temp;
			if(config && this.is_obj(config)) {
				if(config.requires) {
					//TODO: Add check for if the libs  required by this module are present.
					//var requiredJS = config.required;
				}
			}
			if(typeof moduleID === 'string' && typeof creator === 'function'){
				temp = creator(ChartingSandbox.create(this, moduleID));
				if(temp && this.is_obj(temp) && temp.init && typeof temp.init === 'function' && temp.destroy && typeof temp.destroy === 'function') {
					moduleData[moduleID] = {
							create : creator,
							instance : null
					};
					temp = null;
				} else {
					this.log(1, "Module '" + moduleID + "' Registration : FAILED : module has no init ot destroy method" );
				}
			} else {
				this.log(1, "Module '" + moduleID + "' Registration : FAILED : one or more arguments are of incorrect type." );
			}
		},
		callMethod : function (moduleID, inDivId, methodName, params) {
			var mod = moduleData[moduleID + "_" + inDivId];
			if (mod) {
				mod.instance = mod.create(ChartingSandbox.create(this, moduleID));
				// find object
				var fn = mod.instance[methodName];
				 
				// is object a function?
				if (typeof fn === "function") fn.apply(null, params);
			}
		},
		
		start : function (moduleID, inDivId, settings) {
			var mod = moduleData[moduleID];
			var modClone = undefined;
			if (mod) {
				modClone = this.clone(mod);
				moduleInstancesData[moduleID + "_" + inDivId] = modClone;
				if(!mod.clones) {
					mod.clones = [];
				}
				mod.clones.push(moduleID + "_" + inDivId);
				if(!modClone.instance){
					modClone.instance = modClone.create(ChartingSandbox.create(this, moduleID, inDivId));
				}
				return modClone.instance.init (settings);
			}
		},
	
		stop : function (moduleID, inDivId) {
			var data;
			if(data = moduleInstancesData[moduleID + "_" + inDivId] && data.instance) {
				data.instance.destroy();
				data = null;
			} else {
				this.log(1, "Stop Module '" + moduleID + "' : FAILED : module does not exist or not started.");
			}
		},
		
		start_all : function () {
			var moduleID;
			for(moduleID in moduleData) {
				if(moduleData.hasOwnProperty(moduleID)) {
					this.start(moduleID);
				}
			}
		}, 
		
		stop_all : function () {
			var moduleID;
			for(moduleID in moduleData) {
				if(moduleData.hasOwnProperty(moduleID)) {
					this.stop(moduleID);
				}
			}
		},
		registerEvents : function (evts, moduleID) {
			if(this.is_obj(evts) && moduleData[moduleID]) {
				moduleData[moduleID].events = evts;
				var mod = moduleData[moduleID];
				var allInstances = mod.clones;
				if(allInstances && allInstances.length > 0) {
					for(a = 0; a< allInstances.length; a++){
						moduleInstancesData[allInstances[a]].events = evts;
					}
				}
			} else {
				//log error
			}
		},
		removeEvents : function (moduleID) {
			if(mod = moduleData[moduleID] && mod.events) {
				delete mod.events;
			} else {
				//log error
			}
		},
		triggerEvent : function (evt, modId) {
			var mod;
			for (moduleId in moduleData) {
				if(moduleData.hasOwnProperty(moduleId)) {
					mod = moduleData[moduleId];
					if(mod.events && mod.events[evt.type]) {
						//NOTE: assuming that evt.data is always an array if the evt.type takes a single argument, evt.data is passed as an array containing that single argument. 
						if(mod.events[evt.type] && typeof mod.events[evt.type] === "function"){
							//mod.events[evt.type].apply(null, evt.data);
							var allInstances = mod.clones;
							if(allInstances && allInstances.length > 0) {
								for(a = 0; a< allInstances.length; a++){
									if(!evt.forDivs || evt.forDivs.length == 0) {
										moduleInstancesData[allInstances[a]]["events"][evt.type].apply(moduleInstancesData[allInstances[a]].instance, evt.data);
									}
									else {
										if(evt.forDivs.indexOf(allInstances[a].substring(moduleId.length+1)) > -1) {
											moduleInstancesData[allInstances[a]]["events"][evt.type].apply(moduleInstancesData[allInstances[a]].instance, evt.data);
										}
									}
								}
							}
						}
					}
				}
			}
		},
		is_obj : function(obj) {
			return jQuery.isPlainObject(obj);
		},
		is_arr : function(arr) {
			return jQuery.isArray(arr);
		},
		clone : function(obj) {
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
                for (var i = 0, len = obj.length; i < len; i++) {
                    copy[i] = this.clone(obj[i]);
                }
                return copy;
            }

            // Handle Object
            if (obj instanceof Object) {
                var copy = {};
                for (var attr in obj) {
                    if (obj.hasOwnProperty(attr)) copy[attr] = this.clone(obj[attr]);
                }
                return copy;
            }

            throw new Error("Unable to copy obj! Its type isn't supported.");
        },
        /**
         * arr of all relations between modules
         * e.g., there's a big navigator on page which controls the zoom of all charts,
         * then relation obj will be {"Zoom_module" : [{id: "big-zoom-control", related : [{"chart-box" : ["chart1-div", "chart2-div"]},{"zoom-percent-box": ["main-zoom-percent-div"]}]},
         * "week-zoom-control", related : [{"chart-box" : [......]}]]} 
         */
        addRelations : function (){
        	
        },
		log : function (severity, msg) {
			console [ (severity === 1) ? 'log' : ( (severity === 2 ? 'warn' : 'error') )](msg);
		},
		dom : {
			query : function (selector, context) {
				var result = {}, that = this, jqEls, i = 0; 
				
				if(context && context.find) {
					jqEls = context.find(selector);
				} else {
					jqEls = jQuery.find(selector);
				}
				result = jQuery.get(); //array of dom elements [<li></li>, <li></li>]
				result.length = jqEls.length;
				result.query = function(sel){
					that.query(sel, jqEls);
				};
				return result;
			},
			bind : function (element, evt, fn) {
				//only 2 arguments are compulsary
				if(element && evt) {
					if(typeof evt === 'function') {
						jQuery(element).bind('click', evt);
					} else {
						jQuery(element).bind(evt, fn);
					}
				}
			},
			unbind : function (element, evt, fn) {
				if(element && evt) {
					if(typeof evt === 'function') {
						jQuery(element).unbind('click', evt);
					} else {
						jQuery(element).unbind(evt, fn);
					}
				}
			}, 
			create_elemnt : function (el) {
				return document.createElement(el);
			},
			add_attrs : function (attrs, el) {
				jQuery(el).attr(attrs);
			}
		}
	};
}());