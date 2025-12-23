/**
 * This module is used to cache values of SureTax records.
 * 
 * @copyright CCH Incorporated 2018&copy;
 * @version 1.0.20180705
 * @namespace CCH_SureTax_lookup_v1
 */
function SureTaxLookupModule() {
	var map = {};
	var keys = {};

	var lookup = {
		'taxincludecodecode': 'customrecord_suretax_rec_taxincludedcode',
		'taxsitusrule': 'customrecord_suretax_rec_taxsitusrule',
		'taxtypecode': 'customrecord_suretax_rec_taxtypes',
		'regulatorytypecode': 'customrecord_suretax_regulatorytypecode',
		'exemptioncodevalue': 'customrecord_suretax_exemption_code',
		'customertypevalue': 'customrecord_suretax_customertypecode',
		'transactiontypecode': 'customrecord_suretax_rec_transtypecode',
		'unittypecode': 'customrecord_suretax_rec_unittypecodes',
		'taxexemptreason': 'customrecord_suretax_exempt_reason'
	};

	var columnvalue = {
		'taxincludecodecode': 'custrecord_taxincludedcode_value',
		'taxsitusrule': 'custrecord_suretax_taxsitusrule_value',
		'taxtypecode': 'name',
		'regulatorytypecode': 'custrecord_regulatorycode_value',
		'exemptioncodevalue': 'custrecord_suretax_exemption_code_value',
		'customertypevalue': 'custrecord_customertypecode_value',
		'transactiontypecode': 'custrecord_suretax_transtypecode_value',
		'unittypecode': 'custrecord_suretax_unittypecodes_value',
		'taxexemptreason': 'custrecord_suretax_exempt_reason_value'
	};
	
	/**
	 * Initalizes the cache map.
	 * 
	 * @function Initialize
	 * @memberof! CCH_SureTax_lookup_v1
	 */
	var Initialize = function() {
		for (var key in lookup) {
			map[key] = {};
		}

		for (var key2 in lookup) {
			keys[key2] = key2;
		}
	};

	/**
	 * Cleans up the cache map, setting all records to null.
	 * 
	 * @function Cleanup
	 * @memberof! CCH_SureTax_lookup_v1
	 */
	var Cleanup = function () {
		for (var key in lookup) {
			for (var lup in map[key]) {
				map[key][lup] = null;
			}
		}

		for (var key2 in lookup) {
			map[key2] = null;
		}
	};

	/**
	 * Looks up all of the SureTax record values that were specified, and adds them to the cache map.
	 * 
	 * @function ProcessLookups
	 * @memberof! CCH_SureTax_lookup_v1
	 */
	var ProcessLookups = function () {
		for (var key in lookup) {
			var csv = internalidcsv(map[key]);

			if (csv.length > 0) {
				var searchFilter = new nlobjSearchFilter('formulatext', null, 'is', 'yes');
				searchFilter.setFormula("case when {internalid} in (" + csv + ") then 'yes' else 'no' end");

				var filters = [searchFilter];

				var columns = [];
				columns[0] = new nlobjSearchColumn('Name');
				columns[1] = new nlobjSearchColumn(columnvalue[key]);

				var search = nlapiCreateSearch(lookup[key], filters, columns);
				var searchResults = search.runSearch();

				searchResults.forEachResult(function (result) {
					map[key][result.id] = result.getValue(columnvalue[key]);
					return true;
				});
			}
		}
	};

	/**
	 * Converts the given array into a CSV string.
	 * 
	 * @function internalidcsv
	 * @memberof! CCH_SureTax_lookup_v1
	 * @param {Array} array Array to convert.
	 */
	var internalidcsv = function (array) {
		var csv = '';

		for (var key in array) {
			csv += "'" + key + "'";
			csv += ',';
		}

		if (csv.length > 0) {
			csv = csv.substr(0, csv.length - 1);
		}

		return csv;
	};

	/**
	 * Add a tax included code internal id to the map.
	 * 
	 * @function AddTaxIncludeCodeKey
	 * @memberof! CCH_SureTax_lookup_v1
	 * @param {Integer} internalid Tax included code internal id to add
	 */
	var AddTaxIncludeCodeKey = function (internalid) {
		if (internalid != undefined) {
			map[keys.taxincludecodecode][internalid] = null;
		}
	};

	/**
	 * Add a tax situs rule internal id to the map.
	 * 
	 * @function AddTaxSitusRuleKey
	 * @memberof! CCH_SureTax_lookup_v1
	 * @param {Integer} internalid Tax situs rule internal id to add
	 */
	var AddTaxSitusRuleKey = function (internalid) {
		if (internalid != undefined) {
			map[keys.taxsitusrule][internalid] = null;
		}
	};

	/**
	 * Add a tax type code internal id to the map.
	 * 
	 * @function AddTaxTypeCodeKey
	 * @memberof! CCH_SureTax_lookup_v1
	 * @param {Integer} internalid Tax type code internal id to add
	 */
	var AddTaxTypeCodeKey = function (internalid) {
		if (internalid != undefined) {
			map[keys.taxtypecode][internalid] = null;
		}
	};

	/**
	 * Add a regulatory code internal id to the map.
	 * 
	 * @function AddRegulatoryTypeCodeKey
	 * @memberof! CCH_SureTax_lookup_v1
	 * @param {Integer} internalid Regulatory code internal id to add
	 */
	var AddRegulatoryTypeCodeKey = function (internalid) {
		if (internalid != undefined) {
			map[keys.regulatorytypecode][internalid] = null;
		}
	};

	/**
	 * Add a tax exemption code internal id to the map.
	 * 
	 * @function AddExemptionCodeValueKey
	 * @memberof! CCH_SureTax_lookup_v1
	 * @param {Integer} internalid Tax exemption code internal id to add
	 */
	var AddExemptionCodeValueKey = function (internalid) {
		if (internalid != undefined) {
			map[keys.exemptioncodevalue][internalid] = null;
		}
	};

	/**
	 * Add a tax exemption reason internal id to the map.
	 * 
	 * @function AddExemptionCodeValueKey
	 * @memberof! CCH_SureTax_lookup_v1
	 * @param {Integer} internalid Tax exemption code internal id to add
	 */
	 var AddExemptionReasonValueKey = function (internalid) {
		if (internalid != undefined) {
			map[keys.taxexemptreason][internalid] = null;
		}
	};

	/**
	 * Add a sales type code internal id to the map.
	 * 
	 * @function AddCustomerTypeValueKey
	 * @memberof! CCH_SureTax_lookup_v1
	 * @param {Integer} internalid Sales type code internal id to add
	 */
	var AddCustomerTypeValueKey = function (internalid) {
		if (internalid != undefined) {
			map[keys.customertypevalue][internalid] = null;
		}
	};

	/**
	 * Add a transaction type code internal id to the map.
	 * 
	 * @function AddTransactionTypeKey
	 * @memberof! CCH_SureTax_lookup_v1
	 * @param {Integer} internalid Transaction type code internal id to add
	 */
	var AddTransactionTypeKey = function (internalid) {
		if (internalid != undefined) {
			map[keys.transactiontypecode][internalid] = null;
		}
	};

	/**
	 * Add a unit type code internal id to the map.
	 * 
	 * @function AddUnitTypeKey
	 * @memberof! CCH_SureTax_lookup_v1
	 * @param {Integer} internalid unit type code internal id to add
	 */
	var AddUnitTypeKey = function (internalid) {
		if (internalid != undefined) {
			map[keys.unittypecode][internalid] = null;
		}
	};

	/**
	 * Get a sales type code from the map.
	 * 
	 * @function GetCustomerTypeValue
	 * @memberof! CCH_SureTax_lookup_v1
	 * @param {Integer} internalid Sales type code internal id to get
	 */
	var GetCustomerTypeValue = function (internalId) {
		return map[keys.customertypevalue][internalId];
	};

	/**
	 * Get a tax exemption code from the map.
	 * 
	 * @function GetExemptionCodeValue
	 * @memberof! CCH_SureTax_lookup_v1
	 * @param {Integer} internalid Tax exemption code internal id to get
	 */
	var GetExemptionCodeValue = function (internalId) {
		return map[keys.exemptioncodevalue][internalId];
	};

	/**
	 * Get a tax exemption code from the map.
	 * 
	 * @function GetExemptionCodeValue
	 * @memberof! CCH_SureTax_lookup_v1
	 * @param {Integer} internalid Tax exemption code internal id to get
	 */
	 var GetExemptionReasonValue = function (internalId) {
		return map[keys.taxexemptreason][internalId];
	};

	/**
	 * Get a tax included code from the map.
	 * 
	 * @function GetTaxIncludedCode
	 * @memberof! CCH_SureTax_lookup_v1
	 * @param {Integer} internalid Tax included code internal id to get
	 */
	var GetTaxIncludedCode = function (internalId) {
		return map[keys.taxincludecodecode][internalId];
	};

	/**
	 * Get a tax situs rule from the map.
	 * 
	 * @function GetTaxSitusRule
	 * @memberof! CCH_SureTax_lookup_v1
	 * @param {Integer} internalid Tax situs rule internal id to get
	 */
	var GetTaxSitusRule = function (internalId) {
		return map[keys.taxsitusrule][internalId];
	};

	/**
	 * Get a tax type code from the map.
	 * 
	 * @function GetTaxTypeCode
	 * @memberof! CCH_SureTax_lookup_v1
	 * @param {Integer} internalid Tax type code internal id to get
	 */
	var GetTaxTypeCode = function (internalId) {
		return map[keys.taxtypecode][internalId];
	};

	/**
	 * Get a transaction type code from the map.
	 * 
	 * @function GetTransactionTypeCode
	 * @memberof! CCH_SureTax_lookup_v1
	 * @param {Integer} internalid Transaction type code internal id to get
	 */
	var GetTransactionTypeCode = function (internalId) {
		return map[keys.transactiontypecode][internalId];
	};

	/**
	 * Get a unit type code from the map.
	 * 
	 * @function GetUnitTypeCode
	 * @memberof! CCH_SureTax_lookup_v1
	 * @param {Integer} internalid Unit type code internal id to get
	 */
	var GetUnitTypeCode = function (internalId) {
		return map[keys.unittypecode][internalId];
	};

	/**
	 * Get a regulatory code from the map.
	 * 
	 * @function GetRegulatoryTypeCode
	 * @memberof! CCH_SureTax_lookup_v1
	 * @param {Integer} internalid Regulatory code internal id to get
	 */
	var GetRegulatoryTypeCode = function (internalid) {
		return map[keys.regulatorytypecode][internalid];
	};

	return {
		Initialize: Initialize,
		Cleanup: Cleanup,
		ProcessLookups: ProcessLookups,
		AddTaxIncludeCodeKey: AddTaxIncludeCodeKey,
		AddTaxSitusRuleKey: AddTaxSitusRuleKey,
		AddTaxTypeCodeKey: AddTaxTypeCodeKey,
		AddRegulatoryTypeCodeKey: AddRegulatoryTypeCodeKey,
		AddExemptionCodeValueKey: AddExemptionCodeValueKey,
		AddExemptionReasonValueKey: AddExemptionReasonValueKey,
		AddCustomerTypeValueKey: AddCustomerTypeValueKey,
		AddTransactionTypeKey: AddTransactionTypeKey,
		AddUnitTypeKey: AddUnitTypeKey,
		GetCustomerTypeValue: GetCustomerTypeValue,
		GetExemptionCodeValue: GetExemptionCodeValue,
		GetExemptionReasonValue: GetExemptionReasonValue,
		GetTaxIncludedCode: GetTaxIncludedCode,
		GetTaxSitusRule: GetTaxSitusRule,
		GetTaxTypeCode: GetTaxTypeCode,
		GetTransactionTypeCode: GetTransactionTypeCode,
		GetUnitTypeCode: GetUnitTypeCode,
		GetRegulatoryTypeCode: GetRegulatoryTypeCode,
	};
}
