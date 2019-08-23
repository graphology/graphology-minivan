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
var isGraph = require('graphology-utils/is-graph'),
    iwanthue = require('iwanthue');

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

// var VALID_ATTR_TYPES = new Set([
//   'ignore',
//   'partition',
//   'ranking-size',
//   'ranking-color'
// ]);

var TYPE_ORDER = {
  string: 0,
  float: 1,
  integer: 2
};

var TYPE_TO_ATTR_TYPE = {
  unknown: 'partition',
  string: 'partition',
  float: 'ranking-size',
  integer: 'ranking-size'
};

var DEFAULT_TYPE_INFERENCE_SAMPLE_SIZE = 50;

var DEFAULT_AREA_SCALING_INTERPOLATION = 'linear';
var DEFAULT_COLOR_SCALE = 'interpolateGreys';
var DEFAULT_COLOR_DARK = '#666';
var DEFAULT_COLOR_BRIGHT = '#AAA';
var DEFAULT_MIN_NODE_SIZE = 10;
var DEFAULT_MAX_NODE_SIZE = 100;
var DEFAULT_INVERT_SCALE = false;
var DEFAULT_TRUNCATE_SCALE = true;

var MIN_PROPORTION_FOR_COLOR = 0.01;
var MAX_PARTITION_CARDINALITY_RATIO = 0.1;
var MAX_PARTITION_CARDINALITY = 30;

var DEFAULT_COLOR_SPACE = {
  cmin: 25.59,
  cmax: 55.59,
  lmin: 60.94,
  lmax: 90.94
};

/**
 * Helpers.
 */
function makeHintOrAttribute(bundle, graph, hints) {

  return function(name) {
    if (hints && hints[name])
      bundle[name] = hints[name];
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

  // NOTE: for now we consider non-scalar & booleans as strings
  if (typeof val === 'object' || typeof val === 'boolean')
    return 'string';

  if (!val)
    return 'null-value';

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

function indexBy(a) {
  var index = {};

  for (var i = 0, l = a.length; i < l; i++)
    index[a[i].key] = a[i];

  return index;
}

function objectValues(o) {
  var values = [];

  for (var k in o)
    values.push(o[k]);

  return values;
}

function cast(attr, val) {

  if (attr.type === 'partition')
    return val ? val.toString() : 'undefined';

  if (attr.integer)
    return Math.trunc(+val);

  return val;
}

var USER_SPEC_MERGERS = {
  areaScaling: function(user, defaults) {
    var toMerge = {};

    if (user.interpolation)
      toMerge.interpolation = user.interpolation;

    return Object.assign(
      {},
      defaults,
      toMerge
    );
  }
};

function userSpecOrDefault(userSpec, name, defaultValue) {
  if (!userSpec)
    return defaultValue;

  if (name in userSpec) {
    var merger = USER_SPEC_MERGERS[name];

    if (merger)
      return merger(userSpec[name], defaultValue);

    return userSpec[name];
  }

  return defaultValue;
}

function generatePalette(count, name, userSettings) {
  if (count === 1)
    return [DEFAULT_COLOR_DARK];

  var settings = Object.assign({}, {
    colorSpace: DEFAULT_COLOR_SPACE,
    seed: name,
    clustering: 'force-vector'
  }, userSettings);

  return iwanthue(count, settings);
}

var DEFAULT_NODE_COLOR_ORDER = {
  'partition': 2,
  'ranking-color': 1
};

function findSuitableDefaultColorAndSize(attributes) {
  var bestColorAttr = null,
      bestColorValue = -Infinity;

  var bestSizeAttr = null,
      bestSizeValue = -Infinity;

  attributes.forEach(function(attr) {
    var colorValue = DEFAULT_NODE_COLOR_ORDER[attr.type] || 0;

    if (colorValue !== 0 && colorValue > bestColorValue) {
      bestColorAttr = attr;
      bestColorValue = colorValue;
    }

    var sizeValue = attr.type === 'ranking-size' ? 1 : 0;

    if (sizeValue !== 0 && sizeValue > bestSizeValue) {
      bestSizeAttr = attr;
      bestSizeValue = sizeValue;
    }
  });

  return {
    color: bestColorAttr ? bestColorAttr.key : null,
    size: bestSizeAttr ? bestSizeAttr.key : null
  };
}

/**
 * Function taking a graphology Graph instance, hint & some settings and
 * returning a viable MiniVan bundle ready to stringify.
 *
 * @note Something is not very right concerning non-scalar values! We will
 *       need to make some decisions at some point.
 *
 * @param  {Graph}   graph    - Target graph.
 * @param  {object}  hints    - A partial bundle with metadata & model to
 *                              complete.
 * @param  {object}  settings - Some settings:
 * @param  {object}    iwanthueSettings        - Custom iwanthue settings for
 *                                               palette settings.
 * @param  {?number}   typeInferenceSampleSize - Size of sample to test for type
 *                                               inference. Default to 100.
 * @return {object}
 */
// TODO: handle ignore type
// TODO: option not to consolidate the bundle
// TODO: right now, if user provides model, it will be used as a whitelist
exports.buildBundle = function buildBundle(graph, hints, settings) {
  if (!isGraph(graph))
    throw new Error('graphology-minivan: the given graph is not a valid graphology instance.');

  hints = hints || {};
  settings = settings || {};

  // Extracting information from user's model
  var userModel = hints.model || {};

  var userNodeAttributes = userModel.nodeAttributes ?
    indexBy(userModel.nodeAttributes) :
    null;
  var userEdgeAttributes = userModel.edgeAttributes ?
    indexBy(userModel.edgeAttributes) :
    null;
  var nodeAttributesWhiteList = userNodeAttributes ?
    new Set(Object.keys(userNodeAttributes)) :
    null;
  var edgeAttributesWhiteList = userEdgeAttributes ?
    new Set(Object.keys(userEdgeAttributes)) :
    null;

  var bundle = {
    bundleVersion: '1.0.0',
    consolidated: true
  };

  var hintOrAttribute = makeHintOrAttribute(bundle, graph, hints);

  // Gathering data
  hintOrAttribute('title');
  hintOrAttribute('description');
  hintOrAttribute('url');
  hintOrAttribute('date');
  hintOrAttribute('authors'); // TODO: Might need some adjustments

  // Serializing graph data
  var serialized = graph.export();
  bundle.graph = serialized;
  bundle.settings = {
    type: graph.type,
    multi: graph.multi
  };

  /**
   * Type inference.
   * ---------------------------------------------------------------------------
   */
  var typeInferenceSampleSize = DEFAULT_TYPE_INFERENCE_SAMPLE_SIZE;

  if (settings.typeInferenceSampleSize)
    typeInferenceSampleSize = settings.typeInferenceSampleSize;

  var nodeInferences = {},
      edgeInferences = {};

  var i, l, k, v, node, edge, attr, type, order;

  for (i = 0, l = Math.min(serialized.nodes.length, typeInferenceSampleSize); i < l; i++) {
    node = serialized.nodes[i];
    attr = node.attributes;

    if (!attr)
      continue;

    for (k in attr) {
      if (
        (nodeAttributesWhiteList && !nodeAttributesWhiteList.has(k)) ||
        NODE_ATTRIBUTES_TO_IGNORE.has(k)
      )
        continue;

      v = attr[k];

      type = guessType(v);
      order = TYPE_ORDER[type];

      if (!(k in nodeInferences) || order < TYPE_ORDER[nodeInferences[k]])
        nodeInferences[k] = type;
    }
  }

  for (i = 0, l = Math.min(serialized.edges.length, typeInferenceSampleSize); i < l; i++) {
    edge = serialized.edges[i];
    attr = edge.attributes;

    if (!attr)
      continue;

    for (k in attr) {
      if (
        (edgeAttributesWhiteList && !edgeAttributesWhiteList.has(k)) ||
        EDGE_ATTRIBUTES_TO_IGNORE.has(k)
      )
        continue;

      v = attr[k];

      type = guessType(v);
      order = TYPE_ORDER[type];

      if (!(k in edgeInferences) || order < TYPE_ORDER[edgeInferences[k]])
        edgeInferences[k] = type;
    }
  }

  /**
   * Building model.
   * ---------------------------------------------------------------------------
   */
  var nodeAttributes = {},
      edgeAttributes = {},
      nodePartitionAttributes = {},
      allocatedSlugs = new Set();

  var attrType, spec, slug, userSpec;

  for (k in nodeInferences) {
    type = nodeInferences[k];

    userSpec = userNodeAttributes && userNodeAttributes[k];

    attrType = userSpec ? userSpec.type : TYPE_TO_ATTR_TYPE[type];
    slug = findAvailableSlug(allocatedSlugs, k);
    allocatedSlugs.add(slug);

    spec = {
      slug: userSpecOrDefault(userSpec, 'slug', slug),
      label: userSpecOrDefault(userSpec, 'label', k),
      key: k,
      count: 0,
      type: attrType
    };

    if (attrType === 'partition') {
      spec.stats = {
        modularity: 0
      };

      spec.cardinality = 0;

      spec.modalities = {};

      nodePartitionAttributes[k] = spec;
    }
    else {
      spec.min = Infinity;
      spec.max = -Infinity;
      spec.integer = userSpecOrDefault(userSpec, 'integer', type === 'integer');
    }

    if (attrType === 'ranking-color') {
      spec.colorScale = userSpecOrDefault(userSpec, 'colorScale', DEFAULT_COLOR_SCALE);
      spec.invertScale = userSpecOrDefault(userSpec, 'invertScale', DEFAULT_INVERT_SCALE);
      spec.truncateScale = userSpecOrDefault(userSpec, 'truncateScale', DEFAULT_TRUNCATE_SCALE);
    }
    else if (attrType === 'ranking-size') {
      spec.areaScaling = userSpecOrDefault(userSpec, 'areaScaling', {
        min: DEFAULT_MIN_NODE_SIZE,
        max: DEFAULT_MAX_NODE_SIZE,
        interpolation: DEFAULT_AREA_SCALING_INTERPOLATION
      });
    }

    nodeAttributes[k] = spec;
  }

  allocatedSlugs.clear();

  for (k in edgeInferences) {
    type = edgeInferences[k];

    userSpec = userEdgeAttributes && userEdgeAttributes[k];

    attrType = userSpec ? userSpec.type : TYPE_TO_ATTR_TYPE[type];
    slug = findAvailableSlug(allocatedSlugs, k);
    allocatedSlugs.add(slug);

    spec = {
      slug: userSpecOrDefault(userSpec, 'slug', k),
      label: userSpecOrDefault(userSpec, 'label', k),
      key: k,
      count: 0,
      type: attrType
    };

    if (attrType === 'partition') {
      spec.cardinality = 0;
      spec.modalities = {};
    }
    else {
      spec.min = Infinity;
      spec.max = -Infinity;
      spec.integer = userSpecOrDefault(userSpec, 'integer', type === 'integer');
    }

    if (attrType === 'ranking-color') {
      spec.colorScale = userSpecOrDefault(userSpec, 'colorScale', DEFAULT_COLOR_SCALE);
      spec.invertScale = userSpecOrDefault(userSpec, 'invertScale', DEFAULT_INVERT_SCALE);
      spec.truncateScale = userSpecOrDefault(userSpec, 'truncateScale', DEFAULT_TRUNCATE_SCALE);
    }
    else if (attrType === 'ranking-size') {
      spec.areaScaling = userSpecOrDefault(userSpec, 'areaScaling', {
        min: DEFAULT_MIN_NODE_SIZE,
        max: DEFAULT_MAX_NODE_SIZE,
        interpolation: DEFAULT_AREA_SCALING_INTERPOLATION
      });
    }

    edgeAttributes[k] = spec;
  }

  /**
   * Consolidation & aggregate statistics.
   * ---------------------------------------------------------------------------
   */
  for (i = 0, l = serialized.nodes.length; i < l; i++) {
    node = serialized.nodes[i];
    attr = node.attributes;

    if (!attr)
      continue;

    for (k in nodeAttributes) {
      spec = nodeAttributes[k];
      v = cast(spec, attr[k]);

      spec.count++;

      if (spec.type === 'partition') {
        if (!(v in spec.modalities)) {
          spec.cardinality++;

          // If we have too much modalities for a partition we bail out
          if (
            (!userNodeAttributes || !(k in userNodeAttributes)) &&
            spec.cardinality >= MAX_PARTITION_CARDINALITY &&
            spec.cardinality >= MAX_PARTITION_CARDINALITY_RATIO * graph.order
          ) {
            delete nodeAttributes[k];
            delete nodePartitionAttributes[k];
            continue;
          }

          spec.modalities[v] = {
            value: v,
            count: 1,
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
          spec.modalities[v].count++;
        }
      }
      else {
        if (v < spec.min)
          spec.min = v;
        if (v > spec.max)
          spec.max = v;
      }
    }
  }

  var vf;

  for (k in nodePartitionAttributes) {
    spec = nodePartitionAttributes[k];

    for (v in spec.modalities) {
      for (vf in spec.modalities) {
        spec.modalities[v].flow[vf] = {
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

    if (!attr)
      continue;

    // Modalities flow
    // NOTE: it seems that minivan version only computes directed statistics!
    for (k in nodePartitionAttributes) {
      spec = nodePartitionAttributes[k];

      sourceModality = graph.getNodeAttribute(edge.source, k);
      targetModality = graph.getNodeAttribute(edge.target, k);

      if (!sourceModality || !targetModality)
        continue;

      sourceModality = cast(spec, sourceModality);
      targetModality = cast(spec, targetModality);

      o = spec.modalities[sourceModality];

      if (sourceModality === targetModality) {
        o.internalEdges += 1;
      }
      else {
        o.outboundEdges += 1;
        o.externalEdges += 1;
        spec.modalities[targetModality].inboundEdges += 1;
        spec.modalities[targetModality].externalEdges += 1;
      }

      o = o.flow[targetModality];

      o.count++;
    }

    // Edge values
    for (k in edgeAttributes) {
      spec = edgeAttributes[k];
      v = cast(spec, attr[k]);

      spec.count++;

      if (spec.type === 'partition') {
        if (!(v in spec.modalities)) {
          spec.cardinality++;

          // If we have too much modalities for a partition we bail out
          if (
            (!userNodeAttributes || !(k in userNodeAttributes)) &&
            spec.cardinality >= MAX_PARTITION_CARDINALITY &&
            spec.cardinality > MAX_PARTITION_CARDINALITY_RATIO * graph.size
          ) {
            delete edgeAttributes[k];
            continue;
          }

          spec.modalities[v] = {
            value: v,
            edges: 1
          };
        }
        else {
          spec.modalities[v].nodes++;
        }
      }
      else {
        if (v < spec.min)
          spec.min = v;
        if (v > spec.max)
          spec.max = v;
      }
    }
  }

  /**
   * Final aggregations.
   * ---------------------------------------------------------------------------
   */
  var modality, palette, nd, m, p;

  for (k in nodeAttributes) {
    spec = nodeAttributes[k];
    userSpec = userNodeAttributes && userNodeAttributes[k];

    if (spec.type === 'partition') {
      if (!userSpec && spec.cardinality < 2) {
        delete nodeAttributes[k];
        continue;
      }

      palette = generatePalette(spec.cardinality, spec.key, settings.iwanthueSettings);

      p = 0;
      for (m in spec.modalities) {
        modality = spec.modalities[m];

        // Updating flow
        for (vf in modality.flow) {
          targetModality = spec.modalities[vf];

          modality.flow[vf].expected = (
            (modality.internalEdges + modality.outboundEdges) *
            (targetModality.internalEdges + targetModality.inboundEdges) /
            (2 * graph.size)
          );

          nd = (
            (modality.flow[vf].count - modality.flow[vf].expected) /
            (4 * graph.size)
          );

          modality.flow[vf].normalizedDensity = nd;

          if (m !== vf) {
            modality.outboundNormalizedDensity += nd;
            modality.externalNormalizedDensity += nd;

            targetModality.inboundNormalizedDensity += nd;
            targetModality.externalNormalizedDensity += nd;

            spec.stats.modularity -= nd;
          }
          else {
            spec.stats.modularity += nd;
          }
        }

        // Updating normalized densities
        modality.internalNormalizedDensity = modality.flow[m].normalizedDensity;

        if (
          userSpec &&
          userSpec.modalities &&
          m in userSpec.modalities &&
          'color' in userSpec.modalities[m]
        ) {
          modality.color = userSpec.modalities[m].color;
          continue;
        }

        // We give a color only if needed
        // TODO: this code is a bit different from the orignal minivan one!
        if (spec.cardinality / graph.order >= MIN_PROPORTION_FOR_COLOR) {
          modality.color = palette[p];
          p++;
        }
        else {
          modality.color = DEFAULT_COLOR_DARK;
        }
      }
    }
  }

  for (k in edgeAttributes) {
    spec = edgeAttributes[k];
    userSpec = userEdgeAttributes && userEdgeAttributes[k];

    if (spec.type === 'partition') {
      if (!userSpec && spec.cardinality < 2) {
        delete edgeAttributes[k];
        continue;
      }

      palette = generatePalette(spec.cardinality, spec.key, settings.iwanthueSettings);

      p = 0;
      for (m in spec.modalities) {
        modality = spec.modalities[m];

        if (
          userSpec &&
          userSpec.modalities &&
          m in userSpec.modalities &&
          'color' in userSpec.modalities[m]
        ) {
          modality.color = userSpec.modalities[m].color;
          continue;
        }

        // We give a color only if needed
        // TODO: this code is a bit different from the orignal minivan one!
        if (spec.cardinality / graph.order >= MIN_PROPORTION_FOR_COLOR) {
          modality.color = palette[p];
          p++;
        }
        else {
          modality.color = DEFAULT_COLOR_BRIGHT;
        }
      }
    }
  }

  /**
   * Finalization.
   * ---------------------------------------------------------------------------
   */
  bundle.model = {
    nodeAttributes: objectValues(nodeAttributes),
    edgeAttributes: objectValues(edgeAttributes)
  };

  // Default color & size attributes
  var suitableDefaultNodeAttributes = findSuitableDefaultColorAndSize(bundle.model.nodeAttributes),
      suitableDefaultEdgeAttributes = findSuitableDefaultColorAndSize(bundle.model.edgeAttributes);

  if (userModel && userModel.defaultNodeSize)
    bundle.model.defaultNodeSize = userModel.defaultNodeSize;
  else if (suitableDefaultNodeAttributes.size)
    bundle.model.defaultNodeSize = suitableDefaultNodeAttributes.size;

  if (userModel && userModel.defaultEdgeSize)
    bundle.model.defaultEdgeSize = userModel.defaultEdgeSize;
  else if (suitableDefaultEdgeAttributes.size)
    bundle.model.defaultEdgeSize = suitableDefaultEdgeAttributes.size;

  if (userModel && userModel.defaultNodeColor)
    bundle.model.defaultNodeColor = userModel.defaultNodeColor;
  else if (suitableDefaultNodeAttributes.color)
    bundle.model.defaultNodeColor = suitableDefaultNodeAttributes.color;

  if (userModel && userModel.defaultEdgeColor)
    bundle.model.defaultEdgeColor = userModel.defaultEdgeColor;
  else if (suitableDefaultEdgeAttributes.color)
    bundle.model.defaultEdgeColor = suitableDefaultEdgeAttributes.color;

  return bundle;
};
