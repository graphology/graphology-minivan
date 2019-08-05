/**
 * Graphology Minivan
 * ===================
 *
 * Library endpoint.
 */
var slugify = require('./slugify.js');

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

var TYPE_ORDER = {
  string: 0,
  float: 1,
  integer: 2
};

function makeOptionOrAttribute(bundle, graph, options) {

  return function(name) {
    if (options.meta && options.meta[name])
      bundle[name] = options.meta[name];
    else if (graph.hasAttribute(name))
      bundle[name] = graph.getAttribute(name);
  };
}

function guessType(val) {
  if (typeof val === 'string')
    return 'string';

  if (typeof val === 'number') {
    if (val === (val | 0))
      return 'integer';

    return 'float';
  }

  return 'unknown';
}

// TODO: add option to sample data for type inference
module.exports = function buildMinivanBundle(graph, options) {

  var bundle = {
    bundleVersion: '1.0.0',
    consolidated: true
  };

  var optionOrAttribute = makeOptionOrAttribute(bundle, graph, options);

  // Gathering data
  optionOrAttribute('title');
  optionOrAttribute('description');
  optionOrAttribute('url');
  optionOrAttribute('date');
  optionOrAttribute('authors'); // TODO: Might need some adjustments

  // Serializing graph data
  var serialized = graph.export();
  bundle.graph = serialized;

  // First pass for type inference
  var nodeInferences = {},
      edgeInferences = {};

  var i, l, k, v, node, edge, attr, type, order;

  for (var i = 0, l = serialized.nodes.length; i < l; i++) {
    node = serialized.nodes[i];
    attr = node.attributes;

    for (k in attr) {
      if (NODE_ATTRIBUTES_TO_IGNORE.has(k))
        continue;

      v = attr[k];

      type = guessType(v);
      order = TYPE_ORDER[type];

      if (!(k in nodeInferences) || order < TYPE_ORDER[nodeInferences[k]])
        nodeInferences[k] = type;
    }
  }

  for (var i = 0, l = serialized.edges.length; i < l; i++) {
    edge = serialized.edges[i];
    attr = edge.attributes;

    for (k in attr) {
      if (EDGE_ATTRIBUTES_TO_IGNORE.has(k))
        continue;

      v = attr[k];

      type = guessType(v);
      order = TYPE_ORDER[type];

      if (!(k in edgeInferences) || order < TYPE_ORDER[edgeInferences[k]])
        edgeInferences[k] = type;
    }
  }

  // Second pass to aggregate metrics and build model

  console.log(nodeInferences, edgeInferences);

  return bundle;
};
