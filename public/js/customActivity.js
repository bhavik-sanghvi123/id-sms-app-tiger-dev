define(['postmonger'], function (Postmonger) {
    'use strict';

    let connection = new Postmonger.Session();
    let authTokens = {};
    let payload = {};
   
    // Configuration variables
    let herokuURL = "https://id-sms-app-tiger-dev.herokuapp.com/";
    let phoneAttrSchema = ''; //Contact:Phone
    let idAttrSchema = ''; //Contact:Id
    let eventSchema = ''; // variable is used in parseEventSchema()
    let firstnameSchema = ''; //First Name || FirstName
    let lastnameSchema = ''; // variable is used in parseEventSchema()
    let eventDefinitionKey;

    $(window).ready(onRender);
    connection.on('initActivity', initialize);
    connection.on('requestedTokens', onGetTokens);
    connection.on('requestedEndpoints', onGetEndpoints);
    connection.on('clickedNext', save); //Save function within MC

    function onRender() {
        // JB will respond the first time 'ready' is called with 'initActivity'
        connection.trigger('ready');
        connection.trigger('requestTokens');
        connection.trigger('requestEndpoints');
    }

    /**
     * This function is to pull out the event definition without journey builder.
     * With the eventDefinitionKey, you are able to pull out values that passes through the journey
     */
    connection.trigger('requestTriggerEventDefinition');
    connection.on('requestedTriggerEventDefinition',function (eventDefinitionModel) {
        if (eventDefinitionModel) {
            eventDefinitionKey = eventDefinitionModel.eventDefinitionKey;
             console.log('Request Trigger >>>', JSON.stringify(eventDefinitionModel));
        }
    });
    
    function initialize(data) {
        if (data) {
            payload = data;
        }

        connection.trigger('updateButton', {
            button: 'next',
            text: 'done',
            visible: true
        });

        initialLoad(data);
        parseEventSchema();
    }

    function onGetTokens(tokens) {
        // Response: tokens = {token: <legacy token>, fuel2token: <fuel api token>}
        authTokens = tokens;
    }

    function onGetEndpoints(endpoints) {
        // Response: endpoints = { restHost: <url> } i.e "rest.mc.s4.exacttarget.com"
    }


    /**
     * Save function is fired off upon clicking of "Done" in Marketing Cloud
     * The config.json will be updated here if there are any updates to be done via Front End UI
     */
    function save() {

        var textMessageValue = $('#textMessage').val();
        let textMessageID = document.getElementById("textMessage");
        let campaignName = $('#campaignName').val();
        let brandNames = $('#brandNames').val();
        let linkShorten = $('#linkShorten').val();
        var regexExp = /\%%.*?\%%/ig;
        var regexedStr = textMessageValue.replace(regexExp, function replace(match) {
            var words = match.replace(/%%/g, '');
            return '{{Event.' + eventDefinitionKey + '."' + words + '"}}'; 
        });


        payload['arguments'].execute.inArguments = [
            {
                "phoneNumber": `{{Event.${eventDefinitionKey}."${phoneAttrSchema}"}}`,
                "textMessage": regexedStr,
                "tokens": authTokens,
                "firstName": `{{Event.${eventDefinitionKey}."${firstnameSchema}"}}`,
                "lastName": `{{Event.${eventDefinitionKey}."${lastnameSchema}"}}`,
                "selectedMsgID": textMessageID.dataset.hiddenmsgid,
                "campaignName": campaignName,
                "contactID": `{{Event.${eventDefinitionKey}."${eventSchema}Id"}}`,
                "smsBoolean": `{{Event.${eventDefinitionKey}."${eventSchema}SMSOptOut__c"}}`,
                "shortMsg": textMessageID.dataset.hiddenshortmsg,
                "brandNames":brandNames,
                "linkShorten":linkShorten
            }
        ];
        payload['metaData'].isConfigured = true;

        connection.trigger('updateActivity', payload);
    }

    /**
     * 
     * @param {*} data
     * 
     * This data param is the config json payload that needs to be loaded back into the UI upon opening the custom application within journey builder 
     * This function is invoked when the user clicks on the custom activity in Marketing Cloud. 
     * If there are information present, it should be loaded back into the appropriate places. 
     * e.g. input fields, select lists
     */
    function initialLoad (data) {
        console.log('Inside initial load');

        let objArr = [];
        let savedData = data;
        $("#textMessage").val(savedData.arguments.execute.inArguments[0].textMessage);
		document.getElementById("textMessage").dataset.hiddenmsgid = savedData.arguments.execute.inArguments[0].selectedMsgID;
		document.getElementById("textMessage").dataset.hiddenshortmsg = savedData.arguments.execute.inArguments[0].shortMsg;
        $('#campaignName').val(savedData.arguments.execute.inArguments[0].campaignName);
        $('#brandNames').val(savedData.arguments.execute.inArguments[0].brandNames);
        $('#linkShorten').val(savedData.arguments.execute.inArguments[0].linkShorten);

        $.ajax({
            type: "GET",
            url: `${herokuURL}reqTemplateSMS`,
            contentType: "application/json; charset=utf-8",
            dataType: "json",
            success: function (data) {
                // On successfull AJAX call it'll pull the data down and create the appropriate cards on the page
                // console.log("DATA >>", data);
                objArr = data.items;

                var initialCard = document.querySelector('.card');
                initialCard.classList.remove('loading');
                initialCard.classList.add('hide');

                //Loop through the payload to render the cards on the page
                for (var i = 0; i < objArr.length; i++) {
                    if (objArr[i].assetType.displayName == 'JSON Message') {

                        var str = '';
                        if (objArr[i].views.sMS !== undefined) {
                            str = objArr[i].views.sMS.meta.options.customBlockData['display:message'];

                        } else if (objArr[i].views.sms !== undefined) {
                            str = objArr[i].views.sms.meta.options.customBlockData['display:message'];
                           
                        } else {
                            console.log('no such structure found in json');
                        }

                        var cardItem = document.querySelector(".card");
                        var clonedItem = cardItem.cloneNode(true);
                        clonedItem.classList.remove('hide');
                        clonedItem.dataset.idofmsg = i;
                        clonedItem.dataset.shortmsg = objArr[i].name;
                        clonedItem.querySelector('.card-title').innerHTML = objArr[i].name;
                        clonedItem.querySelector('.card-text').innerHTML = str;
                        document.querySelector(".card-container").appendChild(clonedItem);
                        if (clonedItem.dataset.idofmsg == savedData.arguments.execute.inArguments[0].selectedMsgID) {
                            clonedItem.classList.add('active');
                        }
                    }
                }

                let cardObjects = [].slice.call(document.querySelectorAll(".card"));
                let hiddenMsg = document.getElementById("textMessage");

                // Looping through the array and creating the card DOMs to be placed on the page
				cardObjects.forEach(function(cards) {
					let messageText = cards.querySelector(".card-text"); //selection of every message
					cards.addEventListener("click", function() {
						removeSelectedClass();
						cards.classList.add("active");
						hiddenMsg.value = messageText.innerHTML;
                        hiddenMsg.dataset.hiddenmsgid = cards.dataset.idofmsg;
                        hiddenMsg.dataset.hiddenshortmsg = cards.dataset.shortmsg;
					}); //card eventlistener
				}); //end of cards
            },
            error: function (XMLHttpRequest, textStatus, errorThrown) {
                console.log("Status >> " + textStatus);
                console.log("Error >> " + errorThrown);
            }
        });
    };

    function removeSelectedClass () {
        let cardObjects = [].slice.call(document.querySelectorAll(".card"));
        cardObjects.forEach(function(cards) {
            cards.classList.remove('active');
        });
    }

    /**
     * This function is to pull the relevant information to create the schema of the objects
     * 
     * This function pulls out the schema for additional customizations that can be used.
     * This function leverages on the required field of "Last Name" to pull out the overall event schema
     * 
     * returned variables of: lastnameSchema , eventSchema.
     * eventSchema = Case:Contact:
     * lastnameSchema = Case:Contact:<last_name_schema>
     * 
     * View the developer console in chrome upon opening of application in MC Journey Builder for further clarity.
     */
    function parseEventSchema() {
        // Pulling data from the schema
        connection.trigger('requestSchema');
        connection.on('requestedSchema', function (data) {
            // save schema
            let dataJson = data['schema'];
            console.log("data json -->", dataJson);
            for (let i = 0; i < dataJson.length; i++) {

                // Last name schema and creation of event schema
                // Last name is a required field in SF so this is used to pull the event schema
                

                if (dataJson[i].key.indexOf("Phone") !== -1) {
                    console.log("inside phone attri>");
                    let splitArr = dataJson[i].key.split(".");
                    phoneAttrSchema = splitArr[splitArr.length - 1];
                    console.log("phoneAttrSchema -- > ",phoneAttrSchema);
                }

                // First name schema and creation of event schema
                if (dataJson[i].key.toLowerCase().replace(/ /g, '').indexOf("firstname") !== -1) {
                    // console.log('str splitted >> ',dataJson[i].key.split("."));
                    let splitArr = dataJson[i].key.split(".");
                    firstnameSchema = splitArr[splitArr.length - 1];
                    //console.log('First Name Schema >>', firstnameSchema);
                }
                
                if (dataJson[i].key.toLowerCase().replace(/ /g, '').indexOf("lastname") !== -1) {
                    let splitArr = dataJson[i].key.split(".");
                    lastnameSchema = splitArr[splitArr.length - 1];
                    console.log('Last Name Schema >>', lastnameSchema);

                    let splitName = lastnameSchema.split(":");
                    let reg = new RegExp(splitName[splitName.length - 1], "g");
                    let oldSchema = splitArr[splitArr.length - 1];
                    
                    eventSchema = oldSchema.replace(reg, "");
                    console.log("Event Schema >>", eventSchema);
                }
            }

        });
    }
});