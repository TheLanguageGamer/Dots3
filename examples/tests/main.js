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

var STACK_BASE = 8400, STACK_MAX = 5251280, DYNAMIC_BASE = 5251280, DYNAMICTOP_PTR = 8144;

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

var tempDoublePtr = 8384;

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

function _SDL_PollEvent(ptr) {
 return SDL.pollEvent(ptr);
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

var ASSERTIONS = true;

function intArrayFromString(stringy, dontAddNull, length) {
 var len = length > 0 ? length : lengthBytesUTF8(stringy) + 1;
 var u8array = new Array(len);
 var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
 if (dontAddNull) u8array.length = numBytesWritten;
 return u8array;
}

var debug_table_ii = [ "0", "__ZNKSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEE7__cloneEv", "__ZNKSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEE11target_typeEv", "___stdio_close", "__ZNKSt3__217bad_function_call4whatEv", "__ZNKSt11logic_error4whatEv", "0", "0" ];

var debug_table_iii = [ "0", "__ZNKSt3__220__shared_ptr_pointerIP18RectangleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP13TextComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP10EntityGridNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP14TestPrimitivesNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP13TestTextLabelNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP14TestEntityGridNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEE6targetERKSt9type_info" ];

var debug_table_iiii = [ "0", "___stdio_write", "___stdio_seek", "___stdout_write", "__ZNK10__cxxabiv117__class_type_info9can_catchEPKNS_16__shim_type_infoERPv", "0", "0", "0" ];

var debug_table_v = [ "0", "__ZL25default_terminate_handlerv", "__Z9main_loopv", "__ZN10__cxxabiv112_GLOBAL__N_110construct_Ev" ];

var debug_table_vi = [ "0", "__ZNSt3__214__shared_countD2Ev", "__ZNSt3__220__shared_ptr_pointerIP18RectangleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP18RectangleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP18RectangleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__220__shared_ptr_pointerIP13TextComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP13TextComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP13TextComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__220__shared_ptr_pointerIP10EntityGridNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP10EntityGridNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP10EntityGridNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__220__shared_ptr_pointerIP14TestPrimitivesNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP14TestPrimitivesNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP14TestPrimitivesNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__220__shared_ptr_pointerIP13TestTextLabelNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP13TestTextLabelNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP13TestTextLabelNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__220__shared_ptr_pointerIP14TestEntityGridNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP14TestEntityGridNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP14TestEntityGridNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__210__function6__baseIFvvEED2Ev", "__ZNSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEED0Ev", "__ZNSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEE7destroyEv", "__ZNSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEE18destroy_deallocateEv", "__ZNSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEEclEv", "__ZNSt3__217bad_function_callD2Ev", "__ZNSt3__217bad_function_callD0Ev", "__ZN10__cxxabiv116__shim_type_infoD2Ev", "__ZN10__cxxabiv117__class_type_infoD0Ev", "__ZNK10__cxxabiv116__shim_type_info5noop1Ev", "__ZNK10__cxxabiv116__shim_type_info5noop2Ev", "__ZN10__cxxabiv120__si_class_type_infoD0Ev", "__ZNSt11logic_errorD2Ev", "__ZNSt11logic_errorD0Ev", "__ZNSt12length_errorD0Ev", "__ZN10__cxxabiv121__vmi_class_type_infoD0Ev", "__ZN10__cxxabiv112_GLOBAL__N_19destruct_EPv", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0" ];

var debug_table_vii = [ "0", "__ZN9Component8addChildENSt3__210shared_ptrIS_EE", "__ZNKSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEE7__cloneEPNS0_6__baseIS5_EE", "0" ];

var debug_table_viiii = [ "0", "__ZN18RectangleComponent8doLayoutERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN9Component8doLayoutERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN13TextComponent8doLayoutERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN13DrawComponent8doLayoutERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZNK10__cxxabiv117__class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi", "__ZNK10__cxxabiv120__si_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi", "__ZNK10__cxxabiv121__vmi_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi" ];

var debug_table_viiiii = [ "0", "__ZNK10__cxxabiv117__class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib", "__ZNK10__cxxabiv120__si_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib", "__ZNK10__cxxabiv121__vmi_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib" ];

var debug_table_viiiiii = [ "0", "__ZNK10__cxxabiv117__class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib", "__ZNK10__cxxabiv120__si_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib", "__ZNK10__cxxabiv121__vmi_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib" ];

function nullFunc_ii(x) {
 err("Invalid function pointer '" + x + "' called with signature 'ii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("This pointer might make sense in another type signature: iii: " + debug_table_iii[x] + "  iiii: " + debug_table_iiii[x] + "  vii: " + debug_table_vii[x] + "  vi: " + debug_table_vi[x] + "  v: " + debug_table_v[x] + "  viiii: " + debug_table_viiii[x] + "  viiiii: " + debug_table_viiiii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  ");
 abort(x);
}

function nullFunc_iii(x) {
 err("Invalid function pointer '" + x + "' called with signature 'iii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("This pointer might make sense in another type signature: ii: " + debug_table_ii[x] + "  iiii: " + debug_table_iiii[x] + "  vii: " + debug_table_vii[x] + "  vi: " + debug_table_vi[x] + "  viiii: " + debug_table_viiii[x] + "  viiiii: " + debug_table_viiiii[x] + "  v: " + debug_table_v[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  ");
 abort(x);
}

function nullFunc_iiii(x) {
 err("Invalid function pointer '" + x + "' called with signature 'iiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("This pointer might make sense in another type signature: iii: " + debug_table_iii[x] + "  ii: " + debug_table_ii[x] + "  viiii: " + debug_table_viiii[x] + "  vii: " + debug_table_vii[x] + "  vi: " + debug_table_vi[x] + "  viiiii: " + debug_table_viiiii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  v: " + debug_table_v[x] + "  ");
 abort(x);
}

function nullFunc_v(x) {
 err("Invalid function pointer '" + x + "' called with signature 'v'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("This pointer might make sense in another type signature: vi: " + debug_table_vi[x] + "  vii: " + debug_table_vii[x] + "  viiii: " + debug_table_viiii[x] + "  viiiii: " + debug_table_viiiii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  ii: " + debug_table_ii[x] + "  iii: " + debug_table_iii[x] + "  iiii: " + debug_table_iiii[x] + "  ");
 abort(x);
}

function nullFunc_vi(x) {
 err("Invalid function pointer '" + x + "' called with signature 'vi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("This pointer might make sense in another type signature: v: " + debug_table_v[x] + "  vii: " + debug_table_vii[x] + "  viiii: " + debug_table_viiii[x] + "  viiiii: " + debug_table_viiiii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  ii: " + debug_table_ii[x] + "  iii: " + debug_table_iii[x] + "  iiii: " + debug_table_iiii[x] + "  ");
 abort(x);
}

function nullFunc_vii(x) {
 err("Invalid function pointer '" + x + "' called with signature 'vii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("This pointer might make sense in another type signature: vi: " + debug_table_vi[x] + "  v: " + debug_table_v[x] + "  viiii: " + debug_table_viiii[x] + "  viiiii: " + debug_table_viiiii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  ii: " + debug_table_ii[x] + "  iii: " + debug_table_iii[x] + "  iiii: " + debug_table_iiii[x] + "  ");
 abort(x);
}

function nullFunc_viiii(x) {
 err("Invalid function pointer '" + x + "' called with signature 'viiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("This pointer might make sense in another type signature: vii: " + debug_table_vii[x] + "  vi: " + debug_table_vi[x] + "  viiiii: " + debug_table_viiiii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  v: " + debug_table_v[x] + "  iiii: " + debug_table_iiii[x] + "  iii: " + debug_table_iii[x] + "  ii: " + debug_table_ii[x] + "  ");
 abort(x);
}

function nullFunc_viiiii(x) {
 err("Invalid function pointer '" + x + "' called with signature 'viiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("This pointer might make sense in another type signature: viiii: " + debug_table_viiii[x] + "  vii: " + debug_table_vii[x] + "  vi: " + debug_table_vi[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  v: " + debug_table_v[x] + "  iiii: " + debug_table_iiii[x] + "  iii: " + debug_table_iii[x] + "  ii: " + debug_table_ii[x] + "  ");
 abort(x);
}

function nullFunc_viiiiii(x) {
 err("Invalid function pointer '" + x + "' called with signature 'viiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("This pointer might make sense in another type signature: viiii: " + debug_table_viiii[x] + "  viiiii: " + debug_table_viiiii[x] + "  vii: " + debug_table_vii[x] + "  vi: " + debug_table_vi[x] + "  v: " + debug_table_v[x] + "  iiii: " + debug_table_iiii[x] + "  iii: " + debug_table_iii[x] + "  ii: " + debug_table_ii[x] + "  ");
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
 "k": nullFunc_viiii,
 "l": nullFunc_viiiii,
 "m": nullFunc_viiiiii,
 "n": _Engine_FillPage,
 "o": _Engine_FilledEllipse,
 "p": _Engine_FilledRectangle,
 "q": _Engine_FilledText,
 "r": _Engine_GetMode,
 "s": _Engine_Init,
 "t": _Engine_MeasureTextWidth,
 "u": _Engine_RoundedRectangle,
 "v": _SDL_GetTicks,
 "w": _SDL_LockSurface,
 "x": _SDL_PollEvent,
 "y": __ZSt18uncaught_exceptionv,
 "z": ___cxa_allocate_exception,
 "A": ___cxa_begin_catch,
 "B": ___cxa_find_matching_catch,
 "C": ___cxa_free_exception,
 "D": ___cxa_throw,
 "E": ___gxx_personality_v0,
 "F": ___lock,
 "G": ___resumeException,
 "H": ___setErrNo,
 "I": ___syscall140,
 "J": ___syscall146,
 "K": ___syscall54,
 "L": ___syscall6,
 "M": ___unlock,
 "N": _abort,
 "O": _emscripten_get_heap_size,
 "P": _emscripten_get_now,
 "Q": _emscripten_memcpy_big,
 "R": _emscripten_resize_heap,
 "S": _emscripten_set_main_loop,
 "T": _emscripten_set_main_loop_timing,
 "U": _getCanvasHeight,
 "V": _getCanvasWidth,
 "W": _pthread_getspecific,
 "X": _pthread_key_create,
 "Y": _pthread_once,
 "Z": _pthread_setspecific,
 "_": abortOnCannotGrowMemory,
 "$": flush_NO_FILESYSTEM,
 "aa": tempDoublePtr,
 "ab": DYNAMICTOP_PTR
};

// EMSCRIPTEN_START_ASM


var asm = (/** @suppress {uselessCode} */ function(global,env,buffer) {
"use asm";var a=new global.Int8Array(buffer),b=new global.Int16Array(buffer),c=new global.Int32Array(buffer),d=new global.Uint8Array(buffer),e=new global.Uint16Array(buffer),f=new global.Float32Array(buffer),g=new global.Float64Array(buffer),h=env.aa|0,i=env.ab|0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0.0,r=global.Math.ceil,s=global.Math.imul,t=global.Math.clz32,u=env.a,v=env.b,w=env.c,x=env.d,y=env.e,z=env.f,A=env.g,B=env.h,C=env.i,D=env.j,E=env.k,F=env.l,G=env.m,H=env.n,I=env.o,J=env.p,K=env.q,L=env.r,M=env.s,N=env.t,O=env.u,P=env.v,Q=env.w,R=env.x,S=env.y,T=env.z,U=env.A,V=env.B,W=env.C,X=env.D,Y=env.E,Z=env.F,_=env.G,$=env.H,aa=env.I,ba=env.J,ca=env.K,da=env.L,ea=env.M,fa=env.N,ga=env.O,ha=env.P,ia=env.Q,ja=env.R,ka=env.S,la=env.T,ma=env.U,na=env.V,oa=env.W,pa=env.X,qa=env.Y,ra=env.Z,sa=env._,ta=env.$,ua=8400,va=5251280,wa=0.0;
// EMSCRIPTEN_START_FUNCS
function Ga(a){a=a|0;var b=0;b=ua;ua=ua+a|0;ua=ua+15&-16;if((ua|0)>=(va|0))x(a|0);return b|0}function Ha(){return ua|0}function Ia(a){a=a|0;ua=a}function Ja(a,b){a=a|0;b=b|0;ua=a;va=b}function Ka(){return 4140}function La(){return 4238}function Ma(){var a=0,b=0;a=c[1872]|0;if(!a){b=T(4)|0;c[b>>2]=3964;X(b|0,2984,25)}else{Ba[c[(c[a>>2]|0)+24>>2]&63](a);return}}function Na(){var a=0,b=0,d=0,e=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0;a=ua;ua=ua+112|0;if((ua|0)>=(va|0))x(112);b=a+32|0;d=a;e=a+88|0;h=a+100|0;i=a+72|0;j=a+96|0;k=a+64|0;l=a+80|0;m=a+56|0;Wc(5573)|0;c[d>>2]=0;g[d+8>>3]=+ha();n=d+16|0;c[n>>2]=0;c[n+4>>2]=0;c[n+8>>2]=0;c[n+12>>2]=0;M();n=ed(28)|0;Oa(n);c[h>>2]=0;c[b>>2]=c[h>>2];Pa(e,n,b);n=ed(28)|0;Qa(n);c[j>>2]=0;c[b>>2]=c[j>>2];Ra(i,n,b);n=ed(28)|0;Sa(n);c[l>>2]=0;c[b>>2]=c[l>>2];Ta(k,n,b);n=c[e>>2]|0;l=e+4|0;j=c[l>>2]|0;h=(j|0)==0;if(h)o=d+24|0;else{p=j+4|0;c[p>>2]=(c[p>>2]|0)+1;c[p>>2]=(c[p>>2]|0)+1;o=d+24|0}c[o>>2]=n;n=d+28|0;o=c[n>>2]|0;c[n>>2]=j;if(o|0?(p=o+4|0,q=c[p>>2]|0,c[p>>2]=q+-1,(q|0)==0):0){Ba[c[(c[o>>2]|0)+8>>2]&63](o);dd(o)}o=c[d+24>>2]|0;q=d+16|0;p=q;r=c[p+4>>2]|0;s=o+20|0;c[s>>2]=c[p>>2];c[s+4>>2]=r;r=c[o+12>>2]|0;if(r|0){s=c[(c[r>>2]|0)+4>>2]|0;f[b>>2]=0.0;f[b+4>>2]=0.0;Da[s&7](r,o,b,q)}if(!h?(h=j+4|0,q=c[h>>2]|0,c[h>>2]=q+-1,(q|0)==0):0){Ba[c[(c[j>>2]|0)+8>>2]&63](j);dd(j)}c[m>>2]=0;j=b+16|0;q=ed(24)|0;c[q>>2]=3416;c[q+4>>2]=m;c[q+8>>2]=d;c[q+12>>2]=e;c[q+16>>2]=i;c[q+20>>2]=k;c[j>>2]=q;Ob(b,7472);q=c[j>>2]|0;if((b|0)!=(q|0)){if(q|0)Ba[c[(c[q>>2]|0)+20>>2]&63](q)}else Ba[c[(c[q>>2]|0)+16>>2]&63](q);ka(2,0,1);q=c[k+4>>2]|0;if(q|0?(k=q+4|0,b=c[k>>2]|0,c[k>>2]=b+-1,(b|0)==0):0){Ba[c[(c[q>>2]|0)+8>>2]&63](q);dd(q)}q=c[i+4>>2]|0;if(q|0?(i=q+4|0,b=c[i>>2]|0,c[i>>2]=b+-1,(b|0)==0):0){Ba[c[(c[q>>2]|0)+8>>2]&63](q);dd(q)}q=c[l>>2]|0;if(q|0?(l=q+4|0,b=c[l>>2]|0,c[l>>2]=b+-1,(b|0)==0):0){Ba[c[(c[q>>2]|0)+8>>2]&63](q);dd(q)}q=c[n>>2]|0;if(!q){ua=a;return 1}n=q+4|0;b=c[n>>2]|0;c[n>>2]=b+-1;if(b|0){ua=a;return 1}Ba[c[(c[q>>2]|0)+8>>2]&63](q);dd(q);ua=a;return 1}function Oa(b){b=b|0;var d=0,e=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0.0,G=0.0,H=0,I=0,J=0,K=0.0,L=0.0,M=0;d=ua;ua=ua+144|0;if((ua|0)>=(va|0))x(144);e=d+96|0;h=d+48|0;i=d;c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;c[b+12>>2]=0;c[b+16>>2]=0;c[b+20>>2]=0;c[b+24>>2]=0;Wc(5580)|0;j=h+8|0;c[j>>2]=0;c[j+4>>2]=0;c[j+8>>2]=0;c[j+12>>2]=0;c[j+16>>2]=0;c[j+20>>2]=0;c[j+24>>2]=0;c[j+28>>2]=0;c[h+40>>2]=2;c[h>>2]=1112014848;c[h+4>>2]=1112014848;f[h+16>>2]=30.0;f[h+20>>2]=30.0;c[h+32>>2]=-7820545;j=b+4|0;k=c[j>>2]|0;l=b+8|0;if(k>>>0<(c[l>>2]|0)>>>0){m=k;n=h;o=m+44|0;do{c[m>>2]=c[n>>2];m=m+4|0;n=n+4|0}while((m|0)<(o|0));k=(c[j>>2]|0)+44|0;c[j>>2]=k;p=k}else{Va(b,h);p=c[j>>2]|0}k=h+8|0;c[k>>2]=0;c[k+4>>2]=0;c[k+8>>2]=0;c[k+12>>2]=0;c[k+16>>2]=0;c[k+20>>2]=0;c[k+24>>2]=0;c[k+28>>2]=0;c[h+40>>2]=3;c[h>>2]=1125515264;c[h+4>>2]=1112014848;c[h+16>>2]=1109393408;c[h+20>>2]=1117782016;c[h+32>>2]=-1148649473;if(p>>>0<(c[l>>2]|0)>>>0){m=p;n=h;o=m+44|0;do{c[m>>2]=c[n>>2];m=m+4|0;n=n+4|0}while((m|0)<(o|0));c[j>>2]=(c[j>>2]|0)+44}else Va(b,h);p=i+11|0;k=i+6|0;q=h+8|0;r=h+40|0;s=h+4|0;t=h+24|0;u=h+32|0;v=h+36|0;w=h+16|0;y=h+20|0;z=h+16|0;A=i+8|0;B=i+40|0;C=i+16|0;D=i+32|0;E=1;do{c[i>>2]=0;c[i+4>>2]=0;c[i+8>>2]=0;a[p>>0]=6;a[i>>0]=a[4337]|0;a[i+1>>0]=a[4338]|0;a[i+2>>0]=a[4339]|0;a[i+3>>0]=a[4340]|0;a[i+4>>0]=a[4341]|0;a[i+5>>0]=a[4342]|0;a[k>>0]=0;F=+(E|0);G=F*10.0;c[q>>2]=0;c[q+4>>2]=0;c[q+8>>2]=0;c[q+12>>2]=0;c[q+16>>2]=0;c[q+20>>2]=0;c[q+24>>2]=0;c[q+28>>2]=0;c[r>>2]=5;c[h>>2]=1112014848;f[s>>2]=F*50.0+120.0;f[t>>2]=G;c[u>>2]=-1;if(!(Xa(7508,i)|0)){H=c[1875]|0;I=(H-(c[1874]|0)|0)/12|0;J=H;if((c[1876]|0)==(J|0))Ya(7496,i);else{ld(J,i);c[1875]=(c[1875]|0)+12}c[(Wa(7508,i)|0)>>2]=I}c[v>>2]=c[(Wa(7508,i)|0)>>2];F=+N(((a[p>>0]|0)<0?c[i>>2]|0:i)|0,+G);f[w>>2]=F;f[y>>2]=G;if((a[p>>0]|0)<0){fd(c[i>>2]|0);K=+f[z>>2];L=+f[y>>2]}else{K=F;L=G}g[e>>3]=K;g[e+8>>3]=L;Uc(4344,e)|0;c[A>>2]=0;c[A+4>>2]=0;c[A+8>>2]=0;c[A+12>>2]=0;c[A+16>>2]=0;c[A+20>>2]=0;c[A+24>>2]=0;c[A+28>>2]=0;c[B>>2]=3;I=h;J=c[I+4>>2]|0;H=i;c[H>>2]=c[I>>2];c[H+4>>2]=J;J=z;H=c[J+4>>2]|0;I=C;c[I>>2]=c[J>>2];c[I+4>>2]=H;c[D>>2]=-1148649473;H=c[j>>2]|0;if(H>>>0<(c[l>>2]|0)>>>0){m=H;n=i;o=m+44|0;do{c[m>>2]=c[n>>2];m=m+4|0;n=n+4|0}while((m|0)<(o|0));H=(c[j>>2]|0)+44|0;c[j>>2]=H;M=H}else{Va(b,i);M=c[j>>2]|0}if((M|0)==(c[l>>2]|0))$a(b,h);else{m=M;n=h;o=m+44|0;do{c[m>>2]=c[n>>2];m=m+4|0;n=n+4|0}while((m|0)<(o|0));c[j>>2]=(c[j>>2]|0)+44}E=E+1|0}while(E>>>0<6);E=e+8|0;c[E>>2]=0;c[E+4>>2]=0;c[e+40>>2]=4;c[e>>2]=1132068864;c[e+4>>2]=1112014848;c[e+16>>2]=1120403456;c[e+20>>2]=1128792064;f[e+24>>2]=15.0;f[e+28>>2]=5.0;c[e+32>>2]=-1;c[e+36>>2]=1442823167;E=c[j>>2]|0;if(E>>>0<(c[l>>2]|0)>>>0){m=E;n=e;o=m+44|0;do{c[m>>2]=c[n>>2];m=m+4|0;n=n+4|0}while((m|0)<(o|0));c[j>>2]=(c[j>>2]|0)+44;ua=d;return}else{Va(b,e);ua=d;return}}function Pa(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0;d=ua;ua=ua+16|0;if((ua|0)>=(va|0))x(16);e=d;c[a>>2]=b;f=ed(16)|0;c[f+4>>2]=0;c[f+8>>2]=0;c[f>>2]=3332;c[f+12>>2]=b;c[a+4>>2]=f;c[e>>2]=b;c[e+4>>2]=b;Bb(a,e);ua=d;return}function Qa(b){b=b|0;var d=0,e=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0;d=ua;ua=ua+192|0;if((ua|0)>=(va|0))x(192);e=d+144|0;g=d+120|0;h=d+140|0;i=d+92|0;j=d+136|0;k=d+128|0;l=d+64|0;m=d+112|0;n=d+104|0;o=d+48|0;p=d+88|0;q=d+80|0;r=d+24|0;s=d+60|0;t=d+40|0;u=d+8|0;v=d+20|0;w=d;c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;c[b+12>>2]=0;c[b+16>>2]=0;c[b+20>>2]=0;c[b+24>>2]=0;Wc(5608)|0;y=e+8|0;c[y>>2]=0;c[y+4>>2]=0;c[y+8>>2]=0;c[y+12>>2]=0;c[y+16>>2]=0;c[y+20>>2]=0;c[y+24>>2]=0;c[y+28>>2]=0;c[e+40>>2]=2;c[e>>2]=1112014848;c[e+4>>2]=1112014848;f[e+16>>2]=30.0;f[e+20>>2]=30.0;c[e+32>>2]=-1711302145;y=b+4|0;z=c[y>>2]|0;if(z>>>0<(c[b+8>>2]|0)>>>0){A=z;B=e;C=A+44|0;do{c[A>>2]=c[B>>2];A=A+4|0;B=B+4|0}while((A|0)<(C|0));c[y>>2]=(c[y>>2]|0)+44}else Va(b,e);y=ed(56)|0;ab(y,b,-1);c[h>>2]=0;c[e>>2]=c[h>>2];bb(g,y,e);y=b+12|0;h=c[g>>2]|0;z=g+4|0;D=c[z>>2]|0;c[g>>2]=0;c[z>>2]=0;c[y>>2]=h;h=b+16|0;E=c[h>>2]|0;c[h>>2]=D;if(E|0?(D=E+4|0,h=c[D>>2]|0,c[D>>2]=h+-1,(h|0)==0):0){Ba[c[(c[E>>2]|0)+8>>2]&63](E);dd(E)}E=c[z>>2]|0;if(E|0?(z=E+4|0,h=c[z>>2]|0,c[z>>2]=h+-1,(h|0)==0):0){Ba[c[(c[E>>2]|0)+8>>2]&63](E);dd(E)}E=c[(c[y>>2]|0)+4>>2]|0;h=c[b>>2]|0;c[h+(E*44|0)+8>>2]=1056964608;c[h+(E*44|0)+12>>2]=1056964608;E=c[(c[y>>2]|0)+4>>2]|0;h=c[b>>2]|0;c[h+(E*44|0)>>2]=1056964608;c[h+(E*44|0)+4>>2]=1056964608;E=c[y>>2]|0;c[E+12>>2]=1056964608;c[E+16>>2]=1056964608;E=ed(56)|0;c[i>>2]=0;c[i+4>>2]=0;c[i+8>>2]=0;h=ed(16)|0;c[i>>2]=h;c[i+8>>2]=-2147483632;c[i+4>>2]=12;A=h;B=4443;C=A+12|0;do{a[A>>0]=a[B>>0]|0;A=A+1|0;B=B+1|0}while((A|0)<(C|0));a[h+12>>0]=0;cb(E,b,i,65535,20.0);c[j>>2]=0;c[e>>2]=c[j>>2];db(g,E,e);if((a[i+11>>0]|0)<0)fd(c[i>>2]|0);E=c[y>>2]|0;j=c[c[E>>2]>>2]|0;c[k>>2]=c[g>>2];h=k+4|0;z=g+4|0;g=c[z>>2]|0;c[h>>2]=g;if(g|0){D=g+4|0;c[D>>2]=(c[D>>2]|0)+1}Ca[j&3](E,k);k=c[h>>2]|0;if(k|0?(h=k+4|0,E=c[h>>2]|0,c[h>>2]=E+-1,(E|0)==0):0){Ba[c[(c[k>>2]|0)+8>>2]&63](k);dd(k)}k=ed(56)|0;c[l>>2]=0;c[l+4>>2]=0;c[l+8>>2]=0;E=ed(16)|0;c[l>>2]=E;c[l+8>>2]=-2147483632;c[l+4>>2]=12;A=E;B=4443;C=A+12|0;do{a[A>>0]=a[B>>0]|0;A=A+1|0;B=B+1|0}while((A|0)<(C|0));a[E+12>>0]=0;cb(k,b,l,65535,20.0);c[m>>2]=0;c[e>>2]=c[m>>2];db(i,k,e);if((a[l+11>>0]|0)<0)fd(c[l>>2]|0);k=c[(c[i>>2]|0)+4>>2]|0;m=c[b>>2]|0;c[m+(k*44|0)>>2]=1065353216;c[m+(k*44|0)+4>>2]=0;k=c[i>>2]|0;c[k+12>>2]=1065353216;c[k+16>>2]=0;m=c[y>>2]|0;E=c[c[m>>2]>>2]|0;c[n>>2]=k;k=n+4|0;h=i+4|0;i=c[h>>2]|0;c[k>>2]=i;if(i|0){j=i+4|0;c[j>>2]=(c[j>>2]|0)+1}Ca[E&3](m,n);n=c[k>>2]|0;if(n|0?(k=n+4|0,m=c[k>>2]|0,c[k>>2]=m+-1,(m|0)==0):0){Ba[c[(c[n>>2]|0)+8>>2]&63](n);dd(n)}n=ed(56)|0;c[o>>2]=0;c[o+4>>2]=0;c[o+8>>2]=0;m=ed(16)|0;c[o>>2]=m;c[o+8>>2]=-2147483632;c[o+4>>2]=12;A=m;B=4443;C=A+12|0;do{a[A>>0]=a[B>>0]|0;A=A+1|0;B=B+1|0}while((A|0)<(C|0));a[m+12>>0]=0;cb(n,b,o,65535,20.0);c[p>>2]=0;c[e>>2]=c[p>>2];db(l,n,e);if((a[o+11>>0]|0)<0)fd(c[o>>2]|0);n=c[(c[l>>2]|0)+4>>2]|0;p=c[b>>2]|0;c[p+(n*44|0)>>2]=0;c[p+(n*44|0)+4>>2]=1065353216;n=c[l>>2]|0;c[n+12>>2]=0;c[n+16>>2]=1065353216;p=c[y>>2]|0;m=c[c[p>>2]>>2]|0;c[q>>2]=n;n=q+4|0;k=l+4|0;l=c[k>>2]|0;c[n>>2]=l;if(l|0){E=l+4|0;c[E>>2]=(c[E>>2]|0)+1}Ca[m&3](p,q);q=c[n>>2]|0;if(q|0?(n=q+4|0,p=c[n>>2]|0,c[n>>2]=p+-1,(p|0)==0):0){Ba[c[(c[q>>2]|0)+8>>2]&63](q);dd(q)}q=ed(56)|0;c[r>>2]=0;c[r+4>>2]=0;c[r+8>>2]=0;p=ed(16)|0;c[r>>2]=p;c[r+8>>2]=-2147483632;c[r+4>>2]=12;A=p;B=4443;C=A+12|0;do{a[A>>0]=a[B>>0]|0;A=A+1|0;B=B+1|0}while((A|0)<(C|0));a[p+12>>0]=0;cb(q,b,r,65535,20.0);c[s>>2]=0;c[e>>2]=c[s>>2];db(o,q,e);if((a[r+11>>0]|0)<0)fd(c[r>>2]|0);q=c[(c[o>>2]|0)+4>>2]|0;s=c[b>>2]|0;c[s+(q*44|0)>>2]=1065353216;c[s+(q*44|0)+4>>2]=1065353216;q=c[o>>2]|0;c[q+12>>2]=1065353216;c[q+16>>2]=1065353216;s=c[y>>2]|0;p=c[c[s>>2]>>2]|0;c[t>>2]=q;q=t+4|0;n=o+4|0;o=c[n>>2]|0;c[q>>2]=o;if(o|0){m=o+4|0;c[m>>2]=(c[m>>2]|0)+1}Ca[p&3](s,t);t=c[q>>2]|0;if(t|0?(q=t+4|0,s=c[q>>2]|0,c[q>>2]=s+-1,(s|0)==0):0){Ba[c[(c[t>>2]|0)+8>>2]&63](t);dd(t)}t=ed(56)|0;c[u>>2]=0;c[u+4>>2]=0;c[u+8>>2]=0;s=ed(16)|0;c[u>>2]=s;c[u+8>>2]=-2147483632;c[u+4>>2]=12;A=s;B=4443;C=A+12|0;do{a[A>>0]=a[B>>0]|0;A=A+1|0;B=B+1|0}while((A|0)<(C|0));a[s+12>>0]=0;cb(t,b,u,65535,20.0);c[v>>2]=0;c[e>>2]=c[v>>2];db(r,t,e);if((a[u+11>>0]|0)<0)fd(c[u>>2]|0);u=c[(c[r>>2]|0)+4>>2]|0;e=c[b>>2]|0;c[e+(u*44|0)>>2]=1056964608;c[e+(u*44|0)+4>>2]=1056964608;u=c[r>>2]|0;c[u+12>>2]=1056964608;c[u+16>>2]=1056964608;e=c[y>>2]|0;y=c[c[e>>2]>>2]|0;c[w>>2]=u;u=w+4|0;b=r+4|0;r=c[b>>2]|0;c[u>>2]=r;if(r|0){t=r+4|0;c[t>>2]=(c[t>>2]|0)+1}Ca[y&3](e,w);w=c[u>>2]|0;if(w|0?(u=w+4|0,e=c[u>>2]|0,c[u>>2]=e+-1,(e|0)==0):0){Ba[c[(c[w>>2]|0)+8>>2]&63](w);dd(w)}w=c[b>>2]|0;do if(w|0){b=w+4|0;e=c[b>>2]|0;c[b>>2]=e+-1;if(e|0)break;Ba[c[(c[w>>2]|0)+8>>2]&63](w);dd(w)}while(0);w=c[n>>2]|0;do if(w|0){n=w+4|0;e=c[n>>2]|0;c[n>>2]=e+-1;if(e|0)break;Ba[c[(c[w>>2]|0)+8>>2]&63](w);dd(w)}while(0);w=c[k>>2]|0;do if(w|0){k=w+4|0;e=c[k>>2]|0;c[k>>2]=e+-1;if(e|0)break;Ba[c[(c[w>>2]|0)+8>>2]&63](w);dd(w)}while(0);w=c[h>>2]|0;do if(w|0){h=w+4|0;e=c[h>>2]|0;c[h>>2]=e+-1;if(e|0)break;Ba[c[(c[w>>2]|0)+8>>2]&63](w);dd(w)}while(0);w=c[z>>2]|0;if(!w){ua=d;return}z=w+4|0;e=c[z>>2]|0;c[z>>2]=e+-1;if(e|0){ua=d;return}Ba[c[(c[w>>2]|0)+8>>2]&63](w);dd(w);ua=d;return}function Ra(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0;d=ua;ua=ua+16|0;if((ua|0)>=(va|0))x(16);e=d;c[a>>2]=b;f=ed(16)|0;c[f+4>>2]=0;c[f+8>>2]=0;c[f>>2]=3360;c[f+12>>2]=b;c[a+4>>2]=f;c[e>>2]=b;c[e+4>>2]=b;Bb(a,e);ua=d;return}function Sa(a){a=a|0;var b=0,d=0,e=0,g=0,h=0,i=0,j=0,k=0,l=0;b=ua;ua=ua+80|0;if((ua|0)>=(va|0))x(80);d=b+24|0;e=b;g=b+16|0;h=b+8|0;c[a>>2]=0;c[a+4>>2]=0;c[a+8>>2]=0;c[a+12>>2]=0;c[a+16>>2]=0;c[a+20>>2]=0;c[a+24>>2]=0;Wc(5635)|0;i=d+8|0;c[i>>2]=0;c[i+4>>2]=0;c[i+8>>2]=0;c[i+12>>2]=0;c[i+16>>2]=0;c[i+20>>2]=0;c[i+24>>2]=0;c[i+28>>2]=0;c[d+40>>2]=2;c[d>>2]=1112014848;c[d+4>>2]=1112014848;f[d+16>>2]=30.0;f[d+20>>2]=30.0;c[d+32>>2]=1722482687;i=a+4|0;j=c[i>>2]|0;if(j>>>0<(c[a+8>>2]|0)>>>0){k=j;j=d;l=k+44|0;do{c[k>>2]=c[j>>2];k=k+4|0;j=j+4|0}while((k|0)<(l|0));c[i>>2]=(c[i>>2]|0)+44}else Va(a,d);i=ed(56)|0;c[g>>2]=20;c[g+4>>2]=30;c[d>>2]=c[g>>2];c[d+4>>2]=c[g+4>>2];vb(i,a,d);c[h>>2]=0;c[d>>2]=c[h>>2];wb(e,i,d);d=a+12|0;i=c[e>>2]|0;h=e+4|0;g=c[h>>2]|0;c[e>>2]=0;c[h>>2]=0;c[d>>2]=i;i=a+16|0;e=c[i>>2]|0;c[i>>2]=g;if(e|0?(g=e+4|0,i=c[g>>2]|0,c[g>>2]=i+-1,(i|0)==0):0){Ba[c[(c[e>>2]|0)+8>>2]&63](e);dd(e)}e=c[h>>2]|0;if(e|0?(h=e+4|0,i=c[h>>2]|0,c[h>>2]=i+-1,(i|0)==0):0){Ba[c[(c[e>>2]|0)+8>>2]&63](e);dd(e)}e=c[d>>2]|0;c[e+40>>2]=1;i=c[e+4>>2]|0;e=c[a>>2]|0;c[e+(i*44|0)+8>>2]=1065353216;c[e+(i*44|0)+12>>2]=1065353216;i=c[(c[d>>2]|0)+4>>2]|0;e=c[a>>2]|0;c[e+(i*44|0)+24>>2]=-1054867456;c[e+(i*44|0)+28>>2]=-1054867456;i=c[(c[d>>2]|0)+4>>2]|0;e=c[a>>2]|0;c[e+(i*44|0)>>2]=1056964608;c[e+(i*44|0)+4>>2]=1056964608;i=c[d>>2]|0;c[i+12>>2]=1056964608;c[i+16>>2]=1056964608;ua=b;return}function Ta(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0;d=ua;ua=ua+16|0;if((ua|0)>=(va|0))x(16);e=d;c[a>>2]=b;f=ed(16)|0;c[f+4>>2]=0;c[f+8>>2]=0;c[f>>2]=3388;c[f+12>>2]=b;c[a+4>>2]=f;c[e>>2]=b;c[e+4>>2]=b;Bb(a,e);ua=d;return}function Ua(a){a=a|0;U(a|0)|0;Nd()}function Va(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;d=a+4|0;e=c[a>>2]|0;f=(c[d>>2]|0)-e|0;g=(f|0)/44|0;h=g+1|0;if(h>>>0>97612893)pd(a);i=a+8|0;j=((c[i>>2]|0)-e|0)/44|0;k=j<<1;l=j>>>0<48806446?(k>>>0<h>>>0?h:k):97612893;do if(l)if(l>>>0>97612893){k=T(8)|0;id(k,4375);c[k>>2]=4088;X(k|0,3112,32)}else{m=ed(l*44|0)|0;break}else m=0;while(0);k=m+(g*44|0)|0;g=m+(l*44|0)|0;l=k;m=b;b=l+44|0;do{c[l>>2]=c[m>>2];l=l+4|0;m=m+4|0}while((l|0)<(b|0));m=k+(((f|0)/-44|0)*44|0)|0;if((f|0)>0)qe(m|0,e|0,f|0)|0;c[a>>2]=m;c[d>>2]=k+44;c[i>>2]=g;if(!e)return;fd(e);return}function Wa(b,e){b=b|0;e=e|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0.0,G=0.0,H=0,I=0,J=0,K=0;g=a[e+11>>0]|0;h=g<<24>>24<0;i=h?c[e>>2]|0:e;j=h?c[e+4>>2]|0:g&255;if(j>>>0>3){g=i;h=j;k=j;while(1){l=s(d[g>>0]|d[g+1>>0]<<8|d[g+2>>0]<<16|d[g+3>>0]<<24,1540483477)|0;h=(s(l>>>24^l,1540483477)|0)^(s(h,1540483477)|0);k=k+-4|0;if(k>>>0<=3)break;else g=g+4|0}g=j+-4|0;k=g&-4;m=g-k|0;n=i+(k+4)|0;o=h}else{m=j;n=i;o=j}switch(m|0){case 3:{p=d[n+2>>0]<<16^o;q=7;break}case 2:{p=o;q=7;break}case 1:{t=o;q=8;break}default:u=o}if((q|0)==7){t=d[n+1>>0]<<8^p;q=8}if((q|0)==8)u=s(t^d[n>>0],1540483477)|0;n=s(u>>>13^u,1540483477)|0;u=n>>>15^n;n=b+4|0;t=c[n>>2]|0;p=(t|0)==0;a:do if(!p){o=t+-1|0;m=(o&t|0)==0;if(!m)if(u>>>0<t>>>0)v=u;else v=(u>>>0)%(t>>>0)|0;else v=u&o;h=c[(c[b>>2]|0)+(v<<2)>>2]|0;if((h|0)!=0?(k=c[h>>2]|0,(k|0)!=0):0){h=(j|0)==0;if(m){if(h){m=k;while(1){g=c[m+4>>2]|0;if(!((g|0)==(u|0)|(g&o|0)==(v|0))){w=v;break a}g=a[m+8+11>>0]|0;if(!((g<<24>>24<0?c[m+12>>2]|0:g&255)|0)){x=m;break}m=c[m>>2]|0;if(!m){w=v;break a}}y=x+20|0;return y|0}m=k;b:while(1){g=c[m+4>>2]|0;if(!((g|0)==(u|0)|(g&o|0)==(v|0))){w=v;break a}g=m+8|0;l=a[g+11>>0]|0;z=l<<24>>24<0;A=l&255;do if(((z?c[m+12>>2]|0:A)|0)==(j|0)){l=c[g>>2]|0;if(z)if(!(Tc(l,i,j)|0)){x=m;q=68;break b}else break;if((a[i>>0]|0)==(l&255)<<24>>24){l=g;B=A;C=i;do{B=B+-1|0;l=l+1|0;if(!B){x=m;q=68;break b}C=C+1|0}while((a[l>>0]|0)==(a[C>>0]|0))}}while(0);m=c[m>>2]|0;if(!m){w=v;break a}}if((q|0)==68){y=x+20|0;return y|0}}if(h){m=k;while(1){o=c[m+4>>2]|0;if((o|0)!=(u|0)){if(o>>>0<t>>>0)D=o;else D=(o>>>0)%(t>>>0)|0;if((D|0)!=(v|0)){w=v;break a}}o=a[m+8+11>>0]|0;if(!((o<<24>>24<0?c[m+12>>2]|0:o&255)|0)){x=m;break}m=c[m>>2]|0;if(!m){w=v;break a}}y=x+20|0;return y|0}m=k;c:while(1){h=c[m+4>>2]|0;if((h|0)!=(u|0)){if(h>>>0<t>>>0)E=h;else E=(h>>>0)%(t>>>0)|0;if((E|0)!=(v|0)){w=v;break a}}h=m+8|0;o=a[h+11>>0]|0;A=o<<24>>24<0;g=o&255;do if(((A?c[m+12>>2]|0:g)|0)==(j|0)){o=c[h>>2]|0;if(A)if(!(Tc(o,i,j)|0)){x=m;q=68;break c}else break;if((a[i>>0]|0)==(o&255)<<24>>24){o=h;z=g;C=i;do{z=z+-1|0;o=o+1|0;if(!z){x=m;q=68;break c}C=C+1|0}while((a[o>>0]|0)==(a[C>>0]|0))}}while(0);m=c[m>>2]|0;if(!m){w=v;break a}}if((q|0)==68){y=x+20|0;return y|0}}else w=v}else w=0;while(0);v=ed(24)|0;ld(v+8|0,e);c[v+20>>2]=0;c[v+4>>2]=u;c[v>>2]=0;e=b+12|0;F=+(((c[e>>2]|0)+1|0)>>>0);G=+f[b+16>>2];do if(p|G*+(t>>>0)<F){i=t<<1|(t>>>0<3|(t+-1&t|0)!=0)&1;j=~~+r(+(F/G))>>>0;Za(b,i>>>0<j>>>0?j:i);i=c[n>>2]|0;j=i+-1|0;if(!(j&i)){H=i;I=j&u;break}if(u>>>0<i>>>0){H=i;I=u}else{H=i;I=(u>>>0)%(i>>>0)|0}}else{H=t;I=w}while(0);w=(c[b>>2]|0)+(I<<2)|0;I=c[w>>2]|0;if(!I){t=b+8|0;c[v>>2]=c[t>>2];c[t>>2]=v;c[w>>2]=t;t=c[v>>2]|0;if(t|0){w=c[t+4>>2]|0;t=H+-1|0;if(t&H)if(w>>>0<H>>>0)J=w;else J=(w>>>0)%(H>>>0)|0;else J=w&t;K=(c[b>>2]|0)+(J<<2)|0;q=66}}else{c[v>>2]=c[I>>2];K=I;q=66}if((q|0)==66)c[K>>2]=v;c[e>>2]=(c[e>>2]|0)+1;x=v;y=x+20|0;return y|0}function Xa(b,e){b=b|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,t=0,u=0,v=0,w=0;f=a[e+11>>0]|0;g=f<<24>>24<0;h=g?c[e>>2]|0:e;i=g?c[e+4>>2]|0:f&255;if(i>>>0>3){f=h;e=i;g=i;while(1){j=s(d[f>>0]|d[f+1>>0]<<8|d[f+2>>0]<<16|d[f+3>>0]<<24,1540483477)|0;e=(s(j>>>24^j,1540483477)|0)^(s(e,1540483477)|0);g=g+-4|0;if(g>>>0<=3)break;else f=f+4|0}f=i+-4|0;g=f&-4;k=f-g|0;l=h+(g+4)|0;m=e}else{k=i;l=h;m=i}switch(k|0){case 3:{n=d[l+2>>0]<<16^m;o=7;break}case 2:{n=m;o=7;break}case 1:{p=m;o=8;break}default:q=m}if((o|0)==7){p=d[l+1>>0]<<8^n;o=8}if((o|0)==8)q=s(p^d[l>>0],1540483477)|0;l=s(q>>>13^q,1540483477)|0;q=l>>>15^l;l=c[b+4>>2]|0;if(!l){r=0;return r|0}p=l+-1|0;n=(p&l|0)==0;if(!n)if(q>>>0<l>>>0)t=q;else t=(q>>>0)%(l>>>0)|0;else t=q&p;m=c[(c[b>>2]|0)+(t<<2)>>2]|0;if(!m){r=0;return r|0}b=c[m>>2]|0;if(!b){r=0;return r|0}m=(i|0)==0;if(n){n=b;a:while(1){k=c[n+4>>2]|0;e=(k|0)==(q|0);if(!(e|(k&p|0)==(t|0))){r=0;o=45;break}do if(e?(k=n+8|0,g=a[k+11>>0]|0,f=g<<24>>24<0,j=g&255,((f?c[n+12>>2]|0:j)|0)==(i|0)):0){g=c[k>>2]|0;u=f?g:k;v=g&255;if(f){if(m){r=n;o=45;break a}if(!(Tc(u,h,i)|0)){r=n;o=45;break a}else break}if(m){r=n;o=45;break a}if((a[h>>0]|0)==v<<24>>24){v=k;k=j;j=h;do{k=k+-1|0;v=v+1|0;if(!k){r=n;o=45;break a}j=j+1|0}while((a[v>>0]|0)==(a[j>>0]|0))}}while(0);n=c[n>>2]|0;if(!n){r=0;o=45;break}}if((o|0)==45)return r|0}n=b;b:while(1){b=c[n+4>>2]|0;do if((b|0)==(q|0)){p=n+8|0;e=a[p+11>>0]|0;j=e<<24>>24<0;v=e&255;if(((j?c[n+12>>2]|0:v)|0)==(i|0)){e=c[p>>2]|0;k=j?e:p;u=e&255;if(j){if(m){r=n;o=45;break b}if(!(Tc(k,h,i)|0)){r=n;o=45;break b}else break}if(m){r=n;o=45;break b}if((a[h>>0]|0)==u<<24>>24){u=p;p=v;v=h;do{p=p+-1|0;u=u+1|0;if(!p){r=n;o=45;break b}v=v+1|0}while((a[u>>0]|0)==(a[v>>0]|0))}}}else{if(b>>>0<l>>>0)w=b;else w=(b>>>0)%(l>>>0)|0;if((w|0)!=(t|0)){r=0;o=45;break b}}while(0);n=c[n>>2]|0;if(!n){r=0;o=45;break}}if((o|0)==45)return r|0;return 0}function Ya(b,d){b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0;e=b+4|0;f=c[b>>2]|0;g=((c[e>>2]|0)-f|0)/12|0;h=g+1|0;if(h>>>0>357913941)pd(b);i=b+8|0;j=((c[i>>2]|0)-f|0)/12|0;f=j<<1;k=j>>>0<178956970?(f>>>0<h>>>0?h:f):357913941;do if(k)if(k>>>0>357913941){f=T(8)|0;id(f,4375);c[f>>2]=4088;X(f|0,3112,32)}else{l=ed(k*12|0)|0;break}else l=0;while(0);f=l+(g*12|0)|0;g=l+(k*12|0)|0;ld(f,d);d=f+12|0;k=c[b>>2]|0;l=c[e>>2]|0;if((l|0)==(k|0)){m=f;n=k;o=k}else{h=l;l=f;do{l=l+-12|0;h=h+-12|0;c[l>>2]=c[h>>2];c[l+4>>2]=c[h+4>>2];c[l+8>>2]=c[h+8>>2];c[h>>2]=0;c[h+4>>2]=0;c[h+8>>2]=0}while((h|0)!=(k|0));m=l;n=c[b>>2]|0;o=c[e>>2]|0}c[b>>2]=m;c[e>>2]=d;c[i>>2]=g;g=n;if((o|0)!=(g|0)){i=o;do{i=i+-12|0;if((a[i+11>>0]|0)<0)fd(c[i>>2]|0)}while((i|0)!=(g|0))}if(!n)return;fd(n);return}function Za(a,b){a=a|0;b=b|0;var d=0,e=0,g=0,h=0;if((b|0)!=1)if(!(b+-1&b))d=b;else d=ad(b)|0;else d=2;b=c[a+4>>2]|0;if(d>>>0>b>>>0){_a(a,d);return}if(d>>>0>=b>>>0)return;e=~~+r(+(+((c[a+12>>2]|0)>>>0)/+f[a+16>>2]))>>>0;if(b>>>0>2&(b+-1&b|0)==0){g=1<<32-(t(e+-1|0)|0);h=e>>>0<2?e:g}else h=ad(e)|0;e=d>>>0<h>>>0?h:d;if(e>>>0>=b>>>0)return;_a(a,e);return}function _a(b,d){b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0;e=b+4|0;if(!d){f=c[b>>2]|0;c[b>>2]=0;if(f|0)fd(f);c[e>>2]=0;return}if(d>>>0>1073741823){f=T(8)|0;id(f,4375);c[f>>2]=4088;X(f|0,3112,32)}f=ed(d<<2)|0;g=c[b>>2]|0;c[b>>2]=f;if(g|0)fd(g);c[e>>2]=d;e=0;do{c[(c[b>>2]|0)+(e<<2)>>2]=0;e=e+1|0}while((e|0)!=(d|0));e=b+8|0;g=c[e>>2]|0;if(!g)return;f=c[g+4>>2]|0;h=d+-1|0;i=(h&d|0)==0;if(!i)if(f>>>0<d>>>0)j=f;else j=(f>>>0)%(d>>>0)|0;else j=f&h;c[(c[b>>2]|0)+(j<<2)>>2]=e;e=c[g>>2]|0;if(!e)return;f=j;j=e;e=g;while(1){g=c[j+4>>2]|0;if(!i)if(g>>>0<d>>>0)k=g;else k=(g>>>0)%(d>>>0)|0;else k=g&h;do if((k|0)==(f|0)){l=f;m=j}else{g=(c[b>>2]|0)+(k<<2)|0;if(!(c[g>>2]|0)){c[g>>2]=e;l=k;m=j;break}g=c[j>>2]|0;a:do if(!g)n=j;else{o=j+8|0;p=a[o+11>>0]|0;q=p<<24>>24<0;r=p&255;p=q?c[j+12>>2]|0:r;s=(p|0)==0;if(q){q=j;t=g;while(1){u=t+8|0;v=a[u+11>>0]|0;w=v<<24>>24<0;if((p|0)!=((w?c[t+12>>2]|0:v&255)|0)){n=q;break a}if(!s?Tc(c[o>>2]|0,w?c[u>>2]|0:u,p)|0:0){n=q;break a}u=c[t>>2]|0;if(!u){n=t;break a}else{w=t;t=u;q=w}}}if(s){q=j;t=g;while(1){w=a[t+8+11>>0]|0;if((w<<24>>24<0?c[t+12>>2]|0:w&255)|0){n=q;break a}w=c[t>>2]|0;if(!w){n=t;break a}else{u=t;t=w;q=u}}}q=j;t=g;while(1){s=t+8|0;u=a[s+11>>0]|0;w=u<<24>>24<0;if((p|0)!=((w?c[t+12>>2]|0:u&255)|0)){n=q;break a}u=w?c[s>>2]|0:s;if((a[u>>0]|0)!=(c[o>>2]&255)<<24>>24){n=q;break a}s=o;w=r;v=u;while(1){w=w+-1|0;s=s+1|0;if(!w)break;v=v+1|0;if((a[s>>0]|0)!=(a[v>>0]|0)){n=q;break a}}v=c[t>>2]|0;if(!v){n=t;break}else{s=t;t=v;q=s}}}while(0);c[e>>2]=c[n>>2];c[n>>2]=c[c[(c[b>>2]|0)+(k<<2)>>2]>>2];c[c[(c[b>>2]|0)+(k<<2)>>2]>>2]=j;l=f;m=e}while(0);j=c[m>>2]|0;if(!j)break;else{f=l;e=m}}return}function $a(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;d=a+4|0;e=c[a>>2]|0;f=(c[d>>2]|0)-e|0;g=(f|0)/44|0;h=g+1|0;if(h>>>0>97612893)pd(a);i=a+8|0;j=((c[i>>2]|0)-e|0)/44|0;k=j<<1;l=j>>>0<48806446?(k>>>0<h>>>0?h:k):97612893;do if(l)if(l>>>0>97612893){k=T(8)|0;id(k,4375);c[k>>2]=4088;X(k|0,3112,32)}else{m=ed(l*44|0)|0;break}else m=0;while(0);k=m+(g*44|0)|0;g=m+(l*44|0)|0;l=k;m=b;b=l+44|0;do{c[l>>2]=c[m>>2];l=l+4|0;m=m+4|0}while((l|0)<(b|0));m=k+(((f|0)/-44|0)*44|0)|0;if((f|0)>0)qe(m|0,e|0,f|0)|0;c[a>>2]=m;c[d>>2]=k+44;c[i>>2]=g;if(!e)return;fd(e);return}function ab(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0;e=ua;ua=ua+48|0;if((ua|0)>=(va|0))x(48);f=e;gb(a,b);c[a>>2]=3184;g=f+8|0;c[g>>2]=0;c[g+4>>2]=0;c[g+8>>2]=0;c[g+12>>2]=0;c[g+16>>2]=0;c[g+20>>2]=0;c[g+24>>2]=0;c[g+28>>2]=0;c[f+40>>2]=3;c[f>>2]=0;c[f+4>>2]=0;c[f+16>>2]=0;c[f+20>>2]=0;c[f+32>>2]=d;d=b+4|0;g=c[d>>2]|0;c[a+8>>2]=(g-(c[b>>2]|0)|0)/44|0;if((c[b+8>>2]|0)==(g|0)){$a(b,f);ua=e;return}else{b=g;g=f;f=b+44|0;do{c[b>>2]=c[g>>2];b=b+4|0;g=g+4|0}while((b|0)<(f|0));c[d>>2]=(c[d>>2]|0)+44;ua=e;return}}function bb(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0;d=ua;ua=ua+16|0;if((ua|0)>=(va|0))x(16);e=d;c[a>>2]=b;f=ed(16)|0;c[f+4>>2]=0;c[f+8>>2]=0;c[f>>2]=3216;c[f+12>>2]=b;c[a+4>>2]=f;c[e>>2]=b;c[e+4>>2]=b;lb(a,e);ua=d;return}function cb(b,d,e,g,h){b=b|0;d=d|0;e=e|0;g=g|0;h=+h;var i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,y=0,z=0,A=0,B=0;i=ua;ua=ua+48|0;if((ua|0)>=(va|0))x(48);j=i;gb(b,d);c[b>>2]=3244;k=j+8|0;c[k>>2]=0;c[k+4>>2]=0;c[k+8>>2]=0;c[k+12>>2]=0;c[k+16>>2]=0;c[k+20>>2]=0;c[k+24>>2]=0;c[k+28>>2]=0;c[j+40>>2]=5;c[j>>2]=0;c[j+4>>2]=0;f[j+24>>2]=h;c[j+32>>2]=g;if(!(Xa(7508,e)|0)){g=c[1875]|0;k=(g-(c[1874]|0)|0)/12|0;l=g;if((c[1876]|0)==(l|0))Ya(7496,e);else{ld(l,e);c[1875]=(c[1875]|0)+12}c[(Wa(7508,e)|0)>>2]=k}c[j+36>>2]=c[(Wa(7508,e)|0)>>2];f[j+16>>2]=+N(((a[e+11>>0]|0)<0?c[e>>2]|0:e)|0,+h);f[j+20>>2]=h;e=d+4|0;k=c[e>>2]|0;c[b+8>>2]=(k-(c[d>>2]|0)|0)/44|0;if((c[d+8>>2]|0)==(k|0)){$a(d,j);m=j+16|0;n=b+4|0;o=c[n>>2]|0;p=c[d>>2]|0;q=p+(o*44|0)+24|0;r=m;s=r;t=c[s>>2]|0;u=r+4|0;v=u;w=c[v>>2]|0;y=q;z=y;c[z>>2]=t;A=y+4|0;B=A;c[B>>2]=w;ua=i;return}else{l=k;k=j;g=l+44|0;do{c[l>>2]=c[k>>2];l=l+4|0;k=k+4|0}while((l|0)<(g|0));c[e>>2]=(c[e>>2]|0)+44;m=j+16|0;n=b+4|0;o=c[n>>2]|0;p=c[d>>2]|0;q=p+(o*44|0)+24|0;r=m;s=r;t=c[s>>2]|0;u=r+4|0;v=u;w=c[v>>2]|0;y=q;z=y;c[z>>2]=t;A=y+4|0;B=A;c[B>>2]=w;ua=i;return}}function db(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0;d=ua;ua=ua+16|0;if((ua|0)>=(va|0))x(16);e=d;c[a>>2]=b;f=ed(16)|0;c[f+4>>2]=0;c[f+8>>2]=0;c[f>>2]=3260;c[f+12>>2]=b;c[a+4>>2]=f;c[e>>2]=b;c[e+4>>2]=b;lb(a,e);ua=d;return}function eb(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0;d=c[b>>2]|0;c[a+8>>2]=c[d+8>>2];e=a+48|0;f=c[e>>2]|0;if((f|0)==(c[a+52>>2]|0)){kb(a+44|0,b);return}c[f>>2]=d;d=c[b+4>>2]|0;c[f+4>>2]=d;if(!d)g=f;else{f=d+4|0;c[f>>2]=(c[f>>2]|0)+1;g=c[e>>2]|0}c[e>>2]=g+8;return}function fb(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0;f=a+28|0;g=a+20|0;jb(a,b,d,e);e=(c[a+4>>2]|0)+1|0;d=c[b>>2]|0;h=g;i=c[h+4>>2]|0;j=d+(e*44|0)|0;c[j>>2]=c[h>>2];c[j+4>>2]=i;i=f;j=c[i+4>>2]|0;h=d+(e*44|0)+16|0;c[h>>2]=c[i>>2];c[h+4>>2]=j;j=c[a+44>>2]|0;h=c[a+48>>2]|0;if((j|0)==(h|0))return;a=j;do{j=c[a>>2]|0;i=c[a+4>>2]|0;if(i){e=i+4|0;c[e>>2]=(c[e>>2]|0)+1;Da[c[(c[j>>2]|0)+4>>2]&7](j,b,g,f);e=i+4|0;d=c[e>>2]|0;c[e>>2]=d+-1;if(!d){Ba[c[(c[i>>2]|0)+8>>2]&63](i);dd(i)}}else Da[c[(c[j>>2]|0)+4>>2]&7](j,b,g,f);a=a+8|0}while((a|0)!=(h|0));return}function gb(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0;d=ua;ua=ua+48|0;if((ua|0)>=(va|0))x(48);e=d;c[a>>2]=3200;f=b+4|0;g=c[f>>2]|0;h=(g-(c[b>>2]|0)|0)/44|0;c[a+4>>2]=h;i=a+8|0;j=a+12|0;a=j+44|0;do{c[j>>2]=0;j=j+4|0}while((j|0)<(a|0));j=e;a=j+40|0;do{c[j>>2]=0;j=j+4|0}while((j|0)<(a|0));c[e+40>>2]=1;c[i>>2]=h;if((c[b+8>>2]|0)==(g|0)){$a(b,e);ua=d;return}else{j=g;g=e;a=j+44|0;do{c[j>>2]=c[g>>2];j=j+4|0;g=g+4|0}while((j|0)<(a|0));c[f>>2]=(c[f>>2]|0)+44;ua=d;return}}function hb(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var h=0,i=0,j=0.0,k=0,l=0.0,m=0.0,n=0,o=0.0,p=0.0,q=0.0,r=0.0,s=0,t=0,u=0,v=0;h=ua;ua=ua+32|0;if((ua|0)>=(va|0))x(32);i=h;j=+f[a+28>>2];k=a+32|0;l=+f[k>>2];m=+f[a+20>>2];n=a+24|0;o=+f[n>>2];jb(a,b,d,e);e=a+20|0;p=+f[n>>2];d=a+28|0;q=+f[d>>2];r=+f[k>>2];g[i>>3]=+f[e>>2];g[i+8>>3]=p;g[i+16>>3]=q;g[i+24>>3]=r;Uc(4504,i)|0;i=c[a+4>>2]|0;s=a+8|0;if((i|0)<(c[s>>2]|0)){t=c[b>>2]|0;u=i;do{u=u+1|0;if(((c[t+(u*44|0)+40>>2]|0)+-2|0)>>>0<4?(i=t+(u*44|0)|0,v=t+(u*44|0)+4|0,r=+f[n>>2]+(+f[v>>2]-o)/l*+f[k>>2],f[i>>2]=+f[e>>2]+(+f[i>>2]-m)/j*+f[d>>2],f[v>>2]=r,(c[t+(u*44|0)+40>>2]|0)!=5):0){v=t+(u*44|0)+16|0;i=t+(u*44|0)+20|0;r=+f[i>>2]/l*+f[k>>2];f[v>>2]=+f[v>>2]/j*+f[d>>2];f[i>>2]=r}}while((u|0)<(c[s>>2]|0))}s=c[a+44>>2]|0;u=c[a+48>>2]|0;if((s|0)==(u|0)){ua=h;return}a=s;do{s=c[a>>2]|0;k=c[a+4>>2]|0;if(k){t=k+4|0;c[t>>2]=(c[t>>2]|0)+1;Da[c[(c[s>>2]|0)+4>>2]&7](s,b,e,d);t=k+4|0;n=c[t>>2]|0;c[t>>2]=n+-1;if(!n){Ba[c[(c[k>>2]|0)+8>>2]&63](k);dd(k)}}else Da[c[(c[s>>2]|0)+4>>2]&7](s,b,e,d);a=a+8|0}while((a|0)!=(u|0));ua=h;return}function ib(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0;jb(a,b,d,e);e=c[a+44>>2]|0;d=c[a+48>>2]|0;if((e|0)==(d|0))return;f=a+20|0;g=a+28|0;a=e;do{e=c[a>>2]|0;h=c[a+4>>2]|0;if(h){i=h+4|0;c[i>>2]=(c[i>>2]|0)+1;Da[c[(c[e>>2]|0)+4>>2]&7](e,b,f,g);i=h+4|0;j=c[i>>2]|0;c[i>>2]=j+-1;if(!j){Ba[c[(c[h>>2]|0)+8>>2]&63](h);dd(h)}}else Da[c[(c[e>>2]|0)+4>>2]&7](e,b,f,g);a=a+8|0}while((a|0)!=(d|0));return}function jb(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var g=0,h=0,i=0.0,j=0.0,k=0,l=0,m=0.0,n=0.0,o=0.0,p=0.0;g=c[a+4>>2]|0;h=c[b>>2]|0;i=+f[h+(g*44|0)+8>>2]*+f[e>>2]+ +f[h+(g*44|0)+24>>2];b=e+4|0;j=+f[h+(g*44|0)+12>>2]*+f[b>>2]+ +f[h+(g*44|0)+28>>2];f[a+28>>2]=i;k=a+32|0;f[k>>2]=j;l=(c[a+40>>2]|0)==1;do if(l){m=+f[a+36>>2];n=j*m;if(n<i){f[a+28>>2]=n;o=n;p=j;break}else{n=i/m;f[k>>2]=n;o=i;p=n;break}}else{o=i;p=j}while(0);j=+f[h+(g*44|0)+20>>2]+(+f[d+4>>2]+ +f[b>>2]*+f[h+(g*44|0)+4>>2]-+f[a+16>>2]*p);f[a+20>>2]=+f[h+(g*44|0)+16>>2]+(+f[d>>2]+ +f[e>>2]*+f[h+(g*44|0)>>2]-+f[a+12>>2]*o);f[a+24>>2]=j;if(!l)return;j=+f[a+36>>2];i=p*j;if(i<o){f[a+28>>2]=i;return}else{f[k>>2]=o/j;return}}function kb(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0;d=a+4|0;e=c[d>>2]|0;f=c[a>>2]|0;g=e-f>>3;h=g+1|0;i=f;j=e;if(h>>>0>536870911)pd(a);e=a+8|0;k=(c[e>>2]|0)-f|0;f=k>>2;l=k>>3>>>0<268435455?(f>>>0<h>>>0?h:f):536870911;do if(l)if(l>>>0>536870911){f=T(8)|0;id(f,4375);c[f>>2]=4088;X(f|0,3112,32)}else{m=ed(l<<3)|0;break}else m=0;while(0);f=m+(g<<3)|0;h=m+(l<<3)|0;c[f>>2]=c[b>>2];l=c[b+4>>2]|0;c[m+(g<<3)+4>>2]=l;if(!l){n=i;o=j}else{j=l+4|0;c[j>>2]=(c[j>>2]|0)+1;n=c[a>>2]|0;o=c[d>>2]|0}j=f+8|0;l=n;if((o|0)==(n|0)){p=f;q=l;r=o}else{i=g+-1-((o+-8-l|0)>>>3)|0;l=o;o=f;do{f=o;o=o+-8|0;g=l;l=l+-8|0;c[o>>2]=c[l>>2];b=g+-4|0;c[f+-4>>2]=c[b>>2];c[l>>2]=0;c[b>>2]=0}while((l|0)!=(n|0));p=m+(i<<3)|0;q=c[a>>2]|0;r=c[d>>2]|0}c[a>>2]=p;c[d>>2]=j;c[e>>2]=h;h=q;if((r|0)!=(h|0)){e=r;do{r=c[e+-4>>2]|0;e=e+-8|0;if(r|0?(j=r+4|0,d=c[j>>2]|0,c[j>>2]=d+-1,(d|0)==0):0){Ba[c[(c[r>>2]|0)+8>>2]&63](r);dd(r)}}while((e|0)!=(h|0))}if(!q)return;fd(q);return}function lb(a,b){a=a|0;b=b|0;return}function mb(a){a=a|0;cd(a);fd(a);return}function nb(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0;b=c[a+12>>2]|0;if(!b)return;c[b>>2]=3200;a=b+44|0;d=c[a>>2]|0;if(d|0){e=b+48|0;f=c[e>>2]|0;if((f|0)==(d|0))g=d;else{h=f;do{f=c[h+-4>>2]|0;h=h+-8|0;if(f|0?(i=f+4|0,j=c[i>>2]|0,c[i>>2]=j+-1,(j|0)==0):0){Ba[c[(c[f>>2]|0)+8>>2]&63](f);dd(f)}}while((h|0)!=(d|0));g=c[a>>2]|0}c[e>>2]=d;fd(g)}fd(b);return}function ob(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==4652?a+12|0:0)|0}function pb(a){a=a|0;fd(a);return}function qb(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0;f=a+28|0;g=a+20|0;jb(a,b,d,e);e=g;d=c[e+4>>2]|0;h=(c[b>>2]|0)+(((c[a+4>>2]|0)+1|0)*44|0)|0;c[h>>2]=c[e>>2];c[h+4>>2]=d;d=c[a+44>>2]|0;h=c[a+48>>2]|0;if((d|0)==(h|0))return;a=d;do{d=c[a>>2]|0;e=c[a+4>>2]|0;if(e){i=e+4|0;c[i>>2]=(c[i>>2]|0)+1;Da[c[(c[d>>2]|0)+4>>2]&7](d,b,g,f);i=e+4|0;j=c[i>>2]|0;c[i>>2]=j+-1;if(!j){Ba[c[(c[e>>2]|0)+8>>2]&63](e);dd(e)}}else Da[c[(c[d>>2]|0)+4>>2]&7](d,b,g,f);a=a+8|0}while((a|0)!=(h|0));return}function rb(a){a=a|0;cd(a);fd(a);return}function sb(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0;b=c[a+12>>2]|0;if(!b)return;c[b>>2]=3200;a=b+44|0;d=c[a>>2]|0;if(d|0){e=b+48|0;f=c[e>>2]|0;if((f|0)==(d|0))g=d;else{h=f;do{f=c[h+-4>>2]|0;h=h+-8|0;if(f|0?(i=f+4|0,j=c[i>>2]|0,c[i>>2]=j+-1,(j|0)==0):0){Ba[c[(c[f>>2]|0)+8>>2]&63](f);dd(f)}}while((h|0)!=(d|0));g=c[a>>2]|0}c[e>>2]=d;fd(g)}fd(b);return}function tb(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==4808?a+12|0:0)|0}function ub(a){a=a|0;fd(a);return}function vb(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0.0,v=0,w=0,y=0,z=0,A=0,B=0.0;e=ua;ua=ua+48|0;if((ua|0)>=(va|0))x(48);g=e;gb(a,b);c[a>>2]=3288;h=c[d>>2]|0;i=c[d+4>>2]|0;if((h|0)>0){d=g+8|0;j=g+40|0;k=g+4|0;l=g+16|0;m=g+20|0;n=g+24|0;o=g+28|0;p=g+32|0;q=g+36|0;r=b+4|0;s=b+8|0;if((i|0)>0){t=0;do{u=+(t|0)*10.0;v=0;do{w=d;c[w>>2]=0;c[w+4>>2]=0;c[j>>2]=4;f[g>>2]=u;f[k>>2]=+(v|0)*10.0;c[l>>2]=1090519040;c[m>>2]=1090519040;f[n>>2]=3.0;f[o>>2]=1.0;c[p>>2]=-1;c[q>>2]=1442822912;w=c[r>>2]|0;if(w>>>0<(c[s>>2]|0)>>>0){y=w;w=g;z=y+44|0;do{c[y>>2]=c[w>>2];y=y+4|0;w=w+4|0}while((y|0)<(z|0));c[r>>2]=(c[r>>2]|0)+44}else Va(b,g);v=v+1|0}while((v|0)<(i|0));t=t+1|0}while((t|0)<(h|0));A=r}else A=r}else A=b+4|0;c[a+8>>2]=(((c[A>>2]|0)-(c[b>>2]|0)|0)/44|0)+-1;u=+(h|0);B=+(i|0);f[a+28>>2]=u*10.0;f[a+32>>2]=B*10.0;f[a+36>>2]=u/B;ua=e;return}function wb(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0;d=ua;ua=ua+16|0;if((ua|0)>=(va|0))x(16);e=d;c[a>>2]=b;f=ed(16)|0;c[f+4>>2]=0;c[f+8>>2]=0;c[f>>2]=3304;c[f+12>>2]=b;c[a+4>>2]=f;c[e>>2]=b;c[e+4>>2]=b;lb(a,e);ua=d;return}function xb(a){a=a|0;cd(a);fd(a);return}function yb(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0;b=c[a+12>>2]|0;if(!b)return;c[b>>2]=3200;a=b+44|0;d=c[a>>2]|0;if(d|0){e=b+48|0;f=c[e>>2]|0;if((f|0)==(d|0))g=d;else{h=f;do{f=c[h+-4>>2]|0;h=h+-8|0;if(f|0?(i=f+4|0,j=c[i>>2]|0,c[i>>2]=j+-1,(j|0)==0):0){Ba[c[(c[f>>2]|0)+8>>2]&63](f);dd(f)}}while((h|0)!=(d|0));g=c[a>>2]|0}c[e>>2]=d;fd(g)}fd(b);return}function zb(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==4953?a+12|0:0)|0}function Ab(a){a=a|0;fd(a);return}function Bb(a,b){a=a|0;b=b|0;return}function Cb(a){a=a|0;cd(a);fd(a);return}function Db(a){a=a|0;var b=0,d=0,e=0;b=c[a+12>>2]|0;if(!b)return;a=c[b+16>>2]|0;if(a|0?(d=a+4|0,e=c[d>>2]|0,c[d>>2]=e+-1,(e|0)==0):0){Ba[c[(c[a>>2]|0)+8>>2]&63](a);dd(a)}a=c[b>>2]|0;if(a|0){c[b+4>>2]=a;fd(a)}fd(b);return}function Eb(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==5086?a+12|0:0)|0}function Fb(a){a=a|0;fd(a);return}function Gb(a){a=a|0;cd(a);fd(a);return}function Hb(a){a=a|0;var b=0,d=0,e=0;b=c[a+12>>2]|0;if(!b)return;a=c[b+16>>2]|0;if(a|0?(d=a+4|0,e=c[d>>2]|0,c[d>>2]=e+-1,(e|0)==0):0){Ba[c[(c[a>>2]|0)+8>>2]&63](a);dd(a)}a=c[b>>2]|0;if(a|0){c[b+4>>2]=a;fd(a)}fd(b);return}function Ib(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==5222?a+12|0:0)|0}function Jb(a){a=a|0;fd(a);return}function Kb(a){a=a|0;cd(a);fd(a);return}function Lb(a){a=a|0;var b=0,d=0,e=0;b=c[a+12>>2]|0;if(!b)return;a=c[b+16>>2]|0;if(a|0?(d=a+4|0,e=c[d>>2]|0,c[d>>2]=e+-1,(e|0)==0):0){Ba[c[(c[a>>2]|0)+8>>2]&63](a);dd(a)}a=c[b>>2]|0;if(a|0){c[b+4>>2]=a;fd(a)}fd(b);return}function Mb(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==5358?a+12|0:0)|0}function Nb(a){a=a|0;fd(a);return}function Ob(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0;d=ua;ua=ua+16|0;if((ua|0)>=(va|0))x(16);e=d;if((b|0)==(a|0)){ua=d;return}f=a+16|0;g=c[f>>2]|0;h=g;i=b+16|0;if((g|0)==(a|0))if((c[i>>2]|0)==(b|0)){Ca[c[(c[g>>2]|0)+12>>2]&3](g,e);j=c[f>>2]|0;Ba[c[(c[j>>2]|0)+16>>2]&63](j);c[f>>2]=0;j=c[i>>2]|0;Ca[c[(c[j>>2]|0)+12>>2]&3](j,a);j=c[i>>2]|0;Ba[c[(c[j>>2]|0)+16>>2]&63](j);c[i>>2]=0;c[f>>2]=a;Ca[c[(c[e>>2]|0)+12>>2]&3](e,b);Ba[c[(c[e>>2]|0)+16>>2]&63](e);c[i>>2]=b;ua=d;return}else{Ca[c[(c[g>>2]|0)+12>>2]&3](g,b);g=c[f>>2]|0;Ba[c[(c[g>>2]|0)+16>>2]&63](g);g=b+16|0;c[f>>2]=c[g>>2];c[g>>2]=b;ua=d;return}else{g=c[i>>2]|0;if((b|0)==(g|0)){Ca[c[(c[g>>2]|0)+12>>2]&3](g,a);b=c[i>>2]|0;Ba[c[(c[b>>2]|0)+16>>2]&63](b);c[i>>2]=c[f>>2];c[f>>2]=a;ua=d;return}else{c[f>>2]=g;c[i>>2]=h;ua=d;return}}}function Pb(a){a=a|0;fd(a);return}function Qb(a){a=a|0;var b=0,d=0;b=ed(24)|0;d=a+4|0;c[b>>2]=3416;a=b+4|0;c[a>>2]=c[d>>2];c[a+4>>2]=c[d+4>>2];c[a+8>>2]=c[d+8>>2];c[a+12>>2]=c[d+12>>2];c[a+16>>2]=c[d+16>>2];return b|0}function Rb(a,b){a=a|0;b=b|0;var d=0;d=a+4|0;c[b>>2]=3416;a=b+4|0;c[a>>2]=c[d>>2];c[a+4>>2]=c[d+4>>2];c[a+8>>2]=c[d+8>>2];c[a+12>>2]=c[d+12>>2];c[a+16>>2]=c[d+16>>2];return}function Sb(a){a=a|0;return}function Tb(a){a=a|0;fd(a);return}function Ub(a){a=a|0;var b=0,d=0,e=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0;b=ua;ua=ua+16|0;if((ua|0)>=(va|0))x(16);d=b;e=L()|0;g=a+4|0;if((e|0)==(c[c[g>>2]>>2]|0)){h=a+8|0;i=c[h>>2]|0;Yb(i);ua=b;return}c[d>>2]=e;Uc(5499,d)|0;c[c[g>>2]>>2]=e;switch(e|0){case 0:{e=c[a+8>>2]|0;g=c[a+12>>2]|0;j=c[g>>2]|0;k=c[g+4>>2]|0;g=(k|0)==0;if(!g){l=k+4|0;c[l>>2]=(c[l>>2]|0)+1;c[l>>2]=(c[l>>2]|0)+1}l=e+24|0;c[l>>2]=j;j=e+28|0;m=c[j>>2]|0;c[j>>2]=k;if(m|0?(j=m+4|0,n=c[j>>2]|0,c[j>>2]=n+-1,(n|0)==0):0){Ba[c[(c[m>>2]|0)+8>>2]&63](m);dd(m)}m=c[l>>2]|0;l=e+16|0;e=l;n=c[e+4>>2]|0;j=m+20|0;c[j>>2]=c[e>>2];c[j+4>>2]=n;n=c[m+12>>2]|0;if(n|0){j=c[(c[n>>2]|0)+4>>2]|0;f[d>>2]=0.0;f[d+4>>2]=0.0;Da[j&7](n,m,d,l)}if(g){h=a+8|0;i=c[h>>2]|0;Yb(i);ua=b;return}g=k+4|0;l=c[g>>2]|0;c[g>>2]=l+-1;if(l|0){h=a+8|0;i=c[h>>2]|0;Yb(i);ua=b;return}Ba[c[(c[k>>2]|0)+8>>2]&63](k);dd(k);h=a+8|0;i=c[h>>2]|0;Yb(i);ua=b;return}case 1:{k=c[a+8>>2]|0;l=c[a+16>>2]|0;g=c[l>>2]|0;m=c[l+4>>2]|0;l=(m|0)==0;if(!l){n=m+4|0;c[n>>2]=(c[n>>2]|0)+1;c[n>>2]=(c[n>>2]|0)+1}n=k+24|0;c[n>>2]=g;g=k+28|0;j=c[g>>2]|0;c[g>>2]=m;if(j|0?(g=j+4|0,e=c[g>>2]|0,c[g>>2]=e+-1,(e|0)==0):0){Ba[c[(c[j>>2]|0)+8>>2]&63](j);dd(j)}j=c[n>>2]|0;n=k+16|0;k=n;e=c[k+4>>2]|0;g=j+20|0;c[g>>2]=c[k>>2];c[g+4>>2]=e;e=c[j+12>>2]|0;if(e|0){g=c[(c[e>>2]|0)+4>>2]|0;f[d>>2]=0.0;f[d+4>>2]=0.0;Da[g&7](e,j,d,n)}if(l){h=a+8|0;i=c[h>>2]|0;Yb(i);ua=b;return}l=m+4|0;n=c[l>>2]|0;c[l>>2]=n+-1;if(n|0){h=a+8|0;i=c[h>>2]|0;Yb(i);ua=b;return}Ba[c[(c[m>>2]|0)+8>>2]&63](m);dd(m);h=a+8|0;i=c[h>>2]|0;Yb(i);ua=b;return}case 2:{m=c[a+8>>2]|0;n=c[a+20>>2]|0;l=c[n>>2]|0;j=c[n+4>>2]|0;n=(j|0)==0;if(!n){e=j+4|0;c[e>>2]=(c[e>>2]|0)+1;c[e>>2]=(c[e>>2]|0)+1}e=m+24|0;c[e>>2]=l;l=m+28|0;g=c[l>>2]|0;c[l>>2]=j;if(g|0?(l=g+4|0,k=c[l>>2]|0,c[l>>2]=k+-1,(k|0)==0):0){Ba[c[(c[g>>2]|0)+8>>2]&63](g);dd(g)}g=c[e>>2]|0;e=m+16|0;m=e;k=c[m+4>>2]|0;l=g+20|0;c[l>>2]=c[m>>2];c[l+4>>2]=k;k=c[g+12>>2]|0;if(k|0){l=c[(c[k>>2]|0)+4>>2]|0;f[d>>2]=0.0;f[d+4>>2]=0.0;Da[l&7](k,g,d,e)}if(n){h=a+8|0;i=c[h>>2]|0;Yb(i);ua=b;return}n=j+4|0;e=c[n>>2]|0;c[n>>2]=e+-1;if(e|0){h=a+8|0;i=c[h>>2]|0;Yb(i);ua=b;return}Ba[c[(c[j>>2]|0)+8>>2]&63](j);dd(j);h=a+8|0;i=c[h>>2]|0;Yb(i);ua=b;return}default:{h=a+8|0;i=c[h>>2]|0;Yb(i);ua=b;return}}}function Vb(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==5561?a+4|0:0)|0}function Wb(a){a=a|0;return 2976}function Xb(a){a=a|0;return}function Yb(a){a=a|0;var b=0,e=0,h=0,i=0,j=0.0,k=0.0,l=0.0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0;b=ua;ua=ua+80|0;if((ua|0)>=(va|0))x(80);e=b+64|0;h=b+48|0;i=b;c[a>>2]=(c[a>>2]|0)+1;j=+ha();H();k=+na();l=+ma();m=a+16|0;n=a+20|0;if(!(k==+f[m>>2]?l==+f[n>>2]:0))o=3;if((o|0)==3?(g[h>>3]=k,g[h+8>>3]=l,Uc(5513,h)|0,f[m>>2]=k,f[n>>2]=l,n=c[a+24>>2]|0,p=m,q=c[p+4>>2]|0,r=n+20|0,c[r>>2]=c[p>>2],c[r+4>>2]=q,q=c[n+12>>2]|0,q|0):0){r=c[(c[q>>2]|0)+4>>2]|0;f[h>>2]=0.0;f[h+4>>2]=0.0;Da[r&7](q,n,h,m)}if(!(R(i|0)|0)){s=c[a>>2]|0;Zb(a,j,s,0);t=a+8|0;g[t>>3]=j;ua=b;return}m=i+8|0;a:while(1){switch(c[i>>2]|0){case 256:{o=8;break a;break}case 512:{h=d[m>>0]|0;c[e>>2]=512;c[e+4>>2]=h;Uc(5541,e)|0;break}default:{}}if(!(R(i|0)|0)){o=11;break}}if((o|0)==8)Nd();else if((o|0)==11){s=c[a>>2]|0;Zb(a,j,s,0);t=a+8|0;g[t>>3]=j;ua=b;return}}function Zb(b,d,e,g){b=b|0;d=+d;e=e|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0.0,q=0,r=0,s=0,t=0,u=0;g=ua;ua=ua+16|0;if((ua|0)>=(va|0))x(16);e=g;h=c[b+24>>2]|0;c[e>>2]=0;b=e+4|0;c[b>>2]=0;i=e+8|0;c[i>>2]=0;j=h+4|0;k=(c[j>>2]|0)-(c[h>>2]|0)|0;l=(k|0)/44|0;if(k){if(l>>>0>97612893)pd(e);m=ed(k)|0;c[b>>2]=m;c[e>>2]=m;c[i>>2]=m+(l*44|0);l=c[h>>2]|0;h=(c[j>>2]|0)-l|0;if((h|0)>0){qe(m|0,l|0,h|0)|0;l=m+(((h>>>0)/44|0)*44|0)|0;c[b>>2]=l;if((l|0)==(m|0)){n=m;o=b}else{l=m;h=0;j=0;do{i=l+(h*44|0)|0;switch(c[l+(h*44|0)+40>>2]|0){case 2:{d=+f[l+(h*44|0)+16>>2];p=+f[l+(h*44|0)+20>>2];I(+(+f[i>>2]+d),+(+f[l+(h*44|0)+4>>2]+p),+d,+p,c[l+(h*44|0)+32>>2]|0);break}case 3:{J(+(+f[i>>2]),+(+f[l+(h*44|0)+4>>2]),+(+f[l+(h*44|0)+16>>2]),+(+f[l+(h*44|0)+20>>2]),c[l+(h*44|0)+32>>2]|0);break}case 4:{O(+(+f[i>>2]),+(+f[l+(h*44|0)+4>>2]),+(+f[l+(h*44|0)+16>>2]),+(+f[l+(h*44|0)+20>>2]),+(+f[l+(h*44|0)+24>>2]),+(+f[l+(h*44|0)+28>>2]),c[l+(h*44|0)+32>>2]|0,c[l+(h*44|0)+36>>2]|0);break}case 5:{k=(c[1874]|0)+((c[l+(h*44|0)+36>>2]|0)*12|0)|0;if((a[k+11>>0]|0)<0)q=c[k>>2]|0;else q=k;p=+f[l+(h*44|0)+24>>2];K(q|0,+(+f[i>>2]),+(+f[l+(h*44|0)+4>>2]+p),+p,c[l+(h*44|0)+32>>2]|0);break}default:{}}h=ie(h|0,j|0,1,0)|0;j=w()|0;l=c[e>>2]|0}while(j>>>0<0|((j|0)==0?h>>>0<(((c[b>>2]|0)-l|0)/44|0)>>>0:0));r=b;s=l;t=9}}else{u=m;t=5}}else{u=0;t=5}if((t|0)==5){r=b;s=u;t=9}if((t|0)==9)if(!s){ua=g;return}else{n=s;o=r}c[o>>2]=n;fd(n);ua=g;return}function _b(){c[1874]=0;c[1875]=0;c[1876]=0;c[1877]=0;c[1878]=0;c[1879]=0;c[1880]=0;c[1881]=1065353216;c[1872]=0;return}function $b(a){a=a|0;var b=0,d=0;b=ua;ua=ua+16|0;if((ua|0)>=(va|0))x(16);d=b;c[d>>2]=ec(c[a+60>>2]|0)|0;a=cc(da(6,d|0)|0)|0;ua=b;return a|0}function ac(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0;e=ua;ua=ua+48|0;if((ua|0)>=(va|0))x(48);f=e+32|0;g=e+16|0;h=e;i=a+28|0;j=c[i>>2]|0;c[h>>2]=j;k=a+20|0;l=(c[k>>2]|0)-j|0;c[h+4>>2]=l;c[h+8>>2]=b;c[h+12>>2]=d;b=l+d|0;l=a+60|0;c[g>>2]=c[l>>2];c[g+4>>2]=h;c[g+8>>2]=2;j=cc(ba(146,g|0)|0)|0;a:do if((b|0)!=(j|0)){g=2;m=b;n=h;o=j;while(1){if((o|0)<0)break;m=m-o|0;p=c[n+4>>2]|0;q=o>>>0>p>>>0;r=q?n+8|0:n;s=g+(q<<31>>31)|0;t=o-(q?p:0)|0;c[r>>2]=(c[r>>2]|0)+t;p=r+4|0;c[p>>2]=(c[p>>2]|0)-t;c[f>>2]=c[l>>2];c[f+4>>2]=r;c[f+8>>2]=s;o=cc(ba(146,f|0)|0)|0;if((m|0)==(o|0)){u=3;break a}else{g=s;n=r}}c[a+16>>2]=0;c[i>>2]=0;c[k>>2]=0;c[a>>2]=c[a>>2]|32;if((g|0)==2)v=0;else v=d-(c[n+4>>2]|0)|0}else u=3;while(0);if((u|0)==3){u=c[a+44>>2]|0;c[a+16>>2]=u+(c[a+48>>2]|0);a=u;c[i>>2]=a;c[k>>2]=a;v=d}ua=e;return v|0}function bc(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0;e=ua;ua=ua+32|0;if((ua|0)>=(va|0))x(32);f=e;g=e+20|0;c[f>>2]=c[a+60>>2];c[f+4>>2]=0;c[f+8>>2]=b;c[f+12>>2]=g;c[f+16>>2]=d;if((cc(aa(140,f|0)|0)|0)<0){c[g>>2]=-1;h=-1}else h=c[g>>2]|0;ua=e;return h|0}function cc(a){a=a|0;var b=0;if(a>>>0>4294963200){c[(dc()|0)>>2]=0-a;b=-1}else b=a;return b|0}function dc(){return 7592}function ec(a){a=a|0;return a|0}function fc(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0;f=ua;ua=ua+32|0;if((ua|0)>=(va|0))x(32);g=f;c[b+36>>2]=1;if((c[b>>2]&64|0)==0?(c[g>>2]=c[b+60>>2],c[g+4>>2]=21523,c[g+8>>2]=f+16,ca(54,g|0)|0):0)a[b+75>>0]=-1;g=ac(b,d,e)|0;ua=f;return g|0}function gc(a){a=a|0;return (a+-48|0)>>>0<10|0}function hc(){return 3712}function ic(b,c){b=b|0;c=c|0;var d=0,e=0,f=0,g=0;d=a[b>>0]|0;e=a[c>>0]|0;if(d<<24>>24==0?1:d<<24>>24!=e<<24>>24){f=e;g=d}else{d=c;c=b;do{c=c+1|0;d=d+1|0;b=a[c>>0]|0;e=a[d>>0]|0}while(!(b<<24>>24==0?1:b<<24>>24!=e<<24>>24));f=e;g=b}return (g&255)-(f&255)|0}function jc(b){b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0;d=b;a:do if(!(d&3)){e=b;f=5}else{g=b;h=d;while(1){if(!(a[g>>0]|0)){i=h;break a}j=g+1|0;h=j;if(!(h&3)){e=j;f=5;break}else g=j}}while(0);if((f|0)==5){f=e;while(1){k=c[f>>2]|0;if(!((k&-2139062144^-2139062144)&k+-16843009))f=f+4|0;else break}if(!((k&255)<<24>>24))l=f;else{k=f;while(1){f=k+1|0;if(!(a[f>>0]|0)){l=f;break}else k=f}}i=l}return i-d|0}function kc(a,b){a=a|0;b=b|0;var c=0;c=jc(a)|0;return ((lc(a,1,c,b)|0)!=(c|0))<<31>>31|0}function lc(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0;f=s(d,b)|0;g=(b|0)==0?0:d;if((c[e+76>>2]|0)>-1){d=(nc(e)|0)==0;h=qc(a,f,e)|0;if(d)i=h;else{mc(e);i=h}}else i=qc(a,f,e)|0;if((i|0)==(f|0))j=g;else j=(i>>>0)/(b>>>0)|0;return j|0}function mc(a){a=a|0;return}function nc(a){a=a|0;return 1}function oc(b,e){b=b|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0;f=ua;ua=ua+16|0;if((ua|0)>=(va|0))x(16);g=f;h=e&255;a[g>>0]=h;i=b+16|0;j=c[i>>2]|0;if(!j)if(!(pc(b)|0)){k=c[i>>2]|0;l=4}else m=-1;else{k=j;l=4}do if((l|0)==4){j=b+20|0;i=c[j>>2]|0;if(i>>>0<k>>>0?(n=e&255,(n|0)!=(a[b+75>>0]|0)):0){c[j>>2]=i+1;a[i>>0]=h;m=n;break}if((za[c[b+36>>2]&7](b,g,1)|0)==1)m=d[g>>0]|0;else m=-1}while(0);ua=f;return m|0}function pc(b){b=b|0;var d=0,e=0,f=0;d=b+74|0;e=a[d>>0]|0;a[d>>0]=e+255|e;e=c[b>>2]|0;if(!(e&8)){c[b+8>>2]=0;c[b+4>>2]=0;d=c[b+44>>2]|0;c[b+28>>2]=d;c[b+20>>2]=d;c[b+16>>2]=d+(c[b+48>>2]|0);f=0}else{c[b>>2]=e|32;f=-1}return f|0}function qc(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0;f=e+16|0;g=c[f>>2]|0;if(!g)if(!(pc(e)|0)){h=c[f>>2]|0;i=5}else j=0;else{h=g;i=5}a:do if((i|0)==5){g=e+20|0;f=c[g>>2]|0;k=f;if((h-f|0)>>>0<d>>>0){j=za[c[e+36>>2]&7](e,b,d)|0;break}b:do if((a[e+75>>0]|0)<0|(d|0)==0){l=0;m=b;n=d;o=k}else{f=d;while(1){p=f+-1|0;if((a[b+p>>0]|0)==10)break;if(!p){l=0;m=b;n=d;o=k;break b}else f=p}p=za[c[e+36>>2]&7](e,b,f)|0;if(p>>>0<f>>>0){j=p;break a}l=f;m=b+f|0;n=d-f|0;o=c[g>>2]|0}while(0);qe(o|0,m|0,n|0)|0;c[g>>2]=(c[g>>2]|0)+n;j=l+n|0}while(0);return j|0}function rc(a,b){a=a|0;b=b|0;var d=0;if(!b)d=0;else d=sc(c[b>>2]|0,c[b+4>>2]|0,a)|0;return ((d|0)==0?a:d)|0}function sc(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0;f=(c[b>>2]|0)+1794895138|0;g=tc(c[b+8>>2]|0,f)|0;h=tc(c[b+12>>2]|0,f)|0;i=tc(c[b+16>>2]|0,f)|0;a:do if((g>>>0<d>>>2>>>0?(j=d-(g<<2)|0,h>>>0<j>>>0&i>>>0<j>>>0):0)?((i|h)&3|0)==0:0){j=h>>>2;k=i>>>2;l=0;m=g;while(1){n=m>>>1;o=l+n|0;p=o<<1;q=p+j|0;r=tc(c[b+(q<<2)>>2]|0,f)|0;s=tc(c[b+(q+1<<2)>>2]|0,f)|0;if(!(s>>>0<d>>>0&r>>>0<(d-s|0)>>>0)){t=0;break a}if(a[b+(s+r)>>0]|0){t=0;break a}r=ic(e,b+s|0)|0;if(!r)break;s=(r|0)<0;if((m|0)==1){t=0;break a}l=s?l:o;m=s?n:m-n|0}m=p+k|0;l=tc(c[b+(m<<2)>>2]|0,f)|0;j=tc(c[b+(m+1<<2)>>2]|0,f)|0;if(j>>>0<d>>>0&l>>>0<(d-j|0)>>>0)t=(a[b+(j+l)>>0]|0)==0?b+j|0:0;else t=0}else t=0;while(0);return t|0}function tc(a,b){a=a|0;b=b|0;var c=0;c=pe(a|0)|0;return ((b|0)==0?a:c)|0}function uc(){Z(7596);return 7604}function vc(){ea(7596);return}function wc(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0;do if(a){if((c[a+76>>2]|0)<=-1){b=xc(a)|0;break}d=(nc(a)|0)==0;e=xc(a)|0;if(d)b=e;else{mc(a);b=e}}else{if(!(c[927]|0))f=0;else f=wc(c[927]|0)|0;e=c[(uc()|0)>>2]|0;if(!e)g=f;else{d=e;e=f;while(1){if((c[d+76>>2]|0)>-1)h=nc(d)|0;else h=0;if((c[d+20>>2]|0)>>>0>(c[d+28>>2]|0)>>>0)i=xc(d)|0|e;else i=e;if(h|0)mc(d);d=c[d+56>>2]|0;if(!d){g=i;break}else e=i}}vc();b=g}while(0);return b|0}function xc(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0;b=a+20|0;d=a+28|0;if((c[b>>2]|0)>>>0>(c[d>>2]|0)>>>0?(za[c[a+36>>2]&7](a,0,0)|0,(c[b>>2]|0)==0):0)e=-1;else{f=a+4|0;g=c[f>>2]|0;h=a+8|0;i=c[h>>2]|0;if(g>>>0<i>>>0)za[c[a+40>>2]&7](a,g-i|0,1)|0;c[a+16>>2]=0;c[d>>2]=0;c[b>>2]=0;c[h>>2]=0;c[f>>2]=0;e=0}return e|0}function yc(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,t=0,u=0,v=0,w=0,x=0,y=0;f=d&255;g=(e|0)!=0;a:do if(g&(b&3|0)!=0){h=d&255;i=b;j=e;while(1){if((a[i>>0]|0)==h<<24>>24){k=i;l=j;m=6;break a}n=i+1|0;o=j+-1|0;p=(o|0)!=0;if(p&(n&3|0)!=0){i=n;j=o}else{q=n;r=o;t=p;m=5;break}}}else{q=b;r=e;t=g;m=5}while(0);if((m|0)==5)if(t){k=q;l=r;m=6}else m=16;b:do if((m|0)==6){r=d&255;if((a[k>>0]|0)==r<<24>>24)if(!l){m=16;break}else{u=k;break}q=s(f,16843009)|0;c:do if(l>>>0>3){t=k;g=l;while(1){e=c[t>>2]^q;if((e&-2139062144^-2139062144)&e+-16843009|0){v=g;w=t;break c}e=t+4|0;b=g+-4|0;if(b>>>0>3){t=e;g=b}else{x=e;y=b;m=11;break}}}else{x=k;y=l;m=11}while(0);if((m|0)==11)if(!y){m=16;break}else{v=y;w=x}q=w;g=v;while(1){if((a[q>>0]|0)==r<<24>>24){u=q;break b}g=g+-1|0;if(!g){m=16;break}else q=q+1|0}}while(0);if((m|0)==16)u=0;return u|0}function zc(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0;f=ua;ua=ua+224|0;if((ua|0)>=(va|0))x(224);g=f+208|0;h=f+160|0;i=f+80|0;j=f;k=h;l=k+40|0;do{c[k>>2]=0;k=k+4|0}while((k|0)<(l|0));c[g>>2]=c[e>>2];if((Ac(0,d,g,i,h)|0)<0)m=-1;else{if((c[b+76>>2]|0)>-1)n=nc(b)|0;else n=0;e=c[b>>2]|0;k=e&32;if((a[b+74>>0]|0)<1)c[b>>2]=e&-33;e=b+48|0;if(!(c[e>>2]|0)){l=b+44|0;o=c[l>>2]|0;c[l>>2]=j;p=b+28|0;c[p>>2]=j;q=b+20|0;c[q>>2]=j;c[e>>2]=80;r=b+16|0;c[r>>2]=j+80;j=Ac(b,d,g,i,h)|0;if(!o)s=j;else{za[c[b+36>>2]&7](b,0,0)|0;t=(c[q>>2]|0)==0?-1:j;c[l>>2]=o;c[e>>2]=0;c[r>>2]=0;c[p>>2]=0;c[q>>2]=0;s=t}}else s=Ac(b,d,g,i,h)|0;h=c[b>>2]|0;c[b>>2]=h|k;if(n|0)mc(b);m=(h&32|0)==0?s:-1}ua=f;return m|0}function Ac(d,e,f,h,i){d=d|0;e=e|0;f=f|0;h=h|0;i=i|0;var j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ba=0,ca=0,da=0,ea=0,fa=0,ga=0,ha=0,ia=0,ja=0,ka=0,la=0,ma=0,na=0,oa=0,pa=0,qa=0,ra=0,sa=0,ta=0,wa=0,xa=0,ya=0,za=0,Aa=0,Ba=0,Ca=0,Da=0,Ea=0,Fa=0;j=ua;ua=ua+64|0;if((ua|0)>=(va|0))x(64);k=j+56|0;l=j+40|0;m=j;n=j+48|0;o=j+60|0;c[k>>2]=e;e=(d|0)!=0;p=m+40|0;q=p;r=m+39|0;m=n+4|0;s=0;t=0;u=0;a:while(1){v=s;y=t;while(1){do if((y|0)>-1)if((v|0)>(2147483647-y|0)){c[(dc()|0)>>2]=75;z=-1;break}else{z=v+y|0;break}else z=y;while(0);A=c[k>>2]|0;B=a[A>>0]|0;if(!(B<<24>>24)){C=94;break a}D=B;B=A;b:while(1){switch(D<<24>>24){case 37:{C=10;break b;break}case 0:{E=B;break b;break}default:{}}F=B+1|0;c[k>>2]=F;D=a[F>>0]|0;B=F}c:do if((C|0)==10){C=0;D=B;F=B;while(1){if((a[F+1>>0]|0)!=37){E=D;break c}G=D+1|0;F=F+2|0;c[k>>2]=F;if((a[F>>0]|0)!=37){E=G;break}else D=G}}while(0);v=E-A|0;if(e)Bc(d,A,v);if(!v)break;else y=z}y=(gc(a[(c[k>>2]|0)+1>>0]|0)|0)==0;v=c[k>>2]|0;if(!y?(a[v+2>>0]|0)==36:0){H=(a[v+1>>0]|0)+-48|0;I=1;J=3}else{H=-1;I=u;J=1}y=v+J|0;c[k>>2]=y;v=a[y>>0]|0;B=(v<<24>>24)+-32|0;if(B>>>0>31|(1<<B&75913|0)==0){K=0;L=v;M=y}else{v=0;D=B;B=y;while(1){y=1<<D|v;F=B+1|0;c[k>>2]=F;G=a[F>>0]|0;D=(G<<24>>24)+-32|0;if(D>>>0>31|(1<<D&75913|0)==0){K=y;L=G;M=F;break}else{v=y;B=F}}}if(L<<24>>24==42){if((gc(a[M+1>>0]|0)|0)!=0?(B=c[k>>2]|0,(a[B+2>>0]|0)==36):0){v=B+1|0;c[i+((a[v>>0]|0)+-48<<2)>>2]=10;N=c[h+((a[v>>0]|0)+-48<<3)>>2]|0;O=1;P=B+3|0}else{if(I|0){Q=-1;break}if(e){B=(c[f>>2]|0)+(4-1)&~(4-1);v=c[B>>2]|0;c[f>>2]=B+4;R=v}else R=0;N=R;O=0;P=(c[k>>2]|0)+1|0}c[k>>2]=P;v=(N|0)<0;S=v?0-N|0:N;T=v?K|8192:K;U=O;V=P}else{v=Cc(k)|0;if((v|0)<0){Q=-1;break}S=v;T=K;U=I;V=c[k>>2]|0}do if((a[V>>0]|0)==46){v=V+1|0;if((a[v>>0]|0)!=42){c[k>>2]=v;v=Cc(k)|0;W=v;X=c[k>>2]|0;break}if(gc(a[V+2>>0]|0)|0?(v=c[k>>2]|0,(a[v+3>>0]|0)==36):0){B=v+2|0;c[i+((a[B>>0]|0)+-48<<2)>>2]=10;D=c[h+((a[B>>0]|0)+-48<<3)>>2]|0;B=v+4|0;c[k>>2]=B;W=D;X=B;break}if(U|0){Q=-1;break a}if(e){B=(c[f>>2]|0)+(4-1)&~(4-1);D=c[B>>2]|0;c[f>>2]=B+4;Y=D}else Y=0;D=(c[k>>2]|0)+2|0;c[k>>2]=D;W=Y;X=D}else{W=-1;X=V}while(0);D=0;B=X;while(1){if(((a[B>>0]|0)+-65|0)>>>0>57){Q=-1;break a}v=B;B=B+1|0;c[k>>2]=B;Z=a[(a[v>>0]|0)+-65+(16+(D*58|0))>>0]|0;_=Z&255;if((_+-1|0)>>>0>=8)break;else D=_}if(!(Z<<24>>24)){Q=-1;break}v=(H|0)>-1;do if(Z<<24>>24==19)if(v){Q=-1;break a}else C=54;else{if(v){c[i+(H<<2)>>2]=_;F=h+(H<<3)|0;y=c[F+4>>2]|0;G=l;c[G>>2]=c[F>>2];c[G+4>>2]=y;C=54;break}if(!e){Q=0;break a}Dc(l,_,f);$=c[k>>2]|0;C=55}while(0);if((C|0)==54){C=0;if(e){$=B;C=55}else aa=0}d:do if((C|0)==55){C=0;v=a[$+-1>>0]|0;y=(D|0)!=0&(v&15|0)==3?v&-33:v;v=T&-65537;G=(T&8192|0)==0?T:v;e:do switch(y|0){case 110:{switch((D&255)<<24>>24){case 0:{c[c[l>>2]>>2]=z;aa=0;break d;break}case 1:{c[c[l>>2]>>2]=z;aa=0;break d;break}case 2:{F=c[l>>2]|0;c[F>>2]=z;c[F+4>>2]=((z|0)<0)<<31>>31;aa=0;break d;break}case 3:{b[c[l>>2]>>1]=z;aa=0;break d;break}case 4:{a[c[l>>2]>>0]=z;aa=0;break d;break}case 6:{c[c[l>>2]>>2]=z;aa=0;break d;break}case 7:{F=c[l>>2]|0;c[F>>2]=z;c[F+4>>2]=((z|0)<0)<<31>>31;aa=0;break d;break}default:{aa=0;break d}}break}case 112:{ba=120;ca=W>>>0>8?W:8;da=G|8;C=67;break}case 88:case 120:{ba=y;ca=W;da=G;C=67;break}case 111:{F=l;ea=c[F>>2]|0;fa=c[F+4>>2]|0;F=Fc(ea,fa,p)|0;ga=q-F|0;ha=F;ia=0;ja=5663;ka=(G&8|0)==0|(W|0)>(ga|0)?W:ga+1|0;la=G;ma=ea;na=fa;C=73;break}case 105:case 100:{fa=l;ea=c[fa>>2]|0;ga=c[fa+4>>2]|0;if((ga|0)<0){fa=je(0,0,ea|0,ga|0)|0;F=w()|0;oa=l;c[oa>>2]=fa;c[oa+4>>2]=F;pa=1;qa=5663;ra=fa;sa=F;C=72;break e}else{pa=(G&2049|0)!=0&1;qa=(G&2048|0)==0?((G&1|0)==0?5663:5665):5664;ra=ea;sa=ga;C=72;break e}break}case 117:{ga=l;pa=0;qa=5663;ra=c[ga>>2]|0;sa=c[ga+4>>2]|0;C=72;break}case 99:{a[r>>0]=c[l>>2];ta=r;wa=0;xa=5663;ya=1;za=v;Aa=q;break}case 109:{Ba=Hc(c[(dc()|0)>>2]|0)|0;C=77;break}case 115:{ga=c[l>>2]|0;Ba=(ga|0)==0?5673:ga;C=77;break}case 67:{c[n>>2]=c[l>>2];c[m>>2]=0;c[l>>2]=n;Ca=-1;C=81;break}case 83:{if(!W){Ic(d,32,S,0,G);Da=0;C=91}else{Ca=W;C=81}break}case 65:case 71:case 70:case 69:case 97:case 103:case 102:case 101:{aa=Kc(d,+g[l>>3],S,W,G,y)|0;break d;break}default:{ta=A;wa=0;xa=5663;ya=W;za=G;Aa=q}}while(0);f:do if((C|0)==67){C=0;y=l;ga=c[y>>2]|0;ea=c[y+4>>2]|0;y=Ec(ga,ea,p,ba&32)|0;F=(da&8|0)==0|(ga|0)==0&(ea|0)==0;ha=y;ia=F?0:2;ja=F?5663:5663+(ba>>>4)|0;ka=ca;la=da;ma=ga;na=ea;C=73}else if((C|0)==72){C=0;ha=Gc(ra,sa,p)|0;ia=pa;ja=qa;ka=W;la=G;ma=ra;na=sa;C=73}else if((C|0)==77){C=0;ea=yc(Ba,0,W)|0;ga=(ea|0)==0;ta=Ba;wa=0;xa=5663;ya=ga?W:ea-Ba|0;za=v;Aa=ga?Ba+W|0:ea}else if((C|0)==81){C=0;ea=c[l>>2]|0;ga=0;while(1){F=c[ea>>2]|0;if(!F){Ea=ga;break}y=Jc(o,F)|0;Fa=(y|0)<0;if(Fa|y>>>0>(Ca-ga|0)>>>0){C=85;break}F=y+ga|0;if(Ca>>>0>F>>>0){ea=ea+4|0;ga=F}else{Ea=F;break}}if((C|0)==85){C=0;if(Fa){Q=-1;break a}else Ea=ga}Ic(d,32,S,Ea,G);if(!Ea){Da=0;C=91}else{ea=c[l>>2]|0;F=0;while(1){y=c[ea>>2]|0;if(!y){Da=Ea;C=91;break f}fa=Jc(o,y)|0;F=fa+F|0;if((F|0)>(Ea|0)){Da=Ea;C=91;break f}Bc(d,o,fa);if(F>>>0>=Ea>>>0){Da=Ea;C=91;break}else ea=ea+4|0}}}while(0);if((C|0)==73){C=0;v=(ma|0)!=0|(na|0)!=0;ea=(ka|0)!=0|v;F=q-ha+((v^1)&1)|0;ta=ea?ha:p;wa=ia;xa=ja;ya=ea?((ka|0)>(F|0)?ka:F):0;za=(ka|0)>-1?la&-65537:la;Aa=q}else if((C|0)==91){C=0;Ic(d,32,S,Da,G^8192);aa=(S|0)>(Da|0)?S:Da;break}F=Aa-ta|0;ea=(ya|0)<(F|0)?F:ya;v=ea+wa|0;ga=(S|0)<(v|0)?v:S;Ic(d,32,ga,v,za);Bc(d,xa,wa);Ic(d,48,ga,v,za^65536);Ic(d,48,ea,F,0);Bc(d,ta,F);Ic(d,32,ga,v,za^8192);aa=ga}while(0);s=aa;t=z;u=U}g:do if((C|0)==94)if(!d)if(!u)Q=0;else{U=1;while(1){t=c[i+(U<<2)>>2]|0;if(!t)break;Dc(h+(U<<3)|0,t,f);t=U+1|0;if(t>>>0<10)U=t;else{Q=1;break g}}t=U;while(1){if(c[i+(t<<2)>>2]|0){Q=-1;break g}t=t+1|0;if(t>>>0>=10){Q=1;break}}}else Q=z;while(0);ua=j;return Q|0}function Bc(a,b,d){a=a|0;b=b|0;d=d|0;if(!(c[a>>2]&32))qc(b,d,a)|0;return}function Cc(b){b=b|0;var d=0,e=0,f=0,g=0,h=0;if(!(gc(a[c[b>>2]>>0]|0)|0))d=0;else{e=0;while(1){f=c[b>>2]|0;g=(e*10|0)+-48+(a[f>>0]|0)|0;h=f+1|0;c[b>>2]=h;if(!(gc(a[h>>0]|0)|0)){d=g;break}else e=g}}return d|0}function Dc(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,h=0,i=0,j=0.0;a:do if(b>>>0<=20)do switch(b|0){case 9:{e=(c[d>>2]|0)+(4-1)&~(4-1);f=c[e>>2]|0;c[d>>2]=e+4;c[a>>2]=f;break a;break}case 10:{f=(c[d>>2]|0)+(4-1)&~(4-1);e=c[f>>2]|0;c[d>>2]=f+4;f=a;c[f>>2]=e;c[f+4>>2]=((e|0)<0)<<31>>31;break a;break}case 11:{e=(c[d>>2]|0)+(4-1)&~(4-1);f=c[e>>2]|0;c[d>>2]=e+4;e=a;c[e>>2]=f;c[e+4>>2]=0;break a;break}case 12:{e=(c[d>>2]|0)+(8-1)&~(8-1);f=e;h=c[f>>2]|0;i=c[f+4>>2]|0;c[d>>2]=e+8;e=a;c[e>>2]=h;c[e+4>>2]=i;break a;break}case 13:{i=(c[d>>2]|0)+(4-1)&~(4-1);e=c[i>>2]|0;c[d>>2]=i+4;i=(e&65535)<<16>>16;e=a;c[e>>2]=i;c[e+4>>2]=((i|0)<0)<<31>>31;break a;break}case 14:{i=(c[d>>2]|0)+(4-1)&~(4-1);e=c[i>>2]|0;c[d>>2]=i+4;i=a;c[i>>2]=e&65535;c[i+4>>2]=0;break a;break}case 15:{i=(c[d>>2]|0)+(4-1)&~(4-1);e=c[i>>2]|0;c[d>>2]=i+4;i=(e&255)<<24>>24;e=a;c[e>>2]=i;c[e+4>>2]=((i|0)<0)<<31>>31;break a;break}case 16:{i=(c[d>>2]|0)+(4-1)&~(4-1);e=c[i>>2]|0;c[d>>2]=i+4;i=a;c[i>>2]=e&255;c[i+4>>2]=0;break a;break}case 17:{i=(c[d>>2]|0)+(8-1)&~(8-1);j=+g[i>>3];c[d>>2]=i+8;g[a>>3]=j;break a;break}case 18:{i=(c[d>>2]|0)+(8-1)&~(8-1);j=+g[i>>3];c[d>>2]=i+8;g[a>>3]=j;break a;break}default:break a}while(0);while(0);return}function Ec(b,c,e,f){b=b|0;c=c|0;e=e|0;f=f|0;var g=0,h=0;if((b|0)==0&(c|0)==0)g=e;else{h=e;e=c;c=b;while(1){b=h+-1|0;a[b>>0]=d[480+(c&15)>>0]|0|f;c=ne(c|0,e|0,4)|0;e=w()|0;if((c|0)==0&(e|0)==0){g=b;break}else h=b}}return g|0}function Fc(b,c,d){b=b|0;c=c|0;d=d|0;var e=0,f=0;if((b|0)==0&(c|0)==0)e=d;else{f=d;d=c;c=b;while(1){b=f+-1|0;a[b>>0]=c&7|48;c=ne(c|0,d|0,3)|0;d=w()|0;if((c|0)==0&(d|0)==0){e=b;break}else f=b}}return e|0}function Gc(b,c,d){b=b|0;c=c|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;if(c>>>0>0|(c|0)==0&b>>>0>4294967295){e=d;f=b;g=c;do{c=f;f=me(f|0,g|0,10,0)|0;h=g;g=w()|0;i=he(f|0,g|0,10,0)|0;j=je(c|0,h|0,i|0,w()|0)|0;w()|0;e=e+-1|0;a[e>>0]=j&255|48}while(h>>>0>9|(h|0)==9&c>>>0>4294967295);k=f;l=e}else{k=b;l=d}if(!k)m=l;else{d=k;k=l;while(1){l=d;d=(d>>>0)/10|0;b=k+-1|0;a[b>>0]=l-(d*10|0)|48;if(l>>>0<10){m=b;break}else k=b}}return m|0}function Hc(a){a=a|0;return Rc(a,c[(Qc()|0)+188>>2]|0)|0}function Ic(a,b,c,d,e){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;var f=0,g=0,h=0;f=ua;ua=ua+256|0;if((ua|0)>=(va|0))x(256);g=f;if((c|0)>(d|0)&(e&73728|0)==0){e=c-d|0;re(g|0,b<<24>>24|0,(e>>>0<256?e:256)|0)|0;if(e>>>0>255){b=c-d|0;d=e;do{Bc(a,g,256);d=d+-256|0}while(d>>>0>255);h=b&255}else h=e;Bc(a,g,h)}ua=f;return}function Jc(a,b){a=a|0;b=b|0;var c=0;if(!a)c=0;else c=Oc(a,b,0)|0;return c|0}function Kc(b,e,f,g,h,i){b=b|0;e=+e;f=f|0;g=g|0;h=h|0;i=i|0;var j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,t=0.0,u=0,v=0.0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0.0,H=0,I=0,J=0,K=0.0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0.0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ba=0,ca=0,da=0,ea=0,fa=0,ga=0,ha=0,ia=0.0,ja=0.0,ka=0,la=0,ma=0,na=0,oa=0,pa=0,qa=0,ra=0,sa=0,ta=0,wa=0,xa=0,ya=0,za=0,Aa=0,Ba=0,Ca=0,Da=0,Ea=0,Fa=0,Ga=0,Ha=0,Ia=0,Ja=0,Ka=0;j=ua;ua=ua+560|0;if((ua|0)>=(va|0))x(560);k=j+32|0;l=j+536|0;m=j;n=m;o=j+540|0;c[l>>2]=0;p=o+12|0;q=Lc(e)|0;r=w()|0;if((r|0)<0){t=-e;u=Lc(t)|0;v=t;y=1;z=5680;A=w()|0;B=u}else{v=e;y=(h&2049|0)!=0&1;z=(h&2048|0)==0?((h&1|0)==0?5681:5686):5683;A=r;B=q}do if(0==0&(A&2146435072|0)==2146435072){q=(i&32|0)!=0;B=y+3|0;Ic(b,32,f,B,h&-65537);Bc(b,z,y);Bc(b,v!=v|0.0!=0.0?(q?5707:5711):q?5699:5703,3);Ic(b,32,f,B,h^8192);C=B}else{e=+Mc(v,l)*2.0;B=e!=0.0;if(B)c[l>>2]=(c[l>>2]|0)+-1;q=i|32;if((q|0)==97){r=i&32;u=(r|0)==0?z:z+9|0;D=y|2;E=12-g|0;do if(!(g>>>0>11|(E|0)==0)){t=8.0;F=E;do{F=F+-1|0;t=t*16.0}while((F|0)!=0);if((a[u>>0]|0)==45){G=-(t+(-e-t));break}else{G=e+t-t;break}}else G=e;while(0);E=c[l>>2]|0;F=(E|0)<0?0-E|0:E;H=Gc(F,((F|0)<0)<<31>>31,p)|0;if((H|0)==(p|0)){F=o+11|0;a[F>>0]=48;I=F}else I=H;a[I+-1>>0]=(E>>31&2)+43;E=I+-2|0;a[E>>0]=i+15;H=(g|0)<1;F=(h&8|0)==0;J=m;K=G;while(1){L=~~K;M=J+1|0;a[J>>0]=r|d[480+L>>0];K=(K-+(L|0))*16.0;if((M-n|0)==1?!(F&(H&K==0.0)):0){a[M>>0]=46;N=J+2|0}else N=M;if(!(K!=0.0))break;else J=N}J=N;if((g|0)!=0?(-2-n+J|0)<(g|0):0){H=p;F=E;O=g+2+H-F|0;P=H;Q=F}else{F=p;H=E;O=F-n-H+J|0;P=F;Q=H}H=O+D|0;Ic(b,32,f,H,h);Bc(b,u,D);Ic(b,48,f,H,h^65536);F=J-n|0;Bc(b,m,F);J=P-Q|0;Ic(b,48,O-(F+J)|0,0,0);Bc(b,E,J);Ic(b,32,f,H,h^8192);C=H;break}H=(g|0)<0?6:g;if(B){J=(c[l>>2]|0)+-28|0;c[l>>2]=J;R=e*268435456.0;S=J}else{R=e;S=c[l>>2]|0}J=(S|0)<0?k:k+288|0;F=J;K=R;do{r=~~K>>>0;c[F>>2]=r;F=F+4|0;K=(K-+(r>>>0))*1.0e9}while(K!=0.0);B=J;if((S|0)>0){E=J;D=F;u=S;while(1){r=(u|0)<29?u:29;M=D+-4|0;if(M>>>0>=E>>>0){L=M;M=0;do{T=oe(c[L>>2]|0,0,r|0)|0;U=ie(T|0,w()|0,M|0,0)|0;T=w()|0;M=me(U|0,T|0,1e9,0)|0;V=he(M|0,w()|0,1e9,0)|0;W=je(U|0,T|0,V|0,w()|0)|0;w()|0;c[L>>2]=W;L=L+-4|0}while(L>>>0>=E>>>0);if(M){L=E+-4|0;c[L>>2]=M;X=L}else X=E}else X=E;a:do if(D>>>0>X>>>0){L=D;while(1){W=L+-4|0;if(c[W>>2]|0){Y=L;break a}if(W>>>0>X>>>0)L=W;else{Y=W;break}}}else Y=D;while(0);M=(c[l>>2]|0)-r|0;c[l>>2]=M;if((M|0)>0){E=X;D=Y;u=M}else{Z=X;_=Y;$=M;break}}}else{Z=J;_=F;$=S}if(($|0)<0){u=((H+25|0)/9|0)+1|0;D=(q|0)==102;E=Z;M=_;L=$;while(1){W=0-L|0;V=(W|0)<9?W:9;if(E>>>0<M>>>0){W=(1<<V)+-1|0;T=1e9>>>V;U=0;aa=E;do{ba=c[aa>>2]|0;c[aa>>2]=(ba>>>V)+U;U=s(ba&W,T)|0;aa=aa+4|0}while(aa>>>0<M>>>0);aa=(c[E>>2]|0)==0?E+4|0:E;if(!U){ca=M;da=aa}else{c[M>>2]=U;ca=M+4|0;da=aa}}else{ca=M;da=(c[E>>2]|0)==0?E+4|0:E}aa=D?J:da;T=(ca-aa>>2|0)>(u|0)?aa+(u<<2)|0:ca;L=(c[l>>2]|0)+V|0;c[l>>2]=L;if((L|0)>=0){ea=da;fa=T;break}else{E=da;M=T}}}else{ea=Z;fa=_}if(ea>>>0<fa>>>0){M=(B-ea>>2)*9|0;E=c[ea>>2]|0;if(E>>>0<10)ga=M;else{L=M;M=10;while(1){M=M*10|0;u=L+1|0;if(E>>>0<M>>>0){ga=u;break}else L=u}}}else ga=0;L=(q|0)==103;M=(H|0)!=0;E=H-((q|0)==102?0:ga)+((M&L)<<31>>31)|0;if((E|0)<(((fa-B>>2)*9|0)+-9|0)){u=E+9216|0;E=(u|0)/9|0;D=J+4+(E+-1024<<2)|0;F=u-(E*9|0)|0;if((F|0)<8){E=F;F=10;while(1){u=F*10|0;if((E|0)<7){E=E+1|0;F=u}else{ha=u;break}}}else ha=10;F=c[D>>2]|0;E=(F>>>0)/(ha>>>0)|0;q=F-(s(E,ha)|0)|0;u=(D+4|0)==(fa|0);if(!(u&(q|0)==0)){t=(E&1|0)==0?9007199254740992.0:9007199254740994.0;E=ha>>>1;K=q>>>0<E>>>0?.5:u&(q|0)==(E|0)?1.0:1.5;if(!y){ia=K;ja=t}else{E=(a[z>>0]|0)==45;ia=E?-K:K;ja=E?-t:t}E=F-q|0;c[D>>2]=E;if(ja+ia!=ja){q=E+ha|0;c[D>>2]=q;if(q>>>0>999999999){q=D;E=ea;while(1){F=q+-4|0;c[q>>2]=0;if(F>>>0<E>>>0){u=E+-4|0;c[u>>2]=0;ka=u}else ka=E;u=(c[F>>2]|0)+1|0;c[F>>2]=u;if(u>>>0>999999999){q=F;E=ka}else{la=F;ma=ka;break}}}else{la=D;ma=ea}E=(B-ma>>2)*9|0;q=c[ma>>2]|0;if(q>>>0<10){na=la;oa=E;pa=ma}else{F=E;E=10;while(1){E=E*10|0;u=F+1|0;if(q>>>0<E>>>0){na=la;oa=u;pa=ma;break}else F=u}}}else{na=D;oa=ga;pa=ea}}else{na=D;oa=ga;pa=ea}F=na+4|0;qa=oa;ra=fa>>>0>F>>>0?F:fa;sa=pa}else{qa=ga;ra=fa;sa=ea}F=0-qa|0;b:do if(ra>>>0>sa>>>0){E=ra;while(1){q=E+-4|0;if(c[q>>2]|0){ta=E;wa=1;break b}if(q>>>0>sa>>>0)E=q;else{ta=q;wa=0;break}}}else{ta=ra;wa=0}while(0);do if(L){D=H+((M^1)&1)|0;if((D|0)>(qa|0)&(qa|0)>-5){xa=i+-1|0;ya=D+-1-qa|0}else{xa=i+-2|0;ya=D+-1|0}if(!(h&8)){if(wa?(D=c[ta+-4>>2]|0,(D|0)!=0):0)if(!((D>>>0)%10|0)){E=0;V=10;while(1){V=V*10|0;U=E+1|0;if((D>>>0)%(V>>>0)|0|0){za=U;break}else E=U}}else za=0;else za=9;E=((ta-B>>2)*9|0)+-9|0;if((xa|32|0)==102){V=E-za|0;D=(V|0)>0?V:0;Aa=xa;Ba=(ya|0)<(D|0)?ya:D;break}else{D=E+qa-za|0;E=(D|0)>0?D:0;Aa=xa;Ba=(ya|0)<(E|0)?ya:E;break}}else{Aa=xa;Ba=ya}}else{Aa=i;Ba=H}while(0);H=(Ba|0)!=0;B=H?1:h>>>3&1;M=(Aa|32|0)==102;if(M){Ca=0;Da=(qa|0)>0?qa:0}else{L=(qa|0)<0?F:qa;E=Gc(L,((L|0)<0)<<31>>31,p)|0;L=p;if((L-E|0)<2){D=E;while(1){V=D+-1|0;a[V>>0]=48;if((L-V|0)<2)D=V;else{Ea=V;break}}}else Ea=E;a[Ea+-1>>0]=(qa>>31&2)+43;D=Ea+-2|0;a[D>>0]=Aa;Ca=D;Da=L-D|0}D=y+1+Ba+B+Da|0;Ic(b,32,f,D,h);Bc(b,z,y);Ic(b,48,f,D,h^65536);if(M){F=sa>>>0>J>>>0?J:sa;V=m+9|0;U=V;q=m+8|0;u=F;do{T=Gc(c[u>>2]|0,0,V)|0;if((u|0)==(F|0))if((T|0)==(V|0)){a[q>>0]=48;Fa=q}else Fa=T;else if(T>>>0>m>>>0){re(m|0,48,T-n|0)|0;aa=T;while(1){W=aa+-1|0;if(W>>>0>m>>>0)aa=W;else{Fa=W;break}}}else Fa=T;Bc(b,Fa,U-Fa|0);u=u+4|0}while(u>>>0<=J>>>0);if(!((h&8|0)==0&(H^1)))Bc(b,5715,1);if(u>>>0<ta>>>0&(Ba|0)>0){J=Ba;U=u;while(1){q=Gc(c[U>>2]|0,0,V)|0;if(q>>>0>m>>>0){re(m|0,48,q-n|0)|0;F=q;while(1){M=F+-1|0;if(M>>>0>m>>>0)F=M;else{Ga=M;break}}}else Ga=q;Bc(b,Ga,(J|0)<9?J:9);U=U+4|0;F=J+-9|0;if(!(U>>>0<ta>>>0&(J|0)>9)){Ha=F;break}else J=F}}else Ha=Ba;Ic(b,48,Ha+9|0,9,0)}else{J=wa?ta:sa+4|0;if(sa>>>0<J>>>0&(Ba|0)>-1){U=m+9|0;V=(h&8|0)==0;u=U;H=0-n|0;F=m+8|0;T=Ba;M=sa;while(1){B=Gc(c[M>>2]|0,0,U)|0;if((B|0)==(U|0)){a[F>>0]=48;Ia=F}else Ia=B;do if((M|0)==(sa|0)){B=Ia+1|0;Bc(b,Ia,1);if(V&(T|0)<1){Ja=B;break}Bc(b,5715,1);Ja=B}else{if(Ia>>>0<=m>>>0){Ja=Ia;break}re(m|0,48,Ia+H|0)|0;B=Ia;while(1){L=B+-1|0;if(L>>>0>m>>>0)B=L;else{Ja=L;break}}}while(0);q=u-Ja|0;Bc(b,Ja,(T|0)>(q|0)?q:T);B=T-q|0;M=M+4|0;if(!(M>>>0<J>>>0&(B|0)>-1)){Ka=B;break}else T=B}}else Ka=Ba;Ic(b,48,Ka+18|0,18,0);Bc(b,Ca,p-Ca|0)}Ic(b,32,f,D,h^8192);C=D}while(0);ua=j;return ((C|0)<(f|0)?f:C)|0}function Lc(a){a=+a;var b=0;g[h>>3]=a;b=c[h>>2]|0;v(c[h+4>>2]|0);return b|0}function Mc(a,b){a=+a;b=b|0;return +(+Nc(a,b))}function Nc(a,b){a=+a;b=b|0;var d=0,e=0,f=0,i=0.0,j=0.0,k=0,l=0.0;g[h>>3]=a;d=c[h>>2]|0;e=c[h+4>>2]|0;f=ne(d|0,e|0,52)|0;w()|0;switch(f&2047){case 0:{if(a!=0.0){i=+Nc(a*18446744073709551616.0,b);j=i;k=(c[b>>2]|0)+-64|0}else{j=a;k=0}c[b>>2]=k;l=j;break}case 2047:{l=a;break}default:{c[b>>2]=(f&2047)+-1022;c[h>>2]=d;c[h+4>>2]=e&-2146435073|1071644672;l=+g[h>>3]}}return +l}function Oc(b,d,e){b=b|0;d=d|0;e=e|0;var f=0;do if(b){if(d>>>0<128){a[b>>0]=d;f=1;break}if(!(c[c[(Pc()|0)+188>>2]>>2]|0))if((d&-128|0)==57216){a[b>>0]=d;f=1;break}else{c[(dc()|0)>>2]=84;f=-1;break}if(d>>>0<2048){a[b>>0]=d>>>6|192;a[b+1>>0]=d&63|128;f=2;break}if(d>>>0<55296|(d&-8192|0)==57344){a[b>>0]=d>>>12|224;a[b+1>>0]=d>>>6&63|128;a[b+2>>0]=d&63|128;f=3;break}if((d+-65536|0)>>>0<1048576){a[b>>0]=d>>>18|240;a[b+1>>0]=d>>>12&63|128;a[b+2>>0]=d>>>6&63|128;a[b+3>>0]=d&63|128;f=4;break}else{c[(dc()|0)>>2]=84;f=-1;break}}else f=1;while(0);return f|0}function Pc(){return hc()|0}function Qc(){return hc()|0}function Rc(b,e){b=b|0;e=e|0;var f=0,g=0,h=0,i=0,j=0;f=0;while(1){if((d[496+f>>0]|0)==(b|0)){g=4;break}h=f+1|0;if((h|0)==87){i=87;g=5;break}else f=h}if((g|0)==4)if(!f)j=592;else{i=f;g=5}if((g|0)==5){g=592;f=i;while(1){i=g;do{b=i;i=i+1|0}while((a[b>>0]|0)!=0);f=f+-1|0;if(!f){j=i;break}else g=i}}return Sc(j,c[e+20>>2]|0)|0}function Sc(a,b){a=a|0;b=b|0;return rc(a,b)|0}function Tc(b,c,d){b=b|0;c=c|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0;a:do if(!d)e=0;else{f=b;g=d;h=c;while(1){i=a[f>>0]|0;j=a[h>>0]|0;if(i<<24>>24!=j<<24>>24)break;g=g+-1|0;if(!g){e=0;break a}else{f=f+1|0;h=h+1|0}}e=(i&255)-(j&255)|0}while(0);return e|0}function Uc(a,b){a=a|0;b=b|0;var d=0,e=0;d=ua;ua=ua+16|0;if((ua|0)>=(va|0))x(16);e=d;c[e>>2]=b;b=zc(c[895]|0,a,e)|0;ua=d;return b|0}function Vc(b,d){b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0;if((c[d+76>>2]|0)>=0?(nc(d)|0)!=0:0){e=b&255;f=b&255;if((f|0)!=(a[d+75>>0]|0)?(g=d+20|0,h=c[g>>2]|0,h>>>0<(c[d+16>>2]|0)>>>0):0){c[g>>2]=h+1;a[h>>0]=e;i=f}else i=oc(d,b)|0;mc(d);j=i}else k=3;do if((k|0)==3){i=b&255;f=b&255;if((f|0)!=(a[d+75>>0]|0)?(e=d+20|0,h=c[e>>2]|0,h>>>0<(c[d+16>>2]|0)>>>0):0){c[e>>2]=h+1;a[h>>0]=i;j=f;break}j=oc(d,b)|0}while(0);return j|0}function Wc(b){b=b|0;var d=0,e=0,f=0,g=0,h=0;d=c[895]|0;if((c[d+76>>2]|0)>-1)e=nc(d)|0;else e=0;do if((kc(b,d)|0)<0)f=-1;else{if((a[d+75>>0]|0)!=10?(g=d+20|0,h=c[g>>2]|0,h>>>0<(c[d+16>>2]|0)>>>0):0){c[g>>2]=h+1;a[h>>0]=10;f=0;break}f=(oc(d,10)|0)>>31}while(0);if(e|0)mc(d);return f|0}function Xc(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ba=0,ca=0,da=0,ea=0,fa=0,ga=0,ha=0,ia=0,ja=0,ka=0,la=0,ma=0,na=0,oa=0,pa=0,qa=0,ra=0,sa=0,ta=0,wa=0,xa=0,ya=0,za=0,Aa=0,Ba=0,Ca=0,Da=0,Ea=0,Fa=0,Ga=0,Ha=0,Ia=0,Ja=0,Ka=0,La=0;b=ua;ua=ua+16|0;if((ua|0)>=(va|0))x(16);d=b;do if(a>>>0<245){e=a>>>0<11?16:a+11&-8;f=e>>>3;g=c[1902]|0;h=g>>>f;if(h&3|0){i=(h&1^1)+f|0;j=7648+(i<<1<<2)|0;k=j+8|0;l=c[k>>2]|0;m=l+8|0;n=c[m>>2]|0;if((n|0)==(j|0))c[1902]=g&~(1<<i);else{c[n+12>>2]=j;c[k>>2]=n}n=i<<3;c[l+4>>2]=n|3;i=l+n+4|0;c[i>>2]=c[i>>2]|1;o=m;ua=b;return o|0}m=c[1904]|0;if(e>>>0>m>>>0){if(h|0){i=2<<f;n=h<<f&(i|0-i);i=(n&0-n)+-1|0;n=i>>>12&16;f=i>>>n;i=f>>>5&8;h=f>>>i;f=h>>>2&4;l=h>>>f;h=l>>>1&2;k=l>>>h;l=k>>>1&1;j=(i|n|f|h|l)+(k>>>l)|0;l=7648+(j<<1<<2)|0;k=l+8|0;h=c[k>>2]|0;f=h+8|0;n=c[f>>2]|0;if((n|0)==(l|0)){i=g&~(1<<j);c[1902]=i;p=i}else{c[n+12>>2]=l;c[k>>2]=n;p=g}n=j<<3;j=n-e|0;c[h+4>>2]=e|3;k=h+e|0;c[k+4>>2]=j|1;c[h+n>>2]=j;if(m|0){n=c[1907]|0;h=m>>>3;l=7648+(h<<1<<2)|0;i=1<<h;if(!(p&i)){c[1902]=p|i;q=l;r=l+8|0}else{i=l+8|0;q=c[i>>2]|0;r=i}c[r>>2]=n;c[q+12>>2]=n;c[n+8>>2]=q;c[n+12>>2]=l}c[1904]=j;c[1907]=k;o=f;ua=b;return o|0}f=c[1903]|0;if(f){k=(f&0-f)+-1|0;j=k>>>12&16;l=k>>>j;k=l>>>5&8;n=l>>>k;l=n>>>2&4;i=n>>>l;n=i>>>1&2;h=i>>>n;i=h>>>1&1;s=c[7912+((k|j|l|n|i)+(h>>>i)<<2)>>2]|0;i=s;h=s;n=(c[s+4>>2]&-8)-e|0;while(1){s=c[i+16>>2]|0;if(!s){l=c[i+20>>2]|0;if(!l)break;else t=l}else t=s;s=(c[t+4>>2]&-8)-e|0;l=s>>>0<n>>>0;i=t;h=l?t:h;n=l?s:n}i=h+e|0;if(i>>>0>h>>>0){s=c[h+24>>2]|0;l=c[h+12>>2]|0;do if((l|0)==(h|0)){j=h+20|0;k=c[j>>2]|0;if(!k){u=h+16|0;v=c[u>>2]|0;if(!v){w=0;break}else{y=v;z=u}}else{y=k;z=j}j=y;k=z;while(1){u=j+20|0;v=c[u>>2]|0;if(!v){A=j+16|0;B=c[A>>2]|0;if(!B)break;else{C=B;D=A}}else{C=v;D=u}j=C;k=D}c[k>>2]=0;w=j}else{u=c[h+8>>2]|0;c[u+12>>2]=l;c[l+8>>2]=u;w=l}while(0);do if(s|0){l=c[h+28>>2]|0;u=7912+(l<<2)|0;if((h|0)==(c[u>>2]|0)){c[u>>2]=w;if(!w){c[1903]=f&~(1<<l);break}}else{l=s+16|0;c[((c[l>>2]|0)==(h|0)?l:s+20|0)>>2]=w;if(!w)break}c[w+24>>2]=s;l=c[h+16>>2]|0;if(l|0){c[w+16>>2]=l;c[l+24>>2]=w}l=c[h+20>>2]|0;if(l|0){c[w+20>>2]=l;c[l+24>>2]=w}}while(0);if(n>>>0<16){s=n+e|0;c[h+4>>2]=s|3;f=h+s+4|0;c[f>>2]=c[f>>2]|1}else{c[h+4>>2]=e|3;c[i+4>>2]=n|1;c[i+n>>2]=n;if(m|0){f=c[1907]|0;s=m>>>3;l=7648+(s<<1<<2)|0;u=1<<s;if(!(u&g)){c[1902]=u|g;E=l;F=l+8|0}else{u=l+8|0;E=c[u>>2]|0;F=u}c[F>>2]=f;c[E+12>>2]=f;c[f+8>>2]=E;c[f+12>>2]=l}c[1904]=n;c[1907]=i}o=h+8|0;ua=b;return o|0}else G=e}else G=e}else G=e}else if(a>>>0<=4294967231){l=a+11|0;f=l&-8;u=c[1903]|0;if(u){s=0-f|0;v=l>>>8;if(v)if(f>>>0>16777215)H=31;else{l=(v+1048320|0)>>>16&8;A=v<<l;v=(A+520192|0)>>>16&4;B=A<<v;A=(B+245760|0)>>>16&2;I=14-(v|l|A)+(B<<A>>>15)|0;H=f>>>(I+7|0)&1|I<<1}else H=0;I=c[7912+(H<<2)>>2]|0;a:do if(!I){J=0;K=0;L=s;M=61}else{A=0;B=s;l=I;v=f<<((H|0)==31?0:25-(H>>>1)|0);N=0;while(1){O=(c[l+4>>2]&-8)-f|0;if(O>>>0<B>>>0)if(!O){P=l;Q=0;R=l;M=65;break a}else{S=l;T=O}else{S=A;T=B}O=c[l+20>>2]|0;l=c[l+16+(v>>>31<<2)>>2]|0;U=(O|0)==0|(O|0)==(l|0)?N:O;if(!l){J=U;K=S;L=T;M=61;break}else{A=S;B=T;v=v<<1;N=U}}}while(0);if((M|0)==61){if((J|0)==0&(K|0)==0){I=2<<H;s=(I|0-I)&u;if(!s){G=f;break}I=(s&0-s)+-1|0;s=I>>>12&16;e=I>>>s;I=e>>>5&8;h=e>>>I;e=h>>>2&4;i=h>>>e;h=i>>>1&2;n=i>>>h;i=n>>>1&1;V=0;W=c[7912+((I|s|e|h|i)+(n>>>i)<<2)>>2]|0}else{V=K;W=J}if(!W){X=V;Y=L}else{P=V;Q=L;R=W;M=65}}if((M|0)==65){i=P;n=Q;h=R;while(1){e=(c[h+4>>2]&-8)-f|0;s=e>>>0<n>>>0;I=s?e:n;e=s?h:i;s=c[h+16>>2]|0;if(!s)Z=c[h+20>>2]|0;else Z=s;if(!Z){X=e;Y=I;break}else{i=e;n=I;h=Z}}}if(((X|0)!=0?Y>>>0<((c[1904]|0)-f|0)>>>0:0)?(h=X+f|0,h>>>0>X>>>0):0){n=c[X+24>>2]|0;i=c[X+12>>2]|0;do if((i|0)==(X|0)){I=X+20|0;e=c[I>>2]|0;if(!e){s=X+16|0;g=c[s>>2]|0;if(!g){_=0;break}else{$=g;aa=s}}else{$=e;aa=I}I=$;e=aa;while(1){s=I+20|0;g=c[s>>2]|0;if(!g){m=I+16|0;N=c[m>>2]|0;if(!N)break;else{ba=N;ca=m}}else{ba=g;ca=s}I=ba;e=ca}c[e>>2]=0;_=I}else{s=c[X+8>>2]|0;c[s+12>>2]=i;c[i+8>>2]=s;_=i}while(0);do if(n){i=c[X+28>>2]|0;s=7912+(i<<2)|0;if((X|0)==(c[s>>2]|0)){c[s>>2]=_;if(!_){s=u&~(1<<i);c[1903]=s;da=s;break}}else{s=n+16|0;c[((c[s>>2]|0)==(X|0)?s:n+20|0)>>2]=_;if(!_){da=u;break}}c[_+24>>2]=n;s=c[X+16>>2]|0;if(s|0){c[_+16>>2]=s;c[s+24>>2]=_}s=c[X+20>>2]|0;if(s){c[_+20>>2]=s;c[s+24>>2]=_;da=u}else da=u}else da=u;while(0);b:do if(Y>>>0<16){u=Y+f|0;c[X+4>>2]=u|3;n=X+u+4|0;c[n>>2]=c[n>>2]|1}else{c[X+4>>2]=f|3;c[h+4>>2]=Y|1;c[h+Y>>2]=Y;n=Y>>>3;if(Y>>>0<256){u=7648+(n<<1<<2)|0;s=c[1902]|0;i=1<<n;if(!(s&i)){c[1902]=s|i;ea=u;fa=u+8|0}else{i=u+8|0;ea=c[i>>2]|0;fa=i}c[fa>>2]=h;c[ea+12>>2]=h;c[h+8>>2]=ea;c[h+12>>2]=u;break}u=Y>>>8;if(u)if(Y>>>0>16777215)ga=31;else{i=(u+1048320|0)>>>16&8;s=u<<i;u=(s+520192|0)>>>16&4;n=s<<u;s=(n+245760|0)>>>16&2;g=14-(u|i|s)+(n<<s>>>15)|0;ga=Y>>>(g+7|0)&1|g<<1}else ga=0;g=7912+(ga<<2)|0;c[h+28>>2]=ga;s=h+16|0;c[s+4>>2]=0;c[s>>2]=0;s=1<<ga;if(!(da&s)){c[1903]=da|s;c[g>>2]=h;c[h+24>>2]=g;c[h+12>>2]=h;c[h+8>>2]=h;break}s=c[g>>2]|0;c:do if((c[s+4>>2]&-8|0)==(Y|0))ha=s;else{g=Y<<((ga|0)==31?0:25-(ga>>>1)|0);n=s;while(1){ia=n+16+(g>>>31<<2)|0;i=c[ia>>2]|0;if(!i)break;if((c[i+4>>2]&-8|0)==(Y|0)){ha=i;break c}else{g=g<<1;n=i}}c[ia>>2]=h;c[h+24>>2]=n;c[h+12>>2]=h;c[h+8>>2]=h;break b}while(0);s=ha+8|0;I=c[s>>2]|0;c[I+12>>2]=h;c[s>>2]=h;c[h+8>>2]=I;c[h+12>>2]=ha;c[h+24>>2]=0}while(0);o=X+8|0;ua=b;return o|0}else G=f}else G=f}else G=-1;while(0);X=c[1904]|0;if(X>>>0>=G>>>0){ha=X-G|0;ia=c[1907]|0;if(ha>>>0>15){Y=ia+G|0;c[1907]=Y;c[1904]=ha;c[Y+4>>2]=ha|1;c[ia+X>>2]=ha;c[ia+4>>2]=G|3}else{c[1904]=0;c[1907]=0;c[ia+4>>2]=X|3;ha=ia+X+4|0;c[ha>>2]=c[ha>>2]|1}o=ia+8|0;ua=b;return o|0}ia=c[1905]|0;if(ia>>>0>G>>>0){ha=ia-G|0;c[1905]=ha;X=c[1908]|0;Y=X+G|0;c[1908]=Y;c[Y+4>>2]=ha|1;c[X+4>>2]=G|3;o=X+8|0;ua=b;return o|0}if(!(c[2020]|0)){c[2022]=4096;c[2021]=4096;c[2023]=-1;c[2024]=-1;c[2025]=0;c[2013]=0;c[2020]=d&-16^1431655768;ja=4096}else ja=c[2022]|0;d=G+48|0;X=G+47|0;ha=ja+X|0;Y=0-ja|0;ja=ha&Y;if(ja>>>0<=G>>>0){o=0;ua=b;return o|0}ga=c[2012]|0;if(ga|0?(da=c[2010]|0,ea=da+ja|0,ea>>>0<=da>>>0|ea>>>0>ga>>>0):0){o=0;ua=b;return o|0}d:do if(!(c[2013]&4)){ga=c[1908]|0;e:do if(ga){ea=8056;while(1){da=c[ea>>2]|0;if(da>>>0<=ga>>>0?(da+(c[ea+4>>2]|0)|0)>>>0>ga>>>0:0)break;da=c[ea+8>>2]|0;if(!da){M=128;break e}else ea=da}da=ha-ia&Y;if(da>>>0<2147483647){fa=se(da|0)|0;if((fa|0)==((c[ea>>2]|0)+(c[ea+4>>2]|0)|0))if((fa|0)==(-1|0))ka=da;else{la=da;ma=fa;M=145;break d}else{na=fa;oa=da;M=136}}else ka=0}else M=128;while(0);do if((M|0)==128){ga=se(0)|0;if((ga|0)!=(-1|0)?(f=ga,da=c[2021]|0,fa=da+-1|0,_=((fa&f|0)==0?0:(fa+f&0-da)-f|0)+ja|0,f=c[2010]|0,da=_+f|0,_>>>0>G>>>0&_>>>0<2147483647):0){fa=c[2012]|0;if(fa|0?da>>>0<=f>>>0|da>>>0>fa>>>0:0){ka=0;break}fa=se(_|0)|0;if((fa|0)==(ga|0)){la=_;ma=ga;M=145;break d}else{na=fa;oa=_;M=136}}else ka=0}while(0);do if((M|0)==136){_=0-oa|0;if(!(d>>>0>oa>>>0&(oa>>>0<2147483647&(na|0)!=(-1|0))))if((na|0)==(-1|0)){ka=0;break}else{la=oa;ma=na;M=145;break d}fa=c[2022]|0;ga=X-oa+fa&0-fa;if(ga>>>0>=2147483647){la=oa;ma=na;M=145;break d}if((se(ga|0)|0)==(-1|0)){se(_|0)|0;ka=0;break}else{la=ga+oa|0;ma=na;M=145;break d}}while(0);c[2013]=c[2013]|4;pa=ka;M=143}else{pa=0;M=143}while(0);if(((M|0)==143?ja>>>0<2147483647:0)?(ka=se(ja|0)|0,ja=se(0)|0,na=ja-ka|0,oa=na>>>0>(G+40|0)>>>0,!((ka|0)==(-1|0)|oa^1|ka>>>0<ja>>>0&((ka|0)!=(-1|0)&(ja|0)!=(-1|0))^1)):0){la=oa?na:pa;ma=ka;M=145}if((M|0)==145){ka=(c[2010]|0)+la|0;c[2010]=ka;if(ka>>>0>(c[2011]|0)>>>0)c[2011]=ka;ka=c[1908]|0;f:do if(ka){pa=8056;while(1){qa=c[pa>>2]|0;ra=c[pa+4>>2]|0;if((ma|0)==(qa+ra|0)){M=154;break}na=c[pa+8>>2]|0;if(!na)break;else pa=na}if(((M|0)==154?(na=pa+4|0,(c[pa+12>>2]&8|0)==0):0)?ma>>>0>ka>>>0&qa>>>0<=ka>>>0:0){c[na>>2]=ra+la;na=(c[1905]|0)+la|0;oa=ka+8|0;ja=(oa&7|0)==0?0:0-oa&7;oa=ka+ja|0;X=na-ja|0;c[1908]=oa;c[1905]=X;c[oa+4>>2]=X|1;c[ka+na+4>>2]=40;c[1909]=c[2024];break}if(ma>>>0<(c[1906]|0)>>>0)c[1906]=ma;na=ma+la|0;X=8056;while(1){if((c[X>>2]|0)==(na|0)){M=162;break}oa=c[X+8>>2]|0;if(!oa)break;else X=oa}if((M|0)==162?(c[X+12>>2]&8|0)==0:0){c[X>>2]=ma;pa=X+4|0;c[pa>>2]=(c[pa>>2]|0)+la;pa=ma+8|0;oa=ma+((pa&7|0)==0?0:0-pa&7)|0;pa=na+8|0;ja=na+((pa&7|0)==0?0:0-pa&7)|0;pa=oa+G|0;d=ja-oa-G|0;c[oa+4>>2]=G|3;g:do if((ka|0)==(ja|0)){Y=(c[1905]|0)+d|0;c[1905]=Y;c[1908]=pa;c[pa+4>>2]=Y|1}else{if((c[1907]|0)==(ja|0)){Y=(c[1904]|0)+d|0;c[1904]=Y;c[1907]=pa;c[pa+4>>2]=Y|1;c[pa+Y>>2]=Y;break}Y=c[ja+4>>2]|0;if((Y&3|0)==1){ia=Y&-8;ha=Y>>>3;h:do if(Y>>>0<256){ga=c[ja+8>>2]|0;_=c[ja+12>>2]|0;if((_|0)==(ga|0)){c[1902]=c[1902]&~(1<<ha);break}else{c[ga+12>>2]=_;c[_+8>>2]=ga;break}}else{ga=c[ja+24>>2]|0;_=c[ja+12>>2]|0;do if((_|0)==(ja|0)){fa=ja+16|0;da=fa+4|0;f=c[da>>2]|0;if(!f){ca=c[fa>>2]|0;if(!ca){sa=0;break}else{ta=ca;wa=fa}}else{ta=f;wa=da}da=ta;f=wa;while(1){fa=da+20|0;ca=c[fa>>2]|0;if(!ca){ba=da+16|0;aa=c[ba>>2]|0;if(!aa)break;else{xa=aa;ya=ba}}else{xa=ca;ya=fa}da=xa;f=ya}c[f>>2]=0;sa=da}else{fa=c[ja+8>>2]|0;c[fa+12>>2]=_;c[_+8>>2]=fa;sa=_}while(0);if(!ga)break;_=c[ja+28>>2]|0;n=7912+(_<<2)|0;do if((c[n>>2]|0)!=(ja|0)){fa=ga+16|0;c[((c[fa>>2]|0)==(ja|0)?fa:ga+20|0)>>2]=sa;if(!sa)break h}else{c[n>>2]=sa;if(sa|0)break;c[1903]=c[1903]&~(1<<_);break h}while(0);c[sa+24>>2]=ga;_=ja+16|0;n=c[_>>2]|0;if(n|0){c[sa+16>>2]=n;c[n+24>>2]=sa}n=c[_+4>>2]|0;if(!n)break;c[sa+20>>2]=n;c[n+24>>2]=sa}while(0);za=ja+ia|0;Aa=ia+d|0}else{za=ja;Aa=d}ha=za+4|0;c[ha>>2]=c[ha>>2]&-2;c[pa+4>>2]=Aa|1;c[pa+Aa>>2]=Aa;ha=Aa>>>3;if(Aa>>>0<256){Y=7648+(ha<<1<<2)|0;ea=c[1902]|0;n=1<<ha;if(!(ea&n)){c[1902]=ea|n;Ba=Y;Ca=Y+8|0}else{n=Y+8|0;Ba=c[n>>2]|0;Ca=n}c[Ca>>2]=pa;c[Ba+12>>2]=pa;c[pa+8>>2]=Ba;c[pa+12>>2]=Y;break}Y=Aa>>>8;do if(!Y)Da=0;else{if(Aa>>>0>16777215){Da=31;break}n=(Y+1048320|0)>>>16&8;ea=Y<<n;ha=(ea+520192|0)>>>16&4;_=ea<<ha;ea=(_+245760|0)>>>16&2;fa=14-(ha|n|ea)+(_<<ea>>>15)|0;Da=Aa>>>(fa+7|0)&1|fa<<1}while(0);Y=7912+(Da<<2)|0;c[pa+28>>2]=Da;ia=pa+16|0;c[ia+4>>2]=0;c[ia>>2]=0;ia=c[1903]|0;fa=1<<Da;if(!(ia&fa)){c[1903]=ia|fa;c[Y>>2]=pa;c[pa+24>>2]=Y;c[pa+12>>2]=pa;c[pa+8>>2]=pa;break}fa=c[Y>>2]|0;i:do if((c[fa+4>>2]&-8|0)==(Aa|0))Ea=fa;else{Y=Aa<<((Da|0)==31?0:25-(Da>>>1)|0);ia=fa;while(1){Fa=ia+16+(Y>>>31<<2)|0;ea=c[Fa>>2]|0;if(!ea)break;if((c[ea+4>>2]&-8|0)==(Aa|0)){Ea=ea;break i}else{Y=Y<<1;ia=ea}}c[Fa>>2]=pa;c[pa+24>>2]=ia;c[pa+12>>2]=pa;c[pa+8>>2]=pa;break g}while(0);fa=Ea+8|0;Y=c[fa>>2]|0;c[Y+12>>2]=pa;c[fa>>2]=pa;c[pa+8>>2]=Y;c[pa+12>>2]=Ea;c[pa+24>>2]=0}while(0);o=oa+8|0;ua=b;return o|0}pa=8056;while(1){d=c[pa>>2]|0;if(d>>>0<=ka>>>0?(Ga=d+(c[pa+4>>2]|0)|0,Ga>>>0>ka>>>0):0)break;pa=c[pa+8>>2]|0}pa=Ga+-47|0;oa=pa+8|0;d=pa+((oa&7|0)==0?0:0-oa&7)|0;oa=ka+16|0;pa=d>>>0<oa>>>0?ka:d;d=pa+8|0;ja=la+-40|0;na=ma+8|0;X=(na&7|0)==0?0:0-na&7;na=ma+X|0;Y=ja-X|0;c[1908]=na;c[1905]=Y;c[na+4>>2]=Y|1;c[ma+ja+4>>2]=40;c[1909]=c[2024];ja=pa+4|0;c[ja>>2]=27;c[d>>2]=c[2014];c[d+4>>2]=c[2015];c[d+8>>2]=c[2016];c[d+12>>2]=c[2017];c[2014]=ma;c[2015]=la;c[2017]=0;c[2016]=d;d=pa+24|0;do{Y=d;d=d+4|0;c[d>>2]=7}while((Y+8|0)>>>0<Ga>>>0);if((pa|0)!=(ka|0)){d=pa-ka|0;c[ja>>2]=c[ja>>2]&-2;c[ka+4>>2]=d|1;c[pa>>2]=d;Y=d>>>3;if(d>>>0<256){na=7648+(Y<<1<<2)|0;X=c[1902]|0;fa=1<<Y;if(!(X&fa)){c[1902]=X|fa;Ha=na;Ia=na+8|0}else{fa=na+8|0;Ha=c[fa>>2]|0;Ia=fa}c[Ia>>2]=ka;c[Ha+12>>2]=ka;c[ka+8>>2]=Ha;c[ka+12>>2]=na;break}na=d>>>8;if(na)if(d>>>0>16777215)Ja=31;else{fa=(na+1048320|0)>>>16&8;X=na<<fa;na=(X+520192|0)>>>16&4;Y=X<<na;X=(Y+245760|0)>>>16&2;ga=14-(na|fa|X)+(Y<<X>>>15)|0;Ja=d>>>(ga+7|0)&1|ga<<1}else Ja=0;ga=7912+(Ja<<2)|0;c[ka+28>>2]=Ja;c[ka+20>>2]=0;c[oa>>2]=0;X=c[1903]|0;Y=1<<Ja;if(!(X&Y)){c[1903]=X|Y;c[ga>>2]=ka;c[ka+24>>2]=ga;c[ka+12>>2]=ka;c[ka+8>>2]=ka;break}Y=c[ga>>2]|0;j:do if((c[Y+4>>2]&-8|0)==(d|0))Ka=Y;else{ga=d<<((Ja|0)==31?0:25-(Ja>>>1)|0);X=Y;while(1){La=X+16+(ga>>>31<<2)|0;fa=c[La>>2]|0;if(!fa)break;if((c[fa+4>>2]&-8|0)==(d|0)){Ka=fa;break j}else{ga=ga<<1;X=fa}}c[La>>2]=ka;c[ka+24>>2]=X;c[ka+12>>2]=ka;c[ka+8>>2]=ka;break f}while(0);d=Ka+8|0;Y=c[d>>2]|0;c[Y+12>>2]=ka;c[d>>2]=ka;c[ka+8>>2]=Y;c[ka+12>>2]=Ka;c[ka+24>>2]=0}}else{Y=c[1906]|0;if((Y|0)==0|ma>>>0<Y>>>0)c[1906]=ma;c[2014]=ma;c[2015]=la;c[2017]=0;c[1911]=c[2020];c[1910]=-1;c[1915]=7648;c[1914]=7648;c[1917]=7656;c[1916]=7656;c[1919]=7664;c[1918]=7664;c[1921]=7672;c[1920]=7672;c[1923]=7680;c[1922]=7680;c[1925]=7688;c[1924]=7688;c[1927]=7696;c[1926]=7696;c[1929]=7704;c[1928]=7704;c[1931]=7712;c[1930]=7712;c[1933]=7720;c[1932]=7720;c[1935]=7728;c[1934]=7728;c[1937]=7736;c[1936]=7736;c[1939]=7744;c[1938]=7744;c[1941]=7752;c[1940]=7752;c[1943]=7760;c[1942]=7760;c[1945]=7768;c[1944]=7768;c[1947]=7776;c[1946]=7776;c[1949]=7784;c[1948]=7784;c[1951]=7792;c[1950]=7792;c[1953]=7800;c[1952]=7800;c[1955]=7808;c[1954]=7808;c[1957]=7816;c[1956]=7816;c[1959]=7824;c[1958]=7824;c[1961]=7832;c[1960]=7832;c[1963]=7840;c[1962]=7840;c[1965]=7848;c[1964]=7848;c[1967]=7856;c[1966]=7856;c[1969]=7864;c[1968]=7864;c[1971]=7872;c[1970]=7872;c[1973]=7880;c[1972]=7880;c[1975]=7888;c[1974]=7888;c[1977]=7896;c[1976]=7896;Y=la+-40|0;d=ma+8|0;oa=(d&7|0)==0?0:0-d&7;d=ma+oa|0;pa=Y-oa|0;c[1908]=d;c[1905]=pa;c[d+4>>2]=pa|1;c[ma+Y+4>>2]=40;c[1909]=c[2024]}while(0);ma=c[1905]|0;if(ma>>>0>G>>>0){la=ma-G|0;c[1905]=la;ma=c[1908]|0;ka=ma+G|0;c[1908]=ka;c[ka+4>>2]=la|1;c[ma+4>>2]=G|3;o=ma+8|0;ua=b;return o|0}}c[(dc()|0)>>2]=12;o=0;ua=b;return o|0}function Yc(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0;if(!a)return;b=a+-8|0;d=c[1906]|0;e=c[a+-4>>2]|0;a=e&-8;f=b+a|0;do if(!(e&1)){g=c[b>>2]|0;if(!(e&3))return;h=b+(0-g)|0;i=g+a|0;if(h>>>0<d>>>0)return;if((c[1907]|0)==(h|0)){j=f+4|0;k=c[j>>2]|0;if((k&3|0)!=3){l=h;m=i;n=h;break}c[1904]=i;c[j>>2]=k&-2;c[h+4>>2]=i|1;c[h+i>>2]=i;return}k=g>>>3;if(g>>>0<256){g=c[h+8>>2]|0;j=c[h+12>>2]|0;if((j|0)==(g|0)){c[1902]=c[1902]&~(1<<k);l=h;m=i;n=h;break}else{c[g+12>>2]=j;c[j+8>>2]=g;l=h;m=i;n=h;break}}g=c[h+24>>2]|0;j=c[h+12>>2]|0;do if((j|0)==(h|0)){k=h+16|0;o=k+4|0;p=c[o>>2]|0;if(!p){q=c[k>>2]|0;if(!q){r=0;break}else{s=q;t=k}}else{s=p;t=o}o=s;p=t;while(1){k=o+20|0;q=c[k>>2]|0;if(!q){u=o+16|0;v=c[u>>2]|0;if(!v)break;else{w=v;x=u}}else{w=q;x=k}o=w;p=x}c[p>>2]=0;r=o}else{k=c[h+8>>2]|0;c[k+12>>2]=j;c[j+8>>2]=k;r=j}while(0);if(g){j=c[h+28>>2]|0;k=7912+(j<<2)|0;if((c[k>>2]|0)==(h|0)){c[k>>2]=r;if(!r){c[1903]=c[1903]&~(1<<j);l=h;m=i;n=h;break}}else{j=g+16|0;c[((c[j>>2]|0)==(h|0)?j:g+20|0)>>2]=r;if(!r){l=h;m=i;n=h;break}}c[r+24>>2]=g;j=h+16|0;k=c[j>>2]|0;if(k|0){c[r+16>>2]=k;c[k+24>>2]=r}k=c[j+4>>2]|0;if(k){c[r+20>>2]=k;c[k+24>>2]=r;l=h;m=i;n=h}else{l=h;m=i;n=h}}else{l=h;m=i;n=h}}else{l=b;m=a;n=b}while(0);if(n>>>0>=f>>>0)return;b=f+4|0;a=c[b>>2]|0;if(!(a&1))return;if(!(a&2)){if((c[1908]|0)==(f|0)){r=(c[1905]|0)+m|0;c[1905]=r;c[1908]=l;c[l+4>>2]=r|1;if((l|0)!=(c[1907]|0))return;c[1907]=0;c[1904]=0;return}if((c[1907]|0)==(f|0)){r=(c[1904]|0)+m|0;c[1904]=r;c[1907]=n;c[l+4>>2]=r|1;c[n+r>>2]=r;return}r=(a&-8)+m|0;x=a>>>3;do if(a>>>0<256){w=c[f+8>>2]|0;t=c[f+12>>2]|0;if((t|0)==(w|0)){c[1902]=c[1902]&~(1<<x);break}else{c[w+12>>2]=t;c[t+8>>2]=w;break}}else{w=c[f+24>>2]|0;t=c[f+12>>2]|0;do if((t|0)==(f|0)){s=f+16|0;d=s+4|0;e=c[d>>2]|0;if(!e){k=c[s>>2]|0;if(!k){y=0;break}else{z=k;A=s}}else{z=e;A=d}d=z;e=A;while(1){s=d+20|0;k=c[s>>2]|0;if(!k){j=d+16|0;q=c[j>>2]|0;if(!q)break;else{B=q;C=j}}else{B=k;C=s}d=B;e=C}c[e>>2]=0;y=d}else{o=c[f+8>>2]|0;c[o+12>>2]=t;c[t+8>>2]=o;y=t}while(0);if(w|0){t=c[f+28>>2]|0;h=7912+(t<<2)|0;if((c[h>>2]|0)==(f|0)){c[h>>2]=y;if(!y){c[1903]=c[1903]&~(1<<t);break}}else{t=w+16|0;c[((c[t>>2]|0)==(f|0)?t:w+20|0)>>2]=y;if(!y)break}c[y+24>>2]=w;t=f+16|0;h=c[t>>2]|0;if(h|0){c[y+16>>2]=h;c[h+24>>2]=y}h=c[t+4>>2]|0;if(h|0){c[y+20>>2]=h;c[h+24>>2]=y}}}while(0);c[l+4>>2]=r|1;c[n+r>>2]=r;if((l|0)==(c[1907]|0)){c[1904]=r;return}else D=r}else{c[b>>2]=a&-2;c[l+4>>2]=m|1;c[n+m>>2]=m;D=m}m=D>>>3;if(D>>>0<256){n=7648+(m<<1<<2)|0;a=c[1902]|0;b=1<<m;if(!(a&b)){c[1902]=a|b;E=n;F=n+8|0}else{b=n+8|0;E=c[b>>2]|0;F=b}c[F>>2]=l;c[E+12>>2]=l;c[l+8>>2]=E;c[l+12>>2]=n;return}n=D>>>8;if(n)if(D>>>0>16777215)G=31;else{E=(n+1048320|0)>>>16&8;F=n<<E;n=(F+520192|0)>>>16&4;b=F<<n;F=(b+245760|0)>>>16&2;a=14-(n|E|F)+(b<<F>>>15)|0;G=D>>>(a+7|0)&1|a<<1}else G=0;a=7912+(G<<2)|0;c[l+28>>2]=G;c[l+20>>2]=0;c[l+16>>2]=0;F=c[1903]|0;b=1<<G;a:do if(!(F&b)){c[1903]=F|b;c[a>>2]=l;c[l+24>>2]=a;c[l+12>>2]=l;c[l+8>>2]=l}else{E=c[a>>2]|0;b:do if((c[E+4>>2]&-8|0)==(D|0))H=E;else{n=D<<((G|0)==31?0:25-(G>>>1)|0);m=E;while(1){I=m+16+(n>>>31<<2)|0;r=c[I>>2]|0;if(!r)break;if((c[r+4>>2]&-8|0)==(D|0)){H=r;break b}else{n=n<<1;m=r}}c[I>>2]=l;c[l+24>>2]=m;c[l+12>>2]=l;c[l+8>>2]=l;break a}while(0);E=H+8|0;w=c[E>>2]|0;c[w+12>>2]=l;c[E>>2]=l;c[l+8>>2]=w;c[l+12>>2]=H;c[l+24>>2]=0}while(0);l=(c[1910]|0)+-1|0;c[1910]=l;if(l|0)return;l=8064;while(1){H=c[l>>2]|0;if(!H)break;else l=H+8|0}c[1910]=-1;return}function Zc(a){a=a|0;return}function _c(a){a=a|0;Zc(a);fd(a);return}function $c(a){a=a|0;return 5717}function ad(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,t=0,u=0,v=0,w=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0;b=ua;ua=ua+16|0;if((ua|0)>=(va|0))x(16);d=b;e=b+8|0;f=b+4|0;c[e>>2]=a;do if(a>>>0>=212){g=(a>>>0)/210|0;h=g*210|0;c[f>>2]=a-h;i=0;j=g;g=h;h=(bd(2592,2784,f,d)|0)-2592>>2;a:while(1){k=(c[2592+(h<<2)>>2]|0)+g|0;l=5;while(1){if(l>>>0>=47){m=6;break}n=c[2400+(l<<2)>>2]|0;o=(k>>>0)/(n>>>0)|0;if(o>>>0<n>>>0){m=107;break a}if((k|0)==(s(o,n)|0)){p=i;break}else l=l+1|0}b:do if((m|0)==6){m=0;l=211;n=i;c:while(1){o=(k>>>0)/(l>>>0)|0;do if(o>>>0>=l>>>0)if((k|0)!=(s(o,l)|0)){q=l+10|0;r=(k>>>0)/(q>>>0)|0;if(r>>>0>=q>>>0)if((k|0)!=(s(r,q)|0)){r=l+12|0;t=(k>>>0)/(r>>>0)|0;if(t>>>0>=r>>>0)if((k|0)!=(s(t,r)|0)){t=l+16|0;u=(k>>>0)/(t>>>0)|0;if(u>>>0>=t>>>0)if((k|0)!=(s(u,t)|0)){u=l+18|0;v=(k>>>0)/(u>>>0)|0;if(v>>>0>=u>>>0)if((k|0)!=(s(v,u)|0)){v=l+22|0;w=(k>>>0)/(v>>>0)|0;if(w>>>0>=v>>>0)if((k|0)!=(s(w,v)|0)){w=l+28|0;y=(k>>>0)/(w>>>0)|0;if(y>>>0>=w>>>0)if((k|0)==(s(y,w)|0)){z=w;A=9;B=n}else{y=l+30|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+36|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+40|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+42|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+46|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+52|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+58|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+60|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+66|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+70|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+72|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+78|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+82|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+88|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+96|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+100|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+102|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+106|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+108|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+112|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+120|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+126|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+130|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+136|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+138|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+142|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+148|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+150|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+156|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+162|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+166|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+168|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+172|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+178|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+180|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+186|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+190|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+192|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+196|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+198|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+208|0;C=(k>>>0)/(y>>>0)|0;D=C>>>0<y>>>0;E=(k|0)==(s(C,y)|0);z=D|E?y:l+210|0;A=D?1:E?9:0;B=D?k:n}else{z=w;A=1;B=k}}else{z=v;A=9;B=n}else{z=v;A=1;B=k}}else{z=u;A=9;B=n}else{z=u;A=1;B=k}}else{z=t;A=9;B=n}else{z=t;A=1;B=k}}else{z=r;A=9;B=n}else{z=r;A=1;B=k}}else{z=q;A=9;B=n}else{z=q;A=1;B=k}}else{z=l;A=9;B=n}else{z=l;A=1;B=k}while(0);switch(A&15){case 9:{p=B;break b;break}case 0:{l=z;n=B;break}default:break c}}if(!A)p=B;else{m=108;break a}}while(0);n=h+1|0;l=(n|0)==48;o=j+(l&1)|0;i=p;j=o;g=o*210|0;h=l?0:n}if((m|0)==107){c[e>>2]=k;F=k;break}else if((m|0)==108){c[e>>2]=k;F=B;break}}else F=c[(bd(2400,2592,e,d)|0)>>2]|0;while(0);ua=b;return F|0}function bd(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0;e=c[d>>2]|0;d=a;f=b-a>>2;while(1){if(!f)break;a=(f|0)/2|0;b=d+(a<<2)|0;g=(c[b>>2]|0)>>>0<e>>>0;d=g?b+4|0:d;f=g?f+-1-a|0:a}return d|0}function cd(a){a=a|0;return}function dd(a){a=a|0;var b=0,d=0;b=a+8|0;if(!((c[b>>2]|0)!=0?(d=c[b>>2]|0,c[b>>2]=d+-1,(d|0)!=0):0))Ba[c[(c[a>>2]|0)+16>>2]&63](a);return}function ed(a){a=a|0;var b=0,c=0;b=(a|0)==0?1:a;while(1){a=Xc(b)|0;if(a|0){c=a;break}a=de()|0;if(!a){c=0;break}Aa[a&3]()}return c|0}function fd(a){a=a|0;Yc(a);return}function gd(a,b){a=a|0;b=b|0;var d=0,e=0,f=0;d=jc(b)|0;e=ed(d+13|0)|0;c[e>>2]=d;c[e+4>>2]=d;c[e+8>>2]=0;f=hd(e)|0;qe(f|0,b|0,d+1|0)|0;c[a>>2]=f;return}function hd(a){a=a|0;return a+12|0}function id(a,b){a=a|0;b=b|0;c[a>>2]=4068;gd(a+4|0,b);return}function jd(a){a=a|0;return 1}function kd(a){a=a|0;fa()}function ld(b,d){b=b|0;d=d|0;c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;if((a[d+11>>0]|0)<0)md(b,c[d>>2]|0,c[d+4>>2]|0);else{c[b>>2]=c[d>>2];c[b+4>>2]=c[d+4>>2];c[b+8>>2]=c[d+8>>2]}return}function md(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0;f=ua;ua=ua+16|0;if((ua|0)>=(va|0))x(16);g=f;if(e>>>0>4294967279)kd(b);if(e>>>0<11){a[b+11>>0]=e;h=b}else{i=e+16&-16;j=ed(i)|0;c[b>>2]=j;c[b+8>>2]=i|-2147483648;c[b+4>>2]=e;h=j}nd(h,d,e)|0;a[g>>0]=0;od(h+e|0,g);ua=f;return}function nd(a,b,c){a=a|0;b=b|0;c=c|0;if(c|0)qe(a|0,b|0,c|0)|0;return a|0}function od(b,c){b=b|0;c=c|0;a[b>>0]=a[c>>0]|0;return}function pd(a){a=a|0;fa()}function qd(){var a=0,b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0;a=ua;ua=ua+48|0;if((ua|0)>=(va|0))x(48);b=a+32|0;d=a+24|0;e=a+16|0;f=a;g=a+36|0;a=rd()|0;if(a|0?(h=c[a>>2]|0,h|0):0){a=h+48|0;i=c[a>>2]|0;j=c[a+4>>2]|0;if(!((i&-256|0)==1126902528&(j|0)==1129074247)){c[d>>2]=5959;sd(5909,d)}if((i|0)==1126902529&(j|0)==1129074247)k=c[h+44>>2]|0;else k=h+80|0;c[g>>2]=k;k=c[h>>2]|0;h=c[k+4>>2]|0;if(za[c[(c[758]|0)+16>>2]&7](3032,k,g)|0){k=c[g>>2]|0;g=xa[c[(c[k>>2]|0)+8>>2]&7](k)|0;c[f>>2]=5959;c[f+4>>2]=h;c[f+8>>2]=g;sd(5823,f)}else{c[e>>2]=5959;c[e+4>>2]=h;sd(5868,e)}}sd(5947,b)}function rd(){var a=0,b=0;a=ua;ua=ua+16|0;if((ua|0)>=(va|0))x(16);if(!(qa(8104,3)|0)){b=oa(c[2027]|0)|0;ua=a;return b|0}else sd(6098,a);return 0}function sd(a,b){a=a|0;b=b|0;var d=0,e=0;d=ua;ua=ua+16|0;if((ua|0)>=(va|0))x(16);e=d;c[e>>2]=b;b=c[863]|0;zc(b,a,e)|0;Vc(10,b)|0;fa()}function td(a){a=a|0;return}function ud(a){a=a|0;td(a);fd(a);return}function vd(a){a=a|0;return}function wd(a){a=a|0;return}function xd(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0;e=ua;ua=ua+64|0;if((ua|0)>=(va|0))x(64);f=e;if(!(Bd(a,b,0)|0))if((b|0)!=0?(g=Fd(b,3056,3040,0)|0,(g|0)!=0):0){b=f+4|0;h=b+52|0;do{c[b>>2]=0;b=b+4|0}while((b|0)<(h|0));c[f>>2]=g;c[f+8>>2]=a;c[f+12>>2]=-1;c[f+48>>2]=1;Da[c[(c[g>>2]|0)+28>>2]&7](g,f,c[d>>2]|0,1);if((c[f+24>>2]|0)==1){c[d>>2]=c[f+16>>2];i=1}else i=0;j=i}else j=0;else j=1;ua=e;return j|0}function yd(a,b,d,e,f,g){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;if(Bd(a,c[b+8>>2]|0,g)|0)Ed(0,b,d,e,f);return}function zd(b,d,e,f,g){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0;do if(!(Bd(b,c[d+8>>2]|0,g)|0)){if(Bd(b,c[d>>2]|0,g)|0){if((c[d+16>>2]|0)!=(e|0)?(h=d+20|0,(c[h>>2]|0)!=(e|0)):0){c[d+32>>2]=f;c[h>>2]=e;h=d+40|0;c[h>>2]=(c[h>>2]|0)+1;if((c[d+36>>2]|0)==1?(c[d+24>>2]|0)==2:0)a[d+54>>0]=1;c[d+44>>2]=4;break}if((f|0)==1)c[d+32>>2]=1}}else Dd(0,d,e,f);while(0);return}function Ad(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;if(Bd(a,c[b+8>>2]|0,0)|0)Cd(0,b,d,e);return}function Bd(a,b,c){a=a|0;b=b|0;c=c|0;return (a|0)==(b|0)|0}function Cd(b,d,e,f){b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0;b=d+16|0;g=c[b>>2]|0;do if(g){if((g|0)!=(e|0)){h=d+36|0;c[h>>2]=(c[h>>2]|0)+1;c[d+24>>2]=2;a[d+54>>0]=1;break}h=d+24|0;if((c[h>>2]|0)==2)c[h>>2]=f}else{c[b>>2]=e;c[d+24>>2]=f;c[d+36>>2]=1}while(0);return}function Dd(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;if((c[b+4>>2]|0)==(d|0)?(d=b+28|0,(c[d>>2]|0)!=1):0)c[d>>2]=e;return}function Ed(b,d,e,f,g){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0;a[d+53>>0]=1;do if((c[d+4>>2]|0)==(f|0)){a[d+52>>0]=1;b=d+16|0;h=c[b>>2]|0;if(!h){c[b>>2]=e;c[d+24>>2]=g;c[d+36>>2]=1;if(!((g|0)==1?(c[d+48>>2]|0)==1:0))break;a[d+54>>0]=1;break}if((h|0)!=(e|0)){h=d+36|0;c[h>>2]=(c[h>>2]|0)+1;a[d+54>>0]=1;break}h=d+24|0;b=c[h>>2]|0;if((b|0)==2){c[h>>2]=g;i=g}else i=b;if((i|0)==1?(c[d+48>>2]|0)==1:0)a[d+54>>0]=1}while(0);return}function Fd(d,e,f,g){d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0;h=ua;ua=ua+64|0;if((ua|0)>=(va|0))x(64);i=h;j=c[d>>2]|0;k=d+(c[j+-8>>2]|0)|0;l=c[j+-4>>2]|0;c[i>>2]=f;c[i+4>>2]=d;c[i+8>>2]=e;c[i+12>>2]=g;g=i+16|0;e=i+20|0;d=i+24|0;j=i+28|0;m=i+32|0;n=i+40|0;o=g;p=o+36|0;do{c[o>>2]=0;o=o+4|0}while((o|0)<(p|0));b[g+36>>1]=0;a[g+38>>0]=0;a:do if(Bd(l,f,0)|0){c[i+48>>2]=1;Fa[c[(c[l>>2]|0)+20>>2]&3](l,i,k,k,1,0);q=(c[d>>2]|0)==1?k:0}else{Ea[c[(c[l>>2]|0)+24>>2]&3](l,i,k,1,0);switch(c[i+36>>2]|0){case 0:{q=(c[n>>2]|0)==1&(c[j>>2]|0)==1&(c[m>>2]|0)==1?c[e>>2]|0:0;break a;break}case 1:break;default:{q=0;break a}}if((c[d>>2]|0)!=1?!((c[n>>2]|0)==0&(c[j>>2]|0)==1&(c[m>>2]|0)==1):0){q=0;break}q=c[g>>2]|0}while(0);ua=h;return q|0}function Gd(a){a=a|0;td(a);fd(a);return}function Hd(a,b,d,e,f,g){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0;if(Bd(a,c[b+8>>2]|0,g)|0)Ed(0,b,d,e,f);else{h=c[a+8>>2]|0;Fa[c[(c[h>>2]|0)+20>>2]&3](h,b,d,e,f,g)}return}function Id(b,d,e,f,g){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0;do if(!(Bd(b,c[d+8>>2]|0,g)|0)){if(!(Bd(b,c[d>>2]|0,g)|0)){h=c[b+8>>2]|0;Ea[c[(c[h>>2]|0)+24>>2]&3](h,d,e,f,g);break}if((c[d+16>>2]|0)!=(e|0)?(h=d+20|0,(c[h>>2]|0)!=(e|0)):0){c[d+32>>2]=f;i=d+44|0;if((c[i>>2]|0)==4)break;j=d+52|0;a[j>>0]=0;k=d+53|0;a[k>>0]=0;l=c[b+8>>2]|0;Fa[c[(c[l>>2]|0)+20>>2]&3](l,d,e,e,1,g);if(a[k>>0]|0)if(!(a[j>>0]|0)){m=1;n=11}else n=15;else{m=0;n=11}do if((n|0)==11){c[h>>2]=e;j=d+40|0;c[j>>2]=(c[j>>2]|0)+1;if((c[d+36>>2]|0)==1?(c[d+24>>2]|0)==2:0){a[d+54>>0]=1;if(m){n=15;break}else{o=4;break}}if(m)n=15;else o=4}while(0);if((n|0)==15)o=3;c[i>>2]=o;break}if((f|0)==1)c[d+32>>2]=1}else Dd(0,d,e,f);while(0);return}function Jd(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0;if(Bd(a,c[b+8>>2]|0,0)|0)Cd(0,b,d,e);else{f=c[a+8>>2]|0;Da[c[(c[f>>2]|0)+28>>2]&7](f,b,d,e)}return}function Kd(a){a=a|0;return}function Ld(){var a=0;a=ua;ua=ua+16|0;if((ua|0)>=(va|0))x(16);if(!(pa(8108,36)|0)){ua=a;return}else sd(6147,a)}function Md(a){a=a|0;var b=0;b=ua;ua=ua+16|0;if((ua|0)>=(va|0))x(16);Yc(a);if(!(ra(c[2027]|0,0)|0)){ua=b;return}else sd(6197,b)}function Nd(){var a=0,b=0;a=rd()|0;if((a|0?(b=c[a>>2]|0,b|0):0)?(a=b+48|0,(c[a>>2]&-256|0)==1126902528?(c[a+4>>2]|0)==1129074247:0):0)Od(c[b+12>>2]|0);Od(Pd()|0)}function Od(a){a=a|0;var b=0;b=ua;ua=ua+16|0;if((ua|0)>=(va|0))x(16);Aa[a&3]();sd(6250,b)}function Pd(){var a=0;a=c[994]|0;c[994]=a+0;return a|0}function Qd(a){a=a|0;return}function Rd(a){a=a|0;c[a>>2]=4068;Vd(a+4|0);return}function Sd(a){a=a|0;Rd(a);fd(a);return}function Td(a){a=a|0;return Ud(a+4|0)|0}function Ud(a){a=a|0;return c[a>>2]|0}function Vd(a){a=a|0;var b=0,d=0;if(jd(a)|0?(b=Wd(c[a>>2]|0)|0,a=b+8|0,d=c[a>>2]|0,c[a>>2]=d+-1,(d+-1|0)<0):0)fd(b);return}function Wd(a){a=a|0;return a+-12|0}function Xd(a){a=a|0;Rd(a);fd(a);return}function Yd(a){a=a|0;td(a);fd(a);return}function Zd(b,d,e,f,g,h){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;h=h|0;var i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0;if(Bd(b,c[d+8>>2]|0,h)|0)Ed(0,d,e,f,g);else{i=d+52|0;j=a[i>>0]|0;k=d+53|0;l=a[k>>0]|0;m=c[b+12>>2]|0;n=b+16+(m<<3)|0;a[i>>0]=0;a[k>>0]=0;be(b+16|0,d,e,f,g,h);a:do if((m|0)>1){o=d+24|0;p=b+8|0;q=d+54|0;r=b+24|0;do{if(a[q>>0]|0)break a;if(!(a[i>>0]|0)){if(a[k>>0]|0?(c[p>>2]&1|0)==0:0)break a}else{if((c[o>>2]|0)==1)break a;if(!(c[p>>2]&2))break a}a[i>>0]=0;a[k>>0]=0;be(r,d,e,f,g,h);r=r+8|0}while(r>>>0<n>>>0)}while(0);a[i>>0]=j;a[k>>0]=l}return}function _d(b,d,e,f,g){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0;a:do if(!(Bd(b,c[d+8>>2]|0,g)|0)){if(!(Bd(b,c[d>>2]|0,g)|0)){h=c[b+12>>2]|0;i=b+16+(h<<3)|0;ce(b+16|0,d,e,f,g);j=b+24|0;if((h|0)<=1)break;h=c[b+8>>2]|0;if((h&2|0)==0?(k=d+36|0,(c[k>>2]|0)!=1):0){if(!(h&1)){h=d+54|0;l=j;while(1){if(a[h>>0]|0)break a;if((c[k>>2]|0)==1)break a;ce(l,d,e,f,g);l=l+8|0;if(l>>>0>=i>>>0)break a}}l=d+24|0;h=d+54|0;m=j;while(1){if(a[h>>0]|0)break a;if((c[k>>2]|0)==1?(c[l>>2]|0)==1:0)break a;ce(m,d,e,f,g);m=m+8|0;if(m>>>0>=i>>>0)break a}}m=d+54|0;l=j;while(1){if(a[m>>0]|0)break a;ce(l,d,e,f,g);l=l+8|0;if(l>>>0>=i>>>0)break a}}if((c[d+16>>2]|0)!=(e|0)?(i=d+20|0,(c[i>>2]|0)!=(e|0)):0){c[d+32>>2]=f;l=d+44|0;if((c[l>>2]|0)==4)break;m=b+16+(c[b+12>>2]<<3)|0;j=d+52|0;k=d+53|0;h=d+54|0;n=b+8|0;o=d+24|0;p=0;q=b+16|0;r=0;b:while(1){if(q>>>0>=m>>>0){s=p;t=18;break}a[j>>0]=0;a[k>>0]=0;be(q,d,e,e,1,g);if(a[h>>0]|0){s=p;t=18;break}do if(a[k>>0]|0){if(!(a[j>>0]|0))if(!(c[n>>2]&1)){s=1;t=18;break b}else{u=1;v=r;break}if((c[o>>2]|0)==1){t=23;break b}if(!(c[n>>2]&2)){t=23;break b}else{u=1;v=1}}else{u=p;v=r}while(0);p=u;q=q+8|0;r=v}do if((t|0)==18){if((!r?(c[i>>2]=e,q=d+40|0,c[q>>2]=(c[q>>2]|0)+1,(c[d+36>>2]|0)==1):0)?(c[o>>2]|0)==2:0){a[h>>0]=1;if(s){t=23;break}else{w=4;break}}if(s)t=23;else w=4}while(0);if((t|0)==23)w=3;c[l>>2]=w;break}if((f|0)==1)c[d+32>>2]=1}else Dd(0,d,e,f);while(0);return}function $d(b,d,e,f){b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0;a:do if(!(Bd(b,c[d+8>>2]|0,0)|0)){g=c[b+12>>2]|0;h=b+16+(g<<3)|0;ae(b+16|0,d,e,f);if((g|0)>1){g=d+54|0;i=b+24|0;do{ae(i,d,e,f);if(a[g>>0]|0)break a;i=i+8|0}while(i>>>0<h>>>0)}}else Cd(0,d,e,f);while(0);return}function ae(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0;f=c[a+4>>2]|0;g=f>>8;if(!(f&1))h=g;else h=c[(c[d>>2]|0)+g>>2]|0;g=c[a>>2]|0;Da[c[(c[g>>2]|0)+28>>2]&7](g,b,d+h|0,(f&2|0)==0?2:e);return}function be(a,b,d,e,f,g){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0,j=0;h=c[a+4>>2]|0;i=h>>8;if(!(h&1))j=i;else j=c[(c[e>>2]|0)+i>>2]|0;i=c[a>>2]|0;Fa[c[(c[i>>2]|0)+20>>2]&3](i,b,d,e+j|0,(h&2|0)==0?2:f,g);return}function ce(a,b,d,e,f){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0;g=c[a+4>>2]|0;h=g>>8;if(!(g&1))i=h;else i=c[(c[d>>2]|0)+h>>2]|0;h=c[a>>2]|0;Ea[c[(c[h>>2]|0)+24>>2]&3](h,b,d+i|0,(g&2|0)==0?2:e,f);return}function de(){var a=0;a=c[2028]|0;c[2028]=a+0;return a|0}function ee(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0;e=ua;ua=ua+16|0;if((ua|0)>=(va|0))x(16);f=e;c[f>>2]=c[d>>2];g=za[c[(c[a>>2]|0)+16>>2]&7](a,b,f)|0;if(g)c[d>>2]=c[f>>2];ua=e;return g&1|0}function fe(a){a=a|0;var b=0;if(!a)b=0;else b=(Fd(a,3056,3144,0)|0)!=0&1;return b|0}function ge(a,b){a=a|0;b=b|0;var c=0,d=0,e=0,f=0;c=a&65535;d=b&65535;e=s(d,c)|0;f=a>>>16;a=(e>>>16)+(s(d,f)|0)|0;d=b>>>16;b=s(d,c)|0;return (v((a>>>16)+(s(d,f)|0)+(((a&65535)+b|0)>>>16)|0),a+b<<16|e&65535|0)|0}function he(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;var e=0,f=0;e=a;a=c;c=ge(e,a)|0;f=w()|0;return (v((s(b,a)|0)+(s(d,e)|0)+f|f&0|0),c|0|0)|0}function ie(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;var e=0;e=a+c>>>0;return (v(b+d+(e>>>0<a>>>0|0)>>>0|0),e|0)|0}function je(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;var e=0;e=b-d>>>0;e=b-d-(c>>>0>a>>>0|0)>>>0;return (v(e|0),a-c>>>0|0)|0}function ke(a){a=a|0;return (a?31-(t(a^a-1)|0)|0:32)|0}function le(a,b,d,e,f){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,u=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0;g=a;h=b;i=h;j=d;k=e;l=k;if(!i){m=(f|0)!=0;if(!l){if(m){c[f>>2]=(g>>>0)%(j>>>0);c[f+4>>2]=0}n=0;o=(g>>>0)/(j>>>0)>>>0;return (v(n|0),o)|0}else{if(!m){n=0;o=0;return (v(n|0),o)|0}c[f>>2]=a|0;c[f+4>>2]=b&0;n=0;o=0;return (v(n|0),o)|0}}m=(l|0)==0;do if(j){if(!m){p=(t(l|0)|0)-(t(i|0)|0)|0;if(p>>>0<=31){q=p+1|0;r=31-p|0;s=p-31>>31;u=q;x=g>>>(q>>>0)&s|i<<r;y=i>>>(q>>>0)&s;z=0;A=g<<r;break}if(!f){n=0;o=0;return (v(n|0),o)|0}c[f>>2]=a|0;c[f+4>>2]=h|b&0;n=0;o=0;return (v(n|0),o)|0}r=j-1|0;if(r&j|0){s=(t(j|0)|0)+33-(t(i|0)|0)|0;q=64-s|0;p=32-s|0;B=p>>31;C=s-32|0;D=C>>31;u=s;x=p-1>>31&i>>>(C>>>0)|(i<<p|g>>>(s>>>0))&D;y=D&i>>>(s>>>0);z=g<<q&B;A=(i<<q|g>>>(C>>>0))&B|g<<p&s-33>>31;break}if(f|0){c[f>>2]=r&g;c[f+4>>2]=0}if((j|0)==1){n=h|b&0;o=a|0|0;return (v(n|0),o)|0}else{r=ke(j|0)|0;n=i>>>(r>>>0)|0;o=i<<32-r|g>>>(r>>>0)|0;return (v(n|0),o)|0}}else{if(m){if(f|0){c[f>>2]=(i>>>0)%(j>>>0);c[f+4>>2]=0}n=0;o=(i>>>0)/(j>>>0)>>>0;return (v(n|0),o)|0}if(!g){if(f|0){c[f>>2]=0;c[f+4>>2]=(i>>>0)%(l>>>0)}n=0;o=(i>>>0)/(l>>>0)>>>0;return (v(n|0),o)|0}r=l-1|0;if(!(r&l)){if(f|0){c[f>>2]=a|0;c[f+4>>2]=r&i|b&0}n=0;o=i>>>((ke(l|0)|0)>>>0);return (v(n|0),o)|0}r=(t(l|0)|0)-(t(i|0)|0)|0;if(r>>>0<=30){s=r+1|0;p=31-r|0;u=s;x=i<<p|g>>>(s>>>0);y=i>>>(s>>>0);z=0;A=g<<p;break}if(!f){n=0;o=0;return (v(n|0),o)|0}c[f>>2]=a|0;c[f+4>>2]=h|b&0;n=0;o=0;return (v(n|0),o)|0}while(0);if(!u){E=A;F=z;G=y;H=x;I=0;J=0}else{b=d|0|0;d=k|e&0;e=ie(b|0,d|0,-1,-1)|0;k=w()|0;h=A;A=z;z=y;y=x;x=u;u=0;do{a=h;h=A>>>31|h<<1;A=u|A<<1;g=y<<1|a>>>31|0;a=y>>>31|z<<1|0;je(e|0,k|0,g|0,a|0)|0;i=w()|0;l=i>>31|((i|0)<0?-1:0)<<1;u=l&1;y=je(g|0,a|0,l&b|0,(((i|0)<0?-1:0)>>31|((i|0)<0?-1:0)<<1)&d|0)|0;z=w()|0;x=x-1|0}while((x|0)!=0);E=h;F=A;G=z;H=y;I=0;J=u}u=F;F=0;if(f|0){c[f>>2]=H;c[f+4>>2]=G}n=(u|0)>>>31|(E|F)<<1|(F<<1|u>>>31)&0|I;o=(u<<1|0>>>31)&-2|J;return (v(n|0),o)|0}function me(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;return le(a,b,c,d,0)|0}function ne(a,b,c){a=a|0;b=b|0;c=c|0;if((c|0)<32){v(b>>>c|0);return a>>>c|(b&(1<<c)-1)<<32-c}v(0);return b>>>c-32|0}function oe(a,b,c){a=a|0;b=b|0;c=c|0;if((c|0)<32){v(b<<c|(a&(1<<c)-1<<32-c)>>>32-c|0);return a<<c}v(a<<c-32|0);return 0}function pe(a){a=a|0;return (a&255)<<24|(a>>8&255)<<16|(a>>16&255)<<8|a>>>24|0}function qe(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0;if((e|0)>=8192){ia(b|0,d|0,e|0)|0;return b|0}f=b|0;g=b+e|0;if((b&3)==(d&3)){while(b&3){if(!e)return f|0;a[b>>0]=a[d>>0]|0;b=b+1|0;d=d+1|0;e=e-1|0}h=g&-4|0;e=h-64|0;while((b|0)<=(e|0)){c[b>>2]=c[d>>2];c[b+4>>2]=c[d+4>>2];c[b+8>>2]=c[d+8>>2];c[b+12>>2]=c[d+12>>2];c[b+16>>2]=c[d+16>>2];c[b+20>>2]=c[d+20>>2];c[b+24>>2]=c[d+24>>2];c[b+28>>2]=c[d+28>>2];c[b+32>>2]=c[d+32>>2];c[b+36>>2]=c[d+36>>2];c[b+40>>2]=c[d+40>>2];c[b+44>>2]=c[d+44>>2];c[b+48>>2]=c[d+48>>2];c[b+52>>2]=c[d+52>>2];c[b+56>>2]=c[d+56>>2];c[b+60>>2]=c[d+60>>2];b=b+64|0;d=d+64|0}while((b|0)<(h|0)){c[b>>2]=c[d>>2];b=b+4|0;d=d+4|0}}else{h=g-4|0;while((b|0)<(h|0)){a[b>>0]=a[d>>0]|0;a[b+1>>0]=a[d+1>>0]|0;a[b+2>>0]=a[d+2>>0]|0;a[b+3>>0]=a[d+3>>0]|0;b=b+4|0;d=d+4|0}}while((b|0)<(g|0)){a[b>>0]=a[d>>0]|0;b=b+1|0;d=d+1|0}return f|0}function re(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0;f=b+e|0;d=d&255;if((e|0)>=67){while(b&3){a[b>>0]=d;b=b+1|0}g=f&-4|0;h=d|d<<8|d<<16|d<<24;i=g-64|0;while((b|0)<=(i|0)){c[b>>2]=h;c[b+4>>2]=h;c[b+8>>2]=h;c[b+12>>2]=h;c[b+16>>2]=h;c[b+20>>2]=h;c[b+24>>2]=h;c[b+28>>2]=h;c[b+32>>2]=h;c[b+36>>2]=h;c[b+40>>2]=h;c[b+44>>2]=h;c[b+48>>2]=h;c[b+52>>2]=h;c[b+56>>2]=h;c[b+60>>2]=h;b=b+64|0}while((b|0)<(g|0)){c[b>>2]=h;b=b+4|0}}while((b|0)<(f|0)){a[b>>0]=d;b=b+1|0}return f-e|0}function se(a){a=a|0;var b=0,d=0;b=c[i>>2]|0;d=b+a|0;if((a|0)>0&(d|0)<(b|0)|(d|0)<0){sa(d|0)|0;$(12);return -1}if((d|0)>(ga()|0)){if(!(ja(d|0)|0)){$(12);return -1}}else c[i>>2]=d;return b|0}function te(a,b){a=a|0;b=b|0;return xa[a&7](b|0)|0}function ue(a,b,c){a=a|0;b=b|0;c=c|0;return ya[a&7](b|0,c|0)|0}function ve(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;return za[a&7](b|0,c|0,d|0)|0}function we(a){a=a|0;Aa[a&3]()}function xe(a,b){a=a|0;b=b|0;Ba[a&63](b|0)}function ye(a,b,c){a=a|0;b=b|0;c=c|0;Ca[a&3](b|0,c|0)}function ze(a,b,c,d,e){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;Da[a&7](b|0,c|0,d|0,e|0)}function Ae(a,b,c,d,e,f){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;f=f|0;Ea[a&3](b|0,c|0,d|0,e|0,f|0)}function Be(a,b,c,d,e,f,g){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;f=f|0;g=g|0;Fa[a&3](b|0,c|0,d|0,e|0,f|0,g|0)}function Ce(a){a=a|0;y(0);return 0}function De(a){a=a|0;y(6);return 0}function Ee(a){a=a|0;y(7);return 0}function Fe(a,b){a=a|0;b=b|0;z(0);return 0}function Ge(a,b,c){a=a|0;b=b|0;c=c|0;A(0);return 0}function He(a,b,c){a=a|0;b=b|0;c=c|0;A(5);return 0}function Ie(a,b,c){a=a|0;b=b|0;c=c|0;A(6);return 0}function Je(a,b,c){a=a|0;b=b|0;c=c|0;A(7);return 0}function Ke(){B(0)}function Le(a){a=a|0;C(0)}function Me(a){a=a|0;C(37)}function Ne(a){a=a|0;C(38)}function Oe(a){a=a|0;C(39)}function Pe(a){a=a|0;C(40)}function Qe(a){a=a|0;C(41)}function Re(a){a=a|0;C(42)}function Se(a){a=a|0;C(43)}function Te(a){a=a|0;C(44)}function Ue(a){a=a|0;C(45)}function Ve(a){a=a|0;C(46)}function We(a){a=a|0;C(47)}function Xe(a){a=a|0;C(48)}function Ye(a){a=a|0;C(49)}function Ze(a){a=a|0;C(50)}function _e(a){a=a|0;C(51)}function $e(a){a=a|0;C(52)}function af(a){a=a|0;C(53)}function bf(a){a=a|0;C(54)}function cf(a){a=a|0;C(55)}function df(a){a=a|0;C(56)}function ef(a){a=a|0;C(57)}function ff(a){a=a|0;C(58)}function gf(a){a=a|0;C(59)}function hf(a){a=a|0;C(60)}function jf(a){a=a|0;C(61)}function kf(a){a=a|0;C(62)}function lf(a){a=a|0;C(63)}function mf(a,b){a=a|0;b=b|0;D(0)}function nf(a,b){a=a|0;b=b|0;D(3)}function of(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;E(0)}function pf(a,b,c,d,e){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;F(0)}function qf(a,b,c,d,e,f){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;f=f|0;G(0)}

// EMSCRIPTEN_END_FUNCS
var xa=[Ce,Qb,Wb,$b,$c,Td,De,Ee];var ya=[Fe,ob,tb,zb,Eb,Ib,Mb,Vb];var za=[Ge,ac,bc,fc,xd,He,Ie,Je];var Aa=[Ke,qd,Ma,Ld];var Ba=[Le,cd,mb,nb,pb,rb,sb,ub,xb,yb,Ab,Cb,Db,Fb,Gb,Hb,Jb,Kb,Lb,Nb,Xb,Pb,Sb,Tb,Ub,Zc,_c,td,ud,vd,wd,Gd,Rd,Sd,Xd,Yd,Md,Me,Ne,Oe,Pe,Qe,Re,Se,Te,Ue,Ve,We,Xe,Ye,Ze,_e,$e,af,bf,cf,df,ef,ff,gf,hf,jf,kf,lf];var Ca=[mf,eb,Rb,nf];var Da=[of,fb,ib,qb,hb,Ad,Jd,$d];var Ea=[pf,zd,Id,_d];var Fa=[qf,yd,Hd,Zd];return{__GLOBAL__sub_I_main_cpp:_b,___cxa_can_catch:ee,___cxa_is_pointer_type:fe,___em_js__getCanvasHeight:La,___em_js__getCanvasWidth:Ka,___errno_location:dc,___muldi3:he,___udivdi3:me,_bitshift64Lshr:ne,_bitshift64Shl:oe,_fflush:wc,_free:Yc,_i64Add:ie,_i64Subtract:je,_llvm_bswap_i32:pe,_main:Na,_malloc:Xc,_memcpy:qe,_memset:re,_sbrk:se,dynCall_ii:te,dynCall_iii:ue,dynCall_iiii:ve,dynCall_v:we,dynCall_vi:xe,dynCall_vii:ye,dynCall_viiii:ze,dynCall_viiiii:Ae,dynCall_viiiiii:Be,establishStackSpace:Ja,stackAlloc:Ga,stackRestore:Ia,stackSave:Ha}})


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

