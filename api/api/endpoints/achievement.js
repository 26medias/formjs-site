var _ 					= require('underscore');
var qs 					= require("querystring");

// Users
function api() {
	
}
api.prototype.init = function(Gamify, callback){
	var scope = this;
	
	this.Gamify 		= Gamify;
	this.collections	= {
		list:		"sys_achievements",
		general:	"achievements"
	};
	
	// Return the methods
	var methods = {
		
		create: {
			require:		['data'],
			auth:			'sys',
			description:	"Create a new achievement.",
			params:			{data:{multi:'bool: Define if an achievement can be unlocked more than once.',name:"string - public name. Can be edited.",alias:"string - Internal name. If edited, all unlocked achievements are lost.",type:"string - type of achievement."}},
			status:			'stable',
			version:		1,
			callback:		function(params, req, res, callback) {
				
				params	= scope.Gamify.api.fixTypes(params, {
					data:	'object'
				});
				params.data	= scope.Gamify.api.fixTypes(params.data, {
					multi:	'bool'
				});
				
				var uuid = scope.Gamify.crypto.md5(scope.Gamify.uuid.v4());
				
				scope.mongo.insert({
					collection:		scope.collections.list,
					data:			_.extend(params.data, {
						uuid:		uuid
					})
				}, function() {
					scope.Gamify.api.execute("achievement","find", {query:{uuid:uuid}, authtoken:Gamify.settings.systoken}, function(response) {
						callback(response[0]);
					});
				});
			}	
		},
		
		unlock: {
			require:		['alias','user'],
			auth:			'sys',
			description:	"Unlock an achievement for a user",
			params:			{alias:"Achievement\'s alias",user:{uid:"md5"}},
			status:			'stable',
			version:		1,
			callback:		function(params, req, res, callback) {
				
				params	= scope.Gamify.api.fixTypes(params, {
					user:	'object'
				});
				
				// Create a new UUID for that achievement
				var uuid = scope.Gamify.crypto.md5(scope.Gamify.uuid.v4());
				
				// Get the achievement's data
				scope.Gamify.api.execute("achievement","find", {query:{alias:params.alias}, authtoken:Gamify.settings.systoken}, function(response) {
					
					if (response.length == 0) {
						callback(scope.Gamify.api.errorResponse('This achievement doesn\'t exist ('+params.alias+').'));
						return false;
					}
					// Can we earn this achievement more than once?
					var multi 	= response[0].multi;
					
					console.log("\033[35m unlock multi("+params.alias+"):\033[37m",multi);
					
					// Does the user has this already?
					scope.mongo.count({
						collection:		scope.collections.general,
						query:			{
							alias:	params.alias,
							uid:	params.user.uid
						}
					}, function(count) {
						console.log("\033[35m unlock count ("+params.alias+"):\033[37m",count,JSON.stringify({
							collection:		scope.collections.general,
							query:			{
								alias:	params.alias,
								uid:	params.user.uid
							}
						},null,4));
						if (count == 0) {
							// User doesn't have that achievement yet
							// Let's create the achievement
							scope.mongo.insert({
								collection:		scope.collections.general,
								data:			{
									uuid:	uuid,
									uid:	params.user.uid,
									alias:	params.alias,
									type:	response[0].type,
									latest:	new Date(),
									history:	[	// Remember when the user unlocked the achievements
										new Date()
									],
									count:	1,
									'new':	true
								}
							}, function() {
								callback({status:'created'})
							});
						} else {
							if (multi) {
								
								// User has the achievement but he can get it twice
								scope.mongo.update({
									collection:		scope.collections.general,
									query:			{
										uid:	params.user.uid,
										alias:	params.alias
									},
									data:			{
										$set: {
											latest:		new Date(),
											'new':		true
										},
										$push:	{
											history: new Date()
										},
										$inc:	{
											count:	1
										}
									}
								}, function() {
									callback({status:'incremented'})
								});
							} else {
								// User already have that achievement. Can't give it twice.
								callback(scope.Gamify.api.errorResponse('The user already unlocked that achievement.'));
							}
						}
					});
				});
			}	
		},
		
		
		find: {
			require:		[],
			auth:			'sys',
			description:	"Search for an achievement (model, not unlocked)",
			params:			{query:"object"},
			status:			'stable',
			version:		1,
			callback:		function(params, req, res, callback) {
				
				scope.mongo.find(_.extend(params, {
					collection:	scope.collections.list
				}), function(response) {
					callback(response);
				});
			}
		},
		
		
		get: {
			require:		['type'],
			auth:			'authtoken',
			description:	"Get the user's achievements. All, unlocked or locked.",
			params:			{type:"string: [all/unlocked/locked]",grouped:"Bool - group by type."},
			status:			'dev',
			version:		1.2,
			callback:		function(params, req, res, callback) {
				
				// Start with getting the list of achievements the user unlocked
				scope.mongo.find({
					collection:	scope.collections.general,
					query:	{
						uid:		params.__auth
					},
					sort:		{
						latest:	-1
					},
					limit:	500
				}, function(achievements) {
					var aliases = [];
					var i;
					// Now we list the alias, and we get the real data
					for (i in achievements) {
						aliases.push(achievements[i].alias);
					}
					aliases = _.uniq(aliases);
					
					var indexed_unlocked = Gamify.utils.indexed(achievements, "alias");
					
					var query;
					switch (params.type) {
						default:
						case "all":
							query = {};
						break;
						case "unlocked":
							query = {
								alias:	{
									$in:	aliases
								}
							};
						break;
						case "locked":
							query = {
								alias:	{
									$nin:	aliases
								}
							};
						break;
					}
					
					// Now let's get the data
					scope.mongo.find({
						collection:	scope.collections.list,
						query:	query,
						limit:	500
					}, function(achievements_raw) {
						
						
						
						// Index the achievements by alias
						var indexed_model = Gamify.utils.indexed(achievements_raw, "alias");
						
						if (params.grouped) {
							var output = {};	// Object!
							for (i in indexed_model) {
								if (!output[indexed_model[i].type]) {
									output[indexed_model[i].type] = [];
								}
								if (indexed_unlocked[indexed_model[i].alias]) {
									indexed_model[i].unlocked 	= true;
									indexed_model[i].data 		= indexed_unlocked[indexed_model[i].alias];
								} else {
									indexed_model[i].unlocked = false;
								}
								output[indexed_model[i].type].push(indexed_model[i]);
							}
						} else {
							var output = [];	// Array!
							for (i in indexed_model) {
								
								if (indexed_unlocked[indexed_model[i].alias]) {
									indexed_model[i].unlocked 	= true;
									indexed_model[i].data 		= indexed_unlocked[indexed_model[i].alias];
								} else {
									indexed_model[i].unlocked = false;
								}
								output.push(indexed_model[i]);
							}
						}
						
						// Sort by unlock date
						output.sort(function(a,b) {
							if (b.data && b.data.latest && a.data && a.data.latest) {
								return new Date(b.data.latest).getTime() - new Date(a.data.latest).getTime();
							}
							return 0;
						});
						callback(output);
					});
				});
			}
		},
		
		
		
		getnew: {
			require:		[],
			auth:			'authtoken',
			description:	"Get the new achievements. This will set them as read.",
			params:			{},
			status:			'dev',
			version:		1,
			callback:		function(params, req, res, callback) {
				
				// Start with getting the list of achievements the user unlocked
				scope.mongo.find({
					collection:	scope.collections.general,
					query:	{
						uid:		params.__auth,
						'new':		true
					},
					sort:		{
						latest:	-1
					},
					limit:	500
				}, function(achievements) {
					var aliases = [];
					var i;
					// Now we list the alias, and we get the real data
					for (i in achievements) {
						aliases.push(achievements[i].alias);
					}
					aliases = _.uniq(aliases);
					
					var indexed_unlocked = Gamify.utils.indexed(achievements, "alias");
					
					query = {
						alias:	{
							$in:	aliases
						}
					};
					
					// Now let's get the data
					scope.mongo.find({
						collection:	scope.collections.list,
						query:	query,
						limit:	500
					}, function(achievements_raw) {
						
						
						
						// Index the achievements by alias
						var indexed_model = Gamify.utils.indexed(achievements_raw, "alias");
						
						var output = [];	// Array!
						for (i in indexed_model) {
							
							if (indexed_unlocked[indexed_model[i].alias]) {
								indexed_model[i].unlocked 	= true;
								indexed_model[i].data 		= indexed_unlocked[indexed_model[i].alias];
							} else {
								indexed_model[i].unlocked = false;
							}
							output.push(indexed_model[i]);
						}
						callback(output);
						
						if (output.length > 0) {
							// In the background, let's mark those as read.
							scope.mongo.update({
								collection:	scope.collections.general,
								query:	{
									uid:		params.__auth,
									'new':		true
								},
								data:	{
									$set:	{
										'new':	false
									}
								}
							}, function() {
								
							});
						}
					});
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