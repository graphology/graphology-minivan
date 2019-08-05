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

var TYPE_TO_ATTR_TYPE = {
  string: 'partition',
  float: 'ranking-size',
  integer: 'ranking-size'
};

var DEFAULT_INTERPOLATION = 'linear';

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

function findAvailableSlug(index, name) {
  var slug,
      i = -1;

  do {
    slug = slugify(name + (i < 0 ? '' : i.toString()));
    i++;
  } while (index.has(slug));

  return slug;
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

  for (i = 0, l = serialized.nodes.length; i < l; i++) {
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

  for (i = 0, l = serialized.edges.length; i < l; i++) {
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

  // Building model
  var nodeAttributes = {},
      edgeAttributes = {},
      allocatedSlugs = new Set();

  var attrType, model, slug;

  for (k in nodeInferences) {
    type = nodeInferences[k];

    // TODO: add user's hints here!
    attrType = TYPE_TO_ATTR_TYPE[type];
    slug = findAvailableSlug(allocatedSlugs, k);
    allocatedSlugs.add(slug);

    model = {
      id: slug,
      name: k,
      count: 0,
      type: attrType
    };

    if (attrType === 'partition') {
      model.stats = {
        modularity: 0
      };

      model.modalities = {};
    }
    else {
      model.min = Infinity;
      model.max = -Infinity;
      model.integer = type === 'integer';
    }

    if (attrType === 'ranking-color') {

    }
    else if (attrType === 'ranking-size') {

    }

    nodeAttributes[k] = model;
  }

  // Second pass to aggregate values & compute metrics
  for (i = 0, l = serialized.nodes.length; i < l; i++) {
    node = serialized.nodes[i];
    attr = node.attributes;

    for (k in attr) {
      if (NODE_ATTRIBUTES_TO_IGNORE.has(k))
        continue;

      v = attr[k];
      model = nodeAttributes[k];

      model.count++;

      if (model.type === 'partition') {
        if (!(v in model.modalities)) {
          model.modalities[v] = {
            value: v,
            nodes: 1
          };
        }
        else {
          model.modalities[v].nodes++;
        }
      }
      else {
        if (v < model.min)
          model.min = v;
        if (v > model.max)
          model.max = v;
      }
    }
  }

  console.log(nodeAttributes, edgeAttributes);

  return bundle;
};
