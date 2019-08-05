/**
 * Graphology Minivan
 * ===================
 *
 * Library endpoint.
 */

/**
 * Constants.
 */
var NODE_ATTRIBUTES_TO_IGNORE = new Set([
  'label',
  'x',
  'y',
  'z',
  'size',
  'color'
]);

var EDGE_ATTRIBUTES_TO_IGNORE = new Set([
  'label',
  'color'
]);

var VALID_ATTR_TYPES = new Set([
  'partition',
  'ranking-size',
  'ranking-color'
]);

function optionOrAttribute(bundle, graph, name) {
  if (options[name])
    bundle[name] = options[name];
  else if (graph.hasAttribute(name))
    bundle[name] = graph.getAttribute(name);
}

module.exports = function buildMinivanBundle(graph, options) {

  var bundle = {
    bundleVersion: '1.0.0',
    consolidated: true
  };

  // Gathering data
  optionOrAttribute(bundle, graph, 'title');
  optionOrAttribute(bundle, graph, 'description');
  optionOrAttribute(bundle, graph, 'url');
  optionOrAttribute(bundle, graph, 'date');

  if (options.authors)
    bundle.authors = options.authors;

  // Serializing graph data
  bundle.graph = graph.export();

  return bundle;
};
