/* eslint no-console: 0 */
// Script converting MiniVan alpha bundle to the current format
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

if (bundle.edgeAttributes) {
  newBundle.model.edgeAttributes = bundle.edgeAttributes.map(function(attr) {
    if (attr.type === 'partition') {
      const oldModalities = attr.modalities;

      attr = {
        id: attr.id,
        name: attr.name,
        count: attr.count,
        type: 'partition',
        modalities: {}
      };

      oldModalities.forEach(m => {
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

// newBundle.graph = {
//   settings: bundle.graphSettings,
//   attributes: bundle.g.attributes,
//   nodes: bundle.g.nodes,
//   edges: bundle.g.edges
// };

console.log(JSON.stringify(newBundle, null, 2));
