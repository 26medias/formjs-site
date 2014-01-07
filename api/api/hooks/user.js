exports.hooks = function (Gamify) {
	
	Gamify.hook.register("user", "validateAuthToken", function(params, response) {
		if (response.valid) {
			// We're gonna remember when the user came to the site
			Gamify.api.execute("user","setData", {
				authtoken:	response.authtoken,
				data:	{
					recent_activity:	new Date()
				}
			}, function() {
				// We don't care about the response
			});
		}
	});
	
	
};