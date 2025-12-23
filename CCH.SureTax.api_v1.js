/**
 * A compilation of methods used to call API methods of the SureTax service.
 * 
 * @namespace CCH_SureTax_api_v1
 * @version 1.0.20180705
 * @copyright CCH Incorporated 2018&copy;
 */
function SureTaxApiModule() {
	/**
	 * Calls the PostRequest SureTax API method.
	 * 
	 * @function postRequest
	 * @memberof! CCH_SureTax_api_v1
	 * @param {String} url Url to the SureTax API.
	 * @param {Object} request JSON string containing the request data.
	 * @returns {Object} Returns the response from the SureTax API.
	 */
	function postRequest(url, request) {
		return callSureTax(url, request, 'PostRequest', 'request');
	}

	/**
	 * Calls the FinalizePostRequest SureTax API method.
	 * 
	 * @function postRequest
	 * @memberof! CCH_SureTax_api_v1
	 * @param {String} url Url to the SureTax API.
	 * @param {Object} request JSON string containing the request data.
	 * @returns {Object} Returns the response from the SureTax API.
	 */
	function finalizePostRequest(url, request) {
		return callSureTax(url, request, 'FinalizePostRequest', '');
	}

	/**
	 * Calls the CancelPostRequest SureTax API method.
	 * 
	 * @function postRequest
	 * @memberof! CCH_SureTax_api_v1
	 * @param {String} url Url to the SureTax API.
	 * @param {Object} request JSON string containing the request data.
	 * @returns {Object} Returns the response from the SureTax API.
	 */
	function cancelPostRequest(url, request) {
		return callSureTax(url, request, 'CancelPostRequest', 'requestCancel');
	}

	/**
	 * Calls the PostRequestBatch SureTax API method.
	 * 
	 * @function postRequest
	 * @memberof! CCH_SureTax_api_v1
	 * @param {String} url Url to the SureTax API.
	 * @param {Object} request JSON string containing the request data.
	 * @returns {Object} Returns the response from the SureTax API.
	 */
	function postRequestBatch(url, request) {
		return callSureTax(url, request, 'PostRequestBatch', '');
	}

	/**
	 * Makes a call to the SureTax API.
	 * 
	 * @function postRequest
	 * @memberof! CCH_SureTax_api_v1
	 * @param {String} url URL of the SureTax API.
	 * @param {Object} request JSON string containing the request data.
	 * @param {String} method Method of the API to call.
	 * @param {String} qsname Query string name
	 * @returns {Object} Returns the response from the SureTax API.
	 */
	function callSureTax(url, request, method, qsname) {
		if (url.indexOf('https') == -1) {
			// URL needs to be https, so throw an error.
			nlapiLogExeuction('ERROR', 'Security', 'URL needs to be https');
			throw "Insecure URL";
		}

		const objRequest = JSON.parse(request);
		var arr = objRequest.ClientTracking.split(";");
		var ERPName = '';
		var ERPVersion = '';
		var IntegrationVersion = '';
		if (arr.length > 0)
		{
		  ERPName = arr[1] + ' ' + arr[7];
		  ERPVersion = arr[2];
		  IntegrationVersion = arr[3];
		}
		var httpResponse = null;
		var httpHeader = {
			"Content-Type": "application/x-www-form-urlencoded",
			"X-WK-ERP-Name" : ERPName,
			"X-WK-ERP-Version" : ERPVersion,
			"X-WK-Integration-Version" : IntegrationVersion
		};
		nlapiLogExecution('ERROR', 'httpHeader ', JSON.stringify(httpHeader));

		try {
			httpResponse = nlapiRequestURL(url + '/' + method,
				qsname + '=' + encodeURIComponent(request), httpHeader,
				'POST');
		} catch (ex) {
			nlapiLogExecution('ERROR', 'SureTax ' + method + ' Failed', ex.getDetails());
			return null;
		}

		if (httpResponse != null && httpResponse.getCode() != 200 || (httpResponse.getCode() == 200 && httpResponse.getBody() == '')) {
			nlapiLogExecution('ERROR', 'SureTax ' + method + ' Failed', httpResponse.getBody());
			return null;
		} else {
			var jsonString = ParseXMLforJSON(httpResponse.getBody());
			return JSON.parse(jsonString);
		}
	}

	/**
	 * Makes rest call to SureTax API
	 * 
	 * @function postRequest
	 * @memberof! CCH_SureTax_api_v1
	 * @param {String} url URL of the SureTax REST API.
	 * @param {String} resource REST API resource.
	 * @param {Object} options Options to be used for the REST API call.
	 * @returns {Object} Returns the response from the SureTax API.
	 */
	function callSureTaxRestAPI(url, resource, options) {
		if (url.indexOf('https') == -1) {
			// URL needs to be https, so throw an error.
			nlapiLogExeuction('ERROR', 'Security', 'URL needs to be https');
			throw "Insecure URL";
		}

		var httpResponse = null;

		try {
			httpResponse = nlapiRequestURL(url + '/' + resource, null, options, 'GET');
		} catch (ex) {
			nlapiLogExecution('ERROR', 'SureTax ' + resource + ' Failed', ex.getDetails());
			return null;
		}

		if (httpResponse != null && httpResponse.code != 200) {
			nlapiLogExecution('ERROR', 'SureTax ' + resource + ' Failed', httpResponse.getBody());
			return null;
		} else {
			return JSON.parse(httpResponse.body);
		}
	}

	/**
	 * Parses the data from the given XML data.
	 * 
	 * @function postRequest
	 * @memberof! CCH_SureTax_api_v1
	 * @param {String} xmlData XML string to be parsed
	 * @returns {String} Returns the data inside the XML 'string' element.
	 */
	function ParseXMLforJSON(xmlData) {
		var xmlResponse = nlapiStringToXML(xmlData);

		return nlapiSelectValue(xmlResponse, "/*[name()='string']");
	}

	return {
		postRequest: postRequest,
		finalizePostRequest: finalizePostRequest,
		cancelPostRequest: cancelPostRequest,
		callSureTaxRestAPI: callSureTaxRestAPI,
		postRequestBatch: postRequestBatch
	};
}
