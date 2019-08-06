/**
 * Graphology Minivan Unit Tests
 * ==============================
 */
require('util').inspect.defaultOptions.depth = null;

var assert = require('assert');
var path = require('path');
var fs = require('fs-extra');
var buildMinivanBundle = require('../index.js');
var validate = require('../validate.js');
var Graph = require('graphology');

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
        buildMinivanBundle({hello: 'world'});
      });
    });

    it('should produce a correct bundle.', function() {
      var graph = UndirectedGraph.from(GRAPHS.basic);

      var bundle = buildMinivanBundle(graph, {meta: {url: 'http://supergraph.sv'}});

      var errors = validate(bundle);

      // console.log(bundle);

      assert(!errors);
    });

    it('should be idempotent.', function() {
      var graph = new Graph(NORDIC_DESIGN.settings);
      graph.import(NORDIC_DESIGN.graph);

      // console.log(NORDIC_DESIGN.model.nodeAttributes.find(a => a.id === 'country'));

      var bundle = buildMinivanBundle(graph, {model: NORDIC_DESIGN.model});

      console.log(bundle.model.nodeAttributes.find(m => m.id === 'country'));
    });
  });
});
