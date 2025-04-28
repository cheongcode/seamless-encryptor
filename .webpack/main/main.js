/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ "./node_modules/electron-squirrel-startup/index.js":
/*!*********************************************************!*\
  !*** ./node_modules/electron-squirrel-startup/index.js ***!
  \*********************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var path = __webpack_require__(/*! path */ "path");
var spawn = (__webpack_require__(/*! child_process */ "child_process").spawn);
var debug = __webpack_require__(/*! debug */ "./node_modules/electron-squirrel-startup/node_modules/debug/src/index.js")('electron-squirrel-startup');
var app = (__webpack_require__(/*! electron */ "electron").app);

var run = function(args, done) {
  var updateExe = path.resolve(path.dirname(process.execPath), '..', 'Update.exe');
  debug('Spawning `%s` with args `%s`', updateExe, args);
  spawn(updateExe, args, {
    detached: true
  }).on('close', done);
};

var check = function() {
  if (process.platform === 'win32') {
    var cmd = process.argv[1];
    debug('processing squirrel command `%s`', cmd);
    var target = path.basename(process.execPath);

    if (cmd === '--squirrel-install' || cmd === '--squirrel-updated') {
      run(['--createShortcut=' + target + ''], app.quit);
      return true;
    }
    if (cmd === '--squirrel-uninstall') {
      run(['--removeShortcut=' + target + ''], app.quit);
      return true;
    }
    if (cmd === '--squirrel-obsolete') {
      app.quit();
      return true;
    }
  }
  return false;
};

module.exports = check();


/***/ }),

/***/ "./node_modules/electron-squirrel-startup/node_modules/debug/src/browser.js":
/*!**********************************************************************************!*\
  !*** ./node_modules/electron-squirrel-startup/node_modules/debug/src/browser.js ***!
  \**********************************************************************************/
/***/ ((module, exports, __webpack_require__) => {

/**
 * This is the web browser implementation of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = __webpack_require__(/*! ./debug */ "./node_modules/electron-squirrel-startup/node_modules/debug/src/debug.js");
exports.log = log;
exports.formatArgs = formatArgs;
exports.save = save;
exports.load = load;
exports.useColors = useColors;
exports.storage = 'undefined' != typeof chrome
               && 'undefined' != typeof chrome.storage
                  ? chrome.storage.local
                  : localstorage();

/**
 * Colors.
 */

exports.colors = [
  'lightseagreen',
  'forestgreen',
  'goldenrod',
  'dodgerblue',
  'darkorchid',
  'crimson'
];

/**
 * Currently only WebKit-based Web Inspectors, Firefox >= v31,
 * and the Firebug extension (any Firefox version) are known
 * to support "%c" CSS customizations.
 *
 * TODO: add a `localStorage` variable to explicitly enable/disable colors
 */

function useColors() {
  // NB: In an Electron preload script, document will be defined but not fully
  // initialized. Since we know we're in Chrome, we'll just detect this case
  // explicitly
  if (typeof window !== 'undefined' && window.process && window.process.type === 'renderer') {
    return true;
  }

  // is webkit? http://stackoverflow.com/a/16459606/376773
  // document is undefined in react-native: https://github.com/facebook/react-native/pull/1632
  return (typeof document !== 'undefined' && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance) ||
    // is firebug? http://stackoverflow.com/a/398120/376773
    (typeof window !== 'undefined' && window.console && (window.console.firebug || (window.console.exception && window.console.table))) ||
    // is firefox >= v31?
    // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
    (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31) ||
    // double check webkit in userAgent just in case we are in a worker
    (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/));
}

/**
 * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
 */

exports.formatters.j = function(v) {
  try {
    return JSON.stringify(v);
  } catch (err) {
    return '[UnexpectedJSONParseError]: ' + err.message;
  }
};


/**
 * Colorize log arguments if enabled.
 *
 * @api public
 */

function formatArgs(args) {
  var useColors = this.useColors;

  args[0] = (useColors ? '%c' : '')
    + this.namespace
    + (useColors ? ' %c' : ' ')
    + args[0]
    + (useColors ? '%c ' : ' ')
    + '+' + exports.humanize(this.diff);

  if (!useColors) return;

  var c = 'color: ' + this.color;
  args.splice(1, 0, c, 'color: inherit')

  // the final "%c" is somewhat tricky, because there could be other
  // arguments passed either before or after the %c, so we need to
  // figure out the correct index to insert the CSS into
  var index = 0;
  var lastC = 0;
  args[0].replace(/%[a-zA-Z%]/g, function(match) {
    if ('%%' === match) return;
    index++;
    if ('%c' === match) {
      // we only are interested in the *last* %c
      // (the user may have provided their own)
      lastC = index;
    }
  });

  args.splice(lastC, 0, c);
}

/**
 * Invokes `console.log()` when available.
 * No-op when `console.log` is not a "function".
 *
 * @api public
 */

function log() {
  // this hackery is required for IE8/9, where
  // the `console.log` function doesn't have 'apply'
  return 'object' === typeof console
    && console.log
    && Function.prototype.apply.call(console.log, console, arguments);
}

/**
 * Save `namespaces`.
 *
 * @param {String} namespaces
 * @api private
 */

function save(namespaces) {
  try {
    if (null == namespaces) {
      exports.storage.removeItem('debug');
    } else {
      exports.storage.debug = namespaces;
    }
  } catch(e) {}
}

/**
 * Load `namespaces`.
 *
 * @return {String} returns the previously persisted debug modes
 * @api private
 */

function load() {
  var r;
  try {
    r = exports.storage.debug;
  } catch(e) {}

  // If debug isn't set in LS, and we're in Electron, try to load $DEBUG
  if (!r && typeof process !== 'undefined' && 'env' in process) {
    r = process.env.DEBUG;
  }

  return r;
}

/**
 * Enable namespaces listed in `localStorage.debug` initially.
 */

exports.enable(load());

/**
 * Localstorage attempts to return the localstorage.
 *
 * This is necessary because safari throws
 * when a user disables cookies/localstorage
 * and you attempt to access it.
 *
 * @return {LocalStorage}
 * @api private
 */

function localstorage() {
  try {
    return window.localStorage;
  } catch (e) {}
}


/***/ }),

/***/ "./node_modules/electron-squirrel-startup/node_modules/debug/src/debug.js":
/*!********************************************************************************!*\
  !*** ./node_modules/electron-squirrel-startup/node_modules/debug/src/debug.js ***!
  \********************************************************************************/
/***/ ((module, exports, __webpack_require__) => {


/**
 * This is the common logic for both the Node.js and web browser
 * implementations of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = createDebug.debug = createDebug['default'] = createDebug;
exports.coerce = coerce;
exports.disable = disable;
exports.enable = enable;
exports.enabled = enabled;
exports.humanize = __webpack_require__(/*! ms */ "./node_modules/electron-squirrel-startup/node_modules/ms/index.js");

/**
 * The currently active debug mode names, and names to skip.
 */

exports.names = [];
exports.skips = [];

/**
 * Map of special "%n" handling functions, for the debug "format" argument.
 *
 * Valid key names are a single, lower or upper-case letter, i.e. "n" and "N".
 */

exports.formatters = {};

/**
 * Previous log timestamp.
 */

var prevTime;

/**
 * Select a color.
 * @param {String} namespace
 * @return {Number}
 * @api private
 */

function selectColor(namespace) {
  var hash = 0, i;

  for (i in namespace) {
    hash  = ((hash << 5) - hash) + namespace.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }

  return exports.colors[Math.abs(hash) % exports.colors.length];
}

/**
 * Create a debugger with the given `namespace`.
 *
 * @param {String} namespace
 * @return {Function}
 * @api public
 */

function createDebug(namespace) {

  function debug() {
    // disabled?
    if (!debug.enabled) return;

    var self = debug;

    // set `diff` timestamp
    var curr = +new Date();
    var ms = curr - (prevTime || curr);
    self.diff = ms;
    self.prev = prevTime;
    self.curr = curr;
    prevTime = curr;

    // turn the `arguments` into a proper Array
    var args = new Array(arguments.length);
    for (var i = 0; i < args.length; i++) {
      args[i] = arguments[i];
    }

    args[0] = exports.coerce(args[0]);

    if ('string' !== typeof args[0]) {
      // anything else let's inspect with %O
      args.unshift('%O');
    }

    // apply any `formatters` transformations
    var index = 0;
    args[0] = args[0].replace(/%([a-zA-Z%])/g, function(match, format) {
      // if we encounter an escaped % then don't increase the array index
      if (match === '%%') return match;
      index++;
      var formatter = exports.formatters[format];
      if ('function' === typeof formatter) {
        var val = args[index];
        match = formatter.call(self, val);

        // now we need to remove `args[index]` since it's inlined in the `format`
        args.splice(index, 1);
        index--;
      }
      return match;
    });

    // apply env-specific formatting (colors, etc.)
    exports.formatArgs.call(self, args);

    var logFn = debug.log || exports.log || console.log.bind(console);
    logFn.apply(self, args);
  }

  debug.namespace = namespace;
  debug.enabled = exports.enabled(namespace);
  debug.useColors = exports.useColors();
  debug.color = selectColor(namespace);

  // env-specific initialization logic for debug instances
  if ('function' === typeof exports.init) {
    exports.init(debug);
  }

  return debug;
}

/**
 * Enables a debug mode by namespaces. This can include modes
 * separated by a colon and wildcards.
 *
 * @param {String} namespaces
 * @api public
 */

function enable(namespaces) {
  exports.save(namespaces);

  exports.names = [];
  exports.skips = [];

  var split = (typeof namespaces === 'string' ? namespaces : '').split(/[\s,]+/);
  var len = split.length;

  for (var i = 0; i < len; i++) {
    if (!split[i]) continue; // ignore empty strings
    namespaces = split[i].replace(/\*/g, '.*?');
    if (namespaces[0] === '-') {
      exports.skips.push(new RegExp('^' + namespaces.substr(1) + '$'));
    } else {
      exports.names.push(new RegExp('^' + namespaces + '$'));
    }
  }
}

/**
 * Disable debug output.
 *
 * @api public
 */

function disable() {
  exports.enable('');
}

/**
 * Returns true if the given mode name is enabled, false otherwise.
 *
 * @param {String} name
 * @return {Boolean}
 * @api public
 */

function enabled(name) {
  var i, len;
  for (i = 0, len = exports.skips.length; i < len; i++) {
    if (exports.skips[i].test(name)) {
      return false;
    }
  }
  for (i = 0, len = exports.names.length; i < len; i++) {
    if (exports.names[i].test(name)) {
      return true;
    }
  }
  return false;
}

/**
 * Coerce `val`.
 *
 * @param {Mixed} val
 * @return {Mixed}
 * @api private
 */

function coerce(val) {
  if (val instanceof Error) return val.stack || val.message;
  return val;
}


/***/ }),

/***/ "./node_modules/electron-squirrel-startup/node_modules/debug/src/index.js":
/*!********************************************************************************!*\
  !*** ./node_modules/electron-squirrel-startup/node_modules/debug/src/index.js ***!
  \********************************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

/**
 * Detect Electron renderer process, which is node, but we should
 * treat as a browser.
 */

if (typeof process !== 'undefined' && process.type === 'renderer') {
  module.exports = __webpack_require__(/*! ./browser.js */ "./node_modules/electron-squirrel-startup/node_modules/debug/src/browser.js");
} else {
  module.exports = __webpack_require__(/*! ./node.js */ "./node_modules/electron-squirrel-startup/node_modules/debug/src/node.js");
}


/***/ }),

/***/ "./node_modules/electron-squirrel-startup/node_modules/debug/src/node.js":
/*!*******************************************************************************!*\
  !*** ./node_modules/electron-squirrel-startup/node_modules/debug/src/node.js ***!
  \*******************************************************************************/
/***/ ((module, exports, __webpack_require__) => {

/**
 * Module dependencies.
 */

var tty = __webpack_require__(/*! tty */ "tty");
var util = __webpack_require__(/*! util */ "util");

/**
 * This is the Node.js implementation of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = __webpack_require__(/*! ./debug */ "./node_modules/electron-squirrel-startup/node_modules/debug/src/debug.js");
exports.init = init;
exports.log = log;
exports.formatArgs = formatArgs;
exports.save = save;
exports.load = load;
exports.useColors = useColors;

/**
 * Colors.
 */

exports.colors = [6, 2, 3, 4, 5, 1];

/**
 * Build up the default `inspectOpts` object from the environment variables.
 *
 *   $ DEBUG_COLORS=no DEBUG_DEPTH=10 DEBUG_SHOW_HIDDEN=enabled node script.js
 */

exports.inspectOpts = Object.keys(process.env).filter(function (key) {
  return /^debug_/i.test(key);
}).reduce(function (obj, key) {
  // camel-case
  var prop = key
    .substring(6)
    .toLowerCase()
    .replace(/_([a-z])/g, function (_, k) { return k.toUpperCase() });

  // coerce string value into JS value
  var val = process.env[key];
  if (/^(yes|on|true|enabled)$/i.test(val)) val = true;
  else if (/^(no|off|false|disabled)$/i.test(val)) val = false;
  else if (val === 'null') val = null;
  else val = Number(val);

  obj[prop] = val;
  return obj;
}, {});

/**
 * The file descriptor to write the `debug()` calls to.
 * Set the `DEBUG_FD` env variable to override with another value. i.e.:
 *
 *   $ DEBUG_FD=3 node script.js 3>debug.log
 */

var fd = parseInt(process.env.DEBUG_FD, 10) || 2;

if (1 !== fd && 2 !== fd) {
  util.deprecate(function(){}, 'except for stderr(2) and stdout(1), any other usage of DEBUG_FD is deprecated. Override debug.log if you want to use a different log function (https://git.io/debug_fd)')()
}

var stream = 1 === fd ? process.stdout :
             2 === fd ? process.stderr :
             createWritableStdioStream(fd);

/**
 * Is stdout a TTY? Colored output is enabled when `true`.
 */

function useColors() {
  return 'colors' in exports.inspectOpts
    ? Boolean(exports.inspectOpts.colors)
    : tty.isatty(fd);
}

/**
 * Map %o to `util.inspect()`, all on a single line.
 */

exports.formatters.o = function(v) {
  this.inspectOpts.colors = this.useColors;
  return util.inspect(v, this.inspectOpts)
    .split('\n').map(function(str) {
      return str.trim()
    }).join(' ');
};

/**
 * Map %o to `util.inspect()`, allowing multiple lines if needed.
 */

exports.formatters.O = function(v) {
  this.inspectOpts.colors = this.useColors;
  return util.inspect(v, this.inspectOpts);
};

/**
 * Adds ANSI color escape codes if enabled.
 *
 * @api public
 */

function formatArgs(args) {
  var name = this.namespace;
  var useColors = this.useColors;

  if (useColors) {
    var c = this.color;
    var prefix = '  \u001b[3' + c + ';1m' + name + ' ' + '\u001b[0m';

    args[0] = prefix + args[0].split('\n').join('\n' + prefix);
    args.push('\u001b[3' + c + 'm+' + exports.humanize(this.diff) + '\u001b[0m');
  } else {
    args[0] = new Date().toUTCString()
      + ' ' + name + ' ' + args[0];
  }
}

/**
 * Invokes `util.format()` with the specified arguments and writes to `stream`.
 */

function log() {
  return stream.write(util.format.apply(util, arguments) + '\n');
}

/**
 * Save `namespaces`.
 *
 * @param {String} namespaces
 * @api private
 */

function save(namespaces) {
  if (null == namespaces) {
    // If you set a process.env field to null or undefined, it gets cast to the
    // string 'null' or 'undefined'. Just delete instead.
    delete process.env.DEBUG;
  } else {
    process.env.DEBUG = namespaces;
  }
}

/**
 * Load `namespaces`.
 *
 * @return {String} returns the previously persisted debug modes
 * @api private
 */

function load() {
  return process.env.DEBUG;
}

/**
 * Copied from `node/src/node.js`.
 *
 * XXX: It's lame that node doesn't expose this API out-of-the-box. It also
 * relies on the undocumented `tty_wrap.guessHandleType()` which is also lame.
 */

function createWritableStdioStream (fd) {
  var stream;
  var tty_wrap = process.binding('tty_wrap');

  // Note stream._type is used for test-module-load-list.js

  switch (tty_wrap.guessHandleType(fd)) {
    case 'TTY':
      stream = new tty.WriteStream(fd);
      stream._type = 'tty';

      // Hack to have stream not keep the event loop alive.
      // See https://github.com/joyent/node/issues/1726
      if (stream._handle && stream._handle.unref) {
        stream._handle.unref();
      }
      break;

    case 'FILE':
      var fs = __webpack_require__(/*! fs */ "fs");
      stream = new fs.SyncWriteStream(fd, { autoClose: false });
      stream._type = 'fs';
      break;

    case 'PIPE':
    case 'TCP':
      var net = __webpack_require__(/*! net */ "net");
      stream = new net.Socket({
        fd: fd,
        readable: false,
        writable: true
      });

      // FIXME Should probably have an option in net.Socket to create a
      // stream from an existing fd which is writable only. But for now
      // we'll just add this hack and set the `readable` member to false.
      // Test: ./node test/fixtures/echo.js < /etc/passwd
      stream.readable = false;
      stream.read = null;
      stream._type = 'pipe';

      // FIXME Hack to have stream not keep the event loop alive.
      // See https://github.com/joyent/node/issues/1726
      if (stream._handle && stream._handle.unref) {
        stream._handle.unref();
      }
      break;

    default:
      // Probably an error on in uv_guess_handle()
      throw new Error('Implement me. Unknown stream file type!');
  }

  // For supporting legacy API we put the FD here.
  stream.fd = fd;

  stream._isStdio = true;

  return stream;
}

/**
 * Init logic for `debug` instances.
 *
 * Create a new `inspectOpts` object in case `useColors` is set
 * differently for a particular `debug` instance.
 */

function init (debug) {
  debug.inspectOpts = {};

  var keys = Object.keys(exports.inspectOpts);
  for (var i = 0; i < keys.length; i++) {
    debug.inspectOpts[keys[i]] = exports.inspectOpts[keys[i]];
  }
}

/**
 * Enable namespaces listed in `process.env.DEBUG` initially.
 */

exports.enable(load());


/***/ }),

/***/ "./node_modules/electron-squirrel-startup/node_modules/ms/index.js":
/*!*************************************************************************!*\
  !*** ./node_modules/electron-squirrel-startup/node_modules/ms/index.js ***!
  \*************************************************************************/
/***/ ((module) => {

/**
 * Helpers.
 */

var s = 1000;
var m = s * 60;
var h = m * 60;
var d = h * 24;
var y = d * 365.25;

/**
 * Parse or format the given `val`.
 *
 * Options:
 *
 *  - `long` verbose formatting [false]
 *
 * @param {String|Number} val
 * @param {Object} [options]
 * @throws {Error} throw an error if val is not a non-empty string or a number
 * @return {String|Number}
 * @api public
 */

module.exports = function(val, options) {
  options = options || {};
  var type = typeof val;
  if (type === 'string' && val.length > 0) {
    return parse(val);
  } else if (type === 'number' && isNaN(val) === false) {
    return options.long ? fmtLong(val) : fmtShort(val);
  }
  throw new Error(
    'val is not a non-empty string or a valid number. val=' +
      JSON.stringify(val)
  );
};

/**
 * Parse the given `str` and return milliseconds.
 *
 * @param {String} str
 * @return {Number}
 * @api private
 */

function parse(str) {
  str = String(str);
  if (str.length > 100) {
    return;
  }
  var match = /^((?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|years?|yrs?|y)?$/i.exec(
    str
  );
  if (!match) {
    return;
  }
  var n = parseFloat(match[1]);
  var type = (match[2] || 'ms').toLowerCase();
  switch (type) {
    case 'years':
    case 'year':
    case 'yrs':
    case 'yr':
    case 'y':
      return n * y;
    case 'days':
    case 'day':
    case 'd':
      return n * d;
    case 'hours':
    case 'hour':
    case 'hrs':
    case 'hr':
    case 'h':
      return n * h;
    case 'minutes':
    case 'minute':
    case 'mins':
    case 'min':
    case 'm':
      return n * m;
    case 'seconds':
    case 'second':
    case 'secs':
    case 'sec':
    case 's':
      return n * s;
    case 'milliseconds':
    case 'millisecond':
    case 'msecs':
    case 'msec':
    case 'ms':
      return n;
    default:
      return undefined;
  }
}

/**
 * Short format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function fmtShort(ms) {
  if (ms >= d) {
    return Math.round(ms / d) + 'd';
  }
  if (ms >= h) {
    return Math.round(ms / h) + 'h';
  }
  if (ms >= m) {
    return Math.round(ms / m) + 'm';
  }
  if (ms >= s) {
    return Math.round(ms / s) + 's';
  }
  return ms + 'ms';
}

/**
 * Long format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function fmtLong(ms) {
  return plural(ms, d, 'day') ||
    plural(ms, h, 'hour') ||
    plural(ms, m, 'minute') ||
    plural(ms, s, 'second') ||
    ms + ' ms';
}

/**
 * Pluralization helper.
 */

function plural(ms, n, name) {
  if (ms < n) {
    return;
  }
  if (ms < n * 1.5) {
    return Math.floor(ms / n) + ' ' + name;
  }
  return Math.ceil(ms / n) + ' ' + name + 's';
}


/***/ }),

/***/ "./src/main sync recursive":
/*!************************!*\
  !*** ./src/main/ sync ***!
  \************************/
/***/ ((module) => {

function webpackEmptyContext(req) {
	var e = new Error("Cannot find module '" + req + "'");
	e.code = 'MODULE_NOT_FOUND';
	throw e;
}
webpackEmptyContext.keys = () => ([]);
webpackEmptyContext.resolve = webpackEmptyContext;
webpackEmptyContext.id = "./src/main sync recursive";
module.exports = webpackEmptyContext;

/***/ }),

/***/ "child_process":
/*!********************************!*\
  !*** external "child_process" ***!
  \********************************/
/***/ ((module) => {

"use strict";
module.exports = require("child_process");

/***/ }),

/***/ "crypto":
/*!*************************!*\
  !*** external "crypto" ***!
  \*************************/
/***/ ((module) => {

"use strict";
module.exports = require("crypto");

/***/ }),

/***/ "electron":
/*!***************************!*\
  !*** external "electron" ***!
  \***************************/
/***/ ((module) => {

"use strict";
module.exports = require("electron");

/***/ }),

/***/ "fs":
/*!*********************!*\
  !*** external "fs" ***!
  \*********************/
/***/ ((module) => {

"use strict";
module.exports = require("fs");

/***/ }),

/***/ "net":
/*!**********************!*\
  !*** external "net" ***!
  \**********************/
/***/ ((module) => {

"use strict";
module.exports = require("net");

/***/ }),

/***/ "path":
/*!***********************!*\
  !*** external "path" ***!
  \***********************/
/***/ ((module) => {

"use strict";
module.exports = require("path");

/***/ }),

/***/ "tty":
/*!**********************!*\
  !*** external "tty" ***!
  \**********************/
/***/ ((module) => {

"use strict";
module.exports = require("tty");

/***/ }),

/***/ "util":
/*!***********************!*\
  !*** external "util" ***!
  \***********************/
/***/ ((module) => {

"use strict";
module.exports = require("util");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/compat */
/******/ 	
/******/ 	if (typeof __nccwpck_require__ !== 'undefined') __nccwpck_require__.ab = __dirname + "/native_modules/";
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be isolated against other modules in the chunk.
(() => {
/*!**************************!*\
  !*** ./src/main/main.js ***!
  \**************************/
const { app, BrowserWindow, ipcMain, dialog, shell } = __webpack_require__(/*! electron */ "electron");
const path = __webpack_require__(/*! path */ "path");
const fs = __webpack_require__(/*! fs */ "fs");
const crypto = __webpack_require__(/*! crypto */ "crypto");

// Import utility modules
const moduleCache = {};

/**
 * Safely require a module with fallback implementation
 * @param {string} modulePath - Path to the module
 * @param {Object} fallback - Fallback implementation if module cannot be loaded
 * @returns {Object} The loaded module or fallback
 */
function safeRequire(modulePath, fallback) {
  try {
    if (moduleCache[modulePath]) {
      return moduleCache[modulePath];
    }
    
    const module = __webpack_require__("./src/main sync recursive")(modulePath);
    console.log(`Loaded module: ${modulePath}`);
    moduleCache[modulePath] = module;
    return module;
  } catch (err) {
    console.error(`Failed to load module: ${modulePath}`, err.message);
    return fallback;
  }
}

// Load required modules with fallbacks
const keyManager = safeRequire('../config/keyManager', {
  getKey: async () => {
    try {
      return encryptionKey || null;
    } catch (error) {
      console.error('Error in keyManager.getKey:', error);
      return null;
    }
  },
  setKey: async (key) => {
    try {
      global.encryptionKey = key;
      return true;
    } catch (error) {
      console.error('Error in keyManager.setKey:', error);
      return false;
    }
  },
  getMasterKey: async () => global.encryptionKey || null
});

const encryptionMethods = safeRequire('../crypto/encryptionMethods', {
  encrypt: async (data, key, algorithm = 'aes-256-gcm') => {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return {
      algorithm: 'aes-256-gcm',
      encryptedData: Buffer.concat([iv, authTag, encrypted])
    };
  },
  decrypt: async ({ encryptedData, algorithm }, key) => {
    const iv = encryptedData.slice(0, 16);
    const authTag = encryptedData.slice(16, 32);
    const encrypted = encryptedData.slice(32);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  },
  getAllEncryptionMethods: () => ['aes-256-gcm'],
  getEncryptionMethod: () => 'aes-256-gcm',
  setEncryptionMethod: () => true
});

const entropyAnalyzer = safeRequire('../crypto/entropyAnalyzer', {
  calculateEntropy: (data) => {
    // Simple entropy calculation fallback
    if (!data || data.length === 0) return 0;
    const freqs = new Array(256).fill(0);
    for (let i = 0; i < data.length; i++) freqs[data[i]]++;
    let entropy = 0;
    for (let i = 0; i < 256; i++) {
      if (freqs[i] > 0) {
        const p = freqs[i] / data.length;
        entropy -= p * (Math.log(p) / Math.log(2));
      }
    }
    return entropy;
  },
  analyzeEntropyInChunks: (data) => ({
    overallEntropy: entropyAnalyzer.calculateEntropy(data),
    rating: 'Analysis Limited',
    isGoodEncryption: null
  })
});

const cryptoUtil = safeRequire('../crypto/cryptoUtil', {});

const { analyzeFileEntropy } = safeRequire('../crypto/entropyAnalyzer', {});

// Global variables
let mainWindow;
let encryptionKey = null;

// App initialization
console.log('📂 App path:', app.getAppPath());
console.log('📁 User data path:', app.getPath('userData'));

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (__webpack_require__(/*! electron-squirrel-startup */ "./node_modules/electron-squirrel-startup/index.js")) {
  app.quit();
}

function createWindow() {
  console.log('[main.js] Starting createWindow function...');
  
  // Safely load optional dependencies
  const safeRequire = (module) => {
    try {
      return __webpack_require__("./src/main sync recursive")(module);
    } catch (e) {
      console.warn(`[main.js] Could not load module: ${module}`, e.message);
      return null;
    }
  };

  // Define paths
  const APP_PATH = app.getAppPath();
  console.log('[main.js] App path:', APP_PATH);

  // Determine preload script path
  let preloadPath;
  try {
    if (true) {
      preloadPath = 'C:\\Users\\brand\\GitHub\\seamless-encryptor\\.webpack\\renderer\\main_window\\preload.js';
      console.log('[main.js] Using webpack preload path:', preloadPath);
    } else {}
  } catch (error) {
    // Ultimate fallback
    preloadPath = path.join(APP_PATH, 'preload.js');
    console.log('[main.js] Using ultimate fallback preload path:', preloadPath);
  }

  // Create the browser window
  try {
    mainWindow = new BrowserWindow({
      width: 1024,
      height: 768,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: preloadPath,
        sandbox: true,
        webSecurity: true
      },
    });
    console.log('[main.js] Browser window created successfully.');
  } catch (error) {
    console.error('[main.js] Failed to create browser window:', error.message);
    return;
  }

  // Determine HTML path
  let htmlPath;
  try {
    if (true) {
      htmlPath = 'http://localhost:5000/main_window';
      console.log('[main.js] Using webpack HTML entry point:', htmlPath);
    } else {}
  } catch (error) {
    // Ultimate fallback
    htmlPath = 'file://' + path.join(APP_PATH, 'src/renderer/index.html');
    console.log('[main.js] Using ultimate fallback HTML path:', htmlPath);
  }

  // Load the HTML
  try {
    console.log('[main.js] Loading HTML from:', htmlPath);
    mainWindow.loadURL(htmlPath);
  } catch (error) {
    console.error('[main.js] Failed to load HTML:', error.message);
    // Try a simpler approach if the first attempt fails
    try {
      const simplePath = 'file://' + path.join(APP_PATH, 'src/renderer/index.html');
      console.log('[main.js] Trying simpler HTML path:', simplePath);
      mainWindow.loadFile(path.join(APP_PATH, 'src/renderer/index.html'));
    } catch (innerError) {
      console.error('[main.js] Also failed with simpler path:', innerError.message);
    }
  }

  // Open DevTools for debugging
  mainWindow.webContents.openDevTools();

  // Log when content loads or fails
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[main.js] Content finished loading successfully.');
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('[main.js] Content failed to load:', errorCode, errorDescription);
  });

  // Handle window being closed
  mainWindow.on('closed', function () {
    console.log('[main.js] Window closed event triggered.');
    mainWindow = null;
  });

  console.log('[main.js] Window creation complete.');
}

// Storage service for saving encrypted files
const storageService = {
  uploadFile: async (key, data) => {
    // For now, just save to the app's user data folder
    const storageDir = path.join(app.getPath('userData'), 'encrypted');
    
    // Create base directory if needed
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
    
    // Create subdirectory for this file
    const keyParts = key.split('/');
    if (keyParts.length > 1) {
      const dirPart = path.join(storageDir, keyParts[0]);
      if (!fs.existsSync(dirPart)) {
        fs.mkdirSync(dirPart, { recursive: true });
      }
    }
    
    const filePath = path.join(storageDir, key);
    await fs.promises.writeFile(filePath, data);
    return { key };
  },
  
  downloadFile: async (key) => {
    const storageDir = path.join(app.getPath('userData'), 'encrypted');
    const filePath = path.join(storageDir, key);
    
    if (fs.existsSync(filePath)) {
      return await fs.promises.readFile(filePath);
    }
    throw new Error('File not found');
  },
  
  deleteFile: async (key) => {
    const storageDir = path.join(app.getPath('userData'), 'encrypted');
    const filePath = path.join(storageDir, key);
    
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
      return true;
    }
    return false;
  }
};

// Helper function to decrypt data
async function decryptData(encryptedData, encryptionKey, algorithm) {
  try {
    const key = Buffer.from(encryptionKey, 'hex');
    
    // If an algorithm is specified, use it for decryption
    if (algorithm) {
      return await encryptionMethods.decrypt({ encryptedData, algorithm }, key);
    }
    
    // Legacy format (AES-256-GCM without algorithm tag)
    const iv = encryptedData.slice(0, 16);
    const authTag = encryptedData.slice(16, 32);
    const encrypted = encryptedData.slice(32);
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error(`Decryption failed: ${error.message}`);
  }
}

// IPC Handlers
ipcMain.handle('encrypt-file', async (event, filePath, method = 'aes-256-gcm') => {
  try {
    console.log(`encrypt-file handler called with:`, filePath, `method: ${method}`);
    
    // Input validation
    if (!filePath) {
      return { success: false, error: 'No file path provided' };
    }
    
    // If filePath is an array, take the first item (backward compatibility)
    if (Array.isArray(filePath)) {
      console.log('filePath is an array, taking the first item:', filePath[0]);
      filePath = filePath[0];
    }
    
    // If filePath is an object with a filePath property, extract it (backward compatibility)
    if (typeof filePath === 'object' && filePath !== null && filePath.filePath) {
      console.log('filePath is an object, extracting filePath property:', filePath.filePath);
      if (Array.isArray(filePath.filePath) && filePath.filePath.length > 0) {
        filePath = filePath.filePath[0];
      } else {
        filePath = filePath.filePath;
      }
    }
    
    // Last check to ensure filePath is a string
    if (typeof filePath !== 'string') {
      console.error('Invalid filePath format:', filePath);
      return { success: false, error: 'Invalid file path format' };
    }
    
    console.log(`Processing file: ${filePath}`);
    
    // Validate the encryption method
    const supportedMethods = ['aes-256-gcm', 'chacha20-poly1305', 'xchacha20-poly1305'];
    if (!method || !supportedMethods.includes(method)) {
      console.warn(`Unsupported encryption method: ${method}, defaulting to aes-256-gcm`);
      method = 'aes-256-gcm';
    }
    
    // Get encryption key - First check the global variable which should be set by generate-key
    let key = encryptionKey;
    console.log('Using encryption key exists:', !!key);
    
    // If no key in global variable, try to get from key manager
    if (!key && keyManager) {
      try {
        if (typeof keyManager.getKey === 'function') {
          key = await keyManager.getKey();
          console.log('Retrieved key from keyManager.getKey()');
        } else if (typeof keyManager.getMasterKey === 'function') {
          key = await keyManager.getMasterKey();
          console.log('Retrieved key from keyManager.getMasterKey()');
        }
      } catch (keyErr) {
        console.error('Error getting key from keyManager:', keyErr);
      }
    }
    
    // As a last resort, check if key exists in the file system
    if (!key) {
      const keyPath = path.join(app.getPath('userData'), 'encryption.key');
      if (fs.existsSync(keyPath)) {
        try {
          const keyData = fs.readFileSync(keyPath, 'utf8');
          key = Buffer.from(keyData, 'hex');
          console.log('Retrieved key from filesystem');
          // Store it for future use
          encryptionKey = key;
        } catch (fsErr) {
          console.error('Error reading key from filesystem:', fsErr);
        }
      }
    }
    
    if (!key) {
      console.error('No encryption key available');
      return { success: false, error: 'No encryption key available. Please generate or import a key first.' };
    }
    
    // If key is a hex string, convert to Buffer
    if (typeof key === 'string') {
      key = Buffer.from(key, 'hex');
    }
    
    // Ensure key is the right length (32 bytes for AES-256)
    if (key.length !== 32) {
      console.error(`Invalid key length: ${key.length} bytes, expected 32 bytes`);
      return { success: false, error: 'Invalid encryption key length.' };
    }
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return { success: false, error: `File not found: ${filePath}` };
    }
    
    // Read file content
    let fileContent;
    try {
      fileContent = fs.readFileSync(filePath);
    } catch (readError) {
      console.error('Error reading file:', readError);
      return { success: false, error: `Error reading file: ${readError.message}` };
    }
    
    // Generate a random IV (Initialization Vector)
    const iv = crypto.randomBytes(16);
    
    // Encrypt the file based on the selected method
    let encryptedData, authTag;
    
    if (method === 'aes-256-gcm') {
      // Use AES-256-GCM encryption
      try {
        const cipher = crypto.createCipheriv(method, key, iv);
        encryptedData = Buffer.concat([cipher.update(fileContent), cipher.final()]);
        authTag = cipher.getAuthTag(); // For AES-GCM, we need to get the authentication tag
      } catch (encryptError) {
        console.error('Error encrypting with AES-256-GCM:', encryptError);
        return { success: false, error: `Encryption error: ${encryptError.message}` };
      }
    } else if (method === 'chacha20-poly1305' || method === 'xchacha20-poly1305') {
      // Use ChaCha20-Poly1305 encryption
      try {
        const result = cryptoUtil.encryptChaCha20Poly1305(fileContent, key, iv);
        encryptedData = result.ciphertext;
        authTag = result.tag;
      } catch (encryptError) {
        console.error(`Error encrypting with ${method}:`, encryptError);
        return { success: false, error: `Encryption error: ${encryptError.message}` };
      }
    } else {
      return { success: false, error: `Unsupported encryption method: ${method}` };
    }
    
    // Convert encryption method to algorithm ID for storage
    const algorithmId = method === 'aes-256-gcm' ? 1 : 
                         method === 'chacha20-poly1305' ? 2 : 
                         method === 'xchacha20-poly1305' ? 3 : 1;
    
    // Prepare the encrypted file format with header
    // Format: [Magic Bytes (2)][Version (1)][Algorithm ID (1)][IV Length (1)][Auth Tag Length (1)][IV][Auth Tag][Ciphertext]
    const magicBytes = Buffer.from([0xF1, 0xE2]); // Magic bytes to identify our file format
    const formatVersion = Buffer.from([0x01]); // Version 1 of our format
    const algorithmIdBuffer = Buffer.from([algorithmId]);
    const ivLength = Buffer.from([iv.length]);
    const tagLength = Buffer.from([authTag.length]);
    
    const fullEncryptedData = Buffer.concat([
      magicBytes,
      formatVersion,
      algorithmIdBuffer,
      ivLength,
      tagLength,
      iv,
      authTag,
      encryptedData
    ]);
    
    // Generate a unique ID for the file
    const fileId = crypto.randomBytes(16).toString('hex');
    
    // Get original filename without path
    const fileName = path.basename(filePath);
    
    // Store the encrypted file
    const encryptedFilesDir = path.join(app.getPath('userData'), 'encrypted');
    if (!fs.existsSync(encryptedFilesDir)) {
      fs.mkdirSync(encryptedFilesDir, { recursive: true });
    }
    
    const encryptedFilePath = path.join(encryptedFilesDir, `${fileId}_${fileName}.enc`);
    
    try {
      fs.writeFileSync(encryptedFilePath, fullEncryptedData);
    } catch (writeError) {
      console.error('Error writing encrypted file:', writeError);
      return { success: false, error: `Error saving encrypted file: ${writeError.message}` };
    }
    
    // Store metadata about the encrypted file
    const metadata = {
      id: fileId,
      originalName: fileName,
      encryptedPath: encryptedFilePath,
      originalSize: fileContent.length,
      encryptedSize: fullEncryptedData.length,
      algorithm: method,
      timestamp: new Date().toISOString(),
    };
    
    // Save metadata to a database or file
    try {
      const metadataPath = path.join(encryptedFilesDir, 'metadata.json');
      let existingMetadata = [];
      
      if (fs.existsSync(metadataPath)) {
        try {
          const metadataContent = fs.readFileSync(metadataPath, 'utf8');
          existingMetadata = JSON.parse(metadataContent);
        } catch (parseError) {
          console.warn('Error parsing metadata, creating new file:', parseError);
        }
      }
      
      existingMetadata.push(metadata);
      fs.writeFileSync(metadataPath, JSON.stringify(existingMetadata, null, 2));
    } catch (metadataError) {
      console.warn('Error saving metadata, but encryption succeeded:', metadataError);
    }
    
    console.log(`File encrypted successfully: ${encryptedFilePath}`);
    
    return {
      success: true,
      fileId,
      fileName,
      algorithm: method,
      size: fileContent.length,
      encryptedPath: encryptedFilePath
    };
  } catch (error) {
    console.error('Error in encrypt-file handler:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('decrypt-file', async (event, fileId, fileName) => {
  try {
    console.log('decrypt-file handler called with:', { fileId, fileName });
    
    // Input validation
    if (!fileId) {
      return { success: false, error: 'No file ID provided' };
    }
    
    if (!fileName) {
      return { success: false, error: 'No file name provided' };
    }
    
    // Get encryption key
    const key = await keyManager.getKey();
    if (!key) {
      console.error('No encryption key available');
      return { success: false, error: 'No encryption key available' };
    }
    
    // Resolve file data - try different approaches
    let encryptedData, filePath;
    
    try {
      // First approach: Use storage service
      try {
        const fileData = await storageService.downloadFile(fileId);
        if (fileData && fileData.data) {
          encryptedData = Buffer.from(fileData.data);
          console.log(`Retrieved file data from storage service: ${encryptedData.length} bytes`);
        }
      } catch (storageError) {
        console.log('Storage service lookup failed, trying file path approach:', storageError.message);
      }
      
      // Second approach: Treat fileId as a path
      if (!encryptedData && typeof fileId === 'string' && (fileId.includes('/') || fileId.includes('\\'))) {
        filePath = fileId;
        if (fs.existsSync(filePath)) {
          encryptedData = fs.readFileSync(filePath);
          console.log(`Read file from path ${filePath}: ${encryptedData.length} bytes`);
        }
      }
      
      // Final fallback: Try to find file by name in the encrypted files directory
      if (!encryptedData) {
        const encryptedDir = path.join(app.getPath('userData'), 'encrypted');
        if (fs.existsSync(encryptedDir)) {
          const possiblePaths = fs.readdirSync(encryptedDir)
            .filter(item => item.includes(fileId) || item.includes(fileName));
          
          if (possiblePaths.length > 0) {
            filePath = path.join(encryptedDir, possiblePaths[0]);
            encryptedData = fs.readFileSync(filePath);
            console.log(`Found file via directory search: ${filePath}`);
          }
        }
      }
    } catch (fsError) {
      console.error('Error reading encrypted file:', fsError);
      return { success: false, error: `Error reading file: ${fsError.message}` };
    }
    
    // If we still don't have data, return an error
    if (!encryptedData || encryptedData.length === 0) {
      console.error('Could not locate or read encrypted file data');
      return { success: false, error: 'Could not find or read encrypted file' };
    }
    
    // Extract metadata - first try the modern format with headers
    let algorithm = 'aes-256-gcm'; // Default algorithm
    let iv, tag, ciphertext;
    
    try {
      // Try to parse the file header
      const header = encryptedData.slice(0, 2).toString('hex');
      
      if (header === 'f1e2') { // Magic bytes for our encrypted file format
        const formatVersion = encryptedData[2];
        const algorithmId = encryptedData[3];
        
        // Map algorithm ID to name
        if (algorithmId === 1) {
          algorithm = 'aes-256-gcm';
        } else if (algorithmId === 2) {
          algorithm = 'chacha20-poly1305';
        }
        
        const ivLength = encryptedData[4];
        const tagLength = encryptedData[5];
        const headerLength = 6; // 2 magic bytes + 1 version + 1 algorithm + 1 ivLength + 1 tagLength
        
        iv = encryptedData.slice(headerLength, headerLength + ivLength);
        tag = encryptedData.slice(headerLength + ivLength, headerLength + ivLength + tagLength);
        ciphertext = encryptedData.slice(headerLength + ivLength + tagLength);
        
        console.log(`Parsed modern format: algorithm=${algorithm}, ivLength=${ivLength}, tagLength=${tagLength}`);
      } else {
        // Legacy format - fixed offsets
        iv = encryptedData.slice(0, 16);
        tag = encryptedData.slice(16, 32);
        ciphertext = encryptedData.slice(32);
        
        console.log('Using legacy format with fixed offsets');
      }
    } catch (parseError) {
      console.error('Error parsing encrypted data:', parseError);
      return { success: false, error: `Error parsing encrypted data: ${parseError.message}` };
    }
    
    // Now decrypt with the appropriate algorithm
    let decryptedData;
    try {
      if (algorithm === 'aes-256-gcm') {
        const decipher = crypto.createDecipheriv(algorithm, key, iv);
        decipher.setAuthTag(tag);
        decryptedData = Buffer.concat([
          decipher.update(ciphertext),
          decipher.final()
        ]);
      } else if (algorithm === 'chacha20-poly1305') {
        // Use ChaCha20-Poly1305 decryption
        decryptedData = cryptoUtil.decryptChaCha20Poly1305(ciphertext, key, iv, tag);
      } else {
        return { success: false, error: `Unsupported algorithm: ${algorithm}` };
      }
    } catch (decryptError) {
      console.error('Error decrypting data:', decryptError);
      return { success: false, error: `Decryption failed: ${decryptError.message}` };
    }
    
    if (!decryptedData) {
      return { success: false, error: 'Decryption produced no data' };
    }
    
    // Save the decrypted file
    const downloadsPath = app.getPath('downloads');
    const decryptedFilePath = path.join(downloadsPath, fileName);
    
    try {
      fs.writeFileSync(decryptedFilePath, decryptedData);
      console.log(`Decrypted file saved to: ${decryptedFilePath}`);
      
      return {
        success: true,
        filePath: decryptedFilePath
      };
    } catch (writeError) {
      console.error('Error writing decrypted file:', writeError);
      return { success: false, error: `Error saving decrypted file: ${writeError.message}` };
    }
  } catch (error) {
    console.error('Error in decrypt-file handler:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('download-file', async (event, { fileId, fileName }) => {
    try {
        // Send progress updates
        event.sender.send('download-progress', { progress: 0, status: 'Starting download...' });
        
        // Get encryption key
        const encryptionKey = getEncryptionKey();
        if (!encryptionKey) {
            throw new Error('Encryption key not found');
        }

        // Construct storage key
        const storageKey = `${fileId}/${fileName}.enc`;
        const metadataKey = `${fileId}/metadata.json`;

        // Try to get metadata
        let algorithm = null;
        try {
            const metadataRaw = await storageService.downloadFile(metadataKey);
            const metadata = JSON.parse(metadataRaw.toString());
            algorithm = metadata.algorithm;
        } catch (err) {
            console.warn('No metadata found, assuming AES-256-GCM:', err);
        }

        // Download encrypted data
        event.sender.send('download-progress', { progress: 25, status: 'Downloading encrypted file...' });
        const encryptedData = await storageService.downloadFile(storageKey);

        // Decrypt the data
        event.sender.send('download-progress', { progress: 50, status: `Decrypting file with ${algorithm || 'AES-256-GCM'}...` });
        const decryptedData = await decryptData(encryptedData, encryptionKey.toString('hex'), algorithm);

        // Save the decrypted file
        event.sender.send('download-progress', { progress: 75, status: 'Saving file...' });
        const savePath = await dialog.showSaveDialog({
            defaultPath: fileName,
            filters: [{ name: 'All Files', extensions: ['*'] }]
        });

        if (savePath.canceled) {
            return { success: false, error: 'Download cancelled' };
        }

        await fs.promises.writeFile(savePath.filePath, decryptedData);
        event.sender.send('download-progress', { progress: 100, status: 'Download complete!' });

        return { success: true };
    } catch (err) {
        console.error('Download error:', err);
        return { success: false, error: err.message };
    }
});

// Download the encrypted file without decrypting
ipcMain.handle('download-encrypted-file', async (event, { fileId, fileName }) => {
    try {
        // Send progress updates
        event.sender.send('download-progress', { progress: 0, status: 'Starting download...' });
        
        // Construct storage key
        const storageKey = `${fileId}/${fileName}.enc`;
        const metadataKey = `${fileId}/metadata.json`;
        
        // Try to get metadata
        let algorithm = 'unknown';
        try {
            const metadataRaw = await storageService.downloadFile(metadataKey);
            const metadata = JSON.parse(metadataRaw.toString());
            algorithm = metadata.algorithm || 'unknown';
        } catch (err) {
            console.warn('No metadata found:', err);
        }

        // Download encrypted data
        event.sender.send('download-progress', { progress: 50, status: 'Downloading encrypted file...' });
        const encryptedData = await storageService.downloadFile(storageKey);

        // Save the encrypted file
        event.sender.send('download-progress', { progress: 75, status: 'Saving file...' });
        const savePath = await dialog.showSaveDialog({
            defaultPath: `${fileName}.${algorithm}.encrypted`,
            filters: [{ name: 'Encrypted Files', extensions: ['encrypted'] }]
        });

        if (savePath.canceled) {
            return { success: false, error: 'Download cancelled' };
        }

        await fs.promises.writeFile(savePath.filePath, encryptedData);
        event.sender.send('download-progress', { progress: 100, status: 'Download complete!' });

        return { success: true };
    } catch (err) {
        console.error('Download error:', err);
        return { success: false, error: err.message };
    }
});

ipcMain.handle('delete-file', async (event, fileId) => {
  try {
    // Get the file info from the renderer
    const storageKey = `${fileId}/*`;
    
    // Find all files matching the pattern
    const storageDir = path.join(app.getPath('userData'), 'encrypted', fileId);
    if (fs.existsSync(storageDir)) {
      const files = fs.readdirSync(storageDir);
      for (const file of files) {
        await storageService.deleteFile(`${fileId}/${file}`);
      }
      
      // Remove the directory
      fs.rmdirSync(storageDir);
    }
    
    return {
      success: true
    };
  } catch (error) {
    event.sender.send('error', `Delete failed: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
});

// Handle delete-encrypted-file IPC call
ipcMain.handle('delete-encrypted-file', async (event, fileId) => {
  try {
    console.log('delete-encrypted-file handler called for file ID:', fileId);
    
    // Input validation
    if (!fileId) {
      return { success: false, error: 'No file ID provided' };
    }
    
    // Find the file in the encrypted files directory
    const encryptedDir = path.join(app.getPath('userData'), 'encrypted');
    let filePath = '';
    
    // Check if the file ID directly matches a filename
    if (fs.existsSync(path.join(encryptedDir, fileId))) {
      filePath = path.join(encryptedDir, fileId);
    } else {
      // Look for files with this ID at the beginning of their name
      const files = fs.readdirSync(encryptedDir);
      const matchingFile = files.find(f => f.startsWith(fileId));
      
      if (matchingFile) {
        filePath = path.join(encryptedDir, matchingFile);
      } else {
        return { success: false, error: 'File not found' };
      }
    }
    
    // Delete the file
    fs.unlinkSync(filePath);
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting encrypted file:', error);
    return { success: false, error: error.message };
  }
});

// Add list-files handler after the delete-file handler (around line 352)
ipcMain.handle('list-files', async (event) => {
  try {
    const storageDir = path.join(app.getPath('userData'), 'encrypted');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
      return []; // Return empty array if directory was just created
    }
    
    // Get all file IDs (directories)
    const fileIds = fs.readdirSync(storageDir).filter(item => {
      return fs.statSync(path.join(storageDir, item)).isDirectory();
    });
    
    // Get file info for each file
    const files = [];
    for (const fileId of fileIds) {
      const fileDir = path.join(storageDir, fileId);
      const fileItems = fs.readdirSync(fileDir);
      
      // Find the encrypted file and metadata
      const encFile = fileItems.find(file => file.endsWith('.enc'));
      const metadataFile = fileItems.find(file => file === 'metadata.json');
      
      if (encFile) {
        let metadata = {};
        if (metadataFile) {
          try {
            const metadataContent = fs.readFileSync(path.join(fileDir, metadataFile), 'utf8');
            metadata = JSON.parse(metadataContent);
          } catch (err) {
            console.warn(`Error reading metadata for ${fileId}: ${err.message}`);
          }
        }
        
        // Get file stats
        const stats = fs.statSync(path.join(fileDir, encFile));
        
        files.push({
          id: fileId,
          name: metadata.originalName || encFile.replace('.enc', ''),
          size: stats.size,
          date: metadata.timestamp || stats.mtime.toISOString(),
          algorithm: metadata.algorithm || 'unknown'
        });
      }
    }
    
    // Sort by date, newest first
    files.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    return files;
  } catch (error) {
    console.error('Error listing files:', error);
    return [];
  }
});

// Add entropy analysis handler
ipcMain.handle('analyze-file-entropy', async (event, fileId) => {
  try {
    console.log('analyze-file-entropy handler called with:', fileId);
    
    if (!fileId) {
      return { success: false, error: 'No file ID provided' };
    }
    
    // Get the file path instead of trying to read a directory
    let filePath;
    let fileBuffer;
    
    try {
      // Check if the fileId is already a path
      if (typeof fileId === 'string' && (fileId.includes('/') || fileId.includes('\\'))) {
        filePath = fileId;
        // Check if the path exists and is a file, not a directory
        const stats = fs.statSync(filePath);
        if (stats.isDirectory()) {
          return { success: false, error: 'Cannot analyze a directory' };
        }
        fileBuffer = fs.readFileSync(filePath);
      } else {
        // Otherwise, try to get the file data from storage service
        try {
          const encryptedData = await storageService.downloadFile(fileId);
          if (!encryptedData || !encryptedData.data) {
            return { success: false, error: 'File not found or empty' };
          }
          fileBuffer = Buffer.from(encryptedData.data);
        } catch (storageError) {
          console.error('Storage service error:', storageError);
          return { success: false, error: `Storage error: ${storageError.message}` };
        }
      }
    } catch (fsError) {
      console.error('File system error:', fsError);
      return { success: false, error: fsError.message };
    }
    
    if (!fileBuffer || fileBuffer.length === 0) {
      return { success: false, error: 'File is empty' };
    }
    
    // Analyze entropy in chunks
    const analysis = entropyAnalyzer.analyzeEntropyInChunks(fileBuffer);
    
    console.log('Entropy analysis complete:', {
      fileId: fileId,
      filePath: filePath,
      size: fileBuffer.length,
      overallEntropy: analysis.overallEntropy,
      rating: analysis.rating
    });
    
    return {
      success: true,
      analysis
    };
  } catch (error) {
    console.error('Error in entropy analysis:', error);
    return { success: false, error: error.message };
  }
});

// Add test-ipc handler
ipcMain.handle('test-ipc', async () => {
  console.log('[main.js] test-ipc handler called');
  return 'Test IPC successful!';
});

// Get all available encryption methods
ipcMain.handle('get-encryption-methods', () => {
  return encryptionMethods.getAllEncryptionMethods();
});

// Get current encryption method
ipcMain.handle('get-current-encryption-method', () => {
  return encryptionMethods.getEncryptionMethod();
});

// Set encryption method
ipcMain.handle('set-encryption-method', (event, method) => {
  const result = encryptionMethods.setEncryptionMethod(method);
  return {
    success: result,
    currentMethod: encryptionMethods.getEncryptionMethod()
  };
});

// Function to get the encryption key, generating one if needed
function getEncryptionKey() {
  console.log('getEncryptionKey called, encryptionKey exists:', !!encryptionKey);
  if (!encryptionKey) {
    try {
      // Try to get from key manager if available
      if (keyManager && typeof keyManager.getMasterKey === 'function') {
        console.log('Using keyManager.getMasterKey()');
        try {
          // The getMasterKey function returns a promise, but we need synchronous
          // behavior for this function. Using a temporary fallback key for now.
          encryptionKey = crypto.randomBytes(32);
          console.log('Generated temporary key while waiting for keyManager');
          
          // Try to get the actual key asynchronously for next time
          keyManager.getMasterKey().then(key => {
            encryptionKey = key;
            console.log('Successfully retrieved key from keyManager');
          }).catch(err => {
            console.error('Failed to get key from keyManager:', err);
          });
        } catch (keyErr) {
          console.error('Error accessing keyManager.getMasterKey:', keyErr);
          encryptionKey = crypto.randomBytes(32);
        }
        return encryptionKey;
      } else {
        // Generate a temporary key for the session
        console.log('No keyManager available, generating temporary encryption key');
        encryptionKey = crypto.randomBytes(32);
        console.warn('Using temporary encryption key. Keys will not persist between sessions.');
      }
    } catch (err) {
      console.error('Error getting encryption key:', err);
      // Generate a temporary key if key manager fails
      encryptionKey = crypto.randomBytes(32);
      console.warn('Using temporary encryption key due to error. Keys will not persist between sessions.');
    }
  }
  return encryptionKey;
}

// Handle check-key-status IPC call
ipcMain.handle('check-key-status', async (event) => {
  try {
    console.log('check-key-status handler called');
    
    // Try to get key from multiple sources
    let key = global.encryptionKey;
    let source = 'memory';
    
    // If no key in memory, try to get from key manager
    if (!key && keyManager && typeof keyManager.getKey === 'function') {
      try {
        key = await keyManager.getKey();
        if (key) source = 'keyManager';
      } catch (keyErr) {
        console.error('Error getting key from keyManager:', keyErr);
      }
    }
    
    // Check if key exists in file system as last resort
    if (!key) {
      const keyPath = path.join(app.getPath('userData'), 'encryption.key');
      if (fs.existsSync(keyPath)) {
        try {
          const keyData = fs.readFileSync(keyPath, 'utf8');
          key = Buffer.from(keyData, 'hex');
          source = 'file';
        } catch (fileErr) {
          console.error('Error reading key file:', fileErr);
        }
      }
    }
    
    if (key) {
      // Generate a short ID from the key for display purposes
      let keyId = '';
      if (Buffer.isBuffer(key)) {
        keyId = key.toString('hex').substring(0, 8);
      } else if (typeof key === 'string') {
        keyId = key.substring(0, 8);
      }
      
      return {
        exists: true,
        keyId: keyId,
        source: source
      };
    }
    
    return { exists: false };
  } catch (error) {
    console.error('Error checking key status:', error);
    return { exists: false, error: error.message };
  }
});

// Handle generate-key IPC call
ipcMain.handle('generate-key', async (event) => {
  try {
    console.log('generate-key handler called');
    
    // Generate a secure random key
    const key = crypto.randomBytes(32); // 256 bits
    
    // Save the key in memory
    global.encryptionKey = key;
    
    // Try to save to key manager if available
    if (keyManager && typeof keyManager.setKey === 'function') {
      try {
        await keyManager.setKey(key);
      } catch (keyErr) {
        console.error('Error saving key to keyManager:', keyErr);
      }
    }
    
    // Always save to file system as backup
    try {
      const keyPath = path.join(app.getPath('userData'), 'encryption.key');
      fs.writeFileSync(keyPath, key.toString('hex'), 'utf8');
      console.log('Key saved to file system at:', keyPath);
    } catch (fileErr) {
      console.error('Error saving key to file system:', fileErr);
    }
    
    return {
      success: true,
      keyId: key.toString('hex').substring(0, 8)
    };
  } catch (error) {
    console.error('Error generating key:', error);
    return { success: false, error: error.message };
  }
});

// Handle get-encrypted-files IPC call
ipcMain.handle('get-encrypted-files', async (event) => {
  try {
    console.log('get-encrypted-files handler called');
    
    // Define the encrypted files directory
    const encryptedDir = path.join(app.getPath('userData'), 'encrypted');
    
    // Create the directory if it doesn't exist
    if (!fs.existsSync(encryptedDir)) {
      fs.mkdirSync(encryptedDir, { recursive: true });
      console.log('Created encrypted files directory:', encryptedDir);
      return []; // Return empty array since no files exist yet
    }
    
    // Get all files in the directory
    const files = fs.readdirSync(encryptedDir);
    const fileList = [];
    
    // Process each file to get metadata
    for (const fileName of files) {
      try {
        const filePath = path.join(encryptedDir, fileName);
        const stats = fs.statSync(filePath);
        
        // Skip directories and non-regular files
        if (!stats.isFile()) continue;
        
        // Read metadata from file (first 1KB should contain metadata)
        const fileBuffer = Buffer.alloc(1024);
        const fd = fs.openSync(filePath, 'r');
        fs.readSync(fd, fileBuffer, 0, 1024, 0);
        fs.closeSync(fd);
        
        // Try to extract metadata from the file header
        let metadata = {};
        try {
          // Look for JSON metadata at the beginning of the file
          const headerStr = fileBuffer.toString('utf8', 0, 1024);
          const metaMatch = headerStr.match(/^METADATA:(.*?)\n/);
          if (metaMatch && metaMatch[1]) {
            metadata = JSON.parse(metaMatch[1]);
          }
        } catch (metaErr) {
          console.log('Could not parse metadata for file:', fileName);
        }
        
        // Extract file extension from original name or current name
        const originalName = metadata.originalName || fileName;
        const extension = path.extname(originalName).toLowerCase();
        
        // Generate file ID from name (or use existing if present)
        const fileId = metadata.id || fileName.replace(/\.[^/.]+$/, '');
        
        // Calculate entropy sample (first 4KB max)
        const entropyBuffer = Buffer.alloc(Math.min(stats.size, 4096));
        const entropyFd = fs.openSync(filePath, 'r');
        fs.readSync(entropyFd, entropyBuffer, 0, entropyBuffer.length, 0);
        fs.closeSync(entropyFd);
        
        // Calculate entropy either with analyzer or fallback
        let entropy = 0.5; // Default midpoint
        if (entropyAnalyzer && typeof entropyAnalyzer.calculateEntropy === 'function') {
          entropy = entropyAnalyzer.calculateEntropy(entropyBuffer);
        }
        
        fileList.push({
          id: fileId,
          name: metadata.originalName || fileName,
          size: stats.size,
          created: metadata.created || stats.birthtime.getTime(),
          algorithm: metadata.algorithm || 'aes-256-gcm',
          entropy: entropy,
          extension: extension,
          path: filePath
        });
      } catch (fileErr) {
        console.error(`Error processing file ${fileName}:`, fileErr);
      }
    }
    
    console.log('Returning file list with', fileList.length, 'files');
    return fileList;
  } catch (error) {
    console.error('Error getting encrypted files:', error);
    throw error;
  }
});

// Handle import-key IPC call
ipcMain.handle('import-key', async (event, keyData) => {
  try {
    console.log('import-key handler called');
    
    // Validate key data
    if (!keyData) {
      return { success: false, error: 'No key data provided' };
    }
    
    // Convert to buffer if it's a hex string
    let key;
    if (typeof keyData === 'string') {
      // Check if it's a valid hex string
      if (!/^[0-9a-f]+$/i.test(keyData)) {
        return { success: false, error: 'Invalid key format, must be hex string' };
      }
      
      // Ensure key is 32 bytes (256 bits)
      if (keyData.length !== 64) { // 32 bytes = 64 hex chars
        return { success: false, error: 'Key must be 256 bits (32 bytes)' };
      }
      
      key = Buffer.from(keyData, 'hex');
    } else if (Buffer.isBuffer(keyData)) {
      // Ensure key is 32 bytes (256 bits)
      if (keyData.length !== 32) {
        return { success: false, error: 'Key must be 256 bits (32 bytes)' };
      }
      
      key = keyData;
    } else {
      return { success: false, error: 'Invalid key type, must be string or buffer' };
    }
    
    // Save the key to memory
    global.encryptionKey = key;
    
    // Try to save to key manager if available
    if (keyManager && typeof keyManager.setKey === 'function') {
      try {
        await keyManager.setKey(key);
      } catch (keyErr) {
        console.error('Error saving key to keyManager:', keyErr);
      }
    }
    
    // Always save to file system as backup
    try {
      const keyPath = path.join(app.getPath('userData'), 'encryption.key');
      fs.writeFileSync(keyPath, key.toString('hex'), 'utf8');
    } catch (fileErr) {
      console.error('Error saving key to file system:', fileErr);
    }
    
    return {
      success: true,
      keyId: key.toString('hex').substring(0, 8)
    };
  } catch (error) {
    console.error('Error importing key:', error);
    return { success: false, error: error.message };
  }
});

// Handle create-custom-key IPC call
ipcMain.handle('create-custom-key', async (event, passphrase, entropyPhrase) => {
  try {
    console.log('create-custom-key handler called');
    
    // Validate passphrases
    if (!passphrase) {
      return { success: false, error: 'No passphrase provided' };
    }
    
    // Create a key from the passphrase using PBKDF2
    // Use entropyPhrase as salt if provided, otherwise use a random salt
    const salt = entropyPhrase ? 
      crypto.createHash('sha256').update(entropyPhrase).digest().slice(0, 16) : 
      crypto.randomBytes(16);
    
    // Derive key with 100,000 iterations (strong security)
    const key = crypto.pbkdf2Sync(passphrase, salt, 100000, 32, 'sha256');
    
    // Save the key to memory
    global.encryptionKey = key;
    
    // Try to save to key manager if available
    if (keyManager && typeof keyManager.setKey === 'function') {
      try {
        await keyManager.setKey(key);
      } catch (keyErr) {
        console.error('Error saving key to keyManager:', keyErr);
      }
    }
    
    // Always save to file system as backup
    try {
      const keyPath = path.join(app.getPath('userData'), 'encryption.key');
      fs.writeFileSync(keyPath, key.toString('hex'), 'utf8');
    } catch (fileErr) {
      console.error('Error saving key to file system:', fileErr);
    }
    
    return {
      success: true,
      keyId: key.toString('hex').substring(0, 8)
    };
  } catch (error) {
    console.error('Error creating custom key:', error);
    return { success: false, error: error.message };
  }
});

// Handle get-key IPC call
ipcMain.handle('get-key', async (event) => {
  try {
    console.log('get-key handler called');
    
    // Try different methods to get the key
    let key;
    
    // Try the getKey method if it exists
    if (keyManager.getKey) {
      key = await keyManager.getKey();
    }
    // Try the getCurrentKey method if getKey failed or doesn't exist
    else if (keyManager.getCurrentKey) {
      key = await keyManager.getCurrentKey();
    }
    // Fallback implementation if neither method exists
    else {
      const keyPath = path.join(app.getPath('userData'), 'encryption.key');
      if (fs.existsSync(keyPath)) {
        key = fs.readFileSync(keyPath);
      }
    }
    
    if (!key) {
      console.log('No encryption key available');
      return null;
    }
    
    // Convert the key to hex string for easier handling in the renderer
    if (Buffer.isBuffer(key)) {
      return key.toString('hex');
    } else if (typeof key === 'string') {
      // If already a string, ensure it's a valid hex string
      return key.match(/^[0-9a-f]+$/i) ? key : Buffer.from(key).toString('hex');
    }
    
    return null;
  } catch (error) {
    console.error('Error in get-key handler:', error);
    return null;
  }
});

// Handle set-key IPC call
ipcMain.handle('set-key', async (event, keyHex) => {
  try {
    console.log('set-key handler called');
    
    encryptionKey = Buffer.from(keyHex, 'hex');
    console.log('Key set successfully');
    return true;
  } catch (error) {
    console.error('Error setting key:', error);
    throw error;
  }
});

// Fix the saveFileDialog handler to work with a filename parameter
ipcMain.handle('save-file-dialog', async (event, filename = 'file.txt') => {
  const result = await dialog.showSaveDialog({
    defaultPath: filename,
    filters: [
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  
  if (!result.canceled) {
    return result.filePath;
  }
  return null;
});

ipcMain.handle('open-file-dialog', async () => {
  console.log('open-file-dialog handler called');
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  
  console.log('Dialog result:', result.canceled ? 'Canceled' : `Selected ${result.filePaths.length} files`);
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths;
  }
  return [];
});

ipcMain.handle('save-dropped-file', async (event, fileInfo) => {
  try {
    // Save to temp directory since renderer can't access file paths
    const tempDir = path.join(app.getPath('temp'), 'seamless-encryptor');
    
    // Create temp dir if needed
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Create unique filename with timestamp
    const timestamp = Date.now();
    const fileName = fileInfo.name || 'file';
    const tempFilePath = path.join(tempDir, `${timestamp}-${path.basename(fileName)}`);
    
    // Convert array to buffer and save
    const buffer = Buffer.from(new Uint8Array(fileInfo.data));
    await fs.promises.writeFile(tempFilePath, buffer);
    
    // Clean up temp file after 1 minute
    setTimeout(() => {
      try {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      } catch (cleanupError) {
        console.error('Failed to clean up temp file:', cleanupError);
      }
    }, 60000);
    
    return tempFilePath;
  } catch (error) {
    event.sender.send('error', `Failed to process dropped file: ${error.message}`);
    throw error;
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

console.log('[main.js] Reached end of main.js script execution.');

// Create window when app is ready
app.on('ready', () => {
  console.log('[main.js] App ready event received.');
  createWindow();
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  console.log('[main.js] window-all-closed event received.');
  if (process.platform !== 'darwin') {
    console.log('[main.js] Quitting app (platform is not macOS).');
    app.quit();
  } else {
    console.log('[main.js] Not quitting app (platform is macOS).');
  }
});

// On macOS, re-create window when dock icon is clicked and no other windows are open
app.on('activate', () => {
  console.log('[main.js] activate event received.');
  if (BrowserWindow.getAllWindows().length === 0) {
    console.log('[main.js] No windows open, calling createWindow() on activate.');
    createWindow();
  } else {
    console.log('[main.js] Windows already open, not creating new window on activate.');
  }
});

})();

module.exports = __webpack_exports__;
/******/ })()
;
//# sourceMappingURL=main.js.map