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

var STACK_BASE = 14224, STACK_MAX = 5257104, DYNAMIC_BASE = 5257104, DYNAMICTOP_PTR = 13968;

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

var tempDoublePtr = 14208;

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

var debug_table_iii = [ "0", "__ZNKSt3__220__shared_ptr_pointerIP18RectangleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP13TextComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP10EntityGridNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP9ComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__210__function6__funcIZN13TestDraggableC1EvEUlR7Vector2E_NS_9allocatorIS5_EEFvS4_EE6targetERKSt9type_info", "__ZNKSt3__210__function6__funcIZN13TestDraggableC1EvEUlR7Vector2E0_NS_9allocatorIS5_EEFvS4_EE6targetERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP21StrokeCircleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP19FillCircleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__210__function6__funcIZN13TestDraggableC1EvEUlR7Vector2E1_NS_9allocatorIS5_EEFvS4_EE6targetERKSt9type_info", "__ZNKSt3__210__function6__funcIZN13TestClickableC1EvEUlvE_NS_9allocatorIS3_EEFvvEE6targetERKSt9type_info", "__ZNKSt3__210__function6__funcIZN13TestClickableC1EvEUlvE0_NS_9allocatorIS3_EEFvvEE6targetERKSt9type_info", "__ZNKSt3__210__function6__funcIZN13TestClickableC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EE6targetERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP25RoundedRectangleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__210__function6__funcIZN13TestClickableC1EvEUlvE1_NS_9allocatorIS3_EEFvvEE6targetERKSt9type_info", "__ZNKSt3__210__function6__funcIZN13TestClickableC1EvEUlvE2_NS_9allocatorIS3_EEFvvEE6targetERKSt9type_info", "__ZNKSt3__210__function6__funcIZN13TestClickableC1EvEUlRK7Vector2E0_NS_9allocatorIS6_EEFvS5_EE6targetERKSt9type_info", "__ZNKSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlvE_NS5_ISG_EEFvvEE6targetERKSt9type_info", "__ZNKSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlvE0_NS5_ISG_EEFvvEE6targetERKSt9type_info", "__ZNKSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlSC_E_NS5_ISG_EEFvSC_EE6targetERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP12CustomButtonNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP17FixedCapacityPoolNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__210__function6__funcIZN11TestPoolingC1EvEUlvE_NS_9allocatorIS3_EEFP9ComponentvEE6targetERKSt9type_info", "__ZNKSt3__210__function6__funcIZZN11TestPoolingC1EvENKUlvE_clEvEUlRK7Vector2P12CustomButtonE_NS_9allocatorIS9_EEFvS6_S8_EE6targetERKSt9type_info", "__ZNKSt3__210__function6__funcIZN11TestPoolingC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EE6targetERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP14TestPrimitivesNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP13TestTextLabelNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP14TestEntityGridNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP13TestDraggableNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP13TestClickableNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP11TestPoolingNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEE6targetERKSt9type_info" ];

var debug_table_iiii = [ "0", "___stdio_write", "___stdio_seek", "___stdout_write", "__ZNK10__cxxabiv117__class_type_info9can_catchEPKNS_16__shim_type_infoERPv", "0", "0", "0" ];

var debug_table_v = [ "0", "__ZL25default_terminate_handlerv", "__Z9main_loopv", "__ZN10__cxxabiv112_GLOBAL__N_110construct_Ev" ];

var debug_table_vi = [ "0", "__ZNSt3__214__shared_countD2Ev", "__ZNSt3__220__shared_ptr_pointerIP18RectangleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP18RectangleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP18RectangleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__220__shared_ptr_pointerIP13TextComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP13TextComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP13TextComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__220__shared_ptr_pointerIP10EntityGridNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP10EntityGridNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP10EntityGridNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__220__shared_ptr_pointerIP9ComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP9ComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP9ComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__210__function6__baseIFvR7Vector2EED2Ev", "__ZNSt3__210__function6__funcIZN13TestDraggableC1EvEUlR7Vector2E_NS_9allocatorIS5_EEFvS4_EED0Ev", "__ZNSt3__210__function6__funcIZN13TestDraggableC1EvEUlR7Vector2E_NS_9allocatorIS5_EEFvS4_EE7destroyEv", "__ZNSt3__210__function6__funcIZN13TestDraggableC1EvEUlR7Vector2E_NS_9allocatorIS5_EEFvS4_EE18destroy_deallocateEv", "__ZNSt3__210__function6__funcIZN13TestDraggableC1EvEUlR7Vector2E0_NS_9allocatorIS5_EEFvS4_EED0Ev", "__ZNSt3__210__function6__funcIZN13TestDraggableC1EvEUlR7Vector2E0_NS_9allocatorIS5_EEFvS4_EE7destroyEv", "__ZNSt3__210__function6__funcIZN13TestDraggableC1EvEUlR7Vector2E0_NS_9allocatorIS5_EEFvS4_EE18destroy_deallocateEv", "__ZNSt3__220__shared_ptr_pointerIP21StrokeCircleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP21StrokeCircleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP21StrokeCircleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__220__shared_ptr_pointerIP19FillCircleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP19FillCircleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP19FillCircleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__210__function6__funcIZN13TestDraggableC1EvEUlR7Vector2E1_NS_9allocatorIS5_EEFvS4_EED0Ev", "__ZNSt3__210__function6__funcIZN13TestDraggableC1EvEUlR7Vector2E1_NS_9allocatorIS5_EEFvS4_EE7destroyEv", "__ZNSt3__210__function6__funcIZN13TestDraggableC1EvEUlR7Vector2E1_NS_9allocatorIS5_EEFvS4_EE18destroy_deallocateEv", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlvE_NS_9allocatorIS3_EEFvvEED2Ev", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlvE_NS_9allocatorIS3_EEFvvEED0Ev", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlvE_NS_9allocatorIS3_EEFvvEE7destroyEv", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlvE_NS_9allocatorIS3_EEFvvEE18destroy_deallocateEv", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlvE_NS_9allocatorIS3_EEFvvEEclEv", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlvE0_NS_9allocatorIS3_EEFvvEED2Ev", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlvE0_NS_9allocatorIS3_EEFvvEED0Ev", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlvE0_NS_9allocatorIS3_EEFvvEE7destroyEv", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlvE0_NS_9allocatorIS3_EEFvvEE18destroy_deallocateEv", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlvE0_NS_9allocatorIS3_EEFvvEEclEv", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EED2Ev", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EED0Ev", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EE7destroyEv", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EE18destroy_deallocateEv", "__ZNSt3__220__shared_ptr_pointerIP25RoundedRectangleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP25RoundedRectangleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP25RoundedRectangleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlvE1_NS_9allocatorIS3_EEFvvEED2Ev", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlvE1_NS_9allocatorIS3_EEFvvEED0Ev", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlvE1_NS_9allocatorIS3_EEFvvEE7destroyEv", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlvE1_NS_9allocatorIS3_EEFvvEE18destroy_deallocateEv", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlvE1_NS_9allocatorIS3_EEFvvEEclEv", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlvE2_NS_9allocatorIS3_EEFvvEED2Ev", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlvE2_NS_9allocatorIS3_EEFvvEED0Ev", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlvE2_NS_9allocatorIS3_EEFvvEE7destroyEv", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlvE2_NS_9allocatorIS3_EEFvvEE18destroy_deallocateEv", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlvE2_NS_9allocatorIS3_EEFvvEEclEv", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlRK7Vector2E0_NS_9allocatorIS6_EEFvS5_EED2Ev", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlRK7Vector2E0_NS_9allocatorIS6_EEFvS5_EED0Ev", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlRK7Vector2E0_NS_9allocatorIS6_EEFvS5_EE7destroyEv", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlRK7Vector2E0_NS_9allocatorIS6_EEFvS5_EE18destroy_deallocateEv", "__ZNSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlvE_NS5_ISG_EEFvvEED2Ev", "__ZNSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlvE_NS5_ISG_EEFvvEED0Ev", "__ZNSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlvE_NS5_ISG_EEFvvEE7destroyEv", "__ZNSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlvE_NS5_ISG_EEFvvEE18destroy_deallocateEv", "__ZNSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlvE_NS5_ISG_EEFvvEEclEv", "__ZNSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlvE0_NS5_ISG_EEFvvEED2Ev", "__ZNSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlvE0_NS5_ISG_EEFvvEED0Ev", "__ZNSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlvE0_NS5_ISG_EEFvvEE7destroyEv", "__ZNSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlvE0_NS5_ISG_EEFvvEE18destroy_deallocateEv", "__ZNSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlvE0_NS5_ISG_EEFvvEEclEv", "__ZNSt3__210__function6__baseIFvRK7Vector2EED2Ev", "__ZNSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlSC_E_NS5_ISG_EEFvSC_EED0Ev", "__ZNSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlSC_E_NS5_ISG_EEFvSC_EE7destroyEv", "__ZNSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlSC_E_NS5_ISG_EEFvSC_EE18destroy_deallocateEv", "__ZNSt3__220__shared_ptr_pointerIP12CustomButtonNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP12CustomButtonNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP12CustomButtonNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__220__shared_ptr_pointerIP17FixedCapacityPoolNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP17FixedCapacityPoolNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP17FixedCapacityPoolNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__210__function6__baseIFP9ComponentvEED2Ev", "__ZNSt3__210__function6__funcIZN11TestPoolingC1EvEUlvE_NS_9allocatorIS3_EEFP9ComponentvEED0Ev", "__ZNSt3__210__function6__funcIZN11TestPoolingC1EvEUlvE_NS_9allocatorIS3_EEFP9ComponentvEE7destroyEv", "__ZNSt3__210__function6__funcIZN11TestPoolingC1EvEUlvE_NS_9allocatorIS3_EEFP9ComponentvEE18destroy_deallocateEv", "__ZNSt3__210__function6__baseIFvRK7Vector2P12CustomButtonEED2Ev", "__ZNSt3__210__function6__funcIZZN11TestPoolingC1EvENKUlvE_clEvEUlRK7Vector2P12CustomButtonE_NS_9allocatorIS9_EEFvS6_S8_EED0Ev", "__ZNSt3__210__function6__funcIZZN11TestPoolingC1EvENKUlvE_clEvEUlRK7Vector2P12CustomButtonE_NS_9allocatorIS9_EEFvS6_S8_EE7destroyEv", "__ZNSt3__210__function6__funcIZZN11TestPoolingC1EvENKUlvE_clEvEUlRK7Vector2P12CustomButtonE_NS_9allocatorIS9_EEFvS6_S8_EE18destroy_deallocateEv", "__ZNSt3__210__function6__funcIZN11TestPoolingC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EED0Ev", "__ZNSt3__210__function6__funcIZN11TestPoolingC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EE7destroyEv", "__ZNSt3__210__function6__funcIZN11TestPoolingC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EE18destroy_deallocateEv", "__ZNSt3__220__shared_ptr_pointerIP14TestPrimitivesNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP14TestPrimitivesNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP14TestPrimitivesNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__220__shared_ptr_pointerIP13TestTextLabelNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP13TestTextLabelNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP13TestTextLabelNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__220__shared_ptr_pointerIP14TestEntityGridNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP14TestEntityGridNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP14TestEntityGridNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__220__shared_ptr_pointerIP13TestDraggableNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP13TestDraggableNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP13TestDraggableNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__220__shared_ptr_pointerIP13TestClickableNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP13TestClickableNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP13TestClickableNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__220__shared_ptr_pointerIP11TestPoolingNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP11TestPoolingNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP11TestPoolingNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__210__function6__baseIFvvEED2Ev", "__ZNSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEED0Ev", "__ZNSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEE7destroyEv", "__ZNSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEE18destroy_deallocateEv", "__ZNSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEEclEv", "__ZNSt3__217bad_function_callD2Ev", "__ZNSt3__217bad_function_callD0Ev", "__ZN10__cxxabiv116__shim_type_infoD2Ev", "__ZN10__cxxabiv117__class_type_infoD0Ev", "__ZNK10__cxxabiv116__shim_type_info5noop1Ev", "__ZNK10__cxxabiv116__shim_type_info5noop2Ev", "__ZN10__cxxabiv120__si_class_type_infoD0Ev", "__ZNSt11logic_errorD2Ev", "__ZNSt11logic_errorD0Ev", "__ZNSt12length_errorD0Ev", "__ZN10__cxxabiv121__vmi_class_type_infoD0Ev", "__ZN10__cxxabiv112_GLOBAL__N_19destruct_EPv", "0" ];

var debug_table_vii = [ "0", "__ZNKSt3__210__function6__funcIZN13TestDraggableC1EvEUlR7Vector2E_NS_9allocatorIS5_EEFvS4_EE7__cloneEPNS0_6__baseIS8_EE", "__ZNSt3__210__function6__funcIZN13TestDraggableC1EvEUlR7Vector2E_NS_9allocatorIS5_EEFvS4_EEclES4_", "__ZNKSt3__210__function6__funcIZN13TestDraggableC1EvEUlR7Vector2E0_NS_9allocatorIS5_EEFvS4_EE7__cloneEPNS0_6__baseIS8_EE", "__ZNSt3__210__function6__funcIZN13TestDraggableC1EvEUlR7Vector2E0_NS_9allocatorIS5_EEFvS4_EEclES4_", "__ZNKSt3__210__function6__funcIZN13TestDraggableC1EvEUlR7Vector2E1_NS_9allocatorIS5_EEFvS4_EE7__cloneEPNS0_6__baseIS8_EE", "__ZNSt3__210__function6__funcIZN13TestDraggableC1EvEUlR7Vector2E1_NS_9allocatorIS5_EEFvS4_EEclES4_", "__ZNKSt3__210__function6__funcIZN13TestClickableC1EvEUlvE_NS_9allocatorIS3_EEFvvEE7__cloneEPNS0_6__baseIS6_EE", "__ZNKSt3__210__function6__funcIZN13TestClickableC1EvEUlvE0_NS_9allocatorIS3_EEFvvEE7__cloneEPNS0_6__baseIS6_EE", "__ZNKSt3__210__function6__funcIZN13TestClickableC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EE7__cloneEPNS0_6__baseIS9_EE", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EEclES5_", "__ZNKSt3__210__function6__funcIZN13TestClickableC1EvEUlvE1_NS_9allocatorIS3_EEFvvEE7__cloneEPNS0_6__baseIS6_EE", "__ZNKSt3__210__function6__funcIZN13TestClickableC1EvEUlvE2_NS_9allocatorIS3_EEFvvEE7__cloneEPNS0_6__baseIS6_EE", "__ZNKSt3__210__function6__funcIZN13TestClickableC1EvEUlRK7Vector2E0_NS_9allocatorIS6_EEFvS5_EE7__cloneEPNS0_6__baseIS9_EE", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlRK7Vector2E0_NS_9allocatorIS6_EEFvS5_EEclES5_", "__ZNKSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlvE_NS5_ISG_EEFvvEE7__cloneEPNS0_6__baseISI_EE", "__ZNKSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlvE0_NS5_ISG_EEFvvEE7__cloneEPNS0_6__baseISI_EE", "__ZNKSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlSC_E_NS5_ISG_EEFvSC_EE7__cloneEPNS0_6__baseISI_EE", "__ZNSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlSC_E_NS5_ISG_EEFvSC_EEclESC_", "__ZNKSt3__210__function6__funcIZN11TestPoolingC1EvEUlvE_NS_9allocatorIS3_EEFP9ComponentvEE7__cloneEPNS0_6__baseIS8_EE", "__ZNKSt3__210__function6__funcIZZN11TestPoolingC1EvENKUlvE_clEvEUlRK7Vector2P12CustomButtonE_NS_9allocatorIS9_EEFvS6_S8_EE7__cloneEPNS0_6__baseISC_EE", "__ZNKSt3__210__function6__funcIZN11TestPoolingC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EE7__cloneEPNS0_6__baseIS9_EE", "__ZNSt3__210__function6__funcIZN11TestPoolingC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EEclES5_", "__ZNKSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEE7__cloneEPNS0_6__baseIS5_EE", "0", "0", "0", "0", "0", "0", "0", "0" ];

var debug_table_viii = [ "0", "__ZN9Component8addChildERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEENS0_10shared_ptrIS_EE", "__ZNSt3__210__function6__funcIZZN11TestPoolingC1EvENKUlvE_clEvEUlRK7Vector2P12CustomButtonE_NS_9allocatorIS9_EEFvS6_S8_EEclES6_OS8_", "0" ];

var debug_table_viiii = [ "0", "__ZN18RectangleComponent8doLayoutERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN18RectangleComponent16doLayoutEntitiesERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN9Component8doLayoutERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN9Component16doLayoutEntitiesERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN13TextComponent8doLayoutERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN13TextComponent16doLayoutEntitiesERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN13DrawComponent8doLayoutERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN13DrawComponent16doLayoutEntitiesERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN21StrokeCircleComponent8doLayoutERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN21StrokeCircleComponent16doLayoutEntitiesERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN19FillCircleComponent8doLayoutERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN19FillCircleComponent16doLayoutEntitiesERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN25RoundedRectangleComponent8doLayoutERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN25RoundedRectangleComponent16doLayoutEntitiesERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZNK10__cxxabiv117__class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi", "__ZNK10__cxxabiv120__si_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi", "__ZNK10__cxxabiv121__vmi_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0" ];

var debug_table_viiiii = [ "0", "__ZNK10__cxxabiv117__class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib", "__ZNK10__cxxabiv120__si_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib", "__ZNK10__cxxabiv121__vmi_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib" ];

var debug_table_viiiiii = [ "0", "__ZNK10__cxxabiv117__class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib", "__ZNK10__cxxabiv120__si_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib", "__ZNK10__cxxabiv121__vmi_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib" ];

function nullFunc_ii(x) {
 err("Invalid function pointer '" + x + "' called with signature 'ii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("This pointer might make sense in another type signature: iii: " + debug_table_iii[x] + "  iiii: " + debug_table_iiii[x] + "  vii: " + debug_table_vii[x] + "  vi: " + debug_table_vi[x] + "  viii: " + debug_table_viii[x] + "  v: " + debug_table_v[x] + "  viiii: " + debug_table_viiii[x] + "  viiiii: " + debug_table_viiiii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  ");
 abort(x);
}

function nullFunc_iii(x) {
 err("Invalid function pointer '" + x + "' called with signature 'iii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("This pointer might make sense in another type signature: ii: " + debug_table_ii[x] + "  iiii: " + debug_table_iiii[x] + "  viii: " + debug_table_viii[x] + "  vii: " + debug_table_vii[x] + "  vi: " + debug_table_vi[x] + "  viiii: " + debug_table_viiii[x] + "  viiiii: " + debug_table_viiiii[x] + "  v: " + debug_table_v[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  ");
 abort(x);
}

function nullFunc_iiii(x) {
 err("Invalid function pointer '" + x + "' called with signature 'iiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("This pointer might make sense in another type signature: iii: " + debug_table_iii[x] + "  ii: " + debug_table_ii[x] + "  viii: " + debug_table_viii[x] + "  viiii: " + debug_table_viiii[x] + "  vii: " + debug_table_vii[x] + "  vi: " + debug_table_vi[x] + "  viiiii: " + debug_table_viiiii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  v: " + debug_table_v[x] + "  ");
 abort(x);
}

function nullFunc_v(x) {
 err("Invalid function pointer '" + x + "' called with signature 'v'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("This pointer might make sense in another type signature: vi: " + debug_table_vi[x] + "  vii: " + debug_table_vii[x] + "  viii: " + debug_table_viii[x] + "  viiii: " + debug_table_viiii[x] + "  viiiii: " + debug_table_viiiii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  ii: " + debug_table_ii[x] + "  iii: " + debug_table_iii[x] + "  iiii: " + debug_table_iiii[x] + "  ");
 abort(x);
}

function nullFunc_vi(x) {
 err("Invalid function pointer '" + x + "' called with signature 'vi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("This pointer might make sense in another type signature: v: " + debug_table_v[x] + "  vii: " + debug_table_vii[x] + "  viii: " + debug_table_viii[x] + "  viiii: " + debug_table_viiii[x] + "  viiiii: " + debug_table_viiiii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  ii: " + debug_table_ii[x] + "  iii: " + debug_table_iii[x] + "  iiii: " + debug_table_iiii[x] + "  ");
 abort(x);
}

function nullFunc_vii(x) {
 err("Invalid function pointer '" + x + "' called with signature 'vii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("This pointer might make sense in another type signature: vi: " + debug_table_vi[x] + "  viii: " + debug_table_viii[x] + "  v: " + debug_table_v[x] + "  viiii: " + debug_table_viiii[x] + "  viiiii: " + debug_table_viiiii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  ii: " + debug_table_ii[x] + "  iii: " + debug_table_iii[x] + "  iiii: " + debug_table_iiii[x] + "  ");
 abort(x);
}

function nullFunc_viii(x) {
 err("Invalid function pointer '" + x + "' called with signature 'viii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("This pointer might make sense in another type signature: vii: " + debug_table_vii[x] + "  vi: " + debug_table_vi[x] + "  viiii: " + debug_table_viiii[x] + "  v: " + debug_table_v[x] + "  viiiii: " + debug_table_viiiii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  iii: " + debug_table_iii[x] + "  ii: " + debug_table_ii[x] + "  iiii: " + debug_table_iiii[x] + "  ");
 abort(x);
}

function nullFunc_viiii(x) {
 err("Invalid function pointer '" + x + "' called with signature 'viiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("This pointer might make sense in another type signature: viii: " + debug_table_viii[x] + "  vii: " + debug_table_vii[x] + "  vi: " + debug_table_vi[x] + "  viiiii: " + debug_table_viiiii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  v: " + debug_table_v[x] + "  iiii: " + debug_table_iiii[x] + "  iii: " + debug_table_iii[x] + "  ii: " + debug_table_ii[x] + "  ");
 abort(x);
}

function nullFunc_viiiii(x) {
 err("Invalid function pointer '" + x + "' called with signature 'viiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("This pointer might make sense in another type signature: viii: " + debug_table_viii[x] + "  viiii: " + debug_table_viiii[x] + "  vii: " + debug_table_vii[x] + "  vi: " + debug_table_vi[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  v: " + debug_table_v[x] + "  iiii: " + debug_table_iiii[x] + "  iii: " + debug_table_iii[x] + "  ii: " + debug_table_ii[x] + "  ");
 abort(x);
}

function nullFunc_viiiiii(x) {
 err("Invalid function pointer '" + x + "' called with signature 'viiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("This pointer might make sense in another type signature: viii: " + debug_table_viii[x] + "  viiii: " + debug_table_viiii[x] + "  viiiii: " + debug_table_viiiii[x] + "  vii: " + debug_table_vii[x] + "  vi: " + debug_table_vi[x] + "  v: " + debug_table_v[x] + "  iiii: " + debug_table_iiii[x] + "  iii: " + debug_table_iii[x] + "  ii: " + debug_table_ii[x] + "  ");
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
 "k": nullFunc_viii,
 "l": nullFunc_viiii,
 "m": nullFunc_viiiii,
 "n": nullFunc_viiiiii,
 "o": _Engine_FillPage,
 "p": _Engine_FilledEllipse,
 "q": _Engine_FilledRectangle,
 "r": _Engine_FilledText,
 "s": _Engine_GetMode,
 "t": _Engine_Init,
 "u": _Engine_MeasureTextWidth,
 "v": _Engine_RoundedRectangle,
 "w": _Engine_StrokeEllipse,
 "x": _SDL_GetTicks,
 "y": _SDL_Init,
 "z": _SDL_LockSurface,
 "A": _SDL_PollEvent,
 "B": _SDL_SetVideoMode,
 "C": __ZSt18uncaught_exceptionv,
 "D": ___cxa_allocate_exception,
 "E": ___cxa_begin_catch,
 "F": ___cxa_find_matching_catch,
 "G": ___cxa_free_exception,
 "H": ___cxa_throw,
 "I": ___gxx_personality_v0,
 "J": ___lock,
 "K": ___resumeException,
 "L": ___setErrNo,
 "M": ___syscall140,
 "N": ___syscall146,
 "O": ___syscall54,
 "P": ___syscall6,
 "Q": ___unlock,
 "R": _abort,
 "S": _emscripten_get_heap_size,
 "T": _emscripten_get_now,
 "U": _emscripten_memcpy_big,
 "V": _emscripten_resize_heap,
 "W": _emscripten_set_main_loop,
 "X": _emscripten_set_main_loop_timing,
 "Y": _getCanvasHeight,
 "Z": _getCanvasWidth,
 "_": _pthread_getspecific,
 "$": _pthread_key_create,
 "aa": _pthread_once,
 "ab": _pthread_setspecific,
 "ac": abortOnCannotGrowMemory,
 "ad": flush_NO_FILESYSTEM,
 "ae": tempDoublePtr,
 "af": DYNAMICTOP_PTR
};

// EMSCRIPTEN_START_ASM


var asm = (/** @suppress {uselessCode} */ function(global,env,buffer) {
"use asm";var a=new global.Int8Array(buffer),b=new global.Int16Array(buffer),c=new global.Int32Array(buffer),d=new global.Uint8Array(buffer),e=new global.Uint16Array(buffer),f=new global.Float32Array(buffer),g=new global.Float64Array(buffer),h=env.ae|0,i=env.af|0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0.0,r=global.Math.sqrt,s=global.Math.ceil,t=global.Math.imul,u=global.Math.clz32,v=env.a,w=env.b,x=env.c,y=env.d,z=env.e,A=env.f,B=env.g,C=env.h,D=env.i,E=env.j,F=env.k,G=env.l,H=env.m,I=env.n,J=env.o,K=env.p,L=env.q,M=env.r,N=env.s,O=env.t,P=env.u,Q=env.v,R=env.w,S=env.x,T=env.y,U=env.z,V=env.A,W=env.B,X=env.C,Y=env.D,Z=env.E,_=env.F,$=env.G,aa=env.H,ba=env.I,ca=env.J,da=env.K,ea=env.L,fa=env.M,ga=env.N,ha=env.O,ia=env.P,ja=env.Q,ka=env.R,la=env.S,ma=env.T,na=env.U,oa=env.V,pa=env.W,qa=env.X,ra=env.Y,sa=env.Z,ta=env._,ua=env.$,va=env.aa,wa=env.ab,xa=env.ac,ya=env.ad,za=14224,Aa=5257104,Ba=0.0;
// EMSCRIPTEN_START_FUNCS
function Ma(a){a=a|0;var b=0;b=za;za=za+a|0;za=za+15&-16;if((za|0)>=(Aa|0))y(a|0);return b|0}function Na(){return za|0}function Oa(a){a=a|0;za=a}function Pa(a,b){a=a|0;b=b|0;za=a;Aa=b}function Qa(){return 5748}function Ra(){return 5846}function Sa(){var a=0,b=0;a=c[3328]|0;if(!a){b=Y(4)|0;c[b>>2]=5572;aa(b|0,3584,115)}else{Ga[c[(c[a>>2]|0)+24>>2]&127](a);return}}function Ta(){var a=0,b=0,d=0,e=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0;a=za;za=za+144|0;if((za|0)>=(Aa|0))y(144);b=a+32|0;d=a;e=a+120|0;h=a+140|0;i=a+112|0;j=a+136|0;k=a+104|0;l=a+132|0;m=a+88|0;n=a+128|0;o=a+72|0;p=a+96|0;q=a+64|0;r=a+80|0;s=a+56|0;Lg(11280)|0;c[d>>2]=0;g[d+8>>3]=+ma();t=d+16|0;u=d+28|0;c[t>>2]=0;c[t+4>>2]=0;c[t+8>>2]=0;c[t+12>>2]=0;O();T(32)|0;W(50,50,32,0)|0;t=Vg(28)|0;Ua(t);c[h>>2]=0;c[b>>2]=c[h>>2];Va(e,t,b);t=Vg(28)|0;Wa(t);c[j>>2]=0;c[b>>2]=c[j>>2];Xa(i,t,b);t=Vg(28)|0;Ya(t);c[l>>2]=0;c[b>>2]=c[l>>2];Za(k,t,b);t=Vg(28)|0;_a(t);c[n>>2]=0;c[b>>2]=c[n>>2];$a(m,t,b);t=Vg(28)|0;ab(t);c[p>>2]=0;c[b>>2]=c[p>>2];bb(o,t,b);t=Vg(36)|0;cb(t);c[r>>2]=0;c[b>>2]=c[r>>2];db(q,t,b);t=c[e>>2]|0;r=e+4|0;p=c[r>>2]|0;n=(p|0)==0;if(n)v=d+24|0;else{l=p+4|0;c[l>>2]=(c[l>>2]|0)+1;c[l>>2]=(c[l>>2]|0)+1;v=d+24|0}c[v>>2]=t;t=c[u>>2]|0;c[u>>2]=p;if(t|0?(v=t+4|0,l=c[v>>2]|0,c[v>>2]=l+-1,(l|0)==0):0){Ga[c[(c[t>>2]|0)+8>>2]&127](t);Ug(t)}t=c[d+24>>2]|0;l=d+16|0;v=l;j=c[v+4>>2]|0;h=t+20|0;c[h>>2]=c[v>>2];c[h+4>>2]=j;j=c[t+12>>2]|0;if(j|0){h=c[(c[j>>2]|0)+4>>2]|0;f[b>>2]=0.0;f[b+4>>2]=0.0;Ja[h&31](j,t,b,l)}if(!n?(n=p+4|0,l=c[n>>2]|0,c[n>>2]=l+-1,(l|0)==0):0){Ga[c[(c[p>>2]|0)+8>>2]&127](p);Ug(p)}c[s>>2]=0;p=b+16|0;l=Vg(36)|0;c[l>>2]=5024;c[l+4>>2]=s;c[l+8>>2]=d;c[l+12>>2]=e;c[l+16>>2]=i;c[l+20>>2]=k;c[l+24>>2]=m;c[l+28>>2]=o;c[l+32>>2]=q;c[p>>2]=l;Gc(b,13296);l=c[p>>2]|0;if((b|0)!=(l|0)){if(l|0)Ga[c[(c[l>>2]|0)+20>>2]&127](l)}else Ga[c[(c[l>>2]|0)+16>>2]&127](l);pa(2,0,1);l=c[q+4>>2]|0;if(l|0?(q=l+4|0,b=c[q>>2]|0,c[q>>2]=b+-1,(b|0)==0):0){Ga[c[(c[l>>2]|0)+8>>2]&127](l);Ug(l)}l=c[o+4>>2]|0;if(l|0?(o=l+4|0,b=c[o>>2]|0,c[o>>2]=b+-1,(b|0)==0):0){Ga[c[(c[l>>2]|0)+8>>2]&127](l);Ug(l)}l=c[m+4>>2]|0;if(l|0?(m=l+4|0,b=c[m>>2]|0,c[m>>2]=b+-1,(b|0)==0):0){Ga[c[(c[l>>2]|0)+8>>2]&127](l);Ug(l)}l=c[k+4>>2]|0;if(l|0?(k=l+4|0,b=c[k>>2]|0,c[k>>2]=b+-1,(b|0)==0):0){Ga[c[(c[l>>2]|0)+8>>2]&127](l);Ug(l)}l=c[i+4>>2]|0;if(l|0?(i=l+4|0,b=c[i>>2]|0,c[i>>2]=b+-1,(b|0)==0):0){Ga[c[(c[l>>2]|0)+8>>2]&127](l);Ug(l)}l=c[r>>2]|0;if(l|0?(r=l+4|0,b=c[r>>2]|0,c[r>>2]=b+-1,(b|0)==0):0){Ga[c[(c[l>>2]|0)+8>>2]&127](l);Ug(l)}l=c[u>>2]|0;if(!l){za=a;return 1}u=l+4|0;b=c[u>>2]|0;c[u>>2]=b+-1;if(b|0){za=a;return 1}Ga[c[(c[l>>2]|0)+8>>2]&127](l);Ug(l);za=a;return 1}function Ua(b){b=b|0;var d=0,e=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0.0,G=0.0,H=0.0,I=0,J=0,K=0,L=0.0,M=0.0,N=0;d=za;za=za+144|0;if((za|0)>=(Aa|0))y(144);e=d+96|0;h=d+48|0;i=d;c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;c[b+12>>2]=0;c[b+16>>2]=0;c[b+20>>2]=0;c[b+24>>2]=0;Lg(11287)|0;j=h+8|0;k=j+36|0;do{c[j>>2]=0;j=j+4|0}while((j|0)<(k|0));c[h+44>>2]=2;c[h>>2]=1112014848;c[h+4>>2]=1112014848;f[h+16>>2]=30.0;f[h+20>>2]=30.0;c[h+32>>2]=-7820545;l=b+4|0;m=c[l>>2]|0;n=b+8|0;if(m>>>0<(c[n>>2]|0)>>>0){j=m;o=h;k=j+48|0;do{c[j>>2]=c[o>>2];j=j+4|0;o=o+4|0}while((j|0)<(k|0));m=(c[l>>2]|0)+48|0;c[l>>2]=m;p=m}else{fb(b,h);p=c[l>>2]|0}j=h+8|0;k=j+36|0;do{c[j>>2]=0;j=j+4|0}while((j|0)<(k|0));c[h+44>>2]=4;c[h>>2]=1125515264;c[h+4>>2]=1112014848;c[h+16>>2]=1109393408;c[h+20>>2]=1117782016;c[h+32>>2]=-1148649473;if(p>>>0<(c[n>>2]|0)>>>0){j=p;o=h;k=j+48|0;do{c[j>>2]=c[o>>2];j=j+4|0;o=o+4|0}while((j|0)<(k|0));c[l>>2]=(c[l>>2]|0)+48}else fb(b,h);p=i+11|0;m=i+6|0;q=h+8|0;r=h+44|0;s=h+4|0;t=h+24|0;u=h+32|0;v=h+36|0;w=h+16|0;x=h+20|0;z=h+16|0;A=i+8|0;B=i+44|0;C=i+16|0;D=i+32|0;E=1;do{c[i>>2]=0;c[i+4>>2]=0;c[i+8>>2]=0;a[p>>0]=6;a[i>>0]=a[5945]|0;a[i+1>>0]=a[5946]|0;a[i+2>>0]=a[5947]|0;a[i+3>>0]=a[5948]|0;a[i+4>>0]=a[5949]|0;a[i+5>>0]=a[5950]|0;a[m>>0]=0;F=+(E|0);G=F*50.0+120.0;H=F*10.0;j=q;k=j+36|0;do{c[j>>2]=0;j=j+4|0}while((j|0)<(k|0));c[r>>2]=6;c[h>>2]=1112014848;f[s>>2]=G;f[t>>2]=H;c[u>>2]=-1;if(!(hb(13332,i)|0)){I=c[3331]|0;J=(I-(c[3330]|0)|0)/12|0;K=I;if((c[3332]|0)==(K|0))ib(13320,i);else{ah(K,i);c[3331]=(c[3331]|0)+12}c[(gb(13332,i)|0)>>2]=J}c[v>>2]=c[(gb(13332,i)|0)>>2];F=+P(((a[p>>0]|0)<0?c[i>>2]|0:i)|0,+H);f[w>>2]=F;f[x>>2]=H;if((a[p>>0]|0)<0){Wg(c[i>>2]|0);L=+f[z>>2];M=+f[x>>2]}else{L=F;M=H}g[e>>3]=L;g[e+8>>3]=M;Jg(5952,e)|0;j=A;k=j+36|0;do{c[j>>2]=0;j=j+4|0}while((j|0)<(k|0));c[B>>2]=4;J=h;K=c[J+4>>2]|0;I=i;c[I>>2]=c[J>>2];c[I+4>>2]=K;K=z;I=c[K+4>>2]|0;J=C;c[J>>2]=c[K>>2];c[J+4>>2]=I;c[D>>2]=-1148649473;I=c[l>>2]|0;if(I>>>0<(c[n>>2]|0)>>>0){j=I;o=i;k=j+48|0;do{c[j>>2]=c[o>>2];j=j+4|0;o=o+4|0}while((j|0)<(k|0));I=(c[l>>2]|0)+48|0;c[l>>2]=I;N=I}else{fb(b,i);N=c[l>>2]|0}if((N|0)==(c[n>>2]|0))lb(b,h);else{j=N;o=h;k=j+48|0;do{c[j>>2]=c[o>>2];j=j+4|0;o=o+4|0}while((j|0)<(k|0));c[l>>2]=(c[l>>2]|0)+48}E=E+1|0}while(E>>>0<6);j=e+8|0;k=j+36|0;do{c[j>>2]=0;j=j+4|0}while((j|0)<(k|0));c[e+44>>2]=5;c[e>>2]=1132068864;c[e+4>>2]=1112014848;c[e+16>>2]=1120403456;c[e+20>>2]=1128792064;f[e+24>>2]=15.0;f[e+28>>2]=5.0;c[e+32>>2]=-1;c[e+36>>2]=1442823167;E=c[l>>2]|0;if(E>>>0<(c[n>>2]|0)>>>0){j=E;o=e;k=j+48|0;do{c[j>>2]=c[o>>2];j=j+4|0;o=o+4|0}while((j|0)<(k|0));c[l>>2]=(c[l>>2]|0)+48;za=d;return}else{fb(b,e);za=d;return}}function Va(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0;d=za;za=za+16|0;if((za|0)>=(Aa|0))y(16);e=d;c[a>>2]=b;f=Vg(16)|0;c[f+4>>2]=0;c[f+8>>2]=0;c[f>>2]=4856;c[f+12>>2]=b;c[a+4>>2]=f;c[e>>2]=b;c[e+4>>2]=b;af(a,e);za=d;return}function Wa(b){b=b|0;var d=0,e=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,z=0,A=0;d=za;za=za+144|0;if((za|0)>=(Aa|0))y(144);e=d+40|0;g=d+32|0;h=d+24|0;i=d+16|0;j=d+8|0;k=d;l=d+96|0;m=d+80|0;n=d+88|0;o=d+72|0;p=d+64|0;q=d+56|0;r=d+48|0;c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;c[b+12>>2]=0;c[b+16>>2]=0;c[b+20>>2]=0;c[b+24>>2]=0;Lg(11315)|0;s=l+8|0;t=s+36|0;do{c[s>>2]=0;s=s+4|0}while((s|0)<(t|0));c[l+44>>2]=2;c[l>>2]=1112014848;c[l+4>>2]=1112014848;f[l+16>>2]=30.0;f[l+20>>2]=30.0;c[l+32>>2]=-1711302145;u=b+4|0;v=c[u>>2]|0;w=b+8|0;if(v>>>0<(c[w>>2]|0)>>>0){s=v;x=l;t=s+48|0;do{c[s>>2]=c[x>>2];s=s+4|0;x=x+4|0}while((s|0)<(t|0));c[u>>2]=(c[u>>2]|0)+48}else fb(b,l);Lg(11342)|0;v=Vg(184)|0;Nb(v,b);c[v>>2]=3784;s=l+8|0;t=s+36|0;do{c[s>>2]=0;s=s+4|0}while((s|0)<(t|0));c[l+44>>2]=4;c[l>>2]=0;c[l+4>>2]=0;c[l+16>>2]=0;c[l+20>>2]=0;c[l+32>>2]=-1;z=c[u>>2]|0;A=c[b>>2]|0;c[A+((c[v+4>>2]|0)*48|0)+36>>2]=(z-A|0)/48|0;if((c[w>>2]|0)==(z|0))lb(b,l);else{s=z;x=l;t=s+48|0;do{c[s>>2]=c[x>>2];s=s+4|0;x=x+4|0}while((s|0)<(t|0));c[u>>2]=(c[u>>2]|0)+48}c[m>>2]=v;u=Vg(16)|0;c[u+4>>2]=0;c[u+8>>2]=0;c[u>>2]=3824;c[u+12>>2]=v;z=m+4|0;c[z>>2]=u;c[k>>2]=v;c[k+4>>2]=v;wb(m,k);v=b+12|0;u=c[m>>2]|0;w=c[z>>2]|0;c[m>>2]=0;c[z>>2]=0;c[v>>2]=u;u=b+16|0;m=c[u>>2]|0;c[u>>2]=w;if(m|0?(w=m+4|0,u=c[w>>2]|0,c[w>>2]=u+-1,(u|0)==0):0){Ga[c[(c[m>>2]|0)+8>>2]&127](m);Ug(m)}m=c[z>>2]|0;if(m|0?(z=m+4|0,u=c[z>>2]|0,c[z>>2]=u+-1,(u|0)==0):0){Ga[c[(c[m>>2]|0)+8>>2]&127](m);Ug(m)}Lg(11344)|0;m=c[(c[v>>2]|0)+4>>2]|0;u=c[b>>2]|0;c[u+(m*48|0)+8>>2]=1056964608;c[u+(m*48|0)+12>>2]=1056964608;m=c[(c[v>>2]|0)+4>>2]|0;u=c[b>>2]|0;c[u+(m*48|0)>>2]=1056964608;c[u+(m*48|0)+4>>2]=1056964608;m=c[v>>2]|0;c[m+8>>2]=1056964608;c[m+12>>2]=1056964608;Lg(11346)|0;m=Vg(184)|0;c[l>>2]=0;c[l+4>>2]=0;c[l+8>>2]=0;u=Vg(16)|0;c[l>>2]=u;c[l+8>>2]=-2147483632;c[l+4>>2]=12;s=u;x=6051;t=s+12|0;do{a[s>>0]=a[x>>0]|0;s=s+1|0;x=x+1|0}while((s|0)<(t|0));a[u+12>>0]=0;mb(m,b,l,65535,20.0);c[k>>2]=m;u=Vg(16)|0;c[u+4>>2]=0;c[u+8>>2]=0;c[u>>2]=3872;c[u+12>>2]=m;z=k+4|0;c[z>>2]=u;c[j>>2]=m;c[j+4>>2]=m;wb(k,j);if((a[l+11>>0]|0)<0)Wg(c[l>>2]|0);m=c[v>>2]|0;u=c[c[m>>2]>>2]|0;c[n>>2]=c[k>>2];k=n+4|0;w=c[z>>2]|0;c[k>>2]=w;if(w|0){A=w+4|0;c[A>>2]=(c[A>>2]|0)+1}Ia[u&3](m,b,n);n=c[k>>2]|0;if(n|0?(k=n+4|0,m=c[k>>2]|0,c[k>>2]=m+-1,(m|0)==0):0){Ga[c[(c[n>>2]|0)+8>>2]&127](n);Ug(n)}n=Vg(184)|0;c[l>>2]=0;c[l+4>>2]=0;c[l+8>>2]=0;m=Vg(16)|0;c[l>>2]=m;c[l+8>>2]=-2147483632;c[l+4>>2]=12;s=m;x=6051;t=s+12|0;do{a[s>>0]=a[x>>0]|0;s=s+1|0;x=x+1|0}while((s|0)<(t|0));a[m+12>>0]=0;mb(n,b,l,65535,20.0);c[j>>2]=n;m=Vg(16)|0;c[m+4>>2]=0;c[m+8>>2]=0;c[m>>2]=3872;c[m+12>>2]=n;k=j+4|0;c[k>>2]=m;c[i>>2]=n;c[i+4>>2]=n;wb(j,i);if((a[l+11>>0]|0)<0)Wg(c[l>>2]|0);n=c[(c[j>>2]|0)+4>>2]|0;m=c[b>>2]|0;c[m+(n*48|0)>>2]=1065353216;c[m+(n*48|0)+4>>2]=0;n=c[j>>2]|0;c[n+8>>2]=1065353216;c[n+12>>2]=0;j=c[v>>2]|0;m=c[c[j>>2]>>2]|0;c[o>>2]=n;n=o+4|0;u=c[k>>2]|0;c[n>>2]=u;if(u|0){A=u+4|0;c[A>>2]=(c[A>>2]|0)+1}Ia[m&3](j,b,o);o=c[n>>2]|0;if(o|0?(n=o+4|0,j=c[n>>2]|0,c[n>>2]=j+-1,(j|0)==0):0){Ga[c[(c[o>>2]|0)+8>>2]&127](o);Ug(o)}o=Vg(184)|0;c[l>>2]=0;c[l+4>>2]=0;c[l+8>>2]=0;j=Vg(16)|0;c[l>>2]=j;c[l+8>>2]=-2147483632;c[l+4>>2]=12;s=j;x=6051;t=s+12|0;do{a[s>>0]=a[x>>0]|0;s=s+1|0;x=x+1|0}while((s|0)<(t|0));a[j+12>>0]=0;mb(o,b,l,65535,20.0);c[i>>2]=o;j=Vg(16)|0;c[j+4>>2]=0;c[j+8>>2]=0;c[j>>2]=3872;c[j+12>>2]=o;n=i+4|0;c[n>>2]=j;c[h>>2]=o;c[h+4>>2]=o;wb(i,h);if((a[l+11>>0]|0)<0)Wg(c[l>>2]|0);o=c[(c[i>>2]|0)+4>>2]|0;j=c[b>>2]|0;c[j+(o*48|0)>>2]=0;c[j+(o*48|0)+4>>2]=1065353216;o=c[i>>2]|0;c[o+8>>2]=0;c[o+12>>2]=1065353216;i=c[v>>2]|0;j=c[c[i>>2]>>2]|0;c[p>>2]=o;o=p+4|0;m=c[n>>2]|0;c[o>>2]=m;if(m|0){A=m+4|0;c[A>>2]=(c[A>>2]|0)+1}Ia[j&3](i,b,p);p=c[o>>2]|0;if(p|0?(o=p+4|0,i=c[o>>2]|0,c[o>>2]=i+-1,(i|0)==0):0){Ga[c[(c[p>>2]|0)+8>>2]&127](p);Ug(p)}p=Vg(184)|0;c[l>>2]=0;c[l+4>>2]=0;c[l+8>>2]=0;i=Vg(16)|0;c[l>>2]=i;c[l+8>>2]=-2147483632;c[l+4>>2]=12;s=i;x=6051;t=s+12|0;do{a[s>>0]=a[x>>0]|0;s=s+1|0;x=x+1|0}while((s|0)<(t|0));a[i+12>>0]=0;mb(p,b,l,65535,20.0);c[h>>2]=p;i=Vg(16)|0;c[i+4>>2]=0;c[i+8>>2]=0;c[i>>2]=3872;c[i+12>>2]=p;o=h+4|0;c[o>>2]=i;c[g>>2]=p;c[g+4>>2]=p;wb(h,g);if((a[l+11>>0]|0)<0)Wg(c[l>>2]|0);p=c[(c[h>>2]|0)+4>>2]|0;i=c[b>>2]|0;c[i+(p*48|0)>>2]=1065353216;c[i+(p*48|0)+4>>2]=1065353216;p=c[h>>2]|0;c[p+8>>2]=1065353216;c[p+12>>2]=1065353216;h=c[v>>2]|0;i=c[c[h>>2]>>2]|0;c[q>>2]=p;p=q+4|0;j=c[o>>2]|0;c[p>>2]=j;if(j|0){A=j+4|0;c[A>>2]=(c[A>>2]|0)+1}Ia[i&3](h,b,q);q=c[p>>2]|0;if(q|0?(p=q+4|0,h=c[p>>2]|0,c[p>>2]=h+-1,(h|0)==0):0){Ga[c[(c[q>>2]|0)+8>>2]&127](q);Ug(q)}q=Vg(184)|0;c[l>>2]=0;c[l+4>>2]=0;c[l+8>>2]=0;h=Vg(16)|0;c[l>>2]=h;c[l+8>>2]=-2147483632;c[l+4>>2]=12;s=h;x=6051;t=s+12|0;do{a[s>>0]=a[x>>0]|0;s=s+1|0;x=x+1|0}while((s|0)<(t|0));a[h+12>>0]=0;mb(q,b,l,65535,20.0);c[g>>2]=q;h=Vg(16)|0;c[h+4>>2]=0;c[h+8>>2]=0;c[h>>2]=3872;c[h+12>>2]=q;x=g+4|0;c[x>>2]=h;c[e>>2]=q;c[e+4>>2]=q;wb(g,e);if((a[l+11>>0]|0)<0)Wg(c[l>>2]|0);l=c[(c[g>>2]|0)+4>>2]|0;e=c[b>>2]|0;c[e+(l*48|0)>>2]=1056964608;c[e+(l*48|0)+4>>2]=1056964608;l=c[g>>2]|0;c[l+8>>2]=1056964608;c[l+12>>2]=1056964608;g=c[v>>2]|0;v=c[c[g>>2]>>2]|0;c[r>>2]=l;l=r+4|0;e=c[x>>2]|0;c[l>>2]=e;if(e|0){q=e+4|0;c[q>>2]=(c[q>>2]|0)+1}Ia[v&3](g,b,r);r=c[l>>2]|0;do if(r|0){l=r+4|0;b=c[l>>2]|0;c[l>>2]=b+-1;if(b|0)break;Ga[c[(c[r>>2]|0)+8>>2]&127](r);Ug(r)}while(0);r=c[x>>2]|0;do if(r|0){x=r+4|0;b=c[x>>2]|0;c[x>>2]=b+-1;if(b|0)break;Ga[c[(c[r>>2]|0)+8>>2]&127](r);Ug(r)}while(0);r=c[o>>2]|0;do if(r|0){o=r+4|0;b=c[o>>2]|0;c[o>>2]=b+-1;if(b|0)break;Ga[c[(c[r>>2]|0)+8>>2]&127](r);Ug(r)}while(0);r=c[n>>2]|0;do if(r|0){n=r+4|0;b=c[n>>2]|0;c[n>>2]=b+-1;if(b|0)break;Ga[c[(c[r>>2]|0)+8>>2]&127](r);Ug(r)}while(0);r=c[k>>2]|0;do if(r|0){k=r+4|0;b=c[k>>2]|0;c[k>>2]=b+-1;if(b|0)break;Ga[c[(c[r>>2]|0)+8>>2]&127](r);Ug(r)}while(0);r=c[z>>2]|0;if(!r){za=d;return}z=r+4|0;b=c[z>>2]|0;c[z>>2]=b+-1;if(b|0){za=d;return}Ga[c[(c[r>>2]|0)+8>>2]&127](r);Ug(r);za=d;return}function Xa(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0;d=za;za=za+16|0;if((za|0)>=(Aa|0))y(16);e=d;c[a>>2]=b;f=Vg(16)|0;c[f+4>>2]=0;c[f+8>>2]=0;c[f>>2]=4884;c[f+12>>2]=b;c[a+4>>2]=f;c[e>>2]=b;c[e+4>>2]=b;af(a,e);za=d;return}function Ya(a){a=a|0;var b=0,d=0,e=0,g=0,h=0,i=0,j=0,k=0,l=0;b=za;za=za+80|0;if((za|0)>=(Aa|0))y(80);d=b+24|0;e=b;g=b+8|0;h=b+16|0;c[a>>2]=0;c[a+4>>2]=0;c[a+8>>2]=0;c[a+12>>2]=0;c[a+16>>2]=0;c[a+20>>2]=0;c[a+24>>2]=0;Lg(11348)|0;i=d+8|0;j=i+36|0;do{c[i>>2]=0;i=i+4|0}while((i|0)<(j|0));c[d+44>>2]=2;c[d>>2]=1112014848;c[d+4>>2]=1112014848;f[d+16>>2]=30.0;f[d+20>>2]=30.0;c[d+32>>2]=1722482687;k=a+4|0;l=c[k>>2]|0;if(l>>>0<(c[a+8>>2]|0)>>>0){i=l;l=d;j=i+48|0;do{c[i>>2]=c[l>>2];i=i+4|0;l=l+4|0}while((i|0)<(j|0));c[k>>2]=(c[k>>2]|0)+48}else fb(a,d);k=Vg(192)|0;c[h>>2]=20;c[h+4>>2]=30;c[d>>2]=c[h>>2];c[d+4>>2]=c[h+4>>2];Ib(k,a,d);c[g>>2]=k;d=Vg(16)|0;c[d+4>>2]=0;c[d+8>>2]=0;c[d>>2]=3920;c[d+12>>2]=k;h=g+4|0;c[h>>2]=d;c[e>>2]=k;c[e+4>>2]=k;wb(g,e);e=a+12|0;k=c[g>>2]|0;d=c[h>>2]|0;c[g>>2]=0;c[h>>2]=0;c[e>>2]=k;k=a+16|0;g=c[k>>2]|0;c[k>>2]=d;if(g|0?(d=g+4|0,k=c[d>>2]|0,c[d>>2]=k+-1,(k|0)==0):0){Ga[c[(c[g>>2]|0)+8>>2]&127](g);Ug(g)}g=c[h>>2]|0;if(g|0?(h=g+4|0,k=c[h>>2]|0,c[h>>2]=k+-1,(k|0)==0):0){Ga[c[(c[g>>2]|0)+8>>2]&127](g);Ug(g)}g=c[e>>2]|0;c[g+52>>2]=1;k=c[g+4>>2]|0;g=c[a>>2]|0;c[g+(k*48|0)+8>>2]=1065353216;c[g+(k*48|0)+12>>2]=1065353216;k=c[(c[e>>2]|0)+4>>2]|0;g=c[a>>2]|0;c[g+(k*48|0)+24>>2]=-1054867456;c[g+(k*48|0)+28>>2]=-1054867456;k=c[(c[e>>2]|0)+4>>2]|0;g=c[a>>2]|0;c[g+(k*48|0)>>2]=1056964608;c[g+(k*48|0)+4>>2]=1056964608;k=c[e>>2]|0;c[k+8>>2]=1056964608;c[k+12>>2]=1056964608;za=b;return}function Za(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0;d=za;za=za+16|0;if((za|0)>=(Aa|0))y(16);e=d;c[a>>2]=b;f=Vg(16)|0;c[f+4>>2]=0;c[f+8>>2]=0;c[f>>2]=4912;c[f+12>>2]=b;c[a+4>>2]=f;c[e>>2]=b;c[e+4>>2]=b;af(a,e);za=d;return}function _a(b){b=b|0;var d=0,e=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0;d=za;za=za+432|0;if((za|0)>=(Aa|0))y(432);e=d+312|0;g=d+264|0;h=d+216|0;i=d+168|0;j=d+120|0;k=d+72|0;l=d+336|0;m=d+48|0;n=d+24|0;o=d;p=d+416|0;q=d+408|0;r=d+400|0;s=d+392|0;t=d+384|0;c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;c[b+12>>2]=0;c[b+16>>2]=0;c[b+20>>2]=0;c[b+24>>2]=0;Lg(11376)|0;u=l+8|0;v=u+36|0;do{c[u>>2]=0;u=u+4|0}while((u|0)<(v|0));c[l+44>>2]=2;c[l>>2]=1112014848;c[l+4>>2]=1112014848;f[l+16>>2]=30.0;f[l+20>>2]=30.0;c[l+32>>2]=-16711681;w=b+4|0;x=c[w>>2]|0;z=b+8|0;if(x>>>0<(c[z>>2]|0)>>>0){u=x;A=l;v=u+48|0;do{c[u>>2]=c[A>>2];u=u+4|0;A=A+4|0}while((u|0)<(v|0));c[w>>2]=(c[w>>2]|0)+48}else fb(b,l);x=Vg(184)|0;Nb(x,b);c[l>>2]=x;B=Vg(16)|0;c[B+4>>2]=0;c[B+8>>2]=0;c[B>>2]=3948;c[B+12>>2]=x;C=l+4|0;c[C>>2]=B;c[k>>2]=x;c[k+4>>2]=x;wb(l,k);x=b+12|0;B=c[l>>2]|0;D=c[C>>2]|0;c[l>>2]=0;c[C>>2]=0;c[x>>2]=B;B=b+16|0;E=c[B>>2]|0;c[B>>2]=D;if(E|0?(D=E+4|0,B=c[D>>2]|0,c[D>>2]=B+-1,(B|0)==0):0){Ga[c[(c[E>>2]|0)+8>>2]&127](E);Ug(E)}E=c[C>>2]|0;if(E|0?(C=E+4|0,B=c[C>>2]|0,c[C>>2]=B+-1,(B|0)==0):0){Ga[c[(c[E>>2]|0)+8>>2]&127](E);Ug(E)}E=c[(c[x>>2]|0)+4>>2]|0;B=c[b>>2]|0;c[B+(E*48|0)+8>>2]=1065353216;c[B+(E*48|0)+12>>2]=1065353216;E=Vg(184)|0;Nb(E,b);c[E>>2]=3784;u=k+8|0;v=u+36|0;do{c[u>>2]=0;u=u+4|0}while((u|0)<(v|0));c[k+44>>2]=4;c[k>>2]=0;c[k+4>>2]=0;c[k+16>>2]=0;c[k+20>>2]=0;c[k+32>>2]=-1;B=c[w>>2]|0;C=c[b>>2]|0;c[C+((c[E+4>>2]|0)*48|0)+36>>2]=(B-C|0)/48|0;if((c[z>>2]|0)==(B|0))lb(b,k);else{u=B;A=k;v=u+48|0;do{c[u>>2]=c[A>>2];u=u+4|0;A=A+4|0}while((u|0)<(v|0));c[w>>2]=(c[w>>2]|0)+48}c[l>>2]=E;B=Vg(16)|0;c[B+4>>2]=0;c[B+8>>2]=0;c[B>>2]=3824;c[B+12>>2]=E;C=l+4|0;c[C>>2]=B;c[j>>2]=E;c[j+4>>2]=E;wb(l,j);E=c[(c[l>>2]|0)+4>>2]|0;B=c[b>>2]|0;c[B+(E*48|0)>>2]=1062836634;c[B+(E*48|0)+4>>2]=1062836634;E=c[l>>2]|0;c[E+8>>2]=1056964608;c[E+12>>2]=1056964608;B=c[E+4>>2]|0;D=c[b>>2]|0;c[D+(B*48|0)+24>>2]=1117782016;c[D+(B*48|0)+28>>2]=1117782016;B=j+16|0;c[B>>2]=0;Sb(j,E+64|0);D=c[B>>2]|0;if((j|0)!=(D|0)){if(D|0)Ga[c[(c[D>>2]|0)+20>>2]&127](D)}else Ga[c[(c[D>>2]|0)+16>>2]&127](D);a[E+56>>0]=1;E=Vg(184)|0;Nb(E,b);c[E>>2]=3784;u=j+8|0;v=u+36|0;do{c[u>>2]=0;u=u+4|0}while((u|0)<(v|0));c[j+44>>2]=4;c[j>>2]=0;c[j+4>>2]=0;c[j+16>>2]=0;c[j+20>>2]=0;c[j+32>>2]=-1426076417;D=c[w>>2]|0;B=c[b>>2]|0;c[B+((c[E+4>>2]|0)*48|0)+36>>2]=(D-B|0)/48|0;if((c[z>>2]|0)==(D|0))lb(b,j);else{u=D;A=j;v=u+48|0;do{c[u>>2]=c[A>>2];u=u+4|0;A=A+4|0}while((u|0)<(v|0));c[w>>2]=(c[w>>2]|0)+48}c[k>>2]=E;D=Vg(16)|0;c[D+4>>2]=0;c[D+8>>2]=0;c[D>>2]=3824;c[D+12>>2]=E;B=k+4|0;c[B>>2]=D;c[i>>2]=E;c[i+4>>2]=E;wb(k,i);E=c[(c[k>>2]|0)+4>>2]|0;D=c[b>>2]|0;c[D+(E*48|0)>>2]=1048576e3;c[D+(E*48|0)+4>>2]=1048576e3;E=c[k>>2]|0;c[E+8>>2]=1056964608;c[E+12>>2]=1056964608;D=c[E+4>>2]|0;F=c[b>>2]|0;c[F+(D*48|0)+24>>2]=1117782016;c[F+(D*48|0)+28>>2]=1117782016;D=m+16|0;c[m>>2]=3976;c[D>>2]=m;F=i+16|0;c[F>>2]=i;c[i>>2]=3976;Sb(i,E+64|0);G=c[F>>2]|0;if((i|0)!=(G|0)){if(G|0)Ga[c[(c[G>>2]|0)+20>>2]&127](G)}else Ga[c[(c[G>>2]|0)+16>>2]&127](G);a[E+56>>0]=1;E=c[D>>2]|0;if((m|0)!=(E|0)){if(E|0)Ga[c[(c[E>>2]|0)+20>>2]&127](E)}else Ga[c[(c[E>>2]|0)+16>>2]&127](E);E=Vg(184)|0;Nb(E,b);c[E>>2]=3784;u=i+8|0;v=u+36|0;do{c[u>>2]=0;u=u+4|0}while((u|0)<(v|0));c[i+44>>2]=4;c[i>>2]=0;c[i+4>>2]=0;c[i+16>>2]=0;c[i+20>>2]=0;c[i+32>>2]=-1429405697;m=c[w>>2]|0;D=c[b>>2]|0;c[D+((c[E+4>>2]|0)*48|0)+36>>2]=(m-D|0)/48|0;if((c[z>>2]|0)==(m|0))lb(b,i);else{u=m;A=i;v=u+48|0;do{c[u>>2]=c[A>>2];u=u+4|0;A=A+4|0}while((u|0)<(v|0));c[w>>2]=(c[w>>2]|0)+48}c[j>>2]=E;m=Vg(16)|0;c[m+4>>2]=0;c[m+8>>2]=0;c[m>>2]=3824;c[m+12>>2]=E;D=j+4|0;c[D>>2]=m;c[h>>2]=E;c[h+4>>2]=E;wb(j,h);E=c[(c[j>>2]|0)+4>>2]|0;m=c[b>>2]|0;c[m+(E*48|0)>>2]=1048576e3;c[m+(E*48|0)+4>>2]=1061158912;E=c[j>>2]|0;c[E+8>>2]=1056964608;c[E+12>>2]=1056964608;m=c[E+4>>2]|0;G=c[b>>2]|0;c[G+(m*48|0)+24>>2]=1117782016;c[G+(m*48|0)+28>>2]=1117782016;m=n+16|0;c[n>>2]=4020;c[m>>2]=n;G=h+16|0;c[G>>2]=h;c[h>>2]=4020;Sb(h,E+64|0);F=c[G>>2]|0;if((h|0)!=(F|0)){if(F|0)Ga[c[(c[F>>2]|0)+20>>2]&127](F)}else Ga[c[(c[F>>2]|0)+16>>2]&127](F);a[E+56>>0]=1;E=c[m>>2]|0;if((n|0)!=(E|0)){if(E|0)Ga[c[(c[E>>2]|0)+20>>2]&127](E)}else Ga[c[(c[E>>2]|0)+16>>2]&127](E);E=Vg(184)|0;Nb(E,b);c[E>>2]=4064;u=h+8|0;v=u+36|0;do{c[u>>2]=0;u=u+4|0}while((u|0)<(v|0));c[h+44>>2]=3;c[h>>2]=0;c[h+4>>2]=0;f[h+16>>2]=0.0;f[h+20>>2]=0.0;f[h+24>>2]=5.0;c[h+28>>2]=0;c[h+32>>2]=-1429405697;n=c[w>>2]|0;m=c[b>>2]|0;c[m+((c[E+4>>2]|0)*48|0)+36>>2]=(n-m|0)/48|0;if((c[z>>2]|0)==(n|0))lb(b,h);else{u=n;A=h;v=u+48|0;do{c[u>>2]=c[A>>2];u=u+4|0;A=A+4|0}while((u|0)<(v|0));c[w>>2]=(c[w>>2]|0)+48}c[i>>2]=E;n=Vg(16)|0;c[n+4>>2]=0;c[n+8>>2]=0;c[n>>2]=4084;c[n+12>>2]=E;m=i+4|0;c[m>>2]=n;c[g>>2]=E;c[g+4>>2]=E;kc(i,g);E=(c[i>>2]|0)+4|0;n=c[E>>2]|0;F=c[b>>2]|0;f[F+(n*48|0)+8>>2]=0.0;f[F+(n*48|0)+12>>2]=0.0;n=c[E>>2]|0;F=c[b>>2]|0;f[F+(n*48|0)+24>>2]=300.0;f[F+(n*48|0)+28>>2]=300.0;n=c[E>>2]|0;E=c[b>>2]|0;c[E+(n*48|0)>>2]=1056964608;c[E+(n*48|0)+4>>2]=1056964608;n=c[i>>2]|0;c[n+8>>2]=1056964608;c[n+12>>2]=1056964608;n=Vg(184)|0;Nb(n,b);c[n>>2]=4112;u=g+8|0;v=u+36|0;do{c[u>>2]=0;u=u+4|0}while((u|0)<(v|0));c[g+44>>2]=2;c[g>>2]=0;c[g+4>>2]=0;f[g+16>>2]=0.0;f[g+20>>2]=0.0;c[g+32>>2]=-1429405697;E=c[w>>2]|0;F=c[b>>2]|0;c[F+((c[n+4>>2]|0)*48|0)+36>>2]=(E-F|0)/48|0;if((c[z>>2]|0)==(E|0))lb(b,g);else{u=E;A=g;v=u+48|0;do{c[u>>2]=c[A>>2];u=u+4|0;A=A+4|0}while((u|0)<(v|0));c[w>>2]=(c[w>>2]|0)+48}c[h>>2]=n;w=Vg(16)|0;c[w+4>>2]=0;c[w+8>>2]=0;c[w>>2]=4132;c[w+12>>2]=n;A=h+4|0;c[A>>2]=w;c[e>>2]=n;c[e+4>>2]=n;rc(h,e);n=(c[h>>2]|0)+4|0;w=c[n>>2]|0;u=c[b>>2]|0;f[u+(w*48|0)+8>>2]=0.0;f[u+(w*48|0)+12>>2]=0.0;w=c[n>>2]|0;u=c[b>>2]|0;f[u+(w*48|0)+24>>2]=100.0;f[u+(w*48|0)+28>>2]=100.0;w=c[n>>2]|0;n=c[b>>2]|0;c[n+(w*48|0)>>2]=1056964608;c[n+(w*48|0)+4>>2]=1056964608;w=c[h>>2]|0;c[w+8>>2]=1056964608;c[w+12>>2]=1056964608;n=c[w+4>>2]|0;u=c[b>>2]|0;c[u+(n*48|0)+16>>2]=0;c[u+(n*48|0)+20>>2]=1125515264;n=o+16|0;c[o>>2]=4160;c[n>>2]=o;u=e+16|0;c[u>>2]=e;c[e>>2]=4160;Sb(e,w+64|0);v=c[u>>2]|0;if((e|0)!=(v|0)){if(v|0)Ga[c[(c[v>>2]|0)+20>>2]&127](v)}else Ga[c[(c[v>>2]|0)+16>>2]&127](v);a[w+56>>0]=1;w=c[n>>2]|0;if((o|0)!=(w|0)){if(w|0)Ga[c[(c[w>>2]|0)+20>>2]&127](w)}else Ga[c[(c[w>>2]|0)+16>>2]&127](w);w=c[x>>2]|0;o=c[c[w>>2]>>2]|0;c[p>>2]=c[l>>2];l=p+4|0;n=c[C>>2]|0;c[l>>2]=n;if(n|0){v=n+4|0;c[v>>2]=(c[v>>2]|0)+1}Ia[o&3](w,b,p);p=c[l>>2]|0;if(p|0?(l=p+4|0,w=c[l>>2]|0,c[l>>2]=w+-1,(w|0)==0):0){Ga[c[(c[p>>2]|0)+8>>2]&127](p);Ug(p)}p=c[x>>2]|0;w=c[c[p>>2]>>2]|0;c[q>>2]=c[k>>2];k=q+4|0;l=c[B>>2]|0;c[k>>2]=l;if(l|0){o=l+4|0;c[o>>2]=(c[o>>2]|0)+1}Ia[w&3](p,b,q);q=c[k>>2]|0;do if(q|0){k=q+4|0;p=c[k>>2]|0;c[k>>2]=p+-1;if(p|0)break;Ga[c[(c[q>>2]|0)+8>>2]&127](q);Ug(q)}while(0);q=c[x>>2]|0;p=c[c[q>>2]>>2]|0;c[r>>2]=c[j>>2];j=r+4|0;k=c[D>>2]|0;c[j>>2]=k;if(k|0){w=k+4|0;c[w>>2]=(c[w>>2]|0)+1}Ia[p&3](q,b,r);r=c[j>>2]|0;do if(r|0){j=r+4|0;q=c[j>>2]|0;c[j>>2]=q+-1;if(q|0)break;Ga[c[(c[r>>2]|0)+8>>2]&127](r);Ug(r)}while(0);r=c[x>>2]|0;q=c[c[r>>2]>>2]|0;c[s>>2]=c[i>>2];i=s+4|0;j=c[m>>2]|0;c[i>>2]=j;if(j|0){p=j+4|0;c[p>>2]=(c[p>>2]|0)+1}Ia[q&3](r,b,s);s=c[i>>2]|0;do if(s|0){i=s+4|0;r=c[i>>2]|0;c[i>>2]=r+-1;if(r|0)break;Ga[c[(c[s>>2]|0)+8>>2]&127](s);Ug(s)}while(0);s=c[x>>2]|0;x=c[c[s>>2]>>2]|0;c[t>>2]=c[h>>2];h=t+4|0;r=c[A>>2]|0;c[h>>2]=r;if(r|0){i=r+4|0;c[i>>2]=(c[i>>2]|0)+1}Ia[x&3](s,b,t);t=c[h>>2]|0;do if(t|0){h=t+4|0;b=c[h>>2]|0;c[h>>2]=b+-1;if(b|0)break;Ga[c[(c[t>>2]|0)+8>>2]&127](t);Ug(t)}while(0);t=c[A>>2]|0;do if(t|0){A=t+4|0;b=c[A>>2]|0;c[A>>2]=b+-1;if(b|0)break;Ga[c[(c[t>>2]|0)+8>>2]&127](t);Ug(t)}while(0);t=c[m>>2]|0;do if(t|0){m=t+4|0;b=c[m>>2]|0;c[m>>2]=b+-1;if(b|0)break;Ga[c[(c[t>>2]|0)+8>>2]&127](t);Ug(t)}while(0);t=c[D>>2]|0;do if(t|0){D=t+4|0;b=c[D>>2]|0;c[D>>2]=b+-1;if(b|0)break;Ga[c[(c[t>>2]|0)+8>>2]&127](t);Ug(t)}while(0);t=c[B>>2]|0;do if(t|0){B=t+4|0;b=c[B>>2]|0;c[B>>2]=b+-1;if(b|0)break;Ga[c[(c[t>>2]|0)+8>>2]&127](t);Ug(t)}while(0);t=c[C>>2]|0;if(!t){za=d;return}C=t+4|0;b=c[C>>2]|0;c[C>>2]=b+-1;if(b|0){za=d;return}Ga[c[(c[t>>2]|0)+8>>2]&127](t);Ug(t);za=d;return}function $a(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0;d=za;za=za+16|0;if((za|0)>=(Aa|0))y(16);e=d;c[a>>2]=b;f=Vg(16)|0;c[f+4>>2]=0;c[f+8>>2]=0;c[f>>2]=4940;c[f+12>>2]=b;c[a+4>>2]=f;c[e>>2]=b;c[e+4>>2]=b;af(a,e);za=d;return}function ab(a){a=a|0;var b=0,d=0,e=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0;b=za;za=za+352|0;if((za|0)>=(Aa|0))y(352);d=b+272|0;e=b+264|0;g=b+216|0;h=b+168|0;i=b+304|0;j=b+144|0;k=b+120|0;l=b+96|0;m=b+72|0;n=b+48|0;o=b+24|0;p=b;q=b+296|0;r=b+288|0;s=b+280|0;c[a>>2]=0;c[a+4>>2]=0;c[a+8>>2]=0;c[a+12>>2]=0;c[a+16>>2]=0;c[a+20>>2]=0;c[a+24>>2]=0;Lg(11376)|0;t=i+8|0;u=t+36|0;do{c[t>>2]=0;t=t+4|0}while((t|0)<(u|0));c[i+44>>2]=2;c[i>>2]=1112014848;c[i+4>>2]=1112014848;f[i+16>>2]=30.0;f[i+20>>2]=30.0;c[i+32>>2]=-3364097;v=a+4|0;w=c[v>>2]|0;x=a+8|0;if(w>>>0<(c[x>>2]|0)>>>0){t=w;z=i;u=t+48|0;do{c[t>>2]=c[z>>2];t=t+4|0;z=z+4|0}while((t|0)<(u|0));c[v>>2]=(c[v>>2]|0)+48}else fb(a,i);w=Vg(184)|0;Nb(w,a);c[i>>2]=w;A=Vg(16)|0;c[A+4>>2]=0;c[A+8>>2]=0;c[A>>2]=3948;c[A+12>>2]=w;B=i+4|0;c[B>>2]=A;c[h>>2]=w;c[h+4>>2]=w;wb(i,h);w=a+12|0;A=c[i>>2]|0;C=c[B>>2]|0;c[i>>2]=0;c[B>>2]=0;c[w>>2]=A;A=a+16|0;D=c[A>>2]|0;c[A>>2]=C;if(D|0?(C=D+4|0,A=c[C>>2]|0,c[C>>2]=A+-1,(A|0)==0):0){Ga[c[(c[D>>2]|0)+8>>2]&127](D);Ug(D)}D=c[B>>2]|0;if(D|0?(B=D+4|0,A=c[B>>2]|0,c[B>>2]=A+-1,(A|0)==0):0){Ga[c[(c[D>>2]|0)+8>>2]&127](D);Ug(D)}D=c[(c[w>>2]|0)+4>>2]|0;A=c[a>>2]|0;c[A+(D*48|0)+8>>2]=1065353216;c[A+(D*48|0)+12>>2]=1065353216;D=Vg(184)|0;Nb(D,a);c[D>>2]=4112;t=h+8|0;u=t+36|0;do{c[t>>2]=0;t=t+4|0}while((t|0)<(u|0));c[h+44>>2]=2;c[h>>2]=0;c[h+4>>2]=0;f[h+16>>2]=0.0;f[h+20>>2]=0.0;c[h+32>>2]=-1429405697;A=c[v>>2]|0;B=c[a>>2]|0;c[B+((c[D+4>>2]|0)*48|0)+36>>2]=(A-B|0)/48|0;if((c[x>>2]|0)==(A|0))lb(a,h);else{t=A;z=h;u=t+48|0;do{c[t>>2]=c[z>>2];t=t+4|0;z=z+4|0}while((t|0)<(u|0));c[v>>2]=(c[v>>2]|0)+48}c[i>>2]=D;A=Vg(16)|0;c[A+4>>2]=0;c[A+8>>2]=0;c[A>>2]=4132;c[A+12>>2]=D;B=i+4|0;c[B>>2]=A;c[g>>2]=D;c[g+4>>2]=D;rc(i,g);D=(c[i>>2]|0)+4|0;A=c[D>>2]|0;C=c[a>>2]|0;f[C+(A*48|0)+8>>2]=0.0;f[C+(A*48|0)+12>>2]=0.0;A=c[D>>2]|0;C=c[a>>2]|0;f[C+(A*48|0)+24>>2]=100.0;f[C+(A*48|0)+28>>2]=100.0;A=c[D>>2]|0;D=c[a>>2]|0;c[D+(A*48|0)>>2]=1065353216;c[D+(A*48|0)+4>>2]=0;A=c[i>>2]|0;D=c[A+4>>2]|0;C=c[a>>2]|0;c[C+(D*48|0)+16>>2]=-1027080192;c[C+(D*48|0)+20>>2]=1120403456;c[A+8>>2]=1056964608;c[A+12>>2]=1056964608;D=a;C=A;E=c[B>>2]|0;if(!E)F=0;else{G=E+4|0;c[G>>2]=(c[G>>2]|0)+1;F=c[B>>2]|0}G=j+16|0;c[j>>2]=4204;c[j+4>>2]=D;c[j+8>>2]=C;c[j+12>>2]=E;c[G>>2]=j;if(!F)H=0;else{E=F+4|0;c[E>>2]=(c[E>>2]|0)+1;H=c[B>>2]|0}E=k+16|0;c[k>>2]=4248;c[k+4>>2]=D;c[k+8>>2]=C;c[k+12>>2]=F;c[E>>2]=k;if(H|0){F=H+4|0;c[F>>2]=(c[F>>2]|0)+1}F=l+16|0;c[l>>2]=4292;c[l+4>>2]=D;c[l+8>>2]=C;c[l+12>>2]=H;c[F>>2]=l;Ec(A,j,k,l);A=c[F>>2]|0;if((l|0)!=(A|0)){if(A|0)Ga[c[(c[A>>2]|0)+20>>2]&127](A)}else Ga[c[(c[A>>2]|0)+16>>2]&127](A);A=c[E>>2]|0;if((k|0)!=(A|0)){if(A|0)Ga[c[(c[A>>2]|0)+20>>2]&127](A)}else Ga[c[(c[A>>2]|0)+16>>2]&127](A);A=c[G>>2]|0;if((j|0)!=(A|0)){if(A|0)Ga[c[(c[A>>2]|0)+20>>2]&127](A)}else Ga[c[(c[A>>2]|0)+16>>2]&127](A);A=Vg(184)|0;Nb(A,a);c[A>>2]=4336;t=g+8|0;u=t+36|0;do{c[t>>2]=0;t=t+4|0}while((t|0)<(u|0));c[g+44>>2]=5;c[g>>2]=0;c[g+4>>2]=0;c[g+16>>2]=0;c[g+20>>2]=0;f[g+24>>2]=10.0;f[g+28>>2]=5.0;c[g+32>>2]=-1;c[g+36>>2]=869007615;j=c[v>>2]|0;G=c[a>>2]|0;c[G+((c[A+4>>2]|0)*48|0)+36>>2]=(j-G|0)/48|0;if((c[x>>2]|0)==(j|0))lb(a,g);else{t=j;z=g;u=t+48|0;do{c[t>>2]=c[z>>2];t=t+4|0;z=z+4|0}while((t|0)<(u|0));c[v>>2]=(c[v>>2]|0)+48}c[h>>2]=A;v=Vg(16)|0;c[v+4>>2]=0;c[v+8>>2]=0;c[v>>2]=4356;c[v+12>>2]=A;z=h+4|0;c[z>>2]=v;c[e>>2]=A;c[e+4>>2]=A;ld(h,e);A=(c[h>>2]|0)+4|0;v=c[A>>2]|0;t=c[a>>2]|0;c[t+(v*48|0)+24>>2]=1125515264;c[t+(v*48|0)+28>>2]=1117782016;v=c[A>>2]|0;A=c[a>>2]|0;c[A+(v*48|0)>>2]=1065353216;c[A+(v*48|0)+4>>2]=0;v=c[h>>2]|0;A=c[v+4>>2]|0;t=c[a>>2]|0;c[t+(A*48|0)+16>>2]=-1018691584;c[t+(A*48|0)+20>>2]=1133903872;c[v+8>>2]=0;c[v+12>>2]=1056964608;A=v;t=c[z>>2]|0;if(!t)I=0;else{u=t+4|0;c[u>>2]=(c[u>>2]|0)+1;I=c[z>>2]|0}u=m+16|0;c[m>>2]=4384;c[m+4>>2]=D;c[m+8>>2]=A;c[m+12>>2]=t;c[u>>2]=m;if(!I)J=0;else{t=I+4|0;c[t>>2]=(c[t>>2]|0)+1;J=c[z>>2]|0}t=n+16|0;c[n>>2]=4428;c[n+4>>2]=D;c[n+8>>2]=A;c[n+12>>2]=I;c[t>>2]=n;if(J|0){I=J+4|0;c[I>>2]=(c[I>>2]|0)+1}I=o+16|0;c[o>>2]=4472;c[o+4>>2]=D;c[o+8>>2]=A;c[o+12>>2]=J;c[I>>2]=o;Ec(v,m,n,o);v=c[I>>2]|0;if((o|0)!=(v|0)){if(v|0)Ga[c[(c[v>>2]|0)+20>>2]&127](v)}else Ga[c[(c[v>>2]|0)+16>>2]&127](v);v=c[t>>2]|0;if((n|0)!=(v|0)){if(v|0)Ga[c[(c[v>>2]|0)+20>>2]&127](v)}else Ga[c[(c[v>>2]|0)+16>>2]&127](v);v=c[u>>2]|0;if((m|0)!=(v|0)){if(v|0)Ga[c[(c[v>>2]|0)+20>>2]&127](v)}else Ga[c[(c[v>>2]|0)+16>>2]&127](v);v=Vg(208)|0;m=p+16|0;c[m>>2]=0;Fc(v,a,p);c[e>>2]=v;u=Vg(16)|0;c[u+4>>2]=0;c[u+8>>2]=0;c[u>>2]=4668;c[u+12>>2]=v;n=e+4|0;c[n>>2]=u;c[d>>2]=v;c[d+4>>2]=v;pe(e,d);d=c[m>>2]|0;if((p|0)!=(d|0)){if(d|0)Ga[c[(c[d>>2]|0)+20>>2]&127](d)}else Ga[c[(c[d>>2]|0)+16>>2]&127](d);d=(c[e>>2]|0)+4|0;p=c[d>>2]|0;m=c[a>>2]|0;c[m+(p*48|0)+24>>2]=1125515264;c[m+(p*48|0)+28>>2]=1117782016;p=c[d>>2]|0;d=c[a>>2]|0;c[d+(p*48|0)>>2]=1056964608;c[d+(p*48|0)+4>>2]=1056964608;p=c[e>>2]|0;c[p+8>>2]=1056964608;c[p+12>>2]=1056964608;p=c[w>>2]|0;d=c[c[p>>2]>>2]|0;c[q>>2]=c[i>>2];i=q+4|0;m=c[B>>2]|0;c[i>>2]=m;if(m|0){v=m+4|0;c[v>>2]=(c[v>>2]|0)+1}Ia[d&3](p,a,q);q=c[i>>2]|0;do if(q|0){i=q+4|0;p=c[i>>2]|0;c[i>>2]=p+-1;if(p|0)break;Ga[c[(c[q>>2]|0)+8>>2]&127](q);Ug(q)}while(0);q=c[w>>2]|0;p=c[c[q>>2]>>2]|0;c[r>>2]=c[h>>2];h=r+4|0;i=c[z>>2]|0;c[h>>2]=i;if(i|0){d=i+4|0;c[d>>2]=(c[d>>2]|0)+1}Ia[p&3](q,a,r);r=c[h>>2]|0;do if(r|0){h=r+4|0;q=c[h>>2]|0;c[h>>2]=q+-1;if(q|0)break;Ga[c[(c[r>>2]|0)+8>>2]&127](r);Ug(r)}while(0);r=c[w>>2]|0;w=c[c[r>>2]>>2]|0;c[s>>2]=c[e>>2];e=s+4|0;q=c[n>>2]|0;c[e>>2]=q;if(q|0){h=q+4|0;c[h>>2]=(c[h>>2]|0)+1}Ia[w&3](r,a,s);s=c[e>>2]|0;do if(s|0){e=s+4|0;a=c[e>>2]|0;c[e>>2]=a+-1;if(a|0)break;Ga[c[(c[s>>2]|0)+8>>2]&127](s);Ug(s)}while(0);s=c[n>>2]|0;do if(s|0){n=s+4|0;a=c[n>>2]|0;c[n>>2]=a+-1;if(a|0)break;Ga[c[(c[s>>2]|0)+8>>2]&127](s);Ug(s)}while(0);s=c[z>>2]|0;do if(s|0){z=s+4|0;a=c[z>>2]|0;c[z>>2]=a+-1;if(a|0)break;Ga[c[(c[s>>2]|0)+8>>2]&127](s);Ug(s)}while(0);s=c[B>>2]|0;if(!s){za=b;return}B=s+4|0;a=c[B>>2]|0;c[B>>2]=a+-1;if(a|0){za=b;return}Ga[c[(c[s>>2]|0)+8>>2]&127](s);Ug(s);za=b;return}function bb(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0;d=za;za=za+16|0;if((za|0)>=(Aa|0))y(16);e=d;c[a>>2]=b;f=Vg(16)|0;c[f+4>>2]=0;c[f+8>>2]=0;c[f>>2]=4968;c[f+12>>2]=b;c[a+4>>2]=f;c[e>>2]=b;c[e+4>>2]=b;af(a,e);za=d;return}function cb(a){a=a|0;var b=0,d=0,e=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0;b=za;za=za+176|0;if((za|0)>=(Aa|0))y(176);d=b+96|0;e=b+120|0;g=b+112|0;h=b+104|0;i=b+72|0;j=b+48|0;k=b+24|0;l=b;m=a+28|0;n=a+32|0;o=a;p=o+36|0;do{c[o>>2]=0;o=o+4|0}while((o|0)<(p|0));Lg(11403)|0;o=e+8|0;p=o+36|0;do{c[o>>2]=0;o=o+4|0}while((o|0)<(p|0));c[e+44>>2]=2;c[e>>2]=1112014848;c[e+4>>2]=1112014848;f[e+16>>2]=30.0;f[e+20>>2]=30.0;c[e+32>>2]=-1728052993;q=a+4|0;r=c[q>>2]|0;if(r>>>0<(c[a+8>>2]|0)>>>0){o=r;r=e;p=o+48|0;do{c[o>>2]=c[r>>2];o=o+4|0;r=r+4|0}while((o|0)<(p|0));c[q>>2]=(c[q>>2]|0)+48}else fb(a,e);q=Vg(184)|0;Nb(q,a);c[e>>2]=q;r=Vg(16)|0;c[r+4>>2]=0;c[r+8>>2]=0;c[r>>2]=3948;c[r+12>>2]=q;o=e+4|0;c[o>>2]=r;c[d>>2]=q;c[d+4>>2]=q;wb(e,d);q=a+12|0;r=c[e>>2]|0;p=c[o>>2]|0;c[e>>2]=0;c[o>>2]=0;c[q>>2]=r;r=a+16|0;s=c[r>>2]|0;c[r>>2]=p;if(s|0?(p=s+4|0,t=c[p>>2]|0,c[p>>2]=t+-1,(t|0)==0):0){Ga[c[(c[s>>2]|0)+8>>2]&127](s);Ug(s)}s=c[o>>2]|0;if(s|0?(o=s+4|0,t=c[o>>2]|0,c[o>>2]=t+-1,(t|0)==0):0){Ga[c[(c[s>>2]|0)+8>>2]&127](s);Ug(s)}s=c[(c[q>>2]|0)+4>>2]|0;t=c[a>>2]|0;c[t+(s*48|0)+8>>2]=1065353216;c[t+(s*48|0)+12>>2]=1065353216;s=Vg(12)|0;c[h>>2]=c[q>>2];t=h+4|0;o=c[r>>2]|0;c[t>>2]=o;if(o|0){r=o+4|0;c[r>>2]=(c[r>>2]|0)+1}r=a;o=i+16|0;c[i>>2]=4724;c[i+4>>2]=r;c[o>>2]=i;ue(s,a,5,h,i);c[g>>2]=0;c[d>>2]=c[g>>2];ve(e,s,d);d=c[e>>2]|0;c[e>>2]=c[m>>2];c[m>>2]=d;d=e+4|0;e=c[d>>2]|0;m=c[n>>2]|0;c[d>>2]=m;c[n>>2]=e;e=m;if(m|0?(n=e+4|0,d=c[n>>2]|0,c[n>>2]=d+-1,(d|0)==0):0){Ga[c[(c[m>>2]|0)+8>>2]&127](e);Ug(e)}e=c[o>>2]|0;if((i|0)!=(e|0)){if(e|0)Ga[c[(c[e>>2]|0)+20>>2]&127](e)}else Ga[c[(c[e>>2]|0)+16>>2]&127](e);e=c[t>>2]|0;if(e|0?(t=e+4|0,i=c[t>>2]|0,c[t>>2]=i+-1,(i|0)==0):0){Ga[c[(c[e>>2]|0)+8>>2]&127](e);Ug(e)}e=c[q>>2]|0;q=j+16|0;c[q>>2]=0;i=k+16|0;c[i>>2]=0;t=l+16|0;c[l>>2]=4812;c[l+4>>2]=r;c[t>>2]=l;Ec(e,j,k,l);e=c[t>>2]|0;if((l|0)!=(e|0)){if(e|0)Ga[c[(c[e>>2]|0)+20>>2]&127](e)}else Ga[c[(c[e>>2]|0)+16>>2]&127](e);e=c[i>>2]|0;if((k|0)!=(e|0)){if(e|0)Ga[c[(c[e>>2]|0)+20>>2]&127](e)}else Ga[c[(c[e>>2]|0)+16>>2]&127](e);e=c[q>>2]|0;if((j|0)==(e|0)){Ga[c[(c[e>>2]|0)+16>>2]&127](e);za=b;return}if(!e){za=b;return}Ga[c[(c[e>>2]|0)+20>>2]&127](e);za=b;return}function db(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0;d=za;za=za+16|0;if((za|0)>=(Aa|0))y(16);e=d;c[a>>2]=b;f=Vg(16)|0;c[f+4>>2]=0;c[f+8>>2]=0;c[f>>2]=4996;c[f+12>>2]=b;c[a+4>>2]=f;c[e>>2]=b;c[e+4>>2]=b;af(a,e);za=d;return}function eb(a){a=a|0;Z(a|0)|0;Ch()}function fb(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;d=a+4|0;e=c[a>>2]|0;f=(c[d>>2]|0)-e|0;g=(f|0)/48|0;h=g+1|0;if(h>>>0>89478485)eh(a);i=a+8|0;j=((c[i>>2]|0)-e|0)/48|0;k=j<<1;l=j>>>0<44739242?(k>>>0<h>>>0?h:k):89478485;do if(l)if(l>>>0>89478485){k=Y(8)|0;Zg(k,5983);c[k>>2]=5696;aa(k|0,3712,122)}else{m=Vg(l*48|0)|0;break}else m=0;while(0);k=m+(g*48|0)|0;g=m+(l*48|0)|0;l=k;m=b;b=l+48|0;do{c[l>>2]=c[m>>2];l=l+4|0;m=m+4|0}while((l|0)<(b|0));m=k+(((f|0)/-48|0)*48|0)|0;if((f|0)>0)fi(m|0,e|0,f|0)|0;c[a>>2]=m;c[d>>2]=k+48;c[i>>2]=g;if(!e)return;Wg(e);return}function gb(b,e){b=b|0;e=e|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0.0,G=0.0,H=0,I=0,J=0,K=0;g=a[e+11>>0]|0;h=g<<24>>24<0;i=h?c[e>>2]|0:e;j=h?c[e+4>>2]|0:g&255;if(j>>>0>3){g=i;h=j;k=j;while(1){l=t(d[g>>0]|d[g+1>>0]<<8|d[g+2>>0]<<16|d[g+3>>0]<<24,1540483477)|0;h=(t(l>>>24^l,1540483477)|0)^(t(h,1540483477)|0);k=k+-4|0;if(k>>>0<=3)break;else g=g+4|0}g=j+-4|0;k=g&-4;m=g-k|0;n=i+(k+4)|0;o=h}else{m=j;n=i;o=j}switch(m|0){case 3:{p=d[n+2>>0]<<16^o;q=7;break}case 2:{p=o;q=7;break}case 1:{r=o;q=8;break}default:u=o}if((q|0)==7){r=d[n+1>>0]<<8^p;q=8}if((q|0)==8)u=t(r^d[n>>0],1540483477)|0;n=t(u>>>13^u,1540483477)|0;u=n>>>15^n;n=b+4|0;r=c[n>>2]|0;p=(r|0)==0;a:do if(!p){o=r+-1|0;m=(o&r|0)==0;if(!m)if(u>>>0<r>>>0)v=u;else v=(u>>>0)%(r>>>0)|0;else v=u&o;h=c[(c[b>>2]|0)+(v<<2)>>2]|0;if((h|0)!=0?(k=c[h>>2]|0,(k|0)!=0):0){h=(j|0)==0;if(m){if(h){m=k;while(1){g=c[m+4>>2]|0;if(!((g|0)==(u|0)|(g&o|0)==(v|0))){w=v;break a}g=a[m+8+11>>0]|0;if(!((g<<24>>24<0?c[m+12>>2]|0:g&255)|0)){x=m;break}m=c[m>>2]|0;if(!m){w=v;break a}}y=x+20|0;return y|0}m=k;b:while(1){g=c[m+4>>2]|0;if(!((g|0)==(u|0)|(g&o|0)==(v|0))){w=v;break a}g=m+8|0;l=a[g+11>>0]|0;z=l<<24>>24<0;A=l&255;do if(((z?c[m+12>>2]|0:A)|0)==(j|0)){l=c[g>>2]|0;if(z)if(!(Ig(l,i,j)|0)){x=m;q=68;break b}else break;if((a[i>>0]|0)==(l&255)<<24>>24){l=g;B=A;C=i;do{B=B+-1|0;l=l+1|0;if(!B){x=m;q=68;break b}C=C+1|0}while((a[l>>0]|0)==(a[C>>0]|0))}}while(0);m=c[m>>2]|0;if(!m){w=v;break a}}if((q|0)==68){y=x+20|0;return y|0}}if(h){m=k;while(1){o=c[m+4>>2]|0;if((o|0)!=(u|0)){if(o>>>0<r>>>0)D=o;else D=(o>>>0)%(r>>>0)|0;if((D|0)!=(v|0)){w=v;break a}}o=a[m+8+11>>0]|0;if(!((o<<24>>24<0?c[m+12>>2]|0:o&255)|0)){x=m;break}m=c[m>>2]|0;if(!m){w=v;break a}}y=x+20|0;return y|0}m=k;c:while(1){h=c[m+4>>2]|0;if((h|0)!=(u|0)){if(h>>>0<r>>>0)E=h;else E=(h>>>0)%(r>>>0)|0;if((E|0)!=(v|0)){w=v;break a}}h=m+8|0;o=a[h+11>>0]|0;A=o<<24>>24<0;g=o&255;do if(((A?c[m+12>>2]|0:g)|0)==(j|0)){o=c[h>>2]|0;if(A)if(!(Ig(o,i,j)|0)){x=m;q=68;break c}else break;if((a[i>>0]|0)==(o&255)<<24>>24){o=h;z=g;C=i;do{z=z+-1|0;o=o+1|0;if(!z){x=m;q=68;break c}C=C+1|0}while((a[o>>0]|0)==(a[C>>0]|0))}}while(0);m=c[m>>2]|0;if(!m){w=v;break a}}if((q|0)==68){y=x+20|0;return y|0}}else w=v}else w=0;while(0);v=Vg(24)|0;ah(v+8|0,e);c[v+20>>2]=0;c[v+4>>2]=u;c[v>>2]=0;e=b+12|0;F=+(((c[e>>2]|0)+1|0)>>>0);G=+f[b+16>>2];do if(p|G*+(r>>>0)<F){i=r<<1|(r>>>0<3|(r+-1&r|0)!=0)&1;j=~~+s(+(F/G))>>>0;jb(b,i>>>0<j>>>0?j:i);i=c[n>>2]|0;j=i+-1|0;if(!(j&i)){H=i;I=j&u;break}if(u>>>0<i>>>0){H=i;I=u}else{H=i;I=(u>>>0)%(i>>>0)|0}}else{H=r;I=w}while(0);w=(c[b>>2]|0)+(I<<2)|0;I=c[w>>2]|0;if(!I){r=b+8|0;c[v>>2]=c[r>>2];c[r>>2]=v;c[w>>2]=r;r=c[v>>2]|0;if(r|0){w=c[r+4>>2]|0;r=H+-1|0;if(r&H)if(w>>>0<H>>>0)J=w;else J=(w>>>0)%(H>>>0)|0;else J=w&r;K=(c[b>>2]|0)+(J<<2)|0;q=66}}else{c[v>>2]=c[I>>2];K=I;q=66}if((q|0)==66)c[K>>2]=v;c[e>>2]=(c[e>>2]|0)+1;x=v;y=x+20|0;return y|0}function hb(b,e){b=b|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,u=0,v=0,w=0;f=a[e+11>>0]|0;g=f<<24>>24<0;h=g?c[e>>2]|0:e;i=g?c[e+4>>2]|0:f&255;if(i>>>0>3){f=h;e=i;g=i;while(1){j=t(d[f>>0]|d[f+1>>0]<<8|d[f+2>>0]<<16|d[f+3>>0]<<24,1540483477)|0;e=(t(j>>>24^j,1540483477)|0)^(t(e,1540483477)|0);g=g+-4|0;if(g>>>0<=3)break;else f=f+4|0}f=i+-4|0;g=f&-4;k=f-g|0;l=h+(g+4)|0;m=e}else{k=i;l=h;m=i}switch(k|0){case 3:{n=d[l+2>>0]<<16^m;o=7;break}case 2:{n=m;o=7;break}case 1:{p=m;o=8;break}default:q=m}if((o|0)==7){p=d[l+1>>0]<<8^n;o=8}if((o|0)==8)q=t(p^d[l>>0],1540483477)|0;l=t(q>>>13^q,1540483477)|0;q=l>>>15^l;l=c[b+4>>2]|0;if(!l){r=0;return r|0}p=l+-1|0;n=(p&l|0)==0;if(!n)if(q>>>0<l>>>0)s=q;else s=(q>>>0)%(l>>>0)|0;else s=q&p;m=c[(c[b>>2]|0)+(s<<2)>>2]|0;if(!m){r=0;return r|0}b=c[m>>2]|0;if(!b){r=0;return r|0}m=(i|0)==0;if(n){n=b;a:while(1){k=c[n+4>>2]|0;e=(k|0)==(q|0);if(!(e|(k&p|0)==(s|0))){r=0;o=45;break}do if(e?(k=n+8|0,g=a[k+11>>0]|0,f=g<<24>>24<0,j=g&255,((f?c[n+12>>2]|0:j)|0)==(i|0)):0){g=c[k>>2]|0;u=f?g:k;v=g&255;if(f){if(m){r=n;o=45;break a}if(!(Ig(u,h,i)|0)){r=n;o=45;break a}else break}if(m){r=n;o=45;break a}if((a[h>>0]|0)==v<<24>>24){v=k;k=j;j=h;do{k=k+-1|0;v=v+1|0;if(!k){r=n;o=45;break a}j=j+1|0}while((a[v>>0]|0)==(a[j>>0]|0))}}while(0);n=c[n>>2]|0;if(!n){r=0;o=45;break}}if((o|0)==45)return r|0}n=b;b:while(1){b=c[n+4>>2]|0;do if((b|0)==(q|0)){p=n+8|0;e=a[p+11>>0]|0;j=e<<24>>24<0;v=e&255;if(((j?c[n+12>>2]|0:v)|0)==(i|0)){e=c[p>>2]|0;k=j?e:p;u=e&255;if(j){if(m){r=n;o=45;break b}if(!(Ig(k,h,i)|0)){r=n;o=45;break b}else break}if(m){r=n;o=45;break b}if((a[h>>0]|0)==u<<24>>24){u=p;p=v;v=h;do{p=p+-1|0;u=u+1|0;if(!p){r=n;o=45;break b}v=v+1|0}while((a[u>>0]|0)==(a[v>>0]|0))}}}else{if(b>>>0<l>>>0)w=b;else w=(b>>>0)%(l>>>0)|0;if((w|0)!=(s|0)){r=0;o=45;break b}}while(0);n=c[n>>2]|0;if(!n){r=0;o=45;break}}if((o|0)==45)return r|0;return 0}function ib(b,d){b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0;e=b+4|0;f=c[b>>2]|0;g=((c[e>>2]|0)-f|0)/12|0;h=g+1|0;if(h>>>0>357913941)eh(b);i=b+8|0;j=((c[i>>2]|0)-f|0)/12|0;f=j<<1;k=j>>>0<178956970?(f>>>0<h>>>0?h:f):357913941;do if(k)if(k>>>0>357913941){f=Y(8)|0;Zg(f,5983);c[f>>2]=5696;aa(f|0,3712,122)}else{l=Vg(k*12|0)|0;break}else l=0;while(0);f=l+(g*12|0)|0;g=l+(k*12|0)|0;ah(f,d);d=f+12|0;k=c[b>>2]|0;l=c[e>>2]|0;if((l|0)==(k|0)){m=f;n=k;o=k}else{h=l;l=f;do{l=l+-12|0;h=h+-12|0;c[l>>2]=c[h>>2];c[l+4>>2]=c[h+4>>2];c[l+8>>2]=c[h+8>>2];c[h>>2]=0;c[h+4>>2]=0;c[h+8>>2]=0}while((h|0)!=(k|0));m=l;n=c[b>>2]|0;o=c[e>>2]|0}c[b>>2]=m;c[e>>2]=d;c[i>>2]=g;g=n;if((o|0)!=(g|0)){i=o;do{i=i+-12|0;if((a[i+11>>0]|0)<0)Wg(c[i>>2]|0)}while((i|0)!=(g|0))}if(!n)return;Wg(n);return}function jb(a,b){a=a|0;b=b|0;var d=0,e=0,g=0,h=0;if((b|0)!=1)if(!(b+-1&b))d=b;else d=Rg(b)|0;else d=2;b=c[a+4>>2]|0;if(d>>>0>b>>>0){kb(a,d);return}if(d>>>0>=b>>>0)return;e=~~+s(+(+((c[a+12>>2]|0)>>>0)/+f[a+16>>2]))>>>0;if(b>>>0>2&(b+-1&b|0)==0){g=1<<32-(u(e+-1|0)|0);h=e>>>0<2?e:g}else h=Rg(e)|0;e=d>>>0<h>>>0?h:d;if(e>>>0>=b>>>0)return;kb(a,e);return}function kb(b,d){b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0;e=b+4|0;if(!d){f=c[b>>2]|0;c[b>>2]=0;if(f|0)Wg(f);c[e>>2]=0;return}if(d>>>0>1073741823){f=Y(8)|0;Zg(f,5983);c[f>>2]=5696;aa(f|0,3712,122)}f=Vg(d<<2)|0;g=c[b>>2]|0;c[b>>2]=f;if(g|0)Wg(g);c[e>>2]=d;e=0;do{c[(c[b>>2]|0)+(e<<2)>>2]=0;e=e+1|0}while((e|0)!=(d|0));e=b+8|0;g=c[e>>2]|0;if(!g)return;f=c[g+4>>2]|0;h=d+-1|0;i=(h&d|0)==0;if(!i)if(f>>>0<d>>>0)j=f;else j=(f>>>0)%(d>>>0)|0;else j=f&h;c[(c[b>>2]|0)+(j<<2)>>2]=e;e=c[g>>2]|0;if(!e)return;f=j;j=e;e=g;while(1){g=c[j+4>>2]|0;if(!i)if(g>>>0<d>>>0)k=g;else k=(g>>>0)%(d>>>0)|0;else k=g&h;do if((k|0)==(f|0)){l=f;m=j}else{g=(c[b>>2]|0)+(k<<2)|0;if(!(c[g>>2]|0)){c[g>>2]=e;l=k;m=j;break}g=c[j>>2]|0;a:do if(!g)n=j;else{o=j+8|0;p=a[o+11>>0]|0;q=p<<24>>24<0;r=p&255;p=q?c[j+12>>2]|0:r;s=(p|0)==0;if(q){q=j;t=g;while(1){u=t+8|0;v=a[u+11>>0]|0;w=v<<24>>24<0;if((p|0)!=((w?c[t+12>>2]|0:v&255)|0)){n=q;break a}if(!s?Ig(c[o>>2]|0,w?c[u>>2]|0:u,p)|0:0){n=q;break a}u=c[t>>2]|0;if(!u){n=t;break a}else{w=t;t=u;q=w}}}if(s){q=j;t=g;while(1){w=a[t+8+11>>0]|0;if((w<<24>>24<0?c[t+12>>2]|0:w&255)|0){n=q;break a}w=c[t>>2]|0;if(!w){n=t;break a}else{u=t;t=w;q=u}}}q=j;t=g;while(1){s=t+8|0;u=a[s+11>>0]|0;w=u<<24>>24<0;if((p|0)!=((w?c[t+12>>2]|0:u&255)|0)){n=q;break a}u=w?c[s>>2]|0:s;if((a[u>>0]|0)!=(c[o>>2]&255)<<24>>24){n=q;break a}s=o;w=r;v=u;while(1){w=w+-1|0;s=s+1|0;if(!w)break;v=v+1|0;if((a[s>>0]|0)!=(a[v>>0]|0)){n=q;break a}}v=c[t>>2]|0;if(!v){n=t;break}else{s=t;t=v;q=s}}}while(0);c[e>>2]=c[n>>2];c[n>>2]=c[c[(c[b>>2]|0)+(k<<2)>>2]>>2];c[c[(c[b>>2]|0)+(k<<2)>>2]>>2]=j;l=f;m=e}while(0);j=c[m>>2]|0;if(!j)break;else{f=l;e=m}}return}function lb(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;d=a+4|0;e=c[a>>2]|0;f=(c[d>>2]|0)-e|0;g=(f|0)/48|0;h=g+1|0;if(h>>>0>89478485)eh(a);i=a+8|0;j=((c[i>>2]|0)-e|0)/48|0;k=j<<1;l=j>>>0<44739242?(k>>>0<h>>>0?h:k):89478485;do if(l)if(l>>>0>89478485){k=Y(8)|0;Zg(k,5983);c[k>>2]=5696;aa(k|0,3712,122)}else{m=Vg(l*48|0)|0;break}else m=0;while(0);k=m+(g*48|0)|0;g=m+(l*48|0)|0;l=k;m=b;b=l+48|0;do{c[l>>2]=c[m>>2];l=l+4|0;m=m+4|0}while((l|0)<(b|0));m=k+(((f|0)/-48|0)*48|0)|0;if((f|0)>0)fi(m|0,e|0,f|0)|0;c[a>>2]=m;c[d>>2]=k+48;c[i>>2]=g;if(!e)return;Wg(e);return}function mb(b,d,e,g,h){b=b|0;d=d|0;e=e|0;g=g|0;h=+h;var i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,z=0,A=0,B=0,C=0;i=za;za=za+48|0;if((za|0)>=(Aa|0))y(48);j=i;Nb(b,d);c[b>>2]=3852;k=j+8|0;l=k+36|0;do{c[k>>2]=0;k=k+4|0}while((k|0)<(l|0));c[j+44>>2]=6;c[j>>2]=0;c[j+4>>2]=0;f[j+24>>2]=h;c[j+32>>2]=g;if(!(hb(13332,e)|0)){g=c[3331]|0;m=(g-(c[3330]|0)|0)/12|0;n=g;if((c[3332]|0)==(n|0))ib(13320,e);else{ah(n,e);c[3331]=(c[3331]|0)+12}c[(gb(13332,e)|0)>>2]=m}c[j+36>>2]=c[(gb(13332,e)|0)>>2];f[j+16>>2]=+P(((a[e+11>>0]|0)<0?c[e>>2]|0:e)|0,+h);f[j+20>>2]=h;e=d+4|0;m=c[e>>2]|0;n=c[d>>2]|0;g=b+4|0;c[n+((c[g>>2]|0)*48|0)+36>>2]=(m-n|0)/48|0;if((c[d+8>>2]|0)==(m|0)){lb(d,j);o=j+16|0;p=c[g>>2]|0;q=c[d>>2]|0;r=q+(p*48|0)+24|0;s=o;t=s;u=c[t>>2]|0;v=s+4|0;w=v;x=c[w>>2]|0;z=r;A=z;c[A>>2]=u;B=z+4|0;C=B;c[C>>2]=x;za=i;return}else{k=m;m=j;l=k+48|0;do{c[k>>2]=c[m>>2];k=k+4|0;m=m+4|0}while((k|0)<(l|0));c[e>>2]=(c[e>>2]|0)+48;o=j+16|0;p=c[g>>2]|0;q=c[d>>2]|0;r=q+(p*48|0)+24|0;s=o;t=s;u=c[t>>2]|0;v=s+4|0;w=v;x=c[w>>2]|0;z=r;A=z;c[A>>2]=u;B=z+4|0;C=B;c[C>>2]=x;za=i;return}}function nb(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0;e=c[d>>2]|0;f=c[b>>2]|0;c[f+((c[a+4>>2]|0)*48|0)+36>>2]=c[f+((c[e+4>>2]|0)*48|0)+36>>2];f=a+172|0;b=c[f>>2]|0;if((b|0)==(c[a+176>>2]|0)){vb(a+168|0,d);return}c[b>>2]=e;e=c[d+4>>2]|0;c[b+4>>2]=e;if(!e)g=b;else{b=e+4|0;c[b>>2]=(c[b>>2]|0)+1;g=c[f>>2]|0}c[f>>2]=g+8;return}function ob(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;f=za;za=za+16|0;if((za|0)>=(Aa|0))y(16);g=f+8|0;h=f;i=a+24|0;j=i;k=c[j+4>>2]|0;l=g;c[l>>2]=c[j>>2];c[l+4>>2]=k;k=a+16|0;l=k;j=c[l+4>>2]|0;m=h;c[m>>2]=c[l>>2];c[m+4>>2]=j;ub(a,b,d,e);Ja[c[(c[a>>2]|0)+8>>2]&31](a,b,h,g);g=c[a+168>>2]|0;h=c[a+172>>2]|0;if((g|0)==(h|0)){za=f;return}a=g;do{g=c[a>>2]|0;e=c[a+4>>2]|0;if(e){d=e+4|0;c[d>>2]=(c[d>>2]|0)+1;Ja[c[(c[g>>2]|0)+4>>2]&31](g,b,k,i);d=e+4|0;j=c[d>>2]|0;c[d>>2]=j+-1;if(!j){Ga[c[(c[e>>2]|0)+8>>2]&127](e);Ug(e)}}else Ja[c[(c[g>>2]|0)+4>>2]&31](g,b,k,i);a=a+8|0}while((a|0)!=(h|0));za=f;return}function pb(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0;e=c[b>>2]|0;b=(c[e+((c[a+4>>2]|0)*48|0)+32>>2]|0)+1|0;d=a+16|0;f=c[d+4>>2]|0;g=e+(b*48|0)|0;c[g>>2]=c[d>>2];c[g+4>>2]=f;f=a+24|0;a=c[f+4>>2]|0;g=e+(b*48|0)+16|0;c[g>>2]=c[f>>2];c[g+4>>2]=a;return}function qb(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;f=za;za=za+16|0;if((za|0)>=(Aa|0))y(16);g=f+8|0;h=f;i=a+24|0;j=i;k=c[j+4>>2]|0;l=g;c[l>>2]=c[j>>2];c[l+4>>2]=k;k=a+16|0;l=k;j=c[l+4>>2]|0;m=h;c[m>>2]=c[l>>2];c[m+4>>2]=j;ub(a,b,d,e);Ja[c[(c[a>>2]|0)+8>>2]&31](a,b,h,g);g=c[a+168>>2]|0;h=c[a+172>>2]|0;if((g|0)==(h|0)){za=f;return}a=g;do{g=c[a>>2]|0;e=c[a+4>>2]|0;if(e){d=e+4|0;c[d>>2]=(c[d>>2]|0)+1;Ja[c[(c[g>>2]|0)+4>>2]&31](g,b,k,i);d=e+4|0;j=c[d>>2]|0;c[d>>2]=j+-1;if(!j){Ga[c[(c[e>>2]|0)+8>>2]&127](e);Ug(e)}}else Ja[c[(c[g>>2]|0)+4>>2]&31](g,b,k,i);a=a+8|0}while((a|0)!=(h|0));za=f;return}function rb(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var h=0,i=0,j=0,k=0,l=0.0,m=0,n=0.0,o=0,p=0.0,q=0,r=0,s=0,t=0,u=0,v=0;h=za;za=za+32|0;if((za|0)>=(Aa|0))y(32);i=h;j=a+16|0;k=a+20|0;l=+f[k>>2];m=a+24|0;n=+f[m>>2];o=a+28|0;p=+f[o>>2];g[i>>3]=+f[j>>2];g[i+8>>3]=l;g[i+16>>3]=n;g[i+24>>3]=p;Jg(6192,i)|0;i=a+4|0;a=c[i>>2]|0;q=c[b>>2]|0;r=(c[q+(a*48|0)+32>>2]|0)+1|0;if(r>>>0>(c[q+(a*48|0)+36>>2]|0)>>>0){za=h;return}a=d+4|0;s=e+4|0;t=r;r=q;while(1){if(((c[r+(t*48|0)+44>>2]|0)+-2|0)>>>0<5){q=r+(t*48|0)|0;u=r+(t*48|0)+4|0;p=+f[k>>2]+(+f[u>>2]-+f[a>>2])/+f[s>>2]*+f[o>>2];f[q>>2]=+f[j>>2]+(+f[q>>2]-+f[d>>2])/+f[e>>2]*+f[m>>2];f[u>>2]=p;u=c[b>>2]|0;if((c[u+(t*48|0)+44>>2]|0)==6)v=u;else{u=r+(t*48|0)+16|0;q=r+(t*48|0)+20|0;p=+f[q>>2]/+f[s>>2]*+f[o>>2];f[u>>2]=+f[u>>2]/+f[e>>2]*+f[m>>2];f[q>>2]=p;v=c[b>>2]|0}}else v=r;t=t+1|0;if(t>>>0>(c[v+((c[i>>2]|0)*48|0)+36>>2]|0)>>>0)break;else r=v}za=h;return}function sb(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0;ub(a,b,d,e);e=c[a+168>>2]|0;d=c[a+172>>2]|0;if((e|0)==(d|0))return;f=a+16|0;g=a+24|0;a=e;do{e=c[a>>2]|0;h=c[a+4>>2]|0;if(h){i=h+4|0;c[i>>2]=(c[i>>2]|0)+1;Ja[c[(c[e>>2]|0)+4>>2]&31](e,b,f,g);i=h+4|0;j=c[i>>2]|0;c[i>>2]=j+-1;if(!j){Ga[c[(c[h>>2]|0)+8>>2]&127](h);Ug(h)}}else Ja[c[(c[e>>2]|0)+4>>2]&31](e,b,f,g);a=a+8|0}while((a|0)!=(d|0));return}function tb(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;return}function ub(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0.0,o=0.0,p=0,q=0.0,r=0,s=0.0,t=0,u=0.0,v=0.0,w=0.0;h=za;za=za+64|0;if((za|0)>=(Aa|0))y(64);i=h+48|0;j=h;k=d;l=c[k+4>>2]|0;m=a+40|0;c[m>>2]=c[k>>2];c[m+4>>2]=l;l=e;m=c[l+4>>2]|0;k=a+32|0;c[k>>2]=c[l>>2];c[k+4>>2]=m;m=c[a+4>>2]|0;k=c[b>>2]|0;b=e+4|0;n=+f[b>>2];l=k+(m*48|0)+24|0;o=+f[l>>2];p=k+(m*48|0)+28|0;q=+f[p>>2];r=k+(m*48|0)+8|0;s=+f[r>>2];t=k+(m*48|0)+12|0;u=+f[t>>2];g[j>>3]=+f[e>>2];g[j+8>>3]=n;g[j+16>>3]=o;g[j+24>>3]=q;g[j+32>>3]=s;g[j+40>>3]=u;Jg(6112,j)|0;u=+f[r>>2]*+f[e>>2]+ +f[l>>2];s=+f[t>>2]*+f[b>>2]+ +f[p>>2];g[i>>3]=u;g[i+8>>3]=s;Jg(6172,i)|0;f[a+24>>2]=u;i=a+28|0;f[i>>2]=s;p=(c[a+52>>2]|0)==1;do if(p){q=+f[a+48>>2];o=s*q;if(o<u){f[a+24>>2]=o;v=o;w=s;break}else{o=u/q;f[i>>2]=o;v=u;w=o;break}}else{v=u;w=s}while(0);s=+f[k+(m*48|0)+20>>2]+(+f[d+4>>2]+ +f[b>>2]*+f[k+(m*48|0)+4>>2]-+f[a+12>>2]*w);f[a+16>>2]=+f[k+(m*48|0)+16>>2]+(+f[d>>2]+ +f[e>>2]*+f[k+(m*48|0)>>2]-+f[a+8>>2]*v);f[a+20>>2]=s;if(!p){za=h;return}s=+f[a+48>>2];u=w*s;if(u<v){f[a+24>>2]=u;za=h;return}else{f[i>>2]=v/s;za=h;return}}function vb(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0;d=a+4|0;e=c[d>>2]|0;f=c[a>>2]|0;g=e-f>>3;h=g+1|0;i=f;j=e;if(h>>>0>536870911)eh(a);e=a+8|0;k=(c[e>>2]|0)-f|0;f=k>>2;l=k>>3>>>0<268435455?(f>>>0<h>>>0?h:f):536870911;do if(l)if(l>>>0>536870911){f=Y(8)|0;Zg(f,5983);c[f>>2]=5696;aa(f|0,3712,122)}else{m=Vg(l<<3)|0;break}else m=0;while(0);f=m+(g<<3)|0;h=m+(l<<3)|0;c[f>>2]=c[b>>2];l=c[b+4>>2]|0;c[m+(g<<3)+4>>2]=l;if(!l){n=i;o=j}else{j=l+4|0;c[j>>2]=(c[j>>2]|0)+1;n=c[a>>2]|0;o=c[d>>2]|0}j=f+8|0;l=n;if((o|0)==(n|0)){p=f;q=l;r=o}else{i=g+-1-((o+-8-l|0)>>>3)|0;l=o;o=f;do{f=o;o=o+-8|0;g=l;l=l+-8|0;c[o>>2]=c[l>>2];b=g+-4|0;c[f+-4>>2]=c[b>>2];c[l>>2]=0;c[b>>2]=0}while((l|0)!=(n|0));p=m+(i<<3)|0;q=c[a>>2]|0;r=c[d>>2]|0}c[a>>2]=p;c[d>>2]=j;c[e>>2]=h;h=q;if((r|0)!=(h|0)){e=r;do{r=c[e+-4>>2]|0;e=e+-8|0;if(r|0?(j=r+4|0,d=c[j>>2]|0,c[j>>2]=d+-1,(d|0)==0):0){Ga[c[(c[r>>2]|0)+8>>2]&127](r);Ug(r)}}while((e|0)!=(h|0))}if(!q)return;Wg(q);return}function wb(a,b){a=a|0;b=b|0;return}function xb(a){a=a|0;Tg(a);Wg(a);return}function yb(a){a=a|0;var b=0;b=c[a+12>>2]|0;if(!b)return;Hb(b);Wg(b);return}function zb(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==6340?a+12|0:0)|0}function Ab(a){a=a|0;Wg(a);return}function Bb(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;f=za;za=za+16|0;if((za|0)>=(Aa|0))y(16);g=f+8|0;h=f;i=a+24|0;j=i;k=c[j+4>>2]|0;l=g;c[l>>2]=c[j>>2];c[l+4>>2]=k;k=a+16|0;l=k;j=c[l+4>>2]|0;m=h;c[m>>2]=c[l>>2];c[m+4>>2]=j;ub(a,b,d,e);Ja[c[(c[a>>2]|0)+8>>2]&31](a,b,h,g);g=c[a+168>>2]|0;h=c[a+172>>2]|0;if((g|0)==(h|0)){za=f;return}a=g;do{g=c[a>>2]|0;e=c[a+4>>2]|0;if(e){d=e+4|0;c[d>>2]=(c[d>>2]|0)+1;Ja[c[(c[g>>2]|0)+4>>2]&31](g,b,k,i);d=e+4|0;j=c[d>>2]|0;c[d>>2]=j+-1;if(!j){Ga[c[(c[e>>2]|0)+8>>2]&127](e);Ug(e)}}else Ja[c[(c[g>>2]|0)+4>>2]&31](g,b,k,i);a=a+8|0}while((a|0)!=(h|0));za=f;return}function Cb(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0;e=c[b>>2]|0;b=a+16|0;d=c[b+4>>2]|0;f=e+(((c[e+((c[a+4>>2]|0)*48|0)+32>>2]|0)+1|0)*48|0)|0;c[f>>2]=c[b>>2];c[f+4>>2]=d;return}function Db(a){a=a|0;Tg(a);Wg(a);return}function Eb(a){a=a|0;var b=0;b=c[a+12>>2]|0;if(!b)return;Hb(b);Wg(b);return}function Fb(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==6496?a+12|0:0)|0}function Gb(a){a=a|0;Wg(a);return}function Hb(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0;c[a>>2]=3804;b=a+168|0;d=c[b>>2]|0;if(d|0){e=a+172|0;f=c[e>>2]|0;if((f|0)==(d|0))g=d;else{h=f;do{f=c[h+-4>>2]|0;h=h+-8|0;if(f|0?(i=f+4|0,j=c[i>>2]|0,c[i>>2]=j+-1,(j|0)==0):0){Ga[c[(c[f>>2]|0)+8>>2]&127](f);Ug(f)}}while((h|0)!=(d|0));g=c[b>>2]|0}c[e>>2]=d;Wg(g)}g=c[a+160>>2]|0;if((a+144|0)!=(g|0)){if(g|0)Ga[c[(c[g>>2]|0)+20>>2]&127](g)}else Ga[c[(c[g>>2]|0)+16>>2]&127](g);g=c[a+136>>2]|0;if((a+120|0)!=(g|0)){if(g|0)Ga[c[(c[g>>2]|0)+20>>2]&127](g)}else Ga[c[(c[g>>2]|0)+16>>2]&127](g);g=c[a+112>>2]|0;if((a+96|0)!=(g|0)){if(g|0)Ga[c[(c[g>>2]|0)+20>>2]&127](g)}else Ga[c[(c[g>>2]|0)+16>>2]&127](g);g=c[a+80>>2]|0;if((a+64|0)==(g|0)){Ga[c[(c[g>>2]|0)+16>>2]&127](g);return}if(!g)return;Ga[c[(c[g>>2]|0)+20>>2]&127](g);return}function Ib(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0.0,v=0,w=0.0,x=0,z=0,A=0,B=0;e=za;za=za+48|0;if((za|0)>=(Aa|0))y(48);g=e;Nb(a,b);c[a>>2]=3900;h=d;i=c[h>>2]|0;j=c[h+4>>2]|0;h=a+180|0;c[h>>2]=i;c[h+4>>2]=j;j=c[d+4>>2]|0;if((i|0)>0){d=g+8|0;h=g+44|0;k=g+4|0;l=g+16|0;m=g+20|0;n=g+24|0;o=g+28|0;p=g+32|0;q=g+36|0;r=b+4|0;s=b+8|0;if((j|0)>0){t=0;do{u=+(t|0)*10.0;v=0;do{w=+(v|0)*10.0;x=d;z=x+36|0;do{c[x>>2]=0;x=x+4|0}while((x|0)<(z|0));c[h>>2]=5;f[g>>2]=u;f[k>>2]=w;c[l>>2]=1090519040;c[m>>2]=1090519040;f[n>>2]=3.0;f[o>>2]=1.0;c[p>>2]=-1;c[q>>2]=1442822912;A=c[r>>2]|0;if(A>>>0<(c[s>>2]|0)>>>0){x=A;A=g;z=x+48|0;do{c[x>>2]=c[A>>2];x=x+4|0;A=A+4|0}while((x|0)<(z|0));c[r>>2]=(c[r>>2]|0)+48}else fb(b,g);v=v+1|0}while((v|0)<(j|0));t=t+1|0}while((t|0)<(i|0));B=r}else B=r}else B=b+4|0;r=c[b>>2]|0;c[r+((c[a+4>>2]|0)*48|0)+36>>2]=(((c[B>>2]|0)-r|0)/48|0)+-1;u=+(i|0);w=+(j|0);f[a+24>>2]=u*10.0;f[a+28>>2]=w*10.0;f[a+48>>2]=u/w;za=e;return}function Jb(a){a=a|0;Tg(a);Wg(a);return}function Kb(a){a=a|0;var b=0;b=c[a+12>>2]|0;if(!b)return;Hb(b);Wg(b);return}function Lb(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==6641?a+12|0:0)|0}function Mb(a){a=a|0;Wg(a);return}function Nb(d,e){d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0;f=za;za=za+48|0;if((za|0)>=(Aa|0))y(48);g=f;c[d>>2]=3804;h=d+4|0;i=e+4|0;j=c[i>>2]|0;k=(j-(c[e>>2]|0)|0)/48|0;l=d+8|0;c[d+80>>2]=0;a[d+88>>0]=0;a[d+89>>0]=0;c[d+112>>2]=0;c[d+136>>2]=0;c[d+160>>2]=0;c[d+168>>2]=0;c[d+172>>2]=0;c[d+176>>2]=0;d=l;m=d+48|0;do{c[d>>2]=0;d=d+4|0}while((d|0)<(m|0));b[l+48>>1]=0;c[h>>2]=k;d=g;m=d+40|0;do{c[d>>2]=0;d=d+4|0}while((d|0)<(m|0));c[g+44>>2]=1;c[g+32>>2]=k;c[g+40>>2]=1;if((c[e+8>>2]|0)>>>0>j>>>0){d=j;j=g;m=d+48|0;do{c[d>>2]=c[j>>2];d=d+4|0;j=j+4|0}while((d|0)<(m|0));j=(c[i>>2]|0)+48|0;c[i>>2]=j;n=j;o=c[e>>2]|0;p=n-o|0;q=(p|0)/48|0;r=q+-1|0;s=c[h>>2]|0;t=o;u=t+(s*48|0)+36|0;c[u>>2]=r;za=f;return}else{fb(e,g);n=c[i>>2]|0;o=c[e>>2]|0;p=n-o|0;q=(p|0)/48|0;r=q+-1|0;s=c[h>>2]|0;t=o;u=t+(s*48|0)+36|0;c[u>>2]=r;za=f;return}}function Ob(a){a=a|0;Tg(a);Wg(a);return}function Pb(a){a=a|0;var b=0;b=c[a+12>>2]|0;if(!b)return;Hb(b);Wg(b);return}function Qb(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==6768?a+12|0:0)|0}function Rb(a){a=a|0;Wg(a);return}function Sb(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0;d=za;za=za+16|0;if((za|0)>=(Aa|0))y(16);e=d;if((b|0)==(a|0)){za=d;return}f=a+16|0;g=c[f>>2]|0;h=g;i=b+16|0;if((g|0)==(a|0))if((c[i>>2]|0)==(b|0)){Ha[c[(c[g>>2]|0)+12>>2]&31](g,e);j=c[f>>2]|0;Ga[c[(c[j>>2]|0)+16>>2]&127](j);c[f>>2]=0;j=c[i>>2]|0;Ha[c[(c[j>>2]|0)+12>>2]&31](j,a);j=c[i>>2]|0;Ga[c[(c[j>>2]|0)+16>>2]&127](j);c[i>>2]=0;c[f>>2]=a;Ha[c[(c[e>>2]|0)+12>>2]&31](e,b);Ga[c[(c[e>>2]|0)+16>>2]&127](e);c[i>>2]=b;za=d;return}else{Ha[c[(c[g>>2]|0)+12>>2]&31](g,b);g=c[f>>2]|0;Ga[c[(c[g>>2]|0)+16>>2]&127](g);g=b+16|0;c[f>>2]=c[g>>2];c[g>>2]=b;za=d;return}else{g=c[i>>2]|0;if((b|0)==(g|0)){Ha[c[(c[g>>2]|0)+12>>2]&31](g,a);b=c[i>>2]|0;Ga[c[(c[b>>2]|0)+16>>2]&127](b);c[i>>2]=c[f>>2];c[f>>2]=a;za=d;return}else{c[f>>2]=g;c[i>>2]=h;za=d;return}}}function Tb(a){a=a|0;Wg(a);return}function Ub(a){a=a|0;a=Vg(8)|0;c[a>>2]=3976;return a|0}function Vb(a,b){a=a|0;b=b|0;c[b>>2]=3976;return}function Wb(a){a=a|0;return}function Xb(a){a=a|0;Wg(a);return}function Yb(a,b){a=a|0;b=b|0;f[b+4>>2]=0.0;return}function Zb(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==6937?a+4|0:0)|0}function _b(a){a=a|0;return 2944}function $b(a){a=a|0;return}function ac(a){a=a|0;Wg(a);return}function bc(a){a=a|0;a=Vg(8)|0;c[a>>2]=4020;return a|0}function cc(a,b){a=a|0;b=b|0;c[b>>2]=4020;return}function dc(a){a=a|0;return}function ec(a){a=a|0;Wg(a);return}function fc(a,b){a=a|0;b=b|0;f[b>>2]=0.0;return}function gc(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==7064?a+4|0:0)|0}function hc(a){a=a|0;return 2968}function ic(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;f=za;za=za+16|0;if((za|0)>=(Aa|0))y(16);g=f+8|0;h=f;i=a+24|0;j=i;k=c[j+4>>2]|0;l=g;c[l>>2]=c[j>>2];c[l+4>>2]=k;k=a+16|0;l=k;j=c[l+4>>2]|0;m=h;c[m>>2]=c[l>>2];c[m+4>>2]=j;ub(a,b,d,e);Ja[c[(c[a>>2]|0)+8>>2]&31](a,b,h,g);g=c[a+168>>2]|0;h=c[a+172>>2]|0;if((g|0)==(h|0)){za=f;return}a=g;do{g=c[a>>2]|0;e=c[a+4>>2]|0;if(e){d=e+4|0;c[d>>2]=(c[d>>2]|0)+1;Ja[c[(c[g>>2]|0)+4>>2]&31](g,b,k,i);d=e+4|0;j=c[d>>2]|0;c[d>>2]=j+-1;if(!j){Ga[c[(c[e>>2]|0)+8>>2]&127](e);Ug(e)}}else Ja[c[(c[g>>2]|0)+4>>2]&31](g,b,k,i);a=a+8|0}while((a|0)!=(h|0));za=f;return}function jc(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var h=0,i=0,j=0,k=0,l=0,m=0.0;e=za;za=za+16|0;if((za|0)>=(Aa|0))y(16);d=e;h=c[b>>2]|0;b=(c[h+((c[a+4>>2]|0)*48|0)+32>>2]|0)+1|0;i=a+16|0;j=i;k=c[j+4>>2]|0;l=h+(b*48|0)|0;c[l>>2]=c[j>>2];c[l+4>>2]=k;m=+f[a+28>>2]*.5;f[h+(b*48|0)+16>>2]=+f[a+24>>2]*.5;f[h+(b*48|0)+20>>2]=m;m=+f[a+20>>2];g[d>>3]=+f[i>>2];g[d+8>>3]=m;Jg(7125,d)|0;za=e;return}function kc(a,b){a=a|0;b=b|0;return}function lc(a){a=a|0;Tg(a);Wg(a);return}function mc(a){a=a|0;var b=0;b=c[a+12>>2]|0;if(!b)return;Hb(b);Wg(b);return}function nc(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==7280?a+12|0:0)|0}function oc(a){a=a|0;Wg(a);return}function pc(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;f=za;za=za+16|0;if((za|0)>=(Aa|0))y(16);g=f+8|0;h=f;i=a+24|0;j=i;k=c[j+4>>2]|0;l=g;c[l>>2]=c[j>>2];c[l+4>>2]=k;k=a+16|0;l=k;j=c[l+4>>2]|0;m=h;c[m>>2]=c[l>>2];c[m+4>>2]=j;ub(a,b,d,e);Ja[c[(c[a>>2]|0)+8>>2]&31](a,b,h,g);g=c[a+168>>2]|0;h=c[a+172>>2]|0;if((g|0)==(h|0)){za=f;return}a=g;do{g=c[a>>2]|0;e=c[a+4>>2]|0;if(e){d=e+4|0;c[d>>2]=(c[d>>2]|0)+1;Ja[c[(c[g>>2]|0)+4>>2]&31](g,b,k,i);d=e+4|0;j=c[d>>2]|0;c[d>>2]=j+-1;if(!j){Ga[c[(c[e>>2]|0)+8>>2]&127](e);Ug(e)}}else Ja[c[(c[g>>2]|0)+4>>2]&31](g,b,k,i);a=a+8|0}while((a|0)!=(h|0));za=f;return}function qc(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var h=0,i=0.0,j=0.0,k=0.0,l=0,m=0,n=0,o=0;e=za;za=za+48|0;if((za|0)>=(Aa|0))y(48);d=e+32|0;h=e;i=+f[a+44>>2];j=+f[a+32>>2];k=+f[a+36>>2];g[h>>3]=+f[a+40>>2];g[h+8>>3]=i;g[h+16>>3]=j;g[h+24>>3]=k;Jg(7352,h)|0;h=c[b>>2]|0;b=(c[h+((c[a+4>>2]|0)*48|0)+32>>2]|0)+1|0;l=a+16|0;m=l;n=c[m+4>>2]|0;o=h+(b*48|0)|0;c[o>>2]=c[m>>2];c[o+4>>2]=n;k=+f[a+28>>2]*.5;f[h+(b*48|0)+16>>2]=+f[a+24>>2]*.5;f[h+(b*48|0)+20>>2]=k;k=+f[a+20>>2];g[d>>3]=+f[l>>2];g[d+8>>3]=k;Jg(7409,d)|0;za=e;return}function rc(a,b){a=a|0;b=b|0;return}function sc(a){a=a|0;Tg(a);Wg(a);return}function tc(a){a=a|0;var b=0;b=c[a+12>>2]|0;if(!b)return;Hb(b);Wg(b);return}function uc(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==7560?a+12|0:0)|0}function vc(a){a=a|0;Wg(a);return}function wc(a){a=a|0;Wg(a);return}function xc(a){a=a|0;a=Vg(8)|0;c[a>>2]=4160;return a|0}function yc(a,b){a=a|0;b=b|0;c[b>>2]=4160;return}function zc(a){a=a|0;return}function Ac(a){a=a|0;Wg(a);return}function Bc(a,b){a=a|0;b=b|0;var c=0,d=0.0,e=0,h=0.0,i=0.0,j=0.0;a=za;za=za+16|0;if((za|0)>=(Aa|0))y(16);c=a;d=+f[b>>2];e=b+4|0;h=+f[e>>2];i=+r(+(d*d+h*h));j=d*150.0/i;f[b>>2]=j;d=h*150.0/i;f[e>>2]=d;g[c>>3]=j;g[c+8>>3]=d;Jg(7699,c)|0;za=a;return}function Cc(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==7732?a+4|0:0)|0}function Dc(a){a=a|0;return 3056}function Ec(b,d,e,f){b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0;g=za;za=za+32|0;if((za|0)>=(Aa|0))y(32);h=g;i=b+96|0;j=c[d+16>>2]|0;do if(j)if((d|0)==(j|0)){k=h+16|0;c[k>>2]=h;Ha[c[(c[j>>2]|0)+12>>2]&31](j,h);l=k;break}else{k=h+16|0;c[k>>2]=Ca[c[(c[j>>2]|0)+8>>2]&63](j)|0;l=k;break}else{k=h+16|0;c[k>>2]=0;l=k}while(0);Gc(h,i);i=c[l>>2]|0;if((h|0)!=(i|0)){if(i|0)Ga[c[(c[i>>2]|0)+20>>2]&127](i)}else Ga[c[(c[i>>2]|0)+16>>2]&127](i);i=b+120|0;l=c[e+16>>2]|0;do if(l)if((e|0)==(l|0)){j=h+16|0;c[j>>2]=h;Ha[c[(c[l>>2]|0)+12>>2]&31](l,h);m=j;break}else{j=h+16|0;c[j>>2]=Ca[c[(c[l>>2]|0)+8>>2]&63](l)|0;m=j;break}else{j=h+16|0;c[j>>2]=0;m=j}while(0);Gc(h,i);i=c[m>>2]|0;if((h|0)!=(i|0)){if(i|0)Ga[c[(c[i>>2]|0)+20>>2]&127](i)}else Ga[c[(c[i>>2]|0)+16>>2]&127](i);i=b+144|0;m=c[f+16>>2]|0;do if(m)if((f|0)==(m|0)){l=h+16|0;c[l>>2]=h;Ha[c[(c[m>>2]|0)+12>>2]&31](m,h);n=l;break}else{l=h+16|0;c[l>>2]=Ca[c[(c[m>>2]|0)+8>>2]&63](m)|0;n=l;break}else{l=h+16|0;c[l>>2]=0;n=l}while(0);Hc(h,i);i=c[n>>2]|0;if((h|0)==(i|0)){Ga[c[(c[i>>2]|0)+16>>2]&127](i);o=b+88|0;a[o>>0]=1;za=g;return}if(!i){o=b+88|0;a[o>>0]=1;za=g;return}Ga[c[(c[i>>2]|0)+20>>2]&127](i);o=b+88|0;a[o>>0]=1;za=g;return}function Fc(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0;e=za;za=za+208|0;if((za|0)>=(Aa|0))y(208);g=e+120|0;h=e+72|0;i=e+152|0;j=e+144|0;k=e+48|0;l=e+24|0;m=e;n=e+136|0;o=e+128|0;Nb(a,b);c[a>>2]=4516;p=a+184|0;q=d+16|0;r=c[q>>2]|0;do if(r)if((d|0)==(r|0)){c[a+200>>2]=p;s=c[q>>2]|0;Ha[c[(c[s>>2]|0)+12>>2]&31](s,p);break}else{c[a+200>>2]=Ca[c[(c[r>>2]|0)+8>>2]&63](r)|0;break}else c[a+200>>2]=0;while(0);r=Vg(184)|0;Nb(r,b);c[r>>2]=4336;p=i+8|0;q=p+36|0;do{c[p>>2]=0;p=p+4|0}while((p|0)<(q|0));c[i+44>>2]=5;c[i>>2]=0;c[i+4>>2]=0;c[i+16>>2]=0;c[i+20>>2]=0;f[i+24>>2]=10.0;f[i+28>>2]=2.0;c[i+32>>2]=-1431655681;c[i+36>>2]=-1;d=b+4|0;s=c[d>>2]|0;t=c[b>>2]|0;c[t+((c[r+4>>2]|0)*48|0)+36>>2]=(s-t|0)/48|0;t=b+8|0;if((c[t>>2]|0)==(s|0))lb(b,i);else{p=s;u=i;q=p+48|0;do{c[p>>2]=c[u>>2];p=p+4|0;u=u+4|0}while((p|0)<(q|0));c[d>>2]=(c[d>>2]|0)+48}c[j>>2]=r;s=Vg(16)|0;c[s+4>>2]=0;c[s+8>>2]=0;c[s>>2]=4356;c[s+12>>2]=r;v=j+4|0;c[v>>2]=s;c[h>>2]=r;c[h+4>>2]=r;ld(j,h);r=c[(c[j>>2]|0)+4>>2]|0;s=c[b>>2]|0;c[s+(r*48|0)>>2]=0;c[s+(r*48|0)+4>>2]=0;r=c[(c[j>>2]|0)+4>>2]|0;s=c[b>>2]|0;c[s+(r*48|0)+8>>2]=1065353216;c[s+(r*48|0)+12>>2]=1065353216;r=Vg(184)|0;Nb(r,b);c[r>>2]=4336;p=h+8|0;q=p+36|0;do{c[p>>2]=0;p=p+4|0}while((p|0)<(q|0));c[h+44>>2]=5;c[h>>2]=0;c[h+4>>2]=0;c[h+16>>2]=0;c[h+20>>2]=0;f[h+24>>2]=10.0;f[h+28>>2]=2.0;c[h+32>>2]=-1431655681;c[h+36>>2]=-1;s=c[d>>2]|0;w=c[b>>2]|0;c[w+((c[r+4>>2]|0)*48|0)+36>>2]=(s-w|0)/48|0;if((c[t>>2]|0)==(s|0))lb(b,h);else{p=s;u=h;q=p+48|0;do{c[p>>2]=c[u>>2];p=p+4|0;u=u+4|0}while((p|0)<(q|0));c[d>>2]=(c[d>>2]|0)+48}c[i>>2]=r;d=Vg(16)|0;c[d+4>>2]=0;c[d+8>>2]=0;c[d>>2]=4356;c[d+12>>2]=r;u=i+4|0;c[u>>2]=d;c[g>>2]=r;c[g+4>>2]=r;ld(i,g);g=c[(c[i>>2]|0)+4>>2]|0;r=c[b>>2]|0;c[r+(g*48|0)>>2]=0;c[r+(g*48|0)+4>>2]=0;g=c[i>>2]|0;r=g+4|0;d=c[r>>2]|0;p=c[b>>2]|0;c[p+(d*48|0)+8>>2]=1065353216;c[p+(d*48|0)+12>>2]=1065353216;d=c[r>>2]|0;r=c[b>>2]|0;c[r+(d*48|0)+16>>2]=1084227584;c[r+(d*48|0)+20>>2]=1084227584;d=b;r=g;g=c[u>>2]|0;if(!g)x=0;else{p=g+4|0;c[p>>2]=(c[p>>2]|0)+1;x=c[u>>2]|0}p=k+16|0;c[k>>2]=4536;c[k+4>>2]=d;c[k+8>>2]=r;c[k+12>>2]=g;c[p>>2]=k;if(x|0){g=x+4|0;c[g>>2]=(c[g>>2]|0)+1}g=l+16|0;c[l>>2]=4580;c[l+4>>2]=d;c[l+8>>2]=r;c[l+12>>2]=x;c[g>>2]=l;x=m+16|0;c[m>>2]=4624;c[m+4>>2]=a;c[x>>2]=m;Ec(a,k,l,m);r=c[x>>2]|0;if((m|0)!=(r|0)){if(r|0)Ga[c[(c[r>>2]|0)+20>>2]&127](r)}else Ga[c[(c[r>>2]|0)+16>>2]&127](r);r=c[g>>2]|0;if((l|0)!=(r|0)){if(r|0)Ga[c[(c[r>>2]|0)+20>>2]&127](r)}else Ga[c[(c[r>>2]|0)+16>>2]&127](r);r=c[p>>2]|0;if((k|0)!=(r|0)){if(r|0)Ga[c[(c[r>>2]|0)+20>>2]&127](r)}else Ga[c[(c[r>>2]|0)+16>>2]&127](r);r=c[c[a>>2]>>2]|0;c[n>>2]=c[j>>2];j=n+4|0;k=c[v>>2]|0;c[j>>2]=k;if(k|0){p=k+4|0;c[p>>2]=(c[p>>2]|0)+1}Ia[r&3](a,b,n);n=c[j>>2]|0;if(n|0?(j=n+4|0,r=c[j>>2]|0,c[j>>2]=r+-1,(r|0)==0):0){Ga[c[(c[n>>2]|0)+8>>2]&127](n);Ug(n)}n=c[c[a>>2]>>2]|0;c[o>>2]=c[i>>2];i=o+4|0;r=c[u>>2]|0;c[i>>2]=r;if(r|0){j=r+4|0;c[j>>2]=(c[j>>2]|0)+1}Ia[n&3](a,b,o);o=c[i>>2]|0;if(o|0?(i=o+4|0,b=c[i>>2]|0,c[i>>2]=b+-1,(b|0)==0):0){Ga[c[(c[o>>2]|0)+8>>2]&127](o);Ug(o)}o=c[u>>2]|0;if(o|0?(u=o+4|0,b=c[u>>2]|0,c[u>>2]=b+-1,(b|0)==0):0){Ga[c[(c[o>>2]|0)+8>>2]&127](o);Ug(o)}o=c[v>>2]|0;if(!o){za=e;return}v=o+4|0;b=c[v>>2]|0;c[v>>2]=b+-1;if(b|0){za=e;return}Ga[c[(c[o>>2]|0)+8>>2]&127](o);Ug(o);za=e;return}function Gc(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0;d=za;za=za+16|0;if((za|0)>=(Aa|0))y(16);e=d;if((b|0)==(a|0)){za=d;return}f=a+16|0;g=c[f>>2]|0;h=g;i=b+16|0;if((g|0)==(a|0))if((c[i>>2]|0)==(b|0)){Ha[c[(c[g>>2]|0)+12>>2]&31](g,e);j=c[f>>2]|0;Ga[c[(c[j>>2]|0)+16>>2]&127](j);c[f>>2]=0;j=c[i>>2]|0;Ha[c[(c[j>>2]|0)+12>>2]&31](j,a);j=c[i>>2]|0;Ga[c[(c[j>>2]|0)+16>>2]&127](j);c[i>>2]=0;c[f>>2]=a;Ha[c[(c[e>>2]|0)+12>>2]&31](e,b);Ga[c[(c[e>>2]|0)+16>>2]&127](e);c[i>>2]=b;za=d;return}else{Ha[c[(c[g>>2]|0)+12>>2]&31](g,b);g=c[f>>2]|0;Ga[c[(c[g>>2]|0)+16>>2]&127](g);g=b+16|0;c[f>>2]=c[g>>2];c[g>>2]=b;za=d;return}else{g=c[i>>2]|0;if((b|0)==(g|0)){Ha[c[(c[g>>2]|0)+12>>2]&31](g,a);b=c[i>>2]|0;Ga[c[(c[b>>2]|0)+16>>2]&127](b);c[i>>2]=c[f>>2];c[f>>2]=a;za=d;return}else{c[f>>2]=g;c[i>>2]=h;za=d;return}}}function Hc(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0;d=za;za=za+16|0;if((za|0)>=(Aa|0))y(16);e=d;if((b|0)==(a|0)){za=d;return}f=a+16|0;g=c[f>>2]|0;h=g;i=b+16|0;if((g|0)==(a|0))if((c[i>>2]|0)==(b|0)){Ha[c[(c[g>>2]|0)+12>>2]&31](g,e);j=c[f>>2]|0;Ga[c[(c[j>>2]|0)+16>>2]&127](j);c[f>>2]=0;j=c[i>>2]|0;Ha[c[(c[j>>2]|0)+12>>2]&31](j,a);j=c[i>>2]|0;Ga[c[(c[j>>2]|0)+16>>2]&127](j);c[i>>2]=0;c[f>>2]=a;Ha[c[(c[e>>2]|0)+12>>2]&31](e,b);Ga[c[(c[e>>2]|0)+16>>2]&127](e);c[i>>2]=b;za=d;return}else{Ha[c[(c[g>>2]|0)+12>>2]&31](g,b);g=c[f>>2]|0;Ga[c[(c[g>>2]|0)+16>>2]&127](g);g=b+16|0;c[f>>2]=c[g>>2];c[g>>2]=b;za=d;return}else{g=c[i>>2]|0;if((b|0)==(g|0)){Ha[c[(c[g>>2]|0)+12>>2]&31](g,a);b=c[i>>2]|0;Ga[c[(c[b>>2]|0)+16>>2]&127](b);c[i>>2]=c[f>>2];c[f>>2]=a;za=d;return}else{c[f>>2]=g;c[i>>2]=h;za=d;return}}}function Ic(a){a=a|0;var b=0,d=0;c[a>>2]=4204;b=c[a+12>>2]|0;if(!b)return;a=b+4|0;d=c[a>>2]|0;c[a>>2]=d+-1;if(d|0)return;Ga[c[(c[b>>2]|0)+8>>2]&127](b);Ug(b);return}function Jc(a){a=a|0;var b=0,d=0,e=0;c[a>>2]=4204;b=c[a+12>>2]|0;if(!b){Wg(a);return}d=b+4|0;e=c[d>>2]|0;c[d>>2]=e+-1;if(e|0){Wg(a);return}Ga[c[(c[b>>2]|0)+8>>2]&127](b);Ug(b);Wg(a);return}function Kc(a){a=a|0;var b=0,d=0;b=Vg(16)|0;c[b>>2]=4204;c[b+4>>2]=c[a+4>>2];c[b+8>>2]=c[a+8>>2];d=c[a+12>>2]|0;c[b+12>>2]=d;if(!d)return b|0;a=d+4|0;c[a>>2]=(c[a>>2]|0)+1;return b|0}function Lc(a,b){a=a|0;b=b|0;var d=0;c[b>>2]=4204;c[b+4>>2]=c[a+4>>2];c[b+8>>2]=c[a+8>>2];d=c[a+12>>2]|0;c[b+12>>2]=d;if(!d)return;b=d+4|0;c[b>>2]=(c[b>>2]|0)+1;return}function Mc(a){a=a|0;var b=0,d=0;b=c[a+12>>2]|0;if(!b)return;a=b+4|0;d=c[a>>2]|0;c[a>>2]=d+-1;if(d|0)return;Ga[c[(c[b>>2]|0)+8>>2]&127](b);Ug(b);return}function Nc(a){a=a|0;var b=0,d=0,e=0;b=c[a+12>>2]|0;if(!b){Wg(a);return}d=b+4|0;e=c[d>>2]|0;c[d>>2]=e+-1;if(e|0){Wg(a);return}Ga[c[(c[b>>2]|0)+8>>2]&127](b);Ug(b);Wg(a);return}function Oc(a){a=a|0;var b=0,d=0,e=0,g=0;b=c[a+4>>2]|0;Lg(11435)|0;d=a+8|0;a=(c[d>>2]|0)+4|0;e=c[a>>2]|0;g=c[b>>2]|0;f[g+(e*48|0)+8>>2]=0.0;f[g+(e*48|0)+12>>2]=0.0;e=c[a>>2]|0;a=c[b>>2]|0;f[a+(e*48|0)+24>>2]=150.0;f[a+(e*48|0)+28>>2]=150.0;e=c[d>>2]|0;Ja[c[(c[e>>2]|0)+4>>2]&31](e,b,e+40|0,e+32|0);return}function Pc(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==7883?a+4|0:0)|0}function Qc(a){a=a|0;return 3088}function Rc(a){a=a|0;return}function Sc(a){a=a|0;var b=0,d=0;c[a>>2]=4248;b=c[a+12>>2]|0;if(!b)return;a=b+4|0;d=c[a>>2]|0;c[a>>2]=d+-1;if(d|0)return;Ga[c[(c[b>>2]|0)+8>>2]&127](b);Ug(b);return}function Tc(a){a=a|0;var b=0,d=0,e=0;c[a>>2]=4248;b=c[a+12>>2]|0;if(!b){Wg(a);return}d=b+4|0;e=c[d>>2]|0;c[d>>2]=e+-1;if(e|0){Wg(a);return}Ga[c[(c[b>>2]|0)+8>>2]&127](b);Ug(b);Wg(a);return}function Uc(a){a=a|0;var b=0,d=0;b=Vg(16)|0;c[b>>2]=4248;c[b+4>>2]=c[a+4>>2];c[b+8>>2]=c[a+8>>2];d=c[a+12>>2]|0;c[b+12>>2]=d;if(!d)return b|0;a=d+4|0;c[a>>2]=(c[a>>2]|0)+1;return b|0}function Vc(a,b){a=a|0;b=b|0;var d=0;c[b>>2]=4248;c[b+4>>2]=c[a+4>>2];c[b+8>>2]=c[a+8>>2];d=c[a+12>>2]|0;c[b+12>>2]=d;if(!d)return;b=d+4|0;c[b>>2]=(c[b>>2]|0)+1;return}function Wc(a){a=a|0;var b=0,d=0;b=c[a+12>>2]|0;if(!b)return;a=b+4|0;d=c[a>>2]|0;c[a>>2]=d+-1;if(d|0)return;Ga[c[(c[b>>2]|0)+8>>2]&127](b);Ug(b);return}function Xc(a){a=a|0;var b=0,d=0,e=0;b=c[a+12>>2]|0;if(!b){Wg(a);return}d=b+4|0;e=c[d>>2]|0;c[d>>2]=e+-1;if(e|0){Wg(a);return}Ga[c[(c[b>>2]|0)+8>>2]&127](b);Ug(b);Wg(a);return}function Yc(a){a=a|0;var b=0,d=0,e=0,g=0;b=c[a+4>>2]|0;Lg(11446)|0;d=a+8|0;a=(c[d>>2]|0)+4|0;e=c[a>>2]|0;g=c[b>>2]|0;f[g+(e*48|0)+8>>2]=0.0;f[g+(e*48|0)+12>>2]=0.0;e=c[a>>2]|0;a=c[b>>2]|0;f[a+(e*48|0)+24>>2]=100.0;f[a+(e*48|0)+28>>2]=100.0;e=c[d>>2]|0;Ja[c[(c[e>>2]|0)+4>>2]&31](e,b,e+40|0,e+32|0);return}function Zc(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==7992?a+4|0:0)|0}function _c(a){a=a|0;return 3112}function $c(a){a=a|0;var b=0,d=0;c[a>>2]=4292;b=c[a+12>>2]|0;if(!b)return;a=b+4|0;d=c[a>>2]|0;c[a>>2]=d+-1;if(d|0)return;Ga[c[(c[b>>2]|0)+8>>2]&127](b);Ug(b);return}function ad(a){a=a|0;var b=0,d=0,e=0;c[a>>2]=4292;b=c[a+12>>2]|0;if(!b){Wg(a);return}d=b+4|0;e=c[d>>2]|0;c[d>>2]=e+-1;if(e|0){Wg(a);return}Ga[c[(c[b>>2]|0)+8>>2]&127](b);Ug(b);Wg(a);return}function bd(a){a=a|0;var b=0,d=0;b=Vg(16)|0;c[b>>2]=4292;c[b+4>>2]=c[a+4>>2];c[b+8>>2]=c[a+8>>2];d=c[a+12>>2]|0;c[b+12>>2]=d;if(!d)return b|0;a=d+4|0;c[a>>2]=(c[a>>2]|0)+1;return b|0}function cd(a,b){a=a|0;b=b|0;var d=0;c[b>>2]=4292;c[b+4>>2]=c[a+4>>2];c[b+8>>2]=c[a+8>>2];d=c[a+12>>2]|0;c[b+12>>2]=d;if(!d)return;b=d+4|0;c[b>>2]=(c[b>>2]|0)+1;return}function dd(a){a=a|0;var b=0,d=0;b=c[a+12>>2]|0;if(!b)return;a=b+4|0;d=c[a>>2]|0;c[a>>2]=d+-1;if(d|0)return;Ga[c[(c[b>>2]|0)+8>>2]&127](b);Ug(b);return}function ed(a){a=a|0;var b=0,d=0,e=0;b=c[a+12>>2]|0;if(!b){Wg(a);return}d=b+4|0;e=c[d>>2]|0;c[d>>2]=e+-1;if(e|0){Wg(a);return}Ga[c[(c[b>>2]|0)+8>>2]&127](b);Ug(b);Wg(a);return}function fd(a,b){a=a|0;b=b|0;var d=0;b=c[a+4>>2]|0;Lg(11428)|0;d=c[a+8>>2]|0;a=c[b>>2]|0;c[a+(((c[a+((c[d+4>>2]|0)*48|0)+32>>2]|0)+1|0)*48|0)+32>>2]=696469503;Ja[c[(c[d>>2]|0)+4>>2]&31](d,b,d+40|0,d+32|0);return}function gd(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==8155?a+4|0:0)|0}function hd(a){a=a|0;return 3144}function id(a){a=a|0;return}function jd(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;f=za;za=za+16|0;if((za|0)>=(Aa|0))y(16);g=f+8|0;h=f;i=a+24|0;j=i;k=c[j+4>>2]|0;l=g;c[l>>2]=c[j>>2];c[l+4>>2]=k;k=a+16|0;l=k;j=c[l+4>>2]|0;m=h;c[m>>2]=c[l>>2];c[m+4>>2]=j;ub(a,b,d,e);Ja[c[(c[a>>2]|0)+8>>2]&31](a,b,h,g);g=c[a+168>>2]|0;h=c[a+172>>2]|0;if((g|0)==(h|0)){za=f;return}a=g;do{g=c[a>>2]|0;e=c[a+4>>2]|0;if(e){d=e+4|0;c[d>>2]=(c[d>>2]|0)+1;Ja[c[(c[g>>2]|0)+4>>2]&31](g,b,k,i);d=e+4|0;j=c[d>>2]|0;c[d>>2]=j+-1;if(!j){Ga[c[(c[e>>2]|0)+8>>2]&127](e);Ug(e)}}else Ja[c[(c[g>>2]|0)+4>>2]&31](g,b,k,i);a=a+8|0}while((a|0)!=(h|0));za=f;return}function kd(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0;e=c[b>>2]|0;b=(c[e+((c[a+4>>2]|0)*48|0)+32>>2]|0)+1|0;d=a+16|0;f=c[d+4>>2]|0;g=e+(b*48|0)|0;c[g>>2]=c[d>>2];c[g+4>>2]=f;f=a+24|0;a=c[f+4>>2]|0;g=e+(b*48|0)+16|0;c[g>>2]=c[f>>2];c[g+4>>2]=a;return}function ld(a,b){a=a|0;b=b|0;return}function md(a){a=a|0;Tg(a);Wg(a);return}function nd(a){a=a|0;var b=0;b=c[a+12>>2]|0;if(!b)return;Hb(b);Wg(b);return}function od(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==8325?a+12|0:0)|0}function pd(a){a=a|0;Wg(a);return}function qd(a){a=a|0;var b=0,d=0;c[a>>2]=4384;b=c[a+12>>2]|0;if(!b)return;a=b+4|0;d=c[a>>2]|0;c[a>>2]=d+-1;if(d|0)return;Ga[c[(c[b>>2]|0)+8>>2]&127](b);Ug(b);return}function rd(a){a=a|0;var b=0,d=0,e=0;c[a>>2]=4384;b=c[a+12>>2]|0;if(!b){Wg(a);return}d=b+4|0;e=c[d>>2]|0;c[d>>2]=e+-1;if(e|0){Wg(a);return}Ga[c[(c[b>>2]|0)+8>>2]&127](b);Ug(b);Wg(a);return}function sd(a){a=a|0;var b=0,d=0;b=Vg(16)|0;c[b>>2]=4384;c[b+4>>2]=c[a+4>>2];c[b+8>>2]=c[a+8>>2];d=c[a+12>>2]|0;c[b+12>>2]=d;if(!d)return b|0;a=d+4|0;c[a>>2]=(c[a>>2]|0)+1;return b|0}function td(a,b){a=a|0;b=b|0;var d=0;c[b>>2]=4384;c[b+4>>2]=c[a+4>>2];c[b+8>>2]=c[a+8>>2];d=c[a+12>>2]|0;c[b+12>>2]=d;if(!d)return;b=d+4|0;c[b>>2]=(c[b>>2]|0)+1;return}function ud(a){a=a|0;var b=0,d=0;b=c[a+12>>2]|0;if(!b)return;a=b+4|0;d=c[a>>2]|0;c[a>>2]=d+-1;if(d|0)return;Ga[c[(c[b>>2]|0)+8>>2]&127](b);Ug(b);return}function vd(a){a=a|0;var b=0,d=0,e=0;b=c[a+12>>2]|0;if(!b){Wg(a);return}d=b+4|0;e=c[d>>2]|0;c[d>>2]=e+-1;if(e|0){Wg(a);return}Ga[c[(c[b>>2]|0)+8>>2]&127](b);Ug(b);Wg(a);return}function wd(a){a=a|0;var b=0,d=0,e=0;b=c[a+4>>2]|0;Lg(11435)|0;d=a+8|0;a=c[(c[d>>2]|0)+4>>2]|0;e=c[b>>2]|0;c[e+(a*48|0)+24>>2]=1132068864;c[e+(a*48|0)+28>>2]=1117782016;a=c[d>>2]|0;Ja[c[(c[a>>2]|0)+4>>2]&31](a,b,a+40|0,a+32|0);return}function xd(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==8460?a+4|0:0)|0}function yd(a){a=a|0;return 3200}function zd(a){a=a|0;var b=0,d=0;c[a>>2]=4428;b=c[a+12>>2]|0;if(!b)return;a=b+4|0;d=c[a>>2]|0;c[a>>2]=d+-1;if(d|0)return;Ga[c[(c[b>>2]|0)+8>>2]&127](b);Ug(b);return}function Ad(a){a=a|0;var b=0,d=0,e=0;c[a>>2]=4428;b=c[a+12>>2]|0;if(!b){Wg(a);return}d=b+4|0;e=c[d>>2]|0;c[d>>2]=e+-1;if(e|0){Wg(a);return}Ga[c[(c[b>>2]|0)+8>>2]&127](b);Ug(b);Wg(a);return}function Bd(a){a=a|0;var b=0,d=0;b=Vg(16)|0;c[b>>2]=4428;c[b+4>>2]=c[a+4>>2];c[b+8>>2]=c[a+8>>2];d=c[a+12>>2]|0;c[b+12>>2]=d;if(!d)return b|0;a=d+4|0;c[a>>2]=(c[a>>2]|0)+1;return b|0}function Cd(a,b){a=a|0;b=b|0;var d=0;c[b>>2]=4428;c[b+4>>2]=c[a+4>>2];c[b+8>>2]=c[a+8>>2];d=c[a+12>>2]|0;c[b+12>>2]=d;if(!d)return;b=d+4|0;c[b>>2]=(c[b>>2]|0)+1;return}function Dd(a){a=a|0;var b=0,d=0;b=c[a+12>>2]|0;if(!b)return;a=b+4|0;d=c[a>>2]|0;c[a>>2]=d+-1;if(d|0)return;Ga[c[(c[b>>2]|0)+8>>2]&127](b);Ug(b);return}function Ed(a){a=a|0;var b=0,d=0,e=0;b=c[a+12>>2]|0;if(!b){Wg(a);return}d=b+4|0;e=c[d>>2]|0;c[d>>2]=e+-1;if(e|0){Wg(a);return}Ga[c[(c[b>>2]|0)+8>>2]&127](b);Ug(b);Wg(a);return}function Fd(a){a=a|0;var b=0,d=0,e=0;b=c[a+4>>2]|0;Lg(11446)|0;d=a+8|0;a=c[(c[d>>2]|0)+4>>2]|0;e=c[b>>2]|0;c[e+(a*48|0)+24>>2]=1125515264;c[e+(a*48|0)+28>>2]=1117782016;a=c[d>>2]|0;Ja[c[(c[a>>2]|0)+4>>2]&31](a,b,a+40|0,a+32|0);return}function Gd(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==8570?a+4|0:0)|0}function Hd(a){a=a|0;return 3224}function Id(a){a=a|0;var b=0,d=0;c[a>>2]=4472;b=c[a+12>>2]|0;if(!b)return;a=b+4|0;d=c[a>>2]|0;c[a>>2]=d+-1;if(d|0)return;Ga[c[(c[b>>2]|0)+8>>2]&127](b);Ug(b);return}function Jd(a){a=a|0;var b=0,d=0,e=0;c[a>>2]=4472;b=c[a+12>>2]|0;if(!b){Wg(a);return}d=b+4|0;e=c[d>>2]|0;c[d>>2]=e+-1;if(e|0){Wg(a);return}Ga[c[(c[b>>2]|0)+8>>2]&127](b);Ug(b);Wg(a);return}function Kd(a){a=a|0;var b=0,d=0;b=Vg(16)|0;c[b>>2]=4472;c[b+4>>2]=c[a+4>>2];c[b+8>>2]=c[a+8>>2];d=c[a+12>>2]|0;c[b+12>>2]=d;if(!d)return b|0;a=d+4|0;c[a>>2]=(c[a>>2]|0)+1;return b|0}function Ld(a,b){a=a|0;b=b|0;var d=0;c[b>>2]=4472;c[b+4>>2]=c[a+4>>2];c[b+8>>2]=c[a+8>>2];d=c[a+12>>2]|0;c[b+12>>2]=d;if(!d)return;b=d+4|0;c[b>>2]=(c[b>>2]|0)+1;return}function Md(a){a=a|0;var b=0,d=0;b=c[a+12>>2]|0;if(!b)return;a=b+4|0;d=c[a>>2]|0;c[a>>2]=d+-1;if(d|0)return;Ga[c[(c[b>>2]|0)+8>>2]&127](b);Ug(b);return}function Nd(a){a=a|0;var b=0,d=0,e=0;b=c[a+12>>2]|0;if(!b){Wg(a);return}d=b+4|0;e=c[d>>2]|0;c[d>>2]=e+-1;if(e|0){Wg(a);return}Ga[c[(c[b>>2]|0)+8>>2]&127](b);Ug(b);Wg(a);return}function Od(a,b){a=a|0;b=b|0;var d=0;b=c[a+4>>2]|0;Lg(11428)|0;d=c[a+8>>2]|0;a=c[b>>2]|0;c[a+(((c[a+((c[d+4>>2]|0)*48|0)+32>>2]|0)+1|0)*48|0)+36>>2]=696469503;Ja[c[(c[d>>2]|0)+4>>2]&31](d,b,d+40|0,d+32|0);return}function Pd(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==8691?a+4|0:0)|0}function Qd(a){a=a|0;return 3248}function Rd(a){a=a|0;var b=0,d=0;c[a>>2]=4536;b=c[a+12>>2]|0;if(!b)return;a=b+4|0;d=c[a>>2]|0;c[a>>2]=d+-1;if(d|0)return;Ga[c[(c[b>>2]|0)+8>>2]&127](b);Ug(b);return}function Sd(a){a=a|0;var b=0,d=0,e=0;c[a>>2]=4536;b=c[a+12>>2]|0;if(!b){Wg(a);return}d=b+4|0;e=c[d>>2]|0;c[d>>2]=e+-1;if(e|0){Wg(a);return}Ga[c[(c[b>>2]|0)+8>>2]&127](b);Ug(b);Wg(a);return}function Td(a){a=a|0;var b=0,d=0;b=Vg(16)|0;c[b>>2]=4536;c[b+4>>2]=c[a+4>>2];c[b+8>>2]=c[a+8>>2];d=c[a+12>>2]|0;c[b+12>>2]=d;if(!d)return b|0;a=d+4|0;c[a>>2]=(c[a>>2]|0)+1;return b|0}function Ud(a,b){a=a|0;b=b|0;var d=0;c[b>>2]=4536;c[b+4>>2]=c[a+4>>2];c[b+8>>2]=c[a+8>>2];d=c[a+12>>2]|0;c[b+12>>2]=d;if(!d)return;b=d+4|0;c[b>>2]=(c[b>>2]|0)+1;return}function Vd(a){a=a|0;var b=0,d=0;b=c[a+12>>2]|0;if(!b)return;a=b+4|0;d=c[a>>2]|0;c[a>>2]=d+-1;if(d|0)return;Ga[c[(c[b>>2]|0)+8>>2]&127](b);Ug(b);return}function Wd(a){a=a|0;var b=0,d=0,e=0;b=c[a+12>>2]|0;if(!b){Wg(a);return}d=b+4|0;e=c[d>>2]|0;c[d>>2]=e+-1;if(e|0){Wg(a);return}Ga[c[(c[b>>2]|0)+8>>2]&127](b);Ug(b);Wg(a);return}function Xd(a){a=a|0;var b=0,d=0,e=0;Lg(11435)|0;b=a+8|0;d=a+4|0;a=c[(c[b>>2]|0)+4>>2]|0;e=c[c[d>>2]>>2]|0;c[e+(a*48|0)+16>>2]=1073741824;c[e+(a*48|0)+20>>2]=1073741824;a=c[b>>2]|0;Ja[c[(c[a>>2]|0)+4>>2]&31](a,c[d>>2]|0,a+40|0,a+32|0);return}function Yd(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==8885?a+4|0:0)|0}function Zd(a){a=a|0;return 3288}function _d(a){a=a|0;var b=0,d=0;c[a>>2]=4580;b=c[a+12>>2]|0;if(!b)return;a=b+4|0;d=c[a>>2]|0;c[a>>2]=d+-1;if(d|0)return;Ga[c[(c[b>>2]|0)+8>>2]&127](b);Ug(b);return}function $d(a){a=a|0;var b=0,d=0,e=0;c[a>>2]=4580;b=c[a+12>>2]|0;if(!b){Wg(a);return}d=b+4|0;e=c[d>>2]|0;c[d>>2]=e+-1;if(e|0){Wg(a);return}Ga[c[(c[b>>2]|0)+8>>2]&127](b);Ug(b);Wg(a);return}function ae(a){a=a|0;var b=0,d=0;b=Vg(16)|0;c[b>>2]=4580;c[b+4>>2]=c[a+4>>2];c[b+8>>2]=c[a+8>>2];d=c[a+12>>2]|0;c[b+12>>2]=d;if(!d)return b|0;a=d+4|0;c[a>>2]=(c[a>>2]|0)+1;return b|0}function be(a,b){a=a|0;b=b|0;var d=0;c[b>>2]=4580;c[b+4>>2]=c[a+4>>2];c[b+8>>2]=c[a+8>>2];d=c[a+12>>2]|0;c[b+12>>2]=d;if(!d)return;b=d+4|0;c[b>>2]=(c[b>>2]|0)+1;return}function ce(a){a=a|0;var b=0,d=0;b=c[a+12>>2]|0;if(!b)return;a=b+4|0;d=c[a>>2]|0;c[a>>2]=d+-1;if(d|0)return;Ga[c[(c[b>>2]|0)+8>>2]&127](b);Ug(b);return}function de(a){a=a|0;var b=0,d=0,e=0;b=c[a+12>>2]|0;if(!b){Wg(a);return}d=b+4|0;e=c[d>>2]|0;c[d>>2]=e+-1;if(e|0){Wg(a);return}Ga[c[(c[b>>2]|0)+8>>2]&127](b);Ug(b);Wg(a);return}function ee(a){a=a|0;var b=0,d=0,e=0;Lg(11446)|0;b=a+8|0;d=a+4|0;a=c[(c[b>>2]|0)+4>>2]|0;e=c[c[d>>2]>>2]|0;c[e+(a*48|0)+16>>2]=1084227584;c[e+(a*48|0)+20>>2]=1084227584;a=c[b>>2]|0;Ja[c[(c[a>>2]|0)+4>>2]&31](a,c[d>>2]|0,a+40|0,a+32|0);return}function fe(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==9130?a+4|0:0)|0}function ge(a){a=a|0;return 3312}function he(a){a=a|0;Wg(a);return}function ie(a){a=a|0;var b=0;b=Vg(8)|0;c[b>>2]=4624;c[b+4>>2]=c[a+4>>2];return b|0}function je(a,b){a=a|0;b=b|0;c[b>>2]=4624;c[b+4>>2]=c[a+4>>2];return}function ke(a){a=a|0;return}function le(a){a=a|0;Wg(a);return}function me(a,b){a=a|0;b=b|0;var d=0,e=0,f=0;d=za;za=za+16|0;if((za|0)>=(Aa|0))y(16);e=d;f=c[a+4>>2]|0;a=c[f+200>>2]|0;if(!a){za=d;return}c[e>>2]=f;Ia[c[(c[a>>2]|0)+24>>2]&3](a,b,e);za=d;return}function ne(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==9379?a+4|0:0)|0}function oe(a){a=a|0;return 3336}function pe(a,b){a=a|0;b=b|0;return}function qe(a){a=a|0;Tg(a);Wg(a);return}function re(a){a=a|0;var b=0;b=c[a+12>>2]|0;if(!b)return;c[b>>2]=4516;a=c[b+200>>2]|0;if((b+184|0)!=(a|0)){if(a|0)Ga[c[(c[a>>2]|0)+20>>2]&127](a)}else Ga[c[(c[a>>2]|0)+16>>2]&127](a);Hb(b);Wg(b);return}function se(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==9576?a+12|0:0)|0}function te(a){a=a|0;Wg(a);return}function ue(a,b,d,e,f){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0;g=za;za=za+32|0;if((za|0)>=(Aa|0))y(32);h=g;i=g+16|0;j=g+8|0;c[a>>2]=0;k=a+4|0;c[k>>2]=0;l=a+8|0;c[l>>2]=0;if(!d){za=g;return}m=f+16|0;f=i+4|0;n=j+4|0;o=0;while(1){p=c[m>>2]|0;if(!p){q=5;break}r=Ca[c[(c[p>>2]|0)+24>>2]&63](p)|0;c[i>>2]=r;p=Vg(16)|0;c[p+4>>2]=0;c[p+8>>2]=0;c[p>>2]=3948;c[p+12>>2]=r;c[f>>2]=p;c[h>>2]=r;c[h+4>>2]=r;wb(i,h);r=c[i>>2]|0;c[(c[b>>2]|0)+((c[r+4>>2]|0)*48|0)+40>>2]=0;p=c[k>>2]|0;if((p|0)==(c[l>>2]|0))vb(a,i);else{c[p>>2]=r;r=c[f>>2]|0;c[p+4>>2]=r;if(!r)s=p;else{p=r+4|0;c[p>>2]=(c[p>>2]|0)+1;s=c[k>>2]|0}c[k>>2]=s+8}p=c[e>>2]|0;r=c[c[p>>2]>>2]|0;c[j>>2]=c[i>>2];t=c[f>>2]|0;c[n>>2]=t;if(t|0){u=t+4|0;c[u>>2]=(c[u>>2]|0)+1}Ia[r&3](p,b,j);p=c[n>>2]|0;if(p|0?(r=p+4|0,u=c[r>>2]|0,c[r>>2]=u+-1,(u|0)==0):0){Ga[c[(c[p>>2]|0)+8>>2]&127](p);Ug(p)}p=c[f>>2]|0;if(p|0?(u=p+4|0,r=c[u>>2]|0,c[u>>2]=r+-1,(r|0)==0):0){Ga[c[(c[p>>2]|0)+8>>2]&127](p);Ug(p)}o=o+1|0;if(o>>>0>=d>>>0){q=3;break}}if((q|0)==3){za=g;return}else if((q|0)==5){q=Y(4)|0;c[q>>2]=5572;aa(q|0,3584,115)}}function ve(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0;d=za;za=za+16|0;if((za|0)>=(Aa|0))y(16);e=d;c[a>>2]=b;f=Vg(16)|0;c[f+4>>2]=0;c[f+8>>2]=0;c[f>>2]=4696;c[f+12>>2]=b;c[a+4>>2]=f;c[e>>2]=b;c[e+4>>2]=b;we(a,e);za=d;return}function we(a,b){a=a|0;b=b|0;return}function xe(a){a=a|0;Tg(a);Wg(a);return}function ye(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0;b=c[a+12>>2]|0;if(!b)return;a=c[b>>2]|0;if(a|0){d=b+4|0;e=c[d>>2]|0;if((e|0)==(a|0))f=a;else{g=e;do{e=c[g+-4>>2]|0;g=g+-8|0;if(e|0?(h=e+4|0,i=c[h>>2]|0,c[h>>2]=i+-1,(i|0)==0):0){Ga[c[(c[e>>2]|0)+8>>2]&127](e);Ug(e)}}while((g|0)!=(a|0));f=c[b>>2]|0}c[d>>2]=a;Wg(f)}Wg(b);return}function ze(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==9714?a+12|0:0)|0}function Ae(a){a=a|0;Wg(a);return}function Be(a){a=a|0;return}function Ce(a){a=a|0;Wg(a);return}function De(a){a=a|0;var b=0;b=Vg(8)|0;c[b>>2]=4724;c[b+4>>2]=c[a+4>>2];return b|0}function Ee(a,b){a=a|0;b=b|0;c[b>>2]=4724;c[b+4>>2]=c[a+4>>2];return}function Fe(a){a=a|0;return}function Ge(a){a=a|0;Wg(a);return}function He(a){a=a|0;var b=0,d=0,e=0,f=0;b=za;za=za+32|0;if((za|0)>=(Aa|0))y(32);d=b;e=c[a+4>>2]|0;a=Vg(208)|0;f=d+16|0;c[d>>2]=4768;c[d+4>>2]=e;c[f>>2]=d;Fc(a,e,d);e=c[f>>2]|0;if((d|0)==(e|0)){Ga[c[(c[e>>2]|0)+16>>2]&127](e);za=b;return a|0}if(!e){za=b;return a|0}Ga[c[(c[e>>2]|0)+20>>2]&127](e);za=b;return a|0}function Ie(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==10133?a+4|0:0)|0}function Je(a){a=a|0;return 3432}function Ke(a){a=a|0;return}function Le(a){a=a|0;Wg(a);return}function Me(a){a=a|0;var b=0;b=Vg(8)|0;c[b>>2]=4768;c[b+4>>2]=c[a+4>>2];return b|0}function Ne(a,b){a=a|0;b=b|0;c[b>>2]=4768;c[b+4>>2]=c[a+4>>2];return}function Oe(a){a=a|0;return}function Pe(a){a=a|0;Wg(a);return}function Qe(a,b,d){a=a|0;b=b|0;d=d|0;c[(c[c[a+4>>2]>>2]|0)+((c[(c[d>>2]|0)+4>>2]|0)*48|0)+40>>2]=0;return}function Re(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==10070?a+4|0:0)|0}function Se(a){a=a|0;return 3424}function Te(a){a=a|0;Wg(a);return}function Ue(a){a=a|0;var b=0;b=Vg(8)|0;c[b>>2]=4812;c[b+4>>2]=c[a+4>>2];return b|0}function Ve(a,b){a=a|0;b=b|0;c[b>>2]=4812;c[b+4>>2]=c[a+4>>2];return}function We(a){a=a|0;return}function Xe(a){a=a|0;Wg(a);return}function Ye(a,b){a=a|0;b=b|0;$e(a+4|0,b);return}function Ze(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==10270?a+4|0:0)|0}function _e(a){a=a|0;return 3456}function $e(a,b){a=a|0;b=b|0;var d=0,e=0,h=0,i=0.0,j=0,k=0,l=0,m=0,n=0,o=0;d=za;za=za+16|0;if((za|0)>=(Aa|0))y(16);e=d;h=c[a>>2]|0;i=+f[b+4>>2];g[e>>3]=+f[b>>2];g[e+8>>3]=i;Jg(10248,e)|0;e=c[h+28>>2]|0;a=c[e>>2]|0;j=c[e+4>>2]|0;if((a|0)==(j|0)){za=d;return}e=a;while(1){k=c[e>>2]|0;l=c[e+4>>2]|0;a=(l|0)==0;if(!a){m=l+4|0;c[m>>2]=(c[m>>2]|0)+1}n=(c[h>>2]|0)+((c[k+4>>2]|0)*48|0)+40|0;if(!(c[n>>2]|0))break;if(!a?(a=l+4|0,m=c[a>>2]|0,c[a>>2]=m+-1,(m|0)==0):0){Ga[c[(c[l>>2]|0)+8>>2]&127](l);Ug(l)}e=e+8|0;if((e|0)==(j|0)){o=13;break}}if((o|0)==13){za=d;return}c[n>>2]=1;n=k+4|0;o=c[n>>2]|0;j=c[h>>2]|0;c[j+(o*48|0)+24>>2]=1125515264;c[j+(o*48|0)+28>>2]=1117782016;c[k+8>>2]=1056964608;c[k+12>>2]=1056964608;o=b;b=c[o+4>>2]|0;j=(c[h>>2]|0)+((c[n>>2]|0)*48|0)+16|0;c[j>>2]=c[o>>2];c[j+4>>2]=b;Ja[c[(c[k>>2]|0)+4>>2]&31](k,h,k+40|0,k+32|0);if(!l){za=d;return}k=l+4|0;h=c[k>>2]|0;c[k>>2]=h+-1;if(h|0){za=d;return}Ga[c[(c[l>>2]|0)+8>>2]&127](l);Ug(l);za=d;return}function af(a,b){a=a|0;b=b|0;return}function bf(a){a=a|0;Tg(a);Wg(a);return}function cf(a){a=a|0;var b=0,d=0,e=0;b=c[a+12>>2]|0;if(!b)return;a=c[b+16>>2]|0;if(a|0?(d=a+4|0,e=c[d>>2]|0,c[d>>2]=e+-1,(e|0)==0):0){Ga[c[(c[a>>2]|0)+8>>2]&127](a);Ug(a)}a=c[b>>2]|0;if(a|0){c[b+4>>2]=a;Wg(a)}Wg(b);return}function df(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==10399?a+12|0:0)|0}function ef(a){a=a|0;Wg(a);return}function ff(a){a=a|0;Tg(a);Wg(a);return}function gf(a){a=a|0;var b=0,d=0,e=0;b=c[a+12>>2]|0;if(!b)return;a=c[b+16>>2]|0;if(a|0?(d=a+4|0,e=c[d>>2]|0,c[d>>2]=e+-1,(e|0)==0):0){Ga[c[(c[a>>2]|0)+8>>2]&127](a);Ug(a)}a=c[b>>2]|0;if(a|0){c[b+4>>2]=a;Wg(a)}Wg(b);return}function hf(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==10535?a+12|0:0)|0}function jf(a){a=a|0;Wg(a);return}function kf(a){a=a|0;Tg(a);Wg(a);return}function lf(a){a=a|0;var b=0,d=0,e=0;b=c[a+12>>2]|0;if(!b)return;a=c[b+16>>2]|0;if(a|0?(d=a+4|0,e=c[d>>2]|0,c[d>>2]=e+-1,(e|0)==0):0){Ga[c[(c[a>>2]|0)+8>>2]&127](a);Ug(a)}a=c[b>>2]|0;if(a|0){c[b+4>>2]=a;Wg(a)}Wg(b);return}function mf(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==10671?a+12|0:0)|0}function nf(a){a=a|0;Wg(a);return}function of(a){a=a|0;Tg(a);Wg(a);return}function pf(a){a=a|0;var b=0,d=0,e=0;b=c[a+12>>2]|0;if(!b)return;a=c[b+16>>2]|0;if(a|0?(d=a+4|0,e=c[d>>2]|0,c[d>>2]=e+-1,(e|0)==0):0){Ga[c[(c[a>>2]|0)+8>>2]&127](a);Ug(a)}a=c[b>>2]|0;if(a|0){c[b+4>>2]=a;Wg(a)}Wg(b);return}function qf(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==10807?a+12|0:0)|0}function rf(a){a=a|0;Wg(a);return}function sf(a){a=a|0;Tg(a);Wg(a);return}function tf(a){a=a|0;var b=0,d=0,e=0;b=c[a+12>>2]|0;if(!b)return;a=c[b+16>>2]|0;if(a|0?(d=a+4|0,e=c[d>>2]|0,c[d>>2]=e+-1,(e|0)==0):0){Ga[c[(c[a>>2]|0)+8>>2]&127](a);Ug(a)}a=c[b>>2]|0;if(a|0){c[b+4>>2]=a;Wg(a)}Wg(b);return}function uf(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==10942?a+12|0:0)|0}function vf(a){a=a|0;Wg(a);return}function wf(a){a=a|0;Tg(a);Wg(a);return}function xf(a){a=a|0;var b=0,d=0,e=0;b=c[a+12>>2]|0;if(!b)return;a=c[b+32>>2]|0;if(a|0?(d=a+4|0,e=c[d>>2]|0,c[d>>2]=e+-1,(e|0)==0):0){Ga[c[(c[a>>2]|0)+8>>2]&127](a);Ug(a)}a=c[b+16>>2]|0;if(a|0?(e=a+4|0,d=c[e>>2]|0,c[e>>2]=d+-1,(d|0)==0):0){Ga[c[(c[a>>2]|0)+8>>2]&127](a);Ug(a)}a=c[b>>2]|0;if(a|0){c[b+4>>2]=a;Wg(a)}Wg(b);return}function yf(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==11075?a+12|0:0)|0}function zf(a){a=a|0;Wg(a);return}function Af(a){a=a|0;Wg(a);return}function Bf(a){a=a|0;var b=0,d=0;b=Vg(36)|0;d=a+4|0;c[b>>2]=5024;a=b+4|0;c[a>>2]=c[d>>2];c[a+4>>2]=c[d+4>>2];c[a+8>>2]=c[d+8>>2];c[a+12>>2]=c[d+12>>2];c[a+16>>2]=c[d+16>>2];c[a+20>>2]=c[d+20>>2];c[a+24>>2]=c[d+24>>2];c[a+28>>2]=c[d+28>>2];return b|0}function Cf(a,b){a=a|0;b=b|0;var d=0;d=a+4|0;c[b>>2]=5024;a=b+4|0;c[a>>2]=c[d>>2];c[a+4>>2]=c[d+4>>2];c[a+8>>2]=c[d+8>>2];c[a+12>>2]=c[d+12>>2];c[a+16>>2]=c[d+16>>2];c[a+20>>2]=c[d+20>>2];c[a+24>>2]=c[d+24>>2];c[a+28>>2]=c[d+28>>2];return}function Df(a){a=a|0;return}function Ef(a){a=a|0;Wg(a);return}function Ff(a){a=a|0;var b=0,d=0,e=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0;b=za;za=za+16|0;if((za|0)>=(Aa|0))y(16);d=b;e=N()|0;g=a+4|0;if((e|0)==(c[c[g>>2]>>2]|0)){h=a+8|0;i=c[h>>2]|0;If(i);za=b;return}c[d>>2]=e;Jg(11179,d)|0;c[c[g>>2]>>2]=e;switch(e|0){case 0:{e=c[a+8>>2]|0;g=c[a+12>>2]|0;j=c[g>>2]|0;k=c[g+4>>2]|0;g=(k|0)==0;if(!g){l=k+4|0;c[l>>2]=(c[l>>2]|0)+1;c[l>>2]=(c[l>>2]|0)+1}l=e+24|0;c[l>>2]=j;j=e+28|0;m=c[j>>2]|0;c[j>>2]=k;if(m|0?(j=m+4|0,n=c[j>>2]|0,c[j>>2]=n+-1,(n|0)==0):0){Ga[c[(c[m>>2]|0)+8>>2]&127](m);Ug(m)}m=c[l>>2]|0;l=e+16|0;e=l;n=c[e+4>>2]|0;j=m+20|0;c[j>>2]=c[e>>2];c[j+4>>2]=n;n=c[m+12>>2]|0;if(n|0){j=c[(c[n>>2]|0)+4>>2]|0;f[d>>2]=0.0;f[d+4>>2]=0.0;Ja[j&31](n,m,d,l)}if(g){h=a+8|0;i=c[h>>2]|0;If(i);za=b;return}g=k+4|0;l=c[g>>2]|0;c[g>>2]=l+-1;if(l|0){h=a+8|0;i=c[h>>2]|0;If(i);za=b;return}Ga[c[(c[k>>2]|0)+8>>2]&127](k);Ug(k);h=a+8|0;i=c[h>>2]|0;If(i);za=b;return}case 1:{k=c[a+8>>2]|0;l=c[a+16>>2]|0;g=c[l>>2]|0;m=c[l+4>>2]|0;l=(m|0)==0;if(!l){n=m+4|0;c[n>>2]=(c[n>>2]|0)+1;c[n>>2]=(c[n>>2]|0)+1}n=k+24|0;c[n>>2]=g;g=k+28|0;j=c[g>>2]|0;c[g>>2]=m;if(j|0?(g=j+4|0,e=c[g>>2]|0,c[g>>2]=e+-1,(e|0)==0):0){Ga[c[(c[j>>2]|0)+8>>2]&127](j);Ug(j)}j=c[n>>2]|0;n=k+16|0;k=n;e=c[k+4>>2]|0;g=j+20|0;c[g>>2]=c[k>>2];c[g+4>>2]=e;e=c[j+12>>2]|0;if(e|0){g=c[(c[e>>2]|0)+4>>2]|0;f[d>>2]=0.0;f[d+4>>2]=0.0;Ja[g&31](e,j,d,n)}if(l){h=a+8|0;i=c[h>>2]|0;If(i);za=b;return}l=m+4|0;n=c[l>>2]|0;c[l>>2]=n+-1;if(n|0){h=a+8|0;i=c[h>>2]|0;If(i);za=b;return}Ga[c[(c[m>>2]|0)+8>>2]&127](m);Ug(m);h=a+8|0;i=c[h>>2]|0;If(i);za=b;return}case 2:{m=c[a+8>>2]|0;n=c[a+20>>2]|0;l=c[n>>2]|0;j=c[n+4>>2]|0;n=(j|0)==0;if(!n){e=j+4|0;c[e>>2]=(c[e>>2]|0)+1;c[e>>2]=(c[e>>2]|0)+1}e=m+24|0;c[e>>2]=l;l=m+28|0;g=c[l>>2]|0;c[l>>2]=j;if(g|0?(l=g+4|0,k=c[l>>2]|0,c[l>>2]=k+-1,(k|0)==0):0){Ga[c[(c[g>>2]|0)+8>>2]&127](g);Ug(g)}g=c[e>>2]|0;e=m+16|0;m=e;k=c[m+4>>2]|0;l=g+20|0;c[l>>2]=c[m>>2];c[l+4>>2]=k;k=c[g+12>>2]|0;if(k|0){l=c[(c[k>>2]|0)+4>>2]|0;f[d>>2]=0.0;f[d+4>>2]=0.0;Ja[l&31](k,g,d,e)}if(n){h=a+8|0;i=c[h>>2]|0;If(i);za=b;return}n=j+4|0;e=c[n>>2]|0;c[n>>2]=e+-1;if(e|0){h=a+8|0;i=c[h>>2]|0;If(i);za=b;return}Ga[c[(c[j>>2]|0)+8>>2]&127](j);Ug(j);h=a+8|0;i=c[h>>2]|0;If(i);za=b;return}case 3:{j=c[a+8>>2]|0;e=c[a+24>>2]|0;n=c[e>>2]|0;g=c[e+4>>2]|0;e=(g|0)==0;if(!e){k=g+4|0;c[k>>2]=(c[k>>2]|0)+1;c[k>>2]=(c[k>>2]|0)+1}k=j+24|0;c[k>>2]=n;n=j+28|0;l=c[n>>2]|0;c[n>>2]=g;if(l|0?(n=l+4|0,m=c[n>>2]|0,c[n>>2]=m+-1,(m|0)==0):0){Ga[c[(c[l>>2]|0)+8>>2]&127](l);Ug(l)}l=c[k>>2]|0;k=j+16|0;j=k;m=c[j+4>>2]|0;n=l+20|0;c[n>>2]=c[j>>2];c[n+4>>2]=m;m=c[l+12>>2]|0;if(m|0){n=c[(c[m>>2]|0)+4>>2]|0;f[d>>2]=0.0;f[d+4>>2]=0.0;Ja[n&31](m,l,d,k)}if(e){h=a+8|0;i=c[h>>2]|0;If(i);za=b;return}e=g+4|0;k=c[e>>2]|0;c[e>>2]=k+-1;if(k|0){h=a+8|0;i=c[h>>2]|0;If(i);za=b;return}Ga[c[(c[g>>2]|0)+8>>2]&127](g);Ug(g);h=a+8|0;i=c[h>>2]|0;If(i);za=b;return}case 4:{g=c[a+8>>2]|0;k=c[a+28>>2]|0;e=c[k>>2]|0;l=c[k+4>>2]|0;k=(l|0)==0;if(!k){m=l+4|0;c[m>>2]=(c[m>>2]|0)+1;c[m>>2]=(c[m>>2]|0)+1}m=g+24|0;c[m>>2]=e;e=g+28|0;n=c[e>>2]|0;c[e>>2]=l;if(n|0?(e=n+4|0,j=c[e>>2]|0,c[e>>2]=j+-1,(j|0)==0):0){Ga[c[(c[n>>2]|0)+8>>2]&127](n);Ug(n)}n=c[m>>2]|0;m=g+16|0;g=m;j=c[g+4>>2]|0;e=n+20|0;c[e>>2]=c[g>>2];c[e+4>>2]=j;j=c[n+12>>2]|0;if(j|0){e=c[(c[j>>2]|0)+4>>2]|0;f[d>>2]=0.0;f[d+4>>2]=0.0;Ja[e&31](j,n,d,m)}if(k){h=a+8|0;i=c[h>>2]|0;If(i);za=b;return}k=l+4|0;m=c[k>>2]|0;c[k>>2]=m+-1;if(m|0){h=a+8|0;i=c[h>>2]|0;If(i);za=b;return}Ga[c[(c[l>>2]|0)+8>>2]&127](l);Ug(l);h=a+8|0;i=c[h>>2]|0;If(i);za=b;return}case 5:{l=c[a+8>>2]|0;m=c[a+32>>2]|0;k=c[m>>2]|0;n=c[m+4>>2]|0;m=(n|0)==0;if(!m){j=n+4|0;c[j>>2]=(c[j>>2]|0)+1;c[j>>2]=(c[j>>2]|0)+1}j=l+24|0;c[j>>2]=k;k=l+28|0;e=c[k>>2]|0;c[k>>2]=n;if(e|0?(k=e+4|0,g=c[k>>2]|0,c[k>>2]=g+-1,(g|0)==0):0){Ga[c[(c[e>>2]|0)+8>>2]&127](e);Ug(e)}e=c[j>>2]|0;j=l+16|0;l=j;g=c[l+4>>2]|0;k=e+20|0;c[k>>2]=c[l>>2];c[k+4>>2]=g;g=c[e+12>>2]|0;if(g|0){k=c[(c[g>>2]|0)+4>>2]|0;f[d>>2]=0.0;f[d+4>>2]=0.0;Ja[k&31](g,e,d,j)}if(m){h=a+8|0;i=c[h>>2]|0;If(i);za=b;return}m=n+4|0;j=c[m>>2]|0;c[m>>2]=j+-1;if(j|0){h=a+8|0;i=c[h>>2]|0;If(i);za=b;return}Ga[c[(c[n>>2]|0)+8>>2]&127](n);Ug(n);h=a+8|0;i=c[h>>2]|0;If(i);za=b;return}default:{h=a+8|0;i=c[h>>2]|0;If(i);za=b;return}}}function Gf(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==11268?a+4|0:0)|0}function Hf(a){a=a|0;return 3576}function If(a){a=a|0;var b=0,d=0,e=0.0,h=0.0,i=0.0,j=0,k=0,l=0,m=0,n=0;b=za;za=za+16|0;if((za|0)>=(Aa|0))y(16);d=b;c[a>>2]=(c[a>>2]|0)+1;e=+ma();J();h=+sa();i=+ra();j=a+16|0;k=a+20|0;if(!(h==+f[j>>2]?i==+f[k>>2]:0))l=3;if((l|0)==3?(g[d>>3]=h,g[d+8>>3]=i,Jg(11193,d)|0,f[j>>2]=h,f[k>>2]=i,k=c[a+24>>2]|0,l=j,m=c[l+4>>2]|0,n=k+20|0,c[n>>2]=c[l>>2],c[n+4>>2]=m,m=c[k+12>>2]|0,m|0):0){n=c[(c[m>>2]|0)+4>>2]|0;f[d>>2]=0.0;f[d+4>>2]=0.0;Ja[n&31](m,k,d,j)}Jf(a);Kf(a,e,c[a>>2]|0,0);g[a+8>>3]=e;za=b;return}function Jf(a){a=a|0;var b=0,e=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,z=0.0,A=0,B=0;b=za;za=za+96|0;if((za|0)>=(Aa|0))y(96);e=b+64|0;g=b+48|0;h=b;i=b+80|0;j=b+72|0;if(!(V(h|0)|0)){za=b;return}k=h+8|0;l=a+24|0;a=h+20|0;m=h+24|0;n=i+4|0;o=h+20|0;p=i+4|0;q=h+28|0;r=h+32|0;s=j+4|0;t=h+16|0;u=h+17|0;v=i+4|0;a:while(1){switch(c[h>>2]|0){case 256:{w=4;break a;break}case 512:{x=d[k>>0]|0;c[e>>2]=512;c[e+4>>2]=x;Jg(11248,e)|0;break}case 1026:{x=c[l>>2]|0;z=+(c[m>>2]|0);f[i>>2]=+(c[a>>2]|0);f[n>>2]=z;A=c[x+12>>2]|0;if(A|0)Of(A,x,i)|0;break}case 1024:{x=c[l>>2]|0;z=+(c[m>>2]|0);f[i>>2]=+(c[o>>2]|0);f[p>>2]=z;z=+(c[r>>2]|0);f[j>>2]=+(c[q>>2]|0);f[s>>2]=z;A=c[x+12>>2]|0;if(A|0)Lf(A,x,i,j)|0;break}case 1025:{x=d[u>>0]|0;A=c[a>>2]|0;B=c[m>>2]|0;c[g>>2]=d[t>>0];c[g+4>>2]=x;c[g+8>>2]=A;c[g+12>>2]=B;Jg(11221,g)|0;B=c[l>>2]|0;z=+(c[m>>2]|0);f[i>>2]=+(c[a>>2]|0);f[v>>2]=z;A=c[B+12>>2]|0;if(A|0)Nf(A,B,i)|0;break}default:{}}if(!(V(h|0)|0)){w=16;break}}if((w|0)==4)Ch();else if((w|0)==16){za=b;return}}function Kf(b,d,e,g){b=b|0;d=+d;e=e|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0.0,s=0,t=0,u=0,v=0,w=0;g=za;za=za+16|0;if((za|0)>=(Aa|0))y(16);e=g;h=c[b+24>>2]|0;c[e>>2]=0;b=e+4|0;c[b>>2]=0;i=e+8|0;c[i>>2]=0;j=h+4|0;k=(c[j>>2]|0)-(c[h>>2]|0)|0;l=(k|0)/48|0;if(k){if(l>>>0>89478485)eh(e);m=Vg(k)|0;c[b>>2]=m;c[e>>2]=m;c[i>>2]=m+(l*48|0);l=c[h>>2]|0;h=(c[j>>2]|0)-l|0;if((h|0)>0){fi(m|0,l|0,h|0)|0;l=m+(((h>>>0)/48|0)*48|0)|0;c[b>>2]=l;if((l|0)==(m|0)){n=m;o=b}else{l=0;h=m;j=0;do{i=h+(j*48|0)|0;switch(c[h+(j*48|0)+44>>2]|0){case 1:{if(!(c[h+(j*48|0)+40>>2]|0)){p=c[h+(j*48|0)+36>>2]|0;q=0}else{p=j;q=l}break}case 2:{d=+f[h+(j*48|0)+16>>2];r=+f[h+(j*48|0)+20>>2];K(+(+f[i>>2]+d),+(+f[h+(j*48|0)+4>>2]+r),+d,+r,c[h+(j*48|0)+32>>2]|0);p=j;q=l;break}case 3:{r=+f[h+(j*48|0)+16>>2];d=+f[h+(j*48|0)+20>>2];R(+(+f[i>>2]+r),+(+f[h+(j*48|0)+4>>2]+d),+r,+d,+(+f[h+(j*48|0)+24>>2]),c[h+(j*48|0)+32>>2]|0);p=j;q=l;break}case 4:{L(+(+f[i>>2]),+(+f[h+(j*48|0)+4>>2]),+(+f[h+(j*48|0)+16>>2]),+(+f[h+(j*48|0)+20>>2]),c[h+(j*48|0)+32>>2]|0);p=j;q=l;break}case 5:{Q(+(+f[i>>2]),+(+f[h+(j*48|0)+4>>2]),+(+f[h+(j*48|0)+16>>2]),+(+f[h+(j*48|0)+20>>2]),+(+f[h+(j*48|0)+24>>2]),+(+f[h+(j*48|0)+28>>2]),c[h+(j*48|0)+32>>2]|0,c[h+(j*48|0)+36>>2]|0);p=j;q=l;break}case 6:{k=(c[3330]|0)+((c[h+(j*48|0)+36>>2]|0)*12|0)|0;if((a[k+11>>0]|0)<0)s=c[k>>2]|0;else s=k;d=+f[h+(j*48|0)+24>>2];M(s|0,+(+f[i>>2]),+(+f[h+(j*48|0)+4>>2]+d),+d,c[h+(j*48|0)+32>>2]|0);p=j;q=l;break}default:{p=j;q=l}}j=Zh(p|0,q|0,1,0)|0;l=x()|0;h=c[e>>2]|0}while((l|0)<0|((l|0)==0?j>>>0<(((c[b>>2]|0)-h|0)/48|0)>>>0:0));t=b;u=h;v=9}}else{w=m;v=5}}else{w=0;v=5}if((v|0)==5){t=b;u=w;v=9}if((v|0)==9)if(!u){za=g;return}else{n=u;o=t}c[o>>2]=n;Wg(n);za=g;return}function Lf(b,d,e,f){b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0;if(!(c[(c[d>>2]|0)+((c[b+4>>2]|0)*48|0)+40>>2]|0)){g=0;return g|0}if(a[b+57>>0]|0)Mf(b,d,f);h=b+168|0;i=c[h>>2]|0;j=(c[b+172>>2]|0)-i|0;if((j|0)<=0){g=0;return g|0}b=(j>>>3)+-1|0;j=i;while(1){i=c[j+(b<<3)>>2]|0;k=c[j+(b<<3)+4>>2]|0;l=(k|0)==0;if(!l){m=k+4|0;c[m>>2]=(c[m>>2]|0)+1}m=Lf(i,d,e,f)|0;if(!l?(l=k+4|0,i=c[l>>2]|0,c[l>>2]=i+-1,(i|0)==0):0){Ga[c[(c[k>>2]|0)+8>>2]&127](k);Ug(k)}if(m){g=1;n=14;break}m=b+-1|0;if((m|0)<=-1){g=0;n=14;break}b=m;j=c[h>>2]|0}if((n|0)==14)return g|0;return 0}function Mf(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,g=0,i=0,j=0,k=0,l=0,m=0,n=0.0,o=0.0,p=0,q=0.0,r=0.0,s=0,t=0.0,u=0.0,v=0.0,w=0.0,x=0,z=0;e=za;za=za+16|0;if((za|0)>=(Aa|0))y(16);g=e+8|0;i=e;j=a+4|0;k=c[j>>2]|0;l=c[b>>2]|0;m=l+(k*48|0)+16|0;n=+f[m>>2];o=n+ +f[d>>2];p=l+(k*48|0)+20|0;q=+f[p>>2];r=q+ +f[d+4>>2];f[g>>2]=o;d=g+4|0;f[d>>2]=r;s=c[a+80>>2]|0;if(!s){t=o;u=n;v=r;w=q;x=l;z=k}else{Ha[c[(c[s>>2]|0)+24>>2]&31](s,g);t=+f[g>>2];u=+f[m>>2];v=+f[d>>2];w=+f[p>>2];x=c[b>>2]|0;z=c[j>>2]|0}j=g;g=c[j+4>>2]|0;p=x+(z*48|0)+16|0;c[p>>2]=c[j>>2];c[p+4>>2]=g;g=a+16|0;p=g;j=c[p>>2]|0;z=c[p+4>>2]|0;p=i;c[p>>2]=j;c[p+4>>2]=z;z=a+20|0;q=v-w+ +f[z>>2];f[g>>2]=t-u+(c[h>>2]=j,+f[h>>2]);f[z>>2]=q;z=a+24|0;Ja[c[(c[a>>2]|0)+8>>2]&31](a,b,i,z);i=c[a+168>>2]|0;j=c[a+172>>2]|0;if((i|0)==(j|0)){za=e;return}a=i;do{i=c[a>>2]|0;p=c[a+4>>2]|0;if(p){x=p+4|0;c[x>>2]=(c[x>>2]|0)+1;Ja[c[(c[i>>2]|0)+4>>2]&31](i,b,g,z);x=p+4|0;d=c[x>>2]|0;c[x>>2]=d+-1;if(!d){Ga[c[(c[p>>2]|0)+8>>2]&127](p);Ug(p)}}else Ja[c[(c[i>>2]|0)+4>>2]&31](i,b,g,z);a=a+8|0}while((a|0)!=(j|0));za=e;return}function Nf(b,d,e){b=b|0;d=d|0;e=e|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0.0,r=0.0,s=0.0;if(!(c[(c[d>>2]|0)+((c[b+4>>2]|0)*48|0)+40>>2]|0)){g=0;return g|0}h=b+168|0;i=c[h>>2]|0;j=(c[b+172>>2]|0)-i|0;a:do if((j|0)>0){k=(j>>>3)+-1|0;l=i;while(1){m=c[l+(k<<3)>>2]|0;n=c[l+(k<<3)+4>>2]|0;o=(n|0)==0;if(!o){p=n+4|0;c[p>>2]=(c[p>>2]|0)+1}p=Nf(m,d,e)|0;if(!o?(o=n+4|0,m=c[o>>2]|0,c[o>>2]=m+-1,(m|0)==0):0){Ga[c[(c[n>>2]|0)+8>>2]&127](n);Ug(n)}if(p){g=1;break}p=k+-1|0;if((p|0)<=-1)break a;k=p;l=c[h>>2]|0}return g|0}while(0);if((((a[b+88>>0]|0?(q=+f[e>>2],r=+f[e+4>>2],s=+f[b+16>>2],s<=q):0)?s+ +f[b+24>>2]>=q:0)?(q=+f[b+20>>2],q<=r):0)?q+ +f[b+28>>2]>=r:0){a[b+89>>0]=1;h=c[b+112>>2]|0;if(!h){g=1;return g|0}Ga[c[(c[h>>2]|0)+24>>2]&127](h);g=1;return g|0}if(!(a[b+56>>0]|0)){g=0;return g|0}r=+f[e>>2];q=+f[e+4>>2];s=+f[b+16>>2];if(!(s<=r)){g=0;return g|0}if(!(s+ +f[b+24>>2]>=r)){g=0;return g|0}r=+f[b+20>>2];if(!(r<=q)){g=0;return g|0}if(!(r+ +f[b+28>>2]>=q)){g=0;return g|0}Lg(11459)|0;a[b+57>>0]=1;g=1;return g|0}function Of(b,d,e){b=b|0;d=d|0;e=e|0;var g=0,h=0,i=0.0,j=0.0,k=0.0,l=0,m=0,n=0,o=0,p=0,q=0;if(!(c[(c[d>>2]|0)+((c[b+4>>2]|0)*48|0)+40>>2]|0)){g=0;return g|0}if(a[b+88>>0]|0?(h=b+89|0,a[h>>0]|0):0){a[h>>0]=0;h=c[b+136>>2]|0;if(h|0)Ga[c[(c[h>>2]|0)+24>>2]&127](h);h=c[b+160>>2]|0;if(!h){g=1;return g|0}i=+f[e>>2];j=+f[e+4>>2];k=+f[b+16>>2];if(!(k<=i)){g=1;return g|0}if(!(k+ +f[b+24>>2]>=i)){g=1;return g|0}i=+f[b+20>>2];if(!(i<=j)){g=1;return g|0}if(!(i+ +f[b+28>>2]>=j)){g=1;return g|0}Ha[c[(c[h>>2]|0)+24>>2]&31](h,e);g=1;return g|0}if(a[b+56>>0]|0?(h=b+57|0,a[h>>0]|0):0){a[h>>0]=0;g=1;return g|0}h=b+168|0;l=c[h>>2]|0;m=(c[b+172>>2]|0)-l|0;if((m|0)<=0){g=0;return g|0}b=(m>>>3)+-1|0;m=l;while(1){l=c[m+(b<<3)>>2]|0;n=c[m+(b<<3)+4>>2]|0;o=(n|0)==0;if(!o){p=n+4|0;c[p>>2]=(c[p>>2]|0)+1}p=Of(l,d,e)|0;if(!o?(o=n+4|0,l=c[o>>2]|0,c[o>>2]=l+-1,(l|0)==0):0){Ga[c[(c[n>>2]|0)+8>>2]&127](n);Ug(n)}if(p){g=1;q=25;break}p=b+-1|0;if((p|0)<=-1){g=0;q=25;break}b=p;m=c[h>>2]|0}if((q|0)==25)return g|0;return 0}function Pf(){c[3330]=0;c[3331]=0;c[3332]=0;c[3333]=0;c[3334]=0;c[3335]=0;c[3336]=0;c[3337]=1065353216;c[3328]=0;return}function Qf(a){a=a|0;var b=0,d=0;b=za;za=za+16|0;if((za|0)>=(Aa|0))y(16);d=b;c[d>>2]=Vf(c[a+60>>2]|0)|0;a=Tf(ia(6,d|0)|0)|0;za=b;return a|0}function Rf(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0;e=za;za=za+48|0;if((za|0)>=(Aa|0))y(48);f=e+32|0;g=e+16|0;h=e;i=a+28|0;j=c[i>>2]|0;c[h>>2]=j;k=a+20|0;l=(c[k>>2]|0)-j|0;c[h+4>>2]=l;c[h+8>>2]=b;c[h+12>>2]=d;b=l+d|0;l=a+60|0;c[g>>2]=c[l>>2];c[g+4>>2]=h;c[g+8>>2]=2;j=Tf(ga(146,g|0)|0)|0;a:do if((b|0)!=(j|0)){g=2;m=b;n=h;o=j;while(1){if((o|0)<0)break;m=m-o|0;p=c[n+4>>2]|0;q=o>>>0>p>>>0;r=q?n+8|0:n;s=g+(q<<31>>31)|0;t=o-(q?p:0)|0;c[r>>2]=(c[r>>2]|0)+t;p=r+4|0;c[p>>2]=(c[p>>2]|0)-t;c[f>>2]=c[l>>2];c[f+4>>2]=r;c[f+8>>2]=s;o=Tf(ga(146,f|0)|0)|0;if((m|0)==(o|0)){u=3;break a}else{g=s;n=r}}c[a+16>>2]=0;c[i>>2]=0;c[k>>2]=0;c[a>>2]=c[a>>2]|32;if((g|0)==2)v=0;else v=d-(c[n+4>>2]|0)|0}else u=3;while(0);if((u|0)==3){u=c[a+44>>2]|0;c[a+16>>2]=u+(c[a+48>>2]|0);a=u;c[i>>2]=a;c[k>>2]=a;v=d}za=e;return v|0}function Sf(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0;e=za;za=za+32|0;if((za|0)>=(Aa|0))y(32);f=e;g=e+20|0;c[f>>2]=c[a+60>>2];c[f+4>>2]=0;c[f+8>>2]=b;c[f+12>>2]=g;c[f+16>>2]=d;if((Tf(fa(140,f|0)|0)|0)<0){c[g>>2]=-1;h=-1}else h=c[g>>2]|0;za=e;return h|0}function Tf(a){a=a|0;var b=0;if(a>>>0>4294963200){c[(Uf()|0)>>2]=0-a;b=-1}else b=a;return b|0}function Uf(){return 13416}function Vf(a){a=a|0;return a|0}function Wf(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0;f=za;za=za+32|0;if((za|0)>=(Aa|0))y(32);g=f;c[b+36>>2]=1;if((c[b>>2]&64|0)==0?(c[g>>2]=c[b+60>>2],c[g+4>>2]=21523,c[g+8>>2]=f+16,ha(54,g|0)|0):0)a[b+75>>0]=-1;g=Rf(b,d,e)|0;za=f;return g|0}function Xf(a){a=a|0;return (a+-48|0)>>>0<10|0}function Yf(){return 5320}function Zf(b,c){b=b|0;c=c|0;var d=0,e=0,f=0,g=0;d=a[b>>0]|0;e=a[c>>0]|0;if(d<<24>>24==0?1:d<<24>>24!=e<<24>>24){f=e;g=d}else{d=c;c=b;do{c=c+1|0;d=d+1|0;b=a[c>>0]|0;e=a[d>>0]|0}while(!(b<<24>>24==0?1:b<<24>>24!=e<<24>>24));f=e;g=b}return (g&255)-(f&255)|0}function _f(b){b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0;d=b;a:do if(!(d&3)){e=b;f=5}else{g=b;h=d;while(1){if(!(a[g>>0]|0)){i=h;break a}j=g+1|0;h=j;if(!(h&3)){e=j;f=5;break}else g=j}}while(0);if((f|0)==5){f=e;while(1){k=c[f>>2]|0;if(!((k&-2139062144^-2139062144)&k+-16843009))f=f+4|0;else break}if(!((k&255)<<24>>24))l=f;else{k=f;while(1){f=k+1|0;if(!(a[f>>0]|0)){l=f;break}else k=f}}i=l}return i-d|0}function $f(a,b){a=a|0;b=b|0;var c=0;c=_f(a)|0;return ((ag(a,1,c,b)|0)!=(c|0))<<31>>31|0}function ag(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0;f=t(d,b)|0;g=(b|0)==0?0:d;if((c[e+76>>2]|0)>-1){d=(cg(e)|0)==0;h=fg(a,f,e)|0;if(d)i=h;else{bg(e);i=h}}else i=fg(a,f,e)|0;if((i|0)==(f|0))j=g;else j=(i>>>0)/(b>>>0)|0;return j|0}function bg(a){a=a|0;return}function cg(a){a=a|0;return 1}function dg(b,e){b=b|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0;f=za;za=za+16|0;if((za|0)>=(Aa|0))y(16);g=f;h=e&255;a[g>>0]=h;i=b+16|0;j=c[i>>2]|0;if(!j)if(!(eg(b)|0)){k=c[i>>2]|0;l=4}else m=-1;else{k=j;l=4}do if((l|0)==4){j=b+20|0;i=c[j>>2]|0;if(i>>>0<k>>>0?(n=e&255,(n|0)!=(a[b+75>>0]|0)):0){c[j>>2]=i+1;a[i>>0]=h;m=n;break}if((Ea[c[b+36>>2]&7](b,g,1)|0)==1)m=d[g>>0]|0;else m=-1}while(0);za=f;return m|0}function eg(b){b=b|0;var d=0,e=0,f=0;d=b+74|0;e=a[d>>0]|0;a[d>>0]=e+255|e;e=c[b>>2]|0;if(!(e&8)){c[b+8>>2]=0;c[b+4>>2]=0;d=c[b+44>>2]|0;c[b+28>>2]=d;c[b+20>>2]=d;c[b+16>>2]=d+(c[b+48>>2]|0);f=0}else{c[b>>2]=e|32;f=-1}return f|0}function fg(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0;f=e+16|0;g=c[f>>2]|0;if(!g)if(!(eg(e)|0)){h=c[f>>2]|0;i=5}else j=0;else{h=g;i=5}a:do if((i|0)==5){g=e+20|0;f=c[g>>2]|0;k=f;if((h-f|0)>>>0<d>>>0){j=Ea[c[e+36>>2]&7](e,b,d)|0;break}b:do if((a[e+75>>0]|0)<0|(d|0)==0){l=0;m=b;n=d;o=k}else{f=d;while(1){p=f+-1|0;if((a[b+p>>0]|0)==10)break;if(!p){l=0;m=b;n=d;o=k;break b}else f=p}p=Ea[c[e+36>>2]&7](e,b,f)|0;if(p>>>0<f>>>0){j=p;break a}l=f;m=b+f|0;n=d-f|0;o=c[g>>2]|0}while(0);fi(o|0,m|0,n|0)|0;c[g>>2]=(c[g>>2]|0)+n;j=l+n|0}while(0);return j|0}function gg(a,b){a=a|0;b=b|0;var d=0;if(!b)d=0;else d=hg(c[b>>2]|0,c[b+4>>2]|0,a)|0;return ((d|0)==0?a:d)|0}function hg(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0;f=(c[b>>2]|0)+1794895138|0;g=ig(c[b+8>>2]|0,f)|0;h=ig(c[b+12>>2]|0,f)|0;i=ig(c[b+16>>2]|0,f)|0;a:do if((g>>>0<d>>>2>>>0?(j=d-(g<<2)|0,h>>>0<j>>>0&i>>>0<j>>>0):0)?((i|h)&3|0)==0:0){j=h>>>2;k=i>>>2;l=0;m=g;while(1){n=m>>>1;o=l+n|0;p=o<<1;q=p+j|0;r=ig(c[b+(q<<2)>>2]|0,f)|0;s=ig(c[b+(q+1<<2)>>2]|0,f)|0;if(!(s>>>0<d>>>0&r>>>0<(d-s|0)>>>0)){t=0;break a}if(a[b+(s+r)>>0]|0){t=0;break a}r=Zf(e,b+s|0)|0;if(!r)break;s=(r|0)<0;if((m|0)==1){t=0;break a}l=s?l:o;m=s?n:m-n|0}m=p+k|0;l=ig(c[b+(m<<2)>>2]|0,f)|0;j=ig(c[b+(m+1<<2)>>2]|0,f)|0;if(j>>>0<d>>>0&l>>>0<(d-j|0)>>>0)t=(a[b+(j+l)>>0]|0)==0?b+j|0:0;else t=0}else t=0;while(0);return t|0}function ig(a,b){a=a|0;b=b|0;var c=0;c=ei(a|0)|0;return ((b|0)==0?a:c)|0}function jg(){ca(13420);return 13428}function kg(){ja(13420);return}function lg(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0;do if(a){if((c[a+76>>2]|0)<=-1){b=mg(a)|0;break}d=(cg(a)|0)==0;e=mg(a)|0;if(d)b=e;else{bg(a);b=e}}else{if(!(c[1329]|0))f=0;else f=lg(c[1329]|0)|0;e=c[(jg()|0)>>2]|0;if(!e)g=f;else{d=e;e=f;while(1){if((c[d+76>>2]|0)>-1)h=cg(d)|0;else h=0;if((c[d+20>>2]|0)>>>0>(c[d+28>>2]|0)>>>0)i=mg(d)|0|e;else i=e;if(h|0)bg(d);d=c[d+56>>2]|0;if(!d){g=i;break}else e=i}}kg();b=g}while(0);return b|0}function mg(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0;b=a+20|0;d=a+28|0;if((c[b>>2]|0)>>>0>(c[d>>2]|0)>>>0?(Ea[c[a+36>>2]&7](a,0,0)|0,(c[b>>2]|0)==0):0)e=-1;else{f=a+4|0;g=c[f>>2]|0;h=a+8|0;i=c[h>>2]|0;if(g>>>0<i>>>0)Ea[c[a+40>>2]&7](a,g-i|0,1)|0;c[a+16>>2]=0;c[d>>2]=0;c[b>>2]=0;c[h>>2]=0;c[f>>2]=0;e=0}return e|0}function ng(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,u=0,v=0,w=0,x=0,y=0;f=d&255;g=(e|0)!=0;a:do if(g&(b&3|0)!=0){h=d&255;i=b;j=e;while(1){if((a[i>>0]|0)==h<<24>>24){k=i;l=j;m=6;break a}n=i+1|0;o=j+-1|0;p=(o|0)!=0;if(p&(n&3|0)!=0){i=n;j=o}else{q=n;r=o;s=p;m=5;break}}}else{q=b;r=e;s=g;m=5}while(0);if((m|0)==5)if(s){k=q;l=r;m=6}else m=16;b:do if((m|0)==6){r=d&255;if((a[k>>0]|0)==r<<24>>24)if(!l){m=16;break}else{u=k;break}q=t(f,16843009)|0;c:do if(l>>>0>3){s=k;g=l;while(1){e=c[s>>2]^q;if((e&-2139062144^-2139062144)&e+-16843009|0){v=g;w=s;break c}e=s+4|0;b=g+-4|0;if(b>>>0>3){s=e;g=b}else{x=e;y=b;m=11;break}}}else{x=k;y=l;m=11}while(0);if((m|0)==11)if(!y){m=16;break}else{v=y;w=x}q=w;g=v;while(1){if((a[q>>0]|0)==r<<24>>24){u=q;break b}g=g+-1|0;if(!g){m=16;break}else q=q+1|0}}while(0);if((m|0)==16)u=0;return u|0}function og(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0;f=za;za=za+224|0;if((za|0)>=(Aa|0))y(224);g=f+208|0;h=f+160|0;i=f+80|0;j=f;k=h;l=k+40|0;do{c[k>>2]=0;k=k+4|0}while((k|0)<(l|0));c[g>>2]=c[e>>2];if((pg(0,d,g,i,h)|0)<0)m=-1;else{if((c[b+76>>2]|0)>-1)n=cg(b)|0;else n=0;e=c[b>>2]|0;k=e&32;if((a[b+74>>0]|0)<1)c[b>>2]=e&-33;e=b+48|0;if(!(c[e>>2]|0)){l=b+44|0;o=c[l>>2]|0;c[l>>2]=j;p=b+28|0;c[p>>2]=j;q=b+20|0;c[q>>2]=j;c[e>>2]=80;r=b+16|0;c[r>>2]=j+80;j=pg(b,d,g,i,h)|0;if(!o)s=j;else{Ea[c[b+36>>2]&7](b,0,0)|0;t=(c[q>>2]|0)==0?-1:j;c[l>>2]=o;c[e>>2]=0;c[r>>2]=0;c[p>>2]=0;c[q>>2]=0;s=t}}else s=pg(b,d,g,i,h)|0;h=c[b>>2]|0;c[b>>2]=h|k;if(n|0)bg(b);m=(h&32|0)==0?s:-1}za=f;return m|0}function pg(d,e,f,h,i){d=d|0;e=e|0;f=f|0;h=h|0;i=i|0;var j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ba=0,ca=0,da=0,ea=0,fa=0,ga=0,ha=0,ia=0,ja=0,ka=0,la=0,ma=0,na=0,oa=0,pa=0,qa=0,ra=0,sa=0,ta=0,ua=0,va=0,wa=0,xa=0,ya=0,Ba=0,Ca=0,Da=0,Ea=0,Fa=0;j=za;za=za+64|0;if((za|0)>=(Aa|0))y(64);k=j+56|0;l=j+40|0;m=j;n=j+48|0;o=j+60|0;c[k>>2]=e;e=(d|0)!=0;p=m+40|0;q=p;r=m+39|0;m=n+4|0;s=0;t=0;u=0;a:while(1){v=s;w=t;while(1){do if((w|0)>-1)if((v|0)>(2147483647-w|0)){c[(Uf()|0)>>2]=75;z=-1;break}else{z=v+w|0;break}else z=w;while(0);A=c[k>>2]|0;B=a[A>>0]|0;if(!(B<<24>>24)){C=94;break a}D=B;B=A;b:while(1){switch(D<<24>>24){case 37:{C=10;break b;break}case 0:{E=B;break b;break}default:{}}F=B+1|0;c[k>>2]=F;D=a[F>>0]|0;B=F}c:do if((C|0)==10){C=0;D=B;F=B;while(1){if((a[F+1>>0]|0)!=37){E=D;break c}G=D+1|0;F=F+2|0;c[k>>2]=F;if((a[F>>0]|0)!=37){E=G;break}else D=G}}while(0);v=E-A|0;if(e)qg(d,A,v);if(!v)break;else w=z}w=(Xf(a[(c[k>>2]|0)+1>>0]|0)|0)==0;v=c[k>>2]|0;if(!w?(a[v+2>>0]|0)==36:0){H=(a[v+1>>0]|0)+-48|0;I=1;J=3}else{H=-1;I=u;J=1}w=v+J|0;c[k>>2]=w;v=a[w>>0]|0;B=(v<<24>>24)+-32|0;if(B>>>0>31|(1<<B&75913|0)==0){K=0;L=v;M=w}else{v=0;D=B;B=w;while(1){w=1<<D|v;F=B+1|0;c[k>>2]=F;G=a[F>>0]|0;D=(G<<24>>24)+-32|0;if(D>>>0>31|(1<<D&75913|0)==0){K=w;L=G;M=F;break}else{v=w;B=F}}}if(L<<24>>24==42){if((Xf(a[M+1>>0]|0)|0)!=0?(B=c[k>>2]|0,(a[B+2>>0]|0)==36):0){v=B+1|0;c[i+((a[v>>0]|0)+-48<<2)>>2]=10;N=c[h+((a[v>>0]|0)+-48<<3)>>2]|0;O=1;P=B+3|0}else{if(I|0){Q=-1;break}if(e){B=(c[f>>2]|0)+(4-1)&~(4-1);v=c[B>>2]|0;c[f>>2]=B+4;R=v}else R=0;N=R;O=0;P=(c[k>>2]|0)+1|0}c[k>>2]=P;v=(N|0)<0;S=v?0-N|0:N;T=v?K|8192:K;U=O;V=P}else{v=rg(k)|0;if((v|0)<0){Q=-1;break}S=v;T=K;U=I;V=c[k>>2]|0}do if((a[V>>0]|0)==46){v=V+1|0;if((a[v>>0]|0)!=42){c[k>>2]=v;v=rg(k)|0;W=v;X=c[k>>2]|0;break}if(Xf(a[V+2>>0]|0)|0?(v=c[k>>2]|0,(a[v+3>>0]|0)==36):0){B=v+2|0;c[i+((a[B>>0]|0)+-48<<2)>>2]=10;D=c[h+((a[B>>0]|0)+-48<<3)>>2]|0;B=v+4|0;c[k>>2]=B;W=D;X=B;break}if(U|0){Q=-1;break a}if(e){B=(c[f>>2]|0)+(4-1)&~(4-1);D=c[B>>2]|0;c[f>>2]=B+4;Y=D}else Y=0;D=(c[k>>2]|0)+2|0;c[k>>2]=D;W=Y;X=D}else{W=-1;X=V}while(0);D=0;B=X;while(1){if(((a[B>>0]|0)+-65|0)>>>0>57){Q=-1;break a}v=B;B=B+1|0;c[k>>2]=B;Z=a[(a[v>>0]|0)+-65+(16+(D*58|0))>>0]|0;_=Z&255;if((_+-1|0)>>>0>=8)break;else D=_}if(!(Z<<24>>24)){Q=-1;break}v=(H|0)>-1;do if(Z<<24>>24==19)if(v){Q=-1;break a}else C=54;else{if(v){c[i+(H<<2)>>2]=_;F=h+(H<<3)|0;w=c[F+4>>2]|0;G=l;c[G>>2]=c[F>>2];c[G+4>>2]=w;C=54;break}if(!e){Q=0;break a}sg(l,_,f);$=c[k>>2]|0;C=55}while(0);if((C|0)==54){C=0;if(e){$=B;C=55}else aa=0}d:do if((C|0)==55){C=0;v=a[$+-1>>0]|0;w=(D|0)!=0&(v&15|0)==3?v&-33:v;v=T&-65537;G=(T&8192|0)==0?T:v;e:do switch(w|0){case 110:{switch((D&255)<<24>>24){case 0:{c[c[l>>2]>>2]=z;aa=0;break d;break}case 1:{c[c[l>>2]>>2]=z;aa=0;break d;break}case 2:{F=c[l>>2]|0;c[F>>2]=z;c[F+4>>2]=((z|0)<0)<<31>>31;aa=0;break d;break}case 3:{b[c[l>>2]>>1]=z;aa=0;break d;break}case 4:{a[c[l>>2]>>0]=z;aa=0;break d;break}case 6:{c[c[l>>2]>>2]=z;aa=0;break d;break}case 7:{F=c[l>>2]|0;c[F>>2]=z;c[F+4>>2]=((z|0)<0)<<31>>31;aa=0;break d;break}default:{aa=0;break d}}break}case 112:{ba=120;ca=W>>>0>8?W:8;da=G|8;C=67;break}case 88:case 120:{ba=w;ca=W;da=G;C=67;break}case 111:{F=l;ea=c[F>>2]|0;fa=c[F+4>>2]|0;F=ug(ea,fa,p)|0;ga=q-F|0;ha=F;ia=0;ja=11474;ka=(G&8|0)==0|(W|0)>(ga|0)?W:ga+1|0;la=G;ma=ea;na=fa;C=73;break}case 105:case 100:{fa=l;ea=c[fa>>2]|0;ga=c[fa+4>>2]|0;if((ga|0)<0){fa=_h(0,0,ea|0,ga|0)|0;F=x()|0;oa=l;c[oa>>2]=fa;c[oa+4>>2]=F;pa=1;qa=11474;ra=fa;sa=F;C=72;break e}else{pa=(G&2049|0)!=0&1;qa=(G&2048|0)==0?((G&1|0)==0?11474:11476):11475;ra=ea;sa=ga;C=72;break e}break}case 117:{ga=l;pa=0;qa=11474;ra=c[ga>>2]|0;sa=c[ga+4>>2]|0;C=72;break}case 99:{a[r>>0]=c[l>>2];ta=r;ua=0;va=11474;wa=1;xa=v;ya=q;break}case 109:{Ba=wg(c[(Uf()|0)>>2]|0)|0;C=77;break}case 115:{ga=c[l>>2]|0;Ba=(ga|0)==0?11484:ga;C=77;break}case 67:{c[n>>2]=c[l>>2];c[m>>2]=0;c[l>>2]=n;Ca=-1;C=81;break}case 83:{if(!W){xg(d,32,S,0,G);Da=0;C=91}else{Ca=W;C=81}break}case 65:case 71:case 70:case 69:case 97:case 103:case 102:case 101:{aa=zg(d,+g[l>>3],S,W,G,w)|0;break d;break}default:{ta=A;ua=0;va=11474;wa=W;xa=G;ya=q}}while(0);f:do if((C|0)==67){C=0;w=l;ga=c[w>>2]|0;ea=c[w+4>>2]|0;w=tg(ga,ea,p,ba&32)|0;F=(da&8|0)==0|(ga|0)==0&(ea|0)==0;ha=w;ia=F?0:2;ja=F?11474:11474+(ba>>>4)|0;ka=ca;la=da;ma=ga;na=ea;C=73}else if((C|0)==72){C=0;ha=vg(ra,sa,p)|0;ia=pa;ja=qa;ka=W;la=G;ma=ra;na=sa;C=73}else if((C|0)==77){C=0;ea=ng(Ba,0,W)|0;ga=(ea|0)==0;ta=Ba;ua=0;va=11474;wa=ga?W:ea-Ba|0;xa=v;ya=ga?Ba+W|0:ea}else if((C|0)==81){C=0;ea=c[l>>2]|0;ga=0;while(1){F=c[ea>>2]|0;if(!F){Ea=ga;break}w=yg(o,F)|0;Fa=(w|0)<0;if(Fa|w>>>0>(Ca-ga|0)>>>0){C=85;break}F=w+ga|0;if(Ca>>>0>F>>>0){ea=ea+4|0;ga=F}else{Ea=F;break}}if((C|0)==85){C=0;if(Fa){Q=-1;break a}else Ea=ga}xg(d,32,S,Ea,G);if(!Ea){Da=0;C=91}else{ea=c[l>>2]|0;F=0;while(1){w=c[ea>>2]|0;if(!w){Da=Ea;C=91;break f}fa=yg(o,w)|0;F=fa+F|0;if((F|0)>(Ea|0)){Da=Ea;C=91;break f}qg(d,o,fa);if(F>>>0>=Ea>>>0){Da=Ea;C=91;break}else ea=ea+4|0}}}while(0);if((C|0)==73){C=0;v=(ma|0)!=0|(na|0)!=0;ea=(ka|0)!=0|v;F=q-ha+((v^1)&1)|0;ta=ea?ha:p;ua=ia;va=ja;wa=ea?((ka|0)>(F|0)?ka:F):0;xa=(ka|0)>-1?la&-65537:la;ya=q}else if((C|0)==91){C=0;xg(d,32,S,Da,G^8192);aa=(S|0)>(Da|0)?S:Da;break}F=ya-ta|0;ea=(wa|0)<(F|0)?F:wa;v=ea+ua|0;ga=(S|0)<(v|0)?v:S;xg(d,32,ga,v,xa);qg(d,va,ua);xg(d,48,ga,v,xa^65536);xg(d,48,ea,F,0);qg(d,ta,F);xg(d,32,ga,v,xa^8192);aa=ga}while(0);s=aa;t=z;u=U}g:do if((C|0)==94)if(!d)if(!u)Q=0;else{U=1;while(1){t=c[i+(U<<2)>>2]|0;if(!t)break;sg(h+(U<<3)|0,t,f);t=U+1|0;if(t>>>0<10)U=t;else{Q=1;break g}}t=U;while(1){if(c[i+(t<<2)>>2]|0){Q=-1;break g}t=t+1|0;if(t>>>0>=10){Q=1;break}}}else Q=z;while(0);za=j;return Q|0}function qg(a,b,d){a=a|0;b=b|0;d=d|0;if(!(c[a>>2]&32))fg(b,d,a)|0;return}function rg(b){b=b|0;var d=0,e=0,f=0,g=0,h=0;if(!(Xf(a[c[b>>2]>>0]|0)|0))d=0;else{e=0;while(1){f=c[b>>2]|0;g=(e*10|0)+-48+(a[f>>0]|0)|0;h=f+1|0;c[b>>2]=h;if(!(Xf(a[h>>0]|0)|0)){d=g;break}else e=g}}return d|0}function sg(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,h=0,i=0,j=0.0;a:do if(b>>>0<=20)do switch(b|0){case 9:{e=(c[d>>2]|0)+(4-1)&~(4-1);f=c[e>>2]|0;c[d>>2]=e+4;c[a>>2]=f;break a;break}case 10:{f=(c[d>>2]|0)+(4-1)&~(4-1);e=c[f>>2]|0;c[d>>2]=f+4;f=a;c[f>>2]=e;c[f+4>>2]=((e|0)<0)<<31>>31;break a;break}case 11:{e=(c[d>>2]|0)+(4-1)&~(4-1);f=c[e>>2]|0;c[d>>2]=e+4;e=a;c[e>>2]=f;c[e+4>>2]=0;break a;break}case 12:{e=(c[d>>2]|0)+(8-1)&~(8-1);f=e;h=c[f>>2]|0;i=c[f+4>>2]|0;c[d>>2]=e+8;e=a;c[e>>2]=h;c[e+4>>2]=i;break a;break}case 13:{i=(c[d>>2]|0)+(4-1)&~(4-1);e=c[i>>2]|0;c[d>>2]=i+4;i=(e&65535)<<16>>16;e=a;c[e>>2]=i;c[e+4>>2]=((i|0)<0)<<31>>31;break a;break}case 14:{i=(c[d>>2]|0)+(4-1)&~(4-1);e=c[i>>2]|0;c[d>>2]=i+4;i=a;c[i>>2]=e&65535;c[i+4>>2]=0;break a;break}case 15:{i=(c[d>>2]|0)+(4-1)&~(4-1);e=c[i>>2]|0;c[d>>2]=i+4;i=(e&255)<<24>>24;e=a;c[e>>2]=i;c[e+4>>2]=((i|0)<0)<<31>>31;break a;break}case 16:{i=(c[d>>2]|0)+(4-1)&~(4-1);e=c[i>>2]|0;c[d>>2]=i+4;i=a;c[i>>2]=e&255;c[i+4>>2]=0;break a;break}case 17:{i=(c[d>>2]|0)+(8-1)&~(8-1);j=+g[i>>3];c[d>>2]=i+8;g[a>>3]=j;break a;break}case 18:{i=(c[d>>2]|0)+(8-1)&~(8-1);j=+g[i>>3];c[d>>2]=i+8;g[a>>3]=j;break a;break}default:break a}while(0);while(0);return}function tg(b,c,e,f){b=b|0;c=c|0;e=e|0;f=f|0;var g=0,h=0;if((b|0)==0&(c|0)==0)g=e;else{h=e;e=c;c=b;while(1){b=h+-1|0;a[b>>0]=d[480+(c&15)>>0]|0|f;c=ci(c|0,e|0,4)|0;e=x()|0;if((c|0)==0&(e|0)==0){g=b;break}else h=b}}return g|0}function ug(b,c,d){b=b|0;c=c|0;d=d|0;var e=0,f=0;if((b|0)==0&(c|0)==0)e=d;else{f=d;d=c;c=b;while(1){b=f+-1|0;a[b>>0]=c&7|48;c=ci(c|0,d|0,3)|0;d=x()|0;if((c|0)==0&(d|0)==0){e=b;break}else f=b}}return e|0}function vg(b,c,d){b=b|0;c=c|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;if(c>>>0>0|(c|0)==0&b>>>0>4294967295){e=d;f=b;g=c;do{c=f;f=bi(f|0,g|0,10,0)|0;h=g;g=x()|0;i=Yh(f|0,g|0,10,0)|0;j=_h(c|0,h|0,i|0,x()|0)|0;x()|0;e=e+-1|0;a[e>>0]=j&255|48}while(h>>>0>9|(h|0)==9&c>>>0>4294967295);k=f;l=e}else{k=b;l=d}if(!k)m=l;else{d=k;k=l;while(1){l=d;d=(d>>>0)/10|0;b=k+-1|0;a[b>>0]=l-(d*10|0)|48;if(l>>>0<10){m=b;break}else k=b}}return m|0}function wg(a){a=a|0;return Gg(a,c[(Fg()|0)+188>>2]|0)|0}function xg(a,b,c,d,e){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;var f=0,g=0,h=0;f=za;za=za+256|0;if((za|0)>=(Aa|0))y(256);g=f;if((c|0)>(d|0)&(e&73728|0)==0){e=c-d|0;gi(g|0,b<<24>>24|0,(e>>>0<256?e:256)|0)|0;if(e>>>0>255){b=c-d|0;d=e;do{qg(a,g,256);d=d+-256|0}while(d>>>0>255);h=b&255}else h=e;qg(a,g,h)}za=f;return}function yg(a,b){a=a|0;b=b|0;var c=0;if(!a)c=0;else c=Dg(a,b,0)|0;return c|0}function zg(b,e,f,g,h,i){b=b|0;e=+e;f=f|0;g=g|0;h=h|0;i=i|0;var j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0.0,u=0,v=0.0,w=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0.0,H=0,I=0,J=0,K=0.0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0.0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ba=0,ca=0,da=0,ea=0,fa=0,ga=0,ha=0,ia=0.0,ja=0.0,ka=0,la=0,ma=0,na=0,oa=0,pa=0,qa=0,ra=0,sa=0,ta=0,ua=0,va=0,wa=0,xa=0,ya=0,Ba=0,Ca=0,Da=0,Ea=0,Fa=0,Ga=0,Ha=0,Ia=0,Ja=0,Ka=0;j=za;za=za+560|0;if((za|0)>=(Aa|0))y(560);k=j+32|0;l=j+536|0;m=j;n=m;o=j+540|0;c[l>>2]=0;p=o+12|0;q=Ag(e)|0;r=x()|0;if((r|0)<0){s=-e;u=Ag(s)|0;v=s;w=1;z=11491;A=x()|0;B=u}else{v=e;w=(h&2049|0)!=0&1;z=(h&2048|0)==0?((h&1|0)==0?11492:11497):11494;A=r;B=q}do if(0==0&(A&2146435072|0)==2146435072){q=(i&32|0)!=0;B=w+3|0;xg(b,32,f,B,h&-65537);qg(b,z,w);qg(b,v!=v|0.0!=0.0?(q?11518:11522):q?11510:11514,3);xg(b,32,f,B,h^8192);C=B}else{e=+Bg(v,l)*2.0;B=e!=0.0;if(B)c[l>>2]=(c[l>>2]|0)+-1;q=i|32;if((q|0)==97){r=i&32;u=(r|0)==0?z:z+9|0;D=w|2;E=12-g|0;do if(!(g>>>0>11|(E|0)==0)){s=8.0;F=E;do{F=F+-1|0;s=s*16.0}while((F|0)!=0);if((a[u>>0]|0)==45){G=-(s+(-e-s));break}else{G=e+s-s;break}}else G=e;while(0);E=c[l>>2]|0;F=(E|0)<0?0-E|0:E;H=vg(F,((F|0)<0)<<31>>31,p)|0;if((H|0)==(p|0)){F=o+11|0;a[F>>0]=48;I=F}else I=H;a[I+-1>>0]=(E>>31&2)+43;E=I+-2|0;a[E>>0]=i+15;H=(g|0)<1;F=(h&8|0)==0;J=m;K=G;while(1){L=~~K;M=J+1|0;a[J>>0]=r|d[480+L>>0];K=(K-+(L|0))*16.0;if((M-n|0)==1?!(F&(H&K==0.0)):0){a[M>>0]=46;N=J+2|0}else N=M;if(!(K!=0.0))break;else J=N}J=N;if((g|0)!=0?(-2-n+J|0)<(g|0):0){H=p;F=E;O=g+2+H-F|0;P=H;Q=F}else{F=p;H=E;O=F-n-H+J|0;P=F;Q=H}H=O+D|0;xg(b,32,f,H,h);qg(b,u,D);xg(b,48,f,H,h^65536);F=J-n|0;qg(b,m,F);J=P-Q|0;xg(b,48,O-(F+J)|0,0,0);qg(b,E,J);xg(b,32,f,H,h^8192);C=H;break}H=(g|0)<0?6:g;if(B){J=(c[l>>2]|0)+-28|0;c[l>>2]=J;R=e*268435456.0;S=J}else{R=e;S=c[l>>2]|0}J=(S|0)<0?k:k+288|0;F=J;K=R;do{r=~~K>>>0;c[F>>2]=r;F=F+4|0;K=(K-+(r>>>0))*1.0e9}while(K!=0.0);B=J;if((S|0)>0){E=J;D=F;u=S;while(1){r=(u|0)<29?u:29;M=D+-4|0;if(M>>>0>=E>>>0){L=M;M=0;do{T=di(c[L>>2]|0,0,r|0)|0;U=Zh(T|0,x()|0,M|0,0)|0;T=x()|0;M=bi(U|0,T|0,1e9,0)|0;V=Yh(M|0,x()|0,1e9,0)|0;W=_h(U|0,T|0,V|0,x()|0)|0;x()|0;c[L>>2]=W;L=L+-4|0}while(L>>>0>=E>>>0);if(M){L=E+-4|0;c[L>>2]=M;X=L}else X=E}else X=E;a:do if(D>>>0>X>>>0){L=D;while(1){W=L+-4|0;if(c[W>>2]|0){Y=L;break a}if(W>>>0>X>>>0)L=W;else{Y=W;break}}}else Y=D;while(0);M=(c[l>>2]|0)-r|0;c[l>>2]=M;if((M|0)>0){E=X;D=Y;u=M}else{Z=X;_=Y;$=M;break}}}else{Z=J;_=F;$=S}if(($|0)<0){u=((H+25|0)/9|0)+1|0;D=(q|0)==102;E=Z;M=_;L=$;while(1){W=0-L|0;V=(W|0)<9?W:9;if(E>>>0<M>>>0){W=(1<<V)+-1|0;T=1e9>>>V;U=0;aa=E;do{ba=c[aa>>2]|0;c[aa>>2]=(ba>>>V)+U;U=t(ba&W,T)|0;aa=aa+4|0}while(aa>>>0<M>>>0);aa=(c[E>>2]|0)==0?E+4|0:E;if(!U){ca=M;da=aa}else{c[M>>2]=U;ca=M+4|0;da=aa}}else{ca=M;da=(c[E>>2]|0)==0?E+4|0:E}aa=D?J:da;T=(ca-aa>>2|0)>(u|0)?aa+(u<<2)|0:ca;L=(c[l>>2]|0)+V|0;c[l>>2]=L;if((L|0)>=0){ea=da;fa=T;break}else{E=da;M=T}}}else{ea=Z;fa=_}if(ea>>>0<fa>>>0){M=(B-ea>>2)*9|0;E=c[ea>>2]|0;if(E>>>0<10)ga=M;else{L=M;M=10;while(1){M=M*10|0;u=L+1|0;if(E>>>0<M>>>0){ga=u;break}else L=u}}}else ga=0;L=(q|0)==103;M=(H|0)!=0;E=H-((q|0)==102?0:ga)+((M&L)<<31>>31)|0;if((E|0)<(((fa-B>>2)*9|0)+-9|0)){u=E+9216|0;E=(u|0)/9|0;D=J+4+(E+-1024<<2)|0;F=u-(E*9|0)|0;if((F|0)<8){E=F;F=10;while(1){u=F*10|0;if((E|0)<7){E=E+1|0;F=u}else{ha=u;break}}}else ha=10;F=c[D>>2]|0;E=(F>>>0)/(ha>>>0)|0;q=F-(t(E,ha)|0)|0;u=(D+4|0)==(fa|0);if(!(u&(q|0)==0)){s=(E&1|0)==0?9007199254740992.0:9007199254740994.0;E=ha>>>1;K=q>>>0<E>>>0?.5:u&(q|0)==(E|0)?1.0:1.5;if(!w){ia=K;ja=s}else{E=(a[z>>0]|0)==45;ia=E?-K:K;ja=E?-s:s}E=F-q|0;c[D>>2]=E;if(ja+ia!=ja){q=E+ha|0;c[D>>2]=q;if(q>>>0>999999999){q=D;E=ea;while(1){F=q+-4|0;c[q>>2]=0;if(F>>>0<E>>>0){u=E+-4|0;c[u>>2]=0;ka=u}else ka=E;u=(c[F>>2]|0)+1|0;c[F>>2]=u;if(u>>>0>999999999){q=F;E=ka}else{la=F;ma=ka;break}}}else{la=D;ma=ea}E=(B-ma>>2)*9|0;q=c[ma>>2]|0;if(q>>>0<10){na=la;oa=E;pa=ma}else{F=E;E=10;while(1){E=E*10|0;u=F+1|0;if(q>>>0<E>>>0){na=la;oa=u;pa=ma;break}else F=u}}}else{na=D;oa=ga;pa=ea}}else{na=D;oa=ga;pa=ea}F=na+4|0;qa=oa;ra=fa>>>0>F>>>0?F:fa;sa=pa}else{qa=ga;ra=fa;sa=ea}F=0-qa|0;b:do if(ra>>>0>sa>>>0){E=ra;while(1){q=E+-4|0;if(c[q>>2]|0){ta=E;ua=1;break b}if(q>>>0>sa>>>0)E=q;else{ta=q;ua=0;break}}}else{ta=ra;ua=0}while(0);do if(L){D=H+((M^1)&1)|0;if((D|0)>(qa|0)&(qa|0)>-5){va=i+-1|0;wa=D+-1-qa|0}else{va=i+-2|0;wa=D+-1|0}if(!(h&8)){if(ua?(D=c[ta+-4>>2]|0,(D|0)!=0):0)if(!((D>>>0)%10|0)){E=0;V=10;while(1){V=V*10|0;U=E+1|0;if((D>>>0)%(V>>>0)|0|0){xa=U;break}else E=U}}else xa=0;else xa=9;E=((ta-B>>2)*9|0)+-9|0;if((va|32|0)==102){V=E-xa|0;D=(V|0)>0?V:0;ya=va;Ba=(wa|0)<(D|0)?wa:D;break}else{D=E+qa-xa|0;E=(D|0)>0?D:0;ya=va;Ba=(wa|0)<(E|0)?wa:E;break}}else{ya=va;Ba=wa}}else{ya=i;Ba=H}while(0);H=(Ba|0)!=0;B=H?1:h>>>3&1;M=(ya|32|0)==102;if(M){Ca=0;Da=(qa|0)>0?qa:0}else{L=(qa|0)<0?F:qa;E=vg(L,((L|0)<0)<<31>>31,p)|0;L=p;if((L-E|0)<2){D=E;while(1){V=D+-1|0;a[V>>0]=48;if((L-V|0)<2)D=V;else{Ea=V;break}}}else Ea=E;a[Ea+-1>>0]=(qa>>31&2)+43;D=Ea+-2|0;a[D>>0]=ya;Ca=D;Da=L-D|0}D=w+1+Ba+B+Da|0;xg(b,32,f,D,h);qg(b,z,w);xg(b,48,f,D,h^65536);if(M){F=sa>>>0>J>>>0?J:sa;V=m+9|0;U=V;q=m+8|0;u=F;do{T=vg(c[u>>2]|0,0,V)|0;if((u|0)==(F|0))if((T|0)==(V|0)){a[q>>0]=48;Fa=q}else Fa=T;else if(T>>>0>m>>>0){gi(m|0,48,T-n|0)|0;aa=T;while(1){W=aa+-1|0;if(W>>>0>m>>>0)aa=W;else{Fa=W;break}}}else Fa=T;qg(b,Fa,U-Fa|0);u=u+4|0}while(u>>>0<=J>>>0);if(!((h&8|0)==0&(H^1)))qg(b,11526,1);if(u>>>0<ta>>>0&(Ba|0)>0){J=Ba;U=u;while(1){q=vg(c[U>>2]|0,0,V)|0;if(q>>>0>m>>>0){gi(m|0,48,q-n|0)|0;F=q;while(1){M=F+-1|0;if(M>>>0>m>>>0)F=M;else{Ga=M;break}}}else Ga=q;qg(b,Ga,(J|0)<9?J:9);U=U+4|0;F=J+-9|0;if(!(U>>>0<ta>>>0&(J|0)>9)){Ha=F;break}else J=F}}else Ha=Ba;xg(b,48,Ha+9|0,9,0)}else{J=ua?ta:sa+4|0;if(sa>>>0<J>>>0&(Ba|0)>-1){U=m+9|0;V=(h&8|0)==0;u=U;H=0-n|0;F=m+8|0;T=Ba;M=sa;while(1){B=vg(c[M>>2]|0,0,U)|0;if((B|0)==(U|0)){a[F>>0]=48;Ia=F}else Ia=B;do if((M|0)==(sa|0)){B=Ia+1|0;qg(b,Ia,1);if(V&(T|0)<1){Ja=B;break}qg(b,11526,1);Ja=B}else{if(Ia>>>0<=m>>>0){Ja=Ia;break}gi(m|0,48,Ia+H|0)|0;B=Ia;while(1){L=B+-1|0;if(L>>>0>m>>>0)B=L;else{Ja=L;break}}}while(0);q=u-Ja|0;qg(b,Ja,(T|0)>(q|0)?q:T);B=T-q|0;M=M+4|0;if(!(M>>>0<J>>>0&(B|0)>-1)){Ka=B;break}else T=B}}else Ka=Ba;xg(b,48,Ka+18|0,18,0);qg(b,Ca,p-Ca|0)}xg(b,32,f,D,h^8192);C=D}while(0);za=j;return ((C|0)<(f|0)?f:C)|0}function Ag(a){a=+a;var b=0;g[h>>3]=a;b=c[h>>2]|0;w(c[h+4>>2]|0);return b|0}function Bg(a,b){a=+a;b=b|0;return +(+Cg(a,b))}function Cg(a,b){a=+a;b=b|0;var d=0,e=0,f=0,i=0.0,j=0.0,k=0,l=0.0;g[h>>3]=a;d=c[h>>2]|0;e=c[h+4>>2]|0;f=ci(d|0,e|0,52)|0;x()|0;switch(f&2047){case 0:{if(a!=0.0){i=+Cg(a*18446744073709551616.0,b);j=i;k=(c[b>>2]|0)+-64|0}else{j=a;k=0}c[b>>2]=k;l=j;break}case 2047:{l=a;break}default:{c[b>>2]=(f&2047)+-1022;c[h>>2]=d;c[h+4>>2]=e&-2146435073|1071644672;l=+g[h>>3]}}return +l}function Dg(b,d,e){b=b|0;d=d|0;e=e|0;var f=0;do if(b){if(d>>>0<128){a[b>>0]=d;f=1;break}if(!(c[c[(Eg()|0)+188>>2]>>2]|0))if((d&-128|0)==57216){a[b>>0]=d;f=1;break}else{c[(Uf()|0)>>2]=84;f=-1;break}if(d>>>0<2048){a[b>>0]=d>>>6|192;a[b+1>>0]=d&63|128;f=2;break}if(d>>>0<55296|(d&-8192|0)==57344){a[b>>0]=d>>>12|224;a[b+1>>0]=d>>>6&63|128;a[b+2>>0]=d&63|128;f=3;break}if((d+-65536|0)>>>0<1048576){a[b>>0]=d>>>18|240;a[b+1>>0]=d>>>12&63|128;a[b+2>>0]=d>>>6&63|128;a[b+3>>0]=d&63|128;f=4;break}else{c[(Uf()|0)>>2]=84;f=-1;break}}else f=1;while(0);return f|0}function Eg(){return Yf()|0}function Fg(){return Yf()|0}function Gg(b,e){b=b|0;e=e|0;var f=0,g=0,h=0,i=0,j=0;f=0;while(1){if((d[496+f>>0]|0)==(b|0)){g=4;break}h=f+1|0;if((h|0)==87){i=87;g=5;break}else f=h}if((g|0)==4)if(!f)j=592;else{i=f;g=5}if((g|0)==5){g=592;f=i;while(1){i=g;do{b=i;i=i+1|0}while((a[b>>0]|0)!=0);f=f+-1|0;if(!f){j=i;break}else g=i}}return Hg(j,c[e+20>>2]|0)|0}function Hg(a,b){a=a|0;b=b|0;return gg(a,b)|0}function Ig(b,c,d){b=b|0;c=c|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0;a:do if(!d)e=0;else{f=b;g=d;h=c;while(1){i=a[f>>0]|0;j=a[h>>0]|0;if(i<<24>>24!=j<<24>>24)break;g=g+-1|0;if(!g){e=0;break a}else{f=f+1|0;h=h+1|0}}e=(i&255)-(j&255)|0}while(0);return e|0}function Jg(a,b){a=a|0;b=b|0;var d=0,e=0;d=za;za=za+16|0;if((za|0)>=(Aa|0))y(16);e=d;c[e>>2]=b;b=og(c[1297]|0,a,e)|0;za=d;return b|0}function Kg(b,d){b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0;if((c[d+76>>2]|0)>=0?(cg(d)|0)!=0:0){e=b&255;f=b&255;if((f|0)!=(a[d+75>>0]|0)?(g=d+20|0,h=c[g>>2]|0,h>>>0<(c[d+16>>2]|0)>>>0):0){c[g>>2]=h+1;a[h>>0]=e;i=f}else i=dg(d,b)|0;bg(d);j=i}else k=3;do if((k|0)==3){i=b&255;f=b&255;if((f|0)!=(a[d+75>>0]|0)?(e=d+20|0,h=c[e>>2]|0,h>>>0<(c[d+16>>2]|0)>>>0):0){c[e>>2]=h+1;a[h>>0]=i;j=f;break}j=dg(d,b)|0}while(0);return j|0}function Lg(b){b=b|0;var d=0,e=0,f=0,g=0,h=0;d=c[1297]|0;if((c[d+76>>2]|0)>-1)e=cg(d)|0;else e=0;do if(($f(b,d)|0)<0)f=-1;else{if((a[d+75>>0]|0)!=10?(g=d+20|0,h=c[g>>2]|0,h>>>0<(c[d+16>>2]|0)>>>0):0){c[g>>2]=h+1;a[h>>0]=10;f=0;break}f=(dg(d,10)|0)>>31}while(0);if(e|0)bg(d);return f|0}
function Mg(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ba=0,ca=0,da=0,ea=0,fa=0,ga=0,ha=0,ia=0,ja=0,ka=0,la=0,ma=0,na=0,oa=0,pa=0,qa=0,ra=0,sa=0,ta=0,ua=0,va=0,wa=0,xa=0,ya=0,Ba=0,Ca=0,Da=0,Ea=0,Fa=0,Ga=0,Ha=0,Ia=0,Ja=0,Ka=0,La=0;b=za;za=za+16|0;if((za|0)>=(Aa|0))y(16);d=b;do if(a>>>0<245){e=a>>>0<11?16:a+11&-8;f=e>>>3;g=c[3358]|0;h=g>>>f;if(h&3|0){i=(h&1^1)+f|0;j=13472+(i<<1<<2)|0;k=j+8|0;l=c[k>>2]|0;m=l+8|0;n=c[m>>2]|0;if((n|0)==(j|0))c[3358]=g&~(1<<i);else{c[n+12>>2]=j;c[k>>2]=n}n=i<<3;c[l+4>>2]=n|3;i=l+n+4|0;c[i>>2]=c[i>>2]|1;o=m;za=b;return o|0}m=c[3360]|0;if(e>>>0>m>>>0){if(h|0){i=2<<f;n=h<<f&(i|0-i);i=(n&0-n)+-1|0;n=i>>>12&16;f=i>>>n;i=f>>>5&8;h=f>>>i;f=h>>>2&4;l=h>>>f;h=l>>>1&2;k=l>>>h;l=k>>>1&1;j=(i|n|f|h|l)+(k>>>l)|0;l=13472+(j<<1<<2)|0;k=l+8|0;h=c[k>>2]|0;f=h+8|0;n=c[f>>2]|0;if((n|0)==(l|0)){i=g&~(1<<j);c[3358]=i;p=i}else{c[n+12>>2]=l;c[k>>2]=n;p=g}n=j<<3;j=n-e|0;c[h+4>>2]=e|3;k=h+e|0;c[k+4>>2]=j|1;c[h+n>>2]=j;if(m|0){n=c[3363]|0;h=m>>>3;l=13472+(h<<1<<2)|0;i=1<<h;if(!(p&i)){c[3358]=p|i;q=l;r=l+8|0}else{i=l+8|0;q=c[i>>2]|0;r=i}c[r>>2]=n;c[q+12>>2]=n;c[n+8>>2]=q;c[n+12>>2]=l}c[3360]=j;c[3363]=k;o=f;za=b;return o|0}f=c[3359]|0;if(f){k=(f&0-f)+-1|0;j=k>>>12&16;l=k>>>j;k=l>>>5&8;n=l>>>k;l=n>>>2&4;i=n>>>l;n=i>>>1&2;h=i>>>n;i=h>>>1&1;s=c[13736+((k|j|l|n|i)+(h>>>i)<<2)>>2]|0;i=s;h=s;n=(c[s+4>>2]&-8)-e|0;while(1){s=c[i+16>>2]|0;if(!s){l=c[i+20>>2]|0;if(!l)break;else t=l}else t=s;s=(c[t+4>>2]&-8)-e|0;l=s>>>0<n>>>0;i=t;h=l?t:h;n=l?s:n}i=h+e|0;if(i>>>0>h>>>0){s=c[h+24>>2]|0;l=c[h+12>>2]|0;do if((l|0)==(h|0)){j=h+20|0;k=c[j>>2]|0;if(!k){u=h+16|0;v=c[u>>2]|0;if(!v){w=0;break}else{x=v;z=u}}else{x=k;z=j}j=x;k=z;while(1){u=j+20|0;v=c[u>>2]|0;if(!v){A=j+16|0;B=c[A>>2]|0;if(!B)break;else{C=B;D=A}}else{C=v;D=u}j=C;k=D}c[k>>2]=0;w=j}else{u=c[h+8>>2]|0;c[u+12>>2]=l;c[l+8>>2]=u;w=l}while(0);do if(s|0){l=c[h+28>>2]|0;u=13736+(l<<2)|0;if((h|0)==(c[u>>2]|0)){c[u>>2]=w;if(!w){c[3359]=f&~(1<<l);break}}else{l=s+16|0;c[((c[l>>2]|0)==(h|0)?l:s+20|0)>>2]=w;if(!w)break}c[w+24>>2]=s;l=c[h+16>>2]|0;if(l|0){c[w+16>>2]=l;c[l+24>>2]=w}l=c[h+20>>2]|0;if(l|0){c[w+20>>2]=l;c[l+24>>2]=w}}while(0);if(n>>>0<16){s=n+e|0;c[h+4>>2]=s|3;f=h+s+4|0;c[f>>2]=c[f>>2]|1}else{c[h+4>>2]=e|3;c[i+4>>2]=n|1;c[i+n>>2]=n;if(m|0){f=c[3363]|0;s=m>>>3;l=13472+(s<<1<<2)|0;u=1<<s;if(!(u&g)){c[3358]=u|g;E=l;F=l+8|0}else{u=l+8|0;E=c[u>>2]|0;F=u}c[F>>2]=f;c[E+12>>2]=f;c[f+8>>2]=E;c[f+12>>2]=l}c[3360]=n;c[3363]=i}o=h+8|0;za=b;return o|0}else G=e}else G=e}else G=e}else if(a>>>0<=4294967231){l=a+11|0;f=l&-8;u=c[3359]|0;if(u){s=0-f|0;v=l>>>8;if(v)if(f>>>0>16777215)H=31;else{l=(v+1048320|0)>>>16&8;A=v<<l;v=(A+520192|0)>>>16&4;B=A<<v;A=(B+245760|0)>>>16&2;I=14-(v|l|A)+(B<<A>>>15)|0;H=f>>>(I+7|0)&1|I<<1}else H=0;I=c[13736+(H<<2)>>2]|0;a:do if(!I){J=0;K=0;L=s;M=61}else{A=0;B=s;l=I;v=f<<((H|0)==31?0:25-(H>>>1)|0);N=0;while(1){O=(c[l+4>>2]&-8)-f|0;if(O>>>0<B>>>0)if(!O){P=l;Q=0;R=l;M=65;break a}else{S=l;T=O}else{S=A;T=B}O=c[l+20>>2]|0;l=c[l+16+(v>>>31<<2)>>2]|0;U=(O|0)==0|(O|0)==(l|0)?N:O;if(!l){J=U;K=S;L=T;M=61;break}else{A=S;B=T;v=v<<1;N=U}}}while(0);if((M|0)==61){if((J|0)==0&(K|0)==0){I=2<<H;s=(I|0-I)&u;if(!s){G=f;break}I=(s&0-s)+-1|0;s=I>>>12&16;e=I>>>s;I=e>>>5&8;h=e>>>I;e=h>>>2&4;i=h>>>e;h=i>>>1&2;n=i>>>h;i=n>>>1&1;V=0;W=c[13736+((I|s|e|h|i)+(n>>>i)<<2)>>2]|0}else{V=K;W=J}if(!W){X=V;Y=L}else{P=V;Q=L;R=W;M=65}}if((M|0)==65){i=P;n=Q;h=R;while(1){e=(c[h+4>>2]&-8)-f|0;s=e>>>0<n>>>0;I=s?e:n;e=s?h:i;s=c[h+16>>2]|0;if(!s)Z=c[h+20>>2]|0;else Z=s;if(!Z){X=e;Y=I;break}else{i=e;n=I;h=Z}}}if(((X|0)!=0?Y>>>0<((c[3360]|0)-f|0)>>>0:0)?(h=X+f|0,h>>>0>X>>>0):0){n=c[X+24>>2]|0;i=c[X+12>>2]|0;do if((i|0)==(X|0)){I=X+20|0;e=c[I>>2]|0;if(!e){s=X+16|0;g=c[s>>2]|0;if(!g){_=0;break}else{$=g;aa=s}}else{$=e;aa=I}I=$;e=aa;while(1){s=I+20|0;g=c[s>>2]|0;if(!g){m=I+16|0;N=c[m>>2]|0;if(!N)break;else{ba=N;ca=m}}else{ba=g;ca=s}I=ba;e=ca}c[e>>2]=0;_=I}else{s=c[X+8>>2]|0;c[s+12>>2]=i;c[i+8>>2]=s;_=i}while(0);do if(n){i=c[X+28>>2]|0;s=13736+(i<<2)|0;if((X|0)==(c[s>>2]|0)){c[s>>2]=_;if(!_){s=u&~(1<<i);c[3359]=s;da=s;break}}else{s=n+16|0;c[((c[s>>2]|0)==(X|0)?s:n+20|0)>>2]=_;if(!_){da=u;break}}c[_+24>>2]=n;s=c[X+16>>2]|0;if(s|0){c[_+16>>2]=s;c[s+24>>2]=_}s=c[X+20>>2]|0;if(s){c[_+20>>2]=s;c[s+24>>2]=_;da=u}else da=u}else da=u;while(0);b:do if(Y>>>0<16){u=Y+f|0;c[X+4>>2]=u|3;n=X+u+4|0;c[n>>2]=c[n>>2]|1}else{c[X+4>>2]=f|3;c[h+4>>2]=Y|1;c[h+Y>>2]=Y;n=Y>>>3;if(Y>>>0<256){u=13472+(n<<1<<2)|0;s=c[3358]|0;i=1<<n;if(!(s&i)){c[3358]=s|i;ea=u;fa=u+8|0}else{i=u+8|0;ea=c[i>>2]|0;fa=i}c[fa>>2]=h;c[ea+12>>2]=h;c[h+8>>2]=ea;c[h+12>>2]=u;break}u=Y>>>8;if(u)if(Y>>>0>16777215)ga=31;else{i=(u+1048320|0)>>>16&8;s=u<<i;u=(s+520192|0)>>>16&4;n=s<<u;s=(n+245760|0)>>>16&2;g=14-(u|i|s)+(n<<s>>>15)|0;ga=Y>>>(g+7|0)&1|g<<1}else ga=0;g=13736+(ga<<2)|0;c[h+28>>2]=ga;s=h+16|0;c[s+4>>2]=0;c[s>>2]=0;s=1<<ga;if(!(da&s)){c[3359]=da|s;c[g>>2]=h;c[h+24>>2]=g;c[h+12>>2]=h;c[h+8>>2]=h;break}s=c[g>>2]|0;c:do if((c[s+4>>2]&-8|0)==(Y|0))ha=s;else{g=Y<<((ga|0)==31?0:25-(ga>>>1)|0);n=s;while(1){ia=n+16+(g>>>31<<2)|0;i=c[ia>>2]|0;if(!i)break;if((c[i+4>>2]&-8|0)==(Y|0)){ha=i;break c}else{g=g<<1;n=i}}c[ia>>2]=h;c[h+24>>2]=n;c[h+12>>2]=h;c[h+8>>2]=h;break b}while(0);s=ha+8|0;I=c[s>>2]|0;c[I+12>>2]=h;c[s>>2]=h;c[h+8>>2]=I;c[h+12>>2]=ha;c[h+24>>2]=0}while(0);o=X+8|0;za=b;return o|0}else G=f}else G=f}else G=-1;while(0);X=c[3360]|0;if(X>>>0>=G>>>0){ha=X-G|0;ia=c[3363]|0;if(ha>>>0>15){Y=ia+G|0;c[3363]=Y;c[3360]=ha;c[Y+4>>2]=ha|1;c[ia+X>>2]=ha;c[ia+4>>2]=G|3}else{c[3360]=0;c[3363]=0;c[ia+4>>2]=X|3;ha=ia+X+4|0;c[ha>>2]=c[ha>>2]|1}o=ia+8|0;za=b;return o|0}ia=c[3361]|0;if(ia>>>0>G>>>0){ha=ia-G|0;c[3361]=ha;X=c[3364]|0;Y=X+G|0;c[3364]=Y;c[Y+4>>2]=ha|1;c[X+4>>2]=G|3;o=X+8|0;za=b;return o|0}if(!(c[3476]|0)){c[3478]=4096;c[3477]=4096;c[3479]=-1;c[3480]=-1;c[3481]=0;c[3469]=0;c[3476]=d&-16^1431655768;ja=4096}else ja=c[3478]|0;d=G+48|0;X=G+47|0;ha=ja+X|0;Y=0-ja|0;ja=ha&Y;if(ja>>>0<=G>>>0){o=0;za=b;return o|0}ga=c[3468]|0;if(ga|0?(da=c[3466]|0,ea=da+ja|0,ea>>>0<=da>>>0|ea>>>0>ga>>>0):0){o=0;za=b;return o|0}d:do if(!(c[3469]&4)){ga=c[3364]|0;e:do if(ga){ea=13880;while(1){da=c[ea>>2]|0;if(da>>>0<=ga>>>0?(da+(c[ea+4>>2]|0)|0)>>>0>ga>>>0:0)break;da=c[ea+8>>2]|0;if(!da){M=128;break e}else ea=da}da=ha-ia&Y;if(da>>>0<2147483647){fa=hi(da|0)|0;if((fa|0)==((c[ea>>2]|0)+(c[ea+4>>2]|0)|0))if((fa|0)==(-1|0))ka=da;else{la=da;ma=fa;M=145;break d}else{na=fa;oa=da;M=136}}else ka=0}else M=128;while(0);do if((M|0)==128){ga=hi(0)|0;if((ga|0)!=(-1|0)?(f=ga,da=c[3477]|0,fa=da+-1|0,_=((fa&f|0)==0?0:(fa+f&0-da)-f|0)+ja|0,f=c[3466]|0,da=_+f|0,_>>>0>G>>>0&_>>>0<2147483647):0){fa=c[3468]|0;if(fa|0?da>>>0<=f>>>0|da>>>0>fa>>>0:0){ka=0;break}fa=hi(_|0)|0;if((fa|0)==(ga|0)){la=_;ma=ga;M=145;break d}else{na=fa;oa=_;M=136}}else ka=0}while(0);do if((M|0)==136){_=0-oa|0;if(!(d>>>0>oa>>>0&(oa>>>0<2147483647&(na|0)!=(-1|0))))if((na|0)==(-1|0)){ka=0;break}else{la=oa;ma=na;M=145;break d}fa=c[3478]|0;ga=X-oa+fa&0-fa;if(ga>>>0>=2147483647){la=oa;ma=na;M=145;break d}if((hi(ga|0)|0)==(-1|0)){hi(_|0)|0;ka=0;break}else{la=ga+oa|0;ma=na;M=145;break d}}while(0);c[3469]=c[3469]|4;pa=ka;M=143}else{pa=0;M=143}while(0);if(((M|0)==143?ja>>>0<2147483647:0)?(ka=hi(ja|0)|0,ja=hi(0)|0,na=ja-ka|0,oa=na>>>0>(G+40|0)>>>0,!((ka|0)==(-1|0)|oa^1|ka>>>0<ja>>>0&((ka|0)!=(-1|0)&(ja|0)!=(-1|0))^1)):0){la=oa?na:pa;ma=ka;M=145}if((M|0)==145){ka=(c[3466]|0)+la|0;c[3466]=ka;if(ka>>>0>(c[3467]|0)>>>0)c[3467]=ka;ka=c[3364]|0;f:do if(ka){pa=13880;while(1){qa=c[pa>>2]|0;ra=c[pa+4>>2]|0;if((ma|0)==(qa+ra|0)){M=154;break}na=c[pa+8>>2]|0;if(!na)break;else pa=na}if(((M|0)==154?(na=pa+4|0,(c[pa+12>>2]&8|0)==0):0)?ma>>>0>ka>>>0&qa>>>0<=ka>>>0:0){c[na>>2]=ra+la;na=(c[3361]|0)+la|0;oa=ka+8|0;ja=(oa&7|0)==0?0:0-oa&7;oa=ka+ja|0;X=na-ja|0;c[3364]=oa;c[3361]=X;c[oa+4>>2]=X|1;c[ka+na+4>>2]=40;c[3365]=c[3480];break}if(ma>>>0<(c[3362]|0)>>>0)c[3362]=ma;na=ma+la|0;X=13880;while(1){if((c[X>>2]|0)==(na|0)){M=162;break}oa=c[X+8>>2]|0;if(!oa)break;else X=oa}if((M|0)==162?(c[X+12>>2]&8|0)==0:0){c[X>>2]=ma;pa=X+4|0;c[pa>>2]=(c[pa>>2]|0)+la;pa=ma+8|0;oa=ma+((pa&7|0)==0?0:0-pa&7)|0;pa=na+8|0;ja=na+((pa&7|0)==0?0:0-pa&7)|0;pa=oa+G|0;d=ja-oa-G|0;c[oa+4>>2]=G|3;g:do if((ka|0)==(ja|0)){Y=(c[3361]|0)+d|0;c[3361]=Y;c[3364]=pa;c[pa+4>>2]=Y|1}else{if((c[3363]|0)==(ja|0)){Y=(c[3360]|0)+d|0;c[3360]=Y;c[3363]=pa;c[pa+4>>2]=Y|1;c[pa+Y>>2]=Y;break}Y=c[ja+4>>2]|0;if((Y&3|0)==1){ia=Y&-8;ha=Y>>>3;h:do if(Y>>>0<256){ga=c[ja+8>>2]|0;_=c[ja+12>>2]|0;if((_|0)==(ga|0)){c[3358]=c[3358]&~(1<<ha);break}else{c[ga+12>>2]=_;c[_+8>>2]=ga;break}}else{ga=c[ja+24>>2]|0;_=c[ja+12>>2]|0;do if((_|0)==(ja|0)){fa=ja+16|0;da=fa+4|0;f=c[da>>2]|0;if(!f){ca=c[fa>>2]|0;if(!ca){sa=0;break}else{ta=ca;ua=fa}}else{ta=f;ua=da}da=ta;f=ua;while(1){fa=da+20|0;ca=c[fa>>2]|0;if(!ca){ba=da+16|0;aa=c[ba>>2]|0;if(!aa)break;else{va=aa;wa=ba}}else{va=ca;wa=fa}da=va;f=wa}c[f>>2]=0;sa=da}else{fa=c[ja+8>>2]|0;c[fa+12>>2]=_;c[_+8>>2]=fa;sa=_}while(0);if(!ga)break;_=c[ja+28>>2]|0;n=13736+(_<<2)|0;do if((c[n>>2]|0)!=(ja|0)){fa=ga+16|0;c[((c[fa>>2]|0)==(ja|0)?fa:ga+20|0)>>2]=sa;if(!sa)break h}else{c[n>>2]=sa;if(sa|0)break;c[3359]=c[3359]&~(1<<_);break h}while(0);c[sa+24>>2]=ga;_=ja+16|0;n=c[_>>2]|0;if(n|0){c[sa+16>>2]=n;c[n+24>>2]=sa}n=c[_+4>>2]|0;if(!n)break;c[sa+20>>2]=n;c[n+24>>2]=sa}while(0);xa=ja+ia|0;ya=ia+d|0}else{xa=ja;ya=d}ha=xa+4|0;c[ha>>2]=c[ha>>2]&-2;c[pa+4>>2]=ya|1;c[pa+ya>>2]=ya;ha=ya>>>3;if(ya>>>0<256){Y=13472+(ha<<1<<2)|0;ea=c[3358]|0;n=1<<ha;if(!(ea&n)){c[3358]=ea|n;Ba=Y;Ca=Y+8|0}else{n=Y+8|0;Ba=c[n>>2]|0;Ca=n}c[Ca>>2]=pa;c[Ba+12>>2]=pa;c[pa+8>>2]=Ba;c[pa+12>>2]=Y;break}Y=ya>>>8;do if(!Y)Da=0;else{if(ya>>>0>16777215){Da=31;break}n=(Y+1048320|0)>>>16&8;ea=Y<<n;ha=(ea+520192|0)>>>16&4;_=ea<<ha;ea=(_+245760|0)>>>16&2;fa=14-(ha|n|ea)+(_<<ea>>>15)|0;Da=ya>>>(fa+7|0)&1|fa<<1}while(0);Y=13736+(Da<<2)|0;c[pa+28>>2]=Da;ia=pa+16|0;c[ia+4>>2]=0;c[ia>>2]=0;ia=c[3359]|0;fa=1<<Da;if(!(ia&fa)){c[3359]=ia|fa;c[Y>>2]=pa;c[pa+24>>2]=Y;c[pa+12>>2]=pa;c[pa+8>>2]=pa;break}fa=c[Y>>2]|0;i:do if((c[fa+4>>2]&-8|0)==(ya|0))Ea=fa;else{Y=ya<<((Da|0)==31?0:25-(Da>>>1)|0);ia=fa;while(1){Fa=ia+16+(Y>>>31<<2)|0;ea=c[Fa>>2]|0;if(!ea)break;if((c[ea+4>>2]&-8|0)==(ya|0)){Ea=ea;break i}else{Y=Y<<1;ia=ea}}c[Fa>>2]=pa;c[pa+24>>2]=ia;c[pa+12>>2]=pa;c[pa+8>>2]=pa;break g}while(0);fa=Ea+8|0;Y=c[fa>>2]|0;c[Y+12>>2]=pa;c[fa>>2]=pa;c[pa+8>>2]=Y;c[pa+12>>2]=Ea;c[pa+24>>2]=0}while(0);o=oa+8|0;za=b;return o|0}pa=13880;while(1){d=c[pa>>2]|0;if(d>>>0<=ka>>>0?(Ga=d+(c[pa+4>>2]|0)|0,Ga>>>0>ka>>>0):0)break;pa=c[pa+8>>2]|0}pa=Ga+-47|0;oa=pa+8|0;d=pa+((oa&7|0)==0?0:0-oa&7)|0;oa=ka+16|0;pa=d>>>0<oa>>>0?ka:d;d=pa+8|0;ja=la+-40|0;na=ma+8|0;X=(na&7|0)==0?0:0-na&7;na=ma+X|0;Y=ja-X|0;c[3364]=na;c[3361]=Y;c[na+4>>2]=Y|1;c[ma+ja+4>>2]=40;c[3365]=c[3480];ja=pa+4|0;c[ja>>2]=27;c[d>>2]=c[3470];c[d+4>>2]=c[3471];c[d+8>>2]=c[3472];c[d+12>>2]=c[3473];c[3470]=ma;c[3471]=la;c[3473]=0;c[3472]=d;d=pa+24|0;do{Y=d;d=d+4|0;c[d>>2]=7}while((Y+8|0)>>>0<Ga>>>0);if((pa|0)!=(ka|0)){d=pa-ka|0;c[ja>>2]=c[ja>>2]&-2;c[ka+4>>2]=d|1;c[pa>>2]=d;Y=d>>>3;if(d>>>0<256){na=13472+(Y<<1<<2)|0;X=c[3358]|0;fa=1<<Y;if(!(X&fa)){c[3358]=X|fa;Ha=na;Ia=na+8|0}else{fa=na+8|0;Ha=c[fa>>2]|0;Ia=fa}c[Ia>>2]=ka;c[Ha+12>>2]=ka;c[ka+8>>2]=Ha;c[ka+12>>2]=na;break}na=d>>>8;if(na)if(d>>>0>16777215)Ja=31;else{fa=(na+1048320|0)>>>16&8;X=na<<fa;na=(X+520192|0)>>>16&4;Y=X<<na;X=(Y+245760|0)>>>16&2;ga=14-(na|fa|X)+(Y<<X>>>15)|0;Ja=d>>>(ga+7|0)&1|ga<<1}else Ja=0;ga=13736+(Ja<<2)|0;c[ka+28>>2]=Ja;c[ka+20>>2]=0;c[oa>>2]=0;X=c[3359]|0;Y=1<<Ja;if(!(X&Y)){c[3359]=X|Y;c[ga>>2]=ka;c[ka+24>>2]=ga;c[ka+12>>2]=ka;c[ka+8>>2]=ka;break}Y=c[ga>>2]|0;j:do if((c[Y+4>>2]&-8|0)==(d|0))Ka=Y;else{ga=d<<((Ja|0)==31?0:25-(Ja>>>1)|0);X=Y;while(1){La=X+16+(ga>>>31<<2)|0;fa=c[La>>2]|0;if(!fa)break;if((c[fa+4>>2]&-8|0)==(d|0)){Ka=fa;break j}else{ga=ga<<1;X=fa}}c[La>>2]=ka;c[ka+24>>2]=X;c[ka+12>>2]=ka;c[ka+8>>2]=ka;break f}while(0);d=Ka+8|0;Y=c[d>>2]|0;c[Y+12>>2]=ka;c[d>>2]=ka;c[ka+8>>2]=Y;c[ka+12>>2]=Ka;c[ka+24>>2]=0}}else{Y=c[3362]|0;if((Y|0)==0|ma>>>0<Y>>>0)c[3362]=ma;c[3470]=ma;c[3471]=la;c[3473]=0;c[3367]=c[3476];c[3366]=-1;c[3371]=13472;c[3370]=13472;c[3373]=13480;c[3372]=13480;c[3375]=13488;c[3374]=13488;c[3377]=13496;c[3376]=13496;c[3379]=13504;c[3378]=13504;c[3381]=13512;c[3380]=13512;c[3383]=13520;c[3382]=13520;c[3385]=13528;c[3384]=13528;c[3387]=13536;c[3386]=13536;c[3389]=13544;c[3388]=13544;c[3391]=13552;c[3390]=13552;c[3393]=13560;c[3392]=13560;c[3395]=13568;c[3394]=13568;c[3397]=13576;c[3396]=13576;c[3399]=13584;c[3398]=13584;c[3401]=13592;c[3400]=13592;c[3403]=13600;c[3402]=13600;c[3405]=13608;c[3404]=13608;c[3407]=13616;c[3406]=13616;c[3409]=13624;c[3408]=13624;c[3411]=13632;c[3410]=13632;c[3413]=13640;c[3412]=13640;c[3415]=13648;c[3414]=13648;c[3417]=13656;c[3416]=13656;c[3419]=13664;c[3418]=13664;c[3421]=13672;c[3420]=13672;c[3423]=13680;c[3422]=13680;c[3425]=13688;c[3424]=13688;c[3427]=13696;c[3426]=13696;c[3429]=13704;c[3428]=13704;c[3431]=13712;c[3430]=13712;c[3433]=13720;c[3432]=13720;Y=la+-40|0;d=ma+8|0;oa=(d&7|0)==0?0:0-d&7;d=ma+oa|0;pa=Y-oa|0;c[3364]=d;c[3361]=pa;c[d+4>>2]=pa|1;c[ma+Y+4>>2]=40;c[3365]=c[3480]}while(0);ma=c[3361]|0;if(ma>>>0>G>>>0){la=ma-G|0;c[3361]=la;ma=c[3364]|0;ka=ma+G|0;c[3364]=ka;c[ka+4>>2]=la|1;c[ma+4>>2]=G|3;o=ma+8|0;za=b;return o|0}}c[(Uf()|0)>>2]=12;o=0;za=b;return o|0}function Ng(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0;if(!a)return;b=a+-8|0;d=c[3362]|0;e=c[a+-4>>2]|0;a=e&-8;f=b+a|0;do if(!(e&1)){g=c[b>>2]|0;if(!(e&3))return;h=b+(0-g)|0;i=g+a|0;if(h>>>0<d>>>0)return;if((c[3363]|0)==(h|0)){j=f+4|0;k=c[j>>2]|0;if((k&3|0)!=3){l=h;m=i;n=h;break}c[3360]=i;c[j>>2]=k&-2;c[h+4>>2]=i|1;c[h+i>>2]=i;return}k=g>>>3;if(g>>>0<256){g=c[h+8>>2]|0;j=c[h+12>>2]|0;if((j|0)==(g|0)){c[3358]=c[3358]&~(1<<k);l=h;m=i;n=h;break}else{c[g+12>>2]=j;c[j+8>>2]=g;l=h;m=i;n=h;break}}g=c[h+24>>2]|0;j=c[h+12>>2]|0;do if((j|0)==(h|0)){k=h+16|0;o=k+4|0;p=c[o>>2]|0;if(!p){q=c[k>>2]|0;if(!q){r=0;break}else{s=q;t=k}}else{s=p;t=o}o=s;p=t;while(1){k=o+20|0;q=c[k>>2]|0;if(!q){u=o+16|0;v=c[u>>2]|0;if(!v)break;else{w=v;x=u}}else{w=q;x=k}o=w;p=x}c[p>>2]=0;r=o}else{k=c[h+8>>2]|0;c[k+12>>2]=j;c[j+8>>2]=k;r=j}while(0);if(g){j=c[h+28>>2]|0;k=13736+(j<<2)|0;if((c[k>>2]|0)==(h|0)){c[k>>2]=r;if(!r){c[3359]=c[3359]&~(1<<j);l=h;m=i;n=h;break}}else{j=g+16|0;c[((c[j>>2]|0)==(h|0)?j:g+20|0)>>2]=r;if(!r){l=h;m=i;n=h;break}}c[r+24>>2]=g;j=h+16|0;k=c[j>>2]|0;if(k|0){c[r+16>>2]=k;c[k+24>>2]=r}k=c[j+4>>2]|0;if(k){c[r+20>>2]=k;c[k+24>>2]=r;l=h;m=i;n=h}else{l=h;m=i;n=h}}else{l=h;m=i;n=h}}else{l=b;m=a;n=b}while(0);if(n>>>0>=f>>>0)return;b=f+4|0;a=c[b>>2]|0;if(!(a&1))return;if(!(a&2)){if((c[3364]|0)==(f|0)){r=(c[3361]|0)+m|0;c[3361]=r;c[3364]=l;c[l+4>>2]=r|1;if((l|0)!=(c[3363]|0))return;c[3363]=0;c[3360]=0;return}if((c[3363]|0)==(f|0)){r=(c[3360]|0)+m|0;c[3360]=r;c[3363]=n;c[l+4>>2]=r|1;c[n+r>>2]=r;return}r=(a&-8)+m|0;x=a>>>3;do if(a>>>0<256){w=c[f+8>>2]|0;t=c[f+12>>2]|0;if((t|0)==(w|0)){c[3358]=c[3358]&~(1<<x);break}else{c[w+12>>2]=t;c[t+8>>2]=w;break}}else{w=c[f+24>>2]|0;t=c[f+12>>2]|0;do if((t|0)==(f|0)){s=f+16|0;d=s+4|0;e=c[d>>2]|0;if(!e){k=c[s>>2]|0;if(!k){y=0;break}else{z=k;A=s}}else{z=e;A=d}d=z;e=A;while(1){s=d+20|0;k=c[s>>2]|0;if(!k){j=d+16|0;q=c[j>>2]|0;if(!q)break;else{B=q;C=j}}else{B=k;C=s}d=B;e=C}c[e>>2]=0;y=d}else{o=c[f+8>>2]|0;c[o+12>>2]=t;c[t+8>>2]=o;y=t}while(0);if(w|0){t=c[f+28>>2]|0;h=13736+(t<<2)|0;if((c[h>>2]|0)==(f|0)){c[h>>2]=y;if(!y){c[3359]=c[3359]&~(1<<t);break}}else{t=w+16|0;c[((c[t>>2]|0)==(f|0)?t:w+20|0)>>2]=y;if(!y)break}c[y+24>>2]=w;t=f+16|0;h=c[t>>2]|0;if(h|0){c[y+16>>2]=h;c[h+24>>2]=y}h=c[t+4>>2]|0;if(h|0){c[y+20>>2]=h;c[h+24>>2]=y}}}while(0);c[l+4>>2]=r|1;c[n+r>>2]=r;if((l|0)==(c[3363]|0)){c[3360]=r;return}else D=r}else{c[b>>2]=a&-2;c[l+4>>2]=m|1;c[n+m>>2]=m;D=m}m=D>>>3;if(D>>>0<256){n=13472+(m<<1<<2)|0;a=c[3358]|0;b=1<<m;if(!(a&b)){c[3358]=a|b;E=n;F=n+8|0}else{b=n+8|0;E=c[b>>2]|0;F=b}c[F>>2]=l;c[E+12>>2]=l;c[l+8>>2]=E;c[l+12>>2]=n;return}n=D>>>8;if(n)if(D>>>0>16777215)G=31;else{E=(n+1048320|0)>>>16&8;F=n<<E;n=(F+520192|0)>>>16&4;b=F<<n;F=(b+245760|0)>>>16&2;a=14-(n|E|F)+(b<<F>>>15)|0;G=D>>>(a+7|0)&1|a<<1}else G=0;a=13736+(G<<2)|0;c[l+28>>2]=G;c[l+20>>2]=0;c[l+16>>2]=0;F=c[3359]|0;b=1<<G;a:do if(!(F&b)){c[3359]=F|b;c[a>>2]=l;c[l+24>>2]=a;c[l+12>>2]=l;c[l+8>>2]=l}else{E=c[a>>2]|0;b:do if((c[E+4>>2]&-8|0)==(D|0))H=E;else{n=D<<((G|0)==31?0:25-(G>>>1)|0);m=E;while(1){I=m+16+(n>>>31<<2)|0;r=c[I>>2]|0;if(!r)break;if((c[r+4>>2]&-8|0)==(D|0)){H=r;break b}else{n=n<<1;m=r}}c[I>>2]=l;c[l+24>>2]=m;c[l+12>>2]=l;c[l+8>>2]=l;break a}while(0);E=H+8|0;w=c[E>>2]|0;c[w+12>>2]=l;c[E>>2]=l;c[l+8>>2]=w;c[l+12>>2]=H;c[l+24>>2]=0}while(0);l=(c[3366]|0)+-1|0;c[3366]=l;if(l|0)return;l=13888;while(1){H=c[l>>2]|0;if(!H)break;else l=H+8|0}c[3366]=-1;return}function Og(a){a=a|0;return}function Pg(a){a=a|0;Og(a);Wg(a);return}function Qg(a){a=a|0;return 11528}function Rg(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,u=0,v=0,w=0,x=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0;b=za;za=za+16|0;if((za|0)>=(Aa|0))y(16);d=b;e=b+8|0;f=b+4|0;c[e>>2]=a;do if(a>>>0>=212){g=(a>>>0)/210|0;h=g*210|0;c[f>>2]=a-h;i=0;j=g;g=h;h=(Sg(2592,2784,f,d)|0)-2592>>2;a:while(1){k=(c[2592+(h<<2)>>2]|0)+g|0;l=5;while(1){if(l>>>0>=47){m=6;break}n=c[2400+(l<<2)>>2]|0;o=(k>>>0)/(n>>>0)|0;if(o>>>0<n>>>0){m=107;break a}if((k|0)==(t(o,n)|0)){p=i;break}else l=l+1|0}b:do if((m|0)==6){m=0;l=211;n=i;c:while(1){o=(k>>>0)/(l>>>0)|0;do if(o>>>0>=l>>>0)if((k|0)!=(t(o,l)|0)){q=l+10|0;r=(k>>>0)/(q>>>0)|0;if(r>>>0>=q>>>0)if((k|0)!=(t(r,q)|0)){r=l+12|0;s=(k>>>0)/(r>>>0)|0;if(s>>>0>=r>>>0)if((k|0)!=(t(s,r)|0)){s=l+16|0;u=(k>>>0)/(s>>>0)|0;if(u>>>0>=s>>>0)if((k|0)!=(t(u,s)|0)){u=l+18|0;v=(k>>>0)/(u>>>0)|0;if(v>>>0>=u>>>0)if((k|0)!=(t(v,u)|0)){v=l+22|0;w=(k>>>0)/(v>>>0)|0;if(w>>>0>=v>>>0)if((k|0)!=(t(w,v)|0)){w=l+28|0;x=(k>>>0)/(w>>>0)|0;if(x>>>0>=w>>>0)if((k|0)==(t(x,w)|0)){z=w;A=9;B=n}else{x=l+30|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+36|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+40|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+42|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+46|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+52|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+58|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+60|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+66|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+70|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+72|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+78|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+82|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+88|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+96|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+100|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+102|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+106|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+108|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+112|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+120|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+126|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+130|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+136|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+138|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+142|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+148|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+150|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+156|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+162|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+166|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+168|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+172|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+178|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+180|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+186|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+190|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+192|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+196|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+198|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+208|0;C=(k>>>0)/(x>>>0)|0;D=C>>>0<x>>>0;E=(k|0)==(t(C,x)|0);z=D|E?x:l+210|0;A=D?1:E?9:0;B=D?k:n}else{z=w;A=1;B=k}}else{z=v;A=9;B=n}else{z=v;A=1;B=k}}else{z=u;A=9;B=n}else{z=u;A=1;B=k}}else{z=s;A=9;B=n}else{z=s;A=1;B=k}}else{z=r;A=9;B=n}else{z=r;A=1;B=k}}else{z=q;A=9;B=n}else{z=q;A=1;B=k}}else{z=l;A=9;B=n}else{z=l;A=1;B=k}while(0);switch(A&15){case 9:{p=B;break b;break}case 0:{l=z;n=B;break}default:break c}}if(!A)p=B;else{m=108;break a}}while(0);n=h+1|0;l=(n|0)==48;o=j+(l&1)|0;i=p;j=o;g=o*210|0;h=l?0:n}if((m|0)==107){c[e>>2]=k;F=k;break}else if((m|0)==108){c[e>>2]=k;F=B;break}}else F=c[(Sg(2400,2592,e,d)|0)>>2]|0;while(0);za=b;return F|0}function Sg(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0;e=c[d>>2]|0;d=a;f=b-a>>2;while(1){if(!f)break;a=(f|0)/2|0;b=d+(a<<2)|0;g=(c[b>>2]|0)>>>0<e>>>0;d=g?b+4|0:d;f=g?f+-1-a|0:a}return d|0}function Tg(a){a=a|0;return}function Ug(a){a=a|0;var b=0,d=0;b=a+8|0;if(!((c[b>>2]|0)!=0?(d=c[b>>2]|0,c[b>>2]=d+-1,(d|0)!=0):0))Ga[c[(c[a>>2]|0)+16>>2]&127](a);return}function Vg(a){a=a|0;var b=0,c=0;b=(a|0)==0?1:a;while(1){a=Mg(b)|0;if(a|0){c=a;break}a=Uh()|0;if(!a){c=0;break}Fa[a&3]()}return c|0}function Wg(a){a=a|0;Ng(a);return}function Xg(a,b){a=a|0;b=b|0;var d=0,e=0,f=0;d=_f(b)|0;e=Vg(d+13|0)|0;c[e>>2]=d;c[e+4>>2]=d;c[e+8>>2]=0;f=Yg(e)|0;fi(f|0,b|0,d+1|0)|0;c[a>>2]=f;return}function Yg(a){a=a|0;return a+12|0}function Zg(a,b){a=a|0;b=b|0;c[a>>2]=5676;Xg(a+4|0,b);return}function _g(a){a=a|0;return 1}function $g(a){a=a|0;ka()}function ah(b,d){b=b|0;d=d|0;c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;if((a[d+11>>0]|0)<0)bh(b,c[d>>2]|0,c[d+4>>2]|0);else{c[b>>2]=c[d>>2];c[b+4>>2]=c[d+4>>2];c[b+8>>2]=c[d+8>>2]}return}function bh(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0;f=za;za=za+16|0;if((za|0)>=(Aa|0))y(16);g=f;if(e>>>0>4294967279)$g(b);if(e>>>0<11){a[b+11>>0]=e;h=b}else{i=e+16&-16;j=Vg(i)|0;c[b>>2]=j;c[b+8>>2]=i|-2147483648;c[b+4>>2]=e;h=j}ch(h,d,e)|0;a[g>>0]=0;dh(h+e|0,g);za=f;return}function ch(a,b,c){a=a|0;b=b|0;c=c|0;if(c|0)fi(a|0,b|0,c|0)|0;return a|0}function dh(b,c){b=b|0;c=c|0;a[b>>0]=a[c>>0]|0;return}function eh(a){a=a|0;ka()}function fh(){var a=0,b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0;a=za;za=za+48|0;if((za|0)>=(Aa|0))y(48);b=a+32|0;d=a+24|0;e=a+16|0;f=a;g=a+36|0;a=gh()|0;if(a|0?(h=c[a>>2]|0,h|0):0){a=h+48|0;i=c[a>>2]|0;j=c[a+4>>2]|0;if(!((i&-256|0)==1126902528&(j|0)==1129074247)){c[d>>2]=11770;hh(11720,d)}if((i|0)==1126902529&(j|0)==1129074247)k=c[h+44>>2]|0;else k=h+80|0;c[g>>2]=k;k=c[h>>2]|0;h=c[k+4>>2]|0;if(Ea[c[(c[908]|0)+16>>2]&7](3632,k,g)|0){k=c[g>>2]|0;g=Ca[c[(c[k>>2]|0)+8>>2]&63](k)|0;c[f>>2]=11770;c[f+4>>2]=h;c[f+8>>2]=g;hh(11634,f)}else{c[e>>2]=11770;c[e+4>>2]=h;hh(11679,e)}}hh(11758,b)}function gh(){var a=0,b=0;a=za;za=za+16|0;if((za|0)>=(Aa|0))y(16);if(!(va(13928,3)|0)){b=ta(c[3483]|0)|0;za=a;return b|0}else hh(11909,a);return 0}function hh(a,b){a=a|0;b=b|0;var d=0,e=0;d=za;za=za+16|0;if((za|0)>=(Aa|0))y(16);e=d;c[e>>2]=b;b=c[1265]|0;og(b,a,e)|0;Kg(10,b)|0;ka()}function ih(a){a=a|0;return}function jh(a){a=a|0;ih(a);Wg(a);return}function kh(a){a=a|0;return}function lh(a){a=a|0;return}function mh(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0;e=za;za=za+64|0;if((za|0)>=(Aa|0))y(64);f=e;if(!(qh(a,b,0)|0))if((b|0)!=0?(g=uh(b,3656,3640,0)|0,(g|0)!=0):0){b=f+4|0;h=b+52|0;do{c[b>>2]=0;b=b+4|0}while((b|0)<(h|0));c[f>>2]=g;c[f+8>>2]=a;c[f+12>>2]=-1;c[f+48>>2]=1;Ja[c[(c[g>>2]|0)+28>>2]&31](g,f,c[d>>2]|0,1);if((c[f+24>>2]|0)==1){c[d>>2]=c[f+16>>2];i=1}else i=0;j=i}else j=0;else j=1;za=e;return j|0}function nh(a,b,d,e,f,g){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;if(qh(a,c[b+8>>2]|0,g)|0)th(0,b,d,e,f);return}function oh(b,d,e,f,g){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0;do if(!(qh(b,c[d+8>>2]|0,g)|0)){if(qh(b,c[d>>2]|0,g)|0){if((c[d+16>>2]|0)!=(e|0)?(h=d+20|0,(c[h>>2]|0)!=(e|0)):0){c[d+32>>2]=f;c[h>>2]=e;h=d+40|0;c[h>>2]=(c[h>>2]|0)+1;if((c[d+36>>2]|0)==1?(c[d+24>>2]|0)==2:0)a[d+54>>0]=1;c[d+44>>2]=4;break}if((f|0)==1)c[d+32>>2]=1}}else sh(0,d,e,f);while(0);return}function ph(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;if(qh(a,c[b+8>>2]|0,0)|0)rh(0,b,d,e);return}function qh(a,b,c){a=a|0;b=b|0;c=c|0;return (a|0)==(b|0)|0}function rh(b,d,e,f){b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0;b=d+16|0;g=c[b>>2]|0;do if(g){if((g|0)!=(e|0)){h=d+36|0;c[h>>2]=(c[h>>2]|0)+1;c[d+24>>2]=2;a[d+54>>0]=1;break}h=d+24|0;if((c[h>>2]|0)==2)c[h>>2]=f}else{c[b>>2]=e;c[d+24>>2]=f;c[d+36>>2]=1}while(0);return}function sh(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;if((c[b+4>>2]|0)==(d|0)?(d=b+28|0,(c[d>>2]|0)!=1):0)c[d>>2]=e;return}function th(b,d,e,f,g){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0;a[d+53>>0]=1;do if((c[d+4>>2]|0)==(f|0)){a[d+52>>0]=1;b=d+16|0;h=c[b>>2]|0;if(!h){c[b>>2]=e;c[d+24>>2]=g;c[d+36>>2]=1;if(!((g|0)==1?(c[d+48>>2]|0)==1:0))break;a[d+54>>0]=1;break}if((h|0)!=(e|0)){h=d+36|0;c[h>>2]=(c[h>>2]|0)+1;a[d+54>>0]=1;break}h=d+24|0;b=c[h>>2]|0;if((b|0)==2){c[h>>2]=g;i=g}else i=b;if((i|0)==1?(c[d+48>>2]|0)==1:0)a[d+54>>0]=1}while(0);return}function uh(d,e,f,g){d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0;h=za;za=za+64|0;if((za|0)>=(Aa|0))y(64);i=h;j=c[d>>2]|0;k=d+(c[j+-8>>2]|0)|0;l=c[j+-4>>2]|0;c[i>>2]=f;c[i+4>>2]=d;c[i+8>>2]=e;c[i+12>>2]=g;g=i+16|0;e=i+20|0;d=i+24|0;j=i+28|0;m=i+32|0;n=i+40|0;o=g;p=o+36|0;do{c[o>>2]=0;o=o+4|0}while((o|0)<(p|0));b[g+36>>1]=0;a[g+38>>0]=0;a:do if(qh(l,f,0)|0){c[i+48>>2]=1;La[c[(c[l>>2]|0)+20>>2]&3](l,i,k,k,1,0);q=(c[d>>2]|0)==1?k:0}else{Ka[c[(c[l>>2]|0)+24>>2]&3](l,i,k,1,0);switch(c[i+36>>2]|0){case 0:{q=(c[n>>2]|0)==1&(c[j>>2]|0)==1&(c[m>>2]|0)==1?c[e>>2]|0:0;break a;break}case 1:break;default:{q=0;break a}}if((c[d>>2]|0)!=1?!((c[n>>2]|0)==0&(c[j>>2]|0)==1&(c[m>>2]|0)==1):0){q=0;break}q=c[g>>2]|0}while(0);za=h;return q|0}function vh(a){a=a|0;ih(a);Wg(a);return}function wh(a,b,d,e,f,g){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0;if(qh(a,c[b+8>>2]|0,g)|0)th(0,b,d,e,f);else{h=c[a+8>>2]|0;La[c[(c[h>>2]|0)+20>>2]&3](h,b,d,e,f,g)}return}function xh(b,d,e,f,g){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0;do if(!(qh(b,c[d+8>>2]|0,g)|0)){if(!(qh(b,c[d>>2]|0,g)|0)){h=c[b+8>>2]|0;Ka[c[(c[h>>2]|0)+24>>2]&3](h,d,e,f,g);break}if((c[d+16>>2]|0)!=(e|0)?(h=d+20|0,(c[h>>2]|0)!=(e|0)):0){c[d+32>>2]=f;i=d+44|0;if((c[i>>2]|0)==4)break;j=d+52|0;a[j>>0]=0;k=d+53|0;a[k>>0]=0;l=c[b+8>>2]|0;La[c[(c[l>>2]|0)+20>>2]&3](l,d,e,e,1,g);if(a[k>>0]|0)if(!(a[j>>0]|0)){m=1;n=11}else n=15;else{m=0;n=11}do if((n|0)==11){c[h>>2]=e;j=d+40|0;c[j>>2]=(c[j>>2]|0)+1;if((c[d+36>>2]|0)==1?(c[d+24>>2]|0)==2:0){a[d+54>>0]=1;if(m){n=15;break}else{o=4;break}}if(m)n=15;else o=4}while(0);if((n|0)==15)o=3;c[i>>2]=o;break}if((f|0)==1)c[d+32>>2]=1}else sh(0,d,e,f);while(0);return}function yh(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0;if(qh(a,c[b+8>>2]|0,0)|0)rh(0,b,d,e);else{f=c[a+8>>2]|0;Ja[c[(c[f>>2]|0)+28>>2]&31](f,b,d,e)}return}function zh(a){a=a|0;return}function Ah(){var a=0;a=za;za=za+16|0;if((za|0)>=(Aa|0))y(16);if(!(ua(13932,126)|0)){za=a;return}else hh(11958,a)}function Bh(a){a=a|0;var b=0;b=za;za=za+16|0;if((za|0)>=(Aa|0))y(16);Ng(a);if(!(wa(c[3483]|0,0)|0)){za=b;return}else hh(12008,b)}function Ch(){var a=0,b=0;a=gh()|0;if((a|0?(b=c[a>>2]|0,b|0):0)?(a=b+48|0,(c[a>>2]&-256|0)==1126902528?(c[a+4>>2]|0)==1129074247:0):0)Dh(c[b+12>>2]|0);Dh(Eh()|0)}function Dh(a){a=a|0;var b=0;b=za;za=za+16|0;if((za|0)>=(Aa|0))y(16);Fa[a&3]();hh(12061,b)}function Eh(){var a=0;a=c[1396]|0;c[1396]=a+0;return a|0}function Fh(a){a=a|0;return}function Gh(a){a=a|0;c[a>>2]=5676;Kh(a+4|0);return}function Hh(a){a=a|0;Gh(a);Wg(a);return}function Ih(a){a=a|0;return Jh(a+4|0)|0}function Jh(a){a=a|0;return c[a>>2]|0}function Kh(a){a=a|0;var b=0,d=0;if(_g(a)|0?(b=Lh(c[a>>2]|0)|0,a=b+8|0,d=c[a>>2]|0,c[a>>2]=d+-1,(d+-1|0)<0):0)Wg(b);return}function Lh(a){a=a|0;return a+-12|0}function Mh(a){a=a|0;Gh(a);Wg(a);return}function Nh(a){a=a|0;ih(a);Wg(a);return}function Oh(b,d,e,f,g,h){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;h=h|0;var i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0;if(qh(b,c[d+8>>2]|0,h)|0)th(0,d,e,f,g);else{i=d+52|0;j=a[i>>0]|0;k=d+53|0;l=a[k>>0]|0;m=c[b+12>>2]|0;n=b+16+(m<<3)|0;a[i>>0]=0;a[k>>0]=0;Sh(b+16|0,d,e,f,g,h);a:do if((m|0)>1){o=d+24|0;p=b+8|0;q=d+54|0;r=b+24|0;do{if(a[q>>0]|0)break a;if(!(a[i>>0]|0)){if(a[k>>0]|0?(c[p>>2]&1|0)==0:0)break a}else{if((c[o>>2]|0)==1)break a;if(!(c[p>>2]&2))break a}a[i>>0]=0;a[k>>0]=0;Sh(r,d,e,f,g,h);r=r+8|0}while(r>>>0<n>>>0)}while(0);a[i>>0]=j;a[k>>0]=l}return}function Ph(b,d,e,f,g){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0;a:do if(!(qh(b,c[d+8>>2]|0,g)|0)){if(!(qh(b,c[d>>2]|0,g)|0)){h=c[b+12>>2]|0;i=b+16+(h<<3)|0;Th(b+16|0,d,e,f,g);j=b+24|0;if((h|0)<=1)break;h=c[b+8>>2]|0;if((h&2|0)==0?(k=d+36|0,(c[k>>2]|0)!=1):0){if(!(h&1)){h=d+54|0;l=j;while(1){if(a[h>>0]|0)break a;if((c[k>>2]|0)==1)break a;Th(l,d,e,f,g);l=l+8|0;if(l>>>0>=i>>>0)break a}}l=d+24|0;h=d+54|0;m=j;while(1){if(a[h>>0]|0)break a;if((c[k>>2]|0)==1?(c[l>>2]|0)==1:0)break a;Th(m,d,e,f,g);m=m+8|0;if(m>>>0>=i>>>0)break a}}m=d+54|0;l=j;while(1){if(a[m>>0]|0)break a;Th(l,d,e,f,g);l=l+8|0;if(l>>>0>=i>>>0)break a}}if((c[d+16>>2]|0)!=(e|0)?(i=d+20|0,(c[i>>2]|0)!=(e|0)):0){c[d+32>>2]=f;l=d+44|0;if((c[l>>2]|0)==4)break;m=b+16+(c[b+12>>2]<<3)|0;j=d+52|0;k=d+53|0;h=d+54|0;n=b+8|0;o=d+24|0;p=0;q=b+16|0;r=0;b:while(1){if(q>>>0>=m>>>0){s=p;t=18;break}a[j>>0]=0;a[k>>0]=0;Sh(q,d,e,e,1,g);if(a[h>>0]|0){s=p;t=18;break}do if(a[k>>0]|0){if(!(a[j>>0]|0))if(!(c[n>>2]&1)){s=1;t=18;break b}else{u=1;v=r;break}if((c[o>>2]|0)==1){t=23;break b}if(!(c[n>>2]&2)){t=23;break b}else{u=1;v=1}}else{u=p;v=r}while(0);p=u;q=q+8|0;r=v}do if((t|0)==18){if((!r?(c[i>>2]=e,q=d+40|0,c[q>>2]=(c[q>>2]|0)+1,(c[d+36>>2]|0)==1):0)?(c[o>>2]|0)==2:0){a[h>>0]=1;if(s){t=23;break}else{w=4;break}}if(s)t=23;else w=4}while(0);if((t|0)==23)w=3;c[l>>2]=w;break}if((f|0)==1)c[d+32>>2]=1}else sh(0,d,e,f);while(0);return}function Qh(b,d,e,f){b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0;a:do if(!(qh(b,c[d+8>>2]|0,0)|0)){g=c[b+12>>2]|0;h=b+16+(g<<3)|0;Rh(b+16|0,d,e,f);if((g|0)>1){g=d+54|0;i=b+24|0;do{Rh(i,d,e,f);if(a[g>>0]|0)break a;i=i+8|0}while(i>>>0<h>>>0)}}else rh(0,d,e,f);while(0);return}function Rh(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0;f=c[a+4>>2]|0;g=f>>8;if(!(f&1))h=g;else h=c[(c[d>>2]|0)+g>>2]|0;g=c[a>>2]|0;Ja[c[(c[g>>2]|0)+28>>2]&31](g,b,d+h|0,(f&2|0)==0?2:e);return}function Sh(a,b,d,e,f,g){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0,j=0;h=c[a+4>>2]|0;i=h>>8;if(!(h&1))j=i;else j=c[(c[e>>2]|0)+i>>2]|0;i=c[a>>2]|0;La[c[(c[i>>2]|0)+20>>2]&3](i,b,d,e+j|0,(h&2|0)==0?2:f,g);return}function Th(a,b,d,e,f){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0;g=c[a+4>>2]|0;h=g>>8;if(!(g&1))i=h;else i=c[(c[d>>2]|0)+h>>2]|0;h=c[a>>2]|0;Ka[c[(c[h>>2]|0)+24>>2]&3](h,b,d+i|0,(g&2|0)==0?2:e,f);return}function Uh(){var a=0;a=c[3484]|0;c[3484]=a+0;return a|0}function Vh(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0;e=za;za=za+16|0;if((za|0)>=(Aa|0))y(16);f=e;c[f>>2]=c[d>>2];g=Ea[c[(c[a>>2]|0)+16>>2]&7](a,b,f)|0;if(g)c[d>>2]=c[f>>2];za=e;return g&1|0}function Wh(a){a=a|0;var b=0;if(!a)b=0;else b=(uh(a,3656,3744,0)|0)!=0&1;return b|0}function Xh(a,b){a=a|0;b=b|0;var c=0,d=0,e=0,f=0;c=a&65535;d=b&65535;e=t(d,c)|0;f=a>>>16;a=(e>>>16)+(t(d,f)|0)|0;d=b>>>16;b=t(d,c)|0;return (w((a>>>16)+(t(d,f)|0)+(((a&65535)+b|0)>>>16)|0),a+b<<16|e&65535|0)|0}function Yh(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;var e=0,f=0;e=a;a=c;c=Xh(e,a)|0;f=x()|0;return (w((t(b,a)|0)+(t(d,e)|0)+f|f&0|0),c|0|0)|0}function Zh(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;var e=0;e=a+c>>>0;return (w(b+d+(e>>>0<a>>>0|0)>>>0|0),e|0)|0}function _h(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;var e=0;e=b-d>>>0;e=b-d-(c>>>0>a>>>0|0)>>>0;return (w(e|0),a-c>>>0|0)|0}function $h(a){a=a|0;return (a?31-(u(a^a-1)|0)|0:32)|0}function ai(a,b,d,e,f){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,v=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0;g=a;h=b;i=h;j=d;k=e;l=k;if(!i){m=(f|0)!=0;if(!l){if(m){c[f>>2]=(g>>>0)%(j>>>0);c[f+4>>2]=0}n=0;o=(g>>>0)/(j>>>0)>>>0;return (w(n|0),o)|0}else{if(!m){n=0;o=0;return (w(n|0),o)|0}c[f>>2]=a|0;c[f+4>>2]=b&0;n=0;o=0;return (w(n|0),o)|0}}m=(l|0)==0;do if(j){if(!m){p=(u(l|0)|0)-(u(i|0)|0)|0;if(p>>>0<=31){q=p+1|0;r=31-p|0;s=p-31>>31;t=q;v=g>>>(q>>>0)&s|i<<r;y=i>>>(q>>>0)&s;z=0;A=g<<r;break}if(!f){n=0;o=0;return (w(n|0),o)|0}c[f>>2]=a|0;c[f+4>>2]=h|b&0;n=0;o=0;return (w(n|0),o)|0}r=j-1|0;if(r&j|0){s=(u(j|0)|0)+33-(u(i|0)|0)|0;q=64-s|0;p=32-s|0;B=p>>31;C=s-32|0;D=C>>31;t=s;v=p-1>>31&i>>>(C>>>0)|(i<<p|g>>>(s>>>0))&D;y=D&i>>>(s>>>0);z=g<<q&B;A=(i<<q|g>>>(C>>>0))&B|g<<p&s-33>>31;break}if(f|0){c[f>>2]=r&g;c[f+4>>2]=0}if((j|0)==1){n=h|b&0;o=a|0|0;return (w(n|0),o)|0}else{r=$h(j|0)|0;n=i>>>(r>>>0)|0;o=i<<32-r|g>>>(r>>>0)|0;return (w(n|0),o)|0}}else{if(m){if(f|0){c[f>>2]=(i>>>0)%(j>>>0);c[f+4>>2]=0}n=0;o=(i>>>0)/(j>>>0)>>>0;return (w(n|0),o)|0}if(!g){if(f|0){c[f>>2]=0;c[f+4>>2]=(i>>>0)%(l>>>0)}n=0;o=(i>>>0)/(l>>>0)>>>0;return (w(n|0),o)|0}r=l-1|0;if(!(r&l)){if(f|0){c[f>>2]=a|0;c[f+4>>2]=r&i|b&0}n=0;o=i>>>(($h(l|0)|0)>>>0);return (w(n|0),o)|0}r=(u(l|0)|0)-(u(i|0)|0)|0;if(r>>>0<=30){s=r+1|0;p=31-r|0;t=s;v=i<<p|g>>>(s>>>0);y=i>>>(s>>>0);z=0;A=g<<p;break}if(!f){n=0;o=0;return (w(n|0),o)|0}c[f>>2]=a|0;c[f+4>>2]=h|b&0;n=0;o=0;return (w(n|0),o)|0}while(0);if(!t){E=A;F=z;G=y;H=v;I=0;J=0}else{b=d|0|0;d=k|e&0;e=Zh(b|0,d|0,-1,-1)|0;k=x()|0;h=A;A=z;z=y;y=v;v=t;t=0;do{a=h;h=A>>>31|h<<1;A=t|A<<1;g=y<<1|a>>>31|0;a=y>>>31|z<<1|0;_h(e|0,k|0,g|0,a|0)|0;i=x()|0;l=i>>31|((i|0)<0?-1:0)<<1;t=l&1;y=_h(g|0,a|0,l&b|0,(((i|0)<0?-1:0)>>31|((i|0)<0?-1:0)<<1)&d|0)|0;z=x()|0;v=v-1|0}while((v|0)!=0);E=h;F=A;G=z;H=y;I=0;J=t}t=F;F=0;if(f|0){c[f>>2]=H;c[f+4>>2]=G}n=(t|0)>>>31|(E|F)<<1|(F<<1|t>>>31)&0|I;o=(t<<1|0>>>31)&-2|J;return (w(n|0),o)|0}function bi(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;return ai(a,b,c,d,0)|0}function ci(a,b,c){a=a|0;b=b|0;c=c|0;if((c|0)<32){w(b>>>c|0);return a>>>c|(b&(1<<c)-1)<<32-c}w(0);return b>>>c-32|0}function di(a,b,c){a=a|0;b=b|0;c=c|0;if((c|0)<32){w(b<<c|(a&(1<<c)-1<<32-c)>>>32-c|0);return a<<c}w(a<<c-32|0);return 0}function ei(a){a=a|0;return (a&255)<<24|(a>>8&255)<<16|(a>>16&255)<<8|a>>>24|0}function fi(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0;if((e|0)>=8192){na(b|0,d|0,e|0)|0;return b|0}f=b|0;g=b+e|0;if((b&3)==(d&3)){while(b&3){if(!e)return f|0;a[b>>0]=a[d>>0]|0;b=b+1|0;d=d+1|0;e=e-1|0}h=g&-4|0;e=h-64|0;while((b|0)<=(e|0)){c[b>>2]=c[d>>2];c[b+4>>2]=c[d+4>>2];c[b+8>>2]=c[d+8>>2];c[b+12>>2]=c[d+12>>2];c[b+16>>2]=c[d+16>>2];c[b+20>>2]=c[d+20>>2];c[b+24>>2]=c[d+24>>2];c[b+28>>2]=c[d+28>>2];c[b+32>>2]=c[d+32>>2];c[b+36>>2]=c[d+36>>2];c[b+40>>2]=c[d+40>>2];c[b+44>>2]=c[d+44>>2];c[b+48>>2]=c[d+48>>2];c[b+52>>2]=c[d+52>>2];c[b+56>>2]=c[d+56>>2];c[b+60>>2]=c[d+60>>2];b=b+64|0;d=d+64|0}while((b|0)<(h|0)){c[b>>2]=c[d>>2];b=b+4|0;d=d+4|0}}else{h=g-4|0;while((b|0)<(h|0)){a[b>>0]=a[d>>0]|0;a[b+1>>0]=a[d+1>>0]|0;a[b+2>>0]=a[d+2>>0]|0;a[b+3>>0]=a[d+3>>0]|0;b=b+4|0;d=d+4|0}}while((b|0)<(g|0)){a[b>>0]=a[d>>0]|0;b=b+1|0;d=d+1|0}return f|0}function gi(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0;f=b+e|0;d=d&255;if((e|0)>=67){while(b&3){a[b>>0]=d;b=b+1|0}g=f&-4|0;h=d|d<<8|d<<16|d<<24;i=g-64|0;while((b|0)<=(i|0)){c[b>>2]=h;c[b+4>>2]=h;c[b+8>>2]=h;c[b+12>>2]=h;c[b+16>>2]=h;c[b+20>>2]=h;c[b+24>>2]=h;c[b+28>>2]=h;c[b+32>>2]=h;c[b+36>>2]=h;c[b+40>>2]=h;c[b+44>>2]=h;c[b+48>>2]=h;c[b+52>>2]=h;c[b+56>>2]=h;c[b+60>>2]=h;b=b+64|0}while((b|0)<(g|0)){c[b>>2]=h;b=b+4|0}}while((b|0)<(f|0)){a[b>>0]=d;b=b+1|0}return f-e|0}function hi(a){a=a|0;var b=0,d=0;b=c[i>>2]|0;d=b+a|0;if((a|0)>0&(d|0)<(b|0)|(d|0)<0){xa(d|0)|0;ea(12);return -1}if((d|0)>(la()|0)){if(!(oa(d|0)|0)){ea(12);return -1}}else c[i>>2]=d;return b|0}function ii(a,b){a=a|0;b=b|0;return Ca[a&63](b|0)|0}function ji(a,b,c){a=a|0;b=b|0;c=c|0;return Da[a&31](b|0,c|0)|0}function ki(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;return Ea[a&7](b|0,c|0,d|0)|0}function li(a){a=a|0;Fa[a&3]()}function mi(a,b){a=a|0;b=b|0;Ga[a&127](b|0)}function ni(a,b,c){a=a|0;b=b|0;c=c|0;Ha[a&31](b|0,c|0)}function oi(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;Ia[a&3](b|0,c|0,d|0)}function pi(a,b,c,d,e){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;Ja[a&31](b|0,c|0,d|0,e|0)}function qi(a,b,c,d,e,f){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;f=f|0;Ka[a&3](b|0,c|0,d|0,e|0,f|0)}function ri(a,b,c,d,e,f,g){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;f=f|0;g=g|0;La[a&3](b|0,c|0,d|0,e|0,f|0,g|0)}function si(a){a=a|0;z(0);return 0}function ti(a){a=a|0;z(37);return 0}function ui(a){a=a|0;z(38);return 0}function vi(a){a=a|0;z(39);return 0}function wi(a){a=a|0;z(40);return 0}function xi(a){a=a|0;z(41);return 0}function yi(a){a=a|0;z(42);return 0}function zi(a){a=a|0;z(43);return 0}function Ai(a){a=a|0;z(44);return 0}function Bi(a){a=a|0;z(45);return 0}function Ci(a){a=a|0;z(46);return 0}function Di(a){a=a|0;z(47);return 0}function Ei(a){a=a|0;z(48);return 0}function Fi(a){a=a|0;z(49);return 0}function Gi(a){a=a|0;z(50);return 0}function Hi(a){a=a|0;z(51);return 0}function Ii(a){a=a|0;z(52);return 0}function Ji(a){a=a|0;z(53);return 0}function Ki(a){a=a|0;z(54);return 0}function Li(a){a=a|0;z(55);return 0}function Mi(a){a=a|0;z(56);return 0}function Ni(a){a=a|0;z(57);return 0}function Oi(a){a=a|0;z(58);return 0}function Pi(a){a=a|0;z(59);return 0}function Qi(a){a=a|0;z(60);return 0}function Ri(a){a=a|0;z(61);return 0}function Si(a){a=a|0;z(62);return 0}function Ti(a){a=a|0;z(63);return 0}function Ui(a,b){a=a|0;b=b|0;A(0);return 0}function Vi(a,b,c){a=a|0;b=b|0;c=c|0;B(0);return 0}function Wi(a,b,c){a=a|0;b=b|0;c=c|0;B(5);return 0}function Xi(a,b,c){a=a|0;b=b|0;c=c|0;B(6);return 0}function Yi(a,b,c){a=a|0;b=b|0;c=c|0;B(7);return 0}function Zi(){C(0)}function _i(a){a=a|0;D(0)}function $i(a){a=a|0;D(127)}function aj(a,b){a=a|0;b=b|0;E(0)}function bj(a,b){a=a|0;b=b|0;E(24)}function cj(a,b){a=a|0;b=b|0;E(25)}function dj(a,b){a=a|0;b=b|0;E(26)}function ej(a,b){a=a|0;b=b|0;E(27)}function fj(a,b){a=a|0;b=b|0;E(28)}function gj(a,b){a=a|0;b=b|0;E(29)}function hj(a,b){a=a|0;b=b|0;E(30)}function ij(a,b){a=a|0;b=b|0;E(31)}function jj(a,b,c){a=a|0;b=b|0;c=c|0;F(0)}function kj(a,b,c){a=a|0;b=b|0;c=c|0;F(3)}function lj(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;G(0)}function mj(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;G(18)}function nj(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;G(19)}function oj(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;G(20)}function pj(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;G(21)}function qj(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;G(22)}function rj(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;G(23)}function sj(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;G(24)}function tj(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;G(25)}function uj(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;G(26)}function vj(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;G(27)}function wj(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;G(28)}function xj(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;G(29)}function yj(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;G(30)}function zj(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;G(31)}function Aj(a,b,c,d,e){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;H(0)}function Bj(a,b,c,d,e,f){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;f=f|0;I(0)}

// EMSCRIPTEN_END_FUNCS
var Ca=[si,Ub,_b,bc,hc,xc,Dc,Kc,Qc,Uc,_c,bd,hd,sd,yd,Bd,Hd,Kd,Qd,Td,Zd,ae,ge,ie,oe,De,He,Je,Me,Se,Ue,_e,Bf,Hf,Qf,Qg,Ih,ti,ui,vi,wi,xi,yi,zi,Ai,Bi,Ci,Di,Ei,Fi,Gi,Hi,Ii,Ji,Ki,Li,Mi,Ni,Oi,Pi,Qi,Ri,Si,Ti];var Da=[Ui,zb,Fb,Lb,Qb,Zb,gc,nc,uc,Cc,Pc,Zc,gd,od,xd,Gd,Pd,Yd,fe,ne,se,ze,Ie,Re,Ze,df,hf,mf,qf,uf,yf,Gf];var Ea=[Vi,Rf,Sf,Wf,mh,Wi,Xi,Yi];var Fa=[Zi,fh,Sa,Ah];var Ga=[_i,Tg,xb,yb,Ab,Db,Eb,Gb,Jb,Kb,Mb,Ob,Pb,Rb,$b,Tb,Wb,Xb,ac,dc,ec,lc,mc,oc,sc,tc,vc,wc,zc,Ac,Ic,Jc,Mc,Nc,Oc,Sc,Tc,Wc,Xc,Yc,$c,ad,dd,ed,md,nd,pd,qd,rd,ud,vd,wd,zd,Ad,Dd,Ed,Fd,Id,Jd,Md,Nd,Rd,Sd,Vd,Wd,Xd,_d,$d,ce,de,ee,id,he,ke,le,qe,re,te,xe,ye,Ae,Be,Ce,Fe,Ge,Ke,Le,Oe,Pe,Te,We,Xe,bf,cf,ef,ff,gf,jf,kf,lf,nf,of,pf,rf,sf,tf,vf,wf,xf,zf,Rc,Af,Df,Ef,Ff,Og,Pg,ih,jh,kh,lh,vh,Gh,Hh,Mh,Nh,Bh,$i];var Ha=[aj,Vb,Yb,cc,fc,yc,Bc,Lc,Vc,cd,fd,td,Cd,Ld,Od,Ud,be,je,me,Ee,Ne,Ve,Ye,Cf,bj,cj,dj,ej,fj,gj,hj,ij];var Ia=[jj,nb,Qe,kj];var Ja=[lj,ob,pb,sb,tb,Bb,Cb,qb,rb,ic,jc,pc,qc,jd,kd,ph,yh,Qh,mj,nj,oj,pj,qj,rj,sj,tj,uj,vj,wj,xj,yj,zj];var Ka=[Aj,oh,xh,Ph];var La=[Bj,nh,wh,Oh];return{__GLOBAL__sub_I_main_cpp:Pf,___cxa_can_catch:Vh,___cxa_is_pointer_type:Wh,___em_js__getCanvasHeight:Ra,___em_js__getCanvasWidth:Qa,___errno_location:Uf,___muldi3:Yh,___udivdi3:bi,_bitshift64Lshr:ci,_bitshift64Shl:di,_fflush:lg,_free:Ng,_i64Add:Zh,_i64Subtract:_h,_llvm_bswap_i32:ei,_main:Ta,_malloc:Mg,_memcpy:fi,_memset:gi,_sbrk:hi,dynCall_ii:ii,dynCall_iii:ji,dynCall_iiii:ki,dynCall_v:li,dynCall_vi:mi,dynCall_vii:ni,dynCall_viii:oi,dynCall_viiii:pi,dynCall_viiiii:qi,dynCall_viiiiii:ri,establishStackSpace:Pa,stackAlloc:Ma,stackRestore:Oa,stackSave:Na}})


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

