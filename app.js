'use strict';
// Module Dependencies
// -------------------
var express     = require('express');
var bodyParser  = require('body-parser');
var errorhandler = require('errorhandler');
var http        = require('http');
var path        = require('path');
var request     = require('request');
var routes      = require('./routes');
var activity    = require('./routes/activity');

// EXPRESS CONFIGURATION
var app = express();

// Configure Express
app.set('port', process.env.PORT || 3000);
app.use(bodyParser.raw({type: 'application/jwt'}));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Express in Development Mode
if ('development' == app.get('env')) {
  app.use(errorhandler());
}

app.get('/', routes.index );
app.post('/login', routes.login );
app.post('/logout', routes.logout );

// Custom Routes for MC
app.post('/journeybuilder/save/', activity.save );
app.post('/journeybuilder/validate/', activity.validate );
app.post('/journeybuilder/publish/', activity.publish );
app.post('/journeybuilder/execute/', activity.execute );

// Custom Routes Created to pull Data for Application
app.get('/reqTemplateSMS', activity.requestTemplate); //Pulling of SMS messages from Contact Builder

// Custom Routes to receive back data from the vendor
app.get('/smsReceive', activity.smsResponse);
app.get('/deliveryReport', activity.smsDeliveryReport);

http.createServer(app).listen(
  app.get('port'), function(){
    console.log('Express server listening on port ' + app.get('port'));
  }
);


