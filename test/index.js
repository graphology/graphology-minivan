/* eslint no-console: 0 */
/**
 * Graphology Minivan Unit Tests
 * ==============================
 */
require('util').inspect.defaultOptions.depth = null;

var chai = require('chai');
chai.use(require('chai-roughly'));
var assert = chai.assert;
var expect = chai.expect;
var deepclone = require('lodash/cloneDeep');

var path = require('path');
var fs = require('fs-extra');
var lib = require('../index.js');
var validate = require('../validate.js');
var Graph = require('graphology');

var buildBundle = lib.buildBundle;

var UndirectedGraph = Graph.UndirectedGraph;

var GRAPHS = {
  basic: {
    attributes: {
      title: 'Basic Graph'
    },
    nodes: [
      {
        key: 'A',
        attributes: {
          nb: 14,
          centrality: 0.8,
          color: 'red',
          category: 'fruit'
        }
      },
      {
        key: 'B',
        attributes: {
          nb: 67,
          centrality: -18.74,
          color: 'blue',
          category: 'vegetable'
        }
      },
      {
        key: 'C',
        attributes: {
          nb: 542,
          centrality: 13,
          color: 'red',
          category: 'fruit'
        }
      }
    ],
    edges: [
      {
        source: 'A',
        target: 'B',
        attributes: {
          weight: 0.556,
          cardinality: 34,
          predicate: 'HAS'
        },
        undirected: true
      },
      {
        source: 'B',
        target: 'C',
        attributes: {
          weight: 45,
          cardinality: 12,
          predicate: 'LIKES'
        },
        undirected: true
      }
    ]
  }
};

function loadResource(name) {
  return fs.readJSONSync(path.join(__dirname, 'resources', name + '.json'));
}

var NORDIC_DESIGN = loadResource('nordic-design');

describe('graphology-minivan', function() {
  describe('serialization', function() {

    it('should throw if given an invalid graph.', function() {
      assert.throws(function() {
        buildBundle({hello: 'world'});
      });
    });

    it('should produce a correct bundle.', function() {
      var graph = UndirectedGraph.from(GRAPHS.basic);

      var bundle = buildBundle(graph, {url: 'http://supergraph.sv'});

      var errors = validate(bundle);

      if (errors)
        console.error('Validation error:', errors);

      assert(!errors);

      var model = bundle.model;

      assert.strictEqual(model.defaultNodeSize, 'nb');
      assert.strictEqual(model.defaultEdgeSize, 'weight');
      assert.strictEqual(model.defaultNodeColor, 'category');
      assert.strictEqual(model.defaultEdgeColor, 'predicate');
    });

    it('should work even when some attributes are lacking.', function() {
      var data = deepclone(GRAPHS.basic);

      delete data.nodes[1].attributes;
      delete data.edges[0].attributes;

      var graph = UndirectedGraph.from(data);

      assert.doesNotThrow(function() {
        buildBundle(graph);
      });
    });

    it('should respect given hints.', function() {
      var graph = UndirectedGraph.from(GRAPHS.basic);

      // TODO: support to have only key of attr to index

      var hints = {
        model: {
          nodeAttributes: [
            {
              key: 'centrality',
              label: 'centrality',
              type: 'ranking-size',
              integer: true,
              areaScaling: {
                interpolation: 'pow-2'
              }
            },
            {
              key: 'category',
              type: 'partition',
              modalities: {
                vegetable: {
                  color: '#00FF00'
                }
              }
            }
          ]
        }
      };

      var bundle = buildBundle(graph, hints);

      var centralityAttr = bundle.model.nodeAttributes.find(function(attr) {
        return attr.key === 'centrality';
      });

      assert.deepEqual(centralityAttr, {
        key: 'centrality',
        label: 'centrality',
        slug: 'centrality',
        count: 3,
        type: 'ranking-size',
        min: -18,
        max: 13,
        integer: true,
        areaScaling: {
          min: 10,
          max: 100,
          interpolation: 'pow-2'
        }
      });

      var categoryAttr = bundle.model.nodeAttributes.find(function(attr) {
        return attr.key === 'category';
      });

      assert.strictEqual(categoryAttr.modalities.vegetable.color, '#00FF00');
    });

    it('should be idempotent.', function() {
      var graph = new Graph(NORDIC_DESIGN.settings);
      graph.import(NORDIC_DESIGN.graph);

      var bundle = buildBundle(graph, NORDIC_DESIGN);

      // console.log(bundle.model.nodeAttributes.find(m => m.id === 'branch').stats)
      expect(bundle).to.roughly.deep.equal(NORDIC_DESIGN);
    });

    it('should drop some partition types heuristically.', function() {
      var graph = new Graph(NORDIC_DESIGN.settings);
      graph.import(NORDIC_DESIGN.graph);

      var bundle = buildBundle(graph);

      assert(!bundle.model.nodeAttributes.some(function(attr) {
        return (
          attr.key === 'name' ||
          attr.key === 'homepage' ||
          attr.key === 'prefixes'
        );
      }));

      var partitions = bundle
        .model
        .nodeAttributes
        .filter(function(attr) {
          return attr.type === 'partition';
        })
        .map(function(attr) {
          return {
            key: attr.key,
            cardinality: attr.cardinality
          };
        });

      assert.deepEqual(partitions, [
        {
          key: 'country',
          cardinality: 7
        },
        {
          key: 'branch',
          cardinality: 4
        },
        {
          key: 'design-user-research',
          cardinality: 3
        },
        {
          key: 'digital-design',
          cardinality: 3
        },
        {
          key: 'experience-design',
          cardinality: 3
        },
        {
          key: 'graphic-and-visual-design',
          cardinality: 3
        },
        {
          key: 'management-facilitation-of-development-processes',
          cardinality: 3
        },
        {
          key: 'product-development',
          cardinality: 3
        },
        {
          key: 'service-design',
          cardinality: 3
        },
        {
          key: 'strategic-design',
          cardinality: 3
        },
        {
          key: 'styling-formgiving-of-products-physical-tactile-appearance',
          cardinality: 3
        },
        {
          key: 'discipline',
          cardinality: 9
        }
      ]);
    });
  });
});
