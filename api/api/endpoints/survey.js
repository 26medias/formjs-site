var _ 					= require('underscore');
var qs 					= require("querystring");

// Users
function api() {
	
}
api.prototype.init = function(Gamify, callback){
	var scope = this;
	
	this.Gamify = Gamify;
	
	// Return the methods
	var methods = {
		
		
		post: {
			require:		['data','alias'],
			params:			{data:'surveydata',alias:'Alias of the survey'},
			auth:			'authtoken',
			description:	"Save the survey data",
			status:			'stable',
			version:		1,
			callback:		function(params, req, res, callback) {
				
				// Check if ther user already answered that survey
				scope.Gamify.api.execute("survey","has_answered", {
					authtoken:		params.authtoken,
					__auth:			params.__auth,
					__authcheck:	scope.Gamify.settings.systoken,
					alias:			params.alias
				}, function(response) {
					if (response.answered) {
						 callback({duplicate:true});
					} else {
						
						scope.Gamify.api.execute("user","getMetas", {
							authtoken:		scope.Gamify.settings.systoken,
							query:			{
								uid:	params.__auth
							}
						}, function(metas) {
							scope.mongo.insert({
								collection:		"surveys",
								data:			{
									date:			new Date(),
									uid:			params.__auth,
									metas:			metas,
									race:			params.alias,
									data:			params.data
								}
							}, function() {
								callback({saved:true});
							});
						});
						
					}
				});
			}
		},
		
		
		has_answered: {
			require:		['alias'],
			auth:			'authtoken',
			description:	"Check if the user is registered to the race.",
			params:			{query:'MongoDB Query'},
			status:			'stable',
			version:		1,
			callback:		function(params, req, res, callback) {
				
				
				scope.mongo.count({
					collection:	'surveys',
					query:		{
						uid:	params.__auth,
						alias:	params.alias
					}
				}, function(count) {
					if (count > 0) {
						callback({answered: true});
					} else {
						callback({answered: false});
					}
					
				});
			}
		},
	};
	
	// Init a connection
	this.mongo	= new this.Gamify.mongo({database:Gamify.settings.db});
	this.mongo.init(function() {
		callback(methods);
	});
}
exports.api = api;