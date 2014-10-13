/**
 * @author bbhati
 * 
 * Serves as a mediator between the core application code and the charting
 * modules, as well as a mediator between the various charting modules
 */

var ChartingSandbox = {
		
	create : function(core, moduleID, inDivId) {
		//var module_container = core.dom.query("#" + moduleID);
		var module_container = jQuery("#" + moduleID);
		return {
			moduleContainer : function () {
				return inDivId;
			},
			find : function(selector) {
				//return module_container.query(selector);
				return module_container.find(selector);
			},
			attr : function(selector) {
				return module_container.attr(selector);
			},
			addEvent : function(element, evt, fn) {
				core.dom.bind(element, evt, fn);
			},
			removeEvent : function(element, evt, fn) {
				core.dom.unbind(element, evt, fn);
			},
			notify : function(event) {
				if (core.is_obj(event) && event.type) {
					core.triggerEvent(event, moduleID, inDivId);
				}
			},
			listen : function(events) {
				if (core.is_obj(events)) {
					core.registerEvents(events, moduleID);
				}
			},
			ignore : function(events) {
				if (core.is_obj(events)) {
					core.removeEvents(events, moduleID);
				}
			},
			create_element : function (el, config) {
                var i, child, text;
                el = core.dom.create(el);
                
                if (config) {
                    if (config.children && core.is_arr(config.children)) {
                        i = 0;
                        while(child = config.children[i]) {
                            el.appendChild(child);
                            i++;
                        }
                        delete config.children;
                    }
                    if (config.text) {
                        el.appendChild(document.createTextNode(config.text));
                        delete config.text;
                    }
                    core.dom.apply_attrs(el, config);
                }
                return el;
            }
		};
	}
};