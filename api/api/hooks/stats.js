var _ 					= require('underscore');

exports.hooks = function (Gamify) {
	var scope = this;
	// Init a connection
	this.mongo	= new Gamify.mongo({database:Gamify.settings.db});
	this.mongo.init(function() {
		Gamify.hook.register("game", "end", function(params, response) {
			
			console.log("\033[35m Hook response:\033[37m",JSON.stringify(response,null,4));
			
			
			// Check how many games the user has played
			var countFn = function(live, callback) {
				scope.mongo.count({
					collection:	"scores",
					query:	{
						uid:	params.__auth,
						live:	live,
						'result.total':	{
							$gt: 0
						}
					}
				}, function(count) {
					callback(count);
				});
			};
			
			// Count the number if live and arcade races, save in the user's meta datas, and assign the achievements
			countFn(true, function(count_live) {
				countFn(false, function(count_arcade) {
					// Update the user's metadatas
					Gamify.api.execute("user","setMetas", _.extend(params, {
						data:{
							played_live:	count_live,
							played_arcade:	count_arcade
						}
					}), function(done) {
						
					});
				});
			});
			//@TODO: perfect race
			if (response.result) {
				if (response.result.total > 0) {
					// Update the "played" achievements
					if (response.live) {
						Gamify.api.execute("achievement","unlock", {
							authtoken:		Gamify.settings.systoken,
							user:	{
								uid:		params.__auth
							},
							alias:	"played_live"
						}, function(unlocked_done) {
							console.log("\033[35m [>played_live]:\033[37m",unlocked_done);
						});
					} else {
						Gamify.api.execute("achievement","unlock", {
							authtoken:		Gamify.settings.systoken,
							user:	{
								uid:		params.__auth
							},
							alias:	"played_arcade"
						}, function(unlocked_done) {
							console.log("\033[35m [>played_arcade]:\033[37m",unlocked_done);
						});
					}
				}
			} else {
				console.log("ERROR (HOOK STATS 44)",response.result);
			}
			
			// Check if we beat one of the speed achievement
			if (response.result.time > 0) {
				
				if (response.result.time < 5*60*1000) {
					Gamify.api.execute("achievement","unlock", {
						authtoken:		Gamify.settings.systoken,
						user:	{
							uid:		params.__auth
						},
						alias:	"racetime_5"
					}, function(unlocked_done) {
						console.log("\033[35m [>racetime_5]:\033[37m",unlocked_done);
					});
				}
				if (response.result.time < 3*60*1000) {
					Gamify.api.execute("achievement","unlock", {
						authtoken:		Gamify.settings.systoken,
						user:	{
							uid:		params.__auth
						},
						alias:	"racetime_3"
					}, function(unlocked_done) {
						console.log("\033[35m [>racetime_3]:\033[37m",unlocked_done);
					});
				}
				if (response.result.time < 2*60*1000) {
					Gamify.api.execute("achievement","unlock", {
						authtoken:		Gamify.settings.systoken,
						user:	{
							uid:		params.__auth
						},
						alias:	"racetime_2"
					}, function(unlocked_done) {
						console.log("\033[35m [>racetime_2]:\033[37m",unlocked_done);
					});
				}
			}
		});
		Gamify.hook.register("user", "log", function(params, response) {
			if (params.data && params.data.action == "race.register" && response.logged == true && response.isnew == true) {
				// Race registration sucessful
				Gamify.api.execute("achievement","unlock", {
					authtoken:		Gamify.settings.systoken,
					user:	{
						uid:		params.__auth
					},
					alias:	"live_register"
				}, function(unlocked_done) {
					console.log("\033[35m [>live_register]:\033[37m",unlocked_done);
				});
			}
		});
	});
	
};