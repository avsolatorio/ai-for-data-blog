// modules are defined as an array
// [ module function, map of requires ]
//
// map of requires is short require name -> numeric require
//
// anything defined in a previous bundle is accessed via the
// orig method which is the require for previous bundles

(function (modules, entry, mainEntry, parcelRequireName, globalName) {
  /* eslint-disable no-undef */
  var globalObject =
    typeof globalThis !== 'undefined'
      ? globalThis
      : typeof self !== 'undefined'
      ? self
      : typeof window !== 'undefined'
      ? window
      : typeof global !== 'undefined'
      ? global
      : {};
  /* eslint-enable no-undef */

  // Save the require from previous bundle to this closure if any
  var previousRequire =
    typeof globalObject[parcelRequireName] === 'function' &&
    globalObject[parcelRequireName];

  var cache = previousRequire.cache || {};
  // Do not use `require` to prevent Webpack from trying to bundle this call
  var nodeRequire =
    typeof module !== 'undefined' &&
    typeof module.require === 'function' &&
    module.require.bind(module);

  function newRequire(name, jumped) {
    if (!cache[name]) {
      if (!modules[name]) {
        // if we cannot find the module within our internal map or
        // cache jump to the current global require ie. the last bundle
        // that was added to the page.
        var currentRequire =
          typeof globalObject[parcelRequireName] === 'function' &&
          globalObject[parcelRequireName];
        if (!jumped && currentRequire) {
          return currentRequire(name, true);
        }

        // If there are other bundles on this page the require from the
        // previous one is saved to 'previousRequire'. Repeat this as
        // many times as there are bundles until the module is found or
        // we exhaust the require chain.
        if (previousRequire) {
          return previousRequire(name, true);
        }

        // Try the node require function if it exists.
        if (nodeRequire && typeof name === 'string') {
          return nodeRequire(name);
        }

        var err = new Error("Cannot find module '" + name + "'");
        err.code = 'MODULE_NOT_FOUND';
        throw err;
      }

      localRequire.resolve = resolve;
      localRequire.cache = {};

      var module = (cache[name] = new newRequire.Module(name));

      modules[name][0].call(
        module.exports,
        localRequire,
        module,
        module.exports,
        this
      );
    }

    return cache[name].exports;

    function localRequire(x) {
      var res = localRequire.resolve(x);
      return res === false ? {} : newRequire(res);
    }

    function resolve(x) {
      var id = modules[name][1][x];
      return id != null ? id : x;
    }
  }

  function Module(moduleName) {
    this.id = moduleName;
    this.bundle = newRequire;
    this.exports = {};
  }

  newRequire.isParcelRequire = true;
  newRequire.Module = Module;
  newRequire.modules = modules;
  newRequire.cache = cache;
  newRequire.parent = previousRequire;
  newRequire.register = function (id, exports) {
    modules[id] = [
      function (require, module) {
        module.exports = exports;
      },
      {},
    ];
  };

  Object.defineProperty(newRequire, 'root', {
    get: function () {
      return globalObject[parcelRequireName];
    },
  });

  globalObject[parcelRequireName] = newRequire;

  for (var i = 0; i < entry.length; i++) {
    newRequire(entry[i]);
  }

  if (mainEntry) {
    // Expose entry point to Node, AMD or browser globals
    // Based on https://github.com/ForbesLindesay/umd/blob/master/template.js
    var mainExports = newRequire(mainEntry);

    // CommonJS
    if (typeof exports === 'object' && typeof module !== 'undefined') {
      module.exports = mainExports;

      // RequireJS
    } else if (typeof define === 'function' && define.amd) {
      define(function () {
        return mainExports;
      });

      // <script>
    } else if (globalName) {
      this[globalName] = mainExports;
    }
  }
})({"bCPQv":[function(require,module,exports) {
var global = arguments[3];
var HMR_HOST = null;
var HMR_PORT = null;
var HMR_SECURE = false;
var HMR_ENV_HASH = "d6ea1d42532a7575";
var HMR_USE_SSE = false;
module.bundle.HMR_BUNDLE_ID = "bcd7d995be681503";
"use strict";
/* global HMR_HOST, HMR_PORT, HMR_ENV_HASH, HMR_SECURE, HMR_USE_SSE, chrome, browser, __parcel__import__, __parcel__importScripts__, ServiceWorkerGlobalScope */ /*::
import type {
  HMRAsset,
  HMRMessage,
} from '@parcel/reporter-dev-server/src/HMRServer.js';
interface ParcelRequire {
  (string): mixed;
  cache: {|[string]: ParcelModule|};
  hotData: {|[string]: mixed|};
  Module: any;
  parent: ?ParcelRequire;
  isParcelRequire: true;
  modules: {|[string]: [Function, {|[string]: string|}]|};
  HMR_BUNDLE_ID: string;
  root: ParcelRequire;
}
interface ParcelModule {
  hot: {|
    data: mixed,
    accept(cb: (Function) => void): void,
    dispose(cb: (mixed) => void): void,
    // accept(deps: Array<string> | string, cb: (Function) => void): void,
    // decline(): void,
    _acceptCallbacks: Array<(Function) => void>,
    _disposeCallbacks: Array<(mixed) => void>,
  |};
}
interface ExtensionContext {
  runtime: {|
    reload(): void,
    getURL(url: string): string;
    getManifest(): {manifest_version: number, ...};
  |};
}
declare var module: {bundle: ParcelRequire, ...};
declare var HMR_HOST: string;
declare var HMR_PORT: string;
declare var HMR_ENV_HASH: string;
declare var HMR_SECURE: boolean;
declare var HMR_USE_SSE: boolean;
declare var chrome: ExtensionContext;
declare var browser: ExtensionContext;
declare var __parcel__import__: (string) => Promise<void>;
declare var __parcel__importScripts__: (string) => Promise<void>;
declare var globalThis: typeof self;
declare var ServiceWorkerGlobalScope: Object;
*/ var OVERLAY_ID = "__parcel__error__overlay__";
var OldModule = module.bundle.Module;
function Module(moduleName) {
    OldModule.call(this, moduleName);
    this.hot = {
        data: module.bundle.hotData[moduleName],
        _acceptCallbacks: [],
        _disposeCallbacks: [],
        accept: function(fn) {
            this._acceptCallbacks.push(fn || function() {});
        },
        dispose: function(fn) {
            this._disposeCallbacks.push(fn);
        }
    };
    module.bundle.hotData[moduleName] = undefined;
}
module.bundle.Module = Module;
module.bundle.hotData = {};
var checkedAssets /*: {|[string]: boolean|} */ , assetsToDispose /*: Array<[ParcelRequire, string]> */ , assetsToAccept /*: Array<[ParcelRequire, string]> */ ;
function getHostname() {
    return HMR_HOST || (location.protocol.indexOf("http") === 0 ? location.hostname : "localhost");
}
function getPort() {
    return HMR_PORT || location.port;
}
// eslint-disable-next-line no-redeclare
var parent = module.bundle.parent;
if ((!parent || !parent.isParcelRequire) && typeof WebSocket !== "undefined") {
    var hostname = getHostname();
    var port = getPort();
    var protocol = HMR_SECURE || location.protocol == "https:" && ![
        "localhost",
        "127.0.0.1",
        "0.0.0.0"
    ].includes(hostname) ? "wss" : "ws";
    var ws;
    if (HMR_USE_SSE) ws = new EventSource("/__parcel_hmr");
    else try {
        ws = new WebSocket(protocol + "://" + hostname + (port ? ":" + port : "") + "/");
    } catch (err) {
        if (err.message) console.error(err.message);
        ws = {};
    }
    // Web extension context
    var extCtx = typeof browser === "undefined" ? typeof chrome === "undefined" ? null : chrome : browser;
    // Safari doesn't support sourceURL in error stacks.
    // eval may also be disabled via CSP, so do a quick check.
    var supportsSourceURL = false;
    try {
        (0, eval)('throw new Error("test"); //# sourceURL=test.js');
    } catch (err) {
        supportsSourceURL = err.stack.includes("test.js");
    }
    // $FlowFixMe
    ws.onmessage = async function(event /*: {data: string, ...} */ ) {
        checkedAssets = {} /*: {|[string]: boolean|} */ ;
        assetsToAccept = [];
        assetsToDispose = [];
        var data /*: HMRMessage */  = JSON.parse(event.data);
        if (data.type === "update") {
            // Remove error overlay if there is one
            if (typeof document !== "undefined") removeErrorOverlay();
            let assets = data.assets.filter((asset)=>asset.envHash === HMR_ENV_HASH);
            // Handle HMR Update
            let handled = assets.every((asset)=>{
                return asset.type === "css" || asset.type === "js" && hmrAcceptCheck(module.bundle.root, asset.id, asset.depsByBundle);
            });
            if (handled) {
                console.clear();
                // Dispatch custom event so other runtimes (e.g React Refresh) are aware.
                if (typeof window !== "undefined" && typeof CustomEvent !== "undefined") window.dispatchEvent(new CustomEvent("parcelhmraccept"));
                await hmrApplyUpdates(assets);
                // Dispose all old assets.
                let processedAssets = {} /*: {|[string]: boolean|} */ ;
                for(let i = 0; i < assetsToDispose.length; i++){
                    let id = assetsToDispose[i][1];
                    if (!processedAssets[id]) {
                        hmrDispose(assetsToDispose[i][0], id);
                        processedAssets[id] = true;
                    }
                }
                // Run accept callbacks. This will also re-execute other disposed assets in topological order.
                processedAssets = {};
                for(let i = 0; i < assetsToAccept.length; i++){
                    let id = assetsToAccept[i][1];
                    if (!processedAssets[id]) {
                        hmrAccept(assetsToAccept[i][0], id);
                        processedAssets[id] = true;
                    }
                }
            } else fullReload();
        }
        if (data.type === "error") {
            // Log parcel errors to console
            for (let ansiDiagnostic of data.diagnostics.ansi){
                let stack = ansiDiagnostic.codeframe ? ansiDiagnostic.codeframe : ansiDiagnostic.stack;
                console.error("\uD83D\uDEA8 [parcel]: " + ansiDiagnostic.message + "\n" + stack + "\n\n" + ansiDiagnostic.hints.join("\n"));
            }
            if (typeof document !== "undefined") {
                // Render the fancy html overlay
                removeErrorOverlay();
                var overlay = createErrorOverlay(data.diagnostics.html);
                // $FlowFixMe
                document.body.appendChild(overlay);
            }
        }
    };
    if (ws instanceof WebSocket) {
        ws.onerror = function(e) {
            if (e.message) console.error(e.message);
        };
        ws.onclose = function() {
            console.warn("[parcel] \uD83D\uDEA8 Connection to the HMR server was lost");
        };
    }
}
function removeErrorOverlay() {
    var overlay = document.getElementById(OVERLAY_ID);
    if (overlay) {
        overlay.remove();
        console.log("[parcel] \u2728 Error resolved");
    }
}
function createErrorOverlay(diagnostics) {
    var overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    let errorHTML = '<div style="background: black; opacity: 0.85; font-size: 16px; color: white; position: fixed; height: 100%; width: 100%; top: 0px; left: 0px; padding: 30px; font-family: Menlo, Consolas, monospace; z-index: 9999;">';
    for (let diagnostic of diagnostics){
        let stack = diagnostic.frames.length ? diagnostic.frames.reduce((p, frame)=>{
            return `${p}
<a href="/__parcel_launch_editor?file=${encodeURIComponent(frame.location)}" style="text-decoration: underline; color: #888" onclick="fetch(this.href); return false">${frame.location}</a>
${frame.code}`;
        }, "") : diagnostic.stack;
        errorHTML += `
      <div>
        <div style="font-size: 18px; font-weight: bold; margin-top: 20px;">
          \u{1F6A8} ${diagnostic.message}
        </div>
        <pre>${stack}</pre>
        <div>
          ${diagnostic.hints.map((hint)=>"<div>\uD83D\uDCA1 " + hint + "</div>").join("")}
        </div>
        ${diagnostic.documentation ? `<div>\u{1F4DD} <a style="color: violet" href="${diagnostic.documentation}" target="_blank">Learn more</a></div>` : ""}
      </div>
    `;
    }
    errorHTML += "</div>";
    overlay.innerHTML = errorHTML;
    return overlay;
}
function fullReload() {
    if ("reload" in location) location.reload();
    else if (extCtx && extCtx.runtime && extCtx.runtime.reload) extCtx.runtime.reload();
}
function getParents(bundle, id) /*: Array<[ParcelRequire, string]> */ {
    var modules = bundle.modules;
    if (!modules) return [];
    var parents = [];
    var k, d, dep;
    for(k in modules)for(d in modules[k][1]){
        dep = modules[k][1][d];
        if (dep === id || Array.isArray(dep) && dep[dep.length - 1] === id) parents.push([
            bundle,
            k
        ]);
    }
    if (bundle.parent) parents = parents.concat(getParents(bundle.parent, id));
    return parents;
}
function updateLink(link) {
    var href = link.getAttribute("href");
    if (!href) return;
    var newLink = link.cloneNode();
    newLink.onload = function() {
        if (link.parentNode !== null) // $FlowFixMe
        link.parentNode.removeChild(link);
    };
    newLink.setAttribute("href", // $FlowFixMe
    href.split("?")[0] + "?" + Date.now());
    // $FlowFixMe
    link.parentNode.insertBefore(newLink, link.nextSibling);
}
var cssTimeout = null;
function reloadCSS() {
    if (cssTimeout) return;
    cssTimeout = setTimeout(function() {
        var links = document.querySelectorAll('link[rel="stylesheet"]');
        for(var i = 0; i < links.length; i++){
            // $FlowFixMe[incompatible-type]
            var href /*: string */  = links[i].getAttribute("href");
            var hostname = getHostname();
            var servedFromHMRServer = hostname === "localhost" ? new RegExp("^(https?:\\/\\/(0.0.0.0|127.0.0.1)|localhost):" + getPort()).test(href) : href.indexOf(hostname + ":" + getPort());
            var absolute = /^https?:\/\//i.test(href) && href.indexOf(location.origin) !== 0 && !servedFromHMRServer;
            if (!absolute) updateLink(links[i]);
        }
        cssTimeout = null;
    }, 50);
}
function hmrDownload(asset) {
    if (asset.type === "js") {
        if (typeof document !== "undefined") {
            let script = document.createElement("script");
            script.src = asset.url + "?t=" + Date.now();
            if (asset.outputFormat === "esmodule") script.type = "module";
            return new Promise((resolve, reject)=>{
                var _document$head;
                script.onload = ()=>resolve(script);
                script.onerror = reject;
                (_document$head = document.head) === null || _document$head === void 0 || _document$head.appendChild(script);
            });
        } else if (typeof importScripts === "function") {
            // Worker scripts
            if (asset.outputFormat === "esmodule") return import(asset.url + "?t=" + Date.now());
            else return new Promise((resolve, reject)=>{
                try {
                    importScripts(asset.url + "?t=" + Date.now());
                    resolve();
                } catch (err) {
                    reject(err);
                }
            });
        }
    }
}
async function hmrApplyUpdates(assets) {
    global.parcelHotUpdate = Object.create(null);
    let scriptsToRemove;
    try {
        // If sourceURL comments aren't supported in eval, we need to load
        // the update from the dev server over HTTP so that stack traces
        // are correct in errors/logs. This is much slower than eval, so
        // we only do it if needed (currently just Safari).
        // https://bugs.webkit.org/show_bug.cgi?id=137297
        // This path is also taken if a CSP disallows eval.
        if (!supportsSourceURL) {
            let promises = assets.map((asset)=>{
                var _hmrDownload;
                return (_hmrDownload = hmrDownload(asset)) === null || _hmrDownload === void 0 ? void 0 : _hmrDownload.catch((err)=>{
                    // Web extension fix
                    if (extCtx && extCtx.runtime && extCtx.runtime.getManifest().manifest_version == 3 && typeof ServiceWorkerGlobalScope != "undefined" && global instanceof ServiceWorkerGlobalScope) {
                        extCtx.runtime.reload();
                        return;
                    }
                    throw err;
                });
            });
            scriptsToRemove = await Promise.all(promises);
        }
        assets.forEach(function(asset) {
            hmrApply(module.bundle.root, asset);
        });
    } finally{
        delete global.parcelHotUpdate;
        if (scriptsToRemove) scriptsToRemove.forEach((script)=>{
            if (script) {
                var _document$head2;
                (_document$head2 = document.head) === null || _document$head2 === void 0 || _document$head2.removeChild(script);
            }
        });
    }
}
function hmrApply(bundle /*: ParcelRequire */ , asset /*:  HMRAsset */ ) {
    var modules = bundle.modules;
    if (!modules) return;
    if (asset.type === "css") reloadCSS();
    else if (asset.type === "js") {
        let deps = asset.depsByBundle[bundle.HMR_BUNDLE_ID];
        if (deps) {
            if (modules[asset.id]) {
                // Remove dependencies that are removed and will become orphaned.
                // This is necessary so that if the asset is added back again, the cache is gone, and we prevent a full page reload.
                let oldDeps = modules[asset.id][1];
                for(let dep in oldDeps)if (!deps[dep] || deps[dep] !== oldDeps[dep]) {
                    let id = oldDeps[dep];
                    let parents = getParents(module.bundle.root, id);
                    if (parents.length === 1) hmrDelete(module.bundle.root, id);
                }
            }
            if (supportsSourceURL) // Global eval. We would use `new Function` here but browser
            // support for source maps is better with eval.
            (0, eval)(asset.output);
            // $FlowFixMe
            let fn = global.parcelHotUpdate[asset.id];
            modules[asset.id] = [
                fn,
                deps
            ];
        } else if (bundle.parent) hmrApply(bundle.parent, asset);
    }
}
function hmrDelete(bundle, id) {
    let modules = bundle.modules;
    if (!modules) return;
    if (modules[id]) {
        // Collect dependencies that will become orphaned when this module is deleted.
        let deps = modules[id][1];
        let orphans = [];
        for(let dep in deps){
            let parents = getParents(module.bundle.root, deps[dep]);
            if (parents.length === 1) orphans.push(deps[dep]);
        }
        // Delete the module. This must be done before deleting dependencies in case of circular dependencies.
        delete modules[id];
        delete bundle.cache[id];
        // Now delete the orphans.
        orphans.forEach((id)=>{
            hmrDelete(module.bundle.root, id);
        });
    } else if (bundle.parent) hmrDelete(bundle.parent, id);
}
function hmrAcceptCheck(bundle /*: ParcelRequire */ , id /*: string */ , depsByBundle /*: ?{ [string]: { [string]: string } }*/ ) {
    if (hmrAcceptCheckOne(bundle, id, depsByBundle)) return true;
    // Traverse parents breadth first. All possible ancestries must accept the HMR update, or we'll reload.
    let parents = getParents(module.bundle.root, id);
    let accepted = false;
    while(parents.length > 0){
        let v = parents.shift();
        let a = hmrAcceptCheckOne(v[0], v[1], null);
        if (a) // If this parent accepts, stop traversing upward, but still consider siblings.
        accepted = true;
        else {
            // Otherwise, queue the parents in the next level upward.
            let p = getParents(module.bundle.root, v[1]);
            if (p.length === 0) {
                // If there are no parents, then we've reached an entry without accepting. Reload.
                accepted = false;
                break;
            }
            parents.push(...p);
        }
    }
    return accepted;
}
function hmrAcceptCheckOne(bundle /*: ParcelRequire */ , id /*: string */ , depsByBundle /*: ?{ [string]: { [string]: string } }*/ ) {
    var modules = bundle.modules;
    if (!modules) return;
    if (depsByBundle && !depsByBundle[bundle.HMR_BUNDLE_ID]) {
        // If we reached the root bundle without finding where the asset should go,
        // there's nothing to do. Mark as "accepted" so we don't reload the page.
        if (!bundle.parent) return true;
        return hmrAcceptCheck(bundle.parent, id, depsByBundle);
    }
    if (checkedAssets[id]) return true;
    checkedAssets[id] = true;
    var cached = bundle.cache[id];
    assetsToDispose.push([
        bundle,
        id
    ]);
    if (!cached || cached.hot && cached.hot._acceptCallbacks.length) {
        assetsToAccept.push([
            bundle,
            id
        ]);
        return true;
    }
}
function hmrDispose(bundle /*: ParcelRequire */ , id /*: string */ ) {
    var cached = bundle.cache[id];
    bundle.hotData[id] = {};
    if (cached && cached.hot) cached.hot.data = bundle.hotData[id];
    if (cached && cached.hot && cached.hot._disposeCallbacks.length) cached.hot._disposeCallbacks.forEach(function(cb) {
        cb(bundle.hotData[id]);
    });
    delete bundle.cache[id];
}
function hmrAccept(bundle /*: ParcelRequire */ , id /*: string */ ) {
    // Execute the module.
    bundle(id);
    // Run the accept callbacks in the new version of the module.
    var cached = bundle.cache[id];
    if (cached && cached.hot && cached.hot._acceptCallbacks.length) cached.hot._acceptCallbacks.forEach(function(cb) {
        var assetsToAlsoAccept = cb(function() {
            return getParents(module.bundle.root, id);
        });
        if (assetsToAlsoAccept && assetsToAccept.length) {
            assetsToAlsoAccept.forEach(function(a) {
                hmrDispose(a[0], a[1]);
            });
            // $FlowFixMe[method-unbinding]
            assetsToAccept.push.apply(assetsToAccept, assetsToAlsoAccept);
        }
    });
}

},{}],"9UXew":[function(require,module,exports) {
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
parcelHelpers.export(exports, "bm25", ()=>(0, _winkBm25TextSearchDefault.default));
parcelHelpers.export(exports, "similarity", ()=>(0, _computeCosineSimilarityDefault.default));
var _winkBm25TextSearch = require("wink-bm25-text-search");
var _winkBm25TextSearchDefault = parcelHelpers.interopDefault(_winkBm25TextSearch);
var _computeCosineSimilarity = require("compute-cosine-similarity");
var _computeCosineSimilarityDefault = parcelHelpers.interopDefault(_computeCosineSimilarity);
console.log("Hello similarity...");
console.log((0, _computeCosineSimilarityDefault.default));
console.log("Hello bm25...");
console.log((0, _winkBm25TextSearchDefault.default));

},{"wink-bm25-text-search":"eAkKE","compute-cosine-similarity":"8erMS","@parcel/transformer-js/src/esmodule-helpers.js":"fD7H8"}],"eAkKE":[function(require,module,exports) {
//     wink-bm25-text-search
//
//     Copyright (C) GRAYPE Systems Private Limited
//
//     This file is part of “wink-bm25-text-search”.
//
//     Permission is hereby granted, free of charge, to any person obtaining a
//     copy of this software and associated documentation files (the "Software"),
//     to deal in the Software without restriction, including without limitation
//     the rights to use, copy, modify, merge, publish, distribute, sublicense,
//     and/or sell copies of the Software, and to permit persons to whom the
//     Software is furnished to do so, subject to the following conditions:
//
//     The above copyright notice and this permission notice shall be included
//     in all copies or substantial portions of the Software.
//
//     THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
//     OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
//     FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
//     THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
//     LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
//     FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
//     DEALINGS IN THE SOFTWARE.
//
var helpers = require("10035a6f8fe9fffc");
/* eslint guard-for-in: 0 */ /* eslint complexity: [ "error", 25 ] */ // It is a BM25F In-memory Search engine for text and exposes following
// methods:
// 1. `definePrepTasks` allows to define field-wise (optional) pipeline of
// functions that will be used to prepare each input prior to *search/predict*
// and *addDoc/learn*.
// 2. `defineConfig` sets up the configuration for *field-wise weights*,
// *BM25F parameters*, and **field names whoes original value** needs to be retained.
// 3. `addDoc/learn` adds a document using its unique id. The document is supplied
// as an Javascript object, where each property is the field of the document
// and its value is the text.
// 4. `consolidate` learnings prior to search/predict.
// 5. `search/predict` searches for the input text and returns the resultant
// document ids, sorted by their relevance along with the score. The number of
// results returned can be controlled via a limit argument that defaults to **10**.
// The last optional argument is a filter function that must return a `boolean`
// value, which is used to filter documents.
// 6. `exportJSON` exports the learnings in JSON format.
// 7. `importJSON` imports the learnings from JSON that may have been saved on disk.
// 8. `reset` all the learnings except the preparatory tasks.
var bm25fIMS = function() {
    // Preparatory tasks that are executed on the `addDoc` & `search` input.
    var pTasks = [];
    // And its count.
    var pTaskCount;
    // Field level prep tasks.
    var flds = Object.create(null);
    // Returned!
    var methods = Object.create(null);
    // Term Frequencies & length of each document.
    var documents = Object.create(null);
    // Inverted Index for faster search
    var invertedIdx = [];
    // IDF for each tokens, tokens are referenced via their numerical index.
    var idf = [];
    // Set true on first call to `addDoc/learn` to prevent changing config.
    var learned = false;
    // The `addDoc()predict()` function checks for this being true; set
    // in `consolidate()`.
    var consolidated = false;
    // Total documents added.
    var totalDocs = 0;
    // Total number of tokens across all documents added.
    var totalCorpusLength = 0;
    // Their average.
    var avgCorpusLength = 0;
    // BM25F Configuration; set up in `defineConfig()`.
    var config = null;
    // The `token: index` mapping; `index` is used everywhere instead
    // of the `token`
    var token2Index = Object.create(null);
    // Index's initial value, incremented with every new word.
    var currTokenIndex = 0;
    // ### Private functions
    // #### Perpare Input
    // Prepares the `input` by executing the pipeline of tasks defined in the
    // `field` specific `pTasks` set via `definePrepTasks()`.
    // If `field` is not specified then default `pTasks` are used.
    // If the `field` specific `pTasks` are not defined then it automatically
    // switches to default `pTasks`.
    var prepareInput = function(input, field) {
        var processedInput = input;
        var pt = flds[field] && flds[field].pTasks || pTasks;
        var ptc = flds[field] && flds[field].pTaskCount || pTaskCount;
        for(var i = 0; i < ptc; i += 1)processedInput = pt[i](processedInput);
        return processedInput;
    }; // prepareInput()
    // #### Update Freq
    // Updates the `freq` of each term in the `text` after pre-processing it via
    // `prepareInput()`; while updating, it takes care of `field's` `weight`.
    var updateFreq = function(id, text, weight, freq, field) {
        // Tokenized `text`.
        var tkns = prepareInput(text, field);
        // Temp token holder.
        var t;
        for(var i = 0, imax = tkns.length; i < imax; i += 1){
            t = tkns[i];
            // Build `token: index` mapping.
            if (token2Index[t] === undefined) {
                token2Index[t] = currTokenIndex;
                currTokenIndex += 1;
            }
            t = token2Index[t];
            if (freq[t] === undefined) {
                freq[t] = weight;
                invertedIdx[t] = invertedIdx[t] || [];
                invertedIdx[t].push(id);
            } else freq[t] += weight;
        }
        // Length can not be negative!
        return tkns.length * Math.abs(weight);
    }; // updateFreq()
    // ### Exposed Functions
    // #### Define Prep Tasks
    // Defines the `tasks` required to prepare the input for `addDoc` and `search()`
    // The `tasks` should be an array of functions; using these function a simple
    // pipeline is built to serially transform the input to the output.
    // It validates the `tasks` before updating the `pTasks`.
    // If validation fails it throws an appropriate error.
    // Tasks can be defined separately for each field. However if the field is not
    // specified (i.e. `null` or `undefined`), then the `tasks` become default.
    // Note, `field = 'search'` is reserved for prep tasks for search string; However
    // if the same is not specified, the default tasks are used for pre-processing.
    var definePrepTasks = function(tasks, field) {
        if (config === null) throw Error("winkBM25S: Config must be defined before defining prepTasks.");
        if (!helpers.array.isArray(tasks)) throw Error("winkBM25S: Tasks should be an array, instead found: " + JSON.stringify(tasks));
        for(var i = 0, imax = tasks.length; i < imax; i += 1){
            if (typeof tasks[i] !== "function") throw Error("winkBM25S: Tasks should contain function, instead found: " + typeof tasks[i]);
        }
        var fldWeights = config.fldWeights;
        if (field === undefined || field === null) {
            pTasks = tasks;
            pTaskCount = tasks.length;
        } else {
            if (!fldWeights[field] || typeof field !== "string") throw Error("winkBM25S: Field name is missing or it is not a string: " + JSON.stringify(field) + "/" + typeof field);
            flds[field] = flds[field] || Object.create(null);
            flds[field].pTasks = tasks;
            flds[field].pTaskCount = tasks.length;
        }
        return tasks.length;
    }; // definePrepTasks()
    // #### Define Config
    // Defines the configuration for BM25F using `fldWeights` and `bm25Params`
    // properties of `cfg` object.</br>
    // The `fldWeights` defines the weight for each field of the document. This gives
    // a semantic nudge to search and are used as a mutiplier to the count
    // (frequency) of each token contained in that field of the document. It should
    // be a JS object containing `field-name/value` pairs. If a field's weight is
    // not defined, that field is **ignored**. The field weights must be defined before
    // attempting to add a document via `addDoc()`; they can only be defined once.
    // If any document's field is not defined here then that field is **ignored**.
    // </br>
    // The `k`, `b` and `k1` properties of `bm25Params` object define the smoothing
    // factor for IDF, degree of normalization for TF, and saturation control factor
    // respectively for the BM25F. Their default values are **1**, **0.75**, and
    // **1.2**.<br/>
    // The `ovFieldNames` is an array of field names whose original value needs to
    // be retained.
    var defineConfig = function(cfg) {
        if (learned) throw Error("winkBM25S: config must be defined before learning/addition starts!");
        if (!helpers.object.isObject(cfg)) throw Error("winkBM25S: config must be a config object, instead found: " + JSON.stringify(cfg));
        // If `fldWeights` are absent throw error.
        if (!helpers.object.isObject(cfg.fldWeights)) throw Error("winkBM25S: fldWeights must be an object, instead found: " + JSON.stringify(cfg.fldWeights));
        // There should be at least one defined field!
        if (helpers.object.keys(cfg.fldWeights).length === 0) throw Error("winkBM25S: Field config has no field defined.");
        // Setup configuration now.
        config = Object.create(null);
        // Field config for BM25**F**
        config.fldWeights = Object.create(null);
        config.bm25Params = Object.create(null);
        // **Controls TF part:**<br/>
        // `k1` controls saturation of token's frequency; higher value delays saturation
        // with increase in frequency.
        config.bm25Params.k1 = 1.2;
        // `b` controls the degree of normalization; **0** means no normalization and **1**
        // indicates complete normalization!
        config.bm25Params.b = 0.75;
        // **Controls IDF part:**<br/>
        // `k` controls impact of IDF; should be >= 0; a higher value means lower
        // the impact of IDF.
        config.bm25Params.k = 1;
        // Setup field weights.
        for(var field in cfg.fldWeights){
            // The `null` check is required as `isNaN( null )` returns `false`!!
            // This first ensures non-`null/undefined/0` values before testing for NaN.
            if (!cfg.fldWeights[field] || isNaN(cfg.fldWeights[field])) throw Error("winkBM25S: Field weight should be number >0, instead found: " + JSON.stringify(cfg.fldWeights[field]));
            // Update config parameters from `cfg`.
            config.fldWeights[field] = +cfg.fldWeights[field];
        }
        // Setup BM25F params.
        // Create `bm25Params` if absent in `cfg`.
        if (!helpers.object.isObject(cfg.bm25Params)) cfg.bm25Params = Object.create(null);
        // Update config parameters from `cfg`.
        config.bm25Params.b = cfg.bm25Params.b === null || cfg.bm25Params.b === undefined || isNaN(cfg.bm25Params.b) || +cfg.bm25Params.b < 0 || +cfg.bm25Params.b > 1 ? 0.75 : +cfg.bm25Params.b;
        // Update config parameters from `cfg`.
        config.bm25Params.k1 = cfg.bm25Params.k1 === null || cfg.bm25Params.k1 === undefined || isNaN(cfg.bm25Params.k1) || +cfg.bm25Params.k1 < 0 ? 1.2 : +cfg.bm25Params.k1;
        // Update config parameters from `cfg`.
        config.bm25Params.k = cfg.bm25Params.k === null || cfg.bm25Params.k === undefined || isNaN(cfg.bm25Params.k) || +cfg.bm25Params.k < 0 ? 1 : +cfg.bm25Params.k;
        // Handle configuration for fields whose orginal values has to be retained
        // in the document.<br/>
        // Initialize the `ovFldNames` in the final `config` as an empty array
        config.ovFldNames = [];
        if (!cfg.ovFldNames) cfg.ovFldNames = [];
        if (!helpers.array.isArray(cfg.ovFldNames)) throw Error("winkBM25S: OV Field names should be an array, instead found: " + JSON.stringify(typeof cfg.ovFldNames));
        cfg.ovFldNames.forEach(function(f) {
            if (typeof f !== "string" || f.length === 0) throw Error("winkBM25S: OV Field name should be a non-empty string, instead found: " + JSON.stringify(f));
            config.ovFldNames.push(f);
        });
        return true;
    }; // defineConfig()
    // #### Add Doc
    // Adds a document to the model using `updateFreq()` function.
    var addDoc = function(doc, id) {
        if (config === null) throw Error("winkBM25S: Config must be defined before adding a document.");
        var fldWeights = config.fldWeights;
        // No point in adding/learning further in absence of consolidated.
        if (consolidated) throw Error("winkBM25S: post consolidation adding/learning is not possible!");
        // Set learning/addition started.
        learned = true;
        var length;
        if (documents[id] !== undefined) throw Error("winkBM25S: Duplicate document encountered: " + JSON.stringify(id));
        documents[id] = Object.create(null);
        documents[id].freq = Object.create(null);
        documents[id].fieldValues = Object.create(null);
        documents[id].length = 0;
        // Compute `freq` & `length` of the specified fields.
        for(var field in fldWeights){
            if (doc[field] === undefined) throw Error("winkBM25S: Missing field in the document: " + JSON.stringify(field));
            length = updateFreq(id, doc[field], fldWeights[field], documents[id].freq, field);
            documents[id].length += length;
            totalCorpusLength += length;
        }
        // Retain Original Field Values, if configured.
        config.ovFldNames.forEach(function(f) {
            if (doc[f] === undefined) throw Error("winkBM25S: Missing field in the document: " + JSON.stringify(f));
            documents[id].fieldValues[f] = doc[f];
        });
        // Increment total documents indexed so far.
        totalDocs += 1;
        return totalDocs;
    }; // addDoc()
    // #### Get Docs
    // Returns the document database.
    var getDocs = function() {
        return documents;
    };
    // #### Get Tokens
    // Returns the token to token ID database.
    var getTokens = function() {
        return token2Index;
    };
    // #### Get IDF
    // Returns token ID to IDF database.
    var getIDF = function() {
        return idf;
    };
    // #### Get Config
    // Returns the config.
    var getConfig = function() {
        return config;
    };
    // #### Get TotalCorpusLength
    // Returns the number of tokens in the database.
    var getTotalCorpusLength = function() {
        return totalCorpusLength;
    };
    // #### Get TotalDocs
    // Returns the number of documents in the database.
    var getTotalDocs = function() {
        return totalDocs;
    };
    // #### Consolidate
    // Consolidates the data structure of bm25 and computes the IDF. This must be
    // built before using the `search` function. The `fp` defines the precision at
    // which term frequency values are stored. The default value is **4**. In cause
    // of an invalid input, it default to 4. The maximum permitted value is 9; any
    // value larger than 9 is forced to 9.
    var consolidate = function(fp) {
        if (consolidated) throw Error("winkBM25S: consolidation can be carried out only once!");
        if (totalDocs < 3) throw Error("winkBM25S: document collection is too small for consolidation; add more docs!");
        var freqPrecision = parseInt(fp, 10);
        freqPrecision = isNaN(freqPrecision) ? 4 : freqPrecision < 4 ? 4 : freqPrecision > 9 ? 9 : freqPrecision;
        // Using the commonly used names but unfortunately they are very cryptic and
        // *short*. **Must not use these variable names elsewhere**.
        var b = config.bm25Params.b;
        var k1 = config.bm25Params.k1;
        var k = config.bm25Params.k;
        var freq, id, n, normalizationFactor, t;
        // Consolidate: compute idf; will multiply with freq to save multiplication
        // time during search. This happens in the next loop-block.
        for(var i = 0, imax = invertedIdx.length; i < imax; i += 1){
            n = invertedIdx[i].length;
            idf[i] = Math.log((totalDocs - n + 0.5) / (n + 0.5) + k);
        // To be uncommented to probe values!
        // console.log( '%s, %d, %d, %d, %d', t, totalDocs, n, k, idf[ t ] );
        }
        avgCorpusLength = totalCorpusLength / totalDocs;
        // Consolidate: update document frequencies.
        for(id in documents){
            normalizationFactor = 1 - b + b * (documents[id].length / avgCorpusLength);
            for(t in documents[id].freq){
                freq = documents[id].freq[t];
                // Update frequency but ensure the sign is carefully preserved as the
                // magnitude of `k1` can jeopardize the sign!
                documents[id].freq[t] = Math.sign(freq) * (Math.abs(freq * (k1 + 1) / (k1 * normalizationFactor + freq)) * idf[t]).toFixed(freqPrecision);
            // To be uncommented to probe values!
            // console.log( '%s, %s, %d', id, t, documents[ id ].freq[ t ] );
            }
        }
        // Set `consolidated` as `true`.
        consolidated = true;
        return true;
    }; // consolidate()
    // #### Search
    // Searches the `text` and return `limit` results. If `limit` is not sepcified
    // then it will return a maximum of **10** results. The `result` is an array of
    // containing `doc id` and `score` pairs array. If the `text` is not found, an
    // empty array is returned. The `text` must be a string. The argurment `filter`
    // is like `filter` of JS Array; it receive an object containing document's
    // retained field name/value pairs along with the `params` (which is passed as
    // the second argument). It is useful in limiting the search space or making the
    // search more focussed.
    var search = function(text, limit, filter, params) {
        // Predict/Search only if learnings have been consolidated!
        if (!consolidated) throw Error("winkBM25S: search is not possible unless learnings are consolidated!");
        if (typeof text !== "string") throw Error("winkBM25S: search text should be a string, instead found: " + typeof text);
        // Setup filter function
        var f = typeof filter === "function" ? filter : function() {
            return true;
        };
        // Tokenized `text`. Use search specific weights.
        var tkns = prepareInput(text, "search")// Filter out tokens that do not exists in the vocabulary.
        .filter(function(t) {
            return token2Index[t] !== undefined;
        })// Now map them to their respective indexes using `token2Index`.
        .map(function(t) {
            return token2Index[t];
        });
        // Search results go here as doc id/score pairs.
        var results = Object.create(null);
        // Helper variables.
        var id, ids, t;
        var i, imax, j, jmax;
        // Iterate for every token in the preapred text.
        for(j = 0, jmax = tkns.length; j < jmax; j += 1){
            t = tkns[j];
            // Use Inverted Idx to look up - accelerates search!<br/>
            // Note, `ids` can never be `undefined` as **unknown** tokens have already
            // been filtered.
            ids = invertedIdx[t];
            // Means the token exists in the vocabulary!
            // Compute scores for every document.
            for(i = 0, imax = ids.length; i < imax; i += 1){
                id = ids[i];
                if (f(documents[id].fieldValues, params)) results[id] = documents[id].freq[t] + (results[id] || 0);
            // To be uncommented to probe values!
            /* console.log( '%s, %d, %d, %d', t, documents[ id ].freq[ t ], idf[ t ], results[ id ] ); */ }
        }
        // Convert to a table in `[ id, score ]` format; sort and slice required number
        // of resultant documents.
        return helpers.object.table(results).sort(helpers.array.descendingOnValue).slice(0, Math.max(limit || 10, 1));
    }; // search()
    // #### Reset
    // Resets the BM25F completely by re-initializing all the learning
    // related variables, except the preparatory tasks.
    var reset = function() {
        // Reset values of variables that are associated with learning; Therefore
        // `pTasks` & `pTaskCount` are not re-initialized.
        // Term Frequencies & length of each document.
        documents = Object.create(null);
        // Inverted Index for faster search
        invertedIdx = [];
        // IDF for each tokens
        idf = [];
        // Set true on first call to `addDoc/learn` to prevent changing config.
        learned = false;
        // The `addDoc()predict()` function checks for this being true; set
        // in `consolidate()`.
        consolidated = false;
        // Total documents added.
        totalDocs = 0;
        // Total number of tokens across all documents added.
        totalCorpusLength = 0;
        // Their average.
        avgCorpusLength = 0;
        // BM25F Configuration; set up in `defineConfig()`.
        config = null;
        // The `token: index` mapping; `index` is used everywhere instead
        // of the `token`
        token2Index = Object.create(null);
        // Index's initial value, incremented with every new word.
        currTokenIndex = 0;
        return true;
    }; // reset()
    // #### Export JSON
    // Returns the learnings, along with `consolidated` flag, in JSON format.
    var exportJSON = function() {
        var docStats = Object.create(null);
        docStats.totalCorpusLength = totalCorpusLength;
        docStats.totalDocs = totalDocs;
        docStats.consolidated = consolidated;
        return JSON.stringify([
            config,
            docStats,
            documents,
            invertedIdx,
            currTokenIndex,
            token2Index,
            // For future expansion but the import will have to have intelligence to
            // set the default values and still ensure nothing breaks! Hopefully!!
            {},
            [],
            []
        ]);
    }; // exportJSON()
    // #### Import JSON
    // Imports the `json` in to index after validating the format of input JSON.
    // If validation fails then throws error; otherwise on success import it
    // returns `true`. Note, importing leads to resetting the search engine.
    var importJSON = function(json) {
        if (!json) throw Error("winkBM25S: undefined or null JSON encountered, import failed!");
        // Validate json format
        var isOK = [
            helpers.object.isObject,
            helpers.object.isObject,
            helpers.object.isObject,
            helpers.array.isArray,
            Number.isInteger,
            helpers.object.isObject,
            helpers.object.isObject,
            helpers.array.isArray,
            helpers.array.isArray
        ];
        var parsedJSON = JSON.parse(json);
        if (!helpers.array.isArray(parsedJSON) || parsedJSON.length !== isOK.length) throw Error("winkBM25S: invalid JSON encountered, can not import.");
        for(var i = 0; i < isOK.length; i += 1){
            if (!isOK[i](parsedJSON[i])) throw Error("winkBM25S: invalid JSON encountered, can not import.");
        }
        // All good, setup variable values.
        // First reset everything.
        reset();
        // To prevent config change.
        learned = true;
        // Load variable values.
        config = parsedJSON[0];
        totalCorpusLength = parsedJSON[1].totalCorpusLength;
        totalDocs = parsedJSON[1].totalDocs;
        consolidated = parsedJSON[1].consolidated;
        documents = parsedJSON[2];
        invertedIdx = parsedJSON[3];
        currTokenIndex = parsedJSON[4];
        token2Index = parsedJSON[5];
        // Return success.
        return true;
    }; // importJSON()
    methods.definePrepTasks = definePrepTasks;
    methods.defineConfig = defineConfig;
    methods.addDoc = addDoc;
    methods.getDocs = getDocs;
    methods.getTokens = getTokens;
    methods.getConfig = getConfig;
    methods.getIDF = getIDF;
    methods.getTotalCorpusLength = getTotalCorpusLength;
    methods.getTotalDocs = getTotalDocs;
    methods.consolidate = consolidate;
    methods.search = search;
    methods.exportJSON = exportJSON;
    methods.importJSON = importJSON;
    methods.reset = reset;
    // Aliases to keep APIs uniform across.
    methods.learn = addDoc;
    methods.predict = search;
    return methods;
}; // bm25fIMS()
module.exports = bm25fIMS;

},{"10035a6f8fe9fffc":"195zH"}],"195zH":[function(require,module,exports) {
//     wink-helpers
//     Functions for cross validation, shuffle, cartesian product and more
//
//     Copyright (C) 2017-18  GRAYPE Systems Private Limited
//
//     This file is part of “wink-helpers”.
//
//     Permission is hereby granted, free of charge, to any person obtaining a
//     copy of this software and associated documentation files (the "Software"),
//     to deal in the Software without restriction, including without limitation
//     the rights to use, copy, modify, merge, publish, distribute, sublicense,
//     and/or sell copies of the Software, and to permit persons to whom the
//     Software is furnished to do so, subject to the following conditions:
//
//     The above copyright notice and this permission notice shall be included
//     in all copies or substantial portions of the Software.
//
//     THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
//     OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
//     FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
//     THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
//     LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
//     FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
//     DEALINGS IN THE SOFTWARE.
//
var helpers = Object.create(null);
// ### Private Functions
// #### Product Reducer (Callback)
// Callback function used by `reduce` inside the `product()` function.
// Follows the standard guidelines of `reduce()` callback function.
var productReducer = function(prev, curr) {
    var c, cmax = curr.length;
    var p, pmax = prev.length;
    var result = [];
    for(p = 0; p < pmax; p += 1)for(c = 0; c < cmax; c += 1)result.push(prev[p].concat(curr[c]));
    return result;
}; // productReducer()
// ### Public Function
// ### Array Helpers
helpers.array = Object.create(null);
// #### is Array
// Tests if argument `v` is a JS array; returns `true` if it is, otherwise returns `false`.
helpers.array.isArray = function(v) {
    return v !== undefined && v !== null && Object.prototype.toString.call(v) === "[object Array]";
}; // isArray()
// #### sorting helpers
// Set of helpers to sort either numbers or strings. For key/value pairs,
// the format for each element must be `[ key, value ]`.
// Sort helper to sort an array in ascending order.
helpers.array.ascending = function(a, b) {
    return a > b ? 1 : a === b ? 0 : -1;
}; // ascending()
// Sort helper to sort an array in descending order.
helpers.array.descending = function(a, b) {
    return b > a ? 1 : b === a ? 0 : -1;
}; // descending()
// Sort helper to sort an array of `[ key, value ]` in ascending order by **key**.
helpers.array.ascendingOnKey = function(a, b) {
    return a[0] > b[0] ? 1 : a[0] === b[0] ? 0 : -1;
}; // ascendingOnKey()
// Sort helper to sort an array of `[ key, value ]` in descending order by **key**.
helpers.array.descendingOnKey = function(a, b) {
    return b[0] > a[0] ? 1 : b[0] === a[0] ? 0 : -1;
}; // descendingOnKey()
// Sort helper to sort an array of `[ key, value ]` in ascending order by **value**.
helpers.array.ascendingOnValue = function(a, b) {
    return a[1] > b[1] ? 1 : a[1] === b[1] ? 0 : -1;
}; // ascendingOnValue()
// Sort helper to sort an array of `[ key, value ]` in descending order by **value**.
helpers.array.descendingOnValue = function(a, b) {
    return b[1] > a[1] ? 1 : b[1] === a[1] ? 0 : -1;
}; // descendingOnValue()
// The following two functions generate a suitable function for sorting on a single
// key or on a composite keys (max 2 only). Just a remider, the generated function
// does not sort on two keys; instead it will sort on a key composed of the two
// accessors.
// Sorts in ascending order on `accessor1` & `accessor2` (optional).
helpers.array.ascendingOn = function(accessor1, accessor2) {
    if (accessor2) return function(a, b) {
        return a[accessor1][accessor2] > b[accessor1][accessor2] ? 1 : a[accessor1][accessor2] === b[accessor1][accessor2] ? 0 : -1;
    };
    return function(a, b) {
        return a[accessor1] > b[accessor1] ? 1 : a[accessor1] === b[accessor1] ? 0 : -1;
    };
}; // ascendingOn()
// Sorts in descending order on `accessor1` & `accessor2` (optional).
helpers.array.descendingOn = function(accessor1, accessor2) {
    if (accessor2) return function(a, b) {
        return b[accessor1][accessor2] > a[accessor1][accessor2] ? 1 : b[accessor1][accessor2] === a[accessor1][accessor2] ? 0 : -1;
    };
    return function(a, b) {
        return b[accessor1] > a[accessor1] ? 1 : b[accessor1] === a[accessor1] ? 0 : -1;
    };
}; // descendingOn()
// #### pluck
// Plucks specified element from each element of an **array of array**, and
// returns the resultant array. The element is specified by `i` (default `0`) and
// number of elements to pluck are defined by `limit` (default `a.length`).
helpers.array.pluck = function(a, key, limit) {
    var k, plucked;
    k = a.length;
    var i = key || 0;
    var lim = limit || k;
    if (lim > k) lim = k;
    plucked = new Array(lim);
    for(k = 0; k < lim; k += 1)plucked[k] = a[k][i];
    return plucked;
}; // pluck()
// #### product
// Finds the Cartesian Product of arrays present inside the array `a`. Therefore
// the array `a` must be an array of 1-dimensional arrays. For example,
// `product( [ [ 9, 8 ], [ 1, 2 ] ] )`
// will produce `[ [ 9, 1 ], [ 9, 2 ], [ 8, 1 ], [ 8, 2 ] ]`.
helpers.array.product = function(a) {
    return a.reduce(productReducer, [
        []
    ]);
};
// #### shuffle
// Randomly shuffles the elements of an array and returns the same.
// Reference: Chapter on Random Numbers/Shuffling in Seminumerical algorithms.
// The Art of Computer Programming Volume II by Donald E Kunth
helpers.array.shuffle = function(array) {
    var a = array;
    var balance = a.length;
    var candidate;
    var temp;
    while(balance){
        candidate = Math.floor(Math.random() * balance);
        balance -= 1;
        temp = a[balance];
        a[balance] = a[candidate];
        a[candidate] = temp;
    }
    return a;
};
// ### Object Helpers
var objectKeys = Object.keys;
var objectCreate = Object.create;
helpers.object = Object.create(null);
// #### is Object
// Tests if argument `v` is a JS object; returns `true` if it is, otherwise returns `false`.
helpers.object.isObject = function(v) {
    return v && Object.prototype.toString.call(v) === "[object Object]" ? true : false; // eslint-disable-line no-unneeded-ternary
}; // isObject()
// #### keys
// Returns keys of the `obj` in an array.
helpers.object.keys = function(obj) {
    return objectKeys(obj);
}; // keys()
// #### size
// Returns the number of keys of the `obj`.
helpers.object.size = function(obj) {
    return objectKeys(obj).length;
}; // size()
// #### values
// Returns all values from each key/value pair of the `obj` in an array.
helpers.object.values = function(obj) {
    var keys = helpers.object.keys(obj);
    var length = keys.length;
    var values = new Array(length);
    for(var i = 0; i < length; i += 1)values[i] = obj[keys[i]];
    return values;
}; // values()
// #### value Freq
// Returns the frequency of each unique value present in the `obj`, where the
// **key** is the *value* and **value** is the *frequency*.
helpers.object.valueFreq = function(obj) {
    var keys = helpers.object.keys(obj);
    var length = keys.length;
    var val;
    var vf = objectCreate(null);
    for(var i = 0; i < length; i += 1){
        val = obj[keys[i]];
        vf[val] = 1 + (vf[val] || 0);
    }
    return vf;
}; // valueFreq()
// #### table
// Converts the `obj` in to an array of `[ key, value ]` pairs in form of a table.
// Second argument - `f` is optional and it is a function, which is called with
// each `value`.
helpers.object.table = function(obj, f) {
    var keys = helpers.object.keys(obj);
    var length = keys.length;
    var pairs = new Array(length);
    var ak, av;
    for(var i = 0; i < length; i += 1){
        ak = keys[i];
        av = obj[ak];
        if (typeof f === "function") f(av);
        pairs[i] = [
            ak,
            av
        ];
    }
    return pairs;
}; // table()
// ### Validation Helpers
helpers.validate = Object.create(null);
// Create aliases for isObject and isArray.
helpers.validate.isObject = helpers.object.isObject;
helpers.validate.isArray = helpers.array.isArray;
// #### isFiniteInteger
// Validates if `n` is a finite integer.
helpers.validate.isFiniteInteger = function(n) {
    return typeof n === "number" && !isNaN(n) && isFinite(n) && n === Math.round(n);
}; // isFiniteInteger()
// #### isFiniteNumber
// Validates if `n` is a valid number.
helpers.validate.isFiniteNumber = function(n) {
    return typeof n === "number" && !isNaN(n) && isFinite(n);
}; // isFiniteNumber()
// ### cross validation
/**
 *
 * Creates an instance of cross validator useful for machine learning tasks.
 *
 * @param {string[]} classLabels - array containing all the class labels.
 * @return {methods} object conatining set of API methods for tasks like evalutaion,
 * reset and metrics generation.
*/ helpers.validate.cross = function(classLabels) {
    // wink's const for unknown predictions!
    const unknown = "unknown";
    // To ensure that metrics is not computed prior to evaluation.
    var evaluated = false;
    // The confusion matrix.
    var cm;
    var precision;
    var recall;
    var fmeasure;
    // The class labels is assigned to this variable.
    var labels;
    // The length of `labels` array.
    var labelCount;
    var labelsObj = Object.create(null);
    // Returned!
    var methods = Object.create(null);
    /**
   *
   * Resets the current instance for another round of evaluation; the class
   * labels defined at instance creation time are not touched.
   *
   * @return {undefined} nothing!
  */ var reset = function() {
        evaluated = false;
        cm = Object.create(null);
        precision = Object.create(null);
        recall = Object.create(null);
        fmeasure = Object.create(null);
        // Initialize confusion matrix and metrics.
        for(let i = 0; i < labelCount; i += 1){
            const row = labels[i];
            labelsObj[row] = true;
            cm[row] = Object.create(null);
            precision[row] = 0;
            recall[row] = 0;
            fmeasure[row] = 0;
            for(let j = 0; j < labelCount; j += 1){
                const col = labels[j];
                cm[row][col] = 0;
            }
        }
    }; // reset()
    /**
   *
   * Creates an instance of cross validator useful for machine learning tasks.
   *
   * @param {string} truth - the actual class label.
   * @param {string} guess - the predicted class label.
   * @return {boolean} returns true if the evaluation is successful. The evaluation
   * may fail if `truth` or `guess` is not in the array `classLabels` provided at
   * instance creation time; or if guess is equal to `unknown`.
  */ var evaluate = function(truth, guess) {
        // If prediction failed then return false!
        if (guess === unknown || !labelsObj[truth] || !labelsObj[guess]) return false;
        // Update confusion matrix.
        if (guess === truth) cm[truth][guess] += 1;
        else cm[guess][truth] += 1;
        evaluated = true;
        return true;
    }; // evaluate()
    /**
   *
   * It computes a detailed metrics consisting of macro-averaged precision,
   * recall and f-measure along with their label-wise values and the confusion
   * matrix.
   *
   * @return {object} object containing macro-averaged `avgPrecision`, `avgRecall`,
   * `avgFMeasure` values along with other details such as label-wise values
   * and the confusion matrix. A value of `null` is returned if no evaluate()
   * has been called before.
  */ var metrics = function() {
        if (!evaluated) return null;
        // Numerators for every label; they are same for precision & recall both.
        var n = Object.create(null);
        // Only denominators differs for precision & recall
        var pd = Object.create(null);
        var rd = Object.create(null);
        // `row` and `col` of confusion matrix.
        var col, row;
        var i, j;
        // Macro average values for metrics.
        var avgPrecision = 0;
        var avgRecall = 0;
        var avgFMeasure = 0;
        // Compute label-wise numerators & denominators!
        for(i = 0; i < labelCount; i += 1){
            row = labels[i];
            for(j = 0; j < labelCount; j += 1){
                col = labels[j];
                if (row === col) n[row] = cm[row][col];
                pd[row] = cm[row][col] + (pd[row] || 0);
                rd[row] = cm[col][row] + (rd[row] || 0);
            }
        }
        // Ready to compute metrics.
        for(i = 0; i < labelCount; i += 1){
            row = labels[i];
            precision[row] = +(n[row] / pd[row]).toFixed(4);
            // NaN can occur if a label has not been encountered.
            if (isNaN(precision[row])) precision[row] = 0;
            recall[row] = +(n[row] / rd[row]).toFixed(4);
            if (isNaN(recall[row])) recall[row] = 0;
            fmeasure[row] = +(2 * precision[row] * recall[row] / (precision[row] + recall[row])).toFixed(4);
            if (isNaN(fmeasure[row])) fmeasure[row] = 0;
        }
        // Compute thier averages, note they will be macro avegages.
        for(i = 0; i < labelCount; i += 1){
            avgPrecision += precision[labels[i]] / labelCount;
            avgRecall += recall[labels[i]] / labelCount;
            avgFMeasure += fmeasure[labels[i]] / labelCount;
        }
        // Return metrics.
        return {
            // Macro-averaged metrics.
            avgPrecision: +avgPrecision.toFixed(4),
            avgRecall: +avgRecall.toFixed(4),
            avgFMeasure: +avgFMeasure.toFixed(4),
            details: {
                // Confusion Matrix.
                confusionMatrix: cm,
                // Label wise metrics details, from those averages were computed.
                precision: precision,
                recall: recall,
                fmeasure: fmeasure
            }
        };
    }; // metrics()
    if (!helpers.validate.isArray(classLabels)) throw Error("cross validate: class labels must be an array.");
    if (classLabels.length < 2) throw Error("cross validate: at least 2 class labels are required.");
    labels = classLabels;
    labelCount = labels.length;
    reset();
    methods.reset = reset;
    methods.evaluate = evaluate;
    methods.metrics = metrics;
    return methods;
}; // cross()
// ### Object Helpers
helpers.string = Object.create(null);
// Regex for [diacritical marks](https://en.wikipedia.org/wiki/Combining_Diacritical_Marks) removal.
var rgxDiacritical = /[\u0300-\u036f]/g;
/**
 *
 * Normalizes the token's value by converting it to lower case and stripping
 * the diacritical marks (if any).
 *
 * @param {string} str — that needs to be normalized.
 * @return {string} the normalized value.
 * @example
 * normalize( 'Nestlé' );
 * // -> nestle
*/ helpers.string.normalize = function(str) {
    return str.toLowerCase().normalize("NFD").replace(rgxDiacritical, "");
}; // normalize()
module.exports = helpers;

},{}],"8erMS":[function(require,module,exports) {
"use strict";
// MODULES //
var dot = require("7781aec121998ac9"), l2norm = require("9e35407f00f27866"), isArray = require("8dca5a427448daf"), isFunction = require("66ad2b53f04166ec");
// FUNCTIONS //
/**
* Partially applied function from the right.
*
* @private
* @param {Function} fn - input function
* @param {number} j - array index
* @returns {Function} partially applied function
*/ function partial(fn, j) {
    return function accessor(d, i) {
        return fn(d, i, j);
    };
}
// MAIN //
/**
* Computes the cosine similarity between two arrays.
*
* @param {number[]|Array} x - input array
* @param {number[]|Array} y - input array
* @param {Function} [accessor] - accessor function for accessing array values
* @returns {number|null} cosine similarity or null
*/ function similarity(x, y, clbk) {
    var a, b, c;
    if (!isArray(x)) throw new TypeError("cosine-similarity()::invalid input argument. First argument must be an array. Value: `" + x + "`.");
    if (!isArray(y)) throw new TypeError("cosine-similarity()::invalid input argument. Second argument must be an array. Value: `" + y + "`.");
    if (arguments.length > 2) {
        if (!isFunction(clbk)) throw new TypeError("cosine-similarity()::invalid input argument. Accessor must be a function. Value: `" + clbk + "`.");
    }
    if (x.length !== y.length) throw new Error("cosine-similarity()::invalid input argument. Input arrays must have the same length.");
    if (!x.length) return null;
    if (clbk) {
        a = dot(x, y, clbk);
        b = l2norm(x, partial(clbk, 0));
        c = l2norm(y, partial(clbk, 1));
    } else {
        a = dot(x, y);
        b = l2norm(x);
        c = l2norm(y);
    }
    return a / (b * c);
}
// EXPORTS //
module.exports = similarity;

},{"7781aec121998ac9":"cwmx7","9e35407f00f27866":"8d3dH","8dca5a427448daf":"56iBk","66ad2b53f04166ec":"hPV9v"}],"cwmx7":[function(require,module,exports) {
"use strict";
// MODULES //
var isArray = require("a8756c6440d251a"), isFunction = require("7c8e18f25c6a7751");
// DOT PRODUCT //
/**
* FUNCTION: dot( x, y[, accessor] )
*	Computes the dot product between two arrays.
*
* @param {Array} x - input array
* @param {Array} y - input array
* @param {Function} [accessor] - accessor function for accessing array values
* @returns {Number|Null} dot product
*/ function dot(x, y, clbk) {
    if (!isArray(x)) throw new TypeError("dot()::invalid input argument. First argument must be an array. Value: `" + x + "`.");
    if (!isArray(y)) throw new TypeError("dot()::invalid input argument. Second argument must be an array. Value: `" + y + "`.");
    if (arguments.length > 2) {
        if (!isFunction(clbk)) throw new TypeError("dot()::invalid input argument. Accessor must be a function. Value: `" + clbk + "`.");
    }
    var len = x.length, sum = 0, i;
    if (len !== y.length) throw new Error("dot()::invalid input argument. Arrays must be of equal length.");
    if (!len) return null;
    if (clbk) for(i = 0; i < len; i++)sum += clbk(x[i], i, 0) * clbk(y[i], i, 1);
    else for(i = 0; i < len; i++)sum += x[i] * y[i];
    return sum;
} // end FUNCTION dot()
// EXPORTS //
module.exports = dot;

},{"a8756c6440d251a":"56iBk","7c8e18f25c6a7751":"hPV9v"}],"56iBk":[function(require,module,exports) {
"use strict";
/**
* FUNCTION: isArray( value )
*	Validates if a value is an array.
*
* @param {*} value - value to be validated
* @returns {Boolean} boolean indicating whether value is an array
*/ function isArray(value) {
    return Object.prototype.toString.call(value) === "[object Array]";
} // end FUNCTION isArray()
// EXPORTS //
module.exports = Array.isArray || isArray;

},{}],"hPV9v":[function(require,module,exports) {
/**
*
*	VALIDATE: function
*
*
*	DESCRIPTION:
*		- Validates if a value is a function.
*
*
*	NOTES:
*		[1]
*
*
*	TODO:
*		[1]
*
*
*	LICENSE:
*		MIT
*
*	Copyright (c) 2014. Athan Reines.
*
*
*	AUTHOR:
*		Athan Reines. kgryte@gmail.com. 2014.
*
*/ "use strict";
/**
* FUNCTION: isFunction( value )
*	Validates if a value is a function.
*
* @param {*} value - value to be validated
* @returns {Boolean} boolean indicating whether value is a function
*/ function isFunction(value) {
    return typeof value === "function";
} // end FUNCTION isFunction()
// EXPORTS //
module.exports = isFunction;

},{}],"8d3dH":[function(require,module,exports) {
"use strict";
// MODULES //
var isArray = require("737494235fff44bd"), isFunction = require("28b00e6da9f8640");
// L2NORM //
/**
* FUNCTION: l2norm( arr[, accessor] )
*	Calculates the L2 norm (Euclidean norm) of an array.
*
* @param {Array} arr - input array
* @param {Function} [accessor] - accessor function for accessing array values
* @returns {Number|Null} L2 norm or null
*/ function l2norm(arr, clbk) {
    if (!isArray(arr)) throw new TypeError("l2norm()::invalid input argument. Must provide an array.  Value: `" + arr + "`.");
    if (arguments.length > 1) {
        if (!isFunction(clbk)) throw new TypeError("l2norm()::invalid input argument. Accessor must be a function. Value: `" + clbk + "`.");
    }
    var len = arr.length, t = 0, s = 1, r, val, abs, i;
    if (!len) return null;
    if (clbk) for(i = 0; i < len; i++){
        val = clbk(arr[i], i);
        abs = val < 0 ? -val : val;
        if (abs > 0) {
            if (abs > t) {
                r = t / val;
                s = 1 + s * r * r;
                t = abs;
            } else {
                r = val / t;
                s = s + r * r;
            }
        }
    }
    else for(i = 0; i < len; i++){
        val = arr[i];
        abs = val < 0 ? -val : val;
        if (abs > 0) {
            if (abs > t) {
                r = t / val;
                s = 1 + s * r * r;
                t = abs;
            } else {
                r = val / t;
                s = s + r * r;
            }
        }
    }
    return t * Math.sqrt(s);
} // end FUNCTION l2norm()
// EXPORTS //
module.exports = l2norm;

},{"737494235fff44bd":"56iBk","28b00e6da9f8640":"hPV9v"}],"fD7H8":[function(require,module,exports) {
exports.interopDefault = function(a) {
    return a && a.__esModule ? a : {
        default: a
    };
};
exports.defineInteropFlag = function(a) {
    Object.defineProperty(a, "__esModule", {
        value: true
    });
};
exports.exportAll = function(source, dest) {
    Object.keys(source).forEach(function(key) {
        if (key === "default" || key === "__esModule" || Object.prototype.hasOwnProperty.call(dest, key)) return;
        Object.defineProperty(dest, key, {
            enumerable: true,
            get: function() {
                return source[key];
            }
        });
    });
    return dest;
};
exports.export = function(dest, destName, get) {
    Object.defineProperty(dest, destName, {
        enumerable: true,
        get: get
    });
};

},{}]},["bCPQv","9UXew"], "9UXew", "parcelRequire94c2")

//# sourceMappingURL=search.be681503.js.map
