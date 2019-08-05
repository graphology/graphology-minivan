/**
 * Graphology Minivan Unit Tests
 * ==============================
 */
require('util').inspect.defaultOptions.depth = null;

var assert = require('assert');
var buildMinivanBundle = require('./index.js');
var validate = require('./validate.js');
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

describe('graphology-minivan', function() {
  describe('serialization', function() {

    it('should produce a correct bundle.', function() {
      var graph = UndirectedGraph.from(GRAPHS.basic);

      var bundle = buildMinivanBundle(graph, {meta: {url: 'http://supergraph.sv'}});

      var errors = validate(bundle);

      assert(!errors);
    });
  });
});
