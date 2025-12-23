/**
 * A compilation of methods used throughout the CCH SureTax for SuiteTax plug-in.
 * 
 * @namespace CCH_SureTax_common_v1
 * @version 1.0.20180705
 * @copyright CCH Incorporated 2018&copy;
 */
function SureTaxCommonModule() {
	var taxCatMap = new SureTaxMap();
	var basicConfigRecord = null;

	/**
	 * Gets the SureTax configuration record, and returns it.
	 *
	 * @function LoadConfiguration
	 * @memberof! CCH_SureTax_common_v1
	 * @param {Integer} subvalue Subsidiary id
	 * @returns {Object} Returns the SureTax configuration record for the given subsidiary id.
	 */
	function LoadConfiguration(subvalue) {
		//sending subsidiary value to get the configuration record for the selected subsidiary
		var basicRecId = GetBasicConfigurationId(subvalue);
		if (basicRecId == null) {
			return null;
		} else {
			if (basicConfigRecord === null || basicConfigRecord.getFieldValue(basicConfigurationKeys.Subsidiary) != subvalue) {
				basicConfigRecord = nlapiLoadRecord(basicConfigurationKeys.recordId, basicRecId);
			}

			var splitZip = ParseZipCode(basicConfigRecord.getFieldValue(basicConfigurationKeys.zip));

			var cfg = {
				"Subsidiary": basicConfigRecord.getFieldValue(basicConfigurationKeys.Subsidiary),
				"Enable": basicConfigRecord.getFieldValue(basicConfigurationKeys.Enable),
				"connection_settings": {
					"url": basicConfigRecord.getFieldValue(basicConfigurationKeys.url),
					"client_id": basicConfigRecord.getFieldValue(basicConfigurationKeys.clientnumber),
					"validation_key": basicConfigRecord.getFieldValue(basicConfigurationKeys.validationkey)
				},
				"di_connection_settings": {
					"url": basicConfigRecord.getFieldValue(basicConfigurationKeys.diurl),
					"client_id": basicConfigRecord.getFieldValue(basicConfigurationKeys.diclientnumber),
					"validation_key": basicConfigRecord.getFieldValue(basicConfigurationKeys.divalidationkey)
				},
				"default_ship_from_address": CreateAddress(
					basicConfigRecord.getFieldValue(basicConfigurationKeys.addressline1),
					basicConfigRecord.getFieldValue(basicConfigurationKeys.addressline2),
					basicConfigRecord.getFieldValue(basicConfigurationKeys.city),
					basicConfigRecord.getFieldValue(basicConfigurationKeys.state),
					splitZip[0],
					splitZip[1],
					basicConfigRecord.getFieldValue(basicConfigurationKeys.country)),
				"default_ecom_values": {
					"groupliketaxes": basicConfigRecord.getFieldValue(basicConfigurationKeys.groupliketaxes),
					"enable": basicConfigRecord.getFieldValue(basicConfigurationKeys.ecomenable),
					"salestype": basicConfigRecord.getFieldValue(basicConfigurationKeys.ecomsalestype),
					"regtype": basicConfigRecord.getFieldValue(basicConfigurationKeys.ecomregtype),
					"taxexempt": basicConfigRecord.getFieldValue(basicConfigurationKeys.ecomtaxexempt),
					"unittype": basicConfigRecord.getFieldValue(basicConfigurationKeys.ecomunittype),
					"taxincl": basicConfigRecord.getFieldValue(basicConfigurationKeys.ecomtaxincl),
					"taxsitus": basicConfigRecord.getFieldValue(basicConfigurationKeys.ecomtaxsitus),
					"transtype": basicConfigRecord.getFieldValue(basicConfigurationKeys.ecomtranstype),
					"taxcode": basicConfigRecord.getFieldValue(basicConfigurationKeys.ecomtaxcode),
					"exemptreason": basicConfigRecord.getFieldValue(basicConfigurationKeys.ecomtaxreason)
				},
				"sh_default_values": {
					"enable": basicConfigRecord.getFieldValue(basicConfigurationKeys.shenable),
					"salestype": basicConfigRecord.getFieldValue(basicConfigurationKeys.shsalestype),
					"regtype": basicConfigRecord.getFieldValue(basicConfigurationKeys.shregtype),
					"taxexempt": basicConfigRecord.getFieldValue(basicConfigurationKeys.shtaxexempt),
					"unittype": basicConfigRecord.getFieldValue(basicConfigurationKeys.shunittype),
					"taxincl": basicConfigRecord.getFieldValue(basicConfigurationKeys.shtaxincl),
					"taxsitus": basicConfigRecord.getFieldValue(basicConfigurationKeys.shtaxsitus),
					"shiptranstype": basicConfigRecord.getFieldValue(basicConfigurationKeys.shiptrancode),
					"handtranstype": basicConfigRecord.getFieldValue(basicConfigurationKeys.handtrancode),
					"exemptreason": basicConfigRecord.getFieldValue(basicConfigurationKeys.shexptreason)
				},
				"settings": {
					"sendsku": basicConfigRecord.getFieldValue(basicConfigurationKeys.sendsku),
					"multicurrency": basicConfigRecord.getFieldValue(basicConfigurationKeys.multicurrency)
				},
				"industry": {
					"General": basicConfigRecord.getFieldValue(basicConfigurationKeys.General),
					"Telecom": basicConfigRecord.getFieldValue(basicConfigurationKeys.Telecom),
					"Utility": basicConfigRecord.getFieldValue(basicConfigurationKeys.Utility)
				},
				"id": basicRecId
			};

			return cfg;
		}
	}

	/**
	 * Gets the AV configuration record.
	 *
	 * @function LoadAVConfiguration
	 * @memberof! CCH_SureTax_common_v1
	 * @returns {Object} Returns an object with the values of the address validation configuration record.
	 */
	function LoadAVConfiguration() {
		var avConfigRecId = GetAVConfigurationId();
		var avConfigRecord = nlapiLoadRecord(avConfigKeys.recordId, avConfigRecId);

		return {
			"connection_settings": {
				"url": avConfigRecord.getFieldValue(avConfigKeys.url),
				"clientNumber": avConfigRecord.getFieldValue(avConfigKeys.clientNumber),
				"validationKey": avConfigRecord.getFieldValue(avConfigKeys.validationKey)
			},
			"settings": {
				"minScore": avConfigRecord.getFieldValue(avConfigKeys.minScore)
			}
		};
	}

	/**
	 * Gets the internal id of the basic configuration record.
	 *
	 * @function GetBasicConfigurationId
	 * @memberof! CCH_SureTax_common_v1
	 * @param {Integer} subval Subsidiary id
	 * @returns {Integer} Returns the internal id of the basic configuration record for the given subsidiary.
	 */
	function GetBasicConfigurationId(subval) {
		var filterExp = '';
		columns = [];
		columns[0] = new nlobjSearchColumn('internalid');
		if (subval == '' || subval == null || subval == undefined) {
			configSearch = nlapiCreateSearch('customrecord_suretax_crt_bsccfg_01', null, columns);
		} else {
			//if subsidiary value is selected get the configuration record for the selected subsidiary
			filterExp = [
				['custrecord_suretax_cfg_subsidiary', 'is', subval]
			];

			configSearch = nlapiCreateSearch('customrecord_suretax_crt_bsccfg_01', filterExp, columns);
		}

		searchResult = configSearch.runSearch().getResults(0, 1);

		return (searchResult != null) ? ((searchResult.length > 0) ? searchResult[0].getValue('internalid') : null) : null;
	}

	/**
	 * Gets the internal id of the av configuration record.
	 * 
	 * @function GetAVConfigurationId
	 * @memberof! CCH_SureTax_common_v1
	 * @returns {Integer} Returns the internal id of the address validation configuration record.
	 */
	function GetAVConfigurationId() {
		var columns = [];
		columns[0] = new nlobjSearchColumn('internalid');

		var configSearch = nlapiCreateSearch(avConfigKeys.recordId, null, columns);
		var searchResult = configSearch.runSearch().getResults(0, 1);

		return (searchResult.length > 0) ? searchResult[0].getValue('internalid') : null;
	}

	/**
	 * Gets the transaction type (suitescript record id) of the created from type.
	 * 
	 * @function GetTransactionTypeFromReturn
	 * @memberof! CCH_SureTax_common_v1
	 * @param {String} createdFromType Type string that the record was created from. Ex. Invoice #1300.
	 * @returns {String} Returns the NetSuite record script id of the created from type
	 */
	function GetTransactionTypeFromReturn(createdFromType) {
		var createdFromRecType = '';

		// Return was created from another transaction type. Determine what the type is.
		var splitArray = createdFromType.split(' #');

		if (splitArray.length > 0) {
			switch (splitArray[0]) {
				case "Invoice":
					createdFromRecType = 'invoice';
					break;
				case "Cash Sales":
					createdFromRecType = 'cashsale';
					break;
				case "Return Authorization":
					createdFromRecType = 'returnauthorization';
					break;
				case "Sales Order":
					createdFromRecType = 'salesorder';
					break;
				case "Order":
					createdFromRecType = 'salesorder';
					break;
			}
		}

		return createdFromRecType;
	}

	/**
	 * Determines if the given item type is a valid item type to send to SureTax. Returns true if it is a valid type, false if it isn't.
	 * 
	 * @function ValidItemType
	 * @memberof! CCH_SureTax_common_v1
	 * @param {String} itemType Type of the item
	 * @returns {Boolean} Returns true if the item is a valid type, or false if it isn't.
	 */
	function ValidItemType(itemType) {
		return (itemType != 'Description' && itemType != 'Subtotal');
	}

	/**
	 * Adds zeroes to the front of the number parameter until it is the given length.
	 * 
	 * @function PadZeroes
	 * @memberof! CCH_SureTax_common_v1
	 * @param {Number} number Number to pad zeroes onto
	 * @param {Integer} length Length to pad zeroes out to
	 * @returns {Number} Returns number passed in padded with zeroes, up to the given length.
	 */
	function PadZeroes(number, length) {
		var str = '' + number;
		while (str.length < length) {
			str = '0' + str;
		}

		return str;
	}

	/**
	 * Removes the first occurrence of the character parameter from the value parameter. Then return the result.
	 * 
	 * @function RemoveCharacters
	 * @memberof! CCH_SureTax_common_v1
	 * @param {String} value Value to remove characters from.
	 * @param {String} character Character to remove
	 * @returns {String} Returns given string with the character stripped out
	 */
	function RemoveCharacters(value, character) {
		var ret = value;
		var indexOfChar = value.indexOf(character);

		if (indexOfChar != -1) {
			ret = value.substr(0, indexOfChar) + value.substr(indexOfChar + 1, value.length);
		}

		return ret;
	}

	/**
	 * Searches the list of addresses for a specific address.
	 * 
	 * @function GetAddress
	 * @memberof! CCH_SureTax_common_v1
	 * @param {Array} addresses List of addresses to search.
	 * @param {Object} addrToGet Address to retrieve from the list.
	 * @returns {Object} Retunrs address from list that matches the desired address.
	 */
	function GetAddress(addresses, addrToGet) {
		for (var i = 0; i < addresses.length; i++) {
			var addr = addresses[i];
			var indexOfAddr1 = addrToGet.indexOf(addr.PrimaryAddressLine);
			var indexOfAddr2 = addrToGet.indexOf(addr.PostalCode);

			// Shipping address to get could have removed a double space, check for that.
			if (indexOfAddr1 == -1) {
				indexOfAddr1 = addrToGet.indexOf(replaceDoubleSpace(addr.PrimaryAddressLine));
			}

			if (indexOfAddr1 != -1 && indexOfAddr2 != -1) {
				return addr;
			}
		}

		return null;
	}

	/**
	 * Replaces a double space with a single space.
	 * 
	 * @function replaceDoubleSpace
	 * @memberof! CCH_SureTax_common_v1
	 * @param {String} value String to have the double space replaced.
	 * @returns {String} Returns givent string with the double spaces replaced with a single space.
	 */
	function replaceDoubleSpace(value) {
		return value.replace('  ', ' ');
	}

	/**
	 * Gets the discount percentage from the given rate string. Rate string
	 * will be in the format 10%. Function should return .1 for 10%, and so
	 * on.
	 * 
	 * @function GetDiscountRate
	 * @memberof! CCH_SureTax_common_v1
	 * @param {String} rateString Discount rate as a string
	 * @returns {Decimal} Returns 0 if the string is in the incorrect format, or if it is in the correct format, the discount rate as a decimal.
	 */
	function GetDiscountRate(rateString) {
		var indexOfPer = rateString.indexOf('%');
		var rate = 0;

		if (indexOfPer != -1) {
			rate = parseFloat(rateString) / 100;
		}

		return rate;
	}

	/**
	 * Return an address object for the given parameters
	 * 
	 * @function CreateAddress
	 * @memberof! CCH_SureTax_common_v1
	 * @param {String} addr1 Address Line 1
	 * @param {String} addr2 Address Line 2
	 * @param {String} city City
	 * @param {String} state State
	 * @param {String} zip Postal Code
	 * @param {String} plus4 Plus4
	 * @param {String} country Country
	 * @returns {Object} Returns an address object containing the values passed in.
	 */
	function CreateAddress(addr1, addr2, city, state, zip, plus4, country) {
		return {
			PrimaryAddressLine: addr1,
			SecondaryAddressLine: (addr2 != null) ? addr2 : "",
			County: "",
			City: city,
			State: state,
			PostalCode: zip,
			Plus4: plus4,
			Country: country,
			Geocode: ""
		};
	}

	/**
	 * Rounds the number to the desired number of decimal places.
	 * 
	 * @function RoundNumber
	 * @memberof! CCH_SureTax_common_v1
	 * @param {Decimal} num Number to be rounded.
	 * @param {Integer} dec Number of decimal places to round to.
	 * @returns {Decimal} Returns the given number rounded to the desired number of decimal places.
	 */
	function RoundNumber(num, dec) {
		var result = 0.0;
		var absNum = Math.abs(num);

		result = Math.round(absNum * Math.pow(10, dec)) / Math.pow(10, dec);

		if (num < 0) {
			result = result * -1;
		}

		return result;
	}

	/**
	 * Converts a decimal to a percentage string.
	 * 
	 * @function ToPercentage
	 * @memberof! CCH_SureTax_common_v1
	 * @param {Decimal} decimal Number to convert
	 * @returns {String} Returns the given decimal as a percentage string.
	 */
	function ToPercentage(decimal) {
		return (decimal * 100.00).toString() + '%';
	}

	/**
	 * Determines if shipping and handling are defined separately.
	 * 
	 * @function IsShippingHandlingSeparate
	 * @memberof! CCH_SureTax_common_v1
	 * @param {Object} localRecord Record to look in
	 * @returns {Boolean} Returns true if shipping and handling are defined separately, and false if they aren't.
	 */
	function IsShippingHandlingSeparate(localRecord) {
		return (localRecord != null) ? localRecord.getField('handlingcost') != null : false;
	}

	/**
	 * Determines if the string is empty or not.
	 * 
	 * @function IsEmpty
	 * @memberof! CCH_SureTax_common_v1
	 * @param {String} sValue String to determine if empty
	 * @returns {Boolean} Returns true if the string is empty, false if it isn't.
	 */
	function IsEmpty(sValue) {
		if (sValue == null) {
			return true;
		}

		if (sValue.length <= 0) {
			return true;
		} else {
			return false;
		}
	}

	/**
	 * Determines if the given type is a return transaction.
	 * 
	 * @function IsReturnTransaction
	 * @memberof! CCH_SureTax_common_v1
	 * @param {String} type Type of transaction
	 * @returns {Boolean} Returns true if the transaction type is a return transaction, false otherwise.
	 */
	function IsReturnTransaction(type) {
		return (type == 'creditmemo' || type == 'cashrefund' ||
			type == 'returnauthorization' || type == 'vendorcredit' || type == 'vendorreturnauthorization');
	}

	/**
	 * Determines if the given type is a posting transaction.
	 * 
	 * @function PostingTransaction
	 * @memberof! CCH_SureTax_common_v1
	 * @param {String} type Type of the transaction
	 * @returns {Boolean} Returns true if the transaction type is a posting transaction, false otherwise.
	 */
	function PostingTransaction(type) {
		return (type == 'invoice' || type == 'cashsale' || type == 'cashrefund' || type == 'creditmemo');
	}

	/**
	 * Determines if the record is a AP transaction.
	 * 
	 * @function IsPurchaseTransaction
	 * @memberof! CCH_SureTax_common_v1
	 * @param {String} type Type of the transaction
	 * @returns {Boolean} Returns true if the record is an AP transaction, false if it isn't.
	 */
	function IsPurchaseTransaction(type) {
		return (type == 'vendorbill' || type == 'vendorcredit' ||
			type == 'vendorreturnauthorization' ||
			type == 'purchaseorder' || type == 'purchaserequisition');
	}

	/**
	 * Determines if the record is of type Time.
	 * 
	 * @function IsTime
	 * @memberof! CCH_SureTax_common_v1
	 * @param {String} type Type of the transaction
	 * @returns {Boolean} Returns true if the record is of type Time, false if it isn't.
	 */
	function IsTime(type) {
		return (type == 'timebill');
	}

	/**
	 * Returns a string from a Date object in the form yyyy-mm-ddT00:00:00
	 * note time of 0, since this is for document dates and time of day is
	 * not relevant
	 * 
	 * @function GetDateStr
	 * @memberof! CCH_SureTax_common_v1
	 * @param {Date} date Date string to convert.
	 * @returns {String} Returns date converted to UTC format for use with the SureTax web service.
	 */
	function GetDateStr(date) {
		var year = date.getFullYear();
		var month = date.getMonth() + 1;
		var day = date.getDate();

		// Change 9 to 09, etc. for month and day.
		if (month < 10) {
			month = "0" + month;
		}

		if (day < 10) {
			day = "0" + day;
		}

		return year + '-' + month + '-' + day;
	}

	/**
	 * Returns a string from a Date object in the form yyyy-mm-ddT00:00:00 note
	 * time of 0, since this is for document dates and time of day is not
	 * relevant
	 * 
	 * @function GetDateStrNS
	 * @memberof! CCH_SureTax_common_v1
	 * @param {Date} date Date string to convert.
	 * @returns {String} Date converted to UTC format for use with the SureTax web service.
	 */
	function GetDateStrNS(date) {
		var year = (date instanceof Date) ? date.getFullYear() : date.getYear();
		var month = (date instanceof Date) ? date.getMonth() + 1 : date.getMonth();
		var day = (date instanceof Date) ? date.getDate() : date.getDay();

		// Change 9 to 09, etc. for month and day.
		if (month < 10) {
			month = "0" + month;
		}

		if (day < 10) {
			day = "0" + day;
		}

		return year + '-' + month + '-' + day;
	}

	/**
	 * Searches thorugh a list for the given record id
	 * 
	 * @function SearchForRecordId
	 * @memberof! CCH_SureTax_common_v1
	 * @param {Array} _recordList List to search through
	 * @param {Integer} _recordId Record id to search for
	 * @returns {Object} Retunrs the record with the given record id, null if it can't be found.
	 */
	function SearchForRecordId(_recordList, _recordId) {
		var _assoc;
		for (var i = 0; i < _recordList.length; i++) {
			_assoc = _recordList[i];

			if (_assoc.RecordId == _recordId) {
				return _assoc.Record;
			}
		}

		return null;
	}

	/**
	 * Gets an object containing the mapping between items and the tax type.
	 * 
	 * @function GetTaxItemMapping
	 * @memberof! CCH_SureTax_common_v1
	 * @returns {Object} An object that contains mappings between NS items and SureTax tax types.
	 */
	function GetTaxItemMapping() {
		var mapping = {
			Federal: 0,
			State: 0,
			County: 0,
			City: 0,
			Local: 0
		};

		var columns = [];
		columns[0] = new nlobjSearchColumn('name');
		columns[1] = new nlobjSearchColumn('custrecord_suretax_taxitem_mapping_value');

		var searchObj = nlapiCreateSearch('customrecord_suretax_taxitem_mapping', null, columns);

		searchObj.runSearch().forEachResult(
			function (result) {
				var nameField = result.getValue('name');
				var valueField = result.getValue('custrecord_suretax_taxitem_mapping_value');

				switch (nameField) {
					case itemNames.State:
						mapping.State = valueField;
						break;
					case itemNames.Federal:
						mapping.Federal = valueField;
						break;
					case itemNames.County:
						mapping.County = valueField;
						break;
					case itemNames.City:
						mapping.City = valueField;
						break;
					case itemNames.Local:
						mapping.Local = valueField;
						break;
				}

				return true;
			}
		);

		return mapping;
	}

	/**
	 * Gets the transaciton type from the record id.
	 * 
	 * @function GetTransactionTypeFromRecId
	 * @memberof! CCH_SureTax_common_v1
	 * @param {Integer} recId Record Id to get the type for.
	 * @returns {String} Returns the record type of the record id if it is a transaction, otherwise returns empty string.
	 */
	function GetTransactionTypeFromRecId(recId) {
		var recType = '';

		if (!IsEmpty(recId)) {
			var columns = [];
			columns[0] = new nlobjSearchColumn('type');

			var filterExp = [
				['internalid', 'is', recId]
			];

			var searchObj = nlapiCreateSearch('transaction', filterExp, columns);
			var searchResult = searchObj.runSearch().getResults(0, 1);

			if (searchResult.length > 0) {
				recType = searchResult[0].getRecordType();
			}
		}

		return recType;
	}

	/**
	 * Creates a new SureTax call log record based off of the values passed in.
	 * 
	 * @function NewSureTaxCallLog
	 * @memberof! CCH_SureTax_common_v1
	 * @param {Object} callLog Values to set in the call log.
	 * @returns {Integer} Returns the internal Id of the newly created record.
	 */
	function NewSureTaxCallLog(callLog) {
		if (callLog != null) {
			var callLogRec = nlapiCreateRecord('customrecord_suretax_calllog');

			// Clear out the validation key on the request.
			callLog.Request = RemoveValidationKey(callLog.Request);
			callLog.Response = AddTaxCatCode(callLog.Response);

			// Set the values of the record.
			callLogRec.setFieldValue('custrecord_suretax_calllog_method', TransformMethodCallToList(callLog.Method));
			callLogRec.setFieldValue('custrecord_suretax_calllog_headermsg', callLog.HeaderMessage);
			callLogRec.setFieldValue('custrecord_suretax_calllog_errormsg', callLog.ErrorMessage);
			callLogRec.setFieldValue('custrecord_suretax_calllog_itemmsg', callLog.ItemMessage);
			callLogRec.setFieldValue('custrecord_suretax_calllog_respcode', callLog.ResponseCode);
			callLogRec.setFieldValue('custrecord_suretax_calllog_successful', (callLog.Successful) ? 'T' : 'F');
			callLogRec.setFieldValue('custrecord_suretax_calllog_status', TransformResponseCodeToStatusList(callLog.ResponseCode));
			callLogRec.setFieldValue('custrecord_suretax_calllog_transid', callLog.TransactionId);

			if (callLog.Request != undefined && callLog.Request.length > 1000000) {
				callLog.Request = callLog.Request.substr(0, 1000000);
			}

			callLogRec.setFieldValue('custrecord_suretax_calllog_request', callLog.Request);

			if (callLog.Response != undefined && callLog.Response.length > 1000000) {
				callLog.Response = callLog.Response.substr(0, 1000000);
			}

			callLogRec.setFieldValue('custrecord_suretax_calllog_response', callLog.Response);
			callLogRec.setFieldValue('custrecord_suretax_calllog_nstrans', callLog.NSTransaction);
			
			return nlapiSubmitRecord(callLogRec);
		}
	}

	/**
	 * Creates a new SureTax call log record based off of the values passed in.
	 * 
	 * @function NewSureTaxCallLog
	 * @memberof! CCH_SureTax_common_v1
	 * @param {Object} callLog Values to set in the call log.
	 * @returns {Integer} Returns the internal Id of the newly created record.
	 */
	function NewSureTaxMapErrLog(callLog) {
		if (callLog != null) {
			var callLogRec = nlapiCreateRecord('customrecord_suretax_mappingerror');

			// Clear out the validation key on the request.
			callLog.Request = RemoveValidationKey(callLog.Request);
			callLog.Response = AddTaxCatCode(callLog.Response);

			// Set the values of the record.
			callLogRec.setFieldValue('custrecord_suretax_maperr_method', TransformMethodCallToList(callLog.Method));
			callLogRec.setFieldValue('custrecord_suretax_maperr_headermsg', callLog.HeaderMessage);
			callLogRec.setFieldValue('custrecord_suretax_maperr_errormsg', callLog.ErrorMessage);
			callLogRec.setFieldValue('custrecord_suretax_maperr_itemmsg', callLog.ItemMessage);
			callLogRec.setFieldValue('custrecord_suretax_maperr_respcode', callLog.ResponseCode);
			callLogRec.setFieldValue('custrecord_suretax_maperr_successful', (callLog.Successful) ? 'T' : 'F');
			callLogRec.setFieldValue('custrecord_suretax_maperr_status', TransformResponseCodeToStatusList(callLog.ResponseCode));
			callLogRec.setFieldValue('custrecord_suretax_maperr_transid', callLog.TransactionId);

			if (callLog.Request != undefined && callLog.Request.length > 1000000) {
				callLog.Request = callLog.Request.substr(0, 1000000);
			}

			callLogRec.setFieldValue('custrecord_suretax_maperr_request', callLog.Request);

			if (callLog.Response != undefined && callLog.Response.length > 1000000) {
				callLog.Response = callLog.Response.substr(0, 1000000);
			}

			callLogRec.setFieldValue('custrecord_suretax_maperr_response', callLog.Response);
			callLogRec.setFieldValue('custrecord_suretax_maperr_nstrans', callLog.NSTransaction);
			
			return nlapiSubmitRecord(callLogRec);
		}
	}

	/**
	 * Removes the validation key from the request object
	 * 
	 * @function RemoveValidationKey
	 * @memberof! CCH_SureTax_common_v1
	 * @param {Object} request Request that might contain the validation key
	 * @returns {String} Returns the given object as a string, with the validation key removed.
	 */
	function RemoveValidationKey(request) {
		if (!IsEmpty(request)) {
			var jsonObject = JSON.parse(request);
			jsonObject.ValidationKey = '';

			return JSON.stringify(jsonObject);
		}
	}

	/**
	 * Adds the tax type codes to the lines.
	 * 
	 * @function AddTaxCatCode
	 * @memberof! CCH_SureTax_common_v1
	 * @param {Object} request Request containing lines to add the tax type codes to.
	 * @returns {String} Returns the given request object with tax object values updated, in string format.
	 */
	function AddTaxCatCode(request) {
		if (!IsEmpty(request)) {
			var jsonObject = JSON.parse(request);

			if (jsonObject.GroupList != null) {
				for (var i = 0; i < jsonObject.GroupList.length; i++) {
					for (var j = 0; j < jsonObject.GroupList[i].TaxList.length; j++) {
						// Get the last two characters of the string.
						var curTaxTypeCode = jsonObject.GroupList[i].TaxList[j].TaxTypeCode;
						var taxTypeCode = (curTaxTypeCode.length > 2) ? curTaxTypeCode.substring(1, 3) : curTaxTypeCode;
						var taxCatCode = (curTaxTypeCode.length > 4) ? curTaxTypeCode.substring(3, 5) : "";

						// Get the description from the record.
						var taxCatDesc = GetTaxCategoryDesc(taxCatCode);

						jsonObject.GroupList[i].TaxList[j].TaxCatCode = taxCatCode;
						jsonObject.GroupList[i].TaxList[j].TaxCatDesc = taxCatDesc;
						jsonObject.GroupList[i].TaxList[j].TaxTypeCode = taxTypeCode;
					}
				}
			}

			return JSON.stringify(jsonObject);
		}
	}

	/**
	 * Updates the latest SureTax call log record, with the new record id.
	 * 
	 * @function UpdateCallLogWithInternalId
	 * @memberof! CCH_SureTax_common_v1
	 * @param {Integer} callLogId Internal id of the call log record to update
	 * @param {String} transId SureTax transaction id to update call log record with
	 * @param {String} recType Type of record associated with the call log
	 */
	function UpdateCallLogWithInternalId(callLogId, transId, recType) {
		if (callLogId > 0) {
			var fieldName = (recType == 'opportunity') ? 'custrecord_suretax_calllog_nsopp' : 'custrecord_suretax_calllog_nstrans';
			nlapiSubmitField('customrecord_suretax_calllog', callLogId, fieldName, transId);
		}		
	}

	/**
	 * Takes the name of the method call string, and returns internal id of the list that corresponds.
	 * 
	 * @function TransformMethodCallToList
	 * @memberof! CCH_SureTax_common_v1
	 * @param {String} methodString SureTax API method name
	 * @returns {Integer} Returns the internal Id of the associated list value
	 */
	function TransformMethodCallToList(methodString) {
		var ret = 5;

		switch (methodString) {
			case 'CancelPostRequest':
				ret = 1;
				break;
			case 'CancelPostRequestBatch':
				ret = 2;
				break;
			case 'FinalizePostRequest':
				ret = 3;
				break;
			case 'FinalizePostRequestBatch':
				ret = 4;
				break;
			case 'PostRequest':
				ret = 5;
				break;
			case 'PostRequestBatch':
				ret = 6;
				break;
		}

		return ret;
	}

	/**
	 * Takes the SureTax response code and returns the internal id of the status list that corresponds.
	 * 
	 * @function TransformResponseCodeToStatusList
	 * @memberof! CCH_SureTax_common_v1
	 * @param {String} responseCode SureTax response code
	 * @returns {Integer} Returns the internal Id of the associated list value
	 */
	function TransformResponseCodeToStatusList(responseCode) {
		var ret = 1;

		switch (responseCode) {
			case '9999':
				ret = 1;
				break;
			case '9001':
				ret = 2;
				break;
			default:
				ret = 3;
				break;
		}

		return ret;
	}

	/**
	 * Gets the field from the record with the given information.
	 * 
	 * @function GetFieldValueFromRecord
	 * @memberof! CCH_SureTax_common_v1
	 * @param {String} recordType Type of the record
	 * @param {Integer} recordId Internal Id of the record
	 * @param {String} fieldId Id of the field to retrieve.
	 * @returns {String} Returns the value of the given field.
	 */
	function GetFieldValueFromRecord(recordType, recordId, fieldId) {
		if (recordId) {
			var retRecord = nlapiLookupField(recordType, recordId, fieldId);

			return (retRecord != null) ? retRecord : "";
		}

		return "";
	}

	/**
	 * Gets the value field of the customer type record.
	 * 
	 * @function GetCustomerTypeValue
	 * @memberof! CCH_SureTax_common_v1
	 * @param {Integer} internalId Internal Id of the customer type record
	 * @returns {String} Returns the value of the value field of the given customer type record.
	 */
	function GetCustomerTypeValue(internalId) {
		return GetFieldValueFromRecord('customrecord_suretax_customertypecode', internalId, 'custrecord_customertypecode_value');
	}

	/**
	 * Gets the value field of the exemption code record.
	 * 
	 * @function GetExemptionCodeValue
	 * @memberof! CCH_SureTax_common_v1
	 * @param {Integer} internalId Internal Id of the exemption code record
	 * @returns {String} Returns the value of the value field of the given exemption code record.
	 */
	function GetExemptionCodeValue(internalId) {
		return GetFieldValueFromRecord('customrecord_suretax_exemption_code', internalId, 'custrecord_suretax_exemption_code_value');
	}

	/**
	 * Gets the value field of the regulatory type code record.
	 * 
	 * @function GetRegulatoryTypeCode
	 * @memberof! CCH_SureTax_common_v1
	 * @param {Integer} internalId Internal Id of the regulatory type code record
	 * @returns {String} Returns the value of the value field of the given regulatory type code record.
	 */
	function GetRegulatoryTypeCode(internalId) {
		return GetFieldValueFromRecord('customrecord_suretax_regulatorytypecode', internalId, 'custrecord_regulatorycode_value');
	}

	/**
	 * Gets the value field of the tax included code record.
	 * 
	 * @function GetTaxIncludedCode
	 * @memberof! CCH_SureTax_common_v1
	 * @param {Integer} internalId Internal Id of the tax included code record
	 * @returns {String} Returns the value of the value field of the given tax included code record.
	 */
	function GetTaxIncludedCode(internalId) {
		return GetFieldValueFromRecord('customrecord_suretax_rec_taxincludedcode', internalId, 'custrecord_taxincludedcode_value');
	}

	/**
	 * Gets the value field of the tax situs rule record.
	 * 
	 * @function GetTaxSitusRule
	 * @memberof! CCH_SureTax_common_v1
	 * @param {Integer} internalId Internal Id of the tax situs rule record
	 * @returns {String} Returns the value of the value field of the given tax situs rule record.
	 */
	function GetTaxSitusRule(internalId) {
		return GetFieldValueFromRecord('customrecord_suretax_rec_taxsitusrule', internalId, 'custrecord_suretax_taxsitusrule_value');
	}

	/**
	 * Gets the description of the tax category value.
	 * 
	 * @function GetTaxCategoryDesc
	 * @memberof! CCH_SureTax_common_v1
	 * @param {String} value Tax category value to get description for
	 * @returns {String} Returns the value of the name field of the given tax category value.
	 */
	function GetTaxCategoryDesc(value) {
		var ret = taxCatMap.get(value);

		if (IsEmpty(ret)) {
			var columns = [];
			columns[0] = new nlobjSearchColumn('name');

			var filters = [];
			filters[0] = new nlobjSearchFilter('custrecord_taxcat_value', null, 'is', value);
			var searchObj = nlapiCreateSearch('customrecord_suretax_taxcat', filters, columns);

			var results = searchObj.runSearch().getResults(0, 1);

			ret = (results != null && results.length > 0) ? results[0].getValue('name') : "";

			taxCatMap.set(value, ret);
		}

		return ret;
	}

	/**
	 * Gets the value field of the tax type code record.
	 * 
	 * @function GetTaxTypeCode
	 * @memberof! CCH_SureTax_common_v1
	 * @param {Integer} internalId Internal Id of the tax type code record
	 * @returns {String} Returns the value of the value field of the given tax type code record.
	 */
	function GetTaxTypeCode(internalId) {
		return GetFieldValueFromRecord('customrecord_suretax_rec_taxtypes', internalId, 'name');
	}

	/**
	 * Get the internal id of the given tax type code value
	 * 
	 * @function GetInternalIdByTaxCode
	 * @memberof! CCH_SureTax_common_v1
	 * @param {String} taxTypeCode Tax Type Code string to search for
	 * @returns {Integer} Returns the internal Id of the given tax type code record.
	 */
	function GetInternalIdByTaxCode(taxTypeCode) {
		var columns = [];
		columns[0] = new nlobjSearchColumn('internalid');

		var filterExp = [
			['name', 'is', taxTypeCode]
		];

		var searchObj = nlapiCreateSearch('customrecord_suretax_rec_taxtypes', filterExp, columns);

		var results = searchObj.runSearch().getResults(0, 1);

		return (results != null && results.length > 0) ? results[0].getValue('internalid') : null;
	}

	/**
	 * Gets the value field of the transaction type code record.
	 * 
	 * @function GetTransactionTypeCode
	 * @memberof! CCH_SureTax_common_v1
	 * @param {Integer} internalId Internal Id of the transaction type code record
	 * @returns {String} Returns the value of the value field of the given transaction type code record.
	 */
	function GetTransactionTypeCode(internalId) {
		return GetFieldValueFromRecord('customrecord_suretax_rec_transtypecode', internalId, 'custrecord_suretax_transtypecode_value');
	}

	/**
	 * Gets the value field of the unit type code record.
	 * 
	 * @function GetUnitTypeCode
	 * @memberof! CCH_SureTax_common_v1
	 * @param {Integer} internalId Internal Id of the unit type code record
	 * @returns {String} Returns the value of the value field of the given unit type code record.
	 */
	function GetUnitTypeCode(internalId) {
		return GetFieldValueFromRecord('customrecord_suretax_rec_unittypecodes', internalId, 'custrecord_suretax_unittypecodes_value');
	}

	/**
	 * Gets the interanl id of the given tax situs rule
	 * 
	 * @function GetTaxSitusRuleId
	 * @memberof! CCH_SureTax_common_v1
	 * @param {String} situsRule Situs rule to search for
	 * @returns {Integer} Returns the internal id of the given tax situs rule code
	 */
	function GetTaxSitusRuleId(situsRule) {
		return GetInternalIdOfValue('customrecord_suretax_rec_taxsitusrule', situsRule, 'custrecord_suretax_taxsitusrule_value');
	}

	/**
	 * Gets the internal id of the given unit type code
	 * 
	 * @function GetUnitTypeId
	 * @memberof! CCH_SureTax_common_v1
	 * @param {String} unitType Unit type code to search for
	 * @returns {Integer} Returns the internal id of the given unit type code
	 */
	function GetUnitTypeId(unitType) {
		return GetInternalIdOfValue('customrecord_suretax_rec_unittypecodes', unitType, 'custrecord_suretax_unittypecodes_value');
	}

	/**
	 * Gets the internal id of the given tax included code.
	 * 
	 * @function GetTaxIncludedCodeId
	 * @memberof! CCH_SureTax_common_v1
	 * @param {String} taxIncludedCode Tax included code to search for
	 * @returns {Integer} Returns the internal id of the given tax included code
	 */
	function GetTaxIncludedCodeId(taxIncludedCode) {
		return GetInternalIdOfValue('customrecord_suretax_rec_taxincludedcode', taxIncludedCode, 'custrecord_taxincludedcode_value');
	}

	/**
	 * Gets the internal id of the record where the field is the given value
	 * 
	 * @function GetInternalIdOfValue
	 * @memberof! CCH_SureTax_common_v1
	 * @param {String} recordType Record type to search for
	 * @param {String} value Value to search for
	 * @param {String} fieldId Field to search in
	 * @returns {Integer} Returns internal id of the record with given value if it exists, otherwise returns null.
	 */
	function GetInternalIdOfValue(recordType, value, fieldId) {
		var columns = [];
		columns[0] = new nlobjSearchColumn('internalid');

		var filters = [];
		filters[0] = new nlobjSearchFilter(fieldId, null, 'is', value);

		var results = nlapiSearchRecord(recordType, null, filters, columns);

		return (results != null && results.length > 0) ? results[0].getValue('internalid') : null;
	}

	/**
	 * Determines if a discount applies for the transaction.
	 * 
	 * @function DiscountExists
	 * @memberof! CCH_SureTax_common_v1
	 * @param {Integer} discountId Discount to check
	 * @returns {Boolean} Returns true if a discount applies for the transaction, false if a discount doesn't apply for the transaction.
	 */
	function DiscountExists(discountId, isEcommerce) {
		var ret = false;

		var discountItem = null;

		if (discountId != null && discountId != "") {
			if (!isEcommerce) {
				discountItem = nlapiLoadRecord('discountitem', discountId);

				var preTax = discountItem.getFieldValue('ispretax');

				ret = (discountItem != null && preTax);
			} else {
				ret = true;
			}
		}

		return ret;
	}

	/**
	 * Associate a record id with a NetSuite record.
	 * 
	 * @function Record
	 * @memberof! CCH_SureTax_common_v1
	 * @param {Integer} _recordId Internal id of the record.
	 * @param {Object} _record Object that defines the record.
	 */
	function Record(_recordId, _record) {
		this.RecordId = _recordId;
		this.Record = _record;
	}

	/**
	 * Turn the decimal into a percent.
	 * 
	 * @function GetPercent
	 * @memberof! CCH_SureTax_common_v1
	 * @param {Decimal} rate Rate to convert into a percent.
	 * @returns {Decimal} Returns the given decimal into a percent.
	 */
	function GetPercent(rate) {
		return (rate < 1 && rate > 0) ? rate * 100 : 0;
	}

	/**
	 * Parse the zip code into zip and plus4.
	 * 
	 * @function ParseZipCode
	 * @memberof! CCH_SureTax_common_v1
	 * @param {String} zip Zip code to parse
	 * @returns {Array} Returns the zip parsed, first element is the zip code, and the second element is the plus4.
	 */
	function ParseZipCode(zip) {
		if (zip && zip.length == 10) {
			return [zip.substring(0, 5), zip.substring(6, zip.length + 1)];
		} else {
			return [zip, ""];
		}
	}

	/**
	 * Gets the discount amount, either a dollar amount or percentage.
	 *
	 * @function GetOrderDiscountRate
	 * @memberof! CCH_SureTax_common_v1
	 * @param {String} curDiscountRate Discount rate string to convert to dollar amount
	 * @returns {Array} The first value is the discount (either percentage or dollar amount), 
	 * 			the second value is a boolean that is true if the first value is a percentage.
	 */
	function GetOrderDiscountRate(curDiscountRate) {
		var discountRate = curDiscountRate;
		var isPercentDiscount = false;

		var indexOfPer = (curDiscountRate != null) ? curDiscountRate.indexOf('%') : -1;
		if (indexOfPer != -1) {
			isPercentDiscount = true;
			discountRate = GetDiscountRate(curDiscountRate);
		}

		return [discountRate, isPercentDiscount];
	}

	/**
	 * Converts NetSuite check field into a boolean value.
	 * 
	 * @function ConvertCheckboxToBoolean
	 * @memberof! CCH_SureTax_common_v1
	 * @param {String} checkValue NetSuite check box value.
	 * @returns {Boolean} Returns the given parameter as a boolean.
	 */
	function ConvertCheckboxToBoolean(checkValue) {
		return (checkValue == 'T') ? true : false;
	}

	/**
	 * Converts a boolean into a NetSuite check field value.
	 * 
	 * @function ConvertBooleanToCheckbox
	 * @memberof! CCH_SureTax_common_v1
	 * @param {Boolean} boolValue Boolean value to convert
	 * @returns {String} Returns the given boolean as a NetSuite check field value.
	 */
	function ConvertBooleanToCheckbox(boolValue) {
		return (boolValue === true || boolValue === 'T') ? 'T' : 'F';
	}

	/**
	 * Gets the default values for the basic configuration.
	 * 
	 * @function GetConfigDetails
	 * @memberof! CCH_SureTax_common_v1
	 * @param {Integer} subval Subsidiary internal id.
	 * @returns {Object} Returns object containing the given subisidaries basic configuration values.
	 */
	function GetConfigDetails(subval) {
		var basicRecId = GetBasicConfigurationId(subval);
		var basicConfigValues = nlapiLookupField(
			basicConfigurationKeys.recordId, basicRecId, [
				basicConfigurationKeys.ecomregtype,
				basicConfigurationKeys.groupliketaxes,
				basicConfigurationKeys.ecomsalestype,
				basicConfigurationKeys.ecomenable,
				basicConfigurationKeys.ecomtaxexempt,
				basicConfigurationKeys.ecomtaxreason,
				basicConfigurationKeys.ecomunittype,
				basicConfigurationKeys.ecomtaxincl,
				basicConfigurationKeys.ecomtaxsitus,
				basicConfigurationKeys.ecomtranstype,
				basicConfigurationKeys.shenable,
				basicConfigurationKeys.shsalestype,
				basicConfigurationKeys.shregtype,
				basicConfigurationKeys.shtaxexempt,
				basicConfigurationKeys.shexptreason,
				basicConfigurationKeys.shunittype,
				basicConfigurationKeys.shtaxincl,
				basicConfigurationKeys.shtaxsitus,
				basicConfigurationKeys.shiptrancode,
				basicConfigurationKeys.handtrancode,
				basicConfigurationKeys.Telecom,
				basicConfigurationKeys.Utility,
				basicConfigurationKeys.Enable
			]);

		var retObj = {};

		if (basicConfigValues.custrecord_suretax_ecom_regcode) {
			retObj.providertype = basicConfigValues.custrecord_suretax_ecom_regcode;
		}

		if (basicConfigValues.custrecord_suretax_ecom_salestype) {
			retObj.salestype = basicConfigValues.custrecord_suretax_ecom_salestype;
		}

		if (basicConfigValues.custrecord_suretax_config_glt) {
			retObj.groupliketaxes = basicConfigValues.custrecord_suretax_config_glt;
		}

		if (basicConfigValues.custrecord_suretax_ecom_enable) {
			retObj.enable = basicConfigValues.custrecord_suretax_ecom_enable;
		}

		if (basicConfigValues.custrecord_suretax_ecom_exptcode) {
			retObj.taxexempt = basicConfigValues.custrecord_suretax_ecom_exptcode;
		}

		if (basicConfigValues.custrecord_suretax_ecom_exptreason) {
			retObj.exemptreason = basicConfigValues.custrecord_suretax_ecom_exptreason;
		}

		if ((basicConfigValues.custrecord_suretax_cfg_ind_telecom == 'T' || basicConfigValues.custrecord_suretax_cfg_ind_utility == 'T') &&
			basicConfigValues.custrecord_suretax_ecom_unittype) {
			retObj.unittype = basicConfigValues.custrecord_suretax_ecom_unittype;
		} else {
			retObj.unittype = GetUnitTypeId('99');
		}

		if (basicConfigValues.custrecord_suretax_ecom_taxinccode) {
			retObj.taxincl = basicConfigValues.custrecord_suretax_ecom_taxinccode;
		}

		if ((basicConfigValues.custrecord_suretax_cfg_ind_telecom == 'T' || basicConfigValues.custrecord_suretax_cfg_ind_utility == 'T') &&
			basicConfigValues.custrecord_suretax_ecom_taxsitus) {
			retObj.taxsitus = basicConfigValues.custrecord_suretax_ecom_taxsitus;
		} else {
			retObj.taxsitus = GetTaxSitusRuleId('22');
		}

		if (basicConfigValues.custrecord_suretax_ecom_transtype) {
			retObj.transtype = basicConfigValues.custrecord_suretax_ecom_transtype;
		}

		if (basicConfigValues.custrecord_suretax_sh_enable) {
			retObj.shenable = basicConfigValues.custrecord_suretax_sh_enable;
		}

		if (basicConfigValues.custrecord_suretax_sh_salestype) {
			retObj.shsalestype = basicConfigValues.custrecord_suretax_sh_salestype;
		}

		if (basicConfigValues.custrecord_suretax_sh_regcode) {
			retObj.shregtype = basicConfigValues.custrecord_suretax_sh_regcode;
		}

		if (basicConfigValues.custrecord_suretax_sh_exptcode) {
			retObj.shtaxexempt = basicConfigValues.custrecord_suretax_sh_exptcode;
		}

		if (basicConfigValues.custrecord_suretax_sh_exptreason) {
			retObj.shexptreason = basicConfigValues.custrecord_suretax_sh_exptreason;
		}

		if ((basicConfigValues.custrecord_suretax_cfg_ind_telecom == 'T' || basicConfigValues.custrecord_suretax_cfg_ind_utility == 'T') &&
			basicConfigValues.custrecord_suretax_sh_unittype) {
			retObj.shunittype = basicConfigValues.custrecord_suretax_sh_unittype;
		} else {
			retObj.shunittype = GetUnitTypeId('99');
		}

		if (basicConfigValues.custrecord_suretax_sh_taxinccode) {
			retObj.shtaxincl = basicConfigValues.custrecord_suretax_sh_taxinccode;
		}

		if ((basicConfigValues.custrecord_suretax_cfg_ind_telecom == 'T' || basicConfigValues.custrecord_suretax_cfg_ind_utility == 'T') &&
			basicConfigValues.custrecord_suretax_sh_taxsitus) {
			retObj.shtaxsitus = basicConfigValues.custrecord_suretax_sh_taxsitus;
		} else {
			retObj.shtaxsitus = GetTaxSitusRuleId('22');
		}

		if (basicConfigValues.custrecord_suretax_shipping_trancode) {
			retObj.shiptrancode = basicConfigValues.custrecord_suretax_shipping_trancode;
		}

		if (basicConfigValues.custrecord_suretax_handling_trancode) {
			retObj.handtrancode = basicConfigValues.custrecord_suretax_handling_trancode;
		}

		if (basicConfigValues.custrecord_suretax_enable) {
			retObj.pluginenable = basicConfigValues.custrecord_suretax_enable;
		}

		return retObj;
	}

	/**
	 * Gets the SureTax field values of the given expense category.
	 * 
	 * @function GetCustomerDetails
	 * @memberof! CCH_SureTax_common_v1
	 * @param {Integer} category Internal Id of an expense category.
	 * @param {Integer} subval Subsidiary internal id
	 * @param {Boolean} useShipDef If true, shipping defaults will be used from the SureTax basic config.
	 * @param {Object} sureTaxConfig SureTax config to get the defaults from
	 * @returns {Object} Returns object containing the values of the SureTax fields, for the given subsidiary.
	 */
	function GetCustomerDetails(customerId, subval, useShipDef, sureTaxConfig) {
		var retObj = {};
		useShipDef = (typeof useShipDef !== undefined) ? useShipDef : false;

		if (customerId && customerId != -100) {
			// Update the customer values.
			var custValues = nlapiLookupField('customer', customerId, [
				entityKeys.enable, entityKeys.exemptcode,
				entityKeys.salestype, entityKeys.exemptReason
			]);

			var useBasicConfig = (sureTaxConfig === undefined);
			var basicConfig = GetConfigDetails(subval);

			if (custValues.custentity_enablesuretaxcalculation.length > 0) {
				retObj.enable = custValues.custentity_enablesuretaxcalculation != '2' ? false : true;
			} else {
				retObj.enable = (!useShipDef) ? ((useBasicConfig) ? basicConfig.enable : sureTaxConfig.default_ecom_values.enable)  : 
					((useBasicConfig) ? basicConfig.shenable : sureTaxConfig.sh_default_values.enable);
			}

			if (custValues.custentity_suretax_exemptioncode) {
				retObj.taxexempt = custValues.custentity_suretax_exemptioncode;
			} else {
				retObj.taxexempt = (!useShipDef) ? ((useBasicConfig) ? basicConfig.taxexempt : sureTaxConfig.default_ecom_values.taxexempt)  : 
					((useBasicConfig) ? basicConfig.shtaxexempt : sureTaxConfig.sh_default_values.taxexempt);
			}

			if (custValues.custentity_suretax_exptreason) {
				retObj.exemptreason = custValues.custentity_suretax_exptreason;
			} else {
				retObj.exemptreason = (!useShipDef) ? ((useBasicConfig) ? basicConfig.exemptreason : sureTaxConfig.default_ecom_values.exemptreason)  : 
					((useBasicConfig) ? basicConfig.shexptreason : sureTaxConfig.sh_default_values.exemptreason);
			}

			if (custValues.custentity_suretax_cutomertype) {
				retObj.salestype = custValues.custentity_suretax_cutomertype;
			} else {
				retObj.salestype = (!useShipDef) ? ((useBasicConfig) ? basicConfig.salestype : sureTaxConfig.default_ecom_values.salestype)  : 
					((useBasicConfig) ? basicConfig.shsalestype : sureTaxConfig.sh_default_values.salestype);
			}
		}

		retObj.entityId = customerId;
		return retObj;
	}

	/**
	 * Gets the SureTax field values of the given expense category.
	 * 
	 * @function GetCategoryDetails
	 * @memberof! CCH_SureTax_common_v1
	 * @param {Integer} category Internal Id of an expense category.
	 * @param {Integer} subval Subsidiary internal id
	 * @returns {Object} Returns an object containing the values of the SureTax fields for the given subsidiary.
	 */
	function GetCategoryDetails(category, subval) {
		var retObj = {};

		if (!IsEmpty(category)) {
			var expCategoryValues = nlapiLookupField(expKeys.recordType,
				category, [expKeys.taxincludedcode, expKeys.situsrule,
					expKeys.unittype, expKeys.transactiontype
				]);

			var basicConfig = LoadConfiguration(subval);

			if (expCategoryValues.custrecord_suretax_taxincludedcode_exp) {
				retObj.taxincludedcode = expCategoryValues.custrecord_suretax_taxincludedcode_exp;
			} else {
				retObj.taxincludedcode = basicConfig.default_ecom_values.taxincl;
			}

			if (expCategoryValues.custrecord_suretax_taxsitusrule_exp) {
				retObj.situsrule = expCategoryValues.custrecord_suretax_taxsitusrule_exp;
			} else {
				retObj.situsrule = basicConfig.default_ecom_values.taxsitus;
			}

			if (expCategoryValues.custrecord_suretax_unittype_exp) {
				retObj.unittype = expCategoryValues.custrecord_suretax_unittype_exp;
			} else {
				retObj.unittype = basicConfig.default_ecom_values.unittype;
			}
			
			if (expCategoryValues.custrecord_suretax_transactiontype_exp) {
				retObj.transtypecode = expCategoryValues.custrecord_suretax_transactiontype_exp;
			} else {
				retObj.transtypecode = basicConfig.default_ecom_values.transtype;
			}
		}

		return retObj;
	}

	/**
	 * Gets the values of the SureTax fields for the vendor.
	 * 
	 * @function GetVendorDetails
	 * @memberof! CCH_SureTax_common_v1
	 * @param {Integer} vendor Internal Id of a vendor
	 * @param {Integer} subval Subsidiary internal id
	 * @returns {Object} Returns an object containing the values of the SureTax fields for the given subsidiary.
	 */
	function GetVendorDetails(vendor, subval) {
		var retObj = {};

		if (!IsEmpty(vendor)) {
			var vendorValues = nlapiLookupField(vendKeys.recordType, vendor, [
				vendKeys.enable, vendKeys.exemptCode,
				vendKeys.salesTypeCode, vendKeys.exemptReason
			]);

			var basicConfig = LoadConfiguration(subval);
			if(vendorValues != null)
			{
				if (vendorValues.custentity_enablesuretaxcalculation_ap.length > 0) {
					retObj.enable = vendorValues.custentity_enablesuretaxcalculation_ap != '2' ? false : true;
				} else {
					retObj.enable = basicConfig.default_ecom_values.enable;
				}

				if (vendorValues.custentity_suretax_exemptioncode_ap) {
					retObj.taxexempt = vendorValues.custentity_suretax_exemptioncode_ap;
				} else {
					retObj.taxexempt = basicConfig.default_ecom_values.taxexempt;
				}

				if (vendorValues.custentity_suretax_exptreason_ap) {
					retObj.exemptreason = vendorValues.custentity_suretax_exptreason_ap;
				} else {
					retObj.exemptreason = basicConfig.default_ecom_values.exemptreason;
				}

				if (vendorValues.custentity_suretax_cutomertype_ap) {
					retObj.salestype = vendorValues.custentity_suretax_cutomertype_ap;
				} else {
					retObj.salestype = basicConfig.default_ecom_values.salestype;
				}
			}
		}

		return retObj;
	}

	/**
	 * Gets the SureTax fields for the given item.
	 * 
	 * @function GetItemDetails
	 * @memberof! CCH_SureTax_common_v1
	 * @param {Integer} item Internal Id of the item.
	 * @param {Integer} subval Subsidiary internal id
	 * @param {Object} sureTaxConfig SureTax config to use for default values.
	 * @returns {Object} Object containing all of the SureTax values for the item.
	 */
	function GetItemDetails(item, subval, sureTaxConfig) {
		var retObj = {};

		var basicConfig = (sureTaxConfig === undefined) ? LoadConfiguration(subval) : sureTaxConfig;

		if (!IsEmpty(item)) {
			var itemValues = nlapiLookupField(itemKeys.recordType, item, [
				itemKeys.taxincludedcode, itemKeys.situsrule,
				itemKeys.unittype, itemKeys.transtypecode, itemKeys.regcode
			]);

			if(!IsEmpty(itemValues)){
			if (itemValues.custitem_suretax_item_taxincludedcode) {
				retObj.taxincludedcode = itemValues.custitem_suretax_item_taxincludedcode;
			} else {
				retObj.taxincludedcode = basicConfig.default_ecom_values.taxincl;
			}

			if (itemValues.custitem_suretax_item_taxsitusrule) {
				retObj.situsrule = itemValues.custitem_suretax_item_taxsitusrule;
			} else {
				retObj.situsrule = basicConfig.default_ecom_values.taxsitus;
			}

			if (itemValues.custitem_suretax_item_unittype) {
				retObj.unittype = itemValues.custitem_suretax_item_unittype;
			} else {
				retObj.unittype = basicConfig.default_ecom_values.unittype;
			}

			if (itemValues.custitem_suretax_item_transtypecode) {
				retObj.transtypecode = itemValues.custitem_suretax_item_transtypecode;
			} else {
				retObj.transtypecode = basicConfig.default_ecom_values.transtype;
			}
              if (itemValues.custitem_suretax_item_regulatorycode) {
				retObj.regulatorycode = itemValues.custitem_suretax_item_regulatorycode;
			} else {
				retObj.regulatorycode = basicConfig.default_ecom_values.regtype;
			}
			}
		}

		return retObj;
	}

	/**
	 * Logs an error on the script.
	 * 
	 * @function LogError
	 * @memberof! CCH_SureTax_common_v1
	 * @param {Object} ex Exception raised
	 * @param {String} header Name for the log
	 */
	function LogError(ex, header) {
		var msg = '';
		if (ex instanceof nlobjError) {
			msg = 'Error occurred. \n' + ex.getCode() + '\n' + ex.getDetails();
		} else {
			msg = 'Unexpected error occurred. \n' + ex.toString() +
				'\n At line number ' + ex.stack;
		}

		nlapiLogExecution('ERROR', header, msg);
	}

	/**
	 * Returns an object containing the various SureTax field column names.
	 * 
	 * @function GetSureTaxColumnNames
	 * @memberof! CCH_SureTax_common_v1
	 * @param {Boolean} isPurchasingTrans If true, purchase columns names will be returned, if false sales column names will be returned.
	 * @returns {Object} Returns an object containing the various SureTax field column names
	 */
	function GetSureTaxColumnNames(isPurchasingTrans) {
		if (isPurchasingTrans) {
			return {
				TaxIncludedCode: 'custcol_suretax_taxincludedcode_ap',
				UnitType: 'custcol_suretax_unittype_ap',
				TaxSitusRule: 'custcol_suretax_taxsitusrule_ap',
				SalesTypeCode: 'custcol_suretax_salestypecode_ap',
				RegulatoryCode: 'custcol_suretax_regulatorycode_ap',
				BillingZipCode: 'custcol_suretax_billing_zip_code_ap',
				BillingZipCodeExt: 'custcol_suretax_billing_zip_code_ext_ap',
				SecondaryZipCode: 'custcol_suretax_secondary_zip_code_ap',
				SecondaryZipCodeExt: 'custcol_suretax_secondary_zip_code_xt_ap',
				TaxExemptionCodeList: 'custcol_suretax_tax_exemption_code_ap',
				TaxExemptionCodeMulti: 'custcol_suretax_tax_exptcode_multi_ap',
				TaxExemptionReason: 'custcol_suretax_tax_expt_reason_ap',
				Enable: 'custcol_suretax_enablesuretax_ap',
				TransTypeCode: 'custcol_suretax_transtypecode_ap',
				SettingsInit: 'custcol_suretax_settings_init_ap',
				IsSureTaxItem: 'custcol_suretax_transline_tax_item_ap',
				TaxOption: 'custcol_suretax_taxoption'
			};
		} else {
			return {
				TaxIncludedCode: 'custcol_suretax_taxincludedcode',
				UnitType: 'custcol_suretax_unittype',
				TaxSitusRule: 'custcol_suretax_taxsitusrule',
				SalesTypeCode: 'custcol_suretax_salestypecode',
				RegulatoryCode: 'custcol_suretax_regulatorycode',
				BillingZipCode: 'custcol_suretax_billing_zip_code',
				BillingZipCodeExt: 'custcol_suretax_billing_zip_code_ext',
				SecondaryZipCode: 'custcol_suretax_secondary_zip_code',
				SecondaryZipCodeExt: 'custcol_suretax_secondary_zip_code_xt',
				TaxExemptionCodeList: 'custcol_suretax_tax_exemption_code',
				TaxExemptionCodeMulti: 'custcol_suretax_tax_exemptcode_multi',
				TaxExemptionReason: 'custcol_suretax_tax_exempt_reason',
				Enable: 'custcol_suretax_enablesuretax',
				TransTypeCode: 'custcol_suretax_transtypecode',
				SettingsInit: 'custcol_suretax_settings_init',
				IsSureTaxItem: 'custcol_suretax_transline_tax_item'
			};
		}
	}

	/**
	 * Gets the SureTax body field names.
	 * 
	 * @function GetSureTaxBodyFieldNames
	 * @memberof! CCH_SureTax_common_v1
	 * @param {Boolean} isPurchase If the transaction is a purchasing transaction.
	 * @returns {Ojbect} Returns an object containing the field names.
	 */
	function GetSureTaxBodyFieldNames(isPurchase) {
		return {
			LatestCallLog: (isPurchase) ? 'custbody_suretax_trans_ltcalllog_ap' : 'custbody_suretax_trans_ltcalllog',
			TotalTax: (isPurchase) ? 'custbody_suretax_totaltax_ap' : 'custbody_suretax_totaltax',
			LatestTranId: (isPurchase) ? 'custbody_suretax_latest_transid_ap' : 'custbody_suretax_latest_transid',
			DiscountAmount: (isPurchase) ? 'custbody_suretax_disc_amount_ap' : 'custbody_suretax_disc_amount',
			DiscountRate: (isPurchase) ? 'custbody_suretax_body_discrate_ap' : 'custbody_suretax_body_discrate'
		};
	}

	/**
	 * Returns object containing the various SureTax shipping and handling field names.
	 * 
	 * @function GetSureTaxSHBodyFieldNames
	 * @memberof! CCH_SureTax_common_v1
	 * @returns {Object} Returns an object containing the various SureTax shipping and handling field names.
	 */
	function GetSureTaxSHBodyFieldNames() {
		return {
			TaxIncludedCode: 'custbody_suretax_sh_taxincludedcode',
			UnitType: 'custbody_suretax_sh_unittype',
			TaxSitusRule: 'custbody_suretax_sh_taxsitusrule',
			SalesTypeCode: 'custbody_suretax_sh_salestypecode',
			RegulatoryCode: 'custbody_suretax_sh_regcode',
			TaxExemptionCodeList: 'custbody_suretax_sh_exemptcode',
			Enable: 'custbody_suretax_sh_enablesuretax',
			ShipTransTypeCode: 'custbody_suretax_sh_transtypecode',
			HandTransTypeCode: 'custbody_suretax_sh_hand_transtype',
			GroupLikeTaxes: 'custbody_suretax_group_like_taxes',
			TaxExemptReason: 'custbody_suretax_sh_exemptreason',
			EnableInline : 'custbody_suretax_enable_from_api',
			SettingsInit : 'custbody_suretax_settings_init'
		};
	}

	/**
	 * Takes the name of the tax type string, and returns internal id of the list that corresponds.
	 * 
	 * @function GetTaxRuleOverrideKeys
	 * @memberof! CCH_SureTax_common_v1
	 * @param {String} taxType tax type rule to be overridden
	 * @returns {Integer} Returns the internal Id of the associated list value
	 */
	function GetTaxRuleOverrideKeys(taxType, isPurchase) {
		var ret = (!isPurchase) ? "0" : "3";

		if (parseInt(taxType) === 1) {
			ret = "3";
		} else if (parseInt(taxType) === 2) {
			ret = "1";
		}

		return ret;
	}

	/**
	 * Determines if the AV plug-in is installed.
	 * 
	 * @function isAVInstalled
	 * @memberof! CCH_SureTax_common_v1
	 * @returns {Boolean} Returns true if the SureAddress bundle is installed, false if it isn't.
	 */
	function isAVInstalled() {
		var filter = new nlobjSearchFilter('name', 'file', 'is', "CCH.SureTax.Client.AddressValidation.js");
		var files = nlapiSearchRecord('folder', null, filter);
		return (files != null && files.length > 0);
	}

	/**
	 * Gets whether the general industry setup is enabled.
	 *
	 * @function IsGeneralIndEnabled
	 * @memberof! CCH_SureTax_common_v1
	 * @param {Integer} subval Subsidiary id
	 * @returns {Boolean} Returns true if the general industry setup is enabled for the given subsidiary, false otherwise.
	 */
	function IsGeneralIndEnabled(subval) {
		return ConvertCheckboxToBoolean(LoadConfiguration(subval).industry.General);
	}

	/**
	 * Gets whether the telecom industry setup is enabled.
	 *
	 * @function IsTelecomIndEnabled
	 * @memberof! CCH_SureTax_common_v1
	 * @param {Integer} subval Subsidiary id
	 * @returns {Boolean} Returns true if the telecom industry setup is enabled for the given subsidiary, false otherwise.
	 */
	function IsTelecomIndEnabled(subval) {
		return ConvertCheckboxToBoolean(LoadConfiguration(subval).industry.Telecom);
	}

	/**
	 * Gets whether the utility industry setup is enabled.
	 *
	 * @function IsUtilityIndEnabled
	 * @memberof! CCH_SureTax_common_v1
	 * @param {Integer} subval Subsidiary id
	 * @returns {Boolean} Returns true if the utility industry setup is enabled for the given subsidiary, false otherwise.
	 */
	function IsUtilityIndEnabled(subval) {
		return ConvertCheckboxToBoolean(LoadConfiguration(subval).industry.Utility);
	}

	/**
	 * Gets the basic configuration keys values.
	 * 
	 * @function GetBasicConfigurationKeys
	 * @memberof! CCH_SureTax_common_v1
	 * @returns {Object} Returns the basic configuration key field ids
	 */
	function GetBasicConfigurationKeys() {
		return basicConfigurationKeys;
	}

	/**
	 * Gets the currency code for the transaction.
	 * 
	 * @function GetCurrencyCode
	 * @memberof! CCH_SureTax_common_v1
	 * @param {Integer} Internal id of the currency record
	 * @param {Boolean} Value of the multi-currency parameter on the basic configuration
	 * @returns {String} Returns the currency code for the given currency record.
	 */
	function GetCurrencyCode(currencyId, multicurrencyEnabled) {
		var currencyCode = "";

		if (currencyId) {
			currencyCode = (multicurrencyEnabled == 'T') ? GetFieldValueFromRecord('currency', currencyId, 'symbol') : "USD";
		}

		return currencyCode;
	}

	/**
	 * Creates the call log update record.
	 * 
	 * @function CreateCallLogUpdateRec
	 * @memberof! CCH_SureTax_common_v1
	 * @param {Object} updateInfo Information to write to the call log update record
	 * @returns {Integer} Returns the internal id of the created call log update record.
	 */
	function CreateCallLogUpdateRec(updateInfo) {
		var updateRec = nlapiCreateRecord('customrecord_suretax_calllog_update');

		updateRec.setFieldValue('custrecord_stx_calllog_update_transid', updateInfo.TransId);
		updateRec.setFieldValue('custrecord_stx_calllog_update_logid', updateInfo.LogId);
		updateRec.setFieldValue('custrecord_stx_calllog_update_updated', updateInfo.Updated);
		updateRec.setFieldValue('custrecord_stx_calllog_upd_transrectype', updateInfo.RecType);
		updateRec.setFieldValue('custrecord_stx_calllog_update_stxtransid', updateInfo.StxTransId);
		
		return nlapiSubmitRecord(updateRec);
	}

	/**
	 * Creates the call log update record.
	 * 
	 * @function UpdateCallLogUpdateRec
	 * @memberof! CCH_SureTax_common_v1
	 * @param {Object} updateInfo Information to write to the call log update record
	 * @param {any} orderNo orderNo on transaction. 
	 * @returns {Integer} Returns the internal id of the created call log update record.
	 */
	function UpdateCallLogUpdateRec(updateInfo,orderNo) {
		// See if the record already exists.
		var columns = [];
		columns[0] = new nlobjSearchColumn('internalid');
		columns[1] = new nlobjSearchColumn('custrecord_stx_calllog_update_transid');
		columns[2] = new nlobjSearchColumn('custrecord_stx_calllog_update_logid');
		columns[3] = new nlobjSearchColumn('custrecord_stx_calllog_update_updated');
		columns[4] = new nlobjSearchColumn('custrecord_stx_calllog_update_stxtransid');
		columns[5] = new nlobjSearchColumn('custrecord_stx_calllog_upd_transrectype');
		
		var filters = [
			['custrecord_stx_calllog_update_transid', 'equalto', orderNo],
			'and', ['custrecord_stx_calllog_upd_transrectype', 'is', updateInfo.RecType],
			'and', ['custrecord_stx_calllog_update_updated', 'is', 'F']
		];

		var results = nlapiSearchRecord('customrecord_suretax_calllog_update', null, filters, columns);
		
		// Go through all the results and update the call logs accordingly.
		if (results != null) {
			for (var i = 0; i < results.length; i++) {
				var curResult = results[i];

				nlapiSubmitField('customrecord_suretax_calllog_update', curResult.getValue('internalid'), 'custrecord_stx_calllog_update_transid', updateInfo.TransId);
			}
		}
	}

	/**
	 * Updates the SureTax call log records for the given NS transaction.
	 * 
	 * @function UpdateTransIdOnCallLogFromUpdate
	 * @memberof! CCH_SureTax_common_v1
	 * @param {Integer} transId Internal id of the NS transaction to update call log records for
	 * @param {String} recType Record type of the NS transaction
	 */
	function UpdateTransIdOnCallLogFromUpdate(transId, recType) {
		// See if the record already exists.
		var columns = [];
		columns[0] = new nlobjSearchColumn('internalid');
		columns[1] = new nlobjSearchColumn('custrecord_stx_calllog_update_transid');
		columns[2] = new nlobjSearchColumn('custrecord_stx_calllog_update_logid');
		columns[3] = new nlobjSearchColumn('custrecord_stx_calllog_update_updated');
		columns[4] = new nlobjSearchColumn('custrecord_stx_calllog_update_stxtransid');
		columns[5] = new nlobjSearchColumn('custrecord_stx_calllog_upd_transrectype');
		
		var filters = [
			['custrecord_stx_calllog_update_transid', 'equalto', transId],
			'and', ['custrecord_stx_calllog_upd_transrectype', 'is', recType],
			'and', ['custrecord_stx_calllog_update_updated', 'is', 'F']
		];

		var results = nlapiSearchRecord('customrecord_suretax_calllog_update', null, filters, columns);

		// Go through all the results and update the call logs accordingly.
		if (results != null) {
			for (var i = 0; i < results.length; i++) {
				var curResult = results[i];

				// Update the call log if it hasn't been updated before.
				if (!ConvertCheckboxToBoolean(curResult.getValue('custrecord_stx_calllog_update_updated'))) {
					UpdateCallLogWithInternalId(curResult.getValue('custrecord_stx_calllog_update_logid'),
						curResult.getValue('custrecord_stx_calllog_update_transid'), recType);

					// Set the updated flag to false.
					nlapiSubmitField('customrecord_suretax_calllog_update', curResult.getValue('internalid'), 'custrecord_stx_calllog_update_updated', 'T');
				}
			}
		}
	}

	/**
	 * Gets the latest call log id for the given NetSuite transaction.
	 * 
	 * @function getLatestCallLogId
	 * @memberof! CCH_SureTax_common_v1
	 * @param {Integer} trans Internal id of the NS transaction to search for
	 * @param {String} type Type of the NS transaction
	 * @returns {Integer} Returns the latest call log internal id for the given transaction.
	 */
	function getLatestCallLogId(trans, type) {
		var columns = [];
		columns[0] = new nlobjSearchColumn('internalid');
		columns[0].setSort(true);
		
		var filterName = null;

		if (type) {
			filterName = getLogIdNameByType(type);
		}

		if (!filterName) {
			filterName = 'custrecord_suretax_calllog_nstrans';
		}

		var filters = [
			[filterName, 'is', trans]
		];

		var results = nlapiSearchRecord('customrecord_suretax_calllog', null, filters, columns);

		return (results != null && results.length > 0) ? results[0].getValue('internalid') : null;
	}


	/**
	 * Gets the latest call log id for the given NetSuite transaction.
	 * 
	 * @function getSureTaxTransactioIdFromLogId
	 * @memberof! CCH_SureTax_common_v1
	 * @param {Integer} logId Internal id of the call log
	 * @returns {Integer} Returns the SureTax transaction id for the log.
	 */
	function getSureTaxTransactioIdFromLogId(logId) {
		if (!logId || logId <= 0) {
			return null;
		}

		var columns = [];
		columns[0] = new nlobjSearchColumn('internalid');
		columns[1] = new nlobjSearchColumn('custrecord_stx_calllog_update_stxtransid');
		
		var filters = [
			['custrecord_stx_calllog_update_logid', 'equalto', logId]
		];

		var results = nlapiSearchRecord('customrecord_suretax_calllog_update', null, filters, columns);

		if (!results || results.length <= 0) {
			return null;
		}

		var result = results[0];
		if (result) {
			var transactionValue = result.getValue('custrecord_stx_calllog_update_stxtransid');
			if (transactionValue && transactionValue != '' && transactionValue != '0.0' && transactionValue != '0') {
				return transactionValue;
			}
		}

		return null;
	}

	/**
	 * Gets the latest request for the given SureTax call log.
	 * 
	 * @function getSureTaxRequestFromLogId
	 * @memberof! CCH_SureTax_common_v1
	 * @param {Integer} logId Internal id of the call log
	 * @returns {Integer} Returns the SureTax request for the log.
	 */
	function getSureTaxRequestFromLogId(logId) {
		if (!logId || logId <= 0) {
			return {};
		}

		var columns = [];
		columns[0] = new nlobjSearchColumn('internalid');
		columns[1] = new nlobjSearchColumn('custrecord_suretax_calllog_request');
		
		var filters = [
			['internalid', 'anyof', logId]
		];

		var results = nlapiSearchRecord('customrecord_suretax_calllog', null, filters, columns);

		if (!results || results.length <= 0) {
			return {};
		}

		var result = results[0];
		if (result) {
			var requestValue = result.getValue('custrecord_suretax_calllog_request');
			if (requestValue != '') {
				var jsonObj = tryParseJSON(requestValue);

				if (jsonObj !== false) {
					return jsonObj;
				}
			}
		}

		return {};
	}

	/**
	 * Trys to parse the JSON string. If it fails
	 * 
	 * @function getSureTaxRequestFromLogId
	 * @memberof! CCH_SureTax_common_v1
	 * @param {Integer} logId Internal id of the call log
	 * @returns {Integer} Returns the SureTax request for the log.
	 */
	function tryParseJSON(jsonString) {
		try {
			var jsonObj = JSON.parse(jsonString);

			if (jsonObj && typeof jsonObj === "object") {
				return jsonObj;
			}
		}
		catch (e) { }

		return false;
	}

	/**
	 * Gets the latest call log id for the given NetSuite transaction.
	 * 
	 * @function GetSureTaxTransactioLatestUpdateId
	 * @memberof! CCH_SureTax_common_v1
	 * @param {Integer} transId Internal id of the NS transaction to search for
	 * @param {String} recType Record type
	 * @returns {Integer} Returns the latest call log internal id for the given transaction.
	 */
	function GetSureTaxTransactioLatestUpdateId(transId, recType) {
		var columns = [];
		columns[0] = new nlobjSearchColumn('internalid');
		columns[0].setSort(true);
		columns[1] = new nlobjSearchColumn('custrecord_stx_calllog_update_stxtransid');

		var filters = [
			['custrecord_stx_calllog_update_transid', 'equalto', transId],
			'and', ['custrecord_stx_calllog_upd_transrectype', 'is', recType]
		];
		
		var results = nlapiSearchRecord('customrecord_suretax_calllog_update', null, filters, columns);
		return (results != null && results.length > 0) ? results[0].getValue('custrecord_stx_calllog_update_stxtransid') : null;
	}

	/**
	 * Gets the log record name for the given NS transaction type.
	 *
	 * @function getLogIdNameByType
	 * @memberof! CCH_SureTax_common_v1
	 * @param {String} type NS transaction type.
	 * @returns {String} Returns the call log record name.
	 */
	function getLogIdNameByType(type) {
		if (type === 'opportunity') {
			return 'custrecord_suretax_calllog_nsopp';
		} else {
			return 'custrecord_suretax_calllog_nstrans';
		}
		
	}

	/**
	 * Parses the given field name into the sublist and field name.
	 * 
	 * @function parseFieldName
	 * @memberof! CCH_SureTax_common_v1
	 * @param {String} fieldNameRec Data exchange field name column to parse
	 * @returns {Object} Returns object where FieldName is the field name from the column, and SublistName is the sublist name from the column.
	 */
	function parseFieldName(fieldNameRec) {
		var splitStr = fieldNameRec.split('-');
		var fieldName = splitStr[splitStr.length - 1];
		var sublistName = (splitStr.length == 3) ? splitStr[1] : '';

		return {
			FieldName: fieldName,
			SublistName: sublistName
		};
	}

	/**
	 * Gets the address validation configuration keys.
	 * 
	 * @function GetAVConfigurationKeys
	 * @memberof! CCH_SureTax_common_v1
	 * @returns {Object} AV configuration key field ids.
	 */
	function GetAVConfigurationKeys() {
		return avConfigKeys;
	}

	/**
	 * Gets whether the subsidiary feature is enabled or not.
	 * 
	 * @function isSubsidiaryEnable
	 * @memberof! CCH_SureTax_common_v1
	 * @returns {Boolean} Returns true if the subsidiary feature is enabled, false if it isnt'.
	 */
	function isSubsidiaryEnable() {
		return nlapiGetContext().getFeature('SUBSIDIARIES');
	}

	/**
	 * Determines if the given role is a SureTax administrator
	 * 
	 * @function isAdministrator
	 * @memberof! CCH_SureTax_common_v1
	 * @param {String} roleId Role to check
	 * @returns {Boolean} Returns true if the role is a SureTax administrator, false if it isn't.
	 */
	function isAdministrator(roleId) {
		return (roleId == 'administrator' || roleId == 'customrole_acl_admin_arclerk' ||
			roleId == 'customrole_acl_admin_apclerk' || roleId == 'customrole_acl_admin_pm') ? true : false;
	}

	var basicConfigurationKeys = {
		recordId: "customrecord_suretax_crt_bsccfg_01",
		addressline1: "custrecord_suretax_fld_address_01",
		addressline2: "custrecord_suretax_fld_address_02",
		city: "custrecord_suretax_fld_city_01",
		state: "custrecord_suretax_fld_state_01",
		zip: "custrecord_suretax_fld_zip_01",
		country: "custrecord_suretax_fld_country_01",
		url: "custrecord_suretax_fld_curl_01",
		clientnumber: "custrecord_suretax_fld_cnumber_01",
		validationkey: "custrecord_suretax_fld_cvalidkey_01",
		avurl: "custrecord_suretax_fld_curl_02",
		avclientnumber: "custrecord_suretax_fld_cnumber_02",
		avvalidationkey: "custrecord_suretax_fld_cvalidkey_02",
		diurl: "custrecord_suretax_fld_curl_03",
		diclientnumber: "custrecord_suretax_fld_cnumber_03",
		divalidationkey: "custrecord_suretax_fld_cvalidkey_03",
		salestype: "custrecord_suretax_fld_salestype_01",
		providertype: "custrecord_suretax_fld_providertype_01",
		id: 3,
		multicurrency: "custrecord_suretax_multicurrency_enable",
		groupliketaxes: "custrecord_suretax_config_glt",
		ecomenable: "custrecord_suretax_ecom_enable",
		ecomsalestype: "custrecord_suretax_ecom_salestype",
		ecomregtype: "custrecord_suretax_ecom_regcode",
		ecomtaxexempt: "custrecord_suretax_ecom_exptcode",
		ecomunittype: "custrecord_suretax_ecom_unittype",
		ecomtaxincl: "custrecord_suretax_ecom_taxinccode",
		ecomtaxsitus: "custrecord_suretax_ecom_taxsitus",
		ecomtranstype: "custrecord_suretax_ecom_transtype",
		ecomtaxcode: "custrecord_suretax_ecom_deftaxcode",
		ecomtaxreason: "custrecord_suretax_ecom_exptreason",
		shenable: "custrecord_suretax_sh_enable",
		shsalestype: "custrecord_suretax_sh_salestype",
		shregtype: "custrecord_suretax_sh_regcode",
		shtaxexempt: "custrecord_suretax_sh_exptcode",
		shunittype: "custrecord_suretax_sh_unittype",
		shtaxincl: "custrecord_suretax_sh_taxinccode",
		shtaxsitus: "custrecord_suretax_sh_taxsitus",
		shexptreason: "custrecord_suretax_sh_exptreason",
		shiptrancode: "custrecord_suretax_shipping_trancode",
		handtrancode: "custrecord_suretax_handling_trancode",
		sendsku: "custrecord_send_sku_trans_type",
		General: "custrecord_suretax_cfg_ind_general",
		Telecom: "custrecord_suretax_cfg_ind_telecom",
		Utility: "custrecord_suretax_cfg_ind_utility",
		Subsidiary: 'custrecord_suretax_cfg_subsidiary',
		Enable: 'custrecord_suretax_enable'
	};

	var avConfigKeys = {
		recordId: "customrecord_sureaddress_config",
		url: "custrecord_sureaddress_fld_curl",
		clientNumber: "custrecord_sureaddress_fld_cnumber",
		validationKey: "custrecord_sureaddress_fld_cvalidkey",
		minScore: "custrecord_sureaddress_fld_min_score"
	};

	var itemNames = {
		Federal: "SureTax - Federal Sales and Use Tax",
		State: "SureTax - State Sales and Use Tax",
		County: "SureTax - County Sales and Use Tax",
		City: "SureTax - City Sales and Use Tax",
		Local: "SureTax - Local Sales and Use Tax",
		SalesAndUseTax: "SureTax - Sales and Use Tax"
	};

	var expKeys = {
		taxincludedcode: 'custrecord_suretax_taxincludedcode_exp',
		situsrule: 'custrecord_suretax_taxsitusrule_exp',
		unittype: 'custrecord_suretax_unittype_exp',
		transactiontype: 'custrecord_suretax_transactiontype_exp',
		recordType: 'expensecategory'
	};

	var vendKeys = {
		recordType: 'vendor',
		enable: 'custentity_enablesuretaxcalculation_ap',
		exemptCode: 'custentity_suretax_exemptioncode_ap',
		salesTypeCode: 'custentity_suretax_cutomertype_ap',
		exemptReason: 'custentity_suretax_exptreason_ap'
	};

	var entityKeys = {
		enable: "custentity_enablesuretaxcalculation",
		exemptcode: "custentity_suretax_exemptioncode",
		salestype: "custentity_suretax_cutomertype",
		exemptReason: "custentity_suretax_exptreason"
	};

	var itemKeys = {
		taxincludedcode: "custitem_suretax_item_taxincludedcode",
		unittype: "custitem_suretax_item_unittype",
		situsrule: "custitem_suretax_item_taxsitusrule",
		transtypecode: "custitem_suretax_item_transtypecode",
        regcode: "custitem_suretax_item_regulatorycode",
		recordType: "item"
	};

	/**
	 * Javascript Map with key value pairs.
	 */
	function SureTaxMap() {
		this.Items = [];
		this.get = function (key) {
			for (var i = 0; i < this.Items.length; i++) {
				if (this.Items[i].Key == key) {
					return this.Items[i].Value;
				}
			}

			return null;
		};

		this.set = function (key, value) {
			var keyExists = false;
			for (var i = 0; i < this.Items.length; i++) {
				if (this.Items[i].Key == key) {
					this.Items[i].Value = value;
					keyExists = true;
					break;
				}
			}

			if (!keyExists) {
				this.Items.push({
					Key: key,
					Value: value
				});
			}
		};
	}

	/**
	 * Determines if the accounting period is closed or not
	 * 
	 * @function IsPeriodClosed
	 * @memberof! CCH_SureTax_common_v1
	 * @param {any} internalid of the accounting period 
	 * @returns {string} Returns T or F 
	 */
	function IsPeriodClosed(period) {
		return GetFieldValueFromRecord('accountingperiod', period, 'closed');
	}

	/**
	 * gets the accounting period based on start and end date
	 * 
	 * @function GetTransPostingPeriod
	 * @memberof! CCH_SureTax_common_v1
	 * @param {any} startdate  
	 * @param {any} enddate 
	 * @returns {string} Returns internalid of the accounting period  
	 */
	function GetTransPostingPeriod(startdate,enddate)
	{
		var columns = [];
		columns[0] = new nlobjSearchColumn('internalid');
		columns[0].setSort(true);

		var filters = [
			['startdate', 'on', startdate],
			'and', ['enddate', 'on', enddate]
		];
		
		var results = nlapiSearchRecord('accountingperiod', null, filters, columns);
		return (results != null && results.length > 0) ? results[0].getValue('internalid') : null;
	}

	/**
	 * gets the accounting period based on start and end date
	 * 
	 * @function FormatDate
	 * @memberof! CCH_SureTax_common_v1
	 * @param {any} date  
	 * @returns {string} Returns formated date 
	 */
	function FormatDate(date) {
		var dArray = date.toString().split('-');
		var year = dArray[2];	  
		var month = dArray[1];		
		day = dArray[0];		
		return month + '/' + day + '/' + year;
	  }

	return {
		LoadConfiguration: LoadConfiguration,
		GetBasicConfigurationKeys: GetBasicConfigurationKeys,
		GetTransactionTypeFromReturn: GetTransactionTypeFromReturn,
		ValidItemType: ValidItemType,
		PadZeroes: PadZeroes,
		RemoveCharacters: RemoveCharacters,
		GetDiscountRate: GetDiscountRate,
		CreateAddress: CreateAddress,
		RoundNumber: RoundNumber,
		IsEmpty: IsEmpty,
		IsReturnTransaction: IsReturnTransaction,
		PostingTransaction: PostingTransaction,
		GetDateStr: GetDateStr,
		GetDateStrNS: GetDateStrNS,
		SearchForRecordId: SearchForRecordId,
		Record: Record,
		NewSureTaxCallLog: NewSureTaxCallLog,
		GetCustomerTypeValue: GetCustomerTypeValue,
		GetRegulatoryTypeCode: GetRegulatoryTypeCode,
		GetTaxIncludedCode: GetTaxIncludedCode,
		GetTaxSitusRule: GetTaxSitusRule,
		GetTaxTypeCode: GetTaxTypeCode,
		GetTransactionTypeCode: GetTransactionTypeCode,
		GetUnitTypeCode: GetUnitTypeCode,
		GetFieldValueFromRecord: GetFieldValueFromRecord,
		GetExemptionCodeValue: GetExemptionCodeValue,
		GetAddress: GetAddress,
		TransformMethodCallToList: TransformMethodCallToList,
		TransformResponseCodeToStatusList: TransformResponseCodeToStatusList,
		UpdateCallLogWithInternalId: UpdateCallLogWithInternalId,
		GetTaxItemMapping: GetTaxItemMapping,
		GetInternalIdByTaxCode: GetInternalIdByTaxCode,
		GetPercent: GetPercent,
		GetTransactionTypeFromRecId: GetTransactionTypeFromRecId,
		DiscountExists: DiscountExists,
		ParseZipCode: ParseZipCode,
		GetOrderDiscountRate: GetOrderDiscountRate,
		ConvertCheckboxToBoolean: ConvertCheckboxToBoolean,
		ToPercentage: ToPercentage,
		GetSureTaxColumnNames: GetSureTaxColumnNames,
		IsPurchaseTransaction: IsPurchaseTransaction,
		GetConfigDetails: GetConfigDetails,
		GetCategoryDetails: GetCategoryDetails,
		GetVendorDetails: GetVendorDetails,
		GetCustomerDetails: GetCustomerDetails,
		GetSureTaxSHBodyFieldNames: GetSureTaxSHBodyFieldNames,
		GetBasicConfigurationId: GetBasicConfigurationId,
		LogError: LogError,
		IsShippingHandlingSeparate: IsShippingHandlingSeparate,
		GetTaxRuleOverrideKeys: GetTaxRuleOverrideKeys,
		GetAVConfigurationKeys: GetAVConfigurationKeys,
		GetAVConfigurationId: GetAVConfigurationId,
		LoadAVConfiguration: LoadAVConfiguration,
		isAVInstalled: isAVInstalled,
		GetSureTaxBodyFieldNames: GetSureTaxBodyFieldNames,
		GetItemDetails: GetItemDetails,
		ConvertBooleanToCheckbox: ConvertBooleanToCheckbox,
		IsGeneralIndEnabled: IsGeneralIndEnabled,
		IsTelecomIndEnabled: IsTelecomIndEnabled,
		IsUtilityIndEnabled: IsUtilityIndEnabled,
		GetCurrencyCode: GetCurrencyCode,
		CreateCallLogUpdateRec: CreateCallLogUpdateRec,
		UpdateTransIdOnCallLogFromUpdate: UpdateTransIdOnCallLogFromUpdate,
		isSubsidiaryEnable: isSubsidiaryEnable,
		isAdministrator: isAdministrator,
		getLatestCallLogId: getLatestCallLogId,
		parseFieldName: parseFieldName,
		getSureTaxTransactioIdFromLogId: getSureTaxTransactioIdFromLogId,
		getSureTaxRequestFromLogId: getSureTaxRequestFromLogId,
		GetTaxIncludedCodeId: GetTaxIncludedCodeId,
		GetSureTaxTransactioLatestUpdateId: GetSureTaxTransactioLatestUpdateId,
		UpdateCallLogUpdateRec:UpdateCallLogUpdateRec,
		IsPeriodClosed:IsPeriodClosed,
		GetTransPostingPeriod:GetTransPostingPeriod,
		FormatDate:FormatDate,
		NewSureTaxMapErrLog: NewSureTaxMapErrLog
	};
}
