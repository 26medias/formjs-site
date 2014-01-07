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
		
		
		
		
		gendoc: {
			require:		[],
			auth:			false,
			description:	"Regenerate the doc for the API methods.",
			params:			{},
			status:			'dev',
			version:		1,
			callback:		function(params, req, res, callback) {
				
				res.render("doc", {
					endpoints:	Gamify.api.endpoints,
					systoken:	Gamify.settings.systoken
				}, function(err, html) {
					callback(html);
				});
			}
		}
		
	};
	
	// Init a connection
	this.mongo		= new this.Gamify.mongo({database:Gamify.settings.db});
	this.mongo_old	= new this.Gamify.mongo({database:'fleetwit'});
	this.mongo.init(function() {
		scope.mongo_old.init(function() {
			callback(methods);
		});
	});
}
exports.api = api;