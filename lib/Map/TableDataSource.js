/*global require*/
"use strict";

/*
TableDataSource object for displaying geo-located datasets
For the time being it acts as a layer on top of a CzmlDataSource
And writes a czml file for it to display
*/

var defaultValue = require('terriajs-cesium/Source/Core/defaultValue');
var defined = require('terriajs-cesium/Source/Core/defined');
var CzmlDataSource = require('terriajs-cesium/Source/DataSources/CzmlDataSource');
var defineProperties = require('terriajs-cesium/Source/Core/defineProperties');
var definedNotNull = require('terriajs-cesium/Source/Core/definedNotNull');
var destroyObject = require('terriajs-cesium/Source/Core/destroyObject');
var JulianDate = require('terriajs-cesium/Source/Core/JulianDate');
var loadText = require('terriajs-cesium/Source/Core/loadText');

var formatPropertyValue = require('../Core/formatPropertyValue');
var DataTable = require('./DataTable');

/**
* @class TableDataSource is a cesium based datasource for table based geodata
* @name TableDataSource
*
* @alias TableDataSource
* @internalConstructor
* @constructor
*/
var TableDataSource = function () {

    //Create a czmlDataSource to piggyback on
    this.czmlDataSource = new CzmlDataSource();
    this.dataset = new DataTable();
    this.loadingData = false;

    this._colorByValue = true;  //set to false by having only 1 entry in colorMap

    this.scale = 1.0;
    this.scaleByValue = false;
    this.imageUrl = '';
    this.displayDuration = undefined;  //minutes
    this.minDisplayValue = undefined;
    this.maxDisplayValue = undefined;
    this.clampDisplayValue = true;
    this.legendTicks = 0;
    this.featureInfoFields = undefined;
    //this are not used by the data source but they are stored with the style info for use by region mapping
    this.regionVariable = undefined;
    this.regionType = undefined;

    this.setColorGradient([
        {offset: 0.0, color: 'rgba(32,0,200,1.0)'},
        {offset: 0.25, color: 'rgba(0,200,200,1.0)'},
        {offset: 0.5, color: 'rgba(0,200,0,1.0)'},
        {offset: 0.75, color: 'rgba(200,200,0,1.0)'},
        {offset: 1.0, color: 'rgba(200,0,0,1.0)'}
    ]);
    this.dataVariable = undefined;
};

defineProperties(TableDataSource.prototype, {
        /**
         * Gets a human-readable name for this instance.
         * @memberof TableDataSource.prototype
         * @type {String}
         */
        name : {
            get : function() {
                return this.czmlDataSource.name;
            }
        },
         /**
         * Gets the clock settings defined by the loaded CZML.  If no clock is explicitly
         * defined in the CZML, the combined availability of all objects is returned.  If
         * only static data exists, this value is undefined.
         * @memberof TableDataSource.prototype
         * @type {DataSourceClock}
         */
       clock : {
            get : function() {
                return this.czmlDataSource.clock;
            }
        },
         /**
         * Gets the collection of {@link Entity} instances.
         * @memberof TableDataSource.prototype
         * @type {EntityCollection}
         */
       entities : {
            get : function() {
                return this.czmlDataSource.entities;
            }
        },
         /**
         * Gets a value indicating if the data source is currently loading data.
         * @memberof TableDataSource.prototype
         * @type {Boolean}
         */
       isLoading : {
            get : function() {
                return this.czmlDataSource.isLoading;
            }
        },
         /**
         * Gets an event that will be raised when the underlying data changes.
         * @memberof TableDataSource.prototype
         * @type {Event}
         */
       changedEvent : {
            get : function() {
                return this.czmlDataSource.changedEvent;
            }
        },
         /**
         * Gets an event that will be raised if an error is encountered during processing.
         * @memberof TableDataSource.prototype
         * @type {Event}
         */
       errorEvent : {
            get : function() {
                return this.czmlDataSource.errorEvent;
            }
        },
        /**
         * Gets an event that will be raised when the data source either starts or stops loading.
         * @memberof TableDataSource.prototype
         * @type {Event}
         */
        loadingEvent : {
            get : function() {
                return this.czmlDataSource.loadingEvent;
            }
        }
});



/**
 * Set the table display style parameters. See documentation at {@link TableStyle}
 */
TableDataSource.prototype.setDisplayStyle = function (style) {
    if (!defined(style)) {
        return;
    }

    this.scale = defaultValue(style.scale, this.scale);
    this.scaleByValue = defaultValue(style.scaleByValue, this.scaleByValue);
    this.imageUrl = defaultValue(style.imageUrl, this.imageUrl);
    this.displayDuration = defaultValue(style.displayDuration, this.displayDuration);
    this.clampDisplayValue = defaultValue(style.clampDisplayValue, this.clampDisplayValue);
    this.legendTicks = defaultValue(style.legendTicks, this.legendTicks);
        //these can be set to undefined with the style
    this.minDisplayValue = style.minDisplayValue;
    this.maxDisplayValue = style.maxDisplayValue;
    this.regionVariable = style.regionVariable;
    this.regionType = style.regionType;
    this.featureInfoFields = style.featureInfoFields;

    if (defined(style.colorMap)) {
        this.setColorGradient(style.colorMap);
    }
    //do this regardless to force rebuild of czml datasource
    this.setDataVariable(style.dataVariable);
};



/**
 * Set the table display style parameters (see setDisplayStyle for more style format)
 *
 * @returns {Object} An object containing the style parameters for the datasource.
 *
 */
TableDataSource.prototype.getDisplayStyle = function () {

    return {
        scale: this.scale,
        scaleByValue: this.scaleByValue,
        imageUrl: this.imageUrl,
        displayDuration: this.displayDuration,
        minDisplayValue: this.minDisplayValue,
        maxDisplayValue: this.maxDisplayValue,
        clampDisplayValue: this.clampDisplayValue,
        legendTicks: this.legendTicks,
        colorMap: this.colorMap,
        dataVariable: this.dataVariable,
        regionVariable: this.regionVariable,
        regionType: this.regionType,
        featureInfoFields: this.featureInfoFields
    };
};

/**
 * Asynchronously loads the Table at the provided url, replacing any existing data.
 *
 * @param {Object} url The url to be processed.
 *
 * @returns {Promise} a promise that will resolve when the CZML is processed.
 */
TableDataSource.prototype.loadUrl = function (url) {
    if (!defined(url)) {
        return;
    }
    this.loadingData = true;
    var that = this;
    return loadText(url).then(function(text) {
        that.loadText(text);
        that.loadingData = false;
    });
};

/**
 * Loads the Table from text, replacing any existing data.
 *
 * @param {Object} text The text to be processed.
 *
 */
TableDataSource.prototype.loadText = function (text) {
    this.dataset.loadText(text);
    if (this.dataset && this.dataset.hasTimeData() && !defined(this.displayDuration)) {
        // default duration calculation is for a data point to be shown for 1% of the total time span of the dataset
        var percentDisplay = 1.0;
        this.displayDuration = JulianDate.secondsDifference(this.dataset.getTimeMaxValue(), this.dataset.getTimeMinValue()) * percentDisplay / (60.0 * 100.0);
        this._autoDuration = true; // Since no duration was provided, we will use the full interval between each data point and the next
    }

    if (defined(this.dataVariable)) {
        // user-specified variable
        this.setDataVariable(this.dataVariable);
    } else {
        // otherwise pick the first one. Doing it here may simplify life.
        this.setDataVariable(this.dataset.getDataVariableList(true)[0]);
    }
};

/**
 * Returns a cached, sorted, unique array of JulianDates corresponding to the time values of different data points.
 */

TableDataSource.prototype.timeSlices = function() {
    if (!this.dataset || !this.dataset.hasTimeData()) {
        return undefined;
    }
    if (this._timeSlices) {
        return this._timeSlices;
    }
    var pointList = this.dataset.getPointList();

    this._timeSlices = pointList.map(function(point) { return point.time; });
    this._timeSlices.sort(JulianDate.compare);
    this._timeSlices = this._timeSlices.filter(function(element, index, array) {
        return index === 0 || !JulianDate.equals(array[index-1], element);
    });
    return this._timeSlices;
};

/**
 * Returns a { start, finish } pair of JulianDates corresponding to some pair of rows around this time.
 */
TableDataSource.prototype.getTimeSlice = function(time) {
    function shave(t) {
        // subtract a second from end values to avoid having slices actually overlap.
        return JulianDate.addSeconds(t, -1, new JulianDate());
    }
    var ts = this.timeSlices();
    if (!defined(ts) || ts.length === 0) {
        return undefined;
    }
    if (JulianDate.lessThan(time, ts[0])) {
        // not really consistent here
        return { start: time, finish: shave(ts[0]) };
    }
    for (var i = 0; i < ts.length - 1; i++) {
        if (JulianDate.greaterThan(ts[i+1], time)) {
            return { start: ts[i], finish: shave(ts[i + 1]) };
        }
    }
    if (JulianDate.lessThanOrEquals(time, JulianDate.addMinutes(ts[ts.length-1], this.displayDuration, new JulianDate()))) {
        // just outside the range, but within range + displayDuration
        return {
            start: ts[i],
            finish: JulianDate.addMinutes(time, this.displayDuration, new JulianDate())
        };
    }
    // if time is outside our time slices, we use displayDuration
    // counting backwards from the time is consistent with when not using automatic durations.
    return {
        start: JulianDate.addMinutes(time, -this.displayDuration, new JulianDate()),
        finish: time
    };
};

/**
* Sets the current data variable
*
* @param {String} varName The name of the variable to make the data variable
*
*/
TableDataSource.prototype.setDataVariable = function (varName) {
    this.dataVariable = varName;
    this.dataset.setDataVariable(varName);
    if (this.dataset.hasLocationData()) {
        this.czmlDataSource.load(this.getCzmlDataPointList());
    }
};

var endScratch = new JulianDate();

TableDataSource.prototype.describe = function(properties) {
    if (!defined(properties) || properties === null) {
        return '';
    }

    var infoFields = defined(this.featureInfoFields) ? this.featureInfoFields : properties;

    var html = '<table class="cesium-infoBox-defaultTable">';
    for ( var key in infoFields) {
        if (infoFields.hasOwnProperty(key)) {
            var value = properties[key];
            var name = defined(this.featureInfoFields) ? infoFields[key] : key;
            if (defined(value)) {
                    //see if we should skip this in the details - starts with __
                if (key.substring(0, 2) === '__') {
                    continue;
                } else if (value instanceof JulianDate) {
                    value = JulianDate.toDate(value).toDateString();
                }
                if (typeof value === 'object') {
                    value = this.describe(value);
                } else {
                    value = formatPropertyValue(value);
                }
                html += '<tr><td>' + name + '</td><td>' + value + '</td></tr>';
            }
        }
    }
    html += '</table>';
    return html;
};


TableDataSource.prototype._czmlRecFromPoint = function(point, name) {

    var rec = {
        "name": name,
        "description": "empty",
        "position" : {
            "cartographicDegrees" : [0, 0, 0]
        }
    };

    var color = this._mapValue2Color(point.val);
    var scale = this._mapValue2Scale(point.val);

    for (var p = 0; p < 3; p++) {
        rec.position.cartographicDegrees[p] = point.pos[p];
    }

    var show = [
        {
            "boolean" : false
        },
        {
            "interval" : "2011-02-04T16:00:00Z/2011-04-04T18:00:00Z",
            "boolean" : true
        }
    ];


    if (this.dataset.hasTimeData()) {
        var start = point.time;
        var finish;
        if (this._autoDuration) {
            finish = this.getTimeSlice(point.time).finish;
        } else {
            finish = JulianDate.addMinutes(point.time, this.displayDuration, endScratch);
        }
        rec.availability = JulianDate.toIso8601(start) + '/' + JulianDate.toIso8601(finish);
        show[1].interval = rec.availability;
    }
    else {
        show[0].boolean = true;
        show[1].interval = undefined;
    }

        //no image so use point
    if (!defined(this.imageUrl) || this.imageUrl === '') {
        rec.point = {
            outlineColor: { "rgba" : [0, 0, 0, 255] },
            outlineWidth: 1,
            pixelSize: 8 * scale,
            color: { "rgba" : color },
            show: show
        };
    }
    else {
        rec.billboard = {
            horizontalOrigin : "CENTER",
            verticalOrigin : "BOTTOM",
            image : this.imageUrl,
            scale : scale,
            color : { "rgba" : color },
            show : show
        };
    }

    return rec;
};

var defaultName = 'Site Data';

function chooseName(properties) {
    // Choose a name by the same logic as Cesium's GeoJsonDataSource
    // but fall back to the defaultName if none found.
    var nameProperty;

    // Check for the simplestyle specified name first.
    var name = properties.title;
    if (definedNotNull(name)) {
        nameProperty = 'title';
    } else {
        //Else, find the name by selecting an appropriate property.
        //The name will be obtained based on this order:
        //1) The first case-insensitive property with the name 'title',
        //2) The first case-insensitive property with the name 'name',
        //3) The first property containing the word 'title'.
        //4) The first property containing the word 'name',
        var namePropertyPrecedence = Number.MAX_VALUE;
        for (var key in properties) {
            if (properties.hasOwnProperty(key) && properties[key]) {
                var lowerKey = key.toLowerCase();
                if (namePropertyPrecedence > 1 && lowerKey === 'title') {
                    namePropertyPrecedence = 1;
                    nameProperty = key;
                    break;
                } else if (namePropertyPrecedence > 2 && lowerKey === 'name') {
                    namePropertyPrecedence = 2;
                    nameProperty = key;
                } else if (namePropertyPrecedence > 3 && /title/i.test(key)) {
                    namePropertyPrecedence = 3;
                    nameProperty = key;
                } else if (namePropertyPrecedence > 4 && /name/i.test(key)) {
                    namePropertyPrecedence = 4;
                    nameProperty = key;
                }
            }
        }
    }
    if (defined(nameProperty)) {
        return properties[nameProperty];
    } else {
        return defaultName;
    }
}

/**
* Get a list of display records for the current point list in czml format.
*
* @return {Object} An object in czml format representing the data.
*
*/
TableDataSource.prototype.getCzmlDataPointList = function () {
    if (this.loadingData) {
        return;
    }

    var pointList = this.dataset.getPointList();

    var dispRecords = [{
        id : 'document',
        version : '1.0'
    }];

    for (var i = 0; i < pointList.length; i++) {
        //set position, scale, color, and display time
        var dataRow = this.dataset.getDataRow(pointList[i].row);
        var name = chooseName(dataRow);
        var rec = this._czmlRecFromPoint(pointList[i], name);
        rec.description = this.describe(dataRow);
        dispRecords.push(rec);
    }
    return dispRecords;
};


/**
* Get a list of display records for the current point list.
*
* @param {JulianTime} time The time value to filter the data against
*
* @returns {Array} An array of row indices of point objects that fall within given time segment.
*
*/
TableDataSource.prototype.getDataPointList = function (time) {
    if (this.dataset.loadingData) {
        return;
    }

    var pointList = this.dataset.getPointList();

    var dispRecords = [];

    var start, finish;
    if (this.dataset.hasTimeData()) {
        if (this._autoDuration) {
            var span = this.getTimeSlice(time);
            start = span.start;
            finish = span.finish;
        } else {
            start = JulianDate.addMinutes(time, -this.displayDuration, endScratch);
            finish = time;
        }
    }
    for (var i = 0; i < pointList.length; i++) {
        if (this.dataset.hasTimeData()) {
            if (JulianDate.lessThan(pointList[i].time, start) ||
                JulianDate.greaterThan(pointList[i].time, finish)) {
                continue;
            }
        }
        dispRecords.push(pointList[i].row);
    }
    return dispRecords;
};


/**
  * Convert the value of a data point to a value between 0.0 and 1.0 */
TableDataSource.prototype._getNormalizedPoint = function (pntVal) {
    if (this.dataset === undefined || this.dataset.isNoData(pntVal)) {
        return undefined;
    }
    var minVal = this.minDisplayValue || this.dataset.getDataMinValue();
    var maxVal = this.maxDisplayValue || this.dataset.getDataMaxValue();
    var normPoint = (maxVal === minVal) ? 0 : (pntVal - minVal) / (maxVal - minVal);
    if (this.clampDisplayValue) {
        normPoint = Math.max(0.0, Math.min(1.0, normPoint));
    }
    return normPoint;
};

TableDataSource.prototype._mapValue2Scale = function (pntVal) {
    var scale = this.scale;
    var normPoint = this._getNormalizedPoint(pntVal);
    if (defined(normPoint) && normPoint === normPoint) { // testing for NaN
        scale *= (this.scaleByValue ? 1.0 * normPoint + 0.5 : 1.0);
    }
    return scale;
};


TableDataSource.prototype._mapValue2Color = function (pntVal) {
    var colors = this.dataImage;
    if (colors === undefined) {
        return this.color;
    }
    var normPoint = this._getNormalizedPoint(pntVal);
    var color = [0,0,0,0], colorIndex = 0;
    if (defined(normPoint)) {
        colorIndex = Math.floor(normPoint * (colors.data.length / 4 - 1)) * 4;
    }
    color[0] = colors.data[colorIndex];
    color[1] = colors.data[colorIndex + 1];
    color[2] = colors.data[colorIndex + 2];
    color[3] = colors.data[colorIndex + 3];
    return color;
};

TableDataSource.prototype._minLegendValue = function() {
    var dataMin = this.dataset.getDataMinValue();
    if (dataMin === this.dataset.getDataMaxValue()) {
        return dataMin;
    }

    return defined(this.minDisplayValue) ? this.minDisplayValue : dataMin;
};

TableDataSource.prototype._maxLegendValue = function() {
    var dataMax = this.dataset.getDataMaxValue();
    if (dataMax === this.dataset.getDataMinValue()) {
        return dataMax;
    }

    return defined(this.maxDisplayValue) ? this.maxDisplayValue : dataMax;
};

/**
* Get a data url that holds the image for the legend
*
* @returns {String} A data url that is a png of the legend for the datasource
*
*/
TableDataSource.prototype.getLegendGraphic = function () {
    function drawGradient(ctx, gradH, gradW, colorMap) {
        var linGrad = ctx.createLinearGradient(0,0,0,gradH);
        var colorStops = singleValueLegend ? 1 : colorMap.length;

        for (var i = 0; i < colorStops; i++) {
            linGrad.addColorStop(colorMap[i].offset, colorMap[i].color);
        }
        //panel background color
        ctx.fillStyle = "#2F353C";
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        //put 0 at bottom
        ctx.translate(gradW + 15, ctx.canvas.height-5);
        ctx.rotate(180 * Math.PI / 180);
        ctx.fillStyle = linGrad;
        ctx.fillRect(0,0,gradW,gradH);

    }

    function drawTicks(ctx, gradH, gradW, segments) {
        //TODO: if singleValue, but not singleValueLegend then place tic at correct ht between min/max
        for (var s = 1; s < segments; s++) {
            var ht = gradH * s / segments;
            ctx.beginPath();
            ctx.moveTo(0, ht);
            ctx.lineTo(gradW, ht);
            ctx.stroke();
        }
    }

    function drawLabels(ctx, gradH, gradW, segments, minVal, maxVal, dataVariable) {
        var minText = defined(minVal) ? (Math.round(minVal * 100) / 100).toString() : '';
        var maxText = defined(maxVal) ? (Math.round(maxVal * 100) / 100).toString() : '';
        var varText = dataVariable || '';

        ctx.setTransform(1,0,0,1,0,0);
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "15px 'Roboto', sans-serif";
        ctx.fillText(varText, 5, 12);
        ctx.font = "14px 'Roboto', sans-serif";

        if (minVal === maxVal) {
            ctx.fillText(minText, gradW + 25, ctx.canvas.height - gradH/2);
        }
        else {
            ctx.fillText(maxText, gradW + 25, ctx.canvas.height - gradH);
            ctx.fillText(minText, gradW + 25, ctx.canvas.height);
        }

        var val;
        if (defined(minVal) && defined(maxVal)) {
            for (var s = 1; s < segments; s++) {
                var ht = gradH * s / segments;
                val = minVal + (maxVal - minVal) * (segments-s) / segments;
                var valText = (Math.round(val * 100) / 100).toString();
                ctx.fillText(valText, gradW + 25, ht+32);
            }
        }
    }

    //Check if fixed color for all points and if so no legend
    if (!this._colorByValue) {
        return undefined;
    }
    var minVal = this._minLegendValue();
    var maxVal = this._maxLegendValue();
    var singleValueLegend = minVal === maxVal;

    var canvas = document.createElement("canvas");
    if (!defined(canvas)) {
        return;
    }
    canvas.width = 210;
    canvas.height = singleValueLegend ? 60 : 160;
    var gradW = 30;
    var gradH = singleValueLegend ? 28 : 128;
    var ctx = canvas.getContext('2d');

    drawGradient(ctx, gradH, gradW, this.colorMap);
    drawTicks(ctx, gradH, gradW, singleValueLegend ? 0 : this.legendTicks+1);
    drawLabels(ctx, gradH, gradW, singleValueLegend ? 0 : this.legendTicks + 1, minVal, maxVal, this.dataset.getDataVariable());

    return canvas.toDataURL("image/png");
};


/**
* Set the gradient used to color the data points
*
* @param {Array} colorMap A colormap with an array of entries as defined for html5
*   canvas linear gradients e.g., { offset: xx, color: 'rgba(32,0,200,1.0)'}
*
*/
TableDataSource.prototype.setColorGradient = function (colorMap) {
    if (colorMap === undefined) {
        return;
    }

    this.colorMap = colorMap;

    var canvas = document.createElement("canvas");
    if (!defined(canvas)) {
        return;
    }
    var w = canvas.width = 64;
    var h = canvas.height = 256;
    var ctx = canvas.getContext('2d');

    // Create Linear Gradient
    var grad = this.colorMap;
    var linGrad = ctx.createLinearGradient(0,0,0,h);
    if (grad.length === 1) {
        this._colorByValue = false;
    }
    for (var i = 0; i < grad.length; i++) {
        linGrad.addColorStop(grad[i].offset, grad[i].color);
    }
    ctx.fillStyle = linGrad;
    ctx.fillRect(0,0,w,h);

    this.dataImage = ctx.getImageData(0, 0, 1, 256);
};

/**
* Destroy the object and release resources
*
*/
TableDataSource.prototype.destroy = function () {
    return destroyObject(this);
};

module.exports = TableDataSource;
