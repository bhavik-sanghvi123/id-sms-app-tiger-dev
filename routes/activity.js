'use strict';
var util = require('util');

// Deps
const Path = require('path');
const JWT = require(Path.join(__dirname, '..', 'lib', 'jwtDecoder.js'));
var util = require('util');
let axios = require("axios");
const { Pool } = require('pg');
const connectionString = 'postgres://uv3bf39oboo6i:p17596604ecf6ea97e986f03bcb98f289de47a34cecc556e3703f27c088838798@ec2-52-197-48-67.ap-northeast-1.compute.amazonaws.com:5432/dadpcdirgrberd';
//const connectionString = 'postgres://deloitteDev:p34c4f5d3bb9262da6c9fb9e0aedadb1d8493c8b32ff88b85717661ba3f41ac0b@ec2-52-197-48-67.ap-northeast-1.compute.amazonaws.com:5432/dadpcdirgrberd';
// Global Variables
const tokenURL = `${process.env.authenticationUrl}/v2/token`;


exports.logExecuteData = [];
function logData(req) {
    exports.logExecuteData.push({
        body: req.body,
        headers: req.headers,
        trailers: req.trailers,
        method: req.method,
        url: req.url,
        params: req.params,
        query: req.query,
        route: req.route,
        cookies: req.cookies,
        ip: req.ip,
        path: req.path,
        host: req.host,
        fresh: req.fresh,
        stale: req.stale,
        protocol: req.protocol,
        secure: req.secure,
        originalUrl: req.originalUrl
    });
    console.log("body: " + util.inspect(req.body));
    console.log("headers: " + req.headers);
    console.log("trailers: " + req.trailers);
    console.log("method: " + req.method);
    console.log("url: " + req.url);
    console.log("params: " + util.inspect(req.params));
    console.log("query: " + util.inspect(req.query));
    console.log("route: " + req.route);
    console.log("cookies: " + req.cookies);
    console.log("ip: " + req.ip);
    console.log("path: " + req.path);
    console.log("host: " + req.host);
    console.log("fresh: " + req.fresh);
    console.log("stale: " + req.stale);
    console.log("protocol: " + req.protocol);
    console.log("secure: " + req.secure);
    console.log("originalUrl: " + req.originalUrl);
}

/*
 * POST Handler for / route of Activity (this is the edit route).
 */
exports.edit = function (req, res) {
    // Data from the req and put it in an array accessible to the main app.
    //console.log( req.body );
    logData(req);
    res.send(200, 'Edit');
};

/*
 * POST Handler for /save/ route of Activity.
 */
exports.save = function (req, res) {
    // Data from the req and put it in an array accessible to the main app.
    //console.log( req.body );
    logData(req);
    res.send(200, 'Save');
};

/*
 * POST Handler for /execute/ route of Activity.
 */
exports.execute = function (req, res) {
    let responseType = '1';  //The successful response for this is 1 

    console.log("EXECUTE HAS BEEN RUN");

    JWT(req.body, process.env.jwtSecret, (err, decoded) => {
        // verification error -> unauthorized request
        if (err) {
            console.error(err);
            return res.status(401).end();
        }

        if (decoded && decoded.inArguments && decoded.inArguments.length > 0) {
            console.log('##### decoded ####=>', decoded);
            
            // decoded in arguments
            var decodedArgs = decoded.inArguments[0];
            
            let campaignLookup = decodedArgs.campaignName; //This is the campaign name that will find the ID in service cloud
            let brandNames = decodedArgs.brandNames;
            let linkShorten = decodedArgs.linkShorten;
            let messsageToBeSent = decodedArgs.textMessage;
            messsageToBeSent = messsageToBeSent.replace(/amp;/g,'');
			let phoneNumber = decodedArgs.phoneNumber;
			phoneNumber = phoneNumber.replace(/^0+/,'');
            console.log('messageto be sent ',messsageToBeSent);
            console.log('Inside execute mask name and link shorten',brandNames,linkShorten);

            var request = require("request");
            //url: 'https://enterprise.smsgupshup.com/GatewayAPI/rest',
            
            var options = { 
                   method: 'POST',
                   url: 'https://sms-api.jatismobile.com/index.ashx?',
                form: 
                { 
                       userid:'PTFABI',
                       password:'PTFABI789',
                       msisdn:`62${phoneNumber}`,
                       message:messsageToBeSent,
                       sender:brandNames,
                       division:'Marketing',
                       batchname:'Test',
                       uploadby:'Integration',
                       channel:'0'                        
                }
               };
            
            //var reqToPrint = JSON.parse(request);
            console.log('request formed-->', options);

            console.log('SMS BOOLEAN TAKEN FROM JOURNEY >>',decodedArgs.smsBoolean);

            //If the smsBoolean == false it means that it DID NOT OPT OUT of SMS
            // If Development branch, smsBoolean should be commented out
            
        if (decodedArgs.smsBoolean !== 'True') {
            console.log('== This person is not Opt Out of SMS ==');
            
           
            //if (true) {    
              
                let singleQuoteRegex = /'/g;

                request(options, function (error, response, body) {
                    if (error) 
                        throw new Error(error);
                    console.log('response body',body);
                    //console.log('string body', body.toString());
                    
                    // Response of SMS
                    let bodyResArr = body.toString().split("&");
                    console.log('status --> ',bodyResArr[0]);
                   // console.log('check this-->', bodyResArr.data.response_messages[0].id);
                    
                    
                    if (bodyResArr[0].substring(7) == responseType) {
                        console.log('--THIS IS SUCCESSFUL--');   
                        console.log('campaign name', campaignLookup);
                        sendingToSFDC('Completed', bodyResArr[1].substring(10), campaignLookup, decodedArgs.contactID, decodedArgs.shortMsg.replace(singleQuoteRegex, '&#39;') );
    
                    } else {
                        console.log('---THIS IS NOT SUCCESSFUL--');
                        sendingToSFDC('Failed', bodyResArr[0].substring(7), campaignLookup, decodedArgs.contactID, decodedArgs.shortMsg.replace(singleQuoteRegex, '&#39;') );
                    }
                });  
            }
        
            logData(req);
            res.send(200, 'Execute');

        } else {
            console.error('inArguments invalid.');
            return res.status(400).end();
        }

    });
};


function sendingToSFDC (statusOfMsg, msgId, campaignName, contactID, messageName) { //Function to connect to postgres Heroku Connect
    const pool = new Pool({
        connectionString: connectionString
    });

    // INSERT INTO Customer (FirstName, LastName) VALUES ('Anita', 'Coats')
    let queryCampaignID = `SELECT sfid, name FROM salesforcetest.Campaign WHERE name = '${campaignName}' and market__c = 'ID'`;
    
    pool.query(queryCampaignID, (err, res) => {
        console.log('===== Querying Rows =====');
        if(res.rows[0] !== undefined) {
            console.log('ID of the result >>> ',res.rows[0].sfid);
            console.log('Name of the result >>> ',res.rows[0].name);
            let campaignID = res.rows[0].sfid;

            let insertMobileSend = `INSERT INTO salesforcetest.et4ae5__SMSDefinition__c (et4ae5__Campaign__c, et4ae5__Contact__c, et4ae5__SendStatus__c, et4ae5__Campaigns__c, et4ae5__smsName__c, unique_id__c) VALUES ('${campaignID}', '${contactID}', '${statusOfMsg}', '${campaignName}', '${messageName}', '${msgId}')`;
            pool.query(insertMobileSend, (err, res) => {
                console.log(err, res);
                pool.end();
            });
        }
        else
        {
            console.log('campaign not found');
        }
    });
}



/*
 * POST Handler for /publish/ route of Activity.
 */
exports.publish = function (req, res) {
    //console.log( req.body );
    logData(req);
    res.send(200, 'Publish');
};


/*
 * POST Handler for /validate/ route of Activity.
 */
exports.validate = function (req, res) {
    // Data from the req and put it in an array accessible to the main app.
    //console.log( req.body );
    logData(req);
    res.send(200, 'Validate');
};


/*
 * POST Handler for /Stop/ route of Activity.
 */
exports.stop = function (req, res) {
    // Data from the req and put it in an array accessible to the main app.
    //console.log( req.body );
    logData(req);
    res.send(200, 'Stop');
};

exports.requestTemplate = function (req, res) {
    const tokenURL = 'https://mcrcd9q885yh55z97cmhf8r1hy80.auth.marketingcloudapis.com/v2/token';
    // const queryURL = 'https://mcrcd9q885yh55z97cmhf8r1hy80.rest.marketingcloudapis.com/asset/v1/content/categories';
    const queryURL = 'https://mcrcd9q885yh55z97cmhf8r1hy80.rest.marketingcloudapis.com/asset/v1/content/assets?$pageSize=2500&$page=1&$orderBy=name';
    
    axios.post(tokenURL, { // Retrieving of token
        grant_type: 'client_credentials',
        client_id: 'lheifl2e4w0bgizkfyl9bcn5',
        client_secret: '8idtWktOr3RIc4PfZJYm7b6S'
    })
    .then(function (response) {
        let accessToken = response.data['access_token']; // After getting token, parse it through to grab the individual categories

        axios.get(queryURL, { //Query of Individual items
            headers: { Authorization: `Bearer ${accessToken}` } 
        }).then((response) => {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(response.data, null, 3));
        }).catch(function (error) {
            console.log('error in fetching access token --> ', error);
        });

    }).catch(function (error) {
        console.log('TOKEN ERROR >>',error);
    });
};

/*
 * POST Handler for retreiving 2 way SMS
 * PARAMS :
 *      Mobile=65<PHONE_NUM>
 *      Message=<MESSAGE>
 */
exports.smsResponse = function (request, response) { 
    response.status(200).json();     // show the data that is parsed into the page
    console.log('Inside sms response');
    console.log('request body-->',request.body);
    console.log('request params-->',request.params);

    let mobileNum = request.param('msisdn');
    let textMessage = request.param('content');
    console.log('mobileNum', request.param('msisdn'));
    console.log('textmessage', request.param('content'));
    if (mobileNum !== undefined && textMessage !== undefined) {
        console.log('Message is defined with a phone number');

        //if (mobileNum.charAt(0) == '9' && mobileNum.charAt(1) == '1') {
        if (true) {    
            mobileNum = mobileNum.substring(2);
            console.log('removed the 91 of the mobile num >>', mobileNum);

            const pool = new Pool({
                connectionString: connectionString
            });
            
            // Retreiving the keyword from campaigns of a contact
            // using the contact id, get the campaigns that are under the contact.
            // After getting the campaigns, get the keywords that are associated to that campaign
            let queryCampaignKeywords= `SELECT Keyword__c, Campaign__c 
                                        FROM salesforcetest.SMS_Keyword__c 
                                        WHERE Active__c = True
                                        AND Market__c = 'IN'
                                        AND Campaign__c IN (
                                            SELECT DISTINCT et4ae5__campaign__c 
                                            FROM salesforcetest.et4ae5__SMSDefinition__c 
                                            WHERE et4ae5__Contact__c 
                                            IN (
                                                SELECT sfid 
                                                FROM salesforcetest.Contact 
                                                WHERE Phone = '${mobileNum}'
                                                )
                                        );`;

            pool.query(queryCampaignKeywords, (err, res) => {
                console.log('===== Querying Rows =====');
                let responseRows = res.rows;
                
                for (let smsKeywordArr = 0; smsKeywordArr < responseRows.length; smsKeywordArr++) {
                    //  smsKeyword['keyword__c'] 
                    //  smsKeyword['campaign__c']
                    const smsKeyword = responseRows[smsKeywordArr];
                    let lowercaseKeyword = smsKeyword['keyword__c'];
                    let lowerTextMessage = textMessage.toLowerCase();
                    if (lowerTextMessage.includes(lowercaseKeyword.toLowerCase())) {
                        console.log('Campaign ID >>',smsKeyword['campaign__c']);

                        let updateSMSdef = `UPDATE salesforcetest.et4ae5__SMSDefinition__c 
                                            SET et4ae5__Message_Text__c = '${textMessage}' 
                                            WHERE et4ae5__Contact__c = (
                                                SELECT sfid 
                                                FROM salesforcetest.Contact 
                                                WHERE Phone = '${mobileNum}'
                                            ) and et4ae5__sendstatus__c = 'Completed'
                                            and et4ae5__campaign__c = '${smsKeyword['campaign__c']}'
                                            and createddate = (select max(createddate) from salesforcetest.et4ae5__SMSDefinition__c
                                            WHERE et4ae5__Contact__c = (
                                                SELECT sfid 
                                                FROM salesforcetest.Contact 
                                                WHERE Phone = '${mobileNum}'
                                            ) and et4ae5__sendstatus__c = 'Completed'
                                            and et4ae5__campaign__c = '${smsKeyword['campaign__c']}');`;

//                        let updateSMSdef = `UPDATE salesforcetest.et4ae5__SMSDefinition__c 
//                                            SET et4ae5__Message_Text__c = '${textMessage}' 
//                                            WHERE et4ae5__Contact__c = (
//                                                SELECT sfid 
//                                                FROM salesforcetest.Contact 
//                                                WHERE Phone = '${mobileNum}'
//                                            ) and et4ae5__sendstatus__c = 'completed'
//                                            and et4ae5__campaign__c = '${smsKeyword['campaign__c']}
//                                            and createddate = (select createddate from salesforcetest.et4ae5__SMSDefinition__c
//                                            WHERE et4ae5__Contact__c = (
//                                                SELECT sfid 
//                                                FROM salesforcetest.Contact 
//                                                WHERE Phone = '${mobileNum}'
//                                            ) and et4ae5__sendstatus__c = 'completed'
//                                            and et4ae5__campaign__c = '${smsKeyword['campaign__c']} order by createddate desc limit 1)`;                    

                        pool.query(updateSMSdef, (err, res) => {
                            console.log(err, res);
                            pool.end();
                        });
                    }
                }
            });
        }
    }
};



exports.smsDeliveryReport = function (request, response) { 
    response.status(200).json();     // show the data that is parsed into the page
    console.log(request.body);
    console.log('Inside smsDeliveryReprot');

    let msgId = request.param('MessageId');
    let status = request.param('DeliveryStatus');

    
    if (msgId !== undefined) {


            const pool = new Pool({
                connectionString: connectionString
            });
            
            // Retreiving the keyword from campaigns of a contact
            // using the contact id, get the campaigns that are under the contact.
            // After getting the campaigns, get the keywords that are associated to that campaign
            let queryCampaignKeywords= `SELECT * FROM salesforcetest.et4ae5__SMSDefinition__c 
                                            WHERE unique_id__c = '${msgId}';`;

            pool.query(queryCampaignKeywords, (err, res) => {
                console.log('===== Querying Rows =====');
                let responseRows = res.rows;
                
                
                    if (responseRows.length > 0) {
                        console.log('Inside If');
                        if(status == '1')
                        {
                            let updateSMSdef = `UPDATE salesforcetest.et4ae5__SMSDefinition__c 
                                            SET delivery_status__c = 'Success', error_code__c = '${status}'
                                            WHERE unique_id__c = '${msgId}';`;
                        }
                        else
                        {
                            let updateSMSdef = `UPDATE salesforcetest.et4ae5__SMSDefinition__c 
                            SET delivery_status__c = 'Failed', error_code__c = '${status}'
                            WHERE unique_id__c = '${msgId}';`; 
                        }    
                        pool.query(updateSMSdef, (err, res) => {
                            console.log(err, res);
                            pool.end();
                        });
                    }
                
            });
    }
    else
    {
        console.log('Message Id undefined');
    }
};


/**
 * This function relies on the env variables to be set
 * 
 * This function invokes the enhanced package authentication. 
 * This would return a access token that can be used to call additional Marketing Cloud APIs
 * 
 */
function retrieveToken () {
    axios.post(tokenURL, { // Retrieving of token
        grant_type: 'client_credentials',
        client_id: process.env.clientId,
        client_secret: process.env.clientSecret
    })
    .then(function (response) {
        return response.data['access_token'];
    }).catch(function (error) {
        return error;
    });
}
