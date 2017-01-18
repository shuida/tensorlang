/* @flow */
"use strict";

const fs = require('fs');
const meow = require('meow');
const compile = require('./compile.js');
const run = require('./run.js');
const test = require('./test.js');

const sourceMapSupport = require('source-map-support');
sourceMapSupport.install();

const opts = meow(`
`,
  {
    string: [
      'source',                // --source "graph agraph { const one scalar float = 1 }"
      'compile',               // --compile foo.pbtxt
      'use-graph',             // --use-graph file.pbtxt
      // Path to GraphDef protobuf with constants to feed
      'feed-constants',        // --feed-constants inputs.pbtxt
      // Prefix to filter for (and strip from) constants
      'feed-constants-strip',  // --feed-constants-strip 'agraph/'
      // Prefix to add to constant names in feed
      'feed-constants-prefix',
      // Prefix of nodes to read result from.
      'result-prefix',         // --result-prefix 'main/'
      // Pattern to discover test graph results.
      'test-result-pattern',   // --test-result-pattern '^test/([^_].*)$'
    ],
    boolean: [
      // Run the tests graphs with given (or default) --test-* options
      'test',
      // Run the graph with given (or default) --result* and --feed-* options
      'run',
      // Whether or not feed constant protobuf is binary
      'feed-constants-binary',
      // Whether or not input is binary.
      'use-graph-binary',
      // Whether or not to result in binary.
      'result-binary',
      'compile-binary',
    ],
  }
);


const suffix = ".nao";

// Examples:
// mypackage
// mypackage.mygraph
const inputs = opts.input;
const flags = opts.flags;

if (inputs.length > 1) {
  opts.showHelp(1);
}

const shouldRunGraph = flags.run || flags.feedConstants || flags.resultPrefix || !(flags.test || flags.compile);
const shouldTestGraph = flags.test;

console.log(inputs);
console.log(flags);

var input = inputs[0];
var fromFile: ?string;
var fromFileBinary: boolean = false;
var fromString: ?string;

function abortOnCatch(promise: Promise<any>) {
  promise.catch((err) => {
    console.log(err);
    process.exit(1);
  });
}

function maybeTest() {
  if (shouldTestGraph) {
    if (fromFile) {
      abortOnCatch(test.fromFile(fromFile, fromFileBinary));
    } else if (fromString) {
      abortOnCatch(test.fromString(fromString, false));
    }
  }
}

function maybeRun() {
  if (shouldRunGraph) {
    if (fromFile) {
      abortOnCatch(run.fromFile(fromFile, fromFileBinary));
    } else if (fromString) {
      abortOnCatch(run.fromString(fromString, false));
    }
  }
}

if (input || flags.source) {
  var source;
  var compileTo = flags.compile;
  var compileToBinary = flags.compileBinary;

  if (flags.source) {
    source = flags.source;
    if (input) {
      console.log("Can't provide a package name and --source option.")
      process.exit(1);
    }
  } else {
    var splitInput = input.split(".", 2);
    var basename = splitInput[0];
    var graphName = splitInput[1] || 'main';
    var filename = `${basename}${suffix}`
    // TODO(adamb) Don't do this synchronously
    source = fs.readFileSync(filename).toString();
  }

  var compilation: Promise<any>;
  if (compileTo) {
    fromFile = compileTo;
    fromFileBinary = compileToBinary;
    compilation = compile.compile(source, compileTo, compileToBinary);
  } else {
    compilation = compile.compileString(source);
    compilation.then((str) => { fromString = str; });
  }

  compilation.then(() => {
    maybeTest();
    maybeRun();
  });
  abortOnCatch(compilation);
} else {
  fromFile = flags.useGraph;
  fromFileBinary = flags.useGraphBinary;
  maybeTest();
  maybeRun();
}
