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
		
		
		
		
		importWords: {
			require:		[],
			auth:			false,
			description:	"Import leeched wordlists",
			params:			{},
			status:			'dev',
			version:		1,
			callback:		function(params, req, res, callback) {
				scope.mongo.insert({
					collection:	"wordlists",
					data:	{
						category:	params.category,
						words:		params.words
					}
				}, function() {
					callback(params);
				});
			}
		}
		
	};
	
	// Init a connection
	this.mongo		= new this.Gamify.mongo({database:Gamify.settings.db});
	this.mongo.init(function() {
		callback(methods);
	});
}
exports.api = api;