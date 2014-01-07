var _ 					= require('underscore');
var qs 					= require("querystring");
var request 			= require('request');

// Users
function api() {
	
}
api.prototype.init = function(Gamify, callback){
	var scope = this;
	
	this.Gamify = Gamify;
	
	// Return the methods
	var methods = {
		
		encode: {
			require:		['location'],
			auth:			false,
			description:	"Receive a natural language location, and output the precise data for that location: city, state, country, zipcode, timezone, GPS coordinates, corected address, ...",
			params:			{location:"string"},
			status:			'stable',
			version:		1,
			callback:		function(params, req, res, callback) {
				
				var url;
				if (typeof params.location == "object") {
					url = 'http://maps.googleapis.com/maps/api/geocode/json?sensor=false&latlng='+escape(params.location.lat)+","+escape(params.location.lng);
				} else {
					url = 'http://maps.googleapis.com/maps/api/geocode/json?sensor=false&address='+params.location;
				}
				console.log("\033[35m url:\033[37m",url);
				
				request.get(url, function (error, response, body) {
					
					if (!error && response.statusCode == 200) {
						var data 	= JSON.parse(body);
						
						console.log("data",JSON.stringify(data,null,4));
						
						if (data.results.length == 0) {
							callback(Gamify.api.errorResponse("The location \""+params.location+"\" is invalid."));
						} else {
							
							data 		= data.results[0];
							
							var keys = {
								postal_code:					"zipcode",
								locality:						"city",
								administrative_area_level_1:	"state",
								country:						"country"
							};
							var i;
							var j;
							var output = {
								levels:		{},
								address:	data.formatted_address?data.formatted_address:false,
								gps:		{
									lat: 	data.geometry.location.lat,
									lng: 	data.geometry.location.lng
								},
								geojson:	{
									type:			"point",
									coordinates:	[data.geometry.location.lng, data.geometry.location.lat]
								}
							};
							for (i in data.address_components) {
								for (j in data.address_components[i].types) {
									if (keys[data.address_components[i].types[j]]) {
										output.levels[keys[data.address_components[i].types[j]]] = data.address_components[i].short_name;
									}
								}
							}
							
							output.public	= output.levels.city+", "+output.levels.state+" ("+output.levels.country+")"
							
							// Get the timezone now
							// "https://maps.googleapis.com/maps/api/timezone/json?location=".$output["lat"].",".$output["lng"]."&timestamp=".time()."&sensor=false"
							request.get('https://maps.googleapis.com/maps/api/timezone/json?location='+data.geometry.location.lat+","+data.geometry.location.lng+"&timestamp="+Math.round(new Date().getTime()/1000)+"&sensor=false", function (error, response, body) {
								
								if (!error && response.statusCode == 200) {
									var data 	= JSON.parse(body);
									
									output.timezone	= data.timeZoneId;
									
									callback(output);
								}
							});
						}
					}
				});
			}
		}
	};
	
	// Init a connection
	this.mongo	= new this.Gamify.mongo({database:Gamify.settings.db});
	this.mongo.init(function() {
		callback(methods);
	});
}
exports.api = api;