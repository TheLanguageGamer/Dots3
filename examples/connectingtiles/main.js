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

var STACK_BASE = 14880, STACK_MAX = 5257760, DYNAMIC_BASE = 5257760, DYNAMICTOP_PTR = 14624;

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

var tempDoublePtr = 14864;

assert(tempDoublePtr % 8 == 0);

var Engine = {
 ctx: null,
 IMAGE_FOLDER: "../../images/",
 images: {},
 mode: 0,
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

var debug_table_ii = [ "0", "__ZNKSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlvE_NS_9allocatorIS4_EEFP9ComponentvEE7__cloneEv", "__ZNSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlvE_NS_9allocatorIS4_EEFP9ComponentvEEclEv", "__ZNKSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlvE_NS_9allocatorIS4_EEFP9ComponentvEE11target_typeEv", "__ZNKSt3__210__function6__funcIZN13ComponentGridC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEE10Vector2IntfNS_8functionIFP9ComponentvEEESE_NSA_IFvSC_jjjEEEEUlvE_NS5_ISH_EEFNS_10shared_ptrISB_EEvEE7__cloneEv", "__ZNKSt3__210__function6__funcIZN13ComponentGridC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEE10Vector2IntfNS_8functionIFP9ComponentvEEESE_NSA_IFvSC_jjjEEEEUlvE_NS5_ISH_EEFNS_10shared_ptrISB_EEvEE11target_typeEv", "__ZNKSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlRK7Vector2E_NS_9allocatorIS7_EEFvS6_EE7__cloneEv", "__ZNKSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlRK7Vector2E_NS_9allocatorIS7_EEFvS6_EE11target_typeEv", "__ZNKSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlRK7Vector2E0_NS_9allocatorIS7_EEFvS6_EE7__cloneEv", "__ZNKSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlRK7Vector2E0_NS_9allocatorIS7_EEFvS6_EE11target_typeEv", "__ZNKSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlRK7Vector2E1_NS_9allocatorIS7_EEFvS6_EE7__cloneEv", "__ZNKSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlRK7Vector2E1_NS_9allocatorIS7_EEFvS6_EE11target_typeEv", "__ZNKSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEE7__cloneEv", "__ZNKSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEE11target_typeEv", "___stdio_close", "__ZNKSt3__217bad_function_call4whatEv", "__ZNKSt11logic_error4whatEv", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0" ];

var debug_table_iii = [ "0", "__ZNKSt3__220__shared_ptr_pointerIP18ColorConfigurationNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZN18ColorConfiguration20shouldAcceptSelectedENSt3__26vectorINS0_10shared_ptrI13ComponentCellEENS0_9allocatorIS4_EEEE", "__ZNKSt3__220__shared_ptr_pointerIP21SpellingConfigurationNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZN21SpellingConfiguration20shouldAcceptSelectedENSt3__26vectorINS0_10shared_ptrI13ComponentCellEENS0_9allocatorIS4_EEEE", "__ZNKSt3__220__shared_ptr_pointerIP17MathConfigurationNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZN17MathConfiguration20shouldAcceptSelectedENSt3__26vectorINS0_10shared_ptrI13ComponentCellEENS0_9allocatorIS4_EEEE", "__ZNKSt3__220__shared_ptr_pointerIP9ComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP24FilledRectangleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlvE_NS_9allocatorIS4_EEFP9ComponentvEE6targetERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP17FixedCapacityPoolNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__210__function6__funcIZN13ComponentGridC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEE10Vector2IntfNS_8functionIFP9ComponentvEEESE_NSA_IFvSC_jjjEEEEUlvE_NS5_ISH_EEFNS_10shared_ptrISB_EEvEE6targetERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP13ComponentCellNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP17PropertyAnimationNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP13ComponentGridNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlRK7Vector2E_NS_9allocatorIS7_EEFvS6_EE6targetERKSt9type_info", "__ZNKSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlRK7Vector2E0_NS_9allocatorIS7_EEFvS6_EE6targetERKSt9type_info", "__ZNKSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlRK7Vector2E1_NS_9allocatorIS7_EEFvS6_EE6targetERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP24StrokeRectangleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP13TextComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP15ConnectingTilesNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEE6targetERKSt9type_info", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0" ];

var debug_table_iiii = [ "0", "__ZN18ColorConfiguration9canSelectENSt3__26vectorINS0_10shared_ptrI13ComponentCellEENS0_9allocatorIS4_EEEES4_", "__ZN21SpellingConfiguration9canSelectENSt3__26vectorINS0_10shared_ptrI13ComponentCellEENS0_9allocatorIS4_EEEES4_", "__ZN17MathConfiguration9canSelectENSt3__26vectorINS0_10shared_ptrI13ComponentCellEENS0_9allocatorIS4_EEEES4_", "___stdio_write", "___stdio_seek", "___stdout_write", "_sn_write", "__ZNK10__cxxabiv117__class_type_info9can_catchEPKNS_16__shim_type_infoERPv", "0", "0", "0", "0", "0", "0", "0" ];

var debug_table_iiiii = [ "0", "__ZN18ColorConfiguration11chooseStateENSt3__210shared_ptrI13ComponentGridEEjj", "__ZN21SpellingConfiguration11chooseStateENSt3__210shared_ptrI13ComponentGridEEjj", "__ZN17MathConfiguration11chooseStateENSt3__210shared_ptrI13ComponentGridEEjj" ];

var debug_table_v = [ "0", "__ZL25default_terminate_handlerv", "__Z9main_loopv", "__ZN10__cxxabiv112_GLOBAL__N_110construct_Ev" ];

var debug_table_vi = [ "0", "__ZNSt3__214__shared_countD2Ev", "__ZNSt3__220__shared_ptr_pointerIP18ColorConfigurationNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP18ColorConfigurationNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP18ColorConfigurationNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZN18ColorConfiguration16didClearSelectedEv", "__ZNSt3__220__shared_ptr_pointerIP21SpellingConfigurationNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP21SpellingConfigurationNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP21SpellingConfigurationNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZN21SpellingConfiguration16didClearSelectedEv", "__ZNSt3__220__shared_ptr_pointerIP17MathConfigurationNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP17MathConfigurationNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP17MathConfigurationNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZN17MathConfiguration16didClearSelectedEv", "__ZNSt3__220__shared_ptr_pointerIP9ComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP9ComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP9ComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__220__shared_ptr_pointerIP24FilledRectangleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP24FilledRectangleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP24FilledRectangleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__210__function6__baseIFP9ComponentvEED2Ev", "__ZNSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlvE_NS_9allocatorIS4_EEFP9ComponentvEED0Ev", "__ZNSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlvE_NS_9allocatorIS4_EEFP9ComponentvEE7destroyEv", "__ZNSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlvE_NS_9allocatorIS4_EEFP9ComponentvEE18destroy_deallocateEv", "__ZNSt3__220__shared_ptr_pointerIP17FixedCapacityPoolNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP17FixedCapacityPoolNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP17FixedCapacityPoolNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__210__function6__funcIZN13ComponentGridC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEE10Vector2IntfNS_8functionIFP9ComponentvEEESE_NSA_IFvSC_jjjEEEEUlvE_NS5_ISH_EEFNS_10shared_ptrISB_EEvEED2Ev", "__ZNSt3__210__function6__funcIZN13ComponentGridC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEE10Vector2IntfNS_8functionIFP9ComponentvEEESE_NSA_IFvSC_jjjEEEEUlvE_NS5_ISH_EEFNS_10shared_ptrISB_EEvEED0Ev", "__ZNSt3__210__function6__funcIZN13ComponentGridC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEE10Vector2IntfNS_8functionIFP9ComponentvEEESE_NSA_IFvSC_jjjEEEEUlvE_NS5_ISH_EEFNS_10shared_ptrISB_EEvEE7destroyEv", "__ZNSt3__210__function6__funcIZN13ComponentGridC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEE10Vector2IntfNS_8functionIFP9ComponentvEEESE_NSA_IFvSC_jjjEEEEUlvE_NS5_ISH_EEFNS_10shared_ptrISB_EEvEE18destroy_deallocateEv", "__ZNSt3__220__shared_ptr_pointerIP13ComponentCellNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP13ComponentCellNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP13ComponentCellNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__220__shared_ptr_pointerIP17PropertyAnimationNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP17PropertyAnimationNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP17PropertyAnimationNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__220__shared_ptr_pointerIP13ComponentGridNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP13ComponentGridNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP13ComponentGridNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__210__function6__baseIFvRK7Vector2EED2Ev", "__ZNSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlRK7Vector2E_NS_9allocatorIS7_EEFvS6_EED0Ev", "__ZNSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlRK7Vector2E_NS_9allocatorIS7_EEFvS6_EE7destroyEv", "__ZNSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlRK7Vector2E_NS_9allocatorIS7_EEFvS6_EE18destroy_deallocateEv", "__ZNSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlRK7Vector2E0_NS_9allocatorIS7_EEFvS6_EED0Ev", "__ZNSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlRK7Vector2E0_NS_9allocatorIS7_EEFvS6_EE7destroyEv", "__ZNSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlRK7Vector2E0_NS_9allocatorIS7_EEFvS6_EE18destroy_deallocateEv", "__ZNSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlRK7Vector2E1_NS_9allocatorIS7_EEFvS6_EED0Ev", "__ZNSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlRK7Vector2E1_NS_9allocatorIS7_EEFvS6_EE7destroyEv", "__ZNSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlRK7Vector2E1_NS_9allocatorIS7_EEFvS6_EE18destroy_deallocateEv", "__ZNSt3__220__shared_ptr_pointerIP24StrokeRectangleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP24StrokeRectangleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP24StrokeRectangleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__220__shared_ptr_pointerIP13TextComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP13TextComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP13TextComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__220__shared_ptr_pointerIP15ConnectingTilesNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP15ConnectingTilesNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP15ConnectingTilesNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__210__function6__baseIFvvEED2Ev", "__ZNSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEED0Ev", "__ZNSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEE7destroyEv", "__ZNSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEE18destroy_deallocateEv", "__ZNSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEEclEv", "__ZNSt3__217bad_function_callD2Ev", "__ZNSt3__217bad_function_callD0Ev", "__ZN10__cxxabiv116__shim_type_infoD2Ev", "__ZN10__cxxabiv117__class_type_infoD0Ev", "__ZNK10__cxxabiv116__shim_type_info5noop1Ev", "__ZNK10__cxxabiv116__shim_type_info5noop2Ev", "__ZN10__cxxabiv120__si_class_type_infoD0Ev", "__ZNSt11logic_errorD2Ev", "__ZNSt11logic_errorD0Ev", "__ZNSt12length_errorD0Ev", "__ZN10__cxxabiv121__vmi_class_type_infoD0Ev", "__ZN10__cxxabiv112_GLOBAL__N_19destruct_EPv", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0" ];

var debug_table_vidi = [ "0", "__ZN6Screen4loopEfRKNSt3__26vectorIbNS0_9allocatorIbEEEE" ];

var debug_table_vii = [ "0", "__ZN6Screen7onKeyUpEi", "__ZN6Screen9onKeyDownEi", "__ZN18ColorConfiguration14willRemoveCellENSt3__210shared_ptrI13ComponentCellEE", "__ZN21SpellingConfiguration14willRemoveCellENSt3__210shared_ptrI13ComponentCellEE", "__ZN17MathConfiguration14willRemoveCellENSt3__210shared_ptrI13ComponentCellEE", "__ZNKSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlvE_NS_9allocatorIS4_EEFP9ComponentvEE7__cloneEPNS0_6__baseIS9_EE", "__ZNKSt3__210__function6__funcIZN13ComponentGridC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEE10Vector2IntfNS_8functionIFP9ComponentvEEESE_NSA_IFvSC_jjjEEEEUlvE_NS5_ISH_EEFNS_10shared_ptrISB_EEvEE7__cloneEPNS0_6__baseISL_EE", "__ZNSt3__210__function6__funcIZN13ComponentGridC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEE10Vector2IntfNS_8functionIFP9ComponentvEEESE_NSA_IFvSC_jjjEEEEUlvE_NS5_ISH_EEFNS_10shared_ptrISB_EEvEEclEv", "__ZNKSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlRK7Vector2E_NS_9allocatorIS7_EEFvS6_EE7__cloneEPNS0_6__baseISA_EE", "__ZNSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlRK7Vector2E_NS_9allocatorIS7_EEFvS6_EEclES6_", "__ZNKSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlRK7Vector2E0_NS_9allocatorIS7_EEFvS6_EE7__cloneEPNS0_6__baseISA_EE", "__ZNSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlRK7Vector2E0_NS_9allocatorIS7_EEFvS6_EEclES6_", "__ZNKSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlRK7Vector2E1_NS_9allocatorIS7_EEFvS6_EE7__cloneEPNS0_6__baseISA_EE", "__ZNSt3__210__function6__funcIZN15ConnectingTilesC1E8GameModeEUlRK7Vector2E1_NS_9allocatorIS7_EEFvS6_EEclES6_", "__ZNKSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEE7__cloneEPNS0_6__baseIS5_EE" ];

var debug_table_viid = [ "0", "__ZN17PropertyAnimation6onStepERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEEf", "__ZN8Movement6onStepERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEEf", "0" ];

var debug_table_viii = [ "0", "__ZN18ColorConfiguration11didSetStateERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEENS0_10shared_ptrI13ComponentCellEE", "__ZN21SpellingConfiguration11didSetStateERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEENS0_10shared_ptrI13ComponentCellEE", "__ZN17MathConfiguration11didSetStateERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEENS0_10shared_ptrI13ComponentCellEE", "__ZN9Component11setSizeModeERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEENS_8SizeModeE", "__ZN9Component8addChildERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEENS0_10shared_ptrIS_EE", "__ZN13TextComponent11setSizeModeERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEEN9Component8SizeModeE", "0" ];

var debug_table_viiii = [ "0", "__ZN9Component8doLayoutERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN9Component16doLayoutEntitiesERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN24FilledRectangleComponent8doLayoutERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN24FilledRectangleComponent16doLayoutEntitiesERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN25RoundedRectangleComponent8doLayoutERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN25RoundedRectangleComponent16doLayoutEntitiesERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN24StrokeRectangleComponent8doLayoutERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN24StrokeRectangleComponent16doLayoutEntitiesERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN13TextComponent8doLayoutERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN13TextComponent16doLayoutEntitiesERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZNK10__cxxabiv117__class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi", "__ZNK10__cxxabiv120__si_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi", "__ZNK10__cxxabiv121__vmi_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi", "0", "0" ];

var debug_table_viiiii = [ "0", "__ZN18ColorConfiguration11didDeselectERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEENS1_INS0_10shared_ptrI13ComponentCellEENS3_IS9_EEEES9_NS7_I13TextComponentEE", "__ZN18ColorConfiguration9didSelectERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEENS1_INS0_10shared_ptrI13ComponentCellEENS3_IS9_EEEES9_NS7_I13TextComponentEE", "__ZN21SpellingConfiguration11didDeselectERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEENS1_INS0_10shared_ptrI13ComponentCellEENS3_IS9_EEEES9_NS7_I13TextComponentEE", "__ZN21SpellingConfiguration9didSelectERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEENS1_INS0_10shared_ptrI13ComponentCellEENS3_IS9_EEEES9_NS7_I13TextComponentEE", "__ZN17MathConfiguration11didDeselectERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEENS1_INS0_10shared_ptrI13ComponentCellEENS3_IS9_EEEES9_NS7_I13TextComponentEE", "__ZN17MathConfiguration9didSelectERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEENS1_INS0_10shared_ptrI13ComponentCellEENS3_IS9_EEEES9_NS7_I13TextComponentEE", "__ZNK10__cxxabiv117__class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib", "__ZNK10__cxxabiv120__si_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib", "__ZNK10__cxxabiv121__vmi_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib", "0", "0", "0", "0", "0", "0" ];

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
 "w": _Engine_Init,
 "x": _Engine_MeasureTextWidth,
 "y": _Engine_Rectangle,
 "z": _Engine_RoundedRectangle,
 "A": _Engine_SpellCheck,
 "B": _Engine_StrokeEllipse,
 "C": _Engine_StrokeRectangle,
 "D": _SDL_GetTicks,
 "E": _SDL_Init,
 "F": _SDL_LockSurface,
 "G": _SDL_PollEvent,
 "H": _SDL_SetVideoMode,
 "I": __ZSt18uncaught_exceptionv,
 "J": ___cxa_allocate_exception,
 "K": ___cxa_begin_catch,
 "L": ___cxa_find_matching_catch,
 "M": ___cxa_free_exception,
 "N": ___cxa_throw,
 "O": ___gxx_personality_v0,
 "P": ___lock,
 "Q": ___resumeException,
 "R": ___setErrNo,
 "S": ___syscall140,
 "T": ___syscall146,
 "U": ___syscall221,
 "V": ___syscall3,
 "W": ___syscall5,
 "X": ___syscall54,
 "Y": ___syscall6,
 "Z": ___unlock,
 "_": _abort,
 "$": _emscripten_get_heap_size,
 "aa": _emscripten_get_now,
 "ab": _emscripten_memcpy_big,
 "ac": _emscripten_resize_heap,
 "ad": _emscripten_set_main_loop,
 "ae": _emscripten_set_main_loop_timing,
 "af": _getCanvasHeight,
 "ag": _getCanvasWidth,
 "ah": _pthread_getspecific,
 "ai": _pthread_key_create,
 "aj": _pthread_once,
 "ak": _pthread_setspecific,
 "al": abortOnCannotGrowMemory,
 "am": tempDoublePtr,
 "an": DYNAMICTOP_PTR
};

// EMSCRIPTEN_START_ASM


var asm = (/** @suppress {uselessCode} */ function(global,env,buffer) {
"use asm";var a=new global.Int8Array(buffer),b=new global.Int16Array(buffer),c=new global.Int32Array(buffer),d=new global.Uint8Array(buffer),e=new global.Uint16Array(buffer),f=new global.Float32Array(buffer),g=new global.Float64Array(buffer),h=env.am|0,i=env.an|0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0.0,r=global.Math.floor,s=global.Math.abs,t=global.Math.exp,u=global.Math.ceil,v=global.Math.imul,w=global.Math.clz32,x=env.a,y=env.b,z=env.c,A=env.d,B=env.e,C=env.f,D=env.g,E=env.h,F=env.i,G=env.j,H=env.k,I=env.l,J=env.m,K=env.n,L=env.o,M=env.p,N=env.q,O=env.r,P=env.s,Q=env.t,R=env.u,S=env.v,T=env.w,U=env.x,V=env.y,W=env.z,X=env.A,Y=env.B,Z=env.C,_=env.D,$=env.E,aa=env.F,ba=env.G,ca=env.H,da=env.I,ea=env.J,fa=env.K,ga=env.L,ha=env.M,ia=env.N,ja=env.O,ka=env.P,la=env.Q,ma=env.R,na=env.S,oa=env.T,pa=env.U,qa=env.V,ra=env.W,sa=env.X,ta=env.Y,ua=env.Z,va=env._,wa=env.$,xa=env.aa,ya=env.ab,za=env.ac,Aa=env.ad,Ba=env.ae,Ca=env.af,Da=env.ag,Ea=env.ah,Fa=env.ai,Ga=env.aj,Ha=env.ak,Ia=env.al,Ja=14880,Ka=5257760,La=0.0;
// EMSCRIPTEN_START_FUNCS
function Za(a){a=a|0;var b=0;b=Ja;Ja=Ja+a|0;Ja=Ja+15&-16;if((Ja|0)>=(Ka|0))A(a|0);return b|0}function _a(){return Ja|0}function $a(a){a=a|0;Ja=a}function ab(a,b){a=a|0;b=b|0;Ja=a;Ka=b}function bb(){return 5384}function cb(){return 5482}function db(){var a=0,b=0;a=c[2812]|0;if(!a){b=ea(4)|0;c[b>>2]=5208;ia(b|0,3392,64)}else{Ra[c[(c[a>>2]|0)+24>>2]&127](a);return}}function eb(){var a=0,b=0,d=0,e=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0;a=Ja;Ja=Ja+96|0;if((Ja|0)>=(Ka|0))A(96);b=a+56|0;d=a+48|0;e=a+40|0;g=a;h=a+88|0;i=a+80|0;fb(g);j=og(84)|0;gb(j,0);c[h>>2]=j;k=og(16)|0;c[k+4>>2]=0;c[k+8>>2]=0;c[k>>2]=4508;c[k+12>>2]=j;l=h+4|0;c[l>>2]=k;c[e>>2]=j;c[e+4>>2]=j;Ge(h,e);j=og(84)|0;gb(j,1);c[e>>2]=j;k=og(16)|0;c[k+4>>2]=0;c[k+8>>2]=0;c[k>>2]=4508;c[k+12>>2]=j;m=e+4|0;c[m>>2]=k;c[d>>2]=j;c[d+4>>2]=j;Ge(e,d);j=og(84)|0;gb(j,2);c[d>>2]=j;k=og(16)|0;c[k+4>>2]=0;c[k+8>>2]=0;c[k>>2]=4508;c[k+12>>2]=j;n=d+4|0;c[n>>2]=k;c[b>>2]=j;c[b+4>>2]=j;Ge(d,b);j=c[h>>2]|0;k=c[l>>2]|0;o=(k|0)==0;if(o)p=g+32|0;else{q=k+4|0;c[q>>2]=(c[q>>2]|0)+1;c[q>>2]=(c[q>>2]|0)+1;p=g+32|0}c[p>>2]=j;j=g+36|0;p=c[j>>2]|0;c[j>>2]=k;if(p|0?(q=p+4|0,r=c[q>>2]|0,c[q>>2]=r+-1,(r|0)==0):0){Ra[c[(c[p>>2]|0)+8>>2]&127](p);ng(p)}p=c[g+32>>2]|0;r=g+24|0;q=r;s=c[q+4>>2]|0;t=p+24|0;c[t>>2]=c[q>>2];c[t+4>>2]=s;s=c[p+16>>2]|0;if(s|0){t=c[(c[s>>2]|0)+8>>2]|0;f[b>>2]=0.0;f[b+4>>2]=0.0;Wa[t&15](s,p+4|0,b,r)}if(!o?(o=k+4|0,r=c[o>>2]|0,c[o>>2]=r+-1,(r|0)==0):0){Ra[c[(c[k>>2]|0)+8>>2]&127](k);ng(k)}c[i>>2]=0;k=b+16|0;r=og(24)|0;c[r>>2]=4536;c[r+4>>2]=i;c[r+8>>2]=g;c[r+12>>2]=h;c[r+16>>2]=e;c[r+20>>2]=d;c[k>>2]=r;Me(b,11232);r=c[k>>2]|0;if((b|0)!=(r|0)){if(r|0)Ra[c[(c[r>>2]|0)+20>>2]&127](r)}else Ra[c[(c[r>>2]|0)+16>>2]&127](r);Aa(2,0,1);r=c[n>>2]|0;if(r|0?(n=r+4|0,b=c[n>>2]|0,c[n>>2]=b+-1,(b|0)==0):0){Ra[c[(c[r>>2]|0)+8>>2]&127](r);ng(r)}r=c[m>>2]|0;if(r|0?(m=r+4|0,b=c[m>>2]|0,c[m>>2]=b+-1,(b|0)==0):0){Ra[c[(c[r>>2]|0)+8>>2]&127](r);ng(r)}r=c[l>>2]|0;if(r|0?(l=r+4|0,b=c[l>>2]|0,c[l>>2]=b+-1,(b|0)==0):0){Ra[c[(c[r>>2]|0)+8>>2]&127](r);ng(r)}r=c[j>>2]|0;if(r|0?(j=r+4|0,b=c[j>>2]|0,c[j>>2]=b+-1,(b|0)==0):0){Ra[c[(c[r>>2]|0)+8>>2]&127](r);ng(r)}r=c[g>>2]|0;if(!r){Ja=a;return 1}pg(r);Ja=a;return 1}function fb(a){a=a|0;var b=0,d=0,e=0;c[a>>2]=0;b=a+4|0;c[b>>2]=0;d=a+8|0;c[d>>2]=0;e=og(512)|0;c[a>>2]=e;c[d>>2]=128;c[b>>2]=4096;Th(e|0,0,512)|0;c[a+12>>2]=0;g[a+16>>3]=+xa();e=a+24|0;c[e>>2]=0;c[e+4>>2]=0;c[e+8>>2]=0;c[e+12>>2]=0;T();$(32)|0;ca(50,50,32,0)|0;return}function gb(b,d){b=b|0;d=d|0;var e=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0;e=Ja;Ja=Ja+352|0;if((Ja|0)>=(Ka|0))A(352);g=e+248|0;h=e+240|0;i=e+224|0;j=e+216|0;k=e+168|0;l=e+160|0;m=e+152|0;n=e+144|0;o=e+328|0;p=e+336|0;q=e+120|0;r=e+96|0;s=e+72|0;t=e+48|0;u=e+24|0;v=e;w=e+320|0;x=e+312|0;y=e+304|0;z=e+296|0;B=b+4|0;c[B>>2]=0;c[B+4>>2]=0;c[B+8>>2]=0;c[B+12>>2]=0;c[B+16>>2]=0;c[B+20>>2]=0;c[B+24>>2]=0;c[b>>2]=3592;c[b+32>>2]=d;B=b+36|0;C=b+40|0;D=b+44|0;E=b+48|0;F=b+52|0;G=b+56|0;H=b+60|0;I=b+64|0;J=B;K=J+48|0;do{c[J>>2]=0;J=J+4|0}while((J|0)<(K|0));switch(d|0){case 0:{L=og(4)|0;c[L>>2]=3660;c[o>>2]=L;M=og(16)|0;c[M+4>>2]=0;c[M+8>>2]=0;c[M>>2]=3632;c[M+12>>2]=L;N=o+4|0;c[N>>2]=M;c[n>>2]=L;c[n+4>>2]=L;qb(o,n);n=c[o>>2]|0;c[o>>2]=c[B>>2];c[B>>2]=n;n=c[N>>2]|0;L=c[C>>2]|0;c[N>>2]=L;c[C>>2]=n;n=L;if(L|0?(N=n+4|0,M=c[N>>2]|0,c[N>>2]=M+-1,(M|0)==0):0){Ra[c[(c[L>>2]|0)+8>>2]&127](n);ng(n)}break}case 1:{n=og(24)|0;c[n>>2]=3740;J=n+4|0;K=J+20|0;do{a[J>>0]=0;J=J+1|0}while((J|0)<(K|0));c[o>>2]=n;L=og(16)|0;c[L+4>>2]=0;c[L+8>>2]=0;c[L>>2]=3712;c[L+12>>2]=n;M=o+4|0;c[M>>2]=L;c[m>>2]=n;c[m+4>>2]=n;qb(o,m);m=c[o>>2]|0;c[o>>2]=c[B>>2];c[B>>2]=m;m=c[M>>2]|0;n=c[C>>2]|0;c[M>>2]=n;c[C>>2]=m;m=n;if(n|0?(M=m+4|0,L=c[M>>2]|0,c[M>>2]=L+-1,(L|0)==0):0){Ra[c[(c[n>>2]|0)+8>>2]&127](m);ng(m)}break}case 2:{m=og(12)|0;c[m>>2]=3808;c[m+4>>2]=0;c[m+8>>2]=0;c[o>>2]=m;n=og(16)|0;c[n+4>>2]=0;c[n+8>>2]=0;c[n>>2]=3780;c[n+12>>2]=m;L=o+4|0;c[L>>2]=n;c[l>>2]=m;c[l+4>>2]=m;qb(o,l);l=c[o>>2]|0;c[o>>2]=c[B>>2];c[B>>2]=l;l=c[L>>2]|0;B=c[C>>2]|0;c[L>>2]=B;c[C>>2]=l;l=B;if(B|0?(C=l+4|0,L=c[C>>2]|0,c[C>>2]=L+-1,(L|0)==0):0){Ra[c[(c[B>>2]|0)+8>>2]&127](l);ng(l)}break}default:{}}l=og(328)|0;B=b+4|0;ib(l,B);c[o>>2]=l;L=og(16)|0;c[L+4>>2]=0;c[L+8>>2]=0;c[L>>2]=3872;c[L+12>>2]=l;C=o+4|0;c[C>>2]=L;c[k>>2]=l;c[k+4>>2]=l;tc(o,k);l=b+16|0;L=c[o>>2]|0;m=c[C>>2]|0;c[o>>2]=0;c[C>>2]=0;c[l>>2]=L;L=b+20|0;n=c[L>>2]|0;c[L>>2]=m;if(n|0?(m=n+4|0,L=c[m>>2]|0,c[m>>2]=L+-1,(L|0)==0):0){Ra[c[(c[n>>2]|0)+8>>2]&127](n);ng(n)}n=c[C>>2]|0;if(n|0?(C=n+4|0,L=c[C>>2]|0,c[C>>2]=L+-1,(L|0)==0):0){Ra[c[(c[n>>2]|0)+8>>2]&127](n);ng(n)}n=c[(c[l>>2]|0)+4>>2]|0;L=c[B>>2]|0;c[L+(n*48|0)+8>>2]=1065353216;c[L+(n*48|0)+12>>2]=1065353216;n=og(328)|0;ib(n,B);c[n>>2]=3900;J=k+8|0;K=J+36|0;do{c[J>>2]=0;J=J+4|0}while((J|0)<(K|0));c[k+44>>2]=5;c[k>>2]=0;c[k+4>>2]=0;c[k+16>>2]=0;c[k+20>>2]=0;c[k+36>>2]=-256;L=b+8|0;C=c[L>>2]|0;m=c[B>>2]|0;c[m+((c[n+4>>2]|0)*48|0)+36>>2]=(C-m|0)/48|0;m=b+12|0;if((c[m>>2]|0)==(C|0))Ac(B,k);else{J=C;O=k;K=J+48|0;do{c[J>>2]=c[O>>2];J=J+4|0;O=O+4|0}while((J|0)<(K|0));c[L>>2]=(c[L>>2]|0)+48}c[o>>2]=n;C=og(16)|0;c[C+4>>2]=0;c[C+8>>2]=0;c[C>>2]=3924;c[C+12>>2]=n;M=o+4|0;c[M>>2]=C;c[g>>2]=n;c[g+4>>2]=n;Bc(o,g);n=c[o>>2]|0;C=c[M>>2]|0;c[o>>2]=0;c[M>>2]=0;c[D>>2]=n;n=c[E>>2]|0;c[E>>2]=C;if(n|0?(C=n+4|0,o=c[C>>2]|0,c[C>>2]=o+-1,(o|0)==0):0){Ra[c[(c[n>>2]|0)+8>>2]&127](n);ng(n)}n=c[M>>2]|0;if(n|0?(M=n+4|0,o=c[M>>2]|0,c[M>>2]=o+-1,(o|0)==0):0){Ra[c[(c[n>>2]|0)+8>>2]&127](n);ng(n)}n=c[D>>2]|0;Va[c[c[n>>2]>>2]&7](n,B,1);n=c[D>>2]|0;f[n+52>>2]=1.0;o=c[n+4>>2]|0;n=c[B>>2]|0;c[n+(o*48|0)+8>>2]=1065353216;c[n+(o*48|0)+12>>2]=1065353216;o=c[(c[D>>2]|0)+4>>2]|0;n=c[B>>2]|0;c[n+(o*48|0)+24>>2]=-1027080192;c[n+(o*48|0)+28>>2]=-1027080192;o=c[(c[D>>2]|0)+4>>2]|0;n=c[B>>2]|0;c[n+(o*48|0)>>2]=1056964608;c[n+(o*48|0)+4>>2]=1056964608;o=c[D>>2]|0;c[o+8>>2]=1056964608;c[o+12>>2]=1056964608;o=c[D>>2]|0;Va[c[c[o>>2]>>2]&7](o,B,1);f[(c[D>>2]|0)+52>>2]=1.600000023841858;o=og(464)|0;c[p>>2]=8;c[p+4>>2]=5;n=q+16|0;c[n>>2]=0;M=b;C=r+16|0;c[r>>2]=3952;c[r+4>>2]=M;c[r+8>>2]=d;c[C>>2]=r;d=s+16|0;c[d>>2]=0;c[g>>2]=c[p>>2];c[g+4>>2]=c[p+4>>2];jb(o,B,g,.25,q,r,s);c[k>>2]=o;p=og(16)|0;c[p+4>>2]=0;c[p+8>>2]=0;c[p>>2]=4244;c[p+12>>2]=o;N=k+4|0;c[N>>2]=p;c[j>>2]=o;c[j+4>>2]=o;zd(k,j);o=c[k>>2]|0;p=c[N>>2]|0;c[k>>2]=0;c[N>>2]=0;c[F>>2]=o;o=c[G>>2]|0;c[G>>2]=p;if(o|0?(p=o+4|0,k=c[p>>2]|0,c[p>>2]=k+-1,(k|0)==0):0){Ra[c[(c[o>>2]|0)+8>>2]&127](o);ng(o)}o=c[N>>2]|0;if(o|0?(N=o+4|0,k=c[N>>2]|0,c[N>>2]=k+-1,(k|0)==0):0){Ra[c[(c[o>>2]|0)+8>>2]&127](o);ng(o)}o=c[d>>2]|0;if((s|0)!=(o|0)){if(o|0)Ra[c[(c[o>>2]|0)+20>>2]&127](o)}else Ra[c[(c[o>>2]|0)+16>>2]&127](o);o=c[C>>2]|0;if((r|0)!=(o|0)){if(o|0)Ra[c[(c[o>>2]|0)+20>>2]&127](o)}else Ra[c[(c[o>>2]|0)+16>>2]&127](o);o=c[n>>2]|0;if((q|0)!=(o|0)){if(o|0)Ra[c[(c[o>>2]|0)+20>>2]&127](o)}else Ra[c[(c[o>>2]|0)+16>>2]&127](o);o=c[(c[F>>2]|0)+4>>2]|0;q=c[B>>2]|0;c[q+(o*48|0)+8>>2]=1065353216;c[q+(o*48|0)+12>>2]=1065353216;o=c[F>>2]|0;q=t+16|0;c[t>>2]=4272;c[t+4>>2]=M;c[q>>2]=t;n=u+16|0;c[u>>2]=4316;c[u+4>>2]=M;c[n>>2]=u;r=v+16|0;c[v>>2]=4360;c[v+4>>2]=M;c[r>>2]=v;kb(o,t,u,v);o=c[r>>2]|0;if((v|0)!=(o|0)){if(o|0)Ra[c[(c[o>>2]|0)+20>>2]&127](o)}else Ra[c[(c[o>>2]|0)+16>>2]&127](o);o=c[n>>2]|0;if((u|0)!=(o|0)){if(o|0)Ra[c[(c[o>>2]|0)+20>>2]&127](o)}else Ra[c[(c[o>>2]|0)+16>>2]&127](o);o=c[q>>2]|0;if((t|0)!=(o|0)){if(o|0)Ra[c[(c[o>>2]|0)+20>>2]&127](o)}else Ra[c[(c[o>>2]|0)+16>>2]&127](o);o=c[D>>2]|0;t=c[(c[o>>2]|0)+4>>2]|0;c[w>>2]=c[F>>2];F=w+4|0;q=c[G>>2]|0;c[F>>2]=q;if(q|0){G=q+4|0;c[G>>2]=(c[G>>2]|0)+1}Va[t&7](o,B,w);w=c[F>>2]|0;if(w|0?(F=w+4|0,o=c[F>>2]|0,c[F>>2]=o+-1,(o|0)==0):0){Ra[c[(c[w>>2]|0)+8>>2]&127](w);ng(w)}w=og(328)|0;ib(w,B);c[w>>2]=4404;J=g+8|0;K=J+36|0;do{c[J>>2]=0;J=J+4|0}while((J|0)<(K|0));c[g+44>>2]=6;c[g>>2]=0;c[g+4>>2]=0;c[g+16>>2]=0;c[g+20>>2]=0;f[g+24>>2]=2.0;c[g+28>>2]=0;c[g+36>>2]=-1;o=c[L>>2]|0;F=c[B>>2]|0;c[F+((c[w+4>>2]|0)*48|0)+36>>2]=(o-F|0)/48|0;if((c[m>>2]|0)==(o|0))Ac(B,g);else{J=o;O=g;K=J+48|0;do{c[J>>2]=c[O>>2];J=J+4|0;O=O+4|0}while((J|0)<(K|0));c[L>>2]=(c[L>>2]|0)+48}c[j>>2]=w;L=og(16)|0;c[L+4>>2]=0;c[L+8>>2]=0;c[L>>2]=4428;c[L+12>>2]=w;O=j+4|0;c[O>>2]=L;c[i>>2]=w;c[i+4>>2]=w;re(j,i);w=(c[j>>2]|0)+4|0;L=c[w>>2]|0;J=c[B>>2]|0;c[J+(L*48|0)+24>>2]=1125515264;c[J+(L*48|0)+28>>2]=1112014848;L=c[w>>2]|0;w=c[B>>2]|0;c[w+(L*48|0)>>2]=1065353216;c[w+(L*48|0)+4>>2]=0;L=c[j>>2]|0;w=c[L+4>>2]|0;J=c[B>>2]|0;c[J+(w*48|0)+16>>2]=-1043857408;c[J+(w*48|0)+20>>2]=1103626240;c[L+8>>2]=1065353216;c[L+12>>2]=0;L=og(328)|0;c[i>>2]=0;c[i+4>>2]=0;c[i+8>>2]=0;w=i+11|0;a[w>>0]=4;c[i>>2]=808463920;a[i+4>>0]=0;lb(L,B,i,-1,24.0);c[g>>2]=L;J=og(16)|0;c[J+4>>2]=0;c[J+8>>2]=0;c[J>>2]=4480;c[J+12>>2]=L;K=g+4|0;c[K>>2]=J;c[h>>2]=L;c[h+4>>2]=L;ze(g,h);h=c[g>>2]|0;L=c[K>>2]|0;c[g>>2]=0;c[K>>2]=0;c[H>>2]=h;h=c[I>>2]|0;c[I>>2]=L;if(h|0?(L=h+4|0,g=c[L>>2]|0,c[L>>2]=g+-1,(g|0)==0):0){Ra[c[(c[h>>2]|0)+8>>2]&127](h);ng(h)}h=c[K>>2]|0;if(h|0?(K=h+4|0,g=c[K>>2]|0,c[K>>2]=g+-1,(g|0)==0):0){Ra[c[(c[h>>2]|0)+8>>2]&127](h);ng(h)}if((a[w>>0]|0)<0)pg(c[i>>2]|0);i=c[H>>2]|0;Va[c[c[i>>2]>>2]&7](i,B,2);i=c[(c[H>>2]|0)+4>>2]|0;w=c[B>>2]|0;c[w+(i*48|0)>>2]=1056964608;c[w+(i*48|0)+4>>2]=1056964608;i=c[H>>2]|0;c[i+8>>2]=1056964608;c[i+12>>2]=1056964608;i=c[l>>2]|0;w=c[(c[i>>2]|0)+4>>2]|0;c[x>>2]=c[D>>2];D=x+4|0;h=c[E>>2]|0;c[D>>2]=h;if(h|0){E=h+4|0;c[E>>2]=(c[E>>2]|0)+1}Va[w&7](i,B,x);x=c[D>>2]|0;do if(x|0){D=x+4|0;i=c[D>>2]|0;c[D>>2]=i+-1;if(i|0)break;Ra[c[(c[x>>2]|0)+8>>2]&127](x);ng(x)}while(0);x=c[j>>2]|0;i=c[(c[x>>2]|0)+4>>2]|0;c[y>>2]=c[H>>2];H=y+4|0;D=c[I>>2]|0;c[H>>2]=D;if(D|0){I=D+4|0;c[I>>2]=(c[I>>2]|0)+1}Va[i&7](x,B,y);y=c[H>>2]|0;do if(y|0){H=y+4|0;x=c[H>>2]|0;c[H>>2]=x+-1;if(x|0)break;Ra[c[(c[y>>2]|0)+8>>2]&127](y);ng(y)}while(0);y=c[l>>2]|0;l=c[(c[y>>2]|0)+4>>2]|0;c[z>>2]=c[j>>2];j=z+4|0;x=c[O>>2]|0;c[j>>2]=x;if(x|0){H=x+4|0;c[H>>2]=(c[H>>2]|0)+1}Va[l&7](y,B,z);z=c[j>>2]|0;do if(z|0){j=z+4|0;B=c[j>>2]|0;c[j>>2]=B+-1;if(B|0)break;Ra[c[(c[z>>2]|0)+8>>2]&127](z);ng(z)}while(0);mb(b);b=c[O>>2]|0;if(!b){Ja=e;return}O=b+4|0;z=c[O>>2]|0;c[O>>2]=z+-1;if(z|0){Ja=e;return}Ra[c[(c[b>>2]|0)+8>>2]&127](b);ng(b);Ja=e;return}function hb(a){a=a|0;fa(a|0)|0;kh()}function ib(d,e){d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0;f=Ja;Ja=Ja+48|0;if((Ja|0)>=(Ka|0))A(48);g=f;c[d>>2]=3848;h=d+4|0;i=e+4|0;j=c[i>>2]|0;k=(j-(c[e>>2]|0)|0)/48|0;l=d+8|0;c[l>>2]=0;c[l+4>>2]=0;c[l+8>>2]=0;c[l+12>>2]=0;c[l+16>>2]=0;c[l+20>>2]=0;c[d+32>>2]=255;l=d+36|0;c[d+88>>2]=0;c[d+112>>2]=0;c[d+136>>2]=0;a[d+144>>0]=0;a[d+145>>0]=0;c[d+168>>2]=0;c[d+192>>2]=0;c[d+216>>2]=0;a[d+224>>0]=0;c[d+248>>2]=0;c[d+272>>2]=0;c[d+296>>2]=0;m=d+304|0;c[l>>2]=0;c[l+4>>2]=0;c[l+8>>2]=0;c[l+12>>2]=0;c[l+16>>2]=0;c[l+20>>2]=0;c[l+24>>2]=0;b[l+28>>1]=0;c[m>>2]=0;c[m+4>>2]=0;c[m+8>>2]=0;c[m+12>>2]=0;c[m+16>>2]=0;c[h>>2]=k;m=g;l=m+40|0;do{c[m>>2]=0;m=m+4|0}while((m|0)<(l|0));c[g+44>>2]=1;c[g+32>>2]=k;c[g+40>>2]=1;if((c[e+8>>2]|0)>>>0>j>>>0){m=j;j=g;l=m+48|0;do{c[m>>2]=c[j>>2];m=m+4|0;j=j+4|0}while((m|0)<(l|0));j=(c[i>>2]|0)+48|0;c[i>>2]=j;n=j;o=c[e>>2]|0;p=n-o|0;q=(p|0)/48|0;r=q+-1|0;s=c[h>>2]|0;t=o;u=t+(s*48|0)+36|0;c[u>>2]=r;Ja=f;return}else{qc(e,g);n=c[i>>2]|0;o=c[e>>2]|0;p=n-o|0;q=(p|0)/48|0;r=q+-1|0;s=c[h>>2]|0;t=o;u=t+(s*48|0)+36|0;c[u>>2]=r;Ja=f;return}}function jb(b,d,e,g,h,i,j){b=b|0;d=d|0;e=e|0;g=+g;h=h|0;i=i|0;j=j|0;var k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,w=0,x=0,y=0,z=0,B=0,C=0,D=0,E=0,F=0,G=0.0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ba=0,ca=0,da=0,ea=0,fa=0.0,ga=0,ha=0,ia=0,ja=0,ka=0,la=0;k=Ja;Ja=Ja+112|0;if((Ja|0)>=(Ka|0))A(112);l=k+88|0;m=k+56|0;n=k+80|0;o=k+72|0;p=k+64|0;q=k+32|0;r=k;ib(b,d);c[b>>2]=4044;s=e;t=c[s>>2]|0;u=c[s+4>>2]|0;s=b+324|0;c[s>>2]=t;c[s+4>>2]=u;s=b+332|0;w=s;c[w>>2]=t;c[w+4>>2]=u;u=b+344|0;w=h+16|0;x=c[w>>2]|0;do if(x)if((h|0)==(x|0)){c[b+360>>2]=u;y=c[w>>2]|0;Ta[c[(c[y>>2]|0)+12>>2]&15](y,u);break}else{c[b+360>>2]=Ma[c[(c[x>>2]|0)+8>>2]&31](x)|0;break}else c[b+360>>2]=0;while(0);x=b+368|0;u=i+16|0;h=c[u>>2]|0;do if(h)if((i|0)==(h|0)){c[b+384>>2]=x;y=c[u>>2]|0;Ta[c[(c[y>>2]|0)+12>>2]&15](y,x);break}else{c[b+384>>2]=Ma[c[(c[h>>2]|0)+8>>2]&31](h)|0;break}else c[b+384>>2]=0;while(0);h=b+392|0;x=j+16|0;y=c[x>>2]|0;do if(y)if((j|0)==(y|0)){c[b+408>>2]=h;z=c[x>>2]|0;Ta[c[(c[z>>2]|0)+12>>2]&15](z,h);break}else{c[b+408>>2]=Ma[c[(c[y>>2]|0)+8>>2]&31](y)|0;break}else c[b+408>>2]=0;while(0);y=b+416|0;h=b+420|0;x=b+424|0;j=b+428|0;z=b+432|0;c[y>>2]=0;c[y+4>>2]=0;c[y+8>>2]=0;c[y+12>>2]=0;c[y+16>>2]=0;f[b+436>>2]=g;B=b+440|0;C=b+444|0;D=c[s>>2]|0;s=c[b+336>>2]|0;E=b+448|0;f[E>>2]=g/+(D+1|0);F=b+452|0;f[F>>2]=g/+(s+1|0);a[b+456>>0]=0;G=1.0-g;f[B>>2]=G/+(D|0);f[C>>2]=G/+(s|0);s=e+4|0;D=c[s>>2]|0;a:do if((D|0)>0){H=l+4|0;I=l+8|0;J=l+4|0;K=l+4|0;L=b+440|0;M=p+4|0;N=0;O=t;P=0;Q=0;R=t;S=t;while(1){c[l>>2]=0;c[H>>2]=0;c[I>>2]=0;if(P>>>0>=Q>>>0){Tc(x,l);T=c[l>>2]|0;if(!T){U=O;V=S;W=R}else{X=c[H>>2]|0;if((X|0)==(T|0)){Y=O;Z=T}else{_=X;do{X=c[_+-4>>2]|0;_=_+-8|0;if(X|0?($=X+4|0,aa=c[$>>2]|0,c[$>>2]=aa+-1,(aa|0)==0):0){Ra[c[(c[X>>2]|0)+8>>2]&127](X);ng(X)}}while((_|0)!=(T|0));Y=c[e>>2]|0;Z=c[l>>2]|0}c[H>>2]=T;pg(Z);U=Y;V=Y;W=Y}}else{c[P>>2]=0;_=P+4|0;c[_>>2]=0;X=P+8|0;c[X>>2]=0;c[P>>2]=c[l>>2];c[_>>2]=c[H>>2];c[X>>2]=c[I>>2];c[I>>2]=0;c[H>>2]=0;c[l>>2]=0;c[j>>2]=(c[j>>2]|0)+12;U=O;V=S;W=R}if((V|0)>0){G=+(N|0);X=N+1|0;g=+(X|0);_=0;while(1){aa=c[x>>2]|0;c[l>>2]=0;c[J>>2]=0;$=aa+(N*12|0)+4|0;ba=c[$>>2]|0;if(ba>>>0>=(c[aa+(N*12|0)+8>>2]|0)>>>0){Uc(aa+(N*12|0)|0,l);aa=c[J>>2]|0;if(aa|0?(ca=aa+4|0,da=c[ca>>2]|0,c[ca>>2]=da+-1,(da|0)==0):0){Ra[c[(c[aa>>2]|0)+8>>2]&127](aa);ng(aa)}}else{c[ba>>2]=0;c[ba+4>>2]=0;c[l>>2]=0;c[J>>2]=0;c[$>>2]=ba+8}ba=c[w>>2]|0;if(!ba)ea=_+1|0;else{$=Ma[c[(c[ba>>2]|0)+24>>2]&31](ba)|0;c[l>>2]=$;ba=og(16)|0;c[ba+4>>2]=0;c[ba+8>>2]=0;c[ba>>2]=3872;c[ba+12>>2]=$;c[K>>2]=ba;c[m>>2]=$;c[m+4>>2]=$;tc(l,m);$=c[C>>2]|0;ba=(c[l>>2]|0)+4|0;aa=c[ba>>2]|0;da=c[d>>2]|0;c[da+(aa*48|0)+8>>2]=c[B>>2];c[da+(aa*48|0)+12>>2]=$;$=_+1|0;fa=+f[C>>2]*G+ +f[F>>2]*g;aa=c[ba>>2]|0;ba=c[d>>2]|0;f[ba+(aa*48|0)>>2]=+f[L>>2]*+(_|0)+ +f[E>>2]*+($|0);f[ba+(aa*48|0)+4>>2]=fa;aa=c[l>>2]|0;ba=aa+4|0;da=c[ba>>2]|0;ca=c[d>>2]|0;c[ca+(da*48|0)+16>>2]=1065353216;c[ca+(da*48|0)+20>>2]=1065353216;da=c[ba>>2]|0;ba=c[d>>2]|0;c[ba+(da*48|0)+24>>2]=-1073741824;c[ba+(da*48|0)+28>>2]=-1073741824;da=c[(c[b>>2]|0)+4>>2]|0;c[p>>2]=aa;aa=c[K>>2]|0;c[M>>2]=aa;if(aa|0){ba=aa+4|0;c[ba>>2]=(c[ba>>2]|0)+1}Va[da&7](b,d,p);da=c[M>>2]|0;if(da|0?(ba=da+4|0,aa=c[ba>>2]|0,c[ba>>2]=aa+-1,(aa|0)==0):0){Ra[c[(c[da>>2]|0)+8>>2]&127](da);ng(da)}da=c[K>>2]|0;if(da|0?(aa=da+4|0,ba=c[aa>>2]|0,c[aa>>2]=ba+-1,(ba|0)==0):0){Ra[c[(c[da>>2]|0)+8>>2]&127](da);ng(da)}ea=$}$=c[e>>2]|0;if((ea|0)<($|0))_=ea;else{ga=X;ha=$;ia=$;ja=$;break}}}else{ga=N+1|0;ha=U;ia=W;ja=V}X=c[s>>2]|0;if((ga|0)>=(X|0)){ka=X;la=ia;break a}N=ga;O=ha;P=c[j>>2]|0;Q=c[z>>2]|0;R=ia;S=ja}}else{ka=D;la=t}while(0);t=og(12)|0;D=v(ka<<1,la)|0;c[r>>2]=d;la=r+8|0;ka=c[u>>2]|0;do if(ka)if((i|0)==(ka|0)){c[r+24>>2]=la;Ta[c[(c[ka>>2]|0)+12>>2]&15](ka,la);break}else{c[r+24>>2]=Ma[c[(c[ka>>2]|0)+8>>2]&31](ka)|0;break}else c[r+24>>2]=0;while(0);ka=q+16|0;c[ka>>2]=0;la=og(40)|0;c[la>>2]=4096;c[la+8>>2]=c[r>>2];i=la+16|0;u=r+24|0;ja=c[u>>2]|0;do if(ja)if((r+8|0)==(ja|0)){c[la+32>>2]=i;Ta[c[(c[ja>>2]|0)+12>>2]&15](ja,i);break}else{c[la+32>>2]=ja;c[u>>2]=0;break}else c[la+32>>2]=0;while(0);c[ka>>2]=la;Sc(t,d,D,b,q);c[o>>2]=0;c[l>>2]=c[o>>2];Vc(n,t,l);l=c[n>>2]|0;c[n>>2]=c[y>>2];c[y>>2]=l;l=n+4|0;n=c[l>>2]|0;y=c[h>>2]|0;c[l>>2]=y;c[h>>2]=n;n=y;if(y|0?(h=n+4|0,l=c[h>>2]|0,c[h>>2]=l+-1,(l|0)==0):0){Ra[c[(c[y>>2]|0)+8>>2]&127](n);ng(n)}n=c[ka>>2]|0;if((q|0)!=(n|0)){if(n|0)Ra[c[(c[n>>2]|0)+20>>2]&127](n)}else Ra[c[(c[n>>2]|0)+16>>2]&127](n);n=c[u>>2]|0;if((r+8|0)==(n|0)){Ra[c[(c[n>>2]|0)+16>>2]&127](n);Ja=k;return}if(!n){Ja=k;return}Ra[c[(c[n>>2]|0)+20>>2]&127](n);Ja=k;return}function kb(b,d,e,f){b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0;g=Ja;Ja=Ja+32|0;if((Ja|0)>=(Ka|0))A(32);h=g;i=b+232|0;j=c[d+16>>2]|0;do if(j)if((d|0)==(j|0)){k=h+16|0;c[k>>2]=h;Ta[c[(c[j>>2]|0)+12>>2]&15](j,h);l=k;break}else{k=h+16|0;c[k>>2]=Ma[c[(c[j>>2]|0)+8>>2]&31](j)|0;l=k;break}else{k=h+16|0;c[k>>2]=0;l=k}while(0);Fd(h,i);i=c[l>>2]|0;if((h|0)!=(i|0)){if(i|0)Ra[c[(c[i>>2]|0)+20>>2]&127](i)}else Ra[c[(c[i>>2]|0)+16>>2]&127](i);i=b+256|0;l=c[e+16>>2]|0;do if(l)if((e|0)==(l|0)){j=h+16|0;c[j>>2]=h;Ta[c[(c[l>>2]|0)+12>>2]&15](l,h);m=j;break}else{j=h+16|0;c[j>>2]=Ma[c[(c[l>>2]|0)+8>>2]&31](l)|0;m=j;break}else{j=h+16|0;c[j>>2]=0;m=j}while(0);Fd(h,i);i=c[m>>2]|0;if((h|0)!=(i|0)){if(i|0)Ra[c[(c[i>>2]|0)+20>>2]&127](i)}else Ra[c[(c[i>>2]|0)+16>>2]&127](i);i=b+280|0;m=c[f+16>>2]|0;do if(m)if((f|0)==(m|0)){l=h+16|0;c[l>>2]=h;Ta[c[(c[m>>2]|0)+12>>2]&15](m,h);n=l;break}else{l=h+16|0;c[l>>2]=Ma[c[(c[m>>2]|0)+8>>2]&31](m)|0;n=l;break}else{l=h+16|0;c[l>>2]=0;n=l}while(0);Fd(h,i);i=c[n>>2]|0;if((h|0)==(i|0)){Ra[c[(c[i>>2]|0)+16>>2]&127](i);o=b+224|0;a[o>>0]=1;Ja=g;return}if(!i){o=b+224|0;a[o>>0]=1;Ja=g;return}Ra[c[(c[i>>2]|0)+20>>2]&127](i);o=b+224|0;a[o>>0]=1;Ja=g;return}function lb(b,d,e,g,h){b=b|0;d=d|0;e=e|0;g=g|0;h=+h;var i=0,j=0,k=0,l=0,m=0,n=0;i=Ja;Ja=Ja+48|0;if((Ja|0)>=(Ka|0))A(48);j=i;ib(b,d);c[b>>2]=4456;k=j+8|0;l=k+36|0;do{c[k>>2]=0;k=k+4|0}while((k|0)<(l|0));c[j+44>>2]=8;c[j>>2]=0;c[j+4>>2]=0;f[j+24>>2]=h;c[j+32>>2]=g;if(!(Sb(11396,e)|0)){g=c[2847]|0;m=(g-(c[2846]|0)|0)/12|0;n=g;if((c[2848]|0)==(n|0))Tb(11384,e);else{yg(n,e);c[2847]=(c[2847]|0)+12}c[(Rb(11396,e)|0)>>2]=m}c[j+36>>2]=c[(Rb(11396,e)|0)>>2];f[j+16>>2]=+U(((a[e+11>>0]|0)<0?c[e>>2]|0:e)|0,+h);f[j+20>>2]=h;e=d+4|0;m=c[e>>2]|0;n=c[d>>2]|0;c[n+((c[b+4>>2]|0)*48|0)+36>>2]=(m-n|0)/48|0;if((c[d+8>>2]|0)==(m|0)){Ac(d,j);Ja=i;return}else{k=m;m=j;l=k+48|0;do{c[k>>2]=c[m>>2];k=k+4|0;m=m+4|0}while((k|0)<(l|0));c[e>>2]=(c[e>>2]|0)+48;Ja=i;return}}function mb(d){d=d|0;var e=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0.0,K=0.0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0.0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0;e=Ja;Ja=Ja+32|0;if((Ja|0)>=(Ka|0))A(32);h=e;i=e+16|0;j=e+24|0;k=e+8|0;if((a[11344]|0)==0?Ch(11344)|0:0){g[1421]=-500.0;g[1422]=500.0}l=d+52|0;m=c[l>>2]|0;n=c[m+336>>2]|0;if((n|0)<=0){o=d+4|0;p=m;q=c[p>>2]|0;r=q+8|0;s=c[r>>2]|0;t=p+44|0;u=p+36|0;Wa[s&15](p,o,t,u);Ja=e;return}v=d+36|0;w=i+4|0;x=d+56|0;y=d+4|0;z=k+4|0;B=j+4|0;C=n;n=m;D=m;E=m;while(1){m=C;C=C+-1|0;if((c[E+332>>2]|0)>0){F=0;G=D;H=n;I=E;while(1){if(!(c[(c[(c[I+424>>2]|0)+(C*12|0)>>2]|0)+(F<<3)>>2]|0)){J=+g[1421];K=+g[1422]-J;L=c[3479]|0;M=((L+1|0)>>>0)%624|0;N=11420+(L<<2)|0;O=11420+(M<<2)|0;P=c[O>>2]|0;Q=0-(P&1)&-1727483681^c[11420+((((L+397|0)>>>0)%624|0)<<2)>>2]^(P&2147483646|c[N>>2]&-2147483648)>>>1;c[N>>2]=Q;N=Q>>>11^Q;Q=N<<7&-1658038656^N;N=Q<<15&-272236544^Q;Q=((M+1|0)>>>0)%624|0;P=c[11420+(Q<<2)>>2]|0;L=0-(P&1)&-1727483681^c[11420+((((M+397|0)>>>0)%624|0)<<2)>>2]^(P&2147483646|c[O>>2]&-2147483648)>>>1;c[O>>2]=L;O=L>>>11^L;L=O<<7&-1658038656^O;O=L<<15&-272236544^L;c[3479]=Q;R=J+K*((+((O>>>18^O)>>>0)*4294967296.0+ +((N>>>18^N)>>>0))*5.421010862427522e-20);N=c[v>>2]|0;O=c[c[N>>2]>>2]|0;c[i>>2]=G;Q=c[x>>2]|0;c[w>>2]=Q;if(Q|0){L=Q+4|0;c[L>>2]=(c[L>>2]|0)+1}L=Pa[O&3](N,i,C,F)|0;N=c[w>>2]|0;if(N|0?(O=N+4|0,Q=c[O>>2]|0,c[O>>2]=Q+-1,(Q|0)==0):0){Ra[c[(c[N>>2]|0)+8>>2]&127](N);ng(N)}Fe(j,c[l>>2]|0,y,C,F,L);be(d,C,F);L=c[v>>2]|0;N=c[(c[L>>2]|0)+4>>2]|0;c[k>>2]=c[j>>2];Q=c[B>>2]|0;c[z>>2]=Q;if(Q|0){O=Q+4|0;c[O>>2]=(c[O>>2]|0)+1}Va[N&7](L,y,k);L=c[z>>2]|0;if(L|0?(N=L+4|0,O=c[N>>2]|0,c[N>>2]=O+-1,(O|0)==0):0){Ra[c[(c[L>>2]|0)+8>>2]&127](L);ng(L)}L=c[j>>2]|0;O=L+4|0;N=c[O>>2]|0;Q=c[y>>2]|0;c[Q+(N*48|0)+16>>2]=0;f[Q+(N*48|0)+20>>2]=R+-1.0e3;N=L+32|0;c[N>>2]=255;Q=c[O>>2]|0;O=c[y>>2]|0;P=c[O+(Q*48|0)+36>>2]|0;if(Q>>>0>P>>>0)S=L;else{L=Q;Q=255;M=O;while(1){if(Q>>>0>255){c[h>>2]=Q;cg(7521,h)|0}O=c[M+(L*48|0)+44>>2]|0;a:do switch(O|0){case 7:case 5:case 4:{T=M+(L*48|0)+36|0;U=(c[T>>2]&-256)+Q|0;c[T>>2]=U;switch(O|0){case 7:case 4:break;default:break a}c[M+(L*48|0)+32>>2]=(U&-256)+Q;break}case 8:{U=M+(L*48|0)+32|0;c[U>>2]=(c[U>>2]&-256)+Q;break}default:{}}while(0);O=L+1|0;if(O>>>0>P>>>0)break;L=O;Q=c[N>>2]|0;M=c[y>>2]|0}S=c[j>>2]|0}M=c[S+304>>2]|0;if((M|0)!=0?(N=ch(M,3136,3144,0)|0,(N|0)!=0):0){M=c[S+308>>2]|0;if(!M){V=N;W=0}else{Q=M+4|0;c[Q>>2]=(c[Q>>2]|0)+1;V=N;W=M}}else{V=0;W=0}c[V+160>>2]=0;c[V+164>>2]=0;a[V+128>>0]=0;a[V+5>>0]=0;a[V+4>>0]=0;M=V+44|0;b[M>>1]=b[M>>1]|4;a[V+32>>0]=0;if(W|0?(M=W+4|0,N=c[M>>2]|0,c[M>>2]=N+-1,(N|0)==0):0){Ra[c[(c[W>>2]|0)+8>>2]&127](W);ng(W)}N=c[B>>2]|0;if(N|0?(M=N+4|0,Q=c[M>>2]|0,c[M>>2]=Q+-1,(Q|0)==0):0){Ra[c[(c[N>>2]|0)+8>>2]&127](N);ng(N)}N=c[l>>2]|0;X=N;Y=N}else{X=H;Y=I}F=F+1|0;if((F|0)>=(c[Y+332>>2]|0))break;else{G=Y;H=X;I=Y}}Z=X;_=Y;$=Y}else{Z=n;_=D;$=E}if((m|0)<=1){o=y;p=Z;break}else{n=Z;D=_;E=$}}q=c[p>>2]|0;r=q+8|0;s=c[r>>2]|0;t=p+44|0;u=p+36|0;Wa[s&15](p,o,t,u);Ja=e;return}function nb(a,b,c){a=a|0;b=+b;c=c|0;return}function ob(a,b){a=a|0;b=b|0;return}function pb(a,b){a=a|0;b=b|0;return}function qb(a,b){a=a|0;b=b|0;return}function rb(a){a=a|0;mg(a);pg(a);return}function sb(a){a=a|0;var b=0;b=c[a+12>>2]|0;if(!b)return;pg(b);return}function tb(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==5786?a+12|0:0)|0}function ub(a){a=a|0;pg(a);return}function vb(b,d,e,f){b=b|0;d=d|0;e=e|0;f=f|0;if((a[11256]|0)==0?Ch(11256)|0:0){c[3480]=0;c[3481]=0;c[3482]=0;f=og(12)|0;c[3480]=f;e=f+12|0;c[3482]=e;c[f>>2]=c[923];c[f+4>>2]=c[924];c[f+8>>2]=c[925];c[3481]=e}if((a[11264]|0)==0?Ch(11264)|0:0){e=((c[3481]|0)-(c[3480]|0)>>2)+-1|0;c[3483]=0;c[3484]=e}e=Db(13932,11420,13932)|0;return c[(c[3480]|0)+(e<<2)>>2]|0}function wb(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0;a=c[d>>2]|0;e=ch(c[a+340>>2]|0,2848,2888,0)|0;f=c[a+344>>2]|0;if(!f){g=0;h=a}else{a=f+4|0;c[a>>2]=(c[a>>2]|0)+1;g=f;h=c[d>>2]|0}d=c[b>>2]|0;c[d+(((c[d+((c[e+4>>2]|0)*48|0)+32>>2]|0)+1|0)*48|0)+36>>2]=c[h+332>>2];if(!g)return;h=g+4|0;e=c[h>>2]|0;c[h>>2]=e+-1;if(e|0)return;Ra[c[(c[g>>2]|0)+8>>2]&127](g);ng(g);return}function xb(a,b){a=a|0;b=b|0;return}function yb(a,b,c,d,e){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;return}function zb(a,b,c,d,e){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;return}function Ab(a,b,d){a=a|0;b=b|0;d=d|0;a=c[b>>2]|0;if((c[b+4>>2]|0)==(a|0))return 1;else return (c[(c[a>>2]|0)+332>>2]|0)==(c[(c[d>>2]|0)+332>>2]|0)|0;return 0}function Bb(a,b){a=a|0;b=b|0;return (c[b+4>>2]|0)-(c[b>>2]|0)>>3>>>0>2|0}function Cb(a){a=a|0;return}function Db(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;a=c[d>>2]|0;e=(c[d+4>>2]|0)-a|0;f=e+1|0;if(!e){g=a;return g|0}if(!f){a=b+2496|0;e=c[a>>2]|0;h=((e+1|0)>>>0)%624|0;i=b+(e<<2)|0;j=c[b+(h<<2)>>2]|0;k=0-(j&1)&-1727483681^c[b+((((e+397|0)>>>0)%624|0)<<2)>>2]^(j&2147483646|c[i>>2]&-2147483648)>>>1;c[i>>2]=k;i=k>>>11^k;c[a>>2]=h;h=i<<7&-1658038656^i;i=h<<15&-272236544^h;g=i>>>18^i;return g|0}i=32-(w(f|0)|0)|0;h=i+(((-1>>>(33-i|0)&f|0)==0)<<31>>31)|0;i=(h>>>5)+((h&31|0)!=0&1)|0;a=i>>>0>h>>>0?0:-1>>>(32-((h>>>0)/(i>>>0)|0)|0);i=b+2496|0;h=c[i>>2]|0;do{k=h;h=((h+1|0)>>>0)%624|0;j=b+(k<<2)|0;e=c[b+(h<<2)>>2]|0;l=0-(e&1)&-1727483681^c[b+((((k+397|0)>>>0)%624|0)<<2)>>2]^(e&2147483646|c[j>>2]&-2147483648)>>>1;c[j>>2]=l;j=l>>>11^l;l=j<<7&-1658038656^j;j=l<<15&-272236544^l;m=(j>>>18^j)&a}while(m>>>0>=f>>>0);c[i>>2]=h;g=(c[d>>2]|0)+m|0;return g|0}function Eb(a){a=a|0;mg(a);pg(a);return}function Fb(b){b=b|0;var d=0;d=c[b+12>>2]|0;if(!d)return;c[d>>2]=3740;b=d+4|0;if((a[b+11>>0]|0)<0)pg(c[b>>2]|0);pg(d);return}function Gb(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==6136?a+12|0:0)|0}function Hb(a){a=a|0;pg(a);return}function Ib(b,d,e,f){b=b|0;d=d|0;e=e|0;f=f|0;var h=0.0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0;if((a[11272]|0)==0?Ch(11272)|0:0){c[3485]=0;c[3486]=0;c[3487]=0;a[13951]=5;a[13940]=a[6056]|0;a[13941]=a[6057]|0;a[13942]=a[6058]|0;a[13943]=a[6059]|0;a[13944]=a[6060]|0;a[13945]=0}if((a[11280]|0)==0?Ch(11280)|0:0){c[3488]=0;c[3489]=0;c[3490]=0;f=og(32)|0;c[3488]=f;c[3490]=-2147483616;c[3489]=21;e=f;d=6062;b=e+21|0;do{a[e>>0]=a[d>>0]|0;e=e+1|0;d=d+1|0}while((e|0)<(b|0));a[f+21>>0]=0}if((a[11288]|0)==0?Ch(11288)|0:0){f=a[13951]|0;d=(f<<24>>24<0?c[3486]|0:f&255)+-1|0;c[3491]=0;c[3492]=d}if((a[11296]|0)==0?Ch(11296)|0:0){d=a[13963]|0;f=(d<<24>>24<0?c[3489]|0:d&255)+-1|0;c[3493]=0;c[3494]=f}if((a[11304]|0)==0?Ch(11304)|0:0)g[1419]=1.0;h=+g[1419]-0.0;f=c[3479]|0;d=((f+1|0)>>>0)%624|0;e=11420+(f<<2)|0;b=11420+(d<<2)|0;i=c[b>>2]|0;j=0-(i&1)&-1727483681^c[11420+((((f+397|0)>>>0)%624|0)<<2)>>2]^(i&2147483646|c[e>>2]&-2147483648)>>>1;c[e>>2]=j;e=j>>>11^j;j=e<<7&-1658038656^e;e=j<<15&-272236544^j;j=((d+1|0)>>>0)%624|0;i=c[11420+(j<<2)>>2]|0;f=0-(i&1)&-1727483681^c[11420+((((d+397|0)>>>0)%624|0)<<2)>>2]^(i&2147483646|c[b>>2]&-2147483648)>>>1;c[b>>2]=f;b=f>>>11^f;f=b<<7&-1658038656^b;b=f<<15&-272236544^f;c[3479]=j;if(!(h*((+((b>>>18^b)>>>0)*4294967296.0+ +((e>>>18^e)>>>0))*5.421010862427522e-20)+0.0<=.3700000047683716)){k=Db(13972,11420,13972)|0;l=13952;m=Ig(l,k)|0;n=a[m>>0]|0;o=n<<24>>24;p=o+-65|0;return p|0}else{k=Db(13964,11420,13964)|0;l=13940;m=Ig(l,k)|0;n=a[m>>0]|0;o=n<<24>>24;p=o+-65|0;return p|0}return 0}function Jb(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0;f=Ja;Ja=Ja+32|0;if((Ja|0)>=(Ka|0))A(32);g=f;h=f+16|0;i=c[e>>2]|0;e=c[i+332>>2]<<24;j=(e+1090519040|0)>>>24;a:do if(!e)k=3;else{l=e+-67108864|0;switch(l>>>25|l<<7|0){case 0:case 2:case 5:case 8:{k=3;break a;break}default:{}}m=b+16|0}while(0);if((k|0)==3)m=b+20|0;c[m>>2]=(c[m>>2]|0)+1;m=c[i+340>>2]|0;if((m|0)!=0?(b=ch(m,2848,2888,0)|0,(b|0)!=0):0){m=c[i+344>>2]|0;if(!m){n=b;o=0}else{i=m+4|0;c[i>>2]=(c[i>>2]|0)+1;n=b;o=m}}else{n=0;o=0}m=c[d>>2]|0;c[m+(((c[m+((c[n+4>>2]|0)*48|0)+32>>2]|0)+1|0)*48|0)+36>>2]=577149439;a[g>>0]=j;a[g+1>>0]=0;j=c[n+324>>2]|0;c[h>>2]=0;c[h+4>>2]=0;c[h+8>>2]=0;n=nf(g)|0;if(n>>>0>4294967279)wg(h);if(n>>>0<11){a[h+11>>0]=n;if(!n)p=h;else{q=h;k=14}}else{m=n+16&-16;b=og(m)|0;c[h>>2]=b;c[h+8>>2]=m|-2147483648;c[h+4>>2]=n;q=b;k=14}if((k|0)==14){Rh(q|0,g|0,n|0)|0;p=q}a[p+n>>0]=0;Qb(j,d,h);if((a[h+11>>0]|0)<0)pg(c[h>>2]|0);if(!o){Ja=f;return}h=o+4|0;d=c[h>>2]|0;c[h>>2]=d+-1;if(d|0){Ja=f;return}Ra[c[(c[o>>2]|0)+8>>2]&127](o);ng(o);Ja=f;return}function Kb(a,b){a=a|0;b=b|0;var d=0,e=0,f=0;d=c[(c[b>>2]|0)+332>>2]<<24;a:do if(!d)e=3;else{b=d+-67108864|0;switch(b>>>25|b<<7|0){case 0:case 2:case 5:case 8:{e=3;break a;break}default:{}}f=a+16|0}while(0);if((e|0)==3)f=a+20|0;c[f>>2]=(c[f>>2]|0)+-1;return}function Lb(b,d,e,f,g){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0;g=Ja;Ja=Ja+16|0;if((Ja|0)>=(Ka|0))A(16);f=g;e=b+4|0;d=e+11|0;if((a[d>>0]|0)<0)h=c[e>>2]|0;else h=e;c[f>>2]=h;cg(6084,f)|0;f=a[d>>0]|0;if(f<<24>>24<0){h=b+8|0;b=(c[h>>2]|0)+-1|0;c[h>>2]=b;i=(c[e>>2]|0)+b|0;a[i>>0]=0;Ja=g;return}else{b=(f&255)+-1|0;a[d>>0]=b;i=e+b|0;a[i>>0]=0;Ja=g;return}}function Mb(b,d,e,f,g){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0,j=0,k=0;g=Ja;Ja=Ja+16|0;if((Ja|0)>=(Ka|0))A(16);e=g;d=(c[(c[f>>2]|0)+332>>2]|0)+65|0;h=b+4|0;Kg(h,d&255);b=h+11|0;if((a[b>>0]|0)<0)i=c[h>>2]|0;else i=h;j=X(i|0)|0;i=c[(c[f>>2]|0)+332>>2]|0;if((a[b>>0]|0)<0)k=c[h>>2]|0;else k=h;c[e>>2]=d<<24>>24;c[e+4>>2]=i;c[e+8>>2]=k;c[e+12>>2]=j?6129:6133;cg(6100,e)|0;Ja=g;return}function Nb(a,b,c){a=a|0;b=b|0;c=c|0;return 1}function Ob(b,d){b=b|0;d=d|0;var e=0,f=0;if((c[d+4>>2]|0)-(c[d>>2]|0)>>3>>>0<=2){e=0;return e|0}d=b+4|0;if((a[d+11>>0]|0)<0)f=c[d>>2]|0;else f=d;e=X(f|0)|0;return e|0}function Pb(a){a=a|0;Gg(a+4|0,14592)|0;return}function Qb(b,d,e){b=b|0;d=d|0;e=e|0;var g=0,h=0,i=0,j=0,k=0,l=0;g=b+4|0;h=c[d>>2]|0;i=(c[h+((c[g>>2]|0)*48|0)+32>>2]|0)+1|0;if((c[h+(i*48|0)+44>>2]|0)==8){if(!(Sb(11396,e)|0)){j=c[2847]|0;k=(j-(c[2846]|0)|0)/12|0;l=j;if((c[2848]|0)==(l|0))Tb(11384,e);else{yg(l,e);c[2847]=(c[2847]|0)+12}c[(Rb(11396,e)|0)>>2]=k}c[h+(i*48|0)+36>>2]=c[(Rb(11396,e)|0)>>2];f[h+(i*48|0)+16>>2]=+U(((a[e+11>>0]|0)<0?c[e>>2]|0:e)|0,+(+f[h+(i*48|0)+20>>2]))}if((c[b+56>>2]|0)!=2)return;i=c[g>>2]|0;g=c[d>>2]|0;h=g+(((c[g+(i*48|0)+32>>2]|0)+1|0)*48|0)+16|0;e=c[h+4>>2]|0;k=g+(i*48|0)+24|0;c[k>>2]=c[h>>2];c[k+4>>2]=e;Wa[c[(c[b>>2]|0)+8>>2]&15](b,d,b+44|0,b+36|0);return}function Rb(b,e){b=b|0;e=e|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0.0,G=0.0,H=0,I=0,J=0,K=0;g=a[e+11>>0]|0;h=g<<24>>24<0;i=h?c[e>>2]|0:e;j=h?c[e+4>>2]|0:g&255;if(j>>>0>3){g=i;h=j;k=j;while(1){l=v(d[g>>0]|d[g+1>>0]<<8|d[g+2>>0]<<16|d[g+3>>0]<<24,1540483477)|0;h=(v(l>>>24^l,1540483477)|0)^(v(h,1540483477)|0);k=k+-4|0;if(k>>>0<=3)break;else g=g+4|0}g=j+-4|0;k=g&-4;m=g-k|0;n=i+(k+4)|0;o=h}else{m=j;n=i;o=j}switch(m|0){case 3:{p=d[n+2>>0]<<16^o;q=7;break}case 2:{p=o;q=7;break}case 1:{r=o;q=8;break}default:s=o}if((q|0)==7){r=d[n+1>>0]<<8^p;q=8}if((q|0)==8)s=v(r^d[n>>0],1540483477)|0;n=v(s>>>13^s,1540483477)|0;s=n>>>15^n;n=b+4|0;r=c[n>>2]|0;p=(r|0)==0;a:do if(!p){o=r+-1|0;m=(o&r|0)==0;if(!m)if(s>>>0<r>>>0)t=s;else t=(s>>>0)%(r>>>0)|0;else t=s&o;h=c[(c[b>>2]|0)+(t<<2)>>2]|0;if((h|0)!=0?(k=c[h>>2]|0,(k|0)!=0):0){h=(j|0)==0;if(m){if(h){m=k;while(1){g=c[m+4>>2]|0;if(!((g|0)==(s|0)|(g&o|0)==(t|0))){w=t;break a}g=a[m+8+11>>0]|0;if(!((g<<24>>24<0?c[m+12>>2]|0:g&255)|0)){x=m;break}m=c[m>>2]|0;if(!m){w=t;break a}}y=x+20|0;return y|0}m=k;b:while(1){g=c[m+4>>2]|0;if(!((g|0)==(s|0)|(g&o|0)==(t|0))){w=t;break a}g=m+8|0;l=a[g+11>>0]|0;z=l<<24>>24<0;A=l&255;do if(((z?c[m+12>>2]|0:A)|0)==(j|0)){l=c[g>>2]|0;if(z)if(!(Xf(l,i,j)|0)){x=m;q=68;break b}else break;if((a[i>>0]|0)==(l&255)<<24>>24){l=g;B=A;C=i;do{B=B+-1|0;l=l+1|0;if(!B){x=m;q=68;break b}C=C+1|0}while((a[l>>0]|0)==(a[C>>0]|0))}}while(0);m=c[m>>2]|0;if(!m){w=t;break a}}if((q|0)==68){y=x+20|0;return y|0}}if(h){m=k;while(1){o=c[m+4>>2]|0;if((o|0)!=(s|0)){if(o>>>0<r>>>0)D=o;else D=(o>>>0)%(r>>>0)|0;if((D|0)!=(t|0)){w=t;break a}}o=a[m+8+11>>0]|0;if(!((o<<24>>24<0?c[m+12>>2]|0:o&255)|0)){x=m;break}m=c[m>>2]|0;if(!m){w=t;break a}}y=x+20|0;return y|0}m=k;c:while(1){h=c[m+4>>2]|0;if((h|0)!=(s|0)){if(h>>>0<r>>>0)E=h;else E=(h>>>0)%(r>>>0)|0;if((E|0)!=(t|0)){w=t;break a}}h=m+8|0;o=a[h+11>>0]|0;A=o<<24>>24<0;g=o&255;do if(((A?c[m+12>>2]|0:g)|0)==(j|0)){o=c[h>>2]|0;if(A)if(!(Xf(o,i,j)|0)){x=m;q=68;break c}else break;if((a[i>>0]|0)==(o&255)<<24>>24){o=h;z=g;C=i;do{z=z+-1|0;o=o+1|0;if(!z){x=m;q=68;break c}C=C+1|0}while((a[o>>0]|0)==(a[C>>0]|0))}}while(0);m=c[m>>2]|0;if(!m){w=t;break a}}if((q|0)==68){y=x+20|0;return y|0}}else w=t}else w=0;while(0);t=og(24)|0;yg(t+8|0,e);c[t+20>>2]=0;c[t+4>>2]=s;c[t>>2]=0;e=b+12|0;F=+(((c[e>>2]|0)+1|0)>>>0);G=+f[b+16>>2];do if(p|G*+(r>>>0)<F){i=r<<1|(r>>>0<3|(r+-1&r|0)!=0)&1;j=~~+u(+(F/G))>>>0;Ub(b,i>>>0<j>>>0?j:i);i=c[n>>2]|0;j=i+-1|0;if(!(j&i)){H=i;I=j&s;break}if(s>>>0<i>>>0){H=i;I=s}else{H=i;I=(s>>>0)%(i>>>0)|0}}else{H=r;I=w}while(0);w=(c[b>>2]|0)+(I<<2)|0;I=c[w>>2]|0;if(!I){r=b+8|0;c[t>>2]=c[r>>2];c[r>>2]=t;c[w>>2]=r;r=c[t>>2]|0;if(r|0){w=c[r+4>>2]|0;r=H+-1|0;if(r&H)if(w>>>0<H>>>0)J=w;else J=(w>>>0)%(H>>>0)|0;else J=w&r;K=(c[b>>2]|0)+(J<<2)|0;q=66}}else{c[t>>2]=c[I>>2];K=I;q=66}if((q|0)==66)c[K>>2]=t;c[e>>2]=(c[e>>2]|0)+1;x=t;y=x+20|0;return y|0}function Sb(b,e){b=b|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,w=0;f=a[e+11>>0]|0;g=f<<24>>24<0;h=g?c[e>>2]|0:e;i=g?c[e+4>>2]|0:f&255;if(i>>>0>3){f=h;e=i;g=i;while(1){j=v(d[f>>0]|d[f+1>>0]<<8|d[f+2>>0]<<16|d[f+3>>0]<<24,1540483477)|0;e=(v(j>>>24^j,1540483477)|0)^(v(e,1540483477)|0);g=g+-4|0;if(g>>>0<=3)break;else f=f+4|0}f=i+-4|0;g=f&-4;k=f-g|0;l=h+(g+4)|0;m=e}else{k=i;l=h;m=i}switch(k|0){case 3:{n=d[l+2>>0]<<16^m;o=7;break}case 2:{n=m;o=7;break}case 1:{p=m;o=8;break}default:q=m}if((o|0)==7){p=d[l+1>>0]<<8^n;o=8}if((o|0)==8)q=v(p^d[l>>0],1540483477)|0;l=v(q>>>13^q,1540483477)|0;q=l>>>15^l;l=c[b+4>>2]|0;if(!l){r=0;return r|0}p=l+-1|0;n=(p&l|0)==0;if(!n)if(q>>>0<l>>>0)s=q;else s=(q>>>0)%(l>>>0)|0;else s=q&p;m=c[(c[b>>2]|0)+(s<<2)>>2]|0;if(!m){r=0;return r|0}b=c[m>>2]|0;if(!b){r=0;return r|0}m=(i|0)==0;if(n){n=b;a:while(1){k=c[n+4>>2]|0;e=(k|0)==(q|0);if(!(e|(k&p|0)==(s|0))){r=0;o=45;break}do if(e?(k=n+8|0,g=a[k+11>>0]|0,f=g<<24>>24<0,j=g&255,((f?c[n+12>>2]|0:j)|0)==(i|0)):0){g=c[k>>2]|0;t=f?g:k;u=g&255;if(f){if(m){r=n;o=45;break a}if(!(Xf(t,h,i)|0)){r=n;o=45;break a}else break}if(m){r=n;o=45;break a}if((a[h>>0]|0)==u<<24>>24){u=k;k=j;j=h;do{k=k+-1|0;u=u+1|0;if(!k){r=n;o=45;break a}j=j+1|0}while((a[u>>0]|0)==(a[j>>0]|0))}}while(0);n=c[n>>2]|0;if(!n){r=0;o=45;break}}if((o|0)==45)return r|0}n=b;b:while(1){b=c[n+4>>2]|0;do if((b|0)==(q|0)){p=n+8|0;e=a[p+11>>0]|0;j=e<<24>>24<0;u=e&255;if(((j?c[n+12>>2]|0:u)|0)==(i|0)){e=c[p>>2]|0;k=j?e:p;t=e&255;if(j){if(m){r=n;o=45;break b}if(!(Xf(k,h,i)|0)){r=n;o=45;break b}else break}if(m){r=n;o=45;break b}if((a[h>>0]|0)==t<<24>>24){t=p;p=u;u=h;do{p=p+-1|0;t=t+1|0;if(!p){r=n;o=45;break b}u=u+1|0}while((a[t>>0]|0)==(a[u>>0]|0))}}}else{if(b>>>0<l>>>0)w=b;else w=(b>>>0)%(l>>>0)|0;if((w|0)!=(s|0)){r=0;o=45;break b}}while(0);n=c[n>>2]|0;if(!n){r=0;o=45;break}}if((o|0)==45)return r|0;return 0}function Tb(b,d){b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0;e=b+4|0;f=c[b>>2]|0;g=((c[e>>2]|0)-f|0)/12|0;h=g+1|0;if(h>>>0>357913941)Og(b);i=b+8|0;j=((c[i>>2]|0)-f|0)/12|0;f=j<<1;k=j>>>0<178956970?(f>>>0<h>>>0?h:f):357913941;do if(k)if(k>>>0>357913941){f=ea(8)|0;ug(f,5594);c[f>>2]=5332;ia(f|0,3520,71)}else{l=og(k*12|0)|0;break}else l=0;while(0);f=l+(g*12|0)|0;g=l+(k*12|0)|0;yg(f,d);d=f+12|0;k=c[b>>2]|0;l=c[e>>2]|0;if((l|0)==(k|0)){m=f;n=k;o=k}else{h=l;l=f;do{l=l+-12|0;h=h+-12|0;c[l>>2]=c[h>>2];c[l+4>>2]=c[h+4>>2];c[l+8>>2]=c[h+8>>2];c[h>>2]=0;c[h+4>>2]=0;c[h+8>>2]=0}while((h|0)!=(k|0));m=l;n=c[b>>2]|0;o=c[e>>2]|0}c[b>>2]=m;c[e>>2]=d;c[i>>2]=g;g=n;if((o|0)!=(g|0)){i=o;do{i=i+-12|0;if((a[i+11>>0]|0)<0)pg(c[i>>2]|0)}while((i|0)!=(g|0))}if(!n)return;pg(n);return}function Ub(a,b){a=a|0;b=b|0;var d=0,e=0,g=0,h=0;if((b|0)!=1)if(!(b+-1&b))d=b;else d=kg(b)|0;else d=2;b=c[a+4>>2]|0;if(d>>>0>b>>>0){Vb(a,d);return}if(d>>>0>=b>>>0)return;e=~~+u(+(+((c[a+12>>2]|0)>>>0)/+f[a+16>>2]))>>>0;if(b>>>0>2&(b+-1&b|0)==0){g=1<<32-(w(e+-1|0)|0);h=e>>>0<2?e:g}else h=kg(e)|0;e=d>>>0<h>>>0?h:d;if(e>>>0>=b>>>0)return;Vb(a,e);return}function Vb(b,d){b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0;e=b+4|0;if(!d){f=c[b>>2]|0;c[b>>2]=0;if(f|0)pg(f);c[e>>2]=0;return}if(d>>>0>1073741823){f=ea(8)|0;ug(f,5594);c[f>>2]=5332;ia(f|0,3520,71)}f=og(d<<2)|0;g=c[b>>2]|0;c[b>>2]=f;if(g|0)pg(g);c[e>>2]=d;e=0;do{c[(c[b>>2]|0)+(e<<2)>>2]=0;e=e+1|0}while((e|0)!=(d|0));e=b+8|0;g=c[e>>2]|0;if(!g)return;f=c[g+4>>2]|0;h=d+-1|0;i=(h&d|0)==0;if(!i)if(f>>>0<d>>>0)j=f;else j=(f>>>0)%(d>>>0)|0;else j=f&h;c[(c[b>>2]|0)+(j<<2)>>2]=e;e=c[g>>2]|0;if(!e)return;f=j;j=e;e=g;while(1){g=c[j+4>>2]|0;if(!i)if(g>>>0<d>>>0)k=g;else k=(g>>>0)%(d>>>0)|0;else k=g&h;do if((k|0)==(f|0)){l=f;m=j}else{g=(c[b>>2]|0)+(k<<2)|0;if(!(c[g>>2]|0)){c[g>>2]=e;l=k;m=j;break}g=c[j>>2]|0;a:do if(!g)n=j;else{o=j+8|0;p=a[o+11>>0]|0;q=p<<24>>24<0;r=p&255;p=q?c[j+12>>2]|0:r;s=(p|0)==0;if(q){q=j;t=g;while(1){u=t+8|0;v=a[u+11>>0]|0;w=v<<24>>24<0;if((p|0)!=((w?c[t+12>>2]|0:v&255)|0)){n=q;break a}if(!s?Xf(c[o>>2]|0,w?c[u>>2]|0:u,p)|0:0){n=q;break a}u=c[t>>2]|0;if(!u){n=t;break a}else{w=t;t=u;q=w}}}if(s){q=j;t=g;while(1){w=a[t+8+11>>0]|0;if((w<<24>>24<0?c[t+12>>2]|0:w&255)|0){n=q;break a}w=c[t>>2]|0;if(!w){n=t;break a}else{u=t;t=w;q=u}}}q=j;t=g;while(1){s=t+8|0;u=a[s+11>>0]|0;w=u<<24>>24<0;if((p|0)!=((w?c[t+12>>2]|0:u&255)|0)){n=q;break a}u=w?c[s>>2]|0:s;if((a[u>>0]|0)!=(c[o>>2]&255)<<24>>24){n=q;break a}s=o;w=r;v=u;while(1){w=w+-1|0;s=s+1|0;if(!w)break;v=v+1|0;if((a[s>>0]|0)!=(a[v>>0]|0)){n=q;break a}}v=c[t>>2]|0;if(!v){n=t;break}else{s=t;t=v;q=s}}}while(0);c[e>>2]=c[n>>2];c[n>>2]=c[c[(c[b>>2]|0)+(k<<2)>>2]>>2];c[c[(c[b>>2]|0)+(k<<2)>>2]>>2]=j;l=f;m=e}while(0);j=c[m>>2]|0;if(!j)break;else{f=l;e=m}}return}function Wb(a){a=a|0;mg(a);pg(a);return}function Xb(a){a=a|0;var b=0;b=c[a+12>>2]|0;if(!b)return;pg(b);return}function Yb(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==6283?a+12|0:0)|0}function Zb(a){a=a|0;pg(a);return}function _b(b,d,e,f){b=b|0;d=d|0;e=e|0;f=f|0;var h=0,i=0,j=0,k=0,l=0.0,m=0,n=0,o=0,p=0,q=0,r=0,s=0.0,t=0,u=0;h=Ja;Ja=Ja+32|0;if((Ja|0)>=(Ka|0))A(32);i=h+16|0;j=h+8|0;k=h;if((a[11312]|0)==0?Ch(11312)|0:0)g[1420]=1.0;l=+g[1420]-0.0;m=c[3479]|0;n=((m+1|0)>>>0)%624|0;o=11420+(m<<2)|0;p=11420+(n<<2)|0;q=c[p>>2]|0;r=0-(q&1)&-1727483681^c[11420+((((m+397|0)>>>0)%624|0)<<2)>>2]^(q&2147483646|c[o>>2]&-2147483648)>>>1;c[o>>2]=r;o=r>>>11^r;r=o<<7&-1658038656^o;o=r<<15&-272236544^r;r=((n+1|0)>>>0)%624|0;q=c[11420+(r<<2)>>2]|0;m=0-(q&1)&-1727483681^c[11420+((((n+397|0)>>>0)%624|0)<<2)>>2]^(q&2147483646|c[p>>2]&-2147483648)>>>1;c[p>>2]=m;p=m>>>11^m;m=p<<7&-1658038656^p;p=m<<15&-272236544^m;c[3479]=r;s=l*((+((p>>>18^p)>>>0)*4294967296.0+ +((o>>>18^o)>>>0))*5.421010862427522e-20)+0.0;c[i>>2]=c[d>>2];o=i+4|0;p=d+4|0;r=c[p>>2]|0;c[o>>2]=r;if(r|0){m=r+4|0;c[m>>2]=(c[m>>2]|0)+1}if(gc(b,i,e,f)|0){c[j>>2]=c[d>>2];i=j+4|0;m=c[p>>2]|0;c[i>>2]=m;if(m|0){r=m+4|0;c[r>>2]=(c[r>>2]|0)+1}r=hc(b,j,e,f)|0;j=c[i>>2]|0;if((j|0)!=0?(i=j+4|0,m=c[i>>2]|0,c[i>>2]=m+-1,(m|0)==0):0){Ra[c[(c[j>>2]|0)+8>>2]&127](j);ng(j);t=r}else t=r}else t=0;r=c[o>>2]|0;if(r|0?(o=r+4|0,j=c[o>>2]|0,c[o>>2]=j+-1,(j|0)==0):0){Ra[c[(c[r>>2]|0)+8>>2]&127](r);ng(r)}if(t){if((a[11320]|0)==0?Ch(11320)|0:0){c[3495]=1;c[3496]=2}if((c[b+4>>2]|0)<2){u=131072;Ja=h;return u|0}if((c[b+8>>2]|0)<2){u=65536;Ja=h;return u|0}u=(ic(13980,11420,13980)|0)<<16;Ja=h;return u|0}c[k>>2]=c[d>>2];d=k+4|0;t=c[p>>2]|0;c[d>>2]=t;if(t|0){p=t+4|0;c[p>>2]=(c[p>>2]|0)+1}p=s<.4&(gc(b,k,e,f)|0);f=c[d>>2]|0;if(f|0?(d=f+4|0,e=c[d>>2]|0,c[d>>2]=e+-1,(e|0)==0):0){Ra[c[(c[f>>2]|0)+8>>2]&127](f);ng(f)}if(p){if((a[11328]|0)==0?Ch(11328)|0:0){c[3497]=3;c[3498]=4}u=(ic(13988,11420,13988)|0)<<16;Ja=h;return u|0}else{if((a[11336]|0)==0?Ch(11336)|0:0){c[3499]=1;c[3500]=9}p=Db(13996,11420,13996)|0;u=(p>>31&65280)+((p|0)<0?0-p|0:p)|0;Ja=h;return u|0}return 0}function $b(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0;f=Ja;Ja=Ja+32|0;if((Ja|0)>=(Ka|0))A(32);g=f+16|0;h=f;i=c[e>>2]|0;e=c[i+332>>2]|0;j=e&255;k=e>>>16;c[g>>2]=k;c[g+4>>2]=(e&65280|0)==0?j:0-j|0;j=k&65535;switch(j<<16>>16){case 2:{l=b+4|0;m=4;break}case 1:{l=b+8|0;m=4;break}default:{}}if((m|0)==4)c[l>>2]=(c[l>>2]|0)+1;l=c[i+340>>2]|0;if((l|0)!=0?(b=ch(l,2848,2888,0)|0,(b|0)!=0):0){l=c[i+344>>2]|0;if(!l){n=b;o=0}else{i=l+4|0;c[i>>2]=(c[i>>2]|0)+1;n=b;o=l}}else{n=0;o=0}switch(j<<16>>16){case 0:{j=c[d>>2]|0;p=577149439;q=j;r=j+((c[n+4>>2]|0)*48|0)+32|0;m=15;break}case 2:{j=c[d>>2]|0;p=-1156500481;q=j;r=j+((c[n+4>>2]|0)*48|0)+32|0;m=15;break}case 1:{j=c[d>>2]|0;p=581588479;q=j;r=j+((c[n+4>>2]|0)*48|0)+32|0;m=15;break}case 3:{j=c[d>>2]|0;p=572666879;q=j;r=j+((c[n+4>>2]|0)*48|0)+32|0;m=15;break}case 4:{j=c[d>>2]|0;p=855646975;q=j;r=j+((c[n+4>>2]|0)*48|0)+32|0;m=15;break}default:{}}if((m|0)==15)c[q+(((c[r>>2]|0)+1|0)*48|0)+36>>2]=p;p=c[n+324>>2]|0;jc(h,g);Qb(p,d,h);if((a[h+11>>0]|0)<0)pg(c[h>>2]|0);if(!o){Ja=f;return}h=o+4|0;d=c[h>>2]|0;c[h>>2]=d+-1;if(d|0){Ja=f;return}Ra[c[(c[o>>2]|0)+8>>2]&127](o);ng(o);Ja=f;return}function ac(a,b){a=a|0;b=b|0;var d=0,e=0;switch(((c[(c[b>>2]|0)+332>>2]|0)>>>16&65535)<<16>>16){case 2:{d=a+4|0;e=-1;break}case 1:{d=a+8|0;e=1;break}default:return}c[d>>2]=(c[d>>2]|0)+e;return}function bc(b,d,e,f,h){b=b|0;d=d|0;e=e|0;f=f|0;h=h|0;var i=0,j=0,k=0,l=0.0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0;f=Ja;Ja=Ja+48|0;if((Ja|0)>=(Ka|0))A(48);i=f+16|0;j=f+28|0;k=f;lc(j,e);l=+kc(b,j);b=c[j>>2]|0;if(b|0){e=j+4|0;m=c[e>>2]|0;if((m|0)==(b|0))n=b;else{o=m;do{m=c[o+-4>>2]|0;o=o+-8|0;if(m|0?(p=m+4|0,q=c[p>>2]|0,c[p>>2]=q+-1,(q|0)==0):0){Ra[c[(c[m>>2]|0)+8>>2]&127](m);ng(m)}}while((o|0)!=(b|0));n=c[j>>2]|0}c[e>>2]=b;pg(n)}g[i>>3]=l;ag(k,6352,i)|0;n=c[h>>2]|0;c[i>>2]=0;c[i+4>>2]=0;c[i+8>>2]=0;h=nf(k)|0;if(h>>>0>4294967279)wg(i);if(h>>>0<11){a[i+11>>0]=h;if(!h)r=i;else{s=i;t=15}}else{b=h+16&-16;e=og(b)|0;c[i>>2]=e;c[i+8>>2]=b|-2147483648;c[i+4>>2]=h;s=e;t=15}if((t|0)==15){Rh(s|0,k|0,h|0)|0;r=s}a[r+h>>0]=0;Qb(n,d,i);if((a[i+11>>0]|0)>=0){Ja=f;return}pg(c[i>>2]|0);Ja=f;return}function cc(b,d,e,f,h){b=b|0;d=d|0;e=e|0;f=f|0;h=h|0;var i=0,j=0,k=0,l=0,m=0.0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0;f=Ja;Ja=Ja+64|0;if((Ja|0)>=(Ka|0))A(64);i=f+32|0;j=f+16|0;k=f+48|0;l=f;lc(k,e);m=+kc(b,k);b=c[k>>2]|0;if(b|0){e=k+4|0;n=c[e>>2]|0;if((n|0)==(b|0))o=b;else{p=n;do{n=c[p+-4>>2]|0;p=p+-8|0;if(n|0?(q=n+4|0,r=c[q>>2]|0,c[q>>2]=r+-1,(r|0)==0):0){Ra[c[(c[n>>2]|0)+8>>2]&127](n);ng(n)}}while((p|0)!=(b|0));o=c[k>>2]|0}c[e>>2]=b;pg(o)}g[j>>3]=m;ag(l,6352,j)|0;o=c[h>>2]|0;c[j>>2]=0;c[j+4>>2]=0;c[j+8>>2]=0;h=nf(l)|0;if(h>>>0>4294967279)wg(j);if(h>>>0<11){a[j+11>>0]=h;if(!h)s=j;else{t=j;u=15}}else{b=h+16&-16;e=og(b)|0;c[j>>2]=e;c[j+8>>2]=b|-2147483648;c[j+4>>2]=h;t=e;u=15}if((u|0)==15){Rh(t|0,l|0,h|0)|0;s=t}a[s+h>>0]=0;Qb(o,d,j);if((a[j+11>>0]|0)>=0){g[i>>3]=m;v=i+8|0;c[v>>2]=l;cg(6376,i)|0;Ja=f;return}pg(c[j>>2]|0);g[i>>3]=m;v=i+8|0;c[v>>2]=l;cg(6376,i)|0;Ja=f;return}function dc(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0;a=(c[(c[d>>2]|0)+332>>2]|0)>>>16;d=c[b>>2]|0;e=(c[b+4>>2]|0)-d|0;if(!e){f=(a|0)==0;return f|0}else{f=(c[(c[d+((e>>3)+-1<<3)>>2]|0)+332>>2]|0)>>>0<65536?(a|0)!=0:(a|0)==0;return f|0}return 0}function ec(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0.0,j=0,k=0,l=0;d=Ja;Ja=Ja+16|0;if((Ja|0)>=(Ka|0))A(16);e=d;f=c[b>>2]|0;g=(c[b+4>>2]|0)-f|0;if(!g){h=0;Ja=d;return h|0}if((c[(c[f+((g>>3)+-1<<3)>>2]|0)+332>>2]|0)>>>0>=65536){h=0;Ja=d;return h|0}lc(e,b);i=+kc(a,e);a=c[e>>2]|0;if(a|0){b=e+4|0;g=c[b>>2]|0;if((g|0)==(a|0))j=a;else{f=g;do{g=c[f+-4>>2]|0;f=f+-8|0;if(g|0?(k=g+4|0,l=c[k>>2]|0,c[k>>2]=l+-1,(l|0)==0):0){Ra[c[(c[g>>2]|0)+8>>2]&127](g);ng(g)}}while((f|0)!=(a|0));j=c[e>>2]|0}c[b>>2]=a;pg(j)}h=+s(+i)<.0001;Ja=d;return h|0}function fc(a){a=a|0;return}function gc(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0;do if(d|0){a=c[(c[(c[b>>2]|0)+424>>2]|0)+((d+-1|0)*12|0)>>2]|0;f=c[a+(e<<3)>>2]|0;g=c[a+(e<<3)+4>>2]|0;if(!g){if((((c[f+332>>2]|0)>>>16)+-1|0)>>>0<2)h=0;else break;return h|0}a=g+4|0;c[a>>2]=(c[a>>2]|0)+1;a=(((c[f+332>>2]|0)>>>16)+-1|0)>>>0<2;f=g+4|0;i=c[f>>2]|0;c[f>>2]=i+-1;if(!i){Ra[c[(c[g>>2]|0)+8>>2]&127](g);ng(g);if(a)h=0;else break;return h|0}else{if(a)h=0;else break;return h|0}}while(0);do if(e|0){a=e+-1|0;g=c[(c[(c[b>>2]|0)+424>>2]|0)+(d*12|0)>>2]|0;i=c[g+(a<<3)>>2]|0;f=c[g+(a<<3)+4>>2]|0;if(!f){if((((c[i+332>>2]|0)>>>16)+-1|0)>>>0<2)h=0;else break;return h|0}a=f+4|0;c[a>>2]=(c[a>>2]|0)+1;a=(((c[i+332>>2]|0)>>>16)+-1|0)>>>0<2;i=f+4|0;g=c[i>>2]|0;c[i>>2]=g+-1;if(!g){Ra[c[(c[f>>2]|0)+8>>2]&127](f);ng(f);if(a)h=0;else break;return h|0}else{if(a)h=0;else break;return h|0}}while(0);a=c[b>>2]|0;if(((c[a+336>>2]|0)+-1|0)>>>0>d>>>0){f=c[(c[a+424>>2]|0)+((d+1|0)*12|0)>>2]|0;g=c[f+(e<<3)>>2]|0;i=c[f+(e<<3)+4>>2]|0;do if(!i){if((((c[g+332>>2]|0)>>>16)+-1|0)>>>0<2){h=0;return h|0}}else{f=i+4|0;c[f>>2]=(c[f>>2]|0)+1;f=(((c[g+332>>2]|0)>>>16)+-1|0)>>>0<2;j=i+4|0;k=c[j>>2]|0;c[j>>2]=k+-1;if(!k){Ra[c[(c[i>>2]|0)+8>>2]&127](i);ng(i);if(f)h=0;else break;return h|0}else{if(f)h=0;else break;return h|0}}while(0);l=c[b>>2]|0}else l=a;if(((c[l+332>>2]|0)+-1|0)>>>0<=e>>>0){h=1;return h|0}a=e+1|0;e=c[(c[l+424>>2]|0)+(d*12|0)>>2]|0;d=c[e+(a<<3)>>2]|0;l=c[e+(a<<3)+4>>2]|0;if(!l){h=(((c[d+332>>2]|0)>>>16)+-1|0)>>>0>1;return h|0}a=l+4|0;c[a>>2]=(c[a>>2]|0)+1;a=(((c[d+332>>2]|0)>>>16)+-1|0)>>>0>1;d=l+4|0;e=c[d>>2]|0;c[d>>2]=e+-1;if(e|0){h=a;return h|0}Ra[c[(c[l>>2]|0)+8>>2]&127](l);ng(l);h=a;return h|0}function hc(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0;a=(d|0)!=0;f=(e|0)!=0;do if(a&f){g=e+-1|0;h=c[(c[(c[b>>2]|0)+424>>2]|0)+((d+-1|0)*12|0)>>2]|0;i=c[h+(g<<3)>>2]|0;j=c[h+(g<<3)+4>>2]|0;if(!j){if((((c[i+332>>2]|0)>>>16)+-1|0)>>>0<2)k=0;else break;return k|0}g=j+4|0;c[g>>2]=(c[g>>2]|0)+1;g=(((c[i+332>>2]|0)>>>16)+-1|0)>>>0<2;i=j+4|0;h=c[i>>2]|0;c[i>>2]=h+-1;if(!h){Ra[c[(c[j>>2]|0)+8>>2]&127](j);ng(j);if(g)k=0;else break;return k|0}else{if(g)k=0;else break;return k|0}}while(0);do if(a?(g=c[b>>2]|0,((c[g+332>>2]|0)+-1|0)>>>0>e>>>0):0){j=e+1|0;h=c[(c[g+424>>2]|0)+((d+-1|0)*12|0)>>2]|0;g=c[h+(j<<3)>>2]|0;i=c[h+(j<<3)+4>>2]|0;if(!i){if((((c[g+332>>2]|0)>>>16)+-1|0)>>>0<2)k=0;else break;return k|0}j=i+4|0;c[j>>2]=(c[j>>2]|0)+1;j=(((c[g+332>>2]|0)>>>16)+-1|0)>>>0<2;g=i+4|0;h=c[g>>2]|0;c[g>>2]=h+-1;if(!h){Ra[c[(c[i>>2]|0)+8>>2]&127](i);ng(i);if(j)k=0;else break;return k|0}else{if(j)k=0;else break;return k|0}}while(0);a=c[b>>2]|0;j=(c[a+336>>2]|0)+-1|0;if(f&j>>>0>d>>>0){f=e+-1|0;i=c[(c[a+424>>2]|0)+((d+1|0)*12|0)>>2]|0;h=c[i+(f<<3)>>2]|0;g=c[i+(f<<3)+4>>2]|0;do if(!g){if((((c[h+332>>2]|0)>>>16)+-1|0)>>>0<2){k=0;return k|0}}else{f=g+4|0;c[f>>2]=(c[f>>2]|0)+1;f=(((c[h+332>>2]|0)>>>16)+-1|0)>>>0<2;i=g+4|0;l=c[i>>2]|0;c[i>>2]=l+-1;if(!l){Ra[c[(c[g>>2]|0)+8>>2]&127](g);ng(g);if(f)k=0;else break;return k|0}else{if(f)k=0;else break;return k|0}}while(0);g=c[b>>2]|0;m=(c[g+336>>2]|0)+-1|0;n=g}else{m=j;n=a}if(m>>>0<=d>>>0){k=1;return k|0}if(((c[n+332>>2]|0)+-1|0)>>>0<=e>>>0){k=1;return k|0}m=e+1|0;e=c[(c[n+424>>2]|0)+((d+1|0)*12|0)>>2]|0;d=c[e+(m<<3)>>2]|0;n=c[e+(m<<3)+4>>2]|0;if(!n){k=(((c[d+332>>2]|0)>>>16)+-1|0)>>>0>1;return k|0}m=n+4|0;c[m>>2]=(c[m>>2]|0)+1;m=(((c[d+332>>2]|0)>>>16)+-1|0)>>>0>1;d=n+4|0;e=c[d>>2]|0;c[d>>2]=e+-1;if(e|0){k=m;return k|0}Ra[c[(c[n>>2]|0)+8>>2]&127](n);ng(n);k=m;return k|0}function ic(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;a=c[d>>2]|0;e=(c[d+4>>2]|0)-a|0;f=e+1|0;if(!e){g=a;return g|0}if(!f){a=b+2496|0;e=c[a>>2]|0;h=((e+1|0)>>>0)%624|0;i=b+(e<<2)|0;j=c[b+(h<<2)>>2]|0;k=0-(j&1)&-1727483681^c[b+((((e+397|0)>>>0)%624|0)<<2)>>2]^(j&2147483646|c[i>>2]&-2147483648)>>>1;c[i>>2]=k;i=k>>>11^k;c[a>>2]=h;h=i<<7&-1658038656^i;i=h<<15&-272236544^h;g=i>>>18^i;return g|0}i=32-(w(f|0)|0)|0;h=i+(((-1>>>(33-i|0)&f|0)==0)<<31>>31)|0;i=(h>>>5)+((h&31|0)!=0&1)|0;a=i>>>0>h>>>0?0:-1>>>(32-((h>>>0)/(i>>>0)|0)|0);i=b+2496|0;h=c[i>>2]|0;do{k=h;h=((h+1|0)>>>0)%624|0;j=b+(k<<2)|0;e=c[b+(h<<2)>>2]|0;l=0-(e&1)&-1727483681^c[b+((((k+397|0)>>>0)%624|0)<<2)>>2]^(e&2147483646|c[j>>2]&-2147483648)>>>1;c[j>>2]=l;j=l>>>11^l;l=j<<7&-1658038656^j;j=l<<15&-272236544^l;m=(j>>>18^j)&a}while(m>>>0>=f>>>0);c[i>>2]=h;g=(c[d>>2]|0)+m|0;return g|0}function jc(b,d){b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0;e=Ja;Ja=Ja+32|0;if((Ja|0)>=(Ka|0))A(32);f=e+16|0;g=e;switch(c[d>>2]|0){case 0:{c[f>>2]=c[d+4>>2];ag(g,6349,f)|0;c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;f=nf(g)|0;if(f>>>0>4294967279)wg(b);if(f>>>0<11){a[b+11>>0]=f;if(!f)h=b;else{i=b;j=7}}else{d=f+16&-16;k=og(d)|0;c[b>>2]=k;c[b+8>>2]=d|-2147483648;c[b+4>>2]=f;i=k;j=7}if((j|0)==7){Rh(i|0,g|0,f|0)|0;h=i}a[h+f>>0]=0;Ja=e;return}case 1:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=1;a[b>>0]=43;a[b+1>>0]=0;Ja=e;return}case 2:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=1;a[b>>0]=45;a[b+1>>0]=0;Ja=e;return}case 3:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=1;a[b>>0]=42;a[b+1>>0]=0;Ja=e;return}case 4:{c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;a[b+11>>0]=1;a[b>>0]=47;a[b+1>>0]=0;Ja=e;return}default:{}}}function kc(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,h=0.0,i=0,j=0,k=0.0,l=0,m=0,n=0,o=0,p=0,q=0.0;a=Ja;Ja=Ja+16|0;if((Ja|0)>=(Ka|0))A(16);d=a;e=b+4|0;f=c[b>>2]|0;if((c[e>>2]|0)==(f|0)){h=0.0;g[d>>3]=h;cg(6358,d)|0;Ja=a;return +h}i=1;j=0;k=0.0;l=f;while(1){f=l;m=c[f+(j<<3)>>2]|0;n=c[f+(j<<3)+4>>2]|0;f=(n|0)==0;if(!f){o=n+4|0;c[o>>2]=(c[o>>2]|0)+1}o=c[m+332>>2]|0;m=o&255;p=(o&65280|0)==0?m:0-m|0;m=i;i=o>>>16;a:do if(!i)switch((m&65535)<<16>>16){case 1:{q=k+ +(p|0);break a;break}case 2:{q=k-+(p|0);break a;break}case 3:{q=k*+(p|0);break a;break}case 4:{q=k/+(p|0);break a;break}default:{q=k;break a}}else q=k;while(0);if(!f?(p=n+4|0,m=c[p>>2]|0,c[p>>2]=m+-1,(m|0)==0):0){Ra[c[(c[n>>2]|0)+8>>2]&127](n);ng(n)}j=j+1|0;l=c[b>>2]|0;if(j>>>0>=(c[e>>2]|0)-l>>3>>>0){h=q;break}else k=q}g[d>>3]=h;cg(6358,d)|0;Ja=a;return +h}function lc(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0;c[a>>2]=0;d=a+4|0;c[d>>2]=0;e=a+8|0;c[e>>2]=0;f=b+4|0;g=(c[f>>2]|0)-(c[b>>2]|0)|0;h=g>>3;if(!g)return;if(h>>>0>536870911)Og(a);i=og(g)|0;c[d>>2]=i;c[a>>2]=i;c[e>>2]=i+(h<<3);h=c[b>>2]|0;b=c[f>>2]|0;if((h|0)==(b|0))return;f=h;h=i;do{c[h>>2]=c[f>>2];i=c[f+4>>2]|0;c[h+4>>2]=i;if(i|0){e=i+4|0;c[e>>2]=(c[e>>2]|0)+1}f=f+8|0;h=(c[d>>2]|0)+8|0;c[d>>2]=h}while((f|0)!=(b|0));return}function mc(a,b,d){a=a|0;b=b|0;d=d|0;c[a+56>>2]=d;return}function nc(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0;e=c[d>>2]|0;f=c[b>>2]|0;c[f+((c[a+4>>2]|0)*48|0)+36>>2]=c[f+((c[e+4>>2]|0)*48|0)+36>>2];f=a+316|0;b=c[f>>2]|0;if((b|0)==(c[a+320>>2]|0)){rc(a+312|0,d);return}c[b>>2]=e;e=c[d+4>>2]|0;c[b+4>>2]=e;if(!e)g=b;else{b=e+4|0;c[b>>2]=(c[b>>2]|0)+1;g=c[f>>2]|0}c[f>>2]=g+8;return}function oc(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var g=0,h=0,i=0,j=0,k=0,l=0.0,m=0.0,n=0,o=0,p=0.0,q=0.0,r=0.0,s=0.0;g=Ja;Ja=Ja+16|0;if((Ja|0)>=(Ka|0))A(16);h=g;i=d;j=c[i+4>>2]|0;k=a+44|0;c[k>>2]=c[i>>2];c[k+4>>2]=j;j=e;k=c[j+4>>2]|0;i=a+36|0;c[i>>2]=c[j>>2];c[i+4>>2]=k;k=c[a+4>>2]|0;i=c[b>>2]|0;l=+f[i+(k*48|0)+8>>2]*+f[e>>2]+ +f[i+(k*48|0)+24>>2];j=e+4|0;m=+f[i+(k*48|0)+12>>2]*+f[j>>2]+ +f[i+(k*48|0)+28>>2];n=a+24|0;f[n>>2]=l;o=a+28|0;f[o>>2]=m;do if((c[a+56>>2]|0)==1){p=+f[a+52>>2];q=m*p;if(q<l){f[n>>2]=q;r=q;s=m;break}else{q=l/p;f[o>>2]=q;r=l;s=q;break}}else{r=l;s=m}while(0);m=+f[i+(k*48|0)+20>>2]+(+f[d+4>>2]+ +f[j>>2]*+f[i+(k*48|0)+4>>2]-s*+f[a+12>>2]);f[a+16>>2]=+f[i+(k*48|0)+16>>2]+(+f[d>>2]+ +f[e>>2]*+f[i+(k*48|0)>>2]-r*+f[a+8>>2]);f[a+20>>2]=m;sc(h,a,b);Ja=g;return}function pc(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;return}function qc(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;d=a+4|0;e=c[a>>2]|0;f=(c[d>>2]|0)-e|0;g=(f|0)/48|0;h=g+1|0;if(h>>>0>89478485)Og(a);i=a+8|0;j=((c[i>>2]|0)-e|0)/48|0;k=j<<1;l=j>>>0<44739242?(k>>>0<h>>>0?h:k):89478485;do if(l)if(l>>>0>89478485){k=ea(8)|0;ug(k,5594);c[k>>2]=5332;ia(k|0,3520,71)}else{m=og(l*48|0)|0;break}else m=0;while(0);k=m+(g*48|0)|0;g=m+(l*48|0)|0;l=k;m=b;b=l+48|0;do{c[l>>2]=c[m>>2];l=l+4|0;m=m+4|0}while((l|0)<(b|0));m=k+(((f|0)/-48|0)*48|0)|0;if((f|0)>0)Rh(m|0,e|0,f|0)|0;c[a>>2]=m;c[d>>2]=k+48;c[i>>2]=g;if(!e)return;pg(e);return}function rc(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0;d=a+4|0;e=c[d>>2]|0;f=c[a>>2]|0;g=e-f>>3;h=g+1|0;i=f;j=e;if(h>>>0>536870911)Og(a);e=a+8|0;k=(c[e>>2]|0)-f|0;f=k>>2;l=k>>3>>>0<268435455?(f>>>0<h>>>0?h:f):536870911;do if(l)if(l>>>0>536870911){f=ea(8)|0;ug(f,5594);c[f>>2]=5332;ia(f|0,3520,71)}else{m=og(l<<3)|0;break}else m=0;while(0);f=m+(g<<3)|0;h=m+(l<<3)|0;c[f>>2]=c[b>>2];l=c[b+4>>2]|0;c[m+(g<<3)+4>>2]=l;if(!l){n=i;o=j}else{j=l+4|0;c[j>>2]=(c[j>>2]|0)+1;n=c[a>>2]|0;o=c[d>>2]|0}j=f+8|0;l=n;if((o|0)==(n|0)){p=f;q=l;r=o}else{i=g+-1-((o+-8-l|0)>>>3)|0;l=o;o=f;do{f=o;o=o+-8|0;g=l;l=l+-8|0;c[o>>2]=c[l>>2];b=g+-4|0;c[f+-4>>2]=c[b>>2];c[l>>2]=0;c[b>>2]=0}while((l|0)!=(n|0));p=m+(i<<3)|0;q=c[a>>2]|0;r=c[d>>2]|0}c[a>>2]=p;c[d>>2]=j;c[e>>2]=h;h=q;if((r|0)!=(h|0)){e=r;do{r=c[e+-4>>2]|0;e=e+-8|0;if(r|0?(j=r+4|0,d=c[j>>2]|0,c[j>>2]=d+-1,(d|0)==0):0){Ra[c[(c[r>>2]|0)+8>>2]&127](r);ng(r)}}while((e|0)!=(h|0))}if(!q)return;pg(q);return}function sc(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,B=0,C=0,D=0,E=0,F=0.0,G=0.0,H=0.0;e=Ja;Ja=Ja+32|0;if((Ja|0)>=(Ka|0))A(32);g=e+20|0;h=e+16|0;i=e+12|0;j=e+8|0;k=e;c[g>>2]=0;c[h>>2]=0;c[i>>2]=0;c[j>>2]=0;l=b+16|0;m=l;n=c[m+4>>2]|0;o=k;c[o>>2]=c[m>>2];c[o+4>>2]=n;n=c[b+312>>2]|0;o=c[b+316>>2]|0;if((n|0)==(o|0)){p=0;q=0;r=0;s=0;c[a>>2]=q;t=a+4|0;c[t>>2]=s;u=a+8|0;c[u>>2]=p;v=a+12|0;c[v>>2]=r;Ja=e;return}m=b+60|0;w=b+24|0;b=k+4|0;x=n;do{n=c[x>>2]|0;y=c[x+4>>2]|0;z=(y|0)==0;if(!z){B=y+4|0;c[B>>2]=(c[B>>2]|0)+1}B=c[m>>2]|0;do if((B|0)!=2){C=n;D=c[(c[n>>2]|0)+8>>2]|0;if((B|0)==1){Wa[D&15](C,d,k,w);f[k>>2]=+f[C+16>>2]+ +f[C+24>>2];E=C;break}else{Wa[D&15](C,d,l,w);E=C;break}}else{C=n;Wa[c[(c[n>>2]|0)+8>>2]&15](C,d,k,w);f[b>>2]=+f[C+20>>2]+ +f[C+28>>2];E=C}while(0);F=+f[E+16>>2];G=+f[g>>2];f[g>>2]=F<G?F:G;G=+f[E+20>>2];H=+f[h>>2];f[h>>2]=G<H?G:H;H=F+ +f[E+24>>2];F=+f[i>>2];f[i>>2]=F<H?H:F;F=G+ +f[E+28>>2];G=+f[j>>2];f[j>>2]=G<F?F:G;if(!z?(n=y+4|0,B=c[n>>2]|0,c[n>>2]=B+-1,(B|0)==0):0){Ra[c[(c[y>>2]|0)+8>>2]&127](y);ng(y)}x=x+8|0}while((x|0)!=(o|0));p=c[i>>2]|0;q=c[g>>2]|0;r=c[j>>2]|0;s=c[h>>2]|0;c[a>>2]=q;t=a+4|0;c[t>>2]=s;u=a+8|0;c[u>>2]=p;v=a+12|0;c[v>>2]=r;Ja=e;return}function tc(a,b){a=a|0;b=b|0;return}function uc(a){a=a|0;mg(a);pg(a);return}function vc(a){a=a|0;var b=0;b=c[a+12>>2]|0;if(!b)return;Ee(b);pg(b);return}function wc(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==6484?a+12|0:0)|0}function xc(a){a=a|0;pg(a);return}function yc(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0.0,o=0.0,p=0,q=0,r=0.0,s=0.0,t=0.0,u=0.0;g=Ja;Ja=Ja+32|0;if((Ja|0)>=(Ka|0))A(32);h=g+8|0;i=g;j=g+16|0;k=a+24|0;l=c[k+4>>2]|0;m=h;c[m>>2]=c[k>>2];c[m+4>>2]=l;l=a+16|0;m=c[l+4>>2]|0;k=i;c[k>>2]=c[l>>2];c[k+4>>2]=m;m=d;k=c[m+4>>2]|0;l=a+44|0;c[l>>2]=c[m>>2];c[l+4>>2]=k;k=e;l=c[k+4>>2]|0;m=a+36|0;c[m>>2]=c[k>>2];c[m+4>>2]=l;l=c[a+4>>2]|0;m=c[b>>2]|0;n=+f[m+(l*48|0)+8>>2]*+f[e>>2]+ +f[m+(l*48|0)+24>>2];k=e+4|0;o=+f[m+(l*48|0)+12>>2]*+f[k>>2]+ +f[m+(l*48|0)+28>>2];p=a+24|0;f[p>>2]=n;q=a+28|0;f[q>>2]=o;do if((c[a+56>>2]|0)==1){r=+f[a+52>>2];s=o*r;if(s<n){f[p>>2]=s;t=o;u=s;break}else{s=n/r;f[q>>2]=s;t=s;u=n;break}}else{t=o;u=n}while(0);n=+f[m+(l*48|0)+20>>2]+(+f[d+4>>2]+ +f[k>>2]*+f[m+(l*48|0)+4>>2]-t*+f[a+12>>2]);f[a+16>>2]=+f[m+(l*48|0)+16>>2]+(+f[d>>2]+ +f[e>>2]*+f[m+(l*48|0)>>2]-u*+f[a+8>>2]);f[a+20>>2]=n;Wa[c[(c[a>>2]|0)+12>>2]&15](a,b,i,h);sc(j,a,b);Ja=g;return}function zc(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0;e=c[b>>2]|0;b=(c[e+((c[a+4>>2]|0)*48|0)+32>>2]|0)+1|0;d=a+16|0;f=c[d+4>>2]|0;g=e+(b*48|0)|0;c[g>>2]=c[d>>2];c[g+4>>2]=f;f=a+24|0;a=c[f+4>>2]|0;g=e+(b*48|0)+16|0;c[g>>2]=c[f>>2];c[g+4>>2]=a;return}function Ac(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;d=a+4|0;e=c[a>>2]|0;f=(c[d>>2]|0)-e|0;g=(f|0)/48|0;h=g+1|0;if(h>>>0>89478485)Og(a);i=a+8|0;j=((c[i>>2]|0)-e|0)/48|0;k=j<<1;l=j>>>0<44739242?(k>>>0<h>>>0?h:k):89478485;do if(l)if(l>>>0>89478485){k=ea(8)|0;ug(k,5594);c[k>>2]=5332;ia(k|0,3520,71)}else{m=og(l*48|0)|0;break}else m=0;while(0);k=m+(g*48|0)|0;g=m+(l*48|0)|0;l=k;m=b;b=l+48|0;do{c[l>>2]=c[m>>2];l=l+4|0;m=m+4|0}while((l|0)<(b|0));m=k+(((f|0)/-48|0)*48|0)|0;if((f|0)>0)Rh(m|0,e|0,f|0)|0;c[a>>2]=m;c[d>>2]=k+48;c[i>>2]=g;if(!e)return;pg(e);return}function Bc(a,b){a=a|0;b=b|0;return}function Cc(a){a=a|0;mg(a);pg(a);return}function Dc(a){a=a|0;var b=0;b=c[a+12>>2]|0;if(!b)return;Ee(b);pg(b);return}function Ec(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==6652?a+12|0:0)|0}function Fc(a){a=a|0;pg(a);return}function Gc(a){a=a|0;return}function Hc(a){a=a|0;pg(a);return}function Ic(a){a=a|0;var b=0,d=0,e=0;b=og(12)|0;c[b>>2]=3952;d=a+4|0;a=c[d+4>>2]|0;e=b+4|0;c[e>>2]=c[d>>2];c[e+4>>2]=a;return b|0}function Jc(a,b){a=a|0;b=b|0;var d=0,e=0;c[b>>2]=3952;d=a+4|0;a=c[d+4>>2]|0;e=b+4|0;c[e>>2]=c[d>>2];c[e+4>>2]=a;return}function Kc(a){a=a|0;return}function Lc(a){a=a|0;pg(a);return}function Mc(a){a=a|0;var b=0,d=0,e=0;b=c[a+4>>2]|0;d=og(336)|0;e=b+4|0;Pc(d,e,c[a+8>>2]|0);a=c[d+4>>2]|0;b=c[e>>2]|0;c[b+(a*48|0)>>2]=1056964608;c[b+(a*48|0)+4>>2]=1056964608;c[d+8>>2]=1056964608;c[d+12>>2]=1056964608;return d|0}function Nc(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==6849?a+4|0:0)|0}function Oc(a){a=a|0;return 3040}function Pc(b,d,e){b=b|0;d=d|0;e=e|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0;g=Ja;Ja=Ja+80|0;if((Ja|0)>=(Ka|0))A(80);h=g;i=g+32|0;j=g+8|0;k=g+24|0;ib(b,d);c[b>>2]=4020;l=i+8|0;m=l+36|0;do{c[l>>2]=0;l=l+4|0}while((l|0)<(m|0));c[i+44>>2]=7;c[i>>2]=0;c[i+4>>2]=0;c[i+16>>2]=0;c[i+20>>2]=0;f[i+24>>2]=5.0;f[i+28>>2]=3.0;c[i+32>>2]=-256;c[i+36>>2]=577149439;n=d+4|0;o=c[n>>2]|0;p=c[d>>2]|0;c[p+((c[b+4>>2]|0)*48|0)+36>>2]=(o-p|0)/48|0;if((c[d+8>>2]|0)==(o|0))Ac(d,i);else{l=o;o=i;m=l+48|0;do{c[l>>2]=c[o>>2];l=l+4|0;o=o+4|0}while((l|0)<(m|0));c[n>>2]=(c[n>>2]|0)+48}c[b>>2]=3996;n=b+324|0;c[n>>2]=0;o=b+328|0;c[o>>2]=0;if((e+-1|0)>>>0>=2){Ja=g;return}e=og(328)|0;c[j>>2]=0;c[j+4>>2]=0;c[j+8>>2]=0;l=j+11|0;a[l>>0]=1;a[j>>0]=65;a[j+1>>0]=0;lb(e,d,j,-256,18.0);c[i>>2]=e;m=og(16)|0;c[m+4>>2]=0;c[m+8>>2]=0;c[m>>2]=4480;c[m+12>>2]=e;p=i+4|0;c[p>>2]=m;c[h>>2]=e;c[h+4>>2]=e;ze(i,h);h=c[i>>2]|0;e=c[p>>2]|0;c[i>>2]=0;c[p>>2]=0;c[n>>2]=h;h=c[o>>2]|0;c[o>>2]=e;if(h|0?(e=h+4|0,i=c[e>>2]|0,c[e>>2]=i+-1,(i|0)==0):0){Ra[c[(c[h>>2]|0)+8>>2]&127](h);ng(h)}h=c[p>>2]|0;if(h|0?(p=h+4|0,i=c[p>>2]|0,c[p>>2]=i+-1,(i|0)==0):0){Ra[c[(c[h>>2]|0)+8>>2]&127](h);ng(h)}if((a[l>>0]|0)<0)pg(c[j>>2]|0);j=c[(c[n>>2]|0)+4>>2]|0;l=c[d>>2]|0;c[l+(j*48|0)>>2]=1056964608;c[l+(j*48|0)+4>>2]=1050253722;j=c[n>>2]|0;c[j+8>>2]=1056964608;c[j+12>>2]=1056964608;j=c[(c[n>>2]|0)+4>>2]|0;l=c[d>>2]|0;c[l+(j*48|0)+8>>2]=1060320051;c[l+(j*48|0)+12>>2]=1065353216;j=c[(c[b>>2]|0)+4>>2]|0;c[k>>2]=c[n>>2];n=k+4|0;l=c[o>>2]|0;c[n>>2]=l;if(l|0){o=l+4|0;c[o>>2]=(c[o>>2]|0)+1}Va[j&7](b,d,k);k=c[n>>2]|0;if(!k){Ja=g;return}n=k+4|0;d=c[n>>2]|0;c[n>>2]=d+-1;if(d|0){Ja=g;return}Ra[c[(c[k>>2]|0)+8>>2]&127](k);ng(k);Ja=g;return}function Qc(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0.0,o=0.0,p=0,q=0,r=0.0,s=0.0,t=0.0,u=0.0;g=Ja;Ja=Ja+32|0;if((Ja|0)>=(Ka|0))A(32);h=g+8|0;i=g;j=g+16|0;k=a+24|0;l=c[k+4>>2]|0;m=h;c[m>>2]=c[k>>2];c[m+4>>2]=l;l=a+16|0;m=c[l+4>>2]|0;k=i;c[k>>2]=c[l>>2];c[k+4>>2]=m;m=d;k=c[m+4>>2]|0;l=a+44|0;c[l>>2]=c[m>>2];c[l+4>>2]=k;k=e;l=c[k+4>>2]|0;m=a+36|0;c[m>>2]=c[k>>2];c[m+4>>2]=l;l=c[a+4>>2]|0;m=c[b>>2]|0;n=+f[m+(l*48|0)+8>>2]*+f[e>>2]+ +f[m+(l*48|0)+24>>2];k=e+4|0;o=+f[m+(l*48|0)+12>>2]*+f[k>>2]+ +f[m+(l*48|0)+28>>2];p=a+24|0;f[p>>2]=n;q=a+28|0;f[q>>2]=o;do if((c[a+56>>2]|0)==1){r=+f[a+52>>2];s=o*r;if(s<n){f[p>>2]=s;t=o;u=s;break}else{s=n/r;f[q>>2]=s;t=s;u=n;break}}else{t=o;u=n}while(0);n=+f[m+(l*48|0)+20>>2]+(+f[d+4>>2]+ +f[k>>2]*+f[m+(l*48|0)+4>>2]-t*+f[a+12>>2]);f[a+16>>2]=+f[m+(l*48|0)+16>>2]+(+f[d>>2]+ +f[e>>2]*+f[m+(l*48|0)>>2]-u*+f[a+8>>2]);f[a+20>>2]=n;Wa[c[(c[a>>2]|0)+12>>2]&15](a,b,i,h);sc(j,a,b);Ja=g;return}function Rc(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0;e=c[b>>2]|0;b=(c[e+((c[a+4>>2]|0)*48|0)+32>>2]|0)+1|0;d=a+16|0;f=c[d+4>>2]|0;g=e+(b*48|0)|0;c[g>>2]=c[d>>2];c[g+4>>2]=f;f=a+24|0;a=c[f+4>>2]|0;g=e+(b*48|0)+16|0;c[g>>2]=c[f>>2];c[g+4>>2]=a;return}function Sc(b,d,e,f,g){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0;h=Ja;Ja=Ja+16|0;if((Ja|0)>=(Ka|0))A(16);i=h+8|0;j=h;c[b>>2]=0;k=b+4|0;c[k>>2]=0;l=b+8|0;c[l>>2]=0;if(!e){Ja=h;return}m=g+16|0;g=j+4|0;n=i+4|0;o=0;while(1){p=c[m>>2]|0;if(!p){q=5;break}Ta[c[(c[p>>2]|0)+24>>2]&15](i,p);p=c[i>>2]|0;a[p+65>>0]=0;a[p+145>>0]=0;a[p+225>>0]=0;c[(c[d>>2]|0)+((c[p+4>>2]|0)*48|0)+40>>2]=0;r=c[k>>2]|0;if((r|0)==(c[l>>2]|0))rc(b,i);else{c[r>>2]=p;p=c[n>>2]|0;c[r+4>>2]=p;if(!p)s=r;else{r=p+4|0;c[r>>2]=(c[r>>2]|0)+1;s=c[k>>2]|0}c[k>>2]=s+8}r=c[(c[f>>2]|0)+4>>2]|0;c[j>>2]=c[i>>2];p=c[n>>2]|0;c[g>>2]=p;if(p|0){t=p+4|0;c[t>>2]=(c[t>>2]|0)+1}Va[r&7](f,d,j);r=c[g>>2]|0;if(r|0?(t=r+4|0,p=c[t>>2]|0,c[t>>2]=p+-1,(p|0)==0):0){Ra[c[(c[r>>2]|0)+8>>2]&127](r);ng(r)}r=c[n>>2]|0;if(r|0?(p=r+4|0,t=c[p>>2]|0,c[p>>2]=t+-1,(t|0)==0):0){Ra[c[(c[r>>2]|0)+8>>2]&127](r);ng(r)}o=o+1|0;if(o>>>0>=e>>>0){q=3;break}}if((q|0)==3){Ja=h;return}else if((q|0)==5){q=ea(4)|0;c[q>>2]=5208;ia(q|0,3392,64)}}function Tc(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0;d=a+4|0;e=c[a>>2]|0;f=((c[d>>2]|0)-e|0)/12|0;g=f+1|0;if(g>>>0>357913941)Og(a);h=a+8|0;i=((c[h>>2]|0)-e|0)/12|0;e=i<<1;j=i>>>0<178956970?(e>>>0<g>>>0?g:e):357913941;do if(j)if(j>>>0>357913941){e=ea(8)|0;ug(e,5594);c[e>>2]=5332;ia(e|0,3520,71)}else{k=og(j*12|0)|0;break}else k=0;while(0);e=k+(f*12|0)|0;g=k+(j*12|0)|0;c[e>>2]=c[b>>2];j=b+4|0;c[k+(f*12|0)+4>>2]=c[j>>2];i=b+8|0;c[k+(f*12|0)+8>>2]=c[i>>2];c[i>>2]=0;c[j>>2]=0;c[b>>2]=0;b=e+12|0;j=c[a>>2]|0;i=c[d>>2]|0;if((i|0)==(j|0)){l=e;m=j;n=j}else{f=i;i=e;do{e=i;i=i+-12|0;k=f;f=f+-12|0;c[i>>2]=0;o=e+-8|0;c[o>>2]=0;p=e+-4|0;c[p>>2]=0;c[i>>2]=c[f>>2];e=k+-8|0;c[o>>2]=c[e>>2];o=k+-4|0;c[p>>2]=c[o>>2];c[o>>2]=0;c[e>>2]=0;c[f>>2]=0}while((f|0)!=(j|0));l=i;m=c[a>>2]|0;n=c[d>>2]|0}c[a>>2]=l;c[d>>2]=b;c[h>>2]=g;g=m;if((n|0)!=(g|0)){h=n;do{n=h;h=h+-12|0;b=c[h>>2]|0;if(b|0){d=n+-8|0;n=c[d>>2]|0;if((n|0)==(b|0))q=b;else{l=n;do{n=c[l+-4>>2]|0;l=l+-8|0;if(n|0?(a=n+4|0,i=c[a>>2]|0,c[a>>2]=i+-1,(i|0)==0):0){Ra[c[(c[n>>2]|0)+8>>2]&127](n);ng(n)}}while((l|0)!=(b|0));q=c[h>>2]|0}c[d>>2]=b;pg(q)}}while((h|0)!=(g|0))}if(!m)return;pg(m);return}function Uc(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0;d=a+4|0;e=c[d>>2]|0;f=c[a>>2]|0;g=e-f>>3;h=g+1|0;i=f;j=e;if(h>>>0>536870911)Og(a);e=a+8|0;k=(c[e>>2]|0)-f|0;l=k>>2;m=k>>3>>>0<268435455?(l>>>0<h>>>0?h:l):536870911;do if(m)if(m>>>0>536870911){l=ea(8)|0;ug(l,5594);c[l>>2]=5332;ia(l|0,3520,71)}else{n=og(m<<3)|0;break}else n=0;while(0);l=n+(g<<3)|0;h=n+(m<<3)|0;c[l>>2]=c[b>>2];m=b+4|0;c[n+(g<<3)+4>>2]=c[m>>2];c[b>>2]=0;c[m>>2]=0;m=l+8|0;if((j|0)==(i|0)){o=l;p=i;q=f}else{b=g+-1-((j+-8+(0-f)|0)>>>3)|0;f=j;j=l;do{l=j;j=j+-8|0;g=f;f=f+-8|0;c[j>>2]=c[f>>2];k=g+-4|0;c[l+-4>>2]=c[k>>2];c[f>>2]=0;c[k>>2]=0}while((f|0)!=(i|0));i=c[a>>2]|0;o=n+(b<<3)|0;p=i;q=i}c[a>>2]=o;o=c[d>>2]|0;c[d>>2]=m;c[e>>2]=h;if((o|0)!=(p|0)){h=o;do{o=c[h+-4>>2]|0;h=h+-8|0;if(o|0?(e=o+4|0,m=c[e>>2]|0,c[e>>2]=m+-1,(m|0)==0):0){Ra[c[(c[o>>2]|0)+8>>2]&127](o);ng(o)}}while((h|0)!=(p|0))}if(!q)return;pg(q);return}function Vc(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0;d=Ja;Ja=Ja+16|0;if((Ja|0)>=(Ka|0))A(16);e=d;c[a>>2]=b;f=og(16)|0;c[f+4>>2]=0;c[f+8>>2]=0;c[f>>2]=4068;c[f+12>>2]=b;c[a+4>>2]=f;c[e>>2]=b;c[e+4>>2]=b;Wc(a,e);Ja=d;return}function Wc(a,b){a=a|0;b=b|0;return}function Xc(a){a=a|0;mg(a);pg(a);return}function Yc(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0;b=c[a+12>>2]|0;if(!b)return;a=c[b>>2]|0;if(a|0){d=b+4|0;e=c[d>>2]|0;if((e|0)==(a|0))f=a;else{g=e;do{e=c[g+-4>>2]|0;g=g+-8|0;if(e|0?(h=e+4|0,i=c[h>>2]|0,c[h>>2]=i+-1,(i|0)==0):0){Ra[c[(c[e>>2]|0)+8>>2]&127](e);ng(e)}}while((g|0)!=(a|0));f=c[b>>2]|0}c[d>>2]=a;pg(f)}pg(b);return}function Zc(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==7e3?a+12|0:0)|0}function _c(a){a=a|0;pg(a);return}function $c(a){a=a|0;var b=0;c[a>>2]=4096;b=c[a+32>>2]|0;if((a+16|0)==(b|0)){Ra[c[(c[b>>2]|0)+16>>2]&127](b);return}if(!b)return;Ra[c[(c[b>>2]|0)+20>>2]&127](b);return}function ad(a){a=a|0;var b=0;c[a>>2]=4096;b=c[a+32>>2]|0;if((a+16|0)==(b|0)){Ra[c[(c[b>>2]|0)+16>>2]&127](b);pg(a);return}if(!b){pg(a);return}Ra[c[(c[b>>2]|0)+20>>2]&127](b);pg(a);return}function bd(a){a=a|0;var b=0,d=0,e=0;b=og(40)|0;c[b>>2]=4096;c[b+8>>2]=c[a+8>>2];d=b+16|0;e=c[a+32>>2]|0;if(!e){c[b+32>>2]=0;return b|0}if((a+16|0)==(e|0)){c[b+32>>2]=d;Ta[c[(c[e>>2]|0)+12>>2]&15](e,d);return b|0}else{c[b+32>>2]=Ma[c[(c[e>>2]|0)+8>>2]&31](e)|0;return b|0}return 0}function cd(a,b){a=a|0;b=b|0;var d=0,e=0,f=0;c[b>>2]=4096;c[b+8>>2]=c[a+8>>2];d=b+16|0;e=a+32|0;f=c[e>>2]|0;if(!f){c[b+32>>2]=0;return}if((a+16|0)==(f|0)){c[b+32>>2]=d;a=c[e>>2]|0;Ta[c[(c[a>>2]|0)+12>>2]&15](a,d);return}else{c[b+32>>2]=Ma[c[(c[f>>2]|0)+8>>2]&31](f)|0;return}}function dd(a){a=a|0;var b=0;b=c[a+32>>2]|0;if((a+16|0)==(b|0)){Ra[c[(c[b>>2]|0)+16>>2]&127](b);return}if(!b)return;Ra[c[(c[b>>2]|0)+20>>2]&127](b);return}function ed(a){a=a|0;var b=0;b=c[a+32>>2]|0;if((a+16|0)==(b|0)){Ra[c[(c[b>>2]|0)+16>>2]&127](b);pg(a);return}if(!b){pg(a);return}Ra[c[(c[b>>2]|0)+20>>2]&127](b);pg(a);return}function fd(a,b){a=a|0;b=b|0;var d=0,e=0;d=Ja;Ja=Ja+16|0;if((Ja|0)>=(Ka|0))A(16);e=d;id(e,b+8|0);c[a>>2]=c[e>>2];c[a+4>>2]=c[e+4>>2];Ja=d;return}function gd(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==7681?a+8|0:0)|0}function hd(a){a=a|0;return 3176}function id(d,e){d=d|0;e=e|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0;h=Ja;Ja=Ja+48|0;if((Ja|0)>=(Ka|0))A(48);i=h+32|0;j=h;k=h+28|0;l=h+16|0;m=h+24|0;n=h+8|0;o=og(352)|0;ib(o,c[e>>2]|0);c[o>>2]=4140;p=o+324|0;c[o+340>>2]=0;c[o+344>>2]=0;c[p>>2]=0;c[p+4>>2]=0;c[p+8>>2]=0;a[p+12>>0]=0;c[k>>2]=0;c[i>>2]=c[k>>2];jd(d,o,i);o=og(296)|0;k=c[d>>2]|0;p=c[d+4>>2]|0;q=(p|0)==0;if(!q){r=p+4|0;c[r>>2]=(c[r>>2]|0)+1}a[o+4>>0]=0;a[o+5>>0]=0;c[o+24>>2]=0;c[o>>2]=4192;a[o+32>>0]=0;c[o+36>>2]=k;c[o+40>>2]=p;if(!q){k=p+4|0;c[k>>2]=(c[k>>2]|0)+1}b[o+44>>1]=0;a[o+48>>0]=1;f[o+52>>2]=1.0000000474974513e-03;g[o+56>>3]=1.0;g[o+64>>3]=18.84955592153876;k=o+72|0;c[k>>2]=0;c[k+4>>2]=0;c[k+8>>2]=0;c[k+12>>2]=0;a[o+88>>0]=1;f[o+92>>2]=1.0000000474974513e-03;g[o+96>>3]=1.0;g[o+104>>3]=18.84955592153876;k=o+112|0;c[k>>2]=0;c[k+4>>2]=0;c[k+8>>2]=0;c[k+12>>2]=0;a[o+128>>0]=1;f[o+132>>2]=1.0000000474974513e-03;g[o+136>>3]=1.0;g[o+144>>3]=18.84955592153876;k=o+152|0;c[k>>2]=0;c[k+4>>2]=0;c[k+8>>2]=0;c[k+12>>2]=0;a[o+168>>0]=1;f[o+172>>2]=1.0000000474974513e-03;g[o+176>>3]=1.0;g[o+184>>3]=18.84955592153876;k=o+192|0;c[k>>2]=0;c[k+4>>2]=0;c[k+8>>2]=0;c[k+12>>2]=0;a[o+208>>0]=1;f[o+212>>2]=1.0000000474974513e-03;g[o+216>>3]=1.0;g[o+224>>3]=18.84955592153876;k=o+232|0;c[k>>2]=0;c[k+4>>2]=0;c[k+8>>2]=0;c[k+12>>2]=0;a[o+248>>0]=1;g[o+256>>3]=1.0;g[o+264>>3]=18.84955592153876;g[o+272>>3]=.009999999776482582;g[o+280>>3]=0.0;f[o+288>>2]=0.0;c[m>>2]=0;c[i>>2]=c[m>>2];kd(l,o,i);if(!q?(q=p+4|0,o=c[q>>2]|0,c[q>>2]=o+-1,(o|0)==0):0){Ra[c[(c[p>>2]|0)+8>>2]&127](p);ng(p)}p=c[d>>2]|0;o=c[l>>2]|0;q=l+4|0;l=c[q>>2]|0;if(l|0){m=l+4|0;c[m>>2]=(c[m>>2]|0)+1}c[p+304>>2]=o;o=p+308|0;p=c[o>>2]|0;c[o>>2]=l;if(p|0?(l=p+4|0,o=c[l>>2]|0,c[l>>2]=o+-1,(o|0)==0):0){Ra[c[(c[p>>2]|0)+8>>2]&127](p);ng(p)}p=c[e+24>>2]|0;if(!p){o=ea(4)|0;c[o>>2]=5208;ia(o|0,3392,64)}o=Ma[c[(c[p>>2]|0)+24>>2]&31](p)|0;c[i>>2]=o;p=og(16)|0;c[p+4>>2]=0;c[p+8>>2]=0;c[p>>2]=3872;c[p+12>>2]=o;l=i+4|0;c[l>>2]=p;c[j>>2]=o;c[j+4>>2]=o;tc(i,j);j=c[i>>2]|0;c[i>>2]=0;i=c[l>>2]|0;l=c[j+4>>2]|0;o=c[c[e>>2]>>2]|0;c[o+(l*48|0)+8>>2]=1065353216;c[o+(l*48|0)+12>>2]=1065353216;l=c[d>>2]|0;o=i;p=(i|0)==0;if(!p){m=o+4|0;c[m>>2]=(c[m>>2]|0)+1}c[l+340>>2]=j;m=l+344|0;l=c[m>>2]|0;c[m>>2]=i;if(l|0?(m=l+4|0,k=c[m>>2]|0,c[m>>2]=k+-1,(k|0)==0):0){Ra[c[(c[l>>2]|0)+8>>2]&127](l);ng(l)}l=c[d>>2]|0;d=c[(c[l>>2]|0)+4>>2]|0;k=c[e>>2]|0;c[n>>2]=j;j=n+4|0;c[j>>2]=o;if(!p){e=o+4|0;c[e>>2]=(c[e>>2]|0)+1}Va[d&7](l,k,n);n=c[j>>2]|0;if(n|0?(j=n+4|0,k=c[j>>2]|0,c[j>>2]=k+-1,(k|0)==0):0){Ra[c[(c[n>>2]|0)+8>>2]&127](n);ng(n)}if(!p?(p=o+4|0,n=c[p>>2]|0,c[p>>2]=n+-1,(n|0)==0):0){Ra[c[(c[i>>2]|0)+8>>2]&127](o);ng(o)}o=c[q>>2]|0;if(!o){Ja=h;return}q=o+4|0;i=c[q>>2]|0;c[q>>2]=i+-1;if(i|0){Ja=h;return}Ra[c[(c[o>>2]|0)+8>>2]&127](o);ng(o);Ja=h;return}function jd(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0;d=Ja;Ja=Ja+16|0;if((Ja|0)>=(Ka|0))A(16);e=d;c[a>>2]=b;f=og(16)|0;c[f+4>>2]=0;c[f+8>>2]=0;c[f>>2]=4164;c[f+12>>2]=b;c[a+4>>2]=f;c[e>>2]=b;c[e+4>>2]=b;ld(a,e);Ja=d;return}function kd(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0;d=Ja;Ja=Ja+16|0;if((Ja|0)>=(Ka|0))A(16);e=d;c[a>>2]=b;f=og(16)|0;c[f+4>>2]=0;c[f+8>>2]=0;c[f>>2]=4216;c[f+12>>2]=b;c[a+4>>2]=f;c[e>>2]=b;c[e+4>>2]=b;ud(a,e);Ja=d;return}function ld(a,b){a=a|0;b=b|0;return}function md(a){a=a|0;mg(a);pg(a);return}function nd(a){a=a|0;var b=0,d=0,e=0;b=c[a+12>>2]|0;if(!b)return;c[b>>2]=4140;eg(9277)|0;a=c[b+344>>2]|0;if(a|0?(d=a+4|0,e=c[d>>2]|0,c[d>>2]=e+-1,(e|0)==0):0){Ra[c[(c[a>>2]|0)+8>>2]&127](a);ng(a)}Ee(b);pg(b);return}function od(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==7407?a+12|0:0)|0}function pd(a){a=a|0;pg(a);return}function qd(d,e,f){d=d|0;e=e|0;f=+f;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,B=0.0,C=0;g=Ja;Ja=Ja+32|0;if((Ja|0)>=(Ka|0))A(32);h=g+16|0;i=g+8|0;j=g;k=d+44|0;l=b[k>>1]|0;if(!(l&1))m=l;else{l=d+36|0;n=(c[e>>2]|0)+((c[(c[l>>2]|0)+4>>2]|0)*48|0)|0;o=c[n+4>>2]|0;p=i;c[p>>2]=c[n>>2];c[p+4>>2]=o;o=d+48|0;sd(j,o,f,i);p=j;n=c[p+4>>2]|0;q=(c[e>>2]|0)+((c[(c[l>>2]|0)+4>>2]|0)*48|0)|0;c[q>>2]=c[p>>2];c[q+4>>2]=n;n=b[k>>1]|0;if(!(a[o>>0]|0))r=n;else{o=n&-2;b[k>>1]=o;r=o}m=r}if(!(m&2))s=m;else{m=d+36|0;r=(c[e>>2]|0)+((c[(c[m>>2]|0)+4>>2]|0)*48|0)+8|0;o=c[r+4>>2]|0;n=i;c[n>>2]=c[r>>2];c[n+4>>2]=o;o=d+88|0;sd(j,o,f,i);n=j;r=c[n+4>>2]|0;q=(c[e>>2]|0)+((c[(c[m>>2]|0)+4>>2]|0)*48|0)+8|0;c[q>>2]=c[n>>2];c[q+4>>2]=r;r=b[k>>1]|0;if(!(a[o>>0]|0))t=r;else{o=r&-3;b[k>>1]=o;t=o}s=t}if(!(s&4))u=s;else{s=d+36|0;t=(c[e>>2]|0)+((c[(c[s>>2]|0)+4>>2]|0)*48|0)+16|0;o=c[t+4>>2]|0;r=i;c[r>>2]=c[t>>2];c[r+4>>2]=o;o=d+128|0;sd(j,o,f,i);r=j;t=c[r+4>>2]|0;q=(c[e>>2]|0)+((c[(c[s>>2]|0)+4>>2]|0)*48|0)+16|0;c[q>>2]=c[r>>2];c[q+4>>2]=t;t=b[k>>1]|0;if(!(a[o>>0]|0))v=t;else{o=t&-5;b[k>>1]=o;v=o}u=v}if(!(u&8))w=u;else{u=d+36|0;v=(c[e>>2]|0)+((c[(c[u>>2]|0)+4>>2]|0)*48|0)+24|0;o=c[v+4>>2]|0;t=i;c[t>>2]=c[v>>2];c[t+4>>2]=o;o=d+168|0;sd(j,o,f,i);t=j;v=c[t+4>>2]|0;q=(c[e>>2]|0)+((c[(c[u>>2]|0)+4>>2]|0)*48|0)+24|0;c[q>>2]=c[t>>2];c[q+4>>2]=v;v=b[k>>1]|0;if(!(a[o>>0]|0))x=v;else{o=v&-9;b[k>>1]=o;x=o}w=x}if(!(w&16))y=w;else{w=d+36|0;x=(c[w>>2]|0)+8|0;o=c[x+4>>2]|0;v=i;c[v>>2]=c[x>>2];c[v+4>>2]=o;o=d+208|0;sd(j,o,f,i);i=j;j=c[i+4>>2]|0;v=(c[w>>2]|0)+8|0;c[v>>2]=c[i>>2];c[v+4>>2]=j;j=b[k>>1]|0;if(!(a[o>>0]|0))z=j;else{o=j&-17;b[k>>1]=o;z=o}y=z}if(y&32){z=d+36|0;o=d+248|0;B=+td(o,f,+((c[(c[z>>2]|0)+32>>2]|0)>>>0)/255.0);f=B;j=B>1.0?255:~~((f<0.0?0.0:f)*255.0)>>>0;v=c[z>>2]|0;z=v+32|0;c[z>>2]=j;i=c[v+4>>2]|0;v=c[e>>2]|0;w=c[v+(i*48|0)+36>>2]|0;a:do if(i>>>0<=w>>>0){x=i;q=j;t=v;while(1){if(q>>>0>255){c[h>>2]=q;cg(7521,h)|0}u=c[t+(x*48|0)+44>>2]|0;b:do switch(u|0){case 7:case 5:case 4:{r=t+(x*48|0)+36|0;s=(c[r>>2]&-256)+q|0;c[r>>2]=s;switch(u|0){case 7:case 4:break;default:break b}c[t+(x*48|0)+32>>2]=(s&-256)+q;break}case 8:{s=t+(x*48|0)+32|0;c[s>>2]=(c[s>>2]&-256)+q;break}default:{}}while(0);u=x+1|0;if(u>>>0>w>>>0)break a;x=u;q=c[z>>2]|0;t=c[e>>2]|0}}while(0);z=b[k>>1]|0;if(!(a[o>>0]|0))C=z;else{o=z&-33;b[k>>1]=o;C=o}}else C=y;y=d+4|0;o=a[y>>0]|0;k=C<<16>>16==0;a[y>>0]=k&1;if(!(o<<24>>24==0&k)){Ja=g;return}if(!(a[d+32>>0]|0)){Ja=g;return}k=c[d+36>>2]|0;a[k+65>>0]=0;a[k+145>>0]=0;a[k+225>>0]=0;c[(c[e>>2]|0)+((c[k+4>>2]|0)*48|0)+40>>2]=0;Ja=g;return}function rd(a,b,c){a=a|0;b=b|0;c=+c;return}function sd(b,d,e,h){b=b|0;d=d|0;e=+e;h=h|0;var i=0.0,j=0,k=0.0,l=0.0,m=0.0,n=0.0,o=0.0,p=0.0,q=0,r=0.0,u=0.0,v=0.0,w=0.0,x=0.0,y=0;i=e/1.0e3;j=d+32|0;e=+f[j>>2];k=+f[h>>2]-e;l=+f[d+36>>2];m=+f[h+4>>2]-l;n=+g[d+16>>3];o=+t(+(+g[d+8>>3]*-i*n));h=d+24|0;p=+f[h>>2];q=d+28|0;r=+f[q>>2];u=n*i;v=u+1.0;w=o;o=e+(i*p+k*v)*w;x=l+(i*r+m*v)*w;v=u;u=n;n=(p-(p+k*u)*v)*w;k=(r-(m*u+r)*v)*w;w=+s(+(o-e));e=+f[d+4>>2];if((w<e?+s(+n)<e&+s(+(x-l))<e:0)?i>0.0&+s(+k)<e:0){c[h>>2]=0;c[q>>2]=0;a[d>>0]=1;d=j;j=c[d+4>>2]|0;y=b;c[y>>2]=c[d>>2];c[y+4>>2]=j;return}f[h>>2]=n;f[q>>2]=k;f[b>>2]=o;f[b+4>>2]=x;return}function td(b,c,d){b=b|0;c=+c;d=+d;var e=0,h=0,i=0.0,j=0,k=0.0,l=0.0,m=0.0,n=0,o=0.0,p=0.0,q=0.0,r=0.0,u=0.0,v=0.0;e=Ja;Ja=Ja+32|0;if((Ja|0)>=(Ka|0))A(32);h=e;i=c/1.0e3;j=b+40|0;c=+f[j>>2];k=d-c;l=+g[b+16>>3];m=+t(+-(i*+g[b+8>>3]*l));n=b+32|0;o=+g[n>>3];p=i*l;q=m*(i*o+(p+1.0)*k)+c;r=m*(o-p*(l*k+o));if(d>1.0|(d<0.0|(q>1.0|q<0.0))){g[h>>3]=q;g[h+8>>3]=d;g[h+16>>3]=o;g[h+24>>3]=i;cg(7479,h)|0;u=+f[j>>2]}else u=c;c=+s(+(q-u));o=+g[b+24>>3];if(o>c?i>0.0&+s(+r)<o:0){g[n>>3]=0.0;a[b>>0]=1;v=u;Ja=e;return +v}g[n>>3]=r;v=q;Ja=e;return +v}function ud(a,b){a=a|0;b=b|0;return}function vd(a){a=a|0;mg(a);pg(a);return}function wd(a){a=a|0;var b=0,d=0,e=0;b=c[a+12>>2]|0;if(!b)return;c[b>>2]=4192;a=c[b+40>>2]|0;if(a|0?(d=a+4|0,e=c[d>>2]|0,c[d>>2]=e+-1,(e|0)==0):0){Ra[c[(c[a>>2]|0)+8>>2]&127](a);ng(a)}c[b>>2]=4204;a=c[b+24>>2]|0;if((b+8|0)!=(a|0)){if(a|0)Ra[c[(c[a>>2]|0)+20>>2]&127](a)}else Ra[c[(c[a>>2]|0)+16>>2]&127](a);pg(b);return}function xd(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==7635?a+12|0:0)|0}function yd(a){a=a|0;pg(a);return}function zd(a,b){a=a|0;b=b|0;return}function Ad(a){a=a|0;mg(a);pg(a);return}function Bd(a){a=a|0;var b=0;b=c[a+12>>2]|0;if(!b)return;Ed(b);pg(b);return}function Cd(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==7908?a+12|0:0)|0}function Dd(a){a=a|0;pg(a);return}function Ed(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0;c[a>>2]=4044;b=a+424|0;d=c[b>>2]|0;if(d|0){e=a+428|0;f=c[e>>2]|0;if((f|0)==(d|0))g=d;else{h=f;do{f=h;h=h+-12|0;i=c[h>>2]|0;if(i|0){j=f+-8|0;f=c[j>>2]|0;if((f|0)==(i|0))k=i;else{l=f;do{f=c[l+-4>>2]|0;l=l+-8|0;if(f|0?(m=f+4|0,n=c[m>>2]|0,c[m>>2]=n+-1,(n|0)==0):0){Ra[c[(c[f>>2]|0)+8>>2]&127](f);ng(f)}}while((l|0)!=(i|0));k=c[h>>2]|0}c[j>>2]=i;pg(k)}}while((h|0)!=(d|0));g=c[b>>2]|0}c[e>>2]=d;pg(g)}g=c[a+420>>2]|0;if(g|0?(d=g+4|0,e=c[d>>2]|0,c[d>>2]=e+-1,(e|0)==0):0){Ra[c[(c[g>>2]|0)+8>>2]&127](g);ng(g)}g=c[a+408>>2]|0;if((a+392|0)!=(g|0)){if(g|0)Ra[c[(c[g>>2]|0)+20>>2]&127](g)}else Ra[c[(c[g>>2]|0)+16>>2]&127](g);g=c[a+384>>2]|0;if((a+368|0)!=(g|0)){if(g|0)Ra[c[(c[g>>2]|0)+20>>2]&127](g)}else Ra[c[(c[g>>2]|0)+16>>2]&127](g);g=c[a+360>>2]|0;if((a+344|0)==(g|0)){Ra[c[(c[g>>2]|0)+16>>2]&127](g);Ee(a);return}if(!g){Ee(a);return}Ra[c[(c[g>>2]|0)+20>>2]&127](g);Ee(a);return}function Fd(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0;d=Ja;Ja=Ja+16|0;if((Ja|0)>=(Ka|0))A(16);e=d;if((b|0)==(a|0)){Ja=d;return}f=a+16|0;g=c[f>>2]|0;h=g;i=b+16|0;if((g|0)==(a|0))if((c[i>>2]|0)==(b|0)){Ta[c[(c[g>>2]|0)+12>>2]&15](g,e);j=c[f>>2]|0;Ra[c[(c[j>>2]|0)+16>>2]&127](j);c[f>>2]=0;j=c[i>>2]|0;Ta[c[(c[j>>2]|0)+12>>2]&15](j,a);j=c[i>>2]|0;Ra[c[(c[j>>2]|0)+16>>2]&127](j);c[i>>2]=0;c[f>>2]=a;Ta[c[(c[e>>2]|0)+12>>2]&15](e,b);Ra[c[(c[e>>2]|0)+16>>2]&127](e);c[i>>2]=b;Ja=d;return}else{Ta[c[(c[g>>2]|0)+12>>2]&15](g,b);g=c[f>>2]|0;Ra[c[(c[g>>2]|0)+16>>2]&127](g);g=b+16|0;c[f>>2]=c[g>>2];c[g>>2]=b;Ja=d;return}else{g=c[i>>2]|0;if((b|0)==(g|0)){Ta[c[(c[g>>2]|0)+12>>2]&15](g,a);b=c[i>>2]|0;Ra[c[(c[b>>2]|0)+16>>2]&127](b);c[i>>2]=c[f>>2];c[f>>2]=a;Ja=d;return}else{c[f>>2]=g;c[i>>2]=h;Ja=d;return}}}function Gd(a){a=a|0;pg(a);return}function Hd(a){a=a|0;var b=0;b=og(8)|0;c[b>>2]=4272;c[b+4>>2]=c[a+4>>2];return b|0}function Id(a,b){a=a|0;b=b|0;c[b>>2]=4272;c[b+4>>2]=c[a+4>>2];return}function Jd(a){a=a|0;return}function Kd(a){a=a|0;pg(a);return}function Ld(a,b){a=a|0;b=b|0;Pd(c[a+4>>2]|0,b);return}function Md(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==8212?a+4|0:0)|0}function Nd(a){a=a|0;return 3224}function Od(a){a=a|0;return}function Pd(a,b){a=a|0;b=b|0;var d=0,e=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,B=0,C=0,D=0.0,E=0.0,F=0.0,G=0.0,H=0.0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0;d=Ja;Ja=Ja+80|0;if((Ja|0)>=(Ka|0))A(80);e=d;h=d+72|0;i=d+56|0;j=d+48|0;eg(9292)|0;k=a+52|0;l=c[k>>2]|0;if((c[l+336>>2]|0)<=0){Ja=d;return}m=h+4|0;n=b+4|0;o=a+36|0;p=a+68|0;q=j+4|0;r=i+4|0;s=a+72|0;t=a+76|0;u=a+80|0;v=0;w=l;a:while(1){b:do if((c[w+332>>2]|0)>0){l=(v|0)==1;x=0;y=w;while(1){z=c[(c[y+424>>2]|0)+(v*12|0)>>2]|0;B=c[z+(x<<3)>>2]|0;c[h>>2]=B;C=c[z+(x<<3)+4>>2]|0;c[m>>2]=C;z=B;if(C|0){B=C+4|0;c[B>>2]=(c[B>>2]|0)+1}if(l&(x|0)==2){D=+f[n>>2];E=+f[z+16>>2];F=+f[z+20>>2];G=+f[z+24>>2];H=+f[z+28>>2];g[e>>3]=+f[b>>2];g[e+8>>3]=D;g[e+16>>3]=E;g[e+24>>3]=F;g[e+32>>3]=G;g[e+40>>3]=H;cg(8094,e)|0;I=c[h>>2]|0}else I=z;if(((((I|0)!=0?(H=+f[b>>2],G=+f[n>>2],F=+f[I+16>>2],F<=H):0)?F+ +f[I+24>>2]>=H:0)?(H=+f[I+20>>2],H<=G):0)?H+ +f[I+28>>2]>=G:0){z=c[o>>2]|0;B=c[(c[z>>2]|0)+20>>2]|0;lc(i,p);c[j>>2]=c[h>>2];C=c[m>>2]|0;c[q>>2]=C;if(C|0){J=C+4|0;c[J>>2]=(c[J>>2]|0)+1}J=Oa[B&15](z,i,j)|0;z=c[q>>2]|0;if(z|0?(B=z+4|0,C=c[B>>2]|0,c[B>>2]=C+-1,(C|0)==0):0){Ra[c[(c[z>>2]|0)+8>>2]&127](z);ng(z)}z=c[i>>2]|0;if(z|0){C=c[r>>2]|0;if((C|0)==(z|0))K=z;else{B=C;do{C=c[B+-4>>2]|0;B=B+-8|0;do if(C|0){L=C+4|0;M=c[L>>2]|0;c[L>>2]=M+-1;if(M|0)break;Ra[c[(c[C>>2]|0)+8>>2]&127](C);ng(C)}while(0)}while((B|0)!=(z|0));K=c[i>>2]|0}c[r>>2]=z;pg(K)}if(J){B=c[s>>2]|0;if((B|0)==(c[t>>2]|0))Rd(p,h);else{c[B>>2]=c[h>>2];C=c[m>>2]|0;c[B+4>>2]=C;if(!C)N=B;else{B=C+4|0;c[B>>2]=(c[B>>2]|0)+1;N=c[s>>2]|0}c[s>>2]=N+8}Qd(a,v,x);c[u>>2]=c[(c[h>>2]|0)+332>>2];O=0}else O=1}else O=7;B=c[m>>2]|0;if(B|0?(C=B+4|0,M=c[C>>2]|0,c[C>>2]=M+-1,(M|0)==0):0){Ra[c[(c[B>>2]|0)+8>>2]&127](B);ng(B)}switch(O&7){case 7:case 0:break;default:{P=41;break a}}x=x+1|0;B=c[k>>2]|0;if((x|0)>=(c[B+332>>2]|0)){Q=B;break b}else y=B}}else Q=w;while(0);v=v+1|0;if((v|0)>=(c[Q+336>>2]|0)){P=41;break}else w=Q}if((P|0)==41){Ja=d;return}}function Qd(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0;f=Ja;Ja=Ja+48|0;if((Ja|0)>=(Ka|0))A(48);g=f+32|0;h=f+16|0;i=f+8|0;j=f;k=b+52|0;l=c[(c[(c[k>>2]|0)+424>>2]|0)+(d*12|0)>>2]|0;d=c[l+(e<<3)>>2]|0;m=c[l+(e<<3)+4>>2]|0;e=(m|0)==0;if(!e){l=m+4|0;c[l>>2]=(c[l>>2]|0)+1}l=d;if(d|0){n=c[k>>2]|0;k=b+4|0;c[g>>2]=d;o=g+4|0;c[o>>2]=m;if(!e){p=m+4|0;c[p>>2]=(c[p>>2]|0)+1}Sd(n,k,g);g=c[o>>2]|0;if(g|0?(o=g+4|0,n=c[o>>2]|0,c[o>>2]=n+-1,(n|0)==0):0){Ra[c[(c[g>>2]|0)+8>>2]&127](g);ng(g)}g=ch(c[l+340>>2]|0,2848,2888,0)|0;n=c[l+344>>2]|0;if(!n)q=0;else{o=n+4|0;c[o>>2]=(c[o>>2]|0)+1;q=n}n=c[k>>2]|0;c[n+(((c[n+((c[g+4>>2]|0)*48|0)+32>>2]|0)+1|0)*48|0)+32>>2]=-1;g=l+336|0;if(!(a[g>>0]|0)){l=c[b+36>>2]|0;n=c[(c[l>>2]|0)+16>>2]|0;lc(h,b+68|0);c[i>>2]=d;d=i+4|0;c[d>>2]=m;if(!e){o=m+4|0;c[o>>2]=(c[o>>2]|0)+1}c[j>>2]=c[b+60>>2];o=j+4|0;p=c[b+64>>2]|0;c[o>>2]=p;if(p|0){b=p+4|0;c[b>>2]=(c[b>>2]|0)+1}Xa[n&15](l,k,h,i,j);j=c[o>>2]|0;if(j|0?(o=j+4|0,i=c[o>>2]|0,c[o>>2]=i+-1,(i|0)==0):0){Ra[c[(c[j>>2]|0)+8>>2]&127](j);ng(j)}j=c[d>>2]|0;if(j|0?(d=j+4|0,i=c[d>>2]|0,c[d>>2]=i+-1,(i|0)==0):0){Ra[c[(c[j>>2]|0)+8>>2]&127](j);ng(j)}j=c[h>>2]|0;if(j|0){i=h+4|0;d=c[i>>2]|0;if((d|0)==(j|0))r=j;else{o=d;do{d=c[o+-4>>2]|0;o=o+-8|0;if(d|0?(k=d+4|0,l=c[k>>2]|0,c[k>>2]=l+-1,(l|0)==0):0){Ra[c[(c[d>>2]|0)+8>>2]&127](d);ng(d)}}while((o|0)!=(j|0));r=c[h>>2]|0}c[i>>2]=j;pg(r)}}a[g>>0]=1;if(q|0?(g=q+4|0,r=c[g>>2]|0,c[g>>2]=r+-1,(r|0)==0):0){Ra[c[(c[q>>2]|0)+8>>2]&127](q);ng(q)}}if(e){Ja=f;return}e=m+4|0;q=c[e>>2]|0;c[e>>2]=q+-1;if(q|0){Ja=f;return}Ra[c[(c[m>>2]|0)+8>>2]&127](m);ng(m);Ja=f;return}function Rd(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0;d=a+4|0;e=c[d>>2]|0;f=c[a>>2]|0;g=e-f>>3;h=g+1|0;i=f;j=e;if(h>>>0>536870911)Og(a);e=a+8|0;k=(c[e>>2]|0)-f|0;f=k>>2;l=k>>3>>>0<268435455?(f>>>0<h>>>0?h:f):536870911;do if(l)if(l>>>0>536870911){f=ea(8)|0;ug(f,5594);c[f>>2]=5332;ia(f|0,3520,71)}else{m=og(l<<3)|0;break}else m=0;while(0);f=m+(g<<3)|0;h=m+(l<<3)|0;c[f>>2]=c[b>>2];l=c[b+4>>2]|0;c[m+(g<<3)+4>>2]=l;if(!l){n=i;o=j}else{j=l+4|0;c[j>>2]=(c[j>>2]|0)+1;n=c[a>>2]|0;o=c[d>>2]|0}j=f+8|0;l=n;if((o|0)==(n|0)){p=f;q=l;r=o}else{i=g+-1-((o+-8-l|0)>>>3)|0;l=o;o=f;do{f=o;o=o+-8|0;g=l;l=l+-8|0;c[o>>2]=c[l>>2];b=g+-4|0;c[f+-4>>2]=c[b>>2];c[l>>2]=0;c[b>>2]=0}while((l|0)!=(n|0));p=m+(i<<3)|0;q=c[a>>2]|0;r=c[d>>2]|0}c[a>>2]=p;c[d>>2]=j;c[e>>2]=h;h=q;if((r|0)!=(h|0)){e=r;do{r=c[e+-4>>2]|0;e=e+-8|0;if(r|0?(j=r+4|0,d=c[j>>2]|0,c[j>>2]=d+-1,(d|0)==0):0){Ra[c[(c[r>>2]|0)+8>>2]&127](r);ng(r)}}while((e|0)!=(h|0))}if(!q)return;pg(q);return}function Sd(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0;f=Ja;Ja=Ja+64|0;if((Ja|0)>=(Ka|0))A(64);g=f+8|0;h=f;i=c[e>>2]|0;j=c[e+4>>2]|0;k=j;if(j|0){l=j+4|0;c[l>>2]=(c[l>>2]|0)+1}l=b+336|0;if((c[l>>2]|0)>0){j=b+332|0;m=b+424|0;b=0;n=c[(c[d>>2]|0)+((c[(c[e>>2]|0)+4>>2]|0)*48|0)+32>>2]|0;o=i;p=k;q=c[j>>2]|0;while(1){if((q|0)>0){r=0;s=n;t=o;u=p;while(1){v=c[(c[m>>2]|0)+(b*12|0)>>2]|0;w=c[v+(r<<3)>>2]|0;x=c[v+(r<<3)+4>>2]|0;v=(x|0)==0;if(!v){y=x+4|0;c[y>>2]=(c[y>>2]|0)+1}if(((w|0)!=0?(a[w+336>>0]|0)==0:0)?(y=c[(c[d>>2]|0)+((c[w+4>>2]|0)*48|0)+32>>2]|0,y>>>0>s>>>0):0){z=x;if(!v){B=x+4|0;c[B>>2]=(c[B>>2]|0)+1}B=u;if((u|0)!=0?(C=B+4|0,D=c[C>>2]|0,c[C>>2]=D+-1,(D|0)==0):0){Ra[c[(c[u>>2]|0)+8>>2]&127](B);ng(B);E=y;F=w;G=z}else{E=y;F=w;G=z}}else{E=s;F=t;G=u}if(!v?(v=x+4|0,z=c[v>>2]|0,c[v>>2]=z+-1,(z|0)==0):0){Ra[c[(c[x>>2]|0)+8>>2]&127](x);ng(x)}r=r+1|0;x=c[j>>2]|0;if((r|0)>=(x|0)){H=E;I=F;J=G;K=x;break}else{s=E;t=F;u=G}}}else{H=n;I=o;J=p;K=q}b=b+1|0;if((b|0)>=(c[l>>2]|0)){L=e;M=I;N=J;break}else{n=H;o=I;p=J;q=K}}}else{L=e;M=i;N=k}k=M;i=c[k+328>>2]|0;c[h>>2]=c[k+324>>2];c[h+4>>2]=i;cg(8147,h)|0;h=c[L>>2]|0;L=M;M=c[h+4>>2]|0;i=c[d>>2]|0;k=c[i+(M*48|0)+32>>2]|0;e=c[i+(M*48|0)+36>>2]|0;M=c[L+4>>2]|0;K=c[i+(M*48|0)+32>>2]|0;q=c[i+(M*48|0)+36>>2]|0;c[g>>2]=h;c[g+4>>2]=L;c[g+8>>2]=k;c[g+12>>2]=e;c[g+16>>2]=K;c[g+20>>2]=q;cg(8166,g)|0;q=1-k+e|0;e=0;do{M=c[d>>2]|0;i=M+((e+k|0)*48|0)|0;J=M+((e+K|0)*48|0)|0;M=g;p=i;I=M+48|0;do{c[M>>2]=c[p>>2];M=M+4|0;p=p+4|0}while((M|0)<(I|0));M=i;p=J;I=M+48|0;do{c[M>>2]=c[p>>2];M=M+4|0;p=p+4|0}while((M|0)<(I|0));M=J;p=g;I=M+48|0;do{c[M>>2]=c[p>>2];M=M+4|0;p=p+4|0}while((M|0)<(I|0));e=e+1|0}while((e|0)!=(q|0));Td(h,d,K);Td(L,d,k);k=N;if(!N){Ja=f;return}d=k+4|0;L=c[d>>2]|0;c[d>>2]=L+-1;if(L|0){Ja=f;return}Ra[c[(c[N>>2]|0)+8>>2]&127](k);ng(k);Ja=f;return}function Td(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0;e=a+4|0;f=d-(c[e>>2]|0)|0;c[e>>2]=d;e=c[b>>2]|0;c[e+(d*48|0)+32>>2]=d;g=e+(d*48|0)+36|0;c[g>>2]=(c[g>>2]|0)+f;g=c[a+312>>2]|0;d=c[a+316>>2]|0;if((g|0)==(d|0))return;a=g;do{g=c[a>>2]|0;e=c[a+4>>2]|0;if(e){h=e+4|0;c[h>>2]=(c[h>>2]|0)+1;Td(g,b,(c[g+4>>2]|0)+f|0);h=e+4|0;i=c[h>>2]|0;c[h>>2]=i+-1;if(!i){Ra[c[(c[e>>2]|0)+8>>2]&127](e);ng(e)}}else Td(g,b,(c[g+4>>2]|0)+f|0);a=a+8|0}while((a|0)!=(d|0));return}function Ud(a){a=a|0;pg(a);return}function Vd(a){a=a|0;var b=0;b=og(8)|0;c[b>>2]=4316;c[b+4>>2]=c[a+4>>2];return b|0}function Wd(a,b){a=a|0;b=b|0;c[b>>2]=4316;c[b+4>>2]=c[a+4>>2];return}function Xd(a){a=a|0;return}function Yd(a){a=a|0;pg(a);return}function Zd(a,b){a=a|0;b=b|0;ae(c[a+4>>2]|0,b);return}function _d(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==8361?a+4|0:0)|0}function $d(a){a=a|0;return 3248}function ae(b,d){b=b|0;d=d|0;var e=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,B=0,C=0,D=0,E=0.0,F=0.0,G=0.0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0;e=Ja;Ja=Ja+32|0;if((Ja|0)>=(Ka|0))A(32);g=e+24|0;h=e+8|0;i=e;j=b+52|0;k=c[j>>2]|0;if((c[k+336>>2]|0)<=0){Ja=e;return}l=g+4|0;m=d+4|0;n=b+68|0;o=b+72|0;p=b+36|0;q=i+4|0;r=h+4|0;s=b+76|0;t=0;u=k;a:while(1){b:do if((c[u+332>>2]|0)>0){k=t+-1|0;v=t+1|0;w=(t&1|0)==0;x=0;y=u;while(1){z=c[(c[y+424>>2]|0)+(t*12|0)>>2]|0;B=c[z+(x<<3)>>2]|0;c[g>>2]=B;C=c[z+(x<<3)+4>>2]|0;c[l>>2]=C;z=B;if(C|0){D=C+4|0;c[D>>2]=(c[D>>2]|0)+1}c:do if(((((B|0)!=0?(E=+f[d>>2],F=+f[m>>2],G=+f[z+16>>2],G<=E):0)?G+ +f[z+24>>2]>=E:0)?(E=+f[z+20>>2],E<=F):0)?E+ +f[z+28>>2]>=F:0){D=c[o>>2]|0;C=c[n>>2]|0;H=D-C|0;I=H>>3;J=C;C=D;if((I>>>0>=2?(D=c[J+(I+-2<<3)>>2]|0,(c[D+324>>2]|0)==(t|0)):0)?(c[D+328>>2]|0)==(x|0):0){D=c[J+(I+-1<<3)>>2]|0;K=c[D+324>>2]|0;L=c[D+328>>2]|0;D=c[C+-4>>2]|0;if(D|0?(M=D+4|0,N=c[M>>2]|0,c[M>>2]=N+-1,(N|0)==0):0){Ra[c[(c[D>>2]|0)+8>>2]&127](D);ng(D)}c[o>>2]=C+-8;be(b,K,L);O=1;break}if(!(a[z+336>>0]|0)){do if(H|0){L=c[j>>2]|0;K=c[J+(I+-1<<3)>>2]|0;C=c[K+324>>2]|0;D=c[K+328>>2]|0;if((C|0)==(t|0)?(x+-1|0)==(D|0)|(x+1|0)==(D|0):0)break;if((D|0)==(x|0)?(k|0)==(C|0)|(v|0)==(C|0):0)break;K=a[L+456>>0]|0;if((x+1|0)==(D|0)&(w&K<<24>>24!=0^1)?(k|0)==(C|0)|(v|0)==(C|0):0)break;if(!((x+-1|0)==(D|0)&(w|K<<24>>24==0))){O=1;break c}if(!((k|0)==(C|0)|(v|0)==(C|0))){O=1;break c}}while(0);I=c[p>>2]|0;J=c[(c[I>>2]|0)+20>>2]|0;lc(h,n);c[i>>2]=c[g>>2];H=c[l>>2]|0;c[q>>2]=H;if(H|0){C=H+4|0;c[C>>2]=(c[C>>2]|0)+1}C=Oa[J&15](I,h,i)|0;I=c[q>>2]|0;if(I|0?(J=I+4|0,H=c[J>>2]|0,c[J>>2]=H+-1,(H|0)==0):0){Ra[c[(c[I>>2]|0)+8>>2]&127](I);ng(I)}I=c[h>>2]|0;if(I|0){H=c[r>>2]|0;if((H|0)==(I|0))P=I;else{J=H;do{H=c[J+-4>>2]|0;J=J+-8|0;do if(H|0){K=H+4|0;D=c[K>>2]|0;c[K>>2]=D+-1;if(D|0)break;Ra[c[(c[H>>2]|0)+8>>2]&127](H);ng(H)}while(0)}while((J|0)!=(I|0));P=c[h>>2]|0}c[r>>2]=I;pg(P)}if(C){J=c[o>>2]|0;if((J|0)==(c[s>>2]|0))Rd(n,g);else{c[J>>2]=c[g>>2];H=c[l>>2]|0;c[J+4>>2]=H;if(!H)Q=J;else{J=H+4|0;c[J>>2]=(c[J>>2]|0)+1;Q=c[o>>2]|0}c[o>>2]=Q+8}Qd(b,t,x);O=0}else O=1}else O=1}else O=7;while(0);z=c[l>>2]|0;if(z|0?(B=z+4|0,J=c[B>>2]|0,c[B>>2]=J+-1,(J|0)==0):0){Ra[c[(c[z>>2]|0)+8>>2]&127](z);ng(z)}switch(O&7){case 7:case 0:break;default:{R=57;break a}}x=x+1|0;z=c[j>>2]|0;if((x|0)>=(c[z+332>>2]|0)){S=v;T=z;break b}else y=z}}else{S=t+1|0;T=u}while(0);if((S|0)<(c[T+336>>2]|0)){t=S;u=T}else{R=57;break}}if((R|0)==57){Ja=e;return}}function be(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0;f=Ja;Ja=Ja+32|0;if((Ja|0)>=(Ka|0))A(32);g=f+16|0;h=f+8|0;i=f;j=c[(c[(c[b+52>>2]|0)+424>>2]|0)+(d*12|0)>>2]|0;d=c[j+(e<<3)>>2]|0;k=c[j+(e<<3)+4>>2]|0;e=(k|0)==0;if(!e){j=k+4|0;c[j>>2]=(c[j>>2]|0)+1}j=d;if(d|0){l=ch(c[j+340>>2]|0,2848,2888,0)|0;m=c[j+344>>2]|0;if(!m)n=0;else{o=m+4|0;c[o>>2]=(c[o>>2]|0)+1;n=m}m=b+4|0;o=c[m>>2]|0;c[o+(((c[o+((c[l+4>>2]|0)*48|0)+32>>2]|0)+1|0)*48|0)+32>>2]=-256;l=j+336|0;if(a[l>>0]|0){j=c[b+36>>2]|0;o=c[(c[j>>2]|0)+12>>2]|0;lc(g,b+68|0);c[h>>2]=d;d=h+4|0;c[d>>2]=k;if(!e){p=k+4|0;c[p>>2]=(c[p>>2]|0)+1}c[i>>2]=c[b+60>>2];p=i+4|0;q=c[b+64>>2]|0;c[p>>2]=q;if(q|0){b=q+4|0;c[b>>2]=(c[b>>2]|0)+1}Xa[o&15](j,m,g,h,i);i=c[p>>2]|0;if(i|0?(p=i+4|0,h=c[p>>2]|0,c[p>>2]=h+-1,(h|0)==0):0){Ra[c[(c[i>>2]|0)+8>>2]&127](i);ng(i)}i=c[d>>2]|0;if(i|0?(d=i+4|0,h=c[d>>2]|0,c[d>>2]=h+-1,(h|0)==0):0){Ra[c[(c[i>>2]|0)+8>>2]&127](i);ng(i)}i=c[g>>2]|0;if(i|0){h=g+4|0;d=c[h>>2]|0;if((d|0)==(i|0))r=i;else{p=d;do{d=c[p+-4>>2]|0;p=p+-8|0;if(d|0?(m=d+4|0,j=c[m>>2]|0,c[m>>2]=j+-1,(j|0)==0):0){Ra[c[(c[d>>2]|0)+8>>2]&127](d);ng(d)}}while((p|0)!=(i|0));r=c[g>>2]|0}c[h>>2]=i;pg(r)}}a[l>>0]=0;if(n|0?(l=n+4|0,r=c[l>>2]|0,c[l>>2]=r+-1,(r|0)==0):0){Ra[c[(c[n>>2]|0)+8>>2]&127](n);ng(n)}}if(e){Ja=f;return}e=k+4|0;n=c[e>>2]|0;c[e>>2]=n+-1;if(n|0){Ja=f;return}Ra[c[(c[k>>2]|0)+8>>2]&127](k);ng(k);Ja=f;return}function ce(a){a=a|0;pg(a);return}function de(a){a=a|0;var b=0;b=og(8)|0;c[b>>2]=4360;c[b+4>>2]=c[a+4>>2];return b|0}function ee(a,b){a=a|0;b=b|0;c[b>>2]=4360;c[b+4>>2]=c[a+4>>2];return}function fe(a){a=a|0;return}function ge(a){a=a|0;pg(a);return}function he(a,b){a=a|0;b=b|0;ke(c[a+4>>2]|0,b);return}function ie(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==8537?a+4|0:0)|0}function je(a){a=a|0;return 3272}function ke(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0;b=Ja;Ja=Ja+16|0;if((Ja|0)>=(Ka|0))A(16);d=b;e=c[a+36>>2]|0;f=c[(c[e>>2]|0)+24>>2]|0;lc(d,a+68|0);g=Na[f&31](e,d)|0;e=c[d>>2]|0;if(e|0){f=d+4|0;h=c[f>>2]|0;if((h|0)==(e|0))i=e;else{j=h;do{h=c[j+-4>>2]|0;j=j+-8|0;if(h|0?(k=h+4|0,l=c[k>>2]|0,c[k>>2]=l+-1,(l|0)==0):0){Ra[c[(c[h>>2]|0)+8>>2]&127](h);ng(h)}}while((j|0)!=(e|0));i=c[d>>2]|0}c[f>>2]=e;pg(i)}if(g){le(a);Ja=b;return}else{me(a);Ja=b;return}}function le(d){d=d|0;var e=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0.0,B=0,C=0,D=0;e=Ja;Ja=Ja+16|0;if((Ja|0)>=(Ka|0))A(16);g=e;h=d+68|0;i=c[h>>2]|0;j=d+72|0;k=c[j>>2]|0;l=d+36|0;if((i|0)!=(k|0)){m=g+4|0;n=d+4|0;o=d+52|0;p=i;do{i=c[p>>2]|0;q=c[p+4>>2]|0;r=(q|0)==0;if(!r){s=q+4|0;c[s>>2]=(c[s>>2]|0)+1}s=i;t=c[s+324>>2]|0;u=c[s+328>>2]|0;a[s+336>>0]=0;v=c[l>>2]|0;w=c[(c[v>>2]|0)+8>>2]|0;c[g>>2]=i;c[m>>2]=q;if(!r){x=q+4|0;c[x>>2]=(c[x>>2]|0)+1}Ta[w&15](v,g);v=c[m>>2]|0;if(v|0?(w=v+4|0,x=c[w>>2]|0,c[w>>2]=x+-1,(x|0)==0):0){Ra[c[(c[v>>2]|0)+8>>2]&127](v);ng(v)}v=ch(c[s+304>>2]|0,3136,3144,0)|0;x=c[s+308>>2]|0;if(!x)y=0;else{s=x+4|0;c[s>>2]=(c[s>>2]|0)+1;y=x}x=c[i+4>>2]|0;i=c[n>>2]|0;z=+f[i+(x*48|0)+12>>2]*2.0;f[v+120>>2]=+f[i+(x*48|0)+8>>2]*2.0;f[v+124>>2]=z;a[v+88>>0]=0;x=v+44|0;i=b[x>>1]|0;f[v+288>>2]=0.0;a[v+248>>0]=0;a[v+5>>0]=0;a[v+4>>0]=0;b[x>>1]=i|34;a[v+32>>0]=1;v=c[(c[(c[o>>2]|0)+424>>2]|0)+(t*12|0)>>2]|0;c[v+(u<<3)>>2]=0;t=v+(u<<3)+4|0;u=c[t>>2]|0;c[t>>2]=0;if(u|0?(t=u+4|0,v=c[t>>2]|0,c[t>>2]=v+-1,(v|0)==0):0){Ra[c[(c[u>>2]|0)+8>>2]&127](u);ng(u)}if(y|0?(u=y+4|0,v=c[u>>2]|0,c[u>>2]=v+-1,(v|0)==0):0){Ra[c[(c[y>>2]|0)+8>>2]&127](y);ng(y)}if(!r?(r=q+4|0,v=c[r>>2]|0,c[r>>2]=v+-1,(v|0)==0):0){Ra[c[(c[q>>2]|0)+8>>2]&127](q);ng(q)}p=p+8|0}while((p|0)!=(k|0))}k=c[l>>2]|0;Ra[c[(c[k>>2]|0)+28>>2]&127](k);k=c[h>>2]|0;h=c[j>>2]|0;if((h|0)==(k|0)){c[j>>2]=k;B=d+52|0;C=c[B>>2]|0;D=d+4|0;ne(C,D);mb(d);Ja=e;return}l=h;do{h=c[l+-4>>2]|0;l=l+-8|0;if(h|0?(p=h+4|0,y=c[p>>2]|0,c[p>>2]=y+-1,(y|0)==0):0){Ra[c[(c[h>>2]|0)+8>>2]&127](h);ng(h)}}while((l|0)!=(k|0));c[j>>2]=k;B=d+52|0;C=c[B>>2]|0;D=d+4|0;ne(C,D);mb(d);Ja=e;return}function me(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;b=Ja;Ja=Ja+16|0;if((Ja|0)>=(Ka|0))A(16);d=b;e=a+68|0;lc(d,e);f=c[e>>2]|0;e=a+72|0;g=c[e>>2]|0;if((g|0)!=(f|0)){h=g;do{g=c[h+-4>>2]|0;h=h+-8|0;if(g|0?(i=g+4|0,j=c[i>>2]|0,c[i>>2]=j+-1,(j|0)==0):0){Ra[c[(c[g>>2]|0)+8>>2]&127](g);ng(g)}}while((h|0)!=(f|0))}c[e>>2]=f;f=c[d>>2]|0;e=d+4|0;h=c[e>>2]|0;if((f|0)==(h|0))k=f;else{g=f;do{f=c[g>>2]|0;j=c[g+4>>2]|0;if(j){i=j+4|0;c[i>>2]=(c[i>>2]|0)+1;be(a,c[f+324>>2]|0,c[f+328>>2]|0);i=j+4|0;l=c[i>>2]|0;c[i>>2]=l+-1;if(!l){Ra[c[(c[j>>2]|0)+8>>2]&127](j);ng(j)}}else be(a,c[f+324>>2]|0,c[f+328>>2]|0);g=g+8|0}while((g|0)!=(h|0));k=c[d>>2]|0}if(!k){Ja=b;return}h=c[e>>2]|0;if((h|0)==(k|0))m=k;else{g=h;do{h=c[g+-4>>2]|0;g=g+-8|0;if(h|0?(a=h+4|0,f=c[a>>2]|0,c[a>>2]=f+-1,(f|0)==0):0){Ra[c[(c[h>>2]|0)+8>>2]&127](h);ng(h)}}while((g|0)!=(k|0));m=c[d>>2]|0}c[e>>2]=k;pg(m);Ja=b;return}function ne(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0;d=a+324|0;if((c[d>>2]|0)<=0)return;e=a+328|0;f=a+424|0;g=0;do{h=c[e>>2]|0;if((h|0)>0){i=h;h=-1;while(1){j=i;i=i+-1|0;k=c[(c[f>>2]|0)+(i*12|0)>>2]|0;l=c[k+(g<<3)>>2]|0;m=c[k+(g<<3)+4>>2]|0;k=(m|0)==0;if(!k){n=m+4|0;c[n>>2]=(c[n>>2]|0)+1}if(l)if((h|0)>-1){oe(a,b,i,g,h,g);o=h+-1|0}else o=h;else o=(h|0)==-1?i:h;if(!k?(k=m+4|0,l=c[k>>2]|0,c[k>>2]=l+-1,(l|0)==0):0){Ra[c[(c[m>>2]|0)+8>>2]&127](m);ng(m)}if((j|0)<=1)break;else h=o}}g=g+1|0}while((g|0)<(c[d>>2]|0));return}function oe(d,e,g,h,i,j){d=d|0;e=e|0;g=g|0;h=h|0;i=i|0;j=j|0;var k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0.0;e=Ja;Ja=Ja+16|0;if((Ja|0)>=(Ka|0))A(16);k=e+8|0;l=e;m=d+336|0;n=c[m>>2]|0;if(n>>>0>g>>>0?(c[d+332>>2]|0)>>>0>h>>>0:0)o=n;else{c[l>>2]=g;c[l+4>>2]=h;cg(8511,l)|0;o=c[m>>2]|0}if(!(o>>>0>i>>>0?(c[d+332>>2]|0)>>>0>j>>>0:0)){c[k>>2]=i;c[k+4>>2]=j;cg(8511,k)|0}k=d+424|0;o=c[k>>2]|0;m=c[o+(g*12|0)>>2]|0;l=c[m+(h<<3)>>2]|0;n=c[m+(h<<3)+4>>2]|0;m=(n|0)==0;if(m)p=o;else{o=n+4|0;c[o>>2]=(c[o>>2]|0)+1;p=c[k>>2]|0}o=l;c[o+324>>2]=i;c[o+328>>2]=j;q=c[p+(i*12|0)>>2]|0;if(!m){p=n+4|0;c[p>>2]=(c[p>>2]|0)+1}c[q+(j<<3)>>2]=l;l=q+(j<<3)+4|0;q=c[l>>2]|0;c[l>>2]=n;if(q|0?(l=q+4|0,p=c[l>>2]|0,c[l>>2]=p+-1,(p|0)==0):0){Ra[c[(c[q>>2]|0)+8>>2]&127](q);ng(q)}q=c[(c[k>>2]|0)+(g*12|0)>>2]|0;c[q+(h<<3)>>2]=0;g=q+(h<<3)+4|0;h=c[g>>2]|0;c[g>>2]=0;if(h|0?(g=h+4|0,q=c[g>>2]|0,c[g>>2]=q+-1,(q|0)==0):0){Ra[c[(c[h>>2]|0)+8>>2]&127](h);ng(h)}h=ch(c[o+304>>2]|0,3136,3144,0)|0;q=c[o+308>>2]|0;if(!q)r=0;else{o=q+4|0;c[o>>2]=(c[o>>2]|0)+1;r=q}s=+f[d+444>>2]*+(i|0)+ +f[d+452>>2]*+(i+1|0);f[h+80>>2]=+f[d+440>>2]*+(j|0)+ +f[d+448>>2]*+(j+1|0);f[h+84>>2]=s;a[h+48>>0]=0;a[h+5>>0]=0;a[h+4>>0]=0;j=h+44|0;b[j>>1]=b[j>>1]|1;if(r|0?(j=r+4|0,h=c[j>>2]|0,c[j>>2]=h+-1,(h|0)==0):0){Ra[c[(c[r>>2]|0)+8>>2]&127](r);ng(r)}if(m){Ja=e;return}m=n+4|0;r=c[m>>2]|0;c[m>>2]=r+-1;if(r|0){Ja=e;return}Ra[c[(c[n>>2]|0)+8>>2]&127](n);ng(n);Ja=e;return}function pe(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0.0,p=0.0,q=0,r=0,s=0,t=0.0,u=0.0,v=0.0,w=0.0,x=0,y=0,z=0;g=Ja;Ja=Ja+32|0;if((Ja|0)>=(Ka|0))A(32);h=g+8|0;i=g;j=g+16|0;k=a+24|0;l=k;m=c[l+4>>2]|0;n=h;c[n>>2]=c[l>>2];c[n+4>>2]=m;m=a+16|0;n=c[m+4>>2]|0;l=i;c[l>>2]=c[m>>2];c[l+4>>2]=n;n=d;l=c[n+4>>2]|0;m=a+44|0;c[m>>2]=c[n>>2];c[m+4>>2]=l;l=e;m=c[l+4>>2]|0;n=a+36|0;c[n>>2]=c[l>>2];c[n+4>>2]=m;m=c[a+4>>2]|0;n=c[b>>2]|0;o=+f[n+(m*48|0)+8>>2]*+f[e>>2]+ +f[n+(m*48|0)+24>>2];l=e+4|0;p=+f[n+(m*48|0)+12>>2]*+f[l>>2]+ +f[n+(m*48|0)+28>>2];q=a+24|0;f[q>>2]=o;r=a+28|0;f[r>>2]=p;s=a+56|0;do if((c[s>>2]|0)==1){t=+f[a+52>>2];u=p*t;if(u<o){f[q>>2]=u;v=p;w=u;break}else{u=o/t;f[r>>2]=u;v=u;w=o;break}}else{v=p;w=o}while(0);o=+f[n+(m*48|0)+20>>2]+(+f[d+4>>2]+ +f[l>>2]*+f[n+(m*48|0)+4>>2]-v*+f[a+12>>2]);f[a+16>>2]=+f[n+(m*48|0)+16>>2]+(+f[d>>2]+ +f[e>>2]*+f[n+(m*48|0)>>2]-w*+f[a+8>>2]);f[a+20>>2]=o;sc(j,a,b);if((c[s>>2]|0)!=3){x=c[a>>2]|0;y=x+12|0;z=c[y>>2]|0;Wa[z&15](a,b,i,h);Ja=g;return}f[k>>2]=+f[j+8>>2]-+f[j>>2];x=c[a>>2]|0;y=x+12|0;z=c[y>>2]|0;Wa[z&15](a,b,i,h);Ja=g;return}function qe(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0;e=c[b>>2]|0;b=(c[e+((c[a+4>>2]|0)*48|0)+32>>2]|0)+1|0;d=a+16|0;f=c[d+4>>2]|0;g=e+(b*48|0)|0;c[g>>2]=c[d>>2];c[g+4>>2]=f;f=a+24|0;a=c[f+4>>2]|0;g=e+(b*48|0)+16|0;c[g>>2]=c[f>>2];c[g+4>>2]=a;return}function re(a,b){a=a|0;b=b|0;return}function se(a){a=a|0;mg(a);pg(a);return}function te(a){a=a|0;var b=0;b=c[a+12>>2]|0;if(!b)return;Ee(b);pg(b);return}function ue(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==8716?a+12|0:0)|0}function ve(a){a=a|0;pg(a);return}function we(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0;c[a+56>>2]=d;if((d|0)!=2)return;d=c[a+4>>2]|0;a=c[b>>2]|0;b=a+(((c[a+(d*48|0)+32>>2]|0)+1|0)*48|0)+16|0;e=c[b+4>>2]|0;f=a+(d*48|0)+24|0;c[f>>2]=c[b>>2];c[f+4>>2]=e;return}function xe(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0.0,o=0.0,p=0,q=0,r=0.0,s=0.0,t=0.0,u=0.0;g=Ja;Ja=Ja+32|0;if((Ja|0)>=(Ka|0))A(32);h=g+8|0;i=g;j=g+16|0;k=a+24|0;l=c[k+4>>2]|0;m=h;c[m>>2]=c[k>>2];c[m+4>>2]=l;l=a+16|0;m=c[l+4>>2]|0;k=i;c[k>>2]=c[l>>2];c[k+4>>2]=m;m=d;k=c[m+4>>2]|0;l=a+44|0;c[l>>2]=c[m>>2];c[l+4>>2]=k;k=e;l=c[k+4>>2]|0;m=a+36|0;c[m>>2]=c[k>>2];c[m+4>>2]=l;l=c[a+4>>2]|0;m=c[b>>2]|0;n=+f[m+(l*48|0)+8>>2]*+f[e>>2]+ +f[m+(l*48|0)+24>>2];k=e+4|0;o=+f[m+(l*48|0)+12>>2]*+f[k>>2]+ +f[m+(l*48|0)+28>>2];p=a+24|0;f[p>>2]=n;q=a+28|0;f[q>>2]=o;do if((c[a+56>>2]|0)==1){r=+f[a+52>>2];s=o*r;if(s<n){f[p>>2]=s;t=o;u=s;break}else{s=n/r;f[q>>2]=s;t=s;u=n;break}}else{t=o;u=n}while(0);n=+f[m+(l*48|0)+20>>2]+(+f[d+4>>2]+ +f[k>>2]*+f[m+(l*48|0)+4>>2]-t*+f[a+12>>2]);f[a+16>>2]=+f[m+(l*48|0)+16>>2]+(+f[d>>2]+ +f[e>>2]*+f[m+(l*48|0)>>2]-u*+f[a+8>>2]);f[a+20>>2]=n;Wa[c[(c[a>>2]|0)+12>>2]&15](a,b,i,h);sc(j,a,b);Ja=g;return}function ye(b,d,e,g){b=b|0;d=d|0;e=e|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0.0,o=0.0,p=0,q=0.0,r=0.0,s=0,t=0,u=0,v=0;g=b+4|0;e=c[g>>2]|0;h=c[d>>2]|0;i=(c[h+(e*48|0)+32>>2]|0)+1|0;j=h+(i*48|0)|0;switch(c[b+56>>2]|0){case 3:case 0:{k=h+(i*48|0)+36|0;l=(c[2846]|0)+((c[k>>2]|0)*12|0)|0;m=h+(i*48|0)+24|0;n=+f[m>>2];o=n==0.0?10.0:n;if((a[l+11>>0]|0)<0)p=c[l>>2]|0;else p=l;n=+U(p|0,+o);q=+f[b+24>>2];if(q<=.1)return;r=o*(q/n);p=(c[2846]|0)+((c[k>>2]|0)*12|0)|0;f[m>>2]=r;if((a[p+11>>0]|0)<0)s=c[p>>2]|0;else s=p;f[h+(i*48|0)+16>>2]=+U(s|0,+r);f[h+(i*48|0)+20>>2]=r;switch(c[h+(i*48|0)+44>>2]|0){case 8:case 2:case 3:case 4:case 7:break;default:return}n=+f[b+20>>2]+(+f[b+28>>2]-r)*+f[b+12>>2];c[j>>2]=c[b+16>>2];f[h+(i*48|0)+4>>2]=n;return}case 2:{switch(c[h+(i*48|0)+44>>2]|0){case 8:case 2:case 3:case 4:case 7:{s=b+16|0;b=c[s+4>>2]|0;p=j;c[p>>2]=c[s>>2];c[p+4>>2]=b;b=c[g>>2]|0;g=c[d>>2]|0;t=(c[g+(b*48|0)+32>>2]|0)+1|0;u=g;v=b;break}default:{t=i;u=h;v=e}}e=u+(t*48|0)+16|0;t=c[e+4>>2]|0;h=u+(v*48|0)+24|0;c[h>>2]=c[e>>2];c[h+4>>2]=t;return}default:return}}function ze(a,b){a=a|0;b=b|0;return}function Ae(a){a=a|0;mg(a);pg(a);return}function Be(a){a=a|0;var b=0;b=c[a+12>>2]|0;if(!b)return;Ee(b);pg(b);return}function Ce(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==8878?a+12|0:0)|0}function De(a){a=a|0;pg(a);return}function Ee(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0;c[a>>2]=3848;b=a+312|0;d=c[b>>2]|0;if(d|0){e=a+316|0;f=c[e>>2]|0;if((f|0)==(d|0))g=d;else{h=f;do{f=c[h+-4>>2]|0;h=h+-8|0;if(f|0?(i=f+4|0,j=c[i>>2]|0,c[i>>2]=j+-1,(j|0)==0):0){Ra[c[(c[f>>2]|0)+8>>2]&127](f);ng(f)}}while((h|0)!=(d|0));g=c[b>>2]|0}c[e>>2]=d;pg(g)}g=c[a+308>>2]|0;if(g|0?(d=g+4|0,e=c[d>>2]|0,c[d>>2]=e+-1,(e|0)==0):0){Ra[c[(c[g>>2]|0)+8>>2]&127](g);ng(g)}g=c[a+296>>2]|0;if((a+280|0)!=(g|0)){if(g|0)Ra[c[(c[g>>2]|0)+20>>2]&127](g)}else Ra[c[(c[g>>2]|0)+16>>2]&127](g);g=c[a+272>>2]|0;if((a+256|0)!=(g|0)){if(g|0)Ra[c[(c[g>>2]|0)+20>>2]&127](g)}else Ra[c[(c[g>>2]|0)+16>>2]&127](g);g=c[a+248>>2]|0;if((a+232|0)!=(g|0)){if(g|0)Ra[c[(c[g>>2]|0)+20>>2]&127](g)}else Ra[c[(c[g>>2]|0)+16>>2]&127](g);g=c[a+216>>2]|0;if((a+200|0)!=(g|0)){if(g|0)Ra[c[(c[g>>2]|0)+20>>2]&127](g)}else Ra[c[(c[g>>2]|0)+16>>2]&127](g);g=c[a+192>>2]|0;if((a+176|0)!=(g|0)){if(g|0)Ra[c[(c[g>>2]|0)+20>>2]&127](g)}else Ra[c[(c[g>>2]|0)+16>>2]&127](g);g=c[a+168>>2]|0;if((a+152|0)!=(g|0)){if(g|0)Ra[c[(c[g>>2]|0)+20>>2]&127](g)}else Ra[c[(c[g>>2]|0)+16>>2]&127](g);g=c[a+136>>2]|0;if((a+120|0)!=(g|0)){if(g|0)Ra[c[(c[g>>2]|0)+20>>2]&127](g)}else Ra[c[(c[g>>2]|0)+16>>2]&127](g);g=c[a+112>>2]|0;if((a+96|0)!=(g|0)){if(g|0)Ra[c[(c[g>>2]|0)+20>>2]&127](g)}else Ra[c[(c[g>>2]|0)+16>>2]&127](g);g=c[a+88>>2]|0;if((a+72|0)==(g|0)){Ra[c[(c[g>>2]|0)+16>>2]&127](g);return}if(!g)return;Ra[c[(c[g>>2]|0)+20>>2]&127](g);return}function Fe(a,b,d,e,g,h){a=a|0;b=b|0;d=d|0;e=e|0;g=g|0;h=h|0;var i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0.0;i=Ja;Ja=Ja+32|0;if((Ja|0)>=(Ka|0))A(32);j=i;k=i+20|0;l=i+16|0;m=i+12|0;n=i+8|0;if(!((c[b+336>>2]|0)>>>0>e>>>0?(c[b+332>>2]|0)>>>0>g>>>0:0)){c[j>>2]=e;c[j+4>>2]=g;cg(8511,j)|0}j=c[b+416>>2]|0;o=c[j>>2]|0;p=c[j+4>>2]|0;a:do if((o|0)!=(p|0)){j=o;while(1){q=c[j>>2]|0;r=c[j+4>>2]|0;s=(r|0)==0;if(!s){t=r+4|0;c[t>>2]=(c[t>>2]|0)+1}u=(c[d>>2]|0)+((c[q+4>>2]|0)*48|0)+40|0;if(!(c[u>>2]|0))break;if(!s?(s=r+4|0,t=c[s>>2]|0,c[s>>2]=t+-1,(t|0)==0):0){Ra[c[(c[r>>2]|0)+8>>2]&127](r);ng(r)}j=j+8|0;if((j|0)==(p|0)){v=13;break a}}c[u>>2]=1;j=ch(q,2848,3104,0)|0;if(!j){c[a>>2]=0;c[a+4>>2]=0;if(!r)break;w=r+4|0}else{c[a>>2]=j;c[a+4>>2]=r;if(!r)break;j=r+4|0;c[j>>2]=(c[j>>2]|0)+1;w=j}j=c[w>>2]|0;c[w>>2]=j+-1;if(!j){Ra[c[(c[r>>2]|0)+8>>2]&127](r);ng(r)}}else v=13;while(0);if((v|0)==13){c[a>>2]=0;c[a+4>>2]=0}v=c[a>>2]|0;c[v+324>>2]=e;c[v+328>>2]=g;c[v+332>>2]=h;r=a+4|0;w=c[r>>2]|0;q=(w|0)==0;if(!q){u=w+4|0;c[u>>2]=(c[u>>2]|0)+1}u=b+440|0;p=b+444|0;o=c[p>>2]|0;j=v+4|0;v=c[j>>2]|0;t=c[d>>2]|0;c[t+(v*48|0)+8>>2]=c[u>>2];c[t+(v*48|0)+12>>2]=o;x=+f[p>>2]*+(e|0)+ +f[b+452>>2]*+(e+1|0);p=c[j>>2]|0;o=c[d>>2]|0;f[o+(p*48|0)>>2]=+f[u>>2]*+(g|0)+ +f[b+448>>2]*+(g+1|0);f[o+(p*48|0)+4>>2]=x;p=c[j>>2]|0;j=c[d>>2]|0;c[j+(p*48|0)+16>>2]=0;c[j+(p*48|0)+20>>2]=0;if(!q?(q=w+4|0,p=c[q>>2]|0,c[q>>2]=p+-1,(p|0)==0):0){Ra[c[(c[w>>2]|0)+8>>2]&127](w);ng(w)}w=c[(c[b+424>>2]|0)+(e*12|0)>>2]|0;p=c[a>>2]|0;q=c[r>>2]|0;if(q|0){r=q+4|0;c[r>>2]=(c[r>>2]|0)+1}c[w+(g<<3)>>2]=p;p=w+(g<<3)+4|0;w=c[p>>2]|0;c[p>>2]=q;if(w|0?(q=w+4|0,p=c[q>>2]|0,c[q>>2]=p+-1,(p|0)==0):0){Ra[c[(c[w>>2]|0)+8>>2]&127](w);ng(w)}w=c[b+408>>2]|0;if(!w){Ja=i;return}c[k>>2]=c[(c[a>>2]|0)+340>>2];c[l>>2]=e;c[m>>2]=g;c[n>>2]=h;Xa[c[(c[w>>2]|0)+24>>2]&15](w,k,l,m,n);Ja=i;return}function Ge(a,b){a=a|0;b=b|0;return}function He(a){a=a|0;mg(a);pg(a);return}function Ie(a){a=a|0;var b=0;b=c[a+12>>2]|0;if(!b)return;Le(b);pg(b);return}function Je(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==9015?a+12|0:0)|0}function Ke(a){a=a|0;pg(a);return}function Le(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0;c[a>>2]=3592;b=a+68|0;d=c[b>>2]|0;if(d|0){e=a+72|0;f=c[e>>2]|0;if((f|0)==(d|0))g=d;else{h=f;do{f=c[h+-4>>2]|0;h=h+-8|0;if(f|0?(i=f+4|0,j=c[i>>2]|0,c[i>>2]=j+-1,(j|0)==0):0){Ra[c[(c[f>>2]|0)+8>>2]&127](f);ng(f)}}while((h|0)!=(d|0));g=c[b>>2]|0}c[e>>2]=d;pg(g)}g=c[a+64>>2]|0;if(g|0?(d=g+4|0,e=c[d>>2]|0,c[d>>2]=e+-1,(e|0)==0):0){Ra[c[(c[g>>2]|0)+8>>2]&127](g);ng(g)}g=c[a+56>>2]|0;if(g|0?(e=g+4|0,d=c[e>>2]|0,c[e>>2]=d+-1,(d|0)==0):0){Ra[c[(c[g>>2]|0)+8>>2]&127](g);ng(g)}g=c[a+48>>2]|0;if(g|0?(d=g+4|0,e=c[d>>2]|0,c[d>>2]=e+-1,(e|0)==0):0){Ra[c[(c[g>>2]|0)+8>>2]&127](g);ng(g)}g=c[a+40>>2]|0;if(g|0?(e=g+4|0,d=c[e>>2]|0,c[e>>2]=d+-1,(d|0)==0):0){Ra[c[(c[g>>2]|0)+8>>2]&127](g);ng(g)}c[a>>2]=3612;g=c[a+20>>2]|0;if(g|0?(d=g+4|0,e=c[d>>2]|0,c[d>>2]=e+-1,(e|0)==0):0){Ra[c[(c[g>>2]|0)+8>>2]&127](g);ng(g)}g=c[a+4>>2]|0;if(!g)return;c[a+8>>2]=g;pg(g);return}function Me(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0;d=Ja;Ja=Ja+16|0;if((Ja|0)>=(Ka|0))A(16);e=d;if((b|0)==(a|0)){Ja=d;return}f=a+16|0;g=c[f>>2]|0;h=g;i=b+16|0;if((g|0)==(a|0))if((c[i>>2]|0)==(b|0)){Ta[c[(c[g>>2]|0)+12>>2]&15](g,e);j=c[f>>2]|0;Ra[c[(c[j>>2]|0)+16>>2]&127](j);c[f>>2]=0;j=c[i>>2]|0;Ta[c[(c[j>>2]|0)+12>>2]&15](j,a);j=c[i>>2]|0;Ra[c[(c[j>>2]|0)+16>>2]&127](j);c[i>>2]=0;c[f>>2]=a;Ta[c[(c[e>>2]|0)+12>>2]&15](e,b);Ra[c[(c[e>>2]|0)+16>>2]&127](e);c[i>>2]=b;Ja=d;return}else{Ta[c[(c[g>>2]|0)+12>>2]&15](g,b);g=c[f>>2]|0;Ra[c[(c[g>>2]|0)+16>>2]&127](g);g=b+16|0;c[f>>2]=c[g>>2];c[g>>2]=b;Ja=d;return}else{g=c[i>>2]|0;if((b|0)==(g|0)){Ta[c[(c[g>>2]|0)+12>>2]&15](g,a);b=c[i>>2]|0;Ra[c[(c[b>>2]|0)+16>>2]&127](b);c[i>>2]=c[f>>2];c[f>>2]=a;Ja=d;return}else{c[f>>2]=g;c[i>>2]=h;Ja=d;return}}}function Ne(a){a=a|0;pg(a);return}function Oe(a){a=a|0;var b=0,d=0;b=og(24)|0;d=a+4|0;c[b>>2]=4536;a=b+4|0;c[a>>2]=c[d>>2];c[a+4>>2]=c[d+4>>2];c[a+8>>2]=c[d+8>>2];c[a+12>>2]=c[d+12>>2];c[a+16>>2]=c[d+16>>2];return b|0}function Pe(a,b){a=a|0;b=b|0;var d=0;d=a+4|0;c[b>>2]=4536;a=b+4|0;c[a>>2]=c[d>>2];c[a+4>>2]=c[d+4>>2];c[a+8>>2]=c[d+8>>2];c[a+12>>2]=c[d+12>>2];c[a+16>>2]=c[d+16>>2];return}function Qe(a){a=a|0;return}function Re(a){a=a|0;pg(a);return}function Se(a){a=a|0;var b=0,d=0,e=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0;b=Ja;Ja=Ja+16|0;if((Ja|0)>=(Ka|0))A(16);d=b;e=S()|0;g=a+4|0;if((e|0)==(c[c[g>>2]>>2]|0)){h=a+8|0;i=c[h>>2]|0;We(i);Ja=b;return}c[d>>2]=e;cg(9157,d)|0;c[c[g>>2]>>2]=e;switch(e|0){case 0:{e=c[a+8>>2]|0;g=c[a+12>>2]|0;j=c[g>>2]|0;k=c[g+4>>2]|0;g=(k|0)==0;if(!g){l=k+4|0;c[l>>2]=(c[l>>2]|0)+1;c[l>>2]=(c[l>>2]|0)+1}l=e+32|0;c[l>>2]=j;j=e+36|0;m=c[j>>2]|0;c[j>>2]=k;if(m|0?(j=m+4|0,n=c[j>>2]|0,c[j>>2]=n+-1,(n|0)==0):0){Ra[c[(c[m>>2]|0)+8>>2]&127](m);ng(m)}m=c[l>>2]|0;l=e+24|0;e=l;n=c[e+4>>2]|0;j=m+24|0;c[j>>2]=c[e>>2];c[j+4>>2]=n;n=c[m+16>>2]|0;if(n|0){j=c[(c[n>>2]|0)+8>>2]|0;f[d>>2]=0.0;f[d+4>>2]=0.0;Wa[j&15](n,m+4|0,d,l)}if(g){h=a+8|0;i=c[h>>2]|0;We(i);Ja=b;return}g=k+4|0;l=c[g>>2]|0;c[g>>2]=l+-1;if(l|0){h=a+8|0;i=c[h>>2]|0;We(i);Ja=b;return}Ra[c[(c[k>>2]|0)+8>>2]&127](k);ng(k);h=a+8|0;i=c[h>>2]|0;We(i);Ja=b;return}case 1:{k=c[a+8>>2]|0;l=c[a+16>>2]|0;g=c[l>>2]|0;m=c[l+4>>2]|0;l=(m|0)==0;if(!l){n=m+4|0;c[n>>2]=(c[n>>2]|0)+1;c[n>>2]=(c[n>>2]|0)+1}n=k+32|0;c[n>>2]=g;g=k+36|0;j=c[g>>2]|0;c[g>>2]=m;if(j|0?(g=j+4|0,e=c[g>>2]|0,c[g>>2]=e+-1,(e|0)==0):0){Ra[c[(c[j>>2]|0)+8>>2]&127](j);ng(j)}j=c[n>>2]|0;n=k+24|0;k=n;e=c[k+4>>2]|0;g=j+24|0;c[g>>2]=c[k>>2];c[g+4>>2]=e;e=c[j+16>>2]|0;if(e|0){g=c[(c[e>>2]|0)+8>>2]|0;f[d>>2]=0.0;f[d+4>>2]=0.0;Wa[g&15](e,j+4|0,d,n)}if(l){h=a+8|0;i=c[h>>2]|0;We(i);Ja=b;return}l=m+4|0;n=c[l>>2]|0;c[l>>2]=n+-1;if(n|0){h=a+8|0;i=c[h>>2]|0;We(i);Ja=b;return}Ra[c[(c[m>>2]|0)+8>>2]&127](m);ng(m);h=a+8|0;i=c[h>>2]|0;We(i);Ja=b;return}case 2:{m=c[a+8>>2]|0;n=c[a+20>>2]|0;l=c[n>>2]|0;j=c[n+4>>2]|0;n=(j|0)==0;if(!n){e=j+4|0;c[e>>2]=(c[e>>2]|0)+1;c[e>>2]=(c[e>>2]|0)+1}e=m+32|0;c[e>>2]=l;l=m+36|0;g=c[l>>2]|0;c[l>>2]=j;if(g|0?(l=g+4|0,k=c[l>>2]|0,c[l>>2]=k+-1,(k|0)==0):0){Ra[c[(c[g>>2]|0)+8>>2]&127](g);ng(g)}g=c[e>>2]|0;e=m+24|0;m=e;k=c[m+4>>2]|0;l=g+24|0;c[l>>2]=c[m>>2];c[l+4>>2]=k;k=c[g+16>>2]|0;if(k|0){l=c[(c[k>>2]|0)+8>>2]|0;f[d>>2]=0.0;f[d+4>>2]=0.0;Wa[l&15](k,g+4|0,d,e)}if(n){h=a+8|0;i=c[h>>2]|0;We(i);Ja=b;return}n=j+4|0;e=c[n>>2]|0;c[n>>2]=e+-1;if(e|0){h=a+8|0;i=c[h>>2]|0;We(i);Ja=b;return}Ra[c[(c[j>>2]|0)+8>>2]&127](j);ng(j);h=a+8|0;i=c[h>>2]|0;We(i);Ja=b;return}default:{h=a+8|0;i=c[h>>2]|0;We(i);Ja=b;return}}}function Te(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==9265?a+4|0:0)|0}function Ue(a){a=a|0;return 3384}function Ve(a){a=a|0;return}function We(a){a=a|0;var b=0,d=0,e=0,h=0.0,i=0.0,j=0.0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0;b=Ja;Ja=Ja+16|0;if((Ja|0)>=(Ka|0))A(16);d=b;e=a+12|0;c[e>>2]=(c[e>>2]|0)+1;h=+xa();O();i=+Da();j=+Ca();k=a+24|0;l=a+28|0;if(i==+f[k>>2]?j==+f[l>>2]:0)m=a+32|0;else{g[d>>3]=i;g[d+8>>3]=j;cg(9171,d)|0;f[k>>2]=i;f[l>>2]=j;l=a+32|0;n=c[l>>2]|0;o=k;p=c[o+4>>2]|0;q=n+24|0;c[q>>2]=c[o>>2];c[q+4>>2]=p;p=c[n+16>>2]|0;if(!p)m=l;else{q=c[(c[p>>2]|0)+8>>2]|0;f[d>>2]=0.0;f[d+4>>2]=0.0;Wa[q&15](p,n+4|0,d,k);m=l}}Xe(a);l=c[m>>2]|0;m=a+16|0;j=h-+g[m>>3];Sa[c[c[l>>2]>>2]&1](l,j,a);k=c[l+16>>2]|0;if(!k){r=c[e>>2]|0;Ye(a,h,r,0);g[m>>3]=h;Ja=b;return}af(k,l+4|0,j);r=c[e>>2]|0;Ye(a,h,r,0);g[m>>3]=h;Ja=b;return}function Xe(a){a=a|0;var b=0,e=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,B=0.0,C=0;b=Ja;Ja=Ja+96|0;if((Ja|0)>=(Ka|0))A(96);e=b+64|0;g=b+48|0;h=b;i=b+80|0;j=b+72|0;if(!(ba(h|0)|0)){Ja=b;return}k=h+16|0;l=a+32|0;m=h+20|0;n=h+24|0;o=i+4|0;p=h+28|0;q=h+32|0;r=j+4|0;s=h+17|0;t=h+20|0;u=i+4|0;v=i+4|0;w=h+8|0;a:while(1){switch(c[h>>2]|0){case 256:{x=4;break a;break}case 769:{y=c[k>>2]|0;z=(c[a>>2]|0)+(y>>>5<<2)|0;c[z>>2]=c[z>>2]&~(1<<(y&31));z=c[l>>2]|0;Ta[c[(c[z>>2]|0)+4>>2]&15](z,y);break}case 768:{y=c[k>>2]|0;z=(c[a>>2]|0)+(y>>>5<<2)|0;c[z>>2]=c[z>>2]|1<<(y&31);z=c[l>>2]|0;Ta[c[(c[z>>2]|0)+8>>2]&15](z,y);break}case 1024:{y=c[l>>2]|0;B=+(c[n>>2]|0);f[i>>2]=+(c[m>>2]|0);f[o>>2]=B;B=+(c[q>>2]|0);f[j>>2]=+(c[p>>2]|0);f[r>>2]=B;z=c[y+16>>2]|0;if(z|0)Ze(z,y+4|0,i,j)|0;break}case 1025:{y=d[s>>0]|0;z=c[t>>2]|0;C=c[n>>2]|0;c[g>>2]=d[k>>0];c[g+4>>2]=y;c[g+8>>2]=z;c[g+12>>2]=C;cg(9199,g)|0;C=c[l>>2]|0;B=+(c[n>>2]|0);f[i>>2]=+(c[t>>2]|0);f[u>>2]=B;z=c[C+16>>2]|0;if(z|0)_e(z,C+4|0,i)|0;break}case 1026:{C=c[l>>2]|0;B=+(c[n>>2]|0);f[i>>2]=+(c[t>>2]|0);f[v>>2]=B;z=c[C+16>>2]|0;if(z|0)$e(z,C+4|0,i)|0;break}case 512:{C=d[w>>0]|0;c[e>>2]=512;c[e+4>>2]=C;cg(9226,e)|0;break}default:{}}if(!(ba(h|0)|0)){x=18;break}}if((x|0)==4)kh();else if((x|0)==18){Ja=b;return}}function Ye(b,d,e,g){b=b|0;d=+d;e=e|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,s=0.0,t=0.0,v=0,w=0,x=0,y=0,B=0;g=Ja;Ja=Ja+16|0;if((Ja|0)>=(Ka|0))A(16);e=g;h=c[b+32>>2]|0;b=h+4|0;c[e>>2]=0;i=e+4|0;c[i>>2]=0;j=e+8|0;c[j>>2]=0;k=h+8|0;h=(c[k>>2]|0)-(c[b>>2]|0)|0;l=(h|0)/48|0;if(h){if(l>>>0>89478485)Og(e);m=og(h)|0;c[i>>2]=m;c[e>>2]=m;c[j>>2]=m+(l*48|0);l=c[b>>2]|0;b=(c[k>>2]|0)-l|0;if((b|0)>0){Rh(m|0,l|0,b|0)|0;l=m+(((b>>>0)/48|0)*48|0)|0;c[i>>2]=l;if((l|0)==(m|0)){n=m;o=i}else{l=0;b=m;k=0;do{j=b+(k*48|0)|0;switch(c[b+(k*48|0)+44>>2]|0){case 1:{if(!(c[b+(k*48|0)+40>>2]|0)){p=c[b+(k*48|0)+36>>2]|0;q=0}else{p=k;q=l}break}case 2:{d=+f[b+(k*48|0)+16>>2];s=+f[b+(k*48|0)+20>>2];P(+(+f[j>>2]+d),+(+f[b+(k*48|0)+4>>2]+s),+d,+s,c[b+(k*48|0)+32>>2]|0);p=k;q=l;break}case 3:{s=+f[b+(k*48|0)+16>>2];d=+f[b+(k*48|0)+20>>2];Y(+(+f[j>>2]+s),+(+f[b+(k*48|0)+4>>2]+d),+s,+d,+(+f[b+(k*48|0)+24>>2]),c[b+(k*48|0)+32>>2]|0);p=k;q=l;break}case 4:{d=+r(+(+f[j>>2]))+0.0;s=+r(+(+f[b+(k*48|0)+4>>2]))+0.0;t=+u(+(+f[b+(k*48|0)+16>>2]))+0.0;V(+d,+s,+t,+(+u(+(+f[b+(k*48|0)+20>>2]))+0.0),+(+f[b+(k*48|0)+24>>2]),c[b+(k*48|0)+32>>2]|0,c[b+(k*48|0)+36>>2]|0);p=k;q=l;break}case 5:{t=+r(+(+f[j>>2]))+0.0;s=+r(+(+f[b+(k*48|0)+4>>2]))+0.0;d=+u(+(+f[b+(k*48|0)+16>>2]))+0.0;Q(+t,+s,+d,+(+u(+(+f[b+(k*48|0)+20>>2]))+0.0),c[b+(k*48|0)+36>>2]|0);p=k;q=l;break}case 6:{d=+r(+(+f[j>>2]))+0.0;s=+r(+(+f[b+(k*48|0)+4>>2]))+0.0;t=+u(+(+f[b+(k*48|0)+16>>2]))+0.0;Z(+d,+s,+t,+(+u(+(+f[b+(k*48|0)+20>>2]))+0.0),+(+f[b+(k*48|0)+24>>2]),c[b+(k*48|0)+36>>2]|0);p=k;q=l;break}case 7:{W(+(+f[j>>2]),+(+f[b+(k*48|0)+4>>2]),+(+f[b+(k*48|0)+16>>2]),+(+f[b+(k*48|0)+20>>2]),+(+f[b+(k*48|0)+24>>2]),+(+f[b+(k*48|0)+28>>2]),c[b+(k*48|0)+32>>2]|0,c[b+(k*48|0)+36>>2]|0);p=k;q=l;break}case 8:{h=(c[2846]|0)+((c[b+(k*48|0)+36>>2]|0)*12|0)|0;if((a[h+11>>0]|0)<0)v=c[h>>2]|0;else v=h;t=+f[b+(k*48|0)+24>>2];R(v|0,+(+f[j>>2]),+(+f[b+(k*48|0)+4>>2]+t),+t,c[b+(k*48|0)+32>>2]|0);p=k;q=l;break}default:{p=k;q=l}}k=Jh(p|0,q|0,1,0)|0;l=z()|0;b=c[e>>2]|0}while((l|0)<0|((l|0)==0?k>>>0<(((c[i>>2]|0)-b|0)/48|0)>>>0:0));w=i;x=b;y=9}}else{B=m;y=5}}else{B=0;y=5}if((y|0)==5){w=i;x=B;y=9}if((y|0)==9)if(!x){Ja=g;return}else{n=x;o=w}c[o>>2]=n;pg(n);Ja=g;return}function Ze(b,d,e,g){b=b|0;d=d|0;e=e|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0.0,o=0,p=0,q=0,r=0;h=Ja;Ja=Ja+16|0;if((Ja|0)>=(Ka|0))A(16);i=h;j=b+4|0;k=c[j>>2]|0;l=c[d>>2]|0;if(!(c[l+(k*48|0)+40>>2]|0)){m=0;Ja=h;return m|0}if(a[b+65>>0]|0){n=+f[l+(k*48|0)+20>>2]+ +f[g+4>>2];f[i>>2]=+f[l+(k*48|0)+16>>2]+ +f[g>>2];f[i+4>>2]=n;o=c[b+88>>2]|0;if(!o){p=l;q=k}else{Ta[c[(c[o>>2]|0)+24>>2]&15](o,i);p=c[d>>2]|0;q=c[j>>2]|0}j=i;i=c[j+4>>2]|0;o=p+(q*48|0)+16|0;c[o>>2]=c[j>>2];c[o+4>>2]=i;Wa[c[(c[b>>2]|0)+8>>2]&15](b,d,b+44|0,b+36|0);m=1;Ja=h;return m|0}if(a[b+225>>0]|0?(i=c[b+272>>2]|0,i|0):0){Ta[c[(c[i>>2]|0)+24>>2]&15](i,e);m=1;Ja=h;return m|0}i=b+312|0;o=c[i>>2]|0;j=(c[b+316>>2]|0)-o|0;if((j|0)<=0){m=0;Ja=h;return m|0}b=(j>>>3)+-1|0;j=o;while(1){o=c[j+(b<<3)>>2]|0;q=c[j+(b<<3)+4>>2]|0;p=(q|0)==0;if(!p){k=q+4|0;c[k>>2]=(c[k>>2]|0)+1}k=Ze(o,d,e,g)|0;if(!p?(p=q+4|0,o=c[p>>2]|0,c[p>>2]=o+-1,(o|0)==0):0){Ra[c[(c[q>>2]|0)+8>>2]&127](q);ng(q)}if(k){m=1;r=19;break}k=b+-1|0;if((k|0)<=-1){m=0;r=19;break}b=k;j=c[i>>2]|0}if((r|0)==19){Ja=h;return m|0}return 0}function _e(b,d,e){b=b|0;d=d|0;e=e|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0.0,t=0.0,u=0.0;g=Ja;Ja=Ja+16|0;if((Ja|0)>=(Ka|0))A(16);h=g;if(!(c[(c[d>>2]|0)+((c[b+4>>2]|0)*48|0)+40>>2]|0)){i=0;Ja=g;return i|0}j=b+312|0;k=c[j>>2]|0;l=(c[b+316>>2]|0)-k|0;a:do if((l|0)>0){m=(l>>>3)+-1|0;n=k;while(1){o=c[n+(m<<3)>>2]|0;p=c[n+(m<<3)+4>>2]|0;q=(p|0)==0;if(!q){r=p+4|0;c[r>>2]=(c[r>>2]|0)+1}r=_e(o,d,e)|0;if(!q?(q=p+4|0,o=c[q>>2]|0,c[q>>2]=o+-1,(o|0)==0):0){Ra[c[(c[p>>2]|0)+8>>2]&127](p);ng(p)}if(r){i=1;break}r=m+-1|0;if((r|0)<=-1)break a;m=r;n=c[j>>2]|0}Ja=g;return i|0}while(0);if((((a[b+224>>0]|0?(s=+f[e>>2],t=+f[e+4>>2],u=+f[b+16>>2],u<=s):0)?u+ +f[b+24>>2]>=s:0)?(s=+f[b+20>>2],s<=t):0)?s+ +f[b+28>>2]>=t:0){eg(9305)|0;a[b+225>>0]=1;j=c[b+248>>2]|0;if(!j){i=1;Ja=g;return i|0}Ta[c[(c[j>>2]|0)+24>>2]&15](j,e);i=1;Ja=g;return i|0}if((((a[b+144>>0]|0?(t=+f[e>>2],s=+f[e+4>>2],u=+f[b+16>>2],u<=t):0)?u+ +f[b+24>>2]>=t:0)?(t=+f[b+20>>2],t<=s):0)?t+ +f[b+28>>2]>=s:0){a[b+145>>0]=1;j=c[b+168>>2]|0;if(!j){i=1;Ja=g;return i|0}Ra[c[(c[j>>2]|0)+24>>2]&127](j);i=1;Ja=g;return i|0}if(!(a[b+64>>0]|0)){i=0;Ja=g;return i|0}s=+f[e>>2];t=+f[e+4>>2];u=+f[b+16>>2];if(!(u<=s)){i=0;Ja=g;return i|0}if(!(u+ +f[b+24>>2]>=s)){i=0;Ja=g;return i|0}s=+f[b+20>>2];if(!(s<=t)){i=0;Ja=g;return i|0}if(!(s+ +f[b+28>>2]>=t)){i=0;Ja=g;return i|0}c[h>>2]=b;cg(9246,h)|0;h=c[b+112>>2]|0;if(h|0)Ra[c[(c[h>>2]|0)+24>>2]&127](h);a[b+65>>0]=1;i=1;Ja=g;return i|0}function $e(b,d,e){b=b|0;d=d|0;e=e|0;var g=0,h=0,i=0.0,j=0.0,k=0.0,l=0,m=0,n=0,o=0,p=0,q=0;if(!(c[(c[d>>2]|0)+((c[b+4>>2]|0)*48|0)+40>>2]|0)){g=0;return g|0}if(a[b+144>>0]|0?(h=b+145|0,a[h>>0]|0):0){a[h>>0]=0;h=c[b+192>>2]|0;if(h|0)Ra[c[(c[h>>2]|0)+24>>2]&127](h);h=c[b+216>>2]|0;if(!h){g=1;return g|0}i=+f[e>>2];j=+f[e+4>>2];k=+f[b+16>>2];if(!(k<=i)){g=1;return g|0}if(!(k+ +f[b+24>>2]>=i)){g=1;return g|0}i=+f[b+20>>2];if(!(i<=j)){g=1;return g|0}if(!(i+ +f[b+28>>2]>=j)){g=1;return g|0}Ta[c[(c[h>>2]|0)+24>>2]&15](h,e);g=1;return g|0}if(a[b+64>>0]|0?(h=b+65|0,a[h>>0]|0):0){l=c[b+136>>2]|0;if(l|0)Ra[c[(c[l>>2]|0)+24>>2]&127](l);a[h>>0]=0;g=1;return g|0}if(a[b+224>>0]|0?(h=b+225|0,a[h>>0]|0):0){l=c[b+296>>2]|0;if(l|0)Ta[c[(c[l>>2]|0)+24>>2]&15](l,e);a[h>>0]=0;g=1;return g|0}h=b+312|0;l=c[h>>2]|0;m=(c[b+316>>2]|0)-l|0;if((m|0)<=0){g=0;return g|0}b=(m>>>3)+-1|0;m=l;while(1){l=c[m+(b<<3)>>2]|0;n=c[m+(b<<3)+4>>2]|0;o=(n|0)==0;if(!o){p=n+4|0;c[p>>2]=(c[p>>2]|0)+1}p=$e(l,d,e)|0;if(!o?(o=n+4|0,l=c[o>>2]|0,c[o>>2]=l+-1,(l|0)==0):0){Ra[c[(c[n>>2]|0)+8>>2]&127](n);ng(n)}if(p){g=1;q=32;break}p=b+-1|0;if((p|0)<=-1){g=0;q=32;break}b=p;m=c[h>>2]|0}if((q|0)==32)return g|0;return 0}function af(b,d,e){b=b|0;d=d|0;e=+e;var f=0,g=0,h=0,i=0,j=0;if(!(c[(c[d>>2]|0)+((c[b+4>>2]|0)*48|0)+40>>2]|0))return;f=b+304|0;g=c[f>>2]|0;do if(g|0?(a[g+5>>0]|0)==0:0){h=(a[g+4>>0]|0)==0;Ua[c[c[g>>2]>>2]&3](g,d,e);if(h){Wa[c[(c[b>>2]|0)+8>>2]&15](b,d,b+44|0,b+36|0);break}h=c[f>>2]|0;a[h+5>>0]=1;i=c[h+24>>2]|0;if(i|0)Ra[c[(c[i>>2]|0)+24>>2]&127](i)}while(0);f=c[b+312>>2]|0;g=c[b+316>>2]|0;if((f|0)==(g|0))return;b=f;do{f=c[b>>2]|0;i=c[b+4>>2]|0;if(i){h=i+4|0;c[h>>2]=(c[h>>2]|0)+1;af(f,d,e);h=i+4|0;j=c[h>>2]|0;c[h>>2]=j+-1;if(!j){Ra[c[(c[i>>2]|0)+8>>2]&127](i);ng(i)}}else af(f,d,e);b=b+8|0}while((b|0)!=(g|0));return}function bf(){var b=0,d=0,e=0,f=0,g=0,h=0;b=Ja;Ja=Ja+16|0;if((Ja|0)>=(Ka|0))A(16);d=b;c[2846]=0;c[2847]=0;c[2848]=0;c[2849]=0;c[2850]=0;c[2851]=0;c[2852]=0;c[2853]=1065353216;e=og(16)|0;c[d>>2]=e;c[d+8>>2]=-2147483632;c[d+4>>2]=12;f=e;g=5581;h=f+12|0;do{a[f>>0]=a[g>>0]|0;f=f+1|0;g=g+1|0}while((f|0)<(h|0));a[e+12>>0]=0;qg(11416,d);if((a[d+11>>0]|0)<0)pg(c[d>>2]|0);d=rg(11416)|0;c[2855]=d;e=1;g=d;do{g=(v(g>>>30^g,1812433253)|0)+e|0;c[11420+(e<<2)>>2]=g;e=e+1|0}while((e|0)!=624);c[3479]=0;c[2812]=0;Ja=b;return}function cf(a){a=a|0;var b=0,d=0;b=Ja;Ja=Ja+16|0;if((Ja|0)>=(Ka|0))A(16);d=b;c[d>>2]=hf(c[a+60>>2]|0)|0;a=ff(ta(6,d|0)|0)|0;Ja=b;return a|0}function df(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0;e=Ja;Ja=Ja+48|0;if((Ja|0)>=(Ka|0))A(48);f=e+32|0;g=e+16|0;h=e;i=a+28|0;j=c[i>>2]|0;c[h>>2]=j;k=a+20|0;l=(c[k>>2]|0)-j|0;c[h+4>>2]=l;c[h+8>>2]=b;c[h+12>>2]=d;b=l+d|0;l=a+60|0;c[g>>2]=c[l>>2];c[g+4>>2]=h;c[g+8>>2]=2;j=ff(oa(146,g|0)|0)|0;a:do if((b|0)!=(j|0)){g=2;m=b;n=h;o=j;while(1){if((o|0)<0)break;m=m-o|0;p=c[n+4>>2]|0;q=o>>>0>p>>>0;r=q?n+8|0:n;s=g+(q<<31>>31)|0;t=o-(q?p:0)|0;c[r>>2]=(c[r>>2]|0)+t;p=r+4|0;c[p>>2]=(c[p>>2]|0)-t;c[f>>2]=c[l>>2];c[f+4>>2]=r;c[f+8>>2]=s;o=ff(oa(146,f|0)|0)|0;if((m|0)==(o|0)){u=3;break a}else{g=s;n=r}}c[a+16>>2]=0;c[i>>2]=0;c[k>>2]=0;c[a>>2]=c[a>>2]|32;if((g|0)==2)v=0;else v=d-(c[n+4>>2]|0)|0}else u=3;while(0);if((u|0)==3){u=c[a+44>>2]|0;c[a+16>>2]=u+(c[a+48>>2]|0);a=u;c[i>>2]=a;c[k>>2]=a;v=d}Ja=e;return v|0}function ef(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0;e=Ja;Ja=Ja+32|0;if((Ja|0)>=(Ka|0))A(32);f=e;g=e+20|0;c[f>>2]=c[a+60>>2];c[f+4>>2]=0;c[f+8>>2]=b;c[f+12>>2]=g;c[f+16>>2]=d;if((ff(na(140,f|0)|0)|0)<0){c[g>>2]=-1;h=-1}else h=c[g>>2]|0;Ja=e;return h|0}function ff(a){a=a|0;var b=0;if(a>>>0>4294963200){c[(gf()|0)>>2]=0-a;b=-1}else b=a;return b|0}function gf(){return 14068}function hf(a){a=a|0;return a|0}function jf(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0;f=Ja;Ja=Ja+32|0;if((Ja|0)>=(Ka|0))A(32);g=f;c[b+36>>2]=4;if((c[b>>2]&64|0)==0?(c[g>>2]=c[b+60>>2],c[g+4>>2]=21523,c[g+8>>2]=f+16,sa(54,g|0)|0):0)a[b+75>>0]=-1;g=df(b,d,e)|0;Ja=f;return g|0}function kf(a){a=a|0;return (a+-48|0)>>>0<10|0}function lf(){return 4832}function mf(b,c){b=b|0;c=c|0;var d=0,e=0,f=0,g=0;d=a[b>>0]|0;e=a[c>>0]|0;if(d<<24>>24==0?1:d<<24>>24!=e<<24>>24){f=e;g=d}else{d=c;c=b;do{c=c+1|0;d=d+1|0;b=a[c>>0]|0;e=a[d>>0]|0}while(!(b<<24>>24==0?1:b<<24>>24!=e<<24>>24));f=e;g=b}return (g&255)-(f&255)|0}function nf(b){b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0;d=b;a:do if(!(d&3)){e=b;f=5}else{g=b;h=d;while(1){if(!(a[g>>0]|0)){i=h;break a}j=g+1|0;h=j;if(!(h&3)){e=j;f=5;break}else g=j}}while(0);if((f|0)==5){f=e;while(1){k=c[f>>2]|0;if(!((k&-2139062144^-2139062144)&k+-16843009))f=f+4|0;else break}if(!((k&255)<<24>>24))l=f;else{k=f;while(1){f=k+1|0;if(!(a[f>>0]|0)){l=f;break}else k=f}}i=l}return i-d|0}function of(a,b){a=a|0;b=b|0;var c=0;c=nf(a)|0;return ((pf(a,1,c,b)|0)!=(c|0))<<31>>31|0}function pf(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0;f=v(d,b)|0;g=(b|0)==0?0:d;if((c[e+76>>2]|0)>-1){d=(rf(e)|0)==0;h=uf(a,f,e)|0;if(d)i=h;else{qf(e);i=h}}else i=uf(a,f,e)|0;if((i|0)==(f|0))j=g;else j=(i>>>0)/(b>>>0)|0;return j|0}function qf(a){a=a|0;return}function rf(a){a=a|0;return 1}function sf(b,e){b=b|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0;f=Ja;Ja=Ja+16|0;if((Ja|0)>=(Ka|0))A(16);g=f;h=e&255;a[g>>0]=h;i=b+16|0;j=c[i>>2]|0;if(!j)if(!(tf(b)|0)){k=c[i>>2]|0;l=4}else m=-1;else{k=j;l=4}do if((l|0)==4){j=b+20|0;i=c[j>>2]|0;if(i>>>0<k>>>0?(n=e&255,(n|0)!=(a[b+75>>0]|0)):0){c[j>>2]=i+1;a[i>>0]=h;m=n;break}if((Oa[c[b+36>>2]&15](b,g,1)|0)==1)m=d[g>>0]|0;else m=-1}while(0);Ja=f;return m|0}function tf(b){b=b|0;var d=0,e=0,f=0;d=b+74|0;e=a[d>>0]|0;a[d>>0]=e+255|e;e=c[b>>2]|0;if(!(e&8)){c[b+8>>2]=0;c[b+4>>2]=0;d=c[b+44>>2]|0;c[b+28>>2]=d;c[b+20>>2]=d;c[b+16>>2]=d+(c[b+48>>2]|0);f=0}else{c[b>>2]=e|32;f=-1}return f|0}function uf(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0;f=e+16|0;g=c[f>>2]|0;if(!g)if(!(tf(e)|0)){h=c[f>>2]|0;i=5}else j=0;else{h=g;i=5}a:do if((i|0)==5){g=e+20|0;f=c[g>>2]|0;k=f;if((h-f|0)>>>0<d>>>0){j=Oa[c[e+36>>2]&15](e,b,d)|0;break}b:do if((a[e+75>>0]|0)<0|(d|0)==0){l=0;m=b;n=d;o=k}else{f=d;while(1){p=f+-1|0;if((a[b+p>>0]|0)==10)break;if(!p){l=0;m=b;n=d;o=k;break b}else f=p}p=Oa[c[e+36>>2]&15](e,b,f)|0;if(p>>>0<f>>>0){j=p;break a}l=f;m=b+f|0;n=d-f|0;o=c[g>>2]|0}while(0);Rh(o|0,m|0,n|0)|0;c[g>>2]=(c[g>>2]|0)+n;j=l+n|0}while(0);return j|0}function vf(a,b){a=a|0;b=b|0;var d=0;if(!b)d=0;else d=wf(c[b>>2]|0,c[b+4>>2]|0,a)|0;return ((d|0)==0?a:d)|0}function wf(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0;f=(c[b>>2]|0)+1794895138|0;g=xf(c[b+8>>2]|0,f)|0;h=xf(c[b+12>>2]|0,f)|0;i=xf(c[b+16>>2]|0,f)|0;a:do if((g>>>0<d>>>2>>>0?(j=d-(g<<2)|0,h>>>0<j>>>0&i>>>0<j>>>0):0)?((i|h)&3|0)==0:0){j=h>>>2;k=i>>>2;l=0;m=g;while(1){n=m>>>1;o=l+n|0;p=o<<1;q=p+j|0;r=xf(c[b+(q<<2)>>2]|0,f)|0;s=xf(c[b+(q+1<<2)>>2]|0,f)|0;if(!(s>>>0<d>>>0&r>>>0<(d-s|0)>>>0)){t=0;break a}if(a[b+(s+r)>>0]|0){t=0;break a}r=mf(e,b+s|0)|0;if(!r)break;s=(r|0)<0;if((m|0)==1){t=0;break a}l=s?l:o;m=s?n:m-n|0}m=p+k|0;l=xf(c[b+(m<<2)>>2]|0,f)|0;j=xf(c[b+(m+1<<2)>>2]|0,f)|0;if(j>>>0<d>>>0&l>>>0<(d-j|0)>>>0)t=(a[b+(j+l)>>0]|0)==0?b+j|0:0;else t=0}else t=0;while(0);return t|0}function xf(a,b){a=a|0;b=b|0;var c=0;c=Qh(a|0)|0;return ((b|0)==0?a:c)|0}function yf(){ka(14072);return 14080}function zf(){ua(14072);return}function Af(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0;do if(a){if((c[a+76>>2]|0)<=-1){b=Bf(a)|0;break}d=(rf(a)|0)==0;e=Bf(a)|0;if(d)b=e;else{qf(a);b=e}}else{if(!(c[1207]|0))f=0;else f=Af(c[1207]|0)|0;e=c[(yf()|0)>>2]|0;if(!e)g=f;else{d=e;e=f;while(1){if((c[d+76>>2]|0)>-1)h=rf(d)|0;else h=0;if((c[d+20>>2]|0)>>>0>(c[d+28>>2]|0)>>>0)i=Bf(d)|0|e;else i=e;if(h|0)qf(d);d=c[d+56>>2]|0;if(!d){g=i;break}else e=i}}zf();b=g}while(0);return b|0}function Bf(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0;b=a+20|0;d=a+28|0;if((c[b>>2]|0)>>>0>(c[d>>2]|0)>>>0?(Oa[c[a+36>>2]&15](a,0,0)|0,(c[b>>2]|0)==0):0)e=-1;else{f=a+4|0;g=c[f>>2]|0;h=a+8|0;i=c[h>>2]|0;if(g>>>0<i>>>0)Oa[c[a+40>>2]&15](a,g-i|0,1)|0;c[a+16>>2]=0;c[d>>2]=0;c[b>>2]=0;c[h>>2]=0;c[f>>2]=0;e=0}return e|0}function Cf(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,w=0,x=0,y=0;f=d&255;g=(e|0)!=0;a:do if(g&(b&3|0)!=0){h=d&255;i=b;j=e;while(1){if((a[i>>0]|0)==h<<24>>24){k=i;l=j;m=6;break a}n=i+1|0;o=j+-1|0;p=(o|0)!=0;if(p&(n&3|0)!=0){i=n;j=o}else{q=n;r=o;s=p;m=5;break}}}else{q=b;r=e;s=g;m=5}while(0);if((m|0)==5)if(s){k=q;l=r;m=6}else m=16;b:do if((m|0)==6){r=d&255;if((a[k>>0]|0)==r<<24>>24)if(!l){m=16;break}else{t=k;break}q=v(f,16843009)|0;c:do if(l>>>0>3){s=k;g=l;while(1){e=c[s>>2]^q;if((e&-2139062144^-2139062144)&e+-16843009|0){u=g;w=s;break c}e=s+4|0;b=g+-4|0;if(b>>>0>3){s=e;g=b}else{x=e;y=b;m=11;break}}}else{x=k;y=l;m=11}while(0);if((m|0)==11)if(!y){m=16;break}else{u=y;w=x}q=w;g=u;while(1){if((a[q>>0]|0)==r<<24>>24){t=q;break b}g=g+-1|0;if(!g){m=16;break}else q=q+1|0}}while(0);if((m|0)==16)t=0;return t|0}function Df(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0;f=Ja;Ja=Ja+224|0;if((Ja|0)>=(Ka|0))A(224);g=f+208|0;h=f+160|0;i=f+80|0;j=f;k=h;l=k+40|0;do{c[k>>2]=0;k=k+4|0}while((k|0)<(l|0));c[g>>2]=c[e>>2];if((Ef(0,d,g,i,h)|0)<0)m=-1;else{if((c[b+76>>2]|0)>-1)n=rf(b)|0;else n=0;e=c[b>>2]|0;k=e&32;if((a[b+74>>0]|0)<1)c[b>>2]=e&-33;e=b+48|0;if(!(c[e>>2]|0)){l=b+44|0;o=c[l>>2]|0;c[l>>2]=j;p=b+28|0;c[p>>2]=j;q=b+20|0;c[q>>2]=j;c[e>>2]=80;r=b+16|0;c[r>>2]=j+80;j=Ef(b,d,g,i,h)|0;if(!o)s=j;else{Oa[c[b+36>>2]&15](b,0,0)|0;t=(c[q>>2]|0)==0?-1:j;c[l>>2]=o;c[e>>2]=0;c[r>>2]=0;c[p>>2]=0;c[q>>2]=0;s=t}}else s=Ef(b,d,g,i,h)|0;h=c[b>>2]|0;c[b>>2]=h|k;if(n|0)qf(b);m=(h&32|0)==0?s:-1}Ja=f;return m|0}
function Ef(d,e,f,h,i){d=d|0;e=e|0;f=f|0;h=h|0;i=i|0;var j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ba=0,ca=0,da=0,ea=0,fa=0,ga=0,ha=0,ia=0,ja=0,ka=0,la=0,ma=0,na=0,oa=0,pa=0,qa=0,ra=0,sa=0,ta=0,ua=0,va=0,wa=0,xa=0,ya=0,za=0,Aa=0,Ba=0,Ca=0,Da=0;j=Ja;Ja=Ja+64|0;if((Ja|0)>=(Ka|0))A(64);k=j+56|0;l=j+40|0;m=j;n=j+48|0;o=j+60|0;c[k>>2]=e;e=(d|0)!=0;p=m+40|0;q=p;r=m+39|0;m=n+4|0;s=0;t=0;u=0;a:while(1){v=s;w=t;while(1){do if((w|0)>-1)if((v|0)>(2147483647-w|0)){c[(gf()|0)>>2]=75;x=-1;break}else{x=v+w|0;break}else x=w;while(0);y=c[k>>2]|0;B=a[y>>0]|0;if(!(B<<24>>24)){C=94;break a}D=B;B=y;b:while(1){switch(D<<24>>24){case 37:{C=10;break b;break}case 0:{E=B;break b;break}default:{}}F=B+1|0;c[k>>2]=F;D=a[F>>0]|0;B=F}c:do if((C|0)==10){C=0;D=B;F=B;while(1){if((a[F+1>>0]|0)!=37){E=D;break c}G=D+1|0;F=F+2|0;c[k>>2]=F;if((a[F>>0]|0)!=37){E=G;break}else D=G}}while(0);v=E-y|0;if(e)Ff(d,y,v);if(!v)break;else w=x}w=(kf(a[(c[k>>2]|0)+1>>0]|0)|0)==0;v=c[k>>2]|0;if(!w?(a[v+2>>0]|0)==36:0){H=(a[v+1>>0]|0)+-48|0;I=1;J=3}else{H=-1;I=u;J=1}w=v+J|0;c[k>>2]=w;v=a[w>>0]|0;B=(v<<24>>24)+-32|0;if(B>>>0>31|(1<<B&75913|0)==0){K=0;L=v;M=w}else{v=0;D=B;B=w;while(1){w=1<<D|v;F=B+1|0;c[k>>2]=F;G=a[F>>0]|0;D=(G<<24>>24)+-32|0;if(D>>>0>31|(1<<D&75913|0)==0){K=w;L=G;M=F;break}else{v=w;B=F}}}if(L<<24>>24==42){if((kf(a[M+1>>0]|0)|0)!=0?(B=c[k>>2]|0,(a[B+2>>0]|0)==36):0){v=B+1|0;c[i+((a[v>>0]|0)+-48<<2)>>2]=10;N=c[h+((a[v>>0]|0)+-48<<3)>>2]|0;O=1;P=B+3|0}else{if(I|0){Q=-1;break}if(e){B=(c[f>>2]|0)+(4-1)&~(4-1);v=c[B>>2]|0;c[f>>2]=B+4;R=v}else R=0;N=R;O=0;P=(c[k>>2]|0)+1|0}c[k>>2]=P;v=(N|0)<0;S=v?0-N|0:N;T=v?K|8192:K;U=O;V=P}else{v=Gf(k)|0;if((v|0)<0){Q=-1;break}S=v;T=K;U=I;V=c[k>>2]|0}do if((a[V>>0]|0)==46){v=V+1|0;if((a[v>>0]|0)!=42){c[k>>2]=v;v=Gf(k)|0;W=v;X=c[k>>2]|0;break}if(kf(a[V+2>>0]|0)|0?(v=c[k>>2]|0,(a[v+3>>0]|0)==36):0){B=v+2|0;c[i+((a[B>>0]|0)+-48<<2)>>2]=10;D=c[h+((a[B>>0]|0)+-48<<3)>>2]|0;B=v+4|0;c[k>>2]=B;W=D;X=B;break}if(U|0){Q=-1;break a}if(e){B=(c[f>>2]|0)+(4-1)&~(4-1);D=c[B>>2]|0;c[f>>2]=B+4;Y=D}else Y=0;D=(c[k>>2]|0)+2|0;c[k>>2]=D;W=Y;X=D}else{W=-1;X=V}while(0);D=0;B=X;while(1){if(((a[B>>0]|0)+-65|0)>>>0>57){Q=-1;break a}v=B;B=B+1|0;c[k>>2]=B;Z=a[(a[v>>0]|0)+-65+(16+(D*58|0))>>0]|0;_=Z&255;if((_+-1|0)>>>0>=8)break;else D=_}if(!(Z<<24>>24)){Q=-1;break}v=(H|0)>-1;do if(Z<<24>>24==19)if(v){Q=-1;break a}else C=54;else{if(v){c[i+(H<<2)>>2]=_;F=h+(H<<3)|0;w=c[F+4>>2]|0;G=l;c[G>>2]=c[F>>2];c[G+4>>2]=w;C=54;break}if(!e){Q=0;break a}Hf(l,_,f);$=c[k>>2]|0;C=55}while(0);if((C|0)==54){C=0;if(e){$=B;C=55}else aa=0}d:do if((C|0)==55){C=0;v=a[$+-1>>0]|0;w=(D|0)!=0&(v&15|0)==3?v&-33:v;v=T&-65537;G=(T&8192|0)==0?T:v;e:do switch(w|0){case 110:{switch((D&255)<<24>>24){case 0:{c[c[l>>2]>>2]=x;aa=0;break d;break}case 1:{c[c[l>>2]>>2]=x;aa=0;break d;break}case 2:{F=c[l>>2]|0;c[F>>2]=x;c[F+4>>2]=((x|0)<0)<<31>>31;aa=0;break d;break}case 3:{b[c[l>>2]>>1]=x;aa=0;break d;break}case 4:{a[c[l>>2]>>0]=x;aa=0;break d;break}case 6:{c[c[l>>2]>>2]=x;aa=0;break d;break}case 7:{F=c[l>>2]|0;c[F>>2]=x;c[F+4>>2]=((x|0)<0)<<31>>31;aa=0;break d;break}default:{aa=0;break d}}break}case 112:{ba=120;ca=W>>>0>8?W:8;da=G|8;C=67;break}case 88:case 120:{ba=w;ca=W;da=G;C=67;break}case 111:{F=l;ea=c[F>>2]|0;fa=c[F+4>>2]|0;F=Jf(ea,fa,p)|0;ga=q-F|0;ha=F;ia=0;ja=9324;ka=(G&8|0)==0|(W|0)>(ga|0)?W:ga+1|0;la=G;ma=ea;na=fa;C=73;break}case 105:case 100:{fa=l;ea=c[fa>>2]|0;ga=c[fa+4>>2]|0;if((ga|0)<0){fa=Kh(0,0,ea|0,ga|0)|0;F=z()|0;oa=l;c[oa>>2]=fa;c[oa+4>>2]=F;pa=1;qa=9324;ra=fa;sa=F;C=72;break e}else{pa=(G&2049|0)!=0&1;qa=(G&2048|0)==0?((G&1|0)==0?9324:9326):9325;ra=ea;sa=ga;C=72;break e}break}case 117:{ga=l;pa=0;qa=9324;ra=c[ga>>2]|0;sa=c[ga+4>>2]|0;C=72;break}case 99:{a[r>>0]=c[l>>2];ta=r;ua=0;va=9324;wa=1;xa=v;ya=q;break}case 109:{za=Lf(c[(gf()|0)>>2]|0)|0;C=77;break}case 115:{ga=c[l>>2]|0;za=(ga|0)==0?9334:ga;C=77;break}case 67:{c[n>>2]=c[l>>2];c[m>>2]=0;c[l>>2]=n;Aa=-1;C=81;break}case 83:{if(!W){Mf(d,32,S,0,G);Ba=0;C=91}else{Aa=W;C=81}break}case 65:case 71:case 70:case 69:case 97:case 103:case 102:case 101:{aa=Of(d,+g[l>>3],S,W,G,w)|0;break d;break}default:{ta=y;ua=0;va=9324;wa=W;xa=G;ya=q}}while(0);f:do if((C|0)==67){C=0;w=l;ga=c[w>>2]|0;ea=c[w+4>>2]|0;w=If(ga,ea,p,ba&32)|0;F=(da&8|0)==0|(ga|0)==0&(ea|0)==0;ha=w;ia=F?0:2;ja=F?9324:9324+(ba>>>4)|0;ka=ca;la=da;ma=ga;na=ea;C=73}else if((C|0)==72){C=0;ha=Kf(ra,sa,p)|0;ia=pa;ja=qa;ka=W;la=G;ma=ra;na=sa;C=73}else if((C|0)==77){C=0;ea=Cf(za,0,W)|0;ga=(ea|0)==0;ta=za;ua=0;va=9324;wa=ga?W:ea-za|0;xa=v;ya=ga?za+W|0:ea}else if((C|0)==81){C=0;ea=c[l>>2]|0;ga=0;while(1){F=c[ea>>2]|0;if(!F){Ca=ga;break}w=Nf(o,F)|0;Da=(w|0)<0;if(Da|w>>>0>(Aa-ga|0)>>>0){C=85;break}F=w+ga|0;if(Aa>>>0>F>>>0){ea=ea+4|0;ga=F}else{Ca=F;break}}if((C|0)==85){C=0;if(Da){Q=-1;break a}else Ca=ga}Mf(d,32,S,Ca,G);if(!Ca){Ba=0;C=91}else{ea=c[l>>2]|0;F=0;while(1){w=c[ea>>2]|0;if(!w){Ba=Ca;C=91;break f}fa=Nf(o,w)|0;F=fa+F|0;if((F|0)>(Ca|0)){Ba=Ca;C=91;break f}Ff(d,o,fa);if(F>>>0>=Ca>>>0){Ba=Ca;C=91;break}else ea=ea+4|0}}}while(0);if((C|0)==73){C=0;v=(ma|0)!=0|(na|0)!=0;ea=(ka|0)!=0|v;F=q-ha+((v^1)&1)|0;ta=ea?ha:p;ua=ia;va=ja;wa=ea?((ka|0)>(F|0)?ka:F):0;xa=(ka|0)>-1?la&-65537:la;ya=q}else if((C|0)==91){C=0;Mf(d,32,S,Ba,G^8192);aa=(S|0)>(Ba|0)?S:Ba;break}F=ya-ta|0;ea=(wa|0)<(F|0)?F:wa;v=ea+ua|0;ga=(S|0)<(v|0)?v:S;Mf(d,32,ga,v,xa);Ff(d,va,ua);Mf(d,48,ga,v,xa^65536);Mf(d,48,ea,F,0);Ff(d,ta,F);Mf(d,32,ga,v,xa^8192);aa=ga}while(0);s=aa;t=x;u=U}g:do if((C|0)==94)if(!d)if(!u)Q=0;else{U=1;while(1){t=c[i+(U<<2)>>2]|0;if(!t)break;Hf(h+(U<<3)|0,t,f);t=U+1|0;if(t>>>0<10)U=t;else{Q=1;break g}}t=U;while(1){if(c[i+(t<<2)>>2]|0){Q=-1;break g}t=t+1|0;if(t>>>0>=10){Q=1;break}}}else Q=x;while(0);Ja=j;return Q|0}function Ff(a,b,d){a=a|0;b=b|0;d=d|0;if(!(c[a>>2]&32))uf(b,d,a)|0;return}function Gf(b){b=b|0;var d=0,e=0,f=0,g=0,h=0;if(!(kf(a[c[b>>2]>>0]|0)|0))d=0;else{e=0;while(1){f=c[b>>2]|0;g=(e*10|0)+-48+(a[f>>0]|0)|0;h=f+1|0;c[b>>2]=h;if(!(kf(a[h>>0]|0)|0)){d=g;break}else e=g}}return d|0}function Hf(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,h=0,i=0,j=0.0;a:do if(b>>>0<=20)do switch(b|0){case 9:{e=(c[d>>2]|0)+(4-1)&~(4-1);f=c[e>>2]|0;c[d>>2]=e+4;c[a>>2]=f;break a;break}case 10:{f=(c[d>>2]|0)+(4-1)&~(4-1);e=c[f>>2]|0;c[d>>2]=f+4;f=a;c[f>>2]=e;c[f+4>>2]=((e|0)<0)<<31>>31;break a;break}case 11:{e=(c[d>>2]|0)+(4-1)&~(4-1);f=c[e>>2]|0;c[d>>2]=e+4;e=a;c[e>>2]=f;c[e+4>>2]=0;break a;break}case 12:{e=(c[d>>2]|0)+(8-1)&~(8-1);f=e;h=c[f>>2]|0;i=c[f+4>>2]|0;c[d>>2]=e+8;e=a;c[e>>2]=h;c[e+4>>2]=i;break a;break}case 13:{i=(c[d>>2]|0)+(4-1)&~(4-1);e=c[i>>2]|0;c[d>>2]=i+4;i=(e&65535)<<16>>16;e=a;c[e>>2]=i;c[e+4>>2]=((i|0)<0)<<31>>31;break a;break}case 14:{i=(c[d>>2]|0)+(4-1)&~(4-1);e=c[i>>2]|0;c[d>>2]=i+4;i=a;c[i>>2]=e&65535;c[i+4>>2]=0;break a;break}case 15:{i=(c[d>>2]|0)+(4-1)&~(4-1);e=c[i>>2]|0;c[d>>2]=i+4;i=(e&255)<<24>>24;e=a;c[e>>2]=i;c[e+4>>2]=((i|0)<0)<<31>>31;break a;break}case 16:{i=(c[d>>2]|0)+(4-1)&~(4-1);e=c[i>>2]|0;c[d>>2]=i+4;i=a;c[i>>2]=e&255;c[i+4>>2]=0;break a;break}case 17:{i=(c[d>>2]|0)+(8-1)&~(8-1);j=+g[i>>3];c[d>>2]=i+8;g[a>>3]=j;break a;break}case 18:{i=(c[d>>2]|0)+(8-1)&~(8-1);j=+g[i>>3];c[d>>2]=i+8;g[a>>3]=j;break a;break}default:break a}while(0);while(0);return}function If(b,c,e,f){b=b|0;c=c|0;e=e|0;f=f|0;var g=0,h=0;if((b|0)==0&(c|0)==0)g=e;else{h=e;e=c;c=b;while(1){b=h+-1|0;a[b>>0]=d[480+(c&15)>>0]|0|f;c=Oh(c|0,e|0,4)|0;e=z()|0;if((c|0)==0&(e|0)==0){g=b;break}else h=b}}return g|0}function Jf(b,c,d){b=b|0;c=c|0;d=d|0;var e=0,f=0;if((b|0)==0&(c|0)==0)e=d;else{f=d;d=c;c=b;while(1){b=f+-1|0;a[b>>0]=c&7|48;c=Oh(c|0,d|0,3)|0;d=z()|0;if((c|0)==0&(d|0)==0){e=b;break}else f=b}}return e|0}function Kf(b,c,d){b=b|0;c=c|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;if(c>>>0>0|(c|0)==0&b>>>0>4294967295){e=d;f=b;g=c;do{c=f;f=Nh(f|0,g|0,10,0)|0;h=g;g=z()|0;i=Ih(f|0,g|0,10,0)|0;j=Kh(c|0,h|0,i|0,z()|0)|0;z()|0;e=e+-1|0;a[e>>0]=j&255|48}while(h>>>0>9|(h|0)==9&c>>>0>4294967295);k=f;l=e}else{k=b;l=d}if(!k)m=l;else{d=k;k=l;while(1){l=d;d=(d>>>0)/10|0;b=k+-1|0;a[b>>0]=l-(d*10|0)|48;if(l>>>0<10){m=b;break}else k=b}}return m|0}function Lf(a){a=a|0;return Vf(a,c[(Uf()|0)+188>>2]|0)|0}function Mf(a,b,c,d,e){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;var f=0,g=0,h=0;f=Ja;Ja=Ja+256|0;if((Ja|0)>=(Ka|0))A(256);g=f;if((c|0)>(d|0)&(e&73728|0)==0){e=c-d|0;Th(g|0,b<<24>>24|0,(e>>>0<256?e:256)|0)|0;if(e>>>0>255){b=c-d|0;d=e;do{Ff(a,g,256);d=d+-256|0}while(d>>>0>255);h=b&255}else h=e;Ff(a,g,h)}Ja=f;return}function Nf(a,b){a=a|0;b=b|0;var c=0;if(!a)c=0;else c=Sf(a,b,0)|0;return c|0}function Of(b,e,f,g,h,i){b=b|0;e=+e;f=f|0;g=g|0;h=h|0;i=i|0;var j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0.0,t=0,u=0.0,w=0,x=0,y=0,B=0,C=0,D=0,E=0,F=0,G=0.0,H=0,I=0,J=0,K=0.0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0.0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ba=0,ca=0,da=0,ea=0,fa=0,ga=0,ha=0,ia=0.0,ja=0.0,ka=0,la=0,ma=0,na=0,oa=0,pa=0,qa=0,ra=0,sa=0,ta=0,ua=0,va=0,wa=0,xa=0,ya=0,za=0,Aa=0,Ba=0,Ca=0,Da=0,Ea=0,Fa=0,Ga=0,Ha=0,Ia=0;j=Ja;Ja=Ja+560|0;if((Ja|0)>=(Ka|0))A(560);k=j+32|0;l=j+536|0;m=j;n=m;o=j+540|0;c[l>>2]=0;p=o+12|0;q=Pf(e)|0;r=z()|0;if((r|0)<0){s=-e;t=Pf(s)|0;u=s;w=1;x=9341;y=z()|0;B=t}else{u=e;w=(h&2049|0)!=0&1;x=(h&2048|0)==0?((h&1|0)==0?9342:9347):9344;y=r;B=q}do if(0==0&(y&2146435072|0)==2146435072){q=(i&32|0)!=0;B=w+3|0;Mf(b,32,f,B,h&-65537);Ff(b,x,w);Ff(b,u!=u|0.0!=0.0?(q?9368:9372):q?9360:9364,3);Mf(b,32,f,B,h^8192);C=B}else{e=+Qf(u,l)*2.0;B=e!=0.0;if(B)c[l>>2]=(c[l>>2]|0)+-1;q=i|32;if((q|0)==97){r=i&32;t=(r|0)==0?x:x+9|0;D=w|2;E=12-g|0;do if(!(g>>>0>11|(E|0)==0)){s=8.0;F=E;do{F=F+-1|0;s=s*16.0}while((F|0)!=0);if((a[t>>0]|0)==45){G=-(s+(-e-s));break}else{G=e+s-s;break}}else G=e;while(0);E=c[l>>2]|0;F=(E|0)<0?0-E|0:E;H=Kf(F,((F|0)<0)<<31>>31,p)|0;if((H|0)==(p|0)){F=o+11|0;a[F>>0]=48;I=F}else I=H;a[I+-1>>0]=(E>>31&2)+43;E=I+-2|0;a[E>>0]=i+15;H=(g|0)<1;F=(h&8|0)==0;J=m;K=G;while(1){L=~~K;M=J+1|0;a[J>>0]=r|d[480+L>>0];K=(K-+(L|0))*16.0;if((M-n|0)==1?!(F&(H&K==0.0)):0){a[M>>0]=46;N=J+2|0}else N=M;if(!(K!=0.0))break;else J=N}J=N;if((g|0)!=0?(-2-n+J|0)<(g|0):0){H=p;F=E;O=g+2+H-F|0;P=H;Q=F}else{F=p;H=E;O=F-n-H+J|0;P=F;Q=H}H=O+D|0;Mf(b,32,f,H,h);Ff(b,t,D);Mf(b,48,f,H,h^65536);F=J-n|0;Ff(b,m,F);J=P-Q|0;Mf(b,48,O-(F+J)|0,0,0);Ff(b,E,J);Mf(b,32,f,H,h^8192);C=H;break}H=(g|0)<0?6:g;if(B){J=(c[l>>2]|0)+-28|0;c[l>>2]=J;R=e*268435456.0;S=J}else{R=e;S=c[l>>2]|0}J=(S|0)<0?k:k+288|0;F=J;K=R;do{r=~~K>>>0;c[F>>2]=r;F=F+4|0;K=(K-+(r>>>0))*1.0e9}while(K!=0.0);B=J;if((S|0)>0){E=J;D=F;t=S;while(1){r=(t|0)<29?t:29;M=D+-4|0;if(M>>>0>=E>>>0){L=M;M=0;do{T=Ph(c[L>>2]|0,0,r|0)|0;U=Jh(T|0,z()|0,M|0,0)|0;T=z()|0;M=Nh(U|0,T|0,1e9,0)|0;V=Ih(M|0,z()|0,1e9,0)|0;W=Kh(U|0,T|0,V|0,z()|0)|0;z()|0;c[L>>2]=W;L=L+-4|0}while(L>>>0>=E>>>0);if(M){L=E+-4|0;c[L>>2]=M;X=L}else X=E}else X=E;a:do if(D>>>0>X>>>0){L=D;while(1){W=L+-4|0;if(c[W>>2]|0){Y=L;break a}if(W>>>0>X>>>0)L=W;else{Y=W;break}}}else Y=D;while(0);M=(c[l>>2]|0)-r|0;c[l>>2]=M;if((M|0)>0){E=X;D=Y;t=M}else{Z=X;_=Y;$=M;break}}}else{Z=J;_=F;$=S}if(($|0)<0){t=((H+25|0)/9|0)+1|0;D=(q|0)==102;E=Z;M=_;L=$;while(1){W=0-L|0;V=(W|0)<9?W:9;if(E>>>0<M>>>0){W=(1<<V)+-1|0;T=1e9>>>V;U=0;aa=E;do{ba=c[aa>>2]|0;c[aa>>2]=(ba>>>V)+U;U=v(ba&W,T)|0;aa=aa+4|0}while(aa>>>0<M>>>0);aa=(c[E>>2]|0)==0?E+4|0:E;if(!U){ca=M;da=aa}else{c[M>>2]=U;ca=M+4|0;da=aa}}else{ca=M;da=(c[E>>2]|0)==0?E+4|0:E}aa=D?J:da;T=(ca-aa>>2|0)>(t|0)?aa+(t<<2)|0:ca;L=(c[l>>2]|0)+V|0;c[l>>2]=L;if((L|0)>=0){ea=da;fa=T;break}else{E=da;M=T}}}else{ea=Z;fa=_}if(ea>>>0<fa>>>0){M=(B-ea>>2)*9|0;E=c[ea>>2]|0;if(E>>>0<10)ga=M;else{L=M;M=10;while(1){M=M*10|0;t=L+1|0;if(E>>>0<M>>>0){ga=t;break}else L=t}}}else ga=0;L=(q|0)==103;M=(H|0)!=0;E=H-((q|0)==102?0:ga)+((M&L)<<31>>31)|0;if((E|0)<(((fa-B>>2)*9|0)+-9|0)){t=E+9216|0;E=(t|0)/9|0;D=J+4+(E+-1024<<2)|0;F=t-(E*9|0)|0;if((F|0)<8){E=F;F=10;while(1){t=F*10|0;if((E|0)<7){E=E+1|0;F=t}else{ha=t;break}}}else ha=10;F=c[D>>2]|0;E=(F>>>0)/(ha>>>0)|0;q=F-(v(E,ha)|0)|0;t=(D+4|0)==(fa|0);if(!(t&(q|0)==0)){s=(E&1|0)==0?9007199254740992.0:9007199254740994.0;E=ha>>>1;K=q>>>0<E>>>0?.5:t&(q|0)==(E|0)?1.0:1.5;if(!w){ia=K;ja=s}else{E=(a[x>>0]|0)==45;ia=E?-K:K;ja=E?-s:s}E=F-q|0;c[D>>2]=E;if(ja+ia!=ja){q=E+ha|0;c[D>>2]=q;if(q>>>0>999999999){q=D;E=ea;while(1){F=q+-4|0;c[q>>2]=0;if(F>>>0<E>>>0){t=E+-4|0;c[t>>2]=0;ka=t}else ka=E;t=(c[F>>2]|0)+1|0;c[F>>2]=t;if(t>>>0>999999999){q=F;E=ka}else{la=F;ma=ka;break}}}else{la=D;ma=ea}E=(B-ma>>2)*9|0;q=c[ma>>2]|0;if(q>>>0<10){na=la;oa=E;pa=ma}else{F=E;E=10;while(1){E=E*10|0;t=F+1|0;if(q>>>0<E>>>0){na=la;oa=t;pa=ma;break}else F=t}}}else{na=D;oa=ga;pa=ea}}else{na=D;oa=ga;pa=ea}F=na+4|0;qa=oa;ra=fa>>>0>F>>>0?F:fa;sa=pa}else{qa=ga;ra=fa;sa=ea}F=0-qa|0;b:do if(ra>>>0>sa>>>0){E=ra;while(1){q=E+-4|0;if(c[q>>2]|0){ta=E;ua=1;break b}if(q>>>0>sa>>>0)E=q;else{ta=q;ua=0;break}}}else{ta=ra;ua=0}while(0);do if(L){D=H+((M^1)&1)|0;if((D|0)>(qa|0)&(qa|0)>-5){va=i+-1|0;wa=D+-1-qa|0}else{va=i+-2|0;wa=D+-1|0}if(!(h&8)){if(ua?(D=c[ta+-4>>2]|0,(D|0)!=0):0)if(!((D>>>0)%10|0)){E=0;V=10;while(1){V=V*10|0;U=E+1|0;if((D>>>0)%(V>>>0)|0|0){xa=U;break}else E=U}}else xa=0;else xa=9;E=((ta-B>>2)*9|0)+-9|0;if((va|32|0)==102){V=E-xa|0;D=(V|0)>0?V:0;ya=va;za=(wa|0)<(D|0)?wa:D;break}else{D=E+qa-xa|0;E=(D|0)>0?D:0;ya=va;za=(wa|0)<(E|0)?wa:E;break}}else{ya=va;za=wa}}else{ya=i;za=H}while(0);H=(za|0)!=0;B=H?1:h>>>3&1;M=(ya|32|0)==102;if(M){Aa=0;Ba=(qa|0)>0?qa:0}else{L=(qa|0)<0?F:qa;E=Kf(L,((L|0)<0)<<31>>31,p)|0;L=p;if((L-E|0)<2){D=E;while(1){V=D+-1|0;a[V>>0]=48;if((L-V|0)<2)D=V;else{Ca=V;break}}}else Ca=E;a[Ca+-1>>0]=(qa>>31&2)+43;D=Ca+-2|0;a[D>>0]=ya;Aa=D;Ba=L-D|0}D=w+1+za+B+Ba|0;Mf(b,32,f,D,h);Ff(b,x,w);Mf(b,48,f,D,h^65536);if(M){F=sa>>>0>J>>>0?J:sa;V=m+9|0;U=V;q=m+8|0;t=F;do{T=Kf(c[t>>2]|0,0,V)|0;if((t|0)==(F|0))if((T|0)==(V|0)){a[q>>0]=48;Da=q}else Da=T;else if(T>>>0>m>>>0){Th(m|0,48,T-n|0)|0;aa=T;while(1){W=aa+-1|0;if(W>>>0>m>>>0)aa=W;else{Da=W;break}}}else Da=T;Ff(b,Da,U-Da|0);t=t+4|0}while(t>>>0<=J>>>0);if(!((h&8|0)==0&(H^1)))Ff(b,9376,1);if(t>>>0<ta>>>0&(za|0)>0){J=za;U=t;while(1){q=Kf(c[U>>2]|0,0,V)|0;if(q>>>0>m>>>0){Th(m|0,48,q-n|0)|0;F=q;while(1){M=F+-1|0;if(M>>>0>m>>>0)F=M;else{Ea=M;break}}}else Ea=q;Ff(b,Ea,(J|0)<9?J:9);U=U+4|0;F=J+-9|0;if(!(U>>>0<ta>>>0&(J|0)>9)){Fa=F;break}else J=F}}else Fa=za;Mf(b,48,Fa+9|0,9,0)}else{J=ua?ta:sa+4|0;if(sa>>>0<J>>>0&(za|0)>-1){U=m+9|0;V=(h&8|0)==0;t=U;H=0-n|0;F=m+8|0;T=za;M=sa;while(1){B=Kf(c[M>>2]|0,0,U)|0;if((B|0)==(U|0)){a[F>>0]=48;Ga=F}else Ga=B;do if((M|0)==(sa|0)){B=Ga+1|0;Ff(b,Ga,1);if(V&(T|0)<1){Ha=B;break}Ff(b,9376,1);Ha=B}else{if(Ga>>>0<=m>>>0){Ha=Ga;break}Th(m|0,48,Ga+H|0)|0;B=Ga;while(1){L=B+-1|0;if(L>>>0>m>>>0)B=L;else{Ha=L;break}}}while(0);q=t-Ha|0;Ff(b,Ha,(T|0)>(q|0)?q:T);B=T-q|0;M=M+4|0;if(!(M>>>0<J>>>0&(B|0)>-1)){Ia=B;break}else T=B}}else Ia=za;Mf(b,48,Ia+18|0,18,0);Ff(b,Aa,p-Aa|0)}Mf(b,32,f,D,h^8192);C=D}while(0);Ja=j;return ((C|0)<(f|0)?f:C)|0}function Pf(a){a=+a;var b=0;g[h>>3]=a;b=c[h>>2]|0;y(c[h+4>>2]|0);return b|0}function Qf(a,b){a=+a;b=b|0;return +(+Rf(a,b))}function Rf(a,b){a=+a;b=b|0;var d=0,e=0,f=0,i=0.0,j=0.0,k=0,l=0.0;g[h>>3]=a;d=c[h>>2]|0;e=c[h+4>>2]|0;f=Oh(d|0,e|0,52)|0;z()|0;switch(f&2047){case 0:{if(a!=0.0){i=+Rf(a*18446744073709551616.0,b);j=i;k=(c[b>>2]|0)+-64|0}else{j=a;k=0}c[b>>2]=k;l=j;break}case 2047:{l=a;break}default:{c[b>>2]=(f&2047)+-1022;c[h>>2]=d;c[h+4>>2]=e&-2146435073|1071644672;l=+g[h>>3]}}return +l}function Sf(b,d,e){b=b|0;d=d|0;e=e|0;var f=0;do if(b){if(d>>>0<128){a[b>>0]=d;f=1;break}if(!(c[c[(Tf()|0)+188>>2]>>2]|0))if((d&-128|0)==57216){a[b>>0]=d;f=1;break}else{c[(gf()|0)>>2]=84;f=-1;break}if(d>>>0<2048){a[b>>0]=d>>>6|192;a[b+1>>0]=d&63|128;f=2;break}if(d>>>0<55296|(d&-8192|0)==57344){a[b>>0]=d>>>12|224;a[b+1>>0]=d>>>6&63|128;a[b+2>>0]=d&63|128;f=3;break}if((d+-65536|0)>>>0<1048576){a[b>>0]=d>>>18|240;a[b+1>>0]=d>>>12&63|128;a[b+2>>0]=d>>>6&63|128;a[b+3>>0]=d&63|128;f=4;break}else{c[(gf()|0)>>2]=84;f=-1;break}}else f=1;while(0);return f|0}function Tf(){return lf()|0}function Uf(){return lf()|0}function Vf(b,e){b=b|0;e=e|0;var f=0,g=0,h=0,i=0,j=0;f=0;while(1){if((d[496+f>>0]|0)==(b|0)){g=4;break}h=f+1|0;if((h|0)==87){i=87;g=5;break}else f=h}if((g|0)==4)if(!f)j=592;else{i=f;g=5}if((g|0)==5){g=592;f=i;while(1){i=g;do{b=i;i=i+1|0}while((a[b>>0]|0)!=0);f=f+-1|0;if(!f){j=i;break}else g=i}}return Wf(j,c[e+20>>2]|0)|0}function Wf(a,b){a=a|0;b=b|0;return vf(a,b)|0}function Xf(b,c,d){b=b|0;c=c|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0;a:do if(!d)e=0;else{f=b;g=d;h=c;while(1){i=a[f>>0]|0;j=a[h>>0]|0;if(i<<24>>24!=j<<24>>24)break;g=g+-1|0;if(!g){e=0;break a}else{f=f+1|0;h=h+1|0}}e=(i&255)-(j&255)|0}while(0);return e|0}function Yf(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0;e=Ja;Ja=Ja+48|0;if((Ja|0)>=(Ka|0))A(48);f=e+32|0;g=e+16|0;h=e;if(!(b&4194368))i=0;else{c[h>>2]=d;d=(c[h>>2]|0)+(4-1)&~(4-1);j=c[d>>2]|0;c[h>>2]=d+4;i=j}c[g>>2]=a;c[g+4>>2]=b|32768;c[g+8>>2]=i;i=ra(5,g|0)|0;if(!((b&524288|0)==0|(i|0)<0)){c[f>>2]=i;c[f+4>>2]=2;c[f+8>>2]=1;pa(221,f|0)|0}f=ff(i)|0;Ja=e;return f|0}function Zf(b,d,e,f){b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0;g=Ja;Ja=Ja+128|0;if((Ja|0)>=(Ka|0))A(128);h=g+124|0;i=g;j=i;k=5076;l=j+124|0;do{c[j>>2]=c[k>>2];j=j+4|0;k=k+4|0}while((j|0)<(l|0));if((d+-1|0)>>>0>2147483646)if(!d){m=h;n=1;o=4}else{c[(gf()|0)>>2]=75;p=-1}else{m=b;n=d;o=4}if((o|0)==4){o=-2-m|0;d=n>>>0>o>>>0?o:n;c[i+48>>2]=d;n=i+20|0;c[n>>2]=m;c[i+44>>2]=m;o=m+d|0;m=i+16|0;c[m>>2]=o;c[i+28>>2]=o;o=Df(i,e,f)|0;if(!d)p=o;else{d=c[n>>2]|0;a[d+(((d|0)==(c[m>>2]|0))<<31>>31)>>0]=0;p=o}}Ja=g;return p|0}function _f(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0;e=a+20|0;f=c[e>>2]|0;g=(c[a+16>>2]|0)-f|0;a=g>>>0>d>>>0?d:g;Rh(f|0,b|0,a|0)|0;c[e>>2]=(c[e>>2]|0)+a;return d|0}function $f(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0;e=Ja;Ja=Ja+16|0;if((Ja|0)>=(Ka|0))A(16);f=e;c[f>>2]=a;c[f+4>>2]=b;c[f+8>>2]=d;d=ff(qa(3,f|0)|0)|0;Ja=e;return d|0}function ag(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0;e=Ja;Ja=Ja+16|0;if((Ja|0)>=(Ka|0))A(16);f=e;c[f>>2]=d;d=bg(a,b,f)|0;Ja=e;return d|0}function bg(a,b,c){a=a|0;b=b|0;c=c|0;return Zf(a,2147483647,b,c)|0}function cg(a,b){a=a|0;b=b|0;var d=0,e=0;d=Ja;Ja=Ja+16|0;if((Ja|0)>=(Ka|0))A(16);e=d;c[e>>2]=b;b=Df(c[1175]|0,a,e)|0;Ja=d;return b|0}function dg(b,d){b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0;if((c[d+76>>2]|0)>=0?(rf(d)|0)!=0:0){e=b&255;f=b&255;if((f|0)!=(a[d+75>>0]|0)?(g=d+20|0,h=c[g>>2]|0,h>>>0<(c[d+16>>2]|0)>>>0):0){c[g>>2]=h+1;a[h>>0]=e;i=f}else i=sf(d,b)|0;qf(d);j=i}else k=3;do if((k|0)==3){i=b&255;f=b&255;if((f|0)!=(a[d+75>>0]|0)?(e=d+20|0,h=c[e>>2]|0,h>>>0<(c[d+16>>2]|0)>>>0):0){c[e>>2]=h+1;a[h>>0]=i;j=f;break}j=sf(d,b)|0}while(0);return j|0}function eg(b){b=b|0;var d=0,e=0,f=0,g=0,h=0;d=c[1175]|0;if((c[d+76>>2]|0)>-1)e=rf(d)|0;else e=0;do if((of(b,d)|0)<0)f=-1;else{if((a[d+75>>0]|0)!=10?(g=d+20|0,h=c[g>>2]|0,h>>>0<(c[d+16>>2]|0)>>>0):0){c[g>>2]=h+1;a[h>>0]=10;f=0;break}f=(sf(d,10)|0)>>31}while(0);if(e|0)qf(d);return f|0}function fg(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ba=0,ca=0,da=0,ea=0,fa=0,ga=0,ha=0,ia=0,ja=0,ka=0,la=0,ma=0,na=0,oa=0,pa=0,qa=0,ra=0,sa=0,ta=0,ua=0,va=0,wa=0,xa=0,ya=0,za=0,Aa=0,Ba=0,Ca=0,Da=0,Ea=0,Fa=0,Ga=0,Ha=0,Ia=0,La=0;b=Ja;Ja=Ja+16|0;if((Ja|0)>=(Ka|0))A(16);d=b;do if(a>>>0<245){e=a>>>0<11?16:a+11&-8;f=e>>>3;g=c[3521]|0;h=g>>>f;if(h&3|0){i=(h&1^1)+f|0;j=14124+(i<<1<<2)|0;k=j+8|0;l=c[k>>2]|0;m=l+8|0;n=c[m>>2]|0;if((n|0)==(j|0))c[3521]=g&~(1<<i);else{c[n+12>>2]=j;c[k>>2]=n}n=i<<3;c[l+4>>2]=n|3;i=l+n+4|0;c[i>>2]=c[i>>2]|1;o=m;Ja=b;return o|0}m=c[3523]|0;if(e>>>0>m>>>0){if(h|0){i=2<<f;n=h<<f&(i|0-i);i=(n&0-n)+-1|0;n=i>>>12&16;f=i>>>n;i=f>>>5&8;h=f>>>i;f=h>>>2&4;l=h>>>f;h=l>>>1&2;k=l>>>h;l=k>>>1&1;j=(i|n|f|h|l)+(k>>>l)|0;l=14124+(j<<1<<2)|0;k=l+8|0;h=c[k>>2]|0;f=h+8|0;n=c[f>>2]|0;if((n|0)==(l|0)){i=g&~(1<<j);c[3521]=i;p=i}else{c[n+12>>2]=l;c[k>>2]=n;p=g}n=j<<3;j=n-e|0;c[h+4>>2]=e|3;k=h+e|0;c[k+4>>2]=j|1;c[h+n>>2]=j;if(m|0){n=c[3526]|0;h=m>>>3;l=14124+(h<<1<<2)|0;i=1<<h;if(!(p&i)){c[3521]=p|i;q=l;r=l+8|0}else{i=l+8|0;q=c[i>>2]|0;r=i}c[r>>2]=n;c[q+12>>2]=n;c[n+8>>2]=q;c[n+12>>2]=l}c[3523]=j;c[3526]=k;o=f;Ja=b;return o|0}f=c[3522]|0;if(f){k=(f&0-f)+-1|0;j=k>>>12&16;l=k>>>j;k=l>>>5&8;n=l>>>k;l=n>>>2&4;i=n>>>l;n=i>>>1&2;h=i>>>n;i=h>>>1&1;s=c[14388+((k|j|l|n|i)+(h>>>i)<<2)>>2]|0;i=s;h=s;n=(c[s+4>>2]&-8)-e|0;while(1){s=c[i+16>>2]|0;if(!s){l=c[i+20>>2]|0;if(!l)break;else t=l}else t=s;s=(c[t+4>>2]&-8)-e|0;l=s>>>0<n>>>0;i=t;h=l?t:h;n=l?s:n}i=h+e|0;if(i>>>0>h>>>0){s=c[h+24>>2]|0;l=c[h+12>>2]|0;do if((l|0)==(h|0)){j=h+20|0;k=c[j>>2]|0;if(!k){u=h+16|0;v=c[u>>2]|0;if(!v){w=0;break}else{x=v;y=u}}else{x=k;y=j}j=x;k=y;while(1){u=j+20|0;v=c[u>>2]|0;if(!v){z=j+16|0;B=c[z>>2]|0;if(!B)break;else{C=B;D=z}}else{C=v;D=u}j=C;k=D}c[k>>2]=0;w=j}else{u=c[h+8>>2]|0;c[u+12>>2]=l;c[l+8>>2]=u;w=l}while(0);do if(s|0){l=c[h+28>>2]|0;u=14388+(l<<2)|0;if((h|0)==(c[u>>2]|0)){c[u>>2]=w;if(!w){c[3522]=f&~(1<<l);break}}else{l=s+16|0;c[((c[l>>2]|0)==(h|0)?l:s+20|0)>>2]=w;if(!w)break}c[w+24>>2]=s;l=c[h+16>>2]|0;if(l|0){c[w+16>>2]=l;c[l+24>>2]=w}l=c[h+20>>2]|0;if(l|0){c[w+20>>2]=l;c[l+24>>2]=w}}while(0);if(n>>>0<16){s=n+e|0;c[h+4>>2]=s|3;f=h+s+4|0;c[f>>2]=c[f>>2]|1}else{c[h+4>>2]=e|3;c[i+4>>2]=n|1;c[i+n>>2]=n;if(m|0){f=c[3526]|0;s=m>>>3;l=14124+(s<<1<<2)|0;u=1<<s;if(!(u&g)){c[3521]=u|g;E=l;F=l+8|0}else{u=l+8|0;E=c[u>>2]|0;F=u}c[F>>2]=f;c[E+12>>2]=f;c[f+8>>2]=E;c[f+12>>2]=l}c[3523]=n;c[3526]=i}o=h+8|0;Ja=b;return o|0}else G=e}else G=e}else G=e}else if(a>>>0<=4294967231){l=a+11|0;f=l&-8;u=c[3522]|0;if(u){s=0-f|0;v=l>>>8;if(v)if(f>>>0>16777215)H=31;else{l=(v+1048320|0)>>>16&8;z=v<<l;v=(z+520192|0)>>>16&4;B=z<<v;z=(B+245760|0)>>>16&2;I=14-(v|l|z)+(B<<z>>>15)|0;H=f>>>(I+7|0)&1|I<<1}else H=0;I=c[14388+(H<<2)>>2]|0;a:do if(!I){J=0;K=0;L=s;M=61}else{z=0;B=s;l=I;v=f<<((H|0)==31?0:25-(H>>>1)|0);N=0;while(1){O=(c[l+4>>2]&-8)-f|0;if(O>>>0<B>>>0)if(!O){P=l;Q=0;R=l;M=65;break a}else{S=l;T=O}else{S=z;T=B}O=c[l+20>>2]|0;l=c[l+16+(v>>>31<<2)>>2]|0;U=(O|0)==0|(O|0)==(l|0)?N:O;if(!l){J=U;K=S;L=T;M=61;break}else{z=S;B=T;v=v<<1;N=U}}}while(0);if((M|0)==61){if((J|0)==0&(K|0)==0){I=2<<H;s=(I|0-I)&u;if(!s){G=f;break}I=(s&0-s)+-1|0;s=I>>>12&16;e=I>>>s;I=e>>>5&8;h=e>>>I;e=h>>>2&4;i=h>>>e;h=i>>>1&2;n=i>>>h;i=n>>>1&1;V=0;W=c[14388+((I|s|e|h|i)+(n>>>i)<<2)>>2]|0}else{V=K;W=J}if(!W){X=V;Y=L}else{P=V;Q=L;R=W;M=65}}if((M|0)==65){i=P;n=Q;h=R;while(1){e=(c[h+4>>2]&-8)-f|0;s=e>>>0<n>>>0;I=s?e:n;e=s?h:i;s=c[h+16>>2]|0;if(!s)Z=c[h+20>>2]|0;else Z=s;if(!Z){X=e;Y=I;break}else{i=e;n=I;h=Z}}}if(((X|0)!=0?Y>>>0<((c[3523]|0)-f|0)>>>0:0)?(h=X+f|0,h>>>0>X>>>0):0){n=c[X+24>>2]|0;i=c[X+12>>2]|0;do if((i|0)==(X|0)){I=X+20|0;e=c[I>>2]|0;if(!e){s=X+16|0;g=c[s>>2]|0;if(!g){_=0;break}else{$=g;aa=s}}else{$=e;aa=I}I=$;e=aa;while(1){s=I+20|0;g=c[s>>2]|0;if(!g){m=I+16|0;N=c[m>>2]|0;if(!N)break;else{ba=N;ca=m}}else{ba=g;ca=s}I=ba;e=ca}c[e>>2]=0;_=I}else{s=c[X+8>>2]|0;c[s+12>>2]=i;c[i+8>>2]=s;_=i}while(0);do if(n){i=c[X+28>>2]|0;s=14388+(i<<2)|0;if((X|0)==(c[s>>2]|0)){c[s>>2]=_;if(!_){s=u&~(1<<i);c[3522]=s;da=s;break}}else{s=n+16|0;c[((c[s>>2]|0)==(X|0)?s:n+20|0)>>2]=_;if(!_){da=u;break}}c[_+24>>2]=n;s=c[X+16>>2]|0;if(s|0){c[_+16>>2]=s;c[s+24>>2]=_}s=c[X+20>>2]|0;if(s){c[_+20>>2]=s;c[s+24>>2]=_;da=u}else da=u}else da=u;while(0);b:do if(Y>>>0<16){u=Y+f|0;c[X+4>>2]=u|3;n=X+u+4|0;c[n>>2]=c[n>>2]|1}else{c[X+4>>2]=f|3;c[h+4>>2]=Y|1;c[h+Y>>2]=Y;n=Y>>>3;if(Y>>>0<256){u=14124+(n<<1<<2)|0;s=c[3521]|0;i=1<<n;if(!(s&i)){c[3521]=s|i;ea=u;fa=u+8|0}else{i=u+8|0;ea=c[i>>2]|0;fa=i}c[fa>>2]=h;c[ea+12>>2]=h;c[h+8>>2]=ea;c[h+12>>2]=u;break}u=Y>>>8;if(u)if(Y>>>0>16777215)ga=31;else{i=(u+1048320|0)>>>16&8;s=u<<i;u=(s+520192|0)>>>16&4;n=s<<u;s=(n+245760|0)>>>16&2;g=14-(u|i|s)+(n<<s>>>15)|0;ga=Y>>>(g+7|0)&1|g<<1}else ga=0;g=14388+(ga<<2)|0;c[h+28>>2]=ga;s=h+16|0;c[s+4>>2]=0;c[s>>2]=0;s=1<<ga;if(!(da&s)){c[3522]=da|s;c[g>>2]=h;c[h+24>>2]=g;c[h+12>>2]=h;c[h+8>>2]=h;break}s=c[g>>2]|0;c:do if((c[s+4>>2]&-8|0)==(Y|0))ha=s;else{g=Y<<((ga|0)==31?0:25-(ga>>>1)|0);n=s;while(1){ia=n+16+(g>>>31<<2)|0;i=c[ia>>2]|0;if(!i)break;if((c[i+4>>2]&-8|0)==(Y|0)){ha=i;break c}else{g=g<<1;n=i}}c[ia>>2]=h;c[h+24>>2]=n;c[h+12>>2]=h;c[h+8>>2]=h;break b}while(0);s=ha+8|0;I=c[s>>2]|0;c[I+12>>2]=h;c[s>>2]=h;c[h+8>>2]=I;c[h+12>>2]=ha;c[h+24>>2]=0}while(0);o=X+8|0;Ja=b;return o|0}else G=f}else G=f}else G=-1;while(0);X=c[3523]|0;if(X>>>0>=G>>>0){ha=X-G|0;ia=c[3526]|0;if(ha>>>0>15){Y=ia+G|0;c[3526]=Y;c[3523]=ha;c[Y+4>>2]=ha|1;c[ia+X>>2]=ha;c[ia+4>>2]=G|3}else{c[3523]=0;c[3526]=0;c[ia+4>>2]=X|3;ha=ia+X+4|0;c[ha>>2]=c[ha>>2]|1}o=ia+8|0;Ja=b;return o|0}ia=c[3524]|0;if(ia>>>0>G>>>0){ha=ia-G|0;c[3524]=ha;X=c[3527]|0;Y=X+G|0;c[3527]=Y;c[Y+4>>2]=ha|1;c[X+4>>2]=G|3;o=X+8|0;Ja=b;return o|0}if(!(c[3639]|0)){c[3641]=4096;c[3640]=4096;c[3642]=-1;c[3643]=-1;c[3644]=0;c[3632]=0;c[3639]=d&-16^1431655768;ja=4096}else ja=c[3641]|0;d=G+48|0;X=G+47|0;ha=ja+X|0;Y=0-ja|0;ja=ha&Y;if(ja>>>0<=G>>>0){o=0;Ja=b;return o|0}ga=c[3631]|0;if(ga|0?(da=c[3629]|0,ea=da+ja|0,ea>>>0<=da>>>0|ea>>>0>ga>>>0):0){o=0;Ja=b;return o|0}d:do if(!(c[3632]&4)){ga=c[3527]|0;e:do if(ga){ea=14532;while(1){da=c[ea>>2]|0;if(da>>>0<=ga>>>0?(da+(c[ea+4>>2]|0)|0)>>>0>ga>>>0:0)break;da=c[ea+8>>2]|0;if(!da){M=128;break e}else ea=da}da=ha-ia&Y;if(da>>>0<2147483647){fa=Uh(da|0)|0;if((fa|0)==((c[ea>>2]|0)+(c[ea+4>>2]|0)|0))if((fa|0)==(-1|0))ka=da;else{la=da;ma=fa;M=145;break d}else{na=fa;oa=da;M=136}}else ka=0}else M=128;while(0);do if((M|0)==128){ga=Uh(0)|0;if((ga|0)!=(-1|0)?(f=ga,da=c[3640]|0,fa=da+-1|0,_=((fa&f|0)==0?0:(fa+f&0-da)-f|0)+ja|0,f=c[3629]|0,da=_+f|0,_>>>0>G>>>0&_>>>0<2147483647):0){fa=c[3631]|0;if(fa|0?da>>>0<=f>>>0|da>>>0>fa>>>0:0){ka=0;break}fa=Uh(_|0)|0;if((fa|0)==(ga|0)){la=_;ma=ga;M=145;break d}else{na=fa;oa=_;M=136}}else ka=0}while(0);do if((M|0)==136){_=0-oa|0;if(!(d>>>0>oa>>>0&(oa>>>0<2147483647&(na|0)!=(-1|0))))if((na|0)==(-1|0)){ka=0;break}else{la=oa;ma=na;M=145;break d}fa=c[3641]|0;ga=X-oa+fa&0-fa;if(ga>>>0>=2147483647){la=oa;ma=na;M=145;break d}if((Uh(ga|0)|0)==(-1|0)){Uh(_|0)|0;ka=0;break}else{la=ga+oa|0;ma=na;M=145;break d}}while(0);c[3632]=c[3632]|4;pa=ka;M=143}else{pa=0;M=143}while(0);if(((M|0)==143?ja>>>0<2147483647:0)?(ka=Uh(ja|0)|0,ja=Uh(0)|0,na=ja-ka|0,oa=na>>>0>(G+40|0)>>>0,!((ka|0)==(-1|0)|oa^1|ka>>>0<ja>>>0&((ka|0)!=(-1|0)&(ja|0)!=(-1|0))^1)):0){la=oa?na:pa;ma=ka;M=145}if((M|0)==145){ka=(c[3629]|0)+la|0;c[3629]=ka;if(ka>>>0>(c[3630]|0)>>>0)c[3630]=ka;ka=c[3527]|0;f:do if(ka){pa=14532;while(1){qa=c[pa>>2]|0;ra=c[pa+4>>2]|0;if((ma|0)==(qa+ra|0)){M=154;break}na=c[pa+8>>2]|0;if(!na)break;else pa=na}if(((M|0)==154?(na=pa+4|0,(c[pa+12>>2]&8|0)==0):0)?ma>>>0>ka>>>0&qa>>>0<=ka>>>0:0){c[na>>2]=ra+la;na=(c[3524]|0)+la|0;oa=ka+8|0;ja=(oa&7|0)==0?0:0-oa&7;oa=ka+ja|0;X=na-ja|0;c[3527]=oa;c[3524]=X;c[oa+4>>2]=X|1;c[ka+na+4>>2]=40;c[3528]=c[3643];break}if(ma>>>0<(c[3525]|0)>>>0)c[3525]=ma;na=ma+la|0;X=14532;while(1){if((c[X>>2]|0)==(na|0)){M=162;break}oa=c[X+8>>2]|0;if(!oa)break;else X=oa}if((M|0)==162?(c[X+12>>2]&8|0)==0:0){c[X>>2]=ma;pa=X+4|0;c[pa>>2]=(c[pa>>2]|0)+la;pa=ma+8|0;oa=ma+((pa&7|0)==0?0:0-pa&7)|0;pa=na+8|0;ja=na+((pa&7|0)==0?0:0-pa&7)|0;pa=oa+G|0;d=ja-oa-G|0;c[oa+4>>2]=G|3;g:do if((ka|0)==(ja|0)){Y=(c[3524]|0)+d|0;c[3524]=Y;c[3527]=pa;c[pa+4>>2]=Y|1}else{if((c[3526]|0)==(ja|0)){Y=(c[3523]|0)+d|0;c[3523]=Y;c[3526]=pa;c[pa+4>>2]=Y|1;c[pa+Y>>2]=Y;break}Y=c[ja+4>>2]|0;if((Y&3|0)==1){ia=Y&-8;ha=Y>>>3;h:do if(Y>>>0<256){ga=c[ja+8>>2]|0;_=c[ja+12>>2]|0;if((_|0)==(ga|0)){c[3521]=c[3521]&~(1<<ha);break}else{c[ga+12>>2]=_;c[_+8>>2]=ga;break}}else{ga=c[ja+24>>2]|0;_=c[ja+12>>2]|0;do if((_|0)==(ja|0)){fa=ja+16|0;da=fa+4|0;f=c[da>>2]|0;if(!f){ca=c[fa>>2]|0;if(!ca){sa=0;break}else{ta=ca;ua=fa}}else{ta=f;ua=da}da=ta;f=ua;while(1){fa=da+20|0;ca=c[fa>>2]|0;if(!ca){ba=da+16|0;aa=c[ba>>2]|0;if(!aa)break;else{va=aa;wa=ba}}else{va=ca;wa=fa}da=va;f=wa}c[f>>2]=0;sa=da}else{fa=c[ja+8>>2]|0;c[fa+12>>2]=_;c[_+8>>2]=fa;sa=_}while(0);if(!ga)break;_=c[ja+28>>2]|0;n=14388+(_<<2)|0;do if((c[n>>2]|0)!=(ja|0)){fa=ga+16|0;c[((c[fa>>2]|0)==(ja|0)?fa:ga+20|0)>>2]=sa;if(!sa)break h}else{c[n>>2]=sa;if(sa|0)break;c[3522]=c[3522]&~(1<<_);break h}while(0);c[sa+24>>2]=ga;_=ja+16|0;n=c[_>>2]|0;if(n|0){c[sa+16>>2]=n;c[n+24>>2]=sa}n=c[_+4>>2]|0;if(!n)break;c[sa+20>>2]=n;c[n+24>>2]=sa}while(0);xa=ja+ia|0;ya=ia+d|0}else{xa=ja;ya=d}ha=xa+4|0;c[ha>>2]=c[ha>>2]&-2;c[pa+4>>2]=ya|1;c[pa+ya>>2]=ya;ha=ya>>>3;if(ya>>>0<256){Y=14124+(ha<<1<<2)|0;ea=c[3521]|0;n=1<<ha;if(!(ea&n)){c[3521]=ea|n;za=Y;Aa=Y+8|0}else{n=Y+8|0;za=c[n>>2]|0;Aa=n}c[Aa>>2]=pa;c[za+12>>2]=pa;c[pa+8>>2]=za;c[pa+12>>2]=Y;break}Y=ya>>>8;do if(!Y)Ba=0;else{if(ya>>>0>16777215){Ba=31;break}n=(Y+1048320|0)>>>16&8;ea=Y<<n;ha=(ea+520192|0)>>>16&4;_=ea<<ha;ea=(_+245760|0)>>>16&2;fa=14-(ha|n|ea)+(_<<ea>>>15)|0;Ba=ya>>>(fa+7|0)&1|fa<<1}while(0);Y=14388+(Ba<<2)|0;c[pa+28>>2]=Ba;ia=pa+16|0;c[ia+4>>2]=0;c[ia>>2]=0;ia=c[3522]|0;fa=1<<Ba;if(!(ia&fa)){c[3522]=ia|fa;c[Y>>2]=pa;c[pa+24>>2]=Y;c[pa+12>>2]=pa;c[pa+8>>2]=pa;break}fa=c[Y>>2]|0;i:do if((c[fa+4>>2]&-8|0)==(ya|0))Ca=fa;else{Y=ya<<((Ba|0)==31?0:25-(Ba>>>1)|0);ia=fa;while(1){Da=ia+16+(Y>>>31<<2)|0;ea=c[Da>>2]|0;if(!ea)break;if((c[ea+4>>2]&-8|0)==(ya|0)){Ca=ea;break i}else{Y=Y<<1;ia=ea}}c[Da>>2]=pa;c[pa+24>>2]=ia;c[pa+12>>2]=pa;c[pa+8>>2]=pa;break g}while(0);fa=Ca+8|0;Y=c[fa>>2]|0;c[Y+12>>2]=pa;c[fa>>2]=pa;c[pa+8>>2]=Y;c[pa+12>>2]=Ca;c[pa+24>>2]=0}while(0);o=oa+8|0;Ja=b;return o|0}pa=14532;while(1){d=c[pa>>2]|0;if(d>>>0<=ka>>>0?(Ea=d+(c[pa+4>>2]|0)|0,Ea>>>0>ka>>>0):0)break;pa=c[pa+8>>2]|0}pa=Ea+-47|0;oa=pa+8|0;d=pa+((oa&7|0)==0?0:0-oa&7)|0;oa=ka+16|0;pa=d>>>0<oa>>>0?ka:d;d=pa+8|0;ja=la+-40|0;na=ma+8|0;X=(na&7|0)==0?0:0-na&7;na=ma+X|0;Y=ja-X|0;c[3527]=na;c[3524]=Y;c[na+4>>2]=Y|1;c[ma+ja+4>>2]=40;c[3528]=c[3643];ja=pa+4|0;c[ja>>2]=27;c[d>>2]=c[3633];c[d+4>>2]=c[3634];c[d+8>>2]=c[3635];c[d+12>>2]=c[3636];c[3633]=ma;c[3634]=la;c[3636]=0;c[3635]=d;d=pa+24|0;do{Y=d;d=d+4|0;c[d>>2]=7}while((Y+8|0)>>>0<Ea>>>0);if((pa|0)!=(ka|0)){d=pa-ka|0;c[ja>>2]=c[ja>>2]&-2;c[ka+4>>2]=d|1;c[pa>>2]=d;Y=d>>>3;if(d>>>0<256){na=14124+(Y<<1<<2)|0;X=c[3521]|0;fa=1<<Y;if(!(X&fa)){c[3521]=X|fa;Fa=na;Ga=na+8|0}else{fa=na+8|0;Fa=c[fa>>2]|0;Ga=fa}c[Ga>>2]=ka;c[Fa+12>>2]=ka;c[ka+8>>2]=Fa;c[ka+12>>2]=na;break}na=d>>>8;if(na)if(d>>>0>16777215)Ha=31;else{fa=(na+1048320|0)>>>16&8;X=na<<fa;na=(X+520192|0)>>>16&4;Y=X<<na;X=(Y+245760|0)>>>16&2;ga=14-(na|fa|X)+(Y<<X>>>15)|0;Ha=d>>>(ga+7|0)&1|ga<<1}else Ha=0;ga=14388+(Ha<<2)|0;c[ka+28>>2]=Ha;c[ka+20>>2]=0;c[oa>>2]=0;X=c[3522]|0;Y=1<<Ha;if(!(X&Y)){c[3522]=X|Y;c[ga>>2]=ka;c[ka+24>>2]=ga;c[ka+12>>2]=ka;c[ka+8>>2]=ka;break}Y=c[ga>>2]|0;j:do if((c[Y+4>>2]&-8|0)==(d|0))Ia=Y;else{ga=d<<((Ha|0)==31?0:25-(Ha>>>1)|0);X=Y;while(1){La=X+16+(ga>>>31<<2)|0;fa=c[La>>2]|0;if(!fa)break;if((c[fa+4>>2]&-8|0)==(d|0)){Ia=fa;break j}else{ga=ga<<1;X=fa}}c[La>>2]=ka;c[ka+24>>2]=X;c[ka+12>>2]=ka;c[ka+8>>2]=ka;break f}while(0);d=Ia+8|0;Y=c[d>>2]|0;c[Y+12>>2]=ka;c[d>>2]=ka;c[ka+8>>2]=Y;c[ka+12>>2]=Ia;c[ka+24>>2]=0}}else{Y=c[3525]|0;if((Y|0)==0|ma>>>0<Y>>>0)c[3525]=ma;c[3633]=ma;c[3634]=la;c[3636]=0;c[3530]=c[3639];c[3529]=-1;c[3534]=14124;c[3533]=14124;c[3536]=14132;c[3535]=14132;c[3538]=14140;c[3537]=14140;c[3540]=14148;c[3539]=14148;c[3542]=14156;c[3541]=14156;c[3544]=14164;c[3543]=14164;c[3546]=14172;c[3545]=14172;c[3548]=14180;c[3547]=14180;c[3550]=14188;c[3549]=14188;c[3552]=14196;c[3551]=14196;c[3554]=14204;c[3553]=14204;c[3556]=14212;c[3555]=14212;c[3558]=14220;c[3557]=14220;c[3560]=14228;c[3559]=14228;c[3562]=14236;c[3561]=14236;c[3564]=14244;c[3563]=14244;c[3566]=14252;c[3565]=14252;c[3568]=14260;c[3567]=14260;c[3570]=14268;c[3569]=14268;c[3572]=14276;c[3571]=14276;c[3574]=14284;c[3573]=14284;c[3576]=14292;c[3575]=14292;c[3578]=14300;c[3577]=14300;c[3580]=14308;c[3579]=14308;c[3582]=14316;c[3581]=14316;c[3584]=14324;c[3583]=14324;c[3586]=14332;c[3585]=14332;c[3588]=14340;c[3587]=14340;c[3590]=14348;c[3589]=14348;c[3592]=14356;c[3591]=14356;c[3594]=14364;c[3593]=14364;c[3596]=14372;c[3595]=14372;Y=la+-40|0;d=ma+8|0;oa=(d&7|0)==0?0:0-d&7;d=ma+oa|0;pa=Y-oa|0;c[3527]=d;c[3524]=pa;c[d+4>>2]=pa|1;c[ma+Y+4>>2]=40;c[3528]=c[3643]}while(0);ma=c[3524]|0;if(ma>>>0>G>>>0){la=ma-G|0;c[3524]=la;ma=c[3527]|0;ka=ma+G|0;c[3527]=ka;c[ka+4>>2]=la|1;c[ma+4>>2]=G|3;o=ma+8|0;Ja=b;return o|0}}c[(gf()|0)>>2]=12;o=0;Ja=b;return o|0}function gg(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0;if(!a)return;b=a+-8|0;d=c[3525]|0;e=c[a+-4>>2]|0;a=e&-8;f=b+a|0;do if(!(e&1)){g=c[b>>2]|0;if(!(e&3))return;h=b+(0-g)|0;i=g+a|0;if(h>>>0<d>>>0)return;if((c[3526]|0)==(h|0)){j=f+4|0;k=c[j>>2]|0;if((k&3|0)!=3){l=h;m=i;n=h;break}c[3523]=i;c[j>>2]=k&-2;c[h+4>>2]=i|1;c[h+i>>2]=i;return}k=g>>>3;if(g>>>0<256){g=c[h+8>>2]|0;j=c[h+12>>2]|0;if((j|0)==(g|0)){c[3521]=c[3521]&~(1<<k);l=h;m=i;n=h;break}else{c[g+12>>2]=j;c[j+8>>2]=g;l=h;m=i;n=h;break}}g=c[h+24>>2]|0;j=c[h+12>>2]|0;do if((j|0)==(h|0)){k=h+16|0;o=k+4|0;p=c[o>>2]|0;if(!p){q=c[k>>2]|0;if(!q){r=0;break}else{s=q;t=k}}else{s=p;t=o}o=s;p=t;while(1){k=o+20|0;q=c[k>>2]|0;if(!q){u=o+16|0;v=c[u>>2]|0;if(!v)break;else{w=v;x=u}}else{w=q;x=k}o=w;p=x}c[p>>2]=0;r=o}else{k=c[h+8>>2]|0;c[k+12>>2]=j;c[j+8>>2]=k;r=j}while(0);if(g){j=c[h+28>>2]|0;k=14388+(j<<2)|0;if((c[k>>2]|0)==(h|0)){c[k>>2]=r;if(!r){c[3522]=c[3522]&~(1<<j);l=h;m=i;n=h;break}}else{j=g+16|0;c[((c[j>>2]|0)==(h|0)?j:g+20|0)>>2]=r;if(!r){l=h;m=i;n=h;break}}c[r+24>>2]=g;j=h+16|0;k=c[j>>2]|0;if(k|0){c[r+16>>2]=k;c[k+24>>2]=r}k=c[j+4>>2]|0;if(k){c[r+20>>2]=k;c[k+24>>2]=r;l=h;m=i;n=h}else{l=h;m=i;n=h}}else{l=h;m=i;n=h}}else{l=b;m=a;n=b}while(0);if(n>>>0>=f>>>0)return;b=f+4|0;a=c[b>>2]|0;if(!(a&1))return;if(!(a&2)){if((c[3527]|0)==(f|0)){r=(c[3524]|0)+m|0;c[3524]=r;c[3527]=l;c[l+4>>2]=r|1;if((l|0)!=(c[3526]|0))return;c[3526]=0;c[3523]=0;return}if((c[3526]|0)==(f|0)){r=(c[3523]|0)+m|0;c[3523]=r;c[3526]=n;c[l+4>>2]=r|1;c[n+r>>2]=r;return}r=(a&-8)+m|0;x=a>>>3;do if(a>>>0<256){w=c[f+8>>2]|0;t=c[f+12>>2]|0;if((t|0)==(w|0)){c[3521]=c[3521]&~(1<<x);break}else{c[w+12>>2]=t;c[t+8>>2]=w;break}}else{w=c[f+24>>2]|0;t=c[f+12>>2]|0;do if((t|0)==(f|0)){s=f+16|0;d=s+4|0;e=c[d>>2]|0;if(!e){k=c[s>>2]|0;if(!k){y=0;break}else{z=k;A=s}}else{z=e;A=d}d=z;e=A;while(1){s=d+20|0;k=c[s>>2]|0;if(!k){j=d+16|0;q=c[j>>2]|0;if(!q)break;else{B=q;C=j}}else{B=k;C=s}d=B;e=C}c[e>>2]=0;y=d}else{o=c[f+8>>2]|0;c[o+12>>2]=t;c[t+8>>2]=o;y=t}while(0);if(w|0){t=c[f+28>>2]|0;h=14388+(t<<2)|0;if((c[h>>2]|0)==(f|0)){c[h>>2]=y;if(!y){c[3522]=c[3522]&~(1<<t);break}}else{t=w+16|0;c[((c[t>>2]|0)==(f|0)?t:w+20|0)>>2]=y;if(!y)break}c[y+24>>2]=w;t=f+16|0;h=c[t>>2]|0;if(h|0){c[y+16>>2]=h;c[h+24>>2]=y}h=c[t+4>>2]|0;if(h|0){c[y+20>>2]=h;c[h+24>>2]=y}}}while(0);c[l+4>>2]=r|1;c[n+r>>2]=r;if((l|0)==(c[3526]|0)){c[3523]=r;return}else D=r}else{c[b>>2]=a&-2;c[l+4>>2]=m|1;c[n+m>>2]=m;D=m}m=D>>>3;if(D>>>0<256){n=14124+(m<<1<<2)|0;a=c[3521]|0;b=1<<m;if(!(a&b)){c[3521]=a|b;E=n;F=n+8|0}else{b=n+8|0;E=c[b>>2]|0;F=b}c[F>>2]=l;c[E+12>>2]=l;c[l+8>>2]=E;c[l+12>>2]=n;return}n=D>>>8;if(n)if(D>>>0>16777215)G=31;else{E=(n+1048320|0)>>>16&8;F=n<<E;n=(F+520192|0)>>>16&4;b=F<<n;F=(b+245760|0)>>>16&2;a=14-(n|E|F)+(b<<F>>>15)|0;G=D>>>(a+7|0)&1|a<<1}else G=0;a=14388+(G<<2)|0;c[l+28>>2]=G;c[l+20>>2]=0;c[l+16>>2]=0;F=c[3522]|0;b=1<<G;a:do if(!(F&b)){c[3522]=F|b;c[a>>2]=l;c[l+24>>2]=a;c[l+12>>2]=l;c[l+8>>2]=l}else{E=c[a>>2]|0;b:do if((c[E+4>>2]&-8|0)==(D|0))H=E;else{n=D<<((G|0)==31?0:25-(G>>>1)|0);m=E;while(1){I=m+16+(n>>>31<<2)|0;r=c[I>>2]|0;if(!r)break;if((c[r+4>>2]&-8|0)==(D|0)){H=r;break b}else{n=n<<1;m=r}}c[I>>2]=l;c[l+24>>2]=m;c[l+12>>2]=l;c[l+8>>2]=l;break a}while(0);E=H+8|0;w=c[E>>2]|0;c[w+12>>2]=l;c[E>>2]=l;c[l+8>>2]=w;c[l+12>>2]=H;c[l+24>>2]=0}while(0);l=(c[3529]|0)+-1|0;c[3529]=l;if(l|0)return;l=14540;while(1){H=c[l>>2]|0;if(!H)break;else l=H+8|0}c[3529]=-1;return}function hg(a){a=a|0;return}function ig(a){a=a|0;hg(a);pg(a);return}function jg(a){a=a|0;return 9378}function kg(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,w=0,x=0,y=0,z=0,B=0,C=0,D=0,E=0,F=0;b=Ja;Ja=Ja+16|0;if((Ja|0)>=(Ka|0))A(16);d=b;e=b+8|0;f=b+4|0;c[e>>2]=a;do if(a>>>0>=212){g=(a>>>0)/210|0;h=g*210|0;c[f>>2]=a-h;i=0;j=g;g=h;h=(lg(2592,2784,f,d)|0)-2592>>2;a:while(1){k=(c[2592+(h<<2)>>2]|0)+g|0;l=5;while(1){if(l>>>0>=47){m=6;break}n=c[2400+(l<<2)>>2]|0;o=(k>>>0)/(n>>>0)|0;if(o>>>0<n>>>0){m=107;break a}if((k|0)==(v(o,n)|0)){p=i;break}else l=l+1|0}b:do if((m|0)==6){m=0;l=211;n=i;c:while(1){o=(k>>>0)/(l>>>0)|0;do if(o>>>0>=l>>>0)if((k|0)!=(v(o,l)|0)){q=l+10|0;r=(k>>>0)/(q>>>0)|0;if(r>>>0>=q>>>0)if((k|0)!=(v(r,q)|0)){r=l+12|0;s=(k>>>0)/(r>>>0)|0;if(s>>>0>=r>>>0)if((k|0)!=(v(s,r)|0)){s=l+16|0;t=(k>>>0)/(s>>>0)|0;if(t>>>0>=s>>>0)if((k|0)!=(v(t,s)|0)){t=l+18|0;u=(k>>>0)/(t>>>0)|0;if(u>>>0>=t>>>0)if((k|0)!=(v(u,t)|0)){u=l+22|0;w=(k>>>0)/(u>>>0)|0;if(w>>>0>=u>>>0)if((k|0)!=(v(w,u)|0)){w=l+28|0;x=(k>>>0)/(w>>>0)|0;if(x>>>0>=w>>>0)if((k|0)==(v(x,w)|0)){y=w;z=9;B=n}else{x=l+30|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+36|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+40|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+42|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+46|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+52|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+58|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+60|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+66|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+70|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+72|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+78|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+82|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+88|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+96|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+100|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+102|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+106|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+108|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+112|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+120|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+126|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+130|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+136|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+138|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+142|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+148|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+150|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+156|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+162|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+166|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+168|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+172|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+178|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+180|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+186|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+190|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+192|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+196|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+198|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;B=k;break}if((k|0)==(v(C,x)|0)){y=x;z=9;B=n;break}x=l+208|0;C=(k>>>0)/(x>>>0)|0;D=C>>>0<x>>>0;E=(k|0)==(v(C,x)|0);y=D|E?x:l+210|0;z=D?1:E?9:0;B=D?k:n}else{y=w;z=1;B=k}}else{y=u;z=9;B=n}else{y=u;z=1;B=k}}else{y=t;z=9;B=n}else{y=t;z=1;B=k}}else{y=s;z=9;B=n}else{y=s;z=1;B=k}}else{y=r;z=9;B=n}else{y=r;z=1;B=k}}else{y=q;z=9;B=n}else{y=q;z=1;B=k}}else{y=l;z=9;B=n}else{y=l;z=1;B=k}while(0);switch(z&15){case 9:{p=B;break b;break}case 0:{l=y;n=B;break}default:break c}}if(!z)p=B;else{m=108;break a}}while(0);n=h+1|0;l=(n|0)==48;o=j+(l&1)|0;i=p;j=o;g=o*210|0;h=l?0:n}if((m|0)==107){c[e>>2]=k;F=k;break}else if((m|0)==108){c[e>>2]=k;F=B;break}}else F=c[(lg(2400,2592,e,d)|0)>>2]|0;while(0);Ja=b;return F|0}function lg(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0;e=c[d>>2]|0;d=a;f=b-a>>2;while(1){if(!f)break;a=(f|0)/2|0;b=d+(a<<2)|0;g=(c[b>>2]|0)>>>0<e>>>0;d=g?b+4|0:d;f=g?f+-1-a|0:a}return d|0}function mg(a){a=a|0;return}function ng(a){a=a|0;var b=0,d=0;b=a+8|0;if(!((c[b>>2]|0)!=0?(d=c[b>>2]|0,c[b>>2]=d+-1,(d|0)!=0):0))Ra[c[(c[a>>2]|0)+16>>2]&127](a);return}function og(a){a=a|0;var b=0,c=0;b=(a|0)==0?1:a;while(1){a=fg(b)|0;if(a|0){c=a;break}a=Eh()|0;if(!a){c=0;break}Qa[a&3]()}return c|0}function pg(a){a=a|0;gg(a);return}function qg(b,d){b=b|0;d=d|0;var e=0,f=0,g=0;e=Ja;Ja=Ja+16|0;if((Ja|0)>=(Ka|0))A(16);f=e;g=Yf((a[d+11>>0]|0)<0?c[d>>2]|0:d,0,f)|0;c[b>>2]=g;if((g|0)<0){g=c[(gf()|0)>>2]|0;Mg(f,9484,d);Ng(g,(a[f+11>>0]|0)<0?c[f>>2]|0:f)}else{Ja=e;return}}function rg(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0;b=Ja;Ja=Ja+16|0;if((Ja|0)>=(Ka|0))A(16);d=b;e=4;f=d;a:while(1){if(!e){g=9;break}b:while(1){h=$f(c[a>>2]|0,f,e)|0;switch(h|0){case 0:{g=5;break a;break}case -1:break;default:break b}if((c[(gf()|0)>>2]|0)!=4){g=7;break a}}e=e-h|0;f=f+h|0}if((g|0)==5)Ng(61,9514);else if((g|0)==7)Ng(c[(gf()|0)>>2]|0,9536);else if((g|0)==9){Ja=b;return c[d>>2]|0}return 0}function sg(a,b){a=a|0;b=b|0;var d=0,e=0,f=0;d=nf(b)|0;e=og(d+13|0)|0;c[e>>2]=d;c[e+4>>2]=d;c[e+8>>2]=0;f=tg(e)|0;Rh(f|0,b|0,d+1|0)|0;c[a>>2]=f;return}function tg(a){a=a|0;return a+12|0}function ug(a,b){a=a|0;b=b|0;c[a>>2]=5312;sg(a+4|0,b);return}function vg(a){a=a|0;return 1}function wg(a){a=a|0;va()}function xg(a){a=a|0;va()}function yg(b,d){b=b|0;d=d|0;c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;if((a[d+11>>0]|0)<0)zg(b,c[d>>2]|0,c[d+4>>2]|0);else{c[b>>2]=c[d>>2];c[b+4>>2]=c[d+4>>2];c[b+8>>2]=c[d+8>>2]}return}function zg(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0;f=Ja;Ja=Ja+16|0;if((Ja|0)>=(Ka|0))A(16);g=f;if(e>>>0>4294967279)wg(b);if(e>>>0<11){a[b+11>>0]=e;h=b}else{i=e+16&-16;j=og(i)|0;c[b>>2]=j;c[b+8>>2]=i|-2147483648;c[b+4>>2]=e;h=j}Ag(h,d,e)|0;a[g>>0]=0;Bg(h+e|0,g);Ja=f;return}function Ag(a,b,c){a=a|0;b=b|0;c=c|0;if(c|0)Rh(a|0,b|0,c|0)|0;return a|0}function Bg(b,c){b=b|0;c=c|0;a[b>>0]=a[c>>0]|0;return}function Cg(a){a=a|0;return nf(a)|0}function Dg(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;f=Ja;Ja=Ja+16|0;if((Ja|0)>=(Ka|0))A(16);g=f;h=b+11|0;i=a[h>>0]|0;j=i<<24>>24<0;if(j)k=(c[b+8>>2]&2147483647)+-1|0;else k=10;do if(k>>>0>=e>>>0){if(j)l=c[b>>2]|0;else l=b;Eg(l,d,e)|0;a[g>>0]=0;Bg(l+e|0,g);if((a[h>>0]|0)<0){c[b+4>>2]=e;break}else{a[h>>0]=e;break}}else{if(j)m=c[b+4>>2]|0;else m=i&255;Fg(b,k,e-k|0,m,0,m,e,d)}while(0);Ja=f;return b|0}function Eg(a,b,c){a=a|0;b=b|0;c=c|0;if(c|0)Sh(a|0,b|0,c|0)|0;return a|0}function Fg(b,d,e,f,g,h,i,j){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;h=h|0;i=i|0;j=j|0;var k=0,l=0,m=0,n=0,o=0,p=0;k=Ja;Ja=Ja+16|0;if((Ja|0)>=(Ka|0))A(16);l=k;if((-18-d|0)>>>0<e>>>0)wg(b);if((a[b+11>>0]|0)<0)m=c[b>>2]|0;else m=b;if(d>>>0<2147483623){n=e+d|0;e=d<<1;o=n>>>0<e>>>0?e:n;p=o>>>0<11?11:o+16&-16}else p=-17;o=og(p)|0;if(g|0)Ag(o,m,g)|0;if(i|0)Ag(o+g|0,j,i)|0;j=f-h|0;f=j-g|0;if(f|0)Ag(o+g+i|0,m+g+h|0,f)|0;if((d|0)!=10)pg(m);c[b>>2]=o;c[b+8>>2]=p|-2147483648;p=j+i|0;c[b+4>>2]=p;a[l>>0]=0;Bg(o+p|0,l);Ja=k;return}function Gg(a,b){a=a|0;b=b|0;return Dg(a,b,Cg(b)|0)|0}function Hg(b,d,e,f,g,h,i){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;h=h|0;i=i|0;var j=0,k=0,l=0,m=0;if((-17-d|0)>>>0<e>>>0)wg(b);if((a[b+11>>0]|0)<0)j=c[b>>2]|0;else j=b;if(d>>>0<2147483623){k=e+d|0;e=d<<1;l=k>>>0<e>>>0?e:k;m=l>>>0<11?11:l+16&-16}else m=-17;l=og(m)|0;if(g|0)Ag(l,j,g)|0;k=f-h-g|0;if(k|0)Ag(l+g+i|0,j+g+h|0,k)|0;if((d|0)!=10)pg(j);c[b>>2]=l;c[b+8>>2]=m|-2147483648;return}function Ig(b,d){b=b|0;d=d|0;var e=0,f=0,g=0,h=0;e=a[b+11>>0]|0;f=e<<24>>24<0;if(f)g=c[b+4>>2]|0;else g=e&255;if(g>>>0<=d>>>0)xg(b);if(f)h=c[b>>2]|0;else h=b;return h+d|0}function Jg(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;f=Ja;Ja=Ja+16|0;if((Ja|0)>=(Ka|0))A(16);g=f;h=b+11|0;i=a[h>>0]|0;j=i<<24>>24<0;if(j){k=(c[b+8>>2]&2147483647)+-1|0;l=c[b+4>>2]|0}else{k=10;l=i&255}if((k-l|0)>>>0>=e>>>0){if(e|0){if(j)m=c[b>>2]|0;else m=b;Ag(m+l|0,d,e)|0;j=l+e|0;if((a[h>>0]|0)<0)c[b+4>>2]=j;else a[h>>0]=j;a[g>>0]=0;Bg(m+j|0,g)}}else Fg(b,k,l+e-k|0,l,l,0,e,d);Ja=f;return b|0}function Kg(b,d){b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;e=Ja;Ja=Ja+16|0;if((Ja|0)>=(Ka|0))A(16);f=e;g=e+1|0;a[f>>0]=d;d=b+11|0;h=a[d>>0]|0;i=h<<24>>24<0;if(i){j=c[b+4>>2]|0;k=(c[b+8>>2]&2147483647)+-1|0}else{j=h&255;k=10}if((j|0)==(k|0)){Hg(b,k,1,k,k,0,0);if((a[d>>0]|0)<0)l=8;else l=7}else if(i)l=8;else l=7;if((l|0)==7){a[d>>0]=j+1;m=b}else if((l|0)==8){l=c[b>>2]|0;c[b+4>>2]=j+1;m=l}l=m+j|0;Bg(l,f);a[g>>0]=0;Bg(l+1|0,g);Ja=e;return}function Lg(b,d,e,f){b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0,j=0;g=Ja;Ja=Ja+16|0;if((Ja|0)>=(Ka|0))A(16);h=g;if(f>>>0>4294967279)wg(b);if(f>>>0<11){a[b+11>>0]=e;i=b}else{j=f+16&-16;f=og(j)|0;c[b>>2]=f;c[b+8>>2]=j|-2147483648;c[b+4>>2]=e;i=f}Ag(i,d,e)|0;a[h>>0]=0;Bg(i+e|0,h);Ja=g;return}function Mg(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0;c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;f=0;while(1){if((f|0)==3)break;c[b+(f<<2)>>2]=0;f=f+1|0}f=Cg(d)|0;g=e+11|0;h=a[g>>0]|0;i=h<<24>>24<0?c[e+4>>2]|0:h&255;Lg(b,d,f,i+f|0);Jg(b,(a[g>>0]|0)<0?c[e>>2]|0:e,i)|0;return}function Ng(a,b){a=a|0;b=b|0;va()}function Og(a){a=a|0;va()}function Pg(){var a=0,b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0;a=Ja;Ja=Ja+48|0;if((Ja|0)>=(Ka|0))A(48);b=a+32|0;d=a+24|0;e=a+16|0;f=a;g=a+36|0;a=Qg()|0;if(a|0?(h=c[a>>2]|0,h|0):0){a=h+48|0;i=c[a>>2]|0;j=c[a+4>>2]|0;if(!((i&-256|0)==1126902528&(j|0)==1129074247)){c[d>>2]=9710;Rg(9660,d)}if((i|0)==1126902529&(j|0)==1129074247)k=c[h+44>>2]|0;else k=h+80|0;c[g>>2]=k;k=c[h>>2]|0;h=c[k+4>>2]|0;if(Oa[c[(c[860]|0)+16>>2]&15](3440,k,g)|0){k=c[g>>2]|0;g=Ma[c[(c[k>>2]|0)+8>>2]&31](k)|0;c[f>>2]=9710;c[f+4>>2]=h;c[f+8>>2]=g;Rg(9574,f)}else{c[e>>2]=9710;c[e+4>>2]=h;Rg(9619,e)}}Rg(9698,b)}function Qg(){var a=0,b=0;a=Ja;Ja=Ja+16|0;if((Ja|0)>=(Ka|0))A(16);if(!(Ga(14580,3)|0)){b=Ea(c[3646]|0)|0;Ja=a;return b|0}else Rg(9849,a);return 0}function Rg(a,b){a=a|0;b=b|0;var d=0,e=0;d=Ja;Ja=Ja+16|0;if((Ja|0)>=(Ka|0))A(16);e=d;c[e>>2]=b;b=c[1143]|0;Df(b,a,e)|0;dg(10,b)|0;va()}function Sg(a){a=a|0;return}function Tg(a){a=a|0;Sg(a);pg(a);return}function Ug(a){a=a|0;return}function Vg(a){a=a|0;return}function Wg(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0;e=Ja;Ja=Ja+64|0;if((Ja|0)>=(Ka|0))A(64);f=e;if(!(_g(a,b,0)|0))if((b|0)!=0?(g=ch(b,3464,3448,0)|0,(g|0)!=0):0){b=f+4|0;h=b+52|0;do{c[b>>2]=0;b=b+4|0}while((b|0)<(h|0));c[f>>2]=g;c[f+8>>2]=a;c[f+12>>2]=-1;c[f+48>>2]=1;Wa[c[(c[g>>2]|0)+28>>2]&15](g,f,c[d>>2]|0,1);if((c[f+24>>2]|0)==1){c[d>>2]=c[f+16>>2];i=1}else i=0;j=i}else j=0;else j=1;Ja=e;return j|0}function Xg(a,b,d,e,f,g){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;if(_g(a,c[b+8>>2]|0,g)|0)bh(0,b,d,e,f);return}function Yg(b,d,e,f,g){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0;do if(!(_g(b,c[d+8>>2]|0,g)|0)){if(_g(b,c[d>>2]|0,g)|0){if((c[d+16>>2]|0)!=(e|0)?(h=d+20|0,(c[h>>2]|0)!=(e|0)):0){c[d+32>>2]=f;c[h>>2]=e;h=d+40|0;c[h>>2]=(c[h>>2]|0)+1;if((c[d+36>>2]|0)==1?(c[d+24>>2]|0)==2:0)a[d+54>>0]=1;c[d+44>>2]=4;break}if((f|0)==1)c[d+32>>2]=1}}else ah(0,d,e,f);while(0);return}function Zg(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;if(_g(a,c[b+8>>2]|0,0)|0)$g(0,b,d,e);return}function _g(a,b,c){a=a|0;b=b|0;c=c|0;return (a|0)==(b|0)|0}function $g(b,d,e,f){b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0;b=d+16|0;g=c[b>>2]|0;do if(g){if((g|0)!=(e|0)){h=d+36|0;c[h>>2]=(c[h>>2]|0)+1;c[d+24>>2]=2;a[d+54>>0]=1;break}h=d+24|0;if((c[h>>2]|0)==2)c[h>>2]=f}else{c[b>>2]=e;c[d+24>>2]=f;c[d+36>>2]=1}while(0);return}function ah(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;if((c[b+4>>2]|0)==(d|0)?(d=b+28|0,(c[d>>2]|0)!=1):0)c[d>>2]=e;return}function bh(b,d,e,f,g){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0;a[d+53>>0]=1;do if((c[d+4>>2]|0)==(f|0)){a[d+52>>0]=1;b=d+16|0;h=c[b>>2]|0;if(!h){c[b>>2]=e;c[d+24>>2]=g;c[d+36>>2]=1;if(!((g|0)==1?(c[d+48>>2]|0)==1:0))break;a[d+54>>0]=1;break}if((h|0)!=(e|0)){h=d+36|0;c[h>>2]=(c[h>>2]|0)+1;a[d+54>>0]=1;break}h=d+24|0;b=c[h>>2]|0;if((b|0)==2){c[h>>2]=g;i=g}else i=b;if((i|0)==1?(c[d+48>>2]|0)==1:0)a[d+54>>0]=1}while(0);return}function ch(d,e,f,g){d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0;h=Ja;Ja=Ja+64|0;if((Ja|0)>=(Ka|0))A(64);i=h;j=c[d>>2]|0;k=d+(c[j+-8>>2]|0)|0;l=c[j+-4>>2]|0;c[i>>2]=f;c[i+4>>2]=d;c[i+8>>2]=e;c[i+12>>2]=g;g=i+16|0;e=i+20|0;d=i+24|0;j=i+28|0;m=i+32|0;n=i+40|0;o=g;p=o+36|0;do{c[o>>2]=0;o=o+4|0}while((o|0)<(p|0));b[g+36>>1]=0;a[g+38>>0]=0;a:do if(_g(l,f,0)|0){c[i+48>>2]=1;Ya[c[(c[l>>2]|0)+20>>2]&3](l,i,k,k,1,0);q=(c[d>>2]|0)==1?k:0}else{Xa[c[(c[l>>2]|0)+24>>2]&15](l,i,k,1,0);switch(c[i+36>>2]|0){case 0:{q=(c[n>>2]|0)==1&(c[j>>2]|0)==1&(c[m>>2]|0)==1?c[e>>2]|0:0;break a;break}case 1:break;default:{q=0;break a}}if((c[d>>2]|0)!=1?!((c[n>>2]|0)==0&(c[j>>2]|0)==1&(c[m>>2]|0)==1):0){q=0;break}q=c[g>>2]|0}while(0);Ja=h;return q|0}function dh(a){a=a|0;Sg(a);pg(a);return}function eh(a,b,d,e,f,g){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0;if(_g(a,c[b+8>>2]|0,g)|0)bh(0,b,d,e,f);else{h=c[a+8>>2]|0;Ya[c[(c[h>>2]|0)+20>>2]&3](h,b,d,e,f,g)}return}function fh(b,d,e,f,g){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0;do if(!(_g(b,c[d+8>>2]|0,g)|0)){if(!(_g(b,c[d>>2]|0,g)|0)){h=c[b+8>>2]|0;Xa[c[(c[h>>2]|0)+24>>2]&15](h,d,e,f,g);break}if((c[d+16>>2]|0)!=(e|0)?(h=d+20|0,(c[h>>2]|0)!=(e|0)):0){c[d+32>>2]=f;i=d+44|0;if((c[i>>2]|0)==4)break;j=d+52|0;a[j>>0]=0;k=d+53|0;a[k>>0]=0;l=c[b+8>>2]|0;Ya[c[(c[l>>2]|0)+20>>2]&3](l,d,e,e,1,g);if(a[k>>0]|0)if(!(a[j>>0]|0)){m=1;n=11}else n=15;else{m=0;n=11}do if((n|0)==11){c[h>>2]=e;j=d+40|0;c[j>>2]=(c[j>>2]|0)+1;if((c[d+36>>2]|0)==1?(c[d+24>>2]|0)==2:0){a[d+54>>0]=1;if(m){n=15;break}else{o=4;break}}if(m)n=15;else o=4}while(0);if((n|0)==15)o=3;c[i>>2]=o;break}if((f|0)==1)c[d+32>>2]=1}else ah(0,d,e,f);while(0);return}function gh(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0;if(_g(a,c[b+8>>2]|0,0)|0)$g(0,b,d,e);else{f=c[a+8>>2]|0;Wa[c[(c[f>>2]|0)+28>>2]&15](f,b,d,e)}return}function hh(a){a=a|0;return}function ih(){var a=0;a=Ja;Ja=Ja+16|0;if((Ja|0)>=(Ka|0))A(16);if(!(Fa(14584,75)|0)){Ja=a;return}else Rg(9898,a)}function jh(a){a=a|0;var b=0;b=Ja;Ja=Ja+16|0;if((Ja|0)>=(Ka|0))A(16);gg(a);if(!(Ha(c[3646]|0,0)|0)){Ja=b;return}else Rg(9948,b)}function kh(){var a=0,b=0;a=Qg()|0;if((a|0?(b=c[a>>2]|0,b|0):0)?(a=b+48|0,(c[a>>2]&-256|0)==1126902528?(c[a+4>>2]|0)==1129074247:0):0)lh(c[b+12>>2]|0);lh(mh()|0)}function lh(a){a=a|0;var b=0;b=Ja;Ja=Ja+16|0;if((Ja|0)>=(Ka|0))A(16);Qa[a&3]();Rg(10001,b)}function mh(){var a=0;a=c[1305]|0;c[1305]=a+0;return a|0}function nh(a){a=a|0;return}function oh(a){a=a|0;c[a>>2]=5312;sh(a+4|0);return}function ph(a){a=a|0;oh(a);pg(a);return}function qh(a){a=a|0;return rh(a+4|0)|0}function rh(a){a=a|0;return c[a>>2]|0}function sh(a){a=a|0;var b=0,d=0;if(vg(a)|0?(b=th(c[a>>2]|0)|0,a=b+8|0,d=c[a>>2]|0,c[a>>2]=d+-1,(d+-1|0)<0):0)pg(b);return}function th(a){a=a|0;return a+-12|0}function uh(a){a=a|0;oh(a);pg(a);return}function vh(a){a=a|0;Sg(a);pg(a);return}function wh(b,d,e,f,g,h){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;h=h|0;var i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0;if(_g(b,c[d+8>>2]|0,h)|0)bh(0,d,e,f,g);else{i=d+52|0;j=a[i>>0]|0;k=d+53|0;l=a[k>>0]|0;m=c[b+12>>2]|0;n=b+16+(m<<3)|0;a[i>>0]=0;a[k>>0]=0;Ah(b+16|0,d,e,f,g,h);a:do if((m|0)>1){o=d+24|0;p=b+8|0;q=d+54|0;r=b+24|0;do{if(a[q>>0]|0)break a;if(!(a[i>>0]|0)){if(a[k>>0]|0?(c[p>>2]&1|0)==0:0)break a}else{if((c[o>>2]|0)==1)break a;if(!(c[p>>2]&2))break a}a[i>>0]=0;a[k>>0]=0;Ah(r,d,e,f,g,h);r=r+8|0}while(r>>>0<n>>>0)}while(0);a[i>>0]=j;a[k>>0]=l}return}function xh(b,d,e,f,g){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0;a:do if(!(_g(b,c[d+8>>2]|0,g)|0)){if(!(_g(b,c[d>>2]|0,g)|0)){h=c[b+12>>2]|0;i=b+16+(h<<3)|0;Bh(b+16|0,d,e,f,g);j=b+24|0;if((h|0)<=1)break;h=c[b+8>>2]|0;if((h&2|0)==0?(k=d+36|0,(c[k>>2]|0)!=1):0){if(!(h&1)){h=d+54|0;l=j;while(1){if(a[h>>0]|0)break a;if((c[k>>2]|0)==1)break a;Bh(l,d,e,f,g);l=l+8|0;if(l>>>0>=i>>>0)break a}}l=d+24|0;h=d+54|0;m=j;while(1){if(a[h>>0]|0)break a;if((c[k>>2]|0)==1?(c[l>>2]|0)==1:0)break a;Bh(m,d,e,f,g);m=m+8|0;if(m>>>0>=i>>>0)break a}}m=d+54|0;l=j;while(1){if(a[m>>0]|0)break a;Bh(l,d,e,f,g);l=l+8|0;if(l>>>0>=i>>>0)break a}}if((c[d+16>>2]|0)!=(e|0)?(i=d+20|0,(c[i>>2]|0)!=(e|0)):0){c[d+32>>2]=f;l=d+44|0;if((c[l>>2]|0)==4)break;m=b+16+(c[b+12>>2]<<3)|0;j=d+52|0;k=d+53|0;h=d+54|0;n=b+8|0;o=d+24|0;p=0;q=b+16|0;r=0;b:while(1){if(q>>>0>=m>>>0){s=p;t=18;break}a[j>>0]=0;a[k>>0]=0;Ah(q,d,e,e,1,g);if(a[h>>0]|0){s=p;t=18;break}do if(a[k>>0]|0){if(!(a[j>>0]|0))if(!(c[n>>2]&1)){s=1;t=18;break b}else{u=1;v=r;break}if((c[o>>2]|0)==1){t=23;break b}if(!(c[n>>2]&2)){t=23;break b}else{u=1;v=1}}else{u=p;v=r}while(0);p=u;q=q+8|0;r=v}do if((t|0)==18){if((!r?(c[i>>2]=e,q=d+40|0,c[q>>2]=(c[q>>2]|0)+1,(c[d+36>>2]|0)==1):0)?(c[o>>2]|0)==2:0){a[h>>0]=1;if(s){t=23;break}else{w=4;break}}if(s)t=23;else w=4}while(0);if((t|0)==23)w=3;c[l>>2]=w;break}if((f|0)==1)c[d+32>>2]=1}else ah(0,d,e,f);while(0);return}function yh(b,d,e,f){b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0;a:do if(!(_g(b,c[d+8>>2]|0,0)|0)){g=c[b+12>>2]|0;h=b+16+(g<<3)|0;zh(b+16|0,d,e,f);if((g|0)>1){g=d+54|0;i=b+24|0;do{zh(i,d,e,f);if(a[g>>0]|0)break a;i=i+8|0}while(i>>>0<h>>>0)}}else $g(0,d,e,f);while(0);return}function zh(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0;f=c[a+4>>2]|0;g=f>>8;if(!(f&1))h=g;else h=c[(c[d>>2]|0)+g>>2]|0;g=c[a>>2]|0;Wa[c[(c[g>>2]|0)+28>>2]&15](g,b,d+h|0,(f&2|0)==0?2:e);return}function Ah(a,b,d,e,f,g){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0,j=0;h=c[a+4>>2]|0;i=h>>8;if(!(h&1))j=i;else j=c[(c[e>>2]|0)+i>>2]|0;i=c[a>>2]|0;Ya[c[(c[i>>2]|0)+20>>2]&3](i,b,d,e+j|0,(h&2|0)==0?2:f,g);return}function Bh(a,b,d,e,f){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0;g=c[a+4>>2]|0;h=g>>8;if(!(g&1))i=h;else i=c[(c[d>>2]|0)+h>>2]|0;h=c[a>>2]|0;Xa[c[(c[h>>2]|0)+24>>2]&15](h,b,d+i|0,(g&2|0)==0?2:e,f);return}function Ch(b){b=b|0;var c=0;if((a[b>>0]|0)==1)c=0;else{a[b>>0]=1;c=1}return c|0}function Dh(a){a=a|0;return}function Eh(){var a=0;a=c[3647]|0;c[3647]=a+0;return a|0}function Fh(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0;e=Ja;Ja=Ja+16|0;if((Ja|0)>=(Ka|0))A(16);f=e;c[f>>2]=c[d>>2];g=Oa[c[(c[a>>2]|0)+16>>2]&15](a,b,f)|0;if(g)c[d>>2]=c[f>>2];Ja=e;return g&1|0}function Gh(a){a=a|0;var b=0;if(!a)b=0;else b=(ch(a,3464,3552,0)|0)!=0&1;return b|0}function Hh(a,b){a=a|0;b=b|0;var c=0,d=0,e=0,f=0;c=a&65535;d=b&65535;e=v(d,c)|0;f=a>>>16;a=(e>>>16)+(v(d,f)|0)|0;d=b>>>16;b=v(d,c)|0;return (y((a>>>16)+(v(d,f)|0)+(((a&65535)+b|0)>>>16)|0),a+b<<16|e&65535|0)|0}function Ih(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;var e=0,f=0;e=a;a=c;c=Hh(e,a)|0;f=z()|0;return (y((v(b,a)|0)+(v(d,e)|0)+f|f&0|0),c|0|0)|0}function Jh(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;var e=0;e=a+c>>>0;return (y(b+d+(e>>>0<a>>>0|0)>>>0|0),e|0)|0}function Kh(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;var e=0;e=b-d>>>0;e=b-d-(c>>>0>a>>>0|0)>>>0;return (y(e|0),a-c>>>0|0)|0}function Lh(a){a=a|0;return (a?31-(w(a^a-1)|0)|0:32)|0}function Mh(a,b,d,e,f){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,x=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0;g=a;h=b;i=h;j=d;k=e;l=k;if(!i){m=(f|0)!=0;if(!l){if(m){c[f>>2]=(g>>>0)%(j>>>0);c[f+4>>2]=0}n=0;o=(g>>>0)/(j>>>0)>>>0;return (y(n|0),o)|0}else{if(!m){n=0;o=0;return (y(n|0),o)|0}c[f>>2]=a|0;c[f+4>>2]=b&0;n=0;o=0;return (y(n|0),o)|0}}m=(l|0)==0;do if(j){if(!m){p=(w(l|0)|0)-(w(i|0)|0)|0;if(p>>>0<=31){q=p+1|0;r=31-p|0;s=p-31>>31;t=q;u=g>>>(q>>>0)&s|i<<r;v=i>>>(q>>>0)&s;x=0;A=g<<r;break}if(!f){n=0;o=0;return (y(n|0),o)|0}c[f>>2]=a|0;c[f+4>>2]=h|b&0;n=0;o=0;return (y(n|0),o)|0}r=j-1|0;if(r&j|0){s=(w(j|0)|0)+33-(w(i|0)|0)|0;q=64-s|0;p=32-s|0;B=p>>31;C=s-32|0;D=C>>31;t=s;u=p-1>>31&i>>>(C>>>0)|(i<<p|g>>>(s>>>0))&D;v=D&i>>>(s>>>0);x=g<<q&B;A=(i<<q|g>>>(C>>>0))&B|g<<p&s-33>>31;break}if(f|0){c[f>>2]=r&g;c[f+4>>2]=0}if((j|0)==1){n=h|b&0;o=a|0|0;return (y(n|0),o)|0}else{r=Lh(j|0)|0;n=i>>>(r>>>0)|0;o=i<<32-r|g>>>(r>>>0)|0;return (y(n|0),o)|0}}else{if(m){if(f|0){c[f>>2]=(i>>>0)%(j>>>0);c[f+4>>2]=0}n=0;o=(i>>>0)/(j>>>0)>>>0;return (y(n|0),o)|0}if(!g){if(f|0){c[f>>2]=0;c[f+4>>2]=(i>>>0)%(l>>>0)}n=0;o=(i>>>0)/(l>>>0)>>>0;return (y(n|0),o)|0}r=l-1|0;if(!(r&l)){if(f|0){c[f>>2]=a|0;c[f+4>>2]=r&i|b&0}n=0;o=i>>>((Lh(l|0)|0)>>>0);return (y(n|0),o)|0}r=(w(l|0)|0)-(w(i|0)|0)|0;if(r>>>0<=30){s=r+1|0;p=31-r|0;t=s;u=i<<p|g>>>(s>>>0);v=i>>>(s>>>0);x=0;A=g<<p;break}if(!f){n=0;o=0;return (y(n|0),o)|0}c[f>>2]=a|0;c[f+4>>2]=h|b&0;n=0;o=0;return (y(n|0),o)|0}while(0);if(!t){E=A;F=x;G=v;H=u;I=0;J=0}else{b=d|0|0;d=k|e&0;e=Jh(b|0,d|0,-1,-1)|0;k=z()|0;h=A;A=x;x=v;v=u;u=t;t=0;do{a=h;h=A>>>31|h<<1;A=t|A<<1;g=v<<1|a>>>31|0;a=v>>>31|x<<1|0;Kh(e|0,k|0,g|0,a|0)|0;i=z()|0;l=i>>31|((i|0)<0?-1:0)<<1;t=l&1;v=Kh(g|0,a|0,l&b|0,(((i|0)<0?-1:0)>>31|((i|0)<0?-1:0)<<1)&d|0)|0;x=z()|0;u=u-1|0}while((u|0)!=0);E=h;F=A;G=x;H=v;I=0;J=t}t=F;F=0;if(f|0){c[f>>2]=H;c[f+4>>2]=G}n=(t|0)>>>31|(E|F)<<1|(F<<1|t>>>31)&0|I;o=(t<<1|0>>>31)&-2|J;return (y(n|0),o)|0}function Nh(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;return Mh(a,b,c,d,0)|0}function Oh(a,b,c){a=a|0;b=b|0;c=c|0;if((c|0)<32){y(b>>>c|0);return a>>>c|(b&(1<<c)-1)<<32-c}y(0);return b>>>c-32|0}function Ph(a,b,c){a=a|0;b=b|0;c=c|0;if((c|0)<32){y(b<<c|(a&(1<<c)-1<<32-c)>>>32-c|0);return a<<c}y(a<<c-32|0);return 0}function Qh(a){a=a|0;return (a&255)<<24|(a>>8&255)<<16|(a>>16&255)<<8|a>>>24|0}function Rh(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0;if((e|0)>=8192){ya(b|0,d|0,e|0)|0;return b|0}f=b|0;g=b+e|0;if((b&3)==(d&3)){while(b&3){if(!e)return f|0;a[b>>0]=a[d>>0]|0;b=b+1|0;d=d+1|0;e=e-1|0}h=g&-4|0;e=h-64|0;while((b|0)<=(e|0)){c[b>>2]=c[d>>2];c[b+4>>2]=c[d+4>>2];c[b+8>>2]=c[d+8>>2];c[b+12>>2]=c[d+12>>2];c[b+16>>2]=c[d+16>>2];c[b+20>>2]=c[d+20>>2];c[b+24>>2]=c[d+24>>2];c[b+28>>2]=c[d+28>>2];c[b+32>>2]=c[d+32>>2];c[b+36>>2]=c[d+36>>2];c[b+40>>2]=c[d+40>>2];c[b+44>>2]=c[d+44>>2];c[b+48>>2]=c[d+48>>2];c[b+52>>2]=c[d+52>>2];c[b+56>>2]=c[d+56>>2];c[b+60>>2]=c[d+60>>2];b=b+64|0;d=d+64|0}while((b|0)<(h|0)){c[b>>2]=c[d>>2];b=b+4|0;d=d+4|0}}else{h=g-4|0;while((b|0)<(h|0)){a[b>>0]=a[d>>0]|0;a[b+1>>0]=a[d+1>>0]|0;a[b+2>>0]=a[d+2>>0]|0;a[b+3>>0]=a[d+3>>0]|0;b=b+4|0;d=d+4|0}}while((b|0)<(g|0)){a[b>>0]=a[d>>0]|0;b=b+1|0;d=d+1|0}return f|0}function Sh(b,c,d){b=b|0;c=c|0;d=d|0;var e=0;if((c|0)<(b|0)&(b|0)<(c+d|0)){e=b;c=c+d|0;b=b+d|0;while((d|0)>0){b=b-1|0;c=c-1|0;d=d-1|0;a[b>>0]=a[c>>0]|0}b=e}else Rh(b,c,d)|0;return b|0}function Th(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0;f=b+e|0;d=d&255;if((e|0)>=67){while(b&3){a[b>>0]=d;b=b+1|0}g=f&-4|0;h=d|d<<8|d<<16|d<<24;i=g-64|0;while((b|0)<=(i|0)){c[b>>2]=h;c[b+4>>2]=h;c[b+8>>2]=h;c[b+12>>2]=h;c[b+16>>2]=h;c[b+20>>2]=h;c[b+24>>2]=h;c[b+28>>2]=h;c[b+32>>2]=h;c[b+36>>2]=h;c[b+40>>2]=h;c[b+44>>2]=h;c[b+48>>2]=h;c[b+52>>2]=h;c[b+56>>2]=h;c[b+60>>2]=h;b=b+64|0}while((b|0)<(g|0)){c[b>>2]=h;b=b+4|0}}while((b|0)<(f|0)){a[b>>0]=d;b=b+1|0}return f-e|0}function Uh(a){a=a|0;var b=0,d=0;b=c[i>>2]|0;d=b+a|0;if((a|0)>0&(d|0)<(b|0)|(d|0)<0){Ia(d|0)|0;ma(12);return -1}if((d|0)>(wa()|0)){if(!(za(d|0)|0)){ma(12);return -1}}else c[i>>2]=d;return b|0}function Vh(a,b){a=a|0;b=b|0;return Ma[a&31](b|0)|0}function Wh(a,b,c){a=a|0;b=b|0;c=c|0;return Na[a&31](b|0,c|0)|0}function Xh(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;return Oa[a&15](b|0,c|0,d|0)|0}function Yh(a,b,c,d,e){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;return Pa[a&3](b|0,c|0,d|0,e|0)|0}function Zh(a){a=a|0;Qa[a&3]()}function _h(a,b){a=a|0;b=b|0;Ra[a&127](b|0)}function $h(a,b,c,d){a=a|0;b=b|0;c=+c;d=d|0;Sa[a&1](b|0,+c,d|0)}function ai(a,b,c){a=a|0;b=b|0;c=c|0;Ta[a&15](b|0,c|0)}function bi(a,b,c,d){a=a|0;b=b|0;c=c|0;d=+d;Ua[a&3](b|0,c|0,+d)}function ci(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;Va[a&7](b|0,c|0,d|0)}function di(a,b,c,d,e){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;Wa[a&15](b|0,c|0,d|0,e|0)}function ei(a,b,c,d,e,f){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;f=f|0;Xa[a&15](b|0,c|0,d|0,e|0,f|0)}function fi(a,b,c,d,e,f,g){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;f=f|0;g=g|0;Ya[a&3](b|0,c|0,d|0,e|0,f|0,g|0)}function gi(a){a=a|0;B(0);return 0}function hi(a){a=a|0;B(17);return 0}function ii(a){a=a|0;B(18);return 0}function ji(a){a=a|0;B(19);return 0}function ki(a){a=a|0;B(20);return 0}function li(a){a=a|0;B(21);return 0}function mi(a){a=a|0;B(22);return 0}function ni(a){a=a|0;B(23);return 0}function oi(a){a=a|0;B(24);return 0}function pi(a){a=a|0;B(25);return 0}function qi(a){a=a|0;B(26);return 0}function ri(a){a=a|0;B(27);return 0}function si(a){a=a|0;B(28);return 0}function ti(a){a=a|0;B(29);return 0}function ui(a){a=a|0;B(30);return 0}function vi(a){a=a|0;B(31);return 0}function wi(a,b){a=a|0;b=b|0;C(0);return 0}function xi(a,b){a=a|0;b=b|0;C(22);return 0}function yi(a,b){a=a|0;b=b|0;C(23);return 0}function zi(a,b){a=a|0;b=b|0;C(24);return 0}function Ai(a,b){a=a|0;b=b|0;C(25);return 0}function Bi(a,b){a=a|0;b=b|0;C(26);return 0}function Ci(a,b){a=a|0;b=b|0;C(27);return 0}function Di(a,b){a=a|0;b=b|0;C(28);return 0}function Ei(a,b){a=a|0;b=b|0;C(29);return 0}function Fi(a,b){a=a|0;b=b|0;C(30);return 0}function Gi(a,b){a=a|0;b=b|0;C(31);return 0}function Hi(a,b,c){a=a|0;b=b|0;c=c|0;D(0);return 0}function Ii(a,b,c){a=a|0;b=b|0;c=c|0;D(9);return 0}function Ji(a,b,c){a=a|0;b=b|0;c=c|0;D(10);return 0}function Ki(a,b,c){a=a|0;b=b|0;c=c|0;D(11);return 0}function Li(a,b,c){a=a|0;b=b|0;c=c|0;D(12);return 0}function Mi(a,b,c){a=a|0;b=b|0;c=c|0;D(13);return 0}function Ni(a,b,c){a=a|0;b=b|0;c=c|0;D(14);return 0}function Oi(a,b,c){a=a|0;b=b|0;c=c|0;D(15);return 0}function Pi(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;E(0);return 0}function Qi(){F(0)}function Ri(a){a=a|0;G(0)}function Si(a){a=a|0;G(76)}function Ti(a){a=a|0;G(77)}function Ui(a){a=a|0;G(78)}function Vi(a){a=a|0;G(79)}function Wi(a){a=a|0;G(80)}function Xi(a){a=a|0;G(81)}function Yi(a){a=a|0;G(82)}function Zi(a){a=a|0;G(83)}function _i(a){a=a|0;G(84)}function $i(a){a=a|0;G(85)}function aj(a){a=a|0;G(86)}function bj(a){a=a|0;G(87)}function cj(a){a=a|0;G(88)}function dj(a){a=a|0;G(89)}function ej(a){a=a|0;G(90)}function fj(a){a=a|0;G(91)}function gj(a){a=a|0;G(92)}function hj(a){a=a|0;G(93)}function ij(a){a=a|0;G(94)}function jj(a){a=a|0;G(95)}function kj(a){a=a|0;G(96)}function lj(a){a=a|0;G(97)}function mj(a){a=a|0;G(98)}function nj(a){a=a|0;G(99)}function oj(a){a=a|0;G(100)}function pj(a){a=a|0;G(101)}function qj(a){a=a|0;G(102)}function rj(a){a=a|0;G(103)}function sj(a){a=a|0;G(104)}function tj(a){a=a|0;G(105)}function uj(a){a=a|0;G(106)}function vj(a){a=a|0;G(107)}function wj(a){a=a|0;G(108)}function xj(a){a=a|0;G(109)}function yj(a){a=a|0;G(110)}function zj(a){a=a|0;G(111)}function Aj(a){a=a|0;G(112)}function Bj(a){a=a|0;G(113)}function Cj(a){a=a|0;G(114)}function Dj(a){a=a|0;G(115)}function Ej(a){a=a|0;G(116)}function Fj(a){a=a|0;G(117)}function Gj(a){a=a|0;G(118)}function Hj(a){a=a|0;G(119)}function Ij(a){a=a|0;G(120)}function Jj(a){a=a|0;G(121)}function Kj(a){a=a|0;G(122)}function Lj(a){a=a|0;G(123)}function Mj(a){a=a|0;G(124)}function Nj(a){a=a|0;G(125)}function Oj(a){a=a|0;G(126)}function Pj(a){a=a|0;G(127)}function Qj(a,b,c){a=a|0;b=+b;c=c|0;H(0)}function Rj(a,b){a=a|0;b=b|0;I(0)}function Sj(a,b,c){a=a|0;b=b|0;c=+c;J(0)}function Tj(a,b,c){a=a|0;b=b|0;c=+c;J(3)}function Uj(a,b,c){a=a|0;b=b|0;c=c|0;K(0)}function Vj(a,b,c){a=a|0;b=b|0;c=c|0;K(7)}function Wj(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;L(0)}function Xj(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;L(14)}function Yj(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;L(15)}function Zj(a,b,c,d,e){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;M(0)}function _j(a,b,c,d,e){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;M(10)}function $j(a,b,c,d,e){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;M(11)}function ak(a,b,c,d,e){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;M(12)}function bk(a,b,c,d,e){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;M(13)}function ck(a,b,c,d,e){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;M(14)}function dk(a,b,c,d,e){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;M(15)}function ek(a,b,c,d,e,f){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;f=f|0;N(0)}

// EMSCRIPTEN_END_FUNCS
var Ma=[gi,Ic,Mc,Oc,bd,hd,Hd,Nd,Vd,$d,de,je,Oe,Ue,cf,jg,qh,hi,ii,ji,ki,li,mi,ni,oi,pi,qi,ri,si,ti,ui,vi];var Na=[wi,tb,Bb,Gb,Ob,Yb,ec,wc,Ec,Nc,Zc,gd,od,xd,Cd,Md,_d,ie,ue,Ce,Je,Te,xi,yi,zi,Ai,Bi,Ci,Di,Ei,Fi,Gi];var Oa=[Hi,Ab,Nb,dc,df,ef,jf,_f,Wg,Ii,Ji,Ki,Li,Mi,Ni,Oi];var Pa=[Pi,vb,Ib,_b];var Qa=[Qi,Pg,db,ih];var Ra=[Ri,mg,rb,sb,ub,Cb,Eb,Fb,Hb,Pb,Wb,Xb,Zb,fc,uc,vc,xc,Cc,Dc,Fc,Gc,Hc,Kc,Lc,Xc,Yc,_c,$c,ad,dd,ed,md,nd,pd,vd,wd,yd,Ad,Bd,Dd,Od,Gd,Jd,Kd,Ud,Xd,Yd,ce,fe,ge,se,te,ve,Ae,Be,De,He,Ie,Ke,Ve,Ne,Qe,Re,Se,hg,ig,Sg,Tg,Ug,Vg,dh,oh,ph,uh,vh,jh,Si,Ti,Ui,Vi,Wi,Xi,Yi,Zi,_i,$i,aj,bj,cj,dj,ej,fj,gj,hj,ij,jj,kj,lj,mj,nj,oj,pj,qj,rj,sj,tj,uj,vj,wj,xj,yj,zj,Aj,Bj,Cj,Dj,Ej,Fj,Gj,Hj,Ij,Jj,Kj,Lj,Mj,Nj,Oj,Pj];var Sa=[Qj,nb];var Ta=[Rj,ob,pb,xb,Kb,ac,Jc,cd,fd,Id,Ld,Wd,Zd,ee,he,Pe];var Ua=[Sj,qd,rd,Tj];var Va=[Uj,wb,Jb,$b,mc,nc,we,Vj];var Wa=[Wj,oc,pc,yc,zc,Qc,Rc,pe,qe,xe,ye,Zg,gh,yh,Xj,Yj];var Xa=[Zj,yb,zb,Lb,Mb,bc,cc,Yg,fh,xh,_j,$j,ak,bk,ck,dk];var Ya=[ek,Xg,eh,wh];return{__GLOBAL__sub_I_main_cpp:bf,___cxa_can_catch:Fh,___cxa_is_pointer_type:Gh,___em_js__getCanvasHeight:cb,___em_js__getCanvasWidth:bb,___errno_location:gf,___muldi3:Ih,___udivdi3:Nh,_bitshift64Lshr:Oh,_bitshift64Shl:Ph,_fflush:Af,_free:gg,_i64Add:Jh,_i64Subtract:Kh,_llvm_bswap_i32:Qh,_main:eb,_malloc:fg,_memcpy:Rh,_memmove:Sh,_memset:Th,_sbrk:Uh,dynCall_ii:Vh,dynCall_iii:Wh,dynCall_iiii:Xh,dynCall_iiiii:Yh,dynCall_v:Zh,dynCall_vi:_h,dynCall_vidi:$h,dynCall_vii:ai,dynCall_viid:bi,dynCall_viii:ci,dynCall_viiii:di,dynCall_viiiii:ei,dynCall_viiiiii:fi,establishStackSpace:ab,stackAlloc:Za,stackRestore:$a,stackSave:_a}})


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

