/*
 * Monaco web-worker bootstrap for the Fiddle window.
 *
 * Monaco ships its workers (TypeScript parser, JSON validator, editor
 * service, etc.) as standalone scripts that live under
 * `vs/base/worker/workerMain.js`. The AMD loader asks `MonacoEnvironment.
 * getWorkerUrl(moduleId, label)` for the URL it should pass to
 * `new Worker(...)`.
 *
 * We build a Blob-backed worker URL that:
 *   1) sets the worker's own `MonacoEnvironment.baseUrl` so nested AMD
 *      imports resolve relative to our vendored Monaco copy;
 *   2) `importScripts`'s the real `workerMain.js`.
 *
 * Blob URLs are used instead of `data:` URLs so our CSP can stay strict
 * (`worker-src 'self' blob:`), without opening the door to arbitrary
 * `data:` sources.
 *
 * NOTE: this file is a plain .js on purpose so it can be referenced via a
 * `<script src="…/fiddle-monaco-env.js">` tag *before* the AMD loader. Do
 * not convert it to a TS module — the Fiddle renderer relies on
 * `self.MonacoEnvironment` being set synchronously at that point.
 */
(function () {
  var base = window.location.href.replace(/fiddle\.html.*/, '') + 'dist/vendor/monaco/';
  self.MonacoEnvironment = {
    getWorkerUrl: function () {
      var src =
        "self.MonacoEnvironment = { baseUrl: '" + base + "' };\n" +
        "importScripts('" + base + "vs/base/worker/workerMain.js');";
      var blob = new Blob([src], { type: 'text/javascript' });
      return URL.createObjectURL(blob);
    }
  };
})();
