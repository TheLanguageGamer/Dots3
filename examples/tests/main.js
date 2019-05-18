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

var STACK_BASE = 16144, STACK_MAX = 5259024, DYNAMIC_BASE = 5259024, DYNAMICTOP_PTR = 15888;

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

var tempDoublePtr = 16128;

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

var debug_table_ii = [ "0", "__ZNKSt3__210__function6__funcIZN13TestTextLabelC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EE7__cloneEv", "__ZNKSt3__210__function6__funcIZN13TestTextLabelC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EE11target_typeEv", "__ZNKSt3__210__function6__funcIZN14TestEntityGridC1EvEUlvE_NS_9allocatorIS3_EEF6EntityvEE7__cloneEv", "__ZNKSt3__210__function6__funcIZN14TestEntityGridC1EvEUlvE_NS_9allocatorIS3_EEF6EntityvEE11target_typeEv", "__ZNKSt3__210__function6__funcIZN14TestEntityGridC1EvEUlRNS_6vectorI6EntityNS_9allocatorIS4_EEEEjjE_NS5_IS9_EEFvS8_jjEE7__cloneEv", "__ZNKSt3__210__function6__funcIZN14TestEntityGridC1EvEUlRNS_6vectorI6EntityNS_9allocatorIS4_EEEEjjE_NS5_IS9_EEFvS8_jjEE11target_typeEv", "__ZNKSt3__210__function6__funcIZN13TestDraggableC1EvEUlR7Vector2E_NS_9allocatorIS5_EEFvS4_EE7__cloneEv", "__ZNKSt3__210__function6__funcIZN13TestDraggableC1EvEUlR7Vector2E_NS_9allocatorIS5_EEFvS4_EE11target_typeEv", "__ZNKSt3__210__function6__funcIZN13TestDraggableC1EvEUlR7Vector2E0_NS_9allocatorIS5_EEFvS4_EE7__cloneEv", "__ZNKSt3__210__function6__funcIZN13TestDraggableC1EvEUlR7Vector2E0_NS_9allocatorIS5_EEFvS4_EE11target_typeEv", "__ZNKSt3__210__function6__funcIZN13TestDraggableC1EvEUlR7Vector2E1_NS_9allocatorIS5_EEFvS4_EE7__cloneEv", "__ZNKSt3__210__function6__funcIZN13TestDraggableC1EvEUlR7Vector2E1_NS_9allocatorIS5_EEFvS4_EE11target_typeEv", "__ZNKSt3__210__function6__funcIZN13TestClickableC1EvEUlvE_NS_9allocatorIS3_EEFvvEE7__cloneEv", "__ZNKSt3__210__function6__funcIZN13TestClickableC1EvEUlvE_NS_9allocatorIS3_EEFvvEE11target_typeEv", "__ZNKSt3__210__function6__funcIZN13TestClickableC1EvEUlvE0_NS_9allocatorIS3_EEFvvEE7__cloneEv", "__ZNKSt3__210__function6__funcIZN13TestClickableC1EvEUlvE0_NS_9allocatorIS3_EEFvvEE11target_typeEv", "__ZNKSt3__210__function6__funcIZN13TestClickableC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EE7__cloneEv", "__ZNKSt3__210__function6__funcIZN13TestClickableC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EE11target_typeEv", "__ZNKSt3__210__function6__funcIZN13TestClickableC1EvEUlvE1_NS_9allocatorIS3_EEFvvEE7__cloneEv", "__ZNKSt3__210__function6__funcIZN13TestClickableC1EvEUlvE1_NS_9allocatorIS3_EEFvvEE11target_typeEv", "__ZNKSt3__210__function6__funcIZN13TestClickableC1EvEUlvE2_NS_9allocatorIS3_EEFvvEE7__cloneEv", "__ZNKSt3__210__function6__funcIZN13TestClickableC1EvEUlvE2_NS_9allocatorIS3_EEFvvEE11target_typeEv", "__ZNKSt3__210__function6__funcIZN13TestClickableC1EvEUlRK7Vector2E0_NS_9allocatorIS6_EEFvS5_EE7__cloneEv", "__ZNKSt3__210__function6__funcIZN13TestClickableC1EvEUlRK7Vector2E0_NS_9allocatorIS6_EEFvS5_EE11target_typeEv", "__ZNKSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlvE_NS5_ISG_EEFvvEE7__cloneEv", "__ZNKSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlvE_NS5_ISG_EEFvvEE11target_typeEv", "__ZNKSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlvE0_NS5_ISG_EEFvvEE7__cloneEv", "__ZNKSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlvE0_NS5_ISG_EEFvvEE11target_typeEv", "__ZNKSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlSC_E_NS5_ISG_EEFvSC_EE7__cloneEv", "__ZNKSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlSC_E_NS5_ISG_EEFvSC_EE11target_typeEv", "__ZNKSt3__210__function6__funcIZN11TestPoolingC1EvEUlvE_NS_9allocatorIS3_EEFP9ComponentvEE7__cloneEv", "__ZNSt3__210__function6__funcIZN11TestPoolingC1EvEUlvE_NS_9allocatorIS3_EEFP9ComponentvEEclEv", "__ZNKSt3__210__function6__funcIZN11TestPoolingC1EvEUlvE_NS_9allocatorIS3_EEFP9ComponentvEE11target_typeEv", "__ZNKSt3__210__function6__funcIZZN11TestPoolingC1EvENKUlvE_clEvEUlRK7Vector2P12CustomButtonE_NS_9allocatorIS9_EEFvS6_S8_EE7__cloneEv", "__ZNKSt3__210__function6__funcIZZN11TestPoolingC1EvENKUlvE_clEvEUlRK7Vector2P12CustomButtonE_NS_9allocatorIS9_EEFvS6_S8_EE11target_typeEv", "__ZNKSt3__210__function6__funcIZN11TestPoolingC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EE7__cloneEv", "__ZNKSt3__210__function6__funcIZN11TestPoolingC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EE11target_typeEv", "__ZNKSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEE7__cloneEv", "__ZNKSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEE11target_typeEv", "___stdio_close", "__ZNKSt3__217bad_function_call4whatEv", "__ZNKSt11logic_error4whatEv", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0" ];

var debug_table_iii = [ "0", "__ZNKSt3__220__shared_ptr_pointerIP9ComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP18RectangleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP13TextComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__210__function6__funcIZN13TestTextLabelC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EE6targetERKSt9type_info", "__ZNKSt3__210__function6__funcIZN14TestEntityGridC1EvEUlvE_NS_9allocatorIS3_EEF6EntityvEE6targetERKSt9type_info", "__ZNKSt3__210__function6__funcIZN14TestEntityGridC1EvEUlRNS_6vectorI6EntityNS_9allocatorIS4_EEEEjjE_NS5_IS9_EEFvS8_jjEE6targetERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP10EntityGridNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__210__function6__funcIZN13TestDraggableC1EvEUlR7Vector2E_NS_9allocatorIS5_EEFvS4_EE6targetERKSt9type_info", "__ZNKSt3__210__function6__funcIZN13TestDraggableC1EvEUlR7Vector2E0_NS_9allocatorIS5_EEFvS4_EE6targetERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP21StrokeCircleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP19FillCircleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__210__function6__funcIZN13TestDraggableC1EvEUlR7Vector2E1_NS_9allocatorIS5_EEFvS4_EE6targetERKSt9type_info", "__ZNKSt3__210__function6__funcIZN13TestClickableC1EvEUlvE_NS_9allocatorIS3_EEFvvEE6targetERKSt9type_info", "__ZNKSt3__210__function6__funcIZN13TestClickableC1EvEUlvE0_NS_9allocatorIS3_EEFvvEE6targetERKSt9type_info", "__ZNKSt3__210__function6__funcIZN13TestClickableC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EE6targetERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP25RoundedRectangleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__210__function6__funcIZN13TestClickableC1EvEUlvE1_NS_9allocatorIS3_EEFvvEE6targetERKSt9type_info", "__ZNKSt3__210__function6__funcIZN13TestClickableC1EvEUlvE2_NS_9allocatorIS3_EEFvvEE6targetERKSt9type_info", "__ZNKSt3__210__function6__funcIZN13TestClickableC1EvEUlRK7Vector2E0_NS_9allocatorIS6_EEFvS5_EE6targetERKSt9type_info", "__ZNKSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlvE_NS5_ISG_EEFvvEE6targetERKSt9type_info", "__ZNKSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlvE0_NS5_ISG_EEFvvEE6targetERKSt9type_info", "__ZNKSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlSC_E_NS5_ISG_EEFvSC_EE6targetERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP12CustomButtonNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP17FixedCapacityPoolNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__210__function6__funcIZN11TestPoolingC1EvEUlvE_NS_9allocatorIS3_EEFP9ComponentvEE6targetERKSt9type_info", "__ZNKSt3__210__function6__funcIZZN11TestPoolingC1EvENKUlvE_clEvEUlRK7Vector2P12CustomButtonE_NS_9allocatorIS9_EEFvS6_S8_EE6targetERKSt9type_info", "__ZNKSt3__210__function6__funcIZN11TestPoolingC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EE6targetERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP15SpringAnimationNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP15ComposeMovementNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP18SequentialMovementNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP14TestPrimitivesNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP13TestTextLabelNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP14TestEntityGridNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP13TestDraggableNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP13TestClickableNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP11TestPoolingNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP13TestAnimationNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEE6targetERKSt9type_info", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0" ];

var debug_table_iiii = [ "0", "___stdio_write", "___stdio_seek", "___stdout_write", "__ZNK10__cxxabiv117__class_type_info9can_catchEPKNS_16__shim_type_infoERPv", "0", "0", "0" ];

var debug_table_v = [ "0", "__ZL25default_terminate_handlerv", "__Z9main_loopv", "__ZN10__cxxabiv112_GLOBAL__N_110construct_Ev" ];

var debug_table_vi = [ "0", "__ZNSt3__214__shared_countD2Ev", "__ZNSt3__220__shared_ptr_pointerIP9ComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP9ComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP9ComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__220__shared_ptr_pointerIP18RectangleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP18RectangleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP18RectangleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__220__shared_ptr_pointerIP13TextComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP13TextComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP13TextComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__210__function6__funcIZN13TestTextLabelC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EED2Ev", "__ZNSt3__210__function6__funcIZN13TestTextLabelC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EED0Ev", "__ZNSt3__210__function6__funcIZN13TestTextLabelC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EE7destroyEv", "__ZNSt3__210__function6__funcIZN13TestTextLabelC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EE18destroy_deallocateEv", "__ZNSt3__210__function6__baseIF6EntityvEED2Ev", "__ZNSt3__210__function6__funcIZN14TestEntityGridC1EvEUlvE_NS_9allocatorIS3_EEF6EntityvEED0Ev", "__ZNSt3__210__function6__funcIZN14TestEntityGridC1EvEUlvE_NS_9allocatorIS3_EEF6EntityvEE7destroyEv", "__ZNSt3__210__function6__funcIZN14TestEntityGridC1EvEUlvE_NS_9allocatorIS3_EEF6EntityvEE18destroy_deallocateEv", "__ZNSt3__210__function6__baseIFvRNS_6vectorI6EntityNS_9allocatorIS3_EEEEjjEED2Ev", "__ZNSt3__210__function6__funcIZN14TestEntityGridC1EvEUlRNS_6vectorI6EntityNS_9allocatorIS4_EEEEjjE_NS5_IS9_EEFvS8_jjEED0Ev", "__ZNSt3__210__function6__funcIZN14TestEntityGridC1EvEUlRNS_6vectorI6EntityNS_9allocatorIS4_EEEEjjE_NS5_IS9_EEFvS8_jjEE7destroyEv", "__ZNSt3__210__function6__funcIZN14TestEntityGridC1EvEUlRNS_6vectorI6EntityNS_9allocatorIS4_EEEEjjE_NS5_IS9_EEFvS8_jjEE18destroy_deallocateEv", "__ZNSt3__220__shared_ptr_pointerIP10EntityGridNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP10EntityGridNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP10EntityGridNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__210__function6__baseIFvR7Vector2EED2Ev", "__ZNSt3__210__function6__funcIZN13TestDraggableC1EvEUlR7Vector2E_NS_9allocatorIS5_EEFvS4_EED0Ev", "__ZNSt3__210__function6__funcIZN13TestDraggableC1EvEUlR7Vector2E_NS_9allocatorIS5_EEFvS4_EE7destroyEv", "__ZNSt3__210__function6__funcIZN13TestDraggableC1EvEUlR7Vector2E_NS_9allocatorIS5_EEFvS4_EE18destroy_deallocateEv", "__ZNSt3__210__function6__funcIZN13TestDraggableC1EvEUlR7Vector2E0_NS_9allocatorIS5_EEFvS4_EED0Ev", "__ZNSt3__210__function6__funcIZN13TestDraggableC1EvEUlR7Vector2E0_NS_9allocatorIS5_EEFvS4_EE7destroyEv", "__ZNSt3__210__function6__funcIZN13TestDraggableC1EvEUlR7Vector2E0_NS_9allocatorIS5_EEFvS4_EE18destroy_deallocateEv", "__ZNSt3__220__shared_ptr_pointerIP21StrokeCircleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP21StrokeCircleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP21StrokeCircleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__220__shared_ptr_pointerIP19FillCircleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP19FillCircleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP19FillCircleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__210__function6__funcIZN13TestDraggableC1EvEUlR7Vector2E1_NS_9allocatorIS5_EEFvS4_EED0Ev", "__ZNSt3__210__function6__funcIZN13TestDraggableC1EvEUlR7Vector2E1_NS_9allocatorIS5_EEFvS4_EE7destroyEv", "__ZNSt3__210__function6__funcIZN13TestDraggableC1EvEUlR7Vector2E1_NS_9allocatorIS5_EEFvS4_EE18destroy_deallocateEv", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlvE_NS_9allocatorIS3_EEFvvEED2Ev", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlvE_NS_9allocatorIS3_EEFvvEED0Ev", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlvE_NS_9allocatorIS3_EEFvvEE7destroyEv", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlvE_NS_9allocatorIS3_EEFvvEE18destroy_deallocateEv", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlvE_NS_9allocatorIS3_EEFvvEEclEv", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlvE0_NS_9allocatorIS3_EEFvvEED2Ev", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlvE0_NS_9allocatorIS3_EEFvvEED0Ev", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlvE0_NS_9allocatorIS3_EEFvvEE7destroyEv", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlvE0_NS_9allocatorIS3_EEFvvEE18destroy_deallocateEv", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlvE0_NS_9allocatorIS3_EEFvvEEclEv", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EED2Ev", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EED0Ev", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EE7destroyEv", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EE18destroy_deallocateEv", "__ZNSt3__220__shared_ptr_pointerIP25RoundedRectangleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP25RoundedRectangleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP25RoundedRectangleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlvE1_NS_9allocatorIS3_EEFvvEED2Ev", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlvE1_NS_9allocatorIS3_EEFvvEED0Ev", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlvE1_NS_9allocatorIS3_EEFvvEE7destroyEv", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlvE1_NS_9allocatorIS3_EEFvvEE18destroy_deallocateEv", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlvE1_NS_9allocatorIS3_EEFvvEEclEv", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlvE2_NS_9allocatorIS3_EEFvvEED2Ev", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlvE2_NS_9allocatorIS3_EEFvvEED0Ev", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlvE2_NS_9allocatorIS3_EEFvvEE7destroyEv", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlvE2_NS_9allocatorIS3_EEFvvEE18destroy_deallocateEv", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlvE2_NS_9allocatorIS3_EEFvvEEclEv", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlRK7Vector2E0_NS_9allocatorIS6_EEFvS5_EED2Ev", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlRK7Vector2E0_NS_9allocatorIS6_EEFvS5_EED0Ev", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlRK7Vector2E0_NS_9allocatorIS6_EEFvS5_EE7destroyEv", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlRK7Vector2E0_NS_9allocatorIS6_EEFvS5_EE18destroy_deallocateEv", "__ZNSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlvE_NS5_ISG_EEFvvEED2Ev", "__ZNSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlvE_NS5_ISG_EEFvvEED0Ev", "__ZNSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlvE_NS5_ISG_EEFvvEE7destroyEv", "__ZNSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlvE_NS5_ISG_EEFvvEE18destroy_deallocateEv", "__ZNSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlvE_NS5_ISG_EEFvvEEclEv", "__ZNSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlvE0_NS5_ISG_EEFvvEED2Ev", "__ZNSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlvE0_NS5_ISG_EEFvvEED0Ev", "__ZNSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlvE0_NS5_ISG_EEFvvEE7destroyEv", "__ZNSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlvE0_NS5_ISG_EEFvvEE18destroy_deallocateEv", "__ZNSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlvE0_NS5_ISG_EEFvvEEclEv", "__ZNSt3__210__function6__baseIFvRK7Vector2EED2Ev", "__ZNSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlSC_E_NS5_ISG_EEFvSC_EED0Ev", "__ZNSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlSC_E_NS5_ISG_EEFvSC_EE7destroyEv", "__ZNSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlSC_E_NS5_ISG_EEFvSC_EE18destroy_deallocateEv", "__ZNSt3__220__shared_ptr_pointerIP12CustomButtonNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP12CustomButtonNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP12CustomButtonNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__220__shared_ptr_pointerIP17FixedCapacityPoolNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP17FixedCapacityPoolNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP17FixedCapacityPoolNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__210__function6__baseIFP9ComponentvEED2Ev", "__ZNSt3__210__function6__funcIZN11TestPoolingC1EvEUlvE_NS_9allocatorIS3_EEFP9ComponentvEED0Ev", "__ZNSt3__210__function6__funcIZN11TestPoolingC1EvEUlvE_NS_9allocatorIS3_EEFP9ComponentvEE7destroyEv", "__ZNSt3__210__function6__funcIZN11TestPoolingC1EvEUlvE_NS_9allocatorIS3_EEFP9ComponentvEE18destroy_deallocateEv", "__ZNSt3__210__function6__baseIFvRK7Vector2P12CustomButtonEED2Ev", "__ZNSt3__210__function6__funcIZZN11TestPoolingC1EvENKUlvE_clEvEUlRK7Vector2P12CustomButtonE_NS_9allocatorIS9_EEFvS6_S8_EED0Ev", "__ZNSt3__210__function6__funcIZZN11TestPoolingC1EvENKUlvE_clEvEUlRK7Vector2P12CustomButtonE_NS_9allocatorIS9_EEFvS6_S8_EE7destroyEv", "__ZNSt3__210__function6__funcIZZN11TestPoolingC1EvENKUlvE_clEvEUlRK7Vector2P12CustomButtonE_NS_9allocatorIS9_EEFvS6_S8_EE18destroy_deallocateEv", "__ZNSt3__210__function6__funcIZN11TestPoolingC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EED0Ev", "__ZNSt3__210__function6__funcIZN11TestPoolingC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EE7destroyEv", "__ZNSt3__210__function6__funcIZN11TestPoolingC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EE18destroy_deallocateEv", "__ZNSt3__220__shared_ptr_pointerIP15SpringAnimationNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP15SpringAnimationNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP15SpringAnimationNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__220__shared_ptr_pointerIP15ComposeMovementNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP15ComposeMovementNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP15ComposeMovementNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__220__shared_ptr_pointerIP18SequentialMovementNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP18SequentialMovementNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP18SequentialMovementNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__220__shared_ptr_pointerIP14TestPrimitivesNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP14TestPrimitivesNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP14TestPrimitivesNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__220__shared_ptr_pointerIP13TestTextLabelNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP13TestTextLabelNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP13TestTextLabelNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__220__shared_ptr_pointerIP14TestEntityGridNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP14TestEntityGridNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP14TestEntityGridNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__220__shared_ptr_pointerIP13TestDraggableNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP13TestDraggableNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP13TestDraggableNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__220__shared_ptr_pointerIP13TestClickableNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP13TestClickableNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP13TestClickableNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__220__shared_ptr_pointerIP11TestPoolingNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP11TestPoolingNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP11TestPoolingNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__220__shared_ptr_pointerIP13TestAnimationNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP13TestAnimationNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP13TestAnimationNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__210__function6__baseIFvvEED2Ev", "__ZNSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEED0Ev", "__ZNSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEE7destroyEv", "__ZNSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEE18destroy_deallocateEv", "__ZNSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEEclEv", "__ZNSt3__217bad_function_callD2Ev", "__ZNSt3__217bad_function_callD0Ev", "__ZN10__cxxabiv116__shim_type_infoD2Ev", "__ZN10__cxxabiv117__class_type_infoD0Ev", "__ZNK10__cxxabiv116__shim_type_info5noop1Ev", "__ZNK10__cxxabiv116__shim_type_info5noop2Ev", "__ZN10__cxxabiv120__si_class_type_infoD0Ev", "__ZNSt11logic_errorD2Ev", "__ZNSt11logic_errorD0Ev", "__ZNSt12length_errorD0Ev", "__ZN10__cxxabiv121__vmi_class_type_infoD0Ev", "__ZN10__cxxabiv112_GLOBAL__N_19destruct_EPv", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0" ];

var debug_table_vidi = [ "0", "__ZN6Screen4loopEfRKNSt3__26vectorIbNS0_9allocatorIbEEEE" ];

var debug_table_vii = [ "0", "__ZN6Screen7onKeyUpEi", "__ZN6Screen9onKeyDownEi", "__ZNKSt3__210__function6__funcIZN13TestTextLabelC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EE7__cloneEPNS0_6__baseIS9_EE", "__ZNSt3__210__function6__funcIZN13TestTextLabelC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EEclES5_", "__ZNKSt3__210__function6__funcIZN14TestEntityGridC1EvEUlvE_NS_9allocatorIS3_EEF6EntityvEE7__cloneEPNS0_6__baseIS7_EE", "__ZNSt3__210__function6__funcIZN14TestEntityGridC1EvEUlvE_NS_9allocatorIS3_EEF6EntityvEEclEv", "__ZNKSt3__210__function6__funcIZN14TestEntityGridC1EvEUlRNS_6vectorI6EntityNS_9allocatorIS4_EEEEjjE_NS5_IS9_EEFvS8_jjEE7__cloneEPNS0_6__baseISB_EE", "__ZNKSt3__210__function6__funcIZN13TestDraggableC1EvEUlR7Vector2E_NS_9allocatorIS5_EEFvS4_EE7__cloneEPNS0_6__baseIS8_EE", "__ZNSt3__210__function6__funcIZN13TestDraggableC1EvEUlR7Vector2E_NS_9allocatorIS5_EEFvS4_EEclES4_", "__ZNKSt3__210__function6__funcIZN13TestDraggableC1EvEUlR7Vector2E0_NS_9allocatorIS5_EEFvS4_EE7__cloneEPNS0_6__baseIS8_EE", "__ZNSt3__210__function6__funcIZN13TestDraggableC1EvEUlR7Vector2E0_NS_9allocatorIS5_EEFvS4_EEclES4_", "__ZNKSt3__210__function6__funcIZN13TestDraggableC1EvEUlR7Vector2E1_NS_9allocatorIS5_EEFvS4_EE7__cloneEPNS0_6__baseIS8_EE", "__ZNSt3__210__function6__funcIZN13TestDraggableC1EvEUlR7Vector2E1_NS_9allocatorIS5_EEFvS4_EEclES4_", "__ZNKSt3__210__function6__funcIZN13TestClickableC1EvEUlvE_NS_9allocatorIS3_EEFvvEE7__cloneEPNS0_6__baseIS6_EE", "__ZNKSt3__210__function6__funcIZN13TestClickableC1EvEUlvE0_NS_9allocatorIS3_EEFvvEE7__cloneEPNS0_6__baseIS6_EE", "__ZNKSt3__210__function6__funcIZN13TestClickableC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EE7__cloneEPNS0_6__baseIS9_EE", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EEclES5_", "__ZNKSt3__210__function6__funcIZN13TestClickableC1EvEUlvE1_NS_9allocatorIS3_EEFvvEE7__cloneEPNS0_6__baseIS6_EE", "__ZNKSt3__210__function6__funcIZN13TestClickableC1EvEUlvE2_NS_9allocatorIS3_EEFvvEE7__cloneEPNS0_6__baseIS6_EE", "__ZNKSt3__210__function6__funcIZN13TestClickableC1EvEUlRK7Vector2E0_NS_9allocatorIS6_EEFvS5_EE7__cloneEPNS0_6__baseIS9_EE", "__ZNSt3__210__function6__funcIZN13TestClickableC1EvEUlRK7Vector2E0_NS_9allocatorIS6_EEFvS5_EEclES5_", "__ZNKSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlvE_NS5_ISG_EEFvvEE7__cloneEPNS0_6__baseISI_EE", "__ZNKSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlvE0_NS5_ISG_EEFvvEE7__cloneEPNS0_6__baseISI_EE", "__ZNKSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlSC_E_NS5_ISG_EEFvSC_EE7__cloneEPNS0_6__baseISI_EE", "__ZNSt3__210__function6__funcIZN12CustomButtonC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEENS_8functionIFvRK7Vector2PS2_EEEEUlSC_E_NS5_ISG_EEFvSC_EEclESC_", "__ZNKSt3__210__function6__funcIZN11TestPoolingC1EvEUlvE_NS_9allocatorIS3_EEFP9ComponentvEE7__cloneEPNS0_6__baseIS8_EE", "__ZNKSt3__210__function6__funcIZZN11TestPoolingC1EvENKUlvE_clEvEUlRK7Vector2P12CustomButtonE_NS_9allocatorIS9_EEFvS6_S8_EE7__cloneEPNS0_6__baseISC_EE", "__ZNKSt3__210__function6__funcIZN11TestPoolingC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EE7__cloneEPNS0_6__baseIS9_EE", "__ZNSt3__210__function6__funcIZN11TestPoolingC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EEclES5_", "__ZNKSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEE7__cloneEPNS0_6__baseIS5_EE", "0" ];

var debug_table_viid = [ "0", "__ZN15SpringAnimation6onStepERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEEf", "__ZN15ComposeMovement6onStepERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEEf", "__ZN18SequentialMovement6onStepERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEEf" ];

var debug_table_viii = [ "0", "__ZN9Component8addChildERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEENS0_10shared_ptrIS_EE", "__ZNSt3__210__function6__funcIZZN11TestPoolingC1EvENKUlvE_clEvEUlRK7Vector2P12CustomButtonE_NS_9allocatorIS9_EEFvS6_S8_EEclES6_OS8_", "0" ];

var debug_table_viiii = [ "0", "__ZN9Component8doLayoutERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN9Component16doLayoutEntitiesERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN18RectangleComponent8doLayoutERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN18RectangleComponent16doLayoutEntitiesERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN13TextComponent8doLayoutERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN13TextComponent16doLayoutEntitiesERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZNSt3__210__function6__funcIZN14TestEntityGridC1EvEUlRNS_6vectorI6EntityNS_9allocatorIS4_EEEEjjE_NS5_IS9_EEFvS8_jjEEclES8_OjSD_", "__ZN13DrawComponent8doLayoutERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN13DrawComponent16doLayoutEntitiesERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN21StrokeCircleComponent8doLayoutERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN21StrokeCircleComponent16doLayoutEntitiesERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN19FillCircleComponent8doLayoutERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN19FillCircleComponent16doLayoutEntitiesERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN25RoundedRectangleComponent8doLayoutERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN25RoundedRectangleComponent16doLayoutEntitiesERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZNK10__cxxabiv117__class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi", "__ZNK10__cxxabiv120__si_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi", "__ZNK10__cxxabiv121__vmi_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0" ];

var debug_table_viiiii = [ "0", "__ZNK10__cxxabiv117__class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib", "__ZNK10__cxxabiv120__si_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib", "__ZNK10__cxxabiv121__vmi_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib" ];

var debug_table_viiiiii = [ "0", "__ZNK10__cxxabiv117__class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib", "__ZNK10__cxxabiv120__si_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib", "__ZNK10__cxxabiv121__vmi_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib" ];

function nullFunc_ii(x) {
 err("Invalid function pointer '" + x + "' called with signature 'ii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("This pointer might make sense in another type signature: iii: " + debug_table_iii[x] + "  iiii: " + debug_table_iiii[x] + "  vii: " + debug_table_vii[x] + "  vi: " + debug_table_vi[x] + "  vidi: " + debug_table_vidi[x] + "  viid: " + debug_table_viid[x] + "  viii: " + debug_table_viii[x] + "  v: " + debug_table_v[x] + "  viiii: " + debug_table_viiii[x] + "  viiiii: " + debug_table_viiiii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  ");
 abort(x);
}

function nullFunc_iii(x) {
 err("Invalid function pointer '" + x + "' called with signature 'iii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("This pointer might make sense in another type signature: ii: " + debug_table_ii[x] + "  iiii: " + debug_table_iiii[x] + "  viii: " + debug_table_viii[x] + "  vii: " + debug_table_vii[x] + "  vi: " + debug_table_vi[x] + "  viid: " + debug_table_viid[x] + "  viiii: " + debug_table_viiii[x] + "  vidi: " + debug_table_vidi[x] + "  viiiii: " + debug_table_viiiii[x] + "  v: " + debug_table_v[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  ");
 abort(x);
}

function nullFunc_iiii(x) {
 err("Invalid function pointer '" + x + "' called with signature 'iiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("This pointer might make sense in another type signature: iii: " + debug_table_iii[x] + "  ii: " + debug_table_ii[x] + "  viii: " + debug_table_viii[x] + "  viiii: " + debug_table_viiii[x] + "  vii: " + debug_table_vii[x] + "  vi: " + debug_table_vi[x] + "  vidi: " + debug_table_vidi[x] + "  viid: " + debug_table_viid[x] + "  viiiii: " + debug_table_viiiii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  v: " + debug_table_v[x] + "  ");
 abort(x);
}

function nullFunc_v(x) {
 err("Invalid function pointer '" + x + "' called with signature 'v'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("This pointer might make sense in another type signature: vi: " + debug_table_vi[x] + "  vii: " + debug_table_vii[x] + "  vidi: " + debug_table_vidi[x] + "  viid: " + debug_table_viid[x] + "  viii: " + debug_table_viii[x] + "  viiii: " + debug_table_viiii[x] + "  viiiii: " + debug_table_viiiii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  ii: " + debug_table_ii[x] + "  iii: " + debug_table_iii[x] + "  iiii: " + debug_table_iiii[x] + "  ");
 abort(x);
}

function nullFunc_vi(x) {
 err("Invalid function pointer '" + x + "' called with signature 'vi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("This pointer might make sense in another type signature: v: " + debug_table_v[x] + "  vii: " + debug_table_vii[x] + "  vidi: " + debug_table_vidi[x] + "  viid: " + debug_table_viid[x] + "  viii: " + debug_table_viii[x] + "  viiii: " + debug_table_viiii[x] + "  viiiii: " + debug_table_viiiii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  ii: " + debug_table_ii[x] + "  iii: " + debug_table_iii[x] + "  iiii: " + debug_table_iiii[x] + "  ");
 abort(x);
}

function nullFunc_vidi(x) {
 err("Invalid function pointer '" + x + "' called with signature 'vidi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("This pointer might make sense in another type signature: vi: " + debug_table_vi[x] + "  v: " + debug_table_v[x] + "  vii: " + debug_table_vii[x] + "  ii: " + debug_table_ii[x] + "  viii: " + debug_table_viii[x] + "  viid: " + debug_table_viid[x] + "  iii: " + debug_table_iii[x] + "  iiii: " + debug_table_iiii[x] + "  viiii: " + debug_table_viiii[x] + "  viiiii: " + debug_table_viiiii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  ");
 abort(x);
}

function nullFunc_vii(x) {
 err("Invalid function pointer '" + x + "' called with signature 'vii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("This pointer might make sense in another type signature: vi: " + debug_table_vi[x] + "  viid: " + debug_table_viid[x] + "  viii: " + debug_table_viii[x] + "  v: " + debug_table_v[x] + "  viiii: " + debug_table_viiii[x] + "  viiiii: " + debug_table_viiiii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  ii: " + debug_table_ii[x] + "  vidi: " + debug_table_vidi[x] + "  iii: " + debug_table_iii[x] + "  iiii: " + debug_table_iiii[x] + "  ");
 abort(x);
}

function nullFunc_viid(x) {
 err("Invalid function pointer '" + x + "' called with signature 'viid'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("This pointer might make sense in another type signature: vii: " + debug_table_vii[x] + "  vi: " + debug_table_vi[x] + "  v: " + debug_table_v[x] + "  ii: " + debug_table_ii[x] + "  viii: " + debug_table_viii[x] + "  vidi: " + debug_table_vidi[x] + "  iii: " + debug_table_iii[x] + "  iiii: " + debug_table_iiii[x] + "  viiii: " + debug_table_viiii[x] + "  viiiii: " + debug_table_viiiii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  ");
 abort(x);
}

function nullFunc_viii(x) {
 err("Invalid function pointer '" + x + "' called with signature 'viii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("This pointer might make sense in another type signature: vii: " + debug_table_vii[x] + "  vi: " + debug_table_vi[x] + "  viiii: " + debug_table_viiii[x] + "  v: " + debug_table_v[x] + "  viiiii: " + debug_table_viiiii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  iii: " + debug_table_iii[x] + "  ii: " + debug_table_ii[x] + "  iiii: " + debug_table_iiii[x] + "  vidi: " + debug_table_vidi[x] + "  viid: " + debug_table_viid[x] + "  ");
 abort(x);
}

function nullFunc_viiii(x) {
 err("Invalid function pointer '" + x + "' called with signature 'viiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("This pointer might make sense in another type signature: viii: " + debug_table_viii[x] + "  vii: " + debug_table_vii[x] + "  vi: " + debug_table_vi[x] + "  viiiii: " + debug_table_viiiii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  v: " + debug_table_v[x] + "  iiii: " + debug_table_iiii[x] + "  iii: " + debug_table_iii[x] + "  ii: " + debug_table_ii[x] + "  vidi: " + debug_table_vidi[x] + "  viid: " + debug_table_viid[x] + "  ");
 abort(x);
}

function nullFunc_viiiii(x) {
 err("Invalid function pointer '" + x + "' called with signature 'viiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("This pointer might make sense in another type signature: viii: " + debug_table_viii[x] + "  viiii: " + debug_table_viiii[x] + "  vii: " + debug_table_vii[x] + "  vi: " + debug_table_vi[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  v: " + debug_table_v[x] + "  iiii: " + debug_table_iiii[x] + "  iii: " + debug_table_iii[x] + "  ii: " + debug_table_ii[x] + "  vidi: " + debug_table_vidi[x] + "  viid: " + debug_table_viid[x] + "  ");
 abort(x);
}

function nullFunc_viiiiii(x) {
 err("Invalid function pointer '" + x + "' called with signature 'viiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("This pointer might make sense in another type signature: viii: " + debug_table_viii[x] + "  viiii: " + debug_table_viiii[x] + "  viiiii: " + debug_table_viiiii[x] + "  vii: " + debug_table_vii[x] + "  vi: " + debug_table_vi[x] + "  v: " + debug_table_v[x] + "  iiii: " + debug_table_iiii[x] + "  iii: " + debug_table_iii[x] + "  vidi: " + debug_table_vidi[x] + "  viid: " + debug_table_viid[x] + "  ii: " + debug_table_ii[x] + "  ");
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
 "j": nullFunc_vidi,
 "k": nullFunc_vii,
 "l": nullFunc_viid,
 "m": nullFunc_viii,
 "n": nullFunc_viiii,
 "o": nullFunc_viiiii,
 "p": nullFunc_viiiiii,
 "q": _Engine_FillPage,
 "r": _Engine_FilledEllipse,
 "s": _Engine_FilledRectangle,
 "t": _Engine_FilledText,
 "u": _Engine_GetMode,
 "v": _Engine_Init,
 "w": _Engine_MeasureTextWidth,
 "x": _Engine_RoundedRectangle,
 "y": _Engine_StrokeEllipse,
 "z": _SDL_GetTicks,
 "A": _SDL_Init,
 "B": _SDL_LockSurface,
 "C": _SDL_PollEvent,
 "D": _SDL_SetVideoMode,
 "E": __ZSt18uncaught_exceptionv,
 "F": ___cxa_allocate_exception,
 "G": ___cxa_begin_catch,
 "H": ___cxa_find_matching_catch,
 "I": ___cxa_free_exception,
 "J": ___cxa_throw,
 "K": ___gxx_personality_v0,
 "L": ___lock,
 "M": ___resumeException,
 "N": ___setErrNo,
 "O": ___syscall140,
 "P": ___syscall146,
 "Q": ___syscall54,
 "R": ___syscall6,
 "S": ___unlock,
 "T": _abort,
 "U": _emscripten_get_heap_size,
 "V": _emscripten_get_now,
 "W": _emscripten_memcpy_big,
 "X": _emscripten_resize_heap,
 "Y": _emscripten_set_main_loop,
 "Z": _emscripten_set_main_loop_timing,
 "_": _getCanvasHeight,
 "$": _getCanvasWidth,
 "aa": _pthread_getspecific,
 "ab": _pthread_key_create,
 "ac": _pthread_once,
 "ad": _pthread_setspecific,
 "ae": abortOnCannotGrowMemory,
 "af": flush_NO_FILESYSTEM,
 "ag": tempDoublePtr,
 "ah": DYNAMICTOP_PTR
};

// EMSCRIPTEN_START_ASM


var asm = (/** @suppress {uselessCode} */ function(global,env,buffer) {
"use asm";var a=new global.Int8Array(buffer),b=new global.Int16Array(buffer),c=new global.Int32Array(buffer),d=new global.Uint8Array(buffer),e=new global.Uint16Array(buffer),f=new global.Float32Array(buffer),g=new global.Float64Array(buffer),h=env.ag|0,i=env.ah|0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0.0,r=global.Math.abs,s=global.Math.sqrt,t=global.Math.ceil,u=global.Math.imul,v=global.Math.clz32,w=env.a,x=env.b,y=env.c,z=env.d,A=env.e,B=env.f,C=env.g,D=env.h,E=env.i,F=env.j,G=env.k,H=env.l,I=env.m,J=env.n,K=env.o,L=env.p,M=env.q,N=env.r,O=env.s,P=env.t,Q=env.u,R=env.v,S=env.w,T=env.x,U=env.y,V=env.z,W=env.A,X=env.B,Y=env.C,Z=env.D,_=env.E,$=env.F,aa=env.G,ba=env.H,ca=env.I,da=env.J,ea=env.K,fa=env.L,ga=env.M,ha=env.N,ia=env.O,ja=env.P,ka=env.Q,la=env.R,ma=env.S,na=env.T,oa=env.U,pa=env.V,qa=env.W,ra=env.X,sa=env.Y,ta=env.Z,ua=env._,va=env.$,wa=env.aa,xa=env.ab,ya=env.ac,za=env.ad,Aa=env.ae,Ba=env.af,Ca=16144,Da=5259024,Ea=0.0;
// EMSCRIPTEN_START_FUNCS
function Ra(a){a=a|0;var b=0;b=Ca;Ca=Ca+a|0;Ca=Ca+15&-16;if((Ca|0)>=(Da|0))z(a|0);return b|0}function Sa(){return Ca|0}function Ta(a){a=a|0;Ca=a}function Ua(a,b){a=a|0;b=b|0;Ca=a;Da=b}function Va(){return 6516}function Wa(){return 6614}function Xa(){var a=0,b=0;a=c[3808]|0;if(!a){b=$(4)|0;c[b>>2]=6340;da(b|0,3912,139)}else{Ja[c[(c[a>>2]|0)+24>>2]&255](a);return}}function Ya(){var a=0,b=0,d=0,e=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0;a=Ca;Ca=Ca+176|0;if((Ca|0)>=(Da|0))z(176);b=a+48|0;d=a+8|0;e=a+152|0;h=a+172|0;i=a+136|0;j=a+168|0;k=a+128|0;l=a+164|0;m=a+112|0;n=a+160|0;o=a+104|0;p=a+144|0;q=a+96|0;r=a+120|0;s=a+80|0;t=a+88|0;u=a;v=a+72|0;Xh(13180)|0;Za(d);w=fi(32)|0;_a(w);c[h>>2]=0;c[b>>2]=c[h>>2];$a(e,w,b);w=fi(32)|0;ab(w);c[j>>2]=0;c[b>>2]=c[j>>2];bb(i,w,b);w=fi(32)|0;cb(w);c[l>>2]=0;c[b>>2]=c[l>>2];db(k,w,b);w=fi(32)|0;eb(w);c[n>>2]=0;c[b>>2]=c[n>>2];fb(m,w,b);w=fi(32)|0;gb(w);c[p>>2]=0;c[b>>2]=c[p>>2];hb(o,w,b);w=fi(40)|0;ib(w);c[r>>2]=0;c[b>>2]=c[r>>2];jb(q,w,b);w=fi(32)|0;kb(w);c[t>>2]=0;c[b>>2]=c[t>>2];lb(s,w,b);w=c[e>>2]|0;t=e+4|0;r=c[t>>2]|0;p=(r|0)==0;if(p)x=d+32|0;else{n=r+4|0;c[n>>2]=(c[n>>2]|0)+1;c[n>>2]=(c[n>>2]|0)+1;x=d+32|0}c[x>>2]=w;w=d+36|0;x=c[w>>2]|0;c[w>>2]=r;if(x|0?(n=x+4|0,l=c[n>>2]|0,c[n>>2]=l+-1,(l|0)==0):0){Ja[c[(c[x>>2]|0)+8>>2]&255](x);ei(x)}x=c[d+32>>2]|0;l=d+24|0;n=l;j=c[n+4>>2]|0;h=x+24|0;c[h>>2]=c[n>>2];c[h+4>>2]=j;j=c[x+16>>2]|0;if(j|0){h=c[(c[j>>2]|0)+4>>2]|0;f[b>>2]=0.0;f[b+4>>2]=0.0;Oa[h&31](j,x+4|0,b,l)}if(!p?(p=r+4|0,l=c[p>>2]|0,c[p>>2]=l+-1,(l|0)==0):0){Ja[c[(c[r>>2]|0)+8>>2]&255](r);ei(r)}g[u>>3]=+pa();c[v>>2]=0;r=b+16|0;l=fi(44)|0;c[l>>2]=5792;c[l+4>>2]=u;c[l+8>>2]=v;c[l+12>>2]=d;c[l+16>>2]=e;c[l+20>>2]=i;c[l+24>>2]=k;c[l+28>>2]=m;c[l+32>>2]=o;c[l+36>>2]=q;c[l+40>>2]=s;c[r>>2]=l;_b(b,15216);l=c[r>>2]|0;if((b|0)!=(l|0)){if(l|0)Ja[c[(c[l>>2]|0)+20>>2]&255](l)}else Ja[c[(c[l>>2]|0)+16>>2]&255](l);sa(2,0,1);l=c[s+4>>2]|0;if(l|0?(s=l+4|0,b=c[s>>2]|0,c[s>>2]=b+-1,(b|0)==0):0){Ja[c[(c[l>>2]|0)+8>>2]&255](l);ei(l)}l=c[q+4>>2]|0;if(l|0?(q=l+4|0,b=c[q>>2]|0,c[q>>2]=b+-1,(b|0)==0):0){Ja[c[(c[l>>2]|0)+8>>2]&255](l);ei(l)}l=c[o+4>>2]|0;if(l|0?(o=l+4|0,b=c[o>>2]|0,c[o>>2]=b+-1,(b|0)==0):0){Ja[c[(c[l>>2]|0)+8>>2]&255](l);ei(l)}l=c[m+4>>2]|0;if(l|0?(m=l+4|0,b=c[m>>2]|0,c[m>>2]=b+-1,(b|0)==0):0){Ja[c[(c[l>>2]|0)+8>>2]&255](l);ei(l)}l=c[k+4>>2]|0;if(l|0?(k=l+4|0,b=c[k>>2]|0,c[k>>2]=b+-1,(b|0)==0):0){Ja[c[(c[l>>2]|0)+8>>2]&255](l);ei(l)}l=c[i+4>>2]|0;if(l|0?(i=l+4|0,b=c[i>>2]|0,c[i>>2]=b+-1,(b|0)==0):0){Ja[c[(c[l>>2]|0)+8>>2]&255](l);ei(l)}l=c[t>>2]|0;if(l|0?(t=l+4|0,b=c[t>>2]|0,c[t>>2]=b+-1,(b|0)==0):0){Ja[c[(c[l>>2]|0)+8>>2]&255](l);ei(l)}l=c[w>>2]|0;if(l|0?(w=l+4|0,b=c[w>>2]|0,c[w>>2]=b+-1,(b|0)==0):0){Ja[c[(c[l>>2]|0)+8>>2]&255](l);ei(l)}l=c[d>>2]|0;if(!l){Ca=a;return 1}gi(l);Ca=a;return 1}function Za(a){a=a|0;var b=0,d=0,e=0;c[a>>2]=0;b=a+4|0;c[b>>2]=0;d=a+8|0;c[d>>2]=0;e=fi(512)|0;c[a>>2]=e;c[d>>2]=128;c[b>>2]=4096;sj(e|0,0,512)|0;c[a+12>>2]=0;g[a+16>>3]=+pa();e=a+24|0;c[e>>2]=0;c[e+4>>2]=0;c[e+8>>2]=0;c[e+12>>2]=0;R();W(32)|0;Z(50,50,32,0)|0;return}function _a(b){b=b|0;var d=0,e=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,A=0,B=0,C=0,D=0,E=0,F=0.0,G=0.0,H=0.0,I=0,J=0,K=0,L=0.0,M=0.0,N=0;d=Ca;Ca=Ca+144|0;if((Ca|0)>=(Da|0))z(144);e=d+96|0;h=d+48|0;i=d;j=b+4|0;c[j>>2]=0;c[j+4>>2]=0;c[j+8>>2]=0;c[j+12>>2]=0;c[j+16>>2]=0;c[j+20>>2]=0;c[j+24>>2]=0;c[b>>2]=4112;Xh(13187)|0;j=b+4|0;k=h+8|0;l=k+36|0;do{c[k>>2]=0;k=k+4|0}while((k|0)<(l|0));c[h+44>>2]=2;c[h>>2]=1112014848;c[h+4>>2]=1112014848;f[h+16>>2]=30.0;f[h+20>>2]=30.0;c[h+32>>2]=-7820545;m=b+8|0;n=c[m>>2]|0;o=b+12|0;if(n>>>0<(c[o>>2]|0)>>>0){k=n;p=h;l=k+48|0;do{c[k>>2]=c[p>>2];k=k+4|0;p=p+4|0}while((k|0)<(l|0));n=(c[m>>2]|0)+48|0;c[m>>2]=n;q=n}else{qb(j,h);q=c[m>>2]|0}k=h+8|0;l=k+36|0;do{c[k>>2]=0;k=k+4|0}while((k|0)<(l|0));c[h+44>>2]=4;c[h>>2]=1125515264;c[h+4>>2]=1112014848;c[h+16>>2]=1109393408;c[h+20>>2]=1117782016;c[h+32>>2]=-1148649473;if(q>>>0<(c[o>>2]|0)>>>0){k=q;p=h;l=k+48|0;do{c[k>>2]=c[p>>2];k=k+4|0;p=p+4|0}while((k|0)<(l|0));c[m>>2]=(c[m>>2]|0)+48}else qb(j,h);q=i+11|0;n=i+6|0;b=h+8|0;r=h+44|0;s=h+4|0;t=h+24|0;u=h+32|0;v=h+36|0;w=h+16|0;x=h+20|0;y=h+16|0;A=i+8|0;B=i+44|0;C=i+16|0;D=i+32|0;E=1;do{c[i>>2]=0;c[i+4>>2]=0;c[i+8>>2]=0;a[q>>0]=6;a[i>>0]=a[6781]|0;a[i+1>>0]=a[6782]|0;a[i+2>>0]=a[6783]|0;a[i+3>>0]=a[6784]|0;a[i+4>>0]=a[6785]|0;a[i+5>>0]=a[6786]|0;a[n>>0]=0;F=+(E|0);G=F*50.0+120.0;H=F*10.0;k=b;l=k+36|0;do{c[k>>2]=0;k=k+4|0}while((k|0)<(l|0));c[r>>2]=6;c[h>>2]=1112014848;f[s>>2]=G;f[t>>2]=H;c[u>>2]=-1;if(!(sb(15252,i)|0)){I=c[3811]|0;J=(I-(c[3810]|0)|0)/12|0;K=I;if((c[3812]|0)==(K|0))tb(15240,i);else{mi(K,i);c[3811]=(c[3811]|0)+12}c[(rb(15252,i)|0)>>2]=J}c[v>>2]=c[(rb(15252,i)|0)>>2];F=+S(((a[q>>0]|0)<0?c[i>>2]|0:i)|0,+H);f[w>>2]=F;f[x>>2]=H;if((a[q>>0]|0)<0){gi(c[i>>2]|0);L=+f[y>>2];M=+f[x>>2]}else{L=F;M=H}g[e>>3]=L;g[e+8>>3]=M;Vh(6788,e)|0;k=A;l=k+36|0;do{c[k>>2]=0;k=k+4|0}while((k|0)<(l|0));c[B>>2]=4;J=h;K=c[J+4>>2]|0;I=i;c[I>>2]=c[J>>2];c[I+4>>2]=K;K=y;I=c[K+4>>2]|0;J=C;c[J>>2]=c[K>>2];c[J+4>>2]=I;c[D>>2]=-1148649473;I=c[m>>2]|0;if(I>>>0<(c[o>>2]|0)>>>0){k=I;p=i;l=k+48|0;do{c[k>>2]=c[p>>2];k=k+4|0;p=p+4|0}while((k|0)<(l|0));I=(c[m>>2]|0)+48|0;c[m>>2]=I;N=I}else{qb(j,i);N=c[m>>2]|0}if((N|0)==(c[o>>2]|0))wb(j,h);else{k=N;p=h;l=k+48|0;do{c[k>>2]=c[p>>2];k=k+4|0;p=p+4|0}while((k|0)<(l|0));c[m>>2]=(c[m>>2]|0)+48}E=E+1|0}while(E>>>0<6);k=e+8|0;l=k+36|0;do{c[k>>2]=0;k=k+4|0}while((k|0)<(l|0));c[e+44>>2]=5;c[e>>2]=1132068864;c[e+4>>2]=1112014848;c[e+16>>2]=1120403456;c[e+20>>2]=1128792064;f[e+24>>2]=15.0;f[e+28>>2]=5.0;c[e+32>>2]=-1;c[e+36>>2]=1442823167;E=c[m>>2]|0;if(E>>>0<(c[o>>2]|0)>>>0){k=E;p=e;l=k+48|0;do{c[k>>2]=c[p>>2];k=k+4|0;p=p+4|0}while((k|0)<(l|0));c[m>>2]=(c[m>>2]|0)+48;Ca=d;return}else{qb(j,e);Ca=d;return}}function $a(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0;d=Ca;Ca=Ca+16|0;if((Ca|0)>=(Da|0))z(16);e=d;c[a>>2]=b;f=fi(16)|0;c[f+4>>2]=0;c[f+8>>2]=0;c[f>>2]=5596;c[f+12>>2]=b;c[a+4>>2]=f;c[e>>2]=b;c[e+4>>2]=b;ig(a,e);Ca=d;return}function ab(b){b=b|0;var d=0,e=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0;d=Ca;Ca=Ca+336|0;if((Ca|0)>=(Da|0))z(336);e=d+216|0;g=d+208|0;h=d+160|0;i=d+152|0;j=d+144|0;k=d+136|0;l=d+128|0;m=d+120|0;n=d+72|0;o=d+272|0;p=d+328|0;q=d+320|0;r=d+264|0;s=d+256|0;t=d+248|0;u=d+240|0;v=d+48|0;w=d+24|0;x=d;y=d+232|0;A=d+224|0;B=b+4|0;c[B>>2]=0;c[B+4>>2]=0;c[B+8>>2]=0;c[B+12>>2]=0;c[B+16>>2]=0;c[B+20>>2]=0;c[B+24>>2]=0;c[b>>2]=4152;Xh(13215)|0;B=b+4|0;C=o+8|0;D=C+36|0;do{c[C>>2]=0;C=C+4|0}while((C|0)<(D|0));c[o+44>>2]=2;c[o>>2]=1112014848;c[o+4>>2]=1112014848;f[o+16>>2]=30.0;f[o+20>>2]=30.0;c[o+32>>2]=-1711302145;E=b+8|0;F=c[E>>2]|0;G=b+12|0;if(F>>>0<(c[G>>2]|0)>>>0){C=F;H=o;D=C+48|0;do{c[C>>2]=c[H>>2];C=C+4|0;H=H+4|0}while((C|0)<(D|0));c[E>>2]=(c[E>>2]|0)+48}else qb(B,o);Xh(13242)|0;F=fi(192)|0;xb(F,B);c[o>>2]=F;I=fi(16)|0;c[I+4>>2]=0;c[I+8>>2]=0;c[I>>2]=4192;c[I+12>>2]=F;J=o+4|0;c[J>>2]=I;c[n>>2]=F;c[n+4>>2]=F;Gb(o,n);F=b+16|0;I=c[o>>2]|0;K=c[J>>2]|0;c[o>>2]=0;c[J>>2]=0;c[F>>2]=I;I=b+20|0;L=c[I>>2]|0;c[I>>2]=K;if(L|0?(K=L+4|0,I=c[K>>2]|0,c[K>>2]=I+-1,(I|0)==0):0){Ja[c[(c[L>>2]|0)+8>>2]&255](L);ei(L)}L=c[J>>2]|0;if(L|0?(J=L+4|0,I=c[J>>2]|0,c[J>>2]=I+-1,(I|0)==0):0){Ja[c[(c[L>>2]|0)+8>>2]&255](L);ei(L)}L=c[(c[F>>2]|0)+4>>2]|0;I=c[B>>2]|0;c[I+(L*48|0)+8>>2]=1065353216;c[I+(L*48|0)+12>>2]=1065353216;L=fi(192)|0;xb(L,B);c[L>>2]=4220;C=n+8|0;D=C+36|0;do{c[C>>2]=0;C=C+4|0}while((C|0)<(D|0));c[n+44>>2]=4;c[n>>2]=0;c[n+4>>2]=0;c[n+16>>2]=0;c[n+20>>2]=0;c[n+32>>2]=-1;I=c[E>>2]|0;J=c[B>>2]|0;c[J+((c[L+4>>2]|0)*48|0)+36>>2]=(I-J|0)/48|0;if((c[G>>2]|0)==(I|0))wb(B,n);else{C=I;H=n;D=C+48|0;do{c[C>>2]=c[H>>2];C=C+4|0;H=H+4|0}while((C|0)<(D|0));c[E>>2]=(c[E>>2]|0)+48}c[o>>2]=L;I=fi(16)|0;c[I+4>>2]=0;c[I+8>>2]=0;c[I>>2]=4240;c[I+12>>2]=L;J=o+4|0;c[J>>2]=I;c[m>>2]=L;c[m+4>>2]=L;Gb(o,m);Xh(13246)|0;L=(c[o>>2]|0)+4|0;I=c[L>>2]|0;K=c[B>>2]|0;c[K+(I*48|0)+8>>2]=1056964608;c[K+(I*48|0)+12>>2]=1056964608;I=c[L>>2]|0;L=c[B>>2]|0;c[L+(I*48|0)>>2]=1056964608;c[L+(I*48|0)+4>>2]=1056964608;I=c[o>>2]|0;c[I+8>>2]=1056964608;c[I+12>>2]=1056964608;L=c[F>>2]|0;K=c[c[L>>2]>>2]|0;c[p>>2]=I;I=p+4|0;M=c[J>>2]|0;c[I>>2]=M;if(M|0){N=M+4|0;c[N>>2]=(c[N>>2]|0)+1}Na[K&3](L,B,p);p=c[I>>2]|0;if(p|0?(I=p+4|0,L=c[I>>2]|0,c[I>>2]=L+-1,(L|0)==0):0){Ja[c[(c[p>>2]|0)+8>>2]&255](p);ei(p)}Xh(13244)|0;p=fi(192)|0;c[n>>2]=0;c[n+4>>2]=0;c[n+8>>2]=0;L=fi(16)|0;c[n>>2]=L;c[n+8>>2]=-2147483632;c[n+4>>2]=12;C=L;H=6844;D=C+12|0;do{a[C>>0]=a[H>>0]|0;C=C+1|0;H=H+1|0}while((C|0)<(D|0));a[L+12>>0]=0;yb(p,B,n,65535,20.0);c[m>>2]=p;L=fi(16)|0;c[L+4>>2]=0;c[L+8>>2]=0;c[L>>2]=4288;c[L+12>>2]=p;I=m+4|0;c[I>>2]=L;c[l>>2]=p;c[l+4>>2]=p;Gb(m,l);if((a[n+11>>0]|0)<0)gi(c[n>>2]|0);p=c[m>>2]|0;c[p+52>>2]=2;m=c[o>>2]|0;L=c[c[m>>2]>>2]|0;c[q>>2]=p;p=q+4|0;K=c[I>>2]|0;c[p>>2]=K;if(K|0){N=K+4|0;c[N>>2]=(c[N>>2]|0)+1}Na[L&3](m,B,q);q=c[p>>2]|0;if(q|0?(p=q+4|0,m=c[p>>2]|0,c[p>>2]=m+-1,(m|0)==0):0){Ja[c[(c[q>>2]|0)+8>>2]&255](q);ei(q)}q=fi(192)|0;c[n>>2]=0;c[n+4>>2]=0;c[n+8>>2]=0;m=fi(16)|0;c[n>>2]=m;c[n+8>>2]=-2147483632;c[n+4>>2]=12;C=m;H=6844;D=C+12|0;do{a[C>>0]=a[H>>0]|0;C=C+1|0;H=H+1|0}while((C|0)<(D|0));a[m+12>>0]=0;yb(q,B,n,65535,20.0);c[l>>2]=q;m=fi(16)|0;c[m+4>>2]=0;c[m+8>>2]=0;c[m>>2]=4288;c[m+12>>2]=q;p=l+4|0;c[p>>2]=m;c[k>>2]=q;c[k+4>>2]=q;Gb(l,k);if((a[n+11>>0]|0)<0)gi(c[n>>2]|0);q=c[l>>2]|0;c[q+52>>2]=2;m=c[q+4>>2]|0;q=c[B>>2]|0;c[q+(m*48|0)>>2]=1065353216;c[q+(m*48|0)+4>>2]=0;m=c[l>>2]|0;c[m+8>>2]=1065353216;c[m+12>>2]=0;l=c[o>>2]|0;q=c[c[l>>2]>>2]|0;c[r>>2]=m;m=r+4|0;L=c[p>>2]|0;c[m>>2]=L;if(L|0){N=L+4|0;c[N>>2]=(c[N>>2]|0)+1}Na[q&3](l,B,r);r=c[m>>2]|0;if(r|0?(m=r+4|0,l=c[m>>2]|0,c[m>>2]=l+-1,(l|0)==0):0){Ja[c[(c[r>>2]|0)+8>>2]&255](r);ei(r)}r=fi(192)|0;c[n>>2]=0;c[n+4>>2]=0;c[n+8>>2]=0;l=fi(16)|0;c[n>>2]=l;c[n+8>>2]=-2147483632;c[n+4>>2]=12;C=l;H=6844;D=C+12|0;do{a[C>>0]=a[H>>0]|0;C=C+1|0;H=H+1|0}while((C|0)<(D|0));a[l+12>>0]=0;yb(r,B,n,65535,20.0);c[k>>2]=r;l=fi(16)|0;c[l+4>>2]=0;c[l+8>>2]=0;c[l>>2]=4288;c[l+12>>2]=r;m=k+4|0;c[m>>2]=l;c[j>>2]=r;c[j+4>>2]=r;Gb(k,j);if((a[n+11>>0]|0)<0)gi(c[n>>2]|0);r=c[k>>2]|0;c[r+52>>2]=2;l=c[r+4>>2]|0;r=c[B>>2]|0;c[r+(l*48|0)>>2]=0;c[r+(l*48|0)+4>>2]=1065353216;l=c[k>>2]|0;c[l+8>>2]=0;c[l+12>>2]=1065353216;k=c[o>>2]|0;r=c[c[k>>2]>>2]|0;c[s>>2]=l;l=s+4|0;q=c[m>>2]|0;c[l>>2]=q;if(q|0){N=q+4|0;c[N>>2]=(c[N>>2]|0)+1}Na[r&3](k,B,s);s=c[l>>2]|0;if(s|0?(l=s+4|0,k=c[l>>2]|0,c[l>>2]=k+-1,(k|0)==0):0){Ja[c[(c[s>>2]|0)+8>>2]&255](s);ei(s)}s=fi(192)|0;c[n>>2]=0;c[n+4>>2]=0;c[n+8>>2]=0;k=fi(16)|0;c[n>>2]=k;c[n+8>>2]=-2147483632;c[n+4>>2]=12;C=k;H=6844;D=C+12|0;do{a[C>>0]=a[H>>0]|0;C=C+1|0;H=H+1|0}while((C|0)<(D|0));a[k+12>>0]=0;yb(s,B,n,65535,20.0);c[j>>2]=s;k=fi(16)|0;c[k+4>>2]=0;c[k+8>>2]=0;c[k>>2]=4288;c[k+12>>2]=s;l=j+4|0;c[l>>2]=k;c[i>>2]=s;c[i+4>>2]=s;Gb(j,i);if((a[n+11>>0]|0)<0)gi(c[n>>2]|0);s=c[j>>2]|0;c[s+52>>2]=2;k=c[s+4>>2]|0;s=c[B>>2]|0;c[s+(k*48|0)>>2]=1065353216;c[s+(k*48|0)+4>>2]=1065353216;k=c[j>>2]|0;c[k+8>>2]=1065353216;c[k+12>>2]=1065353216;j=c[o>>2]|0;s=c[c[j>>2]>>2]|0;c[t>>2]=k;k=t+4|0;r=c[l>>2]|0;c[k>>2]=r;if(r|0){N=r+4|0;c[N>>2]=(c[N>>2]|0)+1}Na[s&3](j,B,t);t=c[k>>2]|0;if(t|0?(k=t+4|0,j=c[k>>2]|0,c[k>>2]=j+-1,(j|0)==0):0){Ja[c[(c[t>>2]|0)+8>>2]&255](t);ei(t)}t=fi(192)|0;c[n>>2]=0;c[n+4>>2]=0;c[n+8>>2]=0;j=fi(16)|0;c[n>>2]=j;c[n+8>>2]=-2147483632;c[n+4>>2]=12;C=j;H=6844;D=C+12|0;do{a[C>>0]=a[H>>0]|0;C=C+1|0;H=H+1|0}while((C|0)<(D|0));a[j+12>>0]=0;yb(t,B,n,65535,20.0);c[i>>2]=t;j=fi(16)|0;c[j+4>>2]=0;c[j+8>>2]=0;c[j>>2]=4288;c[j+12>>2]=t;k=i+4|0;c[k>>2]=j;c[h>>2]=t;c[h+4>>2]=t;Gb(i,h);if((a[n+11>>0]|0)<0)gi(c[n>>2]|0);t=c[i>>2]|0;c[t+52>>2]=2;j=c[t+4>>2]|0;t=c[B>>2]|0;c[t+(j*48|0)>>2]=1056964608;c[t+(j*48|0)+4>>2]=1056964608;j=c[i>>2]|0;c[j+8>>2]=1056964608;c[j+12>>2]=1056964608;i=c[o>>2]|0;o=c[c[i>>2]>>2]|0;c[u>>2]=j;j=u+4|0;t=c[k>>2]|0;c[j>>2]=t;if(t|0){s=t+4|0;c[s>>2]=(c[s>>2]|0)+1}Na[o&3](i,B,u);u=c[j>>2]|0;do if(u|0){j=u+4|0;i=c[j>>2]|0;c[j>>2]=i+-1;if(i|0)break;Ja[c[(c[u>>2]|0)+8>>2]&255](u);ei(u)}while(0);u=fi(192)|0;xb(u,B);c[u>>2]=4220;C=h+8|0;D=C+36|0;do{c[C>>2]=0;C=C+4|0}while((C|0)<(D|0));c[h+44>>2]=4;c[h>>2]=0;c[h+4>>2]=0;c[h+16>>2]=0;c[h+20>>2]=0;c[h+32>>2]=-1;i=c[E>>2]|0;j=c[B>>2]|0;c[j+((c[u+4>>2]|0)*48|0)+36>>2]=(i-j|0)/48|0;if((c[G>>2]|0)==(i|0))wb(B,h);else{C=i;H=h;D=C+48|0;do{c[C>>2]=c[H>>2];C=C+4|0;H=H+4|0}while((C|0)<(D|0));c[E>>2]=(c[E>>2]|0)+48}c[n>>2]=u;E=fi(16)|0;c[E+4>>2]=0;c[E+8>>2]=0;c[E>>2]=4240;c[E+12>>2]=u;H=n+4|0;c[H>>2]=E;c[g>>2]=u;c[g+4>>2]=u;Gb(n,g);Xh(13246)|0;u=(c[n>>2]|0)+4|0;E=c[u>>2]|0;C=c[B>>2]|0;c[C+(E*48|0)+24>>2]=1092616192;c[C+(E*48|0)+28>>2]=1092616192;E=c[u>>2]|0;u=c[B>>2]|0;c[u+(E*48|0)>>2]=1065353216;c[u+(E*48|0)+4>>2]=0;E=c[n>>2]|0;u=c[E+4>>2]|0;C=c[B>>2]|0;c[C+(u*48|0)+16>>2]=-1054867456;c[C+(u*48|0)+20>>2]=1092616192;c[E+8>>2]=1065353216;c[E+12>>2]=0;u=v+16|0;c[u>>2]=0;C=w+16|0;c[C>>2]=0;D=c[H>>2]|0;if(D|0){i=D+4|0;c[i>>2]=(c[i>>2]|0)+1}i=x+16|0;c[x>>2]=4316;c[x+4>>2]=b;c[x+8>>2]=E;c[x+12>>2]=D;c[i>>2]=x;zb(E,v,w,x);E=c[i>>2]|0;do if((x|0)==(E|0))Ja[c[(c[E>>2]|0)+16>>2]&255](E);else{if(!E)break;Ja[c[(c[E>>2]|0)+20>>2]&255](E)}while(0);E=c[C>>2]|0;do if((w|0)==(E|0))Ja[c[(c[E>>2]|0)+16>>2]&255](E);else{if(!E)break;Ja[c[(c[E>>2]|0)+20>>2]&255](E)}while(0);E=c[u>>2]|0;do if((v|0)==(E|0))Ja[c[(c[E>>2]|0)+16>>2]&255](E);else{if(!E)break;Ja[c[(c[E>>2]|0)+20>>2]&255](E)}while(0);E=c[F>>2]|0;F=c[c[E>>2]>>2]|0;c[y>>2]=c[n>>2];v=y+4|0;u=c[H>>2]|0;c[v>>2]=u;if(u|0){w=u+4|0;c[w>>2]=(c[w>>2]|0)+1}Na[F&3](E,B,y);y=c[v>>2]|0;do if(y|0){v=y+4|0;E=c[v>>2]|0;c[v>>2]=E+-1;if(E|0)break;Ja[c[(c[y>>2]|0)+8>>2]&255](y);ei(y)}while(0);y=fi(192)|0;c[h>>2]=0;c[h+4>>2]=0;c[h+8>>2]=0;E=h+11|0;a[E>>0]=1;a[h>>0]=120;a[h+1>>0]=0;yb(y,B,h,65535,10.0);c[g>>2]=y;v=fi(16)|0;c[v+4>>2]=0;c[v+8>>2]=0;c[v>>2]=4288;c[v+12>>2]=y;F=g+4|0;c[F>>2]=v;c[e>>2]=y;c[e+4>>2]=y;Gb(g,e);if((a[E>>0]|0)<0)gi(c[h>>2]|0);h=c[g>>2]|0;g=c[h+4>>2]|0;E=c[B>>2]|0;c[E+(g*48|0)+16>>2]=1056964608;c[E+(g*48|0)+20>>2]=1056964608;g=c[n>>2]|0;n=c[c[g>>2]>>2]|0;c[A>>2]=h;h=A+4|0;E=c[F>>2]|0;c[h>>2]=E;if(E|0){e=E+4|0;c[e>>2]=(c[e>>2]|0)+1}Na[n&3](g,B,A);A=c[h>>2]|0;do if(A|0){h=A+4|0;B=c[h>>2]|0;c[h>>2]=B+-1;if(B|0)break;Ja[c[(c[A>>2]|0)+8>>2]&255](A);ei(A)}while(0);A=c[F>>2]|0;do if(A|0){F=A+4|0;B=c[F>>2]|0;c[F>>2]=B+-1;if(B|0)break;Ja[c[(c[A>>2]|0)+8>>2]&255](A);ei(A)}while(0);A=c[H>>2]|0;do if(A|0){H=A+4|0;B=c[H>>2]|0;c[H>>2]=B+-1;if(B|0)break;Ja[c[(c[A>>2]|0)+8>>2]&255](A);ei(A)}while(0);A=c[k>>2]|0;do if(A|0){k=A+4|0;B=c[k>>2]|0;c[k>>2]=B+-1;if(B|0)break;Ja[c[(c[A>>2]|0)+8>>2]&255](A);ei(A)}while(0);A=c[l>>2]|0;do if(A|0){l=A+4|0;B=c[l>>2]|0;c[l>>2]=B+-1;if(B|0)break;Ja[c[(c[A>>2]|0)+8>>2]&255](A);ei(A)}while(0);A=c[m>>2]|0;do if(A|0){m=A+4|0;B=c[m>>2]|0;c[m>>2]=B+-1;if(B|0)break;Ja[c[(c[A>>2]|0)+8>>2]&255](A);ei(A)}while(0);A=c[p>>2]|0;do if(A|0){p=A+4|0;B=c[p>>2]|0;c[p>>2]=B+-1;if(B|0)break;Ja[c[(c[A>>2]|0)+8>>2]&255](A);ei(A)}while(0);A=c[I>>2]|0;do if(A|0){I=A+4|0;B=c[I>>2]|0;c[I>>2]=B+-1;if(B|0)break;Ja[c[(c[A>>2]|0)+8>>2]&255](A);ei(A)}while(0);A=c[J>>2]|0;if(!A){Ca=d;return}J=A+4|0;B=c[J>>2]|0;c[J>>2]=B+-1;if(B|0){Ca=d;return}Ja[c[(c[A>>2]|0)+8>>2]&255](A);ei(A);Ca=d;return}function bb(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0;d=Ca;Ca=Ca+16|0;if((Ca|0)>=(Da|0))z(16);e=d;c[a>>2]=b;f=fi(16)|0;c[f+4>>2]=0;c[f+8>>2]=0;c[f>>2]=5624;c[f+12>>2]=b;c[a+4>>2]=f;c[e>>2]=b;c[e+4>>2]=b;ig(a,e);Ca=d;return}function cb(a){a=a|0;var b=0,d=0,e=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0;b=Ca;Ca=Ca+128|0;if((Ca|0)>=(Da|0))z(128);d=b+72|0;e=b+48|0;g=b+56|0;h=b+64|0;i=b+24|0;j=b;k=a+4|0;c[k>>2]=0;c[k+4>>2]=0;c[k+8>>2]=0;c[k+12>>2]=0;c[k+16>>2]=0;c[k+20>>2]=0;c[k+24>>2]=0;c[a>>2]=4360;Xh(13248)|0;k=a+4|0;l=d+8|0;m=l+36|0;do{c[l>>2]=0;l=l+4|0}while((l|0)<(m|0));c[d+44>>2]=2;c[d>>2]=1112014848;c[d+4>>2]=1112014848;f[d+16>>2]=30.0;f[d+20>>2]=30.0;c[d+32>>2]=1722482687;n=a+8|0;o=c[n>>2]|0;if(o>>>0<(c[a+12>>2]|0)>>>0){l=o;o=d;m=l+48|0;do{c[l>>2]=c[o>>2];l=l+4|0;o=o+4|0}while((l|0)<(m|0));c[n>>2]=(c[n>>2]|0)+48}else qb(k,d);n=fi(224)|0;c[h>>2]=20;c[h+4>>2]=30;o=i+16|0;c[i>>2]=4380;c[o>>2]=i;l=j+16|0;c[j>>2]=4424;c[l>>2]=j;c[d>>2]=c[h>>2];c[d+4>>2]=c[h+4>>2];kc(n,k,d,i,j);c[g>>2]=n;h=fi(16)|0;c[h+4>>2]=0;c[h+8>>2]=0;c[h>>2]=4488;c[h+12>>2]=n;m=g+4|0;c[m>>2]=h;c[e>>2]=n;c[e+4>>2]=n;Dc(g,e);n=c[l>>2]|0;if((j|0)!=(n|0)){if(n|0)Ja[c[(c[n>>2]|0)+20>>2]&255](n)}else Ja[c[(c[n>>2]|0)+16>>2]&255](n);n=c[o>>2]|0;if((i|0)!=(n|0)){if(n|0)Ja[c[(c[n>>2]|0)+20>>2]&255](n)}else Ja[c[(c[n>>2]|0)+16>>2]&255](n);n=c[g>>2]|0;c[n+52>>2]=1;i=n+4|0;n=c[i>>2]|0;o=c[k>>2]|0;c[o+(n*48|0)+8>>2]=1065353216;c[o+(n*48|0)+12>>2]=1065353216;n=c[i>>2]|0;o=c[k>>2]|0;c[o+(n*48|0)+24>>2]=-1054867456;c[o+(n*48|0)+28>>2]=-1054867456;n=c[i>>2]|0;i=c[k>>2]|0;c[i+(n*48|0)>>2]=1056964608;c[i+(n*48|0)+4>>2]=1056964608;n=c[g>>2]|0;c[n+8>>2]=1056964608;c[n+12>>2]=1056964608;i=c[k>>2]|0;o=(c[i+((c[n+4>>2]|0)*48|0)+32>>2]|0)+1|0;c[i+(o*48|0)+40>>2]=1;c[d>>2]=o;c[e>>2]=1;o=c[n+216>>2]|0;if(!o){n=$(4)|0;c[n>>2]=6340;da(n|0,3912,139)}Oa[c[(c[o>>2]|0)+24>>2]&31](o,k,d,e);e=c[g>>2]|0;g=c[m>>2]|0;if(g|0){d=g+4|0;c[d>>2]=(c[d>>2]|0)+1}c[a+16>>2]=e;e=a+20|0;a=c[e>>2]|0;c[e>>2]=g;if(a|0?(g=a+4|0,e=c[g>>2]|0,c[g>>2]=e+-1,(e|0)==0):0){Ja[c[(c[a>>2]|0)+8>>2]&255](a);ei(a)}a=c[m>>2]|0;if(!a){Ca=b;return}m=a+4|0;e=c[m>>2]|0;c[m>>2]=e+-1;if(e|0){Ca=b;return}Ja[c[(c[a>>2]|0)+8>>2]&255](a);ei(a);Ca=b;return}function db(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0;d=Ca;Ca=Ca+16|0;if((Ca|0)>=(Da|0))z(16);e=d;c[a>>2]=b;f=fi(16)|0;c[f+4>>2]=0;c[f+8>>2]=0;c[f>>2]=5652;c[f+12>>2]=b;c[a+4>>2]=f;c[e>>2]=b;c[e+4>>2]=b;ig(a,e);Ca=d;return}function eb(b){b=b|0;var d=0,e=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0;d=Ca;Ca=Ca+432|0;if((Ca|0)>=(Da|0))z(432);e=d+312|0;g=d+264|0;h=d+216|0;i=d+168|0;j=d+120|0;k=d+72|0;l=d+336|0;m=d+48|0;n=d+24|0;o=d;p=d+416|0;q=d+408|0;r=d+400|0;s=d+392|0;t=d+384|0;u=b+4|0;c[u>>2]=0;c[u+4>>2]=0;c[u+8>>2]=0;c[u+12>>2]=0;c[u+16>>2]=0;c[u+20>>2]=0;c[u+24>>2]=0;c[b>>2]=4516;Xh(13276)|0;u=b+4|0;v=l+8|0;w=v+36|0;do{c[v>>2]=0;v=v+4|0}while((v|0)<(w|0));c[l+44>>2]=2;c[l>>2]=1112014848;c[l+4>>2]=1112014848;f[l+16>>2]=30.0;f[l+20>>2]=30.0;c[l+32>>2]=-16711681;x=b+8|0;y=c[x>>2]|0;A=b+12|0;if(y>>>0<(c[A>>2]|0)>>>0){v=y;B=l;w=v+48|0;do{c[v>>2]=c[B>>2];v=v+4|0;B=B+4|0}while((v|0)<(w|0));c[x>>2]=(c[x>>2]|0)+48}else qb(u,l);y=fi(192)|0;xb(y,u);c[l>>2]=y;C=fi(16)|0;c[C+4>>2]=0;c[C+8>>2]=0;c[C>>2]=4192;c[C+12>>2]=y;D=l+4|0;c[D>>2]=C;c[k>>2]=y;c[k+4>>2]=y;Gb(l,k);y=b+16|0;C=c[l>>2]|0;E=c[D>>2]|0;c[l>>2]=0;c[D>>2]=0;c[y>>2]=C;C=b+20|0;b=c[C>>2]|0;c[C>>2]=E;if(b|0?(E=b+4|0,C=c[E>>2]|0,c[E>>2]=C+-1,(C|0)==0):0){Ja[c[(c[b>>2]|0)+8>>2]&255](b);ei(b)}b=c[D>>2]|0;if(b|0?(D=b+4|0,C=c[D>>2]|0,c[D>>2]=C+-1,(C|0)==0):0){Ja[c[(c[b>>2]|0)+8>>2]&255](b);ei(b)}b=c[(c[y>>2]|0)+4>>2]|0;C=c[u>>2]|0;c[C+(b*48|0)+8>>2]=1065353216;c[C+(b*48|0)+12>>2]=1065353216;b=fi(192)|0;xb(b,u);c[b>>2]=4220;v=k+8|0;w=v+36|0;do{c[v>>2]=0;v=v+4|0}while((v|0)<(w|0));c[k+44>>2]=4;c[k>>2]=0;c[k+4>>2]=0;c[k+16>>2]=0;c[k+20>>2]=0;c[k+32>>2]=-1;C=c[x>>2]|0;D=c[u>>2]|0;c[D+((c[b+4>>2]|0)*48|0)+36>>2]=(C-D|0)/48|0;if((c[A>>2]|0)==(C|0))wb(u,k);else{v=C;B=k;w=v+48|0;do{c[v>>2]=c[B>>2];v=v+4|0;B=B+4|0}while((v|0)<(w|0));c[x>>2]=(c[x>>2]|0)+48}c[l>>2]=b;C=fi(16)|0;c[C+4>>2]=0;c[C+8>>2]=0;c[C>>2]=4240;c[C+12>>2]=b;D=l+4|0;c[D>>2]=C;c[j>>2]=b;c[j+4>>2]=b;Gb(l,j);b=c[(c[l>>2]|0)+4>>2]|0;C=c[u>>2]|0;c[C+(b*48|0)>>2]=1062836634;c[C+(b*48|0)+4>>2]=1062836634;b=c[l>>2]|0;c[b+8>>2]=1056964608;c[b+12>>2]=1056964608;C=c[b+4>>2]|0;E=c[u>>2]|0;c[E+(C*48|0)+24>>2]=1117782016;c[E+(C*48|0)+28>>2]=1117782016;C=j+16|0;c[C>>2]=0;Ic(j,b+64|0);E=c[C>>2]|0;if((j|0)!=(E|0)){if(E|0)Ja[c[(c[E>>2]|0)+20>>2]&255](E)}else Ja[c[(c[E>>2]|0)+16>>2]&255](E);a[b+60>>0]=1;b=fi(192)|0;xb(b,u);c[b>>2]=4220;v=j+8|0;w=v+36|0;do{c[v>>2]=0;v=v+4|0}while((v|0)<(w|0));c[j+44>>2]=4;c[j>>2]=0;c[j+4>>2]=0;c[j+16>>2]=0;c[j+20>>2]=0;c[j+32>>2]=-1426076417;E=c[x>>2]|0;C=c[u>>2]|0;c[C+((c[b+4>>2]|0)*48|0)+36>>2]=(E-C|0)/48|0;if((c[A>>2]|0)==(E|0))wb(u,j);else{v=E;B=j;w=v+48|0;do{c[v>>2]=c[B>>2];v=v+4|0;B=B+4|0}while((v|0)<(w|0));c[x>>2]=(c[x>>2]|0)+48}c[k>>2]=b;E=fi(16)|0;c[E+4>>2]=0;c[E+8>>2]=0;c[E>>2]=4240;c[E+12>>2]=b;C=k+4|0;c[C>>2]=E;c[i>>2]=b;c[i+4>>2]=b;Gb(k,i);b=c[(c[k>>2]|0)+4>>2]|0;E=c[u>>2]|0;c[E+(b*48|0)>>2]=1048576e3;c[E+(b*48|0)+4>>2]=1048576e3;b=c[k>>2]|0;c[b+8>>2]=1056964608;c[b+12>>2]=1056964608;E=c[b+4>>2]|0;F=c[u>>2]|0;c[F+(E*48|0)+24>>2]=1117782016;c[F+(E*48|0)+28>>2]=1117782016;E=m+16|0;c[m>>2]=4536;c[E>>2]=m;F=i+16|0;c[F>>2]=i;c[i>>2]=4536;Ic(i,b+64|0);G=c[F>>2]|0;if((i|0)!=(G|0)){if(G|0)Ja[c[(c[G>>2]|0)+20>>2]&255](G)}else Ja[c[(c[G>>2]|0)+16>>2]&255](G);a[b+60>>0]=1;b=c[E>>2]|0;if((m|0)!=(b|0)){if(b|0)Ja[c[(c[b>>2]|0)+20>>2]&255](b)}else Ja[c[(c[b>>2]|0)+16>>2]&255](b);b=fi(192)|0;xb(b,u);c[b>>2]=4220;v=i+8|0;w=v+36|0;do{c[v>>2]=0;v=v+4|0}while((v|0)<(w|0));c[i+44>>2]=4;c[i>>2]=0;c[i+4>>2]=0;c[i+16>>2]=0;c[i+20>>2]=0;c[i+32>>2]=-1429405697;m=c[x>>2]|0;E=c[u>>2]|0;c[E+((c[b+4>>2]|0)*48|0)+36>>2]=(m-E|0)/48|0;if((c[A>>2]|0)==(m|0))wb(u,i);else{v=m;B=i;w=v+48|0;do{c[v>>2]=c[B>>2];v=v+4|0;B=B+4|0}while((v|0)<(w|0));c[x>>2]=(c[x>>2]|0)+48}c[j>>2]=b;m=fi(16)|0;c[m+4>>2]=0;c[m+8>>2]=0;c[m>>2]=4240;c[m+12>>2]=b;E=j+4|0;c[E>>2]=m;c[h>>2]=b;c[h+4>>2]=b;Gb(j,h);b=c[(c[j>>2]|0)+4>>2]|0;m=c[u>>2]|0;c[m+(b*48|0)>>2]=1048576e3;c[m+(b*48|0)+4>>2]=1061158912;b=c[j>>2]|0;c[b+8>>2]=1056964608;c[b+12>>2]=1056964608;m=c[b+4>>2]|0;G=c[u>>2]|0;c[G+(m*48|0)+24>>2]=1117782016;c[G+(m*48|0)+28>>2]=1117782016;m=n+16|0;c[n>>2]=4580;c[m>>2]=n;G=h+16|0;c[G>>2]=h;c[h>>2]=4580;Ic(h,b+64|0);F=c[G>>2]|0;if((h|0)!=(F|0)){if(F|0)Ja[c[(c[F>>2]|0)+20>>2]&255](F)}else Ja[c[(c[F>>2]|0)+16>>2]&255](F);a[b+60>>0]=1;b=c[m>>2]|0;if((n|0)!=(b|0)){if(b|0)Ja[c[(c[b>>2]|0)+20>>2]&255](b)}else Ja[c[(c[b>>2]|0)+16>>2]&255](b);b=fi(192)|0;xb(b,u);c[b>>2]=4624;v=h+8|0;w=v+36|0;do{c[v>>2]=0;v=v+4|0}while((v|0)<(w|0));c[h+44>>2]=3;c[h>>2]=0;c[h+4>>2]=0;f[h+16>>2]=0.0;f[h+20>>2]=0.0;f[h+24>>2]=5.0;c[h+28>>2]=0;c[h+32>>2]=-1429405697;n=c[x>>2]|0;m=c[u>>2]|0;c[m+((c[b+4>>2]|0)*48|0)+36>>2]=(n-m|0)/48|0;if((c[A>>2]|0)==(n|0))wb(u,h);else{v=n;B=h;w=v+48|0;do{c[v>>2]=c[B>>2];v=v+4|0;B=B+4|0}while((v|0)<(w|0));c[x>>2]=(c[x>>2]|0)+48}c[i>>2]=b;n=fi(16)|0;c[n+4>>2]=0;c[n+8>>2]=0;c[n>>2]=4644;c[n+12>>2]=b;m=i+4|0;c[m>>2]=n;c[g>>2]=b;c[g+4>>2]=b;ad(i,g);b=(c[i>>2]|0)+4|0;n=c[b>>2]|0;F=c[u>>2]|0;f[F+(n*48|0)+8>>2]=0.0;f[F+(n*48|0)+12>>2]=0.0;n=c[b>>2]|0;F=c[u>>2]|0;f[F+(n*48|0)+24>>2]=300.0;f[F+(n*48|0)+28>>2]=300.0;n=c[b>>2]|0;b=c[u>>2]|0;c[b+(n*48|0)>>2]=1056964608;c[b+(n*48|0)+4>>2]=1056964608;n=c[i>>2]|0;c[n+8>>2]=1056964608;c[n+12>>2]=1056964608;n=fi(192)|0;xb(n,u);c[n>>2]=4672;v=g+8|0;w=v+36|0;do{c[v>>2]=0;v=v+4|0}while((v|0)<(w|0));c[g+44>>2]=2;c[g>>2]=0;c[g+4>>2]=0;f[g+16>>2]=0.0;f[g+20>>2]=0.0;c[g+32>>2]=-1429405697;b=c[x>>2]|0;F=c[u>>2]|0;c[F+((c[n+4>>2]|0)*48|0)+36>>2]=(b-F|0)/48|0;if((c[A>>2]|0)==(b|0))wb(u,g);else{v=b;B=g;w=v+48|0;do{c[v>>2]=c[B>>2];v=v+4|0;B=B+4|0}while((v|0)<(w|0));c[x>>2]=(c[x>>2]|0)+48}c[h>>2]=n;x=fi(16)|0;c[x+4>>2]=0;c[x+8>>2]=0;c[x>>2]=4692;c[x+12>>2]=n;B=h+4|0;c[B>>2]=x;c[e>>2]=n;c[e+4>>2]=n;hd(h,e);n=(c[h>>2]|0)+4|0;x=c[n>>2]|0;v=c[u>>2]|0;f[v+(x*48|0)+8>>2]=0.0;f[v+(x*48|0)+12>>2]=0.0;x=c[n>>2]|0;v=c[u>>2]|0;f[v+(x*48|0)+24>>2]=100.0;f[v+(x*48|0)+28>>2]=100.0;x=c[n>>2]|0;n=c[u>>2]|0;c[n+(x*48|0)>>2]=1056964608;c[n+(x*48|0)+4>>2]=1056964608;x=c[h>>2]|0;c[x+8>>2]=1056964608;c[x+12>>2]=1056964608;n=c[x+4>>2]|0;v=c[u>>2]|0;c[v+(n*48|0)+16>>2]=0;c[v+(n*48|0)+20>>2]=1125515264;n=o+16|0;c[o>>2]=4720;c[n>>2]=o;v=e+16|0;c[v>>2]=e;c[e>>2]=4720;Ic(e,x+64|0);w=c[v>>2]|0;if((e|0)!=(w|0)){if(w|0)Ja[c[(c[w>>2]|0)+20>>2]&255](w)}else Ja[c[(c[w>>2]|0)+16>>2]&255](w);a[x+60>>0]=1;x=c[n>>2]|0;if((o|0)!=(x|0)){if(x|0)Ja[c[(c[x>>2]|0)+20>>2]&255](x)}else Ja[c[(c[x>>2]|0)+16>>2]&255](x);x=c[y>>2]|0;o=c[c[x>>2]>>2]|0;c[p>>2]=c[l>>2];l=p+4|0;n=c[D>>2]|0;c[l>>2]=n;if(n|0){w=n+4|0;c[w>>2]=(c[w>>2]|0)+1}Na[o&3](x,u,p);p=c[l>>2]|0;if(p|0?(l=p+4|0,x=c[l>>2]|0,c[l>>2]=x+-1,(x|0)==0):0){Ja[c[(c[p>>2]|0)+8>>2]&255](p);ei(p)}p=c[y>>2]|0;x=c[c[p>>2]>>2]|0;c[q>>2]=c[k>>2];k=q+4|0;l=c[C>>2]|0;c[k>>2]=l;if(l|0){o=l+4|0;c[o>>2]=(c[o>>2]|0)+1}Na[x&3](p,u,q);q=c[k>>2]|0;do if(q|0){k=q+4|0;p=c[k>>2]|0;c[k>>2]=p+-1;if(p|0)break;Ja[c[(c[q>>2]|0)+8>>2]&255](q);ei(q)}while(0);q=c[y>>2]|0;p=c[c[q>>2]>>2]|0;c[r>>2]=c[j>>2];j=r+4|0;k=c[E>>2]|0;c[j>>2]=k;if(k|0){x=k+4|0;c[x>>2]=(c[x>>2]|0)+1}Na[p&3](q,u,r);r=c[j>>2]|0;do if(r|0){j=r+4|0;q=c[j>>2]|0;c[j>>2]=q+-1;if(q|0)break;Ja[c[(c[r>>2]|0)+8>>2]&255](r);ei(r)}while(0);r=c[y>>2]|0;q=c[c[r>>2]>>2]|0;c[s>>2]=c[i>>2];i=s+4|0;j=c[m>>2]|0;c[i>>2]=j;if(j|0){p=j+4|0;c[p>>2]=(c[p>>2]|0)+1}Na[q&3](r,u,s);s=c[i>>2]|0;do if(s|0){i=s+4|0;r=c[i>>2]|0;c[i>>2]=r+-1;if(r|0)break;Ja[c[(c[s>>2]|0)+8>>2]&255](s);ei(s)}while(0);s=c[y>>2]|0;y=c[c[s>>2]>>2]|0;c[t>>2]=c[h>>2];h=t+4|0;r=c[B>>2]|0;c[h>>2]=r;if(r|0){i=r+4|0;c[i>>2]=(c[i>>2]|0)+1}Na[y&3](s,u,t);t=c[h>>2]|0;do if(t|0){h=t+4|0;u=c[h>>2]|0;c[h>>2]=u+-1;if(u|0)break;Ja[c[(c[t>>2]|0)+8>>2]&255](t);ei(t)}while(0);t=c[B>>2]|0;do if(t|0){B=t+4|0;u=c[B>>2]|0;c[B>>2]=u+-1;if(u|0)break;Ja[c[(c[t>>2]|0)+8>>2]&255](t);ei(t)}while(0);t=c[m>>2]|0;do if(t|0){m=t+4|0;u=c[m>>2]|0;c[m>>2]=u+-1;if(u|0)break;Ja[c[(c[t>>2]|0)+8>>2]&255](t);ei(t)}while(0);t=c[E>>2]|0;do if(t|0){E=t+4|0;u=c[E>>2]|0;c[E>>2]=u+-1;if(u|0)break;Ja[c[(c[t>>2]|0)+8>>2]&255](t);ei(t)}while(0);t=c[C>>2]|0;do if(t|0){C=t+4|0;u=c[C>>2]|0;c[C>>2]=u+-1;if(u|0)break;Ja[c[(c[t>>2]|0)+8>>2]&255](t);ei(t)}while(0);t=c[D>>2]|0;if(!t){Ca=d;return}D=t+4|0;u=c[D>>2]|0;c[D>>2]=u+-1;if(u|0){Ca=d;return}Ja[c[(c[t>>2]|0)+8>>2]&255](t);ei(t);Ca=d;return}function fb(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0;d=Ca;Ca=Ca+16|0;if((Ca|0)>=(Da|0))z(16);e=d;c[a>>2]=b;f=fi(16)|0;c[f+4>>2]=0;c[f+8>>2]=0;c[f>>2]=5680;c[f+12>>2]=b;c[a+4>>2]=f;c[e>>2]=b;c[e+4>>2]=b;ig(a,e);Ca=d;return}function gb(a){a=a|0;var b=0,d=0,e=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0;b=Ca;Ca=Ca+352|0;if((Ca|0)>=(Da|0))z(352);d=b+272|0;e=b+264|0;g=b+216|0;h=b+168|0;i=b+304|0;j=b+144|0;k=b+120|0;l=b+96|0;m=b+72|0;n=b+48|0;o=b+24|0;p=b;q=b+296|0;r=b+288|0;s=b+280|0;t=a+4|0;c[t>>2]=0;c[t+4>>2]=0;c[t+8>>2]=0;c[t+12>>2]=0;c[t+16>>2]=0;c[t+20>>2]=0;c[t+24>>2]=0;c[a>>2]=4764;Xh(13276)|0;t=a+4|0;u=i+8|0;v=u+36|0;do{c[u>>2]=0;u=u+4|0}while((u|0)<(v|0));c[i+44>>2]=2;c[i>>2]=1112014848;c[i+4>>2]=1112014848;f[i+16>>2]=30.0;f[i+20>>2]=30.0;c[i+32>>2]=-3364097;w=a+8|0;x=c[w>>2]|0;y=a+12|0;if(x>>>0<(c[y>>2]|0)>>>0){u=x;A=i;v=u+48|0;do{c[u>>2]=c[A>>2];u=u+4|0;A=A+4|0}while((u|0)<(v|0));c[w>>2]=(c[w>>2]|0)+48}else qb(t,i);x=fi(192)|0;xb(x,t);c[i>>2]=x;B=fi(16)|0;c[B+4>>2]=0;c[B+8>>2]=0;c[B>>2]=4192;c[B+12>>2]=x;C=i+4|0;c[C>>2]=B;c[h>>2]=x;c[h+4>>2]=x;Gb(i,h);x=a+16|0;B=c[i>>2]|0;D=c[C>>2]|0;c[i>>2]=0;c[C>>2]=0;c[x>>2]=B;B=a+20|0;E=c[B>>2]|0;c[B>>2]=D;if(E|0?(D=E+4|0,B=c[D>>2]|0,c[D>>2]=B+-1,(B|0)==0):0){Ja[c[(c[E>>2]|0)+8>>2]&255](E);ei(E)}E=c[C>>2]|0;if(E|0?(C=E+4|0,B=c[C>>2]|0,c[C>>2]=B+-1,(B|0)==0):0){Ja[c[(c[E>>2]|0)+8>>2]&255](E);ei(E)}E=c[(c[x>>2]|0)+4>>2]|0;B=c[t>>2]|0;c[B+(E*48|0)+8>>2]=1065353216;c[B+(E*48|0)+12>>2]=1065353216;E=fi(192)|0;xb(E,t);c[E>>2]=4672;u=h+8|0;v=u+36|0;do{c[u>>2]=0;u=u+4|0}while((u|0)<(v|0));c[h+44>>2]=2;c[h>>2]=0;c[h+4>>2]=0;f[h+16>>2]=0.0;f[h+20>>2]=0.0;c[h+32>>2]=-1429405697;B=c[w>>2]|0;C=c[t>>2]|0;c[C+((c[E+4>>2]|0)*48|0)+36>>2]=(B-C|0)/48|0;if((c[y>>2]|0)==(B|0))wb(t,h);else{u=B;A=h;v=u+48|0;do{c[u>>2]=c[A>>2];u=u+4|0;A=A+4|0}while((u|0)<(v|0));c[w>>2]=(c[w>>2]|0)+48}c[i>>2]=E;B=fi(16)|0;c[B+4>>2]=0;c[B+8>>2]=0;c[B>>2]=4692;c[B+12>>2]=E;C=i+4|0;c[C>>2]=B;c[g>>2]=E;c[g+4>>2]=E;hd(i,g);E=(c[i>>2]|0)+4|0;B=c[E>>2]|0;D=c[t>>2]|0;f[D+(B*48|0)+8>>2]=0.0;f[D+(B*48|0)+12>>2]=0.0;B=c[E>>2]|0;D=c[t>>2]|0;f[D+(B*48|0)+24>>2]=100.0;f[D+(B*48|0)+28>>2]=100.0;B=c[E>>2]|0;E=c[t>>2]|0;c[E+(B*48|0)>>2]=1065353216;c[E+(B*48|0)+4>>2]=0;B=c[i>>2]|0;E=c[B+4>>2]|0;D=c[t>>2]|0;c[D+(E*48|0)+16>>2]=-1027080192;c[D+(E*48|0)+20>>2]=1120403456;c[B+8>>2]=1056964608;c[B+12>>2]=1056964608;E=a;a=B;D=c[C>>2]|0;if(!D)F=0;else{G=D+4|0;c[G>>2]=(c[G>>2]|0)+1;F=c[C>>2]|0}G=j+16|0;c[j>>2]=4784;c[j+4>>2]=E;c[j+8>>2]=a;c[j+12>>2]=D;c[G>>2]=j;if(!F)H=0;else{D=F+4|0;c[D>>2]=(c[D>>2]|0)+1;H=c[C>>2]|0}D=k+16|0;c[k>>2]=4828;c[k+4>>2]=E;c[k+8>>2]=a;c[k+12>>2]=F;c[D>>2]=k;if(H|0){F=H+4|0;c[F>>2]=(c[F>>2]|0)+1}F=l+16|0;c[l>>2]=4872;c[l+4>>2]=E;c[l+8>>2]=a;c[l+12>>2]=H;c[F>>2]=l;zb(B,j,k,l);B=c[F>>2]|0;if((l|0)!=(B|0)){if(B|0)Ja[c[(c[B>>2]|0)+20>>2]&255](B)}else Ja[c[(c[B>>2]|0)+16>>2]&255](B);B=c[D>>2]|0;if((k|0)!=(B|0)){if(B|0)Ja[c[(c[B>>2]|0)+20>>2]&255](B)}else Ja[c[(c[B>>2]|0)+16>>2]&255](B);B=c[G>>2]|0;if((j|0)!=(B|0)){if(B|0)Ja[c[(c[B>>2]|0)+20>>2]&255](B)}else Ja[c[(c[B>>2]|0)+16>>2]&255](B);B=fi(192)|0;xb(B,t);c[B>>2]=4916;u=g+8|0;v=u+36|0;do{c[u>>2]=0;u=u+4|0}while((u|0)<(v|0));c[g+44>>2]=5;c[g>>2]=0;c[g+4>>2]=0;c[g+16>>2]=0;c[g+20>>2]=0;f[g+24>>2]=10.0;f[g+28>>2]=5.0;c[g+32>>2]=-1;c[g+36>>2]=869007615;j=c[w>>2]|0;G=c[t>>2]|0;c[G+((c[B+4>>2]|0)*48|0)+36>>2]=(j-G|0)/48|0;if((c[y>>2]|0)==(j|0))wb(t,g);else{u=j;A=g;v=u+48|0;do{c[u>>2]=c[A>>2];u=u+4|0;A=A+4|0}while((u|0)<(v|0));c[w>>2]=(c[w>>2]|0)+48}c[h>>2]=B;w=fi(16)|0;c[w+4>>2]=0;c[w+8>>2]=0;c[w>>2]=4936;c[w+12>>2]=B;A=h+4|0;c[A>>2]=w;c[e>>2]=B;c[e+4>>2]=B;Zd(h,e);B=(c[h>>2]|0)+4|0;w=c[B>>2]|0;u=c[t>>2]|0;c[u+(w*48|0)+24>>2]=1125515264;c[u+(w*48|0)+28>>2]=1117782016;w=c[B>>2]|0;B=c[t>>2]|0;c[B+(w*48|0)>>2]=1065353216;c[B+(w*48|0)+4>>2]=0;w=c[h>>2]|0;B=c[w+4>>2]|0;u=c[t>>2]|0;c[u+(B*48|0)+16>>2]=-1018691584;c[u+(B*48|0)+20>>2]=1133903872;c[w+8>>2]=0;c[w+12>>2]=1056964608;B=w;u=c[A>>2]|0;if(!u)I=0;else{v=u+4|0;c[v>>2]=(c[v>>2]|0)+1;I=c[A>>2]|0}v=m+16|0;c[m>>2]=4964;c[m+4>>2]=E;c[m+8>>2]=B;c[m+12>>2]=u;c[v>>2]=m;if(!I)J=0;else{u=I+4|0;c[u>>2]=(c[u>>2]|0)+1;J=c[A>>2]|0}u=n+16|0;c[n>>2]=5008;c[n+4>>2]=E;c[n+8>>2]=B;c[n+12>>2]=I;c[u>>2]=n;if(J|0){I=J+4|0;c[I>>2]=(c[I>>2]|0)+1}I=o+16|0;c[o>>2]=5052;c[o+4>>2]=E;c[o+8>>2]=B;c[o+12>>2]=J;c[I>>2]=o;zb(w,m,n,o);w=c[I>>2]|0;if((o|0)!=(w|0)){if(w|0)Ja[c[(c[w>>2]|0)+20>>2]&255](w)}else Ja[c[(c[w>>2]|0)+16>>2]&255](w);w=c[u>>2]|0;if((n|0)!=(w|0)){if(w|0)Ja[c[(c[w>>2]|0)+20>>2]&255](w)}else Ja[c[(c[w>>2]|0)+16>>2]&255](w);w=c[v>>2]|0;if((m|0)!=(w|0)){if(w|0)Ja[c[(c[w>>2]|0)+20>>2]&255](w)}else Ja[c[(c[w>>2]|0)+16>>2]&255](w);w=fi(216)|0;m=p+16|0;c[m>>2]=0;ud(w,t,p);c[e>>2]=w;v=fi(16)|0;c[v+4>>2]=0;c[v+8>>2]=0;c[v>>2]=5248;c[v+12>>2]=w;n=e+4|0;c[n>>2]=v;c[d>>2]=w;c[d+4>>2]=w;bf(e,d);d=c[m>>2]|0;if((p|0)!=(d|0)){if(d|0)Ja[c[(c[d>>2]|0)+20>>2]&255](d)}else Ja[c[(c[d>>2]|0)+16>>2]&255](d);d=(c[e>>2]|0)+4|0;p=c[d>>2]|0;m=c[t>>2]|0;c[m+(p*48|0)+24>>2]=1125515264;c[m+(p*48|0)+28>>2]=1117782016;p=c[d>>2]|0;d=c[t>>2]|0;c[d+(p*48|0)>>2]=1056964608;c[d+(p*48|0)+4>>2]=1056964608;p=c[e>>2]|0;c[p+8>>2]=1056964608;c[p+12>>2]=1056964608;p=c[x>>2]|0;d=c[c[p>>2]>>2]|0;c[q>>2]=c[i>>2];i=q+4|0;m=c[C>>2]|0;c[i>>2]=m;if(m|0){w=m+4|0;c[w>>2]=(c[w>>2]|0)+1}Na[d&3](p,t,q);q=c[i>>2]|0;do if(q|0){i=q+4|0;p=c[i>>2]|0;c[i>>2]=p+-1;if(p|0)break;Ja[c[(c[q>>2]|0)+8>>2]&255](q);ei(q)}while(0);q=c[x>>2]|0;p=c[c[q>>2]>>2]|0;c[r>>2]=c[h>>2];h=r+4|0;i=c[A>>2]|0;c[h>>2]=i;if(i|0){d=i+4|0;c[d>>2]=(c[d>>2]|0)+1}Na[p&3](q,t,r);r=c[h>>2]|0;do if(r|0){h=r+4|0;q=c[h>>2]|0;c[h>>2]=q+-1;if(q|0)break;Ja[c[(c[r>>2]|0)+8>>2]&255](r);ei(r)}while(0);r=c[x>>2]|0;x=c[c[r>>2]>>2]|0;c[s>>2]=c[e>>2];e=s+4|0;q=c[n>>2]|0;c[e>>2]=q;if(q|0){h=q+4|0;c[h>>2]=(c[h>>2]|0)+1}Na[x&3](r,t,s);s=c[e>>2]|0;do if(s|0){e=s+4|0;t=c[e>>2]|0;c[e>>2]=t+-1;if(t|0)break;Ja[c[(c[s>>2]|0)+8>>2]&255](s);ei(s)}while(0);s=c[n>>2]|0;do if(s|0){n=s+4|0;t=c[n>>2]|0;c[n>>2]=t+-1;if(t|0)break;Ja[c[(c[s>>2]|0)+8>>2]&255](s);ei(s)}while(0);s=c[A>>2]|0;do if(s|0){A=s+4|0;t=c[A>>2]|0;c[A>>2]=t+-1;if(t|0)break;Ja[c[(c[s>>2]|0)+8>>2]&255](s);ei(s)}while(0);s=c[C>>2]|0;if(!s){Ca=b;return}C=s+4|0;t=c[C>>2]|0;c[C>>2]=t+-1;if(t|0){Ca=b;return}Ja[c[(c[s>>2]|0)+8>>2]&255](s);ei(s);Ca=b;return}function hb(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0;d=Ca;Ca=Ca+16|0;if((Ca|0)>=(Da|0))z(16);e=d;c[a>>2]=b;f=fi(16)|0;c[f+4>>2]=0;c[f+8>>2]=0;c[f>>2]=5708;c[f+12>>2]=b;c[a+4>>2]=f;c[e>>2]=b;c[e+4>>2]=b;ig(a,e);Ca=d;return}function ib(a){a=a|0;var b=0,d=0,e=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0;b=Ca;Ca=Ca+176|0;if((Ca|0)>=(Da|0))z(176);d=b+96|0;e=b+120|0;g=b+112|0;h=b+104|0;i=b+72|0;j=b+48|0;k=b+24|0;l=b;m=a+4|0;c[m>>2]=0;c[m+4>>2]=0;c[m+8>>2]=0;c[m+12>>2]=0;c[m+16>>2]=0;c[m+20>>2]=0;c[m+24>>2]=0;c[a>>2]=5276;m=a+32|0;c[m>>2]=0;n=a+36|0;c[n>>2]=0;Xh(13303)|0;o=a+4|0;p=e+8|0;q=p+36|0;do{c[p>>2]=0;p=p+4|0}while((p|0)<(q|0));c[e+44>>2]=2;c[e>>2]=1112014848;c[e+4>>2]=1112014848;f[e+16>>2]=30.0;f[e+20>>2]=30.0;c[e+32>>2]=-1728052993;r=a+8|0;s=c[r>>2]|0;if(s>>>0<(c[a+12>>2]|0)>>>0){p=s;s=e;q=p+48|0;do{c[p>>2]=c[s>>2];p=p+4|0;s=s+4|0}while((p|0)<(q|0));c[r>>2]=(c[r>>2]|0)+48}else qb(o,e);r=fi(192)|0;xb(r,o);c[e>>2]=r;s=fi(16)|0;c[s+4>>2]=0;c[s+8>>2]=0;c[s>>2]=4192;c[s+12>>2]=r;p=e+4|0;c[p>>2]=s;c[d>>2]=r;c[d+4>>2]=r;Gb(e,d);r=a+16|0;s=c[e>>2]|0;q=c[p>>2]|0;c[e>>2]=0;c[p>>2]=0;c[r>>2]=s;s=a+20|0;t=c[s>>2]|0;c[s>>2]=q;if(t|0?(q=t+4|0,u=c[q>>2]|0,c[q>>2]=u+-1,(u|0)==0):0){Ja[c[(c[t>>2]|0)+8>>2]&255](t);ei(t)}t=c[p>>2]|0;if(t|0?(p=t+4|0,u=c[p>>2]|0,c[p>>2]=u+-1,(u|0)==0):0){Ja[c[(c[t>>2]|0)+8>>2]&255](t);ei(t)}t=c[(c[r>>2]|0)+4>>2]|0;u=c[o>>2]|0;c[u+(t*48|0)+8>>2]=1065353216;c[u+(t*48|0)+12>>2]=1065353216;t=fi(12)|0;c[h>>2]=c[r>>2];u=h+4|0;p=c[s>>2]|0;c[u>>2]=p;if(p|0){s=p+4|0;c[s>>2]=(c[s>>2]|0)+1}s=a;a=i+16|0;c[i>>2]=5324;c[i+4>>2]=s;c[a>>2]=i;gf(t,o,5,h,i);c[g>>2]=0;c[d>>2]=c[g>>2];hf(e,t,d);d=c[e>>2]|0;c[e>>2]=c[m>>2];c[m>>2]=d;d=e+4|0;e=c[d>>2]|0;m=c[n>>2]|0;c[d>>2]=m;c[n>>2]=e;e=m;if(m|0?(n=e+4|0,d=c[n>>2]|0,c[n>>2]=d+-1,(d|0)==0):0){Ja[c[(c[m>>2]|0)+8>>2]&255](e);ei(e)}e=c[a>>2]|0;if((i|0)!=(e|0)){if(e|0)Ja[c[(c[e>>2]|0)+20>>2]&255](e)}else Ja[c[(c[e>>2]|0)+16>>2]&255](e);e=c[u>>2]|0;if(e|0?(u=e+4|0,i=c[u>>2]|0,c[u>>2]=i+-1,(i|0)==0):0){Ja[c[(c[e>>2]|0)+8>>2]&255](e);ei(e)}e=c[r>>2]|0;r=j+16|0;c[r>>2]=0;i=k+16|0;c[i>>2]=0;u=l+16|0;c[l>>2]=5412;c[l+4>>2]=s;c[u>>2]=l;zb(e,j,k,l);e=c[u>>2]|0;if((l|0)!=(e|0)){if(e|0)Ja[c[(c[e>>2]|0)+20>>2]&255](e)}else Ja[c[(c[e>>2]|0)+16>>2]&255](e);e=c[i>>2]|0;if((k|0)!=(e|0)){if(e|0)Ja[c[(c[e>>2]|0)+20>>2]&255](e)}else Ja[c[(c[e>>2]|0)+16>>2]&255](e);e=c[r>>2]|0;if((j|0)==(e|0)){Ja[c[(c[e>>2]|0)+16>>2]&255](e);Ca=b;return}if(!e){Ca=b;return}Ja[c[(c[e>>2]|0)+20>>2]&255](e);Ca=b;return}function jb(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0;d=Ca;Ca=Ca+16|0;if((Ca|0)>=(Da|0))z(16);e=d;c[a>>2]=b;f=fi(16)|0;c[f+4>>2]=0;c[f+8>>2]=0;c[f>>2]=5736;c[f+12>>2]=b;c[a+4>>2]=f;c[e>>2]=b;c[e+4>>2]=b;ig(a,e);Ca=d;return}function kb(b){b=b|0;var d=0,e=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0;d=Ca;Ca=Ca+368|0;if((Ca|0)>=(Da|0))z(368);e=d+216|0;g=d+208|0;h=d+200|0;i=d+192|0;j=d+184|0;k=d+176|0;l=d+168|0;m=d+160|0;n=d+112|0;o=d+104|0;p=d+56|0;q=d+48|0;r=d;s=d+280|0;t=d+356|0;u=d+264|0;v=d+352|0;w=d+344|0;x=d+336|0;y=d+328|0;A=d+272|0;B=b+4|0;c[B>>2]=0;c[B+4>>2]=0;c[B+8>>2]=0;c[B+12>>2]=0;c[B+16>>2]=0;c[B+20>>2]=0;c[B+24>>2]=0;c[b>>2]=5456;Xh(13328)|0;B=b+4|0;C=s+8|0;D=C+36|0;do{c[C>>2]=0;C=C+4|0}while((C|0)<(D|0));c[s+44>>2]=2;c[s>>2]=1112014848;c[s+4>>2]=1112014848;f[s+16>>2]=30.0;f[s+20>>2]=30.0;c[s+32>>2]=-1718025985;E=b+8|0;F=c[E>>2]|0;G=b+12|0;if(F>>>0<(c[G>>2]|0)>>>0){C=F;H=s;D=C+48|0;do{c[C>>2]=c[H>>2];C=C+4|0;H=H+4|0}while((C|0)<(D|0));c[E>>2]=(c[E>>2]|0)+48}else qb(B,s);F=fi(192)|0;xb(F,B);c[s>>2]=F;I=fi(16)|0;c[I+4>>2]=0;c[I+8>>2]=0;c[I>>2]=4192;c[I+12>>2]=F;J=s+4|0;c[J>>2]=I;c[r>>2]=F;c[r+4>>2]=F;Gb(s,r);F=b+16|0;I=c[s>>2]|0;K=c[J>>2]|0;c[s>>2]=0;c[J>>2]=0;c[F>>2]=I;I=b+20|0;b=c[I>>2]|0;c[I>>2]=K;if(b|0?(K=b+4|0,I=c[K>>2]|0,c[K>>2]=I+-1,(I|0)==0):0){Ja[c[(c[b>>2]|0)+8>>2]&255](b);ei(b)}b=c[J>>2]|0;if(b|0?(J=b+4|0,I=c[J>>2]|0,c[J>>2]=I+-1,(I|0)==0):0){Ja[c[(c[b>>2]|0)+8>>2]&255](b);ei(b)}b=c[(c[F>>2]|0)+4>>2]|0;I=c[B>>2]|0;c[I+(b*48|0)+8>>2]=1065353216;c[I+(b*48|0)+12>>2]=1065353216;b=fi(192)|0;xb(b,B);c[b>>2]=4672;C=r+8|0;D=C+36|0;do{c[C>>2]=0;C=C+4|0}while((C|0)<(D|0));c[r+44>>2]=2;c[r>>2]=0;c[r+4>>2]=0;f[r+16>>2]=0.0;f[r+20>>2]=0.0;c[r+32>>2]=-1429405697;I=c[E>>2]|0;J=c[B>>2]|0;c[J+((c[b+4>>2]|0)*48|0)+36>>2]=(I-J|0)/48|0;if((c[G>>2]|0)==(I|0))wb(B,r);else{C=I;H=r;D=C+48|0;do{c[C>>2]=c[H>>2];C=C+4|0;H=H+4|0}while((C|0)<(D|0));c[E>>2]=(c[E>>2]|0)+48}c[s>>2]=b;I=fi(16)|0;c[I+4>>2]=0;c[I+8>>2]=0;c[I>>2]=4692;c[I+12>>2]=b;J=s+4|0;c[J>>2]=I;c[q>>2]=b;c[q+4>>2]=b;hd(s,q);b=(c[s>>2]|0)+4|0;I=c[b>>2]|0;K=c[B>>2]|0;f[K+(I*48|0)+8>>2]=0.0;f[K+(I*48|0)+12>>2]=0.0;I=c[b>>2]|0;K=c[B>>2]|0;f[K+(I*48|0)+24>>2]=100.0;f[K+(I*48|0)+28>>2]=100.0;I=c[b>>2]|0;b=c[B>>2]|0;c[b+(I*48|0)>>2]=0;c[b+(I*48|0)+4>>2]=0;I=c[s>>2]|0;b=c[I+4>>2]|0;K=c[B>>2]|0;c[K+(b*48|0)+16>>2]=1128792064;c[K+(b*48|0)+20>>2]=1128792064;c[I+8>>2]=1056964608;c[I+12>>2]=1056964608;b=I;I=fi(48)|0;K=c[J>>2]|0;L=(K|0)==0;if(L){a[I+4>>0]=0;c[I>>2]=5476;c[I+8>>2]=b;c[I+12>>2]=K}else{M=K+4|0;c[M>>2]=(c[M>>2]|0)+1;a[I+4>>0]=0;c[I>>2]=5476;c[I+8>>2]=b;c[I+12>>2]=K;b=K+4|0;c[b>>2]=(c[b>>2]|0)+1}c[I+16>>2]=1;f[I+20>>2]=0.0;f[I+24>>2]=0.0;c[I+28>>2]=1142292480;c[I+32>>2]=1137180672;f[I+36>>2]=1.0e3;f[I+40>>2]=100.0;f[I+44>>2]=1.0000000474974513e-03;c[q>>2]=I;b=fi(16)|0;c[b+4>>2]=0;c[b+8>>2]=0;c[b>>2]=5488;c[b+12>>2]=I;M=q+4|0;c[M>>2]=b;c[p>>2]=I;c[p+4>>2]=I;Sf(q,p);if(!L?(L=K+4|0,I=c[L>>2]|0,c[L>>2]=I+-1,(I|0)==0):0){Ja[c[(c[K>>2]|0)+8>>2]&255](K);ei(K)}K=c[s>>2]|0;I=c[q>>2]|0;q=c[M>>2]|0;if(q|0){L=q+4|0;c[L>>2]=(c[L>>2]|0)+1}c[K+168>>2]=I;I=K+172|0;K=c[I>>2]|0;c[I>>2]=q;if(K|0?(q=K+4|0,I=c[q>>2]|0,c[q>>2]=I+-1,(I|0)==0):0){Ja[c[(c[K>>2]|0)+8>>2]&255](K);ei(K)}K=fi(192)|0;xb(K,B);c[K>>2]=4672;C=p+8|0;D=C+36|0;do{c[C>>2]=0;C=C+4|0}while((C|0)<(D|0));c[p+44>>2]=2;c[p>>2]=0;c[p+4>>2]=0;f[p+16>>2]=0.0;f[p+20>>2]=0.0;c[p+32>>2]=-5570561;I=c[E>>2]|0;q=c[B>>2]|0;c[q+((c[K+4>>2]|0)*48|0)+36>>2]=(I-q|0)/48|0;if((c[G>>2]|0)==(I|0))wb(B,p);else{C=I;H=p;D=C+48|0;do{c[C>>2]=c[H>>2];C=C+4|0;H=H+4|0}while((C|0)<(D|0));c[E>>2]=(c[E>>2]|0)+48}c[r>>2]=K;I=fi(16)|0;c[I+4>>2]=0;c[I+8>>2]=0;c[I>>2]=4692;c[I+12>>2]=K;q=r+4|0;c[q>>2]=I;c[o>>2]=K;c[o+4>>2]=K;hd(r,o);K=(c[r>>2]|0)+4|0;I=c[K>>2]|0;L=c[B>>2]|0;f[L+(I*48|0)+8>>2]=0.0;f[L+(I*48|0)+12>>2]=0.0;I=c[K>>2]|0;L=c[B>>2]|0;f[L+(I*48|0)+24>>2]=100.0;f[L+(I*48|0)+28>>2]=100.0;I=c[K>>2]|0;K=c[B>>2]|0;c[K+(I*48|0)>>2]=1065353216;c[K+(I*48|0)+4>>2]=0;I=c[r>>2]|0;K=c[I+4>>2]|0;L=c[B>>2]|0;c[L+(K*48|0)+16>>2]=-1010302976;c[L+(K*48|0)+20>>2]=1133903872;c[I+8>>2]=1056964608;c[I+12>>2]=1056964608;K=I;I=fi(48)|0;L=c[q>>2]|0;b=(L|0)==0;if(b){a[I+4>>0]=0;c[I>>2]=5476;c[I+8>>2]=K;c[I+12>>2]=L}else{N=L+4|0;c[N>>2]=(c[N>>2]|0)+1;a[I+4>>0]=0;c[I>>2]=5476;c[I+8>>2]=K;c[I+12>>2]=L;K=L+4|0;c[K>>2]=(c[K>>2]|0)+1}c[I+16>>2]=3;f[I+20>>2]=0.0;f[I+24>>2]=0.0;c[I+28>>2]=1125515264;c[I+32>>2]=1125515264;f[I+36>>2]=1.0e3;f[I+40>>2]=100.0;f[I+44>>2]=1.0000000474974513e-03;c[o>>2]=I;K=fi(16)|0;c[K+4>>2]=0;c[K+8>>2]=0;c[K>>2]=5488;c[K+12>>2]=I;N=o+4|0;c[N>>2]=K;c[n>>2]=I;c[n+4>>2]=I;Sf(o,n);if(!b?(b=L+4|0,I=c[b>>2]|0,c[b>>2]=I+-1,(I|0)==0):0){Ja[c[(c[L>>2]|0)+8>>2]&255](L);ei(L)}L=c[r>>2]|0;I=c[o>>2]|0;o=c[N>>2]|0;if(o|0){b=o+4|0;c[b>>2]=(c[b>>2]|0)+1}c[L+168>>2]=I;I=L+172|0;L=c[I>>2]|0;c[I>>2]=o;if(L|0?(o=L+4|0,I=c[o>>2]|0,c[o>>2]=I+-1,(I|0)==0):0){Ja[c[(c[L>>2]|0)+8>>2]&255](L);ei(L)}L=fi(192)|0;xb(L,B);c[L>>2]=4672;C=n+8|0;D=C+36|0;do{c[C>>2]=0;C=C+4|0}while((C|0)<(D|0));c[n+44>>2]=2;c[n>>2]=0;c[n+4>>2]=0;f[n+16>>2]=0.0;f[n+20>>2]=0.0;c[n+32>>2]=-1426085121;I=c[E>>2]|0;o=c[B>>2]|0;c[o+((c[L+4>>2]|0)*48|0)+36>>2]=(I-o|0)/48|0;if((c[G>>2]|0)==(I|0))wb(B,n);else{C=I;H=n;D=C+48|0;do{c[C>>2]=c[H>>2];C=C+4|0;H=H+4|0}while((C|0)<(D|0));c[E>>2]=(c[E>>2]|0)+48}c[p>>2]=L;I=fi(16)|0;c[I+4>>2]=0;c[I+8>>2]=0;c[I>>2]=4692;c[I+12>>2]=L;o=p+4|0;c[o>>2]=I;c[m>>2]=L;c[m+4>>2]=L;hd(p,m);L=(c[p>>2]|0)+4|0;I=c[L>>2]|0;b=c[B>>2]|0;f[b+(I*48|0)+8>>2]=0.0;f[b+(I*48|0)+12>>2]=0.0;I=c[L>>2]|0;b=c[B>>2]|0;f[b+(I*48|0)+24>>2]=60.0;f[b+(I*48|0)+28>>2]=60.0;I=c[L>>2]|0;L=c[B>>2]|0;c[L+(I*48|0)>>2]=1056964608;c[L+(I*48|0)+4>>2]=0;I=c[p>>2]|0;L=c[I+4>>2]|0;b=c[B>>2]|0;c[b+(L*48|0)+16>>2]=0;c[b+(L*48|0)+20>>2]=1120403456;c[I+8>>2]=1056964608;c[I+12>>2]=1056964608;L=I;I=fi(48)|0;b=c[o>>2]|0;K=(b|0)==0;if(K){a[I+4>>0]=0;c[I>>2]=5476;c[I+8>>2]=L;c[I+12>>2]=b}else{O=b+4|0;c[O>>2]=(c[O>>2]|0)+1;a[I+4>>0]=0;c[I>>2]=5476;c[I+8>>2]=L;c[I+12>>2]=b;L=b+4|0;c[L>>2]=(c[L>>2]|0)+1}c[I+16>>2]=1;f[I+20>>2]=0.0;f[I+24>>2]=0.0;c[I+28>>2]=-1010302976;c[I+32>>2]=1133903872;f[I+36>>2]=1.0e3;f[I+40>>2]=100.0;f[I+44>>2]=1.0000000474974513e-03;c[m>>2]=I;L=fi(16)|0;c[L+4>>2]=0;c[L+8>>2]=0;c[L>>2]=5488;c[L+12>>2]=I;O=m+4|0;c[O>>2]=L;c[l>>2]=I;c[l+4>>2]=I;Sf(m,l);if(!K?(K=b+4|0,I=c[K>>2]|0,c[K>>2]=I+-1,(I|0)==0):0){Ja[c[(c[b>>2]|0)+8>>2]&255](b);ei(b)}b=fi(48)|0;I=c[p>>2]|0;K=c[o>>2]|0;L=(K|0)==0;if(L){a[b+4>>0]=0;c[b>>2]=5476;c[b+8>>2]=I;c[b+12>>2]=K}else{P=K+4|0;c[P>>2]=(c[P>>2]|0)+1;a[b+4>>0]=0;c[b>>2]=5476;c[b+8>>2]=I;c[b+12>>2]=K;I=K+4|0;c[I>>2]=(c[I>>2]|0)+1}c[b+16>>2]=3;f[b+20>>2]=0.0;f[b+24>>2]=0.0;c[b+28>>2]=1125515264;c[b+32>>2]=1125515264;f[b+36>>2]=1.0e3;f[b+40>>2]=100.0;f[b+44>>2]=1.0000000474974513e-03;c[l>>2]=b;I=fi(16)|0;c[I+4>>2]=0;c[I+8>>2]=0;c[I>>2]=5488;c[I+12>>2]=b;P=l+4|0;c[P>>2]=I;c[e>>2]=b;c[e+4>>2]=b;Sf(l,e);if(!L?(L=K+4|0,b=c[L>>2]|0,c[L>>2]=b+-1,(b|0)==0):0){Ja[c[(c[K>>2]|0)+8>>2]&255](K);ei(K)}K=fi(20)|0;b=K;c[b>>2]=0;c[b+4>>2]=0;c[K>>2]=5516;c[K+8>>2]=0;c[K+12>>2]=0;c[K+16>>2]=0;c[t>>2]=0;c[e>>2]=c[t>>2];Pf(n,K,e);K=c[n>>2]|0;t=c[m>>2]|0;c[e>>2]=t;m=e+4|0;b=c[O>>2]|0;c[m>>2]=b;if(b|0){L=b+4|0;c[L>>2]=(c[L>>2]|0)+1}L=K+12|0;b=c[L>>2]|0;do if(b>>>0<(c[K+16>>2]|0)>>>0){c[b>>2]=t;c[b+4>>2]=c[m>>2];c[e>>2]=0;c[m>>2]=0;c[L>>2]=b+8}else{bg(K+8|0,e);I=c[m>>2]|0;if(!I)break;Q=I+4|0;R=c[Q>>2]|0;c[Q>>2]=R+-1;if(R|0)break;Ja[c[(c[I>>2]|0)+8>>2]&255](I);ei(I)}while(0);m=c[n>>2]|0;K=c[l>>2]|0;c[e>>2]=K;l=e+4|0;b=c[P>>2]|0;c[l>>2]=b;if(b|0){L=b+4|0;c[L>>2]=(c[L>>2]|0)+1}L=m+12|0;b=c[L>>2]|0;do if(b>>>0<(c[m+16>>2]|0)>>>0){c[b>>2]=K;c[b+4>>2]=c[l>>2];c[e>>2]=0;c[l>>2]=0;c[L>>2]=b+8}else{bg(m+8|0,e);t=c[l>>2]|0;if(!t)break;I=t+4|0;R=c[I>>2]|0;c[I>>2]=R+-1;if(R|0)break;Ja[c[(c[t>>2]|0)+8>>2]&255](t);ei(t)}while(0);l=c[p>>2]|0;m=c[n>>2]|0;b=n+4|0;n=c[b>>2]|0;if(n|0){L=n+4|0;c[L>>2]=(c[L>>2]|0)+1}c[l+168>>2]=m;m=l+172|0;l=c[m>>2]|0;c[m>>2]=n;do if(l|0){n=l+4|0;m=c[n>>2]|0;c[n>>2]=m+-1;if(m|0)break;Ja[c[(c[l>>2]|0)+8>>2]&255](l);ei(l)}while(0);l=fi(192)|0;xb(l,B);c[l>>2]=4672;C=e+8|0;D=C+36|0;do{c[C>>2]=0;C=C+4|0}while((C|0)<(D|0));c[e+44>>2]=2;c[e>>2]=0;c[e+4>>2]=0;f[e+16>>2]=0.0;f[e+20>>2]=0.0;c[e+32>>2]=-572662273;m=c[E>>2]|0;n=c[B>>2]|0;c[n+((c[l+4>>2]|0)*48|0)+36>>2]=(m-n|0)/48|0;if((c[G>>2]|0)==(m|0))wb(B,e);else{C=m;H=e;D=C+48|0;do{c[C>>2]=c[H>>2];C=C+4|0;H=H+4|0}while((C|0)<(D|0));c[E>>2]=(c[E>>2]|0)+48}c[u>>2]=l;E=fi(16)|0;c[E+4>>2]=0;c[E+8>>2]=0;c[E>>2]=4692;c[E+12>>2]=l;H=u+4|0;c[H>>2]=E;c[k>>2]=l;c[k+4>>2]=l;hd(u,k);l=(c[u>>2]|0)+4|0;E=c[l>>2]|0;C=c[B>>2]|0;f[C+(E*48|0)+8>>2]=0.0;f[C+(E*48|0)+12>>2]=0.0;E=c[l>>2]|0;C=c[B>>2]|0;f[C+(E*48|0)+24>>2]=160.0;f[C+(E*48|0)+28>>2]=160.0;E=c[l>>2]|0;l=c[B>>2]|0;c[l+(E*48|0)>>2]=0;c[l+(E*48|0)+4>>2]=0;E=c[u>>2]|0;c[E+8>>2]=1056964608;c[E+12>>2]=1056964608;l=E;E=fi(48)|0;C=c[H>>2]|0;D=(C|0)==0;if(D){a[E+4>>0]=0;c[E>>2]=5476;c[E+8>>2]=l;c[E+12>>2]=C}else{m=C+4|0;c[m>>2]=(c[m>>2]|0)+1;a[E+4>>0]=0;c[E>>2]=5476;c[E+8>>2]=l;c[E+12>>2]=C;l=C+4|0;c[l>>2]=(c[l>>2]|0)+1}c[E+16>>2]=0;f[E+20>>2]=0.0;f[E+24>>2]=0.0;c[E+28>>2]=1065353216;c[E+32>>2]=0;f[E+36>>2]=1.0e3;f[E+40>>2]=100.0;f[E+44>>2]=1.0000000474974513e-03;c[k>>2]=E;l=fi(16)|0;c[l+4>>2]=0;c[l+8>>2]=0;c[l>>2]=5488;c[l+12>>2]=E;m=k+4|0;c[m>>2]=l;c[j>>2]=E;c[j+4>>2]=E;Sf(k,j);do if(!D){E=C+4|0;l=c[E>>2]|0;c[E>>2]=l+-1;if(l|0)break;Ja[c[(c[C>>2]|0)+8>>2]&255](C);ei(C)}while(0);C=fi(48)|0;D=c[u>>2]|0;l=c[H>>2]|0;E=(l|0)==0;if(E){a[C+4>>0]=0;c[C>>2]=5476;c[C+8>>2]=D;c[C+12>>2]=l}else{G=l+4|0;c[G>>2]=(c[G>>2]|0)+1;a[C+4>>0]=0;c[C>>2]=5476;c[C+8>>2]=D;c[C+12>>2]=l;D=l+4|0;c[D>>2]=(c[D>>2]|0)+1}c[C+16>>2]=0;f[C+20>>2]=0.0;f[C+24>>2]=0.0;c[C+28>>2]=1065353216;c[C+32>>2]=1065353216;f[C+36>>2]=1.0e3;f[C+40>>2]=100.0;f[C+44>>2]=1.0000000474974513e-03;c[j>>2]=C;D=fi(16)|0;c[D+4>>2]=0;c[D+8>>2]=0;c[D>>2]=5488;c[D+12>>2]=C;G=j+4|0;c[G>>2]=D;c[i>>2]=C;c[i+4>>2]=C;Sf(j,i);do if(!E){C=l+4|0;D=c[C>>2]|0;c[C>>2]=D+-1;if(D|0)break;Ja[c[(c[l>>2]|0)+8>>2]&255](l);ei(l)}while(0);l=fi(48)|0;E=c[u>>2]|0;D=c[H>>2]|0;C=(D|0)==0;if(C){a[l+4>>0]=0;c[l>>2]=5476;c[l+8>>2]=E;c[l+12>>2]=D}else{n=D+4|0;c[n>>2]=(c[n>>2]|0)+1;a[l+4>>0]=0;c[l>>2]=5476;c[l+8>>2]=E;c[l+12>>2]=D;E=D+4|0;c[E>>2]=(c[E>>2]|0)+1}E=l+16|0;c[E>>2]=0;c[E+4>>2]=0;c[E+8>>2]=0;c[E+12>>2]=0;c[l+32>>2]=1065353216;f[l+36>>2]=1.0e3;f[l+40>>2]=100.0;f[l+44>>2]=1.0000000474974513e-03;c[i>>2]=l;E=fi(16)|0;c[E+4>>2]=0;c[E+8>>2]=0;c[E>>2]=5488;c[E+12>>2]=l;n=i+4|0;c[n>>2]=E;c[h>>2]=l;c[h+4>>2]=l;Sf(i,h);do if(!C){l=D+4|0;E=c[l>>2]|0;c[l>>2]=E+-1;if(E|0)break;Ja[c[(c[D>>2]|0)+8>>2]&255](D);ei(D)}while(0);D=fi(48)|0;C=c[u>>2]|0;E=c[H>>2]|0;l=(E|0)==0;if(l){a[D+4>>0]=0;c[D>>2]=5476;c[D+8>>2]=C;c[D+12>>2]=E}else{L=E+4|0;c[L>>2]=(c[L>>2]|0)+1;a[D+4>>0]=0;c[D>>2]=5476;c[D+8>>2]=C;c[D+12>>2]=E;C=E+4|0;c[C>>2]=(c[C>>2]|0)+1}C=D+16|0;c[C>>2]=0;c[C+4>>2]=0;c[C+8>>2]=0;c[C+12>>2]=0;c[C+16>>2]=0;f[D+36>>2]=1.0e3;f[D+40>>2]=100.0;f[D+44>>2]=1.0000000474974513e-03;c[h>>2]=D;C=fi(16)|0;c[C+4>>2]=0;c[C+8>>2]=0;c[C>>2]=5488;c[C+12>>2]=D;L=h+4|0;c[L>>2]=C;c[g>>2]=D;c[g+4>>2]=D;Sf(h,g);do if(!l){D=E+4|0;C=c[D>>2]|0;c[D>>2]=C+-1;if(C|0)break;Ja[c[(c[E>>2]|0)+8>>2]&255](E);ei(E)}while(0);E=fi(24)|0;l=E;c[l>>2]=0;c[l+4>>2]=0;c[E>>2]=5556;l=E+8|0;c[l>>2]=0;c[l+4>>2]=0;c[l+8>>2]=0;c[l+12>>2]=0;c[v>>2]=0;c[e>>2]=c[v>>2];Qf(g,E,e);E=c[g>>2]|0;v=c[k>>2]|0;c[e>>2]=v;k=e+4|0;l=c[m>>2]|0;c[k>>2]=l;if(l|0){C=l+4|0;c[C>>2]=(c[C>>2]|0)+1}C=E+12|0;l=c[C>>2]|0;do if(l>>>0<(c[E+16>>2]|0)>>>0){c[l>>2]=v;c[l+4>>2]=c[k>>2];c[e>>2]=0;c[k>>2]=0;c[C>>2]=l+8}else{bg(E+8|0,e);D=c[k>>2]|0;if(!D)break;K=D+4|0;t=c[K>>2]|0;c[K>>2]=t+-1;if(t|0)break;Ja[c[(c[D>>2]|0)+8>>2]&255](D);ei(D)}while(0);k=c[g>>2]|0;E=c[j>>2]|0;c[e>>2]=E;j=e+4|0;l=c[G>>2]|0;c[j>>2]=l;if(l|0){C=l+4|0;c[C>>2]=(c[C>>2]|0)+1}C=k+12|0;l=c[C>>2]|0;do if(l>>>0<(c[k+16>>2]|0)>>>0){c[l>>2]=E;c[l+4>>2]=c[j>>2];c[e>>2]=0;c[j>>2]=0;c[C>>2]=l+8}else{bg(k+8|0,e);v=c[j>>2]|0;if(!v)break;D=v+4|0;t=c[D>>2]|0;c[D>>2]=t+-1;if(t|0)break;Ja[c[(c[v>>2]|0)+8>>2]&255](v);ei(v)}while(0);j=c[g>>2]|0;k=c[i>>2]|0;c[e>>2]=k;i=e+4|0;l=c[n>>2]|0;c[i>>2]=l;if(l|0){C=l+4|0;c[C>>2]=(c[C>>2]|0)+1}C=j+12|0;l=c[C>>2]|0;do if(l>>>0<(c[j+16>>2]|0)>>>0){c[l>>2]=k;c[l+4>>2]=c[i>>2];c[e>>2]=0;c[i>>2]=0;c[C>>2]=l+8}else{bg(j+8|0,e);E=c[i>>2]|0;if(!E)break;v=E+4|0;t=c[v>>2]|0;c[v>>2]=t+-1;if(t|0)break;Ja[c[(c[E>>2]|0)+8>>2]&255](E);ei(E)}while(0);i=c[g>>2]|0;j=c[h>>2]|0;c[e>>2]=j;h=e+4|0;l=c[L>>2]|0;c[h>>2]=l;if(l|0){C=l+4|0;c[C>>2]=(c[C>>2]|0)+1}C=i+12|0;l=c[C>>2]|0;do if(l>>>0<(c[i+16>>2]|0)>>>0){c[l>>2]=j;c[l+4>>2]=c[h>>2];c[e>>2]=0;c[h>>2]=0;c[C>>2]=l+8}else{bg(i+8|0,e);k=c[h>>2]|0;if(!k)break;E=k+4|0;t=c[E>>2]|0;c[E>>2]=t+-1;if(t|0)break;Ja[c[(c[k>>2]|0)+8>>2]&255](k);ei(k)}while(0);h=c[u>>2]|0;e=c[g>>2]|0;i=g+4|0;g=c[i>>2]|0;if(g|0){l=g+4|0;c[l>>2]=(c[l>>2]|0)+1}c[h+168>>2]=e;e=h+172|0;h=c[e>>2]|0;c[e>>2]=g;do if(h|0){g=h+4|0;e=c[g>>2]|0;c[g>>2]=e+-1;if(e|0)break;Ja[c[(c[h>>2]|0)+8>>2]&255](h);ei(h)}while(0);h=c[F>>2]|0;e=c[c[h>>2]>>2]|0;c[w>>2]=c[s>>2];s=w+4|0;g=c[J>>2]|0;c[s>>2]=g;if(g|0){l=g+4|0;c[l>>2]=(c[l>>2]|0)+1}Na[e&3](h,B,w);w=c[s>>2]|0;do if(w|0){s=w+4|0;h=c[s>>2]|0;c[s>>2]=h+-1;if(h|0)break;Ja[c[(c[w>>2]|0)+8>>2]&255](w);ei(w)}while(0);w=c[F>>2]|0;h=c[c[w>>2]>>2]|0;c[x>>2]=c[r>>2];r=x+4|0;s=c[q>>2]|0;c[r>>2]=s;if(s|0){e=s+4|0;c[e>>2]=(c[e>>2]|0)+1}Na[h&3](w,B,x);x=c[r>>2]|0;do if(x|0){r=x+4|0;w=c[r>>2]|0;c[r>>2]=w+-1;if(w|0)break;Ja[c[(c[x>>2]|0)+8>>2]&255](x);ei(x)}while(0);x=c[F>>2]|0;w=c[c[x>>2]>>2]|0;c[y>>2]=c[p>>2];p=y+4|0;r=c[o>>2]|0;c[p>>2]=r;if(r|0){h=r+4|0;c[h>>2]=(c[h>>2]|0)+1}Na[w&3](x,B,y);y=c[p>>2]|0;do if(y|0){p=y+4|0;x=c[p>>2]|0;c[p>>2]=x+-1;if(x|0)break;Ja[c[(c[y>>2]|0)+8>>2]&255](y);ei(y)}while(0);y=c[F>>2]|0;F=c[c[y>>2]>>2]|0;c[A>>2]=c[u>>2];u=A+4|0;x=c[H>>2]|0;c[u>>2]=x;if(x|0){p=x+4|0;c[p>>2]=(c[p>>2]|0)+1}Na[F&3](y,B,A);A=c[u>>2]|0;do if(A|0){u=A+4|0;B=c[u>>2]|0;c[u>>2]=B+-1;if(B|0)break;Ja[c[(c[A>>2]|0)+8>>2]&255](A);ei(A)}while(0);A=c[i>>2]|0;do if(A|0){i=A+4|0;B=c[i>>2]|0;c[i>>2]=B+-1;if(B|0)break;Ja[c[(c[A>>2]|0)+8>>2]&255](A);ei(A)}while(0);A=c[L>>2]|0;do if(A|0){L=A+4|0;B=c[L>>2]|0;c[L>>2]=B+-1;if(B|0)break;Ja[c[(c[A>>2]|0)+8>>2]&255](A);ei(A)}while(0);A=c[n>>2]|0;do if(A|0){n=A+4|0;B=c[n>>2]|0;c[n>>2]=B+-1;if(B|0)break;Ja[c[(c[A>>2]|0)+8>>2]&255](A);ei(A)}while(0);A=c[G>>2]|0;do if(A|0){G=A+4|0;B=c[G>>2]|0;c[G>>2]=B+-1;if(B|0)break;Ja[c[(c[A>>2]|0)+8>>2]&255](A);ei(A)}while(0);A=c[m>>2]|0;do if(A|0){m=A+4|0;B=c[m>>2]|0;c[m>>2]=B+-1;if(B|0)break;Ja[c[(c[A>>2]|0)+8>>2]&255](A);ei(A)}while(0);A=c[H>>2]|0;do if(A|0){H=A+4|0;B=c[H>>2]|0;c[H>>2]=B+-1;if(B|0)break;Ja[c[(c[A>>2]|0)+8>>2]&255](A);ei(A)}while(0);A=c[b>>2]|0;do if(A|0){b=A+4|0;B=c[b>>2]|0;c[b>>2]=B+-1;if(B|0)break;Ja[c[(c[A>>2]|0)+8>>2]&255](A);ei(A)}while(0);A=c[P>>2]|0;do if(A|0){P=A+4|0;B=c[P>>2]|0;c[P>>2]=B+-1;if(B|0)break;Ja[c[(c[A>>2]|0)+8>>2]&255](A);ei(A)}while(0);A=c[O>>2]|0;do if(A|0){O=A+4|0;B=c[O>>2]|0;c[O>>2]=B+-1;if(B|0)break;Ja[c[(c[A>>2]|0)+8>>2]&255](A);ei(A)}while(0);A=c[o>>2]|0;do if(A|0){o=A+4|0;B=c[o>>2]|0;c[o>>2]=B+-1;if(B|0)break;Ja[c[(c[A>>2]|0)+8>>2]&255](A);ei(A)}while(0);A=c[N>>2]|0;do if(A|0){N=A+4|0;B=c[N>>2]|0;c[N>>2]=B+-1;if(B|0)break;Ja[c[(c[A>>2]|0)+8>>2]&255](A);ei(A)}while(0);A=c[q>>2]|0;do if(A|0){q=A+4|0;B=c[q>>2]|0;c[q>>2]=B+-1;if(B|0)break;Ja[c[(c[A>>2]|0)+8>>2]&255](A);ei(A)}while(0);A=c[M>>2]|0;do if(A|0){M=A+4|0;B=c[M>>2]|0;c[M>>2]=B+-1;if(B|0)break;Ja[c[(c[A>>2]|0)+8>>2]&255](A);ei(A)}while(0);A=c[J>>2]|0;if(!A){Ca=d;return}J=A+4|0;B=c[J>>2]|0;c[J>>2]=B+-1;if(B|0){Ca=d;return}Ja[c[(c[A>>2]|0)+8>>2]&255](A);ei(A);Ca=d;return}function lb(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0;d=Ca;Ca=Ca+16|0;if((Ca|0)>=(Da|0))z(16);e=d;c[a>>2]=b;f=fi(16)|0;c[f+4>>2]=0;c[f+8>>2]=0;c[f>>2]=5764;c[f+12>>2]=b;c[a+4>>2]=f;c[e>>2]=b;c[e+4>>2]=b;Hg(a,e);Ca=d;return}function mb(a){a=a|0;aa(a|0)|0;Oi()}function nb(a,b,c){a=a|0;b=+b;c=c|0;return}function ob(a,b){a=a|0;b=b|0;return}function pb(a,b){a=a|0;b=b|0;return}function qb(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;d=a+4|0;e=c[a>>2]|0;f=(c[d>>2]|0)-e|0;g=(f|0)/48|0;h=g+1|0;if(h>>>0>89478485)qi(a);i=a+8|0;j=((c[i>>2]|0)-e|0)/48|0;k=j<<1;l=j>>>0<44739242?(k>>>0<h>>>0?h:k):89478485;do if(l)if(l>>>0>89478485){k=$(8)|0;ji(k,6713);c[k>>2]=6464;da(k|0,4040,146)}else{m=fi(l*48|0)|0;break}else m=0;while(0);k=m+(g*48|0)|0;g=m+(l*48|0)|0;l=k;m=b;b=l+48|0;do{c[l>>2]=c[m>>2];l=l+4|0;m=m+4|0}while((l|0)<(b|0));m=k+(((f|0)/-48|0)*48|0)|0;if((f|0)>0)rj(m|0,e|0,f|0)|0;c[a>>2]=m;c[d>>2]=k+48;c[i>>2]=g;if(!e)return;gi(e);return}function rb(b,e){b=b|0;e=e|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0.0,G=0.0,H=0,I=0,J=0,K=0;g=a[e+11>>0]|0;h=g<<24>>24<0;i=h?c[e>>2]|0:e;j=h?c[e+4>>2]|0:g&255;if(j>>>0>3){g=i;h=j;k=j;while(1){l=u(d[g>>0]|d[g+1>>0]<<8|d[g+2>>0]<<16|d[g+3>>0]<<24,1540483477)|0;h=(u(l>>>24^l,1540483477)|0)^(u(h,1540483477)|0);k=k+-4|0;if(k>>>0<=3)break;else g=g+4|0}g=j+-4|0;k=g&-4;m=g-k|0;n=i+(k+4)|0;o=h}else{m=j;n=i;o=j}switch(m|0){case 3:{p=d[n+2>>0]<<16^o;q=7;break}case 2:{p=o;q=7;break}case 1:{r=o;q=8;break}default:s=o}if((q|0)==7){r=d[n+1>>0]<<8^p;q=8}if((q|0)==8)s=u(r^d[n>>0],1540483477)|0;n=u(s>>>13^s,1540483477)|0;s=n>>>15^n;n=b+4|0;r=c[n>>2]|0;p=(r|0)==0;a:do if(!p){o=r+-1|0;m=(o&r|0)==0;if(!m)if(s>>>0<r>>>0)v=s;else v=(s>>>0)%(r>>>0)|0;else v=s&o;h=c[(c[b>>2]|0)+(v<<2)>>2]|0;if((h|0)!=0?(k=c[h>>2]|0,(k|0)!=0):0){h=(j|0)==0;if(m){if(h){m=k;while(1){g=c[m+4>>2]|0;if(!((g|0)==(s|0)|(g&o|0)==(v|0))){w=v;break a}g=a[m+8+11>>0]|0;if(!((g<<24>>24<0?c[m+12>>2]|0:g&255)|0)){x=m;break}m=c[m>>2]|0;if(!m){w=v;break a}}y=x+20|0;return y|0}m=k;b:while(1){g=c[m+4>>2]|0;if(!((g|0)==(s|0)|(g&o|0)==(v|0))){w=v;break a}g=m+8|0;l=a[g+11>>0]|0;z=l<<24>>24<0;A=l&255;do if(((z?c[m+12>>2]|0:A)|0)==(j|0)){l=c[g>>2]|0;if(z)if(!(Uh(l,i,j)|0)){x=m;q=68;break b}else break;if((a[i>>0]|0)==(l&255)<<24>>24){l=g;B=A;C=i;do{B=B+-1|0;l=l+1|0;if(!B){x=m;q=68;break b}C=C+1|0}while((a[l>>0]|0)==(a[C>>0]|0))}}while(0);m=c[m>>2]|0;if(!m){w=v;break a}}if((q|0)==68){y=x+20|0;return y|0}}if(h){m=k;while(1){o=c[m+4>>2]|0;if((o|0)!=(s|0)){if(o>>>0<r>>>0)D=o;else D=(o>>>0)%(r>>>0)|0;if((D|0)!=(v|0)){w=v;break a}}o=a[m+8+11>>0]|0;if(!((o<<24>>24<0?c[m+12>>2]|0:o&255)|0)){x=m;break}m=c[m>>2]|0;if(!m){w=v;break a}}y=x+20|0;return y|0}m=k;c:while(1){h=c[m+4>>2]|0;if((h|0)!=(s|0)){if(h>>>0<r>>>0)E=h;else E=(h>>>0)%(r>>>0)|0;if((E|0)!=(v|0)){w=v;break a}}h=m+8|0;o=a[h+11>>0]|0;A=o<<24>>24<0;g=o&255;do if(((A?c[m+12>>2]|0:g)|0)==(j|0)){o=c[h>>2]|0;if(A)if(!(Uh(o,i,j)|0)){x=m;q=68;break c}else break;if((a[i>>0]|0)==(o&255)<<24>>24){o=h;z=g;C=i;do{z=z+-1|0;o=o+1|0;if(!z){x=m;q=68;break c}C=C+1|0}while((a[o>>0]|0)==(a[C>>0]|0))}}while(0);m=c[m>>2]|0;if(!m){w=v;break a}}if((q|0)==68){y=x+20|0;return y|0}}else w=v}else w=0;while(0);v=fi(24)|0;mi(v+8|0,e);c[v+20>>2]=0;c[v+4>>2]=s;c[v>>2]=0;e=b+12|0;F=+(((c[e>>2]|0)+1|0)>>>0);G=+f[b+16>>2];do if(p|G*+(r>>>0)<F){i=r<<1|(r>>>0<3|(r+-1&r|0)!=0)&1;j=~~+t(+(F/G))>>>0;ub(b,i>>>0<j>>>0?j:i);i=c[n>>2]|0;j=i+-1|0;if(!(j&i)){H=i;I=j&s;break}if(s>>>0<i>>>0){H=i;I=s}else{H=i;I=(s>>>0)%(i>>>0)|0}}else{H=r;I=w}while(0);w=(c[b>>2]|0)+(I<<2)|0;I=c[w>>2]|0;if(!I){r=b+8|0;c[v>>2]=c[r>>2];c[r>>2]=v;c[w>>2]=r;r=c[v>>2]|0;if(r|0){w=c[r+4>>2]|0;r=H+-1|0;if(r&H)if(w>>>0<H>>>0)J=w;else J=(w>>>0)%(H>>>0)|0;else J=w&r;K=(c[b>>2]|0)+(J<<2)|0;q=66}}else{c[v>>2]=c[I>>2];K=I;q=66}if((q|0)==66)c[K>>2]=v;c[e>>2]=(c[e>>2]|0)+1;x=v;y=x+20|0;return y|0}function sb(b,e){b=b|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,v=0,w=0;f=a[e+11>>0]|0;g=f<<24>>24<0;h=g?c[e>>2]|0:e;i=g?c[e+4>>2]|0:f&255;if(i>>>0>3){f=h;e=i;g=i;while(1){j=u(d[f>>0]|d[f+1>>0]<<8|d[f+2>>0]<<16|d[f+3>>0]<<24,1540483477)|0;e=(u(j>>>24^j,1540483477)|0)^(u(e,1540483477)|0);g=g+-4|0;if(g>>>0<=3)break;else f=f+4|0}f=i+-4|0;g=f&-4;k=f-g|0;l=h+(g+4)|0;m=e}else{k=i;l=h;m=i}switch(k|0){case 3:{n=d[l+2>>0]<<16^m;o=7;break}case 2:{n=m;o=7;break}case 1:{p=m;o=8;break}default:q=m}if((o|0)==7){p=d[l+1>>0]<<8^n;o=8}if((o|0)==8)q=u(p^d[l>>0],1540483477)|0;l=u(q>>>13^q,1540483477)|0;q=l>>>15^l;l=c[b+4>>2]|0;if(!l){r=0;return r|0}p=l+-1|0;n=(p&l|0)==0;if(!n)if(q>>>0<l>>>0)s=q;else s=(q>>>0)%(l>>>0)|0;else s=q&p;m=c[(c[b>>2]|0)+(s<<2)>>2]|0;if(!m){r=0;return r|0}b=c[m>>2]|0;if(!b){r=0;return r|0}m=(i|0)==0;if(n){n=b;a:while(1){k=c[n+4>>2]|0;e=(k|0)==(q|0);if(!(e|(k&p|0)==(s|0))){r=0;o=45;break}do if(e?(k=n+8|0,g=a[k+11>>0]|0,f=g<<24>>24<0,j=g&255,((f?c[n+12>>2]|0:j)|0)==(i|0)):0){g=c[k>>2]|0;t=f?g:k;v=g&255;if(f){if(m){r=n;o=45;break a}if(!(Uh(t,h,i)|0)){r=n;o=45;break a}else break}if(m){r=n;o=45;break a}if((a[h>>0]|0)==v<<24>>24){v=k;k=j;j=h;do{k=k+-1|0;v=v+1|0;if(!k){r=n;o=45;break a}j=j+1|0}while((a[v>>0]|0)==(a[j>>0]|0))}}while(0);n=c[n>>2]|0;if(!n){r=0;o=45;break}}if((o|0)==45)return r|0}n=b;b:while(1){b=c[n+4>>2]|0;do if((b|0)==(q|0)){p=n+8|0;e=a[p+11>>0]|0;j=e<<24>>24<0;v=e&255;if(((j?c[n+12>>2]|0:v)|0)==(i|0)){e=c[p>>2]|0;k=j?e:p;t=e&255;if(j){if(m){r=n;o=45;break b}if(!(Uh(k,h,i)|0)){r=n;o=45;break b}else break}if(m){r=n;o=45;break b}if((a[h>>0]|0)==t<<24>>24){t=p;p=v;v=h;do{p=p+-1|0;t=t+1|0;if(!p){r=n;o=45;break b}v=v+1|0}while((a[t>>0]|0)==(a[v>>0]|0))}}}else{if(b>>>0<l>>>0)w=b;else w=(b>>>0)%(l>>>0)|0;if((w|0)!=(s|0)){r=0;o=45;break b}}while(0);n=c[n>>2]|0;if(!n){r=0;o=45;break}}if((o|0)==45)return r|0;return 0}function tb(b,d){b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0;e=b+4|0;f=c[b>>2]|0;g=((c[e>>2]|0)-f|0)/12|0;h=g+1|0;if(h>>>0>357913941)qi(b);i=b+8|0;j=((c[i>>2]|0)-f|0)/12|0;f=j<<1;k=j>>>0<178956970?(f>>>0<h>>>0?h:f):357913941;do if(k)if(k>>>0>357913941){f=$(8)|0;ji(f,6713);c[f>>2]=6464;da(f|0,4040,146)}else{l=fi(k*12|0)|0;break}else l=0;while(0);f=l+(g*12|0)|0;g=l+(k*12|0)|0;mi(f,d);d=f+12|0;k=c[b>>2]|0;l=c[e>>2]|0;if((l|0)==(k|0)){m=f;n=k;o=k}else{h=l;l=f;do{l=l+-12|0;h=h+-12|0;c[l>>2]=c[h>>2];c[l+4>>2]=c[h+4>>2];c[l+8>>2]=c[h+8>>2];c[h>>2]=0;c[h+4>>2]=0;c[h+8>>2]=0}while((h|0)!=(k|0));m=l;n=c[b>>2]|0;o=c[e>>2]|0}c[b>>2]=m;c[e>>2]=d;c[i>>2]=g;g=n;if((o|0)!=(g|0)){i=o;do{i=i+-12|0;if((a[i+11>>0]|0)<0)gi(c[i>>2]|0)}while((i|0)!=(g|0))}if(!n)return;gi(n);return}function ub(a,b){a=a|0;b=b|0;var d=0,e=0,g=0,h=0;if((b|0)!=1)if(!(b+-1&b))d=b;else d=bi(b)|0;else d=2;b=c[a+4>>2]|0;if(d>>>0>b>>>0){vb(a,d);return}if(d>>>0>=b>>>0)return;e=~~+t(+(+((c[a+12>>2]|0)>>>0)/+f[a+16>>2]))>>>0;if(b>>>0>2&(b+-1&b|0)==0){g=1<<32-(v(e+-1|0)|0);h=e>>>0<2?e:g}else h=bi(e)|0;e=d>>>0<h>>>0?h:d;if(e>>>0>=b>>>0)return;vb(a,e);return}function vb(b,d){b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0;e=b+4|0;if(!d){f=c[b>>2]|0;c[b>>2]=0;if(f|0)gi(f);c[e>>2]=0;return}if(d>>>0>1073741823){f=$(8)|0;ji(f,6713);c[f>>2]=6464;da(f|0,4040,146)}f=fi(d<<2)|0;g=c[b>>2]|0;c[b>>2]=f;if(g|0)gi(g);c[e>>2]=d;e=0;do{c[(c[b>>2]|0)+(e<<2)>>2]=0;e=e+1|0}while((e|0)!=(d|0));e=b+8|0;g=c[e>>2]|0;if(!g)return;f=c[g+4>>2]|0;h=d+-1|0;i=(h&d|0)==0;if(!i)if(f>>>0<d>>>0)j=f;else j=(f>>>0)%(d>>>0)|0;else j=f&h;c[(c[b>>2]|0)+(j<<2)>>2]=e;e=c[g>>2]|0;if(!e)return;f=j;j=e;e=g;while(1){g=c[j+4>>2]|0;if(!i)if(g>>>0<d>>>0)k=g;else k=(g>>>0)%(d>>>0)|0;else k=g&h;do if((k|0)==(f|0)){l=f;m=j}else{g=(c[b>>2]|0)+(k<<2)|0;if(!(c[g>>2]|0)){c[g>>2]=e;l=k;m=j;break}g=c[j>>2]|0;a:do if(!g)n=j;else{o=j+8|0;p=a[o+11>>0]|0;q=p<<24>>24<0;r=p&255;p=q?c[j+12>>2]|0:r;s=(p|0)==0;if(q){q=j;t=g;while(1){u=t+8|0;v=a[u+11>>0]|0;w=v<<24>>24<0;if((p|0)!=((w?c[t+12>>2]|0:v&255)|0)){n=q;break a}if(!s?Uh(c[o>>2]|0,w?c[u>>2]|0:u,p)|0:0){n=q;break a}u=c[t>>2]|0;if(!u){n=t;break a}else{w=t;t=u;q=w}}}if(s){q=j;t=g;while(1){w=a[t+8+11>>0]|0;if((w<<24>>24<0?c[t+12>>2]|0:w&255)|0){n=q;break a}w=c[t>>2]|0;if(!w){n=t;break a}else{u=t;t=w;q=u}}}q=j;t=g;while(1){s=t+8|0;u=a[s+11>>0]|0;w=u<<24>>24<0;if((p|0)!=((w?c[t+12>>2]|0:u&255)|0)){n=q;break a}u=w?c[s>>2]|0:s;if((a[u>>0]|0)!=(c[o>>2]&255)<<24>>24){n=q;break a}s=o;w=r;v=u;while(1){w=w+-1|0;s=s+1|0;if(!w)break;v=v+1|0;if((a[s>>0]|0)!=(a[v>>0]|0)){n=q;break a}}v=c[t>>2]|0;if(!v){n=t;break}else{s=t;t=v;q=s}}}while(0);c[e>>2]=c[n>>2];c[n>>2]=c[c[(c[b>>2]|0)+(k<<2)>>2]>>2];c[c[(c[b>>2]|0)+(k<<2)>>2]>>2]=j;l=f;m=e}while(0);j=c[m>>2]|0;if(!j)break;else{f=l;e=m}}return}function wb(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;d=a+4|0;e=c[a>>2]|0;f=(c[d>>2]|0)-e|0;g=(f|0)/48|0;h=g+1|0;if(h>>>0>89478485)qi(a);i=a+8|0;j=((c[i>>2]|0)-e|0)/48|0;k=j<<1;l=j>>>0<44739242?(k>>>0<h>>>0?h:k):89478485;do if(l)if(l>>>0>89478485){k=$(8)|0;ji(k,6713);c[k>>2]=6464;da(k|0,4040,146)}else{m=fi(l*48|0)|0;break}else m=0;while(0);k=m+(g*48|0)|0;g=m+(l*48|0)|0;l=k;m=b;b=l+48|0;do{c[l>>2]=c[m>>2];l=l+4|0;m=m+4|0}while((l|0)<(b|0));m=k+(((f|0)/-48|0)*48|0)|0;if((f|0)>0)rj(m|0,e|0,f|0)|0;c[a>>2]=m;c[d>>2]=k+48;c[i>>2]=g;if(!e)return;gi(e);return}function xb(d,e){d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0;f=Ca;Ca=Ca+48|0;if((Ca|0)>=(Da|0))z(48);g=f;c[d>>2]=4172;h=d+4|0;i=e+4|0;j=c[i>>2]|0;k=(j-(c[e>>2]|0)|0)/48|0;l=d+8|0;c[d+80>>2]=0;a[d+88>>0]=0;a[d+89>>0]=0;c[d+112>>2]=0;c[d+136>>2]=0;c[d+160>>2]=0;m=d+168|0;d=l;n=d+52|0;do{c[d>>2]=0;d=d+4|0}while((d|0)<(n|0));b[l+52>>1]=0;c[m>>2]=0;c[m+4>>2]=0;c[m+8>>2]=0;c[m+12>>2]=0;c[m+16>>2]=0;c[h>>2]=k;d=g;n=d+40|0;do{c[d>>2]=0;d=d+4|0}while((d|0)<(n|0));c[g+44>>2]=1;c[g+32>>2]=k;c[g+40>>2]=1;if((c[e+8>>2]|0)>>>0>j>>>0){d=j;j=g;n=d+48|0;do{c[d>>2]=c[j>>2];d=d+4|0;j=j+4|0}while((d|0)<(n|0));j=(c[i>>2]|0)+48|0;c[i>>2]=j;o=j;p=c[e>>2]|0;q=o-p|0;r=(q|0)/48|0;s=r+-1|0;t=c[h>>2]|0;u=p;v=u+(t*48|0)+36|0;c[v>>2]=s;Ca=f;return}else{qb(e,g);o=c[i>>2]|0;p=c[e>>2]|0;q=o-p|0;r=(q|0)/48|0;s=r+-1|0;t=c[h>>2]|0;u=p;v=u+(t*48|0)+36|0;c[v>>2]=s;Ca=f;return}}function yb(b,d,e,g,h){b=b|0;d=d|0;e=e|0;g=g|0;h=+h;var i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,A=0,B=0,C=0;i=Ca;Ca=Ca+48|0;if((Ca|0)>=(Da|0))z(48);j=i;xb(b,d);c[b>>2]=4268;k=j+8|0;l=k+36|0;do{c[k>>2]=0;k=k+4|0}while((k|0)<(l|0));c[j+44>>2]=6;c[j>>2]=0;c[j+4>>2]=0;f[j+24>>2]=h;c[j+32>>2]=g;if(!(sb(15252,e)|0)){g=c[3811]|0;m=(g-(c[3810]|0)|0)/12|0;n=g;if((c[3812]|0)==(n|0))tb(15240,e);else{mi(n,e);c[3811]=(c[3811]|0)+12}c[(rb(15252,e)|0)>>2]=m}c[j+36>>2]=c[(rb(15252,e)|0)>>2];f[j+16>>2]=+S(((a[e+11>>0]|0)<0?c[e>>2]|0:e)|0,+h);f[j+20>>2]=h;e=d+4|0;m=c[e>>2]|0;n=c[d>>2]|0;g=b+4|0;c[n+((c[g>>2]|0)*48|0)+36>>2]=(m-n|0)/48|0;if((c[d+8>>2]|0)==(m|0)){wb(d,j);o=j+16|0;p=c[g>>2]|0;q=c[d>>2]|0;r=q+(p*48|0)+24|0;s=o;t=s;u=c[t>>2]|0;v=s+4|0;w=v;x=c[w>>2]|0;y=r;A=y;c[A>>2]=u;B=y+4|0;C=B;c[C>>2]=x;Ca=i;return}else{k=m;m=j;l=k+48|0;do{c[k>>2]=c[m>>2];k=k+4|0;m=m+4|0}while((k|0)<(l|0));c[e>>2]=(c[e>>2]|0)+48;o=j+16|0;p=c[g>>2]|0;q=c[d>>2]|0;r=q+(p*48|0)+24|0;s=o;t=s;u=c[t>>2]|0;v=s+4|0;w=v;x=c[w>>2]|0;y=r;A=y;c[A>>2]=u;B=y+4|0;C=B;c[C>>2]=x;Ca=i;return}}function zb(b,d,e,f){b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0;g=Ca;Ca=Ca+32|0;if((Ca|0)>=(Da|0))z(32);h=g;i=b+96|0;j=c[d+16>>2]|0;do if(j)if((d|0)==(j|0)){k=h+16|0;c[k>>2]=h;La[c[(c[j>>2]|0)+12>>2]&31](j,h);l=k;break}else{k=h+16|0;c[k>>2]=Fa[c[(c[j>>2]|0)+8>>2]&63](j)|0;l=k;break}else{k=h+16|0;c[k>>2]=0;l=k}while(0);_b(h,i);i=c[l>>2]|0;if((h|0)!=(i|0)){if(i|0)Ja[c[(c[i>>2]|0)+20>>2]&255](i)}else Ja[c[(c[i>>2]|0)+16>>2]&255](i);i=b+120|0;l=c[e+16>>2]|0;do if(l)if((e|0)==(l|0)){j=h+16|0;c[j>>2]=h;La[c[(c[l>>2]|0)+12>>2]&31](l,h);m=j;break}else{j=h+16|0;c[j>>2]=Fa[c[(c[l>>2]|0)+8>>2]&63](l)|0;m=j;break}else{j=h+16|0;c[j>>2]=0;m=j}while(0);_b(h,i);i=c[m>>2]|0;if((h|0)!=(i|0)){if(i|0)Ja[c[(c[i>>2]|0)+20>>2]&255](i)}else Ja[c[(c[i>>2]|0)+16>>2]&255](i);i=b+144|0;m=c[f+16>>2]|0;do if(m)if((f|0)==(m|0)){l=h+16|0;c[l>>2]=h;La[c[(c[m>>2]|0)+12>>2]&31](m,h);n=l;break}else{l=h+16|0;c[l>>2]=Fa[c[(c[m>>2]|0)+8>>2]&63](m)|0;n=l;break}else{l=h+16|0;c[l>>2]=0;n=l}while(0);$b(h,i);i=c[n>>2]|0;if((h|0)==(i|0)){Ja[c[(c[i>>2]|0)+16>>2]&255](i);o=b+88|0;a[o>>0]=1;Ca=g;return}if(!i){o=b+88|0;a[o>>0]=1;Ca=g;return}Ja[c[(c[i>>2]|0)+20>>2]&255](i);o=b+88|0;a[o>>0]=1;Ca=g;return}function Ab(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0;e=c[d>>2]|0;f=c[b>>2]|0;c[f+((c[a+4>>2]|0)*48|0)+36>>2]=c[f+((c[e+4>>2]|0)*48|0)+36>>2];f=a+180|0;b=c[f>>2]|0;if((b|0)==(c[a+184>>2]|0)){Db(a+176|0,d);return}c[b>>2]=e;e=c[d+4>>2]|0;c[b+4>>2]=e;if(!e)g=b;else{b=e+4|0;c[b>>2]=(c[b>>2]|0)+1;g=c[f>>2]|0}c[f>>2]=g+8;return}function Bb(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;Eb(a,b,c,d);Fb(a,b);return}function Cb(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;return}function Db(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0;d=a+4|0;e=c[d>>2]|0;f=c[a>>2]|0;g=e-f>>3;h=g+1|0;i=f;j=e;if(h>>>0>536870911)qi(a);e=a+8|0;k=(c[e>>2]|0)-f|0;f=k>>2;l=k>>3>>>0<268435455?(f>>>0<h>>>0?h:f):536870911;do if(l)if(l>>>0>536870911){f=$(8)|0;ji(f,6713);c[f>>2]=6464;da(f|0,4040,146)}else{m=fi(l<<3)|0;break}else m=0;while(0);f=m+(g<<3)|0;h=m+(l<<3)|0;c[f>>2]=c[b>>2];l=c[b+4>>2]|0;c[m+(g<<3)+4>>2]=l;if(!l){n=i;o=j}else{j=l+4|0;c[j>>2]=(c[j>>2]|0)+1;n=c[a>>2]|0;o=c[d>>2]|0}j=f+8|0;l=n;if((o|0)==(n|0)){p=f;q=l;r=o}else{i=g+-1-((o+-8-l|0)>>>3)|0;l=o;o=f;do{f=o;o=o+-8|0;g=l;l=l+-8|0;c[o>>2]=c[l>>2];b=g+-4|0;c[f+-4>>2]=c[b>>2];c[l>>2]=0;c[b>>2]=0}while((l|0)!=(n|0));p=m+(i<<3)|0;q=c[a>>2]|0;r=c[d>>2]|0}c[a>>2]=p;c[d>>2]=j;c[e>>2]=h;h=q;if((r|0)!=(h|0)){e=r;do{r=c[e+-4>>2]|0;e=e+-8|0;if(r|0?(j=r+4|0,d=c[j>>2]|0,c[j>>2]=d+-1,(d|0)==0):0){Ja[c[(c[r>>2]|0)+8>>2]&255](r);ei(r)}}while((e|0)!=(h|0))}if(!q)return;gi(q);return}function Eb(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var h=0,i=0,j=0,k=0,l=0,m=0.0,n=0.0,o=0,p=0,q=0.0,r=0.0,s=0.0,t=0.0;h=Ca;Ca=Ca+48|0;if((Ca|0)>=(Da|0))z(48);i=h;j=d;k=c[j+4>>2]|0;l=a+40|0;c[l>>2]=c[j>>2];c[l+4>>2]=k;k=e;l=c[k+4>>2]|0;j=a+32|0;c[j>>2]=c[k>>2];c[j+4>>2]=l;l=c[a+4>>2]|0;j=c[b>>2]|0;b=j+(l*48|0)+24|0;m=+f[j+(l*48|0)+8>>2]*+f[e>>2]+ +f[b>>2];k=e+4|0;n=+f[j+(l*48|0)+12>>2]*+f[k>>2]+ +f[j+(l*48|0)+28>>2];f[a+24>>2]=m;o=a+28|0;f[o>>2]=n;p=a+52|0;do if((c[p>>2]|0)==1){q=+f[a+48>>2];r=n*q;if(r<m){f[a+24>>2]=r;s=r;t=n;break}else{r=m/q;f[o>>2]=r;s=m;t=r;break}}else{s=m;t=n}while(0);n=+f[d>>2];m=+f[j+(l*48|0)>>2];r=+f[j+(l*48|0)+16>>2]+(n+ +f[e>>2]*m-+f[a+8>>2]*s);q=+f[j+(l*48|0)+20>>2]+(+f[d+4>>2]+ +f[k>>2]*+f[j+(l*48|0)+4>>2]-+f[a+12>>2]*t);t=+f[b>>2];g[i>>3]=r;g[i+8>>3]=n;g[i+16>>3]=m;g[i+24>>3]=s;g[i+32>>3]=t;Vh(6884,i)|0;f[a+16>>2]=r;f[a+20>>2]=q;if((c[p>>2]|0)!=1){Ca=h;return}q=+f[a+48>>2];r=+f[o>>2]*q;p=a+24|0;t=+f[p>>2];if(r<t){f[p>>2]=r;Ca=h;return}else{f[o>>2]=t/q;Ca=h;return}}function Fb(a,b){a=a|0;b=b|0;var d=0,e=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0;d=Ca;Ca=Ca+16|0;if((Ca|0)>=(Da|0))z(16);e=d;g=a+16|0;h=g;i=c[h+4>>2]|0;j=e;c[j>>2]=c[h>>2];c[j+4>>2]=i;i=c[a+176>>2]|0;j=c[a+180>>2]|0;if((i|0)==(j|0)){Ca=d;return}h=a+56|0;k=a+24|0;a=e+4|0;l=i;do{i=c[l>>2]|0;m=c[l+4>>2]|0;n=(m|0)==0;if(!n){o=m+4|0;c[o>>2]=(c[o>>2]|0)+1}o=c[h>>2]|0;do if((o|0)!=2){p=i;q=c[(c[i>>2]|0)+4>>2]|0;if((o|0)==1){Oa[q&31](p,b,e,k);f[e>>2]=+f[p+16>>2]+ +f[p+24>>2];break}else{Oa[q&31](p,b,g,k);break}}else{p=i;Oa[c[(c[i>>2]|0)+4>>2]&31](p,b,e,k);f[a>>2]=+f[p+20>>2]+ +f[p+28>>2]}while(0);if(!n?(i=m+4|0,o=c[i>>2]|0,c[i>>2]=o+-1,(o|0)==0):0){Ja[c[(c[m>>2]|0)+8>>2]&255](m);ei(m)}l=l+8|0}while((l|0)!=(j|0));Ca=d;return}function Gb(a,b){a=a|0;b=b|0;return}function Hb(a){a=a|0;di(a);gi(a);return}function Ib(a){a=a|0;var b=0;b=c[a+12>>2]|0;if(!b)return;Zb(b);gi(b);return}function Jb(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==7029?a+12|0:0)|0}function Kb(a){a=a|0;gi(a);return}function Lb(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0;f=Ca;Ca=Ca+16|0;if((Ca|0)>=(Da|0))z(16);g=f+8|0;h=f;i=a+24|0;j=c[i+4>>2]|0;k=g;c[k>>2]=c[i>>2];c[k+4>>2]=j;j=a+16|0;k=c[j+4>>2]|0;i=h;c[i>>2]=c[j>>2];c[i+4>>2]=k;Eb(a,b,d,e);Oa[c[(c[a>>2]|0)+8>>2]&31](a,b,h,g);Fb(a,b);Ca=f;return}function Mb(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0;e=c[b>>2]|0;b=(c[e+((c[a+4>>2]|0)*48|0)+32>>2]|0)+1|0;d=a+16|0;f=c[d+4>>2]|0;g=e+(b*48|0)|0;c[g>>2]=c[d>>2];c[g+4>>2]=f;f=a+24|0;a=c[f+4>>2]|0;g=e+(b*48|0)+16|0;c[g>>2]=c[f>>2];c[g+4>>2]=a;return}function Nb(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0;f=Ca;Ca=Ca+16|0;if((Ca|0)>=(Da|0))z(16);g=f+8|0;h=f;i=a+24|0;j=c[i+4>>2]|0;k=g;c[k>>2]=c[i>>2];c[k+4>>2]=j;j=a+16|0;k=c[j+4>>2]|0;i=h;c[i>>2]=c[j>>2];c[i+4>>2]=k;Eb(a,b,d,e);Oa[c[(c[a>>2]|0)+8>>2]&31](a,b,h,g);Fb(a,b);Ca=f;return}function Ob(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0.0,r=0;g=a+4|0;h=c[g>>2]|0;i=c[b>>2]|0;j=(c[i+(h*48|0)+32>>2]|0)+1|0;if(j>>>0>(c[i+(h*48|0)+36>>2]|0)>>>0)return;h=d+4|0;k=e+4|0;l=a+16|0;m=a+24|0;n=a+20|0;o=a+28|0;a=j;j=i;while(1){if(((c[j+(a*48|0)+44>>2]|0)+-2|0)>>>0<5){i=j+(a*48|0)|0;p=j+(a*48|0)+4|0;q=+f[n>>2]+(+f[p>>2]-+f[h>>2])/+f[k>>2]*+f[o>>2];f[i>>2]=+f[l>>2]+(+f[i>>2]-+f[d>>2])/+f[e>>2]*+f[m>>2];f[p>>2]=q;p=c[b>>2]|0;if((c[p+(a*48|0)+44>>2]|0)==6)r=p;else{p=j+(a*48|0)+16|0;i=j+(a*48|0)+20|0;q=+f[i>>2]/+f[k>>2]*+f[o>>2];f[p>>2]=+f[p>>2]/+f[e>>2]*+f[m>>2];f[i>>2]=q;r=c[b>>2]|0}}else r=j;a=a+1|0;if(a>>>0>(c[r+((c[g>>2]|0)*48|0)+36>>2]|0)>>>0)break;else j=r}return}function Pb(a){a=a|0;di(a);gi(a);return}function Qb(a){a=a|0;var b=0;b=c[a+12>>2]|0;if(!b)return;Zb(b);gi(b);return}function Rb(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==7201?a+12|0:0)|0}function Sb(a){a=a|0;gi(a);return}function Tb(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0;f=Ca;Ca=Ca+16|0;if((Ca|0)>=(Da|0))z(16);g=f+8|0;h=f;i=a+24|0;j=c[i+4>>2]|0;k=g;c[k>>2]=c[i>>2];c[k+4>>2]=j;j=a+16|0;k=c[j+4>>2]|0;i=h;c[i>>2]=c[j>>2];c[i+4>>2]=k;Eb(a,b,d,e);Oa[c[(c[a>>2]|0)+8>>2]&31](a,b,h,g);Fb(a,b);Ca=f;return}function Ub(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0;e=c[b>>2]|0;b=a+16|0;d=c[b+4>>2]|0;f=e+(((c[e+((c[a+4>>2]|0)*48|0)+32>>2]|0)+1|0)*48|0)|0;c[f>>2]=c[b>>2];c[f+4>>2]=d;return}function Vb(a){a=a|0;di(a);gi(a);return}function Wb(a){a=a|0;var b=0;b=c[a+12>>2]|0;if(!b)return;Zb(b);gi(b);return}function Xb(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==7357?a+12|0:0)|0}function Yb(a){a=a|0;gi(a);return}function Zb(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0;c[a>>2]=4172;b=a+176|0;d=c[b>>2]|0;if(d|0){e=a+180|0;f=c[e>>2]|0;if((f|0)==(d|0))g=d;else{h=f;do{f=c[h+-4>>2]|0;h=h+-8|0;if(f|0?(i=f+4|0,j=c[i>>2]|0,c[i>>2]=j+-1,(j|0)==0):0){Ja[c[(c[f>>2]|0)+8>>2]&255](f);ei(f)}}while((h|0)!=(d|0));g=c[b>>2]|0}c[e>>2]=d;gi(g)}g=c[a+172>>2]|0;if(g|0?(d=g+4|0,e=c[d>>2]|0,c[d>>2]=e+-1,(e|0)==0):0){Ja[c[(c[g>>2]|0)+8>>2]&255](g);ei(g)}g=c[a+160>>2]|0;if((a+144|0)!=(g|0)){if(g|0)Ja[c[(c[g>>2]|0)+20>>2]&255](g)}else Ja[c[(c[g>>2]|0)+16>>2]&255](g);g=c[a+136>>2]|0;if((a+120|0)!=(g|0)){if(g|0)Ja[c[(c[g>>2]|0)+20>>2]&255](g)}else Ja[c[(c[g>>2]|0)+16>>2]&255](g);g=c[a+112>>2]|0;if((a+96|0)!=(g|0)){if(g|0)Ja[c[(c[g>>2]|0)+20>>2]&255](g)}else Ja[c[(c[g>>2]|0)+16>>2]&255](g);g=c[a+80>>2]|0;if((a+64|0)==(g|0)){Ja[c[(c[g>>2]|0)+16>>2]&255](g);return}if(!g)return;Ja[c[(c[g>>2]|0)+20>>2]&255](g);return}function _b(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0;d=Ca;Ca=Ca+16|0;if((Ca|0)>=(Da|0))z(16);e=d;if((b|0)==(a|0)){Ca=d;return}f=a+16|0;g=c[f>>2]|0;h=g;i=b+16|0;if((g|0)==(a|0))if((c[i>>2]|0)==(b|0)){La[c[(c[g>>2]|0)+12>>2]&31](g,e);j=c[f>>2]|0;Ja[c[(c[j>>2]|0)+16>>2]&255](j);c[f>>2]=0;j=c[i>>2]|0;La[c[(c[j>>2]|0)+12>>2]&31](j,a);j=c[i>>2]|0;Ja[c[(c[j>>2]|0)+16>>2]&255](j);c[i>>2]=0;c[f>>2]=a;La[c[(c[e>>2]|0)+12>>2]&31](e,b);Ja[c[(c[e>>2]|0)+16>>2]&255](e);c[i>>2]=b;Ca=d;return}else{La[c[(c[g>>2]|0)+12>>2]&31](g,b);g=c[f>>2]|0;Ja[c[(c[g>>2]|0)+16>>2]&255](g);g=b+16|0;c[f>>2]=c[g>>2];c[g>>2]=b;Ca=d;return}else{g=c[i>>2]|0;if((b|0)==(g|0)){La[c[(c[g>>2]|0)+12>>2]&31](g,a);b=c[i>>2]|0;Ja[c[(c[b>>2]|0)+16>>2]&255](b);c[i>>2]=c[f>>2];c[f>>2]=a;Ca=d;return}else{c[f>>2]=g;c[i>>2]=h;Ca=d;return}}}function $b(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0;d=Ca;Ca=Ca+16|0;if((Ca|0)>=(Da|0))z(16);e=d;if((b|0)==(a|0)){Ca=d;return}f=a+16|0;g=c[f>>2]|0;h=g;i=b+16|0;if((g|0)==(a|0))if((c[i>>2]|0)==(b|0)){La[c[(c[g>>2]|0)+12>>2]&31](g,e);j=c[f>>2]|0;Ja[c[(c[j>>2]|0)+16>>2]&255](j);c[f>>2]=0;j=c[i>>2]|0;La[c[(c[j>>2]|0)+12>>2]&31](j,a);j=c[i>>2]|0;Ja[c[(c[j>>2]|0)+16>>2]&255](j);c[i>>2]=0;c[f>>2]=a;La[c[(c[e>>2]|0)+12>>2]&31](e,b);Ja[c[(c[e>>2]|0)+16>>2]&255](e);c[i>>2]=b;Ca=d;return}else{La[c[(c[g>>2]|0)+12>>2]&31](g,b);g=c[f>>2]|0;Ja[c[(c[g>>2]|0)+16>>2]&255](g);g=b+16|0;c[f>>2]=c[g>>2];c[g>>2]=b;Ca=d;return}else{g=c[i>>2]|0;if((b|0)==(g|0)){La[c[(c[g>>2]|0)+12>>2]&31](g,a);b=c[i>>2]|0;Ja[c[(c[b>>2]|0)+16>>2]&255](b);c[i>>2]=c[f>>2];c[f>>2]=a;Ca=d;return}else{c[f>>2]=g;c[i>>2]=h;Ca=d;return}}}function ac(a){a=a|0;var b=0,d=0;c[a>>2]=4316;b=c[a+12>>2]|0;if(!b)return;a=b+4|0;d=c[a>>2]|0;c[a>>2]=d+-1;if(d|0)return;Ja[c[(c[b>>2]|0)+8>>2]&255](b);ei(b);return}function bc(a){a=a|0;var b=0,d=0,e=0;c[a>>2]=4316;b=c[a+12>>2]|0;if(!b){gi(a);return}d=b+4|0;e=c[d>>2]|0;c[d>>2]=e+-1;if(e|0){gi(a);return}Ja[c[(c[b>>2]|0)+8>>2]&255](b);ei(b);gi(a);return}function cc(a){a=a|0;var b=0,d=0;b=fi(16)|0;c[b>>2]=4316;c[b+4>>2]=c[a+4>>2];c[b+8>>2]=c[a+8>>2];d=c[a+12>>2]|0;c[b+12>>2]=d;if(!d)return b|0;a=d+4|0;c[a>>2]=(c[a>>2]|0)+1;return b|0}function dc(a,b){a=a|0;b=b|0;var d=0;c[b>>2]=4316;c[b+4>>2]=c[a+4>>2];c[b+8>>2]=c[a+8>>2];d=c[a+12>>2]|0;c[b+12>>2]=d;if(!d)return;b=d+4|0;c[b>>2]=(c[b>>2]|0)+1;return}function ec(a){a=a|0;var b=0,d=0;b=c[a+12>>2]|0;if(!b)return;a=b+4|0;d=c[a>>2]|0;c[a>>2]=d+-1;if(d|0)return;Ja[c[(c[b>>2]|0)+8>>2]&255](b);ei(b);return}function fc(a){a=a|0;var b=0,d=0,e=0;b=c[a+12>>2]|0;if(!b){gi(a);return}d=b+4|0;e=c[d>>2]|0;c[d>>2]=e+-1;if(e|0){gi(a);return}Ja[c[(c[b>>2]|0)+8>>2]&255](b);ei(b);gi(a);return}function gc(a,b){a=a|0;b=b|0;var d=0,e=0,h=0,i=0,j=0.0,k=0.0;b=Ca;Ca=Ca+16|0;if((Ca|0)>=(Da|0))z(16);d=b;e=a+8|0;h=(c[a+4>>2]|0)+4|0;a=c[(c[e>>2]|0)+4>>2]|0;i=c[h>>2]|0;j=+f[i+(a*48|0)+24>>2]+5.0;k=+f[i+(a*48|0)+28>>2]+5.0;g[d>>3]=j;g[d+8>>3]=k;Vh(7533,d)|0;d=c[(c[e>>2]|0)+4>>2]|0;a=c[h>>2]|0;f[a+(d*48|0)+24>>2]=j;f[a+(d*48|0)+28>>2]=k;d=c[e>>2]|0;Oa[c[(c[d>>2]|0)+4>>2]&31](d,h,d+40|0,d+32|0);Ca=b;return}function hc(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==7553?a+4|0:0)|0}function ic(a){a=a|0;return 2952}function jc(a){a=a|0;return}function kc(a,b,d,e,g){a=a|0;b=b|0;d=d|0;e=e|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0.0,s=0,t=0,u=0,v=0,w=0,x=0.0;h=Ca;Ca=Ca+48|0;if((Ca|0)>=(Da|0))z(48);i=h;xb(a,b);c[a>>2]=4468;j=d;k=c[j>>2]|0;l=c[j+4>>2]|0;j=a+188|0;c[j>>2]=k;c[j+4>>2]=l;l=a+200|0;j=g+16|0;m=c[j>>2]|0;do if(m)if((g|0)==(m|0)){c[a+216>>2]=l;n=c[j>>2]|0;La[c[(c[n>>2]|0)+12>>2]&31](n,l);break}else{c[a+216>>2]=Fa[c[(c[m>>2]|0)+8>>2]&63](m)|0;break}else c[a+216>>2]=0;while(0);m=c[d+4>>2]|0;a:do if((k|0)>0){d=e+16|0;l=i+44|0;j=i+4|0;g=b+4|0;n=b+8|0;o=i+16|0;p=i+20|0;if((m|0)>0){q=0;b:while(1){r=+(q|0)*10.0;s=0;do{t=c[d>>2]|0;if(!t)break b;La[c[(c[t>>2]|0)+24>>2]&31](i,t);t=(c[l>>2]|0)+-2|0;if(t>>>0<5?(f[i>>2]=r,f[j>>2]=+(s|0)*10.0,(t|0)!=4):0){c[o>>2]=1090519040;c[p>>2]=1090519040}t=c[g>>2]|0;if((t|0)==(c[n>>2]|0))wb(b,i);else{u=t;t=i;v=u+48|0;do{c[u>>2]=c[t>>2];u=u+4|0;t=t+4|0}while((u|0)<(v|0));c[g>>2]=(c[g>>2]|0)+48}s=s+1|0}while((s|0)<(m|0));q=q+1|0;if((q|0)>=(k|0)){w=g;break a}}q=$(4)|0;c[q>>2]=6340;da(q|0,3912,139)}else w=g}else w=b+4|0;while(0);i=c[b>>2]|0;c[i+((c[a+4>>2]|0)*48|0)+36>>2]=(((c[w>>2]|0)-i|0)/48|0)+-1;r=+(k|0);x=+(m|0);f[a+24>>2]=r*10.0;f[a+28>>2]=x*10.0;f[a+48>>2]=r/x;Ca=h;return}function lc(a){a=a|0;return}function mc(a){a=a|0;gi(a);return}function nc(a){a=a|0;a=fi(8)|0;c[a>>2]=4380;return a|0}function oc(a,b){a=a|0;b=b|0;c[b>>2]=4380;return}function pc(a){a=a|0;return}function qc(a){a=a|0;gi(a);return}function rc(a,b){a=a|0;b=b|0;var d=0;b=a+8|0;d=b+36|0;do{c[b>>2]=0;b=b+4|0}while((b|0)<(d|0));c[a+44>>2]=5;c[a>>2]=0;c[a+4>>2]=0;c[a+16>>2]=0;c[a+20>>2]=0;f[a+24>>2]=3.0;f[a+28>>2]=1.0;c[a+32>>2]=-1;c[a+36>>2]=255;return}function sc(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==7734?a+4|0:0)|0}function tc(a){a=a|0;return 3e3}function uc(a){a=a|0;return}function vc(a){a=a|0;gi(a);return}function wc(a){a=a|0;a=fi(8)|0;c[a>>2]=4424;return a|0}function xc(a,b){a=a|0;b=b|0;c[b>>2]=4424;return}function yc(a){a=a|0;return}function zc(a){a=a|0;gi(a);return}function Ac(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;a=c[d>>2]|0;switch(c[e>>2]|0){case 0:{e=c[b>>2]|0;if((c[e+(a*48|0)+44>>2]|0)!=5)return;c[e+(a*48|0)+36>>2]=255;return}case 1:{e=c[b>>2]|0;if((c[e+(a*48|0)+44>>2]|0)!=5)return;c[e+(a*48|0)+36>>2]=-16776961;return}case 2:{e=c[b>>2]|0;if((c[e+(a*48|0)+44>>2]|0)!=5)return;c[e+(a*48|0)+36>>2]=16711935;return}case 3:{e=c[b>>2]|0;if((c[e+(a*48|0)+44>>2]|0)!=5)return;c[e+(a*48|0)+36>>2]=65535;return}default:return}}function Bc(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==7955?a+4|0:0)|0}function Cc(a){a=a|0;return 3032}function Dc(a,b){a=a|0;b=b|0;return}function Ec(a){a=a|0;di(a);gi(a);return}function Fc(a){a=a|0;var b=0;b=c[a+12>>2]|0;if(!b)return;c[b>>2]=4468;a=c[b+216>>2]|0;if((b+200|0)!=(a|0)){if(a|0)Ja[c[(c[a>>2]|0)+20>>2]&255](a)}else Ja[c[(c[a>>2]|0)+16>>2]&255](a);Zb(b);gi(b);return}function Gc(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==8133?a+12|0:0)|0}function Hc(a){a=a|0;gi(a);return}function Ic(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0;d=Ca;Ca=Ca+16|0;if((Ca|0)>=(Da|0))z(16);e=d;if((b|0)==(a|0)){Ca=d;return}f=a+16|0;g=c[f>>2]|0;h=g;i=b+16|0;if((g|0)==(a|0))if((c[i>>2]|0)==(b|0)){La[c[(c[g>>2]|0)+12>>2]&31](g,e);j=c[f>>2]|0;Ja[c[(c[j>>2]|0)+16>>2]&255](j);c[f>>2]=0;j=c[i>>2]|0;La[c[(c[j>>2]|0)+12>>2]&31](j,a);j=c[i>>2]|0;Ja[c[(c[j>>2]|0)+16>>2]&255](j);c[i>>2]=0;c[f>>2]=a;La[c[(c[e>>2]|0)+12>>2]&31](e,b);Ja[c[(c[e>>2]|0)+16>>2]&255](e);c[i>>2]=b;Ca=d;return}else{La[c[(c[g>>2]|0)+12>>2]&31](g,b);g=c[f>>2]|0;Ja[c[(c[g>>2]|0)+16>>2]&255](g);g=b+16|0;c[f>>2]=c[g>>2];c[g>>2]=b;Ca=d;return}else{g=c[i>>2]|0;if((b|0)==(g|0)){La[c[(c[g>>2]|0)+12>>2]&31](g,a);b=c[i>>2]|0;Ja[c[(c[b>>2]|0)+16>>2]&255](b);c[i>>2]=c[f>>2];c[f>>2]=a;Ca=d;return}else{c[f>>2]=g;c[i>>2]=h;Ca=d;return}}}function Jc(a){a=a|0;gi(a);return}function Kc(a){a=a|0;a=fi(8)|0;c[a>>2]=4536;return a|0}function Lc(a,b){a=a|0;b=b|0;c[b>>2]=4536;return}function Mc(a){a=a|0;return}function Nc(a){a=a|0;gi(a);return}function Oc(a,b){a=a|0;b=b|0;f[b+4>>2]=0.0;return}function Pc(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==8320?a+4|0:0)|0}function Qc(a){a=a|0;return 3112}function Rc(a){a=a|0;return}function Sc(a){a=a|0;gi(a);return}function Tc(a){a=a|0;a=fi(8)|0;c[a>>2]=4580;return a|0}function Uc(a,b){a=a|0;b=b|0;c[b>>2]=4580;return}function Vc(a){a=a|0;return}function Wc(a){a=a|0;gi(a);return}function Xc(a,b){a=a|0;b=b|0;f[b>>2]=0.0;return}function Yc(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==8447?a+4|0:0)|0}function Zc(a){a=a|0;return 3136}function _c(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0;f=Ca;Ca=Ca+16|0;if((Ca|0)>=(Da|0))z(16);g=f+8|0;h=f;i=a+24|0;j=c[i+4>>2]|0;k=g;c[k>>2]=c[i>>2];c[k+4>>2]=j;j=a+16|0;k=c[j+4>>2]|0;i=h;c[i>>2]=c[j>>2];c[i+4>>2]=k;Eb(a,b,d,e);Oa[c[(c[a>>2]|0)+8>>2]&31](a,b,h,g);Fb(a,b);Ca=f;return}function $c(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var g=0,h=0,i=0.0;e=c[b>>2]|0;b=(c[e+((c[a+4>>2]|0)*48|0)+32>>2]|0)+1|0;d=a+16|0;g=c[d+4>>2]|0;h=e+(b*48|0)|0;c[h>>2]=c[d>>2];c[h+4>>2]=g;i=+f[a+28>>2]*.5;f[e+(b*48|0)+16>>2]=+f[a+24>>2]*.5;f[e+(b*48|0)+20>>2]=i;return}function ad(a,b){a=a|0;b=b|0;return}function bd(a){a=a|0;di(a);gi(a);return}function cd(a){a=a|0;var b=0;b=c[a+12>>2]|0;if(!b)return;Zb(b);gi(b);return}function dd(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==8609?a+12|0:0)|0}function ed(a){a=a|0;gi(a);return}function fd(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0;f=Ca;Ca=Ca+16|0;if((Ca|0)>=(Da|0))z(16);g=f+8|0;h=f;i=a+24|0;j=c[i+4>>2]|0;k=g;c[k>>2]=c[i>>2];c[k+4>>2]=j;j=a+16|0;k=c[j+4>>2]|0;i=h;c[i>>2]=c[j>>2];c[i+4>>2]=k;Eb(a,b,d,e);Oa[c[(c[a>>2]|0)+8>>2]&31](a,b,h,g);Fb(a,b);Ca=f;return}function gd(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var h=0,i=0,j=0,k=0,l=0,m=0.0;e=Ca;Ca=Ca+16|0;if((Ca|0)>=(Da|0))z(16);d=e;h=c[b>>2]|0;b=(c[h+((c[a+4>>2]|0)*48|0)+32>>2]|0)+1|0;i=a+16|0;j=i;k=c[j+4>>2]|0;l=h+(b*48|0)|0;c[l>>2]=c[j>>2];c[l+4>>2]=k;m=+f[a+28>>2]*.5;f[h+(b*48|0)+16>>2]=+f[a+24>>2]*.5;f[h+(b*48|0)+20>>2]=m;m=+f[a+20>>2];g[d>>3]=+f[i>>2];g[d+8>>3]=m;Vh(8681,d)|0;Ca=e;return}function hd(a,b){a=a|0;b=b|0;return}function id(a){a=a|0;di(a);gi(a);return}function jd(a){a=a|0;var b=0;b=c[a+12>>2]|0;if(!b)return;Zb(b);gi(b);return}function kd(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==8832?a+12|0:0)|0}function ld(a){a=a|0;gi(a);return}function md(a){a=a|0;gi(a);return}function nd(a){a=a|0;a=fi(8)|0;c[a>>2]=4720;return a|0}function od(a,b){a=a|0;b=b|0;c[b>>2]=4720;return}function pd(a){a=a|0;return}function qd(a){a=a|0;gi(a);return}function rd(a,b){a=a|0;b=b|0;var c=0,d=0.0,e=0,h=0.0,i=0.0,j=0.0;a=Ca;Ca=Ca+16|0;if((Ca|0)>=(Da|0))z(16);c=a;d=+f[b>>2];e=b+4|0;h=+f[e>>2];i=+s(+(d*d+h*h));j=d*150.0/i;f[b>>2]=j;d=h*150.0/i;f[e>>2]=d;g[c>>3]=j;g[c+8>>3]=d;Vh(8971,c)|0;Ca=a;return}function sd(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==9004?a+4|0:0)|0}function td(a){a=a|0;return 3224}function ud(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0;e=Ca;Ca=Ca+208|0;if((Ca|0)>=(Da|0))z(208);g=e+120|0;h=e+72|0;i=e+152|0;j=e+144|0;k=e+48|0;l=e+24|0;m=e;n=e+136|0;o=e+128|0;xb(a,b);c[a>>2]=5096;p=a+192|0;q=d+16|0;r=c[q>>2]|0;do if(r)if((d|0)==(r|0)){c[a+208>>2]=p;s=c[q>>2]|0;La[c[(c[s>>2]|0)+12>>2]&31](s,p);break}else{c[a+208>>2]=Fa[c[(c[r>>2]|0)+8>>2]&63](r)|0;break}else c[a+208>>2]=0;while(0);r=fi(192)|0;xb(r,b);c[r>>2]=4916;p=i+8|0;q=p+36|0;do{c[p>>2]=0;p=p+4|0}while((p|0)<(q|0));c[i+44>>2]=5;c[i>>2]=0;c[i+4>>2]=0;c[i+16>>2]=0;c[i+20>>2]=0;f[i+24>>2]=10.0;f[i+28>>2]=2.0;c[i+32>>2]=-1431655681;c[i+36>>2]=-1;d=b+4|0;s=c[d>>2]|0;t=c[b>>2]|0;c[t+((c[r+4>>2]|0)*48|0)+36>>2]=(s-t|0)/48|0;t=b+8|0;if((c[t>>2]|0)==(s|0))wb(b,i);else{p=s;u=i;q=p+48|0;do{c[p>>2]=c[u>>2];p=p+4|0;u=u+4|0}while((p|0)<(q|0));c[d>>2]=(c[d>>2]|0)+48}c[j>>2]=r;s=fi(16)|0;c[s+4>>2]=0;c[s+8>>2]=0;c[s>>2]=4936;c[s+12>>2]=r;v=j+4|0;c[v>>2]=s;c[h>>2]=r;c[h+4>>2]=r;Zd(j,h);r=c[(c[j>>2]|0)+4>>2]|0;s=c[b>>2]|0;c[s+(r*48|0)>>2]=0;c[s+(r*48|0)+4>>2]=0;r=c[(c[j>>2]|0)+4>>2]|0;s=c[b>>2]|0;c[s+(r*48|0)+8>>2]=1065353216;c[s+(r*48|0)+12>>2]=1065353216;r=fi(192)|0;xb(r,b);c[r>>2]=4916;p=h+8|0;q=p+36|0;do{c[p>>2]=0;p=p+4|0}while((p|0)<(q|0));c[h+44>>2]=5;c[h>>2]=0;c[h+4>>2]=0;c[h+16>>2]=0;c[h+20>>2]=0;f[h+24>>2]=10.0;f[h+28>>2]=2.0;c[h+32>>2]=-1431655681;c[h+36>>2]=-1;s=c[d>>2]|0;w=c[b>>2]|0;c[w+((c[r+4>>2]|0)*48|0)+36>>2]=(s-w|0)/48|0;if((c[t>>2]|0)==(s|0))wb(b,h);else{p=s;u=h;q=p+48|0;do{c[p>>2]=c[u>>2];p=p+4|0;u=u+4|0}while((p|0)<(q|0));c[d>>2]=(c[d>>2]|0)+48}c[i>>2]=r;d=fi(16)|0;c[d+4>>2]=0;c[d+8>>2]=0;c[d>>2]=4936;c[d+12>>2]=r;u=i+4|0;c[u>>2]=d;c[g>>2]=r;c[g+4>>2]=r;Zd(i,g);g=c[(c[i>>2]|0)+4>>2]|0;r=c[b>>2]|0;c[r+(g*48|0)>>2]=0;c[r+(g*48|0)+4>>2]=0;g=c[i>>2]|0;r=g+4|0;d=c[r>>2]|0;p=c[b>>2]|0;c[p+(d*48|0)+8>>2]=1065353216;c[p+(d*48|0)+12>>2]=1065353216;d=c[r>>2]|0;r=c[b>>2]|0;c[r+(d*48|0)+16>>2]=1084227584;c[r+(d*48|0)+20>>2]=1084227584;d=b;r=g;g=c[u>>2]|0;if(!g)x=0;else{p=g+4|0;c[p>>2]=(c[p>>2]|0)+1;x=c[u>>2]|0}p=k+16|0;c[k>>2]=5116;c[k+4>>2]=d;c[k+8>>2]=r;c[k+12>>2]=g;c[p>>2]=k;if(x|0){g=x+4|0;c[g>>2]=(c[g>>2]|0)+1}g=l+16|0;c[l>>2]=5160;c[l+4>>2]=d;c[l+8>>2]=r;c[l+12>>2]=x;c[g>>2]=l;x=m+16|0;c[m>>2]=5204;c[m+4>>2]=a;c[x>>2]=m;zb(a,k,l,m);r=c[x>>2]|0;if((m|0)!=(r|0)){if(r|0)Ja[c[(c[r>>2]|0)+20>>2]&255](r)}else Ja[c[(c[r>>2]|0)+16>>2]&255](r);r=c[g>>2]|0;if((l|0)!=(r|0)){if(r|0)Ja[c[(c[r>>2]|0)+20>>2]&255](r)}else Ja[c[(c[r>>2]|0)+16>>2]&255](r);r=c[p>>2]|0;if((k|0)!=(r|0)){if(r|0)Ja[c[(c[r>>2]|0)+20>>2]&255](r)}else Ja[c[(c[r>>2]|0)+16>>2]&255](r);r=c[c[a>>2]>>2]|0;c[n>>2]=c[j>>2];j=n+4|0;k=c[v>>2]|0;c[j>>2]=k;if(k|0){p=k+4|0;c[p>>2]=(c[p>>2]|0)+1}Na[r&3](a,b,n);n=c[j>>2]|0;if(n|0?(j=n+4|0,r=c[j>>2]|0,c[j>>2]=r+-1,(r|0)==0):0){Ja[c[(c[n>>2]|0)+8>>2]&255](n);ei(n)}n=c[c[a>>2]>>2]|0;c[o>>2]=c[i>>2];i=o+4|0;r=c[u>>2]|0;c[i>>2]=r;if(r|0){j=r+4|0;c[j>>2]=(c[j>>2]|0)+1}Na[n&3](a,b,o);o=c[i>>2]|0;if(o|0?(i=o+4|0,b=c[i>>2]|0,c[i>>2]=b+-1,(b|0)==0):0){Ja[c[(c[o>>2]|0)+8>>2]&255](o);ei(o)}o=c[u>>2]|0;if(o|0?(u=o+4|0,b=c[u>>2]|0,c[u>>2]=b+-1,(b|0)==0):0){Ja[c[(c[o>>2]|0)+8>>2]&255](o);ei(o)}o=c[v>>2]|0;if(!o){Ca=e;return}v=o+4|0;b=c[v>>2]|0;c[v>>2]=b+-1;if(b|0){Ca=e;return}Ja[c[(c[o>>2]|0)+8>>2]&255](o);ei(o);Ca=e;return}function vd(a){a=a|0;var b=0,d=0;c[a>>2]=4784;b=c[a+12>>2]|0;if(!b)return;a=b+4|0;d=c[a>>2]|0;c[a>>2]=d+-1;if(d|0)return;Ja[c[(c[b>>2]|0)+8>>2]&255](b);ei(b);return}function wd(a){a=a|0;var b=0,d=0,e=0;c[a>>2]=4784;b=c[a+12>>2]|0;if(!b){gi(a);return}d=b+4|0;e=c[d>>2]|0;c[d>>2]=e+-1;if(e|0){gi(a);return}Ja[c[(c[b>>2]|0)+8>>2]&255](b);ei(b);gi(a);return}function xd(a){a=a|0;var b=0,d=0;b=fi(16)|0;c[b>>2]=4784;c[b+4>>2]=c[a+4>>2];c[b+8>>2]=c[a+8>>2];d=c[a+12>>2]|0;c[b+12>>2]=d;if(!d)return b|0;a=d+4|0;c[a>>2]=(c[a>>2]|0)+1;return b|0}function yd(a,b){a=a|0;b=b|0;var d=0;c[b>>2]=4784;c[b+4>>2]=c[a+4>>2];c[b+8>>2]=c[a+8>>2];d=c[a+12>>2]|0;c[b+12>>2]=d;if(!d)return;b=d+4|0;c[b>>2]=(c[b>>2]|0)+1;return}function zd(a){a=a|0;var b=0,d=0;b=c[a+12>>2]|0;if(!b)return;a=b+4|0;d=c[a>>2]|0;c[a>>2]=d+-1;if(d|0)return;Ja[c[(c[b>>2]|0)+8>>2]&255](b);ei(b);return}function Ad(a){a=a|0;var b=0,d=0,e=0;b=c[a+12>>2]|0;if(!b){gi(a);return}d=b+4|0;e=c[d>>2]|0;c[d>>2]=e+-1;if(e|0){gi(a);return}Ja[c[(c[b>>2]|0)+8>>2]&255](b);ei(b);gi(a);return}function Bd(a){a=a|0;var b=0,d=0,e=0,g=0;b=c[a+4>>2]|0;Xh(13362)|0;d=a+8|0;a=b+4|0;b=(c[d>>2]|0)+4|0;e=c[b>>2]|0;g=c[a>>2]|0;f[g+(e*48|0)+8>>2]=0.0;f[g+(e*48|0)+12>>2]=0.0;e=c[b>>2]|0;b=c[a>>2]|0;f[b+(e*48|0)+24>>2]=150.0;f[b+(e*48|0)+28>>2]=150.0;e=c[d>>2]|0;Oa[c[(c[e>>2]|0)+4>>2]&31](e,a,e+40|0,e+32|0);return}function Cd(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==9171?a+4|0:0)|0}function Dd(a){a=a|0;return 3272}function Ed(a){a=a|0;return}function Fd(a){a=a|0;var b=0,d=0;c[a>>2]=4828;b=c[a+12>>2]|0;if(!b)return;a=b+4|0;d=c[a>>2]|0;c[a>>2]=d+-1;if(d|0)return;Ja[c[(c[b>>2]|0)+8>>2]&255](b);ei(b);return}function Gd(a){a=a|0;var b=0,d=0,e=0;c[a>>2]=4828;b=c[a+12>>2]|0;if(!b){gi(a);return}d=b+4|0;e=c[d>>2]|0;c[d>>2]=e+-1;if(e|0){gi(a);return}Ja[c[(c[b>>2]|0)+8>>2]&255](b);ei(b);gi(a);return}function Hd(a){a=a|0;var b=0,d=0;b=fi(16)|0;c[b>>2]=4828;c[b+4>>2]=c[a+4>>2];c[b+8>>2]=c[a+8>>2];d=c[a+12>>2]|0;c[b+12>>2]=d;if(!d)return b|0;a=d+4|0;c[a>>2]=(c[a>>2]|0)+1;return b|0}function Id(a,b){a=a|0;b=b|0;var d=0;c[b>>2]=4828;c[b+4>>2]=c[a+4>>2];c[b+8>>2]=c[a+8>>2];d=c[a+12>>2]|0;c[b+12>>2]=d;if(!d)return;b=d+4|0;c[b>>2]=(c[b>>2]|0)+1;return}function Jd(a){a=a|0;var b=0,d=0;b=c[a+12>>2]|0;if(!b)return;a=b+4|0;d=c[a>>2]|0;c[a>>2]=d+-1;if(d|0)return;Ja[c[(c[b>>2]|0)+8>>2]&255](b);ei(b);return}function Kd(a){a=a|0;var b=0,d=0,e=0;b=c[a+12>>2]|0;if(!b){gi(a);return}d=b+4|0;e=c[d>>2]|0;c[d>>2]=e+-1;if(e|0){gi(a);return}Ja[c[(c[b>>2]|0)+8>>2]&255](b);ei(b);gi(a);return}function Ld(a){a=a|0;var b=0,d=0,e=0,g=0;b=c[a+4>>2]|0;Xh(13373)|0;d=a+8|0;a=b+4|0;b=(c[d>>2]|0)+4|0;e=c[b>>2]|0;g=c[a>>2]|0;f[g+(e*48|0)+8>>2]=0.0;f[g+(e*48|0)+12>>2]=0.0;e=c[b>>2]|0;b=c[a>>2]|0;f[b+(e*48|0)+24>>2]=100.0;f[b+(e*48|0)+28>>2]=100.0;e=c[d>>2]|0;Oa[c[(c[e>>2]|0)+4>>2]&31](e,a,e+40|0,e+32|0);return}function Md(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==9280?a+4|0:0)|0}function Nd(a){a=a|0;return 3296}function Od(a){a=a|0;var b=0,d=0;c[a>>2]=4872;b=c[a+12>>2]|0;if(!b)return;a=b+4|0;d=c[a>>2]|0;c[a>>2]=d+-1;if(d|0)return;Ja[c[(c[b>>2]|0)+8>>2]&255](b);ei(b);return}function Pd(a){a=a|0;var b=0,d=0,e=0;c[a>>2]=4872;b=c[a+12>>2]|0;if(!b){gi(a);return}d=b+4|0;e=c[d>>2]|0;c[d>>2]=e+-1;if(e|0){gi(a);return}Ja[c[(c[b>>2]|0)+8>>2]&255](b);ei(b);gi(a);return}function Qd(a){a=a|0;var b=0,d=0;b=fi(16)|0;c[b>>2]=4872;c[b+4>>2]=c[a+4>>2];c[b+8>>2]=c[a+8>>2];d=c[a+12>>2]|0;c[b+12>>2]=d;if(!d)return b|0;a=d+4|0;c[a>>2]=(c[a>>2]|0)+1;return b|0}function Rd(a,b){a=a|0;b=b|0;var d=0;c[b>>2]=4872;c[b+4>>2]=c[a+4>>2];c[b+8>>2]=c[a+8>>2];d=c[a+12>>2]|0;c[b+12>>2]=d;if(!d)return;b=d+4|0;c[b>>2]=(c[b>>2]|0)+1;return}function Sd(a){a=a|0;var b=0,d=0;b=c[a+12>>2]|0;if(!b)return;a=b+4|0;d=c[a>>2]|0;c[a>>2]=d+-1;if(d|0)return;Ja[c[(c[b>>2]|0)+8>>2]&255](b);ei(b);return}function Td(a){a=a|0;var b=0,d=0,e=0;b=c[a+12>>2]|0;if(!b){gi(a);return}d=b+4|0;e=c[d>>2]|0;c[d>>2]=e+-1;if(e|0){gi(a);return}Ja[c[(c[b>>2]|0)+8>>2]&255](b);ei(b);gi(a);return}function Ud(a,b){a=a|0;b=b|0;var d=0;b=c[a+4>>2]|0;Xh(13355)|0;d=c[a+8>>2]|0;a=b+4|0;b=c[a>>2]|0;c[b+(((c[b+((c[d+4>>2]|0)*48|0)+32>>2]|0)+1|0)*48|0)+32>>2]=696469503;Oa[c[(c[d>>2]|0)+4>>2]&31](d,a,d+40|0,d+32|0);return}function Vd(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==9400?a+4|0:0)|0}function Wd(a){a=a|0;return 3320}function Xd(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0;f=Ca;Ca=Ca+16|0;if((Ca|0)>=(Da|0))z(16);g=f+8|0;h=f;i=a+24|0;j=c[i+4>>2]|0;k=g;c[k>>2]=c[i>>2];c[k+4>>2]=j;j=a+16|0;k=c[j+4>>2]|0;i=h;c[i>>2]=c[j>>2];c[i+4>>2]=k;Eb(a,b,d,e);Oa[c[(c[a>>2]|0)+8>>2]&31](a,b,h,g);Fb(a,b);Ca=f;return}function Yd(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0;e=c[b>>2]|0;b=(c[e+((c[a+4>>2]|0)*48|0)+32>>2]|0)+1|0;d=a+16|0;f=c[d+4>>2]|0;g=e+(b*48|0)|0;c[g>>2]=c[d>>2];c[g+4>>2]=f;f=a+24|0;a=c[f+4>>2]|0;g=e+(b*48|0)+16|0;c[g>>2]=c[f>>2];c[g+4>>2]=a;return}function Zd(a,b){a=a|0;b=b|0;return}function _d(a){a=a|0;di(a);gi(a);return}function $d(a){a=a|0;var b=0;b=c[a+12>>2]|0;if(!b)return;Zb(b);gi(b);return}function ae(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==9570?a+12|0:0)|0}function be(a){a=a|0;gi(a);return}function ce(a){a=a|0;var b=0,d=0;c[a>>2]=4964;b=c[a+12>>2]|0;if(!b)return;a=b+4|0;d=c[a>>2]|0;c[a>>2]=d+-1;if(d|0)return;Ja[c[(c[b>>2]|0)+8>>2]&255](b);ei(b);return}function de(a){a=a|0;var b=0,d=0,e=0;c[a>>2]=4964;b=c[a+12>>2]|0;if(!b){gi(a);return}d=b+4|0;e=c[d>>2]|0;c[d>>2]=e+-1;if(e|0){gi(a);return}Ja[c[(c[b>>2]|0)+8>>2]&255](b);ei(b);gi(a);return}function ee(a){a=a|0;var b=0,d=0;b=fi(16)|0;c[b>>2]=4964;c[b+4>>2]=c[a+4>>2];c[b+8>>2]=c[a+8>>2];d=c[a+12>>2]|0;c[b+12>>2]=d;if(!d)return b|0;a=d+4|0;c[a>>2]=(c[a>>2]|0)+1;return b|0}function fe(a,b){a=a|0;b=b|0;var d=0;c[b>>2]=4964;c[b+4>>2]=c[a+4>>2];c[b+8>>2]=c[a+8>>2];d=c[a+12>>2]|0;c[b+12>>2]=d;if(!d)return;b=d+4|0;c[b>>2]=(c[b>>2]|0)+1;return}function ge(a){a=a|0;var b=0,d=0;b=c[a+12>>2]|0;if(!b)return;a=b+4|0;d=c[a>>2]|0;c[a>>2]=d+-1;if(d|0)return;Ja[c[(c[b>>2]|0)+8>>2]&255](b);ei(b);return}function he(a){a=a|0;var b=0,d=0,e=0;b=c[a+12>>2]|0;if(!b){gi(a);return}d=b+4|0;e=c[d>>2]|0;c[d>>2]=e+-1;if(e|0){gi(a);return}Ja[c[(c[b>>2]|0)+8>>2]&255](b);ei(b);gi(a);return}function ie(a){a=a|0;var b=0,d=0,e=0;b=c[a+4>>2]|0;Xh(13362)|0;d=a+8|0;a=b+4|0;b=c[(c[d>>2]|0)+4>>2]|0;e=c[a>>2]|0;c[e+(b*48|0)+24>>2]=1132068864;c[e+(b*48|0)+28>>2]=1117782016;b=c[d>>2]|0;Oa[c[(c[b>>2]|0)+4>>2]&31](b,a,b+40|0,b+32|0);return}function je(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==9705?a+4|0:0)|0}function ke(a){a=a|0;return 3376}function le(a){a=a|0;var b=0,d=0;c[a>>2]=5008;b=c[a+12>>2]|0;if(!b)return;a=b+4|0;d=c[a>>2]|0;c[a>>2]=d+-1;if(d|0)return;Ja[c[(c[b>>2]|0)+8>>2]&255](b);ei(b);return}function me(a){a=a|0;var b=0,d=0,e=0;c[a>>2]=5008;b=c[a+12>>2]|0;if(!b){gi(a);return}d=b+4|0;e=c[d>>2]|0;c[d>>2]=e+-1;if(e|0){gi(a);return}Ja[c[(c[b>>2]|0)+8>>2]&255](b);ei(b);gi(a);return}function ne(a){a=a|0;var b=0,d=0;b=fi(16)|0;c[b>>2]=5008;c[b+4>>2]=c[a+4>>2];c[b+8>>2]=c[a+8>>2];d=c[a+12>>2]|0;c[b+12>>2]=d;if(!d)return b|0;a=d+4|0;c[a>>2]=(c[a>>2]|0)+1;return b|0}function oe(a,b){a=a|0;b=b|0;var d=0;c[b>>2]=5008;c[b+4>>2]=c[a+4>>2];c[b+8>>2]=c[a+8>>2];d=c[a+12>>2]|0;c[b+12>>2]=d;if(!d)return;b=d+4|0;c[b>>2]=(c[b>>2]|0)+1;return}function pe(a){a=a|0;var b=0,d=0;b=c[a+12>>2]|0;if(!b)return;a=b+4|0;d=c[a>>2]|0;c[a>>2]=d+-1;if(d|0)return;Ja[c[(c[b>>2]|0)+8>>2]&255](b);ei(b);return}function qe(a){a=a|0;var b=0,d=0,e=0;b=c[a+12>>2]|0;if(!b){gi(a);return}d=b+4|0;e=c[d>>2]|0;c[d>>2]=e+-1;if(e|0){gi(a);return}Ja[c[(c[b>>2]|0)+8>>2]&255](b);ei(b);gi(a);return}function re(a){a=a|0;var b=0,d=0,e=0;b=c[a+4>>2]|0;Xh(13373)|0;d=a+8|0;a=b+4|0;b=c[(c[d>>2]|0)+4>>2]|0;e=c[a>>2]|0;c[e+(b*48|0)+24>>2]=1125515264;c[e+(b*48|0)+28>>2]=1117782016;b=c[d>>2]|0;Oa[c[(c[b>>2]|0)+4>>2]&31](b,a,b+40|0,b+32|0);return}function se(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==9815?a+4|0:0)|0}function te(a){a=a|0;return 3400}function ue(a){a=a|0;var b=0,d=0;c[a>>2]=5052;b=c[a+12>>2]|0;if(!b)return;a=b+4|0;d=c[a>>2]|0;c[a>>2]=d+-1;if(d|0)return;Ja[c[(c[b>>2]|0)+8>>2]&255](b);ei(b);return}function ve(a){a=a|0;var b=0,d=0,e=0;c[a>>2]=5052;b=c[a+12>>2]|0;if(!b){gi(a);return}d=b+4|0;e=c[d>>2]|0;c[d>>2]=e+-1;if(e|0){gi(a);return}Ja[c[(c[b>>2]|0)+8>>2]&255](b);ei(b);gi(a);return}function we(a){a=a|0;var b=0,d=0;b=fi(16)|0;c[b>>2]=5052;c[b+4>>2]=c[a+4>>2];c[b+8>>2]=c[a+8>>2];d=c[a+12>>2]|0;c[b+12>>2]=d;if(!d)return b|0;a=d+4|0;c[a>>2]=(c[a>>2]|0)+1;return b|0}function xe(a,b){a=a|0;b=b|0;var d=0;c[b>>2]=5052;c[b+4>>2]=c[a+4>>2];c[b+8>>2]=c[a+8>>2];d=c[a+12>>2]|0;c[b+12>>2]=d;if(!d)return;b=d+4|0;c[b>>2]=(c[b>>2]|0)+1;return}function ye(a){a=a|0;var b=0,d=0;b=c[a+12>>2]|0;if(!b)return;a=b+4|0;d=c[a>>2]|0;c[a>>2]=d+-1;if(d|0)return;Ja[c[(c[b>>2]|0)+8>>2]&255](b);ei(b);return}function ze(a){a=a|0;var b=0,d=0,e=0;b=c[a+12>>2]|0;if(!b){gi(a);return}d=b+4|0;e=c[d>>2]|0;c[d>>2]=e+-1;if(e|0){gi(a);return}Ja[c[(c[b>>2]|0)+8>>2]&255](b);ei(b);gi(a);return}function Ae(a,b){a=a|0;b=b|0;var d=0;b=c[a+4>>2]|0;Xh(13355)|0;d=c[a+8>>2]|0;a=b+4|0;b=c[a>>2]|0;c[b+(((c[b+((c[d+4>>2]|0)*48|0)+32>>2]|0)+1|0)*48|0)+36>>2]=696469503;Oa[c[(c[d>>2]|0)+4>>2]&31](d,a,d+40|0,d+32|0);return}function Be(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==9936?a+4|0:0)|0}function Ce(a){a=a|0;return 3424}function De(a){a=a|0;var b=0,d=0;c[a>>2]=5116;b=c[a+12>>2]|0;if(!b)return;a=b+4|0;d=c[a>>2]|0;c[a>>2]=d+-1;if(d|0)return;Ja[c[(c[b>>2]|0)+8>>2]&255](b);ei(b);return}function Ee(a){a=a|0;var b=0,d=0,e=0;c[a>>2]=5116;b=c[a+12>>2]|0;if(!b){gi(a);return}d=b+4|0;e=c[d>>2]|0;c[d>>2]=e+-1;if(e|0){gi(a);return}Ja[c[(c[b>>2]|0)+8>>2]&255](b);ei(b);gi(a);return}function Fe(a){a=a|0;var b=0,d=0;b=fi(16)|0;c[b>>2]=5116;c[b+4>>2]=c[a+4>>2];c[b+8>>2]=c[a+8>>2];d=c[a+12>>2]|0;c[b+12>>2]=d;if(!d)return b|0;a=d+4|0;c[a>>2]=(c[a>>2]|0)+1;return b|0}function Ge(a,b){a=a|0;b=b|0;var d=0;c[b>>2]=5116;c[b+4>>2]=c[a+4>>2];c[b+8>>2]=c[a+8>>2];d=c[a+12>>2]|0;c[b+12>>2]=d;if(!d)return;b=d+4|0;c[b>>2]=(c[b>>2]|0)+1;return}function He(a){a=a|0;var b=0,d=0;b=c[a+12>>2]|0;if(!b)return;a=b+4|0;d=c[a>>2]|0;c[a>>2]=d+-1;if(d|0)return;Ja[c[(c[b>>2]|0)+8>>2]&255](b);ei(b);return}function Ie(a){a=a|0;var b=0,d=0,e=0;b=c[a+12>>2]|0;if(!b){gi(a);return}d=b+4|0;e=c[d>>2]|0;c[d>>2]=e+-1;if(e|0){gi(a);return}Ja[c[(c[b>>2]|0)+8>>2]&255](b);ei(b);gi(a);return}function Je(a){a=a|0;var b=0,d=0,e=0;Xh(13362)|0;b=a+8|0;d=a+4|0;a=c[(c[b>>2]|0)+4>>2]|0;e=c[c[d>>2]>>2]|0;c[e+(a*48|0)+16>>2]=1073741824;c[e+(a*48|0)+20>>2]=1073741824;a=c[b>>2]|0;Oa[c[(c[a>>2]|0)+4>>2]&31](a,c[d>>2]|0,a+40|0,a+32|0);return}function Ke(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==10130?a+4|0:0)|0}function Le(a){a=a|0;return 3464}function Me(a){a=a|0;var b=0,d=0;c[a>>2]=5160;b=c[a+12>>2]|0;if(!b)return;a=b+4|0;d=c[a>>2]|0;c[a>>2]=d+-1;if(d|0)return;Ja[c[(c[b>>2]|0)+8>>2]&255](b);ei(b);return}function Ne(a){a=a|0;var b=0,d=0,e=0;c[a>>2]=5160;b=c[a+12>>2]|0;if(!b){gi(a);return}d=b+4|0;e=c[d>>2]|0;c[d>>2]=e+-1;if(e|0){gi(a);return}Ja[c[(c[b>>2]|0)+8>>2]&255](b);ei(b);gi(a);return}function Oe(a){a=a|0;var b=0,d=0;b=fi(16)|0;c[b>>2]=5160;c[b+4>>2]=c[a+4>>2];c[b+8>>2]=c[a+8>>2];d=c[a+12>>2]|0;c[b+12>>2]=d;if(!d)return b|0;a=d+4|0;c[a>>2]=(c[a>>2]|0)+1;return b|0}function Pe(a,b){a=a|0;b=b|0;var d=0;c[b>>2]=5160;c[b+4>>2]=c[a+4>>2];c[b+8>>2]=c[a+8>>2];d=c[a+12>>2]|0;c[b+12>>2]=d;if(!d)return;b=d+4|0;c[b>>2]=(c[b>>2]|0)+1;return}function Qe(a){a=a|0;var b=0,d=0;b=c[a+12>>2]|0;if(!b)return;a=b+4|0;d=c[a>>2]|0;c[a>>2]=d+-1;if(d|0)return;Ja[c[(c[b>>2]|0)+8>>2]&255](b);ei(b);return}function Re(a){a=a|0;var b=0,d=0,e=0;b=c[a+12>>2]|0;if(!b){gi(a);return}d=b+4|0;e=c[d>>2]|0;c[d>>2]=e+-1;if(e|0){gi(a);return}Ja[c[(c[b>>2]|0)+8>>2]&255](b);ei(b);gi(a);return}function Se(a){a=a|0;var b=0,d=0,e=0;Xh(13373)|0;b=a+8|0;d=a+4|0;a=c[(c[b>>2]|0)+4>>2]|0;e=c[c[d>>2]>>2]|0;c[e+(a*48|0)+16>>2]=1084227584;c[e+(a*48|0)+20>>2]=1084227584;a=c[b>>2]|0;Oa[c[(c[a>>2]|0)+4>>2]&31](a,c[d>>2]|0,a+40|0,a+32|0);return}function Te(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==10375?a+4|0:0)|0}function Ue(a){a=a|0;return 3488}function Ve(a){a=a|0;gi(a);return}function We(a){a=a|0;var b=0;b=fi(8)|0;c[b>>2]=5204;c[b+4>>2]=c[a+4>>2];return b|0}function Xe(a,b){a=a|0;b=b|0;c[b>>2]=5204;c[b+4>>2]=c[a+4>>2];return}function Ye(a){a=a|0;return}function Ze(a){a=a|0;gi(a);return}function _e(a,b){a=a|0;b=b|0;var d=0,e=0,f=0;d=Ca;Ca=Ca+16|0;if((Ca|0)>=(Da|0))z(16);e=d;f=c[a+4>>2]|0;a=c[f+208>>2]|0;if(!a){Ca=d;return}c[e>>2]=f;Na[c[(c[a>>2]|0)+24>>2]&3](a,b,e);Ca=d;return}function $e(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==10624?a+4|0:0)|0}function af(a){a=a|0;return 3512}function bf(a,b){a=a|0;b=b|0;return}function cf(a){a=a|0;di(a);gi(a);return}function df(a){a=a|0;var b=0;b=c[a+12>>2]|0;if(!b)return;c[b>>2]=5096;a=c[b+208>>2]|0;if((b+192|0)!=(a|0)){if(a|0)Ja[c[(c[a>>2]|0)+20>>2]&255](a)}else Ja[c[(c[a>>2]|0)+16>>2]&255](a);Zb(b);gi(b);return}function ef(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==10821?a+12|0:0)|0}function ff(a){a=a|0;gi(a);return}function gf(a,b,d,e,f){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0;g=Ca;Ca=Ca+32|0;if((Ca|0)>=(Da|0))z(32);h=g;i=g+16|0;j=g+8|0;c[a>>2]=0;k=a+4|0;c[k>>2]=0;l=a+8|0;c[l>>2]=0;if(!d){Ca=g;return}m=f+16|0;f=i+4|0;n=j+4|0;o=0;while(1){p=c[m>>2]|0;if(!p){q=5;break}r=Fa[c[(c[p>>2]|0)+24>>2]&63](p)|0;c[i>>2]=r;p=fi(16)|0;c[p+4>>2]=0;c[p+8>>2]=0;c[p>>2]=4192;c[p+12>>2]=r;c[f>>2]=p;c[h>>2]=r;c[h+4>>2]=r;Gb(i,h);r=c[i>>2]|0;c[(c[b>>2]|0)+((c[r+4>>2]|0)*48|0)+40>>2]=0;p=c[k>>2]|0;if((p|0)==(c[l>>2]|0))Db(a,i);else{c[p>>2]=r;r=c[f>>2]|0;c[p+4>>2]=r;if(!r)s=p;else{p=r+4|0;c[p>>2]=(c[p>>2]|0)+1;s=c[k>>2]|0}c[k>>2]=s+8}p=c[e>>2]|0;r=c[c[p>>2]>>2]|0;c[j>>2]=c[i>>2];t=c[f>>2]|0;c[n>>2]=t;if(t|0){u=t+4|0;c[u>>2]=(c[u>>2]|0)+1}Na[r&3](p,b,j);p=c[n>>2]|0;if(p|0?(r=p+4|0,u=c[r>>2]|0,c[r>>2]=u+-1,(u|0)==0):0){Ja[c[(c[p>>2]|0)+8>>2]&255](p);ei(p)}p=c[f>>2]|0;if(p|0?(u=p+4|0,r=c[u>>2]|0,c[u>>2]=r+-1,(r|0)==0):0){Ja[c[(c[p>>2]|0)+8>>2]&255](p);ei(p)}o=o+1|0;if(o>>>0>=d>>>0){q=3;break}}if((q|0)==3){Ca=g;return}else if((q|0)==5){q=$(4)|0;c[q>>2]=6340;da(q|0,3912,139)}}function hf(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0;d=Ca;Ca=Ca+16|0;if((Ca|0)>=(Da|0))z(16);e=d;c[a>>2]=b;f=fi(16)|0;c[f+4>>2]=0;c[f+8>>2]=0;c[f>>2]=5296;c[f+12>>2]=b;c[a+4>>2]=f;c[e>>2]=b;c[e+4>>2]=b;jf(a,e);Ca=d;return}function jf(a,b){a=a|0;b=b|0;return}function kf(a){a=a|0;di(a);gi(a);return}function lf(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0;b=c[a+12>>2]|0;if(!b)return;a=c[b>>2]|0;if(a|0){d=b+4|0;e=c[d>>2]|0;if((e|0)==(a|0))f=a;else{g=e;do{e=c[g+-4>>2]|0;g=g+-8|0;if(e|0?(h=e+4|0,i=c[h>>2]|0,c[h>>2]=i+-1,(i|0)==0):0){Ja[c[(c[e>>2]|0)+8>>2]&255](e);ei(e)}}while((g|0)!=(a|0));f=c[b>>2]|0}c[d>>2]=a;gi(f)}gi(b);return}function mf(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==10973?a+12|0:0)|0}function nf(a){a=a|0;gi(a);return}function of(a){a=a|0;gi(a);return}function pf(a){a=a|0;var b=0;b=fi(8)|0;c[b>>2]=5324;c[b+4>>2]=c[a+4>>2];return b|0}function qf(a,b){a=a|0;b=b|0;c[b>>2]=5324;c[b+4>>2]=c[a+4>>2];return}function rf(a){a=a|0;return}function sf(a){a=a|0;gi(a);return}function tf(a){a=a|0;var b=0,d=0,e=0,f=0;b=Ca;Ca=Ca+32|0;if((Ca|0)>=(Da|0))z(32);d=b;e=c[a+4>>2]|0;a=fi(216)|0;f=d+16|0;c[d>>2]=5368;c[d+4>>2]=e;c[f>>2]=d;ud(a,e+4|0,d);e=c[f>>2]|0;if((d|0)==(e|0)){Ja[c[(c[e>>2]|0)+16>>2]&255](e);Ca=b;return a|0}if(!e){Ca=b;return a|0}Ja[c[(c[e>>2]|0)+20>>2]&255](e);Ca=b;return a|0}function uf(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==11392?a+4|0:0)|0}function vf(a){a=a|0;return 3624}function wf(a){a=a|0;return}function xf(a){a=a|0;return}function yf(a){a=a|0;gi(a);return}function zf(a){a=a|0;var b=0;b=fi(8)|0;c[b>>2]=5368;c[b+4>>2]=c[a+4>>2];return b|0}function Af(a,b){a=a|0;b=b|0;c[b>>2]=5368;c[b+4>>2]=c[a+4>>2];return}function Bf(a){a=a|0;return}function Cf(a){a=a|0;gi(a);return}function Df(a,b,d){a=a|0;b=b|0;d=d|0;c[(c[(c[a+4>>2]|0)+4>>2]|0)+((c[(c[d>>2]|0)+4>>2]|0)*48|0)+40>>2]=0;return}function Ef(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==11329?a+4|0:0)|0}function Ff(a){a=a|0;return 3616}function Gf(a){a=a|0;gi(a);return}function Hf(a){a=a|0;var b=0;b=fi(8)|0;c[b>>2]=5412;c[b+4>>2]=c[a+4>>2];return b|0}function If(a,b){a=a|0;b=b|0;c[b>>2]=5412;c[b+4>>2]=c[a+4>>2];return}function Jf(a){a=a|0;return}function Kf(a){a=a|0;gi(a);return}function Lf(a,b){a=a|0;b=b|0;Of(a+4|0,b);return}function Mf(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==11529?a+4|0:0)|0}function Nf(a){a=a|0;return 3648}function Of(a,b){a=a|0;b=b|0;var d=0,e=0,h=0,i=0.0,j=0,k=0,l=0,m=0,n=0,o=0;d=Ca;Ca=Ca+16|0;if((Ca|0)>=(Da|0))z(16);e=d;h=c[a>>2]|0;i=+f[b+4>>2];g[e>>3]=+f[b>>2];g[e+8>>3]=i;Vh(11507,e)|0;e=c[h+32>>2]|0;a=h+4|0;h=c[e>>2]|0;j=c[e+4>>2]|0;if((h|0)==(j|0)){Ca=d;return}e=h;while(1){k=c[e>>2]|0;l=c[e+4>>2]|0;h=(l|0)==0;if(!h){m=l+4|0;c[m>>2]=(c[m>>2]|0)+1}n=(c[a>>2]|0)+((c[k+4>>2]|0)*48|0)+40|0;if(!(c[n>>2]|0))break;if(!h?(h=l+4|0,m=c[h>>2]|0,c[h>>2]=m+-1,(m|0)==0):0){Ja[c[(c[l>>2]|0)+8>>2]&255](l);ei(l)}e=e+8|0;if((e|0)==(j|0)){o=13;break}}if((o|0)==13){Ca=d;return}c[n>>2]=1;n=k+4|0;o=c[n>>2]|0;j=c[a>>2]|0;c[j+(o*48|0)+24>>2]=1125515264;c[j+(o*48|0)+28>>2]=1117782016;c[k+8>>2]=1056964608;c[k+12>>2]=1056964608;o=b;b=c[o+4>>2]|0;j=(c[a>>2]|0)+((c[n>>2]|0)*48|0)+16|0;c[j>>2]=c[o>>2];c[j+4>>2]=b;Oa[c[(c[k>>2]|0)+4>>2]&31](k,a,k+40|0,k+32|0);if(!l){Ca=d;return}k=l+4|0;a=c[k>>2]|0;c[k>>2]=a+-1;if(a|0){Ca=d;return}Ja[c[(c[l>>2]|0)+8>>2]&255](l);ei(l);Ca=d;return}function Pf(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0;d=Ca;Ca=Ca+16|0;if((Ca|0)>=(Da|0))z(16);e=d;c[a>>2]=b;f=fi(16)|0;c[f+4>>2]=0;c[f+8>>2]=0;c[f>>2]=5528;c[f+12>>2]=b;c[a+4>>2]=f;c[e>>2]=b;c[e+4>>2]=b;Yf(a,e);Ca=d;return}function Qf(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0;d=Ca;Ca=Ca+16|0;if((Ca|0)>=(Da|0))z(16);e=d;c[a>>2]=b;f=fi(16)|0;c[f+4>>2]=0;c[f+8>>2]=0;c[f>>2]=5568;c[f+12>>2]=b;c[a+4>>2]=f;c[e>>2]=b;c[e+4>>2]=b;dg(a,e);Ca=d;return}function Rf(b,d,e){b=b|0;d=d|0;e=+e;var g=0,h=0,i=0,j=0.0,k=0.0,l=0.0,m=0.0,n=0.0,o=0.0,p=0.0,q=0.0,s=0.0,t=0.0,u=0.0,v=0.0,w=0.0,x=0.0,y=0.0,z=0.0,A=0.0,B=0.0,C=0.0;switch(c[b+16>>2]|0){case 0:{g=(c[b+8>>2]|0)+4|0;h=c[g>>2]|0;i=c[d>>2]|0;j=e/1.0e3;k=+f[i+(h*48|0)>>2];l=+f[b+28>>2];m=+f[i+(h*48|0)+4>>2];n=+f[b+32>>2];o=-+f[b+36>>2];h=b+20|0;p=-+f[b+40>>2];q=+f[h>>2];i=b+24|0;s=+f[i>>2];t=q+j*((k-l)*o+q*p);u=s+j*((m-n)*o+s*p);p=k+j*q;q=m+j*s;s=+r(+(p-l));m=+f[b+44>>2];if((s<m?+r(+t)<m&+r(+(q-n))<m:0)?j>0.0&+r(+u)<m:0){c[h>>2]=0;c[i>>2]=0;a[b+4>>0]=1;v=l;w=n}else{f[h>>2]=t;f[i>>2]=u;v=p;w=q}i=c[g>>2]|0;g=c[d>>2]|0;f[g+(i*48|0)>>2]=v;f[g+(i*48|0)+4>>2]=w;return}case 1:{i=(c[b+8>>2]|0)+4|0;g=c[i>>2]|0;h=c[d>>2]|0;w=e/1.0e3;v=+f[h+(g*48|0)+16>>2];q=+f[b+28>>2];p=+f[h+(g*48|0)+20>>2];u=+f[b+32>>2];t=-+f[b+36>>2];g=b+20|0;n=-+f[b+40>>2];l=+f[g>>2];h=b+24|0;m=+f[h>>2];j=l+w*((v-q)*t+l*n);s=m+w*((p-u)*t+m*n);n=v+w*l;l=p+w*m;m=+r(+(n-q));p=+f[b+44>>2];if((m<p?+r(+j)<p&+r(+(l-u))<p:0)?w>0.0&+r(+s)<p:0){c[g>>2]=0;c[h>>2]=0;a[b+4>>0]=1;x=q;y=u}else{f[g>>2]=j;f[h>>2]=s;x=n;y=l}h=c[i>>2]|0;i=c[d>>2]|0;f[i+(h*48|0)+16>>2]=x;f[i+(h*48|0)+20>>2]=y;return}case 2:{h=(c[b+8>>2]|0)+4|0;i=c[h>>2]|0;g=c[d>>2]|0;y=e/1.0e3;x=+f[g+(i*48|0)+8>>2];l=+f[b+28>>2];n=+f[g+(i*48|0)+12>>2];s=+f[b+32>>2];j=-+f[b+36>>2];i=b+20|0;u=-+f[b+40>>2];q=+f[i>>2];g=b+24|0;p=+f[g>>2];w=q+y*((x-l)*j+q*u);m=p+y*((n-s)*j+p*u);u=x+y*q;q=n+y*p;p=+r(+(u-l));n=+f[b+44>>2];if((p<n?+r(+w)<n&+r(+(q-s))<n:0)?y>0.0&+r(+m)<n:0){c[i>>2]=0;c[g>>2]=0;a[b+4>>0]=1;z=l;A=s}else{f[i>>2]=w;f[g>>2]=m;z=u;A=q}g=c[h>>2]|0;h=c[d>>2]|0;f[h+(g*48|0)+8>>2]=z;f[h+(g*48|0)+12>>2]=A;return}case 3:{g=(c[b+8>>2]|0)+4|0;h=c[g>>2]|0;i=c[d>>2]|0;A=e/1.0e3;e=+f[i+(h*48|0)+24>>2];z=+f[b+28>>2];q=+f[i+(h*48|0)+28>>2];u=+f[b+32>>2];m=-+f[b+36>>2];h=b+20|0;w=-+f[b+40>>2];s=+f[h>>2];i=b+24|0;l=+f[i>>2];n=s+A*((e-z)*m+s*w);y=l+A*((q-u)*m+l*w);w=e+A*s;s=q+A*l;l=+r(+(w-z));q=+f[b+44>>2];if((l<q?+r(+n)<q&+r(+(s-u))<q:0)?A>0.0&+r(+y)<q:0){c[h>>2]=0;c[i>>2]=0;a[b+4>>0]=1;B=z;C=u}else{f[h>>2]=n;f[i>>2]=y;B=w;C=s}i=c[g>>2]|0;g=c[d>>2]|0;f[g+(i*48|0)+24>>2]=B;f[g+(i*48|0)+28>>2]=C;return}default:return}}function Sf(a,b){a=a|0;b=b|0;return}function Tf(a){a=a|0;di(a);gi(a);return}function Uf(a){a=a|0;var b=0,d=0,e=0;b=c[a+12>>2]|0;if(!b)return;c[b>>2]=5476;a=c[b+12>>2]|0;if(a|0?(d=a+4|0,e=c[d>>2]|0,c[d>>2]=e+-1,(e|0)==0):0){Ja[c[(c[a>>2]|0)+8>>2]&255](a);ei(a)}gi(b);return}function Vf(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==11703?a+12|0:0)|0}function Wf(a){a=a|0;gi(a);return}function Xf(b,d,e){b=b|0;d=d|0;e=+e;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0;f=c[b+8>>2]|0;g=c[b+12>>2]|0;if((f|0)==(g|0)){h=1;i=b+4|0;j=h&1;a[i>>0]=j;return}k=1;l=f;while(1){f=c[l>>2]|0;m=c[l+4>>2]|0;n=(m|0)==0;if(!n){o=m+4|0;c[o>>2]=(c[o>>2]|0)+1}if(!(a[f+4>>0]|0)){Ma[c[c[f>>2]>>2]&3](f,d,e);p=0}else p=k;if(!n?(n=m+4|0,f=c[n>>2]|0,c[n>>2]=f+-1,(f|0)==0):0){Ja[c[(c[m>>2]|0)+8>>2]&255](m);ei(m)}l=l+8|0;if((l|0)==(g|0)){h=p;break}else k=p}i=b+4|0;j=h&1;a[i>>0]=j;return}function Yf(a,b){a=a|0;b=b|0;return}function Zf(a){a=a|0;di(a);gi(a);return}function _f(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0;b=c[a+12>>2]|0;if(!b)return;c[b>>2]=5516;a=b+8|0;d=c[a>>2]|0;if(d|0){e=b+12|0;f=c[e>>2]|0;if((f|0)==(d|0))g=d;else{h=f;do{f=c[h+-4>>2]|0;h=h+-8|0;if(f|0?(i=f+4|0,j=c[i>>2]|0,c[i>>2]=j+-1,(j|0)==0):0){Ja[c[(c[f>>2]|0)+8>>2]&255](f);ei(f)}}while((h|0)!=(d|0));g=c[a>>2]|0}c[e>>2]=d;gi(g)}gi(b);return}function $f(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==11860?a+12|0:0)|0}function ag(a){a=a|0;gi(a);return}function bg(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0;d=a+4|0;e=c[d>>2]|0;f=c[a>>2]|0;g=e-f>>3;h=g+1|0;i=f;j=e;if(h>>>0>536870911)qi(a);e=a+8|0;k=(c[e>>2]|0)-f|0;l=k>>2;m=k>>3>>>0<268435455?(l>>>0<h>>>0?h:l):536870911;do if(m)if(m>>>0>536870911){l=$(8)|0;ji(l,6713);c[l>>2]=6464;da(l|0,4040,146)}else{n=fi(m<<3)|0;break}else n=0;while(0);l=n+(g<<3)|0;h=n+(m<<3)|0;c[l>>2]=c[b>>2];m=b+4|0;c[n+(g<<3)+4>>2]=c[m>>2];c[b>>2]=0;c[m>>2]=0;m=l+8|0;if((j|0)==(i|0)){o=l;p=i;q=f}else{b=g+-1-((j+-8+(0-f)|0)>>>3)|0;f=j;j=l;do{l=j;j=j+-8|0;g=f;f=f+-8|0;c[j>>2]=c[f>>2];k=g+-4|0;c[l+-4>>2]=c[k>>2];c[f>>2]=0;c[k>>2]=0}while((f|0)!=(i|0));i=c[a>>2]|0;o=n+(b<<3)|0;p=i;q=i}c[a>>2]=o;o=c[d>>2]|0;c[d>>2]=m;c[e>>2]=h;if((o|0)!=(p|0)){h=o;do{o=c[h+-4>>2]|0;h=h+-8|0;if(o|0?(e=o+4|0,m=c[e>>2]|0,c[e>>2]=m+-1,(m|0)==0):0){Ja[c[(c[o>>2]|0)+8>>2]&255](o);ei(o)}}while((h|0)!=(p|0))}if(!q)return;gi(q);return}function cg(b,d,e){b=b|0;d=d|0;e=+e;var f=0,g=0,h=0,i=0,j=0,k=0,l=0;f=b+8|0;g=b+12|0;h=c[f>>2]|0;i=h;j=b+4|0;if((c[g>>2]|0)!=(h|0)?(a[j>>0]|0)==0:0){h=b+20|0;b=c[h>>2]|0;k=c[i+(b<<3)>>2]|0;l=c[i+(b<<3)+4>>2]|0;b=(l|0)==0;if(!b){i=l+4|0;c[i>>2]=(c[i>>2]|0)+1}Ma[c[c[k>>2]>>2]&3](k,d,e);if(a[k+4>>0]|0?(k=(c[h>>2]|0)+1|0,c[h>>2]=k,k>>>0>=(c[g>>2]|0)-(c[f>>2]|0)>>3>>>0):0)a[j>>0]=1;if(b)return;b=l+4|0;f=c[b>>2]|0;c[b>>2]=f+-1;if(f|0)return;Ja[c[(c[l>>2]|0)+8>>2]&255](l);ei(l);return}a[j>>0]=1;return}function dg(a,b){a=a|0;b=b|0;return}function eg(a){a=a|0;di(a);gi(a);return}function fg(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0;b=c[a+12>>2]|0;if(!b)return;c[b>>2]=5556;a=b+8|0;d=c[a>>2]|0;if(d|0){e=b+12|0;f=c[e>>2]|0;if((f|0)==(d|0))g=d;else{h=f;do{f=c[h+-4>>2]|0;h=h+-8|0;if(f|0?(i=f+4|0,j=c[i>>2]|0,c[i>>2]=j+-1,(j|0)==0):0){Ja[c[(c[f>>2]|0)+8>>2]&255](f);ei(f)}}while((h|0)!=(d|0));g=c[a>>2]|0}c[e>>2]=d;gi(g)}gi(b);return}function gg(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==12023?a+12|0:0)|0}function hg(a){a=a|0;gi(a);return}function ig(a,b){a=a|0;b=b|0;return}function jg(a){a=a|0;di(a);gi(a);return}function kg(a){a=a|0;var b=0,d=0,e=0;b=c[a+12>>2]|0;if(!b)return;c[b>>2]=4132;a=c[b+20>>2]|0;if(a|0?(d=a+4|0,e=c[d>>2]|0,c[d>>2]=e+-1,(e|0)==0):0){Ja[c[(c[a>>2]|0)+8>>2]&255](a);ei(a)}a=c[b+4>>2]|0;if(a|0){c[b+8>>2]=a;gi(a)}gi(b);return}function lg(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==12164?a+12|0:0)|0}function mg(a){a=a|0;gi(a);return}function ng(a){a=a|0;di(a);gi(a);return}function og(a){a=a|0;var b=0,d=0,e=0;b=c[a+12>>2]|0;if(!b)return;c[b>>2]=4132;a=c[b+20>>2]|0;if(a|0?(d=a+4|0,e=c[d>>2]|0,c[d>>2]=e+-1,(e|0)==0):0){Ja[c[(c[a>>2]|0)+8>>2]&255](a);ei(a)}a=c[b+4>>2]|0;if(a|0){c[b+8>>2]=a;gi(a)}gi(b);return}function pg(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==12300?a+12|0:0)|0}function qg(a){a=a|0;gi(a);return}function rg(a){a=a|0;di(a);gi(a);return}function sg(a){a=a|0;var b=0,d=0,e=0;b=c[a+12>>2]|0;if(!b)return;c[b>>2]=4132;a=c[b+20>>2]|0;if(a|0?(d=a+4|0,e=c[d>>2]|0,c[d>>2]=e+-1,(e|0)==0):0){Ja[c[(c[a>>2]|0)+8>>2]&255](a);ei(a)}a=c[b+4>>2]|0;if(a|0){c[b+8>>2]=a;gi(a)}gi(b);return}function tg(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==12436?a+12|0:0)|0}function ug(a){a=a|0;gi(a);return}function vg(a){a=a|0;di(a);gi(a);return}function wg(a){a=a|0;var b=0,d=0,e=0;b=c[a+12>>2]|0;if(!b)return;c[b>>2]=4132;a=c[b+20>>2]|0;if(a|0?(d=a+4|0,e=c[d>>2]|0,c[d>>2]=e+-1,(e|0)==0):0){Ja[c[(c[a>>2]|0)+8>>2]&255](a);ei(a)}a=c[b+4>>2]|0;if(a|0){c[b+8>>2]=a;gi(a)}gi(b);return}function xg(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==12572?a+12|0:0)|0}function yg(a){a=a|0;gi(a);return}function zg(a){a=a|0;di(a);gi(a);return}function Ag(a){a=a|0;var b=0,d=0,e=0;b=c[a+12>>2]|0;if(!b)return;c[b>>2]=4132;a=c[b+20>>2]|0;if(a|0?(d=a+4|0,e=c[d>>2]|0,c[d>>2]=e+-1,(e|0)==0):0){Ja[c[(c[a>>2]|0)+8>>2]&255](a);ei(a)}a=c[b+4>>2]|0;if(a|0){c[b+8>>2]=a;gi(a)}gi(b);return}function Bg(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==12707?a+12|0:0)|0}function Cg(a){a=a|0;gi(a);return}function Dg(a){a=a|0;di(a);gi(a);return}function Eg(a){a=a|0;var b=0,d=0,e=0;b=c[a+12>>2]|0;if(!b)return;c[b>>2]=5276;a=c[b+36>>2]|0;if(a|0?(d=a+4|0,e=c[d>>2]|0,c[d>>2]=e+-1,(e|0)==0):0){Ja[c[(c[a>>2]|0)+8>>2]&255](a);ei(a)}c[b>>2]=4132;a=c[b+20>>2]|0;if(a|0?(e=a+4|0,d=c[e>>2]|0,c[e>>2]=d+-1,(d|0)==0):0){Ja[c[(c[a>>2]|0)+8>>2]&255](a);ei(a)}a=c[b+4>>2]|0;if(a|0){c[b+8>>2]=a;gi(a)}gi(b);return}function Fg(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==12840?a+12|0:0)|0}function Gg(a){a=a|0;gi(a);return}function Hg(a,b){a=a|0;b=b|0;return}function Ig(a){a=a|0;di(a);gi(a);return}function Jg(a){a=a|0;var b=0,d=0,e=0;b=c[a+12>>2]|0;if(!b)return;c[b>>2]=4132;a=c[b+20>>2]|0;if(a|0?(d=a+4|0,e=c[d>>2]|0,c[d>>2]=e+-1,(e|0)==0):0){Ja[c[(c[a>>2]|0)+8>>2]&255](a);ei(a)}a=c[b+4>>2]|0;if(a|0){c[b+8>>2]=a;gi(a)}gi(b);return}function Kg(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==12973?a+12|0:0)|0}function Lg(a){a=a|0;gi(a);return}function Mg(a){a=a|0;gi(a);return}function Ng(a){a=a|0;var b=0,d=0,e=0;b=fi(44)|0;c[b>>2]=5792;d=b+4|0;e=a+4|0;a=d+40|0;do{c[d>>2]=c[e>>2];d=d+4|0;e=e+4|0}while((d|0)<(a|0));return b|0}function Og(a,b){a=a|0;b=b|0;var d=0;c[b>>2]=5792;d=b+4|0;b=a+4|0;a=d+40|0;do{c[d>>2]=c[b>>2];d=d+4|0;b=b+4|0}while((d|0)<(a|0));return}function Pg(a){a=a|0;return}function Qg(a){a=a|0;gi(a);return}function Rg(a){a=a|0;var b=0,d=0,e=0.0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0;b=Ca;Ca=Ca+16|0;if((Ca|0)>=(Da|0))z(16);d=b;e=+pa();g[c[a+4>>2]>>3]=e;h=Q()|0;i=a+8|0;if((h|0)==(c[c[i>>2]>>2]|0)){j=a+12|0;k=c[j>>2]|0;Ug(k);Ca=b;return}c[d>>2]=h;Vh(13079,d)|0;c[c[i>>2]>>2]=h;switch(h|0){case 0:{h=c[a+12>>2]|0;i=c[a+16>>2]|0;l=c[i>>2]|0;m=c[i+4>>2]|0;i=(m|0)==0;if(!i){n=m+4|0;c[n>>2]=(c[n>>2]|0)+1;c[n>>2]=(c[n>>2]|0)+1}n=h+32|0;c[n>>2]=l;l=h+36|0;o=c[l>>2]|0;c[l>>2]=m;if(o|0?(l=o+4|0,p=c[l>>2]|0,c[l>>2]=p+-1,(p|0)==0):0){Ja[c[(c[o>>2]|0)+8>>2]&255](o);ei(o)}o=c[n>>2]|0;n=h+24|0;h=n;p=c[h+4>>2]|0;l=o+24|0;c[l>>2]=c[h>>2];c[l+4>>2]=p;p=c[o+16>>2]|0;if(p|0){l=c[(c[p>>2]|0)+4>>2]|0;f[d>>2]=0.0;f[d+4>>2]=0.0;Oa[l&31](p,o+4|0,d,n)}if(i){j=a+12|0;k=c[j>>2]|0;Ug(k);Ca=b;return}i=m+4|0;n=c[i>>2]|0;c[i>>2]=n+-1;if(n|0){j=a+12|0;k=c[j>>2]|0;Ug(k);Ca=b;return}Ja[c[(c[m>>2]|0)+8>>2]&255](m);ei(m);j=a+12|0;k=c[j>>2]|0;Ug(k);Ca=b;return}case 1:{m=c[a+12>>2]|0;n=c[a+20>>2]|0;i=c[n>>2]|0;o=c[n+4>>2]|0;n=(o|0)==0;if(!n){p=o+4|0;c[p>>2]=(c[p>>2]|0)+1;c[p>>2]=(c[p>>2]|0)+1}p=m+32|0;c[p>>2]=i;i=m+36|0;l=c[i>>2]|0;c[i>>2]=o;if(l|0?(i=l+4|0,h=c[i>>2]|0,c[i>>2]=h+-1,(h|0)==0):0){Ja[c[(c[l>>2]|0)+8>>2]&255](l);ei(l)}l=c[p>>2]|0;p=m+24|0;m=p;h=c[m+4>>2]|0;i=l+24|0;c[i>>2]=c[m>>2];c[i+4>>2]=h;h=c[l+16>>2]|0;if(h|0){i=c[(c[h>>2]|0)+4>>2]|0;f[d>>2]=0.0;f[d+4>>2]=0.0;Oa[i&31](h,l+4|0,d,p)}if(n){j=a+12|0;k=c[j>>2]|0;Ug(k);Ca=b;return}n=o+4|0;p=c[n>>2]|0;c[n>>2]=p+-1;if(p|0){j=a+12|0;k=c[j>>2]|0;Ug(k);Ca=b;return}Ja[c[(c[o>>2]|0)+8>>2]&255](o);ei(o);j=a+12|0;k=c[j>>2]|0;Ug(k);Ca=b;return}case 2:{o=c[a+12>>2]|0;p=c[a+24>>2]|0;n=c[p>>2]|0;l=c[p+4>>2]|0;p=(l|0)==0;if(!p){h=l+4|0;c[h>>2]=(c[h>>2]|0)+1;c[h>>2]=(c[h>>2]|0)+1}h=o+32|0;c[h>>2]=n;n=o+36|0;i=c[n>>2]|0;c[n>>2]=l;if(i|0?(n=i+4|0,m=c[n>>2]|0,c[n>>2]=m+-1,(m|0)==0):0){Ja[c[(c[i>>2]|0)+8>>2]&255](i);ei(i)}i=c[h>>2]|0;h=o+24|0;o=h;m=c[o+4>>2]|0;n=i+24|0;c[n>>2]=c[o>>2];c[n+4>>2]=m;m=c[i+16>>2]|0;if(m|0){n=c[(c[m>>2]|0)+4>>2]|0;f[d>>2]=0.0;f[d+4>>2]=0.0;Oa[n&31](m,i+4|0,d,h)}if(p){j=a+12|0;k=c[j>>2]|0;Ug(k);Ca=b;return}p=l+4|0;h=c[p>>2]|0;c[p>>2]=h+-1;if(h|0){j=a+12|0;k=c[j>>2]|0;Ug(k);Ca=b;return}Ja[c[(c[l>>2]|0)+8>>2]&255](l);ei(l);j=a+12|0;k=c[j>>2]|0;Ug(k);Ca=b;return}case 3:{l=c[a+12>>2]|0;h=c[a+28>>2]|0;p=c[h>>2]|0;i=c[h+4>>2]|0;h=(i|0)==0;if(!h){m=i+4|0;c[m>>2]=(c[m>>2]|0)+1;c[m>>2]=(c[m>>2]|0)+1}m=l+32|0;c[m>>2]=p;p=l+36|0;n=c[p>>2]|0;c[p>>2]=i;if(n|0?(p=n+4|0,o=c[p>>2]|0,c[p>>2]=o+-1,(o|0)==0):0){Ja[c[(c[n>>2]|0)+8>>2]&255](n);ei(n)}n=c[m>>2]|0;m=l+24|0;l=m;o=c[l+4>>2]|0;p=n+24|0;c[p>>2]=c[l>>2];c[p+4>>2]=o;o=c[n+16>>2]|0;if(o|0){p=c[(c[o>>2]|0)+4>>2]|0;f[d>>2]=0.0;f[d+4>>2]=0.0;Oa[p&31](o,n+4|0,d,m)}if(h){j=a+12|0;k=c[j>>2]|0;Ug(k);Ca=b;return}h=i+4|0;m=c[h>>2]|0;c[h>>2]=m+-1;if(m|0){j=a+12|0;k=c[j>>2]|0;Ug(k);Ca=b;return}Ja[c[(c[i>>2]|0)+8>>2]&255](i);ei(i);j=a+12|0;k=c[j>>2]|0;Ug(k);Ca=b;return}case 4:{i=c[a+12>>2]|0;m=c[a+32>>2]|0;h=c[m>>2]|0;n=c[m+4>>2]|0;m=(n|0)==0;if(!m){o=n+4|0;c[o>>2]=(c[o>>2]|0)+1;c[o>>2]=(c[o>>2]|0)+1}o=i+32|0;c[o>>2]=h;h=i+36|0;p=c[h>>2]|0;c[h>>2]=n;if(p|0?(h=p+4|0,l=c[h>>2]|0,c[h>>2]=l+-1,(l|0)==0):0){Ja[c[(c[p>>2]|0)+8>>2]&255](p);ei(p)}p=c[o>>2]|0;o=i+24|0;i=o;l=c[i+4>>2]|0;h=p+24|0;c[h>>2]=c[i>>2];c[h+4>>2]=l;l=c[p+16>>2]|0;if(l|0){h=c[(c[l>>2]|0)+4>>2]|0;f[d>>2]=0.0;f[d+4>>2]=0.0;Oa[h&31](l,p+4|0,d,o)}if(m){j=a+12|0;k=c[j>>2]|0;Ug(k);Ca=b;return}m=n+4|0;o=c[m>>2]|0;c[m>>2]=o+-1;if(o|0){j=a+12|0;k=c[j>>2]|0;Ug(k);Ca=b;return}Ja[c[(c[n>>2]|0)+8>>2]&255](n);ei(n);j=a+12|0;k=c[j>>2]|0;Ug(k);Ca=b;return}case 5:{n=c[a+12>>2]|0;o=c[a+36>>2]|0;m=c[o>>2]|0;p=c[o+4>>2]|0;o=(p|0)==0;if(!o){l=p+4|0;c[l>>2]=(c[l>>2]|0)+1;c[l>>2]=(c[l>>2]|0)+1}l=n+32|0;c[l>>2]=m;m=n+36|0;h=c[m>>2]|0;c[m>>2]=p;if(h|0?(m=h+4|0,i=c[m>>2]|0,c[m>>2]=i+-1,(i|0)==0):0){Ja[c[(c[h>>2]|0)+8>>2]&255](h);ei(h)}h=c[l>>2]|0;l=n+24|0;n=l;i=c[n+4>>2]|0;m=h+24|0;c[m>>2]=c[n>>2];c[m+4>>2]=i;i=c[h+16>>2]|0;if(i|0){m=c[(c[i>>2]|0)+4>>2]|0;f[d>>2]=0.0;f[d+4>>2]=0.0;Oa[m&31](i,h+4|0,d,l)}if(o){j=a+12|0;k=c[j>>2]|0;Ug(k);Ca=b;return}o=p+4|0;l=c[o>>2]|0;c[o>>2]=l+-1;if(l|0){j=a+12|0;k=c[j>>2]|0;Ug(k);Ca=b;return}Ja[c[(c[p>>2]|0)+8>>2]&255](p);ei(p);j=a+12|0;k=c[j>>2]|0;Ug(k);Ca=b;return}case 6:{p=c[a+12>>2]|0;l=c[a+40>>2]|0;o=c[l>>2]|0;h=c[l+4>>2]|0;l=(h|0)==0;if(!l){i=h+4|0;c[i>>2]=(c[i>>2]|0)+1;c[i>>2]=(c[i>>2]|0)+1}i=p+32|0;c[i>>2]=o;o=p+36|0;m=c[o>>2]|0;c[o>>2]=h;if(m|0?(o=m+4|0,n=c[o>>2]|0,c[o>>2]=n+-1,(n|0)==0):0){Ja[c[(c[m>>2]|0)+8>>2]&255](m);ei(m)}m=c[i>>2]|0;i=p+24|0;p=i;n=c[p+4>>2]|0;o=m+24|0;c[o>>2]=c[p>>2];c[o+4>>2]=n;n=c[m+16>>2]|0;if(n|0){o=c[(c[n>>2]|0)+4>>2]|0;f[d>>2]=0.0;f[d+4>>2]=0.0;Oa[o&31](n,m+4|0,d,i)}if(l){j=a+12|0;k=c[j>>2]|0;Ug(k);Ca=b;return}l=h+4|0;i=c[l>>2]|0;c[l>>2]=i+-1;if(i|0){j=a+12|0;k=c[j>>2]|0;Ug(k);Ca=b;return}Ja[c[(c[h>>2]|0)+8>>2]&255](h);ei(h);j=a+12|0;k=c[j>>2]|0;Ug(k);Ca=b;return}default:{j=a+12|0;k=c[j>>2]|0;Ug(k);Ca=b;return}}}function Sg(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==13168?a+4|0:0)|0}function Tg(a){a=a|0;return 3904}function Ug(a){a=a|0;var b=0,d=0,e=0,h=0.0,i=0.0,j=0.0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0;b=Ca;Ca=Ca+16|0;if((Ca|0)>=(Da|0))z(16);d=b;e=a+12|0;c[e>>2]=(c[e>>2]|0)+1;h=+pa();M();i=+va();j=+ua();k=a+24|0;l=a+28|0;if(i==+f[k>>2]?j==+f[l>>2]:0)m=a+32|0;else{g[d>>3]=i;g[d+8>>3]=j;Vh(13093,d)|0;f[k>>2]=i;f[l>>2]=j;l=a+32|0;n=c[l>>2]|0;o=k;p=c[o+4>>2]|0;q=n+24|0;c[q>>2]=c[o>>2];c[q+4>>2]=p;p=c[n+16>>2]|0;if(!p)m=l;else{q=c[(c[p>>2]|0)+4>>2]|0;f[d>>2]=0.0;f[d+4>>2]=0.0;Oa[q&31](p,n+4|0,d,k);m=l}}Vg(a);l=c[m>>2]|0;m=a+16|0;j=h-+g[m>>3];Ka[c[c[l>>2]>>2]&1](l,j,a);k=c[l+16>>2]|0;if(!k){r=c[e>>2]|0;Wg(a,h,r,0);g[m>>3]=h;Ca=b;return}_g(k,l+4|0,j);r=c[e>>2]|0;Wg(a,h,r,0);g[m>>3]=h;Ca=b;return}function Vg(a){a=a|0;var b=0,e=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,A=0,B=0.0,C=0;b=Ca;Ca=Ca+96|0;if((Ca|0)>=(Da|0))z(96);e=b+64|0;g=b+48|0;h=b;i=b+80|0;j=b+72|0;if(!(Y(h|0)|0)){Ca=b;return}k=h+16|0;l=a+32|0;m=h+20|0;n=h+24|0;o=i+4|0;p=h+28|0;q=h+32|0;r=j+4|0;s=h+17|0;t=h+20|0;u=i+4|0;v=i+4|0;w=h+8|0;a:while(1){switch(c[h>>2]|0){case 256:{x=4;break a;break}case 769:{y=c[k>>2]|0;A=(c[a>>2]|0)+(y>>>5<<2)|0;c[A>>2]=c[A>>2]&~(1<<(y&31));A=c[l>>2]|0;La[c[(c[A>>2]|0)+4>>2]&31](A,y);break}case 768:{y=c[k>>2]|0;A=(c[a>>2]|0)+(y>>>5<<2)|0;c[A>>2]=c[A>>2]|1<<(y&31);A=c[l>>2]|0;La[c[(c[A>>2]|0)+8>>2]&31](A,y);break}case 1024:{y=c[l>>2]|0;B=+(c[n>>2]|0);f[i>>2]=+(c[m>>2]|0);f[o>>2]=B;B=+(c[q>>2]|0);f[j>>2]=+(c[p>>2]|0);f[r>>2]=B;A=c[y+16>>2]|0;if(A|0)Xg(A,y+4|0,i,j)|0;break}case 1025:{y=d[s>>0]|0;A=c[t>>2]|0;C=c[n>>2]|0;c[g>>2]=d[k>>0];c[g+4>>2]=y;c[g+8>>2]=A;c[g+12>>2]=C;Vh(13121,g)|0;C=c[l>>2]|0;B=+(c[n>>2]|0);f[i>>2]=+(c[t>>2]|0);f[u>>2]=B;A=c[C+16>>2]|0;if(A|0)Yg(A,C+4|0,i)|0;break}case 1026:{C=c[l>>2]|0;B=+(c[n>>2]|0);f[i>>2]=+(c[t>>2]|0);f[v>>2]=B;A=c[C+16>>2]|0;if(A|0)Zg(A,C+4|0,i)|0;break}case 512:{C=d[w>>0]|0;c[e>>2]=512;c[e+4>>2]=C;Vh(13148,e)|0;break}default:{}}if(!(Y(h|0)|0)){x=18;break}}if((x|0)==4)Oi();else if((x|0)==18){Ca=b;return}}function Wg(b,d,e,g){b=b|0;d=+d;e=e|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0.0,s=0,t=0,u=0,v=0,w=0;g=Ca;Ca=Ca+16|0;if((Ca|0)>=(Da|0))z(16);e=g;h=c[b+32>>2]|0;b=h+4|0;c[e>>2]=0;i=e+4|0;c[i>>2]=0;j=e+8|0;c[j>>2]=0;k=h+8|0;h=(c[k>>2]|0)-(c[b>>2]|0)|0;l=(h|0)/48|0;if(h){if(l>>>0>89478485)qi(e);m=fi(h)|0;c[i>>2]=m;c[e>>2]=m;c[j>>2]=m+(l*48|0);l=c[b>>2]|0;b=(c[k>>2]|0)-l|0;if((b|0)>0){rj(m|0,l|0,b|0)|0;l=m+(((b>>>0)/48|0)*48|0)|0;c[i>>2]=l;if((l|0)==(m|0)){n=m;o=i}else{l=0;b=m;k=0;do{j=b+(k*48|0)|0;switch(c[b+(k*48|0)+44>>2]|0){case 1:{if(!(c[b+(k*48|0)+40>>2]|0)){p=c[b+(k*48|0)+36>>2]|0;q=0}else{p=k;q=l}break}case 2:{d=+f[b+(k*48|0)+16>>2];r=+f[b+(k*48|0)+20>>2];N(+(+f[j>>2]+d),+(+f[b+(k*48|0)+4>>2]+r),+d,+r,c[b+(k*48|0)+32>>2]|0);p=k;q=l;break}case 3:{r=+f[b+(k*48|0)+16>>2];d=+f[b+(k*48|0)+20>>2];U(+(+f[j>>2]+r),+(+f[b+(k*48|0)+4>>2]+d),+r,+d,+(+f[b+(k*48|0)+24>>2]),c[b+(k*48|0)+32>>2]|0);p=k;q=l;break}case 4:{O(+(+f[j>>2]),+(+f[b+(k*48|0)+4>>2]),+(+f[b+(k*48|0)+16>>2]),+(+f[b+(k*48|0)+20>>2]),c[b+(k*48|0)+32>>2]|0);p=k;q=l;break}case 5:{T(+(+f[j>>2]),+(+f[b+(k*48|0)+4>>2]),+(+f[b+(k*48|0)+16>>2]),+(+f[b+(k*48|0)+20>>2]),+(+f[b+(k*48|0)+24>>2]),+(+f[b+(k*48|0)+28>>2]),c[b+(k*48|0)+32>>2]|0,c[b+(k*48|0)+36>>2]|0);p=k;q=l;break}case 6:{h=(c[3810]|0)+((c[b+(k*48|0)+36>>2]|0)*12|0)|0;if((a[h+11>>0]|0)<0)s=c[h>>2]|0;else s=h;d=+f[b+(k*48|0)+24>>2];P(s|0,+(+f[j>>2]),+(+f[b+(k*48|0)+4>>2]+d),+d,c[b+(k*48|0)+32>>2]|0);p=k;q=l;break}default:{p=k;q=l}}k=jj(p|0,q|0,1,0)|0;l=y()|0;b=c[e>>2]|0}while((l|0)<0|((l|0)==0?k>>>0<(((c[i>>2]|0)-b|0)/48|0)>>>0:0));t=i;u=b;v=9}}else{w=m;v=5}}else{w=0;v=5}if((v|0)==5){t=i;u=w;v=9}if((v|0)==9)if(!u){Ca=g;return}else{n=u;o=t}c[o>>2]=n;gi(n);Ca=g;return}function Xg(b,d,e,g){b=b|0;d=d|0;e=e|0;g=g|0;var i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0.0,r=0.0,s=0,t=0.0,u=0.0,v=0,w=0,x=0.0,y=0.0,A=0.0,B=0.0,C=0,D=0,E=0;i=Ca;Ca=Ca+16|0;if((Ca|0)>=(Da|0))z(16);j=i+8|0;k=i;l=b+4|0;m=c[l>>2]|0;n=c[d>>2]|0;if(!(c[n+(m*48|0)+40>>2]|0)){o=0;Ca=i;return o|0}if(a[b+61>>0]|0){p=n+(m*48|0)+16|0;q=+f[p>>2];r=q+ +f[g>>2];s=n+(m*48|0)+20|0;t=+f[s>>2];u=t+ +f[g+4>>2];f[j>>2]=r;v=j+4|0;f[v>>2]=u;w=c[b+80>>2]|0;if(!w){x=r;y=q;A=u;B=t;C=n;D=m}else{La[c[(c[w>>2]|0)+24>>2]&31](w,j);x=+f[j>>2];y=+f[p>>2];A=+f[v>>2];B=+f[s>>2];C=c[d>>2]|0;D=c[l>>2]|0}l=j;j=c[l+4>>2]|0;s=C+(D*48|0)+16|0;c[s>>2]=c[l>>2];c[s+4>>2]=j;j=b+16|0;s=j;l=c[s>>2]|0;D=c[s+4>>2]|0;s=k;c[s>>2]=l;c[s+4>>2]=D;D=b+20|0;t=A-B+ +f[D>>2];f[j>>2]=x-y+(c[h>>2]=l,+f[h>>2]);f[D>>2]=t;Oa[c[(c[b>>2]|0)+8>>2]&31](b,d,k,b+24|0);Fb(b,d)}k=b+176|0;D=c[k>>2]|0;l=(c[b+180>>2]|0)-D|0;if((l|0)<=0){o=0;Ca=i;return o|0}b=(l>>>3)+-1|0;l=D;while(1){D=c[l+(b<<3)>>2]|0;j=c[l+(b<<3)+4>>2]|0;s=(j|0)==0;if(!s){C=j+4|0;c[C>>2]=(c[C>>2]|0)+1}C=Xg(D,d,e,g)|0;if(!s?(s=j+4|0,D=c[s>>2]|0,c[s>>2]=D+-1,(D|0)==0):0){Ja[c[(c[j>>2]|0)+8>>2]&255](j);ei(j)}if(C){o=1;E=16;break}C=b+-1|0;if((C|0)<=-1){o=0;E=16;break}b=C;l=c[k>>2]|0}if((E|0)==16){Ca=i;return o|0}return 0}function Yg(b,d,e){b=b|0;d=d|0;e=e|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0.0,r=0.0,s=0.0;if(!(c[(c[d>>2]|0)+((c[b+4>>2]|0)*48|0)+40>>2]|0)){g=0;return g|0}h=b+176|0;i=c[h>>2]|0;j=(c[b+180>>2]|0)-i|0;a:do if((j|0)>0){k=(j>>>3)+-1|0;l=i;while(1){m=c[l+(k<<3)>>2]|0;n=c[l+(k<<3)+4>>2]|0;o=(n|0)==0;if(!o){p=n+4|0;c[p>>2]=(c[p>>2]|0)+1}p=Yg(m,d,e)|0;if(!o?(o=n+4|0,m=c[o>>2]|0,c[o>>2]=m+-1,(m|0)==0):0){Ja[c[(c[n>>2]|0)+8>>2]&255](n);ei(n)}if(p){g=1;break}p=k+-1|0;if((p|0)<=-1)break a;k=p;l=c[h>>2]|0}return g|0}while(0);if((((a[b+88>>0]|0?(q=+f[e>>2],r=+f[e+4>>2],s=+f[b+16>>2],s<=q):0)?s+ +f[b+24>>2]>=q:0)?(q=+f[b+20>>2],q<=r):0)?q+ +f[b+28>>2]>=r:0){a[b+89>>0]=1;h=c[b+112>>2]|0;if(!h){g=1;return g|0}Ja[c[(c[h>>2]|0)+24>>2]&255](h);g=1;return g|0}if(!(a[b+60>>0]|0)){g=0;return g|0}r=+f[e>>2];q=+f[e+4>>2];s=+f[b+16>>2];if(!(s<=r)){g=0;return g|0}if(!(s+ +f[b+24>>2]>=r)){g=0;return g|0}r=+f[b+20>>2];if(!(r<=q)){g=0;return g|0}if(!(r+ +f[b+28>>2]>=q)){g=0;return g|0}Xh(13386)|0;a[b+61>>0]=1;g=1;return g|0}function Zg(b,d,e){b=b|0;d=d|0;e=e|0;var g=0,h=0,i=0.0,j=0.0,k=0.0,l=0,m=0,n=0,o=0,p=0,q=0;if(!(c[(c[d>>2]|0)+((c[b+4>>2]|0)*48|0)+40>>2]|0)){g=0;return g|0}if(a[b+88>>0]|0?(h=b+89|0,a[h>>0]|0):0){a[h>>0]=0;h=c[b+136>>2]|0;if(h|0)Ja[c[(c[h>>2]|0)+24>>2]&255](h);h=c[b+160>>2]|0;if(!h){g=1;return g|0}i=+f[e>>2];j=+f[e+4>>2];k=+f[b+16>>2];if(!(k<=i)){g=1;return g|0}if(!(k+ +f[b+24>>2]>=i)){g=1;return g|0}i=+f[b+20>>2];if(!(i<=j)){g=1;return g|0}if(!(i+ +f[b+28>>2]>=j)){g=1;return g|0}La[c[(c[h>>2]|0)+24>>2]&31](h,e);g=1;return g|0}if(a[b+60>>0]|0?(h=b+61|0,a[h>>0]|0):0){a[h>>0]=0;g=1;return g|0}h=b+176|0;l=c[h>>2]|0;m=(c[b+180>>2]|0)-l|0;if((m|0)<=0){g=0;return g|0}b=(m>>>3)+-1|0;m=l;while(1){l=c[m+(b<<3)>>2]|0;n=c[m+(b<<3)+4>>2]|0;o=(n|0)==0;if(!o){p=n+4|0;c[p>>2]=(c[p>>2]|0)+1}p=Zg(l,d,e)|0;if(!o?(o=n+4|0,l=c[o>>2]|0,c[o>>2]=l+-1,(l|0)==0):0){Ja[c[(c[n>>2]|0)+8>>2]&255](n);ei(n)}if(p){g=1;q=25;break}p=b+-1|0;if((p|0)<=-1){g=0;q=25;break}b=p;m=c[h>>2]|0}if((q|0)==25)return g|0;return 0}function _g(a,b,d){a=a|0;b=b|0;d=+d;var e=0,f=0,g=0,h=0,i=0;if(!(c[(c[b>>2]|0)+((c[a+4>>2]|0)*48|0)+40>>2]|0))return;e=c[a+168>>2]|0;if(e|0){Ma[c[c[e>>2]>>2]&3](e,b,d);Oa[c[(c[a>>2]|0)+4>>2]&31](a,b,a+40|0,a+32|0)}e=c[a+176>>2]|0;f=c[a+180>>2]|0;if((e|0)==(f|0))return;a=e;do{e=c[a>>2]|0;g=c[a+4>>2]|0;if(g){h=g+4|0;c[h>>2]=(c[h>>2]|0)+1;_g(e,b,d);h=g+4|0;i=c[h>>2]|0;c[h>>2]=i+-1;if(!i){Ja[c[(c[g>>2]|0)+8>>2]&255](g);ei(g)}}else _g(e,b,d);a=a+8|0}while((a|0)!=(f|0));return}function $g(){c[3810]=0;c[3811]=0;c[3812]=0;c[3813]=0;c[3814]=0;c[3815]=0;c[3816]=0;c[3817]=1065353216;c[3808]=0;return}function ah(a){a=a|0;var b=0,d=0;b=Ca;Ca=Ca+16|0;if((Ca|0)>=(Da|0))z(16);d=b;c[d>>2]=fh(c[a+60>>2]|0)|0;a=dh(la(6,d|0)|0)|0;Ca=b;return a|0}function bh(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0;e=Ca;Ca=Ca+48|0;if((Ca|0)>=(Da|0))z(48);f=e+32|0;g=e+16|0;h=e;i=a+28|0;j=c[i>>2]|0;c[h>>2]=j;k=a+20|0;l=(c[k>>2]|0)-j|0;c[h+4>>2]=l;c[h+8>>2]=b;c[h+12>>2]=d;b=l+d|0;l=a+60|0;c[g>>2]=c[l>>2];c[g+4>>2]=h;c[g+8>>2]=2;j=dh(ja(146,g|0)|0)|0;a:do if((b|0)!=(j|0)){g=2;m=b;n=h;o=j;while(1){if((o|0)<0)break;m=m-o|0;p=c[n+4>>2]|0;q=o>>>0>p>>>0;r=q?n+8|0:n;s=g+(q<<31>>31)|0;t=o-(q?p:0)|0;c[r>>2]=(c[r>>2]|0)+t;p=r+4|0;c[p>>2]=(c[p>>2]|0)-t;c[f>>2]=c[l>>2];c[f+4>>2]=r;c[f+8>>2]=s;o=dh(ja(146,f|0)|0)|0;if((m|0)==(o|0)){u=3;break a}else{g=s;n=r}}c[a+16>>2]=0;c[i>>2]=0;c[k>>2]=0;c[a>>2]=c[a>>2]|32;if((g|0)==2)v=0;else v=d-(c[n+4>>2]|0)|0}else u=3;while(0);if((u|0)==3){u=c[a+44>>2]|0;c[a+16>>2]=u+(c[a+48>>2]|0);a=u;c[i>>2]=a;c[k>>2]=a;v=d}Ca=e;return v|0}function ch(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0;e=Ca;Ca=Ca+32|0;if((Ca|0)>=(Da|0))z(32);f=e;g=e+20|0;c[f>>2]=c[a+60>>2];c[f+4>>2]=0;c[f+8>>2]=b;c[f+12>>2]=g;c[f+16>>2]=d;if((dh(ia(140,f|0)|0)|0)<0){c[g>>2]=-1;h=-1}else h=c[g>>2]|0;Ca=e;return h|0}function dh(a){a=a|0;var b=0;if(a>>>0>4294963200){c[(eh()|0)>>2]=0-a;b=-1}else b=a;return b|0}function eh(){return 15336}function fh(a){a=a|0;return a|0}function gh(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0;f=Ca;Ca=Ca+32|0;if((Ca|0)>=(Da|0))z(32);g=f;c[b+36>>2]=1;if((c[b>>2]&64|0)==0?(c[g>>2]=c[b+60>>2],c[g+4>>2]=21523,c[g+8>>2]=f+16,ka(54,g|0)|0):0)a[b+75>>0]=-1;g=bh(b,d,e)|0;Ca=f;return g|0}function hh(a){a=a|0;return (a+-48|0)>>>0<10|0}function ih(){return 6088}function jh(b,c){b=b|0;c=c|0;var d=0,e=0,f=0,g=0;d=a[b>>0]|0;e=a[c>>0]|0;if(d<<24>>24==0?1:d<<24>>24!=e<<24>>24){f=e;g=d}else{d=c;c=b;do{c=c+1|0;d=d+1|0;b=a[c>>0]|0;e=a[d>>0]|0}while(!(b<<24>>24==0?1:b<<24>>24!=e<<24>>24));f=e;g=b}return (g&255)-(f&255)|0}function kh(b){b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0;d=b;a:do if(!(d&3)){e=b;f=5}else{g=b;h=d;while(1){if(!(a[g>>0]|0)){i=h;break a}j=g+1|0;h=j;if(!(h&3)){e=j;f=5;break}else g=j}}while(0);if((f|0)==5){f=e;while(1){k=c[f>>2]|0;if(!((k&-2139062144^-2139062144)&k+-16843009))f=f+4|0;else break}if(!((k&255)<<24>>24))l=f;else{k=f;while(1){f=k+1|0;if(!(a[f>>0]|0)){l=f;break}else k=f}}i=l}return i-d|0}function lh(a,b){a=a|0;b=b|0;var c=0;c=kh(a)|0;return ((mh(a,1,c,b)|0)!=(c|0))<<31>>31|0}function mh(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0;f=u(d,b)|0;g=(b|0)==0?0:d;if((c[e+76>>2]|0)>-1){d=(oh(e)|0)==0;h=rh(a,f,e)|0;if(d)i=h;else{nh(e);i=h}}else i=rh(a,f,e)|0;if((i|0)==(f|0))j=g;else j=(i>>>0)/(b>>>0)|0;return j|0}function nh(a){a=a|0;return}function oh(a){a=a|0;return 1}function ph(b,e){b=b|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0;f=Ca;Ca=Ca+16|0;if((Ca|0)>=(Da|0))z(16);g=f;h=e&255;a[g>>0]=h;i=b+16|0;j=c[i>>2]|0;if(!j)if(!(qh(b)|0)){k=c[i>>2]|0;l=4}else m=-1;else{k=j;l=4}do if((l|0)==4){j=b+20|0;i=c[j>>2]|0;if(i>>>0<k>>>0?(n=e&255,(n|0)!=(a[b+75>>0]|0)):0){c[j>>2]=i+1;a[i>>0]=h;m=n;break}if((Ha[c[b+36>>2]&7](b,g,1)|0)==1)m=d[g>>0]|0;else m=-1}while(0);Ca=f;return m|0}
function qh(b){b=b|0;var d=0,e=0,f=0;d=b+74|0;e=a[d>>0]|0;a[d>>0]=e+255|e;e=c[b>>2]|0;if(!(e&8)){c[b+8>>2]=0;c[b+4>>2]=0;d=c[b+44>>2]|0;c[b+28>>2]=d;c[b+20>>2]=d;c[b+16>>2]=d+(c[b+48>>2]|0);f=0}else{c[b>>2]=e|32;f=-1}return f|0}function rh(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0;f=e+16|0;g=c[f>>2]|0;if(!g)if(!(qh(e)|0)){h=c[f>>2]|0;i=5}else j=0;else{h=g;i=5}a:do if((i|0)==5){g=e+20|0;f=c[g>>2]|0;k=f;if((h-f|0)>>>0<d>>>0){j=Ha[c[e+36>>2]&7](e,b,d)|0;break}b:do if((a[e+75>>0]|0)<0|(d|0)==0){l=0;m=b;n=d;o=k}else{f=d;while(1){p=f+-1|0;if((a[b+p>>0]|0)==10)break;if(!p){l=0;m=b;n=d;o=k;break b}else f=p}p=Ha[c[e+36>>2]&7](e,b,f)|0;if(p>>>0<f>>>0){j=p;break a}l=f;m=b+f|0;n=d-f|0;o=c[g>>2]|0}while(0);rj(o|0,m|0,n|0)|0;c[g>>2]=(c[g>>2]|0)+n;j=l+n|0}while(0);return j|0}function sh(a,b){a=a|0;b=b|0;var d=0;if(!b)d=0;else d=th(c[b>>2]|0,c[b+4>>2]|0,a)|0;return ((d|0)==0?a:d)|0}function th(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0;f=(c[b>>2]|0)+1794895138|0;g=uh(c[b+8>>2]|0,f)|0;h=uh(c[b+12>>2]|0,f)|0;i=uh(c[b+16>>2]|0,f)|0;a:do if((g>>>0<d>>>2>>>0?(j=d-(g<<2)|0,h>>>0<j>>>0&i>>>0<j>>>0):0)?((i|h)&3|0)==0:0){j=h>>>2;k=i>>>2;l=0;m=g;while(1){n=m>>>1;o=l+n|0;p=o<<1;q=p+j|0;r=uh(c[b+(q<<2)>>2]|0,f)|0;s=uh(c[b+(q+1<<2)>>2]|0,f)|0;if(!(s>>>0<d>>>0&r>>>0<(d-s|0)>>>0)){t=0;break a}if(a[b+(s+r)>>0]|0){t=0;break a}r=jh(e,b+s|0)|0;if(!r)break;s=(r|0)<0;if((m|0)==1){t=0;break a}l=s?l:o;m=s?n:m-n|0}m=p+k|0;l=uh(c[b+(m<<2)>>2]|0,f)|0;j=uh(c[b+(m+1<<2)>>2]|0,f)|0;if(j>>>0<d>>>0&l>>>0<(d-j|0)>>>0)t=(a[b+(j+l)>>0]|0)==0?b+j|0:0;else t=0}else t=0;while(0);return t|0}function uh(a,b){a=a|0;b=b|0;var c=0;c=qj(a|0)|0;return ((b|0)==0?a:c)|0}function vh(){fa(15340);return 15348}function wh(){ma(15340);return}function xh(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0;do if(a){if((c[a+76>>2]|0)<=-1){b=yh(a)|0;break}d=(oh(a)|0)==0;e=yh(a)|0;if(d)b=e;else{nh(a);b=e}}else{if(!(c[1521]|0))f=0;else f=xh(c[1521]|0)|0;e=c[(vh()|0)>>2]|0;if(!e)g=f;else{d=e;e=f;while(1){if((c[d+76>>2]|0)>-1)h=oh(d)|0;else h=0;if((c[d+20>>2]|0)>>>0>(c[d+28>>2]|0)>>>0)i=yh(d)|0|e;else i=e;if(h|0)nh(d);d=c[d+56>>2]|0;if(!d){g=i;break}else e=i}}wh();b=g}while(0);return b|0}function yh(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0;b=a+20|0;d=a+28|0;if((c[b>>2]|0)>>>0>(c[d>>2]|0)>>>0?(Ha[c[a+36>>2]&7](a,0,0)|0,(c[b>>2]|0)==0):0)e=-1;else{f=a+4|0;g=c[f>>2]|0;h=a+8|0;i=c[h>>2]|0;if(g>>>0<i>>>0)Ha[c[a+40>>2]&7](a,g-i|0,1)|0;c[a+16>>2]=0;c[d>>2]=0;c[b>>2]=0;c[h>>2]=0;c[f>>2]=0;e=0}return e|0}function zh(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,v=0,w=0,x=0,y=0;f=d&255;g=(e|0)!=0;a:do if(g&(b&3|0)!=0){h=d&255;i=b;j=e;while(1){if((a[i>>0]|0)==h<<24>>24){k=i;l=j;m=6;break a}n=i+1|0;o=j+-1|0;p=(o|0)!=0;if(p&(n&3|0)!=0){i=n;j=o}else{q=n;r=o;s=p;m=5;break}}}else{q=b;r=e;s=g;m=5}while(0);if((m|0)==5)if(s){k=q;l=r;m=6}else m=16;b:do if((m|0)==6){r=d&255;if((a[k>>0]|0)==r<<24>>24)if(!l){m=16;break}else{t=k;break}q=u(f,16843009)|0;c:do if(l>>>0>3){s=k;g=l;while(1){e=c[s>>2]^q;if((e&-2139062144^-2139062144)&e+-16843009|0){v=g;w=s;break c}e=s+4|0;b=g+-4|0;if(b>>>0>3){s=e;g=b}else{x=e;y=b;m=11;break}}}else{x=k;y=l;m=11}while(0);if((m|0)==11)if(!y){m=16;break}else{v=y;w=x}q=w;g=v;while(1){if((a[q>>0]|0)==r<<24>>24){t=q;break b}g=g+-1|0;if(!g){m=16;break}else q=q+1|0}}while(0);if((m|0)==16)t=0;return t|0}function Ah(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0;f=Ca;Ca=Ca+224|0;if((Ca|0)>=(Da|0))z(224);g=f+208|0;h=f+160|0;i=f+80|0;j=f;k=h;l=k+40|0;do{c[k>>2]=0;k=k+4|0}while((k|0)<(l|0));c[g>>2]=c[e>>2];if((Bh(0,d,g,i,h)|0)<0)m=-1;else{if((c[b+76>>2]|0)>-1)n=oh(b)|0;else n=0;e=c[b>>2]|0;k=e&32;if((a[b+74>>0]|0)<1)c[b>>2]=e&-33;e=b+48|0;if(!(c[e>>2]|0)){l=b+44|0;o=c[l>>2]|0;c[l>>2]=j;p=b+28|0;c[p>>2]=j;q=b+20|0;c[q>>2]=j;c[e>>2]=80;r=b+16|0;c[r>>2]=j+80;j=Bh(b,d,g,i,h)|0;if(!o)s=j;else{Ha[c[b+36>>2]&7](b,0,0)|0;t=(c[q>>2]|0)==0?-1:j;c[l>>2]=o;c[e>>2]=0;c[r>>2]=0;c[p>>2]=0;c[q>>2]=0;s=t}}else s=Bh(b,d,g,i,h)|0;h=c[b>>2]|0;c[b>>2]=h|k;if(n|0)nh(b);m=(h&32|0)==0?s:-1}Ca=f;return m|0}function Bh(d,e,f,h,i){d=d|0;e=e|0;f=f|0;h=h|0;i=i|0;var j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ba=0,ca=0,da=0,ea=0,fa=0,ga=0,ha=0,ia=0,ja=0,ka=0,la=0,ma=0,na=0,oa=0,pa=0,qa=0,ra=0,sa=0,ta=0,ua=0,va=0,wa=0,xa=0,ya=0,za=0,Aa=0,Ba=0,Ea=0,Fa=0;j=Ca;Ca=Ca+64|0;if((Ca|0)>=(Da|0))z(64);k=j+56|0;l=j+40|0;m=j;n=j+48|0;o=j+60|0;c[k>>2]=e;e=(d|0)!=0;p=m+40|0;q=p;r=m+39|0;m=n+4|0;s=0;t=0;u=0;a:while(1){v=s;w=t;while(1){do if((w|0)>-1)if((v|0)>(2147483647-w|0)){c[(eh()|0)>>2]=75;x=-1;break}else{x=v+w|0;break}else x=w;while(0);A=c[k>>2]|0;B=a[A>>0]|0;if(!(B<<24>>24)){C=94;break a}D=B;B=A;b:while(1){switch(D<<24>>24){case 37:{C=10;break b;break}case 0:{E=B;break b;break}default:{}}F=B+1|0;c[k>>2]=F;D=a[F>>0]|0;B=F}c:do if((C|0)==10){C=0;D=B;F=B;while(1){if((a[F+1>>0]|0)!=37){E=D;break c}G=D+1|0;F=F+2|0;c[k>>2]=F;if((a[F>>0]|0)!=37){E=G;break}else D=G}}while(0);v=E-A|0;if(e)Ch(d,A,v);if(!v)break;else w=x}w=(hh(a[(c[k>>2]|0)+1>>0]|0)|0)==0;v=c[k>>2]|0;if(!w?(a[v+2>>0]|0)==36:0){H=(a[v+1>>0]|0)+-48|0;I=1;J=3}else{H=-1;I=u;J=1}w=v+J|0;c[k>>2]=w;v=a[w>>0]|0;B=(v<<24>>24)+-32|0;if(B>>>0>31|(1<<B&75913|0)==0){K=0;L=v;M=w}else{v=0;D=B;B=w;while(1){w=1<<D|v;F=B+1|0;c[k>>2]=F;G=a[F>>0]|0;D=(G<<24>>24)+-32|0;if(D>>>0>31|(1<<D&75913|0)==0){K=w;L=G;M=F;break}else{v=w;B=F}}}if(L<<24>>24==42){if((hh(a[M+1>>0]|0)|0)!=0?(B=c[k>>2]|0,(a[B+2>>0]|0)==36):0){v=B+1|0;c[i+((a[v>>0]|0)+-48<<2)>>2]=10;N=c[h+((a[v>>0]|0)+-48<<3)>>2]|0;O=1;P=B+3|0}else{if(I|0){Q=-1;break}if(e){B=(c[f>>2]|0)+(4-1)&~(4-1);v=c[B>>2]|0;c[f>>2]=B+4;R=v}else R=0;N=R;O=0;P=(c[k>>2]|0)+1|0}c[k>>2]=P;v=(N|0)<0;S=v?0-N|0:N;T=v?K|8192:K;U=O;V=P}else{v=Dh(k)|0;if((v|0)<0){Q=-1;break}S=v;T=K;U=I;V=c[k>>2]|0}do if((a[V>>0]|0)==46){v=V+1|0;if((a[v>>0]|0)!=42){c[k>>2]=v;v=Dh(k)|0;W=v;X=c[k>>2]|0;break}if(hh(a[V+2>>0]|0)|0?(v=c[k>>2]|0,(a[v+3>>0]|0)==36):0){B=v+2|0;c[i+((a[B>>0]|0)+-48<<2)>>2]=10;D=c[h+((a[B>>0]|0)+-48<<3)>>2]|0;B=v+4|0;c[k>>2]=B;W=D;X=B;break}if(U|0){Q=-1;break a}if(e){B=(c[f>>2]|0)+(4-1)&~(4-1);D=c[B>>2]|0;c[f>>2]=B+4;Y=D}else Y=0;D=(c[k>>2]|0)+2|0;c[k>>2]=D;W=Y;X=D}else{W=-1;X=V}while(0);D=0;B=X;while(1){if(((a[B>>0]|0)+-65|0)>>>0>57){Q=-1;break a}v=B;B=B+1|0;c[k>>2]=B;Z=a[(a[v>>0]|0)+-65+(16+(D*58|0))>>0]|0;_=Z&255;if((_+-1|0)>>>0>=8)break;else D=_}if(!(Z<<24>>24)){Q=-1;break}v=(H|0)>-1;do if(Z<<24>>24==19)if(v){Q=-1;break a}else C=54;else{if(v){c[i+(H<<2)>>2]=_;F=h+(H<<3)|0;w=c[F+4>>2]|0;G=l;c[G>>2]=c[F>>2];c[G+4>>2]=w;C=54;break}if(!e){Q=0;break a}Eh(l,_,f);$=c[k>>2]|0;C=55}while(0);if((C|0)==54){C=0;if(e){$=B;C=55}else aa=0}d:do if((C|0)==55){C=0;v=a[$+-1>>0]|0;w=(D|0)!=0&(v&15|0)==3?v&-33:v;v=T&-65537;G=(T&8192|0)==0?T:v;e:do switch(w|0){case 110:{switch((D&255)<<24>>24){case 0:{c[c[l>>2]>>2]=x;aa=0;break d;break}case 1:{c[c[l>>2]>>2]=x;aa=0;break d;break}case 2:{F=c[l>>2]|0;c[F>>2]=x;c[F+4>>2]=((x|0)<0)<<31>>31;aa=0;break d;break}case 3:{b[c[l>>2]>>1]=x;aa=0;break d;break}case 4:{a[c[l>>2]>>0]=x;aa=0;break d;break}case 6:{c[c[l>>2]>>2]=x;aa=0;break d;break}case 7:{F=c[l>>2]|0;c[F>>2]=x;c[F+4>>2]=((x|0)<0)<<31>>31;aa=0;break d;break}default:{aa=0;break d}}break}case 112:{ba=120;ca=W>>>0>8?W:8;da=G|8;C=67;break}case 88:case 120:{ba=w;ca=W;da=G;C=67;break}case 111:{F=l;ea=c[F>>2]|0;fa=c[F+4>>2]|0;F=Gh(ea,fa,p)|0;ga=q-F|0;ha=F;ia=0;ja=13401;ka=(G&8|0)==0|(W|0)>(ga|0)?W:ga+1|0;la=G;ma=ea;na=fa;C=73;break}case 105:case 100:{fa=l;ea=c[fa>>2]|0;ga=c[fa+4>>2]|0;if((ga|0)<0){fa=kj(0,0,ea|0,ga|0)|0;F=y()|0;oa=l;c[oa>>2]=fa;c[oa+4>>2]=F;pa=1;qa=13401;ra=fa;sa=F;C=72;break e}else{pa=(G&2049|0)!=0&1;qa=(G&2048|0)==0?((G&1|0)==0?13401:13403):13402;ra=ea;sa=ga;C=72;break e}break}case 117:{ga=l;pa=0;qa=13401;ra=c[ga>>2]|0;sa=c[ga+4>>2]|0;C=72;break}case 99:{a[r>>0]=c[l>>2];ta=r;ua=0;va=13401;wa=1;xa=v;ya=q;break}case 109:{za=Ih(c[(eh()|0)>>2]|0)|0;C=77;break}case 115:{ga=c[l>>2]|0;za=(ga|0)==0?13411:ga;C=77;break}case 67:{c[n>>2]=c[l>>2];c[m>>2]=0;c[l>>2]=n;Aa=-1;C=81;break}case 83:{if(!W){Jh(d,32,S,0,G);Ba=0;C=91}else{Aa=W;C=81}break}case 65:case 71:case 70:case 69:case 97:case 103:case 102:case 101:{aa=Lh(d,+g[l>>3],S,W,G,w)|0;break d;break}default:{ta=A;ua=0;va=13401;wa=W;xa=G;ya=q}}while(0);f:do if((C|0)==67){C=0;w=l;ga=c[w>>2]|0;ea=c[w+4>>2]|0;w=Fh(ga,ea,p,ba&32)|0;F=(da&8|0)==0|(ga|0)==0&(ea|0)==0;ha=w;ia=F?0:2;ja=F?13401:13401+(ba>>>4)|0;ka=ca;la=da;ma=ga;na=ea;C=73}else if((C|0)==72){C=0;ha=Hh(ra,sa,p)|0;ia=pa;ja=qa;ka=W;la=G;ma=ra;na=sa;C=73}else if((C|0)==77){C=0;ea=zh(za,0,W)|0;ga=(ea|0)==0;ta=za;ua=0;va=13401;wa=ga?W:ea-za|0;xa=v;ya=ga?za+W|0:ea}else if((C|0)==81){C=0;ea=c[l>>2]|0;ga=0;while(1){F=c[ea>>2]|0;if(!F){Ea=ga;break}w=Kh(o,F)|0;Fa=(w|0)<0;if(Fa|w>>>0>(Aa-ga|0)>>>0){C=85;break}F=w+ga|0;if(Aa>>>0>F>>>0){ea=ea+4|0;ga=F}else{Ea=F;break}}if((C|0)==85){C=0;if(Fa){Q=-1;break a}else Ea=ga}Jh(d,32,S,Ea,G);if(!Ea){Ba=0;C=91}else{ea=c[l>>2]|0;F=0;while(1){w=c[ea>>2]|0;if(!w){Ba=Ea;C=91;break f}fa=Kh(o,w)|0;F=fa+F|0;if((F|0)>(Ea|0)){Ba=Ea;C=91;break f}Ch(d,o,fa);if(F>>>0>=Ea>>>0){Ba=Ea;C=91;break}else ea=ea+4|0}}}while(0);if((C|0)==73){C=0;v=(ma|0)!=0|(na|0)!=0;ea=(ka|0)!=0|v;F=q-ha+((v^1)&1)|0;ta=ea?ha:p;ua=ia;va=ja;wa=ea?((ka|0)>(F|0)?ka:F):0;xa=(ka|0)>-1?la&-65537:la;ya=q}else if((C|0)==91){C=0;Jh(d,32,S,Ba,G^8192);aa=(S|0)>(Ba|0)?S:Ba;break}F=ya-ta|0;ea=(wa|0)<(F|0)?F:wa;v=ea+ua|0;ga=(S|0)<(v|0)?v:S;Jh(d,32,ga,v,xa);Ch(d,va,ua);Jh(d,48,ga,v,xa^65536);Jh(d,48,ea,F,0);Ch(d,ta,F);Jh(d,32,ga,v,xa^8192);aa=ga}while(0);s=aa;t=x;u=U}g:do if((C|0)==94)if(!d)if(!u)Q=0;else{U=1;while(1){t=c[i+(U<<2)>>2]|0;if(!t)break;Eh(h+(U<<3)|0,t,f);t=U+1|0;if(t>>>0<10)U=t;else{Q=1;break g}}t=U;while(1){if(c[i+(t<<2)>>2]|0){Q=-1;break g}t=t+1|0;if(t>>>0>=10){Q=1;break}}}else Q=x;while(0);Ca=j;return Q|0}function Ch(a,b,d){a=a|0;b=b|0;d=d|0;if(!(c[a>>2]&32))rh(b,d,a)|0;return}function Dh(b){b=b|0;var d=0,e=0,f=0,g=0,h=0;if(!(hh(a[c[b>>2]>>0]|0)|0))d=0;else{e=0;while(1){f=c[b>>2]|0;g=(e*10|0)+-48+(a[f>>0]|0)|0;h=f+1|0;c[b>>2]=h;if(!(hh(a[h>>0]|0)|0)){d=g;break}else e=g}}return d|0}function Eh(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,h=0,i=0,j=0.0;a:do if(b>>>0<=20)do switch(b|0){case 9:{e=(c[d>>2]|0)+(4-1)&~(4-1);f=c[e>>2]|0;c[d>>2]=e+4;c[a>>2]=f;break a;break}case 10:{f=(c[d>>2]|0)+(4-1)&~(4-1);e=c[f>>2]|0;c[d>>2]=f+4;f=a;c[f>>2]=e;c[f+4>>2]=((e|0)<0)<<31>>31;break a;break}case 11:{e=(c[d>>2]|0)+(4-1)&~(4-1);f=c[e>>2]|0;c[d>>2]=e+4;e=a;c[e>>2]=f;c[e+4>>2]=0;break a;break}case 12:{e=(c[d>>2]|0)+(8-1)&~(8-1);f=e;h=c[f>>2]|0;i=c[f+4>>2]|0;c[d>>2]=e+8;e=a;c[e>>2]=h;c[e+4>>2]=i;break a;break}case 13:{i=(c[d>>2]|0)+(4-1)&~(4-1);e=c[i>>2]|0;c[d>>2]=i+4;i=(e&65535)<<16>>16;e=a;c[e>>2]=i;c[e+4>>2]=((i|0)<0)<<31>>31;break a;break}case 14:{i=(c[d>>2]|0)+(4-1)&~(4-1);e=c[i>>2]|0;c[d>>2]=i+4;i=a;c[i>>2]=e&65535;c[i+4>>2]=0;break a;break}case 15:{i=(c[d>>2]|0)+(4-1)&~(4-1);e=c[i>>2]|0;c[d>>2]=i+4;i=(e&255)<<24>>24;e=a;c[e>>2]=i;c[e+4>>2]=((i|0)<0)<<31>>31;break a;break}case 16:{i=(c[d>>2]|0)+(4-1)&~(4-1);e=c[i>>2]|0;c[d>>2]=i+4;i=a;c[i>>2]=e&255;c[i+4>>2]=0;break a;break}case 17:{i=(c[d>>2]|0)+(8-1)&~(8-1);j=+g[i>>3];c[d>>2]=i+8;g[a>>3]=j;break a;break}case 18:{i=(c[d>>2]|0)+(8-1)&~(8-1);j=+g[i>>3];c[d>>2]=i+8;g[a>>3]=j;break a;break}default:break a}while(0);while(0);return}function Fh(b,c,e,f){b=b|0;c=c|0;e=e|0;f=f|0;var g=0,h=0;if((b|0)==0&(c|0)==0)g=e;else{h=e;e=c;c=b;while(1){b=h+-1|0;a[b>>0]=d[480+(c&15)>>0]|0|f;c=oj(c|0,e|0,4)|0;e=y()|0;if((c|0)==0&(e|0)==0){g=b;break}else h=b}}return g|0}function Gh(b,c,d){b=b|0;c=c|0;d=d|0;var e=0,f=0;if((b|0)==0&(c|0)==0)e=d;else{f=d;d=c;c=b;while(1){b=f+-1|0;a[b>>0]=c&7|48;c=oj(c|0,d|0,3)|0;d=y()|0;if((c|0)==0&(d|0)==0){e=b;break}else f=b}}return e|0}function Hh(b,c,d){b=b|0;c=c|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;if(c>>>0>0|(c|0)==0&b>>>0>4294967295){e=d;f=b;g=c;do{c=f;f=nj(f|0,g|0,10,0)|0;h=g;g=y()|0;i=ij(f|0,g|0,10,0)|0;j=kj(c|0,h|0,i|0,y()|0)|0;y()|0;e=e+-1|0;a[e>>0]=j&255|48}while(h>>>0>9|(h|0)==9&c>>>0>4294967295);k=f;l=e}else{k=b;l=d}if(!k)m=l;else{d=k;k=l;while(1){l=d;d=(d>>>0)/10|0;b=k+-1|0;a[b>>0]=l-(d*10|0)|48;if(l>>>0<10){m=b;break}else k=b}}return m|0}function Ih(a){a=a|0;return Sh(a,c[(Rh()|0)+188>>2]|0)|0}function Jh(a,b,c,d,e){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;var f=0,g=0,h=0;f=Ca;Ca=Ca+256|0;if((Ca|0)>=(Da|0))z(256);g=f;if((c|0)>(d|0)&(e&73728|0)==0){e=c-d|0;sj(g|0,b<<24>>24|0,(e>>>0<256?e:256)|0)|0;if(e>>>0>255){b=c-d|0;d=e;do{Ch(a,g,256);d=d+-256|0}while(d>>>0>255);h=b&255}else h=e;Ch(a,g,h)}Ca=f;return}function Kh(a,b){a=a|0;b=b|0;var c=0;if(!a)c=0;else c=Ph(a,b,0)|0;return c|0}function Lh(b,e,f,g,h,i){b=b|0;e=+e;f=f|0;g=g|0;h=h|0;i=i|0;var j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0.0,t=0,v=0.0,w=0,x=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0.0,H=0,I=0,J=0,K=0.0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0.0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ba=0,ca=0,da=0,ea=0,fa=0,ga=0,ha=0,ia=0.0,ja=0.0,ka=0,la=0,ma=0,na=0,oa=0,pa=0,qa=0,ra=0,sa=0,ta=0,ua=0,va=0,wa=0,xa=0,ya=0,za=0,Aa=0,Ba=0,Ea=0,Fa=0,Ga=0,Ha=0,Ia=0,Ja=0,Ka=0;j=Ca;Ca=Ca+560|0;if((Ca|0)>=(Da|0))z(560);k=j+32|0;l=j+536|0;m=j;n=m;o=j+540|0;c[l>>2]=0;p=o+12|0;q=Mh(e)|0;r=y()|0;if((r|0)<0){s=-e;t=Mh(s)|0;v=s;w=1;x=13418;A=y()|0;B=t}else{v=e;w=(h&2049|0)!=0&1;x=(h&2048|0)==0?((h&1|0)==0?13419:13424):13421;A=r;B=q}do if(0==0&(A&2146435072|0)==2146435072){q=(i&32|0)!=0;B=w+3|0;Jh(b,32,f,B,h&-65537);Ch(b,x,w);Ch(b,v!=v|0.0!=0.0?(q?13445:13449):q?13437:13441,3);Jh(b,32,f,B,h^8192);C=B}else{e=+Nh(v,l)*2.0;B=e!=0.0;if(B)c[l>>2]=(c[l>>2]|0)+-1;q=i|32;if((q|0)==97){r=i&32;t=(r|0)==0?x:x+9|0;D=w|2;E=12-g|0;do if(!(g>>>0>11|(E|0)==0)){s=8.0;F=E;do{F=F+-1|0;s=s*16.0}while((F|0)!=0);if((a[t>>0]|0)==45){G=-(s+(-e-s));break}else{G=e+s-s;break}}else G=e;while(0);E=c[l>>2]|0;F=(E|0)<0?0-E|0:E;H=Hh(F,((F|0)<0)<<31>>31,p)|0;if((H|0)==(p|0)){F=o+11|0;a[F>>0]=48;I=F}else I=H;a[I+-1>>0]=(E>>31&2)+43;E=I+-2|0;a[E>>0]=i+15;H=(g|0)<1;F=(h&8|0)==0;J=m;K=G;while(1){L=~~K;M=J+1|0;a[J>>0]=r|d[480+L>>0];K=(K-+(L|0))*16.0;if((M-n|0)==1?!(F&(H&K==0.0)):0){a[M>>0]=46;N=J+2|0}else N=M;if(!(K!=0.0))break;else J=N}J=N;if((g|0)!=0?(-2-n+J|0)<(g|0):0){H=p;F=E;O=g+2+H-F|0;P=H;Q=F}else{F=p;H=E;O=F-n-H+J|0;P=F;Q=H}H=O+D|0;Jh(b,32,f,H,h);Ch(b,t,D);Jh(b,48,f,H,h^65536);F=J-n|0;Ch(b,m,F);J=P-Q|0;Jh(b,48,O-(F+J)|0,0,0);Ch(b,E,J);Jh(b,32,f,H,h^8192);C=H;break}H=(g|0)<0?6:g;if(B){J=(c[l>>2]|0)+-28|0;c[l>>2]=J;R=e*268435456.0;S=J}else{R=e;S=c[l>>2]|0}J=(S|0)<0?k:k+288|0;F=J;K=R;do{r=~~K>>>0;c[F>>2]=r;F=F+4|0;K=(K-+(r>>>0))*1.0e9}while(K!=0.0);B=J;if((S|0)>0){E=J;D=F;t=S;while(1){r=(t|0)<29?t:29;M=D+-4|0;if(M>>>0>=E>>>0){L=M;M=0;do{T=pj(c[L>>2]|0,0,r|0)|0;U=jj(T|0,y()|0,M|0,0)|0;T=y()|0;M=nj(U|0,T|0,1e9,0)|0;V=ij(M|0,y()|0,1e9,0)|0;W=kj(U|0,T|0,V|0,y()|0)|0;y()|0;c[L>>2]=W;L=L+-4|0}while(L>>>0>=E>>>0);if(M){L=E+-4|0;c[L>>2]=M;X=L}else X=E}else X=E;a:do if(D>>>0>X>>>0){L=D;while(1){W=L+-4|0;if(c[W>>2]|0){Y=L;break a}if(W>>>0>X>>>0)L=W;else{Y=W;break}}}else Y=D;while(0);M=(c[l>>2]|0)-r|0;c[l>>2]=M;if((M|0)>0){E=X;D=Y;t=M}else{Z=X;_=Y;$=M;break}}}else{Z=J;_=F;$=S}if(($|0)<0){t=((H+25|0)/9|0)+1|0;D=(q|0)==102;E=Z;M=_;L=$;while(1){W=0-L|0;V=(W|0)<9?W:9;if(E>>>0<M>>>0){W=(1<<V)+-1|0;T=1e9>>>V;U=0;aa=E;do{ba=c[aa>>2]|0;c[aa>>2]=(ba>>>V)+U;U=u(ba&W,T)|0;aa=aa+4|0}while(aa>>>0<M>>>0);aa=(c[E>>2]|0)==0?E+4|0:E;if(!U){ca=M;da=aa}else{c[M>>2]=U;ca=M+4|0;da=aa}}else{ca=M;da=(c[E>>2]|0)==0?E+4|0:E}aa=D?J:da;T=(ca-aa>>2|0)>(t|0)?aa+(t<<2)|0:ca;L=(c[l>>2]|0)+V|0;c[l>>2]=L;if((L|0)>=0){ea=da;fa=T;break}else{E=da;M=T}}}else{ea=Z;fa=_}if(ea>>>0<fa>>>0){M=(B-ea>>2)*9|0;E=c[ea>>2]|0;if(E>>>0<10)ga=M;else{L=M;M=10;while(1){M=M*10|0;t=L+1|0;if(E>>>0<M>>>0){ga=t;break}else L=t}}}else ga=0;L=(q|0)==103;M=(H|0)!=0;E=H-((q|0)==102?0:ga)+((M&L)<<31>>31)|0;if((E|0)<(((fa-B>>2)*9|0)+-9|0)){t=E+9216|0;E=(t|0)/9|0;D=J+4+(E+-1024<<2)|0;F=t-(E*9|0)|0;if((F|0)<8){E=F;F=10;while(1){t=F*10|0;if((E|0)<7){E=E+1|0;F=t}else{ha=t;break}}}else ha=10;F=c[D>>2]|0;E=(F>>>0)/(ha>>>0)|0;q=F-(u(E,ha)|0)|0;t=(D+4|0)==(fa|0);if(!(t&(q|0)==0)){s=(E&1|0)==0?9007199254740992.0:9007199254740994.0;E=ha>>>1;K=q>>>0<E>>>0?.5:t&(q|0)==(E|0)?1.0:1.5;if(!w){ia=K;ja=s}else{E=(a[x>>0]|0)==45;ia=E?-K:K;ja=E?-s:s}E=F-q|0;c[D>>2]=E;if(ja+ia!=ja){q=E+ha|0;c[D>>2]=q;if(q>>>0>999999999){q=D;E=ea;while(1){F=q+-4|0;c[q>>2]=0;if(F>>>0<E>>>0){t=E+-4|0;c[t>>2]=0;ka=t}else ka=E;t=(c[F>>2]|0)+1|0;c[F>>2]=t;if(t>>>0>999999999){q=F;E=ka}else{la=F;ma=ka;break}}}else{la=D;ma=ea}E=(B-ma>>2)*9|0;q=c[ma>>2]|0;if(q>>>0<10){na=la;oa=E;pa=ma}else{F=E;E=10;while(1){E=E*10|0;t=F+1|0;if(q>>>0<E>>>0){na=la;oa=t;pa=ma;break}else F=t}}}else{na=D;oa=ga;pa=ea}}else{na=D;oa=ga;pa=ea}F=na+4|0;qa=oa;ra=fa>>>0>F>>>0?F:fa;sa=pa}else{qa=ga;ra=fa;sa=ea}F=0-qa|0;b:do if(ra>>>0>sa>>>0){E=ra;while(1){q=E+-4|0;if(c[q>>2]|0){ta=E;ua=1;break b}if(q>>>0>sa>>>0)E=q;else{ta=q;ua=0;break}}}else{ta=ra;ua=0}while(0);do if(L){D=H+((M^1)&1)|0;if((D|0)>(qa|0)&(qa|0)>-5){va=i+-1|0;wa=D+-1-qa|0}else{va=i+-2|0;wa=D+-1|0}if(!(h&8)){if(ua?(D=c[ta+-4>>2]|0,(D|0)!=0):0)if(!((D>>>0)%10|0)){E=0;V=10;while(1){V=V*10|0;U=E+1|0;if((D>>>0)%(V>>>0)|0|0){xa=U;break}else E=U}}else xa=0;else xa=9;E=((ta-B>>2)*9|0)+-9|0;if((va|32|0)==102){V=E-xa|0;D=(V|0)>0?V:0;ya=va;za=(wa|0)<(D|0)?wa:D;break}else{D=E+qa-xa|0;E=(D|0)>0?D:0;ya=va;za=(wa|0)<(E|0)?wa:E;break}}else{ya=va;za=wa}}else{ya=i;za=H}while(0);H=(za|0)!=0;B=H?1:h>>>3&1;M=(ya|32|0)==102;if(M){Aa=0;Ba=(qa|0)>0?qa:0}else{L=(qa|0)<0?F:qa;E=Hh(L,((L|0)<0)<<31>>31,p)|0;L=p;if((L-E|0)<2){D=E;while(1){V=D+-1|0;a[V>>0]=48;if((L-V|0)<2)D=V;else{Ea=V;break}}}else Ea=E;a[Ea+-1>>0]=(qa>>31&2)+43;D=Ea+-2|0;a[D>>0]=ya;Aa=D;Ba=L-D|0}D=w+1+za+B+Ba|0;Jh(b,32,f,D,h);Ch(b,x,w);Jh(b,48,f,D,h^65536);if(M){F=sa>>>0>J>>>0?J:sa;V=m+9|0;U=V;q=m+8|0;t=F;do{T=Hh(c[t>>2]|0,0,V)|0;if((t|0)==(F|0))if((T|0)==(V|0)){a[q>>0]=48;Fa=q}else Fa=T;else if(T>>>0>m>>>0){sj(m|0,48,T-n|0)|0;aa=T;while(1){W=aa+-1|0;if(W>>>0>m>>>0)aa=W;else{Fa=W;break}}}else Fa=T;Ch(b,Fa,U-Fa|0);t=t+4|0}while(t>>>0<=J>>>0);if(!((h&8|0)==0&(H^1)))Ch(b,13453,1);if(t>>>0<ta>>>0&(za|0)>0){J=za;U=t;while(1){q=Hh(c[U>>2]|0,0,V)|0;if(q>>>0>m>>>0){sj(m|0,48,q-n|0)|0;F=q;while(1){M=F+-1|0;if(M>>>0>m>>>0)F=M;else{Ga=M;break}}}else Ga=q;Ch(b,Ga,(J|0)<9?J:9);U=U+4|0;F=J+-9|0;if(!(U>>>0<ta>>>0&(J|0)>9)){Ha=F;break}else J=F}}else Ha=za;Jh(b,48,Ha+9|0,9,0)}else{J=ua?ta:sa+4|0;if(sa>>>0<J>>>0&(za|0)>-1){U=m+9|0;V=(h&8|0)==0;t=U;H=0-n|0;F=m+8|0;T=za;M=sa;while(1){B=Hh(c[M>>2]|0,0,U)|0;if((B|0)==(U|0)){a[F>>0]=48;Ia=F}else Ia=B;do if((M|0)==(sa|0)){B=Ia+1|0;Ch(b,Ia,1);if(V&(T|0)<1){Ja=B;break}Ch(b,13453,1);Ja=B}else{if(Ia>>>0<=m>>>0){Ja=Ia;break}sj(m|0,48,Ia+H|0)|0;B=Ia;while(1){L=B+-1|0;if(L>>>0>m>>>0)B=L;else{Ja=L;break}}}while(0);q=t-Ja|0;Ch(b,Ja,(T|0)>(q|0)?q:T);B=T-q|0;M=M+4|0;if(!(M>>>0<J>>>0&(B|0)>-1)){Ka=B;break}else T=B}}else Ka=za;Jh(b,48,Ka+18|0,18,0);Ch(b,Aa,p-Aa|0)}Jh(b,32,f,D,h^8192);C=D}while(0);Ca=j;return ((C|0)<(f|0)?f:C)|0}function Mh(a){a=+a;var b=0;g[h>>3]=a;b=c[h>>2]|0;x(c[h+4>>2]|0);return b|0}function Nh(a,b){a=+a;b=b|0;return +(+Oh(a,b))}function Oh(a,b){a=+a;b=b|0;var d=0,e=0,f=0,i=0.0,j=0.0,k=0,l=0.0;g[h>>3]=a;d=c[h>>2]|0;e=c[h+4>>2]|0;f=oj(d|0,e|0,52)|0;y()|0;switch(f&2047){case 0:{if(a!=0.0){i=+Oh(a*18446744073709551616.0,b);j=i;k=(c[b>>2]|0)+-64|0}else{j=a;k=0}c[b>>2]=k;l=j;break}case 2047:{l=a;break}default:{c[b>>2]=(f&2047)+-1022;c[h>>2]=d;c[h+4>>2]=e&-2146435073|1071644672;l=+g[h>>3]}}return +l}function Ph(b,d,e){b=b|0;d=d|0;e=e|0;var f=0;do if(b){if(d>>>0<128){a[b>>0]=d;f=1;break}if(!(c[c[(Qh()|0)+188>>2]>>2]|0))if((d&-128|0)==57216){a[b>>0]=d;f=1;break}else{c[(eh()|0)>>2]=84;f=-1;break}if(d>>>0<2048){a[b>>0]=d>>>6|192;a[b+1>>0]=d&63|128;f=2;break}if(d>>>0<55296|(d&-8192|0)==57344){a[b>>0]=d>>>12|224;a[b+1>>0]=d>>>6&63|128;a[b+2>>0]=d&63|128;f=3;break}if((d+-65536|0)>>>0<1048576){a[b>>0]=d>>>18|240;a[b+1>>0]=d>>>12&63|128;a[b+2>>0]=d>>>6&63|128;a[b+3>>0]=d&63|128;f=4;break}else{c[(eh()|0)>>2]=84;f=-1;break}}else f=1;while(0);return f|0}function Qh(){return ih()|0}function Rh(){return ih()|0}function Sh(b,e){b=b|0;e=e|0;var f=0,g=0,h=0,i=0,j=0;f=0;while(1){if((d[496+f>>0]|0)==(b|0)){g=4;break}h=f+1|0;if((h|0)==87){i=87;g=5;break}else f=h}if((g|0)==4)if(!f)j=592;else{i=f;g=5}if((g|0)==5){g=592;f=i;while(1){i=g;do{b=i;i=i+1|0}while((a[b>>0]|0)!=0);f=f+-1|0;if(!f){j=i;break}else g=i}}return Th(j,c[e+20>>2]|0)|0}function Th(a,b){a=a|0;b=b|0;return sh(a,b)|0}function Uh(b,c,d){b=b|0;c=c|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0;a:do if(!d)e=0;else{f=b;g=d;h=c;while(1){i=a[f>>0]|0;j=a[h>>0]|0;if(i<<24>>24!=j<<24>>24)break;g=g+-1|0;if(!g){e=0;break a}else{f=f+1|0;h=h+1|0}}e=(i&255)-(j&255)|0}while(0);return e|0}function Vh(a,b){a=a|0;b=b|0;var d=0,e=0;d=Ca;Ca=Ca+16|0;if((Ca|0)>=(Da|0))z(16);e=d;c[e>>2]=b;b=Ah(c[1489]|0,a,e)|0;Ca=d;return b|0}function Wh(b,d){b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0;if((c[d+76>>2]|0)>=0?(oh(d)|0)!=0:0){e=b&255;f=b&255;if((f|0)!=(a[d+75>>0]|0)?(g=d+20|0,h=c[g>>2]|0,h>>>0<(c[d+16>>2]|0)>>>0):0){c[g>>2]=h+1;a[h>>0]=e;i=f}else i=ph(d,b)|0;nh(d);j=i}else k=3;do if((k|0)==3){i=b&255;f=b&255;if((f|0)!=(a[d+75>>0]|0)?(e=d+20|0,h=c[e>>2]|0,h>>>0<(c[d+16>>2]|0)>>>0):0){c[e>>2]=h+1;a[h>>0]=i;j=f;break}j=ph(d,b)|0}while(0);return j|0}function Xh(b){b=b|0;var d=0,e=0,f=0,g=0,h=0;d=c[1489]|0;if((c[d+76>>2]|0)>-1)e=oh(d)|0;else e=0;do if((lh(b,d)|0)<0)f=-1;else{if((a[d+75>>0]|0)!=10?(g=d+20|0,h=c[g>>2]|0,h>>>0<(c[d+16>>2]|0)>>>0):0){c[g>>2]=h+1;a[h>>0]=10;f=0;break}f=(ph(d,10)|0)>>31}while(0);if(e|0)nh(d);return f|0}function Yh(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ba=0,ca=0,da=0,ea=0,fa=0,ga=0,ha=0,ia=0,ja=0,ka=0,la=0,ma=0,na=0,oa=0,pa=0,qa=0,ra=0,sa=0,ta=0,ua=0,va=0,wa=0,xa=0,ya=0,za=0,Aa=0,Ba=0,Ea=0,Fa=0,Ga=0,Ha=0,Ia=0,Ja=0,Ka=0,La=0;b=Ca;Ca=Ca+16|0;if((Ca|0)>=(Da|0))z(16);d=b;do if(a>>>0<245){e=a>>>0<11?16:a+11&-8;f=e>>>3;g=c[3838]|0;h=g>>>f;if(h&3|0){i=(h&1^1)+f|0;j=15392+(i<<1<<2)|0;k=j+8|0;l=c[k>>2]|0;m=l+8|0;n=c[m>>2]|0;if((n|0)==(j|0))c[3838]=g&~(1<<i);else{c[n+12>>2]=j;c[k>>2]=n}n=i<<3;c[l+4>>2]=n|3;i=l+n+4|0;c[i>>2]=c[i>>2]|1;o=m;Ca=b;return o|0}m=c[3840]|0;if(e>>>0>m>>>0){if(h|0){i=2<<f;n=h<<f&(i|0-i);i=(n&0-n)+-1|0;n=i>>>12&16;f=i>>>n;i=f>>>5&8;h=f>>>i;f=h>>>2&4;l=h>>>f;h=l>>>1&2;k=l>>>h;l=k>>>1&1;j=(i|n|f|h|l)+(k>>>l)|0;l=15392+(j<<1<<2)|0;k=l+8|0;h=c[k>>2]|0;f=h+8|0;n=c[f>>2]|0;if((n|0)==(l|0)){i=g&~(1<<j);c[3838]=i;p=i}else{c[n+12>>2]=l;c[k>>2]=n;p=g}n=j<<3;j=n-e|0;c[h+4>>2]=e|3;k=h+e|0;c[k+4>>2]=j|1;c[h+n>>2]=j;if(m|0){n=c[3843]|0;h=m>>>3;l=15392+(h<<1<<2)|0;i=1<<h;if(!(p&i)){c[3838]=p|i;q=l;r=l+8|0}else{i=l+8|0;q=c[i>>2]|0;r=i}c[r>>2]=n;c[q+12>>2]=n;c[n+8>>2]=q;c[n+12>>2]=l}c[3840]=j;c[3843]=k;o=f;Ca=b;return o|0}f=c[3839]|0;if(f){k=(f&0-f)+-1|0;j=k>>>12&16;l=k>>>j;k=l>>>5&8;n=l>>>k;l=n>>>2&4;i=n>>>l;n=i>>>1&2;h=i>>>n;i=h>>>1&1;s=c[15656+((k|j|l|n|i)+(h>>>i)<<2)>>2]|0;i=s;h=s;n=(c[s+4>>2]&-8)-e|0;while(1){s=c[i+16>>2]|0;if(!s){l=c[i+20>>2]|0;if(!l)break;else t=l}else t=s;s=(c[t+4>>2]&-8)-e|0;l=s>>>0<n>>>0;i=t;h=l?t:h;n=l?s:n}i=h+e|0;if(i>>>0>h>>>0){s=c[h+24>>2]|0;l=c[h+12>>2]|0;do if((l|0)==(h|0)){j=h+20|0;k=c[j>>2]|0;if(!k){u=h+16|0;v=c[u>>2]|0;if(!v){w=0;break}else{x=v;y=u}}else{x=k;y=j}j=x;k=y;while(1){u=j+20|0;v=c[u>>2]|0;if(!v){A=j+16|0;B=c[A>>2]|0;if(!B)break;else{C=B;D=A}}else{C=v;D=u}j=C;k=D}c[k>>2]=0;w=j}else{u=c[h+8>>2]|0;c[u+12>>2]=l;c[l+8>>2]=u;w=l}while(0);do if(s|0){l=c[h+28>>2]|0;u=15656+(l<<2)|0;if((h|0)==(c[u>>2]|0)){c[u>>2]=w;if(!w){c[3839]=f&~(1<<l);break}}else{l=s+16|0;c[((c[l>>2]|0)==(h|0)?l:s+20|0)>>2]=w;if(!w)break}c[w+24>>2]=s;l=c[h+16>>2]|0;if(l|0){c[w+16>>2]=l;c[l+24>>2]=w}l=c[h+20>>2]|0;if(l|0){c[w+20>>2]=l;c[l+24>>2]=w}}while(0);if(n>>>0<16){s=n+e|0;c[h+4>>2]=s|3;f=h+s+4|0;c[f>>2]=c[f>>2]|1}else{c[h+4>>2]=e|3;c[i+4>>2]=n|1;c[i+n>>2]=n;if(m|0){f=c[3843]|0;s=m>>>3;l=15392+(s<<1<<2)|0;u=1<<s;if(!(u&g)){c[3838]=u|g;E=l;F=l+8|0}else{u=l+8|0;E=c[u>>2]|0;F=u}c[F>>2]=f;c[E+12>>2]=f;c[f+8>>2]=E;c[f+12>>2]=l}c[3840]=n;c[3843]=i}o=h+8|0;Ca=b;return o|0}else G=e}else G=e}else G=e}else if(a>>>0<=4294967231){l=a+11|0;f=l&-8;u=c[3839]|0;if(u){s=0-f|0;v=l>>>8;if(v)if(f>>>0>16777215)H=31;else{l=(v+1048320|0)>>>16&8;A=v<<l;v=(A+520192|0)>>>16&4;B=A<<v;A=(B+245760|0)>>>16&2;I=14-(v|l|A)+(B<<A>>>15)|0;H=f>>>(I+7|0)&1|I<<1}else H=0;I=c[15656+(H<<2)>>2]|0;a:do if(!I){J=0;K=0;L=s;M=61}else{A=0;B=s;l=I;v=f<<((H|0)==31?0:25-(H>>>1)|0);N=0;while(1){O=(c[l+4>>2]&-8)-f|0;if(O>>>0<B>>>0)if(!O){P=l;Q=0;R=l;M=65;break a}else{S=l;T=O}else{S=A;T=B}O=c[l+20>>2]|0;l=c[l+16+(v>>>31<<2)>>2]|0;U=(O|0)==0|(O|0)==(l|0)?N:O;if(!l){J=U;K=S;L=T;M=61;break}else{A=S;B=T;v=v<<1;N=U}}}while(0);if((M|0)==61){if((J|0)==0&(K|0)==0){I=2<<H;s=(I|0-I)&u;if(!s){G=f;break}I=(s&0-s)+-1|0;s=I>>>12&16;e=I>>>s;I=e>>>5&8;h=e>>>I;e=h>>>2&4;i=h>>>e;h=i>>>1&2;n=i>>>h;i=n>>>1&1;V=0;W=c[15656+((I|s|e|h|i)+(n>>>i)<<2)>>2]|0}else{V=K;W=J}if(!W){X=V;Y=L}else{P=V;Q=L;R=W;M=65}}if((M|0)==65){i=P;n=Q;h=R;while(1){e=(c[h+4>>2]&-8)-f|0;s=e>>>0<n>>>0;I=s?e:n;e=s?h:i;s=c[h+16>>2]|0;if(!s)Z=c[h+20>>2]|0;else Z=s;if(!Z){X=e;Y=I;break}else{i=e;n=I;h=Z}}}if(((X|0)!=0?Y>>>0<((c[3840]|0)-f|0)>>>0:0)?(h=X+f|0,h>>>0>X>>>0):0){n=c[X+24>>2]|0;i=c[X+12>>2]|0;do if((i|0)==(X|0)){I=X+20|0;e=c[I>>2]|0;if(!e){s=X+16|0;g=c[s>>2]|0;if(!g){_=0;break}else{$=g;aa=s}}else{$=e;aa=I}I=$;e=aa;while(1){s=I+20|0;g=c[s>>2]|0;if(!g){m=I+16|0;N=c[m>>2]|0;if(!N)break;else{ba=N;ca=m}}else{ba=g;ca=s}I=ba;e=ca}c[e>>2]=0;_=I}else{s=c[X+8>>2]|0;c[s+12>>2]=i;c[i+8>>2]=s;_=i}while(0);do if(n){i=c[X+28>>2]|0;s=15656+(i<<2)|0;if((X|0)==(c[s>>2]|0)){c[s>>2]=_;if(!_){s=u&~(1<<i);c[3839]=s;da=s;break}}else{s=n+16|0;c[((c[s>>2]|0)==(X|0)?s:n+20|0)>>2]=_;if(!_){da=u;break}}c[_+24>>2]=n;s=c[X+16>>2]|0;if(s|0){c[_+16>>2]=s;c[s+24>>2]=_}s=c[X+20>>2]|0;if(s){c[_+20>>2]=s;c[s+24>>2]=_;da=u}else da=u}else da=u;while(0);b:do if(Y>>>0<16){u=Y+f|0;c[X+4>>2]=u|3;n=X+u+4|0;c[n>>2]=c[n>>2]|1}else{c[X+4>>2]=f|3;c[h+4>>2]=Y|1;c[h+Y>>2]=Y;n=Y>>>3;if(Y>>>0<256){u=15392+(n<<1<<2)|0;s=c[3838]|0;i=1<<n;if(!(s&i)){c[3838]=s|i;ea=u;fa=u+8|0}else{i=u+8|0;ea=c[i>>2]|0;fa=i}c[fa>>2]=h;c[ea+12>>2]=h;c[h+8>>2]=ea;c[h+12>>2]=u;break}u=Y>>>8;if(u)if(Y>>>0>16777215)ga=31;else{i=(u+1048320|0)>>>16&8;s=u<<i;u=(s+520192|0)>>>16&4;n=s<<u;s=(n+245760|0)>>>16&2;g=14-(u|i|s)+(n<<s>>>15)|0;ga=Y>>>(g+7|0)&1|g<<1}else ga=0;g=15656+(ga<<2)|0;c[h+28>>2]=ga;s=h+16|0;c[s+4>>2]=0;c[s>>2]=0;s=1<<ga;if(!(da&s)){c[3839]=da|s;c[g>>2]=h;c[h+24>>2]=g;c[h+12>>2]=h;c[h+8>>2]=h;break}s=c[g>>2]|0;c:do if((c[s+4>>2]&-8|0)==(Y|0))ha=s;else{g=Y<<((ga|0)==31?0:25-(ga>>>1)|0);n=s;while(1){ia=n+16+(g>>>31<<2)|0;i=c[ia>>2]|0;if(!i)break;if((c[i+4>>2]&-8|0)==(Y|0)){ha=i;break c}else{g=g<<1;n=i}}c[ia>>2]=h;c[h+24>>2]=n;c[h+12>>2]=h;c[h+8>>2]=h;break b}while(0);s=ha+8|0;I=c[s>>2]|0;c[I+12>>2]=h;c[s>>2]=h;c[h+8>>2]=I;c[h+12>>2]=ha;c[h+24>>2]=0}while(0);o=X+8|0;Ca=b;return o|0}else G=f}else G=f}else G=-1;while(0);X=c[3840]|0;if(X>>>0>=G>>>0){ha=X-G|0;ia=c[3843]|0;if(ha>>>0>15){Y=ia+G|0;c[3843]=Y;c[3840]=ha;c[Y+4>>2]=ha|1;c[ia+X>>2]=ha;c[ia+4>>2]=G|3}else{c[3840]=0;c[3843]=0;c[ia+4>>2]=X|3;ha=ia+X+4|0;c[ha>>2]=c[ha>>2]|1}o=ia+8|0;Ca=b;return o|0}ia=c[3841]|0;if(ia>>>0>G>>>0){ha=ia-G|0;c[3841]=ha;X=c[3844]|0;Y=X+G|0;c[3844]=Y;c[Y+4>>2]=ha|1;c[X+4>>2]=G|3;o=X+8|0;Ca=b;return o|0}if(!(c[3956]|0)){c[3958]=4096;c[3957]=4096;c[3959]=-1;c[3960]=-1;c[3961]=0;c[3949]=0;c[3956]=d&-16^1431655768;ja=4096}else ja=c[3958]|0;d=G+48|0;X=G+47|0;ha=ja+X|0;Y=0-ja|0;ja=ha&Y;if(ja>>>0<=G>>>0){o=0;Ca=b;return o|0}ga=c[3948]|0;if(ga|0?(da=c[3946]|0,ea=da+ja|0,ea>>>0<=da>>>0|ea>>>0>ga>>>0):0){o=0;Ca=b;return o|0}d:do if(!(c[3949]&4)){ga=c[3844]|0;e:do if(ga){ea=15800;while(1){da=c[ea>>2]|0;if(da>>>0<=ga>>>0?(da+(c[ea+4>>2]|0)|0)>>>0>ga>>>0:0)break;da=c[ea+8>>2]|0;if(!da){M=128;break e}else ea=da}da=ha-ia&Y;if(da>>>0<2147483647){fa=tj(da|0)|0;if((fa|0)==((c[ea>>2]|0)+(c[ea+4>>2]|0)|0))if((fa|0)==(-1|0))ka=da;else{la=da;ma=fa;M=145;break d}else{na=fa;oa=da;M=136}}else ka=0}else M=128;while(0);do if((M|0)==128){ga=tj(0)|0;if((ga|0)!=(-1|0)?(f=ga,da=c[3957]|0,fa=da+-1|0,_=((fa&f|0)==0?0:(fa+f&0-da)-f|0)+ja|0,f=c[3946]|0,da=_+f|0,_>>>0>G>>>0&_>>>0<2147483647):0){fa=c[3948]|0;if(fa|0?da>>>0<=f>>>0|da>>>0>fa>>>0:0){ka=0;break}fa=tj(_|0)|0;if((fa|0)==(ga|0)){la=_;ma=ga;M=145;break d}else{na=fa;oa=_;M=136}}else ka=0}while(0);do if((M|0)==136){_=0-oa|0;if(!(d>>>0>oa>>>0&(oa>>>0<2147483647&(na|0)!=(-1|0))))if((na|0)==(-1|0)){ka=0;break}else{la=oa;ma=na;M=145;break d}fa=c[3958]|0;ga=X-oa+fa&0-fa;if(ga>>>0>=2147483647){la=oa;ma=na;M=145;break d}if((tj(ga|0)|0)==(-1|0)){tj(_|0)|0;ka=0;break}else{la=ga+oa|0;ma=na;M=145;break d}}while(0);c[3949]=c[3949]|4;pa=ka;M=143}else{pa=0;M=143}while(0);if(((M|0)==143?ja>>>0<2147483647:0)?(ka=tj(ja|0)|0,ja=tj(0)|0,na=ja-ka|0,oa=na>>>0>(G+40|0)>>>0,!((ka|0)==(-1|0)|oa^1|ka>>>0<ja>>>0&((ka|0)!=(-1|0)&(ja|0)!=(-1|0))^1)):0){la=oa?na:pa;ma=ka;M=145}if((M|0)==145){ka=(c[3946]|0)+la|0;c[3946]=ka;if(ka>>>0>(c[3947]|0)>>>0)c[3947]=ka;ka=c[3844]|0;f:do if(ka){pa=15800;while(1){qa=c[pa>>2]|0;ra=c[pa+4>>2]|0;if((ma|0)==(qa+ra|0)){M=154;break}na=c[pa+8>>2]|0;if(!na)break;else pa=na}if(((M|0)==154?(na=pa+4|0,(c[pa+12>>2]&8|0)==0):0)?ma>>>0>ka>>>0&qa>>>0<=ka>>>0:0){c[na>>2]=ra+la;na=(c[3841]|0)+la|0;oa=ka+8|0;ja=(oa&7|0)==0?0:0-oa&7;oa=ka+ja|0;X=na-ja|0;c[3844]=oa;c[3841]=X;c[oa+4>>2]=X|1;c[ka+na+4>>2]=40;c[3845]=c[3960];break}if(ma>>>0<(c[3842]|0)>>>0)c[3842]=ma;na=ma+la|0;X=15800;while(1){if((c[X>>2]|0)==(na|0)){M=162;break}oa=c[X+8>>2]|0;if(!oa)break;else X=oa}if((M|0)==162?(c[X+12>>2]&8|0)==0:0){c[X>>2]=ma;pa=X+4|0;c[pa>>2]=(c[pa>>2]|0)+la;pa=ma+8|0;oa=ma+((pa&7|0)==0?0:0-pa&7)|0;pa=na+8|0;ja=na+((pa&7|0)==0?0:0-pa&7)|0;pa=oa+G|0;d=ja-oa-G|0;c[oa+4>>2]=G|3;g:do if((ka|0)==(ja|0)){Y=(c[3841]|0)+d|0;c[3841]=Y;c[3844]=pa;c[pa+4>>2]=Y|1}else{if((c[3843]|0)==(ja|0)){Y=(c[3840]|0)+d|0;c[3840]=Y;c[3843]=pa;c[pa+4>>2]=Y|1;c[pa+Y>>2]=Y;break}Y=c[ja+4>>2]|0;if((Y&3|0)==1){ia=Y&-8;ha=Y>>>3;h:do if(Y>>>0<256){ga=c[ja+8>>2]|0;_=c[ja+12>>2]|0;if((_|0)==(ga|0)){c[3838]=c[3838]&~(1<<ha);break}else{c[ga+12>>2]=_;c[_+8>>2]=ga;break}}else{ga=c[ja+24>>2]|0;_=c[ja+12>>2]|0;do if((_|0)==(ja|0)){fa=ja+16|0;da=fa+4|0;f=c[da>>2]|0;if(!f){ca=c[fa>>2]|0;if(!ca){sa=0;break}else{ta=ca;ua=fa}}else{ta=f;ua=da}da=ta;f=ua;while(1){fa=da+20|0;ca=c[fa>>2]|0;if(!ca){ba=da+16|0;aa=c[ba>>2]|0;if(!aa)break;else{va=aa;wa=ba}}else{va=ca;wa=fa}da=va;f=wa}c[f>>2]=0;sa=da}else{fa=c[ja+8>>2]|0;c[fa+12>>2]=_;c[_+8>>2]=fa;sa=_}while(0);if(!ga)break;_=c[ja+28>>2]|0;n=15656+(_<<2)|0;do if((c[n>>2]|0)!=(ja|0)){fa=ga+16|0;c[((c[fa>>2]|0)==(ja|0)?fa:ga+20|0)>>2]=sa;if(!sa)break h}else{c[n>>2]=sa;if(sa|0)break;c[3839]=c[3839]&~(1<<_);break h}while(0);c[sa+24>>2]=ga;_=ja+16|0;n=c[_>>2]|0;if(n|0){c[sa+16>>2]=n;c[n+24>>2]=sa}n=c[_+4>>2]|0;if(!n)break;c[sa+20>>2]=n;c[n+24>>2]=sa}while(0);xa=ja+ia|0;ya=ia+d|0}else{xa=ja;ya=d}ha=xa+4|0;c[ha>>2]=c[ha>>2]&-2;c[pa+4>>2]=ya|1;c[pa+ya>>2]=ya;ha=ya>>>3;if(ya>>>0<256){Y=15392+(ha<<1<<2)|0;ea=c[3838]|0;n=1<<ha;if(!(ea&n)){c[3838]=ea|n;za=Y;Aa=Y+8|0}else{n=Y+8|0;za=c[n>>2]|0;Aa=n}c[Aa>>2]=pa;c[za+12>>2]=pa;c[pa+8>>2]=za;c[pa+12>>2]=Y;break}Y=ya>>>8;do if(!Y)Ba=0;else{if(ya>>>0>16777215){Ba=31;break}n=(Y+1048320|0)>>>16&8;ea=Y<<n;ha=(ea+520192|0)>>>16&4;_=ea<<ha;ea=(_+245760|0)>>>16&2;fa=14-(ha|n|ea)+(_<<ea>>>15)|0;Ba=ya>>>(fa+7|0)&1|fa<<1}while(0);Y=15656+(Ba<<2)|0;c[pa+28>>2]=Ba;ia=pa+16|0;c[ia+4>>2]=0;c[ia>>2]=0;ia=c[3839]|0;fa=1<<Ba;if(!(ia&fa)){c[3839]=ia|fa;c[Y>>2]=pa;c[pa+24>>2]=Y;c[pa+12>>2]=pa;c[pa+8>>2]=pa;break}fa=c[Y>>2]|0;i:do if((c[fa+4>>2]&-8|0)==(ya|0))Ea=fa;else{Y=ya<<((Ba|0)==31?0:25-(Ba>>>1)|0);ia=fa;while(1){Fa=ia+16+(Y>>>31<<2)|0;ea=c[Fa>>2]|0;if(!ea)break;if((c[ea+4>>2]&-8|0)==(ya|0)){Ea=ea;break i}else{Y=Y<<1;ia=ea}}c[Fa>>2]=pa;c[pa+24>>2]=ia;c[pa+12>>2]=pa;c[pa+8>>2]=pa;break g}while(0);fa=Ea+8|0;Y=c[fa>>2]|0;c[Y+12>>2]=pa;c[fa>>2]=pa;c[pa+8>>2]=Y;c[pa+12>>2]=Ea;c[pa+24>>2]=0}while(0);o=oa+8|0;Ca=b;return o|0}pa=15800;while(1){d=c[pa>>2]|0;if(d>>>0<=ka>>>0?(Ga=d+(c[pa+4>>2]|0)|0,Ga>>>0>ka>>>0):0)break;pa=c[pa+8>>2]|0}pa=Ga+-47|0;oa=pa+8|0;d=pa+((oa&7|0)==0?0:0-oa&7)|0;oa=ka+16|0;pa=d>>>0<oa>>>0?ka:d;d=pa+8|0;ja=la+-40|0;na=ma+8|0;X=(na&7|0)==0?0:0-na&7;na=ma+X|0;Y=ja-X|0;c[3844]=na;c[3841]=Y;c[na+4>>2]=Y|1;c[ma+ja+4>>2]=40;c[3845]=c[3960];ja=pa+4|0;c[ja>>2]=27;c[d>>2]=c[3950];c[d+4>>2]=c[3951];c[d+8>>2]=c[3952];c[d+12>>2]=c[3953];c[3950]=ma;c[3951]=la;c[3953]=0;c[3952]=d;d=pa+24|0;do{Y=d;d=d+4|0;c[d>>2]=7}while((Y+8|0)>>>0<Ga>>>0);if((pa|0)!=(ka|0)){d=pa-ka|0;c[ja>>2]=c[ja>>2]&-2;c[ka+4>>2]=d|1;c[pa>>2]=d;Y=d>>>3;if(d>>>0<256){na=15392+(Y<<1<<2)|0;X=c[3838]|0;fa=1<<Y;if(!(X&fa)){c[3838]=X|fa;Ha=na;Ia=na+8|0}else{fa=na+8|0;Ha=c[fa>>2]|0;Ia=fa}c[Ia>>2]=ka;c[Ha+12>>2]=ka;c[ka+8>>2]=Ha;c[ka+12>>2]=na;break}na=d>>>8;if(na)if(d>>>0>16777215)Ja=31;else{fa=(na+1048320|0)>>>16&8;X=na<<fa;na=(X+520192|0)>>>16&4;Y=X<<na;X=(Y+245760|0)>>>16&2;ga=14-(na|fa|X)+(Y<<X>>>15)|0;Ja=d>>>(ga+7|0)&1|ga<<1}else Ja=0;ga=15656+(Ja<<2)|0;c[ka+28>>2]=Ja;c[ka+20>>2]=0;c[oa>>2]=0;X=c[3839]|0;Y=1<<Ja;if(!(X&Y)){c[3839]=X|Y;c[ga>>2]=ka;c[ka+24>>2]=ga;c[ka+12>>2]=ka;c[ka+8>>2]=ka;break}Y=c[ga>>2]|0;j:do if((c[Y+4>>2]&-8|0)==(d|0))Ka=Y;else{ga=d<<((Ja|0)==31?0:25-(Ja>>>1)|0);X=Y;while(1){La=X+16+(ga>>>31<<2)|0;fa=c[La>>2]|0;if(!fa)break;if((c[fa+4>>2]&-8|0)==(d|0)){Ka=fa;break j}else{ga=ga<<1;X=fa}}c[La>>2]=ka;c[ka+24>>2]=X;c[ka+12>>2]=ka;c[ka+8>>2]=ka;break f}while(0);d=Ka+8|0;Y=c[d>>2]|0;c[Y+12>>2]=ka;c[d>>2]=ka;c[ka+8>>2]=Y;c[ka+12>>2]=Ka;c[ka+24>>2]=0}}else{Y=c[3842]|0;if((Y|0)==0|ma>>>0<Y>>>0)c[3842]=ma;c[3950]=ma;c[3951]=la;c[3953]=0;c[3847]=c[3956];c[3846]=-1;c[3851]=15392;c[3850]=15392;c[3853]=15400;c[3852]=15400;c[3855]=15408;c[3854]=15408;c[3857]=15416;c[3856]=15416;c[3859]=15424;c[3858]=15424;c[3861]=15432;c[3860]=15432;c[3863]=15440;c[3862]=15440;c[3865]=15448;c[3864]=15448;c[3867]=15456;c[3866]=15456;c[3869]=15464;c[3868]=15464;c[3871]=15472;c[3870]=15472;c[3873]=15480;c[3872]=15480;c[3875]=15488;c[3874]=15488;c[3877]=15496;c[3876]=15496;c[3879]=15504;c[3878]=15504;c[3881]=15512;c[3880]=15512;c[3883]=15520;c[3882]=15520;c[3885]=15528;c[3884]=15528;c[3887]=15536;c[3886]=15536;c[3889]=15544;c[3888]=15544;c[3891]=15552;c[3890]=15552;c[3893]=15560;c[3892]=15560;c[3895]=15568;c[3894]=15568;c[3897]=15576;c[3896]=15576;c[3899]=15584;c[3898]=15584;c[3901]=15592;c[3900]=15592;c[3903]=15600;c[3902]=15600;c[3905]=15608;c[3904]=15608;c[3907]=15616;c[3906]=15616;c[3909]=15624;c[3908]=15624;c[3911]=15632;c[3910]=15632;c[3913]=15640;c[3912]=15640;Y=la+-40|0;d=ma+8|0;oa=(d&7|0)==0?0:0-d&7;d=ma+oa|0;pa=Y-oa|0;c[3844]=d;c[3841]=pa;c[d+4>>2]=pa|1;c[ma+Y+4>>2]=40;c[3845]=c[3960]}while(0);ma=c[3841]|0;if(ma>>>0>G>>>0){la=ma-G|0;c[3841]=la;ma=c[3844]|0;ka=ma+G|0;c[3844]=ka;c[ka+4>>2]=la|1;c[ma+4>>2]=G|3;o=ma+8|0;Ca=b;return o|0}}c[(eh()|0)>>2]=12;o=0;Ca=b;return o|0}function Zh(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0;if(!a)return;b=a+-8|0;d=c[3842]|0;e=c[a+-4>>2]|0;a=e&-8;f=b+a|0;do if(!(e&1)){g=c[b>>2]|0;if(!(e&3))return;h=b+(0-g)|0;i=g+a|0;if(h>>>0<d>>>0)return;if((c[3843]|0)==(h|0)){j=f+4|0;k=c[j>>2]|0;if((k&3|0)!=3){l=h;m=i;n=h;break}c[3840]=i;c[j>>2]=k&-2;c[h+4>>2]=i|1;c[h+i>>2]=i;return}k=g>>>3;if(g>>>0<256){g=c[h+8>>2]|0;j=c[h+12>>2]|0;if((j|0)==(g|0)){c[3838]=c[3838]&~(1<<k);l=h;m=i;n=h;break}else{c[g+12>>2]=j;c[j+8>>2]=g;l=h;m=i;n=h;break}}g=c[h+24>>2]|0;j=c[h+12>>2]|0;do if((j|0)==(h|0)){k=h+16|0;o=k+4|0;p=c[o>>2]|0;if(!p){q=c[k>>2]|0;if(!q){r=0;break}else{s=q;t=k}}else{s=p;t=o}o=s;p=t;while(1){k=o+20|0;q=c[k>>2]|0;if(!q){u=o+16|0;v=c[u>>2]|0;if(!v)break;else{w=v;x=u}}else{w=q;x=k}o=w;p=x}c[p>>2]=0;r=o}else{k=c[h+8>>2]|0;c[k+12>>2]=j;c[j+8>>2]=k;r=j}while(0);if(g){j=c[h+28>>2]|0;k=15656+(j<<2)|0;if((c[k>>2]|0)==(h|0)){c[k>>2]=r;if(!r){c[3839]=c[3839]&~(1<<j);l=h;m=i;n=h;break}}else{j=g+16|0;c[((c[j>>2]|0)==(h|0)?j:g+20|0)>>2]=r;if(!r){l=h;m=i;n=h;break}}c[r+24>>2]=g;j=h+16|0;k=c[j>>2]|0;if(k|0){c[r+16>>2]=k;c[k+24>>2]=r}k=c[j+4>>2]|0;if(k){c[r+20>>2]=k;c[k+24>>2]=r;l=h;m=i;n=h}else{l=h;m=i;n=h}}else{l=h;m=i;n=h}}else{l=b;m=a;n=b}while(0);if(n>>>0>=f>>>0)return;b=f+4|0;a=c[b>>2]|0;if(!(a&1))return;if(!(a&2)){if((c[3844]|0)==(f|0)){r=(c[3841]|0)+m|0;c[3841]=r;c[3844]=l;c[l+4>>2]=r|1;if((l|0)!=(c[3843]|0))return;c[3843]=0;c[3840]=0;return}if((c[3843]|0)==(f|0)){r=(c[3840]|0)+m|0;c[3840]=r;c[3843]=n;c[l+4>>2]=r|1;c[n+r>>2]=r;return}r=(a&-8)+m|0;x=a>>>3;do if(a>>>0<256){w=c[f+8>>2]|0;t=c[f+12>>2]|0;if((t|0)==(w|0)){c[3838]=c[3838]&~(1<<x);break}else{c[w+12>>2]=t;c[t+8>>2]=w;break}}else{w=c[f+24>>2]|0;t=c[f+12>>2]|0;do if((t|0)==(f|0)){s=f+16|0;d=s+4|0;e=c[d>>2]|0;if(!e){k=c[s>>2]|0;if(!k){y=0;break}else{z=k;A=s}}else{z=e;A=d}d=z;e=A;while(1){s=d+20|0;k=c[s>>2]|0;if(!k){j=d+16|0;q=c[j>>2]|0;if(!q)break;else{B=q;C=j}}else{B=k;C=s}d=B;e=C}c[e>>2]=0;y=d}else{o=c[f+8>>2]|0;c[o+12>>2]=t;c[t+8>>2]=o;y=t}while(0);if(w|0){t=c[f+28>>2]|0;h=15656+(t<<2)|0;if((c[h>>2]|0)==(f|0)){c[h>>2]=y;if(!y){c[3839]=c[3839]&~(1<<t);break}}else{t=w+16|0;c[((c[t>>2]|0)==(f|0)?t:w+20|0)>>2]=y;if(!y)break}c[y+24>>2]=w;t=f+16|0;h=c[t>>2]|0;if(h|0){c[y+16>>2]=h;c[h+24>>2]=y}h=c[t+4>>2]|0;if(h|0){c[y+20>>2]=h;c[h+24>>2]=y}}}while(0);c[l+4>>2]=r|1;c[n+r>>2]=r;if((l|0)==(c[3843]|0)){c[3840]=r;return}else D=r}else{c[b>>2]=a&-2;c[l+4>>2]=m|1;c[n+m>>2]=m;D=m}m=D>>>3;if(D>>>0<256){n=15392+(m<<1<<2)|0;a=c[3838]|0;b=1<<m;if(!(a&b)){c[3838]=a|b;E=n;F=n+8|0}else{b=n+8|0;E=c[b>>2]|0;F=b}c[F>>2]=l;c[E+12>>2]=l;c[l+8>>2]=E;c[l+12>>2]=n;return}n=D>>>8;if(n)if(D>>>0>16777215)G=31;else{E=(n+1048320|0)>>>16&8;F=n<<E;n=(F+520192|0)>>>16&4;b=F<<n;F=(b+245760|0)>>>16&2;a=14-(n|E|F)+(b<<F>>>15)|0;G=D>>>(a+7|0)&1|a<<1}else G=0;a=15656+(G<<2)|0;c[l+28>>2]=G;c[l+20>>2]=0;c[l+16>>2]=0;F=c[3839]|0;b=1<<G;a:do if(!(F&b)){c[3839]=F|b;c[a>>2]=l;c[l+24>>2]=a;c[l+12>>2]=l;c[l+8>>2]=l}else{E=c[a>>2]|0;b:do if((c[E+4>>2]&-8|0)==(D|0))H=E;else{n=D<<((G|0)==31?0:25-(G>>>1)|0);m=E;while(1){I=m+16+(n>>>31<<2)|0;r=c[I>>2]|0;if(!r)break;if((c[r+4>>2]&-8|0)==(D|0)){H=r;break b}else{n=n<<1;m=r}}c[I>>2]=l;c[l+24>>2]=m;c[l+12>>2]=l;c[l+8>>2]=l;break a}while(0);E=H+8|0;w=c[E>>2]|0;c[w+12>>2]=l;c[E>>2]=l;c[l+8>>2]=w;c[l+12>>2]=H;c[l+24>>2]=0}while(0);l=(c[3846]|0)+-1|0;c[3846]=l;if(l|0)return;l=15808;while(1){H=c[l>>2]|0;if(!H)break;else l=H+8|0}c[3846]=-1;return}function _h(a){a=a|0;return}function $h(a){a=a|0;_h(a);gi(a);return}function ai(a){a=a|0;return 13455}function bi(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,v=0,w=0,x=0,y=0,A=0,B=0,C=0,D=0,E=0,F=0;b=Ca;Ca=Ca+16|0;if((Ca|0)>=(Da|0))z(16);d=b;e=b+8|0;f=b+4|0;c[e>>2]=a;do if(a>>>0>=212){g=(a>>>0)/210|0;h=g*210|0;c[f>>2]=a-h;i=0;j=g;g=h;h=(ci(2592,2784,f,d)|0)-2592>>2;a:while(1){k=(c[2592+(h<<2)>>2]|0)+g|0;l=5;while(1){if(l>>>0>=47){m=6;break}n=c[2400+(l<<2)>>2]|0;o=(k>>>0)/(n>>>0)|0;if(o>>>0<n>>>0){m=107;break a}if((k|0)==(u(o,n)|0)){p=i;break}else l=l+1|0}b:do if((m|0)==6){m=0;l=211;n=i;c:while(1){o=(k>>>0)/(l>>>0)|0;do if(o>>>0>=l>>>0)if((k|0)!=(u(o,l)|0)){q=l+10|0;r=(k>>>0)/(q>>>0)|0;if(r>>>0>=q>>>0)if((k|0)!=(u(r,q)|0)){r=l+12|0;s=(k>>>0)/(r>>>0)|0;if(s>>>0>=r>>>0)if((k|0)!=(u(s,r)|0)){s=l+16|0;t=(k>>>0)/(s>>>0)|0;if(t>>>0>=s>>>0)if((k|0)!=(u(t,s)|0)){t=l+18|0;v=(k>>>0)/(t>>>0)|0;if(v>>>0>=t>>>0)if((k|0)!=(u(v,t)|0)){v=l+22|0;w=(k>>>0)/(v>>>0)|0;if(w>>>0>=v>>>0)if((k|0)!=(u(w,v)|0)){w=l+28|0;x=(k>>>0)/(w>>>0)|0;if(x>>>0>=w>>>0)if((k|0)==(u(x,w)|0)){y=w;A=9;B=n}else{x=l+30|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+36|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+40|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+42|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+46|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+52|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+58|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+60|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+66|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+70|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+72|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+78|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+82|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+88|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+96|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+100|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+102|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+106|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+108|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+112|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+120|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+126|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+130|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+136|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+138|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+142|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+148|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+150|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+156|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+162|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+166|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+168|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+172|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+178|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+180|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+186|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+190|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+192|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+196|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+198|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;A=1;B=k;break}if((k|0)==(u(C,x)|0)){y=x;A=9;B=n;break}x=l+208|0;C=(k>>>0)/(x>>>0)|0;D=C>>>0<x>>>0;E=(k|0)==(u(C,x)|0);y=D|E?x:l+210|0;A=D?1:E?9:0;B=D?k:n}else{y=w;A=1;B=k}}else{y=v;A=9;B=n}else{y=v;A=1;B=k}}else{y=t;A=9;B=n}else{y=t;A=1;B=k}}else{y=s;A=9;B=n}else{y=s;A=1;B=k}}else{y=r;A=9;B=n}else{y=r;A=1;B=k}}else{y=q;A=9;B=n}else{y=q;A=1;B=k}}else{y=l;A=9;B=n}else{y=l;A=1;B=k}while(0);switch(A&15){case 9:{p=B;break b;break}case 0:{l=y;n=B;break}default:break c}}if(!A)p=B;else{m=108;break a}}while(0);n=h+1|0;l=(n|0)==48;o=j+(l&1)|0;i=p;j=o;g=o*210|0;h=l?0:n}if((m|0)==107){c[e>>2]=k;F=k;break}else if((m|0)==108){c[e>>2]=k;F=B;break}}else F=c[(ci(2400,2592,e,d)|0)>>2]|0;while(0);Ca=b;return F|0}function ci(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0;e=c[d>>2]|0;d=a;f=b-a>>2;while(1){if(!f)break;a=(f|0)/2|0;b=d+(a<<2)|0;g=(c[b>>2]|0)>>>0<e>>>0;d=g?b+4|0:d;f=g?f+-1-a|0:a}return d|0}function di(a){a=a|0;return}function ei(a){a=a|0;var b=0,d=0;b=a+8|0;if(!((c[b>>2]|0)!=0?(d=c[b>>2]|0,c[b>>2]=d+-1,(d|0)!=0):0))Ja[c[(c[a>>2]|0)+16>>2]&255](a);return}function fi(a){a=a|0;var b=0,c=0;b=(a|0)==0?1:a;while(1){a=Yh(b)|0;if(a|0){c=a;break}a=ej()|0;if(!a){c=0;break}Ia[a&3]()}return c|0}function gi(a){a=a|0;Zh(a);return}function hi(a,b){a=a|0;b=b|0;var d=0,e=0,f=0;d=kh(b)|0;e=fi(d+13|0)|0;c[e>>2]=d;c[e+4>>2]=d;c[e+8>>2]=0;f=ii(e)|0;rj(f|0,b|0,d+1|0)|0;c[a>>2]=f;return}function ii(a){a=a|0;return a+12|0}function ji(a,b){a=a|0;b=b|0;c[a>>2]=6444;hi(a+4|0,b);return}function ki(a){a=a|0;return 1}function li(a){a=a|0;na()}function mi(b,d){b=b|0;d=d|0;c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;if((a[d+11>>0]|0)<0)ni(b,c[d>>2]|0,c[d+4>>2]|0);else{c[b>>2]=c[d>>2];c[b+4>>2]=c[d+4>>2];c[b+8>>2]=c[d+8>>2]}return}function ni(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0;f=Ca;Ca=Ca+16|0;if((Ca|0)>=(Da|0))z(16);g=f;if(e>>>0>4294967279)li(b);if(e>>>0<11){a[b+11>>0]=e;h=b}else{i=e+16&-16;j=fi(i)|0;c[b>>2]=j;c[b+8>>2]=i|-2147483648;c[b+4>>2]=e;h=j}oi(h,d,e)|0;a[g>>0]=0;pi(h+e|0,g);Ca=f;return}function oi(a,b,c){a=a|0;b=b|0;c=c|0;if(c|0)rj(a|0,b|0,c|0)|0;return a|0}function pi(b,c){b=b|0;c=c|0;a[b>>0]=a[c>>0]|0;return}function qi(a){a=a|0;na()}function ri(){var a=0,b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0;a=Ca;Ca=Ca+48|0;if((Ca|0)>=(Da|0))z(48);b=a+32|0;d=a+24|0;e=a+16|0;f=a;g=a+36|0;a=si()|0;if(a|0?(h=c[a>>2]|0,h|0):0){a=h+48|0;i=c[a>>2]|0;j=c[a+4>>2]|0;if(!((i&-256|0)==1126902528&(j|0)==1129074247)){c[d>>2]=13697;ti(13647,d)}if((i|0)==1126902529&(j|0)==1129074247)k=c[h+44>>2]|0;else k=h+80|0;c[g>>2]=k;k=c[h>>2]|0;h=c[k+4>>2]|0;if(Ha[c[(c[990]|0)+16>>2]&7](3960,k,g)|0){k=c[g>>2]|0;g=Fa[c[(c[k>>2]|0)+8>>2]&63](k)|0;c[f>>2]=13697;c[f+4>>2]=h;c[f+8>>2]=g;ti(13561,f)}else{c[e>>2]=13697;c[e+4>>2]=h;ti(13606,e)}}ti(13685,b)}function si(){var a=0,b=0;a=Ca;Ca=Ca+16|0;if((Ca|0)>=(Da|0))z(16);if(!(ya(15848,3)|0)){b=wa(c[3963]|0)|0;Ca=a;return b|0}else ti(13836,a);return 0}function ti(a,b){a=a|0;b=b|0;var d=0,e=0;d=Ca;Ca=Ca+16|0;if((Ca|0)>=(Da|0))z(16);e=d;c[e>>2]=b;b=c[1457]|0;Ah(b,a,e)|0;Wh(10,b)|0;na()}function ui(a){a=a|0;return}function vi(a){a=a|0;ui(a);gi(a);return}function wi(a){a=a|0;return}function xi(a){a=a|0;return}function yi(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0;e=Ca;Ca=Ca+64|0;if((Ca|0)>=(Da|0))z(64);f=e;if(!(Ci(a,b,0)|0))if((b|0)!=0?(g=Gi(b,3984,3968,0)|0,(g|0)!=0):0){b=f+4|0;h=b+52|0;do{c[b>>2]=0;b=b+4|0}while((b|0)<(h|0));c[f>>2]=g;c[f+8>>2]=a;c[f+12>>2]=-1;c[f+48>>2]=1;Oa[c[(c[g>>2]|0)+28>>2]&31](g,f,c[d>>2]|0,1);if((c[f+24>>2]|0)==1){c[d>>2]=c[f+16>>2];i=1}else i=0;j=i}else j=0;else j=1;Ca=e;return j|0}function zi(a,b,d,e,f,g){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;if(Ci(a,c[b+8>>2]|0,g)|0)Fi(0,b,d,e,f);return}function Ai(b,d,e,f,g){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0;do if(!(Ci(b,c[d+8>>2]|0,g)|0)){if(Ci(b,c[d>>2]|0,g)|0){if((c[d+16>>2]|0)!=(e|0)?(h=d+20|0,(c[h>>2]|0)!=(e|0)):0){c[d+32>>2]=f;c[h>>2]=e;h=d+40|0;c[h>>2]=(c[h>>2]|0)+1;if((c[d+36>>2]|0)==1?(c[d+24>>2]|0)==2:0)a[d+54>>0]=1;c[d+44>>2]=4;break}if((f|0)==1)c[d+32>>2]=1}}else Ei(0,d,e,f);while(0);return}function Bi(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;if(Ci(a,c[b+8>>2]|0,0)|0)Di(0,b,d,e);return}function Ci(a,b,c){a=a|0;b=b|0;c=c|0;return (a|0)==(b|0)|0}function Di(b,d,e,f){b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0;b=d+16|0;g=c[b>>2]|0;do if(g){if((g|0)!=(e|0)){h=d+36|0;c[h>>2]=(c[h>>2]|0)+1;c[d+24>>2]=2;a[d+54>>0]=1;break}h=d+24|0;if((c[h>>2]|0)==2)c[h>>2]=f}else{c[b>>2]=e;c[d+24>>2]=f;c[d+36>>2]=1}while(0);return}function Ei(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;if((c[b+4>>2]|0)==(d|0)?(d=b+28|0,(c[d>>2]|0)!=1):0)c[d>>2]=e;return}function Fi(b,d,e,f,g){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0;a[d+53>>0]=1;do if((c[d+4>>2]|0)==(f|0)){a[d+52>>0]=1;b=d+16|0;h=c[b>>2]|0;if(!h){c[b>>2]=e;c[d+24>>2]=g;c[d+36>>2]=1;if(!((g|0)==1?(c[d+48>>2]|0)==1:0))break;a[d+54>>0]=1;break}if((h|0)!=(e|0)){h=d+36|0;c[h>>2]=(c[h>>2]|0)+1;a[d+54>>0]=1;break}h=d+24|0;b=c[h>>2]|0;if((b|0)==2){c[h>>2]=g;i=g}else i=b;if((i|0)==1?(c[d+48>>2]|0)==1:0)a[d+54>>0]=1}while(0);return}function Gi(d,e,f,g){d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0;h=Ca;Ca=Ca+64|0;if((Ca|0)>=(Da|0))z(64);i=h;j=c[d>>2]|0;k=d+(c[j+-8>>2]|0)|0;l=c[j+-4>>2]|0;c[i>>2]=f;c[i+4>>2]=d;c[i+8>>2]=e;c[i+12>>2]=g;g=i+16|0;e=i+20|0;d=i+24|0;j=i+28|0;m=i+32|0;n=i+40|0;o=g;p=o+36|0;do{c[o>>2]=0;o=o+4|0}while((o|0)<(p|0));b[g+36>>1]=0;a[g+38>>0]=0;a:do if(Ci(l,f,0)|0){c[i+48>>2]=1;Qa[c[(c[l>>2]|0)+20>>2]&3](l,i,k,k,1,0);q=(c[d>>2]|0)==1?k:0}else{Pa[c[(c[l>>2]|0)+24>>2]&3](l,i,k,1,0);switch(c[i+36>>2]|0){case 0:{q=(c[n>>2]|0)==1&(c[j>>2]|0)==1&(c[m>>2]|0)==1?c[e>>2]|0:0;break a;break}case 1:break;default:{q=0;break a}}if((c[d>>2]|0)!=1?!((c[n>>2]|0)==0&(c[j>>2]|0)==1&(c[m>>2]|0)==1):0){q=0;break}q=c[g>>2]|0}while(0);Ca=h;return q|0}function Hi(a){a=a|0;ui(a);gi(a);return}function Ii(a,b,d,e,f,g){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0;if(Ci(a,c[b+8>>2]|0,g)|0)Fi(0,b,d,e,f);else{h=c[a+8>>2]|0;Qa[c[(c[h>>2]|0)+20>>2]&3](h,b,d,e,f,g)}return}function Ji(b,d,e,f,g){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0;do if(!(Ci(b,c[d+8>>2]|0,g)|0)){if(!(Ci(b,c[d>>2]|0,g)|0)){h=c[b+8>>2]|0;Pa[c[(c[h>>2]|0)+24>>2]&3](h,d,e,f,g);break}if((c[d+16>>2]|0)!=(e|0)?(h=d+20|0,(c[h>>2]|0)!=(e|0)):0){c[d+32>>2]=f;i=d+44|0;if((c[i>>2]|0)==4)break;j=d+52|0;a[j>>0]=0;k=d+53|0;a[k>>0]=0;l=c[b+8>>2]|0;Qa[c[(c[l>>2]|0)+20>>2]&3](l,d,e,e,1,g);if(a[k>>0]|0)if(!(a[j>>0]|0)){m=1;n=11}else n=15;else{m=0;n=11}do if((n|0)==11){c[h>>2]=e;j=d+40|0;c[j>>2]=(c[j>>2]|0)+1;if((c[d+36>>2]|0)==1?(c[d+24>>2]|0)==2:0){a[d+54>>0]=1;if(m){n=15;break}else{o=4;break}}if(m)n=15;else o=4}while(0);if((n|0)==15)o=3;c[i>>2]=o;break}if((f|0)==1)c[d+32>>2]=1}else Ei(0,d,e,f);while(0);return}function Ki(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0;if(Ci(a,c[b+8>>2]|0,0)|0)Di(0,b,d,e);else{f=c[a+8>>2]|0;Oa[c[(c[f>>2]|0)+28>>2]&31](f,b,d,e)}return}function Li(a){a=a|0;return}function Mi(){var a=0;a=Ca;Ca=Ca+16|0;if((Ca|0)>=(Da|0))z(16);if(!(xa(15852,150)|0)){Ca=a;return}else ti(13885,a)}function Ni(a){a=a|0;var b=0;b=Ca;Ca=Ca+16|0;if((Ca|0)>=(Da|0))z(16);Zh(a);if(!(za(c[3963]|0,0)|0)){Ca=b;return}else ti(13935,b)}function Oi(){var a=0,b=0;a=si()|0;if((a|0?(b=c[a>>2]|0,b|0):0)?(a=b+48|0,(c[a>>2]&-256|0)==1126902528?(c[a+4>>2]|0)==1129074247:0):0)Pi(c[b+12>>2]|0);Pi(Qi()|0)}function Pi(a){a=a|0;var b=0;b=Ca;Ca=Ca+16|0;if((Ca|0)>=(Da|0))z(16);Ia[a&3]();ti(13988,b)}function Qi(){var a=0;a=c[1588]|0;c[1588]=a+0;return a|0}function Ri(a){a=a|0;return}function Si(a){a=a|0;c[a>>2]=6444;Wi(a+4|0);return}function Ti(a){a=a|0;Si(a);gi(a);return}function Ui(a){a=a|0;return Vi(a+4|0)|0}function Vi(a){a=a|0;return c[a>>2]|0}function Wi(a){a=a|0;var b=0,d=0;if(ki(a)|0?(b=Xi(c[a>>2]|0)|0,a=b+8|0,d=c[a>>2]|0,c[a>>2]=d+-1,(d+-1|0)<0):0)gi(b);return}function Xi(a){a=a|0;return a+-12|0}function Yi(a){a=a|0;Si(a);gi(a);return}function Zi(a){a=a|0;ui(a);gi(a);return}function _i(b,d,e,f,g,h){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;h=h|0;var i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0;if(Ci(b,c[d+8>>2]|0,h)|0)Fi(0,d,e,f,g);else{i=d+52|0;j=a[i>>0]|0;k=d+53|0;l=a[k>>0]|0;m=c[b+12>>2]|0;n=b+16+(m<<3)|0;a[i>>0]=0;a[k>>0]=0;cj(b+16|0,d,e,f,g,h);a:do if((m|0)>1){o=d+24|0;p=b+8|0;q=d+54|0;r=b+24|0;do{if(a[q>>0]|0)break a;if(!(a[i>>0]|0)){if(a[k>>0]|0?(c[p>>2]&1|0)==0:0)break a}else{if((c[o>>2]|0)==1)break a;if(!(c[p>>2]&2))break a}a[i>>0]=0;a[k>>0]=0;cj(r,d,e,f,g,h);r=r+8|0}while(r>>>0<n>>>0)}while(0);a[i>>0]=j;a[k>>0]=l}return}function $i(b,d,e,f,g){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0;a:do if(!(Ci(b,c[d+8>>2]|0,g)|0)){if(!(Ci(b,c[d>>2]|0,g)|0)){h=c[b+12>>2]|0;i=b+16+(h<<3)|0;dj(b+16|0,d,e,f,g);j=b+24|0;if((h|0)<=1)break;h=c[b+8>>2]|0;if((h&2|0)==0?(k=d+36|0,(c[k>>2]|0)!=1):0){if(!(h&1)){h=d+54|0;l=j;while(1){if(a[h>>0]|0)break a;if((c[k>>2]|0)==1)break a;dj(l,d,e,f,g);l=l+8|0;if(l>>>0>=i>>>0)break a}}l=d+24|0;h=d+54|0;m=j;while(1){if(a[h>>0]|0)break a;if((c[k>>2]|0)==1?(c[l>>2]|0)==1:0)break a;dj(m,d,e,f,g);m=m+8|0;if(m>>>0>=i>>>0)break a}}m=d+54|0;l=j;while(1){if(a[m>>0]|0)break a;dj(l,d,e,f,g);l=l+8|0;if(l>>>0>=i>>>0)break a}}if((c[d+16>>2]|0)!=(e|0)?(i=d+20|0,(c[i>>2]|0)!=(e|0)):0){c[d+32>>2]=f;l=d+44|0;if((c[l>>2]|0)==4)break;m=b+16+(c[b+12>>2]<<3)|0;j=d+52|0;k=d+53|0;h=d+54|0;n=b+8|0;o=d+24|0;p=0;q=b+16|0;r=0;b:while(1){if(q>>>0>=m>>>0){s=p;t=18;break}a[j>>0]=0;a[k>>0]=0;cj(q,d,e,e,1,g);if(a[h>>0]|0){s=p;t=18;break}do if(a[k>>0]|0){if(!(a[j>>0]|0))if(!(c[n>>2]&1)){s=1;t=18;break b}else{u=1;v=r;break}if((c[o>>2]|0)==1){t=23;break b}if(!(c[n>>2]&2)){t=23;break b}else{u=1;v=1}}else{u=p;v=r}while(0);p=u;q=q+8|0;r=v}do if((t|0)==18){if((!r?(c[i>>2]=e,q=d+40|0,c[q>>2]=(c[q>>2]|0)+1,(c[d+36>>2]|0)==1):0)?(c[o>>2]|0)==2:0){a[h>>0]=1;if(s){t=23;break}else{w=4;break}}if(s)t=23;else w=4}while(0);if((t|0)==23)w=3;c[l>>2]=w;break}if((f|0)==1)c[d+32>>2]=1}else Ei(0,d,e,f);while(0);return}function aj(b,d,e,f){b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0;a:do if(!(Ci(b,c[d+8>>2]|0,0)|0)){g=c[b+12>>2]|0;h=b+16+(g<<3)|0;bj(b+16|0,d,e,f);if((g|0)>1){g=d+54|0;i=b+24|0;do{bj(i,d,e,f);if(a[g>>0]|0)break a;i=i+8|0}while(i>>>0<h>>>0)}}else Di(0,d,e,f);while(0);return}function bj(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0;f=c[a+4>>2]|0;g=f>>8;if(!(f&1))h=g;else h=c[(c[d>>2]|0)+g>>2]|0;g=c[a>>2]|0;Oa[c[(c[g>>2]|0)+28>>2]&31](g,b,d+h|0,(f&2|0)==0?2:e);return}function cj(a,b,d,e,f,g){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0,j=0;h=c[a+4>>2]|0;i=h>>8;if(!(h&1))j=i;else j=c[(c[e>>2]|0)+i>>2]|0;i=c[a>>2]|0;Qa[c[(c[i>>2]|0)+20>>2]&3](i,b,d,e+j|0,(h&2|0)==0?2:f,g);return}function dj(a,b,d,e,f){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0;g=c[a+4>>2]|0;h=g>>8;if(!(g&1))i=h;else i=c[(c[d>>2]|0)+h>>2]|0;h=c[a>>2]|0;Pa[c[(c[h>>2]|0)+24>>2]&3](h,b,d+i|0,(g&2|0)==0?2:e,f);return}function ej(){var a=0;a=c[3964]|0;c[3964]=a+0;return a|0}function fj(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0;e=Ca;Ca=Ca+16|0;if((Ca|0)>=(Da|0))z(16);f=e;c[f>>2]=c[d>>2];g=Ha[c[(c[a>>2]|0)+16>>2]&7](a,b,f)|0;if(g)c[d>>2]=c[f>>2];Ca=e;return g&1|0}function gj(a){a=a|0;var b=0;if(!a)b=0;else b=(Gi(a,3984,4072,0)|0)!=0&1;return b|0}function hj(a,b){a=a|0;b=b|0;var c=0,d=0,e=0,f=0;c=a&65535;d=b&65535;e=u(d,c)|0;f=a>>>16;a=(e>>>16)+(u(d,f)|0)|0;d=b>>>16;b=u(d,c)|0;return (x((a>>>16)+(u(d,f)|0)+(((a&65535)+b|0)>>>16)|0),a+b<<16|e&65535|0)|0}function ij(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;var e=0,f=0;e=a;a=c;c=hj(e,a)|0;f=y()|0;return (x((u(b,a)|0)+(u(d,e)|0)+f|f&0|0),c|0|0)|0}function jj(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;var e=0;e=a+c>>>0;return (x(b+d+(e>>>0<a>>>0|0)>>>0|0),e|0)|0}function kj(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;var e=0;e=b-d>>>0;e=b-d-(c>>>0>a>>>0|0)>>>0;return (x(e|0),a-c>>>0|0)|0}function lj(a){a=a|0;return (a?31-(v(a^a-1)|0)|0:32)|0}function mj(a,b,d,e,f){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,w=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0;g=a;h=b;i=h;j=d;k=e;l=k;if(!i){m=(f|0)!=0;if(!l){if(m){c[f>>2]=(g>>>0)%(j>>>0);c[f+4>>2]=0}n=0;o=(g>>>0)/(j>>>0)>>>0;return (x(n|0),o)|0}else{if(!m){n=0;o=0;return (x(n|0),o)|0}c[f>>2]=a|0;c[f+4>>2]=b&0;n=0;o=0;return (x(n|0),o)|0}}m=(l|0)==0;do if(j){if(!m){p=(v(l|0)|0)-(v(i|0)|0)|0;if(p>>>0<=31){q=p+1|0;r=31-p|0;s=p-31>>31;t=q;u=g>>>(q>>>0)&s|i<<r;w=i>>>(q>>>0)&s;z=0;A=g<<r;break}if(!f){n=0;o=0;return (x(n|0),o)|0}c[f>>2]=a|0;c[f+4>>2]=h|b&0;n=0;o=0;return (x(n|0),o)|0}r=j-1|0;if(r&j|0){s=(v(j|0)|0)+33-(v(i|0)|0)|0;q=64-s|0;p=32-s|0;B=p>>31;C=s-32|0;D=C>>31;t=s;u=p-1>>31&i>>>(C>>>0)|(i<<p|g>>>(s>>>0))&D;w=D&i>>>(s>>>0);z=g<<q&B;A=(i<<q|g>>>(C>>>0))&B|g<<p&s-33>>31;break}if(f|0){c[f>>2]=r&g;c[f+4>>2]=0}if((j|0)==1){n=h|b&0;o=a|0|0;return (x(n|0),o)|0}else{r=lj(j|0)|0;n=i>>>(r>>>0)|0;o=i<<32-r|g>>>(r>>>0)|0;return (x(n|0),o)|0}}else{if(m){if(f|0){c[f>>2]=(i>>>0)%(j>>>0);c[f+4>>2]=0}n=0;o=(i>>>0)/(j>>>0)>>>0;return (x(n|0),o)|0}if(!g){if(f|0){c[f>>2]=0;c[f+4>>2]=(i>>>0)%(l>>>0)}n=0;o=(i>>>0)/(l>>>0)>>>0;return (x(n|0),o)|0}r=l-1|0;if(!(r&l)){if(f|0){c[f>>2]=a|0;c[f+4>>2]=r&i|b&0}n=0;o=i>>>((lj(l|0)|0)>>>0);return (x(n|0),o)|0}r=(v(l|0)|0)-(v(i|0)|0)|0;if(r>>>0<=30){s=r+1|0;p=31-r|0;t=s;u=i<<p|g>>>(s>>>0);w=i>>>(s>>>0);z=0;A=g<<p;break}if(!f){n=0;o=0;return (x(n|0),o)|0}c[f>>2]=a|0;c[f+4>>2]=h|b&0;n=0;o=0;return (x(n|0),o)|0}while(0);if(!t){E=A;F=z;G=w;H=u;I=0;J=0}else{b=d|0|0;d=k|e&0;e=jj(b|0,d|0,-1,-1)|0;k=y()|0;h=A;A=z;z=w;w=u;u=t;t=0;do{a=h;h=A>>>31|h<<1;A=t|A<<1;g=w<<1|a>>>31|0;a=w>>>31|z<<1|0;kj(e|0,k|0,g|0,a|0)|0;i=y()|0;l=i>>31|((i|0)<0?-1:0)<<1;t=l&1;w=kj(g|0,a|0,l&b|0,(((i|0)<0?-1:0)>>31|((i|0)<0?-1:0)<<1)&d|0)|0;z=y()|0;u=u-1|0}while((u|0)!=0);E=h;F=A;G=z;H=w;I=0;J=t}t=F;F=0;if(f|0){c[f>>2]=H;c[f+4>>2]=G}n=(t|0)>>>31|(E|F)<<1|(F<<1|t>>>31)&0|I;o=(t<<1|0>>>31)&-2|J;return (x(n|0),o)|0}function nj(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;return mj(a,b,c,d,0)|0}function oj(a,b,c){a=a|0;b=b|0;c=c|0;if((c|0)<32){x(b>>>c|0);return a>>>c|(b&(1<<c)-1)<<32-c}x(0);return b>>>c-32|0}function pj(a,b,c){a=a|0;b=b|0;c=c|0;if((c|0)<32){x(b<<c|(a&(1<<c)-1<<32-c)>>>32-c|0);return a<<c}x(a<<c-32|0);return 0}function qj(a){a=a|0;return (a&255)<<24|(a>>8&255)<<16|(a>>16&255)<<8|a>>>24|0}function rj(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0;if((e|0)>=8192){qa(b|0,d|0,e|0)|0;return b|0}f=b|0;g=b+e|0;if((b&3)==(d&3)){while(b&3){if(!e)return f|0;a[b>>0]=a[d>>0]|0;b=b+1|0;d=d+1|0;e=e-1|0}h=g&-4|0;e=h-64|0;while((b|0)<=(e|0)){c[b>>2]=c[d>>2];c[b+4>>2]=c[d+4>>2];c[b+8>>2]=c[d+8>>2];c[b+12>>2]=c[d+12>>2];c[b+16>>2]=c[d+16>>2];c[b+20>>2]=c[d+20>>2];c[b+24>>2]=c[d+24>>2];c[b+28>>2]=c[d+28>>2];c[b+32>>2]=c[d+32>>2];c[b+36>>2]=c[d+36>>2];c[b+40>>2]=c[d+40>>2];c[b+44>>2]=c[d+44>>2];c[b+48>>2]=c[d+48>>2];c[b+52>>2]=c[d+52>>2];c[b+56>>2]=c[d+56>>2];c[b+60>>2]=c[d+60>>2];b=b+64|0;d=d+64|0}while((b|0)<(h|0)){c[b>>2]=c[d>>2];b=b+4|0;d=d+4|0}}else{h=g-4|0;while((b|0)<(h|0)){a[b>>0]=a[d>>0]|0;a[b+1>>0]=a[d+1>>0]|0;a[b+2>>0]=a[d+2>>0]|0;a[b+3>>0]=a[d+3>>0]|0;b=b+4|0;d=d+4|0}}while((b|0)<(g|0)){a[b>>0]=a[d>>0]|0;b=b+1|0;d=d+1|0}return f|0}function sj(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0;f=b+e|0;d=d&255;if((e|0)>=67){while(b&3){a[b>>0]=d;b=b+1|0}g=f&-4|0;h=d|d<<8|d<<16|d<<24;i=g-64|0;while((b|0)<=(i|0)){c[b>>2]=h;c[b+4>>2]=h;c[b+8>>2]=h;c[b+12>>2]=h;c[b+16>>2]=h;c[b+20>>2]=h;c[b+24>>2]=h;c[b+28>>2]=h;c[b+32>>2]=h;c[b+36>>2]=h;c[b+40>>2]=h;c[b+44>>2]=h;c[b+48>>2]=h;c[b+52>>2]=h;c[b+56>>2]=h;c[b+60>>2]=h;b=b+64|0}while((b|0)<(g|0)){c[b>>2]=h;b=b+4|0}}while((b|0)<(f|0)){a[b>>0]=d;b=b+1|0}return f-e|0}function tj(a){a=a|0;var b=0,d=0;b=c[i>>2]|0;d=b+a|0;if((a|0)>0&(d|0)<(b|0)|(d|0)<0){Aa(d|0)|0;ha(12);return -1}if((d|0)>(oa()|0)){if(!(ra(d|0)|0)){ha(12);return -1}}else c[i>>2]=d;return b|0}function uj(a,b){a=a|0;b=b|0;return Fa[a&63](b|0)|0}function vj(a,b,c){a=a|0;b=b|0;c=c|0;return Ga[a&63](b|0,c|0)|0}function wj(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;return Ha[a&7](b|0,c|0,d|0)|0}function xj(a){a=a|0;Ia[a&3]()}function yj(a,b){a=a|0;b=b|0;Ja[a&255](b|0)}function zj(a,b,c,d){a=a|0;b=b|0;c=+c;d=d|0;Ka[a&1](b|0,+c,d|0)}function Aj(a,b,c){a=a|0;b=b|0;c=c|0;La[a&31](b|0,c|0)}function Bj(a,b,c,d){a=a|0;b=b|0;c=c|0;d=+d;Ma[a&3](b|0,c|0,+d)}function Cj(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;Na[a&3](b|0,c|0,d|0)}function Dj(a,b,c,d,e){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;Oa[a&31](b|0,c|0,d|0,e|0)}function Ej(a,b,c,d,e,f){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;f=f|0;Pa[a&3](b|0,c|0,d|0,e|0,f|0)}function Fj(a,b,c,d,e,f,g){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;f=f|0;g=g|0;Qa[a&3](b|0,c|0,d|0,e|0,f|0,g|0)}function Gj(a){a=a|0;A(0);return 0}function Hj(a){a=a|0;A(43);return 0}function Ij(a){a=a|0;A(44);return 0}function Jj(a){a=a|0;A(45);return 0}function Kj(a){a=a|0;A(46);return 0}function Lj(a){a=a|0;A(47);return 0}function Mj(a){a=a|0;A(48);return 0}function Nj(a){a=a|0;A(49);return 0}function Oj(a){a=a|0;A(50);return 0}function Pj(a){a=a|0;A(51);return 0}function Qj(a){a=a|0;A(52);return 0}function Rj(a){a=a|0;A(53);return 0}function Sj(a){a=a|0;A(54);return 0}function Tj(a){a=a|0;A(55);return 0}function Uj(a){a=a|0;A(56);return 0}function Vj(a){a=a|0;A(57);return 0}function Wj(a){a=a|0;A(58);return 0}function Xj(a){a=a|0;A(59);return 0}function Yj(a){a=a|0;A(60);return 0}function Zj(a){a=a|0;A(61);return 0}function _j(a){a=a|0;A(62);return 0}function $j(a){a=a|0;A(63);return 0}function ak(a,b){a=a|0;b=b|0;B(0);return 0}function bk(a,b){a=a|0;b=b|0;B(39);return 0}function ck(a,b){a=a|0;b=b|0;B(40);return 0}function dk(a,b){a=a|0;b=b|0;B(41);return 0}function ek(a,b){a=a|0;b=b|0;B(42);return 0}function fk(a,b){a=a|0;b=b|0;B(43);return 0}function gk(a,b){a=a|0;b=b|0;B(44);return 0}function hk(a,b){a=a|0;b=b|0;B(45);return 0}function ik(a,b){a=a|0;b=b|0;B(46);return 0}function jk(a,b){a=a|0;b=b|0;B(47);return 0}function kk(a,b){a=a|0;b=b|0;B(48);return 0}function lk(a,b){a=a|0;b=b|0;B(49);return 0}function mk(a,b){a=a|0;b=b|0;B(50);return 0}function nk(a,b){a=a|0;b=b|0;B(51);return 0}function ok(a,b){a=a|0;b=b|0;B(52);return 0}function pk(a,b){a=a|0;b=b|0;B(53);return 0}function qk(a,b){a=a|0;b=b|0;B(54);return 0}function rk(a,b){a=a|0;b=b|0;B(55);return 0}function sk(a,b){a=a|0;b=b|0;B(56);return 0}function tk(a,b){a=a|0;b=b|0;B(57);return 0}function uk(a,b){a=a|0;b=b|0;B(58);return 0}function vk(a,b){a=a|0;b=b|0;B(59);return 0}function wk(a,b){a=a|0;b=b|0;B(60);return 0}function xk(a,b){a=a|0;b=b|0;B(61);return 0}function yk(a,b){a=a|0;b=b|0;B(62);return 0}function zk(a,b){a=a|0;b=b|0;B(63);return 0}function Ak(a,b,c){a=a|0;b=b|0;c=c|0;C(0);return 0}function Bk(a,b,c){a=a|0;b=b|0;c=c|0;C(5);return 0}function Ck(a,b,c){a=a|0;b=b|0;c=c|0;C(6);return 0}function Dk(a,b,c){a=a|0;b=b|0;c=c|0;C(7);return 0}function Ek(){D(0)}function Fk(a){a=a|0;E(0)}function Gk(a){a=a|0;E(151)}function Hk(a){a=a|0;E(152)}function Ik(a){a=a|0;E(153)}function Jk(a){a=a|0;E(154)}function Kk(a){a=a|0;E(155)}function Lk(a){a=a|0;E(156)}function Mk(a){a=a|0;E(157)}function Nk(a){a=a|0;E(158)}function Ok(a){a=a|0;E(159)}function Pk(a){a=a|0;E(160)}function Qk(a){a=a|0;E(161)}function Rk(a){a=a|0;E(162)}function Sk(a){a=a|0;E(163)}function Tk(a){a=a|0;E(164)}function Uk(a){a=a|0;E(165)}function Vk(a){a=a|0;E(166)}function Wk(a){a=a|0;E(167)}function Xk(a){a=a|0;E(168)}function Yk(a){a=a|0;E(169)}function Zk(a){a=a|0;E(170)}function _k(a){a=a|0;E(171)}function $k(a){a=a|0;E(172)}function al(a){a=a|0;E(173)}function bl(a){a=a|0;E(174)}function cl(a){a=a|0;E(175)}function dl(a){a=a|0;E(176)}function el(a){a=a|0;E(177)}function fl(a){a=a|0;E(178)}function gl(a){a=a|0;E(179)}function hl(a){a=a|0;E(180)}function il(a){a=a|0;E(181)}function jl(a){a=a|0;E(182)}function kl(a){a=a|0;E(183)}function ll(a){a=a|0;E(184)}function ml(a){a=a|0;E(185)}function nl(a){a=a|0;E(186)}function ol(a){a=a|0;E(187)}function pl(a){a=a|0;E(188)}function ql(a){a=a|0;E(189)}function rl(a){a=a|0;E(190)}function sl(a){a=a|0;E(191)}function tl(a){a=a|0;E(192)}function ul(a){a=a|0;E(193)}function vl(a){a=a|0;E(194)}function wl(a){a=a|0;E(195)}function xl(a){a=a|0;E(196)}function yl(a){a=a|0;E(197)}function zl(a){a=a|0;E(198)}function Al(a){a=a|0;E(199)}function Bl(a){a=a|0;E(200)}function Cl(a){a=a|0;E(201)}function Dl(a){a=a|0;E(202)}function El(a){a=a|0;E(203)}function Fl(a){a=a|0;E(204)}function Gl(a){a=a|0;E(205)}function Hl(a){a=a|0;E(206)}function Il(a){a=a|0;E(207)}function Jl(a){a=a|0;E(208)}function Kl(a){a=a|0;E(209)}function Ll(a){a=a|0;E(210)}function Ml(a){a=a|0;E(211)}function Nl(a){a=a|0;E(212)}function Ol(a){a=a|0;E(213)}function Pl(a){a=a|0;E(214)}function Ql(a){a=a|0;E(215)}function Rl(a){a=a|0;E(216)}function Sl(a){a=a|0;E(217)}function Tl(a){a=a|0;E(218)}function Ul(a){a=a|0;E(219)}function Vl(a){a=a|0;E(220)}function Wl(a){a=a|0;E(221)}function Xl(a){a=a|0;E(222)}function Yl(a){a=a|0;E(223)}function Zl(a){a=a|0;E(224)}function _l(a){a=a|0;E(225)}function $l(a){a=a|0;E(226)}function am(a){a=a|0;E(227)}function bm(a){a=a|0;E(228)}function cm(a){a=a|0;E(229)}function dm(a){a=a|0;E(230)}function em(a){a=a|0;E(231)}function fm(a){a=a|0;E(232)}function gm(a){a=a|0;E(233)}function hm(a){a=a|0;E(234)}function im(a){a=a|0;E(235)}function jm(a){a=a|0;E(236)}function km(a){a=a|0;E(237)}function lm(a){a=a|0;E(238)}function mm(a){a=a|0;E(239)}function nm(a){a=a|0;E(240)}function om(a){a=a|0;E(241)}function pm(a){a=a|0;E(242)}function qm(a){a=a|0;E(243)}function rm(a){a=a|0;E(244)}function sm(a){a=a|0;E(245)}function tm(a){a=a|0;E(246)}function um(a){a=a|0;E(247)}function vm(a){a=a|0;E(248)}function wm(a){a=a|0;E(249)}function xm(a){a=a|0;E(250)}function ym(a){a=a|0;E(251)}function zm(a){a=a|0;E(252)}function Am(a){a=a|0;E(253)}function Bm(a){a=a|0;E(254)}function Cm(a){a=a|0;E(255)}function Dm(a,b,c){a=a|0;b=+b;c=c|0;F(0)}function Em(a,b){a=a|0;b=b|0;G(0)}function Fm(a,b){a=a|0;b=b|0;G(31)}function Gm(a,b,c){a=a|0;b=b|0;c=+c;H(0)}function Hm(a,b,c){a=a|0;b=b|0;c=c|0;I(0)}function Im(a,b,c){a=a|0;b=b|0;c=c|0;I(3)}function Jm(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;J(0)}function Km(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;J(19)}function Lm(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;J(20)}function Mm(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;J(21)}function Nm(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;J(22)}function Om(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;J(23)}function Pm(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;J(24)}function Qm(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;J(25)}function Rm(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;J(26)}function Sm(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;J(27)}function Tm(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;J(28)}function Um(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;J(29)}function Vm(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;J(30)}function Wm(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;J(31)}function Xm(a,b,c,d,e){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;K(0)}function Ym(a,b,c,d,e,f){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;f=f|0;L(0)}

// EMSCRIPTEN_END_FUNCS
var Fa=[Gj,cc,ic,nc,tc,wc,Cc,Kc,Qc,Tc,Zc,nd,td,xd,Dd,Hd,Nd,Qd,Wd,ee,ke,ne,te,we,Ce,Fe,Le,Oe,Ue,We,af,pf,tf,vf,zf,Ff,Hf,Nf,Ng,Tg,ah,ai,Ui,Hj,Ij,Jj,Kj,Lj,Mj,Nj,Oj,Pj,Qj,Rj,Sj,Tj,Uj,Vj,Wj,Xj,Yj,Zj,_j,$j];var Ga=[ak,Jb,Rb,Xb,hc,sc,Bc,Gc,Pc,Yc,dd,kd,sd,Cd,Md,Vd,ae,je,se,Be,Ke,Te,$e,ef,mf,uf,Ef,Mf,Vf,$f,gg,lg,pg,tg,xg,Bg,Fg,Kg,Sg,bk,ck,dk,ek,fk,gk,hk,ik,jk,kk,lk,mk,nk,ok,pk,qk,rk,sk,tk,uk,vk,wk,xk,yk,zk];var Ha=[Ak,bh,ch,gh,yi,Bk,Ck,Dk];var Ia=[Ek,ri,Xa,Mi];var Ja=[Fk,di,Hb,Ib,Kb,Pb,Qb,Sb,Vb,Wb,Yb,ac,bc,ec,fc,lc,mc,pc,qc,uc,vc,yc,zc,Ec,Fc,Hc,Rc,Jc,Mc,Nc,Sc,Vc,Wc,bd,cd,ed,id,jd,ld,md,pd,qd,vd,wd,zd,Ad,Bd,Fd,Gd,Jd,Kd,Ld,Od,Pd,Sd,Td,_d,$d,be,ce,de,ge,he,ie,le,me,pe,qe,re,ue,ve,ye,ze,De,Ee,He,Ie,Je,Me,Ne,Qe,Re,Se,jc,Ve,Ye,Ze,cf,df,ff,kf,lf,nf,wf,of,rf,sf,xf,yf,Bf,Cf,Gf,Jf,Kf,Tf,Uf,Wf,Zf,_f,ag,eg,fg,hg,jg,kg,mg,ng,og,qg,rg,sg,ug,vg,wg,yg,zg,Ag,Cg,Dg,Eg,Gg,Ig,Jg,Lg,Ed,Mg,Pg,Qg,Rg,_h,$h,ui,vi,wi,xi,Hi,Si,Ti,Yi,Zi,Ni,Gk,Hk,Ik,Jk,Kk,Lk,Mk,Nk,Ok,Pk,Qk,Rk,Sk,Tk,Uk,Vk,Wk,Xk,Yk,Zk,_k,$k,al,bl,cl,dl,el,fl,gl,hl,il,jl,kl,ll,ml,nl,ol,pl,ql,rl,sl,tl,ul,vl,wl,xl,yl,zl,Al,Bl,Cl,Dl,El,Fl,Gl,Hl,Il,Jl,Kl,Ll,Ml,Nl,Ol,Pl,Ql,Rl,Sl,Tl,Ul,Vl,Wl,Xl,Yl,Zl,_l,$l,am,bm,cm,dm,em,fm,gm,hm,im,jm,km,lm,mm,nm,om,pm,qm,rm,sm,tm,um,vm,wm,xm,ym,zm,Am,Bm,Cm];var Ka=[Dm,nb];var La=[Em,ob,pb,dc,gc,oc,rc,xc,Lc,Oc,Uc,Xc,od,rd,yd,Id,Rd,Ud,fe,oe,xe,Ae,Ge,Pe,Xe,_e,qf,Af,If,Lf,Og,Fm];var Ma=[Gm,Rf,Xf,cg];var Na=[Hm,Ab,Df,Im];var Oa=[Jm,Bb,Cb,Lb,Mb,Tb,Ub,Ac,Nb,Ob,_c,$c,fd,gd,Xd,Yd,Bi,Ki,aj,Km,Lm,Mm,Nm,Om,Pm,Qm,Rm,Sm,Tm,Um,Vm,Wm];var Pa=[Xm,Ai,Ji,$i];var Qa=[Ym,zi,Ii,_i];return{__GLOBAL__sub_I_main_cpp:$g,___cxa_can_catch:fj,___cxa_is_pointer_type:gj,___em_js__getCanvasHeight:Wa,___em_js__getCanvasWidth:Va,___errno_location:eh,___muldi3:ij,___udivdi3:nj,_bitshift64Lshr:oj,_bitshift64Shl:pj,_fflush:xh,_free:Zh,_i64Add:jj,_i64Subtract:kj,_llvm_bswap_i32:qj,_main:Ya,_malloc:Yh,_memcpy:rj,_memset:sj,_sbrk:tj,dynCall_ii:uj,dynCall_iii:vj,dynCall_iiii:wj,dynCall_v:xj,dynCall_vi:yj,dynCall_vidi:zj,dynCall_vii:Aj,dynCall_viid:Bj,dynCall_viii:Cj,dynCall_viiii:Dj,dynCall_viiiii:Ej,dynCall_viiiiii:Fj,establishStackSpace:Ua,stackAlloc:Ra,stackRestore:Ta,stackSave:Sa}})


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

var dynCall_vidi = Module["dynCall_vidi"] = asm["dynCall_vidi"];

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

