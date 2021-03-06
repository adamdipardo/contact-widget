var geocoder = new google.maps.Geocoder();
var foundAddressContainer = document.getElementsByClassName('found-address')[0];
var ridingInfoContainer = document.getElementsByClassName('found-riding')[0];
var placesService = new google.maps.places.PlacesService(foundAddressContainer);
var placeId;
var matchedAddress;
var language;
var ridingName;
var ridingsList;

// global vars
var primaryColor;
var message;
var successUrl;
var repName;
var districtName;
var tweetMessage;
var tweetVia;
var isFullAddress;
var customFields;
var mergeTags = [];
var country;
var chooseLists = [];
var fullAddressFields = ['address1','address2','city','province','country','postal-code'];

// get query params
var urlParams;
(window.onpopstate = function () {
    var match,
        search = /([^&=]+)=?([^&]*)/g,
        decode = function (s) { return decodeURIComponent(s); },
        query  = window.location.search.substring(1);

    urlParams = {};
    while (match = search.exec(query))
       urlParams[decode(match[1])] = decode(match[2]);
})();

var isTwitter = urlParams.twitter == 'true';

// set color of loading icon
var childrenArray = Array.prototype.slice.call(document.getElementsByClassName('spinner')[0].children);
for (var i = 0; i < childrenArray.length; i++)
    childrenArray[i].style.backgroundColor = '#' + urlParams.loadingColor;

// set initial height of iframe while loading
updateHeight(40);

// load campaign information
var xhr = new XMLHttpRequest();
xhr.open('GET', encodeURI('/api/campaigns/'+urlParams.campaign+'/read'));
xhr.onload = function() {
	document.getElementsByClassName('loader')[0].classList.add('hidden');
    if (xhr.status === 200) {
        // get JSON data
        var responseJson = JSON.parse(xhr.responseText);

        // form vars
        var messageField = document.getElementById('message');
        var submitButton = document.getElementsByClassName('btn-submit')[0];
        var formIntro = document.getElementsByClassName('form-intro')[0];
        var body = document.getElementsByTagName('body')[0];

        // set address bool
        isFullAddress = responseJson.fullAddress == true;

        // show all address fields if needed
        if (isFullAddress)
            document.getElementById('extra-address-fields').style.display = 'block';

        // set iframe content and default form values
        if (!isTwitter)
            formIntro.innerHTML = responseJson.introduction;

        // can we choose lists?
        if (responseJson.selectLists == true) {
            chooseLists = responseJson.lists;
        }

        if (responseJson.lockMessage && !isTwitter) {
            messageField.parentNode.removeChild(messageField);
            document.getElementById('message-label').parentNode.removeChild(document.getElementById('message-label'));
            document.getElementById('fixed-message').innerHTML = responseJson.message;
            document.getElementById('fixed-message').style.display = 'block';
        }
        else if (isTwitter) {
            messageField.parentNode.removeChild(messageField);
            document.getElementById('message-label').parentNode.removeChild(document.getElementById('message-label'));
        }
        else
            messageField.innerHTML = responseJson.message;

        // set french labels if needed
        language = responseJson.language;
        if (language == 'fr') {
            document.getElementById('name-label').innerHTML = 'Nom';
            document.getElementById('email-label').innerHTML = 'Courriel';

            if (isFullAddress) {
                // document.getElementById('address-label').innerHTML = 'Adresse';
                // document.getElementById('address').setAttribute('placeholder', 'Tapez pour sélectionner une adresse');
            }
            else {
                document.getElementById('postal-code-label').innerHTML = 'Code Postal';
                document.getElementById('postal-code').setAttribute('placeholder', 'Tapez pour sélectionner un code postal');
            }

            document.getElementById('error-message').innerHTML = 'S\'il vous plaît essayez plus tard';
            document.getElementById('thank-you-message').innerHTML = 'Merci de votre soutien';
            document.getElementById('address1-label').innerHTML = 'Ligne d\'adresse 1';
            document.getElementById('address2-label').innerHTML = 'Ligne d\'adresse 2';
            document.getElementById('city-label').innerHTML = 'Ville';
            document.getElementById('province-label').innerHTML = 'Province';
            document.getElementById('country-label').innerHTML = 'Région';
            document.getElementById('postal-code-label').innerHTML = 'Code Postal';
            // document.getElementById('address-prompt').innerHTML = 'Si votre adresse ne semble pas , cliquez ici pour essayer d\'entrer manuellement'
            document.getElementById('riding-label').innerHTML = 'Circonscription';

            if (!responseJson.lockMessage && !isTwitter)
                document.getElementById('message-label').innerHTML = 'Message';
        }

        if (responseJson.country == 'US' && language == 'en') {
            document.getElementById('postal-code-label').innerHTML = 'ZIP Code';
            document.getElementById('province-label').innerHTML = 'State';
        }

        if (!isTwitter)
            submitButton.innerHTML = responseJson.sendText;
        else
            submitButton.innerHTML = '<i class="fa fa-twitter"></i> Tweet';

        // css
        submitButton.style.backgroundColor = '#' + responseJson.customization.primaryColor;
        submitButton.style.color = whiteOrBlackFromColor(responseJson.customization.primaryColor);

        body.style.color = '#' + responseJson.customization.secondaryColor;

        // set vars
        primaryColor = responseJson.customization.primaryColor;
        message = responseJson.message;
        successUrl = responseJson.successUrl;
        tweetMessage = responseJson.tweetMessage;
        tweetVia = responseJson.tweetVia;
        country = responseJson.country;
        repName = getPrimaryRepName(responseJson.lists);
        districtName = getPrimaryDistrictName(responseJson.lists);

        // show contact?
        if (responseJson.contactText && !isTwitter) {
            document.getElementsByClassName('contact-opt-in-text')[0].innerHTML = responseJson.contactText;
            document.getElementsByClassName('contact-opt-in')[0].classList.remove('hidden');
        }

        // set twitter URL
        if (isTwitter) {
            setTwitterURL();
        }

        // add custom fields
        if (responseJson.fields && responseJson.fields.length > 0) {
            customFields = responseJson.fields;

            for (var i = 0; i < responseJson.fields.length; i++) {
                var fieldContainer = document.createElement('div');
                fieldContainer.className = 'form-group';

                var fieldLabel = document.createElement('label');
                fieldLabel.htmlFor = responseJson.fields[i].slug;
                fieldLabel.innerHTML = responseJson.fields[i].name;

                fieldContainer.appendChild(fieldLabel);

                var field = document.createElement('input');
                field.setAttribute('name', responseJson.fields[i].slug);
                field.setAttribute('id', responseJson.fields[i].slug);
                field.setAttribute('class', responseJson.fields[i].slug);
                field.setAttribute('type', 'text');

                fieldContainer.appendChild(field);

                document.getElementsByClassName('contact-custom-fields-container')[0].appendChild(fieldContainer);
            }
        }

        // merge-fields autofill
        var foundMergeTags = getAllMergeTags(message);

        // did we find merge tags?
        if ( foundMergeTags && foundMergeTags.length > 0 ) {

            // loop through found tags
            for (var i = 0; i < foundMergeTags.length; i++) {

                // array for all form elements associated with the tag
                var formIds;

                // figure out form elements associated with tag
                switch(foundMergeTags[i]) {
                    case '*|SENDER_NAME|*':
                    case '*|NOM_DE_LEXPEDITEUR|*':
                        formIds = ['name'];
                        break;
                    case '*|ADDRESS|*':
                    case '*|ADRESSE|*':
                        if (isFullAddress)
                            formIds = ['address1'];
                        else
                            formIds = ['postal-code'];
                        break;
                    case '*|RIDING|*':
                    case '*|CIRSCONSCRIPTION|*':
                        formIds = ['riding'];
                        break;
                    case '*|RECIPIENT_NAME|*':
                    case '*|NOM_DU_DESTINATAIRE|*':
                        formIds = ['riding'];
                        break;
                    default:
                        // handle custom fields
                        for (var x = 0; x < customFields.length; x++) {
                            if (getMergeTagOfCustomField(customFields[x].slug) == getCleanMergeTag(foundMergeTags[i])) {
                                formIds = [customFields[x].slug];
                            }
                        }
                        break;
                }

                // add event handlers for all needed form inputs
                for (var x = 0; x < formIds.length; x++)
                    document.getElementById(formIds[x]).addEventListener('input', updateMergeTag, false);

                // add tag to global list
                mergeTags.push({
                    ids:formIds,
                    tag:foundMergeTags[i],
                    cleanTag: getCleanMergeTag(foundMergeTags[i])
                });

            }

            // add in placeholder spans
            updateProperMessageText(addMergeTagPlaceholders(mergeTags, message));
        }

        // show form
        document.getElementsByClassName('form')[0].classList.remove('hidden');

        // set height of message field to match message
        if (!responseJson.lockMessage && !isTwitter)
            messageField.style.height = messageField.scrollHeight + 'px';

        updateHeight();
    }
    else {
        // show error
        document.getElementsByClassName('load-error')[0].classList.remove('hidden');

        updateHeight();
    }
};
xhr.send();

// event listenders
document.getElementsByTagName('form')[0].addEventListener('submit', onFormSubmit, false);
document.getElementById('postal-code').addEventListener('input', onPostalCodeKeyUp, false);

function onFormSubmit(e) {

    // don't actually submit the form
    e.preventDefault();

    var errorMessage = document.getElementsByClassName('error')[0];
    errorMessage.innerHTML = '';

    // adjust iframe height
    updateHeight();

    // check for errors
    var fields = [
        document.getElementById('name'),
        document.getElementById('email'),
        document.getElementById('postal-code')
    ];

    if (document.getElementById('message'))
        fields.push(document.getElementById('message'));

    var hasMissingFields = false;
    for (var i = 0; i < fields.length; i++) {
        if (fields[i].getAttribute('id') == 'address' || fields[i].getAttribute('id') == 'address2')
            continue;

        if (fields[i].getAttribute('id') == 'message') {
            if (!fields[i].innerHTML || fields[i].innerHTML.trim() == "") {
                hasMissingFields = true;
                break;
            }
        }
        else if (!fields[i].value || fields[i].value.trim() == "") {
            hasMissingFields = true;
            break;
        }
    }

    // check for missing custom fields
    var hasMissingCustomFields = false;
    var missingCustomFields = [];
    if (customFields && customFields.length > 0) {
        for (var i = 0; i < customFields.length; i++) {
            if (customFields[i].isRequired == true) {
                var customField = document.getElementById('contact-custom-fields-container')
                    .getElementsByClassName(customFields[i].slug)[0];

                if (!customField.value || !customField.value.trim()) {
                    hasMissingCustomFields = true;
                    missingCustomFields.push('<i class="fa fa-exclamation-triangle"></i> Please enter a value for ' + customFields[i].name);
                }

            }
        }
    }

    // check for selectable lists
    var didNotChoose = false;
    if (chooseLists.length > 1) {
        var chosenLists = document.querySelectorAll('div.form-group.choose-lists > div input[type="checkbox"]:checked');
        if (chosenLists.length == 0) {
            didNotChoose = true;
        }
    }

    if (hasMissingFields) {
        var errorStr = '<i class="fa fa-exclamation-triangle"></i> ';
        errorStr += language == 'en' ? 'Please fill in all fields.' : 'Veuillez remplir tous les champs.';
        setErrorMessage(errorStr);
    }
    else if (!/@/.test(fields[1].value)) {
        var errorStr = '<i class="fa fa-exclamation-triangle"></i> ';
        errorStr += language == 'en' ? 'Please enter a valid email address.' : 'Veuillez entrer un adresse électronique valide.';
        setErrorMessage(errorStr);
    }
    else if (country == 'CA' && !/[a-zA-z][0-9][a-zA-z][ ]?[0-9][a-zA-z][0-9]/.test(fields[2].value)) {
        var errorStr = '<i class="fa fa-exclamation-triangle"></i> ';
        errorStr += language == 'en' ? 'Please enter a valid postal code.' : 'Veuillez entrer un code postal valide.';
        setErrorMessage(errorStr);
    }
    else if (country == 'US' && !/[0-9]{5}/.test(fields[2].value)) {
        var errorStr = '<i class="fa fa-exclamation-triangle"></i> ';
        errorStr += language == 'en' ? 'Please enter a valid ZIP code.' : 'Veuillez entrer un code postal valide.';
        setErrorMessage(errorStr);
    }
    else if (hasMissingCustomFields) {
        var errorStr = missingCustomFields.join('<br />');
        setErrorMessage(errorStr);
    }
    else if (didNotChoose == true) {
        var errorStr = '<i class="fa fa-exclamation-triangle"></i> ';
        errorStr += language == 'en' ? 'Please choose at least one list to send to.' : 'Please choose at least one list to send to.';
        setErrorMessage(errorStr);
    }
    else if (isFullAddress) {
        // check for complete manul address
        var address1 = document.getElementById('address1'),
            address2 = document.getElementById('address2'),
            city = document.getElementById('city'),
            province = document.getElementById('province'),
            country = document.getElementById('country'),
            postalCode = document.getElementById('postal-code');

        if (!city.value || !province.value || !country.value) {
            var errorStr = '<i class="fa fa-exclamation-triangle"></i> ';
            errorStr += language == 'en' ? 'Please enter your full address' : 'SVP indiquez votre adresse complète';
            setErrorMessage(errorStr);
        }
        else {
            if (isTwitter) {
                document.getElementsByClassName('twitter-button')[0].click();
            }

            var addressStr = country.value + " " + postalCode.value;
            geocoder.geocode({address: addressStr}, function(results, status) {
                if (status == google.maps.GeocoderStatus.OK) {
                    matchedAddress = results[0];
                    submitForm(fields);
                }
                else {
                    var errorStr = '<i class="fa fa-exclamation-triangle"></i> ';
                    errorStr += 'Error: ' + status;
                    setErrorMessage(errorStr);
                }
            });
        }
    }
    else {
        if (isTwitter) {
            document.getElementsByClassName('twitter-button')[0].click();
        }

        var addressStr = document.getElementById('postal-code').value;
        geocoder.geocode({address: addressStr}, function(results, status) {
            if (status == google.maps.GeocoderStatus.OK) {
                matchedAddress = results[0];
                submitForm(fields);
            }
            else {
                var errorStr = '<i class="fa fa-exclamation-triangle"></i> ';
                errorStr += 'Error: ' + status;
                setErrorMessage(errorStr);
            }
        });
        // submitForm(fields);
    }

}

function onAddressBlur(e) {

    if (isFullAddress && !placeId) {

        autocompleteService.getPlacePredictions({input: e.target.value}, function(predictions) {

            // get place long info
            placesService.getDetails({placeId: predictions[0].place_id}, function(result) {
                setMapFoundLocation(result.adr_address);
                matchedAddress = result;
                getRidingAndCandidates(result.geometry.location.G, result.geometry.location.K);
            });
        });

    }

}

function onAddressKeyDown(e) {

    if (e.which == 13 && document.getElementsByClassName('pac-container')[0].style.display == '') {
        e.preventDefault();
    }

}

function onPostalCodeKeyUp(e) {

    if (country == 'CA' && /[a-zA-z][0-9][a-zA-z][ ]?[0-9][a-zA-z][0-9]/.test(e.target.value))
        getRidingAndCandidatesFromPostalCodeGeo(e.target.value);
    else if (country == 'US' && /[0-9]{5}/.test(e.target.value))
        getRidingAndCandidatesFromPostalCodeGeo(e.target.value);
}

function onPlaceChanged(e) {
    if (autocomplete.getPlace()) {
        var place = autocomplete.getPlace();
        matchedAddress = place;
        placeId = place.place_id;
        setMapFoundLocation(place.adr_address);
        getRidingAndCandidates(place.geometry.location.lat(), place.geometry.location.lng());
    }
}

function onAddressPromptClick(e) {
    e.preventDefault();

    document.getElementById('extra-address-fields').style.display = 'block';
    document.getElementById('address').parentNode.style.display = 'none';
    document.getElementById('address1').focus();
    updateHeight();
}

// functions
function getColorLuma(c) {
    var rgb = parseInt(c, 16);   // convert rrggbb to decimal
    var r = (rgb >> 16) & 0xff;  // extract red
    var g = (rgb >>  8) & 0xff;  // extract green
    var b = (rgb >>  0) & 0xff;  // extract blue

    return 0.2126 * r + 0.7152 * g + 0.0722 * b; // per ITU-R BT.709
}

function whiteOrBlackFromColor(color) {
    return whiteOrBlackFromLuma(getColorLuma(color));
}

function whiteOrBlackFromLuma(luma) {
    return luma >= 50 ? 'black' : 'white';
}

function setErrorMessage(message) {
    document.getElementsByClassName('error')[0].innerHTML = message;
    updateHeight();
}

function setMapFoundLocation(locationStr) {
    var addressLabel = language == 'en' ? 'Matched Address' : 'Adresse';
    foundAddressContainer.innerHTML = '<span style="color: #'+primaryColor+'"><i class="fa fa-map-marker"></i> '+addressLabel+':</span> ' + locationStr;
    updateHeight();
}

function updateHeight(extra) {
    if (typeof(extra) == "undefined")
        extra = 0;
    window.parent.postMessage({height: document.body.scrollHeight + extra, campaign: urlParams.campaign, isTwitter: isTwitter}, '*');
}

function setMultipleRidingInfo(ridings, showLoading) {

    // hide the list chooser
    document.querySelector('div.form-group.choose-lists').style.display = 'none';

    if (showLoading === true) {
        ridingInfoContainer.innerHTML = '<div class="loader"><div class="spinner address-spinner"><div class="rect1"></div><div class="rect2"></div><div class="rect3"></div><div class="rect4"></div></div></div>';
        var childrenArray = Array.prototype.slice.call(document.getElementsByClassName('address-spinner')[0].children);
        for (var i = 0; i < childrenArray.length; i++)
            childrenArray[i].style.backgroundColor = '#' + urlParams.loadingColor;
    }
    else {
        var primaryRiding = getPrimaryList(ridings);

        var candidatesList = [];
        var candidatesTwitter = [];
        ridingName = primaryRiding.riding;
        var recipients = [];

        if (chooseLists.length > 1) {
            for (var i = 0; i < ridings.length; i++) {
                for (var x = 0; x < ridings[i].candidates.length; x++) {
                    candidatesList.push(ridings[i].candidates[x].name);
                    recipients.push(ridings[i].candidates[x].name);
                }
                addRidingCandidatesToList(chooseLists, ridings[i]);
            }
        }
        else {
            if (typeof(primaryRiding.candidates) != 'undefined') {
                for (var i = 0; i < primaryRiding.candidates.length; i++) {
                    candidatesList.push(primaryRiding.candidates[i].name);

                    if (primaryRiding.candidates[i].twitter)
                        candidatesTwitter.push(primaryRiding.candidates[i].twitter.indexOf('@') === 0 ? primaryRiding.candidates[i].twitter : '@' + primaryRiding.candidates[i].twitter);
                }

                for (var i = 0; i < ridings.length; i++) {
                    if (ridings[i].candidates) {
                        for (var x = 0; x < ridings[i].candidates.length; x++) {
                            recipients.push(ridings[i].candidates[x].name);
                        }
                    }
                }
            }
        }

        if (primaryRiding.riding) {
            var ridingLabel = language == 'en' ? 'Your ' + districtName : 'Circonscription';
            if (chooseLists.length > 1) {
                var candidatesLabel = language == 'en' ? 'Your message will be sent to' : 'Député(e)';
            }
            else {
                var candidatesLabel = language == 'en' ? 'Your ' + repName : 'Député(e)';
            }
            var changeLabel = '<a id="change-riding-link">' + (language == 'en' ? 'Incorrect ' + districtName + '? Click here to change it.' : 'Mauvaise circonscription? Indiquez la vôtre manuellement ici.') + '</a>';
            ridingInfoHTML = '<span><span style="color: #'+primaryColor+'"><i class="fa fa-university"></i> '+ridingLabel+':</span> ' + primaryRiding.riding + ' ' + changeLabel + '</span>';
            if (candidatesList.length) {
                ridingInfoHTML += '<span><span style="color: #'+primaryColor+'"><i class="fa fa-users"></i> '+candidatesLabel+' </span> <span id="candidates-list">' + candidatesList.join(', ') + '</span></span>';
            }
            ridingInfoContainer.innerHTML = ridingInfoHTML;
            document.getElementById('change-riding-link').addEventListener('click', onClickChangeRiding);

            if (candidatesTwitter.length)
                setTwitterURL(candidatesTwitter.join(','));
            else
                setTwitterURL();

            // merge tag
            for (var i = 0; i < mergeTags.length; i++) {
                if (mergeTags[i].tag == "*|RIDING|*" || mergeTags[i].tag == "*|CIRSCONSCRIPTION|*") {
                    replaceTag(getProperMessageElement(), mergeTags[i].cleanTag, ridingName);
                }
                if ((mergeTags[i].tag == "*|RECIPIENT_NAME|*" || mergeTags[i].tag == "*|NOM_DU_DESTINATAIRE|*") && typeof(primaryRiding.candidates) != 'undefined') {
                    replaceTag(getProperMessageElement(), mergeTags[i].cleanTag, recipients.join(', '));
                }
            }

            // can we choose lists?
            if (chooseLists.length > 1) {
                var chooseListsContainer = document.querySelector('div.form-group.choose-lists > div');
                chooseListsContainer.innerHTML = '';
                chooseListsContainer.parentNode.style.display = 'block';

                for (var i = 0; i < chooseLists.length; i++) {
                    var checkbox = document.createElement('div');
                    checkbox.classList.add('checkbox');
                    checkbox.innerHTML = '<label><input type="checkbox" name="selectLists" value="' + chooseLists[i].id + '" checked="checked">' + chooseLists[i].label + '</label></div>';
                    chooseListsContainer.appendChild(checkbox);
                }

                var listBoxes = document.querySelectorAll('div.form-group.choose-lists input[type="checkbox"]');
                for (var i = 0; i < listBoxes.length; i++) {
                    listBoxes[i].addEventListener('change', function(e) {
                        var newRecipients = [];
                        for (var x = 0; x < listBoxes.length; x++) {
                            if (listBoxes[x].checked) {
                                for (var z = 0; z < chooseLists.length; z++) {
                                    if (chooseLists[z].id == listBoxes[x].value) {
                                        for (var y = 0; y < chooseLists[z].candidates.length; y++) {
                                            newRecipients.push(chooseLists[z].candidates[y].name);
                                        }
                                    }
                                }
                            }
                        }
                        document.getElementById('candidates-list').innerHTML = newRecipients.join(', ');
                        for (var x = 0; x < mergeTags.length; x++) {
                            if ((mergeTags[x].tag == "*|RECIPIENT_NAME|*" || mergeTags[x].tag == "*|NOM_DU_DESTINATAIRE|*")&& typeof(primaryRiding.candidates) != 'undefined') {
                                replaceTag(getProperMessageElement(), mergeTags[x].cleanTag, newRecipients.join(', '));
                            }
                        }
                    });
                }
            }
        }
        else {
            ridingInfoContainer.innerHTML = '';
        }
    }

    updateHeight();
}

function setRidingInfo(name, candidates, showLoading) {

    if (showLoading === true) {
        ridingInfoContainer.innerHTML = '<div class="loader"><div class="spinner address-spinner"><div class="rect1"></div><div class="rect2"></div><div class="rect3"></div><div class="rect4"></div></div></div>';
        var childrenArray = Array.prototype.slice.call(document.getElementsByClassName('address-spinner')[0].children);
        for (var i = 0; i < childrenArray.length; i++)
            childrenArray[i].style.backgroundColor = '#' + urlParams.loadingColor;
    }
    else {
        var candidatesList = [];
        var candidatesTwitter = [];
        ridingName = name;

        if (typeof(candidates) != 'undefined') {
            for (var i = 0; i < candidates.length; i++) {
                candidatesList.push(candidates[i].name);

                if (candidates[i].twitter)
                    candidatesTwitter.push(candidates[i].twitter.indexOf('@') === 0 ? candidates[i].twitter : '@' + candidates[i].twitter);
            }
        }

        if (name) {
            var ridingLabel = language == 'en' ? 'Your ' + districtName : 'Circonscription';
            var candidatesLabel = language == 'en' ? 'Your ' + repName : 'Candidat(e)s';
            var changeLabel = '<a id="change-riding-link">' + (language == 'en' ? 'Incorrect ' + districtName + '? Click here to change it.' : 'Mauvaise circonscription? Indiquez la vôtre manuellement ici.') + '</a>';
            var ridingInfoHTML = '<span><span style="color: #'+primaryColor+'"><i class="fa fa-university"></i> '+ridingLabel+':</span> ' + name + ' ' + changeLabel + '</span>';
            if (candidatesList.length) {
                 ridingInfoHTML += '<span><span style="color: #'+primaryColor+'"><i class="fa fa-users"></i> '+candidatesLabel+' </span> ' + candidatesList.join(', ') + '</span>';
            }
            ridingInfoContainer.innerHTML = ridingInfoHTML;
            document.getElementById('change-riding-link').addEventListener('click', onClickChangeRiding);

            if (candidatesTwitter.length)
                setTwitterURL(candidatesTwitter.join(','));
            else
                setTwitterURL();

            // merge tag
            for (var i = 0; i < mergeTags.length; i++) {
                if (mergeTags[i].tag == "*|RIDING|*" || mergeTags[i].tag == "*|CIRSCONSCRIPTION|*") {
                    replaceTag(getProperMessageElement(), mergeTags[i].cleanTag, ridingName);
                }
                if ((mergeTags[i].tag == "*|RECIPIENT_NAME|*" || mergeTags[i].tag == "*|NOM_DU_DESTINATAIRE|*") && typeof(candidates) != 'undefined') {
                    replaceTag(getProperMessageElement(), mergeTags[i].cleanTag, candidatesList.join(', '));
                }
            }
        }
        else {
            ridingInfoContainer.innerHTML = '';
        }
    }

    updateHeight();
}

function onClickChangeRiding() {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', encodeURI('/api/campaigns/'+urlParams.campaign+'/ridings/read'));
    xhr.onload = function() {
        if (xhr.status === 200) {
            var responseJson = JSON.parse(xhr.responseText);
            ridingsList = responseJson;
            var riding = document.getElementById('riding');
            var ridings = [];
            for (var i = 0; i < responseJson.length; i++) {
                ridings.push(responseJson[i].name);
            }
            riding.setAttribute('data-list', ridings.join(', '));
            document.getElementsByClassName('change-riding')[0].style.display = 'block';

            new Awesomplete(riding, {autoFirst: true, minChars: 1});
            riding.setAttribute('placeholder', language == 'en' ? 'Type to select a ' + districtName : '');
            riding.focus();

            riding.addEventListener('awesomplete-selectcomplete', onSelectedNewRiding);

            updateHeight();
        }
    }
    xhr.send();
}

function onSelectedNewRiding() {

    var ridingId = getRidingIdFromName(document.getElementById('riding').value);

    setRidingInfo('', [], true);

    var xhr = new XMLHttpRequest();
    xhr.open('GET', encodeURI('/api/campaigns/'+urlParams.campaign+'/ridings/'+ridingId+'/read'));
    xhr.onload = function() {
        document.getElementsByClassName('loader')[0].classList.add('hidden');
        if (xhr.status === 200) {
            var responseJson = JSON.parse(xhr.responseText);
            setRidingInfo(responseJson.riding, responseJson.candidates);
        }
        else {
            setRidingInfo('', []);
        }
    }
    xhr.send();
}

function getRidingIdFromName(ridingName) {
    var ridingId;
    for (var i = 0; i < ridingsList.length; i++) {
        if (ridingsList[i].name == ridingName) {
            ridingId = ridingsList[i].id;
            break;
        }
    }
    return ridingId;
}

function getRidingAndCandidates(lat, long) {

    setMultipleRidingInfo([], true);

    var xhr = new XMLHttpRequest();
    xhr.open('GET', encodeURI('/api/campaigns/'+urlParams.campaign+'/ridings/'+lat+'/'+long+'/read'));
    xhr.onload = function() {
        document.getElementsByClassName('loader')[0].classList.add('hidden');
        if (xhr.status === 200) {
            var responseJson = JSON.parse(xhr.responseText);
            setMultipleRidingInfo(responseJson, false);
        }
        else {
            setMultipleRidingInfo([], true);
        }
    }
    xhr.send();
}

function getRidingAndCandidatesFromPostalCodeGeo(postalCode) {

    // get lat long from postal code
    geocoder.geocode({address: postalCode}, function(results, status) {
        if (status == google.maps.GeocoderStatus.OK) {
            matchedAddress = results[0];
            getRidingAndCandidates(matchedAddress.geometry.location.lat(), matchedAddress.geometry.location.lng());
        }
        else {
            var errorStr = '<i class="fa fa-exclamation-triangle"></i> ';
            errorStr += 'Error: ' + status;
            setErrorMessage(errorStr);
        }
    });
}

function getRidingAndCandidatesFromPostalCode(postalCode) {
    setRidingInfo('', [], true);

    postalCode = postalCode.replace(" ", "");

    var xhr = new XMLHttpRequest();
    xhr.open('GET', encodeURI('/api/campaigns/'+urlParams.campaign+'/ridings/'+postalCode+'/read'));
    xhr.onload = function() {
        document.getElementsByClassName('loader')[0].classList.add('hidden');
        if (xhr.status === 200) {
            var responseJson = JSON.parse(xhr.responseText);
            setRidingInfo(responseJson.riding, responseJson.candidates);
        }
        else {
            setRidingInfo('', []);
        }
    }
    xhr.send();
}

function hasManualAddress() {
    var address1 = document.getElementById('address1'),
        city = document.getElementById('city'),
        province = document.getElementById('province'),
        country = document.getElementById('country'),
        postalCode = document.getElementById('postal-code');
}

function getAddress() {
    return isFullAddress && document.getElementById('address1').value ? document.getElementById('address1').value + " " + document.getElementById('address2').value : "";
}

function getCity() {
    return isFullAddress && document.getElementById('city').value ? document.getElementById('city').value : "";
}

function getProvince() {
    return isFullAddress && document.getElementById('province').value ? document.getElementById('province').value : "";
}

function getCountry() {
    return isFullAddress && document.getElementById('country').value ? document.getElementById('country').value : "";
}

function submitForm(fields) {

    // get address components
    var address = getAddress();
    var city = getCity();
    var province = getProvince();
    var postalCode = document.getElementById('postal-code').value;
    var latitude = matchedAddress.geometry.location.lat() || "";
    var longitude = matchedAddress.geometry.location.lng() || "";

    var usingMatchedAddress = false;

    for (var i = 0; i < matchedAddress.address_components.length; i++) {
        if (matchedAddress.address_components[i].types[0] == 'street_number' && !address) {
            address += matchedAddress.address_components[i].long_name;
            usingMatchedAddress = true;
        }
        else if (matchedAddress.address_components[i].types[0] == 'route' && usingMatchedAddress)
            address += ' ' + matchedAddress.address_components[i].long_name;
        else if (matchedAddress.address_components[i].types[0] == 'locality' && !city)
            city = matchedAddress.address_components[i].long_name;
        else if (matchedAddress.address_components[i].types[0] == 'administrative_area_level_1' && !province)
            province = matchedAddress.address_components[i].long_name;
        else if (matchedAddress.address_components[i].types[0] == 'country')
            country = matchedAddress.address_components[i].short_name;
        else if (matchedAddress.address_components[i].types[0] == 'postal_code' && !postalCode)
            postalCode = matchedAddress.address_components[i].long_name
    }

    if (isFullAddress && (city == '' || province == '' || postalCode == '')) {
        var errorStr = '<i class="fa fa-exclamation-triangle"></i> ';
        errorStr += language == 'en' ? 'Please enter and select your <em>full</em> address.' : 'SVP indiquez et sélectionnez votre adresse complète';
        setErrorMessage(errorStr);
        return;
    }

    var submitButton = document.getElementsByClassName('btn-submit')[0];

    if (!isTwitter) {
        submitButton.setAttribute('disabled', 'disabled');
        submitButton.innerHTML = language == 'en' ? 'sending...' : 'envoi';
    }

    // did they change the message?
    var customMessage;
    if (isTwitter) {
        customMessage = tweetMessage;
    }
    else if (fields[3]) {
        customMessage = encodeURIComponent(fields[3].innerHTML);
    }

    // contact
    var contactOptIn = document.getElementById('contact').checked ? 'yes' : '';

    // riding
    var ridingId = "";
    if (document.getElementsByClassName('change-riding')[0].style.display == 'block' && ridingsList) {
        ridingId = getRidingIdFromName(document.getElementById('riding').value);
    }

    var addressComponents = "";
    if (isFullAddress)
        addressComponents = '&address=' + address + '&city=' + city + '&province=' + province + '&country=' + country;

    // get cusotm field info
    var filteredFields = [];
    if (customFields && customFields.length > 0) {
        for (var i = 0; i < customFields.length; i++) {
            var field = document.getElementById("contact-custom-fields-container")
                .getElementsByClassName(customFields[i].slug)[0];

            if (customFields[i].isRequired == true || field.value) {
                filteredFields.push({
                    id: customFields[i].id,
                    value: field.value
                });
            }
        }
    }

    // get chosen lists
    var chosenLists = [];
    if (chooseLists.length > 1) {
        var checkBoxes = document.querySelectorAll('div.form-group.choose-lists > div input[type="checkbox"]:checked');
        for (var i = 0; i < checkBoxes.length; i++) {
            chosenLists.push(checkBoxes[i].value);
        }
    }

    // send alert
    var alertXhr = new XMLHttpRequest();
    alertXhr.open('POST', encodeURI('/api/campaigns/' + urlParams.campaign + '/entries/alerts/create'));
    alertXhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    alertXhr.send(encodeURI('name=' + fields[0].value + '&email=' + fields[1].value + '&postalCode=' + postalCode + addressComponents + '&canContact=' + contactOptIn + '&lat=' + latitude + '&long=' + longitude + '&ridingName=' + document.getElementById('riding').value + (customMessage ? '&message=' + customMessage : '') + '&type=' + (isTwitter ? 'twitter' : 'email') + '&fields=' + JSON.stringify(filteredFields)));

    // send request
    var xhr = new XMLHttpRequest();

    xhr.open('POST', encodeURI('/api/campaigns/' + urlParams.campaign + '/entries/create'));
    xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    xhr.onload = function() {

        if (!isTwitter) {
            if (xhr.status === 200) {
                // show success
                document.getElementsByClassName('form')[0].classList.add('hidden');
                document.getElementsByClassName('success')[0].classList.remove('hidden');

                // redirect
                if (successUrl)
                    window.parent.postMessage({successUrl: successUrl}, '*');
            }
            else if (xhr.status !== 200) {
                submitButton.removeAttribute('disabled');
                submitButton.innerHTML = 'Send';
                if (language == 'en')
                    alert('Sorry, there was an error. Please try again later.');
                else
                    alert('S\'il vous plaît essayez plus tard.');
            }
        }
    };

    xhr.send(encodeURI('name=' + fields[0].value + '&email=' + fields[1].value + addressComponents + '&postalCode=' + postalCode + '&canContact=' + contactOptIn + '&lat=' + latitude + '&long=' + longitude + '&ridingId=' + ridingId + (customMessage ? '&message=' + customMessage : '') + '&type=' + (isTwitter ? 'twitter' : 'email') + '&fields=' + JSON.stringify(filteredFields) + '&lists=' + JSON.stringify(chosenLists)));
}

if (isTwitter) {
    var script = document.createElement('script');
    script.src = "http://platform.twitter.com/widgets.js";
    script.onload = function () {
        twttr.events.bind('tweet', function(event) {
           //
        });
    };

    document.head.appendChild(script);
}

function setTwitterURL(tweetTo) {

    if (typeof(tweetTo) != "undefined" && tweetTo)
        tweetTo = tweetTo;
    else
        tweetTo = "";

    document.getElementsByClassName('twitter-button')[0].setAttribute('href', 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(replaceTwitterMergeTags(tweetTo, tweetMessage)) + (tweetVia ? '&via=' + tweetVia : '') + (tweetTo ? '&to=' + tweetTo : ''));
}

function replaceTwitterMergeTags(tweetTo, tweetMessage) {

    return tweetMessage.replace("*|HANDLE|*", tweetTo);

}

function getAllMergeTags(message) {

    var mergeRegex = /(\*\|\S+\|\*)/g;

    var allTags = message.match(mergeRegex);

    var filteredTags = [];

    if (allTags != null)
    {
        for (var i = 0 ; i < allTags.length; i++) {
            if (filteredTags.indexOf(allTags[i]) == -1)
                filteredTags.push(allTags[i]);
        }
    }

    return filteredTags;

}

function addMergeTagPlaceholders(mergeTags, message) {

    for (var i = 0; i < mergeTags.length; i++) {
        var replaceTag = "\\*\\|"+mergeTags[i].cleanTag+"\\|\\*";
        var re = new RegExp(replaceTag, "g");
        message = message.replace(re, '<span class="tag-' + mergeTags[i].cleanTag + '">' + mergeTags[i].tag + '</span>');
    }

    return message;

}

function getCleanMergeTag(tag) {

    return tag.match(/\*\|(\S+)\|\*/)[1];

}

function updateMergeTag(e) {

    // get field
    for (var i = 0; i < mergeTags.length; i++) {
        if (mergeTags[i].ids.indexOf(e.target.id) > -1) {

            var newValue = e.target.value;

            if (newValue === "")
                newValue = mergeTags[i].tag;

            var message = getProperMessageText();
            replaceTag(getProperMessageElement(), mergeTags[i].cleanTag, newValue);
        }
    }

}

function replaceTag(messageEl, cleanTag, value) {

    var foundElements = messageEl.getElementsByClassName('tag-'+cleanTag);

    for (var i = 0; i < foundElements.length; i++) {

        foundElements[i].innerHTML = value;

    }

}

function updateProperMessageText(message) {

    if (document.getElementById('message'))
        document.getElementById('message').innerHTML = message;
    else
        document.getElementById('fixed-message').innerHTML = message;

}

function getProperMessageText() {

    if (document.getElementById('message'))
        return document.getElementById('message').value;
    else
        return document.getElementById('fixed-message').innerHTML;

}

function getProperMessageElement() {
    if (document.getElementById('message'))
        return document.getElementById('message');
    else
        return document.getElementById('fixed-message');
}

function getMergeTagOfCustomField(slug) {
    return slug.toUpperCase().replace(/\-/g, '_');
}

function getPrimaryRepName(lists) {

    return getPrimaryList(lists).repName;

}

function getPrimaryDistrictName(lists) {

    return getPrimaryList(lists).districtName;

}

function getPrimaryList(lists) {

    for (var i = 0; i < lists.length; i++) {
        if (lists[i].isPrimary == true)
            return lists[i];
    }

}

function addRidingCandidatesToList(lists, riding) {

    for (var i = 0; i < lists.length; i++) {

        if (lists[i].id === riding.listId) {

            lists[i].candidates = riding.candidates;

        }

    }

}

/**
 * Awesomeplete
 */
/**
 * Simple, lightweight, usable local autocomplete library for modern browsers
 * Because there weren’t enough autocomplete scripts in the world? Because I’m completely insane and have NIH syndrome? Probably both. :P
 * @author Lea Verou http://leaverou.github.io/awesomplete
 * MIT license
 */

(function () {

var _ = function (input, o) {
    var me = this;

    // Setup

    this.input = $(input);
    this.input.setAttribute("autocomplete", "false");
    this.input.setAttribute("aria-autocomplete", "list");

    o = o || {};

    configure.call(this, {
        minChars: 2,
        maxItems: 10,
        autoFirst: false,
        filter: _.FILTER_CONTAINS,
        sort: _.SORT_BYLENGTH,
        item: function (text, input) {
            return $.create("li", {
                innerHTML: text.replace(RegExp($.regExpEscape(input.trim()), "gi"), "<mark>$&</mark>"),
                "aria-selected": "false"
            });
        },
        replace: function (text) {
            this.input.value = text;
        }
    }, o);

    this.index = -1;

    // Create necessary elements

    this.container = $.create("div", {
        className: "awesomplete",
        around: input
    });

    this.ul = $.create("ul", {
        hidden: "",
        inside: this.container
    });

    this.status = $.create("span", {
        className: "visually-hidden",
        role: "status",
        "aria-live": "assertive",
        "aria-relevant": "additions",
        inside: this.container
    });

    // Bind events

    $.bind(this.input, {
        "input": this.evaluate.bind(this),
        "blur": this.close.bind(this),
        "keydown": function(evt) {
            var c = evt.keyCode;

            // If the dropdown `ul` is in view, then act on keydown for the following keys:
            // Enter / Esc / Up / Down
            if(me.opened) {
                if (c === 13 && me.selected) { // Enter
                    evt.preventDefault();
                    me.select();
                }
                else if (c === 27) { // Esc
                    me.close();
                }
                else if (c === 38 || c === 40) { // Down/Up arrow
                    evt.preventDefault();
                    me[c === 38? "previous" : "next"]();
                }
            }
        }
    });

    $.bind(this.input.form, {"submit": this.close.bind(this)});

    $.bind(this.ul, {"mousedown": function(evt) {
        var li = evt.target;

        if (li !== this) {

            while (li && !/li/i.test(li.nodeName)) {
                li = li.parentNode;
            }

            if (li) {
                me.select(li);
            }
        }
    }});

    if (this.input.hasAttribute("list")) {
        this.list = "#" + input.getAttribute("list");
        input.removeAttribute("list");
    }
    else {
        this.list = this.input.getAttribute("data-list") || o.list || [];
    }

    _.all.push(this);
};

_.prototype = {
    set list(list) {
        if (Array.isArray(list)) {
            this._list = list;
        }
        else if (typeof list === "string" && list.indexOf(",") > -1) {
                this._list = list.split(/\s*,\s*/);
        }
        else { // Element or CSS selector
            list = $(list);

            if (list && list.children) {
                this._list = slice.apply(list.children).map(function (el) {
                    return el.textContent.trim();
                });
            }
        }

        if (document.activeElement === this.input) {
            this.evaluate();
        }
    },

    get selected() {
        return this.index > -1;
    },

    get opened() {
        return this.ul && this.ul.getAttribute("hidden") == null;
    },

    close: function () {
        this.ul.setAttribute("hidden", "");
        this.index = -1;

        $.fire(this.input, "awesomplete-close");
    },

    open: function () {
        this.ul.removeAttribute("hidden");

        if (this.autoFirst && this.index === -1) {
            this.goto(0);
        }

        $.fire(this.input, "awesomplete-open");
    },

    next: function () {
        var count = this.ul.children.length;

        this.goto(this.index < count - 1? this.index + 1 : -1);
    },

    previous: function () {
        var count = this.ul.children.length;

        this.goto(this.selected? this.index - 1 : count - 1);
    },

    // Should not be used, highlights specific item without any checks!
    goto: function (i) {
        var lis = this.ul.children;

        if (this.selected) {
            lis[this.index].setAttribute("aria-selected", "false");
        }

        this.index = i;

        if (i > -1 && lis.length > 0) {
            lis[i].setAttribute("aria-selected", "true");
            this.status.textContent = lis[i].textContent;
        }

        $.fire(this.input, "awesomplete-highlight");
    },

    select: function (selected) {
        selected = selected || this.ul.children[this.index];

        if (selected) {
            var prevented;

            $.fire(this.input, "awesomplete-select", {
                text: selected.textContent,
                preventDefault: function () {
                    prevented = true;
                }
            });

            if (!prevented) {
                this.replace(selected.textContent);
                this.close();
                $.fire(this.input, "awesomplete-selectcomplete");
            }
        }
    },

    evaluate: function() {
        var me = this;
        var value = this.input.value;

        if (value.length >= this.minChars && this._list.length > 0) {
            this.index = -1;
            // Populate list with options that match
            this.ul.innerHTML = "";

            this._list
                .filter(function(item) {
                    return me.filter(item, value);
                })
                .sort(this.sort)
                .every(function(text, i) {
                    me.ul.appendChild(me.item(text, value));

                    return i < me.maxItems - 1;
                });

            if (this.ul.children.length === 0) {
                this.close();
            } else {
                this.open();
            }
        }
        else {
            this.close();
        }
    }
};

// Static methods/properties

_.all = [];

_.FILTER_CONTAINS = function (text, input) {
    return RegExp($.regExpEscape(input.trim()), "i").test(text);
};

_.FILTER_STARTSWITH = function (text, input) {
    return RegExp("^" + $.regExpEscape(input.trim()), "i").test(text);
};

_.SORT_BYLENGTH = function (a, b) {
    if (a.length !== b.length) {
        return a.length - b.length;
    }

    return a < b? -1 : 1;
};

// Private functions

function configure(properties, o) {
    for (var i in properties) {
        var initial = properties[i],
            attrValue = this.input.getAttribute("data-" + i.toLowerCase());

        if (typeof initial === "number") {
            this[i] = parseInt(attrValue);
        }
        else if (initial === false) { // Boolean options must be false by default anyway
            this[i] = attrValue !== null;
        }
        else if (initial instanceof Function) {
            this[i] = null;
        }
        else {
            this[i] = attrValue;
        }

        if (!this[i] && this[i] !== 0) {
            this[i] = (i in o)? o[i] : initial;
        }
    }
}

// Helpers

var slice = Array.prototype.slice;

function $(expr, con) {
    return typeof expr === "string"? (con || document).querySelector(expr) : expr || null;
}

function $$(expr, con) {
    return slice.call((con || document).querySelectorAll(expr));
}

$.create = function(tag, o) {
    var element = document.createElement(tag);

    for (var i in o) {
        var val = o[i];

        if (i === "inside") {
            $(val).appendChild(element);
        }
        else if (i === "around") {
            var ref = $(val);
            ref.parentNode.insertBefore(element, ref);
            element.appendChild(ref);
        }
        else if (i in element) {
            element[i] = val;
        }
        else {
            element.setAttribute(i, val);
        }
    }

    return element;
};

$.bind = function(element, o) {
    if (element) {
        for (var event in o) {
            var callback = o[event];

            event.split(/\s+/).forEach(function (event) {
                element.addEventListener(event, callback);
            });
        }
    }
};

$.fire = function(target, type, properties) {
    var evt = document.createEvent("HTMLEvents");

    evt.initEvent(type, true, true );

    for (var j in properties) {
        evt[j] = properties[j];
    }

    target.dispatchEvent(evt);
};

$.regExpEscape = function (s) {
    return s.replace(/[-\\^$*+?.()|[\]{}]/g, "\\$&");
}

// Initialization

function init() {
    $$("input.awesomplete").forEach(function (input) {
        new _(input);
    });
}

// Are we in a browser? Check for Document constructor
if (typeof Document !== 'undefined') {
    // DOM already loaded?
    if (document.readyState !== "loading") {
        init();
    }
    else {
        // Wait for it
        document.addEventListener("DOMContentLoaded", init);
    }
}

_.$ = $;
_.$$ = $$;

// Make sure to export Awesomplete on self when in a browser
if (typeof self !== 'undefined') {
    self.Awesomplete = _;
}

// Expose Awesomplete as a CJS module
if (typeof exports === 'object') {
    module.exports = _;
}

return _;

}());

// Keen
!function(name,path,ctx){
    var latest,prev=name!=='Keen'&&window.Keen?window.Keen:false;ctx[name]=ctx[name]||{ready:function(fn){var h=document.getElementsByTagName('head')[0],s=document.createElement('script'),w=window,loaded;s.onload=s.onerror=s.onreadystatechange=function(){if((s.readyState&&!(/^c|loade/.test(s.readyState)))||loaded){return}s.onload=s.onreadystatechange=null;loaded=1;latest=w.Keen;if(prev){w.Keen=prev}else{try{delete w.Keen}catch(e){w.Keen=void 0}}ctx[name]=latest;ctx[name].ready(fn)};s.async=1;s.src=path;h.parentNode.insertBefore(s,h)}}
}('KeenAsync','https://d26b395fwzu5fz.cloudfront.net/keen-tracking-1.2.1.min.js',this);

KeenAsync.ready(function(){
    // Configure a client instance
    // This is your actual Project ID and Write Key
    var client = new KeenAsync({
        projectId: '59e93172c9e77c0001573b07',
        writeKey: '2AFDBED42D8FF5BD587E06A39EF0B27ACDB1F5D681553F38E640839BF85F72F5D35301F9BEC121A1073D6B3417387C4C5C899F45A22205DAC27403A2F381325B8601C33BC087A466424D56F6B25E15485160B387E1A3FD99AF1B67AC1EAEF140'
    });

    // Record an event
    client.recordEvent('widgetview', {
        campaign: urlParams.campaign
    });
});
