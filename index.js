/**
 * Graphology Minivan
 * ===================
 *
 * Library endpoint.
 */
var isGraph = require('graphology-utils/is-graph');

var slugify = require('./slugify.js'),
    palettes = require('./palettes.js');

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

var DEFAULT_AREA_SCALING_INTERPOLATION = 'linear';
var DEFAULT_COLOR_SCALE = 'interpolateGreys';
var DEFAULT_COLOR_DARK = '#666';
var DEFAULT_COLOR_BRIGHT = '#AAA';
var DEFAULT_MIN_NODE_SIZE = 10;
var DEFAULT_MAX_NODE_SIZE = 100;
var DEFAULT_INVERT_SCALE = false;
var DEFAULT_TRUNCATE_SCALE = true;

var MIN_PROPORTION_FOR_COLOR = 0.01;

/**
 * Helpers.
 */
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

function objectValues(o) {
  var values = [];

  for (var k in o)
    values.push(o[k]);

  return values;
}

/**
 * Main function.
 */
// TODO: add option to sample data for type inference
module.exports = function buildMinivanBundle(graph, options) {
  if (!isGraph(graph))
    throw new Error('graphology-minivan: the given graph is not a valid graphology instance.');

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

      model.cardinality = 0;

      model.modalities = {};
    }
    else {
      model.min = Infinity;
      model.max = -Infinity;
      model.integer = type === 'integer';
    }

    if (attrType === 'ranking-color') {
      model.colorScale = DEFAULT_COLOR_SCALE;
      model.invertScale = DEFAULT_INVERT_SCALE;
      model.truncateScale = DEFAULT_TRUNCATE_SCALE;
    }
    else if (attrType === 'ranking-size') {
      model.areaScaling = {
        min: DEFAULT_MIN_NODE_SIZE,
        max: DEFAULT_MAX_NODE_SIZE,
        interpolation: DEFAULT_AREA_SCALING_INTERPOLATION
      };
    }

    nodeAttributes[k] = model;
  }

  allocatedSlugs.clear();

  for (k in edgeInferences) {
    type = edgeInferences[k];

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
      model.cardinality = 0;
      model.modalities = {};
    }
    else {
      model.min = Infinity;
      model.max = -Infinity;
      model.integer = type === 'integer';
    }

    if (attrType === 'ranking-color') {
      model.colorScale = DEFAULT_COLOR_SCALE;
      model.invertScale = DEFAULT_INVERT_SCALE;
      model.truncateScale = DEFAULT_TRUNCATE_SCALE;
    }
    else if (attrType === 'ranking-size') {
      model.areaScaling = {
        min: DEFAULT_MIN_NODE_SIZE,
        max: DEFAULT_MAX_NODE_SIZE,
        interpolation: DEFAULT_AREA_SCALING_INTERPOLATION
      };
    }

    edgeAttributes[k] = model;
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
          model.cardinality++;

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

  for (i = 0, l = serialized.edges.length; i < l; i++) {
    edge = serialized.edges[i];
    attr = edge.attributes;

    for (k in attr) {
      if (EDGE_ATTRIBUTES_TO_IGNORE.has(k))
        continue;

      v = attr[k];
      model = edgeAttributes[k];

      model.count++;

      if (model.type === 'partition') {
        if (!(v in model.modalities)) {
          model.cardinality++;

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

  // Finalization
  var modality, palette, m, p;

  // TODO: do this with edges
  for (k in nodeAttributes) {
    model = nodeAttributes[k];

    if (model.type === 'partition') {
      palette = palettes[Math.min(9, model.cardinality - 1)];

      p = 0;
      for (m in model.modalities) {
        modality = model.modalities[m];

        // We give a color only if needed
        // TODO: this code is a bit different from the orignal minivan one!
        if (model.cardinality / graph.order >= MIN_PROPORTION_FOR_COLOR) {
          modality.color = palette[p];
          p++;
        }
        else {
          modality.color = DEFAULT_COLOR_DARK;
        }
      }
    }
  }

  bundle.model = {
    nodeAttributes: objectValues(nodeAttributes),
    edgeAttributes: objectValues(edgeAttributes)
  };

  return bundle;
};
