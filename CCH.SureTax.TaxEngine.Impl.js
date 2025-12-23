/**
 * This script implements the Tax Engine plug-in. NetSuite calls this plug-in every time it would calculate tax.
 * 
 * @version 1.0.20180705
 * @copyright CCH Incorporated 2018&copy;
 * @namespace CCH_SureTax_TaxEngine_Impl
 */

var common = new SureTaxCommonModule();
var taxUtil = new taxObjUtil();
var gatherObj = new gather();
var api = new SureTaxApiModule();
var fieldsMod = new SureTaxFieldsModule();
var basicConfig = null;
var lineFields = [];
var headerFields = [];
var cTaxMap = new SureTaxMap();

function trackScript(nameFunction) {
    // 1. Set the Start Time
    var startTime = new Date().getTime();

    var context = nlapiGetContext();
    var remainingUsage = context.getRemainingUsage();

    nlapiLogExecution('DEBUG at:' + startTime, 'Governance Check in function: ' + nameFunction, 'Remaining Usage Units: ' + remainingUsage);


}

/**
 * This is called every time NetSuite calculates tax.
 *
 * @function calculateTax
 * @memberof! CCH_SureTax_TaxEngine_Impl
 * @param {Object} input Information about the transaction that needs tax calculated
 * @param {Object} output Object that the taxes calculated should be written to.
 * @param {Object} notifications Object that notifications should be written to.
 */
function calculateTax(input, output, notifications) {
    // calculate transaction summary and line item tax
    nlapiLogExecution('DEBUG', 'CCH.SureTax.SuiteTax.Impl.calculateTax() is triggered');
    var start = new Date().getTime();

    var currentContext = nlapiGetContext();
    var isWebStore = (currentContext.getExecutionContext() == 'webapplication' || currentContext.getExecutionContext() == 'webstore');

    nlapiLogExecution('DEBUG', 'Is Web Store', isWebStore);
    trackScript('Init calculateTax')

    if (!input.isTaxOutputOverridden() && !input.isTaxRegistrationOverridden()) {
        try {
            var isPosting = input.isPostingTransaction() && !input.isPreview();
            var postingperiod;

            if (isPosting) {
                var periodstartdate = common.FormatDate(input.getPostingPeriodStartDate());
                var periodenddate = common.FormatDate(input.getPostingPeriodEndDate());
                postingperiod = common.GetTransPostingPeriod(periodstartdate, periodenddate);
            }

            if (postingperiod != undefined && postingperiod != null && postingperiod != "" && common.IsPeriodClosed(postingperiod) == 'T') {
                var transID = input.getTransactionId();
                var tranType = input.getRecordType();
                var eLines = input.getLines();
                var transRec = nlapiLoadRecord(tranType, transID);
                var trans = JSON.parse(JSON.stringify(transRec));

                if (trans.taxdetails != undefined && trans.taxdetails != "") {
                    var taxdetails = JSON.parse(JSON.stringify(trans.taxdetails));

                    for (var p = 0; p < taxdetails.length; p++) {

                        var taxcode = JSON.parse(JSON.stringify(taxdetails[p].taxcode));
                        var taxtype = JSON.parse(JSON.stringify(taxdetails[p].taxtype));

                        var outLine = output.createLine(eLines[p].getReference());
                        var str = taxdetails[p].taxrate.toString().split("%");

                        outLine.addTaxDetail(taxcode.internalid, taxtype.internalid, str[0], taxdetails[p].taxamount, taxdetails[p].netamount, taxdetails[p].calcdetails);
                        output.addLine(outLine);
                        cTaxMap.updateTaxAmountMap(taxtype.internalid, taxcode.internalid, taxdetails[p].taxamount);
                    }

                    taxUtil.updateTaxSummaryLines(cTaxMap, output);
                }
            } else {
                // Cancel previous transactions.
                if (isPosting) {
                    // Add logging for Halton issue. ADO #135450
                    var msg = 'Transaction Id = ' + input.getTransactionId() + ', Record Type = ' + input.getRecordType();
                    nlapiLogExecution('AUDIT', 'calculateTax SureTax Cancel Posting', msg);
                    cancelSureTaxTrans(input, false);
                }

                var subVal = (common.isSubsidiaryEnable()) ? input.getSubsidiary() : null;
                basicConfig = common.LoadConfiguration(subVal);

                var stxRequest = gatherObj.createCalcRequest(input, true);

                if (stxRequest.ItemList.length > 0) {
                    // Transaction has lines, so call SureTax.
                    var postItems = [];
                    var hasSalesTax = false;

                    if (isPosting) {
                        for (var i = 0; i < stxRequest.ItemList.length; i++) {
                            var item = stxRequest.ItemList[i];

                            if (item.TaxOption !== "2") {
                                postItems.push(item);
                            } else {
                                hasSalesTax = true;
                            }
                        }

                        if (postItems.length >= 0 && hasSalesTax) {
                            stxRequest.ReturnFileCode = "Q";
                        }
                    }

                    nlapiLogExecution('AUDIT', 'Calc URL', basicConfig.connection_settings.url);
                    var response = api.postRequest(basicConfig.connection_settings.url, JSON.stringify(stxRequest));
                    var isPurchase = common.IsPurchaseTransaction(input.getRecordType());

                    if (isPurchase && hasSalesTax && isPosting) {
                        notifications.addWarning('A transaction with Sales tax option is not posted in SureTax.  A purchase transaction requires lines with Use Tax option (only) to post successfully in SureTax.');
                    }
                    if (isPosting) {
                        if (postItems.length > 0 && hasSalesTax) {
                            var itemsBeforePost = stxRequest.ItemList;
                            stxRequest.ItemList = postItems;
                            stxRequest.ReturnFileCode = "0";

                            var postingResponse = api.postRequest(basicConfig.connection_settings.url, JSON.stringify(stxRequest));

                            // Add logging for Halton issue. ADO #135450
                            var msg = 'Transaction Id = ' + input.getTransactionId() + ', Record Type = ' + input.getRecordType();
                            nlapiLogExecution('AUDIT', 'calculateTax SureTax Posting', msg);

                            stxRequest.ItemList = itemsBeforePost;
                            response.MasterTransId = postingResponse.MasterTransId;
                            response.TransId = postingResponse.TransId;
                        }
                    }

                    var procResponse = processResponse(response, stxRequest, input, notifications, 'PostRequest', false);

                    if (procResponse.Successful) {
                        // Update the tax into NetSuite.
                        taxUtil.updateTax(response, output, input, notifications, stxRequest);

                        if (procResponse.StxTransId > -1) {
                            notifications.addNotice('Call to CCH&reg; SureTax&reg; was successful. CCH&reg; SureTax&reg; transaction id is ' + procResponse.StxTransId.toString());
                        }
                    }
                } else {
                    processResponse({
                        TransId: 0,
                        HeaderMessage: "Success",
                        ItemMessages: "",
                        Successful: 'Y',
                        ResponseCode: '9999'
                    }, stxRequest, input, notifications, 'PostRequest', false);
                    // No taxable lines, add a warning message.
                    notifications.addWarning('No lines were calculated with CCH&reg; SureTax&reg;.');
                }
            }

            taxUtil.fillInTaxDetails(input, output);
        } catch (ex) {
            var msg = '';
            if (ex instanceof nlobjError) {
                msg = 'Error occurred. \n' + ex.getCode() + '\n' + ex.getDetails();
            } else {
                msg = 'Unexpected error occurred. \n' + ex.toString() + '\n At line number ' + ex.stack;
            }

            nlapiLogExecution('ERROR', 'SureTax Tax Calculation', msg);

            notifications.addError(msg);
        }
        trackScript('Finish calculateTax')
    }

    var end = new Date().getTime();
    nlapiLogExecution('DEBUG', 'CalculateTax Time', (end - start).toString());
}

/**
 * This method is used to define what other header fields should be sent to the calculateTax method.
 *
 * @function defineAdditionalFields
 * @memberof! CCH_SureTax_TaxEngine_Impl
 * @param {Object} output Object that the fields are added to.
 */
function defineAdditionalFields(output) {

    trackScript('Init defineAdditionalFields')
    var addFields = [];

    addFields.push('custbody_suretax_latest_transid');
    addFields.push('custbody_suretax_taxcalcinwebstore');
    addFields.push('custbody_suretax_totaltax');
    addFields.push('custbody_suretax_trans_ltcalllog');
    addFields.push('custbody_suretax_sh_enablesuretax');
    addFields.push('custbody_suretax_sh_salestypecode');
    addFields.push('custbody_suretax_sh_exemptcode');
    addFields.push('custbody_suretax_sh_taxincludedcode');
    addFields.push('custbody_suretax_sh_taxsitusrule');
    addFields.push('custbody_suretax_sh_transtypecode');
    addFields.push('custbody_suretax_sh_hand_transtype');
    addFields.push('custbody_suretax_sh_exemptreason');
    addFields.push('custbody_suretax_sh_unittype');
    addFields.push('custbody_suretax_sh_regcode');
    addFields.push('custbody_suretax_latest_transid_ap');
    addFields.push('custbody_suretax_latest_transid');
    addFields.push('tranid');
    addFields.push('shipmethod');
    addFields.push('createdfrom');
    addFields.push('ismultishipto');

    var start = new Date().getTime();
    getDataExchangeFields();

    for (var i = 0; i < headerFields.length; i++) {
        addFields.push(headerFields[i]);
    }

    var end = new Date().getTime();
    nlapiLogExecution('DEBUG', 'Additional Fields Time', (end - start).toString());

    output.setArray(addFields);
    trackScript('Finish defineAdditionalFields')
}

/**
 * This method is used to define what other line fields should be sent to the calculateTax method.
 *
 * @function defineLineAdditionalFields
 * @memberof! CCH_SureTax_TaxEngine_Impl
 * @param {Object} output Object that the fields are added to.
 */
function defineLineAdditionalFields(output) {
    var addFields = [];

    addFields.push('custcol_suretax_billing_zip_code');
    addFields.push('custcol_suretax_billing_zip_code_ext');
    addFields.push('custcol_suretax_enablesuretax');
    addFields.push('custcol_suretax_regulatorycode');
    addFields.push('custcol_suretax_salestypecode');
    addFields.push('custcol_suretax_secondary_zip_code');
    addFields.push('custcol_suretax_secondary_zip_code_xt');
    addFields.push('custcol_suretax_tax_exemption_code');
    addFields.push('custcol_suretax_tax_exempt_reason');
    addFields.push('custcol_suretax_taxincludedcode');
    addFields.push('custcol_suretax_taxsitusrule');
    addFields.push('custcol_suretax_transtypecode');
    addFields.push('custcol_suretax_unittype');
    addFields.push('custcol_suretax_billing_zip_code_ap');
    addFields.push('custcol_suretax_billing_zip_code_ext_ap');
    addFields.push('custcol_suretax_enablesuretax_ap');
    addFields.push('custcol_suretax_regulatorycode_ap');
    addFields.push('custcol_suretax_salestypecode_ap');
    addFields.push('custcol_suretax_secondary_zip_code_ap');
    addFields.push('custcol_suretax_secondary_zip_code_xt_ap');
    addFields.push('custcol_suretax_tax_exemption_code_ap');
    addFields.push('custcol_suretax_tax_expt_reason_ap');
    addFields.push('custcol_suretax_taxincludedcode_ap');
    addFields.push('custcol_suretax_taxsitusrule_ap');
    addFields.push('custcol_suretax_transtypecode_ap');
    addFields.push('custcol_suretax_unittype_ap');
    addFields.push('custcol_suretax_taxoption');
    addFields.push('custcol_suretax_tax_exemptcode_multi');
    addFields.push('custcol_suretax_tax_exptcode_multi_ap');
    addFields.push('location');
    addFields.push('item');
    addFields.push('category');

    var start = new Date().getTime();
    getDataExchangeFields();

    for (var i = 0; i < lineFields.length; i++) {
        addFields.push(lineFields[i]);
    }

    var end = new Date().getTime();
    nlapiLogExecution('DEBUG', 'Additional Line Fields Time', (end - start).toString());

    output.setArray(addFields);
}

/**
 * Sets the fields that are setup in the data exchange.
 * 
 * @function getDataExchangeFields
 * @memberof! CCH_SureTax_TaxEngine_Impl
 */
function getDataExchangeFields() {

    trackScript('Init getDataExchangeFields')
    // Find all of the records that have a field name defined.
    var columns = [];
    columns[0] = new nlobjSearchColumn('custrecord_suretax_fld_fieldname_so');
    columns[1] = new nlobjSearchColumn('custrecord_suretax_fld_formtype_so');

    var filters = [];
    filters[0] = new nlobjSearchFilter('custrecord_suretax_fld_fieldname_so', null, 'isnotempty', '');

    var results = nlapiSearchRecord('customrecord_suretax_crt_dataexch', null, filters, columns);

    if (results != null) {
        for (var i = 0; i < results.length; i++) {
            var fieldNameRec = results[i].getValue('custrecord_suretax_fld_fieldname_so');
            var formType = results[i].getValue('custrecord_suretax_fld_formtype_so');

            // Split the field name by '-', and take the last one.
            var fieldSplit = common.parseFieldName(fieldNameRec);

            if (common.IsEmpty(fieldSplit.SublistName)) {
                headerFields.push(fieldsMod.findHeaderFieldNameByLabel(formType, fieldSplit.FieldName));
            } else {
                lineFields.push(fieldsMod.findSublistFieldNameByLabel(formType, fieldSplit.SublistName, fieldSplit.FieldName));
            }
        }
    }
    trackScript('Finish getDataExchangeFields')
}

/**
 * This method is called by NetSuite when an event happens on a transaction. i.e. transaction is deleted, or voided.
 * When the transaction is deleted or voided, this method cancels the transaction in SureTax.
 *
 * @function onTransactionEvent
 * @memberof! CCH_SureTax_TaxEngine_Impl
 * @param {Object} input Information about the transaction that needs tax calculated
 * @param {Object} event Information about what event happened on the transaction
 */
function onTransactionEvent(input, event) {
    trackScript('Init onTransactionEvent')
    // define plug-in functionality based on a transaction event
    var eventCode = event.getCode();

    nlapiLogExecution('DEBUG', 'OnTransactionEvent triggered', eventCode);

    // Add logging for RSCS issue.
    var msg = 'Event Code = ' + eventCode.toString() + ', Transaction Id = ' + input.getTransactionId() + ', Record Type = ' + input.getRecordType();
    nlapiLogExecution('AUDIT', 'OnTransactionEvent information', msg);

    if ((eventCode == TransactionEventCode.VOID || eventCode == TransactionEventCode.DELETE) &&
        input.isPostingTransaction()) {
        // Add logging for Halton issue. ADO #135450
        var msg = 'Transaction Id = ' + input.getTransactionId() + ', Record Type = ' + input.getRecordType();
        nlapiLogExecution('AUDIT', 'onTransactionEvent SureTax Cancel Posting', msg);
        // Cancel the latest transaction in SureTax.
        cancelSureTaxTrans(input, true);
    } else if (eventCode == TransactionEventCode.SAVE) {
        // Associate the call log with the saved NetSuite transaction.
        updateCallLog(input);

        if (input.isPostingTransaction() && input.isStoredTaxOutdated()) {
            // Finalize the transaction in SureTax.
            finalizeTransInSureTax(input);
        }
    }

    trackScript('Finish onTransactionEvent')
}

/**
 * Finalizes the transaction in SureTax.
 * 
 * @function finalizeTransInSureTax
 * @memberof! CCH_SureTax_TaxEngine_Impl
 * @param {Object} input Information about the transaction that needs tax calculated
 */
function finalizeTransInSureTax(input) {

    trackScript('Init finalizeTransInSureTax')
    var subVal = (common.isSubsidiaryEnable()) ? input.getSubsidiary() : null;
    basicConfig = common.LoadConfiguration(subVal);

    // Add logging for Halton issue. ADO #135450
    var msg = 'Transaction Id = ' + input.getTransactionId() + ', Record Type = ' + input.getRecordType();
    nlapiLogExecution('AUDIT', 'onTransactionEvent SureTax Posting', msg);

    var stxRequest = common.getSureTaxRequestFromLogId(common.getLatestCallLogId(input.getTransactionId(), input.getRecordType()));

    if (isEmptyJsonObject(stxRequest)) {
        // Empty object, so regather the object.
        stxRequest = gatherObj.createCalcRequest(input, false);
    } else {
        var isPurchase = common.IsPurchaseTransaction(input.getRecordType());
        var hasSalesTax = false;

        for (var i = 0; i < stxRequest.ItemList.length; i++) {
            var item = stxRequest.ItemList[i];

            if (item.TaxOption == "2") {
                hasSalesTax = true;
            }
        }

        if (isPurchase && hasSalesTax) {
            stxRequest.ReturnFileCode = "Q";
        }
        else {
            stxRequest.ReturnFileCode = '0';
        }
        //stxRequest.ReturnFileCode = '0';
        stxRequest.ValidationKey = basicConfig.connection_settings.validation_key;
    }

    var response = api.postRequest(basicConfig.connection_settings.url, JSON.stringify(stxRequest));
    processResponse(response, stxRequest, input, null, 'PostRequest', false, true);

    trackScript('Init finalizeTransInSureTax')
}

/**
 * Checks to see if the given object is an empty JS object.
 * 
 * @function isEmptyJsonObject
 * @memberof! CCH_SureTax_TaxEngine_Impl
 * @param {Object} obj Object to check
 */
function isEmptyJsonObject(obj) {
    for (var prop in obj) {
        if (obj.hasOwnProperty(prop)) {
            return false;
        }
    }

    return true;
}

/**
 * Updates the call log records to reference the now saved NetSuite transaction.
 * 
 * @function updateCallLog
 * @memberof! CCH_SureTax_TaxEngine_Impl
 * @param {Object} input Object that contains information about the saved transaction.
 */
function updateCallLog(input) {
    // Update all call logs with the transaction id.
    common.UpdateTransIdOnCallLogFromUpdate(input.getTransactionId(), input.getRecordType());
}

/**
 * Determines if the given string is a number or not.
 * 
 * @function isNumber
 * @memberof! CCH_SureTax_TaxEngine_Impl
 * @param {String} str String to test
 * @returns {Boolean} Returns true if the string contains all numbers, and no characters, otherwise returns false.
 */
function isNumber(str) {
    var rx = new RegExp('^[0-9]+$');
    return rx.test(str);
}

/**
 * Determines if the given number is 15 digits long or more.
 * 
 * @function isValidNumber
 * @memberof! CCH_SureTax_TaxEngine_Impl
 * @param {String} number String to test
 * @returns {Boolean} Returns true if the number contains 15digits, otherwise returns false.
 */
function isValidNumber(number) {
    const regex = /\d+/g;
    const matches = number.match(regex);
    const digitCount = matches ? matches[0].length : 0;

    return (matches[0].length <= 15);
}

/**
 * Process the SureTax response, updating the SureTax call log in the process.
 * 
 * @function processResponse
 * @memberof! CCH_SureTax_TaxEngine_Impl
 * @param {Object} response Response from SureTax
 * @param {Object} request Request sent to SureTax
 * @returns {Boolean} Returns true if the call was successful, false if it wasn't.
 */
function processResponse(response, request, input, notifications, methodString, isCancel, isSaveEvent) {

    trackScript('Init processResponse')
    if (isSaveEvent === undefined) {
        isSaveEvent = false;
    }

    var successful = (response != null && response.Successful == 'Y');
    var logUpdateRecId = 0;

    if (response != null) {
        var transId = input.getTransactionId();
        var orderNo = input.getAdditionalFieldValue('tranid');

        // in case of "to be generated" order no.
        if (orderNo != '') {
            if (!isNumber(orderNo) || !orderNo || !isValidNumber(orderNo)) {
                orderNo = transId;
            }
        }
        // Add logging for Halton issue. ADO #135450
        if (request.ReturnFileCode == 0) {
            var msg = 'Event Code = ' + methodString + ', Transaction Id = ' + input.getTransactionId() + ', Record Type = ' + input.getRecordType() + ', SureTax Transaction Id = ' + response.TransId;
            nlapiLogExecution('AUDIT', 'SureTax Posted Trans information', msg);
        }
        if (request.ReturnFileCode == "Q") {
            var msg = 'Event Code = ' + methodString + ', Transaction Id = ' + input.getTransactionId() + ', Record Type = ' + input.getRecordType() + ', SureTax Transaction Id = ' + response.TransId;
            nlapiLogExecution('AUDIT', 'SureTax Quote Trans information', msg);
        }

        // Create call log.
        var callLogRecId = common.NewSureTaxCallLog({
            Method: methodString,
            HeaderMessage: response.HeaderMessage,
            ErrorMessage: '',
            ItemMessage: response.ItemMessages,
            ResponseCode: response.ResponseCode,
            Successful: successful,
            TransactionId: response.TransId,
            Request: JSON.stringify(request),
            Response: JSON.stringify(response),
            NSTransaction: (isSaveEvent) ? transId : null
        });

        // Create/update a call log update record.
        if (orderNo != null && !isCancel) {
            logUpdateRecId = common.CreateCallLogUpdateRec({
                TransId: orderNo,
                LogId: callLogRecId,
                Updated: 'F',
                RecType: input.getRecordType(),
                StxTransId: (methodString != 'CancelPostRequest') ? response.TransId : ''
            });

            if (logUpdateRecId < 0) {
                nlapiLogExecution('ERROR', 'Call Log Update', 'Failed to create the call log update record.');
            }
        }

        // Updating updatecalllog with internal id of the order. 
        if (transId != null && orderNo != null) {
            logUpdateRecId = common.UpdateCallLogUpdateRec({
                TransId: transId,
                LogId: callLogRecId,
                Updated: 'F',
                RecType: input.getRecordType(),
                StxTransId: (methodString != 'CancelPostRequest') ? response.TransId : ''
            }, orderNo);

            if (logUpdateRecId < 0) {
                nlapiLogExecution('ERROR', 'Call Log Update', 'Failed to update the call log update record.');
            }
        }

        trackScript('Init processResponse')
        if (notifications != null) {
            // Add warnings for each item message.
            processItemMessages(response.ItemMessages, notifications);
        }
    } else {
        nlapiCreateError('SureTax API : ProcessResponse call', 'Response was empty', true);
    }

    return {
        Successful: successful,
        StxTransId: (response != null) ? response.TransId : -1
    };
}

/**
 * Process the item messages from SureTax.
 * 
 * @function processItemMessages
 * @memberof! CCH_SureTax_TaxEngine_Impl
 * @param {Array} messages Item messages returned by SureTax
 * @param {Object} output Output stream to write the messages to.
 */
function processItemMessages(messages, notifications) {
    var itemMsgStr = '';
    for (var i = 0;
        (messages != null) && i < messages.length; i++) {
        itemMsgStr += 'Line Number: ' + messages[i].LineNumber + ' Response Code: ' + messages[i].ResponseCode + ' Message: ' + messages[i].Message + '<br/>';
    }

    // Write the message to the notifications.
    if (!common.IsEmpty(itemMsgStr)) {
        notifications.addWarning(itemMsgStr);
    }
}

/**
 * Javascript Map with key value pairs.
 * 
 * @namespace SureTaxMapObj
 */
function SureTaxMap() {
    
    trackScript('Init SureTaxMap')
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
    
    trackScript('finish SureTaxMap')
}


/**
 * Cancels the SureTax transaction for the given NS transaction.
 * 
 * @function cancelSureTaxTrans
 * @memberof! CCH_SureTax_TaxEngine_Impl
 * @param {Object} input Information about the transaction
 * @param {Boolean} deleting Send true if the transaction is being deleted, false if it isn't.
 */
function cancelSureTaxTrans(input, deleting) {
    
    trackScript('Init cancelSureTaxTrans')
    var stxTransId = common.getSureTaxTransactioIdFromLogId(common.getLatestCallLogId(input.getTransactionId(), input.getRecordType()));

    if (deleting && (!stxTransId || stxTransId <= 0)) {
        stxTransId = common.GetSureTaxTransactioLatestUpdateId(input.getTransactionId(), input.getRecordType());
    }

    if (!stxTransId || stxTransId <= 0) {
        return;
    }
    var cancelRequest = gatherObj.createCancelRequest(stxTransId, input);

    if (cancelRequest != null) {
        var subVal = (common.isSubsidiaryEnable()) ? input.getSubsidiary() : null;
        basicConfig = common.LoadConfiguration(subVal);


        nlapiLogExecution('AUDIT', 'Cancel URL', basicConfig.connection_settings.url);

        var apiRequest = JSON.stringify(cancelRequest);
        var response = api.cancelPostRequest(basicConfig.connection_settings.url, apiRequest);

        // Process the response.
        var successful = processResponse(response, cancelRequest, input, null, 'CancelPostRequest', deleting);

        if (successful) {
            nlapiLogExecution('AUDIT', 'Deleted Transaction', 'Deleted SureTax Transaction Id: ' + stxTransId);
        }
    }
    
    trackScript('finish cancelSureTaxTrans')
}
