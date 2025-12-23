/**
 * This module is used to find information about fields and sublist fields of a record.
 * 
 * @namespace CCH_SureTax_Fields_v1
 * @requires {@link CCH_SureTax_common_v1}
 * @version 1.0.20180705
 * @copyright CCH Incorporated 2018&copy;
 */
function SureTaxFieldsModule() {
	var MAXPARAMETERLENGTH = 50;
	var recArray = [];
	var common = new SureTaxCommonModule();

	/**
	 * Gets the header fields for the given record type.
	 * 
	 * @function getHeaderFields
	 * @memberof! CCH_SureTax_Fields_v1
	 * @param {String} recordType Record type to get the header fields for.
	 * @returns {Array} Returns an array with the field id and labels for the given record type.
	 */
	function getHeaderFields(recordType) {
		// Create a new record, but it will never be saved.
		var rec = findRecTypeInArray(recordType);

		if (rec == null) {
			rec = nlapiCreateRecord(recordType);
			recArray.push(rec);
		}

		// Get all the header fields.
		var fields = rec.getAllFields();
		var validFields = [];

		// Loop through all the fields, and add valid fields to the list.
		for (var i = 0; i < fields.length; i++) {
			var field = rec.getField(fields[i]);

			if (field != null && field.getLabel() != null && field.getLabel() !== '') {
				validFields.push(field);
			}
		}

		return validFields;
	}

	/**
	 * Finds the nlobjField object for the given record and field name.
	 * 
	 * @function findHeaderField
	 * @memberof! CCH_SureTax_Fields_v1
	 * @param {String} recordType Record type
	 * @param {String} fieldName Name of the field
	 * @returns {nlobjField} Returns nlobjField object for the given information.
	 */
	function findHeaderField(recordType, fieldName) {
		var fields = getHeaderFields(recordType);

		for (var i = 0; i < fields.length; i++) {
			var curField = fields[i];

			if (curField.name === fieldName) {
				return curField;
			}
		}

		return null;
	}

	/**
	 * Finds the name of the field for the given record and label.
	 * 
	 * @function findHeaderFieldNameByLabel
	 * @memberof! CCH_SureTax_Fields_v1
	 * @param {String} recordType Record type
	 * @param {String} label Label for the field
	 * @returns {String} Returns field name for the given label
	 */
	function findHeaderFieldNameByLabel(recordType, label) {
		var fields = getHeaderFields(recordType);

		for (var i = 0; i < fields.length; i++) {
			var curField = fields[i];

			if (curField.label === label) {
				return curField.name;
			}
		}

		return '';
	}

	/**
	 * Gets the sublists for the given record type.
	 * 
	 * @function getSublists
	 * @memberof! CCH_SureTax_Fields_v1		 
	 * @param {String} recordType Record type to get the sublists for.
	 * @returns {Array} Returns array that contains the sublists for the given record type.
	 */
	function getSublists(recordType) {
		// Create a new record, but it will never be saved.
		var rec = findRecTypeInArray(recordType);

		if (rec == null) {
			rec = nlapiCreateRecord(recordType);
			recArray.push(rec);
		}

		// Get all the header fields.
		return rec.allSublists;
	}

	/**
	 * Gets the sublist fields for the given record and sublist.
	 * 
	 * @function getSublistFields
	 * @memberof! CCH_SureTax_Fields_v1
	 * @param {String} recordType Record type to retrieve field from.
	 * @param {String} sublistId Sublist to get fields from
	 * @returns {Array} Returns array that contains the sublist fields for the given record type and sublist.
	 */
	function getSublistFields(recordType, sublistId) {
		// Create a new record, but it will never be saved.
		var rec = findRecTypeInArray(recordType);

		if (rec == null) {
			rec = nlapiCreateRecord(recordType);
			recArray.push(rec);
		}

		// Get all the sublist fields.
		var sublistFields = rec.getAllLineItemFields(sublistId);

		var validFields = [];
		var sublistInfo = rec.getSubList(sublistId);

		if (sublistFields) {
			// Loop through all the sublist fields, and add valid fields to the list.
			for (var i = 0; i < sublistFields.length; i++) {
				if (sublistFields[i] != 'sys_id') {
					var field = sublistInfo.getField(sublistFields[i]);

					if (field != null && field.label != null && field.label !== '') {
						validFields.push(field);
					}
				}
			}
		}

		return validFields;
	}

	/**
	 * Finds the nlobjField object for the given record, sublist, and field.
	 * 
	 * @function findSublistField
	 * @memberof! CCH_SureTax_Fields_v1
	 * @param {String} recordType Record type
	 * @param {String} sublistId Sublist id
	 * @param {String} fieldName Sublist field name
	 * @returns {nlobjField} Returns field object for the given field information.
	 */
	function findSublistField(recordType, sublistId, fieldName) {
		var sublistFields = getSublistFields(recordType, sublistId);
		if (!sublistFields) {
			return null;
		}
		for (var i = 0; i < sublistFields.length; i++) {
			var curField = sublistFields[i];

			if (curField.name === fieldName) {
				return curField;
			}
		}

		return null;
	}

	/**
	 * Finds the name of the field for the given record, sublist, and label.
	 * 
	 * @function findSublistFieldNameByLabel
	 * @memberof! CCH_SureTax_Fields_v1
	 * @param {String} recordType Record type
	 * @param {String} sublistId Sublist id
	 * @param {String} label Sublist field name
	 * @returns {String} Returns field name for the given label information.
	 */
	function findSublistFieldNameByLabel(recordType, sublistId, label) {
		var sublistFields = getSublistFields(recordType, sublistId);
		if (!sublistFields) {
			return '';
		}
		for (var i = 0; i < sublistFields.length; i++) {
			var curField = sublistFields[i];

			if (curField.label === label) {
				return curField.name;
			}
		}

		return '';
	}

	/**
	 * Gets the value of the given header field.
	 * 
	 * @function getFieldValue
	 * @memberof! CCH_SureTax_Fields_v1
	 * @param {Object} rec Record to get field from
	 * @param {nlobjField} field Field to retrieve
	 * @returns {String} Returns the value of the field.
	 */
	function getFieldValue(rec, field, trimOutputVar) {
		var fieldValue = rec.getFieldValue(field.name);

		var ret = (!common.IsEmpty(fieldValue)) ? fieldValue : '';

		switch (field.type) {
			case 'date':
				var date = new Date(fieldValue);
				ret = common.GetDateStr(date);
				break;
			case 'checkbox':
				ret = (fieldValue === 'T' || fieldValue === true) ? 'Yes' : 'No';
				break;
			case 'select':
				ret = rec.getFieldText(field.name);
				break;
		}

		if (trimOutputVar === true) {
			ret = trimOutput(ret);
		}

		return ret;
	}

	/**
	 * Gets the value of the given sublist field.
	 * 
	 * @function getSublistValue
	 * @memberof! CCH_SureTax_Fields_v1
	 * @param {Object} rec Record to retrieve value from.
	 * @param {String} sublistId Sublist id
	 * @param {String} sublistField Sublist field to retrieve
	 * @param {Integer} line Line number to retrieve value from
	 * @param {Boolean} trimOutputVar Determine if the field value is to be trimmed
	 * @returns {String} Returns the value of the sublist field.
	 */
	function getSublistValue(rec, sublistId, sublistField, line, trimOutputVar) {
		var sublistValue = rec.getLineItemValue(sublistId, sublistField.name, line);

		var ret = (!common.IsEmpty(sublistValue)) ? sublistValue : '';

		switch (sublistField.type) {
			case 'date':
				var date = new Date(sublistValue);
				ret = common.GetDateStr(date);
				break;
			case 'checkbox':

				ret = (sublistValue === 'T' || sublistValue === true) ? 'Yes' : 'No';
				break;
			case 'select':
				ret = rec.getLineItemText(sublistId, sublistField.name, line);
				break;
		}

		if (trimOutputVar === true) {
			ret = trimOutput(ret);
		}

		return ret;
	}

	/**
	 * Trims the given string to a max number of characters.
	 * 
	 * @function trimOutput
	 * @memberof! CCH_SureTax_Fields_v1
	 * @param {String} strToTrim String to trim
	 * @returns {String} Returns the given string, trimmed to a number of characters.
	 */
	function trimOutput(strToTrim) {
		if (strToTrim.length > MAXPARAMETERLENGTH) {
			return substr(0, MAXPARAMETERLENGTH);
		}

		return strToTrim;
	}

	/**
	 * Finds the record type in record array.
	 *
	 * @function findRecTypeInArray
	 * @memberof! CCH_SureTax_Fields_v1
	 * @param {String} recordType Record type to search for
	 * @returns {Object} Returns the cached object of the given record type. If it isn't cached yet, null is returned.
	 */
	function findRecTypeInArray(recordType) {
		for (var i = 0; i < recArray.length; i++) {
			if (recArray[i].getRecordType() == recordType) {
				return recArray[i];
			}
		}

		return null;
	}

	return {
		getHeaderFields: getHeaderFields,
		getSublistFields: getSublistFields,
		getFieldValue: getFieldValue,
		getSublistValue: getSublistValue,
		getSublists: getSublists,
		findSublistField: findSublistField,
		findHeaderField: findHeaderField,
		findHeaderFieldNameByLabel: findHeaderFieldNameByLabel,
		findSublistFieldNameByLabel: findSublistFieldNameByLabel
	};
}
