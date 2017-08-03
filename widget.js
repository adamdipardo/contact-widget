var containers = document.getElementsByClassName("contact-campaign");

for (var i = 0; i < containers.length; i++) {
	var container = containers[i];
	var iframe = document.createElement("iframe");
	iframe.id = container.attributes['data-campaign'].value+(typeof(container.attributes['data-twitter'])!='undefined'&&container.attributes['data-twitter'].value=='true'?'-twitter':'');
	var iframe_src = document.createAttribute("src");
	iframe_src.value = HOST_URL + APP_URL +"/app.html?campaign=" + encodeURIComponent(container.attributes['data-campaign'].value) + "&loadingColor=" + encodeURIComponent(container.attributes['data-secondary-color'].value) + '&pageUrl=' + encodeURIComponent(window.location) + (typeof(container.attributes['data-twitter']) != "undefined" && container.attributes['data-twitter'].value == 'true' ? '&twitter=true' : '');
	var iframe_style = document.createAttribute("style");
	iframe_style.value = "border-width: 0; width: 100%; max-width: 500px; margin: 0 auto; background-color: #"+container.attributes['data-background-color'].value;
	iframe.setAttributeNode(iframe_src);
	iframe.setAttributeNode(iframe_style);
	container.appendChild(iframe);
}

window.addEventListener("message", function(e){
	if (e.origin == HOST_URL) {
		var iframe = document.getElementById(e.data.campaign+(e.data.isTwitter?"-twitter":""));
		if (typeof(e.data.height) != "undefined")
			iframe.style.height = e.data.height + 'px';
		else if (typeof(e.data.successUrl) != "undefined")
			window.location.assign(e.data.successUrl);
	}
}, false);