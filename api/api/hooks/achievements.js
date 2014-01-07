var achievements		= require("./achievements/achievements").main;

exports.hooks = function (Gamify) {
	
	var scope = this;
	
	this.achievements 	= new achievements(Gamify);
	
	this.achievements.init(function() {
		Gamify.hook.register("user", "setlocation", function(params, response) {
			scope.achievements.check({
				user:	{
					uid:	params.__auth
				}
			});
		});
	});
	
};