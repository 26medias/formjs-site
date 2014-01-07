var _ 					= require('underscore');
var qs 					= require("querystring");

// Account Achievements
function achievements() {
	
}
achievements.prototype.init = function(Gamify, callback){
	var scope = this;
	
	this.Gamify = Gamify;
	
	// Return the methods
	var methods = {
		
		location: {
			scope:			["user"],
			condition:		function(data, callback) {
				if (data.user.location) {
					scope.Gamify.api.execute("achievement","give", {
						alias:		"location",
						user:		{
							uid:	data.user.uid
						},
						authtoken:	Gamify.settings.systoken	// System token
					}, function(response) {
						callback(true);
					});
				} else {
					callback(false);
				}
			}
		},
		fb_connect: {
			scope:			["user"],
			condition:		function(data, callback) {
				if (data.user.fbuid) {
					scope.Gamify.api.execute("achievement","give", {
						alias:		"fb_connect",
						user:		{
							uid:	data.user.uid
						},
						authtoken:	Gamify.settings.systoken	// System token
					}, function(response) {
						callback(true);
					});
				} else {
					callback(false);
				}
			}
		},
		completed_profile: {
			scope:			["user"],
			condition:		function(data, callback) {
				if (data.user.location && data.dob && data.gender) {
					
					scope.Gamify.api.execute("achievement","give", {
						alias:		"completed_profile",
						user:		{
							uid:	data.user.uid
						},
						authtoken:	Gamify.settings.systoken	// System token
					}, function(response) {
						callback(true);
					});
				} else {
					callback(false);
				}
			}
		}
	};
	
	// Init a connection
	this.mongo	= new this.Gamify.mongo({database:Gamify.settings.db});
	this.mongo.init(function() {
		callback(methods);
	});
}
exports.achievements = achievements;