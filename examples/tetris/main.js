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

var STACK_BASE = 11440, STACK_MAX = 5254320, DYNAMIC_BASE = 5254320, DYNAMICTOP_PTR = 11184;

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

var tempDoublePtr = 11424;

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

var debug_table_ii = [ "0", "__ZNKSt3__210__function6__funcIZN10PlayTetrisC1E19TetrisConfigurationEUlvE_NS_9allocatorIS4_EEF6EntityvEE7__cloneEv", "__ZNKSt3__210__function6__funcIZN10PlayTetrisC1E19TetrisConfigurationEUlvE_NS_9allocatorIS4_EEF6EntityvEE11target_typeEv", "__ZNKSt3__210__function6__funcIZN10PlayTetrisC1E19TetrisConfigurationEUlRNS_6vectorI6EntityNS_9allocatorIS5_EEEEjjE_NS6_ISA_EEFvS9_jjEE7__cloneEv", "__ZNKSt3__210__function6__funcIZN10PlayTetrisC1E19TetrisConfigurationEUlRNS_6vectorI6EntityNS_9allocatorIS5_EEEEjjE_NS6_ISA_EEFvS9_jjEE11target_typeEv", "__ZNKSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEE7__cloneEv", "__ZNKSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEE11target_typeEv", "___stdio_close", "__ZNKSt3__217bad_function_call4whatEv", "__ZNKSt11logic_error4whatEv", "0", "0", "0", "0", "0", "0" ];

var debug_table_iii = [ "0", "__ZNKSt3__210__function6__funcIZN10PlayTetrisC1E19TetrisConfigurationEUlvE_NS_9allocatorIS4_EEF6EntityvEE6targetERKSt9type_info", "__ZNKSt3__210__function6__funcIZN10PlayTetrisC1E19TetrisConfigurationEUlRNS_6vectorI6EntityNS_9allocatorIS5_EEEEjjE_NS6_ISA_EEFvS9_jjEE6targetERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP10EntityGridNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP9ComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP13TextComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP10PlayTetrisNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEE6targetERKSt9type_info" ];

var debug_table_iiii = [ "0", "___stdio_write", "___stdio_seek", "___stdout_write", "_sn_write", "__ZNK10__cxxabiv117__class_type_info9can_catchEPKNS_16__shim_type_infoERPv", "0", "0" ];

var debug_table_v = [ "0", "__ZL25default_terminate_handlerv", "__Z9main_loopv", "__ZN10__cxxabiv112_GLOBAL__N_110construct_Ev" ];

var debug_table_vi = [ "0", "__ZNSt3__210__function6__baseIF6EntityvEED2Ev", "__ZNSt3__210__function6__funcIZN10PlayTetrisC1E19TetrisConfigurationEUlvE_NS_9allocatorIS4_EEF6EntityvEED0Ev", "__ZNSt3__210__function6__funcIZN10PlayTetrisC1E19TetrisConfigurationEUlvE_NS_9allocatorIS4_EEF6EntityvEE7destroyEv", "__ZNSt3__210__function6__funcIZN10PlayTetrisC1E19TetrisConfigurationEUlvE_NS_9allocatorIS4_EEF6EntityvEE18destroy_deallocateEv", "__ZNSt3__210__function6__baseIFvRNS_6vectorI6EntityNS_9allocatorIS3_EEEEjjEED2Ev", "__ZNSt3__210__function6__funcIZN10PlayTetrisC1E19TetrisConfigurationEUlRNS_6vectorI6EntityNS_9allocatorIS5_EEEEjjE_NS6_ISA_EEFvS9_jjEED0Ev", "__ZNSt3__210__function6__funcIZN10PlayTetrisC1E19TetrisConfigurationEUlRNS_6vectorI6EntityNS_9allocatorIS5_EEEEjjE_NS6_ISA_EEFvS9_jjEE7destroyEv", "__ZNSt3__210__function6__funcIZN10PlayTetrisC1E19TetrisConfigurationEUlRNS_6vectorI6EntityNS_9allocatorIS5_EEEEjjE_NS6_ISA_EEFvS9_jjEE18destroy_deallocateEv", "__ZNSt3__214__shared_countD2Ev", "__ZNSt3__220__shared_ptr_pointerIP10EntityGridNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP10EntityGridNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP10EntityGridNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__220__shared_ptr_pointerIP9ComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP9ComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP9ComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__220__shared_ptr_pointerIP13TextComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP13TextComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP13TextComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__220__shared_ptr_pointerIP10PlayTetrisNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP10PlayTetrisNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP10PlayTetrisNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__210__function6__baseIFvvEED2Ev", "__ZNSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEED0Ev", "__ZNSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEE7destroyEv", "__ZNSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEE18destroy_deallocateEv", "__ZNSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEEclEv", "__ZNSt3__217bad_function_callD2Ev", "__ZNSt3__217bad_function_callD0Ev", "__ZN10__cxxabiv116__shim_type_infoD2Ev", "__ZN10__cxxabiv117__class_type_infoD0Ev", "__ZNK10__cxxabiv116__shim_type_info5noop1Ev", "__ZNK10__cxxabiv116__shim_type_info5noop2Ev", "__ZN10__cxxabiv120__si_class_type_infoD0Ev", "__ZNSt11logic_errorD2Ev", "__ZNSt11logic_errorD0Ev", "__ZNSt12length_errorD0Ev", "__ZN10__cxxabiv121__vmi_class_type_infoD0Ev", "__ZN10__cxxabiv112_GLOBAL__N_19destruct_EPv", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0" ];

var debug_table_vidi = [ "0", "__ZN10PlayTetris4loopEfRKNSt3__26vectorIbNS0_9allocatorIbEEEE", "__ZN6Screen4loopEfRKNSt3__26vectorIbNS0_9allocatorIbEEEE", "0" ];

var debug_table_vii = [ "0", "__ZN6Screen7onKeyUpEi", "__ZN10PlayTetris9onKeyDownEi", "__ZN6Screen9onKeyDownEi", "__ZNKSt3__210__function6__funcIZN10PlayTetrisC1E19TetrisConfigurationEUlvE_NS_9allocatorIS4_EEF6EntityvEE7__cloneEPNS0_6__baseIS8_EE", "__ZNSt3__210__function6__funcIZN10PlayTetrisC1E19TetrisConfigurationEUlvE_NS_9allocatorIS4_EEF6EntityvEEclEv", "__ZNKSt3__210__function6__funcIZN10PlayTetrisC1E19TetrisConfigurationEUlRNS_6vectorI6EntityNS_9allocatorIS5_EEEEjjE_NS6_ISA_EEFvS9_jjEE7__cloneEPNS0_6__baseISC_EE", "__ZNKSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEE7__cloneEPNS0_6__baseIS5_EE" ];

var debug_table_viid = [ "0" ];

var debug_table_viii = [ "0", "__ZN9Component11setSizeModeERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEENS_8SizeModeE", "__ZN9Component8addChildERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEENS0_10shared_ptrIS_EE", "__ZN13TextComponent11setSizeModeERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEEN9Component8SizeModeE" ];

var debug_table_viiii = [ "0", "__ZNSt3__210__function6__funcIZN10PlayTetrisC1E19TetrisConfigurationEUlRNS_6vectorI6EntityNS_9allocatorIS5_EEEEjjE_NS6_ISA_EEFvS9_jjEEclES9_OjSE_", "__ZN13DrawComponent8doLayoutERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN13DrawComponent16doLayoutEntitiesERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN9Component8doLayoutERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN9Component16doLayoutEntitiesERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN13TextComponent8doLayoutERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN13TextComponent16doLayoutEntitiesERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZNK10__cxxabiv117__class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi", "__ZNK10__cxxabiv120__si_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi", "__ZNK10__cxxabiv121__vmi_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi", "0", "0", "0", "0", "0" ];

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
 "z": _Engine_StrokeRectangle,
 "A": _SDL_GetTicks,
 "B": _SDL_Init,
 "C": _SDL_LockSurface,
 "D": _SDL_PollEvent,
 "E": _SDL_SetVideoMode,
 "F": __ZSt18uncaught_exceptionv,
 "G": ___cxa_allocate_exception,
 "H": ___cxa_begin_catch,
 "I": ___cxa_find_matching_catch,
 "J": ___cxa_free_exception,
 "K": ___cxa_throw,
 "L": ___gxx_personality_v0,
 "M": ___lock,
 "N": ___resumeException,
 "O": ___setErrNo,
 "P": ___syscall140,
 "Q": ___syscall146,
 "R": ___syscall221,
 "S": ___syscall3,
 "T": ___syscall5,
 "U": ___syscall54,
 "V": ___syscall6,
 "W": ___unlock,
 "X": _abort,
 "Y": _emscripten_get_heap_size,
 "Z": _emscripten_get_now,
 "_": _emscripten_memcpy_big,
 "$": _emscripten_resize_heap,
 "aa": _emscripten_set_main_loop,
 "ab": _emscripten_set_main_loop_timing,
 "ac": _getCanvasHeight,
 "ad": _getCanvasWidth,
 "ae": _pthread_getspecific,
 "af": _pthread_key_create,
 "ag": _pthread_once,
 "ah": _pthread_setspecific,
 "ai": abortOnCannotGrowMemory,
 "aj": tempDoublePtr,
 "ak": DYNAMICTOP_PTR
};

// EMSCRIPTEN_START_ASM


var asm = (/** @suppress {uselessCode} */ function(global,env,buffer) {
"use asm";var a=new global.Int8Array(buffer),b=new global.Int16Array(buffer),c=new global.Int32Array(buffer),d=new global.Uint8Array(buffer),e=new global.Uint16Array(buffer),f=new global.Float32Array(buffer),g=new global.Float64Array(buffer),h=env.aj|0,i=env.ak|0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0.0,r=global.Math.floor,s=global.Math.ceil,t=global.Math.imul,u=global.Math.clz32,v=env.a,w=env.b,x=env.c,y=env.d,z=env.e,A=env.f,B=env.g,C=env.h,D=env.i,E=env.j,F=env.k,G=env.l,H=env.m,I=env.n,J=env.o,K=env.p,L=env.q,M=env.r,N=env.s,O=env.t,P=env.u,Q=env.v,R=env.w,S=env.x,T=env.y,U=env.z,V=env.A,W=env.B,X=env.C,Y=env.D,Z=env.E,_=env.F,$=env.G,aa=env.H,ba=env.I,ca=env.J,da=env.K,ea=env.L,fa=env.M,ga=env.N,ha=env.O,ia=env.P,ja=env.Q,ka=env.R,la=env.S,ma=env.T,na=env.U,oa=env.V,pa=env.W,qa=env.X,ra=env.Y,sa=env.Z,ta=env._,ua=env.$,va=env.aa,wa=env.ab,xa=env.ac,ya=env.ad,za=env.ae,Aa=env.af,Ba=env.ag,Ca=env.ah,Da=env.ai,Ea=11440,Fa=5254320,Ga=0.0;
// EMSCRIPTEN_START_FUNCS
function Ta(a){a=a|0;var b=0;b=Ea;Ea=Ea+a|0;Ea=Ea+15&-16;if((Ea|0)>=(Fa|0))y(a|0);return b|0}function Ua(){return Ea|0}function Va(a){a=a|0;Ea=a}function Wa(a,b){a=a|0;b=b|0;Ea=a;Fa=b}function Xa(){return 4384}function Ya(){return 4482}function Za(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,z=0,A=0,B=0;b=Ea;Ea=Ea+432|0;if((Ea|0)>=(Fa|0))y(432);d=b+336|0;e=b+288|0;f=b+240|0;g=b+192|0;h=b+144|0;i=b+96|0;j=b+48|0;k=b;c[e>>2]=0;l=e+4|0;c[l>>2]=0;m=e+8|0;c[m>>2]=0;n=me(16)|0;c[e>>2]=n;o=n+16|0;c[m>>2]=o;c[n>>2]=0;c[n+4>>2]=1;c[n+8>>2]=0;c[n+12>>2]=0;c[l>>2]=o;o=e+12|0;c[o>>2]=0;l=e+16|0;c[l>>2]=0;m=e+20|0;c[m>>2]=0;p=me(16)|0;c[o>>2]=p;o=p+16|0;c[m>>2]=o;c[p>>2]=0;c[p+4>>2]=1;c[p+8>>2]=0;c[p+12>>2]=0;c[l>>2]=o;o=e+24|0;c[o>>2]=0;l=e+28|0;c[l>>2]=0;m=e+32|0;c[m>>2]=0;q=me(16)|0;c[o>>2]=q;o=q+16|0;c[m>>2]=o;c[q>>2]=0;c[q+4>>2]=1;c[q+8>>2]=1;c[q+12>>2]=0;c[l>>2]=o;o=e+36|0;c[o>>2]=0;l=e+40|0;c[l>>2]=0;m=e+44|0;c[m>>2]=0;r=me(16)|0;c[o>>2]=r;o=r+16|0;c[m>>2]=o;c[r>>2]=0;c[r+4>>2]=0;c[r+8>>2]=0;c[r+12>>2]=0;c[l>>2]=o;c[d>>2]=0;o=d+4|0;c[o>>2]=0;l=d+8|0;c[l>>2]=0;m=me(48)|0;c[o>>2]=m;c[d>>2]=m;c[l>>2]=m+48;c[m>>2]=0;l=m+4|0;c[l>>2]=0;s=m+8|0;c[s>>2]=0;t=me(16)|0;c[m>>2]=t;c[s>>2]=t+16;c[t>>2]=c[n>>2];c[t+4>>2]=c[n+4>>2];c[t+8>>2]=c[n+8>>2];c[t+12>>2]=c[n+12>>2];c[l>>2]=t+16;t=m+12|0;c[o>>2]=t;c[t>>2]=0;l=m+16|0;c[l>>2]=0;n=m+20|0;c[n>>2]=0;s=me(16)|0;c[t>>2]=s;c[n>>2]=s+16;c[s>>2]=c[p>>2];c[s+4>>2]=c[p+4>>2];c[s+8>>2]=c[p+8>>2];c[s+12>>2]=c[p+12>>2];c[l>>2]=s+16;s=m+24|0;c[o>>2]=s;c[s>>2]=0;l=m+28|0;c[l>>2]=0;p=m+32|0;c[p>>2]=0;n=me(16)|0;c[s>>2]=n;c[p>>2]=n+16;c[n>>2]=c[q>>2];c[n+4>>2]=c[q+4>>2];c[n+8>>2]=c[q+8>>2];c[n+12>>2]=c[q+12>>2];c[l>>2]=n+16;n=m+36|0;c[o>>2]=n;c[n>>2]=0;l=m+40|0;c[l>>2]=0;q=m+44|0;c[q>>2]=0;p=me(16)|0;c[n>>2]=p;c[q>>2]=p+16;c[p>>2]=c[r>>2];c[p+4>>2]=c[r+4>>2];c[p+8>>2]=c[r+8>>2];c[p+12>>2]=c[r+12>>2];c[l>>2]=p+16;c[o>>2]=m+48;m=d+12|0;c[f>>2]=0;o=f+4|0;c[o>>2]=0;p=f+8|0;c[p>>2]=0;l=me(16)|0;c[f>>2]=l;r=l+16|0;c[p>>2]=r;c[l>>2]=0;c[l+4>>2]=0;c[l+8>>2]=1;c[l+12>>2]=0;c[o>>2]=r;r=f+12|0;c[r>>2]=0;o=f+16|0;c[o>>2]=0;p=f+20|0;c[p>>2]=0;q=me(16)|0;c[r>>2]=q;r=q+16|0;c[p>>2]=r;c[q>>2]=0;c[q+4>>2]=0;c[q+8>>2]=1;c[q+12>>2]=0;c[o>>2]=r;r=f+24|0;c[r>>2]=0;o=f+28|0;c[o>>2]=0;p=f+32|0;c[p>>2]=0;n=me(16)|0;c[r>>2]=n;r=n+16|0;c[p>>2]=r;c[n>>2]=0;c[n+4>>2]=1;c[n+8>>2]=1;c[n+12>>2]=0;c[o>>2]=r;r=f+36|0;c[r>>2]=0;o=f+40|0;c[o>>2]=0;p=f+44|0;c[p>>2]=0;s=me(16)|0;c[r>>2]=s;r=s+16|0;c[p>>2]=r;c[s>>2]=0;c[s+4>>2]=0;c[s+8>>2]=0;c[s+12>>2]=0;c[o>>2]=r;c[m>>2]=0;r=d+16|0;c[r>>2]=0;o=d+20|0;c[o>>2]=0;p=me(48)|0;c[r>>2]=p;c[m>>2]=p;c[o>>2]=p+48;c[p>>2]=0;o=p+4|0;c[o>>2]=0;m=p+8|0;c[m>>2]=0;t=me(16)|0;c[p>>2]=t;c[m>>2]=t+16;c[t>>2]=c[l>>2];c[t+4>>2]=c[l+4>>2];c[t+8>>2]=c[l+8>>2];c[t+12>>2]=c[l+12>>2];c[o>>2]=t+16;t=p+12|0;c[r>>2]=t;c[t>>2]=0;o=p+16|0;c[o>>2]=0;l=p+20|0;c[l>>2]=0;m=me(16)|0;c[t>>2]=m;c[l>>2]=m+16;c[m>>2]=c[q>>2];c[m+4>>2]=c[q+4>>2];c[m+8>>2]=c[q+8>>2];c[m+12>>2]=c[q+12>>2];c[o>>2]=m+16;m=p+24|0;c[r>>2]=m;c[m>>2]=0;o=p+28|0;c[o>>2]=0;q=p+32|0;c[q>>2]=0;l=me(16)|0;c[m>>2]=l;c[q>>2]=l+16;c[l>>2]=c[n>>2];c[l+4>>2]=c[n+4>>2];c[l+8>>2]=c[n+8>>2];c[l+12>>2]=c[n+12>>2];c[o>>2]=l+16;l=p+36|0;c[r>>2]=l;c[l>>2]=0;o=p+40|0;c[o>>2]=0;n=p+44|0;c[n>>2]=0;q=me(16)|0;c[l>>2]=q;c[n>>2]=q+16;c[q>>2]=c[s>>2];c[q+4>>2]=c[s+4>>2];c[q+8>>2]=c[s+8>>2];c[q+12>>2]=c[s+12>>2];c[o>>2]=q+16;c[r>>2]=p+48;p=d+24|0;c[g>>2]=0;r=g+4|0;c[r>>2]=0;q=g+8|0;c[q>>2]=0;o=me(16)|0;c[g>>2]=o;s=o+16|0;c[q>>2]=s;c[o>>2]=0;c[o+4>>2]=0;c[o+8>>2]=0;c[o+12>>2]=0;c[r>>2]=s;s=g+12|0;c[s>>2]=0;r=g+16|0;c[r>>2]=0;q=g+20|0;c[q>>2]=0;n=me(16)|0;c[s>>2]=n;s=n+16|0;c[q>>2]=s;c[n>>2]=0;c[n+4>>2]=1;c[n+8>>2]=0;c[n+12>>2]=0;c[r>>2]=s;s=g+24|0;c[s>>2]=0;r=g+28|0;c[r>>2]=0;q=g+32|0;c[q>>2]=0;l=me(16)|0;c[s>>2]=l;s=l+16|0;c[q>>2]=s;c[l>>2]=1;c[l+4>>2]=1;c[l+8>>2]=1;c[l+12>>2]=0;c[r>>2]=s;s=g+36|0;c[s>>2]=0;r=g+40|0;c[r>>2]=0;q=g+44|0;c[q>>2]=0;m=me(16)|0;c[s>>2]=m;s=m+16|0;c[q>>2]=s;c[m>>2]=0;c[m+4>>2]=0;c[m+8>>2]=0;c[m+12>>2]=0;c[r>>2]=s;c[p>>2]=0;s=d+28|0;c[s>>2]=0;r=d+32|0;c[r>>2]=0;q=me(48)|0;c[s>>2]=q;c[p>>2]=q;c[r>>2]=q+48;c[q>>2]=0;r=q+4|0;c[r>>2]=0;p=q+8|0;c[p>>2]=0;t=me(16)|0;c[q>>2]=t;c[p>>2]=t+16;c[t>>2]=c[o>>2];c[t+4>>2]=c[o+4>>2];c[t+8>>2]=c[o+8>>2];c[t+12>>2]=c[o+12>>2];c[r>>2]=t+16;t=q+12|0;c[s>>2]=t;c[t>>2]=0;r=q+16|0;c[r>>2]=0;o=q+20|0;c[o>>2]=0;p=me(16)|0;c[t>>2]=p;c[o>>2]=p+16;c[p>>2]=c[n>>2];c[p+4>>2]=c[n+4>>2];c[p+8>>2]=c[n+8>>2];c[p+12>>2]=c[n+12>>2];c[r>>2]=p+16;p=q+24|0;c[s>>2]=p;c[p>>2]=0;r=q+28|0;c[r>>2]=0;n=q+32|0;c[n>>2]=0;o=me(16)|0;c[p>>2]=o;c[n>>2]=o+16;c[o>>2]=c[l>>2];c[o+4>>2]=c[l+4>>2];c[o+8>>2]=c[l+8>>2];c[o+12>>2]=c[l+12>>2];c[r>>2]=o+16;o=q+36|0;c[s>>2]=o;c[o>>2]=0;r=q+40|0;c[r>>2]=0;l=q+44|0;c[l>>2]=0;n=me(16)|0;c[o>>2]=n;c[l>>2]=n+16;c[n>>2]=c[m>>2];c[n+4>>2]=c[m+4>>2];c[n+8>>2]=c[m+8>>2];c[n+12>>2]=c[m+12>>2];c[r>>2]=n+16;c[s>>2]=q+48;q=d+36|0;c[h>>2]=0;s=h+4|0;c[s>>2]=0;n=h+8|0;c[n>>2]=0;r=me(16)|0;c[h>>2]=r;m=r+16|0;c[n>>2]=m;c[r>>2]=0;c[r+4>>2]=0;c[r+8>>2]=0;c[r+12>>2]=0;c[s>>2]=m;m=h+12|0;c[m>>2]=0;s=h+16|0;c[s>>2]=0;n=h+20|0;c[n>>2]=0;l=me(16)|0;c[m>>2]=l;m=l+16|0;c[n>>2]=m;c[l>>2]=1;c[l+4>>2]=1;c[l+8>>2]=0;c[l+12>>2]=0;c[s>>2]=m;m=h+24|0;c[m>>2]=0;s=h+28|0;c[s>>2]=0;n=h+32|0;c[n>>2]=0;o=me(16)|0;c[m>>2]=o;m=o+16|0;c[n>>2]=m;c[o>>2]=0;c[o+4>>2]=1;c[o+8>>2]=1;c[o+12>>2]=0;c[s>>2]=m;m=h+36|0;c[m>>2]=0;s=h+40|0;c[s>>2]=0;n=h+44|0;c[n>>2]=0;p=me(16)|0;c[m>>2]=p;m=p+16|0;c[n>>2]=m;c[p>>2]=0;c[p+4>>2]=0;c[p+8>>2]=0;c[p+12>>2]=0;c[s>>2]=m;c[q>>2]=0;m=d+40|0;c[m>>2]=0;s=d+44|0;c[s>>2]=0;n=me(48)|0;c[m>>2]=n;c[q>>2]=n;c[s>>2]=n+48;c[n>>2]=0;s=n+4|0;c[s>>2]=0;q=n+8|0;c[q>>2]=0;t=me(16)|0;c[n>>2]=t;c[q>>2]=t+16;c[t>>2]=c[r>>2];c[t+4>>2]=c[r+4>>2];c[t+8>>2]=c[r+8>>2];c[t+12>>2]=c[r+12>>2];c[s>>2]=t+16;t=n+12|0;c[m>>2]=t;c[t>>2]=0;s=n+16|0;c[s>>2]=0;r=n+20|0;c[r>>2]=0;q=me(16)|0;c[t>>2]=q;c[r>>2]=q+16;c[q>>2]=c[l>>2];c[q+4>>2]=c[l+4>>2];c[q+8>>2]=c[l+8>>2];c[q+12>>2]=c[l+12>>2];c[s>>2]=q+16;q=n+24|0;c[m>>2]=q;c[q>>2]=0;s=n+28|0;c[s>>2]=0;l=n+32|0;c[l>>2]=0;r=me(16)|0;c[q>>2]=r;c[l>>2]=r+16;c[r>>2]=c[o>>2];c[r+4>>2]=c[o+4>>2];c[r+8>>2]=c[o+8>>2];c[r+12>>2]=c[o+12>>2];c[s>>2]=r+16;r=n+36|0;c[m>>2]=r;c[r>>2]=0;s=n+40|0;c[s>>2]=0;o=n+44|0;c[o>>2]=0;l=me(16)|0;c[r>>2]=l;c[o>>2]=l+16;c[l>>2]=c[p>>2];c[l+4>>2]=c[p+4>>2];c[l+8>>2]=c[p+8>>2];c[l+12>>2]=c[p+12>>2];c[s>>2]=l+16;c[m>>2]=n+48;n=d+48|0;c[i>>2]=0;m=i+4|0;c[m>>2]=0;l=i+8|0;c[l>>2]=0;s=me(16)|0;c[i>>2]=s;p=s+16|0;c[l>>2]=p;c[s>>2]=0;c[s+4>>2]=0;c[s+8>>2]=0;c[s+12>>2]=0;c[m>>2]=p;p=i+12|0;c[p>>2]=0;m=i+16|0;c[m>>2]=0;l=i+20|0;c[l>>2]=0;o=me(16)|0;c[p>>2]=o;p=o+16|0;c[l>>2]=p;c[o>>2]=0;c[o+4>>2]=1;c[o+8>>2]=1;c[o+12>>2]=0;c[m>>2]=p;p=i+24|0;c[p>>2]=0;m=i+28|0;c[m>>2]=0;l=i+32|0;c[l>>2]=0;r=me(16)|0;c[p>>2]=r;p=r+16|0;c[l>>2]=p;c[r>>2]=1;c[r+4>>2]=1;c[r+8>>2]=0;c[r+12>>2]=0;c[m>>2]=p;p=i+36|0;c[p>>2]=0;m=i+40|0;c[m>>2]=0;l=i+44|0;c[l>>2]=0;q=me(16)|0;c[p>>2]=q;p=q+16|0;c[l>>2]=p;c[q>>2]=0;c[q+4>>2]=0;c[q+8>>2]=0;c[q+12>>2]=0;c[m>>2]=p;c[n>>2]=0;p=d+52|0;c[p>>2]=0;m=d+56|0;c[m>>2]=0;l=me(48)|0;c[p>>2]=l;c[n>>2]=l;c[m>>2]=l+48;c[l>>2]=0;m=l+4|0;c[m>>2]=0;n=l+8|0;c[n>>2]=0;t=me(16)|0;c[l>>2]=t;c[n>>2]=t+16;c[t>>2]=c[s>>2];c[t+4>>2]=c[s+4>>2];c[t+8>>2]=c[s+8>>2];c[t+12>>2]=c[s+12>>2];c[m>>2]=t+16;t=l+12|0;c[p>>2]=t;c[t>>2]=0;m=l+16|0;c[m>>2]=0;s=l+20|0;c[s>>2]=0;n=me(16)|0;c[t>>2]=n;c[s>>2]=n+16;c[n>>2]=c[o>>2];c[n+4>>2]=c[o+4>>2];c[n+8>>2]=c[o+8>>2];c[n+12>>2]=c[o+12>>2];c[m>>2]=n+16;n=l+24|0;c[p>>2]=n;c[n>>2]=0;m=l+28|0;c[m>>2]=0;o=l+32|0;c[o>>2]=0;s=me(16)|0;c[n>>2]=s;c[o>>2]=s+16;c[s>>2]=c[r>>2];c[s+4>>2]=c[r+4>>2];c[s+8>>2]=c[r+8>>2];c[s+12>>2]=c[r+12>>2];c[m>>2]=s+16;s=l+36|0;c[p>>2]=s;c[s>>2]=0;m=l+40|0;c[m>>2]=0;r=l+44|0;c[r>>2]=0;o=me(16)|0;c[s>>2]=o;c[r>>2]=o+16;c[o>>2]=c[q>>2];c[o+4>>2]=c[q+4>>2];c[o+8>>2]=c[q+8>>2];c[o+12>>2]=c[q+12>>2];c[m>>2]=o+16;c[p>>2]=l+48;l=d+60|0;c[j>>2]=0;p=j+4|0;c[p>>2]=0;o=j+8|0;c[o>>2]=0;m=me(16)|0;c[j>>2]=m;q=m+16|0;c[o>>2]=q;c[m>>2]=0;c[m+4>>2]=0;c[m+8>>2]=0;c[m+12>>2]=0;c[p>>2]=q;q=j+12|0;c[q>>2]=0;p=j+16|0;c[p>>2]=0;o=j+20|0;c[o>>2]=0;r=me(16)|0;c[q>>2]=r;q=r+16|0;c[o>>2]=q;c[r>>2]=0;c[r+4>>2]=1;c[r+8>>2]=1;c[r+12>>2]=0;c[p>>2]=q;q=j+24|0;c[q>>2]=0;p=j+28|0;c[p>>2]=0;o=j+32|0;c[o>>2]=0;s=me(16)|0;c[q>>2]=s;q=s+16|0;c[o>>2]=q;c[s>>2]=0;c[s+4>>2]=1;c[s+8>>2]=1;c[s+12>>2]=0;c[p>>2]=q;q=j+36|0;c[q>>2]=0;p=j+40|0;c[p>>2]=0;o=j+44|0;c[o>>2]=0;n=me(16)|0;c[q>>2]=n;q=n+16|0;c[o>>2]=q;c[n>>2]=0;c[n+4>>2]=0;c[n+8>>2]=0;c[n+12>>2]=0;c[p>>2]=q;c[l>>2]=0;q=d+64|0;c[q>>2]=0;p=d+68|0;c[p>>2]=0;o=me(48)|0;c[q>>2]=o;c[l>>2]=o;c[p>>2]=o+48;c[o>>2]=0;p=o+4|0;c[p>>2]=0;l=o+8|0;c[l>>2]=0;t=me(16)|0;c[o>>2]=t;c[l>>2]=t+16;c[t>>2]=c[m>>2];c[t+4>>2]=c[m+4>>2];c[t+8>>2]=c[m+8>>2];c[t+12>>2]=c[m+12>>2];c[p>>2]=t+16;t=o+12|0;c[q>>2]=t;c[t>>2]=0;p=o+16|0;c[p>>2]=0;m=o+20|0;c[m>>2]=0;l=me(16)|0;c[t>>2]=l;c[m>>2]=l+16;c[l>>2]=c[r>>2];c[l+4>>2]=c[r+4>>2];c[l+8>>2]=c[r+8>>2];c[l+12>>2]=c[r+12>>2];c[p>>2]=l+16;l=o+24|0;c[q>>2]=l;c[l>>2]=0;p=o+28|0;c[p>>2]=0;r=o+32|0;c[r>>2]=0;m=me(16)|0;c[l>>2]=m;c[r>>2]=m+16;c[m>>2]=c[s>>2];c[m+4>>2]=c[s+4>>2];c[m+8>>2]=c[s+8>>2];c[m+12>>2]=c[s+12>>2];c[p>>2]=m+16;m=o+36|0;c[q>>2]=m;c[m>>2]=0;p=o+40|0;c[p>>2]=0;s=o+44|0;c[s>>2]=0;r=me(16)|0;c[m>>2]=r;c[s>>2]=r+16;c[r>>2]=c[n>>2];c[r+4>>2]=c[n+4>>2];c[r+8>>2]=c[n+8>>2];c[r+12>>2]=c[n+12>>2];c[p>>2]=r+16;c[q>>2]=o+48;o=d+72|0;c[k>>2]=0;q=k+4|0;c[q>>2]=0;r=k+8|0;c[r>>2]=0;p=me(16)|0;c[k>>2]=p;n=p+16|0;c[r>>2]=n;c[p>>2]=0;c[p+4>>2]=0;c[p+8>>2]=0;c[p+12>>2]=0;c[q>>2]=n;n=k+12|0;c[n>>2]=0;q=k+16|0;c[q>>2]=0;r=k+20|0;c[r>>2]=0;s=me(16)|0;c[n>>2]=s;n=s+16|0;c[r>>2]=n;c[s>>2]=0;c[s+4>>2]=0;c[s+8>>2]=0;c[s+12>>2]=0;c[q>>2]=n;n=k+24|0;c[n>>2]=0;q=k+28|0;c[q>>2]=0;r=k+32|0;c[r>>2]=0;m=me(16)|0;c[n>>2]=m;n=m+16|0;c[r>>2]=n;c[m>>2]=1;c[m+4>>2]=1;c[m+8>>2]=1;c[m+12>>2]=1;c[q>>2]=n;n=k+36|0;c[n>>2]=0;q=k+40|0;c[q>>2]=0;r=k+44|0;c[r>>2]=0;l=me(16)|0;c[n>>2]=l;n=l+16|0;c[r>>2]=n;c[l>>2]=0;c[l+4>>2]=0;c[l+8>>2]=0;c[l+12>>2]=0;c[q>>2]=n;c[o>>2]=0;n=d+76|0;c[n>>2]=0;q=d+80|0;c[q>>2]=0;r=me(48)|0;c[n>>2]=r;c[o>>2]=r;c[q>>2]=r+48;c[r>>2]=0;q=r+4|0;c[q>>2]=0;o=r+8|0;c[o>>2]=0;t=me(16)|0;c[r>>2]=t;c[o>>2]=t+16;c[t>>2]=c[p>>2];c[t+4>>2]=c[p+4>>2];c[t+8>>2]=c[p+8>>2];c[t+12>>2]=c[p+12>>2];c[q>>2]=t+16;t=r+12|0;c[n>>2]=t;c[t>>2]=0;q=r+16|0;c[q>>2]=0;p=r+20|0;c[p>>2]=0;o=me(16)|0;c[t>>2]=o;c[p>>2]=o+16;c[o>>2]=c[s>>2];c[o+4>>2]=c[s+4>>2];c[o+8>>2]=c[s+8>>2];c[o+12>>2]=c[s+12>>2];c[q>>2]=o+16;o=r+24|0;c[n>>2]=o;c[o>>2]=0;q=r+28|0;c[q>>2]=0;s=r+32|0;c[s>>2]=0;p=me(16)|0;c[o>>2]=p;c[s>>2]=p+16;c[p>>2]=c[m>>2];c[p+4>>2]=c[m+4>>2];c[p+8>>2]=c[m+8>>2];c[p+12>>2]=c[m+12>>2];c[q>>2]=p+16;p=r+36|0;c[n>>2]=p;c[p>>2]=0;q=r+40|0;c[q>>2]=0;m=r+44|0;c[m>>2]=0;s=me(16)|0;c[p>>2]=s;c[m>>2]=s+16;c[s>>2]=c[l>>2];c[s+4>>2]=c[l+4>>2];c[s+8>>2]=c[l+8>>2];c[s+12>>2]=c[l+12>>2];c[q>>2]=s+16;c[n>>2]=r+48;c[a>>2]=0;r=a+4|0;c[r>>2]=0;n=a+8|0;c[n>>2]=0;s=me(84)|0;c[r>>2]=s;c[a>>2]=s;c[n>>2]=s+84;sb(s,d);n=s+12|0;c[r>>2]=n;sb(n,d+12|0);n=s+24|0;c[r>>2]=n;sb(n,d+24|0);n=s+36|0;c[r>>2]=n;sb(n,d+36|0);n=s+48|0;c[r>>2]=n;sb(n,d+48|0);n=s+60|0;c[r>>2]=n;sb(n,d+60|0);n=s+72|0;c[r>>2]=n;sb(n,d+72|0);c[r>>2]=s+84;s=d+72|0;r=c[s>>2]|0;if(r|0){n=d+76|0;a=c[n>>2]|0;if((a|0)==(r|0))u=r;else{q=a;do{a=q;q=q+-12|0;l=c[q>>2]|0;if(l|0){c[a+-8>>2]=l;ne(l)}}while((q|0)!=(r|0));u=c[s>>2]|0}c[n>>2]=r;ne(u)}u=d+60|0;r=c[u>>2]|0;if(r|0){n=d+64|0;s=c[n>>2]|0;if((s|0)==(r|0))v=r;else{q=s;do{s=q;q=q+-12|0;l=c[q>>2]|0;if(l|0){c[s+-8>>2]=l;ne(l)}}while((q|0)!=(r|0));v=c[u>>2]|0}c[n>>2]=r;ne(v)}v=d+48|0;r=c[v>>2]|0;if(r|0){n=d+52|0;u=c[n>>2]|0;if((u|0)==(r|0))w=r;else{q=u;do{u=q;q=q+-12|0;l=c[q>>2]|0;if(l|0){c[u+-8>>2]=l;ne(l)}}while((q|0)!=(r|0));w=c[v>>2]|0}c[n>>2]=r;ne(w)}w=d+36|0;r=c[w>>2]|0;if(r|0){n=d+40|0;v=c[n>>2]|0;if((v|0)==(r|0))x=r;else{q=v;do{v=q;q=q+-12|0;l=c[q>>2]|0;if(l|0){c[v+-8>>2]=l;ne(l)}}while((q|0)!=(r|0));x=c[w>>2]|0}c[n>>2]=r;ne(x)}x=d+24|0;r=c[x>>2]|0;if(r|0){n=d+28|0;w=c[n>>2]|0;if((w|0)==(r|0))z=r;else{q=w;do{w=q;q=q+-12|0;l=c[q>>2]|0;if(l|0){c[w+-8>>2]=l;ne(l)}}while((q|0)!=(r|0));z=c[x>>2]|0}c[n>>2]=r;ne(z)}z=d+12|0;r=c[z>>2]|0;if(r|0){n=d+16|0;x=c[n>>2]|0;if((x|0)==(r|0))A=r;else{q=x;do{x=q;q=q+-12|0;l=c[q>>2]|0;if(l|0){c[x+-8>>2]=l;ne(l)}}while((q|0)!=(r|0));A=c[z>>2]|0}c[n>>2]=r;ne(A)}A=c[d>>2]|0;if(A|0){r=d+4|0;n=c[r>>2]|0;if((n|0)==(A|0))B=A;else{z=n;do{n=z;z=z+-12|0;q=c[z>>2]|0;if(q|0){c[n+-8>>2]=q;ne(q)}}while((z|0)!=(A|0));B=c[d>>2]|0}c[r>>2]=A;ne(B)}B=c[k+36>>2]|0;if(B|0){c[k+40>>2]=B;ne(B)}B=c[k+24>>2]|0;if(B|0){c[k+28>>2]=B;ne(B)}B=c[k+12>>2]|0;if(B|0){c[k+16>>2]=B;ne(B)}B=c[k>>2]|0;if(B|0){c[k+4>>2]=B;ne(B)}B=c[j+36>>2]|0;if(B|0){c[j+40>>2]=B;ne(B)}B=c[j+24>>2]|0;if(B|0){c[j+28>>2]=B;ne(B)}B=c[j+12>>2]|0;if(B|0){c[j+16>>2]=B;ne(B)}B=c[j>>2]|0;if(B|0){c[j+4>>2]=B;ne(B)}B=c[i+36>>2]|0;if(B|0){c[i+40>>2]=B;ne(B)}B=c[i+24>>2]|0;if(B|0){c[i+28>>2]=B;ne(B)}B=c[i+12>>2]|0;if(B|0){c[i+16>>2]=B;ne(B)}B=c[i>>2]|0;if(B|0){c[i+4>>2]=B;ne(B)}B=c[h+36>>2]|0;if(B|0){c[h+40>>2]=B;ne(B)}B=c[h+24>>2]|0;if(B|0){c[h+28>>2]=B;ne(B)}B=c[h+12>>2]|0;if(B|0){c[h+16>>2]=B;ne(B)}B=c[h>>2]|0;if(B|0){c[h+4>>2]=B;ne(B)}B=c[g+36>>2]|0;if(B|0){c[g+40>>2]=B;ne(B)}B=c[g+24>>2]|0;if(B|0){c[g+28>>2]=B;ne(B)}B=c[g+12>>2]|0;if(B|0){c[g+16>>2]=B;ne(B)}B=c[g>>2]|0;if(B|0){c[g+4>>2]=B;ne(B)}B=c[f+36>>2]|0;if(B|0){c[f+40>>2]=B;ne(B)}B=c[f+24>>2]|0;if(B|0){c[f+28>>2]=B;ne(B)}B=c[f+12>>2]|0;if(B|0){c[f+16>>2]=B;ne(B)}B=c[f>>2]|0;if(B|0){c[f+4>>2]=B;ne(B)}B=c[e+36>>2]|0;if(B|0){c[e+40>>2]=B;ne(B)}B=c[e+24>>2]|0;if(B|0){c[e+28>>2]=B;ne(B)}B=c[e+12>>2]|0;if(B|0){c[e+16>>2]=B;ne(B)}B=c[e>>2]|0;if(!B){Ea=b;return}c[e+4>>2]=B;ne(B);Ea=b;return}function _a(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,z=0,A=0,B=0,C=0;b=Ea;Ea=Ea+512|0;if((Ea|0)>=(Fa|0))y(512);d=b+420|0;e=b+360|0;f=b+300|0;g=b+240|0;h=b+180|0;i=b+120|0;j=b+60|0;k=b;c[e>>2]=0;l=e+4|0;c[l>>2]=0;m=e+8|0;c[m>>2]=0;n=me(20)|0;c[e>>2]=n;o=n+20|0;c[m>>2]=o;c[n>>2]=0;c[n+4>>2]=0;c[n+8>>2]=0;c[n+12>>2]=0;c[n+16>>2]=0;c[l>>2]=o;o=e+12|0;c[o>>2]=0;l=e+16|0;c[l>>2]=0;m=e+20|0;c[m>>2]=0;p=me(20)|0;c[o>>2]=p;o=p+20|0;c[m>>2]=o;c[p>>2]=0;c[p+4>>2]=0;c[p+8>>2]=0;c[p+12>>2]=1;c[p+16>>2]=0;c[l>>2]=o;o=e+24|0;c[o>>2]=0;l=e+28|0;c[l>>2]=0;m=e+32|0;c[m>>2]=0;q=me(20)|0;c[o>>2]=q;o=q+20|0;c[m>>2]=o;c[q>>2]=1;c[q+4>>2]=1;c[q+8>>2]=1;c[q+12>>2]=1;c[q+16>>2]=0;c[l>>2]=o;o=e+36|0;c[o>>2]=0;l=e+40|0;c[l>>2]=0;m=e+44|0;c[m>>2]=0;r=me(20)|0;c[o>>2]=r;o=r+20|0;c[m>>2]=o;c[r>>2]=0;c[r+4>>2]=0;c[r+8>>2]=0;c[r+12>>2]=0;c[r+16>>2]=0;c[l>>2]=o;o=e+48|0;c[o>>2]=0;l=e+52|0;c[l>>2]=0;m=e+56|0;c[m>>2]=0;s=me(20)|0;c[o>>2]=s;o=s+20|0;c[m>>2]=o;c[s>>2]=0;c[s+4>>2]=0;c[s+8>>2]=0;c[s+12>>2]=0;c[s+16>>2]=0;c[l>>2]=o;c[d>>2]=0;o=d+4|0;c[o>>2]=0;l=d+8|0;c[l>>2]=0;m=me(60)|0;c[o>>2]=m;c[d>>2]=m;c[l>>2]=m+60;c[m>>2]=0;l=m+4|0;c[l>>2]=0;t=m+8|0;c[t>>2]=0;u=me(20)|0;c[m>>2]=u;c[t>>2]=u+20;c[u>>2]=c[n>>2];c[u+4>>2]=c[n+4>>2];c[u+8>>2]=c[n+8>>2];c[u+12>>2]=c[n+12>>2];c[u+16>>2]=c[n+16>>2];c[l>>2]=u+20;u=m+12|0;c[o>>2]=u;c[u>>2]=0;l=m+16|0;c[l>>2]=0;n=m+20|0;c[n>>2]=0;t=me(20)|0;c[u>>2]=t;c[n>>2]=t+20;c[t>>2]=c[p>>2];c[t+4>>2]=c[p+4>>2];c[t+8>>2]=c[p+8>>2];c[t+12>>2]=c[p+12>>2];c[t+16>>2]=c[p+16>>2];c[l>>2]=t+20;t=m+24|0;c[o>>2]=t;c[t>>2]=0;l=m+28|0;c[l>>2]=0;p=m+32|0;c[p>>2]=0;n=me(20)|0;c[t>>2]=n;c[p>>2]=n+20;c[n>>2]=c[q>>2];c[n+4>>2]=c[q+4>>2];c[n+8>>2]=c[q+8>>2];c[n+12>>2]=c[q+12>>2];c[n+16>>2]=c[q+16>>2];c[l>>2]=n+20;n=m+36|0;c[o>>2]=n;c[n>>2]=0;l=m+40|0;c[l>>2]=0;q=m+44|0;c[q>>2]=0;p=me(20)|0;c[n>>2]=p;c[q>>2]=p+20;c[p>>2]=c[r>>2];c[p+4>>2]=c[r+4>>2];c[p+8>>2]=c[r+8>>2];c[p+12>>2]=c[r+12>>2];c[p+16>>2]=c[r+16>>2];c[l>>2]=p+20;p=m+48|0;c[o>>2]=p;c[p>>2]=0;l=m+52|0;c[l>>2]=0;r=m+56|0;c[r>>2]=0;q=me(20)|0;c[p>>2]=q;c[r>>2]=q+20;c[q>>2]=c[s>>2];c[q+4>>2]=c[s+4>>2];c[q+8>>2]=c[s+8>>2];c[q+12>>2]=c[s+12>>2];c[q+16>>2]=c[s+16>>2];c[l>>2]=q+20;c[o>>2]=m+60;m=d+12|0;c[f>>2]=0;o=f+4|0;c[o>>2]=0;q=f+8|0;c[q>>2]=0;l=me(20)|0;c[f>>2]=l;s=l+20|0;c[q>>2]=s;c[l>>2]=0;c[l+4>>2]=0;c[l+8>>2]=0;c[l+12>>2]=0;c[l+16>>2]=0;c[o>>2]=s;s=f+12|0;c[s>>2]=0;o=f+16|0;c[o>>2]=0;q=f+20|0;c[q>>2]=0;r=me(20)|0;c[s>>2]=r;s=r+20|0;c[q>>2]=s;c[r>>2]=0;c[r+4>>2]=1;c[r+8>>2]=0;c[r+12>>2]=0;c[r+16>>2]=0;c[o>>2]=s;s=f+24|0;c[s>>2]=0;o=f+28|0;c[o>>2]=0;q=f+32|0;c[q>>2]=0;p=me(20)|0;c[s>>2]=p;s=p+20|0;c[q>>2]=s;c[p>>2]=0;c[p+4>>2]=1;c[p+8>>2]=1;c[p+12>>2]=1;c[p+16>>2]=1;c[o>>2]=s;s=f+36|0;c[s>>2]=0;o=f+40|0;c[o>>2]=0;q=f+44|0;c[q>>2]=0;n=me(20)|0;c[s>>2]=n;s=n+20|0;c[q>>2]=s;c[n>>2]=0;c[n+4>>2]=0;c[n+8>>2]=0;c[n+12>>2]=0;c[n+16>>2]=0;c[o>>2]=s;s=f+48|0;c[s>>2]=0;o=f+52|0;c[o>>2]=0;q=f+56|0;c[q>>2]=0;t=me(20)|0;c[s>>2]=t;s=t+20|0;c[q>>2]=s;c[t>>2]=0;c[t+4>>2]=0;c[t+8>>2]=0;c[t+12>>2]=0;c[t+16>>2]=0;c[o>>2]=s;c[m>>2]=0;s=d+16|0;c[s>>2]=0;o=d+20|0;c[o>>2]=0;q=me(60)|0;c[s>>2]=q;c[m>>2]=q;c[o>>2]=q+60;c[q>>2]=0;o=q+4|0;c[o>>2]=0;m=q+8|0;c[m>>2]=0;u=me(20)|0;c[q>>2]=u;c[m>>2]=u+20;c[u>>2]=c[l>>2];c[u+4>>2]=c[l+4>>2];c[u+8>>2]=c[l+8>>2];c[u+12>>2]=c[l+12>>2];c[u+16>>2]=c[l+16>>2];c[o>>2]=u+20;u=q+12|0;c[s>>2]=u;c[u>>2]=0;o=q+16|0;c[o>>2]=0;l=q+20|0;c[l>>2]=0;m=me(20)|0;c[u>>2]=m;c[l>>2]=m+20;c[m>>2]=c[r>>2];c[m+4>>2]=c[r+4>>2];c[m+8>>2]=c[r+8>>2];c[m+12>>2]=c[r+12>>2];c[m+16>>2]=c[r+16>>2];c[o>>2]=m+20;m=q+24|0;c[s>>2]=m;c[m>>2]=0;o=q+28|0;c[o>>2]=0;r=q+32|0;c[r>>2]=0;l=me(20)|0;c[m>>2]=l;c[r>>2]=l+20;c[l>>2]=c[p>>2];c[l+4>>2]=c[p+4>>2];c[l+8>>2]=c[p+8>>2];c[l+12>>2]=c[p+12>>2];c[l+16>>2]=c[p+16>>2];c[o>>2]=l+20;l=q+36|0;c[s>>2]=l;c[l>>2]=0;o=q+40|0;c[o>>2]=0;p=q+44|0;c[p>>2]=0;r=me(20)|0;c[l>>2]=r;c[p>>2]=r+20;c[r>>2]=c[n>>2];c[r+4>>2]=c[n+4>>2];c[r+8>>2]=c[n+8>>2];c[r+12>>2]=c[n+12>>2];c[r+16>>2]=c[n+16>>2];c[o>>2]=r+20;r=q+48|0;c[s>>2]=r;c[r>>2]=0;o=q+52|0;c[o>>2]=0;n=q+56|0;c[n>>2]=0;p=me(20)|0;c[r>>2]=p;c[n>>2]=p+20;c[p>>2]=c[t>>2];c[p+4>>2]=c[t+4>>2];c[p+8>>2]=c[t+8>>2];c[p+12>>2]=c[t+12>>2];c[p+16>>2]=c[t+16>>2];c[o>>2]=p+20;c[s>>2]=q+60;q=d+24|0;c[g>>2]=0;s=g+4|0;c[s>>2]=0;p=g+8|0;c[p>>2]=0;o=me(20)|0;c[g>>2]=o;t=o+20|0;c[p>>2]=t;c[o>>2]=0;c[o+4>>2]=0;c[o+8>>2]=0;c[o+12>>2]=0;c[o+16>>2]=0;c[s>>2]=t;t=g+12|0;c[t>>2]=0;s=g+16|0;c[s>>2]=0;p=g+20|0;c[p>>2]=0;n=me(20)|0;c[t>>2]=n;t=n+20|0;c[p>>2]=t;c[n>>2]=0;c[n+4>>2]=0;c[n+8>>2]=1;c[n+12>>2]=0;c[n+16>>2]=0;c[s>>2]=t;t=g+24|0;c[t>>2]=0;s=g+28|0;c[s>>2]=0;p=g+32|0;c[p>>2]=0;r=me(20)|0;c[t>>2]=r;t=r+20|0;c[p>>2]=t;c[r>>2]=1;c[r+4>>2]=1;c[r+8>>2]=1;c[r+12>>2]=1;c[r+16>>2]=1;c[s>>2]=t;t=g+36|0;c[t>>2]=0;s=g+40|0;c[s>>2]=0;p=g+44|0;c[p>>2]=0;l=me(20)|0;c[t>>2]=l;t=l+20|0;c[p>>2]=t;c[l>>2]=0;c[l+4>>2]=0;c[l+8>>2]=0;c[l+12>>2]=0;c[l+16>>2]=0;c[s>>2]=t;t=g+48|0;c[t>>2]=0;s=g+52|0;c[s>>2]=0;p=g+56|0;c[p>>2]=0;m=me(20)|0;c[t>>2]=m;t=m+20|0;c[p>>2]=t;c[m>>2]=0;c[m+4>>2]=0;c[m+8>>2]=0;c[m+12>>2]=0;c[m+16>>2]=0;c[s>>2]=t;c[q>>2]=0;t=d+28|0;c[t>>2]=0;s=d+32|0;c[s>>2]=0;p=me(60)|0;c[t>>2]=p;c[q>>2]=p;c[s>>2]=p+60;c[p>>2]=0;s=p+4|0;c[s>>2]=0;q=p+8|0;c[q>>2]=0;u=me(20)|0;c[p>>2]=u;c[q>>2]=u+20;c[u>>2]=c[o>>2];c[u+4>>2]=c[o+4>>2];c[u+8>>2]=c[o+8>>2];c[u+12>>2]=c[o+12>>2];c[u+16>>2]=c[o+16>>2];c[s>>2]=u+20;u=p+12|0;c[t>>2]=u;c[u>>2]=0;s=p+16|0;c[s>>2]=0;o=p+20|0;c[o>>2]=0;q=me(20)|0;c[u>>2]=q;c[o>>2]=q+20;c[q>>2]=c[n>>2];c[q+4>>2]=c[n+4>>2];c[q+8>>2]=c[n+8>>2];c[q+12>>2]=c[n+12>>2];c[q+16>>2]=c[n+16>>2];c[s>>2]=q+20;q=p+24|0;c[t>>2]=q;c[q>>2]=0;s=p+28|0;c[s>>2]=0;n=p+32|0;c[n>>2]=0;o=me(20)|0;c[q>>2]=o;c[n>>2]=o+20;c[o>>2]=c[r>>2];c[o+4>>2]=c[r+4>>2];c[o+8>>2]=c[r+8>>2];c[o+12>>2]=c[r+12>>2];c[o+16>>2]=c[r+16>>2];c[s>>2]=o+20;o=p+36|0;c[t>>2]=o;c[o>>2]=0;s=p+40|0;c[s>>2]=0;r=p+44|0;c[r>>2]=0;n=me(20)|0;c[o>>2]=n;c[r>>2]=n+20;c[n>>2]=c[l>>2];c[n+4>>2]=c[l+4>>2];c[n+8>>2]=c[l+8>>2];c[n+12>>2]=c[l+12>>2];c[n+16>>2]=c[l+16>>2];c[s>>2]=n+20;n=p+48|0;c[t>>2]=n;c[n>>2]=0;s=p+52|0;c[s>>2]=0;l=p+56|0;c[l>>2]=0;r=me(20)|0;c[n>>2]=r;c[l>>2]=r+20;c[r>>2]=c[m>>2];c[r+4>>2]=c[m+4>>2];c[r+8>>2]=c[m+8>>2];c[r+12>>2]=c[m+12>>2];c[r+16>>2]=c[m+16>>2];c[s>>2]=r+20;c[t>>2]=p+60;p=d+36|0;c[h>>2]=0;t=h+4|0;c[t>>2]=0;r=h+8|0;c[r>>2]=0;s=me(20)|0;c[h>>2]=s;m=s+20|0;c[r>>2]=m;c[s>>2]=0;c[s+4>>2]=0;c[s+8>>2]=0;c[s+12>>2]=0;c[s+16>>2]=0;c[t>>2]=m;m=h+12|0;c[m>>2]=0;t=h+16|0;c[t>>2]=0;r=h+20|0;c[r>>2]=0;l=me(20)|0;c[m>>2]=l;m=l+20|0;c[r>>2]=m;c[l>>2]=1;c[l+4>>2]=1;c[l+8>>2]=1;c[l+12>>2]=0;c[l+16>>2]=0;c[t>>2]=m;m=h+24|0;c[m>>2]=0;t=h+28|0;c[t>>2]=0;r=h+32|0;c[r>>2]=0;n=me(20)|0;c[m>>2]=n;m=n+20|0;c[r>>2]=m;c[n>>2]=0;c[n+4>>2]=0;c[n+8>>2]=1;c[n+12>>2]=1;c[n+16>>2]=1;c[t>>2]=m;m=h+36|0;c[m>>2]=0;t=h+40|0;c[t>>2]=0;r=h+44|0;c[r>>2]=0;o=me(20)|0;c[m>>2]=o;m=o+20|0;c[r>>2]=m;c[o>>2]=0;c[o+4>>2]=0;c[o+8>>2]=0;c[o+12>>2]=0;c[o+16>>2]=0;c[t>>2]=m;m=h+48|0;c[m>>2]=0;t=h+52|0;c[t>>2]=0;r=h+56|0;c[r>>2]=0;q=me(20)|0;c[m>>2]=q;m=q+20|0;c[r>>2]=m;c[q>>2]=0;c[q+4>>2]=0;c[q+8>>2]=0;c[q+12>>2]=0;c[q+16>>2]=0;c[t>>2]=m;c[p>>2]=0;m=d+40|0;c[m>>2]=0;t=d+44|0;c[t>>2]=0;r=me(60)|0;c[m>>2]=r;c[p>>2]=r;c[t>>2]=r+60;c[r>>2]=0;t=r+4|0;c[t>>2]=0;p=r+8|0;c[p>>2]=0;u=me(20)|0;c[r>>2]=u;c[p>>2]=u+20;c[u>>2]=c[s>>2];c[u+4>>2]=c[s+4>>2];c[u+8>>2]=c[s+8>>2];c[u+12>>2]=c[s+12>>2];c[u+16>>2]=c[s+16>>2];c[t>>2]=u+20;u=r+12|0;c[m>>2]=u;c[u>>2]=0;t=r+16|0;c[t>>2]=0;s=r+20|0;c[s>>2]=0;p=me(20)|0;c[u>>2]=p;c[s>>2]=p+20;c[p>>2]=c[l>>2];c[p+4>>2]=c[l+4>>2];c[p+8>>2]=c[l+8>>2];c[p+12>>2]=c[l+12>>2];c[p+16>>2]=c[l+16>>2];c[t>>2]=p+20;p=r+24|0;c[m>>2]=p;c[p>>2]=0;t=r+28|0;c[t>>2]=0;l=r+32|0;c[l>>2]=0;s=me(20)|0;c[p>>2]=s;c[l>>2]=s+20;c[s>>2]=c[n>>2];c[s+4>>2]=c[n+4>>2];c[s+8>>2]=c[n+8>>2];c[s+12>>2]=c[n+12>>2];c[s+16>>2]=c[n+16>>2];c[t>>2]=s+20;s=r+36|0;c[m>>2]=s;c[s>>2]=0;t=r+40|0;c[t>>2]=0;n=r+44|0;c[n>>2]=0;l=me(20)|0;c[s>>2]=l;c[n>>2]=l+20;c[l>>2]=c[o>>2];c[l+4>>2]=c[o+4>>2];c[l+8>>2]=c[o+8>>2];c[l+12>>2]=c[o+12>>2];c[l+16>>2]=c[o+16>>2];c[t>>2]=l+20;l=r+48|0;c[m>>2]=l;c[l>>2]=0;t=r+52|0;c[t>>2]=0;o=r+56|0;c[o>>2]=0;n=me(20)|0;c[l>>2]=n;c[o>>2]=n+20;c[n>>2]=c[q>>2];c[n+4>>2]=c[q+4>>2];c[n+8>>2]=c[q+8>>2];c[n+12>>2]=c[q+12>>2];c[n+16>>2]=c[q+16>>2];c[t>>2]=n+20;c[m>>2]=r+60;r=d+48|0;c[i>>2]=0;m=i+4|0;c[m>>2]=0;n=i+8|0;c[n>>2]=0;t=me(20)|0;c[i>>2]=t;q=t+20|0;c[n>>2]=q;c[t>>2]=0;c[t+4>>2]=0;c[t+8>>2]=0;c[t+12>>2]=0;c[t+16>>2]=0;c[m>>2]=q;q=i+12|0;c[q>>2]=0;m=i+16|0;c[m>>2]=0;n=i+20|0;c[n>>2]=0;o=me(20)|0;c[q>>2]=o;q=o+20|0;c[n>>2]=q;c[o>>2]=0;c[o+4>>2]=0;c[o+8>>2]=1;c[o+12>>2]=1;c[o+16>>2]=1;c[m>>2]=q;q=i+24|0;c[q>>2]=0;m=i+28|0;c[m>>2]=0;n=i+32|0;c[n>>2]=0;l=me(20)|0;c[q>>2]=l;q=l+20|0;c[n>>2]=q;c[l>>2]=1;c[l+4>>2]=1;c[l+8>>2]=1;c[l+12>>2]=0;c[l+16>>2]=0;c[m>>2]=q;q=i+36|0;c[q>>2]=0;m=i+40|0;c[m>>2]=0;n=i+44|0;c[n>>2]=0;s=me(20)|0;c[q>>2]=s;q=s+20|0;c[n>>2]=q;c[s>>2]=0;c[s+4>>2]=0;c[s+8>>2]=0;c[s+12>>2]=0;c[s+16>>2]=0;c[m>>2]=q;q=i+48|0;c[q>>2]=0;m=i+52|0;c[m>>2]=0;n=i+56|0;c[n>>2]=0;p=me(20)|0;c[q>>2]=p;q=p+20|0;c[n>>2]=q;c[p>>2]=0;c[p+4>>2]=0;c[p+8>>2]=0;c[p+12>>2]=0;c[p+16>>2]=0;c[m>>2]=q;c[r>>2]=0;q=d+52|0;c[q>>2]=0;m=d+56|0;c[m>>2]=0;n=me(60)|0;c[q>>2]=n;c[r>>2]=n;c[m>>2]=n+60;c[n>>2]=0;m=n+4|0;c[m>>2]=0;r=n+8|0;c[r>>2]=0;u=me(20)|0;c[n>>2]=u;c[r>>2]=u+20;c[u>>2]=c[t>>2];c[u+4>>2]=c[t+4>>2];c[u+8>>2]=c[t+8>>2];c[u+12>>2]=c[t+12>>2];c[u+16>>2]=c[t+16>>2];c[m>>2]=u+20;u=n+12|0;c[q>>2]=u;c[u>>2]=0;m=n+16|0;c[m>>2]=0;t=n+20|0;c[t>>2]=0;r=me(20)|0;c[u>>2]=r;c[t>>2]=r+20;c[r>>2]=c[o>>2];c[r+4>>2]=c[o+4>>2];c[r+8>>2]=c[o+8>>2];c[r+12>>2]=c[o+12>>2];c[r+16>>2]=c[o+16>>2];c[m>>2]=r+20;r=n+24|0;c[q>>2]=r;c[r>>2]=0;m=n+28|0;c[m>>2]=0;o=n+32|0;c[o>>2]=0;t=me(20)|0;c[r>>2]=t;c[o>>2]=t+20;c[t>>2]=c[l>>2];c[t+4>>2]=c[l+4>>2];c[t+8>>2]=c[l+8>>2];c[t+12>>2]=c[l+12>>2];c[t+16>>2]=c[l+16>>2];c[m>>2]=t+20;t=n+36|0;c[q>>2]=t;c[t>>2]=0;m=n+40|0;c[m>>2]=0;l=n+44|0;c[l>>2]=0;o=me(20)|0;c[t>>2]=o;c[l>>2]=o+20;c[o>>2]=c[s>>2];c[o+4>>2]=c[s+4>>2];c[o+8>>2]=c[s+8>>2];c[o+12>>2]=c[s+12>>2];c[o+16>>2]=c[s+16>>2];c[m>>2]=o+20;o=n+48|0;c[q>>2]=o;c[o>>2]=0;m=n+52|0;c[m>>2]=0;s=n+56|0;c[s>>2]=0;l=me(20)|0;c[o>>2]=l;c[s>>2]=l+20;c[l>>2]=c[p>>2];c[l+4>>2]=c[p+4>>2];c[l+8>>2]=c[p+8>>2];c[l+12>>2]=c[p+12>>2];c[l+16>>2]=c[p+16>>2];c[m>>2]=l+20;c[q>>2]=n+60;n=d+60|0;c[j>>2]=0;q=j+4|0;c[q>>2]=0;l=j+8|0;c[l>>2]=0;m=me(20)|0;c[j>>2]=m;p=m+20|0;c[l>>2]=p;c[m>>2]=0;c[m+4>>2]=0;c[m+8>>2]=0;c[m+12>>2]=0;c[m+16>>2]=0;c[q>>2]=p;p=j+12|0;c[p>>2]=0;q=j+16|0;c[q>>2]=0;l=j+20|0;c[l>>2]=0;s=me(20)|0;c[p>>2]=s;p=s+20|0;c[l>>2]=p;c[s>>2]=0;c[s+4>>2]=1;c[s+8>>2]=1;c[s+12>>2]=1;c[s+16>>2]=0;c[q>>2]=p;p=j+24|0;c[p>>2]=0;q=j+28|0;c[q>>2]=0;l=j+32|0;c[l>>2]=0;o=me(20)|0;c[p>>2]=o;p=o+20|0;c[l>>2]=p;c[o>>2]=0;c[o+4>>2]=1;c[o+8>>2]=1;c[o+12>>2]=1;c[o+16>>2]=0;c[q>>2]=p;p=j+36|0;c[p>>2]=0;q=j+40|0;c[q>>2]=0;l=j+44|0;c[l>>2]=0;t=me(20)|0;c[p>>2]=t;p=t+20|0;c[l>>2]=p;c[t>>2]=0;c[t+4>>2]=0;c[t+8>>2]=0;c[t+12>>2]=0;c[t+16>>2]=0;c[q>>2]=p;p=j+48|0;c[p>>2]=0;q=j+52|0;c[q>>2]=0;l=j+56|0;c[l>>2]=0;r=me(20)|0;c[p>>2]=r;p=r+20|0;c[l>>2]=p;c[r>>2]=0;c[r+4>>2]=0;c[r+8>>2]=0;c[r+12>>2]=0;c[r+16>>2]=0;c[q>>2]=p;c[n>>2]=0;p=d+64|0;c[p>>2]=0;q=d+68|0;c[q>>2]=0;l=me(60)|0;c[p>>2]=l;c[n>>2]=l;c[q>>2]=l+60;c[l>>2]=0;q=l+4|0;c[q>>2]=0;n=l+8|0;c[n>>2]=0;u=me(20)|0;c[l>>2]=u;c[n>>2]=u+20;c[u>>2]=c[m>>2];c[u+4>>2]=c[m+4>>2];c[u+8>>2]=c[m+8>>2];c[u+12>>2]=c[m+12>>2];c[u+16>>2]=c[m+16>>2];c[q>>2]=u+20;u=l+12|0;c[p>>2]=u;c[u>>2]=0;q=l+16|0;c[q>>2]=0;m=l+20|0;c[m>>2]=0;n=me(20)|0;c[u>>2]=n;c[m>>2]=n+20;c[n>>2]=c[s>>2];c[n+4>>2]=c[s+4>>2];c[n+8>>2]=c[s+8>>2];c[n+12>>2]=c[s+12>>2];c[n+16>>2]=c[s+16>>2];c[q>>2]=n+20;n=l+24|0;c[p>>2]=n;c[n>>2]=0;q=l+28|0;c[q>>2]=0;s=l+32|0;c[s>>2]=0;m=me(20)|0;c[n>>2]=m;c[s>>2]=m+20;c[m>>2]=c[o>>2];c[m+4>>2]=c[o+4>>2];c[m+8>>2]=c[o+8>>2];c[m+12>>2]=c[o+12>>2];c[m+16>>2]=c[o+16>>2];c[q>>2]=m+20;m=l+36|0;c[p>>2]=m;c[m>>2]=0;q=l+40|0;c[q>>2]=0;o=l+44|0;c[o>>2]=0;s=me(20)|0;c[m>>2]=s;c[o>>2]=s+20;c[s>>2]=c[t>>2];c[s+4>>2]=c[t+4>>2];c[s+8>>2]=c[t+8>>2];c[s+12>>2]=c[t+12>>2];c[s+16>>2]=c[t+16>>2];c[q>>2]=s+20;s=l+48|0;c[p>>2]=s;c[s>>2]=0;q=l+52|0;c[q>>2]=0;t=l+56|0;c[t>>2]=0;o=me(20)|0;c[s>>2]=o;c[t>>2]=o+20;c[o>>2]=c[r>>2];c[o+4>>2]=c[r+4>>2];c[o+8>>2]=c[r+8>>2];c[o+12>>2]=c[r+12>>2];c[o+16>>2]=c[r+16>>2];c[q>>2]=o+20;c[p>>2]=l+60;l=d+72|0;c[k>>2]=0;p=k+4|0;c[p>>2]=0;o=k+8|0;c[o>>2]=0;q=me(20)|0;c[k>>2]=q;r=q+20|0;c[o>>2]=r;c[q>>2]=0;c[q+4>>2]=0;c[q+8>>2]=0;c[q+12>>2]=0;c[q+16>>2]=0;c[p>>2]=r;r=k+12|0;c[r>>2]=0;p=k+16|0;c[p>>2]=0;o=k+20|0;c[o>>2]=0;t=me(20)|0;c[r>>2]=t;r=t+20|0;c[o>>2]=r;c[t>>2]=0;c[t+4>>2]=0;c[t+8>>2]=0;c[t+12>>2]=0;c[t+16>>2]=0;c[p>>2]=r;r=k+24|0;c[r>>2]=0;p=k+28|0;c[p>>2]=0;o=k+32|0;c[o>>2]=0;s=me(20)|0;c[r>>2]=s;r=s+20|0;c[o>>2]=r;c[s>>2]=1;c[s+4>>2]=1;c[s+8>>2]=1;c[s+12>>2]=1;c[s+16>>2]=1;c[p>>2]=r;r=k+36|0;c[r>>2]=0;p=k+40|0;c[p>>2]=0;o=k+44|0;c[o>>2]=0;m=me(20)|0;c[r>>2]=m;r=m+20|0;c[o>>2]=r;c[m>>2]=0;c[m+4>>2]=0;c[m+8>>2]=0;c[m+12>>2]=0;c[m+16>>2]=0;c[p>>2]=r;r=k+48|0;c[r>>2]=0;p=k+52|0;c[p>>2]=0;o=k+56|0;c[o>>2]=0;n=me(20)|0;c[r>>2]=n;r=n+20|0;c[o>>2]=r;c[n>>2]=0;c[n+4>>2]=0;c[n+8>>2]=0;c[n+12>>2]=0;c[n+16>>2]=0;c[p>>2]=r;c[l>>2]=0;r=d+76|0;c[r>>2]=0;p=d+80|0;c[p>>2]=0;o=me(60)|0;c[r>>2]=o;c[l>>2]=o;c[p>>2]=o+60;c[o>>2]=0;p=o+4|0;c[p>>2]=0;l=o+8|0;c[l>>2]=0;u=me(20)|0;c[o>>2]=u;c[l>>2]=u+20;c[u>>2]=c[q>>2];c[u+4>>2]=c[q+4>>2];c[u+8>>2]=c[q+8>>2];c[u+12>>2]=c[q+12>>2];c[u+16>>2]=c[q+16>>2];c[p>>2]=u+20;u=o+12|0;c[r>>2]=u;c[u>>2]=0;p=o+16|0;c[p>>2]=0;q=o+20|0;c[q>>2]=0;l=me(20)|0;c[u>>2]=l;c[q>>2]=l+20;c[l>>2]=c[t>>2];c[l+4>>2]=c[t+4>>2];c[l+8>>2]=c[t+8>>2];c[l+12>>2]=c[t+12>>2];c[l+16>>2]=c[t+16>>2];c[p>>2]=l+20;l=o+24|0;c[r>>2]=l;c[l>>2]=0;p=o+28|0;c[p>>2]=0;t=o+32|0;c[t>>2]=0;q=me(20)|0;c[l>>2]=q;c[t>>2]=q+20;c[q>>2]=c[s>>2];c[q+4>>2]=c[s+4>>2];c[q+8>>2]=c[s+8>>2];c[q+12>>2]=c[s+12>>2];c[q+16>>2]=c[s+16>>2];c[p>>2]=q+20;q=o+36|0;c[r>>2]=q;c[q>>2]=0;p=o+40|0;c[p>>2]=0;s=o+44|0;c[s>>2]=0;t=me(20)|0;c[q>>2]=t;c[s>>2]=t+20;c[t>>2]=c[m>>2];c[t+4>>2]=c[m+4>>2];c[t+8>>2]=c[m+8>>2];c[t+12>>2]=c[m+12>>2];c[t+16>>2]=c[m+16>>2];c[p>>2]=t+20;t=o+48|0;c[r>>2]=t;c[t>>2]=0;p=o+52|0;c[p>>2]=0;m=o+56|0;c[m>>2]=0;s=me(20)|0;c[t>>2]=s;c[m>>2]=s+20;c[s>>2]=c[n>>2];c[s+4>>2]=c[n+4>>2];c[s+8>>2]=c[n+8>>2];c[s+12>>2]=c[n+12>>2];c[s+16>>2]=c[n+16>>2];c[p>>2]=s+20;c[r>>2]=o+60;c[a>>2]=0;o=a+4|0;c[o>>2]=0;r=a+8|0;c[r>>2]=0;s=me(84)|0;c[o>>2]=s;c[a>>2]=s;c[r>>2]=s+84;sb(s,d);r=s+12|0;c[o>>2]=r;sb(r,d+12|0);r=s+24|0;c[o>>2]=r;sb(r,d+24|0);r=s+36|0;c[o>>2]=r;sb(r,d+36|0);r=s+48|0;c[o>>2]=r;sb(r,d+48|0);r=s+60|0;c[o>>2]=r;sb(r,d+60|0);r=s+72|0;c[o>>2]=r;sb(r,d+72|0);c[o>>2]=s+84;s=d+72|0;o=c[s>>2]|0;if(o|0){r=d+76|0;a=c[r>>2]|0;if((a|0)==(o|0))v=o;else{p=a;do{a=p;p=p+-12|0;n=c[p>>2]|0;if(n|0){c[a+-8>>2]=n;ne(n)}}while((p|0)!=(o|0));v=c[s>>2]|0}c[r>>2]=o;ne(v)}v=d+60|0;o=c[v>>2]|0;if(o|0){r=d+64|0;s=c[r>>2]|0;if((s|0)==(o|0))w=o;else{p=s;do{s=p;p=p+-12|0;n=c[p>>2]|0;if(n|0){c[s+-8>>2]=n;ne(n)}}while((p|0)!=(o|0));w=c[v>>2]|0}c[r>>2]=o;ne(w)}w=d+48|0;o=c[w>>2]|0;if(o|0){r=d+52|0;v=c[r>>2]|0;if((v|0)==(o|0))x=o;else{p=v;do{v=p;p=p+-12|0;n=c[p>>2]|0;if(n|0){c[v+-8>>2]=n;ne(n)}}while((p|0)!=(o|0));x=c[w>>2]|0}c[r>>2]=o;ne(x)}x=d+36|0;o=c[x>>2]|0;if(o|0){r=d+40|0;w=c[r>>2]|0;if((w|0)==(o|0))z=o;else{p=w;do{w=p;p=p+-12|0;n=c[p>>2]|0;if(n|0){c[w+-8>>2]=n;ne(n)}}while((p|0)!=(o|0));z=c[x>>2]|0}c[r>>2]=o;ne(z)}z=d+24|0;o=c[z>>2]|0;if(o|0){r=d+28|0;x=c[r>>2]|0;if((x|0)==(o|0))A=o;else{p=x;do{x=p;p=p+-12|0;n=c[p>>2]|0;if(n|0){c[x+-8>>2]=n;ne(n)}}while((p|0)!=(o|0));A=c[z>>2]|0}c[r>>2]=o;ne(A)}A=d+12|0;o=c[A>>2]|0;if(o|0){r=d+16|0;z=c[r>>2]|0;if((z|0)==(o|0))B=o;else{p=z;do{z=p;p=p+-12|0;n=c[p>>2]|0;if(n|0){c[z+-8>>2]=n;ne(n)}}while((p|0)!=(o|0));B=c[A>>2]|0}c[r>>2]=o;ne(B)}B=c[d>>2]|0;if(B|0){o=d+4|0;r=c[o>>2]|0;if((r|0)==(B|0))C=B;else{A=r;do{r=A;A=A+-12|0;p=c[A>>2]|0;if(p|0){c[r+-8>>2]=p;ne(p)}}while((A|0)!=(B|0));C=c[d>>2]|0}c[o>>2]=B;ne(C)}C=c[k+48>>2]|0;if(C|0){c[k+52>>2]=C;ne(C)}C=c[k+36>>2]|0;if(C|0){c[k+40>>2]=C;ne(C)}C=c[k+24>>2]|0;if(C|0){c[k+28>>2]=C;ne(C)}C=c[k+12>>2]|0;if(C|0){c[k+16>>2]=C;ne(C)}C=c[k>>2]|0;if(C|0){c[k+4>>2]=C;ne(C)}C=c[j+48>>2]|0;if(C|0){c[j+52>>2]=C;ne(C)}C=c[j+36>>2]|0;if(C|0){c[j+40>>2]=C;ne(C)}C=c[j+24>>2]|0;if(C|0){c[j+28>>2]=C;ne(C)}C=c[j+12>>2]|0;if(C|0){c[j+16>>2]=C;ne(C)}C=c[j>>2]|0;if(C|0){c[j+4>>2]=C;ne(C)}C=c[i+48>>2]|0;if(C|0){c[i+52>>2]=C;ne(C)}C=c[i+36>>2]|0;if(C|0){c[i+40>>2]=C;ne(C)}C=c[i+24>>2]|0;if(C|0){c[i+28>>2]=C;ne(C)}C=c[i+12>>2]|0;if(C|0){c[i+16>>2]=C;ne(C)}C=c[i>>2]|0;if(C|0){c[i+4>>2]=C;ne(C)}C=c[h+48>>2]|0;if(C|0){c[h+52>>2]=C;ne(C)}C=c[h+36>>2]|0;if(C|0){c[h+40>>2]=C;ne(C)}C=c[h+24>>2]|0;if(C|0){c[h+28>>2]=C;ne(C)}C=c[h+12>>2]|0;if(C|0){c[h+16>>2]=C;ne(C)}C=c[h>>2]|0;if(C|0){c[h+4>>2]=C;ne(C)}C=c[g+48>>2]|0;if(C|0){c[g+52>>2]=C;ne(C)}C=c[g+36>>2]|0;if(C|0){c[g+40>>2]=C;ne(C)}C=c[g+24>>2]|0;if(C|0){c[g+28>>2]=C;ne(C)}C=c[g+12>>2]|0;if(C|0){c[g+16>>2]=C;ne(C)}C=c[g>>2]|0;if(C|0){c[g+4>>2]=C;ne(C)}C=c[f+48>>2]|0;if(C|0){c[f+52>>2]=C;ne(C)}C=c[f+36>>2]|0;if(C|0){c[f+40>>2]=C;ne(C)}C=c[f+24>>2]|0;if(C|0){c[f+28>>2]=C;ne(C)}C=c[f+12>>2]|0;if(C|0){c[f+16>>2]=C;ne(C)}C=c[f>>2]|0;if(C|0){c[f+4>>2]=C;ne(C)}C=c[e+48>>2]|0;if(C|0){c[e+52>>2]=C;ne(C)}C=c[e+36>>2]|0;if(C|0){c[e+40>>2]=C;ne(C)}C=c[e+24>>2]|0;if(C|0){c[e+28>>2]=C;ne(C)}C=c[e+12>>2]|0;if(C|0){c[e+16>>2]=C;ne(C)}C=c[e>>2]|0;if(!C){Ea=b;return}c[e+4>>2]=C;ne(C);Ea=b;return}function $a(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0;b=Ea;Ea=Ea+1152|0;if((Ea|0)>=(Fa|0))y(1152);d=b+960|0;e=b+900|0;f=b+840|0;g=b+780|0;h=b+720|0;i=b+660|0;j=b+600|0;k=b+540|0;l=b+480|0;m=b+420|0;n=b+360|0;o=b+300|0;p=b+240|0;q=b+180|0;r=b+120|0;s=b+60|0;t=b;c[e>>2]=0;u=e+4|0;c[u>>2]=0;v=e+8|0;c[v>>2]=0;w=me(20)|0;c[e>>2]=w;x=w+20|0;c[v>>2]=x;c[w>>2]=0;c[w+4>>2]=0;c[w+8>>2]=0;c[w+12>>2]=0;c[w+16>>2]=0;c[u>>2]=x;x=e+12|0;c[x>>2]=0;u=e+16|0;c[u>>2]=0;v=e+20|0;c[v>>2]=0;z=me(20)|0;c[x>>2]=z;x=z+20|0;c[v>>2]=x;c[z>>2]=0;c[z+4>>2]=1;c[z+8>>2]=0;c[z+12>>2]=0;c[z+16>>2]=0;c[u>>2]=x;x=e+24|0;c[x>>2]=0;u=e+28|0;c[u>>2]=0;v=e+32|0;c[v>>2]=0;A=me(20)|0;c[x>>2]=A;x=A+20|0;c[v>>2]=x;c[A>>2]=0;c[A+4>>2]=1;c[A+8>>2]=0;c[A+12>>2]=0;c[A+16>>2]=0;c[u>>2]=x;x=e+36|0;c[x>>2]=0;u=e+40|0;c[u>>2]=0;v=e+44|0;c[v>>2]=0;B=me(20)|0;c[x>>2]=B;x=B+20|0;c[v>>2]=x;c[B>>2]=0;c[B+4>>2]=1;c[B+8>>2]=1;c[B+12>>2]=1;c[B+16>>2]=0;c[u>>2]=x;x=e+48|0;c[x>>2]=0;u=e+52|0;c[u>>2]=0;v=e+56|0;c[v>>2]=0;C=me(20)|0;c[x>>2]=C;x=C+20|0;c[v>>2]=x;c[C>>2]=0;c[C+4>>2]=0;c[C+8>>2]=0;c[C+12>>2]=0;c[C+16>>2]=0;c[u>>2]=x;c[d>>2]=0;x=d+4|0;c[x>>2]=0;u=d+8|0;c[u>>2]=0;v=me(60)|0;c[x>>2]=v;c[d>>2]=v;c[u>>2]=v+60;c[v>>2]=0;u=v+4|0;c[u>>2]=0;D=v+8|0;c[D>>2]=0;E=me(20)|0;c[v>>2]=E;c[D>>2]=E+20;c[E>>2]=c[w>>2];c[E+4>>2]=c[w+4>>2];c[E+8>>2]=c[w+8>>2];c[E+12>>2]=c[w+12>>2];c[E+16>>2]=c[w+16>>2];c[u>>2]=E+20;E=v+12|0;c[x>>2]=E;c[E>>2]=0;u=v+16|0;c[u>>2]=0;w=v+20|0;c[w>>2]=0;D=me(20)|0;c[E>>2]=D;c[w>>2]=D+20;c[D>>2]=c[z>>2];c[D+4>>2]=c[z+4>>2];c[D+8>>2]=c[z+8>>2];c[D+12>>2]=c[z+12>>2];c[D+16>>2]=c[z+16>>2];c[u>>2]=D+20;D=v+24|0;c[x>>2]=D;c[D>>2]=0;u=v+28|0;c[u>>2]=0;z=v+32|0;c[z>>2]=0;w=me(20)|0;c[D>>2]=w;c[z>>2]=w+20;c[w>>2]=c[A>>2];c[w+4>>2]=c[A+4>>2];c[w+8>>2]=c[A+8>>2];c[w+12>>2]=c[A+12>>2];c[w+16>>2]=c[A+16>>2];c[u>>2]=w+20;w=v+36|0;c[x>>2]=w;c[w>>2]=0;u=v+40|0;c[u>>2]=0;A=v+44|0;c[A>>2]=0;z=me(20)|0;c[w>>2]=z;c[A>>2]=z+20;c[z>>2]=c[B>>2];c[z+4>>2]=c[B+4>>2];c[z+8>>2]=c[B+8>>2];c[z+12>>2]=c[B+12>>2];c[z+16>>2]=c[B+16>>2];c[u>>2]=z+20;z=v+48|0;c[x>>2]=z;c[z>>2]=0;u=v+52|0;c[u>>2]=0;B=v+56|0;c[B>>2]=0;A=me(20)|0;c[z>>2]=A;c[B>>2]=A+20;c[A>>2]=c[C>>2];c[A+4>>2]=c[C+4>>2];c[A+8>>2]=c[C+8>>2];c[A+12>>2]=c[C+12>>2];c[A+16>>2]=c[C+16>>2];c[u>>2]=A+20;c[x>>2]=v+60;v=d+12|0;c[f>>2]=0;x=f+4|0;c[x>>2]=0;A=f+8|0;c[A>>2]=0;u=me(20)|0;c[f>>2]=u;C=u+20|0;c[A>>2]=C;c[u>>2]=0;c[u+4>>2]=0;c[u+8>>2]=0;c[u+12>>2]=0;c[u+16>>2]=0;c[x>>2]=C;C=f+12|0;c[C>>2]=0;x=f+16|0;c[x>>2]=0;A=f+20|0;c[A>>2]=0;B=me(20)|0;c[C>>2]=B;C=B+20|0;c[A>>2]=C;c[B>>2]=0;c[B+4>>2]=1;c[B+8>>2]=0;c[B+12>>2]=0;c[B+16>>2]=0;c[x>>2]=C;C=f+24|0;c[C>>2]=0;x=f+28|0;c[x>>2]=0;A=f+32|0;c[A>>2]=0;z=me(20)|0;c[C>>2]=z;C=z+20|0;c[A>>2]=C;c[z>>2]=0;c[z+4>>2]=1;c[z+8>>2]=1;c[z+12>>2]=0;c[z+16>>2]=0;c[x>>2]=C;C=f+36|0;c[C>>2]=0;x=f+40|0;c[x>>2]=0;A=f+44|0;c[A>>2]=0;w=me(20)|0;c[C>>2]=w;C=w+20|0;c[A>>2]=C;c[w>>2]=0;c[w+4>>2]=0;c[w+8>>2]=1;c[w+12>>2]=1;c[w+16>>2]=0;c[x>>2]=C;C=f+48|0;c[C>>2]=0;x=f+52|0;c[x>>2]=0;A=f+56|0;c[A>>2]=0;D=me(20)|0;c[C>>2]=D;C=D+20|0;c[A>>2]=C;c[D>>2]=0;c[D+4>>2]=0;c[D+8>>2]=0;c[D+12>>2]=0;c[D+16>>2]=0;c[x>>2]=C;c[v>>2]=0;C=d+16|0;c[C>>2]=0;x=d+20|0;c[x>>2]=0;A=me(60)|0;c[C>>2]=A;c[v>>2]=A;c[x>>2]=A+60;c[A>>2]=0;x=A+4|0;c[x>>2]=0;v=A+8|0;c[v>>2]=0;E=me(20)|0;c[A>>2]=E;c[v>>2]=E+20;c[E>>2]=c[u>>2];c[E+4>>2]=c[u+4>>2];c[E+8>>2]=c[u+8>>2];c[E+12>>2]=c[u+12>>2];c[E+16>>2]=c[u+16>>2];c[x>>2]=E+20;E=A+12|0;c[C>>2]=E;c[E>>2]=0;x=A+16|0;c[x>>2]=0;u=A+20|0;c[u>>2]=0;v=me(20)|0;c[E>>2]=v;c[u>>2]=v+20;c[v>>2]=c[B>>2];c[v+4>>2]=c[B+4>>2];c[v+8>>2]=c[B+8>>2];c[v+12>>2]=c[B+12>>2];c[v+16>>2]=c[B+16>>2];c[x>>2]=v+20;v=A+24|0;c[C>>2]=v;c[v>>2]=0;x=A+28|0;c[x>>2]=0;B=A+32|0;c[B>>2]=0;u=me(20)|0;c[v>>2]=u;c[B>>2]=u+20;c[u>>2]=c[z>>2];c[u+4>>2]=c[z+4>>2];c[u+8>>2]=c[z+8>>2];c[u+12>>2]=c[z+12>>2];c[u+16>>2]=c[z+16>>2];c[x>>2]=u+20;u=A+36|0;c[C>>2]=u;c[u>>2]=0;x=A+40|0;c[x>>2]=0;z=A+44|0;c[z>>2]=0;B=me(20)|0;c[u>>2]=B;c[z>>2]=B+20;c[B>>2]=c[w>>2];c[B+4>>2]=c[w+4>>2];c[B+8>>2]=c[w+8>>2];c[B+12>>2]=c[w+12>>2];c[B+16>>2]=c[w+16>>2];c[x>>2]=B+20;B=A+48|0;c[C>>2]=B;c[B>>2]=0;x=A+52|0;c[x>>2]=0;w=A+56|0;c[w>>2]=0;z=me(20)|0;c[B>>2]=z;c[w>>2]=z+20;c[z>>2]=c[D>>2];c[z+4>>2]=c[D+4>>2];c[z+8>>2]=c[D+8>>2];c[z+12>>2]=c[D+12>>2];c[z+16>>2]=c[D+16>>2];c[x>>2]=z+20;c[C>>2]=A+60;A=d+24|0;c[g>>2]=0;C=g+4|0;c[C>>2]=0;z=g+8|0;c[z>>2]=0;x=me(20)|0;c[g>>2]=x;D=x+20|0;c[z>>2]=D;c[x>>2]=0;c[x+4>>2]=0;c[x+8>>2]=1;c[x+12>>2]=0;c[x+16>>2]=0;c[C>>2]=D;D=g+12|0;c[D>>2]=0;C=g+16|0;c[C>>2]=0;z=g+20|0;c[z>>2]=0;w=me(20)|0;c[D>>2]=w;D=w+20|0;c[z>>2]=D;c[w>>2]=0;c[w+4>>2]=0;c[w+8>>2]=1;c[w+12>>2]=0;c[w+16>>2]=0;c[C>>2]=D;D=g+24|0;c[D>>2]=0;C=g+28|0;c[C>>2]=0;z=g+32|0;c[z>>2]=0;B=me(20)|0;c[D>>2]=B;D=B+20|0;c[z>>2]=D;c[B>>2]=0;c[B+4>>2]=0;c[B+8>>2]=1;c[B+12>>2]=0;c[B+16>>2]=0;c[C>>2]=D;D=g+36|0;c[D>>2]=0;C=g+40|0;c[C>>2]=0;z=g+44|0;c[z>>2]=0;u=me(20)|0;c[D>>2]=u;D=u+20|0;c[z>>2]=D;c[u>>2]=0;c[u+4>>2]=0;c[u+8>>2]=1;c[u+12>>2]=1;c[u+16>>2]=0;c[C>>2]=D;D=g+48|0;c[D>>2]=0;C=g+52|0;c[C>>2]=0;z=g+56|0;c[z>>2]=0;v=me(20)|0;c[D>>2]=v;D=v+20|0;c[z>>2]=D;c[v>>2]=0;c[v+4>>2]=0;c[v+8>>2]=0;c[v+12>>2]=0;c[v+16>>2]=0;c[C>>2]=D;c[A>>2]=0;D=d+28|0;c[D>>2]=0;C=d+32|0;c[C>>2]=0;z=me(60)|0;c[D>>2]=z;c[A>>2]=z;c[C>>2]=z+60;c[z>>2]=0;C=z+4|0;c[C>>2]=0;A=z+8|0;c[A>>2]=0;E=me(20)|0;c[z>>2]=E;c[A>>2]=E+20;c[E>>2]=c[x>>2];c[E+4>>2]=c[x+4>>2];c[E+8>>2]=c[x+8>>2];c[E+12>>2]=c[x+12>>2];c[E+16>>2]=c[x+16>>2];c[C>>2]=E+20;E=z+12|0;c[D>>2]=E;c[E>>2]=0;C=z+16|0;c[C>>2]=0;x=z+20|0;c[x>>2]=0;A=me(20)|0;c[E>>2]=A;c[x>>2]=A+20;c[A>>2]=c[w>>2];c[A+4>>2]=c[w+4>>2];c[A+8>>2]=c[w+8>>2];c[A+12>>2]=c[w+12>>2];c[A+16>>2]=c[w+16>>2];c[C>>2]=A+20;A=z+24|0;c[D>>2]=A;c[A>>2]=0;C=z+28|0;c[C>>2]=0;w=z+32|0;c[w>>2]=0;x=me(20)|0;c[A>>2]=x;c[w>>2]=x+20;c[x>>2]=c[B>>2];c[x+4>>2]=c[B+4>>2];c[x+8>>2]=c[B+8>>2];c[x+12>>2]=c[B+12>>2];c[x+16>>2]=c[B+16>>2];c[C>>2]=x+20;x=z+36|0;c[D>>2]=x;c[x>>2]=0;C=z+40|0;c[C>>2]=0;B=z+44|0;c[B>>2]=0;w=me(20)|0;c[x>>2]=w;c[B>>2]=w+20;c[w>>2]=c[u>>2];c[w+4>>2]=c[u+4>>2];c[w+8>>2]=c[u+8>>2];c[w+12>>2]=c[u+12>>2];c[w+16>>2]=c[u+16>>2];c[C>>2]=w+20;w=z+48|0;c[D>>2]=w;c[w>>2]=0;C=z+52|0;c[C>>2]=0;u=z+56|0;c[u>>2]=0;B=me(20)|0;c[w>>2]=B;c[u>>2]=B+20;c[B>>2]=c[v>>2];c[B+4>>2]=c[v+4>>2];c[B+8>>2]=c[v+8>>2];c[B+12>>2]=c[v+12>>2];c[B+16>>2]=c[v+16>>2];c[C>>2]=B+20;c[D>>2]=z+60;z=d+36|0;c[h>>2]=0;D=h+4|0;c[D>>2]=0;B=h+8|0;c[B>>2]=0;C=me(20)|0;c[h>>2]=C;v=C+20|0;c[B>>2]=v;c[C>>2]=0;c[C+4>>2]=0;c[C+8>>2]=1;c[C+12>>2]=0;c[C+16>>2]=0;c[D>>2]=v;v=h+12|0;c[v>>2]=0;D=h+16|0;c[D>>2]=0;B=h+20|0;c[B>>2]=0;u=me(20)|0;c[v>>2]=u;v=u+20|0;c[B>>2]=v;c[u>>2]=0;c[u+4>>2]=0;c[u+8>>2]=1;c[u+12>>2]=0;c[u+16>>2]=0;c[D>>2]=v;v=h+24|0;c[v>>2]=0;D=h+28|0;c[D>>2]=0;B=h+32|0;c[B>>2]=0;w=me(20)|0;c[v>>2]=w;v=w+20|0;c[B>>2]=v;c[w>>2]=0;c[w+4>>2]=0;c[w+8>>2]=1;c[w+12>>2]=0;c[w+16>>2]=0;c[D>>2]=v;v=h+36|0;c[v>>2]=0;D=h+40|0;c[D>>2]=0;B=h+44|0;c[B>>2]=0;x=me(20)|0;c[v>>2]=x;v=x+20|0;c[B>>2]=v;c[x>>2]=0;c[x+4>>2]=1;c[x+8>>2]=1;c[x+12>>2]=0;c[x+16>>2]=0;c[D>>2]=v;v=h+48|0;c[v>>2]=0;D=h+52|0;c[D>>2]=0;B=h+56|0;c[B>>2]=0;A=me(20)|0;c[v>>2]=A;v=A+20|0;c[B>>2]=v;c[A>>2]=0;c[A+4>>2]=0;c[A+8>>2]=0;c[A+12>>2]=0;c[A+16>>2]=0;c[D>>2]=v;c[z>>2]=0;v=d+40|0;c[v>>2]=0;D=d+44|0;c[D>>2]=0;B=me(60)|0;c[v>>2]=B;c[z>>2]=B;c[D>>2]=B+60;c[B>>2]=0;D=B+4|0;c[D>>2]=0;z=B+8|0;c[z>>2]=0;E=me(20)|0;c[B>>2]=E;c[z>>2]=E+20;c[E>>2]=c[C>>2];c[E+4>>2]=c[C+4>>2];c[E+8>>2]=c[C+8>>2];c[E+12>>2]=c[C+12>>2];c[E+16>>2]=c[C+16>>2];c[D>>2]=E+20;E=B+12|0;c[v>>2]=E;c[E>>2]=0;D=B+16|0;c[D>>2]=0;C=B+20|0;c[C>>2]=0;z=me(20)|0;c[E>>2]=z;c[C>>2]=z+20;c[z>>2]=c[u>>2];c[z+4>>2]=c[u+4>>2];c[z+8>>2]=c[u+8>>2];c[z+12>>2]=c[u+12>>2];c[z+16>>2]=c[u+16>>2];c[D>>2]=z+20;z=B+24|0;c[v>>2]=z;c[z>>2]=0;D=B+28|0;c[D>>2]=0;u=B+32|0;c[u>>2]=0;C=me(20)|0;c[z>>2]=C;c[u>>2]=C+20;c[C>>2]=c[w>>2];c[C+4>>2]=c[w+4>>2];c[C+8>>2]=c[w+8>>2];c[C+12>>2]=c[w+12>>2];c[C+16>>2]=c[w+16>>2];c[D>>2]=C+20;C=B+36|0;c[v>>2]=C;c[C>>2]=0;D=B+40|0;c[D>>2]=0;w=B+44|0;c[w>>2]=0;u=me(20)|0;c[C>>2]=u;c[w>>2]=u+20;c[u>>2]=c[x>>2];c[u+4>>2]=c[x+4>>2];c[u+8>>2]=c[x+8>>2];c[u+12>>2]=c[x+12>>2];c[u+16>>2]=c[x+16>>2];c[D>>2]=u+20;u=B+48|0;c[v>>2]=u;c[u>>2]=0;D=B+52|0;c[D>>2]=0;x=B+56|0;c[x>>2]=0;w=me(20)|0;c[u>>2]=w;c[x>>2]=w+20;c[w>>2]=c[A>>2];c[w+4>>2]=c[A+4>>2];c[w+8>>2]=c[A+8>>2];c[w+12>>2]=c[A+12>>2];c[w+16>>2]=c[A+16>>2];c[D>>2]=w+20;c[v>>2]=B+60;B=d+48|0;c[i>>2]=0;v=i+4|0;c[v>>2]=0;w=i+8|0;c[w>>2]=0;D=me(20)|0;c[i>>2]=D;A=D+20|0;c[w>>2]=A;c[D>>2]=0;c[D+4>>2]=0;c[D+8>>2]=0;c[D+12>>2]=0;c[D+16>>2]=0;c[v>>2]=A;A=i+12|0;c[A>>2]=0;v=i+16|0;c[v>>2]=0;w=i+20|0;c[w>>2]=0;x=me(20)|0;c[A>>2]=x;A=x+20|0;c[w>>2]=A;c[x>>2]=0;c[x+4>>2]=0;c[x+8>>2]=1;c[x+12>>2]=0;c[x+16>>2]=0;c[v>>2]=A;A=i+24|0;c[A>>2]=0;v=i+28|0;c[v>>2]=0;w=i+32|0;c[w>>2]=0;u=me(20)|0;c[A>>2]=u;A=u+20|0;c[w>>2]=A;c[u>>2]=0;c[u+4>>2]=1;c[u+8>>2]=1;c[u+12>>2]=0;c[u+16>>2]=0;c[v>>2]=A;A=i+36|0;c[A>>2]=0;v=i+40|0;c[v>>2]=0;w=i+44|0;c[w>>2]=0;C=me(20)|0;c[A>>2]=C;A=C+20|0;c[w>>2]=A;c[C>>2]=0;c[C+4>>2]=0;c[C+8>>2]=1;c[C+12>>2]=1;c[C+16>>2]=0;c[v>>2]=A;A=i+48|0;c[A>>2]=0;v=i+52|0;c[v>>2]=0;w=i+56|0;c[w>>2]=0;z=me(20)|0;c[A>>2]=z;A=z+20|0;c[w>>2]=A;c[z>>2]=0;c[z+4>>2]=0;c[z+8>>2]=0;c[z+12>>2]=0;c[z+16>>2]=0;c[v>>2]=A;c[B>>2]=0;A=d+52|0;c[A>>2]=0;v=d+56|0;c[v>>2]=0;w=me(60)|0;c[A>>2]=w;c[B>>2]=w;c[v>>2]=w+60;c[w>>2]=0;v=w+4|0;c[v>>2]=0;B=w+8|0;c[B>>2]=0;E=me(20)|0;c[w>>2]=E;c[B>>2]=E+20;c[E>>2]=c[D>>2];c[E+4>>2]=c[D+4>>2];c[E+8>>2]=c[D+8>>2];c[E+12>>2]=c[D+12>>2];c[E+16>>2]=c[D+16>>2];c[v>>2]=E+20;E=w+12|0;c[A>>2]=E;c[E>>2]=0;v=w+16|0;c[v>>2]=0;D=w+20|0;c[D>>2]=0;B=me(20)|0;c[E>>2]=B;c[D>>2]=B+20;c[B>>2]=c[x>>2];c[B+4>>2]=c[x+4>>2];c[B+8>>2]=c[x+8>>2];c[B+12>>2]=c[x+12>>2];c[B+16>>2]=c[x+16>>2];c[v>>2]=B+20;B=w+24|0;c[A>>2]=B;c[B>>2]=0;v=w+28|0;c[v>>2]=0;x=w+32|0;c[x>>2]=0;D=me(20)|0;c[B>>2]=D;c[x>>2]=D+20;c[D>>2]=c[u>>2];c[D+4>>2]=c[u+4>>2];c[D+8>>2]=c[u+8>>2];c[D+12>>2]=c[u+12>>2];c[D+16>>2]=c[u+16>>2];c[v>>2]=D+20;D=w+36|0;c[A>>2]=D;c[D>>2]=0;v=w+40|0;c[v>>2]=0;u=w+44|0;c[u>>2]=0;x=me(20)|0;c[D>>2]=x;c[u>>2]=x+20;c[x>>2]=c[C>>2];c[x+4>>2]=c[C+4>>2];c[x+8>>2]=c[C+8>>2];c[x+12>>2]=c[C+12>>2];c[x+16>>2]=c[C+16>>2];c[v>>2]=x+20;x=w+48|0;c[A>>2]=x;c[x>>2]=0;v=w+52|0;c[v>>2]=0;C=w+56|0;c[C>>2]=0;u=me(20)|0;c[x>>2]=u;c[C>>2]=u+20;c[u>>2]=c[z>>2];c[u+4>>2]=c[z+4>>2];c[u+8>>2]=c[z+8>>2];c[u+12>>2]=c[z+12>>2];c[u+16>>2]=c[z+16>>2];c[v>>2]=u+20;c[A>>2]=w+60;w=d+60|0;c[j>>2]=0;A=j+4|0;c[A>>2]=0;u=j+8|0;c[u>>2]=0;v=me(20)|0;c[j>>2]=v;z=v+20|0;c[u>>2]=z;c[v>>2]=0;c[v+4>>2]=0;c[v+8>>2]=0;c[v+12>>2]=0;c[v+16>>2]=0;c[A>>2]=z;z=j+12|0;c[z>>2]=0;A=j+16|0;c[A>>2]=0;u=j+20|0;c[u>>2]=0;C=me(20)|0;c[z>>2]=C;z=C+20|0;c[u>>2]=z;c[C>>2]=0;c[C+4>>2]=0;c[C+8>>2]=1;c[C+12>>2]=0;c[C+16>>2]=0;c[A>>2]=z;z=j+24|0;c[z>>2]=0;A=j+28|0;c[A>>2]=0;u=j+32|0;c[u>>2]=0;x=me(20)|0;c[z>>2]=x;z=x+20|0;c[u>>2]=z;c[x>>2]=0;c[x+4>>2]=0;c[x+8>>2]=1;c[x+12>>2]=1;c[x+16>>2]=0;c[A>>2]=z;z=j+36|0;c[z>>2]=0;A=j+40|0;c[A>>2]=0;u=j+44|0;c[u>>2]=0;D=me(20)|0;c[z>>2]=D;z=D+20|0;c[u>>2]=z;c[D>>2]=0;c[D+4>>2]=1;c[D+8>>2]=1;c[D+12>>2]=0;c[D+16>>2]=0;c[A>>2]=z;z=j+48|0;c[z>>2]=0;A=j+52|0;c[A>>2]=0;u=j+56|0;c[u>>2]=0;B=me(20)|0;c[z>>2]=B;z=B+20|0;c[u>>2]=z;c[B>>2]=0;c[B+4>>2]=0;c[B+8>>2]=0;c[B+12>>2]=0;c[B+16>>2]=0;c[A>>2]=z;c[w>>2]=0;z=d+64|0;c[z>>2]=0;A=d+68|0;c[A>>2]=0;u=me(60)|0;c[z>>2]=u;c[w>>2]=u;c[A>>2]=u+60;c[u>>2]=0;A=u+4|0;c[A>>2]=0;w=u+8|0;c[w>>2]=0;E=me(20)|0;c[u>>2]=E;c[w>>2]=E+20;c[E>>2]=c[v>>2];c[E+4>>2]=c[v+4>>2];c[E+8>>2]=c[v+8>>2];c[E+12>>2]=c[v+12>>2];c[E+16>>2]=c[v+16>>2];c[A>>2]=E+20;E=u+12|0;c[z>>2]=E;c[E>>2]=0;A=u+16|0;c[A>>2]=0;v=u+20|0;c[v>>2]=0;w=me(20)|0;c[E>>2]=w;c[v>>2]=w+20;c[w>>2]=c[C>>2];c[w+4>>2]=c[C+4>>2];c[w+8>>2]=c[C+8>>2];c[w+12>>2]=c[C+12>>2];c[w+16>>2]=c[C+16>>2];c[A>>2]=w+20;w=u+24|0;c[z>>2]=w;c[w>>2]=0;A=u+28|0;c[A>>2]=0;C=u+32|0;c[C>>2]=0;v=me(20)|0;c[w>>2]=v;c[C>>2]=v+20;c[v>>2]=c[x>>2];c[v+4>>2]=c[x+4>>2];c[v+8>>2]=c[x+8>>2];c[v+12>>2]=c[x+12>>2];c[v+16>>2]=c[x+16>>2];c[A>>2]=v+20;v=u+36|0;c[z>>2]=v;c[v>>2]=0;A=u+40|0;c[A>>2]=0;x=u+44|0;c[x>>2]=0;C=me(20)|0;c[v>>2]=C;c[x>>2]=C+20;c[C>>2]=c[D>>2];c[C+4>>2]=c[D+4>>2];c[C+8>>2]=c[D+8>>2];c[C+12>>2]=c[D+12>>2];c[C+16>>2]=c[D+16>>2];c[A>>2]=C+20;C=u+48|0;c[z>>2]=C;c[C>>2]=0;A=u+52|0;c[A>>2]=0;D=u+56|0;c[D>>2]=0;x=me(20)|0;c[C>>2]=x;c[D>>2]=x+20;c[x>>2]=c[B>>2];c[x+4>>2]=c[B+4>>2];c[x+8>>2]=c[B+8>>2];c[x+12>>2]=c[B+12>>2];c[x+16>>2]=c[B+16>>2];c[A>>2]=x+20;c[z>>2]=u+60;u=d+72|0;c[k>>2]=0;z=k+4|0;c[z>>2]=0;x=k+8|0;c[x>>2]=0;A=me(20)|0;c[k>>2]=A;B=A+20|0;c[x>>2]=B;c[A>>2]=0;c[A+4>>2]=0;c[A+8>>2]=0;c[A+12>>2]=0;c[A+16>>2]=0;c[z>>2]=B;B=k+12|0;c[B>>2]=0;z=k+16|0;c[z>>2]=0;x=k+20|0;c[x>>2]=0;D=me(20)|0;c[B>>2]=D;B=D+20|0;c[x>>2]=B;c[D>>2]=0;c[D+4>>2]=0;c[D+8>>2]=0;c[D+12>>2]=0;c[D+16>>2]=0;c[z>>2]=B;B=k+24|0;c[B>>2]=0;z=k+28|0;c[z>>2]=0;x=k+32|0;c[x>>2]=0;C=me(20)|0;c[B>>2]=C;B=C+20|0;c[x>>2]=B;c[C>>2]=0;c[C+4>>2]=1;c[C+8>>2]=0;c[C+12>>2]=1;c[C+16>>2]=0;c[z>>2]=B;B=k+36|0;c[B>>2]=0;z=k+40|0;c[z>>2]=0;x=k+44|0;c[x>>2]=0;v=me(20)|0;c[B>>2]=v;B=v+20|0;c[x>>2]=B;c[v>>2]=0;c[v+4>>2]=1;c[v+8>>2]=1;c[v+12>>2]=1;c[v+16>>2]=0;c[z>>2]=B;B=k+48|0;c[B>>2]=0;z=k+52|0;c[z>>2]=0;x=k+56|0;c[x>>2]=0;w=me(20)|0;c[B>>2]=w;B=w+20|0;c[x>>2]=B;c[w>>2]=0;c[w+4>>2]=0;c[w+8>>2]=0;c[w+12>>2]=0;c[w+16>>2]=0;c[z>>2]=B;c[u>>2]=0;B=d+76|0;c[B>>2]=0;z=d+80|0;c[z>>2]=0;x=me(60)|0;c[B>>2]=x;c[u>>2]=x;c[z>>2]=x+60;c[x>>2]=0;z=x+4|0;c[z>>2]=0;u=x+8|0;c[u>>2]=0;E=me(20)|0;c[x>>2]=E;c[u>>2]=E+20;c[E>>2]=c[A>>2];c[E+4>>2]=c[A+4>>2];c[E+8>>2]=c[A+8>>2];c[E+12>>2]=c[A+12>>2];c[E+16>>2]=c[A+16>>2];c[z>>2]=E+20;E=x+12|0;c[B>>2]=E;c[E>>2]=0;z=x+16|0;c[z>>2]=0;A=x+20|0;c[A>>2]=0;u=me(20)|0;c[E>>2]=u;c[A>>2]=u+20;c[u>>2]=c[D>>2];c[u+4>>2]=c[D+4>>2];c[u+8>>2]=c[D+8>>2];c[u+12>>2]=c[D+12>>2];c[u+16>>2]=c[D+16>>2];c[z>>2]=u+20;u=x+24|0;c[B>>2]=u;c[u>>2]=0;z=x+28|0;c[z>>2]=0;D=x+32|0;c[D>>2]=0;A=me(20)|0;c[u>>2]=A;c[D>>2]=A+20;c[A>>2]=c[C>>2];c[A+4>>2]=c[C+4>>2];c[A+8>>2]=c[C+8>>2];c[A+12>>2]=c[C+12>>2];c[A+16>>2]=c[C+16>>2];c[z>>2]=A+20;A=x+36|0;c[B>>2]=A;c[A>>2]=0;z=x+40|0;c[z>>2]=0;C=x+44|0;c[C>>2]=0;D=me(20)|0;c[A>>2]=D;c[C>>2]=D+20;c[D>>2]=c[v>>2];c[D+4>>2]=c[v+4>>2];c[D+8>>2]=c[v+8>>2];c[D+12>>2]=c[v+12>>2];c[D+16>>2]=c[v+16>>2];c[z>>2]=D+20;D=x+48|0;c[B>>2]=D;c[D>>2]=0;z=x+52|0;c[z>>2]=0;v=x+56|0;c[v>>2]=0;C=me(20)|0;c[D>>2]=C;c[v>>2]=C+20;c[C>>2]=c[w>>2];c[C+4>>2]=c[w+4>>2];c[C+8>>2]=c[w+8>>2];c[C+12>>2]=c[w+12>>2];c[C+16>>2]=c[w+16>>2];c[z>>2]=C+20;c[B>>2]=x+60;x=d+84|0;c[l>>2]=0;B=l+4|0;c[B>>2]=0;C=l+8|0;c[C>>2]=0;z=me(20)|0;c[l>>2]=z;w=z+20|0;c[C>>2]=w;c[z>>2]=0;c[z+4>>2]=0;c[z+8>>2]=0;c[z+12>>2]=0;c[z+16>>2]=0;c[B>>2]=w;w=l+12|0;c[w>>2]=0;B=l+16|0;c[B>>2]=0;C=l+20|0;c[C>>2]=0;v=me(20)|0;c[w>>2]=v;w=v+20|0;c[C>>2]=w;c[v>>2]=0;c[v+4>>2]=0;c[v+8>>2]=1;c[v+12>>2]=0;c[v+16>>2]=0;c[B>>2]=w;w=l+24|0;c[w>>2]=0;B=l+28|0;c[B>>2]=0;C=l+32|0;c[C>>2]=0;D=me(20)|0;c[w>>2]=D;w=D+20|0;c[C>>2]=w;c[D>>2]=0;c[D+4>>2]=0;c[D+8>>2]=1;c[D+12>>2]=0;c[D+16>>2]=0;c[B>>2]=w;w=l+36|0;c[w>>2]=0;B=l+40|0;c[B>>2]=0;C=l+44|0;c[C>>2]=0;A=me(20)|0;c[w>>2]=A;w=A+20|0;c[C>>2]=w;c[A>>2]=0;c[A+4>>2]=1;c[A+8>>2]=1;c[A+12>>2]=1;c[A+16>>2]=0;c[B>>2]=w;w=l+48|0;c[w>>2]=0;B=l+52|0;c[B>>2]=0;C=l+56|0;c[C>>2]=0;u=me(20)|0;c[w>>2]=u;w=u+20|0;c[C>>2]=w;c[u>>2]=0;c[u+4>>2]=0;c[u+8>>2]=0;c[u+12>>2]=0;c[u+16>>2]=0;c[B>>2]=w;c[x>>2]=0;w=d+88|0;c[w>>2]=0;B=d+92|0;c[B>>2]=0;C=me(60)|0;c[w>>2]=C;c[x>>2]=C;c[B>>2]=C+60;c[C>>2]=0;B=C+4|0;c[B>>2]=0;x=C+8|0;c[x>>2]=0;E=me(20)|0;c[C>>2]=E;c[x>>2]=E+20;c[E>>2]=c[z>>2];c[E+4>>2]=c[z+4>>2];c[E+8>>2]=c[z+8>>2];c[E+12>>2]=c[z+12>>2];c[E+16>>2]=c[z+16>>2];c[B>>2]=E+20;E=C+12|0;c[w>>2]=E;c[E>>2]=0;B=C+16|0;c[B>>2]=0;z=C+20|0;c[z>>2]=0;x=me(20)|0;c[E>>2]=x;c[z>>2]=x+20;c[x>>2]=c[v>>2];c[x+4>>2]=c[v+4>>2];c[x+8>>2]=c[v+8>>2];c[x+12>>2]=c[v+12>>2];c[x+16>>2]=c[v+16>>2];c[B>>2]=x+20;x=C+24|0;c[w>>2]=x;c[x>>2]=0;B=C+28|0;c[B>>2]=0;v=C+32|0;c[v>>2]=0;z=me(20)|0;c[x>>2]=z;c[v>>2]=z+20;c[z>>2]=c[D>>2];c[z+4>>2]=c[D+4>>2];c[z+8>>2]=c[D+8>>2];c[z+12>>2]=c[D+12>>2];c[z+16>>2]=c[D+16>>2];c[B>>2]=z+20;z=C+36|0;c[w>>2]=z;c[z>>2]=0;B=C+40|0;c[B>>2]=0;D=C+44|0;c[D>>2]=0;v=me(20)|0;c[z>>2]=v;c[D>>2]=v+20;c[v>>2]=c[A>>2];c[v+4>>2]=c[A+4>>2];c[v+8>>2]=c[A+8>>2];c[v+12>>2]=c[A+12>>2];c[v+16>>2]=c[A+16>>2];c[B>>2]=v+20;v=C+48|0;c[w>>2]=v;c[v>>2]=0;B=C+52|0;c[B>>2]=0;A=C+56|0;c[A>>2]=0;D=me(20)|0;c[v>>2]=D;c[A>>2]=D+20;c[D>>2]=c[u>>2];c[D+4>>2]=c[u+4>>2];c[D+8>>2]=c[u+8>>2];c[D+12>>2]=c[u+12>>2];c[D+16>>2]=c[u+16>>2];c[B>>2]=D+20;c[w>>2]=C+60;C=d+96|0;c[m>>2]=0;w=m+4|0;c[w>>2]=0;D=m+8|0;c[D>>2]=0;B=me(20)|0;c[m>>2]=B;u=B+20|0;c[D>>2]=u;c[B>>2]=0;c[B+4>>2]=0;c[B+8>>2]=0;c[B+12>>2]=0;c[B+16>>2]=0;c[w>>2]=u;u=m+12|0;c[u>>2]=0;w=m+16|0;c[w>>2]=0;D=m+20|0;c[D>>2]=0;A=me(20)|0;c[u>>2]=A;u=A+20|0;c[D>>2]=u;c[A>>2]=0;c[A+4>>2]=0;c[A+8>>2]=1;c[A+12>>2]=0;c[A+16>>2]=0;c[w>>2]=u;u=m+24|0;c[u>>2]=0;w=m+28|0;c[w>>2]=0;D=m+32|0;c[D>>2]=0;v=me(20)|0;c[u>>2]=v;u=v+20|0;c[D>>2]=u;c[v>>2]=0;c[v+4>>2]=1;c[v+8>>2]=1;c[v+12>>2]=1;c[v+16>>2]=0;c[w>>2]=u;u=m+36|0;c[u>>2]=0;w=m+40|0;c[w>>2]=0;D=m+44|0;c[D>>2]=0;z=me(20)|0;c[u>>2]=z;u=z+20|0;c[D>>2]=u;c[z>>2]=0;c[z+4>>2]=0;c[z+8>>2]=1;c[z+12>>2]=0;c[z+16>>2]=0;c[w>>2]=u;u=m+48|0;c[u>>2]=0;w=m+52|0;c[w>>2]=0;D=m+56|0;c[D>>2]=0;x=me(20)|0;c[u>>2]=x;u=x+20|0;c[D>>2]=u;c[x>>2]=0;c[x+4>>2]=0;c[x+8>>2]=0;c[x+12>>2]=0;c[x+16>>2]=0;c[w>>2]=u;c[C>>2]=0;u=d+100|0;c[u>>2]=0;w=d+104|0;c[w>>2]=0;D=me(60)|0;c[u>>2]=D;c[C>>2]=D;c[w>>2]=D+60;c[D>>2]=0;w=D+4|0;c[w>>2]=0;C=D+8|0;c[C>>2]=0;E=me(20)|0;c[D>>2]=E;c[C>>2]=E+20;c[E>>2]=c[B>>2];c[E+4>>2]=c[B+4>>2];c[E+8>>2]=c[B+8>>2];c[E+12>>2]=c[B+12>>2];c[E+16>>2]=c[B+16>>2];c[w>>2]=E+20;E=D+12|0;c[u>>2]=E;c[E>>2]=0;w=D+16|0;c[w>>2]=0;B=D+20|0;c[B>>2]=0;C=me(20)|0;c[E>>2]=C;c[B>>2]=C+20;c[C>>2]=c[A>>2];c[C+4>>2]=c[A+4>>2];c[C+8>>2]=c[A+8>>2];c[C+12>>2]=c[A+12>>2];c[C+16>>2]=c[A+16>>2];c[w>>2]=C+20;C=D+24|0;c[u>>2]=C;c[C>>2]=0;w=D+28|0;c[w>>2]=0;A=D+32|0;c[A>>2]=0;B=me(20)|0;c[C>>2]=B;c[A>>2]=B+20;c[B>>2]=c[v>>2];c[B+4>>2]=c[v+4>>2];c[B+8>>2]=c[v+8>>2];c[B+12>>2]=c[v+12>>2];c[B+16>>2]=c[v+16>>2];c[w>>2]=B+20;B=D+36|0;c[u>>2]=B;c[B>>2]=0;w=D+40|0;c[w>>2]=0;v=D+44|0;c[v>>2]=0;A=me(20)|0;c[B>>2]=A;c[v>>2]=A+20;c[A>>2]=c[z>>2];c[A+4>>2]=c[z+4>>2];c[A+8>>2]=c[z+8>>2];c[A+12>>2]=c[z+12>>2];c[A+16>>2]=c[z+16>>2];c[w>>2]=A+20;A=D+48|0;c[u>>2]=A;c[A>>2]=0;w=D+52|0;c[w>>2]=0;z=D+56|0;c[z>>2]=0;v=me(20)|0;c[A>>2]=v;c[z>>2]=v+20;c[v>>2]=c[x>>2];c[v+4>>2]=c[x+4>>2];c[v+8>>2]=c[x+8>>2];c[v+12>>2]=c[x+12>>2];c[v+16>>2]=c[x+16>>2];c[w>>2]=v+20;c[u>>2]=D+60;D=d+108|0;c[n>>2]=0;u=n+4|0;c[u>>2]=0;v=n+8|0;c[v>>2]=0;w=me(20)|0;c[n>>2]=w;x=w+20|0;c[v>>2]=x;c[w>>2]=0;c[w+4>>2]=0;c[w+8>>2]=0;c[w+12>>2]=0;c[w+16>>2]=0;c[u>>2]=x;x=n+12|0;c[x>>2]=0;u=n+16|0;c[u>>2]=0;v=n+20|0;c[v>>2]=0;z=me(20)|0;c[x>>2]=z;x=z+20|0;c[v>>2]=x;c[z>>2]=0;c[z+4>>2]=1;c[z+8>>2]=1;c[z+12>>2]=0;c[z+16>>2]=0;c[u>>2]=x;x=n+24|0;c[x>>2]=0;u=n+28|0;c[u>>2]=0;v=n+32|0;c[v>>2]=0;A=me(20)|0;c[x>>2]=A;x=A+20|0;c[v>>2]=x;c[A>>2]=0;c[A+4>>2]=1;c[A+8>>2]=1;c[A+12>>2]=0;c[A+16>>2]=0;c[u>>2]=x;x=n+36|0;c[x>>2]=0;u=n+40|0;c[u>>2]=0;v=n+44|0;c[v>>2]=0;B=me(20)|0;c[x>>2]=B;x=B+20|0;c[v>>2]=x;c[B>>2]=0;c[B+4>>2]=0;c[B+8>>2]=1;c[B+12>>2]=0;c[B+16>>2]=0;c[u>>2]=x;x=n+48|0;c[x>>2]=0;u=n+52|0;c[u>>2]=0;v=n+56|0;c[v>>2]=0;C=me(20)|0;c[x>>2]=C;x=C+20|0;c[v>>2]=x;c[C>>2]=0;c[C+4>>2]=0;c[C+8>>2]=0;c[C+12>>2]=0;c[C+16>>2]=0;c[u>>2]=x;c[D>>2]=0;x=d+112|0;c[x>>2]=0;u=d+116|0;c[u>>2]=0;v=me(60)|0;c[x>>2]=v;c[D>>2]=v;c[u>>2]=v+60;c[v>>2]=0;u=v+4|0;c[u>>2]=0;D=v+8|0;c[D>>2]=0;E=me(20)|0;c[v>>2]=E;c[D>>2]=E+20;c[E>>2]=c[w>>2];c[E+4>>2]=c[w+4>>2];c[E+8>>2]=c[w+8>>2];c[E+12>>2]=c[w+12>>2];c[E+16>>2]=c[w+16>>2];c[u>>2]=E+20;E=v+12|0;c[x>>2]=E;c[E>>2]=0;u=v+16|0;c[u>>2]=0;w=v+20|0;c[w>>2]=0;D=me(20)|0;c[E>>2]=D;c[w>>2]=D+20;c[D>>2]=c[z>>2];c[D+4>>2]=c[z+4>>2];c[D+8>>2]=c[z+8>>2];c[D+12>>2]=c[z+12>>2];c[D+16>>2]=c[z+16>>2];c[u>>2]=D+20;D=v+24|0;c[x>>2]=D;c[D>>2]=0;u=v+28|0;c[u>>2]=0;z=v+32|0;c[z>>2]=0;w=me(20)|0;c[D>>2]=w;c[z>>2]=w+20;c[w>>2]=c[A>>2];c[w+4>>2]=c[A+4>>2];c[w+8>>2]=c[A+8>>2];c[w+12>>2]=c[A+12>>2];c[w+16>>2]=c[A+16>>2];c[u>>2]=w+20;w=v+36|0;c[x>>2]=w;c[w>>2]=0;u=v+40|0;c[u>>2]=0;A=v+44|0;c[A>>2]=0;z=me(20)|0;c[w>>2]=z;c[A>>2]=z+20;c[z>>2]=c[B>>2];c[z+4>>2]=c[B+4>>2];c[z+8>>2]=c[B+8>>2];c[z+12>>2]=c[B+12>>2];c[z+16>>2]=c[B+16>>2];c[u>>2]=z+20;z=v+48|0;c[x>>2]=z;c[z>>2]=0;u=v+52|0;c[u>>2]=0;B=v+56|0;c[B>>2]=0;A=me(20)|0;c[z>>2]=A;c[B>>2]=A+20;c[A>>2]=c[C>>2];c[A+4>>2]=c[C+4>>2];c[A+8>>2]=c[C+8>>2];c[A+12>>2]=c[C+12>>2];c[A+16>>2]=c[C+16>>2];c[u>>2]=A+20;c[x>>2]=v+60;v=d+120|0;c[o>>2]=0;x=o+4|0;c[x>>2]=0;A=o+8|0;c[A>>2]=0;u=me(20)|0;c[o>>2]=u;C=u+20|0;c[A>>2]=C;c[u>>2]=0;c[u+4>>2]=0;c[u+8>>2]=0;c[u+12>>2]=0;c[u+16>>2]=0;c[x>>2]=C;C=o+12|0;c[C>>2]=0;x=o+16|0;c[x>>2]=0;A=o+20|0;c[A>>2]=0;B=me(20)|0;c[C>>2]=B;C=B+20|0;c[A>>2]=C;c[B>>2]=0;c[B+4>>2]=0;c[B+8>>2]=1;c[B+12>>2]=1;c[B+16>>2]=0;c[x>>2]=C;C=o+24|0;c[C>>2]=0;x=o+28|0;c[x>>2]=0;A=o+32|0;c[A>>2]=0;z=me(20)|0;c[C>>2]=z;C=z+20|0;c[A>>2]=C;c[z>>2]=0;c[z+4>>2]=0;c[z+8>>2]=1;c[z+12>>2]=1;c[z+16>>2]=0;c[x>>2]=C;C=o+36|0;c[C>>2]=0;x=o+40|0;c[x>>2]=0;A=o+44|0;c[A>>2]=0;w=me(20)|0;c[C>>2]=w;C=w+20|0;c[A>>2]=C;c[w>>2]=0;c[w+4>>2]=0;c[w+8>>2]=1;c[w+12>>2]=0;c[w+16>>2]=0;c[x>>2]=C;C=o+48|0;c[C>>2]=0;x=o+52|0;c[x>>2]=0;A=o+56|0;c[A>>2]=0;D=me(20)|0;c[C>>2]=D;C=D+20|0;c[A>>2]=C;c[D>>2]=0;c[D+4>>2]=0;c[D+8>>2]=0;c[D+12>>2]=0;c[D+16>>2]=0;c[x>>2]=C;c[v>>2]=0;C=d+124|0;c[C>>2]=0;x=d+128|0;c[x>>2]=0;A=me(60)|0;c[C>>2]=A;c[v>>2]=A;c[x>>2]=A+60;c[A>>2]=0;x=A+4|0;c[x>>2]=0;v=A+8|0;c[v>>2]=0;E=me(20)|0;c[A>>2]=E;c[v>>2]=E+20;c[E>>2]=c[u>>2];c[E+4>>2]=c[u+4>>2];c[E+8>>2]=c[u+8>>2];c[E+12>>2]=c[u+12>>2];c[E+16>>2]=c[u+16>>2];c[x>>2]=E+20;E=A+12|0;c[C>>2]=E;c[E>>2]=0;x=A+16|0;c[x>>2]=0;u=A+20|0;c[u>>2]=0;v=me(20)|0;c[E>>2]=v;c[u>>2]=v+20;c[v>>2]=c[B>>2];c[v+4>>2]=c[B+4>>2];c[v+8>>2]=c[B+8>>2];c[v+12>>2]=c[B+12>>2];c[v+16>>2]=c[B+16>>2];c[x>>2]=v+20;v=A+24|0;c[C>>2]=v;c[v>>2]=0;x=A+28|0;c[x>>2]=0;B=A+32|0;c[B>>2]=0;u=me(20)|0;c[v>>2]=u;c[B>>2]=u+20;c[u>>2]=c[z>>2];c[u+4>>2]=c[z+4>>2];c[u+8>>2]=c[z+8>>2];c[u+12>>2]=c[z+12>>2];c[u+16>>2]=c[z+16>>2];c[x>>2]=u+20;u=A+36|0;c[C>>2]=u;c[u>>2]=0;x=A+40|0;c[x>>2]=0;z=A+44|0;c[z>>2]=0;B=me(20)|0;c[u>>2]=B;c[z>>2]=B+20;c[B>>2]=c[w>>2];c[B+4>>2]=c[w+4>>2];c[B+8>>2]=c[w+8>>2];c[B+12>>2]=c[w+12>>2];c[B+16>>2]=c[w+16>>2];c[x>>2]=B+20;B=A+48|0;c[C>>2]=B;c[B>>2]=0;x=A+52|0;c[x>>2]=0;w=A+56|0;c[w>>2]=0;z=me(20)|0;c[B>>2]=z;c[w>>2]=z+20;c[z>>2]=c[D>>2];c[z+4>>2]=c[D+4>>2];c[z+8>>2]=c[D+8>>2];c[z+12>>2]=c[D+12>>2];c[z+16>>2]=c[D+16>>2];c[x>>2]=z+20;c[C>>2]=A+60;A=d+132|0;c[p>>2]=0;C=p+4|0;c[C>>2]=0;z=p+8|0;c[z>>2]=0;x=me(20)|0;c[p>>2]=x;D=x+20|0;c[z>>2]=D;c[x>>2]=0;c[x+4>>2]=0;c[x+8>>2]=0;c[x+12>>2]=0;c[x+16>>2]=0;c[C>>2]=D;D=p+12|0;c[D>>2]=0;C=p+16|0;c[C>>2]=0;z=p+20|0;c[z>>2]=0;w=me(20)|0;c[D>>2]=w;D=w+20|0;c[z>>2]=D;c[w>>2]=0;c[w+4>>2]=0;c[w+8>>2]=0;c[w+12>>2]=0;c[w+16>>2]=0;c[C>>2]=D;D=p+24|0;c[D>>2]=0;C=p+28|0;c[C>>2]=0;z=p+32|0;c[z>>2]=0;B=me(20)|0;c[D>>2]=B;D=B+20|0;c[z>>2]=D;c[B>>2]=1;c[B+4>>2]=1;c[B+8>>2]=1;c[B+12>>2]=0;c[B+16>>2]=0;c[C>>2]=D;D=p+36|0;c[D>>2]=0;C=p+40|0;c[C>>2]=0;z=p+44|0;c[z>>2]=0;u=me(20)|0;c[D>>2]=u;D=u+20|0;c[z>>2]=D;c[u>>2]=0;c[u+4>>2]=0;c[u+8>>2]=1;c[u+12>>2]=1;c[u+16>>2]=0;c[C>>2]=D;D=p+48|0;c[D>>2]=0;C=p+52|0;c[C>>2]=0;z=p+56|0;c[z>>2]=0;v=me(20)|0;c[D>>2]=v;D=v+20|0;c[z>>2]=D;c[v>>2]=0;c[v+4>>2]=0;c[v+8>>2]=0;c[v+12>>2]=0;c[v+16>>2]=0;c[C>>2]=D;c[A>>2]=0;D=d+136|0;c[D>>2]=0;C=d+140|0;c[C>>2]=0;z=me(60)|0;c[D>>2]=z;c[A>>2]=z;c[C>>2]=z+60;c[z>>2]=0;C=z+4|0;c[C>>2]=0;A=z+8|0;c[A>>2]=0;E=me(20)|0;c[z>>2]=E;c[A>>2]=E+20;c[E>>2]=c[x>>2];c[E+4>>2]=c[x+4>>2];c[E+8>>2]=c[x+8>>2];c[E+12>>2]=c[x+12>>2];c[E+16>>2]=c[x+16>>2];c[C>>2]=E+20;E=z+12|0;c[D>>2]=E;c[E>>2]=0;C=z+16|0;c[C>>2]=0;x=z+20|0;c[x>>2]=0;A=me(20)|0;c[E>>2]=A;c[x>>2]=A+20;c[A>>2]=c[w>>2];c[A+4>>2]=c[w+4>>2];c[A+8>>2]=c[w+8>>2];c[A+12>>2]=c[w+12>>2];c[A+16>>2]=c[w+16>>2];c[C>>2]=A+20;A=z+24|0;c[D>>2]=A;c[A>>2]=0;C=z+28|0;c[C>>2]=0;w=z+32|0;c[w>>2]=0;x=me(20)|0;c[A>>2]=x;c[w>>2]=x+20;c[x>>2]=c[B>>2];c[x+4>>2]=c[B+4>>2];c[x+8>>2]=c[B+8>>2];c[x+12>>2]=c[B+12>>2];c[x+16>>2]=c[B+16>>2];c[C>>2]=x+20;x=z+36|0;c[D>>2]=x;c[x>>2]=0;C=z+40|0;c[C>>2]=0;B=z+44|0;c[B>>2]=0;w=me(20)|0;c[x>>2]=w;c[B>>2]=w+20;c[w>>2]=c[u>>2];c[w+4>>2]=c[u+4>>2];c[w+8>>2]=c[u+8>>2];c[w+12>>2]=c[u+12>>2];c[w+16>>2]=c[u+16>>2];c[C>>2]=w+20;w=z+48|0;c[D>>2]=w;c[w>>2]=0;C=z+52|0;c[C>>2]=0;u=z+56|0;c[u>>2]=0;B=me(20)|0;c[w>>2]=B;c[u>>2]=B+20;c[B>>2]=c[v>>2];c[B+4>>2]=c[v+4>>2];c[B+8>>2]=c[v+8>>2];c[B+12>>2]=c[v+12>>2];c[B+16>>2]=c[v+16>>2];c[C>>2]=B+20;c[D>>2]=z+60;z=d+144|0;c[q>>2]=0;D=q+4|0;c[D>>2]=0;B=q+8|0;c[B>>2]=0;C=me(20)|0;c[q>>2]=C;v=C+20|0;c[B>>2]=v;c[C>>2]=0;c[C+4>>2]=0;c[C+8>>2]=0;c[C+12>>2]=0;c[C+16>>2]=0;c[D>>2]=v;v=q+12|0;c[v>>2]=0;D=q+16|0;c[D>>2]=0;B=q+20|0;c[B>>2]=0;u=me(20)|0;c[v>>2]=u;v=u+20|0;c[B>>2]=v;c[u>>2]=0;c[u+4>>2]=0;c[u+8>>2]=0;c[u+12>>2]=0;c[u+16>>2]=0;c[D>>2]=v;v=q+24|0;c[v>>2]=0;D=q+28|0;c[D>>2]=0;B=q+32|0;c[B>>2]=0;w=me(20)|0;c[v>>2]=w;v=w+20|0;c[B>>2]=v;c[w>>2]=1;c[w+4>>2]=1;c[w+8>>2]=0;c[w+12>>2]=0;c[w+16>>2]=0;c[D>>2]=v;v=q+36|0;c[v>>2]=0;D=q+40|0;c[D>>2]=0;B=q+44|0;c[B>>2]=0;x=me(20)|0;c[v>>2]=x;v=x+20|0;c[B>>2]=v;c[x>>2]=0;c[x+4>>2]=1;c[x+8>>2]=1;c[x+12>>2]=1;c[x+16>>2]=0;c[D>>2]=v;v=q+48|0;c[v>>2]=0;D=q+52|0;c[D>>2]=0;B=q+56|0;c[B>>2]=0;A=me(20)|0;c[v>>2]=A;v=A+20|0;c[B>>2]=v;c[A>>2]=0;c[A+4>>2]=0;c[A+8>>2]=0;c[A+12>>2]=0;c[A+16>>2]=0;c[D>>2]=v;c[z>>2]=0;v=d+148|0;c[v>>2]=0;D=d+152|0;c[D>>2]=0;B=me(60)|0;c[v>>2]=B;c[z>>2]=B;c[D>>2]=B+60;c[B>>2]=0;D=B+4|0;c[D>>2]=0;z=B+8|0;c[z>>2]=0;E=me(20)|0;c[B>>2]=E;c[z>>2]=E+20;c[E>>2]=c[C>>2];c[E+4>>2]=c[C+4>>2];c[E+8>>2]=c[C+8>>2];c[E+12>>2]=c[C+12>>2];c[E+16>>2]=c[C+16>>2];c[D>>2]=E+20;E=B+12|0;c[v>>2]=E;c[E>>2]=0;D=B+16|0;c[D>>2]=0;C=B+20|0;c[C>>2]=0;z=me(20)|0;c[E>>2]=z;c[C>>2]=z+20;c[z>>2]=c[u>>2];c[z+4>>2]=c[u+4>>2];c[z+8>>2]=c[u+8>>2];c[z+12>>2]=c[u+12>>2];c[z+16>>2]=c[u+16>>2];c[D>>2]=z+20;z=B+24|0;c[v>>2]=z;c[z>>2]=0;D=B+28|0;c[D>>2]=0;u=B+32|0;c[u>>2]=0;C=me(20)|0;c[z>>2]=C;c[u>>2]=C+20;c[C>>2]=c[w>>2];c[C+4>>2]=c[w+4>>2];c[C+8>>2]=c[w+8>>2];c[C+12>>2]=c[w+12>>2];c[C+16>>2]=c[w+16>>2];c[D>>2]=C+20;C=B+36|0;c[v>>2]=C;c[C>>2]=0;D=B+40|0;c[D>>2]=0;w=B+44|0;c[w>>2]=0;u=me(20)|0;c[C>>2]=u;c[w>>2]=u+20;c[u>>2]=c[x>>2];c[u+4>>2]=c[x+4>>2];c[u+8>>2]=c[x+8>>2];c[u+12>>2]=c[x+12>>2];c[u+16>>2]=c[x+16>>2];c[D>>2]=u+20;u=B+48|0;c[v>>2]=u;c[u>>2]=0;D=B+52|0;c[D>>2]=0;x=B+56|0;c[x>>2]=0;w=me(20)|0;c[u>>2]=w;c[x>>2]=w+20;c[w>>2]=c[A>>2];c[w+4>>2]=c[A+4>>2];c[w+8>>2]=c[A+8>>2];c[w+12>>2]=c[A+12>>2];c[w+16>>2]=c[A+16>>2];c[D>>2]=w+20;c[v>>2]=B+60;B=d+156|0;c[r>>2]=0;v=r+4|0;c[v>>2]=0;w=r+8|0;c[w>>2]=0;D=me(20)|0;c[r>>2]=D;A=D+20|0;c[w>>2]=A;c[D>>2]=0;c[D+4>>2]=0;c[D+8>>2]=0;c[D+12>>2]=0;c[D+16>>2]=0;c[v>>2]=A;A=r+12|0;c[A>>2]=0;v=r+16|0;c[v>>2]=0;w=r+20|0;c[w>>2]=0;x=me(20)|0;c[A>>2]=x;A=x+20|0;c[w>>2]=A;c[x>>2]=0;c[x+4>>2]=1;c[x+8>>2]=0;c[x+12>>2]=0;c[x+16>>2]=0;c[v>>2]=A;A=r+24|0;c[A>>2]=0;v=r+28|0;c[v>>2]=0;w=r+32|0;c[w>>2]=0;u=me(20)|0;c[A>>2]=u;A=u+20|0;c[w>>2]=A;c[u>>2]=0;c[u+4>>2]=1;c[u+8>>2]=1;c[u+12>>2]=1;c[u+16>>2]=0;c[v>>2]=A;A=r+36|0;c[A>>2]=0;v=r+40|0;c[v>>2]=0;w=r+44|0;c[w>>2]=0;C=me(20)|0;c[A>>2]=C;A=C+20|0;c[w>>2]=A;c[C>>2]=0;c[C+4>>2]=0;c[C+8>>2]=0;c[C+12>>2]=1;c[C+16>>2]=0;c[v>>2]=A;A=r+48|0;c[A>>2]=0;v=r+52|0;c[v>>2]=0;w=r+56|0;c[w>>2]=0;z=me(20)|0;c[A>>2]=z;A=z+20|0;c[w>>2]=A;c[z>>2]=0;c[z+4>>2]=0;c[z+8>>2]=0;c[z+12>>2]=0;c[z+16>>2]=0;c[v>>2]=A;c[B>>2]=0;A=d+160|0;c[A>>2]=0;v=d+164|0;c[v>>2]=0;w=me(60)|0;c[A>>2]=w;c[B>>2]=w;c[v>>2]=w+60;c[w>>2]=0;v=w+4|0;c[v>>2]=0;B=w+8|0;c[B>>2]=0;E=me(20)|0;c[w>>2]=E;c[B>>2]=E+20;c[E>>2]=c[D>>2];c[E+4>>2]=c[D+4>>2];c[E+8>>2]=c[D+8>>2];c[E+12>>2]=c[D+12>>2];c[E+16>>2]=c[D+16>>2];c[v>>2]=E+20;E=w+12|0;c[A>>2]=E;c[E>>2]=0;v=w+16|0;c[v>>2]=0;D=w+20|0;c[D>>2]=0;B=me(20)|0;c[E>>2]=B;c[D>>2]=B+20;c[B>>2]=c[x>>2];c[B+4>>2]=c[x+4>>2];c[B+8>>2]=c[x+8>>2];c[B+12>>2]=c[x+12>>2];c[B+16>>2]=c[x+16>>2];c[v>>2]=B+20;B=w+24|0;c[A>>2]=B;c[B>>2]=0;v=w+28|0;c[v>>2]=0;x=w+32|0;c[x>>2]=0;D=me(20)|0;c[B>>2]=D;c[x>>2]=D+20;c[D>>2]=c[u>>2];c[D+4>>2]=c[u+4>>2];c[D+8>>2]=c[u+8>>2];c[D+12>>2]=c[u+12>>2];c[D+16>>2]=c[u+16>>2];c[v>>2]=D+20;D=w+36|0;c[A>>2]=D;c[D>>2]=0;v=w+40|0;c[v>>2]=0;u=w+44|0;c[u>>2]=0;x=me(20)|0;c[D>>2]=x;c[u>>2]=x+20;c[x>>2]=c[C>>2];c[x+4>>2]=c[C+4>>2];c[x+8>>2]=c[C+8>>2];c[x+12>>2]=c[C+12>>2];c[x+16>>2]=c[C+16>>2];c[v>>2]=x+20;x=w+48|0;c[A>>2]=x;c[x>>2]=0;v=w+52|0;c[v>>2]=0;C=w+56|0;c[C>>2]=0;u=me(20)|0;c[x>>2]=u;c[C>>2]=u+20;c[u>>2]=c[z>>2];c[u+4>>2]=c[z+4>>2];c[u+8>>2]=c[z+8>>2];c[u+12>>2]=c[z+12>>2];c[u+16>>2]=c[z+16>>2];c[v>>2]=u+20;c[A>>2]=w+60;w=d+168|0;c[s>>2]=0;A=s+4|0;c[A>>2]=0;u=s+8|0;c[u>>2]=0;v=me(20)|0;c[s>>2]=v;z=v+20|0;c[u>>2]=z;c[v>>2]=0;c[v+4>>2]=0;c[v+8>>2]=0;c[v+12>>2]=0;c[v+16>>2]=0;c[A>>2]=z;z=s+12|0;c[z>>2]=0;A=s+16|0;c[A>>2]=0;u=s+20|0;c[u>>2]=0;C=me(20)|0;c[z>>2]=C;z=C+20|0;c[u>>2]=z;c[C>>2]=0;c[C+4>>2]=0;c[C+8>>2]=0;c[C+12>>2]=1;c[C+16>>2]=0;c[A>>2]=z;z=s+24|0;c[z>>2]=0;A=s+28|0;c[A>>2]=0;u=s+32|0;c[u>>2]=0;x=me(20)|0;c[z>>2]=x;z=x+20|0;c[u>>2]=z;c[x>>2]=0;c[x+4>>2]=1;c[x+8>>2]=1;c[x+12>>2]=1;c[x+16>>2]=0;c[A>>2]=z;z=s+36|0;c[z>>2]=0;A=s+40|0;c[A>>2]=0;u=s+44|0;c[u>>2]=0;D=me(20)|0;c[z>>2]=D;z=D+20|0;c[u>>2]=z;c[D>>2]=0;c[D+4>>2]=1;c[D+8>>2]=0;c[D+12>>2]=0;c[D+16>>2]=0;c[A>>2]=z;z=s+48|0;c[z>>2]=0;A=s+52|0;c[A>>2]=0;u=s+56|0;c[u>>2]=0;B=me(20)|0;c[z>>2]=B;z=B+20|0;c[u>>2]=z;c[B>>2]=0;c[B+4>>2]=0;c[B+8>>2]=0;c[B+12>>2]=0;c[B+16>>2]=0;c[A>>2]=z;c[w>>2]=0;z=d+172|0;c[z>>2]=0;A=d+176|0;c[A>>2]=0;u=me(60)|0;c[z>>2]=u;c[w>>2]=u;c[A>>2]=u+60;c[u>>2]=0;A=u+4|0;c[A>>2]=0;w=u+8|0;c[w>>2]=0;E=me(20)|0;c[u>>2]=E;c[w>>2]=E+20;c[E>>2]=c[v>>2];c[E+4>>2]=c[v+4>>2];c[E+8>>2]=c[v+8>>2];c[E+12>>2]=c[v+12>>2];c[E+16>>2]=c[v+16>>2];c[A>>2]=E+20;E=u+12|0;c[z>>2]=E;c[E>>2]=0;A=u+16|0;c[A>>2]=0;v=u+20|0;c[v>>2]=0;w=me(20)|0;c[E>>2]=w;c[v>>2]=w+20;c[w>>2]=c[C>>2];c[w+4>>2]=c[C+4>>2];c[w+8>>2]=c[C+8>>2];c[w+12>>2]=c[C+12>>2];c[w+16>>2]=c[C+16>>2];c[A>>2]=w+20;w=u+24|0;c[z>>2]=w;c[w>>2]=0;A=u+28|0;c[A>>2]=0;C=u+32|0;c[C>>2]=0;v=me(20)|0;c[w>>2]=v;c[C>>2]=v+20;c[v>>2]=c[x>>2];c[v+4>>2]=c[x+4>>2];c[v+8>>2]=c[x+8>>2];c[v+12>>2]=c[x+12>>2];c[v+16>>2]=c[x+16>>2];c[A>>2]=v+20;v=u+36|0;c[z>>2]=v;c[v>>2]=0;A=u+40|0;c[A>>2]=0;x=u+44|0;c[x>>2]=0;C=me(20)|0;c[v>>2]=C;c[x>>2]=C+20;c[C>>2]=c[D>>2];c[C+4>>2]=c[D+4>>2];c[C+8>>2]=c[D+8>>2];c[C+12>>2]=c[D+12>>2];c[C+16>>2]=c[D+16>>2];c[A>>2]=C+20;C=u+48|0;c[z>>2]=C;c[C>>2]=0;A=u+52|0;c[A>>2]=0;D=u+56|0;c[D>>2]=0;x=me(20)|0;c[C>>2]=x;c[D>>2]=x+20;c[x>>2]=c[B>>2];c[x+4>>2]=c[B+4>>2];c[x+8>>2]=c[B+8>>2];c[x+12>>2]=c[B+12>>2];c[x+16>>2]=c[B+16>>2];c[A>>2]=x+20;c[z>>2]=u+60;u=d+180|0;c[t>>2]=0;z=t+4|0;c[z>>2]=0;x=t+8|0;c[x>>2]=0;A=me(20)|0;c[t>>2]=A;B=A+20|0;c[x>>2]=B;c[A>>2]=0;c[A+4>>2]=0;c[A+8>>2]=0;c[A+12>>2]=0;c[A+16>>2]=0;c[z>>2]=B;B=t+12|0;c[B>>2]=0;z=t+16|0;c[z>>2]=0;x=t+20|0;c[x>>2]=0;D=me(20)|0;c[B>>2]=D;B=D+20|0;c[x>>2]=B;c[D>>2]=0;c[D+4>>2]=0;c[D+8>>2]=0;c[D+12>>2]=0;c[D+16>>2]=0;c[z>>2]=B;B=t+24|0;c[B>>2]=0;z=t+28|0;c[z>>2]=0;x=t+32|0;c[x>>2]=0;C=me(20)|0;c[B>>2]=C;B=C+20|0;c[x>>2]=B;c[C>>2]=1;c[C+4>>2]=1;c[C+8>>2]=1;c[C+12>>2]=1;c[C+16>>2]=1;c[z>>2]=B;B=t+36|0;c[B>>2]=0;z=t+40|0;c[z>>2]=0;x=t+44|0;c[x>>2]=0;v=me(20)|0;c[B>>2]=v;B=v+20|0;c[x>>2]=B;c[v>>2]=0;c[v+4>>2]=0;c[v+8>>2]=0;c[v+12>>2]=0;c[v+16>>2]=0;c[z>>2]=B;B=t+48|0;c[B>>2]=0;z=t+52|0;c[z>>2]=0;x=t+56|0;c[x>>2]=0;w=me(20)|0;c[B>>2]=w;B=w+20|0;c[x>>2]=B;c[w>>2]=0;c[w+4>>2]=0;c[w+8>>2]=0;c[w+12>>2]=0;c[w+16>>2]=0;c[z>>2]=B;c[u>>2]=0;B=d+184|0;c[B>>2]=0;z=d+188|0;c[z>>2]=0;x=me(60)|0;c[B>>2]=x;c[u>>2]=x;c[z>>2]=x+60;c[x>>2]=0;z=x+4|0;c[z>>2]=0;u=x+8|0;c[u>>2]=0;E=me(20)|0;c[x>>2]=E;c[u>>2]=E+20;c[E>>2]=c[A>>2];c[E+4>>2]=c[A+4>>2];c[E+8>>2]=c[A+8>>2];c[E+12>>2]=c[A+12>>2];c[E+16>>2]=c[A+16>>2];c[z>>2]=E+20;E=x+12|0;c[B>>2]=E;c[E>>2]=0;z=x+16|0;c[z>>2]=0;A=x+20|0;c[A>>2]=0;u=me(20)|0;c[E>>2]=u;c[A>>2]=u+20;c[u>>2]=c[D>>2];c[u+4>>2]=c[D+4>>2];c[u+8>>2]=c[D+8>>2];c[u+12>>2]=c[D+12>>2];c[u+16>>2]=c[D+16>>2];c[z>>2]=u+20;u=x+24|0;c[B>>2]=u;c[u>>2]=0;z=x+28|0;c[z>>2]=0;D=x+32|0;c[D>>2]=0;A=me(20)|0;c[u>>2]=A;c[D>>2]=A+20;c[A>>2]=c[C>>2];c[A+4>>2]=c[C+4>>2];c[A+8>>2]=c[C+8>>2];c[A+12>>2]=c[C+12>>2];c[A+16>>2]=c[C+16>>2];c[z>>2]=A+20;A=x+36|0;c[B>>2]=A;c[A>>2]=0;z=x+40|0;c[z>>2]=0;C=x+44|0;c[C>>2]=0;D=me(20)|0;c[A>>2]=D;c[C>>2]=D+20;c[D>>2]=c[v>>2];c[D+4>>2]=c[v+4>>2];c[D+8>>2]=c[v+8>>2];c[D+12>>2]=c[v+12>>2];c[D+16>>2]=c[v+16>>2];c[z>>2]=D+20;D=x+48|0;c[B>>2]=D;c[D>>2]=0;z=x+52|0;c[z>>2]=0;v=x+56|0;c[v>>2]=0;C=me(20)|0;c[D>>2]=C;c[v>>2]=C+20;c[C>>2]=c[w>>2];c[C+4>>2]=c[w+4>>2];c[C+8>>2]=c[w+8>>2];c[C+12>>2]=c[w+12>>2];c[C+16>>2]=c[w+16>>2];c[z>>2]=C+20;c[B>>2]=x+60;c[a>>2]=0;x=a+4|0;c[x>>2]=0;B=a+8|0;c[B>>2]=0;C=me(192)|0;c[x>>2]=C;c[a>>2]=C;c[B>>2]=C+192;sb(C,d);C=(c[x>>2]|0)+12|0;c[x>>2]=C;sb(C,d+12|0);C=(c[x>>2]|0)+12|0;c[x>>2]=C;sb(C,d+24|0);C=(c[x>>2]|0)+12|0;c[x>>2]=C;sb(C,d+36|0);C=(c[x>>2]|0)+12|0;c[x>>2]=C;sb(C,d+48|0);C=(c[x>>2]|0)+12|0;c[x>>2]=C;sb(C,d+60|0);C=(c[x>>2]|0)+12|0;c[x>>2]=C;sb(C,d+72|0);C=(c[x>>2]|0)+12|0;c[x>>2]=C;sb(C,d+84|0);C=(c[x>>2]|0)+12|0;c[x>>2]=C;sb(C,d+96|0);C=(c[x>>2]|0)+12|0;c[x>>2]=C;sb(C,d+108|0);C=(c[x>>2]|0)+12|0;c[x>>2]=C;sb(C,d+120|0);C=(c[x>>2]|0)+12|0;c[x>>2]=C;sb(C,d+132|0);C=(c[x>>2]|0)+12|0;c[x>>2]=C;sb(C,d+144|0);C=(c[x>>2]|0)+12|0;c[x>>2]=C;sb(C,d+156|0);C=(c[x>>2]|0)+12|0;c[x>>2]=C;sb(C,d+168|0);C=(c[x>>2]|0)+12|0;c[x>>2]=C;sb(C,d+180|0);c[x>>2]=(c[x>>2]|0)+12;x=d+192|0;do{C=x;x=x+-12|0;B=c[x>>2]|0;if(B|0){a=C+-8|0;C=c[a>>2]|0;if((C|0)==(B|0))F=B;else{z=C;do{C=z;z=z+-12|0;w=c[z>>2]|0;if(w|0){c[C+-8>>2]=w;ne(w)}}while((z|0)!=(B|0));F=c[x>>2]|0}c[a>>2]=B;ne(F)}}while((x|0)!=(d|0));d=c[t+48>>2]|0;if(d|0){c[t+52>>2]=d;ne(d)}d=c[t+36>>2]|0;if(d|0){c[t+40>>2]=d;ne(d)}d=c[t+24>>2]|0;if(d|0){c[t+28>>2]=d;ne(d)}d=c[t+12>>2]|0;if(d|0){c[t+16>>2]=d;ne(d)}d=c[t>>2]|0;if(d|0){c[t+4>>2]=d;ne(d)}d=c[s+48>>2]|0;if(d|0){c[s+52>>2]=d;ne(d)}d=c[s+36>>2]|0;if(d|0){c[s+40>>2]=d;ne(d)}d=c[s+24>>2]|0;if(d|0){c[s+28>>2]=d;ne(d)}d=c[s+12>>2]|0;if(d|0){c[s+16>>2]=d;ne(d)}d=c[s>>2]|0;if(d|0){c[s+4>>2]=d;ne(d)}d=c[r+48>>2]|0;if(d|0){c[r+52>>2]=d;ne(d)}d=c[r+36>>2]|0;if(d|0){c[r+40>>2]=d;ne(d)}d=c[r+24>>2]|0;if(d|0){c[r+28>>2]=d;ne(d)}d=c[r+12>>2]|0;if(d|0){c[r+16>>2]=d;ne(d)}d=c[r>>2]|0;if(d|0){c[r+4>>2]=d;ne(d)}d=c[q+48>>2]|0;if(d|0){c[q+52>>2]=d;ne(d)}d=c[q+36>>2]|0;if(d|0){c[q+40>>2]=d;ne(d)}d=c[q+24>>2]|0;if(d|0){c[q+28>>2]=d;ne(d)}d=c[q+12>>2]|0;if(d|0){c[q+16>>2]=d;ne(d)}d=c[q>>2]|0;if(d|0){c[q+4>>2]=d;ne(d)}d=c[p+48>>2]|0;if(d|0){c[p+52>>2]=d;ne(d)}d=c[p+36>>2]|0;if(d|0){c[p+40>>2]=d;ne(d)}d=c[p+24>>2]|0;if(d|0){c[p+28>>2]=d;ne(d)}d=c[p+12>>2]|0;if(d|0){c[p+16>>2]=d;ne(d)}d=c[p>>2]|0;if(d|0){c[p+4>>2]=d;ne(d)}d=c[o+48>>2]|0;if(d|0){c[o+52>>2]=d;ne(d)}d=c[o+36>>2]|0;if(d|0){c[o+40>>2]=d;ne(d)}d=c[o+24>>2]|0;if(d|0){c[o+28>>2]=d;ne(d)}d=c[o+12>>2]|0;if(d|0){c[o+16>>2]=d;ne(d)}d=c[o>>2]|0;if(d|0){c[o+4>>2]=d;ne(d)}d=c[n+48>>2]|0;if(d|0){c[n+52>>2]=d;ne(d)}d=c[n+36>>2]|0;if(d|0){c[n+40>>2]=d;ne(d)}d=c[n+24>>2]|0;if(d|0){c[n+28>>2]=d;ne(d)}d=c[n+12>>2]|0;if(d|0){c[n+16>>2]=d;ne(d)}d=c[n>>2]|0;if(d|0){c[n+4>>2]=d;ne(d)}d=c[m+48>>2]|0;if(d|0){c[m+52>>2]=d;ne(d)}d=c[m+36>>2]|0;if(d|0){c[m+40>>2]=d;ne(d)}d=c[m+24>>2]|0;if(d|0){c[m+28>>2]=d;ne(d)}d=c[m+12>>2]|0;if(d|0){c[m+16>>2]=d;ne(d)}d=c[m>>2]|0;if(d|0){c[m+4>>2]=d;ne(d)}d=c[l+48>>2]|0;if(d|0){c[l+52>>2]=d;ne(d)}d=c[l+36>>2]|0;if(d|0){c[l+40>>2]=d;ne(d)}d=c[l+24>>2]|0;if(d|0){c[l+28>>2]=d;ne(d)}d=c[l+12>>2]|0;if(d|0){c[l+16>>2]=d;ne(d)}d=c[l>>2]|0;if(d|0){c[l+4>>2]=d;ne(d)}d=c[k+48>>2]|0;if(d|0){c[k+52>>2]=d;ne(d)}d=c[k+36>>2]|0;if(d|0){c[k+40>>2]=d;ne(d)}d=c[k+24>>2]|0;if(d|0){c[k+28>>2]=d;ne(d)}d=c[k+12>>2]|0;if(d|0){c[k+16>>2]=d;ne(d)}d=c[k>>2]|0;if(d|0){c[k+4>>2]=d;ne(d)}d=c[j+48>>2]|0;if(d|0){c[j+52>>2]=d;ne(d)}d=c[j+36>>2]|0;if(d|0){c[j+40>>2]=d;ne(d)}d=c[j+24>>2]|0;if(d|0){c[j+28>>2]=d;ne(d)}d=c[j+12>>2]|0;if(d|0){c[j+16>>2]=d;ne(d)}d=c[j>>2]|0;if(d|0){c[j+4>>2]=d;ne(d)}d=c[i+48>>2]|0;if(d|0){c[i+52>>2]=d;ne(d)}d=c[i+36>>2]|0;if(d|0){c[i+40>>2]=d;ne(d)}d=c[i+24>>2]|0;if(d|0){c[i+28>>2]=d;ne(d)}d=c[i+12>>2]|0;if(d|0){c[i+16>>2]=d;ne(d)}d=c[i>>2]|0;if(d|0){c[i+4>>2]=d;ne(d)}d=c[h+48>>2]|0;if(d|0){c[h+52>>2]=d;ne(d)}d=c[h+36>>2]|0;if(d|0){c[h+40>>2]=d;ne(d)}d=c[h+24>>2]|0;if(d|0){c[h+28>>2]=d;ne(d)}d=c[h+12>>2]|0;if(d|0){c[h+16>>2]=d;ne(d)}d=c[h>>2]|0;if(d|0){c[h+4>>2]=d;ne(d)}d=c[g+48>>2]|0;if(d|0){c[g+52>>2]=d;ne(d)}d=c[g+36>>2]|0;if(d|0){c[g+40>>2]=d;ne(d)}d=c[g+24>>2]|0;if(d|0){c[g+28>>2]=d;ne(d)}d=c[g+12>>2]|0;if(d|0){c[g+16>>2]=d;ne(d)}d=c[g>>2]|0;if(d|0){c[g+4>>2]=d;ne(d)}d=c[f+48>>2]|0;if(d|0){c[f+52>>2]=d;ne(d)}d=c[f+36>>2]|0;if(d|0){c[f+40>>2]=d;ne(d)}d=c[f+24>>2]|0;if(d|0){c[f+28>>2]=d;ne(d)}d=c[f+12>>2]|0;if(d|0){c[f+16>>2]=d;ne(d)}d=c[f>>2]|0;if(d|0){c[f+4>>2]=d;ne(d)}d=c[e+48>>2]|0;if(d|0){c[e+52>>2]=d;ne(d)}d=c[e+36>>2]|0;if(d|0){c[e+40>>2]=d;ne(d)}d=c[e+24>>2]|0;if(d|0){c[e+28>>2]=d;ne(d)}d=c[e+12>>2]|0;if(d|0){c[e+16>>2]=d;ne(d)}d=c[e>>2]|0;if(!d){Ea=b;return}c[e+4>>2]=d;ne(d);Ea=b;return}function ab(){var a=0,b=0;a=c[2004]|0;if(!a){b=$(4)|0;c[b>>2]=4208;da(b|0,3024,27)}else{La[c[(c[a>>2]|0)+24>>2]&63](a);return}}function bb(){var b=0,d=0,e=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0;b=Ea;Ea=Ea+288|0;if((Ea|0)>=(Fa|0))y(288);d=b+88|0;e=b+72|0;g=b+56|0;h=b+40|0;i=b+156|0;j=b;k=b+112|0;l=b+240|0;m=b+204|0;n=b+168|0;o=b+120|0;cb(j);p=me(176)|0;c[l>>2]=0;c[l+4>>2]=0;c[l+8>>2]=0;c[l+12>>2]=0;c[l+16>>2]=0;c[l+20>>2]=0;c[l+24>>2]=0;c[l+28>>2]=0;q=l+12|0;c[q>>2]=10;c[q+4>>2]=24;q=l+20|0;c[q>>2]=0;c[q+4>>2]=9;Za(i);q=l+4|0;r=c[i+4>>2]|0;s=c[i+8>>2]|0;c[l>>2]=c[i>>2];c[q>>2]=r;c[l+8>>2]=s;a[l+32>>0]=0;db(p,l);c[k>>2]=p;s=me(16)|0;c[s+4>>2]=0;c[s+8>>2]=0;c[s>>2]=3508;c[s+12>>2]=p;r=k+4|0;c[r>>2]=s;c[h>>2]=p;c[h+4>>2]=p;Gc(k,h);p=c[l>>2]|0;if(p|0){s=c[q>>2]|0;if((s|0)==(p|0))t=p;else{u=s;do{s=u;u=u+-12|0;v=c[u>>2]|0;if(v|0){w=s+-8|0;s=c[w>>2]|0;if((s|0)==(v|0))x=v;else{z=s;do{s=z;z=z+-12|0;A=c[z>>2]|0;if(A|0){c[s+-8>>2]=A;ne(A)}}while((z|0)!=(v|0));x=c[u>>2]|0}c[w>>2]=v;ne(x)}}while((u|0)!=(p|0));t=c[l>>2]|0}c[q>>2]=p;ne(t)}t=me(176)|0;c[m>>2]=0;c[m+4>>2]=0;c[m+8>>2]=0;c[m+12>>2]=0;c[m+16>>2]=0;c[m+20>>2]=0;c[m+24>>2]=0;c[m+28>>2]=0;a[m+32>>0]=0;p=m+12|0;c[p>>2]=13;c[p+4>>2]=24;p=m+20|0;c[p>>2]=0;c[p+4>>2]=12;$a(h);p=m+4|0;q=c[h+4>>2]|0;l=c[h+8>>2]|0;c[m>>2]=c[h>>2];c[p>>2]=q;c[m+8>>2]=l;db(t,m);c[i>>2]=t;l=me(16)|0;c[l+4>>2]=0;c[l+8>>2]=0;c[l>>2]=3508;c[l+12>>2]=t;q=i+4|0;c[q>>2]=l;c[g>>2]=t;c[g+4>>2]=t;Gc(i,g);t=c[m>>2]|0;if(t|0){l=c[p>>2]|0;if((l|0)==(t|0))B=t;else{u=l;do{l=u;u=u+-12|0;x=c[u>>2]|0;if(x|0){z=l+-8|0;l=c[z>>2]|0;if((l|0)==(x|0))C=x;else{A=l;do{l=A;A=A+-12|0;s=c[A>>2]|0;if(s|0){c[l+-8>>2]=s;ne(s)}}while((A|0)!=(x|0));C=c[u>>2]|0}c[z>>2]=x;ne(C)}}while((u|0)!=(t|0));B=c[m>>2]|0}c[p>>2]=t;ne(B)}B=me(176)|0;c[n>>2]=0;c[n+4>>2]=0;c[n+8>>2]=0;c[n+12>>2]=0;c[n+16>>2]=0;c[n+20>>2]=0;c[n+24>>2]=0;c[n+28>>2]=0;a[n+32>>0]=0;t=n+12|0;c[t>>2]=15;c[t+4>>2]=24;t=n+20|0;c[t>>2]=0;c[t+4>>2]=9;_a(g);t=n+4|0;p=c[g+4>>2]|0;m=c[g+8>>2]|0;c[n>>2]=c[g>>2];c[t>>2]=p;c[n+8>>2]=m;db(B,n);c[h>>2]=B;m=me(16)|0;c[m+4>>2]=0;c[m+8>>2]=0;c[m>>2]=3508;c[m+12>>2]=B;p=h+4|0;c[p>>2]=m;c[e>>2]=B;c[e+4>>2]=B;Gc(h,e);B=c[n>>2]|0;if(B|0){m=c[t>>2]|0;if((m|0)==(B|0))D=B;else{u=m;do{m=u;u=u+-12|0;C=c[u>>2]|0;if(C|0){A=m+-8|0;m=c[A>>2]|0;if((m|0)==(C|0))E=C;else{v=m;do{m=v;v=v+-12|0;w=c[v>>2]|0;if(w|0){c[m+-8>>2]=w;ne(w)}}while((v|0)!=(C|0));E=c[u>>2]|0}c[A>>2]=C;ne(E)}}while((u|0)!=(B|0));D=c[n>>2]|0}c[t>>2]=B;ne(D)}D=me(176)|0;c[o>>2]=0;c[o+4>>2]=0;c[o+8>>2]=0;c[o+28>>2]=1;a[o+32>>0]=0;B=o+12|0;c[B>>2]=20;c[B+4>>2]=24;B=o+20|0;c[B>>2]=5;c[B+4>>2]=14;Za(e);B=o+4|0;t=c[e+4>>2]|0;n=c[e+8>>2]|0;c[o>>2]=c[e>>2];c[B>>2]=t;c[o+8>>2]=n;db(D,o);c[g>>2]=D;n=me(16)|0;c[n+4>>2]=0;c[n+8>>2]=0;c[n>>2]=3508;c[n+12>>2]=D;t=g+4|0;c[t>>2]=n;c[d>>2]=D;c[d+4>>2]=D;Gc(g,d);D=c[o>>2]|0;if(D|0){n=c[B>>2]|0;if((n|0)==(D|0))F=D;else{u=n;do{n=u;u=u+-12|0;E=c[u>>2]|0;if(E|0){v=n+-8|0;n=c[v>>2]|0;if((n|0)==(E|0))G=E;else{x=n;do{n=x;x=x+-12|0;z=c[x>>2]|0;if(z|0){c[n+-8>>2]=z;ne(z)}}while((x|0)!=(E|0));G=c[u>>2]|0}c[v>>2]=E;ne(G)}}while((u|0)!=(D|0));F=c[o>>2]|0}c[B>>2]=D;ne(F)}F=c[k>>2]|0;D=c[r>>2]|0;B=(D|0)==0;if(B)H=j+32|0;else{o=D+4|0;c[o>>2]=(c[o>>2]|0)+1;c[o>>2]=(c[o>>2]|0)+1;H=j+32|0}c[H>>2]=F;F=j+36|0;H=c[F>>2]|0;c[F>>2]=D;if(H|0?(o=H+4|0,u=c[o>>2]|0,c[o>>2]=u+-1,(u|0)==0):0){La[c[(c[H>>2]|0)+8>>2]&63](H);le(H)}H=c[j+32>>2]|0;u=j+24|0;o=u;G=c[o+4>>2]|0;x=H+24|0;c[x>>2]=c[o>>2];c[x+4>>2]=G;G=c[H+16>>2]|0;if(G|0){x=c[(c[G>>2]|0)+8>>2]|0;f[d>>2]=0.0;f[d+4>>2]=0.0;Qa[x&15](G,H+4|0,d,u)}if(!B?(B=D+4|0,u=c[B>>2]|0,c[B>>2]=u+-1,(u|0)==0):0){La[c[(c[D>>2]|0)+8>>2]&63](D);le(D)}c[e>>2]=0;D=d+16|0;u=me(28)|0;c[u>>2]=3536;c[u+4>>2]=e;c[u+8>>2]=j;c[u+12>>2]=k;c[u+16>>2]=h;c[u+20>>2]=i;c[u+24>>2]=g;c[D>>2]=u;Mc(d,8e3);u=c[D>>2]|0;if((d|0)!=(u|0)){if(u|0)La[c[(c[u>>2]|0)+20>>2]&63](u)}else La[c[(c[u>>2]|0)+16>>2]&63](u);va(2,0,1);u=c[t>>2]|0;if(u|0?(t=u+4|0,d=c[t>>2]|0,c[t>>2]=d+-1,(d|0)==0):0){La[c[(c[u>>2]|0)+8>>2]&63](u);le(u)}u=c[p>>2]|0;if(u|0?(p=u+4|0,d=c[p>>2]|0,c[p>>2]=d+-1,(d|0)==0):0){La[c[(c[u>>2]|0)+8>>2]&63](u);le(u)}u=c[q>>2]|0;if(u|0?(q=u+4|0,d=c[q>>2]|0,c[q>>2]=d+-1,(d|0)==0):0){La[c[(c[u>>2]|0)+8>>2]&63](u);le(u)}u=c[r>>2]|0;if(u|0?(r=u+4|0,d=c[r>>2]|0,c[r>>2]=d+-1,(d|0)==0):0){La[c[(c[u>>2]|0)+8>>2]&63](u);le(u)}u=c[F>>2]|0;if(u|0?(F=u+4|0,d=c[F>>2]|0,c[F>>2]=d+-1,(d|0)==0):0){La[c[(c[u>>2]|0)+8>>2]&63](u);le(u)}u=c[j>>2]|0;if(!u){Ea=b;return 1}ne(u);Ea=b;return 1}function cb(a){a=a|0;var b=0,d=0,e=0;c[a>>2]=0;b=a+4|0;c[b>>2]=0;d=a+8|0;c[d>>2]=0;e=me(512)|0;c[a>>2]=e;c[d>>2]=128;c[b>>2]=4096;Rf(e|0,0,512)|0;c[a+12>>2]=0;g[a+16>>3]=+sa();e=a+24|0;c[e>>2]=0;c[e+4>>2]=0;c[e+8>>2]=0;c[e+12>>2]=0;Q();W(32)|0;Z(50,50,32,0)|0;return}function db(b,d){b=b|0;d=d|0;var e=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ba=0;e=Ea;Ea=Ea+272|0;if((Ea|0)>=(Fa|0))y(272);h=e+224|0;i=e+144|0;j=e+136|0;k=e+128|0;l=e+112|0;m=e+104|0;n=e+88|0;o=e+80|0;p=e+64|0;q=e+56|0;r=e+216|0;s=e+48|0;t=e+24|0;u=e;v=e+208|0;w=e+200|0;x=e+192|0;z=e+184|0;A=e+176|0;B=e+168|0;C=e+160|0;D=e+152|0;E=b+4|0;c[E>>2]=0;c[E+4>>2]=0;c[E+8>>2]=0;c[E+12>>2]=0;c[E+16>>2]=0;c[E+20>>2]=0;c[E+24>>2]=0;c[b>>2]=3224;g[b+32>>3]=200.0;E=b+40|0;F=b+56|0;G=b+60|0;c[E>>2]=0;c[E+4>>2]=0;c[E+8>>2]=0;c[E+12>>2]=0;c[E+16>>2]=0;c[E+20>>2]=0;c[b+64>>2]=1;E=b+68|0;H=b+76|0;I=b+80|0;J=b+84|0;K=b+88|0;L=b+92|0;M=b+96|0;c[E>>2]=0;c[E+4>>2]=0;c[E+8>>2]=0;c[E+12>>2]=0;c[E+16>>2]=0;c[E+20>>2]=0;c[E+24>>2]=0;c[E+28>>2]=0;rb(b+100|0,d);E=b+112|0;N=d+12|0;c[E>>2]=c[N>>2];c[E+4>>2]=c[N+4>>2];c[E+8>>2]=c[N+8>>2];c[E+12>>2]=c[N+12>>2];c[E+16>>2]=c[N+16>>2];a[E+20>>0]=a[N+20>>0]|0;E=d+20|0;O=c[E+4>>2]|0;P=b+136|0;c[P>>2]=c[E>>2];c[P+4>>2]=O;O=b+144|0;P=O;c[P>>2]=0;c[P+4>>2]=0;P=N;E=c[P+4>>2]|0;Q=b+152|0;c[Q>>2]=c[P>>2];c[Q+4>>2]=E;E=(((c[d+4>>2]|0)-(c[d>>2]|0)|0)/12|0)+-1|0;c[b+160>>2]=0;c[b+164>>2]=E;c[b+168>>2]=0;c[b+172>>2]=3;E=b+4|0;Q=h+8|0;P=Q+36|0;do{c[Q>>2]=0;Q=Q+4|0}while((Q|0)<(P|0));c[h+44>>2]=2;c[h>>2]=1112014848;c[h+4>>2]=1112014848;f[h+16>>2]=30.0;f[h+20>>2]=30.0;c[h+32>>2]=-7820545;R=b+8|0;S=c[R>>2]|0;if(S>>>0<(c[b+12>>2]|0)>>>0){Q=S;S=h;P=Q+48|0;do{c[Q>>2]=c[S>>2];Q=Q+4|0;S=S+4|0}while((Q|0)<(P|0));c[R>>2]=(c[R>>2]|0)+48}else tb(E,h);R=c[b+104>>2]|0;S=c[b+100>>2]|0;Q=S;if((R|0)!=(S|0)){P=c[2640]|0;T=(c[2641]|0)-P>>2;U=(R-S|0)/12|0;S=0;R=0;while(1){V=c[Q+(S*12|0)+4>>2]|0;W=c[Q+(S*12|0)>>2]|0;X=W;if((V|0)!=(W|0)){Y=(V-W|0)/12|0;W=P+(R<<2)|0;V=0;do{Z=c[Q+(V*12|0)+4>>2]|0;_=c[Q+(V*12|0)>>2]|0;if((Z|0)!=(_|0)){$=c[X+(V*12|0)>>2]|0;aa=(Z-_|0)/12|0;_=0;do{Z=$+(_<<2)|0;ba=c[Z>>2]|0;if(ba|0)c[Z>>2]=c[W>>2]|ba;_=_+1|0}while(_>>>0<aa>>>0)}V=V+1|0}while(V>>>0<Y>>>0)}S=S+1|0;if(S>>>0>=U>>>0)break;else R=((R+1|0)>>>0)%(T>>>0)|0}}T=me(272)|0;R=N;N=c[R+4>>2]|0;U=s;c[U>>2]=c[R>>2];c[U+4>>2]=N;N=t+16|0;c[t>>2]=3264;c[N>>2]=t;U=u+16|0;c[u>>2]=3308;c[U>>2]=u;c[h>>2]=c[s>>2];c[h+4>>2]=c[s+4>>2];fb(T,E,h,t,u);c[r>>2]=T;s=me(16)|0;c[s+4>>2]=0;c[s+8>>2]=0;c[s>>2]=3400;c[s+12>>2]=T;R=r+4|0;c[R>>2]=s;c[q>>2]=T;c[q+4>>2]=T;Wb(r,q);q=c[r>>2]|0;T=c[R>>2]|0;c[r>>2]=0;c[R>>2]=0;c[F>>2]=q;q=c[G>>2]|0;c[G>>2]=T;if(q|0?(T=q+4|0,r=c[T>>2]|0,c[T>>2]=r+-1,(r|0)==0):0){La[c[(c[q>>2]|0)+8>>2]&63](q);le(q)}q=c[R>>2]|0;if(q|0?(R=q+4|0,r=c[R>>2]|0,c[R>>2]=r+-1,(r|0)==0):0){La[c[(c[q>>2]|0)+8>>2]&63](q);le(q)}q=c[U>>2]|0;if((u|0)!=(q|0)){if(q|0)La[c[(c[q>>2]|0)+20>>2]&63](q)}else La[c[(c[q>>2]|0)+16>>2]&63](q);q=c[N>>2]|0;if((t|0)!=(q|0)){if(q|0)La[c[(c[q>>2]|0)+20>>2]&63](q)}else La[c[(c[q>>2]|0)+16>>2]&63](q);q=c[F>>2]|0;Pa[c[c[q>>2]>>2]&3](q,E,1);q=c[(c[F>>2]|0)+4>>2]|0;t=c[E>>2]|0;c[t+(q*48|0)+8>>2]=1065353216;c[t+(q*48|0)+12>>2]=1065353216;q=c[(c[F>>2]|0)+4>>2]|0;t=c[E>>2]|0;c[t+(q*48|0)+24>>2]=-1054867456;c[t+(q*48|0)+28>>2]=-1054867456;q=c[(c[F>>2]|0)+4>>2]|0;t=c[E>>2]|0;c[t+(q*48|0)>>2]=1056964608;c[t+(q*48|0)+4>>2]=1056964608;q=c[F>>2]|0;c[q+8>>2]=1056964608;c[q+12>>2]=1056964608;q=me(240)|0;gb(q,E);c[h>>2]=q;t=me(16)|0;c[t+4>>2]=0;c[t+8>>2]=0;c[t>>2]=3428;c[t+12>>2]=q;N=h+4|0;c[N>>2]=t;c[p>>2]=q;c[p+4>>2]=q;$b(h,p);q=b+16|0;t=c[h>>2]|0;u=c[N>>2]|0;c[h>>2]=0;c[N>>2]=0;c[q>>2]=t;t=b+20|0;U=c[t>>2]|0;c[t>>2]=u;if(U|0?(u=U+4|0,t=c[u>>2]|0,c[u>>2]=t+-1,(t|0)==0):0){La[c[(c[U>>2]|0)+8>>2]&63](U);le(U)}U=c[N>>2]|0;if(U|0?(N=U+4|0,t=c[N>>2]|0,c[N>>2]=t+-1,(t|0)==0):0){La[c[(c[U>>2]|0)+8>>2]&63](U);le(U)}U=c[(c[q>>2]|0)+4>>2]|0;t=c[E>>2]|0;c[t+(U*48|0)+8>>2]=1065353216;c[t+(U*48|0)+12>>2]=1065353216;U=c[q>>2]|0;q=c[(c[U>>2]|0)+4>>2]|0;c[v>>2]=c[F>>2];t=v+4|0;N=c[G>>2]|0;c[t>>2]=N;if(N|0){G=N+4|0;c[G>>2]=(c[G>>2]|0)+1}Pa[q&3](U,E,v);v=c[t>>2]|0;if(v|0?(t=v+4|0,U=c[t>>2]|0,c[t>>2]=U+-1,(U|0)==0):0){La[c[(c[v>>2]|0)+8>>2]&63](v);le(v)}v=me(240)|0;gb(v,E);c[h>>2]=v;U=me(16)|0;c[U+4>>2]=0;c[U+8>>2]=0;c[U>>2]=3428;c[U+12>>2]=v;t=h+4|0;c[t>>2]=U;c[o>>2]=v;c[o+4>>2]=v;$b(h,o);v=c[(c[h>>2]|0)+4>>2]|0;U=c[E>>2]|0;c[U+(v*48|0)>>2]=0;c[U+(v*48|0)+4>>2]=0;v=c[h>>2]|0;U=c[v+4>>2]|0;q=c[E>>2]|0;c[q+(U*48|0)+16>>2]=-1054867456;c[q+(U*48|0)+20>>2]=1112014848;c[v+56>>2]=2;U=c[F>>2]|0;q=c[(c[U>>2]|0)+4>>2]|0;c[w>>2]=v;v=w+4|0;G=c[t>>2]|0;c[v>>2]=G;if(G|0){N=G+4|0;c[N>>2]=(c[N>>2]|0)+1}Pa[q&3](U,E,w);w=c[v>>2]|0;if(w|0?(v=w+4|0,U=c[v>>2]|0,c[v>>2]=U+-1,(U|0)==0):0){La[c[(c[w>>2]|0)+8>>2]&63](w);le(w)}w=me(240)|0;c[p>>2]=0;c[p+4>>2]=0;c[p+8>>2]=0;U=p+11|0;a[U>>0]=5;a[p>>0]=a[4662]|0;a[p+1>>0]=a[4663]|0;a[p+2>>0]=a[4664]|0;a[p+3>>0]=a[4665]|0;a[p+4>>0]=a[4666]|0;a[p+5>>0]=0;hb(w,E,p,-1431655681,30.0);c[o>>2]=w;v=me(16)|0;c[v+4>>2]=0;c[v+8>>2]=0;c[v>>2]=3480;c[v+12>>2]=w;q=o+4|0;c[q>>2]=v;c[n>>2]=w;c[n+4>>2]=w;mc(o,n);if((a[U>>0]|0)<0)ne(c[p>>2]|0);U=c[o>>2]|0;Pa[c[c[U>>2]>>2]&3](U,E,2);U=c[o>>2]|0;c[U+8>>2]=1065353216;c[U+12>>2]=0;o=c[h>>2]|0;w=c[(c[o>>2]|0)+4>>2]|0;c[x>>2]=U;U=x+4|0;v=c[q>>2]|0;c[U>>2]=v;if(v|0){N=v+4|0;c[N>>2]=(c[N>>2]|0)+1}Pa[w&3](o,E,x);x=c[U>>2]|0;if(x|0?(U=x+4|0,o=c[U>>2]|0,c[U>>2]=o+-1,(o|0)==0):0){La[c[(c[x>>2]|0)+8>>2]&63](x);le(x)}x=me(240)|0;c[p>>2]=0;c[p+4>>2]=0;c[p+8>>2]=0;o=p+11|0;a[o>>0]=1;a[p>>0]=49;a[p+1>>0]=0;hb(x,E,p,-1,30.0);c[n>>2]=x;U=me(16)|0;c[U+4>>2]=0;c[U+8>>2]=0;c[U>>2]=3480;c[U+12>>2]=x;w=n+4|0;c[w>>2]=U;c[m>>2]=x;c[m+4>>2]=x;mc(n,m);x=c[n>>2]|0;U=c[w>>2]|0;c[n>>2]=0;c[w>>2]=0;c[H>>2]=x;x=c[I>>2]|0;c[I>>2]=U;if(x|0?(U=x+4|0,N=c[U>>2]|0,c[U>>2]=N+-1,(N|0)==0):0){La[c[(c[x>>2]|0)+8>>2]&63](x);le(x)}x=c[w>>2]|0;if(x|0?(w=x+4|0,N=c[w>>2]|0,c[w>>2]=N+-1,(N|0)==0):0){La[c[(c[x>>2]|0)+8>>2]&63](x);le(x)}if((a[o>>0]|0)<0)ne(c[p>>2]|0);p=c[H>>2]|0;Pa[c[c[p>>2]>>2]&3](p,E,2);p=c[H>>2]|0;c[p+8>>2]=1065353216;c[p+12>>2]=0;p=c[h>>2]|0;o=c[(c[p>>2]|0)+4>>2]|0;c[z>>2]=c[H>>2];H=z+4|0;x=c[I>>2]|0;c[H>>2]=x;if(x|0){I=x+4|0;c[I>>2]=(c[I>>2]|0)+1}Pa[o&3](p,E,z);z=c[H>>2]|0;do if(z|0){H=z+4|0;p=c[H>>2]|0;c[H>>2]=p+-1;if(p|0)break;La[c[(c[z>>2]|0)+8>>2]&63](z);le(z)}while(0);z=me(240)|0;c[n>>2]=0;c[n+4>>2]=0;c[n+8>>2]=0;p=n+11|0;a[p>>0]=5;a[n>>0]=a[4668]|0;a[n+1>>0]=a[4669]|0;a[n+2>>0]=a[4670]|0;a[n+3>>0]=a[4671]|0;a[n+4>>0]=a[4672]|0;a[n+5>>0]=0;hb(z,E,n,-1431655681,30.0);c[m>>2]=z;H=me(16)|0;c[H+4>>2]=0;c[H+8>>2]=0;c[H>>2]=3480;c[H+12>>2]=z;o=m+4|0;c[o>>2]=H;c[l>>2]=z;c[l+4>>2]=z;mc(m,l);if((a[p>>0]|0)<0)ne(c[n>>2]|0);p=c[m>>2]|0;Pa[c[c[p>>2]>>2]&3](p,E,2);p=c[m>>2]|0;c[p+8>>2]=1065353216;c[p+12>>2]=0;m=c[h>>2]|0;z=c[(c[m>>2]|0)+4>>2]|0;c[A>>2]=p;p=A+4|0;H=c[o>>2]|0;c[p>>2]=H;if(H|0){I=H+4|0;c[I>>2]=(c[I>>2]|0)+1}Pa[z&3](m,E,A);A=c[p>>2]|0;do if(A|0){p=A+4|0;m=c[p>>2]|0;c[p>>2]=m+-1;if(m|0)break;La[c[(c[A>>2]|0)+8>>2]&63](A);le(A)}while(0);A=me(240)|0;c[n>>2]=0;c[n+4>>2]=0;c[n+8>>2]=0;m=n+11|0;a[m>>0]=1;a[n>>0]=48;a[n+1>>0]=0;hb(A,E,n,-1,30.0);c[l>>2]=A;p=me(16)|0;c[p+4>>2]=0;c[p+8>>2]=0;c[p>>2]=3480;c[p+12>>2]=A;z=l+4|0;c[z>>2]=p;c[k>>2]=A;c[k+4>>2]=A;mc(l,k);A=c[l>>2]|0;p=c[z>>2]|0;c[l>>2]=0;c[z>>2]=0;c[J>>2]=A;A=c[K>>2]|0;c[K>>2]=p;do if(A|0){p=A+4|0;I=c[p>>2]|0;c[p>>2]=I+-1;if(I|0)break;La[c[(c[A>>2]|0)+8>>2]&63](A);le(A)}while(0);A=c[z>>2]|0;do if(A|0){z=A+4|0;I=c[z>>2]|0;c[z>>2]=I+-1;if(I|0)break;La[c[(c[A>>2]|0)+8>>2]&63](A);le(A)}while(0);if((a[m>>0]|0)<0)ne(c[n>>2]|0);n=c[J>>2]|0;Pa[c[c[n>>2]>>2]&3](n,E,2);n=c[J>>2]|0;c[n+8>>2]=1065353216;c[n+12>>2]=0;n=c[h>>2]|0;m=c[(c[n>>2]|0)+4>>2]|0;c[B>>2]=c[J>>2];J=B+4|0;A=c[K>>2]|0;c[J>>2]=A;if(A|0){K=A+4|0;c[K>>2]=(c[K>>2]|0)+1}Pa[m&3](n,E,B);B=c[J>>2]|0;do if(B|0){J=B+4|0;n=c[J>>2]|0;c[J>>2]=n+-1;if(n|0)break;La[c[(c[B>>2]|0)+8>>2]&63](B);le(B)}while(0);B=me(240)|0;c[l>>2]=0;c[l+4>>2]=0;c[l+8>>2]=0;n=l+11|0;a[n>>0]=5;a[l>>0]=a[4674]|0;a[l+1>>0]=a[4675]|0;a[l+2>>0]=a[4676]|0;a[l+3>>0]=a[4677]|0;a[l+4>>0]=a[4678]|0;a[l+5>>0]=0;hb(B,E,l,-1431655681,30.0);c[k>>2]=B;J=me(16)|0;c[J+4>>2]=0;c[J+8>>2]=0;c[J>>2]=3480;c[J+12>>2]=B;m=k+4|0;c[m>>2]=J;c[j>>2]=B;c[j+4>>2]=B;mc(k,j);if((a[n>>0]|0)<0)ne(c[l>>2]|0);n=c[k>>2]|0;Pa[c[c[n>>2]>>2]&3](n,E,2);n=c[k>>2]|0;c[n+8>>2]=1065353216;c[n+12>>2]=0;k=c[h>>2]|0;B=c[(c[k>>2]|0)+4>>2]|0;c[C>>2]=n;n=C+4|0;J=c[m>>2]|0;c[n>>2]=J;if(J|0){K=J+4|0;c[K>>2]=(c[K>>2]|0)+1}Pa[B&3](k,E,C);C=c[n>>2]|0;do if(C|0){n=C+4|0;k=c[n>>2]|0;c[n>>2]=k+-1;if(k|0)break;La[c[(c[C>>2]|0)+8>>2]&63](C);le(C)}while(0);C=me(240)|0;c[l>>2]=0;c[l+4>>2]=0;c[l+8>>2]=0;k=l+11|0;a[k>>0]=1;a[l>>0]=48;a[l+1>>0]=0;hb(C,E,l,-1,30.0);c[j>>2]=C;n=me(16)|0;c[n+4>>2]=0;c[n+8>>2]=0;c[n>>2]=3480;c[n+12>>2]=C;B=j+4|0;c[B>>2]=n;c[i>>2]=C;c[i+4>>2]=C;mc(j,i);i=c[j>>2]|0;C=c[B>>2]|0;c[j>>2]=0;c[B>>2]=0;c[L>>2]=i;i=c[M>>2]|0;c[M>>2]=C;do if(i|0){C=i+4|0;j=c[C>>2]|0;c[C>>2]=j+-1;if(j|0)break;La[c[(c[i>>2]|0)+8>>2]&63](i);le(i)}while(0);i=c[B>>2]|0;do if(i|0){B=i+4|0;j=c[B>>2]|0;c[B>>2]=j+-1;if(j|0)break;La[c[(c[i>>2]|0)+8>>2]&63](i);le(i)}while(0);if((a[k>>0]|0)<0)ne(c[l>>2]|0);l=c[L>>2]|0;Pa[c[c[l>>2]>>2]&3](l,E,2);l=c[L>>2]|0;c[l+8>>2]=1065353216;c[l+12>>2]=0;l=c[h>>2]|0;h=c[(c[l>>2]|0)+4>>2]|0;c[D>>2]=c[L>>2];L=D+4|0;k=c[M>>2]|0;c[L>>2]=k;if(k|0){M=k+4|0;c[M>>2]=(c[M>>2]|0)+1}Pa[h&3](l,E,D);D=c[L>>2]|0;do if(D|0){L=D+4|0;l=c[L>>2]|0;c[L>>2]=l+-1;if(l|0)break;La[c[(c[D>>2]|0)+8>>2]&63](D);le(D)}while(0);ib(b);jb(b,0);if((c[d+28>>2]|0)==1){d=b+56|0;while(1){if(!(kb(c[F>>2]|0,E,1,255)|0))break;Bc(c[d>>2]|0,E,1,O)}lb(b);ib(b)}b=c[m>>2]|0;do if(b|0){m=b+4|0;O=c[m>>2]|0;c[m>>2]=O+-1;if(O|0)break;La[c[(c[b>>2]|0)+8>>2]&63](b);le(b)}while(0);b=c[o>>2]|0;do if(b|0){o=b+4|0;O=c[o>>2]|0;c[o>>2]=O+-1;if(O|0)break;La[c[(c[b>>2]|0)+8>>2]&63](b);le(b)}while(0);b=c[q>>2]|0;do if(b|0){q=b+4|0;O=c[q>>2]|0;c[q>>2]=O+-1;if(O|0)break;La[c[(c[b>>2]|0)+8>>2]&63](b);le(b)}while(0);b=c[t>>2]|0;if(!b){Ea=e;return}t=b+4|0;O=c[t>>2]|0;c[t>>2]=O+-1;if(O|0){Ea=e;return}La[c[(c[b>>2]|0)+8>>2]&63](b);le(b);Ea=e;return}function eb(a){a=a|0;aa(a|0)|0;lf()}function fb(a,b,d,e,g){a=a|0;b=b|0;d=d|0;e=e|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0.0,s=0,t=0,u=0,v=0,w=0,x=0.0;h=Ea;Ea=Ea+48|0;if((Ea|0)>=(Fa|0))y(48);i=h;gb(a,b);c[a>>2]=3352;j=d;k=c[j>>2]|0;l=c[j+4>>2]|0;j=a+236|0;c[j>>2]=k;c[j+4>>2]=l;l=a+248|0;j=g+16|0;m=c[j>>2]|0;do if(m)if((g|0)==(m|0)){c[a+264>>2]=l;n=c[j>>2]|0;Na[c[(c[n>>2]|0)+12>>2]&7](n,l);break}else{c[a+264>>2]=Ha[c[(c[m>>2]|0)+8>>2]&15](m)|0;break}else c[a+264>>2]=0;while(0);m=c[d+4>>2]|0;a:do if((k|0)>0){d=e+16|0;l=i+44|0;j=b+4|0;g=b+8|0;n=i+4|0;o=i+16|0;p=i+20|0;if((m|0)>0){q=0;b:while(1){r=+(q|0)*10.0+1.0;s=0;do{t=c[d>>2]|0;if(!t)break b;Na[c[(c[t>>2]|0)+24>>2]&7](i,t);t=c[l>>2]|0;c:do switch(t|0){case 7:case 2:case 3:case 4:case 6:{f[i>>2]=r;f[n>>2]=+(s|0)*10.0+1.0;switch(t|0){case 2:case 3:case 4:case 6:break;default:break c}c[o>>2]=1090519040;c[p>>2]=1090519040;break}default:{}}while(0);t=c[j>>2]|0;if((t|0)==(c[g>>2]|0))Ub(b,i);else{u=t;t=i;v=u+48|0;do{c[u>>2]=c[t>>2];u=u+4|0;t=t+4|0}while((u|0)<(v|0));c[j>>2]=(c[j>>2]|0)+48}s=s+1|0}while((s|0)<(m|0));q=q+1|0;if((q|0)>=(k|0)){w=j;break a}}q=$(4)|0;c[q>>2]=4208;da(q|0,3024,27)}else w=j}else w=b+4|0;while(0);i=c[b>>2]|0;c[i+((c[a+4>>2]|0)*48|0)+36>>2]=(((c[w>>2]|0)-i|0)/48|0)+-1;r=+(k|0);x=+(m|0);f[a+24>>2]=r*10.0;f[a+28>>2]=x*10.0;f[a+48>>2]=r/x;Ea=h;return}function gb(d,e){d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0;f=Ea;Ea=Ea+48|0;if((Ea|0)>=(Fa|0))y(48);g=f;c[d>>2]=3376;h=d+4|0;i=e+4|0;j=c[i>>2]|0;k=(j-(c[e>>2]|0)|0)/48|0;l=d+8|0;c[d+80>>2]=0;c[d+104>>2]=0;c[d+128>>2]=0;a[d+136>>0]=0;a[d+137>>0]=0;c[d+160>>2]=0;c[d+184>>2]=0;c[d+208>>2]=0;m=d+216|0;d=l;n=d+52|0;do{c[d>>2]=0;d=d+4|0}while((d|0)<(n|0));b[l+52>>1]=0;c[m>>2]=0;c[m+4>>2]=0;c[m+8>>2]=0;c[m+12>>2]=0;c[m+16>>2]=0;c[h>>2]=k;d=g;n=d+40|0;do{c[d>>2]=0;d=d+4|0}while((d|0)<(n|0));c[g+44>>2]=1;c[g+32>>2]=k;c[g+40>>2]=1;if((c[e+8>>2]|0)>>>0>j>>>0){d=j;j=g;n=d+48|0;do{c[d>>2]=c[j>>2];d=d+4|0;j=j+4|0}while((d|0)<(n|0));j=(c[i>>2]|0)+48|0;c[i>>2]=j;o=j;p=c[e>>2]|0;q=o-p|0;r=(q|0)/48|0;s=r+-1|0;t=c[h>>2]|0;u=p;v=u+(t*48|0)+36|0;c[v>>2]=s;Ea=f;return}else{tb(e,g);o=c[i>>2]|0;p=c[e>>2]|0;q=o-p|0;r=(q|0)/48|0;s=r+-1|0;t=c[h>>2]|0;u=p;v=u+(t*48|0)+36|0;c[v>>2]=s;Ea=f;return}}function hb(b,d,e,g,h){b=b|0;d=d|0;e=e|0;g=g|0;h=+h;var i=0,j=0,k=0,l=0,m=0,n=0;i=Ea;Ea=Ea+48|0;if((Ea|0)>=(Fa|0))y(48);j=i;gb(b,d);c[b>>2]=3456;k=j+8|0;l=k+36|0;do{c[k>>2]=0;k=k+4|0}while((k|0)<(l|0));c[j+44>>2]=7;c[j>>2]=0;c[j+4>>2]=0;f[j+24>>2]=h;c[j+32>>2]=g;if(!(ic(8036,e)|0)){g=c[2007]|0;m=(g-(c[2006]|0)|0)/12|0;n=g;if((c[2008]|0)==(n|0))jc(8024,e);else{ve(n,e);c[2007]=(c[2007]|0)+12}c[(hc(8036,e)|0)>>2]=m}c[j+36>>2]=c[(hc(8036,e)|0)>>2];f[j+16>>2]=+R(((a[e+11>>0]|0)<0?c[e>>2]|0:e)|0,+h);f[j+20>>2]=h;e=d+4|0;m=c[e>>2]|0;n=c[d>>2]|0;c[n+((c[b+4>>2]|0)*48|0)+36>>2]=(m-n|0)/48|0;if((c[d+8>>2]|0)==(m|0)){Ub(d,j);Ea=i;return}else{k=m;m=j;l=k+48|0;do{c[k>>2]=c[m>>2];k=k+4|0;m=m+4|0}while((k|0)<(l|0));c[e>>2]=(c[e>>2]|0)+48;Ea=i;return}}function ib(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0;b=Ea;Ea=Ea+48|0;if((Ea|0)>=(Fa|0))y(48);d=b+32|0;e=b+20|0;f=b+8|0;g=b;h=a+56|0;i=c[(c[h>>2]|0)+236>>2]|0;j=a+160|0;k=xc(j,8060,j)|0;sb(e,(c[a+100>>2]|0)+(k*12|0)|0);k=c[h>>2]|0;j=a+4|0;sb(f,e);l=g;c[l>>2]=((i|0)/2|0)+-2;c[l+4>>2]=0;c[d>>2]=c[g>>2];c[d+4>>2]=c[g+4>>2];sc(k,j,f,d);k=c[f>>2]|0;if(k|0){g=f+4|0;l=c[g>>2]|0;if((l|0)==(k|0))m=k;else{i=l;do{l=i;i=i+-12|0;n=c[i>>2]|0;if(n|0){c[l+-8>>2]=n;ne(n)}}while((i|0)!=(k|0));m=c[f>>2]|0}c[g>>2]=k;ne(m)}if((c[a+128>>2]|0)==1?(m=a+168|0,k=xc(m,8060,m)|0,k|0):0){m=d+8|0;g=0;do{tc(d,c[h>>2]|0,j,1,255);if(uc(c[h>>2]|0,j,d,c[m>>2]|0,1,255)|0){vc(c[h>>2]|0,j,d,c[m>>2]|0,1,255);wc(a)}g=g+1|0}while(g>>>0<k>>>0)}k=c[e>>2]|0;if(!k){Ea=b;return}g=e+4|0;a=c[g>>2]|0;if((a|0)==(k|0))o=k;else{m=a;do{a=m;m=m+-12|0;d=c[m>>2]|0;if(d|0){c[a+-8>>2]=d;ne(d)}}while((m|0)!=(k|0));o=c[e>>2]|0}c[g>>2]=k;ne(o);Ea=b;return}function jb(b,d){b=b|0;d=d|0;var e=0,f=0,h=0,i=0,j=0,k=0,l=0;e=Ea;Ea=Ea+16|0;if((Ea|0)>=(Fa|0))y(16);f=e;h=b+68|0;i=(c[h>>2]|0)+d|0;c[h>>2]=i;j=((i>>>0)/10|0)+1|0;c[b+64>>2]=j;switch(d|0){case 1:{k=100;l=7;break}case 2:{k=300;l=7;break}case 3:{k=500;l=7;break}case 4:{k=800;l=7;break}case 5:{k=1100;l=7;break}case 6:{k=1500;l=7;break}default:{}}if((l|0)==7){l=b+72|0;c[l>>2]=(c[l>>2]|0)+k}g[b+32>>3]=700.0/((+(j>>>0)+-1.0)*.6666666666666666+1.0);k=c[b+76>>2]|0;l=b+4|0;Ke(f,j);Ac(k,l,f);if((a[f+11>>0]|0)<0)ne(c[f>>2]|0);k=c[b+84>>2]|0;Ke(f,c[h>>2]|0);Ac(k,l,f);if((a[f+11>>0]|0)<0)ne(c[f>>2]|0);k=c[b+92>>2]|0;Ke(f,c[b+72>>2]|0);Ac(k,l,f);if((a[f+11>>0]|0)>=0){Ea=e;return}ne(c[f>>2]|0);Ea=e;return}function kb(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,u=0,v=0,w=0,x=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0;f=Ea;Ea=Ea+32|0;if((Ea|0)>=(Fa|0))y(32);g=f+16|0;h=f+8|0;i=f;j=a+240|0;k=c[j>>2]|0;if((k|0)<=0){l=1;Ea=f;return l|0}m=a+236|0;n=a+4|0;a=(d|0)!=0;o=k;p=c[m>>2]|0;q=k;a:while(1){k=o;o=o+-1|0;b:do if((p|0)>0){r=k+-2|0;if((k|0)<=1){s=0;u=q;v=p;while(1){if(u>>>0>o>>>0&v>>>0>s>>>0)w=u;else{c[g>>2]=o;c[g+4>>2]=s;ae(5646,g)|0;w=c[j>>2]|0}x=c[b>>2]|0;z=c[x+(((t(w,s)|0)+k+(c[x+((c[n>>2]|0)*48|0)+32>>2]|0)|0)*48|0)+40>>2]&e;if(!(a|(z|0)==0)){l=0;A=22;break a}s=s+1|0;if((z|0)==(d|0)&(k|0)==(w|0)){l=0;A=22;break a}z=c[m>>2]|0;if((s|0)>=(z|0)){B=w;C=z;break b}else{u=w;v=z}}}v=0;u=q;s=p;while(1){if(s>>>0>v>>>0&u>>>0>r>>>0)D=u;else{c[i>>2]=r;c[i+4>>2]=v;ae(5646,i)|0;D=c[j>>2]|0}z=c[b>>2]|0;x=c[z+((c[n>>2]|0)*48|0)+32>>2]|0;E=t(D,v)|0;F=c[z+((o+E+x|0)*48|0)+40>>2]&e;if(D>>>0>o>>>0?(c[m>>2]|0)>>>0>v>>>0:0){G=E;H=x;I=z;J=D}else{c[h>>2]=o;c[h+4>>2]=v;ae(5646,h)|0;z=c[j>>2]|0;x=c[b>>2]|0;G=t(z,v)|0;H=c[x+((c[n>>2]|0)*48|0)+32>>2]|0;I=x;J=z}z=c[I+((G+k+H|0)*48|0)+40>>2]&e;if((F|0)==(d|0)?(z|0)!=(d|0)&(z|0)!=0:0){l=0;A=22;break a}v=v+1|0;if((z|0)==(d|0)&(k|0)==(J|0)){l=0;A=22;break a}z=c[m>>2]|0;if((v|0)>=(z|0)){B=J;C=z;break}else{u=J;s=z}}}else{B=q;C=p}while(0);if((k|0)<=1){l=1;A=22;break}else{p=C;q=B}}if((A|0)==22){Ea=f;return l|0}return 0}function lb(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,u=0,v=0,w=0;b=Ea;Ea=Ea+16|0;if((Ea|0)>=(Fa|0))y(16);d=b;e=b+12|0;f=b+8|0;g=a+56|0;h=c[g>>2]|0;i=c[h+240>>2]|0;if((i|0)<=0){wc(a);Ea=b;return}j=a+4|0;k=i;i=h;a:while(1){h=k;k=k+-1|0;l=c[i+236>>2]|0;if((l|0)>0){m=0;n=i;o=l;while(1){l=n+240|0;p=c[l>>2]|0;if(o>>>0>m>>>0&p>>>0>k>>>0){q=p;r=n;s=p}else{c[d>>2]=k;c[d+4>>2]=m;ae(5646,d)|0;p=c[g>>2]|0;q=c[l>>2]|0;r=p;s=c[p+240>>2]|0}p=c[j>>2]|0;l=c[p+(((t(q,m)|0)+h+(c[p+((c[n+4>>2]|0)*48|0)+32>>2]|0)|0)*48|0)+40>>2]|0;u=((l&255|0)==0?0:2)|l&-256;l=(c[p+((c[r+4>>2]|0)*48|0)+32>>2]|0)+h+(t(s,m)|0)|0;c[p+(l*48|0)+40>>2]=u;c[e>>2]=l;c[f>>2]=u;u=c[r+264>>2]|0;if(!u){v=10;break a}Qa[c[(c[u>>2]|0)+24>>2]&15](u,j,e,f);m=m+1|0;u=c[g>>2]|0;o=c[u+236>>2]|0;if((m|0)>=(o|0)){w=u;break}else n=u}}else w=i;if((h|0)<=1){v=3;break}else i=w}if((v|0)==3){wc(a);Ea=b;return}else if((v|0)==10){v=$(4)|0;c[v>>2]=4208;da(v|0,3024,27)}}function mb(a,b,d){a=a|0;b=+b;d=d|0;var e=0,f=0,h=0,i=0.0,j=0.0,k=0,l=0,m=0,n=0,o=0,p=0;e=a+128|0;f=(c[e>>2]|0)==1?2:1;h=c[d>>2]|0;if((c[h+136>>2]&131072|0)==0?(c[h+12>>2]&524288|0)==0:0)i=+g[a+32>>3];else i=+g[a+32>>3]/10.0;h=a+48|0;j=+g[h>>3]+b;g[h>>3]=j;k=a+40|0;if(!(j-+g[k>>3]>i))return;l=a+56|0;m=a+4|0;if(kb(c[l>>2]|0,m,1,255)|0){n=Cc(c[l>>2]|0,m,f,255)|0;o=Dc(c[l>>2]|0,m,f,255)|0;p=a+144|0;Bc(c[l>>2]|0,m,1,p);if((c[(c[d>>2]|0)+136>>2]&65536|0?!(n|(Cc(c[l>>2]|0,m,f,255)|0)^1):0)?(Ec(c[l>>2]|0,m,f,p),(c[e>>2]|0)==1):0){n=a+136|0;c[n>>2]=(c[n>>2]|0)+-1;n=a+140|0;c[n>>2]=(c[n>>2]|0)+-1}if((c[(c[d>>2]|0)+136>>2]&32768|0?!(o|(Dc(c[l>>2]|0,m,f,255)|0)^1):0)?(Fc(c[l>>2]|0,m,f,p),(c[e>>2]|0)==1):0){e=a+136|0;c[e>>2]=(c[e>>2]|0)+1;e=a+140|0;c[e>>2]=(c[e>>2]|0)+1}}else{lb(a);ib(a)}g[k>>3]=+g[h>>3];return}function nb(a,b){a=a|0;b=b|0;return}function ob(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0;d=Ea;Ea=Ea+16|0;if((Ea|0)>=(Fa|0))y(16);e=d;f=a+128|0;g=(c[f>>2]|0)==1?2:1;switch(b|0){case 32:{b=a+56|0;h=a+4|0;if(!(kb(c[b>>2]|0,h,1,255)|0)){Ea=d;return}i=a+144|0;do Bc(c[b>>2]|0,h,1,i);while(kb(c[b>>2]|0,h,1,255)|0);Ea=d;return}case 97:case 1104:{ce(6062)|0;h=a+56|0;b=a+4|0;if(!(Cc(c[h>>2]|0,b,g,255)|0)){Ea=d;return}ce(6079)|0;Ec(c[h>>2]|0,b,g,a+144|0);if((c[f>>2]|0)!=1){Ea=d;return}b=a+136|0;c[b>>2]=(c[b>>2]|0)+-1;b=a+140|0;c[b>>2]=(c[b>>2]|0)+-1;Ea=d;return}case 100:case 1103:{b=a+56|0;h=a+4|0;if(!(Dc(c[b>>2]|0,h,g,255)|0)){Ea=d;return}Fc(c[b>>2]|0,h,g,a+144|0);if((c[f>>2]|0)!=1){Ea=d;return}h=a+136|0;c[h>>2]=(c[h>>2]|0)+1;h=a+140|0;c[h>>2]=(c[h>>2]|0)+1;Ea=d;return}case 119:case 1106:{h=a+56|0;b=a+4|0;tc(e,c[h>>2]|0,b,g,255);i=e+8|0;if(uc(c[h>>2]|0,b,e,c[i>>2]|0,g,255)|0){vc(c[h>>2]|0,b,e,c[i>>2]|0,g,255);if((c[f>>2]|0)==1){f=a+136|0;g=c[f>>2]|0;b=a+140|0;h=c[b>>2]|0;j=(c[e>>2]|0)-g+((1-g+h|0)/-2|0)+((c[i>>2]|0)/2|0)|0;c[f>>2]=j+g;c[b>>2]=j+h}wc(a)}Ea=d;return}default:{Ea=d;return}}}function pb(a,b,c){a=a|0;b=+b;c=c|0;return}function qb(a,b){a=a|0;b=b|0;return}function rb(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0;c[a>>2]=0;d=a+4|0;c[d>>2]=0;e=a+8|0;c[e>>2]=0;f=b+4|0;g=(c[f>>2]|0)-(c[b>>2]|0)|0;h=(g|0)/12|0;if(!g)return;if(h>>>0>357913941)Oe(a);i=me(g)|0;c[d>>2]=i;c[a>>2]=i;c[e>>2]=i+(h*12|0);h=c[b>>2]|0;b=c[f>>2]|0;if((h|0)==(b|0))return;f=h;h=i;do{sb(h,f);f=f+12|0;h=(c[d>>2]|0)+12|0;c[d>>2]=h}while((f|0)!=(b|0));return}function sb(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0;c[a>>2]=0;d=a+4|0;c[d>>2]=0;e=a+8|0;c[e>>2]=0;f=b+4|0;g=(c[f>>2]|0)-(c[b>>2]|0)|0;h=(g|0)/12|0;if(!g)return;if(h>>>0>357913941)Oe(a);i=me(g)|0;c[d>>2]=i;c[a>>2]=i;c[e>>2]=i+(h*12|0);h=c[b>>2]|0;b=c[f>>2]|0;if((h|0)==(b|0))return;f=h;h=i;while(1){c[h>>2]=0;i=h+4|0;c[i>>2]=0;e=h+8|0;c[e>>2]=0;a=f+4|0;g=(c[a>>2]|0)-(c[f>>2]|0)|0;j=g>>2;if(g|0){if(j>>>0>1073741823){k=8;break}l=me(g)|0;c[i>>2]=l;c[h>>2]=l;c[e>>2]=l+(j<<2);j=c[f>>2]|0;e=(c[a>>2]|0)-j|0;if((e|0)>0){Qf(l|0,j|0,e|0)|0;c[i>>2]=l+(e>>>2<<2)}}f=f+12|0;e=(c[d>>2]|0)+12|0;c[d>>2]=e;if((f|0)==(b|0)){k=12;break}else h=e}if((k|0)==8)Oe(h);else if((k|0)==12)return}function tb(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;d=a+4|0;e=c[a>>2]|0;f=(c[d>>2]|0)-e|0;g=(f|0)/48|0;h=g+1|0;if(h>>>0>89478485)Oe(a);i=a+8|0;j=((c[i>>2]|0)-e|0)/48|0;k=j<<1;l=j>>>0<44739242?(k>>>0<h>>>0?h:k):89478485;do if(l)if(l>>>0>89478485){k=$(8)|0;se(k,4594);c[k>>2]=4332;da(k|0,3152,34)}else{m=me(l*48|0)|0;break}else m=0;while(0);k=m+(g*48|0)|0;g=m+(l*48|0)|0;l=k;m=b;b=l+48|0;do{c[l>>2]=c[m>>2];l=l+4|0;m=m+4|0}while((l|0)<(b|0));m=k+(((f|0)/-48|0)*48|0)|0;if((f|0)>0)Qf(m|0,e|0,f|0)|0;c[a>>2]=m;c[d>>2]=k+48;c[i>>2]=g;if(!e)return;ne(e);return}function ub(a){a=a|0;return}function vb(a){a=a|0;ne(a);return}function wb(a){a=a|0;a=me(8)|0;c[a>>2]=3264;return a|0}function xb(a,b){a=a|0;b=b|0;c[b>>2]=3264;return}function yb(a){a=a|0;return}function zb(a){a=a|0;ne(a);return}function Ab(a,b){a=a|0;b=b|0;var d=0;b=a+8|0;d=b+36|0;do{c[b>>2]=0;b=b+4|0}while((b|0)<(d|0));c[a+44>>2]=6;c[a>>2]=0;c[a+4>>2]=0;c[a+16>>2]=0;c[a+20>>2]=0;f[a+24>>2]=3.0;f[a+28>>2]=1.0;c[a+32>>2]=-1;c[a+36>>2]=255;return}function Bb(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==4844?a+4|0:0)|0}function Cb(a){a=a|0;return 2832}function Db(a){a=a|0;ne(a);return}function Eb(a){a=a|0;a=me(8)|0;c[a>>2]=3308;return a|0}function Fb(a,b){a=a|0;b=b|0;c[b>>2]=3308;return}function Gb(a){a=a|0;return}function Hb(a){a=a|0;ne(a);return}function Ib(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0;a=c[d>>2]|0;d=c[b>>2]|0;b=c[d+(a*48|0)+44>>2]|0;f=d+(a*48|0)+36|0;switch(b|0){case 6:case 4:break;default:return}c[f>>2]=((b|0)==6?c[f>>2]&255:0)|c[e>>2]&-256;return}function Jb(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==5097?a+4|0:0)|0}function Kb(a){a=a|0;return 2864}function Lb(a){a=a|0;return}function Mb(a,b,d){a=a|0;b=b|0;d=d|0;c[a+52>>2]=d;return}function Nb(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0;e=c[d>>2]|0;f=c[b>>2]|0;c[f+((c[a+4>>2]|0)*48|0)+36>>2]=c[f+((c[e+4>>2]|0)*48|0)+36>>2];f=a+228|0;b=c[f>>2]|0;if((b|0)==(c[a+232>>2]|0)){Vb(a+224|0,d);return}c[b>>2]=e;e=c[d+4>>2]|0;c[b+4>>2]=e;if(!e)g=b;else{b=e+4|0;c[b>>2]=(c[b>>2]|0)+1;g=c[f>>2]|0}c[f>>2]=g+8;return}function Ob(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0;f=Ea;Ea=Ea+16|0;if((Ea|0)>=(Fa|0))y(16);g=f+8|0;h=f;i=a+24|0;j=c[i+4>>2]|0;k=g;c[k>>2]=c[i>>2];c[k+4>>2]=j;j=a+16|0;k=c[j+4>>2]|0;i=h;c[i>>2]=c[j>>2];c[i+4>>2]=k;Sb(a,b,d,e);Qa[c[(c[a>>2]|0)+12>>2]&15](a,b,h,g);Tb(a,b);Ea=f;return}function Pb(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0.0,r=0;g=a+4|0;h=c[g>>2]|0;i=c[b>>2]|0;j=(c[i+(h*48|0)+32>>2]|0)+1|0;if(j>>>0>(c[i+(h*48|0)+36>>2]|0)>>>0)return;h=d+4|0;k=e+4|0;l=a+16|0;m=a+24|0;n=a+20|0;o=a+28|0;a=j;j=i;while(1){switch(c[j+(a*48|0)+44>>2]|0){case 7:case 6:case 4:case 3:case 2:{i=j+(a*48|0)|0;p=j+(a*48|0)+4|0;q=+f[n>>2]+(+f[p>>2]-+f[h>>2])/+f[k>>2]*+f[o>>2];f[i>>2]=+f[l>>2]+(+f[i>>2]-+f[d>>2])/+f[e>>2]*+f[m>>2];f[p>>2]=q;p=c[b>>2]|0;if((c[p+(a*48|0)+44>>2]|0)==7)r=p;else{p=j+(a*48|0)+16|0;i=j+(a*48|0)+20|0;q=+f[i>>2]/+f[k>>2]*+f[o>>2];f[p>>2]=+f[p>>2]/+f[e>>2]*+f[m>>2];f[i>>2]=q;r=c[b>>2]|0}break}default:r=j}a=a+1|0;if(a>>>0>(c[r+((c[g>>2]|0)*48|0)+36>>2]|0)>>>0)break;else j=r}return}function Qb(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;Sb(a,b,c,d);Tb(a,b);return}function Rb(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;return}function Sb(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var g=0,h=0,i=0,j=0.0,k=0.0,l=0,m=0.0,n=0.0,o=0.0,p=0.0;g=d;h=c[g+4>>2]|0;i=a+40|0;c[i>>2]=c[g>>2];c[i+4>>2]=h;h=e;i=c[h+4>>2]|0;g=a+32|0;c[g>>2]=c[h>>2];c[g+4>>2]=i;i=c[a+4>>2]|0;g=c[b>>2]|0;j=+f[g+(i*48|0)+8>>2]*+f[e>>2]+ +f[g+(i*48|0)+24>>2];b=e+4|0;k=+f[g+(i*48|0)+12>>2]*+f[b>>2]+ +f[g+(i*48|0)+28>>2];f[a+24>>2]=j;h=a+28|0;f[h>>2]=k;l=(c[a+52>>2]|0)==1;do if(l){m=+f[a+48>>2];n=k*m;if(n<j){f[a+24>>2]=n;o=n;p=k;break}else{n=j/m;f[h>>2]=n;o=j;p=n;break}}else{o=j;p=k}while(0);k=+f[g+(i*48|0)+20>>2]+(+f[d+4>>2]+ +f[b>>2]*+f[g+(i*48|0)+4>>2]-+f[a+12>>2]*p);f[a+16>>2]=+f[g+(i*48|0)+16>>2]+(+f[d>>2]+ +f[e>>2]*+f[g+(i*48|0)>>2]-+f[a+8>>2]*o);f[a+20>>2]=k;if(!l)return;k=+f[a+48>>2];j=p*k;if(j<o){f[a+24>>2]=j;return}else{f[h>>2]=o/k;return}}function Tb(a,b){a=a|0;b=b|0;var d=0,e=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0;d=Ea;Ea=Ea+16|0;if((Ea|0)>=(Fa|0))y(16);e=d;g=a+16|0;h=g;i=c[h+4>>2]|0;j=e;c[j>>2]=c[h>>2];c[j+4>>2]=i;i=c[a+224>>2]|0;j=c[a+228>>2]|0;if((i|0)==(j|0)){Ea=d;return}h=a+56|0;k=a+24|0;a=e+4|0;l=i;do{i=c[l>>2]|0;m=c[l+4>>2]|0;n=(m|0)==0;if(!n){o=m+4|0;c[o>>2]=(c[o>>2]|0)+1}o=c[h>>2]|0;do if((o|0)!=2){p=i;q=c[(c[i>>2]|0)+8>>2]|0;if((o|0)==1){Qa[q&15](p,b,e,k);f[e>>2]=+f[p+16>>2]+ +f[p+24>>2];break}else{Qa[q&15](p,b,g,k);break}}else{p=i;Qa[c[(c[i>>2]|0)+8>>2]&15](p,b,e,k);f[a>>2]=+f[p+20>>2]+ +f[p+28>>2]}while(0);if(!n?(i=m+4|0,o=c[i>>2]|0,c[i>>2]=o+-1,(o|0)==0):0){La[c[(c[m>>2]|0)+8>>2]&63](m);le(m)}l=l+8|0}while((l|0)!=(j|0));Ea=d;return}function Ub(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;d=a+4|0;e=c[a>>2]|0;f=(c[d>>2]|0)-e|0;g=(f|0)/48|0;h=g+1|0;if(h>>>0>89478485)Oe(a);i=a+8|0;j=((c[i>>2]|0)-e|0)/48|0;k=j<<1;l=j>>>0<44739242?(k>>>0<h>>>0?h:k):89478485;do if(l)if(l>>>0>89478485){k=$(8)|0;se(k,4594);c[k>>2]=4332;da(k|0,3152,34)}else{m=me(l*48|0)|0;break}else m=0;while(0);k=m+(g*48|0)|0;g=m+(l*48|0)|0;l=k;m=b;b=l+48|0;do{c[l>>2]=c[m>>2];l=l+4|0;m=m+4|0}while((l|0)<(b|0));m=k+(((f|0)/-48|0)*48|0)|0;if((f|0)>0)Qf(m|0,e|0,f|0)|0;c[a>>2]=m;c[d>>2]=k+48;c[i>>2]=g;if(!e)return;ne(e);return}function Vb(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0;d=a+4|0;e=c[d>>2]|0;f=c[a>>2]|0;g=e-f>>3;h=g+1|0;i=f;j=e;if(h>>>0>536870911)Oe(a);e=a+8|0;k=(c[e>>2]|0)-f|0;f=k>>2;l=k>>3>>>0<268435455?(f>>>0<h>>>0?h:f):536870911;do if(l)if(l>>>0>536870911){f=$(8)|0;se(f,4594);c[f>>2]=4332;da(f|0,3152,34)}else{m=me(l<<3)|0;break}else m=0;while(0);f=m+(g<<3)|0;h=m+(l<<3)|0;c[f>>2]=c[b>>2];l=c[b+4>>2]|0;c[m+(g<<3)+4>>2]=l;if(!l){n=i;o=j}else{j=l+4|0;c[j>>2]=(c[j>>2]|0)+1;n=c[a>>2]|0;o=c[d>>2]|0}j=f+8|0;l=n;if((o|0)==(n|0)){p=f;q=l;r=o}else{i=g+-1-((o+-8-l|0)>>>3)|0;l=o;o=f;do{f=o;o=o+-8|0;g=l;l=l+-8|0;c[o>>2]=c[l>>2];b=g+-4|0;c[f+-4>>2]=c[b>>2];c[l>>2]=0;c[b>>2]=0}while((l|0)!=(n|0));p=m+(i<<3)|0;q=c[a>>2]|0;r=c[d>>2]|0}c[a>>2]=p;c[d>>2]=j;c[e>>2]=h;h=q;if((r|0)!=(h|0)){e=r;do{r=c[e+-4>>2]|0;e=e+-8|0;if(r|0?(j=r+4|0,d=c[j>>2]|0,c[j>>2]=d+-1,(d|0)==0):0){La[c[(c[r>>2]|0)+8>>2]&63](r);le(r)}}while((e|0)!=(h|0))}if(!q)return;ne(q);return}function Wb(a,b){a=a|0;b=b|0;return}function Xb(a){a=a|0;ke(a);ne(a);return}function Yb(a){a=a|0;var b=0;b=c[a+12>>2]|0;if(!b)return;c[b>>2]=3352;a=c[b+264>>2]|0;if((b+248|0)!=(a|0)){if(a|0)La[c[(c[a>>2]|0)+20>>2]&63](a)}else La[c[(c[a>>2]|0)+16>>2]&63](a);rc(b);ne(b);return}function Zb(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==5318?a+12|0:0)|0}function _b(a){a=a|0;ne(a);return}function $b(a,b){a=a|0;b=b|0;return}function ac(a){a=a|0;ke(a);ne(a);return}function bc(a){a=a|0;var b=0;b=c[a+12>>2]|0;if(!b)return;rc(b);ne(b);return}function cc(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==5445?a+12|0:0)|0}function dc(a){a=a|0;ne(a);return}function ec(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0;c[a+52>>2]=d;if((d|0)!=2)return;d=c[a+4>>2]|0;e=c[b>>2]|0;f=e+(((c[e+(d*48|0)+32>>2]|0)+1|0)*48|0)+16|0;g=c[f+4>>2]|0;h=e+(d*48|0)+24|0;c[h>>2]=c[f>>2];c[h+4>>2]=g;Qa[c[(c[a>>2]|0)+8>>2]&15](a,b,a+40|0,a+32|0);return}function fc(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0;f=Ea;Ea=Ea+16|0;if((Ea|0)>=(Fa|0))y(16);g=f+8|0;h=f;i=a+24|0;j=c[i+4>>2]|0;k=g;c[k>>2]=c[i>>2];c[k+4>>2]=j;j=a+16|0;k=c[j+4>>2]|0;i=h;c[i>>2]=c[j>>2];c[i+4>>2]=k;Sb(a,b,d,e);Qa[c[(c[a>>2]|0)+12>>2]&15](a,b,h,g);Tb(a,b);Ea=f;return}function gc(b,d,e,g){b=b|0;d=d|0;e=e|0;g=g|0;var h=0,i=0,j=0,k=0.0,l=0,m=0.0,n=0.0,o=0;g=c[d>>2]|0;d=(c[g+((c[b+4>>2]|0)*48|0)+32>>2]|0)+1|0;e=g+(d*48|0)|0;switch(c[b+52>>2]|0){case 0:{h=g+(d*48|0)+36|0;i=(c[2006]|0)+((c[h>>2]|0)*12|0)|0;j=g+(d*48|0)+24|0;k=+f[j>>2];if((a[i+11>>0]|0)<0)l=c[i>>2]|0;else l=i;m=+R(l|0,+k);n=k*(+f[b+24>>2]/m);l=(c[2006]|0)+((c[h>>2]|0)*12|0)|0;f[j>>2]=n;if((a[l+11>>0]|0)<0)o=c[l>>2]|0;else o=l;f[g+(d*48|0)+16>>2]=+R(o|0,+n);f[g+(d*48|0)+20>>2]=n;switch(c[g+(d*48|0)+44>>2]|0){case 7:case 2:case 3:case 4:case 6:break;default:return}m=+f[b+20>>2]+(+f[b+28>>2]-n)*+f[b+12>>2];c[e>>2]=c[b+16>>2];f[g+(d*48|0)+4>>2]=m;return}case 2:{switch(c[g+(d*48|0)+44>>2]|0){case 7:case 2:case 3:case 4:case 6:break;default:return}d=b+16|0;b=c[d+4>>2]|0;g=e;c[g>>2]=c[d>>2];c[g+4>>2]=b;return}default:return}}function hc(b,e){b=b|0;e=e|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0.0,G=0.0,H=0,I=0,J=0,K=0;g=a[e+11>>0]|0;h=g<<24>>24<0;i=h?c[e>>2]|0:e;j=h?c[e+4>>2]|0:g&255;if(j>>>0>3){g=i;h=j;k=j;while(1){l=t(d[g>>0]|d[g+1>>0]<<8|d[g+2>>0]<<16|d[g+3>>0]<<24,1540483477)|0;h=(t(l>>>24^l,1540483477)|0)^(t(h,1540483477)|0);k=k+-4|0;if(k>>>0<=3)break;else g=g+4|0}g=j+-4|0;k=g&-4;m=g-k|0;n=i+(k+4)|0;o=h}else{m=j;n=i;o=j}switch(m|0){case 3:{p=d[n+2>>0]<<16^o;q=7;break}case 2:{p=o;q=7;break}case 1:{r=o;q=8;break}default:u=o}if((q|0)==7){r=d[n+1>>0]<<8^p;q=8}if((q|0)==8)u=t(r^d[n>>0],1540483477)|0;n=t(u>>>13^u,1540483477)|0;u=n>>>15^n;n=b+4|0;r=c[n>>2]|0;p=(r|0)==0;a:do if(!p){o=r+-1|0;m=(o&r|0)==0;if(!m)if(u>>>0<r>>>0)v=u;else v=(u>>>0)%(r>>>0)|0;else v=u&o;h=c[(c[b>>2]|0)+(v<<2)>>2]|0;if((h|0)!=0?(k=c[h>>2]|0,(k|0)!=0):0){h=(j|0)==0;if(m){if(h){m=k;while(1){g=c[m+4>>2]|0;if(!((g|0)==(u|0)|(g&o|0)==(v|0))){w=v;break a}g=a[m+8+11>>0]|0;if(!((g<<24>>24<0?c[m+12>>2]|0:g&255)|0)){x=m;break}m=c[m>>2]|0;if(!m){w=v;break a}}y=x+20|0;return y|0}m=k;b:while(1){g=c[m+4>>2]|0;if(!((g|0)==(u|0)|(g&o|0)==(v|0))){w=v;break a}g=m+8|0;l=a[g+11>>0]|0;z=l<<24>>24<0;A=l&255;do if(((z?c[m+12>>2]|0:A)|0)==(j|0)){l=c[g>>2]|0;if(z)if(!(Wd(l,i,j)|0)){x=m;q=68;break b}else break;if((a[i>>0]|0)==(l&255)<<24>>24){l=g;B=A;C=i;do{B=B+-1|0;l=l+1|0;if(!B){x=m;q=68;break b}C=C+1|0}while((a[l>>0]|0)==(a[C>>0]|0))}}while(0);m=c[m>>2]|0;if(!m){w=v;break a}}if((q|0)==68){y=x+20|0;return y|0}}if(h){m=k;while(1){o=c[m+4>>2]|0;if((o|0)!=(u|0)){if(o>>>0<r>>>0)D=o;else D=(o>>>0)%(r>>>0)|0;if((D|0)!=(v|0)){w=v;break a}}o=a[m+8+11>>0]|0;if(!((o<<24>>24<0?c[m+12>>2]|0:o&255)|0)){x=m;break}m=c[m>>2]|0;if(!m){w=v;break a}}y=x+20|0;return y|0}m=k;c:while(1){h=c[m+4>>2]|0;if((h|0)!=(u|0)){if(h>>>0<r>>>0)E=h;else E=(h>>>0)%(r>>>0)|0;if((E|0)!=(v|0)){w=v;break a}}h=m+8|0;o=a[h+11>>0]|0;A=o<<24>>24<0;g=o&255;do if(((A?c[m+12>>2]|0:g)|0)==(j|0)){o=c[h>>2]|0;if(A)if(!(Wd(o,i,j)|0)){x=m;q=68;break c}else break;if((a[i>>0]|0)==(o&255)<<24>>24){o=h;z=g;C=i;do{z=z+-1|0;o=o+1|0;if(!z){x=m;q=68;break c}C=C+1|0}while((a[o>>0]|0)==(a[C>>0]|0))}}while(0);m=c[m>>2]|0;if(!m){w=v;break a}}if((q|0)==68){y=x+20|0;return y|0}}else w=v}else w=0;while(0);v=me(24)|0;ve(v+8|0,e);c[v+20>>2]=0;c[v+4>>2]=u;c[v>>2]=0;e=b+12|0;F=+(((c[e>>2]|0)+1|0)>>>0);G=+f[b+16>>2];do if(p|G*+(r>>>0)<F){i=r<<1|(r>>>0<3|(r+-1&r|0)!=0)&1;j=~~+s(+(F/G))>>>0;kc(b,i>>>0<j>>>0?j:i);i=c[n>>2]|0;j=i+-1|0;if(!(j&i)){H=i;I=j&u;break}if(u>>>0<i>>>0){H=i;I=u}else{H=i;I=(u>>>0)%(i>>>0)|0}}else{H=r;I=w}while(0);w=(c[b>>2]|0)+(I<<2)|0;I=c[w>>2]|0;if(!I){r=b+8|0;c[v>>2]=c[r>>2];c[r>>2]=v;c[w>>2]=r;r=c[v>>2]|0;if(r|0){w=c[r+4>>2]|0;r=H+-1|0;if(r&H)if(w>>>0<H>>>0)J=w;else J=(w>>>0)%(H>>>0)|0;else J=w&r;K=(c[b>>2]|0)+(J<<2)|0;q=66}}else{c[v>>2]=c[I>>2];K=I;q=66}if((q|0)==66)c[K>>2]=v;c[e>>2]=(c[e>>2]|0)+1;x=v;y=x+20|0;return y|0}function ic(b,e){b=b|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,u=0,v=0,w=0;f=a[e+11>>0]|0;g=f<<24>>24<0;h=g?c[e>>2]|0:e;i=g?c[e+4>>2]|0:f&255;if(i>>>0>3){f=h;e=i;g=i;while(1){j=t(d[f>>0]|d[f+1>>0]<<8|d[f+2>>0]<<16|d[f+3>>0]<<24,1540483477)|0;e=(t(j>>>24^j,1540483477)|0)^(t(e,1540483477)|0);g=g+-4|0;if(g>>>0<=3)break;else f=f+4|0}f=i+-4|0;g=f&-4;k=f-g|0;l=h+(g+4)|0;m=e}else{k=i;l=h;m=i}switch(k|0){case 3:{n=d[l+2>>0]<<16^m;o=7;break}case 2:{n=m;o=7;break}case 1:{p=m;o=8;break}default:q=m}if((o|0)==7){p=d[l+1>>0]<<8^n;o=8}if((o|0)==8)q=t(p^d[l>>0],1540483477)|0;l=t(q>>>13^q,1540483477)|0;q=l>>>15^l;l=c[b+4>>2]|0;if(!l){r=0;return r|0}p=l+-1|0;n=(p&l|0)==0;if(!n)if(q>>>0<l>>>0)s=q;else s=(q>>>0)%(l>>>0)|0;else s=q&p;m=c[(c[b>>2]|0)+(s<<2)>>2]|0;if(!m){r=0;return r|0}b=c[m>>2]|0;if(!b){r=0;return r|0}m=(i|0)==0;if(n){n=b;a:while(1){k=c[n+4>>2]|0;e=(k|0)==(q|0);if(!(e|(k&p|0)==(s|0))){r=0;o=45;break}do if(e?(k=n+8|0,g=a[k+11>>0]|0,f=g<<24>>24<0,j=g&255,((f?c[n+12>>2]|0:j)|0)==(i|0)):0){g=c[k>>2]|0;u=f?g:k;v=g&255;if(f){if(m){r=n;o=45;break a}if(!(Wd(u,h,i)|0)){r=n;o=45;break a}else break}if(m){r=n;o=45;break a}if((a[h>>0]|0)==v<<24>>24){v=k;k=j;j=h;do{k=k+-1|0;v=v+1|0;if(!k){r=n;o=45;break a}j=j+1|0}while((a[v>>0]|0)==(a[j>>0]|0))}}while(0);n=c[n>>2]|0;if(!n){r=0;o=45;break}}if((o|0)==45)return r|0}n=b;b:while(1){b=c[n+4>>2]|0;do if((b|0)==(q|0)){p=n+8|0;e=a[p+11>>0]|0;j=e<<24>>24<0;v=e&255;if(((j?c[n+12>>2]|0:v)|0)==(i|0)){e=c[p>>2]|0;k=j?e:p;u=e&255;if(j){if(m){r=n;o=45;break b}if(!(Wd(k,h,i)|0)){r=n;o=45;break b}else break}if(m){r=n;o=45;break b}if((a[h>>0]|0)==u<<24>>24){u=p;p=v;v=h;do{p=p+-1|0;u=u+1|0;if(!p){r=n;o=45;break b}v=v+1|0}while((a[u>>0]|0)==(a[v>>0]|0))}}}else{if(b>>>0<l>>>0)w=b;else w=(b>>>0)%(l>>>0)|0;if((w|0)!=(s|0)){r=0;o=45;break b}}while(0);n=c[n>>2]|0;if(!n){r=0;o=45;break}}if((o|0)==45)return r|0;return 0}function jc(b,d){b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0;e=b+4|0;f=c[b>>2]|0;g=((c[e>>2]|0)-f|0)/12|0;h=g+1|0;if(h>>>0>357913941)Oe(b);i=b+8|0;j=((c[i>>2]|0)-f|0)/12|0;f=j<<1;k=j>>>0<178956970?(f>>>0<h>>>0?h:f):357913941;do if(k)if(k>>>0>357913941){f=$(8)|0;se(f,4594);c[f>>2]=4332;da(f|0,3152,34)}else{l=me(k*12|0)|0;break}else l=0;while(0);f=l+(g*12|0)|0;g=l+(k*12|0)|0;ve(f,d);d=f+12|0;k=c[b>>2]|0;l=c[e>>2]|0;if((l|0)==(k|0)){m=f;n=k;o=k}else{h=l;l=f;do{l=l+-12|0;h=h+-12|0;c[l>>2]=c[h>>2];c[l+4>>2]=c[h+4>>2];c[l+8>>2]=c[h+8>>2];c[h>>2]=0;c[h+4>>2]=0;c[h+8>>2]=0}while((h|0)!=(k|0));m=l;n=c[b>>2]|0;o=c[e>>2]|0}c[b>>2]=m;c[e>>2]=d;c[i>>2]=g;g=n;if((o|0)!=(g|0)){i=o;do{i=i+-12|0;if((a[i+11>>0]|0)<0)ne(c[i>>2]|0)}while((i|0)!=(g|0))}if(!n)return;ne(n);return}function kc(a,b){a=a|0;b=b|0;var d=0,e=0,g=0,h=0;if((b|0)!=1)if(!(b+-1&b))d=b;else d=ie(b)|0;else d=2;b=c[a+4>>2]|0;if(d>>>0>b>>>0){lc(a,d);return}if(d>>>0>=b>>>0)return;e=~~+s(+(+((c[a+12>>2]|0)>>>0)/+f[a+16>>2]))>>>0;if(b>>>0>2&(b+-1&b|0)==0){g=1<<32-(u(e+-1|0)|0);h=e>>>0<2?e:g}else h=ie(e)|0;e=d>>>0<h>>>0?h:d;if(e>>>0>=b>>>0)return;lc(a,e);return}function lc(b,d){b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0;e=b+4|0;if(!d){f=c[b>>2]|0;c[b>>2]=0;if(f|0)ne(f);c[e>>2]=0;return}if(d>>>0>1073741823){f=$(8)|0;se(f,4594);c[f>>2]=4332;da(f|0,3152,34)}f=me(d<<2)|0;g=c[b>>2]|0;c[b>>2]=f;if(g|0)ne(g);c[e>>2]=d;e=0;do{c[(c[b>>2]|0)+(e<<2)>>2]=0;e=e+1|0}while((e|0)!=(d|0));e=b+8|0;g=c[e>>2]|0;if(!g)return;f=c[g+4>>2]|0;h=d+-1|0;i=(h&d|0)==0;if(!i)if(f>>>0<d>>>0)j=f;else j=(f>>>0)%(d>>>0)|0;else j=f&h;c[(c[b>>2]|0)+(j<<2)>>2]=e;e=c[g>>2]|0;if(!e)return;f=j;j=e;e=g;while(1){g=c[j+4>>2]|0;if(!i)if(g>>>0<d>>>0)k=g;else k=(g>>>0)%(d>>>0)|0;else k=g&h;do if((k|0)==(f|0)){l=f;m=j}else{g=(c[b>>2]|0)+(k<<2)|0;if(!(c[g>>2]|0)){c[g>>2]=e;l=k;m=j;break}g=c[j>>2]|0;a:do if(!g)n=j;else{o=j+8|0;p=a[o+11>>0]|0;q=p<<24>>24<0;r=p&255;p=q?c[j+12>>2]|0:r;s=(p|0)==0;if(q){q=j;t=g;while(1){u=t+8|0;v=a[u+11>>0]|0;w=v<<24>>24<0;if((p|0)!=((w?c[t+12>>2]|0:v&255)|0)){n=q;break a}if(!s?Wd(c[o>>2]|0,w?c[u>>2]|0:u,p)|0:0){n=q;break a}u=c[t>>2]|0;if(!u){n=t;break a}else{w=t;t=u;q=w}}}if(s){q=j;t=g;while(1){w=a[t+8+11>>0]|0;if((w<<24>>24<0?c[t+12>>2]|0:w&255)|0){n=q;break a}w=c[t>>2]|0;if(!w){n=t;break a}else{u=t;t=w;q=u}}}q=j;t=g;while(1){s=t+8|0;u=a[s+11>>0]|0;w=u<<24>>24<0;if((p|0)!=((w?c[t+12>>2]|0:u&255)|0)){n=q;break a}u=w?c[s>>2]|0:s;if((a[u>>0]|0)!=(c[o>>2]&255)<<24>>24){n=q;break a}s=o;w=r;v=u;while(1){w=w+-1|0;s=s+1|0;if(!w)break;v=v+1|0;if((a[s>>0]|0)!=(a[v>>0]|0)){n=q;break a}}v=c[t>>2]|0;if(!v){n=t;break}else{s=t;t=v;q=s}}}while(0);c[e>>2]=c[n>>2];c[n>>2]=c[c[(c[b>>2]|0)+(k<<2)>>2]>>2];c[c[(c[b>>2]|0)+(k<<2)>>2]>>2]=j;l=f;m=e}while(0);j=c[m>>2]|0;if(!j)break;else{f=l;e=m}}return}function mc(a,b){a=a|0;b=b|0;return}function nc(a){a=a|0;ke(a);ne(a);return}function oc(a){a=a|0;var b=0;b=c[a+12>>2]|0;if(!b)return;rc(b);ne(b);return}function pc(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==5591?a+12|0:0)|0}function qc(a){a=a|0;ne(a);return}function rc(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0;c[a>>2]=3376;b=a+224|0;d=c[b>>2]|0;if(d|0){e=a+228|0;f=c[e>>2]|0;if((f|0)==(d|0))g=d;else{h=f;do{f=c[h+-4>>2]|0;h=h+-8|0;if(f|0?(i=f+4|0,j=c[i>>2]|0,c[i>>2]=j+-1,(j|0)==0):0){La[c[(c[f>>2]|0)+8>>2]&63](f);le(f)}}while((h|0)!=(d|0));g=c[b>>2]|0}c[e>>2]=d;ne(g)}g=c[a+220>>2]|0;if(g|0?(d=g+4|0,e=c[d>>2]|0,c[d>>2]=e+-1,(e|0)==0):0){La[c[(c[g>>2]|0)+8>>2]&63](g);le(g)}g=c[a+208>>2]|0;if((a+192|0)!=(g|0)){if(g|0)La[c[(c[g>>2]|0)+20>>2]&63](g)}else La[c[(c[g>>2]|0)+16>>2]&63](g);g=c[a+184>>2]|0;if((a+168|0)!=(g|0)){if(g|0)La[c[(c[g>>2]|0)+20>>2]&63](g)}else La[c[(c[g>>2]|0)+16>>2]&63](g);g=c[a+160>>2]|0;if((a+144|0)!=(g|0)){if(g|0)La[c[(c[g>>2]|0)+20>>2]&63](g)}else La[c[(c[g>>2]|0)+16>>2]&63](g);g=c[a+128>>2]|0;if((a+112|0)!=(g|0)){if(g|0)La[c[(c[g>>2]|0)+20>>2]&63](g)}else La[c[(c[g>>2]|0)+16>>2]&63](g);g=c[a+104>>2]|0;if((a+88|0)!=(g|0)){if(g|0)La[c[(c[g>>2]|0)+20>>2]&63](g)}else La[c[(c[g>>2]|0)+16>>2]&63](g);g=c[a+80>>2]|0;if((a+64|0)==(g|0)){La[c[(c[g>>2]|0)+16>>2]&63](g);return}if(!g)return;La[c[(c[g>>2]|0)+20>>2]&63](g);return}function sc(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,u=0,v=0,w=0,x=0,z=0,A=0,B=0;f=Ea;Ea=Ea+16|0;if((Ea|0)>=(Fa|0))y(16);g=f;h=f+8|0;i=f+4|0;j=d+4|0;k=c[j>>2]|0;l=c[d>>2]|0;if((k|0)==(l|0)){Ea=f;return}m=c[e+4>>2]|0;n=c[e>>2]|0;e=a+4|0;o=a+240|0;p=a+264|0;a=0;q=l;l=k;a:while(1){k=q;r=a;a=a+1|0;if((c[k+(r*12|0)+4>>2]|0)==(c[k+(r*12|0)>>2]|0)){s=l;u=q}else{v=a+m|0;w=0;x=k;do{c[g>>2]=c[(c[x+(r*12|0)>>2]|0)+(w<<2)>>2];ae(5633,g)|0;k=c[(c[(c[d>>2]|0)+(r*12|0)>>2]|0)+(w<<2)>>2]|0;z=c[b>>2]|0;A=v+(c[z+((c[e>>2]|0)*48|0)+32>>2]|0)+(t(c[o>>2]|0,n+w|0)|0)|0;c[z+(A*48|0)+40>>2]=k;c[h>>2]=A;c[i>>2]=k;k=c[p>>2]|0;if(!k){B=9;break a}Qa[c[(c[k>>2]|0)+24>>2]&15](k,b,h,i);w=w+1|0;x=c[d>>2]|0}while(w>>>0<(c[x+(r*12|0)+4>>2]|0)-(c[x+(r*12|0)>>2]|0)>>2>>>0);s=c[j>>2]|0;u=x}if(a>>>0>=((s-u|0)/12|0)>>>0){B=3;break}else{q=u;l=s}}if((B|0)==3){Ea=f;return}else if((B|0)==9){B=$(4)|0;c[B>>2]=4208;da(B|0,3024,27)}}function tc(a,b,d,e,f){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,u=0,v=0,w=0,x=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0;g=Ea;Ea=Ea+16|0;if((Ea|0)>=(Fa|0))y(16);h=g;i=b+236|0;j=c[i>>2]|0;k=b+240|0;l=c[k>>2]|0;if((j|0)>0){m=b+4|0;b=-1;n=l;o=-1;p=0;q=j;r=l;s=j;while(1){if((r|0)>0){u=0;v=b;w=n;x=o;z=q;A=r;while(1){if(A>>>0>u>>>0?(c[i>>2]|0)>>>0>p>>>0:0)B=A;else{c[h>>2]=u;c[h+4>>2]=p;ae(5646,h)|0;B=c[k>>2]|0}C=c[d>>2]|0;D=u;u=u+1|0;if((c[C+(((t(B,p)|0)+u+(c[C+((c[m>>2]|0)*48|0)+32>>2]|0)|0)*48|0)+40>>2]&f|0)==(e|0)){E=(p|0)<(z|0)?p:z;F=(p|0)>(v|0)?p:v;G=(D|0)<(w|0)?D:w;H=(D|0)>(x|0)?D:x}else{E=z;F=v;G=w;H=x}if((u|0)>=(B|0))break;else{v=F;w=G;x=H;z=E;A=B}}I=E;J=F;K=G;L=H;M=c[i>>2]|0;N=B}else{I=q;J=b;K=n;L=o;M=s;N=r}p=p+1|0;if((p|0)>=(M|0)){O=I;P=J;Q=K;R=L;S=M;T=N;break}else{b=J;n=K;o=L;q=I;r=N;s=M}}}else{O=j;P=-1;Q=l;R=-1;S=j;T=l}l=P-O|0;j=R-Q|0;if((l|0)>=(j|0))if((j|0)<(l|0)){M=l-j+R|0;U=M-Q|0;V=l;W=Q-((M|0)<(T|0)?0:M+1-T|0)|0;X=O}else{U=j;V=l;W=Q;X=O}else{T=j-l|0;M=(T|0)/2|0;R=T-(M<<1)|0;T=(((l|0)/2|0)+O|0)>((S|0)/2|0|0);l=O-M+(T?0-R|0:0)|0;O=M+P+(T?0:R)|0;R=l-((O|0)<(S|0)?0:1-S+O|0)|0;U=j;V=O-l|0;W=Q;X=(R|0)>0?R:0}R=a;c[R>>2]=X;c[R+4>>2]=W;W=a+8|0;c[W>>2]=V+1;c[W+4>>2]=U+1;Ea=g;return}function uc(a,b,d,e,f,g){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,z=0,A=0,B=0,C=0,D=0,E=0;h=Ea;Ea=Ea+48|0;if((Ea|0)>=(Fa|0))y(48);i=h;j=h+40|0;k=h+32|0;l=h+24|0;m=h+16|0;n=c[d>>2]|0;o=n+e|0;if((((n|0)>=0?o>>>0<=(c[a+236>>2]|0)>>>0:0)?(p=d+4|0,q=c[p>>2]|0,(q|0)>=0):0)?(q+e|0)>>>0<=(c[a+240>>2]|0)>>>0:0){if(!e){r=1;Ea=h;return r|0}q=e+-1|0;s=j+4|0;t=k+4|0;u=l+4|0;v=m+4|0;w=0;a:while(1){x=q-w|0;if(w>>>0<x>>>0){z=w;do{A=c[d>>2]|0;B=c[p>>2]|0;c[j>>2]=A+w;c[s>>2]=B+z;C=q+B|0;c[k>>2]=A+z;c[t>>2]=C-w;D=q+A|0;c[l>>2]=D-w;c[u>>2]=C;c[m>>2]=D-z;c[v>>2]=B+w;if(!(yc(a,b,j,k,f,g)|0)){E=18;break a}if(!(yc(a,b,k,l,f,g)|0)){E=17;break a}if(!(yc(a,b,l,m,f,g)|0)){E=16;break a}z=z+1|0;if(!(yc(a,b,m,j,f,g)|0)){r=0;E=19;break a}}while(z>>>0<x>>>0)}w=w+1|0;if(w>>>0>=e>>>0){r=1;E=19;break}}if((E|0)==16){r=0;Ea=h;return r|0}else if((E|0)==17){r=0;Ea=h;return r|0}else if((E|0)==18){r=0;Ea=h;return r|0}else if((E|0)==19){Ea=h;return r|0}}r=c[d+4>>2]|0;c[i>>2]=n;c[i+4>>2]=r;c[i+8>>2]=o;c[i+12>>2]=r+e;ae(5675,i)|0;Ea=h;return 0}function vc(a,b,d,e,f,g){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,u=0,v=0,w=0,x=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0;h=Ea;Ea=Ea+80|0;if((Ea|0)>=(Fa|0))y(80);i=h+64|0;j=h+56|0;k=h+48|0;l=h+24|0;m=h+8|0;n=h+40|0;o=h+32|0;p=h+16|0;q=h;r=e>>>1;if(!r){Ea=h;return}s=e+-1|0;e=d+4|0;u=a+236|0;v=a+240|0;w=a+4|0;x=0;z=s;while(1){if(x>>>0<(s-x|0)>>>0){A=x;do{B=c[d>>2]|0;C=B+x|0;D=c[e>>2]|0;E=D+A|0;F=B+A|0;G=s+D|0;H=G-x|0;I=s+B|0;B=I-x|0;J=G-A|0;G=I-A|0;I=D+x|0;if(((E|C|0)>-1?(D=c[u>>2]|0,(C|0)<(D|0)):0)?(K=c[v>>2]|0,(E|0)<(K|0)):0){if(K>>>0>E>>>0&D>>>0>C>>>0)L=K;else{c[m>>2]=E;c[m+4>>2]=C;ae(5646,m)|0;L=c[v>>2]|0}K=c[b>>2]|0;M=c[K+((E+1+(t(L,C)|0)+(c[K+((c[w>>2]|0)*48|0)+32>>2]|0)|0)*48|0)+40>>2]|0}else M=0;if(((H|F|0)>-1?(K=c[u>>2]|0,(F|0)<(K|0)):0)?(D=c[v>>2]|0,(H|0)<(D|0)):0){if(D>>>0>H>>>0&K>>>0>F>>>0)N=D;else{c[l>>2]=H;c[l+4>>2]=F;ae(5646,l)|0;N=c[v>>2]|0}D=c[b>>2]|0;O=c[D+((H+1+(t(N,F)|0)+(c[D+((c[w>>2]|0)*48|0)+32>>2]|0)|0)*48|0)+40>>2]|0}else O=0;if(((J|B|0)>-1?(D=c[u>>2]|0,(B|0)<(D|0)):0)?(K=c[v>>2]|0,(J|0)<(K|0)):0){if(K>>>0>J>>>0&D>>>0>B>>>0)P=K;else{c[k>>2]=J;c[k+4>>2]=B;ae(5646,k)|0;P=c[v>>2]|0}K=c[b>>2]|0;Q=c[K+((J+1+(t(P,B)|0)+(c[K+((c[w>>2]|0)*48|0)+32>>2]|0)|0)*48|0)+40>>2]|0}else Q=0;if(((G|I|0)>-1?(K=c[u>>2]|0,(G|0)<(K|0)):0)?(D=c[v>>2]|0,(I|0)<(D|0)):0){if(D>>>0>I>>>0&K>>>0>G>>>0)R=D;else{c[j>>2]=I;c[j+4>>2]=G;ae(5646,j)|0;R=c[v>>2]|0}D=c[b>>2]|0;S=c[D+((I+1+(t(R,G)|0)+(c[D+((c[w>>2]|0)*48|0)+32>>2]|0)|0)*48|0)+40>>2]|0}else S=0;D=n;c[D>>2]=C;c[D+4>>2]=E;c[i>>2]=c[n>>2];c[i+4>>2]=c[n+4>>2];zc(a,b,i,O,0,f,g);E=o;c[E>>2]=F;c[E+4>>2]=H;c[i>>2]=c[o>>2];c[i+4>>2]=c[o+4>>2];zc(a,b,i,Q,0,f,g);H=p;c[H>>2]=B;c[H+4>>2]=J;c[i>>2]=c[p>>2];c[i+4>>2]=c[p+4>>2];zc(a,b,i,S,0,f,g);J=q;c[J>>2]=G;c[J+4>>2]=I;c[i>>2]=c[q>>2];c[i+4>>2]=c[q+4>>2];zc(a,b,i,M,0,f,g);A=A+1|0}while((A|0)!=(z|0))}x=x+1|0;if((x|0)==(r|0))break;else z=z+-1|0}Ea=h;return}function wc(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,u=0,v=0,w=0,x=0,z=0,A=0,B=0,C=0,D=0,E=0;b=Ea;Ea=Ea+32|0;if((Ea|0)>=(Fa|0))y(32);d=b+16|0;e=b;f=b+24|0;g=a+56|0;h=c[(c[g>>2]|0)+240>>2]|0;if((h|0)<=0){i=0;jb(a,i);Ea=b;return}j=a+136|0;k=a+140|0;l=a+4|0;m=e+8|0;n=a+4|0;o=0;p=h;a:while(1){h=p+-1|0;q=c[j>>2]|0;r=c[k>>2]|0;if((q|0)<=(r|0)){s=q;q=1;u=r;while(1){v=c[g>>2]|0;w=v+240|0;x=c[w>>2]|0;if(x>>>0>h>>>0?(c[v+236>>2]|0)>>>0>s>>>0:0){z=x;A=u}else{c[d>>2]=h;c[d+4>>2]=s;ae(5646,d)|0;z=c[w>>2]|0;A=c[k>>2]|0}w=c[l>>2]|0;q=q&(c[w+(((t(z,s)|0)+p+(c[w+((c[v+4>>2]|0)*48|0)+32>>2]|0)|0)*48|0)+40>>2]&255|0)==2;if((s|0)>=(A|0))break;else{s=s+1|0;u=A}}if(q){B=A;C=11}else{D=o;E=h}}else{B=r;C=11}if((C|0)==11){C=0;u=o+1|0;s=c[j>>2]|0;if((s|0)<=(B|0)){v=s;while(1){s=c[g>>2]|0;w=c[n>>2]|0;x=(c[w+((c[s+4>>2]|0)*48|0)+32>>2]|0)+p+(t(c[s+240>>2]|0,v)|0)|0;c[w+(x*48|0)+40>>2]=0;c[e>>2]=x;c[f>>2]=0;x=c[s+264>>2]|0;if(!x){C=15;break a}Qa[c[(c[x>>2]|0)+24>>2]&15](x,n,e,f);if((v|0)<(c[k>>2]|0))v=v+1|0;else break}}v=c[g>>2]|0;r=c[v+236>>2]|0;h=e;c[h>>2]=0;c[h+4>>2]=0;h=m;c[h>>2]=r;c[h+4>>2]=p;Bc(v,n,2,e);D=u;E=p}if((E|0)>0){o=D;p=E}else{i=D;C=3;break}}if((C|0)==3){jb(a,i);Ea=b;return}else if((C|0)==15){C=$(4)|0;c[C>>2]=4208;da(C|0,3024,27)}}function xc(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;a=c[d>>2]|0;e=(c[d+4>>2]|0)-a|0;f=e+1|0;if(!e){g=a;return g|0}if(!f){a=b+2496|0;e=c[a>>2]|0;h=((e+1|0)>>>0)%624|0;i=b+(e<<2)|0;j=c[b+(h<<2)>>2]|0;k=0-(j&1)&-1727483681^c[b+((((e+397|0)>>>0)%624|0)<<2)>>2]^(j&2147483646|c[i>>2]&-2147483648)>>>1;c[i>>2]=k;i=k>>>11^k;c[a>>2]=h;h=i<<7&-1658038656^i;i=h<<15&-272236544^h;g=i>>>18^i;return g|0}i=32-(u(f|0)|0)|0;h=i+(((-1>>>(33-i|0)&f|0)==0)<<31>>31)|0;i=(h>>>5)+((h&31|0)!=0&1)|0;a=i>>>0>h>>>0?0:-1>>>(32-((h>>>0)/(i>>>0)|0)|0);i=b+2496|0;h=c[i>>2]|0;do{k=h;h=((h+1|0)>>>0)%624|0;j=b+(k<<2)|0;e=c[b+(h<<2)>>2]|0;l=0-(e&1)&-1727483681^c[b+((((k+397|0)>>>0)%624|0)<<2)>>2]^(e&2147483646|c[j>>2]&-2147483648)>>>1;c[j>>2]=l;j=l>>>11^l;l=j<<7&-1658038656^j;j=l<<15&-272236544^l;m=(j>>>18^j)&a}while(m>>>0>=f>>>0);c[i>>2]=h;g=(c[d>>2]|0)+m|0;return g|0}function yc(a,b,d,e,f,g){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,u=0,v=0,w=0,x=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0;h=Ea;Ea=Ea+32|0;if((Ea|0)>=(Fa|0))y(32);i=h+24|0;j=h+16|0;k=h+8|0;l=h;m=c[d>>2]|0;if(((m|0)>-1?(n=c[d+4>>2]|0,(n|0)>-1):0)?(m|0)<(c[a+236>>2]|0):0)o=(n|0)<(c[a+240>>2]|0);else o=0;n=c[e>>2]|0;if(((n|0)>-1?(p=c[e+4>>2]|0,(p|0)>-1):0)?(n|0)<(c[a+236>>2]|0):0)q=(p|0)<(c[a+240>>2]|0);else q=0;if(!(o|q)){r=1;Ea=h;return r|0}if(!(q|o^1)){p=c[d+4>>2]|0;s=a+240|0;u=c[s>>2]|0;if(u>>>0>p>>>0?(c[a+236>>2]|0)>>>0>m>>>0:0)v=u;else{c[l>>2]=p;c[l+4>>2]=m;ae(5646,l)|0;v=c[s>>2]|0}s=c[b>>2]|0;r=(c[s+((p+1+(t(v,m)|0)+(c[s+((c[a+4>>2]|0)*48|0)+32>>2]|0)|0)*48|0)+40>>2]&g|0)==0;Ea=h;return r|0}if(!(o|q^1)){q=c[e+4>>2]|0;o=a+240|0;s=c[o>>2]|0;if(s>>>0>q>>>0?(c[a+236>>2]|0)>>>0>n>>>0:0)w=s;else{c[k>>2]=q;c[k+4>>2]=n;ae(5646,k)|0;w=c[o>>2]|0}o=c[b>>2]|0;r=(c[o+((q+1+(t(w,n)|0)+(c[o+((c[a+4>>2]|0)*48|0)+32>>2]|0)|0)*48|0)+40>>2]&g|0)==0;Ea=h;return r|0}o=c[d+4>>2]|0;d=a+240|0;w=c[d>>2]|0;if(w>>>0>o>>>0?(c[a+236>>2]|0)>>>0>m>>>0:0){x=n;z=w}else{c[j>>2]=o;c[j+4>>2]=m;ae(5646,j)|0;x=c[e>>2]|0;z=c[d>>2]|0}j=a+4|0;w=c[b>>2]|0;n=c[w+((c[j>>2]|0)*48|0)+32>>2]|0;q=c[w+((o+1+(t(z,m)|0)+n|0)*48|0)+40>>2]&g;m=c[e+4>>2]|0;if(z>>>0>m>>>0?(c[a+236>>2]|0)>>>0>x>>>0:0){A=z;B=n;C=w}else{c[i>>2]=m;c[i+4>>2]=x;ae(5646,i)|0;i=c[b>>2]|0;A=c[d>>2]|0;B=c[i+((c[j>>2]|0)*48|0)+32>>2]|0;C=i}i=c[C+((m+1+(t(A,x)|0)+B|0)*48|0)+40>>2]&g;g=(q|0)==(f|0);if(!g){D=(i|0)!=(f|0);E=(q|0)==0;F=g|E;G=F|D;Ea=h;return G|0}if((i|0)!=(f|0)&(i|0)!=0){r=0;Ea=h;return r|0}else{D=(i|0)!=(f|0);E=(q|0)==0;F=g|E;G=F|D;Ea=h;return G|0}return 0}function zc(a,b,d,e,f,g,h){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;h=h|0;var i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0;i=Ea;Ea=Ea+16|0;if((Ea|0)>=(Fa|0))y(16);j=i;k=i+12|0;l=i+8|0;if((f|0)<0){Ea=i;return}f=c[d>>2]|0;if((f|0)<=-1){Ea=i;return}m=c[d+4>>2]|0;if((m|0)<=-1){Ea=i;return}d=c[a+236>>2]|0;if((f|0)>=(d|0)){Ea=i;return}n=a+240|0;o=c[n>>2]|0;if((m|0)>=(o|0)){Ea=i;return}p=e&h;if(o>>>0>m>>>0&d>>>0>f>>>0)q=o;else{c[j>>2]=m;c[j+4>>2]=f;ae(5646,j)|0;q=c[n>>2]|0}n=c[b>>2]|0;j=m+1+(c[n+((c[a+4>>2]|0)*48|0)+32>>2]|0)+(t(q,f)|0)|0;f=n+(j*48|0)+40|0;n=c[f>>2]&h;if((n|0)!=(g|0)&(n|0)!=0){Ea=i;return}if((p|0)!=(g|0)&(p|0)!=0){Ea=i;return}c[f>>2]=e;c[k>>2]=j;c[l>>2]=e;e=c[a+264>>2]|0;if(!e){a=$(4)|0;c[a>>2]=4208;da(a|0,3024,27)}Qa[c[(c[e>>2]|0)+24>>2]&15](e,b,k,l);Ea=i;return}function Ac(b,d,e){b=b|0;d=d|0;e=e|0;var g=0,h=0,i=0,j=0,k=0,l=0;g=b+4|0;h=c[d>>2]|0;i=(c[h+((c[g>>2]|0)*48|0)+32>>2]|0)+1|0;if((c[h+(i*48|0)+44>>2]|0)==7){if(!(ic(8036,e)|0)){j=c[2007]|0;k=(j-(c[2006]|0)|0)/12|0;l=j;if((c[2008]|0)==(l|0))jc(8024,e);else{ve(l,e);c[2007]=(c[2007]|0)+12}c[(hc(8036,e)|0)>>2]=k}c[h+(i*48|0)+36>>2]=c[(hc(8036,e)|0)>>2];f[h+(i*48|0)+16>>2]=+R(((a[e+11>>0]|0)<0?c[e>>2]|0:e)|0,+(+f[h+(i*48|0)+20>>2]))}if((c[b+52>>2]|0)!=2)return;i=c[g>>2]|0;g=c[d>>2]|0;h=g+(((c[g+(i*48|0)+32>>2]|0)+1|0)*48|0)+16|0;e=c[h+4>>2]|0;k=g+(i*48|0)+24|0;c[k>>2]=c[h>>2];c[k+4>>2]=e;Qa[c[(c[b>>2]|0)+8>>2]&15](b,d,b+40|0,b+32|0);return}function Bc(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,u=0,v=0,w=0,x=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0;f=Ea;Ea=Ea+32|0;if((Ea|0)>=(Fa|0))y(32);g=f+16|0;h=f+8|0;i=f;j=f+28|0;k=f+24|0;l=e+4|0;m=c[e+12>>2]|0;if((m|0)<=0){Ea=f;return}n=e+8|0;o=a+240|0;p=a+236|0;q=a+4|0;r=a+264|0;a=m+(c[l>>2]|0)|0;m=c[n>>2]|0;s=c[e>>2]|0;a:while(1){u=a;a=a+-1|0;b:do if((m|0)>0){v=u+-2|0;if((u|0)<=1){w=s;while(1){x=c[o>>2]|0;if(x>>>0>a>>>0?(c[p>>2]|0)>>>0>w>>>0:0)z=x;else{c[g>>2]=a;c[g+4>>2]=w;ae(5646,g)|0;z=c[o>>2]|0}x=c[b>>2]|0;A=c[x+((c[q>>2]|0)*48|0)+32>>2]|0;B=t(z,w)|0;C=c[x+((B+u+A|0)*48|0)+40>>2]&255;if((C|0)==(d|0)|(C|d|0)==0){C=A+u+B|0;c[x+(C*48|0)+40>>2]=0;c[j>>2]=C;c[k>>2]=0;C=c[r>>2]|0;if(!C){D=25;break a}Qa[c[(c[C>>2]|0)+24>>2]&15](C,b,j,k)}w=w+1|0;C=c[e>>2]|0;x=c[n>>2]|0;if((w|0)>=(x+C|0)){E=C;F=x;break b}}}w=s;while(1){x=c[o>>2]|0;if(x>>>0>a>>>0?(c[p>>2]|0)>>>0>w>>>0:0)G=x;else{c[i>>2]=a;c[i+4>>2]=w;ae(5646,i)|0;G=c[o>>2]|0}x=c[b>>2]|0;C=c[x+((c[q>>2]|0)*48|0)+32>>2]|0;B=t(G,w)|0;A=c[x+((B+u+C|0)*48|0)+40>>2]|0;if(G>>>0>v>>>0?(c[p>>2]|0)>>>0>w>>>0:0){H=B;I=C;J=x}else{c[h>>2]=v;c[h+4>>2]=w;ae(5646,h)|0;x=c[b>>2]|0;H=t(c[o>>2]|0,w)|0;I=c[x+((c[q>>2]|0)*48|0)+32>>2]|0;J=x}x=c[J+((a+H+I|0)*48|0)+40>>2]|0;C=A&255;A=x&255;B=(C|0)==(d|0);K=(A|0)==(d|0)|B^1;L=K?x:0;x=K?A:0;if(!(!(B&(x|0)==0)?!(((C|0)==0|B)&(x|0)==(d|0)):0)){x=I+u+H|0;c[J+(x*48|0)+40>>2]=L;c[j>>2]=x;c[k>>2]=L;L=c[r>>2]|0;if(!L){D=25;break a}Qa[c[(c[L>>2]|0)+24>>2]&15](L,b,j,k)}w=w+1|0;L=c[e>>2]|0;x=c[n>>2]|0;if((w|0)>=(x+L|0)){E=L;F=x;break}}}else{E=s;F=m}while(0);if((a|0)<=(c[l>>2]|0)){D=3;break}else{m=F;s=E}}if((D|0)==3){Ea=f;return}else if((D|0)==25){D=$(4)|0;c[D>>2]=4208;da(D|0,3024,27)}}function Cc(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,u=0,v=0,w=0,x=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0;f=Ea;Ea=Ea+32|0;if((Ea|0)>=(Fa|0))y(32);g=f+24|0;h=f+16|0;i=f+8|0;j=f;k=a+236|0;if((c[k>>2]|0)<=0){l=1;Ea=f;return l|0}m=a+240|0;n=a+4|0;a=0;o=c[m>>2]|0;a:while(1){p=o+-1|0;q=a;a=a+1|0;b:do if((o|0)>0){if(q|0){r=o;s=p;u=o;while(1){if(u>>>0>s>>>0?(v=c[k>>2]|0,v>>>0>q>>>0):0){w=u;x=v}else{c[h>>2]=s;c[h+4>>2]=q;ae(5646,h)|0;w=c[m>>2]|0;x=c[k>>2]|0}v=c[b>>2]|0;z=c[v+((c[n>>2]|0)*48|0)+32>>2]|0;A=c[v+(((t(w,q)|0)+r+z|0)*48|0)+40>>2]&e;if((q|0)<(x+-1|0)){if(x>>>0>a>>>0&w>>>0>s>>>0){B=w;C=z;D=v}else{c[g>>2]=s;c[g+4>>2]=a;ae(5646,g)|0;v=c[b>>2]|0;B=c[m>>2]|0;C=c[v+((c[n>>2]|0)*48|0)+32>>2]|0;D=v}E=c[D+(((t(B,a)|0)+r+C|0)*48|0)+40>>2]&e;F=B}else{E=0;F=w}if((E|0)==(d|0)?(A|0)!=(d|0)&(A|0)!=0:0){l=0;G=29;break a}if((s|0)>0){A=s;s=s+-1|0;u=F;r=A}else{H=F;break b}}}r=o;u=p;s=o;while(1){if(s>>>0>u>>>0?(A=c[k>>2]|0,(A|0)!=0):0){I=A;J=s}else{c[j>>2]=u;c[j+4>>2]=0;ae(5646,j)|0;I=c[k>>2]|0;J=c[m>>2]|0}A=c[b>>2]|0;v=c[A+((c[n>>2]|0)*48|0)+32>>2]|0;z=c[A+((r+v|0)*48|0)+40>>2]&e;if((I|0)>1){if(I>>>0>a>>>0&J>>>0>u>>>0){K=J;L=v;M=A}else{c[i>>2]=u;c[i+4>>2]=a;ae(5646,i)|0;A=c[b>>2]|0;K=c[m>>2]|0;L=c[A+((c[n>>2]|0)*48|0)+32>>2]|0;M=A}N=c[M+(((t(K,a)|0)+r+L|0)*48|0)+40>>2]&e;O=K}else{N=0;O=J}if((N|0)==(d|0)){if((z|0)!=0|(z|0)==(d|0)){l=0;G=29;break a}}else if((z|0)==(d|0)){l=0;G=29;break a}if((u|0)>0){z=u;u=u+-1|0;s=O;r=z}else{H=O;break}}}else H=o;while(0);if((a|0)>=(c[k>>2]|0)){l=1;G=29;break}else o=H}if((G|0)==29){Ea=f;return l|0}return 0}function Dc(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,u=0,v=0,w=0,x=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0;f=Ea;Ea=Ea+32|0;if((Ea|0)>=(Fa|0))y(32);g=f+16|0;h=f+8|0;i=f;j=a+236|0;k=c[j>>2]|0;if((k|0)<=0){l=1;Ea=f;return l|0}m=a+240|0;n=a+4|0;a=(d|0)!=0;o=k;p=c[m>>2]|0;q=k;a:while(1){k=o;o=o+-1|0;r=p+-1|0;b:do if((p|0)>0){s=k+-2|0;if((k|0)<=1){u=p;v=r;w=p;x=q;while(1){if(w>>>0>v>>>0&x>>>0>o>>>0)z=w;else{c[g>>2]=v;c[g+4>>2]=o;ae(5646,g)|0;z=c[m>>2]|0}A=c[b>>2]|0;B=c[A+(((t(z,o)|0)+u+(c[A+((c[n>>2]|0)*48|0)+32>>2]|0)|0)*48|0)+40>>2]&e;if(!(a|(B|0)==0)){l=0;C=22;break a}A=c[j>>2]|0;if((B|0)==(d|0)&(k|0)==(A|0)){l=0;C=22;break a}if((v|0)>0){B=v;v=v+-1|0;w=z;x=A;u=B}else{D=A;E=z;break b}}}u=p;x=r;w=p;v=q;while(1){if(w>>>0>x>>>0&v>>>0>o>>>0)F=w;else{c[i>>2]=x;c[i+4>>2]=o;ae(5646,i)|0;F=c[m>>2]|0}A=c[b>>2]|0;B=c[A+((c[n>>2]|0)*48|0)+32>>2]|0;G=c[A+(((t(F,o)|0)+u+B|0)*48|0)+40>>2]&e;if(F>>>0>x>>>0?(c[j>>2]|0)>>>0>s>>>0:0){H=F;I=B;J=A}else{c[h>>2]=x;c[h+4>>2]=s;ae(5646,h)|0;A=c[b>>2]|0;H=c[m>>2]|0;I=c[A+((c[n>>2]|0)*48|0)+32>>2]|0;J=A}if((c[J+(((t(H,s)|0)+u+I|0)*48|0)+40>>2]&e|0)==(d|0)?(G|0)!=(d|0)&(G|0)!=0:0){l=0;C=22;break a}A=c[j>>2]|0;if((G|0)==(d|0)&(k|0)==(A|0)){l=0;C=22;break a}if((x|0)>0){G=x;x=x+-1|0;w=H;v=A;u=G}else{D=A;E=H;break}}}else{D=q;E=p}while(0);if((k|0)<=1){l=1;C=22;break}else{p=E;q=D}}if((C|0)==22){Ea=f;return l|0}return 0}function Ec(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,u=0,v=0,w=0,x=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0;e=Ea;Ea=Ea+32|0;if((Ea|0)>=(Fa|0))y(32);f=e+8|0;g=e;h=e+20|0;i=e+16|0;j=a+236|0;k=c[j>>2]|0;if((k|0)<=0){Ea=e;return}l=a+240|0;m=a+4|0;n=a+264|0;a=0;o=k;a:while(1){k=c[l>>2]|0;p=a;a=a+1|0;if((k|0)>0){q=k;r=k;while(1){k=q+-1|0;if(r>>>0>k>>>0?(s=c[j>>2]|0,s>>>0>p>>>0):0){u=r;v=s}else{c[g>>2]=k;c[g+4>>2]=p;ae(5646,g)|0;u=c[l>>2]|0;v=c[j>>2]|0}s=c[b>>2]|0;w=c[s+((c[m>>2]|0)*48|0)+32>>2]|0;x=c[s+(((t(u,p)|0)+q+w|0)*48|0)+40>>2]|0;if((p|0)<(v+-1|0)){if(v>>>0>a>>>0&u>>>0>k>>>0){z=u;A=w;B=s}else{c[f>>2]=k;c[f+4>>2]=a;ae(5646,f)|0;C=c[b>>2]|0;z=c[l>>2]|0;A=c[C+((c[m>>2]|0)*48|0)+32>>2]|0;B=C}D=c[B+(((t(z,a)|0)+q+A|0)*48|0)+40>>2]|0;E=z;F=A;G=B}else{D=0;E=u;F=w;G=s}s=x&255;x=D&255;w=(s|0)==(d|0);C=(x|0)!=(d|0)&(x|0)!=0;H=C?0:D;I=C?0:x;if(w)if(!I){J=H;K=18}else{L=H;M=I;K=17}else{L=D;M=x;K=17}if((K|0)==17?(K=0,((s|0)==0|w)&(M|0)==(d|0)):0){J=L;K=18}if((K|0)==18){K=0;w=F+q+(t(E,p)|0)|0;c[G+(w*48|0)+40>>2]=J;c[h>>2]=w;c[i>>2]=J;w=c[n>>2]|0;if(!w){K=19;break a}Qa[c[(c[w>>2]|0)+24>>2]&15](w,b,h,i)}if((q|0)<=1)break;q=k;r=c[l>>2]|0}N=c[j>>2]|0}else N=o;if((a|0)>=(N|0)){K=3;break}else o=N}if((K|0)==3){Ea=e;return}else if((K|0)==19){K=$(4)|0;c[K>>2]=4208;da(K|0,3024,27)}}function Fc(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,u=0,v=0,w=0,x=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0;e=Ea;Ea=Ea+32|0;if((Ea|0)>=(Fa|0))y(32);f=e+16|0;g=e+8|0;h=e;i=e+28|0;j=e+24|0;k=a+236|0;l=c[k>>2]|0;if((l|0)<=0){Ea=e;return}m=a+240|0;n=a+4|0;o=a+264|0;a=(d|0)==0;p=l;a:while(1){l=p;p=p+-1|0;q=c[m>>2]|0;r=q+-1|0;b:do if((q|0)>0){s=l+-2|0;if((l|0)<=1){u=q;v=r;w=q;while(1){if(w>>>0>v>>>0?(c[k>>2]|0)>>>0>p>>>0:0)x=w;else{c[f>>2]=v;c[f+4>>2]=p;ae(5646,f)|0;x=c[m>>2]|0}z=c[b>>2]|0;A=c[z+((c[n>>2]|0)*48|0)+32>>2]|0;B=t(x,p)|0;C=c[z+((B+u+A|0)*48|0)+40>>2]&255;D=(C|0)==(d|0);if(!(!D?!(((C|0)==0|D)&a):0)){D=A+u+B|0;c[z+(D*48|0)+40>>2]=0;c[i>>2]=D;c[j>>2]=0;D=c[o>>2]|0;if(!D){E=28;break a}Qa[c[(c[D>>2]|0)+24>>2]&15](D,b,i,j)}if((v|0)<=0)break b;D=v;v=v+-1|0;w=c[m>>2]|0;u=D}}u=q;w=r;v=q;while(1){if(v>>>0>w>>>0?(c[k>>2]|0)>>>0>p>>>0:0)F=v;else{c[h>>2]=w;c[h+4>>2]=p;ae(5646,h)|0;F=c[m>>2]|0}D=c[b>>2]|0;z=c[D+((c[n>>2]|0)*48|0)+32>>2]|0;B=c[D+(((t(F,p)|0)+u+z|0)*48|0)+40>>2]|0;if(F>>>0>w>>>0?(c[k>>2]|0)>>>0>s>>>0:0){G=F;H=z;I=D}else{c[g>>2]=w;c[g+4>>2]=s;ae(5646,g)|0;D=c[b>>2]|0;G=c[m>>2]|0;H=c[D+((c[n>>2]|0)*48|0)+32>>2]|0;I=D}D=c[I+(((t(G,s)|0)+u+H|0)*48|0)+40>>2]|0;z=B&255;B=D&255;A=(z|0)==(d|0);C=(B|0)!=(d|0)&(B|0)!=0;J=C?0:D;K=C?0:B;if(A)if(!K){L=J;E=17}else{M=J;N=K;E=16}else{M=D;N=B;E=16}if((E|0)==16?(E=0,((z|0)==0|A)&(N|0)==(d|0)):0){L=M;E=17}if((E|0)==17){E=0;A=H+u+(t(G,p)|0)|0;c[I+(A*48|0)+40>>2]=L;c[i>>2]=A;c[j>>2]=L;A=c[o>>2]|0;if(!A){E=28;break a}Qa[c[(c[A>>2]|0)+24>>2]&15](A,b,i,j)}if((w|0)<=0)break b;A=w;w=w+-1|0;v=c[m>>2]|0;u=A}}while(0);if((l|0)<=1){E=3;break}}if((E|0)==3){Ea=e;return}else if((E|0)==28){E=$(4)|0;c[E>>2]=4208;da(E|0,3024,27)}}function Gc(a,b){a=a|0;b=b|0;return}function Hc(a){a=a|0;ke(a);ne(a);return}function Ic(a){a=a|0;var b=0;b=c[a+12>>2]|0;if(!b)return;Lc(b);ne(b);return}function Jc(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==5792?a+12|0:0)|0}function Kc(a){a=a|0;ne(a);return}function Lc(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;c[a>>2]=3224;b=a+100|0;d=c[b>>2]|0;if(d|0){e=a+104|0;f=c[e>>2]|0;if((f|0)==(d|0))g=d;else{h=f;do{f=h;h=h+-12|0;i=c[h>>2]|0;if(i|0){j=f+-8|0;f=c[j>>2]|0;if((f|0)==(i|0))k=i;else{l=f;do{f=l;l=l+-12|0;m=c[l>>2]|0;if(m|0){c[f+-8>>2]=m;ne(m)}}while((l|0)!=(i|0));k=c[h>>2]|0}c[j>>2]=i;ne(k)}}while((h|0)!=(d|0));g=c[b>>2]|0}c[e>>2]=d;ne(g)}g=c[a+96>>2]|0;if(g|0?(d=g+4|0,e=c[d>>2]|0,c[d>>2]=e+-1,(e|0)==0):0){La[c[(c[g>>2]|0)+8>>2]&63](g);le(g)}g=c[a+88>>2]|0;if(g|0?(e=g+4|0,d=c[e>>2]|0,c[e>>2]=d+-1,(d|0)==0):0){La[c[(c[g>>2]|0)+8>>2]&63](g);le(g)}g=c[a+80>>2]|0;if(g|0?(d=g+4|0,e=c[d>>2]|0,c[d>>2]=e+-1,(e|0)==0):0){La[c[(c[g>>2]|0)+8>>2]&63](g);le(g)}g=c[a+60>>2]|0;if(g|0?(e=g+4|0,d=c[e>>2]|0,c[e>>2]=d+-1,(d|0)==0):0){La[c[(c[g>>2]|0)+8>>2]&63](g);le(g)}c[a>>2]=3244;g=c[a+20>>2]|0;if(g|0?(d=g+4|0,e=c[d>>2]|0,c[d>>2]=e+-1,(e|0)==0):0){La[c[(c[g>>2]|0)+8>>2]&63](g);le(g)}g=c[a+4>>2]|0;if(!g)return;c[a+8>>2]=g;ne(g);return}function Mc(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0;d=Ea;Ea=Ea+16|0;if((Ea|0)>=(Fa|0))y(16);e=d;if((b|0)==(a|0)){Ea=d;return}f=a+16|0;g=c[f>>2]|0;h=g;i=b+16|0;if((g|0)==(a|0))if((c[i>>2]|0)==(b|0)){Na[c[(c[g>>2]|0)+12>>2]&7](g,e);j=c[f>>2]|0;La[c[(c[j>>2]|0)+16>>2]&63](j);c[f>>2]=0;j=c[i>>2]|0;Na[c[(c[j>>2]|0)+12>>2]&7](j,a);j=c[i>>2]|0;La[c[(c[j>>2]|0)+16>>2]&63](j);c[i>>2]=0;c[f>>2]=a;Na[c[(c[e>>2]|0)+12>>2]&7](e,b);La[c[(c[e>>2]|0)+16>>2]&63](e);c[i>>2]=b;Ea=d;return}else{Na[c[(c[g>>2]|0)+12>>2]&7](g,b);g=c[f>>2]|0;La[c[(c[g>>2]|0)+16>>2]&63](g);g=b+16|0;c[f>>2]=c[g>>2];c[g>>2]=b;Ea=d;return}else{g=c[i>>2]|0;if((b|0)==(g|0)){Na[c[(c[g>>2]|0)+12>>2]&7](g,a);b=c[i>>2]|0;La[c[(c[b>>2]|0)+16>>2]&63](b);c[i>>2]=c[f>>2];c[f>>2]=a;Ea=d;return}else{c[f>>2]=g;c[i>>2]=h;Ea=d;return}}}function Nc(a){a=a|0;ne(a);return}function Oc(a){a=a|0;var b=0,d=0;b=me(28)|0;d=a+4|0;c[b>>2]=3536;a=b+4|0;c[a>>2]=c[d>>2];c[a+4>>2]=c[d+4>>2];c[a+8>>2]=c[d+8>>2];c[a+12>>2]=c[d+12>>2];c[a+16>>2]=c[d+16>>2];c[a+20>>2]=c[d+20>>2];return b|0}function Pc(a,b){a=a|0;b=b|0;var d=0;d=a+4|0;c[b>>2]=3536;a=b+4|0;c[a>>2]=c[d>>2];c[a+4>>2]=c[d+4>>2];c[a+8>>2]=c[d+8>>2];c[a+12>>2]=c[d+12>>2];c[a+16>>2]=c[d+16>>2];c[a+20>>2]=c[d+20>>2];return}function Qc(a){a=a|0;return}function Rc(a){a=a|0;ne(a);return}function Sc(a){a=a|0;var b=0,d=0,e=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0;b=Ea;Ea=Ea+16|0;if((Ea|0)>=(Fa|0))y(16);d=b;e=P()|0;g=a+4|0;if((e|0)==(c[c[g>>2]>>2]|0)){h=a+8|0;i=c[h>>2]|0;Wc(i);Ea=b;return}c[d>>2]=e;ae(5929,d)|0;c[c[g>>2]>>2]=e;switch(e|0){case 0:{e=c[a+8>>2]|0;g=c[a+12>>2]|0;j=c[g>>2]|0;k=c[g+4>>2]|0;g=(k|0)==0;if(!g){l=k+4|0;c[l>>2]=(c[l>>2]|0)+1;c[l>>2]=(c[l>>2]|0)+1}l=e+32|0;c[l>>2]=j;j=e+36|0;m=c[j>>2]|0;c[j>>2]=k;if(m|0?(j=m+4|0,n=c[j>>2]|0,c[j>>2]=n+-1,(n|0)==0):0){La[c[(c[m>>2]|0)+8>>2]&63](m);le(m)}m=c[l>>2]|0;l=e+24|0;e=l;n=c[e+4>>2]|0;j=m+24|0;c[j>>2]=c[e>>2];c[j+4>>2]=n;n=c[m+16>>2]|0;if(n|0){j=c[(c[n>>2]|0)+8>>2]|0;f[d>>2]=0.0;f[d+4>>2]=0.0;Qa[j&15](n,m+4|0,d,l)}if(g){h=a+8|0;i=c[h>>2]|0;Wc(i);Ea=b;return}g=k+4|0;l=c[g>>2]|0;c[g>>2]=l+-1;if(l|0){h=a+8|0;i=c[h>>2]|0;Wc(i);Ea=b;return}La[c[(c[k>>2]|0)+8>>2]&63](k);le(k);h=a+8|0;i=c[h>>2]|0;Wc(i);Ea=b;return}case 1:{k=c[a+8>>2]|0;l=c[a+16>>2]|0;g=c[l>>2]|0;m=c[l+4>>2]|0;l=(m|0)==0;if(!l){n=m+4|0;c[n>>2]=(c[n>>2]|0)+1;c[n>>2]=(c[n>>2]|0)+1}n=k+32|0;c[n>>2]=g;g=k+36|0;j=c[g>>2]|0;c[g>>2]=m;if(j|0?(g=j+4|0,e=c[g>>2]|0,c[g>>2]=e+-1,(e|0)==0):0){La[c[(c[j>>2]|0)+8>>2]&63](j);le(j)}j=c[n>>2]|0;n=k+24|0;k=n;e=c[k+4>>2]|0;g=j+24|0;c[g>>2]=c[k>>2];c[g+4>>2]=e;e=c[j+16>>2]|0;if(e|0){g=c[(c[e>>2]|0)+8>>2]|0;f[d>>2]=0.0;f[d+4>>2]=0.0;Qa[g&15](e,j+4|0,d,n)}if(l){h=a+8|0;i=c[h>>2]|0;Wc(i);Ea=b;return}l=m+4|0;n=c[l>>2]|0;c[l>>2]=n+-1;if(n|0){h=a+8|0;i=c[h>>2]|0;Wc(i);Ea=b;return}La[c[(c[m>>2]|0)+8>>2]&63](m);le(m);h=a+8|0;i=c[h>>2]|0;Wc(i);Ea=b;return}case 2:{m=c[a+8>>2]|0;n=c[a+20>>2]|0;l=c[n>>2]|0;j=c[n+4>>2]|0;n=(j|0)==0;if(!n){e=j+4|0;c[e>>2]=(c[e>>2]|0)+1;c[e>>2]=(c[e>>2]|0)+1}e=m+32|0;c[e>>2]=l;l=m+36|0;g=c[l>>2]|0;c[l>>2]=j;if(g|0?(l=g+4|0,k=c[l>>2]|0,c[l>>2]=k+-1,(k|0)==0):0){La[c[(c[g>>2]|0)+8>>2]&63](g);le(g)}g=c[e>>2]|0;e=m+24|0;m=e;k=c[m+4>>2]|0;l=g+24|0;c[l>>2]=c[m>>2];c[l+4>>2]=k;k=c[g+16>>2]|0;if(k|0){l=c[(c[k>>2]|0)+8>>2]|0;f[d>>2]=0.0;f[d+4>>2]=0.0;Qa[l&15](k,g+4|0,d,e)}if(n){h=a+8|0;i=c[h>>2]|0;Wc(i);Ea=b;return}n=j+4|0;e=c[n>>2]|0;c[n>>2]=e+-1;if(e|0){h=a+8|0;i=c[h>>2]|0;Wc(i);Ea=b;return}La[c[(c[j>>2]|0)+8>>2]&63](j);le(j);h=a+8|0;i=c[h>>2]|0;Wc(i);Ea=b;return}case 3:{j=c[a+8>>2]|0;e=c[a+24>>2]|0;n=c[e>>2]|0;g=c[e+4>>2]|0;e=(g|0)==0;if(!e){k=g+4|0;c[k>>2]=(c[k>>2]|0)+1;c[k>>2]=(c[k>>2]|0)+1}k=j+32|0;c[k>>2]=n;n=j+36|0;l=c[n>>2]|0;c[n>>2]=g;if(l|0?(n=l+4|0,m=c[n>>2]|0,c[n>>2]=m+-1,(m|0)==0):0){La[c[(c[l>>2]|0)+8>>2]&63](l);le(l)}l=c[k>>2]|0;k=j+24|0;j=k;m=c[j+4>>2]|0;n=l+24|0;c[n>>2]=c[j>>2];c[n+4>>2]=m;m=c[l+16>>2]|0;if(m|0){n=c[(c[m>>2]|0)+8>>2]|0;f[d>>2]=0.0;f[d+4>>2]=0.0;Qa[n&15](m,l+4|0,d,k)}if(e){h=a+8|0;i=c[h>>2]|0;Wc(i);Ea=b;return}e=g+4|0;k=c[e>>2]|0;c[e>>2]=k+-1;if(k|0){h=a+8|0;i=c[h>>2]|0;Wc(i);Ea=b;return}La[c[(c[g>>2]|0)+8>>2]&63](g);le(g);h=a+8|0;i=c[h>>2]|0;Wc(i);Ea=b;return}default:{h=a+8|0;i=c[h>>2]|0;Wc(i);Ea=b;return}}}function Tc(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==6050?a+4|0:0)|0}function Uc(a){a=a|0;return 3016}function Vc(a){a=a|0;return}function Wc(a){a=a|0;var b=0,d=0,e=0,h=0.0,i=0.0,j=0.0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0;b=Ea;Ea=Ea+16|0;if((Ea|0)>=(Fa|0))y(16);d=b;e=a+12|0;c[e>>2]=(c[e>>2]|0)+1;h=+sa();L();i=+ya();j=+xa();k=a+24|0;l=a+28|0;if(i==+f[k>>2]?j==+f[l>>2]:0)m=a+32|0;else{g[d>>3]=i;g[d+8>>3]=j;ae(5943,d)|0;f[k>>2]=i;f[l>>2]=j;l=a+32|0;n=c[l>>2]|0;o=k;p=c[o+4>>2]|0;q=n+24|0;c[q>>2]=c[o>>2];c[q+4>>2]=p;p=c[n+16>>2]|0;if(!p)m=l;else{q=c[(c[p>>2]|0)+8>>2]|0;f[d>>2]=0.0;f[d+4>>2]=0.0;Qa[q&15](p,n+4|0,d,k);m=l}}Xc(a);l=c[m>>2]|0;m=a+16|0;j=h-+g[m>>3];Ma[c[c[l>>2]>>2]&3](l,j,a);k=c[l+16>>2]|0;if(!k){r=c[e>>2]|0;Yc(a,h,r,0);g[m>>3]=h;Ea=b;return}ad(k,l+4|0,j);r=c[e>>2]|0;Yc(a,h,r,0);g[m>>3]=h;Ea=b;return}function Xc(a){a=a|0;var b=0,e=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,z=0,A=0,B=0.0,C=0;b=Ea;Ea=Ea+96|0;if((Ea|0)>=(Fa|0))y(96);e=b+64|0;g=b+48|0;h=b;i=b+80|0;j=b+72|0;if(!(Y(h|0)|0)){Ea=b;return}k=h+16|0;l=a+32|0;m=h+20|0;n=h+24|0;o=i+4|0;p=h+28|0;q=h+32|0;r=j+4|0;s=h+17|0;t=h+20|0;u=i+4|0;v=i+4|0;w=h+8|0;a:while(1){switch(c[h>>2]|0){case 256:{x=4;break a;break}case 769:{z=c[k>>2]|0;A=(c[a>>2]|0)+(z>>>5<<2)|0;c[A>>2]=c[A>>2]&~(1<<(z&31));A=c[l>>2]|0;Na[c[(c[A>>2]|0)+4>>2]&7](A,z);break}case 768:{z=c[k>>2]|0;A=(c[a>>2]|0)+(z>>>5<<2)|0;c[A>>2]=c[A>>2]|1<<(z&31);A=c[l>>2]|0;Na[c[(c[A>>2]|0)+8>>2]&7](A,z);break}case 1024:{z=c[l>>2]|0;B=+(c[n>>2]|0);f[i>>2]=+(c[m>>2]|0);f[o>>2]=B;B=+(c[q>>2]|0);f[j>>2]=+(c[p>>2]|0);f[r>>2]=B;A=c[z+16>>2]|0;if(A|0)Zc(A,z+4|0,i,j)|0;break}case 1025:{z=d[s>>0]|0;A=c[t>>2]|0;C=c[n>>2]|0;c[g>>2]=d[k>>0];c[g+4>>2]=z;c[g+8>>2]=A;c[g+12>>2]=C;ae(5971,g)|0;C=c[l>>2]|0;B=+(c[n>>2]|0);f[i>>2]=+(c[t>>2]|0);f[u>>2]=B;A=c[C+16>>2]|0;if(A|0)_c(A,C+4|0,i)|0;break}case 1026:{C=c[l>>2]|0;B=+(c[n>>2]|0);f[i>>2]=+(c[t>>2]|0);f[v>>2]=B;A=c[C+16>>2]|0;if(A|0)$c(A,C+4|0,i)|0;break}case 512:{C=d[w>>0]|0;c[e>>2]=512;c[e+4>>2]=C;ae(5998,e)|0;break}default:{}}if(!(Y(h|0)|0)){x=18;break}}if((x|0)==4)lf();else if((x|0)==18){Ea=b;return}}
function Yc(b,d,e,g){b=b|0;d=+d;e=e|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,t=0.0,u=0.0,v=0,w=0,z=0,A=0,B=0;g=Ea;Ea=Ea+16|0;if((Ea|0)>=(Fa|0))y(16);e=g;h=c[b+32>>2]|0;b=h+4|0;c[e>>2]=0;i=e+4|0;c[i>>2]=0;j=e+8|0;c[j>>2]=0;k=h+8|0;h=(c[k>>2]|0)-(c[b>>2]|0)|0;l=(h|0)/48|0;if(h){if(l>>>0>89478485)Oe(e);m=me(h)|0;c[i>>2]=m;c[e>>2]=m;c[j>>2]=m+(l*48|0);l=c[b>>2]|0;b=(c[k>>2]|0)-l|0;if((b|0)>0){Qf(m|0,l|0,b|0)|0;l=m+(((b>>>0)/48|0)*48|0)|0;c[i>>2]=l;if((l|0)==(m|0)){n=m;o=i}else{l=0;b=m;k=0;do{j=b+(k*48|0)|0;switch(c[b+(k*48|0)+44>>2]|0){case 1:{if(!(c[b+(k*48|0)+40>>2]|0)){p=c[b+(k*48|0)+36>>2]|0;q=0}else{p=k;q=l}break}case 2:{d=+f[b+(k*48|0)+16>>2];t=+f[b+(k*48|0)+20>>2];M(+(+f[j>>2]+d),+(+f[b+(k*48|0)+4>>2]+t),+d,+t,c[b+(k*48|0)+32>>2]|0);p=k;q=l;break}case 3:{t=+f[b+(k*48|0)+16>>2];d=+f[b+(k*48|0)+20>>2];T(+(+f[j>>2]+t),+(+f[b+(k*48|0)+4>>2]+d),+t,+d,+(+f[b+(k*48|0)+24>>2]),c[b+(k*48|0)+32>>2]|0);p=k;q=l;break}case 4:{d=+r(+(+f[j>>2]))+0.0;t=+r(+(+f[b+(k*48|0)+4>>2]))+0.0;u=+s(+(+f[b+(k*48|0)+16>>2]))+0.0;N(+d,+t,+u,+(+s(+(+f[b+(k*48|0)+20>>2]))+0.0),c[b+(k*48|0)+36>>2]|0);p=k;q=l;break}case 5:{u=+r(+(+f[j>>2]))+0.0;t=+r(+(+f[b+(k*48|0)+4>>2]))+0.0;d=+s(+(+f[b+(k*48|0)+16>>2]))+0.0;U(+u,+t,+d,+(+s(+(+f[b+(k*48|0)+20>>2]))+0.0),+(+f[b+(k*48|0)+24>>2]),c[b+(k*48|0)+36>>2]|0);p=k;q=l;break}case 6:{S(+(+f[j>>2]),+(+f[b+(k*48|0)+4>>2]),+(+f[b+(k*48|0)+16>>2]),+(+f[b+(k*48|0)+20>>2]),+(+f[b+(k*48|0)+24>>2]),+(+f[b+(k*48|0)+28>>2]),c[b+(k*48|0)+32>>2]|0,c[b+(k*48|0)+36>>2]|0);p=k;q=l;break}case 7:{h=(c[2006]|0)+((c[b+(k*48|0)+36>>2]|0)*12|0)|0;if((a[h+11>>0]|0)<0)v=c[h>>2]|0;else v=h;d=+f[b+(k*48|0)+24>>2];O(v|0,+(+f[j>>2]),+(+f[b+(k*48|0)+4>>2]+d),+d,c[b+(k*48|0)+32>>2]|0);p=k;q=l;break}default:{p=k;q=l}}k=If(p|0,q|0,1,0)|0;l=x()|0;b=c[e>>2]|0}while((l|0)<0|((l|0)==0?k>>>0<(((c[i>>2]|0)-b|0)/48|0)>>>0:0));w=i;z=b;A=9}}else{B=m;A=5}}else{B=0;A=5}if((A|0)==5){w=i;z=B;A=9}if((A|0)==9)if(!z){Ea=g;return}else{n=z;o=w}c[o>>2]=n;ne(n);Ea=g;return}function Zc(b,d,e,g){b=b|0;d=d|0;e=e|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0.0,o=0,p=0,q=0,r=0;h=Ea;Ea=Ea+16|0;if((Ea|0)>=(Fa|0))y(16);i=h;j=b+4|0;if(!(c[(c[d>>2]|0)+((c[j>>2]|0)*48|0)+40>>2]|0)){k=0;Ea=h;return k|0}if(a[b+61>>0]|0){c[i>>2]=b;ae(6018,i)|0;l=c[j>>2]|0;m=c[d>>2]|0;n=+f[m+(l*48|0)+20>>2]+ +f[g+4>>2];f[i>>2]=+f[m+(l*48|0)+16>>2]+ +f[g>>2];f[i+4>>2]=n;o=c[b+80>>2]|0;if(!o){p=m;q=l}else{Na[c[(c[o>>2]|0)+24>>2]&7](o,i);p=c[d>>2]|0;q=c[j>>2]|0}j=i;i=c[j+4>>2]|0;o=p+(q*48|0)+16|0;c[o>>2]=c[j>>2];c[o+4>>2]=i;Qa[c[(c[b>>2]|0)+8>>2]&15](b,d,b+40|0,b+32|0)}i=b+224|0;o=c[i>>2]|0;j=(c[b+228>>2]|0)-o|0;if((j|0)<=0){k=0;Ea=h;return k|0}b=(j>>>3)+-1|0;j=o;while(1){o=c[j+(b<<3)>>2]|0;q=c[j+(b<<3)+4>>2]|0;p=(q|0)==0;if(!p){l=q+4|0;c[l>>2]=(c[l>>2]|0)+1}l=Zc(o,d,e,g)|0;if(!p?(p=q+4|0,o=c[p>>2]|0,c[p>>2]=o+-1,(o|0)==0):0){La[c[(c[q>>2]|0)+8>>2]&63](q);le(q)}if(l){k=1;r=16;break}l=b+-1|0;if((l|0)<=-1){k=0;r=16;break}b=l;j=c[i>>2]|0}if((r|0)==16){Ea=h;return k|0}return 0}function _c(b,d,e){b=b|0;d=d|0;e=e|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0.0,t=0.0,u=0.0;g=Ea;Ea=Ea+16|0;if((Ea|0)>=(Fa|0))y(16);h=g;if(!(c[(c[d>>2]|0)+((c[b+4>>2]|0)*48|0)+40>>2]|0)){i=0;Ea=g;return i|0}j=b+224|0;k=c[j>>2]|0;l=(c[b+228>>2]|0)-k|0;a:do if((l|0)>0){m=(l>>>3)+-1|0;n=k;while(1){o=c[n+(m<<3)>>2]|0;p=c[n+(m<<3)+4>>2]|0;q=(p|0)==0;if(!q){r=p+4|0;c[r>>2]=(c[r>>2]|0)+1}r=_c(o,d,e)|0;if(!q?(q=p+4|0,o=c[q>>2]|0,c[q>>2]=o+-1,(o|0)==0):0){La[c[(c[p>>2]|0)+8>>2]&63](p);le(p)}if(r){i=1;break}r=m+-1|0;if((r|0)<=-1)break a;m=r;n=c[j>>2]|0}Ea=g;return i|0}while(0);if((((a[b+136>>0]|0?(s=+f[e>>2],t=+f[e+4>>2],u=+f[b+16>>2],u<=s):0)?u+ +f[b+24>>2]>=s:0)?(s=+f[b+20>>2],s<=t):0)?s+ +f[b+28>>2]>=t:0){a[b+137>>0]=1;j=c[b+160>>2]|0;if(!j){i=1;Ea=g;return i|0}La[c[(c[j>>2]|0)+24>>2]&63](j);i=1;Ea=g;return i|0}if(!(a[b+60>>0]|0)){i=0;Ea=g;return i|0}t=+f[e>>2];s=+f[e+4>>2];u=+f[b+16>>2];if(!(u<=t)){i=0;Ea=g;return i|0}if(!(u+ +f[b+24>>2]>=t)){i=0;Ea=g;return i|0}t=+f[b+20>>2];if(!(t<=s)){i=0;Ea=g;return i|0}if(!(t+ +f[b+28>>2]>=s)){i=0;Ea=g;return i|0}c[h>>2]=b;ae(6031,h)|0;h=c[b+104>>2]|0;if(h|0)La[c[(c[h>>2]|0)+24>>2]&63](h);a[b+61>>0]=1;i=1;Ea=g;return i|0}function $c(b,d,e){b=b|0;d=d|0;e=e|0;var g=0,h=0,i=0.0,j=0.0,k=0.0,l=0,m=0,n=0,o=0,p=0,q=0;if(!(c[(c[d>>2]|0)+((c[b+4>>2]|0)*48|0)+40>>2]|0)){g=0;return g|0}if(a[b+136>>0]|0?(h=b+137|0,a[h>>0]|0):0){a[h>>0]=0;h=c[b+184>>2]|0;if(h|0)La[c[(c[h>>2]|0)+24>>2]&63](h);h=c[b+208>>2]|0;if(!h){g=1;return g|0}i=+f[e>>2];j=+f[e+4>>2];k=+f[b+16>>2];if(!(k<=i)){g=1;return g|0}if(!(k+ +f[b+24>>2]>=i)){g=1;return g|0}i=+f[b+20>>2];if(!(i<=j)){g=1;return g|0}if(!(i+ +f[b+28>>2]>=j)){g=1;return g|0}Na[c[(c[h>>2]|0)+24>>2]&7](h,e);g=1;return g|0}if(a[b+60>>0]|0?(h=b+61|0,a[h>>0]|0):0){l=c[b+128>>2]|0;if(l|0)La[c[(c[l>>2]|0)+24>>2]&63](l);a[h>>0]=0;g=1;return g|0}h=b+224|0;l=c[h>>2]|0;m=(c[b+228>>2]|0)-l|0;if((m|0)<=0){g=0;return g|0}b=(m>>>3)+-1|0;m=l;while(1){l=c[m+(b<<3)>>2]|0;n=c[m+(b<<3)+4>>2]|0;o=(n|0)==0;if(!o){p=n+4|0;c[p>>2]=(c[p>>2]|0)+1}p=$c(l,d,e)|0;if(!o?(o=n+4|0,l=c[o>>2]|0,c[o>>2]=l+-1,(l|0)==0):0){La[c[(c[n>>2]|0)+8>>2]&63](n);le(n)}if(p){g=1;q=27;break}p=b+-1|0;if((p|0)<=-1){g=0;q=27;break}b=p;m=c[h>>2]|0}if((q|0)==27)return g|0;return 0}function ad(a,b,d){a=a|0;b=b|0;d=+d;var e=0,f=0,g=0,h=0,i=0;if(!(c[(c[b>>2]|0)+((c[a+4>>2]|0)*48|0)+40>>2]|0))return;e=c[a+216>>2]|0;if(e|0){Oa[c[c[e>>2]>>2]&0](e,b,d);Qa[c[(c[a>>2]|0)+8>>2]&15](a,b,a+40|0,a+32|0)}e=c[a+224>>2]|0;f=c[a+228>>2]|0;if((e|0)==(f|0))return;a=e;do{e=c[a>>2]|0;g=c[a+4>>2]|0;if(g){h=g+4|0;c[h>>2]=(c[h>>2]|0)+1;ad(e,b,d);h=g+4|0;i=c[h>>2]|0;c[h>>2]=i+-1;if(!i){La[c[(c[g>>2]|0)+8>>2]&63](g);le(g)}}else ad(e,b,d);a=a+8|0}while((a|0)!=(f|0));return}function bd(){var b=0,d=0,e=0,f=0,g=0,h=0;b=Ea;Ea=Ea+16|0;if((Ea|0)>=(Fa|0))y(16);d=b;c[2006]=0;c[2007]=0;c[2008]=0;c[2009]=0;c[2010]=0;c[2011]=0;c[2012]=0;c[2013]=1065353216;e=me(16)|0;c[d>>2]=e;c[d+8>>2]=-2147483632;c[d+4>>2]=12;f=e;g=4581;h=f+12|0;do{a[f>>0]=a[g>>0]|0;f=f+1|0;g=g+1|0}while((f|0)<(h|0));a[e+12>>0]=0;oe(8056,d);if((a[d+11>>0]|0)<0)ne(c[d>>2]|0);d=pe(8056)|0;c[2015]=d;e=1;g=d;do{g=(t(g>>>30^g,1812433253)|0)+e|0;c[8060+(e<<2)>>2]=g;e=e+1|0}while((e|0)!=624);c[2639]=0;c[2640]=0;c[2641]=0;c[2642]=0;e=me(76)|0;c[2640]=e;g=e+76|0;c[2642]=g;c[e>>2]=-434550016;c[e+4>>2]=1018448640;c[e+8>>2]=-2025216;c[e+12>>2]=1130616832;c[e+16>>2]=-176017152;c[e+20>>2]=-1860258816;c[e+24>>2]=1121252352;c[e+28>>2]=-265099776;c[e+32>>2]=-1074838272;c[e+36>>2]=-88162816;c[e+40>>2]=1184468992;c[e+44>>2]=-423690496;c[e+48>>2]=-1704778752;c[e+52>>2]=-342016;c[e+56>>2]=-2147483648;c[e+60>>2]=-1426078976;c[e+64>>2]=-2139095040;c[e+68>>2]=-2576128;c[e+72>>2]=29952;c[2641]=g;c[2004]=0;Ea=b;return}function cd(a){a=a|0;var b=0,d=0;b=Ea;Ea=Ea+16|0;if((Ea|0)>=(Fa|0))y(16);d=b;c[d>>2]=hd(c[a+60>>2]|0)|0;a=fd(oa(6,d|0)|0)|0;Ea=b;return a|0}function dd(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0;e=Ea;Ea=Ea+48|0;if((Ea|0)>=(Fa|0))y(48);f=e+32|0;g=e+16|0;h=e;i=a+28|0;j=c[i>>2]|0;c[h>>2]=j;k=a+20|0;l=(c[k>>2]|0)-j|0;c[h+4>>2]=l;c[h+8>>2]=b;c[h+12>>2]=d;b=l+d|0;l=a+60|0;c[g>>2]=c[l>>2];c[g+4>>2]=h;c[g+8>>2]=2;j=fd(ja(146,g|0)|0)|0;a:do if((b|0)!=(j|0)){g=2;m=b;n=h;o=j;while(1){if((o|0)<0)break;m=m-o|0;p=c[n+4>>2]|0;q=o>>>0>p>>>0;r=q?n+8|0:n;s=g+(q<<31>>31)|0;t=o-(q?p:0)|0;c[r>>2]=(c[r>>2]|0)+t;p=r+4|0;c[p>>2]=(c[p>>2]|0)-t;c[f>>2]=c[l>>2];c[f+4>>2]=r;c[f+8>>2]=s;o=fd(ja(146,f|0)|0)|0;if((m|0)==(o|0)){u=3;break a}else{g=s;n=r}}c[a+16>>2]=0;c[i>>2]=0;c[k>>2]=0;c[a>>2]=c[a>>2]|32;if((g|0)==2)v=0;else v=d-(c[n+4>>2]|0)|0}else u=3;while(0);if((u|0)==3){u=c[a+44>>2]|0;c[a+16>>2]=u+(c[a+48>>2]|0);a=u;c[i>>2]=a;c[k>>2]=a;v=d}Ea=e;return v|0}function ed(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0;e=Ea;Ea=Ea+32|0;if((Ea|0)>=(Fa|0))y(32);f=e;g=e+20|0;c[f>>2]=c[a+60>>2];c[f+4>>2]=0;c[f+8>>2]=b;c[f+12>>2]=g;c[f+16>>2]=d;if((fd(ia(140,f|0)|0)|0)<0){c[g>>2]=-1;h=-1}else h=c[g>>2]|0;Ea=e;return h|0}function fd(a){a=a|0;var b=0;if(a>>>0>4294963200){c[(gd()|0)>>2]=0-a;b=-1}else b=a;return b|0}function gd(){return 10636}function hd(a){a=a|0;return a|0}function id(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0;f=Ea;Ea=Ea+32|0;if((Ea|0)>=(Fa|0))y(32);g=f;c[b+36>>2]=1;if((c[b>>2]&64|0)==0?(c[g>>2]=c[b+60>>2],c[g+4>>2]=21523,c[g+8>>2]=f+16,na(54,g|0)|0):0)a[b+75>>0]=-1;g=dd(b,d,e)|0;Ea=f;return g|0}function jd(a){a=a|0;return (a+-48|0)>>>0<10|0}function kd(){return 3832}function ld(b,c){b=b|0;c=c|0;var d=0,e=0,f=0,g=0;d=a[b>>0]|0;e=a[c>>0]|0;if(d<<24>>24==0?1:d<<24>>24!=e<<24>>24){f=e;g=d}else{d=c;c=b;do{c=c+1|0;d=d+1|0;b=a[c>>0]|0;e=a[d>>0]|0}while(!(b<<24>>24==0?1:b<<24>>24!=e<<24>>24));f=e;g=b}return (g&255)-(f&255)|0}function md(b){b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0;d=b;a:do if(!(d&3)){e=b;f=5}else{g=b;h=d;while(1){if(!(a[g>>0]|0)){i=h;break a}j=g+1|0;h=j;if(!(h&3)){e=j;f=5;break}else g=j}}while(0);if((f|0)==5){f=e;while(1){k=c[f>>2]|0;if(!((k&-2139062144^-2139062144)&k+-16843009))f=f+4|0;else break}if(!((k&255)<<24>>24))l=f;else{k=f;while(1){f=k+1|0;if(!(a[f>>0]|0)){l=f;break}else k=f}}i=l}return i-d|0}function nd(a,b){a=a|0;b=b|0;var c=0;c=md(a)|0;return ((od(a,1,c,b)|0)!=(c|0))<<31>>31|0}function od(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0;f=t(d,b)|0;g=(b|0)==0?0:d;if((c[e+76>>2]|0)>-1){d=(qd(e)|0)==0;h=td(a,f,e)|0;if(d)i=h;else{pd(e);i=h}}else i=td(a,f,e)|0;if((i|0)==(f|0))j=g;else j=(i>>>0)/(b>>>0)|0;return j|0}function pd(a){a=a|0;return}function qd(a){a=a|0;return 1}function rd(b,e){b=b|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0;f=Ea;Ea=Ea+16|0;if((Ea|0)>=(Fa|0))y(16);g=f;h=e&255;a[g>>0]=h;i=b+16|0;j=c[i>>2]|0;if(!j)if(!(sd(b)|0)){k=c[i>>2]|0;l=4}else m=-1;else{k=j;l=4}do if((l|0)==4){j=b+20|0;i=c[j>>2]|0;if(i>>>0<k>>>0?(n=e&255,(n|0)!=(a[b+75>>0]|0)):0){c[j>>2]=i+1;a[i>>0]=h;m=n;break}if((Ja[c[b+36>>2]&7](b,g,1)|0)==1)m=d[g>>0]|0;else m=-1}while(0);Ea=f;return m|0}function sd(b){b=b|0;var d=0,e=0,f=0;d=b+74|0;e=a[d>>0]|0;a[d>>0]=e+255|e;e=c[b>>2]|0;if(!(e&8)){c[b+8>>2]=0;c[b+4>>2]=0;d=c[b+44>>2]|0;c[b+28>>2]=d;c[b+20>>2]=d;c[b+16>>2]=d+(c[b+48>>2]|0);f=0}else{c[b>>2]=e|32;f=-1}return f|0}function td(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0;f=e+16|0;g=c[f>>2]|0;if(!g)if(!(sd(e)|0)){h=c[f>>2]|0;i=5}else j=0;else{h=g;i=5}a:do if((i|0)==5){g=e+20|0;f=c[g>>2]|0;k=f;if((h-f|0)>>>0<d>>>0){j=Ja[c[e+36>>2]&7](e,b,d)|0;break}b:do if((a[e+75>>0]|0)<0|(d|0)==0){l=0;m=b;n=d;o=k}else{f=d;while(1){p=f+-1|0;if((a[b+p>>0]|0)==10)break;if(!p){l=0;m=b;n=d;o=k;break b}else f=p}p=Ja[c[e+36>>2]&7](e,b,f)|0;if(p>>>0<f>>>0){j=p;break a}l=f;m=b+f|0;n=d-f|0;o=c[g>>2]|0}while(0);Qf(o|0,m|0,n|0)|0;c[g>>2]=(c[g>>2]|0)+n;j=l+n|0}while(0);return j|0}function ud(a,b){a=a|0;b=b|0;var d=0;if(!b)d=0;else d=vd(c[b>>2]|0,c[b+4>>2]|0,a)|0;return ((d|0)==0?a:d)|0}function vd(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0;f=(c[b>>2]|0)+1794895138|0;g=wd(c[b+8>>2]|0,f)|0;h=wd(c[b+12>>2]|0,f)|0;i=wd(c[b+16>>2]|0,f)|0;a:do if((g>>>0<d>>>2>>>0?(j=d-(g<<2)|0,h>>>0<j>>>0&i>>>0<j>>>0):0)?((i|h)&3|0)==0:0){j=h>>>2;k=i>>>2;l=0;m=g;while(1){n=m>>>1;o=l+n|0;p=o<<1;q=p+j|0;r=wd(c[b+(q<<2)>>2]|0,f)|0;s=wd(c[b+(q+1<<2)>>2]|0,f)|0;if(!(s>>>0<d>>>0&r>>>0<(d-s|0)>>>0)){t=0;break a}if(a[b+(s+r)>>0]|0){t=0;break a}r=ld(e,b+s|0)|0;if(!r)break;s=(r|0)<0;if((m|0)==1){t=0;break a}l=s?l:o;m=s?n:m-n|0}m=p+k|0;l=wd(c[b+(m<<2)>>2]|0,f)|0;j=wd(c[b+(m+1<<2)>>2]|0,f)|0;if(j>>>0<d>>>0&l>>>0<(d-j|0)>>>0)t=(a[b+(j+l)>>0]|0)==0?b+j|0:0;else t=0}else t=0;while(0);return t|0}function wd(a,b){a=a|0;b=b|0;var c=0;c=Pf(a|0)|0;return ((b|0)==0?a:c)|0}function xd(){fa(10640);return 10648}function yd(){pa(10640);return}function zd(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0;do if(a){if((c[a+76>>2]|0)<=-1){b=Ad(a)|0;break}d=(qd(a)|0)==0;e=Ad(a)|0;if(d)b=e;else{pd(a);b=e}}else{if(!(c[957]|0))f=0;else f=zd(c[957]|0)|0;e=c[(xd()|0)>>2]|0;if(!e)g=f;else{d=e;e=f;while(1){if((c[d+76>>2]|0)>-1)h=qd(d)|0;else h=0;if((c[d+20>>2]|0)>>>0>(c[d+28>>2]|0)>>>0)i=Ad(d)|0|e;else i=e;if(h|0)pd(d);d=c[d+56>>2]|0;if(!d){g=i;break}else e=i}}yd();b=g}while(0);return b|0}function Ad(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0;b=a+20|0;d=a+28|0;if((c[b>>2]|0)>>>0>(c[d>>2]|0)>>>0?(Ja[c[a+36>>2]&7](a,0,0)|0,(c[b>>2]|0)==0):0)e=-1;else{f=a+4|0;g=c[f>>2]|0;h=a+8|0;i=c[h>>2]|0;if(g>>>0<i>>>0)Ja[c[a+40>>2]&7](a,g-i|0,1)|0;c[a+16>>2]=0;c[d>>2]=0;c[b>>2]=0;c[h>>2]=0;c[f>>2]=0;e=0}return e|0}function Bd(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,u=0,v=0,w=0,x=0,y=0;f=d&255;g=(e|0)!=0;a:do if(g&(b&3|0)!=0){h=d&255;i=b;j=e;while(1){if((a[i>>0]|0)==h<<24>>24){k=i;l=j;m=6;break a}n=i+1|0;o=j+-1|0;p=(o|0)!=0;if(p&(n&3|0)!=0){i=n;j=o}else{q=n;r=o;s=p;m=5;break}}}else{q=b;r=e;s=g;m=5}while(0);if((m|0)==5)if(s){k=q;l=r;m=6}else m=16;b:do if((m|0)==6){r=d&255;if((a[k>>0]|0)==r<<24>>24)if(!l){m=16;break}else{u=k;break}q=t(f,16843009)|0;c:do if(l>>>0>3){s=k;g=l;while(1){e=c[s>>2]^q;if((e&-2139062144^-2139062144)&e+-16843009|0){v=g;w=s;break c}e=s+4|0;b=g+-4|0;if(b>>>0>3){s=e;g=b}else{x=e;y=b;m=11;break}}}else{x=k;y=l;m=11}while(0);if((m|0)==11)if(!y){m=16;break}else{v=y;w=x}q=w;g=v;while(1){if((a[q>>0]|0)==r<<24>>24){u=q;break b}g=g+-1|0;if(!g){m=16;break}else q=q+1|0}}while(0);if((m|0)==16)u=0;return u|0}function Cd(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0;f=Ea;Ea=Ea+224|0;if((Ea|0)>=(Fa|0))y(224);g=f+208|0;h=f+160|0;i=f+80|0;j=f;k=h;l=k+40|0;do{c[k>>2]=0;k=k+4|0}while((k|0)<(l|0));c[g>>2]=c[e>>2];if((Dd(0,d,g,i,h)|0)<0)m=-1;else{if((c[b+76>>2]|0)>-1)n=qd(b)|0;else n=0;e=c[b>>2]|0;k=e&32;if((a[b+74>>0]|0)<1)c[b>>2]=e&-33;e=b+48|0;if(!(c[e>>2]|0)){l=b+44|0;o=c[l>>2]|0;c[l>>2]=j;p=b+28|0;c[p>>2]=j;q=b+20|0;c[q>>2]=j;c[e>>2]=80;r=b+16|0;c[r>>2]=j+80;j=Dd(b,d,g,i,h)|0;if(!o)s=j;else{Ja[c[b+36>>2]&7](b,0,0)|0;t=(c[q>>2]|0)==0?-1:j;c[l>>2]=o;c[e>>2]=0;c[r>>2]=0;c[p>>2]=0;c[q>>2]=0;s=t}}else s=Dd(b,d,g,i,h)|0;h=c[b>>2]|0;c[b>>2]=h|k;if(n|0)pd(b);m=(h&32|0)==0?s:-1}Ea=f;return m|0}function Dd(d,e,f,h,i){d=d|0;e=e|0;f=f|0;h=h|0;i=i|0;var j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ba=0,ca=0,da=0,ea=0,fa=0,ga=0,ha=0,ia=0,ja=0,ka=0,la=0,ma=0,na=0,oa=0,pa=0,qa=0,ra=0,sa=0,ta=0,ua=0,va=0,wa=0,xa=0,ya=0,za=0,Aa=0,Ba=0,Ca=0,Da=0;j=Ea;Ea=Ea+64|0;if((Ea|0)>=(Fa|0))y(64);k=j+56|0;l=j+40|0;m=j;n=j+48|0;o=j+60|0;c[k>>2]=e;e=(d|0)!=0;p=m+40|0;q=p;r=m+39|0;m=n+4|0;s=0;t=0;u=0;a:while(1){v=s;w=t;while(1){do if((w|0)>-1)if((v|0)>(2147483647-w|0)){c[(gd()|0)>>2]=75;z=-1;break}else{z=v+w|0;break}else z=w;while(0);A=c[k>>2]|0;B=a[A>>0]|0;if(!(B<<24>>24)){C=94;break a}D=B;B=A;b:while(1){switch(D<<24>>24){case 37:{C=10;break b;break}case 0:{E=B;break b;break}default:{}}F=B+1|0;c[k>>2]=F;D=a[F>>0]|0;B=F}c:do if((C|0)==10){C=0;D=B;F=B;while(1){if((a[F+1>>0]|0)!=37){E=D;break c}G=D+1|0;F=F+2|0;c[k>>2]=F;if((a[F>>0]|0)!=37){E=G;break}else D=G}}while(0);v=E-A|0;if(e)Ed(d,A,v);if(!v)break;else w=z}w=(jd(a[(c[k>>2]|0)+1>>0]|0)|0)==0;v=c[k>>2]|0;if(!w?(a[v+2>>0]|0)==36:0){H=(a[v+1>>0]|0)+-48|0;I=1;J=3}else{H=-1;I=u;J=1}w=v+J|0;c[k>>2]=w;v=a[w>>0]|0;B=(v<<24>>24)+-32|0;if(B>>>0>31|(1<<B&75913|0)==0){K=0;L=v;M=w}else{v=0;D=B;B=w;while(1){w=1<<D|v;F=B+1|0;c[k>>2]=F;G=a[F>>0]|0;D=(G<<24>>24)+-32|0;if(D>>>0>31|(1<<D&75913|0)==0){K=w;L=G;M=F;break}else{v=w;B=F}}}if(L<<24>>24==42){if((jd(a[M+1>>0]|0)|0)!=0?(B=c[k>>2]|0,(a[B+2>>0]|0)==36):0){v=B+1|0;c[i+((a[v>>0]|0)+-48<<2)>>2]=10;N=c[h+((a[v>>0]|0)+-48<<3)>>2]|0;O=1;P=B+3|0}else{if(I|0){Q=-1;break}if(e){B=(c[f>>2]|0)+(4-1)&~(4-1);v=c[B>>2]|0;c[f>>2]=B+4;R=v}else R=0;N=R;O=0;P=(c[k>>2]|0)+1|0}c[k>>2]=P;v=(N|0)<0;S=v?0-N|0:N;T=v?K|8192:K;U=O;V=P}else{v=Fd(k)|0;if((v|0)<0){Q=-1;break}S=v;T=K;U=I;V=c[k>>2]|0}do if((a[V>>0]|0)==46){v=V+1|0;if((a[v>>0]|0)!=42){c[k>>2]=v;v=Fd(k)|0;W=v;X=c[k>>2]|0;break}if(jd(a[V+2>>0]|0)|0?(v=c[k>>2]|0,(a[v+3>>0]|0)==36):0){B=v+2|0;c[i+((a[B>>0]|0)+-48<<2)>>2]=10;D=c[h+((a[B>>0]|0)+-48<<3)>>2]|0;B=v+4|0;c[k>>2]=B;W=D;X=B;break}if(U|0){Q=-1;break a}if(e){B=(c[f>>2]|0)+(4-1)&~(4-1);D=c[B>>2]|0;c[f>>2]=B+4;Y=D}else Y=0;D=(c[k>>2]|0)+2|0;c[k>>2]=D;W=Y;X=D}else{W=-1;X=V}while(0);D=0;B=X;while(1){if(((a[B>>0]|0)+-65|0)>>>0>57){Q=-1;break a}v=B;B=B+1|0;c[k>>2]=B;Z=a[(a[v>>0]|0)+-65+(16+(D*58|0))>>0]|0;_=Z&255;if((_+-1|0)>>>0>=8)break;else D=_}if(!(Z<<24>>24)){Q=-1;break}v=(H|0)>-1;do if(Z<<24>>24==19)if(v){Q=-1;break a}else C=54;else{if(v){c[i+(H<<2)>>2]=_;F=h+(H<<3)|0;w=c[F+4>>2]|0;G=l;c[G>>2]=c[F>>2];c[G+4>>2]=w;C=54;break}if(!e){Q=0;break a}Gd(l,_,f);$=c[k>>2]|0;C=55}while(0);if((C|0)==54){C=0;if(e){$=B;C=55}else aa=0}d:do if((C|0)==55){C=0;v=a[$+-1>>0]|0;w=(D|0)!=0&(v&15|0)==3?v&-33:v;v=T&-65537;G=(T&8192|0)==0?T:v;e:do switch(w|0){case 110:{switch((D&255)<<24>>24){case 0:{c[c[l>>2]>>2]=z;aa=0;break d;break}case 1:{c[c[l>>2]>>2]=z;aa=0;break d;break}case 2:{F=c[l>>2]|0;c[F>>2]=z;c[F+4>>2]=((z|0)<0)<<31>>31;aa=0;break d;break}case 3:{b[c[l>>2]>>1]=z;aa=0;break d;break}case 4:{a[c[l>>2]>>0]=z;aa=0;break d;break}case 6:{c[c[l>>2]>>2]=z;aa=0;break d;break}case 7:{F=c[l>>2]|0;c[F>>2]=z;c[F+4>>2]=((z|0)<0)<<31>>31;aa=0;break d;break}default:{aa=0;break d}}break}case 112:{ba=120;ca=W>>>0>8?W:8;da=G|8;C=67;break}case 88:case 120:{ba=w;ca=W;da=G;C=67;break}case 111:{F=l;ea=c[F>>2]|0;fa=c[F+4>>2]|0;F=Id(ea,fa,p)|0;ga=q-F|0;ha=F;ia=0;ja=6098;ka=(G&8|0)==0|(W|0)>(ga|0)?W:ga+1|0;la=G;ma=ea;na=fa;C=73;break}case 105:case 100:{fa=l;ea=c[fa>>2]|0;ga=c[fa+4>>2]|0;if((ga|0)<0){fa=Jf(0,0,ea|0,ga|0)|0;F=x()|0;oa=l;c[oa>>2]=fa;c[oa+4>>2]=F;pa=1;qa=6098;ra=fa;sa=F;C=72;break e}else{pa=(G&2049|0)!=0&1;qa=(G&2048|0)==0?((G&1|0)==0?6098:6100):6099;ra=ea;sa=ga;C=72;break e}break}case 117:{ga=l;pa=0;qa=6098;ra=c[ga>>2]|0;sa=c[ga+4>>2]|0;C=72;break}case 99:{a[r>>0]=c[l>>2];ta=r;ua=0;va=6098;wa=1;xa=v;ya=q;break}case 109:{za=Kd(c[(gd()|0)>>2]|0)|0;C=77;break}case 115:{ga=c[l>>2]|0;za=(ga|0)==0?6108:ga;C=77;break}case 67:{c[n>>2]=c[l>>2];c[m>>2]=0;c[l>>2]=n;Aa=-1;C=81;break}case 83:{if(!W){Ld(d,32,S,0,G);Ba=0;C=91}else{Aa=W;C=81}break}case 65:case 71:case 70:case 69:case 97:case 103:case 102:case 101:{aa=Nd(d,+g[l>>3],S,W,G,w)|0;break d;break}default:{ta=A;ua=0;va=6098;wa=W;xa=G;ya=q}}while(0);f:do if((C|0)==67){C=0;w=l;ga=c[w>>2]|0;ea=c[w+4>>2]|0;w=Hd(ga,ea,p,ba&32)|0;F=(da&8|0)==0|(ga|0)==0&(ea|0)==0;ha=w;ia=F?0:2;ja=F?6098:6098+(ba>>>4)|0;ka=ca;la=da;ma=ga;na=ea;C=73}else if((C|0)==72){C=0;ha=Jd(ra,sa,p)|0;ia=pa;ja=qa;ka=W;la=G;ma=ra;na=sa;C=73}else if((C|0)==77){C=0;ea=Bd(za,0,W)|0;ga=(ea|0)==0;ta=za;ua=0;va=6098;wa=ga?W:ea-za|0;xa=v;ya=ga?za+W|0:ea}else if((C|0)==81){C=0;ea=c[l>>2]|0;ga=0;while(1){F=c[ea>>2]|0;if(!F){Ca=ga;break}w=Md(o,F)|0;Da=(w|0)<0;if(Da|w>>>0>(Aa-ga|0)>>>0){C=85;break}F=w+ga|0;if(Aa>>>0>F>>>0){ea=ea+4|0;ga=F}else{Ca=F;break}}if((C|0)==85){C=0;if(Da){Q=-1;break a}else Ca=ga}Ld(d,32,S,Ca,G);if(!Ca){Ba=0;C=91}else{ea=c[l>>2]|0;F=0;while(1){w=c[ea>>2]|0;if(!w){Ba=Ca;C=91;break f}fa=Md(o,w)|0;F=fa+F|0;if((F|0)>(Ca|0)){Ba=Ca;C=91;break f}Ed(d,o,fa);if(F>>>0>=Ca>>>0){Ba=Ca;C=91;break}else ea=ea+4|0}}}while(0);if((C|0)==73){C=0;v=(ma|0)!=0|(na|0)!=0;ea=(ka|0)!=0|v;F=q-ha+((v^1)&1)|0;ta=ea?ha:p;ua=ia;va=ja;wa=ea?((ka|0)>(F|0)?ka:F):0;xa=(ka|0)>-1?la&-65537:la;ya=q}else if((C|0)==91){C=0;Ld(d,32,S,Ba,G^8192);aa=(S|0)>(Ba|0)?S:Ba;break}F=ya-ta|0;ea=(wa|0)<(F|0)?F:wa;v=ea+ua|0;ga=(S|0)<(v|0)?v:S;Ld(d,32,ga,v,xa);Ed(d,va,ua);Ld(d,48,ga,v,xa^65536);Ld(d,48,ea,F,0);Ed(d,ta,F);Ld(d,32,ga,v,xa^8192);aa=ga}while(0);s=aa;t=z;u=U}g:do if((C|0)==94)if(!d)if(!u)Q=0;else{U=1;while(1){t=c[i+(U<<2)>>2]|0;if(!t)break;Gd(h+(U<<3)|0,t,f);t=U+1|0;if(t>>>0<10)U=t;else{Q=1;break g}}t=U;while(1){if(c[i+(t<<2)>>2]|0){Q=-1;break g}t=t+1|0;if(t>>>0>=10){Q=1;break}}}else Q=z;while(0);Ea=j;return Q|0}function Ed(a,b,d){a=a|0;b=b|0;d=d|0;if(!(c[a>>2]&32))td(b,d,a)|0;return}function Fd(b){b=b|0;var d=0,e=0,f=0,g=0,h=0;if(!(jd(a[c[b>>2]>>0]|0)|0))d=0;else{e=0;while(1){f=c[b>>2]|0;g=(e*10|0)+-48+(a[f>>0]|0)|0;h=f+1|0;c[b>>2]=h;if(!(jd(a[h>>0]|0)|0)){d=g;break}else e=g}}return d|0}function Gd(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,h=0,i=0,j=0.0;a:do if(b>>>0<=20)do switch(b|0){case 9:{e=(c[d>>2]|0)+(4-1)&~(4-1);f=c[e>>2]|0;c[d>>2]=e+4;c[a>>2]=f;break a;break}case 10:{f=(c[d>>2]|0)+(4-1)&~(4-1);e=c[f>>2]|0;c[d>>2]=f+4;f=a;c[f>>2]=e;c[f+4>>2]=((e|0)<0)<<31>>31;break a;break}case 11:{e=(c[d>>2]|0)+(4-1)&~(4-1);f=c[e>>2]|0;c[d>>2]=e+4;e=a;c[e>>2]=f;c[e+4>>2]=0;break a;break}case 12:{e=(c[d>>2]|0)+(8-1)&~(8-1);f=e;h=c[f>>2]|0;i=c[f+4>>2]|0;c[d>>2]=e+8;e=a;c[e>>2]=h;c[e+4>>2]=i;break a;break}case 13:{i=(c[d>>2]|0)+(4-1)&~(4-1);e=c[i>>2]|0;c[d>>2]=i+4;i=(e&65535)<<16>>16;e=a;c[e>>2]=i;c[e+4>>2]=((i|0)<0)<<31>>31;break a;break}case 14:{i=(c[d>>2]|0)+(4-1)&~(4-1);e=c[i>>2]|0;c[d>>2]=i+4;i=a;c[i>>2]=e&65535;c[i+4>>2]=0;break a;break}case 15:{i=(c[d>>2]|0)+(4-1)&~(4-1);e=c[i>>2]|0;c[d>>2]=i+4;i=(e&255)<<24>>24;e=a;c[e>>2]=i;c[e+4>>2]=((i|0)<0)<<31>>31;break a;break}case 16:{i=(c[d>>2]|0)+(4-1)&~(4-1);e=c[i>>2]|0;c[d>>2]=i+4;i=a;c[i>>2]=e&255;c[i+4>>2]=0;break a;break}case 17:{i=(c[d>>2]|0)+(8-1)&~(8-1);j=+g[i>>3];c[d>>2]=i+8;g[a>>3]=j;break a;break}case 18:{i=(c[d>>2]|0)+(8-1)&~(8-1);j=+g[i>>3];c[d>>2]=i+8;g[a>>3]=j;break a;break}default:break a}while(0);while(0);return}function Hd(b,c,e,f){b=b|0;c=c|0;e=e|0;f=f|0;var g=0,h=0;if((b|0)==0&(c|0)==0)g=e;else{h=e;e=c;c=b;while(1){b=h+-1|0;a[b>>0]=d[480+(c&15)>>0]|0|f;c=Nf(c|0,e|0,4)|0;e=x()|0;if((c|0)==0&(e|0)==0){g=b;break}else h=b}}return g|0}function Id(b,c,d){b=b|0;c=c|0;d=d|0;var e=0,f=0;if((b|0)==0&(c|0)==0)e=d;else{f=d;d=c;c=b;while(1){b=f+-1|0;a[b>>0]=c&7|48;c=Nf(c|0,d|0,3)|0;d=x()|0;if((c|0)==0&(d|0)==0){e=b;break}else f=b}}return e|0}function Jd(b,c,d){b=b|0;c=c|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;if(c>>>0>0|(c|0)==0&b>>>0>4294967295){e=d;f=b;g=c;do{c=f;f=Mf(f|0,g|0,10,0)|0;h=g;g=x()|0;i=Hf(f|0,g|0,10,0)|0;j=Jf(c|0,h|0,i|0,x()|0)|0;x()|0;e=e+-1|0;a[e>>0]=j&255|48}while(h>>>0>9|(h|0)==9&c>>>0>4294967295);k=f;l=e}else{k=b;l=d}if(!k)m=l;else{d=k;k=l;while(1){l=d;d=(d>>>0)/10|0;b=k+-1|0;a[b>>0]=l-(d*10|0)|48;if(l>>>0<10){m=b;break}else k=b}}return m|0}function Kd(a){a=a|0;return Ud(a,c[(Td()|0)+188>>2]|0)|0}function Ld(a,b,c,d,e){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;var f=0,g=0,h=0;f=Ea;Ea=Ea+256|0;if((Ea|0)>=(Fa|0))y(256);g=f;if((c|0)>(d|0)&(e&73728|0)==0){e=c-d|0;Rf(g|0,b<<24>>24|0,(e>>>0<256?e:256)|0)|0;if(e>>>0>255){b=c-d|0;d=e;do{Ed(a,g,256);d=d+-256|0}while(d>>>0>255);h=b&255}else h=e;Ed(a,g,h)}Ea=f;return}function Md(a,b){a=a|0;b=b|0;var c=0;if(!a)c=0;else c=Rd(a,b,0)|0;return c|0}function Nd(b,e,f,g,h,i){b=b|0;e=+e;f=f|0;g=g|0;h=h|0;i=i|0;var j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0.0,u=0,v=0.0,w=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0.0,H=0,I=0,J=0,K=0.0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0.0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ba=0,ca=0,da=0,ea=0,fa=0,ga=0,ha=0,ia=0.0,ja=0.0,ka=0,la=0,ma=0,na=0,oa=0,pa=0,qa=0,ra=0,sa=0,ta=0,ua=0,va=0,wa=0,xa=0,ya=0,za=0,Aa=0,Ba=0,Ca=0,Da=0,Ga=0,Ha=0,Ia=0,Ja=0,Ka=0;j=Ea;Ea=Ea+560|0;if((Ea|0)>=(Fa|0))y(560);k=j+32|0;l=j+536|0;m=j;n=m;o=j+540|0;c[l>>2]=0;p=o+12|0;q=Od(e)|0;r=x()|0;if((r|0)<0){s=-e;u=Od(s)|0;v=s;w=1;z=6115;A=x()|0;B=u}else{v=e;w=(h&2049|0)!=0&1;z=(h&2048|0)==0?((h&1|0)==0?6116:6121):6118;A=r;B=q}do if(0==0&(A&2146435072|0)==2146435072){q=(i&32|0)!=0;B=w+3|0;Ld(b,32,f,B,h&-65537);Ed(b,z,w);Ed(b,v!=v|0.0!=0.0?(q?6142:6146):q?6134:6138,3);Ld(b,32,f,B,h^8192);C=B}else{e=+Pd(v,l)*2.0;B=e!=0.0;if(B)c[l>>2]=(c[l>>2]|0)+-1;q=i|32;if((q|0)==97){r=i&32;u=(r|0)==0?z:z+9|0;D=w|2;E=12-g|0;do if(!(g>>>0>11|(E|0)==0)){s=8.0;F=E;do{F=F+-1|0;s=s*16.0}while((F|0)!=0);if((a[u>>0]|0)==45){G=-(s+(-e-s));break}else{G=e+s-s;break}}else G=e;while(0);E=c[l>>2]|0;F=(E|0)<0?0-E|0:E;H=Jd(F,((F|0)<0)<<31>>31,p)|0;if((H|0)==(p|0)){F=o+11|0;a[F>>0]=48;I=F}else I=H;a[I+-1>>0]=(E>>31&2)+43;E=I+-2|0;a[E>>0]=i+15;H=(g|0)<1;F=(h&8|0)==0;J=m;K=G;while(1){L=~~K;M=J+1|0;a[J>>0]=r|d[480+L>>0];K=(K-+(L|0))*16.0;if((M-n|0)==1?!(F&(H&K==0.0)):0){a[M>>0]=46;N=J+2|0}else N=M;if(!(K!=0.0))break;else J=N}J=N;if((g|0)!=0?(-2-n+J|0)<(g|0):0){H=p;F=E;O=g+2+H-F|0;P=H;Q=F}else{F=p;H=E;O=F-n-H+J|0;P=F;Q=H}H=O+D|0;Ld(b,32,f,H,h);Ed(b,u,D);Ld(b,48,f,H,h^65536);F=J-n|0;Ed(b,m,F);J=P-Q|0;Ld(b,48,O-(F+J)|0,0,0);Ed(b,E,J);Ld(b,32,f,H,h^8192);C=H;break}H=(g|0)<0?6:g;if(B){J=(c[l>>2]|0)+-28|0;c[l>>2]=J;R=e*268435456.0;S=J}else{R=e;S=c[l>>2]|0}J=(S|0)<0?k:k+288|0;F=J;K=R;do{r=~~K>>>0;c[F>>2]=r;F=F+4|0;K=(K-+(r>>>0))*1.0e9}while(K!=0.0);B=J;if((S|0)>0){E=J;D=F;u=S;while(1){r=(u|0)<29?u:29;M=D+-4|0;if(M>>>0>=E>>>0){L=M;M=0;do{T=Of(c[L>>2]|0,0,r|0)|0;U=If(T|0,x()|0,M|0,0)|0;T=x()|0;M=Mf(U|0,T|0,1e9,0)|0;V=Hf(M|0,x()|0,1e9,0)|0;W=Jf(U|0,T|0,V|0,x()|0)|0;x()|0;c[L>>2]=W;L=L+-4|0}while(L>>>0>=E>>>0);if(M){L=E+-4|0;c[L>>2]=M;X=L}else X=E}else X=E;a:do if(D>>>0>X>>>0){L=D;while(1){W=L+-4|0;if(c[W>>2]|0){Y=L;break a}if(W>>>0>X>>>0)L=W;else{Y=W;break}}}else Y=D;while(0);M=(c[l>>2]|0)-r|0;c[l>>2]=M;if((M|0)>0){E=X;D=Y;u=M}else{Z=X;_=Y;$=M;break}}}else{Z=J;_=F;$=S}if(($|0)<0){u=((H+25|0)/9|0)+1|0;D=(q|0)==102;E=Z;M=_;L=$;while(1){W=0-L|0;V=(W|0)<9?W:9;if(E>>>0<M>>>0){W=(1<<V)+-1|0;T=1e9>>>V;U=0;aa=E;do{ba=c[aa>>2]|0;c[aa>>2]=(ba>>>V)+U;U=t(ba&W,T)|0;aa=aa+4|0}while(aa>>>0<M>>>0);aa=(c[E>>2]|0)==0?E+4|0:E;if(!U){ca=M;da=aa}else{c[M>>2]=U;ca=M+4|0;da=aa}}else{ca=M;da=(c[E>>2]|0)==0?E+4|0:E}aa=D?J:da;T=(ca-aa>>2|0)>(u|0)?aa+(u<<2)|0:ca;L=(c[l>>2]|0)+V|0;c[l>>2]=L;if((L|0)>=0){ea=da;fa=T;break}else{E=da;M=T}}}else{ea=Z;fa=_}if(ea>>>0<fa>>>0){M=(B-ea>>2)*9|0;E=c[ea>>2]|0;if(E>>>0<10)ga=M;else{L=M;M=10;while(1){M=M*10|0;u=L+1|0;if(E>>>0<M>>>0){ga=u;break}else L=u}}}else ga=0;L=(q|0)==103;M=(H|0)!=0;E=H-((q|0)==102?0:ga)+((M&L)<<31>>31)|0;if((E|0)<(((fa-B>>2)*9|0)+-9|0)){u=E+9216|0;E=(u|0)/9|0;D=J+4+(E+-1024<<2)|0;F=u-(E*9|0)|0;if((F|0)<8){E=F;F=10;while(1){u=F*10|0;if((E|0)<7){E=E+1|0;F=u}else{ha=u;break}}}else ha=10;F=c[D>>2]|0;E=(F>>>0)/(ha>>>0)|0;q=F-(t(E,ha)|0)|0;u=(D+4|0)==(fa|0);if(!(u&(q|0)==0)){s=(E&1|0)==0?9007199254740992.0:9007199254740994.0;E=ha>>>1;K=q>>>0<E>>>0?.5:u&(q|0)==(E|0)?1.0:1.5;if(!w){ia=K;ja=s}else{E=(a[z>>0]|0)==45;ia=E?-K:K;ja=E?-s:s}E=F-q|0;c[D>>2]=E;if(ja+ia!=ja){q=E+ha|0;c[D>>2]=q;if(q>>>0>999999999){q=D;E=ea;while(1){F=q+-4|0;c[q>>2]=0;if(F>>>0<E>>>0){u=E+-4|0;c[u>>2]=0;ka=u}else ka=E;u=(c[F>>2]|0)+1|0;c[F>>2]=u;if(u>>>0>999999999){q=F;E=ka}else{la=F;ma=ka;break}}}else{la=D;ma=ea}E=(B-ma>>2)*9|0;q=c[ma>>2]|0;if(q>>>0<10){na=la;oa=E;pa=ma}else{F=E;E=10;while(1){E=E*10|0;u=F+1|0;if(q>>>0<E>>>0){na=la;oa=u;pa=ma;break}else F=u}}}else{na=D;oa=ga;pa=ea}}else{na=D;oa=ga;pa=ea}F=na+4|0;qa=oa;ra=fa>>>0>F>>>0?F:fa;sa=pa}else{qa=ga;ra=fa;sa=ea}F=0-qa|0;b:do if(ra>>>0>sa>>>0){E=ra;while(1){q=E+-4|0;if(c[q>>2]|0){ta=E;ua=1;break b}if(q>>>0>sa>>>0)E=q;else{ta=q;ua=0;break}}}else{ta=ra;ua=0}while(0);do if(L){D=H+((M^1)&1)|0;if((D|0)>(qa|0)&(qa|0)>-5){va=i+-1|0;wa=D+-1-qa|0}else{va=i+-2|0;wa=D+-1|0}if(!(h&8)){if(ua?(D=c[ta+-4>>2]|0,(D|0)!=0):0)if(!((D>>>0)%10|0)){E=0;V=10;while(1){V=V*10|0;U=E+1|0;if((D>>>0)%(V>>>0)|0|0){xa=U;break}else E=U}}else xa=0;else xa=9;E=((ta-B>>2)*9|0)+-9|0;if((va|32|0)==102){V=E-xa|0;D=(V|0)>0?V:0;ya=va;za=(wa|0)<(D|0)?wa:D;break}else{D=E+qa-xa|0;E=(D|0)>0?D:0;ya=va;za=(wa|0)<(E|0)?wa:E;break}}else{ya=va;za=wa}}else{ya=i;za=H}while(0);H=(za|0)!=0;B=H?1:h>>>3&1;M=(ya|32|0)==102;if(M){Aa=0;Ba=(qa|0)>0?qa:0}else{L=(qa|0)<0?F:qa;E=Jd(L,((L|0)<0)<<31>>31,p)|0;L=p;if((L-E|0)<2){D=E;while(1){V=D+-1|0;a[V>>0]=48;if((L-V|0)<2)D=V;else{Ca=V;break}}}else Ca=E;a[Ca+-1>>0]=(qa>>31&2)+43;D=Ca+-2|0;a[D>>0]=ya;Aa=D;Ba=L-D|0}D=w+1+za+B+Ba|0;Ld(b,32,f,D,h);Ed(b,z,w);Ld(b,48,f,D,h^65536);if(M){F=sa>>>0>J>>>0?J:sa;V=m+9|0;U=V;q=m+8|0;u=F;do{T=Jd(c[u>>2]|0,0,V)|0;if((u|0)==(F|0))if((T|0)==(V|0)){a[q>>0]=48;Da=q}else Da=T;else if(T>>>0>m>>>0){Rf(m|0,48,T-n|0)|0;aa=T;while(1){W=aa+-1|0;if(W>>>0>m>>>0)aa=W;else{Da=W;break}}}else Da=T;Ed(b,Da,U-Da|0);u=u+4|0}while(u>>>0<=J>>>0);if(!((h&8|0)==0&(H^1)))Ed(b,6150,1);if(u>>>0<ta>>>0&(za|0)>0){J=za;U=u;while(1){q=Jd(c[U>>2]|0,0,V)|0;if(q>>>0>m>>>0){Rf(m|0,48,q-n|0)|0;F=q;while(1){M=F+-1|0;if(M>>>0>m>>>0)F=M;else{Ga=M;break}}}else Ga=q;Ed(b,Ga,(J|0)<9?J:9);U=U+4|0;F=J+-9|0;if(!(U>>>0<ta>>>0&(J|0)>9)){Ha=F;break}else J=F}}else Ha=za;Ld(b,48,Ha+9|0,9,0)}else{J=ua?ta:sa+4|0;if(sa>>>0<J>>>0&(za|0)>-1){U=m+9|0;V=(h&8|0)==0;u=U;H=0-n|0;F=m+8|0;T=za;M=sa;while(1){B=Jd(c[M>>2]|0,0,U)|0;if((B|0)==(U|0)){a[F>>0]=48;Ia=F}else Ia=B;do if((M|0)==(sa|0)){B=Ia+1|0;Ed(b,Ia,1);if(V&(T|0)<1){Ja=B;break}Ed(b,6150,1);Ja=B}else{if(Ia>>>0<=m>>>0){Ja=Ia;break}Rf(m|0,48,Ia+H|0)|0;B=Ia;while(1){L=B+-1|0;if(L>>>0>m>>>0)B=L;else{Ja=L;break}}}while(0);q=u-Ja|0;Ed(b,Ja,(T|0)>(q|0)?q:T);B=T-q|0;M=M+4|0;if(!(M>>>0<J>>>0&(B|0)>-1)){Ka=B;break}else T=B}}else Ka=za;Ld(b,48,Ka+18|0,18,0);Ed(b,Aa,p-Aa|0)}Ld(b,32,f,D,h^8192);C=D}while(0);Ea=j;return ((C|0)<(f|0)?f:C)|0}function Od(a){a=+a;var b=0;g[h>>3]=a;b=c[h>>2]|0;w(c[h+4>>2]|0);return b|0}function Pd(a,b){a=+a;b=b|0;return +(+Qd(a,b))}function Qd(a,b){a=+a;b=b|0;var d=0,e=0,f=0,i=0.0,j=0.0,k=0,l=0.0;g[h>>3]=a;d=c[h>>2]|0;e=c[h+4>>2]|0;f=Nf(d|0,e|0,52)|0;x()|0;switch(f&2047){case 0:{if(a!=0.0){i=+Qd(a*18446744073709551616.0,b);j=i;k=(c[b>>2]|0)+-64|0}else{j=a;k=0}c[b>>2]=k;l=j;break}case 2047:{l=a;break}default:{c[b>>2]=(f&2047)+-1022;c[h>>2]=d;c[h+4>>2]=e&-2146435073|1071644672;l=+g[h>>3]}}return +l}function Rd(b,d,e){b=b|0;d=d|0;e=e|0;var f=0;do if(b){if(d>>>0<128){a[b>>0]=d;f=1;break}if(!(c[c[(Sd()|0)+188>>2]>>2]|0))if((d&-128|0)==57216){a[b>>0]=d;f=1;break}else{c[(gd()|0)>>2]=84;f=-1;break}if(d>>>0<2048){a[b>>0]=d>>>6|192;a[b+1>>0]=d&63|128;f=2;break}if(d>>>0<55296|(d&-8192|0)==57344){a[b>>0]=d>>>12|224;a[b+1>>0]=d>>>6&63|128;a[b+2>>0]=d&63|128;f=3;break}if((d+-65536|0)>>>0<1048576){a[b>>0]=d>>>18|240;a[b+1>>0]=d>>>12&63|128;a[b+2>>0]=d>>>6&63|128;a[b+3>>0]=d&63|128;f=4;break}else{c[(gd()|0)>>2]=84;f=-1;break}}else f=1;while(0);return f|0}function Sd(){return kd()|0}function Td(){return kd()|0}function Ud(b,e){b=b|0;e=e|0;var f=0,g=0,h=0,i=0,j=0;f=0;while(1){if((d[496+f>>0]|0)==(b|0)){g=4;break}h=f+1|0;if((h|0)==87){i=87;g=5;break}else f=h}if((g|0)==4)if(!f)j=592;else{i=f;g=5}if((g|0)==5){g=592;f=i;while(1){i=g;do{b=i;i=i+1|0}while((a[b>>0]|0)!=0);f=f+-1|0;if(!f){j=i;break}else g=i}}return Vd(j,c[e+20>>2]|0)|0}function Vd(a,b){a=a|0;b=b|0;return ud(a,b)|0}function Wd(b,c,d){b=b|0;c=c|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0;a:do if(!d)e=0;else{f=b;g=d;h=c;while(1){i=a[f>>0]|0;j=a[h>>0]|0;if(i<<24>>24!=j<<24>>24)break;g=g+-1|0;if(!g){e=0;break a}else{f=f+1|0;h=h+1|0}}e=(i&255)-(j&255)|0}while(0);return e|0}function Xd(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0;e=Ea;Ea=Ea+48|0;if((Ea|0)>=(Fa|0))y(48);f=e+32|0;g=e+16|0;h=e;if(!(b&4194368))i=0;else{c[h>>2]=d;d=(c[h>>2]|0)+(4-1)&~(4-1);j=c[d>>2]|0;c[h>>2]=d+4;i=j}c[g>>2]=a;c[g+4>>2]=b|32768;c[g+8>>2]=i;i=ma(5,g|0)|0;if(!((b&524288|0)==0|(i|0)<0)){c[f>>2]=i;c[f+4>>2]=2;c[f+8>>2]=1;ka(221,f|0)|0}f=fd(i)|0;Ea=e;return f|0}function Yd(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0;f=Ea;Ea=Ea+16|0;if((Ea|0)>=(Fa|0))y(16);g=f;c[g>>2]=e;e=Zd(a,b,d,g)|0;Ea=f;return e|0}function Zd(b,d,e,f){b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0;g=Ea;Ea=Ea+128|0;if((Ea|0)>=(Fa|0))y(128);h=g+124|0;i=g;j=i;k=4076;l=j+124|0;do{c[j>>2]=c[k>>2];j=j+4|0;k=k+4|0}while((j|0)<(l|0));if((d+-1|0)>>>0>2147483646)if(!d){m=h;n=1;o=4}else{c[(gd()|0)>>2]=75;p=-1}else{m=b;n=d;o=4}if((o|0)==4){o=-2-m|0;d=n>>>0>o>>>0?o:n;c[i+48>>2]=d;n=i+20|0;c[n>>2]=m;c[i+44>>2]=m;o=m+d|0;m=i+16|0;c[m>>2]=o;c[i+28>>2]=o;o=Cd(i,e,f)|0;if(!d)p=o;else{d=c[n>>2]|0;a[d+(((d|0)==(c[m>>2]|0))<<31>>31)>>0]=0;p=o}}Ea=g;return p|0}function _d(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0;e=a+20|0;f=c[e>>2]|0;g=(c[a+16>>2]|0)-f|0;a=g>>>0>d>>>0?d:g;Qf(f|0,b|0,a|0)|0;c[e>>2]=(c[e>>2]|0)+a;return d|0}function $d(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0;e=Ea;Ea=Ea+16|0;if((Ea|0)>=(Fa|0))y(16);f=e;c[f>>2]=a;c[f+4>>2]=b;c[f+8>>2]=d;d=fd(la(3,f|0)|0)|0;Ea=e;return d|0}function ae(a,b){a=a|0;b=b|0;var d=0,e=0;d=Ea;Ea=Ea+16|0;if((Ea|0)>=(Fa|0))y(16);e=d;c[e>>2]=b;b=Cd(c[925]|0,a,e)|0;Ea=d;return b|0}function be(b,d){b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0;if((c[d+76>>2]|0)>=0?(qd(d)|0)!=0:0){e=b&255;f=b&255;if((f|0)!=(a[d+75>>0]|0)?(g=d+20|0,h=c[g>>2]|0,h>>>0<(c[d+16>>2]|0)>>>0):0){c[g>>2]=h+1;a[h>>0]=e;i=f}else i=rd(d,b)|0;pd(d);j=i}else k=3;do if((k|0)==3){i=b&255;f=b&255;if((f|0)!=(a[d+75>>0]|0)?(e=d+20|0,h=c[e>>2]|0,h>>>0<(c[d+16>>2]|0)>>>0):0){c[e>>2]=h+1;a[h>>0]=i;j=f;break}j=rd(d,b)|0}while(0);return j|0}function ce(b){b=b|0;var d=0,e=0,f=0,g=0,h=0;d=c[925]|0;if((c[d+76>>2]|0)>-1)e=qd(d)|0;else e=0;do if((nd(b,d)|0)<0)f=-1;else{if((a[d+75>>0]|0)!=10?(g=d+20|0,h=c[g>>2]|0,h>>>0<(c[d+16>>2]|0)>>>0):0){c[g>>2]=h+1;a[h>>0]=10;f=0;break}f=(rd(d,10)|0)>>31}while(0);if(e|0)pd(d);return f|0}function de(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ba=0,ca=0,da=0,ea=0,fa=0,ga=0,ha=0,ia=0,ja=0,ka=0,la=0,ma=0,na=0,oa=0,pa=0,qa=0,ra=0,sa=0,ta=0,ua=0,va=0,wa=0,xa=0,ya=0,za=0,Aa=0,Ba=0,Ca=0,Da=0,Ga=0,Ha=0,Ia=0,Ja=0,Ka=0,La=0;b=Ea;Ea=Ea+16|0;if((Ea|0)>=(Fa|0))y(16);d=b;do if(a>>>0<245){e=a>>>0<11?16:a+11&-8;f=e>>>3;g=c[2663]|0;h=g>>>f;if(h&3|0){i=(h&1^1)+f|0;j=10692+(i<<1<<2)|0;k=j+8|0;l=c[k>>2]|0;m=l+8|0;n=c[m>>2]|0;if((n|0)==(j|0))c[2663]=g&~(1<<i);else{c[n+12>>2]=j;c[k>>2]=n}n=i<<3;c[l+4>>2]=n|3;i=l+n+4|0;c[i>>2]=c[i>>2]|1;o=m;Ea=b;return o|0}m=c[2665]|0;if(e>>>0>m>>>0){if(h|0){i=2<<f;n=h<<f&(i|0-i);i=(n&0-n)+-1|0;n=i>>>12&16;f=i>>>n;i=f>>>5&8;h=f>>>i;f=h>>>2&4;l=h>>>f;h=l>>>1&2;k=l>>>h;l=k>>>1&1;j=(i|n|f|h|l)+(k>>>l)|0;l=10692+(j<<1<<2)|0;k=l+8|0;h=c[k>>2]|0;f=h+8|0;n=c[f>>2]|0;if((n|0)==(l|0)){i=g&~(1<<j);c[2663]=i;p=i}else{c[n+12>>2]=l;c[k>>2]=n;p=g}n=j<<3;j=n-e|0;c[h+4>>2]=e|3;k=h+e|0;c[k+4>>2]=j|1;c[h+n>>2]=j;if(m|0){n=c[2668]|0;h=m>>>3;l=10692+(h<<1<<2)|0;i=1<<h;if(!(p&i)){c[2663]=p|i;q=l;r=l+8|0}else{i=l+8|0;q=c[i>>2]|0;r=i}c[r>>2]=n;c[q+12>>2]=n;c[n+8>>2]=q;c[n+12>>2]=l}c[2665]=j;c[2668]=k;o=f;Ea=b;return o|0}f=c[2664]|0;if(f){k=(f&0-f)+-1|0;j=k>>>12&16;l=k>>>j;k=l>>>5&8;n=l>>>k;l=n>>>2&4;i=n>>>l;n=i>>>1&2;h=i>>>n;i=h>>>1&1;s=c[10956+((k|j|l|n|i)+(h>>>i)<<2)>>2]|0;i=s;h=s;n=(c[s+4>>2]&-8)-e|0;while(1){s=c[i+16>>2]|0;if(!s){l=c[i+20>>2]|0;if(!l)break;else t=l}else t=s;s=(c[t+4>>2]&-8)-e|0;l=s>>>0<n>>>0;i=t;h=l?t:h;n=l?s:n}i=h+e|0;if(i>>>0>h>>>0){s=c[h+24>>2]|0;l=c[h+12>>2]|0;do if((l|0)==(h|0)){j=h+20|0;k=c[j>>2]|0;if(!k){u=h+16|0;v=c[u>>2]|0;if(!v){w=0;break}else{x=v;z=u}}else{x=k;z=j}j=x;k=z;while(1){u=j+20|0;v=c[u>>2]|0;if(!v){A=j+16|0;B=c[A>>2]|0;if(!B)break;else{C=B;D=A}}else{C=v;D=u}j=C;k=D}c[k>>2]=0;w=j}else{u=c[h+8>>2]|0;c[u+12>>2]=l;c[l+8>>2]=u;w=l}while(0);do if(s|0){l=c[h+28>>2]|0;u=10956+(l<<2)|0;if((h|0)==(c[u>>2]|0)){c[u>>2]=w;if(!w){c[2664]=f&~(1<<l);break}}else{l=s+16|0;c[((c[l>>2]|0)==(h|0)?l:s+20|0)>>2]=w;if(!w)break}c[w+24>>2]=s;l=c[h+16>>2]|0;if(l|0){c[w+16>>2]=l;c[l+24>>2]=w}l=c[h+20>>2]|0;if(l|0){c[w+20>>2]=l;c[l+24>>2]=w}}while(0);if(n>>>0<16){s=n+e|0;c[h+4>>2]=s|3;f=h+s+4|0;c[f>>2]=c[f>>2]|1}else{c[h+4>>2]=e|3;c[i+4>>2]=n|1;c[i+n>>2]=n;if(m|0){f=c[2668]|0;s=m>>>3;l=10692+(s<<1<<2)|0;u=1<<s;if(!(u&g)){c[2663]=u|g;E=l;F=l+8|0}else{u=l+8|0;E=c[u>>2]|0;F=u}c[F>>2]=f;c[E+12>>2]=f;c[f+8>>2]=E;c[f+12>>2]=l}c[2665]=n;c[2668]=i}o=h+8|0;Ea=b;return o|0}else G=e}else G=e}else G=e}else if(a>>>0<=4294967231){l=a+11|0;f=l&-8;u=c[2664]|0;if(u){s=0-f|0;v=l>>>8;if(v)if(f>>>0>16777215)H=31;else{l=(v+1048320|0)>>>16&8;A=v<<l;v=(A+520192|0)>>>16&4;B=A<<v;A=(B+245760|0)>>>16&2;I=14-(v|l|A)+(B<<A>>>15)|0;H=f>>>(I+7|0)&1|I<<1}else H=0;I=c[10956+(H<<2)>>2]|0;a:do if(!I){J=0;K=0;L=s;M=61}else{A=0;B=s;l=I;v=f<<((H|0)==31?0:25-(H>>>1)|0);N=0;while(1){O=(c[l+4>>2]&-8)-f|0;if(O>>>0<B>>>0)if(!O){P=l;Q=0;R=l;M=65;break a}else{S=l;T=O}else{S=A;T=B}O=c[l+20>>2]|0;l=c[l+16+(v>>>31<<2)>>2]|0;U=(O|0)==0|(O|0)==(l|0)?N:O;if(!l){J=U;K=S;L=T;M=61;break}else{A=S;B=T;v=v<<1;N=U}}}while(0);if((M|0)==61){if((J|0)==0&(K|0)==0){I=2<<H;s=(I|0-I)&u;if(!s){G=f;break}I=(s&0-s)+-1|0;s=I>>>12&16;e=I>>>s;I=e>>>5&8;h=e>>>I;e=h>>>2&4;i=h>>>e;h=i>>>1&2;n=i>>>h;i=n>>>1&1;V=0;W=c[10956+((I|s|e|h|i)+(n>>>i)<<2)>>2]|0}else{V=K;W=J}if(!W){X=V;Y=L}else{P=V;Q=L;R=W;M=65}}if((M|0)==65){i=P;n=Q;h=R;while(1){e=(c[h+4>>2]&-8)-f|0;s=e>>>0<n>>>0;I=s?e:n;e=s?h:i;s=c[h+16>>2]|0;if(!s)Z=c[h+20>>2]|0;else Z=s;if(!Z){X=e;Y=I;break}else{i=e;n=I;h=Z}}}if(((X|0)!=0?Y>>>0<((c[2665]|0)-f|0)>>>0:0)?(h=X+f|0,h>>>0>X>>>0):0){n=c[X+24>>2]|0;i=c[X+12>>2]|0;do if((i|0)==(X|0)){I=X+20|0;e=c[I>>2]|0;if(!e){s=X+16|0;g=c[s>>2]|0;if(!g){_=0;break}else{$=g;aa=s}}else{$=e;aa=I}I=$;e=aa;while(1){s=I+20|0;g=c[s>>2]|0;if(!g){m=I+16|0;N=c[m>>2]|0;if(!N)break;else{ba=N;ca=m}}else{ba=g;ca=s}I=ba;e=ca}c[e>>2]=0;_=I}else{s=c[X+8>>2]|0;c[s+12>>2]=i;c[i+8>>2]=s;_=i}while(0);do if(n){i=c[X+28>>2]|0;s=10956+(i<<2)|0;if((X|0)==(c[s>>2]|0)){c[s>>2]=_;if(!_){s=u&~(1<<i);c[2664]=s;da=s;break}}else{s=n+16|0;c[((c[s>>2]|0)==(X|0)?s:n+20|0)>>2]=_;if(!_){da=u;break}}c[_+24>>2]=n;s=c[X+16>>2]|0;if(s|0){c[_+16>>2]=s;c[s+24>>2]=_}s=c[X+20>>2]|0;if(s){c[_+20>>2]=s;c[s+24>>2]=_;da=u}else da=u}else da=u;while(0);b:do if(Y>>>0<16){u=Y+f|0;c[X+4>>2]=u|3;n=X+u+4|0;c[n>>2]=c[n>>2]|1}else{c[X+4>>2]=f|3;c[h+4>>2]=Y|1;c[h+Y>>2]=Y;n=Y>>>3;if(Y>>>0<256){u=10692+(n<<1<<2)|0;s=c[2663]|0;i=1<<n;if(!(s&i)){c[2663]=s|i;ea=u;fa=u+8|0}else{i=u+8|0;ea=c[i>>2]|0;fa=i}c[fa>>2]=h;c[ea+12>>2]=h;c[h+8>>2]=ea;c[h+12>>2]=u;break}u=Y>>>8;if(u)if(Y>>>0>16777215)ga=31;else{i=(u+1048320|0)>>>16&8;s=u<<i;u=(s+520192|0)>>>16&4;n=s<<u;s=(n+245760|0)>>>16&2;g=14-(u|i|s)+(n<<s>>>15)|0;ga=Y>>>(g+7|0)&1|g<<1}else ga=0;g=10956+(ga<<2)|0;c[h+28>>2]=ga;s=h+16|0;c[s+4>>2]=0;c[s>>2]=0;s=1<<ga;if(!(da&s)){c[2664]=da|s;c[g>>2]=h;c[h+24>>2]=g;c[h+12>>2]=h;c[h+8>>2]=h;break}s=c[g>>2]|0;c:do if((c[s+4>>2]&-8|0)==(Y|0))ha=s;else{g=Y<<((ga|0)==31?0:25-(ga>>>1)|0);n=s;while(1){ia=n+16+(g>>>31<<2)|0;i=c[ia>>2]|0;if(!i)break;if((c[i+4>>2]&-8|0)==(Y|0)){ha=i;break c}else{g=g<<1;n=i}}c[ia>>2]=h;c[h+24>>2]=n;c[h+12>>2]=h;c[h+8>>2]=h;break b}while(0);s=ha+8|0;I=c[s>>2]|0;c[I+12>>2]=h;c[s>>2]=h;c[h+8>>2]=I;c[h+12>>2]=ha;c[h+24>>2]=0}while(0);o=X+8|0;Ea=b;return o|0}else G=f}else G=f}else G=-1;while(0);X=c[2665]|0;if(X>>>0>=G>>>0){ha=X-G|0;ia=c[2668]|0;if(ha>>>0>15){Y=ia+G|0;c[2668]=Y;c[2665]=ha;c[Y+4>>2]=ha|1;c[ia+X>>2]=ha;c[ia+4>>2]=G|3}else{c[2665]=0;c[2668]=0;c[ia+4>>2]=X|3;ha=ia+X+4|0;c[ha>>2]=c[ha>>2]|1}o=ia+8|0;Ea=b;return o|0}ia=c[2666]|0;if(ia>>>0>G>>>0){ha=ia-G|0;c[2666]=ha;X=c[2669]|0;Y=X+G|0;c[2669]=Y;c[Y+4>>2]=ha|1;c[X+4>>2]=G|3;o=X+8|0;Ea=b;return o|0}if(!(c[2781]|0)){c[2783]=4096;c[2782]=4096;c[2784]=-1;c[2785]=-1;c[2786]=0;c[2774]=0;c[2781]=d&-16^1431655768;ja=4096}else ja=c[2783]|0;d=G+48|0;X=G+47|0;ha=ja+X|0;Y=0-ja|0;ja=ha&Y;if(ja>>>0<=G>>>0){o=0;Ea=b;return o|0}ga=c[2773]|0;if(ga|0?(da=c[2771]|0,ea=da+ja|0,ea>>>0<=da>>>0|ea>>>0>ga>>>0):0){o=0;Ea=b;return o|0}d:do if(!(c[2774]&4)){ga=c[2669]|0;e:do if(ga){ea=11100;while(1){da=c[ea>>2]|0;if(da>>>0<=ga>>>0?(da+(c[ea+4>>2]|0)|0)>>>0>ga>>>0:0)break;da=c[ea+8>>2]|0;if(!da){M=128;break e}else ea=da}da=ha-ia&Y;if(da>>>0<2147483647){fa=Sf(da|0)|0;if((fa|0)==((c[ea>>2]|0)+(c[ea+4>>2]|0)|0))if((fa|0)==(-1|0))ka=da;else{la=da;ma=fa;M=145;break d}else{na=fa;oa=da;M=136}}else ka=0}else M=128;while(0);do if((M|0)==128){ga=Sf(0)|0;if((ga|0)!=(-1|0)?(f=ga,da=c[2782]|0,fa=da+-1|0,_=((fa&f|0)==0?0:(fa+f&0-da)-f|0)+ja|0,f=c[2771]|0,da=_+f|0,_>>>0>G>>>0&_>>>0<2147483647):0){fa=c[2773]|0;if(fa|0?da>>>0<=f>>>0|da>>>0>fa>>>0:0){ka=0;break}fa=Sf(_|0)|0;if((fa|0)==(ga|0)){la=_;ma=ga;M=145;break d}else{na=fa;oa=_;M=136}}else ka=0}while(0);do if((M|0)==136){_=0-oa|0;if(!(d>>>0>oa>>>0&(oa>>>0<2147483647&(na|0)!=(-1|0))))if((na|0)==(-1|0)){ka=0;break}else{la=oa;ma=na;M=145;break d}fa=c[2783]|0;ga=X-oa+fa&0-fa;if(ga>>>0>=2147483647){la=oa;ma=na;M=145;break d}if((Sf(ga|0)|0)==(-1|0)){Sf(_|0)|0;ka=0;break}else{la=ga+oa|0;ma=na;M=145;break d}}while(0);c[2774]=c[2774]|4;pa=ka;M=143}else{pa=0;M=143}while(0);if(((M|0)==143?ja>>>0<2147483647:0)?(ka=Sf(ja|0)|0,ja=Sf(0)|0,na=ja-ka|0,oa=na>>>0>(G+40|0)>>>0,!((ka|0)==(-1|0)|oa^1|ka>>>0<ja>>>0&((ka|0)!=(-1|0)&(ja|0)!=(-1|0))^1)):0){la=oa?na:pa;ma=ka;M=145}if((M|0)==145){ka=(c[2771]|0)+la|0;c[2771]=ka;if(ka>>>0>(c[2772]|0)>>>0)c[2772]=ka;ka=c[2669]|0;f:do if(ka){pa=11100;while(1){qa=c[pa>>2]|0;ra=c[pa+4>>2]|0;if((ma|0)==(qa+ra|0)){M=154;break}na=c[pa+8>>2]|0;if(!na)break;else pa=na}if(((M|0)==154?(na=pa+4|0,(c[pa+12>>2]&8|0)==0):0)?ma>>>0>ka>>>0&qa>>>0<=ka>>>0:0){c[na>>2]=ra+la;na=(c[2666]|0)+la|0;oa=ka+8|0;ja=(oa&7|0)==0?0:0-oa&7;oa=ka+ja|0;X=na-ja|0;c[2669]=oa;c[2666]=X;c[oa+4>>2]=X|1;c[ka+na+4>>2]=40;c[2670]=c[2785];break}if(ma>>>0<(c[2667]|0)>>>0)c[2667]=ma;na=ma+la|0;X=11100;while(1){if((c[X>>2]|0)==(na|0)){M=162;break}oa=c[X+8>>2]|0;if(!oa)break;else X=oa}if((M|0)==162?(c[X+12>>2]&8|0)==0:0){c[X>>2]=ma;pa=X+4|0;c[pa>>2]=(c[pa>>2]|0)+la;pa=ma+8|0;oa=ma+((pa&7|0)==0?0:0-pa&7)|0;pa=na+8|0;ja=na+((pa&7|0)==0?0:0-pa&7)|0;pa=oa+G|0;d=ja-oa-G|0;c[oa+4>>2]=G|3;g:do if((ka|0)==(ja|0)){Y=(c[2666]|0)+d|0;c[2666]=Y;c[2669]=pa;c[pa+4>>2]=Y|1}else{if((c[2668]|0)==(ja|0)){Y=(c[2665]|0)+d|0;c[2665]=Y;c[2668]=pa;c[pa+4>>2]=Y|1;c[pa+Y>>2]=Y;break}Y=c[ja+4>>2]|0;if((Y&3|0)==1){ia=Y&-8;ha=Y>>>3;h:do if(Y>>>0<256){ga=c[ja+8>>2]|0;_=c[ja+12>>2]|0;if((_|0)==(ga|0)){c[2663]=c[2663]&~(1<<ha);break}else{c[ga+12>>2]=_;c[_+8>>2]=ga;break}}else{ga=c[ja+24>>2]|0;_=c[ja+12>>2]|0;do if((_|0)==(ja|0)){fa=ja+16|0;da=fa+4|0;f=c[da>>2]|0;if(!f){ca=c[fa>>2]|0;if(!ca){sa=0;break}else{ta=ca;ua=fa}}else{ta=f;ua=da}da=ta;f=ua;while(1){fa=da+20|0;ca=c[fa>>2]|0;if(!ca){ba=da+16|0;aa=c[ba>>2]|0;if(!aa)break;else{va=aa;wa=ba}}else{va=ca;wa=fa}da=va;f=wa}c[f>>2]=0;sa=da}else{fa=c[ja+8>>2]|0;c[fa+12>>2]=_;c[_+8>>2]=fa;sa=_}while(0);if(!ga)break;_=c[ja+28>>2]|0;n=10956+(_<<2)|0;do if((c[n>>2]|0)!=(ja|0)){fa=ga+16|0;c[((c[fa>>2]|0)==(ja|0)?fa:ga+20|0)>>2]=sa;if(!sa)break h}else{c[n>>2]=sa;if(sa|0)break;c[2664]=c[2664]&~(1<<_);break h}while(0);c[sa+24>>2]=ga;_=ja+16|0;n=c[_>>2]|0;if(n|0){c[sa+16>>2]=n;c[n+24>>2]=sa}n=c[_+4>>2]|0;if(!n)break;c[sa+20>>2]=n;c[n+24>>2]=sa}while(0);xa=ja+ia|0;ya=ia+d|0}else{xa=ja;ya=d}ha=xa+4|0;c[ha>>2]=c[ha>>2]&-2;c[pa+4>>2]=ya|1;c[pa+ya>>2]=ya;ha=ya>>>3;if(ya>>>0<256){Y=10692+(ha<<1<<2)|0;ea=c[2663]|0;n=1<<ha;if(!(ea&n)){c[2663]=ea|n;za=Y;Aa=Y+8|0}else{n=Y+8|0;za=c[n>>2]|0;Aa=n}c[Aa>>2]=pa;c[za+12>>2]=pa;c[pa+8>>2]=za;c[pa+12>>2]=Y;break}Y=ya>>>8;do if(!Y)Ba=0;else{if(ya>>>0>16777215){Ba=31;break}n=(Y+1048320|0)>>>16&8;ea=Y<<n;ha=(ea+520192|0)>>>16&4;_=ea<<ha;ea=(_+245760|0)>>>16&2;fa=14-(ha|n|ea)+(_<<ea>>>15)|0;Ba=ya>>>(fa+7|0)&1|fa<<1}while(0);Y=10956+(Ba<<2)|0;c[pa+28>>2]=Ba;ia=pa+16|0;c[ia+4>>2]=0;c[ia>>2]=0;ia=c[2664]|0;fa=1<<Ba;if(!(ia&fa)){c[2664]=ia|fa;c[Y>>2]=pa;c[pa+24>>2]=Y;c[pa+12>>2]=pa;c[pa+8>>2]=pa;break}fa=c[Y>>2]|0;i:do if((c[fa+4>>2]&-8|0)==(ya|0))Ca=fa;else{Y=ya<<((Ba|0)==31?0:25-(Ba>>>1)|0);ia=fa;while(1){Da=ia+16+(Y>>>31<<2)|0;ea=c[Da>>2]|0;if(!ea)break;if((c[ea+4>>2]&-8|0)==(ya|0)){Ca=ea;break i}else{Y=Y<<1;ia=ea}}c[Da>>2]=pa;c[pa+24>>2]=ia;c[pa+12>>2]=pa;c[pa+8>>2]=pa;break g}while(0);fa=Ca+8|0;Y=c[fa>>2]|0;c[Y+12>>2]=pa;c[fa>>2]=pa;c[pa+8>>2]=Y;c[pa+12>>2]=Ca;c[pa+24>>2]=0}while(0);o=oa+8|0;Ea=b;return o|0}pa=11100;while(1){d=c[pa>>2]|0;if(d>>>0<=ka>>>0?(Ga=d+(c[pa+4>>2]|0)|0,Ga>>>0>ka>>>0):0)break;pa=c[pa+8>>2]|0}pa=Ga+-47|0;oa=pa+8|0;d=pa+((oa&7|0)==0?0:0-oa&7)|0;oa=ka+16|0;pa=d>>>0<oa>>>0?ka:d;d=pa+8|0;ja=la+-40|0;na=ma+8|0;X=(na&7|0)==0?0:0-na&7;na=ma+X|0;Y=ja-X|0;c[2669]=na;c[2666]=Y;c[na+4>>2]=Y|1;c[ma+ja+4>>2]=40;c[2670]=c[2785];ja=pa+4|0;c[ja>>2]=27;c[d>>2]=c[2775];c[d+4>>2]=c[2776];c[d+8>>2]=c[2777];c[d+12>>2]=c[2778];c[2775]=ma;c[2776]=la;c[2778]=0;c[2777]=d;d=pa+24|0;do{Y=d;d=d+4|0;c[d>>2]=7}while((Y+8|0)>>>0<Ga>>>0);if((pa|0)!=(ka|0)){d=pa-ka|0;c[ja>>2]=c[ja>>2]&-2;c[ka+4>>2]=d|1;c[pa>>2]=d;Y=d>>>3;if(d>>>0<256){na=10692+(Y<<1<<2)|0;X=c[2663]|0;fa=1<<Y;if(!(X&fa)){c[2663]=X|fa;Ha=na;Ia=na+8|0}else{fa=na+8|0;Ha=c[fa>>2]|0;Ia=fa}c[Ia>>2]=ka;c[Ha+12>>2]=ka;c[ka+8>>2]=Ha;c[ka+12>>2]=na;break}na=d>>>8;if(na)if(d>>>0>16777215)Ja=31;else{fa=(na+1048320|0)>>>16&8;X=na<<fa;na=(X+520192|0)>>>16&4;Y=X<<na;X=(Y+245760|0)>>>16&2;ga=14-(na|fa|X)+(Y<<X>>>15)|0;Ja=d>>>(ga+7|0)&1|ga<<1}else Ja=0;ga=10956+(Ja<<2)|0;c[ka+28>>2]=Ja;c[ka+20>>2]=0;c[oa>>2]=0;X=c[2664]|0;Y=1<<Ja;if(!(X&Y)){c[2664]=X|Y;c[ga>>2]=ka;c[ka+24>>2]=ga;c[ka+12>>2]=ka;c[ka+8>>2]=ka;break}Y=c[ga>>2]|0;j:do if((c[Y+4>>2]&-8|0)==(d|0))Ka=Y;else{ga=d<<((Ja|0)==31?0:25-(Ja>>>1)|0);X=Y;while(1){La=X+16+(ga>>>31<<2)|0;fa=c[La>>2]|0;if(!fa)break;if((c[fa+4>>2]&-8|0)==(d|0)){Ka=fa;break j}else{ga=ga<<1;X=fa}}c[La>>2]=ka;c[ka+24>>2]=X;c[ka+12>>2]=ka;c[ka+8>>2]=ka;break f}while(0);d=Ka+8|0;Y=c[d>>2]|0;c[Y+12>>2]=ka;c[d>>2]=ka;c[ka+8>>2]=Y;c[ka+12>>2]=Ka;c[ka+24>>2]=0}}else{Y=c[2667]|0;if((Y|0)==0|ma>>>0<Y>>>0)c[2667]=ma;c[2775]=ma;c[2776]=la;c[2778]=0;c[2672]=c[2781];c[2671]=-1;c[2676]=10692;c[2675]=10692;c[2678]=10700;c[2677]=10700;c[2680]=10708;c[2679]=10708;c[2682]=10716;c[2681]=10716;c[2684]=10724;c[2683]=10724;c[2686]=10732;c[2685]=10732;c[2688]=10740;c[2687]=10740;c[2690]=10748;c[2689]=10748;c[2692]=10756;c[2691]=10756;c[2694]=10764;c[2693]=10764;c[2696]=10772;c[2695]=10772;c[2698]=10780;c[2697]=10780;c[2700]=10788;c[2699]=10788;c[2702]=10796;c[2701]=10796;c[2704]=10804;c[2703]=10804;c[2706]=10812;c[2705]=10812;c[2708]=10820;c[2707]=10820;c[2710]=10828;c[2709]=10828;c[2712]=10836;c[2711]=10836;c[2714]=10844;c[2713]=10844;c[2716]=10852;c[2715]=10852;c[2718]=10860;c[2717]=10860;c[2720]=10868;c[2719]=10868;c[2722]=10876;c[2721]=10876;c[2724]=10884;c[2723]=10884;c[2726]=10892;c[2725]=10892;c[2728]=10900;c[2727]=10900;c[2730]=10908;c[2729]=10908;c[2732]=10916;c[2731]=10916;c[2734]=10924;c[2733]=10924;c[2736]=10932;c[2735]=10932;c[2738]=10940;c[2737]=10940;Y=la+-40|0;d=ma+8|0;oa=(d&7|0)==0?0:0-d&7;d=ma+oa|0;pa=Y-oa|0;c[2669]=d;c[2666]=pa;c[d+4>>2]=pa|1;c[ma+Y+4>>2]=40;c[2670]=c[2785]}while(0);ma=c[2666]|0;if(ma>>>0>G>>>0){la=ma-G|0;c[2666]=la;ma=c[2669]|0;ka=ma+G|0;c[2669]=ka;c[ka+4>>2]=la|1;c[ma+4>>2]=G|3;o=ma+8|0;Ea=b;return o|0}}c[(gd()|0)>>2]=12;o=0;Ea=b;return o|0}function ee(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0;if(!a)return;b=a+-8|0;d=c[2667]|0;e=c[a+-4>>2]|0;a=e&-8;f=b+a|0;do if(!(e&1)){g=c[b>>2]|0;if(!(e&3))return;h=b+(0-g)|0;i=g+a|0;if(h>>>0<d>>>0)return;if((c[2668]|0)==(h|0)){j=f+4|0;k=c[j>>2]|0;if((k&3|0)!=3){l=h;m=i;n=h;break}c[2665]=i;c[j>>2]=k&-2;c[h+4>>2]=i|1;c[h+i>>2]=i;return}k=g>>>3;if(g>>>0<256){g=c[h+8>>2]|0;j=c[h+12>>2]|0;if((j|0)==(g|0)){c[2663]=c[2663]&~(1<<k);l=h;m=i;n=h;break}else{c[g+12>>2]=j;c[j+8>>2]=g;l=h;m=i;n=h;break}}g=c[h+24>>2]|0;j=c[h+12>>2]|0;do if((j|0)==(h|0)){k=h+16|0;o=k+4|0;p=c[o>>2]|0;if(!p){q=c[k>>2]|0;if(!q){r=0;break}else{s=q;t=k}}else{s=p;t=o}o=s;p=t;while(1){k=o+20|0;q=c[k>>2]|0;if(!q){u=o+16|0;v=c[u>>2]|0;if(!v)break;else{w=v;x=u}}else{w=q;x=k}o=w;p=x}c[p>>2]=0;r=o}else{k=c[h+8>>2]|0;c[k+12>>2]=j;c[j+8>>2]=k;r=j}while(0);if(g){j=c[h+28>>2]|0;k=10956+(j<<2)|0;if((c[k>>2]|0)==(h|0)){c[k>>2]=r;if(!r){c[2664]=c[2664]&~(1<<j);l=h;m=i;n=h;break}}else{j=g+16|0;c[((c[j>>2]|0)==(h|0)?j:g+20|0)>>2]=r;if(!r){l=h;m=i;n=h;break}}c[r+24>>2]=g;j=h+16|0;k=c[j>>2]|0;if(k|0){c[r+16>>2]=k;c[k+24>>2]=r}k=c[j+4>>2]|0;if(k){c[r+20>>2]=k;c[k+24>>2]=r;l=h;m=i;n=h}else{l=h;m=i;n=h}}else{l=h;m=i;n=h}}else{l=b;m=a;n=b}while(0);if(n>>>0>=f>>>0)return;b=f+4|0;a=c[b>>2]|0;if(!(a&1))return;if(!(a&2)){if((c[2669]|0)==(f|0)){r=(c[2666]|0)+m|0;c[2666]=r;c[2669]=l;c[l+4>>2]=r|1;if((l|0)!=(c[2668]|0))return;c[2668]=0;c[2665]=0;return}if((c[2668]|0)==(f|0)){r=(c[2665]|0)+m|0;c[2665]=r;c[2668]=n;c[l+4>>2]=r|1;c[n+r>>2]=r;return}r=(a&-8)+m|0;x=a>>>3;do if(a>>>0<256){w=c[f+8>>2]|0;t=c[f+12>>2]|0;if((t|0)==(w|0)){c[2663]=c[2663]&~(1<<x);break}else{c[w+12>>2]=t;c[t+8>>2]=w;break}}else{w=c[f+24>>2]|0;t=c[f+12>>2]|0;do if((t|0)==(f|0)){s=f+16|0;d=s+4|0;e=c[d>>2]|0;if(!e){k=c[s>>2]|0;if(!k){y=0;break}else{z=k;A=s}}else{z=e;A=d}d=z;e=A;while(1){s=d+20|0;k=c[s>>2]|0;if(!k){j=d+16|0;q=c[j>>2]|0;if(!q)break;else{B=q;C=j}}else{B=k;C=s}d=B;e=C}c[e>>2]=0;y=d}else{o=c[f+8>>2]|0;c[o+12>>2]=t;c[t+8>>2]=o;y=t}while(0);if(w|0){t=c[f+28>>2]|0;h=10956+(t<<2)|0;if((c[h>>2]|0)==(f|0)){c[h>>2]=y;if(!y){c[2664]=c[2664]&~(1<<t);break}}else{t=w+16|0;c[((c[t>>2]|0)==(f|0)?t:w+20|0)>>2]=y;if(!y)break}c[y+24>>2]=w;t=f+16|0;h=c[t>>2]|0;if(h|0){c[y+16>>2]=h;c[h+24>>2]=y}h=c[t+4>>2]|0;if(h|0){c[y+20>>2]=h;c[h+24>>2]=y}}}while(0);c[l+4>>2]=r|1;c[n+r>>2]=r;if((l|0)==(c[2668]|0)){c[2665]=r;return}else D=r}else{c[b>>2]=a&-2;c[l+4>>2]=m|1;c[n+m>>2]=m;D=m}m=D>>>3;if(D>>>0<256){n=10692+(m<<1<<2)|0;a=c[2663]|0;b=1<<m;if(!(a&b)){c[2663]=a|b;E=n;F=n+8|0}else{b=n+8|0;E=c[b>>2]|0;F=b}c[F>>2]=l;c[E+12>>2]=l;c[l+8>>2]=E;c[l+12>>2]=n;return}n=D>>>8;if(n)if(D>>>0>16777215)G=31;else{E=(n+1048320|0)>>>16&8;F=n<<E;n=(F+520192|0)>>>16&4;b=F<<n;F=(b+245760|0)>>>16&2;a=14-(n|E|F)+(b<<F>>>15)|0;G=D>>>(a+7|0)&1|a<<1}else G=0;a=10956+(G<<2)|0;c[l+28>>2]=G;c[l+20>>2]=0;c[l+16>>2]=0;F=c[2664]|0;b=1<<G;a:do if(!(F&b)){c[2664]=F|b;c[a>>2]=l;c[l+24>>2]=a;c[l+12>>2]=l;c[l+8>>2]=l}else{E=c[a>>2]|0;b:do if((c[E+4>>2]&-8|0)==(D|0))H=E;else{n=D<<((G|0)==31?0:25-(G>>>1)|0);m=E;while(1){I=m+16+(n>>>31<<2)|0;r=c[I>>2]|0;if(!r)break;if((c[r+4>>2]&-8|0)==(D|0)){H=r;break b}else{n=n<<1;m=r}}c[I>>2]=l;c[l+24>>2]=m;c[l+12>>2]=l;c[l+8>>2]=l;break a}while(0);E=H+8|0;w=c[E>>2]|0;c[w+12>>2]=l;c[E>>2]=l;c[l+8>>2]=w;c[l+12>>2]=H;c[l+24>>2]=0}while(0);l=(c[2671]|0)+-1|0;c[2671]=l;if(l|0)return;l=11108;while(1){H=c[l>>2]|0;if(!H)break;else l=H+8|0}c[2671]=-1;return}function fe(a){a=a|0;return}function ge(a){a=a|0;fe(a);ne(a);return}function he(a){a=a|0;return 6152}function ie(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,u=0,v=0,w=0,x=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0;b=Ea;Ea=Ea+16|0;if((Ea|0)>=(Fa|0))y(16);d=b;e=b+8|0;f=b+4|0;c[e>>2]=a;do if(a>>>0>=212){g=(a>>>0)/210|0;h=g*210|0;c[f>>2]=a-h;i=0;j=g;g=h;h=(je(2592,2784,f,d)|0)-2592>>2;a:while(1){k=(c[2592+(h<<2)>>2]|0)+g|0;l=5;while(1){if(l>>>0>=47){m=6;break}n=c[2400+(l<<2)>>2]|0;o=(k>>>0)/(n>>>0)|0;if(o>>>0<n>>>0){m=107;break a}if((k|0)==(t(o,n)|0)){p=i;break}else l=l+1|0}b:do if((m|0)==6){m=0;l=211;n=i;c:while(1){o=(k>>>0)/(l>>>0)|0;do if(o>>>0>=l>>>0)if((k|0)!=(t(o,l)|0)){q=l+10|0;r=(k>>>0)/(q>>>0)|0;if(r>>>0>=q>>>0)if((k|0)!=(t(r,q)|0)){r=l+12|0;s=(k>>>0)/(r>>>0)|0;if(s>>>0>=r>>>0)if((k|0)!=(t(s,r)|0)){s=l+16|0;u=(k>>>0)/(s>>>0)|0;if(u>>>0>=s>>>0)if((k|0)!=(t(u,s)|0)){u=l+18|0;v=(k>>>0)/(u>>>0)|0;if(v>>>0>=u>>>0)if((k|0)!=(t(v,u)|0)){v=l+22|0;w=(k>>>0)/(v>>>0)|0;if(w>>>0>=v>>>0)if((k|0)!=(t(w,v)|0)){w=l+28|0;x=(k>>>0)/(w>>>0)|0;if(x>>>0>=w>>>0)if((k|0)==(t(x,w)|0)){z=w;A=9;B=n}else{x=l+30|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+36|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+40|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+42|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+46|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+52|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+58|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+60|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+66|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+70|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+72|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+78|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+82|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+88|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+96|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+100|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+102|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+106|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+108|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+112|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+120|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+126|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+130|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+136|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+138|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+142|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+148|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+150|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+156|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+162|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+166|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+168|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+172|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+178|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+180|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+186|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+190|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+192|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+196|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+198|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){z=x;A=1;B=k;break}if((k|0)==(t(C,x)|0)){z=x;A=9;B=n;break}x=l+208|0;C=(k>>>0)/(x>>>0)|0;D=C>>>0<x>>>0;E=(k|0)==(t(C,x)|0);z=D|E?x:l+210|0;A=D?1:E?9:0;B=D?k:n}else{z=w;A=1;B=k}}else{z=v;A=9;B=n}else{z=v;A=1;B=k}}else{z=u;A=9;B=n}else{z=u;A=1;B=k}}else{z=s;A=9;B=n}else{z=s;A=1;B=k}}else{z=r;A=9;B=n}else{z=r;A=1;B=k}}else{z=q;A=9;B=n}else{z=q;A=1;B=k}}else{z=l;A=9;B=n}else{z=l;A=1;B=k}while(0);switch(A&15){case 9:{p=B;break b;break}case 0:{l=z;n=B;break}default:break c}}if(!A)p=B;else{m=108;break a}}while(0);n=h+1|0;l=(n|0)==48;o=j+(l&1)|0;i=p;j=o;g=o*210|0;h=l?0:n}if((m|0)==107){c[e>>2]=k;F=k;break}else if((m|0)==108){c[e>>2]=k;F=B;break}}else F=c[(je(2400,2592,e,d)|0)>>2]|0;while(0);Ea=b;return F|0}function je(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0;e=c[d>>2]|0;d=a;f=b-a>>2;while(1){if(!f)break;a=(f|0)/2|0;b=d+(a<<2)|0;g=(c[b>>2]|0)>>>0<e>>>0;d=g?b+4|0:d;f=g?f+-1-a|0:a}return d|0}function ke(a){a=a|0;return}function le(a){a=a|0;var b=0,d=0;b=a+8|0;if(!((c[b>>2]|0)!=0?(d=c[b>>2]|0,c[b>>2]=d+-1,(d|0)!=0):0))La[c[(c[a>>2]|0)+16>>2]&63](a);return}function me(a){a=a|0;var b=0,c=0;b=(a|0)==0?1:a;while(1){a=de(b)|0;if(a|0){c=a;break}a=Df()|0;if(!a){c=0;break}Ka[a&3]()}return c|0}function ne(a){a=a|0;ee(a);return}function oe(b,d){b=b|0;d=d|0;var e=0,f=0,g=0;e=Ea;Ea=Ea+16|0;if((Ea|0)>=(Fa|0))y(16);f=e;g=Xd((a[d+11>>0]|0)<0?c[d>>2]|0:d,0,f)|0;c[b>>2]=g;if((g|0)<0){g=c[(gd()|0)>>2]|0;Je(f,6258,d);Ne(g,(a[f+11>>0]|0)<0?c[f>>2]|0:f)}else{Ea=e;return}}function pe(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0;b=Ea;Ea=Ea+16|0;if((Ea|0)>=(Fa|0))y(16);d=b;e=4;f=d;a:while(1){if(!e){g=9;break}b:while(1){h=$d(c[a>>2]|0,f,e)|0;switch(h|0){case 0:{g=5;break a;break}case -1:break;default:break b}if((c[(gd()|0)>>2]|0)!=4){g=7;break a}}e=e-h|0;f=f+h|0}if((g|0)==5)Ne(61,6288);else if((g|0)==7)Ne(c[(gd()|0)>>2]|0,6310);else if((g|0)==9){Ea=b;return c[d>>2]|0}return 0}function qe(a,b){a=a|0;b=b|0;var d=0,e=0,f=0;d=md(b)|0;e=me(d+13|0)|0;c[e>>2]=d;c[e+4>>2]=d;c[e+8>>2]=0;f=re(e)|0;Qf(f|0,b|0,d+1|0)|0;c[a>>2]=f;return}function re(a){a=a|0;return a+12|0}function se(a,b){a=a|0;b=b|0;c[a>>2]=4312;qe(a+4|0,b);return}function te(a){a=a|0;return 1}function ue(a){a=a|0;qa()}function ve(b,d){b=b|0;d=d|0;c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;if((a[d+11>>0]|0)<0)we(b,c[d>>2]|0,c[d+4>>2]|0);else{c[b>>2]=c[d>>2];c[b+4>>2]=c[d+4>>2];c[b+8>>2]=c[d+8>>2]}return}function we(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0;f=Ea;Ea=Ea+16|0;if((Ea|0)>=(Fa|0))y(16);g=f;if(e>>>0>4294967279)ue(b);if(e>>>0<11){a[b+11>>0]=e;h=b}else{i=e+16&-16;j=me(i)|0;c[b>>2]=j;c[b+8>>2]=i|-2147483648;c[b+4>>2]=e;h=j}xe(h,d,e)|0;a[g>>0]=0;ye(h+e|0,g);Ea=f;return}function xe(a,b,c){a=a|0;b=b|0;c=c|0;if(c|0)Qf(a|0,b|0,c|0)|0;return a|0}function ye(b,c){b=b|0;c=c|0;a[b>>0]=a[c>>0]|0;return}function ze(a){a=a|0;return md(a)|0}function Ae(a,b,c){a=a|0;b=b|0;c=c|0;if(b|0)Rf(a|0,(Be(c)|0)&255|0,b|0)|0;return a|0}function Be(a){a=a|0;return a&255|0}function Ce(b){b=b|0;if((a[b+11>>0]|0)<0)ne(c[b>>2]|0);return}function De(b,d,e,f,g,h,i,j){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;h=h|0;i=i|0;j=j|0;var k=0,l=0,m=0,n=0,o=0,p=0;k=Ea;Ea=Ea+16|0;if((Ea|0)>=(Fa|0))y(16);l=k;if((-18-d|0)>>>0<e>>>0)ue(b);if((a[b+11>>0]|0)<0)m=c[b>>2]|0;else m=b;if(d>>>0<2147483623){n=e+d|0;e=d<<1;o=n>>>0<e>>>0?e:n;p=o>>>0<11?11:o+16&-16}else p=-17;o=me(p)|0;if(g|0)xe(o,m,g)|0;if(i|0)xe(o+g|0,j,i)|0;j=f-h|0;f=j-g|0;if(f|0)xe(o+g+i|0,m+g+h|0,f)|0;if((d|0)!=10)ne(m);c[b>>2]=o;c[b+8>>2]=p|-2147483648;p=j+i|0;c[b+4>>2]=p;a[l>>0]=0;ye(o+p|0,l);Ea=k;return}function Ee(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0;f=Ea;Ea=Ea+16|0;if((Ea|0)>=(Fa|0))y(16);g=f;h=b+11|0;i=a[h>>0]|0;j=i<<24>>24<0;if(j)k=c[b+4>>2]|0;else k=i&255;do if(k>>>0>=d>>>0)if(j){i=(c[b>>2]|0)+d|0;a[g>>0]=0;ye(i,g);c[b+4>>2]=d;break}else{a[g>>0]=0;ye(b+d|0,g);a[h>>0]=d;break}else Fe(b,d-k|0,e)|0;while(0);Ea=f;return}function Fe(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;f=Ea;Ea=Ea+16|0;if((Ea|0)>=(Fa|0))y(16);g=f;if(d|0){h=b+11|0;i=a[h>>0]|0;if(i<<24>>24<0){j=(c[b+8>>2]&2147483647)+-1|0;k=c[b+4>>2]|0}else{j=10;k=i&255}if((j-k|0)>>>0<d>>>0){Ge(b,j,k+d-j|0,k,k,0,0);l=a[h>>0]|0}else l=i;if(l<<24>>24<0)m=c[b>>2]|0;else m=b;Ae(m+k|0,d,e)|0;e=k+d|0;if((a[h>>0]|0)<0)c[b+4>>2]=e;else a[h>>0]=e;a[g>>0]=0;ye(m+e|0,g)}Ea=f;return b|0}function Ge(b,d,e,f,g,h,i){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;h=h|0;i=i|0;var j=0,k=0,l=0,m=0;if((-17-d|0)>>>0<e>>>0)ue(b);if((a[b+11>>0]|0)<0)j=c[b>>2]|0;else j=b;if(d>>>0<2147483623){k=e+d|0;e=d<<1;l=k>>>0<e>>>0?e:k;m=l>>>0<11?11:l+16&-16}else m=-17;l=me(m)|0;if(g|0)xe(l,j,g)|0;k=f-h-g|0;if(k|0)xe(l+g+i|0,j+g+h|0,k)|0;if((d|0)!=10)ne(j);c[b>>2]=l;c[b+8>>2]=m|-2147483648;return}function He(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;f=Ea;Ea=Ea+16|0;if((Ea|0)>=(Fa|0))y(16);g=f;h=b+11|0;i=a[h>>0]|0;j=i<<24>>24<0;if(j){k=(c[b+8>>2]&2147483647)+-1|0;l=c[b+4>>2]|0}else{k=10;l=i&255}if((k-l|0)>>>0>=e>>>0){if(e|0){if(j)m=c[b>>2]|0;else m=b;xe(m+l|0,d,e)|0;j=l+e|0;if((a[h>>0]|0)<0)c[b+4>>2]=j;else a[h>>0]=j;a[g>>0]=0;ye(m+j|0,g)}}else De(b,k,l+e-k|0,l,l,0,e,d);Ea=f;return b|0}function Ie(b,d,e,f){b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0,j=0;g=Ea;Ea=Ea+16|0;if((Ea|0)>=(Fa|0))y(16);h=g;if(f>>>0>4294967279)ue(b);if(f>>>0<11){a[b+11>>0]=e;i=b}else{j=f+16&-16;f=me(j)|0;c[b>>2]=f;c[b+8>>2]=j|-2147483648;c[b+4>>2]=e;i=f}xe(i,d,e)|0;a[h>>0]=0;ye(i+e|0,h);Ea=g;return}function Je(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0;c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;f=0;while(1){if((f|0)==3)break;c[b+(f<<2)>>2]=0;f=f+1|0}f=ze(d)|0;g=e+11|0;h=a[g>>0]|0;i=h<<24>>24<0?c[e+4>>2]|0:h&255;Ie(b,d,f,i+f|0);He(b,(a[g>>0]|0)<0?c[e>>2]|0:e,i)|0;return}function Ke(a,b){a=a|0;b=b|0;var c=0,d=0;c=Ea;Ea=Ea+16|0;if((Ea|0)>=(Fa|0))y(16);d=c;Le(d);Me(a,d,b);Ce(d);Ea=c;return}function Le(b){b=b|0;var d=0,e=0;c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;d=0;while(1){if((d|0)==3)break;c[b+(d<<2)>>2]=0;d=d+1|0}if((a[b+11>>0]|0)<0)e=(c[b+8>>2]&2147483647)+-1|0;else e=10;Ee(b,e,0);return}function Me(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0;f=Ea;Ea=Ea+16|0;if((Ea|0)>=(Fa|0))y(16);g=f;h=d+11|0;i=a[h>>0]|0;if(i<<24>>24<0)j=c[d+4>>2]|0;else j=i&255;k=j;j=i;while(1){if(j<<24>>24<0)l=c[d>>2]|0;else l=d;c[g>>2]=e;m=Yd(l,k+1|0,6348,g)|0;if((m|0)>-1)if(m>>>0>k>>>0)n=m;else break;else n=k<<1|1;Ee(d,n,0);k=n;j=a[h>>0]|0}Ee(d,m,0);c[b>>2]=c[d>>2];c[b+4>>2]=c[d+4>>2];c[b+8>>2]=c[d+8>>2];b=0;while(1){if((b|0)==3)break;c[d+(b<<2)>>2]=0;b=b+1|0}Ea=f;return}function Ne(a,b){a=a|0;b=b|0;qa()}function Oe(a){a=a|0;qa()}function Pe(){var a=0,b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0;a=Ea;Ea=Ea+48|0;if((Ea|0)>=(Fa|0))y(48);b=a+32|0;d=a+24|0;e=a+16|0;f=a;g=a+36|0;a=Qe()|0;if(a|0?(h=c[a>>2]|0,h|0):0){a=h+48|0;i=c[a>>2]|0;j=c[a+4>>2]|0;if(!((i&-256|0)==1126902528&(j|0)==1129074247)){c[d>>2]=6487;Re(6437,d)}if((i|0)==1126902529&(j|0)==1129074247)k=c[h+44>>2]|0;else k=h+80|0;c[g>>2]=k;k=c[h>>2]|0;h=c[k+4>>2]|0;if(Ja[c[(c[768]|0)+16>>2]&7](3072,k,g)|0){k=c[g>>2]|0;g=Ha[c[(c[k>>2]|0)+8>>2]&15](k)|0;c[f>>2]=6487;c[f+4>>2]=h;c[f+8>>2]=g;Re(6351,f)}else{c[e>>2]=6487;c[e+4>>2]=h;Re(6396,e)}}Re(6475,b)}function Qe(){var a=0,b=0;a=Ea;Ea=Ea+16|0;if((Ea|0)>=(Fa|0))y(16);if(!(Ba(11148,3)|0)){b=za(c[2788]|0)|0;Ea=a;return b|0}else Re(6626,a);return 0}function Re(a,b){a=a|0;b=b|0;var d=0,e=0;d=Ea;Ea=Ea+16|0;if((Ea|0)>=(Fa|0))y(16);e=d;c[e>>2]=b;b=c[893]|0;Cd(b,a,e)|0;be(10,b)|0;qa()}function Se(a){a=a|0;return}function Te(a){a=a|0;Se(a);ne(a);return}function Ue(a){a=a|0;return}function Ve(a){a=a|0;return}function We(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0;e=Ea;Ea=Ea+64|0;if((Ea|0)>=(Fa|0))y(64);f=e;if(!(_e(a,b,0)|0))if((b|0)!=0?(g=cf(b,3096,3080,0)|0,(g|0)!=0):0){b=f+4|0;h=b+52|0;do{c[b>>2]=0;b=b+4|0}while((b|0)<(h|0));c[f>>2]=g;c[f+8>>2]=a;c[f+12>>2]=-1;c[f+48>>2]=1;Qa[c[(c[g>>2]|0)+28>>2]&15](g,f,c[d>>2]|0,1);if((c[f+24>>2]|0)==1){c[d>>2]=c[f+16>>2];i=1}else i=0;j=i}else j=0;else j=1;Ea=e;return j|0}function Xe(a,b,d,e,f,g){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;if(_e(a,c[b+8>>2]|0,g)|0)bf(0,b,d,e,f);return}function Ye(b,d,e,f,g){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0;do if(!(_e(b,c[d+8>>2]|0,g)|0)){if(_e(b,c[d>>2]|0,g)|0){if((c[d+16>>2]|0)!=(e|0)?(h=d+20|0,(c[h>>2]|0)!=(e|0)):0){c[d+32>>2]=f;c[h>>2]=e;h=d+40|0;c[h>>2]=(c[h>>2]|0)+1;if((c[d+36>>2]|0)==1?(c[d+24>>2]|0)==2:0)a[d+54>>0]=1;c[d+44>>2]=4;break}if((f|0)==1)c[d+32>>2]=1}}else af(0,d,e,f);while(0);return}function Ze(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;if(_e(a,c[b+8>>2]|0,0)|0)$e(0,b,d,e);return}function _e(a,b,c){a=a|0;b=b|0;c=c|0;return (a|0)==(b|0)|0}function $e(b,d,e,f){b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0;b=d+16|0;g=c[b>>2]|0;do if(g){if((g|0)!=(e|0)){h=d+36|0;c[h>>2]=(c[h>>2]|0)+1;c[d+24>>2]=2;a[d+54>>0]=1;break}h=d+24|0;if((c[h>>2]|0)==2)c[h>>2]=f}else{c[b>>2]=e;c[d+24>>2]=f;c[d+36>>2]=1}while(0);return}function af(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;if((c[b+4>>2]|0)==(d|0)?(d=b+28|0,(c[d>>2]|0)!=1):0)c[d>>2]=e;return}function bf(b,d,e,f,g){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0;a[d+53>>0]=1;do if((c[d+4>>2]|0)==(f|0)){a[d+52>>0]=1;b=d+16|0;h=c[b>>2]|0;if(!h){c[b>>2]=e;c[d+24>>2]=g;c[d+36>>2]=1;if(!((g|0)==1?(c[d+48>>2]|0)==1:0))break;a[d+54>>0]=1;break}if((h|0)!=(e|0)){h=d+36|0;c[h>>2]=(c[h>>2]|0)+1;a[d+54>>0]=1;break}h=d+24|0;b=c[h>>2]|0;if((b|0)==2){c[h>>2]=g;i=g}else i=b;if((i|0)==1?(c[d+48>>2]|0)==1:0)a[d+54>>0]=1}while(0);return}function cf(d,e,f,g){d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0;h=Ea;Ea=Ea+64|0;if((Ea|0)>=(Fa|0))y(64);i=h;j=c[d>>2]|0;k=d+(c[j+-8>>2]|0)|0;l=c[j+-4>>2]|0;c[i>>2]=f;c[i+4>>2]=d;c[i+8>>2]=e;c[i+12>>2]=g;g=i+16|0;e=i+20|0;d=i+24|0;j=i+28|0;m=i+32|0;n=i+40|0;o=g;p=o+36|0;do{c[o>>2]=0;o=o+4|0}while((o|0)<(p|0));b[g+36>>1]=0;a[g+38>>0]=0;a:do if(_e(l,f,0)|0){c[i+48>>2]=1;Sa[c[(c[l>>2]|0)+20>>2]&3](l,i,k,k,1,0);q=(c[d>>2]|0)==1?k:0}else{Ra[c[(c[l>>2]|0)+24>>2]&3](l,i,k,1,0);switch(c[i+36>>2]|0){case 0:{q=(c[n>>2]|0)==1&(c[j>>2]|0)==1&(c[m>>2]|0)==1?c[e>>2]|0:0;break a;break}case 1:break;default:{q=0;break a}}if((c[d>>2]|0)!=1?!((c[n>>2]|0)==0&(c[j>>2]|0)==1&(c[m>>2]|0)==1):0){q=0;break}q=c[g>>2]|0}while(0);Ea=h;return q|0}function df(a){a=a|0;Se(a);ne(a);return}function ef(a,b,d,e,f,g){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0;if(_e(a,c[b+8>>2]|0,g)|0)bf(0,b,d,e,f);else{h=c[a+8>>2]|0;Sa[c[(c[h>>2]|0)+20>>2]&3](h,b,d,e,f,g)}return}function ff(b,d,e,f,g){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0;do if(!(_e(b,c[d+8>>2]|0,g)|0)){if(!(_e(b,c[d>>2]|0,g)|0)){h=c[b+8>>2]|0;Ra[c[(c[h>>2]|0)+24>>2]&3](h,d,e,f,g);break}if((c[d+16>>2]|0)!=(e|0)?(h=d+20|0,(c[h>>2]|0)!=(e|0)):0){c[d+32>>2]=f;i=d+44|0;if((c[i>>2]|0)==4)break;j=d+52|0;a[j>>0]=0;k=d+53|0;a[k>>0]=0;l=c[b+8>>2]|0;Sa[c[(c[l>>2]|0)+20>>2]&3](l,d,e,e,1,g);if(a[k>>0]|0)if(!(a[j>>0]|0)){m=1;n=11}else n=15;else{m=0;n=11}do if((n|0)==11){c[h>>2]=e;j=d+40|0;c[j>>2]=(c[j>>2]|0)+1;if((c[d+36>>2]|0)==1?(c[d+24>>2]|0)==2:0){a[d+54>>0]=1;if(m){n=15;break}else{o=4;break}}if(m)n=15;else o=4}while(0);if((n|0)==15)o=3;c[i>>2]=o;break}if((f|0)==1)c[d+32>>2]=1}else af(0,d,e,f);while(0);return}function gf(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0;if(_e(a,c[b+8>>2]|0,0)|0)$e(0,b,d,e);else{f=c[a+8>>2]|0;Qa[c[(c[f>>2]|0)+28>>2]&15](f,b,d,e)}return}function hf(a){a=a|0;return}function jf(){var a=0;a=Ea;Ea=Ea+16|0;if((Ea|0)>=(Fa|0))y(16);if(!(Aa(11152,38)|0)){Ea=a;return}else Re(6675,a)}function kf(a){a=a|0;var b=0;b=Ea;Ea=Ea+16|0;if((Ea|0)>=(Fa|0))y(16);ee(a);if(!(Ca(c[2788]|0,0)|0)){Ea=b;return}else Re(6725,b)}function lf(){var a=0,b=0;a=Qe()|0;if((a|0?(b=c[a>>2]|0,b|0):0)?(a=b+48|0,(c[a>>2]&-256|0)==1126902528?(c[a+4>>2]|0)==1129074247:0):0)mf(c[b+12>>2]|0);mf(nf()|0)}function mf(a){a=a|0;var b=0;b=Ea;Ea=Ea+16|0;if((Ea|0)>=(Fa|0))y(16);Ka[a&3]();Re(6778,b)}function nf(){var a=0;a=c[1055]|0;c[1055]=a+0;return a|0}function of(a){a=a|0;return}function pf(a){a=a|0;c[a>>2]=4312;tf(a+4|0);return}function qf(a){a=a|0;pf(a);ne(a);return}function rf(a){a=a|0;return sf(a+4|0)|0}function sf(a){a=a|0;return c[a>>2]|0}function tf(a){a=a|0;var b=0,d=0;if(te(a)|0?(b=uf(c[a>>2]|0)|0,a=b+8|0,d=c[a>>2]|0,c[a>>2]=d+-1,(d+-1|0)<0):0)ne(b);return}function uf(a){a=a|0;return a+-12|0}function vf(a){a=a|0;pf(a);ne(a);return}function wf(a){a=a|0;Se(a);ne(a);return}function xf(b,d,e,f,g,h){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;h=h|0;var i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0;if(_e(b,c[d+8>>2]|0,h)|0)bf(0,d,e,f,g);else{i=d+52|0;j=a[i>>0]|0;k=d+53|0;l=a[k>>0]|0;m=c[b+12>>2]|0;n=b+16+(m<<3)|0;a[i>>0]=0;a[k>>0]=0;Bf(b+16|0,d,e,f,g,h);a:do if((m|0)>1){o=d+24|0;p=b+8|0;q=d+54|0;r=b+24|0;do{if(a[q>>0]|0)break a;if(!(a[i>>0]|0)){if(a[k>>0]|0?(c[p>>2]&1|0)==0:0)break a}else{if((c[o>>2]|0)==1)break a;if(!(c[p>>2]&2))break a}a[i>>0]=0;a[k>>0]=0;Bf(r,d,e,f,g,h);r=r+8|0}while(r>>>0<n>>>0)}while(0);a[i>>0]=j;a[k>>0]=l}return}function yf(b,d,e,f,g){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0;a:do if(!(_e(b,c[d+8>>2]|0,g)|0)){if(!(_e(b,c[d>>2]|0,g)|0)){h=c[b+12>>2]|0;i=b+16+(h<<3)|0;Cf(b+16|0,d,e,f,g);j=b+24|0;if((h|0)<=1)break;h=c[b+8>>2]|0;if((h&2|0)==0?(k=d+36|0,(c[k>>2]|0)!=1):0){if(!(h&1)){h=d+54|0;l=j;while(1){if(a[h>>0]|0)break a;if((c[k>>2]|0)==1)break a;Cf(l,d,e,f,g);l=l+8|0;if(l>>>0>=i>>>0)break a}}l=d+24|0;h=d+54|0;m=j;while(1){if(a[h>>0]|0)break a;if((c[k>>2]|0)==1?(c[l>>2]|0)==1:0)break a;Cf(m,d,e,f,g);m=m+8|0;if(m>>>0>=i>>>0)break a}}m=d+54|0;l=j;while(1){if(a[m>>0]|0)break a;Cf(l,d,e,f,g);l=l+8|0;if(l>>>0>=i>>>0)break a}}if((c[d+16>>2]|0)!=(e|0)?(i=d+20|0,(c[i>>2]|0)!=(e|0)):0){c[d+32>>2]=f;l=d+44|0;if((c[l>>2]|0)==4)break;m=b+16+(c[b+12>>2]<<3)|0;j=d+52|0;k=d+53|0;h=d+54|0;n=b+8|0;o=d+24|0;p=0;q=b+16|0;r=0;b:while(1){if(q>>>0>=m>>>0){s=p;t=18;break}a[j>>0]=0;a[k>>0]=0;Bf(q,d,e,e,1,g);if(a[h>>0]|0){s=p;t=18;break}do if(a[k>>0]|0){if(!(a[j>>0]|0))if(!(c[n>>2]&1)){s=1;t=18;break b}else{u=1;v=r;break}if((c[o>>2]|0)==1){t=23;break b}if(!(c[n>>2]&2)){t=23;break b}else{u=1;v=1}}else{u=p;v=r}while(0);p=u;q=q+8|0;r=v}do if((t|0)==18){if((!r?(c[i>>2]=e,q=d+40|0,c[q>>2]=(c[q>>2]|0)+1,(c[d+36>>2]|0)==1):0)?(c[o>>2]|0)==2:0){a[h>>0]=1;if(s){t=23;break}else{w=4;break}}if(s)t=23;else w=4}while(0);if((t|0)==23)w=3;c[l>>2]=w;break}if((f|0)==1)c[d+32>>2]=1}else af(0,d,e,f);while(0);return}function zf(b,d,e,f){b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0;a:do if(!(_e(b,c[d+8>>2]|0,0)|0)){g=c[b+12>>2]|0;h=b+16+(g<<3)|0;Af(b+16|0,d,e,f);if((g|0)>1){g=d+54|0;i=b+24|0;do{Af(i,d,e,f);if(a[g>>0]|0)break a;i=i+8|0}while(i>>>0<h>>>0)}}else $e(0,d,e,f);while(0);return}function Af(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0;f=c[a+4>>2]|0;g=f>>8;if(!(f&1))h=g;else h=c[(c[d>>2]|0)+g>>2]|0;g=c[a>>2]|0;Qa[c[(c[g>>2]|0)+28>>2]&15](g,b,d+h|0,(f&2|0)==0?2:e);return}function Bf(a,b,d,e,f,g){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0,j=0;h=c[a+4>>2]|0;i=h>>8;if(!(h&1))j=i;else j=c[(c[e>>2]|0)+i>>2]|0;i=c[a>>2]|0;Sa[c[(c[i>>2]|0)+20>>2]&3](i,b,d,e+j|0,(h&2|0)==0?2:f,g);return}function Cf(a,b,d,e,f){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0;g=c[a+4>>2]|0;h=g>>8;if(!(g&1))i=h;else i=c[(c[d>>2]|0)+h>>2]|0;h=c[a>>2]|0;Ra[c[(c[h>>2]|0)+24>>2]&3](h,b,d+i|0,(g&2|0)==0?2:e,f);return}function Df(){var a=0;a=c[2789]|0;c[2789]=a+0;return a|0}function Ef(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0;e=Ea;Ea=Ea+16|0;if((Ea|0)>=(Fa|0))y(16);f=e;c[f>>2]=c[d>>2];g=Ja[c[(c[a>>2]|0)+16>>2]&7](a,b,f)|0;if(g)c[d>>2]=c[f>>2];Ea=e;return g&1|0}function Ff(a){a=a|0;var b=0;if(!a)b=0;else b=(cf(a,3096,3184,0)|0)!=0&1;return b|0}function Gf(a,b){a=a|0;b=b|0;var c=0,d=0,e=0,f=0;c=a&65535;d=b&65535;e=t(d,c)|0;f=a>>>16;a=(e>>>16)+(t(d,f)|0)|0;d=b>>>16;b=t(d,c)|0;return (w((a>>>16)+(t(d,f)|0)+(((a&65535)+b|0)>>>16)|0),a+b<<16|e&65535|0)|0}function Hf(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;var e=0,f=0;e=a;a=c;c=Gf(e,a)|0;f=x()|0;return (w((t(b,a)|0)+(t(d,e)|0)+f|f&0|0),c|0|0)|0}function If(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;var e=0;e=a+c>>>0;return (w(b+d+(e>>>0<a>>>0|0)>>>0|0),e|0)|0}function Jf(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;var e=0;e=b-d>>>0;e=b-d-(c>>>0>a>>>0|0)>>>0;return (w(e|0),a-c>>>0|0)|0}function Kf(a){a=a|0;return (a?31-(u(a^a-1)|0)|0:32)|0}function Lf(a,b,d,e,f){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,v=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0;g=a;h=b;i=h;j=d;k=e;l=k;if(!i){m=(f|0)!=0;if(!l){if(m){c[f>>2]=(g>>>0)%(j>>>0);c[f+4>>2]=0}n=0;o=(g>>>0)/(j>>>0)>>>0;return (w(n|0),o)|0}else{if(!m){n=0;o=0;return (w(n|0),o)|0}c[f>>2]=a|0;c[f+4>>2]=b&0;n=0;o=0;return (w(n|0),o)|0}}m=(l|0)==0;do if(j){if(!m){p=(u(l|0)|0)-(u(i|0)|0)|0;if(p>>>0<=31){q=p+1|0;r=31-p|0;s=p-31>>31;t=q;v=g>>>(q>>>0)&s|i<<r;y=i>>>(q>>>0)&s;z=0;A=g<<r;break}if(!f){n=0;o=0;return (w(n|0),o)|0}c[f>>2]=a|0;c[f+4>>2]=h|b&0;n=0;o=0;return (w(n|0),o)|0}r=j-1|0;if(r&j|0){s=(u(j|0)|0)+33-(u(i|0)|0)|0;q=64-s|0;p=32-s|0;B=p>>31;C=s-32|0;D=C>>31;t=s;v=p-1>>31&i>>>(C>>>0)|(i<<p|g>>>(s>>>0))&D;y=D&i>>>(s>>>0);z=g<<q&B;A=(i<<q|g>>>(C>>>0))&B|g<<p&s-33>>31;break}if(f|0){c[f>>2]=r&g;c[f+4>>2]=0}if((j|0)==1){n=h|b&0;o=a|0|0;return (w(n|0),o)|0}else{r=Kf(j|0)|0;n=i>>>(r>>>0)|0;o=i<<32-r|g>>>(r>>>0)|0;return (w(n|0),o)|0}}else{if(m){if(f|0){c[f>>2]=(i>>>0)%(j>>>0);c[f+4>>2]=0}n=0;o=(i>>>0)/(j>>>0)>>>0;return (w(n|0),o)|0}if(!g){if(f|0){c[f>>2]=0;c[f+4>>2]=(i>>>0)%(l>>>0)}n=0;o=(i>>>0)/(l>>>0)>>>0;return (w(n|0),o)|0}r=l-1|0;if(!(r&l)){if(f|0){c[f>>2]=a|0;c[f+4>>2]=r&i|b&0}n=0;o=i>>>((Kf(l|0)|0)>>>0);return (w(n|0),o)|0}r=(u(l|0)|0)-(u(i|0)|0)|0;if(r>>>0<=30){s=r+1|0;p=31-r|0;t=s;v=i<<p|g>>>(s>>>0);y=i>>>(s>>>0);z=0;A=g<<p;break}if(!f){n=0;o=0;return (w(n|0),o)|0}c[f>>2]=a|0;c[f+4>>2]=h|b&0;n=0;o=0;return (w(n|0),o)|0}while(0);if(!t){E=A;F=z;G=y;H=v;I=0;J=0}else{b=d|0|0;d=k|e&0;e=If(b|0,d|0,-1,-1)|0;k=x()|0;h=A;A=z;z=y;y=v;v=t;t=0;do{a=h;h=A>>>31|h<<1;A=t|A<<1;g=y<<1|a>>>31|0;a=y>>>31|z<<1|0;Jf(e|0,k|0,g|0,a|0)|0;i=x()|0;l=i>>31|((i|0)<0?-1:0)<<1;t=l&1;y=Jf(g|0,a|0,l&b|0,(((i|0)<0?-1:0)>>31|((i|0)<0?-1:0)<<1)&d|0)|0;z=x()|0;v=v-1|0}while((v|0)!=0);E=h;F=A;G=z;H=y;I=0;J=t}t=F;F=0;if(f|0){c[f>>2]=H;c[f+4>>2]=G}n=(t|0)>>>31|(E|F)<<1|(F<<1|t>>>31)&0|I;o=(t<<1|0>>>31)&-2|J;return (w(n|0),o)|0}function Mf(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;return Lf(a,b,c,d,0)|0}function Nf(a,b,c){a=a|0;b=b|0;c=c|0;if((c|0)<32){w(b>>>c|0);return a>>>c|(b&(1<<c)-1)<<32-c}w(0);return b>>>c-32|0}function Of(a,b,c){a=a|0;b=b|0;c=c|0;if((c|0)<32){w(b<<c|(a&(1<<c)-1<<32-c)>>>32-c|0);return a<<c}w(a<<c-32|0);return 0}function Pf(a){a=a|0;return (a&255)<<24|(a>>8&255)<<16|(a>>16&255)<<8|a>>>24|0}function Qf(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0;if((e|0)>=8192){ta(b|0,d|0,e|0)|0;return b|0}f=b|0;g=b+e|0;if((b&3)==(d&3)){while(b&3){if(!e)return f|0;a[b>>0]=a[d>>0]|0;b=b+1|0;d=d+1|0;e=e-1|0}h=g&-4|0;e=h-64|0;while((b|0)<=(e|0)){c[b>>2]=c[d>>2];c[b+4>>2]=c[d+4>>2];c[b+8>>2]=c[d+8>>2];c[b+12>>2]=c[d+12>>2];c[b+16>>2]=c[d+16>>2];c[b+20>>2]=c[d+20>>2];c[b+24>>2]=c[d+24>>2];c[b+28>>2]=c[d+28>>2];c[b+32>>2]=c[d+32>>2];c[b+36>>2]=c[d+36>>2];c[b+40>>2]=c[d+40>>2];c[b+44>>2]=c[d+44>>2];c[b+48>>2]=c[d+48>>2];c[b+52>>2]=c[d+52>>2];c[b+56>>2]=c[d+56>>2];c[b+60>>2]=c[d+60>>2];b=b+64|0;d=d+64|0}while((b|0)<(h|0)){c[b>>2]=c[d>>2];b=b+4|0;d=d+4|0}}else{h=g-4|0;while((b|0)<(h|0)){a[b>>0]=a[d>>0]|0;a[b+1>>0]=a[d+1>>0]|0;a[b+2>>0]=a[d+2>>0]|0;a[b+3>>0]=a[d+3>>0]|0;b=b+4|0;d=d+4|0}}while((b|0)<(g|0)){a[b>>0]=a[d>>0]|0;b=b+1|0;d=d+1|0}return f|0}function Rf(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0;f=b+e|0;d=d&255;if((e|0)>=67){while(b&3){a[b>>0]=d;b=b+1|0}g=f&-4|0;h=d|d<<8|d<<16|d<<24;i=g-64|0;while((b|0)<=(i|0)){c[b>>2]=h;c[b+4>>2]=h;c[b+8>>2]=h;c[b+12>>2]=h;c[b+16>>2]=h;c[b+20>>2]=h;c[b+24>>2]=h;c[b+28>>2]=h;c[b+32>>2]=h;c[b+36>>2]=h;c[b+40>>2]=h;c[b+44>>2]=h;c[b+48>>2]=h;c[b+52>>2]=h;c[b+56>>2]=h;c[b+60>>2]=h;b=b+64|0}while((b|0)<(g|0)){c[b>>2]=h;b=b+4|0}}while((b|0)<(f|0)){a[b>>0]=d;b=b+1|0}return f-e|0}function Sf(a){a=a|0;var b=0,d=0;b=c[i>>2]|0;d=b+a|0;if((a|0)>0&(d|0)<(b|0)|(d|0)<0){Da(d|0)|0;ha(12);return -1}if((d|0)>(ra()|0)){if(!(ua(d|0)|0)){ha(12);return -1}}else c[i>>2]=d;return b|0}function Tf(a,b){a=a|0;b=b|0;return Ha[a&15](b|0)|0}function Uf(a,b,c){a=a|0;b=b|0;c=c|0;return Ia[a&7](b|0,c|0)|0}function Vf(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;return Ja[a&7](b|0,c|0,d|0)|0}function Wf(a){a=a|0;Ka[a&3]()}function Xf(a,b){a=a|0;b=b|0;La[a&63](b|0)}function Yf(a,b,c,d){a=a|0;b=b|0;c=+c;d=d|0;Ma[a&3](b|0,+c,d|0)}function Zf(a,b,c){a=a|0;b=b|0;c=c|0;Na[a&7](b|0,c|0)}function _f(a,b,c,d){a=a|0;b=b|0;c=c|0;d=+d;Oa[a&0](b|0,c|0,+d)}function $f(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;Pa[a&3](b|0,c|0,d|0)}function ag(a,b,c,d,e){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;Qa[a&15](b|0,c|0,d|0,e|0)}function bg(a,b,c,d,e,f){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;f=f|0;Ra[a&3](b|0,c|0,d|0,e|0,f|0)}function cg(a,b,c,d,e,f,g){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;f=f|0;g=g|0;Sa[a&3](b|0,c|0,d|0,e|0,f|0,g|0)}function dg(a){a=a|0;z(0);return 0}function eg(a){a=a|0;z(10);return 0}function fg(a){a=a|0;z(11);return 0}function gg(a){a=a|0;z(12);return 0}function hg(a){a=a|0;z(13);return 0}function ig(a){a=a|0;z(14);return 0}function jg(a){a=a|0;z(15);return 0}function kg(a,b){a=a|0;b=b|0;A(0);return 0}function lg(a,b,c){a=a|0;b=b|0;c=c|0;B(0);return 0}function mg(a,b,c){a=a|0;b=b|0;c=c|0;B(6);return 0}function ng(a,b,c){a=a|0;b=b|0;c=c|0;B(7);return 0}function og(){C(0)}function pg(a){a=a|0;D(0)}function qg(a){a=a|0;D(39)}function rg(a){a=a|0;D(40)}function sg(a){a=a|0;D(41)}function tg(a){a=a|0;D(42)}function ug(a){a=a|0;D(43)}function vg(a){a=a|0;D(44)}function wg(a){a=a|0;D(45)}function xg(a){a=a|0;D(46)}function yg(a){a=a|0;D(47)}function zg(a){a=a|0;D(48)}function Ag(a){a=a|0;D(49)}function Bg(a){a=a|0;D(50)}function Cg(a){a=a|0;D(51)}function Dg(a){a=a|0;D(52)}function Eg(a){a=a|0;D(53)}function Fg(a){a=a|0;D(54)}function Gg(a){a=a|0;D(55)}function Hg(a){a=a|0;D(56)}function Ig(a){a=a|0;D(57)}function Jg(a){a=a|0;D(58)}function Kg(a){a=a|0;D(59)}function Lg(a){a=a|0;D(60)}function Mg(a){a=a|0;D(61)}function Ng(a){a=a|0;D(62)}function Og(a){a=a|0;D(63)}function Pg(a,b,c){a=a|0;b=+b;c=c|0;E(0)}function Qg(a,b,c){a=a|0;b=+b;c=c|0;E(3)}function Rg(a,b){a=a|0;b=b|0;F(0)}function Sg(a,b,c){a=a|0;b=b|0;c=+c;G(0)}function Tg(a,b,c){a=a|0;b=b|0;c=c|0;H(0)}function Ug(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;I(0)}function Vg(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;I(11)}function Wg(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;I(12)}function Xg(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;I(13)}function Yg(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;I(14)}function Zg(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;I(15)}function _g(a,b,c,d,e){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;J(0)}function $g(a,b,c,d,e,f){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;f=f|0;K(0)}

// EMSCRIPTEN_END_FUNCS
var Ha=[dg,wb,Cb,Eb,Kb,Oc,Uc,cd,he,rf,eg,fg,gg,hg,ig,jg];var Ia=[kg,Bb,Jb,Zb,cc,pc,Jc,Tc];var Ja=[lg,dd,ed,id,_d,We,mg,ng];var Ka=[og,Pe,ab,jf];var La=[pg,ub,vb,yb,zb,Lb,Db,Gb,Hb,ke,Xb,Yb,_b,ac,bc,dc,nc,oc,qc,Hc,Ic,Kc,Vc,Nc,Qc,Rc,Sc,fe,ge,Se,Te,Ue,Ve,df,pf,qf,vf,wf,kf,qg,rg,sg,tg,ug,vg,wg,xg,yg,zg,Ag,Bg,Cg,Dg,Eg,Fg,Gg,Hg,Ig,Jg,Kg,Lg,Mg,Ng,Og];var Ma=[Pg,mb,pb,Qg];var Na=[Rg,nb,ob,qb,xb,Ab,Fb,Pc];var Oa=[Sg];var Pa=[Tg,Mb,Nb,ec];var Qa=[Ug,Ib,Ob,Pb,Qb,Rb,fc,gc,Ze,gf,zf,Vg,Wg,Xg,Yg,Zg];var Ra=[_g,Ye,ff,yf];var Sa=[$g,Xe,ef,xf];return{__GLOBAL__sub_I_main_cpp:bd,___cxa_can_catch:Ef,___cxa_is_pointer_type:Ff,___em_js__getCanvasHeight:Ya,___em_js__getCanvasWidth:Xa,___errno_location:gd,___muldi3:Hf,___udivdi3:Mf,_bitshift64Lshr:Nf,_bitshift64Shl:Of,_fflush:zd,_free:ee,_i64Add:If,_i64Subtract:Jf,_llvm_bswap_i32:Pf,_main:bb,_malloc:de,_memcpy:Qf,_memset:Rf,_sbrk:Sf,dynCall_ii:Tf,dynCall_iii:Uf,dynCall_iiii:Vf,dynCall_v:Wf,dynCall_vi:Xf,dynCall_vidi:Yf,dynCall_vii:Zf,dynCall_viid:_f,dynCall_viii:$f,dynCall_viiii:ag,dynCall_viiiii:bg,dynCall_viiiiii:cg,establishStackSpace:Wa,stackAlloc:Ta,stackRestore:Va,stackSave:Ua}})


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

