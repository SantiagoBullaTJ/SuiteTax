/**
 * A compilation of methods used to gather the data to be sent to SureTax.
 * 
 * @version 1.0.20180705
 * @copyright CCH Incorporated 2018&copy;
 * @namespace CCH_SureTax_gather
 */
function gather() {
	var common = new SureTaxCommonModule();
	var lookup = new SureTaxLookupModule();
	var fieldsMod = new SureTaxFieldsModule();
	var isPurchase;
	var stxColumnNames = null;
	var stxSHFieldNames = null;
	var sureTaxConfig = null;
	var currencyCode;
	var billingAddr, shipToAddr, shipFromAddr;
	var telecomEnabled = false,
		utilityEnabled = false,
		isReturn = false;
	var subVal = null;
	var recType = '';
	var invNumber = '';
	var dataExchangeParams = new SureTaxDataExchangeParameters();
	var transDate = null;

	/**
	 * Creates a tax calculation request that will be sent to SureTax, based off of the SuiteTax input object.
	 * 
	 * @function createCalcRequest
	 * @memberof! CCH_SureTax_gather
	 * @param {Object} input SuiteTax input object
	 * @param {Boolean} forceQuote If this is true, a quote call will be created, otherwise behavior doesn't change.
	 * @returns {Object} Returns JSON tax calculation request that can be sent to SureTax.
	 */
	function createCalcRequest(input, forceQuote) {
		if (forceQuote === undefined) {
			forceQuote = false;
		}
		
		recType = input.getRecordType();
		isReturn = common.IsReturnTransaction(recType);
		isPurchase = common.IsPurchaseTransaction(recType);
		transDate = GetTransactionDate(input);
		var cmplDate = input.getTransactionDate();
		stxColumnNames = common.GetSureTaxColumnNames(isPurchase);
		stxSHFieldNames = common.GetSureTaxSHBodyFieldNames();
		subVal = (common.isSubsidiaryEnable()) ? input.getSubsidiary() : null;
		sureTaxConfig = common.LoadConfiguration(subVal);
		telecomEnabled = common.ConvertCheckboxToBoolean(sureTaxConfig.industry.Telecom);
		utilityEnabled = common.ConvertCheckboxToBoolean(sureTaxConfig.industry.Utility);
		invNumber = getInvoiceNumber(input.getTransactionId());

		InitLookups(input);

		getDataExchangeParams();

		currencyCode = common.GetCurrencyCode(input.getCurrency(), sureTaxConfig.settings.multicurrency);

		billingAddr = convertNSAddressToStxAddress((isPurchase) ? input.getBillFromAddress() : input.getBillToAddress());
		shipToAddr = convertNSAddressToStxAddress(input.getShipToAddress());
		shipFromAddr = convertNSAddressToStxAddress(input.getShipFromAddress());

		if (isAddressEmpty(shipFromAddr)) {
			// Address is empty, get the ship from address from the default config.
			shipFromAddr = sureTaxConfig.default_ship_from_address;
		}

        var context = nlapiGetContext();
        var modulename = (isPurchase) ? "Purchase" : "Sales";
		var pluginVersion = (isPurchase) ? "2.0.20240208" : "2.0.20240208";

		// Create the header information for this request.
		var request = {
			ClientNumber: sureTaxConfig.connection_settings.client_id,
			BusinessUnit: "",
			ValidationKey: sureTaxConfig.connection_settings.validation_key,
			DataYear: (transDate instanceof Date) ? transDate.getFullYear().toString() : transDate.getYear().toString(),
			DataMonth: (transDate instanceof Date) ? (transDate.getMonth() + 1).toString() : transDate.getMonth().toString(),
			CmplDataYear: cmplDate.getYear().toString(),
			CmplDataMonth: cmplDate.getMonth().toString(),
			ClientTracking: "WK;NETSUITE;" + context.getVersion() + ";" + pluginVersion + ";" + modulename + ";" + GetRecType(recType) + ";" + context.getEnvironment() + "-" + context.getCompany() + ";SUITETAX;",
			ResponseType: "12C2",
			ResponseGroup: "13",
			ReturnFileCode: (!forceQuote && input.isPostingTransaction() && !input.isPreview()) ? "0" : "Q",
			IndustryExemption: "",
			STAN: "",
			MasterTransId: 0,
			BillingAddress: billingAddr,
			P2PAddress: shipToAddr,
			ShipToAddress: shipToAddr,
			ShipFromAddress: shipFromAddr,
			OrderPlacementAddress: "",
			OrderApprovalAddress: "",
			ItemList: []
		};

		// Create the line information for this request.
		if (input.getLines().length > 0) {
			// There are lines, so add them to the request.
			request.ItemList = addLines(input);
			request.TotalRevenue = GetRequestTotalAmount(request.ItemList);
		}

		lookup.Cleanup();

		return request;
	}

	/**
	 * Gets the Record Type for the transaction.
	 * 
	 * @returns Record Type for the transaction.
	 */
	function GetRecType(recType) {
      var ret = '';
		switch (recType) {
			case 'salesorder':
				ret = 'SO';
				break;
			case 'invoice':
				ret = 'INV';
				break;
			case 'estimate':
				ret = 'EST';
				break;
			case 'opportunity':
				ret = 'OPP';
				break;
			case 'cashsale':
				ret = 'CS';
				break;
			case 'cashrefund':
				ret = 'CR';
				break;
			case 'creditmemo':
				ret = 'CM';
				break;
			case 'returnauthorization':
				ret = 'RMA';
				break;
			case 'purchaseorder':
				ret = 'PO';
				break;
			case 'vendorbill':
				ret = 'VB';
				break;
			case 'vendorreturnauthorization':
				ret = 'VRA';
				break;
			case 'vendorcredit':
				ret = 'VC';
				break;
		}
        return ret;
	}

	/**
	 * Gets the transaction date for the transaction.
	 * 
	 * @returns Transaction date for the transaction.
	 */
	function GetTransactionDate(input) {
		if (input != null) {
			var date = null;
			if (isReturn) {
				// Pull the date from the attached transaction.
				var createdFromRecId = input.getAdditionalFieldValue('createdfrom');
				var createdFromRecType = common.GetTransactionTypeFromRecId(createdFromRecId);

				if (!common.IsEmpty(createdFromRecType) && createdFromRecId > 0) {
					if (createdFromRecType === 'returnauthorization' || createdFromRecType === 'vendorreturnauthorization') {
						var vmaCreatedFrom = nlapiLookupField(createdFromRecType, createdFromRecId, 'createdfrom');

						if (vmaCreatedFrom !== undefined && vmaCreatedFrom.length > 0) {
							createdFromRecId = vmaCreatedFrom;
							createdFromRecType = common.GetTransactionTypeFromRecId(createdFromRecId);
						}
					}

					if (!common.IsEmpty(createdFromRecType) && createdFromRecId > 0) {
						var dateFromTrans = nlapiLookupField(createdFromRecType, createdFromRecId, 'trandate');
						date = nlapiStringToDate(dateFromTrans);
					}
				}
			}

			if (date == null) {
				date = input.getTransactionDate();
			}

			return date;
		}

		return new Date();
	}

	/**
	 * Gets the value to send to SureTax in the InvoiceNumber field.
	 * 
	 * @function getInvoiceNumber
	 * @memberof! CCH_SureTax_gather
	 * @param {Integer} transId NetSuite transaction (internal) id
	 * @returns {String} Returns the value that is to be sent to SureTax in the InvoiceNumber field.
	 */
	function getInvoiceNumber(transId) {
		var ret = GetRecType(recType);

		if (transId != null) {
			ret += '-' + transId.toString();
		}

		return ret;
	}

	/**
	 * Creates a cancelation request that can then be sent to SureTax to cancel the transaction in SureTax.
	 * 
	 * @function createCancelRequest
	 * @memberof! CCH_SureTax_gather
	 * @param {Integer} stxTransId SureTax transaction id to cancel.
	 * @param {Object} input SuiteTax input object
	 * @returns {Object} Returns JSON cancelation request that can be sent to SureTax to cancel the transaction.
	 */
	function createCancelRequest(stxTransId, input) {
		var obj = {};

		// reload the record
		subVal = (common.isSubsidiaryEnable()) ? input.getSubsidiary() : null;
		sureTaxConfig = common.LoadConfiguration(subVal);

		if (common.IsEmpty(stxTransId)) {
			nlapiLogExecution('AUDIT', 'SureTax API : createCancelRequest call', 'Empty SureTax transId');

			return null;
		}

        var context = nlapiGetContext();
		recType = input.getRecordType();
		isPurchase = common.IsPurchaseTransaction(recType);
        var modulename = (isPurchase) ? "Purchase" : "Sales";
		var pluginVersion = (isPurchase) ? "2.0.20231116" : "2.0.20231116";

		obj = {
			'ClientNumber': sureTaxConfig.connection_settings.client_id,
			'ClientTracking': "WK;NETSUITE;" + context.getVersion() + ";" + pluginVersion + ";" + modulename + ";" + GetRecType(recType) + ";" + context.getEnvironment() + "-" + context.getCompany() + ";SUITETAX;",
			'TransId': stxTransId,
			'ValidationKey': sureTaxConfig.connection_settings.validation_key
		};

		return obj;
	}

	/**
	 * Gets the total amount of the lines.
	 * 
	 * @function GetRequestTotalAmount
	 * @memberof! CCH_SureTax_gather
	 * @param {Array} lines Array of lines to sum up.
	 * @returns {Currency} Returns the sum of all of the lines in the given array.
	 */
	function GetRequestTotalAmount(lines) {
		var total = 0;

		for (var i = 0; i < lines.length; i++) {
			total = total + parseFloat(lines[i].Revenue);
		}

		return total;
	}

	/**
	 * Address format that is used by the SureTax web services.
	 * 
	 * @typedef STXAddress
	 * @property {String} PrimaryAddressLine Street of the address
	 * @property {String} SecondaryAddressLine Street 2 of the address
	 * @property {String} County County of the address
	 * @property {String} City City of the address
	 * @property {String} State State of the address
	 * @property {String} PostalCode Zip code of the address
	 * @property {String} Plus4 Plus4 of the address
	 * @property {String} Country Country of the address
	 * @property {String} Geocode Geocode of the address
	 */

	/**
	 * Converts a NS address object into an address that can be used by SureTax.
	 * 
	 * @function convertNSAddressToStxAddress
	 * @memberof! CCH_SureTax_gather
	 * @param {Object} address NS address object
	 * @returns {STXAddress} Returns an address that can be consumed by SureTax.
	 */
	function convertNSAddressToStxAddress(address) {
		if (address != null) {
			var zipInfo = common.ParseZipCode(address.getZip());

			return {
				PrimaryAddressLine: address.getAddr1(),
				SecondaryAddressLine: address.getAddr2(),
				County: "",
				City: address.getCity(),
				State: address.getState(),
				PostalCode: (address.getCountry() === 'CA') ? zipInfo[0].replace(' ', '') : zipInfo[0],
				Plus4: zipInfo[1],
				Country: address.getCountry(),
				Geocode: ""
			};
		} else {
			return {
				PrimaryAddressLine: '',
				SecondaryAddressLine: '',
				County: "",
				City: '',
				State: '',
				PostalCode: '',
				Plus4: '',
				Country: '',
				Geocode: ""
			};
		}
	}

	/**
	 * Determines if the given address is an empty address.
	 * 
	 * @function isAddressEmpty
	 * @memberof! CCH_SureTax_gather
	 * @param {STXAddress} addr Address to check
	 * @returns {Boolean} Returns true if the address is empty, false if it isn't.
	 */
	function isAddressEmpty(addr) {
		return (common.IsEmpty(addr.PrimaryAddressLine) && common.IsEmpty(addr.SecondaryAddressLine) && common.IsEmpty(addr.County) &&
			common.IsEmpty(addr.City) && common.IsEmpty(addr.State) && common.IsEmpty(addr.PostalCode) &&
			common.IsEmpty(addr.Plus4));
	}

	/**
	 * Create's new instance of address variable.
	 * 
	 * @function copyAddressToNewInstance
	 * @memberof! CCH_SureTax_gather
	 * @param {STXAddress} addr Address to copy
	 * @returns {STXAddress} Returns a new copy of the existing address.
	 */
	function copyAddressToNewInstance(addr) {
		return {
			PrimaryAddressLine: addr.PrimaryAddressLine,
			SecondaryAddressLine: addr.SecondaryAddressLine,
			County: addr.County,
			City: addr.City,
			State: addr.State,
			PostalCode: addr.PostalCode,
			Plus4: addr.Plus4,
			Country: addr.Country,
			Geocode: addr.Geocode
		};
	}

	/**
	 * Updates the zip codes on the given address.
	 * 
	 * @function updateZipCodes
	 * @memberof! CCH_SureTax_gather
	 * @param {STXAddress} addr Address to update
	 * @param {String} zipCode Zip code to update
	 * @param {String} plus4 Plus4 to update
	 * @returns {STXAddress} Returns the given address with the zip/plus4 updated.
	 */
	function updateZipCodes(addr, zipCode, plus4) {
		var address = copyAddressToNewInstance(addr);
		if (!common.IsEmpty(zipCode)) {
			address.PostalCode = zipCode;
		}

		if (!common.IsEmpty(plus4)) {
			address.Plus4 = plus4;
		}

		return address;
	}

	/**
	 * Gets the data exchange parameters for this record, and stores them in an array.
	 * 
	 * @function getDataExchangeParams
	 * @memberof! CCH_SureTax_gather
	 */
	function getDataExchangeParams() {
		// Find the parameters for this given transaction.
		var columns = [];
		columns[0] = new nlobjSearchColumn('custrecord_suretax_fld_parameter_so');
		columns[1] = new nlobjSearchColumn('custrecord_suretax_fld_fieldname_so');
		columns[2] = new nlobjSearchColumn('custrecord_suretax_fld_linetype_so');

		var filters = [
			['custrecord_suretax_fld_formtype_so', 'is', recType],
			'and', ['custrecord_suretax_fld_fieldname_so', 'isnotempty', '']
		];

		if (subVal != null) {
			filters.push('and');
			filters.push(['custrecord_suretax_fld_subsidiary_so', 'is', subVal]);
		}

		var results = nlapiSearchRecord('customrecord_suretax_crt_dataexch', null, filters, columns);

		if (results != null && results.length > 0) {
			// Add the parameters to the array.
			for (var i = 0; i < results.length; i++) {
				dataExchangeParams.add(results[i].getValue('custrecord_suretax_fld_linetype_so'),
					results[i].getText('custrecord_suretax_fld_parameter_so'),
					results[i].getValue('custrecord_suretax_fld_fieldname_so'));
			}
		}
	}

	/**
	 * Sets the values of the data exchange fields for the given line.
	 * 
	 * @function addDataExchangeFieldsToLine
	 * @memberof! CCH_SureTax_gather
	 * @param {STXLine} line Line to add data exchange fields to.
	 * @param {Object} nsLine SuiteTax line
	 * @param {Object} input SuiteTax input object
	 */
	function addDataExchangeFieldsToLine(line, nsLine, input) {
		var deLineType = getStxLineTypeFromNSLineType(nsLine.getLineType());
		var paramsToSet = dataExchangeParams.getByLineType(deLineType);

		for (var i = 0; i < paramsToSet.length; i++) {
			var curParam = paramsToSet[i];
			var fieldSplit = common.parseFieldName(curParam.FieldName);
			var fieldName = '';
			var fieldValue = '';

			if (common.IsEmpty(fieldSplit.SublistName)) {
				fieldName = fieldsMod.findHeaderFieldNameByLabel(recType, fieldSplit.FieldName);
				fieldValue = input.getAdditionalFieldValue(fieldName);
			} else {
				fieldName = fieldsMod.findSublistFieldNameByLabel(recType, fieldSplit.SublistName, fieldSplit.FieldName);
				fieldValue = nsLine.getAdditionalFieldValue(fieldName);
			}

			line[curParam.Parameter] = (fieldValue != null) ? fieldValue : '';
		}
	}

	/**
	 * Gets the data exchange line type for the given SuiteTax line type.
	 * 
	 * @function getStxLineTypeFromNSLineType
	 * @memberof! CCH_SureTax_gather
	 * @param {Enum} nsLineType SuiteTax line type of the line.
	 * @returns {String} Returns the data exchange line type for the given SuiteTax line type.
	 */
	function getStxLineTypeFromNSLineType(nsLineType) {
		if (nsLineType == TaxCalculationInputLineType.SHIPPING) {
			return 'Shipping';
		} else if (nsLineType == TaxCalculationInputLineType.HANDLING) {
			return 'Handling';
		} else if (nsLineType == TaxCalculationInputLineType.ITEM) {
			return 'Item';
		} else if (nsLineType == TaxCalculationInputLineType.EXPENSE) {
			return 'Expense';
		}

		return '';
	}

	/**
	 * Creates an array of lines to send to SureTax.
	 * 
	 * @function addLines
	 * @memberof! CCH_SureTax_gather
	 * @param {Object} input Tax calculation input lines to send to SureTax
	 * @returns {Array} Returns an array of request lines to send to SureTax.
	 */
	function addLines(input) {
		var stxLines = [];
		var lines = input.getLines();

		// Loop through all of the lines.
		for (var i = 0; i < lines.length; i++) {
			var curInputLine = lines[i];			

			if (common.ConvertCheckboxToBoolean(getEnableForLine(input, curInputLine))) {
				var sureTaxValues = GetSureTaxLineValues(curInputLine, input, lookup);
				var billingPeriod = GetBillingPeriodInfo(input);

				// Get the information for the current line item.
				var item = {
					LineNumber: i + 1,
					InvoiceNumber: invNumber,
					CustomerNumber: input.getEntity(),
					LocationCode: "",
					BillToNumber: "",
					OrigNumber: "",
					TermNumber: "",
					TransDate: common.GetDateStrNS(transDate),
					BillingPeriodStartDate: common.GetDateStr(billingPeriod.StartDate),
					BillingPeriodEndDate: common.GetDateStr(billingPeriod.EndDate),
					Revenue: getLineAmount(curInputLine, input.getRecordType()),
					TaxIncludedCode: sureTaxValues.TaxIncludedCode,
					Units: getQuantity(curInputLine),
					UnitType: sureTaxValues.UnitType,
					Seconds: "1",
					TaxSitusRule: sureTaxValues.TaxSitusRule,
					TaxSitusOverrideCode: '',
					RuleOverride: (isPurchase) ? common.GetTaxRuleOverrideKeys(curInputLine.getAdditionalFieldValue(stxColumnNames.TaxOption), isPurchase) :
						common.GetTaxRuleOverrideKeys(0, isPurchase),
					TransTypeCode: sureTaxValues.TransTypeCode,
					SalesTypeCode: sureTaxValues.SalesTypeCode,
					RegulatoryCode: sureTaxValues.RegulatoryCode,
					TaxExemptionCodeList: sureTaxValues.TaxExemptionCodeList,
					ExemptReasonCode: sureTaxValues.TaxExemptionReason,
					UDF: GetUDFForLineType(curInputLine),
					FreightOnBoard: "",
					ShipFromPOB: "1",
					MailOrder: "1",
					CommonCarrier: "1",
					OriginCountryCode: shipFromAddr.Country,
					DestCountryCode: shipToAddr.Country,
					AuxRevenue: 0,
					AuxRevenueType: "",
					BillingDaysInPeriod: billingPeriod.DaysInPeriod,
					CurrencyCode: currencyCode,
					BillingAddress: updateZipCodes(billingAddr, sureTaxValues.BillingZipCode, sureTaxValues.BillingZipCodeExt),
					P2PAddress: updateZipCodes(GetLineShipToAddress(curInputLine,input), sureTaxValues.SecondaryZipCode, sureTaxValues.SecondaryZipCodeExt),
					ShipToAddress: GetLineShipToAddress(curInputLine,input),
					ShipFromAddress: GetLineShipFromAddress(curInputLine,input),
					OrderPlacementAddress: "",
					OrderApprovalAddress: "",
					TaxOption: curInputLine.getAdditionalFieldValue(stxColumnNames.TaxOption)
				};

				addDataExchangeFieldsToLine(item, curInputLine, input);

				stxLines.push(item);
			}
		}

		return stxLines;
	}

    /**
	 * Gets the line level ship to address for the line.
	 * 
	 * @returns line shipto address. If line shipto address is blank it returns the header shipto address
	 */
	function GetLineShipToAddress(inputLine,input) {
		var ret = shipToAddr;
		if (inputLine) {
			var lineType = inputLine.getLineType();
			if (input.getAdditionalFieldValue('ismultishipto') === 'T' && lineType != TaxCalculationInputLineType.EXPENSE) {
				ret = convertNSAddressToStxAddress(inputLine.getShipToAddress());
			}
			else if (lineType != TaxCalculationInputLineType.EXPENSE &&
				lineType != TaxCalculationInputLineType.SHIPPING &&
				lineType != TaxCalculationInputLineType.HANDLING) {
				var convertedAddr = convertNSAddressToStxAddress(inputLine.getShipToAddress());
				if (convertedAddr && !isAddressEmpty(convertedAddr)) {
					ret = convertedAddr;
				}
			}
		}

		return ret;
	}
	
	
	/**
	 * Gets the default ship from address for the transaction.
	 * 
	 * @returns Default ship from address object for the transaction
	 */
		function GetLineShipFromAddress(inputLine, input) {
		var ret = shipFromAddr;

		if (inputLine) {
			if (!isPurchase) {
				var convertedAddr = null;
				var lineType = inputLine.getLineType();
				if (input.getAdditionalFieldValue('ismultishipto') === 'T' && lineType != TaxCalculationInputLineType.EXPENSE) {
					convertedAddr = convertNSAddressToStxAddress(inputLine.getShipFromAddress());
				}
				else if (lineType != TaxCalculationInputLineType.SHIPPING && lineType != TaxCalculationInputLineType.HANDLING) {
					convertedAddr = convertNSAddressToStxAddress(inputLine.getShipFromAddress());
				}
				if (convertedAddr && !isAddressEmpty(convertedAddr)) {
					ret = convertedAddr;
				}
			}
		}

		return ret;
	}
	
	/**
	 * Gets the default ship from address for the transaction.
	 * 
	 * @returns Default ship from address object for the transaction
	 */
	function GetHeaderShipFromAddress() {
		if (localRecord != null) {
			if (!isPurchase) {
				var locationId = localRecord.getValue('location');

				// If there is a location on the form.
				if (locationId) {
					return GetLocationAddress(locationId);
				} else {
					// Get the default ship from address from the basic
					// configuration.
					return sureTaxConfig.default_ship_from_address;
				}
			} else {
				if (entityRec) {
					return common.GetShippingAddress(entityRec);
				}
			}
		}
	}

	/**
	 * Gets the UDF value for the given item type.
	 * 
	 * @function GetUDFForLineType
	 * @memberof! CCH_SureTax_gather
	 * @param {Object} inputLine Line to get type of
	 * @returns {String} Returns the UDF value for the given line type.
	 */
	function GetUDFForLineType(inputLine) {
		if (inputLine.getLineType() == TaxCalculationInputLineType.ITEM) {
			return 'ITEM';
		} else if (inputLine.getLineType() == TaxCalculationInputLineType.SHIPPING) {
			return 'SHIPPING';
		} else if (inputLine.getLineType() == TaxCalculationInputLineType.HANDLING) {
			return 'HANDLING';
		} else if (inputLine.getLineType() == TaxCalculationInputLineType.EXPENSE) {
			return 'EXPENSE';
		}
	}

	/**
	 * Gets the SureTax enabled for the given line.
	 * 
	 * @function getEnableForLine
	 * @memberof! CCH_SureTax_gather
	 * @param {Object} input SuiteTax input object
	 * @param {Object} inputLine Line to get enable for
	 * @returns {Boolean} Returns value of the line enable field.
	 */
	function getEnableForLine(input, inputLine) {
		if (inputLine.getLineType() == TaxCalculationInputLineType.SHIPPING ||
			inputLine.getLineType() == TaxCalculationInputLineType.HANDLING) {
			return input.getAdditionalFieldValue(stxSHFieldNames.Enable);
		} else {
			return inputLine.getAdditionalFieldValue(stxColumnNames.Enable);
		}
	}

	/**
	 * Gets whether the line should be sent to SureTax or not.
	 * 
	 * @function sendToSureTax
	 * @memberof! CCH_SureTax_gather
	 * @param {Object} input SuiteTax input object
	 * @param {Object} inputLine Line to determine for
	 * @returns {Boolean} Returns true if the line is to be sent to SureTax, false if it isn't.
	 */
	function sendToSureTax(input, inputLine) {
		return !(input.isPostingTransaction() && isPurchase && inputLine.getAdditionalFieldValue(stxColumnNames.TaxOption) == 2);
	}

	/**
	 * Gets the quantity for the given line.
	 * 
	 * @function getQuantity
	 * @memberof! CCH_SureTax_gather
	 * @param {Object} inputLine Line to get quantity for
	 * @returns {Float} Returns the quantity for the given line.
	 */
	function getQuantity(inputLine) {
		if (inputLine.getLineType() == TaxCalculationInputLineType.ITEM) {
			return parseInt(inputLine.getQuantity());
		} else {
			return 1;
		}
	}

	/**
	 * Gets the amount for the given line, taking discounts into effect.
	 * 
	 * @function getLineAmount
	 * @memberof! CCH_SureTax_gather
	 * @param {Object} input SuiteTax input object
	 * @param {Object} inputLine Line to get amount for
	 * @param {Float} Returns the amount for the line, with discounts included.
	 */
	function getLineAmount(inputLine, recType) {
		var isReturn = common.IsReturnTransaction(recType);
		var ret = parseFloat(inputLine.getAmount()) + parseFloat(inputLine.getDiscountsTotal());
		return (isReturn) ? ret * -1 : ret;
	}

	/**
	 * Values of the SureTax columns. These values can be sent directly to SureTax.
	 * 
	 * @typedef SureTaxLineValues
	 * @property {String} TaxIncludedCode Tax included code for the line
	 * @property {String} UnitType Unit type code for the line
	 * @property {String} TaxSitusRule Tax situs rule for the line
	 * @property {String} TransTypeCode Transaction type code for the line
	 * @property {String} SalesTypeCode Sales type code for the line
	 * @property {String} RegulatoryCode Regulatory type code for the line
	 * @property {String} BillingZipCode Billing zip code for the line
	 * @property {String} BillingZipCodeExt Billing plus4 for the line
	 * @property {String} SecondaryZipCode Secondary zip code for the line
	 * @property {String} SecondaryZipCodeExt Secondary plus4 for the line
	 * @property {Array} TaxExemptionCodeList Tax exemption code list for the line
	 */

	/**
	 * Gets the values of the custom SureTax line fields, and returns them as a JSON object.
	 * 
	 * @function GetSureTaxLineValues
	 * @memberof! CCH_SureTax_gather
	 * @param {Object} inputLine Line to get values for
	 * @returns {SureTaxLineValues} Returns a JSON object containing the custom SureTax fields.
	 */
	function GetSureTaxLineValues(inputLine, input, sureTaxLookup) {
		var currentLookup = sureTaxLookup;

		if (currentLookup == undefined) {
			// fallback
			currentLookup = common;
		}

		var taxExemptCodeList = [];

		if (inputLine.getLineType() == TaxCalculationInputLineType.SHIPPING ||
			inputLine.getLineType() == TaxCalculationInputLineType.HANDLING) {
			var shTaxExemptCodes = input.getAdditionalFieldValue(stxSHFieldNames.TaxExemptionCodeList);
			var shTaxExemptCodesArray = [];

			if (!common.IsEmpty(shTaxExemptCodes)) {
				if (shTaxExemptCodes.indexOf('\u0005') != -1) {
					shTaxExemptCodesArray = shTaxExemptCodes.split('\u0005');
				} else {
					shTaxExemptCodesArray = shTaxExemptCodes.split(',');
				}
			}
			
			for (var j = 0; j < shTaxExemptCodesArray.length; j++) {
				taxExemptCodeList.push(currentLookup.GetExemptionCodeValue(shTaxExemptCodesArray[j]) || 
					currentLookup.GetExemptionCodeValue(sureTaxConfig.sh_default_values.taxexempt));
			}

			return {
				TaxIncludedCode: currentLookup.GetTaxIncludedCode(input.getAdditionalFieldValue(stxSHFieldNames.TaxIncludedCode)) ||
					currentLookup.GetTaxIncludedCode(sureTaxConfig.sh_default_values.taxincl),
				UnitType: currentLookup.GetUnitTypeCode(input.getAdditionalFieldValue(stxSHFieldNames.UnitType)) ||
					currentLookup.GetUnitTypeCode(sureTaxConfig.sh_default_values.unittype),
				TaxSitusRule: currentLookup.GetTaxSitusRule(input.getAdditionalFieldValue(stxSHFieldNames.TaxSitusRule)) ||
					currentLookup.GetTaxSitusRule(sureTaxConfig.sh_default_values.taxsitus),
				TransTypeCode: GetTransTypeCode(inputLine, currentLookup, input) ||
					currentLookup.GetTransactionTypeCode(sureTaxConfig.sh_default_values.transtype),
				SalesTypeCode: currentLookup.GetCustomerTypeValue(input.getAdditionalFieldValue(stxSHFieldNames.SalesTypeCode)) ||
					currentLookup.GetCustomerTypeValue(sureTaxConfig.sh_default_values.salestype),
				RegulatoryCode: currentLookup.GetRegulatoryTypeCode(input.getAdditionalFieldValue(stxSHFieldNames.RegulatoryCode)) ||
					currentLookup.GetRegulatoryTypeCode(sureTaxConfig.sh_default_values.regtype),
				BillingZipCode: '',
				BillingZipCodeExt: '',
				SecondaryZipCode: '',
				SecondaryZipCodeExt: '',
				TaxExemptionCodeList: taxExemptCodeList,
				TaxExemptionReason: currentLookup.GetExemptionReasonValue(input.getAdditionalFieldValue(stxSHFieldNames.TaxExemptReason)) ||
					currentLookup.GetExemptionReasonValue(sureTaxConfig.sh_default_values.exemptreason)
			};
		} else {
			// If tax exemption code multiple field isn't empty, create a list of exemption codes.
			var taxExemptMulti = inputLine.getAdditionalFieldValue(stxColumnNames.TaxExemptionCodeMulti);
			taxExemptCodeList = [currentLookup.GetExemptionCodeValue(inputLine.getAdditionalFieldValue(stxColumnNames.TaxExemptionCodeList)) ||
				currentLookup.GetExemptionCodeValue(sureTaxConfig.default_ecom_values.taxexempt)
			];

			if (!common.IsEmpty(taxExemptMulti)) {
				// Split the , separated string.
				var taxExemptCodes = taxExemptMulti.split(',');
				taxExemptCodeList = [];

				for (var i = 0; i < taxExemptCodes.length; i++) {
					taxExemptCodeList.push(taxExemptCodes[i]);	
				}
			}

			return {
				TaxIncludedCode: currentLookup.GetTaxIncludedCode(inputLine.getAdditionalFieldValue(stxColumnNames.TaxIncludedCode)) ||
					currentLookup.GetTaxIncludedCode(sureTaxConfig.default_ecom_values.taxincl),
				UnitType: currentLookup.GetUnitTypeCode(inputLine.getAdditionalFieldValue(stxColumnNames.UnitType)) ||
					currentLookup.GetUnitTypeCode(sureTaxConfig.default_ecom_values.unittype),
				TaxSitusRule: currentLookup.GetTaxSitusRule(inputLine.getAdditionalFieldValue(stxColumnNames.TaxSitusRule)) ||
					currentLookup.GetTaxSitusRule(sureTaxConfig.default_ecom_values.taxsitus),
				TransTypeCode: GetTransTypeCode(inputLine, currentLookup, input) ||
					currentLookup.GetTransactionTypeCode(sureTaxConfig.default_ecom_values.transtype),
				SalesTypeCode: currentLookup.GetCustomerTypeValue(inputLine.getAdditionalFieldValue(stxColumnNames.SalesTypeCode)) ||
					currentLookup.GetCustomerTypeValue(sureTaxConfig.default_ecom_values.salestype),
				RegulatoryCode: currentLookup.GetRegulatoryTypeCode(inputLine.getAdditionalFieldValue(stxColumnNames.RegulatoryCode)) ||
					currentLookup.GetRegulatoryTypeCode(sureTaxConfig.default_ecom_values.regtype),
				BillingZipCode: inputLine.getAdditionalFieldValue(stxColumnNames.BillingZipCode),
				BillingZipCodeExt: inputLine.getAdditionalFieldValue(stxColumnNames.BillingZipCodeExt),
				SecondaryZipCode: inputLine.getAdditionalFieldValue(stxColumnNames.SecondaryZipCode),
				SecondaryZipCodeExt: inputLine.getAdditionalFieldValue(stxColumnNames.SecondaryZipCodeExt),
				TaxExemptionCodeList: taxExemptCodeList,
				TaxExemptionReason: currentLookup.GetExemptionReasonValue(inputLine.getAdditionalFieldValue(stxColumnNames.TaxExemptionReason)) ||
					currentLookup.GetExemptionReasonValue(sureTaxConfig.default_ecom_values.exemptreason)
			};
		}
	}

	/**
	 * Gets the transaction type code for the given line.
	 * 
	 * @function GetTransTypeCode
	 * @memberof! CCH_SureTax_gather
	 * @param {Object} inputLine Line to get trans type code for
	 * @param {Object} currentLookup Lookup used to get trans type code value
	 * @param {Object} input SuiteTax input
	 * @returns {String} Returns the transaction type code for the line.
	 */
	function GetTransTypeCode(inputLine, sureTaxLookup, input) {
		var currentLookup = sureTaxLookup;

		if (currentLookup == undefined) {
			currentLookup = common;
		}

		if (!common.ConvertCheckboxToBoolean(sureTaxConfig.settings.sendsku)) {
			var transTypeId = -1;

			if (inputLine.getLineType() == TaxCalculationInputLineType.SHIPPING) {
				transTypeId = input.getAdditionalFieldValue(stxSHFieldNames.ShipTransTypeCode);
			} else if (inputLine.getLineType() == TaxCalculationInputLineType.HANDLING) {
				transTypeId = input.getAdditionalFieldValue(stxSHFieldNames.HandTransTypeCode);
			} else {
				transTypeId = inputLine.getAdditionalFieldValue(stxColumnNames.TransTypeCode);
			}

			return currentLookup.GetTransactionTypeCode(transTypeId);
		} else {
			// Default that is sent is SKU.
			var sku = '';

			if (inputLine.getLineType() == TaxCalculationInputLineType.SHIPPING ||
				inputLine.getLineType() == TaxCalculationInputLineType.HANDLING) {
				sku = input.getAdditionalFieldValue('shipmethod');
			} else if (inputLine.getLineType() == TaxCalculationInputLineType.EXPENSE) {
				sku = 'E' + inputLine.getAdditionalFieldValue('category');
			} else if (inputLine.getLineType() == TaxCalculationInputLineType.ITEM) {
				sku = inputLine.getAdditionalFieldValue('item');
			}

			return sku;
		}
	}

	/**
	 * Object holding information about an existing billing period.
	 * 
	 * @typedef BillingPeriodInfo
	 * @property {Date} StartDate Date the billing period starts
	 * @property {Date} EndDate Date the billing period ends
	 * @property {Integer} DaysInPeriod Number of days in the billing period.
	 */

	/**
	 * Gets the information the module needs on the billing period (posting period).
	 * 
	 * @function GetBillingPeriodInfo
	 * @memberof! CCH_SureTax_gather
	 * @param {Object} input SuiteTax input object
	 * @returns {BillingPeriodInfo} JSON object containing the pertinent period information.
	 */
	function GetBillingPeriodInfo(input) {
		var ret = {
			StartDate: new Date(),
			EndDate: new Date(),
			DaysInPeriod: 30
		};

		if (input.isPostingTransaction()) {
			// Record is a posting transaction.
			var postStartDate = input.getPostingPeriodStartDate();
			var postEndDate = input.getPostingPeriodEndDate();

			ret.StartDate = new Date(postStartDate.getYear(), postStartDate.getMonth(), postStartDate.getDay());
			ret.EndDate = new Date(postEndDate.getYear(), postEndDate.getMonth(), postEndDate.getDay());

			if ((ret.StartDate === null && ret.StartDate !== '') || (ret.EndDate === null && ret.EndDate === '')) {
				ret.StartDate = new Date(today.getYear(), today.getMonth(), today.getDay());
				ret.EndDate = new Date(today.getYear(), today.getMonth(), today.getDay());
			}

			// Calculate number of days in period.
			var startDate = new Date(ret.StartDate);
			var endDate = new Date(ret.EndDate);
			var oneDay = 24 * 60 * 60 * 1000;

			ret.DaysInPeriod = Math.round(Math.abs((endDate.getTime() - startDate.getTime()) / oneDay));
		}

		return ret;
	}

	/**
	 * Initalizes the lookups for the SureTax fields.
	 * 
	 * @function InitLookups
	 * @memberof! CCH_SureTax_gather
	 * @param {Object} Input SuiteTax input object
	 */
	function InitLookups(input) {
		// Add keys to the lookups.
		lookup.Initialize();

		var tranType = input.getRecordType();
		var lines = input.getLines();

		// Add the values from the lines to the lookup.
		for (var i = 0; i < lines.length; i++) {
			var curInputLine = lines[i];

			if (common.ConvertCheckboxToBoolean(getEnableForLine(input, curInputLine)) &&
				(sendToSureTax(input, curInputLine) || (isPurchase && (tranType == 'vendorbill' || tranType == 'vendorcredit')))) {
				// Add the SureTax field values to the lookup.

				if (curInputLine.getLineType() == TaxCalculationInputLineType.SHIPPING ||
					curInputLine.getLineType() == TaxCalculationInputLineType.HANDLING) {
					lookup.AddTaxIncludeCodeKey(input.getAdditionalFieldValue(stxSHFieldNames.TaxIncludedCode));
					lookup.AddUnitTypeKey(input.getAdditionalFieldValue(stxSHFieldNames.UnitType));
					lookup.AddTaxSitusRuleKey(input.getAdditionalFieldValue(stxSHFieldNames.TaxSitusRule));
					lookup.AddCustomerTypeValueKey(input.getAdditionalFieldValue(stxSHFieldNames.SalesTypeCode));
					lookup.AddRegulatoryTypeCodeKey(input.getAdditionalFieldValue(stxSHFieldNames.RegulatoryCode));
					lookup.AddExemptionReasonValueKey(input.getAdditionalFieldValue(stxSHFieldNames.TaxExemptReason));
					
					var shTaxExemptCodes = input.getAdditionalFieldValue(stxSHFieldNames.TaxExemptionCodeList);
					var shTaxExemptCodesArray = [];

					if (!common.IsEmpty(shTaxExemptCodes)) {
						if (shTaxExemptCodes.indexOf('\u0005') != -1) {
							shTaxExemptCodesArray = shTaxExemptCodes.split('\u0005');
						} else {
							shTaxExemptCodesArray = shTaxExemptCodes.split(',');
						}
					}

					for (var j = 0; j < shTaxExemptCodesArray.length; j++) {
						lookup.AddExemptionCodeValueKey(shTaxExemptCodesArray[j]);
					}

					lookup.AddTransactionTypeKey(input.getAdditionalFieldValue(stxSHFieldNames.ShipTransTypeCode));
					lookup.AddTransactionTypeKey(input.getAdditionalFieldValue(stxSHFieldNames.HandTransTypeCode));
				}

				lookup.AddTaxIncludeCodeKey(curInputLine.getAdditionalFieldValue(stxColumnNames.TaxIncludedCode));
				lookup.AddUnitTypeKey(curInputLine.getAdditionalFieldValue(stxColumnNames.UnitType));
				lookup.AddTaxSitusRuleKey(curInputLine.getAdditionalFieldValue(stxColumnNames.TaxSitusRule));
				lookup.AddCustomerTypeValueKey(curInputLine.getAdditionalFieldValue(stxColumnNames.SalesTypeCode));
				lookup.AddRegulatoryTypeCodeKey(curInputLine.getAdditionalFieldValue(stxColumnNames.RegulatoryCode));
				lookup.AddExemptionCodeValueKey(curInputLine.getAdditionalFieldValue(stxColumnNames.TaxExemptionCodeList));
				lookup.AddExemptionReasonValueKey(curInputLine.getAdditionalFieldValue(stxColumnNames.TaxExemptionReason));
				lookup.AddTransactionTypeKey(curInputLine.getAdditionalFieldValue(stxColumnNames.TransTypeCode));
			}
		}

		// Add the values from the basic configuration to the lookup.
		lookup.AddTaxIncludeCodeKey(sureTaxConfig.default_ecom_values.taxincl);
		lookup.AddUnitTypeKey(sureTaxConfig.default_ecom_values.unittype);
		lookup.AddTaxSitusRuleKey(sureTaxConfig.default_ecom_values.taxsitus);
		lookup.AddCustomerTypeValueKey(sureTaxConfig.default_ecom_values.salestype);
		lookup.AddRegulatoryTypeCodeKey(sureTaxConfig.default_ecom_values.regtype);
		lookup.AddExemptionCodeValueKey(sureTaxConfig.default_ecom_values.taxexempt);
		lookup.AddExemptionReasonValueKey(sureTaxConfig.default_ecom_values.exemptreason);
		lookup.AddTransactionTypeKey(sureTaxConfig.default_ecom_values.transtype);

		// Process the lookups.
		lookup.ProcessLookups();
	}

	/**
	 * Data structure for storing the data exchange parameters.
	 */
	function SureTaxDataExchangeParameters() {
		this.parms = [];

		this.add = function (lineType, parameter, fieldName) {
			if (this.parms == null) {
				this.parms = [];
			}

			this.parms.push({
				LineType: lineType,
				Parameter: parameter,
				FieldName: fieldName
			});
		};

		this.getByLineType = function (lineType) {
			var retArray = [];
			for (var i = 0; i < this.parms.length; i++) {
				if (this.parms[i].LineType === lineType) {
					retArray.push(this.parms[i]);
				}
			}

			return retArray;
		};
	}

	return {
		createCalcRequest: createCalcRequest,
		createCancelRequest: createCancelRequest
	};
}
