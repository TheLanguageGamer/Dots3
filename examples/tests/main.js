var Module = typeof Module !== "undefined" ? Module : {};

var moduleOverrides = {};

var key;

for (key in Module) {
 if (Module.hasOwnProperty(key)) {
  moduleOverrides[key] = Module[key];
 }
}

Module["arguments"] = [];

Module["thisProgram"] = "./this.program";

Module["quit"] = function(status, toThrow) {
 throw toThrow;
};

Module["preRun"] = [];

Module["postRun"] = [];

var ENVIRONMENT_IS_WEB = false;

var ENVIRONMENT_IS_WORKER = false;

var ENVIRONMENT_IS_NODE = false;

var ENVIRONMENT_IS_SHELL = false;

ENVIRONMENT_IS_WEB = typeof window === "object";

ENVIRONMENT_IS_WORKER = typeof importScripts === "function";

ENVIRONMENT_IS_NODE = typeof process === "object" && typeof require === "function" && !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_WORKER;

ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;

if (Module["ENVIRONMENT"]) {
 throw new Error("Module.ENVIRONMENT has been deprecated. To force the environment, use the ENVIRONMENT compile-time option (for example, -s ENVIRONMENT=web or -s ENVIRONMENT=node)");
}

var scriptDirectory = "";

function locateFile(path) {
 if (Module["locateFile"]) {
  return Module["locateFile"](path, scriptDirectory);
 } else {
  return scriptDirectory + path;
 }
}

if (ENVIRONMENT_IS_NODE) {
 scriptDirectory = __dirname + "/";
 var nodeFS;
 var nodePath;
 Module["read"] = function shell_read(filename, binary) {
  var ret;
  if (!nodeFS) nodeFS = require("fs");
  if (!nodePath) nodePath = require("path");
  filename = nodePath["normalize"](filename);
  ret = nodeFS["readFileSync"](filename);
  return binary ? ret : ret.toString();
 };
 Module["readBinary"] = function readBinary(filename) {
  var ret = Module["read"](filename, true);
  if (!ret.buffer) {
   ret = new Uint8Array(ret);
  }
  assert(ret.buffer);
  return ret;
 };
 if (process["argv"].length > 1) {
  Module["thisProgram"] = process["argv"][1].replace(/\\/g, "/");
 }
 Module["arguments"] = process["argv"].slice(2);
 if (typeof module !== "undefined") {
  module["exports"] = Module;
 }
 process["on"]("uncaughtException", function(ex) {
  if (!(ex instanceof ExitStatus)) {
   throw ex;
  }
 });
 process["on"]("unhandledRejection", abort);
 Module["quit"] = function(status) {
  process["exit"](status);
 };
 Module["inspect"] = function() {
  return "[Emscripten Module object]";
 };
} else if (ENVIRONMENT_IS_SHELL) {
 if (typeof read != "undefined") {
  Module["read"] = function shell_read(f) {
   return read(f);
  };
 }
 Module["readBinary"] = function readBinary(f) {
  var data;
  if (typeof readbuffer === "function") {
   return new Uint8Array(readbuffer(f));
  }
  data = read(f, "binary");
  assert(typeof data === "object");
  return data;
 };
 if (typeof scriptArgs != "undefined") {
  Module["arguments"] = scriptArgs;
 } else if (typeof arguments != "undefined") {
  Module["arguments"] = arguments;
 }
 if (typeof quit === "function") {
  Module["quit"] = function(status) {
   quit(status);
  };
 }
} else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
 if (ENVIRONMENT_IS_WORKER) {
  scriptDirectory = self.location.href;
 } else if (document.currentScript) {
  scriptDirectory = document.currentScript.src;
 }
 if (scriptDirectory.indexOf("blob:") !== 0) {
  scriptDirectory = scriptDirectory.substr(0, scriptDirectory.lastIndexOf("/") + 1);
 } else {
  scriptDirectory = "";
 }
 Module["read"] = function shell_read(url) {
  var xhr = new XMLHttpRequest();
  xhr.open("GET", url, false);
  xhr.send(null);
  return xhr.responseText;
 };
 if (ENVIRONMENT_IS_WORKER) {
  Module["readBinary"] = function readBinary(url) {
   var xhr = new XMLHttpRequest();
   xhr.open("GET", url, false);
   xhr.responseType = "arraybuffer";
   xhr.send(null);
   return new Uint8Array(xhr.response);
  };
 }
 Module["readAsync"] = function readAsync(url, onload, onerror) {
  var xhr = new XMLHttpRequest();
  xhr.open("GET", url, true);
  xhr.responseType = "arraybuffer";
  xhr.onload = function xhr_onload() {
   if (xhr.status == 200 || xhr.status == 0 && xhr.response) {
    onload(xhr.response);
    return;
   }
   onerror();
  };
  xhr.onerror = onerror;
  xhr.send(null);
 };
 Module["setWindowTitle"] = function(title) {
  document.title = title;
 };
} else {
 throw new Error("environment detection error");
}

var out = Module["print"] || (typeof console !== "undefined" ? console.log.bind(console) : typeof print !== "undefined" ? print : null);

var err = Module["printErr"] || (typeof printErr !== "undefined" ? printErr : typeof console !== "undefined" && console.warn.bind(console) || out);

for (key in moduleOverrides) {
 if (moduleOverrides.hasOwnProperty(key)) {
  Module[key] = moduleOverrides[key];
 }
}

moduleOverrides = undefined;

assert(typeof Module["memoryInitializerPrefixURL"] === "undefined", "Module.memoryInitializerPrefixURL option was removed, use Module.locateFile instead");

assert(typeof Module["pthreadMainPrefixURL"] === "undefined", "Module.pthreadMainPrefixURL option was removed, use Module.locateFile instead");

assert(typeof Module["cdInitializerPrefixURL"] === "undefined", "Module.cdInitializerPrefixURL option was removed, use Module.locateFile instead");

assert(typeof Module["filePackagePrefixURL"] === "undefined", "Module.filePackagePrefixURL option was removed, use Module.locateFile instead");

var STACK_ALIGN = 16;

stackSave = stackRestore = stackAlloc = function() {
 abort("cannot use the stack before compiled code is ready to run, and has provided stack access");
};

function dynamicAlloc(size) {
 assert(DYNAMICTOP_PTR);
 var ret = HEAP32[DYNAMICTOP_PTR >> 2];
 var end = ret + size + 15 & -16;
 if (end <= _emscripten_get_heap_size()) {
  HEAP32[DYNAMICTOP_PTR >> 2] = end;
 } else {
  return 0;
 }
 return ret;
}

function getNativeTypeSize(type) {
 switch (type) {
 case "i1":
 case "i8":
  return 1;

 case "i16":
  return 2;

 case "i32":
  return 4;

 case "i64":
  return 8;

 case "float":
  return 4;

 case "double":
  return 8;

 default:
  {
   if (type[type.length - 1] === "*") {
    return 4;
   } else if (type[0] === "i") {
    var bits = parseInt(type.substr(1));
    assert(bits % 8 === 0, "getNativeTypeSize invalid bits " + bits + ", type " + type);
    return bits / 8;
   } else {
    return 0;
   }
  }
 }
}

function warnOnce(text) {
 if (!warnOnce.shown) warnOnce.shown = {};
 if (!warnOnce.shown[text]) {
  warnOnce.shown[text] = 1;
  err(text);
 }
}

var jsCallStartIndex = 1;

var functionPointers = new Array(0);

var funcWrappers = {};

function dynCall(sig, ptr, args) {
 if (args && args.length) {
  assert(args.length == sig.length - 1);
  assert("dynCall_" + sig in Module, "bad function pointer type - no table for sig '" + sig + "'");
  return Module["dynCall_" + sig].apply(null, [ ptr ].concat(args));
 } else {
  assert(sig.length == 1);
  assert("dynCall_" + sig in Module, "bad function pointer type - no table for sig '" + sig + "'");
  return Module["dynCall_" + sig].call(null, ptr);
 }
}

var tempRet0 = 0;

var setTempRet0 = function(value) {
 tempRet0 = value;
};

var getTempRet0 = function() {
 return tempRet0;
};

var GLOBAL_BASE = 8;

var ABORT = false;

var EXITSTATUS = 0;

function assert(condition, text) {
 if (!condition) {
  abort("Assertion failed: " + text);
 }
}

function getCFunc(ident) {
 var func = Module["_" + ident];
 assert(func, "Cannot call unknown function " + ident + ", make sure it is exported");
 return func;
}

function ccall(ident, returnType, argTypes, args, opts) {
 var toC = {
  "string": function(str) {
   var ret = 0;
   if (str !== null && str !== undefined && str !== 0) {
    var len = (str.length << 2) + 1;
    ret = stackAlloc(len);
    stringToUTF8(str, ret, len);
   }
   return ret;
  },
  "array": function(arr) {
   var ret = stackAlloc(arr.length);
   writeArrayToMemory(arr, ret);
   return ret;
  }
 };
 function convertReturnValue(ret) {
  if (returnType === "string") return UTF8ToString(ret);
  if (returnType === "boolean") return Boolean(ret);
  return ret;
 }
 var func = getCFunc(ident);
 var cArgs = [];
 var stack = 0;
 assert(returnType !== "array", 'Return type should not be "array".');
 if (args) {
  for (var i = 0; i < args.length; i++) {
   var converter = toC[argTypes[i]];
   if (converter) {
    if (stack === 0) stack = stackSave();
    cArgs[i] = converter(args[i]);
   } else {
    cArgs[i] = args[i];
   }
  }
 }
 var ret = func.apply(null, cArgs);
 ret = convertReturnValue(ret);
 if (stack !== 0) stackRestore(stack);
 return ret;
}

function setValue(ptr, value, type, noSafe) {
 type = type || "i8";
 if (type.charAt(type.length - 1) === "*") type = "i32";
 switch (type) {
 case "i1":
  HEAP8[ptr >> 0] = value;
  break;

 case "i8":
  HEAP8[ptr >> 0] = value;
  break;

 case "i16":
  HEAP16[ptr >> 1] = value;
  break;

 case "i32":
  HEAP32[ptr >> 2] = value;
  break;

 case "i64":
  tempI64 = [ value >>> 0, (tempDouble = value, +Math_abs(tempDouble) >= +1 ? tempDouble > +0 ? (Math_min(+Math_floor(tempDouble / +4294967296), +4294967295) | 0) >>> 0 : ~~+Math_ceil((tempDouble - +(~~tempDouble >>> 0)) / +4294967296) >>> 0 : 0) ], 
  HEAP32[ptr >> 2] = tempI64[0], HEAP32[ptr + 4 >> 2] = tempI64[1];
  break;

 case "float":
  HEAPF32[ptr >> 2] = value;
  break;

 case "double":
  HEAPF64[ptr >> 3] = value;
  break;

 default:
  abort("invalid type for setValue: " + type);
 }
}

var ALLOC_NONE = 3;

var UTF8Decoder = typeof TextDecoder !== "undefined" ? new TextDecoder("utf8") : undefined;

function UTF8ArrayToString(u8Array, idx, maxBytesToRead) {
 var endIdx = idx + maxBytesToRead;
 var endPtr = idx;
 while (u8Array[endPtr] && !(endPtr >= endIdx)) ++endPtr;
 if (endPtr - idx > 16 && u8Array.subarray && UTF8Decoder) {
  return UTF8Decoder.decode(u8Array.subarray(idx, endPtr));
 } else {
  var str = "";
  while (idx < endPtr) {
   var u0 = u8Array[idx++];
   if (!(u0 & 128)) {
    str += String.fromCharCode(u0);
    continue;
   }
   var u1 = u8Array[idx++] & 63;
   if ((u0 & 224) == 192) {
    str += String.fromCharCode((u0 & 31) << 6 | u1);
    continue;
   }
   var u2 = u8Array[idx++] & 63;
   if ((u0 & 240) == 224) {
    u0 = (u0 & 15) << 12 | u1 << 6 | u2;
   } else {
    if ((u0 & 248) != 240) warnOnce("Invalid UTF-8 leading byte 0x" + u0.toString(16) + " encountered when deserializing a UTF-8 string on the asm.js/wasm heap to a JS string!");
    u0 = (u0 & 7) << 18 | u1 << 12 | u2 << 6 | u8Array[idx++] & 63;
   }
   if (u0 < 65536) {
    str += String.fromCharCode(u0);
   } else {
    var ch = u0 - 65536;
    str += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023);
   }
  }
 }
 return str;
}

function UTF8ToString(ptr, maxBytesToRead) {
 return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : "";
}

function stringToUTF8Array(str, outU8Array, outIdx, maxBytesToWrite) {
 if (!(maxBytesToWrite > 0)) return 0;
 var startIdx = outIdx;
 var endIdx = outIdx + maxBytesToWrite - 1;
 for (var i = 0; i < str.length; ++i) {
  var u = str.charCodeAt(i);
  if (u >= 55296 && u <= 57343) {
   var u1 = str.charCodeAt(++i);
   u = 65536 + ((u & 1023) << 10) | u1 & 1023;
  }
  if (u <= 127) {
   if (outIdx >= endIdx) break;
   outU8Array[outIdx++] = u;
  } else if (u <= 2047) {
   if (outIdx + 1 >= endIdx) break;
   outU8Array[outIdx++] = 192 | u >> 6;
   outU8Array[outIdx++] = 128 | u & 63;
  } else if (u <= 65535) {
   if (outIdx + 2 >= endIdx) break;
   outU8Array[outIdx++] = 224 | u >> 12;
   outU8Array[outIdx++] = 128 | u >> 6 & 63;
   outU8Array[outIdx++] = 128 | u & 63;
  } else {
   if (outIdx + 3 >= endIdx) break;
   if (u >= 2097152) warnOnce("Invalid Unicode code point 0x" + u.toString(16) + " encountered when serializing a JS string to an UTF-8 string on the asm.js/wasm heap! (Valid unicode code points should be in range 0-0x1FFFFF).");
   outU8Array[outIdx++] = 240 | u >> 18;
   outU8Array[outIdx++] = 128 | u >> 12 & 63;
   outU8Array[outIdx++] = 128 | u >> 6 & 63;
   outU8Array[outIdx++] = 128 | u & 63;
  }
 }
 outU8Array[outIdx] = 0;
 return outIdx - startIdx;
}

function stringToUTF8(str, outPtr, maxBytesToWrite) {
 assert(typeof maxBytesToWrite == "number", "stringToUTF8(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!");
 return stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite);
}

function lengthBytesUTF8(str) {
 var len = 0;
 for (var i = 0; i < str.length; ++i) {
  var u = str.charCodeAt(i);
  if (u >= 55296 && u <= 57343) u = 65536 + ((u & 1023) << 10) | str.charCodeAt(++i) & 1023;
  if (u <= 127) ++len; else if (u <= 2047) len += 2; else if (u <= 65535) len += 3; else len += 4;
 }
 return len;
}

var UTF16Decoder = typeof TextDecoder !== "undefined" ? new TextDecoder("utf-16le") : undefined;

function allocateUTF8OnStack(str) {
 var size = lengthBytesUTF8(str) + 1;
 var ret = stackAlloc(size);
 stringToUTF8Array(str, HEAP8, ret, size);
 return ret;
}

function writeArrayToMemory(array, buffer) {
 assert(array.length >= 0, "writeArrayToMemory array must have a length (should be an array or typed array)");
 HEAP8.set(array, buffer);
}

function writeAsciiToMemory(str, buffer, dontAddNull) {
 for (var i = 0; i < str.length; ++i) {
  assert(str.charCodeAt(i) === str.charCodeAt(i) & 255);
  HEAP8[buffer++ >> 0] = str.charCodeAt(i);
 }
 if (!dontAddNull) HEAP8[buffer >> 0] = 0;
}

function demangle(func) {
 warnOnce("warning: build with  -s DEMANGLE_SUPPORT=1  to link in libcxxabi demangling");
 return func;
}

function demangleAll(text) {
 var regex = /__Z[\w\d_]+/g;
 return text.replace(regex, function(x) {
  var y = demangle(x);
  return x === y ? x : y + " [" + x + "]";
 });
}

function jsStackTrace() {
 var err = new Error();
 if (!err.stack) {
  try {
   throw new Error(0);
  } catch (e) {
   err = e;
  }
  if (!err.stack) {
   return "(no stack trace available)";
  }
 }
 return err.stack.toString();
}

function stackTrace() {
 var js = jsStackTrace();
 if (Module["extraStackTrace"]) js += "\n" + Module["extraStackTrace"]();
 return demangleAll(js);
}

var buffer, HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;

function updateGlobalBufferViews() {
 Module["HEAP8"] = HEAP8 = new Int8Array(buffer);
 Module["HEAP16"] = HEAP16 = new Int16Array(buffer);
 Module["HEAP32"] = HEAP32 = new Int32Array(buffer);
 Module["HEAPU8"] = HEAPU8 = new Uint8Array(buffer);
 Module["HEAPU16"] = HEAPU16 = new Uint16Array(buffer);
 Module["HEAPU32"] = HEAPU32 = new Uint32Array(buffer);
 Module["HEAPF32"] = HEAPF32 = new Float32Array(buffer);
 Module["HEAPF64"] = HEAPF64 = new Float64Array(buffer);
}

var STACK_BASE = 14384, STACK_MAX = 5257264, DYNAMIC_BASE = 5257264, DYNAMICTOP_PTR = 14128;

assert(STACK_BASE % 16 === 0, "stack must start aligned");

assert(DYNAMIC_BASE % 16 === 0, "heap must start aligned");

var TOTAL_STACK = 5242880;

if (Module["TOTAL_STACK"]) assert(TOTAL_STACK === Module["TOTAL_STACK"], "the stack size can no longer be determined at runtime");

var TOTAL_MEMORY = Module["TOTAL_MEMORY"] || 16777216;

if (TOTAL_MEMORY < TOTAL_STACK) err("TOTAL_MEMORY should be larger than TOTAL_STACK, was " + TOTAL_MEMORY + "! (TOTAL_STACK=" + TOTAL_STACK + ")");

assert(typeof Int32Array !== "undefined" && typeof Float64Array !== "undefined" && Int32Array.prototype.subarray !== undefined && Int32Array.prototype.set !== undefined, "JS engine does not provide full typed array support");

if (Module["buffer"]) {
 buffer = Module["buffer"];
 assert(buffer.byteLength === TOTAL_MEMORY, "provided buffer should be " + TOTAL_MEMORY + " bytes, but it is " + buffer.byteLength);
} else {
 {
  buffer = new ArrayBuffer(TOTAL_MEMORY);
 }
 assert(buffer.byteLength === TOTAL_MEMORY);
 Module["buffer"] = buffer;
}

updateGlobalBufferViews();

HEAP32[DYNAMICTOP_PTR >> 2] = DYNAMIC_BASE;

function writeStackCookie() {
 assert((STACK_MAX & 3) == 0);
 HEAPU32[(STACK_MAX >> 2) - 1] = 34821223;
 HEAPU32[(STACK_MAX >> 2) - 2] = 2310721022;
}

function checkStackCookie() {
 if (HEAPU32[(STACK_MAX >> 2) - 1] != 34821223 || HEAPU32[(STACK_MAX >> 2) - 2] != 2310721022) {
  abort("Stack overflow! Stack cookie has been overwritten, expected hex dwords 0x89BACDFE and 0x02135467, but received 0x" + HEAPU32[(STACK_MAX >> 2) - 2].toString(16) + " " + HEAPU32[(STACK_MAX >> 2) - 1].toString(16));
 }
 if (HEAP32[0] !== 1668509029) throw "Runtime error: The application has corrupted its heap memory area (address zero)!";
}

function abortStackOverflow(allocSize) {
 abort("Stack overflow! Attempted to allocate " + allocSize + " bytes on the stack, but stack has only " + (STACK_MAX - stackSave() + allocSize) + " bytes available!");
}

HEAP32[0] = 1668509029;

HEAP16[1] = 25459;

if (HEAPU8[2] !== 115 || HEAPU8[3] !== 99) throw "Runtime error: expected the system to be little-endian!";

function callRuntimeCallbacks(callbacks) {
 while (callbacks.length > 0) {
  var callback = callbacks.shift();
  if (typeof callback == "function") {
   callback();
   continue;
  }
  var func = callback.func;
  if (typeof func === "number") {
   if (callback.arg === undefined) {
    Module["dynCall_v"](func);
   } else {
    Module["dynCall_vi"](func, callback.arg);
   }
  } else {
   func(callback.arg === undefined ? null : callback.arg);
  }
 }
}

var __ATPRERUN__ = [];

var __ATINIT__ = [];

var __ATMAIN__ = [];

var __ATEXIT__ = [];

var __ATPOSTRUN__ = [];

var runtimeInitialized = false;

var runtimeExited = false;

function preRun() {
 if (Module["preRun"]) {
  if (typeof Module["preRun"] == "function") Module["preRun"] = [ Module["preRun"] ];
  while (Module["preRun"].length) {
   addOnPreRun(Module["preRun"].shift());
  }
 }
 callRuntimeCallbacks(__ATPRERUN__);
}

function ensureInitRuntime() {
 checkStackCookie();
 if (runtimeInitialized) return;
 runtimeInitialized = true;
 callRuntimeCallbacks(__ATINIT__);
}

function preMain() {
 checkStackCookie();
 callRuntimeCallbacks(__ATMAIN__);
}

function exitRuntime() {
 checkStackCookie();
 callRuntimeCallbacks(__ATEXIT__);
 runtimeExited = true;
}

function postRun() {
 checkStackCookie();
 if (Module["postRun"]) {
  if (typeof Module["postRun"] == "function") Module["postRun"] = [ Module["postRun"] ];
  while (Module["postRun"].length) {
   addOnPostRun(Module["postRun"].shift());
  }
 }
 callRuntimeCallbacks(__ATPOSTRUN__);
}

function addOnPreRun(cb) {
 __ATPRERUN__.unshift(cb);
}

function addOnPostRun(cb) {
 __ATPOSTRUN__.unshift(cb);
}

assert(Math.imul, "This browser does not support Math.imul(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill");

assert(Math.fround, "This browser does not support Math.fround(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill");

assert(Math.clz32, "This browser does not support Math.clz32(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill");

assert(Math.trunc, "This browser does not support Math.trunc(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill");

var Math_abs = Math.abs;

var Math_ceil = Math.ceil;

var Math_floor = Math.floor;

var Math_min = Math.min;

var runDependencies = 0;

var runDependencyWatcher = null;

var dependenciesFulfilled = null;

var runDependencyTracking = {};

function getUniqueRunDependency(id) {
 var orig = id;
 while (1) {
  if (!runDependencyTracking[id]) return id;
  id = orig + Math.random();
 }
 return id;
}

function addRunDependency(id) {
 runDependencies++;
 if (Module["monitorRunDependencies"]) {
  Module["monitorRunDependencies"](runDependencies);
 }
 if (id) {
  assert(!runDependencyTracking[id]);
  runDependencyTracking[id] = 1;
  if (runDependencyWatcher === null && typeof setInterval !== "undefined") {
   runDependencyWatcher = setInterval(function() {
    if (ABORT) {
     clearInterval(runDependencyWatcher);
     runDependencyWatcher = null;
     return;
    }
    var shown = false;
    for (var dep in runDependencyTracking) {
     if (!shown) {
      shown = true;
      err("still waiting on run dependencies:");
     }
     err("dependency: " + dep);
    }
    if (shown) {
     err("(end of list)");
    }
   }, 1e4);
  }
 } else {
  err("warning: run dependency added without ID");
 }
}

function removeRunDependency(id) {
 runDependencies--;
 if (Module["monitorRunDependencies"]) {
  Module["monitorRunDependencies"](runDependencies);
 }
 if (id) {
  assert(runDependencyTracking[id]);
  delete runDependencyTracking[id];
 } else {
  err("warning: run dependency removed without ID");
 }
 if (runDependencies == 0) {
  if (runDependencyWatcher !== null) {
   clearInterval(runDependencyWatcher);
   runDependencyWatcher = null;
  }
  if (dependenciesFulfilled) {
   var callback = dependenciesFulfilled;
   dependenciesFulfilled = null;
   callback();
  }
 }
}

Module["preloadedImages"] = {};

Module["preloadedAudios"] = {};

var memoryInitializer = null;

var FS = {
 error: function() {
  abort("Filesystem support (FS) was not included. The problem is that you are using files from JS, but files were not used from C/C++, so filesystem support was not auto-included. You can force-include filesystem support with  -s FORCE_FILESYSTEM=1");
 },
 init: function() {
  FS.error();
 },
 createDataFile: function() {
  FS.error();
 },
 createPreloadedFile: function() {
  FS.error();
 },
 createLazyFile: function() {
  FS.error();
 },
 open: function() {
  FS.error();
 },
 mkdev: function() {
  FS.error();
 },
 registerDevice: function() {
  FS.error();
 },
 analyzePath: function() {
  FS.error();
 },
 loadFilesFromDB: function() {
  FS.error();
 },
 ErrnoError: function ErrnoError() {
  FS.error();
 }
};

Module["FS_createDataFile"] = FS.createDataFile;

Module["FS_createPreloadedFile"] = FS.createPreloadedFile;

var dataURIPrefix = "data:application/octet-stream;base64,";

function isDataURI(filename) {
 return String.prototype.startsWith ? filename.startsWith(dataURIPrefix) : filename.indexOf(dataURIPrefix) === 0;
}

function _getCanvasHeight() {
 var d = document, g = d.getElementsByTagName("canvas")[0], y = g.clientHeight;
 return y;
}

function _getCanvasWidth() {
 var d = document, g = d.getElementsByTagName("canvas")[0], x = g.clientWidth;
 return x;
}

__ATINIT__.push({
 func: function() {
  __GLOBAL__sub_I_main_cpp();
 }
});

memoryInitializer = "main.js.mem";

var tempDoublePtr = 14368;

assert(tempDoublePtr % 8 == 0);

var Engine = {
 ctx: null,
 IMAGE_FOLDER: "../../images/",
 images: {},
 mode: 0,
 init: function() {
  console.log("$Engine.init");
  var canvas = Module["canvas"];
  Engine.ctx = canvas.getContext("2d");
 },
 setMode: function(mode) {
  Engine.mode = mode;
 },
 fillPage: function() {
  var canvas = Module["canvas"];
  var bodyRect = document.body.getBoundingClientRect();
  var elemRect = canvas.getBoundingClientRect();
  var yOffset = elemRect.top - bodyRect.top;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight - yOffset;
 },
 translateColorToCSSRGB: function(rgba) {
  var ret = "rgb(" + (rgba >>> 24) + "," + (rgba >> 16 & 255) + "," + (rgba >> 8 & 255) + ")";
  return ret;
 },
 drawImage: function(name, x, y, width, height, rgba) {
  name = UTF8ToString(name);
  var image = Engine.images[name];
  if (image === undefined) {
   image = new Image();
   image.src = Engine.IMAGE_FOLDER + name;
   Engine.images[name] = image;
   return;
  }
  if (!image.complete) {
   return;
  }
  var alphaInt = rgba & 255;
  if (alphaInt == 0) {
   return;
  }
  Engine.ctx.globalAlpha = alphaInt / 255;
  Engine.ctx.drawImage(image, x, y, width, height);
 },
 filledEllipse: function(x, y, width, height, rgba) {
  Engine.ctx.globalAlpha = (rgba & 255) / 255;
  Engine.ctx.fillStyle = Engine.translateColorToCSSRGB(rgba);
  Engine.ctx.beginPath();
  Engine.ctx.ellipse(x, y, width, height, 0, 0, 2 * Math.PI);
  Engine.ctx.fill();
 },
 strokeEllipse: function(x, y, width, height, thickness, rgba) {
  Engine.ctx.globalAlpha = (rgba & 255) / 255;
  Engine.ctx.strokeStyle = Engine.translateColorToCSSRGB(rgba);
  Engine.ctx.lineWidth = thickness;
  Engine.ctx.beginPath();
  Engine.ctx.ellipse(x, y, width, height, 0, 0, 2 * Math.PI);
  Engine.ctx.stroke();
 },
 filledRectangle: function(x, y, width, height, rgba) {
  Engine.ctx.globalAlpha = (rgba & 255) / 255;
  Engine.ctx.fillStyle = Engine.translateColorToCSSRGB(rgba);
  Engine.ctx.beginPath();
  Engine.ctx.fillRect(x, y, width, height);
  Engine.ctx.fill();
 },
 roundedRectangle: function(x, y, width, height, radius, thickness, strokeRgba, fillRgba) {
  Engine.ctx.beginPath();
  Engine.ctx.lineWidth = thickness;
  Engine.ctx.moveTo(x + radius, y);
  Engine.ctx.lineTo(x + width - radius, y);
  Engine.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  Engine.ctx.lineTo(x + width, y + height - radius);
  Engine.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  Engine.ctx.lineTo(x + radius, y + height);
  Engine.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  Engine.ctx.lineTo(x, y + radius);
  Engine.ctx.quadraticCurveTo(x, y, x + radius, y);
  Engine.ctx.closePath();
  var fillAlpha = (fillRgba & 255) / 255;
  var strokeAlpha = (strokeRgba & 255) / 255;
  if (fillAlpha > 0) {
   Engine.ctx.globalAlpha = fillAlpha;
   Engine.ctx.fillStyle = Engine.translateColorToCSSRGB(fillRgba);
   Engine.ctx.fill();
  }
  if (strokeAlpha > 0) {
   Engine.ctx.globalAlpha = strokeAlpha;
   Engine.ctx.strokeStyle = Engine.translateColorToCSSRGB(strokeRgba);
   Engine.ctx.stroke();
  }
 },
 filledText: function(text, x, y, fontSize, rgba) {
  text = UTF8ToString(text);
  Engine.ctx.globalAlpha = (rgba & 255) / 255;
  Engine.ctx.fillStyle = Engine.translateColorToCSSRGB(rgba);
  Engine.ctx.font = "" + fontSize + "px Monospace";
  Engine.ctx.beginPath();
  Engine.ctx.fillText(text, x, y);
  Engine.ctx.fill();
 },
 measureTextWidth: function(text, fontSize) {
  text = UTF8ToString(text);
  Engine.ctx.font = "" + fontSize + "px Monospace";
  return Engine.ctx.measureText(text).width;
 }
};

function _Engine_FillPage() {
 Engine.fillPage();
}

function _Engine_FilledEllipse(x, y, width, height, rgba) {
 Engine.filledEllipse(x, y, width, height, rgba);
}

function _Engine_FilledRectangle(x, y, width, height, rgba) {
 Engine.filledRectangle(x, y, width, height, rgba);
}

function _Engine_FilledText(text, x, y, fontSize, rgba) {
 Engine.filledText(text, x, y, fontSize, rgba);
}

function _Engine_GetMode() {
 return Engine.mode;
}

function _Engine_Init() {
 console.log("Engine_Init");
 Engine.init();
 return;
}

function _Engine_MeasureTextWidth(text, fontSize) {
 return Engine.measureTextWidth(text, fontSize);
}

function _Engine_RoundedRectangle(x, y, width, height, radius, thickness, strokeRgba, fillRgba) {
 Engine.roundedRectangle(x, y, width, height, radius, thickness, strokeRgba, fillRgba);
}

function _Engine_StrokeEllipse(x, y, width, height, thickness, rgba) {
 Engine.strokeEllipse(x, y, width, height, thickness, rgba);
}

var PATH = {
 splitPath: function(filename) {
  var splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
  return splitPathRe.exec(filename).slice(1);
 },
 normalizeArray: function(parts, allowAboveRoot) {
  var up = 0;
  for (var i = parts.length - 1; i >= 0; i--) {
   var last = parts[i];
   if (last === ".") {
    parts.splice(i, 1);
   } else if (last === "..") {
    parts.splice(i, 1);
    up++;
   } else if (up) {
    parts.splice(i, 1);
    up--;
   }
  }
  if (allowAboveRoot) {
   for (;up; up--) {
    parts.unshift("..");
   }
  }
  return parts;
 },
 normalize: function(path) {
  var isAbsolute = path.charAt(0) === "/", trailingSlash = path.substr(-1) === "/";
  path = PATH.normalizeArray(path.split("/").filter(function(p) {
   return !!p;
  }), !isAbsolute).join("/");
  if (!path && !isAbsolute) {
   path = ".";
  }
  if (path && trailingSlash) {
   path += "/";
  }
  return (isAbsolute ? "/" : "") + path;
 },
 dirname: function(path) {
  var result = PATH.splitPath(path), root = result[0], dir = result[1];
  if (!root && !dir) {
   return ".";
  }
  if (dir) {
   dir = dir.substr(0, dir.length - 1);
  }
  return root + dir;
 },
 basename: function(path) {
  if (path === "/") return "/";
  var lastSlash = path.lastIndexOf("/");
  if (lastSlash === -1) return path;
  return path.substr(lastSlash + 1);
 },
 extname: function(path) {
  return PATH.splitPath(path)[3];
 },
 join: function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return PATH.normalize(paths.join("/"));
 },
 join2: function(l, r) {
  return PATH.normalize(l + "/" + r);
 },
 resolve: function() {
  var resolvedPath = "", resolvedAbsolute = false;
  for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
   var path = i >= 0 ? arguments[i] : FS.cwd();
   if (typeof path !== "string") {
    throw new TypeError("Arguments to path.resolve must be strings");
   } else if (!path) {
    return "";
   }
   resolvedPath = path + "/" + resolvedPath;
   resolvedAbsolute = path.charAt(0) === "/";
  }
  resolvedPath = PATH.normalizeArray(resolvedPath.split("/").filter(function(p) {
   return !!p;
  }), !resolvedAbsolute).join("/");
  return (resolvedAbsolute ? "/" : "") + resolvedPath || ".";
 },
 relative: function(from, to) {
  from = PATH.resolve(from).substr(1);
  to = PATH.resolve(to).substr(1);
  function trim(arr) {
   var start = 0;
   for (;start < arr.length; start++) {
    if (arr[start] !== "") break;
   }
   var end = arr.length - 1;
   for (;end >= 0; end--) {
    if (arr[end] !== "") break;
   }
   if (start > end) return [];
   return arr.slice(start, end - start + 1);
  }
  var fromParts = trim(from.split("/"));
  var toParts = trim(to.split("/"));
  var length = Math.min(fromParts.length, toParts.length);
  var samePartsLength = length;
  for (var i = 0; i < length; i++) {
   if (fromParts[i] !== toParts[i]) {
    samePartsLength = i;
    break;
   }
  }
  var outputParts = [];
  for (var i = samePartsLength; i < fromParts.length; i++) {
   outputParts.push("..");
  }
  outputParts = outputParts.concat(toParts.slice(samePartsLength));
  return outputParts.join("/");
 }
};

function _emscripten_set_main_loop_timing(mode, value) {
 Browser.mainLoop.timingMode = mode;
 Browser.mainLoop.timingValue = value;
 if (!Browser.mainLoop.func) {
  console.error("emscripten_set_main_loop_timing: Cannot set timing mode for main loop since a main loop does not exist! Call emscripten_set_main_loop first to set one up.");
  return 1;
 }
 if (mode == 0) {
  Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler_setTimeout() {
   var timeUntilNextTick = Math.max(0, Browser.mainLoop.tickStartTime + value - _emscripten_get_now()) | 0;
   setTimeout(Browser.mainLoop.runner, timeUntilNextTick);
  };
  Browser.mainLoop.method = "timeout";
 } else if (mode == 1) {
  Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler_rAF() {
   Browser.requestAnimationFrame(Browser.mainLoop.runner);
  };
  Browser.mainLoop.method = "rAF";
 } else if (mode == 2) {
  if (typeof setImmediate === "undefined") {
   var setImmediates = [];
   var emscriptenMainLoopMessageId = "setimmediate";
   var Browser_setImmediate_messageHandler = function(event) {
    if (event.data === emscriptenMainLoopMessageId || event.data.target === emscriptenMainLoopMessageId) {
     event.stopPropagation();
     setImmediates.shift()();
    }
   };
   addEventListener("message", Browser_setImmediate_messageHandler, true);
   setImmediate = function Browser_emulated_setImmediate(func) {
    setImmediates.push(func);
    if (ENVIRONMENT_IS_WORKER) {
     if (Module["setImmediates"] === undefined) Module["setImmediates"] = [];
     Module["setImmediates"].push(func);
     postMessage({
      target: emscriptenMainLoopMessageId
     });
    } else postMessage(emscriptenMainLoopMessageId, "*");
   };
  }
  Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler_setImmediate() {
   setImmediate(Browser.mainLoop.runner);
  };
  Browser.mainLoop.method = "immediate";
 }
 return 0;
}

function _emscripten_get_now() {
 abort();
}

function _emscripten_set_main_loop(func, fps, simulateInfiniteLoop, arg, noSetTiming) {
 Module["noExitRuntime"] = true;
 assert(!Browser.mainLoop.func, "emscripten_set_main_loop: there can only be one main loop function at once: call emscripten_cancel_main_loop to cancel the previous one before setting a new one with different parameters.");
 Browser.mainLoop.func = func;
 Browser.mainLoop.arg = arg;
 var browserIterationFunc;
 if (typeof arg !== "undefined") {
  browserIterationFunc = function() {
   Module["dynCall_vi"](func, arg);
  };
 } else {
  browserIterationFunc = function() {
   Module["dynCall_v"](func);
  };
 }
 var thisMainLoopId = Browser.mainLoop.currentlyRunningMainloop;
 Browser.mainLoop.runner = function Browser_mainLoop_runner() {
  if (ABORT) return;
  if (Browser.mainLoop.queue.length > 0) {
   var start = Date.now();
   var blocker = Browser.mainLoop.queue.shift();
   blocker.func(blocker.arg);
   if (Browser.mainLoop.remainingBlockers) {
    var remaining = Browser.mainLoop.remainingBlockers;
    var next = remaining % 1 == 0 ? remaining - 1 : Math.floor(remaining);
    if (blocker.counted) {
     Browser.mainLoop.remainingBlockers = next;
    } else {
     next = next + .5;
     Browser.mainLoop.remainingBlockers = (8 * remaining + next) / 9;
    }
   }
   console.log('main loop blocker "' + blocker.name + '" took ' + (Date.now() - start) + " ms");
   Browser.mainLoop.updateStatus();
   if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop) return;
   setTimeout(Browser.mainLoop.runner, 0);
   return;
  }
  if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop) return;
  Browser.mainLoop.currentFrameNumber = Browser.mainLoop.currentFrameNumber + 1 | 0;
  if (Browser.mainLoop.timingMode == 1 && Browser.mainLoop.timingValue > 1 && Browser.mainLoop.currentFrameNumber % Browser.mainLoop.timingValue != 0) {
   Browser.mainLoop.scheduler();
   return;
  } else if (Browser.mainLoop.timingMode == 0) {
   Browser.mainLoop.tickStartTime = _emscripten_get_now();
  }
  if (Browser.mainLoop.method === "timeout" && Module.ctx) {
   err("Looks like you are rendering without using requestAnimationFrame for the main loop. You should use 0 for the frame rate in emscripten_set_main_loop in order to use requestAnimationFrame, as that can greatly improve your frame rates!");
   Browser.mainLoop.method = "";
  }
  Browser.mainLoop.runIter(browserIterationFunc);
  checkStackCookie();
  if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop) return;
  if (typeof SDL === "object" && SDL.audio && SDL.audio.queueNewAudioData) SDL.audio.queueNewAudioData();
  Browser.mainLoop.scheduler();
 };
 if (!noSetTiming) {
  if (fps && fps > 0) _emscripten_set_main_loop_timing(0, 1e3 / fps); else _emscripten_set_main_loop_timing(1, 1);
  Browser.mainLoop.scheduler();
 }
 if (simulateInfiniteLoop) {
  throw "SimulateInfiniteLoop";
 }
}

var Browser = {
 mainLoop: {
  scheduler: null,
  method: "",
  currentlyRunningMainloop: 0,
  func: null,
  arg: 0,
  timingMode: 0,
  timingValue: 0,
  currentFrameNumber: 0,
  queue: [],
  pause: function() {
   Browser.mainLoop.scheduler = null;
   Browser.mainLoop.currentlyRunningMainloop++;
  },
  resume: function() {
   Browser.mainLoop.currentlyRunningMainloop++;
   var timingMode = Browser.mainLoop.timingMode;
   var timingValue = Browser.mainLoop.timingValue;
   var func = Browser.mainLoop.func;
   Browser.mainLoop.func = null;
   _emscripten_set_main_loop(func, 0, false, Browser.mainLoop.arg, true);
   _emscripten_set_main_loop_timing(timingMode, timingValue);
   Browser.mainLoop.scheduler();
  },
  updateStatus: function() {
   if (Module["setStatus"]) {
    var message = Module["statusMessage"] || "Please wait...";
    var remaining = Browser.mainLoop.remainingBlockers;
    var expected = Browser.mainLoop.expectedBlockers;
    if (remaining) {
     if (remaining < expected) {
      Module["setStatus"](message + " (" + (expected - remaining) + "/" + expected + ")");
     } else {
      Module["setStatus"](message);
     }
    } else {
     Module["setStatus"]("");
    }
   }
  },
  runIter: function(func) {
   if (ABORT) return;
   if (Module["preMainLoop"]) {
    var preRet = Module["preMainLoop"]();
    if (preRet === false) {
     return;
    }
   }
   try {
    func();
   } catch (e) {
    if (e instanceof ExitStatus) {
     return;
    } else {
     if (e && typeof e === "object" && e.stack) err("exception thrown: " + [ e, e.stack ]);
     throw e;
    }
   }
   if (Module["postMainLoop"]) Module["postMainLoop"]();
  }
 },
 isFullscreen: false,
 pointerLock: false,
 moduleContextCreatedCallbacks: [],
 workers: [],
 init: function() {
  if (!Module["preloadPlugins"]) Module["preloadPlugins"] = [];
  if (Browser.initted) return;
  Browser.initted = true;
  try {
   new Blob();
   Browser.hasBlobConstructor = true;
  } catch (e) {
   Browser.hasBlobConstructor = false;
   console.log("warning: no blob constructor, cannot create blobs with mimetypes");
  }
  Browser.BlobBuilder = typeof MozBlobBuilder != "undefined" ? MozBlobBuilder : typeof WebKitBlobBuilder != "undefined" ? WebKitBlobBuilder : !Browser.hasBlobConstructor ? console.log("warning: no BlobBuilder") : null;
  Browser.URLObject = typeof window != "undefined" ? window.URL ? window.URL : window.webkitURL : undefined;
  if (!Module.noImageDecoding && typeof Browser.URLObject === "undefined") {
   console.log("warning: Browser does not support creating object URLs. Built-in browser image decoding will not be available.");
   Module.noImageDecoding = true;
  }
  var imagePlugin = {};
  imagePlugin["canHandle"] = function imagePlugin_canHandle(name) {
   return !Module.noImageDecoding && /\.(jpg|jpeg|png|bmp)$/i.test(name);
  };
  imagePlugin["handle"] = function imagePlugin_handle(byteArray, name, onload, onerror) {
   var b = null;
   if (Browser.hasBlobConstructor) {
    try {
     b = new Blob([ byteArray ], {
      type: Browser.getMimetype(name)
     });
     if (b.size !== byteArray.length) {
      b = new Blob([ new Uint8Array(byteArray).buffer ], {
       type: Browser.getMimetype(name)
      });
     }
    } catch (e) {
     warnOnce("Blob constructor present but fails: " + e + "; falling back to blob builder");
    }
   }
   if (!b) {
    var bb = new Browser.BlobBuilder();
    bb.append(new Uint8Array(byteArray).buffer);
    b = bb.getBlob();
   }
   var url = Browser.URLObject.createObjectURL(b);
   assert(typeof url == "string", "createObjectURL must return a url as a string");
   var img = new Image();
   img.onload = function img_onload() {
    assert(img.complete, "Image " + name + " could not be decoded");
    var canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    var ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    Module["preloadedImages"][name] = canvas;
    Browser.URLObject.revokeObjectURL(url);
    if (onload) onload(byteArray);
   };
   img.onerror = function img_onerror(event) {
    console.log("Image " + url + " could not be decoded");
    if (onerror) onerror();
   };
   img.src = url;
  };
  Module["preloadPlugins"].push(imagePlugin);
  var audioPlugin = {};
  audioPlugin["canHandle"] = function audioPlugin_canHandle(name) {
   return !Module.noAudioDecoding && name.substr(-4) in {
    ".ogg": 1,
    ".wav": 1,
    ".mp3": 1
   };
  };
  audioPlugin["handle"] = function audioPlugin_handle(byteArray, name, onload, onerror) {
   var done = false;
   function finish(audio) {
    if (done) return;
    done = true;
    Module["preloadedAudios"][name] = audio;
    if (onload) onload(byteArray);
   }
   function fail() {
    if (done) return;
    done = true;
    Module["preloadedAudios"][name] = new Audio();
    if (onerror) onerror();
   }
   if (Browser.hasBlobConstructor) {
    try {
     var b = new Blob([ byteArray ], {
      type: Browser.getMimetype(name)
     });
    } catch (e) {
     return fail();
    }
    var url = Browser.URLObject.createObjectURL(b);
    assert(typeof url == "string", "createObjectURL must return a url as a string");
    var audio = new Audio();
    audio.addEventListener("canplaythrough", function() {
     finish(audio);
    }, false);
    audio.onerror = function audio_onerror(event) {
     if (done) return;
     console.log("warning: browser could not fully decode audio " + name + ", trying slower base64 approach");
     function encode64(data) {
      var BASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
      var PAD = "=";
      var ret = "";
      var leftchar = 0;
      var leftbits = 0;
      for (var i = 0; i < data.length; i++) {
       leftchar = leftchar << 8 | data[i];
       leftbits += 8;
       while (leftbits >= 6) {
        var curr = leftchar >> leftbits - 6 & 63;
        leftbits -= 6;
        ret += BASE[curr];
       }
      }
      if (leftbits == 2) {
       ret += BASE[(leftchar & 3) << 4];
       ret += PAD + PAD;
      } else if (leftbits == 4) {
       ret += BASE[(leftchar & 15) << 2];
       ret += PAD;
      }
      return ret;
     }
     audio.src = "data:audio/x-" + name.substr(-3) + ";base64," + encode64(byteArray);
     finish(audio);
    };
    audio.src = url;
    Browser.safeSetTimeout(function() {
     finish(audio);
    }, 1e4);
   } else {
    return fail();
   }
  };
  Module["preloadPlugins"].push(audioPlugin);
  function pointerLockChange() {
   Browser.pointerLock = document["pointerLockElement"] === Module["canvas"] || document["mozPointerLockElement"] === Module["canvas"] || document["webkitPointerLockElement"] === Module["canvas"] || document["msPointerLockElement"] === Module["canvas"];
  }
  var canvas = Module["canvas"];
  if (canvas) {
   canvas.requestPointerLock = canvas["requestPointerLock"] || canvas["mozRequestPointerLock"] || canvas["webkitRequestPointerLock"] || canvas["msRequestPointerLock"] || function() {};
   canvas.exitPointerLock = document["exitPointerLock"] || document["mozExitPointerLock"] || document["webkitExitPointerLock"] || document["msExitPointerLock"] || function() {};
   canvas.exitPointerLock = canvas.exitPointerLock.bind(document);
   document.addEventListener("pointerlockchange", pointerLockChange, false);
   document.addEventListener("mozpointerlockchange", pointerLockChange, false);
   document.addEventListener("webkitpointerlockchange", pointerLockChange, false);
   document.addEventListener("mspointerlockchange", pointerLockChange, false);
   if (Module["elementPointerLock"]) {
    canvas.addEventListener("click", function(ev) {
     if (!Browser.pointerLock && Module["canvas"].requestPointerLock) {
      Module["canvas"].requestPointerLock();
      ev.preventDefault();
     }
    }, false);
   }
  }
 },
 createContext: function(canvas, useWebGL, setInModule, webGLContextAttributes) {
  if (useWebGL && Module.ctx && canvas == Module.canvas) return Module.ctx;
  var ctx;
  var contextHandle;
  if (useWebGL) {
   var contextAttributes = {
    antialias: false,
    alpha: false,
    majorVersion: 1
   };
   if (webGLContextAttributes) {
    for (var attribute in webGLContextAttributes) {
     contextAttributes[attribute] = webGLContextAttributes[attribute];
    }
   }
   if (typeof GL !== "undefined") {
    contextHandle = GL.createContext(canvas, contextAttributes);
    if (contextHandle) {
     ctx = GL.getContext(contextHandle).GLctx;
    }
   }
  } else {
   ctx = canvas.getContext("2d");
  }
  if (!ctx) return null;
  if (setInModule) {
   if (!useWebGL) assert(typeof GLctx === "undefined", "cannot set in module if GLctx is used, but we are a non-GL context that would replace it");
   Module.ctx = ctx;
   if (useWebGL) GL.makeContextCurrent(contextHandle);
   Module.useWebGL = useWebGL;
   Browser.moduleContextCreatedCallbacks.forEach(function(callback) {
    callback();
   });
   Browser.init();
  }
  return ctx;
 },
 destroyContext: function(canvas, useWebGL, setInModule) {},
 fullscreenHandlersInstalled: false,
 lockPointer: undefined,
 resizeCanvas: undefined,
 requestFullscreen: function(lockPointer, resizeCanvas, vrDevice) {
  Browser.lockPointer = lockPointer;
  Browser.resizeCanvas = resizeCanvas;
  Browser.vrDevice = vrDevice;
  if (typeof Browser.lockPointer === "undefined") Browser.lockPointer = true;
  if (typeof Browser.resizeCanvas === "undefined") Browser.resizeCanvas = false;
  if (typeof Browser.vrDevice === "undefined") Browser.vrDevice = null;
  var canvas = Module["canvas"];
  function fullscreenChange() {
   Browser.isFullscreen = false;
   var canvasContainer = canvas.parentNode;
   if ((document["fullscreenElement"] || document["mozFullScreenElement"] || document["msFullscreenElement"] || document["webkitFullscreenElement"] || document["webkitCurrentFullScreenElement"]) === canvasContainer) {
    canvas.exitFullscreen = document["exitFullscreen"] || document["cancelFullScreen"] || document["mozCancelFullScreen"] || document["msExitFullscreen"] || document["webkitCancelFullScreen"] || function() {};
    canvas.exitFullscreen = canvas.exitFullscreen.bind(document);
    if (Browser.lockPointer) canvas.requestPointerLock();
    Browser.isFullscreen = true;
    if (Browser.resizeCanvas) {
     Browser.setFullscreenCanvasSize();
    } else {
     Browser.updateCanvasDimensions(canvas);
    }
   } else {
    canvasContainer.parentNode.insertBefore(canvas, canvasContainer);
    canvasContainer.parentNode.removeChild(canvasContainer);
    if (Browser.resizeCanvas) {
     Browser.setWindowedCanvasSize();
    } else {
     Browser.updateCanvasDimensions(canvas);
    }
   }
   if (Module["onFullScreen"]) Module["onFullScreen"](Browser.isFullscreen);
   if (Module["onFullscreen"]) Module["onFullscreen"](Browser.isFullscreen);
  }
  if (!Browser.fullscreenHandlersInstalled) {
   Browser.fullscreenHandlersInstalled = true;
   document.addEventListener("fullscreenchange", fullscreenChange, false);
   document.addEventListener("mozfullscreenchange", fullscreenChange, false);
   document.addEventListener("webkitfullscreenchange", fullscreenChange, false);
   document.addEventListener("MSFullscreenChange", fullscreenChange, false);
  }
  var canvasContainer = document.createElement("div");
  canvas.parentNode.insertBefore(canvasContainer, canvas);
  canvasContainer.appendChild(canvas);
  canvasContainer.requestFullscreen = canvasContainer["requestFullscreen"] || canvasContainer["mozRequestFullScreen"] || canvasContainer["msRequestFullscreen"] || (canvasContainer["webkitRequestFullscreen"] ? function() {
   canvasContainer["webkitRequestFullscreen"](Element["ALLOW_KEYBOARD_INPUT"]);
  } : null) || (canvasContainer["webkitRequestFullScreen"] ? function() {
   canvasContainer["webkitRequestFullScreen"](Element["ALLOW_KEYBOARD_INPUT"]);
  } : null);
  if (vrDevice) {
   canvasContainer.requestFullscreen({
    vrDisplay: vrDevice
   });
  } else {
   canvasContainer.requestFullscreen();
  }
 },
 requestFullScreen: function(lockPointer, resizeCanvas, vrDevice) {
  err("Browser.requestFullScreen() is deprecated. Please call Browser.requestFullscreen instead.");
  Browser.requestFullScreen = function(lockPointer, resizeCanvas, vrDevice) {
   return Browser.requestFullscreen(lockPointer, resizeCanvas, vrDevice);
  };
  return Browser.requestFullscreen(lockPointer, resizeCanvas, vrDevice);
 },
 nextRAF: 0,
 fakeRequestAnimationFrame: function(func) {
  var now = Date.now();
  if (Browser.nextRAF === 0) {
   Browser.nextRAF = now + 1e3 / 60;
  } else {
   while (now + 2 >= Browser.nextRAF) {
    Browser.nextRAF += 1e3 / 60;
   }
  }
  var delay = Math.max(Browser.nextRAF - now, 0);
  setTimeout(func, delay);
 },
 requestAnimationFrame: function requestAnimationFrame(func) {
  if (typeof window === "undefined") {
   Browser.fakeRequestAnimationFrame(func);
  } else {
   if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = window["requestAnimationFrame"] || window["mozRequestAnimationFrame"] || window["webkitRequestAnimationFrame"] || window["msRequestAnimationFrame"] || window["oRequestAnimationFrame"] || Browser.fakeRequestAnimationFrame;
   }
   window.requestAnimationFrame(func);
  }
 },
 safeCallback: function(func) {
  return function() {
   if (!ABORT) return func.apply(null, arguments);
  };
 },
 allowAsyncCallbacks: true,
 queuedAsyncCallbacks: [],
 pauseAsyncCallbacks: function() {
  Browser.allowAsyncCallbacks = false;
 },
 resumeAsyncCallbacks: function() {
  Browser.allowAsyncCallbacks = true;
  if (Browser.queuedAsyncCallbacks.length > 0) {
   var callbacks = Browser.queuedAsyncCallbacks;
   Browser.queuedAsyncCallbacks = [];
   callbacks.forEach(function(func) {
    func();
   });
  }
 },
 safeRequestAnimationFrame: function(func) {
  return Browser.requestAnimationFrame(function() {
   if (ABORT) return;
   if (Browser.allowAsyncCallbacks) {
    func();
   } else {
    Browser.queuedAsyncCallbacks.push(func);
   }
  });
 },
 safeSetTimeout: function(func, timeout) {
  Module["noExitRuntime"] = true;
  return setTimeout(function() {
   if (ABORT) return;
   if (Browser.allowAsyncCallbacks) {
    func();
   } else {
    Browser.queuedAsyncCallbacks.push(func);
   }
  }, timeout);
 },
 safeSetInterval: function(func, timeout) {
  Module["noExitRuntime"] = true;
  return setInterval(function() {
   if (ABORT) return;
   if (Browser.allowAsyncCallbacks) {
    func();
   }
  }, timeout);
 },
 getMimetype: function(name) {
  return {
   "jpg": "image/jpeg",
   "jpeg": "image/jpeg",
   "png": "image/png",
   "bmp": "image/bmp",
   "ogg": "audio/ogg",
   "wav": "audio/wav",
   "mp3": "audio/mpeg"
  }[name.substr(name.lastIndexOf(".") + 1)];
 },
 getUserMedia: function(func) {
  if (!window.getUserMedia) {
   window.getUserMedia = navigator["getUserMedia"] || navigator["mozGetUserMedia"];
  }
  window.getUserMedia(func);
 },
 getMovementX: function(event) {
  return event["movementX"] || event["mozMovementX"] || event["webkitMovementX"] || 0;
 },
 getMovementY: function(event) {
  return event["movementY"] || event["mozMovementY"] || event["webkitMovementY"] || 0;
 },
 getMouseWheelDelta: function(event) {
  var delta = 0;
  switch (event.type) {
  case "DOMMouseScroll":
   delta = event.detail;
   break;

  case "mousewheel":
   delta = event.wheelDelta;
   break;

  case "wheel":
   delta = event["deltaY"];
   break;

  default:
   throw "unrecognized mouse wheel event: " + event.type;
  }
  return delta;
 },
 mouseX: 0,
 mouseY: 0,
 mouseMovementX: 0,
 mouseMovementY: 0,
 touches: {},
 lastTouches: {},
 calculateMouseEvent: function(event) {
  if (Browser.pointerLock) {
   if (event.type != "mousemove" && "mozMovementX" in event) {
    Browser.mouseMovementX = Browser.mouseMovementY = 0;
   } else {
    Browser.mouseMovementX = Browser.getMovementX(event);
    Browser.mouseMovementY = Browser.getMovementY(event);
   }
   if (typeof SDL != "undefined") {
    Browser.mouseX = SDL.mouseX + Browser.mouseMovementX;
    Browser.mouseY = SDL.mouseY + Browser.mouseMovementY;
   } else {
    Browser.mouseX += Browser.mouseMovementX;
    Browser.mouseY += Browser.mouseMovementY;
   }
  } else {
   var rect = Module["canvas"].getBoundingClientRect();
   var cw = Module["canvas"].width;
   var ch = Module["canvas"].height;
   var scrollX = typeof window.scrollX !== "undefined" ? window.scrollX : window.pageXOffset;
   var scrollY = typeof window.scrollY !== "undefined" ? window.scrollY : window.pageYOffset;
   assert(typeof scrollX !== "undefined" && typeof scrollY !== "undefined", "Unable to retrieve scroll position, mouse positions likely broken.");
   if (event.type === "touchstart" || event.type === "touchend" || event.type === "touchmove") {
    var touch = event.touch;
    if (touch === undefined) {
     return;
    }
    var adjustedX = touch.pageX - (scrollX + rect.left);
    var adjustedY = touch.pageY - (scrollY + rect.top);
    adjustedX = adjustedX * (cw / rect.width);
    adjustedY = adjustedY * (ch / rect.height);
    var coords = {
     x: adjustedX,
     y: adjustedY
    };
    if (event.type === "touchstart") {
     Browser.lastTouches[touch.identifier] = coords;
     Browser.touches[touch.identifier] = coords;
    } else if (event.type === "touchend" || event.type === "touchmove") {
     var last = Browser.touches[touch.identifier];
     if (!last) last = coords;
     Browser.lastTouches[touch.identifier] = last;
     Browser.touches[touch.identifier] = coords;
    }
    return;
   }
   var x = event.pageX - (scrollX + rect.left);
   var y = event.pageY - (scrollY + rect.top);
   x = x * (cw / rect.width);
   y = y * (ch / rect.height);
   Browser.mouseMovementX = x - Browser.mouseX;
   Browser.mouseMovementY = y - Browser.mouseY;
   Browser.mouseX = x;
   Browser.mouseY = y;
  }
 },
 asyncLoad: function(url, onload, onerror, noRunDep) {
  var dep = !noRunDep ? getUniqueRunDependency("al " + url) : "";
  Module["readAsync"](url, function(arrayBuffer) {
   assert(arrayBuffer, 'Loading data file "' + url + '" failed (no arrayBuffer).');
   onload(new Uint8Array(arrayBuffer));
   if (dep) removeRunDependency(dep);
  }, function(event) {
   if (onerror) {
    onerror();
   } else {
    throw 'Loading data file "' + url + '" failed.';
   }
  });
  if (dep) addRunDependency(dep);
 },
 resizeListeners: [],
 updateResizeListeners: function() {
  var canvas = Module["canvas"];
  Browser.resizeListeners.forEach(function(listener) {
   listener(canvas.width, canvas.height);
  });
 },
 setCanvasSize: function(width, height, noUpdates) {
  var canvas = Module["canvas"];
  Browser.updateCanvasDimensions(canvas, width, height);
  if (!noUpdates) Browser.updateResizeListeners();
 },
 windowedWidth: 0,
 windowedHeight: 0,
 setFullscreenCanvasSize: function() {
  if (typeof SDL != "undefined") {
   var flags = HEAPU32[SDL.screen >> 2];
   flags = flags | 8388608;
   HEAP32[SDL.screen >> 2] = flags;
  }
  Browser.updateCanvasDimensions(Module["canvas"]);
  Browser.updateResizeListeners();
 },
 setWindowedCanvasSize: function() {
  if (typeof SDL != "undefined") {
   var flags = HEAPU32[SDL.screen >> 2];
   flags = flags & ~8388608;
   HEAP32[SDL.screen >> 2] = flags;
  }
  Browser.updateCanvasDimensions(Module["canvas"]);
  Browser.updateResizeListeners();
 },
 updateCanvasDimensions: function(canvas, wNative, hNative) {
  if (wNative && hNative) {
   canvas.widthNative = wNative;
   canvas.heightNative = hNative;
  } else {
   wNative = canvas.widthNative;
   hNative = canvas.heightNative;
  }
  var w = wNative;
  var h = hNative;
  if (Module["forcedAspectRatio"] && Module["forcedAspectRatio"] > 0) {
   if (w / h < Module["forcedAspectRatio"]) {
    w = Math.round(h * Module["forcedAspectRatio"]);
   } else {
    h = Math.round(w / Module["forcedAspectRatio"]);
   }
  }
  if ((document["fullscreenElement"] || document["mozFullScreenElement"] || document["msFullscreenElement"] || document["webkitFullscreenElement"] || document["webkitCurrentFullScreenElement"]) === canvas.parentNode && typeof screen != "undefined") {
   var factor = Math.min(screen.width / w, screen.height / h);
   w = Math.round(w * factor);
   h = Math.round(h * factor);
  }
  if (Browser.resizeCanvas) {
   if (canvas.width != w) canvas.width = w;
   if (canvas.height != h) canvas.height = h;
   if (typeof canvas.style != "undefined") {
    canvas.style.removeProperty("width");
    canvas.style.removeProperty("height");
   }
  } else {
   if (canvas.width != wNative) canvas.width = wNative;
   if (canvas.height != hNative) canvas.height = hNative;
   if (typeof canvas.style != "undefined") {
    if (w != wNative || h != hNative) {
     canvas.style.setProperty("width", w + "px", "important");
     canvas.style.setProperty("height", h + "px", "important");
    } else {
     canvas.style.removeProperty("width");
     canvas.style.removeProperty("height");
    }
   }
  }
 },
 wgetRequests: {},
 nextWgetRequestHandle: 0,
 getNextWgetRequestHandle: function() {
  var handle = Browser.nextWgetRequestHandle;
  Browser.nextWgetRequestHandle++;
  return handle;
 }
};

function _SDL_GetTicks() {
 return Date.now() - SDL.startTime | 0;
}

function _SDL_LockSurface(surf) {
 var surfData = SDL.surfaces[surf];
 surfData.locked++;
 if (surfData.locked > 1) return 0;
 if (!surfData.buffer) {
  surfData.buffer = _malloc(surfData.width * surfData.height * 4);
  HEAP32[surf + 20 >> 2] = surfData.buffer;
 }
 HEAP32[surf + 20 >> 2] = surfData.buffer;
 if (surf == SDL.screen && Module.screenIsReadOnly && surfData.image) return 0;
 if (SDL.defaults.discardOnLock) {
  if (!surfData.image) {
   surfData.image = surfData.ctx.createImageData(surfData.width, surfData.height);
  }
  if (!SDL.defaults.opaqueFrontBuffer) return;
 } else {
  surfData.image = surfData.ctx.getImageData(0, 0, surfData.width, surfData.height);
 }
 if (surf == SDL.screen && SDL.defaults.opaqueFrontBuffer) {
  var data = surfData.image.data;
  var num = data.length;
  for (var i = 0; i < num / 4; i++) {
   data[i * 4 + 3] = 255;
  }
 }
 if (SDL.defaults.copyOnLock && !SDL.defaults.discardOnLock) {
  if (surfData.isFlagSet(2097152)) {
   throw "CopyOnLock is not supported for SDL_LockSurface with SDL_HWPALETTE flag set" + new Error().stack;
  } else {
   HEAPU8.set(surfData.image.data, surfData.buffer);
  }
 }
 return 0;
}

var SDL = {
 defaults: {
  width: 320,
  height: 200,
  copyOnLock: true,
  discardOnLock: false,
  opaqueFrontBuffer: true
 },
 version: null,
 surfaces: {},
 canvasPool: [],
 events: [],
 fonts: [ null ],
 audios: [ null ],
 rwops: [ null ],
 music: {
  audio: null,
  volume: 1
 },
 mixerFrequency: 22050,
 mixerFormat: 32784,
 mixerNumChannels: 2,
 mixerChunkSize: 1024,
 channelMinimumNumber: 0,
 GL: false,
 glAttributes: {
  0: 3,
  1: 3,
  2: 2,
  3: 0,
  4: 0,
  5: 1,
  6: 16,
  7: 0,
  8: 0,
  9: 0,
  10: 0,
  11: 0,
  12: 0,
  13: 0,
  14: 0,
  15: 1,
  16: 0,
  17: 0,
  18: 0
 },
 keyboardState: null,
 keyboardMap: {},
 canRequestFullscreen: false,
 isRequestingFullscreen: false,
 textInput: false,
 startTime: null,
 initFlags: 0,
 buttonState: 0,
 modState: 0,
 DOMButtons: [ 0, 0, 0 ],
 DOMEventToSDLEvent: {},
 TOUCH_DEFAULT_ID: 0,
 eventHandler: null,
 eventHandlerContext: null,
 eventHandlerTemp: 0,
 keyCodes: {
  16: 1249,
  17: 1248,
  18: 1250,
  20: 1081,
  33: 1099,
  34: 1102,
  35: 1101,
  36: 1098,
  37: 1104,
  38: 1106,
  39: 1103,
  40: 1105,
  44: 316,
  45: 1097,
  46: 127,
  91: 1251,
  93: 1125,
  96: 1122,
  97: 1113,
  98: 1114,
  99: 1115,
  100: 1116,
  101: 1117,
  102: 1118,
  103: 1119,
  104: 1120,
  105: 1121,
  106: 1109,
  107: 1111,
  109: 1110,
  110: 1123,
  111: 1108,
  112: 1082,
  113: 1083,
  114: 1084,
  115: 1085,
  116: 1086,
  117: 1087,
  118: 1088,
  119: 1089,
  120: 1090,
  121: 1091,
  122: 1092,
  123: 1093,
  124: 1128,
  125: 1129,
  126: 1130,
  127: 1131,
  128: 1132,
  129: 1133,
  130: 1134,
  131: 1135,
  132: 1136,
  133: 1137,
  134: 1138,
  135: 1139,
  144: 1107,
  160: 94,
  161: 33,
  162: 34,
  163: 35,
  164: 36,
  165: 37,
  166: 38,
  167: 95,
  168: 40,
  169: 41,
  170: 42,
  171: 43,
  172: 124,
  173: 45,
  174: 123,
  175: 125,
  176: 126,
  181: 127,
  182: 129,
  183: 128,
  188: 44,
  190: 46,
  191: 47,
  192: 96,
  219: 91,
  220: 92,
  221: 93,
  222: 39,
  224: 1251
 },
 scanCodes: {
  8: 42,
  9: 43,
  13: 40,
  27: 41,
  32: 44,
  35: 204,
  39: 53,
  44: 54,
  46: 55,
  47: 56,
  48: 39,
  49: 30,
  50: 31,
  51: 32,
  52: 33,
  53: 34,
  54: 35,
  55: 36,
  56: 37,
  57: 38,
  58: 203,
  59: 51,
  61: 46,
  91: 47,
  92: 49,
  93: 48,
  96: 52,
  97: 4,
  98: 5,
  99: 6,
  100: 7,
  101: 8,
  102: 9,
  103: 10,
  104: 11,
  105: 12,
  106: 13,
  107: 14,
  108: 15,
  109: 16,
  110: 17,
  111: 18,
  112: 19,
  113: 20,
  114: 21,
  115: 22,
  116: 23,
  117: 24,
  118: 25,
  119: 26,
  120: 27,
  121: 28,
  122: 29,
  127: 76,
  305: 224,
  308: 226,
  316: 70
 },
 loadRect: function(rect) {
  return {
   x: HEAP32[rect + 0 >> 2],
   y: HEAP32[rect + 4 >> 2],
   w: HEAP32[rect + 8 >> 2],
   h: HEAP32[rect + 12 >> 2]
  };
 },
 updateRect: function(rect, r) {
  HEAP32[rect >> 2] = r.x;
  HEAP32[rect + 4 >> 2] = r.y;
  HEAP32[rect + 8 >> 2] = r.w;
  HEAP32[rect + 12 >> 2] = r.h;
 },
 intersectionOfRects: function(first, second) {
  var leftX = Math.max(first.x, second.x);
  var leftY = Math.max(first.y, second.y);
  var rightX = Math.min(first.x + first.w, second.x + second.w);
  var rightY = Math.min(first.y + first.h, second.y + second.h);
  return {
   x: leftX,
   y: leftY,
   w: Math.max(leftX, rightX) - leftX,
   h: Math.max(leftY, rightY) - leftY
  };
 },
 checkPixelFormat: function(fmt) {
  var format = HEAP32[fmt >> 2];
  if (format != -2042224636) {
   warnOnce("Unsupported pixel format!");
  }
 },
 loadColorToCSSRGB: function(color) {
  var rgba = HEAP32[color >> 2];
  return "rgb(" + (rgba & 255) + "," + (rgba >> 8 & 255) + "," + (rgba >> 16 & 255) + ")";
 },
 loadColorToCSSRGBA: function(color) {
  var rgba = HEAP32[color >> 2];
  return "rgba(" + (rgba & 255) + "," + (rgba >> 8 & 255) + "," + (rgba >> 16 & 255) + "," + (rgba >> 24 & 255) / 255 + ")";
 },
 translateColorToCSSRGBA: function(rgba) {
  return "rgba(" + (rgba & 255) + "," + (rgba >> 8 & 255) + "," + (rgba >> 16 & 255) + "," + (rgba >>> 24) / 255 + ")";
 },
 translateRGBAToCSSRGBA: function(r, g, b, a) {
  return "rgba(" + (r & 255) + "," + (g & 255) + "," + (b & 255) + "," + (a & 255) / 255 + ")";
 },
 translateRGBAToColor: function(r, g, b, a) {
  return r | g << 8 | b << 16 | a << 24;
 },
 makeSurface: function(width, height, flags, usePageCanvas, source, rmask, gmask, bmask, amask) {
  flags = flags || 0;
  var is_SDL_HWSURFACE = flags & 1;
  var is_SDL_HWPALETTE = flags & 2097152;
  var is_SDL_OPENGL = flags & 67108864;
  var surf = _malloc(60);
  var pixelFormat = _malloc(44);
  var bpp = is_SDL_HWPALETTE ? 1 : 4;
  var buffer = 0;
  if (!is_SDL_HWSURFACE && !is_SDL_OPENGL) {
   buffer = _malloc(width * height * 4);
  }
  HEAP32[surf >> 2] = flags;
  HEAP32[surf + 4 >> 2] = pixelFormat;
  HEAP32[surf + 8 >> 2] = width;
  HEAP32[surf + 12 >> 2] = height;
  HEAP32[surf + 16 >> 2] = width * bpp;
  HEAP32[surf + 20 >> 2] = buffer;
  HEAP32[surf + 36 >> 2] = 0;
  HEAP32[surf + 40 >> 2] = 0;
  HEAP32[surf + 44 >> 2] = Module["canvas"].width;
  HEAP32[surf + 48 >> 2] = Module["canvas"].height;
  HEAP32[surf + 56 >> 2] = 1;
  HEAP32[pixelFormat >> 2] = -2042224636;
  HEAP32[pixelFormat + 4 >> 2] = 0;
  HEAP8[pixelFormat + 8 >> 0] = bpp * 8;
  HEAP8[pixelFormat + 9 >> 0] = bpp;
  HEAP32[pixelFormat + 12 >> 2] = rmask || 255;
  HEAP32[pixelFormat + 16 >> 2] = gmask || 65280;
  HEAP32[pixelFormat + 20 >> 2] = bmask || 16711680;
  HEAP32[pixelFormat + 24 >> 2] = amask || 4278190080;
  SDL.GL = SDL.GL || is_SDL_OPENGL;
  var canvas;
  if (!usePageCanvas) {
   if (SDL.canvasPool.length > 0) {
    canvas = SDL.canvasPool.pop();
   } else {
    canvas = document.createElement("canvas");
   }
   canvas.width = width;
   canvas.height = height;
  } else {
   canvas = Module["canvas"];
  }
  var webGLContextAttributes = {
   antialias: SDL.glAttributes[13] != 0 && SDL.glAttributes[14] > 1,
   depth: SDL.glAttributes[6] > 0,
   stencil: SDL.glAttributes[7] > 0,
   alpha: SDL.glAttributes[3] > 0
  };
  var ctx = Browser.createContext(canvas, is_SDL_OPENGL, usePageCanvas, webGLContextAttributes);
  SDL.surfaces[surf] = {
   width: width,
   height: height,
   canvas: canvas,
   ctx: ctx,
   surf: surf,
   buffer: buffer,
   pixelFormat: pixelFormat,
   alpha: 255,
   flags: flags,
   locked: 0,
   usePageCanvas: usePageCanvas,
   source: source,
   isFlagSet: function(flag) {
    return flags & flag;
   }
  };
  return surf;
 },
 copyIndexedColorData: function(surfData, rX, rY, rW, rH) {
  if (!surfData.colors) {
   return;
  }
  var fullWidth = Module["canvas"].width;
  var fullHeight = Module["canvas"].height;
  var startX = rX || 0;
  var startY = rY || 0;
  var endX = (rW || fullWidth - startX) + startX;
  var endY = (rH || fullHeight - startY) + startY;
  var buffer = surfData.buffer;
  if (!surfData.image.data32) {
   surfData.image.data32 = new Uint32Array(surfData.image.data.buffer);
  }
  var data32 = surfData.image.data32;
  var colors32 = surfData.colors32;
  for (var y = startY; y < endY; ++y) {
   var base = y * fullWidth;
   for (var x = startX; x < endX; ++x) {
    data32[base + x] = colors32[HEAPU8[buffer + base + x >> 0]];
   }
  }
 },
 freeSurface: function(surf) {
  var refcountPointer = surf + 56;
  var refcount = HEAP32[refcountPointer >> 2];
  if (refcount > 1) {
   HEAP32[refcountPointer >> 2] = refcount - 1;
   return;
  }
  var info = SDL.surfaces[surf];
  if (!info.usePageCanvas && info.canvas) SDL.canvasPool.push(info.canvas);
  if (info.buffer) _free(info.buffer);
  _free(info.pixelFormat);
  _free(surf);
  SDL.surfaces[surf] = null;
  if (surf === SDL.screen) {
   SDL.screen = null;
  }
 },
 blitSurface: function(src, srcrect, dst, dstrect, scale) {
  var srcData = SDL.surfaces[src];
  var dstData = SDL.surfaces[dst];
  var sr, dr;
  if (srcrect) {
   sr = SDL.loadRect(srcrect);
  } else {
   sr = {
    x: 0,
    y: 0,
    w: srcData.width,
    h: srcData.height
   };
  }
  if (dstrect) {
   dr = SDL.loadRect(dstrect);
  } else {
   dr = {
    x: 0,
    y: 0,
    w: srcData.width,
    h: srcData.height
   };
  }
  if (dstData.clipRect) {
   var widthScale = !scale || sr.w === 0 ? 1 : sr.w / dr.w;
   var heightScale = !scale || sr.h === 0 ? 1 : sr.h / dr.h;
   dr = SDL.intersectionOfRects(dstData.clipRect, dr);
   sr.w = dr.w * widthScale;
   sr.h = dr.h * heightScale;
   if (dstrect) {
    SDL.updateRect(dstrect, dr);
   }
  }
  var blitw, blith;
  if (scale) {
   blitw = dr.w;
   blith = dr.h;
  } else {
   blitw = sr.w;
   blith = sr.h;
  }
  if (sr.w === 0 || sr.h === 0 || blitw === 0 || blith === 0) {
   return 0;
  }
  var oldAlpha = dstData.ctx.globalAlpha;
  dstData.ctx.globalAlpha = srcData.alpha / 255;
  dstData.ctx.drawImage(srcData.canvas, sr.x, sr.y, sr.w, sr.h, dr.x, dr.y, blitw, blith);
  dstData.ctx.globalAlpha = oldAlpha;
  if (dst != SDL.screen) {
   warnOnce("WARNING: copying canvas data to memory for compatibility");
   _SDL_LockSurface(dst);
   dstData.locked--;
  }
  return 0;
 },
 downFingers: {},
 savedKeydown: null,
 receiveEvent: function(event) {
  function unpressAllPressedKeys() {
   for (var code in SDL.keyboardMap) {
    SDL.events.push({
     type: "keyup",
     keyCode: SDL.keyboardMap[code]
    });
   }
  }
  switch (event.type) {
  case "touchstart":
  case "touchmove":
   {
    event.preventDefault();
    var touches = [];
    if (event.type === "touchstart") {
     for (var i = 0; i < event.touches.length; i++) {
      var touch = event.touches[i];
      if (SDL.downFingers[touch.identifier] != true) {
       SDL.downFingers[touch.identifier] = true;
       touches.push(touch);
      }
     }
    } else {
     touches = event.touches;
    }
    var firstTouch = touches[0];
    if (firstTouch) {
     if (event.type == "touchstart") {
      SDL.DOMButtons[0] = 1;
     }
     var mouseEventType;
     switch (event.type) {
     case "touchstart":
      mouseEventType = "mousedown";
      break;

     case "touchmove":
      mouseEventType = "mousemove";
      break;
     }
     var mouseEvent = {
      type: mouseEventType,
      button: 0,
      pageX: firstTouch.clientX,
      pageY: firstTouch.clientY
     };
     SDL.events.push(mouseEvent);
    }
    for (var i = 0; i < touches.length; i++) {
     var touch = touches[i];
     SDL.events.push({
      type: event.type,
      touch: touch
     });
    }
    break;
   }

  case "touchend":
   {
    event.preventDefault();
    for (var i = 0; i < event.changedTouches.length; i++) {
     var touch = event.changedTouches[i];
     if (SDL.downFingers[touch.identifier] === true) {
      delete SDL.downFingers[touch.identifier];
     }
    }
    var mouseEvent = {
     type: "mouseup",
     button: 0,
     pageX: event.changedTouches[0].clientX,
     pageY: event.changedTouches[0].clientY
    };
    SDL.DOMButtons[0] = 0;
    SDL.events.push(mouseEvent);
    for (var i = 0; i < event.changedTouches.length; i++) {
     var touch = event.changedTouches[i];
     SDL.events.push({
      type: "touchend",
      touch: touch
     });
    }
    break;
   }

  case "DOMMouseScroll":
  case "mousewheel":
  case "wheel":
   var delta = -Browser.getMouseWheelDelta(event);
   delta = delta == 0 ? 0 : delta > 0 ? Math.max(delta, 1) : Math.min(delta, -1);
   var button = delta > 0 ? 3 : 4;
   SDL.events.push({
    type: "mousedown",
    button: button,
    pageX: event.pageX,
    pageY: event.pageY
   });
   SDL.events.push({
    type: "mouseup",
    button: button,
    pageX: event.pageX,
    pageY: event.pageY
   });
   SDL.events.push({
    type: "wheel",
    deltaX: 0,
    deltaY: delta
   });
   event.preventDefault();
   break;

  case "mousemove":
   if (SDL.DOMButtons[0] === 1) {
    SDL.events.push({
     type: "touchmove",
     touch: {
      identifier: 0,
      deviceID: -1,
      pageX: event.pageX,
      pageY: event.pageY
     }
    });
   }
   if (Browser.pointerLock) {
    if ("mozMovementX" in event) {
     event["movementX"] = event["mozMovementX"];
     event["movementY"] = event["mozMovementY"];
    }
    if (event["movementX"] == 0 && event["movementY"] == 0) {
     event.preventDefault();
     return;
    }
   }

  case "keydown":
  case "keyup":
  case "keypress":
  case "mousedown":
  case "mouseup":
   if (event.type !== "keydown" || !SDL.unicode && !SDL.textInput || (event.keyCode === 8 || event.keyCode === 9)) {
    event.preventDefault();
   }
   if (event.type == "mousedown") {
    SDL.DOMButtons[event.button] = 1;
    SDL.events.push({
     type: "touchstart",
     touch: {
      identifier: 0,
      deviceID: -1,
      pageX: event.pageX,
      pageY: event.pageY
     }
    });
   } else if (event.type == "mouseup") {
    if (!SDL.DOMButtons[event.button]) {
     return;
    }
    SDL.events.push({
     type: "touchend",
     touch: {
      identifier: 0,
      deviceID: -1,
      pageX: event.pageX,
      pageY: event.pageY
     }
    });
    SDL.DOMButtons[event.button] = 0;
   }
   if (event.type === "keydown" || event.type === "mousedown") {
    SDL.canRequestFullscreen = true;
   } else if (event.type === "keyup" || event.type === "mouseup") {
    if (SDL.isRequestingFullscreen) {
     Module["requestFullscreen"](true, true);
     SDL.isRequestingFullscreen = false;
    }
    SDL.canRequestFullscreen = false;
   }
   if (event.type === "keypress" && SDL.savedKeydown) {
    SDL.savedKeydown.keypressCharCode = event.charCode;
    SDL.savedKeydown = null;
   } else if (event.type === "keydown") {
    SDL.savedKeydown = event;
   }
   if (event.type !== "keypress" || SDL.textInput) {
    SDL.events.push(event);
   }
   break;

  case "mouseout":
   for (var i = 0; i < 3; i++) {
    if (SDL.DOMButtons[i]) {
     SDL.events.push({
      type: "mouseup",
      button: i,
      pageX: event.pageX,
      pageY: event.pageY
     });
     SDL.DOMButtons[i] = 0;
    }
   }
   event.preventDefault();
   break;

  case "focus":
   SDL.events.push(event);
   event.preventDefault();
   break;

  case "blur":
   SDL.events.push(event);
   unpressAllPressedKeys();
   event.preventDefault();
   break;

  case "visibilitychange":
   SDL.events.push({
    type: "visibilitychange",
    visible: !document.hidden
   });
   unpressAllPressedKeys();
   event.preventDefault();
   break;

  case "unload":
   if (Browser.mainLoop.runner) {
    SDL.events.push(event);
    Browser.mainLoop.runner();
   }
   return;

  case "resize":
   SDL.events.push(event);
   if (event.preventDefault) {
    event.preventDefault();
   }
   break;
  }
  if (SDL.events.length >= 1e4) {
   err("SDL event queue full, dropping events");
   SDL.events = SDL.events.slice(0, 1e4);
  }
  SDL.flushEventsToHandler();
  return;
 },
 lookupKeyCodeForEvent: function(event) {
  var code = event.keyCode;
  if (code >= 65 && code <= 90) {
   code += 32;
  } else {
   code = SDL.keyCodes[event.keyCode] || event.keyCode;
   if (event.location === KeyboardEvent.DOM_KEY_LOCATION_RIGHT && code >= (224 | 1 << 10) && code <= (227 | 1 << 10)) {
    code += 4;
   }
  }
  return code;
 },
 handleEvent: function(event) {
  if (event.handled) return;
  event.handled = true;
  switch (event.type) {
  case "touchstart":
  case "touchend":
  case "touchmove":
   {
    Browser.calculateMouseEvent(event);
    break;
   }

  case "keydown":
  case "keyup":
   {
    var down = event.type === "keydown";
    var code = SDL.lookupKeyCodeForEvent(event);
    HEAP8[SDL.keyboardState + code >> 0] = down;
    SDL.modState = (HEAP8[SDL.keyboardState + 1248 >> 0] ? 64 : 0) | (HEAP8[SDL.keyboardState + 1249 >> 0] ? 1 : 0) | (HEAP8[SDL.keyboardState + 1250 >> 0] ? 256 : 0) | (HEAP8[SDL.keyboardState + 1252 >> 0] ? 128 : 0) | (HEAP8[SDL.keyboardState + 1253 >> 0] ? 2 : 0) | (HEAP8[SDL.keyboardState + 1254 >> 0] ? 512 : 0);
    if (down) {
     SDL.keyboardMap[code] = event.keyCode;
    } else {
     delete SDL.keyboardMap[code];
    }
    break;
   }

  case "mousedown":
  case "mouseup":
   if (event.type == "mousedown") {
    SDL.buttonState |= 1 << event.button;
   } else if (event.type == "mouseup") {
    SDL.buttonState &= ~(1 << event.button);
   }

  case "mousemove":
   {
    Browser.calculateMouseEvent(event);
    break;
   }
  }
 },
 flushEventsToHandler: function() {
  if (!SDL.eventHandler) return;
  while (SDL.pollEvent(SDL.eventHandlerTemp)) {
   Module["dynCall_iii"](SDL.eventHandler, SDL.eventHandlerContext, SDL.eventHandlerTemp);
  }
 },
 pollEvent: function(ptr) {
  if (SDL.initFlags & 512 && SDL.joystickEventState) {
   SDL.queryJoysticks();
  }
  if (ptr) {
   while (SDL.events.length > 0) {
    if (SDL.makeCEvent(SDL.events.shift(), ptr) !== false) return 1;
   }
   return 0;
  } else {
   return SDL.events.length > 0;
  }
 },
 makeCEvent: function(event, ptr) {
  if (typeof event === "number") {
   _memcpy(ptr, event, 28);
   _free(event);
   return;
  }
  SDL.handleEvent(event);
  switch (event.type) {
  case "keydown":
  case "keyup":
   {
    var down = event.type === "keydown";
    var key = SDL.lookupKeyCodeForEvent(event);
    var scan;
    if (key >= 1024) {
     scan = key - 1024;
    } else {
     scan = SDL.scanCodes[key] || key;
    }
    HEAP32[ptr >> 2] = SDL.DOMEventToSDLEvent[event.type];
    HEAP8[ptr + 8 >> 0] = down ? 1 : 0;
    HEAP8[ptr + 9 >> 0] = 0;
    HEAP32[ptr + 12 >> 2] = scan;
    HEAP32[ptr + 16 >> 2] = key;
    HEAP16[ptr + 20 >> 1] = SDL.modState;
    HEAP32[ptr + 24 >> 2] = event.keypressCharCode || key;
    break;
   }

  case "keypress":
   {
    HEAP32[ptr >> 2] = SDL.DOMEventToSDLEvent[event.type];
    var cStr = intArrayFromString(String.fromCharCode(event.charCode));
    for (var i = 0; i < cStr.length; ++i) {
     HEAP8[ptr + (8 + i) >> 0] = cStr[i];
    }
    break;
   }

  case "mousedown":
  case "mouseup":
  case "mousemove":
   {
    if (event.type != "mousemove") {
     var down = event.type === "mousedown";
     HEAP32[ptr >> 2] = SDL.DOMEventToSDLEvent[event.type];
     HEAP32[ptr + 4 >> 2] = 0;
     HEAP32[ptr + 8 >> 2] = 0;
     HEAP32[ptr + 12 >> 2] = 0;
     HEAP8[ptr + 16 >> 0] = event.button + 1;
     HEAP8[ptr + 17 >> 0] = down ? 1 : 0;
     HEAP32[ptr + 20 >> 2] = Browser.mouseX;
     HEAP32[ptr + 24 >> 2] = Browser.mouseY;
    } else {
     HEAP32[ptr >> 2] = SDL.DOMEventToSDLEvent[event.type];
     HEAP32[ptr + 4 >> 2] = 0;
     HEAP32[ptr + 8 >> 2] = 0;
     HEAP32[ptr + 12 >> 2] = 0;
     HEAP32[ptr + 16 >> 2] = SDL.buttonState;
     HEAP32[ptr + 20 >> 2] = Browser.mouseX;
     HEAP32[ptr + 24 >> 2] = Browser.mouseY;
     HEAP32[ptr + 28 >> 2] = Browser.mouseMovementX;
     HEAP32[ptr + 32 >> 2] = Browser.mouseMovementY;
    }
    break;
   }

  case "wheel":
   {
    HEAP32[ptr >> 2] = SDL.DOMEventToSDLEvent[event.type];
    HEAP32[ptr + 16 >> 2] = event.deltaX;
    HEAP32[ptr + 20 >> 2] = event.deltaY;
    break;
   }

  case "touchstart":
  case "touchend":
  case "touchmove":
   {
    var touch = event.touch;
    if (!Browser.touches[touch.identifier]) break;
    var w = Module["canvas"].width;
    var h = Module["canvas"].height;
    var x = Browser.touches[touch.identifier].x / w;
    var y = Browser.touches[touch.identifier].y / h;
    var lx = Browser.lastTouches[touch.identifier].x / w;
    var ly = Browser.lastTouches[touch.identifier].y / h;
    var dx = x - lx;
    var dy = y - ly;
    if (touch["deviceID"] === undefined) touch.deviceID = SDL.TOUCH_DEFAULT_ID;
    if (dx === 0 && dy === 0 && event.type === "touchmove") return false;
    HEAP32[ptr >> 2] = SDL.DOMEventToSDLEvent[event.type];
    HEAP32[ptr + 4 >> 2] = _SDL_GetTicks();
    tempI64 = [ touch.deviceID >>> 0, (tempDouble = touch.deviceID, +Math_abs(tempDouble) >= +1 ? tempDouble > +0 ? (Math_min(+Math_floor(tempDouble / +4294967296), +4294967295) | 0) >>> 0 : ~~+Math_ceil((tempDouble - +(~~tempDouble >>> 0)) / +4294967296) >>> 0 : 0) ], 
    HEAP32[ptr + 8 >> 2] = tempI64[0], HEAP32[ptr + 12 >> 2] = tempI64[1];
    tempI64 = [ touch.identifier >>> 0, (tempDouble = touch.identifier, +Math_abs(tempDouble) >= +1 ? tempDouble > +0 ? (Math_min(+Math_floor(tempDouble / +4294967296), +4294967295) | 0) >>> 0 : ~~+Math_ceil((tempDouble - +(~~tempDouble >>> 0)) / +4294967296) >>> 0 : 0) ], 
    HEAP32[ptr + 16 >> 2] = tempI64[0], HEAP32[ptr + 20 >> 2] = tempI64[1];
    HEAPF32[ptr + 24 >> 2] = x;
    HEAPF32[ptr + 28 >> 2] = y;
    HEAPF32[ptr + 32 >> 2] = dx;
    HEAPF32[ptr + 36 >> 2] = dy;
    if (touch.force !== undefined) {
     HEAPF32[ptr + 40 >> 2] = touch.force;
    } else {
     HEAPF32[ptr + 40 >> 2] = event.type == "touchend" ? 0 : 1;
    }
    break;
   }

  case "unload":
   {
    HEAP32[ptr >> 2] = SDL.DOMEventToSDLEvent[event.type];
    break;
   }

  case "resize":
   {
    HEAP32[ptr >> 2] = SDL.DOMEventToSDLEvent[event.type];
    HEAP32[ptr + 4 >> 2] = event.w;
    HEAP32[ptr + 8 >> 2] = event.h;
    break;
   }

  case "joystick_button_up":
  case "joystick_button_down":
   {
    var state = event.type === "joystick_button_up" ? 0 : 1;
    HEAP32[ptr >> 2] = SDL.DOMEventToSDLEvent[event.type];
    HEAP8[ptr + 4 >> 0] = event.index;
    HEAP8[ptr + 5 >> 0] = event.button;
    HEAP8[ptr + 6 >> 0] = state;
    break;
   }

  case "joystick_axis_motion":
   {
    HEAP32[ptr >> 2] = SDL.DOMEventToSDLEvent[event.type];
    HEAP8[ptr + 4 >> 0] = event.index;
    HEAP8[ptr + 5 >> 0] = event.axis;
    HEAP32[ptr + 8 >> 2] = SDL.joystickAxisValueConversion(event.value);
    break;
   }

  case "focus":
   {
    var SDL_WINDOWEVENT_FOCUS_GAINED = 12;
    HEAP32[ptr >> 2] = SDL.DOMEventToSDLEvent[event.type];
    HEAP32[ptr + 4 >> 2] = 0;
    HEAP8[ptr + 8 >> 0] = SDL_WINDOWEVENT_FOCUS_GAINED;
    break;
   }

  case "blur":
   {
    var SDL_WINDOWEVENT_FOCUS_LOST = 13;
    HEAP32[ptr >> 2] = SDL.DOMEventToSDLEvent[event.type];
    HEAP32[ptr + 4 >> 2] = 0;
    HEAP8[ptr + 8 >> 0] = SDL_WINDOWEVENT_FOCUS_LOST;
    break;
   }

  case "visibilitychange":
   {
    var SDL_WINDOWEVENT_SHOWN = 1;
    var SDL_WINDOWEVENT_HIDDEN = 2;
    var visibilityEventID = event.visible ? SDL_WINDOWEVENT_SHOWN : SDL_WINDOWEVENT_HIDDEN;
    HEAP32[ptr >> 2] = SDL.DOMEventToSDLEvent[event.type];
    HEAP32[ptr + 4 >> 2] = 0;
    HEAP8[ptr + 8 >> 0] = visibilityEventID;
    break;
   }

  default:
   throw "Unhandled SDL event: " + event.type;
  }
 },
 makeFontString: function(height, fontName) {
  if (fontName.charAt(0) != "'" && fontName.charAt(0) != '"') {
   fontName = '"' + fontName + '"';
  }
  return height + "px " + fontName + ", serif";
 },
 estimateTextWidth: function(fontData, text) {
  var h = fontData.size;
  var fontString = SDL.makeFontString(h, fontData.name);
  var tempCtx = SDL.ttfContext;
  assert(tempCtx, "TTF_Init must have been called");
  tempCtx.save();
  tempCtx.font = fontString;
  var ret = tempCtx.measureText(text).width | 0;
  tempCtx.restore();
  return ret;
 },
 allocateChannels: function(num) {
  if (SDL.numChannels && SDL.numChannels >= num && num != 0) return;
  SDL.numChannels = num;
  SDL.channels = [];
  for (var i = 0; i < num; i++) {
   SDL.channels[i] = {
    audio: null,
    volume: 1
   };
  }
 },
 setGetVolume: function(info, volume) {
  if (!info) return 0;
  var ret = info.volume * 128;
  if (volume != -1) {
   info.volume = Math.min(Math.max(volume, 0), 128) / 128;
   if (info.audio) {
    try {
     info.audio.volume = info.volume;
     if (info.audio.webAudioGainNode) info.audio.webAudioGainNode["gain"]["value"] = info.volume;
    } catch (e) {
     err("setGetVolume failed to set audio volume: " + e);
    }
   }
  }
  return ret;
 },
 setPannerPosition: function(info, x, y, z) {
  if (!info) return;
  if (info.audio) {
   if (info.audio.webAudioPannerNode) {
    info.audio.webAudioPannerNode["setPosition"](x, y, z);
   }
  }
 },
 playWebAudio: function(audio) {
  if (!audio) return;
  if (audio.webAudioNode) return;
  if (!SDL.webAudioAvailable()) return;
  try {
   var webAudio = audio.resource.webAudio;
   audio.paused = false;
   if (!webAudio.decodedBuffer) {
    if (webAudio.onDecodeComplete === undefined) abort("Cannot play back audio object that was not loaded");
    webAudio.onDecodeComplete.push(function() {
     if (!audio.paused) SDL.playWebAudio(audio);
    });
    return;
   }
   audio.webAudioNode = SDL.audioContext["createBufferSource"]();
   audio.webAudioNode["buffer"] = webAudio.decodedBuffer;
   audio.webAudioNode["loop"] = audio.loop;
   audio.webAudioNode["onended"] = function() {
    audio["onended"]();
   };
   audio.webAudioPannerNode = SDL.audioContext["createPanner"]();
   audio.webAudioPannerNode["setPosition"](0, 0, -.5);
   audio.webAudioPannerNode["panningModel"] = "equalpower";
   audio.webAudioGainNode = SDL.audioContext["createGain"]();
   audio.webAudioGainNode["gain"]["value"] = audio.volume;
   audio.webAudioNode["connect"](audio.webAudioPannerNode);
   audio.webAudioPannerNode["connect"](audio.webAudioGainNode);
   audio.webAudioGainNode["connect"](SDL.audioContext["destination"]);
   audio.webAudioNode["start"](0, audio.currentPosition);
   audio.startTime = SDL.audioContext["currentTime"] - audio.currentPosition;
  } catch (e) {
   err("playWebAudio failed: " + e);
  }
 },
 pauseWebAudio: function(audio) {
  if (!audio) return;
  if (audio.webAudioNode) {
   try {
    audio.currentPosition = (SDL.audioContext["currentTime"] - audio.startTime) % audio.resource.webAudio.decodedBuffer.duration;
    audio.webAudioNode["onended"] = undefined;
    audio.webAudioNode.stop(0);
    audio.webAudioNode = undefined;
   } catch (e) {
    err("pauseWebAudio failed: " + e);
   }
  }
  audio.paused = true;
 },
 openAudioContext: function() {
  if (!SDL.audioContext) {
   if (typeof AudioContext !== "undefined") SDL.audioContext = new AudioContext(); else if (typeof webkitAudioContext !== "undefined") SDL.audioContext = new webkitAudioContext();
  }
 },
 webAudioAvailable: function() {
  return !!SDL.audioContext;
 },
 fillWebAudioBufferFromHeap: function(heapPtr, sizeSamplesPerChannel, dstAudioBuffer) {
  var numChannels = SDL.audio.channels;
  for (var c = 0; c < numChannels; ++c) {
   var channelData = dstAudioBuffer["getChannelData"](c);
   if (channelData.length != sizeSamplesPerChannel) {
    throw "Web Audio output buffer length mismatch! Destination size: " + channelData.length + " samples vs expected " + sizeSamplesPerChannel + " samples!";
   }
   if (SDL.audio.format == 32784) {
    for (var j = 0; j < sizeSamplesPerChannel; ++j) {
     channelData[j] = HEAP16[heapPtr + (j * numChannels + c) * 2 >> 1] / 32768;
    }
   } else if (SDL.audio.format == 8) {
    for (var j = 0; j < sizeSamplesPerChannel; ++j) {
     var v = HEAP8[heapPtr + (j * numChannels + c) >> 0];
     channelData[j] = (v >= 0 ? v - 128 : v + 128) / 128;
    }
   } else if (SDL.audio.format == 33056) {
    for (var j = 0; j < sizeSamplesPerChannel; ++j) {
     channelData[j] = HEAPF32[heapPtr + (j * numChannels + c) * 4 >> 2];
    }
   } else {
    throw "Invalid SDL audio format " + SDL.audio.format + "!";
   }
  }
 },
 debugSurface: function(surfData) {
  console.log("dumping surface " + [ surfData.surf, surfData.source, surfData.width, surfData.height ]);
  var image = surfData.ctx.getImageData(0, 0, surfData.width, surfData.height);
  var data = image.data;
  var num = Math.min(surfData.width, surfData.height);
  for (var i = 0; i < num; i++) {
   console.log("   diagonal " + i + ":" + [ data[i * surfData.width * 4 + i * 4 + 0], data[i * surfData.width * 4 + i * 4 + 1], data[i * surfData.width * 4 + i * 4 + 2], data[i * surfData.width * 4 + i * 4 + 3] ]);
  }
 },
 joystickEventState: 1,
 lastJoystickState: {},
 joystickNamePool: {},
 recordJoystickState: function(joystick, state) {
  var buttons = new Array(state.buttons.length);
  for (var i = 0; i < state.buttons.length; i++) {
   buttons[i] = SDL.getJoystickButtonState(state.buttons[i]);
  }
  SDL.lastJoystickState[joystick] = {
   buttons: buttons,
   axes: state.axes.slice(0),
   timestamp: state.timestamp,
   index: state.index,
   id: state.id
  };
 },
 getJoystickButtonState: function(button) {
  if (typeof button === "object") {
   return button["pressed"];
  } else {
   return button > 0;
  }
 },
 queryJoysticks: function() {
  for (var joystick in SDL.lastJoystickState) {
   var state = SDL.getGamepad(joystick - 1);
   var prevState = SDL.lastJoystickState[joystick];
   if (typeof state === "undefined") return;
   if (state === null) return;
   if (typeof state.timestamp !== "number" || state.timestamp !== prevState.timestamp || !state.timestamp) {
    var i;
    for (i = 0; i < state.buttons.length; i++) {
     var buttonState = SDL.getJoystickButtonState(state.buttons[i]);
     if (buttonState !== prevState.buttons[i]) {
      SDL.events.push({
       type: buttonState ? "joystick_button_down" : "joystick_button_up",
       joystick: joystick,
       index: joystick - 1,
       button: i
      });
     }
    }
    for (i = 0; i < state.axes.length; i++) {
     if (state.axes[i] !== prevState.axes[i]) {
      SDL.events.push({
       type: "joystick_axis_motion",
       joystick: joystick,
       index: joystick - 1,
       axis: i,
       value: state.axes[i]
      });
     }
    }
    SDL.recordJoystickState(joystick, state);
   }
  }
 },
 joystickAxisValueConversion: function(value) {
  value = Math.min(1, Math.max(value, -1));
  return Math.ceil((value + 1) * 32767.5 - 32768);
 },
 getGamepads: function() {
  var fcn = navigator.getGamepads || navigator.webkitGamepads || navigator.mozGamepads || navigator.gamepads || navigator.webkitGetGamepads;
  if (fcn !== undefined) {
   return fcn.apply(navigator);
  } else {
   return [];
  }
 },
 getGamepad: function(deviceIndex) {
  var gamepads = SDL.getGamepads();
  if (gamepads.length > deviceIndex && deviceIndex >= 0) {
   return gamepads[deviceIndex];
  }
  return null;
 }
};

function _SDL_Init(initFlags) {
 SDL.startTime = Date.now();
 SDL.initFlags = initFlags;
 if (!Module["doNotCaptureKeyboard"]) {
  var keyboardListeningElement = Module["keyboardListeningElement"] || document;
  keyboardListeningElement.addEventListener("keydown", SDL.receiveEvent);
  keyboardListeningElement.addEventListener("keyup", SDL.receiveEvent);
  keyboardListeningElement.addEventListener("keypress", SDL.receiveEvent);
  window.addEventListener("focus", SDL.receiveEvent);
  window.addEventListener("blur", SDL.receiveEvent);
  document.addEventListener("visibilitychange", SDL.receiveEvent);
 }
 window.addEventListener("unload", SDL.receiveEvent);
 SDL.keyboardState = _malloc(65536);
 _memset(SDL.keyboardState, 0, 65536);
 SDL.DOMEventToSDLEvent["keydown"] = 768;
 SDL.DOMEventToSDLEvent["keyup"] = 769;
 SDL.DOMEventToSDLEvent["keypress"] = 771;
 SDL.DOMEventToSDLEvent["mousedown"] = 1025;
 SDL.DOMEventToSDLEvent["mouseup"] = 1026;
 SDL.DOMEventToSDLEvent["mousemove"] = 1024;
 SDL.DOMEventToSDLEvent["wheel"] = 1027;
 SDL.DOMEventToSDLEvent["touchstart"] = 1792;
 SDL.DOMEventToSDLEvent["touchend"] = 1793;
 SDL.DOMEventToSDLEvent["touchmove"] = 1794;
 SDL.DOMEventToSDLEvent["unload"] = 256;
 SDL.DOMEventToSDLEvent["resize"] = 28673;
 SDL.DOMEventToSDLEvent["visibilitychange"] = 512;
 SDL.DOMEventToSDLEvent["focus"] = 512;
 SDL.DOMEventToSDLEvent["blur"] = 512;
 SDL.DOMEventToSDLEvent["joystick_axis_motion"] = 1536;
 SDL.DOMEventToSDLEvent["joystick_button_down"] = 1539;
 SDL.DOMEventToSDLEvent["joystick_button_up"] = 1540;
 return 0;
}

function _SDL_PollEvent(ptr) {
 return SDL.pollEvent(ptr);
}

var GL = {
 counter: 1,
 lastError: 0,
 buffers: [],
 mappedBuffers: {},
 programs: [],
 framebuffers: [],
 renderbuffers: [],
 textures: [],
 uniforms: [],
 shaders: [],
 vaos: [],
 contexts: {},
 currentContext: null,
 offscreenCanvases: {},
 timerQueriesEXT: [],
 programInfos: {},
 stringCache: {},
 unpackAlignment: 4,
 init: function() {
  GL.miniTempBuffer = new Float32Array(GL.MINI_TEMP_BUFFER_SIZE);
  for (var i = 0; i < GL.MINI_TEMP_BUFFER_SIZE; i++) {
   GL.miniTempBufferViews[i] = GL.miniTempBuffer.subarray(0, i + 1);
  }
 },
 recordError: function recordError(errorCode) {
  if (!GL.lastError) {
   GL.lastError = errorCode;
  }
 },
 getNewId: function(table) {
  var ret = GL.counter++;
  for (var i = table.length; i < ret; i++) {
   table[i] = null;
  }
  return ret;
 },
 MINI_TEMP_BUFFER_SIZE: 256,
 miniTempBuffer: null,
 miniTempBufferViews: [ 0 ],
 getSource: function(shader, count, string, length) {
  var source = "";
  for (var i = 0; i < count; ++i) {
   var len = length ? HEAP32[length + i * 4 >> 2] : -1;
   source += UTF8ToString(HEAP32[string + i * 4 >> 2], len < 0 ? undefined : len);
  }
  return source;
 },
 createContext: function(canvas, webGLContextAttributes) {
  var ctx = canvas.getContext("webgl", webGLContextAttributes) || canvas.getContext("experimental-webgl", webGLContextAttributes);
  return ctx && GL.registerContext(ctx, webGLContextAttributes);
 },
 registerContext: function(ctx, webGLContextAttributes) {
  var handle = _malloc(8);
  var context = {
   handle: handle,
   attributes: webGLContextAttributes,
   version: webGLContextAttributes.majorVersion,
   GLctx: ctx
  };
  if (ctx.canvas) ctx.canvas.GLctxObject = context;
  GL.contexts[handle] = context;
  if (typeof webGLContextAttributes.enableExtensionsByDefault === "undefined" || webGLContextAttributes.enableExtensionsByDefault) {
   GL.initExtensions(context);
  }
  return handle;
 },
 makeContextCurrent: function(contextHandle) {
  GL.currentContext = GL.contexts[contextHandle];
  Module.ctx = GLctx = GL.currentContext && GL.currentContext.GLctx;
  return !(contextHandle && !GLctx);
 },
 getContext: function(contextHandle) {
  return GL.contexts[contextHandle];
 },
 deleteContext: function(contextHandle) {
  if (GL.currentContext === GL.contexts[contextHandle]) GL.currentContext = null;
  if (typeof JSEvents === "object") JSEvents.removeAllHandlersOnTarget(GL.contexts[contextHandle].GLctx.canvas);
  if (GL.contexts[contextHandle] && GL.contexts[contextHandle].GLctx.canvas) GL.contexts[contextHandle].GLctx.canvas.GLctxObject = undefined;
  _free(GL.contexts[contextHandle]);
  GL.contexts[contextHandle] = null;
 },
 initExtensions: function(context) {
  if (!context) context = GL.currentContext;
  if (context.initExtensionsDone) return;
  context.initExtensionsDone = true;
  var GLctx = context.GLctx;
  if (context.version < 2) {
   var instancedArraysExt = GLctx.getExtension("ANGLE_instanced_arrays");
   if (instancedArraysExt) {
    GLctx["vertexAttribDivisor"] = function(index, divisor) {
     instancedArraysExt["vertexAttribDivisorANGLE"](index, divisor);
    };
    GLctx["drawArraysInstanced"] = function(mode, first, count, primcount) {
     instancedArraysExt["drawArraysInstancedANGLE"](mode, first, count, primcount);
    };
    GLctx["drawElementsInstanced"] = function(mode, count, type, indices, primcount) {
     instancedArraysExt["drawElementsInstancedANGLE"](mode, count, type, indices, primcount);
    };
   }
   var vaoExt = GLctx.getExtension("OES_vertex_array_object");
   if (vaoExt) {
    GLctx["createVertexArray"] = function() {
     return vaoExt["createVertexArrayOES"]();
    };
    GLctx["deleteVertexArray"] = function(vao) {
     vaoExt["deleteVertexArrayOES"](vao);
    };
    GLctx["bindVertexArray"] = function(vao) {
     vaoExt["bindVertexArrayOES"](vao);
    };
    GLctx["isVertexArray"] = function(vao) {
     return vaoExt["isVertexArrayOES"](vao);
    };
   }
   var drawBuffersExt = GLctx.getExtension("WEBGL_draw_buffers");
   if (drawBuffersExt) {
    GLctx["drawBuffers"] = function(n, bufs) {
     drawBuffersExt["drawBuffersWEBGL"](n, bufs);
    };
   }
  }
  GLctx.disjointTimerQueryExt = GLctx.getExtension("EXT_disjoint_timer_query");
  var automaticallyEnabledExtensions = [ "OES_texture_float", "OES_texture_half_float", "OES_standard_derivatives", "OES_vertex_array_object", "WEBGL_compressed_texture_s3tc", "WEBGL_depth_texture", "OES_element_index_uint", "EXT_texture_filter_anisotropic", "EXT_frag_depth", "WEBGL_draw_buffers", "ANGLE_instanced_arrays", "OES_texture_float_linear", "OES_texture_half_float_linear", "EXT_blend_minmax", "EXT_shader_texture_lod", "WEBGL_compressed_texture_pvrtc", "EXT_color_buffer_half_float", "WEBGL_color_buffer_float", "EXT_sRGB", "WEBGL_compressed_texture_etc1", "EXT_disjoint_timer_query", "WEBGL_compressed_texture_etc", "WEBGL_compressed_texture_astc", "EXT_color_buffer_float", "WEBGL_compressed_texture_s3tc_srgb", "EXT_disjoint_timer_query_webgl2" ];
  var exts = GLctx.getSupportedExtensions();
  if (exts && exts.length > 0) {
   GLctx.getSupportedExtensions().forEach(function(ext) {
    if (automaticallyEnabledExtensions.indexOf(ext) != -1) {
     GLctx.getExtension(ext);
    }
   });
  }
 },
 populateUniformTable: function(program) {
  var p = GL.programs[program];
  var ptable = GL.programInfos[program] = {
   uniforms: {},
   maxUniformLength: 0,
   maxAttributeLength: -1,
   maxUniformBlockNameLength: -1
  };
  var utable = ptable.uniforms;
  var numUniforms = GLctx.getProgramParameter(p, 35718);
  for (var i = 0; i < numUniforms; ++i) {
   var u = GLctx.getActiveUniform(p, i);
   var name = u.name;
   ptable.maxUniformLength = Math.max(ptable.maxUniformLength, name.length + 1);
   var ls = name.lastIndexOf("[");
   if (ls > 0) {
    name = name.slice(0, ls);
   }
   var loc = GLctx.getUniformLocation(p, name);
   if (loc) {
    var id = GL.getNewId(GL.uniforms);
    utable[name] = [ u.size, id ];
    GL.uniforms[id] = loc;
    for (var j = 1; j < u.size; ++j) {
     var n = name + "[" + j + "]";
     loc = GLctx.getUniformLocation(p, n);
     id = GL.getNewId(GL.uniforms);
     GL.uniforms[id] = loc;
    }
   }
  }
 }
};

function _SDL_SetVideoMode(width, height, depth, flags) {
 [ "touchstart", "touchend", "touchmove", "mousedown", "mouseup", "mousemove", "DOMMouseScroll", "mousewheel", "wheel", "mouseout" ].forEach(function(event) {
  Module["canvas"].addEventListener(event, SDL.receiveEvent, true);
 });
 var canvas = Module["canvas"];
 if (width == 0 && height == 0) {
  width = canvas.width;
  height = canvas.height;
 }
 if (!SDL.addedResizeListener) {
  SDL.addedResizeListener = true;
  Browser.resizeListeners.push(function(w, h) {
   if (!SDL.settingVideoMode) {
    SDL.receiveEvent({
     type: "resize",
     w: w,
     h: h
    });
   }
  });
 }
 SDL.settingVideoMode = true;
 Browser.setCanvasSize(width, height);
 SDL.settingVideoMode = false;
 if (SDL.screen) {
  SDL.freeSurface(SDL.screen);
  assert(!SDL.screen);
 }
 if (SDL.GL) flags = flags | 67108864;
 SDL.screen = SDL.makeSurface(width, height, flags, true, "screen");
 return SDL.screen;
}

function ___cxa_allocate_exception(size) {
 return _malloc(size);
}

function __ZSt18uncaught_exceptionv() {
 return !!__ZSt18uncaught_exceptionv.uncaught_exception;
}

function ___cxa_free_exception(ptr) {
 try {
  return _free(ptr);
 } catch (e) {
  err("exception during cxa_free_exception: " + e);
 }
}

var EXCEPTIONS = {
 last: 0,
 caught: [],
 infos: {},
 deAdjust: function(adjusted) {
  if (!adjusted || EXCEPTIONS.infos[adjusted]) return adjusted;
  for (var key in EXCEPTIONS.infos) {
   var ptr = +key;
   var adj = EXCEPTIONS.infos[ptr].adjusted;
   var len = adj.length;
   for (var i = 0; i < len; i++) {
    if (adj[i] === adjusted) {
     return ptr;
    }
   }
  }
  return adjusted;
 },
 addRef: function(ptr) {
  if (!ptr) return;
  var info = EXCEPTIONS.infos[ptr];
  info.refcount++;
 },
 decRef: function(ptr) {
  if (!ptr) return;
  var info = EXCEPTIONS.infos[ptr];
  assert(info.refcount > 0);
  info.refcount--;
  if (info.refcount === 0 && !info.rethrown) {
   if (info.destructor) {
    Module["dynCall_vi"](info.destructor, ptr);
   }
   delete EXCEPTIONS.infos[ptr];
   ___cxa_free_exception(ptr);
  }
 },
 clearRef: function(ptr) {
  if (!ptr) return;
  var info = EXCEPTIONS.infos[ptr];
  info.refcount = 0;
 }
};

function ___cxa_begin_catch(ptr) {
 var info = EXCEPTIONS.infos[ptr];
 if (info && !info.caught) {
  info.caught = true;
  __ZSt18uncaught_exceptionv.uncaught_exception--;
 }
 if (info) info.rethrown = false;
 EXCEPTIONS.caught.push(ptr);
 EXCEPTIONS.addRef(EXCEPTIONS.deAdjust(ptr));
 return ptr;
}

function ___resumeException(ptr) {
 if (!EXCEPTIONS.last) {
  EXCEPTIONS.last = ptr;
 }
 throw ptr + " - Exception catching is disabled, this exception cannot be caught. Compile with -s DISABLE_EXCEPTION_CATCHING=0 or DISABLE_EXCEPTION_CATCHING=2 to catch.";
}

function ___cxa_find_matching_catch() {
 var thrown = EXCEPTIONS.last;
 if (!thrown) {
  return (setTempRet0(0), 0) | 0;
 }
 var info = EXCEPTIONS.infos[thrown];
 var throwntype = info.type;
 if (!throwntype) {
  return (setTempRet0(0), thrown) | 0;
 }
 var typeArray = Array.prototype.slice.call(arguments);
 var pointer = Module["___cxa_is_pointer_type"](throwntype);
 if (!___cxa_find_matching_catch.buffer) ___cxa_find_matching_catch.buffer = _malloc(4);
 HEAP32[___cxa_find_matching_catch.buffer >> 2] = thrown;
 thrown = ___cxa_find_matching_catch.buffer;
 for (var i = 0; i < typeArray.length; i++) {
  if (typeArray[i] && Module["___cxa_can_catch"](typeArray[i], throwntype, thrown)) {
   thrown = HEAP32[thrown >> 2];
   info.adjusted.push(thrown);
   return (setTempRet0(typeArray[i]), thrown) | 0;
  }
 }
 thrown = HEAP32[thrown >> 2];
 return (setTempRet0(throwntype), thrown) | 0;
}

function ___cxa_throw(ptr, type, destructor) {
 EXCEPTIONS.infos[ptr] = {
  ptr: ptr,
  adjusted: [ ptr ],
  type: type,
  destructor: destructor,
  refcount: 0,
  caught: false,
  rethrown: false
 };
 EXCEPTIONS.last = ptr;
 if (!("uncaught_exception" in __ZSt18uncaught_exceptionv)) {
  __ZSt18uncaught_exceptionv.uncaught_exception = 1;
 } else {
  __ZSt18uncaught_exceptionv.uncaught_exception++;
 }
 throw ptr + " - Exception catching is disabled, this exception cannot be caught. Compile with -s DISABLE_EXCEPTION_CATCHING=0 or DISABLE_EXCEPTION_CATCHING=2 to catch.";
}

function ___gxx_personality_v0() {}

function ___lock() {}

var SYSCALLS = {
 buffers: [ null, [], [] ],
 printChar: function(stream, curr) {
  var buffer = SYSCALLS.buffers[stream];
  assert(buffer);
  if (curr === 0 || curr === 10) {
   (stream === 1 ? out : err)(UTF8ArrayToString(buffer, 0));
   buffer.length = 0;
  } else {
   buffer.push(curr);
  }
 },
 varargs: 0,
 get: function(varargs) {
  SYSCALLS.varargs += 4;
  var ret = HEAP32[SYSCALLS.varargs - 4 >> 2];
  return ret;
 },
 getStr: function() {
  var ret = UTF8ToString(SYSCALLS.get());
  return ret;
 },
 get64: function() {
  var low = SYSCALLS.get(), high = SYSCALLS.get();
  if (low >= 0) assert(high === 0); else assert(high === -1);
  return low;
 },
 getZero: function() {
  assert(SYSCALLS.get() === 0);
 }
};

function ___syscall140(which, varargs) {
 SYSCALLS.varargs = varargs;
 try {
  var stream = SYSCALLS.getStreamFromFD(), offset_high = SYSCALLS.get(), offset_low = SYSCALLS.get(), result = SYSCALLS.get(), whence = SYSCALLS.get();
  var offset = offset_low;
  FS.llseek(stream, offset, whence);
  HEAP32[result >> 2] = stream.position;
  if (stream.getdents && offset === 0 && whence === 0) stream.getdents = null;
  return 0;
 } catch (e) {
  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
  return -e.errno;
 }
}

function flush_NO_FILESYSTEM() {
 var fflush = Module["_fflush"];
 if (fflush) fflush(0);
 var buffers = SYSCALLS.buffers;
 if (buffers[1].length) SYSCALLS.printChar(1, 10);
 if (buffers[2].length) SYSCALLS.printChar(2, 10);
}

function ___syscall146(which, varargs) {
 SYSCALLS.varargs = varargs;
 try {
  var stream = SYSCALLS.get(), iov = SYSCALLS.get(), iovcnt = SYSCALLS.get();
  var ret = 0;
  for (var i = 0; i < iovcnt; i++) {
   var ptr = HEAP32[iov + i * 8 >> 2];
   var len = HEAP32[iov + (i * 8 + 4) >> 2];
   for (var j = 0; j < len; j++) {
    SYSCALLS.printChar(stream, HEAPU8[ptr + j]);
   }
   ret += len;
  }
  return ret;
 } catch (e) {
  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
  return -e.errno;
 }
}

function ___syscall54(which, varargs) {
 SYSCALLS.varargs = varargs;
 try {
  return 0;
 } catch (e) {
  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
  return -e.errno;
 }
}

function ___syscall6(which, varargs) {
 SYSCALLS.varargs = varargs;
 try {
  var stream = SYSCALLS.getStreamFromFD();
  FS.close(stream);
  return 0;
 } catch (e) {
  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
  return -e.errno;
 }
}

function ___unlock() {}

function _abort() {
 Module["abort"]();
}

function _emscripten_get_heap_size() {
 return TOTAL_MEMORY;
}

function abortOnCannotGrowMemory(requestedSize) {
 abort("Cannot enlarge memory arrays to size " + requestedSize + " bytes. Either (1) compile with  -s TOTAL_MEMORY=X  with X higher than the current value " + TOTAL_MEMORY + ", (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which allows increasing the size at runtime but prevents some optimizations, (3) set Module.TOTAL_MEMORY to a higher value before the program runs, or (4) if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0 ");
}

function _emscripten_resize_heap(requestedSize) {
 abortOnCannotGrowMemory(requestedSize);
}

function _emscripten_memcpy_big(dest, src, num) {
 HEAPU8.set(HEAPU8.subarray(src, src + num), dest);
}

var PTHREAD_SPECIFIC = {};

function _pthread_getspecific(key) {
 return PTHREAD_SPECIFIC[key] || 0;
}

var PTHREAD_SPECIFIC_NEXT_KEY = 1;

var ERRNO_CODES = {
 EPERM: 1,
 ENOENT: 2,
 ESRCH: 3,
 EINTR: 4,
 EIO: 5,
 ENXIO: 6,
 E2BIG: 7,
 ENOEXEC: 8,
 EBADF: 9,
 ECHILD: 10,
 EAGAIN: 11,
 EWOULDBLOCK: 11,
 ENOMEM: 12,
 EACCES: 13,
 EFAULT: 14,
 ENOTBLK: 15,
 EBUSY: 16,
 EEXIST: 17,
 EXDEV: 18,
 ENODEV: 19,
 ENOTDIR: 20,
 EISDIR: 21,
 EINVAL: 22,
 ENFILE: 23,
 EMFILE: 24,
 ENOTTY: 25,
 ETXTBSY: 26,
 EFBIG: 27,
 ENOSPC: 28,
 ESPIPE: 29,
 EROFS: 30,
 EMLINK: 31,
 EPIPE: 32,
 EDOM: 33,
 ERANGE: 34,
 ENOMSG: 42,
 EIDRM: 43,
 ECHRNG: 44,
 EL2NSYNC: 45,
 EL3HLT: 46,
 EL3RST: 47,
 ELNRNG: 48,
 EUNATCH: 49,
 ENOCSI: 50,
 EL2HLT: 51,
 EDEADLK: 35,
 ENOLCK: 37,
 EBADE: 52,
 EBADR: 53,
 EXFULL: 54,
 ENOANO: 55,
 EBADRQC: 56,
 EBADSLT: 57,
 EDEADLOCK: 35,
 EBFONT: 59,
 ENOSTR: 60,
 ENODATA: 61,
 ETIME: 62,
 ENOSR: 63,
 ENONET: 64,
 ENOPKG: 65,
 EREMOTE: 66,
 ENOLINK: 67,
 EADV: 68,
 ESRMNT: 69,
 ECOMM: 70,
 EPROTO: 71,
 EMULTIHOP: 72,
 EDOTDOT: 73,
 EBADMSG: 74,
 ENOTUNIQ: 76,
 EBADFD: 77,
 EREMCHG: 78,
 ELIBACC: 79,
 ELIBBAD: 80,
 ELIBSCN: 81,
 ELIBMAX: 82,
 ELIBEXEC: 83,
 ENOSYS: 38,
 ENOTEMPTY: 39,
 ENAMETOOLONG: 36,
 ELOOP: 40,
 EOPNOTSUPP: 95,
 EPFNOSUPPORT: 96,
 ECONNRESET: 104,
 ENOBUFS: 105,
 EAFNOSUPPORT: 97,
 EPROTOTYPE: 91,
 ENOTSOCK: 88,
 ENOPROTOOPT: 92,
 ESHUTDOWN: 108,
 ECONNREFUSED: 111,
 EADDRINUSE: 98,
 ECONNABORTED: 103,
 ENETUNREACH: 101,
 ENETDOWN: 100,
 ETIMEDOUT: 110,
 EHOSTDOWN: 112,
 EHOSTUNREACH: 113,
 EINPROGRESS: 115,
 EALREADY: 114,
 EDESTADDRREQ: 89,
 EMSGSIZE: 90,
 EPROTONOSUPPORT: 93,
 ESOCKTNOSUPPORT: 94,
 EADDRNOTAVAIL: 99,
 ENETRESET: 102,
 EISCONN: 106,
 ENOTCONN: 107,
 ETOOMANYREFS: 109,
 EUSERS: 87,
 EDQUOT: 122,
 ESTALE: 116,
 ENOTSUP: 95,
 ENOMEDIUM: 123,
 EILSEQ: 84,
 EOVERFLOW: 75,
 ECANCELED: 125,
 ENOTRECOVERABLE: 131,
 EOWNERDEAD: 130,
 ESTRPIPE: 86
};

function _pthread_key_create(key, destructor) {
 if (key == 0) {
  return ERRNO_CODES.EINVAL;
 }
 HEAP32[key >> 2] = PTHREAD_SPECIFIC_NEXT_KEY;
 PTHREAD_SPECIFIC[PTHREAD_SPECIFIC_NEXT_KEY] = 0;
 PTHREAD_SPECIFIC_NEXT_KEY++;
 return 0;
}

function _pthread_once(ptr, func) {
 if (!_pthread_once.seen) _pthread_once.seen = {};
 if (ptr in _pthread_once.seen) return;
 dynCall_v(func);
 _pthread_once.seen[ptr] = 1;
}

function _pthread_setspecific(key, value) {
 if (!(key in PTHREAD_SPECIFIC)) {
  return ERRNO_CODES.EINVAL;
 }
 PTHREAD_SPECIFIC[key] = value;
 return 0;
}

function ___setErrNo(value) {
 if (Module["___errno_location"]) HEAP32[Module["___errno_location"]() >> 2] = value; else err("failed to set errno from JS");
 return value;
}

Module["requestFullScreen"] = function Module_requestFullScreen(lockPointer, resizeCanvas, vrDevice) {
 err("Module.requestFullScreen is deprecated. Please call Module.requestFullscreen instead.");
 Module["requestFullScreen"] = Module["requestFullscreen"];
 Browser.requestFullScreen(lockPointer, resizeCanvas, vrDevice);
};

Module["requestFullscreen"] = function Module_requestFullscreen(lockPointer, resizeCanvas, vrDevice) {
 Browser.requestFullscreen(lockPointer, resizeCanvas, vrDevice);
};

Module["requestAnimationFrame"] = function Module_requestAnimationFrame(func) {
 Browser.requestAnimationFrame(func);
};

Module["setCanvasSize"] = function Module_setCanvasSize(width, height, noUpdates) {
 Browser.setCanvasSize(width, height, noUpdates);
};

Module["pauseMainLoop"] = function Module_pauseMainLoop() {
 Browser.mainLoop.pause();
};

Module["resumeMainLoop"] = function Module_resumeMainLoop() {
 Browser.mainLoop.resume();
};

Module["getUserMedia"] = function Module_getUserMedia() {
 Browser.getUserMedia();
};

Module["createContext"] = function Module_createContext(canvas, useWebGL, setInModule, webGLContextAttributes) {
 return Browser.createContext(canvas, useWebGL, setInModule, webGLContextAttributes);
};

if (ENVIRONMENT_IS_NODE) {
 _emscripten_get_now = function _emscripten_get_now_actual() {
  var t = process["hrtime"]();
  return t[0] * 1e3 + t[1] / 1e6;
 };
} else if (typeof dateNow !== "undefined") {
 _emscripten_get_now = dateNow;
} else if (typeof self === "object" && self["performance"] && typeof self["performance"]["now"] === "function") {
 _emscripten_get_now = function() {
  return self["performance"]["now"]();
 };
} else if (typeof performance === "object" && typeof performance["now"] === "function") {
 _emscripten_get_now = function() {
  return performance["now"]();
 };
} else {
 _emscripten_get_now = Date.now;
}

var GLctx;

GL.init();

var ASSERTIONS = true;

function intArrayFromString(stringy, dontAddNull, length) {
 var len = length > 0 ? length : lengthBytesUTF8(stringy) + 1;
 var u8array = new Array(len);
 var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
 if (dontAddNull) u8array.length = numBytesWritten;
 return u8array;
}

var debug_table_ii = [ "0", "__ZNKSt3__210__function6__funcIZN13TestDraggableC1EvEUlR7Vector2E_NS_9allocatorIS5_EEFvS4_EE7__cloneEv", "__ZNKSt3__210__function6__funcIZN13TestDraggableC1EvEUlR7Vector2E_NS_9allocatorIS5_EEFvS4_EE11target_typeEv", "__ZNKSt3__210__function6__funcIZN13TestDraggableC1EvEUlR7Vector2E0_NS_9allocatorIS5_EEFvS4_EE7__cloneEv", "__ZNKSt3__210__function6__funcIZN13TestDraggableC1EvEUlR7Vector2E0_NS_9allocatorIS5_EEFvS4_EE11target_typeEv", "__ZNKSt3__210__function6__funcIZN13TestDraggableC1EvEUlR7Vector2E1_NS_9allocatorIS5_EEFvS4_EE7__cloneEv", "__ZNKSt3__210__function6__funcIZN13TestDraggableC1EvEUlR7Vector2E1_NS_9allocatorIS5_EEFvS4_EE11target_typeEv", "__ZNKSt3__210__function6__funcIZN13TestClickableC1EvEUlvE_NS_9allocatorIS3_EEFvvEE7__cloneEv", "__ZNKSt3__210__function6__funcIZN13TestClickableC1EvEUlvE_NS_9allocatorIS3_EEFvvEE11target_typeEv", "__ZNKSt3__210__function6__funcIZN13TestClickableC1EvEUlvE0_NS_9allocatorIS3_EEFvvEE7__cloneEv", "__ZNKSt3__210__function6__funcIZN13TestClickableC1EvEUlvE0_NS_9allocatorIS3_EEFvvEE11target_typeEv", "__ZNKSt3__210__function6__funcIZN13TestClickableC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EE7__cloneEv", "__ZNKSt3__210__function6__funcIZN13TestClickableC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EE11target_typeEv", "__ZNKSt3__210__function6__funcIZN13TestClickableC1EvEUlvE1_NS_9allocatorIS3_EEFvvEE7__cloneEv", "__ZNKSt3__210__function6__funcIZN13TestClickableC1EvEUlvE1_NS_9allocatorIS3_EEFvvEE11target_typeEv", "__ZNKSt3__210__function6__funcIZN13TestClickableC1EvEUlvE2_NS_9allocatorIS3_EEFvvEE7__cloneEv", "__ZNKSt3__210__function6__funcIZN13TestClickableC1EvEUlvE2_NS_9allocatorIS3_EEFvvEE11target_typeEv", "__ZNKSt3__210__function6__funcIZN13TestClickableC1EvEUlRK7Vector2E0_NS_9allocatorIS6_EEFvS5_EE7__cloneEv", "__ZNKSt3__210__function6__funcIZN13TestClickableC1EvEUlRK7Vector2E0_NS_9allocatorIS6_EEFvS5_EE11target_typeEv", "__ZNKSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlvE_NS5_ISG_EEFvvEE7__cloneEv", "__ZNKSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlvE_NS5_ISG_EEFvvEE11target_typeEv", "__ZNKSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlvE0_NS5_ISG_EEFvvEE7__cloneEv", "__ZNKSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlvE0_NS5_ISG_EEFvvEE11target_typeEv", "__ZNKSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlSC_E_NS5_ISG_EEFvSC_EE7__cloneEv", "__ZNKSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlSC_E_NS5_ISG_EEFvSC_EE11target_typeEv", "__ZNKSt3__210__function6__funcIZN11TestPoolingC1EvEUlvE_NS_9allocatorIS3_EEFP9ComponentvEE7__cloneEv", "__ZNSt3__210__function6__funcIZN11TestPoolingC1EvEUlvE_NS_9allocatorIS3_EEFP9ComponentvEEclEv", "__ZNKSt3__210__function6__funcIZN11TestPoolingC1EvEUlvE_NS_9allocatorIS3_EEFP9ComponentvEE11target_typeEv", "__ZNKSt3__210__function6__funcIZZN11TestPoolingC1EvENKUlvE_clEvEUlRK7Vector2P12CustomButtonE_NS_9allocatorIS9_EEFvS6_S8_EE7__cloneEv", "__ZNKSt3__210__function6__funcIZZN11TestPoolingC1EvENKUlvE_clEvEUlRK7Vector2P12CustomButtonE_NS_9allocatorIS9_EEFvS6_S8_EE11target_typeEv", "__ZNKSt3__210__function6__funcIZN11TestPoolingC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EE7__cloneEv", "__ZNKSt3__210__function6__funcIZN11TestPoolingC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EE11target_typeEv", "__ZNKSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEE7__cloneEv", "__ZNKSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEE11target_typeEv", "___stdio_close", "__ZNKSt3__217bad_function_call4whatEv", "__ZNKSt11logic_error4whatEv", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0" ];

var debug_table_iii = [ "0", "__ZNKSt3__220__shared_ptr_pointerIP18RectangleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP13TextComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP10EntityGridNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP9ComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__210__function6__funcIZN13TestDraggableC1EvEUlR7Vector2E_NS_9allocatorIS5_EEFvS4_EE6targetERKSt9type_info", "__ZNKSt3__210__function6__funcIZN13TestDraggableC1EvEUlR7Vector2E0_NS_9allocatorIS5_EEFvS4_EE6targetERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP21StrokeCircleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP19FillCircleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__210__function6__funcIZN13TestDraggableC1EvEUlR7Vector2E1_NS_9allocatorIS5_EEFvS4_EE6targetERKSt9type_info", "__ZNKSt3__210__function6__funcIZN13TestClickableC1EvEUlvE_NS_9allocatorIS3_EEFvvEE6targetERKSt9type_info", "__ZNKSt3__210__function6__funcIZN13TestClickableC1EvEUlvE0_NS_9allocatorIS3_EEFvvEE6targetERKSt9type_info", "__ZNKSt3__210__function6__funcIZN13TestClickableC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EE6targetERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP25RoundedRectangleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__210__function6__funcIZN13TestClickableC1EvEUlvE1_NS_9allocatorIS3_EEFvvEE6targetERKSt9type_info", "__ZNKSt3__210__function6__funcIZN13TestClickableC1EvEUlvE2_NS_9allocatorIS3_EEFvvEE6targetERKSt9type_info", "__ZNKSt3__210__function6__funcIZN13TestClickableC1EvEUlRK7Vector2E0_NS_9allocatorIS6_EEFvS5_EE6targetERKSt9type_info", "__ZNKSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlvE_NS5_ISG_EEFvvEE6targetERKSt9type_info", "__ZNKSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlvE0_NS5_ISG_EEFvvEE6targetERKSt9type_info", "__ZNKSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlSC_E_NS5_ISG_EEFvSC_EE6targetERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP12CustomButtonNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP17FixedCapacityPoolNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__210__function6__funcIZN11TestPoolingC1EvEUlvE_NS_9allocatorIS3_EEFP9ComponentvEE6targetERKSt9type_info", "__ZNKSt3__210__function6__funcIZZN11TestPoolingC1EvENKUlvE_clEvEUlRK7Vector2P12CustomButtonE_NS_9allocatorIS9_EEFvS6_S8_EE6targetERKSt9type_info", "__ZNKSt3__210__function6__funcIZN11TestPoolingC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EE6targetERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP15SpringAnimationNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP14TestPrimitivesNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP13TestTextLabelNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP14TestEntityGridNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP13TestDraggableNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP13TestClickableNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP11TestPoolingNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP13TestAnimationNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEE6targetERKSt9type_info", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0" ];

var debug_table_iiii = [ "0", "___stdio_write", "___stdio_seek", "___stdout_write", "__ZNK10__cxxabiv117__class_type_info9can_catchEPKNS_16__shim_type_infoERPv", "0", "0", "0" ];

var debug_table_v = [ "0", "__ZL25default_terminate_handlerv", "__Z9main_loopv", "__ZN10__cxxabiv112_GLOBAL__N_110construct_Ev" ];

var debug_table_vi = [ "0", "__ZNSt3__214__shared_countD2Ev", "__ZNSt3__220__shared_ptr_pointerIP18RectangleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP18RectangleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP18RectangleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__220__shared_ptr_pointerIP13TextComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP13TextComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP13TextComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__220__shared_ptr_pointerIP10EntityGridNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP10EntityGridNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP10EntityGridNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__220__shared_ptr_pointerIP9ComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP9ComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP9ComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__210__function6__baseIFvR7Vector2EED2Ev", "__ZNSt3__210__function6__funcIZN13TestDraggableC1EvEUlR7Vector2E_NS_9allocatorIS5_EEFvS4_EED0Ev", "__ZNSt3__210__function6__funcIZN13TestDraggableC1EvEUlR7Vector2E_NS_9allocatorIS5_EEFvS4_EE7destroyEv", "__ZNSt3__210__function6__funcIZN13TestDraggableC1EvEUlR7Vector2E_NS_9allocatorIS5_EEFvS4_EE18destroy_deallocateEv", "__ZNSt3__210__function6__funcIZN13TestDraggableC1EvEUlR7Vector2E0_NS_9allocatorIS5_EEFvS4_EED0Ev", "__ZNSt3__210__function6__funcIZN13TestDraggableC1EvEUlR7Vector2E0_NS_9allocatorIS5_EEFvS4_EE7destroyEv", "__ZNSt3__210__function6__funcIZN13TestDraggableC1EvEUlR7Vector2E0_NS_9allocatorIS5_EEFvS4_EE18destroy_deallocateEv", "__ZNSt3__220__shared_ptr_pointerIP21StrokeCircleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP21StrokeCircleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP21StrokeCircleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__220__shared_ptr_pointerIP19FillCircleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP19FillCircleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP19FillCircleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__210__function6__funcIZN13TestDraggableC1EvEUlR7Vector2E1_NS_9allocatorIS5_EEFvS4_EED0Ev", "__ZNSt3__210__function6__funcIZN13TestDraggableC1EvEUlR7Vector2E1_NS_9allocatorIS5_EEFvS4_EE7destroyEv", "__ZNSt3__210__function6__funcIZN13TestDraggableC1EvEUlR7Vector2E1_NS_9allocatorIS5_EEFvS4_EE18destroy_deallocateEv", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlvE_NS_9allocatorIS3_EEFvvEED2Ev", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlvE_NS_9allocatorIS3_EEFvvEED0Ev", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlvE_NS_9allocatorIS3_EEFvvEE7destroyEv", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlvE_NS_9allocatorIS3_EEFvvEE18destroy_deallocateEv", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlvE_NS_9allocatorIS3_EEFvvEEclEv", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlvE0_NS_9allocatorIS3_EEFvvEED2Ev", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlvE0_NS_9allocatorIS3_EEFvvEED0Ev", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlvE0_NS_9allocatorIS3_EEFvvEE7destroyEv", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlvE0_NS_9allocatorIS3_EEFvvEE18destroy_deallocateEv", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlvE0_NS_9allocatorIS3_EEFvvEEclEv", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EED2Ev", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EED0Ev", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EE7destroyEv", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EE18destroy_deallocateEv", "__ZNSt3__220__shared_ptr_pointerIP25RoundedRectangleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP25RoundedRectangleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP25RoundedRectangleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlvE1_NS_9allocatorIS3_EEFvvEED2Ev", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlvE1_NS_9allocatorIS3_EEFvvEED0Ev", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlvE1_NS_9allocatorIS3_EEFvvEE7destroyEv", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlvE1_NS_9allocatorIS3_EEFvvEE18destroy_deallocateEv", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlvE1_NS_9allocatorIS3_EEFvvEEclEv", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlvE2_NS_9allocatorIS3_EEFvvEED2Ev", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlvE2_NS_9allocatorIS3_EEFvvEED0Ev", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlvE2_NS_9allocatorIS3_EEFvvEE7destroyEv", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlvE2_NS_9allocatorIS3_EEFvvEE18destroy_deallocateEv", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlvE2_NS_9allocatorIS3_EEFvvEEclEv", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlRK7Vector2E0_NS_9allocatorIS6_EEFvS5_EED2Ev", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlRK7Vector2E0_NS_9allocatorIS6_EEFvS5_EED0Ev", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlRK7Vector2E0_NS_9allocatorIS6_EEFvS5_EE7destroyEv", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlRK7Vector2E0_NS_9allocatorIS6_EEFvS5_EE18destroy_deallocateEv", "__ZNSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlvE_NS5_ISG_EEFvvEED2Ev", "__ZNSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlvE_NS5_ISG_EEFvvEED0Ev", "__ZNSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlvE_NS5_ISG_EEFvvEE7destroyEv", "__ZNSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlvE_NS5_ISG_EEFvvEE18destroy_deallocateEv", "__ZNSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlvE_NS5_ISG_EEFvvEEclEv", "__ZNSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlvE0_NS5_ISG_EEFvvEED2Ev", "__ZNSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlvE0_NS5_ISG_EEFvvEED0Ev", "__ZNSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlvE0_NS5_ISG_EEFvvEE7destroyEv", "__ZNSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlvE0_NS5_ISG_EEFvvEE18destroy_deallocateEv", "__ZNSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlvE0_NS5_ISG_EEFvvEEclEv", "__ZNSt3__210__function6__baseIFvRK7Vector2EED2Ev", "__ZNSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlSC_E_NS5_ISG_EEFvSC_EED0Ev", "__ZNSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlSC_E_NS5_ISG_EEFvSC_EE7destroyEv", "__ZNSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlSC_E_NS5_ISG_EEFvSC_EE18destroy_deallocateEv", "__ZNSt3__220__shared_ptr_pointerIP12CustomButtonNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP12CustomButtonNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP12CustomButtonNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__220__shared_ptr_pointerIP17FixedCapacityPoolNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP17FixedCapacityPoolNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP17FixedCapacityPoolNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__210__function6__baseIFP9ComponentvEED2Ev", "__ZNSt3__210__function6__funcIZN11TestPoolingC1EvEUlvE_NS_9allocatorIS3_EEFP9ComponentvEED0Ev", "__ZNSt3__210__function6__funcIZN11TestPoolingC1EvEUlvE_NS_9allocatorIS3_EEFP9ComponentvEE7destroyEv", "__ZNSt3__210__function6__funcIZN11TestPoolingC1EvEUlvE_NS_9allocatorIS3_EEFP9ComponentvEE18destroy_deallocateEv", "__ZNSt3__210__function6__baseIFvRK7Vector2P12CustomButtonEED2Ev", "__ZNSt3__210__function6__funcIZZN11TestPoolingC1EvENKUlvE_clEvEUlRK7Vector2P12CustomButtonE_NS_9allocatorIS9_EEFvS6_S8_EED0Ev", "__ZNSt3__210__function6__funcIZZN11TestPoolingC1EvENKUlvE_clEvEUlRK7Vector2P12CustomButtonE_NS_9allocatorIS9_EEFvS6_S8_EE7destroyEv", "__ZNSt3__210__function6__funcIZZN11TestPoolingC1EvENKUlvE_clEvEUlRK7Vector2P12CustomButtonE_NS_9allocatorIS9_EEFvS6_S8_EE18destroy_deallocateEv", "__ZNSt3__210__function6__funcIZN11TestPoolingC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EED0Ev", "__ZNSt3__210__function6__funcIZN11TestPoolingC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EE7destroyEv", "__ZNSt3__210__function6__funcIZN11TestPoolingC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EE18destroy_deallocateEv", "__ZNSt3__220__shared_ptr_pointerIP15SpringAnimationNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP15SpringAnimationNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP15SpringAnimationNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__220__shared_ptr_pointerIP14TestPrimitivesNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP14TestPrimitivesNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP14TestPrimitivesNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__220__shared_ptr_pointerIP13TestTextLabelNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP13TestTextLabelNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP13TestTextLabelNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__220__shared_ptr_pointerIP14TestEntityGridNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP14TestEntityGridNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP14TestEntityGridNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__220__shared_ptr_pointerIP13TestDraggableNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP13TestDraggableNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP13TestDraggableNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__220__shared_ptr_pointerIP13TestClickableNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP13TestClickableNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP13TestClickableNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__220__shared_ptr_pointerIP11TestPoolingNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP11TestPoolingNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP11TestPoolingNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__220__shared_ptr_pointerIP13TestAnimationNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP13TestAnimationNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP13TestAnimationNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__210__function6__baseIFvvEED2Ev", "__ZNSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEED0Ev", "__ZNSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEE7destroyEv", "__ZNSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEE18destroy_deallocateEv", "__ZNSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEEclEv", "__ZNSt3__217bad_function_callD2Ev", "__ZNSt3__217bad_function_callD0Ev", "__ZN10__cxxabiv116__shim_type_infoD2Ev", "__ZN10__cxxabiv117__class_type_infoD0Ev", "__ZNK10__cxxabiv116__shim_type_info5noop1Ev", "__ZNK10__cxxabiv116__shim_type_info5noop2Ev", "__ZN10__cxxabiv120__si_class_type_infoD0Ev", "__ZNSt11logic_errorD2Ev", "__ZNSt11logic_errorD0Ev", "__ZNSt12length_errorD0Ev", "__ZN10__cxxabiv121__vmi_class_type_infoD0Ev", "__ZN10__cxxabiv112_GLOBAL__N_19destruct_EPv", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0" ];

var debug_table_vii = [ "0", "__ZNKSt3__210__function6__funcIZN13TestDraggableC1EvEUlR7Vector2E_NS_9allocatorIS5_EEFvS4_EE7__cloneEPNS0_6__baseIS8_EE", "__ZNSt3__210__function6__funcIZN13TestDraggableC1EvEUlR7Vector2E_NS_9allocatorIS5_EEFvS4_EEclES4_", "__ZNKSt3__210__function6__funcIZN13TestDraggableC1EvEUlR7Vector2E0_NS_9allocatorIS5_EEFvS4_EE7__cloneEPNS0_6__baseIS8_EE", "__ZNSt3__210__function6__funcIZN13TestDraggableC1EvEUlR7Vector2E0_NS_9allocatorIS5_EEFvS4_EEclES4_", "__ZNKSt3__210__function6__funcIZN13TestDraggableC1EvEUlR7Vector2E1_NS_9allocatorIS5_EEFvS4_EE7__cloneEPNS0_6__baseIS8_EE", "__ZNSt3__210__function6__funcIZN13TestDraggableC1EvEUlR7Vector2E1_NS_9allocatorIS5_EEFvS4_EEclES4_", "__ZNKSt3__210__function6__funcIZN13TestClickableC1EvEUlvE_NS_9allocatorIS3_EEFvvEE7__cloneEPNS0_6__baseIS6_EE", "__ZNKSt3__210__function6__funcIZN13TestClickableC1EvEUlvE0_NS_9allocatorIS3_EEFvvEE7__cloneEPNS0_6__baseIS6_EE", "__ZNKSt3__210__function6__funcIZN13TestClickableC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EE7__cloneEPNS0_6__baseIS9_EE", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EEclES5_", "__ZNKSt3__210__function6__funcIZN13TestClickableC1EvEUlvE1_NS_9allocatorIS3_EEFvvEE7__cloneEPNS0_6__baseIS6_EE", "__ZNKSt3__210__function6__funcIZN13TestClickableC1EvEUlvE2_NS_9allocatorIS3_EEFvvEE7__cloneEPNS0_6__baseIS6_EE", "__ZNKSt3__210__function6__funcIZN13TestClickableC1EvEUlRK7Vector2E0_NS_9allocatorIS6_EEFvS5_EE7__cloneEPNS0_6__baseIS9_EE", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlRK7Vector2E0_NS_9allocatorIS6_EEFvS5_EEclES5_", "__ZNKSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlvE_NS5_ISG_EEFvvEE7__cloneEPNS0_6__baseISI_EE", "__ZNKSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlvE0_NS5_ISG_EEFvvEE7__cloneEPNS0_6__baseISI_EE", "__ZNKSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlSC_E_NS5_ISG_EEFvSC_EE7__cloneEPNS0_6__baseISI_EE", "__ZNSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlSC_E_NS5_ISG_EEFvSC_EEclESC_", "__ZNKSt3__210__function6__funcIZN11TestPoolingC1EvEUlvE_NS_9allocatorIS3_EEFP9ComponentvEE7__cloneEPNS0_6__baseIS8_EE", "__ZNKSt3__210__function6__funcIZZN11TestPoolingC1EvENKUlvE_clEvEUlRK7Vector2P12CustomButtonE_NS_9allocatorIS9_EEFvS6_S8_EE7__cloneEPNS0_6__baseISC_EE", "__ZNKSt3__210__function6__funcIZN11TestPoolingC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EE7__cloneEPNS0_6__baseIS9_EE", "__ZNSt3__210__function6__funcIZN11TestPoolingC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EEclES5_", "__ZNKSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEE7__cloneEPNS0_6__baseIS5_EE", "0", "0", "0", "0", "0", "0", "0", "0" ];

var debug_table_viid = [ "0", "__ZN15SpringAnimation6onStepERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEEf" ];

var debug_table_viii = [ "0", "__ZN9Component8addChildERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEENS0_10shared_ptrIS_EE", "__ZNSt3__210__function6__funcIZZN11TestPoolingC1EvENKUlvE_clEvEUlRK7Vector2P12CustomButtonE_NS_9allocatorIS9_EEFvS6_S8_EEclES6_OS8_", "0" ];

var debug_table_viiii = [ "0", "__ZN18RectangleComponent8doLayoutERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN18RectangleComponent16doLayoutEntitiesERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN9Component8doLayoutERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN9Component16doLayoutEntitiesERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN13TextComponent8doLayoutERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN13TextComponent16doLayoutEntitiesERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN13DrawComponent8doLayoutERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN13DrawComponent16doLayoutEntitiesERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN21StrokeCircleComponent8doLayoutERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN21StrokeCircleComponent16doLayoutEntitiesERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN19FillCircleComponent8doLayoutERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN19FillCircleComponent16doLayoutEntitiesERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN25RoundedRectangleComponent8doLayoutERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN25RoundedRectangleComponent16doLayoutEntitiesERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZNK10__cxxabiv117__class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi", "__ZNK10__cxxabiv120__si_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi", "__ZNK10__cxxabiv121__vmi_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0" ];

var debug_table_viiiii = [ "0", "__ZNK10__cxxabiv117__class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib", "__ZNK10__cxxabiv120__si_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib", "__ZNK10__cxxabiv121__vmi_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib" ];

var debug_table_viiiiii = [ "0", "__ZNK10__cxxabiv117__class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib", "__ZNK10__cxxabiv120__si_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib", "__ZNK10__cxxabiv121__vmi_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib" ];

function nullFunc_ii(x) {
 err("Invalid function pointer '" + x + "' called with signature 'ii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("This pointer might make sense in another type signature: iii: " + debug_table_iii[x] + "  iiii: " + debug_table_iiii[x] + "  vii: " + debug_table_vii[x] + "  vi: " + debug_table_vi[x] + "  viid: " + debug_table_viid[x] + "  viii: " + debug_table_viii[x] + "  v: " + debug_table_v[x] + "  viiii: " + debug_table_viiii[x] + "  viiiii: " + debug_table_viiiii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  ");
 abort(x);
}

function nullFunc_iii(x) {
 err("Invalid function pointer '" + x + "' called with signature 'iii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("This pointer might make sense in another type signature: ii: " + debug_table_ii[x] + "  iiii: " + debug_table_iiii[x] + "  viii: " + debug_table_viii[x] + "  vii: " + debug_table_vii[x] + "  vi: " + debug_table_vi[x] + "  viid: " + debug_table_viid[x] + "  viiii: " + debug_table_viiii[x] + "  viiiii: " + debug_table_viiiii[x] + "  v: " + debug_table_v[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  ");
 abort(x);
}

function nullFunc_iiii(x) {
 err("Invalid function pointer '" + x + "' called with signature 'iiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("This pointer might make sense in another type signature: iii: " + debug_table_iii[x] + "  ii: " + debug_table_ii[x] + "  viii: " + debug_table_viii[x] + "  viiii: " + debug_table_viiii[x] + "  vii: " + debug_table_vii[x] + "  vi: " + debug_table_vi[x] + "  viid: " + debug_table_viid[x] + "  viiiii: " + debug_table_viiiii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  v: " + debug_table_v[x] + "  ");
 abort(x);
}

function nullFunc_v(x) {
 err("Invalid function pointer '" + x + "' called with signature 'v'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("This pointer might make sense in another type signature: vi: " + debug_table_vi[x] + "  vii: " + debug_table_vii[x] + "  viid: " + debug_table_viid[x] + "  viii: " + debug_table_viii[x] + "  viiii: " + debug_table_viiii[x] + "  viiiii: " + debug_table_viiiii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  ii: " + debug_table_ii[x] + "  iii: " + debug_table_iii[x] + "  iiii: " + debug_table_iiii[x] + "  ");
 abort(x);
}

function nullFunc_vi(x) {
 err("Invalid function pointer '" + x + "' called with signature 'vi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("This pointer might make sense in another type signature: v: " + debug_table_v[x] + "  vii: " + debug_table_vii[x] + "  viid: " + debug_table_viid[x] + "  viii: " + debug_table_viii[x] + "  viiii: " + debug_table_viiii[x] + "  viiiii: " + debug_table_viiiii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  ii: " + debug_table_ii[x] + "  iii: " + debug_table_iii[x] + "  iiii: " + debug_table_iiii[x] + "  ");
 abort(x);
}

function nullFunc_vii(x) {
 err("Invalid function pointer '" + x + "' called with signature 'vii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("This pointer might make sense in another type signature: vi: " + debug_table_vi[x] + "  viid: " + debug_table_viid[x] + "  viii: " + debug_table_viii[x] + "  v: " + debug_table_v[x] + "  viiii: " + debug_table_viiii[x] + "  viiiii: " + debug_table_viiiii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  ii: " + debug_table_ii[x] + "  iii: " + debug_table_iii[x] + "  iiii: " + debug_table_iiii[x] + "  ");
 abort(x);
}

function nullFunc_viid(x) {
 err("Invalid function pointer '" + x + "' called with signature 'viid'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("This pointer might make sense in another type signature: vii: " + debug_table_vii[x] + "  vi: " + debug_table_vi[x] + "  v: " + debug_table_v[x] + "  ii: " + debug_table_ii[x] + "  viii: " + debug_table_viii[x] + "  iii: " + debug_table_iii[x] + "  iiii: " + debug_table_iiii[x] + "  viiii: " + debug_table_viiii[x] + "  viiiii: " + debug_table_viiiii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  ");
 abort(x);
}

function nullFunc_viii(x) {
 err("Invalid function pointer '" + x + "' called with signature 'viii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("This pointer might make sense in another type signature: vii: " + debug_table_vii[x] + "  vi: " + debug_table_vi[x] + "  viiii: " + debug_table_viiii[x] + "  v: " + debug_table_v[x] + "  viiiii: " + debug_table_viiiii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  iii: " + debug_table_iii[x] + "  ii: " + debug_table_ii[x] + "  iiii: " + debug_table_iiii[x] + "  viid: " + debug_table_viid[x] + "  ");
 abort(x);
}

function nullFunc_viiii(x) {
 err("Invalid function pointer '" + x + "' called with signature 'viiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("This pointer might make sense in another type signature: viii: " + debug_table_viii[x] + "  vii: " + debug_table_vii[x] + "  vi: " + debug_table_vi[x] + "  viiiii: " + debug_table_viiiii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  v: " + debug_table_v[x] + "  iiii: " + debug_table_iiii[x] + "  iii: " + debug_table_iii[x] + "  ii: " + debug_table_ii[x] + "  viid: " + debug_table_viid[x] + "  ");
 abort(x);
}

function nullFunc_viiiii(x) {
 err("Invalid function pointer '" + x + "' called with signature 'viiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("This pointer might make sense in another type signature: viii: " + debug_table_viii[x] + "  viiii: " + debug_table_viiii[x] + "  vii: " + debug_table_vii[x] + "  vi: " + debug_table_vi[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  v: " + debug_table_v[x] + "  iiii: " + debug_table_iiii[x] + "  iii: " + debug_table_iii[x] + "  ii: " + debug_table_ii[x] + "  viid: " + debug_table_viid[x] + "  ");
 abort(x);
}

function nullFunc_viiiiii(x) {
 err("Invalid function pointer '" + x + "' called with signature 'viiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("This pointer might make sense in another type signature: viii: " + debug_table_viii[x] + "  viiii: " + debug_table_viiii[x] + "  viiiii: " + debug_table_viiiii[x] + "  vii: " + debug_table_vii[x] + "  vi: " + debug_table_vi[x] + "  v: " + debug_table_v[x] + "  iiii: " + debug_table_iiii[x] + "  iii: " + debug_table_iii[x] + "  viid: " + debug_table_viid[x] + "  ii: " + debug_table_ii[x] + "  ");
 abort(x);
}

var asmGlobalArg = {
 "Math": Math,
 "Int8Array": Int8Array,
 "Int16Array": Int16Array,
 "Int32Array": Int32Array,
 "Uint8Array": Uint8Array,
 "Uint16Array": Uint16Array,
 "Float32Array": Float32Array,
 "Float64Array": Float64Array
};

var asmLibraryArg = {
 "a": abort,
 "b": setTempRet0,
 "c": getTempRet0,
 "d": abortStackOverflow,
 "e": nullFunc_ii,
 "f": nullFunc_iii,
 "g": nullFunc_iiii,
 "h": nullFunc_v,
 "i": nullFunc_vi,
 "j": nullFunc_vii,
 "k": nullFunc_viid,
 "l": nullFunc_viii,
 "m": nullFunc_viiii,
 "n": nullFunc_viiiii,
 "o": nullFunc_viiiiii,
 "p": _Engine_FillPage,
 "q": _Engine_FilledEllipse,
 "r": _Engine_FilledRectangle,
 "s": _Engine_FilledText,
 "t": _Engine_GetMode,
 "u": _Engine_Init,
 "v": _Engine_MeasureTextWidth,
 "w": _Engine_RoundedRectangle,
 "x": _Engine_StrokeEllipse,
 "y": _SDL_GetTicks,
 "z": _SDL_Init,
 "A": _SDL_LockSurface,
 "B": _SDL_PollEvent,
 "C": _SDL_SetVideoMode,
 "D": __ZSt18uncaught_exceptionv,
 "E": ___cxa_allocate_exception,
 "F": ___cxa_begin_catch,
 "G": ___cxa_find_matching_catch,
 "H": ___cxa_free_exception,
 "I": ___cxa_throw,
 "J": ___gxx_personality_v0,
 "K": ___lock,
 "L": ___resumeException,
 "M": ___setErrNo,
 "N": ___syscall140,
 "O": ___syscall146,
 "P": ___syscall54,
 "Q": ___syscall6,
 "R": ___unlock,
 "S": _abort,
 "T": _emscripten_get_heap_size,
 "U": _emscripten_get_now,
 "V": _emscripten_memcpy_big,
 "W": _emscripten_resize_heap,
 "X": _emscripten_set_main_loop,
 "Y": _emscripten_set_main_loop_timing,
 "Z": _getCanvasHeight,
 "_": _getCanvasWidth,
 "$": _pthread_getspecific,
 "aa": _pthread_key_create,
 "ab": _pthread_once,
 "ac": _pthread_setspecific,
 "ad": abortOnCannotGrowMemory,
 "ae": flush_NO_FILESYSTEM,
 "af": tempDoublePtr,
 "ag": DYNAMICTOP_PTR
};

// EMSCRIPTEN_START_ASM


var asm = (/** @suppress {uselessCode} */ function(global,env,buffer) {
"use asm";var a=new global.Int8Array(buffer),b=new global.Int16Array(buffer),c=new global.Int32Array(buffer),d=new global.Uint8Array(buffer),e=new global.Uint16Array(buffer),f=new global.Float32Array(buffer),g=new global.Float64Array(buffer),h=env.af|0,i=env.ag|0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0.0,r=global.Math.abs,s=global.Math.sqrt,t=global.Math.ceil,u=global.Math.imul,v=global.Math.clz32,w=env.a,x=env.b,y=env.c,z=env.d,A=env.e,B=env.f,C=env.g,D=env.h,E=env.i,F=env.j,G=env.k,H=env.l,I=env.m,J=env.n,K=env.o,L=env.p,M=env.q,N=env.r,O=env.s,P=env.t,Q=env.u,R=env.v,S=env.w,T=env.x,U=env.y,V=env.z,W=env.A,X=env.B,Y=env.C,Z=env.D,_=env.E,$=env.F,aa=env.G,ba=env.H,ca=env.I,da=env.J,ea=env.K,fa=env.L,ga=env.M,ha=env.N,ia=env.O,ja=env.P,ka=env.Q,la=env.R,ma=env.S,na=env.T,oa=env.U,pa=env.V,qa=env.W,ra=env.X,sa=env.Y,ta=env.Z,ua=env._,va=env.$,wa=env.aa,xa=env.ab,ya=env.ac,za=env.ad,Aa=env.ae,Ba=14384,Ca=5257264,Da=0.0;
// EMSCRIPTEN_START_FUNCS
function Pa(a){a=a|0;var b=0;b=Ba;Ba=Ba+a|0;Ba=Ba+15&-16;if((Ba|0)>=(Ca|0))z(a|0);return b|0}function Qa(){return Ba|0}function Ra(a){a=a|0;Ba=a}function Sa(a,b){a=a|0;b=b|0;Ba=a;Ca=b}function Ta(){return 5872}function Ua(){return 5970}function Va(){var a=0,b=0;a=c[3368]|0;if(!a){b=_(4)|0;c[b>>2]=5696;ca(b|0,3640,121)}else{Ia[c[(c[a>>2]|0)+24>>2]&255](a);return}}function Wa(){var a=0,b=0,d=0,e=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0;a=Ba;Ba=Ba+176|0;if((Ba|0)>=(Ca|0))z(176);b=a+40|0;d=a+8|0;e=a+144|0;h=a+164|0;i=a+128|0;j=a+160|0;k=a+120|0;l=a+156|0;m=a+104|0;n=a+152|0;o=a+96|0;p=a+136|0;q=a+88|0;r=a+112|0;s=a+72|0;t=a+80|0;u=a;v=a+64|0;$g(11413)|0;c[d>>2]=0;g[d+8>>3]=+oa();w=d+16|0;x=d+28|0;c[w>>2]=0;c[w+4>>2]=0;c[w+8>>2]=0;c[w+12>>2]=0;Q();V(32)|0;Y(50,50,32,0)|0;w=jh(28)|0;Xa(w);c[h>>2]=0;c[b>>2]=c[h>>2];Ya(e,w,b);w=jh(28)|0;Za(w);c[j>>2]=0;c[b>>2]=c[j>>2];_a(i,w,b);w=jh(28)|0;$a(w);c[l>>2]=0;c[b>>2]=c[l>>2];ab(k,w,b);w=jh(28)|0;bb(w);c[n>>2]=0;c[b>>2]=c[n>>2];cb(m,w,b);w=jh(28)|0;db(w);c[p>>2]=0;c[b>>2]=c[p>>2];eb(o,w,b);w=jh(36)|0;fb(w);c[r>>2]=0;c[b>>2]=c[r>>2];gb(q,w,b);w=jh(32)|0;hb(w);c[t>>2]=0;c[b>>2]=c[t>>2];ib(s,w,b);w=c[e>>2]|0;t=e+4|0;r=c[t>>2]|0;p=(r|0)==0;if(p)y=d+24|0;else{n=r+4|0;c[n>>2]=(c[n>>2]|0)+1;c[n>>2]=(c[n>>2]|0)+1;y=d+24|0}c[y>>2]=w;w=c[x>>2]|0;c[x>>2]=r;if(w|0?(y=w+4|0,n=c[y>>2]|0,c[y>>2]=n+-1,(n|0)==0):0){Ia[c[(c[w>>2]|0)+8>>2]&255](w);ih(w)}w=c[d+24>>2]|0;n=d+16|0;y=n;l=c[y+4>>2]|0;j=w+20|0;c[j>>2]=c[y>>2];c[j+4>>2]=l;l=c[w+12>>2]|0;if(l|0){j=c[(c[l>>2]|0)+4>>2]|0;f[b>>2]=0.0;f[b+4>>2]=0.0;Ma[j&31](l,w,b,n)}if(!p?(p=r+4|0,n=c[p>>2]|0,c[p>>2]=n+-1,(n|0)==0):0){Ia[c[(c[r>>2]|0)+8>>2]&255](r);ih(r)}g[u>>3]=+oa();c[v>>2]=0;r=b+16|0;n=jh(44)|0;c[n>>2]=5148;c[n+4>>2]=u;c[n+8>>2]=v;c[n+12>>2]=d;c[n+16>>2]=e;c[n+20>>2]=i;c[n+24>>2]=k;c[n+28>>2]=m;c[n+32>>2]=o;c[n+36>>2]=q;c[n+40>>2]=s;c[r>>2]=n;Lc(b,13456);n=c[r>>2]|0;if((b|0)!=(n|0)){if(n|0)Ia[c[(c[n>>2]|0)+20>>2]&255](n)}else Ia[c[(c[n>>2]|0)+16>>2]&255](n);ra(2,0,1);n=c[s+4>>2]|0;if(n|0?(s=n+4|0,b=c[s>>2]|0,c[s>>2]=b+-1,(b|0)==0):0){Ia[c[(c[n>>2]|0)+8>>2]&255](n);ih(n)}n=c[q+4>>2]|0;if(n|0?(q=n+4|0,b=c[q>>2]|0,c[q>>2]=b+-1,(b|0)==0):0){Ia[c[(c[n>>2]|0)+8>>2]&255](n);ih(n)}n=c[o+4>>2]|0;if(n|0?(o=n+4|0,b=c[o>>2]|0,c[o>>2]=b+-1,(b|0)==0):0){Ia[c[(c[n>>2]|0)+8>>2]&255](n);ih(n)}n=c[m+4>>2]|0;if(n|0?(m=n+4|0,b=c[m>>2]|0,c[m>>2]=b+-1,(b|0)==0):0){Ia[c[(c[n>>2]|0)+8>>2]&255](n);ih(n)}n=c[k+4>>2]|0;if(n|0?(k=n+4|0,b=c[k>>2]|0,c[k>>2]=b+-1,(b|0)==0):0){Ia[c[(c[n>>2]|0)+8>>2]&255](n);ih(n)}n=c[i+4>>2]|0;if(n|0?(i=n+4|0,b=c[i>>2]|0,c[i>>2]=b+-1,(b|0)==0):0){Ia[c[(c[n>>2]|0)+8>>2]&255](n);ih(n)}n=c[t>>2]|0;if(n|0?(t=n+4|0,b=c[t>>2]|0,c[t>>2]=b+-1,(b|0)==0):0){Ia[c[(c[n>>2]|0)+8>>2]&255](n);ih(n)}n=c[x>>2]|0;if(!n){Ba=a;return 1}x=n+4|0;b=c[x>>2]|0;c[x>>2]=b+-1;if(b|0){Ba=a;return 1}Ia[c[(c[n>>2]|0)+8>>2]&255](n);ih(n);Ba=a;return 1}function Xa(b){b=b|0;var d=0,e=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,A=0,B=0,C=0,D=0,E=0,F=0.0,G=0.0,H=0.0,I=0,J=0,K=0,L=0.0,M=0.0,N=0;d=Ba;Ba=Ba+144|0;if((Ba|0)>=(Ca|0))z(144);e=d+96|0;h=d+48|0;i=d;c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;c[b+12>>2]=0;c[b+16>>2]=0;c[b+20>>2]=0;c[b+24>>2]=0;$g(11420)|0;j=h+8|0;k=j+36|0;do{c[j>>2]=0;j=j+4|0}while((j|0)<(k|0));c[h+44>>2]=2;c[h>>2]=1112014848;c[h+4>>2]=1112014848;f[h+16>>2]=30.0;f[h+20>>2]=30.0;c[h+32>>2]=-7820545;l=b+4|0;m=c[l>>2]|0;n=b+8|0;if(m>>>0<(c[n>>2]|0)>>>0){j=m;o=h;k=j+48|0;do{c[j>>2]=c[o>>2];j=j+4|0;o=o+4|0}while((j|0)<(k|0));m=(c[l>>2]|0)+48|0;c[l>>2]=m;p=m}else{kb(b,h);p=c[l>>2]|0}j=h+8|0;k=j+36|0;do{c[j>>2]=0;j=j+4|0}while((j|0)<(k|0));c[h+44>>2]=4;c[h>>2]=1125515264;c[h+4>>2]=1112014848;c[h+16>>2]=1109393408;c[h+20>>2]=1117782016;c[h+32>>2]=-1148649473;if(p>>>0<(c[n>>2]|0)>>>0){j=p;o=h;k=j+48|0;do{c[j>>2]=c[o>>2];j=j+4|0;o=o+4|0}while((j|0)<(k|0));c[l>>2]=(c[l>>2]|0)+48}else kb(b,h);p=i+11|0;m=i+6|0;q=h+8|0;r=h+44|0;s=h+4|0;t=h+24|0;u=h+32|0;v=h+36|0;w=h+16|0;x=h+20|0;y=h+16|0;A=i+8|0;B=i+44|0;C=i+16|0;D=i+32|0;E=1;do{c[i>>2]=0;c[i+4>>2]=0;c[i+8>>2]=0;a[p>>0]=6;a[i>>0]=a[6069]|0;a[i+1>>0]=a[6070]|0;a[i+2>>0]=a[6071]|0;a[i+3>>0]=a[6072]|0;a[i+4>>0]=a[6073]|0;a[i+5>>0]=a[6074]|0;a[m>>0]=0;F=+(E|0);G=F*50.0+120.0;H=F*10.0;j=q;k=j+36|0;do{c[j>>2]=0;j=j+4|0}while((j|0)<(k|0));c[r>>2]=6;c[h>>2]=1112014848;f[s>>2]=G;f[t>>2]=H;c[u>>2]=-1;if(!(mb(13492,i)|0)){I=c[3371]|0;J=(I-(c[3370]|0)|0)/12|0;K=I;if((c[3372]|0)==(K|0))nb(13480,i);else{qh(K,i);c[3371]=(c[3371]|0)+12}c[(lb(13492,i)|0)>>2]=J}c[v>>2]=c[(lb(13492,i)|0)>>2];F=+R(((a[p>>0]|0)<0?c[i>>2]|0:i)|0,+H);f[w>>2]=F;f[x>>2]=H;if((a[p>>0]|0)<0){kh(c[i>>2]|0);L=+f[y>>2];M=+f[x>>2]}else{L=F;M=H}g[e>>3]=L;g[e+8>>3]=M;Zg(6076,e)|0;j=A;k=j+36|0;do{c[j>>2]=0;j=j+4|0}while((j|0)<(k|0));c[B>>2]=4;J=h;K=c[J+4>>2]|0;I=i;c[I>>2]=c[J>>2];c[I+4>>2]=K;K=y;I=c[K+4>>2]|0;J=C;c[J>>2]=c[K>>2];c[J+4>>2]=I;c[D>>2]=-1148649473;I=c[l>>2]|0;if(I>>>0<(c[n>>2]|0)>>>0){j=I;o=i;k=j+48|0;do{c[j>>2]=c[o>>2];j=j+4|0;o=o+4|0}while((j|0)<(k|0));I=(c[l>>2]|0)+48|0;c[l>>2]=I;N=I}else{kb(b,i);N=c[l>>2]|0}if((N|0)==(c[n>>2]|0))qb(b,h);else{j=N;o=h;k=j+48|0;do{c[j>>2]=c[o>>2];j=j+4|0;o=o+4|0}while((j|0)<(k|0));c[l>>2]=(c[l>>2]|0)+48}E=E+1|0}while(E>>>0<6);j=e+8|0;k=j+36|0;do{c[j>>2]=0;j=j+4|0}while((j|0)<(k|0));c[e+44>>2]=5;c[e>>2]=1132068864;c[e+4>>2]=1112014848;c[e+16>>2]=1120403456;c[e+20>>2]=1128792064;f[e+24>>2]=15.0;f[e+28>>2]=5.0;c[e+32>>2]=-1;c[e+36>>2]=1442823167;E=c[l>>2]|0;if(E>>>0<(c[n>>2]|0)>>>0){j=E;o=e;k=j+48|0;do{c[j>>2]=c[o>>2];j=j+4|0;o=o+4|0}while((j|0)<(k|0));c[l>>2]=(c[l>>2]|0)+48;Ba=d;return}else{kb(b,e);Ba=d;return}}function Ya(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0;d=Ba;Ba=Ba+16|0;if((Ba|0)>=(Ca|0))z(16);e=d;c[a>>2]=b;f=jh(16)|0;c[f+4>>2]=0;c[f+8>>2]=0;c[f>>2]=4952;c[f+12>>2]=b;c[a+4>>2]=f;c[e>>2]=b;c[e+4>>2]=b;mf(a,e);Ba=d;return}function Za(b){b=b|0;var d=0,e=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,A=0;d=Ba;Ba=Ba+144|0;if((Ba|0)>=(Ca|0))z(144);e=d+40|0;g=d+32|0;h=d+24|0;i=d+16|0;j=d+8|0;k=d;l=d+96|0;m=d+80|0;n=d+88|0;o=d+72|0;p=d+64|0;q=d+56|0;r=d+48|0;c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;c[b+12>>2]=0;c[b+16>>2]=0;c[b+20>>2]=0;c[b+24>>2]=0;$g(11448)|0;s=l+8|0;t=s+36|0;do{c[s>>2]=0;s=s+4|0}while((s|0)<(t|0));c[l+44>>2]=2;c[l>>2]=1112014848;c[l+4>>2]=1112014848;f[l+16>>2]=30.0;f[l+20>>2]=30.0;c[l+32>>2]=-1711302145;u=b+4|0;v=c[u>>2]|0;w=b+8|0;if(v>>>0<(c[w>>2]|0)>>>0){s=v;x=l;t=s+48|0;do{c[s>>2]=c[x>>2];s=s+4|0;x=x+4|0}while((s|0)<(t|0));c[u>>2]=(c[u>>2]|0)+48}else kb(b,l);$g(11475)|0;v=jh(192)|0;Sb(v,b);c[v>>2]=3840;s=l+8|0;t=s+36|0;do{c[s>>2]=0;s=s+4|0}while((s|0)<(t|0));c[l+44>>2]=4;c[l>>2]=0;c[l+4>>2]=0;c[l+16>>2]=0;c[l+20>>2]=0;c[l+32>>2]=-1;y=c[u>>2]|0;A=c[b>>2]|0;c[A+((c[v+4>>2]|0)*48|0)+36>>2]=(y-A|0)/48|0;if((c[w>>2]|0)==(y|0))qb(b,l);else{s=y;x=l;t=s+48|0;do{c[s>>2]=c[x>>2];s=s+4|0;x=x+4|0}while((s|0)<(t|0));c[u>>2]=(c[u>>2]|0)+48}c[m>>2]=v;u=jh(16)|0;c[u+4>>2]=0;c[u+8>>2]=0;c[u>>2]=3880;c[u+12>>2]=v;y=m+4|0;c[y>>2]=u;c[k>>2]=v;c[k+4>>2]=v;Bb(m,k);v=b+12|0;u=c[m>>2]|0;w=c[y>>2]|0;c[m>>2]=0;c[y>>2]=0;c[v>>2]=u;u=b+16|0;m=c[u>>2]|0;c[u>>2]=w;if(m|0?(w=m+4|0,u=c[w>>2]|0,c[w>>2]=u+-1,(u|0)==0):0){Ia[c[(c[m>>2]|0)+8>>2]&255](m);ih(m)}m=c[y>>2]|0;if(m|0?(y=m+4|0,u=c[y>>2]|0,c[y>>2]=u+-1,(u|0)==0):0){Ia[c[(c[m>>2]|0)+8>>2]&255](m);ih(m)}$g(11477)|0;m=c[(c[v>>2]|0)+4>>2]|0;u=c[b>>2]|0;c[u+(m*48|0)+8>>2]=1056964608;c[u+(m*48|0)+12>>2]=1056964608;m=c[(c[v>>2]|0)+4>>2]|0;u=c[b>>2]|0;c[u+(m*48|0)>>2]=1056964608;c[u+(m*48|0)+4>>2]=1056964608;m=c[v>>2]|0;c[m+8>>2]=1056964608;c[m+12>>2]=1056964608;$g(11479)|0;m=jh(192)|0;c[l>>2]=0;c[l+4>>2]=0;c[l+8>>2]=0;u=jh(16)|0;c[l>>2]=u;c[l+8>>2]=-2147483632;c[l+4>>2]=12;s=u;x=6175;t=s+12|0;do{a[s>>0]=a[x>>0]|0;s=s+1|0;x=x+1|0}while((s|0)<(t|0));a[u+12>>0]=0;rb(m,b,l,65535,20.0);c[k>>2]=m;u=jh(16)|0;c[u+4>>2]=0;c[u+8>>2]=0;c[u>>2]=3928;c[u+12>>2]=m;y=k+4|0;c[y>>2]=u;c[j>>2]=m;c[j+4>>2]=m;Bb(k,j);if((a[l+11>>0]|0)<0)kh(c[l>>2]|0);m=c[v>>2]|0;u=c[c[m>>2]>>2]|0;c[n>>2]=c[k>>2];k=n+4|0;w=c[y>>2]|0;c[k>>2]=w;if(w|0){A=w+4|0;c[A>>2]=(c[A>>2]|0)+1}La[u&3](m,b,n);n=c[k>>2]|0;if(n|0?(k=n+4|0,m=c[k>>2]|0,c[k>>2]=m+-1,(m|0)==0):0){Ia[c[(c[n>>2]|0)+8>>2]&255](n);ih(n)}n=jh(192)|0;c[l>>2]=0;c[l+4>>2]=0;c[l+8>>2]=0;m=jh(16)|0;c[l>>2]=m;c[l+8>>2]=-2147483632;c[l+4>>2]=12;s=m;x=6175;t=s+12|0;do{a[s>>0]=a[x>>0]|0;s=s+1|0;x=x+1|0}while((s|0)<(t|0));a[m+12>>0]=0;rb(n,b,l,65535,20.0);c[j>>2]=n;m=jh(16)|0;c[m+4>>2]=0;c[m+8>>2]=0;c[m>>2]=3928;c[m+12>>2]=n;k=j+4|0;c[k>>2]=m;c[i>>2]=n;c[i+4>>2]=n;Bb(j,i);if((a[l+11>>0]|0)<0)kh(c[l>>2]|0);n=c[(c[j>>2]|0)+4>>2]|0;m=c[b>>2]|0;c[m+(n*48|0)>>2]=1065353216;c[m+(n*48|0)+4>>2]=0;n=c[j>>2]|0;c[n+8>>2]=1065353216;c[n+12>>2]=0;j=c[v>>2]|0;m=c[c[j>>2]>>2]|0;c[o>>2]=n;n=o+4|0;u=c[k>>2]|0;c[n>>2]=u;if(u|0){A=u+4|0;c[A>>2]=(c[A>>2]|0)+1}La[m&3](j,b,o);o=c[n>>2]|0;if(o|0?(n=o+4|0,j=c[n>>2]|0,c[n>>2]=j+-1,(j|0)==0):0){Ia[c[(c[o>>2]|0)+8>>2]&255](o);ih(o)}o=jh(192)|0;c[l>>2]=0;c[l+4>>2]=0;c[l+8>>2]=0;j=jh(16)|0;c[l>>2]=j;c[l+8>>2]=-2147483632;c[l+4>>2]=12;s=j;x=6175;t=s+12|0;do{a[s>>0]=a[x>>0]|0;s=s+1|0;x=x+1|0}while((s|0)<(t|0));a[j+12>>0]=0;rb(o,b,l,65535,20.0);c[i>>2]=o;j=jh(16)|0;c[j+4>>2]=0;c[j+8>>2]=0;c[j>>2]=3928;c[j+12>>2]=o;n=i+4|0;c[n>>2]=j;c[h>>2]=o;c[h+4>>2]=o;Bb(i,h);if((a[l+11>>0]|0)<0)kh(c[l>>2]|0);o=c[(c[i>>2]|0)+4>>2]|0;j=c[b>>2]|0;c[j+(o*48|0)>>2]=0;c[j+(o*48|0)+4>>2]=1065353216;o=c[i>>2]|0;c[o+8>>2]=0;c[o+12>>2]=1065353216;i=c[v>>2]|0;j=c[c[i>>2]>>2]|0;c[p>>2]=o;o=p+4|0;m=c[n>>2]|0;c[o>>2]=m;if(m|0){A=m+4|0;c[A>>2]=(c[A>>2]|0)+1}La[j&3](i,b,p);p=c[o>>2]|0;if(p|0?(o=p+4|0,i=c[o>>2]|0,c[o>>2]=i+-1,(i|0)==0):0){Ia[c[(c[p>>2]|0)+8>>2]&255](p);ih(p)}p=jh(192)|0;c[l>>2]=0;c[l+4>>2]=0;c[l+8>>2]=0;i=jh(16)|0;c[l>>2]=i;c[l+8>>2]=-2147483632;c[l+4>>2]=12;s=i;x=6175;t=s+12|0;do{a[s>>0]=a[x>>0]|0;s=s+1|0;x=x+1|0}while((s|0)<(t|0));a[i+12>>0]=0;rb(p,b,l,65535,20.0);c[h>>2]=p;i=jh(16)|0;c[i+4>>2]=0;c[i+8>>2]=0;c[i>>2]=3928;c[i+12>>2]=p;o=h+4|0;c[o>>2]=i;c[g>>2]=p;c[g+4>>2]=p;Bb(h,g);if((a[l+11>>0]|0)<0)kh(c[l>>2]|0);p=c[(c[h>>2]|0)+4>>2]|0;i=c[b>>2]|0;c[i+(p*48|0)>>2]=1065353216;c[i+(p*48|0)+4>>2]=1065353216;p=c[h>>2]|0;c[p+8>>2]=1065353216;c[p+12>>2]=1065353216;h=c[v>>2]|0;i=c[c[h>>2]>>2]|0;c[q>>2]=p;p=q+4|0;j=c[o>>2]|0;c[p>>2]=j;if(j|0){A=j+4|0;c[A>>2]=(c[A>>2]|0)+1}La[i&3](h,b,q);q=c[p>>2]|0;if(q|0?(p=q+4|0,h=c[p>>2]|0,c[p>>2]=h+-1,(h|0)==0):0){Ia[c[(c[q>>2]|0)+8>>2]&255](q);ih(q)}q=jh(192)|0;c[l>>2]=0;c[l+4>>2]=0;c[l+8>>2]=0;h=jh(16)|0;c[l>>2]=h;c[l+8>>2]=-2147483632;c[l+4>>2]=12;s=h;x=6175;t=s+12|0;do{a[s>>0]=a[x>>0]|0;s=s+1|0;x=x+1|0}while((s|0)<(t|0));a[h+12>>0]=0;rb(q,b,l,65535,20.0);c[g>>2]=q;h=jh(16)|0;c[h+4>>2]=0;c[h+8>>2]=0;c[h>>2]=3928;c[h+12>>2]=q;x=g+4|0;c[x>>2]=h;c[e>>2]=q;c[e+4>>2]=q;Bb(g,e);if((a[l+11>>0]|0)<0)kh(c[l>>2]|0);l=c[(c[g>>2]|0)+4>>2]|0;e=c[b>>2]|0;c[e+(l*48|0)>>2]=1056964608;c[e+(l*48|0)+4>>2]=1056964608;l=c[g>>2]|0;c[l+8>>2]=1056964608;c[l+12>>2]=1056964608;g=c[v>>2]|0;v=c[c[g>>2]>>2]|0;c[r>>2]=l;l=r+4|0;e=c[x>>2]|0;c[l>>2]=e;if(e|0){q=e+4|0;c[q>>2]=(c[q>>2]|0)+1}La[v&3](g,b,r);r=c[l>>2]|0;do if(r|0){l=r+4|0;b=c[l>>2]|0;c[l>>2]=b+-1;if(b|0)break;Ia[c[(c[r>>2]|0)+8>>2]&255](r);ih(r)}while(0);r=c[x>>2]|0;do if(r|0){x=r+4|0;b=c[x>>2]|0;c[x>>2]=b+-1;if(b|0)break;Ia[c[(c[r>>2]|0)+8>>2]&255](r);ih(r)}while(0);r=c[o>>2]|0;do if(r|0){o=r+4|0;b=c[o>>2]|0;c[o>>2]=b+-1;if(b|0)break;Ia[c[(c[r>>2]|0)+8>>2]&255](r);ih(r)}while(0);r=c[n>>2]|0;do if(r|0){n=r+4|0;b=c[n>>2]|0;c[n>>2]=b+-1;if(b|0)break;Ia[c[(c[r>>2]|0)+8>>2]&255](r);ih(r)}while(0);r=c[k>>2]|0;do if(r|0){k=r+4|0;b=c[k>>2]|0;c[k>>2]=b+-1;if(b|0)break;Ia[c[(c[r>>2]|0)+8>>2]&255](r);ih(r)}while(0);r=c[y>>2]|0;if(!r){Ba=d;return}y=r+4|0;b=c[y>>2]|0;c[y>>2]=b+-1;if(b|0){Ba=d;return}Ia[c[(c[r>>2]|0)+8>>2]&255](r);ih(r);Ba=d;return}function _a(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0;d=Ba;Ba=Ba+16|0;if((Ba|0)>=(Ca|0))z(16);e=d;c[a>>2]=b;f=jh(16)|0;c[f+4>>2]=0;c[f+8>>2]=0;c[f>>2]=4980;c[f+12>>2]=b;c[a+4>>2]=f;c[e>>2]=b;c[e+4>>2]=b;mf(a,e);Ba=d;return}function $a(a){a=a|0;var b=0,d=0,e=0,g=0,h=0,i=0,j=0,k=0,l=0;b=Ba;Ba=Ba+80|0;if((Ba|0)>=(Ca|0))z(80);d=b+24|0;e=b;g=b+8|0;h=b+16|0;c[a>>2]=0;c[a+4>>2]=0;c[a+8>>2]=0;c[a+12>>2]=0;c[a+16>>2]=0;c[a+20>>2]=0;c[a+24>>2]=0;$g(11481)|0;i=d+8|0;j=i+36|0;do{c[i>>2]=0;i=i+4|0}while((i|0)<(j|0));c[d+44>>2]=2;c[d>>2]=1112014848;c[d+4>>2]=1112014848;f[d+16>>2]=30.0;f[d+20>>2]=30.0;c[d+32>>2]=1722482687;k=a+4|0;l=c[k>>2]|0;if(l>>>0<(c[a+8>>2]|0)>>>0){i=l;l=d;j=i+48|0;do{c[i>>2]=c[l>>2];i=i+4|0;l=l+4|0}while((i|0)<(j|0));c[k>>2]=(c[k>>2]|0)+48}else kb(a,d);k=jh(200)|0;c[h>>2]=20;c[h+4>>2]=30;c[d>>2]=c[h>>2];c[d+4>>2]=c[h+4>>2];Nb(k,a,d);c[g>>2]=k;d=jh(16)|0;c[d+4>>2]=0;c[d+8>>2]=0;c[d>>2]=3976;c[d+12>>2]=k;h=g+4|0;c[h>>2]=d;c[e>>2]=k;c[e+4>>2]=k;Bb(g,e);e=a+12|0;k=c[g>>2]|0;d=c[h>>2]|0;c[g>>2]=0;c[h>>2]=0;c[e>>2]=k;k=a+16|0;g=c[k>>2]|0;c[k>>2]=d;if(g|0?(d=g+4|0,k=c[d>>2]|0,c[d>>2]=k+-1,(k|0)==0):0){Ia[c[(c[g>>2]|0)+8>>2]&255](g);ih(g)}g=c[h>>2]|0;if(g|0?(h=g+4|0,k=c[h>>2]|0,c[h>>2]=k+-1,(k|0)==0):0){Ia[c[(c[g>>2]|0)+8>>2]&255](g);ih(g)}g=c[e>>2]|0;c[g+52>>2]=1;k=c[g+4>>2]|0;g=c[a>>2]|0;c[g+(k*48|0)+8>>2]=1065353216;c[g+(k*48|0)+12>>2]=1065353216;k=c[(c[e>>2]|0)+4>>2]|0;g=c[a>>2]|0;c[g+(k*48|0)+24>>2]=-1054867456;c[g+(k*48|0)+28>>2]=-1054867456;k=c[(c[e>>2]|0)+4>>2]|0;g=c[a>>2]|0;c[g+(k*48|0)>>2]=1056964608;c[g+(k*48|0)+4>>2]=1056964608;k=c[e>>2]|0;c[k+8>>2]=1056964608;c[k+12>>2]=1056964608;Ba=b;return}function ab(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0;d=Ba;Ba=Ba+16|0;if((Ba|0)>=(Ca|0))z(16);e=d;c[a>>2]=b;f=jh(16)|0;c[f+4>>2]=0;c[f+8>>2]=0;c[f>>2]=5008;c[f+12>>2]=b;c[a+4>>2]=f;c[e>>2]=b;c[e+4>>2]=b;mf(a,e);Ba=d;return}function bb(b){b=b|0;var d=0,e=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0;d=Ba;Ba=Ba+432|0;if((Ba|0)>=(Ca|0))z(432);e=d+312|0;g=d+264|0;h=d+216|0;i=d+168|0;j=d+120|0;k=d+72|0;l=d+336|0;m=d+48|0;n=d+24|0;o=d;p=d+416|0;q=d+408|0;r=d+400|0;s=d+392|0;t=d+384|0;c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;c[b+12>>2]=0;c[b+16>>2]=0;c[b+20>>2]=0;c[b+24>>2]=0;$g(11509)|0;u=l+8|0;v=u+36|0;do{c[u>>2]=0;u=u+4|0}while((u|0)<(v|0));c[l+44>>2]=2;c[l>>2]=1112014848;c[l+4>>2]=1112014848;f[l+16>>2]=30.0;f[l+20>>2]=30.0;c[l+32>>2]=-16711681;w=b+4|0;x=c[w>>2]|0;y=b+8|0;if(x>>>0<(c[y>>2]|0)>>>0){u=x;A=l;v=u+48|0;do{c[u>>2]=c[A>>2];u=u+4|0;A=A+4|0}while((u|0)<(v|0));c[w>>2]=(c[w>>2]|0)+48}else kb(b,l);x=jh(192)|0;Sb(x,b);c[l>>2]=x;B=jh(16)|0;c[B+4>>2]=0;c[B+8>>2]=0;c[B>>2]=4004;c[B+12>>2]=x;C=l+4|0;c[C>>2]=B;c[k>>2]=x;c[k+4>>2]=x;Bb(l,k);x=b+12|0;B=c[l>>2]|0;D=c[C>>2]|0;c[l>>2]=0;c[C>>2]=0;c[x>>2]=B;B=b+16|0;E=c[B>>2]|0;c[B>>2]=D;if(E|0?(D=E+4|0,B=c[D>>2]|0,c[D>>2]=B+-1,(B|0)==0):0){Ia[c[(c[E>>2]|0)+8>>2]&255](E);ih(E)}E=c[C>>2]|0;if(E|0?(C=E+4|0,B=c[C>>2]|0,c[C>>2]=B+-1,(B|0)==0):0){Ia[c[(c[E>>2]|0)+8>>2]&255](E);ih(E)}E=c[(c[x>>2]|0)+4>>2]|0;B=c[b>>2]|0;c[B+(E*48|0)+8>>2]=1065353216;c[B+(E*48|0)+12>>2]=1065353216;E=jh(192)|0;Sb(E,b);c[E>>2]=3840;u=k+8|0;v=u+36|0;do{c[u>>2]=0;u=u+4|0}while((u|0)<(v|0));c[k+44>>2]=4;c[k>>2]=0;c[k+4>>2]=0;c[k+16>>2]=0;c[k+20>>2]=0;c[k+32>>2]=-1;B=c[w>>2]|0;C=c[b>>2]|0;c[C+((c[E+4>>2]|0)*48|0)+36>>2]=(B-C|0)/48|0;if((c[y>>2]|0)==(B|0))qb(b,k);else{u=B;A=k;v=u+48|0;do{c[u>>2]=c[A>>2];u=u+4|0;A=A+4|0}while((u|0)<(v|0));c[w>>2]=(c[w>>2]|0)+48}c[l>>2]=E;B=jh(16)|0;c[B+4>>2]=0;c[B+8>>2]=0;c[B>>2]=3880;c[B+12>>2]=E;C=l+4|0;c[C>>2]=B;c[j>>2]=E;c[j+4>>2]=E;Bb(l,j);E=c[(c[l>>2]|0)+4>>2]|0;B=c[b>>2]|0;c[B+(E*48|0)>>2]=1062836634;c[B+(E*48|0)+4>>2]=1062836634;E=c[l>>2]|0;c[E+8>>2]=1056964608;c[E+12>>2]=1056964608;B=c[E+4>>2]|0;D=c[b>>2]|0;c[D+(B*48|0)+24>>2]=1117782016;c[D+(B*48|0)+28>>2]=1117782016;B=j+16|0;c[B>>2]=0;Xb(j,E+64|0);D=c[B>>2]|0;if((j|0)!=(D|0)){if(D|0)Ia[c[(c[D>>2]|0)+20>>2]&255](D)}else Ia[c[(c[D>>2]|0)+16>>2]&255](D);a[E+56>>0]=1;E=jh(192)|0;Sb(E,b);c[E>>2]=3840;u=j+8|0;v=u+36|0;do{c[u>>2]=0;u=u+4|0}while((u|0)<(v|0));c[j+44>>2]=4;c[j>>2]=0;c[j+4>>2]=0;c[j+16>>2]=0;c[j+20>>2]=0;c[j+32>>2]=-1426076417;D=c[w>>2]|0;B=c[b>>2]|0;c[B+((c[E+4>>2]|0)*48|0)+36>>2]=(D-B|0)/48|0;if((c[y>>2]|0)==(D|0))qb(b,j);else{u=D;A=j;v=u+48|0;do{c[u>>2]=c[A>>2];u=u+4|0;A=A+4|0}while((u|0)<(v|0));c[w>>2]=(c[w>>2]|0)+48}c[k>>2]=E;D=jh(16)|0;c[D+4>>2]=0;c[D+8>>2]=0;c[D>>2]=3880;c[D+12>>2]=E;B=k+4|0;c[B>>2]=D;c[i>>2]=E;c[i+4>>2]=E;Bb(k,i);E=c[(c[k>>2]|0)+4>>2]|0;D=c[b>>2]|0;c[D+(E*48|0)>>2]=1048576e3;c[D+(E*48|0)+4>>2]=1048576e3;E=c[k>>2]|0;c[E+8>>2]=1056964608;c[E+12>>2]=1056964608;D=c[E+4>>2]|0;F=c[b>>2]|0;c[F+(D*48|0)+24>>2]=1117782016;c[F+(D*48|0)+28>>2]=1117782016;D=m+16|0;c[m>>2]=4032;c[D>>2]=m;F=i+16|0;c[F>>2]=i;c[i>>2]=4032;Xb(i,E+64|0);G=c[F>>2]|0;if((i|0)!=(G|0)){if(G|0)Ia[c[(c[G>>2]|0)+20>>2]&255](G)}else Ia[c[(c[G>>2]|0)+16>>2]&255](G);a[E+56>>0]=1;E=c[D>>2]|0;if((m|0)!=(E|0)){if(E|0)Ia[c[(c[E>>2]|0)+20>>2]&255](E)}else Ia[c[(c[E>>2]|0)+16>>2]&255](E);E=jh(192)|0;Sb(E,b);c[E>>2]=3840;u=i+8|0;v=u+36|0;do{c[u>>2]=0;u=u+4|0}while((u|0)<(v|0));c[i+44>>2]=4;c[i>>2]=0;c[i+4>>2]=0;c[i+16>>2]=0;c[i+20>>2]=0;c[i+32>>2]=-1429405697;m=c[w>>2]|0;D=c[b>>2]|0;c[D+((c[E+4>>2]|0)*48|0)+36>>2]=(m-D|0)/48|0;if((c[y>>2]|0)==(m|0))qb(b,i);else{u=m;A=i;v=u+48|0;do{c[u>>2]=c[A>>2];u=u+4|0;A=A+4|0}while((u|0)<(v|0));c[w>>2]=(c[w>>2]|0)+48}c[j>>2]=E;m=jh(16)|0;c[m+4>>2]=0;c[m+8>>2]=0;c[m>>2]=3880;c[m+12>>2]=E;D=j+4|0;c[D>>2]=m;c[h>>2]=E;c[h+4>>2]=E;Bb(j,h);E=c[(c[j>>2]|0)+4>>2]|0;m=c[b>>2]|0;c[m+(E*48|0)>>2]=1048576e3;c[m+(E*48|0)+4>>2]=1061158912;E=c[j>>2]|0;c[E+8>>2]=1056964608;c[E+12>>2]=1056964608;m=c[E+4>>2]|0;G=c[b>>2]|0;c[G+(m*48|0)+24>>2]=1117782016;c[G+(m*48|0)+28>>2]=1117782016;m=n+16|0;c[n>>2]=4076;c[m>>2]=n;G=h+16|0;c[G>>2]=h;c[h>>2]=4076;Xb(h,E+64|0);F=c[G>>2]|0;if((h|0)!=(F|0)){if(F|0)Ia[c[(c[F>>2]|0)+20>>2]&255](F)}else Ia[c[(c[F>>2]|0)+16>>2]&255](F);a[E+56>>0]=1;E=c[m>>2]|0;if((n|0)!=(E|0)){if(E|0)Ia[c[(c[E>>2]|0)+20>>2]&255](E)}else Ia[c[(c[E>>2]|0)+16>>2]&255](E);E=jh(192)|0;Sb(E,b);c[E>>2]=4120;u=h+8|0;v=u+36|0;do{c[u>>2]=0;u=u+4|0}while((u|0)<(v|0));c[h+44>>2]=3;c[h>>2]=0;c[h+4>>2]=0;f[h+16>>2]=0.0;f[h+20>>2]=0.0;f[h+24>>2]=5.0;c[h+28>>2]=0;c[h+32>>2]=-1429405697;n=c[w>>2]|0;m=c[b>>2]|0;c[m+((c[E+4>>2]|0)*48|0)+36>>2]=(n-m|0)/48|0;if((c[y>>2]|0)==(n|0))qb(b,h);else{u=n;A=h;v=u+48|0;do{c[u>>2]=c[A>>2];u=u+4|0;A=A+4|0}while((u|0)<(v|0));c[w>>2]=(c[w>>2]|0)+48}c[i>>2]=E;n=jh(16)|0;c[n+4>>2]=0;c[n+8>>2]=0;c[n>>2]=4140;c[n+12>>2]=E;m=i+4|0;c[m>>2]=n;c[g>>2]=E;c[g+4>>2]=E;pc(i,g);E=(c[i>>2]|0)+4|0;n=c[E>>2]|0;F=c[b>>2]|0;f[F+(n*48|0)+8>>2]=0.0;f[F+(n*48|0)+12>>2]=0.0;n=c[E>>2]|0;F=c[b>>2]|0;f[F+(n*48|0)+24>>2]=300.0;f[F+(n*48|0)+28>>2]=300.0;n=c[E>>2]|0;E=c[b>>2]|0;c[E+(n*48|0)>>2]=1056964608;c[E+(n*48|0)+4>>2]=1056964608;n=c[i>>2]|0;c[n+8>>2]=1056964608;c[n+12>>2]=1056964608;n=jh(192)|0;Sb(n,b);c[n>>2]=4168;u=g+8|0;v=u+36|0;do{c[u>>2]=0;u=u+4|0}while((u|0)<(v|0));c[g+44>>2]=2;c[g>>2]=0;c[g+4>>2]=0;f[g+16>>2]=0.0;f[g+20>>2]=0.0;c[g+32>>2]=-1429405697;E=c[w>>2]|0;F=c[b>>2]|0;c[F+((c[n+4>>2]|0)*48|0)+36>>2]=(E-F|0)/48|0;if((c[y>>2]|0)==(E|0))qb(b,g);else{u=E;A=g;v=u+48|0;do{c[u>>2]=c[A>>2];u=u+4|0;A=A+4|0}while((u|0)<(v|0));c[w>>2]=(c[w>>2]|0)+48}c[h>>2]=n;w=jh(16)|0;c[w+4>>2]=0;c[w+8>>2]=0;c[w>>2]=4188;c[w+12>>2]=n;A=h+4|0;c[A>>2]=w;c[e>>2]=n;c[e+4>>2]=n;wc(h,e);n=(c[h>>2]|0)+4|0;w=c[n>>2]|0;u=c[b>>2]|0;f[u+(w*48|0)+8>>2]=0.0;f[u+(w*48|0)+12>>2]=0.0;w=c[n>>2]|0;u=c[b>>2]|0;f[u+(w*48|0)+24>>2]=100.0;f[u+(w*48|0)+28>>2]=100.0;w=c[n>>2]|0;n=c[b>>2]|0;c[n+(w*48|0)>>2]=1056964608;c[n+(w*48|0)+4>>2]=1056964608;w=c[h>>2]|0;c[w+8>>2]=1056964608;c[w+12>>2]=1056964608;n=c[w+4>>2]|0;u=c[b>>2]|0;c[u+(n*48|0)+16>>2]=0;c[u+(n*48|0)+20>>2]=1125515264;n=o+16|0;c[o>>2]=4216;c[n>>2]=o;u=e+16|0;c[u>>2]=e;c[e>>2]=4216;Xb(e,w+64|0);v=c[u>>2]|0;if((e|0)!=(v|0)){if(v|0)Ia[c[(c[v>>2]|0)+20>>2]&255](v)}else Ia[c[(c[v>>2]|0)+16>>2]&255](v);a[w+56>>0]=1;w=c[n>>2]|0;if((o|0)!=(w|0)){if(w|0)Ia[c[(c[w>>2]|0)+20>>2]&255](w)}else Ia[c[(c[w>>2]|0)+16>>2]&255](w);w=c[x>>2]|0;o=c[c[w>>2]>>2]|0;c[p>>2]=c[l>>2];l=p+4|0;n=c[C>>2]|0;c[l>>2]=n;if(n|0){v=n+4|0;c[v>>2]=(c[v>>2]|0)+1}La[o&3](w,b,p);p=c[l>>2]|0;if(p|0?(l=p+4|0,w=c[l>>2]|0,c[l>>2]=w+-1,(w|0)==0):0){Ia[c[(c[p>>2]|0)+8>>2]&255](p);ih(p)}p=c[x>>2]|0;w=c[c[p>>2]>>2]|0;c[q>>2]=c[k>>2];k=q+4|0;l=c[B>>2]|0;c[k>>2]=l;if(l|0){o=l+4|0;c[o>>2]=(c[o>>2]|0)+1}La[w&3](p,b,q);q=c[k>>2]|0;do if(q|0){k=q+4|0;p=c[k>>2]|0;c[k>>2]=p+-1;if(p|0)break;Ia[c[(c[q>>2]|0)+8>>2]&255](q);ih(q)}while(0);q=c[x>>2]|0;p=c[c[q>>2]>>2]|0;c[r>>2]=c[j>>2];j=r+4|0;k=c[D>>2]|0;c[j>>2]=k;if(k|0){w=k+4|0;c[w>>2]=(c[w>>2]|0)+1}La[p&3](q,b,r);r=c[j>>2]|0;do if(r|0){j=r+4|0;q=c[j>>2]|0;c[j>>2]=q+-1;if(q|0)break;Ia[c[(c[r>>2]|0)+8>>2]&255](r);ih(r)}while(0);r=c[x>>2]|0;q=c[c[r>>2]>>2]|0;c[s>>2]=c[i>>2];i=s+4|0;j=c[m>>2]|0;c[i>>2]=j;if(j|0){p=j+4|0;c[p>>2]=(c[p>>2]|0)+1}La[q&3](r,b,s);s=c[i>>2]|0;do if(s|0){i=s+4|0;r=c[i>>2]|0;c[i>>2]=r+-1;if(r|0)break;Ia[c[(c[s>>2]|0)+8>>2]&255](s);ih(s)}while(0);s=c[x>>2]|0;x=c[c[s>>2]>>2]|0;c[t>>2]=c[h>>2];h=t+4|0;r=c[A>>2]|0;c[h>>2]=r;if(r|0){i=r+4|0;c[i>>2]=(c[i>>2]|0)+1}La[x&3](s,b,t);t=c[h>>2]|0;do if(t|0){h=t+4|0;b=c[h>>2]|0;c[h>>2]=b+-1;if(b|0)break;Ia[c[(c[t>>2]|0)+8>>2]&255](t);ih(t)}while(0);t=c[A>>2]|0;do if(t|0){A=t+4|0;b=c[A>>2]|0;c[A>>2]=b+-1;if(b|0)break;Ia[c[(c[t>>2]|0)+8>>2]&255](t);ih(t)}while(0);t=c[m>>2]|0;do if(t|0){m=t+4|0;b=c[m>>2]|0;c[m>>2]=b+-1;if(b|0)break;Ia[c[(c[t>>2]|0)+8>>2]&255](t);ih(t)}while(0);t=c[D>>2]|0;do if(t|0){D=t+4|0;b=c[D>>2]|0;c[D>>2]=b+-1;if(b|0)break;Ia[c[(c[t>>2]|0)+8>>2]&255](t);ih(t)}while(0);t=c[B>>2]|0;do if(t|0){B=t+4|0;b=c[B>>2]|0;c[B>>2]=b+-1;if(b|0)break;Ia[c[(c[t>>2]|0)+8>>2]&255](t);ih(t)}while(0);t=c[C>>2]|0;if(!t){Ba=d;return}C=t+4|0;b=c[C>>2]|0;c[C>>2]=b+-1;if(b|0){Ba=d;return}Ia[c[(c[t>>2]|0)+8>>2]&255](t);ih(t);Ba=d;return}function cb(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0;d=Ba;Ba=Ba+16|0;if((Ba|0)>=(Ca|0))z(16);e=d;c[a>>2]=b;f=jh(16)|0;c[f+4>>2]=0;c[f+8>>2]=0;c[f>>2]=5036;c[f+12>>2]=b;c[a+4>>2]=f;c[e>>2]=b;c[e+4>>2]=b;mf(a,e);Ba=d;return}function db(a){a=a|0;var b=0,d=0,e=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0;b=Ba;Ba=Ba+352|0;if((Ba|0)>=(Ca|0))z(352);d=b+272|0;e=b+264|0;g=b+216|0;h=b+168|0;i=b+304|0;j=b+144|0;k=b+120|0;l=b+96|0;m=b+72|0;n=b+48|0;o=b+24|0;p=b;q=b+296|0;r=b+288|0;s=b+280|0;c[a>>2]=0;c[a+4>>2]=0;c[a+8>>2]=0;c[a+12>>2]=0;c[a+16>>2]=0;c[a+20>>2]=0;c[a+24>>2]=0;$g(11509)|0;t=i+8|0;u=t+36|0;do{c[t>>2]=0;t=t+4|0}while((t|0)<(u|0));c[i+44>>2]=2;c[i>>2]=1112014848;c[i+4>>2]=1112014848;f[i+16>>2]=30.0;f[i+20>>2]=30.0;c[i+32>>2]=-3364097;v=a+4|0;w=c[v>>2]|0;x=a+8|0;if(w>>>0<(c[x>>2]|0)>>>0){t=w;y=i;u=t+48|0;do{c[t>>2]=c[y>>2];t=t+4|0;y=y+4|0}while((t|0)<(u|0));c[v>>2]=(c[v>>2]|0)+48}else kb(a,i);w=jh(192)|0;Sb(w,a);c[i>>2]=w;A=jh(16)|0;c[A+4>>2]=0;c[A+8>>2]=0;c[A>>2]=4004;c[A+12>>2]=w;B=i+4|0;c[B>>2]=A;c[h>>2]=w;c[h+4>>2]=w;Bb(i,h);w=a+12|0;A=c[i>>2]|0;C=c[B>>2]|0;c[i>>2]=0;c[B>>2]=0;c[w>>2]=A;A=a+16|0;D=c[A>>2]|0;c[A>>2]=C;if(D|0?(C=D+4|0,A=c[C>>2]|0,c[C>>2]=A+-1,(A|0)==0):0){Ia[c[(c[D>>2]|0)+8>>2]&255](D);ih(D)}D=c[B>>2]|0;if(D|0?(B=D+4|0,A=c[B>>2]|0,c[B>>2]=A+-1,(A|0)==0):0){Ia[c[(c[D>>2]|0)+8>>2]&255](D);ih(D)}D=c[(c[w>>2]|0)+4>>2]|0;A=c[a>>2]|0;c[A+(D*48|0)+8>>2]=1065353216;c[A+(D*48|0)+12>>2]=1065353216;D=jh(192)|0;Sb(D,a);c[D>>2]=4168;t=h+8|0;u=t+36|0;do{c[t>>2]=0;t=t+4|0}while((t|0)<(u|0));c[h+44>>2]=2;c[h>>2]=0;c[h+4>>2]=0;f[h+16>>2]=0.0;f[h+20>>2]=0.0;c[h+32>>2]=-1429405697;A=c[v>>2]|0;B=c[a>>2]|0;c[B+((c[D+4>>2]|0)*48|0)+36>>2]=(A-B|0)/48|0;if((c[x>>2]|0)==(A|0))qb(a,h);else{t=A;y=h;u=t+48|0;do{c[t>>2]=c[y>>2];t=t+4|0;y=y+4|0}while((t|0)<(u|0));c[v>>2]=(c[v>>2]|0)+48}c[i>>2]=D;A=jh(16)|0;c[A+4>>2]=0;c[A+8>>2]=0;c[A>>2]=4188;c[A+12>>2]=D;B=i+4|0;c[B>>2]=A;c[g>>2]=D;c[g+4>>2]=D;wc(i,g);D=(c[i>>2]|0)+4|0;A=c[D>>2]|0;C=c[a>>2]|0;f[C+(A*48|0)+8>>2]=0.0;f[C+(A*48|0)+12>>2]=0.0;A=c[D>>2]|0;C=c[a>>2]|0;f[C+(A*48|0)+24>>2]=100.0;f[C+(A*48|0)+28>>2]=100.0;A=c[D>>2]|0;D=c[a>>2]|0;c[D+(A*48|0)>>2]=1065353216;c[D+(A*48|0)+4>>2]=0;A=c[i>>2]|0;D=c[A+4>>2]|0;C=c[a>>2]|0;c[C+(D*48|0)+16>>2]=-1027080192;c[C+(D*48|0)+20>>2]=1120403456;c[A+8>>2]=1056964608;c[A+12>>2]=1056964608;D=a;C=A;E=c[B>>2]|0;if(!E)F=0;else{G=E+4|0;c[G>>2]=(c[G>>2]|0)+1;F=c[B>>2]|0}G=j+16|0;c[j>>2]=4260;c[j+4>>2]=D;c[j+8>>2]=C;c[j+12>>2]=E;c[G>>2]=j;if(!F)H=0;else{E=F+4|0;c[E>>2]=(c[E>>2]|0)+1;H=c[B>>2]|0}E=k+16|0;c[k>>2]=4304;c[k+4>>2]=D;c[k+8>>2]=C;c[k+12>>2]=F;c[E>>2]=k;if(H|0){F=H+4|0;c[F>>2]=(c[F>>2]|0)+1}F=l+16|0;c[l>>2]=4348;c[l+4>>2]=D;c[l+8>>2]=C;c[l+12>>2]=H;c[F>>2]=l;Jc(A,j,k,l);A=c[F>>2]|0;if((l|0)!=(A|0)){if(A|0)Ia[c[(c[A>>2]|0)+20>>2]&255](A)}else Ia[c[(c[A>>2]|0)+16>>2]&255](A);A=c[E>>2]|0;if((k|0)!=(A|0)){if(A|0)Ia[c[(c[A>>2]|0)+20>>2]&255](A)}else Ia[c[(c[A>>2]|0)+16>>2]&255](A);A=c[G>>2]|0;if((j|0)!=(A|0)){if(A|0)Ia[c[(c[A>>2]|0)+20>>2]&255](A)}else Ia[c[(c[A>>2]|0)+16>>2]&255](A);A=jh(192)|0;Sb(A,a);c[A>>2]=4392;t=g+8|0;u=t+36|0;do{c[t>>2]=0;t=t+4|0}while((t|0)<(u|0));c[g+44>>2]=5;c[g>>2]=0;c[g+4>>2]=0;c[g+16>>2]=0;c[g+20>>2]=0;f[g+24>>2]=10.0;f[g+28>>2]=5.0;c[g+32>>2]=-1;c[g+36>>2]=869007615;j=c[v>>2]|0;G=c[a>>2]|0;c[G+((c[A+4>>2]|0)*48|0)+36>>2]=(j-G|0)/48|0;if((c[x>>2]|0)==(j|0))qb(a,g);else{t=j;y=g;u=t+48|0;do{c[t>>2]=c[y>>2];t=t+4|0;y=y+4|0}while((t|0)<(u|0));c[v>>2]=(c[v>>2]|0)+48}c[h>>2]=A;v=jh(16)|0;c[v+4>>2]=0;c[v+8>>2]=0;c[v>>2]=4412;c[v+12>>2]=A;y=h+4|0;c[y>>2]=v;c[e>>2]=A;c[e+4>>2]=A;qd(h,e);A=(c[h>>2]|0)+4|0;v=c[A>>2]|0;t=c[a>>2]|0;c[t+(v*48|0)+24>>2]=1125515264;c[t+(v*48|0)+28>>2]=1117782016;v=c[A>>2]|0;A=c[a>>2]|0;c[A+(v*48|0)>>2]=1065353216;c[A+(v*48|0)+4>>2]=0;v=c[h>>2]|0;A=c[v+4>>2]|0;t=c[a>>2]|0;c[t+(A*48|0)+16>>2]=-1018691584;c[t+(A*48|0)+20>>2]=1133903872;c[v+8>>2]=0;c[v+12>>2]=1056964608;A=v;t=c[y>>2]|0;if(!t)I=0;else{u=t+4|0;c[u>>2]=(c[u>>2]|0)+1;I=c[y>>2]|0}u=m+16|0;c[m>>2]=4440;c[m+4>>2]=D;c[m+8>>2]=A;c[m+12>>2]=t;c[u>>2]=m;if(!I)J=0;else{t=I+4|0;c[t>>2]=(c[t>>2]|0)+1;J=c[y>>2]|0}t=n+16|0;c[n>>2]=4484;c[n+4>>2]=D;c[n+8>>2]=A;c[n+12>>2]=I;c[t>>2]=n;if(J|0){I=J+4|0;c[I>>2]=(c[I>>2]|0)+1}I=o+16|0;c[o>>2]=4528;c[o+4>>2]=D;c[o+8>>2]=A;c[o+12>>2]=J;c[I>>2]=o;Jc(v,m,n,o);v=c[I>>2]|0;if((o|0)!=(v|0)){if(v|0)Ia[c[(c[v>>2]|0)+20>>2]&255](v)}else Ia[c[(c[v>>2]|0)+16>>2]&255](v);v=c[t>>2]|0;if((n|0)!=(v|0)){if(v|0)Ia[c[(c[v>>2]|0)+20>>2]&255](v)}else Ia[c[(c[v>>2]|0)+16>>2]&255](v);v=c[u>>2]|0;if((m|0)!=(v|0)){if(v|0)Ia[c[(c[v>>2]|0)+20>>2]&255](v)}else Ia[c[(c[v>>2]|0)+16>>2]&255](v);v=jh(216)|0;m=p+16|0;c[m>>2]=0;Kc(v,a,p);c[e>>2]=v;u=jh(16)|0;c[u+4>>2]=0;c[u+8>>2]=0;c[u>>2]=4724;c[u+12>>2]=v;n=e+4|0;c[n>>2]=u;c[d>>2]=v;c[d+4>>2]=v;ue(e,d);d=c[m>>2]|0;if((p|0)!=(d|0)){if(d|0)Ia[c[(c[d>>2]|0)+20>>2]&255](d)}else Ia[c[(c[d>>2]|0)+16>>2]&255](d);d=(c[e>>2]|0)+4|0;p=c[d>>2]|0;m=c[a>>2]|0;c[m+(p*48|0)+24>>2]=1125515264;c[m+(p*48|0)+28>>2]=1117782016;p=c[d>>2]|0;d=c[a>>2]|0;c[d+(p*48|0)>>2]=1056964608;c[d+(p*48|0)+4>>2]=1056964608;p=c[e>>2]|0;c[p+8>>2]=1056964608;c[p+12>>2]=1056964608;p=c[w>>2]|0;d=c[c[p>>2]>>2]|0;c[q>>2]=c[i>>2];i=q+4|0;m=c[B>>2]|0;c[i>>2]=m;if(m|0){v=m+4|0;c[v>>2]=(c[v>>2]|0)+1}La[d&3](p,a,q);q=c[i>>2]|0;do if(q|0){i=q+4|0;p=c[i>>2]|0;c[i>>2]=p+-1;if(p|0)break;Ia[c[(c[q>>2]|0)+8>>2]&255](q);ih(q)}while(0);q=c[w>>2]|0;p=c[c[q>>2]>>2]|0;c[r>>2]=c[h>>2];h=r+4|0;i=c[y>>2]|0;c[h>>2]=i;if(i|0){d=i+4|0;c[d>>2]=(c[d>>2]|0)+1}La[p&3](q,a,r);r=c[h>>2]|0;do if(r|0){h=r+4|0;q=c[h>>2]|0;c[h>>2]=q+-1;if(q|0)break;Ia[c[(c[r>>2]|0)+8>>2]&255](r);ih(r)}while(0);r=c[w>>2]|0;w=c[c[r>>2]>>2]|0;c[s>>2]=c[e>>2];e=s+4|0;q=c[n>>2]|0;c[e>>2]=q;if(q|0){h=q+4|0;c[h>>2]=(c[h>>2]|0)+1}La[w&3](r,a,s);s=c[e>>2]|0;do if(s|0){e=s+4|0;a=c[e>>2]|0;c[e>>2]=a+-1;if(a|0)break;Ia[c[(c[s>>2]|0)+8>>2]&255](s);ih(s)}while(0);s=c[n>>2]|0;do if(s|0){n=s+4|0;a=c[n>>2]|0;c[n>>2]=a+-1;if(a|0)break;Ia[c[(c[s>>2]|0)+8>>2]&255](s);ih(s)}while(0);s=c[y>>2]|0;do if(s|0){y=s+4|0;a=c[y>>2]|0;c[y>>2]=a+-1;if(a|0)break;Ia[c[(c[s>>2]|0)+8>>2]&255](s);ih(s)}while(0);s=c[B>>2]|0;if(!s){Ba=b;return}B=s+4|0;a=c[B>>2]|0;c[B>>2]=a+-1;if(a|0){Ba=b;return}Ia[c[(c[s>>2]|0)+8>>2]&255](s);ih(s);Ba=b;return}function eb(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0;d=Ba;Ba=Ba+16|0;if((Ba|0)>=(Ca|0))z(16);e=d;c[a>>2]=b;f=jh(16)|0;c[f+4>>2]=0;c[f+8>>2]=0;c[f>>2]=5064;c[f+12>>2]=b;c[a+4>>2]=f;c[e>>2]=b;c[e+4>>2]=b;mf(a,e);Ba=d;return}function fb(a){a=a|0;var b=0,d=0,e=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0;b=Ba;Ba=Ba+176|0;if((Ba|0)>=(Ca|0))z(176);d=b+96|0;e=b+120|0;g=b+112|0;h=b+104|0;i=b+72|0;j=b+48|0;k=b+24|0;l=b;m=a+28|0;n=a+32|0;o=a;p=o+36|0;do{c[o>>2]=0;o=o+4|0}while((o|0)<(p|0));$g(11536)|0;o=e+8|0;p=o+36|0;do{c[o>>2]=0;o=o+4|0}while((o|0)<(p|0));c[e+44>>2]=2;c[e>>2]=1112014848;c[e+4>>2]=1112014848;f[e+16>>2]=30.0;f[e+20>>2]=30.0;c[e+32>>2]=-1728052993;q=a+4|0;r=c[q>>2]|0;if(r>>>0<(c[a+8>>2]|0)>>>0){o=r;r=e;p=o+48|0;do{c[o>>2]=c[r>>2];o=o+4|0;r=r+4|0}while((o|0)<(p|0));c[q>>2]=(c[q>>2]|0)+48}else kb(a,e);q=jh(192)|0;Sb(q,a);c[e>>2]=q;r=jh(16)|0;c[r+4>>2]=0;c[r+8>>2]=0;c[r>>2]=4004;c[r+12>>2]=q;o=e+4|0;c[o>>2]=r;c[d>>2]=q;c[d+4>>2]=q;Bb(e,d);q=a+12|0;r=c[e>>2]|0;p=c[o>>2]|0;c[e>>2]=0;c[o>>2]=0;c[q>>2]=r;r=a+16|0;s=c[r>>2]|0;c[r>>2]=p;if(s|0?(p=s+4|0,t=c[p>>2]|0,c[p>>2]=t+-1,(t|0)==0):0){Ia[c[(c[s>>2]|0)+8>>2]&255](s);ih(s)}s=c[o>>2]|0;if(s|0?(o=s+4|0,t=c[o>>2]|0,c[o>>2]=t+-1,(t|0)==0):0){Ia[c[(c[s>>2]|0)+8>>2]&255](s);ih(s)}s=c[(c[q>>2]|0)+4>>2]|0;t=c[a>>2]|0;c[t+(s*48|0)+8>>2]=1065353216;c[t+(s*48|0)+12>>2]=1065353216;s=jh(12)|0;c[h>>2]=c[q>>2];t=h+4|0;o=c[r>>2]|0;c[t>>2]=o;if(o|0){r=o+4|0;c[r>>2]=(c[r>>2]|0)+1}r=a;o=i+16|0;c[i>>2]=4780;c[i+4>>2]=r;c[o>>2]=i;ze(s,a,5,h,i);c[g>>2]=0;c[d>>2]=c[g>>2];Ae(e,s,d);d=c[e>>2]|0;c[e>>2]=c[m>>2];c[m>>2]=d;d=e+4|0;e=c[d>>2]|0;m=c[n>>2]|0;c[d>>2]=m;c[n>>2]=e;e=m;if(m|0?(n=e+4|0,d=c[n>>2]|0,c[n>>2]=d+-1,(d|0)==0):0){Ia[c[(c[m>>2]|0)+8>>2]&255](e);ih(e)}e=c[o>>2]|0;if((i|0)!=(e|0)){if(e|0)Ia[c[(c[e>>2]|0)+20>>2]&255](e)}else Ia[c[(c[e>>2]|0)+16>>2]&255](e);e=c[t>>2]|0;if(e|0?(t=e+4|0,i=c[t>>2]|0,c[t>>2]=i+-1,(i|0)==0):0){Ia[c[(c[e>>2]|0)+8>>2]&255](e);ih(e)}e=c[q>>2]|0;q=j+16|0;c[q>>2]=0;i=k+16|0;c[i>>2]=0;t=l+16|0;c[l>>2]=4868;c[l+4>>2]=r;c[t>>2]=l;Jc(e,j,k,l);e=c[t>>2]|0;if((l|0)!=(e|0)){if(e|0)Ia[c[(c[e>>2]|0)+20>>2]&255](e)}else Ia[c[(c[e>>2]|0)+16>>2]&255](e);e=c[i>>2]|0;if((k|0)!=(e|0)){if(e|0)Ia[c[(c[e>>2]|0)+20>>2]&255](e)}else Ia[c[(c[e>>2]|0)+16>>2]&255](e);e=c[q>>2]|0;if((j|0)==(e|0)){Ia[c[(c[e>>2]|0)+16>>2]&255](e);Ba=b;return}if(!e){Ba=b;return}Ia[c[(c[e>>2]|0)+20>>2]&255](e);Ba=b;return}function gb(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0;d=Ba;Ba=Ba+16|0;if((Ba|0)>=(Ca|0))z(16);e=d;c[a>>2]=b;f=jh(16)|0;c[f+4>>2]=0;c[f+8>>2]=0;c[f>>2]=5092;c[f+12>>2]=b;c[a+4>>2]=f;c[e>>2]=b;c[e+4>>2]=b;mf(a,e);Ba=d;return}function hb(a){a=a|0;var b=0,d=0,e=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0;b=Ba;Ba=Ba+128|0;if((Ba|0)>=(Ca|0))z(128);d=b+56|0;e=b+48|0;g=b;h=b+64|0;i=b+112|0;c[a>>2]=0;c[a+4>>2]=0;c[a+8>>2]=0;c[a+12>>2]=0;c[a+16>>2]=0;c[a+20>>2]=0;c[a+24>>2]=0;$g(11561)|0;j=h+8|0;k=j+36|0;do{c[j>>2]=0;j=j+4|0}while((j|0)<(k|0));c[h+44>>2]=2;c[h>>2]=1112014848;c[h+4>>2]=1112014848;f[h+16>>2]=30.0;f[h+20>>2]=30.0;c[h+32>>2]=-1718025985;l=a+4|0;m=c[l>>2]|0;n=a+8|0;if(m>>>0<(c[n>>2]|0)>>>0){j=m;o=h;k=j+48|0;do{c[j>>2]=c[o>>2];j=j+4|0;o=o+4|0}while((j|0)<(k|0));c[l>>2]=(c[l>>2]|0)+48}else kb(a,h);m=jh(192)|0;Sb(m,a);c[h>>2]=m;p=jh(16)|0;c[p+4>>2]=0;c[p+8>>2]=0;c[p>>2]=4004;c[p+12>>2]=m;q=h+4|0;c[q>>2]=p;c[g>>2]=m;c[g+4>>2]=m;Bb(h,g);m=a+12|0;p=c[h>>2]|0;r=c[q>>2]|0;c[h>>2]=0;c[q>>2]=0;c[m>>2]=p;p=a+16|0;s=c[p>>2]|0;c[p>>2]=r;if(s|0?(r=s+4|0,p=c[r>>2]|0,c[r>>2]=p+-1,(p|0)==0):0){Ia[c[(c[s>>2]|0)+8>>2]&255](s);ih(s)}s=c[q>>2]|0;if(s|0?(q=s+4|0,p=c[q>>2]|0,c[q>>2]=p+-1,(p|0)==0):0){Ia[c[(c[s>>2]|0)+8>>2]&255](s);ih(s)}s=c[(c[m>>2]|0)+4>>2]|0;p=c[a>>2]|0;c[p+(s*48|0)+8>>2]=1065353216;c[p+(s*48|0)+12>>2]=1065353216;s=jh(192)|0;Sb(s,a);c[s>>2]=4168;j=g+8|0;k=j+36|0;do{c[j>>2]=0;j=j+4|0}while((j|0)<(k|0));c[g+44>>2]=2;c[g>>2]=0;c[g+4>>2]=0;f[g+16>>2]=0.0;f[g+20>>2]=0.0;c[g+32>>2]=-1429405697;p=c[l>>2]|0;q=c[a>>2]|0;c[q+((c[s+4>>2]|0)*48|0)+36>>2]=(p-q|0)/48|0;if((c[n>>2]|0)==(p|0))qb(a,g);else{j=p;o=g;k=j+48|0;do{c[j>>2]=c[o>>2];j=j+4|0;o=o+4|0}while((j|0)<(k|0));c[l>>2]=(c[l>>2]|0)+48}c[h>>2]=s;l=jh(16)|0;c[l+4>>2]=0;c[l+8>>2]=0;c[l>>2]=4188;c[l+12>>2]=s;o=h+4|0;c[o>>2]=l;c[e>>2]=s;c[e+4>>2]=s;wc(h,e);s=(c[h>>2]|0)+4|0;l=c[s>>2]|0;j=c[a>>2]|0;f[j+(l*48|0)+8>>2]=0.0;f[j+(l*48|0)+12>>2]=0.0;l=c[s>>2]|0;j=c[a>>2]|0;f[j+(l*48|0)+24>>2]=100.0;f[j+(l*48|0)+28>>2]=100.0;l=c[s>>2]|0;s=c[a>>2]|0;c[s+(l*48|0)>>2]=0;c[s+(l*48|0)+4>>2]=0;l=c[h>>2]|0;s=c[l+4>>2]|0;j=c[a>>2]|0;c[j+(s*48|0)+16>>2]=1128792064;c[j+(s*48|0)+20>>2]=1128792064;c[l+8>>2]=1056964608;c[l+12>>2]=1056964608;s=l;l=jh(44)|0;j=c[o>>2]|0;k=(j|0)==0;if(k){c[l>>2]=4912;c[l+4>>2]=s;c[l+8>>2]=0}else{g=j+4|0;c[g>>2]=(c[g>>2]|0)+1;c[l>>2]=4912;c[l+4>>2]=s;c[l+8>>2]=j;c[g>>2]=(c[g>>2]|0)+1}c[l+12>>2]=1;f[l+16>>2]=0.0;f[l+20>>2]=0.0;c[l+24>>2]=1142292480;c[l+28>>2]=1137180672;f[l+32>>2]=1.0e3;f[l+36>>2]=100.0;f[l+40>>2]=1.0000000474974513e-03;c[e>>2]=l;g=jh(16)|0;c[g+4>>2]=0;c[g+8>>2]=0;c[g>>2]=4924;c[g+12>>2]=l;s=e+4|0;c[s>>2]=g;c[d>>2]=l;c[d+4>>2]=l;gf(e,d);if(!k?(k=j+4|0,d=c[k>>2]|0,c[k>>2]=d+-1,(d|0)==0):0){Ia[c[(c[j>>2]|0)+8>>2]&255](j);ih(j)}j=c[h>>2]|0;d=c[e>>2]|0;e=c[s>>2]|0;if(e|0){k=e+4|0;c[k>>2]=(c[k>>2]|0)+1}c[j+168>>2]=d;d=j+172|0;j=c[d>>2]|0;c[d>>2]=e;if(j|0?(e=j+4|0,d=c[e>>2]|0,c[e>>2]=d+-1,(d|0)==0):0){Ia[c[(c[j>>2]|0)+8>>2]&255](j);ih(j)}j=c[m>>2]|0;m=c[c[j>>2]>>2]|0;c[i>>2]=c[h>>2];h=i+4|0;d=c[o>>2]|0;c[h>>2]=d;if(d|0){e=d+4|0;c[e>>2]=(c[e>>2]|0)+1}La[m&3](j,a,i);i=c[h>>2]|0;if(i|0?(h=i+4|0,a=c[h>>2]|0,c[h>>2]=a+-1,(a|0)==0):0){Ia[c[(c[i>>2]|0)+8>>2]&255](i);ih(i)}i=c[s>>2]|0;if(i|0?(s=i+4|0,a=c[s>>2]|0,c[s>>2]=a+-1,(a|0)==0):0){Ia[c[(c[i>>2]|0)+8>>2]&255](i);ih(i)}i=c[o>>2]|0;if(!i){Ba=b;return}o=i+4|0;a=c[o>>2]|0;c[o>>2]=a+-1;if(a|0){Ba=b;return}Ia[c[(c[i>>2]|0)+8>>2]&255](i);ih(i);Ba=b;return}function ib(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0;d=Ba;Ba=Ba+16|0;if((Ba|0)>=(Ca|0))z(16);e=d;c[a>>2]=b;f=jh(16)|0;c[f+4>>2]=0;c[f+8>>2]=0;c[f>>2]=5120;c[f+12>>2]=b;c[a+4>>2]=f;c[e>>2]=b;c[e+4>>2]=b;Lf(a,e);Ba=d;return}function jb(a){a=a|0;$(a|0)|0;Sh()}function kb(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;d=a+4|0;e=c[a>>2]|0;f=(c[d>>2]|0)-e|0;g=(f|0)/48|0;h=g+1|0;if(h>>>0>89478485)uh(a);i=a+8|0;j=((c[i>>2]|0)-e|0)/48|0;k=j<<1;l=j>>>0<44739242?(k>>>0<h>>>0?h:k):89478485;do if(l)if(l>>>0>89478485){k=_(8)|0;nh(k,6107);c[k>>2]=5820;ca(k|0,3768,128)}else{m=jh(l*48|0)|0;break}else m=0;while(0);k=m+(g*48|0)|0;g=m+(l*48|0)|0;l=k;m=b;b=l+48|0;do{c[l>>2]=c[m>>2];l=l+4|0;m=m+4|0}while((l|0)<(b|0));m=k+(((f|0)/-48|0)*48|0)|0;if((f|0)>0)vi(m|0,e|0,f|0)|0;c[a>>2]=m;c[d>>2]=k+48;c[i>>2]=g;if(!e)return;kh(e);return}function lb(b,e){b=b|0;e=e|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0.0,G=0.0,H=0,I=0,J=0,K=0;g=a[e+11>>0]|0;h=g<<24>>24<0;i=h?c[e>>2]|0:e;j=h?c[e+4>>2]|0:g&255;if(j>>>0>3){g=i;h=j;k=j;while(1){l=u(d[g>>0]|d[g+1>>0]<<8|d[g+2>>0]<<16|d[g+3>>0]<<24,1540483477)|0;h=(u(l>>>24^l,1540483477)|0)^(u(h,1540483477)|0);k=k+-4|0;if(k>>>0<=3)break;else g=g+4|0}g=j+-4|0;k=g&-4;m=g-k|0;n=i+(k+4)|0;o=h}else{m=j;n=i;o=j}switch(m|0){case 3:{p=d[n+2>>0]<<16^o;q=7;break}case 2:{p=o;q=7;break}case 1:{r=o;q=8;break}default:s=o}if((q|0)==7){r=d[n+1>>0]<<8^p;q=8}if((q|0)==8)s=u(r^d[n>>0],1540483477)|0;n=u(s>>>13^s,1540483477)|0;s=n>>>15^n;n=b+4|0;r=c[n>>2]|0;p=(r|0)==0;a:do if(!p){o=r+-1|0;m=(o&r|0)==0;if(!m)if(s>>>0<r>>>0)v=s;else v=(s>>>0)%(r>>>0)|0;else v=s&o;h=c[(c[b>>2]|0)+(v<<2)>>2]|0;if((h|0)!=0?(k=c[h>>2]|0,(k|0)!=0):0){h=(j|0)==0;if(m){if(h){m=k;while(1){g=c[m+4>>2]|0;if(!((g|0)==(s|0)|(g&o|0)==(v|0))){w=v;break a}g=a[m+8+11>>0]|0;if(!((g<<24>>24<0?c[m+12>>2]|0:g&255)|0)){x=m;break}m=c[m>>2]|0;if(!m){w=v;break a}}y=x+20|0;return y|0}m=k;b:while(1){g=c[m+4>>2]|0;if(!((g|0)==(s|0)|(g&o|0)==(v|0))){w=v;break a}g=m+8|0;l=a[g+11>>0]|0;z=l<<24>>24<0;A=l&255;do if(((z?c[m+12>>2]|0:A)|0)==(j|0)){l=c[g>>2]|0;if(z)if(!(Yg(l,i,j)|0)){x=m;q=68;break b}else break;if((a[i>>0]|0)==(l&255)<<24>>24){l=g;B=A;C=i;do{B=B+-1|0;l=l+1|0;if(!B){x=m;q=68;break b}C=C+1|0}while((a[l>>0]|0)==(a[C>>0]|0))}}while(0);m=c[m>>2]|0;if(!m){w=v;break a}}if((q|0)==68){y=x+20|0;return y|0}}if(h){m=k;while(1){o=c[m+4>>2]|0;if((o|0)!=(s|0)){if(o>>>0<r>>>0)D=o;else D=(o>>>0)%(r>>>0)|0;if((D|0)!=(v|0)){w=v;break a}}o=a[m+8+11>>0]|0;if(!((o<<24>>24<0?c[m+12>>2]|0:o&255)|0)){x=m;break}m=c[m>>2]|0;if(!m){w=v;break a}}y=x+20|0;return y|0}m=k;c:while(1){h=c[m+4>>2]|0;if((h|0)!=(s|0)){if(h>>>0<r>>>0)E=h;else E=(h>>>0)%(r>>>0)|0;if((E|0)!=(v|0)){w=v;break a}}h=m+8|0;o=a[h+11>>0]|0;A=o<<24>>24<0;g=o&255;do if(((A?c[m+12>>2]|0:g)|0)==(j|0)){o=c[h>>2]|0;if(A)if(!(Yg(o,i,j)|0)){x=m;q=68;break c}else break;if((a[i>>0]|0)==(o&255)<<24>>24){o=h;z=g;C=i;do{z=z+-1|0;o=o+1|0;if(!z){x=m;q=68;break c}C=C+1|0}while((a[o>>0]|0)==(a[C>>0]|0))}}while(0);m=c[m>>2]|0;if(!m){w=v;break a}}if((q|0)==68){y=x+20|0;return y|0}}else w=v}else w=0;while(0);v=jh(24)|0;qh(v+8|0,e);c[v+20>>2]=0;c[v+4>>2]=s;c[v>>2]=0;e=b+12|0;F=+(((c[e>>2]|0)+1|0)>>>0);G=+f[b+16>>2];do if(p|G*+(r>>>0)<F){i=r<<1|(r>>>0<3|(r+-1&r|0)!=0)&1;j=~~+t(+(F/G))>>>0;ob(b,i>>>0<j>>>0?j:i);i=c[n>>2]|0;j=i+-1|0;if(!(j&i)){H=i;I=j&s;break}if(s>>>0<i>>>0){H=i;I=s}else{H=i;I=(s>>>0)%(i>>>0)|0}}else{H=r;I=w}while(0);w=(c[b>>2]|0)+(I<<2)|0;I=c[w>>2]|0;if(!I){r=b+8|0;c[v>>2]=c[r>>2];c[r>>2]=v;c[w>>2]=r;r=c[v>>2]|0;if(r|0){w=c[r+4>>2]|0;r=H+-1|0;if(r&H)if(w>>>0<H>>>0)J=w;else J=(w>>>0)%(H>>>0)|0;else J=w&r;K=(c[b>>2]|0)+(J<<2)|0;q=66}}else{c[v>>2]=c[I>>2];K=I;q=66}if((q|0)==66)c[K>>2]=v;c[e>>2]=(c[e>>2]|0)+1;x=v;y=x+20|0;return y|0}function mb(b,e){b=b|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,v=0,w=0;f=a[e+11>>0]|0;g=f<<24>>24<0;h=g?c[e>>2]|0:e;i=g?c[e+4>>2]|0:f&255;if(i>>>0>3){f=h;e=i;g=i;while(1){j=u(d[f>>0]|d[f+1>>0]<<8|d[f+2>>0]<<16|d[f+3>>0]<<24,1540483477)|0;e=(u(j>>>24^j,1540483477)|0)^(u(e,1540483477)|0);g=g+-4|0;if(g>>>0<=3)break;else f=f+4|0}f=i+-4|0;g=f&-4;k=f-g|0;l=h+(g+4)|0;m=e}else{k=i;l=h;m=i}switch(k|0){case 3:{n=d[l+2>>0]<<16^m;o=7;break}case 2:{n=m;o=7;break}case 1:{p=m;o=8;break}default:q=m}if((o|0)==7){p=d[l+1>>0]<<8^n;o=8}if((o|0)==8)q=u(p^d[l>>0],1540483477)|0;l=u(q>>>13^q,1540483477)|0;q=l>>>15^l;l=c[b+4>>2]|0;if(!l){r=0;return r|0}p=l+-1|0;n=(p&l|0)==0;if(!n)if(q>>>0<l>>>0)s=q;else s=(q>>>0)%(l>>>0)|0;else s=q&p;m=c[(c[b>>2]|0)+(s<<2)>>2]|0;if(!m){r=0;return r|0}b=c[m>>2]|0;if(!b){r=0;return r|0}m=(i|0)==0;if(n){n=b;a:while(1){k=c[n+4>>2]|0;e=(k|0)==(q|0);if(!(e|(k&p|0)==(s|0))){r=0;o=45;break}do if(e?(k=n+8|0,g=a[k+11>>0]|0,f=g<<24>>24<0,j=g&255,((f?c[n+12>>2]|0:j)|0)==(i|0)):0){g=c[k>>2]|0;t=f?g:k;v=g&255;if(f){if(m){r=n;o=45;break a}if(!(Yg(t,h,i)|0)){r=n;o=45;break a}else break}if(m){r=n;o=45;break a}if((a[h>>0]|0)==v<<24>>24){v=k;k=j;j=h;do{k=k+-1|0;v=v+1|0;if(!k){r=n;o=45;break a}j=j+1|0}while((a[v>>0]|0)==(a[j>>0]|0))}}while(0);n=c[n>>2]|0;if(!n){r=0;o=45;break}}if((o|0)==45)return r|0}n=b;b:while(1){b=c[n+4>>2]|0;do if((b|0)==(q|0)){p=n+8|0;e=a[p+11>>0]|0;j=e<<24>>24<0;v=e&255;if(((j?c[n+12>>2]|0:v)|0)==(i|0)){e=c[p>>2]|0;k=j?e:p;t=e&255;if(j){if(m){r=n;o=45;break b}if(!(Yg(k,h,i)|0)){r=n;o=45;break b}else break}if(m){r=n;o=45;break b}if((a[h>>0]|0)==t<<24>>24){t=p;p=v;v=h;do{p=p+-1|0;t=t+1|0;if(!p){r=n;o=45;break b}v=v+1|0}while((a[t>>0]|0)==(a[v>>0]|0))}}}else{if(b>>>0<l>>>0)w=b;else w=(b>>>0)%(l>>>0)|0;if((w|0)!=(s|0)){r=0;o=45;break b}}while(0);n=c[n>>2]|0;if(!n){r=0;o=45;break}}if((o|0)==45)return r|0;return 0}function nb(b,d){b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0;e=b+4|0;f=c[b>>2]|0;g=((c[e>>2]|0)-f|0)/12|0;h=g+1|0;if(h>>>0>357913941)uh(b);i=b+8|0;j=((c[i>>2]|0)-f|0)/12|0;f=j<<1;k=j>>>0<178956970?(f>>>0<h>>>0?h:f):357913941;do if(k)if(k>>>0>357913941){f=_(8)|0;nh(f,6107);c[f>>2]=5820;ca(f|0,3768,128)}else{l=jh(k*12|0)|0;break}else l=0;while(0);f=l+(g*12|0)|0;g=l+(k*12|0)|0;qh(f,d);d=f+12|0;k=c[b>>2]|0;l=c[e>>2]|0;if((l|0)==(k|0)){m=f;n=k;o=k}else{h=l;l=f;do{l=l+-12|0;h=h+-12|0;c[l>>2]=c[h>>2];c[l+4>>2]=c[h+4>>2];c[l+8>>2]=c[h+8>>2];c[h>>2]=0;c[h+4>>2]=0;c[h+8>>2]=0}while((h|0)!=(k|0));m=l;n=c[b>>2]|0;o=c[e>>2]|0}c[b>>2]=m;c[e>>2]=d;c[i>>2]=g;g=n;if((o|0)!=(g|0)){i=o;do{i=i+-12|0;if((a[i+11>>0]|0)<0)kh(c[i>>2]|0)}while((i|0)!=(g|0))}if(!n)return;kh(n);return}function ob(a,b){a=a|0;b=b|0;var d=0,e=0,g=0,h=0;if((b|0)!=1)if(!(b+-1&b))d=b;else d=fh(b)|0;else d=2;b=c[a+4>>2]|0;if(d>>>0>b>>>0){pb(a,d);return}if(d>>>0>=b>>>0)return;e=~~+t(+(+((c[a+12>>2]|0)>>>0)/+f[a+16>>2]))>>>0;if(b>>>0>2&(b+-1&b|0)==0){g=1<<32-(v(e+-1|0)|0);h=e>>>0<2?e:g}else h=fh(e)|0;e=d>>>0<h>>>0?h:d;if(e>>>0>=b>>>0)return;pb(a,e);return}function pb(b,d){b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0;e=b+4|0;if(!d){f=c[b>>2]|0;c[b>>2]=0;if(f|0)kh(f);c[e>>2]=0;return}if(d>>>0>1073741823){f=_(8)|0;nh(f,6107);c[f>>2]=5820;ca(f|0,3768,128)}f=jh(d<<2)|0;g=c[b>>2]|0;c[b>>2]=f;if(g|0)kh(g);c[e>>2]=d;e=0;do{c[(c[b>>2]|0)+(e<<2)>>2]=0;e=e+1|0}while((e|0)!=(d|0));e=b+8|0;g=c[e>>2]|0;if(!g)return;f=c[g+4>>2]|0;h=d+-1|0;i=(h&d|0)==0;if(!i)if(f>>>0<d>>>0)j=f;else j=(f>>>0)%(d>>>0)|0;else j=f&h;c[(c[b>>2]|0)+(j<<2)>>2]=e;e=c[g>>2]|0;if(!e)return;f=j;j=e;e=g;while(1){g=c[j+4>>2]|0;if(!i)if(g>>>0<d>>>0)k=g;else k=(g>>>0)%(d>>>0)|0;else k=g&h;do if((k|0)==(f|0)){l=f;m=j}else{g=(c[b>>2]|0)+(k<<2)|0;if(!(c[g>>2]|0)){c[g>>2]=e;l=k;m=j;break}g=c[j>>2]|0;a:do if(!g)n=j;else{o=j+8|0;p=a[o+11>>0]|0;q=p<<24>>24<0;r=p&255;p=q?c[j+12>>2]|0:r;s=(p|0)==0;if(q){q=j;t=g;while(1){u=t+8|0;v=a[u+11>>0]|0;w=v<<24>>24<0;if((p|0)!=((w?c[t+12>>2]|0:v&255)|0)){n=q;break a}if(!s?Yg(c[o>>2]|0,w?c[u>>2]|0:u,p)|0:0){n=q;break a}u=c[t>>2]|0;if(!u){n=t;break a}else{w=t;t=u;q=w}}}if(s){q=j;t=g;while(1){w=a[t+8+11>>0]|0;if((w<<24>>24<0?c[t+12>>2]|0:w&255)|0){n=q;break a}w=c[t>>2]|0;if(!w){n=t;break a}else{u=t;t=w;q=u}}}q=j;t=g;while(1){s=t+8|0;u=a[s+11>>0]|0;w=u<<24>>24<0;if((p|0)!=((w?c[t+12>>2]|0:u&255)|0)){n=q;break a}u=w?c[s>>2]|0:s;if((a[u>>0]|0)!=(c[o>>2]&255)<<24>>24){n=q;break a}s=o;w=r;v=u;while(1){w=w+-1|0;s=s+1|0;if(!w)break;v=v+1|0;if((a[s>>0]|0)!=(a[v>>0]|0)){n=q;break a}}v=c[t>>2]|0;if(!v){n=t;break}else{s=t;t=v;q=s}}}while(0);c[e>>2]=c[n>>2];c[n>>2]=c[c[(c[b>>2]|0)+(k<<2)>>2]>>2];c[c[(c[b>>2]|0)+(k<<2)>>2]>>2]=j;l=f;m=e}while(0);j=c[m>>2]|0;if(!j)break;else{f=l;e=m}}return}function qb(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;d=a+4|0;e=c[a>>2]|0;f=(c[d>>2]|0)-e|0;g=(f|0)/48|0;h=g+1|0;if(h>>>0>89478485)uh(a);i=a+8|0;j=((c[i>>2]|0)-e|0)/48|0;k=j<<1;l=j>>>0<44739242?(k>>>0<h>>>0?h:k):89478485;do if(l)if(l>>>0>89478485){k=_(8)|0;nh(k,6107);c[k>>2]=5820;ca(k|0,3768,128)}else{m=jh(l*48|0)|0;break}else m=0;while(0);k=m+(g*48|0)|0;g=m+(l*48|0)|0;l=k;m=b;b=l+48|0;do{c[l>>2]=c[m>>2];l=l+4|0;m=m+4|0}while((l|0)<(b|0));m=k+(((f|0)/-48|0)*48|0)|0;if((f|0)>0)vi(m|0,e|0,f|0)|0;c[a>>2]=m;c[d>>2]=k+48;c[i>>2]=g;if(!e)return;kh(e);return}function rb(b,d,e,g,h){b=b|0;d=d|0;e=e|0;g=g|0;h=+h;var i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,A=0,B=0,C=0;i=Ba;Ba=Ba+48|0;if((Ba|0)>=(Ca|0))z(48);j=i;Sb(b,d);c[b>>2]=3908;k=j+8|0;l=k+36|0;do{c[k>>2]=0;k=k+4|0}while((k|0)<(l|0));c[j+44>>2]=6;c[j>>2]=0;c[j+4>>2]=0;f[j+24>>2]=h;c[j+32>>2]=g;if(!(mb(13492,e)|0)){g=c[3371]|0;m=(g-(c[3370]|0)|0)/12|0;n=g;if((c[3372]|0)==(n|0))nb(13480,e);else{qh(n,e);c[3371]=(c[3371]|0)+12}c[(lb(13492,e)|0)>>2]=m}c[j+36>>2]=c[(lb(13492,e)|0)>>2];f[j+16>>2]=+R(((a[e+11>>0]|0)<0?c[e>>2]|0:e)|0,+h);f[j+20>>2]=h;e=d+4|0;m=c[e>>2]|0;n=c[d>>2]|0;g=b+4|0;c[n+((c[g>>2]|0)*48|0)+36>>2]=(m-n|0)/48|0;if((c[d+8>>2]|0)==(m|0)){qb(d,j);o=j+16|0;p=c[g>>2]|0;q=c[d>>2]|0;r=q+(p*48|0)+24|0;s=o;t=s;u=c[t>>2]|0;v=s+4|0;w=v;x=c[w>>2]|0;y=r;A=y;c[A>>2]=u;B=y+4|0;C=B;c[C>>2]=x;Ba=i;return}else{k=m;m=j;l=k+48|0;do{c[k>>2]=c[m>>2];k=k+4|0;m=m+4|0}while((k|0)<(l|0));c[e>>2]=(c[e>>2]|0)+48;o=j+16|0;p=c[g>>2]|0;q=c[d>>2]|0;r=q+(p*48|0)+24|0;s=o;t=s;u=c[t>>2]|0;v=s+4|0;w=v;x=c[w>>2]|0;y=r;A=y;c[A>>2]=u;B=y+4|0;C=B;c[C>>2]=x;Ba=i;return}}function sb(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0;e=c[d>>2]|0;f=c[b>>2]|0;c[f+((c[a+4>>2]|0)*48|0)+36>>2]=c[f+((c[e+4>>2]|0)*48|0)+36>>2];f=a+180|0;b=c[f>>2]|0;if((b|0)==(c[a+184>>2]|0)){Ab(a+176|0,d);return}c[b>>2]=e;e=c[d+4>>2]|0;c[b+4>>2]=e;if(!e)g=b;else{b=e+4|0;c[b>>2]=(c[b>>2]|0)+1;g=c[f>>2]|0}c[f>>2]=g+8;return}function tb(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;f=Ba;Ba=Ba+16|0;if((Ba|0)>=(Ca|0))z(16);g=f+8|0;h=f;i=a+24|0;j=i;k=c[j+4>>2]|0;l=g;c[l>>2]=c[j>>2];c[l+4>>2]=k;k=a+16|0;l=k;j=c[l+4>>2]|0;m=h;c[m>>2]=c[l>>2];c[m+4>>2]=j;zb(a,b,d,e);Ma[c[(c[a>>2]|0)+8>>2]&31](a,b,h,g);g=c[a+176>>2]|0;h=c[a+180>>2]|0;if((g|0)==(h|0)){Ba=f;return}a=g;do{g=c[a>>2]|0;e=c[a+4>>2]|0;if(e){d=e+4|0;c[d>>2]=(c[d>>2]|0)+1;Ma[c[(c[g>>2]|0)+4>>2]&31](g,b,k,i);d=e+4|0;j=c[d>>2]|0;c[d>>2]=j+-1;if(!j){Ia[c[(c[e>>2]|0)+8>>2]&255](e);ih(e)}}else Ma[c[(c[g>>2]|0)+4>>2]&31](g,b,k,i);a=a+8|0}while((a|0)!=(h|0));Ba=f;return}function ub(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0;e=c[b>>2]|0;b=(c[e+((c[a+4>>2]|0)*48|0)+32>>2]|0)+1|0;d=a+16|0;f=c[d+4>>2]|0;g=e+(b*48|0)|0;c[g>>2]=c[d>>2];c[g+4>>2]=f;f=a+24|0;a=c[f+4>>2]|0;g=e+(b*48|0)+16|0;c[g>>2]=c[f>>2];c[g+4>>2]=a;return}function vb(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;f=Ba;Ba=Ba+16|0;if((Ba|0)>=(Ca|0))z(16);g=f+8|0;h=f;i=a+24|0;j=i;k=c[j+4>>2]|0;l=g;c[l>>2]=c[j>>2];c[l+4>>2]=k;k=a+16|0;l=k;j=c[l+4>>2]|0;m=h;c[m>>2]=c[l>>2];c[m+4>>2]=j;zb(a,b,d,e);Ma[c[(c[a>>2]|0)+8>>2]&31](a,b,h,g);g=c[a+176>>2]|0;h=c[a+180>>2]|0;if((g|0)==(h|0)){Ba=f;return}a=g;do{g=c[a>>2]|0;e=c[a+4>>2]|0;if(e){d=e+4|0;c[d>>2]=(c[d>>2]|0)+1;Ma[c[(c[g>>2]|0)+4>>2]&31](g,b,k,i);d=e+4|0;j=c[d>>2]|0;c[d>>2]=j+-1;if(!j){Ia[c[(c[e>>2]|0)+8>>2]&255](e);ih(e)}}else Ma[c[(c[g>>2]|0)+4>>2]&31](g,b,k,i);a=a+8|0}while((a|0)!=(h|0));Ba=f;return}function wb(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0.0,r=0;g=a+4|0;h=c[g>>2]|0;i=c[b>>2]|0;j=(c[i+(h*48|0)+32>>2]|0)+1|0;if(j>>>0>(c[i+(h*48|0)+36>>2]|0)>>>0)return;h=d+4|0;k=e+4|0;l=a+16|0;m=a+24|0;n=a+20|0;o=a+28|0;a=j;j=i;while(1){if(((c[j+(a*48|0)+44>>2]|0)+-2|0)>>>0<5){i=j+(a*48|0)|0;p=j+(a*48|0)+4|0;q=+f[n>>2]+(+f[p>>2]-+f[h>>2])/+f[k>>2]*+f[o>>2];f[i>>2]=+f[l>>2]+(+f[i>>2]-+f[d>>2])/+f[e>>2]*+f[m>>2];f[p>>2]=q;p=c[b>>2]|0;if((c[p+(a*48|0)+44>>2]|0)==6)r=p;else{p=j+(a*48|0)+16|0;i=j+(a*48|0)+20|0;q=+f[i>>2]/+f[k>>2]*+f[o>>2];f[p>>2]=+f[p>>2]/+f[e>>2]*+f[m>>2];f[i>>2]=q;r=c[b>>2]|0}}else r=j;a=a+1|0;if(a>>>0>(c[r+((c[g>>2]|0)*48|0)+36>>2]|0)>>>0)break;else j=r}return}function xb(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0;zb(a,b,d,e);e=c[a+176>>2]|0;d=c[a+180>>2]|0;if((e|0)==(d|0))return;f=a+16|0;g=a+24|0;a=e;do{e=c[a>>2]|0;h=c[a+4>>2]|0;if(h){i=h+4|0;c[i>>2]=(c[i>>2]|0)+1;Ma[c[(c[e>>2]|0)+4>>2]&31](e,b,f,g);i=h+4|0;j=c[i>>2]|0;c[i>>2]=j+-1;if(!j){Ia[c[(c[h>>2]|0)+8>>2]&255](h);ih(h)}}else Ma[c[(c[e>>2]|0)+4>>2]&31](e,b,f,g);a=a+8|0}while((a|0)!=(d|0));return}function yb(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;return}function zb(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var g=0,h=0,i=0,j=0.0,k=0.0,l=0,m=0.0,n=0.0,o=0.0,p=0.0;g=d;h=c[g+4>>2]|0;i=a+40|0;c[i>>2]=c[g>>2];c[i+4>>2]=h;h=e;i=c[h+4>>2]|0;g=a+32|0;c[g>>2]=c[h>>2];c[g+4>>2]=i;i=c[a+4>>2]|0;g=c[b>>2]|0;j=+f[g+(i*48|0)+8>>2]*+f[e>>2]+ +f[g+(i*48|0)+24>>2];b=e+4|0;k=+f[g+(i*48|0)+12>>2]*+f[b>>2]+ +f[g+(i*48|0)+28>>2];f[a+24>>2]=j;h=a+28|0;f[h>>2]=k;l=(c[a+52>>2]|0)==1;do if(l){m=+f[a+48>>2];n=k*m;if(n<j){f[a+24>>2]=n;o=n;p=k;break}else{n=j/m;f[h>>2]=n;o=j;p=n;break}}else{o=j;p=k}while(0);k=+f[g+(i*48|0)+20>>2]+(+f[d+4>>2]+ +f[b>>2]*+f[g+(i*48|0)+4>>2]-+f[a+12>>2]*p);f[a+16>>2]=+f[g+(i*48|0)+16>>2]+(+f[d>>2]+ +f[e>>2]*+f[g+(i*48|0)>>2]-+f[a+8>>2]*o);f[a+20>>2]=k;if(!l)return;k=+f[a+48>>2];j=p*k;if(j<o){f[a+24>>2]=j;return}else{f[h>>2]=o/k;return}}function Ab(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0;d=a+4|0;e=c[d>>2]|0;f=c[a>>2]|0;g=e-f>>3;h=g+1|0;i=f;j=e;if(h>>>0>536870911)uh(a);e=a+8|0;k=(c[e>>2]|0)-f|0;f=k>>2;l=k>>3>>>0<268435455?(f>>>0<h>>>0?h:f):536870911;do if(l)if(l>>>0>536870911){f=_(8)|0;nh(f,6107);c[f>>2]=5820;ca(f|0,3768,128)}else{m=jh(l<<3)|0;break}else m=0;while(0);f=m+(g<<3)|0;h=m+(l<<3)|0;c[f>>2]=c[b>>2];l=c[b+4>>2]|0;c[m+(g<<3)+4>>2]=l;if(!l){n=i;o=j}else{j=l+4|0;c[j>>2]=(c[j>>2]|0)+1;n=c[a>>2]|0;o=c[d>>2]|0}j=f+8|0;l=n;if((o|0)==(n|0)){p=f;q=l;r=o}else{i=g+-1-((o+-8-l|0)>>>3)|0;l=o;o=f;do{f=o;o=o+-8|0;g=l;l=l+-8|0;c[o>>2]=c[l>>2];b=g+-4|0;c[f+-4>>2]=c[b>>2];c[l>>2]=0;c[b>>2]=0}while((l|0)!=(n|0));p=m+(i<<3)|0;q=c[a>>2]|0;r=c[d>>2]|0}c[a>>2]=p;c[d>>2]=j;c[e>>2]=h;h=q;if((r|0)!=(h|0)){e=r;do{r=c[e+-4>>2]|0;e=e+-8|0;if(r|0?(j=r+4|0,d=c[j>>2]|0,c[j>>2]=d+-1,(d|0)==0):0){Ia[c[(c[r>>2]|0)+8>>2]&255](r);ih(r)}}while((e|0)!=(h|0))}if(!q)return;kh(q);return}function Bb(a,b){a=a|0;b=b|0;return}function Cb(a){a=a|0;hh(a);kh(a);return}function Db(a){a=a|0;var b=0;b=c[a+12>>2]|0;if(!b)return;Mb(b);kh(b);return}function Eb(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==6334?a+12|0:0)|0}function Fb(a){a=a|0;kh(a);return}function Gb(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;f=Ba;Ba=Ba+16|0;if((Ba|0)>=(Ca|0))z(16);g=f+8|0;h=f;i=a+24|0;j=i;k=c[j+4>>2]|0;l=g;c[l>>2]=c[j>>2];c[l+4>>2]=k;k=a+16|0;l=k;j=c[l+4>>2]|0;m=h;c[m>>2]=c[l>>2];c[m+4>>2]=j;zb(a,b,d,e);Ma[c[(c[a>>2]|0)+8>>2]&31](a,b,h,g);g=c[a+176>>2]|0;h=c[a+180>>2]|0;if((g|0)==(h|0)){Ba=f;return}a=g;do{g=c[a>>2]|0;e=c[a+4>>2]|0;if(e){d=e+4|0;c[d>>2]=(c[d>>2]|0)+1;Ma[c[(c[g>>2]|0)+4>>2]&31](g,b,k,i);d=e+4|0;j=c[d>>2]|0;c[d>>2]=j+-1;if(!j){Ia[c[(c[e>>2]|0)+8>>2]&255](e);ih(e)}}else Ma[c[(c[g>>2]|0)+4>>2]&31](g,b,k,i);a=a+8|0}while((a|0)!=(h|0));Ba=f;return}function Hb(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0;e=c[b>>2]|0;b=a+16|0;d=c[b+4>>2]|0;f=e+(((c[e+((c[a+4>>2]|0)*48|0)+32>>2]|0)+1|0)*48|0)|0;c[f>>2]=c[b>>2];c[f+4>>2]=d;return}function Ib(a){a=a|0;hh(a);kh(a);return}function Jb(a){a=a|0;var b=0;b=c[a+12>>2]|0;if(!b)return;Mb(b);kh(b);return}function Kb(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==6490?a+12|0:0)|0}function Lb(a){a=a|0;kh(a);return}function Mb(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0;c[a>>2]=3860;b=a+176|0;d=c[b>>2]|0;if(d|0){e=a+180|0;f=c[e>>2]|0;if((f|0)==(d|0))g=d;else{h=f;do{f=c[h+-4>>2]|0;h=h+-8|0;if(f|0?(i=f+4|0,j=c[i>>2]|0,c[i>>2]=j+-1,(j|0)==0):0){Ia[c[(c[f>>2]|0)+8>>2]&255](f);ih(f)}}while((h|0)!=(d|0));g=c[b>>2]|0}c[e>>2]=d;kh(g)}g=c[a+172>>2]|0;if(g|0?(d=g+4|0,e=c[d>>2]|0,c[d>>2]=e+-1,(e|0)==0):0){Ia[c[(c[g>>2]|0)+8>>2]&255](g);ih(g)}g=c[a+160>>2]|0;if((a+144|0)!=(g|0)){if(g|0)Ia[c[(c[g>>2]|0)+20>>2]&255](g)}else Ia[c[(c[g>>2]|0)+16>>2]&255](g);g=c[a+136>>2]|0;if((a+120|0)!=(g|0)){if(g|0)Ia[c[(c[g>>2]|0)+20>>2]&255](g)}else Ia[c[(c[g>>2]|0)+16>>2]&255](g);g=c[a+112>>2]|0;if((a+96|0)!=(g|0)){if(g|0)Ia[c[(c[g>>2]|0)+20>>2]&255](g)}else Ia[c[(c[g>>2]|0)+16>>2]&255](g);g=c[a+80>>2]|0;if((a+64|0)==(g|0)){Ia[c[(c[g>>2]|0)+16>>2]&255](g);return}if(!g)return;Ia[c[(c[g>>2]|0)+20>>2]&255](g);return}function Nb(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0.0,v=0,w=0.0,x=0,y=0,A=0,B=0;e=Ba;Ba=Ba+48|0;if((Ba|0)>=(Ca|0))z(48);g=e;Sb(a,b);c[a>>2]=3956;h=d;i=c[h>>2]|0;j=c[h+4>>2]|0;h=a+188|0;c[h>>2]=i;c[h+4>>2]=j;j=c[d+4>>2]|0;if((i|0)>0){d=g+8|0;h=g+44|0;k=g+4|0;l=g+16|0;m=g+20|0;n=g+24|0;o=g+28|0;p=g+32|0;q=g+36|0;r=b+4|0;s=b+8|0;if((j|0)>0){t=0;do{u=+(t|0)*10.0;v=0;do{w=+(v|0)*10.0;x=d;y=x+36|0;do{c[x>>2]=0;x=x+4|0}while((x|0)<(y|0));c[h>>2]=5;f[g>>2]=u;f[k>>2]=w;c[l>>2]=1090519040;c[m>>2]=1090519040;f[n>>2]=3.0;f[o>>2]=1.0;c[p>>2]=-1;c[q>>2]=1442822912;A=c[r>>2]|0;if(A>>>0<(c[s>>2]|0)>>>0){x=A;A=g;y=x+48|0;do{c[x>>2]=c[A>>2];x=x+4|0;A=A+4|0}while((x|0)<(y|0));c[r>>2]=(c[r>>2]|0)+48}else kb(b,g);v=v+1|0}while((v|0)<(j|0));t=t+1|0}while((t|0)<(i|0));B=r}else B=r}else B=b+4|0;r=c[b>>2]|0;c[r+((c[a+4>>2]|0)*48|0)+36>>2]=(((c[B>>2]|0)-r|0)/48|0)+-1;u=+(i|0);w=+(j|0);f[a+24>>2]=u*10.0;f[a+28>>2]=w*10.0;f[a+48>>2]=u/w;Ba=e;return}function Ob(a){a=a|0;hh(a);kh(a);return}function Pb(a){a=a|0;var b=0;b=c[a+12>>2]|0;if(!b)return;Mb(b);kh(b);return}function Qb(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==6635?a+12|0:0)|0}function Rb(a){a=a|0;kh(a);return}function Sb(d,e){d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0;f=Ba;Ba=Ba+48|0;if((Ba|0)>=(Ca|0))z(48);g=f;c[d>>2]=3860;h=d+4|0;i=e+4|0;j=c[i>>2]|0;k=(j-(c[e>>2]|0)|0)/48|0;l=d+8|0;c[d+80>>2]=0;a[d+88>>0]=0;a[d+89>>0]=0;c[d+112>>2]=0;c[d+136>>2]=0;c[d+160>>2]=0;m=d+168|0;d=l;n=d+48|0;do{c[d>>2]=0;d=d+4|0}while((d|0)<(n|0));b[l+48>>1]=0;c[m>>2]=0;c[m+4>>2]=0;c[m+8>>2]=0;c[m+12>>2]=0;c[m+16>>2]=0;c[h>>2]=k;d=g;n=d+40|0;do{c[d>>2]=0;d=d+4|0}while((d|0)<(n|0));c[g+44>>2]=1;c[g+32>>2]=k;c[g+40>>2]=1;if((c[e+8>>2]|0)>>>0>j>>>0){d=j;j=g;n=d+48|0;do{c[d>>2]=c[j>>2];d=d+4|0;j=j+4|0}while((d|0)<(n|0));j=(c[i>>2]|0)+48|0;c[i>>2]=j;o=j;p=c[e>>2]|0;q=o-p|0;r=(q|0)/48|0;s=r+-1|0;t=c[h>>2]|0;u=p;v=u+(t*48|0)+36|0;c[v>>2]=s;Ba=f;return}else{kb(e,g);o=c[i>>2]|0;p=c[e>>2]|0;q=o-p|0;r=(q|0)/48|0;s=r+-1|0;t=c[h>>2]|0;u=p;v=u+(t*48|0)+36|0;c[v>>2]=s;Ba=f;return}}function Tb(a){a=a|0;hh(a);kh(a);return}function Ub(a){a=a|0;var b=0;b=c[a+12>>2]|0;if(!b)return;Mb(b);kh(b);return}function Vb(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==6762?a+12|0:0)|0}function Wb(a){a=a|0;kh(a);return}function Xb(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0;d=Ba;Ba=Ba+16|0;if((Ba|0)>=(Ca|0))z(16);e=d;if((b|0)==(a|0)){Ba=d;return}f=a+16|0;g=c[f>>2]|0;h=g;i=b+16|0;if((g|0)==(a|0))if((c[i>>2]|0)==(b|0)){Ja[c[(c[g>>2]|0)+12>>2]&31](g,e);j=c[f>>2]|0;Ia[c[(c[j>>2]|0)+16>>2]&255](j);c[f>>2]=0;j=c[i>>2]|0;Ja[c[(c[j>>2]|0)+12>>2]&31](j,a);j=c[i>>2]|0;Ia[c[(c[j>>2]|0)+16>>2]&255](j);c[i>>2]=0;c[f>>2]=a;Ja[c[(c[e>>2]|0)+12>>2]&31](e,b);Ia[c[(c[e>>2]|0)+16>>2]&255](e);c[i>>2]=b;Ba=d;return}else{Ja[c[(c[g>>2]|0)+12>>2]&31](g,b);g=c[f>>2]|0;Ia[c[(c[g>>2]|0)+16>>2]&255](g);g=b+16|0;c[f>>2]=c[g>>2];c[g>>2]=b;Ba=d;return}else{g=c[i>>2]|0;if((b|0)==(g|0)){Ja[c[(c[g>>2]|0)+12>>2]&31](g,a);b=c[i>>2]|0;Ia[c[(c[b>>2]|0)+16>>2]&255](b);c[i>>2]=c[f>>2];c[f>>2]=a;Ba=d;return}else{c[f>>2]=g;c[i>>2]=h;Ba=d;return}}}function Yb(a){a=a|0;kh(a);return}function Zb(a){a=a|0;a=jh(8)|0;c[a>>2]=4032;return a|0}function _b(a,b){a=a|0;b=b|0;c[b>>2]=4032;return}function $b(a){a=a|0;return}function ac(a){a=a|0;kh(a);return}function bc(a,b){a=a|0;b=b|0;f[b+4>>2]=0.0;return}function cc(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==6931?a+4|0:0)|0}function dc(a){a=a|0;return 2944}function ec(a){a=a|0;return}function fc(a){a=a|0;kh(a);return}function gc(a){a=a|0;a=jh(8)|0;c[a>>2]=4076;return a|0}function hc(a,b){a=a|0;b=b|0;c[b>>2]=4076;return}function ic(a){a=a|0;return}function jc(a){a=a|0;kh(a);return}function kc(a,b){a=a|0;b=b|0;f[b>>2]=0.0;return}function lc(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==7058?a+4|0:0)|0}function mc(a){a=a|0;return 2968}function nc(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;f=Ba;Ba=Ba+16|0;if((Ba|0)>=(Ca|0))z(16);g=f+8|0;h=f;i=a+24|0;j=i;k=c[j+4>>2]|0;l=g;c[l>>2]=c[j>>2];c[l+4>>2]=k;k=a+16|0;l=k;j=c[l+4>>2]|0;m=h;c[m>>2]=c[l>>2];c[m+4>>2]=j;zb(a,b,d,e);Ma[c[(c[a>>2]|0)+8>>2]&31](a,b,h,g);g=c[a+176>>2]|0;h=c[a+180>>2]|0;if((g|0)==(h|0)){Ba=f;return}a=g;do{g=c[a>>2]|0;e=c[a+4>>2]|0;if(e){d=e+4|0;c[d>>2]=(c[d>>2]|0)+1;Ma[c[(c[g>>2]|0)+4>>2]&31](g,b,k,i);d=e+4|0;j=c[d>>2]|0;c[d>>2]=j+-1;if(!j){Ia[c[(c[e>>2]|0)+8>>2]&255](e);ih(e)}}else Ma[c[(c[g>>2]|0)+4>>2]&31](g,b,k,i);a=a+8|0}while((a|0)!=(h|0));Ba=f;return}function oc(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var g=0,h=0,i=0.0;e=c[b>>2]|0;b=(c[e+((c[a+4>>2]|0)*48|0)+32>>2]|0)+1|0;d=a+16|0;g=c[d+4>>2]|0;h=e+(b*48|0)|0;c[h>>2]=c[d>>2];c[h+4>>2]=g;i=+f[a+28>>2]*.5;f[e+(b*48|0)+16>>2]=+f[a+24>>2]*.5;f[e+(b*48|0)+20>>2]=i;return}function pc(a,b){a=a|0;b=b|0;return}function qc(a){a=a|0;hh(a);kh(a);return}function rc(a){a=a|0;var b=0;b=c[a+12>>2]|0;if(!b)return;Mb(b);kh(b);return}function sc(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==7220?a+12|0:0)|0}function tc(a){a=a|0;kh(a);return}function uc(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;f=Ba;Ba=Ba+16|0;if((Ba|0)>=(Ca|0))z(16);g=f+8|0;h=f;i=a+24|0;j=i;k=c[j+4>>2]|0;l=g;c[l>>2]=c[j>>2];c[l+4>>2]=k;k=a+16|0;l=k;j=c[l+4>>2]|0;m=h;c[m>>2]=c[l>>2];c[m+4>>2]=j;zb(a,b,d,e);Ma[c[(c[a>>2]|0)+8>>2]&31](a,b,h,g);g=c[a+176>>2]|0;h=c[a+180>>2]|0;if((g|0)==(h|0)){Ba=f;return}a=g;do{g=c[a>>2]|0;e=c[a+4>>2]|0;if(e){d=e+4|0;c[d>>2]=(c[d>>2]|0)+1;Ma[c[(c[g>>2]|0)+4>>2]&31](g,b,k,i);d=e+4|0;j=c[d>>2]|0;c[d>>2]=j+-1;if(!j){Ia[c[(c[e>>2]|0)+8>>2]&255](e);ih(e)}}else Ma[c[(c[g>>2]|0)+4>>2]&31](g,b,k,i);a=a+8|0}while((a|0)!=(h|0));Ba=f;return}function vc(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var g=0,h=0,i=0.0;e=c[b>>2]|0;b=(c[e+((c[a+4>>2]|0)*48|0)+32>>2]|0)+1|0;d=a+16|0;g=c[d+4>>2]|0;h=e+(b*48|0)|0;c[h>>2]=c[d>>2];c[h+4>>2]=g;i=+f[a+28>>2]*.5;f[e+(b*48|0)+16>>2]=+f[a+24>>2]*.5;f[e+(b*48|0)+20>>2]=i;return}function wc(a,b){a=a|0;b=b|0;return}function xc(a){a=a|0;hh(a);kh(a);return}function yc(a){a=a|0;var b=0;b=c[a+12>>2]|0;if(!b)return;Mb(b);kh(b);return}function zc(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==7391?a+12|0:0)|0}function Ac(a){a=a|0;kh(a);return}function Bc(a){a=a|0;kh(a);return}function Cc(a){a=a|0;a=jh(8)|0;c[a>>2]=4216;return a|0}function Dc(a,b){a=a|0;b=b|0;c[b>>2]=4216;return}function Ec(a){a=a|0;return}function Fc(a){a=a|0;kh(a);return}function Gc(a,b){a=a|0;b=b|0;var c=0,d=0.0,e=0,h=0.0,i=0.0,j=0.0;a=Ba;Ba=Ba+16|0;if((Ba|0)>=(Ca|0))z(16);c=a;d=+f[b>>2];e=b+4|0;h=+f[e>>2];i=+s(+(d*d+h*h));j=d*150.0/i;f[b>>2]=j;d=h*150.0/i;f[e>>2]=d;g[c>>3]=j;g[c+8>>3]=d;Zg(7530,c)|0;Ba=a;return}function Hc(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==7563?a+4|0:0)|0}function Ic(a){a=a|0;return 3056}function Jc(b,d,e,f){b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0;g=Ba;Ba=Ba+32|0;if((Ba|0)>=(Ca|0))z(32);h=g;i=b+96|0;j=c[d+16>>2]|0;do if(j)if((d|0)==(j|0)){k=h+16|0;c[k>>2]=h;Ja[c[(c[j>>2]|0)+12>>2]&31](j,h);l=k;break}else{k=h+16|0;c[k>>2]=Ea[c[(c[j>>2]|0)+8>>2]&63](j)|0;l=k;break}else{k=h+16|0;c[k>>2]=0;l=k}while(0);Lc(h,i);i=c[l>>2]|0;if((h|0)!=(i|0)){if(i|0)Ia[c[(c[i>>2]|0)+20>>2]&255](i)}else Ia[c[(c[i>>2]|0)+16>>2]&255](i);i=b+120|0;l=c[e+16>>2]|0;do if(l)if((e|0)==(l|0)){j=h+16|0;c[j>>2]=h;Ja[c[(c[l>>2]|0)+12>>2]&31](l,h);m=j;break}else{j=h+16|0;c[j>>2]=Ea[c[(c[l>>2]|0)+8>>2]&63](l)|0;m=j;break}else{j=h+16|0;c[j>>2]=0;m=j}while(0);Lc(h,i);i=c[m>>2]|0;if((h|0)!=(i|0)){if(i|0)Ia[c[(c[i>>2]|0)+20>>2]&255](i)}else Ia[c[(c[i>>2]|0)+16>>2]&255](i);i=b+144|0;m=c[f+16>>2]|0;do if(m)if((f|0)==(m|0)){l=h+16|0;c[l>>2]=h;Ja[c[(c[m>>2]|0)+12>>2]&31](m,h);n=l;break}else{l=h+16|0;c[l>>2]=Ea[c[(c[m>>2]|0)+8>>2]&63](m)|0;n=l;break}else{l=h+16|0;c[l>>2]=0;n=l}while(0);Mc(h,i);i=c[n>>2]|0;if((h|0)==(i|0)){Ia[c[(c[i>>2]|0)+16>>2]&255](i);o=b+88|0;a[o>>0]=1;Ba=g;return}if(!i){o=b+88|0;a[o>>0]=1;Ba=g;return}Ia[c[(c[i>>2]|0)+20>>2]&255](i);o=b+88|0;a[o>>0]=1;Ba=g;return}function Kc(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0;e=Ba;Ba=Ba+208|0;if((Ba|0)>=(Ca|0))z(208);g=e+120|0;h=e+72|0;i=e+152|0;j=e+144|0;k=e+48|0;l=e+24|0;m=e;n=e+136|0;o=e+128|0;Sb(a,b);c[a>>2]=4572;p=a+192|0;q=d+16|0;r=c[q>>2]|0;do if(r)if((d|0)==(r|0)){c[a+208>>2]=p;s=c[q>>2]|0;Ja[c[(c[s>>2]|0)+12>>2]&31](s,p);break}else{c[a+208>>2]=Ea[c[(c[r>>2]|0)+8>>2]&63](r)|0;break}else c[a+208>>2]=0;while(0);r=jh(192)|0;Sb(r,b);c[r>>2]=4392;p=i+8|0;q=p+36|0;do{c[p>>2]=0;p=p+4|0}while((p|0)<(q|0));c[i+44>>2]=5;c[i>>2]=0;c[i+4>>2]=0;c[i+16>>2]=0;c[i+20>>2]=0;f[i+24>>2]=10.0;f[i+28>>2]=2.0;c[i+32>>2]=-1431655681;c[i+36>>2]=-1;d=b+4|0;s=c[d>>2]|0;t=c[b>>2]|0;c[t+((c[r+4>>2]|0)*48|0)+36>>2]=(s-t|0)/48|0;t=b+8|0;if((c[t>>2]|0)==(s|0))qb(b,i);else{p=s;u=i;q=p+48|0;do{c[p>>2]=c[u>>2];p=p+4|0;u=u+4|0}while((p|0)<(q|0));c[d>>2]=(c[d>>2]|0)+48}c[j>>2]=r;s=jh(16)|0;c[s+4>>2]=0;c[s+8>>2]=0;c[s>>2]=4412;c[s+12>>2]=r;v=j+4|0;c[v>>2]=s;c[h>>2]=r;c[h+4>>2]=r;qd(j,h);r=c[(c[j>>2]|0)+4>>2]|0;s=c[b>>2]|0;c[s+(r*48|0)>>2]=0;c[s+(r*48|0)+4>>2]=0;r=c[(c[j>>2]|0)+4>>2]|0;s=c[b>>2]|0;c[s+(r*48|0)+8>>2]=1065353216;c[s+(r*48|0)+12>>2]=1065353216;r=jh(192)|0;Sb(r,b);c[r>>2]=4392;p=h+8|0;q=p+36|0;do{c[p>>2]=0;p=p+4|0}while((p|0)<(q|0));c[h+44>>2]=5;c[h>>2]=0;c[h+4>>2]=0;c[h+16>>2]=0;c[h+20>>2]=0;f[h+24>>2]=10.0;f[h+28>>2]=2.0;c[h+32>>2]=-1431655681;c[h+36>>2]=-1;s=c[d>>2]|0;w=c[b>>2]|0;c[w+((c[r+4>>2]|0)*48|0)+36>>2]=(s-w|0)/48|0;if((c[t>>2]|0)==(s|0))qb(b,h);else{p=s;u=h;q=p+48|0;do{c[p>>2]=c[u>>2];p=p+4|0;u=u+4|0}while((p|0)<(q|0));c[d>>2]=(c[d>>2]|0)+48}c[i>>2]=r;d=jh(16)|0;c[d+4>>2]=0;c[d+8>>2]=0;c[d>>2]=4412;c[d+12>>2]=r;u=i+4|0;c[u>>2]=d;c[g>>2]=r;c[g+4>>2]=r;qd(i,g);g=c[(c[i>>2]|0)+4>>2]|0;r=c[b>>2]|0;c[r+(g*48|0)>>2]=0;c[r+(g*48|0)+4>>2]=0;g=c[i>>2]|0;r=g+4|0;d=c[r>>2]|0;p=c[b>>2]|0;c[p+(d*48|0)+8>>2]=1065353216;c[p+(d*48|0)+12>>2]=1065353216;d=c[r>>2]|0;r=c[b>>2]|0;c[r+(d*48|0)+16>>2]=1084227584;c[r+(d*48|0)+20>>2]=1084227584;d=b;r=g;g=c[u>>2]|0;if(!g)x=0;else{p=g+4|0;c[p>>2]=(c[p>>2]|0)+1;x=c[u>>2]|0}p=k+16|0;c[k>>2]=4592;c[k+4>>2]=d;c[k+8>>2]=r;c[k+12>>2]=g;c[p>>2]=k;if(x|0){g=x+4|0;c[g>>2]=(c[g>>2]|0)+1}g=l+16|0;c[l>>2]=4636;c[l+4>>2]=d;c[l+8>>2]=r;c[l+12>>2]=x;c[g>>2]=l;x=m+16|0;c[m>>2]=4680;c[m+4>>2]=a;c[x>>2]=m;Jc(a,k,l,m);r=c[x>>2]|0;if((m|0)!=(r|0)){if(r|0)Ia[c[(c[r>>2]|0)+20>>2]&255](r)}else Ia[c[(c[r>>2]|0)+16>>2]&255](r);r=c[g>>2]|0;if((l|0)!=(r|0)){if(r|0)Ia[c[(c[r>>2]|0)+20>>2]&255](r)}else Ia[c[(c[r>>2]|0)+16>>2]&255](r);r=c[p>>2]|0;if((k|0)!=(r|0)){if(r|0)Ia[c[(c[r>>2]|0)+20>>2]&255](r)}else Ia[c[(c[r>>2]|0)+16>>2]&255](r);r=c[c[a>>2]>>2]|0;c[n>>2]=c[j>>2];j=n+4|0;k=c[v>>2]|0;c[j>>2]=k;if(k|0){p=k+4|0;c[p>>2]=(c[p>>2]|0)+1}La[r&3](a,b,n);n=c[j>>2]|0;if(n|0?(j=n+4|0,r=c[j>>2]|0,c[j>>2]=r+-1,(r|0)==0):0){Ia[c[(c[n>>2]|0)+8>>2]&255](n);ih(n)}n=c[c[a>>2]>>2]|0;c[o>>2]=c[i>>2];i=o+4|0;r=c[u>>2]|0;c[i>>2]=r;if(r|0){j=r+4|0;c[j>>2]=(c[j>>2]|0)+1}La[n&3](a,b,o);o=c[i>>2]|0;if(o|0?(i=o+4|0,b=c[i>>2]|0,c[i>>2]=b+-1,(b|0)==0):0){Ia[c[(c[o>>2]|0)+8>>2]&255](o);ih(o)}o=c[u>>2]|0;if(o|0?(u=o+4|0,b=c[u>>2]|0,c[u>>2]=b+-1,(b|0)==0):0){Ia[c[(c[o>>2]|0)+8>>2]&255](o);ih(o)}o=c[v>>2]|0;if(!o){Ba=e;return}v=o+4|0;b=c[v>>2]|0;c[v>>2]=b+-1;if(b|0){Ba=e;return}Ia[c[(c[o>>2]|0)+8>>2]&255](o);ih(o);Ba=e;return}function Lc(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0;d=Ba;Ba=Ba+16|0;if((Ba|0)>=(Ca|0))z(16);e=d;if((b|0)==(a|0)){Ba=d;return}f=a+16|0;g=c[f>>2]|0;h=g;i=b+16|0;if((g|0)==(a|0))if((c[i>>2]|0)==(b|0)){Ja[c[(c[g>>2]|0)+12>>2]&31](g,e);j=c[f>>2]|0;Ia[c[(c[j>>2]|0)+16>>2]&255](j);c[f>>2]=0;j=c[i>>2]|0;Ja[c[(c[j>>2]|0)+12>>2]&31](j,a);j=c[i>>2]|0;Ia[c[(c[j>>2]|0)+16>>2]&255](j);c[i>>2]=0;c[f>>2]=a;Ja[c[(c[e>>2]|0)+12>>2]&31](e,b);Ia[c[(c[e>>2]|0)+16>>2]&255](e);c[i>>2]=b;Ba=d;return}else{Ja[c[(c[g>>2]|0)+12>>2]&31](g,b);g=c[f>>2]|0;Ia[c[(c[g>>2]|0)+16>>2]&255](g);g=b+16|0;c[f>>2]=c[g>>2];c[g>>2]=b;Ba=d;return}else{g=c[i>>2]|0;if((b|0)==(g|0)){Ja[c[(c[g>>2]|0)+12>>2]&31](g,a);b=c[i>>2]|0;Ia[c[(c[b>>2]|0)+16>>2]&255](b);c[i>>2]=c[f>>2];c[f>>2]=a;Ba=d;return}else{c[f>>2]=g;c[i>>2]=h;Ba=d;return}}}function Mc(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0;d=Ba;Ba=Ba+16|0;if((Ba|0)>=(Ca|0))z(16);e=d;if((b|0)==(a|0)){Ba=d;return}f=a+16|0;g=c[f>>2]|0;h=g;i=b+16|0;if((g|0)==(a|0))if((c[i>>2]|0)==(b|0)){Ja[c[(c[g>>2]|0)+12>>2]&31](g,e);j=c[f>>2]|0;Ia[c[(c[j>>2]|0)+16>>2]&255](j);c[f>>2]=0;j=c[i>>2]|0;Ja[c[(c[j>>2]|0)+12>>2]&31](j,a);j=c[i>>2]|0;Ia[c[(c[j>>2]|0)+16>>2]&255](j);c[i>>2]=0;c[f>>2]=a;Ja[c[(c[e>>2]|0)+12>>2]&31](e,b);Ia[c[(c[e>>2]|0)+16>>2]&255](e);c[i>>2]=b;Ba=d;return}else{Ja[c[(c[g>>2]|0)+12>>2]&31](g,b);g=c[f>>2]|0;Ia[c[(c[g>>2]|0)+16>>2]&255](g);g=b+16|0;c[f>>2]=c[g>>2];c[g>>2]=b;Ba=d;return}else{g=c[i>>2]|0;if((b|0)==(g|0)){Ja[c[(c[g>>2]|0)+12>>2]&31](g,a);b=c[i>>2]|0;Ia[c[(c[b>>2]|0)+16>>2]&255](b);c[i>>2]=c[f>>2];c[f>>2]=a;Ba=d;return}else{c[f>>2]=g;c[i>>2]=h;Ba=d;return}}}function Nc(a){a=a|0;var b=0,d=0;c[a>>2]=4260;b=c[a+12>>2]|0;if(!b)return;a=b+4|0;d=c[a>>2]|0;c[a>>2]=d+-1;if(d|0)return;Ia[c[(c[b>>2]|0)+8>>2]&255](b);ih(b);return}function Oc(a){a=a|0;var b=0,d=0,e=0;c[a>>2]=4260;b=c[a+12>>2]|0;if(!b){kh(a);return}d=b+4|0;e=c[d>>2]|0;c[d>>2]=e+-1;if(e|0){kh(a);return}Ia[c[(c[b>>2]|0)+8>>2]&255](b);ih(b);kh(a);return}function Pc(a){a=a|0;var b=0,d=0;b=jh(16)|0;c[b>>2]=4260;c[b+4>>2]=c[a+4>>2];c[b+8>>2]=c[a+8>>2];d=c[a+12>>2]|0;c[b+12>>2]=d;if(!d)return b|0;a=d+4|0;c[a>>2]=(c[a>>2]|0)+1;return b|0}function Qc(a,b){a=a|0;b=b|0;var d=0;c[b>>2]=4260;c[b+4>>2]=c[a+4>>2];c[b+8>>2]=c[a+8>>2];d=c[a+12>>2]|0;c[b+12>>2]=d;if(!d)return;b=d+4|0;c[b>>2]=(c[b>>2]|0)+1;return}function Rc(a){a=a|0;var b=0,d=0;b=c[a+12>>2]|0;if(!b)return;a=b+4|0;d=c[a>>2]|0;c[a>>2]=d+-1;if(d|0)return;Ia[c[(c[b>>2]|0)+8>>2]&255](b);ih(b);return}function Sc(a){a=a|0;var b=0,d=0,e=0;b=c[a+12>>2]|0;if(!b){kh(a);return}d=b+4|0;e=c[d>>2]|0;c[d>>2]=e+-1;if(e|0){kh(a);return}Ia[c[(c[b>>2]|0)+8>>2]&255](b);ih(b);kh(a);return}function Tc(a){a=a|0;var b=0,d=0,e=0,g=0;b=c[a+4>>2]|0;$g(11595)|0;d=a+8|0;a=(c[d>>2]|0)+4|0;e=c[a>>2]|0;g=c[b>>2]|0;f[g+(e*48|0)+8>>2]=0.0;f[g+(e*48|0)+12>>2]=0.0;e=c[a>>2]|0;a=c[b>>2]|0;f[a+(e*48|0)+24>>2]=150.0;f[a+(e*48|0)+28>>2]=150.0;e=c[d>>2]|0;Ma[c[(c[e>>2]|0)+4>>2]&31](e,b,e+40|0,e+32|0);return}function Uc(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==7714?a+4|0:0)|0}function Vc(a){a=a|0;return 3088}function Wc(a){a=a|0;return}function Xc(a){a=a|0;var b=0,d=0;c[a>>2]=4304;b=c[a+12>>2]|0;if(!b)return;a=b+4|0;d=c[a>>2]|0;c[a>>2]=d+-1;if(d|0)return;Ia[c[(c[b>>2]|0)+8>>2]&255](b);ih(b);return}function Yc(a){a=a|0;var b=0,d=0,e=0;c[a>>2]=4304;b=c[a+12>>2]|0;if(!b){kh(a);return}d=b+4|0;e=c[d>>2]|0;c[d>>2]=e+-1;if(e|0){kh(a);return}Ia[c[(c[b>>2]|0)+8>>2]&255](b);ih(b);kh(a);return}function Zc(a){a=a|0;var b=0,d=0;b=jh(16)|0;c[b>>2]=4304;c[b+4>>2]=c[a+4>>2];c[b+8>>2]=c[a+8>>2];d=c[a+12>>2]|0;c[b+12>>2]=d;if(!d)return b|0;a=d+4|0;c[a>>2]=(c[a>>2]|0)+1;return b|0}function _c(a,b){a=a|0;b=b|0;var d=0;c[b>>2]=4304;c[b+4>>2]=c[a+4>>2];c[b+8>>2]=c[a+8>>2];d=c[a+12>>2]|0;c[b+12>>2]=d;if(!d)return;b=d+4|0;c[b>>2]=(c[b>>2]|0)+1;return}function $c(a){a=a|0;var b=0,d=0;b=c[a+12>>2]|0;if(!b)return;a=b+4|0;d=c[a>>2]|0;c[a>>2]=d+-1;if(d|0)return;Ia[c[(c[b>>2]|0)+8>>2]&255](b);ih(b);return}function ad(a){a=a|0;var b=0,d=0,e=0;b=c[a+12>>2]|0;if(!b){kh(a);return}d=b+4|0;e=c[d>>2]|0;c[d>>2]=e+-1;if(e|0){kh(a);return}Ia[c[(c[b>>2]|0)+8>>2]&255](b);ih(b);kh(a);return}function bd(a){a=a|0;var b=0,d=0,e=0,g=0;b=c[a+4>>2]|0;$g(11606)|0;d=a+8|0;a=(c[d>>2]|0)+4|0;e=c[a>>2]|0;g=c[b>>2]|0;f[g+(e*48|0)+8>>2]=0.0;f[g+(e*48|0)+12>>2]=0.0;e=c[a>>2]|0;a=c[b>>2]|0;f[a+(e*48|0)+24>>2]=100.0;f[a+(e*48|0)+28>>2]=100.0;e=c[d>>2]|0;Ma[c[(c[e>>2]|0)+4>>2]&31](e,b,e+40|0,e+32|0);return}function cd(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==7823?a+4|0:0)|0}function dd(a){a=a|0;return 3112}function ed(a){a=a|0;var b=0,d=0;c[a>>2]=4348;b=c[a+12>>2]|0;if(!b)return;a=b+4|0;d=c[a>>2]|0;c[a>>2]=d+-1;if(d|0)return;Ia[c[(c[b>>2]|0)+8>>2]&255](b);ih(b);return}function fd(a){a=a|0;var b=0,d=0,e=0;c[a>>2]=4348;b=c[a+12>>2]|0;if(!b){kh(a);return}d=b+4|0;e=c[d>>2]|0;c[d>>2]=e+-1;if(e|0){kh(a);return}Ia[c[(c[b>>2]|0)+8>>2]&255](b);ih(b);kh(a);return}function gd(a){a=a|0;var b=0,d=0;b=jh(16)|0;c[b>>2]=4348;c[b+4>>2]=c[a+4>>2];c[b+8>>2]=c[a+8>>2];d=c[a+12>>2]|0;c[b+12>>2]=d;if(!d)return b|0;a=d+4|0;c[a>>2]=(c[a>>2]|0)+1;return b|0}function hd(a,b){a=a|0;b=b|0;var d=0;c[b>>2]=4348;c[b+4>>2]=c[a+4>>2];c[b+8>>2]=c[a+8>>2];d=c[a+12>>2]|0;c[b+12>>2]=d;if(!d)return;b=d+4|0;c[b>>2]=(c[b>>2]|0)+1;return}function id(a){a=a|0;var b=0,d=0;b=c[a+12>>2]|0;if(!b)return;a=b+4|0;d=c[a>>2]|0;c[a>>2]=d+-1;if(d|0)return;Ia[c[(c[b>>2]|0)+8>>2]&255](b);ih(b);return}function jd(a){a=a|0;var b=0,d=0,e=0;b=c[a+12>>2]|0;if(!b){kh(a);return}d=b+4|0;e=c[d>>2]|0;c[d>>2]=e+-1;if(e|0){kh(a);return}Ia[c[(c[b>>2]|0)+8>>2]&255](b);ih(b);kh(a);return}function kd(a,b){a=a|0;b=b|0;var d=0;b=c[a+4>>2]|0;$g(11588)|0;d=c[a+8>>2]|0;a=c[b>>2]|0;c[a+(((c[a+((c[d+4>>2]|0)*48|0)+32>>2]|0)+1|0)*48|0)+32>>2]=696469503;Ma[c[(c[d>>2]|0)+4>>2]&31](d,b,d+40|0,d+32|0);return}function ld(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==7986?a+4|0:0)|0}function md(a){a=a|0;return 3144}function nd(a){a=a|0;return}function od(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;f=Ba;Ba=Ba+16|0;if((Ba|0)>=(Ca|0))z(16);g=f+8|0;h=f;i=a+24|0;j=i;k=c[j+4>>2]|0;l=g;c[l>>2]=c[j>>2];c[l+4>>2]=k;k=a+16|0;l=k;j=c[l+4>>2]|0;m=h;c[m>>2]=c[l>>2];c[m+4>>2]=j;zb(a,b,d,e);Ma[c[(c[a>>2]|0)+8>>2]&31](a,b,h,g);g=c[a+176>>2]|0;h=c[a+180>>2]|0;if((g|0)==(h|0)){Ba=f;return}a=g;do{g=c[a>>2]|0;e=c[a+4>>2]|0;if(e){d=e+4|0;c[d>>2]=(c[d>>2]|0)+1;Ma[c[(c[g>>2]|0)+4>>2]&31](g,b,k,i);d=e+4|0;j=c[d>>2]|0;c[d>>2]=j+-1;if(!j){Ia[c[(c[e>>2]|0)+8>>2]&255](e);ih(e)}}else Ma[c[(c[g>>2]|0)+4>>2]&31](g,b,k,i);a=a+8|0}while((a|0)!=(h|0));Ba=f;return}function pd(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0;e=c[b>>2]|0;b=(c[e+((c[a+4>>2]|0)*48|0)+32>>2]|0)+1|0;d=a+16|0;f=c[d+4>>2]|0;g=e+(b*48|0)|0;c[g>>2]=c[d>>2];c[g+4>>2]=f;f=a+24|0;a=c[f+4>>2]|0;g=e+(b*48|0)+16|0;c[g>>2]=c[f>>2];c[g+4>>2]=a;return}function qd(a,b){a=a|0;b=b|0;return}function rd(a){a=a|0;hh(a);kh(a);return}function sd(a){a=a|0;var b=0;b=c[a+12>>2]|0;if(!b)return;Mb(b);kh(b);return}function td(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==8156?a+12|0:0)|0}function ud(a){a=a|0;kh(a);return}function vd(a){a=a|0;var b=0,d=0;c[a>>2]=4440;b=c[a+12>>2]|0;if(!b)return;a=b+4|0;d=c[a>>2]|0;c[a>>2]=d+-1;if(d|0)return;Ia[c[(c[b>>2]|0)+8>>2]&255](b);ih(b);return}function wd(a){a=a|0;var b=0,d=0,e=0;c[a>>2]=4440;b=c[a+12>>2]|0;if(!b){kh(a);return}d=b+4|0;e=c[d>>2]|0;c[d>>2]=e+-1;if(e|0){kh(a);return}Ia[c[(c[b>>2]|0)+8>>2]&255](b);ih(b);kh(a);return}function xd(a){a=a|0;var b=0,d=0;b=jh(16)|0;c[b>>2]=4440;c[b+4>>2]=c[a+4>>2];c[b+8>>2]=c[a+8>>2];d=c[a+12>>2]|0;c[b+12>>2]=d;if(!d)return b|0;a=d+4|0;c[a>>2]=(c[a>>2]|0)+1;return b|0}function yd(a,b){a=a|0;b=b|0;var d=0;c[b>>2]=4440;c[b+4>>2]=c[a+4>>2];c[b+8>>2]=c[a+8>>2];d=c[a+12>>2]|0;c[b+12>>2]=d;if(!d)return;b=d+4|0;c[b>>2]=(c[b>>2]|0)+1;return}function zd(a){a=a|0;var b=0,d=0;b=c[a+12>>2]|0;if(!b)return;a=b+4|0;d=c[a>>2]|0;c[a>>2]=d+-1;if(d|0)return;Ia[c[(c[b>>2]|0)+8>>2]&255](b);ih(b);return}function Ad(a){a=a|0;var b=0,d=0,e=0;b=c[a+12>>2]|0;if(!b){kh(a);return}d=b+4|0;e=c[d>>2]|0;c[d>>2]=e+-1;if(e|0){kh(a);return}Ia[c[(c[b>>2]|0)+8>>2]&255](b);ih(b);kh(a);return}function Bd(a){a=a|0;var b=0,d=0,e=0;b=c[a+4>>2]|0;$g(11595)|0;d=a+8|0;a=c[(c[d>>2]|0)+4>>2]|0;e=c[b>>2]|0;c[e+(a*48|0)+24>>2]=1132068864;c[e+(a*48|0)+28>>2]=1117782016;a=c[d>>2]|0;Ma[c[(c[a>>2]|0)+4>>2]&31](a,b,a+40|0,a+32|0);return}function Cd(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==8291?a+4|0:0)|0}function Dd(a){a=a|0;return 3200}function Ed(a){a=a|0;var b=0,d=0;c[a>>2]=4484;b=c[a+12>>2]|0;if(!b)return;a=b+4|0;d=c[a>>2]|0;c[a>>2]=d+-1;if(d|0)return;Ia[c[(c[b>>2]|0)+8>>2]&255](b);ih(b);return}function Fd(a){a=a|0;var b=0,d=0,e=0;c[a>>2]=4484;b=c[a+12>>2]|0;if(!b){kh(a);return}d=b+4|0;e=c[d>>2]|0;c[d>>2]=e+-1;if(e|0){kh(a);return}Ia[c[(c[b>>2]|0)+8>>2]&255](b);ih(b);kh(a);return}function Gd(a){a=a|0;var b=0,d=0;b=jh(16)|0;c[b>>2]=4484;c[b+4>>2]=c[a+4>>2];c[b+8>>2]=c[a+8>>2];d=c[a+12>>2]|0;c[b+12>>2]=d;if(!d)return b|0;a=d+4|0;c[a>>2]=(c[a>>2]|0)+1;return b|0}function Hd(a,b){a=a|0;b=b|0;var d=0;c[b>>2]=4484;c[b+4>>2]=c[a+4>>2];c[b+8>>2]=c[a+8>>2];d=c[a+12>>2]|0;c[b+12>>2]=d;if(!d)return;b=d+4|0;c[b>>2]=(c[b>>2]|0)+1;return}function Id(a){a=a|0;var b=0,d=0;b=c[a+12>>2]|0;if(!b)return;a=b+4|0;d=c[a>>2]|0;c[a>>2]=d+-1;if(d|0)return;Ia[c[(c[b>>2]|0)+8>>2]&255](b);ih(b);return}function Jd(a){a=a|0;var b=0,d=0,e=0;b=c[a+12>>2]|0;if(!b){kh(a);return}d=b+4|0;e=c[d>>2]|0;c[d>>2]=e+-1;if(e|0){kh(a);return}Ia[c[(c[b>>2]|0)+8>>2]&255](b);ih(b);kh(a);return}function Kd(a){a=a|0;var b=0,d=0,e=0;b=c[a+4>>2]|0;$g(11606)|0;d=a+8|0;a=c[(c[d>>2]|0)+4>>2]|0;e=c[b>>2]|0;c[e+(a*48|0)+24>>2]=1125515264;c[e+(a*48|0)+28>>2]=1117782016;a=c[d>>2]|0;Ma[c[(c[a>>2]|0)+4>>2]&31](a,b,a+40|0,a+32|0);return}function Ld(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==8401?a+4|0:0)|0}function Md(a){a=a|0;return 3224}function Nd(a){a=a|0;var b=0,d=0;c[a>>2]=4528;b=c[a+12>>2]|0;if(!b)return;a=b+4|0;d=c[a>>2]|0;c[a>>2]=d+-1;if(d|0)return;Ia[c[(c[b>>2]|0)+8>>2]&255](b);ih(b);return}function Od(a){a=a|0;var b=0,d=0,e=0;c[a>>2]=4528;b=c[a+12>>2]|0;if(!b){kh(a);return}d=b+4|0;e=c[d>>2]|0;c[d>>2]=e+-1;if(e|0){kh(a);return}Ia[c[(c[b>>2]|0)+8>>2]&255](b);ih(b);kh(a);return}function Pd(a){a=a|0;var b=0,d=0;b=jh(16)|0;c[b>>2]=4528;c[b+4>>2]=c[a+4>>2];c[b+8>>2]=c[a+8>>2];d=c[a+12>>2]|0;c[b+12>>2]=d;if(!d)return b|0;a=d+4|0;c[a>>2]=(c[a>>2]|0)+1;return b|0}function Qd(a,b){a=a|0;b=b|0;var d=0;c[b>>2]=4528;c[b+4>>2]=c[a+4>>2];c[b+8>>2]=c[a+8>>2];d=c[a+12>>2]|0;c[b+12>>2]=d;if(!d)return;b=d+4|0;c[b>>2]=(c[b>>2]|0)+1;return}function Rd(a){a=a|0;var b=0,d=0;b=c[a+12>>2]|0;if(!b)return;a=b+4|0;d=c[a>>2]|0;c[a>>2]=d+-1;if(d|0)return;Ia[c[(c[b>>2]|0)+8>>2]&255](b);ih(b);return}function Sd(a){a=a|0;var b=0,d=0,e=0;b=c[a+12>>2]|0;if(!b){kh(a);return}d=b+4|0;e=c[d>>2]|0;c[d>>2]=e+-1;if(e|0){kh(a);return}Ia[c[(c[b>>2]|0)+8>>2]&255](b);ih(b);kh(a);return}function Td(a,b){a=a|0;b=b|0;var d=0;b=c[a+4>>2]|0;$g(11588)|0;d=c[a+8>>2]|0;a=c[b>>2]|0;c[a+(((c[a+((c[d+4>>2]|0)*48|0)+32>>2]|0)+1|0)*48|0)+36>>2]=696469503;Ma[c[(c[d>>2]|0)+4>>2]&31](d,b,d+40|0,d+32|0);return}function Ud(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==8522?a+4|0:0)|0}function Vd(a){a=a|0;return 3248}function Wd(a){a=a|0;var b=0,d=0;c[a>>2]=4592;b=c[a+12>>2]|0;if(!b)return;a=b+4|0;d=c[a>>2]|0;c[a>>2]=d+-1;if(d|0)return;Ia[c[(c[b>>2]|0)+8>>2]&255](b);ih(b);return}function Xd(a){a=a|0;var b=0,d=0,e=0;c[a>>2]=4592;b=c[a+12>>2]|0;if(!b){kh(a);return}d=b+4|0;e=c[d>>2]|0;c[d>>2]=e+-1;if(e|0){kh(a);return}Ia[c[(c[b>>2]|0)+8>>2]&255](b);ih(b);kh(a);return}function Yd(a){a=a|0;var b=0,d=0;b=jh(16)|0;c[b>>2]=4592;c[b+4>>2]=c[a+4>>2];c[b+8>>2]=c[a+8>>2];d=c[a+12>>2]|0;c[b+12>>2]=d;if(!d)return b|0;a=d+4|0;c[a>>2]=(c[a>>2]|0)+1;return b|0}function Zd(a,b){a=a|0;b=b|0;var d=0;c[b>>2]=4592;c[b+4>>2]=c[a+4>>2];c[b+8>>2]=c[a+8>>2];d=c[a+12>>2]|0;c[b+12>>2]=d;if(!d)return;b=d+4|0;c[b>>2]=(c[b>>2]|0)+1;return}function _d(a){a=a|0;var b=0,d=0;b=c[a+12>>2]|0;if(!b)return;a=b+4|0;d=c[a>>2]|0;c[a>>2]=d+-1;if(d|0)return;Ia[c[(c[b>>2]|0)+8>>2]&255](b);ih(b);return}function $d(a){a=a|0;var b=0,d=0,e=0;b=c[a+12>>2]|0;if(!b){kh(a);return}d=b+4|0;e=c[d>>2]|0;c[d>>2]=e+-1;if(e|0){kh(a);return}Ia[c[(c[b>>2]|0)+8>>2]&255](b);ih(b);kh(a);return}function ae(a){a=a|0;var b=0,d=0,e=0;$g(11595)|0;b=a+8|0;d=a+4|0;a=c[(c[b>>2]|0)+4>>2]|0;e=c[c[d>>2]>>2]|0;c[e+(a*48|0)+16>>2]=1073741824;c[e+(a*48|0)+20>>2]=1073741824;a=c[b>>2]|0;Ma[c[(c[a>>2]|0)+4>>2]&31](a,c[d>>2]|0,a+40|0,a+32|0);return}function be(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==8716?a+4|0:0)|0}function ce(a){a=a|0;return 3288}function de(a){a=a|0;var b=0,d=0;c[a>>2]=4636;b=c[a+12>>2]|0;if(!b)return;a=b+4|0;d=c[a>>2]|0;c[a>>2]=d+-1;if(d|0)return;Ia[c[(c[b>>2]|0)+8>>2]&255](b);ih(b);return}function ee(a){a=a|0;var b=0,d=0,e=0;c[a>>2]=4636;b=c[a+12>>2]|0;if(!b){kh(a);return}d=b+4|0;e=c[d>>2]|0;c[d>>2]=e+-1;if(e|0){kh(a);return}Ia[c[(c[b>>2]|0)+8>>2]&255](b);ih(b);kh(a);return}function fe(a){a=a|0;var b=0,d=0;b=jh(16)|0;c[b>>2]=4636;c[b+4>>2]=c[a+4>>2];c[b+8>>2]=c[a+8>>2];d=c[a+12>>2]|0;c[b+12>>2]=d;if(!d)return b|0;a=d+4|0;c[a>>2]=(c[a>>2]|0)+1;return b|0}function ge(a,b){a=a|0;b=b|0;var d=0;c[b>>2]=4636;c[b+4>>2]=c[a+4>>2];c[b+8>>2]=c[a+8>>2];d=c[a+12>>2]|0;c[b+12>>2]=d;if(!d)return;b=d+4|0;c[b>>2]=(c[b>>2]|0)+1;return}function he(a){a=a|0;var b=0,d=0;b=c[a+12>>2]|0;if(!b)return;a=b+4|0;d=c[a>>2]|0;c[a>>2]=d+-1;if(d|0)return;Ia[c[(c[b>>2]|0)+8>>2]&255](b);ih(b);return}function ie(a){a=a|0;var b=0,d=0,e=0;b=c[a+12>>2]|0;if(!b){kh(a);return}d=b+4|0;e=c[d>>2]|0;c[d>>2]=e+-1;if(e|0){kh(a);return}Ia[c[(c[b>>2]|0)+8>>2]&255](b);ih(b);kh(a);return}function je(a){a=a|0;var b=0,d=0,e=0;$g(11606)|0;b=a+8|0;d=a+4|0;a=c[(c[b>>2]|0)+4>>2]|0;e=c[c[d>>2]>>2]|0;c[e+(a*48|0)+16>>2]=1084227584;c[e+(a*48|0)+20>>2]=1084227584;a=c[b>>2]|0;Ma[c[(c[a>>2]|0)+4>>2]&31](a,c[d>>2]|0,a+40|0,a+32|0);return}function ke(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==8961?a+4|0:0)|0}function le(a){a=a|0;return 3312}function me(a){a=a|0;kh(a);return}function ne(a){a=a|0;var b=0;b=jh(8)|0;c[b>>2]=4680;c[b+4>>2]=c[a+4>>2];return b|0}function oe(a,b){a=a|0;b=b|0;c[b>>2]=4680;c[b+4>>2]=c[a+4>>2];return}function pe(a){a=a|0;return}function qe(a){a=a|0;kh(a);return}function re(a,b){a=a|0;b=b|0;var d=0,e=0,f=0;d=Ba;Ba=Ba+16|0;if((Ba|0)>=(Ca|0))z(16);e=d;f=c[a+4>>2]|0;a=c[f+208>>2]|0;if(!a){Ba=d;return}c[e>>2]=f;La[c[(c[a>>2]|0)+24>>2]&3](a,b,e);Ba=d;return}function se(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==9210?a+4|0:0)|0}function te(a){a=a|0;return 3336}function ue(a,b){a=a|0;b=b|0;return}function ve(a){a=a|0;hh(a);kh(a);return}function we(a){a=a|0;var b=0;b=c[a+12>>2]|0;if(!b)return;c[b>>2]=4572;a=c[b+208>>2]|0;if((b+192|0)!=(a|0)){if(a|0)Ia[c[(c[a>>2]|0)+20>>2]&255](a)}else Ia[c[(c[a>>2]|0)+16>>2]&255](a);Mb(b);kh(b);return}function xe(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==9407?a+12|0:0)|0}function ye(a){a=a|0;kh(a);return}function ze(a,b,d,e,f){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0;g=Ba;Ba=Ba+32|0;if((Ba|0)>=(Ca|0))z(32);h=g;i=g+16|0;j=g+8|0;c[a>>2]=0;k=a+4|0;c[k>>2]=0;l=a+8|0;c[l>>2]=0;if(!d){Ba=g;return}m=f+16|0;f=i+4|0;n=j+4|0;o=0;while(1){p=c[m>>2]|0;if(!p){q=5;break}r=Ea[c[(c[p>>2]|0)+24>>2]&63](p)|0;c[i>>2]=r;p=jh(16)|0;c[p+4>>2]=0;c[p+8>>2]=0;c[p>>2]=4004;c[p+12>>2]=r;c[f>>2]=p;c[h>>2]=r;c[h+4>>2]=r;Bb(i,h);r=c[i>>2]|0;c[(c[b>>2]|0)+((c[r+4>>2]|0)*48|0)+40>>2]=0;p=c[k>>2]|0;if((p|0)==(c[l>>2]|0))Ab(a,i);else{c[p>>2]=r;r=c[f>>2]|0;c[p+4>>2]=r;if(!r)s=p;else{p=r+4|0;c[p>>2]=(c[p>>2]|0)+1;s=c[k>>2]|0}c[k>>2]=s+8}p=c[e>>2]|0;r=c[c[p>>2]>>2]|0;c[j>>2]=c[i>>2];t=c[f>>2]|0;c[n>>2]=t;if(t|0){u=t+4|0;c[u>>2]=(c[u>>2]|0)+1}La[r&3](p,b,j);p=c[n>>2]|0;if(p|0?(r=p+4|0,u=c[r>>2]|0,c[r>>2]=u+-1,(u|0)==0):0){Ia[c[(c[p>>2]|0)+8>>2]&255](p);ih(p)}p=c[f>>2]|0;if(p|0?(u=p+4|0,r=c[u>>2]|0,c[u>>2]=r+-1,(r|0)==0):0){Ia[c[(c[p>>2]|0)+8>>2]&255](p);ih(p)}o=o+1|0;if(o>>>0>=d>>>0){q=3;break}}if((q|0)==3){Ba=g;return}else if((q|0)==5){q=_(4)|0;c[q>>2]=5696;ca(q|0,3640,121)}}function Ae(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0;d=Ba;Ba=Ba+16|0;if((Ba|0)>=(Ca|0))z(16);e=d;c[a>>2]=b;f=jh(16)|0;c[f+4>>2]=0;c[f+8>>2]=0;c[f>>2]=4752;c[f+12>>2]=b;c[a+4>>2]=f;c[e>>2]=b;c[e+4>>2]=b;Be(a,e);Ba=d;return}function Be(a,b){a=a|0;b=b|0;return}function Ce(a){a=a|0;hh(a);kh(a);return}function De(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0;b=c[a+12>>2]|0;if(!b)return;a=c[b>>2]|0;if(a|0){d=b+4|0;e=c[d>>2]|0;if((e|0)==(a|0))f=a;else{g=e;do{e=c[g+-4>>2]|0;g=g+-8|0;if(e|0?(h=e+4|0,i=c[h>>2]|0,c[h>>2]=i+-1,(i|0)==0):0){Ia[c[(c[e>>2]|0)+8>>2]&255](e);ih(e)}}while((g|0)!=(a|0));f=c[b>>2]|0}c[d>>2]=a;kh(f)}kh(b);return}function Ee(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==9545?a+12|0:0)|0}function Fe(a){a=a|0;kh(a);return}function Ge(a){a=a|0;return}function He(a){a=a|0;kh(a);return}function Ie(a){a=a|0;var b=0;b=jh(8)|0;c[b>>2]=4780;c[b+4>>2]=c[a+4>>2];return b|0}function Je(a,b){a=a|0;b=b|0;c[b>>2]=4780;c[b+4>>2]=c[a+4>>2];return}function Ke(a){a=a|0;return}function Le(a){a=a|0;kh(a);return}function Me(a){a=a|0;var b=0,d=0,e=0,f=0;b=Ba;Ba=Ba+32|0;if((Ba|0)>=(Ca|0))z(32);d=b;e=c[a+4>>2]|0;a=jh(216)|0;f=d+16|0;c[d>>2]=4824;c[d+4>>2]=e;c[f>>2]=d;Kc(a,e,d);e=c[f>>2]|0;if((d|0)==(e|0)){Ia[c[(c[e>>2]|0)+16>>2]&255](e);Ba=b;return a|0}if(!e){Ba=b;return a|0}Ia[c[(c[e>>2]|0)+20>>2]&255](e);Ba=b;return a|0}function Ne(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==9964?a+4|0:0)|0}function Oe(a){a=a|0;return 3432}function Pe(a){a=a|0;return}function Qe(a){a=a|0;kh(a);return}function Re(a){a=a|0;var b=0;b=jh(8)|0;c[b>>2]=4824;c[b+4>>2]=c[a+4>>2];return b|0}function Se(a,b){a=a|0;b=b|0;c[b>>2]=4824;c[b+4>>2]=c[a+4>>2];return}function Te(a){a=a|0;return}function Ue(a){a=a|0;kh(a);return}function Ve(a,b,d){a=a|0;b=b|0;d=d|0;c[(c[c[a+4>>2]>>2]|0)+((c[(c[d>>2]|0)+4>>2]|0)*48|0)+40>>2]=0;return}function We(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==9901?a+4|0:0)|0}function Xe(a){a=a|0;return 3424}function Ye(a){a=a|0;kh(a);return}function Ze(a){a=a|0;var b=0;b=jh(8)|0;c[b>>2]=4868;c[b+4>>2]=c[a+4>>2];return b|0}function _e(a,b){a=a|0;b=b|0;c[b>>2]=4868;c[b+4>>2]=c[a+4>>2];return}function $e(a){a=a|0;return}function af(a){a=a|0;kh(a);return}function bf(a,b){a=a|0;b=b|0;ef(a+4|0,b);return}function cf(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==10101?a+4|0:0)|0}function df(a){a=a|0;return 3456}function ef(a,b){a=a|0;b=b|0;var d=0,e=0,h=0,i=0.0,j=0,k=0,l=0,m=0,n=0,o=0;d=Ba;Ba=Ba+16|0;if((Ba|0)>=(Ca|0))z(16);e=d;h=c[a>>2]|0;i=+f[b+4>>2];g[e>>3]=+f[b>>2];g[e+8>>3]=i;Zg(10079,e)|0;e=c[h+28>>2]|0;a=c[e>>2]|0;j=c[e+4>>2]|0;if((a|0)==(j|0)){Ba=d;return}e=a;while(1){k=c[e>>2]|0;l=c[e+4>>2]|0;a=(l|0)==0;if(!a){m=l+4|0;c[m>>2]=(c[m>>2]|0)+1}n=(c[h>>2]|0)+((c[k+4>>2]|0)*48|0)+40|0;if(!(c[n>>2]|0))break;if(!a?(a=l+4|0,m=c[a>>2]|0,c[a>>2]=m+-1,(m|0)==0):0){Ia[c[(c[l>>2]|0)+8>>2]&255](l);ih(l)}e=e+8|0;if((e|0)==(j|0)){o=13;break}}if((o|0)==13){Ba=d;return}c[n>>2]=1;n=k+4|0;o=c[n>>2]|0;j=c[h>>2]|0;c[j+(o*48|0)+24>>2]=1125515264;c[j+(o*48|0)+28>>2]=1117782016;c[k+8>>2]=1056964608;c[k+12>>2]=1056964608;o=b;b=c[o+4>>2]|0;j=(c[h>>2]|0)+((c[n>>2]|0)*48|0)+16|0;c[j>>2]=c[o>>2];c[j+4>>2]=b;Ma[c[(c[k>>2]|0)+4>>2]&31](k,h,k+40|0,k+32|0);if(!l){Ba=d;return}k=l+4|0;h=c[k>>2]|0;c[k>>2]=h+-1;if(h|0){Ba=d;return}Ia[c[(c[l>>2]|0)+8>>2]&255](l);ih(l);Ba=d;return}function ff(a,b,d){a=a|0;b=b|0;d=+d;var e=0,g=0,h=0,i=0.0,j=0.0,k=0.0,l=0.0,m=0.0,n=0.0,o=0.0,p=0.0,q=0.0,s=0.0,t=0.0,u=0.0,v=0.0,w=0.0,x=0.0,y=0.0,z=0.0,A=0.0,B=0.0;switch(c[a+12>>2]|0){case 0:{e=(c[a+4>>2]|0)+4|0;g=c[e>>2]|0;h=c[b>>2]|0;i=d/1.0e3;j=+f[h+(g*48|0)>>2];k=+f[a+24>>2];l=+f[h+(g*48|0)+4>>2];m=+f[a+28>>2];n=-+f[a+32>>2];g=a+16|0;o=-+f[a+36>>2];p=+f[g>>2];h=a+20|0;q=+f[h>>2];s=p+i*((j-k)*n+p*o);t=q+i*((l-m)*n+q*o);o=j+i*p;p=l+i*q;q=+r(+(o-j));j=+f[a+40>>2];if((q<j?+r(+(p-l))<j&+r(+s)<j:0)?i>0.0&+r(+t)<j:0){c[g>>2]=0;c[h>>2]=0;u=k;v=m}else{f[g>>2]=s;f[h>>2]=t;u=o;v=p}h=c[e>>2]|0;e=c[b>>2]|0;f[e+(h*48|0)>>2]=u;f[e+(h*48|0)+4>>2]=v;return}case 1:{h=(c[a+4>>2]|0)+4|0;e=c[h>>2]|0;g=c[b>>2]|0;v=d/1.0e3;u=+f[g+(e*48|0)+16>>2];p=+f[a+24>>2];o=+f[g+(e*48|0)+20>>2];t=+f[a+28>>2];s=-+f[a+32>>2];e=a+16|0;m=-+f[a+36>>2];k=+f[e>>2];g=a+20|0;j=+f[g>>2];i=k+v*((u-p)*s+k*m);l=j+v*((o-t)*s+j*m);m=u+v*k;k=o+v*j;j=+r(+(m-u));u=+f[a+40>>2];if((j<u?+r(+(k-o))<u&+r(+i)<u:0)?v>0.0&+r(+l)<u:0){c[e>>2]=0;c[g>>2]=0;w=p;x=t}else{f[e>>2]=i;f[g>>2]=l;w=m;x=k}g=c[h>>2]|0;h=c[b>>2]|0;f[h+(g*48|0)+16>>2]=w;f[h+(g*48|0)+20>>2]=x;return}case 2:{g=(c[a+4>>2]|0)+4|0;h=c[g>>2]|0;e=c[b>>2]|0;x=d/1.0e3;w=+f[e+(h*48|0)+8>>2];k=+f[a+24>>2];m=+f[e+(h*48|0)+12>>2];l=+f[a+28>>2];i=-+f[a+32>>2];h=a+16|0;t=-+f[a+36>>2];p=+f[h>>2];e=a+20|0;u=+f[e>>2];v=p+x*((w-k)*i+p*t);o=u+x*((m-l)*i+u*t);t=w+x*p;p=m+x*u;u=+r(+(t-w));w=+f[a+40>>2];if((u<w?+r(+(p-m))<w&+r(+v)<w:0)?x>0.0&+r(+o)<w:0){c[h>>2]=0;c[e>>2]=0;y=k;z=l}else{f[h>>2]=v;f[e>>2]=o;y=t;z=p}e=c[g>>2]|0;g=c[b>>2]|0;f[g+(e*48|0)+8>>2]=y;f[g+(e*48|0)+12>>2]=z;return}case 3:{e=(c[a+4>>2]|0)+4|0;g=c[e>>2]|0;h=c[b>>2]|0;z=d/1.0e3;d=+f[h+(g*48|0)+24>>2];y=+f[a+24>>2];p=+f[h+(g*48|0)+28>>2];t=+f[a+28>>2];o=-+f[a+32>>2];g=a+16|0;v=-+f[a+36>>2];l=+f[g>>2];h=a+20|0;k=+f[h>>2];w=l+z*((d-y)*o+l*v);x=k+z*((p-t)*o+k*v);v=d+z*l;l=p+z*k;k=+r(+(v-d));d=+f[a+40>>2];if((k<d?+r(+(l-p))<d&+r(+w)<d:0)?z>0.0&+r(+x)<d:0){c[g>>2]=0;c[h>>2]=0;A=y;B=t}else{f[g>>2]=w;f[h>>2]=x;A=v;B=l}h=c[e>>2]|0;e=c[b>>2]|0;f[e+(h*48|0)+24>>2]=A;f[e+(h*48|0)+28>>2]=B;return}default:return}}function gf(a,b){a=a|0;b=b|0;return}function hf(a){a=a|0;hh(a);kh(a);return}function jf(a){a=a|0;var b=0,d=0,e=0;b=c[a+12>>2]|0;if(!b)return;c[b>>2]=4912;a=c[b+8>>2]|0;if(a|0?(d=a+4|0,e=c[d>>2]|0,c[d>>2]=e+-1,(e|0)==0):0){Ia[c[(c[a>>2]|0)+8>>2]&255](a);ih(a)}kh(b);return}function kf(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==10259?a+12|0:0)|0}function lf(a){a=a|0;kh(a);return}function mf(a,b){a=a|0;b=b|0;return}function nf(a){a=a|0;hh(a);kh(a);return}function of(a){a=a|0;var b=0,d=0,e=0;b=c[a+12>>2]|0;if(!b)return;a=c[b+16>>2]|0;if(a|0?(d=a+4|0,e=c[d>>2]|0,c[d>>2]=e+-1,(e|0)==0):0){Ia[c[(c[a>>2]|0)+8>>2]&255](a);ih(a)}a=c[b>>2]|0;if(a|0){c[b+4>>2]=a;kh(a)}kh(b);return}function pf(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==10397?a+12|0:0)|0}function qf(a){a=a|0;kh(a);return}function rf(a){a=a|0;hh(a);kh(a);return}function sf(a){a=a|0;var b=0,d=0,e=0;b=c[a+12>>2]|0;if(!b)return;a=c[b+16>>2]|0;if(a|0?(d=a+4|0,e=c[d>>2]|0,c[d>>2]=e+-1,(e|0)==0):0){Ia[c[(c[a>>2]|0)+8>>2]&255](a);ih(a)}a=c[b>>2]|0;if(a|0){c[b+4>>2]=a;kh(a)}kh(b);return}function tf(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==10533?a+12|0:0)|0}function uf(a){a=a|0;kh(a);return}function vf(a){a=a|0;hh(a);kh(a);return}function wf(a){a=a|0;var b=0,d=0,e=0;b=c[a+12>>2]|0;if(!b)return;a=c[b+16>>2]|0;if(a|0?(d=a+4|0,e=c[d>>2]|0,c[d>>2]=e+-1,(e|0)==0):0){Ia[c[(c[a>>2]|0)+8>>2]&255](a);ih(a)}a=c[b>>2]|0;if(a|0){c[b+4>>2]=a;kh(a)}kh(b);return}function xf(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==10669?a+12|0:0)|0}function yf(a){a=a|0;kh(a);return}function zf(a){a=a|0;hh(a);kh(a);return}function Af(a){a=a|0;var b=0,d=0,e=0;b=c[a+12>>2]|0;if(!b)return;a=c[b+16>>2]|0;if(a|0?(d=a+4|0,e=c[d>>2]|0,c[d>>2]=e+-1,(e|0)==0):0){Ia[c[(c[a>>2]|0)+8>>2]&255](a);ih(a)}a=c[b>>2]|0;if(a|0){c[b+4>>2]=a;kh(a)}kh(b);return}function Bf(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==10805?a+12|0:0)|0}function Cf(a){a=a|0;kh(a);return}function Df(a){a=a|0;hh(a);kh(a);return}function Ef(a){a=a|0;var b=0,d=0,e=0;b=c[a+12>>2]|0;if(!b)return;a=c[b+16>>2]|0;if(a|0?(d=a+4|0,e=c[d>>2]|0,c[d>>2]=e+-1,(e|0)==0):0){Ia[c[(c[a>>2]|0)+8>>2]&255](a);ih(a)}a=c[b>>2]|0;if(a|0){c[b+4>>2]=a;kh(a)}kh(b);return}function Ff(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==10940?a+12|0:0)|0}function Gf(a){a=a|0;kh(a);return}function Hf(a){a=a|0;hh(a);kh(a);return}function If(a){a=a|0;var b=0,d=0,e=0;b=c[a+12>>2]|0;if(!b)return;a=c[b+32>>2]|0;if(a|0?(d=a+4|0,e=c[d>>2]|0,c[d>>2]=e+-1,(e|0)==0):0){Ia[c[(c[a>>2]|0)+8>>2]&255](a);ih(a)}a=c[b+16>>2]|0;if(a|0?(e=a+4|0,d=c[e>>2]|0,c[e>>2]=d+-1,(d|0)==0):0){Ia[c[(c[a>>2]|0)+8>>2]&255](a);ih(a)}a=c[b>>2]|0;if(a|0){c[b+4>>2]=a;kh(a)}kh(b);return}function Jf(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==11073?a+12|0:0)|0}function Kf(a){a=a|0;kh(a);return}function Lf(a,b){a=a|0;b=b|0;return}function Mf(a){a=a|0;hh(a);kh(a);return}function Nf(a){a=a|0;var b=0,d=0,e=0;b=c[a+12>>2]|0;if(!b)return;a=c[b+16>>2]|0;if(a|0?(d=a+4|0,e=c[d>>2]|0,c[d>>2]=e+-1,(e|0)==0):0){Ia[c[(c[a>>2]|0)+8>>2]&255](a);ih(a)}a=c[b>>2]|0;if(a|0){c[b+4>>2]=a;kh(a)}kh(b);return}function Of(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==11206?a+12|0:0)|0}function Pf(a){a=a|0;kh(a);return}function Qf(a){a=a|0;kh(a);return}function Rf(a){a=a|0;var b=0,d=0,e=0;b=jh(44)|0;c[b>>2]=5148;d=b+4|0;e=a+4|0;a=d+40|0;do{c[d>>2]=c[e>>2];d=d+4|0;e=e+4|0}while((d|0)<(a|0));return b|0}function Sf(a,b){a=a|0;b=b|0;var d=0;c[b>>2]=5148;d=b+4|0;b=a+4|0;a=d+40|0;do{c[d>>2]=c[b>>2];d=d+4|0;b=b+4|0}while((d|0)<(a|0));return}function Tf(a){a=a|0;return}function Uf(a){a=a|0;kh(a);return}function Vf(a){a=a|0;var b=0,d=0,e=0,h=0.0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0.0,s=0.0,t=0,u=0;b=Ba;Ba=Ba+32|0;if((Ba|0)>=(Ca|0))z(32);d=b+8|0;e=b;h=+oa();g[c[a+4>>2]>>3]=h;i=P()|0;j=a+8|0;a:do if((i|0)!=(c[c[j>>2]>>2]|0)){c[e>>2]=i;Zg(11312,e)|0;c[c[j>>2]>>2]=i;switch(i|0){case 0:{k=c[a+12>>2]|0;l=c[a+16>>2]|0;m=c[l>>2]|0;n=c[l+4>>2]|0;l=(n|0)==0;if(!l){o=n+4|0;c[o>>2]=(c[o>>2]|0)+1;c[o>>2]=(c[o>>2]|0)+1}o=k+24|0;c[o>>2]=m;m=k+28|0;p=c[m>>2]|0;c[m>>2]=n;if(p|0?(m=p+4|0,q=c[m>>2]|0,c[m>>2]=q+-1,(q|0)==0):0){Ia[c[(c[p>>2]|0)+8>>2]&255](p);ih(p)}p=c[o>>2]|0;o=k+16|0;k=o;q=c[k+4>>2]|0;m=p+20|0;c[m>>2]=c[k>>2];c[m+4>>2]=q;q=c[p+12>>2]|0;if(q|0){m=c[(c[q>>2]|0)+4>>2]|0;f[e>>2]=0.0;f[e+4>>2]=0.0;Ma[m&31](q,p,e,o)}if(l)break a;l=n+4|0;o=c[l>>2]|0;c[l>>2]=o+-1;if(o|0)break a;Ia[c[(c[n>>2]|0)+8>>2]&255](n);ih(n);break a;break}case 1:{n=c[a+12>>2]|0;o=c[a+20>>2]|0;l=c[o>>2]|0;p=c[o+4>>2]|0;o=(p|0)==0;if(!o){q=p+4|0;c[q>>2]=(c[q>>2]|0)+1;c[q>>2]=(c[q>>2]|0)+1}q=n+24|0;c[q>>2]=l;l=n+28|0;m=c[l>>2]|0;c[l>>2]=p;if(m|0?(l=m+4|0,k=c[l>>2]|0,c[l>>2]=k+-1,(k|0)==0):0){Ia[c[(c[m>>2]|0)+8>>2]&255](m);ih(m)}m=c[q>>2]|0;q=n+16|0;n=q;k=c[n+4>>2]|0;l=m+20|0;c[l>>2]=c[n>>2];c[l+4>>2]=k;k=c[m+12>>2]|0;if(k|0){l=c[(c[k>>2]|0)+4>>2]|0;f[e>>2]=0.0;f[e+4>>2]=0.0;Ma[l&31](k,m,e,q)}if(o)break a;o=p+4|0;q=c[o>>2]|0;c[o>>2]=q+-1;if(q|0)break a;Ia[c[(c[p>>2]|0)+8>>2]&255](p);ih(p);break a;break}case 2:{p=c[a+12>>2]|0;q=c[a+24>>2]|0;o=c[q>>2]|0;m=c[q+4>>2]|0;q=(m|0)==0;if(!q){k=m+4|0;c[k>>2]=(c[k>>2]|0)+1;c[k>>2]=(c[k>>2]|0)+1}k=p+24|0;c[k>>2]=o;o=p+28|0;l=c[o>>2]|0;c[o>>2]=m;if(l|0?(o=l+4|0,n=c[o>>2]|0,c[o>>2]=n+-1,(n|0)==0):0){Ia[c[(c[l>>2]|0)+8>>2]&255](l);ih(l)}l=c[k>>2]|0;k=p+16|0;p=k;n=c[p+4>>2]|0;o=l+20|0;c[o>>2]=c[p>>2];c[o+4>>2]=n;n=c[l+12>>2]|0;if(n|0){o=c[(c[n>>2]|0)+4>>2]|0;f[e>>2]=0.0;f[e+4>>2]=0.0;Ma[o&31](n,l,e,k)}if(q)break a;q=m+4|0;k=c[q>>2]|0;c[q>>2]=k+-1;if(k|0)break a;Ia[c[(c[m>>2]|0)+8>>2]&255](m);ih(m);break a;break}case 3:{m=c[a+12>>2]|0;k=c[a+28>>2]|0;q=c[k>>2]|0;l=c[k+4>>2]|0;k=(l|0)==0;if(!k){n=l+4|0;c[n>>2]=(c[n>>2]|0)+1;c[n>>2]=(c[n>>2]|0)+1}n=m+24|0;c[n>>2]=q;q=m+28|0;o=c[q>>2]|0;c[q>>2]=l;if(o|0?(q=o+4|0,p=c[q>>2]|0,c[q>>2]=p+-1,(p|0)==0):0){Ia[c[(c[o>>2]|0)+8>>2]&255](o);ih(o)}o=c[n>>2]|0;n=m+16|0;m=n;p=c[m+4>>2]|0;q=o+20|0;c[q>>2]=c[m>>2];c[q+4>>2]=p;p=c[o+12>>2]|0;if(p|0){q=c[(c[p>>2]|0)+4>>2]|0;f[e>>2]=0.0;f[e+4>>2]=0.0;Ma[q&31](p,o,e,n)}if(k)break a;k=l+4|0;n=c[k>>2]|0;c[k>>2]=n+-1;if(n|0)break a;Ia[c[(c[l>>2]|0)+8>>2]&255](l);ih(l);break a;break}case 4:{l=c[a+12>>2]|0;n=c[a+32>>2]|0;k=c[n>>2]|0;o=c[n+4>>2]|0;n=(o|0)==0;if(!n){p=o+4|0;c[p>>2]=(c[p>>2]|0)+1;c[p>>2]=(c[p>>2]|0)+1}p=l+24|0;c[p>>2]=k;k=l+28|0;q=c[k>>2]|0;c[k>>2]=o;if(q|0?(k=q+4|0,m=c[k>>2]|0,c[k>>2]=m+-1,(m|0)==0):0){Ia[c[(c[q>>2]|0)+8>>2]&255](q);ih(q)}q=c[p>>2]|0;p=l+16|0;l=p;m=c[l+4>>2]|0;k=q+20|0;c[k>>2]=c[l>>2];c[k+4>>2]=m;m=c[q+12>>2]|0;if(m|0){k=c[(c[m>>2]|0)+4>>2]|0;f[e>>2]=0.0;f[e+4>>2]=0.0;Ma[k&31](m,q,e,p)}if(n)break a;n=o+4|0;p=c[n>>2]|0;c[n>>2]=p+-1;if(p|0)break a;Ia[c[(c[o>>2]|0)+8>>2]&255](o);ih(o);break a;break}case 5:{o=c[a+12>>2]|0;p=c[a+36>>2]|0;n=c[p>>2]|0;q=c[p+4>>2]|0;p=(q|0)==0;if(!p){m=q+4|0;c[m>>2]=(c[m>>2]|0)+1;c[m>>2]=(c[m>>2]|0)+1}m=o+24|0;c[m>>2]=n;n=o+28|0;k=c[n>>2]|0;c[n>>2]=q;if(k|0?(n=k+4|0,l=c[n>>2]|0,c[n>>2]=l+-1,(l|0)==0):0){Ia[c[(c[k>>2]|0)+8>>2]&255](k);ih(k)}k=c[m>>2]|0;m=o+16|0;o=m;l=c[o+4>>2]|0;n=k+20|0;c[n>>2]=c[o>>2];c[n+4>>2]=l;l=c[k+12>>2]|0;if(l|0){n=c[(c[l>>2]|0)+4>>2]|0;f[e>>2]=0.0;f[e+4>>2]=0.0;Ma[n&31](l,k,e,m)}if(p)break a;p=q+4|0;m=c[p>>2]|0;c[p>>2]=m+-1;if(m|0)break a;Ia[c[(c[q>>2]|0)+8>>2]&255](q);ih(q);break a;break}case 6:{q=c[a+12>>2]|0;m=c[a+40>>2]|0;p=c[m>>2]|0;k=c[m+4>>2]|0;m=(k|0)==0;if(!m){l=k+4|0;c[l>>2]=(c[l>>2]|0)+1;c[l>>2]=(c[l>>2]|0)+1}l=q+24|0;c[l>>2]=p;p=q+28|0;n=c[p>>2]|0;c[p>>2]=k;if(n|0?(p=n+4|0,o=c[p>>2]|0,c[p>>2]=o+-1,(o|0)==0):0){Ia[c[(c[n>>2]|0)+8>>2]&255](n);ih(n)}n=c[l>>2]|0;l=q+16|0;q=l;o=c[q+4>>2]|0;p=n+20|0;c[p>>2]=c[q>>2];c[p+4>>2]=o;o=c[n+12>>2]|0;if(o|0){p=c[(c[o>>2]|0)+4>>2]|0;f[e>>2]=0.0;f[e+4>>2]=0.0;Ma[p&31](o,n,e,l)}if(m)break a;m=k+4|0;l=c[m>>2]|0;c[m>>2]=l+-1;if(l|0)break a;Ia[c[(c[k>>2]|0)+8>>2]&255](k);ih(k);break a;break}default:break a}}while(0);e=c[a+12>>2]|0;c[e>>2]=(c[e>>2]|0)+1;h=+oa();L();r=+ua();s=+ta();a=e+16|0;i=e+20|0;if(r==+f[a>>2]?s==+f[i>>2]:0)t=e+24|0;else{g[d>>3]=r;g[d+8>>3]=s;Zg(11326,d)|0;f[a>>2]=r;f[i>>2]=s;i=e+24|0;j=c[i>>2]|0;k=a;l=c[k+4>>2]|0;m=j+20|0;c[m>>2]=c[k>>2];c[m+4>>2]=l;l=c[j+12>>2]|0;if(!l)t=i;else{m=c[(c[l>>2]|0)+4>>2]|0;f[d>>2]=0.0;f[d+4>>2]=0.0;Ma[m&31](l,j,d,a);t=i}}Yf(e);i=c[t>>2]|0;t=e+8|0;a=c[i+12>>2]|0;if(!a){u=c[e>>2]|0;Zf(e,h,u,0);g[t>>3]=h;Ba=b;return}cg(a,i,h-+g[t>>3]);u=c[e>>2]|0;Zf(e,h,u,0);g[t>>3]=h;Ba=b;return}function Wf(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==11401?a+4|0:0)|0}function Xf(a){a=a|0;return 3632}function Yf(a){a=a|0;var b=0,e=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0.0,A=0,B=0;b=Ba;Ba=Ba+96|0;if((Ba|0)>=(Ca|0))z(96);e=b+64|0;g=b+48|0;h=b;i=b+80|0;j=b+72|0;if(!(X(h|0)|0)){Ba=b;return}k=h+8|0;l=a+24|0;a=h+20|0;m=h+24|0;n=i+4|0;o=h+20|0;p=i+4|0;q=h+28|0;r=h+32|0;s=j+4|0;t=h+16|0;u=h+17|0;v=i+4|0;a:while(1){switch(c[h>>2]|0){case 256:{w=4;break a;break}case 512:{x=d[k>>0]|0;c[e>>2]=512;c[e+4>>2]=x;Zg(11381,e)|0;break}case 1026:{x=c[l>>2]|0;y=+(c[m>>2]|0);f[i>>2]=+(c[a>>2]|0);f[n>>2]=y;A=c[x+12>>2]|0;if(A|0)bg(A,x,i)|0;break}case 1024:{x=c[l>>2]|0;y=+(c[m>>2]|0);f[i>>2]=+(c[o>>2]|0);f[p>>2]=y;y=+(c[r>>2]|0);f[j>>2]=+(c[q>>2]|0);f[s>>2]=y;A=c[x+12>>2]|0;if(A|0)_f(A,x,i,j)|0;break}case 1025:{x=d[u>>0]|0;A=c[a>>2]|0;B=c[m>>2]|0;c[g>>2]=d[t>>0];c[g+4>>2]=x;c[g+8>>2]=A;c[g+12>>2]=B;Zg(11354,g)|0;B=c[l>>2]|0;y=+(c[m>>2]|0);f[i>>2]=+(c[a>>2]|0);f[v>>2]=y;A=c[B+12>>2]|0;if(A|0)ag(A,B,i)|0;break}default:{}}if(!(X(h|0)|0)){w=16;break}}if((w|0)==4)Sh();else if((w|0)==16){Ba=b;return}}function Zf(b,d,e,g){b=b|0;d=+d;e=e|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0.0,s=0,t=0,u=0,v=0,w=0;g=Ba;Ba=Ba+16|0;if((Ba|0)>=(Ca|0))z(16);e=g;h=c[b+24>>2]|0;c[e>>2]=0;b=e+4|0;c[b>>2]=0;i=e+8|0;c[i>>2]=0;j=h+4|0;k=(c[j>>2]|0)-(c[h>>2]|0)|0;l=(k|0)/48|0;if(k){if(l>>>0>89478485)uh(e);m=jh(k)|0;c[b>>2]=m;c[e>>2]=m;c[i>>2]=m+(l*48|0);l=c[h>>2]|0;h=(c[j>>2]|0)-l|0;if((h|0)>0){vi(m|0,l|0,h|0)|0;l=m+(((h>>>0)/48|0)*48|0)|0;c[b>>2]=l;if((l|0)==(m|0)){n=m;o=b}else{l=0;h=m;j=0;do{i=h+(j*48|0)|0;switch(c[h+(j*48|0)+44>>2]|0){case 1:{if(!(c[h+(j*48|0)+40>>2]|0)){p=c[h+(j*48|0)+36>>2]|0;q=0}else{p=j;q=l}break}case 2:{d=+f[h+(j*48|0)+16>>2];r=+f[h+(j*48|0)+20>>2];M(+(+f[i>>2]+d),+(+f[h+(j*48|0)+4>>2]+r),+d,+r,c[h+(j*48|0)+32>>2]|0);p=j;q=l;break}case 3:{r=+f[h+(j*48|0)+16>>2];d=+f[h+(j*48|0)+20>>2];T(+(+f[i>>2]+r),+(+f[h+(j*48|0)+4>>2]+d),+r,+d,+(+f[h+(j*48|0)+24>>2]),c[h+(j*48|0)+32>>2]|0);p=j;q=l;break}case 4:{N(+(+f[i>>2]),+(+f[h+(j*48|0)+4>>2]),+(+f[h+(j*48|0)+16>>2]),+(+f[h+(j*48|0)+20>>2]),c[h+(j*48|0)+32>>2]|0);p=j;q=l;break}case 5:{S(+(+f[i>>2]),+(+f[h+(j*48|0)+4>>2]),+(+f[h+(j*48|0)+16>>2]),+(+f[h+(j*48|0)+20>>2]),+(+f[h+(j*48|0)+24>>2]),+(+f[h+(j*48|0)+28>>2]),c[h+(j*48|0)+32>>2]|0,c[h+(j*48|0)+36>>2]|0);p=j;q=l;break}case 6:{k=(c[3370]|0)+((c[h+(j*48|0)+36>>2]|0)*12|0)|0;if((a[k+11>>0]|0)<0)s=c[k>>2]|0;else s=k;d=+f[h+(j*48|0)+24>>2];O(s|0,+(+f[i>>2]),+(+f[h+(j*48|0)+4>>2]+d),+d,c[h+(j*48|0)+32>>2]|0);p=j;q=l;break}default:{p=j;q=l}}j=ni(p|0,q|0,1,0)|0;l=y()|0;h=c[e>>2]|0}while((l|0)<0|((l|0)==0?j>>>0<(((c[b>>2]|0)-h|0)/48|0)>>>0:0));t=b;u=h;v=9}}else{w=m;v=5}}else{w=0;v=5}if((v|0)==5){t=b;u=w;v=9}if((v|0)==9)if(!u){Ba=g;return}else{n=u;o=t}c[o>>2]=n;kh(n);Ba=g;return}function _f(b,d,e,f){b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0;if(!(c[(c[d>>2]|0)+((c[b+4>>2]|0)*48|0)+40>>2]|0)){g=0;return g|0}if(a[b+57>>0]|0)$f(b,d,f);h=b+176|0;i=c[h>>2]|0;j=(c[b+180>>2]|0)-i|0;if((j|0)<=0){g=0;return g|0}b=(j>>>3)+-1|0;j=i;while(1){i=c[j+(b<<3)>>2]|0;k=c[j+(b<<3)+4>>2]|0;l=(k|0)==0;if(!l){m=k+4|0;c[m>>2]=(c[m>>2]|0)+1}m=_f(i,d,e,f)|0;if(!l?(l=k+4|0,i=c[l>>2]|0,c[l>>2]=i+-1,(i|0)==0):0){Ia[c[(c[k>>2]|0)+8>>2]&255](k);ih(k)}if(m){g=1;n=14;break}m=b+-1|0;if((m|0)<=-1){g=0;n=14;break}b=m;j=c[h>>2]|0}if((n|0)==14)return g|0;return 0}function $f(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,g=0,i=0,j=0,k=0,l=0,m=0,n=0.0,o=0.0,p=0,q=0.0,r=0.0,s=0,t=0.0,u=0.0,v=0.0,w=0.0,x=0,y=0;e=Ba;Ba=Ba+16|0;if((Ba|0)>=(Ca|0))z(16);g=e+8|0;i=e;j=a+4|0;k=c[j>>2]|0;l=c[b>>2]|0;m=l+(k*48|0)+16|0;n=+f[m>>2];o=n+ +f[d>>2];p=l+(k*48|0)+20|0;q=+f[p>>2];r=q+ +f[d+4>>2];f[g>>2]=o;d=g+4|0;f[d>>2]=r;s=c[a+80>>2]|0;if(!s){t=o;u=n;v=r;w=q;x=l;y=k}else{Ja[c[(c[s>>2]|0)+24>>2]&31](s,g);t=+f[g>>2];u=+f[m>>2];v=+f[d>>2];w=+f[p>>2];x=c[b>>2]|0;y=c[j>>2]|0}j=g;g=c[j+4>>2]|0;p=x+(y*48|0)+16|0;c[p>>2]=c[j>>2];c[p+4>>2]=g;g=a+16|0;p=g;j=c[p>>2]|0;y=c[p+4>>2]|0;p=i;c[p>>2]=j;c[p+4>>2]=y;y=a+20|0;q=v-w+ +f[y>>2];f[g>>2]=t-u+(c[h>>2]=j,+f[h>>2]);f[y>>2]=q;y=a+24|0;Ma[c[(c[a>>2]|0)+8>>2]&31](a,b,i,y);i=c[a+176>>2]|0;j=c[a+180>>2]|0;if((i|0)==(j|0)){Ba=e;return}a=i;do{i=c[a>>2]|0;p=c[a+4>>2]|0;if(p){x=p+4|0;c[x>>2]=(c[x>>2]|0)+1;Ma[c[(c[i>>2]|0)+4>>2]&31](i,b,g,y);x=p+4|0;d=c[x>>2]|0;c[x>>2]=d+-1;if(!d){Ia[c[(c[p>>2]|0)+8>>2]&255](p);ih(p)}}else Ma[c[(c[i>>2]|0)+4>>2]&31](i,b,g,y);a=a+8|0}while((a|0)!=(j|0));Ba=e;return}function ag(b,d,e){b=b|0;d=d|0;e=e|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0.0,r=0.0,s=0.0;if(!(c[(c[d>>2]|0)+((c[b+4>>2]|0)*48|0)+40>>2]|0)){g=0;return g|0}h=b+176|0;i=c[h>>2]|0;j=(c[b+180>>2]|0)-i|0;a:do if((j|0)>0){k=(j>>>3)+-1|0;l=i;while(1){m=c[l+(k<<3)>>2]|0;n=c[l+(k<<3)+4>>2]|0;o=(n|0)==0;if(!o){p=n+4|0;c[p>>2]=(c[p>>2]|0)+1}p=ag(m,d,e)|0;if(!o?(o=n+4|0,m=c[o>>2]|0,c[o>>2]=m+-1,(m|0)==0):0){Ia[c[(c[n>>2]|0)+8>>2]&255](n);ih(n)}if(p){g=1;break}p=k+-1|0;if((p|0)<=-1)break a;k=p;l=c[h>>2]|0}return g|0}while(0);if((((a[b+88>>0]|0?(q=+f[e>>2],r=+f[e+4>>2],s=+f[b+16>>2],s<=q):0)?s+ +f[b+24>>2]>=q:0)?(q=+f[b+20>>2],q<=r):0)?q+ +f[b+28>>2]>=r:0){a[b+89>>0]=1;h=c[b+112>>2]|0;if(!h){g=1;return g|0}Ia[c[(c[h>>2]|0)+24>>2]&255](h);g=1;return g|0}if(!(a[b+56>>0]|0)){g=0;return g|0}r=+f[e>>2];q=+f[e+4>>2];s=+f[b+16>>2];if(!(s<=r)){g=0;return g|0}if(!(s+ +f[b+24>>2]>=r)){g=0;return g|0}r=+f[b+20>>2];if(!(r<=q)){g=0;return g|0}if(!(r+ +f[b+28>>2]>=q)){g=0;return g|0}$g(11619)|0;a[b+57>>0]=1;g=1;return g|0}function bg(b,d,e){b=b|0;d=d|0;e=e|0;var g=0,h=0,i=0.0,j=0.0,k=0.0,l=0,m=0,n=0,o=0,p=0,q=0;if(!(c[(c[d>>2]|0)+((c[b+4>>2]|0)*48|0)+40>>2]|0)){g=0;return g|0}if(a[b+88>>0]|0?(h=b+89|0,a[h>>0]|0):0){a[h>>0]=0;h=c[b+136>>2]|0;if(h|0)Ia[c[(c[h>>2]|0)+24>>2]&255](h);h=c[b+160>>2]|0;if(!h){g=1;return g|0}i=+f[e>>2];j=+f[e+4>>2];k=+f[b+16>>2];if(!(k<=i)){g=1;return g|0}if(!(k+ +f[b+24>>2]>=i)){g=1;return g|0}i=+f[b+20>>2];if(!(i<=j)){g=1;return g|0}if(!(i+ +f[b+28>>2]>=j)){g=1;return g|0}Ja[c[(c[h>>2]|0)+24>>2]&31](h,e);g=1;return g|0}if(a[b+56>>0]|0?(h=b+57|0,a[h>>0]|0):0){a[h>>0]=0;g=1;return g|0}h=b+176|0;l=c[h>>2]|0;m=(c[b+180>>2]|0)-l|0;if((m|0)<=0){g=0;return g|0}b=(m>>>3)+-1|0;m=l;while(1){l=c[m+(b<<3)>>2]|0;n=c[m+(b<<3)+4>>2]|0;o=(n|0)==0;if(!o){p=n+4|0;c[p>>2]=(c[p>>2]|0)+1}p=bg(l,d,e)|0;if(!o?(o=n+4|0,l=c[o>>2]|0,c[o>>2]=l+-1,(l|0)==0):0){Ia[c[(c[n>>2]|0)+8>>2]&255](n);ih(n)}if(p){g=1;q=25;break}p=b+-1|0;if((p|0)<=-1){g=0;q=25;break}b=p;m=c[h>>2]|0}if((q|0)==25)return g|0;return 0}function cg(a,b,d){a=a|0;b=b|0;d=+d;var e=0,f=0,g=0,h=0,i=0;if(!(c[(c[b>>2]|0)+((c[a+4>>2]|0)*48|0)+40>>2]|0))return;e=c[a+168>>2]|0;if(e|0){Ka[c[c[e>>2]>>2]&1](e,b,d);Ma[c[(c[a>>2]|0)+4>>2]&31](a,b,a+40|0,a+32|0)}e=c[a+176>>2]|0;f=c[a+180>>2]|0;if((e|0)==(f|0))return;a=e;do{e=c[a>>2]|0;g=c[a+4>>2]|0;if(g){h=g+4|0;c[h>>2]=(c[h>>2]|0)+1;cg(e,b,d);h=g+4|0;i=c[h>>2]|0;c[h>>2]=i+-1;if(!i){Ia[c[(c[g>>2]|0)+8>>2]&255](g);ih(g)}}else cg(e,b,d);a=a+8|0}while((a|0)!=(f|0));return}function dg(){c[3370]=0;c[3371]=0;c[3372]=0;c[3373]=0;c[3374]=0;c[3375]=0;c[3376]=0;c[3377]=1065353216;c[3368]=0;return}function eg(a){a=a|0;var b=0,d=0;b=Ba;Ba=Ba+16|0;if((Ba|0)>=(Ca|0))z(16);d=b;c[d>>2]=jg(c[a+60>>2]|0)|0;a=hg(ka(6,d|0)|0)|0;Ba=b;return a|0}function fg(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0;e=Ba;Ba=Ba+48|0;if((Ba|0)>=(Ca|0))z(48);f=e+32|0;g=e+16|0;h=e;i=a+28|0;j=c[i>>2]|0;c[h>>2]=j;k=a+20|0;l=(c[k>>2]|0)-j|0;c[h+4>>2]=l;c[h+8>>2]=b;c[h+12>>2]=d;b=l+d|0;l=a+60|0;c[g>>2]=c[l>>2];c[g+4>>2]=h;c[g+8>>2]=2;j=hg(ia(146,g|0)|0)|0;a:do if((b|0)!=(j|0)){g=2;m=b;n=h;o=j;while(1){if((o|0)<0)break;m=m-o|0;p=c[n+4>>2]|0;q=o>>>0>p>>>0;r=q?n+8|0:n;s=g+(q<<31>>31)|0;t=o-(q?p:0)|0;c[r>>2]=(c[r>>2]|0)+t;p=r+4|0;c[p>>2]=(c[p>>2]|0)-t;c[f>>2]=c[l>>2];c[f+4>>2]=r;c[f+8>>2]=s;o=hg(ia(146,f|0)|0)|0;if((m|0)==(o|0)){u=3;break a}else{g=s;n=r}}c[a+16>>2]=0;c[i>>2]=0;c[k>>2]=0;c[a>>2]=c[a>>2]|32;if((g|0)==2)v=0;else v=d-(c[n+4>>2]|0)|0}else u=3;while(0);if((u|0)==3){u=c[a+44>>2]|0;c[a+16>>2]=u+(c[a+48>>2]|0);a=u;c[i>>2]=a;c[k>>2]=a;v=d}Ba=e;return v|0}function gg(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0;e=Ba;Ba=Ba+32|0;if((Ba|0)>=(Ca|0))z(32);f=e;g=e+20|0;c[f>>2]=c[a+60>>2];c[f+4>>2]=0;c[f+8>>2]=b;c[f+12>>2]=g;c[f+16>>2]=d;if((hg(ha(140,f|0)|0)|0)<0){c[g>>2]=-1;h=-1}else h=c[g>>2]|0;Ba=e;return h|0}function hg(a){a=a|0;var b=0;if(a>>>0>4294963200){c[(ig()|0)>>2]=0-a;b=-1}else b=a;return b|0}function ig(){return 13576}function jg(a){a=a|0;return a|0}function kg(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0;f=Ba;Ba=Ba+32|0;if((Ba|0)>=(Ca|0))z(32);g=f;c[b+36>>2]=1;if((c[b>>2]&64|0)==0?(c[g>>2]=c[b+60>>2],c[g+4>>2]=21523,c[g+8>>2]=f+16,ja(54,g|0)|0):0)a[b+75>>0]=-1;g=fg(b,d,e)|0;Ba=f;return g|0}function lg(a){a=a|0;return (a+-48|0)>>>0<10|0}function mg(){return 5444}function ng(b,c){b=b|0;c=c|0;var d=0,e=0,f=0,g=0;d=a[b>>0]|0;e=a[c>>0]|0;if(d<<24>>24==0?1:d<<24>>24!=e<<24>>24){f=e;g=d}else{d=c;c=b;do{c=c+1|0;d=d+1|0;b=a[c>>0]|0;e=a[d>>0]|0}while(!(b<<24>>24==0?1:b<<24>>24!=e<<24>>24));f=e;g=b}return (g&255)-(f&255)|0}function og(b){b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0;d=b;a:do if(!(d&3)){e=b;f=5}else{g=b;h=d;while(1){if(!(a[g>>0]|0)){i=h;break a}j=g+1|0;h=j;if(!(h&3)){e=j;f=5;break}else g=j}}while(0);if((f|0)==5){f=e;while(1){k=c[f>>2]|0;if(!((k&-2139062144^-2139062144)&k+-16843009))f=f+4|0;else break}if(!((k&255)<<24>>24))l=f;else{k=f;while(1){f=k+1|0;if(!(a[f>>0]|0)){l=f;break}else k=f}}i=l}return i-d|0}function pg(a,b){a=a|0;b=b|0;var c=0;c=og(a)|0;return ((qg(a,1,c,b)|0)!=(c|0))<<31>>31|0}function qg(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0;f=u(d,b)|0;g=(b|0)==0?0:d;if((c[e+76>>2]|0)>-1){d=(sg(e)|0)==0;h=vg(a,f,e)|0;if(d)i=h;else{rg(e);i=h}}else i=vg(a,f,e)|0;if((i|0)==(f|0))j=g;else j=(i>>>0)/(b>>>0)|0;return j|0}function rg(a){a=a|0;return}function sg(a){a=a|0;return 1}function tg(b,e){b=b|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0;f=Ba;Ba=Ba+16|0;if((Ba|0)>=(Ca|0))z(16);g=f;h=e&255;a[g>>0]=h;i=b+16|0;j=c[i>>2]|0;if(!j)if(!(ug(b)|0)){k=c[i>>2]|0;l=4}else m=-1;else{k=j;l=4}do if((l|0)==4){j=b+20|0;i=c[j>>2]|0;if(i>>>0<k>>>0?(n=e&255,(n|0)!=(a[b+75>>0]|0)):0){c[j>>2]=i+1;a[i>>0]=h;m=n;break}if((Ga[c[b+36>>2]&7](b,g,1)|0)==1)m=d[g>>0]|0;else m=-1}while(0);Ba=f;return m|0}function ug(b){b=b|0;var d=0,e=0,f=0;d=b+74|0;e=a[d>>0]|0;a[d>>0]=e+255|e;e=c[b>>2]|0;if(!(e&8)){c[b+8>>2]=0;c[b+4>>2]=0;d=c[b+44>>2]|0;c[b+28>>2]=d;c[b+20>>2]=d;c[b+16>>2]=d+(c[b+48>>2]|0);f=0}else{c[b>>2]=e|32;f=-1}return f|0}function vg(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0;f=e+16|0;g=c[f>>2]|0;if(!g)if(!(ug(e)|0)){h=c[f>>2]|0;i=5}else j=0;else{h=g;i=5}a:do if((i|0)==5){g=e+20|0;f=c[g>>2]|0;k=f;if((h-f|0)>>>0<d>>>0){j=Ga[c[e+36>>2]&7](e,b,d)|0;break}b:do if((a[e+75>>0]|0)<0|(d|0)==0){l=0;m=b;n=d;o=k}else{f=d;while(1){p=f+-1|0;if((a[b+p>>0]|0)==10)break;if(!p){l=0;m=b;n=d;o=k;break b}else f=p}p=Ga[c[e+36>>2]&7](e,b,f)|0;if(p>>>0<f>>>0){j=p;break a}l=f;m=b+f|0;n=d-f|0;o=c[g>>2]|0}while(0);vi(o|0,m|0,n|0)|0;c[g>>2]=(c[g>>2]|0)+n;j=l+n|0}while(0);return j|0}function wg(a,b){a=a|0;b=b|0;var d=0;if(!b)d=0;else d=xg(c[b>>2]|0,c[b+4>>2]|0,a)|0;return ((d|0)==0?a:d)|0}function xg(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0;f=(c[b>>2]|0)+1794895138|0;g=yg(c[b+8>>2]|0,f)|0;h=yg(c[b+12>>2]|0,f)|0;i=yg(c[b+16>>2]|0,f)|0;a:do if((g>>>0<d>>>2>>>0?(j=d-(g<<2)|0,h>>>0<j>>>0&i>>>0<j>>>0):0)?((i|h)&3|0)==0:0){j=h>>>2;k=i>>>2;l=0;m=g;while(1){n=m>>>1;o=l+n|0;p=o<<1;q=p+j|0;r=yg(c[b+(q<<2)>>2]|0,f)|0;s=yg(c[b+(q+1<<2)>>2]|0,f)|0;if(!(s>>>0<d>>>0&r>>>0<(d-s|0)>>>0)){t=0;break a}if(a[b+(s+r)>>0]|0){t=0;break a}r=ng(e,b+s|0)|0;if(!r)break;s=(r|0)<0;if((m|0)==1){t=0;break a}l=s?l:o;m=s?n:m-n|0}m=p+k|0;l=yg(c[b+(m<<2)>>2]|0,f)|0;j=yg(c[b+(m+1<<2)>>2]|0,f)|0;if(j>>>0<d>>>0&l>>>0<(d-j|0)>>>0)t=(a[b+(j+l)>>0]|0)==0?b+j|0:0;else t=0}else t=0;while(0);return t|0}function yg(a,b){a=a|0;b=b|0;var c=0;c=ui(a|0)|0;return ((b|0)==0?a:c)|0}function zg(){ea(13580);return 13588}function Ag(){la(13580);return}function Bg(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0;do if(a){if((c[a+76>>2]|0)<=-1){b=Cg(a)|0;break}d=(sg(a)|0)==0;e=Cg(a)|0;if(d)b=e;else{rg(a);b=e}}else{if(!(c[1360]|0))f=0;else f=Bg(c[1360]|0)|0;e=c[(zg()|0)>>2]|0;if(!e)g=f;else{d=e;e=f;while(1){if((c[d+76>>2]|0)>-1)h=sg(d)|0;else h=0;if((c[d+20>>2]|0)>>>0>(c[d+28>>2]|0)>>>0)i=Cg(d)|0|e;else i=e;if(h|0)rg(d);d=c[d+56>>2]|0;if(!d){g=i;break}else e=i}}Ag();b=g}while(0);return b|0}function Cg(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0;b=a+20|0;d=a+28|0;if((c[b>>2]|0)>>>0>(c[d>>2]|0)>>>0?(Ga[c[a+36>>2]&7](a,0,0)|0,(c[b>>2]|0)==0):0)e=-1;else{f=a+4|0;g=c[f>>2]|0;h=a+8|0;i=c[h>>2]|0;if(g>>>0<i>>>0)Ga[c[a+40>>2]&7](a,g-i|0,1)|0;c[a+16>>2]=0;c[d>>2]=0;c[b>>2]=0;c[h>>2]=0;c[f>>2]=0;e=0}return e|0}function Dg(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,v=0,w=0,x=0,y=0;f=d&255;g=(e|0)!=0;a:do if(g&(b&3|0)!=0){h=d&255;i=b;j=e;while(1){if((a[i>>0]|0)==h<<24>>24){k=i;l=j;m=6;break a}n=i+1|0;o=j+-1|0;p=(o|0)!=0;if(p&(n&3|0)!=0){i=n;j=o}else{q=n;r=o;s=p;m=5;break}}}else{q=b;r=e;s=g;m=5}while(0);if((m|0)==5)if(s){k=q;l=r;m=6}else m=16;b:do if((m|0)==6){r=d&255;if((a[k>>0]|0)==r<<24>>24)if(!l){m=16;break}else{t=k;break}q=u(f,16843009)|0;c:do if(l>>>0>3){s=k;g=l;while(1){e=c[s>>2]^q;if((e&-2139062144^-2139062144)&e+-16843009|0){v=g;w=s;break c}e=s+4|0;b=g+-4|0;if(b>>>0>3){s=e;g=b}else{x=e;y=b;m=11;break}}}else{x=k;y=l;m=11}while(0);if((m|0)==11)if(!y){m=16;break}else{v=y;w=x}q=w;g=v;while(1){if((a[q>>0]|0)==r<<24>>24){t=q;break b}g=g+-1|0;if(!g){m=16;break}else q=q+1|0}}while(0);if((m|0)==16)t=0;return t|0}function Eg(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0;f=Ba;Ba=Ba+224|0;if((Ba|0)>=(Ca|0))z(224);g=f+208|0;h=f+160|0;i=f+80|0;j=f;k=h;l=k+40|0;do{c[k>>2]=0;k=k+4|0}while((k|0)<(l|0));c[g>>2]=c[e>>2];if((Fg(0,d,g,i,h)|0)<0)m=-1;else{if((c[b+76>>2]|0)>-1)n=sg(b)|0;else n=0;e=c[b>>2]|0;k=e&32;if((a[b+74>>0]|0)<1)c[b>>2]=e&-33;e=b+48|0;if(!(c[e>>2]|0)){l=b+44|0;o=c[l>>2]|0;c[l>>2]=j;p=b+28|0;c[p>>2]=j;q=b+20|0;c[q>>2]=j;c[e>>2]=80;r=b+16|0;c[r>>2]=j+80;j=Fg(b,d,g,i,h)|0;if(!o)s=j;else{Ga[c[b+36>>2]&7](b,0,0)|0;t=(c[q>>2]|0)==0?-1:j;c[l>>2]=o;c[e>>2]=0;c[r>>2]=0;c[p>>2]=0;c[q>>2]=0;s=t}}else s=Fg(b,d,g,i,h)|0;h=c[b>>2]|0;c[b>>2]=h|k;if(n|0)rg(b);m=(h&32|0)==0?s:-1}Ba=f;return m|0}function Fg(d,e,f,h,i){d=d|0;e=e|0;f=f|0;h=h|0;i=i|0;var j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ba=0,ca=0,da=0,ea=0,fa=0,ga=0,ha=0,ia=0,ja=0,ka=0,la=0,ma=0,na=0,oa=0,pa=0,qa=0,ra=0,sa=0,ta=0,ua=0,va=0,wa=0,xa=0,ya=0,za=0,Aa=0,Da=0,Ea=0,Fa=0;j=Ba;Ba=Ba+64|0;if((Ba|0)>=(Ca|0))z(64);k=j+56|0;l=j+40|0;m=j;n=j+48|0;o=j+60|0;c[k>>2]=e;e=(d|0)!=0;p=m+40|0;q=p;r=m+39|0;m=n+4|0;s=0;t=0;u=0;a:while(1){v=s;w=t;while(1){do if((w|0)>-1)if((v|0)>(2147483647-w|0)){c[(ig()|0)>>2]=75;x=-1;break}else{x=v+w|0;break}else x=w;while(0);A=c[k>>2]|0;B=a[A>>0]|0;if(!(B<<24>>24)){C=94;break a}D=B;B=A;b:while(1){switch(D<<24>>24){case 37:{C=10;break b;break}case 0:{E=B;break b;break}default:{}}F=B+1|0;c[k>>2]=F;D=a[F>>0]|0;B=F}c:do if((C|0)==10){C=0;D=B;F=B;while(1){if((a[F+1>>0]|0)!=37){E=D;break c}G=D+1|0;F=F+2|0;c[k>>2]=F;if((a[F>>0]|0)!=37){E=G;break}else D=G}}while(0);v=E-A|0;if(e)Gg(d,A,v);if(!v)break;else w=x}w=(lg(a[(c[k>>2]|0)+1>>0]|0)|0)==0;v=c[k>>2]|0;if(!w?(a[v+2>>0]|0)==36:0){H=(a[v+1>>0]|0)+-48|0;I=1;J=3}else{H=-1;I=u;J=1}w=v+J|0;c[k>>2]=w;v=a[w>>0]|0;B=(v<<24>>24)+-32|0;if(B>>>0>31|(1<<B&75913|0)==0){K=0;L=v;M=w}else{v=0;D=B;B=w;while(1){w=1<<D|v;F=B+1|0;c[k>>2]=F;G=a[F>>0]|0;D=(G<<24>>24)+-32|0;if(D>>>0>31|(1<<D&75913|0)==0){K=w;L=G;M=F;break}else{v=w;B=F}}}if(L<<24>>24==42){if((lg(a[M+1>>0]|0)|0)!=0?(B=c[k>>2]|0,(a[B+2>>0]|0)==36):0){v=B+1|0;c[i+((a[v>>0]|0)+-48<<2)>>2]=10;N=c[h+((a[v>>0]|0)+-48<<3)>>2]|0;O=1;P=B+3|0}else{if(I|0){Q=-1;break}if(e){B=(c[f>>2]|0)+(4-1)&~(4-1);v=c[B>>2]|0;c[f>>2]=B+4;R=v}else R=0;N=R;O=0;P=(c[k>>2]|0)+1|0}c[k>>2]=P;v=(N|0)<0;S=v?0-N|0:N;T=v?K|8192:K;U=O;V=P}else{v=Hg(k)|0;if((v|0)<0){Q=-1;break}S=v;T=K;U=I;V=c[k>>2]|0}do if((a[V>>0]|0)==46){v=V+1|0;if((a[v>>0]|0)!=42){c[k>>2]=v;v=Hg(k)|0;W=v;X=c[k>>2]|0;break}if(lg(a[V+2>>0]|0)|0?(v=c[k>>2]|0,(a[v+3>>0]|0)==36):0){B=v+2|0;c[i+((a[B>>0]|0)+-48<<2)>>2]=10;D=c[h+((a[B>>0]|0)+-48<<3)>>2]|0;B=v+4|0;c[k>>2]=B;W=D;X=B;break}if(U|0){Q=-1;break a}if(e){B=(c[f>>2]|0)+(4-1)&~(4-1);D=c[B>>2]|0;c[f>>2]=B+4;Y=D}else Y=0;D=(c[k>>2]|0)+2|0;c[k>>2]=D;W=Y;X=D}else{W=-1;X=V}while(0);D=0;B=X;while(1){if(((a[B>>0]|0)+-65|0)>>>0>57){Q=-1;break a}v=B;B=B+1|0;c[k>>2]=B;Z=a[(a[v>>0]|0)+-65+(16+(D*58|0))>>0]|0;_=Z&255;if((_+-1|0)>>>0>=8)break;else D=_}if(!(Z<<24>>24)){Q=-1;break}v=(H|0)>-1;do if(Z<<24>>24==19)if(v){Q=-1;break a}else C=54;else{if(v){c[i+(H<<2)>>2]=_;F=h+(H<<3)|0;w=c[F+4>>2]|0;G=l;c[G>>2]=c[F>>2];c[G+4>>2]=w;C=54;break}if(!e){Q=0;break a}Ig(l,_,f);$=c[k>>2]|0;C=55}while(0);if((C|0)==54){C=0;if(e){$=B;C=55}else aa=0}d:do if((C|0)==55){C=0;v=a[$+-1>>0]|0;w=(D|0)!=0&(v&15|0)==3?v&-33:v;v=T&-65537;G=(T&8192|0)==0?T:v;e:do switch(w|0){case 110:{switch((D&255)<<24>>24){case 0:{c[c[l>>2]>>2]=x;aa=0;break d;break}case 1:{c[c[l>>2]>>2]=x;aa=0;break d;break}case 2:{F=c[l>>2]|0;c[F>>2]=x;c[F+4>>2]=((x|0)<0)<<31>>31;aa=0;break d;break}case 3:{b[c[l>>2]>>1]=x;aa=0;break d;break}case 4:{a[c[l>>2]>>0]=x;aa=0;break d;break}case 6:{c[c[l>>2]>>2]=x;aa=0;break d;break}case 7:{F=c[l>>2]|0;c[F>>2]=x;c[F+4>>2]=((x|0)<0)<<31>>31;aa=0;break d;break}default:{aa=0;break d}}break}case 112:{ba=120;ca=W>>>0>8?W:8;da=G|8;C=67;break}case 88:case 120:{ba=w;ca=W;da=G;C=67;break}case 111:{F=l;ea=c[F>>2]|0;fa=c[F+4>>2]|0;F=Kg(ea,fa,p)|0;ga=q-F|0;ha=F;ia=0;ja=11634;ka=(G&8|0)==0|(W|0)>(ga|0)?W:ga+1|0;la=G;ma=ea;na=fa;C=73;break}case 105:case 100:{fa=l;ea=c[fa>>2]|0;ga=c[fa+4>>2]|0;if((ga|0)<0){fa=oi(0,0,ea|0,ga|0)|0;F=y()|0;oa=l;c[oa>>2]=fa;c[oa+4>>2]=F;pa=1;qa=11634;ra=fa;sa=F;C=72;break e}else{pa=(G&2049|0)!=0&1;qa=(G&2048|0)==0?((G&1|0)==0?11634:11636):11635;ra=ea;sa=ga;C=72;break e}break}case 117:{ga=l;pa=0;qa=11634;ra=c[ga>>2]|0;sa=c[ga+4>>2]|0;C=72;break}case 99:{a[r>>0]=c[l>>2];ta=r;ua=0;va=11634;wa=1;xa=v;ya=q;break}case 109:{za=Mg(c[(ig()|0)>>2]|0)|0;C=77;break}case 115:{ga=c[l>>2]|0;za=(ga|0)==0?11644:ga;C=77;break}case 67:{c[n>>2]=c[l>>2];c[m>>2]=0;c[l>>2]=n;Aa=-1;C=81;break}case 83:{if(!W){Ng(d,32,S,0,G);Da=0;C=91}else{Aa=W;C=81}break}case 65:case 71:case 70:case 69:case 97:case 103:case 102:case 101:{aa=Pg(d,+g[l>>3],S,W,G,w)|0;break d;break}default:{ta=A;ua=0;va=11634;wa=W;xa=G;ya=q}}while(0);f:do if((C|0)==67){C=0;w=l;ga=c[w>>2]|0;ea=c[w+4>>2]|0;w=Jg(ga,ea,p,ba&32)|0;F=(da&8|0)==0|(ga|0)==0&(ea|0)==0;ha=w;ia=F?0:2;ja=F?11634:11634+(ba>>>4)|0;ka=ca;la=da;ma=ga;na=ea;C=73}else if((C|0)==72){C=0;ha=Lg(ra,sa,p)|0;ia=pa;ja=qa;ka=W;la=G;ma=ra;na=sa;C=73}else if((C|0)==77){C=0;ea=Dg(za,0,W)|0;ga=(ea|0)==0;ta=za;ua=0;va=11634;wa=ga?W:ea-za|0;xa=v;ya=ga?za+W|0:ea}else if((C|0)==81){C=0;ea=c[l>>2]|0;ga=0;while(1){F=c[ea>>2]|0;if(!F){Ea=ga;break}w=Og(o,F)|0;Fa=(w|0)<0;if(Fa|w>>>0>(Aa-ga|0)>>>0){C=85;break}F=w+ga|0;if(Aa>>>0>F>>>0){ea=ea+4|0;ga=F}else{Ea=F;break}}if((C|0)==85){C=0;if(Fa){Q=-1;break a}else Ea=ga}Ng(d,32,S,Ea,G);if(!Ea){Da=0;C=91}else{ea=c[l>>2]|0;F=0;while(1){w=c[ea>>2]|0;if(!w){Da=Ea;C=91;break f}fa=Og(o,w)|0;F=fa+F|0;if((F|0)>(Ea|0)){Da=Ea;C=91;break f}Gg(d,o,fa);if(F>>>0>=Ea>>>0){Da=Ea;C=91;break}else ea=ea+4|0}}}while(0);if((C|0)==73){C=0;v=(ma|0)!=0|(na|0)!=0;ea=(ka|0)!=0|v;F=q-ha+((v^1)&1)|0;ta=ea?ha:p;ua=ia;va=ja;wa=ea?((ka|0)>(F|0)?ka:F):0;xa=(ka|0)>-1?la&-65537:la;ya=q}else if((C|0)==91){C=0;Ng(d,32,S,Da,G^8192);aa=(S|0)>(Da|0)?S:Da;break}F=ya-ta|0;ea=(wa|0)<(F|0)?F:wa;v=ea+ua|0;ga=(S|0)<(v|0)?v:S;Ng(d,32,ga,v,xa);Gg(d,va,ua);Ng(d,48,ga,v,xa^65536);Ng(d,48,ea,F,0);Gg(d,ta,F);Ng(d,32,ga,v,xa^8192);aa=ga}while(0);s=aa;t=x;u=U}g:do if((C|0)==94)if(!d)if(!u)Q=0;else{U=1;while(1){t=c[i+(U<<2)>>2]|0;if(!t)break;Ig(h+(U<<3)|0,t,f);t=U+1|0;if(t>>>0<10)U=t;else{Q=1;break g}}t=U;while(1){if(c[i+(t<<2)>>2]|0){Q=-1;break g}t=t+1|0;if(t>>>0>=10){Q=1;break}}}else Q=x;while(0);Ba=j;return Q|0}function Gg(a,b,d){a=a|0;b=b|0;d=d|0;if(!(c[a>>2]&32))vg(b,d,a)|0;return}function Hg(b){b=b|0;var d=0,e=0,f=0,g=0,h=0;if(!(lg(a[c[b>>2]>>0]|0)|0))d=0;else{e=0;while(1){f=c[b>>2]|0;g=(e*10|0)+-48+(a[f>>0]|0)|0;h=f+1|0;c[b>>2]=h;if(!(lg(a[h>>0]|0)|0)){d=g;break}else e=g}}return d|0}function Ig(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,h=0,i=0,j=0.0;a:do if(b>>>0<=20)do switch(b|0){case 9:{e=(c[d>>2]|0)+(4-1)&~(4-1);f=c[e>>2]|0;c[d>>2]=e+4;c[a>>2]=f;break a;break}case 10:{f=(c[d>>2]|0)+(4-1)&~(4-1);e=c[f>>2]|0;c[d>>2]=f+4;f=a;c[f>>2]=e;c[f+4>>2]=((e|0)<0)<<31>>31;break a;break}case 11:{e=(c[d>>2]|0)+(4-1)&~(4-1);f=c[e>>2]|0;c[d>>2]=e+4;e=a;c[e>>2]=f;c[e+4>>2]=0;break a;break}case 12:{e=(c[d>>2]|0)+(8-1)&~(8-1);f=e;h=c[f>>2]|0;i=c[f+4>>2]|0;c[d>>2]=e+8;e=a;c[e>>2]=h;c[e+4>>2]=i;break a;break}case 13:{i=(c[d>>2]|0)+(4-1)&~(4-1);e=c[i>>2]|0;c[d>>2]=i+4;i=(e&65535)<<16>>16;e=a;c[e>>2]=i;c[e+4>>2]=((i|0)<0)<<31>>31;break a;break}case 14:{i=(c[d>>2]|0)+(4-1)&~(4-1);e=c[i>>2]|0;c[d>>2]=i+4;i=a;c[i>>2]=e&65535;c[i+4>>2]=0;break a;break}case 15:{i=(c[d>>2]|0)+(4-1)&~(4-1);e=c[i>>2]|0;c[d>>2]=i+4;i=(e&255)<<24>>24;e=a;c[e>>2]=i;c[e+4>>2]=((i|0)<0)<<31>>31;break a;break}case 16:{i=(c[d>>2]|0)+(4-1)&~(4-1);e=c[i>>2]|0;c[d>>2]=i+4;i=a;c[i>>2]=e&255;c[i+4>>2]=0;break a;break}case 17:{i=(c[d>>2]|0)+(8-1)&~(8-1);j=+g[i>>3];c[d>>2]=i+8;g[a>>3]=j;break a;break}case 18:{i=(c[d>>2]|0)+(8-1)&~(8-1);j=+g[i>>3];c[d>>2]=i+8;g[a>>3]=j;break a;break}default:break a}while(0);while(0);return}function Jg(b,c,e,f){b=b|0;c=c|0;e=e|0;f=f|0;var g=0,h=0;if((b|0)==0&(c|0)==0)g=e;else{h=e;e=c;c=b;while(1){b=h+-1|0;a[b>>0]=d[480+(c&15)>>0]|0|f;c=si(c|0,e|0,4)|0;e=y()|0;if((c|0)==0&(e|0)==0){g=b;break}else h=b}}return g|0}function Kg(b,c,d){b=b|0;c=c|0;d=d|0;var e=0,f=0;if((b|0)==0&(c|0)==0)e=d;else{f=d;d=c;c=b;while(1){b=f+-1|0;a[b>>0]=c&7|48;c=si(c|0,d|0,3)|0;d=y()|0;if((c|0)==0&(d|0)==0){e=b;break}else f=b}}return e|0}function Lg(b,c,d){b=b|0;c=c|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;if(c>>>0>0|(c|0)==0&b>>>0>4294967295){e=d;f=b;g=c;do{c=f;f=ri(f|0,g|0,10,0)|0;h=g;g=y()|0;i=mi(f|0,g|0,10,0)|0;j=oi(c|0,h|0,i|0,y()|0)|0;y()|0;e=e+-1|0;a[e>>0]=j&255|48}while(h>>>0>9|(h|0)==9&c>>>0>4294967295);k=f;l=e}else{k=b;l=d}if(!k)m=l;else{d=k;k=l;while(1){l=d;d=(d>>>0)/10|0;b=k+-1|0;a[b>>0]=l-(d*10|0)|48;if(l>>>0<10){m=b;break}else k=b}}return m|0}function Mg(a){a=a|0;return Wg(a,c[(Vg()|0)+188>>2]|0)|0}function Ng(a,b,c,d,e){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;var f=0,g=0,h=0;f=Ba;Ba=Ba+256|0;if((Ba|0)>=(Ca|0))z(256);g=f;if((c|0)>(d|0)&(e&73728|0)==0){e=c-d|0;wi(g|0,b<<24>>24|0,(e>>>0<256?e:256)|0)|0;if(e>>>0>255){b=c-d|0;d=e;do{Gg(a,g,256);d=d+-256|0}while(d>>>0>255);h=b&255}else h=e;Gg(a,g,h)}Ba=f;return}function Og(a,b){a=a|0;b=b|0;var c=0;if(!a)c=0;else c=Tg(a,b,0)|0;return c|0}function Pg(b,e,f,g,h,i){b=b|0;e=+e;f=f|0;g=g|0;h=h|0;i=i|0;var j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0.0,t=0,v=0.0,w=0,x=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0.0,H=0,I=0,J=0,K=0.0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0.0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ba=0,ca=0,da=0,ea=0,fa=0,ga=0,ha=0,ia=0.0,ja=0.0,ka=0,la=0,ma=0,na=0,oa=0,pa=0,qa=0,ra=0,sa=0,ta=0,ua=0,va=0,wa=0,xa=0,ya=0,za=0,Aa=0,Da=0,Ea=0,Fa=0,Ga=0,Ha=0,Ia=0,Ja=0,Ka=0;j=Ba;Ba=Ba+560|0;if((Ba|0)>=(Ca|0))z(560);k=j+32|0;l=j+536|0;m=j;n=m;o=j+540|0;c[l>>2]=0;p=o+12|0;q=Qg(e)|0;r=y()|0;if((r|0)<0){s=-e;t=Qg(s)|0;v=s;w=1;x=11651;A=y()|0;B=t}else{v=e;w=(h&2049|0)!=0&1;x=(h&2048|0)==0?((h&1|0)==0?11652:11657):11654;A=r;B=q}do if(0==0&(A&2146435072|0)==2146435072){q=(i&32|0)!=0;B=w+3|0;Ng(b,32,f,B,h&-65537);Gg(b,x,w);Gg(b,v!=v|0.0!=0.0?(q?11678:11682):q?11670:11674,3);Ng(b,32,f,B,h^8192);C=B}else{e=+Rg(v,l)*2.0;B=e!=0.0;if(B)c[l>>2]=(c[l>>2]|0)+-1;q=i|32;if((q|0)==97){r=i&32;t=(r|0)==0?x:x+9|0;D=w|2;E=12-g|0;do if(!(g>>>0>11|(E|0)==0)){s=8.0;F=E;do{F=F+-1|0;s=s*16.0}while((F|0)!=0);if((a[t>>0]|0)==45){G=-(s+(-e-s));break}else{G=e+s-s;break}}else G=e;while(0);E=c[l>>2]|0;F=(E|0)<0?0-E|0:E;H=Lg(F,((F|0)<0)<<31>>31,p)|0;if((H|0)==(p|0)){F=o+11|0;a[F>>0]=48;I=F}else I=H;a[I+-1>>0]=(E>>31&2)+43;E=I+-2|0;a[E>>0]=i+15;H=(g|0)<1;F=(h&8|0)==0;J=m;K=G;while(1){L=~~K;M=J+1|0;a[J>>0]=r|d[480+L>>0];K=(K-+(L|0))*16.0;if((M-n|0)==1?!(F&(H&K==0.0)):0){a[M>>0]=46;N=J+2|0}else N=M;if(!(K!=0.0))break;else J=N}J=N;if((g|0)!=0?(-2-n+J|0)<(g|0):0){H=p;F=E;O=g+2+H-F|0;P=H;Q=F}else{F=p;H=E;O=F-n-H+J|0;P=F;Q=H}H=O+D|0;Ng(b,32,f,H,h);Gg(b,t,D);Ng(b,48,f,H,h^65536);F=J-n|0;Gg(b,m,F);J=P-Q|0;Ng(b,48,O-(F+J)|0,0,0);Gg(b,E,J);Ng(b,32,f,H,h^8192);C=H;break}H=(g|0)<0?6:g;if(B){J=(c[l>>2]|0)+-28|0;c[l>>2]=J;R=e*268435456.0;S=J}else{R=e;S=c[l>>2]|0}J=(S|0)<0?k:k+288|0;F=J;K=R;do{r=~~K>>>0;c[F>>2]=r;F=F+4|0;K=(K-+(r>>>0))*1.0e9}while(K!=0.0);B=J;if((S|0)>0){E=J;D=F;t=S;while(1){r=(t|0)<29?t:29;M=D+-4|0;if(M>>>0>=E>>>0){L=M;M=0;do{T=ti(c[L>>2]|0,0,r|0)|0;U=ni(T|0,y()|0,M|0,0)|0;T=y()|0;M=ri(U|0,T|0,1e9,0)|0;V=mi(M|0,y()|0,1e9,0)|0;W=oi(U|0,T|0,V|0,y()|0)|0;y()|0;c[L>>2]=W;L=L+-4|0}while(L>>>0>=E>>>0);if(M){L=E+-4|0;c[L>>2]=M;X=L}else X=E}else X=E;a:do if(D>>>0>X>>>0){L=D;while(1){W=L+-4|0;if(c[W>>2]|0){Y=L;break a}if(W>>>0>X>>>0)L=W;else{Y=W;break}}}else Y=D;while(0);M=(c[l>>2]|0)-r|0;c[l>>2]=M;if((M|0)>0){E=X;D=Y;t=M}else{Z=X;_=Y;$=M;break}}}else{Z=J;_=F;$=S}if(($|0)<0){t=((H+25|0)/9|0)+1|0;D=(q|0)==102;E=Z;M=_;L=$;while(1){W=0-L|0;V=(W|0)<9?W:9;if(E>>>0<M>>>0){W=(1<<V)+-1|0;T=1e9>>>V;U=0;aa=E;do{ba=c[aa>>2]|0;c[aa>>2]=(ba>>>V)+U;U=u(ba&W,T)|0;aa=aa+4|0}while(aa>>>0<M>>>0);aa=(c[E>>2]|0)==0?E+4|0:E;if(!U){ca=M;da=aa}else{c[M>>2]=U;ca=M+4|0;da=aa}}else{ca=M;da=(c[E>>2]|0)==0?E+4|0:E}aa=D?J:da;T=(ca-aa>>2|0)>(t|0)?aa+(t<<2)|0:ca;L=(c[l>>2]|0)+V|0;c[l>>2]=L;if((L|0)>=0){ea=da;fa=T;break}else{E=da;M=T}}}else{ea=Z;fa=_}if(ea>>>0<fa>>>0){M=(B-ea>>2)*9|0;E=c[ea>>2]|0;if(E>>>0<10)ga=M;else{L=M;M=10;while(1){M=M*10|0;t=L+1|0;if(E>>>0<M>>>0){ga=t;break}else L=t}}}else ga=0;L=(q|0)==103;M=(H|0)!=0;E=H-((q|0)==102?0:ga)+((M&L)<<31>>31)|0;if((E|0)<(((fa-B>>2)*9|0)+-9|0)){t=E+9216|0;E=(t|0)/9|0;D=J+4+(E+-1024<<2)|0;F=t-(E*9|0)|0;if((F|0)<8){E=F;F=10;while(1){t=F*10|0;if((E|0)<7){E=E+1|0;F=t}else{ha=t;break}}}else ha=10;F=c[D>>2]|0;E=(F>>>0)/(ha>>>0)|0;q=F-(u(E,ha)|0)|0;t=(D+4|0)==(fa|0);if(!(t&(q|0)==0)){s=(E&1|0)==0?9007199254740992.0:9007199254740994.0;E=ha>>>1;K=q>>>0<E>>>0?.5:t&(q|0)==(E|0)?1.0:1.5;if(!w){ia=K;ja=s}else{E=(a[x>>0]|0)==45;ia=E?-K:K;ja=E?-s:s}E=F-q|0;c[D>>2]=E;if(ja+ia!=ja){q=E+ha|0;c[D>>2]=q;if(q>>>0>999999999){q=D;E=ea;while(1){F=q+-4|0;c[q>>2]=0;if(F>>>0<E>>>0){t=E+-4|0;c[t>>2]=0;ka=t}else ka=E;t=(c[F>>2]|0)+1|0;c[F>>2]=t;if(t>>>0>999999999){q=F;E=ka}else{la=F;ma=ka;break}}}else{la=D;ma=ea}E=(B-ma>>2)*9|0;q=c[ma>>2]|0;if(q>>>0<10){na=la;oa=E;pa=ma}else{F=E;E=10;while(1){E=E*10|0;t=F+1|0;if(q>>>0<E>>>0){na=la;oa=t;pa=ma;break}else F=t}}}else{na=D;oa=ga;pa=ea}}else{na=D;oa=ga;pa=ea}F=na+4|0;qa=oa;ra=fa>>>0>F>>>0?F:fa;sa=pa}else{qa=ga;ra=fa;sa=ea}F=0-qa|0;b:do if(ra>>>0>sa>>>0){E=ra;while(1){q=E+-4|0;if(c[q>>2]|0){ta=E;ua=1;break b}if(q>>>0>sa>>>0)E=q;else{ta=q;ua=0;break}}}else{ta=ra;ua=0}while(0);do if(L){D=H+((M^1)&1)|0;if((D|0)>(qa|0)&(qa|0)>-5){va=i+-1|0;wa=D+-1-qa|0}else{va=i+-2|0;wa=D+-1|0}if(!(h&8)){if(ua?(D=c[ta+-4>>2]|0,(D|0)!=0):0)if(!((D>>>0)%10|0)){E=0;V=10;while(1){V=V*10|0;U=E+1|0;if((D>>>0)%(V>>>0)|0|0){xa=U;break}else E=U}}else xa=0;else xa=9;E=((ta-B>>2)*9|0)+-9|0;if((va|32|0)==102){V=E-xa|0;D=(V|0)>0?V:0;ya=va;za=(wa|0)<(D|0)?wa:D;break}else{D=E+qa-xa|0;E=(D|0)>0?D:0;ya=va;za=(wa|0)<(E|0)?wa:E;break}}else{ya=va;za=wa}}else{ya=i;za=H}while(0);H=(za|0)!=0;B=H?1:h>>>3&1;M=(ya|32|0)==102;if(M){Aa=0;Da=(qa|0)>0?qa:0}else{L=(qa|0)<0?F:qa;E=Lg(L,((L|0)<0)<<31>>31,p)|0;L=p;if((L-E|0)<2){D=E;while(1){V=D+-1|0;a[V>>0]=48;if((L-V|0)<2)D=V;else{Ea=V;break}}}else Ea=E;a[Ea+-1>>0]=(qa>>31&2)+43;D=Ea+-2|0;a[D>>0]=ya;Aa=D;Da=L-D|0}D=w+1+za+B+Da|0;Ng(b,32,f,D,h);Gg(b,x,w);Ng(b,48,f,D,h^65536);if(M){F=sa>>>0>J>>>0?J:sa;V=m+9|0;U=V;q=m+8|0;t=F;do{T=Lg(c[t>>2]|0,0,V)|0;if((t|0)==(F|0))if((T|0)==(V|0)){a[q>>0]=48;Fa=q}else Fa=T;else if(T>>>0>m>>>0){wi(m|0,48,T-n|0)|0;aa=T;while(1){W=aa+-1|0;if(W>>>0>m>>>0)aa=W;else{Fa=W;break}}}else Fa=T;Gg(b,Fa,U-Fa|0);t=t+4|0}while(t>>>0<=J>>>0);if(!((h&8|0)==0&(H^1)))Gg(b,11686,1);if(t>>>0<ta>>>0&(za|0)>0){J=za;U=t;while(1){q=Lg(c[U>>2]|0,0,V)|0;if(q>>>0>m>>>0){wi(m|0,48,q-n|0)|0;F=q;while(1){M=F+-1|0;if(M>>>0>m>>>0)F=M;else{Ga=M;break}}}else Ga=q;Gg(b,Ga,(J|0)<9?J:9);U=U+4|0;F=J+-9|0;if(!(U>>>0<ta>>>0&(J|0)>9)){Ha=F;break}else J=F}}else Ha=za;Ng(b,48,Ha+9|0,9,0)}else{J=ua?ta:sa+4|0;if(sa>>>0<J>>>0&(za|0)>-1){U=m+9|0;V=(h&8|0)==0;t=U;H=0-n|0;F=m+8|0;T=za;M=sa;while(1){B=Lg(c[M>>2]|0,0,U)|0;if((B|0)==(U|0)){a[F>>0]=48;Ia=F}else Ia=B;do if((M|0)==(sa|0)){B=Ia+1|0;Gg(b,Ia,1);if(V&(T|0)<1){Ja=B;break}Gg(b,11686,1);Ja=B}else{if(Ia>>>0<=m>>>0){Ja=Ia;break}wi(m|0,48,Ia+H|0)|0;B=Ia;while(1){L=B+-1|0;if(L>>>0>m>>>0)B=L;else{Ja=L;break}}}while(0);q=t-Ja|0;Gg(b,Ja,(T|0)>(q|0)?q:T);B=T-q|0;M=M+4|0;if(!(M>>>0<J>>>0&(B|0)>-1)){Ka=B;break}else T=B}}else Ka=za;Ng(b,48,Ka+18|0,18,0);Gg(b,Aa,p-Aa|0)}Ng(b,32,f,D,h^8192);C=D}while(0);Ba=j;return ((C|0)<(f|0)?f:C)|0}function Qg(a){a=+a;var b=0;g[h>>3]=a;b=c[h>>2]|0;x(c[h+4>>2]|0);return b|0}function Rg(a,b){a=+a;b=b|0;return +(+Sg(a,b))}function Sg(a,b){a=+a;b=b|0;var d=0,e=0,f=0,i=0.0,j=0.0,k=0,l=0.0;g[h>>3]=a;d=c[h>>2]|0;e=c[h+4>>2]|0;f=si(d|0,e|0,52)|0;y()|0;switch(f&2047){case 0:{if(a!=0.0){i=+Sg(a*18446744073709551616.0,b);j=i;k=(c[b>>2]|0)+-64|0}else{j=a;k=0}c[b>>2]=k;l=j;break}case 2047:{l=a;break}default:{c[b>>2]=(f&2047)+-1022;c[h>>2]=d;c[h+4>>2]=e&-2146435073|1071644672;l=+g[h>>3]}}return +l}function Tg(b,d,e){b=b|0;d=d|0;e=e|0;var f=0;do if(b){if(d>>>0<128){a[b>>0]=d;f=1;break}if(!(c[c[(Ug()|0)+188>>2]>>2]|0))if((d&-128|0)==57216){a[b>>0]=d;f=1;break}else{c[(ig()|0)>>2]=84;f=-1;break}if(d>>>0<2048){a[b>>0]=d>>>6|192;a[b+1>>0]=d&63|128;f=2;break}if(d>>>0<55296|(d&-8192|0)==57344){a[b>>0]=d>>>12|224;a[b+1>>0]=d>>>6&63|128;a[b+2>>0]=d&63|128;f=3;break}if((d+-65536|0)>>>0<1048576){a[b>>0]=d>>>18|240;a[b+1>>0]=d>>>12&63|128;a[b+2>>0]=d>>>6&63|128;a[b+3>>0]=d&63|128;f=4;break}else{c[(ig()|0)>>2]=84;f=-1;break}}else f=1;while(0);return f|0}function Ug(){return mg()|0}function Vg(){return mg()|0}function Wg(b,e){b=b|0;e=e|0;var f=0,g=0,h=0,i=0,j=0;f=0;while(1){if((d[496+f>>0]|0)==(b|0)){g=4;break}h=f+1|0;if((h|0)==87){i=87;g=5;break}else f=h}if((g|0)==4)if(!f)j=592;else{i=f;g=5}if((g|0)==5){g=592;f=i;while(1){i=g;do{b=i;i=i+1|0}while((a[b>>0]|0)!=0);f=f+-1|0;if(!f){j=i;break}else g=i}}return Xg(j,c[e+20>>2]|0)|0}function Xg(a,b){a=a|0;b=b|0;return wg(a,b)|0}function Yg(b,c,d){b=b|0;c=c|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0;a:do if(!d)e=0;else{f=b;g=d;h=c;while(1){i=a[f>>0]|0;j=a[h>>0]|0;if(i<<24>>24!=j<<24>>24)break;g=g+-1|0;if(!g){e=0;break a}else{f=f+1|0;h=h+1|0}}e=(i&255)-(j&255)|0}while(0);return e|0}function Zg(a,b){a=a|0;b=b|0;var d=0,e=0;d=Ba;Ba=Ba+16|0;if((Ba|0)>=(Ca|0))z(16);e=d;c[e>>2]=b;b=Eg(c[1328]|0,a,e)|0;Ba=d;return b|0}function _g(b,d){b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0;if((c[d+76>>2]|0)>=0?(sg(d)|0)!=0:0){e=b&255;f=b&255;if((f|0)!=(a[d+75>>0]|0)?(g=d+20|0,h=c[g>>2]|0,h>>>0<(c[d+16>>2]|0)>>>0):0){c[g>>2]=h+1;a[h>>0]=e;i=f}else i=tg(d,b)|0;rg(d);j=i}else k=3;do if((k|0)==3){i=b&255;f=b&255;if((f|0)!=(a[d+75>>0]|0)?(e=d+20|0,h=c[e>>2]|0,h>>>0<(c[d+16>>2]|0)>>>0):0){c[e>>2]=h+1;a[h>>0]=i;j=f;break}j=tg(d,b)|0}while(0);return j|0}
function $g(b){b=b|0;var d=0,e=0,f=0,g=0,h=0;d=c[1328]|0;if((c[d+76>>2]|0)>-1)e=sg(d)|0;else e=0;do if((pg(b,d)|0)<0)f=-1;else{if((a[d+75>>0]|0)!=10?(g=d+20|0,h=c[g>>2]|0,h>>>0<(c[d+16>>2]|0)>>>0):0){c[g>>2]=h+1;a[h>>0]=10;f=0;break}f=(tg(d,10)|0)>>31}while(0);if(e|0)rg(d);return f|0}function ah(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ba=0,ca=0,da=0,ea=0,fa=0,ga=0,ha=0,ia=0,ja=0,ka=0,la=0,ma=0,na=0,oa=0,pa=0,qa=0,ra=0,sa=0,ta=0,ua=0,va=0,wa=0,xa=0,ya=0,za=0,Aa=0,Da=0,Ea=0,Fa=0,Ga=0,Ha=0,Ia=0,Ja=0,Ka=0,La=0;b=Ba;Ba=Ba+16|0;if((Ba|0)>=(Ca|0))z(16);d=b;do if(a>>>0<245){e=a>>>0<11?16:a+11&-8;f=e>>>3;g=c[3398]|0;h=g>>>f;if(h&3|0){i=(h&1^1)+f|0;j=13632+(i<<1<<2)|0;k=j+8|0;l=c[k>>2]|0;m=l+8|0;n=c[m>>2]|0;if((n|0)==(j|0))c[3398]=g&~(1<<i);else{c[n+12>>2]=j;c[k>>2]=n}n=i<<3;c[l+4>>2]=n|3;i=l+n+4|0;c[i>>2]=c[i>>2]|1;o=m;Ba=b;return o|0}m=c[3400]|0;if(e>>>0>m>>>0){if(h|0){i=2<<f;n=h<<f&(i|0-i);i=(n&0-n)+-1|0;n=i>>>12&16;f=i>>>n;i=f>>>5&8;h=f>>>i;f=h>>>2&4;l=h>>>f;h=l>>>1&2;k=l>>>h;l=k>>>1&1;j=(i|n|f|h|l)+(k>>>l)|0;l=13632+(j<<1<<2)|0;k=l+8|0;h=c[k>>2]|0;f=h+8|0;n=c[f>>2]|0;if((n|0)==(l|0)){i=g&~(1<<j);c[3398]=i;p=i}else{c[n+12>>2]=l;c[k>>2]=n;p=g}n=j<<3;j=n-e|0;c[h+4>>2]=e|3;k=h+e|0;c[k+4>>2]=j|1;c[h+n>>2]=j;if(m|0){n=c[3403]|0;h=m>>>3;l=13632+(h<<1<<2)|0;i=1<<h;if(!(p&i)){c[3398]=p|i;q=l;r=l+8|0}else{i=l+8|0;q=c[i>>2]|0;r=i}c[r>>2]=n;c[q+12>>2]=n;c[n+8>>2]=q;c[n+12>>2]=l}c[3400]=j;c[3403]=k;o=f;Ba=b;return o|0}f=c[3399]|0;if(f){k=(f&0-f)+-1|0;j=k>>>12&16;l=k>>>j;k=l>>>5&8;n=l>>>k;l=n>>>2&4;i=n>>>l;n=i>>>1&2;h=i>>>n;i=h>>>1&1;s=c[13896+((k|j|l|n|i)+(h>>>i)<<2)>>2]|0;i=s;h=s;n=(c[s+4>>2]&-8)-e|0;while(1){s=c[i+16>>2]|0;if(!s){l=c[i+20>>2]|0;if(!l)break;else t=l}else t=s;s=(c[t+4>>2]&-8)-e|0;l=s>>>0<n>>>0;i=t;h=l?t:h;n=l?s:n}i=h+e|0;if(i>>>0>h>>>0){s=c[h+24>>2]|0;l=c[h+12>>2]|0;do if((l|0)==(h|0)){j=h+20|0;k=c[j>>2]|0;if(!k){u=h+16|0;v=c[u>>2]|0;if(!v){w=0;break}else{x=v;y=u}}else{x=k;y=j}j=x;k=y;while(1){u=j+20|0;v=c[u>>2]|0;if(!v){A=j+16|0;B=c[A>>2]|0;if(!B)break;else{C=B;D=A}}else{C=v;D=u}j=C;k=D}c[k>>2]=0;w=j}else{u=c[h+8>>2]|0;c[u+12>>2]=l;c[l+8>>2]=u;w=l}while(0);do if(s|0){l=c[h+28>>2]|0;u=13896+(l<<2)|0;if((h|0)==(c[u>>2]|0)){c[u>>2]=w;if(!w){c[3399]=f&~(1<<l);break}}else{l=s+16|0;c[((c[l>>2]|0)==(h|0)?l:s+20|0)>>2]=w;if(!w)break}c[w+24>>2]=s;l=c[h+16>>2]|0;if(l|0){c[w+16>>2]=l;c[l+24>>2]=w}l=c[h+20>>2]|0;if(l|0){c[w+20>>2]=l;c[l+24>>2]=w}}while(0);if(n>>>0<16){s=n+e|0;c[h+4>>2]=s|3;f=h+s+4|0;c[f>>2]=c[f>>2]|1}else{c[h+4>>2]=e|3;c[i+4>>2]=n|1;c[i+n>>2]=n;if(m|0){f=c[3403]|0;s=m>>>3;l=13632+(s<<1<<2)|0;u=1<<s;if(!(u&g)){c[3398]=u|g;E=l;F=l+8|0}else{u=l+8|0;E=c[u>>2]|0;F=u}c[F>>2]=f;c[E+12>>2]=f;c[f+8>>2]=E;c[f+12>>2]=l}c[3400]=n;c[3403]=i}o=h+8|0;Ba=b;return o|0}else G=e}else G=e}else G=e}else if(a>>>0<=4294967231){l=a+11|0;f=l&-8;u=c[3399]|0;if(u){s=0-f|0;v=l>>>8;if(v)if(f>>>0>16777215)H=31;else{l=(v+1048320|0)>>>16&8;A=v<<l;v=(A+520192|0)>>>16&4;B=A<<v;A=(B+245760|0)>>>16&2;I=14-(v|l|A)+(B<<A>>>15)|0;H=f>>>(I+7|0)&1|I<<1}else H=0;I=c[13896+(H<<2)>>2]|0;a:do if(!I){J=0;K=0;L=s;M=61}else{A=0;B=s;l=I;v=f<<((H|0)==31?0:25-(H>>>1)|0);N=0;while(1){O=(c[l+4>>2]&-8)-f|0;if(O>>>0<B>>>0)if(!O){P=l;Q=0;R=l;M=65;break a}else{S=l;T=O}else{S=A;T=B}O=c[l+20>>2]|0;l=c[l+16+(v>>>31<<2)>>2]|0;U=(O|0)==0|(O|0)==(l|0)?N:O;if(!l){J=U;K=S;L=T;M=61;break}else{A=S;B=T;v=v<<1;N=U}}}while(0);if((M|0)==61){if((J|0)==0&(K|0)==0){I=2<<H;s=(I|0-I)&u;if(!s){G=f;break}I=(s&0-s)+-1|0;s=I>>>12&16;e=I>>>s;I=e>>>5&8;h=e>>>I;e=h>>>2&4;i=h>>>e;h=i>>>1&2;n=i>>>h;i=n>>>1&1;V=0;W=c[13896+((I|s|e|h|i)+(n>>>i)<<2)>>2]|0}else{V=K;W=J}if(!W){X=V;Y=L}else{P=V;Q=L;R=W;M=65}}if((M|0)==65){i=P;n=Q;h=R;while(1){e=(c[h+4>>2]&-8)-f|0;s=e>>>0<n>>>0;I=s?e:n;e=s?h:i;s=c[h+16>>2]|0;if(!s)Z=c[h+20>>2]|0;else Z=s;if(!Z){X=e;Y=I;break}else{i=e;n=I;h=Z}}}if(((X|0)!=0?Y>>>0<((c[3400]|0)-f|0)>>>0:0)?(h=X+f|0,h>>>0>X>>>0):0){n=c[X+24>>2]|0;i=c[X+12>>2]|0;do if((i|0)==(X|0)){I=X+20|0;e=c[I>>2]|0;if(!e){s=X+16|0;g=c[s>>2]|0;if(!g){_=0;break}else{$=g;aa=s}}else{$=e;aa=I}I=$;e=aa;while(1){s=I+20|0;g=c[s>>2]|0;if(!g){m=I+16|0;N=c[m>>2]|0;if(!N)break;else{ba=N;ca=m}}else{ba=g;ca=s}I=ba;e=ca}c[e>>2]=0;_=I}else{s=c[X+8>>2]|0;c[s+12>>2]=i;c[i+8>>2]=s;_=i}while(0);do if(n){i=c[X+28>>2]|0;s=13896+(i<<2)|0;if((X|0)==(c[s>>2]|0)){c[s>>2]=_;if(!_){s=u&~(1<<i);c[3399]=s;da=s;break}}else{s=n+16|0;c[((c[s>>2]|0)==(X|0)?s:n+20|0)>>2]=_;if(!_){da=u;break}}c[_+24>>2]=n;s=c[X+16>>2]|0;if(s|0){c[_+16>>2]=s;c[s+24>>2]=_}s=c[X+20>>2]|0;if(s){c[_+20>>2]=s;c[s+24>>2]=_;da=u}else da=u}else da=u;while(0);b:do if(Y>>>0<16){u=Y+f|0;c[X+4>>2]=u|3;n=X+u+4|0;c[n>>2]=c[n>>2]|1}else{c[X+4>>2]=f|3;c[h+4>>2]=Y|1;c[h+Y>>2]=Y;n=Y>>>3;if(Y>>>0<256){u=13632+(n<<1<<2)|0;s=c[3398]|0;i=1<<n;if(!(s&i)){c[3398]=s|i;ea=u;fa=u+8|0}else{i=u+8|0;ea=c[i>>2]|0;fa=i}c[fa>>2]=h;c[ea+12>>2]=h;c[h+8>>2]=ea;c[h+12>>2]=u;break}u=Y>>>8;if(u)if(Y>>>0>16777215)ga=31;else{i=(u+1048320|0)>>>16&8;s=u<<i;u=(s+520192|0)>>>16&4;n=s<<u;s=(n+245760|0)>>>16&2;g=14-(u|i|s)+(n<<s>>>15)|0;ga=Y>>>(g+7|0)&1|g<<1}else ga=0;g=13896+(ga<<2)|0;c[h+28>>2]=ga;s=h+16|0;c[s+4>>2]=0;c[s>>2]=0;s=1<<ga;if(!(da&s)){c[3399]=da|s;c[g>>2]=h;c[h+24>>2]=g;c[h+12>>2]=h;c[h+8>>2]=h;break}s=c[g>>2]|0;c:do if((c[s+4>>2]&-8|0)==(Y|0))ha=s;else{g=Y<<((ga|0)==31?0:25-(ga>>>1)|0);n=s;while(1){ia=n+16+(g>>>31<<2)|0;i=c[ia>>2]|0;if(!i)break;if((c[i+4>>2]&-8|0)==(Y|0)){ha=i;break c}else{g=g<<1;n=i}}c[ia>>2]=h;c[h+24>>2]=n;c[h+12>>2]=h;c[h+8>>2]=h;break b}while(0);s=ha+8|0;I=c[s>>2]|0;c[I+12>>2]=h;c[s>>2]=h;c[h+8>>2]=I;c[h+12>>2]=ha;c[h+24>>2]=0}while(0);o=X+8|0;Ba=b;return o|0}else G=f}else G=f}else G=-1;while(0);X=c[3400]|0;if(X>>>0>=G>>>0){ha=X-G|0;ia=c[3403]|0;if(ha>>>0>15){Y=ia+G|0;c[3403]=Y;c[3400]=ha;c[Y+4>>2]=ha|1;c[ia+X>>2]=ha;c[ia+4>>2]=G|3}else{c[3400]=0;c[3403]=0;c[ia+4>>2]=X|3;ha=ia+X+4|0;c[ha>>2]=c[ha>>2]|1}o=ia+8|0;Ba=b;return o|0}ia=c[3401]|0;if(ia>>>0>G>>>0){ha=ia-G|0;c[3401]=ha;X=c[3404]|0;Y=X+G|0;c[3404]=Y;c[Y+4>>2]=ha|1;c[X+4>>2]=G|3;o=X+8|0;Ba=b;return o|0}if(!(c[3516]|0)){c[3518]=4096;c[3517]=4096;c[3519]=-1;c[3520]=-1;c[3521]=0;c[3509]=0;c[3516]=d&-16^1431655768;ja=4096}else ja=c[3518]|0;d=G+48|0;X=G+47|0;ha=ja+X|0;Y=0-ja|0;ja=ha&Y;if(ja>>>0<=G>>>0){o=0;Ba=b;return o|0}ga=c[3508]|0;if(ga|0?(da=c[3506]|0,ea=da+ja|0,ea>>>0<=da>>>0|ea>>>0>ga>>>0):0){o=0;Ba=b;return o|0}d:do if(!(c[3509]&4)){ga=c[3404]|0;e:do if(ga){ea=14040;while(1){da=c[ea>>2]|0;if(da>>>0<=ga>>>0?(da+(c[ea+4>>2]|0)|0)>>>0>ga>>>0:0)break;da=c[ea+8>>2]|0;if(!da){M=128;break e}else ea=da}da=ha-ia&Y;if(da>>>0<2147483647){fa=xi(da|0)|0;if((fa|0)==((c[ea>>2]|0)+(c[ea+4>>2]|0)|0))if((fa|0)==(-1|0))ka=da;else{la=da;ma=fa;M=145;break d}else{na=fa;oa=da;M=136}}else ka=0}else M=128;while(0);do if((M|0)==128){ga=xi(0)|0;if((ga|0)!=(-1|0)?(f=ga,da=c[3517]|0,fa=da+-1|0,_=((fa&f|0)==0?0:(fa+f&0-da)-f|0)+ja|0,f=c[3506]|0,da=_+f|0,_>>>0>G>>>0&_>>>0<2147483647):0){fa=c[3508]|0;if(fa|0?da>>>0<=f>>>0|da>>>0>fa>>>0:0){ka=0;break}fa=xi(_|0)|0;if((fa|0)==(ga|0)){la=_;ma=ga;M=145;break d}else{na=fa;oa=_;M=136}}else ka=0}while(0);do if((M|0)==136){_=0-oa|0;if(!(d>>>0>oa>>>0&(oa>>>0<2147483647&(na|0)!=(-1|0))))if((na|0)==(-1|0)){ka=0;break}else{la=oa;ma=na;M=145;break d}fa=c[3518]|0;ga=X-oa+fa&0-fa;if(ga>>>0>=2147483647){la=oa;ma=na;M=145;break d}if((xi(ga|0)|0)==(-1|0)){xi(_|0)|0;ka=0;break}else{la=ga+oa|0;ma=na;M=145;break d}}while(0);c[3509]=c[3509]|4;pa=ka;M=143}else{pa=0;M=143}while(0);if(((M|0)==143?ja>>>0<2147483647:0)?(ka=xi(ja|0)|0,ja=xi(0)|0,na=ja-ka|0,oa=na>>>0>(G+40|0)>>>0,!((ka|0)==(-1|0)|oa^1|ka>>>0<ja>>>0&((ka|0)!=(-1|0)&(ja|0)!=(-1|0))^1)):0){la=oa?na:pa;ma=ka;M=145}if((M|0)==145){ka=(c[3506]|0)+la|0;c[3506]=ka;if(ka>>>0>(c[3507]|0)>>>0)c[3507]=ka;ka=c[3404]|0;f:do if(ka){pa=14040;while(1){qa=c[pa>>2]|0;ra=c[pa+4>>2]|0;if((ma|0)==(qa+ra|0)){M=154;break}na=c[pa+8>>2]|0;if(!na)break;else pa=na}if(((M|0)==154?(na=pa+4|0,(c[pa+12>>2]&8|0)==0):0)?ma>>>0>ka>>>0&qa>>>0<=ka>>>0:0){c[na>>2]=ra+la;na=(c[3401]|0)+la|0;oa=ka+8|0;ja=(oa&7|0)==0?0:0-oa&7;oa=ka+ja|0;X=na-ja|0;c[3404]=oa;c[3401]=X;c[oa+4>>2]=X|1;c[ka+na+4>>2]=40;c[3405]=c[3520];break}if(ma>>>0<(c[3402]|0)>>>0)c[3402]=ma;na=ma+la|0;X=14040;while(1){if((c[X>>2]|0)==(na|0)){M=162;break}oa=c[X+8>>2]|0;if(!oa)break;else X=oa}if((M|0)==162?(c[X+12>>2]&8|0)==0:0){c[X>>2]=ma;pa=X+4|0;c[pa>>2]=(c[pa>>2]|0)+la;pa=ma+8|0;oa=ma+((pa&7|0)==0?0:0-pa&7)|0;pa=na+8|0;ja=na+((pa&7|0)==0?0:0-pa&7)|0;pa=oa+G|0;d=ja-oa-G|0;c[oa+4>>2]=G|3;g:do if((ka|0)==(ja|0)){Y=(c[3401]|0)+d|0;c[3401]=Y;c[3404]=pa;c[pa+4>>2]=Y|1}else{if((c[3403]|0)==(ja|0)){Y=(c[3400]|0)+d|0;c[3400]=Y;c[3403]=pa;c[pa+4>>2]=Y|1;c[pa+Y>>2]=Y;break}Y=c[ja+4>>2]|0;if((Y&3|0)==1){ia=Y&-8;ha=Y>>>3;h:do if(Y>>>0<256){ga=c[ja+8>>2]|0;_=c[ja+12>>2]|0;if((_|0)==(ga|0)){c[3398]=c[3398]&~(1<<ha);break}else{c[ga+12>>2]=_;c[_+8>>2]=ga;break}}else{ga=c[ja+24>>2]|0;_=c[ja+12>>2]|0;do if((_|0)==(ja|0)){fa=ja+16|0;da=fa+4|0;f=c[da>>2]|0;if(!f){ca=c[fa>>2]|0;if(!ca){sa=0;break}else{ta=ca;ua=fa}}else{ta=f;ua=da}da=ta;f=ua;while(1){fa=da+20|0;ca=c[fa>>2]|0;if(!ca){ba=da+16|0;aa=c[ba>>2]|0;if(!aa)break;else{va=aa;wa=ba}}else{va=ca;wa=fa}da=va;f=wa}c[f>>2]=0;sa=da}else{fa=c[ja+8>>2]|0;c[fa+12>>2]=_;c[_+8>>2]=fa;sa=_}while(0);if(!ga)break;_=c[ja+28>>2]|0;n=13896+(_<<2)|0;do if((c[n>>2]|0)!=(ja|0)){fa=ga+16|0;c[((c[fa>>2]|0)==(ja|0)?fa:ga+20|0)>>2]=sa;if(!sa)break h}else{c[n>>2]=sa;if(sa|0)break;c[3399]=c[3399]&~(1<<_);break h}while(0);c[sa+24>>2]=ga;_=ja+16|0;n=c[_>>2]|0;if(n|0){c[sa+16>>2]=n;c[n+24>>2]=sa}n=c[_+4>>2]|0;if(!n)break;c[sa+20>>2]=n;c[n+24>>2]=sa}while(0);xa=ja+ia|0;ya=ia+d|0}else{xa=ja;ya=d}ha=xa+4|0;c[ha>>2]=c[ha>>2]&-2;c[pa+4>>2]=ya|1;c[pa+ya>>2]=ya;ha=ya>>>3;if(ya>>>0<256){Y=13632+(ha<<1<<2)|0;ea=c[3398]|0;n=1<<ha;if(!(ea&n)){c[3398]=ea|n;za=Y;Aa=Y+8|0}else{n=Y+8|0;za=c[n>>2]|0;Aa=n}c[Aa>>2]=pa;c[za+12>>2]=pa;c[pa+8>>2]=za;c[pa+12>>2]=Y;break}Y=ya>>>8;do if(!Y)Da=0;else{if(ya>>>0>16777215){Da=31;break}n=(Y+1048320|0)>>>16&8;ea=Y<<n;ha=(ea+520192|0)>>>16&4;_=ea<<ha;ea=(_+245760|0)>>>16&2;fa=14-(ha|n|ea)+(_<<ea>>>15)|0;Da=ya>>>(fa+7|0)&1|fa<<1}while(0);Y=13896+(Da<<2)|0;c[pa+28>>2]=Da;ia=pa+16|0;c[ia+4>>2]=0;c[ia>>2]=0;ia=c[3399]|0;fa=1<<Da;if(!(ia&fa)){c[3399]=ia|fa;c[Y>>2]=pa;c[pa+24>>2]=Y;c[pa+12>>2]=pa;c[pa+8>>2]=pa;break}fa=c[Y>>2]|0;i:do if((c[fa+4>>2]&-8|0)==(ya|0))Ea=fa;else{Y=ya<<((Da|0)==31?0:25-(Da>>>1)|0);ia=fa;while(1){Fa=ia+16+(Y>>>31<<2)|0;ea=c[Fa>>2]|0;if(!ea)break;if((c[ea+4>>2]&-8|0)==(ya|0)){Ea=ea;break i}else{Y=Y<<1;ia=ea}}c[Fa>>2]=pa;c[pa+24>>2]=ia;c[pa+12>>2]=pa;c[pa+8>>2]=pa;break g}while(0);fa=Ea+8|0;Y=c[fa>>2]|0;c[Y+12>>2]=pa;c[fa>>2]=pa;c[pa+8>>2]=Y;c[pa+12>>2]=Ea;c[pa+24>>2]=0}while(0);o=oa+8|0;Ba=b;return o|0}pa=14040;while(1){d=c[pa>>2]|0;if(d>>>0<=ka>>>0?(Ga=d+(c[pa+4>>2]|0)|0,Ga>>>0>ka>>>0):0)break;pa=c[pa+8>>2]|0}pa=Ga+-47|0;oa=pa+8|0;d=pa+((oa&7|0)==0?0:0-oa&7)|0;oa=ka+16|0;pa=d>>>0<oa>>>0?ka:d;d=pa+8|0;ja=la+-40|0;na=ma+8|0;X=(na&7|0)==0?0:0-na&7;na=ma+X|0;Y=ja-X|0;c[3404]=na;c[3401]=Y;c[na+4>>2]=Y|1;c[ma+ja+4>>2]=40;c[3405]=c[3520];ja=pa+4|0;c[ja>>2]=27;c[d>>2]=c[3510];c[d+4>>2]=c[3511];c[d+8>>2]=c[3512];c[d+12>>2]=c[3513];c[3510]=ma;c[3511]=la;c[3513]=0;c[3512]=d;d=pa+24|0;do{Y=d;d=d+4|0;c[d>>2]=7}while((Y+8|0)>>>0<Ga>>>0);if((pa|0)!=(ka|0)){d=pa-ka|0;c[ja>>2]=c[ja>>2]&-2;c[ka+4>>2]=d|1;c[pa>>2]=d;Y=d>>>3;if(d>>>0<256){na=13632+(Y<<1<<2)|0;X=c[3398]|0;fa=1<<Y;if(!(X&fa)){c[3398]=X|fa;Ha=na;Ia=na+8|0}else{fa=na+8|0;Ha=c[fa>>2]|0;Ia=fa}c[Ia>>2]=ka;c[Ha+12>>2]=ka;c[ka+8>>2]=Ha;c[ka+12>>2]=na;break}na=d>>>8;if(na)if(d>>>0>16777215)Ja=31;else{fa=(na+1048320|0)>>>16&8;X=na<<fa;na=(X+520192|0)>>>16&4;Y=X<<na;X=(Y+245760|0)>>>16&2;ga=14-(na|fa|X)+(Y<<X>>>15)|0;Ja=d>>>(ga+7|0)&1|ga<<1}else Ja=0;ga=13896+(Ja<<2)|0;c[ka+28>>2]=Ja;c[ka+20>>2]=0;c[oa>>2]=0;X=c[3399]|0;Y=1<<Ja;if(!(X&Y)){c[3399]=X|Y;c[ga>>2]=ka;c[ka+24>>2]=ga;c[ka+12>>2]=ka;c[ka+8>>2]=ka;break}Y=c[ga>>2]|0;j:do if((c[Y+4>>2]&-8|0)==(d|0))Ka=Y;else{ga=d<<((Ja|0)==31?0:25-(Ja>>>1)|0);X=Y;while(1){La=X+16+(ga>>>31<<2)|0;fa=c[La>>2]|0;if(!fa)break;if((c[fa+4>>2]&-8|0)==(d|0)){Ka=fa;break j}else{ga=ga<<1;X=fa}}c[La>>2]=ka;c[ka+24>>2]=X;c[ka+12>>2]=ka;c[ka+8>>2]=ka;break f}while(0);d=Ka+8|0;Y=c[d>>2]|0;c[Y+12>>2]=ka;c[d>>2]=ka;c[ka+8>>2]=Y;c[ka+12>>2]=Ka;c[ka+24>>2]=0}}else{Y=c[3402]|0;if((Y|0)==0|ma>>>0<Y>>>0)c[3402]=ma;c[3510]=ma;c[3511]=la;c[3513]=0;c[3407]=c[3516];c[3406]=-1;c[3411]=13632;c[3410]=13632;c[3413]=13640;c[3412]=13640;c[3415]=13648;c[3414]=13648;c[3417]=13656;c[3416]=13656;c[3419]=13664;c[3418]=13664;c[3421]=13672;c[3420]=13672;c[3423]=13680;c[3422]=13680;c[3425]=13688;c[3424]=13688;c[3427]=13696;c[3426]=13696;c[3429]=13704;c[3428]=13704;c[3431]=13712;c[3430]=13712;c[3433]=13720;c[3432]=13720;c[3435]=13728;c[3434]=13728;c[3437]=13736;c[3436]=13736;c[3439]=13744;c[3438]=13744;c[3441]=13752;c[3440]=13752;c[3443]=13760;c[3442]=13760;c[3445]=13768;c[3444]=13768;c[3447]=13776;c[3446]=13776;c[3449]=13784;c[3448]=13784;c[3451]=13792;c[3450]=13792;c[3453]=13800;c[3452]=13800;c[3455]=13808;c[3454]=13808;c[3457]=13816;c[3456]=13816;c[3459]=13824;c[3458]=13824;c[3461]=13832;c[3460]=13832;c[3463]=13840;c[3462]=13840;c[3465]=13848;c[3464]=13848;c[3467]=13856;c[3466]=13856;c[3469]=13864;c[3468]=13864;c[3471]=13872;c[3470]=13872;c[3473]=13880;c[3472]=13880;Y=la+-40|0;d=ma+8|0;oa=(d&7|0)==0?0:0-d&7;d=ma+oa|0;pa=Y-oa|0;c[3404]=d;c[3401]=pa;c[d+4>>2]=pa|1;c[ma+Y+4>>2]=40;c[3405]=c[3520]}while(0);ma=c[3401]|0;if(ma>>>0>G>>>0){la=ma-G|0;c[3401]=la;ma=c[3404]|0;ka=ma+G|0;c[3404]=ka;c[ka+4>>2]=la|1;c[ma+4>>2]=G|3;o=ma+8|0;Ba=b;return o|0}}c[(ig()|0)>>2]=12;o=0;Ba=b;return o|0}function bh(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0;if(!a)return;b=a+-8|0;d=c[3402]|0;e=c[a+-4>>2]|0;a=e&-8;f=b+a|0;do if(!(e&1)){g=c[b>>2]|0;if(!(e&3))return;h=b+(0-g)|0;i=g+a|0;if(h>>>0<d>>>0)return;if((c[3403]|0)==(h|0)){j=f+4|0;k=c[j>>2]|0;if((k&3|0)!=3){l=h;m=i;n=h;break}c[3400]=i;c[j>>2]=k&-2;c[h+4>>2]=i|1;c[h+i>>2]=i;return}k=g>>>3;if(g>>>0<256){g=c[h+8>>2]|0;j=c[h+12>>2]|0;if((j|0)==(g|0)){c[3398]=c[3398]&~(1<<k);l=h;m=i;n=h;break}else{c[g+12>>2]=j;c[j+8>>2]=g;l=h;m=i;n=h;break}}g=c[h+24>>2]|0;j=c[h+12>>2]|0;do if((j|0)==(h|0)){k=h+16|0;o=k+4|0;p=c[o>>2]|0;if(!p){q=c[k>>2]|0;if(!q){r=0;break}else{s=q;t=k}}else{s=p;t=o}o=s;p=t;while(1){k=o+20|0;q=c[k>>2]|0;if(!q){u=o+16|0;v=c[u>>2]|0;if(!v)break;else{w=v;x=u}}else{w=q;x=k}o=w;p=x}c[p>>2]=0;r=o}else{k=c[h+8>>2]|0;c[k+12>>2]=j;c[j+8>>2]=k;r=j}while(0);if(g){j=c[h+28>>2]|0;k=13896+(j<<2)|0;if((c[k>>2]|0)==(h|0)){c[k>>2]=r;if(!r){c[3399]=c[3399]&~(1<<j);l=h;m=i;n=h;break}}else{j=g+16|0;c[((c[j>>2]|0)==(h|0)?j:g+20|0)>>2]=r;if(!r){l=h;m=i;n=h;break}}c[r+24>>2]=g;j=h+16|0;k=c[j>>2]|0;if(k|0){c[r+16>>2]=k;c[k+24>>2]=r}k=c[j+4>>2]|0;if(k){c[r+20>>2]=k;c[k+24>>2]=r;l=h;m=i;n=h}else{l=h;m=i;n=h}}else{l=h;m=i;n=h}}else{l=b;m=a;n=b}while(0);if(n>>>0>=f>>>0)return;b=f+4|0;a=c[b>>2]|0;if(!(a&1))return;if(!(a&2)){if((c[3404]|0)==(f|0)){r=(c[3401]|0)+m|0;c[3401]=r;c[3404]=l;c[l+4>>2]=r|1;if((l|0)!=(c[3403]|0))return;c[3403]=0;c[3400]=0;return}if((c[3403]|0)==(f|0)){r=(c[3400]|0)+m|0;c[3400]=r;c[3403]=n;c[l+4>>2]=r|1;c[n+r>>2]=r;return}r=(a&-8)+m|0;x=a>>>3;do if(a>>>0<256){w=c[f+8>>2]|0;t=c[f+12>>2]|0;if((t|0)==(w|0)){c[3398]=c[3398]&~(1<<x);break}else{c[w+12>>2]=t;c[t+8>>2]=w;break}}else{w=c[f+24>>2]|0;t=c[f+12>>2]|0;do if((t|0)==(f|0)){s=f+16|0;d=s+4|0;e=c[d>>2]|0;if(!e){k=c[s>>2]|0;if(!k){y=0;break}else{z=k;A=s}}else{z=e;A=d}d=z;e=A;while(1){s=d+20|0;k=c[s>>2]|0;if(!k){j=d+16|0;q=c[j>>2]|0;if(!q)break;else{B=q;C=j}}else{B=k;C=s}d=B;e=C}c[e>>2]=0;y=d}else{o=c[f+8>>2]|0;c[o+12>>2]=t;c[t+8>>2]=o;y=t}while(0);if(w|0){t=c[f+28>>2]|0;h=13896+(t<<2)|0;if((c[h>>2]|0)==(f|0)){c[h>>2]=y;if(!y){c[3399]=c[3399]&~(1<<t);break}}else{t=w+16|0;c[((c[t>>2]|0)==(f|0)?t:w+20|0)>>2]=y;if(!y)break}c[y+24>>2]=w;t=f+16|0;h=c[t>>2]|0;if(h|0){c[y+16>>2]=h;c[h+24>>2]=y}h=c[t+4>>2]|0;if(h|0){c[y+20>>2]=h;c[h+24>>2]=y}}}while(0);c[l+4>>2]=r|1;c[n+r>>2]=r;if((l|0)==(c[3403]|0)){c[3400]=r;return}else D=r}else{c[b>>2]=a&-2;c[l+4>>2]=m|1;c[n+m>>2]=m;D=m}m=D>>>3;if(D>>>0<256){n=13632+(m<<1<<2)|0;a=c[3398]|0;b=1<<m;if(!(a&b)){c[3398]=a|b;E=n;F=n+8|0}else{b=n+8|0;E=c[b>>2]|0;F=b}c[F>>2]=l;c[E+12>>2]=l;c[l+8>>2]=E;c[l+12>>2]=n;return}n=D>>>8;if(n)if(D>>>0>16777215)G=31;else{E=(n+1048320|0)>>>16&8;F=n<<E;n=(F+520192|0)>>>16&4;b=F<<n;F=(b+245760|0)>>>16&2;a=14-(n|E|F)+(b<<F>>>15)|0;G=D>>>(a+7|0)&1|a<<1}else G=0;a=13896+(G<<2)|0;c[l+28>>2]=G;c[l+20>>2]=0;c[l+16>>2]=0;F=c[3399]|0;b=1<<G;a:do if(!(F&b)){c[3399]=F|b;c[a>>2]=l;c[l+24>>2]=a;c[l+12>>2]=l;c[l+8>>2]=l}else{E=c[a>>2]|0;b:do if((c[E+4>>2]&-8|0)==(D|0))H=E;else{n=D<<((G|0)==31?0:25-(G>>>1)|0);m=E;while(1){I=m+16+(n>>>31<<2)|0;r=c[I>>2]|0;if(!r)break;if((c[r+4>>2]&-8|0)==(D|0)){H=r;break b}else{n=n<<1;m=r}}c[I>>2]=l;c[l+24>>2]=m;c[l+12>>2]=l;c[l+8>>2]=l;break a}while(0);E=H+8|0;w=c[E>>2]|0;c[w+12>>2]=l;c[E>>2]=l;c[l+8>>2]=w;c[l+12>>2]=H;c[l+24>>2]=0}while(0);l=(c[3406]|0)+-1|0;c[3406]=l;if(l|0)return;l=14048;while(1){H=c[l>>2]|0;if(!H)break;else l=H+8|0}c[3406]=-1;return}function ch(a){a=a|0;return}function dh(a){a=a|0;ch(a);kh(a);return}function eh(a){a=a|0;return 11688}function fh(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,v=0,w=0,x=0,y=0,A=0,B=0,C=0,D=0,E=0,F=0;b=Ba;Ba=Ba+16|0;if((Ba|0)>=(Ca|0))z(16);d=b;e=b+8|0;f=b+4|0;c[e>>2]=a;do if(a>>>0>=212){g=(a>>>0)/210|0;h=g*210|0;c[f>>2]=a-h;i=0;j=g;g=h;h=(gh(2592,2784,f,d)|0)-2592>>2;a:while(1){k=(c[2592+(h<<2)>>2]|0)+g|0;l=5;while(1){if(l>>>0>=47){m=6;break}n=c[2400+(l<<2)>>2]|0;o=(k>>>0)/(n>>>0)|0;if(o>>>0<n>>>0){m=107;break a}if((k|0)==(u(o,n)|0)){p=i;break}else l=l+1|0}b:do if((m|0)==6){m=0;l=211;n=i;c:while(1){o=(k>>>0)/(l>>>0)|0;do if(o>>>0>=l>>>0)if((k|0)!=(u(o,l)|0)){q=l+10|0;r=(k>>>0)/(q>>>0)|0;if(r>>>0>=q>>>0)if((k|0)!=(u(r,q)|0)){r=l+12|0;s=(k>>>0)/(r>>>0)|0;if(s>>>0>=r>>>0)if((k|0)!=(u(s,r)|0)){s=l+16|0;t=(k>>>0)/(s>>>0)|0;if(t>>>0>=s>>>0)if((k|0)!=(u(t,s)|0)){t=l+18|0;v=(k>>>0)/(t>>>0)|0;if(v>>>0>=t>>>0)if((k|0)!=(u(v,t)|0)){v=l+22|0;w=(k>>>0)/(v>>>0)|0;if(w>>>0>=v>>>0)if((k|0)!=(u(w,v)|0)){w=l+28|0;x=(k>>>0)/(w>>>0)|0;if(x>>>0>=w>>>0)if((k|0)==(u(x,w)|0)){y=w;A=9;B=n}else{x=l+30|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+36|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+40|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+42|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+46|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+52|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+58|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+60|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+66|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+70|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+72|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+78|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+82|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+88|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+96|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+100|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+102|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+106|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+108|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+112|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+120|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+126|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+130|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+136|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+138|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+142|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+148|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+150|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+156|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+162|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+166|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+168|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+172|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+178|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+180|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+186|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+190|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+192|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+196|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+198|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+208|0;C=(k>>>0)/(x>>>0)|0;D=C>>>0<x>>>0;E=(k|0)==(u(C,x)|0);y=D|E?x:l+210|0;A=D?1:E?9:0;B=D?k:n}else{y=w;A=1;B=k}}else{y=v;A=9;B=n}else{y=v;A=1;B=k}}else{y=t;A=9;B=n}else{y=t;A=1;B=k}}else{y=s;A=9;B=n}else{y=s;A=1;B=k}}else{y=r;A=9;B=n}else{y=r;A=1;B=k}}else{y=q;A=9;B=n}else{y=q;A=1;B=k}}else{y=l;A=9;B=n}else{y=l;A=1;B=k}while(0);switch(A&15){case 9:{p=B;break b;break}case 0:{l=y;n=B;break}default:break c}}if(!A)p=B;else{m=108;break a}}while(0);n=h+1|0;l=(n|0)==48;o=j+(l&1)|0;i=p;j=o;g=o*210|0;h=l?0:n}if((m|0)==107){c[e>>2]=k;F=k;break}else if((m|0)==108){c[e>>2]=k;F=B;break}}else F=c[(gh(2400,2592,e,d)|0)>>2]|0;while(0);Ba=b;return F|0}function gh(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0;e=c[d>>2]|0;d=a;f=b-a>>2;while(1){if(!f)break;a=(f|0)/2|0;b=d+(a<<2)|0;g=(c[b>>2]|0)>>>0<e>>>0;d=g?b+4|0:d;f=g?f+-1-a|0:a}return d|0}function hh(a){a=a|0;return}function ih(a){a=a|0;var b=0,d=0;b=a+8|0;if(!((c[b>>2]|0)!=0?(d=c[b>>2]|0,c[b>>2]=d+-1,(d|0)!=0):0))Ia[c[(c[a>>2]|0)+16>>2]&255](a);return}function jh(a){a=a|0;var b=0,c=0;b=(a|0)==0?1:a;while(1){a=ah(b)|0;if(a|0){c=a;break}a=ii()|0;if(!a){c=0;break}Ha[a&3]()}return c|0}function kh(a){a=a|0;bh(a);return}function lh(a,b){a=a|0;b=b|0;var d=0,e=0,f=0;d=og(b)|0;e=jh(d+13|0)|0;c[e>>2]=d;c[e+4>>2]=d;c[e+8>>2]=0;f=mh(e)|0;vi(f|0,b|0,d+1|0)|0;c[a>>2]=f;return}function mh(a){a=a|0;return a+12|0}function nh(a,b){a=a|0;b=b|0;c[a>>2]=5800;lh(a+4|0,b);return}function oh(a){a=a|0;return 1}function ph(a){a=a|0;ma()}function qh(b,d){b=b|0;d=d|0;c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;if((a[d+11>>0]|0)<0)rh(b,c[d>>2]|0,c[d+4>>2]|0);else{c[b>>2]=c[d>>2];c[b+4>>2]=c[d+4>>2];c[b+8>>2]=c[d+8>>2]}return}function rh(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0;f=Ba;Ba=Ba+16|0;if((Ba|0)>=(Ca|0))z(16);g=f;if(e>>>0>4294967279)ph(b);if(e>>>0<11){a[b+11>>0]=e;h=b}else{i=e+16&-16;j=jh(i)|0;c[b>>2]=j;c[b+8>>2]=i|-2147483648;c[b+4>>2]=e;h=j}sh(h,d,e)|0;a[g>>0]=0;th(h+e|0,g);Ba=f;return}function sh(a,b,c){a=a|0;b=b|0;c=c|0;if(c|0)vi(a|0,b|0,c|0)|0;return a|0}function th(b,c){b=b|0;c=c|0;a[b>>0]=a[c>>0]|0;return}function uh(a){a=a|0;ma()}function vh(){var a=0,b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0;a=Ba;Ba=Ba+48|0;if((Ba|0)>=(Ca|0))z(48);b=a+32|0;d=a+24|0;e=a+16|0;f=a;g=a+36|0;a=wh()|0;if(a|0?(h=c[a>>2]|0,h|0):0){a=h+48|0;i=c[a>>2]|0;j=c[a+4>>2]|0;if(!((i&-256|0)==1126902528&(j|0)==1129074247)){c[d>>2]=11930;xh(11880,d)}if((i|0)==1126902529&(j|0)==1129074247)k=c[h+44>>2]|0;else k=h+80|0;c[g>>2]=k;k=c[h>>2]|0;h=c[k+4>>2]|0;if(Ga[c[(c[922]|0)+16>>2]&7](3688,k,g)|0){k=c[g>>2]|0;g=Ea[c[(c[k>>2]|0)+8>>2]&63](k)|0;c[f>>2]=11930;c[f+4>>2]=h;c[f+8>>2]=g;xh(11794,f)}else{c[e>>2]=11930;c[e+4>>2]=h;xh(11839,e)}}xh(11918,b)}function wh(){var a=0,b=0;a=Ba;Ba=Ba+16|0;if((Ba|0)>=(Ca|0))z(16);if(!(xa(14088,3)|0)){b=va(c[3523]|0)|0;Ba=a;return b|0}else xh(12069,a);return 0}function xh(a,b){a=a|0;b=b|0;var d=0,e=0;d=Ba;Ba=Ba+16|0;if((Ba|0)>=(Ca|0))z(16);e=d;c[e>>2]=b;b=c[1296]|0;Eg(b,a,e)|0;_g(10,b)|0;ma()}function yh(a){a=a|0;return}function zh(a){a=a|0;yh(a);kh(a);return}function Ah(a){a=a|0;return}function Bh(a){a=a|0;return}function Ch(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0;e=Ba;Ba=Ba+64|0;if((Ba|0)>=(Ca|0))z(64);f=e;if(!(Gh(a,b,0)|0))if((b|0)!=0?(g=Kh(b,3712,3696,0)|0,(g|0)!=0):0){b=f+4|0;h=b+52|0;do{c[b>>2]=0;b=b+4|0}while((b|0)<(h|0));c[f>>2]=g;c[f+8>>2]=a;c[f+12>>2]=-1;c[f+48>>2]=1;Ma[c[(c[g>>2]|0)+28>>2]&31](g,f,c[d>>2]|0,1);if((c[f+24>>2]|0)==1){c[d>>2]=c[f+16>>2];i=1}else i=0;j=i}else j=0;else j=1;Ba=e;return j|0}function Dh(a,b,d,e,f,g){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;if(Gh(a,c[b+8>>2]|0,g)|0)Jh(0,b,d,e,f);return}function Eh(b,d,e,f,g){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0;do if(!(Gh(b,c[d+8>>2]|0,g)|0)){if(Gh(b,c[d>>2]|0,g)|0){if((c[d+16>>2]|0)!=(e|0)?(h=d+20|0,(c[h>>2]|0)!=(e|0)):0){c[d+32>>2]=f;c[h>>2]=e;h=d+40|0;c[h>>2]=(c[h>>2]|0)+1;if((c[d+36>>2]|0)==1?(c[d+24>>2]|0)==2:0)a[d+54>>0]=1;c[d+44>>2]=4;break}if((f|0)==1)c[d+32>>2]=1}}else Ih(0,d,e,f);while(0);return}function Fh(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;if(Gh(a,c[b+8>>2]|0,0)|0)Hh(0,b,d,e);return}function Gh(a,b,c){a=a|0;b=b|0;c=c|0;return (a|0)==(b|0)|0}function Hh(b,d,e,f){b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0;b=d+16|0;g=c[b>>2]|0;do if(g){if((g|0)!=(e|0)){h=d+36|0;c[h>>2]=(c[h>>2]|0)+1;c[d+24>>2]=2;a[d+54>>0]=1;break}h=d+24|0;if((c[h>>2]|0)==2)c[h>>2]=f}else{c[b>>2]=e;c[d+24>>2]=f;c[d+36>>2]=1}while(0);return}function Ih(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;if((c[b+4>>2]|0)==(d|0)?(d=b+28|0,(c[d>>2]|0)!=1):0)c[d>>2]=e;return}function Jh(b,d,e,f,g){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0;a[d+53>>0]=1;do if((c[d+4>>2]|0)==(f|0)){a[d+52>>0]=1;b=d+16|0;h=c[b>>2]|0;if(!h){c[b>>2]=e;c[d+24>>2]=g;c[d+36>>2]=1;if(!((g|0)==1?(c[d+48>>2]|0)==1:0))break;a[d+54>>0]=1;break}if((h|0)!=(e|0)){h=d+36|0;c[h>>2]=(c[h>>2]|0)+1;a[d+54>>0]=1;break}h=d+24|0;b=c[h>>2]|0;if((b|0)==2){c[h>>2]=g;i=g}else i=b;if((i|0)==1?(c[d+48>>2]|0)==1:0)a[d+54>>0]=1}while(0);return}function Kh(d,e,f,g){d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0;h=Ba;Ba=Ba+64|0;if((Ba|0)>=(Ca|0))z(64);i=h;j=c[d>>2]|0;k=d+(c[j+-8>>2]|0)|0;l=c[j+-4>>2]|0;c[i>>2]=f;c[i+4>>2]=d;c[i+8>>2]=e;c[i+12>>2]=g;g=i+16|0;e=i+20|0;d=i+24|0;j=i+28|0;m=i+32|0;n=i+40|0;o=g;p=o+36|0;do{c[o>>2]=0;o=o+4|0}while((o|0)<(p|0));b[g+36>>1]=0;a[g+38>>0]=0;a:do if(Gh(l,f,0)|0){c[i+48>>2]=1;Oa[c[(c[l>>2]|0)+20>>2]&3](l,i,k,k,1,0);q=(c[d>>2]|0)==1?k:0}else{Na[c[(c[l>>2]|0)+24>>2]&3](l,i,k,1,0);switch(c[i+36>>2]|0){case 0:{q=(c[n>>2]|0)==1&(c[j>>2]|0)==1&(c[m>>2]|0)==1?c[e>>2]|0:0;break a;break}case 1:break;default:{q=0;break a}}if((c[d>>2]|0)!=1?!((c[n>>2]|0)==0&(c[j>>2]|0)==1&(c[m>>2]|0)==1):0){q=0;break}q=c[g>>2]|0}while(0);Ba=h;return q|0}function Lh(a){a=a|0;yh(a);kh(a);return}function Mh(a,b,d,e,f,g){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0;if(Gh(a,c[b+8>>2]|0,g)|0)Jh(0,b,d,e,f);else{h=c[a+8>>2]|0;Oa[c[(c[h>>2]|0)+20>>2]&3](h,b,d,e,f,g)}return}function Nh(b,d,e,f,g){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0;do if(!(Gh(b,c[d+8>>2]|0,g)|0)){if(!(Gh(b,c[d>>2]|0,g)|0)){h=c[b+8>>2]|0;Na[c[(c[h>>2]|0)+24>>2]&3](h,d,e,f,g);break}if((c[d+16>>2]|0)!=(e|0)?(h=d+20|0,(c[h>>2]|0)!=(e|0)):0){c[d+32>>2]=f;i=d+44|0;if((c[i>>2]|0)==4)break;j=d+52|0;a[j>>0]=0;k=d+53|0;a[k>>0]=0;l=c[b+8>>2]|0;Oa[c[(c[l>>2]|0)+20>>2]&3](l,d,e,e,1,g);if(a[k>>0]|0)if(!(a[j>>0]|0)){m=1;n=11}else n=15;else{m=0;n=11}do if((n|0)==11){c[h>>2]=e;j=d+40|0;c[j>>2]=(c[j>>2]|0)+1;if((c[d+36>>2]|0)==1?(c[d+24>>2]|0)==2:0){a[d+54>>0]=1;if(m){n=15;break}else{o=4;break}}if(m)n=15;else o=4}while(0);if((n|0)==15)o=3;c[i>>2]=o;break}if((f|0)==1)c[d+32>>2]=1}else Ih(0,d,e,f);while(0);return}function Oh(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0;if(Gh(a,c[b+8>>2]|0,0)|0)Hh(0,b,d,e);else{f=c[a+8>>2]|0;Ma[c[(c[f>>2]|0)+28>>2]&31](f,b,d,e)}return}function Ph(a){a=a|0;return}function Qh(){var a=0;a=Ba;Ba=Ba+16|0;if((Ba|0)>=(Ca|0))z(16);if(!(wa(14092,132)|0)){Ba=a;return}else xh(12118,a)}function Rh(a){a=a|0;var b=0;b=Ba;Ba=Ba+16|0;if((Ba|0)>=(Ca|0))z(16);bh(a);if(!(ya(c[3523]|0,0)|0)){Ba=b;return}else xh(12168,b)}function Sh(){var a=0,b=0;a=wh()|0;if((a|0?(b=c[a>>2]|0,b|0):0)?(a=b+48|0,(c[a>>2]&-256|0)==1126902528?(c[a+4>>2]|0)==1129074247:0):0)Th(c[b+12>>2]|0);Th(Uh()|0)}function Th(a){a=a|0;var b=0;b=Ba;Ba=Ba+16|0;if((Ba|0)>=(Ca|0))z(16);Ha[a&3]();xh(12221,b)}function Uh(){var a=0;a=c[1427]|0;c[1427]=a+0;return a|0}function Vh(a){a=a|0;return}function Wh(a){a=a|0;c[a>>2]=5800;_h(a+4|0);return}function Xh(a){a=a|0;Wh(a);kh(a);return}function Yh(a){a=a|0;return Zh(a+4|0)|0}function Zh(a){a=a|0;return c[a>>2]|0}function _h(a){a=a|0;var b=0,d=0;if(oh(a)|0?(b=$h(c[a>>2]|0)|0,a=b+8|0,d=c[a>>2]|0,c[a>>2]=d+-1,(d+-1|0)<0):0)kh(b);return}function $h(a){a=a|0;return a+-12|0}function ai(a){a=a|0;Wh(a);kh(a);return}function bi(a){a=a|0;yh(a);kh(a);return}function ci(b,d,e,f,g,h){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;h=h|0;var i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0;if(Gh(b,c[d+8>>2]|0,h)|0)Jh(0,d,e,f,g);else{i=d+52|0;j=a[i>>0]|0;k=d+53|0;l=a[k>>0]|0;m=c[b+12>>2]|0;n=b+16+(m<<3)|0;a[i>>0]=0;a[k>>0]=0;gi(b+16|0,d,e,f,g,h);a:do if((m|0)>1){o=d+24|0;p=b+8|0;q=d+54|0;r=b+24|0;do{if(a[q>>0]|0)break a;if(!(a[i>>0]|0)){if(a[k>>0]|0?(c[p>>2]&1|0)==0:0)break a}else{if((c[o>>2]|0)==1)break a;if(!(c[p>>2]&2))break a}a[i>>0]=0;a[k>>0]=0;gi(r,d,e,f,g,h);r=r+8|0}while(r>>>0<n>>>0)}while(0);a[i>>0]=j;a[k>>0]=l}return}function di(b,d,e,f,g){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0;a:do if(!(Gh(b,c[d+8>>2]|0,g)|0)){if(!(Gh(b,c[d>>2]|0,g)|0)){h=c[b+12>>2]|0;i=b+16+(h<<3)|0;hi(b+16|0,d,e,f,g);j=b+24|0;if((h|0)<=1)break;h=c[b+8>>2]|0;if((h&2|0)==0?(k=d+36|0,(c[k>>2]|0)!=1):0){if(!(h&1)){h=d+54|0;l=j;while(1){if(a[h>>0]|0)break a;if((c[k>>2]|0)==1)break a;hi(l,d,e,f,g);l=l+8|0;if(l>>>0>=i>>>0)break a}}l=d+24|0;h=d+54|0;m=j;while(1){if(a[h>>0]|0)break a;if((c[k>>2]|0)==1?(c[l>>2]|0)==1:0)break a;hi(m,d,e,f,g);m=m+8|0;if(m>>>0>=i>>>0)break a}}m=d+54|0;l=j;while(1){if(a[m>>0]|0)break a;hi(l,d,e,f,g);l=l+8|0;if(l>>>0>=i>>>0)break a}}if((c[d+16>>2]|0)!=(e|0)?(i=d+20|0,(c[i>>2]|0)!=(e|0)):0){c[d+32>>2]=f;l=d+44|0;if((c[l>>2]|0)==4)break;m=b+16+(c[b+12>>2]<<3)|0;j=d+52|0;k=d+53|0;h=d+54|0;n=b+8|0;o=d+24|0;p=0;q=b+16|0;r=0;b:while(1){if(q>>>0>=m>>>0){s=p;t=18;break}a[j>>0]=0;a[k>>0]=0;gi(q,d,e,e,1,g);if(a[h>>0]|0){s=p;t=18;break}do if(a[k>>0]|0){if(!(a[j>>0]|0))if(!(c[n>>2]&1)){s=1;t=18;break b}else{u=1;v=r;break}if((c[o>>2]|0)==1){t=23;break b}if(!(c[n>>2]&2)){t=23;break b}else{u=1;v=1}}else{u=p;v=r}while(0);p=u;q=q+8|0;r=v}do if((t|0)==18){if((!r?(c[i>>2]=e,q=d+40|0,c[q>>2]=(c[q>>2]|0)+1,(c[d+36>>2]|0)==1):0)?(c[o>>2]|0)==2:0){a[h>>0]=1;if(s){t=23;break}else{w=4;break}}if(s)t=23;else w=4}while(0);if((t|0)==23)w=3;c[l>>2]=w;break}if((f|0)==1)c[d+32>>2]=1}else Ih(0,d,e,f);while(0);return}function ei(b,d,e,f){b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0;a:do if(!(Gh(b,c[d+8>>2]|0,0)|0)){g=c[b+12>>2]|0;h=b+16+(g<<3)|0;fi(b+16|0,d,e,f);if((g|0)>1){g=d+54|0;i=b+24|0;do{fi(i,d,e,f);if(a[g>>0]|0)break a;i=i+8|0}while(i>>>0<h>>>0)}}else Hh(0,d,e,f);while(0);return}function fi(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0;f=c[a+4>>2]|0;g=f>>8;if(!(f&1))h=g;else h=c[(c[d>>2]|0)+g>>2]|0;g=c[a>>2]|0;Ma[c[(c[g>>2]|0)+28>>2]&31](g,b,d+h|0,(f&2|0)==0?2:e);return}function gi(a,b,d,e,f,g){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0,j=0;h=c[a+4>>2]|0;i=h>>8;if(!(h&1))j=i;else j=c[(c[e>>2]|0)+i>>2]|0;i=c[a>>2]|0;Oa[c[(c[i>>2]|0)+20>>2]&3](i,b,d,e+j|0,(h&2|0)==0?2:f,g);return}function hi(a,b,d,e,f){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0;g=c[a+4>>2]|0;h=g>>8;if(!(g&1))i=h;else i=c[(c[d>>2]|0)+h>>2]|0;h=c[a>>2]|0;Na[c[(c[h>>2]|0)+24>>2]&3](h,b,d+i|0,(g&2|0)==0?2:e,f);return}function ii(){var a=0;a=c[3524]|0;c[3524]=a+0;return a|0}function ji(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0;e=Ba;Ba=Ba+16|0;if((Ba|0)>=(Ca|0))z(16);f=e;c[f>>2]=c[d>>2];g=Ga[c[(c[a>>2]|0)+16>>2]&7](a,b,f)|0;if(g)c[d>>2]=c[f>>2];Ba=e;return g&1|0}function ki(a){a=a|0;var b=0;if(!a)b=0;else b=(Kh(a,3712,3800,0)|0)!=0&1;return b|0}function li(a,b){a=a|0;b=b|0;var c=0,d=0,e=0,f=0;c=a&65535;d=b&65535;e=u(d,c)|0;f=a>>>16;a=(e>>>16)+(u(d,f)|0)|0;d=b>>>16;b=u(d,c)|0;return (x((a>>>16)+(u(d,f)|0)+(((a&65535)+b|0)>>>16)|0),a+b<<16|e&65535|0)|0}function mi(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;var e=0,f=0;e=a;a=c;c=li(e,a)|0;f=y()|0;return (x((u(b,a)|0)+(u(d,e)|0)+f|f&0|0),c|0|0)|0}function ni(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;var e=0;e=a+c>>>0;return (x(b+d+(e>>>0<a>>>0|0)>>>0|0),e|0)|0}function oi(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;var e=0;e=b-d>>>0;e=b-d-(c>>>0>a>>>0|0)>>>0;return (x(e|0),a-c>>>0|0)|0}function pi(a){a=a|0;return (a?31-(v(a^a-1)|0)|0:32)|0}function qi(a,b,d,e,f){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,w=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0;g=a;h=b;i=h;j=d;k=e;l=k;if(!i){m=(f|0)!=0;if(!l){if(m){c[f>>2]=(g>>>0)%(j>>>0);c[f+4>>2]=0}n=0;o=(g>>>0)/(j>>>0)>>>0;return (x(n|0),o)|0}else{if(!m){n=0;o=0;return (x(n|0),o)|0}c[f>>2]=a|0;c[f+4>>2]=b&0;n=0;o=0;return (x(n|0),o)|0}}m=(l|0)==0;do if(j){if(!m){p=(v(l|0)|0)-(v(i|0)|0)|0;if(p>>>0<=31){q=p+1|0;r=31-p|0;s=p-31>>31;t=q;u=g>>>(q>>>0)&s|i<<r;w=i>>>(q>>>0)&s;z=0;A=g<<r;break}if(!f){n=0;o=0;return (x(n|0),o)|0}c[f>>2]=a|0;c[f+4>>2]=h|b&0;n=0;o=0;return (x(n|0),o)|0}r=j-1|0;if(r&j|0){s=(v(j|0)|0)+33-(v(i|0)|0)|0;q=64-s|0;p=32-s|0;B=p>>31;C=s-32|0;D=C>>31;t=s;u=p-1>>31&i>>>(C>>>0)|(i<<p|g>>>(s>>>0))&D;w=D&i>>>(s>>>0);z=g<<q&B;A=(i<<q|g>>>(C>>>0))&B|g<<p&s-33>>31;break}if(f|0){c[f>>2]=r&g;c[f+4>>2]=0}if((j|0)==1){n=h|b&0;o=a|0|0;return (x(n|0),o)|0}else{r=pi(j|0)|0;n=i>>>(r>>>0)|0;o=i<<32-r|g>>>(r>>>0)|0;return (x(n|0),o)|0}}else{if(m){if(f|0){c[f>>2]=(i>>>0)%(j>>>0);c[f+4>>2]=0}n=0;o=(i>>>0)/(j>>>0)>>>0;return (x(n|0),o)|0}if(!g){if(f|0){c[f>>2]=0;c[f+4>>2]=(i>>>0)%(l>>>0)}n=0;o=(i>>>0)/(l>>>0)>>>0;return (x(n|0),o)|0}r=l-1|0;if(!(r&l)){if(f|0){c[f>>2]=a|0;c[f+4>>2]=r&i|b&0}n=0;o=i>>>((pi(l|0)|0)>>>0);return (x(n|0),o)|0}r=(v(l|0)|0)-(v(i|0)|0)|0;if(r>>>0<=30){s=r+1|0;p=31-r|0;t=s;u=i<<p|g>>>(s>>>0);w=i>>>(s>>>0);z=0;A=g<<p;break}if(!f){n=0;o=0;return (x(n|0),o)|0}c[f>>2]=a|0;c[f+4>>2]=h|b&0;n=0;o=0;return (x(n|0),o)|0}while(0);if(!t){E=A;F=z;G=w;H=u;I=0;J=0}else{b=d|0|0;d=k|e&0;e=ni(b|0,d|0,-1,-1)|0;k=y()|0;h=A;A=z;z=w;w=u;u=t;t=0;do{a=h;h=A>>>31|h<<1;A=t|A<<1;g=w<<1|a>>>31|0;a=w>>>31|z<<1|0;oi(e|0,k|0,g|0,a|0)|0;i=y()|0;l=i>>31|((i|0)<0?-1:0)<<1;t=l&1;w=oi(g|0,a|0,l&b|0,(((i|0)<0?-1:0)>>31|((i|0)<0?-1:0)<<1)&d|0)|0;z=y()|0;u=u-1|0}while((u|0)!=0);E=h;F=A;G=z;H=w;I=0;J=t}t=F;F=0;if(f|0){c[f>>2]=H;c[f+4>>2]=G}n=(t|0)>>>31|(E|F)<<1|(F<<1|t>>>31)&0|I;o=(t<<1|0>>>31)&-2|J;return (x(n|0),o)|0}function ri(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;return qi(a,b,c,d,0)|0}function si(a,b,c){a=a|0;b=b|0;c=c|0;if((c|0)<32){x(b>>>c|0);return a>>>c|(b&(1<<c)-1)<<32-c}x(0);return b>>>c-32|0}function ti(a,b,c){a=a|0;b=b|0;c=c|0;if((c|0)<32){x(b<<c|(a&(1<<c)-1<<32-c)>>>32-c|0);return a<<c}x(a<<c-32|0);return 0}function ui(a){a=a|0;return (a&255)<<24|(a>>8&255)<<16|(a>>16&255)<<8|a>>>24|0}function vi(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0;if((e|0)>=8192){pa(b|0,d|0,e|0)|0;return b|0}f=b|0;g=b+e|0;if((b&3)==(d&3)){while(b&3){if(!e)return f|0;a[b>>0]=a[d>>0]|0;b=b+1|0;d=d+1|0;e=e-1|0}h=g&-4|0;e=h-64|0;while((b|0)<=(e|0)){c[b>>2]=c[d>>2];c[b+4>>2]=c[d+4>>2];c[b+8>>2]=c[d+8>>2];c[b+12>>2]=c[d+12>>2];c[b+16>>2]=c[d+16>>2];c[b+20>>2]=c[d+20>>2];c[b+24>>2]=c[d+24>>2];c[b+28>>2]=c[d+28>>2];c[b+32>>2]=c[d+32>>2];c[b+36>>2]=c[d+36>>2];c[b+40>>2]=c[d+40>>2];c[b+44>>2]=c[d+44>>2];c[b+48>>2]=c[d+48>>2];c[b+52>>2]=c[d+52>>2];c[b+56>>2]=c[d+56>>2];c[b+60>>2]=c[d+60>>2];b=b+64|0;d=d+64|0}while((b|0)<(h|0)){c[b>>2]=c[d>>2];b=b+4|0;d=d+4|0}}else{h=g-4|0;while((b|0)<(h|0)){a[b>>0]=a[d>>0]|0;a[b+1>>0]=a[d+1>>0]|0;a[b+2>>0]=a[d+2>>0]|0;a[b+3>>0]=a[d+3>>0]|0;b=b+4|0;d=d+4|0}}while((b|0)<(g|0)){a[b>>0]=a[d>>0]|0;b=b+1|0;d=d+1|0}return f|0}function wi(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0;f=b+e|0;d=d&255;if((e|0)>=67){while(b&3){a[b>>0]=d;b=b+1|0}g=f&-4|0;h=d|d<<8|d<<16|d<<24;i=g-64|0;while((b|0)<=(i|0)){c[b>>2]=h;c[b+4>>2]=h;c[b+8>>2]=h;c[b+12>>2]=h;c[b+16>>2]=h;c[b+20>>2]=h;c[b+24>>2]=h;c[b+28>>2]=h;c[b+32>>2]=h;c[b+36>>2]=h;c[b+40>>2]=h;c[b+44>>2]=h;c[b+48>>2]=h;c[b+52>>2]=h;c[b+56>>2]=h;c[b+60>>2]=h;b=b+64|0}while((b|0)<(g|0)){c[b>>2]=h;b=b+4|0}}while((b|0)<(f|0)){a[b>>0]=d;b=b+1|0}return f-e|0}function xi(a){a=a|0;var b=0,d=0;b=c[i>>2]|0;d=b+a|0;if((a|0)>0&(d|0)<(b|0)|(d|0)<0){za(d|0)|0;ga(12);return -1}if((d|0)>(na()|0)){if(!(qa(d|0)|0)){ga(12);return -1}}else c[i>>2]=d;return b|0}function yi(a,b){a=a|0;b=b|0;return Ea[a&63](b|0)|0}function zi(a,b,c){a=a|0;b=b|0;c=c|0;return Fa[a&63](b|0,c|0)|0}function Ai(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;return Ga[a&7](b|0,c|0,d|0)|0}function Bi(a){a=a|0;Ha[a&3]()}function Ci(a,b){a=a|0;b=b|0;Ia[a&255](b|0)}function Di(a,b,c){a=a|0;b=b|0;c=c|0;Ja[a&31](b|0,c|0)}function Ei(a,b,c,d){a=a|0;b=b|0;c=c|0;d=+d;Ka[a&1](b|0,c|0,+d)}function Fi(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;La[a&3](b|0,c|0,d|0)}function Gi(a,b,c,d,e){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;Ma[a&31](b|0,c|0,d|0,e|0)}function Hi(a,b,c,d,e,f){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;f=f|0;Na[a&3](b|0,c|0,d|0,e|0,f|0)}function Ii(a,b,c,d,e,f,g){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;f=f|0;g=g|0;Oa[a&3](b|0,c|0,d|0,e|0,f|0,g|0)}function Ji(a){a=a|0;A(0);return 0}function Ki(a){a=a|0;A(37);return 0}function Li(a){a=a|0;A(38);return 0}function Mi(a){a=a|0;A(39);return 0}function Ni(a){a=a|0;A(40);return 0}function Oi(a){a=a|0;A(41);return 0}function Pi(a){a=a|0;A(42);return 0}function Qi(a){a=a|0;A(43);return 0}function Ri(a){a=a|0;A(44);return 0}function Si(a){a=a|0;A(45);return 0}function Ti(a){a=a|0;A(46);return 0}function Ui(a){a=a|0;A(47);return 0}function Vi(a){a=a|0;A(48);return 0}function Wi(a){a=a|0;A(49);return 0}function Xi(a){a=a|0;A(50);return 0}function Yi(a){a=a|0;A(51);return 0}function Zi(a){a=a|0;A(52);return 0}function _i(a){a=a|0;A(53);return 0}function $i(a){a=a|0;A(54);return 0}function aj(a){a=a|0;A(55);return 0}function bj(a){a=a|0;A(56);return 0}function cj(a){a=a|0;A(57);return 0}function dj(a){a=a|0;A(58);return 0}function ej(a){a=a|0;A(59);return 0}function fj(a){a=a|0;A(60);return 0}function gj(a){a=a|0;A(61);return 0}function hj(a){a=a|0;A(62);return 0}function ij(a){a=a|0;A(63);return 0}function jj(a,b){a=a|0;b=b|0;B(0);return 0}function kj(a,b){a=a|0;b=b|0;B(34);return 0}function lj(a,b){a=a|0;b=b|0;B(35);return 0}function mj(a,b){a=a|0;b=b|0;B(36);return 0}function nj(a,b){a=a|0;b=b|0;B(37);return 0}function oj(a,b){a=a|0;b=b|0;B(38);return 0}function pj(a,b){a=a|0;b=b|0;B(39);return 0}function qj(a,b){a=a|0;b=b|0;B(40);return 0}function rj(a,b){a=a|0;b=b|0;B(41);return 0}function sj(a,b){a=a|0;b=b|0;B(42);return 0}function tj(a,b){a=a|0;b=b|0;B(43);return 0}function uj(a,b){a=a|0;b=b|0;B(44);return 0}function vj(a,b){a=a|0;b=b|0;B(45);return 0}function wj(a,b){a=a|0;b=b|0;B(46);return 0}function xj(a,b){a=a|0;b=b|0;B(47);return 0}function yj(a,b){a=a|0;b=b|0;B(48);return 0}function zj(a,b){a=a|0;b=b|0;B(49);return 0}function Aj(a,b){a=a|0;b=b|0;B(50);return 0}function Bj(a,b){a=a|0;b=b|0;B(51);return 0}function Cj(a,b){a=a|0;b=b|0;B(52);return 0}function Dj(a,b){a=a|0;b=b|0;B(53);return 0}function Ej(a,b){a=a|0;b=b|0;B(54);return 0}function Fj(a,b){a=a|0;b=b|0;B(55);return 0}function Gj(a,b){a=a|0;b=b|0;B(56);return 0}function Hj(a,b){a=a|0;b=b|0;B(57);return 0}function Ij(a,b){a=a|0;b=b|0;B(58);return 0}function Jj(a,b){a=a|0;b=b|0;B(59);return 0}function Kj(a,b){a=a|0;b=b|0;B(60);return 0}function Lj(a,b){a=a|0;b=b|0;B(61);return 0}function Mj(a,b){a=a|0;b=b|0;B(62);return 0}function Nj(a,b){a=a|0;b=b|0;B(63);return 0}function Oj(a,b,c){a=a|0;b=b|0;c=c|0;C(0);return 0}function Pj(a,b,c){a=a|0;b=b|0;c=c|0;C(5);return 0}function Qj(a,b,c){a=a|0;b=b|0;c=c|0;C(6);return 0}function Rj(a,b,c){a=a|0;b=b|0;c=c|0;C(7);return 0}function Sj(){D(0)}function Tj(a){a=a|0;E(0)}function Uj(a){a=a|0;E(133)}function Vj(a){a=a|0;E(134)}function Wj(a){a=a|0;E(135)}function Xj(a){a=a|0;E(136)}function Yj(a){a=a|0;E(137)}function Zj(a){a=a|0;E(138)}function _j(a){a=a|0;E(139)}function $j(a){a=a|0;E(140)}function ak(a){a=a|0;E(141)}function bk(a){a=a|0;E(142)}function ck(a){a=a|0;E(143)}function dk(a){a=a|0;E(144)}function ek(a){a=a|0;E(145)}function fk(a){a=a|0;E(146)}function gk(a){a=a|0;E(147)}function hk(a){a=a|0;E(148)}function ik(a){a=a|0;E(149)}function jk(a){a=a|0;E(150)}function kk(a){a=a|0;E(151)}function lk(a){a=a|0;E(152)}function mk(a){a=a|0;E(153)}function nk(a){a=a|0;E(154)}function ok(a){a=a|0;E(155)}function pk(a){a=a|0;E(156)}function qk(a){a=a|0;E(157)}function rk(a){a=a|0;E(158)}function sk(a){a=a|0;E(159)}function tk(a){a=a|0;E(160)}function uk(a){a=a|0;E(161)}function vk(a){a=a|0;E(162)}function wk(a){a=a|0;E(163)}function xk(a){a=a|0;E(164)}function yk(a){a=a|0;E(165)}function zk(a){a=a|0;E(166)}function Ak(a){a=a|0;E(167)}function Bk(a){a=a|0;E(168)}function Ck(a){a=a|0;E(169)}function Dk(a){a=a|0;E(170)}function Ek(a){a=a|0;E(171)}function Fk(a){a=a|0;E(172)}function Gk(a){a=a|0;E(173)}function Hk(a){a=a|0;E(174)}function Ik(a){a=a|0;E(175)}function Jk(a){a=a|0;E(176)}function Kk(a){a=a|0;E(177)}function Lk(a){a=a|0;E(178)}function Mk(a){a=a|0;E(179)}function Nk(a){a=a|0;E(180)}function Ok(a){a=a|0;E(181)}function Pk(a){a=a|0;E(182)}function Qk(a){a=a|0;E(183)}function Rk(a){a=a|0;E(184)}function Sk(a){a=a|0;E(185)}function Tk(a){a=a|0;E(186)}function Uk(a){a=a|0;E(187)}function Vk(a){a=a|0;E(188)}function Wk(a){a=a|0;E(189)}function Xk(a){a=a|0;E(190)}function Yk(a){a=a|0;E(191)}function Zk(a){a=a|0;E(192)}function _k(a){a=a|0;E(193)}function $k(a){a=a|0;E(194)}function al(a){a=a|0;E(195)}function bl(a){a=a|0;E(196)}function cl(a){a=a|0;E(197)}function dl(a){a=a|0;E(198)}function el(a){a=a|0;E(199)}function fl(a){a=a|0;E(200)}function gl(a){a=a|0;E(201)}function hl(a){a=a|0;E(202)}function il(a){a=a|0;E(203)}function jl(a){a=a|0;E(204)}function kl(a){a=a|0;E(205)}function ll(a){a=a|0;E(206)}function ml(a){a=a|0;E(207)}function nl(a){a=a|0;E(208)}function ol(a){a=a|0;E(209)}function pl(a){a=a|0;E(210)}function ql(a){a=a|0;E(211)}function rl(a){a=a|0;E(212)}function sl(a){a=a|0;E(213)}function tl(a){a=a|0;E(214)}function ul(a){a=a|0;E(215)}function vl(a){a=a|0;E(216)}function wl(a){a=a|0;E(217)}function xl(a){a=a|0;E(218)}function yl(a){a=a|0;E(219)}function zl(a){a=a|0;E(220)}function Al(a){a=a|0;E(221)}function Bl(a){a=a|0;E(222)}function Cl(a){a=a|0;E(223)}function Dl(a){a=a|0;E(224)}function El(a){a=a|0;E(225)}function Fl(a){a=a|0;E(226)}function Gl(a){a=a|0;E(227)}function Hl(a){a=a|0;E(228)}function Il(a){a=a|0;E(229)}function Jl(a){a=a|0;E(230)}function Kl(a){a=a|0;E(231)}function Ll(a){a=a|0;E(232)}function Ml(a){a=a|0;E(233)}function Nl(a){a=a|0;E(234)}function Ol(a){a=a|0;E(235)}function Pl(a){a=a|0;E(236)}function Ql(a){a=a|0;E(237)}function Rl(a){a=a|0;E(238)}function Sl(a){a=a|0;E(239)}function Tl(a){a=a|0;E(240)}function Ul(a){a=a|0;E(241)}function Vl(a){a=a|0;E(242)}function Wl(a){a=a|0;E(243)}function Xl(a){a=a|0;E(244)}function Yl(a){a=a|0;E(245)}function Zl(a){a=a|0;E(246)}function _l(a){a=a|0;E(247)}function $l(a){a=a|0;E(248)}function am(a){a=a|0;E(249)}function bm(a){a=a|0;E(250)}function cm(a){a=a|0;E(251)}function dm(a){a=a|0;E(252)}function em(a){a=a|0;E(253)}function fm(a){a=a|0;E(254)}function gm(a){a=a|0;E(255)}function hm(a,b){a=a|0;b=b|0;F(0)}function im(a,b){a=a|0;b=b|0;F(24)}function jm(a,b){a=a|0;b=b|0;F(25)}function km(a,b){a=a|0;b=b|0;F(26)}function lm(a,b){a=a|0;b=b|0;F(27)}function mm(a,b){a=a|0;b=b|0;F(28)}function nm(a,b){a=a|0;b=b|0;F(29)}function om(a,b){a=a|0;b=b|0;F(30)}function pm(a,b){a=a|0;b=b|0;F(31)}function qm(a,b,c){a=a|0;b=b|0;c=+c;G(0)}function rm(a,b,c){a=a|0;b=b|0;c=c|0;H(0)}function sm(a,b,c){a=a|0;b=b|0;c=c|0;H(3)}function tm(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;I(0)}function um(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;I(18)}function vm(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;I(19)}function wm(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;I(20)}function xm(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;I(21)}function ym(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;I(22)}function zm(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;I(23)}function Am(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;I(24)}function Bm(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;I(25)}function Cm(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;I(26)}function Dm(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;I(27)}function Em(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;I(28)}function Fm(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;I(29)}function Gm(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;I(30)}function Hm(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;I(31)}function Im(a,b,c,d,e){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;J(0)}function Jm(a,b,c,d,e,f){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;f=f|0;K(0)}

// EMSCRIPTEN_END_FUNCS
var Ea=[Ji,Zb,dc,gc,mc,Cc,Ic,Pc,Vc,Zc,dd,gd,md,xd,Dd,Gd,Md,Pd,Vd,Yd,ce,fe,le,ne,te,Ie,Me,Oe,Re,Xe,Ze,df,Rf,Xf,eg,eh,Yh,Ki,Li,Mi,Ni,Oi,Pi,Qi,Ri,Si,Ti,Ui,Vi,Wi,Xi,Yi,Zi,_i,$i,aj,bj,cj,dj,ej,fj,gj,hj,ij];var Fa=[jj,Eb,Kb,Qb,Vb,cc,lc,sc,zc,Hc,Uc,cd,ld,td,Cd,Ld,Ud,be,ke,se,xe,Ee,Ne,We,cf,kf,pf,tf,xf,Bf,Ff,Jf,Of,Wf,kj,lj,mj,nj,oj,pj,qj,rj,sj,tj,uj,vj,wj,xj,yj,zj,Aj,Bj,Cj,Dj,Ej,Fj,Gj,Hj,Ij,Jj,Kj,Lj,Mj,Nj];var Ga=[Oj,fg,gg,kg,Ch,Pj,Qj,Rj];var Ha=[Sj,vh,Va,Qh];var Ia=[Tj,hh,Cb,Db,Fb,Ib,Jb,Lb,Ob,Pb,Rb,Tb,Ub,Wb,ec,Yb,$b,ac,fc,ic,jc,qc,rc,tc,xc,yc,Ac,Bc,Ec,Fc,Nc,Oc,Rc,Sc,Tc,Xc,Yc,$c,ad,bd,ed,fd,id,jd,rd,sd,ud,vd,wd,zd,Ad,Bd,Ed,Fd,Id,Jd,Kd,Nd,Od,Rd,Sd,Wd,Xd,_d,$d,ae,de,ee,he,ie,je,nd,me,pe,qe,ve,we,ye,Ce,De,Fe,Ge,He,Ke,Le,Pe,Qe,Te,Ue,Ye,$e,af,hf,jf,lf,nf,of,qf,rf,sf,uf,vf,wf,yf,zf,Af,Cf,Df,Ef,Gf,Hf,If,Kf,Mf,Nf,Pf,Wc,Qf,Tf,Uf,Vf,ch,dh,yh,zh,Ah,Bh,Lh,Wh,Xh,ai,bi,Rh,Uj,Vj,Wj,Xj,Yj,Zj,_j,$j,ak,bk,ck,dk,ek,fk,gk,hk,ik,jk,kk,lk,mk,nk,ok,pk,qk,rk,sk,tk,uk,vk,wk,xk,yk,zk,Ak,Bk,Ck,Dk,Ek,Fk,Gk,Hk,Ik,Jk,Kk,Lk,Mk,Nk,Ok,Pk,Qk,Rk,Sk,Tk,Uk,Vk,Wk,Xk,Yk,Zk,_k,$k,al,bl,cl,dl,el,fl,gl,hl,il,jl,kl,ll,ml,nl,ol,pl,ql,rl,sl,tl,ul,vl,wl,xl,yl,zl,Al,Bl,Cl,Dl,El,Fl,Gl,Hl,Il,Jl,Kl,Ll,Ml,Nl,Ol,Pl,Ql,Rl,Sl,Tl,Ul,Vl,Wl,Xl,Yl,Zl,_l,$l,am,bm,cm,dm,em,fm,gm];var Ja=[hm,_b,bc,hc,kc,Dc,Gc,Qc,_c,hd,kd,yd,Hd,Qd,Td,Zd,ge,oe,re,Je,Se,_e,bf,Sf,im,jm,km,lm,mm,nm,om,pm];var Ka=[qm,ff];var La=[rm,sb,Ve,sm];var Ma=[tm,tb,ub,xb,yb,Gb,Hb,vb,wb,nc,oc,uc,vc,od,pd,Fh,Oh,ei,um,vm,wm,xm,ym,zm,Am,Bm,Cm,Dm,Em,Fm,Gm,Hm];var Na=[Im,Eh,Nh,di];var Oa=[Jm,Dh,Mh,ci];return{__GLOBAL__sub_I_main_cpp:dg,___cxa_can_catch:ji,___cxa_is_pointer_type:ki,___em_js__getCanvasHeight:Ua,___em_js__getCanvasWidth:Ta,___errno_location:ig,___muldi3:mi,___udivdi3:ri,_bitshift64Lshr:si,_bitshift64Shl:ti,_fflush:Bg,_free:bh,_i64Add:ni,_i64Subtract:oi,_llvm_bswap_i32:ui,_main:Wa,_malloc:ah,_memcpy:vi,_memset:wi,_sbrk:xi,dynCall_ii:yi,dynCall_iii:zi,dynCall_iiii:Ai,dynCall_v:Bi,dynCall_vi:Ci,dynCall_vii:Di,dynCall_viid:Ei,dynCall_viii:Fi,dynCall_viiii:Gi,dynCall_viiiii:Hi,dynCall_viiiiii:Ii,establishStackSpace:Sa,stackAlloc:Pa,stackRestore:Ra,stackSave:Qa}})


// EMSCRIPTEN_END_ASM
(asmGlobalArg, asmLibraryArg, buffer);

var real___GLOBAL__sub_I_main_cpp = asm["__GLOBAL__sub_I_main_cpp"];

asm["__GLOBAL__sub_I_main_cpp"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real___GLOBAL__sub_I_main_cpp.apply(null, arguments);
};

var real____cxa_can_catch = asm["___cxa_can_catch"];

asm["___cxa_can_catch"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real____cxa_can_catch.apply(null, arguments);
};

var real____cxa_is_pointer_type = asm["___cxa_is_pointer_type"];

asm["___cxa_is_pointer_type"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real____cxa_is_pointer_type.apply(null, arguments);
};

var real____em_js__getCanvasHeight = asm["___em_js__getCanvasHeight"];

asm["___em_js__getCanvasHeight"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real____em_js__getCanvasHeight.apply(null, arguments);
};

var real____em_js__getCanvasWidth = asm["___em_js__getCanvasWidth"];

asm["___em_js__getCanvasWidth"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real____em_js__getCanvasWidth.apply(null, arguments);
};

var real____errno_location = asm["___errno_location"];

asm["___errno_location"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real____errno_location.apply(null, arguments);
};

var real____muldi3 = asm["___muldi3"];

asm["___muldi3"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real____muldi3.apply(null, arguments);
};

var real____udivdi3 = asm["___udivdi3"];

asm["___udivdi3"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real____udivdi3.apply(null, arguments);
};

var real__bitshift64Lshr = asm["_bitshift64Lshr"];

asm["_bitshift64Lshr"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real__bitshift64Lshr.apply(null, arguments);
};

var real__bitshift64Shl = asm["_bitshift64Shl"];

asm["_bitshift64Shl"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real__bitshift64Shl.apply(null, arguments);
};

var real__fflush = asm["_fflush"];

asm["_fflush"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real__fflush.apply(null, arguments);
};

var real__free = asm["_free"];

asm["_free"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real__free.apply(null, arguments);
};

var real__i64Add = asm["_i64Add"];

asm["_i64Add"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real__i64Add.apply(null, arguments);
};

var real__i64Subtract = asm["_i64Subtract"];

asm["_i64Subtract"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real__i64Subtract.apply(null, arguments);
};

var real__llvm_bswap_i32 = asm["_llvm_bswap_i32"];

asm["_llvm_bswap_i32"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real__llvm_bswap_i32.apply(null, arguments);
};

var real__main = asm["_main"];

asm["_main"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real__main.apply(null, arguments);
};

var real__malloc = asm["_malloc"];

asm["_malloc"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real__malloc.apply(null, arguments);
};

var real__sbrk = asm["_sbrk"];

asm["_sbrk"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real__sbrk.apply(null, arguments);
};

var real_establishStackSpace = asm["establishStackSpace"];

asm["establishStackSpace"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real_establishStackSpace.apply(null, arguments);
};

var real_stackAlloc = asm["stackAlloc"];

asm["stackAlloc"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real_stackAlloc.apply(null, arguments);
};

var real_stackRestore = asm["stackRestore"];

asm["stackRestore"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real_stackRestore.apply(null, arguments);
};

var real_stackSave = asm["stackSave"];

asm["stackSave"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real_stackSave.apply(null, arguments);
};

var __GLOBAL__sub_I_main_cpp = Module["__GLOBAL__sub_I_main_cpp"] = asm["__GLOBAL__sub_I_main_cpp"];

var ___cxa_can_catch = Module["___cxa_can_catch"] = asm["___cxa_can_catch"];

var ___cxa_is_pointer_type = Module["___cxa_is_pointer_type"] = asm["___cxa_is_pointer_type"];

var ___em_js__getCanvasHeight = Module["___em_js__getCanvasHeight"] = asm["___em_js__getCanvasHeight"];

var ___em_js__getCanvasWidth = Module["___em_js__getCanvasWidth"] = asm["___em_js__getCanvasWidth"];

var ___errno_location = Module["___errno_location"] = asm["___errno_location"];

var ___muldi3 = Module["___muldi3"] = asm["___muldi3"];

var ___udivdi3 = Module["___udivdi3"] = asm["___udivdi3"];

var _bitshift64Lshr = Module["_bitshift64Lshr"] = asm["_bitshift64Lshr"];

var _bitshift64Shl = Module["_bitshift64Shl"] = asm["_bitshift64Shl"];

var _fflush = Module["_fflush"] = asm["_fflush"];

var _free = Module["_free"] = asm["_free"];

var _i64Add = Module["_i64Add"] = asm["_i64Add"];

var _i64Subtract = Module["_i64Subtract"] = asm["_i64Subtract"];

var _llvm_bswap_i32 = Module["_llvm_bswap_i32"] = asm["_llvm_bswap_i32"];

var _main = Module["_main"] = asm["_main"];

var _malloc = Module["_malloc"] = asm["_malloc"];

var _memcpy = Module["_memcpy"] = asm["_memcpy"];

var _memset = Module["_memset"] = asm["_memset"];

var _sbrk = Module["_sbrk"] = asm["_sbrk"];

var establishStackSpace = Module["establishStackSpace"] = asm["establishStackSpace"];

var stackAlloc = Module["stackAlloc"] = asm["stackAlloc"];

var stackRestore = Module["stackRestore"] = asm["stackRestore"];

var stackSave = Module["stackSave"] = asm["stackSave"];

var dynCall_ii = Module["dynCall_ii"] = asm["dynCall_ii"];

var dynCall_iii = Module["dynCall_iii"] = asm["dynCall_iii"];

var dynCall_iiii = Module["dynCall_iiii"] = asm["dynCall_iiii"];

var dynCall_v = Module["dynCall_v"] = asm["dynCall_v"];

var dynCall_vi = Module["dynCall_vi"] = asm["dynCall_vi"];

var dynCall_vii = Module["dynCall_vii"] = asm["dynCall_vii"];

var dynCall_viid = Module["dynCall_viid"] = asm["dynCall_viid"];

var dynCall_viii = Module["dynCall_viii"] = asm["dynCall_viii"];

var dynCall_viiii = Module["dynCall_viiii"] = asm["dynCall_viiii"];

var dynCall_viiiii = Module["dynCall_viiiii"] = asm["dynCall_viiiii"];

var dynCall_viiiiii = Module["dynCall_viiiiii"] = asm["dynCall_viiiiii"];

Module["asm"] = asm;

if (!Module["intArrayFromString"]) Module["intArrayFromString"] = function() {
 abort("'intArrayFromString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["intArrayToString"]) Module["intArrayToString"] = function() {
 abort("'intArrayToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["ccall"]) Module["ccall"] = function() {
 abort("'ccall' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["cwrap"]) Module["cwrap"] = function() {
 abort("'cwrap' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["setValue"]) Module["setValue"] = function() {
 abort("'setValue' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["getValue"]) Module["getValue"] = function() {
 abort("'getValue' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["allocate"]) Module["allocate"] = function() {
 abort("'allocate' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["getMemory"]) Module["getMemory"] = function() {
 abort("'getMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you");
};

if (!Module["AsciiToString"]) Module["AsciiToString"] = function() {
 abort("'AsciiToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["stringToAscii"]) Module["stringToAscii"] = function() {
 abort("'stringToAscii' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["UTF8ArrayToString"]) Module["UTF8ArrayToString"] = function() {
 abort("'UTF8ArrayToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["UTF8ToString"]) Module["UTF8ToString"] = function() {
 abort("'UTF8ToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["stringToUTF8Array"]) Module["stringToUTF8Array"] = function() {
 abort("'stringToUTF8Array' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["stringToUTF8"]) Module["stringToUTF8"] = function() {
 abort("'stringToUTF8' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["lengthBytesUTF8"]) Module["lengthBytesUTF8"] = function() {
 abort("'lengthBytesUTF8' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["UTF16ToString"]) Module["UTF16ToString"] = function() {
 abort("'UTF16ToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["stringToUTF16"]) Module["stringToUTF16"] = function() {
 abort("'stringToUTF16' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["lengthBytesUTF16"]) Module["lengthBytesUTF16"] = function() {
 abort("'lengthBytesUTF16' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["UTF32ToString"]) Module["UTF32ToString"] = function() {
 abort("'UTF32ToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["stringToUTF32"]) Module["stringToUTF32"] = function() {
 abort("'stringToUTF32' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["lengthBytesUTF32"]) Module["lengthBytesUTF32"] = function() {
 abort("'lengthBytesUTF32' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["allocateUTF8"]) Module["allocateUTF8"] = function() {
 abort("'allocateUTF8' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["stackTrace"]) Module["stackTrace"] = function() {
 abort("'stackTrace' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["addOnPreRun"]) Module["addOnPreRun"] = function() {
 abort("'addOnPreRun' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["addOnInit"]) Module["addOnInit"] = function() {
 abort("'addOnInit' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["addOnPreMain"]) Module["addOnPreMain"] = function() {
 abort("'addOnPreMain' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["addOnExit"]) Module["addOnExit"] = function() {
 abort("'addOnExit' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["addOnPostRun"]) Module["addOnPostRun"] = function() {
 abort("'addOnPostRun' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["writeStringToMemory"]) Module["writeStringToMemory"] = function() {
 abort("'writeStringToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["writeArrayToMemory"]) Module["writeArrayToMemory"] = function() {
 abort("'writeArrayToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["writeAsciiToMemory"]) Module["writeAsciiToMemory"] = function() {
 abort("'writeAsciiToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["addRunDependency"]) Module["addRunDependency"] = function() {
 abort("'addRunDependency' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you");
};

if (!Module["removeRunDependency"]) Module["removeRunDependency"] = function() {
 abort("'removeRunDependency' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you");
};

if (!Module["ENV"]) Module["ENV"] = function() {
 abort("'ENV' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["FS"]) Module["FS"] = function() {
 abort("'FS' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["FS_createFolder"]) Module["FS_createFolder"] = function() {
 abort("'FS_createFolder' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you");
};

if (!Module["FS_createPath"]) Module["FS_createPath"] = function() {
 abort("'FS_createPath' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you");
};

if (!Module["FS_createDataFile"]) Module["FS_createDataFile"] = function() {
 abort("'FS_createDataFile' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you");
};

if (!Module["FS_createPreloadedFile"]) Module["FS_createPreloadedFile"] = function() {
 abort("'FS_createPreloadedFile' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you");
};

if (!Module["FS_createLazyFile"]) Module["FS_createLazyFile"] = function() {
 abort("'FS_createLazyFile' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you");
};

if (!Module["FS_createLink"]) Module["FS_createLink"] = function() {
 abort("'FS_createLink' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you");
};

if (!Module["FS_createDevice"]) Module["FS_createDevice"] = function() {
 abort("'FS_createDevice' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you");
};

if (!Module["FS_unlink"]) Module["FS_unlink"] = function() {
 abort("'FS_unlink' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you");
};

if (!Module["GL"]) Module["GL"] = function() {
 abort("'GL' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["dynamicAlloc"]) Module["dynamicAlloc"] = function() {
 abort("'dynamicAlloc' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["warnOnce"]) Module["warnOnce"] = function() {
 abort("'warnOnce' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["loadDynamicLibrary"]) Module["loadDynamicLibrary"] = function() {
 abort("'loadDynamicLibrary' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["loadWebAssemblyModule"]) Module["loadWebAssemblyModule"] = function() {
 abort("'loadWebAssemblyModule' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["getLEB"]) Module["getLEB"] = function() {
 abort("'getLEB' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["getFunctionTables"]) Module["getFunctionTables"] = function() {
 abort("'getFunctionTables' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["alignFunctionTables"]) Module["alignFunctionTables"] = function() {
 abort("'alignFunctionTables' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["registerFunctions"]) Module["registerFunctions"] = function() {
 abort("'registerFunctions' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["addFunction"]) Module["addFunction"] = function() {
 abort("'addFunction' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["removeFunction"]) Module["removeFunction"] = function() {
 abort("'removeFunction' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["getFuncWrapper"]) Module["getFuncWrapper"] = function() {
 abort("'getFuncWrapper' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["prettyPrint"]) Module["prettyPrint"] = function() {
 abort("'prettyPrint' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["makeBigInt"]) Module["makeBigInt"] = function() {
 abort("'makeBigInt' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["dynCall"]) Module["dynCall"] = function() {
 abort("'dynCall' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["getCompilerSetting"]) Module["getCompilerSetting"] = function() {
 abort("'getCompilerSetting' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["stackSave"]) Module["stackSave"] = function() {
 abort("'stackSave' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["stackRestore"]) Module["stackRestore"] = function() {
 abort("'stackRestore' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["stackAlloc"]) Module["stackAlloc"] = function() {
 abort("'stackAlloc' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["establishStackSpace"]) Module["establishStackSpace"] = function() {
 abort("'establishStackSpace' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["print"]) Module["print"] = function() {
 abort("'print' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["printErr"]) Module["printErr"] = function() {
 abort("'printErr' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["getTempRet0"]) Module["getTempRet0"] = function() {
 abort("'getTempRet0' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["setTempRet0"]) Module["setTempRet0"] = function() {
 abort("'setTempRet0' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["Pointer_stringify"]) Module["Pointer_stringify"] = function() {
 abort("'Pointer_stringify' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["ALLOC_NORMAL"]) Object.defineProperty(Module, "ALLOC_NORMAL", {
 get: function() {
  abort("'ALLOC_NORMAL' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
 }
});

if (!Module["ALLOC_STACK"]) Object.defineProperty(Module, "ALLOC_STACK", {
 get: function() {
  abort("'ALLOC_STACK' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
 }
});

if (!Module["ALLOC_DYNAMIC"]) Object.defineProperty(Module, "ALLOC_DYNAMIC", {
 get: function() {
  abort("'ALLOC_DYNAMIC' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
 }
});

if (!Module["ALLOC_NONE"]) Object.defineProperty(Module, "ALLOC_NONE", {
 get: function() {
  abort("'ALLOC_NONE' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
 }
});

if (memoryInitializer) {
 if (!isDataURI(memoryInitializer)) {
  memoryInitializer = locateFile(memoryInitializer);
 }
 if (ENVIRONMENT_IS_NODE || ENVIRONMENT_IS_SHELL) {
  var data = Module["readBinary"](memoryInitializer);
  HEAPU8.set(data, GLOBAL_BASE);
 } else {
  addRunDependency("memory initializer");
  var applyMemoryInitializer = function(data) {
   if (data.byteLength) data = new Uint8Array(data);
   for (var i = 0; i < data.length; i++) {
    assert(HEAPU8[GLOBAL_BASE + i] === 0, "area for memory initializer should not have been touched before it's loaded");
   }
   HEAPU8.set(data, GLOBAL_BASE);
   if (Module["memoryInitializerRequest"]) delete Module["memoryInitializerRequest"].response;
   removeRunDependency("memory initializer");
  };
  var doBrowserLoad = function() {
   Module["readAsync"](memoryInitializer, applyMemoryInitializer, function() {
    throw "could not load memory initializer " + memoryInitializer;
   });
  };
  if (Module["memoryInitializerRequest"]) {
   var useRequest = function() {
    var request = Module["memoryInitializerRequest"];
    var response = request.response;
    if (request.status !== 200 && request.status !== 0) {
     console.warn("a problem seems to have happened with Module.memoryInitializerRequest, status: " + request.status + ", retrying " + memoryInitializer);
     doBrowserLoad();
     return;
    }
    applyMemoryInitializer(response);
   };
   if (Module["memoryInitializerRequest"].response) {
    setTimeout(useRequest, 0);
   } else {
    Module["memoryInitializerRequest"].addEventListener("load", useRequest);
   }
  } else {
   doBrowserLoad();
  }
 }
}

function ExitStatus(status) {
 this.name = "ExitStatus";
 this.message = "Program terminated with exit(" + status + ")";
 this.status = status;
}

ExitStatus.prototype = new Error();

ExitStatus.prototype.constructor = ExitStatus;

var calledMain = false;

dependenciesFulfilled = function runCaller() {
 if (!Module["calledRun"]) run();
 if (!Module["calledRun"]) dependenciesFulfilled = runCaller;
};

Module["callMain"] = function callMain(args) {
 assert(runDependencies == 0, "cannot call main when async dependencies remain! (listen on __ATMAIN__)");
 assert(__ATPRERUN__.length == 0, "cannot call main when preRun functions remain to be called");
 args = args || [];
 ensureInitRuntime();
 var argc = args.length + 1;
 var argv = stackAlloc((argc + 1) * 4);
 HEAP32[argv >> 2] = allocateUTF8OnStack(Module["thisProgram"]);
 for (var i = 1; i < argc; i++) {
  HEAP32[(argv >> 2) + i] = allocateUTF8OnStack(args[i - 1]);
 }
 HEAP32[(argv >> 2) + argc] = 0;
 try {
  var ret = Module["_main"](argc, argv, 0);
  exit(ret, true);
 } catch (e) {
  if (e instanceof ExitStatus) {
   return;
  } else if (e == "SimulateInfiniteLoop") {
   Module["noExitRuntime"] = true;
   return;
  } else {
   var toLog = e;
   if (e && typeof e === "object" && e.stack) {
    toLog = [ e, e.stack ];
   }
   err("exception thrown: " + toLog);
   Module["quit"](1, e);
  }
 } finally {
  calledMain = true;
 }
};

function run(args) {
 args = args || Module["arguments"];
 if (runDependencies > 0) {
  return;
 }
 writeStackCookie();
 preRun();
 if (runDependencies > 0) return;
 if (Module["calledRun"]) return;
 function doRun() {
  if (Module["calledRun"]) return;
  Module["calledRun"] = true;
  if (ABORT) return;
  ensureInitRuntime();
  preMain();
  if (Module["onRuntimeInitialized"]) Module["onRuntimeInitialized"]();
  if (Module["_main"] && shouldRunNow) Module["callMain"](args);
  postRun();
 }
 if (Module["setStatus"]) {
  Module["setStatus"]("Running...");
  setTimeout(function() {
   setTimeout(function() {
    Module["setStatus"]("");
   }, 1);
   doRun();
  }, 1);
 } else {
  doRun();
 }
 checkStackCookie();
}

Module["run"] = run;

function checkUnflushedContent() {
 var print = out;
 var printErr = err;
 var has = false;
 out = err = function(x) {
  has = true;
 };
 try {
  var flush = flush_NO_FILESYSTEM;
  if (flush) flush(0);
 } catch (e) {}
 out = print;
 err = printErr;
 if (has) {
  warnOnce("stdio streams had content in them that was not flushed. you should set EXIT_RUNTIME to 1 (see the FAQ), or make sure to emit a newline when you printf etc.");
  warnOnce("(this may also be due to not including full filesystem support - try building with -s FORCE_FILESYSTEM=1)");
 }
}

function exit(status, implicit) {
 checkUnflushedContent();
 if (implicit && Module["noExitRuntime"] && status === 0) {
  return;
 }
 if (Module["noExitRuntime"]) {
  if (!implicit) {
   err("exit(" + status + ") called, but EXIT_RUNTIME is not set, so halting execution but not exiting the runtime or preventing further async execution (build with EXIT_RUNTIME=1, if you want a true shutdown)");
  }
 } else {
  ABORT = true;
  EXITSTATUS = status;
  exitRuntime();
  if (Module["onExit"]) Module["onExit"](status);
 }
 Module["quit"](status, new ExitStatus(status));
}

var abortDecorators = [];

function abort(what) {
 if (Module["onAbort"]) {
  Module["onAbort"](what);
 }
 if (what !== undefined) {
  out(what);
  err(what);
  what = JSON.stringify(what);
 } else {
  what = "";
 }
 ABORT = true;
 EXITSTATUS = 1;
 var extra = "";
 var output = "abort(" + what + ") at " + stackTrace() + extra;
 if (abortDecorators) {
  abortDecorators.forEach(function(decorator) {
   output = decorator(output, what);
  });
 }
 throw output;
}

Module["abort"] = abort;

if (Module["preInit"]) {
 if (typeof Module["preInit"] == "function") Module["preInit"] = [ Module["preInit"] ];
 while (Module["preInit"].length > 0) {
  Module["preInit"].pop()();
 }
}

var shouldRunNow = true;

if (Module["noInitialRun"]) {
 shouldRunNow = false;
}

Module["noExitRuntime"] = true;

run();

