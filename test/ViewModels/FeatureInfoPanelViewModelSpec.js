'use strict';

/*global require,describe,it,expect,beforeEach,afterEach*/
var FeatureInfoPanelViewModel = require('../../lib/ViewModels/FeatureInfoPanelViewModel');
var PickedFeatures = require('../../lib/Map/PickedFeatures');
var runLater = require('../../lib/Core/runLater');
var Terria = require('../../lib/Models/Terria');
var loadJson = require('terriajs-cesium/Source/Core/loadJson');
var Entity = require('terriajs-cesium/Source/DataSources/Entity');

var Catalog = require('../../lib/Models/Catalog');
var createCatalogMemberFromType = require('../../lib/Models/createCatalogMemberFromType');
var CatalogGroup = require('../../lib/Models/CatalogGroup');
var GeoJsonCatalogItem = require('../../lib/Models/GeoJsonCatalogItem');


describe('FeatureInfoPanelViewModel', function() {
    var terria;
    var panel;

    beforeEach(function() {
        terria = new Terria({
            baseUrl: './'
        });
        panel = new FeatureInfoPanelViewModel({
            terria: terria
        });
    });

    afterEach(function() {
        panel.destroy();
        panel = undefined;
    });

    it('is initially not visible', function() {
        expect(panel.isVisible).toBe(false);
    });

    it('is shown when terria.pickedFeatures is defined', function() {
        terria.pickedFeatures = new PickedFeatures();
        expect(panel.isVisible).toBe(true);
    });

    it('is hidden when terria.pickedFeatures is set back to undefined', function() {
        terria.pickedFeatures = new PickedFeatures();
        expect(panel.isVisible).toBe(true);
        terria.pickedFeatures = undefined;
        expect(panel.isVisible).toBe(false);
    });

    it('sanitizes HTML', function() {
        panel.html = '<script type="text/javascript">\nalert("foo");\n</script>';
        panel.isVisible = true;

        expect(domContainsText(panel, 'alert("foo")')).toBe(false);
    });

    it('displays a message while asychronously obtaining feature information', function() {
        var pickedFeatures = new PickedFeatures();
        pickedFeatures.allFeaturesAvailablePromise = runLater(function() {});
        terria.pickedFeatures = pickedFeatures;
        expect(domContainsText(panel, 'Loading')).toBe(true);
    });

    it('creates a temporary selected feature at the pick location while picking is in progress', function() {
        var pickedFeatures = new PickedFeatures();
        pickedFeatures.allFeaturesAvailablePromise = runLater(function() {});
        terria.pickedFeatures = pickedFeatures;

        expect(terria.selectedFeature).toBeDefined();
        expect(terria.selectedFeature.id).toBe('Pick Location');
    });

    it('removes all clock event listeners', function(done) {
        var feature = createTestFeature({});
        var pickedFeatures = new PickedFeatures();
        pickedFeatures.features.push(feature);
        pickedFeatures.features.push(feature);
        pickedFeatures.allFeaturesAvailablePromise = runLater(function() {});

        panel.showFeatures(pickedFeatures).then(function() {
            expect(terria.clock.onTick.numberOfListeners).toEqual(2);
        }).otherwise(done.fail).then(function() {
            // now, when no features are chosen, they should go away
            pickedFeatures = new PickedFeatures();
            pickedFeatures.allFeaturesAvailablePromise = runLater(function() {});            
            panel.showFeatures(pickedFeatures).then(function() {
                expect(terria.clock.onTick.numberOfListeners).toEqual(0);
            }).otherwise(done.fail).then(done);
        });
    });

    function createTestFeature(options) {
        var properties = {};
        properties[options.name || 'Foo'] = options.value || 'bar';
        var description = {};
        description.getValue = function() {
            return options.value || 'bar';
        };
        return new Entity({
            name: options.name || 'Foo',
            properties: properties,
            description: description,
            imageryLayer: options.imageryLayer || {}
        });
    }

});


describe('FeatureInfoPanelViewModel templating', function() {
    var terria,
        panel,
        catalog,
        item;

    beforeEach(function(done) {
        terria = new Terria({
            baseUrl: './'
        });
        panel = new FeatureInfoPanelViewModel({
            terria: terria
        });
        createCatalogMemberFromType.register('group', CatalogGroup);
        createCatalogMemberFromType.register('geojson', GeoJsonCatalogItem);
        loadJson('test/init/geojson-with-template.json').then(function(json) {
            catalog = new Catalog(terria);
            catalog.updateFromJson(json.catalog).then(function() {
                item = catalog.group.items[0].items[0];
                done();
            }).otherwise(done.fail);
        }).otherwise(done.fail);
    });

    afterEach(function() {
        panel.destroy();
        panel = undefined;
    });

    it('has a default template', function(done) {
        var regex = new RegExp('<td>.{0,7}Hoop_Big.{0,7}</td>');
        item.featureInfoTemplate = undefined;
        item.load().then(function() {
            expect(item.dataSource.entities.values.length).toBeGreaterThan(0);
            panel.terria.nowViewing.add(item);
            var feature = item.dataSource.entities.values[0];
            var pickedFeatures = new PickedFeatures();
            pickedFeatures.features.push(feature);
            pickedFeatures.allFeaturesAvailablePromise = runLater(function() {});

            panel.showFeatures(pickedFeatures).then(function() {
                expect(regex.test(panel.sections[0].info.replace(/\n/g, ''))).toBe(true);
            }).otherwise(done.fail).then(done);
        }).otherwise(done.fail);

    });

    it('uses and completes a string-form featureInfoTemplate if present', function(done) {
        item.featureInfoTemplate = 'A {{type}} made of {{material}} with {{funding_ba}} funding.';
        item.load().then(function() {
            expect(item.dataSource.entities.values.length).toBeGreaterThan(0);
            panel.terria.nowViewing.add(item);
            var feature = item.dataSource.entities.values[0];
            var pickedFeatures = new PickedFeatures();
            pickedFeatures.features.push(feature);
            pickedFeatures.allFeaturesAvailablePromise = runLater(function() {});

            panel.showFeatures(pickedFeatures).then(function() {
                expect(panel.sections[0].info).toBe('A Hoop_Big made of Stainless Steel with Capex funding.');
            }).otherwise(done.fail).then(done);
        }).otherwise(done.fail);
    });

    it('must use triple braces to embed html in template', function(done) {
        item.featureInfoTemplate = '<div>Hello {{name}} - {{{name}}}</div>';
        item.load().then(function() {
            expect(item.dataSource.entities.values.length).toBeGreaterThan(0);
            panel.terria.nowViewing.add(item);
            var feature = item.dataSource.entities.values[0];
            feature.properties['name'] = 'Jay<br>';
            var pickedFeatures = new PickedFeatures();
            pickedFeatures.features.push(feature);
            pickedFeatures.allFeaturesAvailablePromise = runLater(function() {});

            panel.showFeatures(pickedFeatures).then(function() {
                expect(panel.sections[0].info).toBe('<div>Hello Jay&lt;br&gt; - Jay<br></div>');
            }).otherwise(done.fail).then(done);
        }).otherwise(done.fail);

    });

    it('can use a json featureInfoTemplate with partials', function(done) {
        item.featureInfoTemplate = {template: '<div>test {{>foobar}}</div>', partials: {foobar: '<b>{{type}}</b>'}};
        item.load().then(function() {
            expect(item.dataSource.entities.values.length).toBeGreaterThan(0);
            panel.terria.nowViewing.add(item);
            var feature = item.dataSource.entities.values[0];
            var pickedFeatures = new PickedFeatures();
            pickedFeatures.features.push(feature);
            pickedFeatures.allFeaturesAvailablePromise = runLater(function() {});

            panel.showFeatures(pickedFeatures).then(function() {
                expect(panel.sections[0].info).toBe('<div>test <b>Hoop_Big</b></div>');
            }).otherwise(done.fail).then(done);
        }).otherwise(done.fail);
    });

    it('sets the name from featureInfoTemplate', function(done) {
        item.featureInfoTemplate = {name: 'Type {{type}}'};
        item.load().then(function() {
            expect(item.dataSource.entities.values.length).toBeGreaterThan(0);
            panel.terria.nowViewing.add(item);
            var feature = item.dataSource.entities.values[0];
            var pickedFeatures = new PickedFeatures();
            pickedFeatures.features.push(feature);
            pickedFeatures.allFeaturesAvailablePromise = runLater(function() {});

            panel.showFeatures(pickedFeatures).then(function() {
                expect(panel.sections[0].name).toBe('Type Hoop_Big');
            }).otherwise(done.fail).then(done);
        }).otherwise(done.fail);
    });

    it('can render a recursive featureInfoTemplate', function(done) {

        item.featureInfoTemplate = {
            template: '<ul>{{>show_children}}</ul>',
            partials: {
                show_children: '{{#children}}<li>{{name}}<ul>{{>show_children}}</ul></li>{{/children}}'
            }
        };
        item.load().then(function() {
            expect(item.dataSource.entities.values.length).toBeGreaterThan(0);
            panel.terria.nowViewing.add(item);
            var feature = item.dataSource.entities.values[0];
            feature.properties['children'] = [
                {name: 'Alice', children: [{name: 'Bailey', children: null}, {name: 'Beatrix', children: null}]}, 
                {name: 'Xavier', children: [{name: 'Yann', children: null}, {name: 'Yvette', children: null}]}
            ];
            var pickedFeatures = new PickedFeatures();
            pickedFeatures.features.push(feature);
            pickedFeatures.allFeaturesAvailablePromise = runLater(function() {});

            panel.showFeatures(pickedFeatures).then(function() {
                var recursedHtml = ''
                    + '<ul>'
                    +   '<li>Alice'
                    +       '<ul>'
                    +           '<li>' + 'Bailey' + '<ul></ul>' + '</li>'
                    +           '<li>' + 'Beatrix' + '<ul></ul>' + '</li>'
                    +       '</ul>'
                    +   '</li>'
                    +   '<li>Xavier'
                    +       '<ul>'
                    +           '<li>' + 'Yann' + '<ul></ul>' + '</li>'
                    +           '<li>' + 'Yvette' + '<ul></ul>' + '</li>'
                    +       '</ul>'
                    +   '</li>'
                    + '</ul>';
                expect(panel.sections[0].info).toBe(recursedHtml);
            }).otherwise(done.fail).then(done);
        }).otherwise(done.fail);
    });

});

function domContainsText(panel, s) {
    for (var i = 0; i < panel._domNodes.length; ++i) {
        if (panel._domNodes[i].innerHTML && panel._domNodes[i].innerHTML.indexOf(s) >= 0) {
            return true;
        }
    }

    return false;
}
