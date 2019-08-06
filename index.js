/**
 * Graphology Minivan
 * ===================
 *
 * Library endpoint.
 *
 * [References]:
 * Newman, M. E. J. (2006). Modularity and community structure in networks.
 * Proceedings of the National Academy of Sciences of the USA,
 * 103(23), 8577–8582.
 * http://doi.org/10.1073/pnas.0601602103
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
  'ignore',
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

  options = options || {};

  var userModel = options.model || {};

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
  bundle.settings = {
    type: graph.type,
    multi: graph.multi
  };

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
      nodePartitionAttributes = {},
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

      nodePartitionAttributes[k] = model;
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

    for (k in nodeAttributes) {
      v = attr[k];
      model = nodeAttributes[k];

      model.count++;

      if (model.type === 'partition') {
        if (!(v in model.modalities)) {
          model.cardinality++;

          model.modalities[v] = {
            value: v,
            nodes: 1,
            internalEdges: 0,
            inboundEdges: 0,
            outboundEdges: 0,
            externalEdges: 0,
            internalNormalizedDensity: 0,
            inboundNormalizedDensity: 0,
            outboundNormalizedDensity: 0,
            externalNormalizedDensity: 0,
            flow: {}
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

  var vf;

  for (k in nodePartitionAttributes) {
    model = nodePartitionAttributes[k];

    for (v in model.modalities) {
      for (vf in model.modalities) {
        model.modalities[v].flow[vf] = {
          count: 0,
          expected: 0,
          normalizedDensity: 0
        };
      }
    }
  }

  var sourceModality, targetModality, o;

  for (i = 0, l = serialized.edges.length; i < l; i++) {
    edge = serialized.edges[i];
    attr = edge.attributes;

    // Modalities flow
    // NOTE: it seems that minivan version only computes directed statistics!
    for (k in nodePartitionAttributes) {
      sourceModality = graph.getNodeAttribute(edge.source, k);
      targetModality = graph.getNodeAttribute(edge.target, k);

      o = nodePartitionAttributes[k]
        .modalities[sourceModality]
        .flow[targetModality];

      o.count++;
    }

    // Edge values
    for (k in edgeAttributes) {
      v = attr[k];
      model = edgeAttributes[k];

      model.count++;

      if (model.type === 'partition') {
        if (!(v in model.modalities)) {
          model.cardinality++;

          model.modalities[v] = {
            value: v,
            edges: 1
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
