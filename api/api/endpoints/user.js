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
		
		
		
		
		validateAuthToken: {
			require:		['authtoken'],
			auth:			false,
			description:	"",
			params:			{authtoken:'md5'},
			status:			'stable',
			version:		1,
			callback:		function(params, req, res, callback) {
				
				
				scope.mongo.find({
					collection:	'authtokens',
					query:		{
						token:		params['authtoken'],
						validity:	{
							$gt:	new Date().getTime()
						}
					},
					limit:	1
				}, function(response) {
					if (response.length > 0) {
						// Get user
						scope.Gamify.api.execute("user","find", {query:{uid:response[0].uid}}, function(user_response) {
							if (user_response.length > 0) {
								callback({valid: true, user: user_response[0], authtoken: params.authtoken});
							} else {
								callback({valid: false});
							}
						});
					} else {
						callback({valid: false});
					}
				});
				
			}
		},
		
		
		
		
		getAuthToken: {
			require:		['user'],
			auth:			false,
			description:	"Identify a user and returns an authtoken to be used for private api methods.",
			params:			{user:'object'},
			status:			'stable',
			version:		1,
			callback:		function(params, req, res, callback) {
				
				// Convert "user" from a JSON string to an object if necessary
				params	= scope.Gamify.api.fixTypes(params, {
					user:		'object'
				});
				params.user	= scope.Gamify.api.fixTypes(params.user, {
					password:	'md5'
				});
				
				//console.log("params",params);
				
				// Find the user
				// Update the token
				// Return the token
				scope.mongo.find({
					collection:	'users',
					query:		params['user'],
					limit:		1
				}, function(response) {
					if (response.length == 0) {
						callback(scope.Gamify.api.errorResponse('This user doesn\'t exist.'));
					} else {
						// Generate the token
						var authtoken = scope.Gamify.crypto.md5(scope.Gamify.uuid.v4());
						// Update/Create the token
						scope.mongo.update({
							collection:		'authtokens',
							query: {
								uid:		response[0].uid
							},
							data:	{
								uid:		response[0].uid,
								validity:	new Date().getTime()+60*60*24*365*1000,
								token:		authtoken
							},
							options:	{
								upsert:	true
							}
						},function() {
							callback({
								valid: 		true,
								authtoken:	authtoken,
								user:		response[0].uid
							});
						});
					}
				});
			}
		},
		
		
		
		
		create: {
			require:		['data'],
			auth:			false,
			description:	"Create a new user using arbitrary data.",
			params:			{data:'object'},
			status:			'stable',
			version:		1,
			callback:		function(params, req, res, callback) {
				
				params	= scope.Gamify.api.fixTypes(params, {
					data:		'object'
				});
				
				if (!params.__passwordencoded) {
					params.data	= scope.Gamify.api.fixTypes(params.data, {
						password:	'md5'
					});
					
				}
				
				
				params.data = _.extend({
					reminder_text:	true,
					reminder_email:	true
				},params.data);
				
				// Account Creation method
				var create_account = function() {
					var uid = scope.Gamify.crypto.md5(scope.Gamify.uuid.v4());
					
					var userdata = _.extend({
						avatar:			"images/avatar-default.png",
						register_date:	new Date()
					},params.data, {
						uid:		uid
					});
					//console.log("userdata",userdata);
					
					scope.mongo.insert({
						collection:		'users',
						data:			userdata
					}, function() {
						scope.Gamify.api.execute("user","getAuthToken", {user: {uid:uid}}, function(response) {
							callback(response);
							
							// Background: send an email
							scope.Gamify.mailstack.send({
								type:	"signup",
								user:	userdata
							});
						});
					});
				}
				
				// Make sure there are no duplicate accounts
				var query = {};
				if (params.data.email && params.data.fbuid) {
					query = {
						$or:	[
							{email:	params.data.email},
							{fbuid:	params.data.fbuid},
						]
					};
				} else if (params.data.email && !params.data.fbuid) {
					query = {
						email:	params.data.email
					};
				} else if (!params.data.email && params.data.fbuid) {
					query = {
						fbuid:	params.data.fbuid
					};
				} else {
					callback(scope.Gamify.api.errorResponse('Either an email or a facebook UID is required to register an account.'));
					return false;
				}
				scope.mongo.count({
					collection:		'users',
					query:			query
				}, function(count) {
					if (count > 0) {
						callback(scope.Gamify.api.errorResponse('This email is already in use.',304));
					} else {
						create_account();
					}
				});
				
			}	
		},
		
		
		
		
		facebookLogin: {
			require:		['fbuid','fbtoken'],
			auth:			false,
			description:	"Identify a user using a facebook id and authtoken, and returns an authtoken to be used for private api methods.",
			params:			{fbuid:'facebook id',fbtoken:'facebook authtoken'},
			status:			'unstable',
			version:		1.1,
			callback:		function(params, req, res, callback) {
				
				// Check if the fbtoken is valid
				var fbclient = fbapi.user(params.fbtoken);
				fbclient.me.info(function(err, data) {
					
					if (err) {
						callback(scope.Gamify.api.errorResponse('The facebook AuthToken used is not valid.'));
					} else {
						
						// Used to check if a user exists using a fb uid or an email
						var uidCheck = function(cb) {
							scope.mongo.find({
								collection:	'users',
								query:		{
									fbuid:	data.id*1
								},
								limit:	1
							}, function(response) {
								if (response && response.length > 0) {
									cb(response[0]);
								} else {
									cb(false);
								}
							});
						}
						
						// Used to check if a user exist using an authtoken
						var AuthtokenCheck = function(cb) {
							scope.Gamify.api.execute("user","validateAuthToken", {authtoken: params.authtoken}, function(response) {
								if (response && response.valid) {
									cb(response.user, response);
								} else {
									cb(false);
								}
							});
						}
						
						// Create or update the facebook account
						var fbLink = function(user, auth_response) {
							// Get the list of friends
							fbclient.me.friends(function(err, friendlist) {
								var friends = [];
								var i;
								var l = friendlist.length;
								for (i=0;i<l;i++) {
									friends.push(friendlist[i].id*1);
								}
								
								// Update/Create the account
								if (user) {
									// User exists, let's login and update their fb uid (just in case, as they could have an email account without that uid)
									
									// If this is present, then the user was already logged in. He's just linking his account.
									if (auth_response) {
										scope.Gamify.api.execute("user","set", {
											authtoken:		scope.Gamify.settings.systoken,
											query:			{
												uid:	user.uid
											},
											data: {
												fbuid:		data.id*1,
												fbfriends:	friends
											}
										}, function(response) {
											// Don't care, we won't do anything with that
										});
									} else {
										// User is logging in using facebook.
										scope.Gamify.api.execute("user","getAuthToken", {user: {fbuid:data.id*1}}, function(response) {
											callback(response);
											// Save/update the list of friends
											scope.Gamify.api.execute("user","set", {
												authtoken:		scope.Gamify.settings.systoken,
												query:			{
													uid:	response.user
												},
												data: {
													fbuid:		data.id*1,
													fbfriends:	friends
												}
											}, function(response) {
												// Don't care, we won't do anything with that
											});
										});
									}
									
								} else {
									// User doesn't exist, let's create it.
									var userQuery = {
										email:		data.email,
										password:	false,	// no password!
										fbuid:		data.id*1,
										firstname:	data.first_name,
										lastname:	data.last_name,
										fbfriends:	friends
									};
									//@TODO: Fix DOB, export the age/agerange methods as services
									/*if (data.birthday) {
										userQuery.dob	= moment(data.birthday, "MM/DD/YYYY").toDate();
									}*/
									scope.Gamify.api.execute("user","create", {
										data:			userQuery
									}, function(response) {
										callback(response);
									});
								}
							});
						};
						
						if (params.authtoken) {
							AuthtokenCheck(function(response, auth_response) {
								fbLink(response, auth_response);
							});
						} else {
							uidCheck(function(response) {
								fbLink(response);
							});
						}
						
					}
				});
			}
		},
		
		
		
		
		find: {
			require:		[],
			params:			{query:"MongoDB query"},
			auth:			false,
			description:	"Search for users. Returns only the public informations.",
			status:			'unstable',
			version:		1.2,
			callback:		function(params, req, res, callback) {
				
				params	= scope.Gamify.api.fixTypes(params, {
					query:	'object'
				});
				
				scope.mongo.find(_.extend(params, {
					collection:	"users",
					fields:		{
						password:	false,
						racedata:	false,
						fbfriends:	false
					}
				}), function(response) {
					var i;
					var l = response.length;
					for (i=0;i<l;i++) {
						response[i].fullname = response[i].firstname+" "+response[i].lastname;
						response[i].state = {
							gender:		!(!response[i].metadatas || !response[i].metadatas.gender),
							age:		!(!response[i].metadatas || !response[i].metadatas.age),
							location:	!(!response[i].location),
							facebook:	!(!response[i].fbuid),
							phone:		!(!response[i].phone)
						};
						if (!response[i].avatar) {
							response[i].avatar = "images/avatar-default.png";
						}
					}
					callback(response);
				});
			}
		},
		
		
		
		
		get: {
			require:		[],
			params:			{},
			auth:			'authtoken',
			description:	"Get the user's complete profile data.",
			status:			'stable',
			version:		1,
			callback:		function(params, req, res, callback) {
				
				scope.mongo.find(_.extend(params,{
					collection:	"users",
					query:		{
						uid:	params.__auth
					},
					limit:		1
				}), function(response) {
					if (response.length == 0) {
						callback(false);
					} else {
						response[0].fullname = response[0].firstname+" "+response[0].lastname;
						response[0].state = {
							gender:		!(!response[0].metadatas || !response[0].metadatas.gender),
							age:		!(!response[0].metadatas || !response[0].metadatas.age),
							location:	!(!response[0].location),
							facebook:	!(!response[0].fbuid),
							phone:		!(!response[0].phone)
						};
						if (!response[0].avatar) {
							response[0].avatar = "images/avatar-default.png";
						}
						callback(response[0]);
					}
				});
			}
		},
		
		
		
		
		paginate: {
			require:		[],
			params:			{},
			auth:			false,
			description:	"Get a list of users, with pagination. Can be filtered using the 'query' parameter (object).",
			status:			'unstable',
			version:		1,
			callback:		function(params, req, res, callback) {
				
				params	= _.extend({
					perpage:	5,
					page:		1
				},params);
				scope.mongo.paginate(_.extend({
					collection:	"users",
					query:		{}
				}, params), function(response) {
					var nextParam		= _.extend({},params);
					nextParam.page 		= response.pagination.current+1;
					var prevParam		= _.extend({},params);
					prevParam.page		= response.pagination.current-1;
					
					console.log("\033[35m Paginate query:\033[37m",JSON.stringify(_.extend({
					collection:	"users",
					query:		{}
				}, params),null,4));
					console.log("\033[35m response:\033[37m",JSON.stringify(response,null,4));
					
					var i;
					var l = response.data.length;
					for (i=0;i<l;i++) {
						response.data[i].fullname = response.data[i].firstname+" "+response.data[i].lastname;
						response.data[i].state = {
							gender:		!(!response.data[i].metadatas || !response.data[i].metadatas.gender),
							age:		!(!response.data[i].metadatas || !response.data[i].metadatas.age),
							location:	!(!response.data[i].location),
							facebook:	!(!response.data[i].fbuid),
							phone:		!(!response.data[i].phone)
						};
					}
					
					if (req && req.path) {
						response.next		= response.pagination.current >= response.pagination.pages ? false : req.path+"?"+qs.stringify(nextParam);
						response.previous	= response.pagination.current <= 1 ? false : req.path+"?"+qs.stringify(prevParam);
					}
					callback(response);
				});
			}
		},
		
		
		
		
		online: {
			require:		[],
			params:			{},
			auth:			false,
			description:	"Get a paginated list of currently online users.",
			status:			'stable',
			version:		1,
			callback:		function(params, req, res, callback) {
				
				params	= _.extend({
					perpage:	5,
					page:		1,
					time:		1000*60*5	// in ms!
				},params);
				
				scope.mongo.paginate(_.extend(params, {
					collection:	"users",
					query:		{
						"data.recent_activity": {
							$gt:	new Date(new Date().getTime()-params.time)
						}
					}
				}), function(response) {
					var nextParam		= _.extend({},params);
					nextParam.page 		= response.pagination.current+1;
					var prevParam		= _.extend({},params);
					prevParam.page		= response.pagination.current-1;
					
					response.next		= response.pagination.current >= response.pagination.pages ? false : req.path+"?"+qs.stringify(nextParam);
					response.previous	= response.pagination.current <= 1 ? false : req.path+"?"+qs.stringify(prevParam);
					callback(response);
				});
			}
		},
		
		
		
		
		setLocation: {
			require:		['location'],
			params:			{location:"String"},
			auth:			"authtoken",
			description:	"Set a user's location, in natural language. Example: 'Soho, New York City'. The location is geo-encoded and added to the user's meta-datas.",
			status:			'stable',
			version:		1.2,
			callback:		function(params, req, res, callback) {
				
				// Get the location
				scope.Gamify.api.execute("geo","encode", {location: params.location}, function(response) {
					
					// prepare the meta data
					var i;
					var metadatas = {};
					for (i in response.levels) {
						metadatas['metadatas.'+i] 	= response.levels[i];
					}
					metadatas['metadatas.timezone'] 	= response.timezone;
					
					scope.mongo.update({
						collection:	"users",
						query:		{
							uid:	params.__auth	// The auth method pass that __auth data into the params
						},
						data:		{
							$set:	_.extend(metadatas, {
								location:		response
							})
						}
					}, function() {
						callback(response);
						
						// Give the achievement
						Gamify.api.execute("achievement","unlock", {
							authtoken:		scope.Gamify.settings.systoken,
							user:	{
								uid:		params.__auth
							},
							alias:	"location"
						}, function(unlocked_done) {
							console.log("\033[35m [>location]:\033[37m",unlocked_done);
						});
					});
				});
				
			}
		},
		
		
		
		
		set: {
			require:		['data','query'],
			params:			{},
			auth:			"sys",
			description:	"Save a data on the user's profile.",
			status:			'stable',
			version:		1.2,
			callback:		function(params, req, res, callback) {
				
			
				scope.mongo.update({
					collection:	"users",
					query:		params.query,
					data:		{
						$set:	params.data
					}
				}, function() {
					callback({set:true});
				});
				
			}
		},
		
		
		
		
		update: {
			require:		[],
			params:			{},
			auth:			"authtoken",
			description:	"Update the user's profile.",
			status:			'stable',
			version:		1,
			callback:		function(params, req, res, callback) {
				
				//console.log("\033[35m BEFORE:\033[37m",params);
				
				params = Gamify.api.filter(params, ['authtoken','__auth','gender','email','dob','location','phone','reminder_text','reminder_email','avatar','firstname','lastname']);
				
				var stack 			= new Gamify.stack();
				var updateQuery 	= {};
				var metaQuery 		= {};
				
				var age		= function(timestamp) {
					var birthDate = new Date(timestamp*1000);
					var now = new Date();
					
					var isLeap = function (year) {
						return year % 4 == 0 && (year % 100 != 0 || year % 400 == 0);
					}
					
					// days since the birthdate
					var days = Math.floor((now.getTime() - birthDate.getTime())/1000/60/60/24);
					var age = 0;
					// iterate the years
					for (var y = birthDate.getFullYear(); y <= now.getFullYear(); y++){
						var daysInYear = isLeap(y) ? 366 : 365;
						if (days >= daysInYear){
							days -= daysInYear;
							age++;
							// increment the age only if there are available enough days for the year.
						}
					}
					return age;
				}
				
				var agerange = function(age) {
					var ranges = {
						"0-13":		[0,13],
						"14-18":	[14,18],
						"18-25":	[18,25],
						"25-35":	[25,35],
						"35-45":	[35,45],
						"45-55":	[45,55],
						"55-65":	[55,65],
						"65+":		[65,150]
					};
					var range;
					for (range in ranges) {
						if (age >= ranges[range][0] && age <= ranges[range][1]) {
							return range;
						}
					}
				}
				
				var item;
				for (label in params) {
					switch (label) {
						case "phone":
						case "reminder_text":
						case "reminder_email":
						case "avatar":
						case "firstname":
						case "lastname":
							updateQuery[label] 	= params[label];
						break;
						case "gender":
							updateQuery['gender'] 	= params['gender'];
							metaQuery['gender'] 	= params['gender']==1?'male':'female';
						break;
						case "email":
							updateQuery['email'] 	= params['email'];
						break;
						case "dob":
							updateQuery['dob'] 		= params['dob'];
							metaQuery['age'] 		= age(params['dob']);
							metaQuery['agerange'] 	= agerange(age(params['dob']));
						break;
						case "location":
							stack.add(function(p, onProcessed) {
								scope.Gamify.api.execute("user","setLocation", {
									authtoken:		params.authtoken,
									__auth:			params.__auth,
									__authcheck:	Gamify.settings.systoken,
									location:params['location']
								}, onProcessed);
							},{});
						break;
					}
				}
				
				stack.add(function(p, onProcessed) {
					scope.Gamify.api.execute("user","set", {
						authtoken:	Gamify.settings.systoken,
						query:		{
							uid:	params.__auth
						},
						data:	updateQuery
					}, onProcessed);
				},{});
					
				stack.add(function(p, onProcessed) {
					scope.Gamify.api.execute("user","setMetas", {
						authtoken:		params.authtoken,
						__auth:			params.__auth,
						__authcheck:	Gamify.settings.systoken,
						data:			metaQuery
					}, onProcessed);
				},{});
				
				stack.process(function() {
					callback({updated:true,data:updateQuery});
					
					// Background
					// Check the current state of the user:
					
					// Give the achievement
					Gamify.api.execute("user","get", {
						authtoken:		params.authtoken,
						__auth:			params.__auth,
						__authcheck:	Gamify.settings.systoken
					}, function(user) {
						console.log("\033[35m USER STATE:\033[37m",JSON.stringify(user,null,4));
						
						if (user && user.state && user.state.gender && user.state.location && user.state.age) {
							// Give the achievement
							Gamify.api.execute("achievement","unlock", {
								authtoken:		Gamify.settings.systoken,
								user:	{
									uid:		params.__auth
								},
								alias:	"completed_profile"
							}, function(unlocked_done) {
								console.log("\033[35m [>completed_profile]:\033[37m",unlocked_done);
							});
						}
					});
					
					
						
				}, false);	//not async
				
			}
		},
		
		
		
		
		setMetas: {
			require:		['data'],
			params:			{},
			auth:			"authtoken",
			description:	"Save a meta-data on the user's profile.",
			status:			'stable',
			version:		1.1,
			callback:		function(params, req, res, callback) {
				
				
				var data = {};
				var i;
				for (i in params.data) {
					data["metadatas."+i] = params.data[i];
				}
			
				scope.mongo.update({
					collection:	"users",
					query:		{
						uid:	params.__auth	// The auth method pass that __auth data into the params
					},
					data:		{
						$set:	data
					}
				}, function(response) {
					callback(response);
				});
				
			}
		},
		
		
		
		
		getMetas: {
			require:		['query'],
			params:			{},
			auth:			'sys',
			description:	"Get the user's meta-datas.",
			status:			'stable',
			version:		1,
			callback:		function(params, req, res, callback) {
				
				scope.mongo.find(_.extend(params, {
					collection:	"users",
					query:		params.query,
					limit:		1,
					fields:		{
						metadatas:	true
					},
				}), function(response) {
					console.log("\033[35m [>getMetas]:\033[37m",response);
					if (response.length == 0) {
						callback(false);
					} else {
						if (response[0].metadatas) {
							callback(response[0].metadatas);
						} else {
							callback(false);
						}
					}
				});
			}
		},
		
		
		
		
		setData: {
			require:		['data'],
			params:			{},
			auth:			"authtoken",
			description:	"Save a data on the user's profile.",
			status:			'stable',
			version:		1.1,
			callback:		function(params, req, res, callback) {
				
				
				var data = {};
				var i;
				for (i in params.data) {
					data["data."+i] = params.data[i];
				}
			
				scope.mongo.update({
					collection:	"users",
					query:		{
						uid:	params.__auth	// The auth method pass that __auth data into the params
					},
					data:		{
						$set:	data
					}
				}, function(response) {
					callback(response);
				});
				
			}
		},
		
		
		
		
		passwordreset: {
			require:		['email'],
			params:			{},
			auth:			false,
			description:	"Create a reset link for the user",
			status:			'stable',
			version:		1.1,
			callback:		function(params, req, res, callback) {
				
				// Check if there's a user
				scope.mongo.find({
					collection:		"users",
					query:			{
						email: params.email
					},
					fields:		{
						uid:		true,
						firstname:	true,
						lastname:	true,
						email:		true
					}
				}, function(user) {
					if (user.length > 0) {
						user = user[0];
						var token 	= scope.Gamify.crypto.md5(scope.Gamify.uuid.v4());
						
						// Insert the token
						scope.mongo.insert({
							collection:		"passwordreset",
							data:			{
								uid:	user.uid,
								token:	token,
								time:	new Date()
							}
						}, function() {});
						
						// Send the email
						Gamify.mailstack.send({
							user:	user,
							params:	{
								token:	token
							},
							type:	"passwordreset"
						});
						callback({sent:true});
					} else {
						callback(Gamify.api.errorResponse("There are no accounts registered with that email."));
					}
				});
				
				
			}
		},
		
		
		
		
		passwordresetupdate: {
			require:		['token'],
			params:			{},
			auth:			false,
			description:	"Change the password and login",
			status:			'stable',
			version:		1.1,
			callback:		function(params, req, res, callback) {
				
				
				params	= scope.Gamify.api.fixTypes(params, {
					password:	'md5'
				});
				
				// Check if there's a user
				scope.mongo.find({
					collection:		"passwordreset",
					query:			{
						token: params.token
					}
				}, function(response) {
					if (response.length > 0) {
						var request = response[0];
						
						scope.Gamify.api.execute("user","getAuthToken", {
							user:	{
								uid:	request.uid
							}
						}, callback);
						
						// Background
						// Update the user's password
						scope.mongo.update({
							collection:	"users",
							query:		{
								uid:	request.uid
							},
							data:		{
								$set: {
									password:	params.password
								}
							}
						}, function(){});
						
						// Delete the token
						scope.mongo.remove({
							collection:	"passwordreset",
							query:		{
								token: params.token
							}
						}, function(){});
						
					} else {
						callback(Gamify.api.errorResponse("The token for that request is expired or invalid."));
					}
				});
				
				
			}
		},
		
		
		
		
		getChallenges: {
			require:		[],
			params:			{started:"Bool - return the challenges we accepted but didn't play yet."},
			auth:			"authtoken",
			description:	"Get the challenges",
			status:			'dev',
			version:		1.2,
			callback:		function(params, req, res, callback) {
				
				if (params.started) {
					// Get the user's data:
					scope.Gamify.api.execute("user","get", {authtoken:params.authtoken, fields:{uid:true}}, function(user) {
						console.log("\033[35m [>user]:\033[37m",user);
						
						scope.mongo.find({
							collection:	"challenges",
							query:		{
								uid:		user.uid,
								refused:	false
							}
						}, function(response) {
							
							response = _.filter(response, function(item) {
								if (!item.results) {
									return true;
								}
								var i;
								var l = item.results.length;
								var hasUser = false;
								for (i=0;i<l;i++) {
									if (item.results[i].uid == params.__auth) {
										hasUser = true;
									}
								}
								return !hasUser;
							});
							
							// Process the data
							var i;
							var l 		= response.length;
							var uids	= {};
							for (i=0;i<l;i++) {
								response[i].alias = response[i].race+"";
								response[i].race = _.extend({},Gamify.data.races.getByAlias(response[i].race));
								delete response[i].race.survey;
								delete response[i].race.games;
								delete response[i].race.description;
								delete response[i].race.description2;
								delete response[i].race.survey;
								// Index the uids
								if (!uids[response[i].race.alias]) {
									uids[response[i].race.alias] = 0;
								}
								uids[response[i].race.alias]++;
							}
							response = Gamify.utils.indexed(response,"alias");
							
							for (i in response) {
								response[i].count = uids[response[i].alias];
							}
							
							callback(response);
							
							
						});
					});
				} else {
					// Get the user's data:
					scope.Gamify.api.execute("user","get", {authtoken:params.authtoken, fields:{fbuid:true}}, function(user) {
						
						scope.mongo.paginate({
							collection:	"challenges",
							query:		{
								fbuid:		user.fbuid,
								accepted:	false,
								refused:	false
							}
						}, function(response) {
							
							var nextParam		= _.extend({},params);
							nextParam.page 		= response.pagination.current+1;
							var prevParam		= _.extend({},params);
							prevParam.page		= response.pagination.current-1;
							
							// Process the data
							var i;
							var l 		= response.data.length;
							var uids	= [];
							for (i=0;i<l;i++) {
								response.data[i].race = _.extend({},Gamify.data.races.getByAlias(response.data[i].race));
								delete response.data[i].race.survey;
								delete response.data[i].race.games;
								// List the uids
								uids.push(response.data[i].uid);
							}
							
							// List the users
							scope.Gamify.api.execute("user","find", {
								query:	{
									uid:	{
										$in:	uids
									}
								}
							}, function(users) {
								users = Gamify.utils.indexed(users, "uid");
								//console.log("users",users);
								for (i=0;i<l;i++) {
									if (users[response.data[i].uid]) {
										response.data[i].user = users[response.data[i].uid];
									} else {
										response.data[i].user = false;
									}
								}
								
								response.next		= response.pagination.current >= response.pagination.pages ? false : req.path+"?"+qs.stringify(nextParam);
								response.previous	= response.pagination.current <= 1 ? false : req.path+"?"+qs.stringify(prevParam);
								callback(response);
							});
							
							
						});
					});
				}
			}
		},
		
		
		
		
		getFriends: {
			require:		[],
			params:			{},
			auth:			"authtoken",
			description:	"List the user's friends, paginated.",
			status:			'stable',
			version:		1.1,
			callback:		function(params, req, res, callback) {
				
				scope.Gamify.api.execute("user","get", {authtoken:params.authtoken, fields:{fbuid:true,fbfriends:true}}, function(user) {
					
					if (user.fbfriends) {
						scope.Gamify.api.execute("user","paginate", _.extend(params, {
							query:		{
								fbuid:		{
									$in:	user.fbfriends
								}
							}
						}), function(response) {
							callback(response);
							
							// Background - unlock the achievements
							
							if (response.pagination.total >= 20) {
								Gamify.api.execute("achievement","unlock", {
									authtoken:		Gamify.settings.systoken,
									user:	{
										uid:		params.__auth
									},
									alias:	"friend_20"
								}, function(unlocked_done) {
									console.log("\033[35m [>friend_20]:\033[37m",unlocked_done);
								});
							}
							if (response.pagination.total >= 10) {
								Gamify.api.execute("achievement","unlock", {
									authtoken:		Gamify.settings.systoken,
									user:	{
										uid:		params.__auth
									},
									alias:	"friend_10"
								}, function(unlocked_done) {
									console.log("\033[35m [>friend_10]:\033[37m",unlocked_done);
								});
							}
							if (response.pagination.total >= 1) {
								Gamify.api.execute("achievement","unlock", {
									authtoken:		Gamify.settings.systoken,
									user:	{
										uid:		params.__auth
									},
									alias:	"friend_1"
								}, function(unlocked_done) {
									console.log("\033[35m [>friend_1]:\033[37m",unlocked_done);
								});
							}
						});
						
					} else {
						callback({pagination:{total:0},data:[]});
					}
				});
				
			}
		},
		
		
		
		
		log: {
			require:		['data'],
			params:			{},
			auth:			'authtoken',
			description:	"Log a user action",
			status:			'unstable',
			version:		1,
			callback:		function(params, req, res, callback) {
				
				
				
				
				var logCreate = function() {
					// Get the user's metas
					scope.mongo.find({
						collection:	"users",
						query:		{
							uid:	params.__auth
						},
						limit:		1,
						fields:		{
							metadatas:	true
						}
					}, function(response) {
						
						if (!response || response.length == 0) {
							callback(scope.Gamify.api.errorResponse('This user doesn\'t exist.'));
						} else {
							var metas = {};
							if (response[0] && response[0].metadatas) {
								metas = response[0].metadatas;
							}
							
							// Now we log the action
							scope.mongo.insert({
								collection:		"userlogs",
								data:			_.extend({
									date:			new Date(),
									uid:			params.__auth,
									metas:			metas
								},params.data)
							}, function() {
								callback({logged: true,isnew:true});
							});
						}
					});
				};
				
				
				
				
				if (params.data.action == "race.register") {
					//console.log("\n\033[35m [>params.action]:\033[37m",params.data.action);
					
					// Check if ther user is already registered
					scope.Gamify.api.execute("race","is_registered", {
						authtoken:		params.authtoken,
						__auth:			params.__auth,
						__authcheck:	scope.Gamify.settings.systoken,
						race:			params.data.race
					}, function(status) {
						//console.log("\n\033[35m [>is_registered]:\033[37m",status);
						
						if (!status.registered) {
							logCreate();
							
							// Background: send an email
							scope.Gamify.mailstack.send({
								type:	"race_register",
								uid:	params.__auth,
								params:	{
									race: params.data.race
								}
							});
							
						} else {
							callback({logged: true});
						}
						
					});
				} else {
					logCreate();
				}
				
			}
		},
		
		
		
		
		unregister: {
			require:		['race'],
			params:			{},
			auth:			'authtoken',
			description:	"Unregister for a race",
			status:			'dev',
			version:		1,
			callback:		function(params, req, res, callback) {
				
				scope.mongo.remove({
					collection:	"userlogs",
					query:		{
						uid:	params.__auth,
						race:	params.race
					}
				}, function() {
					callback({unregistered:true,race:params.race});
				});
				
			}
		},
		
		
		get_registered: {
			require:		[],
			auth:			"authtoken",
			description:	"Get the list of registered races",
			params:			{upcoming:"Bool"},
			status:			'dev',
			version:		1.2,
			callback:		function(params, req, res, callback) {
				
				// Get the count
				scope.mongo.distinct({
					collection:	'userlogs',
					query:		{
						uid:		params.__auth,
						action:		"race.register"
					},
					key:		"race"
				}, function(races) {
					
					var query = {};
					
					if (params.upcoming) {
						query = {
							start_time: {
								$gt:	new Date(new Date().getTime()-(5*60*1000))	// Up to 5min ago
							}
						};
					}
					
					scope.Gamify.api.execute("race","paginate", {
						__auth:			params.__auth,
						query: _.extend({
							alias: {
								$in: races
							}
						},query)
					}, callback);
					
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