/**
 * A compilation of methods used update the tax in NetSuite (with SuiteTax plugin).
 * 
 * @version 1.0.20180705
 * @copyright CCH Incorporated 2018&copy;
 * @namespace CCH_SureTax_taxObjUtility
 */
function taxObjUtil() {
	var common = new SureTaxCommonModule();
	var taxCodeMappingMap = new SureTaxMap();
	var subVal = null;
    var taxTypeArr = [];

	/**
	 * Updates the tax amount in NetSuite.
	 * 
	 * @function updateTax
	 * @memberof! CCH_SureTax_taxObjUtility
	 * @param {Object} response Response from SureTax
	 * @param {Object} output Output object from the SuiteTax API
	 * @param {Object} input Input object from the SuiteTax API
	 */
	function updateTax(response, output, input, notifications, stxRequest) {
		var taxAmountMap = new SureTaxMap();
		var outputLinesMap = new SureTaxMap();
		var stateCountry = {
			State: '',
			Country: (input.getShipToAddress() != null) ? input.getShipToAddress().getCountry() : ''
		};

		var taxIncludedCodeNo = common.GetTaxIncludedCodeId('0');
		var inputLines = input.getLines();
		subVal = (common.isSubsidiaryEnable()) ? input.getSubsidiary() : null;

		var isPurchasingTrans = common.IsPurchaseTransaction(input.getRecordType());

		// Loop through the lines.
		for (var i = 0; i < response.GroupList.length; i++) {
			var curGroup = response.GroupList[i];

			var lineRef = findLineRefByLineNumber(inputLines, parseInt(curGroup.LineNumber));
			var lineNumber = parseInt(curGroup.LineNumber) - 1;
			var line = inputLines[lineNumber];
			var taxIncludedCode = '';

			if (isPurchasingTrans) {
				taxIncludedCode = line.getAdditionalFieldValue('custcol_suretax_taxincludedcode_ap');
			} else {
				if (line.getLineType() == 'HANDLING' || line.getLineType() == 'SHIPPING') {
					taxIncludedCode = input.getAdditionalFieldValue('custbody_suretax_sh_taxincludedcode');
				} else {
					taxIncludedCode = line.getAdditionalFieldValue('custcol_suretax_taxincludedcode');
				}
			}

			if (common.IsEmpty(taxIncludedCode)) {
				// No tax included code on the line, so default to no.
				taxIncludedCode = taxIncludedCodeNo;
			}

			if (lineRef != null) {
				// Get the state and country for the line.
				var taxCodeMap = new SureTaxMap();
				stateCountry = getStateCountryWithPipe(curGroup.StateCode);
				//if the amount is negative
				var isNegativeLine = 1;

				if (getLineAmount(line) < 0)
					isNegativeLine = -1;

              	// Add tax details in NS for all the details returned from SureTax.
				for (var j = 0; j < curGroup.TaxList.length; j++) {
					var curTaxDet = curGroup.TaxList[j];
					var taxTypeCode = getTaxTypeCode(curTaxDet, isPurchasingTrans);
					var taxCodeMapping = getTaxCodeMapping(stateCountry.State, stateCountry.Country, taxTypeCode, subVal, taxIncludedCode, notifications, line.getLineType());

					taxCodeMap.updateTaxCodeMap({
						TaxCode: taxCodeMapping.TaxCode,
						TaxType: taxCodeMapping.TaxType,
						TaxRate: parseFloat(curTaxDet.TaxRate),
						TaxAmount:  Math.abs(parseFloat(curTaxDet.TaxAmount)) * isNegativeLine,
						Revenue: Math.abs(curTaxDet.Revenue).toString() * isNegativeLine,
						TaxTypeDesc: curTaxDet.TaxTypeDesc
					});

					// Update the total tax amount in the map.
                    taxAmountMap.updateTaxAmountMap(taxCodeMapping.TaxType, taxCodeMapping.TaxCode, isNegativeLine * Math.abs(parseFloat(curTaxDet.TaxAmount)));
				}

				outputLinesMap.updateOutputLinesMap(curGroup.LineNumber, taxCodeMap);
			}
		}

		// Update the nexus for the country.
		updateNexus(stateCountry.Country, output);

		// Update the tax details from the map.
		updateTaxDetailLines(outputLinesMap, output, inputLines);

		// Update the summary for the tax mappings.
		updateTaxSummaryLines(taxAmountMap, output);
		//remove duplicates
		taxTypeArr = taxTypeArr.reduce(function (a, b) { if (a.indexOf(b) < 0) a.push(b); return a; }, []);
		//get the unique taxtypes as string
		var tts = '';
		for (var i = 0; i < taxTypeArr.length; i++) {
			tts = (tts == '') ? tts + taxTypeArr[i] : tts + ', ' + taxTypeArr[i];
		}
		if (tts != '') {
			notifications.addWarning('Missing mapping record for the SureTax TaxType(s) ' + tts + '. These tax lines are grouped into the default mapping.');
			notifications.addWarning('Click on CCH® SureTax® -> Configuration -> Tax Object Setup or Custom Tax Codes to create the missing mapping.');
			var NSTransID = null;
			//set the NStransactionid only if it is an existing transaction
			if (isExistingTransaction(input.getTransactionId())) {
				//existing trans internalid
				NSTransID = input.getTransactionId();
			}
			// Create call log.
			var callLogRecId = common.NewSureTaxMapErrLog({
				Method: 'PostRequest',
				HeaderMessage: 'Failure - With Mapping Error warning.',
				ErrorMessage: 'Missing mapping record(s)',
				ItemMessage: response.ItemMessages,
				ResponseCode: 'Failure',
				Successful: false,
				TransactionId: response.TransId,
				Request: JSON.stringify(stxRequest),
				Response: JSON.stringify(response),
				NSTransaction: NSTransID
			});
		}
	}

	/**
	 * Returns true if it an existing transaction, false for new transaction.
	 * 
	 * @function isExistingTransaction
	 * @param {Integer} recId Record Id to get the type for.
	 * @returns {boolean} Returns true if it an existing transaction, false for new transaction.
	 */
	function isExistingTransaction(recId) {

		if (!common.IsEmpty(recId)) {
			var columns = [];
			columns[0] = new nlobjSearchColumn('internalid');

			var filterExp = [
				['internalid', 'is', recId]
			];

			var searchObj = nlapiCreateSearch('transaction', filterExp, columns);
			var searchResult = searchObj.runSearch().getResults(0, 1);

			return (searchResult.length > 0) ? true : false;
		}
		return false;
	}
	
	/**
	 * Gets the tax type code for the given tax detail.
	 * 
	 * @function getTaxTypeCode
	 * @memberof! CCH_SureTax_taxObjUtility
	 * @param {Object} taxDet Tax detail to get tax type code for.
	 * @param {Boolean} isPurch True if this is a purchase transaction, false if it isn't.
	 */
	function getTaxTypeCode(taxDet, isPurch) {
		var taxTypeCode = taxDet.TaxTypeCode.substring(1, 3);
		
		return (!isPurch) ? taxTypeCode.replace("U", "0") : taxTypeCode;
	}

	/**
	 * Country/state pair
	 * @typedef StateCountry
	 * @property State State of the country
	 * @property Country Country
	 */

	/**
	 * Get the state and country from the state code returned from SureTax.
	 * 
	 * @function getStateCountryWithPipe
	 * @memberof! CCH_SureTax_taxObjUtility
	 * @param {String} stateCode State code value that came from SureTax.
	 * @returns {StateCountry} Returns object that contains the country and state for the group.
	 */
	function getStateCountryWithPipe(stateCode) {
		var splitObj = stateCode.split('|');
		var country = splitObj[1].substring(0, 2);

		return {
			State: (country != 'US' && country != 'CA') ? '' : splitObj[0],
			Country: country
		};
	}

	/**
	 * Finds the line reference for the given line number.
	 * 
	 * @function findLineRefByLineNumber
	 * @memberof! CCH_SureTax_taxObjUtility
	 * @param {Array} lines Lines to search in
	 * @param {Integer} lineNumber Line number to search for
	 * @returns {Object} Returns the NS line reference object.
	 */
	function findLineRefByLineNumber(lines, lineNumber) {
		return lines[lineNumber - 1].getReference();
	}

	/**
	 * NetSuite tax type/tax code pair
	 * @typedef TaxTypeCodePair
	 * @property TaxType Internal id of the NS tax type
	 * @property TaxCode Internal id of the NS tax code
	 */

	/**
	 * Gets the tax code and tax type for the given configuration.
	 * 
	 * @function getTaxCodeMapping
	 * @memberof! CCH_SureTax_taxObjUtility
	 * @param {String} state State that tax was applied in
	 * @param {String} country Country that tax was applied in
	 * @param {String} taxType SureTax Tax Type for the tax.
	 * @param {Integer} subVal Subsidiary to get the tax code for.
	 * @returns {TaxTypeCodePair} Returns object that contains the NS tax type id and NS tax code id to put the tax into.
	 */
	function getTaxCodeMapping(state, country, taxType, subVal, taxIncludedCode, notifications, linetype) {
		// Check to see if the mapping is in the cache.
		var key = state + "," + country + "," + taxType + "," + taxIncludedCode;
		var ret = taxCodeMappingMap.get(key);

		if (ret == null) {
			var filters = [];
			filters[0] = new nlobjSearchFilter('custrecord_stx_tcmapping_stxtaxtype', null, 'is', taxType);
			filters[1] = new nlobjSearchFilter('custrecord_stx_tcmapping_country', null, 'is', country);
			filters[2] = new nlobjSearchFilter('custrecord_stx_tcmapping_tinccode', null, 'is', taxIncludedCode);

			if (subVal != null) {
				filters.push(new nlobjSearchFilter('custrecord_stx_tcmapping_subsidiary', null, 'is', subVal));
			}

			if (!common.IsEmpty(state)) {
				filters.push(new nlobjSearchFilter('custrecord_stx_tcmapping_state', null, 'is', state));
			}

			var columns = [];
			columns[0] = new nlobjSearchColumn('custrecord_stx_tcmapping_taxcode');

			var results = nlapiSearchRecord('customrecord_stx_tax_code_mapping', null, filters, columns);

			ret = {
				TaxType: -1,
				TaxCode: -1
			};

			var taxtype = '';
			var taxTypeID = -1;

			if (results != null && results.length > 0) {
				ret.TaxCode = results[0].getValue('custrecord_stx_tcmapping_taxcode');

				// Look up the tax type id for the tax code.
				taxtype = getTaxTypeValue(ret.TaxCode);
				taxTypeID = getTaxTypeID(taxtype);
				ret.TaxType = taxTypeID;
			} else {
				var basicConfig = common.LoadConfiguration(subVal);
				if(basicConfig.default_ecom_values.groupliketaxes == 'T' && basicConfig.industry.Telecom == 'T')
				{
                    taxTypeArr.push(taxType)
				} 
				// Use the default tax code.
				filters = [];
				filters[0] = new nlobjSearchFilter('custrecord_stx_tcmapping_country', null, 'is', country);
				filters[1] = new nlobjSearchFilter('custrecord_stx_tcmapping_default', null, 'is', 'T');
				filters[2] = new nlobjSearchFilter('custrecord_stx_tcmapping_tinccode', null, 'is', taxIncludedCode);

				if (subVal != null) {
					filters.push(new nlobjSearchFilter('custrecord_stx_tcmapping_subsidiary', null, 'is', subVal));
				}

				if (!common.IsEmpty(state)) {
					filters.push(new nlobjSearchFilter('custrecord_stx_tcmapping_state', null, 'is', state));
				}

				columns = [];
				columns[0] = new nlobjSearchColumn('custrecord_stx_tcmapping_taxcode');

				results = nlapiSearchRecord('customrecord_stx_tax_code_mapping', null, filters, columns);

				if (results != null && results.length > 0) {
					ret.TaxCode = results[0].getValue('custrecord_stx_tcmapping_taxcode');

					// Look up the tax type id for the tax code.
					taxtype = getTaxTypeValue(ret.TaxCode);
					taxTypeID = getTaxTypeID(taxtype);
					ret.TaxType = taxTypeID;
				}
			}

			taxCodeMappingMap.set(key, ret);
		}

		return ret;
	}

	/**
	 * Gets the amount for the given line, taking discounts into effect.
	 * 
	 * @function getLineAmount
	 * @param {Object} inputLine Line to get amount for
	 * @param {Float} Returns the amount for the line, with discounts included.
	 */
	function getLineAmount(inputLine) {
		var ret = parseFloat(inputLine.getAmount()) + parseFloat(inputLine.getDiscountsTotal());
		return ret;
	}

	/**
	 * Get the tax type name.
	 * 
	 * @function getTaxTypeValue
	 * @memberof! CCH_SureTax_taxObjUtility
	 * @param {Integer} recID Tax type internal id to get value for
	 * @returns {String} Returns the tax type value for the given record id..
	 */
	function getTaxTypeValue(recID) {
		var filters = [];
		filters[0] = new nlobjSearchFilter('internalid', null, 'is', recID);

		var columns = [];
		columns[0] = new nlobjSearchColumn('name');

		var results = nlapiSearchRecord('salestaxitem', null, filters, columns);

		if (results != null && results.length > 0) {
			return results[0].getValue('name');
		} else {
			return null;
		}
	}

	/**
	 * Get the tax type internal id.
	 * 
	 * @function getTaxTypeID
	 * @memberof! CCH_SureTax_taxObjUtility
	 * @param {String} taxType Tax type to get internal id for
	 * @returns {Integer} Returns the internal id for the given tax type name.
	 */
	function getTaxTypeID(taxType) {
		var filters = [];
		filters[0] = new nlobjSearchFilter('name', null, 'is', taxType);

		var columns = [];
		columns[0] = new nlobjSearchColumn('internalid');

		var results = nlapiSearchRecord('taxtype', null, filters, columns);

		if (results != null && results.length > 0) {
			return results[0].getValue('internalid');
		} else {
			return null;
		}
	}

	/**
	 * Gets the first tax code
	 * 
	 * @function getFirstTaxCodeForNexus
	 * @memberof! CCH_SureTax_taxObjUtility
	 * @param {Integer} nexus Nexus to get first tax code for
	 * @returns {TaxTypeCodePair} Returns the internal id of the first tax code for the nexus. If there isn't one, -1 is returned.
	 */
	function getFirstTaxCodeForNexus(nexus) {
		var ret = {
			TaxType: -1,
			TaxCode: -1
		};

		var filters = [];
		filters[0] = new nlobjSearchFilter('nexus', 'taxtype', 'anyof', nexus);

		var columns = [];
		columns[0] = new nlobjSearchColumn('internalid');
		columns[1] = new nlobjSearchColumn('internalid', 'taxtype');

		var results = nlapiSearchRecord('salestaxitem', null, filters, columns);

		if (results != null && results.length > 0) {
			ret.TaxCode = results[0].getValue('internalid');
			ret.TaxType = results[0].getValue('internalid', 'taxtype');
		}

		return ret;
	}

	/**
	 * Updates the tax summary lines.
	 * 
	 * @function updateTaxSummaryLines
	 * @memberof! CCH_SureTax_taxObjUtility
	 * @param {SureTaxMapObj} taxMap Map containing the containing the tax amounts
	 * @param {Object} output Output object to write to
	 */
	function updateTaxSummaryLines(taxMap, output) {
		for (var i = 0; i < taxMap.Items.length; i++) {
			var curItem = taxMap.Items[i].Value;

			output.setTaxSummaryLine(curItem.TaxCode, curItem.TaxType, common.RoundNumber(curItem.TotalTax, 2).toString());
		}
	}

	/**
	 * Updates the tax detail lines.
	 * 
	 * @function updateTaxDetailLines
	 * @memberof! CCH_SureTax_taxObjUtility
	 * @param {SureTaxMapObj} taxMap Map containing the tax code amounts.
	 * @param {Object} output Output to write details to
	 * @param {Array} inputLines Transaction lines to write tax for
	 */
	function updateTaxDetailLines(taxMap, output, inputLines) {
		for (var i = 0; i < taxMap.Items.length; i++) {
			var curArray = taxMap.Items[i].Value;
			var outLine = output.createLine(findLineRefByLineNumber(inputLines, parseInt(taxMap.Items[i].Key)));

			for (var j = 0; j < curArray.length; j++) {
				var curItem = curArray[j];

				outLine.addTaxDetail(curItem.TaxCode, curItem.TaxType, common.RoundNumber(curItem.TaxRate * 100, 5),
					common.RoundNumber(curItem.TaxAmount, 2).toString(), curItem.Revenue, curItem.TaxTypeDesc);
			}

			output.addLine(outLine);
		}
	}

	/**
	 * Get the nexus with the given country code that is related to SureTax.
	 * 
	 * @function updateNexus
	 * @memberof! CCH_SureTax_taxObjUtility
	 * @param {Integer} country Country to update nexus for
	 * @param {Output} output Output to update nexus on
	 */
	function updateNexus(country, output) {
		if (!common.IsEmpty(country)) {
			var filters = [];
			filters[0] = new nlobjSearchFilter('country', null, 'is', country);
			filters[1] = new nlobjSearchFilter('description', null, 'contains', 'CCH\u00AE SureTax\u00AE');

			var columns = [];
			columns[0] = new nlobjSearchColumn('internalid');

			var results = nlapiSearchRecord('nexus', null, filters, columns);

			if (results != null && results.length > 0) {
				output.overrideNexus(parseInt(results[0].getValue('internalid')));
			}
		}
	}

	/**
	 * If SureTax didn't have a result for a line, fill in the default tax code for each line.
	 * 
	 * @function fillInTaxDetails
	 * @memberof! CCH_SureTax_taxObjUtility
	 * @param {Object} input Input lines to search through
	 * @param {Object} output Output lines to search through.
	 */
	function fillInTaxDetails(input, output) {
		var inputLines = input.getLines();
		var shipAddr = input.getShipToAddress();
		var taxIncludedCodeNo = common.GetTaxIncludedCodeId('0');

		var isPurchasingTrans = common.IsPurchaseTransaction(input.getRecordType());

		if (subVal == null) {
			subVal = (common.isSubsidiaryEnable()) ? input.getSubsidiary() : null;
		}

		// Update the nexus for the country.
		if (shipAddr != null) {
			updateNexus(shipAddr.getCountry(), output);
		}
		
		// Check to make sure each input lines, at least have one tax detail in the output.
		for (var i = 0; i < inputLines.length; i++) {
			var curInputLine = inputLines[i];

			var taxIncludedCode = '';
			if (isPurchasingTrans) {
				taxIncludedCode = curInputLine.getAdditionalFieldValue('custcol_suretax_taxincludedcode_ap');
			} else if (curInputLine.getLineType() == 'HANDLING' || curInputLine.getLineType() == 'SHIPPING') {
				taxIncludedCode = input.getAdditionalFieldValue('custbody_suretax_sh_taxincludedcode');
			} else {
				taxIncludedCode = curInputLine.getAdditionalFieldValue('custcol_suretax_taxincludedcode');
			}

			if (common.IsEmpty(taxIncludedCode)) {
				// No tax included code on the line, so default to no.
				taxIncludedCode = taxIncludedCodeNo;
			}

			if (!checkOutputLinesForInputLine(curInputLine.getReference().getLineKey(), output.getLines())) {
				// Line doesn't already exist, so add one for the detail one.
				var outLine = output.createLine(curInputLine.getReference());
				var taxCodeMapping = {};

				if (shipAddr != null) {
					var country = shipAddr.getCountry();
					var state = (country != 'US' && country != 'CA') ? '' : shipAddr.getState();
					taxCodeMapping = getTaxCodeMapping(state, country, '', subVal, taxIncludedCode);
				} else {
					taxCodeMapping = getFirstTaxCodeForNexus(input.getNexus());
				}

				outLine.addTaxDetail(taxCodeMapping.TaxCode, taxCodeMapping.TaxType, 0,
					0, curInputLine.getAmount(), '');

				output.addLine(outLine);

				updateTaxSummaryLineForBlank(output, taxCodeMapping);
			}
		}
	}

	/**
	 * Updates/adds tax summary line for the empty tax code.
	 * 
	 * @function updateTaxSummaryLineForBlank
	 * @memberof! CCH_SureTax_taxObjUtility
	 * @param {Object} output SuiteTax output object to get details from
	 * @param {Object} taxCodeMapping Tax code info to add/update
	 */
	function updateTaxSummaryLineForBlank(output, taxCodeMapping) {
		var taxSumLines = output.getTaxSummaryLines();
		var exists = false;

		// See if the summary line already exists.
		for (var i = 0; i < taxSumLines.length; i++) {
			var curTaxSumLine = taxSumLines[i];

			if (curTaxSumLine.getTaxCode() == taxCodeMapping.TaxCode) {
				exists = true;
				break;
			}
		}

		if (!exists) {
			// It doesn't exist, so add a new one.
			output.setTaxSummaryLine(taxCodeMapping.TaxCode, taxCodeMapping.TaxType, "0.00");
		}
	}

	/**
	 * Checks to see if the output lines has a line for the given input line.
	 * 
	 * @function checkOutputLinesForInputLine
	 * @memberof! CCH_SureTax_taxObjUtility
	 * @param {String} inputKey Input line reference to check for
	 * @param {Array} outputLines Output lines to search through.
	 * @returns {Boolean} Returns true if the output lines has a line for the given input line, and it has at least one detail line. Otherwise returns false.
	 */
	function checkOutputLinesForInputLine(inputKey, outputLines) {
		var outLine = getOutputLineForInputLine(inputKey, outputLines);

		return (outLine != null) ? (outLine.getTaxDetails().length >= 1) : false;
	}

	/**
	 * Gets the output line associated with the given input line.
	 * 
	 * @function getOutputLineForInputLine
	 * @memberof! CCH_SureTax_taxObjUtility
	 * @param {String} inputKey Input line reference to search for
	 * @param {Array} outputLines Output lines to search through.
	 * @returns {Object} Returns the output line assoicated with the given input line, if it exists. Otherwise returns null.
	 */
	function getOutputLineForInputLine(inputKey, outputLines) {
		for (var i = 0; i < outputLines.length; i++) {
			if (outputLines[i].getInputLineReference().getLineKey() == inputKey) {
				return outputLines[i];
			}
		}

		return null;
	}

	/**
	 * Javascript Map with key value pairs.
	 * 
	 * @namespace SureTaxMapObj
	 */
	function SureTaxMap() {
		this.Items = [];

		/**
		 * Gets the value from the map for the given key.
		 * 
		 * @function get
		 * @memberof! SureTaxMapObj
		 * @param {Object} key Key to look for in the map
		 */
		this.get = function (key) {
			for (var i = 0; i < this.Items.length; i++) {
				if (this.Items[i].Key == key) {
					return this.Items[i].Value;
				}
			}

			return null;
		};

		/**
		 * Adds a key/value pair to the map.
		 * 
		 * @function set
		 * @memberof! SureTaxMapObj
		 * @param key Key to add to the map
		 * @param value Value to add to the map
		 */
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

		/**
		 * Updates the tax amount for the given tax type and tax code.
		 * 
		 * @function updateTaxAmountMap
		 * @memberof! SureTaxMapObj
		 * @param {Integer} taxType Tax type to add amount to
		 * @param {Integer} taxCode Tax code to add amount to
		 * @param {Decimal} amountToAdd Amount to add to the tax type/tax code.
		 */
		this.updateTaxAmountMap = function (taxType, taxCode, amountToAdd) {
			var existingItem = this.get(taxType);

			if (existingItem == null) {
				// Item doesn't exist, so add it.
				this.set(taxType, {
					TaxType: taxType,
					TaxCode: taxCode,
					TotalTax: amountToAdd
				});
			} else {
				// Item exists, so add the amount to it.
				existingItem.TotalTax += amountToAdd;
				this.set(taxType, existingItem);
			}
		};

		/**
		 * Updates the tax code value with the given object.
		 * 
		 * @function updateTaxCodeMap
		 * @memberof! SureTaxMapObj
		 * @param {Object} objectToUpdate Object to add to the map.
		 */
		this.updateTaxCodeMap = function (objectToUpdate) {
			var existingItem = this.get(objectToUpdate.TaxCode);

			if (existingItem == null) {
				// Item doesn't exist, so add it.
				this.set(objectToUpdate.TaxCode, objectToUpdate);
			} else {
				// Item exists, so update the object.
				existingItem.TaxAmount += objectToUpdate.TaxAmount;
				existingItem.TaxRate += objectToUpdate.TaxRate;
				this.set(objectToUpdate.TaxCode, existingItem);
			}
		};

		/**
		 * Updates the output lines map for the given line.
		 * 
		 * @function updateOutputLinesMap
		 * @memberof! SureTaxMapObj
		 * @param {Integer} lineNum Line number to update
		 * @param {Object} taxCodeMap Tax code map to set for the line.
		 */
		this.updateOutputLinesMap = function (lineNum, taxCodeMap) {
			var existingItem = this.get(lineNum);

			if (existingItem == null) {
				this.set(lineNum, this.getArrayOfItems(taxCodeMap));
			} else {
				for (var i = 0; i < taxCodeMap.Items.length; i++) {
					var existingValue = this.getTaxCodeFromList(existingItem, taxCodeMap.Items[i].Value.TaxCode);

					if (existingValue != -1) {
						existingItem[existingValue].TaxAmount += taxCodeMap.Items[i].Value.TaxAmount;
						existingItem[existingValue].TaxRate += taxCodeMap.Items[i].Value.TaxRate;
					} else {
						existingItem.push(taxCodeMap.Items[i].Value);
					}
				}

				this.set(lineNum, existingItem);
			}
		};

		/**
		 * Gets the index of the tax code in the given list.
		 * 
		 * @function getTaxCodeFromList
		 * @memberof! SureTaxMapObj
		 * @param {Array} values Array to search in
		 * @param {Integer} taxCode Tax code to get index of
		 * @returns {Integer} Returns the index of the tax code in the array. If it doesn't exist, -1 is returned.
		 */
		this.getTaxCodeFromList = function (values, taxCode) {
			for (var i = 0; i < values.length; i++) {
				if (values[i].TaxCode == taxCode) {
					return i;
				}
			}

			return -1;
		};

		/**
		 * Gets an array of the values contained in the given map.
		 * 
		 * @function getArrayOfItems
		 * @memberof! SureTaxMapObj
		 * @param {SureTaxMapObj} map Map to get values from
		 * @returns {Array} Returns an array of the values from the given map.
		 */
		this.getArrayOfItems = function (map) {
			var ret = [];

			for (var i = 0; i < map.Items.length; i++) {
				ret.push(map.Items[i].Value);
			}

			return ret;
		};
	}

	return {
		updateTax: updateTax,
		fillInTaxDetails: fillInTaxDetails,
		updateTaxSummaryLines:updateTaxSummaryLines		
	};
}
