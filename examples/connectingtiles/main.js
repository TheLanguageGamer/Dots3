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

function allocate(slab, types, allocator, ptr) {
 var zeroinit, size;
 if (typeof slab === "number") {
  zeroinit = true;
  size = slab;
 } else {
  zeroinit = false;
  size = slab.length;
 }
 var singleType = typeof types === "string" ? types : null;
 var ret;
 if (allocator == ALLOC_NONE) {
  ret = ptr;
 } else {
  ret = [ _malloc, stackAlloc, dynamicAlloc ][allocator](Math.max(size, singleType ? 1 : types.length));
 }
 if (zeroinit) {
  var stop;
  ptr = ret;
  assert((ret & 3) == 0);
  stop = ret + (size & ~3);
  for (;ptr < stop; ptr += 4) {
   HEAP32[ptr >> 2] = 0;
  }
  stop = ret + size;
  while (ptr < stop) {
   HEAP8[ptr++ >> 0] = 0;
  }
  return ret;
 }
 if (singleType === "i8") {
  if (slab.subarray || slab.slice) {
   HEAPU8.set(slab, ret);
  } else {
   HEAPU8.set(new Uint8Array(slab), ret);
  }
  return ret;
 }
 var i = 0, type, typeSize, previousType;
 while (i < size) {
  var curr = slab[i];
  type = singleType || types[i];
  if (type === 0) {
   i++;
   continue;
  }
  assert(type, "Must know what type to store in allocate!");
  if (type == "i64") type = "i32";
  setValue(ret + i, curr, type);
  if (previousType !== type) {
   typeSize = getNativeTypeSize(type);
   previousType = type;
  }
  i += typeSize;
 }
 return ret;
}

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

var STACK_BASE = 19088, STACK_MAX = 5261968, DYNAMIC_BASE = 5261968, DYNAMICTOP_PTR = 18832;

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

var tempDoublePtr = 19072;

assert(tempDoublePtr % 8 == 0);

var Engine = {
 ctx: null,
 IMAGE_FOLDER: "../../images/",
 images: {},
 mode: 3,
 sounds: {},
 init: function() {
  console.log("$Engine.init");
  var canvas = Module["canvas"];
  Engine.ctx = canvas.getContext("2d");
 },
 sound: function(src) {
  this.sound = document.createElement("audio");
  this.sound.src = src;
  this.sound.setAttribute("preload", "auto");
  this.sound.setAttribute("controls", "none");
  this.sound.style.display = "none";
  document.body.appendChild(this.sound);
  this.play = function() {
   this.sound.play();
  };
  this.stop = function() {
   this.sound.pause();
  };
 },
 registerSound: function(path) {
  path = UTF8ToString(path);
  Engine.sounds[path] = new Engine.sound(path);
 },
 playSound: function(path) {
  path = UTF8ToString(path);
  sound = Engine.sounds[path];
  sound.stop();
  sound.play();
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
 strokeRectangle: function(x, y, width, height, thickness, rgba) {
  Engine.ctx.globalAlpha = (rgba & 255) / 255;
  Engine.ctx.strokeStyle = Engine.translateColorToCSSRGB(rgba);
  Engine.ctx.lineWidth = thickness;
  Engine.ctx.beginPath();
  Engine.ctx.strokeRect(x, y, width, height);
  Engine.ctx.stroke();
 },
 rectangle: function(x, y, width, height, thickness, stroke, fill) {
  Engine.ctx.globalAlpha = Math.max((stroke & 255) / 255, (fill & 255) / 255);
  Engine.ctx.fillStyle = Engine.translateColorToCSSRGB(fill);
  Engine.ctx.strokeStyle = Engine.translateColorToCSSRGB(stroke);
  Engine.ctx.lineWidth = thickness;
  Engine.ctx.beginPath();
  Engine.ctx.fillRect(x, y, width, height);
  Engine.ctx.strokeRect(x, y, width, height);
  Engine.ctx.fill();
  Engine.ctx.stroke();
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
 },
 measureTextHeight: function(text, fontSize) {
  text = UTF8ToString(text);
  Engine.ctx.font = "" + fontSize + "px Monospace";
  var metrics = Engine.ctx.measureText(text);
  console.log("jhelms from js: ", metrics.emHeightAscent, metrics.emHeightDescent);
  for (var propt in metrics) {
   console.log(propt + ": " + metrics[propt]);
  }
  return metrics.emHeightAscent + metrics.emHeightDescent;
 },
 spellCheck: function(text) {
  text = UTF8ToString(text);
  return text in SPELLINGWORDS;
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

function _Engine_Image(name, x, y, width, height, rgba) {
 Engine.drawImage(name, x, y, width, height, rgba);
}

function _Engine_Init() {
 console.log("Engine_Init");
 Engine.init();
 return;
}

function _Engine_MeasureTextWidth(text, fontSize) {
 return Engine.measureTextWidth(text, fontSize);
}

function _Engine_Rectangle(x, y, width, height, thickness, stroke, fill) {
 Engine.rectangle(x, y, width, height, thickness, stroke, fill);
}

function _Engine_RoundedRectangle(x, y, width, height, radius, thickness, strokeRgba, fillRgba) {
 Engine.roundedRectangle(x, y, width, height, radius, thickness, strokeRgba, fillRgba);
}

function _Engine_SpellCheck(text) {
 return Engine.spellCheck(text);
}

function _Engine_StrokeEllipse(x, y, width, height, thickness, rgba) {
 Engine.strokeEllipse(x, y, width, height, thickness, rgba);
}

function _Engine_StrokeRectangle(x, y, width, height, thickness, rgba) {
 Engine.strokeRectangle(x, y, width, height, thickness, rgba);
}

function ___setErrNo(value) {
 if (Module["___errno_location"]) HEAP32[Module["___errno_location"]() >> 2] = value; else err("failed to set errno from JS");
 return value;
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

var TTY = {
 ttys: [],
 init: function() {},
 shutdown: function() {},
 register: function(dev, ops) {
  TTY.ttys[dev] = {
   input: [],
   output: [],
   ops: ops
  };
  FS.registerDevice(dev, TTY.stream_ops);
 },
 stream_ops: {
  open: function(stream) {
   var tty = TTY.ttys[stream.node.rdev];
   if (!tty) {
    throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
   }
   stream.tty = tty;
   stream.seekable = false;
  },
  close: function(stream) {
   stream.tty.ops.flush(stream.tty);
  },
  flush: function(stream) {
   stream.tty.ops.flush(stream.tty);
  },
  read: function(stream, buffer, offset, length, pos) {
   if (!stream.tty || !stream.tty.ops.get_char) {
    throw new FS.ErrnoError(ERRNO_CODES.ENXIO);
   }
   var bytesRead = 0;
   for (var i = 0; i < length; i++) {
    var result;
    try {
     result = stream.tty.ops.get_char(stream.tty);
    } catch (e) {
     throw new FS.ErrnoError(ERRNO_CODES.EIO);
    }
    if (result === undefined && bytesRead === 0) {
     throw new FS.ErrnoError(ERRNO_CODES.EAGAIN);
    }
    if (result === null || result === undefined) break;
    bytesRead++;
    buffer[offset + i] = result;
   }
   if (bytesRead) {
    stream.node.timestamp = Date.now();
   }
   return bytesRead;
  },
  write: function(stream, buffer, offset, length, pos) {
   if (!stream.tty || !stream.tty.ops.put_char) {
    throw new FS.ErrnoError(ERRNO_CODES.ENXIO);
   }
   try {
    for (var i = 0; i < length; i++) {
     stream.tty.ops.put_char(stream.tty, buffer[offset + i]);
    }
   } catch (e) {
    throw new FS.ErrnoError(ERRNO_CODES.EIO);
   }
   if (length) {
    stream.node.timestamp = Date.now();
   }
   return i;
  }
 },
 default_tty_ops: {
  get_char: function(tty) {
   if (!tty.input.length) {
    var result = null;
    if (ENVIRONMENT_IS_NODE) {
     var BUFSIZE = 256;
     var buf = new Buffer(BUFSIZE);
     var bytesRead = 0;
     var isPosixPlatform = process.platform != "win32";
     var fd = process.stdin.fd;
     if (isPosixPlatform) {
      var usingDevice = false;
      try {
       fd = fs.openSync("/dev/stdin", "r");
       usingDevice = true;
      } catch (e) {}
     }
     try {
      bytesRead = fs.readSync(fd, buf, 0, BUFSIZE, null);
     } catch (e) {
      if (e.toString().indexOf("EOF") != -1) bytesRead = 0; else throw e;
     }
     if (usingDevice) {
      fs.closeSync(fd);
     }
     if (bytesRead > 0) {
      result = buf.slice(0, bytesRead).toString("utf-8");
     } else {
      result = null;
     }
    } else if (typeof window != "undefined" && typeof window.prompt == "function") {
     result = window.prompt("Input: ");
     if (result !== null) {
      result += "\n";
     }
    } else if (typeof readline == "function") {
     result = readline();
     if (result !== null) {
      result += "\n";
     }
    }
    if (!result) {
     return null;
    }
    tty.input = intArrayFromString(result, true);
   }
   return tty.input.shift();
  },
  put_char: function(tty, val) {
   if (val === null || val === 10) {
    out(UTF8ArrayToString(tty.output, 0));
    tty.output = [];
   } else {
    if (val != 0) tty.output.push(val);
   }
  },
  flush: function(tty) {
   if (tty.output && tty.output.length > 0) {
    out(UTF8ArrayToString(tty.output, 0));
    tty.output = [];
   }
  }
 },
 default_tty1_ops: {
  put_char: function(tty, val) {
   if (val === null || val === 10) {
    err(UTF8ArrayToString(tty.output, 0));
    tty.output = [];
   } else {
    if (val != 0) tty.output.push(val);
   }
  },
  flush: function(tty) {
   if (tty.output && tty.output.length > 0) {
    err(UTF8ArrayToString(tty.output, 0));
    tty.output = [];
   }
  }
 }
};

var MEMFS = {
 ops_table: null,
 mount: function(mount) {
  return MEMFS.createNode(null, "/", 16384 | 511, 0);
 },
 createNode: function(parent, name, mode, dev) {
  if (FS.isBlkdev(mode) || FS.isFIFO(mode)) {
   throw new FS.ErrnoError(ERRNO_CODES.EPERM);
  }
  if (!MEMFS.ops_table) {
   MEMFS.ops_table = {
    dir: {
     node: {
      getattr: MEMFS.node_ops.getattr,
      setattr: MEMFS.node_ops.setattr,
      lookup: MEMFS.node_ops.lookup,
      mknod: MEMFS.node_ops.mknod,
      rename: MEMFS.node_ops.rename,
      unlink: MEMFS.node_ops.unlink,
      rmdir: MEMFS.node_ops.rmdir,
      readdir: MEMFS.node_ops.readdir,
      symlink: MEMFS.node_ops.symlink
     },
     stream: {
      llseek: MEMFS.stream_ops.llseek
     }
    },
    file: {
     node: {
      getattr: MEMFS.node_ops.getattr,
      setattr: MEMFS.node_ops.setattr
     },
     stream: {
      llseek: MEMFS.stream_ops.llseek,
      read: MEMFS.stream_ops.read,
      write: MEMFS.stream_ops.write,
      allocate: MEMFS.stream_ops.allocate,
      mmap: MEMFS.stream_ops.mmap,
      msync: MEMFS.stream_ops.msync
     }
    },
    link: {
     node: {
      getattr: MEMFS.node_ops.getattr,
      setattr: MEMFS.node_ops.setattr,
      readlink: MEMFS.node_ops.readlink
     },
     stream: {}
    },
    chrdev: {
     node: {
      getattr: MEMFS.node_ops.getattr,
      setattr: MEMFS.node_ops.setattr
     },
     stream: FS.chrdev_stream_ops
    }
   };
  }
  var node = FS.createNode(parent, name, mode, dev);
  if (FS.isDir(node.mode)) {
   node.node_ops = MEMFS.ops_table.dir.node;
   node.stream_ops = MEMFS.ops_table.dir.stream;
   node.contents = {};
  } else if (FS.isFile(node.mode)) {
   node.node_ops = MEMFS.ops_table.file.node;
   node.stream_ops = MEMFS.ops_table.file.stream;
   node.usedBytes = 0;
   node.contents = null;
  } else if (FS.isLink(node.mode)) {
   node.node_ops = MEMFS.ops_table.link.node;
   node.stream_ops = MEMFS.ops_table.link.stream;
  } else if (FS.isChrdev(node.mode)) {
   node.node_ops = MEMFS.ops_table.chrdev.node;
   node.stream_ops = MEMFS.ops_table.chrdev.stream;
  }
  node.timestamp = Date.now();
  if (parent) {
   parent.contents[name] = node;
  }
  return node;
 },
 getFileDataAsRegularArray: function(node) {
  if (node.contents && node.contents.subarray) {
   var arr = [];
   for (var i = 0; i < node.usedBytes; ++i) arr.push(node.contents[i]);
   return arr;
  }
  return node.contents;
 },
 getFileDataAsTypedArray: function(node) {
  if (!node.contents) return new Uint8Array();
  if (node.contents.subarray) return node.contents.subarray(0, node.usedBytes);
  return new Uint8Array(node.contents);
 },
 expandFileStorage: function(node, newCapacity) {
  var prevCapacity = node.contents ? node.contents.length : 0;
  if (prevCapacity >= newCapacity) return;
  var CAPACITY_DOUBLING_MAX = 1024 * 1024;
  newCapacity = Math.max(newCapacity, prevCapacity * (prevCapacity < CAPACITY_DOUBLING_MAX ? 2 : 1.125) | 0);
  if (prevCapacity != 0) newCapacity = Math.max(newCapacity, 256);
  var oldContents = node.contents;
  node.contents = new Uint8Array(newCapacity);
  if (node.usedBytes > 0) node.contents.set(oldContents.subarray(0, node.usedBytes), 0);
  return;
 },
 resizeFileStorage: function(node, newSize) {
  if (node.usedBytes == newSize) return;
  if (newSize == 0) {
   node.contents = null;
   node.usedBytes = 0;
   return;
  }
  if (!node.contents || node.contents.subarray) {
   var oldContents = node.contents;
   node.contents = new Uint8Array(new ArrayBuffer(newSize));
   if (oldContents) {
    node.contents.set(oldContents.subarray(0, Math.min(newSize, node.usedBytes)));
   }
   node.usedBytes = newSize;
   return;
  }
  if (!node.contents) node.contents = [];
  if (node.contents.length > newSize) node.contents.length = newSize; else while (node.contents.length < newSize) node.contents.push(0);
  node.usedBytes = newSize;
 },
 node_ops: {
  getattr: function(node) {
   var attr = {};
   attr.dev = FS.isChrdev(node.mode) ? node.id : 1;
   attr.ino = node.id;
   attr.mode = node.mode;
   attr.nlink = 1;
   attr.uid = 0;
   attr.gid = 0;
   attr.rdev = node.rdev;
   if (FS.isDir(node.mode)) {
    attr.size = 4096;
   } else if (FS.isFile(node.mode)) {
    attr.size = node.usedBytes;
   } else if (FS.isLink(node.mode)) {
    attr.size = node.link.length;
   } else {
    attr.size = 0;
   }
   attr.atime = new Date(node.timestamp);
   attr.mtime = new Date(node.timestamp);
   attr.ctime = new Date(node.timestamp);
   attr.blksize = 4096;
   attr.blocks = Math.ceil(attr.size / attr.blksize);
   return attr;
  },
  setattr: function(node, attr) {
   if (attr.mode !== undefined) {
    node.mode = attr.mode;
   }
   if (attr.timestamp !== undefined) {
    node.timestamp = attr.timestamp;
   }
   if (attr.size !== undefined) {
    MEMFS.resizeFileStorage(node, attr.size);
   }
  },
  lookup: function(parent, name) {
   throw FS.genericErrors[ERRNO_CODES.ENOENT];
  },
  mknod: function(parent, name, mode, dev) {
   return MEMFS.createNode(parent, name, mode, dev);
  },
  rename: function(old_node, new_dir, new_name) {
   if (FS.isDir(old_node.mode)) {
    var new_node;
    try {
     new_node = FS.lookupNode(new_dir, new_name);
    } catch (e) {}
    if (new_node) {
     for (var i in new_node.contents) {
      throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY);
     }
    }
   }
   delete old_node.parent.contents[old_node.name];
   old_node.name = new_name;
   new_dir.contents[new_name] = old_node;
   old_node.parent = new_dir;
  },
  unlink: function(parent, name) {
   delete parent.contents[name];
  },
  rmdir: function(parent, name) {
   var node = FS.lookupNode(parent, name);
   for (var i in node.contents) {
    throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY);
   }
   delete parent.contents[name];
  },
  readdir: function(node) {
   var entries = [ ".", ".." ];
   for (var key in node.contents) {
    if (!node.contents.hasOwnProperty(key)) {
     continue;
    }
    entries.push(key);
   }
   return entries;
  },
  symlink: function(parent, newname, oldpath) {
   var node = MEMFS.createNode(parent, newname, 511 | 40960, 0);
   node.link = oldpath;
   return node;
  },
  readlink: function(node) {
   if (!FS.isLink(node.mode)) {
    throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
   }
   return node.link;
  }
 },
 stream_ops: {
  read: function(stream, buffer, offset, length, position) {
   var contents = stream.node.contents;
   if (position >= stream.node.usedBytes) return 0;
   var size = Math.min(stream.node.usedBytes - position, length);
   assert(size >= 0);
   if (size > 8 && contents.subarray) {
    buffer.set(contents.subarray(position, position + size), offset);
   } else {
    for (var i = 0; i < size; i++) buffer[offset + i] = contents[position + i];
   }
   return size;
  },
  write: function(stream, buffer, offset, length, position, canOwn) {
   if (!length) return 0;
   var node = stream.node;
   node.timestamp = Date.now();
   if (buffer.subarray && (!node.contents || node.contents.subarray)) {
    if (canOwn) {
     assert(position === 0, "canOwn must imply no weird position inside the file");
     node.contents = buffer.subarray(offset, offset + length);
     node.usedBytes = length;
     return length;
    } else if (node.usedBytes === 0 && position === 0) {
     node.contents = new Uint8Array(buffer.subarray(offset, offset + length));
     node.usedBytes = length;
     return length;
    } else if (position + length <= node.usedBytes) {
     node.contents.set(buffer.subarray(offset, offset + length), position);
     return length;
    }
   }
   MEMFS.expandFileStorage(node, position + length);
   if (node.contents.subarray && buffer.subarray) node.contents.set(buffer.subarray(offset, offset + length), position); else {
    for (var i = 0; i < length; i++) {
     node.contents[position + i] = buffer[offset + i];
    }
   }
   node.usedBytes = Math.max(node.usedBytes, position + length);
   return length;
  },
  llseek: function(stream, offset, whence) {
   var position = offset;
   if (whence === 1) {
    position += stream.position;
   } else if (whence === 2) {
    if (FS.isFile(stream.node.mode)) {
     position += stream.node.usedBytes;
    }
   }
   if (position < 0) {
    throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
   }
   return position;
  },
  allocate: function(stream, offset, length) {
   MEMFS.expandFileStorage(stream.node, offset + length);
   stream.node.usedBytes = Math.max(stream.node.usedBytes, offset + length);
  },
  mmap: function(stream, buffer, offset, length, position, prot, flags) {
   if (!FS.isFile(stream.node.mode)) {
    throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
   }
   var ptr;
   var allocated;
   var contents = stream.node.contents;
   if (!(flags & 2) && (contents.buffer === buffer || contents.buffer === buffer.buffer)) {
    allocated = false;
    ptr = contents.byteOffset;
   } else {
    if (position > 0 || position + length < stream.node.usedBytes) {
     if (contents.subarray) {
      contents = contents.subarray(position, position + length);
     } else {
      contents = Array.prototype.slice.call(contents, position, position + length);
     }
    }
    allocated = true;
    ptr = _malloc(length);
    if (!ptr) {
     throw new FS.ErrnoError(ERRNO_CODES.ENOMEM);
    }
    buffer.set(contents, ptr);
   }
   return {
    ptr: ptr,
    allocated: allocated
   };
  },
  msync: function(stream, buffer, offset, length, mmapFlags) {
   if (!FS.isFile(stream.node.mode)) {
    throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
   }
   if (mmapFlags & 2) {
    return 0;
   }
   var bytesWritten = MEMFS.stream_ops.write(stream, buffer, 0, length, offset, false);
   return 0;
  }
 }
};

var IDBFS = {
 dbs: {},
 indexedDB: function() {
  if (typeof indexedDB !== "undefined") return indexedDB;
  var ret = null;
  if (typeof window === "object") ret = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
  assert(ret, "IDBFS used, but indexedDB not supported");
  return ret;
 },
 DB_VERSION: 21,
 DB_STORE_NAME: "FILE_DATA",
 mount: function(mount) {
  return MEMFS.mount.apply(null, arguments);
 },
 syncfs: function(mount, populate, callback) {
  IDBFS.getLocalSet(mount, function(err, local) {
   if (err) return callback(err);
   IDBFS.getRemoteSet(mount, function(err, remote) {
    if (err) return callback(err);
    var src = populate ? remote : local;
    var dst = populate ? local : remote;
    IDBFS.reconcile(src, dst, callback);
   });
  });
 },
 getDB: function(name, callback) {
  var db = IDBFS.dbs[name];
  if (db) {
   return callback(null, db);
  }
  var req;
  try {
   req = IDBFS.indexedDB().open(name, IDBFS.DB_VERSION);
  } catch (e) {
   return callback(e);
  }
  if (!req) {
   return callback("Unable to connect to IndexedDB");
  }
  req.onupgradeneeded = function(e) {
   var db = e.target.result;
   var transaction = e.target.transaction;
   var fileStore;
   if (db.objectStoreNames.contains(IDBFS.DB_STORE_NAME)) {
    fileStore = transaction.objectStore(IDBFS.DB_STORE_NAME);
   } else {
    fileStore = db.createObjectStore(IDBFS.DB_STORE_NAME);
   }
   if (!fileStore.indexNames.contains("timestamp")) {
    fileStore.createIndex("timestamp", "timestamp", {
     unique: false
    });
   }
  };
  req.onsuccess = function() {
   db = req.result;
   IDBFS.dbs[name] = db;
   callback(null, db);
  };
  req.onerror = function(e) {
   callback(this.error);
   e.preventDefault();
  };
 },
 getLocalSet: function(mount, callback) {
  var entries = {};
  function isRealDir(p) {
   return p !== "." && p !== "..";
  }
  function toAbsolute(root) {
   return function(p) {
    return PATH.join2(root, p);
   };
  }
  var check = FS.readdir(mount.mountpoint).filter(isRealDir).map(toAbsolute(mount.mountpoint));
  while (check.length) {
   var path = check.pop();
   var stat;
   try {
    stat = FS.stat(path);
   } catch (e) {
    return callback(e);
   }
   if (FS.isDir(stat.mode)) {
    check.push.apply(check, FS.readdir(path).filter(isRealDir).map(toAbsolute(path)));
   }
   entries[path] = {
    timestamp: stat.mtime
   };
  }
  return callback(null, {
   type: "local",
   entries: entries
  });
 },
 getRemoteSet: function(mount, callback) {
  var entries = {};
  IDBFS.getDB(mount.mountpoint, function(err, db) {
   if (err) return callback(err);
   try {
    var transaction = db.transaction([ IDBFS.DB_STORE_NAME ], "readonly");
    transaction.onerror = function(e) {
     callback(this.error);
     e.preventDefault();
    };
    var store = transaction.objectStore(IDBFS.DB_STORE_NAME);
    var index = store.index("timestamp");
    index.openKeyCursor().onsuccess = function(event) {
     var cursor = event.target.result;
     if (!cursor) {
      return callback(null, {
       type: "remote",
       db: db,
       entries: entries
      });
     }
     entries[cursor.primaryKey] = {
      timestamp: cursor.key
     };
     cursor.continue();
    };
   } catch (e) {
    return callback(e);
   }
  });
 },
 loadLocalEntry: function(path, callback) {
  var stat, node;
  try {
   var lookup = FS.lookupPath(path);
   node = lookup.node;
   stat = FS.stat(path);
  } catch (e) {
   return callback(e);
  }
  if (FS.isDir(stat.mode)) {
   return callback(null, {
    timestamp: stat.mtime,
    mode: stat.mode
   });
  } else if (FS.isFile(stat.mode)) {
   node.contents = MEMFS.getFileDataAsTypedArray(node);
   return callback(null, {
    timestamp: stat.mtime,
    mode: stat.mode,
    contents: node.contents
   });
  } else {
   return callback(new Error("node type not supported"));
  }
 },
 storeLocalEntry: function(path, entry, callback) {
  try {
   if (FS.isDir(entry.mode)) {
    FS.mkdir(path, entry.mode);
   } else if (FS.isFile(entry.mode)) {
    FS.writeFile(path, entry.contents, {
     canOwn: true
    });
   } else {
    return callback(new Error("node type not supported"));
   }
   FS.chmod(path, entry.mode);
   FS.utime(path, entry.timestamp, entry.timestamp);
  } catch (e) {
   return callback(e);
  }
  callback(null);
 },
 removeLocalEntry: function(path, callback) {
  try {
   var lookup = FS.lookupPath(path);
   var stat = FS.stat(path);
   if (FS.isDir(stat.mode)) {
    FS.rmdir(path);
   } else if (FS.isFile(stat.mode)) {
    FS.unlink(path);
   }
  } catch (e) {
   return callback(e);
  }
  callback(null);
 },
 loadRemoteEntry: function(store, path, callback) {
  var req = store.get(path);
  req.onsuccess = function(event) {
   callback(null, event.target.result);
  };
  req.onerror = function(e) {
   callback(this.error);
   e.preventDefault();
  };
 },
 storeRemoteEntry: function(store, path, entry, callback) {
  var req = store.put(entry, path);
  req.onsuccess = function() {
   callback(null);
  };
  req.onerror = function(e) {
   callback(this.error);
   e.preventDefault();
  };
 },
 removeRemoteEntry: function(store, path, callback) {
  var req = store.delete(path);
  req.onsuccess = function() {
   callback(null);
  };
  req.onerror = function(e) {
   callback(this.error);
   e.preventDefault();
  };
 },
 reconcile: function(src, dst, callback) {
  var total = 0;
  var create = [];
  Object.keys(src.entries).forEach(function(key) {
   var e = src.entries[key];
   var e2 = dst.entries[key];
   if (!e2 || e.timestamp > e2.timestamp) {
    create.push(key);
    total++;
   }
  });
  var remove = [];
  Object.keys(dst.entries).forEach(function(key) {
   var e = dst.entries[key];
   var e2 = src.entries[key];
   if (!e2) {
    remove.push(key);
    total++;
   }
  });
  if (!total) {
   return callback(null);
  }
  var errored = false;
  var completed = 0;
  var db = src.type === "remote" ? src.db : dst.db;
  var transaction = db.transaction([ IDBFS.DB_STORE_NAME ], "readwrite");
  var store = transaction.objectStore(IDBFS.DB_STORE_NAME);
  function done(err) {
   if (err) {
    if (!done.errored) {
     done.errored = true;
     return callback(err);
    }
    return;
   }
   if (++completed >= total) {
    return callback(null);
   }
  }
  transaction.onerror = function(e) {
   done(this.error);
   e.preventDefault();
  };
  create.sort().forEach(function(path) {
   if (dst.type === "local") {
    IDBFS.loadRemoteEntry(store, path, function(err, entry) {
     if (err) return done(err);
     IDBFS.storeLocalEntry(path, entry, done);
    });
   } else {
    IDBFS.loadLocalEntry(path, function(err, entry) {
     if (err) return done(err);
     IDBFS.storeRemoteEntry(store, path, entry, done);
    });
   }
  });
  remove.sort().reverse().forEach(function(path) {
   if (dst.type === "local") {
    IDBFS.removeLocalEntry(path, done);
   } else {
    IDBFS.removeRemoteEntry(store, path, done);
   }
  });
 }
};

var NODEFS = {
 isWindows: false,
 staticInit: function() {
  NODEFS.isWindows = !!process.platform.match(/^win/);
  var flags = process["binding"]("constants");
  if (flags["fs"]) {
   flags = flags["fs"];
  }
  NODEFS.flagsForNodeMap = {
   1024: flags["O_APPEND"],
   64: flags["O_CREAT"],
   128: flags["O_EXCL"],
   0: flags["O_RDONLY"],
   2: flags["O_RDWR"],
   4096: flags["O_SYNC"],
   512: flags["O_TRUNC"],
   1: flags["O_WRONLY"]
  };
 },
 bufferFrom: function(arrayBuffer) {
  return Buffer.alloc ? Buffer.from(arrayBuffer) : new Buffer(arrayBuffer);
 },
 mount: function(mount) {
  assert(ENVIRONMENT_IS_NODE);
  return NODEFS.createNode(null, "/", NODEFS.getMode(mount.opts.root), 0);
 },
 createNode: function(parent, name, mode, dev) {
  if (!FS.isDir(mode) && !FS.isFile(mode) && !FS.isLink(mode)) {
   throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
  }
  var node = FS.createNode(parent, name, mode);
  node.node_ops = NODEFS.node_ops;
  node.stream_ops = NODEFS.stream_ops;
  return node;
 },
 getMode: function(path) {
  var stat;
  try {
   stat = fs.lstatSync(path);
   if (NODEFS.isWindows) {
    stat.mode = stat.mode | (stat.mode & 292) >> 2;
   }
  } catch (e) {
   if (!e.code) throw e;
   throw new FS.ErrnoError(ERRNO_CODES[e.code]);
  }
  return stat.mode;
 },
 realPath: function(node) {
  var parts = [];
  while (node.parent !== node) {
   parts.push(node.name);
   node = node.parent;
  }
  parts.push(node.mount.opts.root);
  parts.reverse();
  return PATH.join.apply(null, parts);
 },
 flagsForNode: function(flags) {
  flags &= ~2097152;
  flags &= ~2048;
  flags &= ~32768;
  flags &= ~524288;
  var newFlags = 0;
  for (var k in NODEFS.flagsForNodeMap) {
   if (flags & k) {
    newFlags |= NODEFS.flagsForNodeMap[k];
    flags ^= k;
   }
  }
  if (!flags) {
   return newFlags;
  } else {
   throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
  }
 },
 node_ops: {
  getattr: function(node) {
   var path = NODEFS.realPath(node);
   var stat;
   try {
    stat = fs.lstatSync(path);
   } catch (e) {
    if (!e.code) throw e;
    throw new FS.ErrnoError(ERRNO_CODES[e.code]);
   }
   if (NODEFS.isWindows && !stat.blksize) {
    stat.blksize = 4096;
   }
   if (NODEFS.isWindows && !stat.blocks) {
    stat.blocks = (stat.size + stat.blksize - 1) / stat.blksize | 0;
   }
   return {
    dev: stat.dev,
    ino: stat.ino,
    mode: stat.mode,
    nlink: stat.nlink,
    uid: stat.uid,
    gid: stat.gid,
    rdev: stat.rdev,
    size: stat.size,
    atime: stat.atime,
    mtime: stat.mtime,
    ctime: stat.ctime,
    blksize: stat.blksize,
    blocks: stat.blocks
   };
  },
  setattr: function(node, attr) {
   var path = NODEFS.realPath(node);
   try {
    if (attr.mode !== undefined) {
     fs.chmodSync(path, attr.mode);
     node.mode = attr.mode;
    }
    if (attr.timestamp !== undefined) {
     var date = new Date(attr.timestamp);
     fs.utimesSync(path, date, date);
    }
    if (attr.size !== undefined) {
     fs.truncateSync(path, attr.size);
    }
   } catch (e) {
    if (!e.code) throw e;
    throw new FS.ErrnoError(ERRNO_CODES[e.code]);
   }
  },
  lookup: function(parent, name) {
   var path = PATH.join2(NODEFS.realPath(parent), name);
   var mode = NODEFS.getMode(path);
   return NODEFS.createNode(parent, name, mode);
  },
  mknod: function(parent, name, mode, dev) {
   var node = NODEFS.createNode(parent, name, mode, dev);
   var path = NODEFS.realPath(node);
   try {
    if (FS.isDir(node.mode)) {
     fs.mkdirSync(path, node.mode);
    } else {
     fs.writeFileSync(path, "", {
      mode: node.mode
     });
    }
   } catch (e) {
    if (!e.code) throw e;
    throw new FS.ErrnoError(ERRNO_CODES[e.code]);
   }
   return node;
  },
  rename: function(oldNode, newDir, newName) {
   var oldPath = NODEFS.realPath(oldNode);
   var newPath = PATH.join2(NODEFS.realPath(newDir), newName);
   try {
    fs.renameSync(oldPath, newPath);
   } catch (e) {
    if (!e.code) throw e;
    throw new FS.ErrnoError(ERRNO_CODES[e.code]);
   }
  },
  unlink: function(parent, name) {
   var path = PATH.join2(NODEFS.realPath(parent), name);
   try {
    fs.unlinkSync(path);
   } catch (e) {
    if (!e.code) throw e;
    throw new FS.ErrnoError(ERRNO_CODES[e.code]);
   }
  },
  rmdir: function(parent, name) {
   var path = PATH.join2(NODEFS.realPath(parent), name);
   try {
    fs.rmdirSync(path);
   } catch (e) {
    if (!e.code) throw e;
    throw new FS.ErrnoError(ERRNO_CODES[e.code]);
   }
  },
  readdir: function(node) {
   var path = NODEFS.realPath(node);
   try {
    return fs.readdirSync(path);
   } catch (e) {
    if (!e.code) throw e;
    throw new FS.ErrnoError(ERRNO_CODES[e.code]);
   }
  },
  symlink: function(parent, newName, oldPath) {
   var newPath = PATH.join2(NODEFS.realPath(parent), newName);
   try {
    fs.symlinkSync(oldPath, newPath);
   } catch (e) {
    if (!e.code) throw e;
    throw new FS.ErrnoError(ERRNO_CODES[e.code]);
   }
  },
  readlink: function(node) {
   var path = NODEFS.realPath(node);
   try {
    path = fs.readlinkSync(path);
    path = NODEJS_PATH.relative(NODEJS_PATH.resolve(node.mount.opts.root), path);
    return path;
   } catch (e) {
    if (!e.code) throw e;
    throw new FS.ErrnoError(ERRNO_CODES[e.code]);
   }
  }
 },
 stream_ops: {
  open: function(stream) {
   var path = NODEFS.realPath(stream.node);
   try {
    if (FS.isFile(stream.node.mode)) {
     stream.nfd = fs.openSync(path, NODEFS.flagsForNode(stream.flags));
    }
   } catch (e) {
    if (!e.code) throw e;
    throw new FS.ErrnoError(ERRNO_CODES[e.code]);
   }
  },
  close: function(stream) {
   try {
    if (FS.isFile(stream.node.mode) && stream.nfd) {
     fs.closeSync(stream.nfd);
    }
   } catch (e) {
    if (!e.code) throw e;
    throw new FS.ErrnoError(ERRNO_CODES[e.code]);
   }
  },
  read: function(stream, buffer, offset, length, position) {
   if (length === 0) return 0;
   try {
    return fs.readSync(stream.nfd, NODEFS.bufferFrom(buffer.buffer), offset, length, position);
   } catch (e) {
    throw new FS.ErrnoError(ERRNO_CODES[e.code]);
   }
  },
  write: function(stream, buffer, offset, length, position) {
   try {
    return fs.writeSync(stream.nfd, NODEFS.bufferFrom(buffer.buffer), offset, length, position);
   } catch (e) {
    throw new FS.ErrnoError(ERRNO_CODES[e.code]);
   }
  },
  llseek: function(stream, offset, whence) {
   var position = offset;
   if (whence === 1) {
    position += stream.position;
   } else if (whence === 2) {
    if (FS.isFile(stream.node.mode)) {
     try {
      var stat = fs.fstatSync(stream.nfd);
      position += stat.size;
     } catch (e) {
      throw new FS.ErrnoError(ERRNO_CODES[e.code]);
     }
    }
   }
   if (position < 0) {
    throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
   }
   return position;
  }
 }
};

var WORKERFS = {
 DIR_MODE: 16895,
 FILE_MODE: 33279,
 reader: null,
 mount: function(mount) {
  assert(ENVIRONMENT_IS_WORKER);
  if (!WORKERFS.reader) WORKERFS.reader = new FileReaderSync();
  var root = WORKERFS.createNode(null, "/", WORKERFS.DIR_MODE, 0);
  var createdParents = {};
  function ensureParent(path) {
   var parts = path.split("/");
   var parent = root;
   for (var i = 0; i < parts.length - 1; i++) {
    var curr = parts.slice(0, i + 1).join("/");
    if (!createdParents[curr]) {
     createdParents[curr] = WORKERFS.createNode(parent, parts[i], WORKERFS.DIR_MODE, 0);
    }
    parent = createdParents[curr];
   }
   return parent;
  }
  function base(path) {
   var parts = path.split("/");
   return parts[parts.length - 1];
  }
  Array.prototype.forEach.call(mount.opts["files"] || [], function(file) {
   WORKERFS.createNode(ensureParent(file.name), base(file.name), WORKERFS.FILE_MODE, 0, file, file.lastModifiedDate);
  });
  (mount.opts["blobs"] || []).forEach(function(obj) {
   WORKERFS.createNode(ensureParent(obj["name"]), base(obj["name"]), WORKERFS.FILE_MODE, 0, obj["data"]);
  });
  (mount.opts["packages"] || []).forEach(function(pack) {
   pack["metadata"].files.forEach(function(file) {
    var name = file.filename.substr(1);
    WORKERFS.createNode(ensureParent(name), base(name), WORKERFS.FILE_MODE, 0, pack["blob"].slice(file.start, file.end));
   });
  });
  return root;
 },
 createNode: function(parent, name, mode, dev, contents, mtime) {
  var node = FS.createNode(parent, name, mode);
  node.mode = mode;
  node.node_ops = WORKERFS.node_ops;
  node.stream_ops = WORKERFS.stream_ops;
  node.timestamp = (mtime || new Date()).getTime();
  assert(WORKERFS.FILE_MODE !== WORKERFS.DIR_MODE);
  if (mode === WORKERFS.FILE_MODE) {
   node.size = contents.size;
   node.contents = contents;
  } else {
   node.size = 4096;
   node.contents = {};
  }
  if (parent) {
   parent.contents[name] = node;
  }
  return node;
 },
 node_ops: {
  getattr: function(node) {
   return {
    dev: 1,
    ino: undefined,
    mode: node.mode,
    nlink: 1,
    uid: 0,
    gid: 0,
    rdev: undefined,
    size: node.size,
    atime: new Date(node.timestamp),
    mtime: new Date(node.timestamp),
    ctime: new Date(node.timestamp),
    blksize: 4096,
    blocks: Math.ceil(node.size / 4096)
   };
  },
  setattr: function(node, attr) {
   if (attr.mode !== undefined) {
    node.mode = attr.mode;
   }
   if (attr.timestamp !== undefined) {
    node.timestamp = attr.timestamp;
   }
  },
  lookup: function(parent, name) {
   throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
  },
  mknod: function(parent, name, mode, dev) {
   throw new FS.ErrnoError(ERRNO_CODES.EPERM);
  },
  rename: function(oldNode, newDir, newName) {
   throw new FS.ErrnoError(ERRNO_CODES.EPERM);
  },
  unlink: function(parent, name) {
   throw new FS.ErrnoError(ERRNO_CODES.EPERM);
  },
  rmdir: function(parent, name) {
   throw new FS.ErrnoError(ERRNO_CODES.EPERM);
  },
  readdir: function(node) {
   var entries = [ ".", ".." ];
   for (var key in node.contents) {
    if (!node.contents.hasOwnProperty(key)) {
     continue;
    }
    entries.push(key);
   }
   return entries;
  },
  symlink: function(parent, newName, oldPath) {
   throw new FS.ErrnoError(ERRNO_CODES.EPERM);
  },
  readlink: function(node) {
   throw new FS.ErrnoError(ERRNO_CODES.EPERM);
  }
 },
 stream_ops: {
  read: function(stream, buffer, offset, length, position) {
   if (position >= stream.node.size) return 0;
   var chunk = stream.node.contents.slice(position, position + length);
   var ab = WORKERFS.reader.readAsArrayBuffer(chunk);
   buffer.set(new Uint8Array(ab), offset);
   return chunk.size;
  },
  write: function(stream, buffer, offset, length, position) {
   throw new FS.ErrnoError(ERRNO_CODES.EIO);
  },
  llseek: function(stream, offset, whence) {
   var position = offset;
   if (whence === 1) {
    position += stream.position;
   } else if (whence === 2) {
    if (FS.isFile(stream.node.mode)) {
     position += stream.node.size;
    }
   }
   if (position < 0) {
    throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
   }
   return position;
  }
 }
};

var ERRNO_MESSAGES = {
 0: "Success",
 1: "Not super-user",
 2: "No such file or directory",
 3: "No such process",
 4: "Interrupted system call",
 5: "I/O error",
 6: "No such device or address",
 7: "Arg list too long",
 8: "Exec format error",
 9: "Bad file number",
 10: "No children",
 11: "No more processes",
 12: "Not enough core",
 13: "Permission denied",
 14: "Bad address",
 15: "Block device required",
 16: "Mount device busy",
 17: "File exists",
 18: "Cross-device link",
 19: "No such device",
 20: "Not a directory",
 21: "Is a directory",
 22: "Invalid argument",
 23: "Too many open files in system",
 24: "Too many open files",
 25: "Not a typewriter",
 26: "Text file busy",
 27: "File too large",
 28: "No space left on device",
 29: "Illegal seek",
 30: "Read only file system",
 31: "Too many links",
 32: "Broken pipe",
 33: "Math arg out of domain of func",
 34: "Math result not representable",
 35: "File locking deadlock error",
 36: "File or path name too long",
 37: "No record locks available",
 38: "Function not implemented",
 39: "Directory not empty",
 40: "Too many symbolic links",
 42: "No message of desired type",
 43: "Identifier removed",
 44: "Channel number out of range",
 45: "Level 2 not synchronized",
 46: "Level 3 halted",
 47: "Level 3 reset",
 48: "Link number out of range",
 49: "Protocol driver not attached",
 50: "No CSI structure available",
 51: "Level 2 halted",
 52: "Invalid exchange",
 53: "Invalid request descriptor",
 54: "Exchange full",
 55: "No anode",
 56: "Invalid request code",
 57: "Invalid slot",
 59: "Bad font file fmt",
 60: "Device not a stream",
 61: "No data (for no delay io)",
 62: "Timer expired",
 63: "Out of streams resources",
 64: "Machine is not on the network",
 65: "Package not installed",
 66: "The object is remote",
 67: "The link has been severed",
 68: "Advertise error",
 69: "Srmount error",
 70: "Communication error on send",
 71: "Protocol error",
 72: "Multihop attempted",
 73: "Cross mount point (not really error)",
 74: "Trying to read unreadable message",
 75: "Value too large for defined data type",
 76: "Given log. name not unique",
 77: "f.d. invalid for this operation",
 78: "Remote address changed",
 79: "Can   access a needed shared lib",
 80: "Accessing a corrupted shared lib",
 81: ".lib section in a.out corrupted",
 82: "Attempting to link in too many libs",
 83: "Attempting to exec a shared library",
 84: "Illegal byte sequence",
 86: "Streams pipe error",
 87: "Too many users",
 88: "Socket operation on non-socket",
 89: "Destination address required",
 90: "Message too long",
 91: "Protocol wrong type for socket",
 92: "Protocol not available",
 93: "Unknown protocol",
 94: "Socket type not supported",
 95: "Not supported",
 96: "Protocol family not supported",
 97: "Address family not supported by protocol family",
 98: "Address already in use",
 99: "Address not available",
 100: "Network interface is not configured",
 101: "Network is unreachable",
 102: "Connection reset by network",
 103: "Connection aborted",
 104: "Connection reset by peer",
 105: "No buffer space available",
 106: "Socket is already connected",
 107: "Socket is not connected",
 108: "Can't send after socket shutdown",
 109: "Too many references",
 110: "Connection timed out",
 111: "Connection refused",
 112: "Host is down",
 113: "Host is unreachable",
 114: "Socket already connected",
 115: "Connection already in progress",
 116: "Stale file handle",
 122: "Quota exceeded",
 123: "No medium (in tape drive)",
 125: "Operation canceled",
 130: "Previous owner died",
 131: "State not recoverable"
};

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

var FS = {
 root: null,
 mounts: [],
 devices: {},
 streams: [],
 nextInode: 1,
 nameTable: null,
 currentPath: "/",
 initialized: false,
 ignorePermissions: true,
 trackingDelegate: {},
 tracking: {
  openFlags: {
   READ: 1,
   WRITE: 2
  }
 },
 ErrnoError: null,
 genericErrors: {},
 filesystems: null,
 syncFSRequests: 0,
 handleFSError: function(e) {
  if (!(e instanceof FS.ErrnoError)) throw e + " : " + stackTrace();
  return ___setErrNo(e.errno);
 },
 lookupPath: function(path, opts) {
  path = PATH.resolve(FS.cwd(), path);
  opts = opts || {};
  if (!path) return {
   path: "",
   node: null
  };
  var defaults = {
   follow_mount: true,
   recurse_count: 0
  };
  for (var key in defaults) {
   if (opts[key] === undefined) {
    opts[key] = defaults[key];
   }
  }
  if (opts.recurse_count > 8) {
   throw new FS.ErrnoError(40);
  }
  var parts = PATH.normalizeArray(path.split("/").filter(function(p) {
   return !!p;
  }), false);
  var current = FS.root;
  var current_path = "/";
  for (var i = 0; i < parts.length; i++) {
   var islast = i === parts.length - 1;
   if (islast && opts.parent) {
    break;
   }
   current = FS.lookupNode(current, parts[i]);
   current_path = PATH.join2(current_path, parts[i]);
   if (FS.isMountpoint(current)) {
    if (!islast || islast && opts.follow_mount) {
     current = current.mounted.root;
    }
   }
   if (!islast || opts.follow) {
    var count = 0;
    while (FS.isLink(current.mode)) {
     var link = FS.readlink(current_path);
     current_path = PATH.resolve(PATH.dirname(current_path), link);
     var lookup = FS.lookupPath(current_path, {
      recurse_count: opts.recurse_count
     });
     current = lookup.node;
     if (count++ > 40) {
      throw new FS.ErrnoError(40);
     }
    }
   }
  }
  return {
   path: current_path,
   node: current
  };
 },
 getPath: function(node) {
  var path;
  while (true) {
   if (FS.isRoot(node)) {
    var mount = node.mount.mountpoint;
    if (!path) return mount;
    return mount[mount.length - 1] !== "/" ? mount + "/" + path : mount + path;
   }
   path = path ? node.name + "/" + path : node.name;
   node = node.parent;
  }
 },
 hashName: function(parentid, name) {
  var hash = 0;
  for (var i = 0; i < name.length; i++) {
   hash = (hash << 5) - hash + name.charCodeAt(i) | 0;
  }
  return (parentid + hash >>> 0) % FS.nameTable.length;
 },
 hashAddNode: function(node) {
  var hash = FS.hashName(node.parent.id, node.name);
  node.name_next = FS.nameTable[hash];
  FS.nameTable[hash] = node;
 },
 hashRemoveNode: function(node) {
  var hash = FS.hashName(node.parent.id, node.name);
  if (FS.nameTable[hash] === node) {
   FS.nameTable[hash] = node.name_next;
  } else {
   var current = FS.nameTable[hash];
   while (current) {
    if (current.name_next === node) {
     current.name_next = node.name_next;
     break;
    }
    current = current.name_next;
   }
  }
 },
 lookupNode: function(parent, name) {
  var err = FS.mayLookup(parent);
  if (err) {
   throw new FS.ErrnoError(err, parent);
  }
  var hash = FS.hashName(parent.id, name);
  for (var node = FS.nameTable[hash]; node; node = node.name_next) {
   var nodeName = node.name;
   if (node.parent.id === parent.id && nodeName === name) {
    return node;
   }
  }
  return FS.lookup(parent, name);
 },
 createNode: function(parent, name, mode, rdev) {
  if (!FS.FSNode) {
   FS.FSNode = function(parent, name, mode, rdev) {
    if (!parent) {
     parent = this;
    }
    this.parent = parent;
    this.mount = parent.mount;
    this.mounted = null;
    this.id = FS.nextInode++;
    this.name = name;
    this.mode = mode;
    this.node_ops = {};
    this.stream_ops = {};
    this.rdev = rdev;
   };
   FS.FSNode.prototype = {};
   var readMode = 292 | 73;
   var writeMode = 146;
   Object.defineProperties(FS.FSNode.prototype, {
    read: {
     get: function() {
      return (this.mode & readMode) === readMode;
     },
     set: function(val) {
      val ? this.mode |= readMode : this.mode &= ~readMode;
     }
    },
    write: {
     get: function() {
      return (this.mode & writeMode) === writeMode;
     },
     set: function(val) {
      val ? this.mode |= writeMode : this.mode &= ~writeMode;
     }
    },
    isFolder: {
     get: function() {
      return FS.isDir(this.mode);
     }
    },
    isDevice: {
     get: function() {
      return FS.isChrdev(this.mode);
     }
    }
   });
  }
  var node = new FS.FSNode(parent, name, mode, rdev);
  FS.hashAddNode(node);
  return node;
 },
 destroyNode: function(node) {
  FS.hashRemoveNode(node);
 },
 isRoot: function(node) {
  return node === node.parent;
 },
 isMountpoint: function(node) {
  return !!node.mounted;
 },
 isFile: function(mode) {
  return (mode & 61440) === 32768;
 },
 isDir: function(mode) {
  return (mode & 61440) === 16384;
 },
 isLink: function(mode) {
  return (mode & 61440) === 40960;
 },
 isChrdev: function(mode) {
  return (mode & 61440) === 8192;
 },
 isBlkdev: function(mode) {
  return (mode & 61440) === 24576;
 },
 isFIFO: function(mode) {
  return (mode & 61440) === 4096;
 },
 isSocket: function(mode) {
  return (mode & 49152) === 49152;
 },
 flagModes: {
  "r": 0,
  "rs": 1052672,
  "r+": 2,
  "w": 577,
  "wx": 705,
  "xw": 705,
  "w+": 578,
  "wx+": 706,
  "xw+": 706,
  "a": 1089,
  "ax": 1217,
  "xa": 1217,
  "a+": 1090,
  "ax+": 1218,
  "xa+": 1218
 },
 modeStringToFlags: function(str) {
  var flags = FS.flagModes[str];
  if (typeof flags === "undefined") {
   throw new Error("Unknown file open mode: " + str);
  }
  return flags;
 },
 flagsToPermissionString: function(flag) {
  var perms = [ "r", "w", "rw" ][flag & 3];
  if (flag & 512) {
   perms += "w";
  }
  return perms;
 },
 nodePermissions: function(node, perms) {
  if (FS.ignorePermissions) {
   return 0;
  }
  if (perms.indexOf("r") !== -1 && !(node.mode & 292)) {
   return 13;
  } else if (perms.indexOf("w") !== -1 && !(node.mode & 146)) {
   return 13;
  } else if (perms.indexOf("x") !== -1 && !(node.mode & 73)) {
   return 13;
  }
  return 0;
 },
 mayLookup: function(dir) {
  var err = FS.nodePermissions(dir, "x");
  if (err) return err;
  if (!dir.node_ops.lookup) return 13;
  return 0;
 },
 mayCreate: function(dir, name) {
  try {
   var node = FS.lookupNode(dir, name);
   return 17;
  } catch (e) {}
  return FS.nodePermissions(dir, "wx");
 },
 mayDelete: function(dir, name, isdir) {
  var node;
  try {
   node = FS.lookupNode(dir, name);
  } catch (e) {
   return e.errno;
  }
  var err = FS.nodePermissions(dir, "wx");
  if (err) {
   return err;
  }
  if (isdir) {
   if (!FS.isDir(node.mode)) {
    return 20;
   }
   if (FS.isRoot(node) || FS.getPath(node) === FS.cwd()) {
    return 16;
   }
  } else {
   if (FS.isDir(node.mode)) {
    return 21;
   }
  }
  return 0;
 },
 mayOpen: function(node, flags) {
  if (!node) {
   return 2;
  }
  if (FS.isLink(node.mode)) {
   return 40;
  } else if (FS.isDir(node.mode)) {
   if (FS.flagsToPermissionString(flags) !== "r" || flags & 512) {
    return 21;
   }
  }
  return FS.nodePermissions(node, FS.flagsToPermissionString(flags));
 },
 MAX_OPEN_FDS: 4096,
 nextfd: function(fd_start, fd_end) {
  fd_start = fd_start || 0;
  fd_end = fd_end || FS.MAX_OPEN_FDS;
  for (var fd = fd_start; fd <= fd_end; fd++) {
   if (!FS.streams[fd]) {
    return fd;
   }
  }
  throw new FS.ErrnoError(24);
 },
 getStream: function(fd) {
  return FS.streams[fd];
 },
 createStream: function(stream, fd_start, fd_end) {
  if (!FS.FSStream) {
   FS.FSStream = function() {};
   FS.FSStream.prototype = {};
   Object.defineProperties(FS.FSStream.prototype, {
    object: {
     get: function() {
      return this.node;
     },
     set: function(val) {
      this.node = val;
     }
    },
    isRead: {
     get: function() {
      return (this.flags & 2097155) !== 1;
     }
    },
    isWrite: {
     get: function() {
      return (this.flags & 2097155) !== 0;
     }
    },
    isAppend: {
     get: function() {
      return this.flags & 1024;
     }
    }
   });
  }
  var newStream = new FS.FSStream();
  for (var p in stream) {
   newStream[p] = stream[p];
  }
  stream = newStream;
  var fd = FS.nextfd(fd_start, fd_end);
  stream.fd = fd;
  FS.streams[fd] = stream;
  return stream;
 },
 closeStream: function(fd) {
  FS.streams[fd] = null;
 },
 chrdev_stream_ops: {
  open: function(stream) {
   var device = FS.getDevice(stream.node.rdev);
   stream.stream_ops = device.stream_ops;
   if (stream.stream_ops.open) {
    stream.stream_ops.open(stream);
   }
  },
  llseek: function() {
   throw new FS.ErrnoError(29);
  }
 },
 major: function(dev) {
  return dev >> 8;
 },
 minor: function(dev) {
  return dev & 255;
 },
 makedev: function(ma, mi) {
  return ma << 8 | mi;
 },
 registerDevice: function(dev, ops) {
  FS.devices[dev] = {
   stream_ops: ops
  };
 },
 getDevice: function(dev) {
  return FS.devices[dev];
 },
 getMounts: function(mount) {
  var mounts = [];
  var check = [ mount ];
  while (check.length) {
   var m = check.pop();
   mounts.push(m);
   check.push.apply(check, m.mounts);
  }
  return mounts;
 },
 syncfs: function(populate, callback) {
  if (typeof populate === "function") {
   callback = populate;
   populate = false;
  }
  FS.syncFSRequests++;
  if (FS.syncFSRequests > 1) {
   console.log("warning: " + FS.syncFSRequests + " FS.syncfs operations in flight at once, probably just doing extra work");
  }
  var mounts = FS.getMounts(FS.root.mount);
  var completed = 0;
  function doCallback(err) {
   assert(FS.syncFSRequests > 0);
   FS.syncFSRequests--;
   return callback(err);
  }
  function done(err) {
   if (err) {
    if (!done.errored) {
     done.errored = true;
     return doCallback(err);
    }
    return;
   }
   if (++completed >= mounts.length) {
    doCallback(null);
   }
  }
  mounts.forEach(function(mount) {
   if (!mount.type.syncfs) {
    return done(null);
   }
   mount.type.syncfs(mount, populate, done);
  });
 },
 mount: function(type, opts, mountpoint) {
  var root = mountpoint === "/";
  var pseudo = !mountpoint;
  var node;
  if (root && FS.root) {
   throw new FS.ErrnoError(16);
  } else if (!root && !pseudo) {
   var lookup = FS.lookupPath(mountpoint, {
    follow_mount: false
   });
   mountpoint = lookup.path;
   node = lookup.node;
   if (FS.isMountpoint(node)) {
    throw new FS.ErrnoError(16);
   }
   if (!FS.isDir(node.mode)) {
    throw new FS.ErrnoError(20);
   }
  }
  var mount = {
   type: type,
   opts: opts,
   mountpoint: mountpoint,
   mounts: []
  };
  var mountRoot = type.mount(mount);
  mountRoot.mount = mount;
  mount.root = mountRoot;
  if (root) {
   FS.root = mountRoot;
  } else if (node) {
   node.mounted = mount;
   if (node.mount) {
    node.mount.mounts.push(mount);
   }
  }
  return mountRoot;
 },
 unmount: function(mountpoint) {
  var lookup = FS.lookupPath(mountpoint, {
   follow_mount: false
  });
  if (!FS.isMountpoint(lookup.node)) {
   throw new FS.ErrnoError(22);
  }
  var node = lookup.node;
  var mount = node.mounted;
  var mounts = FS.getMounts(mount);
  Object.keys(FS.nameTable).forEach(function(hash) {
   var current = FS.nameTable[hash];
   while (current) {
    var next = current.name_next;
    if (mounts.indexOf(current.mount) !== -1) {
     FS.destroyNode(current);
    }
    current = next;
   }
  });
  node.mounted = null;
  var idx = node.mount.mounts.indexOf(mount);
  assert(idx !== -1);
  node.mount.mounts.splice(idx, 1);
 },
 lookup: function(parent, name) {
  return parent.node_ops.lookup(parent, name);
 },
 mknod: function(path, mode, dev) {
  var lookup = FS.lookupPath(path, {
   parent: true
  });
  var parent = lookup.node;
  var name = PATH.basename(path);
  if (!name || name === "." || name === "..") {
   throw new FS.ErrnoError(22);
  }
  var err = FS.mayCreate(parent, name);
  if (err) {
   throw new FS.ErrnoError(err);
  }
  if (!parent.node_ops.mknod) {
   throw new FS.ErrnoError(1);
  }
  return parent.node_ops.mknod(parent, name, mode, dev);
 },
 create: function(path, mode) {
  mode = mode !== undefined ? mode : 438;
  mode &= 4095;
  mode |= 32768;
  return FS.mknod(path, mode, 0);
 },
 mkdir: function(path, mode) {
  mode = mode !== undefined ? mode : 511;
  mode &= 511 | 512;
  mode |= 16384;
  return FS.mknod(path, mode, 0);
 },
 mkdirTree: function(path, mode) {
  var dirs = path.split("/");
  var d = "";
  for (var i = 0; i < dirs.length; ++i) {
   if (!dirs[i]) continue;
   d += "/" + dirs[i];
   try {
    FS.mkdir(d, mode);
   } catch (e) {
    if (e.errno != 17) throw e;
   }
  }
 },
 mkdev: function(path, mode, dev) {
  if (typeof dev === "undefined") {
   dev = mode;
   mode = 438;
  }
  mode |= 8192;
  return FS.mknod(path, mode, dev);
 },
 symlink: function(oldpath, newpath) {
  if (!PATH.resolve(oldpath)) {
   throw new FS.ErrnoError(2);
  }
  var lookup = FS.lookupPath(newpath, {
   parent: true
  });
  var parent = lookup.node;
  if (!parent) {
   throw new FS.ErrnoError(2);
  }
  var newname = PATH.basename(newpath);
  var err = FS.mayCreate(parent, newname);
  if (err) {
   throw new FS.ErrnoError(err);
  }
  if (!parent.node_ops.symlink) {
   throw new FS.ErrnoError(1);
  }
  return parent.node_ops.symlink(parent, newname, oldpath);
 },
 rename: function(old_path, new_path) {
  var old_dirname = PATH.dirname(old_path);
  var new_dirname = PATH.dirname(new_path);
  var old_name = PATH.basename(old_path);
  var new_name = PATH.basename(new_path);
  var lookup, old_dir, new_dir;
  try {
   lookup = FS.lookupPath(old_path, {
    parent: true
   });
   old_dir = lookup.node;
   lookup = FS.lookupPath(new_path, {
    parent: true
   });
   new_dir = lookup.node;
  } catch (e) {
   throw new FS.ErrnoError(16);
  }
  if (!old_dir || !new_dir) throw new FS.ErrnoError(2);
  if (old_dir.mount !== new_dir.mount) {
   throw new FS.ErrnoError(18);
  }
  var old_node = FS.lookupNode(old_dir, old_name);
  var relative = PATH.relative(old_path, new_dirname);
  if (relative.charAt(0) !== ".") {
   throw new FS.ErrnoError(22);
  }
  relative = PATH.relative(new_path, old_dirname);
  if (relative.charAt(0) !== ".") {
   throw new FS.ErrnoError(39);
  }
  var new_node;
  try {
   new_node = FS.lookupNode(new_dir, new_name);
  } catch (e) {}
  if (old_node === new_node) {
   return;
  }
  var isdir = FS.isDir(old_node.mode);
  var err = FS.mayDelete(old_dir, old_name, isdir);
  if (err) {
   throw new FS.ErrnoError(err);
  }
  err = new_node ? FS.mayDelete(new_dir, new_name, isdir) : FS.mayCreate(new_dir, new_name);
  if (err) {
   throw new FS.ErrnoError(err);
  }
  if (!old_dir.node_ops.rename) {
   throw new FS.ErrnoError(1);
  }
  if (FS.isMountpoint(old_node) || new_node && FS.isMountpoint(new_node)) {
   throw new FS.ErrnoError(16);
  }
  if (new_dir !== old_dir) {
   err = FS.nodePermissions(old_dir, "w");
   if (err) {
    throw new FS.ErrnoError(err);
   }
  }
  try {
   if (FS.trackingDelegate["willMovePath"]) {
    FS.trackingDelegate["willMovePath"](old_path, new_path);
   }
  } catch (e) {
   console.log("FS.trackingDelegate['willMovePath']('" + old_path + "', '" + new_path + "') threw an exception: " + e.message);
  }
  FS.hashRemoveNode(old_node);
  try {
   old_dir.node_ops.rename(old_node, new_dir, new_name);
  } catch (e) {
   throw e;
  } finally {
   FS.hashAddNode(old_node);
  }
  try {
   if (FS.trackingDelegate["onMovePath"]) FS.trackingDelegate["onMovePath"](old_path, new_path);
  } catch (e) {
   console.log("FS.trackingDelegate['onMovePath']('" + old_path + "', '" + new_path + "') threw an exception: " + e.message);
  }
 },
 rmdir: function(path) {
  var lookup = FS.lookupPath(path, {
   parent: true
  });
  var parent = lookup.node;
  var name = PATH.basename(path);
  var node = FS.lookupNode(parent, name);
  var err = FS.mayDelete(parent, name, true);
  if (err) {
   throw new FS.ErrnoError(err);
  }
  if (!parent.node_ops.rmdir) {
   throw new FS.ErrnoError(1);
  }
  if (FS.isMountpoint(node)) {
   throw new FS.ErrnoError(16);
  }
  try {
   if (FS.trackingDelegate["willDeletePath"]) {
    FS.trackingDelegate["willDeletePath"](path);
   }
  } catch (e) {
   console.log("FS.trackingDelegate['willDeletePath']('" + path + "') threw an exception: " + e.message);
  }
  parent.node_ops.rmdir(parent, name);
  FS.destroyNode(node);
  try {
   if (FS.trackingDelegate["onDeletePath"]) FS.trackingDelegate["onDeletePath"](path);
  } catch (e) {
   console.log("FS.trackingDelegate['onDeletePath']('" + path + "') threw an exception: " + e.message);
  }
 },
 readdir: function(path) {
  var lookup = FS.lookupPath(path, {
   follow: true
  });
  var node = lookup.node;
  if (!node.node_ops.readdir) {
   throw new FS.ErrnoError(20);
  }
  return node.node_ops.readdir(node);
 },
 unlink: function(path) {
  var lookup = FS.lookupPath(path, {
   parent: true
  });
  var parent = lookup.node;
  var name = PATH.basename(path);
  var node = FS.lookupNode(parent, name);
  var err = FS.mayDelete(parent, name, false);
  if (err) {
   throw new FS.ErrnoError(err);
  }
  if (!parent.node_ops.unlink) {
   throw new FS.ErrnoError(1);
  }
  if (FS.isMountpoint(node)) {
   throw new FS.ErrnoError(16);
  }
  try {
   if (FS.trackingDelegate["willDeletePath"]) {
    FS.trackingDelegate["willDeletePath"](path);
   }
  } catch (e) {
   console.log("FS.trackingDelegate['willDeletePath']('" + path + "') threw an exception: " + e.message);
  }
  parent.node_ops.unlink(parent, name);
  FS.destroyNode(node);
  try {
   if (FS.trackingDelegate["onDeletePath"]) FS.trackingDelegate["onDeletePath"](path);
  } catch (e) {
   console.log("FS.trackingDelegate['onDeletePath']('" + path + "') threw an exception: " + e.message);
  }
 },
 readlink: function(path) {
  var lookup = FS.lookupPath(path);
  var link = lookup.node;
  if (!link) {
   throw new FS.ErrnoError(2);
  }
  if (!link.node_ops.readlink) {
   throw new FS.ErrnoError(22);
  }
  return PATH.resolve(FS.getPath(link.parent), link.node_ops.readlink(link));
 },
 stat: function(path, dontFollow) {
  var lookup = FS.lookupPath(path, {
   follow: !dontFollow
  });
  var node = lookup.node;
  if (!node) {
   throw new FS.ErrnoError(2);
  }
  if (!node.node_ops.getattr) {
   throw new FS.ErrnoError(1);
  }
  return node.node_ops.getattr(node);
 },
 lstat: function(path) {
  return FS.stat(path, true);
 },
 chmod: function(path, mode, dontFollow) {
  var node;
  if (typeof path === "string") {
   var lookup = FS.lookupPath(path, {
    follow: !dontFollow
   });
   node = lookup.node;
  } else {
   node = path;
  }
  if (!node.node_ops.setattr) {
   throw new FS.ErrnoError(1);
  }
  node.node_ops.setattr(node, {
   mode: mode & 4095 | node.mode & ~4095,
   timestamp: Date.now()
  });
 },
 lchmod: function(path, mode) {
  FS.chmod(path, mode, true);
 },
 fchmod: function(fd, mode) {
  var stream = FS.getStream(fd);
  if (!stream) {
   throw new FS.ErrnoError(9);
  }
  FS.chmod(stream.node, mode);
 },
 chown: function(path, uid, gid, dontFollow) {
  var node;
  if (typeof path === "string") {
   var lookup = FS.lookupPath(path, {
    follow: !dontFollow
   });
   node = lookup.node;
  } else {
   node = path;
  }
  if (!node.node_ops.setattr) {
   throw new FS.ErrnoError(1);
  }
  node.node_ops.setattr(node, {
   timestamp: Date.now()
  });
 },
 lchown: function(path, uid, gid) {
  FS.chown(path, uid, gid, true);
 },
 fchown: function(fd, uid, gid) {
  var stream = FS.getStream(fd);
  if (!stream) {
   throw new FS.ErrnoError(9);
  }
  FS.chown(stream.node, uid, gid);
 },
 truncate: function(path, len) {
  if (len < 0) {
   throw new FS.ErrnoError(22);
  }
  var node;
  if (typeof path === "string") {
   var lookup = FS.lookupPath(path, {
    follow: true
   });
   node = lookup.node;
  } else {
   node = path;
  }
  if (!node.node_ops.setattr) {
   throw new FS.ErrnoError(1);
  }
  if (FS.isDir(node.mode)) {
   throw new FS.ErrnoError(21);
  }
  if (!FS.isFile(node.mode)) {
   throw new FS.ErrnoError(22);
  }
  var err = FS.nodePermissions(node, "w");
  if (err) {
   throw new FS.ErrnoError(err);
  }
  node.node_ops.setattr(node, {
   size: len,
   timestamp: Date.now()
  });
 },
 ftruncate: function(fd, len) {
  var stream = FS.getStream(fd);
  if (!stream) {
   throw new FS.ErrnoError(9);
  }
  if ((stream.flags & 2097155) === 0) {
   throw new FS.ErrnoError(22);
  }
  FS.truncate(stream.node, len);
 },
 utime: function(path, atime, mtime) {
  var lookup = FS.lookupPath(path, {
   follow: true
  });
  var node = lookup.node;
  node.node_ops.setattr(node, {
   timestamp: Math.max(atime, mtime)
  });
 },
 open: function(path, flags, mode, fd_start, fd_end) {
  if (path === "") {
   throw new FS.ErrnoError(2);
  }
  flags = typeof flags === "string" ? FS.modeStringToFlags(flags) : flags;
  mode = typeof mode === "undefined" ? 438 : mode;
  if (flags & 64) {
   mode = mode & 4095 | 32768;
  } else {
   mode = 0;
  }
  var node;
  if (typeof path === "object") {
   node = path;
  } else {
   path = PATH.normalize(path);
   try {
    var lookup = FS.lookupPath(path, {
     follow: !(flags & 131072)
    });
    node = lookup.node;
   } catch (e) {}
  }
  var created = false;
  if (flags & 64) {
   if (node) {
    if (flags & 128) {
     throw new FS.ErrnoError(17);
    }
   } else {
    node = FS.mknod(path, mode, 0);
    created = true;
   }
  }
  if (!node) {
   throw new FS.ErrnoError(2);
  }
  if (FS.isChrdev(node.mode)) {
   flags &= ~512;
  }
  if (flags & 65536 && !FS.isDir(node.mode)) {
   throw new FS.ErrnoError(20);
  }
  if (!created) {
   var err = FS.mayOpen(node, flags);
   if (err) {
    throw new FS.ErrnoError(err);
   }
  }
  if (flags & 512) {
   FS.truncate(node, 0);
  }
  flags &= ~(128 | 512);
  var stream = FS.createStream({
   node: node,
   path: FS.getPath(node),
   flags: flags,
   seekable: true,
   position: 0,
   stream_ops: node.stream_ops,
   ungotten: [],
   error: false
  }, fd_start, fd_end);
  if (stream.stream_ops.open) {
   stream.stream_ops.open(stream);
  }
  if (Module["logReadFiles"] && !(flags & 1)) {
   if (!FS.readFiles) FS.readFiles = {};
   if (!(path in FS.readFiles)) {
    FS.readFiles[path] = 1;
    console.log("FS.trackingDelegate error on read file: " + path);
   }
  }
  try {
   if (FS.trackingDelegate["onOpenFile"]) {
    var trackingFlags = 0;
    if ((flags & 2097155) !== 1) {
     trackingFlags |= FS.tracking.openFlags.READ;
    }
    if ((flags & 2097155) !== 0) {
     trackingFlags |= FS.tracking.openFlags.WRITE;
    }
    FS.trackingDelegate["onOpenFile"](path, trackingFlags);
   }
  } catch (e) {
   console.log("FS.trackingDelegate['onOpenFile']('" + path + "', flags) threw an exception: " + e.message);
  }
  return stream;
 },
 close: function(stream) {
  if (FS.isClosed(stream)) {
   throw new FS.ErrnoError(9);
  }
  if (stream.getdents) stream.getdents = null;
  try {
   if (stream.stream_ops.close) {
    stream.stream_ops.close(stream);
   }
  } catch (e) {
   throw e;
  } finally {
   FS.closeStream(stream.fd);
  }
  stream.fd = null;
 },
 isClosed: function(stream) {
  return stream.fd === null;
 },
 llseek: function(stream, offset, whence) {
  if (FS.isClosed(stream)) {
   throw new FS.ErrnoError(9);
  }
  if (!stream.seekable || !stream.stream_ops.llseek) {
   throw new FS.ErrnoError(29);
  }
  if (whence != 0 && whence != 1 && whence != 2) {
   throw new FS.ErrnoError(22);
  }
  stream.position = stream.stream_ops.llseek(stream, offset, whence);
  stream.ungotten = [];
  return stream.position;
 },
 read: function(stream, buffer, offset, length, position) {
  if (length < 0 || position < 0) {
   throw new FS.ErrnoError(22);
  }
  if (FS.isClosed(stream)) {
   throw new FS.ErrnoError(9);
  }
  if ((stream.flags & 2097155) === 1) {
   throw new FS.ErrnoError(9);
  }
  if (FS.isDir(stream.node.mode)) {
   throw new FS.ErrnoError(21);
  }
  if (!stream.stream_ops.read) {
   throw new FS.ErrnoError(22);
  }
  var seeking = typeof position !== "undefined";
  if (!seeking) {
   position = stream.position;
  } else if (!stream.seekable) {
   throw new FS.ErrnoError(29);
  }
  var bytesRead = stream.stream_ops.read(stream, buffer, offset, length, position);
  if (!seeking) stream.position += bytesRead;
  return bytesRead;
 },
 write: function(stream, buffer, offset, length, position, canOwn) {
  if (length < 0 || position < 0) {
   throw new FS.ErrnoError(22);
  }
  if (FS.isClosed(stream)) {
   throw new FS.ErrnoError(9);
  }
  if ((stream.flags & 2097155) === 0) {
   throw new FS.ErrnoError(9);
  }
  if (FS.isDir(stream.node.mode)) {
   throw new FS.ErrnoError(21);
  }
  if (!stream.stream_ops.write) {
   throw new FS.ErrnoError(22);
  }
  if (stream.flags & 1024) {
   FS.llseek(stream, 0, 2);
  }
  var seeking = typeof position !== "undefined";
  if (!seeking) {
   position = stream.position;
  } else if (!stream.seekable) {
   throw new FS.ErrnoError(29);
  }
  var bytesWritten = stream.stream_ops.write(stream, buffer, offset, length, position, canOwn);
  if (!seeking) stream.position += bytesWritten;
  try {
   if (stream.path && FS.trackingDelegate["onWriteToFile"]) FS.trackingDelegate["onWriteToFile"](stream.path);
  } catch (e) {
   console.log("FS.trackingDelegate['onWriteToFile']('" + stream.path + "') threw an exception: " + e.message);
  }
  return bytesWritten;
 },
 allocate: function(stream, offset, length) {
  if (FS.isClosed(stream)) {
   throw new FS.ErrnoError(9);
  }
  if (offset < 0 || length <= 0) {
   throw new FS.ErrnoError(22);
  }
  if ((stream.flags & 2097155) === 0) {
   throw new FS.ErrnoError(9);
  }
  if (!FS.isFile(stream.node.mode) && !FS.isDir(stream.node.mode)) {
   throw new FS.ErrnoError(19);
  }
  if (!stream.stream_ops.allocate) {
   throw new FS.ErrnoError(95);
  }
  stream.stream_ops.allocate(stream, offset, length);
 },
 mmap: function(stream, buffer, offset, length, position, prot, flags) {
  if ((stream.flags & 2097155) === 1) {
   throw new FS.ErrnoError(13);
  }
  if (!stream.stream_ops.mmap) {
   throw new FS.ErrnoError(19);
  }
  return stream.stream_ops.mmap(stream, buffer, offset, length, position, prot, flags);
 },
 msync: function(stream, buffer, offset, length, mmapFlags) {
  if (!stream || !stream.stream_ops.msync) {
   return 0;
  }
  return stream.stream_ops.msync(stream, buffer, offset, length, mmapFlags);
 },
 munmap: function(stream) {
  return 0;
 },
 ioctl: function(stream, cmd, arg) {
  if (!stream.stream_ops.ioctl) {
   throw new FS.ErrnoError(25);
  }
  return stream.stream_ops.ioctl(stream, cmd, arg);
 },
 readFile: function(path, opts) {
  opts = opts || {};
  opts.flags = opts.flags || "r";
  opts.encoding = opts.encoding || "binary";
  if (opts.encoding !== "utf8" && opts.encoding !== "binary") {
   throw new Error('Invalid encoding type "' + opts.encoding + '"');
  }
  var ret;
  var stream = FS.open(path, opts.flags);
  var stat = FS.stat(path);
  var length = stat.size;
  var buf = new Uint8Array(length);
  FS.read(stream, buf, 0, length, 0);
  if (opts.encoding === "utf8") {
   ret = UTF8ArrayToString(buf, 0);
  } else if (opts.encoding === "binary") {
   ret = buf;
  }
  FS.close(stream);
  return ret;
 },
 writeFile: function(path, data, opts) {
  opts = opts || {};
  opts.flags = opts.flags || "w";
  var stream = FS.open(path, opts.flags, opts.mode);
  if (typeof data === "string") {
   var buf = new Uint8Array(lengthBytesUTF8(data) + 1);
   var actualNumBytes = stringToUTF8Array(data, buf, 0, buf.length);
   FS.write(stream, buf, 0, actualNumBytes, undefined, opts.canOwn);
  } else if (ArrayBuffer.isView(data)) {
   FS.write(stream, data, 0, data.byteLength, undefined, opts.canOwn);
  } else {
   throw new Error("Unsupported data type");
  }
  FS.close(stream);
 },
 cwd: function() {
  return FS.currentPath;
 },
 chdir: function(path) {
  var lookup = FS.lookupPath(path, {
   follow: true
  });
  if (lookup.node === null) {
   throw new FS.ErrnoError(2);
  }
  if (!FS.isDir(lookup.node.mode)) {
   throw new FS.ErrnoError(20);
  }
  var err = FS.nodePermissions(lookup.node, "x");
  if (err) {
   throw new FS.ErrnoError(err);
  }
  FS.currentPath = lookup.path;
 },
 createDefaultDirectories: function() {
  FS.mkdir("/tmp");
  FS.mkdir("/home");
  FS.mkdir("/home/web_user");
 },
 createDefaultDevices: function() {
  FS.mkdir("/dev");
  FS.registerDevice(FS.makedev(1, 3), {
   read: function() {
    return 0;
   },
   write: function(stream, buffer, offset, length, pos) {
    return length;
   }
  });
  FS.mkdev("/dev/null", FS.makedev(1, 3));
  TTY.register(FS.makedev(5, 0), TTY.default_tty_ops);
  TTY.register(FS.makedev(6, 0), TTY.default_tty1_ops);
  FS.mkdev("/dev/tty", FS.makedev(5, 0));
  FS.mkdev("/dev/tty1", FS.makedev(6, 0));
  var random_device;
  if (typeof crypto === "object" && typeof crypto["getRandomValues"] === "function") {
   var randomBuffer = new Uint8Array(1);
   random_device = function() {
    crypto.getRandomValues(randomBuffer);
    return randomBuffer[0];
   };
  } else if (ENVIRONMENT_IS_NODE) {
   try {
    var crypto_module = require("crypto");
    random_device = function() {
     return crypto_module["randomBytes"](1)[0];
    };
   } catch (e) {
    random_device = function() {
     return Math.random() * 256 | 0;
    };
   }
  } else {
   random_device = function() {
    abort("random_device");
   };
  }
  FS.createDevice("/dev", "random", random_device);
  FS.createDevice("/dev", "urandom", random_device);
  FS.mkdir("/dev/shm");
  FS.mkdir("/dev/shm/tmp");
 },
 createSpecialDirectories: function() {
  FS.mkdir("/proc");
  FS.mkdir("/proc/self");
  FS.mkdir("/proc/self/fd");
  FS.mount({
   mount: function() {
    var node = FS.createNode("/proc/self", "fd", 16384 | 511, 73);
    node.node_ops = {
     lookup: function(parent, name) {
      var fd = +name;
      var stream = FS.getStream(fd);
      if (!stream) throw new FS.ErrnoError(9);
      var ret = {
       parent: null,
       mount: {
        mountpoint: "fake"
       },
       node_ops: {
        readlink: function() {
         return stream.path;
        }
       }
      };
      ret.parent = ret;
      return ret;
     }
    };
    return node;
   }
  }, {}, "/proc/self/fd");
 },
 createStandardStreams: function() {
  if (Module["stdin"]) {
   FS.createDevice("/dev", "stdin", Module["stdin"]);
  } else {
   FS.symlink("/dev/tty", "/dev/stdin");
  }
  if (Module["stdout"]) {
   FS.createDevice("/dev", "stdout", null, Module["stdout"]);
  } else {
   FS.symlink("/dev/tty", "/dev/stdout");
  }
  if (Module["stderr"]) {
   FS.createDevice("/dev", "stderr", null, Module["stderr"]);
  } else {
   FS.symlink("/dev/tty1", "/dev/stderr");
  }
  var stdin = FS.open("/dev/stdin", "r");
  assert(stdin.fd === 0, "invalid handle for stdin (" + stdin.fd + ")");
  var stdout = FS.open("/dev/stdout", "w");
  assert(stdout.fd === 1, "invalid handle for stdout (" + stdout.fd + ")");
  var stderr = FS.open("/dev/stderr", "w");
  assert(stderr.fd === 2, "invalid handle for stderr (" + stderr.fd + ")");
 },
 ensureErrnoError: function() {
  if (FS.ErrnoError) return;
  FS.ErrnoError = function ErrnoError(errno, node) {
   this.node = node;
   this.setErrno = function(errno) {
    this.errno = errno;
    for (var key in ERRNO_CODES) {
     if (ERRNO_CODES[key] === errno) {
      this.code = key;
      break;
     }
    }
   };
   this.setErrno(errno);
   this.message = ERRNO_MESSAGES[errno];
   if (this.stack) Object.defineProperty(this, "stack", {
    value: new Error().stack,
    writable: true
   });
   if (this.stack) this.stack = demangleAll(this.stack);
  };
  FS.ErrnoError.prototype = new Error();
  FS.ErrnoError.prototype.constructor = FS.ErrnoError;
  [ 2 ].forEach(function(code) {
   FS.genericErrors[code] = new FS.ErrnoError(code);
   FS.genericErrors[code].stack = "<generic error, no stack>";
  });
 },
 staticInit: function() {
  FS.ensureErrnoError();
  FS.nameTable = new Array(4096);
  FS.mount(MEMFS, {}, "/");
  FS.createDefaultDirectories();
  FS.createDefaultDevices();
  FS.createSpecialDirectories();
  FS.filesystems = {
   "MEMFS": MEMFS,
   "IDBFS": IDBFS,
   "NODEFS": NODEFS,
   "WORKERFS": WORKERFS
  };
 },
 init: function(input, output, error) {
  assert(!FS.init.initialized, "FS.init was previously called. If you want to initialize later with custom parameters, remove any earlier calls (note that one is automatically added to the generated code)");
  FS.init.initialized = true;
  FS.ensureErrnoError();
  Module["stdin"] = input || Module["stdin"];
  Module["stdout"] = output || Module["stdout"];
  Module["stderr"] = error || Module["stderr"];
  FS.createStandardStreams();
 },
 quit: function() {
  FS.init.initialized = false;
  var fflush = Module["_fflush"];
  if (fflush) fflush(0);
  for (var i = 0; i < FS.streams.length; i++) {
   var stream = FS.streams[i];
   if (!stream) {
    continue;
   }
   FS.close(stream);
  }
 },
 getMode: function(canRead, canWrite) {
  var mode = 0;
  if (canRead) mode |= 292 | 73;
  if (canWrite) mode |= 146;
  return mode;
 },
 joinPath: function(parts, forceRelative) {
  var path = PATH.join.apply(null, parts);
  if (forceRelative && path[0] == "/") path = path.substr(1);
  return path;
 },
 absolutePath: function(relative, base) {
  return PATH.resolve(base, relative);
 },
 standardizePath: function(path) {
  return PATH.normalize(path);
 },
 findObject: function(path, dontResolveLastLink) {
  var ret = FS.analyzePath(path, dontResolveLastLink);
  if (ret.exists) {
   return ret.object;
  } else {
   ___setErrNo(ret.error);
   return null;
  }
 },
 analyzePath: function(path, dontResolveLastLink) {
  try {
   var lookup = FS.lookupPath(path, {
    follow: !dontResolveLastLink
   });
   path = lookup.path;
  } catch (e) {}
  var ret = {
   isRoot: false,
   exists: false,
   error: 0,
   name: null,
   path: null,
   object: null,
   parentExists: false,
   parentPath: null,
   parentObject: null
  };
  try {
   var lookup = FS.lookupPath(path, {
    parent: true
   });
   ret.parentExists = true;
   ret.parentPath = lookup.path;
   ret.parentObject = lookup.node;
   ret.name = PATH.basename(path);
   lookup = FS.lookupPath(path, {
    follow: !dontResolveLastLink
   });
   ret.exists = true;
   ret.path = lookup.path;
   ret.object = lookup.node;
   ret.name = lookup.node.name;
   ret.isRoot = lookup.path === "/";
  } catch (e) {
   ret.error = e.errno;
  }
  return ret;
 },
 createFolder: function(parent, name, canRead, canWrite) {
  var path = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name);
  var mode = FS.getMode(canRead, canWrite);
  return FS.mkdir(path, mode);
 },
 createPath: function(parent, path, canRead, canWrite) {
  parent = typeof parent === "string" ? parent : FS.getPath(parent);
  var parts = path.split("/").reverse();
  while (parts.length) {
   var part = parts.pop();
   if (!part) continue;
   var current = PATH.join2(parent, part);
   try {
    FS.mkdir(current);
   } catch (e) {}
   parent = current;
  }
  return current;
 },
 createFile: function(parent, name, properties, canRead, canWrite) {
  var path = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name);
  var mode = FS.getMode(canRead, canWrite);
  return FS.create(path, mode);
 },
 createDataFile: function(parent, name, data, canRead, canWrite, canOwn) {
  var path = name ? PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name) : parent;
  var mode = FS.getMode(canRead, canWrite);
  var node = FS.create(path, mode);
  if (data) {
   if (typeof data === "string") {
    var arr = new Array(data.length);
    for (var i = 0, len = data.length; i < len; ++i) arr[i] = data.charCodeAt(i);
    data = arr;
   }
   FS.chmod(node, mode | 146);
   var stream = FS.open(node, "w");
   FS.write(stream, data, 0, data.length, 0, canOwn);
   FS.close(stream);
   FS.chmod(node, mode);
  }
  return node;
 },
 createDevice: function(parent, name, input, output) {
  var path = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name);
  var mode = FS.getMode(!!input, !!output);
  if (!FS.createDevice.major) FS.createDevice.major = 64;
  var dev = FS.makedev(FS.createDevice.major++, 0);
  FS.registerDevice(dev, {
   open: function(stream) {
    stream.seekable = false;
   },
   close: function(stream) {
    if (output && output.buffer && output.buffer.length) {
     output(10);
    }
   },
   read: function(stream, buffer, offset, length, pos) {
    var bytesRead = 0;
    for (var i = 0; i < length; i++) {
     var result;
     try {
      result = input();
     } catch (e) {
      throw new FS.ErrnoError(5);
     }
     if (result === undefined && bytesRead === 0) {
      throw new FS.ErrnoError(11);
     }
     if (result === null || result === undefined) break;
     bytesRead++;
     buffer[offset + i] = result;
    }
    if (bytesRead) {
     stream.node.timestamp = Date.now();
    }
    return bytesRead;
   },
   write: function(stream, buffer, offset, length, pos) {
    for (var i = 0; i < length; i++) {
     try {
      output(buffer[offset + i]);
     } catch (e) {
      throw new FS.ErrnoError(5);
     }
    }
    if (length) {
     stream.node.timestamp = Date.now();
    }
    return i;
   }
  });
  return FS.mkdev(path, mode, dev);
 },
 createLink: function(parent, name, target, canRead, canWrite) {
  var path = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name);
  return FS.symlink(target, path);
 },
 forceLoadFile: function(obj) {
  if (obj.isDevice || obj.isFolder || obj.link || obj.contents) return true;
  var success = true;
  if (typeof XMLHttpRequest !== "undefined") {
   throw new Error("Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.");
  } else if (Module["read"]) {
   try {
    obj.contents = intArrayFromString(Module["read"](obj.url), true);
    obj.usedBytes = obj.contents.length;
   } catch (e) {
    success = false;
   }
  } else {
   throw new Error("Cannot load without read() or XMLHttpRequest.");
  }
  if (!success) ___setErrNo(5);
  return success;
 },
 createLazyFile: function(parent, name, url, canRead, canWrite) {
  function LazyUint8Array() {
   this.lengthKnown = false;
   this.chunks = [];
  }
  LazyUint8Array.prototype.get = function LazyUint8Array_get(idx) {
   if (idx > this.length - 1 || idx < 0) {
    return undefined;
   }
   var chunkOffset = idx % this.chunkSize;
   var chunkNum = idx / this.chunkSize | 0;
   return this.getter(chunkNum)[chunkOffset];
  };
  LazyUint8Array.prototype.setDataGetter = function LazyUint8Array_setDataGetter(getter) {
   this.getter = getter;
  };
  LazyUint8Array.prototype.cacheLength = function LazyUint8Array_cacheLength() {
   var xhr = new XMLHttpRequest();
   xhr.open("HEAD", url, false);
   xhr.send(null);
   if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
   var datalength = Number(xhr.getResponseHeader("Content-length"));
   var header;
   var hasByteServing = (header = xhr.getResponseHeader("Accept-Ranges")) && header === "bytes";
   var usesGzip = (header = xhr.getResponseHeader("Content-Encoding")) && header === "gzip";
   var chunkSize = 1024 * 1024;
   if (!hasByteServing) chunkSize = datalength;
   var doXHR = function(from, to) {
    if (from > to) throw new Error("invalid range (" + from + ", " + to + ") or no bytes requested!");
    if (to > datalength - 1) throw new Error("only " + datalength + " bytes available! programmer error!");
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, false);
    if (datalength !== chunkSize) xhr.setRequestHeader("Range", "bytes=" + from + "-" + to);
    if (typeof Uint8Array != "undefined") xhr.responseType = "arraybuffer";
    if (xhr.overrideMimeType) {
     xhr.overrideMimeType("text/plain; charset=x-user-defined");
    }
    xhr.send(null);
    if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
    if (xhr.response !== undefined) {
     return new Uint8Array(xhr.response || []);
    } else {
     return intArrayFromString(xhr.responseText || "", true);
    }
   };
   var lazyArray = this;
   lazyArray.setDataGetter(function(chunkNum) {
    var start = chunkNum * chunkSize;
    var end = (chunkNum + 1) * chunkSize - 1;
    end = Math.min(end, datalength - 1);
    if (typeof lazyArray.chunks[chunkNum] === "undefined") {
     lazyArray.chunks[chunkNum] = doXHR(start, end);
    }
    if (typeof lazyArray.chunks[chunkNum] === "undefined") throw new Error("doXHR failed!");
    return lazyArray.chunks[chunkNum];
   });
   if (usesGzip || !datalength) {
    chunkSize = datalength = 1;
    datalength = this.getter(0).length;
    chunkSize = datalength;
    console.log("LazyFiles on gzip forces download of the whole file when length is accessed");
   }
   this._length = datalength;
   this._chunkSize = chunkSize;
   this.lengthKnown = true;
  };
  if (typeof XMLHttpRequest !== "undefined") {
   if (!ENVIRONMENT_IS_WORKER) throw "Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc";
   var lazyArray = new LazyUint8Array();
   Object.defineProperties(lazyArray, {
    length: {
     get: function() {
      if (!this.lengthKnown) {
       this.cacheLength();
      }
      return this._length;
     }
    },
    chunkSize: {
     get: function() {
      if (!this.lengthKnown) {
       this.cacheLength();
      }
      return this._chunkSize;
     }
    }
   });
   var properties = {
    isDevice: false,
    contents: lazyArray
   };
  } else {
   var properties = {
    isDevice: false,
    url: url
   };
  }
  var node = FS.createFile(parent, name, properties, canRead, canWrite);
  if (properties.contents) {
   node.contents = properties.contents;
  } else if (properties.url) {
   node.contents = null;
   node.url = properties.url;
  }
  Object.defineProperties(node, {
   usedBytes: {
    get: function() {
     return this.contents.length;
    }
   }
  });
  var stream_ops = {};
  var keys = Object.keys(node.stream_ops);
  keys.forEach(function(key) {
   var fn = node.stream_ops[key];
   stream_ops[key] = function forceLoadLazyFile() {
    if (!FS.forceLoadFile(node)) {
     throw new FS.ErrnoError(5);
    }
    return fn.apply(null, arguments);
   };
  });
  stream_ops.read = function stream_ops_read(stream, buffer, offset, length, position) {
   if (!FS.forceLoadFile(node)) {
    throw new FS.ErrnoError(5);
   }
   var contents = stream.node.contents;
   if (position >= contents.length) return 0;
   var size = Math.min(contents.length - position, length);
   assert(size >= 0);
   if (contents.slice) {
    for (var i = 0; i < size; i++) {
     buffer[offset + i] = contents[position + i];
    }
   } else {
    for (var i = 0; i < size; i++) {
     buffer[offset + i] = contents.get(position + i);
    }
   }
   return size;
  };
  node.stream_ops = stream_ops;
  return node;
 },
 createPreloadedFile: function(parent, name, url, canRead, canWrite, onload, onerror, dontCreateFile, canOwn, preFinish) {
  Browser.init();
  var fullname = name ? PATH.resolve(PATH.join2(parent, name)) : parent;
  var dep = getUniqueRunDependency("cp " + fullname);
  function processData(byteArray) {
   function finish(byteArray) {
    if (preFinish) preFinish();
    if (!dontCreateFile) {
     FS.createDataFile(parent, name, byteArray, canRead, canWrite, canOwn);
    }
    if (onload) onload();
    removeRunDependency(dep);
   }
   var handled = false;
   Module["preloadPlugins"].forEach(function(plugin) {
    if (handled) return;
    if (plugin["canHandle"](fullname)) {
     plugin["handle"](byteArray, fullname, finish, function() {
      if (onerror) onerror();
      removeRunDependency(dep);
     });
     handled = true;
    }
   });
   if (!handled) finish(byteArray);
  }
  addRunDependency(dep);
  if (typeof url == "string") {
   Browser.asyncLoad(url, function(byteArray) {
    processData(byteArray);
   }, onerror);
  } else {
   processData(url);
  }
 },
 indexedDB: function() {
  return window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
 },
 DB_NAME: function() {
  return "EM_FS_" + window.location.pathname;
 },
 DB_VERSION: 20,
 DB_STORE_NAME: "FILE_DATA",
 saveFilesToDB: function(paths, onload, onerror) {
  onload = onload || function() {};
  onerror = onerror || function() {};
  var indexedDB = FS.indexedDB();
  try {
   var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION);
  } catch (e) {
   return onerror(e);
  }
  openRequest.onupgradeneeded = function openRequest_onupgradeneeded() {
   console.log("creating db");
   var db = openRequest.result;
   db.createObjectStore(FS.DB_STORE_NAME);
  };
  openRequest.onsuccess = function openRequest_onsuccess() {
   var db = openRequest.result;
   var transaction = db.transaction([ FS.DB_STORE_NAME ], "readwrite");
   var files = transaction.objectStore(FS.DB_STORE_NAME);
   var ok = 0, fail = 0, total = paths.length;
   function finish() {
    if (fail == 0) onload(); else onerror();
   }
   paths.forEach(function(path) {
    var putRequest = files.put(FS.analyzePath(path).object.contents, path);
    putRequest.onsuccess = function putRequest_onsuccess() {
     ok++;
     if (ok + fail == total) finish();
    };
    putRequest.onerror = function putRequest_onerror() {
     fail++;
     if (ok + fail == total) finish();
    };
   });
   transaction.onerror = onerror;
  };
  openRequest.onerror = onerror;
 },
 loadFilesFromDB: function(paths, onload, onerror) {
  onload = onload || function() {};
  onerror = onerror || function() {};
  var indexedDB = FS.indexedDB();
  try {
   var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION);
  } catch (e) {
   return onerror(e);
  }
  openRequest.onupgradeneeded = onerror;
  openRequest.onsuccess = function openRequest_onsuccess() {
   var db = openRequest.result;
   try {
    var transaction = db.transaction([ FS.DB_STORE_NAME ], "readonly");
   } catch (e) {
    onerror(e);
    return;
   }
   var files = transaction.objectStore(FS.DB_STORE_NAME);
   var ok = 0, fail = 0, total = paths.length;
   function finish() {
    if (fail == 0) onload(); else onerror();
   }
   paths.forEach(function(path) {
    var getRequest = files.get(path);
    getRequest.onsuccess = function getRequest_onsuccess() {
     if (FS.analyzePath(path).exists) {
      FS.unlink(path);
     }
     FS.createDataFile(PATH.dirname(path), PATH.basename(path), getRequest.result, true, true, true);
     ok++;
     if (ok + fail == total) finish();
    };
    getRequest.onerror = function getRequest_onerror() {
     fail++;
     if (ok + fail == total) finish();
    };
   });
   transaction.onerror = onerror;
  };
  openRequest.onerror = onerror;
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
 DEFAULT_POLLMASK: 5,
 mappings: {},
 umask: 511,
 calculateAt: function(dirfd, path) {
  if (path[0] !== "/") {
   var dir;
   if (dirfd === -100) {
    dir = FS.cwd();
   } else {
    var dirstream = FS.getStream(dirfd);
    if (!dirstream) throw new FS.ErrnoError(ERRNO_CODES.EBADF);
    dir = dirstream.path;
   }
   path = PATH.join2(dir, path);
  }
  return path;
 },
 doStat: function(func, path, buf) {
  try {
   var stat = func(path);
  } catch (e) {
   if (e && e.node && PATH.normalize(path) !== PATH.normalize(FS.getPath(e.node))) {
    return -ERRNO_CODES.ENOTDIR;
   }
   throw e;
  }
  HEAP32[buf >> 2] = stat.dev;
  HEAP32[buf + 4 >> 2] = 0;
  HEAP32[buf + 8 >> 2] = stat.ino;
  HEAP32[buf + 12 >> 2] = stat.mode;
  HEAP32[buf + 16 >> 2] = stat.nlink;
  HEAP32[buf + 20 >> 2] = stat.uid;
  HEAP32[buf + 24 >> 2] = stat.gid;
  HEAP32[buf + 28 >> 2] = stat.rdev;
  HEAP32[buf + 32 >> 2] = 0;
  HEAP32[buf + 36 >> 2] = stat.size;
  HEAP32[buf + 40 >> 2] = 4096;
  HEAP32[buf + 44 >> 2] = stat.blocks;
  HEAP32[buf + 48 >> 2] = stat.atime.getTime() / 1e3 | 0;
  HEAP32[buf + 52 >> 2] = 0;
  HEAP32[buf + 56 >> 2] = stat.mtime.getTime() / 1e3 | 0;
  HEAP32[buf + 60 >> 2] = 0;
  HEAP32[buf + 64 >> 2] = stat.ctime.getTime() / 1e3 | 0;
  HEAP32[buf + 68 >> 2] = 0;
  HEAP32[buf + 72 >> 2] = stat.ino;
  return 0;
 },
 doMsync: function(addr, stream, len, flags) {
  var buffer = new Uint8Array(HEAPU8.subarray(addr, addr + len));
  FS.msync(stream, buffer, 0, len, flags);
 },
 doMkdir: function(path, mode) {
  path = PATH.normalize(path);
  if (path[path.length - 1] === "/") path = path.substr(0, path.length - 1);
  FS.mkdir(path, mode, 0);
  return 0;
 },
 doMknod: function(path, mode, dev) {
  switch (mode & 61440) {
  case 32768:
  case 8192:
  case 24576:
  case 4096:
  case 49152:
   break;

  default:
   return -ERRNO_CODES.EINVAL;
  }
  FS.mknod(path, mode, dev);
  return 0;
 },
 doReadlink: function(path, buf, bufsize) {
  if (bufsize <= 0) return -ERRNO_CODES.EINVAL;
  var ret = FS.readlink(path);
  var len = Math.min(bufsize, lengthBytesUTF8(ret));
  var endChar = HEAP8[buf + len];
  stringToUTF8(ret, buf, bufsize + 1);
  HEAP8[buf + len] = endChar;
  return len;
 },
 doAccess: function(path, amode) {
  if (amode & ~7) {
   return -ERRNO_CODES.EINVAL;
  }
  var node;
  var lookup = FS.lookupPath(path, {
   follow: true
  });
  node = lookup.node;
  var perms = "";
  if (amode & 4) perms += "r";
  if (amode & 2) perms += "w";
  if (amode & 1) perms += "x";
  if (perms && FS.nodePermissions(node, perms)) {
   return -ERRNO_CODES.EACCES;
  }
  return 0;
 },
 doDup: function(path, flags, suggestFD) {
  var suggest = FS.getStream(suggestFD);
  if (suggest) FS.close(suggest);
  return FS.open(path, flags, 0, suggestFD, suggestFD).fd;
 },
 doReadv: function(stream, iov, iovcnt, offset) {
  var ret = 0;
  for (var i = 0; i < iovcnt; i++) {
   var ptr = HEAP32[iov + i * 8 >> 2];
   var len = HEAP32[iov + (i * 8 + 4) >> 2];
   var curr = FS.read(stream, HEAP8, ptr, len, offset);
   if (curr < 0) return -1;
   ret += curr;
   if (curr < len) break;
  }
  return ret;
 },
 doWritev: function(stream, iov, iovcnt, offset) {
  var ret = 0;
  for (var i = 0; i < iovcnt; i++) {
   var ptr = HEAP32[iov + i * 8 >> 2];
   var len = HEAP32[iov + (i * 8 + 4) >> 2];
   var curr = FS.write(stream, HEAP8, ptr, len, offset);
   if (curr < 0) return -1;
   ret += curr;
  }
  return ret;
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
 getStreamFromFD: function() {
  var stream = FS.getStream(SYSCALLS.get());
  if (!stream) throw new FS.ErrnoError(ERRNO_CODES.EBADF);
  return stream;
 },
 getSocketFromFD: function() {
  var socket = SOCKFS.getSocket(SYSCALLS.get());
  if (!socket) throw new FS.ErrnoError(ERRNO_CODES.EBADF);
  return socket;
 },
 getSocketAddress: function(allowNull) {
  var addrp = SYSCALLS.get(), addrlen = SYSCALLS.get();
  if (allowNull && addrp === 0) return null;
  var info = __read_sockaddr(addrp, addrlen);
  if (info.errno) throw new FS.ErrnoError(info.errno);
  info.addr = DNS.lookup_addr(info.addr) || info.addr;
  return info;
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

function ___syscall146(which, varargs) {
 SYSCALLS.varargs = varargs;
 try {
  var stream = SYSCALLS.getStreamFromFD(), iov = SYSCALLS.get(), iovcnt = SYSCALLS.get();
  return SYSCALLS.doWritev(stream, iov, iovcnt);
 } catch (e) {
  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
  return -e.errno;
 }
}

function ___syscall221(which, varargs) {
 SYSCALLS.varargs = varargs;
 try {
  var stream = SYSCALLS.getStreamFromFD(), cmd = SYSCALLS.get();
  switch (cmd) {
  case 0:
   {
    var arg = SYSCALLS.get();
    if (arg < 0) {
     return -ERRNO_CODES.EINVAL;
    }
    var newStream;
    newStream = FS.open(stream.path, stream.flags, 0, arg);
    return newStream.fd;
   }

  case 1:
  case 2:
   return 0;

  case 3:
   return stream.flags;

  case 4:
   {
    var arg = SYSCALLS.get();
    stream.flags |= arg;
    return 0;
   }

  case 12:
   {
    var arg = SYSCALLS.get();
    var offset = 0;
    HEAP16[arg + offset >> 1] = 2;
    return 0;
   }

  case 13:
  case 14:
   return 0;

  case 16:
  case 8:
   return -ERRNO_CODES.EINVAL;

  case 9:
   ___setErrNo(ERRNO_CODES.EINVAL);
   return -1;

  default:
   {
    return -ERRNO_CODES.EINVAL;
   }
  }
 } catch (e) {
  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
  return -e.errno;
 }
}

function ___syscall3(which, varargs) {
 SYSCALLS.varargs = varargs;
 try {
  var stream = SYSCALLS.getStreamFromFD(), buf = SYSCALLS.get(), count = SYSCALLS.get();
  return FS.read(stream, HEAP8, buf, count);
 } catch (e) {
  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
  return -e.errno;
 }
}

function ___syscall5(which, varargs) {
 SYSCALLS.varargs = varargs;
 try {
  var pathname = SYSCALLS.getStr(), flags = SYSCALLS.get(), mode = SYSCALLS.get();
  var stream = FS.open(pathname, flags, mode);
  return stream.fd;
 } catch (e) {
  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
  return -e.errno;
 }
}

function ___syscall54(which, varargs) {
 SYSCALLS.varargs = varargs;
 try {
  var stream = SYSCALLS.getStreamFromFD(), op = SYSCALLS.get();
  switch (op) {
  case 21509:
  case 21505:
   {
    if (!stream.tty) return -ERRNO_CODES.ENOTTY;
    return 0;
   }

  case 21510:
  case 21511:
  case 21512:
  case 21506:
  case 21507:
  case 21508:
   {
    if (!stream.tty) return -ERRNO_CODES.ENOTTY;
    return 0;
   }

  case 21519:
   {
    if (!stream.tty) return -ERRNO_CODES.ENOTTY;
    var argp = SYSCALLS.get();
    HEAP32[argp >> 2] = 0;
    return 0;
   }

  case 21520:
   {
    if (!stream.tty) return -ERRNO_CODES.ENOTTY;
    return -ERRNO_CODES.EINVAL;
   }

  case 21531:
   {
    var argp = SYSCALLS.get();
    return FS.ioctl(stream, op, argp);
   }

  case 21523:
   {
    if (!stream.tty) return -ERRNO_CODES.ENOTTY;
    return 0;
   }

  case 21524:
   {
    if (!stream.tty) return -ERRNO_CODES.ENOTTY;
    return 0;
   }

  default:
   abort("bad ioctl syscall " + op);
  }
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

FS.staticInit();

__ATINIT__.unshift(function() {
 if (!Module["noFSInit"] && !FS.init.initialized) FS.init();
});

__ATMAIN__.push(function() {
 FS.ignorePermissions = false;
});

__ATEXIT__.push(function() {
 FS.quit();
});

__ATINIT__.unshift(function() {
 TTY.init();
});

__ATEXIT__.push(function() {
 TTY.shutdown();
});

if (ENVIRONMENT_IS_NODE) {
 var fs = require("fs");
 var NODEJS_PATH = require("path");
 NODEFS.staticInit();
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

var debug_table_ii = [ "0", "__ZNKSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlRK7Vector2E_NS_9allocatorIS7_EEFvS6_EE7__cloneEv", "__ZNKSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlRK7Vector2E_NS_9allocatorIS7_EEFvS6_EE11target_typeEv", "__ZNKSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlvE_NS_9allocatorIS4_EEFP9ComponentvEE7__cloneEv", "__ZNSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlvE_NS_9allocatorIS4_EEFP9ComponentvEEclEv", "__ZNKSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlvE_NS_9allocatorIS4_EEFP9ComponentvEE11target_typeEv", "__ZNKSt3__210__function6__funcIZN13ComponentGridC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEE10Vector2IntfNS_8functionIFP9ComponentvEEESE_NSA_IFvSC_jjjEEEEUlvE_NS5_ISH_EEFNS_10shared_ptrISB_EEvEE7__cloneEv", "__ZNKSt3__210__function6__funcIZN13ComponentGridC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEE10Vector2IntfNS_8functionIFP9ComponentvEEESE_NSA_IFvSC_jjjEEEEUlvE_NS5_ISH_EEFNS_10shared_ptrISB_EEvEE11target_typeEv", "__ZNKSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlRK7Vector2E0_NS_9allocatorIS7_EEFvS6_EE7__cloneEv", "__ZNKSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlRK7Vector2E0_NS_9allocatorIS7_EEFvS6_EE11target_typeEv", "__ZNKSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlRK7Vector2E1_NS_9allocatorIS7_EEFvS6_EE7__cloneEv", "__ZNKSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlRK7Vector2E1_NS_9allocatorIS7_EEFvS6_EE11target_typeEv", "__ZNKSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlRK7Vector2E2_NS_9allocatorIS7_EEFvS6_EE7__cloneEv", "__ZNKSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlRK7Vector2E2_NS_9allocatorIS7_EEFvS6_EE11target_typeEv", "__ZNKSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEE7__cloneEv", "__ZNKSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEE11target_typeEv", "___stdio_close", "__ZNKSt3__217bad_function_call4whatEv", "__ZNKSt11logic_error4whatEv", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0" ];

var debug_table_iii = [ "0", "__ZNKSt3__220__shared_ptr_pointerIP9ComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP24FilledRectangleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP24StrokeRectangleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP13TextComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlRK7Vector2E_NS_9allocatorIS7_EEFvS6_EE6targetERKSt9type_info", "__ZNKSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlvE_NS_9allocatorIS4_EEFP9ComponentvEE6targetERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP14ImageComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP17FixedCapacityPoolNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__210__function6__funcIZN13ComponentGridC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEE10Vector2IntfNS_8functionIFP9ComponentvEEESE_NSA_IFvSC_jjjEEEEUlvE_NS5_ISH_EEFNS_10shared_ptrISB_EEvEE6targetERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP13ComponentCellNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP17PropertyAnimationNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP13ComponentGridNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlRK7Vector2E0_NS_9allocatorIS7_EEFvS6_EE6targetERKSt9type_info", "__ZNKSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlRK7Vector2E1_NS_9allocatorIS7_EEFvS6_EE6targetERKSt9type_info", "__ZNKSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlRK7Vector2E2_NS_9allocatorIS7_EEFvS6_EE6targetERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP18ColorConfigurationNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZN18ColorConfiguration20shouldAcceptSelectedENSt3__26vectorINS0_10shared_ptrI13ComponentCellEENS0_9allocatorIS4_EEEE", "__ZNKSt3__220__shared_ptr_pointerIP21SpellingConfigurationNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZN21SpellingConfiguration20shouldAcceptSelectedENSt3__26vectorINS0_10shared_ptrI13ComponentCellEENS0_9allocatorIS4_EEEE", "__ZNKSt3__220__shared_ptr_pointerIP17MathConfigurationNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZN17MathConfiguration20shouldAcceptSelectedENSt3__26vectorINS0_10shared_ptrI13ComponentCellEENS0_9allocatorIS4_EEEE", "__ZNKSt3__220__shared_ptr_pointerIP23VocabularyConfigurationNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZN23VocabularyConfiguration20shouldAcceptSelectedENSt3__26vectorINS0_10shared_ptrI13ComponentCellEENS0_9allocatorIS4_EEEE", "__ZNKSt3__220__shared_ptr_pointerIP15ConnectingTilesNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEE6targetERKSt9type_info", "0", "0", "0", "0", "0", "0" ];

var debug_table_iiii = [ "0", "__ZN18ColorConfiguration9canSelectENSt3__26vectorINS0_10shared_ptrI13ComponentCellEENS0_9allocatorIS4_EEEES4_", "__ZN21SpellingConfiguration9canSelectENSt3__26vectorINS0_10shared_ptrI13ComponentCellEENS0_9allocatorIS4_EEEES4_", "__ZN17MathConfiguration9canSelectENSt3__26vectorINS0_10shared_ptrI13ComponentCellEENS0_9allocatorIS4_EEEES4_", "__ZN23VocabularyConfiguration9canSelectENSt3__26vectorINS0_10shared_ptrI13ComponentCellEENS0_9allocatorIS4_EEEES4_", "___stdio_write", "___stdio_seek", "___stdout_write", "_sn_write", "__ZNK10__cxxabiv117__class_type_info9can_catchEPKNS_16__shim_type_infoERPv", "0", "0", "0", "0", "0", "0" ];

var debug_table_iiiii = [ "0", "__ZN18ColorConfiguration11chooseStateENSt3__210shared_ptrI13ComponentGridEEjj", "__ZN21SpellingConfiguration11chooseStateENSt3__210shared_ptrI13ComponentGridEEjj", "__ZN17MathConfiguration11chooseStateENSt3__210shared_ptrI13ComponentGridEEjj", "__ZN23VocabularyConfiguration11chooseStateENSt3__210shared_ptrI13ComponentGridEEjj", "0", "0", "0" ];

var debug_table_v = [ "0", "__ZL25default_terminate_handlerv", "__Z9main_loopv", "__ZN10__cxxabiv112_GLOBAL__N_110construct_Ev" ];

var debug_table_vi = [ "0", "__ZNSt3__214__shared_countD2Ev", "__ZNSt3__220__shared_ptr_pointerIP9ComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP9ComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP9ComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__220__shared_ptr_pointerIP24FilledRectangleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP24FilledRectangleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP24FilledRectangleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__220__shared_ptr_pointerIP24StrokeRectangleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP24StrokeRectangleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP24StrokeRectangleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__220__shared_ptr_pointerIP13TextComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP13TextComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP13TextComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlRK7Vector2E_NS_9allocatorIS7_EEFvS6_EED2Ev", "__ZNSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlRK7Vector2E_NS_9allocatorIS7_EEFvS6_EED0Ev", "__ZNSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlRK7Vector2E_NS_9allocatorIS7_EEFvS6_EE7destroyEv", "__ZNSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlRK7Vector2E_NS_9allocatorIS7_EEFvS6_EE18destroy_deallocateEv", "__ZNSt3__210__function6__baseIFP9ComponentvEED2Ev", "__ZNSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlvE_NS_9allocatorIS4_EEFP9ComponentvEED0Ev", "__ZNSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlvE_NS_9allocatorIS4_EEFP9ComponentvEE7destroyEv", "__ZNSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlvE_NS_9allocatorIS4_EEFP9ComponentvEE18destroy_deallocateEv", "__ZNSt3__220__shared_ptr_pointerIP14ImageComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP14ImageComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP14ImageComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__220__shared_ptr_pointerIP17FixedCapacityPoolNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP17FixedCapacityPoolNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP17FixedCapacityPoolNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__210__function6__funcIZN13ComponentGridC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEE10Vector2IntfNS_8functionIFP9ComponentvEEESE_NSA_IFvSC_jjjEEEEUlvE_NS5_ISH_EEFNS_10shared_ptrISB_EEvEED2Ev", "__ZNSt3__210__function6__funcIZN13ComponentGridC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEE10Vector2IntfNS_8functionIFP9ComponentvEEESE_NSA_IFvSC_jjjEEEEUlvE_NS5_ISH_EEFNS_10shared_ptrISB_EEvEED0Ev", "__ZNSt3__210__function6__funcIZN13ComponentGridC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEE10Vector2IntfNS_8functionIFP9ComponentvEEESE_NSA_IFvSC_jjjEEEEUlvE_NS5_ISH_EEFNS_10shared_ptrISB_EEvEE7destroyEv", "__ZNSt3__210__function6__funcIZN13ComponentGridC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEE10Vector2IntfNS_8functionIFP9ComponentvEEESE_NSA_IFvSC_jjjEEEEUlvE_NS5_ISH_EEFNS_10shared_ptrISB_EEvEE18destroy_deallocateEv", "__ZNSt3__220__shared_ptr_pointerIP13ComponentCellNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP13ComponentCellNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP13ComponentCellNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__220__shared_ptr_pointerIP17PropertyAnimationNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP17PropertyAnimationNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP17PropertyAnimationNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__220__shared_ptr_pointerIP13ComponentGridNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP13ComponentGridNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP13ComponentGridNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__210__function6__baseIFvRK7Vector2EED2Ev", "__ZNSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlRK7Vector2E0_NS_9allocatorIS7_EEFvS6_EED0Ev", "__ZNSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlRK7Vector2E0_NS_9allocatorIS7_EEFvS6_EE7destroyEv", "__ZNSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlRK7Vector2E0_NS_9allocatorIS7_EEFvS6_EE18destroy_deallocateEv", "__ZNSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlRK7Vector2E1_NS_9allocatorIS7_EEFvS6_EED0Ev", "__ZNSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlRK7Vector2E1_NS_9allocatorIS7_EEFvS6_EE7destroyEv", "__ZNSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlRK7Vector2E1_NS_9allocatorIS7_EEFvS6_EE18destroy_deallocateEv", "__ZNSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlRK7Vector2E2_NS_9allocatorIS7_EEFvS6_EED0Ev", "__ZNSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlRK7Vector2E2_NS_9allocatorIS7_EEFvS6_EE7destroyEv", "__ZNSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlRK7Vector2E2_NS_9allocatorIS7_EEFvS6_EE18destroy_deallocateEv", "__ZNSt3__220__shared_ptr_pointerIP18ColorConfigurationNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP18ColorConfigurationNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP18ColorConfigurationNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZN18ColorConfiguration16didClearSelectedEv", "__ZNSt3__220__shared_ptr_pointerIP21SpellingConfigurationNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP21SpellingConfigurationNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP21SpellingConfigurationNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZN21SpellingConfiguration16didClearSelectedEv", "__ZNSt3__220__shared_ptr_pointerIP17MathConfigurationNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP17MathConfigurationNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP17MathConfigurationNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZN17MathConfiguration16didClearSelectedEv", "__ZNSt3__220__shared_ptr_pointerIP23VocabularyConfigurationNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP23VocabularyConfigurationNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP23VocabularyConfigurationNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZN23VocabularyConfiguration16didClearSelectedEv", "__ZNSt3__220__shared_ptr_pointerIP15ConnectingTilesNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP15ConnectingTilesNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP15ConnectingTilesNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__210__function6__baseIFvvEED2Ev", "__ZNSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEED0Ev", "__ZNSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEE7destroyEv", "__ZNSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEE18destroy_deallocateEv", "__ZNSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEEclEv", "__ZNSt3__217bad_function_callD2Ev", "__ZNSt3__217bad_function_callD0Ev", "__ZN10__cxxabiv116__shim_type_infoD2Ev", "__ZN10__cxxabiv117__class_type_infoD0Ev", "__ZNK10__cxxabiv116__shim_type_info5noop1Ev", "__ZNK10__cxxabiv116__shim_type_info5noop2Ev", "__ZN10__cxxabiv120__si_class_type_infoD0Ev", "__ZNSt11logic_errorD2Ev", "__ZNSt11logic_errorD0Ev", "__ZNSt12length_errorD0Ev", "__ZNSt12out_of_rangeD0Ev", "__ZN10__cxxabiv121__vmi_class_type_infoD0Ev", "__ZN10__cxxabiv112_GLOBAL__N_19destruct_EPv", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0" ];

var debug_table_vidi = [ "0", "__ZN6Screen4loopEfRKNSt3__26vectorIbNS0_9allocatorIbEEEE" ];

var debug_table_vii = [ "0", "__ZN6Screen7onKeyUpEi", "__ZN6Screen9onKeyDownEi", "__ZNKSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlRK7Vector2E_NS_9allocatorIS7_EEFvS6_EE7__cloneEPNS0_6__baseISA_EE", "__ZNSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlRK7Vector2E_NS_9allocatorIS7_EEFvS6_EEclES6_", "__ZNKSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlvE_NS_9allocatorIS4_EEFP9ComponentvEE7__cloneEPNS0_6__baseIS9_EE", "__ZNKSt3__210__function6__funcIZN13ComponentGridC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEE10Vector2IntfNS_8functionIFP9ComponentvEEESE_NSA_IFvSC_jjjEEEEUlvE_NS5_ISH_EEFNS_10shared_ptrISB_EEvEE7__cloneEPNS0_6__baseISL_EE", "__ZNSt3__210__function6__funcIZN13ComponentGridC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEE10Vector2IntfNS_8functionIFP9ComponentvEEESE_NSA_IFvSC_jjjEEEEUlvE_NS5_ISH_EEFNS_10shared_ptrISB_EEvEEclEv", "__ZNKSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlRK7Vector2E0_NS_9allocatorIS7_EEFvS6_EE7__cloneEPNS0_6__baseISA_EE", "__ZNSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlRK7Vector2E0_NS_9allocatorIS7_EEFvS6_EEclES6_", "__ZNKSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlRK7Vector2E1_NS_9allocatorIS7_EEFvS6_EE7__cloneEPNS0_6__baseISA_EE", "__ZNSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlRK7Vector2E1_NS_9allocatorIS7_EEFvS6_EEclES6_", "__ZNKSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlRK7Vector2E2_NS_9allocatorIS7_EEFvS6_EE7__cloneEPNS0_6__baseISA_EE", "__ZNSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlRK7Vector2E2_NS_9allocatorIS7_EEFvS6_EEclES6_", "__ZN18ColorConfiguration14willRemoveCellENSt3__210shared_ptrI13ComponentCellEE", "__ZN21SpellingConfiguration14willRemoveCellENSt3__210shared_ptrI13ComponentCellEE", "__ZN17MathConfiguration14willRemoveCellENSt3__210shared_ptrI13ComponentCellEE", "__ZN23VocabularyConfiguration14willRemoveCellENSt3__210shared_ptrI13ComponentCellEE", "__ZNKSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEE7__cloneEPNS0_6__baseIS5_EE", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0" ];

var debug_table_viid = [ "0", "__ZN17PropertyAnimation6onStepERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEEf", "__ZN8Movement6onStepERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEEf", "0" ];

var debug_table_viii = [ "0", "__ZN9Component11setSizeModeERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEENS_8SizeModeE", "__ZN9Component8addChildERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEENS0_10shared_ptrIS_EE", "__ZN13TextComponent11setSizeModeERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEEN9Component8SizeModeE", "__ZN18ColorConfiguration11didSetStateERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEENS0_10shared_ptrI13ComponentCellEE", "__ZN21SpellingConfiguration11didSetStateERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEENS0_10shared_ptrI13ComponentCellEE", "__ZN17MathConfiguration11didSetStateERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEENS0_10shared_ptrI13ComponentCellEE", "__ZN23VocabularyConfiguration11didSetStateERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEENS0_10shared_ptrI13ComponentCellEE" ];

var debug_table_viiii = [ "0", "__ZN9Component8doLayoutERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN9Component16doLayoutEntitiesERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN24FilledRectangleComponent8doLayoutERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN24FilledRectangleComponent16doLayoutEntitiesERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN24StrokeRectangleComponent8doLayoutERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN24StrokeRectangleComponent16doLayoutEntitiesERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN13TextComponent8doLayoutERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN13TextComponent16doLayoutEntitiesERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN25RoundedRectangleComponent8doLayoutERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN25RoundedRectangleComponent16doLayoutEntitiesERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN14ImageComponent8doLayoutERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN14ImageComponent16doLayoutEntitiesERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZNK10__cxxabiv117__class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi", "__ZNK10__cxxabiv120__si_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi", "__ZNK10__cxxabiv121__vmi_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi" ];

var debug_table_viiiii = [ "0", "__ZN18ColorConfiguration11didDeselectERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEENS1_INS0_10shared_ptrI13ComponentCellEENS3_IS9_EEEES9_NS7_I13TextComponentEE", "__ZN18ColorConfiguration9didSelectERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEENS1_INS0_10shared_ptrI13ComponentCellEENS3_IS9_EEEES9_NS7_I13TextComponentEE", "__ZN21SpellingConfiguration11didDeselectERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEENS1_INS0_10shared_ptrI13ComponentCellEENS3_IS9_EEEES9_NS7_I13TextComponentEE", "__ZN21SpellingConfiguration9didSelectERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEENS1_INS0_10shared_ptrI13ComponentCellEENS3_IS9_EEEES9_NS7_I13TextComponentEE", "__ZN17MathConfiguration11didDeselectERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEENS1_INS0_10shared_ptrI13ComponentCellEENS3_IS9_EEEES9_NS7_I13TextComponentEE", "__ZN17MathConfiguration9didSelectERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEENS1_INS0_10shared_ptrI13ComponentCellEENS3_IS9_EEEES9_NS7_I13TextComponentEE", "__ZN23VocabularyConfiguration11didDeselectERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEENS1_INS0_10shared_ptrI13ComponentCellEENS3_IS9_EEEES9_NS7_I13TextComponentEE", "__ZN23VocabularyConfiguration9didSelectERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEENS1_INS0_10shared_ptrI13ComponentCellEENS3_IS9_EEEES9_NS7_I13TextComponentEE", "__ZNK10__cxxabiv117__class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib", "__ZNK10__cxxabiv120__si_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib", "__ZNK10__cxxabiv121__vmi_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib", "0", "0", "0", "0" ];

var debug_table_viiiiii = [ "0", "__ZNK10__cxxabiv117__class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib", "__ZNK10__cxxabiv120__si_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib", "__ZNK10__cxxabiv121__vmi_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib" ];

function nullFunc_ii(x) {
 err("Invalid function pointer '" + x + "' called with signature 'ii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("This pointer might make sense in another type signature: iii: " + debug_table_iii[x] + "  iiii: " + debug_table_iiii[x] + "  iiiii: " + debug_table_iiiii[x] + "  vii: " + debug_table_vii[x] + "  vi: " + debug_table_vi[x] + "  vidi: " + debug_table_vidi[x] + "  viid: " + debug_table_viid[x] + "  viii: " + debug_table_viii[x] + "  v: " + debug_table_v[x] + "  viiii: " + debug_table_viiii[x] + "  viiiii: " + debug_table_viiiii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  ");
 abort(x);
}

function nullFunc_iii(x) {
 err("Invalid function pointer '" + x + "' called with signature 'iii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("This pointer might make sense in another type signature: ii: " + debug_table_ii[x] + "  iiii: " + debug_table_iiii[x] + "  iiiii: " + debug_table_iiiii[x] + "  viii: " + debug_table_viii[x] + "  vii: " + debug_table_vii[x] + "  vi: " + debug_table_vi[x] + "  viid: " + debug_table_viid[x] + "  viiii: " + debug_table_viiii[x] + "  vidi: " + debug_table_vidi[x] + "  viiiii: " + debug_table_viiiii[x] + "  v: " + debug_table_v[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  ");
 abort(x);
}

function nullFunc_iiii(x) {
 err("Invalid function pointer '" + x + "' called with signature 'iiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("This pointer might make sense in another type signature: iii: " + debug_table_iii[x] + "  ii: " + debug_table_ii[x] + "  iiiii: " + debug_table_iiiii[x] + "  viii: " + debug_table_viii[x] + "  viiii: " + debug_table_viiii[x] + "  vii: " + debug_table_vii[x] + "  vi: " + debug_table_vi[x] + "  vidi: " + debug_table_vidi[x] + "  viid: " + debug_table_viid[x] + "  viiiii: " + debug_table_viiiii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  v: " + debug_table_v[x] + "  ");
 abort(x);
}

function nullFunc_iiiii(x) {
 err("Invalid function pointer '" + x + "' called with signature 'iiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("This pointer might make sense in another type signature: iiii: " + debug_table_iiii[x] + "  iii: " + debug_table_iii[x] + "  ii: " + debug_table_ii[x] + "  viiii: " + debug_table_viiii[x] + "  viii: " + debug_table_viii[x] + "  viiiii: " + debug_table_viiiii[x] + "  vii: " + debug_table_vii[x] + "  vi: " + debug_table_vi[x] + "  vidi: " + debug_table_vidi[x] + "  viid: " + debug_table_viid[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  v: " + debug_table_v[x] + "  ");
 abort(x);
}

function nullFunc_v(x) {
 err("Invalid function pointer '" + x + "' called with signature 'v'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("This pointer might make sense in another type signature: vi: " + debug_table_vi[x] + "  vii: " + debug_table_vii[x] + "  vidi: " + debug_table_vidi[x] + "  viid: " + debug_table_viid[x] + "  viii: " + debug_table_viii[x] + "  viiii: " + debug_table_viiii[x] + "  viiiii: " + debug_table_viiiii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  ii: " + debug_table_ii[x] + "  iii: " + debug_table_iii[x] + "  iiii: " + debug_table_iiii[x] + "  iiiii: " + debug_table_iiiii[x] + "  ");
 abort(x);
}

function nullFunc_vi(x) {
 err("Invalid function pointer '" + x + "' called with signature 'vi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("This pointer might make sense in another type signature: v: " + debug_table_v[x] + "  vii: " + debug_table_vii[x] + "  vidi: " + debug_table_vidi[x] + "  viid: " + debug_table_viid[x] + "  viii: " + debug_table_viii[x] + "  viiii: " + debug_table_viiii[x] + "  viiiii: " + debug_table_viiiii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  ii: " + debug_table_ii[x] + "  iii: " + debug_table_iii[x] + "  iiii: " + debug_table_iiii[x] + "  iiiii: " + debug_table_iiiii[x] + "  ");
 abort(x);
}

function nullFunc_vidi(x) {
 err("Invalid function pointer '" + x + "' called with signature 'vidi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("This pointer might make sense in another type signature: vi: " + debug_table_vi[x] + "  v: " + debug_table_v[x] + "  vii: " + debug_table_vii[x] + "  ii: " + debug_table_ii[x] + "  viii: " + debug_table_viii[x] + "  viid: " + debug_table_viid[x] + "  iii: " + debug_table_iii[x] + "  iiii: " + debug_table_iiii[x] + "  viiii: " + debug_table_viiii[x] + "  iiiii: " + debug_table_iiiii[x] + "  viiiii: " + debug_table_viiiii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  ");
 abort(x);
}

function nullFunc_vii(x) {
 err("Invalid function pointer '" + x + "' called with signature 'vii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("This pointer might make sense in another type signature: vi: " + debug_table_vi[x] + "  viid: " + debug_table_viid[x] + "  viii: " + debug_table_viii[x] + "  v: " + debug_table_v[x] + "  viiii: " + debug_table_viiii[x] + "  viiiii: " + debug_table_viiiii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  ii: " + debug_table_ii[x] + "  vidi: " + debug_table_vidi[x] + "  iii: " + debug_table_iii[x] + "  iiii: " + debug_table_iiii[x] + "  iiiii: " + debug_table_iiiii[x] + "  ");
 abort(x);
}

function nullFunc_viid(x) {
 err("Invalid function pointer '" + x + "' called with signature 'viid'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("This pointer might make sense in another type signature: vii: " + debug_table_vii[x] + "  vi: " + debug_table_vi[x] + "  v: " + debug_table_v[x] + "  ii: " + debug_table_ii[x] + "  viii: " + debug_table_viii[x] + "  vidi: " + debug_table_vidi[x] + "  iii: " + debug_table_iii[x] + "  iiii: " + debug_table_iiii[x] + "  viiii: " + debug_table_viiii[x] + "  iiiii: " + debug_table_iiiii[x] + "  viiiii: " + debug_table_viiiii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  ");
 abort(x);
}

function nullFunc_viii(x) {
 err("Invalid function pointer '" + x + "' called with signature 'viii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("This pointer might make sense in another type signature: vii: " + debug_table_vii[x] + "  vi: " + debug_table_vi[x] + "  viiii: " + debug_table_viiii[x] + "  v: " + debug_table_v[x] + "  viiiii: " + debug_table_viiiii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  iii: " + debug_table_iii[x] + "  ii: " + debug_table_ii[x] + "  iiii: " + debug_table_iiii[x] + "  vidi: " + debug_table_vidi[x] + "  viid: " + debug_table_viid[x] + "  iiiii: " + debug_table_iiiii[x] + "  ");
 abort(x);
}

function nullFunc_viiii(x) {
 err("Invalid function pointer '" + x + "' called with signature 'viiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("This pointer might make sense in another type signature: viii: " + debug_table_viii[x] + "  vii: " + debug_table_vii[x] + "  vi: " + debug_table_vi[x] + "  viiiii: " + debug_table_viiiii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  v: " + debug_table_v[x] + "  iiii: " + debug_table_iiii[x] + "  iii: " + debug_table_iii[x] + "  ii: " + debug_table_ii[x] + "  iiiii: " + debug_table_iiiii[x] + "  vidi: " + debug_table_vidi[x] + "  viid: " + debug_table_viid[x] + "  ");
 abort(x);
}

function nullFunc_viiiii(x) {
 err("Invalid function pointer '" + x + "' called with signature 'viiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("This pointer might make sense in another type signature: viii: " + debug_table_viii[x] + "  viiii: " + debug_table_viiii[x] + "  vii: " + debug_table_vii[x] + "  vi: " + debug_table_vi[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  v: " + debug_table_v[x] + "  iiii: " + debug_table_iiii[x] + "  iiiii: " + debug_table_iiiii[x] + "  iii: " + debug_table_iii[x] + "  ii: " + debug_table_ii[x] + "  vidi: " + debug_table_vidi[x] + "  viid: " + debug_table_viid[x] + "  ");
 abort(x);
}

function nullFunc_viiiiii(x) {
 err("Invalid function pointer '" + x + "' called with signature 'viiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("This pointer might make sense in another type signature: viii: " + debug_table_viii[x] + "  viiii: " + debug_table_viiii[x] + "  viiiii: " + debug_table_viiiii[x] + "  vii: " + debug_table_vii[x] + "  vi: " + debug_table_vi[x] + "  v: " + debug_table_v[x] + "  iiii: " + debug_table_iiii[x] + "  iiiii: " + debug_table_iiiii[x] + "  iii: " + debug_table_iii[x] + "  vidi: " + debug_table_vidi[x] + "  viid: " + debug_table_viid[x] + "  ii: " + debug_table_ii[x] + "  ");
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
 "h": nullFunc_iiiii,
 "i": nullFunc_v,
 "j": nullFunc_vi,
 "k": nullFunc_vidi,
 "l": nullFunc_vii,
 "m": nullFunc_viid,
 "n": nullFunc_viii,
 "o": nullFunc_viiii,
 "p": nullFunc_viiiii,
 "q": nullFunc_viiiiii,
 "r": _Engine_FillPage,
 "s": _Engine_FilledEllipse,
 "t": _Engine_FilledRectangle,
 "u": _Engine_FilledText,
 "v": _Engine_GetMode,
 "w": _Engine_Image,
 "x": _Engine_Init,
 "y": _Engine_MeasureTextWidth,
 "z": _Engine_Rectangle,
 "A": _Engine_RoundedRectangle,
 "B": _Engine_SpellCheck,
 "C": _Engine_StrokeEllipse,
 "D": _Engine_StrokeRectangle,
 "E": _SDL_GetTicks,
 "F": _SDL_Init,
 "G": _SDL_LockSurface,
 "H": _SDL_PollEvent,
 "I": _SDL_SetVideoMode,
 "J": __ZSt18uncaught_exceptionv,
 "K": ___cxa_allocate_exception,
 "L": ___cxa_begin_catch,
 "M": ___cxa_find_matching_catch,
 "N": ___cxa_free_exception,
 "O": ___cxa_throw,
 "P": ___gxx_personality_v0,
 "Q": ___lock,
 "R": ___resumeException,
 "S": ___setErrNo,
 "T": ___syscall140,
 "U": ___syscall146,
 "V": ___syscall221,
 "W": ___syscall3,
 "X": ___syscall5,
 "Y": ___syscall54,
 "Z": ___syscall6,
 "_": ___unlock,
 "$": _abort,
 "aa": _emscripten_get_heap_size,
 "ab": _emscripten_get_now,
 "ac": _emscripten_memcpy_big,
 "ad": _emscripten_resize_heap,
 "ae": _emscripten_set_main_loop,
 "af": _emscripten_set_main_loop_timing,
 "ag": _getCanvasHeight,
 "ah": _getCanvasWidth,
 "ai": _pthread_getspecific,
 "aj": _pthread_key_create,
 "ak": _pthread_once,
 "al": _pthread_setspecific,
 "am": abortOnCannotGrowMemory,
 "an": tempDoublePtr,
 "ao": DYNAMICTOP_PTR
};

// EMSCRIPTEN_START_ASM


var asm = (/** @suppress {uselessCode} */ function(global,env,buffer) {
"use asm";var a=new global.Int8Array(buffer),b=new global.Int16Array(buffer),c=new global.Int32Array(buffer),d=new global.Uint8Array(buffer),e=new global.Uint16Array(buffer),f=new global.Float32Array(buffer),g=new global.Float64Array(buffer),h=env.an|0,i=env.ao|0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0.0,r=global.Math.floor,s=global.Math.abs,t=global.Math.exp,u=global.Math.ceil,v=global.Math.imul,w=global.Math.clz32,x=env.a,y=env.b,z=env.c,A=env.d,B=env.e,C=env.f,D=env.g,E=env.h,F=env.i,G=env.j,H=env.k,I=env.l,J=env.m,K=env.n,L=env.o,M=env.p,N=env.q,O=env.r,P=env.s,Q=env.t,R=env.u,S=env.v,T=env.w,U=env.x,V=env.y,W=env.z,X=env.A,Y=env.B,Z=env.C,_=env.D,$=env.E,aa=env.F,ba=env.G,ca=env.H,da=env.I,ea=env.J,fa=env.K,ga=env.L,ha=env.M,ia=env.N,ja=env.O,ka=env.P,la=env.Q,ma=env.R,na=env.S,oa=env.T,pa=env.U,qa=env.V,ra=env.W,sa=env.X,ta=env.Y,ua=env.Z,va=env._,wa=env.$,xa=env.aa,ya=env.ab,za=env.ac,Aa=env.ad,Ba=env.ae,Ca=env.af,Da=env.ag,Ea=env.ah,Fa=env.ai,Ga=env.aj,Ha=env.ak,Ia=env.al,Ja=env.am,Ka=19088,La=5261968,Ma=0.0;
// EMSCRIPTEN_START_FUNCS
function _a(a){a=a|0;var b=0;b=Ka;Ka=Ka+a|0;Ka=Ka+15&-16;if((Ka|0)>=(La|0))A(a|0);return b|0}function $a(){return Ka|0}function ab(a){a=a|0;Ka=a}function bb(a,b){a=a|0;b=b|0;Ka=a;La=b}function cb(){return 5976}function db(){return 6074}function eb(){var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ba=0,ca=0,da=0,ea=0,fa=0,ga=0,ha=0,ia=0,ja=0,ka=0,la=0,ma=0,na=0,oa=0,pa=0,qa=0,ra=0,sa=0,ta=0,ua=0,va=0,wa=0,xa=0,ya=0,za=0,Aa=0,Ba=0,Ca=0,Da=0,Ea=0,Fa=0,Ga=0,Ha=0,Ia=0,Ja=0,Ma=0,Na=0,Oa=0,Pa=0,Qa=0,Ra=0,Sa=0,Ta=0,Ua=0,Va=0,Wa=0,Xa=0,Ya=0,Za=0,_a=0,$a=0,ab=0,bb=0,cb=0,db=0,eb=0,gb=0,hb=0,ib=0,jb=0,kb=0,lb=0,nb=0,ob=0,pb=0,qb=0,rb=0,sb=0,tb=0,ub=0,vb=0,wb=0,xb=0,yb=0,zb=0,Ab=0,Bb=0,Cb=0,Db=0,Eb=0,Fb=0,Gb=0,Hb=0,Ib=0,Jb=0,Kb=0,Lb=0,Mb=0,Nb=0,Ob=0,Pb=0,Qb=0,Rb=0,Sb=0,Tb=0,Ub=0,Vb=0,Wb=0,Xb=0,Yb=0,Zb=0,_b=0,$b=0,ac=0,bc=0,cc=0,dc=0,ec=0,fc=0,gc=0,hc=0,ic=0,jc=0,kc=0,lc=0,mc=0,nc=0,oc=0,pc=0,qc=0,rc=0,sc=0,tc=0,uc=0,vc=0,wc=0,xc=0;b=Ka;Ka=Ka+3360|0;if((Ka|0)>=(La|0))A(3360);d=b+3352|0;e=b+96|0;f=b+3328|0;g=b+3320|0;h=b+2968|0;i=b+80|0;j=b+3296|0;k=b+3288|0;l=b+2936|0;m=b+2888|0;n=b+3264|0;o=b+3256|0;p=b+2856|0;q=b+2844|0;r=b+3232|0;s=b+3224|0;t=b+2792|0;u=b+2768|0;v=b+3200|0;w=b+3192|0;x=b+2736|0;y=b+2720|0;z=b+3168|0;B=b+3160|0;C=b+2688|0;D=b+2656|0;E=b+3136|0;F=b+3128|0;G=b+2616|0;H=b+2604|0;I=b+3104|0;J=b+3096|0;K=b+2552|0;L=b+64|0;M=b+3072|0;N=b+3064|0;O=b+2512|0;P=b+2496|0;Q=b+3040|0;R=b+3032|0;S=b+2464|0;T=b+2416|0;U=b+3008|0;V=b+3e3|0;W=b+2384|0;X=b+2368|0;Y=b+2912|0;Z=b+2904|0;_=b+2336|0;$=b+2288|0;aa=b+2824|0;ba=b+2784|0;ca=b+2256|0;da=b+2244|0;ea=b+2668|0;fa=b+2648|0;ga=b+2192|0;ha=b+2168|0;ia=b+2584|0;ja=b+2544|0;ka=b+2136|0;la=b+2120|0;ma=b+2440|0;na=b+2432|0;oa=b+2088|0;pa=b+2056|0;qa=b+2312|0;ra=b+2304|0;sa=b+2016|0;ta=b+2e3|0;ua=b+2224|0;va=b+2184|0;wa=b+1968|0;xa=b+1920|0;ya=b+2068|0;za=b+2048|0;Aa=b+1888|0;Ba=b+1872|0;Ca=b+1944|0;Da=b+1936|0;Ea=b+1840|0;Fa=b+1792|0;Ga=b+1816|0;Ha=b+1808|0;Ia=b+1760|0;Ja=b+1744|0;Ma=b+1688|0;Na=b+1680|0;Oa=b+1712|0;Pa=b+48|0;Qa=b+1624|0;Ra=b+1584|0;Sa=b+1648|0;Ta=b+32|0;Ua=b+1504|0;Va=b+1448|0;Wa=b+1592|0;Xa=b+1568|0;Ya=b+1384|0;Za=b+1328|0;_a=b+1536|0;$a=b+1524|0;ab=b+1272|0;bb=b+1216|0;cb=b+1472|0;db=b+1456|0;eb=b+1152|0;gb=b+1096|0;hb=b+1416|0;ib=b+1404|0;jb=b+996|0;kb=b+976|0;lb=b+1352|0;nb=b+1336|0;ob=b+920|0;pb=b+880|0;qb=b+1296|0;rb=b+16|0;sb=b+800|0;tb=b+744|0;ub=b+1240|0;vb=b+1224|0;wb=b+640|0;xb=b+632|0;yb=b+1184|0;zb=b+1172|0;Ab=b+552|0;Bb=b+512|0;Cb=b+1120|0;Db=b+1104|0;Eb=b+440|0;Fb=b+432|0;Gb=b+1064|0;Hb=b+1048|0;Ib=b+408|0;Jb=b+400|0;Kb=b+1016|0;Lb=b+984|0;Mb=b+376|0;Nb=b+368|0;Ob=b+944|0;Pb=b;Qb=b+344|0;Rb=b+336|0;Sb=b+888|0;Tb=b+864|0;Ub=b+312|0;Vb=b+304|0;Wb=b+832|0;Xb=b+820|0;Yb=b+280|0;Zb=b+272|0;_b=b+768|0;$b=b+752|0;ac=b+248|0;bc=b+240|0;cc=b+712|0;dc=b+696|0;ec=b+216|0;fc=b+208|0;gc=b+664|0;hc=b+616|0;ic=b+184|0;jc=b+176|0;kc=b+584|0;lc=b+572|0;mc=b+152|0;nc=b+144|0;oc=b+520|0;pc=b+496|0;qc=b+120|0;rc=b+112|0;sc=b+464|0;c[e>>2]=0;c[e+4>>2]=0;c[e+8>>2]=0;tc=e+11|0;a[tc>>0]=8;uc=e;c[uc>>2]=1802724708;c[uc+4>>2]=1735815982;a[e+8>>0]=0;c[h>>2]=1;uc=h+4|0;c[uc>>2]=0;c[uc+4>>2]=0;c[uc+8>>2]=0;a[uc+11>>0]=4;c[uc>>2]=1802724708;a[h+8>>0]=0;c[h+16>>2]=3;uc=h+20|0;c[uc>>2]=0;c[uc+4>>2]=0;c[uc+8>>2]=0;vc=jh(16)|0;c[uc>>2]=vc;c[h+28>>2]=-2147483632;c[h+24>>2]=12;uc=vc;wc=6186;xc=uc+12|0;do{a[uc>>0]=a[wc>>0]|0;uc=uc+1|0;wc=wc+1|0}while((uc|0)<(xc|0));a[vc+12>>0]=0;c[g>>2]=h;c[g+4>>2]=2;c[d>>2]=c[g>>2];c[d+4>>2]=c[g+4>>2];fb(f,d);sh(13072,e);mb(13084,f);c[i>>2]=0;c[i+4>>2]=0;c[i+8>>2]=0;g=i+11|0;a[g>>0]=8;vc=i;c[vc>>2]=1852993379;c[vc+4>>2]=1735815982;a[i+8>>0]=0;c[l>>2]=1;vc=l+4|0;c[vc>>2]=0;c[vc+4>>2]=0;c[vc+8>>2]=0;a[vc+11>>0]=4;c[vc>>2]=1852993379;a[l+8>>0]=0;c[l+16>>2]=3;vc=l+20|0;c[vc>>2]=0;c[vc+4>>2]=0;c[vc+8>>2]=0;a[vc+11>>0]=4;c[vc>>2]=1936286029;a[l+24>>0]=0;c[k>>2]=l;c[k+4>>2]=2;c[d>>2]=c[k>>2];c[d+4>>2]=c[k+4>>2];fb(j,d);sh(13104,i);mb(13116,j);c[m>>2]=0;c[m+4>>2]=0;c[m+8>>2]=0;k=jh(16)|0;c[m>>2]=k;c[m+8>>2]=-2147483632;c[m+4>>2]=12;uc=k;wc=6199;xc=uc+12|0;do{a[uc>>0]=a[wc>>0]|0;uc=uc+1|0;wc=wc+1|0}while((uc|0)<(xc|0));a[k+12>>0]=0;c[p>>2]=1;k=p+4|0;c[k>>2]=0;c[k+4>>2]=0;c[k+8>>2]=0;a[k+11>>0]=8;vc=k;c[vc>>2]=1886546273;c[vc+4>>2]=1701732716;a[p+12>>0]=0;c[p+16>>2]=3;vc=p+20|0;c[vc>>2]=0;c[vc+4>>2]=0;c[vc+8>>2]=0;a[vc+11>>0]=8;k=vc;c[k>>2]=1735748678;c[k+4>>2]=1735746938;a[p+28>>0]=0;c[o>>2]=p;c[o+4>>2]=2;c[d>>2]=c[o>>2];c[d+4>>2]=c[o+4>>2];fb(n,d);sh(13136,m);mb(13148,n);c[q>>2]=0;c[q+4>>2]=0;c[q+8>>2]=0;o=jh(16)|0;c[q>>2]=o;c[q+8>>2]=-2147483632;c[q+4>>2]=13;uc=o;wc=6212;xc=uc+13|0;do{a[uc>>0]=a[wc>>0]|0;uc=uc+1|0;wc=wc+1|0}while((uc|0)<(xc|0));a[o+13>>0]=0;c[t>>2]=1;o=t+4|0;c[o>>2]=0;c[o+4>>2]=0;c[o+8>>2]=0;a[o+11>>0]=9;uc=o;wc=6226;xc=uc+9|0;do{a[uc>>0]=a[wc>>0]|0;uc=uc+1|0;wc=wc+1|0}while((uc|0)<(xc|0));a[o+9>>0]=0;c[t+16>>2]=3;o=t+20|0;c[o>>2]=0;c[o+4>>2]=0;c[o+8>>2]=0;k=jh(16)|0;c[o>>2]=k;c[t+28>>2]=-2147483632;c[t+24>>2]=12;uc=k;wc=6236;xc=uc+12|0;do{a[uc>>0]=a[wc>>0]|0;uc=uc+1|0;wc=wc+1|0}while((uc|0)<(xc|0));a[k+12>>0]=0;c[s>>2]=t;c[s+4>>2]=2;c[d>>2]=c[s>>2];c[d+4>>2]=c[s+4>>2];fb(r,d);sh(13168,q);mb(13180,r);c[u>>2]=0;c[u+4>>2]=0;c[u+8>>2]=0;s=jh(16)|0;c[u>>2]=s;c[u+8>>2]=-2147483632;c[u+4>>2]=11;uc=s;wc=6249;xc=uc+11|0;do{a[uc>>0]=a[wc>>0]|0;uc=uc+1|0;wc=wc+1|0}while((uc|0)<(xc|0));a[s+11>>0]=0;c[x>>2]=1;s=x+4|0;c[x+12>>2]=0;a[s+11>>0]=7;a[s>>0]=a[6261]|0;a[s+1>>0]=a[6262]|0;a[s+2>>0]=a[6263]|0;a[s+3>>0]=a[6264]|0;a[s+4>>0]=a[6265]|0;a[s+5>>0]=a[6266]|0;a[s+6>>0]=a[6267]|0;a[s+7>>0]=0;c[x+16>>2]=3;s=x+20|0;c[x+28>>2]=0;a[s+11>>0]=7;a[s>>0]=a[6269]|0;a[s+1>>0]=a[6270]|0;a[s+2>>0]=a[6271]|0;a[s+3>>0]=a[6272]|0;a[s+4>>0]=a[6273]|0;a[s+5>>0]=a[6274]|0;a[s+6>>0]=a[6275]|0;a[s+7>>0]=0;c[w>>2]=x;c[w+4>>2]=2;c[d>>2]=c[w>>2];c[d+4>>2]=c[w+4>>2];fb(v,d);sh(13200,u);mb(13212,v);c[y>>2]=0;c[y+4>>2]=0;c[y+8>>2]=0;w=jh(16)|0;c[y>>2]=w;c[y+8>>2]=-2147483632;c[y+4>>2]=11;uc=w;wc=6277;xc=uc+11|0;do{a[uc>>0]=a[wc>>0]|0;uc=uc+1|0;wc=wc+1|0}while((uc|0)<(xc|0));a[w+11>>0]=0;c[C>>2]=1;w=C+4|0;c[C+12>>2]=0;a[w+11>>0]=7;a[w>>0]=a[6289]|0;a[w+1>>0]=a[6290]|0;a[w+2>>0]=a[6291]|0;a[w+3>>0]=a[6292]|0;a[w+4>>0]=a[6293]|0;a[w+5>>0]=a[6294]|0;a[w+6>>0]=a[6295]|0;a[w+7>>0]=0;c[C+16>>2]=3;w=C+20|0;c[C+28>>2]=0;a[w+11>>0]=7;a[w>>0]=a[6297]|0;a[w+1>>0]=a[6298]|0;a[w+2>>0]=a[6299]|0;a[w+3>>0]=a[6300]|0;a[w+4>>0]=a[6301]|0;a[w+5>>0]=a[6302]|0;a[w+6>>0]=a[6303]|0;a[w+7>>0]=0;c[B>>2]=C;c[B+4>>2]=2;c[d>>2]=c[B>>2];c[d+4>>2]=c[B+4>>2];fb(z,d);sh(13232,y);mb(13244,z);c[D+8>>2]=0;B=D+11|0;a[B>>0]=7;a[D>>0]=a[6305]|0;a[D+1>>0]=a[6306]|0;a[D+2>>0]=a[6307]|0;a[D+3>>0]=a[6308]|0;a[D+4>>0]=a[6309]|0;a[D+5>>0]=a[6310]|0;a[D+6>>0]=a[6311]|0;a[D+7>>0]=0;c[G>>2]=1;w=G+4|0;s=G+8|0;c[s>>2]=0;c[s+4>>2]=0;a[w+11>>0]=3;a[w>>0]=a[6313]|0;a[w+1>>0]=a[6314]|0;a[w+2>>0]=a[6315]|0;a[w+3>>0]=0;c[G+16>>2]=3;w=G+20|0;c[w>>2]=0;c[w+4>>2]=0;c[w+8>>2]=0;a[w+11>>0]=4;c[w>>2]=1953785154;a[G+24>>0]=0;c[F>>2]=G;c[F+4>>2]=2;c[d>>2]=c[F>>2];c[d+4>>2]=c[F+4>>2];fb(E,d);sh(13264,D);mb(13276,E);c[H>>2]=0;c[H+4>>2]=0;c[H+8>>2]=0;F=jh(16)|0;c[H>>2]=F;c[H+8>>2]=-2147483632;c[H+4>>2]=11;uc=F;wc=6317;xc=uc+11|0;do{a[uc>>0]=a[wc>>0]|0;uc=uc+1|0;wc=wc+1|0}while((uc|0)<(xc|0));a[F+11>>0]=0;c[K>>2]=1;F=K+4|0;c[K+12>>2]=0;a[F+11>>0]=7;a[F>>0]=a[6329]|0;a[F+1>>0]=a[6330]|0;a[F+2>>0]=a[6331]|0;a[F+3>>0]=a[6332]|0;a[F+4>>0]=a[6333]|0;a[F+5>>0]=a[6334]|0;a[F+6>>0]=a[6335]|0;a[F+7>>0]=0;c[K+16>>2]=3;F=K+20|0;c[K+28>>2]=0;a[F+11>>0]=7;a[F>>0]=a[6337]|0;a[F+1>>0]=a[6338]|0;a[F+2>>0]=a[6339]|0;a[F+3>>0]=a[6340]|0;a[F+4>>0]=a[6341]|0;a[F+5>>0]=a[6342]|0;a[F+6>>0]=a[6343]|0;a[F+7>>0]=0;c[J>>2]=K;c[J+4>>2]=2;c[d>>2]=c[J>>2];c[d+4>>2]=c[J+4>>2];fb(I,d);sh(13296,H);mb(13308,I);c[L>>2]=0;c[L+4>>2]=0;c[L+8>>2]=0;J=L+11|0;a[J>>0]=8;F=L;c[F>>2]=1952542562;c[F+4>>2]=1735290926;a[L+8>>0]=0;c[O>>2]=1;F=O+4|0;c[F>>2]=0;c[F+4>>2]=0;c[F+8>>2]=0;a[F+11>>0]=4;c[F>>2]=1952542562;a[O+8>>0]=0;c[O+16>>2]=3;F=O+20|0;c[F>>2]=0;c[F+4>>2]=0;c[F+8>>2]=0;a[F+11>>0]=4;c[F>>2]=1953460034;a[O+24>>0]=0;c[N>>2]=O;c[N+4>>2]=2;c[d>>2]=c[N>>2];c[d+4>>2]=c[N+4>>2];fb(M,d);sh(13328,L);mb(13340,M);c[P>>2]=0;c[P+4>>2]=0;c[P+8>>2]=0;N=jh(16)|0;c[P>>2]=N;c[P+8>>2]=-2147483632;c[P+4>>2]=12;uc=N;wc=6345;xc=uc+12|0;do{a[uc>>0]=a[wc>>0]|0;uc=uc+1|0;wc=wc+1|0}while((uc|0)<(xc|0));a[N+12>>0]=0;c[S>>2]=1;N=S+4|0;c[N>>2]=0;c[N+4>>2]=0;c[N+8>>2]=0;a[N+11>>0]=8;F=N;c[F>>2]=1668248162;c[F+4>>2]=1768714083;a[S+12>>0]=0;c[S+16>>2]=3;F=S+20|0;c[F>>2]=0;c[F+4>>2]=0;c[F+8>>2]=0;a[F+11>>0]=8;N=F;c[N>>2]=1802465858;c[N+4>>2]=1768714091;a[S+28>>0]=0;c[R>>2]=S;c[R+4>>2]=2;c[d>>2]=c[R>>2];c[d+4>>2]=c[R+4>>2];fb(Q,d);sh(13360,P);mb(13372,Q);c[T+8>>2]=0;R=T+11|0;a[R>>0]=7;a[T>>0]=a[6358]|0;a[T+1>>0]=a[6359]|0;a[T+2>>0]=a[6360]|0;a[T+3>>0]=a[6361]|0;a[T+4>>0]=a[6362]|0;a[T+5>>0]=a[6363]|0;a[T+6>>0]=a[6364]|0;a[T+7>>0]=0;c[W>>2]=1;N=W+4|0;F=W+8|0;c[F>>2]=0;c[F+4>>2]=0;a[N+11>>0]=3;a[N>>0]=a[6366]|0;a[N+1>>0]=a[6367]|0;a[N+2>>0]=a[6368]|0;a[N+3>>0]=0;c[W+16>>2]=3;N=W+20|0;F=W+24|0;c[F>>2]=0;c[F+4>>2]=0;a[N+11>>0]=3;a[N>>0]=a[6370]|0;a[N+1>>0]=a[6371]|0;a[N+2>>0]=a[6372]|0;a[N+3>>0]=0;c[V>>2]=W;c[V+4>>2]=2;c[d>>2]=c[V>>2];c[d+4>>2]=c[V+4>>2];fb(U,d);sh(13392,T);mb(13404,U);c[X+8>>2]=0;V=X+11|0;a[V>>0]=7;a[X>>0]=a[6374]|0;a[X+1>>0]=a[6375]|0;a[X+2>>0]=a[6376]|0;a[X+3>>0]=a[6377]|0;a[X+4>>0]=a[6378]|0;a[X+5>>0]=a[6379]|0;a[X+6>>0]=a[6380]|0;a[X+7>>0]=0;c[_>>2]=1;N=_+4|0;F=_+8|0;c[F>>2]=0;c[F+4>>2]=0;a[N+11>>0]=3;a[N>>0]=a[6382]|0;a[N+1>>0]=a[6383]|0;a[N+2>>0]=a[6384]|0;a[N+3>>0]=0;c[_+16>>2]=3;N=_+20|0;c[N>>2]=0;c[N+4>>2]=0;c[N+8>>2]=0;a[N+11>>0]=4;c[N>>2]=1869903169;a[_+24>>0]=0;c[Z>>2]=_;c[Z+4>>2]=2;c[d>>2]=c[Z>>2];c[d+4>>2]=c[Z+4>>2];fb(Y,d);sh(13424,X);mb(13436,Y);c[$>>2]=0;c[$+4>>2]=0;c[$+8>>2]=0;Z=$+11|0;a[Z>>0]=9;uc=$;wc=6386;xc=uc+9|0;do{a[uc>>0]=a[wc>>0]|0;uc=uc+1|0;wc=wc+1|0}while((uc|0)<(xc|0));a[$+9>>0]=0;c[ca>>2]=1;N=ca+4|0;c[N>>2]=0;c[N+4>>2]=0;c[N+8>>2]=0;a[N+11>>0]=5;a[N>>0]=a[6396]|0;a[N+1>>0]=a[6397]|0;a[N+2>>0]=a[6398]|0;a[N+3>>0]=a[6399]|0;a[N+4>>0]=a[6400]|0;a[N+5>>0]=0;c[ca+16>>2]=3;N=ca+20|0;c[N>>2]=0;c[N+4>>2]=0;c[N+8>>2]=0;a[N+11>>0]=5;a[N>>0]=a[6402]|0;a[N+1>>0]=a[6403]|0;a[N+2>>0]=a[6404]|0;a[N+3>>0]=a[6405]|0;a[N+4>>0]=a[6406]|0;a[N+5>>0]=0;c[ba>>2]=ca;c[ba+4>>2]=2;c[d>>2]=c[ba>>2];c[d+4>>2]=c[ba+4>>2];fb(aa,d);sh(13456,$);mb(13468,aa);c[da>>2]=0;c[da+4>>2]=0;c[da+8>>2]=0;ba=jh(16)|0;c[da>>2]=ba;c[da+8>>2]=-2147483632;c[da+4>>2]=12;uc=ba;wc=6408;xc=uc+12|0;do{a[uc>>0]=a[wc>>0]|0;uc=uc+1|0;wc=wc+1|0}while((uc|0)<(xc|0));a[ba+12>>0]=0;c[ga>>2]=1;ba=ga+4|0;c[ba>>2]=0;c[ba+4>>2]=0;c[ba+8>>2]=0;a[ba+11>>0]=8;N=ba;c[N>>2]=1919248483;c[N+4>>2]=1936025970;a[ga+12>>0]=0;c[ga+16>>2]=3;N=ga+20|0;c[N>>2]=0;c[N+4>>2]=0;c[N+8>>2]=0;a[N+11>>0]=8;ba=N;c[ba>>2]=1936877899;c[ba+4>>2]=1852139619;a[ga+28>>0]=0;c[fa>>2]=ga;c[fa+4>>2]=2;c[d>>2]=c[fa>>2];c[d+4>>2]=c[fa+4>>2];fb(ea,d);sh(13488,da);mb(13500,ea);c[ha>>2]=0;c[ha+4>>2]=0;c[ha+8>>2]=0;fa=jh(16)|0;c[ha>>2]=fa;c[ha+8>>2]=-2147483632;c[ha+4>>2]=11;uc=fa;wc=6421;xc=uc+11|0;do{a[uc>>0]=a[wc>>0]|0;uc=uc+1|0;wc=wc+1|0}while((uc|0)<(xc|0));a[fa+11>>0]=0;c[ka>>2]=1;fa=ka+4|0;c[ka+12>>2]=0;a[fa+11>>0]=7;a[fa>>0]=a[6433]|0;a[fa+1>>0]=a[6434]|0;a[fa+2>>0]=a[6435]|0;a[fa+3>>0]=a[6436]|0;a[fa+4>>0]=a[6437]|0;a[fa+5>>0]=a[6438]|0;a[fa+6>>0]=a[6439]|0;a[fa+7>>0]=0;c[ka+16>>2]=3;fa=ka+20|0;c[fa>>2]=0;c[fa+4>>2]=0;c[fa+8>>2]=0;a[fa+11>>0]=9;uc=fa;wc=6441;xc=uc+9|0;do{a[uc>>0]=a[wc>>0]|0;uc=uc+1|0;wc=wc+1|0}while((uc|0)<(xc|0));a[fa+9>>0]=0;c[ja>>2]=ka;c[ja+4>>2]=2;c[d>>2]=c[ja>>2];c[d+4>>2]=c[ja+4>>2];fb(ia,d);sh(13520,ha);mb(13532,ia);c[la>>2]=0;c[la+4>>2]=0;c[la+8>>2]=0;ja=jh(16)|0;c[la>>2]=ja;c[la+8>>2]=-2147483632;c[la+4>>2]=12;uc=ja;wc=6451;xc=uc+12|0;do{a[uc>>0]=a[wc>>0]|0;uc=uc+1|0;wc=wc+1|0}while((uc|0)<(xc|0));a[ja+12>>0]=0;c[oa>>2]=1;ja=oa+4|0;c[ja>>2]=0;c[ja+4>>2]=0;c[ja+8>>2]=0;a[ja+11>>0]=8;fa=ja;c[fa>>2]=1836413540;c[fa+4>>2]=1952805664;a[oa+12>>0]=0;c[oa+16>>2]=3;fa=oa+20|0;a[fa+11>>0]=10;uc=fa;wc=6464;xc=uc+10|0;do{a[uc>>0]=a[wc>>0]|0;uc=uc+1|0;wc=wc+1|0}while((uc|0)<(xc|0));a[fa+10>>0]=0;c[na>>2]=oa;c[na+4>>2]=2;c[d>>2]=c[na>>2];c[d+4>>2]=c[na+4>>2];fb(ma,d);sh(13552,la);mb(13564,ma);c[pa>>2]=0;c[pa+4>>2]=0;c[pa+8>>2]=0;na=jh(16)|0;c[pa>>2]=na;c[pa+8>>2]=-2147483632;c[pa+4>>2]=14;uc=na;wc=6475;xc=uc+14|0;do{a[uc>>0]=a[wc>>0]|0;uc=uc+1|0;wc=wc+1|0}while((uc|0)<(xc|0));a[na+14>>0]=0;c[sa>>2]=1;na=sa+4|0;a[na+11>>0]=10;uc=na;wc=6490;xc=uc+10|0;do{a[uc>>0]=a[wc>>0]|0;uc=uc+1|0;wc=wc+1|0}while((uc|0)<(xc|0));a[na+10>>0]=0;c[sa+16>>2]=3;na=sa+20|0;c[na>>2]=0;c[na+4>>2]=0;c[na+8>>2]=0;fa=jh(16)|0;c[na>>2]=fa;c[sa+28>>2]=-2147483632;c[sa+24>>2]=13;uc=fa;wc=6501;xc=uc+13|0;do{a[uc>>0]=a[wc>>0]|0;uc=uc+1|0;wc=wc+1|0}while((uc|0)<(xc|0));a[fa+13>>0]=0;c[ra>>2]=sa;c[ra+4>>2]=2;c[d>>2]=c[ra>>2];c[d+4>>2]=c[ra+4>>2];fb(qa,d);sh(13584,pa);mb(13596,qa);ra=ta+11|0;a[ra>>0]=10;uc=ta;wc=6515;xc=uc+10|0;do{a[uc>>0]=a[wc>>0]|0;uc=uc+1|0;wc=wc+1|0}while((uc|0)<(xc|0));a[ta+10>>0]=0;c[wa>>2]=1;fa=wa+4|0;c[fa>>2]=0;c[fa+4>>2]=0;c[fa+8>>2]=0;a[fa+11>>0]=6;a[fa>>0]=a[6526]|0;a[fa+1>>0]=a[6527]|0;a[fa+2>>0]=a[6528]|0;a[fa+3>>0]=a[6529]|0;a[fa+4>>0]=a[6530]|0;a[fa+5>>0]=a[6531]|0;a[fa+6>>0]=0;c[wa+16>>2]=3;fa=wa+20|0;c[fa>>2]=0;c[fa+4>>2]=0;c[fa+8>>2]=0;a[fa+11>>0]=9;uc=fa;wc=6533;xc=uc+9|0;do{a[uc>>0]=a[wc>>0]|0;uc=uc+1|0;wc=wc+1|0}while((uc|0)<(xc|0));a[fa+9>>0]=0;c[va>>2]=wa;c[va+4>>2]=2;c[d>>2]=c[va>>2];c[d+4>>2]=c[va+4>>2];fb(ua,d);sh(13616,ta);mb(13628,ua);va=xa+11|0;a[va>>0]=10;uc=xa;wc=6543;xc=uc+10|0;do{a[uc>>0]=a[wc>>0]|0;uc=uc+1|0;wc=wc+1|0}while((uc|0)<(xc|0));a[xa+10>>0]=0;c[Aa>>2]=1;fa=Aa+4|0;c[fa>>2]=0;c[fa+4>>2]=0;c[fa+8>>2]=0;a[fa+11>>0]=6;a[fa>>0]=a[6554]|0;a[fa+1>>0]=a[6555]|0;a[fa+2>>0]=a[6556]|0;a[fa+3>>0]=a[6557]|0;a[fa+4>>0]=a[6558]|0;a[fa+5>>0]=a[6559]|0;a[fa+6>>0]=0;c[Aa+16>>2]=3;fa=Aa+20|0;c[fa>>2]=0;c[fa+4>>2]=0;c[fa+8>>2]=0;a[fa+11>>0]=6;a[fa>>0]=a[6561]|0;a[fa+1>>0]=a[6562]|0;a[fa+2>>0]=a[6563]|0;a[fa+3>>0]=a[6564]|0;a[fa+4>>0]=a[6565]|0;a[fa+5>>0]=a[6566]|0;a[fa+6>>0]=0;c[za>>2]=Aa;c[za+4>>2]=2;c[d>>2]=c[za>>2];c[d+4>>2]=c[za+4>>2];fb(ya,d);sh(13648,xa);mb(13660,ya);za=Ba+11|0;a[za>>0]=10;uc=Ba;wc=6568;xc=uc+10|0;do{a[uc>>0]=a[wc>>0]|0;uc=uc+1|0;wc=wc+1|0}while((uc|0)<(xc|0));a[Ba+10>>0]=0;c[Ea>>2]=1;fa=Ea+4|0;c[fa>>2]=0;c[fa+4>>2]=0;c[fa+8>>2]=0;a[fa+11>>0]=6;a[fa>>0]=a[6579]|0;a[fa+1>>0]=a[6580]|0;a[fa+2>>0]=a[6581]|0;a[fa+3>>0]=a[6582]|0;a[fa+4>>0]=a[6583]|0;a[fa+5>>0]=a[6584]|0;a[fa+6>>0]=0;c[Ea+16>>2]=3;fa=Ea+20|0;c[Ea+28>>2]=0;a[fa+11>>0]=7;a[fa>>0]=a[6586]|0;a[fa+1>>0]=a[6587]|0;a[fa+2>>0]=a[6588]|0;a[fa+3>>0]=a[6589]|0;a[fa+4>>0]=a[6590]|0;a[fa+5>>0]=a[6591]|0;a[fa+6>>0]=a[6592]|0;a[fa+7>>0]=0;c[Da>>2]=Ea;c[Da+4>>2]=2;c[d>>2]=c[Da>>2];c[d+4>>2]=c[Da+4>>2];fb(Ca,d);sh(13680,Ba);mb(13692,Ca);Da=Fa+11|0;a[Da>>0]=10;uc=Fa;wc=6594;xc=uc+10|0;do{a[uc>>0]=a[wc>>0]|0;uc=uc+1|0;wc=wc+1|0}while((uc|0)<(xc|0));a[Fa+10>>0]=0;c[Ia>>2]=1;fa=Ia+4|0;c[fa>>2]=0;c[fa+4>>2]=0;c[fa+8>>2]=0;a[fa+11>>0]=6;a[fa>>0]=a[6605]|0;a[fa+1>>0]=a[6606]|0;a[fa+2>>0]=a[6607]|0;a[fa+3>>0]=a[6608]|0;a[fa+4>>0]=a[6609]|0;a[fa+5>>0]=a[6610]|0;a[fa+6>>0]=0;c[Ia+16>>2]=3;fa=Ia+20|0;c[Ia+28>>2]=0;a[fa+11>>0]=7;a[fa>>0]=a[6612]|0;a[fa+1>>0]=a[6613]|0;a[fa+2>>0]=a[6614]|0;a[fa+3>>0]=a[6615]|0;a[fa+4>>0]=a[6616]|0;a[fa+5>>0]=a[6617]|0;a[fa+6>>0]=a[6618]|0;a[fa+7>>0]=0;c[Ha>>2]=Ia;c[Ha+4>>2]=2;c[d>>2]=c[Ha>>2];c[d+4>>2]=c[Ha+4>>2];fb(Ga,d);sh(13712,Fa);mb(13724,Ga);c[Ja>>2]=0;c[Ja+4>>2]=0;c[Ja+8>>2]=0;Ha=jh(16)|0;c[Ja>>2]=Ha;c[Ja+8>>2]=-2147483632;c[Ja+4>>2]=14;uc=Ha;wc=6620;xc=uc+14|0;do{a[uc>>0]=a[wc>>0]|0;uc=uc+1|0;wc=wc+1|0}while((uc|0)<(xc|0));a[Ha+14>>0]=0;c[Oa>>2]=1;Ha=Oa+4|0;a[Ha+11>>0]=10;uc=Ha;wc=6635;xc=uc+10|0;do{a[uc>>0]=a[wc>>0]|0;uc=uc+1|0;wc=wc+1|0}while((uc|0)<(xc|0));a[Ha+10>>0]=0;c[Oa+16>>2]=3;Ha=Oa+20|0;c[Ha>>2]=0;c[Ha+4>>2]=0;c[Ha+8>>2]=0;fa=jh(16)|0;c[Ha>>2]=fa;c[Oa+28>>2]=-2147483632;c[Oa+24>>2]=12;uc=fa;wc=6646;xc=uc+12|0;do{a[uc>>0]=a[wc>>0]|0;uc=uc+1|0;wc=wc+1|0}while((uc|0)<(xc|0));a[fa+12>>0]=0;c[Na>>2]=Oa;c[Na+4>>2]=2;c[d>>2]=c[Na>>2];c[d+4>>2]=c[Na+4>>2];fb(Ma,d);sh(13744,Ja);mb(13756,Ma);c[Pa>>2]=0;c[Pa+4>>2]=0;c[Pa+8>>2]=0;Na=Pa+11|0;a[Na>>0]=8;fa=Pa;c[fa>>2]=1769433451;c[fa+4>>2]=1735290926;a[Pa+8>>0]=0;c[Sa>>2]=1;fa=Sa+4|0;c[fa>>2]=0;c[fa+4>>2]=0;c[fa+8>>2]=0;a[fa+11>>0]=4;c[fa>>2]=1769433451;a[Sa+8>>0]=0;c[Sa+16>>2]=3;fa=Sa+20|0;c[fa>>2]=0;c[fa+4>>2]=0;c[fa+8>>2]=0;a[fa+11>>0]=4;c[fa>>2]=1769433419;a[Sa+24>>0]=0;c[Ra>>2]=Sa;c[Ra+4>>2]=2;c[d>>2]=c[Ra>>2];c[d+4>>2]=c[Ra+4>>2];fb(Qa,d);sh(13776,Pa);mb(13788,Qa);c[Ta>>2]=0;c[Ta+4>>2]=0;c[Ta+8>>2]=0;Ra=Ta+11|0;a[Ra>>0]=8;fa=Ta;c[fa>>2]=1886216556;c[fa+4>>2]=1735290926;a[Ta+8>>0]=0;c[Wa>>2]=1;fa=Wa+4|0;c[fa>>2]=0;c[fa+4>>2]=0;c[fa+8>>2]=0;a[fa+11>>0]=4;c[fa>>2]=1886216556;a[Wa+8>>0]=0;c[Wa+16>>2]=3;fa=Wa+20|0;c[fa>>2]=0;c[fa+4>>2]=0;c[fa+8>>2]=0;a[fa+11>>0]=5;a[fa>>0]=a[6659]|0;a[fa+1>>0]=a[6660]|0;a[fa+2>>0]=a[6661]|0;a[fa+3>>0]=a[6662]|0;a[fa+4>>0]=a[6663]|0;a[fa+5>>0]=0;c[Va>>2]=Wa;c[Va+4>>2]=2;c[d>>2]=c[Va>>2];c[d+4>>2]=c[Va+4>>2];fb(Ua,d);sh(13808,Ta);mb(13820,Ua);c[Xa>>2]=0;c[Xa+4>>2]=0;c[Xa+8>>2]=0;Va=Xa+11|0;a[Va>>0]=9;uc=Xa;wc=6665;xc=uc+9|0;do{a[uc>>0]=a[wc>>0]|0;uc=uc+1|0;wc=wc+1|0}while((uc|0)<(xc|0));a[Xa+9>>0]=0;c[_a>>2]=1;fa=_a+4|0;c[fa>>2]=0;c[fa+4>>2]=0;c[fa+8>>2]=0;a[fa+11>>0]=5;a[fa>>0]=a[6675]|0;a[fa+1>>0]=a[6676]|0;a[fa+2>>0]=a[6677]|0;a[fa+3>>0]=a[6678]|0;a[fa+4>>0]=a[6679]|0;a[fa+5>>0]=0;c[_a+16>>2]=3;fa=_a+20|0;c[_a+28>>2]=0;a[fa+11>>0]=7;a[fa>>0]=a[6681]|0;a[fa+1>>0]=a[6682]|0;a[fa+2>>0]=a[6683]|0;a[fa+3>>0]=a[6684]|0;a[fa+4>>0]=a[6685]|0;a[fa+5>>0]=a[6686]|0;a[fa+6>>0]=a[6687]|0;a[fa+7>>0]=0;c[Za>>2]=_a;c[Za+4>>2]=2;c[d>>2]=c[Za>>2];c[d+4>>2]=c[Za+4>>2];fb(Ya,d);sh(13840,Xa);mb(13852,Ya);c[$a>>2]=0;c[$a+4>>2]=0;c[$a+8>>2]=0;Za=$a+11|0;a[Za>>0]=9;uc=$a;wc=6689;xc=uc+9|0;do{a[uc>>0]=a[wc>>0]|0;uc=uc+1|0;wc=wc+1|0}while((uc|0)<(xc|0));a[$a+9>>0]=0;c[cb>>2]=1;fa=cb+4|0;c[fa>>2]=0;c[fa+4>>2]=0;c[fa+8>>2]=0;a[fa+11>>0]=5;a[fa>>0]=a[6699]|0;a[fa+1>>0]=a[6700]|0;a[fa+2>>0]=a[6701]|0;a[fa+3>>0]=a[6702]|0;a[fa+4>>0]=a[6703]|0;a[fa+5>>0]=0;c[cb+16>>2]=3;fa=cb+20|0;c[fa>>2]=0;c[fa+4>>2]=0;c[fa+8>>2]=0;a[fa+11>>0]=5;a[fa>>0]=a[6705]|0;a[fa+1>>0]=a[6706]|0;a[fa+2>>0]=a[6707]|0;a[fa+3>>0]=a[6708]|0;a[fa+4>>0]=a[6709]|0;a[fa+5>>0]=0;c[bb>>2]=cb;c[bb+4>>2]=2;c[d>>2]=c[bb>>2];c[d+4>>2]=c[bb+4>>2];fb(ab,d);sh(13872,$a);mb(13884,ab);c[db>>2]=0;c[db+4>>2]=0;c[db+8>>2]=0;bb=jh(16)|0;c[db>>2]=bb;c[db+8>>2]=-2147483632;c[db+4>>2]=14;uc=bb;wc=6711;xc=uc+14|0;do{a[uc>>0]=a[wc>>0]|0;uc=uc+1|0;wc=wc+1|0}while((uc|0)<(xc|0));a[bb+14>>0]=0;c[hb>>2]=1;bb=hb+4|0;a[bb+11>>0]=10;uc=bb;wc=6726;xc=uc+10|0;do{a[uc>>0]=a[wc>>0]|0;uc=uc+1|0;wc=wc+1|0}while((uc|0)<(xc|0));a[bb+10>>0]=0;c[hb+16>>2]=3;bb=hb+20|0;c[bb>>2]=0;c[bb+4>>2]=0;c[bb+8>>2]=0;a[bb+11>>0]=8;fa=bb;c[fa>>2]=1869901645;c[fa+4>>2]=1684107890;a[hb+28>>0]=0;c[gb>>2]=hb;c[gb+4>>2]=2;c[d>>2]=c[gb>>2];c[d+4>>2]=c[gb+4>>2];fb(eb,d);sh(13904,db);mb(13916,eb);c[ib>>2]=0;c[ib+4>>2]=0;c[ib+8>>2]=0;gb=jh(16)|0;c[ib>>2]=gb;c[ib+8>>2]=-2147483632;c[ib+4>>2]=12;uc=gb;wc=6737;xc=uc+12|0;do{a[uc>>0]=a[wc>>0]|0;uc=uc+1|0;wc=wc+1|0}while((uc|0)<(xc|0));a[gb+12>>0]=0;c[lb>>2]=1;gb=lb+4|0;c[gb>>2]=0;c[gb+4>>2]=0;c[gb+8>>2]=0;a[gb+11>>0]=8;fa=gb;c[fa>>2]=1752397165;c[fa+4>>2]=1836019570;a[lb+12>>0]=0;c[lb+16>>2]=3;fa=lb+20|0;c[fa>>2]=0;c[fa+4>>2]=0;c[fa+8>>2]=0;a[fa+11>>0]=4;c[fa>>2]=2053925200;a[lb+24>>0]=0;c[kb>>2]=lb;c[kb+4>>2]=2;c[d>>2]=c[kb>>2];c[d+4>>2]=c[kb+4>>2];fb(jb,d);sh(13936,ib);mb(13948,jb);kb=nb+11|0;a[kb>>0]=10;uc=nb;wc=6750;xc=uc+10|0;do{a[uc>>0]=a[wc>>0]|0;uc=uc+1|0;wc=wc+1|0}while((uc|0)<(xc|0));a[nb+10>>0]=0;c[qb>>2]=1;fa=qb+4|0;c[fa>>2]=0;c[fa+4>>2]=0;c[fa+8>>2]=0;a[fa+11>>0]=6;a[fa>>0]=a[6761]|0;a[fa+1>>0]=a[6762]|0;a[fa+2>>0]=a[6763]|0;a[fa+3>>0]=a[6764]|0;a[fa+4>>0]=a[6765]|0;a[fa+5>>0]=a[6766]|0;a[fa+6>>0]=0;c[qb+16>>2]=3;fa=qb+20|0;c[fa>>2]=0;c[fa+4>>2]=0;c[fa+8>>2]=0;a[fa+11>>0]=6;a[fa>>0]=a[6768]|0;a[fa+1>>0]=a[6769]|0;a[fa+2>>0]=a[6770]|0;a[fa+3>>0]=a[6771]|0;a[fa+4>>0]=a[6772]|0;a[fa+5>>0]=a[6773]|0;a[fa+6>>0]=0;c[pb>>2]=qb;c[pb+4>>2]=2;c[d>>2]=c[pb>>2];c[d+4>>2]=c[pb+4>>2];fb(ob,d);sh(13968,nb);mb(13980,ob);c[rb>>2]=0;c[rb+4>>2]=0;c[rb+8>>2]=0;pb=rb+11|0;a[pb>>0]=8;fa=rb;c[fa>>2]=1918985584;c[fa+4>>2]=1735815982;a[rb+8>>0]=0;c[ub>>2]=1;fa=ub+4|0;c[fa>>2]=0;c[fa+4>>2]=0;c[fa+8>>2]=0;a[fa+11>>0]=4;c[fa>>2]=1918985584;a[ub+8>>0]=0;c[ub+16>>2]=3;fa=ub+20|0;c[fa>>2]=0;c[fa+4>>2]=0;c[fa+8>>2]=0;a[fa+11>>0]=5;a[fa>>0]=a[6775]|0;a[fa+1>>0]=a[6776]|0;a[fa+2>>0]=a[6777]|0;a[fa+3>>0]=a[6778]|0;a[fa+4>>0]=a[6779]|0;a[fa+5>>0]=0;c[tb>>2]=ub;c[tb+4>>2]=2;c[d>>2]=c[tb>>2];c[d+4>>2]=c[tb+4>>2];fb(sb,d);sh(14e3,rb);mb(14012,sb);c[vb>>2]=0;c[vb+4>>2]=0;c[vb+8>>2]=0;tb=vb+11|0;a[tb>>0]=9;uc=vb;wc=6781;xc=uc+9|0;do{a[uc>>0]=a[wc>>0]|0;uc=uc+1|0;wc=wc+1|0}while((uc|0)<(xc|0));a[vb+9>>0]=0;c[yb>>2]=1;fa=yb+4|0;c[fa>>2]=0;c[fa+4>>2]=0;c[fa+8>>2]=0;a[fa+11>>0]=5;a[fa>>0]=a[6791]|0;a[fa+1>>0]=a[6792]|0;a[fa+2>>0]=a[6793]|0;a[fa+3>>0]=a[6794]|0;a[fa+4>>0]=a[6795]|0;a[fa+5>>0]=0;c[yb+16>>2]=3;fa=yb+20|0;c[yb+28>>2]=0;a[fa+11>>0]=7;a[fa>>0]=a[6797]|0;a[fa+1>>0]=a[6798]|0;a[fa+2>>0]=a[6799]|0;a[fa+3>>0]=a[6800]|0;a[fa+4>>0]=a[6801]|0;a[fa+5>>0]=a[6802]|0;a[fa+6>>0]=a[6803]|0;a[fa+7>>0]=0;c[xb>>2]=yb;c[xb+4>>2]=2;c[d>>2]=c[xb>>2];c[d+4>>2]=c[xb+4>>2];fb(wb,d);sh(14032,vb);mb(14044,wb);c[zb>>2]=0;c[zb+4>>2]=0;c[zb+8>>2]=0;xb=jh(16)|0;c[zb>>2]=xb;c[zb+8>>2]=-2147483632;c[zb+4>>2]=13;uc=xb;wc=6805;xc=uc+13|0;do{a[uc>>0]=a[wc>>0]|0;uc=uc+1|0;wc=wc+1|0}while((uc|0)<(xc|0));a[xb+13>>0]=0;c[Cb>>2]=1;xb=Cb+4|0;c[xb>>2]=0;c[xb+4>>2]=0;c[xb+8>>2]=0;a[xb+11>>0]=9;uc=xb;wc=6819;xc=uc+9|0;do{a[uc>>0]=a[wc>>0]|0;uc=uc+1|0;wc=wc+1|0}while((uc|0)<(xc|0));a[xb+9>>0]=0;c[Cb+16>>2]=3;xb=Cb+20|0;c[xb>>2]=0;c[xb+4>>2]=0;c[xb+8>>2]=0;a[xb+11>>0]=6;a[xb>>0]=a[6829]|0;a[xb+1>>0]=a[6830]|0;a[xb+2>>0]=a[6831]|0;a[xb+3>>0]=a[6832]|0;a[xb+4>>0]=a[6833]|0;a[xb+5>>0]=a[6834]|0;a[xb+6>>0]=0;c[Bb>>2]=Cb;c[Bb+4>>2]=2;c[d>>2]=c[Bb>>2];c[d+4>>2]=c[Bb+4>>2];fb(Ab,d);sh(14064,zb);mb(14076,Ab);c[Db>>2]=0;c[Db+4>>2]=0;c[Db+8>>2]=0;Bb=jh(16)|0;c[Db>>2]=Bb;c[Db+8>>2]=-2147483632;c[Db+4>>2]=14;uc=Bb;wc=6836;xc=uc+14|0;do{a[uc>>0]=a[wc>>0]|0;uc=uc+1|0;wc=wc+1|0}while((uc|0)<(xc|0));a[Bb+14>>0]=0;c[Gb>>2]=1;Bb=Gb+4|0;a[Bb+11>>0]=10;uc=Bb;wc=6851;xc=uc+10|0;do{a[uc>>0]=a[wc>>0]|0;uc=uc+1|0;wc=wc+1|0}while((uc|0)<(xc|0));a[Bb+10>>0]=0;c[Gb+16>>2]=3;Bb=Gb+20|0;c[Bb>>2]=0;c[Bb+4>>2]=0;c[Bb+8>>2]=0;xb=jh(16)|0;c[Bb>>2]=xb;c[Gb+28>>2]=-2147483632;c[Gb+24>>2]=11;uc=xb;wc=6862;xc=uc+11|0;do{a[uc>>0]=a[wc>>0]|0;uc=uc+1|0;wc=wc+1|0}while((uc|0)<(xc|0));a[xb+11>>0]=0;c[Fb>>2]=Gb;c[Fb+4>>2]=2;c[d>>2]=c[Fb>>2];c[d+4>>2]=c[Fb+4>>2];fb(Eb,d);sh(14096,Db);mb(14108,Eb);Fb=Hb+11|0;a[Fb>>0]=10;uc=Hb;wc=6874;xc=uc+10|0;do{a[uc>>0]=a[wc>>0]|0;uc=uc+1|0;wc=wc+1|0}while((uc|0)<(xc|0));a[Hb+10>>0]=0;c[Kb>>2]=1;xb=Kb+4|0;c[xb>>2]=0;c[xb+4>>2]=0;c[xb+8>>2]=0;a[xb+11>>0]=6;a[xb>>0]=a[6885]|0;a[xb+1>>0]=a[6886]|0;a[xb+2>>0]=a[6887]|0;a[xb+3>>0]=a[6888]|0;a[xb+4>>0]=a[6889]|0;a[xb+5>>0]=a[6890]|0;a[xb+6>>0]=0;c[Kb+16>>2]=3;xb=Kb+20|0;c[xb>>2]=0;c[xb+4>>2]=0;c[xb+8>>2]=0;a[xb+11>>0]=9;uc=xb;wc=6892;xc=uc+9|0;do{a[uc>>0]=a[wc>>0]|0;uc=uc+1|0;wc=wc+1|0}while((uc|0)<(xc|0));a[xb+9>>0]=0;c[Jb>>2]=Kb;c[Jb+4>>2]=2;c[d>>2]=c[Jb>>2];c[d+4>>2]=c[Jb+4>>2];fb(Ib,d);sh(14128,Hb);mb(14140,Ib);c[Lb>>2]=0;c[Lb+4>>2]=0;c[Lb+8>>2]=0;Jb=jh(16)|0;c[Lb>>2]=Jb;c[Lb+8>>2]=-2147483632;c[Lb+4>>2]=13;uc=Jb;wc=6902;xc=uc+13|0;do{a[uc>>0]=a[wc>>0]|0;uc=uc+1|0;wc=wc+1|0}while((uc|0)<(xc|0));a[Jb+13>>0]=0;c[Ob>>2]=1;Jb=Ob+4|0;c[Jb>>2]=0;c[Jb+4>>2]=0;c[Jb+8>>2]=0;a[Jb+11>>0]=5;a[Jb>>0]=a[6916]|0;a[Jb+1>>0]=a[6917]|0;a[Jb+2>>0]=a[6918]|0;a[Jb+3>>0]=a[6919]|0;a[Jb+4>>0]=a[6920]|0;a[Jb+5>>0]=0;c[Ob+16>>2]=3;Jb=Ob+20|0;c[Jb>>2]=0;c[Jb+4>>2]=0;c[Jb+8>>2]=0;a[Jb+11>>0]=5;a[Jb>>0]=a[6922]|0;a[Jb+1>>0]=a[6923]|0;a[Jb+2>>0]=a[6924]|0;a[Jb+3>>0]=a[6925]|0;a[Jb+4>>0]=a[6926]|0;a[Jb+5>>0]=0;c[Nb>>2]=Ob;c[Nb+4>>2]=2;c[d>>2]=c[Nb>>2];c[d+4>>2]=c[Nb+4>>2];fb(Mb,d);sh(14160,Lb);mb(14172,Mb);c[Pb>>2]=0;c[Pb+4>>2]=0;c[Pb+8>>2]=0;Nb=Pb+11|0;a[Nb>>0]=8;Jb=Pb;c[Jb>>2]=1634103155;c[Jb+4>>2]=1735290926;a[Pb+8>>0]=0;c[Sb>>2]=1;Jb=Sb+4|0;c[Jb>>2]=0;c[Jb+4>>2]=0;c[Jb+8>>2]=0;a[Jb+11>>0]=4;c[Jb>>2]=1634103155;a[Sb+8>>0]=0;c[Sb+16>>2]=3;Jb=Sb+20|0;c[Jb>>2]=0;c[Jb+4>>2]=0;c[Jb+8>>2]=0;a[Jb+11>>0]=4;c[Jb>>2]=1634103123;a[Sb+24>>0]=0;c[Rb>>2]=Sb;c[Rb+4>>2]=2;c[d>>2]=c[Rb>>2];c[d+4>>2]=c[Rb+4>>2];fb(Qb,d);sh(14192,Pb);mb(14204,Qb);c[Tb>>2]=0;c[Tb+4>>2]=0;c[Tb+8>>2]=0;Rb=jh(16)|0;c[Tb>>2]=Rb;c[Tb+8>>2]=-2147483632;c[Tb+4>>2]=13;uc=Rb;wc=6928;xc=uc+13|0;do{a[uc>>0]=a[wc>>0]|0;uc=uc+1|0;wc=wc+1|0}while((uc|0)<(xc|0));a[Rb+13>>0]=0;c[Wb>>2]=1;Rb=Wb+4|0;c[Rb>>2]=0;c[Rb+4>>2]=0;c[Rb+8>>2]=0;a[Rb+11>>0]=9;uc=Rb;wc=6942;xc=uc+9|0;do{a[uc>>0]=a[wc>>0]|0;uc=uc+1|0;wc=wc+1|0}while((uc|0)<(xc|0));a[Rb+9>>0]=0;c[Wb+16>>2]=3;Rb=Wb+20|0;a[Rb+11>>0]=10;uc=Rb;wc=6952;xc=uc+10|0;do{a[uc>>0]=a[wc>>0]|0;uc=uc+1|0;wc=wc+1|0}while((uc|0)<(xc|0));a[Rb+10>>0]=0;c[Vb>>2]=Wb;c[Vb+4>>2]=2;c[d>>2]=c[Vb>>2];c[d+4>>2]=c[Vb+4>>2];fb(Ub,d);sh(14224,Tb);mb(14236,Ub);c[Xb>>2]=0;c[Xb+4>>2]=0;c[Xb+8>>2]=0;Vb=jh(16)|0;c[Xb>>2]=Vb;c[Xb+8>>2]=-2147483632;c[Xb+4>>2]=14;uc=Vb;wc=6963;xc=uc+14|0;do{a[uc>>0]=a[wc>>0]|0;uc=uc+1|0;wc=wc+1|0}while((uc|0)<(xc|0));a[Vb+14>>0]=0;c[_b>>2]=1;Vb=_b+4|0;a[Vb+11>>0]=10;uc=Vb;wc=6978;xc=uc+10|0;do{a[uc>>0]=a[wc>>0]|0;uc=uc+1|0;wc=wc+1|0}while((uc|0)<(xc|0));a[Vb+10>>0]=0;c[_b+16>>2]=3;Vb=_b+20|0;c[Vb>>2]=0;c[Vb+4>>2]=0;c[Vb+8>>2]=0;a[Vb+11>>0]=8;Rb=Vb;c[Rb>>2]=1650750021;c[Rb+4>>2]=1701995877;a[_b+28>>0]=0;c[Zb>>2]=_b;c[Zb+4>>2]=2;c[d>>2]=c[Zb>>2];c[d+4>>2]=c[Zb+4>>2];fb(Yb,d);sh(14256,Xb);mb(14268,Yb);c[$b>>2]=0;c[$b+4>>2]=0;c[$b+8>>2]=0;Zb=$b+11|0;a[Zb>>0]=9;uc=$b;wc=6989;xc=uc+9|0;do{a[uc>>0]=a[wc>>0]|0;uc=uc+1|0;wc=wc+1|0}while((uc|0)<(xc|0));a[$b+9>>0]=0;c[cc>>2]=1;Rb=cc+4|0;c[Rb>>2]=0;c[Rb+4>>2]=0;c[Rb+8>>2]=0;a[Rb+11>>0]=5;a[Rb>>0]=a[6999]|0;a[Rb+1>>0]=a[7e3]|0;a[Rb+2>>0]=a[7001]|0;a[Rb+3>>0]=a[7002]|0;a[Rb+4>>0]=a[7003]|0;a[Rb+5>>0]=0;c[cc+16>>2]=3;Rb=cc+20|0;c[Rb>>2]=0;c[Rb+4>>2]=0;c[Rb+8>>2]=0;a[Rb+11>>0]=5;a[Rb>>0]=a[7005]|0;a[Rb+1>>0]=a[7006]|0;a[Rb+2>>0]=a[7007]|0;a[Rb+3>>0]=a[7008]|0;a[Rb+4>>0]=a[7009]|0;a[Rb+5>>0]=0;c[bc>>2]=cc;c[bc+4>>2]=2;c[d>>2]=c[bc>>2];c[d+4>>2]=c[bc+4>>2];fb(ac,d);sh(14288,$b);mb(14300,ac);bc=dc+11|0;a[bc>>0]=10;uc=dc;wc=7011;xc=uc+10|0;do{a[uc>>0]=a[wc>>0]|0;uc=uc+1|0;wc=wc+1|0}while((uc|0)<(xc|0));a[dc+10>>0]=0;c[gc>>2]=1;Rb=gc+4|0;c[Rb>>2]=0;c[Rb+4>>2]=0;c[Rb+8>>2]=0;a[Rb+11>>0]=6;a[Rb>>0]=a[7022]|0;a[Rb+1>>0]=a[7023]|0;a[Rb+2>>0]=a[7024]|0;a[Rb+3>>0]=a[7025]|0;a[Rb+4>>0]=a[7026]|0;a[Rb+5>>0]=a[7027]|0;a[Rb+6>>0]=0;c[gc+16>>2]=3;Rb=gc+20|0;c[Rb>>2]=0;c[Rb+4>>2]=0;c[Rb+8>>2]=0;a[Rb+11>>0]=6;a[Rb>>0]=a[7029]|0;a[Rb+1>>0]=a[7030]|0;a[Rb+2>>0]=a[7031]|0;a[Rb+3>>0]=a[7032]|0;a[Rb+4>>0]=a[7033]|0;a[Rb+5>>0]=a[7034]|0;a[Rb+6>>0]=0;c[fc>>2]=gc;c[fc+4>>2]=2;c[d>>2]=c[fc>>2];c[d+4>>2]=c[fc+4>>2];fb(ec,d);sh(14320,dc);mb(14332,ec);c[hc>>2]=0;c[hc+4>>2]=0;c[hc+8>>2]=0;fc=hc+11|0;a[fc>>0]=9;uc=hc;wc=7036;xc=uc+9|0;do{a[uc>>0]=a[wc>>0]|0;uc=uc+1|0;wc=wc+1|0}while((uc|0)<(xc|0));a[hc+9>>0]=0;c[kc>>2]=1;Rb=kc+4|0;c[Rb>>2]=0;c[Rb+4>>2]=0;c[Rb+8>>2]=0;a[Rb+11>>0]=0;a[Rb>>0]=0;c[kc+16>>2]=3;Rb=kc+20|0;c[Rb>>2]=0;c[Rb+4>>2]=0;c[Rb+8>>2]=0;a[Rb+11>>0]=0;a[Rb>>0]=0;c[jc>>2]=kc;c[jc+4>>2]=2;c[d>>2]=c[jc>>2];c[d+4>>2]=c[jc+4>>2];fb(ic,d);sh(14352,hc);mb(14364,ic);c[lc>>2]=0;c[lc+4>>2]=0;c[lc+8>>2]=0;jc=lc+11|0;a[jc>>0]=9;uc=lc;wc=7046;xc=uc+9|0;do{a[uc>>0]=a[wc>>0]|0;uc=uc+1|0;wc=wc+1|0}while((uc|0)<(xc|0));a[lc+9>>0]=0;c[oc>>2]=1;Rb=oc+4|0;c[Rb>>2]=0;c[Rb+4>>2]=0;c[Rb+8>>2]=0;a[Rb+11>>0]=5;a[Rb>>0]=a[7056]|0;a[Rb+1>>0]=a[7057]|0;a[Rb+2>>0]=a[7058]|0;a[Rb+3>>0]=a[7059]|0;a[Rb+4>>0]=a[7060]|0;a[Rb+5>>0]=0;c[oc+16>>2]=3;Rb=oc+20|0;c[Rb>>2]=0;c[Rb+4>>2]=0;c[Rb+8>>2]=0;a[Rb+11>>0]=9;uc=Rb;wc=7062;xc=uc+9|0;do{a[uc>>0]=a[wc>>0]|0;uc=uc+1|0;wc=wc+1|0}while((uc|0)<(xc|0));a[Rb+9>>0]=0;c[nc>>2]=oc;c[nc+4>>2]=2;c[d>>2]=c[nc>>2];c[d+4>>2]=c[nc+4>>2];fb(mc,d);sh(14384,lc);mb(14396,mc);nc=pc+11|0;a[nc>>0]=10;uc=pc;wc=7072;xc=uc+10|0;do{a[uc>>0]=a[wc>>0]|0;uc=uc+1|0;wc=wc+1|0}while((uc|0)<(xc|0));a[pc+10>>0]=0;c[sc>>2]=1;wc=sc+4|0;c[wc>>2]=0;c[wc+4>>2]=0;c[wc+8>>2]=0;a[wc+11>>0]=6;a[wc>>0]=a[7083]|0;a[wc+1>>0]=a[7084]|0;a[wc+2>>0]=a[7085]|0;a[wc+3>>0]=a[7086]|0;a[wc+4>>0]=a[7087]|0;a[wc+5>>0]=a[7088]|0;a[wc+6>>0]=0;c[sc+16>>2]=3;wc=sc+20|0;c[wc>>2]=0;c[wc+4>>2]=0;c[wc+8>>2]=0;a[wc+11>>0]=5;a[wc>>0]=a[7090]|0;a[wc+1>>0]=a[7091]|0;a[wc+2>>0]=a[7092]|0;a[wc+3>>0]=a[7093]|0;a[wc+4>>0]=a[7094]|0;a[wc+5>>0]=0;c[rc>>2]=sc;c[rc+4>>2]=2;c[d>>2]=c[rc>>2];c[d+4>>2]=c[rc+4>>2];fb(qc,d);sh(14416,pc);mb(14428,qc);d=c[qc+8>>2]|0;if(d|0){rc=d;do{d=rc;rc=c[rc>>2]|0;wc=d+12|0;if((a[wc+11>>0]|0)<0)kh(c[wc>>2]|0);kh(d)}while((rc|0)!=0)}rc=c[qc>>2]|0;c[qc>>2]=0;if(rc|0)kh(rc);rc=sc+20|0;if((a[rc+11>>0]|0)<0)kh(c[rc>>2]|0);rc=sc+4|0;if((a[rc+11>>0]|0)<0)kh(c[rc>>2]|0);if((a[nc>>0]|0)<0)kh(c[pc>>2]|0);pc=c[mc+8>>2]|0;if(pc|0){nc=pc;do{pc=nc;nc=c[nc>>2]|0;rc=pc+12|0;if((a[rc+11>>0]|0)<0)kh(c[rc>>2]|0);kh(pc)}while((nc|0)!=0)}nc=c[mc>>2]|0;c[mc>>2]=0;if(nc|0)kh(nc);nc=oc+20|0;if((a[nc+11>>0]|0)<0)kh(c[nc>>2]|0);nc=oc+4|0;if((a[nc+11>>0]|0)<0)kh(c[nc>>2]|0);if((a[jc>>0]|0)<0)kh(c[lc>>2]|0);lc=c[ic+8>>2]|0;if(lc|0){jc=lc;do{lc=jc;jc=c[jc>>2]|0;nc=lc+12|0;if((a[nc+11>>0]|0)<0)kh(c[nc>>2]|0);kh(lc)}while((jc|0)!=0)}jc=c[ic>>2]|0;c[ic>>2]=0;if(jc|0)kh(jc);jc=kc+20|0;if((a[jc+11>>0]|0)<0)kh(c[jc>>2]|0);jc=kc+4|0;if((a[jc+11>>0]|0)<0)kh(c[jc>>2]|0);if((a[fc>>0]|0)<0)kh(c[hc>>2]|0);hc=c[ec+8>>2]|0;if(hc|0){fc=hc;do{hc=fc;fc=c[fc>>2]|0;jc=hc+12|0;if((a[jc+11>>0]|0)<0)kh(c[jc>>2]|0);kh(hc)}while((fc|0)!=0)}fc=c[ec>>2]|0;c[ec>>2]=0;if(fc|0)kh(fc);fc=gc+20|0;if((a[fc+11>>0]|0)<0)kh(c[fc>>2]|0);fc=gc+4|0;if((a[fc+11>>0]|0)<0)kh(c[fc>>2]|0);if((a[bc>>0]|0)<0)kh(c[dc>>2]|0);dc=c[ac+8>>2]|0;if(dc|0){bc=dc;do{dc=bc;bc=c[bc>>2]|0;fc=dc+12|0;if((a[fc+11>>0]|0)<0)kh(c[fc>>2]|0);kh(dc)}while((bc|0)!=0)}bc=c[ac>>2]|0;c[ac>>2]=0;if(bc|0)kh(bc);bc=cc+20|0;if((a[bc+11>>0]|0)<0)kh(c[bc>>2]|0);bc=cc+4|0;if((a[bc+11>>0]|0)<0)kh(c[bc>>2]|0);if((a[Zb>>0]|0)<0)kh(c[$b>>2]|0);$b=c[Yb+8>>2]|0;if($b|0){Zb=$b;do{$b=Zb;Zb=c[Zb>>2]|0;bc=$b+12|0;if((a[bc+11>>0]|0)<0)kh(c[bc>>2]|0);kh($b)}while((Zb|0)!=0)}Zb=c[Yb>>2]|0;c[Yb>>2]=0;if(Zb|0)kh(Zb);Zb=_b+20|0;if((a[Zb+11>>0]|0)<0)kh(c[Zb>>2]|0);Zb=_b+4|0;if((a[Zb+11>>0]|0)<0)kh(c[Zb>>2]|0);if((a[Xb+11>>0]|0)<0)kh(c[Xb>>2]|0);Xb=c[Ub+8>>2]|0;if(Xb|0){Zb=Xb;do{Xb=Zb;Zb=c[Zb>>2]|0;_b=Xb+12|0;if((a[_b+11>>0]|0)<0)kh(c[_b>>2]|0);kh(Xb)}while((Zb|0)!=0)}Zb=c[Ub>>2]|0;c[Ub>>2]=0;if(Zb|0)kh(Zb);Zb=Wb+20|0;if((a[Zb+11>>0]|0)<0)kh(c[Zb>>2]|0);Zb=Wb+4|0;if((a[Zb+11>>0]|0)<0)kh(c[Zb>>2]|0);if((a[Tb+11>>0]|0)<0)kh(c[Tb>>2]|0);Tb=c[Qb+8>>2]|0;if(Tb|0){Zb=Tb;do{Tb=Zb;Zb=c[Zb>>2]|0;Wb=Tb+12|0;if((a[Wb+11>>0]|0)<0)kh(c[Wb>>2]|0);kh(Tb)}while((Zb|0)!=0)}Zb=c[Qb>>2]|0;c[Qb>>2]=0;if(Zb|0)kh(Zb);Zb=Sb+20|0;if((a[Zb+11>>0]|0)<0)kh(c[Zb>>2]|0);Zb=Sb+4|0;if((a[Zb+11>>0]|0)<0)kh(c[Zb>>2]|0);if((a[Nb>>0]|0)<0)kh(c[Pb>>2]|0);Pb=c[Mb+8>>2]|0;if(Pb|0){Nb=Pb;do{Pb=Nb;Nb=c[Nb>>2]|0;Zb=Pb+12|0;if((a[Zb+11>>0]|0)<0)kh(c[Zb>>2]|0);kh(Pb)}while((Nb|0)!=0)}Nb=c[Mb>>2]|0;c[Mb>>2]=0;if(Nb|0)kh(Nb);Nb=Ob+20|0;if((a[Nb+11>>0]|0)<0)kh(c[Nb>>2]|0);Nb=Ob+4|0;if((a[Nb+11>>0]|0)<0)kh(c[Nb>>2]|0);if((a[Lb+11>>0]|0)<0)kh(c[Lb>>2]|0);Lb=c[Ib+8>>2]|0;if(Lb|0){Nb=Lb;do{Lb=Nb;Nb=c[Nb>>2]|0;Ob=Lb+12|0;if((a[Ob+11>>0]|0)<0)kh(c[Ob>>2]|0);kh(Lb)}while((Nb|0)!=0)}Nb=c[Ib>>2]|0;c[Ib>>2]=0;if(Nb|0)kh(Nb);Nb=Kb+20|0;if((a[Nb+11>>0]|0)<0)kh(c[Nb>>2]|0);Nb=Kb+4|0;if((a[Nb+11>>0]|0)<0)kh(c[Nb>>2]|0);if((a[Fb>>0]|0)<0)kh(c[Hb>>2]|0);Hb=c[Eb+8>>2]|0;if(Hb|0){Fb=Hb;do{Hb=Fb;Fb=c[Fb>>2]|0;Nb=Hb+12|0;if((a[Nb+11>>0]|0)<0)kh(c[Nb>>2]|0);kh(Hb)}while((Fb|0)!=0)}Fb=c[Eb>>2]|0;c[Eb>>2]=0;if(Fb|0)kh(Fb);Fb=Gb+20|0;if((a[Fb+11>>0]|0)<0)kh(c[Fb>>2]|0);Fb=Gb+4|0;if((a[Fb+11>>0]|0)<0)kh(c[Fb>>2]|0);if((a[Db+11>>0]|0)<0)kh(c[Db>>2]|0);Db=c[Ab+8>>2]|0;if(Db|0){Fb=Db;do{Db=Fb;Fb=c[Fb>>2]|0;Gb=Db+12|0;if((a[Gb+11>>0]|0)<0)kh(c[Gb>>2]|0);kh(Db)}while((Fb|0)!=0)}Fb=c[Ab>>2]|0;c[Ab>>2]=0;if(Fb|0)kh(Fb);Fb=Cb+20|0;if((a[Fb+11>>0]|0)<0)kh(c[Fb>>2]|0);Fb=Cb+4|0;if((a[Fb+11>>0]|0)<0)kh(c[Fb>>2]|0);if((a[zb+11>>0]|0)<0)kh(c[zb>>2]|0);zb=c[wb+8>>2]|0;if(zb|0){Fb=zb;do{zb=Fb;Fb=c[Fb>>2]|0;Cb=zb+12|0;if((a[Cb+11>>0]|0)<0)kh(c[Cb>>2]|0);kh(zb)}while((Fb|0)!=0)}Fb=c[wb>>2]|0;c[wb>>2]=0;if(Fb|0)kh(Fb);Fb=yb+20|0;if((a[Fb+11>>0]|0)<0)kh(c[Fb>>2]|0);Fb=yb+4|0;if((a[Fb+11>>0]|0)<0)kh(c[Fb>>2]|0);if((a[tb>>0]|0)<0)kh(c[vb>>2]|0);vb=c[sb+8>>2]|0;if(vb|0){tb=vb;do{vb=tb;tb=c[tb>>2]|0;Fb=vb+12|0;if((a[Fb+11>>0]|0)<0)kh(c[Fb>>2]|0);kh(vb)}while((tb|0)!=0)}tb=c[sb>>2]|0;c[sb>>2]=0;if(tb|0)kh(tb);tb=ub+20|0;if((a[tb+11>>0]|0)<0)kh(c[tb>>2]|0);tb=ub+4|0;if((a[tb+11>>0]|0)<0)kh(c[tb>>2]|0);if((a[pb>>0]|0)<0)kh(c[rb>>2]|0);rb=c[ob+8>>2]|0;if(rb|0){pb=rb;do{rb=pb;pb=c[pb>>2]|0;tb=rb+12|0;if((a[tb+11>>0]|0)<0)kh(c[tb>>2]|0);kh(rb)}while((pb|0)!=0)}pb=c[ob>>2]|0;c[ob>>2]=0;if(pb|0)kh(pb);pb=qb+20|0;if((a[pb+11>>0]|0)<0)kh(c[pb>>2]|0);pb=qb+4|0;if((a[pb+11>>0]|0)<0)kh(c[pb>>2]|0);if((a[kb>>0]|0)<0)kh(c[nb>>2]|0);nb=c[jb+8>>2]|0;if(nb|0){kb=nb;do{nb=kb;kb=c[kb>>2]|0;pb=nb+12|0;if((a[pb+11>>0]|0)<0)kh(c[pb>>2]|0);kh(nb)}while((kb|0)!=0)}kb=c[jb>>2]|0;c[jb>>2]=0;if(kb|0)kh(kb);kb=lb+20|0;if((a[kb+11>>0]|0)<0)kh(c[kb>>2]|0);kb=lb+4|0;if((a[kb+11>>0]|0)<0)kh(c[kb>>2]|0);if((a[ib+11>>0]|0)<0)kh(c[ib>>2]|0);ib=c[eb+8>>2]|0;if(ib|0){kb=ib;do{ib=kb;kb=c[kb>>2]|0;lb=ib+12|0;if((a[lb+11>>0]|0)<0)kh(c[lb>>2]|0);kh(ib)}while((kb|0)!=0)}kb=c[eb>>2]|0;c[eb>>2]=0;if(kb|0)kh(kb);kb=hb+20|0;if((a[kb+11>>0]|0)<0)kh(c[kb>>2]|0);kb=hb+4|0;if((a[kb+11>>0]|0)<0)kh(c[kb>>2]|0);if((a[db+11>>0]|0)<0)kh(c[db>>2]|0);db=c[ab+8>>2]|0;if(db|0){kb=db;do{db=kb;kb=c[kb>>2]|0;hb=db+12|0;if((a[hb+11>>0]|0)<0)kh(c[hb>>2]|0);kh(db)}while((kb|0)!=0)}kb=c[ab>>2]|0;c[ab>>2]=0;if(kb|0)kh(kb);kb=cb+20|0;if((a[kb+11>>0]|0)<0)kh(c[kb>>2]|0);kb=cb+4|0;if((a[kb+11>>0]|0)<0)kh(c[kb>>2]|0);if((a[Za>>0]|0)<0)kh(c[$a>>2]|0);$a=c[Ya+8>>2]|0;if($a|0){Za=$a;do{$a=Za;Za=c[Za>>2]|0;kb=$a+12|0;if((a[kb+11>>0]|0)<0)kh(c[kb>>2]|0);kh($a)}while((Za|0)!=0)}Za=c[Ya>>2]|0;c[Ya>>2]=0;if(Za|0)kh(Za);Za=_a+20|0;if((a[Za+11>>0]|0)<0)kh(c[Za>>2]|0);Za=_a+4|0;if((a[Za+11>>0]|0)<0)kh(c[Za>>2]|0);if((a[Va>>0]|0)<0)kh(c[Xa>>2]|0);Xa=c[Ua+8>>2]|0;if(Xa|0){Va=Xa;do{Xa=Va;Va=c[Va>>2]|0;Za=Xa+12|0;if((a[Za+11>>0]|0)<0)kh(c[Za>>2]|0);kh(Xa)}while((Va|0)!=0)}Va=c[Ua>>2]|0;c[Ua>>2]=0;if(Va|0)kh(Va);Va=Wa+20|0;if((a[Va+11>>0]|0)<0)kh(c[Va>>2]|0);Va=Wa+4|0;if((a[Va+11>>0]|0)<0)kh(c[Va>>2]|0);if((a[Ra>>0]|0)<0)kh(c[Ta>>2]|0);Ta=c[Qa+8>>2]|0;if(Ta|0){Ra=Ta;do{Ta=Ra;Ra=c[Ra>>2]|0;Va=Ta+12|0;if((a[Va+11>>0]|0)<0)kh(c[Va>>2]|0);kh(Ta)}while((Ra|0)!=0)}Ra=c[Qa>>2]|0;c[Qa>>2]=0;if(Ra|0)kh(Ra);Ra=Sa+20|0;if((a[Ra+11>>0]|0)<0)kh(c[Ra>>2]|0);Ra=Sa+4|0;if((a[Ra+11>>0]|0)<0)kh(c[Ra>>2]|0);if((a[Na>>0]|0)<0)kh(c[Pa>>2]|0);Pa=c[Ma+8>>2]|0;if(Pa|0){Na=Pa;do{Pa=Na;Na=c[Na>>2]|0;Ra=Pa+12|0;if((a[Ra+11>>0]|0)<0)kh(c[Ra>>2]|0);kh(Pa)}while((Na|0)!=0)}Na=c[Ma>>2]|0;c[Ma>>2]=0;if(Na|0)kh(Na);Na=Oa+20|0;if((a[Na+11>>0]|0)<0)kh(c[Na>>2]|0);Na=Oa+4|0;if((a[Na+11>>0]|0)<0)kh(c[Na>>2]|0);if((a[Ja+11>>0]|0)<0)kh(c[Ja>>2]|0);Ja=c[Ga+8>>2]|0;if(Ja|0){Na=Ja;do{Ja=Na;Na=c[Na>>2]|0;Oa=Ja+12|0;if((a[Oa+11>>0]|0)<0)kh(c[Oa>>2]|0);kh(Ja)}while((Na|0)!=0)}Na=c[Ga>>2]|0;c[Ga>>2]=0;if(Na|0)kh(Na);Na=Ia+20|0;if((a[Na+11>>0]|0)<0)kh(c[Na>>2]|0);Na=Ia+4|0;if((a[Na+11>>0]|0)<0)kh(c[Na>>2]|0);if((a[Da>>0]|0)<0)kh(c[Fa>>2]|0);Fa=c[Ca+8>>2]|0;if(Fa|0){Da=Fa;do{Fa=Da;Da=c[Da>>2]|0;Na=Fa+12|0;if((a[Na+11>>0]|0)<0)kh(c[Na>>2]|0);kh(Fa)}while((Da|0)!=0)}Da=c[Ca>>2]|0;c[Ca>>2]=0;if(Da|0)kh(Da);Da=Ea+20|0;if((a[Da+11>>0]|0)<0)kh(c[Da>>2]|0);Da=Ea+4|0;if((a[Da+11>>0]|0)<0)kh(c[Da>>2]|0);if((a[za>>0]|0)<0)kh(c[Ba>>2]|0);Ba=c[ya+8>>2]|0;if(Ba|0){za=Ba;do{Ba=za;za=c[za>>2]|0;Da=Ba+12|0;if((a[Da+11>>0]|0)<0)kh(c[Da>>2]|0);kh(Ba)}while((za|0)!=0)}za=c[ya>>2]|0;c[ya>>2]=0;if(za|0)kh(za);za=Aa+20|0;if((a[za+11>>0]|0)<0)kh(c[za>>2]|0);za=Aa+4|0;if((a[za+11>>0]|0)<0)kh(c[za>>2]|0);if((a[va>>0]|0)<0)kh(c[xa>>2]|0);xa=c[ua+8>>2]|0;if(xa|0){va=xa;do{xa=va;va=c[va>>2]|0;za=xa+12|0;if((a[za+11>>0]|0)<0)kh(c[za>>2]|0);kh(xa)}while((va|0)!=0)}va=c[ua>>2]|0;c[ua>>2]=0;if(va|0)kh(va);va=wa+20|0;if((a[va+11>>0]|0)<0)kh(c[va>>2]|0);va=wa+4|0;if((a[va+11>>0]|0)<0)kh(c[va>>2]|0);if((a[ra>>0]|0)<0)kh(c[ta>>2]|0);ta=c[qa+8>>2]|0;if(ta|0){ra=ta;do{ta=ra;ra=c[ra>>2]|0;va=ta+12|0;if((a[va+11>>0]|0)<0)kh(c[va>>2]|0);kh(ta)}while((ra|0)!=0)}ra=c[qa>>2]|0;c[qa>>2]=0;if(ra|0)kh(ra);ra=sa+20|0;if((a[ra+11>>0]|0)<0)kh(c[ra>>2]|0);ra=sa+4|0;if((a[ra+11>>0]|0)<0)kh(c[ra>>2]|0);if((a[pa+11>>0]|0)<0)kh(c[pa>>2]|0);pa=c[ma+8>>2]|0;if(pa|0){ra=pa;do{pa=ra;ra=c[ra>>2]|0;sa=pa+12|0;if((a[sa+11>>0]|0)<0)kh(c[sa>>2]|0);kh(pa)}while((ra|0)!=0)}ra=c[ma>>2]|0;c[ma>>2]=0;if(ra|0)kh(ra);ra=oa+20|0;if((a[ra+11>>0]|0)<0)kh(c[ra>>2]|0);ra=oa+4|0;if((a[ra+11>>0]|0)<0)kh(c[ra>>2]|0);if((a[la+11>>0]|0)<0)kh(c[la>>2]|0);la=c[ia+8>>2]|0;if(la|0){ra=la;do{la=ra;ra=c[ra>>2]|0;oa=la+12|0;if((a[oa+11>>0]|0)<0)kh(c[oa>>2]|0);kh(la)}while((ra|0)!=0)}ra=c[ia>>2]|0;c[ia>>2]=0;if(ra|0)kh(ra);ra=ka+20|0;if((a[ra+11>>0]|0)<0)kh(c[ra>>2]|0);ra=ka+4|0;if((a[ra+11>>0]|0)<0)kh(c[ra>>2]|0);if((a[ha+11>>0]|0)<0)kh(c[ha>>2]|0);ha=c[ea+8>>2]|0;if(ha|0){ra=ha;do{ha=ra;ra=c[ra>>2]|0;ka=ha+12|0;if((a[ka+11>>0]|0)<0)kh(c[ka>>2]|0);kh(ha)}while((ra|0)!=0)}ra=c[ea>>2]|0;c[ea>>2]=0;if(ra|0)kh(ra);ra=ga+20|0;if((a[ra+11>>0]|0)<0)kh(c[ra>>2]|0);ra=ga+4|0;if((a[ra+11>>0]|0)<0)kh(c[ra>>2]|0);if((a[da+11>>0]|0)<0)kh(c[da>>2]|0);da=c[aa+8>>2]|0;if(da|0){ra=da;do{da=ra;ra=c[ra>>2]|0;ga=da+12|0;if((a[ga+11>>0]|0)<0)kh(c[ga>>2]|0);kh(da)}while((ra|0)!=0)}ra=c[aa>>2]|0;c[aa>>2]=0;if(ra|0)kh(ra);ra=ca+20|0;if((a[ra+11>>0]|0)<0)kh(c[ra>>2]|0);ra=ca+4|0;if((a[ra+11>>0]|0)<0)kh(c[ra>>2]|0);if((a[Z>>0]|0)<0)kh(c[$>>2]|0);$=c[Y+8>>2]|0;if($|0){Z=$;do{$=Z;Z=c[Z>>2]|0;ra=$+12|0;if((a[ra+11>>0]|0)<0)kh(c[ra>>2]|0);kh($)}while((Z|0)!=0)}Z=c[Y>>2]|0;c[Y>>2]=0;if(Z|0)kh(Z);Z=_+20|0;if((a[Z+11>>0]|0)<0)kh(c[Z>>2]|0);Z=_+4|0;if((a[Z+11>>0]|0)<0)kh(c[Z>>2]|0);if((a[V>>0]|0)<0)kh(c[X>>2]|0);X=c[U+8>>2]|0;if(X|0){V=X;do{X=V;V=c[V>>2]|0;Z=X+12|0;if((a[Z+11>>0]|0)<0)kh(c[Z>>2]|0);kh(X)}while((V|0)!=0)}V=c[U>>2]|0;c[U>>2]=0;if(V|0)kh(V);V=W+20|0;if((a[V+11>>0]|0)<0)kh(c[V>>2]|0);V=W+4|0;if((a[V+11>>0]|0)<0)kh(c[V>>2]|0);if((a[R>>0]|0)<0)kh(c[T>>2]|0);T=c[Q+8>>2]|0;if(T|0){R=T;do{T=R;R=c[R>>2]|0;V=T+12|0;if((a[V+11>>0]|0)<0)kh(c[V>>2]|0);kh(T)}while((R|0)!=0)}R=c[Q>>2]|0;c[Q>>2]=0;if(R|0)kh(R);R=S+20|0;if((a[R+11>>0]|0)<0)kh(c[R>>2]|0);R=S+4|0;if((a[R+11>>0]|0)<0)kh(c[R>>2]|0);if((a[P+11>>0]|0)<0)kh(c[P>>2]|0);P=c[M+8>>2]|0;if(P|0){R=P;do{P=R;R=c[R>>2]|0;S=P+12|0;if((a[S+11>>0]|0)<0)kh(c[S>>2]|0);kh(P)}while((R|0)!=0)}R=c[M>>2]|0;c[M>>2]=0;if(R|0)kh(R);R=O+20|0;if((a[R+11>>0]|0)<0)kh(c[R>>2]|0);R=O+4|0;if((a[R+11>>0]|0)<0)kh(c[R>>2]|0);if((a[J>>0]|0)<0)kh(c[L>>2]|0);L=c[I+8>>2]|0;if(L|0){J=L;do{L=J;J=c[J>>2]|0;R=L+12|0;if((a[R+11>>0]|0)<0)kh(c[R>>2]|0);kh(L)}while((J|0)!=0)}J=c[I>>2]|0;c[I>>2]=0;if(J|0)kh(J);J=K+20|0;if((a[J+11>>0]|0)<0)kh(c[J>>2]|0);J=K+4|0;if((a[J+11>>0]|0)<0)kh(c[J>>2]|0);if((a[H+11>>0]|0)<0)kh(c[H>>2]|0);H=c[E+8>>2]|0;if(H|0){J=H;do{H=J;J=c[J>>2]|0;K=H+12|0;if((a[K+11>>0]|0)<0)kh(c[K>>2]|0);kh(H)}while((J|0)!=0)}J=c[E>>2]|0;c[E>>2]=0;if(J|0)kh(J);J=G+20|0;if((a[J+11>>0]|0)<0)kh(c[J>>2]|0);J=G+4|0;if((a[J+11>>0]|0)<0)kh(c[J>>2]|0);if((a[B>>0]|0)<0)kh(c[D>>2]|0);D=c[z+8>>2]|0;if(D|0){B=D;do{D=B;B=c[B>>2]|0;J=D+12|0;if((a[J+11>>0]|0)<0)kh(c[J>>2]|0);kh(D)}while((B|0)!=0)}B=c[z>>2]|0;c[z>>2]=0;if(B|0)kh(B);B=C+20|0;if((a[B+11>>0]|0)<0)kh(c[B>>2]|0);B=C+4|0;if((a[B+11>>0]|0)<0)kh(c[B>>2]|0);if((a[y+11>>0]|0)<0)kh(c[y>>2]|0);y=c[v+8>>2]|0;if(y|0){B=y;do{y=B;B=c[B>>2]|0;C=y+12|0;if((a[C+11>>0]|0)<0)kh(c[C>>2]|0);kh(y)}while((B|0)!=0)}B=c[v>>2]|0;c[v>>2]=0;if(B|0)kh(B);B=x+20|0;if((a[B+11>>0]|0)<0)kh(c[B>>2]|0);B=x+4|0;if((a[B+11>>0]|0)<0)kh(c[B>>2]|0);if((a[u+11>>0]|0)<0)kh(c[u>>2]|0);u=c[r+8>>2]|0;if(u|0){B=u;do{u=B;B=c[B>>2]|0;x=u+12|0;if((a[x+11>>0]|0)<0)kh(c[x>>2]|0);kh(u)}while((B|0)!=0)}B=c[r>>2]|0;c[r>>2]=0;if(B|0)kh(B);B=t+20|0;if((a[B+11>>0]|0)<0)kh(c[B>>2]|0);B=t+4|0;if((a[B+11>>0]|0)<0)kh(c[B>>2]|0);if((a[q+11>>0]|0)<0)kh(c[q>>2]|0);q=c[n+8>>2]|0;if(q|0){B=q;do{q=B;B=c[B>>2]|0;t=q+12|0;if((a[t+11>>0]|0)<0)kh(c[t>>2]|0);kh(q)}while((B|0)!=0)}B=c[n>>2]|0;c[n>>2]=0;if(B|0)kh(B);B=p+20|0;if((a[B+11>>0]|0)<0)kh(c[B>>2]|0);B=p+4|0;if((a[B+11>>0]|0)<0)kh(c[B>>2]|0);if((a[m+11>>0]|0)<0)kh(c[m>>2]|0);m=c[j+8>>2]|0;if(m|0){B=m;do{m=B;B=c[B>>2]|0;p=m+12|0;if((a[p+11>>0]|0)<0)kh(c[p>>2]|0);kh(m)}while((B|0)!=0)}B=c[j>>2]|0;c[j>>2]=0;if(B|0)kh(B);B=l+20|0;if((a[B+11>>0]|0)<0)kh(c[B>>2]|0);B=l+4|0;if((a[B+11>>0]|0)<0)kh(c[B>>2]|0);if((a[g>>0]|0)<0)kh(c[i>>2]|0);i=c[f+8>>2]|0;if(i|0){g=i;do{i=g;g=c[g>>2]|0;B=i+12|0;if((a[B+11>>0]|0)<0)kh(c[B>>2]|0);kh(i)}while((g|0)!=0)}g=c[f>>2]|0;c[f>>2]=0;if(g|0)kh(g);g=h+20|0;if((a[g+11>>0]|0)<0)kh(c[g>>2]|0);g=h+4|0;if((a[g+11>>0]|0)<0)kh(c[g>>2]|0);if((a[tc>>0]|0)>=0){Ka=b;return}kh(c[e>>2]|0);Ka=b;return}function fb(a,b){a=a|0;b=b|0;var d=0,e=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,v=0.0,w=0.0,x=0,y=0,z=0,A=0;c[a>>2]=0;c[a+4>>2]=0;c[a+8>>2]=0;c[a+12>>2]=0;c[a+16>>2]=1065353216;d=c[b>>2]|0;e=c[b+4>>2]|0;b=d+(e<<4)|0;if(!e)return;e=a+4|0;g=a+12|0;h=a+16|0;i=a+8|0;j=d;d=0;while(1){k=c[j>>2]|0;l=(d|0)==0;a:do if(!l){m=d+-1|0;n=(m&d|0)==0;if(!n)if(k>>>0<d>>>0)o=k;else o=(k>>>0)%(d>>>0)|0;else o=m&k;p=c[(c[a>>2]|0)+(o<<2)>>2]|0;if((p|0)!=0?(q=c[p>>2]|0,(q|0)!=0):0){if(n){n=q;while(1){p=c[n+4>>2]|0;if(!((p|0)==(k|0)|(p&m|0)==(o|0))){r=o;s=22;break a}if((c[n+8>>2]|0)==(k|0))break a;n=c[n>>2]|0;if(!n){r=o;s=22;break a}}}n=q;while(1){m=c[n+4>>2]|0;if((m|0)!=(k|0)){if(m>>>0<d>>>0)t=m;else t=(m>>>0)%(d>>>0)|0;if((t|0)!=(o|0)){r=o;s=22;break a}}if((c[n+8>>2]|0)==(k|0))break a;n=c[n>>2]|0;if(!n){r=o;s=22;break}}}else{r=o;s=22}}else{r=0;s=22}while(0);if((s|0)==22){s=0;n=jh(24)|0;c[n+8>>2]=k;sh(n+12|0,j+4|0);c[n+4>>2]=k;c[n>>2]=0;v=+(((c[g>>2]|0)+1|0)>>>0);w=+f[h>>2];do if(l|w*+(d>>>0)<v){q=d<<1|(d>>>0<3|(d+-1&d|0)!=0)&1;m=~~+u(+(v/w))>>>0;nb(a,q>>>0<m>>>0?m:q);q=c[e>>2]|0;m=q+-1|0;if(!(m&q)){x=q;y=m&k;break}if(k>>>0<q>>>0){x=q;y=k}else{x=q;y=(k>>>0)%(q>>>0)|0}}else{x=d;y=r}while(0);k=(c[a>>2]|0)+(y<<2)|0;l=c[k>>2]|0;if(!l){c[n>>2]=c[i>>2];c[i>>2]=n;c[k>>2]=i;k=c[n>>2]|0;if(k|0){q=c[k+4>>2]|0;k=x+-1|0;if(k&x)if(q>>>0<x>>>0)z=q;else z=(q>>>0)%(x>>>0)|0;else z=q&k;A=(c[a>>2]|0)+(z<<2)|0;s=35}}else{c[n>>2]=c[l>>2];A=l;s=35}if((s|0)==35){s=0;c[A>>2]=n}c[g>>2]=(c[g>>2]|0)+1}l=j+16|0;if((l|0)==(b|0))break;j=l;d=c[e>>2]|0}return}function gb(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0;f=Ka;Ka=Ka+32|0;if((Ka|0)>=(La|0))A(32);g=f+16|0;h=f;a:do switch(e|0){case 1:{do switch(d|0){case 0:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=4;c[b>>2]=1869768058;a[b+4>>0]=0;Ka=f;return}case 1:{i=b+4|0;c[i>>2]=0;c[i+4>>2]=0;a[b+11>>0]=3;a[b>>0]=a[7135]|0;a[b+1>>0]=a[7136]|0;a[b+2>>0]=a[7137]|0;a[b+3>>0]=0;Ka=f;return}case 2:{i=b+4|0;c[i>>2]=0;c[i+4>>2]=0;a[b+11>>0]=3;a[b>>0]=a[7139]|0;a[b+1>>0]=a[7140]|0;a[b+2>>0]=a[7141]|0;a[b+3>>0]=0;Ka=f;return}case 3:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=5;a[b>>0]=a[7143]|0;a[b+1>>0]=a[7144]|0;a[b+2>>0]=a[7145]|0;a[b+3>>0]=a[7146]|0;a[b+4>>0]=a[7147]|0;a[b+5>>0]=0;Ka=f;return}case 4:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=4;c[b>>2]=1920298854;a[b+4>>0]=0;Ka=f;return}case 5:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=4;c[b>>2]=1702259046;a[b+4>>0]=0;Ka=f;return}case 6:{i=b+4|0;c[i>>2]=0;c[i+4>>2]=0;a[b+11>>0]=3;a[b>>0]=a[7149]|0;a[b+1>>0]=a[7150]|0;a[b+2>>0]=a[7151]|0;a[b+3>>0]=0;Ka=f;return}case 7:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=5;a[b>>0]=a[7153]|0;a[b+1>>0]=a[7154]|0;a[b+2>>0]=a[7155]|0;a[b+3>>0]=a[7156]|0;a[b+4>>0]=a[7157]|0;a[b+5>>0]=0;Ka=f;return}case 8:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=5;a[b>>0]=a[7159]|0;a[b+1>>0]=a[7160]|0;a[b+2>>0]=a[7161]|0;a[b+3>>0]=a[7162]|0;a[b+4>>0]=a[7163]|0;a[b+5>>0]=0;Ka=f;return}case 9:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=4;c[b>>2]=1701734766;a[b+4>>0]=0;Ka=f;return}case 10:{i=b+4|0;c[i>>2]=0;c[i+4>>2]=0;a[b+11>>0]=3;a[b>>0]=a[7165]|0;a[b+1>>0]=a[7166]|0;a[b+2>>0]=a[7167]|0;a[b+3>>0]=0;Ka=f;return}case 11:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=6;a[b>>0]=a[7169]|0;a[b+1>>0]=a[7170]|0;a[b+2>>0]=a[7171]|0;a[b+3>>0]=a[7172]|0;a[b+4>>0]=a[7173]|0;a[b+5>>0]=a[7174]|0;a[b+6>>0]=0;Ka=f;return}case 12:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=6;a[b>>0]=a[7176]|0;a[b+1>>0]=a[7177]|0;a[b+2>>0]=a[7178]|0;a[b+3>>0]=a[7179]|0;a[b+4>>0]=a[7180]|0;a[b+5>>0]=a[7181]|0;a[b+6>>0]=0;Ka=f;return}default:break a}while(0);break}case 3:{do switch(d|0){case 0:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=4;c[b>>2]=1819047278;a[b+4>>0]=0;Ka=f;return}case 1:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=4;c[b>>2]=1936615781;a[b+4>>0]=0;Ka=f;return}case 2:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=4;c[b>>2]=1768257402;a[b+4>>0]=0;Ka=f;return}case 3:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=4;c[b>>2]=1768256100;a[b+4>>0]=0;Ka=f;return}case 4:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=4;c[b>>2]=1919248758;a[b+4>>0]=0;Ka=f;return}case 5:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=5;a[b>>0]=a[7183]|0;a[b+1>>0]=a[7184]|0;a[b+2>>0]=a[7185]|0;a[b+3>>0]=a[7186]|0;a[b+4>>0]=a[7187]|0;a[b+5>>0]=0;Ka=f;return}case 6:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=5;a[b>>0]=a[7189]|0;a[b+1>>0]=a[7190]|0;a[b+2>>0]=a[7191]|0;a[b+3>>0]=a[7192]|0;a[b+4>>0]=a[7193]|0;a[b+5>>0]=0;Ka=f;return}case 7:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=6;a[b>>0]=a[7195]|0;a[b+1>>0]=a[7196]|0;a[b+2>>0]=a[7197]|0;a[b+3>>0]=a[7198]|0;a[b+4>>0]=a[7199]|0;a[b+5>>0]=a[7200]|0;a[b+6>>0]=0;Ka=f;return}case 8:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=4;c[b>>2]=1952998241;a[b+4>>0]=0;Ka=f;return}case 9:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=4;c[b>>2]=1853187438;a[b+4>>0]=0;Ka=f;return}case 10:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=4;c[b>>2]=1852335482;a[b+4>>0]=0;Ka=f;return}case 11:{i=b+4|0;c[i>>2]=0;c[i+4>>2]=0;a[b+11>>0]=3;a[b>>0]=a[7202]|0;a[b+1>>0]=a[7203]|0;a[b+2>>0]=a[7204]|0;a[b+3>>0]=0;Ka=f;return}case 12:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=6;a[b>>0]=a[7206]|0;a[b+1>>0]=a[7207]|0;a[b+2>>0]=a[7208]|0;a[b+3>>0]=a[7209]|0;a[b+4>>0]=a[7210]|0;a[b+5>>0]=a[7211]|0;a[b+6>>0]=0;Ka=f;return}case 13:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=8;i=b;c[i>>2]=1768256100;c[i+4>>2]=1852335482;a[b+8>>0]=0;Ka=f;return}case 14:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=8;i=b;c[i>>2]=1919248758;c[i+4>>2]=1852335482;a[b+8>>0]=0;Ka=f;return}case 15:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=9;j=b;k=7213;l=j+9|0;do{a[j>>0]=a[k>>0]|0;j=j+1|0;k=k+1|0}while((j|0)<(l|0));a[b+9>>0]=0;Ka=f;return}case 16:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=8;i=b;c[i>>2]=1751344499;c[i+4>>2]=1852335482;a[b+8>>0]=0;Ka=f;return}case 17:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=8;i=b;c[i>>2]=1650813299;c[i+4>>2]=1852335482;a[b+8>>0]=0;Ka=f;return}case 18:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=8;i=b;c[i>>2]=1952998241;c[i+4>>2]=1852335482;a[b+8>>0]=0;Ka=f;return}case 19:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=8;i=b;c[i>>2]=1853187438;c[i+4>>2]=1852335482;a[b+8>>0]=0;Ka=f;return}case 20:{c[b+8>>2]=0;a[b+11>>0]=7;a[b>>0]=a[7223]|0;a[b+1>>0]=a[7224]|0;a[b+2>>0]=a[7225]|0;a[b+3>>0]=a[7226]|0;a[b+4>>0]=a[7227]|0;a[b+5>>0]=a[7228]|0;a[b+6>>0]=a[7229]|0;a[b+7>>0]=0;Ka=f;return}default:break a}while(0);break}case 5:{do switch(d|0){case 0:{i=b+4|0;c[i>>2]=0;c[i+4>>2]=0;a[b+11>>0]=3;a[b>>0]=a[7231]|0;a[b+1>>0]=a[7232]|0;a[b+2>>0]=a[7233]|0;a[b+3>>0]=0;Ka=f;return}case 1:{i=b+4|0;c[i>>2]=0;c[i+4>>2]=0;a[b+11>>0]=3;a[b>>0]=a[7235]|0;a[b+1>>0]=a[7236]|0;a[b+2>>0]=a[7237]|0;a[b+3>>0]=0;Ka=f;return}case 2:{i=b+4|0;c[i>>2]=0;c[i+4>>2]=0;a[b+11>>0]=3;a[b>>0]=a[7239]|0;a[b+1>>0]=a[7240]|0;a[b+2>>0]=a[7241]|0;a[b+3>>0]=0;Ka=f;return}case 3:{i=b+4|0;c[i>>2]=0;c[i+4>>2]=0;a[b+11>>0]=3;a[b>>0]=a[7243]|0;a[b+1>>0]=a[7244]|0;a[b+2>>0]=a[7245]|0;a[b+3>>0]=0;Ka=f;return}case 4:{i=b+4|0;c[i>>2]=0;c[i+4>>2]=0;a[b+11>>0]=3;a[b>>0]=a[7247]|0;a[b+1>>0]=a[7248]|0;a[b+2>>0]=a[7249]|0;a[b+3>>0]=0;Ka=f;return}case 5:{i=b+4|0;c[i>>2]=0;c[i+4>>2]=0;a[b+11>>0]=3;a[b>>0]=a[7251]|0;a[b+1>>0]=a[7252]|0;a[b+2>>0]=a[7253]|0;a[b+3>>0]=0;Ka=f;return}case 6:{i=b+4|0;c[i>>2]=0;c[i+4>>2]=0;a[b+11>>0]=3;a[b>>0]=a[7255]|0;a[b+1>>0]=a[7256]|0;a[b+2>>0]=a[7257]|0;a[b+3>>0]=0;Ka=f;return}case 7:{i=b+4|0;c[i>>2]=0;c[i+4>>2]=0;a[b+11>>0]=3;a[b>>0]=a[7259]|0;a[b+1>>0]=a[7260]|0;a[b+2>>0]=a[7261]|0;a[b+3>>0]=0;Ka=f;return}case 8:{i=b+4|0;c[i>>2]=0;c[i+4>>2]=0;a[b+11>>0]=3;a[b>>0]=a[7263]|0;a[b+1>>0]=a[7264]|0;a[b+2>>0]=a[7265]|0;a[b+3>>0]=0;Ka=f;return}case 9:{i=b+4|0;c[i>>2]=0;c[i+4>>2]=0;a[b+11>>0]=3;a[b>>0]=a[7267]|0;a[b+1>>0]=a[7268]|0;a[b+2>>0]=a[7269]|0;a[b+3>>0]=0;Ka=f;return}case 10:{i=b+4|0;c[i>>2]=0;c[i+4>>2]=0;a[b+11>>0]=3;a[b>>0]=a[7271]|0;a[b+1>>0]=a[7272]|0;a[b+2>>0]=a[7273]|0;a[b+3>>0]=0;Ka=f;return}case 11:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=6;a[b>>0]=a[7275]|0;a[b+1>>0]=a[7276]|0;a[b+2>>0]=a[7277]|0;a[b+3>>0]=a[7278]|0;a[b+4>>0]=a[7279]|0;a[b+5>>0]=a[7280]|0;a[b+6>>0]=0;Ka=f;return}case 12:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=6;a[b>>0]=a[7282]|0;a[b+1>>0]=a[7283]|0;a[b+2>>0]=a[7284]|0;a[b+3>>0]=a[7285]|0;a[b+4>>0]=a[7286]|0;a[b+5>>0]=a[7287]|0;a[b+6>>0]=0;Ka=f;return}case 13:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=6;a[b>>0]=a[7289]|0;a[b+1>>0]=a[7290]|0;a[b+2>>0]=a[7291]|0;a[b+3>>0]=a[7292]|0;a[b+4>>0]=a[7293]|0;a[b+5>>0]=a[7294]|0;a[b+6>>0]=0;Ka=f;return}case 14:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=6;a[b>>0]=a[7296]|0;a[b+1>>0]=a[7297]|0;a[b+2>>0]=a[7298]|0;a[b+3>>0]=a[7299]|0;a[b+4>>0]=a[7300]|0;a[b+5>>0]=a[7301]|0;a[b+6>>0]=0;Ka=f;return}case 15:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=6;a[b>>0]=a[7303]|0;a[b+1>>0]=a[7304]|0;a[b+2>>0]=a[7305]|0;a[b+3>>0]=a[7306]|0;a[b+4>>0]=a[7307]|0;a[b+5>>0]=a[7308]|0;a[b+6>>0]=0;Ka=f;return}case 16:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=6;a[b>>0]=a[7310]|0;a[b+1>>0]=a[7311]|0;a[b+2>>0]=a[7312]|0;a[b+3>>0]=a[7313]|0;a[b+4>>0]=a[7314]|0;a[b+5>>0]=a[7315]|0;a[b+6>>0]=0;Ka=f;return}case 17:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=6;a[b>>0]=a[7317]|0;a[b+1>>0]=a[7318]|0;a[b+2>>0]=a[7319]|0;a[b+3>>0]=a[7320]|0;a[b+4>>0]=a[7321]|0;a[b+5>>0]=a[7322]|0;a[b+6>>0]=0;Ka=f;return}case 18:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=6;a[b>>0]=a[7324]|0;a[b+1>>0]=a[7325]|0;a[b+2>>0]=a[7326]|0;a[b+3>>0]=a[7327]|0;a[b+4>>0]=a[7328]|0;a[b+5>>0]=a[7329]|0;a[b+6>>0]=0;Ka=f;return}case 19:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=6;a[b>>0]=a[7331]|0;a[b+1>>0]=a[7332]|0;a[b+2>>0]=a[7333]|0;a[b+3>>0]=a[7334]|0;a[b+4>>0]=a[7335]|0;a[b+5>>0]=a[7336]|0;a[b+6>>0]=0;Ka=f;return}case 20:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=6;a[b>>0]=a[7338]|0;a[b+1>>0]=a[7339]|0;a[b+2>>0]=a[7340]|0;a[b+3>>0]=a[7341]|0;a[b+4>>0]=a[7342]|0;a[b+5>>0]=a[7343]|0;a[b+6>>0]=0;Ka=f;return}default:break a}while(0);break}case 2:{do switch(d|0){case 1:{i=b+4|0;c[i>>2]=0;c[i+4>>2]=0;a[b+11>>0]=3;a[b>>0]=a[7345]|0;a[b+1>>0]=a[7346]|0;a[b+2>>0]=a[7347]|0;a[b+3>>0]=0;Ka=f;return}case 2:{i=b+4|0;c[i>>2]=0;c[i+4>>2]=0;a[b+11>>0]=3;a[b>>0]=a[7349]|0;a[b+1>>0]=a[7350]|0;a[b+2>>0]=a[7351]|0;a[b+3>>0]=0;Ka=f;return}case 3:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=4;c[b>>2]=1936028276;a[b+4>>0]=0;Ka=f;return}case 4:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=6;a[b>>0]=a[7353]|0;a[b+1>>0]=a[7354]|0;a[b+2>>0]=a[7355]|0;a[b+3>>0]=a[7356]|0;a[b+4>>0]=a[7357]|0;a[b+5>>0]=a[7358]|0;a[b+6>>0]=0;Ka=f;return}case 5:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=5;a[b>>0]=a[7360]|0;a[b+1>>0]=a[7361]|0;a[b+2>>0]=a[7362]|0;a[b+3>>0]=a[7363]|0;a[b+4>>0]=a[7364]|0;a[b+5>>0]=0;Ka=f;return}case 6:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=4;c[b>>2]=1936287091;a[b+4>>0]=0;Ka=f;return}case 7:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=5;a[b>>0]=a[7366]|0;a[b+1>>0]=a[7367]|0;a[b+2>>0]=a[7368]|0;a[b+3>>0]=a[7369]|0;a[b+4>>0]=a[7370]|0;a[b+5>>0]=0;Ka=f;return}case 8:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=4;c[b>>2]=1869112175;a[b+4>>0]=0;Ka=f;return}case 9:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=5;a[b>>0]=a[7372]|0;a[b+1>>0]=a[7373]|0;a[b+2>>0]=a[7374]|0;a[b+3>>0]=a[7375]|0;a[b+4>>0]=a[7376]|0;a[b+5>>0]=0;Ka=f;return}case 10:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=4;c[b>>2]=2053466468;a[b+4>>0]=0;Ka=f;return}case 11:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=4;c[b>>2]=1701015151;a[b+4>>0]=0;Ka=f;return}case 12:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=4;c[b>>2]=1701015396;a[b+4>>0]=0;Ka=f;return}case 13:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=5;a[b>>0]=a[7378]|0;a[b+1>>0]=a[7379]|0;a[b+2>>0]=a[7380]|0;a[b+3>>0]=a[7381]|0;a[b+4>>0]=a[7382]|0;a[b+5>>0]=0;Ka=f;return}case 14:{c[b+8>>2]=0;a[b+11>>0]=7;a[b>>0]=a[7384]|0;a[b+1>>0]=a[7385]|0;a[b+2>>0]=a[7386]|0;a[b+3>>0]=a[7387]|0;a[b+4>>0]=a[7388]|0;a[b+5>>0]=a[7389]|0;a[b+6>>0]=a[7390]|0;a[b+7>>0]=0;Ka=f;return}case 15:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=6;a[b>>0]=a[7392]|0;a[b+1>>0]=a[7393]|0;a[b+2>>0]=a[7394]|0;a[b+3>>0]=a[7395]|0;a[b+4>>0]=a[7396]|0;a[b+5>>0]=a[7397]|0;a[b+6>>0]=0;Ka=f;return}case 16:{a[b+11>>0]=10;j=b;k=7399;l=j+10|0;do{a[j>>0]=a[k>>0]|0;j=j+1|0;k=k+1|0}while((j|0)<(l|0));a[b+10>>0]=0;Ka=f;return}case 17:{a[b+11>>0]=10;j=b;k=7410;l=j+10|0;do{a[j>>0]=a[k>>0]|0;j=j+1|0;k=k+1|0}while((j|0)<(l|0));a[b+10>>0]=0;Ka=f;return}case 18:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=9;j=b;k=7421;l=j+9|0;do{a[j>>0]=a[k>>0]|0;j=j+1|0;k=k+1|0}while((j|0)<(l|0));a[b+9>>0]=0;Ka=f;return}case 19:{a[b+11>>0]=10;j=b;k=7431;l=j+10|0;do{a[j>>0]=a[k>>0]|0;j=j+1|0;k=k+1|0}while((j|0)<(l|0));a[b+10>>0]=0;Ka=f;return}case 20:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=6;a[b>>0]=a[7442]|0;a[b+1>>0]=a[7443]|0;a[b+2>>0]=a[7444]|0;a[b+3>>0]=a[7445]|0;a[b+4>>0]=a[7446]|0;a[b+5>>0]=a[7447]|0;a[b+6>>0]=0;Ka=f;return}default:break a}while(0);break}case 4:{do switch(d|0){case 1:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=8;i=b;c[i>>2]=-1261388080;c[i+4>>2]=-1110394672;a[b+8>>0]=0;Ka=f;return}case 2:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=6;a[b>>0]=a[7449]|0;a[b+1>>0]=a[7450]|0;a[b+2>>0]=a[7451]|0;a[b+3>>0]=a[7452]|0;a[b+4>>0]=a[7453]|0;a[b+5>>0]=a[7454]|0;a[b+6>>0]=0;Ka=f;return}case 3:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=6;a[b>>0]=a[7456]|0;a[b+1>>0]=a[7457]|0;a[b+2>>0]=a[7458]|0;a[b+3>>0]=a[7459]|0;a[b+4>>0]=a[7460]|0;a[b+5>>0]=a[7461]|0;a[b+6>>0]=0;Ka=f;return}case 4:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;i=jh(16)|0;c[b>>2]=i;c[b+8>>2]=-2147483632;c[b+4>>2]=12;j=i;k=7463;l=j+12|0;do{a[j>>0]=a[k>>0]|0;j=j+1|0;k=k+1|0}while((j|0)<(l|0));a[i+12>>0]=0;Ka=f;return}case 5:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=8;m=b;c[m>>2]=-1882079280;c[m+4>>2]=-1932426543;a[b+8>>0]=0;Ka=f;return}case 6:{a[b+11>>0]=10;j=b;k=7476;l=j+10|0;do{a[j>>0]=a[k>>0]|0;j=j+1|0;k=k+1|0}while((j|0)<(l|0));a[b+10>>0]=0;Ka=f;return}case 7:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=8;i=b;c[i>>2]=-1244626479;c[i+4>>2]=-1932411696;a[b+8>>0]=0;Ka=f;return}case 8:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;i=jh(16)|0;c[b>>2]=i;c[b+8>>2]=-2147483632;c[b+4>>2]=12;j=i;k=7487;l=j+12|0;do{a[j>>0]=a[k>>0]|0;j=j+1|0;k=k+1|0}while((j|0)<(l|0));a[i+12>>0]=0;Ka=f;return}case 9:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;m=jh(16)|0;c[b>>2]=m;c[b+8>>2]=-2147483632;c[b+4>>2]=12;j=m;k=7500;l=j+12|0;do{a[j>>0]=a[k>>0]|0;j=j+1|0;k=k+1|0}while((j|0)<(l|0));a[m+12>>0]=0;Ka=f;return}case 10:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;i=jh(16)|0;c[b>>2]=i;c[b+8>>2]=-2147483632;c[b+4>>2]=12;j=i;k=7513;l=j+12|0;do{a[j>>0]=a[k>>0]|0;j=j+1|0;k=k+1|0}while((j|0)<(l|0));a[i+12>>0]=0;Ka=f;return}case 11:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;m=jh(32)|0;c[b>>2]=m;c[b+8>>2]=-2147483616;c[b+4>>2]=22;j=m;k=7526;l=j+22|0;do{a[j>>0]=a[k>>0]|0;j=j+1|0;k=k+1|0}while((j|0)<(l|0));a[m+22>>0]=0;Ka=f;return}case 12:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;i=jh(32)|0;c[b>>2]=i;c[b+8>>2]=-2147483616;c[b+4>>2]=20;j=i;k=7549;l=j+20|0;do{a[j>>0]=a[k>>0]|0;j=j+1|0;k=k+1|0}while((j|0)<(l|0));a[i+20>>0]=0;Ka=f;return}case 13:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;m=jh(32)|0;c[b>>2]=m;c[b+8>>2]=-2147483616;c[b+4>>2]=20;j=m;k=7570;l=j+20|0;do{a[j>>0]=a[k>>0]|0;j=j+1|0;k=k+1|0}while((j|0)<(l|0));a[m+20>>0]=0;Ka=f;return}case 14:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;i=jh(32)|0;c[b>>2]=i;c[b+8>>2]=-2147483616;c[b+4>>2]=24;j=i;k=7591;l=j+24|0;do{a[j>>0]=a[k>>0]|0;j=j+1|0;k=k+1|0}while((j|0)<(l|0));a[i+24>>0]=0;Ka=f;return}case 15:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;m=jh(32)|0;c[b>>2]=m;c[b+8>>2]=-2147483616;c[b+4>>2]=20;j=m;k=7616;l=j+20|0;do{a[j>>0]=a[k>>0]|0;j=j+1|0;k=k+1|0}while((j|0)<(l|0));a[m+20>>0]=0;Ka=f;return}case 16:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;i=jh(32)|0;c[b>>2]=i;c[b+8>>2]=-2147483616;c[b+4>>2]=22;j=i;k=7637;l=j+22|0;do{a[j>>0]=a[k>>0]|0;j=j+1|0;k=k+1|0}while((j|0)<(l|0));a[i+22>>0]=0;Ka=f;return}case 17:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;m=jh(32)|0;c[b>>2]=m;c[b+8>>2]=-2147483616;c[b+4>>2]=20;j=m;k=7660;l=j+20|0;do{a[j>>0]=a[k>>0]|0;j=j+1|0;k=k+1|0}while((j|0)<(l|0));a[m+20>>0]=0;Ka=f;return}case 18:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;i=jh(32)|0;c[b>>2]=i;c[b+8>>2]=-2147483616;c[b+4>>2]=24;j=i;k=7681;l=j+24|0;do{a[j>>0]=a[k>>0]|0;j=j+1|0;k=k+1|0}while((j|0)<(l|0));a[i+24>>0]=0;Ka=f;return}case 19:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;m=jh(32)|0;c[b>>2]=m;c[b+8>>2]=-2147483616;c[b+4>>2]=24;j=m;k=7706;l=j+24|0;do{a[j>>0]=a[k>>0]|0;j=j+1|0;k=k+1|0}while((j|0)<(l|0));a[m+24>>0]=0;Ka=f;return}case 20:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;i=jh(32)|0;c[b>>2]=i;c[b+8>>2]=-2147483616;c[b+4>>2]=16;j=i;k=7731;l=j+16|0;do{a[j>>0]=a[k>>0]|0;j=j+1|0;k=k+1|0}while((j|0)<(l|0));a[i+16>>0]=0;Ka=f;return}default:break a}while(0);break}default:{}}while(0);c[g>>2]=d;Xg(h,7748,g)|0;c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;g=ig(h)|0;if(g>>>0>4294967279)rh(b);if(g>>>0<11){a[b+11>>0]=g;if(!g)n=b;else{o=b;p=107}}else{d=g+16&-16;k=jh(d)|0;c[b>>2]=k;c[b+8>>2]=d|-2147483648;c[b+4>>2]=g;o=k;p=107}if((p|0)==107){Mi(o|0,h|0,g|0)|0;n=o}a[n+g>>0]=0;Ka=f;return}function hb(){var a=0,b=0;a=c[3876]|0;if(!a){b=fa(4)|0;c[b>>2]=5780;ja(b|0,3784,75)}else{Sa[c[(c[a>>2]|0)+24>>2]&127](a);return}}function ib(){var a=0,b=0,d=0,e=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0;a=Ka;Ka=Ka+112|0;if((Ka|0)>=(La|0))A(112);b=a+64|0;d=a+56|0;e=a+48|0;g=a+40|0;h=a;i=a+96|0;j=a+88|0;jb(h);k=jh(96)|0;kb(k,0);c[i>>2]=k;l=jh(16)|0;c[l+4>>2]=0;c[l+8>>2]=0;c[l>>2]=5080;c[l+12>>2]=k;m=i+4|0;c[m>>2]=l;c[g>>2]=k;c[g+4>>2]=k;Df(i,g);k=jh(96)|0;kb(k,1);c[g>>2]=k;l=jh(16)|0;c[l+4>>2]=0;c[l+8>>2]=0;c[l>>2]=5080;c[l+12>>2]=k;n=g+4|0;c[n>>2]=l;c[e>>2]=k;c[e+4>>2]=k;Df(g,e);k=jh(96)|0;kb(k,2);c[e>>2]=k;l=jh(16)|0;c[l+4>>2]=0;c[l+8>>2]=0;c[l>>2]=5080;c[l+12>>2]=k;o=e+4|0;c[o>>2]=l;c[d>>2]=k;c[d+4>>2]=k;Df(e,d);k=jh(96)|0;kb(k,3);c[d>>2]=k;l=jh(16)|0;c[l+4>>2]=0;c[l+8>>2]=0;c[l>>2]=5080;c[l+12>>2]=k;p=d+4|0;c[p>>2]=l;c[b>>2]=k;c[b+4>>2]=k;Df(d,b);k=c[i>>2]|0;l=c[m>>2]|0;q=(l|0)==0;if(q)r=h+32|0;else{s=l+4|0;c[s>>2]=(c[s>>2]|0)+1;c[s>>2]=(c[s>>2]|0)+1;r=h+32|0}c[r>>2]=k;k=h+36|0;r=c[k>>2]|0;c[k>>2]=l;if(r|0?(s=r+4|0,t=c[s>>2]|0,c[s>>2]=t+-1,(t|0)==0):0){Sa[c[(c[r>>2]|0)+8>>2]&127](r);ih(r)}r=c[h+32>>2]|0;t=h+24|0;s=t;u=c[s+4>>2]|0;v=r+24|0;c[v>>2]=c[s>>2];c[v+4>>2]=u;u=c[r+16>>2]|0;if(u|0){v=c[(c[u>>2]|0)+8>>2]|0;f[b>>2]=0.0;f[b+4>>2]=0.0;Xa[v&15](u,r+4|0,b,t)}if(!q?(q=l+4|0,t=c[q>>2]|0,c[q>>2]=t+-1,(t|0)==0):0){Sa[c[(c[l>>2]|0)+8>>2]&127](l);ih(l)}c[j>>2]=0;l=b+16|0;t=jh(28)|0;c[t>>2]=5108;c[t+4>>2]=j;c[t+8>>2]=h;c[t+12>>2]=i;c[t+16>>2]=g;c[t+20>>2]=e;c[t+24>>2]=d;c[l>>2]=t;kc(b,15488);t=c[l>>2]|0;if((b|0)!=(t|0)){if(t|0)Sa[c[(c[t>>2]|0)+20>>2]&127](t)}else Sa[c[(c[t>>2]|0)+16>>2]&127](t);Ba(2,0,1);t=c[p>>2]|0;if(t|0?(p=t+4|0,b=c[p>>2]|0,c[p>>2]=b+-1,(b|0)==0):0){Sa[c[(c[t>>2]|0)+8>>2]&127](t);ih(t)}t=c[o>>2]|0;if(t|0?(o=t+4|0,b=c[o>>2]|0,c[o>>2]=b+-1,(b|0)==0):0){Sa[c[(c[t>>2]|0)+8>>2]&127](t);ih(t)}t=c[n>>2]|0;if(t|0?(n=t+4|0,b=c[n>>2]|0,c[n>>2]=b+-1,(b|0)==0):0){Sa[c[(c[t>>2]|0)+8>>2]&127](t);ih(t)}t=c[m>>2]|0;if(t|0?(m=t+4|0,b=c[m>>2]|0,c[m>>2]=b+-1,(b|0)==0):0){Sa[c[(c[t>>2]|0)+8>>2]&127](t);ih(t)}t=c[k>>2]|0;if(t|0?(k=t+4|0,b=c[k>>2]|0,c[k>>2]=b+-1,(b|0)==0):0){Sa[c[(c[t>>2]|0)+8>>2]&127](t);ih(t)}t=c[h>>2]|0;if(!t){Ka=a;return 1}kh(t);Ka=a;return 1}function jb(a){a=a|0;var b=0,d=0,e=0;c[a>>2]=0;b=a+4|0;c[b>>2]=0;d=a+8|0;c[d>>2]=0;e=jh(512)|0;c[a>>2]=e;c[d>>2]=128;c[b>>2]=4096;Oi(e|0,0,512)|0;c[a+12>>2]=0;g[a+16>>3]=+ya();e=a+24|0;c[e>>2]=0;c[e+4>>2]=0;c[e+8>>2]=0;c[e+12>>2]=0;U();aa(32)|0;da(50,50,32,0)|0;return}function kb(b,d){b=b|0;d=d|0;var e=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ba=0,ca=0,da=0,ea=0,fa=0,ga=0,ha=0,ia=0,ja=0,ka=0,la=0,ma=0,na=0,oa=0,pa=0,qa=0,ra=0,sa=0,ta=0,ua=0,va=0,wa=0,xa=0;e=Ka;Ka=Ka+544|0;if((Ka|0)>=(La|0))A(544);g=e+400|0;h=e+392|0;i=e+376|0;j=e+368|0;k=e+320|0;l=e+312|0;m=e+264|0;n=e+216|0;o=e+528|0;p=e+488|0;q=e+192|0;r=e+168|0;s=e+144|0;t=e+520|0;u=e+512|0;v=e+504|0;w=e+120|0;x=e+96|0;y=e+72|0;z=e+48|0;B=e+24|0;C=e;D=e+480|0;E=e+472|0;F=e+464|0;G=e+456|0;H=e+448|0;I=b+4|0;c[I>>2]=0;c[I+4>>2]=0;c[I+8>>2]=0;c[I+12>>2]=0;c[I+16>>2]=0;c[I+20>>2]=0;c[I+24>>2]=0;c[b>>2]=4e3;c[b+32>>2]=d;I=b+44|0;J=b+48|0;K=b+52|0;L=b+56|0;M=b+60|0;N=b+64|0;O=b+68|0;P=b+72|0;Q=b+36|0;R=Q+60|0;do{c[Q>>2]=0;Q=Q+4|0}while((Q|0)<(R|0));S=jh(328)|0;T=b+4|0;pb(S,T);c[o>>2]=S;U=jh(16)|0;c[U+4>>2]=0;c[U+8>>2]=0;c[U>>2]=4064;c[U+12>>2]=S;V=o+4|0;c[V>>2]=U;c[n>>2]=S;c[n+4>>2]=S;Fb(o,n);S=b+16|0;U=c[o>>2]|0;W=c[V>>2]|0;c[o>>2]=0;c[V>>2]=0;c[S>>2]=U;U=b+20|0;X=c[U>>2]|0;c[U>>2]=W;if(X|0?(W=X+4|0,U=c[W>>2]|0,c[W>>2]=U+-1,(U|0)==0):0){Sa[c[(c[X>>2]|0)+8>>2]&127](X);ih(X)}X=c[V>>2]|0;if(X|0?(V=X+4|0,U=c[V>>2]|0,c[V>>2]=U+-1,(U|0)==0):0){Sa[c[(c[X>>2]|0)+8>>2]&127](X);ih(X)}X=c[(c[S>>2]|0)+4>>2]|0;U=c[T>>2]|0;c[U+(X*48|0)+8>>2]=1065353216;c[U+(X*48|0)+12>>2]=1065353216;X=jh(328)|0;pb(X,T);c[X>>2]=4092;Q=n+8|0;R=Q+36|0;do{c[Q>>2]=0;Q=Q+4|0}while((Q|0)<(R|0));c[n+44>>2]=5;c[n>>2]=0;c[n+4>>2]=0;c[n+16>>2]=0;c[n+20>>2]=0;c[n+36>>2]=-256;U=b+8|0;V=c[U>>2]|0;W=c[T>>2]|0;c[W+((c[X+4>>2]|0)*48|0)+36>>2]=(V-W|0)/48|0;W=b+12|0;if((c[W>>2]|0)==(V|0))Mb(T,n);else{Q=V;Y=n;R=Q+48|0;do{c[Q>>2]=c[Y>>2];Q=Q+4|0;Y=Y+4|0}while((Q|0)<(R|0));c[U>>2]=(c[U>>2]|0)+48}c[o>>2]=X;V=jh(16)|0;c[V+4>>2]=0;c[V+8>>2]=0;c[V>>2]=4116;c[V+12>>2]=X;Z=o+4|0;c[Z>>2]=V;c[m>>2]=X;c[m+4>>2]=X;Nb(o,m);X=c[o>>2]|0;V=X+4|0;_=c[V>>2]|0;$=c[T>>2]|0;c[$+(_*48|0)+8>>2]=1065353216;c[$+(_*48|0)+12>>2]=0;_=c[V>>2]|0;V=c[T>>2]|0;c[V+(_*48|0)+24>>2]=0;c[V+(_*48|0)+28>>2]=1114636288;c[X+60>>2]=1;X=m+8|0;_=m+44|0;V=m+4|0;$=m+16|0;aa=m+20|0;ba=m+24|0;ca=m+28|0;da=m+36|0;ea=n+4|0;fa=p+11|0;ga=p+4|0;ha=p+8|0;ia=p+7|0;ja=p+6|0;ka=m+4|0;la=q+16|0;ma=r+16|0;na=s+16|0;oa=b;pa=t+4|0;qa=u+4|0;ra=0;a:do{sa=jh(328)|0;ta=(ra|0)==0;pb(sa,T);ua=ta?-1:-1600085761;c[sa>>2]=4144;Q=X;R=Q+36|0;do{c[Q>>2]=0;Q=Q+4|0}while((Q|0)<(R|0));c[_>>2]=6;c[m>>2]=0;c[V>>2]=0;c[$>>2]=0;c[aa>>2]=0;f[ba>>2]=2.0;c[ca>>2]=0;c[da>>2]=ua;va=c[U>>2]|0;wa=c[T>>2]|0;c[wa+((c[sa+4>>2]|0)*48|0)+36>>2]=(va-wa|0)/48|0;if((c[W>>2]|0)==(va|0))Mb(T,m);else{Q=va;Y=m;R=Q+48|0;do{c[Q>>2]=c[Y>>2];Q=Q+4|0;Y=Y+4|0}while((Q|0)<(R|0));c[U>>2]=(c[U>>2]|0)+48}c[n>>2]=sa;ua=jh(16)|0;c[ua+4>>2]=0;c[ua+8>>2]=0;c[ua>>2]=4168;c[ua+12>>2]=sa;c[ea>>2]=ua;c[l>>2]=sa;c[l+4>>2]=sa;Ub(n,l);ua=(c[n>>2]|0)+4|0;va=c[ua>>2]|0;wa=c[T>>2]|0;c[wa+(va*48|0)+16>>2]=1094713344;c[wa+(va*48|0)+20>>2]=1094713344;va=c[ua>>2]|0;ua=c[T>>2]|0;c[ua+(va*48|0)+24>>2]=1123024896;c[ua+(va*48|0)+28>>2]=1108344832;va=jh(328)|0;switch(ra&2147483647|0){case 0:{c[p>>2]=0;c[p+4>>2]=0;c[p+8>>2]=0;a[fa>>0]=4;c[p>>2]=1701736270;a[ga>>0]=0;break}case 1:{c[ha>>2]=117440512;a[p>>0]=a[7096]|0;a[p+1>>0]=a[7097]|0;a[p+2>>0]=a[7098]|0;a[p+3>>0]=a[7099]|0;a[p+4>>0]=a[7100]|0;a[p+5>>0]=a[7101]|0;a[p+6>>0]=a[7102]|0;a[ia>>0]=0;break}case 3:{c[p>>2]=0;c[p+4>>2]=0;c[p+8>>2]=0;a[fa>>0]=6;a[p>>0]=a[7104]|0;a[p+1>>0]=a[7105]|0;a[p+2>>0]=a[7106]|0;a[p+3>>0]=a[7107]|0;a[p+4>>0]=a[7108]|0;a[p+5>>0]=a[7109]|0;a[ja>>0]=0;break}case 5:{c[ha>>2]=117440512;a[p>>0]=a[7111]|0;a[p+1>>0]=a[7112]|0;a[p+2>>0]=a[7113]|0;a[p+3>>0]=a[7114]|0;a[p+4>>0]=a[7115]|0;a[p+5>>0]=a[7116]|0;a[p+6>>0]=a[7117]|0;a[ia>>0]=0;break}case 2:{c[ha>>2]=117440512;a[p>>0]=a[7119]|0;a[p+1>>0]=a[7120]|0;a[p+2>>0]=a[7121]|0;a[p+3>>0]=a[7122]|0;a[p+4>>0]=a[7123]|0;a[p+5>>0]=a[7124]|0;a[p+6>>0]=a[7125]|0;a[ia>>0]=0;break}case 4:{c[ha>>2]=117440512;a[p>>0]=a[7127]|0;a[p+1>>0]=a[7128]|0;a[p+2>>0]=a[7129]|0;a[p+3>>0]=a[7130]|0;a[p+4>>0]=a[7131]|0;a[p+5>>0]=a[7132]|0;a[p+6>>0]=a[7133]|0;a[ia>>0]=0;break}default:{ua=22;break a}}qb(va,T,p,-1,18.0);c[m>>2]=va;ua=jh(16)|0;c[ua+4>>2]=0;c[ua+8>>2]=0;c[ua>>2]=4220;c[ua+12>>2]=va;c[ka>>2]=ua;c[k>>2]=va;c[k+4>>2]=va;Fb(m,k);if((a[fa>>0]|0)<0)kh(c[p>>2]|0);va=c[m>>2]|0;Wa[c[c[va>>2]>>2]&7](va,T,2);va=c[(c[m>>2]|0)+4>>2]|0;ua=c[T>>2]|0;c[ua+(va*48|0)>>2]=1056964608;c[ua+(va*48|0)+4>>2]=1050253722;va=c[m>>2]|0;c[va+8>>2]=1056964608;c[va+12>>2]=1056964608;va=c[n>>2]|0;c[la>>2]=0;c[ma>>2]=0;ua=c[ea>>2]|0;if(ua|0){wa=ua+4|0;c[wa>>2]=(c[wa>>2]|0)+1}c[na>>2]=0;wa=jh(20)|0;c[wa>>2]=4248;c[wa+4>>2]=ra;c[wa+8>>2]=va;c[wa+12>>2]=ua;c[wa+16>>2]=oa;c[na>>2]=wa;rb(va,q,r,s);va=c[na>>2]|0;if((s|0)!=(va|0)){if(va|0)Sa[c[(c[va>>2]|0)+20>>2]&127](va)}else Sa[c[(c[va>>2]|0)+16>>2]&127](va);va=c[ma>>2]|0;if((r|0)!=(va|0)){if(va|0)Sa[c[(c[va>>2]|0)+20>>2]&127](va)}else Sa[c[(c[va>>2]|0)+16>>2]&127](va);va=c[la>>2]|0;if((q|0)!=(va|0)){if(va|0)Sa[c[(c[va>>2]|0)+20>>2]&127](va)}else Sa[c[(c[va>>2]|0)+16>>2]&127](va);va=c[n>>2]|0;wa=c[(c[va>>2]|0)+4>>2]|0;c[t>>2]=c[m>>2];ua=c[ka>>2]|0;c[pa>>2]=ua;if(ua|0){xa=ua+4|0;c[xa>>2]=(c[xa>>2]|0)+1}Wa[wa&7](va,T,t);va=c[pa>>2]|0;if(va|0?(wa=va+4|0,xa=c[wa>>2]|0,c[wa>>2]=xa+-1,(xa|0)==0):0){Sa[c[(c[va>>2]|0)+8>>2]&127](va);ih(va)}va=c[o>>2]|0;xa=c[(c[va>>2]|0)+4>>2]|0;c[u>>2]=c[n>>2];wa=c[ea>>2]|0;c[qa>>2]=wa;if(wa|0){ua=wa+4|0;c[ua>>2]=(c[ua>>2]|0)+1}Wa[xa&7](va,T,u);va=c[qa>>2]|0;if(va|0?(xa=va+4|0,ua=c[xa>>2]|0,c[xa>>2]=ua+-1,(ua|0)==0):0){Sa[c[(c[va>>2]|0)+8>>2]&127](va);ih(va)}if(ta){va=c[n>>2]|0;ua=c[ea>>2]|0;if(ua|0){xa=ua+4|0;c[xa>>2]=(c[xa>>2]|0)+1}c[O>>2]=va;va=c[P>>2]|0;c[P>>2]=ua;if(va|0?(ua=va+4|0,xa=c[ua>>2]|0,c[ua>>2]=xa+-1,(xa|0)==0):0){Sa[c[(c[va>>2]|0)+8>>2]&127](va);ih(va)}}va=c[ka>>2]|0;if(va|0?(xa=va+4|0,ua=c[xa>>2]|0,c[xa>>2]=ua+-1,(ua|0)==0):0){Sa[c[(c[va>>2]|0)+8>>2]&127](va);ih(va)}va=c[ea>>2]|0;if(va|0?(ua=va+4|0,xa=c[ua>>2]|0,c[ua>>2]=xa+-1,(xa|0)==0):0){Sa[c[(c[va>>2]|0)+8>>2]&127](va);ih(va)}ra=ra+1|0}while(ra>>>0<6);ra=jh(328)|0;pb(ra,T);c[ra>>2]=4092;Q=k+8|0;R=Q+36|0;do{c[Q>>2]=0;Q=Q+4|0}while((Q|0)<(R|0));c[k+44>>2]=5;c[k>>2]=0;c[k+4>>2]=0;c[k+16>>2]=0;c[k+20>>2]=0;c[k+36>>2]=-256;ea=c[U>>2]|0;ka=c[T>>2]|0;c[ka+((c[ra+4>>2]|0)*48|0)+36>>2]=(ea-ka|0)/48|0;if((c[W>>2]|0)==(ea|0))Mb(T,k);else{Q=ea;Y=k;R=Q+48|0;do{c[Q>>2]=c[Y>>2];Q=Q+4|0;Y=Y+4|0}while((Q|0)<(R|0));c[U>>2]=(c[U>>2]|0)+48}c[l>>2]=ra;ea=jh(16)|0;c[ea+4>>2]=0;c[ea+8>>2]=0;c[ea>>2]=4116;c[ea+12>>2]=ra;ka=l+4|0;c[ka>>2]=ea;c[g>>2]=ra;c[g+4>>2]=ra;Nb(l,g);ra=c[l>>2]|0;ea=c[ka>>2]|0;c[l>>2]=0;c[ka>>2]=0;c[I>>2]=ra;ra=c[J>>2]|0;c[J>>2]=ea;if(ra|0?(ea=ra+4|0,l=c[ea>>2]|0,c[ea>>2]=l+-1,(l|0)==0):0){Sa[c[(c[ra>>2]|0)+8>>2]&127](ra);ih(ra)}ra=c[ka>>2]|0;if(ra|0?(ka=ra+4|0,l=c[ka>>2]|0,c[ka>>2]=l+-1,(l|0)==0):0){Sa[c[(c[ra>>2]|0)+8>>2]&127](ra);ih(ra)}ra=c[I>>2]|0;Wa[c[c[ra>>2]>>2]&7](ra,T,1);ra=c[I>>2]|0;f[ra+52>>2]=1.0;l=c[ra+4>>2]|0;ra=c[T>>2]|0;c[ra+(l*48|0)+8>>2]=1065353216;c[ra+(l*48|0)+12>>2]=1065353216;l=c[(c[I>>2]|0)+4>>2]|0;ra=c[T>>2]|0;c[ra+(l*48|0)+24>>2]=-1027080192;c[ra+(l*48|0)+28>>2]=-1027080192;l=c[(c[I>>2]|0)+4>>2]|0;ra=c[T>>2]|0;c[ra+(l*48|0)>>2]=1056964608;c[ra+(l*48|0)+4>>2]=1056964608;l=c[I>>2]|0;c[l+8>>2]=1056964608;c[l+12>>2]=1056964608;l=c[I>>2]|0;Wa[c[c[l>>2]>>2]&7](l,T,1);f[(c[I>>2]|0)+52>>2]=1.600000023841858;l=jh(464)|0;c[v>>2]=24;c[v+4>>2]=24;ra=w+16|0;c[ra>>2]=0;ka=x+16|0;c[x>>2]=4292;c[x+4>>2]=oa;c[x+8>>2]=d;c[ka>>2]=x;d=y+16|0;c[d>>2]=0;c[g>>2]=c[v>>2];c[g+4>>2]=c[v+4>>2];sb(l,T,g,.25,w,x,y);c[k>>2]=l;v=jh(16)|0;c[v+4>>2]=0;c[v+8>>2]=0;c[v>>2]=4636;c[v+12>>2]=l;ea=k+4|0;c[ea>>2]=v;c[j>>2]=l;c[j+4>>2]=l;yd(k,j);l=c[k>>2]|0;v=c[ea>>2]|0;c[k>>2]=0;c[ea>>2]=0;c[K>>2]=l;l=c[L>>2]|0;c[L>>2]=v;if(l|0?(v=l+4|0,k=c[v>>2]|0,c[v>>2]=k+-1,(k|0)==0):0){Sa[c[(c[l>>2]|0)+8>>2]&127](l);ih(l)}l=c[ea>>2]|0;if(l|0?(ea=l+4|0,k=c[ea>>2]|0,c[ea>>2]=k+-1,(k|0)==0):0){Sa[c[(c[l>>2]|0)+8>>2]&127](l);ih(l)}l=c[d>>2]|0;if((y|0)!=(l|0)){if(l|0)Sa[c[(c[l>>2]|0)+20>>2]&127](l)}else Sa[c[(c[l>>2]|0)+16>>2]&127](l);l=c[ka>>2]|0;if((x|0)!=(l|0)){if(l|0)Sa[c[(c[l>>2]|0)+20>>2]&127](l)}else Sa[c[(c[l>>2]|0)+16>>2]&127](l);l=c[ra>>2]|0;if((w|0)!=(l|0)){if(l|0)Sa[c[(c[l>>2]|0)+20>>2]&127](l)}else Sa[c[(c[l>>2]|0)+16>>2]&127](l);l=c[(c[K>>2]|0)+4>>2]|0;w=c[T>>2]|0;c[w+(l*48|0)+8>>2]=1065353216;c[w+(l*48|0)+12>>2]=1065353216;l=c[K>>2]|0;w=z+16|0;c[z>>2]=4664;c[z+4>>2]=oa;c[w>>2]=z;ra=B+16|0;c[B>>2]=4708;c[B+4>>2]=oa;c[ra>>2]=B;x=C+16|0;c[C>>2]=4752;c[C+4>>2]=oa;c[x>>2]=C;tb(l,z,B,C);l=c[x>>2]|0;if((C|0)!=(l|0)){if(l|0)Sa[c[(c[l>>2]|0)+20>>2]&127](l)}else Sa[c[(c[l>>2]|0)+16>>2]&127](l);l=c[ra>>2]|0;if((B|0)!=(l|0)){if(l|0)Sa[c[(c[l>>2]|0)+20>>2]&127](l)}else Sa[c[(c[l>>2]|0)+16>>2]&127](l);l=c[w>>2]|0;if((z|0)!=(l|0)){if(l|0)Sa[c[(c[l>>2]|0)+20>>2]&127](l)}else Sa[c[(c[l>>2]|0)+16>>2]&127](l);l=c[I>>2]|0;z=c[(c[l>>2]|0)+4>>2]|0;c[D>>2]=c[K>>2];K=D+4|0;w=c[L>>2]|0;c[K>>2]=w;if(w|0){L=w+4|0;c[L>>2]=(c[L>>2]|0)+1}Wa[z&7](l,T,D);D=c[K>>2]|0;if(D|0?(K=D+4|0,l=c[K>>2]|0,c[K>>2]=l+-1,(l|0)==0):0){Sa[c[(c[D>>2]|0)+8>>2]&127](D);ih(D)}D=jh(328)|0;pb(D,T);c[D>>2]=4144;Q=g+8|0;R=Q+36|0;do{c[Q>>2]=0;Q=Q+4|0}while((Q|0)<(R|0));c[g+44>>2]=6;c[g>>2]=0;c[g+4>>2]=0;c[g+16>>2]=0;c[g+20>>2]=0;f[g+24>>2]=2.0;c[g+28>>2]=0;c[g+36>>2]=-1;l=c[U>>2]|0;K=c[T>>2]|0;c[K+((c[D+4>>2]|0)*48|0)+36>>2]=(l-K|0)/48|0;if((c[W>>2]|0)==(l|0))Mb(T,g);else{Q=l;Y=g;R=Q+48|0;do{c[Q>>2]=c[Y>>2];Q=Q+4|0;Y=Y+4|0}while((Q|0)<(R|0));c[U>>2]=(c[U>>2]|0)+48}c[j>>2]=D;U=jh(16)|0;c[U+4>>2]=0;c[U+8>>2]=0;c[U>>2]=4168;c[U+12>>2]=D;Y=j+4|0;c[Y>>2]=U;c[i>>2]=D;c[i+4>>2]=D;Ub(j,i);D=(c[j>>2]|0)+4|0;U=c[D>>2]|0;Q=c[T>>2]|0;c[Q+(U*48|0)+24>>2]=1125515264;c[Q+(U*48|0)+28>>2]=1112014848;U=c[D>>2]|0;D=c[T>>2]|0;c[D+(U*48|0)>>2]=1065353216;c[D+(U*48|0)+4>>2]=0;U=c[j>>2]|0;D=c[U+4>>2]|0;Q=c[T>>2]|0;c[Q+(D*48|0)+16>>2]=-1043857408;c[Q+(D*48|0)+20>>2]=1103626240;c[U+8>>2]=1065353216;c[U+12>>2]=0;U=jh(328)|0;c[i>>2]=0;c[i+4>>2]=0;c[i+8>>2]=0;D=i+11|0;a[D>>0]=4;c[i>>2]=808463920;a[i+4>>0]=0;qb(U,T,i,-1,24.0);c[g>>2]=U;Q=jh(16)|0;c[Q+4>>2]=0;c[Q+8>>2]=0;c[Q>>2]=4220;c[Q+12>>2]=U;R=g+4|0;c[R>>2]=Q;c[h>>2]=U;c[h+4>>2]=U;qe(g,h);h=c[g>>2]|0;U=c[R>>2]|0;c[g>>2]=0;c[R>>2]=0;c[M>>2]=h;h=c[N>>2]|0;c[N>>2]=U;if(h|0?(U=h+4|0,g=c[U>>2]|0,c[U>>2]=g+-1,(g|0)==0):0){Sa[c[(c[h>>2]|0)+8>>2]&127](h);ih(h)}h=c[R>>2]|0;do if(h|0){R=h+4|0;g=c[R>>2]|0;c[R>>2]=g+-1;if(g|0)break;Sa[c[(c[h>>2]|0)+8>>2]&127](h);ih(h)}while(0);if((a[D>>0]|0)<0)kh(c[i>>2]|0);i=c[M>>2]|0;Wa[c[c[i>>2]>>2]&7](i,T,2);i=c[(c[M>>2]|0)+4>>2]|0;D=c[T>>2]|0;c[D+(i*48|0)>>2]=1056964608;c[D+(i*48|0)+4>>2]=1056964608;i=c[M>>2]|0;c[i+8>>2]=1056964608;c[i+12>>2]=1056964608;i=c[S>>2]|0;D=c[(c[i>>2]|0)+4>>2]|0;c[E>>2]=c[o>>2];o=E+4|0;h=c[Z>>2]|0;c[o>>2]=h;if(h|0){g=h+4|0;c[g>>2]=(c[g>>2]|0)+1}Wa[D&7](i,T,E);E=c[o>>2]|0;do if(E|0){o=E+4|0;i=c[o>>2]|0;c[o>>2]=i+-1;if(i|0)break;Sa[c[(c[E>>2]|0)+8>>2]&127](E);ih(E)}while(0);E=c[S>>2]|0;i=c[(c[E>>2]|0)+4>>2]|0;c[F>>2]=c[I>>2];I=F+4|0;o=c[J>>2]|0;c[I>>2]=o;if(o|0){J=o+4|0;c[J>>2]=(c[J>>2]|0)+1}Wa[i&7](E,T,F);F=c[I>>2]|0;do if(F|0){I=F+4|0;E=c[I>>2]|0;c[I>>2]=E+-1;if(E|0)break;Sa[c[(c[F>>2]|0)+8>>2]&127](F);ih(F)}while(0);F=c[j>>2]|0;E=c[(c[F>>2]|0)+4>>2]|0;c[G>>2]=c[M>>2];M=G+4|0;I=c[N>>2]|0;c[M>>2]=I;if(I|0){N=I+4|0;c[N>>2]=(c[N>>2]|0)+1}Wa[E&7](F,T,G);G=c[M>>2]|0;do if(G|0){M=G+4|0;F=c[M>>2]|0;c[M>>2]=F+-1;if(F|0)break;Sa[c[(c[G>>2]|0)+8>>2]&127](G);ih(G)}while(0);G=c[S>>2]|0;S=c[(c[G>>2]|0)+4>>2]|0;c[H>>2]=c[j>>2];j=H+4|0;F=c[Y>>2]|0;c[j>>2]=F;if(F|0){M=F+4|0;c[M>>2]=(c[M>>2]|0)+1}Wa[S&7](G,T,H);H=c[j>>2]|0;do if(H|0){j=H+4|0;T=c[j>>2]|0;c[j>>2]=T+-1;if(T|0)break;Sa[c[(c[H>>2]|0)+8>>2]&127](H);ih(H)}while(0);ub(b);b=c[Y>>2]|0;do if(b|0){Y=b+4|0;H=c[Y>>2]|0;c[Y>>2]=H+-1;if(H|0)break;Sa[c[(c[b>>2]|0)+8>>2]&127](b);ih(b)}while(0);b=c[Z>>2]|0;if(!b){Ka=e;return}Z=b+4|0;H=c[Z>>2]|0;c[Z>>2]=H+-1;if(H|0){Ka=e;return}Sa[c[(c[b>>2]|0)+8>>2]&127](b);ih(b);Ka=e;return}function lb(a){a=a|0;ga(a|0)|0;di()}function mb(a,b){a=a|0;b=b|0;var d=0,e=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,v=0.0,w=0.0,x=0,y=0,z=0,A=0;c[a>>2]=0;c[a+4>>2]=0;c[a+8>>2]=0;c[a+12>>2]=0;c[a+16>>2]=c[b+16>>2];nb(a,c[b+4>>2]|0);d=c[b+8>>2]|0;if(!d)return;b=a+4|0;e=a+12|0;g=a+16|0;h=a+8|0;i=d;j=d;while(1){d=c[j+8>>2]|0;k=c[b>>2]|0;l=(k|0)==0;a:do if(!l){m=k+-1|0;n=(m&k|0)==0;if(!n)if(d>>>0<k>>>0)o=d;else o=(d>>>0)%(k>>>0)|0;else o=m&d;p=c[(c[a>>2]|0)+(o<<2)>>2]|0;if((p|0)!=0?(q=c[p>>2]|0,(q|0)!=0):0){if(n){n=q;while(1){p=c[n+4>>2]|0;if(!((p|0)==(d|0)|(p&m|0)==(o|0))){r=o;s=22;break a}if((c[n+8>>2]|0)==(d|0))break a;n=c[n>>2]|0;if(!n){r=o;s=22;break a}}}n=q;while(1){m=c[n+4>>2]|0;if((m|0)!=(d|0)){if(m>>>0<k>>>0)t=m;else t=(m>>>0)%(k>>>0)|0;if((t|0)!=(o|0)){r=o;s=22;break a}}if((c[n+8>>2]|0)==(d|0))break a;n=c[n>>2]|0;if(!n){r=o;s=22;break}}}else{r=o;s=22}}else{r=0;s=22}while(0);if((s|0)==22){s=0;n=jh(24)|0;c[n+8>>2]=d;sh(n+12|0,j+12|0);c[n+4>>2]=d;c[n>>2]=0;v=+(((c[e>>2]|0)+1|0)>>>0);w=+f[g>>2];do if(l|w*+(k>>>0)<v){q=k<<1|(k>>>0<3|(k+-1&k|0)!=0)&1;m=~~+u(+(v/w))>>>0;nb(a,q>>>0<m>>>0?m:q);q=c[b>>2]|0;m=q+-1|0;if(!(m&q)){x=q;y=m&d;break}if(d>>>0<q>>>0){x=q;y=d}else{x=q;y=(d>>>0)%(q>>>0)|0}}else{x=k;y=r}while(0);k=(c[a>>2]|0)+(y<<2)|0;d=c[k>>2]|0;if(!d){c[n>>2]=c[h>>2];c[h>>2]=n;c[k>>2]=h;k=c[n>>2]|0;if(k|0){l=c[k+4>>2]|0;k=x+-1|0;if(k&x)if(l>>>0<x>>>0)z=l;else z=(l>>>0)%(x>>>0)|0;else z=l&k;A=(c[a>>2]|0)+(z<<2)|0;s=35}}else{c[n>>2]=c[d>>2];A=d;s=35}if((s|0)==35){s=0;c[A>>2]=n}c[e>>2]=(c[e>>2]|0)+1}d=c[i>>2]|0;if(!d)break;else{i=d;j=d}}return}function nb(a,b){a=a|0;b=b|0;var d=0,e=0,g=0,h=0;if((b|0)!=1)if(!(b+-1&b))d=b;else d=fh(b)|0;else d=2;b=c[a+4>>2]|0;if(d>>>0>b>>>0){ob(a,d);return}if(d>>>0>=b>>>0)return;e=~~+u(+(+((c[a+12>>2]|0)>>>0)/+f[a+16>>2]))>>>0;if(b>>>0>2&(b+-1&b|0)==0){g=1<<32-(w(e+-1|0)|0);h=e>>>0<2?e:g}else h=fh(e)|0;e=d>>>0<h>>>0?h:d;if(e>>>0>=b>>>0)return;ob(a,e);return}function ob(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0;d=a+4|0;if(!b){e=c[a>>2]|0;c[a>>2]=0;if(e|0)kh(e);c[d>>2]=0;return}if(b>>>0>1073741823){e=fa(8)|0;ph(e,7751);c[e>>2]=5904;ja(e|0,3912,82)}e=jh(b<<2)|0;f=c[a>>2]|0;c[a>>2]=e;if(f|0)kh(f);c[d>>2]=b;d=0;do{c[(c[a>>2]|0)+(d<<2)>>2]=0;d=d+1|0}while((d|0)!=(b|0));d=a+8|0;f=c[d>>2]|0;if(!f)return;e=c[f+4>>2]|0;g=b+-1|0;h=(g&b|0)==0;if(!h)if(e>>>0<b>>>0)i=e;else i=(e>>>0)%(b>>>0)|0;else i=e&g;c[(c[a>>2]|0)+(i<<2)>>2]=d;d=c[f>>2]|0;if(!d)return;if(h){h=i;e=d;j=f;while(1){k=c[e+4>>2]&g;do if((k|0)==(h|0)){l=h;m=e}else{n=(c[a>>2]|0)+(k<<2)|0;if(!(c[n>>2]|0)){c[n>>2]=j;l=k;m=e;break}n=c[e>>2]|0;a:do if(!n)o=e;else{p=c[e+8>>2]|0;q=e;r=n;while(1){if((p|0)!=(c[r+8>>2]|0)){o=q;break a}s=c[r>>2]|0;if(!s){o=r;break}else{t=r;r=s;q=t}}}while(0);c[j>>2]=c[o>>2];c[o>>2]=c[c[(c[a>>2]|0)+(k<<2)>>2]>>2];c[c[(c[a>>2]|0)+(k<<2)>>2]>>2]=e;l=h;m=j}while(0);e=c[m>>2]|0;if(!e)break;else{h=l;j=m}}return}m=i;i=d;d=f;while(1){f=c[i+4>>2]|0;if(f>>>0<b>>>0)u=f;else u=(f>>>0)%(b>>>0)|0;do if((u|0)==(m|0)){v=m;w=i}else{f=(c[a>>2]|0)+(u<<2)|0;if(!(c[f>>2]|0)){c[f>>2]=d;v=u;w=i;break}f=c[i>>2]|0;b:do if(!f)x=i;else{j=c[i+8>>2]|0;l=i;h=f;while(1){if((j|0)!=(c[h+8>>2]|0)){x=l;break b}e=c[h>>2]|0;if(!e){x=h;break}else{o=h;h=e;l=o}}}while(0);c[d>>2]=c[x>>2];c[x>>2]=c[c[(c[a>>2]|0)+(u<<2)>>2]>>2];c[c[(c[a>>2]|0)+(u<<2)>>2]>>2]=i;v=m;w=d}while(0);i=c[w>>2]|0;if(!i)break;else{m=v;d=w}}return}function pb(d,e){d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0;f=Ka;Ka=Ka+48|0;if((Ka|0)>=(La|0))A(48);g=f;c[d>>2]=4040;h=d+4|0;i=e+4|0;j=c[i>>2]|0;k=(j-(c[e>>2]|0)|0)/48|0;l=d+8|0;c[l>>2]=0;c[l+4>>2]=0;c[l+8>>2]=0;c[l+12>>2]=0;c[l+16>>2]=0;c[l+20>>2]=0;c[d+32>>2]=255;l=d+36|0;c[d+88>>2]=0;c[d+112>>2]=0;c[d+136>>2]=0;a[d+144>>0]=0;a[d+145>>0]=0;c[d+168>>2]=0;c[d+192>>2]=0;c[d+216>>2]=0;a[d+224>>0]=0;c[d+248>>2]=0;c[d+272>>2]=0;c[d+296>>2]=0;m=d+304|0;c[l>>2]=0;c[l+4>>2]=0;c[l+8>>2]=0;c[l+12>>2]=0;c[l+16>>2]=0;c[l+20>>2]=0;c[l+24>>2]=0;b[l+28>>1]=0;c[m>>2]=0;c[m+4>>2]=0;c[m+8>>2]=0;c[m+12>>2]=0;c[m+16>>2]=0;c[h>>2]=k;m=g;l=m+40|0;do{c[m>>2]=0;m=m+4|0}while((m|0)<(l|0));c[g+44>>2]=1;c[g+32>>2]=k;c[g+40>>2]=1;if((c[e+8>>2]|0)>>>0>j>>>0){m=j;j=g;l=m+48|0;do{c[m>>2]=c[j>>2];m=m+4|0;j=j+4|0}while((m|0)<(l|0));j=(c[i>>2]|0)+48|0;c[i>>2]=j;n=j;o=c[e>>2]|0;p=n-o|0;q=(p|0)/48|0;r=q+-1|0;s=c[h>>2]|0;t=o;u=t+(s*48|0)+36|0;c[u>>2]=r;Ka=f;return}else{Cb(e,g);n=c[i>>2]|0;o=c[e>>2]|0;p=n-o|0;q=(p|0)/48|0;r=q+-1|0;s=c[h>>2]|0;t=o;u=t+(s*48|0)+36|0;c[u>>2]=r;Ka=f;return}}function qb(b,d,e,g,h){b=b|0;d=d|0;e=e|0;g=g|0;h=+h;var i=0,j=0,k=0,l=0,m=0,n=0;i=Ka;Ka=Ka+48|0;if((Ka|0)>=(La|0))A(48);j=i;pb(b,d);c[b>>2]=4196;k=j+8|0;l=k+36|0;do{c[k>>2]=0;k=k+4|0}while((k|0)<(l|0));c[j+44>>2]=8;c[j>>2]=0;c[j+4>>2]=0;f[j+24>>2]=h;c[j+32>>2]=g;if(!(bc(15620,e)|0)){g=c[3903]|0;m=(g-(c[3902]|0)|0)/12|0;n=g;if((c[3904]|0)==(n|0))cc(15608,e);else{sh(n,e);c[3903]=(c[3903]|0)+12}c[(ac(15620,e)|0)>>2]=m}c[j+36>>2]=c[(ac(15620,e)|0)>>2];f[j+16>>2]=+V(((a[e+11>>0]|0)<0?c[e>>2]|0:e)|0,+h);f[j+20>>2]=h;e=d+4|0;m=c[e>>2]|0;n=c[d>>2]|0;c[n+((c[b+4>>2]|0)*48|0)+36>>2]=(m-n|0)/48|0;if((c[d+8>>2]|0)==(m|0)){Mb(d,j);Ka=i;return}else{k=m;m=j;l=k+48|0;do{c[k>>2]=c[m>>2];k=k+4|0;m=m+4|0}while((k|0)<(l|0));c[e>>2]=(c[e>>2]|0)+48;Ka=i;return}}function rb(b,d,e,f){b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0;g=Ka;Ka=Ka+32|0;if((Ka|0)>=(La|0))A(32);h=g;i=b+152|0;j=c[d+16>>2]|0;do if(j)if((d|0)==(j|0)){k=h+16|0;c[k>>2]=h;Ua[c[(c[j>>2]|0)+12>>2]&31](j,h);l=k;break}else{k=h+16|0;c[k>>2]=Na[c[(c[j>>2]|0)+8>>2]&31](j)|0;l=k;break}else{k=h+16|0;c[k>>2]=0;l=k}while(0);kc(h,i);i=c[l>>2]|0;if((h|0)!=(i|0)){if(i|0)Sa[c[(c[i>>2]|0)+20>>2]&127](i)}else Sa[c[(c[i>>2]|0)+16>>2]&127](i);i=b+176|0;l=c[e+16>>2]|0;do if(l)if((e|0)==(l|0)){j=h+16|0;c[j>>2]=h;Ua[c[(c[l>>2]|0)+12>>2]&31](l,h);m=j;break}else{j=h+16|0;c[j>>2]=Na[c[(c[l>>2]|0)+8>>2]&31](l)|0;m=j;break}else{j=h+16|0;c[j>>2]=0;m=j}while(0);kc(h,i);i=c[m>>2]|0;if((h|0)!=(i|0)){if(i|0)Sa[c[(c[i>>2]|0)+20>>2]&127](i)}else Sa[c[(c[i>>2]|0)+16>>2]&127](i);i=b+200|0;m=c[f+16>>2]|0;do if(m)if((f|0)==(m|0)){l=h+16|0;c[l>>2]=h;Ua[c[(c[m>>2]|0)+12>>2]&31](m,h);n=l;break}else{l=h+16|0;c[l>>2]=Na[c[(c[m>>2]|0)+8>>2]&31](m)|0;n=l;break}else{l=h+16|0;c[l>>2]=0;n=l}while(0);lc(h,i);i=c[n>>2]|0;if((h|0)==(i|0)){Sa[c[(c[i>>2]|0)+16>>2]&127](i);o=b+144|0;a[o>>0]=1;Ka=g;return}if(!i){o=b+144|0;a[o>>0]=1;Ka=g;return}Sa[c[(c[i>>2]|0)+20>>2]&127](i);o=b+144|0;a[o>>0]=1;Ka=g;return}function sb(b,d,e,g,h,i,j){b=b|0;d=d|0;e=e|0;g=+g;h=h|0;i=i|0;j=j|0;var k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,w=0,x=0,y=0,z=0,B=0,C=0,D=0,E=0,F=0,G=0.0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ba=0,ca=0,da=0,ea=0,fa=0.0,ga=0,ha=0,ia=0,ja=0,ka=0,la=0;k=Ka;Ka=Ka+112|0;if((Ka|0)>=(La|0))A(112);l=k+88|0;m=k+56|0;n=k+80|0;o=k+72|0;p=k+64|0;q=k+32|0;r=k;pb(b,d);c[b>>2]=4436;s=e;t=c[s>>2]|0;u=c[s+4>>2]|0;s=b+324|0;c[s>>2]=t;c[s+4>>2]=u;s=b+332|0;w=s;c[w>>2]=t;c[w+4>>2]=u;u=b+344|0;w=h+16|0;x=c[w>>2]|0;do if(x)if((h|0)==(x|0)){c[b+360>>2]=u;y=c[w>>2]|0;Ua[c[(c[y>>2]|0)+12>>2]&31](y,u);break}else{c[b+360>>2]=Na[c[(c[x>>2]|0)+8>>2]&31](x)|0;break}else c[b+360>>2]=0;while(0);x=b+368|0;u=i+16|0;h=c[u>>2]|0;do if(h)if((i|0)==(h|0)){c[b+384>>2]=x;y=c[u>>2]|0;Ua[c[(c[y>>2]|0)+12>>2]&31](y,x);break}else{c[b+384>>2]=Na[c[(c[h>>2]|0)+8>>2]&31](h)|0;break}else c[b+384>>2]=0;while(0);h=b+392|0;x=j+16|0;y=c[x>>2]|0;do if(y)if((j|0)==(y|0)){c[b+408>>2]=h;z=c[x>>2]|0;Ua[c[(c[z>>2]|0)+12>>2]&31](z,h);break}else{c[b+408>>2]=Na[c[(c[y>>2]|0)+8>>2]&31](y)|0;break}else c[b+408>>2]=0;while(0);y=b+416|0;h=b+420|0;x=b+424|0;j=b+428|0;z=b+432|0;c[y>>2]=0;c[y+4>>2]=0;c[y+8>>2]=0;c[y+12>>2]=0;c[y+16>>2]=0;f[b+436>>2]=g;B=b+440|0;C=b+444|0;D=c[s>>2]|0;s=c[b+336>>2]|0;E=b+448|0;f[E>>2]=g/+(D+1|0);F=b+452|0;f[F>>2]=g/+(s+1|0);a[b+456>>0]=0;G=1.0-g;f[B>>2]=G/+(D|0);f[C>>2]=G/+(s|0);s=e+4|0;D=c[s>>2]|0;a:do if((D|0)>0){H=l+4|0;I=l+8|0;J=l+4|0;K=l+4|0;L=b+440|0;M=p+4|0;N=0;O=t;P=0;Q=0;R=t;S=t;while(1){c[l>>2]=0;c[H>>2]=0;c[I>>2]=0;if(P>>>0>=Q>>>0){Sc(x,l);T=c[l>>2]|0;if(!T){U=O;V=S;W=R}else{X=c[H>>2]|0;if((X|0)==(T|0)){Y=O;Z=T}else{_=X;do{X=c[_+-4>>2]|0;_=_+-8|0;if(X|0?($=X+4|0,aa=c[$>>2]|0,c[$>>2]=aa+-1,(aa|0)==0):0){Sa[c[(c[X>>2]|0)+8>>2]&127](X);ih(X)}}while((_|0)!=(T|0));Y=c[e>>2]|0;Z=c[l>>2]|0}c[H>>2]=T;kh(Z);U=Y;V=Y;W=Y}}else{c[P>>2]=0;_=P+4|0;c[_>>2]=0;X=P+8|0;c[X>>2]=0;c[P>>2]=c[l>>2];c[_>>2]=c[H>>2];c[X>>2]=c[I>>2];c[I>>2]=0;c[H>>2]=0;c[l>>2]=0;c[j>>2]=(c[j>>2]|0)+12;U=O;V=S;W=R}if((V|0)>0){G=+(N|0);X=N+1|0;g=+(X|0);_=0;while(1){aa=c[x>>2]|0;c[l>>2]=0;c[J>>2]=0;$=aa+(N*12|0)+4|0;ba=c[$>>2]|0;if(ba>>>0>=(c[aa+(N*12|0)+8>>2]|0)>>>0){Tc(aa+(N*12|0)|0,l);aa=c[J>>2]|0;if(aa|0?(ca=aa+4|0,da=c[ca>>2]|0,c[ca>>2]=da+-1,(da|0)==0):0){Sa[c[(c[aa>>2]|0)+8>>2]&127](aa);ih(aa)}}else{c[ba>>2]=0;c[ba+4>>2]=0;c[l>>2]=0;c[J>>2]=0;c[$>>2]=ba+8}ba=c[w>>2]|0;if(!ba)ea=_+1|0;else{$=Na[c[(c[ba>>2]|0)+24>>2]&31](ba)|0;c[l>>2]=$;ba=jh(16)|0;c[ba+4>>2]=0;c[ba+8>>2]=0;c[ba>>2]=4064;c[ba+12>>2]=$;c[K>>2]=ba;c[m>>2]=$;c[m+4>>2]=$;Fb(l,m);$=c[C>>2]|0;ba=(c[l>>2]|0)+4|0;aa=c[ba>>2]|0;da=c[d>>2]|0;c[da+(aa*48|0)+8>>2]=c[B>>2];c[da+(aa*48|0)+12>>2]=$;$=_+1|0;fa=+f[C>>2]*G+ +f[F>>2]*g;aa=c[ba>>2]|0;ba=c[d>>2]|0;f[ba+(aa*48|0)>>2]=+f[L>>2]*+(_|0)+ +f[E>>2]*+($|0);f[ba+(aa*48|0)+4>>2]=fa;aa=c[l>>2]|0;ba=aa+4|0;da=c[ba>>2]|0;ca=c[d>>2]|0;c[ca+(da*48|0)+16>>2]=1065353216;c[ca+(da*48|0)+20>>2]=1065353216;da=c[ba>>2]|0;ba=c[d>>2]|0;c[ba+(da*48|0)+24>>2]=-1073741824;c[ba+(da*48|0)+28>>2]=-1073741824;da=c[(c[b>>2]|0)+4>>2]|0;c[p>>2]=aa;aa=c[K>>2]|0;c[M>>2]=aa;if(aa|0){ba=aa+4|0;c[ba>>2]=(c[ba>>2]|0)+1}Wa[da&7](b,d,p);da=c[M>>2]|0;if(da|0?(ba=da+4|0,aa=c[ba>>2]|0,c[ba>>2]=aa+-1,(aa|0)==0):0){Sa[c[(c[da>>2]|0)+8>>2]&127](da);ih(da)}da=c[K>>2]|0;if(da|0?(aa=da+4|0,ba=c[aa>>2]|0,c[aa>>2]=ba+-1,(ba|0)==0):0){Sa[c[(c[da>>2]|0)+8>>2]&127](da);ih(da)}ea=$}$=c[e>>2]|0;if((ea|0)<($|0))_=ea;else{ga=X;ha=$;ia=$;ja=$;break}}}else{ga=N+1|0;ha=U;ia=W;ja=V}X=c[s>>2]|0;if((ga|0)>=(X|0)){ka=X;la=ia;break a}N=ga;O=ha;P=c[j>>2]|0;Q=c[z>>2]|0;R=ia;S=ja}}else{ka=D;la=t}while(0);t=jh(12)|0;D=v(ka<<1,la)|0;c[r>>2]=d;la=r+8|0;ka=c[u>>2]|0;do if(ka)if((i|0)==(ka|0)){c[r+24>>2]=la;Ua[c[(c[ka>>2]|0)+12>>2]&31](ka,la);break}else{c[r+24>>2]=Na[c[(c[ka>>2]|0)+8>>2]&31](ka)|0;break}else c[r+24>>2]=0;while(0);ka=q+16|0;c[ka>>2]=0;la=jh(40)|0;c[la>>2]=4488;c[la+8>>2]=c[r>>2];i=la+16|0;u=r+24|0;ja=c[u>>2]|0;do if(ja)if((r+8|0)==(ja|0)){c[la+32>>2]=i;Ua[c[(c[ja>>2]|0)+12>>2]&31](ja,i);break}else{c[la+32>>2]=ja;c[u>>2]=0;break}else c[la+32>>2]=0;while(0);c[ka>>2]=la;Rc(t,d,D,b,q);c[o>>2]=0;c[l>>2]=c[o>>2];Uc(n,t,l);l=c[n>>2]|0;c[n>>2]=c[y>>2];c[y>>2]=l;l=n+4|0;n=c[l>>2]|0;y=c[h>>2]|0;c[l>>2]=y;c[h>>2]=n;n=y;if(y|0?(h=n+4|0,l=c[h>>2]|0,c[h>>2]=l+-1,(l|0)==0):0){Sa[c[(c[y>>2]|0)+8>>2]&127](n);ih(n)}n=c[ka>>2]|0;if((q|0)!=(n|0)){if(n|0)Sa[c[(c[n>>2]|0)+20>>2]&127](n)}else Sa[c[(c[n>>2]|0)+16>>2]&127](n);n=c[u>>2]|0;if((r+8|0)==(n|0)){Sa[c[(c[n>>2]|0)+16>>2]&127](n);Ka=k;return}if(!n){Ka=k;return}Sa[c[(c[n>>2]|0)+20>>2]&127](n);Ka=k;return}function tb(b,d,e,f){b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0;g=Ka;Ka=Ka+32|0;if((Ka|0)>=(La|0))A(32);h=g;i=b+232|0;j=c[d+16>>2]|0;do if(j)if((d|0)==(j|0)){k=h+16|0;c[k>>2]=h;Ua[c[(c[j>>2]|0)+12>>2]&31](j,h);l=k;break}else{k=h+16|0;c[k>>2]=Na[c[(c[j>>2]|0)+8>>2]&31](j)|0;l=k;break}else{k=h+16|0;c[k>>2]=0;l=k}while(0);lc(h,i);i=c[l>>2]|0;if((h|0)!=(i|0)){if(i|0)Sa[c[(c[i>>2]|0)+20>>2]&127](i)}else Sa[c[(c[i>>2]|0)+16>>2]&127](i);i=b+256|0;l=c[e+16>>2]|0;do if(l)if((e|0)==(l|0)){j=h+16|0;c[j>>2]=h;Ua[c[(c[l>>2]|0)+12>>2]&31](l,h);m=j;break}else{j=h+16|0;c[j>>2]=Na[c[(c[l>>2]|0)+8>>2]&31](l)|0;m=j;break}else{j=h+16|0;c[j>>2]=0;m=j}while(0);lc(h,i);i=c[m>>2]|0;if((h|0)!=(i|0)){if(i|0)Sa[c[(c[i>>2]|0)+20>>2]&127](i)}else Sa[c[(c[i>>2]|0)+16>>2]&127](i);i=b+280|0;m=c[f+16>>2]|0;do if(m)if((f|0)==(m|0)){l=h+16|0;c[l>>2]=h;Ua[c[(c[m>>2]|0)+12>>2]&31](m,h);n=l;break}else{l=h+16|0;c[l>>2]=Na[c[(c[m>>2]|0)+8>>2]&31](m)|0;n=l;break}else{l=h+16|0;c[l>>2]=0;n=l}while(0);lc(h,i);i=c[n>>2]|0;if((h|0)==(i|0)){Sa[c[(c[i>>2]|0)+16>>2]&127](i);o=b+224|0;a[o>>0]=1;Ka=g;return}if(!i){o=b+224|0;a[o>>0]=1;Ka=g;return}Sa[c[(c[i>>2]|0)+20>>2]&127](i);o=b+224|0;a[o>>0]=1;Ka=g;return}function ub(b){b=b|0;var d=0,e=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0.0,r=0.0;d=Ka;Ka=Ka+48|0;if((Ka|0)>=(La|0))A(48);e=d+32|0;h=d+24|0;i=d+16|0;j=d+8|0;k=d;l=d+40|0;switch(c[b+32>>2]|0){case 0:{m=jh(28)|0;c[m+4>>2]=0;c[m+8>>2]=-1;c[m+20>>2]=0;c[m+24>>2]=0;c[m>>2]=4824;n=m+12|0;c[n>>2]=8;c[n+4>>2]=6;c[l>>2]=m;n=jh(16)|0;o=b+36|0;c[n+4>>2]=0;c[n+8>>2]=0;c[n>>2]=4796;c[n+12>>2]=m;p=l+4|0;c[p>>2]=n;c[k>>2]=m;c[k+4>>2]=m;se(l,k);k=c[l>>2]|0;c[l>>2]=c[o>>2];c[o>>2]=k;k=b+40|0;o=c[p>>2]|0;m=c[k>>2]|0;c[p>>2]=m;c[k>>2]=o;o=m;if(m|0?(k=o+4|0,p=c[k>>2]|0,c[k>>2]=p+-1,(p|0)==0):0){Sa[c[(c[m>>2]|0)+8>>2]&127](o);ih(o)}break}case 1:{o=jh(48)|0;c[o+4>>2]=0;c[o+8>>2]=-1;c[o+20>>2]=0;c[o+24>>2]=0;c[o>>2]=4904;m=o+12|0;p=o+28|0;k=p+20|0;do{a[p>>0]=0;p=p+1|0}while((p|0)<(k|0));p=m;c[p>>2]=8;c[p+4>>2]=6;c[l>>2]=o;p=jh(16)|0;m=b+36|0;c[p+4>>2]=0;c[p+8>>2]=0;c[p>>2]=4876;c[p+12>>2]=o;k=l+4|0;c[k>>2]=p;c[j>>2]=o;c[j+4>>2]=o;se(l,j);j=c[l>>2]|0;c[l>>2]=c[m>>2];c[m>>2]=j;j=b+40|0;m=c[k>>2]|0;o=c[j>>2]|0;c[k>>2]=o;c[j>>2]=m;m=o;if(o|0?(j=m+4|0,k=c[j>>2]|0,c[j>>2]=k+-1,(k|0)==0):0){Sa[c[(c[o>>2]|0)+8>>2]&127](m);ih(m)}break}case 2:{m=jh(36)|0;c[m+4>>2]=0;c[m+8>>2]=-1;c[m+20>>2]=7;c[m+24>>2]=1;c[m>>2]=4972;c[m+28>>2]=0;c[m+32>>2]=0;o=m+12|0;c[o>>2]=8;c[o+4>>2]=13;c[l>>2]=m;o=jh(16)|0;k=b+36|0;c[o+4>>2]=0;c[o+8>>2]=0;c[o>>2]=4944;c[o+12>>2]=m;j=l+4|0;c[j>>2]=o;c[i>>2]=m;c[i+4>>2]=m;se(l,i);i=c[l>>2]|0;c[l>>2]=c[k>>2];c[k>>2]=i;i=b+40|0;k=c[j>>2]|0;m=c[i>>2]|0;c[j>>2]=m;c[i>>2]=k;k=m;if(m|0?(i=k+4|0,j=c[i>>2]|0,c[i>>2]=j+-1,(j|0)==0):0){Sa[c[(c[m>>2]|0)+8>>2]&127](k);ih(k)}break}case 3:{k=jh(52)|0;re(k);c[l>>2]=k;m=jh(16)|0;j=b+36|0;c[m+4>>2]=0;c[m+8>>2]=0;c[m>>2]=5012;c[m+12>>2]=k;i=l+4|0;c[i>>2]=m;c[h>>2]=k;c[h+4>>2]=k;se(l,h);h=c[l>>2]|0;c[l>>2]=c[j>>2];c[j>>2]=h;h=b+40|0;j=c[i>>2]|0;l=c[h>>2]|0;c[i>>2]=l;c[h>>2]=j;j=l;if(l|0?(h=j+4|0,i=c[h>>2]|0,c[h>>2]=i+-1,(i|0)==0):0){Sa[c[(c[l>>2]|0)+8>>2]&127](j);ih(j)}break}default:{}}j=b+36|0;l=c[j>>2]|0;c[l+4>>2]=c[b+92>>2];q=+(c[l+12>>2]|0)/+(c[l+16>>2]|0);f[(c[b+44>>2]|0)+52>>2]=q;g[e>>3]=q;Zg(10734,e)|0;e=c[b+52>>2]|0;l=(c[j>>2]|0)+12|0;Cf(e,b+4|0);j=l;l=c[j>>2]|0;i=c[j+4>>2]|0;j=e+332|0;c[j>>2]=l;c[j+4>>2]=i;q=+f[e+436>>2];r=1.0-q;f[e+440>>2]=r/+(l|0);f[e+444>>2]=r/+(i|0);f[e+448>>2]=q/+(l+1|0);f[e+452>>2]=q/+(i+1|0);me(b);Ka=d;return}function vb(a,b,c){a=a|0;b=+b;c=c|0;return}function wb(a,b){a=a|0;b=b|0;return}function xb(a,b){a=a|0;b=b|0;return}function yb(a,b,d){a=a|0;b=b|0;d=d|0;c[a+56>>2]=d;return}function zb(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0;e=c[d>>2]|0;f=c[b>>2]|0;c[f+((c[a+4>>2]|0)*48|0)+36>>2]=c[f+((c[e+4>>2]|0)*48|0)+36>>2];f=a+316|0;b=c[f>>2]|0;if((b|0)==(c[a+320>>2]|0)){Db(a+312|0,d);return}c[b>>2]=e;e=c[d+4>>2]|0;c[b+4>>2]=e;if(!e)g=b;else{b=e+4|0;c[b>>2]=(c[b>>2]|0)+1;g=c[f>>2]|0}c[f>>2]=g+8;return}function Ab(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var g=0,h=0,i=0,j=0,k=0,l=0.0,m=0.0,n=0,o=0,p=0.0,q=0.0,r=0.0,s=0.0;g=Ka;Ka=Ka+16|0;if((Ka|0)>=(La|0))A(16);h=g;i=d;j=c[i+4>>2]|0;k=a+44|0;c[k>>2]=c[i>>2];c[k+4>>2]=j;j=e;k=c[j+4>>2]|0;i=a+36|0;c[i>>2]=c[j>>2];c[i+4>>2]=k;k=c[a+4>>2]|0;i=c[b>>2]|0;l=+f[i+(k*48|0)+8>>2]*+f[e>>2]+ +f[i+(k*48|0)+24>>2];j=e+4|0;m=+f[i+(k*48|0)+12>>2]*+f[j>>2]+ +f[i+(k*48|0)+28>>2];n=a+24|0;f[n>>2]=l;o=a+28|0;f[o>>2]=m;do if((c[a+56>>2]|0)==1){p=+f[a+52>>2];q=m*p;if(q<l){f[n>>2]=q;r=q;s=m;break}else{q=l/p;f[o>>2]=q;r=l;s=q;break}}else{r=l;s=m}while(0);m=+f[i+(k*48|0)+20>>2]+(+f[d+4>>2]+ +f[j>>2]*+f[i+(k*48|0)+4>>2]-s*+f[a+12>>2]);f[a+16>>2]=+f[i+(k*48|0)+16>>2]+(+f[d>>2]+ +f[e>>2]*+f[i+(k*48|0)>>2]-r*+f[a+8>>2]);f[a+20>>2]=m;Eb(h,a,b);Ka=g;return}function Bb(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;return}function Cb(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;d=a+4|0;e=c[a>>2]|0;f=(c[d>>2]|0)-e|0;g=(f|0)/48|0;h=g+1|0;if(h>>>0>89478485)Hh(a);i=a+8|0;j=((c[i>>2]|0)-e|0)/48|0;k=j<<1;l=j>>>0<44739242?(k>>>0<h>>>0?h:k):89478485;do if(l)if(l>>>0>89478485){k=fa(8)|0;ph(k,7751);c[k>>2]=5904;ja(k|0,3912,82)}else{m=jh(l*48|0)|0;break}else m=0;while(0);k=m+(g*48|0)|0;g=m+(l*48|0)|0;l=k;m=b;b=l+48|0;do{c[l>>2]=c[m>>2];l=l+4|0;m=m+4|0}while((l|0)<(b|0));m=k+(((f|0)/-48|0)*48|0)|0;if((f|0)>0)Mi(m|0,e|0,f|0)|0;c[a>>2]=m;c[d>>2]=k+48;c[i>>2]=g;if(!e)return;kh(e);return}function Db(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0;d=a+4|0;e=c[d>>2]|0;f=c[a>>2]|0;g=e-f>>3;h=g+1|0;i=f;j=e;if(h>>>0>536870911)Hh(a);e=a+8|0;k=(c[e>>2]|0)-f|0;f=k>>2;l=k>>3>>>0<268435455?(f>>>0<h>>>0?h:f):536870911;do if(l)if(l>>>0>536870911){f=fa(8)|0;ph(f,7751);c[f>>2]=5904;ja(f|0,3912,82)}else{m=jh(l<<3)|0;break}else m=0;while(0);f=m+(g<<3)|0;h=m+(l<<3)|0;c[f>>2]=c[b>>2];l=c[b+4>>2]|0;c[m+(g<<3)+4>>2]=l;if(!l){n=i;o=j}else{j=l+4|0;c[j>>2]=(c[j>>2]|0)+1;n=c[a>>2]|0;o=c[d>>2]|0}j=f+8|0;l=n;if((o|0)==(n|0)){p=f;q=l;r=o}else{i=g+-1-((o+-8-l|0)>>>3)|0;l=o;o=f;do{f=o;o=o+-8|0;g=l;l=l+-8|0;c[o>>2]=c[l>>2];b=g+-4|0;c[f+-4>>2]=c[b>>2];c[l>>2]=0;c[b>>2]=0}while((l|0)!=(n|0));p=m+(i<<3)|0;q=c[a>>2]|0;r=c[d>>2]|0}c[a>>2]=p;c[d>>2]=j;c[e>>2]=h;h=q;if((r|0)!=(h|0)){e=r;do{r=c[e+-4>>2]|0;e=e+-8|0;if(r|0?(j=r+4|0,d=c[j>>2]|0,c[j>>2]=d+-1,(d|0)==0):0){Sa[c[(c[r>>2]|0)+8>>2]&127](r);ih(r)}}while((e|0)!=(h|0))}if(!q)return;kh(q);return}function Eb(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,B=0,C=0,D=0,E=0,F=0.0,G=0.0,H=0.0;e=Ka;Ka=Ka+32|0;if((Ka|0)>=(La|0))A(32);g=e+20|0;h=e+16|0;i=e+12|0;j=e+8|0;k=e;c[g>>2]=0;c[h>>2]=0;c[i>>2]=0;c[j>>2]=0;l=b+16|0;m=l;n=c[m+4>>2]|0;o=k;c[o>>2]=c[m>>2];c[o+4>>2]=n;n=c[b+312>>2]|0;o=c[b+316>>2]|0;if((n|0)==(o|0)){p=0;q=0;r=0;s=0;c[a>>2]=q;t=a+4|0;c[t>>2]=s;u=a+8|0;c[u>>2]=p;v=a+12|0;c[v>>2]=r;Ka=e;return}m=b+60|0;w=b+24|0;b=k+4|0;x=n;do{n=c[x>>2]|0;y=c[x+4>>2]|0;z=(y|0)==0;if(!z){B=y+4|0;c[B>>2]=(c[B>>2]|0)+1}B=c[m>>2]|0;do if((B|0)!=2){C=n;D=c[(c[n>>2]|0)+8>>2]|0;if((B|0)==1){Xa[D&15](C,d,k,w);f[k>>2]=+f[C+16>>2]+ +f[C+24>>2];E=C;break}else{Xa[D&15](C,d,l,w);E=C;break}}else{C=n;Xa[c[(c[n>>2]|0)+8>>2]&15](C,d,k,w);f[b>>2]=+f[C+20>>2]+ +f[C+28>>2];E=C}while(0);F=+f[E+16>>2];G=+f[g>>2];f[g>>2]=F<G?F:G;G=+f[E+20>>2];H=+f[h>>2];f[h>>2]=G<H?G:H;H=F+ +f[E+24>>2];F=+f[i>>2];f[i>>2]=F<H?H:F;F=G+ +f[E+28>>2];G=+f[j>>2];f[j>>2]=G<F?F:G;if(!z?(n=y+4|0,B=c[n>>2]|0,c[n>>2]=B+-1,(B|0)==0):0){Sa[c[(c[y>>2]|0)+8>>2]&127](y);ih(y)}x=x+8|0}while((x|0)!=(o|0));p=c[i>>2]|0;q=c[g>>2]|0;r=c[j>>2]|0;s=c[h>>2]|0;c[a>>2]=q;t=a+4|0;c[t>>2]=s;u=a+8|0;c[u>>2]=p;v=a+12|0;c[v>>2]=r;Ka=e;return}function Fb(a,b){a=a|0;b=b|0;return}function Gb(a){a=a|0;hh(a);kh(a);return}function Hb(a){a=a|0;var b=0;b=c[a+12>>2]|0;if(!b)return;jc(b);kh(b);return}function Ib(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==7944?a+12|0:0)|0}function Jb(a){a=a|0;kh(a);return}function Kb(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0.0,o=0.0,p=0,q=0,r=0.0,s=0.0,t=0.0,u=0.0;g=Ka;Ka=Ka+32|0;if((Ka|0)>=(La|0))A(32);h=g+8|0;i=g;j=g+16|0;k=a+24|0;l=c[k+4>>2]|0;m=h;c[m>>2]=c[k>>2];c[m+4>>2]=l;l=a+16|0;m=c[l+4>>2]|0;k=i;c[k>>2]=c[l>>2];c[k+4>>2]=m;m=d;k=c[m+4>>2]|0;l=a+44|0;c[l>>2]=c[m>>2];c[l+4>>2]=k;k=e;l=c[k+4>>2]|0;m=a+36|0;c[m>>2]=c[k>>2];c[m+4>>2]=l;l=c[a+4>>2]|0;m=c[b>>2]|0;n=+f[m+(l*48|0)+8>>2]*+f[e>>2]+ +f[m+(l*48|0)+24>>2];k=e+4|0;o=+f[m+(l*48|0)+12>>2]*+f[k>>2]+ +f[m+(l*48|0)+28>>2];p=a+24|0;f[p>>2]=n;q=a+28|0;f[q>>2]=o;do if((c[a+56>>2]|0)==1){r=+f[a+52>>2];s=o*r;if(s<n){f[p>>2]=s;t=o;u=s;break}else{s=n/r;f[q>>2]=s;t=s;u=n;break}}else{t=o;u=n}while(0);n=+f[m+(l*48|0)+20>>2]+(+f[d+4>>2]+ +f[k>>2]*+f[m+(l*48|0)+4>>2]-t*+f[a+12>>2]);f[a+16>>2]=+f[m+(l*48|0)+16>>2]+(+f[d>>2]+ +f[e>>2]*+f[m+(l*48|0)>>2]-u*+f[a+8>>2]);f[a+20>>2]=n;Xa[c[(c[a>>2]|0)+12>>2]&15](a,b,i,h);Eb(j,a,b);Ka=g;return}function Lb(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0;e=c[b>>2]|0;b=(c[e+((c[a+4>>2]|0)*48|0)+32>>2]|0)+1|0;d=a+16|0;f=c[d+4>>2]|0;g=e+(b*48|0)|0;c[g>>2]=c[d>>2];c[g+4>>2]=f;f=a+24|0;a=c[f+4>>2]|0;g=e+(b*48|0)+16|0;c[g>>2]=c[f>>2];c[g+4>>2]=a;return}function Mb(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;d=a+4|0;e=c[a>>2]|0;f=(c[d>>2]|0)-e|0;g=(f|0)/48|0;h=g+1|0;if(h>>>0>89478485)Hh(a);i=a+8|0;j=((c[i>>2]|0)-e|0)/48|0;k=j<<1;l=j>>>0<44739242?(k>>>0<h>>>0?h:k):89478485;do if(l)if(l>>>0>89478485){k=fa(8)|0;ph(k,7751);c[k>>2]=5904;ja(k|0,3912,82)}else{m=jh(l*48|0)|0;break}else m=0;while(0);k=m+(g*48|0)|0;g=m+(l*48|0)|0;l=k;m=b;b=l+48|0;do{c[l>>2]=c[m>>2];l=l+4|0;m=m+4|0}while((l|0)<(b|0));m=k+(((f|0)/-48|0)*48|0)|0;if((f|0)>0)Mi(m|0,e|0,f|0)|0;c[a>>2]=m;c[d>>2]=k+48;c[i>>2]=g;if(!e)return;kh(e);return}function Nb(a,b){a=a|0;b=b|0;return}function Ob(a){a=a|0;hh(a);kh(a);return}function Pb(a){a=a|0;var b=0;b=c[a+12>>2]|0;if(!b)return;jc(b);kh(b);return}function Qb(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==8128?a+12|0:0)|0}function Rb(a){a=a|0;kh(a);return}function Sb(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0.0,p=0.0,q=0,r=0,s=0,t=0.0,u=0.0,v=0.0,w=0.0,x=0,y=0,z=0;g=Ka;Ka=Ka+32|0;if((Ka|0)>=(La|0))A(32);h=g+8|0;i=g;j=g+16|0;k=a+24|0;l=k;m=c[l+4>>2]|0;n=h;c[n>>2]=c[l>>2];c[n+4>>2]=m;m=a+16|0;n=c[m+4>>2]|0;l=i;c[l>>2]=c[m>>2];c[l+4>>2]=n;n=d;l=c[n+4>>2]|0;m=a+44|0;c[m>>2]=c[n>>2];c[m+4>>2]=l;l=e;m=c[l+4>>2]|0;n=a+36|0;c[n>>2]=c[l>>2];c[n+4>>2]=m;m=c[a+4>>2]|0;n=c[b>>2]|0;o=+f[n+(m*48|0)+8>>2]*+f[e>>2]+ +f[n+(m*48|0)+24>>2];l=e+4|0;p=+f[n+(m*48|0)+12>>2]*+f[l>>2]+ +f[n+(m*48|0)+28>>2];q=a+24|0;f[q>>2]=o;r=a+28|0;f[r>>2]=p;s=a+56|0;do if((c[s>>2]|0)==1){t=+f[a+52>>2];u=p*t;if(u<o){f[q>>2]=u;v=p;w=u;break}else{u=o/t;f[r>>2]=u;v=u;w=o;break}}else{v=p;w=o}while(0);o=+f[n+(m*48|0)+20>>2]+(+f[d+4>>2]+ +f[l>>2]*+f[n+(m*48|0)+4>>2]-v*+f[a+12>>2]);f[a+16>>2]=+f[n+(m*48|0)+16>>2]+(+f[d>>2]+ +f[e>>2]*+f[n+(m*48|0)>>2]-w*+f[a+8>>2]);f[a+20>>2]=o;Eb(j,a,b);if((c[s>>2]|0)!=3){x=c[a>>2]|0;y=x+12|0;z=c[y>>2]|0;Xa[z&15](a,b,i,h);Ka=g;return}f[k>>2]=+f[j+8>>2]-+f[j>>2];x=c[a>>2]|0;y=x+12|0;z=c[y>>2]|0;Xa[z&15](a,b,i,h);Ka=g;return}function Tb(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0;e=c[b>>2]|0;b=(c[e+((c[a+4>>2]|0)*48|0)+32>>2]|0)+1|0;d=a+16|0;f=c[d+4>>2]|0;g=e+(b*48|0)|0;c[g>>2]=c[d>>2];c[g+4>>2]=f;f=a+24|0;a=c[f+4>>2]|0;g=e+(b*48|0)+16|0;c[g>>2]=c[f>>2];c[g+4>>2]=a;return}function Ub(a,b){a=a|0;b=b|0;return}function Vb(a){a=a|0;hh(a);kh(a);return}function Wb(a){a=a|0;var b=0;b=c[a+12>>2]|0;if(!b)return;jc(b);kh(b);return}function Xb(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==8312?a+12|0:0)|0}function Yb(a){a=a|0;kh(a);return}function Zb(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0;c[a+56>>2]=d;if((d|0)!=2)return;d=c[a+4>>2]|0;a=c[b>>2]|0;b=a+(((c[a+(d*48|0)+32>>2]|0)+1|0)*48|0)+16|0;e=c[b+4>>2]|0;f=a+(d*48|0)+24|0;c[f>>2]=c[b>>2];c[f+4>>2]=e;return}function _b(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0.0,o=0.0,p=0,q=0,r=0.0,s=0.0,t=0.0,u=0.0;g=Ka;Ka=Ka+32|0;if((Ka|0)>=(La|0))A(32);h=g+8|0;i=g;j=g+16|0;k=a+24|0;l=c[k+4>>2]|0;m=h;c[m>>2]=c[k>>2];c[m+4>>2]=l;l=a+16|0;m=c[l+4>>2]|0;k=i;c[k>>2]=c[l>>2];c[k+4>>2]=m;m=d;k=c[m+4>>2]|0;l=a+44|0;c[l>>2]=c[m>>2];c[l+4>>2]=k;k=e;l=c[k+4>>2]|0;m=a+36|0;c[m>>2]=c[k>>2];c[m+4>>2]=l;l=c[a+4>>2]|0;m=c[b>>2]|0;n=+f[m+(l*48|0)+8>>2]*+f[e>>2]+ +f[m+(l*48|0)+24>>2];k=e+4|0;o=+f[m+(l*48|0)+12>>2]*+f[k>>2]+ +f[m+(l*48|0)+28>>2];p=a+24|0;f[p>>2]=n;q=a+28|0;f[q>>2]=o;do if((c[a+56>>2]|0)==1){r=+f[a+52>>2];s=o*r;if(s<n){f[p>>2]=s;t=o;u=s;break}else{s=n/r;f[q>>2]=s;t=s;u=n;break}}else{t=o;u=n}while(0);n=+f[m+(l*48|0)+20>>2]+(+f[d+4>>2]+ +f[k>>2]*+f[m+(l*48|0)+4>>2]-t*+f[a+12>>2]);f[a+16>>2]=+f[m+(l*48|0)+16>>2]+(+f[d>>2]+ +f[e>>2]*+f[m+(l*48|0)>>2]-u*+f[a+8>>2]);f[a+20>>2]=n;Xa[c[(c[a>>2]|0)+12>>2]&15](a,b,i,h);Eb(j,a,b);Ka=g;return}function $b(b,d,e,g){b=b|0;d=d|0;e=e|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0.0,o=0.0,p=0,q=0.0,r=0.0,s=0,t=0,u=0,v=0;g=b+4|0;e=c[g>>2]|0;h=c[d>>2]|0;i=(c[h+(e*48|0)+32>>2]|0)+1|0;j=h+(i*48|0)|0;switch(c[b+56>>2]|0){case 3:case 0:{k=h+(i*48|0)+36|0;l=(c[3902]|0)+((c[k>>2]|0)*12|0)|0;m=h+(i*48|0)+24|0;n=+f[m>>2];o=n==0.0?10.0:n;if((a[l+11>>0]|0)<0)p=c[l>>2]|0;else p=l;n=+V(p|0,+o);q=+f[b+24>>2];if(q<=.1)return;r=o*(q/n);p=(c[3902]|0)+((c[k>>2]|0)*12|0)|0;f[m>>2]=r;if((a[p+11>>0]|0)<0)s=c[p>>2]|0;else s=p;f[h+(i*48|0)+16>>2]=+V(s|0,+r);f[h+(i*48|0)+20>>2]=r;switch(c[h+(i*48|0)+44>>2]|0){case 8:case 2:case 3:case 4:case 7:break;default:return}n=+f[b+20>>2]+(+f[b+28>>2]-r)*+f[b+12>>2];c[j>>2]=c[b+16>>2];f[h+(i*48|0)+4>>2]=n;return}case 2:{switch(c[h+(i*48|0)+44>>2]|0){case 8:case 2:case 3:case 4:case 7:{s=b+16|0;b=c[s+4>>2]|0;p=j;c[p>>2]=c[s>>2];c[p+4>>2]=b;b=c[g>>2]|0;g=c[d>>2]|0;t=(c[g+(b*48|0)+32>>2]|0)+1|0;u=g;v=b;break}default:{t=i;u=h;v=e}}e=u+(t*48|0)+16|0;t=c[e+4>>2]|0;h=u+(v*48|0)+24|0;c[h>>2]=c[e>>2];c[h+4>>2]=t;return}default:return}}function ac(b,e){b=b|0;e=e|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0.0,G=0.0,H=0,I=0,J=0,K=0;g=a[e+11>>0]|0;h=g<<24>>24<0;i=h?c[e>>2]|0:e;j=h?c[e+4>>2]|0:g&255;if(j>>>0>3){g=i;h=j;k=j;while(1){l=v(d[g>>0]|d[g+1>>0]<<8|d[g+2>>0]<<16|d[g+3>>0]<<24,1540483477)|0;h=(v(l>>>24^l,1540483477)|0)^(v(h,1540483477)|0);k=k+-4|0;if(k>>>0<=3)break;else g=g+4|0}g=j+-4|0;k=g&-4;m=g-k|0;n=i+(k+4)|0;o=h}else{m=j;n=i;o=j}switch(m|0){case 3:{p=d[n+2>>0]<<16^o;q=7;break}case 2:{p=o;q=7;break}case 1:{r=o;q=8;break}default:s=o}if((q|0)==7){r=d[n+1>>0]<<8^p;q=8}if((q|0)==8)s=v(r^d[n>>0],1540483477)|0;n=v(s>>>13^s,1540483477)|0;s=n>>>15^n;n=b+4|0;r=c[n>>2]|0;p=(r|0)==0;a:do if(!p){o=r+-1|0;m=(o&r|0)==0;if(!m)if(s>>>0<r>>>0)t=s;else t=(s>>>0)%(r>>>0)|0;else t=s&o;h=c[(c[b>>2]|0)+(t<<2)>>2]|0;if((h|0)!=0?(k=c[h>>2]|0,(k|0)!=0):0){h=(j|0)==0;if(m){if(h){m=k;while(1){g=c[m+4>>2]|0;if(!((g|0)==(s|0)|(g&o|0)==(t|0))){w=t;break a}g=a[m+8+11>>0]|0;if(!((g<<24>>24<0?c[m+12>>2]|0:g&255)|0)){x=m;break}m=c[m>>2]|0;if(!m){w=t;break a}}y=x+20|0;return y|0}m=k;b:while(1){g=c[m+4>>2]|0;if(!((g|0)==(s|0)|(g&o|0)==(t|0))){w=t;break a}g=m+8|0;l=a[g+11>>0]|0;z=l<<24>>24<0;A=l&255;do if(((z?c[m+12>>2]|0:A)|0)==(j|0)){l=c[g>>2]|0;if(z)if(!(Sg(l,i,j)|0)){x=m;q=68;break b}else break;if((a[i>>0]|0)==(l&255)<<24>>24){l=g;B=A;C=i;do{B=B+-1|0;l=l+1|0;if(!B){x=m;q=68;break b}C=C+1|0}while((a[l>>0]|0)==(a[C>>0]|0))}}while(0);m=c[m>>2]|0;if(!m){w=t;break a}}if((q|0)==68){y=x+20|0;return y|0}}if(h){m=k;while(1){o=c[m+4>>2]|0;if((o|0)!=(s|0)){if(o>>>0<r>>>0)D=o;else D=(o>>>0)%(r>>>0)|0;if((D|0)!=(t|0)){w=t;break a}}o=a[m+8+11>>0]|0;if(!((o<<24>>24<0?c[m+12>>2]|0:o&255)|0)){x=m;break}m=c[m>>2]|0;if(!m){w=t;break a}}y=x+20|0;return y|0}m=k;c:while(1){h=c[m+4>>2]|0;if((h|0)!=(s|0)){if(h>>>0<r>>>0)E=h;else E=(h>>>0)%(r>>>0)|0;if((E|0)!=(t|0)){w=t;break a}}h=m+8|0;o=a[h+11>>0]|0;A=o<<24>>24<0;g=o&255;do if(((A?c[m+12>>2]|0:g)|0)==(j|0)){o=c[h>>2]|0;if(A)if(!(Sg(o,i,j)|0)){x=m;q=68;break c}else break;if((a[i>>0]|0)==(o&255)<<24>>24){o=h;z=g;C=i;do{z=z+-1|0;o=o+1|0;if(!z){x=m;q=68;break c}C=C+1|0}while((a[o>>0]|0)==(a[C>>0]|0))}}while(0);m=c[m>>2]|0;if(!m){w=t;break a}}if((q|0)==68){y=x+20|0;return y|0}}else w=t}else w=0;while(0);t=jh(24)|0;sh(t+8|0,e);c[t+20>>2]=0;c[t+4>>2]=s;c[t>>2]=0;e=b+12|0;F=+(((c[e>>2]|0)+1|0)>>>0);G=+f[b+16>>2];do if(p|G*+(r>>>0)<F){i=r<<1|(r>>>0<3|(r+-1&r|0)!=0)&1;j=~~+u(+(F/G))>>>0;dc(b,i>>>0<j>>>0?j:i);i=c[n>>2]|0;j=i+-1|0;if(!(j&i)){H=i;I=j&s;break}if(s>>>0<i>>>0){H=i;I=s}else{H=i;I=(s>>>0)%(i>>>0)|0}}else{H=r;I=w}while(0);w=(c[b>>2]|0)+(I<<2)|0;I=c[w>>2]|0;if(!I){r=b+8|0;c[t>>2]=c[r>>2];c[r>>2]=t;c[w>>2]=r;r=c[t>>2]|0;if(r|0){w=c[r+4>>2]|0;r=H+-1|0;if(r&H)if(w>>>0<H>>>0)J=w;else J=(w>>>0)%(H>>>0)|0;else J=w&r;K=(c[b>>2]|0)+(J<<2)|0;q=66}}else{c[t>>2]=c[I>>2];K=I;q=66}if((q|0)==66)c[K>>2]=t;c[e>>2]=(c[e>>2]|0)+1;x=t;y=x+20|0;return y|0}function bc(b,e){b=b|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,w=0;f=a[e+11>>0]|0;g=f<<24>>24<0;h=g?c[e>>2]|0:e;i=g?c[e+4>>2]|0:f&255;if(i>>>0>3){f=h;e=i;g=i;while(1){j=v(d[f>>0]|d[f+1>>0]<<8|d[f+2>>0]<<16|d[f+3>>0]<<24,1540483477)|0;e=(v(j>>>24^j,1540483477)|0)^(v(e,1540483477)|0);g=g+-4|0;if(g>>>0<=3)break;else f=f+4|0}f=i+-4|0;g=f&-4;k=f-g|0;l=h+(g+4)|0;m=e}else{k=i;l=h;m=i}switch(k|0){case 3:{n=d[l+2>>0]<<16^m;o=7;break}case 2:{n=m;o=7;break}case 1:{p=m;o=8;break}default:q=m}if((o|0)==7){p=d[l+1>>0]<<8^n;o=8}if((o|0)==8)q=v(p^d[l>>0],1540483477)|0;l=v(q>>>13^q,1540483477)|0;q=l>>>15^l;l=c[b+4>>2]|0;if(!l){r=0;return r|0}p=l+-1|0;n=(p&l|0)==0;if(!n)if(q>>>0<l>>>0)s=q;else s=(q>>>0)%(l>>>0)|0;else s=q&p;m=c[(c[b>>2]|0)+(s<<2)>>2]|0;if(!m){r=0;return r|0}b=c[m>>2]|0;if(!b){r=0;return r|0}m=(i|0)==0;if(n){n=b;a:while(1){k=c[n+4>>2]|0;e=(k|0)==(q|0);if(!(e|(k&p|0)==(s|0))){r=0;o=45;break}do if(e?(k=n+8|0,g=a[k+11>>0]|0,f=g<<24>>24<0,j=g&255,((f?c[n+12>>2]|0:j)|0)==(i|0)):0){g=c[k>>2]|0;t=f?g:k;u=g&255;if(f){if(m){r=n;o=45;break a}if(!(Sg(t,h,i)|0)){r=n;o=45;break a}else break}if(m){r=n;o=45;break a}if((a[h>>0]|0)==u<<24>>24){u=k;k=j;j=h;do{k=k+-1|0;u=u+1|0;if(!k){r=n;o=45;break a}j=j+1|0}while((a[u>>0]|0)==(a[j>>0]|0))}}while(0);n=c[n>>2]|0;if(!n){r=0;o=45;break}}if((o|0)==45)return r|0}n=b;b:while(1){b=c[n+4>>2]|0;do if((b|0)==(q|0)){p=n+8|0;e=a[p+11>>0]|0;j=e<<24>>24<0;u=e&255;if(((j?c[n+12>>2]|0:u)|0)==(i|0)){e=c[p>>2]|0;k=j?e:p;t=e&255;if(j){if(m){r=n;o=45;break b}if(!(Sg(k,h,i)|0)){r=n;o=45;break b}else break}if(m){r=n;o=45;break b}if((a[h>>0]|0)==t<<24>>24){t=p;p=u;u=h;do{p=p+-1|0;t=t+1|0;if(!p){r=n;o=45;break b}u=u+1|0}while((a[t>>0]|0)==(a[u>>0]|0))}}}else{if(b>>>0<l>>>0)w=b;else w=(b>>>0)%(l>>>0)|0;if((w|0)!=(s|0)){r=0;o=45;break b}}while(0);n=c[n>>2]|0;if(!n){r=0;o=45;break}}if((o|0)==45)return r|0;return 0}function cc(b,d){b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0;e=b+4|0;f=c[b>>2]|0;g=((c[e>>2]|0)-f|0)/12|0;h=g+1|0;if(h>>>0>357913941)Hh(b);i=b+8|0;j=((c[i>>2]|0)-f|0)/12|0;f=j<<1;k=j>>>0<178956970?(f>>>0<h>>>0?h:f):357913941;do if(k)if(k>>>0>357913941){f=fa(8)|0;ph(f,7751);c[f>>2]=5904;ja(f|0,3912,82)}else{l=jh(k*12|0)|0;break}else l=0;while(0);f=l+(g*12|0)|0;g=l+(k*12|0)|0;sh(f,d);d=f+12|0;k=c[b>>2]|0;l=c[e>>2]|0;if((l|0)==(k|0)){m=f;n=k;o=k}else{h=l;l=f;do{l=l+-12|0;h=h+-12|0;c[l>>2]=c[h>>2];c[l+4>>2]=c[h+4>>2];c[l+8>>2]=c[h+8>>2];c[h>>2]=0;c[h+4>>2]=0;c[h+8>>2]=0}while((h|0)!=(k|0));m=l;n=c[b>>2]|0;o=c[e>>2]|0}c[b>>2]=m;c[e>>2]=d;c[i>>2]=g;g=n;if((o|0)!=(g|0)){i=o;do{i=i+-12|0;if((a[i+11>>0]|0)<0)kh(c[i>>2]|0)}while((i|0)!=(g|0))}if(!n)return;kh(n);return}function dc(a,b){a=a|0;b=b|0;var d=0,e=0,g=0,h=0;if((b|0)!=1)if(!(b+-1&b))d=b;else d=fh(b)|0;else d=2;b=c[a+4>>2]|0;if(d>>>0>b>>>0){ec(a,d);return}if(d>>>0>=b>>>0)return;e=~~+u(+(+((c[a+12>>2]|0)>>>0)/+f[a+16>>2]))>>>0;if(b>>>0>2&(b+-1&b|0)==0){g=1<<32-(w(e+-1|0)|0);h=e>>>0<2?e:g}else h=fh(e)|0;e=d>>>0<h>>>0?h:d;if(e>>>0>=b>>>0)return;ec(a,e);return}function ec(b,d){b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0;e=b+4|0;if(!d){f=c[b>>2]|0;c[b>>2]=0;if(f|0)kh(f);c[e>>2]=0;return}if(d>>>0>1073741823){f=fa(8)|0;ph(f,7751);c[f>>2]=5904;ja(f|0,3912,82)}f=jh(d<<2)|0;g=c[b>>2]|0;c[b>>2]=f;if(g|0)kh(g);c[e>>2]=d;e=0;do{c[(c[b>>2]|0)+(e<<2)>>2]=0;e=e+1|0}while((e|0)!=(d|0));e=b+8|0;g=c[e>>2]|0;if(!g)return;f=c[g+4>>2]|0;h=d+-1|0;i=(h&d|0)==0;if(!i)if(f>>>0<d>>>0)j=f;else j=(f>>>0)%(d>>>0)|0;else j=f&h;c[(c[b>>2]|0)+(j<<2)>>2]=e;e=c[g>>2]|0;if(!e)return;f=j;j=e;e=g;while(1){g=c[j+4>>2]|0;if(!i)if(g>>>0<d>>>0)k=g;else k=(g>>>0)%(d>>>0)|0;else k=g&h;do if((k|0)==(f|0)){l=f;m=j}else{g=(c[b>>2]|0)+(k<<2)|0;if(!(c[g>>2]|0)){c[g>>2]=e;l=k;m=j;break}g=c[j>>2]|0;a:do if(!g)n=j;else{o=j+8|0;p=a[o+11>>0]|0;q=p<<24>>24<0;r=p&255;p=q?c[j+12>>2]|0:r;s=(p|0)==0;if(q){q=j;t=g;while(1){u=t+8|0;v=a[u+11>>0]|0;w=v<<24>>24<0;if((p|0)!=((w?c[t+12>>2]|0:v&255)|0)){n=q;break a}if(!s?Sg(c[o>>2]|0,w?c[u>>2]|0:u,p)|0:0){n=q;break a}u=c[t>>2]|0;if(!u){n=t;break a}else{w=t;t=u;q=w}}}if(s){q=j;t=g;while(1){w=a[t+8+11>>0]|0;if((w<<24>>24<0?c[t+12>>2]|0:w&255)|0){n=q;break a}w=c[t>>2]|0;if(!w){n=t;break a}else{u=t;t=w;q=u}}}q=j;t=g;while(1){s=t+8|0;u=a[s+11>>0]|0;w=u<<24>>24<0;if((p|0)!=((w?c[t+12>>2]|0:u&255)|0)){n=q;break a}u=w?c[s>>2]|0:s;if((a[u>>0]|0)!=(c[o>>2]&255)<<24>>24){n=q;break a}s=o;w=r;v=u;while(1){w=w+-1|0;s=s+1|0;if(!w)break;v=v+1|0;if((a[s>>0]|0)!=(a[v>>0]|0)){n=q;break a}}v=c[t>>2]|0;if(!v){n=t;break}else{s=t;t=v;q=s}}}while(0);c[e>>2]=c[n>>2];c[n>>2]=c[c[(c[b>>2]|0)+(k<<2)>>2]>>2];c[c[(c[b>>2]|0)+(k<<2)>>2]>>2]=j;l=f;m=e}while(0);j=c[m>>2]|0;if(!j)break;else{f=l;e=m}}return}function fc(a){a=a|0;hh(a);kh(a);return}function gc(a){a=a|0;var b=0;b=c[a+12>>2]|0;if(!b)return;jc(b);kh(b);return}function hc(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==8474?a+12|0:0)|0}function ic(a){a=a|0;kh(a);return}function jc(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0;c[a>>2]=4040;b=a+312|0;d=c[b>>2]|0;if(d|0){e=a+316|0;f=c[e>>2]|0;if((f|0)==(d|0))g=d;else{h=f;do{f=c[h+-4>>2]|0;h=h+-8|0;if(f|0?(i=f+4|0,j=c[i>>2]|0,c[i>>2]=j+-1,(j|0)==0):0){Sa[c[(c[f>>2]|0)+8>>2]&127](f);ih(f)}}while((h|0)!=(d|0));g=c[b>>2]|0}c[e>>2]=d;kh(g)}g=c[a+308>>2]|0;if(g|0?(d=g+4|0,e=c[d>>2]|0,c[d>>2]=e+-1,(e|0)==0):0){Sa[c[(c[g>>2]|0)+8>>2]&127](g);ih(g)}g=c[a+296>>2]|0;if((a+280|0)!=(g|0)){if(g|0)Sa[c[(c[g>>2]|0)+20>>2]&127](g)}else Sa[c[(c[g>>2]|0)+16>>2]&127](g);g=c[a+272>>2]|0;if((a+256|0)!=(g|0)){if(g|0)Sa[c[(c[g>>2]|0)+20>>2]&127](g)}else Sa[c[(c[g>>2]|0)+16>>2]&127](g);g=c[a+248>>2]|0;if((a+232|0)!=(g|0)){if(g|0)Sa[c[(c[g>>2]|0)+20>>2]&127](g)}else Sa[c[(c[g>>2]|0)+16>>2]&127](g);g=c[a+216>>2]|0;if((a+200|0)!=(g|0)){if(g|0)Sa[c[(c[g>>2]|0)+20>>2]&127](g)}else Sa[c[(c[g>>2]|0)+16>>2]&127](g);g=c[a+192>>2]|0;if((a+176|0)!=(g|0)){if(g|0)Sa[c[(c[g>>2]|0)+20>>2]&127](g)}else Sa[c[(c[g>>2]|0)+16>>2]&127](g);g=c[a+168>>2]|0;if((a+152|0)!=(g|0)){if(g|0)Sa[c[(c[g>>2]|0)+20>>2]&127](g)}else Sa[c[(c[g>>2]|0)+16>>2]&127](g);g=c[a+136>>2]|0;if((a+120|0)!=(g|0)){if(g|0)Sa[c[(c[g>>2]|0)+20>>2]&127](g)}else Sa[c[(c[g>>2]|0)+16>>2]&127](g);g=c[a+112>>2]|0;if((a+96|0)!=(g|0)){if(g|0)Sa[c[(c[g>>2]|0)+20>>2]&127](g)}else Sa[c[(c[g>>2]|0)+16>>2]&127](g);g=c[a+88>>2]|0;if((a+72|0)==(g|0)){Sa[c[(c[g>>2]|0)+16>>2]&127](g);return}if(!g)return;Sa[c[(c[g>>2]|0)+20>>2]&127](g);return}function kc(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0;d=Ka;Ka=Ka+16|0;if((Ka|0)>=(La|0))A(16);e=d;if((b|0)==(a|0)){Ka=d;return}f=a+16|0;g=c[f>>2]|0;h=g;i=b+16|0;if((g|0)==(a|0))if((c[i>>2]|0)==(b|0)){Ua[c[(c[g>>2]|0)+12>>2]&31](g,e);j=c[f>>2]|0;Sa[c[(c[j>>2]|0)+16>>2]&127](j);c[f>>2]=0;j=c[i>>2]|0;Ua[c[(c[j>>2]|0)+12>>2]&31](j,a);j=c[i>>2]|0;Sa[c[(c[j>>2]|0)+16>>2]&127](j);c[i>>2]=0;c[f>>2]=a;Ua[c[(c[e>>2]|0)+12>>2]&31](e,b);Sa[c[(c[e>>2]|0)+16>>2]&127](e);c[i>>2]=b;Ka=d;return}else{Ua[c[(c[g>>2]|0)+12>>2]&31](g,b);g=c[f>>2]|0;Sa[c[(c[g>>2]|0)+16>>2]&127](g);g=b+16|0;c[f>>2]=c[g>>2];c[g>>2]=b;Ka=d;return}else{g=c[i>>2]|0;if((b|0)==(g|0)){Ua[c[(c[g>>2]|0)+12>>2]&31](g,a);b=c[i>>2]|0;Sa[c[(c[b>>2]|0)+16>>2]&127](b);c[i>>2]=c[f>>2];c[f>>2]=a;Ka=d;return}else{c[f>>2]=g;c[i>>2]=h;Ka=d;return}}}function lc(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0;d=Ka;Ka=Ka+16|0;if((Ka|0)>=(La|0))A(16);e=d;if((b|0)==(a|0)){Ka=d;return}f=a+16|0;g=c[f>>2]|0;h=g;i=b+16|0;if((g|0)==(a|0))if((c[i>>2]|0)==(b|0)){Ua[c[(c[g>>2]|0)+12>>2]&31](g,e);j=c[f>>2]|0;Sa[c[(c[j>>2]|0)+16>>2]&127](j);c[f>>2]=0;j=c[i>>2]|0;Ua[c[(c[j>>2]|0)+12>>2]&31](j,a);j=c[i>>2]|0;Sa[c[(c[j>>2]|0)+16>>2]&127](j);c[i>>2]=0;c[f>>2]=a;Ua[c[(c[e>>2]|0)+12>>2]&31](e,b);Sa[c[(c[e>>2]|0)+16>>2]&127](e);c[i>>2]=b;Ka=d;return}else{Ua[c[(c[g>>2]|0)+12>>2]&31](g,b);g=c[f>>2]|0;Sa[c[(c[g>>2]|0)+16>>2]&127](g);g=b+16|0;c[f>>2]=c[g>>2];c[g>>2]=b;Ka=d;return}else{g=c[i>>2]|0;if((b|0)==(g|0)){Ua[c[(c[g>>2]|0)+12>>2]&31](g,a);b=c[i>>2]|0;Sa[c[(c[b>>2]|0)+16>>2]&127](b);c[i>>2]=c[f>>2];c[f>>2]=a;Ka=d;return}else{c[f>>2]=g;c[i>>2]=h;Ka=d;return}}}function mc(a){a=a|0;var b=0,d=0;c[a>>2]=4248;b=c[a+12>>2]|0;if(!b)return;a=b+4|0;d=c[a>>2]|0;c[a>>2]=d+-1;if(d|0)return;Sa[c[(c[b>>2]|0)+8>>2]&127](b);ih(b);return}function nc(a){a=a|0;var b=0,d=0,e=0;c[a>>2]=4248;b=c[a+12>>2]|0;if(!b){kh(a);return}d=b+4|0;e=c[d>>2]|0;c[d>>2]=e+-1;if(e|0){kh(a);return}Sa[c[(c[b>>2]|0)+8>>2]&127](b);ih(b);kh(a);return}function oc(a){a=a|0;var b=0,d=0,e=0;b=jh(20)|0;c[b>>2]=4248;c[b+4>>2]=c[a+4>>2];c[b+8>>2]=c[a+8>>2];d=c[a+12>>2]|0;c[b+12>>2]=d;if(d|0){e=d+4|0;c[e>>2]=(c[e>>2]|0)+1}c[b+16>>2]=c[a+16>>2];return b|0}function pc(a,b){a=a|0;b=b|0;var d=0,e=0;c[b>>2]=4248;c[b+4>>2]=c[a+4>>2];c[b+8>>2]=c[a+8>>2];d=c[a+12>>2]|0;c[b+12>>2]=d;if(d|0){e=d+4|0;c[e>>2]=(c[e>>2]|0)+1}c[b+16>>2]=c[a+16>>2];return}function qc(a){a=a|0;var b=0,d=0;b=c[a+12>>2]|0;if(!b)return;a=b+4|0;d=c[a>>2]|0;c[a>>2]=d+-1;if(d|0)return;Sa[c[(c[b>>2]|0)+8>>2]&127](b);ih(b);return}function rc(a){a=a|0;var b=0,d=0,e=0;b=c[a+12>>2]|0;if(!b){kh(a);return}d=b+4|0;e=c[d>>2]|0;c[d>>2]=e+-1;if(e|0){kh(a);return}Sa[c[(c[b>>2]|0)+8>>2]&127](b);ih(b);kh(a);return}function sc(a,b){a=a|0;b=b|0;wc(a+4|0,b);return}function tc(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==8660?a+4|0:0)|0}function uc(a){a=a|0;return 2968}function vc(a){a=a|0;return}function wc(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0;b=c[a+12>>2]|0;d=b+92|0;e=c[a>>2]|0;if((c[d>>2]|0)==(e|0))return;c[d>>2]=e;e=c[a+4>>2]|0;d=c[b+4>>2]|0;f=(c[d+((c[e+4>>2]|0)*48|0)+32>>2]|0)+1|0;if((c[d+(f*48|0)+44>>2]|0)==6)c[d+(f*48|0)+36>>2]=-1;f=b+68|0;g=(c[d+((c[(c[f>>2]|0)+4>>2]|0)*48|0)+32>>2]|0)+1|0;if((c[d+(g*48|0)+44>>2]|0)==6)c[d+(g*48|0)+36>>2]=-1600085761;g=c[a+8>>2]|0;if(g|0){a=g+4|0;c[a>>2]=(c[a>>2]|0)+1}c[f>>2]=e;e=b+72|0;f=c[e>>2]|0;c[e>>2]=g;if(f|0?(g=f+4|0,e=c[g>>2]|0,c[g>>2]=e+-1,(e|0)==0):0){Sa[c[(c[f>>2]|0)+8>>2]&127](f);ih(f)}ub(b);return}function xc(a){a=a|0;return}function yc(a){a=a|0;kh(a);return}function zc(a){a=a|0;var b=0,d=0,e=0;b=jh(12)|0;c[b>>2]=4292;d=a+4|0;a=c[d+4>>2]|0;e=b+4|0;c[e>>2]=c[d>>2];c[e+4>>2]=a;return b|0}function Ac(a,b){a=a|0;b=b|0;var d=0,e=0;c[b>>2]=4292;d=a+4|0;a=c[d+4>>2]|0;e=b+4|0;c[e>>2]=c[d>>2];c[e+4>>2]=a;return}function Bc(a){a=a|0;return}function Cc(a){a=a|0;kh(a);return}function Dc(a){a=a|0;var b=0,d=0,e=0;b=c[a+4>>2]|0;d=jh(344)|0;e=b+4|0;Gc(d,e,c[a+8>>2]|0);a=c[d+4>>2]|0;b=c[e>>2]|0;c[b+(a*48|0)>>2]=1056964608;c[b+(a*48|0)+4>>2]=1056964608;c[d+8>>2]=1056964608;c[d+12>>2]=1056964608;return d|0}function Ec(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==9039?a+4|0:0)|0}function Fc(a){a=a|0;return 3064}function Gc(b,d,e){b=b|0;d=d|0;e=e|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0;g=Ka;Ka=Ka+96|0;if((Ka|0)>=(La|0))A(96);h=g+24|0;i=g+16|0;j=g+48|0;k=g;l=g+40|0;m=g+32|0;pb(b,d);c[b>>2]=4360;n=j+8|0;o=n+36|0;do{c[n>>2]=0;n=n+4|0}while((n|0)<(o|0));c[j+44>>2]=7;c[j>>2]=0;c[j+4>>2]=0;c[j+16>>2]=0;c[j+20>>2]=0;f[j+24>>2]=18.0;f[j+28>>2]=6.0;c[j+32>>2]=-256;c[j+36>>2]=577149439;p=d+4|0;q=c[p>>2]|0;r=c[d>>2]|0;c[r+((c[b+4>>2]|0)*48|0)+36>>2]=(q-r|0)/48|0;if((c[d+8>>2]|0)==(q|0))Mb(d,j);else{n=q;q=j;o=n+48|0;do{c[n>>2]=c[q>>2];n=n+4|0;q=q+4|0}while((n|0)<(o|0));c[p>>2]=(c[p>>2]|0)+48}c[b>>2]=4336;p=b+324|0;q=b+328|0;n=b+332|0;o=b+336|0;c[p>>2]=0;c[p+4>>2]=0;c[p+8>>2]=0;c[p+12>>2]=0;if((e|0)==3){r=jh(328)|0;c[k>>2]=0;c[k+4>>2]=0;c[k+8>>2]=0;s=k+11|0;a[s>>0]=8;t=k;c[t>>2]=1802724708;c[t+4>>2]=1735815982;a[k+8>>0]=0;Hc(r,d,k);c[j>>2]=r;t=jh(16)|0;c[t+4>>2]=0;c[t+8>>2]=0;c[t>>2]=4384;c[t+12>>2]=r;u=j+4|0;c[u>>2]=t;c[i>>2]=r;c[i+4>>2]=r;Kc(j,i);i=c[j>>2]|0;c[j>>2]=c[n>>2];c[n>>2]=i;i=c[u>>2]|0;r=c[o>>2]|0;c[u>>2]=r;c[o>>2]=i;i=r;if(r|0?(u=i+4|0,t=c[u>>2]|0,c[u>>2]=t+-1,(t|0)==0):0){Sa[c[(c[r>>2]|0)+8>>2]&127](i);ih(i)}if((a[s>>0]|0)<0)kh(c[k>>2]|0);s=c[(c[n>>2]|0)+4>>2]|0;i=c[d>>2]|0;c[i+(s*48|0)+8>>2]=1061997773;c[i+(s*48|0)+12>>2]=1061997773;s=c[n>>2]|0;c[s+8>>2]=1056964608;c[s+12>>2]=1056964608;s=c[(c[n>>2]|0)+4>>2]|0;i=c[d>>2]|0;c[i+(s*48|0)>>2]=1056964608;c[i+(s*48|0)+4>>2]=1056964608;s=c[(c[b>>2]|0)+4>>2]|0;c[l>>2]=c[n>>2];n=l+4|0;i=c[o>>2]|0;c[n>>2]=i;if(i|0){o=i+4|0;c[o>>2]=(c[o>>2]|0)+1}Wa[s&7](b,d,l);l=c[n>>2]|0;if(l|0?(n=l+4|0,s=c[n>>2]|0,c[n>>2]=s+-1,(s|0)==0):0){Sa[c[(c[l>>2]|0)+8>>2]&127](l);ih(l)}}else if((e+-1|0)>>>0>=3){Ka=g;return}e=jh(328)|0;c[k>>2]=0;c[k+4>>2]=0;c[k+8>>2]=0;l=k+11|0;a[l>>0]=1;a[k>>0]=65;a[k+1>>0]=0;qb(e,d,k,-256,18.0);c[j>>2]=e;s=jh(16)|0;c[s+4>>2]=0;c[s+8>>2]=0;c[s>>2]=4220;c[s+12>>2]=e;n=j+4|0;c[n>>2]=s;c[h>>2]=e;c[h+4>>2]=e;qe(j,h);h=c[j>>2]|0;c[j>>2]=c[p>>2];c[p>>2]=h;h=c[n>>2]|0;j=c[q>>2]|0;c[n>>2]=j;c[q>>2]=h;h=j;if(j|0?(n=h+4|0,e=c[n>>2]|0,c[n>>2]=e+-1,(e|0)==0):0){Sa[c[(c[j>>2]|0)+8>>2]&127](h);ih(h)}if((a[l>>0]|0)<0)kh(c[k>>2]|0);k=c[(c[p>>2]|0)+4>>2]|0;l=c[d>>2]|0;c[l+(k*48|0)>>2]=1056964608;c[l+(k*48|0)+4>>2]=1050253722;k=c[p>>2]|0;c[k+8>>2]=1056964608;c[k+12>>2]=1056964608;k=c[(c[p>>2]|0)+4>>2]|0;l=c[d>>2]|0;c[l+(k*48|0)+8>>2]=1060320051;c[l+(k*48|0)+12>>2]=1065353216;k=c[(c[b>>2]|0)+4>>2]|0;c[m>>2]=c[p>>2];p=m+4|0;l=c[q>>2]|0;c[p>>2]=l;if(l|0){q=l+4|0;c[q>>2]=(c[q>>2]|0)+1}Wa[k&7](b,d,m);m=c[p>>2]|0;if(!m){Ka=g;return}p=m+4|0;d=c[p>>2]|0;c[p>>2]=d+-1;if(d|0){Ka=g;return}Sa[c[(c[m>>2]|0)+8>>2]&127](m);ih(m);Ka=g;return}function Hc(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0;e=Ka;Ka=Ka+48|0;if((Ka|0)>=(La|0))A(48);f=e;pb(a,b);c[a>>2]=4412;g=f+8|0;h=g+36|0;do{c[g>>2]=0;g=g+4|0}while((g|0)<(h|0));c[f+44>>2]=9;c[f>>2]=0;c[f+4>>2]=0;c[f+16>>2]=0;c[f+20>>2]=0;if(!(bc(15620,d)|0)){i=c[3903]|0;j=(i-(c[3902]|0)|0)/12|0;k=i;if((c[3904]|0)==(k|0))cc(15608,d);else{sh(k,d);c[3903]=(c[3903]|0)+12}c[(ac(15620,d)|0)>>2]=j}c[f+36>>2]=c[(ac(15620,d)|0)>>2];c[f+32>>2]=-1;d=b+4|0;j=c[d>>2]|0;k=c[b>>2]|0;c[k+((c[a+4>>2]|0)*48|0)+36>>2]=(j-k|0)/48|0;if((c[b+8>>2]|0)==(j|0)){Mb(b,f);Ka=e;return}else{g=j;j=f;h=g+48|0;do{c[g>>2]=c[j>>2];g=g+4|0;j=j+4|0}while((g|0)<(h|0));c[d>>2]=(c[d>>2]|0)+48;Ka=e;return}}function Ic(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0.0,o=0.0,p=0,q=0,r=0.0,s=0.0,t=0.0,u=0.0;g=Ka;Ka=Ka+32|0;if((Ka|0)>=(La|0))A(32);h=g+8|0;i=g;j=g+16|0;k=a+24|0;l=c[k+4>>2]|0;m=h;c[m>>2]=c[k>>2];c[m+4>>2]=l;l=a+16|0;m=c[l+4>>2]|0;k=i;c[k>>2]=c[l>>2];c[k+4>>2]=m;m=d;k=c[m+4>>2]|0;l=a+44|0;c[l>>2]=c[m>>2];c[l+4>>2]=k;k=e;l=c[k+4>>2]|0;m=a+36|0;c[m>>2]=c[k>>2];c[m+4>>2]=l;l=c[a+4>>2]|0;m=c[b>>2]|0;n=+f[m+(l*48|0)+8>>2]*+f[e>>2]+ +f[m+(l*48|0)+24>>2];k=e+4|0;o=+f[m+(l*48|0)+12>>2]*+f[k>>2]+ +f[m+(l*48|0)+28>>2];p=a+24|0;f[p>>2]=n;q=a+28|0;f[q>>2]=o;do if((c[a+56>>2]|0)==1){r=+f[a+52>>2];s=o*r;if(s<n){f[p>>2]=s;t=o;u=s;break}else{s=n/r;f[q>>2]=s;t=s;u=n;break}}else{t=o;u=n}while(0);n=+f[m+(l*48|0)+20>>2]+(+f[d+4>>2]+ +f[k>>2]*+f[m+(l*48|0)+4>>2]-t*+f[a+12>>2]);f[a+16>>2]=+f[m+(l*48|0)+16>>2]+(+f[d>>2]+ +f[e>>2]*+f[m+(l*48|0)>>2]-u*+f[a+8>>2]);f[a+20>>2]=n;Xa[c[(c[a>>2]|0)+12>>2]&15](a,b,i,h);Eb(j,a,b);Ka=g;return}function Jc(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0;e=c[b>>2]|0;b=(c[e+((c[a+4>>2]|0)*48|0)+32>>2]|0)+1|0;d=a+16|0;f=c[d+4>>2]|0;g=e+(b*48|0)|0;c[g>>2]=c[d>>2];c[g+4>>2]=f;f=a+24|0;a=c[f+4>>2]|0;g=e+(b*48|0)+16|0;c[g>>2]=c[f>>2];c[g+4>>2]=a;return}function Kc(a,b){a=a|0;b=b|0;return}function Lc(a){a=a|0;hh(a);kh(a);return}function Mc(a){a=a|0;var b=0;b=c[a+12>>2]|0;if(!b)return;jc(b);kh(b);return}function Nc(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==8979?a+12|0:0)|0}function Oc(a){a=a|0;kh(a);return}function Pc(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0.0,o=0.0,p=0,q=0,r=0.0,s=0.0,t=0.0,u=0.0;g=Ka;Ka=Ka+32|0;if((Ka|0)>=(La|0))A(32);h=g+8|0;i=g;j=g+16|0;k=a+24|0;l=c[k+4>>2]|0;m=h;c[m>>2]=c[k>>2];c[m+4>>2]=l;l=a+16|0;m=c[l+4>>2]|0;k=i;c[k>>2]=c[l>>2];c[k+4>>2]=m;m=d;k=c[m+4>>2]|0;l=a+44|0;c[l>>2]=c[m>>2];c[l+4>>2]=k;k=e;l=c[k+4>>2]|0;m=a+36|0;c[m>>2]=c[k>>2];c[m+4>>2]=l;l=c[a+4>>2]|0;m=c[b>>2]|0;n=+f[m+(l*48|0)+8>>2]*+f[e>>2]+ +f[m+(l*48|0)+24>>2];k=e+4|0;o=+f[m+(l*48|0)+12>>2]*+f[k>>2]+ +f[m+(l*48|0)+28>>2];p=a+24|0;f[p>>2]=n;q=a+28|0;f[q>>2]=o;do if((c[a+56>>2]|0)==1){r=+f[a+52>>2];s=o*r;if(s<n){f[p>>2]=s;t=o;u=s;break}else{s=n/r;f[q>>2]=s;t=s;u=n;break}}else{t=o;u=n}while(0);n=+f[m+(l*48|0)+20>>2]+(+f[d+4>>2]+ +f[k>>2]*+f[m+(l*48|0)+4>>2]-t*+f[a+12>>2]);f[a+16>>2]=+f[m+(l*48|0)+16>>2]+(+f[d>>2]+ +f[e>>2]*+f[m+(l*48|0)>>2]-u*+f[a+8>>2]);f[a+20>>2]=n;Xa[c[(c[a>>2]|0)+12>>2]&15](a,b,i,h);Eb(j,a,b);Ka=g;return}function Qc(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0;e=c[b>>2]|0;b=(c[e+((c[a+4>>2]|0)*48|0)+32>>2]|0)+1|0;d=a+16|0;f=c[d+4>>2]|0;g=e+(b*48|0)|0;c[g>>2]=c[d>>2];c[g+4>>2]=f;f=a+24|0;a=c[f+4>>2]|0;g=e+(b*48|0)+16|0;c[g>>2]=c[f>>2];c[g+4>>2]=a;return}function Rc(b,d,e,f,g){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0;h=Ka;Ka=Ka+16|0;if((Ka|0)>=(La|0))A(16);i=h+8|0;j=h;c[b>>2]=0;k=b+4|0;c[k>>2]=0;l=b+8|0;c[l>>2]=0;if(!e){Ka=h;return}m=g+16|0;g=j+4|0;n=i+4|0;o=0;while(1){p=c[m>>2]|0;if(!p){q=5;break}Ua[c[(c[p>>2]|0)+24>>2]&31](i,p);p=c[i>>2]|0;a[p+65>>0]=0;a[p+145>>0]=0;a[p+225>>0]=0;c[(c[d>>2]|0)+((c[p+4>>2]|0)*48|0)+40>>2]=0;r=c[k>>2]|0;if((r|0)==(c[l>>2]|0))Db(b,i);else{c[r>>2]=p;p=c[n>>2]|0;c[r+4>>2]=p;if(!p)s=r;else{r=p+4|0;c[r>>2]=(c[r>>2]|0)+1;s=c[k>>2]|0}c[k>>2]=s+8}r=c[(c[f>>2]|0)+4>>2]|0;c[j>>2]=c[i>>2];p=c[n>>2]|0;c[g>>2]=p;if(p|0){t=p+4|0;c[t>>2]=(c[t>>2]|0)+1}Wa[r&7](f,d,j);r=c[g>>2]|0;if(r|0?(t=r+4|0,p=c[t>>2]|0,c[t>>2]=p+-1,(p|0)==0):0){Sa[c[(c[r>>2]|0)+8>>2]&127](r);ih(r)}r=c[n>>2]|0;if(r|0?(p=r+4|0,t=c[p>>2]|0,c[p>>2]=t+-1,(t|0)==0):0){Sa[c[(c[r>>2]|0)+8>>2]&127](r);ih(r)}o=o+1|0;if(o>>>0>=e>>>0){q=3;break}}if((q|0)==3){Ka=h;return}else if((q|0)==5){q=fa(4)|0;c[q>>2]=5780;ja(q|0,3784,75)}}function Sc(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0;d=a+4|0;e=c[a>>2]|0;f=((c[d>>2]|0)-e|0)/12|0;g=f+1|0;if(g>>>0>357913941)Hh(a);h=a+8|0;i=((c[h>>2]|0)-e|0)/12|0;e=i<<1;j=i>>>0<178956970?(e>>>0<g>>>0?g:e):357913941;do if(j)if(j>>>0>357913941){e=fa(8)|0;ph(e,7751);c[e>>2]=5904;ja(e|0,3912,82)}else{k=jh(j*12|0)|0;break}else k=0;while(0);e=k+(f*12|0)|0;g=k+(j*12|0)|0;c[e>>2]=c[b>>2];j=b+4|0;c[k+(f*12|0)+4>>2]=c[j>>2];i=b+8|0;c[k+(f*12|0)+8>>2]=c[i>>2];c[i>>2]=0;c[j>>2]=0;c[b>>2]=0;b=e+12|0;j=c[a>>2]|0;i=c[d>>2]|0;if((i|0)==(j|0)){l=e;m=j;n=j}else{f=i;i=e;do{e=i;i=i+-12|0;k=f;f=f+-12|0;c[i>>2]=0;o=e+-8|0;c[o>>2]=0;p=e+-4|0;c[p>>2]=0;c[i>>2]=c[f>>2];e=k+-8|0;c[o>>2]=c[e>>2];o=k+-4|0;c[p>>2]=c[o>>2];c[o>>2]=0;c[e>>2]=0;c[f>>2]=0}while((f|0)!=(j|0));l=i;m=c[a>>2]|0;n=c[d>>2]|0}c[a>>2]=l;c[d>>2]=b;c[h>>2]=g;g=m;if((n|0)!=(g|0)){h=n;do{n=h;h=h+-12|0;b=c[h>>2]|0;if(b|0){d=n+-8|0;n=c[d>>2]|0;if((n|0)==(b|0))q=b;else{l=n;do{n=c[l+-4>>2]|0;l=l+-8|0;if(n|0?(a=n+4|0,i=c[a>>2]|0,c[a>>2]=i+-1,(i|0)==0):0){Sa[c[(c[n>>2]|0)+8>>2]&127](n);ih(n)}}while((l|0)!=(b|0));q=c[h>>2]|0}c[d>>2]=b;kh(q)}}while((h|0)!=(g|0))}if(!m)return;kh(m);return}function Tc(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0;d=a+4|0;e=c[d>>2]|0;f=c[a>>2]|0;g=e-f>>3;h=g+1|0;i=f;j=e;if(h>>>0>536870911)Hh(a);e=a+8|0;k=(c[e>>2]|0)-f|0;l=k>>2;m=k>>3>>>0<268435455?(l>>>0<h>>>0?h:l):536870911;do if(m)if(m>>>0>536870911){l=fa(8)|0;ph(l,7751);c[l>>2]=5904;ja(l|0,3912,82)}else{n=jh(m<<3)|0;break}else n=0;while(0);l=n+(g<<3)|0;h=n+(m<<3)|0;c[l>>2]=c[b>>2];m=b+4|0;c[n+(g<<3)+4>>2]=c[m>>2];c[b>>2]=0;c[m>>2]=0;m=l+8|0;if((j|0)==(i|0)){o=l;p=i;q=f}else{b=g+-1-((j+-8+(0-f)|0)>>>3)|0;f=j;j=l;do{l=j;j=j+-8|0;g=f;f=f+-8|0;c[j>>2]=c[f>>2];k=g+-4|0;c[l+-4>>2]=c[k>>2];c[f>>2]=0;c[k>>2]=0}while((f|0)!=(i|0));i=c[a>>2]|0;o=n+(b<<3)|0;p=i;q=i}c[a>>2]=o;o=c[d>>2]|0;c[d>>2]=m;c[e>>2]=h;if((o|0)!=(p|0)){h=o;do{o=c[h+-4>>2]|0;h=h+-8|0;if(o|0?(e=o+4|0,m=c[e>>2]|0,c[e>>2]=m+-1,(m|0)==0):0){Sa[c[(c[o>>2]|0)+8>>2]&127](o);ih(o)}}while((h|0)!=(p|0))}if(!q)return;kh(q);return}function Uc(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0;d=Ka;Ka=Ka+16|0;if((Ka|0)>=(La|0))A(16);e=d;c[a>>2]=b;f=jh(16)|0;c[f+4>>2]=0;c[f+8>>2]=0;c[f>>2]=4460;c[f+12>>2]=b;c[a+4>>2]=f;c[e>>2]=b;c[e+4>>2]=b;Vc(a,e);Ka=d;return}function Vc(a,b){a=a|0;b=b|0;return}function Wc(a){a=a|0;hh(a);kh(a);return}function Xc(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0;b=c[a+12>>2]|0;if(!b)return;a=c[b>>2]|0;if(a|0){d=b+4|0;e=c[d>>2]|0;if((e|0)==(a|0))f=a;else{g=e;do{e=c[g+-4>>2]|0;g=g+-8|0;if(e|0?(h=e+4|0,i=c[h>>2]|0,c[h>>2]=i+-1,(i|0)==0):0){Sa[c[(c[e>>2]|0)+8>>2]&127](e);ih(e)}}while((g|0)!=(a|0));f=c[b>>2]|0}c[d>>2]=a;kh(f)}kh(b);return}function Yc(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==9190?a+12|0:0)|0}function Zc(a){a=a|0;kh(a);return}function _c(a){a=a|0;var b=0;c[a>>2]=4488;b=c[a+32>>2]|0;if((a+16|0)==(b|0)){Sa[c[(c[b>>2]|0)+16>>2]&127](b);return}if(!b)return;Sa[c[(c[b>>2]|0)+20>>2]&127](b);return}function $c(a){a=a|0;var b=0;c[a>>2]=4488;b=c[a+32>>2]|0;if((a+16|0)==(b|0)){Sa[c[(c[b>>2]|0)+16>>2]&127](b);kh(a);return}if(!b){kh(a);return}Sa[c[(c[b>>2]|0)+20>>2]&127](b);kh(a);return}function ad(a){a=a|0;var b=0,d=0,e=0;b=jh(40)|0;c[b>>2]=4488;c[b+8>>2]=c[a+8>>2];d=b+16|0;e=c[a+32>>2]|0;if(!e){c[b+32>>2]=0;return b|0}if((a+16|0)==(e|0)){c[b+32>>2]=d;Ua[c[(c[e>>2]|0)+12>>2]&31](e,d);return b|0}else{c[b+32>>2]=Na[c[(c[e>>2]|0)+8>>2]&31](e)|0;return b|0}return 0}function bd(a,b){a=a|0;b=b|0;var d=0,e=0,f=0;c[b>>2]=4488;c[b+8>>2]=c[a+8>>2];d=b+16|0;e=a+32|0;f=c[e>>2]|0;if(!f){c[b+32>>2]=0;return}if((a+16|0)==(f|0)){c[b+32>>2]=d;a=c[e>>2]|0;Ua[c[(c[a>>2]|0)+12>>2]&31](a,d);return}else{c[b+32>>2]=Na[c[(c[f>>2]|0)+8>>2]&31](f)|0;return}}function cd(a){a=a|0;var b=0;b=c[a+32>>2]|0;if((a+16|0)==(b|0)){Sa[c[(c[b>>2]|0)+16>>2]&127](b);return}if(!b)return;Sa[c[(c[b>>2]|0)+20>>2]&127](b);return}function dd(a){a=a|0;var b=0;b=c[a+32>>2]|0;if((a+16|0)==(b|0)){Sa[c[(c[b>>2]|0)+16>>2]&127](b);kh(a);return}if(!b){kh(a);return}Sa[c[(c[b>>2]|0)+20>>2]&127](b);kh(a);return}function ed(a,b){a=a|0;b=b|0;var d=0,e=0;d=Ka;Ka=Ka+16|0;if((Ka|0)>=(La|0))A(16);e=d;hd(e,b+8|0);c[a>>2]=c[e>>2];c[a+4>>2]=c[e+4>>2];Ka=d;return}function fd(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==9871?a+8|0:0)|0}function gd(a){a=a|0;return 3200}function hd(d,e){d=d|0;e=e|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0;h=Ka;Ka=Ka+48|0;if((Ka|0)>=(La|0))A(48);i=h+32|0;j=h;k=h+28|0;l=h+16|0;m=h+24|0;n=h+8|0;o=jh(352)|0;pb(o,c[e>>2]|0);c[o>>2]=4532;p=o+324|0;c[o+340>>2]=0;c[o+344>>2]=0;c[p>>2]=0;c[p+4>>2]=0;c[p+8>>2]=0;a[p+12>>0]=0;c[k>>2]=0;c[i>>2]=c[k>>2];id(d,o,i);o=jh(296)|0;k=c[d>>2]|0;p=c[d+4>>2]|0;q=(p|0)==0;if(!q){r=p+4|0;c[r>>2]=(c[r>>2]|0)+1}a[o+4>>0]=0;a[o+5>>0]=0;c[o+24>>2]=0;c[o>>2]=4584;a[o+32>>0]=0;c[o+36>>2]=k;c[o+40>>2]=p;if(!q){k=p+4|0;c[k>>2]=(c[k>>2]|0)+1}b[o+44>>1]=0;a[o+48>>0]=1;f[o+52>>2]=1.0000000474974513e-03;g[o+56>>3]=1.0;g[o+64>>3]=18.84955592153876;k=o+72|0;c[k>>2]=0;c[k+4>>2]=0;c[k+8>>2]=0;c[k+12>>2]=0;a[o+88>>0]=1;f[o+92>>2]=1.0000000474974513e-03;g[o+96>>3]=1.0;g[o+104>>3]=18.84955592153876;k=o+112|0;c[k>>2]=0;c[k+4>>2]=0;c[k+8>>2]=0;c[k+12>>2]=0;a[o+128>>0]=1;f[o+132>>2]=1.0000000474974513e-03;g[o+136>>3]=1.0;g[o+144>>3]=18.84955592153876;k=o+152|0;c[k>>2]=0;c[k+4>>2]=0;c[k+8>>2]=0;c[k+12>>2]=0;a[o+168>>0]=1;f[o+172>>2]=1.0000000474974513e-03;g[o+176>>3]=1.0;g[o+184>>3]=18.84955592153876;k=o+192|0;c[k>>2]=0;c[k+4>>2]=0;c[k+8>>2]=0;c[k+12>>2]=0;a[o+208>>0]=1;f[o+212>>2]=1.0000000474974513e-03;g[o+216>>3]=1.0;g[o+224>>3]=18.84955592153876;k=o+232|0;c[k>>2]=0;c[k+4>>2]=0;c[k+8>>2]=0;c[k+12>>2]=0;a[o+248>>0]=1;g[o+256>>3]=1.0;g[o+264>>3]=18.84955592153876;g[o+272>>3]=.009999999776482582;g[o+280>>3]=0.0;f[o+288>>2]=0.0;c[m>>2]=0;c[i>>2]=c[m>>2];jd(l,o,i);if(!q?(q=p+4|0,o=c[q>>2]|0,c[q>>2]=o+-1,(o|0)==0):0){Sa[c[(c[p>>2]|0)+8>>2]&127](p);ih(p)}p=c[d>>2]|0;o=c[l>>2]|0;q=l+4|0;l=c[q>>2]|0;if(l|0){m=l+4|0;c[m>>2]=(c[m>>2]|0)+1}c[p+304>>2]=o;o=p+308|0;p=c[o>>2]|0;c[o>>2]=l;if(p|0?(l=p+4|0,o=c[l>>2]|0,c[l>>2]=o+-1,(o|0)==0):0){Sa[c[(c[p>>2]|0)+8>>2]&127](p);ih(p)}p=c[e+24>>2]|0;if(!p){o=fa(4)|0;c[o>>2]=5780;ja(o|0,3784,75)}o=Na[c[(c[p>>2]|0)+24>>2]&31](p)|0;c[i>>2]=o;p=jh(16)|0;c[p+4>>2]=0;c[p+8>>2]=0;c[p>>2]=4064;c[p+12>>2]=o;l=i+4|0;c[l>>2]=p;c[j>>2]=o;c[j+4>>2]=o;Fb(i,j);j=c[i>>2]|0;c[i>>2]=0;i=c[l>>2]|0;l=c[j+4>>2]|0;o=c[c[e>>2]>>2]|0;c[o+(l*48|0)+8>>2]=1065353216;c[o+(l*48|0)+12>>2]=1065353216;l=c[d>>2]|0;o=i;p=(i|0)==0;if(!p){m=o+4|0;c[m>>2]=(c[m>>2]|0)+1}c[l+340>>2]=j;m=l+344|0;l=c[m>>2]|0;c[m>>2]=i;if(l|0?(m=l+4|0,k=c[m>>2]|0,c[m>>2]=k+-1,(k|0)==0):0){Sa[c[(c[l>>2]|0)+8>>2]&127](l);ih(l)}l=c[d>>2]|0;d=c[(c[l>>2]|0)+4>>2]|0;k=c[e>>2]|0;c[n>>2]=j;j=n+4|0;c[j>>2]=o;if(!p){e=o+4|0;c[e>>2]=(c[e>>2]|0)+1}Wa[d&7](l,k,n);n=c[j>>2]|0;if(n|0?(j=n+4|0,k=c[j>>2]|0,c[j>>2]=k+-1,(k|0)==0):0){Sa[c[(c[n>>2]|0)+8>>2]&127](n);ih(n)}if(!p?(p=o+4|0,n=c[p>>2]|0,c[p>>2]=n+-1,(n|0)==0):0){Sa[c[(c[i>>2]|0)+8>>2]&127](o);ih(o)}o=c[q>>2]|0;if(!o){Ka=h;return}q=o+4|0;i=c[q>>2]|0;c[q>>2]=i+-1;if(i|0){Ka=h;return}Sa[c[(c[o>>2]|0)+8>>2]&127](o);ih(o);Ka=h;return}function id(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0;d=Ka;Ka=Ka+16|0;if((Ka|0)>=(La|0))A(16);e=d;c[a>>2]=b;f=jh(16)|0;c[f+4>>2]=0;c[f+8>>2]=0;c[f>>2]=4556;c[f+12>>2]=b;c[a+4>>2]=f;c[e>>2]=b;c[e+4>>2]=b;kd(a,e);Ka=d;return}function jd(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0;d=Ka;Ka=Ka+16|0;if((Ka|0)>=(La|0))A(16);e=d;c[a>>2]=b;f=jh(16)|0;c[f+4>>2]=0;c[f+8>>2]=0;c[f>>2]=4608;c[f+12>>2]=b;c[a+4>>2]=f;c[e>>2]=b;c[e+4>>2]=b;td(a,e);Ka=d;return}function kd(a,b){a=a|0;b=b|0;return}function ld(a){a=a|0;hh(a);kh(a);return}function md(a){a=a|0;var b=0,d=0,e=0;b=c[a+12>>2]|0;if(!b)return;c[b>>2]=4532;$g(12147)|0;a=c[b+344>>2]|0;if(a|0?(d=a+4|0,e=c[d>>2]|0,c[d>>2]=e+-1,(e|0)==0):0){Sa[c[(c[a>>2]|0)+8>>2]&127](a);ih(a)}jc(b);kh(b);return}function nd(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==9597?a+12|0:0)|0}function od(a){a=a|0;kh(a);return}function pd(d,e,f){d=d|0;e=e|0;f=+f;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,B=0.0,C=0,D=0,E=0;g=Ka;Ka=Ka+32|0;if((Ka|0)>=(La|0))A(32);h=g+16|0;i=g+8|0;j=g;k=d+44|0;l=b[k>>1]|0;if(!(l&1))m=l;else{l=d+36|0;n=(c[e>>2]|0)+((c[(c[l>>2]|0)+4>>2]|0)*48|0)|0;o=c[n+4>>2]|0;p=i;c[p>>2]=c[n>>2];c[p+4>>2]=o;o=d+48|0;rd(j,o,f,i);p=j;n=c[p+4>>2]|0;q=(c[e>>2]|0)+((c[(c[l>>2]|0)+4>>2]|0)*48|0)|0;c[q>>2]=c[p>>2];c[q+4>>2]=n;n=b[k>>1]|0;if(!(a[o>>0]|0))r=n;else{o=n&-2;b[k>>1]=o;r=o}m=r}if(!(m&2))s=m;else{m=d+36|0;r=(c[e>>2]|0)+((c[(c[m>>2]|0)+4>>2]|0)*48|0)+8|0;o=c[r+4>>2]|0;n=i;c[n>>2]=c[r>>2];c[n+4>>2]=o;o=d+88|0;rd(j,o,f,i);n=j;r=c[n+4>>2]|0;q=(c[e>>2]|0)+((c[(c[m>>2]|0)+4>>2]|0)*48|0)+8|0;c[q>>2]=c[n>>2];c[q+4>>2]=r;r=b[k>>1]|0;if(!(a[o>>0]|0))t=r;else{o=r&-3;b[k>>1]=o;t=o}s=t}if(!(s&4))u=s;else{s=d+36|0;t=(c[e>>2]|0)+((c[(c[s>>2]|0)+4>>2]|0)*48|0)+16|0;o=c[t+4>>2]|0;r=i;c[r>>2]=c[t>>2];c[r+4>>2]=o;o=d+128|0;rd(j,o,f,i);r=j;t=c[r+4>>2]|0;q=(c[e>>2]|0)+((c[(c[s>>2]|0)+4>>2]|0)*48|0)+16|0;c[q>>2]=c[r>>2];c[q+4>>2]=t;t=b[k>>1]|0;if(!(a[o>>0]|0))v=t;else{o=t&-5;b[k>>1]=o;v=o}u=v}if(!(u&8))w=u;else{u=d+36|0;v=(c[e>>2]|0)+((c[(c[u>>2]|0)+4>>2]|0)*48|0)+24|0;o=c[v+4>>2]|0;t=i;c[t>>2]=c[v>>2];c[t+4>>2]=o;o=d+168|0;rd(j,o,f,i);t=j;v=c[t+4>>2]|0;q=(c[e>>2]|0)+((c[(c[u>>2]|0)+4>>2]|0)*48|0)+24|0;c[q>>2]=c[t>>2];c[q+4>>2]=v;v=b[k>>1]|0;if(!(a[o>>0]|0))x=v;else{o=v&-9;b[k>>1]=o;x=o}w=x}if(!(w&16))y=w;else{w=d+36|0;x=(c[w>>2]|0)+8|0;o=c[x+4>>2]|0;v=i;c[v>>2]=c[x>>2];c[v+4>>2]=o;o=d+208|0;rd(j,o,f,i);i=j;j=c[i+4>>2]|0;v=(c[w>>2]|0)+8|0;c[v>>2]=c[i>>2];c[v+4>>2]=j;j=b[k>>1]|0;if(!(a[o>>0]|0))z=j;else{o=j&-17;b[k>>1]=o;z=o}y=z}if(y&32){z=d+36|0;o=d+248|0;B=+sd(o,f,+((c[(c[z>>2]|0)+32>>2]|0)>>>0)/255.0);f=B;j=B>1.0?255:~~((f<0.0?0.0:f)*255.0)>>>0;v=c[z>>2]|0;z=v+32|0;c[z>>2]=j;i=c[v+4>>2]|0;v=c[e>>2]|0;w=c[v+(i*48|0)+36>>2]|0;a:do if(i>>>0<=w>>>0){x=i;q=j;t=v;while(1){if(q>>>0>255){c[h>>2]=q;Zg(9711,h)|0}u=c[t+(x*48|0)+44>>2]|0;switch(u|0){case 7:case 5:case 4:{C=t+(x*48|0)+36|0;D=29;break}case 9:case 8:{C=t+(x*48|0)+32|0;D=29;break}default:{}}b:do if((D|0)==29){D=0;c[C>>2]=(c[C>>2]&-256)+q;switch(u|0){case 7:case 4:break;default:break b}c[t+(x*48|0)+32>>2]=(c[t+(x*48|0)+36>>2]&-256)+q}while(0);u=x+1|0;if(u>>>0>w>>>0)break a;x=u;q=c[z>>2]|0;t=c[e>>2]|0}}while(0);z=b[k>>1]|0;if(!(a[o>>0]|0))E=z;else{o=z&-33;b[k>>1]=o;E=o}}else E=y;y=d+4|0;o=a[y>>0]|0;k=E<<16>>16==0;a[y>>0]=k&1;if(!(o<<24>>24==0&k)){Ka=g;return}if(!(a[d+32>>0]|0)){Ka=g;return}k=c[d+36>>2]|0;a[k+65>>0]=0;a[k+145>>0]=0;a[k+225>>0]=0;c[(c[e>>2]|0)+((c[k+4>>2]|0)*48|0)+40>>2]=0;Ka=g;return}function qd(a,b,c){a=a|0;b=b|0;c=+c;return}function rd(b,d,e,h){b=b|0;d=d|0;e=+e;h=h|0;var i=0.0,j=0,k=0.0,l=0.0,m=0.0,n=0.0,o=0.0,p=0.0,q=0,r=0.0,u=0.0,v=0.0,w=0.0,x=0.0,y=0;i=e/1.0e3;j=d+32|0;e=+f[j>>2];k=+f[h>>2]-e;l=+f[d+36>>2];m=+f[h+4>>2]-l;n=+g[d+16>>3];o=+t(+(+g[d+8>>3]*-i*n));h=d+24|0;p=+f[h>>2];q=d+28|0;r=+f[q>>2];u=n*i;v=u+1.0;w=o;o=e+(i*p+k*v)*w;x=l+(i*r+m*v)*w;v=u;u=n;n=(p-(p+k*u)*v)*w;k=(r-(m*u+r)*v)*w;w=+s(+(o-e));e=+f[d+4>>2];if((w<e?+s(+n)<e&+s(+(x-l))<e:0)?i>0.0&+s(+k)<e:0){c[h>>2]=0;c[q>>2]=0;a[d>>0]=1;d=j;j=c[d+4>>2]|0;y=b;c[y>>2]=c[d>>2];c[y+4>>2]=j;return}f[h>>2]=n;f[q>>2]=k;f[b>>2]=o;f[b+4>>2]=x;return}function sd(b,c,d){b=b|0;c=+c;d=+d;var e=0,h=0,i=0.0,j=0,k=0.0,l=0.0,m=0.0,n=0,o=0.0,p=0.0,q=0.0,r=0.0,u=0.0,v=0.0;e=Ka;Ka=Ka+32|0;if((Ka|0)>=(La|0))A(32);h=e;i=c/1.0e3;j=b+40|0;c=+f[j>>2];k=d-c;l=+g[b+16>>3];m=+t(+-(i*+g[b+8>>3]*l));n=b+32|0;o=+g[n>>3];p=i*l;q=m*(i*o+(p+1.0)*k)+c;r=m*(o-p*(l*k+o));if(d>1.0|(d<0.0|(q>1.0|q<0.0))){g[h>>3]=q;g[h+8>>3]=d;g[h+16>>3]=o;g[h+24>>3]=i;Zg(9669,h)|0;u=+f[j>>2]}else u=c;c=+s(+(q-u));o=+g[b+24>>3];if(o>c?i>0.0&+s(+r)<o:0){g[n>>3]=0.0;a[b>>0]=1;v=u;Ka=e;return +v}g[n>>3]=r;v=q;Ka=e;return +v}function td(a,b){a=a|0;b=b|0;return}function ud(a){a=a|0;hh(a);kh(a);return}function vd(a){a=a|0;var b=0,d=0,e=0;b=c[a+12>>2]|0;if(!b)return;c[b>>2]=4584;a=c[b+40>>2]|0;if(a|0?(d=a+4|0,e=c[d>>2]|0,c[d>>2]=e+-1,(e|0)==0):0){Sa[c[(c[a>>2]|0)+8>>2]&127](a);ih(a)}c[b>>2]=4596;a=c[b+24>>2]|0;if((b+8|0)!=(a|0)){if(a|0)Sa[c[(c[a>>2]|0)+20>>2]&127](a)}else Sa[c[(c[a>>2]|0)+16>>2]&127](a);kh(b);return}function wd(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==9825?a+12|0:0)|0}function xd(a){a=a|0;kh(a);return}function yd(a,b){a=a|0;b=b|0;return}function zd(a){a=a|0;hh(a);kh(a);return}function Ad(a){a=a|0;var b=0;b=c[a+12>>2]|0;if(!b)return;Dd(b);kh(b);return}function Bd(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==10098?a+12|0:0)|0}function Cd(a){a=a|0;kh(a);return}function Dd(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0;c[a>>2]=4436;b=a+424|0;d=c[b>>2]|0;if(d|0){e=a+428|0;f=c[e>>2]|0;if((f|0)==(d|0))g=d;else{h=f;do{f=h;h=h+-12|0;i=c[h>>2]|0;if(i|0){j=f+-8|0;f=c[j>>2]|0;if((f|0)==(i|0))k=i;else{l=f;do{f=c[l+-4>>2]|0;l=l+-8|0;if(f|0?(m=f+4|0,n=c[m>>2]|0,c[m>>2]=n+-1,(n|0)==0):0){Sa[c[(c[f>>2]|0)+8>>2]&127](f);ih(f)}}while((l|0)!=(i|0));k=c[h>>2]|0}c[j>>2]=i;kh(k)}}while((h|0)!=(d|0));g=c[b>>2]|0}c[e>>2]=d;kh(g)}g=c[a+420>>2]|0;if(g|0?(d=g+4|0,e=c[d>>2]|0,c[d>>2]=e+-1,(e|0)==0):0){Sa[c[(c[g>>2]|0)+8>>2]&127](g);ih(g)}g=c[a+408>>2]|0;if((a+392|0)!=(g|0)){if(g|0)Sa[c[(c[g>>2]|0)+20>>2]&127](g)}else Sa[c[(c[g>>2]|0)+16>>2]&127](g);g=c[a+384>>2]|0;if((a+368|0)!=(g|0)){if(g|0)Sa[c[(c[g>>2]|0)+20>>2]&127](g)}else Sa[c[(c[g>>2]|0)+16>>2]&127](g);g=c[a+360>>2]|0;if((a+344|0)==(g|0)){Sa[c[(c[g>>2]|0)+16>>2]&127](g);jc(a);return}if(!g){jc(a);return}Sa[c[(c[g>>2]|0)+20>>2]&127](g);jc(a);return}function Ed(a){a=a|0;kh(a);return}function Fd(a){a=a|0;var b=0;b=jh(8)|0;c[b>>2]=4664;c[b+4>>2]=c[a+4>>2];return b|0}function Gd(a,b){a=a|0;b=b|0;c[b>>2]=4664;c[b+4>>2]=c[a+4>>2];return}function Hd(a){a=a|0;return}function Id(a){a=a|0;kh(a);return}function Jd(a,b){a=a|0;b=b|0;Md(c[a+4>>2]|0,b);return}function Kd(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==10360?a+4|0:0)|0}function Ld(a){a=a|0;return 3240}function Md(a,b){a=a|0;b=b|0;var d=0,e=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,B=0,C=0,D=0.0,E=0.0,F=0.0,G=0.0,H=0.0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0;d=Ka;Ka=Ka+80|0;if((Ka|0)>=(La|0))A(80);e=d;h=d+72|0;i=d+56|0;j=d+48|0;$g(12162)|0;k=a+52|0;l=c[k>>2]|0;if((c[l+336>>2]|0)<=0){Ka=d;return}m=h+4|0;n=b+4|0;o=a+36|0;p=a+76|0;q=j+4|0;r=i+4|0;s=a+80|0;t=a+84|0;u=a+88|0;v=0;w=l;a:while(1){b:do if((c[w+332>>2]|0)>0){l=(v|0)==1;x=0;y=w;while(1){z=c[(c[y+424>>2]|0)+(v*12|0)>>2]|0;B=c[z+(x<<3)>>2]|0;c[h>>2]=B;C=c[z+(x<<3)+4>>2]|0;c[m>>2]=C;z=B;if(C|0){B=C+4|0;c[B>>2]=(c[B>>2]|0)+1}if(l&(x|0)==2){D=+f[n>>2];E=+f[z+16>>2];F=+f[z+20>>2];G=+f[z+24>>2];H=+f[z+28>>2];g[e>>3]=+f[b>>2];g[e+8>>3]=D;g[e+16>>3]=E;g[e+24>>3]=F;g[e+32>>3]=G;g[e+40>>3]=H;Zg(10242,e)|0;I=c[h>>2]|0}else I=z;if(((((I|0)!=0?(H=+f[b>>2],G=+f[n>>2],F=+f[I+16>>2],F<=H):0)?F+ +f[I+24>>2]>=H:0)?(H=+f[I+20>>2],H<=G):0)?H+ +f[I+28>>2]>=G:0){z=c[o>>2]|0;B=c[(c[z>>2]|0)+20>>2]|0;Nd(i,p);c[j>>2]=c[h>>2];C=c[m>>2]|0;c[q>>2]=C;if(C|0){J=C+4|0;c[J>>2]=(c[J>>2]|0)+1}J=Pa[B&15](z,i,j)|0;z=c[q>>2]|0;if(z|0?(B=z+4|0,C=c[B>>2]|0,c[B>>2]=C+-1,(C|0)==0):0){Sa[c[(c[z>>2]|0)+8>>2]&127](z);ih(z)}z=c[i>>2]|0;if(z|0){C=c[r>>2]|0;if((C|0)==(z|0))K=z;else{B=C;do{C=c[B+-4>>2]|0;B=B+-8|0;do if(C|0){L=C+4|0;M=c[L>>2]|0;c[L>>2]=M+-1;if(M|0)break;Sa[c[(c[C>>2]|0)+8>>2]&127](C);ih(C)}while(0)}while((B|0)!=(z|0));K=c[i>>2]|0}c[r>>2]=z;kh(K)}if(J){B=c[s>>2]|0;if((B|0)==(c[t>>2]|0))Pd(p,h);else{c[B>>2]=c[h>>2];C=c[m>>2]|0;c[B+4>>2]=C;if(!C)N=B;else{B=C+4|0;c[B>>2]=(c[B>>2]|0)+1;N=c[s>>2]|0}c[s>>2]=N+8}Od(a,v,x);c[u>>2]=c[(c[h>>2]|0)+332>>2];O=0}else O=1}else O=7;B=c[m>>2]|0;if(B|0?(C=B+4|0,M=c[C>>2]|0,c[C>>2]=M+-1,(M|0)==0):0){Sa[c[(c[B>>2]|0)+8>>2]&127](B);ih(B)}switch(O&7){case 7:case 0:break;default:{P=41;break a}}x=x+1|0;B=c[k>>2]|0;if((x|0)>=(c[B+332>>2]|0)){Q=B;break b}else y=B}}else Q=w;while(0);v=v+1|0;if((v|0)>=(c[Q+336>>2]|0)){P=41;break}else w=Q}if((P|0)==41){Ka=d;return}}function Nd(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0;c[a>>2]=0;d=a+4|0;c[d>>2]=0;e=a+8|0;c[e>>2]=0;f=b+4|0;g=(c[f>>2]|0)-(c[b>>2]|0)|0;h=g>>3;if(!g)return;if(h>>>0>536870911)Hh(a);i=jh(g)|0;c[d>>2]=i;c[a>>2]=i;c[e>>2]=i+(h<<3);h=c[b>>2]|0;b=c[f>>2]|0;if((h|0)==(b|0))return;f=h;h=i;do{c[h>>2]=c[f>>2];i=c[f+4>>2]|0;c[h+4>>2]=i;if(i|0){e=i+4|0;c[e>>2]=(c[e>>2]|0)+1}f=f+8|0;h=(c[d>>2]|0)+8|0;c[d>>2]=h}while((f|0)!=(b|0));return}
function Od(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0;f=Ka;Ka=Ka+48|0;if((Ka|0)>=(La|0))A(48);g=f+32|0;h=f+16|0;i=f+8|0;j=f;k=b+52|0;l=c[(c[(c[k>>2]|0)+424>>2]|0)+(d*12|0)>>2]|0;d=c[l+(e<<3)>>2]|0;m=c[l+(e<<3)+4>>2]|0;e=(m|0)==0;if(!e){l=m+4|0;c[l>>2]=(c[l>>2]|0)+1}l=d;if(d|0){n=c[k>>2]|0;k=b+4|0;c[g>>2]=d;o=g+4|0;c[o>>2]=m;if(!e){p=m+4|0;c[p>>2]=(c[p>>2]|0)+1}Qd(n,k,g);g=c[o>>2]|0;if(g|0?(o=g+4|0,n=c[o>>2]|0,c[o>>2]=n+-1,(n|0)==0):0){Sa[c[(c[g>>2]|0)+8>>2]&127](g);ih(g)}g=Xh(c[l+340>>2]|0,2808,3016,0)|0;n=c[l+344>>2]|0;if(!n)q=0;else{o=n+4|0;c[o>>2]=(c[o>>2]|0)+1;q=n}n=c[b+36>>2]|0;o=c[k>>2]|0;c[o+(((c[o+((c[g+4>>2]|0)*48|0)+32>>2]|0)+1|0)*48|0)+32>>2]=c[n+8>>2];g=l+336|0;if(!(a[g>>0]|0)){l=c[(c[n>>2]|0)+16>>2]|0;Nd(h,b+76|0);c[i>>2]=d;d=i+4|0;c[d>>2]=m;if(!e){o=m+4|0;c[o>>2]=(c[o>>2]|0)+1}c[j>>2]=c[b+60>>2];o=j+4|0;p=c[b+64>>2]|0;c[o>>2]=p;if(p|0){b=p+4|0;c[b>>2]=(c[b>>2]|0)+1}Ya[l&15](n,k,h,i,j);j=c[o>>2]|0;if(j|0?(o=j+4|0,i=c[o>>2]|0,c[o>>2]=i+-1,(i|0)==0):0){Sa[c[(c[j>>2]|0)+8>>2]&127](j);ih(j)}j=c[d>>2]|0;if(j|0?(d=j+4|0,i=c[d>>2]|0,c[d>>2]=i+-1,(i|0)==0):0){Sa[c[(c[j>>2]|0)+8>>2]&127](j);ih(j)}j=c[h>>2]|0;if(j|0){i=h+4|0;d=c[i>>2]|0;if((d|0)==(j|0))r=j;else{o=d;do{d=c[o+-4>>2]|0;o=o+-8|0;if(d|0?(k=d+4|0,n=c[k>>2]|0,c[k>>2]=n+-1,(n|0)==0):0){Sa[c[(c[d>>2]|0)+8>>2]&127](d);ih(d)}}while((o|0)!=(j|0));r=c[h>>2]|0}c[i>>2]=j;kh(r)}}a[g>>0]=1;if(q|0?(g=q+4|0,r=c[g>>2]|0,c[g>>2]=r+-1,(r|0)==0):0){Sa[c[(c[q>>2]|0)+8>>2]&127](q);ih(q)}}if(e){Ka=f;return}e=m+4|0;q=c[e>>2]|0;c[e>>2]=q+-1;if(q|0){Ka=f;return}Sa[c[(c[m>>2]|0)+8>>2]&127](m);ih(m);Ka=f;return}function Pd(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0;d=a+4|0;e=c[d>>2]|0;f=c[a>>2]|0;g=e-f>>3;h=g+1|0;i=f;j=e;if(h>>>0>536870911)Hh(a);e=a+8|0;k=(c[e>>2]|0)-f|0;f=k>>2;l=k>>3>>>0<268435455?(f>>>0<h>>>0?h:f):536870911;do if(l)if(l>>>0>536870911){f=fa(8)|0;ph(f,7751);c[f>>2]=5904;ja(f|0,3912,82)}else{m=jh(l<<3)|0;break}else m=0;while(0);f=m+(g<<3)|0;h=m+(l<<3)|0;c[f>>2]=c[b>>2];l=c[b+4>>2]|0;c[m+(g<<3)+4>>2]=l;if(!l){n=i;o=j}else{j=l+4|0;c[j>>2]=(c[j>>2]|0)+1;n=c[a>>2]|0;o=c[d>>2]|0}j=f+8|0;l=n;if((o|0)==(n|0)){p=f;q=l;r=o}else{i=g+-1-((o+-8-l|0)>>>3)|0;l=o;o=f;do{f=o;o=o+-8|0;g=l;l=l+-8|0;c[o>>2]=c[l>>2];b=g+-4|0;c[f+-4>>2]=c[b>>2];c[l>>2]=0;c[b>>2]=0}while((l|0)!=(n|0));p=m+(i<<3)|0;q=c[a>>2]|0;r=c[d>>2]|0}c[a>>2]=p;c[d>>2]=j;c[e>>2]=h;h=q;if((r|0)!=(h|0)){e=r;do{r=c[e+-4>>2]|0;e=e+-8|0;if(r|0?(j=r+4|0,d=c[j>>2]|0,c[j>>2]=d+-1,(d|0)==0):0){Sa[c[(c[r>>2]|0)+8>>2]&127](r);ih(r)}}while((e|0)!=(h|0))}if(!q)return;kh(q);return}function Qd(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0;f=Ka;Ka=Ka+64|0;if((Ka|0)>=(La|0))A(64);g=f+8|0;h=f;i=c[e>>2]|0;j=c[e+4>>2]|0;k=j;if(j|0){l=j+4|0;c[l>>2]=(c[l>>2]|0)+1}l=b+336|0;if((c[l>>2]|0)>0){j=b+332|0;m=b+424|0;b=0;n=c[(c[d>>2]|0)+((c[(c[e>>2]|0)+4>>2]|0)*48|0)+32>>2]|0;o=i;p=k;q=c[j>>2]|0;while(1){if((q|0)>0){r=0;s=n;t=o;u=p;while(1){v=c[(c[m>>2]|0)+(b*12|0)>>2]|0;w=c[v+(r<<3)>>2]|0;x=c[v+(r<<3)+4>>2]|0;v=(x|0)==0;if(!v){y=x+4|0;c[y>>2]=(c[y>>2]|0)+1}if(((w|0)!=0?(a[w+336>>0]|0)==0:0)?(y=c[(c[d>>2]|0)+((c[w+4>>2]|0)*48|0)+32>>2]|0,y>>>0>s>>>0):0){z=x;if(!v){B=x+4|0;c[B>>2]=(c[B>>2]|0)+1}B=u;if((u|0)!=0?(C=B+4|0,D=c[C>>2]|0,c[C>>2]=D+-1,(D|0)==0):0){Sa[c[(c[u>>2]|0)+8>>2]&127](B);ih(B);E=y;F=w;G=z}else{E=y;F=w;G=z}}else{E=s;F=t;G=u}if(!v?(v=x+4|0,z=c[v>>2]|0,c[v>>2]=z+-1,(z|0)==0):0){Sa[c[(c[x>>2]|0)+8>>2]&127](x);ih(x)}r=r+1|0;x=c[j>>2]|0;if((r|0)>=(x|0)){H=E;I=F;J=G;K=x;break}else{s=E;t=F;u=G}}}else{H=n;I=o;J=p;K=q}b=b+1|0;if((b|0)>=(c[l>>2]|0)){L=e;M=I;N=J;break}else{n=H;o=I;p=J;q=K}}}else{L=e;M=i;N=k}k=M;i=c[k+328>>2]|0;c[h>>2]=c[k+324>>2];c[h+4>>2]=i;Zg(10295,h)|0;h=c[L>>2]|0;L=M;M=c[h+4>>2]|0;i=c[d>>2]|0;k=c[i+(M*48|0)+32>>2]|0;e=c[i+(M*48|0)+36>>2]|0;M=c[L+4>>2]|0;K=c[i+(M*48|0)+32>>2]|0;q=c[i+(M*48|0)+36>>2]|0;c[g>>2]=h;c[g+4>>2]=L;c[g+8>>2]=k;c[g+12>>2]=e;c[g+16>>2]=K;c[g+20>>2]=q;Zg(10314,g)|0;q=1-k+e|0;e=0;do{M=c[d>>2]|0;i=M+((e+k|0)*48|0)|0;J=M+((e+K|0)*48|0)|0;M=g;p=i;I=M+48|0;do{c[M>>2]=c[p>>2];M=M+4|0;p=p+4|0}while((M|0)<(I|0));M=i;p=J;I=M+48|0;do{c[M>>2]=c[p>>2];M=M+4|0;p=p+4|0}while((M|0)<(I|0));M=J;p=g;I=M+48|0;do{c[M>>2]=c[p>>2];M=M+4|0;p=p+4|0}while((M|0)<(I|0));e=e+1|0}while((e|0)!=(q|0));Rd(h,d,K);Rd(L,d,k);k=N;if(!N){Ka=f;return}d=k+4|0;L=c[d>>2]|0;c[d>>2]=L+-1;if(L|0){Ka=f;return}Sa[c[(c[N>>2]|0)+8>>2]&127](k);ih(k);Ka=f;return}function Rd(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0;e=a+4|0;f=d-(c[e>>2]|0)|0;c[e>>2]=d;e=c[b>>2]|0;c[e+(d*48|0)+32>>2]=d;g=e+(d*48|0)+36|0;c[g>>2]=(c[g>>2]|0)+f;g=c[a+312>>2]|0;d=c[a+316>>2]|0;if((g|0)==(d|0))return;a=g;do{g=c[a>>2]|0;e=c[a+4>>2]|0;if(e){h=e+4|0;c[h>>2]=(c[h>>2]|0)+1;Rd(g,b,(c[g+4>>2]|0)+f|0);h=e+4|0;i=c[h>>2]|0;c[h>>2]=i+-1;if(!i){Sa[c[(c[e>>2]|0)+8>>2]&127](e);ih(e)}}else Rd(g,b,(c[g+4>>2]|0)+f|0);a=a+8|0}while((a|0)!=(d|0));return}function Sd(a){a=a|0;kh(a);return}function Td(a){a=a|0;var b=0;b=jh(8)|0;c[b>>2]=4708;c[b+4>>2]=c[a+4>>2];return b|0}function Ud(a,b){a=a|0;b=b|0;c[b>>2]=4708;c[b+4>>2]=c[a+4>>2];return}function Vd(a){a=a|0;return}function Wd(a){a=a|0;kh(a);return}function Xd(a,b){a=a|0;b=b|0;_d(c[a+4>>2]|0,b);return}function Yd(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==10510?a+4|0:0)|0}function Zd(a){a=a|0;return 3264}function _d(b,d){b=b|0;d=d|0;var e=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,B=0,C=0,D=0,E=0.0,F=0.0,G=0.0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0;e=Ka;Ka=Ka+32|0;if((Ka|0)>=(La|0))A(32);g=e+24|0;h=e+8|0;i=e;j=b+52|0;k=c[j>>2]|0;if((c[k+336>>2]|0)<=0){Ka=e;return}l=g+4|0;m=d+4|0;n=b+76|0;o=b+80|0;p=b+36|0;q=i+4|0;r=h+4|0;s=b+84|0;t=0;u=k;a:while(1){b:do if((c[u+332>>2]|0)>0){k=t+-1|0;v=t+1|0;w=(t&1|0)==0;x=0;y=u;while(1){z=c[(c[y+424>>2]|0)+(t*12|0)>>2]|0;B=c[z+(x<<3)>>2]|0;c[g>>2]=B;C=c[z+(x<<3)+4>>2]|0;c[l>>2]=C;z=B;if(C|0){D=C+4|0;c[D>>2]=(c[D>>2]|0)+1}c:do if(((((B|0)!=0?(E=+f[d>>2],F=+f[m>>2],G=+f[z+16>>2],G<=E):0)?G+ +f[z+24>>2]>=E:0)?(E=+f[z+20>>2],E<=F):0)?E+ +f[z+28>>2]>=F:0){D=c[o>>2]|0;C=c[n>>2]|0;H=D-C|0;I=H>>3;J=C;C=D;if((I>>>0>=2?(D=c[J+(I+-2<<3)>>2]|0,(c[D+324>>2]|0)==(t|0)):0)?(c[D+328>>2]|0)==(x|0):0){D=c[J+(I+-1<<3)>>2]|0;K=c[D+324>>2]|0;L=c[D+328>>2]|0;D=c[C+-4>>2]|0;if(D|0?(M=D+4|0,N=c[M>>2]|0,c[M>>2]=N+-1,(N|0)==0):0){Sa[c[(c[D>>2]|0)+8>>2]&127](D);ih(D)}c[o>>2]=C+-8;$d(b,K,L);O=1;break}if(!(a[z+336>>0]|0)){do if(H|0){L=c[j>>2]|0;K=c[J+(I+-1<<3)>>2]|0;C=c[K+324>>2]|0;D=c[K+328>>2]|0;if((C|0)==(t|0)?(x+-1|0)==(D|0)|(x+1|0)==(D|0):0)break;if((D|0)==(x|0)?(k|0)==(C|0)|(v|0)==(C|0):0)break;K=a[L+456>>0]|0;if((x+1|0)==(D|0)&(w&K<<24>>24!=0^1)?(k|0)==(C|0)|(v|0)==(C|0):0)break;if(!((x+-1|0)==(D|0)&(w|K<<24>>24==0))){O=1;break c}if(!((k|0)==(C|0)|(v|0)==(C|0))){O=1;break c}}while(0);I=c[p>>2]|0;J=c[(c[I>>2]|0)+20>>2]|0;Nd(h,n);c[i>>2]=c[g>>2];H=c[l>>2]|0;c[q>>2]=H;if(H|0){C=H+4|0;c[C>>2]=(c[C>>2]|0)+1}C=Pa[J&15](I,h,i)|0;I=c[q>>2]|0;if(I|0?(J=I+4|0,H=c[J>>2]|0,c[J>>2]=H+-1,(H|0)==0):0){Sa[c[(c[I>>2]|0)+8>>2]&127](I);ih(I)}I=c[h>>2]|0;if(I|0){H=c[r>>2]|0;if((H|0)==(I|0))P=I;else{J=H;do{H=c[J+-4>>2]|0;J=J+-8|0;do if(H|0){K=H+4|0;D=c[K>>2]|0;c[K>>2]=D+-1;if(D|0)break;Sa[c[(c[H>>2]|0)+8>>2]&127](H);ih(H)}while(0)}while((J|0)!=(I|0));P=c[h>>2]|0}c[r>>2]=I;kh(P)}if(C){J=c[o>>2]|0;if((J|0)==(c[s>>2]|0))Pd(n,g);else{c[J>>2]=c[g>>2];H=c[l>>2]|0;c[J+4>>2]=H;if(!H)Q=J;else{J=H+4|0;c[J>>2]=(c[J>>2]|0)+1;Q=c[o>>2]|0}c[o>>2]=Q+8}Od(b,t,x);O=0}else O=1}else O=1}else O=7;while(0);z=c[l>>2]|0;if(z|0?(B=z+4|0,J=c[B>>2]|0,c[B>>2]=J+-1,(J|0)==0):0){Sa[c[(c[z>>2]|0)+8>>2]&127](z);ih(z)}switch(O&7){case 7:case 0:break;default:{R=57;break a}}x=x+1|0;z=c[j>>2]|0;if((x|0)>=(c[z+332>>2]|0)){S=v;T=z;break b}else y=z}}else{S=t+1|0;T=u}while(0);if((S|0)<(c[T+336>>2]|0)){t=S;u=T}else{R=57;break}}if((R|0)==57){Ka=e;return}}function $d(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0;f=Ka;Ka=Ka+32|0;if((Ka|0)>=(La|0))A(32);g=f+16|0;h=f+8|0;i=f;j=c[(c[(c[b+52>>2]|0)+424>>2]|0)+(d*12|0)>>2]|0;d=c[j+(e<<3)>>2]|0;k=c[j+(e<<3)+4>>2]|0;e=(k|0)==0;if(!e){j=k+4|0;c[j>>2]=(c[j>>2]|0)+1}j=d;if(d|0){l=Xh(c[j+340>>2]|0,2808,3016,0)|0;m=c[j+344>>2]|0;if(!m)n=0;else{o=m+4|0;c[o>>2]=(c[o>>2]|0)+1;n=m}m=b+4|0;o=c[m>>2]|0;c[o+(((c[o+((c[l+4>>2]|0)*48|0)+32>>2]|0)+1|0)*48|0)+32>>2]=-256;l=j+336|0;if(a[l>>0]|0){j=c[b+36>>2]|0;o=c[(c[j>>2]|0)+12>>2]|0;Nd(g,b+76|0);c[h>>2]=d;d=h+4|0;c[d>>2]=k;if(!e){p=k+4|0;c[p>>2]=(c[p>>2]|0)+1}c[i>>2]=c[b+60>>2];p=i+4|0;q=c[b+64>>2]|0;c[p>>2]=q;if(q|0){b=q+4|0;c[b>>2]=(c[b>>2]|0)+1}Ya[o&15](j,m,g,h,i);i=c[p>>2]|0;if(i|0?(p=i+4|0,h=c[p>>2]|0,c[p>>2]=h+-1,(h|0)==0):0){Sa[c[(c[i>>2]|0)+8>>2]&127](i);ih(i)}i=c[d>>2]|0;if(i|0?(d=i+4|0,h=c[d>>2]|0,c[d>>2]=h+-1,(h|0)==0):0){Sa[c[(c[i>>2]|0)+8>>2]&127](i);ih(i)}i=c[g>>2]|0;if(i|0){h=g+4|0;d=c[h>>2]|0;if((d|0)==(i|0))r=i;else{p=d;do{d=c[p+-4>>2]|0;p=p+-8|0;if(d|0?(m=d+4|0,j=c[m>>2]|0,c[m>>2]=j+-1,(j|0)==0):0){Sa[c[(c[d>>2]|0)+8>>2]&127](d);ih(d)}}while((p|0)!=(i|0));r=c[g>>2]|0}c[h>>2]=i;kh(r)}}a[l>>0]=0;if(n|0?(l=n+4|0,r=c[l>>2]|0,c[l>>2]=r+-1,(r|0)==0):0){Sa[c[(c[n>>2]|0)+8>>2]&127](n);ih(n)}}if(e){Ka=f;return}e=k+4|0;n=c[e>>2]|0;c[e>>2]=n+-1;if(n|0){Ka=f;return}Sa[c[(c[k>>2]|0)+8>>2]&127](k);ih(k);Ka=f;return}function ae(a){a=a|0;kh(a);return}function be(a){a=a|0;var b=0;b=jh(8)|0;c[b>>2]=4752;c[b+4>>2]=c[a+4>>2];return b|0}function ce(a,b){a=a|0;b=b|0;c[b>>2]=4752;c[b+4>>2]=c[a+4>>2];return}function de(a){a=a|0;return}function ee(a){a=a|0;kh(a);return}function fe(a,b){a=a|0;b=b|0;ie(c[a+4>>2]|0,b);return}function ge(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==10686?a+4|0:0)|0}function he(a){a=a|0;return 3288}function ie(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0;b=Ka;Ka=Ka+16|0;if((Ka|0)>=(La|0))A(16);d=b;e=c[a+36>>2]|0;f=c[(c[e>>2]|0)+24>>2]|0;Nd(d,a+76|0);g=Oa[f&31](e,d)|0;e=c[d>>2]|0;if(e|0){f=d+4|0;h=c[f>>2]|0;if((h|0)==(e|0))i=e;else{j=h;do{h=c[j+-4>>2]|0;j=j+-8|0;if(h|0?(k=h+4|0,l=c[k>>2]|0,c[k>>2]=l+-1,(l|0)==0):0){Sa[c[(c[h>>2]|0)+8>>2]&127](h);ih(h)}}while((j|0)!=(e|0));i=c[d>>2]|0}c[f>>2]=e;kh(i)}if(g){je(a);Ka=b;return}else{ke(a);Ka=b;return}}function je(d){d=d|0;var e=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0.0;e=Ka;Ka=Ka+16|0;if((Ka|0)>=(La|0))A(16);g=e;h=d+76|0;i=c[h>>2]|0;j=d+80|0;k=c[j>>2]|0;l=d+36|0;if((i|0)!=(k|0)){m=g+4|0;n=d+4|0;o=d+52|0;p=i;do{i=c[p>>2]|0;q=c[p+4>>2]|0;r=(q|0)==0;if(!r){s=q+4|0;c[s>>2]=(c[s>>2]|0)+1}s=i;t=c[s+324>>2]|0;u=c[s+328>>2]|0;a[s+336>>0]=0;v=c[l>>2]|0;w=c[(c[v>>2]|0)+8>>2]|0;c[g>>2]=i;c[m>>2]=q;if(!r){x=q+4|0;c[x>>2]=(c[x>>2]|0)+1}Ua[w&31](v,g);v=c[m>>2]|0;if(v|0?(w=v+4|0,x=c[w>>2]|0,c[w>>2]=x+-1,(x|0)==0):0){Sa[c[(c[v>>2]|0)+8>>2]&127](v);ih(v)}v=Xh(c[s+304>>2]|0,3160,3168,0)|0;x=c[s+308>>2]|0;if(!x)y=0;else{s=x+4|0;c[s>>2]=(c[s>>2]|0)+1;y=x}x=c[i+4>>2]|0;i=c[n>>2]|0;z=+f[i+(x*48|0)+12>>2]*2.0;f[v+120>>2]=+f[i+(x*48|0)+8>>2]*2.0;f[v+124>>2]=z;a[v+88>>0]=0;x=v+44|0;i=b[x>>1]|0;f[v+288>>2]=0.0;a[v+248>>0]=0;a[v+5>>0]=0;a[v+4>>0]=0;b[x>>1]=i|34;a[v+32>>0]=1;v=c[(c[(c[o>>2]|0)+424>>2]|0)+(t*12|0)>>2]|0;c[v+(u<<3)>>2]=0;t=v+(u<<3)+4|0;u=c[t>>2]|0;c[t>>2]=0;if(u|0?(t=u+4|0,v=c[t>>2]|0,c[t>>2]=v+-1,(v|0)==0):0){Sa[c[(c[u>>2]|0)+8>>2]&127](u);ih(u)}if(y|0?(u=y+4|0,v=c[u>>2]|0,c[u>>2]=v+-1,(v|0)==0):0){Sa[c[(c[y>>2]|0)+8>>2]&127](y);ih(y)}if(!r?(r=q+4|0,v=c[r>>2]|0,c[r>>2]=v+-1,(v|0)==0):0){Sa[c[(c[q>>2]|0)+8>>2]&127](q);ih(q)}p=p+8|0}while((p|0)!=(k|0))}k=c[l>>2]|0;Sa[c[(c[k>>2]|0)+28>>2]&127](k);k=c[h>>2]|0;h=c[j>>2]|0;if((h|0)!=(k|0)){p=h;do{h=c[p+-4>>2]|0;p=p+-8|0;if(h|0?(y=h+4|0,o=c[y>>2]|0,c[y>>2]=o+-1,(o|0)==0):0){Sa[c[(c[h>>2]|0)+8>>2]&127](h);ih(h)}}while((p|0)!=(k|0))}c[j>>2]=k;switch(c[(c[l>>2]|0)+24>>2]|0){case 0:{le(c[d+52>>2]|0,d+4|0);me(d);Ka=e;return}case 1:{l=d+52|0;k=d+4|0;le(c[l>>2]|0,k);ne(c[l>>2]|0,k);Ka=e;return}default:{Ka=e;return}}}function ke(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;b=Ka;Ka=Ka+16|0;if((Ka|0)>=(La|0))A(16);d=b;e=a+76|0;Nd(d,e);f=c[e>>2]|0;e=a+80|0;g=c[e>>2]|0;if((g|0)!=(f|0)){h=g;do{g=c[h+-4>>2]|0;h=h+-8|0;if(g|0?(i=g+4|0,j=c[i>>2]|0,c[i>>2]=j+-1,(j|0)==0):0){Sa[c[(c[g>>2]|0)+8>>2]&127](g);ih(g)}}while((h|0)!=(f|0))}c[e>>2]=f;f=c[d>>2]|0;e=d+4|0;h=c[e>>2]|0;if((f|0)==(h|0))k=f;else{g=f;do{f=c[g>>2]|0;j=c[g+4>>2]|0;if(j){i=j+4|0;c[i>>2]=(c[i>>2]|0)+1;$d(a,c[f+324>>2]|0,c[f+328>>2]|0);i=j+4|0;l=c[i>>2]|0;c[i>>2]=l+-1;if(!l){Sa[c[(c[j>>2]|0)+8>>2]&127](j);ih(j)}}else $d(a,c[f+324>>2]|0,c[f+328>>2]|0);g=g+8|0}while((g|0)!=(h|0));k=c[d>>2]|0}if(!k){Ka=b;return}h=c[e>>2]|0;if((h|0)==(k|0))m=k;else{g=h;do{h=c[g+-4>>2]|0;g=g+-8|0;if(h|0?(a=h+4|0,f=c[a>>2]|0,c[a>>2]=f+-1,(f|0)==0):0){Sa[c[(c[h>>2]|0)+8>>2]&127](h);ih(h)}}while((g|0)!=(k|0));m=c[d>>2]|0}c[e>>2]=k;kh(m);Ka=b;return}function le(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0;d=a+332|0;if((c[d>>2]|0)<=0)return;e=a+336|0;f=a+424|0;g=0;do{h=c[e>>2]|0;if((h|0)>0){i=h;h=-1;while(1){j=i;i=i+-1|0;k=c[(c[f>>2]|0)+(i*12|0)>>2]|0;l=c[k+(g<<3)>>2]|0;m=c[k+(g<<3)+4>>2]|0;k=(m|0)==0;if(!k){n=m+4|0;c[n>>2]=(c[n>>2]|0)+1}if(l)if((h|0)>-1){oe(a,b,i,g,h,g);o=h+-1|0}else o=h;else o=(h|0)==-1?i:h;if(!k?(k=m+4|0,l=c[k>>2]|0,c[k>>2]=l+-1,(l|0)==0):0){Sa[c[(c[m>>2]|0)+8>>2]&127](m);ih(m)}if((j|0)<=1)break;else h=o}}g=g+1|0}while((g|0)<(c[d>>2]|0));return}function me(d){d=d|0;var e=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0.0,J=0.0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0.0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0;e=Ka;Ka=Ka+32|0;if((Ka|0)>=(La|0))A(32);h=e;i=e+16|0;j=e+24|0;k=e+8|0;if((a[15512]|0)==0?wi(15512)|0:0){g[1948]=-500.0;g[1949]=500.0}l=d+52|0;m=c[l>>2]|0;n=c[m+336>>2]|0;o=d+36|0;if((n|0)<=(c[(c[o>>2]|0)+20>>2]|0)){p=d+4|0;q=m;r=c[q>>2]|0;s=r+8|0;t=c[s>>2]|0;u=q+44|0;v=q+36|0;Xa[t&15](q,p,u,v);Ka=e;return}w=i+4|0;x=d+56|0;y=d+4|0;z=k+4|0;B=j+4|0;C=n;n=m;D=m;E=m;while(1){C=C+-1|0;if((c[E+332>>2]|0)>0){m=0;F=D;G=n;H=E;while(1){if(!(c[(c[(c[H+424>>2]|0)+(C*12|0)>>2]|0)+(m<<3)>>2]|0)){I=+g[1948];J=+g[1949]-I;K=c[4535]|0;L=((K+1|0)>>>0)%624|0;M=15644+(K<<2)|0;N=15644+(L<<2)|0;O=c[N>>2]|0;P=0-(O&1)&-1727483681^c[15644+((((K+397|0)>>>0)%624|0)<<2)>>2]^(O&2147483646|c[M>>2]&-2147483648)>>>1;c[M>>2]=P;M=P>>>11^P;P=M<<7&-1658038656^M;M=P<<15&-272236544^P;P=((L+1|0)>>>0)%624|0;O=c[15644+(P<<2)>>2]|0;K=0-(O&1)&-1727483681^c[15644+((((L+397|0)>>>0)%624|0)<<2)>>2]^(O&2147483646|c[N>>2]&-2147483648)>>>1;c[N>>2]=K;N=K>>>11^K;K=N<<7&-1658038656^N;N=K<<15&-272236544^K;c[4535]=P;Q=I+J*((+((N>>>18^N)>>>0)*4294967296.0+ +((M>>>18^M)>>>0))*5.421010862427522e-20);M=c[o>>2]|0;N=c[c[M>>2]>>2]|0;c[i>>2]=F;P=c[x>>2]|0;c[w>>2]=P;if(P|0){K=P+4|0;c[K>>2]=(c[K>>2]|0)+1}K=Qa[N&7](M,i,C,m)|0;M=c[w>>2]|0;if(M|0?(N=M+4|0,P=c[N>>2]|0,c[N>>2]=P+-1,(P|0)==0):0){Sa[c[(c[M>>2]|0)+8>>2]&127](M);ih(M)}pe(j,c[l>>2]|0,y,C,m,K);$d(d,C,m);K=c[o>>2]|0;M=c[(c[K>>2]|0)+4>>2]|0;c[k>>2]=c[j>>2];P=c[B>>2]|0;c[z>>2]=P;if(P|0){N=P+4|0;c[N>>2]=(c[N>>2]|0)+1}Wa[M&7](K,y,k);K=c[z>>2]|0;if(K|0?(M=K+4|0,N=c[M>>2]|0,c[M>>2]=N+-1,(N|0)==0):0){Sa[c[(c[K>>2]|0)+8>>2]&127](K);ih(K)}K=c[j>>2]|0;N=K+4|0;M=c[N>>2]|0;P=c[y>>2]|0;c[P+(M*48|0)+16>>2]=0;f[P+(M*48|0)+20>>2]=Q+-1.0e3;M=K+32|0;c[M>>2]=255;P=c[N>>2]|0;N=c[y>>2]|0;O=c[N+(P*48|0)+36>>2]|0;if(P>>>0>O>>>0)R=K;else{K=P;P=255;L=N;while(1){if(P>>>0>255){c[h>>2]=P;Zg(9711,h)|0}N=c[L+(K*48|0)+44>>2]|0;switch(N|0){case 7:case 5:case 4:{S=L+(K*48|0)+36|0;T=30;break}case 9:case 8:{S=L+(K*48|0)+32|0;T=30;break}default:{}}a:do if((T|0)==30){T=0;c[S>>2]=(c[S>>2]&-256)+P;switch(N|0){case 7:case 4:break;default:break a}c[L+(K*48|0)+32>>2]=(c[L+(K*48|0)+36>>2]&-256)+P}while(0);N=K+1|0;if(N>>>0>O>>>0)break;K=N;P=c[M>>2]|0;L=c[y>>2]|0}R=c[j>>2]|0}L=c[R+304>>2]|0;if((L|0)!=0?(M=Xh(L,3160,3168,0)|0,(M|0)!=0):0){L=c[R+308>>2]|0;if(!L){U=M;V=0}else{P=L+4|0;c[P>>2]=(c[P>>2]|0)+1;U=M;V=L}}else{U=0;V=0}c[U+160>>2]=0;c[U+164>>2]=0;a[U+128>>0]=0;a[U+5>>0]=0;a[U+4>>0]=0;L=U+44|0;b[L>>1]=b[L>>1]|4;a[U+32>>0]=0;if(V|0?(L=V+4|0,M=c[L>>2]|0,c[L>>2]=M+-1,(M|0)==0):0){Sa[c[(c[V>>2]|0)+8>>2]&127](V);ih(V)}M=c[B>>2]|0;if(M|0?(L=M+4|0,P=c[L>>2]|0,c[L>>2]=P+-1,(P|0)==0):0){Sa[c[(c[M>>2]|0)+8>>2]&127](M);ih(M)}M=c[l>>2]|0;W=M;X=M}else{W=G;X=H}m=m+1|0;if((m|0)>=(c[X+332>>2]|0))break;else{F=X;G=W;H=X}}Y=W;Z=X;_=X}else{Y=n;Z=D;_=E}if((C|0)<=(c[(c[o>>2]|0)+20>>2]|0)){p=y;q=Y;break}else{n=Y;D=Z;E=_}}r=c[q>>2]|0;s=r+8|0;t=c[s>>2]|0;u=q+44|0;v=q+36|0;Xa[t&15](q,p,u,v);Ka=e;return}function ne(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0;d=a+332|0;if((c[d>>2]|0)<=0)return;e=a+336|0;f=a+424|0;g=0;h=c[e>>2]|0;while(1){if((h|0)>1){i=1;do{j=c[(c[f>>2]|0)+(i*12|0)>>2]|0;k=c[j+(g<<3)>>2]|0;l=c[j+(g<<3)+4>>2]|0;j=(l|0)==0;if(!j){m=l+4|0;c[m>>2]=(c[m>>2]|0)+1}if(k|0)oe(a,b,i,g,i+-1|0,g);if(!j?(j=l+4|0,k=c[j>>2]|0,c[j>>2]=k+-1,(k|0)==0):0){Sa[c[(c[l>>2]|0)+8>>2]&127](l);ih(l)}i=i+1|0;l=c[e>>2]|0}while((i|0)<(l|0));n=l}else n=h;g=g+1|0;if((g|0)>=(c[d>>2]|0))break;else h=n}return}function oe(d,e,g,h,i,j){d=d|0;e=e|0;g=g|0;h=h|0;i=i|0;j=j|0;var k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0.0;e=Ka;Ka=Ka+16|0;if((Ka|0)>=(La|0))A(16);k=e+8|0;l=e;m=d+336|0;n=c[m>>2]|0;if(n>>>0>g>>>0?(c[d+332>>2]|0)>>>0>h>>>0:0)o=n;else{c[l>>2]=g;c[l+4>>2]=h;Zg(10660,l)|0;o=c[m>>2]|0}if(!(o>>>0>i>>>0?(c[d+332>>2]|0)>>>0>j>>>0:0)){c[k>>2]=i;c[k+4>>2]=j;Zg(10660,k)|0}k=d+424|0;o=c[k>>2]|0;m=c[o+(g*12|0)>>2]|0;l=c[m+(h<<3)>>2]|0;n=c[m+(h<<3)+4>>2]|0;m=(n|0)==0;if(m)p=o;else{o=n+4|0;c[o>>2]=(c[o>>2]|0)+1;p=c[k>>2]|0}o=l;c[o+324>>2]=i;c[o+328>>2]=j;q=c[p+(i*12|0)>>2]|0;if(!m){p=n+4|0;c[p>>2]=(c[p>>2]|0)+1}c[q+(j<<3)>>2]=l;l=q+(j<<3)+4|0;q=c[l>>2]|0;c[l>>2]=n;if(q|0?(l=q+4|0,p=c[l>>2]|0,c[l>>2]=p+-1,(p|0)==0):0){Sa[c[(c[q>>2]|0)+8>>2]&127](q);ih(q)}q=c[(c[k>>2]|0)+(g*12|0)>>2]|0;c[q+(h<<3)>>2]=0;g=q+(h<<3)+4|0;h=c[g>>2]|0;c[g>>2]=0;if(h|0?(g=h+4|0,q=c[g>>2]|0,c[g>>2]=q+-1,(q|0)==0):0){Sa[c[(c[h>>2]|0)+8>>2]&127](h);ih(h)}h=Xh(c[o+304>>2]|0,3160,3168,0)|0;q=c[o+308>>2]|0;if(!q)r=0;else{o=q+4|0;c[o>>2]=(c[o>>2]|0)+1;r=q}s=+f[d+444>>2]*+(i|0)+ +f[d+452>>2]*+(i+1|0);f[h+80>>2]=+f[d+440>>2]*+(j|0)+ +f[d+448>>2]*+(j+1|0);f[h+84>>2]=s;a[h+48>>0]=0;a[h+5>>0]=0;a[h+4>>0]=0;j=h+44|0;b[j>>1]=b[j>>1]|1;if(r|0?(j=r+4|0,h=c[j>>2]|0,c[j>>2]=h+-1,(h|0)==0):0){Sa[c[(c[r>>2]|0)+8>>2]&127](r);ih(r)}if(m){Ka=e;return}m=n+4|0;r=c[m>>2]|0;c[m>>2]=r+-1;if(r|0){Ka=e;return}Sa[c[(c[n>>2]|0)+8>>2]&127](n);ih(n);Ka=e;return}function pe(a,b,d,e,g,h){a=a|0;b=b|0;d=d|0;e=e|0;g=g|0;h=h|0;var i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0.0;i=Ka;Ka=Ka+32|0;if((Ka|0)>=(La|0))A(32);j=i;k=i+20|0;l=i+16|0;m=i+12|0;n=i+8|0;if(!((c[b+336>>2]|0)>>>0>e>>>0?(c[b+332>>2]|0)>>>0>g>>>0:0)){c[j>>2]=e;c[j+4>>2]=g;Zg(10660,j)|0}j=c[b+416>>2]|0;o=c[j>>2]|0;p=c[j+4>>2]|0;a:do if((o|0)!=(p|0)){j=o;while(1){q=c[j>>2]|0;r=c[j+4>>2]|0;s=(r|0)==0;if(!s){t=r+4|0;c[t>>2]=(c[t>>2]|0)+1}u=(c[d>>2]|0)+((c[q+4>>2]|0)*48|0)+40|0;if(!(c[u>>2]|0))break;if(!s?(s=r+4|0,t=c[s>>2]|0,c[s>>2]=t+-1,(t|0)==0):0){Sa[c[(c[r>>2]|0)+8>>2]&127](r);ih(r)}j=j+8|0;if((j|0)==(p|0)){v=13;break a}}c[u>>2]=1;j=Xh(q,2808,3128,0)|0;if(!j){c[a>>2]=0;c[a+4>>2]=0;if(!r)break;w=r+4|0}else{c[a>>2]=j;c[a+4>>2]=r;if(!r)break;j=r+4|0;c[j>>2]=(c[j>>2]|0)+1;w=j}j=c[w>>2]|0;c[w>>2]=j+-1;if(!j){Sa[c[(c[r>>2]|0)+8>>2]&127](r);ih(r)}}else v=13;while(0);if((v|0)==13){c[a>>2]=0;c[a+4>>2]=0}v=c[a>>2]|0;c[v+324>>2]=e;c[v+328>>2]=g;c[v+332>>2]=h;r=a+4|0;w=c[r>>2]|0;q=(w|0)==0;if(!q){u=w+4|0;c[u>>2]=(c[u>>2]|0)+1}u=b+440|0;p=b+444|0;o=c[p>>2]|0;j=v+4|0;v=c[j>>2]|0;t=c[d>>2]|0;c[t+(v*48|0)+8>>2]=c[u>>2];c[t+(v*48|0)+12>>2]=o;x=+f[p>>2]*+(e|0)+ +f[b+452>>2]*+(e+1|0);p=c[j>>2]|0;o=c[d>>2]|0;f[o+(p*48|0)>>2]=+f[u>>2]*+(g|0)+ +f[b+448>>2]*+(g+1|0);f[o+(p*48|0)+4>>2]=x;p=c[j>>2]|0;j=c[d>>2]|0;c[j+(p*48|0)+16>>2]=0;c[j+(p*48|0)+20>>2]=0;if(!q?(q=w+4|0,p=c[q>>2]|0,c[q>>2]=p+-1,(p|0)==0):0){Sa[c[(c[w>>2]|0)+8>>2]&127](w);ih(w)}w=c[(c[b+424>>2]|0)+(e*12|0)>>2]|0;p=c[a>>2]|0;q=c[r>>2]|0;if(q|0){r=q+4|0;c[r>>2]=(c[r>>2]|0)+1}c[w+(g<<3)>>2]=p;p=w+(g<<3)+4|0;w=c[p>>2]|0;c[p>>2]=q;if(w|0?(q=w+4|0,p=c[q>>2]|0,c[q>>2]=p+-1,(p|0)==0):0){Sa[c[(c[w>>2]|0)+8>>2]&127](w);ih(w)}w=c[b+408>>2]|0;if(!w){Ka=i;return}c[k>>2]=c[(c[a>>2]|0)+340>>2];c[l>>2]=e;c[m>>2]=g;c[n>>2]=h;Ya[c[(c[w>>2]|0)+24>>2]&15](w,k,l,m,n);Ka=i;return}function qe(a,b){a=a|0;b=b|0;return}function re(b){b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0;c[b+4>>2]=0;d=b+8|0;c[d>>2]=-1;c[b+12>>2]=2;c[b+16>>2]=1;c[b+20>>2]=0;c[b+24>>2]=0;c[b>>2]=5040;e=b+28|0;c[e>>2]=0;f=b+32|0;c[f>>2]=0;g=b+36|0;c[g>>2]=0;h=jh(860)|0;c[e>>2]=h;c[g>>2]=h+860;c[h>>2]=0;c[h+4>>2]=0;c[h+8>>2]=0;c[h+12>>2]=0;c[h+16>>2]=0;g=h+20|0;c[g>>2]=0;c[g+4>>2]=0;c[g+8>>2]=0;c[g+12>>2]=0;c[g+16>>2]=0;g=h+40|0;c[g>>2]=0;c[g+4>>2]=0;c[g+8>>2]=0;c[g+12>>2]=0;c[g+16>>2]=0;g=h+60|0;c[g>>2]=0;c[g+4>>2]=0;c[g+8>>2]=0;c[g+12>>2]=0;c[g+16>>2]=0;g=h+80|0;c[g>>2]=0;c[g+4>>2]=0;c[g+8>>2]=0;c[g+12>>2]=0;c[g+16>>2]=0;g=h+100|0;c[g>>2]=0;c[g+4>>2]=0;c[g+8>>2]=0;c[g+12>>2]=0;c[g+16>>2]=0;g=h+120|0;c[g>>2]=0;c[g+4>>2]=0;c[g+8>>2]=0;c[g+12>>2]=0;c[g+16>>2]=0;g=h+140|0;c[g>>2]=0;c[g+4>>2]=0;c[g+8>>2]=0;c[g+12>>2]=0;c[g+16>>2]=0;g=h+160|0;c[g>>2]=0;c[g+4>>2]=0;c[g+8>>2]=0;c[g+12>>2]=0;c[g+16>>2]=0;g=h+180|0;c[g>>2]=0;c[g+4>>2]=0;c[g+8>>2]=0;c[g+12>>2]=0;c[g+16>>2]=0;g=h+200|0;c[g>>2]=0;c[g+4>>2]=0;c[g+8>>2]=0;c[g+12>>2]=0;c[g+16>>2]=0;g=h+220|0;c[g>>2]=0;c[g+4>>2]=0;c[g+8>>2]=0;c[g+12>>2]=0;c[g+16>>2]=0;g=h+240|0;c[g>>2]=0;c[g+4>>2]=0;c[g+8>>2]=0;c[g+12>>2]=0;c[g+16>>2]=0;g=h+260|0;c[g>>2]=0;c[g+4>>2]=0;c[g+8>>2]=0;c[g+12>>2]=0;c[g+16>>2]=0;g=h+280|0;c[g>>2]=0;c[g+4>>2]=0;c[g+8>>2]=0;c[g+12>>2]=0;c[g+16>>2]=0;g=h+300|0;c[g>>2]=0;c[g+4>>2]=0;c[g+8>>2]=0;c[g+12>>2]=0;c[g+16>>2]=0;g=h+320|0;c[g>>2]=0;c[g+4>>2]=0;c[g+8>>2]=0;c[g+12>>2]=0;c[g+16>>2]=0;g=h+340|0;c[g>>2]=0;c[g+4>>2]=0;c[g+8>>2]=0;c[g+12>>2]=0;c[g+16>>2]=0;g=h+360|0;c[g>>2]=0;c[g+4>>2]=0;c[g+8>>2]=0;c[g+12>>2]=0;c[g+16>>2]=0;g=h+380|0;c[g>>2]=0;c[g+4>>2]=0;c[g+8>>2]=0;c[g+12>>2]=0;c[g+16>>2]=0;g=h+400|0;c[g>>2]=0;c[g+4>>2]=0;c[g+8>>2]=0;c[g+12>>2]=0;c[g+16>>2]=0;g=h+420|0;c[g>>2]=0;c[g+4>>2]=0;c[g+8>>2]=0;c[g+12>>2]=0;c[g+16>>2]=0;g=h+440|0;c[g>>2]=0;c[g+4>>2]=0;c[g+8>>2]=0;c[g+12>>2]=0;c[g+16>>2]=0;g=h+460|0;c[g>>2]=0;c[g+4>>2]=0;c[g+8>>2]=0;c[g+12>>2]=0;c[g+16>>2]=0;g=h+480|0;c[g>>2]=0;c[g+4>>2]=0;c[g+8>>2]=0;c[g+12>>2]=0;c[g+16>>2]=0;g=h+500|0;c[g>>2]=0;c[g+4>>2]=0;c[g+8>>2]=0;c[g+12>>2]=0;c[g+16>>2]=0;g=h+520|0;c[g>>2]=0;c[g+4>>2]=0;c[g+8>>2]=0;c[g+12>>2]=0;c[g+16>>2]=0;g=h+540|0;c[g>>2]=0;c[g+4>>2]=0;c[g+8>>2]=0;c[g+12>>2]=0;c[g+16>>2]=0;g=h+560|0;c[g>>2]=0;c[g+4>>2]=0;c[g+8>>2]=0;c[g+12>>2]=0;c[g+16>>2]=0;g=h+580|0;c[g>>2]=0;c[g+4>>2]=0;c[g+8>>2]=0;c[g+12>>2]=0;c[g+16>>2]=0;g=h+600|0;c[g>>2]=0;c[g+4>>2]=0;c[g+8>>2]=0;c[g+12>>2]=0;c[g+16>>2]=0;g=h+620|0;c[g>>2]=0;c[g+4>>2]=0;c[g+8>>2]=0;c[g+12>>2]=0;c[g+16>>2]=0;g=h+640|0;c[g>>2]=0;c[g+4>>2]=0;c[g+8>>2]=0;c[g+12>>2]=0;c[g+16>>2]=0;g=h+660|0;c[g>>2]=0;c[g+4>>2]=0;c[g+8>>2]=0;c[g+12>>2]=0;c[g+16>>2]=0;g=h+680|0;c[g>>2]=0;c[g+4>>2]=0;c[g+8>>2]=0;c[g+12>>2]=0;c[g+16>>2]=0;g=h+700|0;c[g>>2]=0;c[g+4>>2]=0;c[g+8>>2]=0;c[g+12>>2]=0;c[g+16>>2]=0;g=h+720|0;c[g>>2]=0;c[g+4>>2]=0;c[g+8>>2]=0;c[g+12>>2]=0;c[g+16>>2]=0;g=h+740|0;c[g>>2]=0;c[g+4>>2]=0;c[g+8>>2]=0;c[g+12>>2]=0;c[g+16>>2]=0;g=h+760|0;c[g>>2]=0;c[g+4>>2]=0;c[g+8>>2]=0;c[g+12>>2]=0;c[g+16>>2]=0;g=h+780|0;c[g>>2]=0;c[g+4>>2]=0;c[g+8>>2]=0;c[g+12>>2]=0;c[g+16>>2]=0;g=h+800|0;c[g>>2]=0;c[g+4>>2]=0;c[g+8>>2]=0;c[g+12>>2]=0;c[g+16>>2]=0;g=h+820|0;c[g>>2]=0;c[g+4>>2]=0;c[g+8>>2]=0;c[g+12>>2]=0;c[g+16>>2]=0;g=h+840|0;c[g>>2]=0;c[g+4>>2]=0;c[g+8>>2]=0;c[g+12>>2]=0;c[g+16>>2]=0;c[f>>2]=h+860;h=b+40|0;c[h>>2]=0;f=b+44|0;c[f>>2]=0;g=b+48|0;c[g>>2]=0;i=jh(12)|0;c[h>>2]=i;j=i+12|0;c[g>>2]=j;c[i>>2]=0;c[i+4>>2]=0;c[i+8>>2]=0;c[f>>2]=j;c[d>>2]=3407735;d=b+12|0;c[d>>2]=4;c[d+4>>2]=4;d=0;do{if((a[15576]|0)==0?wi(15576)|0:0){c[4551]=0;c[4552]=1}b=(Fe(18204,15644,18204)|0)!=0&1;j=c[e>>2]|0;c[j+(d*20|0)>>2]=d;a[j+(d*20|0)+16>>0]=b;d=d+1|0}while(d>>>0<43);d=c[f>>2]|0;f=c[h>>2]|0;h=f;if((d|0)==(f|0))return;e=d-f>>2;f=0;do{c[h+(f<<2)>>2]=f;f=f+1|0}while(f>>>0<e>>>0);return}function se(a,b){a=a|0;b=b|0;return}function te(a){a=a|0;hh(a);kh(a);return}function ue(a){a=a|0;var b=0;b=c[a+12>>2]|0;if(!b)return;kh(b);return}function ve(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==10852?a+12|0:0)|0}function we(a){a=a|0;kh(a);return}function xe(b,d,e,f){b=b|0;d=d|0;e=e|0;f=f|0;if((a[15520]|0)==0?wi(15520)|0:0){c[4536]=0;c[4537]=0;c[4538]=0;f=jh(12)|0;c[4536]=f;e=f+12|0;c[4538]=e;c[f>>2]=c[1214];c[f+4>>2]=c[1215];c[f+8>>2]=c[1216];c[4537]=e}if((a[15528]|0)==0?wi(15528)|0:0){e=((c[4537]|0)-(c[4536]|0)>>2)+-1|0;c[4539]=0;c[4540]=e}e=Fe(18156,15644,18156)|0;return c[(c[4536]|0)+(e<<2)>>2]|0}function ye(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0;a=c[d>>2]|0;e=Xh(c[a+340>>2]|0,2808,3016,0)|0;f=c[a+344>>2]|0;if(!f){g=0;h=a}else{a=f+4|0;c[a>>2]=(c[a>>2]|0)+1;g=f;h=c[d>>2]|0}d=c[b>>2]|0;c[d+(((c[d+((c[e+4>>2]|0)*48|0)+32>>2]|0)+1|0)*48|0)+36>>2]=c[h+332>>2];if(!g)return;h=g+4|0;e=c[h>>2]|0;c[h>>2]=e+-1;if(e|0)return;Sa[c[(c[g>>2]|0)+8>>2]&127](g);ih(g);return}function ze(a,b){a=a|0;b=b|0;return}function Ae(a,b,c,d,e){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;return}function Be(a,b,c,d,e){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;return}function Ce(a,b,d){a=a|0;b=b|0;d=d|0;a=c[b>>2]|0;if((c[b+4>>2]|0)==(a|0))return 1;else return (c[(c[a>>2]|0)+332>>2]|0)==(c[(c[d>>2]|0)+332>>2]|0)|0;return 0}function De(a,b){a=a|0;b=b|0;return (c[b+4>>2]|0)-(c[b>>2]|0)>>3>>>0>2|0}function Ee(a){a=a|0;return}function Fe(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;a=c[d>>2]|0;e=(c[d+4>>2]|0)-a|0;f=e+1|0;if(!e){g=a;return g|0}if(!f){a=b+2496|0;e=c[a>>2]|0;h=((e+1|0)>>>0)%624|0;i=b+(e<<2)|0;j=c[b+(h<<2)>>2]|0;k=0-(j&1)&-1727483681^c[b+((((e+397|0)>>>0)%624|0)<<2)>>2]^(j&2147483646|c[i>>2]&-2147483648)>>>1;c[i>>2]=k;i=k>>>11^k;c[a>>2]=h;h=i<<7&-1658038656^i;i=h<<15&-272236544^h;g=i>>>18^i;return g|0}i=32-(w(f|0)|0)|0;h=i+(((-1>>>(33-i|0)&f|0)==0)<<31>>31)|0;i=(h>>>5)+((h&31|0)!=0&1)|0;a=i>>>0>h>>>0?0:-1>>>(32-((h>>>0)/(i>>>0)|0)|0);i=b+2496|0;h=c[i>>2]|0;do{k=h;h=((h+1|0)>>>0)%624|0;j=b+(k<<2)|0;e=c[b+(h<<2)>>2]|0;l=0-(e&1)&-1727483681^c[b+((((k+397|0)>>>0)%624|0)<<2)>>2]^(e&2147483646|c[j>>2]&-2147483648)>>>1;c[j>>2]=l;j=l>>>11^l;l=j<<7&-1658038656^j;j=l<<15&-272236544^l;m=(j>>>18^j)&a}while(m>>>0>=f>>>0);c[i>>2]=h;g=(c[d>>2]|0)+m|0;return g|0}function Ge(a){a=a|0;hh(a);kh(a);return}function He(b){b=b|0;var d=0;d=c[b+12>>2]|0;if(!d)return;c[d>>2]=4904;b=d+28|0;if((a[b+11>>0]|0)<0)kh(c[b>>2]|0);kh(d);return}function Ie(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==11113?a+12|0:0)|0}function Je(a){a=a|0;kh(a);return}function Ke(b,d,e,f){b=b|0;d=d|0;e=e|0;f=f|0;do if((a[15536]|0)==0?wi(15536)|0:0){c[4541]=0;c[4542]=0;c[4543]=0;f=Ki(26,0,3)|0;z()|0;if(f>>3>>>0>536870911)Hh(18164);else{f=Ki(26,0,3)|0;z()|0;e=jh(f)|0;c[4541]=e;f=Ki(26,0,3)|0;z()|0;c[4543]=e+(f>>3<<3);g[e>>3]=9.0;g[e+8>>3]=2.0;g[e+16>>3]=2.0;g[e+24>>3]=4.0;g[e+32>>3]=12.0;g[e+40>>3]=2.0;g[e+48>>3]=3.0;g[e+56>>3]=2.0;g[e+64>>3]=9.0;g[e+72>>3]=1.0;g[e+80>>3]=1.0;g[e+88>>3]=4.0;g[e+96>>3]=2.0;g[e+104>>3]=6.0;g[e+112>>3]=8.0;g[e+120>>3]=2.0;g[e+128>>3]=1.0;g[e+136>>3]=6.0;g[e+144>>3]=4.0;g[e+152>>3]=6.0;g[e+160>>3]=4.0;g[e+168>>3]=2.0;g[e+176>>3]=2.0;g[e+184>>3]=1.0;g[e+192>>3]=2.0;g[e+200>>3]=1.0;c[4542]=e+208;Se(18164);break}}while(0);return (Ue(18164,15644,18164)|0)<<24>>24|0}function Le(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0;f=Ka;Ka=Ka+32|0;if((Ka|0)>=(La|0))A(32);g=f;h=f+16|0;i=c[e>>2]|0;e=c[i+332>>2]<<24;j=(e+1090519040|0)>>>24;a:do if(!e)k=3;else{l=e+-67108864|0;switch(l>>>25|l<<7|0){case 0:case 2:case 5:case 8:{k=3;break a;break}default:{}}m=b+40|0}while(0);if((k|0)==3)m=b+44|0;c[m>>2]=(c[m>>2]|0)+1;m=c[i+340>>2]|0;if((m|0)!=0?(b=Xh(m,2808,3016,0)|0,(b|0)!=0):0){m=c[i+344>>2]|0;if(!m){n=b;o=0}else{i=m+4|0;c[i>>2]=(c[i>>2]|0)+1;n=b;o=m}}else{n=0;o=0}m=c[d>>2]|0;c[m+(((c[m+((c[n+4>>2]|0)*48|0)+32>>2]|0)+1|0)*48|0)+36>>2]=577149439;a[g>>0]=j;a[g+1>>0]=0;j=c[n+324>>2]|0;c[h>>2]=0;c[h+4>>2]=0;c[h+8>>2]=0;n=ig(g)|0;if(n>>>0>4294967279)rh(h);if(n>>>0<11){a[h+11>>0]=n;if(!n)p=h;else{q=h;k=14}}else{m=n+16&-16;b=jh(m)|0;c[h>>2]=b;c[h+8>>2]=m|-2147483648;c[h+4>>2]=n;q=b;k=14}if((k|0)==14){Mi(q|0,g|0,n|0)|0;p=q}a[p+n>>0]=0;Ve(j,d,h);if((a[h+11>>0]|0)<0)kh(c[h>>2]|0);if(!o){Ka=f;return}h=o+4|0;d=c[h>>2]|0;c[h>>2]=d+-1;if(d|0){Ka=f;return}Sa[c[(c[o>>2]|0)+8>>2]&127](o);ih(o);Ka=f;return}function Me(a,b){a=a|0;b=b|0;var d=0,e=0,f=0;d=c[(c[b>>2]|0)+332>>2]<<24;a:do if(!d)e=3;else{b=d+-67108864|0;switch(b>>>25|b<<7|0){case 0:case 2:case 5:case 8:{e=3;break a;break}default:{}}f=a+40|0}while(0);if((e|0)==3)f=a+44|0;c[f>>2]=(c[f>>2]|0)+-1;return}function Ne(b,d,e,f,g){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0;g=Ka;Ka=Ka+16|0;if((Ka|0)>=(La|0))A(16);f=g;e=b+28|0;d=e+11|0;if((a[d>>0]|0)<0)h=c[e>>2]|0;else h=e;c[f>>2]=h;Zg(11061,f)|0;f=a[d>>0]|0;if(f<<24>>24<0){h=b+32|0;b=(c[h>>2]|0)+-1|0;c[h>>2]=b;i=(c[e>>2]|0)+b|0;a[i>>0]=0;Ka=g;return}else{b=(f&255)+-1|0;a[d>>0]=b;i=e+b|0;a[i>>0]=0;Ka=g;return}}function Oe(b,d,e,f,g){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0,j=0,k=0;g=Ka;Ka=Ka+16|0;if((Ka|0)>=(La|0))A(16);e=g;d=(c[(c[f>>2]|0)+332>>2]|0)+65|0;h=b+28|0;Dh(h,d&255);b=h+11|0;if((a[b>>0]|0)<0)i=c[h>>2]|0;else i=h;j=Y(i|0)|0;i=c[(c[f>>2]|0)+332>>2]|0;if((a[b>>0]|0)<0)k=c[h>>2]|0;else k=h;c[e>>2]=d<<24>>24;c[e+4>>2]=i;c[e+8>>2]=k;c[e+12>>2]=j?11106:11110;Zg(11077,e)|0;Ka=g;return}function Pe(a,b,c){a=a|0;b=b|0;c=c|0;return 1}function Qe(b,d){b=b|0;d=d|0;var e=0,f=0;if((c[d+4>>2]|0)-(c[d>>2]|0)>>3>>>0<=2){e=0;return e|0}d=b+28|0;if((a[d+11>>0]|0)<0)f=c[d>>2]|0;else f=d;e=Y(f|0)|0;return e|0}function Re(a){a=a|0;Ah(a+28|0,18800)|0;return}function Se(a){a=a|0;var b=0,d=0,e=0,f=0,h=0,i=0,j=0,k=0,l=0.0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0.0;b=Ka;Ka=Ka+16|0;if((Ka|0)>=(La|0))A(16);d=b;e=c[a>>2]|0;f=a+4|0;h=c[f>>2]|0;i=h;j=e;if((e|0)==(h|0)){Ka=b;return}k=i-j>>3;if(k>>>0<=1){c[f>>2]=j;Te(a);Ka=b;return}l=0.0;m=e;do{l=l+ +g[m>>3];m=m+8|0}while((m|0)!=(h|0));if(e>>>0<h>>>0){m=e;do{g[m>>3]=+g[m>>3]/l;m=m+8|0}while(m>>>0<h>>>0)}m=k+-1|0;c[d>>2]=0;k=d+4|0;c[k>>2]=0;n=d+8|0;c[n>>2]=0;do if(m)if(m>>>0>536870911)Hh(d);else{o=m<<3;p=jh(o)|0;c[d>>2]=p;q=p+(m<<3)|0;c[n>>2]=q;Oi(p|0,0,o|0)|0;c[k>>2]=q;r=p;s=p;t=q;break}else{r=0;s=0;t=0}while(0);m=h+-8|0;if((e|0)!=(m|0)?(l=+g[e>>3],g[r>>3]=l,h=e+8|0,(h|0)!=(m|0)):0){u=l;q=r;r=h;do{q=q+8|0;u=u+ +g[r>>3];g[q>>3]=u;r=r+8|0}while((r|0)!=(m|0))}c[a>>2]=s;c[d>>2]=j;c[f>>2]=t;c[k>>2]=i;i=a+8|0;a=c[i>>2]|0;c[i>>2]=t;c[n>>2]=a;if(e|0){c[k>>2]=j;kh(e)}Ka=b;return}function Te(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0;b=a+8|0;d=c[a>>2]|0;e=a+4|0;f=(c[e>>2]|0)-d|0;g=f>>3;if((c[b>>2]|0)-d>>3>>>0<=g>>>0)return;if(f){if(g>>>0>536870911){h=fa(8)|0;ph(h,7751);c[h>>2]=5904;ja(h|0,3912,82)}h=jh(f)|0;i=h+(g<<3)|0;j=h;if((f|0)>0){Mi(h|0,d|0,f|0)|0;k=j;l=i}else{k=j;l=i}}else{k=0;l=0+(g<<3)|0}c[a>>2]=k;c[e>>2]=l;c[b>>2]=l;if(!d)return;kh(d);return}function Ue(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,h=0,i=0,j=0,k=0,l=0,m=0.0,n=0,o=0,p=0;a=c[d>>2]|0;e=c[d+4>>2]|0;d=b+2496|0;f=c[d>>2]|0;h=((f+1|0)>>>0)%624|0;i=b+(f<<2)|0;j=b+(h<<2)|0;k=c[j>>2]|0;l=0-(k&1)&-1727483681^c[b+((((f+397|0)>>>0)%624|0)<<2)>>2]^(k&2147483646|c[i>>2]&-2147483648)>>>1;c[i>>2]=l;i=l>>>11^l;l=i<<7&-1658038656^i;i=l<<15&-272236544^l;l=((h+1|0)>>>0)%624|0;k=c[b+(l<<2)>>2]|0;f=0-(k&1)&-1727483681^c[b+((((h+397|0)>>>0)%624|0)<<2)>>2]^(k&2147483646|c[j>>2]&-2147483648)>>>1;c[j>>2]=f;j=f>>>11^f;f=j<<7&-1658038656^j;j=f<<15&-272236544^f;c[d>>2]=l;m=(+((j>>>18^j)>>>0)*4294967296.0+ +((i>>>18^i)>>>0))*5.421010862427522e-20+0.0;i=a;j=e-i|0;if(!j){n=i;o=n-i|0;p=o>>3;return p|0}e=j>>3;j=a;l=a;while(1){a=(e|0)/2|0;d=l+(a<<3)|0;f=m<+g[d>>3];k=d+8|0;j=f?j:k;e=f?a:e+-1-a|0;if(!e)break;else l=f?l:k}n=j;o=n-i|0;p=o>>3;return p|0}function Ve(b,d,e){b=b|0;d=d|0;e=e|0;var g=0,h=0,i=0,j=0,k=0,l=0;g=b+4|0;h=c[d>>2]|0;i=(c[h+((c[g>>2]|0)*48|0)+32>>2]|0)+1|0;if((c[h+(i*48|0)+44>>2]|0)==8){if(!(bc(15620,e)|0)){j=c[3903]|0;k=(j-(c[3902]|0)|0)/12|0;l=j;if((c[3904]|0)==(l|0))cc(15608,e);else{sh(l,e);c[3903]=(c[3903]|0)+12}c[(ac(15620,e)|0)>>2]=k}c[h+(i*48|0)+36>>2]=c[(ac(15620,e)|0)>>2];f[h+(i*48|0)+16>>2]=+V(((a[e+11>>0]|0)<0?c[e>>2]|0:e)|0,+(+f[h+(i*48|0)+20>>2]))}if((c[b+56>>2]|0)!=2)return;i=c[g>>2]|0;g=c[d>>2]|0;h=g+(((c[g+(i*48|0)+32>>2]|0)+1|0)*48|0)+16|0;e=c[h+4>>2]|0;k=g+(i*48|0)+24|0;c[k>>2]=c[h>>2];c[k+4>>2]=e;Xa[c[(c[b>>2]|0)+8>>2]&15](b,d,b+44|0,b+36|0);return}function We(a){a=a|0;hh(a);kh(a);return}function Xe(a){a=a|0;var b=0;b=c[a+12>>2]|0;if(!b)return;kh(b);return}function Ye(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==11260?a+12|0:0)|0}function Ze(a){a=a|0;kh(a);return}function _e(b,d,e,f){b=b|0;d=d|0;e=e|0;f=f|0;var h=0,i=0,j=0,k=0,l=0.0,m=0,n=0,o=0,p=0,q=0,r=0,s=0.0,t=0,u=0;h=Ka;Ka=Ka+32|0;if((Ka|0)>=(La|0))A(32);i=h+16|0;j=h+8|0;k=h;if((a[15544]|0)==0?wi(15544)|0:0)g[1950]=1.0;l=+g[1950]-0.0;m=c[4535]|0;n=((m+1|0)>>>0)%624|0;o=15644+(m<<2)|0;p=15644+(n<<2)|0;q=c[p>>2]|0;r=0-(q&1)&-1727483681^c[15644+((((m+397|0)>>>0)%624|0)<<2)>>2]^(q&2147483646|c[o>>2]&-2147483648)>>>1;c[o>>2]=r;o=r>>>11^r;r=o<<7&-1658038656^o;o=r<<15&-272236544^r;r=((n+1|0)>>>0)%624|0;q=c[15644+(r<<2)>>2]|0;m=0-(q&1)&-1727483681^c[15644+((((n+397|0)>>>0)%624|0)<<2)>>2]^(q&2147483646|c[p>>2]&-2147483648)>>>1;c[p>>2]=m;p=m>>>11^m;m=p<<7&-1658038656^p;p=m<<15&-272236544^m;c[4535]=r;s=l*((+((p>>>18^p)>>>0)*4294967296.0+ +((o>>>18^o)>>>0))*5.421010862427522e-20)+0.0;c[i>>2]=c[d>>2];o=i+4|0;p=d+4|0;r=c[p>>2]|0;c[o>>2]=r;if(r|0){m=r+4|0;c[m>>2]=(c[m>>2]|0)+1}if(gf(b,i,e,f)|0){c[j>>2]=c[d>>2];i=j+4|0;m=c[p>>2]|0;c[i>>2]=m;if(m|0){r=m+4|0;c[r>>2]=(c[r>>2]|0)+1}r=hf(b,j,e,f)|0;j=c[i>>2]|0;if((j|0)!=0?(i=j+4|0,m=c[i>>2]|0,c[i>>2]=m+-1,(m|0)==0):0){Sa[c[(c[j>>2]|0)+8>>2]&127](j);ih(j);t=r}else t=r}else t=0;r=c[o>>2]|0;if(r|0?(o=r+4|0,j=c[o>>2]|0,c[o>>2]=j+-1,(j|0)==0):0){Sa[c[(c[r>>2]|0)+8>>2]&127](r);ih(r)}if(t){if((a[15552]|0)==0?wi(15552)|0:0){c[4544]=1;c[4545]=2}if((c[b+28>>2]|0)<2){u=131072;Ka=h;return u|0}if((c[b+32>>2]|0)<2){u=65536;Ka=h;return u|0}u=(jf(18176,15644,18176)|0)<<16;Ka=h;return u|0}c[k>>2]=c[d>>2];d=k+4|0;t=c[p>>2]|0;c[d>>2]=t;if(t|0){p=t+4|0;c[p>>2]=(c[p>>2]|0)+1}p=s<.4&(gf(b,k,e,f)|0);f=c[d>>2]|0;if(f|0?(d=f+4|0,e=c[d>>2]|0,c[d>>2]=e+-1,(e|0)==0):0){Sa[c[(c[f>>2]|0)+8>>2]&127](f);ih(f)}if(p){if((a[15560]|0)==0?wi(15560)|0:0){c[4546]=3;c[4547]=4}u=(jf(18184,15644,18184)|0)<<16;Ka=h;return u|0}do if((a[15568]|0)==0?wi(15568)|0:0){c[4548]=0;c[4549]=0;c[4550]=0;p=Ki(12,0,3)|0;z()|0;if(p>>3>>>0>536870911)Hh(18192);else{p=Ki(12,0,3)|0;z()|0;f=jh(p)|0;c[4548]=f;p=Ki(12,0,3)|0;z()|0;c[4550]=f+(p>>3<<3);g[f>>3]=10.0;g[f+8>>3]=16.0;g[f+16>>3]=16.0;g[f+24>>3]=13.0;g[f+32>>3]=10.0;g[f+40>>3]=7.0;g[f+48>>3]=4.0;g[f+56>>3]=3.0;g[f+64>>3]=2.0;g[f+72>>3]=1.0;g[f+80>>3]=1.0;g[f+88>>3]=1.0;c[4549]=f+96;Se(18192);break}}while(0);f=Ue(18192,15644,18192)|0;u=(f|0)<-1?65279-f|0:f+1|0;Ka=h;return u|0}function $e(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0;f=Ka;Ka=Ka+32|0;if((Ka|0)>=(La|0))A(32);g=f+16|0;h=f;i=c[e>>2]|0;e=c[i+332>>2]|0;j=e&255;k=e>>>16;c[g>>2]=k;c[g+4>>2]=(e&65280|0)==0?j:0-j|0;j=k&65535;switch(j<<16>>16){case 2:{l=b+28|0;m=4;break}case 1:{l=b+32|0;m=4;break}default:{}}if((m|0)==4)c[l>>2]=(c[l>>2]|0)+1;l=c[i+340>>2]|0;if((l|0)!=0?(k=Xh(l,2808,3016,0)|0,(k|0)!=0):0){l=c[i+344>>2]|0;if(!l){n=k;o=0}else{i=l+4|0;c[i>>2]=(c[i>>2]|0)+1;n=k;o=l}}else{n=0;o=0}switch(j<<16>>16){case 0:{j=c[d>>2]|0;p=577149439;q=j;r=j+((c[n+4>>2]|0)*48|0)+32|0;m=15;break}case 2:{j=c[d>>2]|0;p=-1156500481;q=j;r=j+((c[n+4>>2]|0)*48|0)+32|0;m=15;break}case 1:{j=c[d>>2]|0;p=581588479;q=j;r=j+((c[n+4>>2]|0)*48|0)+32|0;m=15;break}case 3:{j=c[d>>2]|0;p=572666879;q=j;r=j+((c[n+4>>2]|0)*48|0)+32|0;m=15;break}case 4:{j=c[d>>2]|0;p=855646975;q=j;r=j+((c[n+4>>2]|0)*48|0)+32|0;m=15;break}default:{}}if((m|0)==15)c[q+(((c[r>>2]|0)+1|0)*48|0)+36>>2]=p;p=c[n+324>>2]|0;kf(h,g,c[b+4>>2]|0);Ve(p,d,h);if((a[h+11>>0]|0)<0)kh(c[h>>2]|0);if(!o){Ka=f;return}h=o+4|0;d=c[h>>2]|0;c[h>>2]=d+-1;if(d|0){Ka=f;return}Sa[c[(c[o>>2]|0)+8>>2]&127](o);ih(o);Ka=f;return}function af(a,b){a=a|0;b=b|0;var d=0,e=0;switch(((c[(c[b>>2]|0)+332>>2]|0)>>>16&65535)<<16>>16){case 2:{d=a+28|0;e=-1;break}case 1:{d=a+32|0;e=1;break}default:return}c[d>>2]=(c[d>>2]|0)+e;return}function bf(b,d,e,f,h){b=b|0;d=d|0;e=e|0;f=f|0;h=h|0;var i=0,j=0,k=0,l=0.0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0;f=Ka;Ka=Ka+48|0;if((Ka|0)>=(La|0))A(48);i=f+16|0;j=f+28|0;k=f;Nd(j,e);l=+lf(b,j);b=c[j>>2]|0;if(b|0){e=j+4|0;m=c[e>>2]|0;if((m|0)==(b|0))n=b;else{o=m;do{m=c[o+-4>>2]|0;o=o+-8|0;if(m|0?(p=m+4|0,q=c[p>>2]|0,c[p>>2]=q+-1,(q|0)==0):0){Sa[c[(c[m>>2]|0)+8>>2]&127](m);ih(m)}}while((o|0)!=(b|0));n=c[j>>2]|0}c[e>>2]=b;kh(n)}g[i>>3]=l;Xg(k,11452,i)|0;n=c[h>>2]|0;c[i>>2]=0;c[i+4>>2]=0;c[i+8>>2]=0;h=ig(k)|0;if(h>>>0>4294967279)rh(i);if(h>>>0<11){a[i+11>>0]=h;if(!h)r=i;else{s=i;t=15}}else{b=h+16&-16;e=jh(b)|0;c[i>>2]=e;c[i+8>>2]=b|-2147483648;c[i+4>>2]=h;s=e;t=15}if((t|0)==15){Mi(s|0,k|0,h|0)|0;r=s}a[r+h>>0]=0;Ve(n,d,i);if((a[i+11>>0]|0)>=0){Ka=f;return}kh(c[i>>2]|0);Ka=f;return}function cf(b,d,e,f,h){b=b|0;d=d|0;e=e|0;f=f|0;h=h|0;var i=0,j=0,k=0,l=0,m=0.0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0;f=Ka;Ka=Ka+64|0;if((Ka|0)>=(La|0))A(64);i=f+32|0;j=f+16|0;k=f+48|0;l=f;Nd(k,e);m=+lf(b,k);b=c[k>>2]|0;if(b|0){e=k+4|0;n=c[e>>2]|0;if((n|0)==(b|0))o=b;else{p=n;do{n=c[p+-4>>2]|0;p=p+-8|0;if(n|0?(q=n+4|0,r=c[q>>2]|0,c[q>>2]=r+-1,(r|0)==0):0){Sa[c[(c[n>>2]|0)+8>>2]&127](n);ih(n)}}while((p|0)!=(b|0));o=c[k>>2]|0}c[e>>2]=b;kh(o)}g[j>>3]=m;Xg(l,11452,j)|0;o=c[h>>2]|0;c[j>>2]=0;c[j+4>>2]=0;c[j+8>>2]=0;h=ig(l)|0;if(h>>>0>4294967279)rh(j);if(h>>>0<11){a[j+11>>0]=h;if(!h)s=j;else{t=j;u=15}}else{b=h+16&-16;e=jh(b)|0;c[j>>2]=e;c[j+8>>2]=b|-2147483648;c[j+4>>2]=h;t=e;u=15}if((u|0)==15){Mi(t|0,l|0,h|0)|0;s=t}a[s+h>>0]=0;Ve(o,d,j);if((a[j+11>>0]|0)>=0){g[i>>3]=m;v=i+8|0;c[v>>2]=l;Zg(11476,i)|0;Ka=f;return}kh(c[j>>2]|0);g[i>>3]=m;v=i+8|0;c[v>>2]=l;Zg(11476,i)|0;Ka=f;return}function df(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0;a=(c[(c[d>>2]|0)+332>>2]|0)>>>16;d=c[b>>2]|0;e=(c[b+4>>2]|0)-d|0;if(!e){f=(a|0)==0;return f|0}else{f=(c[(c[d+((e>>3)+-1<<3)>>2]|0)+332>>2]|0)>>>0<65536?(a|0)!=0:(a|0)==0;return f|0}return 0}function ef(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0.0,j=0,k=0,l=0;d=Ka;Ka=Ka+16|0;if((Ka|0)>=(La|0))A(16);e=d;f=c[b>>2]|0;g=(c[b+4>>2]|0)-f|0;if(!g){h=0;Ka=d;return h|0}if((c[(c[f+((g>>3)+-1<<3)>>2]|0)+332>>2]|0)>>>0>=65536){h=0;Ka=d;return h|0}Nd(e,b);i=+lf(a,e);a=c[e>>2]|0;if(a|0){b=e+4|0;g=c[b>>2]|0;if((g|0)==(a|0))j=a;else{f=g;do{g=c[f+-4>>2]|0;f=f+-8|0;if(g|0?(k=g+4|0,l=c[k>>2]|0,c[k>>2]=l+-1,(l|0)==0):0){Sa[c[(c[g>>2]|0)+8>>2]&127](g);ih(g)}}while((f|0)!=(a|0));j=c[e>>2]|0}c[b>>2]=a;kh(j)}h=+s(+i)<.0001;Ka=d;return h|0}function ff(a){a=a|0;return}function gf(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0;do if(d|0){a=c[(c[(c[b>>2]|0)+424>>2]|0)+((d+-1|0)*12|0)>>2]|0;f=c[a+(e<<3)>>2]|0;g=c[a+(e<<3)+4>>2]|0;if(!g){if((((c[f+332>>2]|0)>>>16)+-1|0)>>>0<2)h=0;else break;return h|0}a=g+4|0;c[a>>2]=(c[a>>2]|0)+1;a=(((c[f+332>>2]|0)>>>16)+-1|0)>>>0<2;f=g+4|0;i=c[f>>2]|0;c[f>>2]=i+-1;if(!i){Sa[c[(c[g>>2]|0)+8>>2]&127](g);ih(g);if(a)h=0;else break;return h|0}else{if(a)h=0;else break;return h|0}}while(0);do if(e|0){a=e+-1|0;g=c[(c[(c[b>>2]|0)+424>>2]|0)+(d*12|0)>>2]|0;i=c[g+(a<<3)>>2]|0;f=c[g+(a<<3)+4>>2]|0;if(!f){if((((c[i+332>>2]|0)>>>16)+-1|0)>>>0<2)h=0;else break;return h|0}a=f+4|0;c[a>>2]=(c[a>>2]|0)+1;a=(((c[i+332>>2]|0)>>>16)+-1|0)>>>0<2;i=f+4|0;g=c[i>>2]|0;c[i>>2]=g+-1;if(!g){Sa[c[(c[f>>2]|0)+8>>2]&127](f);ih(f);if(a)h=0;else break;return h|0}else{if(a)h=0;else break;return h|0}}while(0);a=c[b>>2]|0;if(((c[a+336>>2]|0)+-1|0)>>>0>d>>>0){f=c[(c[a+424>>2]|0)+((d+1|0)*12|0)>>2]|0;g=c[f+(e<<3)>>2]|0;i=c[f+(e<<3)+4>>2]|0;do if(!i){if((((c[g+332>>2]|0)>>>16)+-1|0)>>>0<2){h=0;return h|0}}else{f=i+4|0;c[f>>2]=(c[f>>2]|0)+1;f=(((c[g+332>>2]|0)>>>16)+-1|0)>>>0<2;j=i+4|0;k=c[j>>2]|0;c[j>>2]=k+-1;if(!k){Sa[c[(c[i>>2]|0)+8>>2]&127](i);ih(i);if(f)h=0;else break;return h|0}else{if(f)h=0;else break;return h|0}}while(0);l=c[b>>2]|0}else l=a;if(((c[l+332>>2]|0)+-1|0)>>>0<=e>>>0){h=1;return h|0}a=e+1|0;e=c[(c[l+424>>2]|0)+(d*12|0)>>2]|0;d=c[e+(a<<3)>>2]|0;l=c[e+(a<<3)+4>>2]|0;if(!l){h=(((c[d+332>>2]|0)>>>16)+-1|0)>>>0>1;return h|0}a=l+4|0;c[a>>2]=(c[a>>2]|0)+1;a=(((c[d+332>>2]|0)>>>16)+-1|0)>>>0>1;d=l+4|0;e=c[d>>2]|0;c[d>>2]=e+-1;if(e|0){h=a;return h|0}Sa[c[(c[l>>2]|0)+8>>2]&127](l);ih(l);h=a;return h|0}function hf(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0;a=(d|0)!=0;f=(e|0)!=0;do if(a&f){g=e+-1|0;h=c[(c[(c[b>>2]|0)+424>>2]|0)+((d+-1|0)*12|0)>>2]|0;i=c[h+(g<<3)>>2]|0;j=c[h+(g<<3)+4>>2]|0;if(!j){if((((c[i+332>>2]|0)>>>16)+-1|0)>>>0<2)k=0;else break;return k|0}g=j+4|0;c[g>>2]=(c[g>>2]|0)+1;g=(((c[i+332>>2]|0)>>>16)+-1|0)>>>0<2;i=j+4|0;h=c[i>>2]|0;c[i>>2]=h+-1;if(!h){Sa[c[(c[j>>2]|0)+8>>2]&127](j);ih(j);if(g)k=0;else break;return k|0}else{if(g)k=0;else break;return k|0}}while(0);do if(a?(g=c[b>>2]|0,((c[g+332>>2]|0)+-1|0)>>>0>e>>>0):0){j=e+1|0;h=c[(c[g+424>>2]|0)+((d+-1|0)*12|0)>>2]|0;g=c[h+(j<<3)>>2]|0;i=c[h+(j<<3)+4>>2]|0;if(!i){if((((c[g+332>>2]|0)>>>16)+-1|0)>>>0<2)k=0;else break;return k|0}j=i+4|0;c[j>>2]=(c[j>>2]|0)+1;j=(((c[g+332>>2]|0)>>>16)+-1|0)>>>0<2;g=i+4|0;h=c[g>>2]|0;c[g>>2]=h+-1;if(!h){Sa[c[(c[i>>2]|0)+8>>2]&127](i);ih(i);if(j)k=0;else break;return k|0}else{if(j)k=0;else break;return k|0}}while(0);a=c[b>>2]|0;j=(c[a+336>>2]|0)+-1|0;if(f&j>>>0>d>>>0){f=e+-1|0;i=c[(c[a+424>>2]|0)+((d+1|0)*12|0)>>2]|0;h=c[i+(f<<3)>>2]|0;g=c[i+(f<<3)+4>>2]|0;do if(!g){if((((c[h+332>>2]|0)>>>16)+-1|0)>>>0<2){k=0;return k|0}}else{f=g+4|0;c[f>>2]=(c[f>>2]|0)+1;f=(((c[h+332>>2]|0)>>>16)+-1|0)>>>0<2;i=g+4|0;l=c[i>>2]|0;c[i>>2]=l+-1;if(!l){Sa[c[(c[g>>2]|0)+8>>2]&127](g);ih(g);if(f)k=0;else break;return k|0}else{if(f)k=0;else break;return k|0}}while(0);g=c[b>>2]|0;m=(c[g+336>>2]|0)+-1|0;n=g}else{m=j;n=a}if(m>>>0<=d>>>0){k=1;return k|0}if(((c[n+332>>2]|0)+-1|0)>>>0<=e>>>0){k=1;return k|0}m=e+1|0;e=c[(c[n+424>>2]|0)+((d+1|0)*12|0)>>2]|0;d=c[e+(m<<3)>>2]|0;n=c[e+(m<<3)+4>>2]|0;if(!n){k=(((c[d+332>>2]|0)>>>16)+-1|0)>>>0>1;return k|0}m=n+4|0;c[m>>2]=(c[m>>2]|0)+1;m=(((c[d+332>>2]|0)>>>16)+-1|0)>>>0>1;d=n+4|0;e=c[d>>2]|0;c[d>>2]=e+-1;if(e|0){k=m;return k|0}Sa[c[(c[n>>2]|0)+8>>2]&127](n);ih(n);k=m;return k|0}function jf(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;a=c[d>>2]|0;e=(c[d+4>>2]|0)-a|0;f=e+1|0;if(!e){g=a;return g|0}if(!f){a=b+2496|0;e=c[a>>2]|0;h=((e+1|0)>>>0)%624|0;i=b+(e<<2)|0;j=c[b+(h<<2)>>2]|0;k=0-(j&1)&-1727483681^c[b+((((e+397|0)>>>0)%624|0)<<2)>>2]^(j&2147483646|c[i>>2]&-2147483648)>>>1;c[i>>2]=k;i=k>>>11^k;c[a>>2]=h;h=i<<7&-1658038656^i;i=h<<15&-272236544^h;g=i>>>18^i;return g|0}i=32-(w(f|0)|0)|0;h=i+(((-1>>>(33-i|0)&f|0)==0)<<31>>31)|0;i=(h>>>5)+((h&31|0)!=0&1)|0;a=i>>>0>h>>>0?0:-1>>>(32-((h>>>0)/(i>>>0)|0)|0);i=b+2496|0;h=c[i>>2]|0;do{k=h;h=((h+1|0)>>>0)%624|0;j=b+(k<<2)|0;e=c[b+(h<<2)>>2]|0;l=0-(e&1)&-1727483681^c[b+((((k+397|0)>>>0)%624|0)<<2)>>2]^(e&2147483646|c[j>>2]&-2147483648)>>>1;c[j>>2]=l;j=l>>>11^l;l=j<<7&-1658038656^j;j=l<<15&-272236544^l;m=(j>>>18^j)&a}while(m>>>0>=f>>>0);c[i>>2]=h;g=(c[d>>2]|0)+m|0;return g|0}function kf(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0;f=Ka;Ka=Ka+32|0;if((Ka|0)>=(La|0))A(32);g=f+16|0;h=f;switch(e|0){case 1:{switch(c[d>>2]|0){case 0:{gb(b,c[d+4>>2]|0,1);Ka=f;return}case 1:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=4;c[b>>2]=1937075312;a[b+4>>0]=0;Ka=f;return}case 2:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=5;a[b>>0]=a[11326]|0;a[b+1>>0]=a[11327]|0;a[b+2>>0]=a[11328]|0;a[b+3>>0]=a[11329]|0;a[b+4>>0]=a[11330]|0;a[b+5>>0]=0;Ka=f;return}case 3:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=5;a[b>>0]=a[11332]|0;a[b+1>>0]=a[11333]|0;a[b+2>>0]=a[11334]|0;a[b+3>>0]=a[11335]|0;a[b+4>>0]=a[11336]|0;a[b+5>>0]=0;Ka=f;return}case 4:{a[b+11>>0]=10;i=b;j=11338;k=i+10|0;do{a[i>>0]=a[j>>0]|0;i=i+1|0;j=j+1|0}while((i|0)<(k|0));a[b+10>>0]=0;Ka=f;return}default:{}}break}case 3:{switch(c[d>>2]|0){case 0:{gb(b,c[d+4>>2]|0,3);Ka=f;return}case 1:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=4;c[b>>2]=1937075312;a[b+4>>0]=0;Ka=f;return}case 2:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=5;a[b>>0]=a[11326]|0;a[b+1>>0]=a[11327]|0;a[b+2>>0]=a[11328]|0;a[b+3>>0]=a[11329]|0;a[b+4>>0]=a[11330]|0;a[b+5>>0]=0;Ka=f;return}case 3:{l=b+4|0;c[l>>2]=0;c[l+4>>2]=0;a[b+11>>0]=3;a[b>>0]=a[11349]|0;a[b+1>>0]=a[11350]|0;a[b+2>>0]=a[11351]|0;a[b+3>>0]=0;Ka=f;return}case 4:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;l=jh(16)|0;c[b>>2]=l;c[b+8>>2]=-2147483632;c[b+4>>2]=13;i=l;j=11353;k=i+13|0;do{a[i>>0]=a[j>>0]|0;i=i+1|0;j=j+1|0}while((i|0)<(k|0));a[l+13>>0]=0;Ka=f;return}default:{}}break}case 5:{switch(c[d>>2]|0){case 0:{gb(b,c[d+4>>2]|0,5);Ka=f;return}case 1:{l=b+4|0;c[l>>2]=0;c[l+4>>2]=0;a[b+11>>0]=3;a[b>>0]=a[11367]|0;a[b+1>>0]=a[11368]|0;a[b+2>>0]=a[11369]|0;a[b+3>>0]=0;Ka=f;return}case 2:{l=b+4|0;c[l>>2]=0;c[l+4>>2]=0;a[b+11>>0]=3;a[b>>0]=a[11371]|0;a[b+1>>0]=a[11372]|0;a[b+2>>0]=a[11373]|0;a[b+3>>0]=0;Ka=f;return}case 3:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=6;a[b>>0]=a[11375]|0;a[b+1>>0]=a[11376]|0;a[b+2>>0]=a[11377]|0;a[b+3>>0]=a[11378]|0;a[b+4>>0]=a[11379]|0;a[b+5>>0]=a[11380]|0;a[b+6>>0]=0;Ka=f;return}case 4:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=6;a[b>>0]=a[11382]|0;a[b+1>>0]=a[11383]|0;a[b+2>>0]=a[11384]|0;a[b+3>>0]=a[11385]|0;a[b+4>>0]=a[11386]|0;a[b+5>>0]=a[11387]|0;a[b+6>>0]=0;Ka=f;return}default:{}}break}case 2:{switch(c[d>>2]|0){case 0:{gb(b,c[d+4>>2]|0,2);Ka=f;return}case 1:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=4;c[b>>2]=1939981165;a[b+4>>0]=0;Ka=f;return}case 2:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=5;a[b>>0]=a[11389]|0;a[b+1>>0]=a[11390]|0;a[b+2>>0]=a[11391]|0;a[b+3>>0]=a[11392]|0;a[b+4>>0]=a[11393]|0;a[b+5>>0]=0;Ka=f;return}case 3:{l=b+4|0;c[l>>2]=0;c[l+4>>2]=0;a[b+11>>0]=3;a[b>>0]=a[11395]|0;a[b+1>>0]=a[11396]|0;a[b+2>>0]=a[11397]|0;a[b+3>>0]=0;Ka=f;return}case 4:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=8;l=b;c[l>>2]=1769367908;c[l+4>>2]=1868851556;a[b+8>>0]=0;Ka=f;return}default:{}}break}default:{l=c[d>>2]|0;if((e|0)==4)switch(l|0){case 0:{gb(b,c[d+4>>2]|0,4);Ka=f;return}case 1:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=8;e=b;c[e>>2]=-1143947312;c[e+4>>2]=-2116972847;a[b+8>>0]=0;Ka=f;return}case 2:{a[b+11>>0]=10;i=b;j=11399;k=i+10|0;do{a[i>>0]=a[j>>0]|0;i=i+1|0;j=j+1|0}while((i|0)<(k|0));a[b+10>>0]=0;Ka=f;return}case 3:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;e=jh(32)|0;c[b>>2]=e;c[b+8>>2]=-2147483616;c[b+4>>2]=21;i=e;j=11410;k=i+21|0;do{a[i>>0]=a[j>>0]|0;i=i+1|0;j=j+1|0}while((i|0)<(k|0));a[e+21>>0]=0;Ka=f;return}case 4:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;e=jh(32)|0;c[b>>2]=e;c[b+8>>2]=-2147483616;c[b+4>>2]=19;i=e;j=11432;k=i+19|0;do{a[i>>0]=a[j>>0]|0;i=i+1|0;j=j+1|0}while((i|0)<(k|0));a[e+19>>0]=0;Ka=f;return}default:{}}switch(l|0){case 0:{c[g>>2]=c[d+4>>2];Xg(h,7748,g)|0;c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;g=ig(h)|0;if(g>>>0>4294967279)rh(b);if(g>>>0<11){a[b+11>>0]=g;if(!g)m=b;else{n=b;o=39}}else{d=g+16&-16;l=jh(d)|0;c[b>>2]=l;c[b+8>>2]=d|-2147483648;c[b+4>>2]=g;n=l;o=39}if((o|0)==39){Mi(n|0,h|0,g|0)|0;m=n}a[m+g>>0]=0;Ka=f;return}case 1:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=1;a[b>>0]=43;a[b+1>>0]=0;Ka=f;return}case 2:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=1;a[b>>0]=45;a[b+1>>0]=0;Ka=f;return}case 3:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=1;a[b>>0]=42;a[b+1>>0]=0;Ka=f;return}case 4:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=1;a[b>>0]=47;a[b+1>>0]=0;Ka=f;return}default:{}}}}}function lf(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,h=0.0,i=0,j=0,k=0.0,l=0,m=0,n=0,o=0,p=0,q=0.0;a=Ka;Ka=Ka+16|0;if((Ka|0)>=(La|0))A(16);d=a;e=b+4|0;f=c[b>>2]|0;if((c[e>>2]|0)==(f|0)){h=0.0;g[d>>3]=h;Zg(11458,d)|0;Ka=a;return +h}i=1;j=0;k=0.0;l=f;while(1){f=l;m=c[f+(j<<3)>>2]|0;n=c[f+(j<<3)+4>>2]|0;f=(n|0)==0;if(!f){o=n+4|0;c[o>>2]=(c[o>>2]|0)+1}o=c[m+332>>2]|0;m=o&255;p=(o&65280|0)==0?m:0-m|0;m=i;i=o>>>16;a:do if(!i)switch((m&65535)<<16>>16){case 1:{q=k+ +(p|0);break a;break}case 2:{q=k-+(p|0);break a;break}case 3:{q=k*+(p|0);break a;break}case 4:{q=k/+(p|0);break a;break}default:{q=k;break a}}else q=k;while(0);if(!f?(p=n+4|0,m=c[p>>2]|0,c[p>>2]=m+-1,(m|0)==0):0){Sa[c[(c[n>>2]|0)+8>>2]&127](n);ih(n)}j=j+1|0;l=c[b>>2]|0;if(j>>>0>=(c[e>>2]|0)-l>>3>>>0){h=q;break}else k=q}g[d>>3]=h;Zg(11458,d)|0;Ka=a;return +h}function mf(a){a=a|0;hh(a);kh(a);return}function nf(a){a=a|0;var b=0;b=c[a+12>>2]|0;if(!b)return;c[b>>2]=5040;a=c[b+40>>2]|0;if(a|0){c[b+44>>2]=a;kh(a)}a=c[b+28>>2]|0;if(a|0){c[b+32>>2]=a;kh(a)}kh(b);return}function of(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==11738?a+12|0:0)|0}function pf(a){a=a|0;kh(a);return}function qf(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0;e=Ka;Ka=Ka+16|0;if((Ka|0)>=(La|0))A(16);d=e;b=a+40|0;f=((c[a+44>>2]|0)-(c[b>>2]|0)>>2)+-1|0;c[d>>2]=0;c[d+4>>2]=f;f=Fe(d,15644,d)|0;Ka=e;return c[(c[b>>2]|0)+(f<<2)>>2]|0}function rf(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0;f=Ka;Ka=Ka+32|0;if((Ka|0)>=(La|0))A(32);g=f;h=f+12|0;i=c[e>>2]|0;j=c[i+332>>2]|0;k=b+28|0;l=c[k>>2]|0;m=l+(j*20|0)+8|0;c[m>>2]=(c[m>>2]|0)+1;m=l+(j*20|0)+4|0;c[m>>2]=(c[m>>2]|0)+1;m=13072+(j<<5)|0;n=c[i+340>>2]|0;if((n|0)!=0?(o=Xh(n,2808,3016,0)|0,(o|0)!=0):0){n=c[i+344>>2]|0;if(!n){p=o;q=0;r=l;s=j}else{i=n+4|0;c[i>>2]=(c[i>>2]|0)+1;p=o;q=n;r=c[k>>2]|0;s=c[(c[e>>2]|0)+332>>2]|0}}else{p=0;q=0;r=l;s=j}j=c[d>>2]|0;c[j+(((c[j+((c[p+4>>2]|0)*48|0)+32>>2]|0)+1|0)*48|0)+36>>2]=-1;if(!(a[r+(s*20|0)+16>>0]|0)){s=b+4|0;zf(h,m,c[s>>2]|0);b=h+11|0;c[g>>2]=(a[b>>0]|0)<0?c[h>>2]|0:h;Zg(11625,g)|0;if((a[b>>0]|0)<0)kh(c[h>>2]|0);h=c[p+332>>2]|0;a[h+65>>0]=0;a[h+145>>0]=0;a[h+225>>0]=0;b=c[d>>2]|0;c[b+((c[h+4>>2]|0)*48|0)+40>>2]=0;h=c[p+324>>2]|0;r=c[h+4>>2]|0;c[b+(r*48|0)+40>>2]=1;l=(c[b+(r*48|0)+32>>2]|0)+1|0;switch(c[b+(l*48|0)+44>>2]|0){case 7:case 5:case 4:{t=b+(l*48|0)+36|0;u=12;break}case 9:case 8:{t=b+(l*48|0)+32|0;u=12;break}default:{}}if((u|0)==12)c[t>>2]=255;zf(g,m,c[s>>2]|0);Ve(h,d,g);if((a[g+11>>0]|0)<0)kh(c[g>>2]|0)}else{g=c[p+332>>2]|0;c[j+((c[g+4>>2]|0)*48|0)+40>>2]=1;yf(g,d,m);m=c[p+324>>2]|0;a[m+65>>0]=0;a[m+145>>0]=0;a[m+225>>0]=0;c[(c[d>>2]|0)+((c[m+4>>2]|0)*48|0)+40>>2]=0}m=(c[k>>2]|0)+((c[(c[e>>2]|0)+332>>2]|0)*20|0)+16|0;a[m>>0]=a[m>>0]^1;if(!q){Ka=f;return}m=q+4|0;e=c[m>>2]|0;c[m>>2]=e+-1;if(e|0){Ka=f;return}Sa[c[(c[q>>2]|0)+8>>2]&127](q);ih(q);Ka=f;return}function sf(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0;d=Ka;Ka=Ka+16|0;if((Ka|0)>=(La|0))A(16);e=d+8|0;f=d;g=(c[b>>2]|0)+332|0;b=a+28|0;h=(c[b>>2]|0)+((c[g>>2]|0)*20|0)+8|0;i=(c[h>>2]|0)+-1|0;c[h>>2]=i;if(i|0){Ka=d;return}i=a+40|0;h=c[i>>2]|0;j=a+44|0;k=c[j>>2]|0;l=h;a:do if((h|0)==(k|0)){m=h;n=6}else{o=c[g>>2]|0;p=h;while(1){if((c[p>>2]|0)==(o|0)){m=p;n=6;break a}p=p+4|0;if((p|0)==(k|0)){q=k;break}}}while(0);if((n|0)==6)if((m|0)!=(k|0)){n=m+4|0;if((n|0)==(k|0))q=m;else{h=n;n=m;while(1){m=c[h>>2]|0;if((m|0)==(c[g>>2]|0))r=n;else{c[n>>2]=m;r=n+4|0}h=h+4|0;if((h|0)==(k|0)){q=r;break}else n=r}}}else q=k;if((k|0)==(q|0))s=k;else{c[j>>2]=q;s=q}c[f>>2]=c[g>>2];c[f+4>>2]=s-l>>2;Zg(11678,f)|0;l=c[j>>2]|0;s=c[i>>2]|0;g=l-s>>2;if(g>>>0<3){q=a+48|0;a=l;l=s;while(1){s=a;c[f>>2]=0;k=c[b>>2]|0;r=0;n=-1;h=0;while(1){if((c[k+(r*20|0)+8>>2]|0)==0?(m=c[k+(r*20|0)+4>>2]|0,(n|0)==-1|m>>>0<n>>>0):0){c[f>>2]=r;t=m;u=r}else{t=n;u=h}r=r+1|0;if((r|0)==43)break;else{n=t;h=u}}if((c[q>>2]|0)==(s|0)){Bf(i,f);v=c[j>>2]|0;w=c[i>>2]|0}else{c[s>>2]=u;h=s+4|0;c[j>>2]=h;v=h;w=l}h=v-w>>2;if(h>>>0<3){a=v;l=w}else{x=h;break}}}else x=g;c[e>>2]=x;Zg(11706,e)|0;Ka=d;return}function tf(a,b,c,d,e){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;return}function uf(a,b,c,d,e){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;return}function vf(a,b,d){a=a|0;b=b|0;d=d|0;a=c[b>>2]|0;if((c[b+4>>2]|0)==(a|0))return 1;else return (c[(c[a>>2]|0)+332>>2]|0)==(c[(c[d>>2]|0)+332>>2]|0)|0;return 0}function wf(a,b){a=a|0;b=b|0;return (c[b+4>>2]|0)-(c[b>>2]|0)>>3>>>0>1|0}function xf(a){a=a|0;return}function yf(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0;e=c[b>>2]|0;b=(c[e+((c[a+4>>2]|0)*48|0)+32>>2]|0)+1|0;if((c[e+(b*48|0)+44>>2]|0)!=9)return;if(!(bc(15620,d)|0)){a=c[3903]|0;f=(a-(c[3902]|0)|0)/12|0;g=a;if((c[3904]|0)==(g|0))cc(15608,d);else{sh(g,d);c[3903]=(c[3903]|0)+12}c[(ac(15620,d)|0)>>2]=f}c[e+(b*48|0)+36>>2]=c[(ac(15620,d)|0)>>2];return}function zf(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0;f=Ka;Ka=Ka+16|0;if((Ka|0)>=(La|0))A(16);g=f;h=f+4|0;c[g>>2]=e;i=d+12|0;j=c[d+16>>2]|0;a:do if(j|0){d=j+-1|0;k=(d&j|0)==0;if(!k)if(j>>>0>e>>>0)l=e;else l=(e>>>0)%(j>>>0)|0;else l=d&e;m=c[i>>2]|0;n=c[m+(l<<2)>>2]|0;b:do if(n|0?(o=c[n>>2]|0,o|0):0){c:do if(k){p=o;while(1){q=c[p+4>>2]|0;r=(q|0)==(e|0);if(!(r|(q&d|0)==(l|0)))break b;if(r?(c[p+8>>2]|0)==(e|0):0)break c;p=c[p>>2]|0;if(!p)break b}}else{p=o;while(1){r=c[p+4>>2]|0;if((r|0)==(e|0)){if((c[p+8>>2]|0)==(e|0))break c}else{if(r>>>0<j>>>0)s=r;else s=(r>>>0)%(j>>>0)|0;if((s|0)!=(l|0))break b}p=c[p>>2]|0;if(!p)break b}}while(0);sh(b,Af(i,g)|0);Ka=f;return}while(0);if(!k)if(j>>>0>1)t=1;else t=(j|0)!=1&1;else t=d&1;n=c[m+(t<<2)>>2]|0;if(n|0?(o=c[n>>2]|0,o|0):0){d:do if(k){n=o;while(1){p=c[n+4>>2]|0;r=(p|0)==1;if(!(r|(p&d|0)==(t|0)))break a;if(r?(c[n+8>>2]|0)==1:0)break d;n=c[n>>2]|0;if(!n)break a}}else{n=o;while(1){r=c[n+4>>2]|0;if((r|0)==1){if((c[n+8>>2]|0)==1)break d}else{if(r>>>0<j>>>0)u=r;else u=(r>>>0)%(j>>>0)|0;if((u|0)!=(t|0))break a}n=c[n>>2]|0;if(!n)break a}}while(0);c[h>>2]=1;sh(b,Af(i,h)|0);Ka=f;return}}while(0);c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=9;h=b;i=11635;t=h+9|0;do{a[h>>0]=a[i>>0]|0;h=h+1|0;i=i+1|0}while((h|0)<(t|0));a[b+9>>0]=0;Ka=f;return}function Af(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;d=c[b>>2]|0;b=c[a+4>>2]|0;a:do if(b|0){e=b+-1|0;f=(e&b|0)==0;if(!f)if(d>>>0<b>>>0)g=d;else g=(d>>>0)%(b>>>0)|0;else g=e&d;h=c[(c[a>>2]|0)+(g<<2)>>2]|0;if(h|0?(i=c[h>>2]|0,i|0):0){if(f){f=i;while(1){h=c[f+4>>2]|0;j=(d|0)==(h|0);if(!(j|(h&e|0)==(g|0)))break a;if(j?(c[f+8>>2]|0)==(d|0):0){k=f;break}f=c[f>>2]|0;if(!f)break a}l=k+12|0;return l|0}f=i;while(1){e=c[f+4>>2]|0;if((d|0)==(e|0)){if((c[f+8>>2]|0)==(d|0)){k=f;break}}else{if(e>>>0<b>>>0)m=e;else m=(e>>>0)%(b>>>0)|0;if((m|0)!=(g|0))break a}f=c[f>>2]|0;if(!f)break a}l=k+12|0;return l|0}}while(0);l=fa(8)|0;ph(l,11645);c[l>>2]=5924;ja(l|0,3928,82);return 0}function Bf(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0;d=a+4|0;e=c[a>>2]|0;f=(c[d>>2]|0)-e|0;g=f>>2;h=g+1|0;if(h>>>0>1073741823)Hh(a);i=a+8|0;j=(c[i>>2]|0)-e|0;k=j>>1;l=j>>2>>>0<536870911?(k>>>0<h>>>0?h:k):1073741823;do if(l)if(l>>>0>1073741823){k=fa(8)|0;ph(k,7751);c[k>>2]=5904;ja(k|0,3912,82)}else{k=jh(l<<2)|0;m=k;n=k;break}else{m=0;n=0}while(0);k=m+(g<<2)|0;c[k>>2]=c[b>>2];if((f|0)>0)Mi(n|0,e|0,f|0)|0;c[a>>2]=m;c[d>>2]=k+4;c[i>>2]=m+(l<<2);if(!e)return;kh(e);return}function Cf(b,d){b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0;e=b+328|0;if((c[e>>2]|0)<=0)return;f=b+324|0;g=b+424|0;b=0;h=c[f>>2]|0;while(1){if((h|0)>0){i=0;do{j=c[(c[g>>2]|0)+(b*12|0)>>2]|0;k=c[j+(i<<3)>>2]|0;l=c[j+(i<<3)+4>>2]|0;j=(l|0)==0;if(!j){m=l+4|0;c[m>>2]=(c[m>>2]|0)+1}if((k|0?(a[k+65>>0]=0,a[k+145>>0]=0,a[k+225>>0]=0,c[(c[d>>2]|0)+((c[k+4>>2]|0)*48|0)+40>>2]=0,k=c[(c[g>>2]|0)+(b*12|0)>>2]|0,c[k+(i<<3)>>2]=0,m=k+(i<<3)+4|0,k=c[m>>2]|0,c[m>>2]=0,k|0):0)?(m=k+4|0,n=c[m>>2]|0,c[m>>2]=n+-1,(n|0)==0):0){Sa[c[(c[k>>2]|0)+8>>2]&127](k);ih(k)}if(!j?(j=l+4|0,k=c[j>>2]|0,c[j>>2]=k+-1,(k|0)==0):0){Sa[c[(c[l>>2]|0)+8>>2]&127](l);ih(l)}i=i+1|0;l=c[f>>2]|0}while((i|0)<(l|0));o=l}else o=h;b=b+1|0;if((b|0)>=(c[e>>2]|0))break;else h=o}return}function Df(a,b){a=a|0;b=b|0;return}function Ef(a){a=a|0;hh(a);kh(a);return}function Ff(a){a=a|0;var b=0;b=c[a+12>>2]|0;if(!b)return;If(b);kh(b);return}function Gf(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==11885?a+12|0:0)|0}function Hf(a){a=a|0;kh(a);return}function If(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0;c[a>>2]=4e3;b=a+76|0;d=c[b>>2]|0;if(d|0){e=a+80|0;f=c[e>>2]|0;if((f|0)==(d|0))g=d;else{h=f;do{f=c[h+-4>>2]|0;h=h+-8|0;if(f|0?(i=f+4|0,j=c[i>>2]|0,c[i>>2]=j+-1,(j|0)==0):0){Sa[c[(c[f>>2]|0)+8>>2]&127](f);ih(f)}}while((h|0)!=(d|0));g=c[b>>2]|0}c[e>>2]=d;kh(g)}g=c[a+72>>2]|0;if(g|0?(d=g+4|0,e=c[d>>2]|0,c[d>>2]=e+-1,(e|0)==0):0){Sa[c[(c[g>>2]|0)+8>>2]&127](g);ih(g)}g=c[a+64>>2]|0;if(g|0?(e=g+4|0,d=c[e>>2]|0,c[e>>2]=d+-1,(d|0)==0):0){Sa[c[(c[g>>2]|0)+8>>2]&127](g);ih(g)}g=c[a+56>>2]|0;if(g|0?(d=g+4|0,e=c[d>>2]|0,c[d>>2]=e+-1,(e|0)==0):0){Sa[c[(c[g>>2]|0)+8>>2]&127](g);ih(g)}g=c[a+48>>2]|0;if(g|0?(e=g+4|0,d=c[e>>2]|0,c[e>>2]=d+-1,(d|0)==0):0){Sa[c[(c[g>>2]|0)+8>>2]&127](g);ih(g)}g=c[a+40>>2]|0;if(g|0?(d=g+4|0,e=c[d>>2]|0,c[d>>2]=e+-1,(e|0)==0):0){Sa[c[(c[g>>2]|0)+8>>2]&127](g);ih(g)}c[a>>2]=4020;g=c[a+20>>2]|0;if(g|0?(e=g+4|0,d=c[e>>2]|0,c[e>>2]=d+-1,(d|0)==0):0){Sa[c[(c[g>>2]|0)+8>>2]&127](g);ih(g)}g=c[a+4>>2]|0;if(!g)return;c[a+8>>2]=g;kh(g);return}function Jf(a){a=a|0;kh(a);return}function Kf(a){a=a|0;var b=0,d=0;b=jh(28)|0;d=a+4|0;c[b>>2]=5108;a=b+4|0;c[a>>2]=c[d>>2];c[a+4>>2]=c[d+4>>2];c[a+8>>2]=c[d+8>>2];c[a+12>>2]=c[d+12>>2];c[a+16>>2]=c[d+16>>2];c[a+20>>2]=c[d+20>>2];return b|0}function Lf(a,b){a=a|0;b=b|0;var d=0;d=a+4|0;c[b>>2]=5108;a=b+4|0;c[a>>2]=c[d>>2];c[a+4>>2]=c[d+4>>2];c[a+8>>2]=c[d+8>>2];c[a+12>>2]=c[d+12>>2];c[a+16>>2]=c[d+16>>2];c[a+20>>2]=c[d+20>>2];return}function Mf(a){a=a|0;return}function Nf(a){a=a|0;kh(a);return}function Of(a){a=a|0;var b=0,d=0,e=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0;b=Ka;Ka=Ka+16|0;if((Ka|0)>=(La|0))A(16);d=b;e=S()|0;g=a+4|0;if((e|0)==(c[c[g>>2]>>2]|0)){h=a+8|0;i=c[h>>2]|0;Sf(i);Ka=b;return}c[d>>2]=e;Zg(12027,d)|0;c[c[g>>2]>>2]=e;switch(e|0){case 0:{e=c[a+8>>2]|0;g=c[a+12>>2]|0;j=c[g>>2]|0;k=c[g+4>>2]|0;g=(k|0)==0;if(!g){l=k+4|0;c[l>>2]=(c[l>>2]|0)+1;c[l>>2]=(c[l>>2]|0)+1}l=e+32|0;c[l>>2]=j;j=e+36|0;m=c[j>>2]|0;c[j>>2]=k;if(m|0?(j=m+4|0,n=c[j>>2]|0,c[j>>2]=n+-1,(n|0)==0):0){Sa[c[(c[m>>2]|0)+8>>2]&127](m);ih(m)}m=c[l>>2]|0;l=e+24|0;e=l;n=c[e+4>>2]|0;j=m+24|0;c[j>>2]=c[e>>2];c[j+4>>2]=n;n=c[m+16>>2]|0;if(n|0){j=c[(c[n>>2]|0)+8>>2]|0;f[d>>2]=0.0;f[d+4>>2]=0.0;Xa[j&15](n,m+4|0,d,l)}if(g){h=a+8|0;i=c[h>>2]|0;Sf(i);Ka=b;return}g=k+4|0;l=c[g>>2]|0;c[g>>2]=l+-1;if(l|0){h=a+8|0;i=c[h>>2]|0;Sf(i);Ka=b;return}Sa[c[(c[k>>2]|0)+8>>2]&127](k);ih(k);h=a+8|0;i=c[h>>2]|0;Sf(i);Ka=b;return}case 1:{k=c[a+8>>2]|0;l=c[a+16>>2]|0;g=c[l>>2]|0;m=c[l+4>>2]|0;l=(m|0)==0;if(!l){n=m+4|0;c[n>>2]=(c[n>>2]|0)+1;c[n>>2]=(c[n>>2]|0)+1}n=k+32|0;c[n>>2]=g;g=k+36|0;j=c[g>>2]|0;c[g>>2]=m;if(j|0?(g=j+4|0,e=c[g>>2]|0,c[g>>2]=e+-1,(e|0)==0):0){Sa[c[(c[j>>2]|0)+8>>2]&127](j);ih(j)}j=c[n>>2]|0;n=k+24|0;k=n;e=c[k+4>>2]|0;g=j+24|0;c[g>>2]=c[k>>2];c[g+4>>2]=e;e=c[j+16>>2]|0;if(e|0){g=c[(c[e>>2]|0)+8>>2]|0;f[d>>2]=0.0;f[d+4>>2]=0.0;Xa[g&15](e,j+4|0,d,n)}if(l){h=a+8|0;i=c[h>>2]|0;Sf(i);Ka=b;return}l=m+4|0;n=c[l>>2]|0;c[l>>2]=n+-1;if(n|0){h=a+8|0;i=c[h>>2]|0;Sf(i);Ka=b;return}Sa[c[(c[m>>2]|0)+8>>2]&127](m);ih(m);h=a+8|0;i=c[h>>2]|0;Sf(i);Ka=b;return}case 2:{m=c[a+8>>2]|0;n=c[a+20>>2]|0;l=c[n>>2]|0;j=c[n+4>>2]|0;n=(j|0)==0;if(!n){e=j+4|0;c[e>>2]=(c[e>>2]|0)+1;c[e>>2]=(c[e>>2]|0)+1}e=m+32|0;c[e>>2]=l;l=m+36|0;g=c[l>>2]|0;c[l>>2]=j;if(g|0?(l=g+4|0,k=c[l>>2]|0,c[l>>2]=k+-1,(k|0)==0):0){Sa[c[(c[g>>2]|0)+8>>2]&127](g);ih(g)}g=c[e>>2]|0;e=m+24|0;m=e;k=c[m+4>>2]|0;l=g+24|0;c[l>>2]=c[m>>2];c[l+4>>2]=k;k=c[g+16>>2]|0;if(k|0){l=c[(c[k>>2]|0)+8>>2]|0;f[d>>2]=0.0;f[d+4>>2]=0.0;Xa[l&15](k,g+4|0,d,e)}if(n){h=a+8|0;i=c[h>>2]|0;Sf(i);Ka=b;return}n=j+4|0;e=c[n>>2]|0;c[n>>2]=e+-1;if(e|0){h=a+8|0;i=c[h>>2]|0;Sf(i);Ka=b;return}Sa[c[(c[j>>2]|0)+8>>2]&127](j);ih(j);h=a+8|0;i=c[h>>2]|0;Sf(i);Ka=b;return}case 3:{j=c[a+8>>2]|0;e=c[a+24>>2]|0;n=c[e>>2]|0;g=c[e+4>>2]|0;e=(g|0)==0;if(!e){k=g+4|0;c[k>>2]=(c[k>>2]|0)+1;c[k>>2]=(c[k>>2]|0)+1}k=j+32|0;c[k>>2]=n;n=j+36|0;l=c[n>>2]|0;c[n>>2]=g;if(l|0?(n=l+4|0,m=c[n>>2]|0,c[n>>2]=m+-1,(m|0)==0):0){Sa[c[(c[l>>2]|0)+8>>2]&127](l);ih(l)}l=c[k>>2]|0;k=j+24|0;j=k;m=c[j+4>>2]|0;n=l+24|0;c[n>>2]=c[j>>2];c[n+4>>2]=m;m=c[l+16>>2]|0;if(m|0){n=c[(c[m>>2]|0)+8>>2]|0;f[d>>2]=0.0;f[d+4>>2]=0.0;Xa[n&15](m,l+4|0,d,k)}if(e){h=a+8|0;i=c[h>>2]|0;Sf(i);Ka=b;return}e=g+4|0;k=c[e>>2]|0;c[e>>2]=k+-1;if(k|0){h=a+8|0;i=c[h>>2]|0;Sf(i);Ka=b;return}Sa[c[(c[g>>2]|0)+8>>2]&127](g);ih(g);h=a+8|0;i=c[h>>2]|0;Sf(i);Ka=b;return}default:{h=a+8|0;i=c[h>>2]|0;Sf(i);Ka=b;return}}}function Pf(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==12135?a+4|0:0)|0}function Qf(a){a=a|0;return 3776}function Rf(a){a=a|0;return}function Sf(a){a=a|0;var b=0,d=0,e=0,h=0.0,i=0.0,j=0.0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0;b=Ka;Ka=Ka+16|0;if((Ka|0)>=(La|0))A(16);d=b;e=a+12|0;c[e>>2]=(c[e>>2]|0)+1;h=+ya();O();i=+Ea();j=+Da();k=a+24|0;l=a+28|0;if(i==+f[k>>2]?j==+f[l>>2]:0)m=a+32|0;else{g[d>>3]=i;g[d+8>>3]=j;Zg(12041,d)|0;f[k>>2]=i;f[l>>2]=j;l=a+32|0;n=c[l>>2]|0;o=k;p=c[o+4>>2]|0;q=n+24|0;c[q>>2]=c[o>>2];c[q+4>>2]=p;p=c[n+16>>2]|0;if(!p)m=l;else{q=c[(c[p>>2]|0)+8>>2]|0;f[d>>2]=0.0;f[d+4>>2]=0.0;Xa[q&15](p,n+4|0,d,k);m=l}}Tf(a);l=c[m>>2]|0;m=a+16|0;j=h-+g[m>>3];Ta[c[c[l>>2]>>2]&1](l,j,a);k=c[l+16>>2]|0;if(!k){r=c[e>>2]|0;Uf(a,h,r,0);g[m>>3]=h;Ka=b;return}Yf(k,l+4|0,j);r=c[e>>2]|0;Uf(a,h,r,0);g[m>>3]=h;Ka=b;return}function Tf(a){a=a|0;var b=0,e=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,B=0.0,C=0;b=Ka;Ka=Ka+96|0;if((Ka|0)>=(La|0))A(96);e=b+64|0;g=b+48|0;h=b;i=b+80|0;j=b+72|0;if(!(ca(h|0)|0)){Ka=b;return}k=h+16|0;l=a+32|0;m=h+20|0;n=h+24|0;o=i+4|0;p=h+28|0;q=h+32|0;r=j+4|0;s=h+17|0;t=h+20|0;u=i+4|0;v=i+4|0;w=h+8|0;a:while(1){switch(c[h>>2]|0){case 256:{x=4;break a;break}case 769:{y=c[k>>2]|0;z=(c[a>>2]|0)+(y>>>5<<2)|0;c[z>>2]=c[z>>2]&~(1<<(y&31));z=c[l>>2]|0;Ua[c[(c[z>>2]|0)+4>>2]&31](z,y);break}case 768:{y=c[k>>2]|0;z=(c[a>>2]|0)+(y>>>5<<2)|0;c[z>>2]=c[z>>2]|1<<(y&31);z=c[l>>2]|0;Ua[c[(c[z>>2]|0)+8>>2]&31](z,y);break}case 1024:{y=c[l>>2]|0;B=+(c[n>>2]|0);f[i>>2]=+(c[m>>2]|0);f[o>>2]=B;B=+(c[q>>2]|0);f[j>>2]=+(c[p>>2]|0);f[r>>2]=B;z=c[y+16>>2]|0;if(z|0)Vf(z,y+4|0,i,j)|0;break}case 1025:{y=d[s>>0]|0;z=c[t>>2]|0;C=c[n>>2]|0;c[g>>2]=d[k>>0];c[g+4>>2]=y;c[g+8>>2]=z;c[g+12>>2]=C;Zg(12069,g)|0;C=c[l>>2]|0;B=+(c[n>>2]|0);f[i>>2]=+(c[t>>2]|0);f[u>>2]=B;z=c[C+16>>2]|0;if(z|0)Wf(z,C+4|0,i)|0;break}case 1026:{C=c[l>>2]|0;B=+(c[n>>2]|0);f[i>>2]=+(c[t>>2]|0);f[v>>2]=B;z=c[C+16>>2]|0;if(z|0)Xf(z,C+4|0,i)|0;break}case 512:{C=d[w>>0]|0;c[e>>2]=512;c[e+4>>2]=C;Zg(12096,e)|0;break}default:{}}if(!(ca(h|0)|0)){x=18;break}}if((x|0)==4)di();else if((x|0)==18){Ka=b;return}}function Uf(b,d,e,g){b=b|0;d=+d;e=e|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,s=0.0,t=0.0,v=0,w=0,x=0,y=0,B=0,C=0;g=Ka;Ka=Ka+16|0;if((Ka|0)>=(La|0))A(16);e=g;h=c[b+32>>2]|0;b=h+4|0;c[e>>2]=0;i=e+4|0;c[i>>2]=0;j=e+8|0;c[j>>2]=0;k=h+8|0;h=(c[k>>2]|0)-(c[b>>2]|0)|0;l=(h|0)/48|0;if(h){if(l>>>0>89478485)Hh(e);m=jh(h)|0;c[i>>2]=m;c[e>>2]=m;c[j>>2]=m+(l*48|0);l=c[b>>2]|0;b=(c[k>>2]|0)-l|0;if((b|0)>0){Mi(m|0,l|0,b|0)|0;l=m+(((b>>>0)/48|0)*48|0)|0;c[i>>2]=l;if((l|0)==(m|0)){n=m;o=i}else{l=0;b=m;k=0;do{j=b+(k*48|0)|0;switch(c[b+(k*48|0)+44>>2]|0){case 1:{if(!(c[b+(k*48|0)+40>>2]|0)){p=c[b+(k*48|0)+36>>2]|0;q=0}else{p=k;q=l}break}case 2:{d=+f[b+(k*48|0)+16>>2];s=+f[b+(k*48|0)+20>>2];P(+(+f[j>>2]+d),+(+f[b+(k*48|0)+4>>2]+s),+d,+s,c[b+(k*48|0)+32>>2]|0);p=k;q=l;break}case 3:{s=+f[b+(k*48|0)+16>>2];d=+f[b+(k*48|0)+20>>2];Z(+(+f[j>>2]+s),+(+f[b+(k*48|0)+4>>2]+d),+s,+d,+(+f[b+(k*48|0)+24>>2]),c[b+(k*48|0)+32>>2]|0);p=k;q=l;break}case 4:{d=+r(+(+f[j>>2]))+0.0;s=+r(+(+f[b+(k*48|0)+4>>2]))+0.0;t=+u(+(+f[b+(k*48|0)+16>>2]))+0.0;W(+d,+s,+t,+(+u(+(+f[b+(k*48|0)+20>>2]))+0.0),+(+f[b+(k*48|0)+24>>2]),c[b+(k*48|0)+32>>2]|0,c[b+(k*48|0)+36>>2]|0);p=k;q=l;break}case 5:{t=+r(+(+f[j>>2]))+0.0;s=+r(+(+f[b+(k*48|0)+4>>2]))+0.0;d=+u(+(+f[b+(k*48|0)+16>>2]))+0.0;Q(+t,+s,+d,+(+u(+(+f[b+(k*48|0)+20>>2]))+0.0),c[b+(k*48|0)+36>>2]|0);p=k;q=l;break}case 6:{d=+r(+(+f[j>>2]))+0.0;s=+r(+(+f[b+(k*48|0)+4>>2]))+0.0;t=+u(+(+f[b+(k*48|0)+16>>2]))+0.0;_(+d,+s,+t,+(+u(+(+f[b+(k*48|0)+20>>2]))+0.0),+(+f[b+(k*48|0)+24>>2]),c[b+(k*48|0)+36>>2]|0);p=k;q=l;break}case 7:{X(+(+f[j>>2]),+(+f[b+(k*48|0)+4>>2]),+(+f[b+(k*48|0)+16>>2]),+(+f[b+(k*48|0)+20>>2]),+(+f[b+(k*48|0)+24>>2]),+(+f[b+(k*48|0)+28>>2]),c[b+(k*48|0)+32>>2]|0,c[b+(k*48|0)+36>>2]|0);p=k;q=l;break}case 8:{h=(c[3902]|0)+((c[b+(k*48|0)+36>>2]|0)*12|0)|0;if((a[h+11>>0]|0)<0)v=c[h>>2]|0;else v=h;t=+f[b+(k*48|0)+24>>2];R(v|0,+(+f[j>>2]),+(+f[b+(k*48|0)+4>>2]+t),+t,c[b+(k*48|0)+32>>2]|0);p=k;q=l;break}case 9:{h=(c[3902]|0)+((c[b+(k*48|0)+36>>2]|0)*12|0)|0;if((a[h+11>>0]|0)<0)w=c[h>>2]|0;else w=h;T(w|0,+(+f[j>>2]),+(+f[b+(k*48|0)+4>>2]),+(+f[b+(k*48|0)+16>>2]),+(+f[b+(k*48|0)+20>>2]),c[b+(k*48|0)+32>>2]|0);p=k;q=l;break}default:{p=k;q=l}}k=Ei(p|0,q|0,1,0)|0;l=z()|0;b=c[e>>2]|0}while((l|0)<0|((l|0)==0?k>>>0<(((c[i>>2]|0)-b|0)/48|0)>>>0:0));x=i;y=b;B=9}}else{C=m;B=5}}else{C=0;B=5}if((B|0)==5){x=i;y=C;B=9}if((B|0)==9)if(!y){Ka=g;return}else{n=y;o=x}c[o>>2]=n;kh(n);Ka=g;return}function Vf(b,d,e,g){b=b|0;d=d|0;e=e|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0.0,o=0,p=0,q=0,r=0;h=Ka;Ka=Ka+16|0;if((Ka|0)>=(La|0))A(16);i=h;j=b+4|0;k=c[j>>2]|0;l=c[d>>2]|0;if(!(c[l+(k*48|0)+40>>2]|0)){m=0;Ka=h;return m|0}if(a[b+65>>0]|0){n=+f[l+(k*48|0)+20>>2]+ +f[g+4>>2];f[i>>2]=+f[l+(k*48|0)+16>>2]+ +f[g>>2];f[i+4>>2]=n;o=c[b+88>>2]|0;if(!o){p=l;q=k}else{Ua[c[(c[o>>2]|0)+24>>2]&31](o,i);p=c[d>>2]|0;q=c[j>>2]|0}j=i;i=c[j+4>>2]|0;o=p+(q*48|0)+16|0;c[o>>2]=c[j>>2];c[o+4>>2]=i;Xa[c[(c[b>>2]|0)+8>>2]&15](b,d,b+44|0,b+36|0);m=1;Ka=h;return m|0}if(a[b+225>>0]|0?(i=c[b+272>>2]|0,i|0):0){Ua[c[(c[i>>2]|0)+24>>2]&31](i,e);m=1;Ka=h;return m|0}i=b+312|0;o=c[i>>2]|0;j=(c[b+316>>2]|0)-o|0;if((j|0)<=0){m=0;Ka=h;return m|0}b=(j>>>3)+-1|0;j=o;while(1){o=c[j+(b<<3)>>2]|0;q=c[j+(b<<3)+4>>2]|0;p=(q|0)==0;if(!p){k=q+4|0;c[k>>2]=(c[k>>2]|0)+1}k=Vf(o,d,e,g)|0;if(!p?(p=q+4|0,o=c[p>>2]|0,c[p>>2]=o+-1,(o|0)==0):0){Sa[c[(c[q>>2]|0)+8>>2]&127](q);ih(q)}if(k){m=1;r=19;break}k=b+-1|0;if((k|0)<=-1){m=0;r=19;break}b=k;j=c[i>>2]|0}if((r|0)==19){Ka=h;return m|0}return 0}function Wf(b,d,e){b=b|0;d=d|0;e=e|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0.0,t=0.0,u=0.0;g=Ka;Ka=Ka+16|0;if((Ka|0)>=(La|0))A(16);h=g;if(!(c[(c[d>>2]|0)+((c[b+4>>2]|0)*48|0)+40>>2]|0)){i=0;Ka=g;return i|0}j=b+312|0;k=c[j>>2]|0;l=(c[b+316>>2]|0)-k|0;a:do if((l|0)>0){m=(l>>>3)+-1|0;n=k;while(1){o=c[n+(m<<3)>>2]|0;p=c[n+(m<<3)+4>>2]|0;q=(p|0)==0;if(!q){r=p+4|0;c[r>>2]=(c[r>>2]|0)+1}r=Wf(o,d,e)|0;if(!q?(q=p+4|0,o=c[q>>2]|0,c[q>>2]=o+-1,(o|0)==0):0){Sa[c[(c[p>>2]|0)+8>>2]&127](p);ih(p)}if(r){i=1;break}r=m+-1|0;if((r|0)<=-1)break a;m=r;n=c[j>>2]|0}Ka=g;return i|0}while(0);if((((a[b+224>>0]|0?(s=+f[e>>2],t=+f[e+4>>2],u=+f[b+16>>2],u<=s):0)?u+ +f[b+24>>2]>=s:0)?(s=+f[b+20>>2],s<=t):0)?s+ +f[b+28>>2]>=t:0){$g(12175)|0;a[b+225>>0]=1;j=c[b+248>>2]|0;if(!j){i=1;Ka=g;return i|0}Ua[c[(c[j>>2]|0)+24>>2]&31](j,e);i=1;Ka=g;return i|0}if((((a[b+144>>0]|0?(t=+f[e>>2],s=+f[e+4>>2],u=+f[b+16>>2],u<=t):0)?u+ +f[b+24>>2]>=t:0)?(t=+f[b+20>>2],t<=s):0)?t+ +f[b+28>>2]>=s:0){a[b+145>>0]=1;j=c[b+168>>2]|0;if(!j){i=1;Ka=g;return i|0}Sa[c[(c[j>>2]|0)+24>>2]&127](j);i=1;Ka=g;return i|0}if(!(a[b+64>>0]|0)){i=0;Ka=g;return i|0}s=+f[e>>2];t=+f[e+4>>2];u=+f[b+16>>2];if(!(u<=s)){i=0;Ka=g;return i|0}if(!(u+ +f[b+24>>2]>=s)){i=0;Ka=g;return i|0}s=+f[b+20>>2];if(!(s<=t)){i=0;Ka=g;return i|0}if(!(s+ +f[b+28>>2]>=t)){i=0;Ka=g;return i|0}c[h>>2]=b;Zg(12116,h)|0;h=c[b+112>>2]|0;if(h|0)Sa[c[(c[h>>2]|0)+24>>2]&127](h);a[b+65>>0]=1;i=1;Ka=g;return i|0}function Xf(b,d,e){b=b|0;d=d|0;e=e|0;var g=0,h=0,i=0.0,j=0.0,k=0.0,l=0,m=0,n=0,o=0,p=0,q=0;if(!(c[(c[d>>2]|0)+((c[b+4>>2]|0)*48|0)+40>>2]|0)){g=0;return g|0}if(a[b+144>>0]|0?(h=b+145|0,a[h>>0]|0):0){a[h>>0]=0;h=c[b+192>>2]|0;if(h|0)Sa[c[(c[h>>2]|0)+24>>2]&127](h);h=c[b+216>>2]|0;if(!h){g=1;return g|0}i=+f[e>>2];j=+f[e+4>>2];k=+f[b+16>>2];if(!(k<=i)){g=1;return g|0}if(!(k+ +f[b+24>>2]>=i)){g=1;return g|0}i=+f[b+20>>2];if(!(i<=j)){g=1;return g|0}if(!(i+ +f[b+28>>2]>=j)){g=1;return g|0}Ua[c[(c[h>>2]|0)+24>>2]&31](h,e);g=1;return g|0}if(a[b+64>>0]|0?(h=b+65|0,a[h>>0]|0):0){l=c[b+136>>2]|0;if(l|0)Sa[c[(c[l>>2]|0)+24>>2]&127](l);a[h>>0]=0;g=1;return g|0}if(a[b+224>>0]|0?(h=b+225|0,a[h>>0]|0):0){l=c[b+296>>2]|0;if(l|0)Ua[c[(c[l>>2]|0)+24>>2]&31](l,e);a[h>>0]=0;g=1;return g|0}h=b+312|0;l=c[h>>2]|0;m=(c[b+316>>2]|0)-l|0;if((m|0)<=0){g=0;return g|0}b=(m>>>3)+-1|0;m=l;while(1){l=c[m+(b<<3)>>2]|0;n=c[m+(b<<3)+4>>2]|0;o=(n|0)==0;if(!o){p=n+4|0;c[p>>2]=(c[p>>2]|0)+1}p=Xf(l,d,e)|0;if(!o?(o=n+4|0,l=c[o>>2]|0,c[o>>2]=l+-1,(l|0)==0):0){Sa[c[(c[n>>2]|0)+8>>2]&127](n);ih(n)}if(p){g=1;q=32;break}p=b+-1|0;if((p|0)<=-1){g=0;q=32;break}b=p;m=c[h>>2]|0}if((q|0)==32)return g|0;return 0}function Yf(b,d,e){b=b|0;d=d|0;e=+e;var f=0,g=0,h=0,i=0,j=0;if(!(c[(c[d>>2]|0)+((c[b+4>>2]|0)*48|0)+40>>2]|0))return;f=b+304|0;g=c[f>>2]|0;do if(g|0?(a[g+5>>0]|0)==0:0){h=(a[g+4>>0]|0)==0;Va[c[c[g>>2]>>2]&3](g,d,e);if(h){Xa[c[(c[b>>2]|0)+8>>2]&15](b,d,b+44|0,b+36|0);break}h=c[f>>2]|0;a[h+5>>0]=1;i=c[h+24>>2]|0;if(i|0)Sa[c[(c[i>>2]|0)+24>>2]&127](i)}while(0);f=c[b+312>>2]|0;g=c[b+316>>2]|0;if((f|0)==(g|0))return;b=f;do{f=c[b>>2]|0;i=c[b+4>>2]|0;if(i){h=i+4|0;c[h>>2]=(c[h>>2]|0)+1;Yf(f,d,e);h=i+4|0;j=c[h>>2]|0;c[h>>2]=j+-1;if(!j){Sa[c[(c[i>>2]|0)+8>>2]&127](i);ih(i)}}else Yf(f,d,e);b=b+8|0}while((b|0)!=(g|0));return}function Zf(){var b=0,d=0,e=0,f=0,g=0,h=0;b=Ka;Ka=Ka+16|0;if((Ka|0)>=(La|0))A(16);d=b;c[3902]=0;c[3903]=0;c[3904]=0;c[3905]=0;c[3906]=0;c[3907]=0;c[3908]=0;c[3909]=1065353216;e=jh(16)|0;c[d>>2]=e;c[d+8>>2]=-2147483632;c[d+4>>2]=12;f=e;g=6173;h=f+12|0;do{a[f>>0]=a[g>>0]|0;f=f+1|0;g=g+1|0}while((f|0)<(h|0));a[e+12>>0]=0;lh(15640,d);if((a[d+11>>0]|0)<0)kh(c[d>>2]|0);d=mh(15640)|0;c[3911]=d;e=1;g=d;do{g=(v(g>>>30^g,1812433253)|0)+e|0;c[15644+(e<<2)>>2]=g;e=e+1|0}while((e|0)!=624);c[4535]=0;eb();c[3876]=0;Ka=b;return}function _f(a){a=a|0;var b=0,d=0;b=Ka;Ka=Ka+16|0;if((Ka|0)>=(La|0))A(16);d=b;c[d>>2]=dg(c[a+60>>2]|0)|0;a=bg(ua(6,d|0)|0)|0;Ka=b;return a|0}function $f(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0;e=Ka;Ka=Ka+48|0;if((Ka|0)>=(La|0))A(48);f=e+32|0;g=e+16|0;h=e;i=a+28|0;j=c[i>>2]|0;c[h>>2]=j;k=a+20|0;l=(c[k>>2]|0)-j|0;c[h+4>>2]=l;c[h+8>>2]=b;c[h+12>>2]=d;b=l+d|0;l=a+60|0;c[g>>2]=c[l>>2];c[g+4>>2]=h;c[g+8>>2]=2;j=bg(pa(146,g|0)|0)|0;a:do if((b|0)!=(j|0)){g=2;m=b;n=h;o=j;while(1){if((o|0)<0)break;m=m-o|0;p=c[n+4>>2]|0;q=o>>>0>p>>>0;r=q?n+8|0:n;s=g+(q<<31>>31)|0;t=o-(q?p:0)|0;c[r>>2]=(c[r>>2]|0)+t;p=r+4|0;c[p>>2]=(c[p>>2]|0)-t;c[f>>2]=c[l>>2];c[f+4>>2]=r;c[f+8>>2]=s;o=bg(pa(146,f|0)|0)|0;if((m|0)==(o|0)){u=3;break a}else{g=s;n=r}}c[a+16>>2]=0;c[i>>2]=0;c[k>>2]=0;c[a>>2]=c[a>>2]|32;if((g|0)==2)v=0;else v=d-(c[n+4>>2]|0)|0}else u=3;while(0);if((u|0)==3){u=c[a+44>>2]|0;c[a+16>>2]=u+(c[a+48>>2]|0);a=u;c[i>>2]=a;c[k>>2]=a;v=d}Ka=e;return v|0}function ag(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0;e=Ka;Ka=Ka+32|0;if((Ka|0)>=(La|0))A(32);f=e;g=e+20|0;c[f>>2]=c[a+60>>2];c[f+4>>2]=0;c[f+8>>2]=b;c[f+12>>2]=g;c[f+16>>2]=d;if((bg(oa(140,f|0)|0)|0)<0){c[g>>2]=-1;h=-1}else h=c[g>>2]|0;Ka=e;return h|0}function bg(a){a=a|0;var b=0;if(a>>>0>4294963200){c[(cg()|0)>>2]=0-a;b=-1}else b=a;return b|0}function cg(){return 18276}function dg(a){a=a|0;return a|0}function eg(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0;f=Ka;Ka=Ka+32|0;if((Ka|0)>=(La|0))A(32);g=f;c[b+36>>2]=5;if((c[b>>2]&64|0)==0?(c[g>>2]=c[b+60>>2],c[g+4>>2]=21523,c[g+8>>2]=f+16,ta(54,g|0)|0):0)a[b+75>>0]=-1;g=$f(b,d,e)|0;Ka=f;return g|0}function fg(a){a=a|0;return (a+-48|0)>>>0<10|0}function gg(){return 5404}function hg(b,c){b=b|0;c=c|0;var d=0,e=0,f=0,g=0;d=a[b>>0]|0;e=a[c>>0]|0;if(d<<24>>24==0?1:d<<24>>24!=e<<24>>24){f=e;g=d}else{d=c;c=b;do{c=c+1|0;d=d+1|0;b=a[c>>0]|0;e=a[d>>0]|0}while(!(b<<24>>24==0?1:b<<24>>24!=e<<24>>24));f=e;g=b}return (g&255)-(f&255)|0}function ig(b){b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0;d=b;a:do if(!(d&3)){e=b;f=5}else{g=b;h=d;while(1){if(!(a[g>>0]|0)){i=h;break a}j=g+1|0;h=j;if(!(h&3)){e=j;f=5;break}else g=j}}while(0);if((f|0)==5){f=e;while(1){k=c[f>>2]|0;if(!((k&-2139062144^-2139062144)&k+-16843009))f=f+4|0;else break}if(!((k&255)<<24>>24))l=f;else{k=f;while(1){f=k+1|0;if(!(a[f>>0]|0)){l=f;break}else k=f}}i=l}return i-d|0}function jg(a,b){a=a|0;b=b|0;var c=0;c=ig(a)|0;return ((kg(a,1,c,b)|0)!=(c|0))<<31>>31|0}function kg(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0;f=v(d,b)|0;g=(b|0)==0?0:d;if((c[e+76>>2]|0)>-1){d=(mg(e)|0)==0;h=pg(a,f,e)|0;if(d)i=h;else{lg(e);i=h}}else i=pg(a,f,e)|0;if((i|0)==(f|0))j=g;else j=(i>>>0)/(b>>>0)|0;return j|0}function lg(a){a=a|0;return}function mg(a){a=a|0;return 1}function ng(b,e){b=b|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0;f=Ka;Ka=Ka+16|0;if((Ka|0)>=(La|0))A(16);g=f;h=e&255;a[g>>0]=h;i=b+16|0;j=c[i>>2]|0;if(!j)if(!(og(b)|0)){k=c[i>>2]|0;l=4}else m=-1;else{k=j;l=4}do if((l|0)==4){j=b+20|0;i=c[j>>2]|0;if(i>>>0<k>>>0?(n=e&255,(n|0)!=(a[b+75>>0]|0)):0){c[j>>2]=i+1;a[i>>0]=h;m=n;break}if((Pa[c[b+36>>2]&15](b,g,1)|0)==1)m=d[g>>0]|0;else m=-1}while(0);Ka=f;return m|0}function og(b){b=b|0;var d=0,e=0,f=0;d=b+74|0;e=a[d>>0]|0;a[d>>0]=e+255|e;e=c[b>>2]|0;if(!(e&8)){c[b+8>>2]=0;c[b+4>>2]=0;d=c[b+44>>2]|0;c[b+28>>2]=d;c[b+20>>2]=d;c[b+16>>2]=d+(c[b+48>>2]|0);f=0}else{c[b>>2]=e|32;f=-1}return f|0}function pg(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0;f=e+16|0;g=c[f>>2]|0;if(!g)if(!(og(e)|0)){h=c[f>>2]|0;i=5}else j=0;else{h=g;i=5}a:do if((i|0)==5){g=e+20|0;f=c[g>>2]|0;k=f;if((h-f|0)>>>0<d>>>0){j=Pa[c[e+36>>2]&15](e,b,d)|0;break}b:do if((a[e+75>>0]|0)<0|(d|0)==0){l=0;m=b;n=d;o=k}else{f=d;while(1){p=f+-1|0;if((a[b+p>>0]|0)==10)break;if(!p){l=0;m=b;n=d;o=k;break b}else f=p}p=Pa[c[e+36>>2]&15](e,b,f)|0;if(p>>>0<f>>>0){j=p;break a}l=f;m=b+f|0;n=d-f|0;o=c[g>>2]|0}while(0);Mi(o|0,m|0,n|0)|0;c[g>>2]=(c[g>>2]|0)+n;j=l+n|0}while(0);return j|0}function qg(a,b){a=a|0;b=b|0;var d=0;if(!b)d=0;else d=rg(c[b>>2]|0,c[b+4>>2]|0,a)|0;return ((d|0)==0?a:d)|0}function rg(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0;f=(c[b>>2]|0)+1794895138|0;g=sg(c[b+8>>2]|0,f)|0;h=sg(c[b+12>>2]|0,f)|0;i=sg(c[b+16>>2]|0,f)|0;a:do if((g>>>0<d>>>2>>>0?(j=d-(g<<2)|0,h>>>0<j>>>0&i>>>0<j>>>0):0)?((i|h)&3|0)==0:0){j=h>>>2;k=i>>>2;l=0;m=g;while(1){n=m>>>1;o=l+n|0;p=o<<1;q=p+j|0;r=sg(c[b+(q<<2)>>2]|0,f)|0;s=sg(c[b+(q+1<<2)>>2]|0,f)|0;if(!(s>>>0<d>>>0&r>>>0<(d-s|0)>>>0)){t=0;break a}if(a[b+(s+r)>>0]|0){t=0;break a}r=hg(e,b+s|0)|0;if(!r)break;s=(r|0)<0;if((m|0)==1){t=0;break a}l=s?l:o;m=s?n:m-n|0}m=p+k|0;l=sg(c[b+(m<<2)>>2]|0,f)|0;j=sg(c[b+(m+1<<2)>>2]|0,f)|0;if(j>>>0<d>>>0&l>>>0<(d-j|0)>>>0)t=(a[b+(j+l)>>0]|0)==0?b+j|0:0;else t=0}else t=0;while(0);return t|0}function sg(a,b){a=a|0;b=b|0;var c=0;c=Li(a|0)|0;return ((b|0)==0?a:c)|0}function tg(){la(18280);return 18288}function ug(){va(18280);return}function vg(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0;do if(a){if((c[a+76>>2]|0)<=-1){b=wg(a)|0;break}d=(mg(a)|0)==0;e=wg(a)|0;if(d)b=e;else{lg(a);b=e}}else{if(!(c[1350]|0))f=0;else f=vg(c[1350]|0)|0;e=c[(tg()|0)>>2]|0;if(!e)g=f;else{d=e;e=f;while(1){if((c[d+76>>2]|0)>-1)h=mg(d)|0;else h=0;if((c[d+20>>2]|0)>>>0>(c[d+28>>2]|0)>>>0)i=wg(d)|0|e;else i=e;if(h|0)lg(d);d=c[d+56>>2]|0;if(!d){g=i;break}else e=i}}ug();b=g}while(0);return b|0}function wg(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0;b=a+20|0;d=a+28|0;if((c[b>>2]|0)>>>0>(c[d>>2]|0)>>>0?(Pa[c[a+36>>2]&15](a,0,0)|0,(c[b>>2]|0)==0):0)e=-1;else{f=a+4|0;g=c[f>>2]|0;h=a+8|0;i=c[h>>2]|0;if(g>>>0<i>>>0)Pa[c[a+40>>2]&15](a,g-i|0,1)|0;c[a+16>>2]=0;c[d>>2]=0;c[b>>2]=0;c[h>>2]=0;c[f>>2]=0;e=0}return e|0}function xg(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,w=0,x=0,y=0;f=d&255;g=(e|0)!=0;a:do if(g&(b&3|0)!=0){h=d&255;i=b;j=e;while(1){if((a[i>>0]|0)==h<<24>>24){k=i;l=j;m=6;break a}n=i+1|0;o=j+-1|0;p=(o|0)!=0;if(p&(n&3|0)!=0){i=n;j=o}else{q=n;r=o;s=p;m=5;break}}}else{q=b;r=e;s=g;m=5}while(0);if((m|0)==5)if(s){k=q;l=r;m=6}else m=16;b:do if((m|0)==6){r=d&255;if((a[k>>0]|0)==r<<24>>24)if(!l){m=16;break}else{t=k;break}q=v(f,16843009)|0;c:do if(l>>>0>3){s=k;g=l;while(1){e=c[s>>2]^q;if((e&-2139062144^-2139062144)&e+-16843009|0){u=g;w=s;break c}e=s+4|0;b=g+-4|0;if(b>>>0>3){s=e;g=b}else{x=e;y=b;m=11;break}}}else{x=k;y=l;m=11}while(0);if((m|0)==11)if(!y){m=16;break}else{u=y;w=x}q=w;g=u;while(1){if((a[q>>0]|0)==r<<24>>24){t=q;break b}g=g+-1|0;if(!g){m=16;break}else q=q+1|0}}while(0);if((m|0)==16)t=0;return t|0}function yg(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0;f=Ka;Ka=Ka+224|0;if((Ka|0)>=(La|0))A(224);g=f+208|0;h=f+160|0;i=f+80|0;j=f;k=h;l=k+40|0;do{c[k>>2]=0;k=k+4|0}while((k|0)<(l|0));c[g>>2]=c[e>>2];if((zg(0,d,g,i,h)|0)<0)m=-1;else{if((c[b+76>>2]|0)>-1)n=mg(b)|0;else n=0;e=c[b>>2]|0;k=e&32;if((a[b+74>>0]|0)<1)c[b>>2]=e&-33;e=b+48|0;if(!(c[e>>2]|0)){l=b+44|0;o=c[l>>2]|0;c[l>>2]=j;p=b+28|0;c[p>>2]=j;q=b+20|0;c[q>>2]=j;c[e>>2]=80;r=b+16|0;c[r>>2]=j+80;j=zg(b,d,g,i,h)|0;if(!o)s=j;else{Pa[c[b+36>>2]&15](b,0,0)|0;t=(c[q>>2]|0)==0?-1:j;c[l>>2]=o;c[e>>2]=0;c[r>>2]=0;c[p>>2]=0;c[q>>2]=0;s=t}}else s=zg(b,d,g,i,h)|0;h=c[b>>2]|0;c[b>>2]=h|k;if(n|0)lg(b);m=(h&32|0)==0?s:-1}Ka=f;return m|0}function zg(d,e,f,h,i){d=d|0;e=e|0;f=f|0;h=h|0;i=i|0;var j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ba=0,ca=0,da=0,ea=0,fa=0,ga=0,ha=0,ia=0,ja=0,ka=0,la=0,ma=0,na=0,oa=0,pa=0,qa=0,ra=0,sa=0,ta=0,ua=0,va=0,wa=0,xa=0,ya=0,za=0,Aa=0,Ba=0,Ca=0,Da=0;j=Ka;Ka=Ka+64|0;if((Ka|0)>=(La|0))A(64);k=j+56|0;l=j+40|0;m=j;n=j+48|0;o=j+60|0;c[k>>2]=e;e=(d|0)!=0;p=m+40|0;q=p;r=m+39|0;m=n+4|0;s=0;t=0;u=0;a:while(1){v=s;w=t;while(1){do if((w|0)>-1)if((v|0)>(2147483647-w|0)){c[(cg()|0)>>2]=75;x=-1;break}else{x=v+w|0;break}else x=w;while(0);y=c[k>>2]|0;B=a[y>>0]|0;if(!(B<<24>>24)){C=94;break a}D=B;B=y;b:while(1){switch(D<<24>>24){case 37:{C=10;break b;break}case 0:{E=B;break b;break}default:{}}F=B+1|0;c[k>>2]=F;D=a[F>>0]|0;B=F}c:do if((C|0)==10){C=0;D=B;F=B;while(1){if((a[F+1>>0]|0)!=37){E=D;break c}G=D+1|0;F=F+2|0;c[k>>2]=F;if((a[F>>0]|0)!=37){E=G;break}else D=G}}while(0);v=E-y|0;if(e)Ag(d,y,v);if(!v)break;else w=x}w=(fg(a[(c[k>>2]|0)+1>>0]|0)|0)==0;v=c[k>>2]|0;if(!w?(a[v+2>>0]|0)==36:0){H=(a[v+1>>0]|0)+-48|0;I=1;J=3}else{H=-1;I=u;J=1}w=v+J|0;c[k>>2]=w;v=a[w>>0]|0;B=(v<<24>>24)+-32|0;if(B>>>0>31|(1<<B&75913|0)==0){K=0;L=v;M=w}else{v=0;D=B;B=w;while(1){w=1<<D|v;F=B+1|0;c[k>>2]=F;G=a[F>>0]|0;D=(G<<24>>24)+-32|0;if(D>>>0>31|(1<<D&75913|0)==0){K=w;L=G;M=F;break}else{v=w;B=F}}}if(L<<24>>24==42){if((fg(a[M+1>>0]|0)|0)!=0?(B=c[k>>2]|0,(a[B+2>>0]|0)==36):0){v=B+1|0;c[i+((a[v>>0]|0)+-48<<2)>>2]=10;N=c[h+((a[v>>0]|0)+-48<<3)>>2]|0;O=1;P=B+3|0}else{if(I|0){Q=-1;break}if(e){B=(c[f>>2]|0)+(4-1)&~(4-1);v=c[B>>2]|0;c[f>>2]=B+4;R=v}else R=0;N=R;O=0;P=(c[k>>2]|0)+1|0}c[k>>2]=P;v=(N|0)<0;S=v?0-N|0:N;T=v?K|8192:K;U=O;V=P}else{v=Bg(k)|0;if((v|0)<0){Q=-1;break}S=v;T=K;U=I;V=c[k>>2]|0}do if((a[V>>0]|0)==46){v=V+1|0;if((a[v>>0]|0)!=42){c[k>>2]=v;v=Bg(k)|0;W=v;X=c[k>>2]|0;break}if(fg(a[V+2>>0]|0)|0?(v=c[k>>2]|0,(a[v+3>>0]|0)==36):0){B=v+2|0;c[i+((a[B>>0]|0)+-48<<2)>>2]=10;D=c[h+((a[B>>0]|0)+-48<<3)>>2]|0;B=v+4|0;c[k>>2]=B;W=D;X=B;break}if(U|0){Q=-1;break a}if(e){B=(c[f>>2]|0)+(4-1)&~(4-1);D=c[B>>2]|0;c[f>>2]=B+4;Y=D}else Y=0;D=(c[k>>2]|0)+2|0;c[k>>2]=D;W=Y;X=D}else{W=-1;X=V}while(0);D=0;B=X;while(1){if(((a[B>>0]|0)+-65|0)>>>0>57){Q=-1;break a}v=B;B=B+1|0;c[k>>2]=B;Z=a[(a[v>>0]|0)+-65+(16+(D*58|0))>>0]|0;_=Z&255;if((_+-1|0)>>>0>=8)break;else D=_}if(!(Z<<24>>24)){Q=-1;break}v=(H|0)>-1;do if(Z<<24>>24==19)if(v){Q=-1;break a}else C=54;else{if(v){c[i+(H<<2)>>2]=_;F=h+(H<<3)|0;w=c[F+4>>2]|0;G=l;c[G>>2]=c[F>>2];c[G+4>>2]=w;C=54;break}if(!e){Q=0;break a}Cg(l,_,f);$=c[k>>2]|0;C=55}while(0);if((C|0)==54){C=0;if(e){$=B;C=55}else aa=0}d:do if((C|0)==55){C=0;v=a[$+-1>>0]|0;w=(D|0)!=0&(v&15|0)==3?v&-33:v;v=T&-65537;G=(T&8192|0)==0?T:v;e:do switch(w|0){case 110:{switch((D&255)<<24>>24){case 0:{c[c[l>>2]>>2]=x;aa=0;break d;break}case 1:{c[c[l>>2]>>2]=x;aa=0;break d;break}case 2:{F=c[l>>2]|0;c[F>>2]=x;c[F+4>>2]=((x|0)<0)<<31>>31;aa=0;break d;break}case 3:{b[c[l>>2]>>1]=x;aa=0;break d;break}case 4:{a[c[l>>2]>>0]=x;aa=0;break d;break}case 6:{c[c[l>>2]>>2]=x;aa=0;break d;break}case 7:{F=c[l>>2]|0;c[F>>2]=x;c[F+4>>2]=((x|0)<0)<<31>>31;aa=0;break d;break}default:{aa=0;break d}}break}case 112:{ba=120;ca=W>>>0>8?W:8;da=G|8;C=67;break}case 88:case 120:{ba=w;ca=W;da=G;C=67;break}case 111:{F=l;ea=c[F>>2]|0;fa=c[F+4>>2]|0;F=Eg(ea,fa,p)|0;ga=q-F|0;ha=F;ia=0;ja=12194;ka=(G&8|0)==0|(W|0)>(ga|0)?W:ga+1|0;la=G;ma=ea;na=fa;C=73;break}case 105:case 100:{fa=l;ea=c[fa>>2]|0;ga=c[fa+4>>2]|0;if((ga|0)<0){fa=Fi(0,0,ea|0,ga|0)|0;F=z()|0;oa=l;c[oa>>2]=fa;c[oa+4>>2]=F;pa=1;qa=12194;ra=fa;sa=F;C=72;break e}else{pa=(G&2049|0)!=0&1;qa=(G&2048|0)==0?((G&1|0)==0?12194:12196):12195;ra=ea;sa=ga;C=72;break e}break}case 117:{ga=l;pa=0;qa=12194;ra=c[ga>>2]|0;sa=c[ga+4>>2]|0;C=72;break}case 99:{a[r>>0]=c[l>>2];ta=r;ua=0;va=12194;wa=1;xa=v;ya=q;break}case 109:{za=Gg(c[(cg()|0)>>2]|0)|0;C=77;break}case 115:{ga=c[l>>2]|0;za=(ga|0)==0?12204:ga;C=77;break}case 67:{c[n>>2]=c[l>>2];c[m>>2]=0;c[l>>2]=n;Aa=-1;C=81;break}case 83:{if(!W){Hg(d,32,S,0,G);Ba=0;C=91}else{Aa=W;C=81}break}case 65:case 71:case 70:case 69:case 97:case 103:case 102:case 101:{aa=Jg(d,+g[l>>3],S,W,G,w)|0;break d;break}default:{ta=y;ua=0;va=12194;wa=W;xa=G;ya=q}}while(0);f:do if((C|0)==67){C=0;w=l;ga=c[w>>2]|0;ea=c[w+4>>2]|0;w=Dg(ga,ea,p,ba&32)|0;F=(da&8|0)==0|(ga|0)==0&(ea|0)==0;ha=w;ia=F?0:2;ja=F?12194:12194+(ba>>>4)|0;ka=ca;la=da;ma=ga;na=ea;C=73}else if((C|0)==72){C=0;ha=Fg(ra,sa,p)|0;ia=pa;ja=qa;ka=W;la=G;ma=ra;na=sa;C=73}else if((C|0)==77){C=0;ea=xg(za,0,W)|0;ga=(ea|0)==0;ta=za;ua=0;va=12194;wa=ga?W:ea-za|0;xa=v;ya=ga?za+W|0:ea}else if((C|0)==81){C=0;ea=c[l>>2]|0;ga=0;while(1){F=c[ea>>2]|0;if(!F){Ca=ga;break}w=Ig(o,F)|0;Da=(w|0)<0;if(Da|w>>>0>(Aa-ga|0)>>>0){C=85;break}F=w+ga|0;if(Aa>>>0>F>>>0){ea=ea+4|0;ga=F}else{Ca=F;break}}if((C|0)==85){C=0;if(Da){Q=-1;break a}else Ca=ga}Hg(d,32,S,Ca,G);if(!Ca){Ba=0;C=91}else{ea=c[l>>2]|0;F=0;while(1){w=c[ea>>2]|0;if(!w){Ba=Ca;C=91;break f}fa=Ig(o,w)|0;F=fa+F|0;if((F|0)>(Ca|0)){Ba=Ca;C=91;break f}Ag(d,o,fa);if(F>>>0>=Ca>>>0){Ba=Ca;C=91;break}else ea=ea+4|0}}}while(0);if((C|0)==73){C=0;v=(ma|0)!=0|(na|0)!=0;ea=(ka|0)!=0|v;F=q-ha+((v^1)&1)|0;ta=ea?ha:p;ua=ia;va=ja;wa=ea?((ka|0)>(F|0)?ka:F):0;xa=(ka|0)>-1?la&-65537:la;ya=q}else if((C|0)==91){C=0;Hg(d,32,S,Ba,G^8192);aa=(S|0)>(Ba|0)?S:Ba;break}F=ya-ta|0;ea=(wa|0)<(F|0)?F:wa;v=ea+ua|0;ga=(S|0)<(v|0)?v:S;Hg(d,32,ga,v,xa);Ag(d,va,ua);Hg(d,48,ga,v,xa^65536);Hg(d,48,ea,F,0);Ag(d,ta,F);Hg(d,32,ga,v,xa^8192);aa=ga}while(0);s=aa;t=x;u=U}g:do if((C|0)==94)if(!d)if(!u)Q=0;else{U=1;while(1){t=c[i+(U<<2)>>2]|0;if(!t)break;Cg(h+(U<<3)|0,t,f);t=U+1|0;if(t>>>0<10)U=t;else{Q=1;break g}}t=U;while(1){if(c[i+(t<<2)>>2]|0){Q=-1;break g}t=t+1|0;if(t>>>0>=10){Q=1;break}}}else Q=x;while(0);Ka=j;return Q|0}function Ag(a,b,d){a=a|0;b=b|0;d=d|0;if(!(c[a>>2]&32))pg(b,d,a)|0;return}function Bg(b){b=b|0;var d=0,e=0,f=0,g=0,h=0;if(!(fg(a[c[b>>2]>>0]|0)|0))d=0;else{e=0;while(1){f=c[b>>2]|0;g=(e*10|0)+-48+(a[f>>0]|0)|0;h=f+1|0;c[b>>2]=h;if(!(fg(a[h>>0]|0)|0)){d=g;break}else e=g}}return d|0}function Cg(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,h=0,i=0,j=0.0;a:do if(b>>>0<=20)do switch(b|0){case 9:{e=(c[d>>2]|0)+(4-1)&~(4-1);f=c[e>>2]|0;c[d>>2]=e+4;c[a>>2]=f;break a;break}case 10:{f=(c[d>>2]|0)+(4-1)&~(4-1);e=c[f>>2]|0;c[d>>2]=f+4;f=a;c[f>>2]=e;c[f+4>>2]=((e|0)<0)<<31>>31;break a;break}case 11:{e=(c[d>>2]|0)+(4-1)&~(4-1);f=c[e>>2]|0;c[d>>2]=e+4;e=a;c[e>>2]=f;c[e+4>>2]=0;break a;break}case 12:{e=(c[d>>2]|0)+(8-1)&~(8-1);f=e;h=c[f>>2]|0;i=c[f+4>>2]|0;c[d>>2]=e+8;e=a;c[e>>2]=h;c[e+4>>2]=i;break a;break}case 13:{i=(c[d>>2]|0)+(4-1)&~(4-1);e=c[i>>2]|0;c[d>>2]=i+4;i=(e&65535)<<16>>16;e=a;c[e>>2]=i;c[e+4>>2]=((i|0)<0)<<31>>31;break a;break}case 14:{i=(c[d>>2]|0)+(4-1)&~(4-1);e=c[i>>2]|0;c[d>>2]=i+4;i=a;c[i>>2]=e&65535;c[i+4>>2]=0;break a;break}case 15:{i=(c[d>>2]|0)+(4-1)&~(4-1);e=c[i>>2]|0;c[d>>2]=i+4;i=(e&255)<<24>>24;e=a;c[e>>2]=i;c[e+4>>2]=((i|0)<0)<<31>>31;break a;break}case 16:{i=(c[d>>2]|0)+(4-1)&~(4-1);e=c[i>>2]|0;c[d>>2]=i+4;i=a;c[i>>2]=e&255;c[i+4>>2]=0;break a;break}case 17:{i=(c[d>>2]|0)+(8-1)&~(8-1);j=+g[i>>3];c[d>>2]=i+8;g[a>>3]=j;break a;break}case 18:{i=(c[d>>2]|0)+(8-1)&~(8-1);j=+g[i>>3];c[d>>2]=i+8;g[a>>3]=j;break a;break}default:break a}while(0);while(0);return}function Dg(b,c,e,f){b=b|0;c=c|0;e=e|0;f=f|0;var g=0,h=0;if((b|0)==0&(c|0)==0)g=e;else{h=e;e=c;c=b;while(1){b=h+-1|0;a[b>>0]=d[480+(c&15)>>0]|0|f;c=Ji(c|0,e|0,4)|0;e=z()|0;if((c|0)==0&(e|0)==0){g=b;break}else h=b}}return g|0}function Eg(b,c,d){b=b|0;c=c|0;d=d|0;var e=0,f=0;if((b|0)==0&(c|0)==0)e=d;else{f=d;d=c;c=b;while(1){b=f+-1|0;a[b>>0]=c&7|48;c=Ji(c|0,d|0,3)|0;d=z()|0;if((c|0)==0&(d|0)==0){e=b;break}else f=b}}return e|0}function Fg(b,c,d){b=b|0;c=c|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;if(c>>>0>0|(c|0)==0&b>>>0>4294967295){e=d;f=b;g=c;do{c=f;f=Ii(f|0,g|0,10,0)|0;h=g;g=z()|0;i=Di(f|0,g|0,10,0)|0;j=Fi(c|0,h|0,i|0,z()|0)|0;z()|0;e=e+-1|0;a[e>>0]=j&255|48}while(h>>>0>9|(h|0)==9&c>>>0>4294967295);k=f;l=e}else{k=b;l=d}if(!k)m=l;else{d=k;k=l;while(1){l=d;d=(d>>>0)/10|0;b=k+-1|0;a[b>>0]=l-(d*10|0)|48;if(l>>>0<10){m=b;break}else k=b}}return m|0}function Gg(a){a=a|0;return Qg(a,c[(Pg()|0)+188>>2]|0)|0}function Hg(a,b,c,d,e){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;var f=0,g=0,h=0;f=Ka;Ka=Ka+256|0;if((Ka|0)>=(La|0))A(256);g=f;if((c|0)>(d|0)&(e&73728|0)==0){e=c-d|0;Oi(g|0,b<<24>>24|0,(e>>>0<256?e:256)|0)|0;if(e>>>0>255){b=c-d|0;d=e;do{Ag(a,g,256);d=d+-256|0}while(d>>>0>255);h=b&255}else h=e;Ag(a,g,h)}Ka=f;return}function Ig(a,b){a=a|0;b=b|0;var c=0;if(!a)c=0;else c=Ng(a,b,0)|0;return c|0}function Jg(b,e,f,g,h,i){b=b|0;e=+e;f=f|0;g=g|0;h=h|0;i=i|0;var j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0.0,t=0,u=0.0,w=0,x=0,y=0,B=0,C=0,D=0,E=0,F=0,G=0.0,H=0,I=0,J=0,K=0.0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0.0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ba=0,ca=0,da=0,ea=0,fa=0,ga=0,ha=0,ia=0.0,ja=0.0,ka=0,la=0,ma=0,na=0,oa=0,pa=0,qa=0,ra=0,sa=0,ta=0,ua=0,va=0,wa=0,xa=0,ya=0,za=0,Aa=0,Ba=0,Ca=0,Da=0,Ea=0,Fa=0,Ga=0,Ha=0,Ia=0;j=Ka;Ka=Ka+560|0;if((Ka|0)>=(La|0))A(560);k=j+32|0;l=j+536|0;m=j;n=m;o=j+540|0;c[l>>2]=0;p=o+12|0;q=Kg(e)|0;r=z()|0;if((r|0)<0){s=-e;t=Kg(s)|0;u=s;w=1;x=12211;y=z()|0;B=t}else{u=e;w=(h&2049|0)!=0&1;x=(h&2048|0)==0?((h&1|0)==0?12212:12217):12214;y=r;B=q}do if(0==0&(y&2146435072|0)==2146435072){q=(i&32|0)!=0;B=w+3|0;Hg(b,32,f,B,h&-65537);Ag(b,x,w);Ag(b,u!=u|0.0!=0.0?(q?12238:12242):q?12230:12234,3);Hg(b,32,f,B,h^8192);C=B}else{e=+Lg(u,l)*2.0;B=e!=0.0;if(B)c[l>>2]=(c[l>>2]|0)+-1;q=i|32;if((q|0)==97){r=i&32;t=(r|0)==0?x:x+9|0;D=w|2;E=12-g|0;do if(!(g>>>0>11|(E|0)==0)){s=8.0;F=E;do{F=F+-1|0;s=s*16.0}while((F|0)!=0);if((a[t>>0]|0)==45){G=-(s+(-e-s));break}else{G=e+s-s;break}}else G=e;while(0);E=c[l>>2]|0;F=(E|0)<0?0-E|0:E;H=Fg(F,((F|0)<0)<<31>>31,p)|0;if((H|0)==(p|0)){F=o+11|0;a[F>>0]=48;I=F}else I=H;a[I+-1>>0]=(E>>31&2)+43;E=I+-2|0;a[E>>0]=i+15;H=(g|0)<1;F=(h&8|0)==0;J=m;K=G;while(1){L=~~K;M=J+1|0;a[J>>0]=r|d[480+L>>0];K=(K-+(L|0))*16.0;if((M-n|0)==1?!(F&(H&K==0.0)):0){a[M>>0]=46;N=J+2|0}else N=M;if(!(K!=0.0))break;else J=N}J=N;if((g|0)!=0?(-2-n+J|0)<(g|0):0){H=p;F=E;O=g+2+H-F|0;P=H;Q=F}else{F=p;H=E;O=F-n-H+J|0;P=F;Q=H}H=O+D|0;Hg(b,32,f,H,h);Ag(b,t,D);Hg(b,48,f,H,h^65536);F=J-n|0;Ag(b,m,F);J=P-Q|0;Hg(b,48,O-(F+J)|0,0,0);Ag(b,E,J);Hg(b,32,f,H,h^8192);C=H;break}H=(g|0)<0?6:g;if(B){J=(c[l>>2]|0)+-28|0;c[l>>2]=J;R=e*268435456.0;S=J}else{R=e;S=c[l>>2]|0}J=(S|0)<0?k:k+288|0;F=J;K=R;do{r=~~K>>>0;c[F>>2]=r;F=F+4|0;K=(K-+(r>>>0))*1.0e9}while(K!=0.0);B=J;if((S|0)>0){E=J;D=F;t=S;while(1){r=(t|0)<29?t:29;M=D+-4|0;if(M>>>0>=E>>>0){L=M;M=0;do{T=Ki(c[L>>2]|0,0,r|0)|0;U=Ei(T|0,z()|0,M|0,0)|0;T=z()|0;M=Ii(U|0,T|0,1e9,0)|0;V=Di(M|0,z()|0,1e9,0)|0;W=Fi(U|0,T|0,V|0,z()|0)|0;z()|0;c[L>>2]=W;L=L+-4|0}while(L>>>0>=E>>>0);if(M){L=E+-4|0;c[L>>2]=M;X=L}else X=E}else X=E;a:do if(D>>>0>X>>>0){L=D;while(1){W=L+-4|0;if(c[W>>2]|0){Y=L;break a}if(W>>>0>X>>>0)L=W;else{Y=W;break}}}else Y=D;while(0);M=(c[l>>2]|0)-r|0;c[l>>2]=M;if((M|0)>0){E=X;D=Y;t=M}else{Z=X;_=Y;$=M;break}}}else{Z=J;_=F;$=S}if(($|0)<0){t=((H+25|0)/9|0)+1|0;D=(q|0)==102;E=Z;M=_;L=$;while(1){W=0-L|0;V=(W|0)<9?W:9;if(E>>>0<M>>>0){W=(1<<V)+-1|0;T=1e9>>>V;U=0;aa=E;do{ba=c[aa>>2]|0;c[aa>>2]=(ba>>>V)+U;U=v(ba&W,T)|0;aa=aa+4|0}while(aa>>>0<M>>>0);aa=(c[E>>2]|0)==0?E+4|0:E;if(!U){ca=M;da=aa}else{c[M>>2]=U;ca=M+4|0;da=aa}}else{ca=M;da=(c[E>>2]|0)==0?E+4|0:E}aa=D?J:da;T=(ca-aa>>2|0)>(t|0)?aa+(t<<2)|0:ca;L=(c[l>>2]|0)+V|0;c[l>>2]=L;if((L|0)>=0){ea=da;fa=T;break}else{E=da;M=T}}}else{ea=Z;fa=_}if(ea>>>0<fa>>>0){M=(B-ea>>2)*9|0;E=c[ea>>2]|0;if(E>>>0<10)ga=M;else{L=M;M=10;while(1){M=M*10|0;t=L+1|0;if(E>>>0<M>>>0){ga=t;break}else L=t}}}else ga=0;L=(q|0)==103;M=(H|0)!=0;E=H-((q|0)==102?0:ga)+((M&L)<<31>>31)|0;if((E|0)<(((fa-B>>2)*9|0)+-9|0)){t=E+9216|0;E=(t|0)/9|0;D=J+4+(E+-1024<<2)|0;F=t-(E*9|0)|0;if((F|0)<8){E=F;F=10;while(1){t=F*10|0;if((E|0)<7){E=E+1|0;F=t}else{ha=t;break}}}else ha=10;F=c[D>>2]|0;E=(F>>>0)/(ha>>>0)|0;q=F-(v(E,ha)|0)|0;t=(D+4|0)==(fa|0);if(!(t&(q|0)==0)){s=(E&1|0)==0?9007199254740992.0:9007199254740994.0;E=ha>>>1;K=q>>>0<E>>>0?.5:t&(q|0)==(E|0)?1.0:1.5;if(!w){ia=K;ja=s}else{E=(a[x>>0]|0)==45;ia=E?-K:K;ja=E?-s:s}E=F-q|0;c[D>>2]=E;if(ja+ia!=ja){q=E+ha|0;c[D>>2]=q;if(q>>>0>999999999){q=D;E=ea;while(1){F=q+-4|0;c[q>>2]=0;if(F>>>0<E>>>0){t=E+-4|0;c[t>>2]=0;ka=t}else ka=E;t=(c[F>>2]|0)+1|0;c[F>>2]=t;if(t>>>0>999999999){q=F;E=ka}else{la=F;ma=ka;break}}}else{la=D;ma=ea}E=(B-ma>>2)*9|0;q=c[ma>>2]|0;if(q>>>0<10){na=la;oa=E;pa=ma}else{F=E;E=10;while(1){E=E*10|0;t=F+1|0;if(q>>>0<E>>>0){na=la;oa=t;pa=ma;break}else F=t}}}else{na=D;oa=ga;pa=ea}}else{na=D;oa=ga;pa=ea}F=na+4|0;qa=oa;ra=fa>>>0>F>>>0?F:fa;sa=pa}else{qa=ga;ra=fa;sa=ea}F=0-qa|0;b:do if(ra>>>0>sa>>>0){E=ra;while(1){q=E+-4|0;if(c[q>>2]|0){ta=E;ua=1;break b}if(q>>>0>sa>>>0)E=q;else{ta=q;ua=0;break}}}else{ta=ra;ua=0}while(0);do if(L){D=H+((M^1)&1)|0;if((D|0)>(qa|0)&(qa|0)>-5){va=i+-1|0;wa=D+-1-qa|0}else{va=i+-2|0;wa=D+-1|0}if(!(h&8)){if(ua?(D=c[ta+-4>>2]|0,(D|0)!=0):0)if(!((D>>>0)%10|0)){E=0;V=10;while(1){V=V*10|0;U=E+1|0;if((D>>>0)%(V>>>0)|0|0){xa=U;break}else E=U}}else xa=0;else xa=9;E=((ta-B>>2)*9|0)+-9|0;if((va|32|0)==102){V=E-xa|0;D=(V|0)>0?V:0;ya=va;za=(wa|0)<(D|0)?wa:D;break}else{D=E+qa-xa|0;E=(D|0)>0?D:0;ya=va;za=(wa|0)<(E|0)?wa:E;break}}else{ya=va;za=wa}}else{ya=i;za=H}while(0);H=(za|0)!=0;B=H?1:h>>>3&1;M=(ya|32|0)==102;if(M){Aa=0;Ba=(qa|0)>0?qa:0}else{L=(qa|0)<0?F:qa;E=Fg(L,((L|0)<0)<<31>>31,p)|0;L=p;if((L-E|0)<2){D=E;while(1){V=D+-1|0;a[V>>0]=48;if((L-V|0)<2)D=V;else{Ca=V;break}}}else Ca=E;a[Ca+-1>>0]=(qa>>31&2)+43;D=Ca+-2|0;a[D>>0]=ya;Aa=D;Ba=L-D|0}D=w+1+za+B+Ba|0;Hg(b,32,f,D,h);Ag(b,x,w);Hg(b,48,f,D,h^65536);if(M){F=sa>>>0>J>>>0?J:sa;V=m+9|0;U=V;q=m+8|0;t=F;do{T=Fg(c[t>>2]|0,0,V)|0;if((t|0)==(F|0))if((T|0)==(V|0)){a[q>>0]=48;Da=q}else Da=T;else if(T>>>0>m>>>0){Oi(m|0,48,T-n|0)|0;aa=T;while(1){W=aa+-1|0;if(W>>>0>m>>>0)aa=W;else{Da=W;break}}}else Da=T;Ag(b,Da,U-Da|0);t=t+4|0}while(t>>>0<=J>>>0);if(!((h&8|0)==0&(H^1)))Ag(b,12246,1);if(t>>>0<ta>>>0&(za|0)>0){J=za;U=t;while(1){q=Fg(c[U>>2]|0,0,V)|0;if(q>>>0>m>>>0){Oi(m|0,48,q-n|0)|0;F=q;while(1){M=F+-1|0;if(M>>>0>m>>>0)F=M;else{Ea=M;break}}}else Ea=q;Ag(b,Ea,(J|0)<9?J:9);U=U+4|0;F=J+-9|0;if(!(U>>>0<ta>>>0&(J|0)>9)){Fa=F;break}else J=F}}else Fa=za;Hg(b,48,Fa+9|0,9,0)}else{J=ua?ta:sa+4|0;if(sa>>>0<J>>>0&(za|0)>-1){U=m+9|0;V=(h&8|0)==0;t=U;H=0-n|0;F=m+8|0;T=za;M=sa;while(1){B=Fg(c[M>>2]|0,0,U)|0;if((B|0)==(U|0)){a[F>>0]=48;Ga=F}else Ga=B;do if((M|0)==(sa|0)){B=Ga+1|0;Ag(b,Ga,1);if(V&(T|0)<1){Ha=B;break}Ag(b,12246,1);Ha=B}else{if(Ga>>>0<=m>>>0){Ha=Ga;break}Oi(m|0,48,Ga+H|0)|0;B=Ga;while(1){L=B+-1|0;if(L>>>0>m>>>0)B=L;else{Ha=L;break}}}while(0);q=t-Ha|0;Ag(b,Ha,(T|0)>(q|0)?q:T);B=T-q|0;M=M+4|0;if(!(M>>>0<J>>>0&(B|0)>-1)){Ia=B;break}else T=B}}else Ia=za;Hg(b,48,Ia+18|0,18,0);Ag(b,Aa,p-Aa|0)}Hg(b,32,f,D,h^8192);C=D}while(0);Ka=j;return ((C|0)<(f|0)?f:C)|0}function Kg(a){a=+a;var b=0;g[h>>3]=a;b=c[h>>2]|0;y(c[h+4>>2]|0);return b|0}function Lg(a,b){a=+a;b=b|0;return +(+Mg(a,b))}function Mg(a,b){a=+a;b=b|0;var d=0,e=0,f=0,i=0.0,j=0.0,k=0,l=0.0;g[h>>3]=a;d=c[h>>2]|0;e=c[h+4>>2]|0;f=Ji(d|0,e|0,52)|0;z()|0;switch(f&2047){case 0:{if(a!=0.0){i=+Mg(a*18446744073709551616.0,b);j=i;k=(c[b>>2]|0)+-64|0}else{j=a;k=0}c[b>>2]=k;l=j;break}case 2047:{l=a;break}default:{c[b>>2]=(f&2047)+-1022;c[h>>2]=d;c[h+4>>2]=e&-2146435073|1071644672;l=+g[h>>3]}}return +l}function Ng(b,d,e){b=b|0;d=d|0;e=e|0;var f=0;do if(b){if(d>>>0<128){a[b>>0]=d;f=1;break}if(!(c[c[(Og()|0)+188>>2]>>2]|0))if((d&-128|0)==57216){a[b>>0]=d;f=1;break}else{c[(cg()|0)>>2]=84;f=-1;break}if(d>>>0<2048){a[b>>0]=d>>>6|192;a[b+1>>0]=d&63|128;f=2;break}if(d>>>0<55296|(d&-8192|0)==57344){a[b>>0]=d>>>12|224;a[b+1>>0]=d>>>6&63|128;a[b+2>>0]=d&63|128;f=3;break}if((d+-65536|0)>>>0<1048576){a[b>>0]=d>>>18|240;a[b+1>>0]=d>>>12&63|128;a[b+2>>0]=d>>>6&63|128;a[b+3>>0]=d&63|128;f=4;break}else{c[(cg()|0)>>2]=84;f=-1;break}}else f=1;while(0);return f|0}function Og(){return gg()|0}function Pg(){return gg()|0}function Qg(b,e){b=b|0;e=e|0;var f=0,g=0,h=0,i=0,j=0;f=0;while(1){if((d[496+f>>0]|0)==(b|0)){g=4;break}h=f+1|0;if((h|0)==87){i=87;g=5;break}else f=h}if((g|0)==4)if(!f)j=592;else{i=f;g=5}if((g|0)==5){g=592;f=i;while(1){i=g;do{b=i;i=i+1|0}while((a[b>>0]|0)!=0);f=f+-1|0;if(!f){j=i;break}else g=i}}return Rg(j,c[e+20>>2]|0)|0}function Rg(a,b){a=a|0;b=b|0;return qg(a,b)|0}function Sg(b,c,d){b=b|0;c=c|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0;a:do if(!d)e=0;else{f=b;g=d;h=c;while(1){i=a[f>>0]|0;j=a[h>>0]|0;if(i<<24>>24!=j<<24>>24)break;g=g+-1|0;if(!g){e=0;break a}else{f=f+1|0;h=h+1|0}}e=(i&255)-(j&255)|0}while(0);return e|0}function Tg(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0;e=Ka;Ka=Ka+48|0;if((Ka|0)>=(La|0))A(48);f=e+32|0;g=e+16|0;h=e;if(!(b&4194368))i=0;else{c[h>>2]=d;d=(c[h>>2]|0)+(4-1)&~(4-1);j=c[d>>2]|0;c[h>>2]=d+4;i=j}c[g>>2]=a;c[g+4>>2]=b|32768;c[g+8>>2]=i;i=sa(5,g|0)|0;if(!((b&524288|0)==0|(i|0)<0)){c[f>>2]=i;c[f+4>>2]=2;c[f+8>>2]=1;qa(221,f|0)|0}f=bg(i)|0;Ka=e;return f|0}function Ug(b,d,e,f){b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0;g=Ka;Ka=Ka+128|0;if((Ka|0)>=(La|0))A(128);h=g+124|0;i=g;j=i;k=5648;l=j+124|0;do{c[j>>2]=c[k>>2];j=j+4|0;k=k+4|0}while((j|0)<(l|0));if((d+-1|0)>>>0>2147483646)if(!d){m=h;n=1;o=4}else{c[(cg()|0)>>2]=75;p=-1}else{m=b;n=d;o=4}if((o|0)==4){o=-2-m|0;d=n>>>0>o>>>0?o:n;c[i+48>>2]=d;n=i+20|0;c[n>>2]=m;c[i+44>>2]=m;o=m+d|0;m=i+16|0;c[m>>2]=o;c[i+28>>2]=o;o=yg(i,e,f)|0;if(!d)p=o;else{d=c[n>>2]|0;a[d+(((d|0)==(c[m>>2]|0))<<31>>31)>>0]=0;p=o}}Ka=g;return p|0}function Vg(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0;e=a+20|0;f=c[e>>2]|0;g=(c[a+16>>2]|0)-f|0;a=g>>>0>d>>>0?d:g;Mi(f|0,b|0,a|0)|0;c[e>>2]=(c[e>>2]|0)+a;return d|0}function Wg(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0;e=Ka;Ka=Ka+16|0;if((Ka|0)>=(La|0))A(16);f=e;c[f>>2]=a;c[f+4>>2]=b;c[f+8>>2]=d;d=bg(ra(3,f|0)|0)|0;Ka=e;return d|0}function Xg(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0;e=Ka;Ka=Ka+16|0;if((Ka|0)>=(La|0))A(16);f=e;c[f>>2]=d;d=Yg(a,b,f)|0;Ka=e;return d|0}function Yg(a,b,c){a=a|0;b=b|0;c=c|0;return Ug(a,2147483647,b,c)|0}function Zg(a,b){a=a|0;b=b|0;var d=0,e=0;d=Ka;Ka=Ka+16|0;if((Ka|0)>=(La|0))A(16);e=d;c[e>>2]=b;b=yg(c[1318]|0,a,e)|0;Ka=d;return b|0}function _g(b,d){b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0;if((c[d+76>>2]|0)>=0?(mg(d)|0)!=0:0){e=b&255;f=b&255;if((f|0)!=(a[d+75>>0]|0)?(g=d+20|0,h=c[g>>2]|0,h>>>0<(c[d+16>>2]|0)>>>0):0){c[g>>2]=h+1;a[h>>0]=e;i=f}else i=ng(d,b)|0;lg(d);j=i}else k=3;do if((k|0)==3){i=b&255;f=b&255;if((f|0)!=(a[d+75>>0]|0)?(e=d+20|0,h=c[e>>2]|0,h>>>0<(c[d+16>>2]|0)>>>0):0){c[e>>2]=h+1;a[h>>0]=i;j=f;break}j=ng(d,b)|0}while(0);return j|0}function $g(b){b=b|0;var d=0,e=0,f=0,g=0,h=0;d=c[1318]|0;if((c[d+76>>2]|0)>-1)e=mg(d)|0;else e=0;do if((jg(b,d)|0)<0)f=-1;else{if((a[d+75>>0]|0)!=10?(g=d+20|0,h=c[g>>2]|0,h>>>0<(c[d+16>>2]|0)>>>0):0){c[g>>2]=h+1;a[h>>0]=10;f=0;break}f=(ng(d,10)|0)>>31}while(0);if(e|0)lg(d);return f|0}function ah(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ba=0,ca=0,da=0,ea=0,fa=0,ga=0,ha=0,ia=0,ja=0,ka=0,la=0,ma=0,na=0,oa=0,pa=0,qa=0,ra=0,sa=0,ta=0,ua=0,va=0,wa=0,xa=0,ya=0,za=0,Aa=0,Ba=0,Ca=0,Da=0,Ea=0,Fa=0,Ga=0,Ha=0,Ia=0,Ja=0;b=Ka;Ka=Ka+16|0;if((Ka|0)>=(La|0))A(16);d=b;do if(a>>>0<245){e=a>>>0<11?16:a+11&-8;f=e>>>3;g=c[4573]|0;h=g>>>f;if(h&3|0){i=(h&1^1)+f|0;j=18332+(i<<1<<2)|0;k=j+8|0;l=c[k>>2]|0;m=l+8|0;n=c[m>>2]|0;if((n|0)==(j|0))c[4573]=g&~(1<<i);else{c[n+12>>2]=j;c[k>>2]=n}n=i<<3;c[l+4>>2]=n|3;i=l+n+4|0;c[i>>2]=c[i>>2]|1;o=m;Ka=b;return o|0}m=c[4575]|0;if(e>>>0>m>>>0){if(h|0){i=2<<f;n=h<<f&(i|0-i);i=(n&0-n)+-1|0;n=i>>>12&16;f=i>>>n;i=f>>>5&8;h=f>>>i;f=h>>>2&4;l=h>>>f;h=l>>>1&2;k=l>>>h;l=k>>>1&1;j=(i|n|f|h|l)+(k>>>l)|0;l=18332+(j<<1<<2)|0;k=l+8|0;h=c[k>>2]|0;f=h+8|0;n=c[f>>2]|0;if((n|0)==(l|0)){i=g&~(1<<j);c[4573]=i;p=i}else{c[n+12>>2]=l;c[k>>2]=n;p=g}n=j<<3;j=n-e|0;c[h+4>>2]=e|3;k=h+e|0;c[k+4>>2]=j|1;c[h+n>>2]=j;if(m|0){n=c[4578]|0;h=m>>>3;l=18332+(h<<1<<2)|0;i=1<<h;if(!(p&i)){c[4573]=p|i;q=l;r=l+8|0}else{i=l+8|0;q=c[i>>2]|0;r=i}c[r>>2]=n;c[q+12>>2]=n;c[n+8>>2]=q;c[n+12>>2]=l}c[4575]=j;c[4578]=k;o=f;Ka=b;return o|0}f=c[4574]|0;if(f){k=(f&0-f)+-1|0;j=k>>>12&16;l=k>>>j;k=l>>>5&8;n=l>>>k;l=n>>>2&4;i=n>>>l;n=i>>>1&2;h=i>>>n;i=h>>>1&1;s=c[18596+((k|j|l|n|i)+(h>>>i)<<2)>>2]|0;i=s;h=s;n=(c[s+4>>2]&-8)-e|0;while(1){s=c[i+16>>2]|0;if(!s){l=c[i+20>>2]|0;if(!l)break;else t=l}else t=s;s=(c[t+4>>2]&-8)-e|0;l=s>>>0<n>>>0;i=t;h=l?t:h;n=l?s:n}i=h+e|0;if(i>>>0>h>>>0){s=c[h+24>>2]|0;l=c[h+12>>2]|0;do if((l|0)==(h|0)){j=h+20|0;k=c[j>>2]|0;if(!k){u=h+16|0;v=c[u>>2]|0;if(!v){w=0;break}else{x=v;y=u}}else{x=k;y=j}j=x;k=y;while(1){u=j+20|0;v=c[u>>2]|0;if(!v){z=j+16|0;B=c[z>>2]|0;if(!B)break;else{C=B;D=z}}else{C=v;D=u}j=C;k=D}c[k>>2]=0;w=j}else{u=c[h+8>>2]|0;c[u+12>>2]=l;c[l+8>>2]=u;w=l}while(0);do if(s|0){l=c[h+28>>2]|0;u=18596+(l<<2)|0;if((h|0)==(c[u>>2]|0)){c[u>>2]=w;if(!w){c[4574]=f&~(1<<l);break}}else{l=s+16|0;c[((c[l>>2]|0)==(h|0)?l:s+20|0)>>2]=w;if(!w)break}c[w+24>>2]=s;l=c[h+16>>2]|0;if(l|0){c[w+16>>2]=l;c[l+24>>2]=w}l=c[h+20>>2]|0;if(l|0){c[w+20>>2]=l;c[l+24>>2]=w}}while(0);if(n>>>0<16){s=n+e|0;c[h+4>>2]=s|3;f=h+s+4|0;c[f>>2]=c[f>>2]|1}else{c[h+4>>2]=e|3;c[i+4>>2]=n|1;c[i+n>>2]=n;if(m|0){f=c[4578]|0;s=m>>>3;l=18332+(s<<1<<2)|0;u=1<<s;if(!(u&g)){c[4573]=u|g;E=l;F=l+8|0}else{u=l+8|0;E=c[u>>2]|0;F=u}c[F>>2]=f;c[E+12>>2]=f;c[f+8>>2]=E;c[f+12>>2]=l}c[4575]=n;c[4578]=i}o=h+8|0;Ka=b;return o|0}else G=e}else G=e}else G=e}else if(a>>>0<=4294967231){l=a+11|0;f=l&-8;u=c[4574]|0;if(u){s=0-f|0;v=l>>>8;if(v)if(f>>>0>16777215)H=31;else{l=(v+1048320|0)>>>16&8;z=v<<l;v=(z+520192|0)>>>16&4;B=z<<v;z=(B+245760|0)>>>16&2;I=14-(v|l|z)+(B<<z>>>15)|0;H=f>>>(I+7|0)&1|I<<1}else H=0;I=c[18596+(H<<2)>>2]|0;a:do if(!I){J=0;K=0;L=s;M=61}else{z=0;B=s;l=I;v=f<<((H|0)==31?0:25-(H>>>1)|0);N=0;while(1){O=(c[l+4>>2]&-8)-f|0;if(O>>>0<B>>>0)if(!O){P=l;Q=0;R=l;M=65;break a}else{S=l;T=O}else{S=z;T=B}O=c[l+20>>2]|0;l=c[l+16+(v>>>31<<2)>>2]|0;U=(O|0)==0|(O|0)==(l|0)?N:O;if(!l){J=U;K=S;L=T;M=61;break}else{z=S;B=T;v=v<<1;N=U}}}while(0);if((M|0)==61){if((J|0)==0&(K|0)==0){I=2<<H;s=(I|0-I)&u;if(!s){G=f;break}I=(s&0-s)+-1|0;s=I>>>12&16;e=I>>>s;I=e>>>5&8;h=e>>>I;e=h>>>2&4;i=h>>>e;h=i>>>1&2;n=i>>>h;i=n>>>1&1;V=0;W=c[18596+((I|s|e|h|i)+(n>>>i)<<2)>>2]|0}else{V=K;W=J}if(!W){X=V;Y=L}else{P=V;Q=L;R=W;M=65}}if((M|0)==65){i=P;n=Q;h=R;while(1){e=(c[h+4>>2]&-8)-f|0;s=e>>>0<n>>>0;I=s?e:n;e=s?h:i;s=c[h+16>>2]|0;if(!s)Z=c[h+20>>2]|0;else Z=s;if(!Z){X=e;Y=I;break}else{i=e;n=I;h=Z}}}if(((X|0)!=0?Y>>>0<((c[4575]|0)-f|0)>>>0:0)?(h=X+f|0,h>>>0>X>>>0):0){n=c[X+24>>2]|0;i=c[X+12>>2]|0;do if((i|0)==(X|0)){I=X+20|0;e=c[I>>2]|0;if(!e){s=X+16|0;g=c[s>>2]|0;if(!g){_=0;break}else{$=g;aa=s}}else{$=e;aa=I}I=$;e=aa;while(1){s=I+20|0;g=c[s>>2]|0;if(!g){m=I+16|0;N=c[m>>2]|0;if(!N)break;else{ba=N;ca=m}}else{ba=g;ca=s}I=ba;e=ca}c[e>>2]=0;_=I}else{s=c[X+8>>2]|0;c[s+12>>2]=i;c[i+8>>2]=s;_=i}while(0);do if(n){i=c[X+28>>2]|0;s=18596+(i<<2)|0;if((X|0)==(c[s>>2]|0)){c[s>>2]=_;if(!_){s=u&~(1<<i);c[4574]=s;da=s;break}}else{s=n+16|0;c[((c[s>>2]|0)==(X|0)?s:n+20|0)>>2]=_;if(!_){da=u;break}}c[_+24>>2]=n;s=c[X+16>>2]|0;if(s|0){c[_+16>>2]=s;c[s+24>>2]=_}s=c[X+20>>2]|0;if(s){c[_+20>>2]=s;c[s+24>>2]=_;da=u}else da=u}else da=u;while(0);b:do if(Y>>>0<16){u=Y+f|0;c[X+4>>2]=u|3;n=X+u+4|0;c[n>>2]=c[n>>2]|1}else{c[X+4>>2]=f|3;c[h+4>>2]=Y|1;c[h+Y>>2]=Y;n=Y>>>3;if(Y>>>0<256){u=18332+(n<<1<<2)|0;s=c[4573]|0;i=1<<n;if(!(s&i)){c[4573]=s|i;ea=u;fa=u+8|0}else{i=u+8|0;ea=c[i>>2]|0;fa=i}c[fa>>2]=h;c[ea+12>>2]=h;c[h+8>>2]=ea;c[h+12>>2]=u;break}u=Y>>>8;if(u)if(Y>>>0>16777215)ga=31;else{i=(u+1048320|0)>>>16&8;s=u<<i;u=(s+520192|0)>>>16&4;n=s<<u;s=(n+245760|0)>>>16&2;g=14-(u|i|s)+(n<<s>>>15)|0;ga=Y>>>(g+7|0)&1|g<<1}else ga=0;g=18596+(ga<<2)|0;c[h+28>>2]=ga;s=h+16|0;c[s+4>>2]=0;c[s>>2]=0;s=1<<ga;if(!(da&s)){c[4574]=da|s;c[g>>2]=h;c[h+24>>2]=g;c[h+12>>2]=h;c[h+8>>2]=h;break}s=c[g>>2]|0;c:do if((c[s+4>>2]&-8|0)==(Y|0))ha=s;else{g=Y<<((ga|0)==31?0:25-(ga>>>1)|0);n=s;while(1){ia=n+16+(g>>>31<<2)|0;i=c[ia>>2]|0;if(!i)break;if((c[i+4>>2]&-8|0)==(Y|0)){ha=i;break c}else{g=g<<1;n=i}}c[ia>>2]=h;c[h+24>>2]=n;c[h+12>>2]=h;c[h+8>>2]=h;break b}while(0);s=ha+8|0;I=c[s>>2]|0;c[I+12>>2]=h;c[s>>2]=h;c[h+8>>2]=I;c[h+12>>2]=ha;c[h+24>>2]=0}while(0);o=X+8|0;Ka=b;return o|0}else G=f}else G=f}else G=-1;while(0);X=c[4575]|0;if(X>>>0>=G>>>0){ha=X-G|0;ia=c[4578]|0;if(ha>>>0>15){Y=ia+G|0;c[4578]=Y;c[4575]=ha;c[Y+4>>2]=ha|1;c[ia+X>>2]=ha;c[ia+4>>2]=G|3}else{c[4575]=0;c[4578]=0;c[ia+4>>2]=X|3;ha=ia+X+4|0;c[ha>>2]=c[ha>>2]|1}o=ia+8|0;Ka=b;return o|0}ia=c[4576]|0;if(ia>>>0>G>>>0){ha=ia-G|0;c[4576]=ha;X=c[4579]|0;Y=X+G|0;c[4579]=Y;c[Y+4>>2]=ha|1;c[X+4>>2]=G|3;o=X+8|0;Ka=b;return o|0}if(!(c[4691]|0)){c[4693]=4096;c[4692]=4096;c[4694]=-1;c[4695]=-1;c[4696]=0;c[4684]=0;c[4691]=d&-16^1431655768;ja=4096}else ja=c[4693]|0;d=G+48|0;X=G+47|0;ha=ja+X|0;Y=0-ja|0;ja=ha&Y;if(ja>>>0<=G>>>0){o=0;Ka=b;return o|0}ga=c[4683]|0;if(ga|0?(da=c[4681]|0,ea=da+ja|0,ea>>>0<=da>>>0|ea>>>0>ga>>>0):0){o=0;Ka=b;return o|0}d:do if(!(c[4684]&4)){ga=c[4579]|0;e:do if(ga){ea=18740;while(1){da=c[ea>>2]|0;if(da>>>0<=ga>>>0?(da+(c[ea+4>>2]|0)|0)>>>0>ga>>>0:0)break;da=c[ea+8>>2]|0;if(!da){M=128;break e}else ea=da}da=ha-ia&Y;if(da>>>0<2147483647){fa=Pi(da|0)|0;if((fa|0)==((c[ea>>2]|0)+(c[ea+4>>2]|0)|0))if((fa|0)==(-1|0))ka=da;else{la=da;ma=fa;M=145;break d}else{na=fa;oa=da;M=136}}else ka=0}else M=128;while(0);do if((M|0)==128){ga=Pi(0)|0;if((ga|0)!=(-1|0)?(f=ga,da=c[4692]|0,fa=da+-1|0,_=((fa&f|0)==0?0:(fa+f&0-da)-f|0)+ja|0,f=c[4681]|0,da=_+f|0,_>>>0>G>>>0&_>>>0<2147483647):0){fa=c[4683]|0;if(fa|0?da>>>0<=f>>>0|da>>>0>fa>>>0:0){ka=0;break}fa=Pi(_|0)|0;if((fa|0)==(ga|0)){la=_;ma=ga;M=145;break d}else{na=fa;oa=_;M=136}}else ka=0}while(0);do if((M|0)==136){_=0-oa|0;if(!(d>>>0>oa>>>0&(oa>>>0<2147483647&(na|0)!=(-1|0))))if((na|0)==(-1|0)){ka=0;break}else{la=oa;ma=na;M=145;break d}fa=c[4693]|0;ga=X-oa+fa&0-fa;if(ga>>>0>=2147483647){la=oa;ma=na;M=145;break d}if((Pi(ga|0)|0)==(-1|0)){Pi(_|0)|0;ka=0;break}else{la=ga+oa|0;ma=na;M=145;break d}}while(0);c[4684]=c[4684]|4;pa=ka;M=143}else{pa=0;M=143}while(0);if(((M|0)==143?ja>>>0<2147483647:0)?(ka=Pi(ja|0)|0,ja=Pi(0)|0,na=ja-ka|0,oa=na>>>0>(G+40|0)>>>0,!((ka|0)==(-1|0)|oa^1|ka>>>0<ja>>>0&((ka|0)!=(-1|0)&(ja|0)!=(-1|0))^1)):0){la=oa?na:pa;ma=ka;M=145}if((M|0)==145){ka=(c[4681]|0)+la|0;c[4681]=ka;if(ka>>>0>(c[4682]|0)>>>0)c[4682]=ka;ka=c[4579]|0;f:do if(ka){pa=18740;while(1){qa=c[pa>>2]|0;ra=c[pa+4>>2]|0;if((ma|0)==(qa+ra|0)){M=154;break}na=c[pa+8>>2]|0;if(!na)break;else pa=na}if(((M|0)==154?(na=pa+4|0,(c[pa+12>>2]&8|0)==0):0)?ma>>>0>ka>>>0&qa>>>0<=ka>>>0:0){c[na>>2]=ra+la;na=(c[4576]|0)+la|0;oa=ka+8|0;ja=(oa&7|0)==0?0:0-oa&7;oa=ka+ja|0;X=na-ja|0;c[4579]=oa;c[4576]=X;c[oa+4>>2]=X|1;c[ka+na+4>>2]=40;c[4580]=c[4695];break}if(ma>>>0<(c[4577]|0)>>>0)c[4577]=ma;na=ma+la|0;X=18740;while(1){if((c[X>>2]|0)==(na|0)){M=162;break}oa=c[X+8>>2]|0;if(!oa)break;else X=oa}if((M|0)==162?(c[X+12>>2]&8|0)==0:0){c[X>>2]=ma;pa=X+4|0;c[pa>>2]=(c[pa>>2]|0)+la;pa=ma+8|0;oa=ma+((pa&7|0)==0?0:0-pa&7)|0;pa=na+8|0;ja=na+((pa&7|0)==0?0:0-pa&7)|0;pa=oa+G|0;d=ja-oa-G|0;c[oa+4>>2]=G|3;g:do if((ka|0)==(ja|0)){Y=(c[4576]|0)+d|0;c[4576]=Y;c[4579]=pa;c[pa+4>>2]=Y|1}else{if((c[4578]|0)==(ja|0)){Y=(c[4575]|0)+d|0;c[4575]=Y;c[4578]=pa;c[pa+4>>2]=Y|1;c[pa+Y>>2]=Y;break}Y=c[ja+4>>2]|0;if((Y&3|0)==1){ia=Y&-8;ha=Y>>>3;h:do if(Y>>>0<256){ga=c[ja+8>>2]|0;_=c[ja+12>>2]|0;if((_|0)==(ga|0)){c[4573]=c[4573]&~(1<<ha);break}else{c[ga+12>>2]=_;c[_+8>>2]=ga;break}}else{ga=c[ja+24>>2]|0;_=c[ja+12>>2]|0;do if((_|0)==(ja|0)){fa=ja+16|0;da=fa+4|0;f=c[da>>2]|0;if(!f){ca=c[fa>>2]|0;if(!ca){sa=0;break}else{ta=ca;ua=fa}}else{ta=f;ua=da}da=ta;f=ua;while(1){fa=da+20|0;ca=c[fa>>2]|0;if(!ca){ba=da+16|0;aa=c[ba>>2]|0;if(!aa)break;else{va=aa;wa=ba}}else{va=ca;wa=fa}da=va;f=wa}c[f>>2]=0;sa=da}else{fa=c[ja+8>>2]|0;c[fa+12>>2]=_;c[_+8>>2]=fa;sa=_}while(0);if(!ga)break;_=c[ja+28>>2]|0;n=18596+(_<<2)|0;do if((c[n>>2]|0)!=(ja|0)){fa=ga+16|0;c[((c[fa>>2]|0)==(ja|0)?fa:ga+20|0)>>2]=sa;if(!sa)break h}else{c[n>>2]=sa;if(sa|0)break;c[4574]=c[4574]&~(1<<_);break h}while(0);c[sa+24>>2]=ga;_=ja+16|0;n=c[_>>2]|0;if(n|0){c[sa+16>>2]=n;c[n+24>>2]=sa}n=c[_+4>>2]|0;if(!n)break;c[sa+20>>2]=n;c[n+24>>2]=sa}while(0);xa=ja+ia|0;ya=ia+d|0}else{xa=ja;ya=d}ha=xa+4|0;c[ha>>2]=c[ha>>2]&-2;c[pa+4>>2]=ya|1;c[pa+ya>>2]=ya;ha=ya>>>3;if(ya>>>0<256){Y=18332+(ha<<1<<2)|0;ea=c[4573]|0;n=1<<ha;if(!(ea&n)){c[4573]=ea|n;za=Y;Aa=Y+8|0}else{n=Y+8|0;za=c[n>>2]|0;Aa=n}c[Aa>>2]=pa;c[za+12>>2]=pa;c[pa+8>>2]=za;c[pa+12>>2]=Y;break}Y=ya>>>8;do if(!Y)Ba=0;else{if(ya>>>0>16777215){Ba=31;break}n=(Y+1048320|0)>>>16&8;ea=Y<<n;ha=(ea+520192|0)>>>16&4;_=ea<<ha;ea=(_+245760|0)>>>16&2;fa=14-(ha|n|ea)+(_<<ea>>>15)|0;Ba=ya>>>(fa+7|0)&1|fa<<1}while(0);Y=18596+(Ba<<2)|0;c[pa+28>>2]=Ba;ia=pa+16|0;c[ia+4>>2]=0;c[ia>>2]=0;ia=c[4574]|0;fa=1<<Ba;if(!(ia&fa)){c[4574]=ia|fa;c[Y>>2]=pa;c[pa+24>>2]=Y;c[pa+12>>2]=pa;c[pa+8>>2]=pa;break}fa=c[Y>>2]|0;i:do if((c[fa+4>>2]&-8|0)==(ya|0))Ca=fa;else{Y=ya<<((Ba|0)==31?0:25-(Ba>>>1)|0);ia=fa;while(1){Da=ia+16+(Y>>>31<<2)|0;ea=c[Da>>2]|0;if(!ea)break;if((c[ea+4>>2]&-8|0)==(ya|0)){Ca=ea;break i}else{Y=Y<<1;ia=ea}}c[Da>>2]=pa;c[pa+24>>2]=ia;c[pa+12>>2]=pa;c[pa+8>>2]=pa;break g}while(0);fa=Ca+8|0;Y=c[fa>>2]|0;c[Y+12>>2]=pa;c[fa>>2]=pa;c[pa+8>>2]=Y;c[pa+12>>2]=Ca;c[pa+24>>2]=0}while(0);o=oa+8|0;Ka=b;return o|0}pa=18740;while(1){d=c[pa>>2]|0;if(d>>>0<=ka>>>0?(Ea=d+(c[pa+4>>2]|0)|0,Ea>>>0>ka>>>0):0)break;pa=c[pa+8>>2]|0}pa=Ea+-47|0;oa=pa+8|0;d=pa+((oa&7|0)==0?0:0-oa&7)|0;oa=ka+16|0;pa=d>>>0<oa>>>0?ka:d;d=pa+8|0;ja=la+-40|0;na=ma+8|0;X=(na&7|0)==0?0:0-na&7;na=ma+X|0;Y=ja-X|0;c[4579]=na;c[4576]=Y;c[na+4>>2]=Y|1;c[ma+ja+4>>2]=40;c[4580]=c[4695];ja=pa+4|0;c[ja>>2]=27;c[d>>2]=c[4685];c[d+4>>2]=c[4686];c[d+8>>2]=c[4687];c[d+12>>2]=c[4688];c[4685]=ma;c[4686]=la;c[4688]=0;c[4687]=d;d=pa+24|0;do{Y=d;d=d+4|0;c[d>>2]=7}while((Y+8|0)>>>0<Ea>>>0);if((pa|0)!=(ka|0)){d=pa-ka|0;c[ja>>2]=c[ja>>2]&-2;c[ka+4>>2]=d|1;c[pa>>2]=d;Y=d>>>3;if(d>>>0<256){na=18332+(Y<<1<<2)|0;X=c[4573]|0;fa=1<<Y;if(!(X&fa)){c[4573]=X|fa;Fa=na;Ga=na+8|0}else{fa=na+8|0;Fa=c[fa>>2]|0;Ga=fa}c[Ga>>2]=ka;c[Fa+12>>2]=ka;c[ka+8>>2]=Fa;c[ka+12>>2]=na;break}na=d>>>8;if(na)if(d>>>0>16777215)Ha=31;else{fa=(na+1048320|0)>>>16&8;X=na<<fa;na=(X+520192|0)>>>16&4;Y=X<<na;X=(Y+245760|0)>>>16&2;ga=14-(na|fa|X)+(Y<<X>>>15)|0;Ha=d>>>(ga+7|0)&1|ga<<1}else Ha=0;ga=18596+(Ha<<2)|0;c[ka+28>>2]=Ha;c[ka+20>>2]=0;c[oa>>2]=0;X=c[4574]|0;Y=1<<Ha;if(!(X&Y)){c[4574]=X|Y;c[ga>>2]=ka;c[ka+24>>2]=ga;c[ka+12>>2]=ka;c[ka+8>>2]=ka;break}Y=c[ga>>2]|0;j:do if((c[Y+4>>2]&-8|0)==(d|0))Ia=Y;else{ga=d<<((Ha|0)==31?0:25-(Ha>>>1)|0);X=Y;while(1){Ja=X+16+(ga>>>31<<2)|0;fa=c[Ja>>2]|0;if(!fa)break;if((c[fa+4>>2]&-8|0)==(d|0)){Ia=fa;break j}else{ga=ga<<1;X=fa}}c[Ja>>2]=ka;c[ka+24>>2]=X;c[ka+12>>2]=ka;c[ka+8>>2]=ka;break f}while(0);d=Ia+8|0;Y=c[d>>2]|0;c[Y+12>>2]=ka;c[d>>2]=ka;c[ka+8>>2]=Y;c[ka+12>>2]=Ia;c[ka+24>>2]=0}}else{Y=c[4577]|0;if((Y|0)==0|ma>>>0<Y>>>0)c[4577]=ma;c[4685]=ma;c[4686]=la;c[4688]=0;c[4582]=c[4691];c[4581]=-1;c[4586]=18332;c[4585]=18332;c[4588]=18340;c[4587]=18340;c[4590]=18348;c[4589]=18348;c[4592]=18356;c[4591]=18356;c[4594]=18364;c[4593]=18364;c[4596]=18372;c[4595]=18372;c[4598]=18380;c[4597]=18380;c[4600]=18388;c[4599]=18388;c[4602]=18396;c[4601]=18396;c[4604]=18404;c[4603]=18404;c[4606]=18412;c[4605]=18412;c[4608]=18420;c[4607]=18420;c[4610]=18428;c[4609]=18428;c[4612]=18436;c[4611]=18436;c[4614]=18444;c[4613]=18444;c[4616]=18452;c[4615]=18452;c[4618]=18460;c[4617]=18460;c[4620]=18468;c[4619]=18468;c[4622]=18476;c[4621]=18476;c[4624]=18484;c[4623]=18484;c[4626]=18492;c[4625]=18492;c[4628]=18500;c[4627]=18500;c[4630]=18508;c[4629]=18508;c[4632]=18516;c[4631]=18516;c[4634]=18524;c[4633]=18524;c[4636]=18532;c[4635]=18532;c[4638]=18540;c[4637]=18540;c[4640]=18548;c[4639]=18548;c[4642]=18556;c[4641]=18556;c[4644]=18564;c[4643]=18564;c[4646]=18572;c[4645]=18572;c[4648]=18580;c[4647]=18580;Y=la+-40|0;d=ma+8|0;oa=(d&7|0)==0?0:0-d&7;d=ma+oa|0;pa=Y-oa|0;c[4579]=d;c[4576]=pa;c[d+4>>2]=pa|1;c[ma+Y+4>>2]=40;c[4580]=c[4695]}while(0);ma=c[4576]|0;if(ma>>>0>G>>>0){la=ma-G|0;c[4576]=la;ma=c[4579]|0;ka=ma+G|0;c[4579]=ka;c[ka+4>>2]=la|1;c[ma+4>>2]=G|3;o=ma+8|0;Ka=b;return o|0}}c[(cg()|0)>>2]=12;o=0;Ka=b;return o|0}function bh(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0;if(!a)return;b=a+-8|0;d=c[4577]|0;e=c[a+-4>>2]|0;a=e&-8;f=b+a|0;do if(!(e&1)){g=c[b>>2]|0;if(!(e&3))return;h=b+(0-g)|0;i=g+a|0;if(h>>>0<d>>>0)return;if((c[4578]|0)==(h|0)){j=f+4|0;k=c[j>>2]|0;if((k&3|0)!=3){l=h;m=i;n=h;break}c[4575]=i;c[j>>2]=k&-2;c[h+4>>2]=i|1;c[h+i>>2]=i;return}k=g>>>3;if(g>>>0<256){g=c[h+8>>2]|0;j=c[h+12>>2]|0;if((j|0)==(g|0)){c[4573]=c[4573]&~(1<<k);l=h;m=i;n=h;break}else{c[g+12>>2]=j;c[j+8>>2]=g;l=h;m=i;n=h;break}}g=c[h+24>>2]|0;j=c[h+12>>2]|0;do if((j|0)==(h|0)){k=h+16|0;o=k+4|0;p=c[o>>2]|0;if(!p){q=c[k>>2]|0;if(!q){r=0;break}else{s=q;t=k}}else{s=p;t=o}o=s;p=t;while(1){k=o+20|0;q=c[k>>2]|0;if(!q){u=o+16|0;v=c[u>>2]|0;if(!v)break;else{w=v;x=u}}else{w=q;x=k}o=w;p=x}c[p>>2]=0;r=o}else{k=c[h+8>>2]|0;c[k+12>>2]=j;c[j+8>>2]=k;r=j}while(0);if(g){j=c[h+28>>2]|0;k=18596+(j<<2)|0;if((c[k>>2]|0)==(h|0)){c[k>>2]=r;if(!r){c[4574]=c[4574]&~(1<<j);l=h;m=i;n=h;break}}else{j=g+16|0;c[((c[j>>2]|0)==(h|0)?j:g+20|0)>>2]=r;if(!r){l=h;m=i;n=h;break}}c[r+24>>2]=g;j=h+16|0;k=c[j>>2]|0;if(k|0){c[r+16>>2]=k;c[k+24>>2]=r}k=c[j+4>>2]|0;if(k){c[r+20>>2]=k;c[k+24>>2]=r;l=h;m=i;n=h}else{l=h;m=i;n=h}}else{l=h;m=i;n=h}}else{l=b;m=a;n=b}while(0);if(n>>>0>=f>>>0)return;b=f+4|0;a=c[b>>2]|0;if(!(a&1))return;if(!(a&2)){if((c[4579]|0)==(f|0)){r=(c[4576]|0)+m|0;c[4576]=r;c[4579]=l;c[l+4>>2]=r|1;if((l|0)!=(c[4578]|0))return;c[4578]=0;c[4575]=0;return}if((c[4578]|0)==(f|0)){r=(c[4575]|0)+m|0;c[4575]=r;c[4578]=n;c[l+4>>2]=r|1;c[n+r>>2]=r;return}r=(a&-8)+m|0;x=a>>>3;do if(a>>>0<256){w=c[f+8>>2]|0;t=c[f+12>>2]|0;if((t|0)==(w|0)){c[4573]=c[4573]&~(1<<x);break}else{c[w+12>>2]=t;c[t+8>>2]=w;break}}else{w=c[f+24>>2]|0;t=c[f+12>>2]|0;do if((t|0)==(f|0)){s=f+16|0;d=s+4|0;e=c[d>>2]|0;if(!e){k=c[s>>2]|0;if(!k){y=0;break}else{z=k;A=s}}else{z=e;A=d}d=z;e=A;while(1){s=d+20|0;k=c[s>>2]|0;if(!k){j=d+16|0;q=c[j>>2]|0;if(!q)break;else{B=q;C=j}}else{B=k;C=s}d=B;e=C}c[e>>2]=0;y=d}else{o=c[f+8>>2]|0;c[o+12>>2]=t;c[t+8>>2]=o;y=t}while(0);if(w|0){t=c[f+28>>2]|0;h=18596+(t<<2)|0;if((c[h>>2]|0)==(f|0)){c[h>>2]=y;if(!y){c[4574]=c[4574]&~(1<<t);break}}else{t=w+16|0;c[((c[t>>2]|0)==(f|0)?t:w+20|0)>>2]=y;if(!y)break}c[y+24>>2]=w;t=f+16|0;h=c[t>>2]|0;if(h|0){c[y+16>>2]=h;c[h+24>>2]=y}h=c[t+4>>2]|0;if(h|0){c[y+20>>2]=h;c[h+24>>2]=y}}}while(0);c[l+4>>2]=r|1;c[n+r>>2]=r;if((l|0)==(c[4578]|0)){c[4575]=r;return}else D=r}else{c[b>>2]=a&-2;c[l+4>>2]=m|1;c[n+m>>2]=m;D=m}m=D>>>3;if(D>>>0<256){n=18332+(m<<1<<2)|0;a=c[4573]|0;b=1<<m;if(!(a&b)){c[4573]=a|b;E=n;F=n+8|0}else{b=n+8|0;E=c[b>>2]|0;F=b}c[F>>2]=l;c[E+12>>2]=l;c[l+8>>2]=E;c[l+12>>2]=n;return}n=D>>>8;if(n)if(D>>>0>16777215)G=31;else{E=(n+1048320|0)>>>16&8;F=n<<E;n=(F+520192|0)>>>16&4;b=F<<n;F=(b+245760|0)>>>16&2;a=14-(n|E|F)+(b<<F>>>15)|0;G=D>>>(a+7|0)&1|a<<1}else G=0;a=18596+(G<<2)|0;c[l+28>>2]=G;c[l+20>>2]=0;c[l+16>>2]=0;F=c[4574]|0;b=1<<G;a:do if(!(F&b)){c[4574]=F|b;c[a>>2]=l;c[l+24>>2]=a;c[l+12>>2]=l;c[l+8>>2]=l}else{E=c[a>>2]|0;b:do if((c[E+4>>2]&-8|0)==(D|0))H=E;else{n=D<<((G|0)==31?0:25-(G>>>1)|0);m=E;while(1){I=m+16+(n>>>31<<2)|0;r=c[I>>2]|0;if(!r)break;if((c[r+4>>2]&-8|0)==(D|0)){H=r;break b}else{n=n<<1;m=r}}c[I>>2]=l;c[l+24>>2]=m;c[l+12>>2]=l;c[l+8>>2]=l;break a}while(0);E=H+8|0;w=c[E>>2]|0;c[w+12>>2]=l;c[E>>2]=l;c[l+8>>2]=w;c[l+12>>2]=H;c[l+24>>2]=0}while(0);l=(c[4581]|0)+-1|0;c[4581]=l;if(l|0)return;l=18748;while(1){H=c[l>>2]|0;if(!H)break;else l=H+8|0}c[4581]=-1;return}function ch(a){a=a|0;return}function dh(a){a=a|0;ch(a);kh(a);return}function eh(a){a=a|0;return 12248}function fh(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,w=0,x=0,y=0,z=0,B=0,C=0,D=0,E=0,F=0;b=Ka;Ka=Ka+16|0;if((Ka|0)>=(La|0))A(16);d=b;e=b+8|0;f=b+4|0;c[e>>2]=a;do if(a>>>0>=212){g=(a>>>0)/210|0;h=g*210|0;c[f>>2]=a-h;i=0;j=g;g=h;h=(gh(2592,2784,f,d)|0)-2592>>2;a:while(1){k=(c[2592+(h<<2)>>2]|0)+g|0;l=5;while(1){if(l>>>0>=47){m=6;break}n=c[2400+(l<<2)>>2]|0;o=(k>>>0)/(n>>>0)|0;if(o>>>0<n>>>0){m=107;break a}if((k|0)==(v(o,n)|0)){p=i;break}else l=l+1|0}b:do if((m|0)==6){m=0;l=211;n=i;c:while(1){o=(k>>>0)/(l>>>0)|0;do if(o>>>0>=l>>>0)if((k|0)!=(v(o,l)|0)){q=l+10|0;r=(k>>>0)/(q>>>0)|0;if(r>>>0>=q>>>0)if((k|0)!=(v(r,q)|0)){r=l+12|0;s=(k>>>0)/(r>>>0)|0;if(s>>>0>=r>>>0)if((k|0)!=(v(s,r)|0)){s=l+16|0;t=(k>>>0)/(s>>>0)|0;if(t>>>0>=s>>>0)if((k|0)!=(v(t,s)|0)){t=l+18|0;u=(k>>>0)/(t>>>0)|0;if(u>>>0>=t>>>0)if((k|0)!=(v(u,t)|0)){u=l+22|0;w=(k>>>0)/(u>>>0)|0;if(w>>>0>=u>>>0)if((k|0)!=(v(w,u)|0)){w=l+28|0;x=(k>>>0)/(w>>>0)|0;if(x>>>0>=w>>>0)if((k|0)==(v(x,w)|0)){y=w;z=9;B=n}else{x=l+30|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+36|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+40|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+42|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+46|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+52|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+58|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+60|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+66|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+70|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+72|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+78|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+82|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+88|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+96|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+100|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+102|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+106|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+108|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+112|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+120|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+126|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+130|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+136|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+138|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+142|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+148|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+150|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+156|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+162|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+166|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+168|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+172|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+178|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+180|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+186|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+190|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+192|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+196|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+198|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+208|0;C=(k>>>0)/(x>>>0)|0;D=C>>>0<x>>>0;E=(k|0)==(v(C,x)|0);y=D|E?x:l+210|0;z=D?1:E?9:0;B=D?k:n}else{y=w;z=1;B=k}}else{y=u;z=9;B=n}else{y=u;z=1;B=k}}else{y=t;z=9;B=n}else{y=t;z=1;B=k}}else{y=s;z=9;B=n}else{y=s;z=1;B=k}}else{y=r;z=9;B=n}else{y=r;z=1;B=k}}else{y=q;z=9;B=n}else{y=q;z=1;B=k}}else{y=l;z=9;B=n}else{y=l;z=1;B=k}while(0);switch(z&15){case 9:{p=B;break b;break}case 0:{l=y;n=B;break}default:break c}}if(!z)p=B;else{m=108;break a}}while(0);n=h+1|0;l=(n|0)==48;o=j+(l&1)|0;i=p;j=o;g=o*210|0;h=l?0:n}if((m|0)==107){c[e>>2]=k;F=k;break}else if((m|0)==108){c[e>>2]=k;F=B;break}}else F=c[(gh(2400,2592,e,d)|0)>>2]|0;while(0);Ka=b;return F|0}function gh(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0;e=c[d>>2]|0;d=a;f=b-a>>2;while(1){if(!f)break;a=(f|0)/2|0;b=d+(a<<2)|0;g=(c[b>>2]|0)>>>0<e>>>0;d=g?b+4|0:d;f=g?f+-1-a|0:a}return d|0}function hh(a){a=a|0;return}function ih(a){a=a|0;var b=0,d=0;b=a+8|0;if(!((c[b>>2]|0)!=0?(d=c[b>>2]|0,c[b>>2]=d+-1,(d|0)!=0):0))Sa[c[(c[a>>2]|0)+16>>2]&127](a);return}function jh(a){a=a|0;var b=0,c=0;b=(a|0)==0?1:a;while(1){a=ah(b)|0;if(a|0){c=a;break}a=zi()|0;if(!a){c=0;break}Ra[a&3]()}return c|0}function kh(a){a=a|0;bh(a);return}function lh(b,d){b=b|0;d=d|0;var e=0,f=0,g=0;e=Ka;Ka=Ka+16|0;if((Ka|0)>=(La|0))A(16);f=e;g=Tg((a[d+11>>0]|0)<0?c[d>>2]|0:d,0,f)|0;c[b>>2]=g;if((g|0)<0){g=c[(cg()|0)>>2]|0;Fh(f,12354,d);Gh(g,(a[f+11>>0]|0)<0?c[f>>2]|0:f)}else{Ka=e;return}}function mh(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0;b=Ka;Ka=Ka+16|0;if((Ka|0)>=(La|0))A(16);d=b;e=4;f=d;a:while(1){if(!e){g=9;break}b:while(1){h=Wg(c[a>>2]|0,f,e)|0;switch(h|0){case 0:{g=5;break a;break}case -1:break;default:break b}if((c[(cg()|0)>>2]|0)!=4){g=7;break a}}e=e-h|0;f=f+h|0}if((g|0)==5)Gh(61,12384);else if((g|0)==7)Gh(c[(cg()|0)>>2]|0,12406);else if((g|0)==9){Ka=b;return c[d>>2]|0}return 0}function nh(a,b){a=a|0;b=b|0;var d=0,e=0,f=0;d=ig(b)|0;e=jh(d+13|0)|0;c[e>>2]=d;c[e+4>>2]=d;c[e+8>>2]=0;f=oh(e)|0;Mi(f|0,b|0,d+1|0)|0;c[a>>2]=f;return}function oh(a){a=a|0;return a+12|0}function ph(a,b){a=a|0;b=b|0;c[a>>2]=5884;nh(a+4|0,b);return}function qh(a){a=a|0;return 1}function rh(a){a=a|0;wa()}function sh(b,d){b=b|0;d=d|0;c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;if((a[d+11>>0]|0)<0)th(b,c[d>>2]|0,c[d+4>>2]|0);else{c[b>>2]=c[d>>2];c[b+4>>2]=c[d+4>>2];c[b+8>>2]=c[d+8>>2]}return}function th(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0;f=Ka;Ka=Ka+16|0;if((Ka|0)>=(La|0))A(16);g=f;if(e>>>0>4294967279)rh(b);if(e>>>0<11){a[b+11>>0]=e;h=b}else{i=e+16&-16;j=jh(i)|0;c[b>>2]=j;c[b+8>>2]=i|-2147483648;c[b+4>>2]=e;h=j}uh(h,d,e)|0;a[g>>0]=0;vh(h+e|0,g);Ka=f;return}function uh(a,b,c){a=a|0;b=b|0;c=c|0;if(c|0)Mi(a|0,b|0,c|0)|0;return a|0}function vh(b,c){b=b|0;c=c|0;a[b>>0]=a[c>>0]|0;return}function wh(a){a=a|0;return ig(a)|0}function xh(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;f=Ka;Ka=Ka+16|0;if((Ka|0)>=(La|0))A(16);g=f;h=b+11|0;i=a[h>>0]|0;j=i<<24>>24<0;if(j)k=(c[b+8>>2]&2147483647)+-1|0;else k=10;do if(k>>>0>=e>>>0){if(j)l=c[b>>2]|0;else l=b;yh(l,d,e)|0;a[g>>0]=0;vh(l+e|0,g);if((a[h>>0]|0)<0){c[b+4>>2]=e;break}else{a[h>>0]=e;break}}else{if(j)m=c[b+4>>2]|0;else m=i&255;zh(b,k,e-k|0,m,0,m,e,d)}while(0);Ka=f;return b|0}function yh(a,b,c){a=a|0;b=b|0;c=c|0;if(c|0)Ni(a|0,b|0,c|0)|0;return a|0}
function zh(b,d,e,f,g,h,i,j){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;h=h|0;i=i|0;j=j|0;var k=0,l=0,m=0,n=0,o=0,p=0;k=Ka;Ka=Ka+16|0;if((Ka|0)>=(La|0))A(16);l=k;if((-18-d|0)>>>0<e>>>0)rh(b);if((a[b+11>>0]|0)<0)m=c[b>>2]|0;else m=b;if(d>>>0<2147483623){n=e+d|0;e=d<<1;o=n>>>0<e>>>0?e:n;p=o>>>0<11?11:o+16&-16}else p=-17;o=jh(p)|0;if(g|0)uh(o,m,g)|0;if(i|0)uh(o+g|0,j,i)|0;j=f-h|0;f=j-g|0;if(f|0)uh(o+g+i|0,m+g+h|0,f)|0;if((d|0)!=10)kh(m);c[b>>2]=o;c[b+8>>2]=p|-2147483648;p=j+i|0;c[b+4>>2]=p;a[l>>0]=0;vh(o+p|0,l);Ka=k;return}function Ah(a,b){a=a|0;b=b|0;return xh(a,b,wh(b)|0)|0}function Bh(b,d,e,f,g,h,i){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;h=h|0;i=i|0;var j=0,k=0,l=0,m=0;if((-17-d|0)>>>0<e>>>0)rh(b);if((a[b+11>>0]|0)<0)j=c[b>>2]|0;else j=b;if(d>>>0<2147483623){k=e+d|0;e=d<<1;l=k>>>0<e>>>0?e:k;m=l>>>0<11?11:l+16&-16}else m=-17;l=jh(m)|0;if(g|0)uh(l,j,g)|0;k=f-h-g|0;if(k|0)uh(l+g+i|0,j+g+h|0,k)|0;if((d|0)!=10)kh(j);c[b>>2]=l;c[b+8>>2]=m|-2147483648;return}function Ch(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;f=Ka;Ka=Ka+16|0;if((Ka|0)>=(La|0))A(16);g=f;h=b+11|0;i=a[h>>0]|0;j=i<<24>>24<0;if(j){k=(c[b+8>>2]&2147483647)+-1|0;l=c[b+4>>2]|0}else{k=10;l=i&255}if((k-l|0)>>>0>=e>>>0){if(e|0){if(j)m=c[b>>2]|0;else m=b;uh(m+l|0,d,e)|0;j=l+e|0;if((a[h>>0]|0)<0)c[b+4>>2]=j;else a[h>>0]=j;a[g>>0]=0;vh(m+j|0,g)}}else zh(b,k,l+e-k|0,l,l,0,e,d);Ka=f;return b|0}function Dh(b,d){b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;e=Ka;Ka=Ka+16|0;if((Ka|0)>=(La|0))A(16);f=e;g=e+1|0;a[f>>0]=d;d=b+11|0;h=a[d>>0]|0;i=h<<24>>24<0;if(i){j=c[b+4>>2]|0;k=(c[b+8>>2]&2147483647)+-1|0}else{j=h&255;k=10}if((j|0)==(k|0)){Bh(b,k,1,k,k,0,0);if((a[d>>0]|0)<0)l=8;else l=7}else if(i)l=8;else l=7;if((l|0)==7){a[d>>0]=j+1;m=b}else if((l|0)==8){l=c[b>>2]|0;c[b+4>>2]=j+1;m=l}l=m+j|0;vh(l,f);a[g>>0]=0;vh(l+1|0,g);Ka=e;return}function Eh(b,d,e,f){b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0,j=0;g=Ka;Ka=Ka+16|0;if((Ka|0)>=(La|0))A(16);h=g;if(f>>>0>4294967279)rh(b);if(f>>>0<11){a[b+11>>0]=e;i=b}else{j=f+16&-16;f=jh(j)|0;c[b>>2]=f;c[b+8>>2]=j|-2147483648;c[b+4>>2]=e;i=f}uh(i,d,e)|0;a[h>>0]=0;vh(i+e|0,h);Ka=g;return}function Fh(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0;c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;f=0;while(1){if((f|0)==3)break;c[b+(f<<2)>>2]=0;f=f+1|0}f=wh(d)|0;g=e+11|0;h=a[g>>0]|0;i=h<<24>>24<0?c[e+4>>2]|0:h&255;Eh(b,d,f,i+f|0);Ch(b,(a[g>>0]|0)<0?c[e>>2]|0:e,i)|0;return}function Gh(a,b){a=a|0;b=b|0;wa()}function Hh(a){a=a|0;wa()}function Ih(){var a=0,b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0;a=Ka;Ka=Ka+48|0;if((Ka|0)>=(La|0))A(48);b=a+32|0;d=a+24|0;e=a+16|0;f=a;g=a+36|0;a=Jh()|0;if(a|0?(h=c[a>>2]|0,h|0):0){a=h+48|0;i=c[a>>2]|0;j=c[a+4>>2]|0;if(!((i&-256|0)==1126902528&(j|0)==1129074247)){c[d>>2]=12580;Kh(12530,d)}if((i|0)==1126902529&(j|0)==1129074247)k=c[h+44>>2]|0;else k=h+80|0;c[g>>2]=k;k=c[h>>2]|0;h=c[k+4>>2]|0;if(Pa[c[(c[958]|0)+16>>2]&15](3832,k,g)|0){k=c[g>>2]|0;g=Na[c[(c[k>>2]|0)+8>>2]&31](k)|0;c[f>>2]=12580;c[f+4>>2]=h;c[f+8>>2]=g;Kh(12444,f)}else{c[e>>2]=12580;c[e+4>>2]=h;Kh(12489,e)}}Kh(12568,b)}function Jh(){var a=0,b=0;a=Ka;Ka=Ka+16|0;if((Ka|0)>=(La|0))A(16);if(!(Ha(18788,3)|0)){b=Fa(c[4698]|0)|0;Ka=a;return b|0}else Kh(12719,a);return 0}function Kh(a,b){a=a|0;b=b|0;var d=0,e=0;d=Ka;Ka=Ka+16|0;if((Ka|0)>=(La|0))A(16);e=d;c[e>>2]=b;b=c[1286]|0;yg(b,a,e)|0;_g(10,b)|0;wa()}function Lh(a){a=a|0;return}function Mh(a){a=a|0;Lh(a);kh(a);return}function Nh(a){a=a|0;return}function Oh(a){a=a|0;return}function Ph(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0;e=Ka;Ka=Ka+64|0;if((Ka|0)>=(La|0))A(64);f=e;if(!(Th(a,b,0)|0))if((b|0)!=0?(g=Xh(b,3856,3840,0)|0,(g|0)!=0):0){b=f+4|0;h=b+52|0;do{c[b>>2]=0;b=b+4|0}while((b|0)<(h|0));c[f>>2]=g;c[f+8>>2]=a;c[f+12>>2]=-1;c[f+48>>2]=1;Xa[c[(c[g>>2]|0)+28>>2]&15](g,f,c[d>>2]|0,1);if((c[f+24>>2]|0)==1){c[d>>2]=c[f+16>>2];i=1}else i=0;j=i}else j=0;else j=1;Ka=e;return j|0}function Qh(a,b,d,e,f,g){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;if(Th(a,c[b+8>>2]|0,g)|0)Wh(0,b,d,e,f);return}function Rh(b,d,e,f,g){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0;do if(!(Th(b,c[d+8>>2]|0,g)|0)){if(Th(b,c[d>>2]|0,g)|0){if((c[d+16>>2]|0)!=(e|0)?(h=d+20|0,(c[h>>2]|0)!=(e|0)):0){c[d+32>>2]=f;c[h>>2]=e;h=d+40|0;c[h>>2]=(c[h>>2]|0)+1;if((c[d+36>>2]|0)==1?(c[d+24>>2]|0)==2:0)a[d+54>>0]=1;c[d+44>>2]=4;break}if((f|0)==1)c[d+32>>2]=1}}else Vh(0,d,e,f);while(0);return}function Sh(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;if(Th(a,c[b+8>>2]|0,0)|0)Uh(0,b,d,e);return}function Th(a,b,c){a=a|0;b=b|0;c=c|0;return (a|0)==(b|0)|0}function Uh(b,d,e,f){b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0;b=d+16|0;g=c[b>>2]|0;do if(g){if((g|0)!=(e|0)){h=d+36|0;c[h>>2]=(c[h>>2]|0)+1;c[d+24>>2]=2;a[d+54>>0]=1;break}h=d+24|0;if((c[h>>2]|0)==2)c[h>>2]=f}else{c[b>>2]=e;c[d+24>>2]=f;c[d+36>>2]=1}while(0);return}function Vh(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;if((c[b+4>>2]|0)==(d|0)?(d=b+28|0,(c[d>>2]|0)!=1):0)c[d>>2]=e;return}function Wh(b,d,e,f,g){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0;a[d+53>>0]=1;do if((c[d+4>>2]|0)==(f|0)){a[d+52>>0]=1;b=d+16|0;h=c[b>>2]|0;if(!h){c[b>>2]=e;c[d+24>>2]=g;c[d+36>>2]=1;if(!((g|0)==1?(c[d+48>>2]|0)==1:0))break;a[d+54>>0]=1;break}if((h|0)!=(e|0)){h=d+36|0;c[h>>2]=(c[h>>2]|0)+1;a[d+54>>0]=1;break}h=d+24|0;b=c[h>>2]|0;if((b|0)==2){c[h>>2]=g;i=g}else i=b;if((i|0)==1?(c[d+48>>2]|0)==1:0)a[d+54>>0]=1}while(0);return}function Xh(d,e,f,g){d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0;h=Ka;Ka=Ka+64|0;if((Ka|0)>=(La|0))A(64);i=h;j=c[d>>2]|0;k=d+(c[j+-8>>2]|0)|0;l=c[j+-4>>2]|0;c[i>>2]=f;c[i+4>>2]=d;c[i+8>>2]=e;c[i+12>>2]=g;g=i+16|0;e=i+20|0;d=i+24|0;j=i+28|0;m=i+32|0;n=i+40|0;o=g;p=o+36|0;do{c[o>>2]=0;o=o+4|0}while((o|0)<(p|0));b[g+36>>1]=0;a[g+38>>0]=0;a:do if(Th(l,f,0)|0){c[i+48>>2]=1;Za[c[(c[l>>2]|0)+20>>2]&3](l,i,k,k,1,0);q=(c[d>>2]|0)==1?k:0}else{Ya[c[(c[l>>2]|0)+24>>2]&15](l,i,k,1,0);switch(c[i+36>>2]|0){case 0:{q=(c[n>>2]|0)==1&(c[j>>2]|0)==1&(c[m>>2]|0)==1?c[e>>2]|0:0;break a;break}case 1:break;default:{q=0;break a}}if((c[d>>2]|0)!=1?!((c[n>>2]|0)==0&(c[j>>2]|0)==1&(c[m>>2]|0)==1):0){q=0;break}q=c[g>>2]|0}while(0);Ka=h;return q|0}function Yh(a){a=a|0;Lh(a);kh(a);return}function Zh(a,b,d,e,f,g){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0;if(Th(a,c[b+8>>2]|0,g)|0)Wh(0,b,d,e,f);else{h=c[a+8>>2]|0;Za[c[(c[h>>2]|0)+20>>2]&3](h,b,d,e,f,g)}return}function _h(b,d,e,f,g){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0;do if(!(Th(b,c[d+8>>2]|0,g)|0)){if(!(Th(b,c[d>>2]|0,g)|0)){h=c[b+8>>2]|0;Ya[c[(c[h>>2]|0)+24>>2]&15](h,d,e,f,g);break}if((c[d+16>>2]|0)!=(e|0)?(h=d+20|0,(c[h>>2]|0)!=(e|0)):0){c[d+32>>2]=f;i=d+44|0;if((c[i>>2]|0)==4)break;j=d+52|0;a[j>>0]=0;k=d+53|0;a[k>>0]=0;l=c[b+8>>2]|0;Za[c[(c[l>>2]|0)+20>>2]&3](l,d,e,e,1,g);if(a[k>>0]|0)if(!(a[j>>0]|0)){m=1;n=11}else n=15;else{m=0;n=11}do if((n|0)==11){c[h>>2]=e;j=d+40|0;c[j>>2]=(c[j>>2]|0)+1;if((c[d+36>>2]|0)==1?(c[d+24>>2]|0)==2:0){a[d+54>>0]=1;if(m){n=15;break}else{o=4;break}}if(m)n=15;else o=4}while(0);if((n|0)==15)o=3;c[i>>2]=o;break}if((f|0)==1)c[d+32>>2]=1}else Vh(0,d,e,f);while(0);return}function $h(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0;if(Th(a,c[b+8>>2]|0,0)|0)Uh(0,b,d,e);else{f=c[a+8>>2]|0;Xa[c[(c[f>>2]|0)+28>>2]&15](f,b,d,e)}return}function ai(a){a=a|0;return}function bi(){var a=0;a=Ka;Ka=Ka+16|0;if((Ka|0)>=(La|0))A(16);if(!(Ga(18792,87)|0)){Ka=a;return}else Kh(12768,a)}function ci(a){a=a|0;var b=0;b=Ka;Ka=Ka+16|0;if((Ka|0)>=(La|0))A(16);bh(a);if(!(Ia(c[4698]|0,0)|0)){Ka=b;return}else Kh(12818,b)}function di(){var a=0,b=0;a=Jh()|0;if((a|0?(b=c[a>>2]|0,b|0):0)?(a=b+48|0,(c[a>>2]&-256|0)==1126902528?(c[a+4>>2]|0)==1129074247:0):0)ei(c[b+12>>2]|0);ei(fi()|0)}function ei(a){a=a|0;var b=0;b=Ka;Ka=Ka+16|0;if((Ka|0)>=(La|0))A(16);Ra[a&3]();Kh(12871,b)}function fi(){var a=0;a=c[1448]|0;c[1448]=a+0;return a|0}function gi(a){a=a|0;return}function hi(a){a=a|0;c[a>>2]=5884;li(a+4|0);return}function ii(a){a=a|0;hi(a);kh(a);return}function ji(a){a=a|0;return ki(a+4|0)|0}function ki(a){a=a|0;return c[a>>2]|0}function li(a){a=a|0;var b=0,d=0;if(qh(a)|0?(b=mi(c[a>>2]|0)|0,a=b+8|0,d=c[a>>2]|0,c[a>>2]=d+-1,(d+-1|0)<0):0)kh(b);return}function mi(a){a=a|0;return a+-12|0}function ni(a){a=a|0;hi(a);kh(a);return}function oi(a){a=a|0;hi(a);kh(a);return}function pi(a){a=a|0;Lh(a);kh(a);return}function qi(b,d,e,f,g,h){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;h=h|0;var i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0;if(Th(b,c[d+8>>2]|0,h)|0)Wh(0,d,e,f,g);else{i=d+52|0;j=a[i>>0]|0;k=d+53|0;l=a[k>>0]|0;m=c[b+12>>2]|0;n=b+16+(m<<3)|0;a[i>>0]=0;a[k>>0]=0;ui(b+16|0,d,e,f,g,h);a:do if((m|0)>1){o=d+24|0;p=b+8|0;q=d+54|0;r=b+24|0;do{if(a[q>>0]|0)break a;if(!(a[i>>0]|0)){if(a[k>>0]|0?(c[p>>2]&1|0)==0:0)break a}else{if((c[o>>2]|0)==1)break a;if(!(c[p>>2]&2))break a}a[i>>0]=0;a[k>>0]=0;ui(r,d,e,f,g,h);r=r+8|0}while(r>>>0<n>>>0)}while(0);a[i>>0]=j;a[k>>0]=l}return}function ri(b,d,e,f,g){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0;a:do if(!(Th(b,c[d+8>>2]|0,g)|0)){if(!(Th(b,c[d>>2]|0,g)|0)){h=c[b+12>>2]|0;i=b+16+(h<<3)|0;vi(b+16|0,d,e,f,g);j=b+24|0;if((h|0)<=1)break;h=c[b+8>>2]|0;if((h&2|0)==0?(k=d+36|0,(c[k>>2]|0)!=1):0){if(!(h&1)){h=d+54|0;l=j;while(1){if(a[h>>0]|0)break a;if((c[k>>2]|0)==1)break a;vi(l,d,e,f,g);l=l+8|0;if(l>>>0>=i>>>0)break a}}l=d+24|0;h=d+54|0;m=j;while(1){if(a[h>>0]|0)break a;if((c[k>>2]|0)==1?(c[l>>2]|0)==1:0)break a;vi(m,d,e,f,g);m=m+8|0;if(m>>>0>=i>>>0)break a}}m=d+54|0;l=j;while(1){if(a[m>>0]|0)break a;vi(l,d,e,f,g);l=l+8|0;if(l>>>0>=i>>>0)break a}}if((c[d+16>>2]|0)!=(e|0)?(i=d+20|0,(c[i>>2]|0)!=(e|0)):0){c[d+32>>2]=f;l=d+44|0;if((c[l>>2]|0)==4)break;m=b+16+(c[b+12>>2]<<3)|0;j=d+52|0;k=d+53|0;h=d+54|0;n=b+8|0;o=d+24|0;p=0;q=b+16|0;r=0;b:while(1){if(q>>>0>=m>>>0){s=p;t=18;break}a[j>>0]=0;a[k>>0]=0;ui(q,d,e,e,1,g);if(a[h>>0]|0){s=p;t=18;break}do if(a[k>>0]|0){if(!(a[j>>0]|0))if(!(c[n>>2]&1)){s=1;t=18;break b}else{u=1;v=r;break}if((c[o>>2]|0)==1){t=23;break b}if(!(c[n>>2]&2)){t=23;break b}else{u=1;v=1}}else{u=p;v=r}while(0);p=u;q=q+8|0;r=v}do if((t|0)==18){if((!r?(c[i>>2]=e,q=d+40|0,c[q>>2]=(c[q>>2]|0)+1,(c[d+36>>2]|0)==1):0)?(c[o>>2]|0)==2:0){a[h>>0]=1;if(s){t=23;break}else{w=4;break}}if(s)t=23;else w=4}while(0);if((t|0)==23)w=3;c[l>>2]=w;break}if((f|0)==1)c[d+32>>2]=1}else Vh(0,d,e,f);while(0);return}function si(b,d,e,f){b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0;a:do if(!(Th(b,c[d+8>>2]|0,0)|0)){g=c[b+12>>2]|0;h=b+16+(g<<3)|0;ti(b+16|0,d,e,f);if((g|0)>1){g=d+54|0;i=b+24|0;do{ti(i,d,e,f);if(a[g>>0]|0)break a;i=i+8|0}while(i>>>0<h>>>0)}}else Uh(0,d,e,f);while(0);return}function ti(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0;f=c[a+4>>2]|0;g=f>>8;if(!(f&1))h=g;else h=c[(c[d>>2]|0)+g>>2]|0;g=c[a>>2]|0;Xa[c[(c[g>>2]|0)+28>>2]&15](g,b,d+h|0,(f&2|0)==0?2:e);return}function ui(a,b,d,e,f,g){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0,j=0;h=c[a+4>>2]|0;i=h>>8;if(!(h&1))j=i;else j=c[(c[e>>2]|0)+i>>2]|0;i=c[a>>2]|0;Za[c[(c[i>>2]|0)+20>>2]&3](i,b,d,e+j|0,(h&2|0)==0?2:f,g);return}function vi(a,b,d,e,f){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0;g=c[a+4>>2]|0;h=g>>8;if(!(g&1))i=h;else i=c[(c[d>>2]|0)+h>>2]|0;h=c[a>>2]|0;Ya[c[(c[h>>2]|0)+24>>2]&15](h,b,d+i|0,(g&2|0)==0?2:e,f);return}function wi(b){b=b|0;var c=0;if((a[b>>0]|0)==1)c=0;else{a[b>>0]=1;c=1}return c|0}function xi(a){a=a|0;return}function yi(a){a=a|0;return}function zi(){var a=0;a=c[4699]|0;c[4699]=a+0;return a|0}function Ai(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0;e=Ka;Ka=Ka+16|0;if((Ka|0)>=(La|0))A(16);f=e;c[f>>2]=c[d>>2];g=Pa[c[(c[a>>2]|0)+16>>2]&15](a,b,f)|0;if(g)c[d>>2]=c[f>>2];Ka=e;return g&1|0}function Bi(a){a=a|0;var b=0;if(!a)b=0;else b=(Xh(a,3856,3960,0)|0)!=0&1;return b|0}function Ci(a,b){a=a|0;b=b|0;var c=0,d=0,e=0,f=0;c=a&65535;d=b&65535;e=v(d,c)|0;f=a>>>16;a=(e>>>16)+(v(d,f)|0)|0;d=b>>>16;b=v(d,c)|0;return (y((a>>>16)+(v(d,f)|0)+(((a&65535)+b|0)>>>16)|0),a+b<<16|e&65535|0)|0}function Di(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;var e=0,f=0;e=a;a=c;c=Ci(e,a)|0;f=z()|0;return (y((v(b,a)|0)+(v(d,e)|0)+f|f&0|0),c|0|0)|0}function Ei(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;var e=0;e=a+c>>>0;return (y(b+d+(e>>>0<a>>>0|0)>>>0|0),e|0)|0}function Fi(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;var e=0;e=b-d>>>0;e=b-d-(c>>>0>a>>>0|0)>>>0;return (y(e|0),a-c>>>0|0)|0}function Gi(a){a=a|0;return (a?31-(w(a^a-1)|0)|0:32)|0}function Hi(a,b,d,e,f){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,x=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0;g=a;h=b;i=h;j=d;k=e;l=k;if(!i){m=(f|0)!=0;if(!l){if(m){c[f>>2]=(g>>>0)%(j>>>0);c[f+4>>2]=0}n=0;o=(g>>>0)/(j>>>0)>>>0;return (y(n|0),o)|0}else{if(!m){n=0;o=0;return (y(n|0),o)|0}c[f>>2]=a|0;c[f+4>>2]=b&0;n=0;o=0;return (y(n|0),o)|0}}m=(l|0)==0;do if(j){if(!m){p=(w(l|0)|0)-(w(i|0)|0)|0;if(p>>>0<=31){q=p+1|0;r=31-p|0;s=p-31>>31;t=q;u=g>>>(q>>>0)&s|i<<r;v=i>>>(q>>>0)&s;x=0;A=g<<r;break}if(!f){n=0;o=0;return (y(n|0),o)|0}c[f>>2]=a|0;c[f+4>>2]=h|b&0;n=0;o=0;return (y(n|0),o)|0}r=j-1|0;if(r&j|0){s=(w(j|0)|0)+33-(w(i|0)|0)|0;q=64-s|0;p=32-s|0;B=p>>31;C=s-32|0;D=C>>31;t=s;u=p-1>>31&i>>>(C>>>0)|(i<<p|g>>>(s>>>0))&D;v=D&i>>>(s>>>0);x=g<<q&B;A=(i<<q|g>>>(C>>>0))&B|g<<p&s-33>>31;break}if(f|0){c[f>>2]=r&g;c[f+4>>2]=0}if((j|0)==1){n=h|b&0;o=a|0|0;return (y(n|0),o)|0}else{r=Gi(j|0)|0;n=i>>>(r>>>0)|0;o=i<<32-r|g>>>(r>>>0)|0;return (y(n|0),o)|0}}else{if(m){if(f|0){c[f>>2]=(i>>>0)%(j>>>0);c[f+4>>2]=0}n=0;o=(i>>>0)/(j>>>0)>>>0;return (y(n|0),o)|0}if(!g){if(f|0){c[f>>2]=0;c[f+4>>2]=(i>>>0)%(l>>>0)}n=0;o=(i>>>0)/(l>>>0)>>>0;return (y(n|0),o)|0}r=l-1|0;if(!(r&l)){if(f|0){c[f>>2]=a|0;c[f+4>>2]=r&i|b&0}n=0;o=i>>>((Gi(l|0)|0)>>>0);return (y(n|0),o)|0}r=(w(l|0)|0)-(w(i|0)|0)|0;if(r>>>0<=30){s=r+1|0;p=31-r|0;t=s;u=i<<p|g>>>(s>>>0);v=i>>>(s>>>0);x=0;A=g<<p;break}if(!f){n=0;o=0;return (y(n|0),o)|0}c[f>>2]=a|0;c[f+4>>2]=h|b&0;n=0;o=0;return (y(n|0),o)|0}while(0);if(!t){E=A;F=x;G=v;H=u;I=0;J=0}else{b=d|0|0;d=k|e&0;e=Ei(b|0,d|0,-1,-1)|0;k=z()|0;h=A;A=x;x=v;v=u;u=t;t=0;do{a=h;h=A>>>31|h<<1;A=t|A<<1;g=v<<1|a>>>31|0;a=v>>>31|x<<1|0;Fi(e|0,k|0,g|0,a|0)|0;i=z()|0;l=i>>31|((i|0)<0?-1:0)<<1;t=l&1;v=Fi(g|0,a|0,l&b|0,(((i|0)<0?-1:0)>>31|((i|0)<0?-1:0)<<1)&d|0)|0;x=z()|0;u=u-1|0}while((u|0)!=0);E=h;F=A;G=x;H=v;I=0;J=t}t=F;F=0;if(f|0){c[f>>2]=H;c[f+4>>2]=G}n=(t|0)>>>31|(E|F)<<1|(F<<1|t>>>31)&0|I;o=(t<<1|0>>>31)&-2|J;return (y(n|0),o)|0}function Ii(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;return Hi(a,b,c,d,0)|0}function Ji(a,b,c){a=a|0;b=b|0;c=c|0;if((c|0)<32){y(b>>>c|0);return a>>>c|(b&(1<<c)-1)<<32-c}y(0);return b>>>c-32|0}function Ki(a,b,c){a=a|0;b=b|0;c=c|0;if((c|0)<32){y(b<<c|(a&(1<<c)-1<<32-c)>>>32-c|0);return a<<c}y(a<<c-32|0);return 0}function Li(a){a=a|0;return (a&255)<<24|(a>>8&255)<<16|(a>>16&255)<<8|a>>>24|0}function Mi(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0;if((e|0)>=8192){za(b|0,d|0,e|0)|0;return b|0}f=b|0;g=b+e|0;if((b&3)==(d&3)){while(b&3){if(!e)return f|0;a[b>>0]=a[d>>0]|0;b=b+1|0;d=d+1|0;e=e-1|0}h=g&-4|0;e=h-64|0;while((b|0)<=(e|0)){c[b>>2]=c[d>>2];c[b+4>>2]=c[d+4>>2];c[b+8>>2]=c[d+8>>2];c[b+12>>2]=c[d+12>>2];c[b+16>>2]=c[d+16>>2];c[b+20>>2]=c[d+20>>2];c[b+24>>2]=c[d+24>>2];c[b+28>>2]=c[d+28>>2];c[b+32>>2]=c[d+32>>2];c[b+36>>2]=c[d+36>>2];c[b+40>>2]=c[d+40>>2];c[b+44>>2]=c[d+44>>2];c[b+48>>2]=c[d+48>>2];c[b+52>>2]=c[d+52>>2];c[b+56>>2]=c[d+56>>2];c[b+60>>2]=c[d+60>>2];b=b+64|0;d=d+64|0}while((b|0)<(h|0)){c[b>>2]=c[d>>2];b=b+4|0;d=d+4|0}}else{h=g-4|0;while((b|0)<(h|0)){a[b>>0]=a[d>>0]|0;a[b+1>>0]=a[d+1>>0]|0;a[b+2>>0]=a[d+2>>0]|0;a[b+3>>0]=a[d+3>>0]|0;b=b+4|0;d=d+4|0}}while((b|0)<(g|0)){a[b>>0]=a[d>>0]|0;b=b+1|0;d=d+1|0}return f|0}function Ni(b,c,d){b=b|0;c=c|0;d=d|0;var e=0;if((c|0)<(b|0)&(b|0)<(c+d|0)){e=b;c=c+d|0;b=b+d|0;while((d|0)>0){b=b-1|0;c=c-1|0;d=d-1|0;a[b>>0]=a[c>>0]|0}b=e}else Mi(b,c,d)|0;return b|0}function Oi(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0;f=b+e|0;d=d&255;if((e|0)>=67){while(b&3){a[b>>0]=d;b=b+1|0}g=f&-4|0;h=d|d<<8|d<<16|d<<24;i=g-64|0;while((b|0)<=(i|0)){c[b>>2]=h;c[b+4>>2]=h;c[b+8>>2]=h;c[b+12>>2]=h;c[b+16>>2]=h;c[b+20>>2]=h;c[b+24>>2]=h;c[b+28>>2]=h;c[b+32>>2]=h;c[b+36>>2]=h;c[b+40>>2]=h;c[b+44>>2]=h;c[b+48>>2]=h;c[b+52>>2]=h;c[b+56>>2]=h;c[b+60>>2]=h;b=b+64|0}while((b|0)<(g|0)){c[b>>2]=h;b=b+4|0}}while((b|0)<(f|0)){a[b>>0]=d;b=b+1|0}return f-e|0}function Pi(a){a=a|0;var b=0,d=0;b=c[i>>2]|0;d=b+a|0;if((a|0)>0&(d|0)<(b|0)|(d|0)<0){Ja(d|0)|0;na(12);return -1}if((d|0)>(xa()|0)){if(!(Aa(d|0)|0)){na(12);return -1}}else c[i>>2]=d;return b|0}function Qi(a,b){a=a|0;b=b|0;return Na[a&31](b|0)|0}function Ri(a,b,c){a=a|0;b=b|0;c=c|0;return Oa[a&31](b|0,c|0)|0}function Si(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;return Pa[a&15](b|0,c|0,d|0)|0}function Ti(a,b,c,d,e){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;return Qa[a&7](b|0,c|0,d|0,e|0)|0}function Ui(a){a=a|0;Ra[a&3]()}function Vi(a,b){a=a|0;b=b|0;Sa[a&127](b|0)}function Wi(a,b,c,d){a=a|0;b=b|0;c=+c;d=d|0;Ta[a&1](b|0,+c,d|0)}function Xi(a,b,c){a=a|0;b=b|0;c=c|0;Ua[a&31](b|0,c|0)}function Yi(a,b,c,d){a=a|0;b=b|0;c=c|0;d=+d;Va[a&3](b|0,c|0,+d)}function Zi(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;Wa[a&7](b|0,c|0,d|0)}function _i(a,b,c,d,e){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;Xa[a&15](b|0,c|0,d|0,e|0)}function $i(a,b,c,d,e,f){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;f=f|0;Ya[a&15](b|0,c|0,d|0,e|0,f|0)}function aj(a,b,c,d,e,f,g){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;f=f|0;g=g|0;Za[a&3](b|0,c|0,d|0,e|0,f|0,g|0)}function bj(a){a=a|0;B(0);return 0}function cj(a){a=a|0;B(19);return 0}function dj(a){a=a|0;B(20);return 0}function ej(a){a=a|0;B(21);return 0}function fj(a){a=a|0;B(22);return 0}function gj(a){a=a|0;B(23);return 0}function hj(a){a=a|0;B(24);return 0}function ij(a){a=a|0;B(25);return 0}function jj(a){a=a|0;B(26);return 0}function kj(a){a=a|0;B(27);return 0}function lj(a){a=a|0;B(28);return 0}function mj(a){a=a|0;B(29);return 0}function nj(a){a=a|0;B(30);return 0}function oj(a){a=a|0;B(31);return 0}function pj(a,b){a=a|0;b=b|0;C(0);return 0}function qj(a,b){a=a|0;b=b|0;C(26);return 0}function rj(a,b){a=a|0;b=b|0;C(27);return 0}function sj(a,b){a=a|0;b=b|0;C(28);return 0}function tj(a,b){a=a|0;b=b|0;C(29);return 0}function uj(a,b){a=a|0;b=b|0;C(30);return 0}function vj(a,b){a=a|0;b=b|0;C(31);return 0}function wj(a,b,c){a=a|0;b=b|0;c=c|0;D(0);return 0}function xj(a,b,c){a=a|0;b=b|0;c=c|0;D(10);return 0}function yj(a,b,c){a=a|0;b=b|0;c=c|0;D(11);return 0}function zj(a,b,c){a=a|0;b=b|0;c=c|0;D(12);return 0}function Aj(a,b,c){a=a|0;b=b|0;c=c|0;D(13);return 0}function Bj(a,b,c){a=a|0;b=b|0;c=c|0;D(14);return 0}function Cj(a,b,c){a=a|0;b=b|0;c=c|0;D(15);return 0}function Dj(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;E(0);return 0}function Ej(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;E(5);return 0}function Fj(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;E(6);return 0}function Gj(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;E(7);return 0}function Hj(){F(0)}function Ij(a){a=a|0;G(0)}function Jj(a){a=a|0;G(88)}function Kj(a){a=a|0;G(89)}function Lj(a){a=a|0;G(90)}function Mj(a){a=a|0;G(91)}function Nj(a){a=a|0;G(92)}function Oj(a){a=a|0;G(93)}function Pj(a){a=a|0;G(94)}function Qj(a){a=a|0;G(95)}function Rj(a){a=a|0;G(96)}function Sj(a){a=a|0;G(97)}function Tj(a){a=a|0;G(98)}function Uj(a){a=a|0;G(99)}function Vj(a){a=a|0;G(100)}function Wj(a){a=a|0;G(101)}function Xj(a){a=a|0;G(102)}function Yj(a){a=a|0;G(103)}function Zj(a){a=a|0;G(104)}function _j(a){a=a|0;G(105)}function $j(a){a=a|0;G(106)}function ak(a){a=a|0;G(107)}function bk(a){a=a|0;G(108)}function ck(a){a=a|0;G(109)}function dk(a){a=a|0;G(110)}function ek(a){a=a|0;G(111)}function fk(a){a=a|0;G(112)}function gk(a){a=a|0;G(113)}function hk(a){a=a|0;G(114)}function ik(a){a=a|0;G(115)}function jk(a){a=a|0;G(116)}function kk(a){a=a|0;G(117)}function lk(a){a=a|0;G(118)}function mk(a){a=a|0;G(119)}function nk(a){a=a|0;G(120)}function ok(a){a=a|0;G(121)}function pk(a){a=a|0;G(122)}function qk(a){a=a|0;G(123)}function rk(a){a=a|0;G(124)}function sk(a){a=a|0;G(125)}function tk(a){a=a|0;G(126)}function uk(a){a=a|0;G(127)}function vk(a,b,c){a=a|0;b=+b;c=c|0;H(0)}function wk(a,b){a=a|0;b=b|0;I(0)}function xk(a,b){a=a|0;b=b|0;I(19)}function yk(a,b){a=a|0;b=b|0;I(20)}function zk(a,b){a=a|0;b=b|0;I(21)}function Ak(a,b){a=a|0;b=b|0;I(22)}function Bk(a,b){a=a|0;b=b|0;I(23)}function Ck(a,b){a=a|0;b=b|0;I(24)}function Dk(a,b){a=a|0;b=b|0;I(25)}function Ek(a,b){a=a|0;b=b|0;I(26)}function Fk(a,b){a=a|0;b=b|0;I(27)}function Gk(a,b){a=a|0;b=b|0;I(28)}function Hk(a,b){a=a|0;b=b|0;I(29)}function Ik(a,b){a=a|0;b=b|0;I(30)}function Jk(a,b){a=a|0;b=b|0;I(31)}function Kk(a,b,c){a=a|0;b=b|0;c=+c;J(0)}function Lk(a,b,c){a=a|0;b=b|0;c=+c;J(3)}function Mk(a,b,c){a=a|0;b=b|0;c=c|0;K(0)}function Nk(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;L(0)}function Ok(a,b,c,d,e){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;M(0)}function Pk(a,b,c,d,e){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;M(12)}function Qk(a,b,c,d,e){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;M(13)}function Rk(a,b,c,d,e){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;M(14)}function Sk(a,b,c,d,e){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;M(15)}function Tk(a,b,c,d,e,f){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;f=f|0;N(0)}

// EMSCRIPTEN_END_FUNCS
var Na=[bj,oc,uc,zc,Dc,Fc,ad,gd,Fd,Ld,Td,Zd,be,he,Kf,Qf,_f,eh,ji,cj,dj,ej,fj,gj,hj,ij,jj,kj,lj,mj,nj,oj];var Oa=[pj,Ib,Qb,Xb,hc,tc,Ec,Nc,Yc,fd,nd,wd,Bd,Kd,Yd,ge,ve,De,Ie,Qe,Ye,ef,of,wf,Gf,Pf,qj,rj,sj,tj,uj,vj];var Pa=[wj,Ce,Pe,df,vf,$f,ag,eg,Vg,Ph,xj,yj,zj,Aj,Bj,Cj];var Qa=[Dj,xe,Ke,_e,qf,Ej,Fj,Gj];var Ra=[Hj,Ih,hb,bi];var Sa=[Ij,hh,Gb,Hb,Jb,Ob,Pb,Rb,Vb,Wb,Yb,fc,gc,ic,mc,nc,qc,rc,xc,yc,Bc,Cc,Lc,Mc,Oc,Wc,Xc,Zc,_c,$c,cd,dd,ld,md,od,ud,vd,xd,zd,Ad,Cd,vc,Ed,Hd,Id,Sd,Vd,Wd,ae,de,ee,te,ue,we,Ee,Ge,He,Je,Re,We,Xe,Ze,ff,mf,nf,pf,xf,Ef,Ff,Hf,Rf,Jf,Mf,Nf,Of,ch,dh,Lh,Mh,Nh,Oh,Yh,hi,ii,ni,oi,pi,ci,Jj,Kj,Lj,Mj,Nj,Oj,Pj,Qj,Rj,Sj,Tj,Uj,Vj,Wj,Xj,Yj,Zj,_j,$j,ak,bk,ck,dk,ek,fk,gk,hk,ik,jk,kk,lk,mk,nk,ok,pk,qk,rk,sk,tk,uk];var Ta=[vk,vb];var Ua=[wk,wb,xb,pc,sc,Ac,bd,ed,Gd,Jd,Ud,Xd,ce,fe,ze,Me,af,sf,Lf,xk,yk,zk,Ak,Bk,Ck,Dk,Ek,Fk,Gk,Hk,Ik,Jk];var Va=[Kk,pd,qd,Lk];var Wa=[Mk,yb,zb,Zb,ye,Le,$e,rf];var Xa=[Nk,Ab,Bb,Kb,Lb,Sb,Tb,_b,$b,Ic,Jc,Pc,Qc,Sh,$h,si];var Ya=[Ok,Ae,Be,Ne,Oe,bf,cf,tf,uf,Rh,_h,ri,Pk,Qk,Rk,Sk];var Za=[Tk,Qh,Zh,qi];return{__GLOBAL__sub_I_main_cpp:Zf,___cxa_can_catch:Ai,___cxa_is_pointer_type:Bi,___em_js__getCanvasHeight:db,___em_js__getCanvasWidth:cb,___errno_location:cg,___muldi3:Di,___udivdi3:Ii,_bitshift64Lshr:Ji,_bitshift64Shl:Ki,_fflush:vg,_free:bh,_i64Add:Ei,_i64Subtract:Fi,_llvm_bswap_i32:Li,_main:ib,_malloc:ah,_memcpy:Mi,_memmove:Ni,_memset:Oi,_sbrk:Pi,dynCall_ii:Qi,dynCall_iii:Ri,dynCall_iiii:Si,dynCall_iiiii:Ti,dynCall_v:Ui,dynCall_vi:Vi,dynCall_vidi:Wi,dynCall_vii:Xi,dynCall_viid:Yi,dynCall_viii:Zi,dynCall_viiii:_i,dynCall_viiiii:$i,dynCall_viiiiii:aj,establishStackSpace:bb,stackAlloc:_a,stackRestore:ab,stackSave:$a}})


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

var real__memmove = asm["_memmove"];

asm["_memmove"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real__memmove.apply(null, arguments);
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

var _memmove = Module["_memmove"] = asm["_memmove"];

var _memset = Module["_memset"] = asm["_memset"];

var _sbrk = Module["_sbrk"] = asm["_sbrk"];

var establishStackSpace = Module["establishStackSpace"] = asm["establishStackSpace"];

var stackAlloc = Module["stackAlloc"] = asm["stackAlloc"];

var stackRestore = Module["stackRestore"] = asm["stackRestore"];

var stackSave = Module["stackSave"] = asm["stackSave"];

var dynCall_ii = Module["dynCall_ii"] = asm["dynCall_ii"];

var dynCall_iii = Module["dynCall_iii"] = asm["dynCall_iii"];

var dynCall_iiii = Module["dynCall_iiii"] = asm["dynCall_iiii"];

var dynCall_iiiii = Module["dynCall_iiiii"] = asm["dynCall_iiiii"];

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
  var flush = Module["_fflush"];
  if (flush) flush(0);
  var hasFS = true;
  if (hasFS) {
   [ "stdout", "stderr" ].forEach(function(name) {
    var info = FS.analyzePath("/dev/" + name);
    if (!info) return;
    var stream = info.object;
    var rdev = stream.rdev;
    var tty = TTY.ttys[rdev];
    if (tty && tty.output && tty.output.length) {
     has = true;
    }
   });
  }
 } catch (e) {}
 out = print;
 err = printErr;
 if (has) {
  warnOnce("stdio streams had content in them that was not flushed. you should set EXIT_RUNTIME to 1 (see the FAQ), or make sure to emit a newline when you printf etc.");
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

