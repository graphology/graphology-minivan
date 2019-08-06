/* eslint no-console: 0 */
// Script converting MiniVan alpha bundle to the current format
var validate = require('../validate.js');
var stats = require('simple-statistics');

var extent = stats.extent;

require('util').inspect.defaultOptions.depth = null;

var bundle = require(process.argv.slice(-1)[0]);

var newBundle = {
  title: bundle.title,
  description: bundle.description,
  consolidated: bundle.consolidated || false,
  bundleVersion: '1.0.0'
};

if (bundle.authors)
  newBundle.authors = bundle.authors;

if (bundle.url)
  newBundle.url = bundle.url;

if (bundle.date)
  newBundle.date = bundle.date;

newBundle.model = {};

if (bundle.defaultNodeColor)
  newBundle.model.defaultNodeColor = bundle.defaultNodeColor;

if (bundle.defaultEdgeColor)
  newBundle.model.defaultEdgeColor = bundle.defaultEdgeColor;

if (bundle.defaultNodeSize)
  newBundle.model.defaultNodeSize = bundle.defaultNodeSize;

if (bundle.defaultEdgeSize)
  newBundle.model.defaultEdgeSize = bundle.defaultEdgeSize;

if (bundle.nodeAttributes) {
  newBundle.model.nodeAttributes = bundle.nodeAttributes.map(function(attr) {
    if (attr.type === 'partition') {
      var oldModalities = attr.modalities,
          data = attr.data;

      attr = {
        id: attr.id,
        name: attr.name,
        count: attr.count,
        cardinality: 0,
        type: 'partition',
        modalities: {},
        stats: {
          modularity: attr.data.stats.modularity
        }
      };

      oldModalities.forEach(function(m) {
        var matchingData = data.modalitiesIndex[m.value],
            matchingFlow = data.modalityFlow[m.value];

        var flow = {};

        for (var k in matchingFlow)
          flow[k] = {
            count: matchingFlow[k].count,
            expected: matchingFlow[k].expected,
            normalizedDensity: matchingFlow[k].nd
          };

        attr.cardinality++;

        attr.modalities[m.value] = {
          value: m.value,
          color: m.color,
          count: m.count,
          internalEdges: matchingData.internalLinks,
          inboundEdges: matchingData.inboundLinks,
          outboundEdges: matchingData.outboundLinks,
          externalEdges: matchingData.externalLinks,
          internalNormalizedDensity: matchingData.internalNDensity,
          inboundNormalizedDensity: matchingData.inboundNDensity,
          outboundNormalizedDensity: matchingData.outboundNDensity,
          externalNormalizedDensity: matchingData.externalNDensity,
          flow: flow
        };
      });
    }

    // Dropping redundancy
    else if (attr.type === 'ranking-color') {
      delete attr.areaScaling;
    }
    else if (attr.type === 'ranking-size') {
      delete attr.colorScale;
      delete attr.invertScale;
      delete attr.truncateScale;
    }

    // Fixing missing data
    if (
      (attr.type === 'ranking-color' || attr.type === 'ranking-size') &&
      (!('min' in attr) || !('max' in attr))
    ) {
      var minmax = extent(bundle.g.nodes.map(function(node) {
        return node.attributes[attr.id];
      }));

      attr.min = minmax[0];
      attr.max = minmax[1];
    }

    delete attr.data;

    return attr;
  });
}

if (bundle.edgeAttributes) {
  newBundle.model.edgeAttributes = bundle.edgeAttributes.map(function(attr) {
    if (attr.type === 'partition') {
      var oldModalities = attr.modalities;

      attr = {
        id: attr.id,
        name: attr.name,
        count: attr.count,
        cardinality: 0,
        type: 'partition',
        modalities: {}
      };

      oldModalities.forEach(function(m) {
        attr.cardinality++;

        attr.modalities[m.value] = {
          value: m.value,
          color: m.color,
          edges: m.count
        };
      });
    }

    // Dropping redundancy
    else if (attr.type === 'ranking-color') {
      delete attr.areaScaling;
    }
    else if (attr.type === 'ranking-size') {
      delete attr.colorScale;
      delete attr.invertScale;
      delete attr.truncateScale;
    }

    // Fixing missing data
    if (
      (attr.type === 'ranking-color' || attr.type === 'ranking-size') &&
      (!('min' in attr) || !('max' in attr))
    ) {
      var minmax = extent(bundle.g.edges.map(function(edge) {
        return edge.attributes[attr.id];
      }));

      attr.min = minmax[0];
      attr.max = minmax[1];
    }

    delete attr.data;

    return attr;
  });
}

newBundle.graph = {
  attributes: bundle.g.attributes,
  nodes: bundle.g.nodes,
  edges: bundle.g.edges
};

newBundle.settings = bundle.graphSettings;

var validationErrors = validate(newBundle);

if (validationErrors) {
  console.error(validationErrors);
  process.exit(1);
}

console.log(JSON.stringify(newBundle, null, 2));
