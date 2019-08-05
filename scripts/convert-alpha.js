/* eslint no-console: 0 */
// Script converting MiniVan alpha bundle to the current format
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
    if (attr.type === 'partition')
      return 'TODO';

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
