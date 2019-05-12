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

var STACK_BASE = 10848, STACK_MAX = 5253728, DYNAMIC_BASE = 5253728, DYNAMICTOP_PTR = 10592;

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

var tempDoublePtr = 10832;

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

function _Engine_RoundedRectangle(x, y, width, height, radius, thickness, strokeRgba, fillRgba) {
 Engine.roundedRectangle(x, y, width, height, radius, thickness, strokeRgba, fillRgba);
}

function _Engine_StrokeEllipse(x, y, width, height, thickness, rgba) {
 Engine.strokeEllipse(x, y, width, height, thickness, rgba);
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

var debug_table_iii = [ "0", "__ZNKSt3__210__function6__funcIZN10PlayTetrisC1E19TetrisConfigurationEUlvE_NS_9allocatorIS4_EEF6EntityvEE6targetERKSt9type_info", "__ZNKSt3__210__function6__funcIZN10PlayTetrisC1E19TetrisConfigurationEUlRNS_6vectorI6EntityNS_9allocatorIS5_EEEEjjE_NS6_ISA_EEFvS9_jjEE6targetERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP10EntityGridNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP9ComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP10PlayTetrisNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP5Mode1NS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEE6targetERKSt9type_info" ];

var debug_table_iiii = [ "0", "___stdio_write", "___stdio_seek", "___stdout_write", "__ZNK10__cxxabiv117__class_type_info9can_catchEPKNS_16__shim_type_infoERPv", "0", "0", "0" ];

var debug_table_v = [ "0", "__ZL25default_terminate_handlerv", "__Z9main_loopv", "__ZN10__cxxabiv112_GLOBAL__N_110construct_Ev" ];

var debug_table_vi = [ "0", "__ZNSt3__210__function6__baseIF6EntityvEED2Ev", "__ZNSt3__210__function6__funcIZN10PlayTetrisC1E19TetrisConfigurationEUlvE_NS_9allocatorIS4_EEF6EntityvEED0Ev", "__ZNSt3__210__function6__funcIZN10PlayTetrisC1E19TetrisConfigurationEUlvE_NS_9allocatorIS4_EEF6EntityvEE7destroyEv", "__ZNSt3__210__function6__funcIZN10PlayTetrisC1E19TetrisConfigurationEUlvE_NS_9allocatorIS4_EEF6EntityvEE18destroy_deallocateEv", "__ZNSt3__210__function6__baseIFvRNS_6vectorI6EntityNS_9allocatorIS3_EEEEjjEED2Ev", "__ZNSt3__210__function6__funcIZN10PlayTetrisC1E19TetrisConfigurationEUlRNS_6vectorI6EntityNS_9allocatorIS5_EEEEjjE_NS6_ISA_EEFvS9_jjEED0Ev", "__ZNSt3__210__function6__funcIZN10PlayTetrisC1E19TetrisConfigurationEUlRNS_6vectorI6EntityNS_9allocatorIS5_EEEEjjE_NS6_ISA_EEFvS9_jjEE7destroyEv", "__ZNSt3__210__function6__funcIZN10PlayTetrisC1E19TetrisConfigurationEUlRNS_6vectorI6EntityNS_9allocatorIS5_EEEEjjE_NS6_ISA_EEFvS9_jjEE18destroy_deallocateEv", "__ZNSt3__214__shared_countD2Ev", "__ZNSt3__220__shared_ptr_pointerIP10EntityGridNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP10EntityGridNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP10EntityGridNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__220__shared_ptr_pointerIP9ComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP9ComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP9ComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__220__shared_ptr_pointerIP10PlayTetrisNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP10PlayTetrisNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP10PlayTetrisNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__220__shared_ptr_pointerIP5Mode1NS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP5Mode1NS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP5Mode1NS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__210__function6__baseIFvvEED2Ev", "__ZNSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEED0Ev", "__ZNSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEE7destroyEv", "__ZNSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEE18destroy_deallocateEv", "__ZNSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEEclEv", "__ZNSt3__217bad_function_callD2Ev", "__ZNSt3__217bad_function_callD0Ev", "__ZN10__cxxabiv116__shim_type_infoD2Ev", "__ZN10__cxxabiv117__class_type_infoD0Ev", "__ZNK10__cxxabiv116__shim_type_info5noop1Ev", "__ZNK10__cxxabiv116__shim_type_info5noop2Ev", "__ZN10__cxxabiv120__si_class_type_infoD0Ev", "__ZNSt11logic_errorD2Ev", "__ZNSt11logic_errorD0Ev", "__ZNSt12length_errorD0Ev", "__ZN10__cxxabiv121__vmi_class_type_infoD0Ev", "__ZN10__cxxabiv112_GLOBAL__N_19destruct_EPv", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0" ];

var debug_table_vidi = [ "0", "__ZN10PlayTetris4loopEfRKNSt3__26vectorIbNS0_9allocatorIbEEEE", "__ZN6Screen4loopEfRKNSt3__26vectorIbNS0_9allocatorIbEEEE", "0" ];

var debug_table_vii = [ "0", "__ZN6Screen7onKeyUpEi", "__ZN10PlayTetris9onKeyDownEi", "__ZN6Screen9onKeyDownEi", "__ZNKSt3__210__function6__funcIZN10PlayTetrisC1E19TetrisConfigurationEUlvE_NS_9allocatorIS4_EEF6EntityvEE7__cloneEPNS0_6__baseIS8_EE", "__ZNSt3__210__function6__funcIZN10PlayTetrisC1E19TetrisConfigurationEUlvE_NS_9allocatorIS4_EEF6EntityvEEclEv", "__ZNKSt3__210__function6__funcIZN10PlayTetrisC1E19TetrisConfigurationEUlRNS_6vectorI6EntityNS_9allocatorIS5_EEEEjjE_NS6_ISA_EEFvS9_jjEE7__cloneEPNS0_6__baseISC_EE", "__ZNKSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEE7__cloneEPNS0_6__baseIS5_EE" ];

var debug_table_viid = [ "0" ];

var debug_table_viii = [ "0", "__ZN9Component8addChildERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEENS0_10shared_ptrIS_EE" ];

var debug_table_viiii = [ "0", "__ZNSt3__210__function6__funcIZN10PlayTetrisC1E19TetrisConfigurationEUlRNS_6vectorI6EntityNS_9allocatorIS5_EEEEjjE_NS6_ISA_EEFvS9_jjEEclES9_OjSE_", "__ZN13DrawComponent8doLayoutERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN13DrawComponent16doLayoutEntitiesERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN9Component8doLayoutERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN9Component16doLayoutEntitiesERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZNK10__cxxabiv117__class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi", "__ZNK10__cxxabiv120__si_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi", "__ZNK10__cxxabiv121__vmi_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi", "0", "0", "0", "0", "0", "0", "0" ];

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
 "P": ___syscall221,
 "Q": ___syscall3,
 "R": ___syscall5,
 "S": ___syscall54,
 "T": ___syscall6,
 "U": ___unlock,
 "V": _abort,
 "W": _emscripten_get_heap_size,
 "X": _emscripten_get_now,
 "Y": _emscripten_memcpy_big,
 "Z": _emscripten_resize_heap,
 "_": _emscripten_set_main_loop,
 "$": _emscripten_set_main_loop_timing,
 "aa": _getCanvasHeight,
 "ab": _getCanvasWidth,
 "ac": _pthread_getspecific,
 "ad": _pthread_key_create,
 "ae": _pthread_once,
 "af": _pthread_setspecific,
 "ag": abortOnCannotGrowMemory,
 "ah": tempDoublePtr,
 "ai": DYNAMICTOP_PTR
};

// EMSCRIPTEN_START_ASM


var asm = (/** @suppress {uselessCode} */ function(global,env,buffer) {
"use asm";var a=new global.Int8Array(buffer),b=new global.Int16Array(buffer),c=new global.Int32Array(buffer),d=new global.Uint8Array(buffer),e=new global.Uint16Array(buffer),f=new global.Float32Array(buffer),g=new global.Float64Array(buffer),h=env.ah|0,i=env.ai|0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0.0,r=global.Math.imul,s=global.Math.clz32,t=env.a,u=env.b,v=env.c,w=env.d,x=env.e,y=env.f,z=env.g,A=env.h,B=env.i,C=env.j,D=env.k,E=env.l,F=env.m,G=env.n,H=env.o,I=env.p,J=env.q,K=env.r,L=env.s,M=env.t,N=env.u,O=env.v,P=env.w,Q=env.x,R=env.y,S=env.z,T=env.A,U=env.B,V=env.C,W=env.D,X=env.E,Y=env.F,Z=env.G,_=env.H,$=env.I,aa=env.J,ba=env.K,ca=env.L,da=env.M,ea=env.N,fa=env.O,ga=env.P,ha=env.Q,ia=env.R,ja=env.S,ka=env.T,la=env.U,ma=env.V,na=env.W,oa=env.X,pa=env.Y,qa=env.Z,ra=env._,sa=env.$,ta=env.aa,ua=env.ab,va=env.ac,wa=env.ad,xa=env.ae,ya=env.af,za=env.ag,Aa=10848,Ba=5253728,Ca=0.0;
// EMSCRIPTEN_START_FUNCS
function Pa(a){a=a|0;var b=0;b=Aa;Aa=Aa+a|0;Aa=Aa+15&-16;if((Aa|0)>=(Ba|0))w(a|0);return b|0}function Qa(){return Aa|0}function Ra(a){a=a|0;Aa=a}function Sa(a,b){a=a|0;b=b|0;Aa=a;Ba=b}function Ta(){return 3864}function Ua(){return 3962}function Va(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,x=0,y=0,z=0,A=0,B=0;b=Aa;Aa=Aa+432|0;if((Aa|0)>=(Ba|0))w(432);d=b+336|0;e=b+288|0;f=b+240|0;g=b+192|0;h=b+144|0;i=b+96|0;j=b+48|0;k=b;c[e>>2]=0;l=e+4|0;c[l>>2]=0;m=e+8|0;c[m>>2]=0;n=Rd(16)|0;c[e>>2]=n;o=n+16|0;c[m>>2]=o;c[n>>2]=0;c[n+4>>2]=1;c[n+8>>2]=0;c[n+12>>2]=0;c[l>>2]=o;o=e+12|0;c[o>>2]=0;l=e+16|0;c[l>>2]=0;m=e+20|0;c[m>>2]=0;p=Rd(16)|0;c[o>>2]=p;o=p+16|0;c[m>>2]=o;c[p>>2]=0;c[p+4>>2]=1;c[p+8>>2]=0;c[p+12>>2]=0;c[l>>2]=o;o=e+24|0;c[o>>2]=0;l=e+28|0;c[l>>2]=0;m=e+32|0;c[m>>2]=0;q=Rd(16)|0;c[o>>2]=q;o=q+16|0;c[m>>2]=o;c[q>>2]=0;c[q+4>>2]=1;c[q+8>>2]=1;c[q+12>>2]=0;c[l>>2]=o;o=e+36|0;c[o>>2]=0;l=e+40|0;c[l>>2]=0;m=e+44|0;c[m>>2]=0;r=Rd(16)|0;c[o>>2]=r;o=r+16|0;c[m>>2]=o;c[r>>2]=0;c[r+4>>2]=0;c[r+8>>2]=0;c[r+12>>2]=0;c[l>>2]=o;c[d>>2]=0;o=d+4|0;c[o>>2]=0;l=d+8|0;c[l>>2]=0;m=Rd(48)|0;c[o>>2]=m;c[d>>2]=m;c[l>>2]=m+48;c[m>>2]=0;l=m+4|0;c[l>>2]=0;s=m+8|0;c[s>>2]=0;t=Rd(16)|0;c[m>>2]=t;c[s>>2]=t+16;c[t>>2]=c[n>>2];c[t+4>>2]=c[n+4>>2];c[t+8>>2]=c[n+8>>2];c[t+12>>2]=c[n+12>>2];c[l>>2]=t+16;t=m+12|0;c[o>>2]=t;c[t>>2]=0;l=m+16|0;c[l>>2]=0;n=m+20|0;c[n>>2]=0;s=Rd(16)|0;c[t>>2]=s;c[n>>2]=s+16;c[s>>2]=c[p>>2];c[s+4>>2]=c[p+4>>2];c[s+8>>2]=c[p+8>>2];c[s+12>>2]=c[p+12>>2];c[l>>2]=s+16;s=m+24|0;c[o>>2]=s;c[s>>2]=0;l=m+28|0;c[l>>2]=0;p=m+32|0;c[p>>2]=0;n=Rd(16)|0;c[s>>2]=n;c[p>>2]=n+16;c[n>>2]=c[q>>2];c[n+4>>2]=c[q+4>>2];c[n+8>>2]=c[q+8>>2];c[n+12>>2]=c[q+12>>2];c[l>>2]=n+16;n=m+36|0;c[o>>2]=n;c[n>>2]=0;l=m+40|0;c[l>>2]=0;q=m+44|0;c[q>>2]=0;p=Rd(16)|0;c[n>>2]=p;c[q>>2]=p+16;c[p>>2]=c[r>>2];c[p+4>>2]=c[r+4>>2];c[p+8>>2]=c[r+8>>2];c[p+12>>2]=c[r+12>>2];c[l>>2]=p+16;c[o>>2]=m+48;m=d+12|0;c[f>>2]=0;o=f+4|0;c[o>>2]=0;p=f+8|0;c[p>>2]=0;l=Rd(16)|0;c[f>>2]=l;r=l+16|0;c[p>>2]=r;c[l>>2]=0;c[l+4>>2]=0;c[l+8>>2]=1;c[l+12>>2]=0;c[o>>2]=r;r=f+12|0;c[r>>2]=0;o=f+16|0;c[o>>2]=0;p=f+20|0;c[p>>2]=0;q=Rd(16)|0;c[r>>2]=q;r=q+16|0;c[p>>2]=r;c[q>>2]=0;c[q+4>>2]=0;c[q+8>>2]=1;c[q+12>>2]=0;c[o>>2]=r;r=f+24|0;c[r>>2]=0;o=f+28|0;c[o>>2]=0;p=f+32|0;c[p>>2]=0;n=Rd(16)|0;c[r>>2]=n;r=n+16|0;c[p>>2]=r;c[n>>2]=0;c[n+4>>2]=1;c[n+8>>2]=1;c[n+12>>2]=0;c[o>>2]=r;r=f+36|0;c[r>>2]=0;o=f+40|0;c[o>>2]=0;p=f+44|0;c[p>>2]=0;s=Rd(16)|0;c[r>>2]=s;r=s+16|0;c[p>>2]=r;c[s>>2]=0;c[s+4>>2]=0;c[s+8>>2]=0;c[s+12>>2]=0;c[o>>2]=r;c[m>>2]=0;r=d+16|0;c[r>>2]=0;o=d+20|0;c[o>>2]=0;p=Rd(48)|0;c[r>>2]=p;c[m>>2]=p;c[o>>2]=p+48;c[p>>2]=0;o=p+4|0;c[o>>2]=0;m=p+8|0;c[m>>2]=0;t=Rd(16)|0;c[p>>2]=t;c[m>>2]=t+16;c[t>>2]=c[l>>2];c[t+4>>2]=c[l+4>>2];c[t+8>>2]=c[l+8>>2];c[t+12>>2]=c[l+12>>2];c[o>>2]=t+16;t=p+12|0;c[r>>2]=t;c[t>>2]=0;o=p+16|0;c[o>>2]=0;l=p+20|0;c[l>>2]=0;m=Rd(16)|0;c[t>>2]=m;c[l>>2]=m+16;c[m>>2]=c[q>>2];c[m+4>>2]=c[q+4>>2];c[m+8>>2]=c[q+8>>2];c[m+12>>2]=c[q+12>>2];c[o>>2]=m+16;m=p+24|0;c[r>>2]=m;c[m>>2]=0;o=p+28|0;c[o>>2]=0;q=p+32|0;c[q>>2]=0;l=Rd(16)|0;c[m>>2]=l;c[q>>2]=l+16;c[l>>2]=c[n>>2];c[l+4>>2]=c[n+4>>2];c[l+8>>2]=c[n+8>>2];c[l+12>>2]=c[n+12>>2];c[o>>2]=l+16;l=p+36|0;c[r>>2]=l;c[l>>2]=0;o=p+40|0;c[o>>2]=0;n=p+44|0;c[n>>2]=0;q=Rd(16)|0;c[l>>2]=q;c[n>>2]=q+16;c[q>>2]=c[s>>2];c[q+4>>2]=c[s+4>>2];c[q+8>>2]=c[s+8>>2];c[q+12>>2]=c[s+12>>2];c[o>>2]=q+16;c[r>>2]=p+48;p=d+24|0;c[g>>2]=0;r=g+4|0;c[r>>2]=0;q=g+8|0;c[q>>2]=0;o=Rd(16)|0;c[g>>2]=o;s=o+16|0;c[q>>2]=s;c[o>>2]=0;c[o+4>>2]=0;c[o+8>>2]=0;c[o+12>>2]=0;c[r>>2]=s;s=g+12|0;c[s>>2]=0;r=g+16|0;c[r>>2]=0;q=g+20|0;c[q>>2]=0;n=Rd(16)|0;c[s>>2]=n;s=n+16|0;c[q>>2]=s;c[n>>2]=0;c[n+4>>2]=1;c[n+8>>2]=0;c[n+12>>2]=0;c[r>>2]=s;s=g+24|0;c[s>>2]=0;r=g+28|0;c[r>>2]=0;q=g+32|0;c[q>>2]=0;l=Rd(16)|0;c[s>>2]=l;s=l+16|0;c[q>>2]=s;c[l>>2]=1;c[l+4>>2]=1;c[l+8>>2]=1;c[l+12>>2]=0;c[r>>2]=s;s=g+36|0;c[s>>2]=0;r=g+40|0;c[r>>2]=0;q=g+44|0;c[q>>2]=0;m=Rd(16)|0;c[s>>2]=m;s=m+16|0;c[q>>2]=s;c[m>>2]=0;c[m+4>>2]=0;c[m+8>>2]=0;c[m+12>>2]=0;c[r>>2]=s;c[p>>2]=0;s=d+28|0;c[s>>2]=0;r=d+32|0;c[r>>2]=0;q=Rd(48)|0;c[s>>2]=q;c[p>>2]=q;c[r>>2]=q+48;c[q>>2]=0;r=q+4|0;c[r>>2]=0;p=q+8|0;c[p>>2]=0;t=Rd(16)|0;c[q>>2]=t;c[p>>2]=t+16;c[t>>2]=c[o>>2];c[t+4>>2]=c[o+4>>2];c[t+8>>2]=c[o+8>>2];c[t+12>>2]=c[o+12>>2];c[r>>2]=t+16;t=q+12|0;c[s>>2]=t;c[t>>2]=0;r=q+16|0;c[r>>2]=0;o=q+20|0;c[o>>2]=0;p=Rd(16)|0;c[t>>2]=p;c[o>>2]=p+16;c[p>>2]=c[n>>2];c[p+4>>2]=c[n+4>>2];c[p+8>>2]=c[n+8>>2];c[p+12>>2]=c[n+12>>2];c[r>>2]=p+16;p=q+24|0;c[s>>2]=p;c[p>>2]=0;r=q+28|0;c[r>>2]=0;n=q+32|0;c[n>>2]=0;o=Rd(16)|0;c[p>>2]=o;c[n>>2]=o+16;c[o>>2]=c[l>>2];c[o+4>>2]=c[l+4>>2];c[o+8>>2]=c[l+8>>2];c[o+12>>2]=c[l+12>>2];c[r>>2]=o+16;o=q+36|0;c[s>>2]=o;c[o>>2]=0;r=q+40|0;c[r>>2]=0;l=q+44|0;c[l>>2]=0;n=Rd(16)|0;c[o>>2]=n;c[l>>2]=n+16;c[n>>2]=c[m>>2];c[n+4>>2]=c[m+4>>2];c[n+8>>2]=c[m+8>>2];c[n+12>>2]=c[m+12>>2];c[r>>2]=n+16;c[s>>2]=q+48;q=d+36|0;c[h>>2]=0;s=h+4|0;c[s>>2]=0;n=h+8|0;c[n>>2]=0;r=Rd(16)|0;c[h>>2]=r;m=r+16|0;c[n>>2]=m;c[r>>2]=0;c[r+4>>2]=0;c[r+8>>2]=0;c[r+12>>2]=0;c[s>>2]=m;m=h+12|0;c[m>>2]=0;s=h+16|0;c[s>>2]=0;n=h+20|0;c[n>>2]=0;l=Rd(16)|0;c[m>>2]=l;m=l+16|0;c[n>>2]=m;c[l>>2]=1;c[l+4>>2]=1;c[l+8>>2]=0;c[l+12>>2]=0;c[s>>2]=m;m=h+24|0;c[m>>2]=0;s=h+28|0;c[s>>2]=0;n=h+32|0;c[n>>2]=0;o=Rd(16)|0;c[m>>2]=o;m=o+16|0;c[n>>2]=m;c[o>>2]=0;c[o+4>>2]=1;c[o+8>>2]=1;c[o+12>>2]=0;c[s>>2]=m;m=h+36|0;c[m>>2]=0;s=h+40|0;c[s>>2]=0;n=h+44|0;c[n>>2]=0;p=Rd(16)|0;c[m>>2]=p;m=p+16|0;c[n>>2]=m;c[p>>2]=0;c[p+4>>2]=0;c[p+8>>2]=0;c[p+12>>2]=0;c[s>>2]=m;c[q>>2]=0;m=d+40|0;c[m>>2]=0;s=d+44|0;c[s>>2]=0;n=Rd(48)|0;c[m>>2]=n;c[q>>2]=n;c[s>>2]=n+48;c[n>>2]=0;s=n+4|0;c[s>>2]=0;q=n+8|0;c[q>>2]=0;t=Rd(16)|0;c[n>>2]=t;c[q>>2]=t+16;c[t>>2]=c[r>>2];c[t+4>>2]=c[r+4>>2];c[t+8>>2]=c[r+8>>2];c[t+12>>2]=c[r+12>>2];c[s>>2]=t+16;t=n+12|0;c[m>>2]=t;c[t>>2]=0;s=n+16|0;c[s>>2]=0;r=n+20|0;c[r>>2]=0;q=Rd(16)|0;c[t>>2]=q;c[r>>2]=q+16;c[q>>2]=c[l>>2];c[q+4>>2]=c[l+4>>2];c[q+8>>2]=c[l+8>>2];c[q+12>>2]=c[l+12>>2];c[s>>2]=q+16;q=n+24|0;c[m>>2]=q;c[q>>2]=0;s=n+28|0;c[s>>2]=0;l=n+32|0;c[l>>2]=0;r=Rd(16)|0;c[q>>2]=r;c[l>>2]=r+16;c[r>>2]=c[o>>2];c[r+4>>2]=c[o+4>>2];c[r+8>>2]=c[o+8>>2];c[r+12>>2]=c[o+12>>2];c[s>>2]=r+16;r=n+36|0;c[m>>2]=r;c[r>>2]=0;s=n+40|0;c[s>>2]=0;o=n+44|0;c[o>>2]=0;l=Rd(16)|0;c[r>>2]=l;c[o>>2]=l+16;c[l>>2]=c[p>>2];c[l+4>>2]=c[p+4>>2];c[l+8>>2]=c[p+8>>2];c[l+12>>2]=c[p+12>>2];c[s>>2]=l+16;c[m>>2]=n+48;n=d+48|0;c[i>>2]=0;m=i+4|0;c[m>>2]=0;l=i+8|0;c[l>>2]=0;s=Rd(16)|0;c[i>>2]=s;p=s+16|0;c[l>>2]=p;c[s>>2]=0;c[s+4>>2]=0;c[s+8>>2]=0;c[s+12>>2]=0;c[m>>2]=p;p=i+12|0;c[p>>2]=0;m=i+16|0;c[m>>2]=0;l=i+20|0;c[l>>2]=0;o=Rd(16)|0;c[p>>2]=o;p=o+16|0;c[l>>2]=p;c[o>>2]=0;c[o+4>>2]=1;c[o+8>>2]=1;c[o+12>>2]=0;c[m>>2]=p;p=i+24|0;c[p>>2]=0;m=i+28|0;c[m>>2]=0;l=i+32|0;c[l>>2]=0;r=Rd(16)|0;c[p>>2]=r;p=r+16|0;c[l>>2]=p;c[r>>2]=1;c[r+4>>2]=1;c[r+8>>2]=0;c[r+12>>2]=0;c[m>>2]=p;p=i+36|0;c[p>>2]=0;m=i+40|0;c[m>>2]=0;l=i+44|0;c[l>>2]=0;q=Rd(16)|0;c[p>>2]=q;p=q+16|0;c[l>>2]=p;c[q>>2]=0;c[q+4>>2]=0;c[q+8>>2]=0;c[q+12>>2]=0;c[m>>2]=p;c[n>>2]=0;p=d+52|0;c[p>>2]=0;m=d+56|0;c[m>>2]=0;l=Rd(48)|0;c[p>>2]=l;c[n>>2]=l;c[m>>2]=l+48;c[l>>2]=0;m=l+4|0;c[m>>2]=0;n=l+8|0;c[n>>2]=0;t=Rd(16)|0;c[l>>2]=t;c[n>>2]=t+16;c[t>>2]=c[s>>2];c[t+4>>2]=c[s+4>>2];c[t+8>>2]=c[s+8>>2];c[t+12>>2]=c[s+12>>2];c[m>>2]=t+16;t=l+12|0;c[p>>2]=t;c[t>>2]=0;m=l+16|0;c[m>>2]=0;s=l+20|0;c[s>>2]=0;n=Rd(16)|0;c[t>>2]=n;c[s>>2]=n+16;c[n>>2]=c[o>>2];c[n+4>>2]=c[o+4>>2];c[n+8>>2]=c[o+8>>2];c[n+12>>2]=c[o+12>>2];c[m>>2]=n+16;n=l+24|0;c[p>>2]=n;c[n>>2]=0;m=l+28|0;c[m>>2]=0;o=l+32|0;c[o>>2]=0;s=Rd(16)|0;c[n>>2]=s;c[o>>2]=s+16;c[s>>2]=c[r>>2];c[s+4>>2]=c[r+4>>2];c[s+8>>2]=c[r+8>>2];c[s+12>>2]=c[r+12>>2];c[m>>2]=s+16;s=l+36|0;c[p>>2]=s;c[s>>2]=0;m=l+40|0;c[m>>2]=0;r=l+44|0;c[r>>2]=0;o=Rd(16)|0;c[s>>2]=o;c[r>>2]=o+16;c[o>>2]=c[q>>2];c[o+4>>2]=c[q+4>>2];c[o+8>>2]=c[q+8>>2];c[o+12>>2]=c[q+12>>2];c[m>>2]=o+16;c[p>>2]=l+48;l=d+60|0;c[j>>2]=0;p=j+4|0;c[p>>2]=0;o=j+8|0;c[o>>2]=0;m=Rd(16)|0;c[j>>2]=m;q=m+16|0;c[o>>2]=q;c[m>>2]=0;c[m+4>>2]=0;c[m+8>>2]=0;c[m+12>>2]=0;c[p>>2]=q;q=j+12|0;c[q>>2]=0;p=j+16|0;c[p>>2]=0;o=j+20|0;c[o>>2]=0;r=Rd(16)|0;c[q>>2]=r;q=r+16|0;c[o>>2]=q;c[r>>2]=0;c[r+4>>2]=1;c[r+8>>2]=1;c[r+12>>2]=0;c[p>>2]=q;q=j+24|0;c[q>>2]=0;p=j+28|0;c[p>>2]=0;o=j+32|0;c[o>>2]=0;s=Rd(16)|0;c[q>>2]=s;q=s+16|0;c[o>>2]=q;c[s>>2]=0;c[s+4>>2]=1;c[s+8>>2]=1;c[s+12>>2]=0;c[p>>2]=q;q=j+36|0;c[q>>2]=0;p=j+40|0;c[p>>2]=0;o=j+44|0;c[o>>2]=0;n=Rd(16)|0;c[q>>2]=n;q=n+16|0;c[o>>2]=q;c[n>>2]=0;c[n+4>>2]=0;c[n+8>>2]=0;c[n+12>>2]=0;c[p>>2]=q;c[l>>2]=0;q=d+64|0;c[q>>2]=0;p=d+68|0;c[p>>2]=0;o=Rd(48)|0;c[q>>2]=o;c[l>>2]=o;c[p>>2]=o+48;c[o>>2]=0;p=o+4|0;c[p>>2]=0;l=o+8|0;c[l>>2]=0;t=Rd(16)|0;c[o>>2]=t;c[l>>2]=t+16;c[t>>2]=c[m>>2];c[t+4>>2]=c[m+4>>2];c[t+8>>2]=c[m+8>>2];c[t+12>>2]=c[m+12>>2];c[p>>2]=t+16;t=o+12|0;c[q>>2]=t;c[t>>2]=0;p=o+16|0;c[p>>2]=0;m=o+20|0;c[m>>2]=0;l=Rd(16)|0;c[t>>2]=l;c[m>>2]=l+16;c[l>>2]=c[r>>2];c[l+4>>2]=c[r+4>>2];c[l+8>>2]=c[r+8>>2];c[l+12>>2]=c[r+12>>2];c[p>>2]=l+16;l=o+24|0;c[q>>2]=l;c[l>>2]=0;p=o+28|0;c[p>>2]=0;r=o+32|0;c[r>>2]=0;m=Rd(16)|0;c[l>>2]=m;c[r>>2]=m+16;c[m>>2]=c[s>>2];c[m+4>>2]=c[s+4>>2];c[m+8>>2]=c[s+8>>2];c[m+12>>2]=c[s+12>>2];c[p>>2]=m+16;m=o+36|0;c[q>>2]=m;c[m>>2]=0;p=o+40|0;c[p>>2]=0;s=o+44|0;c[s>>2]=0;r=Rd(16)|0;c[m>>2]=r;c[s>>2]=r+16;c[r>>2]=c[n>>2];c[r+4>>2]=c[n+4>>2];c[r+8>>2]=c[n+8>>2];c[r+12>>2]=c[n+12>>2];c[p>>2]=r+16;c[q>>2]=o+48;o=d+72|0;c[k>>2]=0;q=k+4|0;c[q>>2]=0;r=k+8|0;c[r>>2]=0;p=Rd(16)|0;c[k>>2]=p;n=p+16|0;c[r>>2]=n;c[p>>2]=0;c[p+4>>2]=0;c[p+8>>2]=0;c[p+12>>2]=0;c[q>>2]=n;n=k+12|0;c[n>>2]=0;q=k+16|0;c[q>>2]=0;r=k+20|0;c[r>>2]=0;s=Rd(16)|0;c[n>>2]=s;n=s+16|0;c[r>>2]=n;c[s>>2]=0;c[s+4>>2]=0;c[s+8>>2]=0;c[s+12>>2]=0;c[q>>2]=n;n=k+24|0;c[n>>2]=0;q=k+28|0;c[q>>2]=0;r=k+32|0;c[r>>2]=0;m=Rd(16)|0;c[n>>2]=m;n=m+16|0;c[r>>2]=n;c[m>>2]=1;c[m+4>>2]=1;c[m+8>>2]=1;c[m+12>>2]=1;c[q>>2]=n;n=k+36|0;c[n>>2]=0;q=k+40|0;c[q>>2]=0;r=k+44|0;c[r>>2]=0;l=Rd(16)|0;c[n>>2]=l;n=l+16|0;c[r>>2]=n;c[l>>2]=0;c[l+4>>2]=0;c[l+8>>2]=0;c[l+12>>2]=0;c[q>>2]=n;c[o>>2]=0;n=d+76|0;c[n>>2]=0;q=d+80|0;c[q>>2]=0;r=Rd(48)|0;c[n>>2]=r;c[o>>2]=r;c[q>>2]=r+48;c[r>>2]=0;q=r+4|0;c[q>>2]=0;o=r+8|0;c[o>>2]=0;t=Rd(16)|0;c[r>>2]=t;c[o>>2]=t+16;c[t>>2]=c[p>>2];c[t+4>>2]=c[p+4>>2];c[t+8>>2]=c[p+8>>2];c[t+12>>2]=c[p+12>>2];c[q>>2]=t+16;t=r+12|0;c[n>>2]=t;c[t>>2]=0;q=r+16|0;c[q>>2]=0;p=r+20|0;c[p>>2]=0;o=Rd(16)|0;c[t>>2]=o;c[p>>2]=o+16;c[o>>2]=c[s>>2];c[o+4>>2]=c[s+4>>2];c[o+8>>2]=c[s+8>>2];c[o+12>>2]=c[s+12>>2];c[q>>2]=o+16;o=r+24|0;c[n>>2]=o;c[o>>2]=0;q=r+28|0;c[q>>2]=0;s=r+32|0;c[s>>2]=0;p=Rd(16)|0;c[o>>2]=p;c[s>>2]=p+16;c[p>>2]=c[m>>2];c[p+4>>2]=c[m+4>>2];c[p+8>>2]=c[m+8>>2];c[p+12>>2]=c[m+12>>2];c[q>>2]=p+16;p=r+36|0;c[n>>2]=p;c[p>>2]=0;q=r+40|0;c[q>>2]=0;m=r+44|0;c[m>>2]=0;s=Rd(16)|0;c[p>>2]=s;c[m>>2]=s+16;c[s>>2]=c[l>>2];c[s+4>>2]=c[l+4>>2];c[s+8>>2]=c[l+8>>2];c[s+12>>2]=c[l+12>>2];c[q>>2]=s+16;c[n>>2]=r+48;c[a>>2]=0;r=a+4|0;c[r>>2]=0;n=a+8|0;c[n>>2]=0;s=Rd(84)|0;c[r>>2]=s;c[a>>2]=s;c[n>>2]=s+84;jb(s,d);n=s+12|0;c[r>>2]=n;jb(n,d+12|0);n=s+24|0;c[r>>2]=n;jb(n,d+24|0);n=s+36|0;c[r>>2]=n;jb(n,d+36|0);n=s+48|0;c[r>>2]=n;jb(n,d+48|0);n=s+60|0;c[r>>2]=n;jb(n,d+60|0);n=s+72|0;c[r>>2]=n;jb(n,d+72|0);c[r>>2]=s+84;s=d+72|0;r=c[s>>2]|0;if(r|0){n=d+76|0;a=c[n>>2]|0;if((a|0)==(r|0))u=r;else{q=a;do{a=q;q=q+-12|0;l=c[q>>2]|0;if(l|0){c[a+-8>>2]=l;Sd(l)}}while((q|0)!=(r|0));u=c[s>>2]|0}c[n>>2]=r;Sd(u)}u=d+60|0;r=c[u>>2]|0;if(r|0){n=d+64|0;s=c[n>>2]|0;if((s|0)==(r|0))v=r;else{q=s;do{s=q;q=q+-12|0;l=c[q>>2]|0;if(l|0){c[s+-8>>2]=l;Sd(l)}}while((q|0)!=(r|0));v=c[u>>2]|0}c[n>>2]=r;Sd(v)}v=d+48|0;r=c[v>>2]|0;if(r|0){n=d+52|0;u=c[n>>2]|0;if((u|0)==(r|0))x=r;else{q=u;do{u=q;q=q+-12|0;l=c[q>>2]|0;if(l|0){c[u+-8>>2]=l;Sd(l)}}while((q|0)!=(r|0));x=c[v>>2]|0}c[n>>2]=r;Sd(x)}x=d+36|0;r=c[x>>2]|0;if(r|0){n=d+40|0;v=c[n>>2]|0;if((v|0)==(r|0))y=r;else{q=v;do{v=q;q=q+-12|0;l=c[q>>2]|0;if(l|0){c[v+-8>>2]=l;Sd(l)}}while((q|0)!=(r|0));y=c[x>>2]|0}c[n>>2]=r;Sd(y)}y=d+24|0;r=c[y>>2]|0;if(r|0){n=d+28|0;x=c[n>>2]|0;if((x|0)==(r|0))z=r;else{q=x;do{x=q;q=q+-12|0;l=c[q>>2]|0;if(l|0){c[x+-8>>2]=l;Sd(l)}}while((q|0)!=(r|0));z=c[y>>2]|0}c[n>>2]=r;Sd(z)}z=d+12|0;r=c[z>>2]|0;if(r|0){n=d+16|0;y=c[n>>2]|0;if((y|0)==(r|0))A=r;else{q=y;do{y=q;q=q+-12|0;l=c[q>>2]|0;if(l|0){c[y+-8>>2]=l;Sd(l)}}while((q|0)!=(r|0));A=c[z>>2]|0}c[n>>2]=r;Sd(A)}A=c[d>>2]|0;if(A|0){r=d+4|0;n=c[r>>2]|0;if((n|0)==(A|0))B=A;else{z=n;do{n=z;z=z+-12|0;q=c[z>>2]|0;if(q|0){c[n+-8>>2]=q;Sd(q)}}while((z|0)!=(A|0));B=c[d>>2]|0}c[r>>2]=A;Sd(B)}B=c[k+36>>2]|0;if(B|0){c[k+40>>2]=B;Sd(B)}B=c[k+24>>2]|0;if(B|0){c[k+28>>2]=B;Sd(B)}B=c[k+12>>2]|0;if(B|0){c[k+16>>2]=B;Sd(B)}B=c[k>>2]|0;if(B|0){c[k+4>>2]=B;Sd(B)}B=c[j+36>>2]|0;if(B|0){c[j+40>>2]=B;Sd(B)}B=c[j+24>>2]|0;if(B|0){c[j+28>>2]=B;Sd(B)}B=c[j+12>>2]|0;if(B|0){c[j+16>>2]=B;Sd(B)}B=c[j>>2]|0;if(B|0){c[j+4>>2]=B;Sd(B)}B=c[i+36>>2]|0;if(B|0){c[i+40>>2]=B;Sd(B)}B=c[i+24>>2]|0;if(B|0){c[i+28>>2]=B;Sd(B)}B=c[i+12>>2]|0;if(B|0){c[i+16>>2]=B;Sd(B)}B=c[i>>2]|0;if(B|0){c[i+4>>2]=B;Sd(B)}B=c[h+36>>2]|0;if(B|0){c[h+40>>2]=B;Sd(B)}B=c[h+24>>2]|0;if(B|0){c[h+28>>2]=B;Sd(B)}B=c[h+12>>2]|0;if(B|0){c[h+16>>2]=B;Sd(B)}B=c[h>>2]|0;if(B|0){c[h+4>>2]=B;Sd(B)}B=c[g+36>>2]|0;if(B|0){c[g+40>>2]=B;Sd(B)}B=c[g+24>>2]|0;if(B|0){c[g+28>>2]=B;Sd(B)}B=c[g+12>>2]|0;if(B|0){c[g+16>>2]=B;Sd(B)}B=c[g>>2]|0;if(B|0){c[g+4>>2]=B;Sd(B)}B=c[f+36>>2]|0;if(B|0){c[f+40>>2]=B;Sd(B)}B=c[f+24>>2]|0;if(B|0){c[f+28>>2]=B;Sd(B)}B=c[f+12>>2]|0;if(B|0){c[f+16>>2]=B;Sd(B)}B=c[f>>2]|0;if(B|0){c[f+4>>2]=B;Sd(B)}B=c[e+36>>2]|0;if(B|0){c[e+40>>2]=B;Sd(B)}B=c[e+24>>2]|0;if(B|0){c[e+28>>2]=B;Sd(B)}B=c[e+12>>2]|0;if(B|0){c[e+16>>2]=B;Sd(B)}B=c[e>>2]|0;if(!B){Aa=b;return}c[e+4>>2]=B;Sd(B);Aa=b;return}function Wa(){var a=0,b=0;a=c[1856]|0;if(!a){b=X(4)|0;c[b>>2]=3688;$(b|0,2640,27)}else{Ha[c[(c[a>>2]|0)+24>>2]&63](a);return}}function Xa(){var b=0,d=0,e=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,x=0;b=Aa;Aa=Aa+160|0;if((Aa|0)>=(Ba|0))w(160);d=b+40|0;e=b+104|0;g=b;h=b+96|0;i=b+120|0;j=b+116|0;k=b+88|0;Ya(g);l=Rd(160)|0;c[i>>2]=0;c[i+4>>2]=0;c[i+8>>2]=0;c[i+12>>2]=0;c[i+16>>2]=0;c[i+20>>2]=0;c[i+24>>2]=0;c[i+28>>2]=0;m=i+12|0;c[m>>2]=10;c[m+4>>2]=24;m=i+20|0;c[m>>2]=0;c[m+4>>2]=9;Va(e);m=i+4|0;n=c[e+4>>2]|0;o=c[e+8>>2]|0;c[i>>2]=c[e>>2];c[m>>2]=n;c[i+8>>2]=o;a[i+32>>0]=0;Za(l,i);c[h>>2]=l;o=Rd(16)|0;c[o+4>>2]=0;c[o+8>>2]=0;c[o>>2]=3084;c[o+12>>2]=l;n=h+4|0;c[n>>2]=o;c[d>>2]=l;c[d+4>>2]=l;kc(h,d);l=c[i>>2]|0;if(l|0){o=c[m>>2]|0;if((o|0)==(l|0))p=l;else{q=o;do{o=q;q=q+-12|0;r=c[q>>2]|0;if(r|0){s=o+-8|0;o=c[s>>2]|0;if((o|0)==(r|0))t=r;else{u=o;do{o=u;u=u+-12|0;v=c[u>>2]|0;if(v|0){c[o+-8>>2]=v;Sd(v)}}while((u|0)!=(r|0));t=c[q>>2]|0}c[s>>2]=r;Sd(t)}}while((q|0)!=(l|0));p=c[i>>2]|0}c[m>>2]=l;Sd(p)}p=Rd(32)|0;l=p+4|0;c[l>>2]=0;c[l+4>>2]=0;c[l+8>>2]=0;c[l+12>>2]=0;c[l+16>>2]=0;c[l+20>>2]=0;c[l+24>>2]=0;c[p>>2]=3064;m=d+8|0;i=m+36|0;do{c[m>>2]=0;m=m+4|0}while((m|0)<(i|0));c[d+44>>2]=2;c[d>>2]=1112014848;c[d+4>>2]=1112014848;f[d+16>>2]=30.0;f[d+20>>2]=30.0;c[d+32>>2]=-1433862145;kb(l,d);c[j>>2]=0;c[d>>2]=c[j>>2];_a(e,p,d);p=c[h>>2]|0;j=c[n>>2]|0;l=(j|0)==0;if(l)x=g+32|0;else{m=j+4|0;c[m>>2]=(c[m>>2]|0)+1;c[m>>2]=(c[m>>2]|0)+1;x=g+32|0}c[x>>2]=p;p=g+36|0;x=c[p>>2]|0;c[p>>2]=j;if(x|0?(m=x+4|0,i=c[m>>2]|0,c[m>>2]=i+-1,(i|0)==0):0){Ha[c[(c[x>>2]|0)+8>>2]&63](x);Qd(x)}x=c[g+32>>2]|0;i=g+24|0;m=i;q=c[m+4>>2]|0;t=x+24|0;c[t>>2]=c[m>>2];c[t+4>>2]=q;q=c[x+16>>2]|0;if(q|0){t=c[(c[q>>2]|0)+4>>2]|0;f[d>>2]=0.0;f[d+4>>2]=0.0;Ma[t&15](q,x+4|0,d,i)}if(!l?(l=j+4|0,i=c[l>>2]|0,c[l>>2]=i+-1,(i|0)==0):0){Ha[c[(c[j>>2]|0)+8>>2]&63](j);Qd(j)}c[k>>2]=0;j=d+16|0;i=Rd(20)|0;c[i>>2]=3140;c[i+4>>2]=k;c[i+8>>2]=g;c[i+12>>2]=h;c[i+16>>2]=e;c[j>>2]=i;uc(d,7408);i=c[j>>2]|0;if((d|0)!=(i|0)){if(i|0)Ha[c[(c[i>>2]|0)+20>>2]&63](i)}else Ha[c[(c[i>>2]|0)+16>>2]&63](i);ra(2,0,1);i=c[e+4>>2]|0;if(i|0?(e=i+4|0,d=c[e>>2]|0,c[e>>2]=d+-1,(d|0)==0):0){Ha[c[(c[i>>2]|0)+8>>2]&63](i);Qd(i)}i=c[n>>2]|0;if(i|0?(n=i+4|0,d=c[n>>2]|0,c[n>>2]=d+-1,(d|0)==0):0){Ha[c[(c[i>>2]|0)+8>>2]&63](i);Qd(i)}i=c[p>>2]|0;if(i|0?(p=i+4|0,d=c[p>>2]|0,c[p>>2]=d+-1,(d|0)==0):0){Ha[c[(c[i>>2]|0)+8>>2]&63](i);Qd(i)}i=c[g>>2]|0;if(!i){Aa=b;return 1}Sd(i);Aa=b;return 1}function Ya(a){a=a|0;var b=0,d=0,e=0;c[a>>2]=0;b=a+4|0;c[b>>2]=0;d=a+8|0;c[d>>2]=0;e=Rd(512)|0;c[a>>2]=e;c[d>>2]=128;c[b>>2]=4096;kf(e|0,0,512)|0;c[a+12>>2]=0;g[a+16>>3]=+oa();e=a+24|0;c[e>>2]=0;c[e+4>>2]=0;c[e+8>>2]=0;c[e+12>>2]=0;O();S(32)|0;V(50,50,32,0)|0;return}function Za(b,d){b=b|0;d=d|0;var e=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0;e=Aa;Aa=Aa+144|0;if((Aa|0)>=(Ba|0))w(144);h=e+88|0;i=e+64|0;j=e+56|0;k=e+80|0;l=e+48|0;m=e+24|0;n=e;o=e+72|0;p=b+4|0;c[p>>2]=0;c[p+4>>2]=0;c[p+8>>2]=0;c[p+12>>2]=0;c[p+16>>2]=0;c[p+20>>2]=0;c[p+24>>2]=0;c[b>>2]=2840;g[b+32>>3]=200.0;p=b+40|0;q=b+56|0;r=b+60|0;c[p>>2]=0;c[p+4>>2]=0;c[p+8>>2]=0;c[p+12>>2]=0;c[p+16>>2]=0;c[p+20>>2]=0;c[b+64>>2]=1;c[b+68>>2]=0;c[b+72>>2]=0;ib(b+76|0,d);p=b+88|0;s=d+12|0;c[p>>2]=c[s>>2];c[p+4>>2]=c[s+4>>2];c[p+8>>2]=c[s+8>>2];c[p+12>>2]=c[s+12>>2];c[p+16>>2]=c[s+16>>2];a[p+20>>0]=a[s+20>>0]|0;p=b+112|0;c[p>>2]=0;c[p+4>>2]=0;c[p+8>>2]=0;c[p+12>>2]=0;c[p+16>>2]=0;p=d+20|0;t=c[p+4>>2]|0;u=b+132|0;c[u>>2]=c[p>>2];c[u+4>>2]=t;t=(((c[d+4>>2]|0)-(c[d>>2]|0)|0)/12|0)+-1|0;c[b+140>>2]=0;c[b+144>>2]=t;c[b+148>>2]=0;c[b+152>>2]=3;t=b+4|0;d=h+8|0;u=d+36|0;do{c[d>>2]=0;d=d+4|0}while((d|0)<(u|0));c[h+44>>2]=2;c[h>>2]=1112014848;c[h+4>>2]=1112014848;f[h+16>>2]=30.0;f[h+20>>2]=30.0;c[h+32>>2]=-7820545;p=b+8|0;v=c[p>>2]|0;if(v>>>0<(c[b+12>>2]|0)>>>0){d=v;v=h;u=d+48|0;do{c[d>>2]=c[v>>2];d=d+4|0;v=v+4|0}while((d|0)<(u|0));c[p>>2]=(c[p>>2]|0)+48}else kb(t,h);p=c[b+80>>2]|0;v=c[b+76>>2]|0;d=v;if((p|0)!=(v|0)){u=c[2489]|0;x=(c[2490]|0)-u>>2;y=(p-v|0)/12|0;v=0;p=0;while(1){z=c[d+(v*12|0)+4>>2]|0;A=c[d+(v*12|0)>>2]|0;B=A;if((z|0)!=(A|0)){C=(z-A|0)/12|0;A=u+(p<<2)|0;z=0;do{D=c[d+(z*12|0)+4>>2]|0;E=c[d+(z*12|0)>>2]|0;if((D|0)!=(E|0)){F=c[B+(z*12|0)>>2]|0;G=(D-E|0)/12|0;E=0;do{D=F+(E<<2)|0;H=c[D>>2]|0;if(H|0)c[D>>2]=c[A>>2]|H;E=E+1|0}while(E>>>0<G>>>0)}z=z+1|0}while(z>>>0<C>>>0)}v=v+1|0;if(v>>>0>=y>>>0)break;else p=((p+1|0)>>>0)%(x>>>0)|0}}x=Rd(224)|0;p=s;s=c[p+4>>2]|0;y=l;c[y>>2]=c[p>>2];c[y+4>>2]=s;s=m+16|0;c[m>>2]=2880;c[s>>2]=m;y=n+16|0;c[n>>2]=2924;c[y>>2]=n;c[h>>2]=c[l>>2];c[h+4>>2]=c[l+4>>2];ab(x,t,h,m,n);c[k>>2]=x;l=Rd(16)|0;c[l+4>>2]=0;c[l+8>>2]=0;c[l>>2]=3008;c[l+12>>2]=x;p=k+4|0;c[p>>2]=l;c[j>>2]=x;c[j+4>>2]=x;Lb(k,j);j=c[k>>2]|0;x=c[p>>2]|0;c[k>>2]=0;c[p>>2]=0;c[q>>2]=j;j=c[r>>2]|0;c[r>>2]=x;if(j|0?(x=j+4|0,k=c[x>>2]|0,c[x>>2]=k+-1,(k|0)==0):0){Ha[c[(c[j>>2]|0)+8>>2]&63](j);Qd(j)}j=c[p>>2]|0;if(j|0?(p=j+4|0,k=c[p>>2]|0,c[p>>2]=k+-1,(k|0)==0):0){Ha[c[(c[j>>2]|0)+8>>2]&63](j);Qd(j)}j=c[y>>2]|0;if((n|0)!=(j|0)){if(j|0)Ha[c[(c[j>>2]|0)+20>>2]&63](j)}else Ha[c[(c[j>>2]|0)+16>>2]&63](j);j=c[s>>2]|0;if((m|0)!=(j|0)){if(j|0)Ha[c[(c[j>>2]|0)+20>>2]&63](j)}else Ha[c[(c[j>>2]|0)+16>>2]&63](j);j=c[q>>2]|0;c[j+52>>2]=1;m=c[j+4>>2]|0;j=c[t>>2]|0;c[j+(m*48|0)+8>>2]=1065353216;c[j+(m*48|0)+12>>2]=1065353216;m=c[(c[q>>2]|0)+4>>2]|0;j=c[t>>2]|0;c[j+(m*48|0)+24>>2]=-1054867456;c[j+(m*48|0)+28>>2]=-1054867456;m=c[(c[q>>2]|0)+4>>2]|0;j=c[t>>2]|0;c[j+(m*48|0)>>2]=1056964608;c[j+(m*48|0)+4>>2]=1056964608;m=c[q>>2]|0;c[m+8>>2]=1056964608;c[m+12>>2]=1056964608;m=Rd(192)|0;bb(m,t);c[h>>2]=m;j=Rd(16)|0;c[j+4>>2]=0;c[j+8>>2]=0;c[j>>2]=3036;c[j+12>>2]=m;s=h+4|0;c[s>>2]=j;c[i>>2]=m;c[i+4>>2]=m;Qb(h,i);i=b+16|0;m=c[h>>2]|0;j=c[s>>2]|0;c[h>>2]=0;c[s>>2]=0;c[i>>2]=m;m=b+20|0;h=c[m>>2]|0;c[m>>2]=j;if(h|0?(j=h+4|0,m=c[j>>2]|0,c[j>>2]=m+-1,(m|0)==0):0){Ha[c[(c[h>>2]|0)+8>>2]&63](h);Qd(h)}h=c[s>>2]|0;if(h|0?(s=h+4|0,m=c[s>>2]|0,c[s>>2]=m+-1,(m|0)==0):0){Ha[c[(c[h>>2]|0)+8>>2]&63](h);Qd(h)}h=c[(c[i>>2]|0)+4>>2]|0;m=c[t>>2]|0;c[m+(h*48|0)+8>>2]=1065353216;c[m+(h*48|0)+12>>2]=1065353216;h=c[i>>2]|0;i=c[c[h>>2]>>2]|0;c[o>>2]=c[q>>2];q=o+4|0;m=c[r>>2]|0;c[q>>2]=m;if(m|0){r=m+4|0;c[r>>2]=(c[r>>2]|0)+1}La[i&1](h,t,o);o=c[q>>2]|0;if(!o){cb(b);Aa=e;return}q=o+4|0;t=c[q>>2]|0;c[q>>2]=t+-1;if(t|0){cb(b);Aa=e;return}Ha[c[(c[o>>2]|0)+8>>2]&63](o);Qd(o);cb(b);Aa=e;return}function _a(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0;d=Aa;Aa=Aa+16|0;if((Aa|0)>=(Ba|0))w(16);e=d;c[a>>2]=b;f=Rd(16)|0;c[f+4>>2]=0;c[f+8>>2]=0;c[f>>2]=3112;c[f+12>>2]=b;c[a+4>>2]=f;c[e>>2]=b;c[e+4>>2]=b;kc(a,e);Aa=d;return}function $a(a){a=a|0;Y(a|0)|0;Ee()}function ab(a,b,d,e,g){a=a|0;b=b|0;d=d|0;e=e|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0.0,s=0,t=0,u=0,v=0,x=0,y=0.0;h=Aa;Aa=Aa+48|0;if((Aa|0)>=(Ba|0))w(48);i=h;bb(a,b);c[a>>2]=2968;j=d;k=c[j>>2]|0;l=c[j+4>>2]|0;j=a+188|0;c[j>>2]=k;c[j+4>>2]=l;l=a+200|0;j=g+16|0;m=c[j>>2]|0;do if(m)if((g|0)==(m|0)){c[a+216>>2]=l;n=c[j>>2]|0;Ja[c[(c[n>>2]|0)+12>>2]&7](n,l);break}else{c[a+216>>2]=Da[c[(c[m>>2]|0)+8>>2]&15](m)|0;break}else c[a+216>>2]=0;while(0);m=c[d+4>>2]|0;a:do if((k|0)>0){d=e+16|0;l=i+44|0;j=i+4|0;g=b+4|0;n=b+8|0;o=i+16|0;p=i+20|0;if((m|0)>0){q=0;b:while(1){r=+(q|0)*10.0;s=0;do{t=c[d>>2]|0;if(!t)break b;Ja[c[(c[t>>2]|0)+24>>2]&7](i,t);t=(c[l>>2]|0)+-2|0;if(t>>>0<5?(f[i>>2]=r,f[j>>2]=+(s|0)*10.0,(t|0)!=4):0){c[o>>2]=1090519040;c[p>>2]=1090519040}t=c[g>>2]|0;if((t|0)==(c[n>>2]|0))Jb(b,i);else{u=t;t=i;v=u+48|0;do{c[u>>2]=c[t>>2];u=u+4|0;t=t+4|0}while((u|0)<(v|0));c[g>>2]=(c[g>>2]|0)+48}s=s+1|0}while((s|0)<(m|0));q=q+1|0;if((q|0)>=(k|0)){x=g;break a}}q=X(4)|0;c[q>>2]=3688;$(q|0,2640,27)}else x=g}else x=b+4|0;while(0);i=c[b>>2]|0;c[i+((c[a+4>>2]|0)*48|0)+36>>2]=(((c[x>>2]|0)-i|0)/48|0)+-1;r=+(k|0);y=+(m|0);f[a+24>>2]=r*10.0;f[a+28>>2]=y*10.0;f[a+48>>2]=r/y;Aa=h;return}function bb(d,e){d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0;f=Aa;Aa=Aa+48|0;if((Aa|0)>=(Ba|0))w(48);g=f;c[d>>2]=2988;h=d+4|0;i=e+4|0;j=c[i>>2]|0;k=(j-(c[e>>2]|0)|0)/48|0;l=d+8|0;c[d+80>>2]=0;a[d+88>>0]=0;a[d+89>>0]=0;c[d+112>>2]=0;c[d+136>>2]=0;c[d+160>>2]=0;m=d+168|0;d=l;n=d+48|0;do{c[d>>2]=0;d=d+4|0}while((d|0)<(n|0));b[l+48>>1]=0;c[m>>2]=0;c[m+4>>2]=0;c[m+8>>2]=0;c[m+12>>2]=0;c[m+16>>2]=0;c[h>>2]=k;d=g;n=d+40|0;do{c[d>>2]=0;d=d+4|0}while((d|0)<(n|0));c[g+44>>2]=1;c[g+32>>2]=k;c[g+40>>2]=1;if((c[e+8>>2]|0)>>>0>j>>>0){d=j;j=g;n=d+48|0;do{c[d>>2]=c[j>>2];d=d+4|0;j=j+4|0}while((d|0)<(n|0));j=(c[i>>2]|0)+48|0;c[i>>2]=j;o=j;p=c[e>>2]|0;q=o-p|0;r=(q|0)/48|0;s=r+-1|0;t=c[h>>2]|0;u=p;v=u+(t*48|0)+36|0;c[v>>2]=s;Aa=f;return}else{kb(e,g);o=c[i>>2]|0;p=c[e>>2]|0;q=o-p|0;r=(q|0)/48|0;s=r+-1|0;t=c[h>>2]|0;u=p;v=u+(t*48|0)+36|0;c[v>>2]=s;Aa=f;return}}function cb(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;b=Aa;Aa=Aa+48|0;if((Aa|0)>=(Ba|0))w(48);d=b+32|0;e=b+20|0;f=b+8|0;g=b;h=a+56|0;i=a+124|0;j=i;c[j>>2]=((c[(c[h>>2]|0)+188>>2]|0)/2|0)+-2;c[j+4>>2]=0;j=a+140|0;k=Xb(j,7456,j)|0;jb(e,(c[a+76>>2]|0)+(k*12|0)|0);k=c[h>>2]|0;jb(f,e);h=i;i=c[h+4>>2]|0;j=g;c[j>>2]=c[h>>2];c[j+4>>2]=i;c[d>>2]=c[g>>2];c[d+4>>2]=c[g+4>>2];Wb(k,a+4|0,f,d);d=c[f>>2]|0;if(d|0){k=f+4|0;g=c[k>>2]|0;if((g|0)==(d|0))l=d;else{i=g;do{g=i;i=i+-12|0;j=c[i>>2]|0;if(j|0){c[g+-8>>2]=j;Sd(j)}}while((i|0)!=(d|0));l=c[f>>2]|0}c[k>>2]=d;Sd(l)}l=a+112|0;if((l|0)!=(e|0))Yb(l,c[e>>2]|0,c[e+4>>2]|0);l=c[e>>2]|0;if(!l){Aa=b;return}a=e+4|0;d=c[a>>2]|0;if((d|0)==(l|0))m=l;else{k=d;do{d=k;k=k+-12|0;f=c[k>>2]|0;if(f|0){c[d+-8>>2]=f;Sd(f)}}while((k|0)!=(l|0));m=c[e>>2]|0}c[a>>2]=l;Sd(m);Aa=b;return}function db(a,b,d){a=a|0;b=+b;d=d|0;var e=0,f=0,h=0.0,i=0.0,j=0,k=0,l=0;e=(c[a+104>>2]|0)==1?2:1;f=c[d>>2]|0;if((c[f+136>>2]&131072|0)==0?(c[f+12>>2]&524288|0)==0:0)h=+g[a+32>>3];else h=+g[a+32>>3]/10.0;f=a+48|0;i=+g[f>>3]+b;g[f>>3]=i;j=a+40|0;if(!(i-+g[j>>3]>h))return;if(_b(a)|0){k=ac(a,e)|0;l=bc(a,e)|0;cc(a,-1,1);if(c[(c[d>>2]|0)+136>>2]&65536|0?!(k|(ac(a,e)|0)^1):0)dc(a,e);if(c[(c[d>>2]|0)+136>>2]&32768|0?!(l|(bc(a,e)|0)^1):0)ec(a,e)}else{$b(a);cb(a)}g[j>>3]=+g[f>>3];return}function eb(a,b){a=a|0;b=b|0;return}function fb(a,b){a=a|0;b=b|0;var d=0;d=(c[a+104>>2]|0)==1?2:1;switch(b|0){case 32:{if(!(_b(a)|0))return;do cc(a,-1,1);while(_b(a)|0);return}case 97:case 1104:{Jd(5452)|0;if(!(ac(a,d)|0))return;Jd(5469)|0;dc(a,d);return}case 100:case 1103:{if(!(bc(a,d)|0))return;ec(a,d);return}case 119:case 1106:{b=a+124|0;if(!(gc(a,b,4,d)|0))return;hc(a,b,4,d);return}default:return}}function gb(a,b,c){a=a|0;b=+b;c=c|0;return}function hb(a,b){a=a|0;b=b|0;return}function ib(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0;c[a>>2]=0;d=a+4|0;c[d>>2]=0;e=a+8|0;c[e>>2]=0;f=b+4|0;g=(c[f>>2]|0)-(c[b>>2]|0)|0;h=(g|0)/12|0;if(!g)return;if(h>>>0>357913941)ge(a);i=Rd(g)|0;c[d>>2]=i;c[a>>2]=i;c[e>>2]=i+(h*12|0);h=c[b>>2]|0;b=c[f>>2]|0;if((h|0)==(b|0))return;f=h;h=i;do{jb(h,f);f=f+12|0;h=(c[d>>2]|0)+12|0;c[d>>2]=h}while((f|0)!=(b|0));return}function jb(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0;c[a>>2]=0;d=a+4|0;c[d>>2]=0;e=a+8|0;c[e>>2]=0;f=b+4|0;g=(c[f>>2]|0)-(c[b>>2]|0)|0;h=(g|0)/12|0;if(!g)return;if(h>>>0>357913941)ge(a);i=Rd(g)|0;c[d>>2]=i;c[a>>2]=i;c[e>>2]=i+(h*12|0);h=c[b>>2]|0;b=c[f>>2]|0;if((h|0)==(b|0))return;f=h;h=i;while(1){c[h>>2]=0;i=h+4|0;c[i>>2]=0;e=h+8|0;c[e>>2]=0;a=f+4|0;g=(c[a>>2]|0)-(c[f>>2]|0)|0;j=g>>2;if(g|0){if(j>>>0>1073741823){k=8;break}l=Rd(g)|0;c[i>>2]=l;c[h>>2]=l;c[e>>2]=l+(j<<2);j=c[f>>2]|0;e=(c[a>>2]|0)-j|0;if((e|0)>0){hf(l|0,j|0,e|0)|0;c[i>>2]=l+(e>>>2<<2)}}f=f+12|0;e=(c[d>>2]|0)+12|0;c[d>>2]=e;if((f|0)==(b|0)){k=12;break}else h=e}if((k|0)==8)ge(h);else if((k|0)==12)return}function kb(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;d=a+4|0;e=c[a>>2]|0;f=(c[d>>2]|0)-e|0;g=(f|0)/48|0;h=g+1|0;if(h>>>0>89478485)ge(a);i=a+8|0;j=((c[i>>2]|0)-e|0)/48|0;k=j<<1;l=j>>>0<44739242?(k>>>0<h>>>0?h:k):89478485;do if(l)if(l>>>0>89478485){k=X(8)|0;Xd(k,4074);c[k>>2]=3812;$(k|0,2768,34)}else{m=Rd(l*48|0)|0;break}else m=0;while(0);k=m+(g*48|0)|0;g=m+(l*48|0)|0;l=k;m=b;b=l+48|0;do{c[l>>2]=c[m>>2];l=l+4|0;m=m+4|0}while((l|0)<(b|0));m=k+(((f|0)/-48|0)*48|0)|0;if((f|0)>0)hf(m|0,e|0,f|0)|0;c[a>>2]=m;c[d>>2]=k+48;c[i>>2]=g;if(!e)return;Sd(e);return}function lb(a){a=a|0;return}function mb(a){a=a|0;Sd(a);return}function nb(a){a=a|0;a=Rd(8)|0;c[a>>2]=2880;return a|0}function ob(a,b){a=a|0;b=b|0;c[b>>2]=2880;return}function pb(a){a=a|0;return}function qb(a){a=a|0;Sd(a);return}function rb(a,b){a=a|0;b=b|0;var d=0;b=a+8|0;d=b+36|0;do{c[b>>2]=0;b=b+4|0}while((b|0)<(d|0));c[a+44>>2]=5;c[a>>2]=0;c[a+4>>2]=0;c[a+16>>2]=0;c[a+20>>2]=0;f[a+24>>2]=3.0;f[a+28>>2]=1.0;c[a+32>>2]=-1;c[a+36>>2]=255;return}function sb(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==4306?a+4|0:0)|0}function tb(a){a=a|0;return 2448}function ub(a){a=a|0;Sd(a);return}function vb(a){a=a|0;a=Rd(8)|0;c[a>>2]=2924;return a|0}function wb(a,b){a=a|0;b=b|0;c[b>>2]=2924;return}function xb(a){a=a|0;return}function yb(a){a=a|0;Sd(a);return}function zb(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;a=c[d>>2]|0;d=c[b>>2]|0;b=d+(a*48|0)+36|0;if((c[d+(a*48|0)+44>>2]|0)!=5)return;c[b>>2]=c[b>>2]&255|c[e>>2]&-256;return}function Ab(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==4559?a+4|0:0)|0}function Bb(a){a=a|0;return 2480}function Cb(a){a=a|0;return}function Db(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0;e=c[d>>2]|0;f=c[b>>2]|0;c[f+((c[a+4>>2]|0)*48|0)+36>>2]=c[f+((c[e+4>>2]|0)*48|0)+36>>2];f=a+180|0;b=c[f>>2]|0;if((b|0)==(c[a+184>>2]|0)){Kb(a+176|0,d);return}c[b>>2]=e;e=c[d+4>>2]|0;c[b+4>>2]=e;if(!e)g=b;else{b=e+4|0;c[b>>2]=(c[b>>2]|0)+1;g=c[f>>2]|0}c[f>>2]=g+8;return}function Eb(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;f=Aa;Aa=Aa+16|0;if((Aa|0)>=(Ba|0))w(16);g=f+8|0;h=f;i=a+24|0;j=i;k=c[j+4>>2]|0;l=g;c[l>>2]=c[j>>2];c[l+4>>2]=k;k=a+16|0;l=k;j=c[l+4>>2]|0;m=h;c[m>>2]=c[l>>2];c[m+4>>2]=j;Ib(a,b,d,e);Ma[c[(c[a>>2]|0)+8>>2]&15](a,b,h,g);g=c[a+176>>2]|0;h=c[a+180>>2]|0;if((g|0)==(h|0)){Aa=f;return}a=g;do{g=c[a>>2]|0;e=c[a+4>>2]|0;if(e){d=e+4|0;c[d>>2]=(c[d>>2]|0)+1;Ma[c[(c[g>>2]|0)+4>>2]&15](g,b,k,i);d=e+4|0;j=c[d>>2]|0;c[d>>2]=j+-1;if(!j){Ha[c[(c[e>>2]|0)+8>>2]&63](e);Qd(e)}}else Ma[c[(c[g>>2]|0)+4>>2]&15](g,b,k,i);a=a+8|0}while((a|0)!=(h|0));Aa=f;return}function Fb(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0.0,r=0;g=a+4|0;h=c[g>>2]|0;i=c[b>>2]|0;j=(c[i+(h*48|0)+32>>2]|0)+1|0;if(j>>>0>(c[i+(h*48|0)+36>>2]|0)>>>0)return;h=d+4|0;k=e+4|0;l=a+16|0;m=a+24|0;n=a+20|0;o=a+28|0;a=j;j=i;while(1){if(((c[j+(a*48|0)+44>>2]|0)+-2|0)>>>0<5){i=j+(a*48|0)|0;p=j+(a*48|0)+4|0;q=+f[n>>2]+(+f[p>>2]-+f[h>>2])/+f[k>>2]*+f[o>>2];f[i>>2]=+f[l>>2]+(+f[i>>2]-+f[d>>2])/+f[e>>2]*+f[m>>2];f[p>>2]=q;p=c[b>>2]|0;if((c[p+(a*48|0)+44>>2]|0)==6)r=p;else{p=j+(a*48|0)+16|0;i=j+(a*48|0)+20|0;q=+f[i>>2]/+f[k>>2]*+f[o>>2];f[p>>2]=+f[p>>2]/+f[e>>2]*+f[m>>2];f[i>>2]=q;r=c[b>>2]|0}}else r=j;a=a+1|0;if(a>>>0>(c[r+((c[g>>2]|0)*48|0)+36>>2]|0)>>>0)break;else j=r}return}function Gb(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0;Ib(a,b,d,e);e=c[a+176>>2]|0;d=c[a+180>>2]|0;if((e|0)==(d|0))return;f=a+16|0;g=a+24|0;a=e;do{e=c[a>>2]|0;h=c[a+4>>2]|0;if(h){i=h+4|0;c[i>>2]=(c[i>>2]|0)+1;Ma[c[(c[e>>2]|0)+4>>2]&15](e,b,f,g);i=h+4|0;j=c[i>>2]|0;c[i>>2]=j+-1;if(!j){Ha[c[(c[h>>2]|0)+8>>2]&63](h);Qd(h)}}else Ma[c[(c[e>>2]|0)+4>>2]&15](e,b,f,g);a=a+8|0}while((a|0)!=(d|0));return}function Hb(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;return}function Ib(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var g=0,h=0,i=0,j=0.0,k=0.0,l=0,m=0.0,n=0.0,o=0.0,p=0.0;g=d;h=c[g+4>>2]|0;i=a+40|0;c[i>>2]=c[g>>2];c[i+4>>2]=h;h=e;i=c[h+4>>2]|0;g=a+32|0;c[g>>2]=c[h>>2];c[g+4>>2]=i;i=c[a+4>>2]|0;g=c[b>>2]|0;j=+f[g+(i*48|0)+8>>2]*+f[e>>2]+ +f[g+(i*48|0)+24>>2];b=e+4|0;k=+f[g+(i*48|0)+12>>2]*+f[b>>2]+ +f[g+(i*48|0)+28>>2];f[a+24>>2]=j;h=a+28|0;f[h>>2]=k;l=(c[a+52>>2]|0)==1;do if(l){m=+f[a+48>>2];n=k*m;if(n<j){f[a+24>>2]=n;o=n;p=k;break}else{n=j/m;f[h>>2]=n;o=j;p=n;break}}else{o=j;p=k}while(0);k=+f[g+(i*48|0)+20>>2]+(+f[d+4>>2]+ +f[b>>2]*+f[g+(i*48|0)+4>>2]-+f[a+12>>2]*p);f[a+16>>2]=+f[g+(i*48|0)+16>>2]+(+f[d>>2]+ +f[e>>2]*+f[g+(i*48|0)>>2]-+f[a+8>>2]*o);f[a+20>>2]=k;if(!l)return;k=+f[a+48>>2];j=p*k;if(j<o){f[a+24>>2]=j;return}else{f[h>>2]=o/k;return}}function Jb(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;d=a+4|0;e=c[a>>2]|0;f=(c[d>>2]|0)-e|0;g=(f|0)/48|0;h=g+1|0;if(h>>>0>89478485)ge(a);i=a+8|0;j=((c[i>>2]|0)-e|0)/48|0;k=j<<1;l=j>>>0<44739242?(k>>>0<h>>>0?h:k):89478485;do if(l)if(l>>>0>89478485){k=X(8)|0;Xd(k,4074);c[k>>2]=3812;$(k|0,2768,34)}else{m=Rd(l*48|0)|0;break}else m=0;while(0);k=m+(g*48|0)|0;g=m+(l*48|0)|0;l=k;m=b;b=l+48|0;do{c[l>>2]=c[m>>2];l=l+4|0;m=m+4|0}while((l|0)<(b|0));m=k+(((f|0)/-48|0)*48|0)|0;if((f|0)>0)hf(m|0,e|0,f|0)|0;c[a>>2]=m;c[d>>2]=k+48;c[i>>2]=g;if(!e)return;Sd(e);return}function Kb(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0;d=a+4|0;e=c[d>>2]|0;f=c[a>>2]|0;g=e-f>>3;h=g+1|0;i=f;j=e;if(h>>>0>536870911)ge(a);e=a+8|0;k=(c[e>>2]|0)-f|0;f=k>>2;l=k>>3>>>0<268435455?(f>>>0<h>>>0?h:f):536870911;do if(l)if(l>>>0>536870911){f=X(8)|0;Xd(f,4074);c[f>>2]=3812;$(f|0,2768,34)}else{m=Rd(l<<3)|0;break}else m=0;while(0);f=m+(g<<3)|0;h=m+(l<<3)|0;c[f>>2]=c[b>>2];l=c[b+4>>2]|0;c[m+(g<<3)+4>>2]=l;if(!l){n=i;o=j}else{j=l+4|0;c[j>>2]=(c[j>>2]|0)+1;n=c[a>>2]|0;o=c[d>>2]|0}j=f+8|0;l=n;if((o|0)==(n|0)){p=f;q=l;r=o}else{i=g+-1-((o+-8-l|0)>>>3)|0;l=o;o=f;do{f=o;o=o+-8|0;g=l;l=l+-8|0;c[o>>2]=c[l>>2];b=g+-4|0;c[f+-4>>2]=c[b>>2];c[l>>2]=0;c[b>>2]=0}while((l|0)!=(n|0));p=m+(i<<3)|0;q=c[a>>2]|0;r=c[d>>2]|0}c[a>>2]=p;c[d>>2]=j;c[e>>2]=h;h=q;if((r|0)!=(h|0)){e=r;do{r=c[e+-4>>2]|0;e=e+-8|0;if(r|0?(j=r+4|0,d=c[j>>2]|0,c[j>>2]=d+-1,(d|0)==0):0){Ha[c[(c[r>>2]|0)+8>>2]&63](r);Qd(r)}}while((e|0)!=(h|0))}if(!q)return;Sd(q);return}function Lb(a,b){a=a|0;b=b|0;return}function Mb(a){a=a|0;Pd(a);Sd(a);return}function Nb(a){a=a|0;var b=0;b=c[a+12>>2]|0;if(!b)return;c[b>>2]=2968;a=c[b+216>>2]|0;if((b+200|0)!=(a|0)){if(a|0)Ha[c[(c[a>>2]|0)+20>>2]&63](a)}else Ha[c[(c[a>>2]|0)+16>>2]&63](a);Vb(b);Sd(b);return}function Ob(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==4780?a+12|0:0)|0}function Pb(a){a=a|0;Sd(a);return}function Qb(a,b){a=a|0;b=b|0;return}function Rb(a){a=a|0;Pd(a);Sd(a);return}function Sb(a){a=a|0;var b=0;b=c[a+12>>2]|0;if(!b)return;Vb(b);Sd(b);return}function Tb(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==4907?a+12|0:0)|0}function Ub(a){a=a|0;Sd(a);return}function Vb(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0;c[a>>2]=2988;b=a+176|0;d=c[b>>2]|0;if(d|0){e=a+180|0;f=c[e>>2]|0;if((f|0)==(d|0))g=d;else{h=f;do{f=c[h+-4>>2]|0;h=h+-8|0;if(f|0?(i=f+4|0,j=c[i>>2]|0,c[i>>2]=j+-1,(j|0)==0):0){Ha[c[(c[f>>2]|0)+8>>2]&63](f);Qd(f)}}while((h|0)!=(d|0));g=c[b>>2]|0}c[e>>2]=d;Sd(g)}g=c[a+172>>2]|0;if(g|0?(d=g+4|0,e=c[d>>2]|0,c[d>>2]=e+-1,(e|0)==0):0){Ha[c[(c[g>>2]|0)+8>>2]&63](g);Qd(g)}g=c[a+160>>2]|0;if((a+144|0)!=(g|0)){if(g|0)Ha[c[(c[g>>2]|0)+20>>2]&63](g)}else Ha[c[(c[g>>2]|0)+16>>2]&63](g);g=c[a+136>>2]|0;if((a+120|0)!=(g|0)){if(g|0)Ha[c[(c[g>>2]|0)+20>>2]&63](g)}else Ha[c[(c[g>>2]|0)+16>>2]&63](g);g=c[a+112>>2]|0;if((a+96|0)!=(g|0)){if(g|0)Ha[c[(c[g>>2]|0)+20>>2]&63](g)}else Ha[c[(c[g>>2]|0)+16>>2]&63](g);g=c[a+80>>2]|0;if((a+64|0)==(g|0)){Ha[c[(c[g>>2]|0)+16>>2]&63](g);return}if(!g)return;Ha[c[(c[g>>2]|0)+20>>2]&63](g);return}function Wb(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,s=0,t=0,u=0,v=0,x=0,y=0,z=0,A=0;f=Aa;Aa=Aa+16|0;if((Aa|0)>=(Ba|0))w(16);g=f+4|0;h=f;i=d+4|0;j=c[i>>2]|0;k=c[d>>2]|0;if((j|0)==(k|0)){Aa=f;return}l=c[e+4>>2]|0;m=c[e>>2]|0;e=a+4|0;n=a+192|0;o=a+216|0;a=0;p=k;k=j;a:while(1){j=p;q=a;a=a+1|0;if((c[j+(q*12|0)+4>>2]|0)==(c[j+(q*12|0)>>2]|0)){s=k;t=p}else{u=a+l|0;v=0;x=j;do{j=c[(c[x+(q*12|0)>>2]|0)+(v<<2)>>2]|0;y=c[b>>2]|0;z=u+(c[y+((c[e>>2]|0)*48|0)+32>>2]|0)+(r(c[n>>2]|0,m+v|0)|0)|0;c[y+(z*48|0)+40>>2]=j;c[g>>2]=z;c[h>>2]=j;j=c[o>>2]|0;if(!j){A=9;break a}Ma[c[(c[j>>2]|0)+24>>2]&15](j,b,g,h);v=v+1|0;x=c[d>>2]|0}while(v>>>0<(c[x+(q*12|0)+4>>2]|0)-(c[x+(q*12|0)>>2]|0)>>2>>>0);s=c[i>>2]|0;t=x}if(a>>>0>=((s-t|0)/12|0)>>>0){A=3;break}else{p=t;k=s}}if((A|0)==3){Aa=f;return}else if((A|0)==9){A=X(4)|0;c[A>>2]=3688;$(A|0,2640,27)}}function Xb(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;a=c[d>>2]|0;e=(c[d+4>>2]|0)-a|0;f=e+1|0;if(!e){g=a;return g|0}if(!f){a=b+2496|0;e=c[a>>2]|0;h=((e+1|0)>>>0)%624|0;i=b+(e<<2)|0;j=c[b+(h<<2)>>2]|0;k=0-(j&1)&-1727483681^c[b+((((e+397|0)>>>0)%624|0)<<2)>>2]^(j&2147483646|c[i>>2]&-2147483648)>>>1;c[i>>2]=k;i=k>>>11^k;c[a>>2]=h;h=i<<7&-1658038656^i;i=h<<15&-272236544^h;g=i>>>18^i;return g|0}i=32-(s(f|0)|0)|0;h=i+(((-1>>>(33-i|0)&f|0)==0)<<31>>31)|0;i=(h>>>5)+((h&31|0)!=0&1)|0;a=i>>>0>h>>>0?0:-1>>>(32-((h>>>0)/(i>>>0)|0)|0);i=b+2496|0;h=c[i>>2]|0;do{k=h;h=((h+1|0)>>>0)%624|0;j=b+(k<<2)|0;e=c[b+(h<<2)>>2]|0;l=0-(e&1)&-1727483681^c[b+((((k+397|0)>>>0)%624|0)<<2)>>2]^(e&2147483646|c[j>>2]&-2147483648)>>>1;c[j>>2]=l;j=l>>>11^l;l=j<<7&-1658038656^j;j=l<<15&-272236544^l;m=(j>>>18^j)&a}while(m>>>0>=f>>>0);c[i>>2]=h;g=(c[d>>2]|0)+m|0;return g|0}function Yb(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0;e=(d-b|0)/12|0;f=a+8|0;g=c[f>>2]|0;h=c[a>>2]|0;i=h;if(e>>>0>((g-h|0)/12|0)>>>0){if(!h)j=g;else{g=a+4|0;k=c[g>>2]|0;if((k|0)==(i|0))l=h;else{m=k;do{k=m;m=m+-12|0;n=c[m>>2]|0;if(n|0){c[k+-8>>2]=n;Sd(n)}}while((m|0)!=(i|0));l=c[a>>2]|0}c[g>>2]=i;Sd(l);c[f>>2]=0;c[g>>2]=0;c[a>>2]=0;j=0}if(e>>>0>357913941)ge(a);g=(j|0)/12|0;j=g<<1;l=g>>>0<178956970?(j>>>0<e>>>0?e:j):357913941;if(l>>>0>357913941)ge(a);j=Rd(l*12|0)|0;g=a+4|0;c[g>>2]=j;c[a>>2]=j;c[f>>2]=j+(l*12|0);if((b|0)==(d|0))return;l=b;f=j;while(1){c[f>>2]=0;j=f+4|0;c[j>>2]=0;m=f+8|0;c[m>>2]=0;n=l+4|0;k=(c[n>>2]|0)-(c[l>>2]|0)|0;o=k>>2;if(k|0){if(o>>>0>1073741823){p=38;break}q=Rd(k)|0;c[j>>2]=q;c[f>>2]=q;c[m>>2]=q+(o<<2);o=c[l>>2]|0;m=(c[n>>2]|0)-o|0;if((m|0)>0){hf(q|0,o|0,m|0)|0;c[j>>2]=q+(m>>>2<<2)}}l=l+12|0;m=(c[g>>2]|0)+12|0;c[g>>2]=m;if((l|0)==(d|0)){p=42;break}else f=m}if((p|0)==38)ge(f);else if((p|0)==42)return}f=a+4|0;a=((c[f>>2]|0)-h|0)/12|0;h=e>>>0>a>>>0;e=b+(a*12|0)|0;a=h?e:d;if((a|0)==(b|0))r=i;else{l=b;b=i;while(1){if((b|0)!=(l|0))Zb(b,c[l>>2]|0,c[l+4>>2]|0);l=l+12|0;i=b+12|0;if((l|0)==(a|0)){r=i;break}else b=i}}if(!h){h=c[f>>2]|0;if((h|0)!=(r|0)){b=h;do{h=b;b=b+-12|0;l=c[b>>2]|0;if(l|0){c[h+-8>>2]=l;Sd(l)}}while((b|0)!=(r|0))}c[f>>2]=r;return}if((a|0)==(d|0))return;a=e;e=c[f>>2]|0;while(1){c[e>>2]=0;r=e+4|0;c[r>>2]=0;b=e+8|0;c[b>>2]=0;l=a+4|0;h=(c[l>>2]|0)-(c[a>>2]|0)|0;i=h>>2;if(h|0){if(i>>>0>1073741823){p=12;break}g=Rd(h)|0;c[r>>2]=g;c[e>>2]=g;c[b>>2]=g+(i<<2);i=c[a>>2]|0;b=(c[l>>2]|0)-i|0;if((b|0)>0){hf(g|0,i|0,b|0)|0;c[r>>2]=g+(b>>>2<<2)}}a=a+12|0;b=(c[f>>2]|0)+12|0;c[f>>2]=b;if((a|0)==(d|0)){p=42;break}else e=b}if((p|0)==12)ge(e);else if((p|0)==42)return}function Zb(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0;e=d;f=b;g=e-f|0;h=g>>2;i=a+8|0;j=c[i>>2]|0;k=c[a>>2]|0;l=k;if(h>>>0<=j-k>>2>>>0){m=a+4|0;n=(c[m>>2]|0)-k>>2;o=h>>>0>n>>>0;p=o?b+(n<<2)|0:d;d=p;n=d-f|0;if(n|0)jf(k|0,b|0,n|0)|0;if(!o){c[m>>2]=l+(n>>2<<2);return}n=e-d|0;if((n|0)<=0)return;hf(c[m>>2]|0,p|0,n|0)|0;c[m>>2]=(c[m>>2]|0)+(n>>>2<<2);return}if(!k)q=j;else{j=a+4|0;c[j>>2]=k;Sd(k);c[i>>2]=0;c[j>>2]=0;c[a>>2]=0;q=0}if(h>>>0>1073741823)ge(a);j=q>>1;k=q>>2>>>0<536870911?(j>>>0<h>>>0?h:j):1073741823;if(k>>>0>1073741823)ge(a);j=Rd(k<<2)|0;h=a+4|0;c[h>>2]=j;c[a>>2]=j;c[i>>2]=j+(k<<2);if((g|0)<=0)return;hf(j|0,b|0,g|0)|0;c[h>>2]=j+(g>>>2<<2);return}function _b(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,s=0,t=0,u=0,v=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0;b=Aa;Aa=Aa+32|0;if((Aa|0)>=(Ba|0))w(32);d=b+16|0;e=b+8|0;f=b;g=a+56|0;h=c[g>>2]|0;i=c[h+192>>2]|0;if((i|0)<=0){j=1;Aa=b;return j|0}k=a+4|0;a=i;i=h;a:while(1){h=a;a=a+-1|0;l=c[i+188>>2]|0;b:do if((l|0)>0){m=h+-2|0;n=c[i+192>>2]|0;if((h|0)<=1){o=0;p=n;q=l;s=i;while(1){if(p>>>0>a>>>0&q>>>0>o>>>0)t=p;else{c[d>>2]=a;c[d+4>>2]=o;Hd(4944,d)|0;t=c[s+192>>2]|0}u=c[k>>2]|0;v=(r(t,o)|0)+h|0;x=c[g>>2]|0;p=c[x+192>>2]|0;o=o+1|0;if((h|0)==(p|0)?(c[u+((v+(c[u+((c[s+4>>2]|0)*48|0)+32>>2]|0)|0)*48|0)+40>>2]&255|0)==1:0){j=0;y=20;break a}q=c[x+188>>2]|0;if((o|0)>=(q|0)){z=x;break b}else s=x}}s=0;q=i;o=n;p=l;while(1){x=q+192|0;if(p>>>0>s>>>0&o>>>0>m>>>0){A=x;B=o;C=o;D=q}else{c[f>>2]=m;c[f+4>>2]=s;Hd(4944,f)|0;u=c[g>>2]|0;v=u+192|0;A=v;B=c[x>>2]|0;C=c[v>>2]|0;D=u}u=c[k>>2]|0;v=c[u+((a+(r(B,s)|0)+(c[u+((c[q+4>>2]|0)*48|0)+32>>2]|0)|0)*48|0)+40>>2]&255;if(C>>>0>a>>>0?(c[D+188>>2]|0)>>>0>s>>>0:0){E=u;F=C}else{c[e>>2]=a;c[e+4>>2]=s;Hd(4944,e)|0;E=c[k>>2]|0;F=c[A>>2]|0}u=c[E+(((r(F,s)|0)+h+(c[E+((c[D+4>>2]|0)*48|0)+32>>2]|0)|0)*48|0)+40>>2]&255;if((v|0)==1&(u|0)==2){j=0;y=20;break a}v=c[g>>2]|0;o=c[v+192>>2]|0;s=s+1|0;if((u|0)==1&(h|0)==(o|0)){j=0;y=20;break a}p=c[v+188>>2]|0;if((s|0)>=(p|0)){z=v;break}else q=v}}else z=i;while(0);if((h|0)<=1){j=1;y=20;break}else i=z}if((y|0)==20){Aa=b;return j|0}return 0}function $b(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,s=0,t=0,u=0,v=0,x=0;b=Aa;Aa=Aa+16|0;if((Aa|0)>=(Ba|0))w(16);d=b;e=b+12|0;f=b+8|0;g=a+56|0;h=c[g>>2]|0;i=c[h+192>>2]|0;if((i|0)<=0){fc(a);Aa=b;return}j=a+4|0;k=i;i=h;a:while(1){h=k;k=k+-1|0;l=c[i+188>>2]|0;if((l|0)>0){m=0;n=i;o=l;while(1){l=n+192|0;p=c[l>>2]|0;if(o>>>0>m>>>0&p>>>0>k>>>0){q=p;s=n;t=p}else{c[d>>2]=k;c[d+4>>2]=m;Hd(4944,d)|0;p=c[g>>2]|0;q=c[l>>2]|0;s=p;t=c[p+192>>2]|0}p=c[j>>2]|0;l=c[p+(((r(q,m)|0)+h+(c[p+((c[n+4>>2]|0)*48|0)+32>>2]|0)|0)*48|0)+40>>2]|0;u=((l&255|0)==0?0:2)|l&-256;l=(c[p+((c[s+4>>2]|0)*48|0)+32>>2]|0)+h+(r(t,m)|0)|0;c[p+(l*48|0)+40>>2]=u;c[e>>2]=l;c[f>>2]=u;u=c[s+216>>2]|0;if(!u){v=10;break a}Ma[c[(c[u>>2]|0)+24>>2]&15](u,j,e,f);m=m+1|0;u=c[g>>2]|0;o=c[u+188>>2]|0;if((m|0)>=(o|0)){x=u;break}else n=u}}else x=i;if((h|0)<=1){v=3;break}else i=x}if((v|0)==3){fc(a);Aa=b;return}else if((v|0)==10){v=X(4)|0;c[v>>2]=3688;$(v|0,2640,27)}}function ac(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,s=0,t=0,u=0,v=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0;d=Aa;Aa=Aa+32|0;if((Aa|0)>=(Ba|0))w(32);e=d+24|0;f=d+16|0;g=d+8|0;h=d;i=a+56|0;j=c[i>>2]|0;if((c[j+188>>2]|0)<=0){k=1;Aa=d;return k|0}l=a+4|0;a=0;m=j;a:while(1){j=c[m+192>>2]|0;n=j+-1|0;o=a;a=a+1|0;b:do if((j|0)>0){if(o|0){p=j;q=n;s=m;t=j;while(1){u=s+192|0;if(t>>>0>q>>>0?(v=c[s+188>>2]|0,v>>>0>o>>>0):0){x=t;y=v;z=s}else{c[f>>2]=q;c[f+4>>2]=o;Hd(4944,f)|0;v=c[i>>2]|0;x=c[u>>2]|0;y=c[v+188>>2]|0;z=v}v=c[l>>2]|0;u=c[v+(((r(x,o)|0)+p+(c[v+((c[s+4>>2]|0)*48|0)+32>>2]|0)|0)*48|0)+40>>2]&255;if((o|0)<(y+-1|0)){A=z+192|0;B=c[A>>2]|0;if(y>>>0>a>>>0&B>>>0>q>>>0){C=v;D=B}else{c[e>>2]=q;c[e+4>>2]=a;Hd(4944,e)|0;C=c[l>>2]|0;D=c[A>>2]|0}E=c[C+(((r(D,a)|0)+p+(c[C+((c[z+4>>2]|0)*48|0)+32>>2]|0)|0)*48|0)+40>>2]&255}else E=0;if((E|0)==(b|0)?(u|0)!=(b|0)&(u|0)!=0:0){k=0;F=31;break a}if((q|0)<=0)break b;u=c[i>>2]|0;A=q;q=q+-1|0;s=u;t=c[u+192>>2]|0;p=A}}p=j;t=n;s=j;q=m;while(1){if(s>>>0>t>>>0?(A=c[q+188>>2]|0,(A|0)!=0):0){G=A;H=q}else{c[h>>2]=t;c[h+4>>2]=0;Hd(4944,h)|0;A=c[i>>2]|0;G=c[A+188>>2]|0;H=A}A=c[l>>2]|0;u=c[A+((p+(c[A+((c[q+4>>2]|0)*48|0)+32>>2]|0)|0)*48|0)+40>>2]&255;if((G|0)>1){B=H+192|0;v=c[B>>2]|0;if(G>>>0>a>>>0&v>>>0>t>>>0){I=A;J=v}else{c[g>>2]=t;c[g+4>>2]=a;Hd(4944,g)|0;I=c[l>>2]|0;J=c[B>>2]|0}K=c[I+(((r(J,a)|0)+p+(c[I+((c[H+4>>2]|0)*48|0)+32>>2]|0)|0)*48|0)+40>>2]&255}else K=0;if((K|0)==(b|0)){if((u|0)!=0|(u|0)==(b|0)){k=0;F=31;break a}}else if((u|0)==(b|0)){k=0;F=31;break a}if((t|0)<=0)break b;u=c[i>>2]|0;B=t;t=t+-1|0;s=c[u+192>>2]|0;q=u;p=B}}while(0);m=c[i>>2]|0;if((a|0)>=(c[m+188>>2]|0)){k=1;F=31;break}}if((F|0)==31){Aa=d;return k|0}return 0}function bc(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,s=0,t=0,u=0,v=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0;d=Aa;Aa=Aa+32|0;if((Aa|0)>=(Ba|0))w(32);e=d+16|0;f=d+8|0;g=d;h=a+56|0;i=c[h>>2]|0;j=c[i+188>>2]|0;if((j|0)<=0){k=1;Aa=d;return k|0}l=a+4|0;a=(b|0)!=0;m=j;j=i;a:while(1){i=m;m=m+-1|0;n=c[j+192>>2]|0;o=n+-1|0;b:do if((n|0)>0){p=i+-2|0;if((i|0)<=1){q=n;s=o;t=j;u=n;while(1){v=t+192|0;if(u>>>0>s>>>0?(c[t+188>>2]|0)>>>0>m>>>0:0)x=u;else{c[e>>2]=s;c[e+4>>2]=m;Hd(4944,e)|0;x=c[v>>2]|0}v=c[l>>2]|0;y=c[v+(((r(x,m)|0)+q+(c[v+((c[t+4>>2]|0)*48|0)+32>>2]|0)|0)*48|0)+40>>2]&255;if(!(a|(y|0)==0)){k=0;z=26;break a}v=c[h>>2]|0;if((y|0)==(b|0)?(i|0)==(c[v+188>>2]|0):0){k=0;z=26;break a}if((s|0)<=0){A=v;break b}y=s;s=s+-1|0;t=v;u=c[v+192>>2]|0;q=y}}q=n;u=o;t=j;s=n;while(1){y=t+192|0;if(s>>>0>u>>>0?(c[t+188>>2]|0)>>>0>m>>>0:0){B=y;C=s;D=s;E=t}else{c[g>>2]=u;c[g+4>>2]=m;Hd(4944,g)|0;v=c[h>>2]|0;F=v+192|0;B=F;C=c[y>>2]|0;D=c[F>>2]|0;E=v}v=c[l>>2]|0;F=c[v+(((r(C,m)|0)+q+(c[v+((c[t+4>>2]|0)*48|0)+32>>2]|0)|0)*48|0)+40>>2]&255;if(D>>>0>u>>>0?(c[E+188>>2]|0)>>>0>p>>>0:0){G=v;H=D}else{c[f>>2]=u;c[f+4>>2]=p;Hd(4944,f)|0;G=c[l>>2]|0;H=c[B>>2]|0}if((c[G+(((r(H,p)|0)+q+(c[G+((c[E+4>>2]|0)*48|0)+32>>2]|0)|0)*48|0)+40>>2]&255|0)==(b|0)?(F|0)!=(b|0)&(F|0)!=0:0){k=0;z=26;break a}v=c[h>>2]|0;if((F|0)==(b|0)?(i|0)==(c[v+188>>2]|0):0){k=0;z=26;break a}if((u|0)<=0){A=v;break b}F=u;u=u+-1|0;t=v;s=c[v+192>>2]|0;q=F}}else A=j;while(0);if((i|0)<=1){k=1;z=26;break}else j=A}if((z|0)==26){Aa=d;return k|0}return 0}function cc(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,s=0,t=0,u=0,v=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0;e=Aa;Aa=Aa+32|0;if((Aa|0)>=(Ba|0))w(32);f=e+16|0;g=e+8|0;h=e;i=e+28|0;j=e+24|0;if((b|0)<0){k=c[(c[a+56>>2]|0)+192>>2]|0;if((k|0)>0)l=k+-1|0;else{m=a+128|0;n=c[m>>2]|0;o=n+1|0;c[m>>2]=o;Aa=e;return}}else l=b;b=a+56|0;k=a+4|0;p=l;l=c[b>>2]|0;a:while(1){q=c[l+188>>2]|0;b:do if((q|0)>0){s=p+1|0;t=p+-1|0;if((p|0)<=0){u=0;v=l;x=q;while(1){y=v+192|0;z=c[y>>2]|0;if(x>>>0>u>>>0&z>>>0>p>>>0)A=z;else{c[f>>2]=p;c[f+4>>2]=u;Hd(4944,f)|0;A=c[y>>2]|0}y=c[k>>2]|0;z=c[y+(((r(A,u)|0)+s+(c[y+((c[v+4>>2]|0)*48|0)+32>>2]|0)|0)*48|0)+40>>2]&255;if((z|0)==(d|0)|(z|d|0)==0){z=c[b>>2]|0;B=(c[y+((c[z+4>>2]|0)*48|0)+32>>2]|0)+s+(r(c[z+192>>2]|0,u)|0)|0;c[y+(B*48|0)+40>>2]=0;c[i>>2]=B;c[j>>2]=0;B=c[z+216>>2]|0;if(!B){C=24;break a}Ma[c[(c[B>>2]|0)+24>>2]&15](B,k,i,j)}u=u+1|0;B=c[b>>2]|0;x=c[B+188>>2]|0;if((u|0)>=(x|0)){D=t;E=B;break b}else v=B}}v=0;x=l;u=q;while(1){B=x+192|0;z=c[B>>2]|0;if(u>>>0>v>>>0&z>>>0>p>>>0){F=B;G=z;H=z;I=x}else{c[h>>2]=p;c[h+4>>2]=v;Hd(4944,h)|0;z=c[b>>2]|0;y=z+192|0;F=y;G=c[B>>2]|0;H=c[y>>2]|0;I=z}z=c[k>>2]|0;y=c[z+(((r(G,v)|0)+s+(c[z+((c[x+4>>2]|0)*48|0)+32>>2]|0)|0)*48|0)+40>>2]|0;if(H>>>0>t>>>0?(c[I+188>>2]|0)>>>0>v>>>0:0){J=z;K=H}else{c[g>>2]=t;c[g+4>>2]=v;Hd(4944,g)|0;J=c[k>>2]|0;K=c[F>>2]|0}z=c[J+(((r(K,v)|0)+p+(c[J+((c[I+4>>2]|0)*48|0)+32>>2]|0)|0)*48|0)+40>>2]|0;B=y&255;y=z&255;L=(B|0)==(d|0);M=(y|0)==(d|0);N=M|L^1?z:0;if(L&(y|0)==0|(B|0)==0&M){M=c[b>>2]|0;B=(c[J+((c[M+4>>2]|0)*48|0)+32>>2]|0)+s+(r(c[M+192>>2]|0,v)|0)|0;c[J+(B*48|0)+40>>2]=N;c[i>>2]=B;c[j>>2]=N;N=c[M+216>>2]|0;if(!N){C=24;break a}Ma[c[(c[N>>2]|0)+24>>2]&15](N,k,i,j)}v=v+1|0;N=c[b>>2]|0;u=c[N+188>>2]|0;if((v|0)>=(u|0)){D=t;E=N;break}else x=N}}else{D=p+-1|0;E=l}while(0);if((p|0)>0){p=D;l=E}else{C=4;break}}if((C|0)==4){m=a+128|0;n=c[m>>2]|0;o=n+1|0;c[m>>2]=o;Aa=e;return}else if((C|0)==24){C=X(4)|0;c[C>>2]=3688;$(C|0,2640,27)}}function dc(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,s=0,t=0,u=0,v=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0;d=Aa;Aa=Aa+32|0;if((Aa|0)>=(Ba|0))w(32);e=d+8|0;f=d;g=d+20|0;h=d+16|0;i=a+56|0;j=c[i>>2]|0;if((c[j+188>>2]|0)<=0){k=a+124|0;l=c[k>>2]|0;m=l+-1|0;c[k>>2]=m;Aa=d;return}n=a+4|0;o=0;p=j;a:while(1){j=c[p+192>>2]|0;q=o;o=o+1|0;b:do if((j|0)>0){s=j;t=p;u=j;while(1){v=s+-1|0;x=t+192|0;if(u>>>0>v>>>0?(y=c[t+188>>2]|0,y>>>0>q>>>0):0){z=u;A=y;B=t}else{c[f>>2]=v;c[f+4>>2]=q;Hd(4944,f)|0;y=c[i>>2]|0;z=c[x>>2]|0;A=c[y+188>>2]|0;B=y}y=c[n>>2]|0;x=c[y+(((r(z,q)|0)+s+(c[y+((c[t+4>>2]|0)*48|0)+32>>2]|0)|0)*48|0)+40>>2]|0;if((q|0)<(A+-1|0)){C=B+192|0;D=c[C>>2]|0;if(A>>>0>o>>>0&D>>>0>v>>>0){E=y;F=D}else{c[e>>2]=v;c[e+4>>2]=o;Hd(4944,e)|0;E=c[n>>2]|0;F=c[C>>2]|0}G=c[E+(((r(F,o)|0)+s+(c[E+((c[B+4>>2]|0)*48|0)+32>>2]|0)|0)*48|0)+40>>2]|0;H=E}else{G=0;H=y}y=x&255;x=G&255;C=(x|0)!=(b|0)&(x|0)!=0?0:G;if((y|0)==(b|0))if(!x){I=C;J=17}else{K=C;J=16}else{K=G;J=16}if((J|0)==16?(J=0,(y|0)==0&(x|0)==(b|0)):0){I=K;J=17}if((J|0)==17){J=0;x=c[i>>2]|0;y=(c[H+((c[x+4>>2]|0)*48|0)+32>>2]|0)+s+(r(c[x+192>>2]|0,q)|0)|0;c[H+(y*48|0)+40>>2]=I;c[g>>2]=y;c[h>>2]=I;y=c[x+216>>2]|0;if(!y){J=18;break a}Ma[c[(c[y>>2]|0)+24>>2]&15](y,n,g,h)}y=c[i>>2]|0;if((s|0)<=1){L=y;break b}s=v;t=y;u=c[y+192>>2]|0}}else L=p;while(0);if((o|0)>=(c[L+188>>2]|0)){J=3;break}else p=L}if((J|0)==3){k=a+124|0;l=c[k>>2]|0;m=l+-1|0;c[k>>2]=m;Aa=d;return}else if((J|0)==18){J=X(4)|0;c[J>>2]=3688;$(J|0,2640,27)}}function ec(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,s=0,t=0,u=0,v=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0;d=Aa;Aa=Aa+32|0;if((Aa|0)>=(Ba|0))w(32);e=d+16|0;f=d+8|0;g=d;h=d+28|0;i=d+24|0;j=a+56|0;k=c[j>>2]|0;l=c[k+188>>2]|0;if((l|0)<=0){m=a+124|0;n=c[m>>2]|0;o=n+1|0;c[m>>2]=o;Aa=d;return}p=a+4|0;q=l;l=k;a:while(1){k=q+-1|0;s=c[l+192>>2]|0;t=s+-1|0;b:do if((s|0)>0){u=q+-2|0;if((q|0)<=1){v=s;x=t;y=l;z=s;while(1){A=y+192|0;if(z>>>0>x>>>0?(c[y+188>>2]|0)>>>0>k>>>0:0)B=z;else{c[e>>2]=x;c[e+4>>2]=k;Hd(4944,e)|0;B=c[A>>2]|0}A=c[p>>2]|0;C=c[A+(((r(B,k)|0)+v+(c[A+((c[y+4>>2]|0)*48|0)+32>>2]|0)|0)*48|0)+40>>2]&255;if((C|0)==(b|0)|(C|b|0)==0){C=c[j>>2]|0;D=(c[A+((c[C+4>>2]|0)*48|0)+32>>2]|0)+v+(r(c[C+192>>2]|0,k)|0)|0;c[A+(D*48|0)+40>>2]=0;c[h>>2]=D;c[i>>2]=0;D=c[C+216>>2]|0;if(!D){E=28;break a}Ma[c[(c[D>>2]|0)+24>>2]&15](D,p,h,i)}if((x|0)<=0)break b;D=c[j>>2]|0;C=x;x=x+-1|0;y=D;z=c[D+192>>2]|0;v=C}}v=s;z=t;y=l;x=s;while(1){C=y+192|0;if(x>>>0>z>>>0?(c[y+188>>2]|0)>>>0>k>>>0:0){F=C;G=x;H=x;I=y}else{c[g>>2]=z;c[g+4>>2]=k;Hd(4944,g)|0;D=c[j>>2]|0;A=D+192|0;F=A;G=c[C>>2]|0;H=c[A>>2]|0;I=D}D=c[p>>2]|0;A=c[D+(((r(G,k)|0)+v+(c[D+((c[y+4>>2]|0)*48|0)+32>>2]|0)|0)*48|0)+40>>2]|0;if(H>>>0>z>>>0?(c[I+188>>2]|0)>>>0>u>>>0:0){J=D;K=H}else{c[f>>2]=z;c[f+4>>2]=u;Hd(4944,f)|0;J=c[p>>2]|0;K=c[F>>2]|0}D=c[J+(((r(K,u)|0)+v+(c[J+((c[I+4>>2]|0)*48|0)+32>>2]|0)|0)*48|0)+40>>2]|0;C=A&255;A=D&255;L=(A|0)!=(b|0)&(A|0)!=0?0:D;if((C|0)==(b|0))if(!A){M=L;E=17}else{N=L;E=16}else{N=D;E=16}if((E|0)==16?(E=0,(C|0)==0&(A|0)==(b|0)):0){M=N;E=17}if((E|0)==17){E=0;A=c[j>>2]|0;C=(c[J+((c[A+4>>2]|0)*48|0)+32>>2]|0)+v+(r(c[A+192>>2]|0,k)|0)|0;c[J+(C*48|0)+40>>2]=M;c[h>>2]=C;c[i>>2]=M;C=c[A+216>>2]|0;if(!C){E=28;break a}Ma[c[(c[C>>2]|0)+24>>2]&15](C,p,h,i)}if((z|0)<=0)break b;C=c[j>>2]|0;A=z;z=z+-1|0;y=C;x=c[C+192>>2]|0;v=A}}while(0);if((q|0)<=1){E=3;break}q=k;l=c[j>>2]|0}if((E|0)==3){m=a+124|0;n=c[m>>2]|0;o=n+1|0;c[m>>2]=o;Aa=d;return}else if((E|0)==28){E=X(4)|0;c[E>>2]=3688;$(E|0,2640,27)}}function fc(a){a=a|0;var b=0,d=0,e=0,f=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,s=0,t=0,u=0,v=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0;b=Aa;Aa=Aa+16|0;if((Aa|0)>=(Ba|0))w(16);d=b;e=b+12|0;f=b+8|0;h=a+56|0;i=c[(c[h>>2]|0)+192>>2]|0;a:do if((i|0)>0){j=a+132|0;k=a+136|0;l=a+4|0;m=a+4|0;n=0;o=i;b:while(1){p=o+-1|0;q=c[j>>2]|0;s=c[k>>2]|0;if((q|0)<=(s|0)){t=q;q=1;u=s;while(1){v=c[h>>2]|0;x=v+192|0;y=c[x>>2]|0;if(y>>>0>p>>>0?(c[v+188>>2]|0)>>>0>t>>>0:0){z=y;A=u}else{c[d>>2]=p;c[d+4>>2]=t;Hd(4944,d)|0;z=c[x>>2]|0;A=c[k>>2]|0}x=c[l>>2]|0;q=q&(c[x+(((r(z,t)|0)+o+(c[x+((c[v+4>>2]|0)*48|0)+32>>2]|0)|0)*48|0)+40>>2]&255|0)==2;if((t|0)>=(A|0))break;else{t=t+1|0;u=A}}if(q){B=A;C=19}else{D=n;E=p}}else{B=s;C=19}if((C|0)==19){C=0;u=n+1|0;t=c[j>>2]|0;if((t|0)<=(B|0)){v=t;while(1){t=c[h>>2]|0;x=c[m>>2]|0;y=(c[x+((c[t+4>>2]|0)*48|0)+32>>2]|0)+o+(r(c[t+192>>2]|0,v)|0)|0;c[x+(y*48|0)+40>>2]=0;c[e>>2]=y;c[f>>2]=0;y=c[t+216>>2]|0;if(!y){C=23;break b}Ma[c[(c[y>>2]|0)+24>>2]&15](y,m,e,f);if((v|0)<(c[k>>2]|0))v=v+1|0;else break}}cc(a,p,2);D=u;E=o}if((E|0)>0){n=D;o=E}else break}if((C|0)==23){o=X(4)|0;c[o>>2]=3688;$(o|0,2640,27)}o=a+68|0;n=(c[o>>2]|0)+D|0;c[o>>2]=n;o=((n>>>0)/10|0)+1|0;c[a+64>>2]=o;switch(D|0){case 1:{n=a+72|0;c[n>>2]=(c[n>>2]|0)+100;F=o;break a;break}case 2:{n=a+72|0;c[n>>2]=(c[n>>2]|0)+300;F=o;break a;break}case 3:{n=a+72|0;c[n>>2]=(c[n>>2]|0)+500;F=o;break a;break}case 4:{n=a+72|0;c[n>>2]=(c[n>>2]|0)+800;F=o;break a;break}case 5:{n=a+72|0;c[n>>2]=(c[n>>2]|0)+1100;F=o;break a;break}case 6:{n=a+72|0;c[n>>2]=(c[n>>2]|0)+1500;F=o;break a;break}default:{F=o;break a}}}else{o=(((c[a+68>>2]|0)>>>0)/10|0)+1|0;c[a+64>>2]=o;F=o}while(0);g[a+32>>3]=700.0/((+(F>>>0)+-1.0)*.6666666666666666+1.0);Aa=b;return}function gc(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0;f=Aa;Aa=Aa+96|0;if((Aa|0)>=(Ba|0))w(96);g=f+88|0;h=f+80|0;i=f+16|0;j=f+72|0;k=f+64|0;l=f+56|0;m=f+48|0;n=f+40|0;o=f+32|0;p=f+8|0;q=f;r=c[b>>2]|0;s=r+d|0;if((((r|0)>=0?(t=c[a+56>>2]|0,s>>>0<=(c[t+188>>2]|0)>>>0):0)?(u=b+4|0,v=c[u>>2]|0,(v|0)>=0):0)?(v+d|0)>>>0<=(c[t+192>>2]|0)>>>0:0){if(!d){x=1;Aa=f;return x|0}t=d+-1|0;v=0;a:while(1){y=t-v|0;if(v>>>0<y>>>0){z=v;do{A=c[b>>2]|0;B=A+v|0;C=c[u>>2]|0;D=C+z|0;E=A+z|0;F=t+C|0;G=F-v|0;H=t+A|0;A=H-z|0;I=C+v|0;C=j;c[C>>2]=B;c[C+4>>2]=D;C=k;c[C>>2]=E;c[C+4>>2]=G;c[h>>2]=c[j>>2];c[h+4>>2]=c[j+4>>2];c[g>>2]=c[k>>2];c[g+4>>2]=c[k+4>>2];if(!(ic(a,h,g,e)|0)){x=0;J=16;break a}C=H-v|0;H=l;c[H>>2]=E;c[H+4>>2]=G;G=m;c[G>>2]=C;c[G+4>>2]=F;c[h>>2]=c[l>>2];c[h+4>>2]=c[l+4>>2];c[g>>2]=c[m>>2];c[g+4>>2]=c[m+4>>2];if(!(ic(a,h,g,e)|0)){x=0;J=16;break a}G=n;c[G>>2]=C;c[G+4>>2]=F;F=o;c[F>>2]=A;c[F+4>>2]=I;c[h>>2]=c[n>>2];c[h+4>>2]=c[n+4>>2];c[g>>2]=c[o>>2];c[g+4>>2]=c[o+4>>2];if(!(ic(a,h,g,e)|0)){x=0;J=16;break a}F=p;c[F>>2]=A;c[F+4>>2]=I;I=q;c[I>>2]=B;c[I+4>>2]=D;c[h>>2]=c[p>>2];c[h+4>>2]=c[p+4>>2];c[g>>2]=c[q>>2];c[g+4>>2]=c[q+4>>2];z=z+1|0;if(!(ic(a,h,g,e)|0)){x=0;J=16;break a}}while(z>>>0<y>>>0)}v=v+1|0;if(v>>>0>=d>>>0){x=1;J=16;break}}if((J|0)==16){Aa=f;return x|0}}x=c[b+4>>2]|0;c[i>>2]=r;c[i+4>>2]=x;c[i+8>>2]=s;c[i+12>>2]=x+d;Hd(4973,i)|0;Aa=f;return 0}function hc(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,s=0,t=0,u=0,v=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0;f=Aa;Aa=Aa+80|0;if((Aa|0)>=(Ba|0))w(80);g=f+64|0;h=f+56|0;i=f+48|0;j=f+24|0;k=f+8|0;l=f+40|0;m=f+32|0;n=f+16|0;o=f;p=d>>>1;if(!p){Aa=f;return}q=d+-1|0;d=b+4|0;s=a+56|0;t=a+4|0;u=0;v=q;while(1){if(u>>>0<(q-u|0)>>>0){x=u;do{y=c[b>>2]|0;z=y+u|0;A=c[d>>2]|0;B=A+x|0;C=y+x|0;D=q+A|0;E=D-u|0;F=q+y|0;y=F-u|0;G=D-x|0;D=F-x|0;F=A+u|0;A=c[s>>2]|0;if(((B|z|0)>-1?(H=c[A+188>>2]|0,(z|0)<(H|0)):0)?(I=A+192|0,J=c[I>>2]|0,(B|0)<(J|0)):0){if(J>>>0>B>>>0&H>>>0>z>>>0){K=A;L=J}else{c[k>>2]=B;c[k+4>>2]=z;Hd(4944,k)|0;K=c[s>>2]|0;L=c[I>>2]|0}I=c[t>>2]|0;M=c[I+((B+1+(r(L,z)|0)+(c[I+((c[A+4>>2]|0)*48|0)+32>>2]|0)|0)*48|0)+40>>2]|0;N=K}else{M=0;N=A}if(((E|C|0)>-1?(A=c[N+188>>2]|0,(C|0)<(A|0)):0)?(I=N+192|0,J=c[I>>2]|0,(E|0)<(J|0)):0){if(J>>>0>E>>>0&A>>>0>C>>>0){O=N;P=J}else{c[j>>2]=E;c[j+4>>2]=C;Hd(4944,j)|0;O=c[s>>2]|0;P=c[I>>2]|0}I=c[t>>2]|0;Q=c[I+((E+1+(r(P,C)|0)+(c[I+((c[N+4>>2]|0)*48|0)+32>>2]|0)|0)*48|0)+40>>2]|0;R=O}else{Q=0;R=N}if(((G|y|0)>-1?(I=c[R+188>>2]|0,(y|0)<(I|0)):0)?(J=R+192|0,A=c[J>>2]|0,(G|0)<(A|0)):0){if(A>>>0>G>>>0&I>>>0>y>>>0){S=R;T=A}else{c[i>>2]=G;c[i+4>>2]=y;Hd(4944,i)|0;S=c[s>>2]|0;T=c[J>>2]|0}J=c[t>>2]|0;U=S;V=c[J+((G+1+(r(T,y)|0)+(c[J+((c[R+4>>2]|0)*48|0)+32>>2]|0)|0)*48|0)+40>>2]|0}else{U=R;V=0}if(((D|F|0)>-1?(J=c[U+188>>2]|0,(D|0)<(J|0)):0)?(A=U+192|0,I=c[A>>2]|0,(F|0)<(I|0)):0){if(I>>>0>F>>>0&J>>>0>D>>>0)W=I;else{c[h>>2]=F;c[h+4>>2]=D;Hd(4944,h)|0;W=c[A>>2]|0}A=c[t>>2]|0;X=c[A+((F+1+(r(W,D)|0)+(c[A+((c[U+4>>2]|0)*48|0)+32>>2]|0)|0)*48|0)+40>>2]|0}else X=0;A=l;c[A>>2]=z;c[A+4>>2]=B;c[g>>2]=c[l>>2];c[g+4>>2]=c[l+4>>2];jc(a,g,Q,0,e);B=m;c[B>>2]=C;c[B+4>>2]=E;c[g>>2]=c[m>>2];c[g+4>>2]=c[m+4>>2];jc(a,g,V,0,e);E=n;c[E>>2]=y;c[E+4>>2]=G;c[g>>2]=c[n>>2];c[g+4>>2]=c[n+4>>2];jc(a,g,X,0,e);G=o;c[G>>2]=D;c[G+4>>2]=F;c[g>>2]=c[o>>2];c[g+4>>2]=c[o+4>>2];jc(a,g,M,0,e);x=x+1|0}while((x|0)!=(v|0))}u=u+1|0;if((u|0)==(p|0))break;else v=v+-1|0}Aa=f;return}function ic(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,s=0,t=0,u=0,v=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0;f=Aa;Aa=Aa+32|0;if((Aa|0)>=(Ba|0))w(32);g=f+24|0;h=f+16|0;i=f+8|0;j=f;k=a+56|0;l=c[k>>2]|0;m=c[b>>2]|0;if(((m|0)>-1?(n=c[b+4>>2]|0,(n|0)>-1):0)?(m|0)<(c[l+188>>2]|0):0)o=(n|0)<(c[l+192>>2]|0);else o=0;n=c[d>>2]|0;if(((n|0)>-1?(p=c[d+4>>2]|0,(p|0)>-1):0)?(n|0)<(c[l+188>>2]|0):0)q=(p|0)<(c[l+192>>2]|0);else q=0;if(!(o|q)){s=1;Aa=f;return s|0}if(!(q|o^1)){p=c[b+4>>2]|0;t=l+192|0;u=c[t>>2]|0;if(u>>>0>p>>>0?(c[l+188>>2]|0)>>>0>m>>>0:0)v=u;else{c[j>>2]=p;c[j+4>>2]=m;Hd(4944,j)|0;v=c[t>>2]|0}t=c[a+4>>2]|0;s=(c[t+((p+1+(r(v,m)|0)+(c[t+((c[l+4>>2]|0)*48|0)+32>>2]|0)|0)*48|0)+40>>2]&255|0)!=(e|0);Aa=f;return s|0}t=a+4|0;if(!(o|q^1)){q=c[d+4>>2]|0;o=l+192|0;a=c[o>>2]|0;if(a>>>0>q>>>0?(c[l+188>>2]|0)>>>0>n>>>0:0)x=a;else{c[i>>2]=q;c[i+4>>2]=n;Hd(4944,i)|0;x=c[o>>2]|0}o=c[t>>2]|0;s=(c[o+((q+1+(r(x,n)|0)+(c[o+((c[l+4>>2]|0)*48|0)+32>>2]|0)|0)*48|0)+40>>2]&255|0)!=(e|0);Aa=f;return s|0}o=c[b+4>>2]|0;b=l+192|0;x=c[b>>2]|0;if(x>>>0>o>>>0?(c[l+188>>2]|0)>>>0>m>>>0:0){y=b;z=l;A=x;B=x}else{c[h>>2]=o;c[h+4>>2]=m;Hd(4944,h)|0;h=c[k>>2]|0;k=h+192|0;y=k;z=h;A=c[b>>2]|0;B=c[k>>2]|0}k=c[t>>2]|0;b=c[k+((o+1+(r(A,m)|0)+(c[k+((c[l+4>>2]|0)*48|0)+32>>2]|0)|0)*48|0)+40>>2]|0;l=c[d+4>>2]|0;if(B>>>0>l>>>0?(c[z+188>>2]|0)>>>0>n>>>0:0){C=k;D=B}else{c[g>>2]=l;c[g+4>>2]=n;Hd(4944,g)|0;C=c[t>>2]|0;D=c[y>>2]|0}y=c[C+((l+1+(r(D,n)|0)+(c[C+((c[z+4>>2]|0)*48|0)+32>>2]|0)|0)*48|0)+40>>2]|0;z=(b|0)==(e|0);if(!z){E=(y|0)!=(e|0);F=(b|0)==0;G=z|F;H=G|E;Aa=f;return H|0}if((y|0)!=(e|0)&(y|0)!=0){s=0;Aa=f;return s|0}else{E=(y|0)!=(e|0);F=(b|0)==0;G=z|F;H=G|E;Aa=f;return H|0}return 0}function jc(a,b,d,e,f){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,s=0;g=Aa;Aa=Aa+16|0;if((Aa|0)>=(Ba|0))w(16);h=g;i=g+12|0;j=g+8|0;if((e|0)<0){Aa=g;return}e=a+56|0;k=c[e>>2]|0;l=c[b>>2]|0;if((l|0)<=-1){Aa=g;return}m=c[b+4>>2]|0;if((m|0)<=-1){Aa=g;return}b=c[k+188>>2]|0;if((l|0)>=(b|0)){Aa=g;return}n=k+192|0;o=c[n>>2]|0;if((m|0)>=(o|0)){Aa=g;return}p=d&255;q=a+4|0;if(o>>>0>m>>>0&b>>>0>l>>>0)s=o;else{c[h>>2]=m;c[h+4>>2]=l;Hd(4944,h)|0;s=c[n>>2]|0}n=c[q>>2]|0;h=m+1|0;m=c[n+(((r(s,l)|0)+h+(c[n+((c[k+4>>2]|0)*48|0)+32>>2]|0)|0)*48|0)+40>>2]&255;if((m|0)!=(f|0)&(m|0)!=0){Aa=g;return}if((p|0)!=(f|0)&(p|0)!=0){Aa=g;return}p=c[e>>2]|0;e=(c[n+((c[p+4>>2]|0)*48|0)+32>>2]|0)+h+(r(c[p+192>>2]|0,l)|0)|0;c[n+(e*48|0)+40>>2]=d;c[i>>2]=e;c[j>>2]=d;d=c[p+216>>2]|0;if(!d){p=X(4)|0;c[p>>2]=3688;$(p|0,2640,27)}Ma[c[(c[d>>2]|0)+24>>2]&15](d,q,i,j);Aa=g;return}function kc(a,b){a=a|0;b=b|0;return}function lc(a){a=a|0;Pd(a);Sd(a);return}function mc(a){a=a|0;var b=0;b=c[a+12>>2]|0;if(!b)return;pc(b);Sd(b);return}function nc(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==5097?a+12|0:0)|0}function oc(a){a=a|0;Sd(a);return}function pc(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;c[a>>2]=2840;b=a+112|0;d=c[b>>2]|0;if(d|0){e=a+116|0;f=c[e>>2]|0;if((f|0)==(d|0))g=d;else{h=f;do{f=h;h=h+-12|0;i=c[h>>2]|0;if(i|0){c[f+-8>>2]=i;Sd(i)}}while((h|0)!=(d|0));g=c[b>>2]|0}c[e>>2]=d;Sd(g)}g=a+76|0;d=c[g>>2]|0;if(d|0){e=a+80|0;b=c[e>>2]|0;if((b|0)==(d|0))j=d;else{h=b;do{b=h;h=h+-12|0;i=c[h>>2]|0;if(i|0){f=b+-8|0;b=c[f>>2]|0;if((b|0)==(i|0))k=i;else{l=b;do{b=l;l=l+-12|0;m=c[l>>2]|0;if(m|0){c[b+-8>>2]=m;Sd(m)}}while((l|0)!=(i|0));k=c[h>>2]|0}c[f>>2]=i;Sd(k)}}while((h|0)!=(d|0));j=c[g>>2]|0}c[e>>2]=d;Sd(j)}j=c[a+60>>2]|0;if(j|0?(d=j+4|0,e=c[d>>2]|0,c[d>>2]=e+-1,(e|0)==0):0){Ha[c[(c[j>>2]|0)+8>>2]&63](j);Qd(j)}c[a>>2]=2860;j=c[a+20>>2]|0;if(j|0?(e=j+4|0,d=c[e>>2]|0,c[e>>2]=d+-1,(d|0)==0):0){Ha[c[(c[j>>2]|0)+8>>2]&63](j);Qd(j)}j=c[a+4>>2]|0;if(!j)return;c[a+8>>2]=j;Sd(j);return}function qc(a){a=a|0;Pd(a);Sd(a);return}function rc(a){a=a|0;var b=0,d=0,e=0;b=c[a+12>>2]|0;if(!b)return;c[b>>2]=2860;a=c[b+20>>2]|0;if(a|0?(d=a+4|0,e=c[d>>2]|0,c[d>>2]=e+-1,(e|0)==0):0){Ha[c[(c[a>>2]|0)+8>>2]&63](a);Qd(a)}a=c[b+4>>2]|0;if(a|0){c[b+8>>2]=a;Sd(a)}Sd(b);return}function sc(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==5220?a+12|0:0)|0}function tc(a){a=a|0;Sd(a);return}function uc(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0;d=Aa;Aa=Aa+16|0;if((Aa|0)>=(Ba|0))w(16);e=d;if((b|0)==(a|0)){Aa=d;return}f=a+16|0;g=c[f>>2]|0;h=g;i=b+16|0;if((g|0)==(a|0))if((c[i>>2]|0)==(b|0)){Ja[c[(c[g>>2]|0)+12>>2]&7](g,e);j=c[f>>2]|0;Ha[c[(c[j>>2]|0)+16>>2]&63](j);c[f>>2]=0;j=c[i>>2]|0;Ja[c[(c[j>>2]|0)+12>>2]&7](j,a);j=c[i>>2]|0;Ha[c[(c[j>>2]|0)+16>>2]&63](j);c[i>>2]=0;c[f>>2]=a;Ja[c[(c[e>>2]|0)+12>>2]&7](e,b);Ha[c[(c[e>>2]|0)+16>>2]&63](e);c[i>>2]=b;Aa=d;return}else{Ja[c[(c[g>>2]|0)+12>>2]&7](g,b);g=c[f>>2]|0;Ha[c[(c[g>>2]|0)+16>>2]&63](g);g=b+16|0;c[f>>2]=c[g>>2];c[g>>2]=b;Aa=d;return}else{g=c[i>>2]|0;if((b|0)==(g|0)){Ja[c[(c[g>>2]|0)+12>>2]&7](g,a);b=c[i>>2]|0;Ha[c[(c[b>>2]|0)+16>>2]&63](b);c[i>>2]=c[f>>2];c[f>>2]=a;Aa=d;return}else{c[f>>2]=g;c[i>>2]=h;Aa=d;return}}}function vc(a){a=a|0;Sd(a);return}function wc(a){a=a|0;var b=0,d=0;b=Rd(20)|0;d=a+4|0;c[b>>2]=3140;a=b+4|0;c[a>>2]=c[d>>2];c[a+4>>2]=c[d+4>>2];c[a+8>>2]=c[d+8>>2];c[a+12>>2]=c[d+12>>2];return b|0}function xc(a,b){a=a|0;b=b|0;var d=0;d=a+4|0;c[b>>2]=3140;a=b+4|0;c[a>>2]=c[d>>2];c[a+4>>2]=c[d+4>>2];c[a+8>>2]=c[d+8>>2];c[a+12>>2]=c[d+12>>2];return}function yc(a){a=a|0;return}function zc(a){a=a|0;Sd(a);return}function Ac(a){a=a|0;var b=0,d=0,e=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0;b=Aa;Aa=Aa+16|0;if((Aa|0)>=(Ba|0))w(16);d=b;e=N()|0;g=a+4|0;if((e|0)==(c[c[g>>2]>>2]|0)){h=a+8|0;i=c[h>>2]|0;Ec(i);Aa=b;return}c[d>>2]=e;Hd(5351,d)|0;c[c[g>>2]>>2]=e;switch(e|0){case 0:{e=c[a+8>>2]|0;g=c[a+12>>2]|0;j=c[g>>2]|0;k=c[g+4>>2]|0;g=(k|0)==0;if(!g){l=k+4|0;c[l>>2]=(c[l>>2]|0)+1;c[l>>2]=(c[l>>2]|0)+1}l=e+32|0;c[l>>2]=j;j=e+36|0;m=c[j>>2]|0;c[j>>2]=k;if(m|0?(j=m+4|0,n=c[j>>2]|0,c[j>>2]=n+-1,(n|0)==0):0){Ha[c[(c[m>>2]|0)+8>>2]&63](m);Qd(m)}m=c[l>>2]|0;l=e+24|0;e=l;n=c[e+4>>2]|0;j=m+24|0;c[j>>2]=c[e>>2];c[j+4>>2]=n;n=c[m+16>>2]|0;if(n|0){j=c[(c[n>>2]|0)+4>>2]|0;f[d>>2]=0.0;f[d+4>>2]=0.0;Ma[j&15](n,m+4|0,d,l)}if(g){h=a+8|0;i=c[h>>2]|0;Ec(i);Aa=b;return}g=k+4|0;l=c[g>>2]|0;c[g>>2]=l+-1;if(l|0){h=a+8|0;i=c[h>>2]|0;Ec(i);Aa=b;return}Ha[c[(c[k>>2]|0)+8>>2]&63](k);Qd(k);h=a+8|0;i=c[h>>2]|0;Ec(i);Aa=b;return}case 1:{k=c[a+8>>2]|0;l=c[a+16>>2]|0;g=c[l>>2]|0;m=c[l+4>>2]|0;l=(m|0)==0;if(!l){n=m+4|0;c[n>>2]=(c[n>>2]|0)+1;c[n>>2]=(c[n>>2]|0)+1}n=k+32|0;c[n>>2]=g;g=k+36|0;j=c[g>>2]|0;c[g>>2]=m;if(j|0?(g=j+4|0,e=c[g>>2]|0,c[g>>2]=e+-1,(e|0)==0):0){Ha[c[(c[j>>2]|0)+8>>2]&63](j);Qd(j)}j=c[n>>2]|0;n=k+24|0;k=n;e=c[k+4>>2]|0;g=j+24|0;c[g>>2]=c[k>>2];c[g+4>>2]=e;e=c[j+16>>2]|0;if(e|0){g=c[(c[e>>2]|0)+4>>2]|0;f[d>>2]=0.0;f[d+4>>2]=0.0;Ma[g&15](e,j+4|0,d,n)}if(l){h=a+8|0;i=c[h>>2]|0;Ec(i);Aa=b;return}l=m+4|0;n=c[l>>2]|0;c[l>>2]=n+-1;if(n|0){h=a+8|0;i=c[h>>2]|0;Ec(i);Aa=b;return}Ha[c[(c[m>>2]|0)+8>>2]&63](m);Qd(m);h=a+8|0;i=c[h>>2]|0;Ec(i);Aa=b;return}default:{h=a+8|0;i=c[h>>2]|0;Ec(i);Aa=b;return}}}function Bc(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==5440?a+4|0:0)|0}function Cc(a){a=a|0;return 2632}function Dc(a){a=a|0;return}function Ec(a){a=a|0;var b=0,d=0,e=0,h=0.0,i=0.0,j=0.0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0;b=Aa;Aa=Aa+16|0;if((Aa|0)>=(Ba|0))w(16);d=b;e=a+12|0;c[e>>2]=(c[e>>2]|0)+1;h=+oa();J();i=+ua();j=+ta();k=a+24|0;l=a+28|0;if(i==+f[k>>2]?j==+f[l>>2]:0)m=a+32|0;else{g[d>>3]=i;g[d+8>>3]=j;Hd(5365,d)|0;f[k>>2]=i;f[l>>2]=j;l=a+32|0;n=c[l>>2]|0;o=k;p=c[o+4>>2]|0;q=n+24|0;c[q>>2]=c[o>>2];c[q+4>>2]=p;p=c[n+16>>2]|0;if(!p)m=l;else{q=c[(c[p>>2]|0)+4>>2]|0;f[d>>2]=0.0;f[d+4>>2]=0.0;Ma[q&15](p,n+4|0,d,k);m=l}}Fc(a);l=c[m>>2]|0;m=a+16|0;j=h-+g[m>>3];Ia[c[c[l>>2]>>2]&3](l,j,a);k=c[l+16>>2]|0;if(!k){r=c[e>>2]|0;Gc(a,h,r,0);g[m>>3]=h;Aa=b;return}Lc(k,l+4|0,j);r=c[e>>2]|0;Gc(a,h,r,0);g[m>>3]=h;Aa=b;return}function Fc(a){a=a|0;var b=0,e=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,x=0,y=0,z=0,A=0,B=0.0,C=0;b=Aa;Aa=Aa+96|0;if((Aa|0)>=(Ba|0))w(96);e=b+64|0;g=b+48|0;h=b;i=b+80|0;j=b+72|0;if(!(U(h|0)|0)){Aa=b;return}k=h+16|0;l=a+32|0;m=h+20|0;n=h+24|0;o=i+4|0;p=h+28|0;q=h+32|0;r=j+4|0;s=h+17|0;t=h+20|0;u=i+4|0;v=i+4|0;x=h+8|0;a:while(1){switch(c[h>>2]|0){case 256:{y=4;break a;break}case 769:{z=c[k>>2]|0;A=(c[a>>2]|0)+(z>>>5<<2)|0;c[A>>2]=c[A>>2]&~(1<<(z&31));A=c[l>>2]|0;Ja[c[(c[A>>2]|0)+4>>2]&7](A,z);break}case 768:{z=c[k>>2]|0;A=(c[a>>2]|0)+(z>>>5<<2)|0;c[A>>2]=c[A>>2]|1<<(z&31);A=c[l>>2]|0;Ja[c[(c[A>>2]|0)+8>>2]&7](A,z);break}case 1024:{z=c[l>>2]|0;B=+(c[n>>2]|0);f[i>>2]=+(c[m>>2]|0);f[o>>2]=B;B=+(c[q>>2]|0);f[j>>2]=+(c[p>>2]|0);f[r>>2]=B;A=c[z+16>>2]|0;if(A|0)Hc(A,z+4|0,i,j)|0;break}case 1025:{z=d[s>>0]|0;A=c[t>>2]|0;C=c[n>>2]|0;c[g>>2]=d[k>>0];c[g+4>>2]=z;c[g+8>>2]=A;c[g+12>>2]=C;Hd(5393,g)|0;C=c[l>>2]|0;B=+(c[n>>2]|0);f[i>>2]=+(c[t>>2]|0);f[u>>2]=B;A=c[C+16>>2]|0;if(A|0)Jc(A,C+4|0,i)|0;break}case 1026:{C=c[l>>2]|0;B=+(c[n>>2]|0);f[i>>2]=+(c[t>>2]|0);f[v>>2]=B;A=c[C+16>>2]|0;if(A|0)Kc(A,C+4|0,i)|0;break}case 512:{C=d[x>>0]|0;c[e>>2]=512;c[e+4>>2]=C;Hd(5420,e)|0;break}default:{}}if(!(U(h|0)|0)){y=18;break}}if((y|0)==4)Ee();else if((y|0)==18){Aa=b;return}}function Gc(b,d,e,g){b=b|0;d=+d;e=e|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0.0,s=0,t=0,u=0,x=0,y=0;g=Aa;Aa=Aa+16|0;if((Aa|0)>=(Ba|0))w(16);e=g;h=c[b+32>>2]|0;b=h+4|0;c[e>>2]=0;i=e+4|0;c[i>>2]=0;j=e+8|0;c[j>>2]=0;k=h+8|0;h=(c[k>>2]|0)-(c[b>>2]|0)|0;l=(h|0)/48|0;if(h){if(l>>>0>89478485)ge(e);m=Rd(h)|0;c[i>>2]=m;c[e>>2]=m;c[j>>2]=m+(l*48|0);l=c[b>>2]|0;b=(c[k>>2]|0)-l|0;if((b|0)>0){hf(m|0,l|0,b|0)|0;l=m+(((b>>>0)/48|0)*48|0)|0;c[i>>2]=l;if((l|0)==(m|0)){n=m;o=i}else{l=0;b=m;k=0;do{j=b+(k*48|0)|0;switch(c[b+(k*48|0)+44>>2]|0){case 1:{if(!(c[b+(k*48|0)+40>>2]|0)){p=c[b+(k*48|0)+36>>2]|0;q=0}else{p=k;q=l}break}case 2:{d=+f[b+(k*48|0)+16>>2];r=+f[b+(k*48|0)+20>>2];K(+(+f[j>>2]+d),+(+f[b+(k*48|0)+4>>2]+r),+d,+r,c[b+(k*48|0)+32>>2]|0);p=k;q=l;break}case 3:{r=+f[b+(k*48|0)+16>>2];d=+f[b+(k*48|0)+20>>2];Q(+(+f[j>>2]+r),+(+f[b+(k*48|0)+4>>2]+d),+r,+d,+(+f[b+(k*48|0)+24>>2]),c[b+(k*48|0)+32>>2]|0);p=k;q=l;break}case 4:{L(+(+f[j>>2]),+(+f[b+(k*48|0)+4>>2]),+(+f[b+(k*48|0)+16>>2]),+(+f[b+(k*48|0)+20>>2]),c[b+(k*48|0)+32>>2]|0);p=k;q=l;break}case 5:{P(+(+f[j>>2]),+(+f[b+(k*48|0)+4>>2]),+(+f[b+(k*48|0)+16>>2]),+(+f[b+(k*48|0)+20>>2]),+(+f[b+(k*48|0)+24>>2]),+(+f[b+(k*48|0)+28>>2]),c[b+(k*48|0)+32>>2]|0,c[b+(k*48|0)+36>>2]|0);p=k;q=l;break}case 6:{h=0+((c[b+(k*48|0)+36>>2]|0)*12|0)|0;if((a[h+11>>0]|0)<0)s=c[h>>2]|0;else s=h;d=+f[b+(k*48|0)+24>>2];M(s|0,+(+f[j>>2]),+(+f[b+(k*48|0)+4>>2]+d),+d,c[b+(k*48|0)+32>>2]|0);p=k;q=l;break}default:{p=k;q=l}}k=$e(p|0,q|0,1,0)|0;l=v()|0;b=c[e>>2]|0}while((l|0)<0|((l|0)==0?k>>>0<(((c[i>>2]|0)-b|0)/48|0)>>>0:0));t=i;u=b;x=9}}else{y=m;x=5}}else{y=0;x=5}if((x|0)==5){t=i;u=y;x=9}if((x|0)==9)if(!u){Aa=g;return}else{n=u;o=t}c[o>>2]=n;Sd(n);Aa=g;return}function Hc(b,d,e,f){b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0;if(!(c[(c[d>>2]|0)+((c[b+4>>2]|0)*48|0)+40>>2]|0)){g=0;return g|0}if(a[b+57>>0]|0)Ic(b,d,f);h=b+176|0;i=c[h>>2]|0;j=(c[b+180>>2]|0)-i|0;if((j|0)<=0){g=0;return g|0}b=(j>>>3)+-1|0;j=i;while(1){i=c[j+(b<<3)>>2]|0;k=c[j+(b<<3)+4>>2]|0;l=(k|0)==0;if(!l){m=k+4|0;c[m>>2]=(c[m>>2]|0)+1}m=Hc(i,d,e,f)|0;if(!l?(l=k+4|0,i=c[l>>2]|0,c[l>>2]=i+-1,(i|0)==0):0){Ha[c[(c[k>>2]|0)+8>>2]&63](k);Qd(k)}if(m){g=1;n=14;break}m=b+-1|0;if((m|0)<=-1){g=0;n=14;break}b=m;j=c[h>>2]|0}if((n|0)==14)return g|0;return 0}function Ic(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,g=0,i=0,j=0,k=0,l=0,m=0,n=0.0,o=0.0,p=0,q=0.0,r=0.0,s=0,t=0.0,u=0.0,v=0.0,x=0.0,y=0,z=0;e=Aa;Aa=Aa+16|0;if((Aa|0)>=(Ba|0))w(16);g=e+8|0;i=e;j=a+4|0;k=c[j>>2]|0;l=c[b>>2]|0;m=l+(k*48|0)+16|0;n=+f[m>>2];o=n+ +f[d>>2];p=l+(k*48|0)+20|0;q=+f[p>>2];r=q+ +f[d+4>>2];f[g>>2]=o;d=g+4|0;f[d>>2]=r;s=c[a+80>>2]|0;if(!s){t=o;u=n;v=r;x=q;y=l;z=k}else{Ja[c[(c[s>>2]|0)+24>>2]&7](s,g);t=+f[g>>2];u=+f[m>>2];v=+f[d>>2];x=+f[p>>2];y=c[b>>2]|0;z=c[j>>2]|0}j=g;g=c[j+4>>2]|0;p=y+(z*48|0)+16|0;c[p>>2]=c[j>>2];c[p+4>>2]=g;g=a+16|0;p=g;j=c[p>>2]|0;z=c[p+4>>2]|0;p=i;c[p>>2]=j;c[p+4>>2]=z;z=a+20|0;q=v-x+ +f[z>>2];f[g>>2]=t-u+(c[h>>2]=j,+f[h>>2]);f[z>>2]=q;z=a+24|0;Ma[c[(c[a>>2]|0)+8>>2]&15](a,b,i,z);i=c[a+176>>2]|0;j=c[a+180>>2]|0;if((i|0)==(j|0)){Aa=e;return}a=i;do{i=c[a>>2]|0;p=c[a+4>>2]|0;if(p){y=p+4|0;c[y>>2]=(c[y>>2]|0)+1;Ma[c[(c[i>>2]|0)+4>>2]&15](i,b,g,z);y=p+4|0;d=c[y>>2]|0;c[y>>2]=d+-1;if(!d){Ha[c[(c[p>>2]|0)+8>>2]&63](p);Qd(p)}}else Ma[c[(c[i>>2]|0)+4>>2]&15](i,b,g,z);a=a+8|0}while((a|0)!=(j|0));Aa=e;return}function Jc(b,d,e){b=b|0;d=d|0;e=e|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0.0,r=0.0,s=0.0;if(!(c[(c[d>>2]|0)+((c[b+4>>2]|0)*48|0)+40>>2]|0)){g=0;return g|0}h=b+176|0;i=c[h>>2]|0;j=(c[b+180>>2]|0)-i|0;a:do if((j|0)>0){k=(j>>>3)+-1|0;l=i;while(1){m=c[l+(k<<3)>>2]|0;n=c[l+(k<<3)+4>>2]|0;o=(n|0)==0;if(!o){p=n+4|0;c[p>>2]=(c[p>>2]|0)+1}p=Jc(m,d,e)|0;if(!o?(o=n+4|0,m=c[o>>2]|0,c[o>>2]=m+-1,(m|0)==0):0){Ha[c[(c[n>>2]|0)+8>>2]&63](n);Qd(n)}if(p){g=1;break}p=k+-1|0;if((p|0)<=-1)break a;k=p;l=c[h>>2]|0}return g|0}while(0);if((((a[b+88>>0]|0?(q=+f[e>>2],r=+f[e+4>>2],s=+f[b+16>>2],s<=q):0)?s+ +f[b+24>>2]>=q:0)?(q=+f[b+20>>2],q<=r):0)?q+ +f[b+28>>2]>=r:0){a[b+89>>0]=1;h=c[b+112>>2]|0;if(!h){g=1;return g|0}Ha[c[(c[h>>2]|0)+24>>2]&63](h);g=1;return g|0}if(!(a[b+56>>0]|0)){g=0;return g|0}r=+f[e>>2];q=+f[e+4>>2];s=+f[b+16>>2];if(!(s<=r)){g=0;return g|0}if(!(s+ +f[b+24>>2]>=r)){g=0;return g|0}r=+f[b+20>>2];if(!(r<=q)){g=0;return g|0}if(!(r+ +f[b+28>>2]>=q)){g=0;return g|0}Jd(5488)|0;a[b+57>>0]=1;g=1;return g|0}function Kc(b,d,e){b=b|0;d=d|0;e=e|0;var g=0,h=0,i=0.0,j=0.0,k=0.0,l=0,m=0,n=0,o=0,p=0,q=0;if(!(c[(c[d>>2]|0)+((c[b+4>>2]|0)*48|0)+40>>2]|0)){g=0;return g|0}if(a[b+88>>0]|0?(h=b+89|0,a[h>>0]|0):0){a[h>>0]=0;h=c[b+136>>2]|0;if(h|0)Ha[c[(c[h>>2]|0)+24>>2]&63](h);h=c[b+160>>2]|0;if(!h){g=1;return g|0}i=+f[e>>2];j=+f[e+4>>2];k=+f[b+16>>2];if(!(k<=i)){g=1;return g|0}if(!(k+ +f[b+24>>2]>=i)){g=1;return g|0}i=+f[b+20>>2];if(!(i<=j)){g=1;return g|0}if(!(i+ +f[b+28>>2]>=j)){g=1;return g|0}Ja[c[(c[h>>2]|0)+24>>2]&7](h,e);g=1;return g|0}if(a[b+56>>0]|0?(h=b+57|0,a[h>>0]|0):0){a[h>>0]=0;g=1;return g|0}h=b+176|0;l=c[h>>2]|0;m=(c[b+180>>2]|0)-l|0;if((m|0)<=0){g=0;return g|0}b=(m>>>3)+-1|0;m=l;while(1){l=c[m+(b<<3)>>2]|0;n=c[m+(b<<3)+4>>2]|0;o=(n|0)==0;if(!o){p=n+4|0;c[p>>2]=(c[p>>2]|0)+1}p=Kc(l,d,e)|0;if(!o?(o=n+4|0,l=c[o>>2]|0,c[o>>2]=l+-1,(l|0)==0):0){Ha[c[(c[n>>2]|0)+8>>2]&63](n);Qd(n)}if(p){g=1;q=25;break}p=b+-1|0;if((p|0)<=-1){g=0;q=25;break}b=p;m=c[h>>2]|0}if((q|0)==25)return g|0;return 0}function Lc(a,b,d){a=a|0;b=b|0;d=+d;var e=0,f=0,g=0,h=0,i=0;if(!(c[(c[b>>2]|0)+((c[a+4>>2]|0)*48|0)+40>>2]|0))return;e=c[a+168>>2]|0;if(e|0){Ka[c[c[e>>2]>>2]&0](e,b,d);Ma[c[(c[a>>2]|0)+4>>2]&15](a,b,a+40|0,a+32|0)}e=c[a+176>>2]|0;f=c[a+180>>2]|0;if((e|0)==(f|0))return;a=e;do{e=c[a>>2]|0;g=c[a+4>>2]|0;if(g){h=g+4|0;c[h>>2]=(c[h>>2]|0)+1;Lc(e,b,d);h=g+4|0;i=c[h>>2]|0;c[h>>2]=i+-1;if(!i){Ha[c[(c[g>>2]|0)+8>>2]&63](g);Qd(g)}}else Lc(e,b,d);a=a+8|0}while((a|0)!=(f|0));return}function Mc(){var b=0,d=0,e=0,f=0,g=0,h=0;b=Aa;Aa=Aa+16|0;if((Aa|0)>=(Ba|0))w(16);d=b;c[2639]=0;c[1858]=0;c[1859]=0;c[1860]=0;c[1861]=0;c[1862]=1065353216;e=Rd(16)|0;c[d>>2]=e;c[d+8>>2]=-2147483632;c[d+4>>2]=12;f=e;g=4061;h=f+12|0;do{a[f>>0]=a[g>>0]|0;f=f+1|0;g=g+1|0}while((f|0)<(h|0));a[e+12>>0]=0;Td(7452,d);if((a[d+11>>0]|0)<0)Sd(c[d>>2]|0);d=Ud(7452)|0;c[1864]=d;e=1;g=d;do{g=(r(g>>>30^g,1812433253)|0)+e|0;c[7456+(e<<2)>>2]=g;e=e+1|0}while((e|0)!=624);c[2488]=0;c[2489]=0;c[2490]=0;c[2491]=0;e=Rd(76)|0;c[2489]=e;g=e+76|0;c[2491]=g;c[e>>2]=-434550016;c[e+4>>2]=1018448640;c[e+8>>2]=-2025216;c[e+12>>2]=1130616832;c[e+16>>2]=-176017152;c[e+20>>2]=-1860258816;c[e+24>>2]=1121252352;c[e+28>>2]=-265099776;c[e+32>>2]=-1074838272;c[e+36>>2]=-88162816;c[e+40>>2]=1184468992;c[e+44>>2]=-423690496;c[e+48>>2]=-1704778752;c[e+52>>2]=-342016;c[e+56>>2]=-2147483648;c[e+60>>2]=-1426078976;c[e+64>>2]=-2139095040;c[e+68>>2]=-2576128;c[e+72>>2]=29952;c[2490]=g;c[1856]=0;Aa=b;return}function Nc(a){a=a|0;var b=0,d=0;b=Aa;Aa=Aa+16|0;if((Aa|0)>=(Ba|0))w(16);d=b;c[d>>2]=Sc(c[a+60>>2]|0)|0;a=Qc(ka(6,d|0)|0)|0;Aa=b;return a|0}function Oc(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0;e=Aa;Aa=Aa+48|0;if((Aa|0)>=(Ba|0))w(48);f=e+32|0;g=e+16|0;h=e;i=a+28|0;j=c[i>>2]|0;c[h>>2]=j;k=a+20|0;l=(c[k>>2]|0)-j|0;c[h+4>>2]=l;c[h+8>>2]=b;c[h+12>>2]=d;b=l+d|0;l=a+60|0;c[g>>2]=c[l>>2];c[g+4>>2]=h;c[g+8>>2]=2;j=Qc(fa(146,g|0)|0)|0;a:do if((b|0)!=(j|0)){g=2;m=b;n=h;o=j;while(1){if((o|0)<0)break;m=m-o|0;p=c[n+4>>2]|0;q=o>>>0>p>>>0;r=q?n+8|0:n;s=g+(q<<31>>31)|0;t=o-(q?p:0)|0;c[r>>2]=(c[r>>2]|0)+t;p=r+4|0;c[p>>2]=(c[p>>2]|0)-t;c[f>>2]=c[l>>2];c[f+4>>2]=r;c[f+8>>2]=s;o=Qc(fa(146,f|0)|0)|0;if((m|0)==(o|0)){u=3;break a}else{g=s;n=r}}c[a+16>>2]=0;c[i>>2]=0;c[k>>2]=0;c[a>>2]=c[a>>2]|32;if((g|0)==2)v=0;else v=d-(c[n+4>>2]|0)|0}else u=3;while(0);if((u|0)==3){u=c[a+44>>2]|0;c[a+16>>2]=u+(c[a+48>>2]|0);a=u;c[i>>2]=a;c[k>>2]=a;v=d}Aa=e;return v|0}function Pc(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0;e=Aa;Aa=Aa+32|0;if((Aa|0)>=(Ba|0))w(32);f=e;g=e+20|0;c[f>>2]=c[a+60>>2];c[f+4>>2]=0;c[f+8>>2]=b;c[f+12>>2]=g;c[f+16>>2]=d;if((Qc(ea(140,f|0)|0)|0)<0){c[g>>2]=-1;h=-1}else h=c[g>>2]|0;Aa=e;return h|0}function Qc(a){a=a|0;var b=0;if(a>>>0>4294963200){c[(Rc()|0)>>2]=0-a;b=-1}else b=a;return b|0}function Rc(){return 10032}function Sc(a){a=a|0;return a|0}function Tc(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0;f=Aa;Aa=Aa+32|0;if((Aa|0)>=(Ba|0))w(32);g=f;c[b+36>>2]=1;if((c[b>>2]&64|0)==0?(c[g>>2]=c[b+60>>2],c[g+4>>2]=21523,c[g+8>>2]=f+16,ja(54,g|0)|0):0)a[b+75>>0]=-1;g=Oc(b,d,e)|0;Aa=f;return g|0}function Uc(a){a=a|0;return (a+-48|0)>>>0<10|0}function Vc(){return 3436}function Wc(b,c){b=b|0;c=c|0;var d=0,e=0,f=0,g=0;d=a[b>>0]|0;e=a[c>>0]|0;if(d<<24>>24==0?1:d<<24>>24!=e<<24>>24){f=e;g=d}else{d=c;c=b;do{c=c+1|0;d=d+1|0;b=a[c>>0]|0;e=a[d>>0]|0}while(!(b<<24>>24==0?1:b<<24>>24!=e<<24>>24));f=e;g=b}return (g&255)-(f&255)|0}function Xc(b){b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0;d=b;a:do if(!(d&3)){e=b;f=5}else{g=b;h=d;while(1){if(!(a[g>>0]|0)){i=h;break a}j=g+1|0;h=j;if(!(h&3)){e=j;f=5;break}else g=j}}while(0);if((f|0)==5){f=e;while(1){k=c[f>>2]|0;if(!((k&-2139062144^-2139062144)&k+-16843009))f=f+4|0;else break}if(!((k&255)<<24>>24))l=f;else{k=f;while(1){f=k+1|0;if(!(a[f>>0]|0)){l=f;break}else k=f}}i=l}return i-d|0}function Yc(a,b){a=a|0;b=b|0;var c=0;c=Xc(a)|0;return ((Zc(a,1,c,b)|0)!=(c|0))<<31>>31|0}function Zc(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0;f=r(d,b)|0;g=(b|0)==0?0:d;if((c[e+76>>2]|0)>-1){d=($c(e)|0)==0;h=cd(a,f,e)|0;if(d)i=h;else{_c(e);i=h}}else i=cd(a,f,e)|0;if((i|0)==(f|0))j=g;else j=(i>>>0)/(b>>>0)|0;return j|0}function _c(a){a=a|0;return}function $c(a){a=a|0;return 1}function ad(b,e){b=b|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0;f=Aa;Aa=Aa+16|0;if((Aa|0)>=(Ba|0))w(16);g=f;h=e&255;a[g>>0]=h;i=b+16|0;j=c[i>>2]|0;if(!j)if(!(bd(b)|0)){k=c[i>>2]|0;l=4}else m=-1;else{k=j;l=4}do if((l|0)==4){j=b+20|0;i=c[j>>2]|0;if(i>>>0<k>>>0?(n=e&255,(n|0)!=(a[b+75>>0]|0)):0){c[j>>2]=i+1;a[i>>0]=h;m=n;break}if((Fa[c[b+36>>2]&7](b,g,1)|0)==1)m=d[g>>0]|0;else m=-1}while(0);Aa=f;return m|0}function bd(b){b=b|0;var d=0,e=0,f=0;d=b+74|0;e=a[d>>0]|0;a[d>>0]=e+255|e;e=c[b>>2]|0;if(!(e&8)){c[b+8>>2]=0;c[b+4>>2]=0;d=c[b+44>>2]|0;c[b+28>>2]=d;c[b+20>>2]=d;c[b+16>>2]=d+(c[b+48>>2]|0);f=0}else{c[b>>2]=e|32;f=-1}return f|0}function cd(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0;f=e+16|0;g=c[f>>2]|0;if(!g)if(!(bd(e)|0)){h=c[f>>2]|0;i=5}else j=0;else{h=g;i=5}a:do if((i|0)==5){g=e+20|0;f=c[g>>2]|0;k=f;if((h-f|0)>>>0<d>>>0){j=Fa[c[e+36>>2]&7](e,b,d)|0;break}b:do if((a[e+75>>0]|0)<0|(d|0)==0){l=0;m=b;n=d;o=k}else{f=d;while(1){p=f+-1|0;if((a[b+p>>0]|0)==10)break;if(!p){l=0;m=b;n=d;o=k;break b}else f=p}p=Fa[c[e+36>>2]&7](e,b,f)|0;if(p>>>0<f>>>0){j=p;break a}l=f;m=b+f|0;n=d-f|0;o=c[g>>2]|0}while(0);hf(o|0,m|0,n|0)|0;c[g>>2]=(c[g>>2]|0)+n;j=l+n|0}while(0);return j|0}function dd(a,b){a=a|0;b=b|0;var d=0;if(!b)d=0;else d=ed(c[b>>2]|0,c[b+4>>2]|0,a)|0;return ((d|0)==0?a:d)|0}function ed(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0;f=(c[b>>2]|0)+1794895138|0;g=fd(c[b+8>>2]|0,f)|0;h=fd(c[b+12>>2]|0,f)|0;i=fd(c[b+16>>2]|0,f)|0;a:do if((g>>>0<d>>>2>>>0?(j=d-(g<<2)|0,h>>>0<j>>>0&i>>>0<j>>>0):0)?((i|h)&3|0)==0:0){j=h>>>2;k=i>>>2;l=0;m=g;while(1){n=m>>>1;o=l+n|0;p=o<<1;q=p+j|0;r=fd(c[b+(q<<2)>>2]|0,f)|0;s=fd(c[b+(q+1<<2)>>2]|0,f)|0;if(!(s>>>0<d>>>0&r>>>0<(d-s|0)>>>0)){t=0;break a}if(a[b+(s+r)>>0]|0){t=0;break a}r=Wc(e,b+s|0)|0;if(!r)break;s=(r|0)<0;if((m|0)==1){t=0;break a}l=s?l:o;m=s?n:m-n|0}m=p+k|0;l=fd(c[b+(m<<2)>>2]|0,f)|0;j=fd(c[b+(m+1<<2)>>2]|0,f)|0;if(j>>>0<d>>>0&l>>>0<(d-j|0)>>>0)t=(a[b+(j+l)>>0]|0)==0?b+j|0:0;else t=0}else t=0;while(0);return t|0}function fd(a,b){a=a|0;b=b|0;var c=0;c=gf(a|0)|0;return ((b|0)==0?a:c)|0}function gd(){ba(10036);return 10044}function hd(){la(10036);return}function id(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0;do if(a){if((c[a+76>>2]|0)<=-1){b=jd(a)|0;break}d=($c(a)|0)==0;e=jd(a)|0;if(d)b=e;else{_c(a);b=e}}else{if(!(c[858]|0))f=0;else f=id(c[858]|0)|0;e=c[(gd()|0)>>2]|0;if(!e)g=f;else{d=e;e=f;while(1){if((c[d+76>>2]|0)>-1)h=$c(d)|0;else h=0;if((c[d+20>>2]|0)>>>0>(c[d+28>>2]|0)>>>0)i=jd(d)|0|e;else i=e;if(h|0)_c(d);d=c[d+56>>2]|0;if(!d){g=i;break}else e=i}}hd();b=g}while(0);return b|0}function jd(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0;b=a+20|0;d=a+28|0;if((c[b>>2]|0)>>>0>(c[d>>2]|0)>>>0?(Fa[c[a+36>>2]&7](a,0,0)|0,(c[b>>2]|0)==0):0)e=-1;else{f=a+4|0;g=c[f>>2]|0;h=a+8|0;i=c[h>>2]|0;if(g>>>0<i>>>0)Fa[c[a+40>>2]&7](a,g-i|0,1)|0;c[a+16>>2]=0;c[d>>2]=0;c[b>>2]=0;c[h>>2]=0;c[f>>2]=0;e=0}return e|0}function kd(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0;f=d&255;g=(e|0)!=0;a:do if(g&(b&3|0)!=0){h=d&255;i=b;j=e;while(1){if((a[i>>0]|0)==h<<24>>24){k=i;l=j;m=6;break a}n=i+1|0;o=j+-1|0;p=(o|0)!=0;if(p&(n&3|0)!=0){i=n;j=o}else{q=n;s=o;t=p;m=5;break}}}else{q=b;s=e;t=g;m=5}while(0);if((m|0)==5)if(t){k=q;l=s;m=6}else m=16;b:do if((m|0)==6){s=d&255;if((a[k>>0]|0)==s<<24>>24)if(!l){m=16;break}else{u=k;break}q=r(f,16843009)|0;c:do if(l>>>0>3){t=k;g=l;while(1){e=c[t>>2]^q;if((e&-2139062144^-2139062144)&e+-16843009|0){v=g;w=t;break c}e=t+4|0;b=g+-4|0;if(b>>>0>3){t=e;g=b}else{x=e;y=b;m=11;break}}}else{x=k;y=l;m=11}while(0);if((m|0)==11)if(!y){m=16;break}else{v=y;w=x}q=w;g=v;while(1){if((a[q>>0]|0)==s<<24>>24){u=q;break b}g=g+-1|0;if(!g){m=16;break}else q=q+1|0}}while(0);if((m|0)==16)u=0;return u|0}function ld(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0;f=Aa;Aa=Aa+224|0;if((Aa|0)>=(Ba|0))w(224);g=f+208|0;h=f+160|0;i=f+80|0;j=f;k=h;l=k+40|0;do{c[k>>2]=0;k=k+4|0}while((k|0)<(l|0));c[g>>2]=c[e>>2];if((md(0,d,g,i,h)|0)<0)m=-1;else{if((c[b+76>>2]|0)>-1)n=$c(b)|0;else n=0;e=c[b>>2]|0;k=e&32;if((a[b+74>>0]|0)<1)c[b>>2]=e&-33;e=b+48|0;if(!(c[e>>2]|0)){l=b+44|0;o=c[l>>2]|0;c[l>>2]=j;p=b+28|0;c[p>>2]=j;q=b+20|0;c[q>>2]=j;c[e>>2]=80;r=b+16|0;c[r>>2]=j+80;j=md(b,d,g,i,h)|0;if(!o)s=j;else{Fa[c[b+36>>2]&7](b,0,0)|0;t=(c[q>>2]|0)==0?-1:j;c[l>>2]=o;c[e>>2]=0;c[r>>2]=0;c[p>>2]=0;c[q>>2]=0;s=t}}else s=md(b,d,g,i,h)|0;h=c[b>>2]|0;c[b>>2]=h|k;if(n|0)_c(b);m=(h&32|0)==0?s:-1}Aa=f;return m|0}function md(d,e,f,h,i){d=d|0;e=e|0;f=f|0;h=h|0;i=i|0;var j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ba=0,ca=0,da=0,ea=0,fa=0,ga=0,ha=0,ia=0,ja=0,ka=0,la=0,ma=0,na=0,oa=0,pa=0,qa=0,ra=0,sa=0,ta=0,ua=0,va=0,wa=0,xa=0,ya=0,za=0,Ca=0,Da=0,Ea=0,Fa=0;j=Aa;Aa=Aa+64|0;if((Aa|0)>=(Ba|0))w(64);k=j+56|0;l=j+40|0;m=j;n=j+48|0;o=j+60|0;c[k>>2]=e;e=(d|0)!=0;p=m+40|0;q=p;r=m+39|0;m=n+4|0;s=0;t=0;u=0;a:while(1){x=s;y=t;while(1){do if((y|0)>-1)if((x|0)>(2147483647-y|0)){c[(Rc()|0)>>2]=75;z=-1;break}else{z=x+y|0;break}else z=y;while(0);A=c[k>>2]|0;B=a[A>>0]|0;if(!(B<<24>>24)){C=94;break a}D=B;B=A;b:while(1){switch(D<<24>>24){case 37:{C=10;break b;break}case 0:{E=B;break b;break}default:{}}F=B+1|0;c[k>>2]=F;D=a[F>>0]|0;B=F}c:do if((C|0)==10){C=0;D=B;F=B;while(1){if((a[F+1>>0]|0)!=37){E=D;break c}G=D+1|0;F=F+2|0;c[k>>2]=F;if((a[F>>0]|0)!=37){E=G;break}else D=G}}while(0);x=E-A|0;if(e)nd(d,A,x);if(!x)break;else y=z}y=(Uc(a[(c[k>>2]|0)+1>>0]|0)|0)==0;x=c[k>>2]|0;if(!y?(a[x+2>>0]|0)==36:0){H=(a[x+1>>0]|0)+-48|0;I=1;J=3}else{H=-1;I=u;J=1}y=x+J|0;c[k>>2]=y;x=a[y>>0]|0;B=(x<<24>>24)+-32|0;if(B>>>0>31|(1<<B&75913|0)==0){K=0;L=x;M=y}else{x=0;D=B;B=y;while(1){y=1<<D|x;F=B+1|0;c[k>>2]=F;G=a[F>>0]|0;D=(G<<24>>24)+-32|0;if(D>>>0>31|(1<<D&75913|0)==0){K=y;L=G;M=F;break}else{x=y;B=F}}}if(L<<24>>24==42){if((Uc(a[M+1>>0]|0)|0)!=0?(B=c[k>>2]|0,(a[B+2>>0]|0)==36):0){x=B+1|0;c[i+((a[x>>0]|0)+-48<<2)>>2]=10;N=c[h+((a[x>>0]|0)+-48<<3)>>2]|0;O=1;P=B+3|0}else{if(I|0){Q=-1;break}if(e){B=(c[f>>2]|0)+(4-1)&~(4-1);x=c[B>>2]|0;c[f>>2]=B+4;R=x}else R=0;N=R;O=0;P=(c[k>>2]|0)+1|0}c[k>>2]=P;x=(N|0)<0;S=x?0-N|0:N;T=x?K|8192:K;U=O;V=P}else{x=od(k)|0;if((x|0)<0){Q=-1;break}S=x;T=K;U=I;V=c[k>>2]|0}do if((a[V>>0]|0)==46){x=V+1|0;if((a[x>>0]|0)!=42){c[k>>2]=x;x=od(k)|0;W=x;X=c[k>>2]|0;break}if(Uc(a[V+2>>0]|0)|0?(x=c[k>>2]|0,(a[x+3>>0]|0)==36):0){B=x+2|0;c[i+((a[B>>0]|0)+-48<<2)>>2]=10;D=c[h+((a[B>>0]|0)+-48<<3)>>2]|0;B=x+4|0;c[k>>2]=B;W=D;X=B;break}if(U|0){Q=-1;break a}if(e){B=(c[f>>2]|0)+(4-1)&~(4-1);D=c[B>>2]|0;c[f>>2]=B+4;Y=D}else Y=0;D=(c[k>>2]|0)+2|0;c[k>>2]=D;W=Y;X=D}else{W=-1;X=V}while(0);D=0;B=X;while(1){if(((a[B>>0]|0)+-65|0)>>>0>57){Q=-1;break a}x=B;B=B+1|0;c[k>>2]=B;Z=a[(a[x>>0]|0)+-65+(16+(D*58|0))>>0]|0;_=Z&255;if((_+-1|0)>>>0>=8)break;else D=_}if(!(Z<<24>>24)){Q=-1;break}x=(H|0)>-1;do if(Z<<24>>24==19)if(x){Q=-1;break a}else C=54;else{if(x){c[i+(H<<2)>>2]=_;F=h+(H<<3)|0;y=c[F+4>>2]|0;G=l;c[G>>2]=c[F>>2];c[G+4>>2]=y;C=54;break}if(!e){Q=0;break a}pd(l,_,f);$=c[k>>2]|0;C=55}while(0);if((C|0)==54){C=0;if(e){$=B;C=55}else aa=0}d:do if((C|0)==55){C=0;x=a[$+-1>>0]|0;y=(D|0)!=0&(x&15|0)==3?x&-33:x;x=T&-65537;G=(T&8192|0)==0?T:x;e:do switch(y|0){case 110:{switch((D&255)<<24>>24){case 0:{c[c[l>>2]>>2]=z;aa=0;break d;break}case 1:{c[c[l>>2]>>2]=z;aa=0;break d;break}case 2:{F=c[l>>2]|0;c[F>>2]=z;c[F+4>>2]=((z|0)<0)<<31>>31;aa=0;break d;break}case 3:{b[c[l>>2]>>1]=z;aa=0;break d;break}case 4:{a[c[l>>2]>>0]=z;aa=0;break d;break}case 6:{c[c[l>>2]>>2]=z;aa=0;break d;break}case 7:{F=c[l>>2]|0;c[F>>2]=z;c[F+4>>2]=((z|0)<0)<<31>>31;aa=0;break d;break}default:{aa=0;break d}}break}case 112:{ba=120;ca=W>>>0>8?W:8;da=G|8;C=67;break}case 88:case 120:{ba=y;ca=W;da=G;C=67;break}case 111:{F=l;ea=c[F>>2]|0;fa=c[F+4>>2]|0;F=rd(ea,fa,p)|0;ga=q-F|0;ha=F;ia=0;ja=5503;ka=(G&8|0)==0|(W|0)>(ga|0)?W:ga+1|0;la=G;ma=ea;na=fa;C=73;break}case 105:case 100:{fa=l;ea=c[fa>>2]|0;ga=c[fa+4>>2]|0;if((ga|0)<0){fa=af(0,0,ea|0,ga|0)|0;F=v()|0;oa=l;c[oa>>2]=fa;c[oa+4>>2]=F;pa=1;qa=5503;ra=fa;sa=F;C=72;break e}else{pa=(G&2049|0)!=0&1;qa=(G&2048|0)==0?((G&1|0)==0?5503:5505):5504;ra=ea;sa=ga;C=72;break e}break}case 117:{ga=l;pa=0;qa=5503;ra=c[ga>>2]|0;sa=c[ga+4>>2]|0;C=72;break}case 99:{a[r>>0]=c[l>>2];ta=r;ua=0;va=5503;wa=1;xa=x;ya=q;break}case 109:{za=td(c[(Rc()|0)>>2]|0)|0;C=77;break}case 115:{ga=c[l>>2]|0;za=(ga|0)==0?5513:ga;C=77;break}case 67:{c[n>>2]=c[l>>2];c[m>>2]=0;c[l>>2]=n;Ca=-1;C=81;break}case 83:{if(!W){ud(d,32,S,0,G);Da=0;C=91}else{Ca=W;C=81}break}case 65:case 71:case 70:case 69:case 97:case 103:case 102:case 101:{aa=wd(d,+g[l>>3],S,W,G,y)|0;break d;break}default:{ta=A;ua=0;va=5503;wa=W;xa=G;ya=q}}while(0);f:do if((C|0)==67){C=0;y=l;ga=c[y>>2]|0;ea=c[y+4>>2]|0;y=qd(ga,ea,p,ba&32)|0;F=(da&8|0)==0|(ga|0)==0&(ea|0)==0;ha=y;ia=F?0:2;ja=F?5503:5503+(ba>>>4)|0;ka=ca;la=da;ma=ga;na=ea;C=73}else if((C|0)==72){C=0;ha=sd(ra,sa,p)|0;ia=pa;ja=qa;ka=W;la=G;ma=ra;na=sa;C=73}else if((C|0)==77){C=0;ea=kd(za,0,W)|0;ga=(ea|0)==0;ta=za;ua=0;va=5503;wa=ga?W:ea-za|0;xa=x;ya=ga?za+W|0:ea}else if((C|0)==81){C=0;ea=c[l>>2]|0;ga=0;while(1){F=c[ea>>2]|0;if(!F){Ea=ga;break}y=vd(o,F)|0;Fa=(y|0)<0;if(Fa|y>>>0>(Ca-ga|0)>>>0){C=85;break}F=y+ga|0;if(Ca>>>0>F>>>0){ea=ea+4|0;ga=F}else{Ea=F;break}}if((C|0)==85){C=0;if(Fa){Q=-1;break a}else Ea=ga}ud(d,32,S,Ea,G);if(!Ea){Da=0;C=91}else{ea=c[l>>2]|0;F=0;while(1){y=c[ea>>2]|0;if(!y){Da=Ea;C=91;break f}fa=vd(o,y)|0;F=fa+F|0;if((F|0)>(Ea|0)){Da=Ea;C=91;break f}nd(d,o,fa);if(F>>>0>=Ea>>>0){Da=Ea;C=91;break}else ea=ea+4|0}}}while(0);if((C|0)==73){C=0;x=(ma|0)!=0|(na|0)!=0;ea=(ka|0)!=0|x;F=q-ha+((x^1)&1)|0;ta=ea?ha:p;ua=ia;va=ja;wa=ea?((ka|0)>(F|0)?ka:F):0;xa=(ka|0)>-1?la&-65537:la;ya=q}else if((C|0)==91){C=0;ud(d,32,S,Da,G^8192);aa=(S|0)>(Da|0)?S:Da;break}F=ya-ta|0;ea=(wa|0)<(F|0)?F:wa;x=ea+ua|0;ga=(S|0)<(x|0)?x:S;ud(d,32,ga,x,xa);nd(d,va,ua);ud(d,48,ga,x,xa^65536);ud(d,48,ea,F,0);nd(d,ta,F);ud(d,32,ga,x,xa^8192);aa=ga}while(0);s=aa;t=z;u=U}g:do if((C|0)==94)if(!d)if(!u)Q=0;else{U=1;while(1){t=c[i+(U<<2)>>2]|0;if(!t)break;pd(h+(U<<3)|0,t,f);t=U+1|0;if(t>>>0<10)U=t;else{Q=1;break g}}t=U;while(1){if(c[i+(t<<2)>>2]|0){Q=-1;break g}t=t+1|0;if(t>>>0>=10){Q=1;break}}}else Q=z;while(0);Aa=j;return Q|0}function nd(a,b,d){a=a|0;b=b|0;d=d|0;if(!(c[a>>2]&32))cd(b,d,a)|0;return}function od(b){b=b|0;var d=0,e=0,f=0,g=0,h=0;if(!(Uc(a[c[b>>2]>>0]|0)|0))d=0;else{e=0;while(1){f=c[b>>2]|0;g=(e*10|0)+-48+(a[f>>0]|0)|0;h=f+1|0;c[b>>2]=h;if(!(Uc(a[h>>0]|0)|0)){d=g;break}else e=g}}return d|0}function pd(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,h=0,i=0,j=0.0;a:do if(b>>>0<=20)do switch(b|0){case 9:{e=(c[d>>2]|0)+(4-1)&~(4-1);f=c[e>>2]|0;c[d>>2]=e+4;c[a>>2]=f;break a;break}case 10:{f=(c[d>>2]|0)+(4-1)&~(4-1);e=c[f>>2]|0;c[d>>2]=f+4;f=a;c[f>>2]=e;c[f+4>>2]=((e|0)<0)<<31>>31;break a;break}case 11:{e=(c[d>>2]|0)+(4-1)&~(4-1);f=c[e>>2]|0;c[d>>2]=e+4;e=a;c[e>>2]=f;c[e+4>>2]=0;break a;break}case 12:{e=(c[d>>2]|0)+(8-1)&~(8-1);f=e;h=c[f>>2]|0;i=c[f+4>>2]|0;c[d>>2]=e+8;e=a;c[e>>2]=h;c[e+4>>2]=i;break a;break}case 13:{i=(c[d>>2]|0)+(4-1)&~(4-1);e=c[i>>2]|0;c[d>>2]=i+4;i=(e&65535)<<16>>16;e=a;c[e>>2]=i;c[e+4>>2]=((i|0)<0)<<31>>31;break a;break}case 14:{i=(c[d>>2]|0)+(4-1)&~(4-1);e=c[i>>2]|0;c[d>>2]=i+4;i=a;c[i>>2]=e&65535;c[i+4>>2]=0;break a;break}case 15:{i=(c[d>>2]|0)+(4-1)&~(4-1);e=c[i>>2]|0;c[d>>2]=i+4;i=(e&255)<<24>>24;e=a;c[e>>2]=i;c[e+4>>2]=((i|0)<0)<<31>>31;break a;break}case 16:{i=(c[d>>2]|0)+(4-1)&~(4-1);e=c[i>>2]|0;c[d>>2]=i+4;i=a;c[i>>2]=e&255;c[i+4>>2]=0;break a;break}case 17:{i=(c[d>>2]|0)+(8-1)&~(8-1);j=+g[i>>3];c[d>>2]=i+8;g[a>>3]=j;break a;break}case 18:{i=(c[d>>2]|0)+(8-1)&~(8-1);j=+g[i>>3];c[d>>2]=i+8;g[a>>3]=j;break a;break}default:break a}while(0);while(0);return}function qd(b,c,e,f){b=b|0;c=c|0;e=e|0;f=f|0;var g=0,h=0;if((b|0)==0&(c|0)==0)g=e;else{h=e;e=c;c=b;while(1){b=h+-1|0;a[b>>0]=d[480+(c&15)>>0]|0|f;c=ef(c|0,e|0,4)|0;e=v()|0;if((c|0)==0&(e|0)==0){g=b;break}else h=b}}return g|0}function rd(b,c,d){b=b|0;c=c|0;d=d|0;var e=0,f=0;if((b|0)==0&(c|0)==0)e=d;else{f=d;d=c;c=b;while(1){b=f+-1|0;a[b>>0]=c&7|48;c=ef(c|0,d|0,3)|0;d=v()|0;if((c|0)==0&(d|0)==0){e=b;break}else f=b}}return e|0}function sd(b,c,d){b=b|0;c=c|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;if(c>>>0>0|(c|0)==0&b>>>0>4294967295){e=d;f=b;g=c;do{c=f;f=df(f|0,g|0,10,0)|0;h=g;g=v()|0;i=_e(f|0,g|0,10,0)|0;j=af(c|0,h|0,i|0,v()|0)|0;v()|0;e=e+-1|0;a[e>>0]=j&255|48}while(h>>>0>9|(h|0)==9&c>>>0>4294967295);k=f;l=e}else{k=b;l=d}if(!k)m=l;else{d=k;k=l;while(1){l=d;d=(d>>>0)/10|0;b=k+-1|0;a[b>>0]=l-(d*10|0)|48;if(l>>>0<10){m=b;break}else k=b}}return m|0}function td(a){a=a|0;return Dd(a,c[(Cd()|0)+188>>2]|0)|0}function ud(a,b,c,d,e){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;var f=0,g=0,h=0;f=Aa;Aa=Aa+256|0;if((Aa|0)>=(Ba|0))w(256);g=f;if((c|0)>(d|0)&(e&73728|0)==0){e=c-d|0;kf(g|0,b<<24>>24|0,(e>>>0<256?e:256)|0)|0;if(e>>>0>255){b=c-d|0;d=e;do{nd(a,g,256);d=d+-256|0}while(d>>>0>255);h=b&255}else h=e;nd(a,g,h)}Aa=f;return}function vd(a,b){a=a|0;b=b|0;var c=0;if(!a)c=0;else c=Ad(a,b,0)|0;return c|0}function wd(b,e,f,g,h,i){b=b|0;e=+e;f=f|0;g=g|0;h=h|0;i=i|0;var j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,s=0,t=0.0,u=0,x=0.0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0.0,H=0,I=0,J=0,K=0.0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0.0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ba=0,ca=0,da=0,ea=0,fa=0,ga=0,ha=0,ia=0.0,ja=0.0,ka=0,la=0,ma=0,na=0,oa=0,pa=0,qa=0,ra=0,sa=0,ta=0,ua=0,va=0,wa=0,xa=0,ya=0,za=0,Ca=0,Da=0,Ea=0,Fa=0,Ga=0,Ha=0,Ia=0,Ja=0,Ka=0;j=Aa;Aa=Aa+560|0;if((Aa|0)>=(Ba|0))w(560);k=j+32|0;l=j+536|0;m=j;n=m;o=j+540|0;c[l>>2]=0;p=o+12|0;q=xd(e)|0;s=v()|0;if((s|0)<0){t=-e;u=xd(t)|0;x=t;y=1;z=5520;A=v()|0;B=u}else{x=e;y=(h&2049|0)!=0&1;z=(h&2048|0)==0?((h&1|0)==0?5521:5526):5523;A=s;B=q}do if(0==0&(A&2146435072|0)==2146435072){q=(i&32|0)!=0;B=y+3|0;ud(b,32,f,B,h&-65537);nd(b,z,y);nd(b,x!=x|0.0!=0.0?(q?5547:5551):q?5539:5543,3);ud(b,32,f,B,h^8192);C=B}else{e=+yd(x,l)*2.0;B=e!=0.0;if(B)c[l>>2]=(c[l>>2]|0)+-1;q=i|32;if((q|0)==97){s=i&32;u=(s|0)==0?z:z+9|0;D=y|2;E=12-g|0;do if(!(g>>>0>11|(E|0)==0)){t=8.0;F=E;do{F=F+-1|0;t=t*16.0}while((F|0)!=0);if((a[u>>0]|0)==45){G=-(t+(-e-t));break}else{G=e+t-t;break}}else G=e;while(0);E=c[l>>2]|0;F=(E|0)<0?0-E|0:E;H=sd(F,((F|0)<0)<<31>>31,p)|0;if((H|0)==(p|0)){F=o+11|0;a[F>>0]=48;I=F}else I=H;a[I+-1>>0]=(E>>31&2)+43;E=I+-2|0;a[E>>0]=i+15;H=(g|0)<1;F=(h&8|0)==0;J=m;K=G;while(1){L=~~K;M=J+1|0;a[J>>0]=s|d[480+L>>0];K=(K-+(L|0))*16.0;if((M-n|0)==1?!(F&(H&K==0.0)):0){a[M>>0]=46;N=J+2|0}else N=M;if(!(K!=0.0))break;else J=N}J=N;if((g|0)!=0?(-2-n+J|0)<(g|0):0){H=p;F=E;O=g+2+H-F|0;P=H;Q=F}else{F=p;H=E;O=F-n-H+J|0;P=F;Q=H}H=O+D|0;ud(b,32,f,H,h);nd(b,u,D);ud(b,48,f,H,h^65536);F=J-n|0;nd(b,m,F);J=P-Q|0;ud(b,48,O-(F+J)|0,0,0);nd(b,E,J);ud(b,32,f,H,h^8192);C=H;break}H=(g|0)<0?6:g;if(B){J=(c[l>>2]|0)+-28|0;c[l>>2]=J;R=e*268435456.0;S=J}else{R=e;S=c[l>>2]|0}J=(S|0)<0?k:k+288|0;F=J;K=R;do{s=~~K>>>0;c[F>>2]=s;F=F+4|0;K=(K-+(s>>>0))*1.0e9}while(K!=0.0);B=J;if((S|0)>0){E=J;D=F;u=S;while(1){s=(u|0)<29?u:29;M=D+-4|0;if(M>>>0>=E>>>0){L=M;M=0;do{T=ff(c[L>>2]|0,0,s|0)|0;U=$e(T|0,v()|0,M|0,0)|0;T=v()|0;M=df(U|0,T|0,1e9,0)|0;V=_e(M|0,v()|0,1e9,0)|0;W=af(U|0,T|0,V|0,v()|0)|0;v()|0;c[L>>2]=W;L=L+-4|0}while(L>>>0>=E>>>0);if(M){L=E+-4|0;c[L>>2]=M;X=L}else X=E}else X=E;a:do if(D>>>0>X>>>0){L=D;while(1){W=L+-4|0;if(c[W>>2]|0){Y=L;break a}if(W>>>0>X>>>0)L=W;else{Y=W;break}}}else Y=D;while(0);M=(c[l>>2]|0)-s|0;c[l>>2]=M;if((M|0)>0){E=X;D=Y;u=M}else{Z=X;_=Y;$=M;break}}}else{Z=J;_=F;$=S}if(($|0)<0){u=((H+25|0)/9|0)+1|0;D=(q|0)==102;E=Z;M=_;L=$;while(1){W=0-L|0;V=(W|0)<9?W:9;if(E>>>0<M>>>0){W=(1<<V)+-1|0;T=1e9>>>V;U=0;aa=E;do{ba=c[aa>>2]|0;c[aa>>2]=(ba>>>V)+U;U=r(ba&W,T)|0;aa=aa+4|0}while(aa>>>0<M>>>0);aa=(c[E>>2]|0)==0?E+4|0:E;if(!U){ca=M;da=aa}else{c[M>>2]=U;ca=M+4|0;da=aa}}else{ca=M;da=(c[E>>2]|0)==0?E+4|0:E}aa=D?J:da;T=(ca-aa>>2|0)>(u|0)?aa+(u<<2)|0:ca;L=(c[l>>2]|0)+V|0;c[l>>2]=L;if((L|0)>=0){ea=da;fa=T;break}else{E=da;M=T}}}else{ea=Z;fa=_}if(ea>>>0<fa>>>0){M=(B-ea>>2)*9|0;E=c[ea>>2]|0;if(E>>>0<10)ga=M;else{L=M;M=10;while(1){M=M*10|0;u=L+1|0;if(E>>>0<M>>>0){ga=u;break}else L=u}}}else ga=0;L=(q|0)==103;M=(H|0)!=0;E=H-((q|0)==102?0:ga)+((M&L)<<31>>31)|0;if((E|0)<(((fa-B>>2)*9|0)+-9|0)){u=E+9216|0;E=(u|0)/9|0;D=J+4+(E+-1024<<2)|0;F=u-(E*9|0)|0;if((F|0)<8){E=F;F=10;while(1){u=F*10|0;if((E|0)<7){E=E+1|0;F=u}else{ha=u;break}}}else ha=10;F=c[D>>2]|0;E=(F>>>0)/(ha>>>0)|0;q=F-(r(E,ha)|0)|0;u=(D+4|0)==(fa|0);if(!(u&(q|0)==0)){t=(E&1|0)==0?9007199254740992.0:9007199254740994.0;E=ha>>>1;K=q>>>0<E>>>0?.5:u&(q|0)==(E|0)?1.0:1.5;if(!y){ia=K;ja=t}else{E=(a[z>>0]|0)==45;ia=E?-K:K;ja=E?-t:t}E=F-q|0;c[D>>2]=E;if(ja+ia!=ja){q=E+ha|0;c[D>>2]=q;if(q>>>0>999999999){q=D;E=ea;while(1){F=q+-4|0;c[q>>2]=0;if(F>>>0<E>>>0){u=E+-4|0;c[u>>2]=0;ka=u}else ka=E;u=(c[F>>2]|0)+1|0;c[F>>2]=u;if(u>>>0>999999999){q=F;E=ka}else{la=F;ma=ka;break}}}else{la=D;ma=ea}E=(B-ma>>2)*9|0;q=c[ma>>2]|0;if(q>>>0<10){na=la;oa=E;pa=ma}else{F=E;E=10;while(1){E=E*10|0;u=F+1|0;if(q>>>0<E>>>0){na=la;oa=u;pa=ma;break}else F=u}}}else{na=D;oa=ga;pa=ea}}else{na=D;oa=ga;pa=ea}F=na+4|0;qa=oa;ra=fa>>>0>F>>>0?F:fa;sa=pa}else{qa=ga;ra=fa;sa=ea}F=0-qa|0;b:do if(ra>>>0>sa>>>0){E=ra;while(1){q=E+-4|0;if(c[q>>2]|0){ta=E;ua=1;break b}if(q>>>0>sa>>>0)E=q;else{ta=q;ua=0;break}}}else{ta=ra;ua=0}while(0);do if(L){D=H+((M^1)&1)|0;if((D|0)>(qa|0)&(qa|0)>-5){va=i+-1|0;wa=D+-1-qa|0}else{va=i+-2|0;wa=D+-1|0}if(!(h&8)){if(ua?(D=c[ta+-4>>2]|0,(D|0)!=0):0)if(!((D>>>0)%10|0)){E=0;V=10;while(1){V=V*10|0;U=E+1|0;if((D>>>0)%(V>>>0)|0|0){xa=U;break}else E=U}}else xa=0;else xa=9;E=((ta-B>>2)*9|0)+-9|0;if((va|32|0)==102){V=E-xa|0;D=(V|0)>0?V:0;ya=va;za=(wa|0)<(D|0)?wa:D;break}else{D=E+qa-xa|0;E=(D|0)>0?D:0;ya=va;za=(wa|0)<(E|0)?wa:E;break}}else{ya=va;za=wa}}else{ya=i;za=H}while(0);H=(za|0)!=0;B=H?1:h>>>3&1;M=(ya|32|0)==102;if(M){Ca=0;Da=(qa|0)>0?qa:0}else{L=(qa|0)<0?F:qa;E=sd(L,((L|0)<0)<<31>>31,p)|0;L=p;if((L-E|0)<2){D=E;while(1){V=D+-1|0;a[V>>0]=48;if((L-V|0)<2)D=V;else{Ea=V;break}}}else Ea=E;a[Ea+-1>>0]=(qa>>31&2)+43;D=Ea+-2|0;a[D>>0]=ya;Ca=D;Da=L-D|0}D=y+1+za+B+Da|0;ud(b,32,f,D,h);nd(b,z,y);ud(b,48,f,D,h^65536);if(M){F=sa>>>0>J>>>0?J:sa;V=m+9|0;U=V;q=m+8|0;u=F;do{T=sd(c[u>>2]|0,0,V)|0;if((u|0)==(F|0))if((T|0)==(V|0)){a[q>>0]=48;Fa=q}else Fa=T;else if(T>>>0>m>>>0){kf(m|0,48,T-n|0)|0;aa=T;while(1){W=aa+-1|0;if(W>>>0>m>>>0)aa=W;else{Fa=W;break}}}else Fa=T;nd(b,Fa,U-Fa|0);u=u+4|0}while(u>>>0<=J>>>0);if(!((h&8|0)==0&(H^1)))nd(b,5555,1);if(u>>>0<ta>>>0&(za|0)>0){J=za;U=u;while(1){q=sd(c[U>>2]|0,0,V)|0;if(q>>>0>m>>>0){kf(m|0,48,q-n|0)|0;F=q;while(1){M=F+-1|0;if(M>>>0>m>>>0)F=M;else{Ga=M;break}}}else Ga=q;nd(b,Ga,(J|0)<9?J:9);U=U+4|0;F=J+-9|0;if(!(U>>>0<ta>>>0&(J|0)>9)){Ha=F;break}else J=F}}else Ha=za;ud(b,48,Ha+9|0,9,0)}else{J=ua?ta:sa+4|0;if(sa>>>0<J>>>0&(za|0)>-1){U=m+9|0;V=(h&8|0)==0;u=U;H=0-n|0;F=m+8|0;T=za;M=sa;while(1){B=sd(c[M>>2]|0,0,U)|0;if((B|0)==(U|0)){a[F>>0]=48;Ia=F}else Ia=B;do if((M|0)==(sa|0)){B=Ia+1|0;nd(b,Ia,1);if(V&(T|0)<1){Ja=B;break}nd(b,5555,1);Ja=B}else{if(Ia>>>0<=m>>>0){Ja=Ia;break}kf(m|0,48,Ia+H|0)|0;B=Ia;while(1){L=B+-1|0;if(L>>>0>m>>>0)B=L;else{Ja=L;break}}}while(0);q=u-Ja|0;nd(b,Ja,(T|0)>(q|0)?q:T);B=T-q|0;M=M+4|0;if(!(M>>>0<J>>>0&(B|0)>-1)){Ka=B;break}else T=B}}else Ka=za;ud(b,48,Ka+18|0,18,0);nd(b,Ca,p-Ca|0)}ud(b,32,f,D,h^8192);C=D}while(0);Aa=j;return ((C|0)<(f|0)?f:C)|0}function xd(a){a=+a;var b=0;g[h>>3]=a;b=c[h>>2]|0;u(c[h+4>>2]|0);return b|0}function yd(a,b){a=+a;b=b|0;return +(+zd(a,b))}function zd(a,b){a=+a;b=b|0;var d=0,e=0,f=0,i=0.0,j=0.0,k=0,l=0.0;g[h>>3]=a;d=c[h>>2]|0;e=c[h+4>>2]|0;f=ef(d|0,e|0,52)|0;v()|0;switch(f&2047){case 0:{if(a!=0.0){i=+zd(a*18446744073709551616.0,b);j=i;k=(c[b>>2]|0)+-64|0}else{j=a;k=0}c[b>>2]=k;l=j;break}case 2047:{l=a;break}default:{c[b>>2]=(f&2047)+-1022;c[h>>2]=d;c[h+4>>2]=e&-2146435073|1071644672;l=+g[h>>3]}}return +l}function Ad(b,d,e){b=b|0;d=d|0;e=e|0;var f=0;do if(b){if(d>>>0<128){a[b>>0]=d;f=1;break}if(!(c[c[(Bd()|0)+188>>2]>>2]|0))if((d&-128|0)==57216){a[b>>0]=d;f=1;break}else{c[(Rc()|0)>>2]=84;f=-1;break}if(d>>>0<2048){a[b>>0]=d>>>6|192;a[b+1>>0]=d&63|128;f=2;break}if(d>>>0<55296|(d&-8192|0)==57344){a[b>>0]=d>>>12|224;a[b+1>>0]=d>>>6&63|128;a[b+2>>0]=d&63|128;f=3;break}if((d+-65536|0)>>>0<1048576){a[b>>0]=d>>>18|240;a[b+1>>0]=d>>>12&63|128;a[b+2>>0]=d>>>6&63|128;a[b+3>>0]=d&63|128;f=4;break}else{c[(Rc()|0)>>2]=84;f=-1;break}}else f=1;while(0);return f|0}function Bd(){return Vc()|0}function Cd(){return Vc()|0}function Dd(b,e){b=b|0;e=e|0;var f=0,g=0,h=0,i=0,j=0;f=0;while(1){if((d[496+f>>0]|0)==(b|0)){g=4;break}h=f+1|0;if((h|0)==87){i=87;g=5;break}else f=h}if((g|0)==4)if(!f)j=592;else{i=f;g=5}if((g|0)==5){g=592;f=i;while(1){i=g;do{b=i;i=i+1|0}while((a[b>>0]|0)!=0);f=f+-1|0;if(!f){j=i;break}else g=i}}return Ed(j,c[e+20>>2]|0)|0}function Ed(a,b){a=a|0;b=b|0;return dd(a,b)|0}function Fd(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0;e=Aa;Aa=Aa+48|0;if((Aa|0)>=(Ba|0))w(48);f=e+32|0;g=e+16|0;h=e;if(!(b&4194368))i=0;else{c[h>>2]=d;d=(c[h>>2]|0)+(4-1)&~(4-1);j=c[d>>2]|0;c[h>>2]=d+4;i=j}c[g>>2]=a;c[g+4>>2]=b|32768;c[g+8>>2]=i;i=ia(5,g|0)|0;if(!((b&524288|0)==0|(i|0)<0)){c[f>>2]=i;c[f+4>>2]=2;c[f+8>>2]=1;ga(221,f|0)|0}f=Qc(i)|0;Aa=e;return f|0}function Gd(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0;e=Aa;Aa=Aa+16|0;if((Aa|0)>=(Ba|0))w(16);f=e;c[f>>2]=a;c[f+4>>2]=b;c[f+8>>2]=d;d=Qc(ha(3,f|0)|0)|0;Aa=e;return d|0}function Hd(a,b){a=a|0;b=b|0;var d=0,e=0;d=Aa;Aa=Aa+16|0;if((Aa|0)>=(Ba|0))w(16);e=d;c[e>>2]=b;b=ld(c[826]|0,a,e)|0;Aa=d;return b|0}function Id(b,d){b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0;if((c[d+76>>2]|0)>=0?($c(d)|0)!=0:0){e=b&255;f=b&255;if((f|0)!=(a[d+75>>0]|0)?(g=d+20|0,h=c[g>>2]|0,h>>>0<(c[d+16>>2]|0)>>>0):0){c[g>>2]=h+1;a[h>>0]=e;i=f}else i=ad(d,b)|0;_c(d);j=i}else k=3;do if((k|0)==3){i=b&255;f=b&255;if((f|0)!=(a[d+75>>0]|0)?(e=d+20|0,h=c[e>>2]|0,h>>>0<(c[d+16>>2]|0)>>>0):0){c[e>>2]=h+1;a[h>>0]=i;j=f;break}j=ad(d,b)|0}while(0);return j|0}function Jd(b){b=b|0;var d=0,e=0,f=0,g=0,h=0;d=c[826]|0;if((c[d+76>>2]|0)>-1)e=$c(d)|0;else e=0;do if((Yc(b,d)|0)<0)f=-1;else{if((a[d+75>>0]|0)!=10?(g=d+20|0,h=c[g>>2]|0,h>>>0<(c[d+16>>2]|0)>>>0):0){c[g>>2]=h+1;a[h>>0]=10;f=0;break}f=(ad(d,10)|0)>>31}while(0);if(e|0)_c(d);return f|0}function Kd(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ba=0,ca=0,da=0,ea=0,fa=0,ga=0,ha=0,ia=0,ja=0,ka=0,la=0,ma=0,na=0,oa=0,pa=0,qa=0,ra=0,sa=0,ta=0,ua=0,va=0,wa=0,xa=0,ya=0,za=0,Ca=0,Da=0,Ea=0,Fa=0,Ga=0,Ha=0,Ia=0,Ja=0,Ka=0,La=0;b=Aa;Aa=Aa+16|0;if((Aa|0)>=(Ba|0))w(16);d=b;do if(a>>>0<245){e=a>>>0<11?16:a+11&-8;f=e>>>3;g=c[2512]|0;h=g>>>f;if(h&3|0){i=(h&1^1)+f|0;j=10088+(i<<1<<2)|0;k=j+8|0;l=c[k>>2]|0;m=l+8|0;n=c[m>>2]|0;if((n|0)==(j|0))c[2512]=g&~(1<<i);else{c[n+12>>2]=j;c[k>>2]=n}n=i<<3;c[l+4>>2]=n|3;i=l+n+4|0;c[i>>2]=c[i>>2]|1;o=m;Aa=b;return o|0}m=c[2514]|0;if(e>>>0>m>>>0){if(h|0){i=2<<f;n=h<<f&(i|0-i);i=(n&0-n)+-1|0;n=i>>>12&16;f=i>>>n;i=f>>>5&8;h=f>>>i;f=h>>>2&4;l=h>>>f;h=l>>>1&2;k=l>>>h;l=k>>>1&1;j=(i|n|f|h|l)+(k>>>l)|0;l=10088+(j<<1<<2)|0;k=l+8|0;h=c[k>>2]|0;f=h+8|0;n=c[f>>2]|0;if((n|0)==(l|0)){i=g&~(1<<j);c[2512]=i;p=i}else{c[n+12>>2]=l;c[k>>2]=n;p=g}n=j<<3;j=n-e|0;c[h+4>>2]=e|3;k=h+e|0;c[k+4>>2]=j|1;c[h+n>>2]=j;if(m|0){n=c[2517]|0;h=m>>>3;l=10088+(h<<1<<2)|0;i=1<<h;if(!(p&i)){c[2512]=p|i;q=l;r=l+8|0}else{i=l+8|0;q=c[i>>2]|0;r=i}c[r>>2]=n;c[q+12>>2]=n;c[n+8>>2]=q;c[n+12>>2]=l}c[2514]=j;c[2517]=k;o=f;Aa=b;return o|0}f=c[2513]|0;if(f){k=(f&0-f)+-1|0;j=k>>>12&16;l=k>>>j;k=l>>>5&8;n=l>>>k;l=n>>>2&4;i=n>>>l;n=i>>>1&2;h=i>>>n;i=h>>>1&1;s=c[10352+((k|j|l|n|i)+(h>>>i)<<2)>>2]|0;i=s;h=s;n=(c[s+4>>2]&-8)-e|0;while(1){s=c[i+16>>2]|0;if(!s){l=c[i+20>>2]|0;if(!l)break;else t=l}else t=s;s=(c[t+4>>2]&-8)-e|0;l=s>>>0<n>>>0;i=t;h=l?t:h;n=l?s:n}i=h+e|0;if(i>>>0>h>>>0){s=c[h+24>>2]|0;l=c[h+12>>2]|0;do if((l|0)==(h|0)){j=h+20|0;k=c[j>>2]|0;if(!k){u=h+16|0;v=c[u>>2]|0;if(!v){x=0;break}else{y=v;z=u}}else{y=k;z=j}j=y;k=z;while(1){u=j+20|0;v=c[u>>2]|0;if(!v){A=j+16|0;B=c[A>>2]|0;if(!B)break;else{C=B;D=A}}else{C=v;D=u}j=C;k=D}c[k>>2]=0;x=j}else{u=c[h+8>>2]|0;c[u+12>>2]=l;c[l+8>>2]=u;x=l}while(0);do if(s|0){l=c[h+28>>2]|0;u=10352+(l<<2)|0;if((h|0)==(c[u>>2]|0)){c[u>>2]=x;if(!x){c[2513]=f&~(1<<l);break}}else{l=s+16|0;c[((c[l>>2]|0)==(h|0)?l:s+20|0)>>2]=x;if(!x)break}c[x+24>>2]=s;l=c[h+16>>2]|0;if(l|0){c[x+16>>2]=l;c[l+24>>2]=x}l=c[h+20>>2]|0;if(l|0){c[x+20>>2]=l;c[l+24>>2]=x}}while(0);if(n>>>0<16){s=n+e|0;c[h+4>>2]=s|3;f=h+s+4|0;c[f>>2]=c[f>>2]|1}else{c[h+4>>2]=e|3;c[i+4>>2]=n|1;c[i+n>>2]=n;if(m|0){f=c[2517]|0;s=m>>>3;l=10088+(s<<1<<2)|0;u=1<<s;if(!(u&g)){c[2512]=u|g;E=l;F=l+8|0}else{u=l+8|0;E=c[u>>2]|0;F=u}c[F>>2]=f;c[E+12>>2]=f;c[f+8>>2]=E;c[f+12>>2]=l}c[2514]=n;c[2517]=i}o=h+8|0;Aa=b;return o|0}else G=e}else G=e}else G=e}else if(a>>>0<=4294967231){l=a+11|0;f=l&-8;u=c[2513]|0;if(u){s=0-f|0;v=l>>>8;if(v)if(f>>>0>16777215)H=31;else{l=(v+1048320|0)>>>16&8;A=v<<l;v=(A+520192|0)>>>16&4;B=A<<v;A=(B+245760|0)>>>16&2;I=14-(v|l|A)+(B<<A>>>15)|0;H=f>>>(I+7|0)&1|I<<1}else H=0;I=c[10352+(H<<2)>>2]|0;a:do if(!I){J=0;K=0;L=s;M=61}else{A=0;B=s;l=I;v=f<<((H|0)==31?0:25-(H>>>1)|0);N=0;while(1){O=(c[l+4>>2]&-8)-f|0;if(O>>>0<B>>>0)if(!O){P=l;Q=0;R=l;M=65;break a}else{S=l;T=O}else{S=A;T=B}O=c[l+20>>2]|0;l=c[l+16+(v>>>31<<2)>>2]|0;U=(O|0)==0|(O|0)==(l|0)?N:O;if(!l){J=U;K=S;L=T;M=61;break}else{A=S;B=T;v=v<<1;N=U}}}while(0);if((M|0)==61){if((J|0)==0&(K|0)==0){I=2<<H;s=(I|0-I)&u;if(!s){G=f;break}I=(s&0-s)+-1|0;s=I>>>12&16;e=I>>>s;I=e>>>5&8;h=e>>>I;e=h>>>2&4;i=h>>>e;h=i>>>1&2;n=i>>>h;i=n>>>1&1;V=0;W=c[10352+((I|s|e|h|i)+(n>>>i)<<2)>>2]|0}else{V=K;W=J}if(!W){X=V;Y=L}else{P=V;Q=L;R=W;M=65}}if((M|0)==65){i=P;n=Q;h=R;while(1){e=(c[h+4>>2]&-8)-f|0;s=e>>>0<n>>>0;I=s?e:n;e=s?h:i;s=c[h+16>>2]|0;if(!s)Z=c[h+20>>2]|0;else Z=s;if(!Z){X=e;Y=I;break}else{i=e;n=I;h=Z}}}if(((X|0)!=0?Y>>>0<((c[2514]|0)-f|0)>>>0:0)?(h=X+f|0,h>>>0>X>>>0):0){n=c[X+24>>2]|0;i=c[X+12>>2]|0;do if((i|0)==(X|0)){I=X+20|0;e=c[I>>2]|0;if(!e){s=X+16|0;g=c[s>>2]|0;if(!g){_=0;break}else{$=g;aa=s}}else{$=e;aa=I}I=$;e=aa;while(1){s=I+20|0;g=c[s>>2]|0;if(!g){m=I+16|0;N=c[m>>2]|0;if(!N)break;else{ba=N;ca=m}}else{ba=g;ca=s}I=ba;e=ca}c[e>>2]=0;_=I}else{s=c[X+8>>2]|0;c[s+12>>2]=i;c[i+8>>2]=s;_=i}while(0);do if(n){i=c[X+28>>2]|0;s=10352+(i<<2)|0;if((X|0)==(c[s>>2]|0)){c[s>>2]=_;if(!_){s=u&~(1<<i);c[2513]=s;da=s;break}}else{s=n+16|0;c[((c[s>>2]|0)==(X|0)?s:n+20|0)>>2]=_;if(!_){da=u;break}}c[_+24>>2]=n;s=c[X+16>>2]|0;if(s|0){c[_+16>>2]=s;c[s+24>>2]=_}s=c[X+20>>2]|0;if(s){c[_+20>>2]=s;c[s+24>>2]=_;da=u}else da=u}else da=u;while(0);b:do if(Y>>>0<16){u=Y+f|0;c[X+4>>2]=u|3;n=X+u+4|0;c[n>>2]=c[n>>2]|1}else{c[X+4>>2]=f|3;c[h+4>>2]=Y|1;c[h+Y>>2]=Y;n=Y>>>3;if(Y>>>0<256){u=10088+(n<<1<<2)|0;s=c[2512]|0;i=1<<n;if(!(s&i)){c[2512]=s|i;ea=u;fa=u+8|0}else{i=u+8|0;ea=c[i>>2]|0;fa=i}c[fa>>2]=h;c[ea+12>>2]=h;c[h+8>>2]=ea;c[h+12>>2]=u;break}u=Y>>>8;if(u)if(Y>>>0>16777215)ga=31;else{i=(u+1048320|0)>>>16&8;s=u<<i;u=(s+520192|0)>>>16&4;n=s<<u;s=(n+245760|0)>>>16&2;g=14-(u|i|s)+(n<<s>>>15)|0;ga=Y>>>(g+7|0)&1|g<<1}else ga=0;g=10352+(ga<<2)|0;c[h+28>>2]=ga;s=h+16|0;c[s+4>>2]=0;c[s>>2]=0;s=1<<ga;if(!(da&s)){c[2513]=da|s;c[g>>2]=h;c[h+24>>2]=g;c[h+12>>2]=h;c[h+8>>2]=h;break}s=c[g>>2]|0;c:do if((c[s+4>>2]&-8|0)==(Y|0))ha=s;else{g=Y<<((ga|0)==31?0:25-(ga>>>1)|0);n=s;while(1){ia=n+16+(g>>>31<<2)|0;i=c[ia>>2]|0;if(!i)break;if((c[i+4>>2]&-8|0)==(Y|0)){ha=i;break c}else{g=g<<1;n=i}}c[ia>>2]=h;c[h+24>>2]=n;c[h+12>>2]=h;c[h+8>>2]=h;break b}while(0);s=ha+8|0;I=c[s>>2]|0;c[I+12>>2]=h;c[s>>2]=h;c[h+8>>2]=I;c[h+12>>2]=ha;c[h+24>>2]=0}while(0);o=X+8|0;Aa=b;return o|0}else G=f}else G=f}else G=-1;while(0);X=c[2514]|0;if(X>>>0>=G>>>0){ha=X-G|0;ia=c[2517]|0;if(ha>>>0>15){Y=ia+G|0;c[2517]=Y;c[2514]=ha;c[Y+4>>2]=ha|1;c[ia+X>>2]=ha;c[ia+4>>2]=G|3}else{c[2514]=0;c[2517]=0;c[ia+4>>2]=X|3;ha=ia+X+4|0;c[ha>>2]=c[ha>>2]|1}o=ia+8|0;Aa=b;return o|0}ia=c[2515]|0;if(ia>>>0>G>>>0){ha=ia-G|0;c[2515]=ha;X=c[2518]|0;Y=X+G|0;c[2518]=Y;c[Y+4>>2]=ha|1;c[X+4>>2]=G|3;o=X+8|0;Aa=b;return o|0}if(!(c[2630]|0)){c[2632]=4096;c[2631]=4096;c[2633]=-1;c[2634]=-1;c[2635]=0;c[2623]=0;c[2630]=d&-16^1431655768;ja=4096}else ja=c[2632]|0;d=G+48|0;X=G+47|0;ha=ja+X|0;Y=0-ja|0;ja=ha&Y;if(ja>>>0<=G>>>0){o=0;Aa=b;return o|0}ga=c[2622]|0;if(ga|0?(da=c[2620]|0,ea=da+ja|0,ea>>>0<=da>>>0|ea>>>0>ga>>>0):0){o=0;Aa=b;return o|0}d:do if(!(c[2623]&4)){ga=c[2518]|0;e:do if(ga){ea=10496;while(1){da=c[ea>>2]|0;if(da>>>0<=ga>>>0?(da+(c[ea+4>>2]|0)|0)>>>0>ga>>>0:0)break;da=c[ea+8>>2]|0;if(!da){M=128;break e}else ea=da}da=ha-ia&Y;if(da>>>0<2147483647){fa=lf(da|0)|0;if((fa|0)==((c[ea>>2]|0)+(c[ea+4>>2]|0)|0))if((fa|0)==(-1|0))ka=da;else{la=da;ma=fa;M=145;break d}else{na=fa;oa=da;M=136}}else ka=0}else M=128;while(0);do if((M|0)==128){ga=lf(0)|0;if((ga|0)!=(-1|0)?(f=ga,da=c[2631]|0,fa=da+-1|0,_=((fa&f|0)==0?0:(fa+f&0-da)-f|0)+ja|0,f=c[2620]|0,da=_+f|0,_>>>0>G>>>0&_>>>0<2147483647):0){fa=c[2622]|0;if(fa|0?da>>>0<=f>>>0|da>>>0>fa>>>0:0){ka=0;break}fa=lf(_|0)|0;if((fa|0)==(ga|0)){la=_;ma=ga;M=145;break d}else{na=fa;oa=_;M=136}}else ka=0}while(0);do if((M|0)==136){_=0-oa|0;if(!(d>>>0>oa>>>0&(oa>>>0<2147483647&(na|0)!=(-1|0))))if((na|0)==(-1|0)){ka=0;break}else{la=oa;ma=na;M=145;break d}fa=c[2632]|0;ga=X-oa+fa&0-fa;if(ga>>>0>=2147483647){la=oa;ma=na;M=145;break d}if((lf(ga|0)|0)==(-1|0)){lf(_|0)|0;ka=0;break}else{la=ga+oa|0;ma=na;M=145;break d}}while(0);c[2623]=c[2623]|4;pa=ka;M=143}else{pa=0;M=143}while(0);if(((M|0)==143?ja>>>0<2147483647:0)?(ka=lf(ja|0)|0,ja=lf(0)|0,na=ja-ka|0,oa=na>>>0>(G+40|0)>>>0,!((ka|0)==(-1|0)|oa^1|ka>>>0<ja>>>0&((ka|0)!=(-1|0)&(ja|0)!=(-1|0))^1)):0){la=oa?na:pa;ma=ka;M=145}if((M|0)==145){ka=(c[2620]|0)+la|0;c[2620]=ka;if(ka>>>0>(c[2621]|0)>>>0)c[2621]=ka;ka=c[2518]|0;f:do if(ka){pa=10496;while(1){qa=c[pa>>2]|0;ra=c[pa+4>>2]|0;if((ma|0)==(qa+ra|0)){M=154;break}na=c[pa+8>>2]|0;if(!na)break;else pa=na}if(((M|0)==154?(na=pa+4|0,(c[pa+12>>2]&8|0)==0):0)?ma>>>0>ka>>>0&qa>>>0<=ka>>>0:0){c[na>>2]=ra+la;na=(c[2515]|0)+la|0;oa=ka+8|0;ja=(oa&7|0)==0?0:0-oa&7;oa=ka+ja|0;X=na-ja|0;c[2518]=oa;c[2515]=X;c[oa+4>>2]=X|1;c[ka+na+4>>2]=40;c[2519]=c[2634];break}if(ma>>>0<(c[2516]|0)>>>0)c[2516]=ma;na=ma+la|0;X=10496;while(1){if((c[X>>2]|0)==(na|0)){M=162;break}oa=c[X+8>>2]|0;if(!oa)break;else X=oa}if((M|0)==162?(c[X+12>>2]&8|0)==0:0){c[X>>2]=ma;pa=X+4|0;c[pa>>2]=(c[pa>>2]|0)+la;pa=ma+8|0;oa=ma+((pa&7|0)==0?0:0-pa&7)|0;pa=na+8|0;ja=na+((pa&7|0)==0?0:0-pa&7)|0;pa=oa+G|0;d=ja-oa-G|0;c[oa+4>>2]=G|3;g:do if((ka|0)==(ja|0)){Y=(c[2515]|0)+d|0;c[2515]=Y;c[2518]=pa;c[pa+4>>2]=Y|1}else{if((c[2517]|0)==(ja|0)){Y=(c[2514]|0)+d|0;c[2514]=Y;c[2517]=pa;c[pa+4>>2]=Y|1;c[pa+Y>>2]=Y;break}Y=c[ja+4>>2]|0;if((Y&3|0)==1){ia=Y&-8;ha=Y>>>3;h:do if(Y>>>0<256){ga=c[ja+8>>2]|0;_=c[ja+12>>2]|0;if((_|0)==(ga|0)){c[2512]=c[2512]&~(1<<ha);break}else{c[ga+12>>2]=_;c[_+8>>2]=ga;break}}else{ga=c[ja+24>>2]|0;_=c[ja+12>>2]|0;do if((_|0)==(ja|0)){fa=ja+16|0;da=fa+4|0;f=c[da>>2]|0;if(!f){ca=c[fa>>2]|0;if(!ca){sa=0;break}else{ta=ca;ua=fa}}else{ta=f;ua=da}da=ta;f=ua;while(1){fa=da+20|0;ca=c[fa>>2]|0;if(!ca){ba=da+16|0;aa=c[ba>>2]|0;if(!aa)break;else{va=aa;wa=ba}}else{va=ca;wa=fa}da=va;f=wa}c[f>>2]=0;sa=da}else{fa=c[ja+8>>2]|0;c[fa+12>>2]=_;c[_+8>>2]=fa;sa=_}while(0);if(!ga)break;_=c[ja+28>>2]|0;n=10352+(_<<2)|0;do if((c[n>>2]|0)!=(ja|0)){fa=ga+16|0;c[((c[fa>>2]|0)==(ja|0)?fa:ga+20|0)>>2]=sa;if(!sa)break h}else{c[n>>2]=sa;if(sa|0)break;c[2513]=c[2513]&~(1<<_);break h}while(0);c[sa+24>>2]=ga;_=ja+16|0;n=c[_>>2]|0;if(n|0){c[sa+16>>2]=n;c[n+24>>2]=sa}n=c[_+4>>2]|0;if(!n)break;c[sa+20>>2]=n;c[n+24>>2]=sa}while(0);xa=ja+ia|0;ya=ia+d|0}else{xa=ja;ya=d}ha=xa+4|0;c[ha>>2]=c[ha>>2]&-2;c[pa+4>>2]=ya|1;c[pa+ya>>2]=ya;ha=ya>>>3;if(ya>>>0<256){Y=10088+(ha<<1<<2)|0;ea=c[2512]|0;n=1<<ha;if(!(ea&n)){c[2512]=ea|n;za=Y;Ca=Y+8|0}else{n=Y+8|0;za=c[n>>2]|0;Ca=n}c[Ca>>2]=pa;c[za+12>>2]=pa;c[pa+8>>2]=za;c[pa+12>>2]=Y;break}Y=ya>>>8;do if(!Y)Da=0;else{if(ya>>>0>16777215){Da=31;break}n=(Y+1048320|0)>>>16&8;ea=Y<<n;ha=(ea+520192|0)>>>16&4;_=ea<<ha;ea=(_+245760|0)>>>16&2;fa=14-(ha|n|ea)+(_<<ea>>>15)|0;Da=ya>>>(fa+7|0)&1|fa<<1}while(0);Y=10352+(Da<<2)|0;c[pa+28>>2]=Da;ia=pa+16|0;c[ia+4>>2]=0;c[ia>>2]=0;ia=c[2513]|0;fa=1<<Da;if(!(ia&fa)){c[2513]=ia|fa;c[Y>>2]=pa;c[pa+24>>2]=Y;c[pa+12>>2]=pa;c[pa+8>>2]=pa;break}fa=c[Y>>2]|0;i:do if((c[fa+4>>2]&-8|0)==(ya|0))Ea=fa;else{Y=ya<<((Da|0)==31?0:25-(Da>>>1)|0);ia=fa;while(1){Fa=ia+16+(Y>>>31<<2)|0;ea=c[Fa>>2]|0;if(!ea)break;if((c[ea+4>>2]&-8|0)==(ya|0)){Ea=ea;break i}else{Y=Y<<1;ia=ea}}c[Fa>>2]=pa;c[pa+24>>2]=ia;c[pa+12>>2]=pa;c[pa+8>>2]=pa;break g}while(0);fa=Ea+8|0;Y=c[fa>>2]|0;c[Y+12>>2]=pa;c[fa>>2]=pa;c[pa+8>>2]=Y;c[pa+12>>2]=Ea;c[pa+24>>2]=0}while(0);o=oa+8|0;Aa=b;return o|0}pa=10496;while(1){d=c[pa>>2]|0;if(d>>>0<=ka>>>0?(Ga=d+(c[pa+4>>2]|0)|0,Ga>>>0>ka>>>0):0)break;pa=c[pa+8>>2]|0}pa=Ga+-47|0;oa=pa+8|0;d=pa+((oa&7|0)==0?0:0-oa&7)|0;oa=ka+16|0;pa=d>>>0<oa>>>0?ka:d;d=pa+8|0;ja=la+-40|0;na=ma+8|0;X=(na&7|0)==0?0:0-na&7;na=ma+X|0;Y=ja-X|0;c[2518]=na;c[2515]=Y;c[na+4>>2]=Y|1;c[ma+ja+4>>2]=40;c[2519]=c[2634];ja=pa+4|0;c[ja>>2]=27;c[d>>2]=c[2624];c[d+4>>2]=c[2625];c[d+8>>2]=c[2626];c[d+12>>2]=c[2627];c[2624]=ma;c[2625]=la;c[2627]=0;c[2626]=d;d=pa+24|0;do{Y=d;d=d+4|0;c[d>>2]=7}while((Y+8|0)>>>0<Ga>>>0);if((pa|0)!=(ka|0)){d=pa-ka|0;c[ja>>2]=c[ja>>2]&-2;c[ka+4>>2]=d|1;c[pa>>2]=d;Y=d>>>3;if(d>>>0<256){na=10088+(Y<<1<<2)|0;X=c[2512]|0;fa=1<<Y;if(!(X&fa)){c[2512]=X|fa;Ha=na;Ia=na+8|0}else{fa=na+8|0;Ha=c[fa>>2]|0;Ia=fa}c[Ia>>2]=ka;c[Ha+12>>2]=ka;c[ka+8>>2]=Ha;c[ka+12>>2]=na;break}na=d>>>8;if(na)if(d>>>0>16777215)Ja=31;else{fa=(na+1048320|0)>>>16&8;X=na<<fa;na=(X+520192|0)>>>16&4;Y=X<<na;X=(Y+245760|0)>>>16&2;ga=14-(na|fa|X)+(Y<<X>>>15)|0;Ja=d>>>(ga+7|0)&1|ga<<1}else Ja=0;ga=10352+(Ja<<2)|0;c[ka+28>>2]=Ja;c[ka+20>>2]=0;c[oa>>2]=0;X=c[2513]|0;Y=1<<Ja;if(!(X&Y)){c[2513]=X|Y;c[ga>>2]=ka;c[ka+24>>2]=ga;c[ka+12>>2]=ka;c[ka+8>>2]=ka;break}Y=c[ga>>2]|0;j:do if((c[Y+4>>2]&-8|0)==(d|0))Ka=Y;else{ga=d<<((Ja|0)==31?0:25-(Ja>>>1)|0);X=Y;while(1){La=X+16+(ga>>>31<<2)|0;fa=c[La>>2]|0;if(!fa)break;if((c[fa+4>>2]&-8|0)==(d|0)){Ka=fa;break j}else{ga=ga<<1;X=fa}}c[La>>2]=ka;c[ka+24>>2]=X;c[ka+12>>2]=ka;c[ka+8>>2]=ka;break f}while(0);d=Ka+8|0;Y=c[d>>2]|0;c[Y+12>>2]=ka;c[d>>2]=ka;c[ka+8>>2]=Y;c[ka+12>>2]=Ka;c[ka+24>>2]=0}}else{Y=c[2516]|0;if((Y|0)==0|ma>>>0<Y>>>0)c[2516]=ma;c[2624]=ma;c[2625]=la;c[2627]=0;c[2521]=c[2630];c[2520]=-1;c[2525]=10088;c[2524]=10088;c[2527]=10096;c[2526]=10096;c[2529]=10104;c[2528]=10104;c[2531]=10112;c[2530]=10112;c[2533]=10120;c[2532]=10120;c[2535]=10128;c[2534]=10128;c[2537]=10136;c[2536]=10136;c[2539]=10144;c[2538]=10144;c[2541]=10152;c[2540]=10152;c[2543]=10160;c[2542]=10160;c[2545]=10168;c[2544]=10168;c[2547]=10176;c[2546]=10176;c[2549]=10184;c[2548]=10184;c[2551]=10192;c[2550]=10192;c[2553]=10200;c[2552]=10200;c[2555]=10208;c[2554]=10208;c[2557]=10216;c[2556]=10216;c[2559]=10224;c[2558]=10224;c[2561]=10232;c[2560]=10232;c[2563]=10240;c[2562]=10240;c[2565]=10248;c[2564]=10248;c[2567]=10256;c[2566]=10256;c[2569]=10264;c[2568]=10264;c[2571]=10272;c[2570]=10272;c[2573]=10280;c[2572]=10280;c[2575]=10288;c[2574]=10288;c[2577]=10296;c[2576]=10296;c[2579]=10304;c[2578]=10304;c[2581]=10312;c[2580]=10312;c[2583]=10320;c[2582]=10320;c[2585]=10328;c[2584]=10328;c[2587]=10336;c[2586]=10336;Y=la+-40|0;d=ma+8|0;oa=(d&7|0)==0?0:0-d&7;d=ma+oa|0;pa=Y-oa|0;c[2518]=d;c[2515]=pa;c[d+4>>2]=pa|1;c[ma+Y+4>>2]=40;c[2519]=c[2634]}while(0);ma=c[2515]|0;if(ma>>>0>G>>>0){la=ma-G|0;c[2515]=la;ma=c[2518]|0;ka=ma+G|0;c[2518]=ka;c[ka+4>>2]=la|1;c[ma+4>>2]=G|3;o=ma+8|0;Aa=b;return o|0}}c[(Rc()|0)>>2]=12;o=0;Aa=b;return o|0}function Ld(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0;if(!a)return;b=a+-8|0;d=c[2516]|0;e=c[a+-4>>2]|0;a=e&-8;f=b+a|0;do if(!(e&1)){g=c[b>>2]|0;if(!(e&3))return;h=b+(0-g)|0;i=g+a|0;if(h>>>0<d>>>0)return;if((c[2517]|0)==(h|0)){j=f+4|0;k=c[j>>2]|0;if((k&3|0)!=3){l=h;m=i;n=h;break}c[2514]=i;c[j>>2]=k&-2;c[h+4>>2]=i|1;c[h+i>>2]=i;return}k=g>>>3;if(g>>>0<256){g=c[h+8>>2]|0;j=c[h+12>>2]|0;if((j|0)==(g|0)){c[2512]=c[2512]&~(1<<k);l=h;m=i;n=h;break}else{c[g+12>>2]=j;c[j+8>>2]=g;l=h;m=i;n=h;break}}g=c[h+24>>2]|0;j=c[h+12>>2]|0;do if((j|0)==(h|0)){k=h+16|0;o=k+4|0;p=c[o>>2]|0;if(!p){q=c[k>>2]|0;if(!q){r=0;break}else{s=q;t=k}}else{s=p;t=o}o=s;p=t;while(1){k=o+20|0;q=c[k>>2]|0;if(!q){u=o+16|0;v=c[u>>2]|0;if(!v)break;else{w=v;x=u}}else{w=q;x=k}o=w;p=x}c[p>>2]=0;r=o}else{k=c[h+8>>2]|0;c[k+12>>2]=j;c[j+8>>2]=k;r=j}while(0);if(g){j=c[h+28>>2]|0;k=10352+(j<<2)|0;if((c[k>>2]|0)==(h|0)){c[k>>2]=r;if(!r){c[2513]=c[2513]&~(1<<j);l=h;m=i;n=h;break}}else{j=g+16|0;c[((c[j>>2]|0)==(h|0)?j:g+20|0)>>2]=r;if(!r){l=h;m=i;n=h;break}}c[r+24>>2]=g;j=h+16|0;k=c[j>>2]|0;if(k|0){c[r+16>>2]=k;c[k+24>>2]=r}k=c[j+4>>2]|0;if(k){c[r+20>>2]=k;c[k+24>>2]=r;l=h;m=i;n=h}else{l=h;m=i;n=h}}else{l=h;m=i;n=h}}else{l=b;m=a;n=b}while(0);if(n>>>0>=f>>>0)return;b=f+4|0;a=c[b>>2]|0;if(!(a&1))return;if(!(a&2)){if((c[2518]|0)==(f|0)){r=(c[2515]|0)+m|0;c[2515]=r;c[2518]=l;c[l+4>>2]=r|1;if((l|0)!=(c[2517]|0))return;c[2517]=0;c[2514]=0;return}if((c[2517]|0)==(f|0)){r=(c[2514]|0)+m|0;c[2514]=r;c[2517]=n;c[l+4>>2]=r|1;c[n+r>>2]=r;return}r=(a&-8)+m|0;x=a>>>3;do if(a>>>0<256){w=c[f+8>>2]|0;t=c[f+12>>2]|0;if((t|0)==(w|0)){c[2512]=c[2512]&~(1<<x);break}else{c[w+12>>2]=t;c[t+8>>2]=w;break}}else{w=c[f+24>>2]|0;t=c[f+12>>2]|0;do if((t|0)==(f|0)){s=f+16|0;d=s+4|0;e=c[d>>2]|0;if(!e){k=c[s>>2]|0;if(!k){y=0;break}else{z=k;A=s}}else{z=e;A=d}d=z;e=A;while(1){s=d+20|0;k=c[s>>2]|0;if(!k){j=d+16|0;q=c[j>>2]|0;if(!q)break;else{B=q;C=j}}else{B=k;C=s}d=B;e=C}c[e>>2]=0;y=d}else{o=c[f+8>>2]|0;c[o+12>>2]=t;c[t+8>>2]=o;y=t}while(0);if(w|0){t=c[f+28>>2]|0;h=10352+(t<<2)|0;if((c[h>>2]|0)==(f|0)){c[h>>2]=y;if(!y){c[2513]=c[2513]&~(1<<t);break}}else{t=w+16|0;c[((c[t>>2]|0)==(f|0)?t:w+20|0)>>2]=y;if(!y)break}c[y+24>>2]=w;t=f+16|0;h=c[t>>2]|0;if(h|0){c[y+16>>2]=h;c[h+24>>2]=y}h=c[t+4>>2]|0;if(h|0){c[y+20>>2]=h;c[h+24>>2]=y}}}while(0);c[l+4>>2]=r|1;c[n+r>>2]=r;if((l|0)==(c[2517]|0)){c[2514]=r;return}else D=r}else{c[b>>2]=a&-2;c[l+4>>2]=m|1;c[n+m>>2]=m;D=m}m=D>>>3;if(D>>>0<256){n=10088+(m<<1<<2)|0;a=c[2512]|0;b=1<<m;if(!(a&b)){c[2512]=a|b;E=n;F=n+8|0}else{b=n+8|0;E=c[b>>2]|0;F=b}c[F>>2]=l;c[E+12>>2]=l;c[l+8>>2]=E;c[l+12>>2]=n;return}n=D>>>8;if(n)if(D>>>0>16777215)G=31;else{E=(n+1048320|0)>>>16&8;F=n<<E;n=(F+520192|0)>>>16&4;b=F<<n;F=(b+245760|0)>>>16&2;a=14-(n|E|F)+(b<<F>>>15)|0;G=D>>>(a+7|0)&1|a<<1}else G=0;a=10352+(G<<2)|0;c[l+28>>2]=G;c[l+20>>2]=0;c[l+16>>2]=0;F=c[2513]|0;b=1<<G;a:do if(!(F&b)){c[2513]=F|b;c[a>>2]=l;c[l+24>>2]=a;c[l+12>>2]=l;c[l+8>>2]=l}else{E=c[a>>2]|0;b:do if((c[E+4>>2]&-8|0)==(D|0))H=E;else{n=D<<((G|0)==31?0:25-(G>>>1)|0);m=E;while(1){I=m+16+(n>>>31<<2)|0;r=c[I>>2]|0;if(!r)break;if((c[r+4>>2]&-8|0)==(D|0)){H=r;break b}else{n=n<<1;m=r}}c[I>>2]=l;c[l+24>>2]=m;c[l+12>>2]=l;c[l+8>>2]=l;break a}while(0);E=H+8|0;w=c[E>>2]|0;c[w+12>>2]=l;c[E>>2]=l;c[l+8>>2]=w;c[l+12>>2]=H;c[l+24>>2]=0}while(0);l=(c[2520]|0)+-1|0;c[2520]=l;if(l|0)return;l=10504;while(1){H=c[l>>2]|0;if(!H)break;else l=H+8|0}c[2520]=-1;return}function Md(a){a=a|0;return}function Nd(a){a=a|0;Md(a);Sd(a);return}function Od(a){a=a|0;return 5557}function Pd(a){a=a|0;return}function Qd(a){a=a|0;var b=0,d=0;b=a+8|0;if(!((c[b>>2]|0)!=0?(d=c[b>>2]|0,c[b>>2]=d+-1,(d|0)!=0):0))Ha[c[(c[a>>2]|0)+16>>2]&63](a);return}function Rd(a){a=a|0;var b=0,c=0;b=(a|0)==0?1:a;while(1){a=Kd(b)|0;if(a|0){c=a;break}a=We()|0;if(!a){c=0;break}Ga[a&3]()}return c|0}function Sd(a){a=a|0;Ld(a);return}function Td(b,d){b=b|0;d=d|0;var e=0,f=0,g=0;e=Aa;Aa=Aa+16|0;if((Aa|0)>=(Ba|0))w(16);f=e;g=Fd((a[d+11>>0]|0)<0?c[d>>2]|0:d,0,f)|0;c[b>>2]=g;if((g|0)<0){g=c[(Rc()|0)>>2]|0;ee(f,5663,d);fe(g,(a[f+11>>0]|0)<0?c[f>>2]|0:f)}else{Aa=e;return}}function Ud(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0;b=Aa;Aa=Aa+16|0;if((Aa|0)>=(Ba|0))w(16);d=b;e=4;f=d;a:while(1){if(!e){g=9;break}b:while(1){h=Gd(c[a>>2]|0,f,e)|0;switch(h|0){case 0:{g=5;break a;break}case -1:break;default:break b}if((c[(Rc()|0)>>2]|0)!=4){g=7;break a}}e=e-h|0;f=f+h|0}if((g|0)==5)fe(61,5693);else if((g|0)==7)fe(c[(Rc()|0)>>2]|0,5715);else if((g|0)==9){Aa=b;return c[d>>2]|0}return 0}function Vd(a,b){a=a|0;b=b|0;var d=0,e=0,f=0;d=Xc(b)|0;e=Rd(d+13|0)|0;c[e>>2]=d;c[e+4>>2]=d;c[e+8>>2]=0;f=Wd(e)|0;hf(f|0,b|0,d+1|0)|0;c[a>>2]=f;return}function Wd(a){a=a|0;return a+12|0}function Xd(a,b){a=a|0;b=b|0;c[a>>2]=3792;Vd(a+4|0,b);return}function Yd(a){a=a|0;return 1}function Zd(a){a=a|0;ma()}function _d(a,b,c){a=a|0;b=b|0;c=c|0;if(c|0)hf(a|0,b|0,c|0)|0;return a|0}function $d(b,c){b=b|0;c=c|0;a[b>>0]=a[c>>0]|0;return}function ae(a){a=a|0;return Xc(a)|0}function be(b,d,e,f,g,h,i,j){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;h=h|0;i=i|0;j=j|0;var k=0,l=0,m=0,n=0,o=0,p=0;k=Aa;Aa=Aa+16|0;if((Aa|0)>=(Ba|0))w(16);l=k;if((-18-d|0)>>>0<e>>>0)Zd(b);if((a[b+11>>0]|0)<0)m=c[b>>2]|0;else m=b;if(d>>>0<2147483623){n=e+d|0;e=d<<1;o=n>>>0<e>>>0?e:n;p=o>>>0<11?11:o+16&-16}else p=-17;o=Rd(p)|0;if(g|0)_d(o,m,g)|0;if(i|0)_d(o+g|0,j,i)|0;j=f-h|0;f=j-g|0;if(f|0)_d(o+g+i|0,m+g+h|0,f)|0;if((d|0)!=10)Sd(m);c[b>>2]=o;c[b+8>>2]=p|-2147483648;p=j+i|0;c[b+4>>2]=p;a[l>>0]=0;$d(o+p|0,l);Aa=k;return}function ce(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;f=Aa;Aa=Aa+16|0;if((Aa|0)>=(Ba|0))w(16);g=f;h=b+11|0;i=a[h>>0]|0;j=i<<24>>24<0;if(j){k=(c[b+8>>2]&2147483647)+-1|0;l=c[b+4>>2]|0}else{k=10;l=i&255}if((k-l|0)>>>0>=e>>>0){if(e|0){if(j)m=c[b>>2]|0;else m=b;_d(m+l|0,d,e)|0;j=l+e|0;if((a[h>>0]|0)<0)c[b+4>>2]=j;else a[h>>0]=j;a[g>>0]=0;$d(m+j|0,g)}}else be(b,k,l+e-k|0,l,l,0,e,d);Aa=f;return b|0}function de(b,d,e,f){b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0,j=0;g=Aa;Aa=Aa+16|0;if((Aa|0)>=(Ba|0))w(16);h=g;if(f>>>0>4294967279)Zd(b);if(f>>>0<11){a[b+11>>0]=e;i=b}else{j=f+16&-16;f=Rd(j)|0;c[b>>2]=f;c[b+8>>2]=j|-2147483648;c[b+4>>2]=e;i=f}_d(i,d,e)|0;a[h>>0]=0;$d(i+e|0,h);Aa=g;return}function ee(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0;c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;f=0;while(1){if((f|0)==3)break;c[b+(f<<2)>>2]=0;f=f+1|0}f=ae(d)|0;g=e+11|0;h=a[g>>0]|0;i=h<<24>>24<0?c[e+4>>2]|0:h&255;de(b,d,f,i+f|0);ce(b,(a[g>>0]|0)<0?c[e>>2]|0:e,i)|0;return}function fe(a,b){a=a|0;b=b|0;ma()}function ge(a){a=a|0;ma()}function he(){var a=0,b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0;a=Aa;Aa=Aa+48|0;if((Aa|0)>=(Ba|0))w(48);b=a+32|0;d=a+24|0;e=a+16|0;f=a;g=a+36|0;a=ie()|0;if(a|0?(h=c[a>>2]|0,h|0):0){a=h+48|0;i=c[a>>2]|0;j=c[a+4>>2]|0;if(!((i&-256|0)==1126902528&(j|0)==1129074247)){c[d>>2]=5889;je(5839,d)}if((i|0)==1126902529&(j|0)==1129074247)k=c[h+44>>2]|0;else k=h+80|0;c[g>>2]=k;k=c[h>>2]|0;h=c[k+4>>2]|0;if(Fa[c[(c[672]|0)+16>>2]&7](2688,k,g)|0){k=c[g>>2]|0;g=Da[c[(c[k>>2]|0)+8>>2]&15](k)|0;c[f>>2]=5889;c[f+4>>2]=h;c[f+8>>2]=g;je(5753,f)}else{c[e>>2]=5889;c[e+4>>2]=h;je(5798,e)}}je(5877,b)}function ie(){var a=0,b=0;a=Aa;Aa=Aa+16|0;if((Aa|0)>=(Ba|0))w(16);if(!(xa(10544,3)|0)){b=va(c[2637]|0)|0;Aa=a;return b|0}else je(6028,a);return 0}function je(a,b){a=a|0;b=b|0;var d=0,e=0;d=Aa;Aa=Aa+16|0;if((Aa|0)>=(Ba|0))w(16);e=d;c[e>>2]=b;b=c[794]|0;ld(b,a,e)|0;Id(10,b)|0;ma()}function ke(a){a=a|0;return}function le(a){a=a|0;ke(a);Sd(a);return}function me(a){a=a|0;return}function ne(a){a=a|0;return}function oe(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0;e=Aa;Aa=Aa+64|0;if((Aa|0)>=(Ba|0))w(64);f=e;if(!(se(a,b,0)|0))if((b|0)!=0?(g=we(b,2712,2696,0)|0,(g|0)!=0):0){b=f+4|0;h=b+52|0;do{c[b>>2]=0;b=b+4|0}while((b|0)<(h|0));c[f>>2]=g;c[f+8>>2]=a;c[f+12>>2]=-1;c[f+48>>2]=1;Ma[c[(c[g>>2]|0)+28>>2]&15](g,f,c[d>>2]|0,1);if((c[f+24>>2]|0)==1){c[d>>2]=c[f+16>>2];i=1}else i=0;j=i}else j=0;else j=1;Aa=e;return j|0}function pe(a,b,d,e,f,g){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;if(se(a,c[b+8>>2]|0,g)|0)ve(0,b,d,e,f);return}function qe(b,d,e,f,g){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0;do if(!(se(b,c[d+8>>2]|0,g)|0)){if(se(b,c[d>>2]|0,g)|0){if((c[d+16>>2]|0)!=(e|0)?(h=d+20|0,(c[h>>2]|0)!=(e|0)):0){c[d+32>>2]=f;c[h>>2]=e;h=d+40|0;c[h>>2]=(c[h>>2]|0)+1;if((c[d+36>>2]|0)==1?(c[d+24>>2]|0)==2:0)a[d+54>>0]=1;c[d+44>>2]=4;break}if((f|0)==1)c[d+32>>2]=1}}else ue(0,d,e,f);while(0);return}function re(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;if(se(a,c[b+8>>2]|0,0)|0)te(0,b,d,e);return}function se(a,b,c){a=a|0;b=b|0;c=c|0;return (a|0)==(b|0)|0}function te(b,d,e,f){b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0;b=d+16|0;g=c[b>>2]|0;do if(g){if((g|0)!=(e|0)){h=d+36|0;c[h>>2]=(c[h>>2]|0)+1;c[d+24>>2]=2;a[d+54>>0]=1;break}h=d+24|0;if((c[h>>2]|0)==2)c[h>>2]=f}else{c[b>>2]=e;c[d+24>>2]=f;c[d+36>>2]=1}while(0);return}function ue(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;if((c[b+4>>2]|0)==(d|0)?(d=b+28|0,(c[d>>2]|0)!=1):0)c[d>>2]=e;return}function ve(b,d,e,f,g){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0;a[d+53>>0]=1;do if((c[d+4>>2]|0)==(f|0)){a[d+52>>0]=1;b=d+16|0;h=c[b>>2]|0;if(!h){c[b>>2]=e;c[d+24>>2]=g;c[d+36>>2]=1;if(!((g|0)==1?(c[d+48>>2]|0)==1:0))break;a[d+54>>0]=1;break}if((h|0)!=(e|0)){h=d+36|0;c[h>>2]=(c[h>>2]|0)+1;a[d+54>>0]=1;break}h=d+24|0;b=c[h>>2]|0;if((b|0)==2){c[h>>2]=g;i=g}else i=b;if((i|0)==1?(c[d+48>>2]|0)==1:0)a[d+54>>0]=1}while(0);return}function we(d,e,f,g){d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0;h=Aa;Aa=Aa+64|0;if((Aa|0)>=(Ba|0))w(64);i=h;j=c[d>>2]|0;k=d+(c[j+-8>>2]|0)|0;l=c[j+-4>>2]|0;c[i>>2]=f;c[i+4>>2]=d;c[i+8>>2]=e;c[i+12>>2]=g;g=i+16|0;e=i+20|0;d=i+24|0;j=i+28|0;m=i+32|0;n=i+40|0;o=g;p=o+36|0;do{c[o>>2]=0;o=o+4|0}while((o|0)<(p|0));b[g+36>>1]=0;a[g+38>>0]=0;a:do if(se(l,f,0)|0){c[i+48>>2]=1;Oa[c[(c[l>>2]|0)+20>>2]&3](l,i,k,k,1,0);q=(c[d>>2]|0)==1?k:0}else{Na[c[(c[l>>2]|0)+24>>2]&3](l,i,k,1,0);switch(c[i+36>>2]|0){case 0:{q=(c[n>>2]|0)==1&(c[j>>2]|0)==1&(c[m>>2]|0)==1?c[e>>2]|0:0;break a;break}case 1:break;default:{q=0;break a}}if((c[d>>2]|0)!=1?!((c[n>>2]|0)==0&(c[j>>2]|0)==1&(c[m>>2]|0)==1):0){q=0;break}q=c[g>>2]|0}while(0);Aa=h;return q|0}function xe(a){a=a|0;ke(a);Sd(a);return}function ye(a,b,d,e,f,g){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0;if(se(a,c[b+8>>2]|0,g)|0)ve(0,b,d,e,f);else{h=c[a+8>>2]|0;Oa[c[(c[h>>2]|0)+20>>2]&3](h,b,d,e,f,g)}return}function ze(b,d,e,f,g){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0;do if(!(se(b,c[d+8>>2]|0,g)|0)){if(!(se(b,c[d>>2]|0,g)|0)){h=c[b+8>>2]|0;Na[c[(c[h>>2]|0)+24>>2]&3](h,d,e,f,g);break}if((c[d+16>>2]|0)!=(e|0)?(h=d+20|0,(c[h>>2]|0)!=(e|0)):0){c[d+32>>2]=f;i=d+44|0;if((c[i>>2]|0)==4)break;j=d+52|0;a[j>>0]=0;k=d+53|0;a[k>>0]=0;l=c[b+8>>2]|0;Oa[c[(c[l>>2]|0)+20>>2]&3](l,d,e,e,1,g);if(a[k>>0]|0)if(!(a[j>>0]|0)){m=1;n=11}else n=15;else{m=0;n=11}do if((n|0)==11){c[h>>2]=e;j=d+40|0;c[j>>2]=(c[j>>2]|0)+1;if((c[d+36>>2]|0)==1?(c[d+24>>2]|0)==2:0){a[d+54>>0]=1;if(m){n=15;break}else{o=4;break}}if(m)n=15;else o=4}while(0);if((n|0)==15)o=3;c[i>>2]=o;break}if((f|0)==1)c[d+32>>2]=1}else ue(0,d,e,f);while(0);return}function Ae(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0;if(se(a,c[b+8>>2]|0,0)|0)te(0,b,d,e);else{f=c[a+8>>2]|0;Ma[c[(c[f>>2]|0)+28>>2]&15](f,b,d,e)}return}function Be(a){a=a|0;return}function Ce(){var a=0;a=Aa;Aa=Aa+16|0;if((Aa|0)>=(Ba|0))w(16);if(!(wa(10548,38)|0)){Aa=a;return}else je(6077,a)}function De(a){a=a|0;var b=0;b=Aa;Aa=Aa+16|0;if((Aa|0)>=(Ba|0))w(16);Ld(a);if(!(ya(c[2637]|0,0)|0)){Aa=b;return}else je(6127,b)}function Ee(){var a=0,b=0;a=ie()|0;if((a|0?(b=c[a>>2]|0,b|0):0)?(a=b+48|0,(c[a>>2]&-256|0)==1126902528?(c[a+4>>2]|0)==1129074247:0):0)Fe(c[b+12>>2]|0);Fe(Ge()|0)}function Fe(a){a=a|0;var b=0;b=Aa;Aa=Aa+16|0;if((Aa|0)>=(Ba|0))w(16);Ga[a&3]();je(6180,b)}function Ge(){var a=0;a=c[925]|0;c[925]=a+0;return a|0}function He(a){a=a|0;return}function Ie(a){a=a|0;c[a>>2]=3792;Me(a+4|0);return}function Je(a){a=a|0;Ie(a);Sd(a);return}function Ke(a){a=a|0;return Le(a+4|0)|0}function Le(a){a=a|0;return c[a>>2]|0}function Me(a){a=a|0;var b=0,d=0;if(Yd(a)|0?(b=Ne(c[a>>2]|0)|0,a=b+8|0,d=c[a>>2]|0,c[a>>2]=d+-1,(d+-1|0)<0):0)Sd(b);return}function Ne(a){a=a|0;return a+-12|0}function Oe(a){a=a|0;Ie(a);Sd(a);return}function Pe(a){a=a|0;ke(a);Sd(a);return}function Qe(b,d,e,f,g,h){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;h=h|0;var i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0;if(se(b,c[d+8>>2]|0,h)|0)ve(0,d,e,f,g);else{i=d+52|0;j=a[i>>0]|0;k=d+53|0;l=a[k>>0]|0;m=c[b+12>>2]|0;n=b+16+(m<<3)|0;a[i>>0]=0;a[k>>0]=0;Ue(b+16|0,d,e,f,g,h);a:do if((m|0)>1){o=d+24|0;p=b+8|0;q=d+54|0;r=b+24|0;do{if(a[q>>0]|0)break a;if(!(a[i>>0]|0)){if(a[k>>0]|0?(c[p>>2]&1|0)==0:0)break a}else{if((c[o>>2]|0)==1)break a;if(!(c[p>>2]&2))break a}a[i>>0]=0;a[k>>0]=0;Ue(r,d,e,f,g,h);r=r+8|0}while(r>>>0<n>>>0)}while(0);a[i>>0]=j;a[k>>0]=l}return}function Re(b,d,e,f,g){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0;a:do if(!(se(b,c[d+8>>2]|0,g)|0)){if(!(se(b,c[d>>2]|0,g)|0)){h=c[b+12>>2]|0;i=b+16+(h<<3)|0;Ve(b+16|0,d,e,f,g);j=b+24|0;if((h|0)<=1)break;h=c[b+8>>2]|0;if((h&2|0)==0?(k=d+36|0,(c[k>>2]|0)!=1):0){if(!(h&1)){h=d+54|0;l=j;while(1){if(a[h>>0]|0)break a;if((c[k>>2]|0)==1)break a;Ve(l,d,e,f,g);l=l+8|0;if(l>>>0>=i>>>0)break a}}l=d+24|0;h=d+54|0;m=j;while(1){if(a[h>>0]|0)break a;if((c[k>>2]|0)==1?(c[l>>2]|0)==1:0)break a;Ve(m,d,e,f,g);m=m+8|0;if(m>>>0>=i>>>0)break a}}m=d+54|0;l=j;while(1){if(a[m>>0]|0)break a;Ve(l,d,e,f,g);l=l+8|0;if(l>>>0>=i>>>0)break a}}if((c[d+16>>2]|0)!=(e|0)?(i=d+20|0,(c[i>>2]|0)!=(e|0)):0){c[d+32>>2]=f;l=d+44|0;if((c[l>>2]|0)==4)break;m=b+16+(c[b+12>>2]<<3)|0;j=d+52|0;k=d+53|0;h=d+54|0;n=b+8|0;o=d+24|0;p=0;q=b+16|0;r=0;b:while(1){if(q>>>0>=m>>>0){s=p;t=18;break}a[j>>0]=0;a[k>>0]=0;Ue(q,d,e,e,1,g);if(a[h>>0]|0){s=p;t=18;break}do if(a[k>>0]|0){if(!(a[j>>0]|0))if(!(c[n>>2]&1)){s=1;t=18;break b}else{u=1;v=r;break}if((c[o>>2]|0)==1){t=23;break b}if(!(c[n>>2]&2)){t=23;break b}else{u=1;v=1}}else{u=p;v=r}while(0);p=u;q=q+8|0;r=v}do if((t|0)==18){if((!r?(c[i>>2]=e,q=d+40|0,c[q>>2]=(c[q>>2]|0)+1,(c[d+36>>2]|0)==1):0)?(c[o>>2]|0)==2:0){a[h>>0]=1;if(s){t=23;break}else{w=4;break}}if(s)t=23;else w=4}while(0);if((t|0)==23)w=3;c[l>>2]=w;break}if((f|0)==1)c[d+32>>2]=1}else ue(0,d,e,f);while(0);return}function Se(b,d,e,f){b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0;a:do if(!(se(b,c[d+8>>2]|0,0)|0)){g=c[b+12>>2]|0;h=b+16+(g<<3)|0;Te(b+16|0,d,e,f);if((g|0)>1){g=d+54|0;i=b+24|0;do{Te(i,d,e,f);if(a[g>>0]|0)break a;i=i+8|0}while(i>>>0<h>>>0)}}else te(0,d,e,f);while(0);return}function Te(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0;f=c[a+4>>2]|0;g=f>>8;if(!(f&1))h=g;else h=c[(c[d>>2]|0)+g>>2]|0;g=c[a>>2]|0;Ma[c[(c[g>>2]|0)+28>>2]&15](g,b,d+h|0,(f&2|0)==0?2:e);return}function Ue(a,b,d,e,f,g){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0,j=0;h=c[a+4>>2]|0;i=h>>8;if(!(h&1))j=i;else j=c[(c[e>>2]|0)+i>>2]|0;i=c[a>>2]|0;Oa[c[(c[i>>2]|0)+20>>2]&3](i,b,d,e+j|0,(h&2|0)==0?2:f,g);return}function Ve(a,b,d,e,f){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0;g=c[a+4>>2]|0;h=g>>8;if(!(g&1))i=h;else i=c[(c[d>>2]|0)+h>>2]|0;h=c[a>>2]|0;Na[c[(c[h>>2]|0)+24>>2]&3](h,b,d+i|0,(g&2|0)==0?2:e,f);return}function We(){var a=0;a=c[2638]|0;c[2638]=a+0;return a|0}function Xe(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0;e=Aa;Aa=Aa+16|0;if((Aa|0)>=(Ba|0))w(16);f=e;c[f>>2]=c[d>>2];g=Fa[c[(c[a>>2]|0)+16>>2]&7](a,b,f)|0;if(g)c[d>>2]=c[f>>2];Aa=e;return g&1|0}function Ye(a){a=a|0;var b=0;if(!a)b=0;else b=(we(a,2712,2800,0)|0)!=0&1;return b|0}function Ze(a,b){a=a|0;b=b|0;var c=0,d=0,e=0,f=0;c=a&65535;d=b&65535;e=r(d,c)|0;f=a>>>16;a=(e>>>16)+(r(d,f)|0)|0;d=b>>>16;b=r(d,c)|0;return (u((a>>>16)+(r(d,f)|0)+(((a&65535)+b|0)>>>16)|0),a+b<<16|e&65535|0)|0}function _e(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;var e=0,f=0;e=a;a=c;c=Ze(e,a)|0;f=v()|0;return (u((r(b,a)|0)+(r(d,e)|0)+f|f&0|0),c|0|0)|0}function $e(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;var e=0;e=a+c>>>0;return (u(b+d+(e>>>0<a>>>0|0)>>>0|0),e|0)|0}function af(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;var e=0;e=b-d>>>0;e=b-d-(c>>>0>a>>>0|0)>>>0;return (u(e|0),a-c>>>0|0)|0}function bf(a){a=a|0;return (a?31-(s(a^a-1)|0)|0:32)|0}
function cf(a,b,d,e,f){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,t=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0;g=a;h=b;i=h;j=d;k=e;l=k;if(!i){m=(f|0)!=0;if(!l){if(m){c[f>>2]=(g>>>0)%(j>>>0);c[f+4>>2]=0}n=0;o=(g>>>0)/(j>>>0)>>>0;return (u(n|0),o)|0}else{if(!m){n=0;o=0;return (u(n|0),o)|0}c[f>>2]=a|0;c[f+4>>2]=b&0;n=0;o=0;return (u(n|0),o)|0}}m=(l|0)==0;do if(j){if(!m){p=(s(l|0)|0)-(s(i|0)|0)|0;if(p>>>0<=31){q=p+1|0;r=31-p|0;t=p-31>>31;w=q;x=g>>>(q>>>0)&t|i<<r;y=i>>>(q>>>0)&t;z=0;A=g<<r;break}if(!f){n=0;o=0;return (u(n|0),o)|0}c[f>>2]=a|0;c[f+4>>2]=h|b&0;n=0;o=0;return (u(n|0),o)|0}r=j-1|0;if(r&j|0){t=(s(j|0)|0)+33-(s(i|0)|0)|0;q=64-t|0;p=32-t|0;B=p>>31;C=t-32|0;D=C>>31;w=t;x=p-1>>31&i>>>(C>>>0)|(i<<p|g>>>(t>>>0))&D;y=D&i>>>(t>>>0);z=g<<q&B;A=(i<<q|g>>>(C>>>0))&B|g<<p&t-33>>31;break}if(f|0){c[f>>2]=r&g;c[f+4>>2]=0}if((j|0)==1){n=h|b&0;o=a|0|0;return (u(n|0),o)|0}else{r=bf(j|0)|0;n=i>>>(r>>>0)|0;o=i<<32-r|g>>>(r>>>0)|0;return (u(n|0),o)|0}}else{if(m){if(f|0){c[f>>2]=(i>>>0)%(j>>>0);c[f+4>>2]=0}n=0;o=(i>>>0)/(j>>>0)>>>0;return (u(n|0),o)|0}if(!g){if(f|0){c[f>>2]=0;c[f+4>>2]=(i>>>0)%(l>>>0)}n=0;o=(i>>>0)/(l>>>0)>>>0;return (u(n|0),o)|0}r=l-1|0;if(!(r&l)){if(f|0){c[f>>2]=a|0;c[f+4>>2]=r&i|b&0}n=0;o=i>>>((bf(l|0)|0)>>>0);return (u(n|0),o)|0}r=(s(l|0)|0)-(s(i|0)|0)|0;if(r>>>0<=30){t=r+1|0;p=31-r|0;w=t;x=i<<p|g>>>(t>>>0);y=i>>>(t>>>0);z=0;A=g<<p;break}if(!f){n=0;o=0;return (u(n|0),o)|0}c[f>>2]=a|0;c[f+4>>2]=h|b&0;n=0;o=0;return (u(n|0),o)|0}while(0);if(!w){E=A;F=z;G=y;H=x;I=0;J=0}else{b=d|0|0;d=k|e&0;e=$e(b|0,d|0,-1,-1)|0;k=v()|0;h=A;A=z;z=y;y=x;x=w;w=0;do{a=h;h=A>>>31|h<<1;A=w|A<<1;g=y<<1|a>>>31|0;a=y>>>31|z<<1|0;af(e|0,k|0,g|0,a|0)|0;i=v()|0;l=i>>31|((i|0)<0?-1:0)<<1;w=l&1;y=af(g|0,a|0,l&b|0,(((i|0)<0?-1:0)>>31|((i|0)<0?-1:0)<<1)&d|0)|0;z=v()|0;x=x-1|0}while((x|0)!=0);E=h;F=A;G=z;H=y;I=0;J=w}w=F;F=0;if(f|0){c[f>>2]=H;c[f+4>>2]=G}n=(w|0)>>>31|(E|F)<<1|(F<<1|w>>>31)&0|I;o=(w<<1|0>>>31)&-2|J;return (u(n|0),o)|0}function df(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;return cf(a,b,c,d,0)|0}function ef(a,b,c){a=a|0;b=b|0;c=c|0;if((c|0)<32){u(b>>>c|0);return a>>>c|(b&(1<<c)-1)<<32-c}u(0);return b>>>c-32|0}function ff(a,b,c){a=a|0;b=b|0;c=c|0;if((c|0)<32){u(b<<c|(a&(1<<c)-1<<32-c)>>>32-c|0);return a<<c}u(a<<c-32|0);return 0}function gf(a){a=a|0;return (a&255)<<24|(a>>8&255)<<16|(a>>16&255)<<8|a>>>24|0}function hf(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0;if((e|0)>=8192){pa(b|0,d|0,e|0)|0;return b|0}f=b|0;g=b+e|0;if((b&3)==(d&3)){while(b&3){if(!e)return f|0;a[b>>0]=a[d>>0]|0;b=b+1|0;d=d+1|0;e=e-1|0}h=g&-4|0;e=h-64|0;while((b|0)<=(e|0)){c[b>>2]=c[d>>2];c[b+4>>2]=c[d+4>>2];c[b+8>>2]=c[d+8>>2];c[b+12>>2]=c[d+12>>2];c[b+16>>2]=c[d+16>>2];c[b+20>>2]=c[d+20>>2];c[b+24>>2]=c[d+24>>2];c[b+28>>2]=c[d+28>>2];c[b+32>>2]=c[d+32>>2];c[b+36>>2]=c[d+36>>2];c[b+40>>2]=c[d+40>>2];c[b+44>>2]=c[d+44>>2];c[b+48>>2]=c[d+48>>2];c[b+52>>2]=c[d+52>>2];c[b+56>>2]=c[d+56>>2];c[b+60>>2]=c[d+60>>2];b=b+64|0;d=d+64|0}while((b|0)<(h|0)){c[b>>2]=c[d>>2];b=b+4|0;d=d+4|0}}else{h=g-4|0;while((b|0)<(h|0)){a[b>>0]=a[d>>0]|0;a[b+1>>0]=a[d+1>>0]|0;a[b+2>>0]=a[d+2>>0]|0;a[b+3>>0]=a[d+3>>0]|0;b=b+4|0;d=d+4|0}}while((b|0)<(g|0)){a[b>>0]=a[d>>0]|0;b=b+1|0;d=d+1|0}return f|0}function jf(b,c,d){b=b|0;c=c|0;d=d|0;var e=0;if((c|0)<(b|0)&(b|0)<(c+d|0)){e=b;c=c+d|0;b=b+d|0;while((d|0)>0){b=b-1|0;c=c-1|0;d=d-1|0;a[b>>0]=a[c>>0]|0}b=e}else hf(b,c,d)|0;return b|0}function kf(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0;f=b+e|0;d=d&255;if((e|0)>=67){while(b&3){a[b>>0]=d;b=b+1|0}g=f&-4|0;h=d|d<<8|d<<16|d<<24;i=g-64|0;while((b|0)<=(i|0)){c[b>>2]=h;c[b+4>>2]=h;c[b+8>>2]=h;c[b+12>>2]=h;c[b+16>>2]=h;c[b+20>>2]=h;c[b+24>>2]=h;c[b+28>>2]=h;c[b+32>>2]=h;c[b+36>>2]=h;c[b+40>>2]=h;c[b+44>>2]=h;c[b+48>>2]=h;c[b+52>>2]=h;c[b+56>>2]=h;c[b+60>>2]=h;b=b+64|0}while((b|0)<(g|0)){c[b>>2]=h;b=b+4|0}}while((b|0)<(f|0)){a[b>>0]=d;b=b+1|0}return f-e|0}function lf(a){a=a|0;var b=0,d=0;b=c[i>>2]|0;d=b+a|0;if((a|0)>0&(d|0)<(b|0)|(d|0)<0){za(d|0)|0;da(12);return -1}if((d|0)>(na()|0)){if(!(qa(d|0)|0)){da(12);return -1}}else c[i>>2]=d;return b|0}function mf(a,b){a=a|0;b=b|0;return Da[a&15](b|0)|0}function nf(a,b,c){a=a|0;b=b|0;c=c|0;return Ea[a&7](b|0,c|0)|0}function of(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;return Fa[a&7](b|0,c|0,d|0)|0}function pf(a){a=a|0;Ga[a&3]()}function qf(a,b){a=a|0;b=b|0;Ha[a&63](b|0)}function rf(a,b,c,d){a=a|0;b=b|0;c=+c;d=d|0;Ia[a&3](b|0,+c,d|0)}function sf(a,b,c){a=a|0;b=b|0;c=c|0;Ja[a&7](b|0,c|0)}function tf(a,b,c,d){a=a|0;b=b|0;c=c|0;d=+d;Ka[a&0](b|0,c|0,+d)}function uf(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;La[a&1](b|0,c|0,d|0)}function vf(a,b,c,d,e){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;Ma[a&15](b|0,c|0,d|0,e|0)}function wf(a,b,c,d,e,f){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;f=f|0;Na[a&3](b|0,c|0,d|0,e|0,f|0)}function xf(a,b,c,d,e,f,g){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;f=f|0;g=g|0;Oa[a&3](b|0,c|0,d|0,e|0,f|0,g|0)}function yf(a){a=a|0;x(0);return 0}function zf(a){a=a|0;x(10);return 0}function Af(a){a=a|0;x(11);return 0}function Bf(a){a=a|0;x(12);return 0}function Cf(a){a=a|0;x(13);return 0}function Df(a){a=a|0;x(14);return 0}function Ef(a){a=a|0;x(15);return 0}function Ff(a,b){a=a|0;b=b|0;y(0);return 0}function Gf(a,b,c){a=a|0;b=b|0;c=c|0;z(0);return 0}function Hf(a,b,c){a=a|0;b=b|0;c=c|0;z(5);return 0}function If(a,b,c){a=a|0;b=b|0;c=c|0;z(6);return 0}function Jf(a,b,c){a=a|0;b=b|0;c=c|0;z(7);return 0}function Kf(){A(0)}function Lf(a){a=a|0;B(0)}function Mf(a){a=a|0;B(39)}function Nf(a){a=a|0;B(40)}function Of(a){a=a|0;B(41)}function Pf(a){a=a|0;B(42)}function Qf(a){a=a|0;B(43)}function Rf(a){a=a|0;B(44)}function Sf(a){a=a|0;B(45)}function Tf(a){a=a|0;B(46)}function Uf(a){a=a|0;B(47)}function Vf(a){a=a|0;B(48)}function Wf(a){a=a|0;B(49)}function Xf(a){a=a|0;B(50)}function Yf(a){a=a|0;B(51)}function Zf(a){a=a|0;B(52)}function _f(a){a=a|0;B(53)}function $f(a){a=a|0;B(54)}function ag(a){a=a|0;B(55)}function bg(a){a=a|0;B(56)}function cg(a){a=a|0;B(57)}function dg(a){a=a|0;B(58)}function eg(a){a=a|0;B(59)}function fg(a){a=a|0;B(60)}function gg(a){a=a|0;B(61)}function hg(a){a=a|0;B(62)}function ig(a){a=a|0;B(63)}function jg(a,b,c){a=a|0;b=+b;c=c|0;C(0)}function kg(a,b,c){a=a|0;b=+b;c=c|0;C(3)}function lg(a,b){a=a|0;b=b|0;D(0)}function mg(a,b,c){a=a|0;b=b|0;c=+c;E(0)}function ng(a,b,c){a=a|0;b=b|0;c=c|0;F(0)}function og(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;G(0)}function pg(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;G(9)}function qg(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;G(10)}function rg(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;G(11)}function sg(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;G(12)}function tg(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;G(13)}function ug(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;G(14)}function vg(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;G(15)}function wg(a,b,c,d,e){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;H(0)}function xg(a,b,c,d,e,f){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;f=f|0;I(0)}

// EMSCRIPTEN_END_FUNCS
var Da=[yf,nb,tb,vb,Bb,wc,Cc,Nc,Od,Ke,zf,Af,Bf,Cf,Df,Ef];var Ea=[Ff,sb,Ab,Ob,Tb,nc,sc,Bc];var Fa=[Gf,Oc,Pc,Tc,oe,Hf,If,Jf];var Ga=[Kf,he,Wa,Ce];var Ha=[Lf,lb,mb,pb,qb,Cb,ub,xb,yb,Pd,Mb,Nb,Pb,Rb,Sb,Ub,lc,mc,oc,qc,rc,tc,Dc,vc,yc,zc,Ac,Md,Nd,ke,le,me,ne,xe,Ie,Je,Oe,Pe,De,Mf,Nf,Of,Pf,Qf,Rf,Sf,Tf,Uf,Vf,Wf,Xf,Yf,Zf,_f,$f,ag,bg,cg,dg,eg,fg,gg,hg,ig];var Ia=[jg,db,gb,kg];var Ja=[lg,eb,fb,hb,ob,rb,wb,xc];var Ka=[mg];var La=[ng,Db];var Ma=[og,zb,Eb,Fb,Gb,Hb,re,Ae,Se,pg,qg,rg,sg,tg,ug,vg];var Na=[wg,qe,ze,Re];var Oa=[xg,pe,ye,Qe];return{__GLOBAL__sub_I_main_cpp:Mc,___cxa_can_catch:Xe,___cxa_is_pointer_type:Ye,___em_js__getCanvasHeight:Ua,___em_js__getCanvasWidth:Ta,___errno_location:Rc,___muldi3:_e,___udivdi3:df,_bitshift64Lshr:ef,_bitshift64Shl:ff,_fflush:id,_free:Ld,_i64Add:$e,_i64Subtract:af,_llvm_bswap_i32:gf,_main:Xa,_malloc:Kd,_memcpy:hf,_memmove:jf,_memset:kf,_sbrk:lf,dynCall_ii:mf,dynCall_iii:nf,dynCall_iiii:of,dynCall_v:pf,dynCall_vi:qf,dynCall_vidi:rf,dynCall_vii:sf,dynCall_viid:tf,dynCall_viii:uf,dynCall_viiii:vf,dynCall_viiiii:wf,dynCall_viiiiii:xf,establishStackSpace:Sa,stackAlloc:Pa,stackRestore:Ra,stackSave:Qa}})


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

