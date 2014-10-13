highchartsExperiments
=====================
normalizedAxis.js is a highcharts extension to provide a custom button to normalize and denormalize a chart's yAxis. 
This works for a multiple yAxis chart.When normalized, the yAxis are merged together into a percentage axi and the normalized values are calculated per series dividing the current value with the max for the series.



chart_module.js is a wrapper around the highcharts library to use it as a module. This module is written using the revealing module design pattern.
Together chart_module, chart_engine and chart_sandbox use the modular, pub-sub, mediator patterns such that the sandbox acts as a mediator between the module and the engine. All events are registered with and triggered using the engine. However the module talks to the sandbox for the events it is interested in or if it wants to publish some event.
