/* eslint no-console: 0 */
// Script converting MiniVan alpha bundle to the current format
var validate = require('../validate.js');

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

        attr.modalities[m.value] = {
          value: m.value,
          color: m.color,
          nodes: m.count,
          internalEdges: matchingData.internalLinks,
          inboundEdges: matchingData.internalLinks,
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
        type: 'partition',
        modalities: {}
      };

      oldModalities.forEach(function(m) {
        attr.modalities[m.value] = {
          value: m.value,
          color: m.color,
          edges: m.count
        };
      });
    }

    delete attr.data;

    return attr;
  });
}

newBundle.graph = {
  settings: bundle.graphSettings,
  attributes: bundle.g.attributes,
  nodes: bundle.g.nodes,
  edges: bundle.g.edges
};

var validationErrors = validate(newBundle);

if (validationErrors) {
  console.error(validationErrors);
  process.exit(1);
}

console.log(JSON.stringify(newBundle, null, 2));
