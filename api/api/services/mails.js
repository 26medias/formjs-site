var _ 					= require('underscore');
var Twig				= require("twig").twig;
var fs 					= require('fs');
var nodemailer 			= require("nodemailer");
var SendGrid 			= require('sendgrid').SendGrid;
var Email 				= require('sendgrid').Email;

exports.service = function (Gamify) {
	
	Gamify.service.Mailstack = new (function() {
		
		console.log("Mailstack loaded.");
		
		
		var scope 			= this;
		
		
		
		this.transport	= nodemailer.createTransport("SMTP", {
			host: 	"smtp.sendgrid.net",
			port: 	25,
			secureConnection: false,
			auth: {
				user: "fleetwit",
				pass: "2122ftpssh80803666"
			}
		});
		
		
		this.pull = function(callback) {
			
			//console.log("pulling ",Gamify.settings.mailstack_batchsize);
			
			scope.mongo.find({
				collection:	"mailstack",
				limit:		Gamify.settings.mailstack_batchsize
			}, function(response) {
				
				var stack	= new Gamify.stack();
				
				// For each message in the stack
				_.each(response, function(mailrequest) {
					stack.add(function(param, onProcessed) {
						
						// Recompose the data (push the user data into the params)
						var data 	= _.extend(mailrequest.params, {
							user:	mailrequest.user
						});
						
						
						var can_continue = true;
						
						// If there is a race in the params
						if (data.race) {
							
							data.race = Gamify.data.races.getByAlias(data.race);
							
							if (data.race === false) {
								can_continue = false;
								// If it still fails, the race doesn't exist anymore.
								//@TODO: delete that email (cancel)
								scope.mongo.insert({
									collection:	"mailstack_history",
									data:	{
										date:		new Date(),
										email:		mailrequest.user.email,
										type:		mailrequest.type,
										data:		mailrequest,
										error:		"canceled",
										response:	"Can't find race '"+data.race+"'"
									}
								}, function() {});
								
								scope.mongo.remove({
									collection:	"mailstack",
									query:		{uuid:mailrequest.uuid}
								}, function() {
									onProcessed();
								});
							}
							
						}
						
						if (can_continue) {
							// Render (using the data-provider)
							var rendered = Gamify.data.mails.render(mailrequest.type, data);
							
							// Send
							scope.send(mailrequest, rendered, function() {
								// Delete the mail
								scope.mongo.remove({
									collection:	"mailstack",
									query:		{uuid:mailrequest.uuid}
								}, function() {
									onProcessed();
								});
							});
						}
						
						
					});
				});
				
				stack.process(function() {
					console.log("Stack processed.");
					if (callback) {
						callback();
					}
					
					if (Gamify.settings.process_emails) {
						setTimeout(function() {
							scope.pull();
						}, Gamify.settings.mailstack_delay);
					}
				}, false);
				
			});
		};
		
		this.send = function(mailrequest, rendered, callback) {
			
			switch (Gamify.settings.mailmethod) {
				default:
				case "file":
					var filename = "["+mailrequest.type+"] "+mailrequest.user.firstname+" "+mailrequest.user.lastname+" - "+mailrequest.user.email+" - "+rendered.subject+".html";
					
					fs.writeFile("output/"+filename, rendered.body, function(err) {
						if(err) {
							console.log(err);
							callback(false);
						} else {
							console.log("Email saved as ","output/"+filename);
							callback(true);
						}
					}); 
				break;
				case "smtp":
					scope.transport.sendMail(
						{
							from: 		"FleetWit <hello@fleetwit.com>",
							to: 		"\""+mailrequest.user.firstname+" "+mailrequest.user.lastname+"\""+" <"+mailrequest.user.email+">",
							subject: 	rendered.subject,
							html: 		rendered.body
						},
						function(error, response){
							scope.mongo.insert({
								collection:	"mailstack_history",
								data:	{
									date:		new Date(),
									email:		mailrequest.user.email,
									type:		mailrequest.type,
									subject:	rendered.subject,
									html:		rendered.body,
									data:		mailrequest,
									error:		error,
									response:	response
								}
							}, function() {});
							if(error){
								callback(false);
							}else{
								// delete the email
								//scope.deleteFromStack(stackdata.uuid);
								callback(true);
							}
						}
					);
				break;
			}
			
		}
		
		// On status change, 
		Gamify.Arbiter.subscribe("mailstack_status", function() {
			if (Gamify.settings.process_emails) {
				scope.pull();
			}
		});
		
		this.mongo	= new Gamify.mongo({database: Gamify.settings.db});
		this.mongo.init(function() {
			setTimeout(function() {
				if (Gamify.settings.process_emails) {
					scope.pull();
				}
			}, 2000);	// Wait 2 sec to start processing mails, to not overload the API server as soon as we start
		});
		
	})();
};