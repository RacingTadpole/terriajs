"use strict";
/**
 * Parse inforTemplate
 * @param  {entity.description.getRawValue()} data raw data of of the picked feature
 * @param  {inforTemplate} template info template as defined in the info file
 * @return {String}  Html to be displayed in the info box
 */
var readTemplate = function (data, template) {
    var html = "",
        rg = /{{2}([^}]+)}{2}/g;

    function keyFilter(string) {
        //use {{}} syntax
        return function handler(regex) {
            return string.match(regex);
        };
    }

    console.log("hhh");
    //if supplied a string
    function parse(template) {
        var keys,
            output ='',
            currentKey,
            currentValue,
            i = 0;
        keys = (keyFilter(template))(rg);

        function replaceKey(originString) {
            currentKey = keys[i];
            currentValue = data[currentKey.substring(2, (keys[i].length - 2))];
            output = originString.replace(currentKey, currentValue);
            i++;
            if (i < keys.length) {
                replaceKey(output);
            } else {
                return output;
            }
        }

      replaceKey(template);
      return output;
    }
  html = parse(template);
  return html;
};
module.exports = readTemplate;