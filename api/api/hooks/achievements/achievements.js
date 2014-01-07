function achievement(Gamify) {
	this.Gamify = Gamify;
}
achievement.prototype.init = function(callback) {
	
	var scope 		= this;
	var scanStack	= new this.Gamify.stack();
	this.rules 		= {};
	
	// List the achievement rules
	this.Gamify.file.listFiles("./api/hooks/achievements/achievements","js", function(files) {
		var i;
		var m;
		for (i=0;i<files.length;i++) {
			var includepath				= files[i].substr(0,files[i].length-3);
			var	parts					= includepath.split("/");
			var urlpath					= parts[parts.length-1];
			
			var achievementClass 		= require('./achievements/'+urlpath).achievements;
			scanStack.add(function(params, onProcessed) {
				scope.rules[params.urlpath] 	= {};
				params.achievementClass.init(scope.Gamify, function(methods) {
					var m;
					for (m in methods) {
						scope.rules[params.urlpath][m] = methods[m];
					}
					onProcessed();
				});
				
			},{urlpath:urlpath, achievementClass:new achievementClass()});
		}
		
		scanStack.process(callback, false);
	});
	
	
}
achievement.prototype.check = function(data) {
	var scope 		= this;
	var i;
	var output 		= {};
	var stack		= new this.Gamify.stack();
	var substack	= new this.Gamify.stack();
	
	for (i in data) {
		switch (i) {
			case "user":
				stack.add(function(params, onProcessed) {
					// Get the user data
					scope.Gamify.api.execute("user","get", {uid:params.data.uid,authtoken:scope.Gamify.settings.systoken}, function(user_response) {
						output.user = user_response;
						onProcessed();
					});
				}, {data: data[i]});
			break;
		}
	}
	
	stack.process(function() {
		var i;
		var j;
		for (i in scope.rules) {
			for (j in scope.rules[i]) {
				console.log("\t>\t"+i+"."+j,scope.rules[i][j].scope);
				if (scope.hasScopes(scope.rules[i][j].scope, output)) {
					substack.add(function(params, onProcessed) {
						scope.rules[params.i][params.j].condition(output, function(unlocked) {
							console.log("\t\t->",unlocked);
							onProcessed();
						});
					}, {i:i,j:j});
					
				}
			}
		}
		substack.process(function() {
			console.log("Achievements processed.");
		});
	}, true);
}
achievement.prototype.hasScopes = function(scopes, data) {
	var i;
	for (i in scopes) {
		if (!data[scopes[i]]) {
			return false;
		}
	}
	return true;
}

exports.main = achievement;