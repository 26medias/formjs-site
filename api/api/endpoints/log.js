var _ 					= require('underscore');
var qs 					= require("querystring");
var fbapi 				= require('facebook-api');
var moment				= require('moment');

// Users
function api() {
	
}
api.prototype.init = function(Gamify, callback){
	var scope = this;
	
	this.Gamify = Gamify;
	
	// Return the methods
	var methods = {
		
		fbinvite: {
			require:		['fbreq'],
			params:			{},
			auth:			"authtoken",
			description:	"Save who a user has invited using facebook",
			status:			'stable',
			version:		1,
			callback:		function(params, req, res, callback) {
				
				// Update the user's data
				scope.mongo.update({
					collection:	"users",
					query:		{
						uid:	params.__auth	// The auth method pass that __auth data into the params
					},
					data:		{
						$addToSet:	{
							"data.fbinvites":	{
								$each:	params.fbreq.to
							}
						}
					}
				}, function(response) {
					// Find the users with those uids
					scope.Gamify.api.execute("user","paginate", {
						query:{
							fbuid: {
								$in:	params.fbreq.to
							}
						}
					}, function(users) {
						callback(users);
					});
				});
				
				// Background:
				// Insert into the fbinvites table
				var i;
				var l 		= params.fbreq.to.length;
				var queries = [];
				
				for (i=0;i<l;i++) {
					queries.push({
						fbrequest:	params.fbreq.request*1,
						fbuid:		params.fbreq.to[i]*1,
						from:		params.__auth,
						date:		new Date()
					});
				}
				
				scope.mongo.insert({
					collection:		"fbinvites",
					data: 			queries
				}, function(response) {
					
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