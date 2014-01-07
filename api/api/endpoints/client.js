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
		
		create: {
			require:		[],
			auth:			'sys',
			description:	"Create a new client.",
			params:			{},
			status:			'stable',
			version:		1,
			callback:		function(params, req, res, callback) {
				
				params	= scope.Gamify.api.fixTypes(params, {});
				
				scope.mongo.insert({
					collection:		'clients',
					data:			params
				}, function() {
					scope.Gamify.api.execute("race","paginate", {}, function(response) {
						callback(response[0]);
					});
				});
			}
		},
		
		
		
		find: {
			require:		[],
			auth:			false,
			description:	"Find a client.",
			params:			{query:"MongoDB Query"},
			status:			'stable',
			version:		1,
			callback:		function(params, req, res, callback) {
				
				scope.mongo.find(_.extend({
					collection:	"clients",
					query:		params
				}, params), function(response) {
					callback(response);
				});
			}
		},
		
		
		
		paginate: {
			require:		[],
			auth:			false,
			description:	"Paginate the clients",
			params:			{query:"MongoDB Query"},
			status:			'stable',
			version:		1,
			callback:		function(params, req, res, callback) {
				
				params	= _.extend({
					perpage:	5,
					page:		1
				},params);
				
				scope.mongo.paginate(_.extend({
					collection:	"clients",
					query:		{},
					sort:		{
						name:	true
					}
				}, params), function(response) {
					var nextParam		= _.extend({},params);
					nextParam.page 		= response.pagination.current+1;
					var prevParam		= _.extend({},params);
					prevParam.page		= response.pagination.current-1;
					
					response.next		= response.pagination.current >= response.pagination.pages ? false : req.path+"?"+qs.stringify(nextParam);
					response.previous	= response.pagination.current <= 1 ? false : req.path+"?"+qs.stringify(prevParam);
					
					// Get the list of client ids
					var clientIds = [];
					var i;
					for (i in response.data) {
						clientIds.push(response.data[i].client);
					}
					
					// Get the clients now
					
					callback(response);
				});
			}
		}
		
	};
	
	// Init a connection
	this.mongo	= new this.Gamify.mongo({database: this.Gamify.settings.db});
	this.mongo.init(function() {
		callback(methods);
	});
}
exports.api = api;